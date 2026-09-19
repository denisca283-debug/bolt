BEGIN;
SET LOCAL lock_timeout='5s';
INSERT INTO public.permissions(name,description) VALUES
 ('search_minor_talent','Reviewed professional access to protected Young Talent'),
 ('publish_minor_opportunity','Publish reviewed opportunities involving minors'),
 ('review_guardianship','Review legal representative authority, never self'),
 ('review_minor_opportunity','Review minor opportunity safeguards')
 ON CONFLICT(name) DO NOTHING;
CREATE FUNCTION filmverse_private.network_permission(p_name text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT auth.uid() IS NOT NULL AND EXISTS(SELECT 1 FROM public.user_permissions u JOIN public.permissions p ON p.id=u.permission_id WHERE u.user_id=auth.uid() AND p.name=p_name)
$$;
CREATE TABLE public.minor_talent_profiles(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),display_name text NOT NULL CHECK(length(btrim(display_name)) BETWEEN 2 AND 100),
 city text CHECK(length(city)<=100),region text CHECK(length(region)<=100),actor_enabled boolean NOT NULL DEFAULT true,model_enabled boolean NOT NULL DEFAULT false,
 playing_age_min int CHECK(playing_age_min BETWEEN 0 AND 25),playing_age_max int CHECK(playing_age_max BETWEEN 0 AND 25),
 height_cm numeric CHECK(height_cm BETWEEN 30 AND 250),hair text CHECK(length(hair)<=60),eyes text CHECK(length(eyes)<=60),
 bio text NOT NULL DEFAULT '' CHECK(length(bio)<=3000),availability text CHECK(length(availability)<=200),travel boolean NOT NULL DEFAULT false,
 discoverable boolean NOT NULL DEFAULT false,created_by uuid NOT NULL REFERENCES auth.users(id),updated_at timestamptz NOT NULL DEFAULT now(),
 CHECK(playing_age_max IS NULL OR playing_age_min IS NULL OR playing_age_max>=playing_age_min)
);
CREATE INDEX minor_discovery_city_idx ON public.minor_talent_profiles(city,id) WHERE discoverable;
CREATE TABLE filmverse_private.minor_talent_private(
 minor_talent_id uuid PRIMARY KEY REFERENCES public.minor_talent_profiles(id) ON DELETE CASCADE,
 legal_identity text,DOB date,compliance_facts jsonb NOT NULL DEFAULT '{}' CHECK(jsonb_typeof(compliance_facts)='object' AND octet_length(compliance_facts::text)<=8192)
);
CREATE TABLE public.minor_guardians(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),minor_talent_id uuid NOT NULL REFERENCES public.minor_talent_profiles(id) ON DELETE CASCADE,
 guardian_user_id uuid NOT NULL REFERENCES public.profiles(id),
 relationship text NOT NULL CHECK(relationship IN ('parent','legal_guardian','authorized_legal_representative')),
 is_primary boolean NOT NULL DEFAULT false,status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','revoked')),
 reviewed_by uuid REFERENCES auth.users(id),reviewed_at timestamptz,valid_until timestamptz,decision_reason text CHECK(length(decision_reason)<=1000),
 UNIQUE(minor_talent_id,guardian_user_id),CHECK(status<>'approved' OR (reviewed_by IS NOT NULL AND reviewed_by<>guardian_user_id AND reviewed_at IS NOT NULL AND valid_until>reviewed_at))
);
CREATE UNIQUE INDEX minor_primary_guardian ON public.minor_guardians(minor_talent_id) WHERE is_primary AND status='approved';
CREATE INDEX guardian_person_idx ON public.minor_guardians(guardian_user_id,minor_talent_id);
CREATE FUNCTION filmverse_private.minor_guardian(p_minor uuid,p_pending boolean DEFAULT false) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT auth.uid() IS NOT NULL AND EXISTS(SELECT 1 FROM public.minor_guardians WHERE minor_talent_id=p_minor AND guardian_user_id=auth.uid()
 AND ((status='approved' AND valid_until>now()) OR (p_pending AND status='pending')))
$$;
CREATE FUNCTION filmverse_private.minor_visible(p_minor uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT auth.uid() IS NOT NULL AND (filmverse_private.minor_guardian(p_minor,true) OR
 (filmverse_private.network_permission('search_minor_talent') AND EXISTS(SELECT 1 FROM public.minor_talent_profiles p WHERE p.id=p_minor AND p.discoverable)
 AND EXISTS(SELECT 1 FROM public.minor_guardians g WHERE g.minor_talent_id=p_minor AND g.status='approved' AND g.valid_until>now() AND filmverse_private.support_not_blocked(g.guardian_user_id))))
$$;
CREATE TABLE public.casting_subjects(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),subject_type text NOT NULL CHECK(subject_type IN ('adult','minor','future_external')),
 adult_user_id uuid UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,minor_talent_id uuid UNIQUE REFERENCES public.minor_talent_profiles(id),
 external_reference uuid UNIQUE,
 CHECK((subject_type='adult' AND adult_user_id IS NOT NULL AND minor_talent_id IS NULL AND external_reference IS NULL)
 OR (subject_type='minor' AND adult_user_id IS NULL AND minor_talent_id IS NOT NULL AND external_reference IS NULL)
 OR (subject_type='future_external' AND adult_user_id IS NULL AND minor_talent_id IS NULL AND external_reference IS NOT NULL))
);
INSERT INTO public.casting_subjects(subject_type,adult_user_id) SELECT 'adult',id FROM public.profiles;
CREATE FUNCTION filmverse_private.casting_subject_bootstrap() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN INSERT INTO public.casting_subjects(subject_type,adult_user_id) VALUES('adult',NEW.id);RETURN NEW;END $$;
CREATE TRIGGER casting_subject_after_profile AFTER INSERT ON public.profiles FOR EACH ROW EXECUTE FUNCTION filmverse_private.casting_subject_bootstrap();
CREATE FUNCTION filmverse_private.subject_manage(p_subject uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT auth.uid() IS NOT NULL AND EXISTS(SELECT 1 FROM public.casting_subjects s WHERE s.id=p_subject AND (s.adult_user_id=auth.uid() OR filmverse_private.minor_guardian(s.minor_talent_id)))
$$;
CREATE FUNCTION filmverse_private.subject_visible(p_subject uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM public.casting_subjects s WHERE s.id=p_subject AND ((s.subject_type='adult' AND filmverse_private.person_visible(s.adult_user_id)) OR (s.subject_type='minor' AND filmverse_private.minor_visible(s.minor_talent_id))))
$$;
CREATE TABLE public.minor_project_consents(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),casting_subject_id uuid NOT NULL REFERENCES public.casting_subjects(id),
 project_id uuid NOT NULL REFERENCES public.projects(id),guardian_user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES public.profiles(id),
 scope text NOT NULL CHECK(scope IN ('application','audition','participation')),terms_version text NOT NULL CHECK(length(terms_version) BETWEEN 1 AND 100),
 granted_at timestamptz NOT NULL DEFAULT now(),revoked_at timestamptz,expires_at timestamptz NOT NULL CHECK(expires_at>granted_at),
 UNIQUE(casting_subject_id,project_id,guardian_user_id,scope,terms_version)
);
CREATE TABLE public.minor_work_compliance(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),project_id uuid NOT NULL REFERENCES public.projects(id),
 casting_subject_id uuid NOT NULL REFERENCES public.casting_subjects(id),country text NOT NULL CHECK(length(country)=2),region text,
 requirement_type text NOT NULL CHECK(requirement_type IN ('guardian_consent','work_permit','guardianship_authority','school_permission','medical_clearance','chaperone','other')),
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','reviewed','expired','rejected')),expires_at timestamptz,reviewer uuid REFERENCES auth.users(id),
 private_document text,notes text CHECK(length(notes)<=3000)
);
CREATE TABLE public.minor_media(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),minor_talent_id uuid NOT NULL REFERENCES public.minor_talent_profiles(id),object_path text NOT NULL UNIQUE,
 media_type text NOT NULL CHECK(media_type IN ('image','video','audio')),version int NOT NULL DEFAULT 1 CHECK(version>0),
 sanitized_at timestamptz,created_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types) VALUES('minor-media','minor-media',false,52428800,ARRAY['image/jpeg','image/png','image/webp','video/mp4','video/webm']);
-- No client upload until EXIF/GPS sanitation exists. Private bucket alone is insufficient.
CREATE POLICY minor_media_read ON storage.objects FOR SELECT TO authenticated USING(bucket_id='minor-media' AND EXISTS(
 SELECT 1 FROM public.minor_media m WHERE m.object_path=name AND m.sanitized_at IS NOT NULL AND filmverse_private.minor_visible(m.minor_talent_id)));
ALTER TABLE public.work_opportunities ADD COLUMN minor_opportunity boolean NOT NULL DEFAULT false,
 ADD COLUMN minor_responsible_adult uuid REFERENCES public.profiles(id);
CREATE TABLE filmverse_private.minor_opportunity_reviews(work_id uuid PRIMARY KEY REFERENCES public.work_opportunities(id),reviewer uuid NOT NULL REFERENCES public.profiles(id),reviewed_at timestamptz NOT NULL DEFAULT now(),content_hash text NOT NULL);
ALTER TABLE filmverse_private.minor_opportunity_reviews ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON filmverse_private.minor_opportunity_reviews FROM PUBLIC,anon,authenticated;
CREATE FUNCTION filmverse_private.minor_work_reviewed(p_work uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM filmverse_private.minor_opportunity_reviews r JOIN public.work_opportunities w ON w.id=r.work_id WHERE w.id=p_work AND r.reviewer IS DISTINCT FROM w.user_id AND r.content_hash=encode(sha256(convert_to((to_jsonb(w)-'updated_at')::text,'UTF8')),'hex'))
$$;
REVOKE ALL ON FUNCTION filmverse_private.minor_work_reviewed(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION filmverse_private.minor_work_reviewed(uuid) TO anon,authenticated;
GRANT INSERT(minor_opportunity,minor_responsible_adult),UPDATE(minor_opportunity,minor_responsible_adult) ON public.work_opportunities TO authenticated;
CREATE FUNCTION filmverse_private.minor_work_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NEW.minor_opportunity AND auth.uid() IS NOT NULL AND NOT (filmverse_private.network_permission('publish_minor_opportunity') OR (TG_OP='UPDATE' AND filmverse_private.network_permission('review_minor_opportunity'))) THEN RAISE EXCEPTION 'minor_publisher_permission_required' USING ERRCODE='42501'; END IF;
 IF NEW.minor_opportunity AND (NEW.project_id IS NULL OR NEW.minor_responsible_adult IS NULL) THEN RAISE EXCEPTION 'minor_project_responsibility_required' USING ERRCODE='23514'; END IF;
 IF NEW.minor_opportunity AND EXISTS(SELECT 1 FROM public.projects WHERE id=NEW.project_id AND student_project) AND NOT filmverse_private.student_project_verified(NEW.project_id) THEN RAISE EXCEPTION 'verified_student_project_required' USING ERRCODE='42501'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER minor_work BEFORE INSERT OR UPDATE ON public.work_opportunities FOR EACH ROW EXECUTE FUNCTION filmverse_private.minor_work_guard();
CREATE POLICY minor_work_unreviewed_hidden ON public.work_opportunities AS RESTRICTIVE FOR SELECT TO anon,authenticated USING(
 NOT minor_opportunity OR ((organization_id IS NULL AND user_id=auth.uid()) OR filmverse_private.org_can(organization_id,'publish_jobs')) OR
 filmverse_private.minor_work_reviewed(id));
ALTER TABLE public.work_applications ADD COLUMN casting_subject_id uuid REFERENCES public.casting_subjects(id),ADD COLUMN submitted_by uuid REFERENCES public.profiles(id);
UPDATE public.work_applications a SET casting_subject_id=s.id,submitted_by=a.user_id FROM public.casting_subjects s WHERE s.adult_user_id=a.user_id;
ALTER TABLE public.work_applications ALTER COLUMN casting_subject_id SET NOT NULL,ALTER COLUMN submitted_by SET NOT NULL;
ALTER TABLE public.work_applications DROP CONSTRAINT work_applications_work_id_user_id_key;
ALTER TABLE public.work_applications ADD UNIQUE(work_id,casting_subject_id);
GRANT INSERT(casting_subject_id) ON public.work_applications TO authenticated;
CREATE FUNCTION filmverse_private.subject_application_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE s public.casting_subjects; w public.work_opportunities;
BEGIN
 IF TG_OP='UPDATE' THEN
 IF (NEW.casting_subject_id,NEW.submitted_by,NEW.user_id,NEW.work_id) IS DISTINCT FROM (OLD.casting_subject_id,OLD.submitted_by,OLD.user_id,OLD.work_id) THEN RAISE EXCEPTION 'immutable_application_identity' USING ERRCODE='42501'; END IF; RETURN NEW;END IF;
 NEW.submitted_by:=NEW.user_id;
 IF NEW.casting_subject_id IS NULL THEN SELECT id INTO NEW.casting_subject_id FROM public.casting_subjects WHERE adult_user_id=NEW.user_id;END IF;
 SELECT * INTO s FROM public.casting_subjects WHERE id=NEW.casting_subject_id;
 IF NOT FOUND OR NOT filmverse_private.subject_manage(s.id) THEN RAISE EXCEPTION 'subject_authority_required' USING ERRCODE='42501';END IF;
 IF s.subject_type='minor' THEN
 SELECT * INTO w FROM public.work_opportunities WHERE id=NEW.work_id;
 IF NOT w.minor_opportunity OR NOT filmverse_private.minor_work_reviewed(w.id) OR NOT EXISTS(
 SELECT 1 FROM public.minor_project_consents c WHERE c.casting_subject_id=s.id AND c.project_id=w.project_id AND c.guardian_user_id=auth.uid() AND c.scope='application' AND c.revoked_at IS NULL AND c.expires_at>now())
 THEN RAISE EXCEPTION 'reviewed_minor_opportunity_and_consent_required' USING ERRCODE='42501'; END IF;
 END IF;RETURN NEW;
END $$;
CREATE TRIGGER subject_application BEFORE INSERT OR UPDATE ON public.work_applications FOR EACH ROW EXECUTE FUNCTION filmverse_private.subject_application_guard();
CREATE OR REPLACE VIEW public.work_opportunities_discovery WITH(security_invoker=true) AS SELECT * FROM public.work_opportunities WHERE visibility='public' AND filmverse_private.org_discoverable(organization_id);

DO $$ DECLARE t text;BEGIN
 FOREACH t IN ARRAY ARRAY['minor_talent_profiles','minor_guardians','casting_subjects','minor_project_consents','minor_work_compliance','minor_media'] LOOP
 EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC,anon,authenticated',t);EXECUTE format('GRANT ALL ON public.%I TO service_role',t);END LOOP;
END $$;
ALTER TABLE filmverse_private.minor_talent_private ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON filmverse_private.minor_talent_private FROM PUBLIC,anon,authenticated;
GRANT ALL ON filmverse_private.minor_talent_private TO service_role;
GRANT SELECT ON public.casting_subjects,public.minor_guardians,public.minor_project_consents,public.minor_media TO authenticated;
GRANT SELECT(id,display_name,city,region,actor_enabled,model_enabled,playing_age_min,playing_age_max,height_cm,hair,eyes,bio,availability,travel,discoverable,updated_at) ON public.minor_talent_profiles TO authenticated;
CREATE POLICY minor_profile_read ON public.minor_talent_profiles FOR SELECT TO authenticated USING(filmverse_private.minor_visible(id));
CREATE POLICY casting_subject_read ON public.casting_subjects FOR SELECT TO authenticated USING(filmverse_private.subject_visible(id));
CREATE POLICY guardian_read ON public.minor_guardians FOR SELECT TO authenticated USING(guardian_user_id=auth.uid() OR filmverse_private.network_permission('review_guardianship'));
CREATE POLICY minor_consent_read ON public.minor_project_consents FOR SELECT TO authenticated USING(guardian_user_id=auth.uid());
CREATE POLICY minor_media_metadata ON public.minor_media FOR SELECT TO authenticated USING(sanitized_at IS NOT NULL AND filmverse_private.minor_visible(minor_talent_id));
GRANT UPDATE(display_name,city,region,actor_enabled,model_enabled,playing_age_min,playing_age_max,height_cm,hair,eyes,bio,availability,travel,discoverable) ON public.minor_talent_profiles TO authenticated;
CREATE POLICY minor_profile_edit ON public.minor_talent_profiles FOR UPDATE TO authenticated USING(filmverse_private.minor_guardian(id)) WITH CHECK(filmverse_private.minor_guardian(id));
GRANT INSERT(casting_subject_id,project_id,scope,terms_version,expires_at),UPDATE(revoked_at) ON public.minor_project_consents TO authenticated;
CREATE POLICY minor_consent_insert ON public.minor_project_consents FOR INSERT TO authenticated WITH CHECK(guardian_user_id=auth.uid() AND EXISTS(SELECT 1 FROM public.casting_subjects s WHERE s.id=casting_subject_id AND s.subject_type='minor' AND filmverse_private.minor_guardian(s.minor_talent_id)));
CREATE POLICY minor_consent_revoke ON public.minor_project_consents FOR UPDATE TO authenticated USING(guardian_user_id=auth.uid()) WITH CHECK(guardian_user_id=auth.uid() AND revoked_at IS NOT NULL);
CREATE FUNCTION filmverse_private.minor_create(p_name text,p_relationship text) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE mid uuid;
BEGIN IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication_required' USING ERRCODE='42501';END IF;
 PERFORM 1 FROM public.profiles WHERE id=auth.uid() FOR UPDATE;
 IF (SELECT count(*) FROM public.minor_guardians WHERE guardian_user_id=auth.uid() AND status<>'revoked')>=10 THEN RAISE EXCEPTION 'guardian_profile_limit' USING ERRCODE='23514';END IF;
 INSERT INTO public.minor_talent_profiles(display_name,created_by) VALUES(p_name,auth.uid()) RETURNING id INTO mid;
 INSERT INTO public.minor_guardians(minor_talent_id,guardian_user_id,relationship,is_primary) VALUES(mid,auth.uid(),p_relationship,true);
 INSERT INTO public.casting_subjects(subject_type,minor_talent_id) VALUES('minor',mid);RETURN mid;
END $$;
CREATE FUNCTION public.minor_create(p_name text,p_relationship text) RETURNS uuid LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT filmverse_private.minor_create(p_name,p_relationship) $$;
CREATE FUNCTION filmverse_private.young_talent_search(p_city text,p_kind text,p_offset int) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NOT filmverse_private.network_permission('search_minor_talent') THEN RAISE EXCEPTION 'reviewed_professional_access_required' USING ERRCODE='42501';END IF;
 RETURN (SELECT coalesce(jsonb_agg(row_to_json(r)),'[]') FROM(
 SELECT s.id AS casting_subject_id,p.id,p.display_name,p.city,p.region,p.actor_enabled,p.model_enabled,p.playing_age_min,p.playing_age_max,p.height_cm,p.hair,p.eyes,p.bio,p.availability,p.travel,p.updated_at
 FROM public.minor_talent_profiles p JOIN public.casting_subjects s ON s.minor_talent_id=p.id
 WHERE p.discoverable AND filmverse_private.minor_visible(p.id) AND (p_city='' OR p.city=p_city)
 AND (p_kind='' OR (p_kind='actor' AND p.actor_enabled) OR (p_kind='model' AND p.model_enabled))
 ORDER BY p.updated_at DESC,p.id LIMIT 24 OFFSET greatest(0,least(p_offset,10000))) r);
END $$;
CREATE FUNCTION public.young_talent_search(p_city text DEFAULT '',p_kind text DEFAULT '',p_offset int DEFAULT 0) RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$ SELECT filmverse_private.young_talent_search(p_city,p_kind,p_offset) $$;
CREATE FUNCTION filmverse_private.minor_contact(p_subject uuid) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE guardian uuid; mid uuid;
BEGIN
 SELECT minor_talent_id INTO mid FROM public.casting_subjects WHERE id=p_subject AND subject_type='minor';
 IF NOT filmverse_private.network_permission('search_minor_talent') OR NOT filmverse_private.minor_visible(mid) THEN RAISE EXCEPTION 'contact_unavailable' USING ERRCODE='42501'; END IF;
 SELECT guardian_user_id INTO guardian FROM public.minor_guardians WHERE minor_talent_id=mid AND status='approved' AND valid_until>now() AND filmverse_private.person_contactable(guardian_user_id,'message') ORDER BY is_primary DESC,id LIMIT 1;
 IF guardian IS NULL THEN RAISE EXCEPTION 'contact_unavailable' USING ERRCODE='42501';END IF;
 RETURN public.get_or_create_direct_chat(guardian);
END $$;
CREATE FUNCTION public.minor_contact(p_subject uuid) RETURNS uuid LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT filmverse_private.minor_contact(p_subject) $$;
DO $$ DECLARE f record;BEGIN
 FOR f IN SELECT p.oid::regprocedure sig FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname IN ('public','filmverse_private') AND p.proname=ANY(ARRAY['network_permission','minor_guardian','minor_visible','subject_manage','subject_visible','casting_subject_bootstrap','minor_work_guard','subject_application_guard','minor_create','young_talent_search','minor_contact']) LOOP
 EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated',f.sig);
 IF f.sig::text NOT LIKE '%bootstrap%' AND f.sig::text NOT LIKE '%guard(%' THEN EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated',f.sig); END IF;
 END LOOP;
END $$;
CREATE FUNCTION filmverse_private.guardianship_review(p_id uuid,p_approve boolean,p_reason text,p_until timestamptz) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE g public.minor_guardians;
BEGIN
 IF NOT filmverse_private.network_permission('review_guardianship') THEN RAISE EXCEPTION 'review_authority_required' USING ERRCODE='42501';END IF;
 SELECT * INTO g FROM public.minor_guardians WHERE id=p_id FOR UPDATE;
 IF NOT FOUND OR g.guardian_user_id=auth.uid() OR filmverse_private.minor_guardian(g.minor_talent_id,true) THEN RAISE EXCEPTION 'independent_review_required' USING ERRCODE='42501';END IF;
 IF p_approve IS NULL OR p_reason IS NULL OR length(btrim(p_reason)) NOT BETWEEN 10 AND 1000 OR (p_approve AND (p_until IS NULL OR p_until<=now() OR p_until>now()+interval '1 year')) THEN RAISE EXCEPTION 'review_reason_and_bounded_expiry_required' USING ERRCODE='22023';END IF;
 UPDATE public.minor_guardians SET status=CASE WHEN p_approve THEN 'approved' ELSE 'revoked' END,reviewed_by=auth.uid(),reviewed_at=now(),decision_reason=btrim(p_reason),valid_until=CASE WHEN p_approve THEN p_until ELSE now() END WHERE id=p_id;
END $$;
CREATE FUNCTION public.guardianship_review(p_id uuid,p_approve boolean,p_reason text,p_until timestamptz) RETURNS void LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT filmverse_private.guardianship_review(p_id,p_approve,p_reason,p_until) $$;
CREATE FUNCTION filmverse_private.minor_opportunity_review(p_id uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE w public.work_opportunities;
BEGIN
 IF NOT filmverse_private.network_permission('review_minor_opportunity') THEN RAISE EXCEPTION 'review_authority_required' USING ERRCODE='42501'; END IF;
 SELECT * INTO w FROM public.work_opportunities WHERE id=p_id FOR UPDATE;
 IF NOT FOUND OR NOT w.minor_opportunity OR w.user_id=auth.uid() OR filmverse_private.project_can(w.project_id) OR filmverse_private.org_can(w.organization_id,'publish_jobs') THEN RAISE EXCEPTION 'independent_review_required' USING ERRCODE='42501';END IF;
 INSERT INTO filmverse_private.minor_opportunity_reviews(work_id,reviewer,content_hash) VALUES(w.id,auth.uid(),encode(sha256(convert_to((to_jsonb(w)-'updated_at')::text,'UTF8')),'hex')) ON CONFLICT(work_id) DO UPDATE SET reviewer=EXCLUDED.reviewer,reviewed_at=now(),content_hash=EXCLUDED.content_hash;
END $$;
CREATE FUNCTION public.minor_opportunity_review(p_id uuid) RETURNS void LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT filmverse_private.minor_opportunity_review(p_id) $$;
REVOKE ALL ON FUNCTION filmverse_private.guardianship_review(uuid,boolean,text,timestamptz),public.guardianship_review(uuid,boolean,text,timestamptz),filmverse_private.minor_opportunity_review(uuid),public.minor_opportunity_review(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION filmverse_private.guardianship_review(uuid,boolean,text,timestamptz),public.guardianship_review(uuid,boolean,text,timestamptz),filmverse_private.minor_opportunity_review(uuid),public.minor_opportunity_review(uuid) TO authenticated;
COMMIT;
