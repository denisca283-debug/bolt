BEGIN;
SET LOCAL lock_timeout='5s';
-- One identity; neither extension creates an auth account or copies a name/city.
CREATE TABLE public.model_profiles(
 user_id uuid PRIMARY KEY DEFAULT auth.uid() REFERENCES public.profiles(id) ON DELETE CASCADE,
 categories text[] NOT NULL DEFAULT '{}' CHECK(cardinality(categories)<=12 AND categories <@ ARRAY['fashion','editorial','commercial','lifestyle','beauty','runway','ecommerce','fit','parts','promotional','character','other']::text[]),
 bio text NOT NULL DEFAULT '' CHECK(length(bio)<=5000),travel_ready boolean NOT NULL DEFAULT false,
 availability text NOT NULL DEFAULT '' CHECK(length(availability)<=200),
 paid_work boolean NOT NULL DEFAULT true,tfp_collaboration boolean NOT NULL DEFAULT false,
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX model_categories_idx ON public.model_profiles USING gin(categories);
CREATE TABLE public.model_measurements(
 user_id uuid PRIMARY KEY DEFAULT auth.uid() REFERENCES public.model_profiles(user_id) ON DELETE CASCADE,
 height_cm numeric CHECK(height_cm BETWEEN 50 AND 250),chest_cm numeric CHECK(chest_cm BETWEEN 20 AND 250),
 waist_cm numeric CHECK(waist_cm BETWEEN 20 AND 250),hips_cm numeric CHECK(hips_cm BETWEEN 20 AND 250),
 inseam_cm numeric CHECK(inseam_cm BETWEEN 20 AND 150),shoe_eu numeric CHECK(shoe_eu BETWEEN 15 AND 60),
 clothing_size text CHECK(length(clothing_size)<=40),hair_color text CHECK(length(hair_color)<=60),hair_length text CHECK(length(hair_length)<=60),eye_color text CHECK(length(eye_color)<=60),
 visibility text NOT NULL DEFAULT 'private' CHECK(visibility IN ('public','members','work_context','private'))
);
CREATE INDEX model_height_idx ON public.model_measurements(height_cm);
CREATE TABLE public.model_credits(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES public.model_profiles(user_id) ON DELETE CASCADE,
 kind text NOT NULL CHECK(kind IN ('campaign','editorial','lookbook','runway','ecommerce','commercial','catalog','other')),
 title text NOT NULL CHECK(length(btrim(title)) BETWEEN 2 AND 200),client_name text CHECK(length(client_name)<=160),
 year integer CHECK(year BETWEEN 1900 AND 2200),created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX model_credits_person_idx ON public.model_credits(user_id,year DESC);
-- Canonical machine keys; audience remains a legacy display label only.
ALTER TABLE public.work_opportunities ADD COLUMN target_kinds text[] NOT NULL DEFAULT ARRAY['crew']::text[]
 CHECK(cardinality(target_kinds) BETWEEN 1 AND 3 AND target_kinds <@ ARRAY['actors','models','crew']::text[]),
 ADD COLUMN compensation_type text CHECK(compensation_type IN ('paid','expenses_only','unpaid_educational','tfp','in_kind','discount_requested','other')),
 ADD COLUMN expenses_covered text CHECK(length(expenses_covered)<=1000),
 ADD COLUMN usage_rights text CHECK(length(usage_rights)<=2000),ADD COLUMN deliverables text CHECK(length(deliverables)<=2000);
UPDATE public.work_opportunities SET target_kinds=ARRAY['actors'] WHERE audience IN ('Актёры','actor');
ALTER TABLE public.work_opportunities ADD CONSTRAINT model_work_terms CHECK(NOT ('models'=ANY(target_kinds)) OR
 (compensation_type IS NOT NULL AND length(btrim(coalesce(expenses_covered,'')))>0 AND length(btrim(coalesce(usage_rights,'')))>0
 AND length(btrim(coalesce(deliverables,'')))>0 AND length(btrim(coalesce(city,'')))>0 AND length(btrim(coalesce(shoot_date,'')))>0));
GRANT INSERT(target_kinds,compensation_type,expenses_covered,usage_rights,deliverables),UPDATE(target_kinds,compensation_type,expenses_covered,usage_rights,deliverables) ON public.work_opportunities TO authenticated;
CREATE OR REPLACE VIEW public.work_opportunities_discovery WITH(security_invoker=true) AS SELECT * FROM public.work_opportunities WHERE visibility='public' AND filmverse_private.org_discoverable(organization_id);
ALTER TABLE public.profile_media DROP CONSTRAINT profile_media_media_type_check;
ALTER TABLE public.profile_media ADD CONSTRAINT profile_media_media_type_check CHECK(media_type IN ('headshot','gallery','showreel','video_intro','self_tape','audio','model_digitals','model_portfolio','model_walk'));
ALTER TABLE public.profile_media ADD COLUMN model_angle text CHECK(model_angle IN ('headshot_front','profile','three_quarter','full_front','full_side','full_back','walk'));
GRANT INSERT(model_angle),UPDATE(model_angle) ON public.profile_media TO authenticated;
ALTER TABLE public.profile_representations ADD COLUMN territory text CHECK(length(territory)<=160),ADD COLUMN starts_on date,ADD COLUMN ends_on date,
 ADD CONSTRAINT representation_dates CHECK(ends_on IS NULL OR starts_on IS NULL OR ends_on>=starts_on);
GRANT INSERT(territory,starts_on,ends_on),UPDATE(territory,starts_on,ends_on) ON public.profile_representations TO authenticated;
CREATE OR REPLACE FUNCTION filmverse_private.person_representatives(p_user uuid) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT coalesce(jsonb_agg(row_to_json(r)),'[]') FROM (
 SELECT id,name,role_type,organization_id,territory,starts_on,ends_on,
 CASE WHEN filmverse_private.contact_visible(user_id,contact_visibility) THEN contact ELSE NULL END AS contact
 FROM public.profile_representations WHERE user_id=p_user AND active
 AND filmverse_private.contact_visible(user_id,visibility)
 AND (p_user=auth.uid() OR ((starts_on IS NULL OR starts_on<=current_date) AND (ends_on IS NULL OR ends_on>=current_date)))
 ORDER BY created_at,id LIMIT 20) r
$$;

DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['model_profiles','model_measurements','model_credits'] LOOP
 EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
 EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC,anon,authenticated',t);
 EXECUTE format('GRANT SELECT ON public.%I TO anon,authenticated',t);
 EXECUTE format('GRANT ALL ON public.%I TO service_role',t);
 EXECUTE format('CREATE POLICY model_owner ON public.%I FOR ALL TO authenticated USING(user_id=auth.uid()) WITH CHECK(user_id=auth.uid())',t);
 END LOOP;
END $$;
GRANT INSERT(user_id,categories,bio,travel_ready,availability,paid_work,tfp_collaboration),UPDATE(categories,bio,travel_ready,availability,paid_work,tfp_collaboration),DELETE ON public.model_profiles TO authenticated;
GRANT INSERT(user_id,height_cm,chest_cm,waist_cm,hips_cm,inseam_cm,shoe_eu,clothing_size,hair_color,hair_length,eye_color,visibility),UPDATE(height_cm,chest_cm,waist_cm,hips_cm,inseam_cm,shoe_eu,clothing_size,hair_color,hair_length,eye_color,visibility),DELETE ON public.model_measurements TO authenticated;
GRANT INSERT(kind,title,client_name,year),UPDATE(kind,title,client_name,year),DELETE ON public.model_credits TO authenticated;
CREATE POLICY model_read ON public.model_profiles FOR SELECT TO anon,authenticated USING(filmverse_private.person_visible(user_id));
CREATE POLICY measurements_read ON public.model_measurements FOR SELECT TO anon,authenticated USING(filmverse_private.contact_visible(user_id,visibility));
CREATE POLICY credits_read ON public.model_credits FOR SELECT TO anon,authenticated USING(filmverse_private.person_visible(user_id));
CREATE TRIGGER model_updated BEFORE UPDATE ON public.model_profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE FUNCTION filmverse_private.model_search(p_filters jsonb,p_offset int) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT coalesce(jsonb_agg(row_to_json(r)),'[]') FROM (
 SELECT p.id,p.full_name,p.public_slug,p.city,p.avatar_url,m.categories,m.travel_ready,m.availability,m.paid_work,m.tfp_collaboration,
 z.height_cm,z.chest_cm,z.waist_cm,z.hips_cm,z.shoe_eu,z.hair_color,z.eye_color
 FROM public.model_profiles m JOIN public.profiles p ON p.id=m.user_id
 LEFT JOIN public.model_measurements z ON z.user_id=m.user_id AND filmverse_private.contact_visible(z.user_id,z.visibility)
 WHERE filmverse_private.person_discoverable(p.id)
 AND (coalesce(p_filters->>'city','')='' OR p.city ILIKE '%'||left(p_filters->>'city',100)||'%')
 AND (coalesce(p_filters->>'category','')='' OR p_filters->>'category'=ANY(m.categories))
 AND (nullif(p_filters->>'height_min','') IS NULL OR z.height_cm>=(p_filters->>'height_min')::numeric)
 AND (nullif(p_filters->>'height_max','') IS NULL OR z.height_cm<=(p_filters->>'height_max')::numeric)
 AND (coalesce(p_filters->>'hair','')='' OR z.hair_color=p_filters->>'hair')
 AND (coalesce(p_filters->>'eyes','')='' OR z.eye_color=p_filters->>'eyes')
 AND (coalesce(p_filters->>'availability','')='' OR m.availability ILIKE '%'||left(p_filters->>'availability',100)||'%')
 AND (coalesce(p_filters->>'travel','false')<>'true' OR m.travel_ready)
 AND (coalesce(p_filters->>'digitals','false')<>'true' OR EXISTS(SELECT 1 FROM public.profile_media x WHERE x.user_id=p.id AND x.media_type='model_digitals' AND filmverse_private.media_visible(x.object_path)))
 AND (coalesce(p_filters->>'portfolio','false')<>'true' OR EXISTS(SELECT 1 FROM public.profile_media x WHERE x.user_id=p.id AND x.media_type='model_portfolio' AND filmverse_private.media_visible(x.object_path)))
 AND (coalesce(p_filters->>'represented','false')<>'true' OR EXISTS(SELECT 1 FROM public.profile_representations x WHERE x.user_id=p.id AND x.active AND (x.starts_on IS NULL OR x.starts_on<=current_date) AND (x.ends_on IS NULL OR x.ends_on>=current_date) AND filmverse_private.contact_visible(x.user_id,x.visibility)))
 AND (coalesce(p_filters->>'verified','false')<>'true' OR EXISTS(SELECT 1 FROM public.verification_records v WHERE v.user_id=p.id AND v.verification_type='identity' AND v.status='approved'))
 ORDER BY p.full_name,p.id LIMIT 24 OFFSET greatest(0,least(p_offset,10000))) r
$$;
CREATE FUNCTION public.model_search(p_filters jsonb DEFAULT '{}',p_offset int DEFAULT 0) RETURNS jsonb
LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$ SELECT filmverse_private.model_search(p_filters,p_offset) $$;

CREATE TABLE public.education_affiliations(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES public.profiles(id) ON DELETE CASCADE,
 organization_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL,
 institution_name text NOT NULL DEFAULT '' CHECK(length(institution_name)<=200),program text NOT NULL DEFAULT '' CHECK(length(program)<=160),specialization text NOT NULL DEFAULT '' CHECK(length(specialization)<=160),
 start_year integer CHECK(start_year BETWEEN 1900 AND 2200),expected_graduation_year integer CHECK(expected_graduation_year BETWEEN 1900 AND 2200),
 status text NOT NULL DEFAULT 'current_student' CHECK(status IN ('current_student','recent_graduate','alumni')),
 visibility text NOT NULL DEFAULT 'private' CHECK(visibility IN ('public','members','private')),
 badge_visible boolean NOT NULL DEFAULT false,revision integer NOT NULL DEFAULT 1,
 created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),
 CHECK(organization_id IS NOT NULL OR length(btrim(institution_name))>=2),
 CHECK(start_year IS NULL OR expected_graduation_year IS NULL OR expected_graduation_year>=start_year)
);
CREATE INDEX affiliations_person_idx ON public.education_affiliations(user_id,status);
CREATE INDEX affiliations_school_idx ON public.education_affiliations(organization_id);
CREATE FUNCTION filmverse_private.education_guard() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NEW.organization_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.organizations WHERE id=NEW.organization_id AND organization_type='education'
 AND (visibility IN ('public','unlisted') OR filmverse_private.org_member(id))) THEN RAISE EXCEPTION 'education_organization_unavailable' USING ERRCODE='42501'; END IF;
 IF TG_OP='UPDATE' THEN
 IF (NEW.organization_id,NEW.institution_name,NEW.program,NEW.specialization,NEW.start_year,NEW.expected_graduation_year,NEW.status)
 IS DISTINCT FROM (OLD.organization_id,OLD.institution_name,OLD.program,OLD.specialization,OLD.start_year,OLD.expected_graduation_year,OLD.status)
 THEN NEW.revision:=OLD.revision+1; ELSE NEW.revision:=OLD.revision; END IF;
 END IF;
 NEW.updated_at:=now(); RETURN NEW;
END $$;
CREATE TRIGGER education_revision BEFORE INSERT OR UPDATE ON public.education_affiliations FOR EACH ROW EXECUTE FUNCTION filmverse_private.education_guard();
INSERT INTO public.permissions(name,description) VALUES('review_student_verification','Review current student enrollment, never own evidence') ON CONFLICT(name) DO NOTHING;
CREATE FUNCTION filmverse_private.student_reviewer() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT auth.uid() IS NOT NULL AND EXISTS(SELECT 1 FROM public.user_permissions u JOIN public.permissions p ON p.id=u.permission_id WHERE u.user_id=auth.uid() AND p.name='review_student_verification')
$$;
CREATE FUNCTION public.student_reviewer() RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$ SELECT filmverse_private.student_reviewer() $$;
CREATE TABLE public.student_verifications(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),affiliation_id uuid NOT NULL REFERENCES public.education_affiliations(id) ON DELETE CASCADE,
 user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,affiliation_revision integer NOT NULL,
 method text NOT NULL DEFAULT 'manual_enrollment' CHECK(method IN ('manual_enrollment','school_confirmation','educational_email','partner_invitation')),
 evidence_path text NOT NULL, status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected','revoked')),
 reviewed_by uuid REFERENCES auth.users(id),verified_at timestamptz,valid_until timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(),CHECK(status<>'approved' OR (verified_at IS NOT NULL AND valid_until>verified_at AND reviewed_by IS NOT NULL AND reviewed_by<>user_id))
);
CREATE UNIQUE INDEX student_pending_idx ON public.student_verifications(affiliation_id) WHERE status='pending';
CREATE INDEX student_valid_idx ON public.student_verifications(user_id,valid_until) WHERE status='approved';
CREATE FUNCTION filmverse_private.student_current(p_affiliation uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM public.education_affiliations a JOIN public.student_verifications v ON v.affiliation_id=a.id AND v.user_id=a.user_id AND v.affiliation_revision=a.revision
 WHERE a.id=p_affiliation AND a.status='current_student' AND a.expected_graduation_year>=extract(year FROM current_date)
 AND v.status='approved' AND v.verified_at<=now() AND v.valid_until>now())
$$;
CREATE FUNCTION filmverse_private.student_badge(p_user uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT filmverse_private.person_visible(p_user) AND EXISTS(SELECT 1 FROM public.education_affiliations a WHERE a.user_id=p_user AND (a.badge_visible OR p_user=auth.uid()) AND filmverse_private.student_current(a.id))
$$;
CREATE FUNCTION public.student_badge(p_user uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$ SELECT filmverse_private.student_badge(p_user) $$;
CREATE FUNCTION filmverse_private.student_verification_submit(p_affiliation uuid,p_path text) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE a public.education_affiliations; result uuid;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication_required' USING ERRCODE='42501'; END IF;
 PERFORM 1 FROM public.profiles WHERE id=auth.uid() FOR UPDATE;
 SELECT * INTO a FROM public.education_affiliations WHERE id=p_affiliation AND user_id=auth.uid() FOR UPDATE;
 IF NOT FOUND OR a.status<>'current_student' OR a.expected_graduation_year IS NULL OR a.expected_graduation_year<extract(year FROM current_date)
 OR split_part(p_path,'/',1)<>auth.uid()::text OR NOT EXISTS(SELECT 1 FROM storage.objects WHERE bucket_id='student-evidence' AND name=p_path)
 THEN RAISE EXCEPTION 'invalid_enrollment_evidence' USING ERRCODE='42501'; END IF;
 IF (SELECT count(*) FROM public.student_verifications WHERE user_id=auth.uid() AND created_at>now()-interval '1 day')>=3 THEN RAISE EXCEPTION 'verification_daily_limit' USING ERRCODE='23514'; END IF;
 INSERT INTO public.student_verifications(affiliation_id,user_id,affiliation_revision,evidence_path) VALUES(a.id,a.user_id,a.revision,p_path) RETURNING id INTO result;
 RETURN result;
END $$;
CREATE FUNCTION public.student_verification_submit(p_affiliation uuid,p_path text) RETURNS uuid LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT filmverse_private.student_verification_submit(p_affiliation,p_path) $$;
CREATE FUNCTION filmverse_private.student_verification_review(p_id uuid,p_approve boolean,p_until timestamptz) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v public.student_verifications; a public.education_affiliations;
BEGIN
 IF NOT filmverse_private.student_reviewer() THEN RAISE EXCEPTION 'review_permission_required' USING ERRCODE='42501'; END IF;
 SELECT * INTO v FROM public.student_verifications WHERE id=p_id FOR UPDATE;
 IF NOT FOUND OR v.user_id=auth.uid() OR v.status<>'pending' THEN RAISE EXCEPTION 'review_forbidden' USING ERRCODE='42501'; END IF;
 SELECT * INTO a FROM public.education_affiliations WHERE id=v.affiliation_id FOR UPDATE;
 IF p_approve AND (a.revision<>v.affiliation_revision OR a.status<>'current_student' OR p_until IS NULL OR p_until<=now()
 OR p_until>now()+interval '1 year' OR p_until>make_date(a.expected_graduation_year,12,31)+interval '1 day')
 THEN RAISE EXCEPTION 'invalid_verification_expiry' USING ERRCODE='22023'; END IF;
 UPDATE public.student_verifications SET status=CASE WHEN p_approve THEN 'approved' ELSE 'rejected' END,
 reviewed_by=auth.uid(),verified_at=CASE WHEN p_approve THEN now() ELSE NULL END,valid_until=CASE WHEN p_approve THEN p_until ELSE NULL END WHERE id=p_id;
END $$;
CREATE FUNCTION public.student_verification_review(p_id uuid,p_approve boolean,p_until timestamptz DEFAULT NULL) RETURNS void LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT filmverse_private.student_verification_review(p_id,p_approve,p_until) $$;

DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['education_affiliations','student_verifications'] LOOP
 EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC,anon,authenticated',t);
 EXECUTE format('GRANT ALL ON public.%I TO service_role',t);END LOOP;
END $$;
GRANT SELECT ON public.education_affiliations TO anon,authenticated;
GRANT INSERT(organization_id,institution_name,program,specialization,start_year,expected_graduation_year,status,visibility,badge_visible),UPDATE(organization_id,institution_name,program,specialization,start_year,expected_graduation_year,status,visibility,badge_visible),DELETE ON public.education_affiliations TO authenticated;
CREATE POLICY education_read ON public.education_affiliations FOR SELECT TO anon,authenticated USING(filmverse_private.contact_visible(user_id,visibility));
CREATE POLICY education_owner ON public.education_affiliations FOR ALL TO authenticated USING(user_id=auth.uid()) WITH CHECK(user_id=auth.uid());
GRANT SELECT ON public.student_verifications TO authenticated;
CREATE POLICY student_verification_read ON public.student_verifications FOR SELECT TO authenticated USING(user_id=auth.uid() OR filmverse_private.student_reviewer());
CREATE VIEW public.student_verification_status WITH(security_invoker=true) AS
 SELECT v.id,v.user_id,v.affiliation_id,v.valid_until,v.created_at,
 CASE WHEN v.status='approved' AND (v.valid_until<=now() OR a.revision<>v.affiliation_revision OR a.status<>'current_student' OR a.expected_graduation_year<extract(year FROM current_date)) THEN 'expired' ELSE v.status END AS status
 FROM public.student_verifications v JOIN public.education_affiliations a ON a.id=v.affiliation_id;
REVOKE ALL ON public.student_verification_status FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.student_verification_status TO authenticated;
INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types) VALUES('student-evidence','student-evidence',false,10485760,ARRAY['application/pdf','image/jpeg','image/png']);
-- Only unsubmitted uploads may be cleaned up by their owner; retained evidence is immutable.
CREATE POLICY student_evidence_cleanup ON storage.objects FOR DELETE TO authenticated USING(bucket_id='student-evidence' AND (storage.foldername(name))[1]=auth.uid()::text AND NOT EXISTS(SELECT 1 FROM public.student_verifications v WHERE v.evidence_path=name));
CREATE POLICY student_evidence_upload ON storage.objects FOR INSERT TO authenticated WITH CHECK(bucket_id='student-evidence' AND (storage.foldername(name))[1]=auth.uid()::text);
CREATE POLICY student_evidence_read ON storage.objects FOR SELECT TO authenticated USING(bucket_id='student-evidence' AND ((storage.foldername(name))[1]=auth.uid()::text OR (filmverse_private.student_reviewer() AND EXISTS(SELECT 1 FROM public.student_verifications v WHERE v.evidence_path=name))));

-- All exposed functions are invokers; private definers have explicit authority.
REVOKE ALL ON FUNCTION filmverse_private.education_guard(),filmverse_private.student_current(uuid) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION filmverse_private.model_search(jsonb,int),public.model_search(jsonb,int),filmverse_private.student_badge(uuid),public.student_badge(uuid),filmverse_private.student_reviewer(),public.student_reviewer(),filmverse_private.student_verification_submit(uuid,text),public.student_verification_submit(uuid,text),filmverse_private.student_verification_review(uuid,boolean,timestamptz),public.student_verification_review(uuid,boolean,timestamptz) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION filmverse_private.model_search(jsonb,int),public.model_search(jsonb,int),filmverse_private.student_badge(uuid),public.student_badge(uuid) TO anon,authenticated;
GRANT EXECUTE ON FUNCTION filmverse_private.student_reviewer(),public.student_reviewer(),filmverse_private.student_verification_submit(uuid,text),public.student_verification_submit(uuid,text),filmverse_private.student_verification_review(uuid,boolean,timestamptz),public.student_verification_review(uuid,boolean,timestamptz) TO authenticated;
CREATE FUNCTION filmverse_private.model_save(p_model jsonb,p_measurements jsonb) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication_required' USING ERRCODE='42501'; END IF;
 INSERT INTO public.model_profiles(user_id,categories,bio,travel_ready,availability,paid_work,tfp_collaboration)
 VALUES(auth.uid(),ARRAY(SELECT jsonb_array_elements_text(coalesce(p_model->'categories','[]'))),coalesce(p_model->>'bio',''),coalesce((p_model->>'travel_ready')::boolean,false),coalesce(p_model->>'availability',''),coalesce((p_model->>'paid_work')::boolean,true),coalesce((p_model->>'tfp_collaboration')::boolean,false))
 ON CONFLICT(user_id) DO UPDATE SET categories=EXCLUDED.categories,bio=EXCLUDED.bio,travel_ready=EXCLUDED.travel_ready,availability=EXCLUDED.availability,paid_work=EXCLUDED.paid_work,tfp_collaboration=EXCLUDED.tfp_collaboration;
 INSERT INTO public.model_measurements(user_id,height_cm,chest_cm,waist_cm,hips_cm,inseam_cm,shoe_eu,clothing_size,hair_color,hair_length,eye_color,visibility)
 VALUES(auth.uid(),nullif(p_measurements->>'height_cm','')::numeric,nullif(p_measurements->>'chest_cm','')::numeric,nullif(p_measurements->>'waist_cm','')::numeric,nullif(p_measurements->>'hips_cm','')::numeric,nullif(p_measurements->>'inseam_cm','')::numeric,nullif(p_measurements->>'shoe_eu','')::numeric,p_measurements->>'clothing_size',p_measurements->>'hair_color',p_measurements->>'hair_length',p_measurements->>'eye_color',coalesce(p_measurements->>'visibility','private'))
 ON CONFLICT(user_id) DO UPDATE SET height_cm=EXCLUDED.height_cm,chest_cm=EXCLUDED.chest_cm,waist_cm=EXCLUDED.waist_cm,hips_cm=EXCLUDED.hips_cm,inseam_cm=EXCLUDED.inseam_cm,shoe_eu=EXCLUDED.shoe_eu,clothing_size=EXCLUDED.clothing_size,hair_color=EXCLUDED.hair_color,hair_length=EXCLUDED.hair_length,eye_color=EXCLUDED.eye_color,visibility=EXCLUDED.visibility;
END $$;
CREATE FUNCTION public.model_save(p_model jsonb,p_measurements jsonb) RETURNS void LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT filmverse_private.model_save(p_model,p_measurements) $$;
CREATE FUNCTION filmverse_private.student_review_queue() RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT coalesce(jsonb_agg(row_to_json(r)),'[]') FROM (
 SELECT v.id,v.evidence_path,v.created_at,a.institution_name,a.program,a.expected_graduation_year
 FROM public.student_verifications v JOIN public.education_affiliations a ON a.id=v.affiliation_id
 WHERE filmverse_private.student_reviewer() AND v.status='pending' AND v.user_id<>auth.uid()
 ORDER BY v.created_at,v.id LIMIT 50) r
$$;
CREATE FUNCTION public.student_review_queue() RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$ SELECT filmverse_private.student_review_queue() $$;
REVOKE ALL ON FUNCTION filmverse_private.model_save(jsonb,jsonb),public.model_save(jsonb,jsonb),filmverse_private.student_review_queue(),public.student_review_queue() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION filmverse_private.model_save(jsonb,jsonb),public.model_save(jsonb,jsonb),filmverse_private.student_review_queue(),public.student_review_queue() TO authenticated;
COMMIT;
