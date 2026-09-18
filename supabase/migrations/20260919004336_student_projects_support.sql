BEGIN;
SET LOCAL lock_timeout='5s';
ALTER TABLE public.projects ADD COLUMN student_project boolean NOT NULL DEFAULT false,
 ADD COLUMN education_affiliation_id uuid REFERENCES public.education_affiliations(id) ON DELETE SET NULL,
 ADD COLUMN thesis_project boolean NOT NULL DEFAULT false,
 ADD COLUMN shoot_start date,ADD COLUMN shoot_end date,
 ADD CONSTRAINT student_project_dates CHECK(shoot_end IS NULL OR shoot_start IS NULL OR shoot_end>=shoot_start);
GRANT INSERT(student_project,education_affiliation_id,thesis_project,shoot_start,shoot_end),UPDATE(student_project,education_affiliation_id,thesis_project,shoot_start,shoot_end) ON public.projects TO authenticated;
CREATE INDEX student_projects_discovery_idx ON public.projects(city,created_at DESC) WHERE student_project AND visibility='public';
ALTER TABLE public.work_opportunities ADD COLUMN project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL;
GRANT INSERT(project_id),UPDATE(project_id) ON public.work_opportunities TO authenticated;
CREATE INDEX work_project_idx ON public.work_opportunities(project_id);
CREATE FUNCTION filmverse_private.work_project_guard() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF TG_OP='UPDATE' AND NEW.project_id IS NOT DISTINCT FROM OLD.project_id THEN RETURN NEW; END IF;
 IF NEW.project_id IS NOT NULL AND NOT filmverse_private.project_can(NEW.project_id) THEN RAISE EXCEPTION 'project_authority_required' USING ERRCODE='42501'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER work_project_authority BEFORE INSERT OR UPDATE ON public.work_opportunities FOR EACH ROW EXECUTE FUNCTION filmverse_private.work_project_guard();
REVOKE ALL ON FUNCTION filmverse_private.work_project_guard() FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE VIEW public.work_opportunities_discovery WITH(security_invoker=true) AS SELECT * FROM public.work_opportunities WHERE visibility='public' AND filmverse_private.org_discoverable(organization_id);
CREATE FUNCTION filmverse_private.student_project_guard() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF TG_OP='UPDATE' AND NEW.education_affiliation_id IS NOT DISTINCT FROM OLD.education_affiliation_id THEN RETURN NEW; END IF;
 IF NEW.education_affiliation_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.education_affiliations WHERE id=NEW.education_affiliation_id AND user_id=auth.uid())
 THEN RAISE EXCEPTION 'affiliation_owner_required' USING ERRCODE='42501'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER student_project_affiliation BEFORE INSERT OR UPDATE ON public.projects FOR EACH ROW EXECUTE FUNCTION filmverse_private.student_project_guard();
CREATE FUNCTION filmverse_private.student_project_verified(p_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM public.projects p WHERE p.id=p_id AND p.student_project AND filmverse_private.student_current(p.education_affiliation_id))
$$;
CREATE FUNCTION filmverse_private.student_project_badge(p_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM public.projects p WHERE p.id=p_id AND (
 (p.visibility IN ('public','unlisted') AND (p.organization_id IS NULL OR filmverse_private.org_public(p.organization_id)))
 OR filmverse_private.project_can(p.id)) AND filmverse_private.student_project_verified(p.id))
$$;
CREATE FUNCTION public.student_project_badge(p_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$ SELECT filmverse_private.student_project_badge(p_id) $$;
-- Limits are server policy, not verification or a hardcoded subscription price.
CREATE TABLE public.student_program_policy(
 key text PRIMARY KEY,max_open_requests integer NOT NULL CHECK(max_open_requests BETWEEN 0 AND 100),
 daily_requests integer NOT NULL CHECK(daily_requests BETWEEN 0 AND 50),enabled boolean NOT NULL DEFAULT false
);
INSERT INTO public.student_program_policy VALUES('support_requests',20,5,true);
CREATE TABLE public.project_support_requests(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
 created_by uuid NOT NULL REFERENCES public.profiles(id),
 need_type text NOT NULL CHECK(need_type IN ('person','company','equipment','location','transport','postproduction','mentorship','service','other')),
 department_id uuid REFERENCES public.departments(id),profession_id uuid REFERENCES public.professions(id),
 organization_type text REFERENCES public.organization_types(key),inventory_category text CHECK(length(inventory_category)<=100),
 title text NOT NULL CHECK(length(btrim(title)) BETWEEN 2 AND 160),description text NOT NULL CHECK(length(description)<=5000),
 quantity integer NOT NULL DEFAULT 1 CHECK(quantity BETWEEN 1 AND 100),city text NOT NULL CHECK(length(btrim(city)) BETWEEN 1 AND 100),
 start_date date NOT NULL,end_date date NOT NULL CHECK(end_date>=start_date),
 compensation_type text NOT NULL CHECK(compensation_type IN ('paid','expenses_only','unpaid_educational','tfp','in_kind','discount_requested','other')),
 expenses_covered text NOT NULL CHECK(length(btrim(expenses_covered)) BETWEEN 1 AND 1000),
 usage_rights text NOT NULL CHECK(length(btrim(usage_rights)) BETWEEN 1 AND 2000),deliverables text NOT NULL CHECK(length(btrim(deliverables)) BETWEEN 1 AND 2000),
 credit_offered boolean NOT NULL DEFAULT false,
 mentorship_topic text CHECK(length(mentorship_topic)<=200),duration_minutes integer CHECK(duration_minutes BETWEEN 1 AND 1440),remote boolean NOT NULL DEFAULT false,
 status text NOT NULL DEFAULT 'open' CHECK(status IN ('open','closed','cancelled')),
 visibility text NOT NULL DEFAULT 'private' CHECK(visibility IN ('public','members','private')),
 moderation_status text NOT NULL DEFAULT 'visible' CHECK(moderation_status IN ('visible','hidden')),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX support_search_idx ON public.project_support_requests(need_type,city,start_date) WHERE status='open' AND visibility='public' AND moderation_status='visible';
CREATE INDEX support_project_idx ON public.project_support_requests(project_id,created_at DESC);
CREATE INDEX support_author_limits_idx ON public.project_support_requests(created_by,created_at DESC);
CREATE TABLE public.student_support_preferences(
 user_id uuid PRIMARY KEY DEFAULT auth.uid() REFERENCES public.profiles(id) ON DELETE CASCADE,
 enabled boolean NOT NULL DEFAULT false,
 support_types text[] NOT NULL DEFAULT '{}' CHECK(support_types <@ ARRAY['mentorship','crew','tfp','equipment','remote_consultation','other']::text[] AND cardinality(support_types)<=6),
 cities text[] NOT NULL DEFAULT '{}' CHECK(cardinality(cities)<=20 AND octet_length(cities::text)<=2000),
 description text NOT NULL DEFAULT '' CHECK(length(description)<=2000),terms text NOT NULL DEFAULT '' CHECK(length(terms)<=2000)
);
CREATE TABLE public.organization_student_support(
 organization_id uuid PRIMARY KEY REFERENCES public.organizations(id) ON DELETE CASCADE,
 enabled boolean NOT NULL DEFAULT false,
 support_types text[] NOT NULL DEFAULT '{}' CHECK(support_types <@ ARRAY['rental_discount','equipment','location','postproduction','transport','props','costume','makeup','studio','mentorship','production_service','casting','other']::text[] AND cardinality(support_types)<=13),
 cities text[] NOT NULL DEFAULT '{}' CHECK(cardinality(cities)<=20 AND octet_length(cities::text)<=2000),
 description text NOT NULL DEFAULT '' CHECK(length(description)<=2000),terms text NOT NULL DEFAULT '' CHECK(length(terms)<=2000),
 request_method text NOT NULL DEFAULT 'website' CHECK(request_method IN ('website','profile')),updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX org_support_enabled_idx ON public.organization_student_support(organization_id) WHERE enabled;
CREATE INDEX support_people_types_idx ON public.student_support_preferences USING gin(support_types) WHERE enabled;
CREATE INDEX support_org_types_idx ON public.organization_student_support USING gin(support_types) WHERE enabled;
-- Shared, owner-controlled block edge: support discovery respects both directions.
CREATE TABLE public.user_blocks(
 user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES public.profiles(id) ON DELETE CASCADE,
 blocked_user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
 created_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(user_id,blocked_user_id),CHECK(user_id<>blocked_user_id)
);
CREATE INDEX blocks_target_idx ON public.user_blocks(blocked_user_id,user_id);
CREATE FUNCTION filmverse_private.support_not_blocked(p_user uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT NOT EXISTS(SELECT 1 FROM public.user_blocks WHERE (user_id=auth.uid() AND blocked_user_id=p_user) OR (user_id=p_user AND blocked_user_id=auth.uid()))
$$;
CREATE FUNCTION filmverse_private.support_request_read(p_project uuid,p_visibility text,p_author uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT filmverse_private.project_can(p_project) OR (filmverse_private.support_not_blocked(p_author) AND EXISTS(
 SELECT 1 FROM public.projects p WHERE p.id=p_project AND p.visibility='public' AND filmverse_private.org_discoverable(p.organization_id))
 AND (p_visibility='public' OR (p_visibility='members' AND auth.uid() IS NOT NULL)))
$$;
CREATE TABLE public.support_reports(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES public.profiles(id),
 request_id uuid NOT NULL REFERENCES public.project_support_requests(id) ON DELETE CASCADE,
 reason text NOT NULL CHECK(length(btrim(reason)) BETWEEN 10 AND 2000),created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(user_id,request_id)
);
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['student_program_policy','project_support_requests','student_support_preferences','organization_student_support','user_blocks','support_reports'] LOOP
 EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC,anon,authenticated',t);
 EXECUTE format('GRANT ALL ON public.%I TO service_role',t);END LOOP;
END $$;
GRANT SELECT ON public.project_support_requests,public.student_support_preferences,public.organization_student_support TO anon,authenticated;
GRANT SELECT ON public.user_blocks,public.support_reports TO authenticated;
GRANT INSERT(blocked_user_id),DELETE ON public.user_blocks TO authenticated;
CREATE POLICY blocks_owner ON public.user_blocks FOR ALL TO authenticated USING(user_id=auth.uid()) WITH CHECK(user_id=auth.uid());
GRANT INSERT(request_id,reason) ON public.support_reports TO authenticated;
CREATE POLICY report_owner_read ON public.support_reports FOR SELECT TO authenticated USING(user_id=auth.uid());
CREATE POLICY report_submit ON public.support_reports FOR INSERT TO authenticated WITH CHECK(user_id=auth.uid() AND EXISTS(SELECT 1 FROM public.project_support_requests WHERE id=request_id));
GRANT INSERT(user_id,enabled,support_types,cities,description,terms),UPDATE(enabled,support_types,cities,description,terms) ON public.student_support_preferences TO authenticated;
CREATE POLICY help_person_read ON public.student_support_preferences FOR SELECT TO anon,authenticated USING(user_id=auth.uid() OR (enabled AND filmverse_private.person_discoverable(user_id) AND filmverse_private.support_not_blocked(user_id)));
CREATE POLICY help_person_write ON public.student_support_preferences FOR ALL TO authenticated USING(user_id=auth.uid()) WITH CHECK(user_id=auth.uid());
GRANT INSERT(organization_id,enabled,support_types,cities,description,terms,request_method),UPDATE(enabled,support_types,cities,description,terms,request_method) ON public.organization_student_support TO authenticated;
CREATE POLICY help_org_read ON public.organization_student_support FOR SELECT TO anon,authenticated USING(filmverse_private.org_can(organization_id,'manage_organization') OR (enabled AND filmverse_private.org_public(organization_id)));
CREATE POLICY help_org_write ON public.organization_student_support FOR ALL TO authenticated USING(filmverse_private.org_can(organization_id,'manage_organization')) WITH CHECK(filmverse_private.org_can(organization_id,'manage_organization'));
CREATE POLICY request_read ON public.project_support_requests FOR SELECT TO anon,authenticated USING(
 filmverse_private.project_can(project_id) OR (status='open' AND moderation_status='visible' AND filmverse_private.support_request_read(project_id,visibility,created_by)));
GRANT UPDATE(status) ON public.project_support_requests TO authenticated;
CREATE POLICY request_close ON public.project_support_requests FOR UPDATE TO authenticated USING(filmverse_private.project_can(project_id)) WITH CHECK(filmverse_private.project_can(project_id) AND status IN ('closed','cancelled'));

CREATE FUNCTION filmverse_private.support_request_create(p_project uuid,p_data jsonb) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE cfg public.student_program_policy; result uuid;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication_required' USING ERRCODE='42501'; END IF;
 PERFORM 1 FROM public.profiles WHERE id=auth.uid() FOR UPDATE;
 PERFORM 1 FROM public.projects WHERE id=p_project FOR UPDATE;
 IF NOT filmverse_private.project_can(p_project) OR NOT filmverse_private.student_project_verified(p_project)
 THEN RAISE EXCEPTION 'verified_student_project_authority_required' USING ERRCODE='42501'; END IF;
 SELECT * INTO cfg FROM public.student_program_policy WHERE key='support_requests';
 IF NOT FOUND OR NOT cfg.enabled OR (SELECT count(*) FROM public.project_support_requests WHERE created_by=auth.uid() AND status='open')>=cfg.max_open_requests
 OR (SELECT count(*) FROM public.project_support_requests WHERE created_by=auth.uid() AND created_at>now()-interval '1 day')>=cfg.daily_requests
 THEN RAISE EXCEPTION 'support_request_limit' USING ERRCODE='23514'; END IF;
 INSERT INTO public.project_support_requests(project_id,created_by,need_type,department_id,profession_id,organization_type,inventory_category,title,description,quantity,city,start_date,end_date,compensation_type,expenses_covered,usage_rights,deliverables,credit_offered,visibility,mentorship_topic,duration_minutes,remote)
 VALUES(p_project,auth.uid(),p_data->>'need_type',nullif(p_data->>'department_id','')::uuid,nullif(p_data->>'profession_id','')::uuid,nullif(p_data->>'organization_type',''),nullif(p_data->>'inventory_category',''),p_data->>'title',coalesce(p_data->>'description',''),coalesce((p_data->>'quantity')::int,1),p_data->>'city',(p_data->>'start_date')::date,(p_data->>'end_date')::date,p_data->>'compensation_type',p_data->>'expenses_covered',p_data->>'usage_rights',p_data->>'deliverables',coalesce((p_data->>'credit_offered')::boolean,false),coalesce(p_data->>'visibility','private'),p_data->>'mentorship_topic',nullif(p_data->>'duration_minutes','')::int,coalesce((p_data->>'remote')::boolean,false)) RETURNING id INTO result;
 RETURN result;
END $$;
CREATE FUNCTION public.support_request_create(p_project uuid,p_data jsonb) RETURNS uuid LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT filmverse_private.support_request_create(p_project,p_data) $$;
CREATE FUNCTION filmverse_private.support_search(p_kind text,p_city text,p_type text,p_offset int) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT coalesce(jsonb_agg(row_to_json(r)),'[]') FROM (
 SELECT p.id,p.full_name AS name,p.public_slug AS slug,'person' AS kind,s.support_types,s.cities,s.description,s.terms,NULL::text AS website
 FROM public.student_support_preferences s JOIN public.profiles p ON p.id=s.user_id
 WHERE p_kind='person' AND s.enabled AND filmverse_private.person_discoverable(p.id) AND filmverse_private.support_not_blocked(p.id)
 AND (p_city='' OR p_city=ANY(s.cities)) AND (p_type='' OR p_type=ANY(s.support_types))
 UNION ALL
 SELECT o.id,o.name,o.slug,'company',s.support_types,s.cities,s.description,s.terms,o.website
 FROM public.organization_student_support s JOIN public.organizations o ON o.id=s.organization_id
 WHERE p_kind='company' AND s.enabled AND o.visibility='public'
 AND (p_city='' OR p_city=ANY(s.cities)) AND (p_type='' OR p_type=ANY(s.support_types))
 ORDER BY name,id LIMIT 24 OFFSET greatest(0,least(p_offset,10000))) r
$$;
CREATE FUNCTION public.support_search(p_kind text DEFAULT 'person',p_city text DEFAULT '',p_type text DEFAULT '',p_offset int DEFAULT 0) RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$ SELECT filmverse_private.support_search(p_kind,p_city,p_type,p_offset) $$;
CREATE FUNCTION filmverse_private.student_project_search(p_filters jsonb,p_offset int) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT coalesce(jsonb_agg(row_to_json(r)),'[]') FROM (
 SELECT p.id,p.title,p.city,p.genre,p.stage,p.logline,p.shoot_start,p.shoot_end,p.thesis_project,
 filmverse_private.student_project_verified(p.id) AS verified_student_project
 FROM public.projects p WHERE p.student_project AND p.visibility='public' AND filmverse_private.org_discoverable(p.organization_id)
 AND (coalesce(p_filters->>'city','')='' OR p.city ILIKE '%'||left(p_filters->>'city',100)||'%')
 AND (coalesce(p_filters->>'genre','')='' OR p.genre=p_filters->>'genre')
 AND (coalesce(p_filters->>'verified','false')<>'true' OR filmverse_private.student_project_verified(p.id))
 AND (nullif(p_filters->>'from','') IS NULL OR p.shoot_end>=(p_filters->>'from')::date)
 AND (coalesce(p_filters->>'school','')='' OR EXISTS(SELECT 1 FROM public.education_affiliations a WHERE a.id=p.education_affiliation_id AND filmverse_private.contact_visible(a.user_id,a.visibility) AND a.institution_name ILIKE '%'||left(p_filters->>'school',100)||'%'))

 AND (coalesce(p_filters->>'need','')='' AND coalesce(p_filters->>'compensation','')='' AND coalesce(p_filters->>'department','')='' OR EXISTS(
 SELECT 1 FROM public.project_support_requests n LEFT JOIN public.departments d ON d.id=n.department_id
 WHERE n.project_id=p.id AND n.status='open' AND n.moderation_status='visible'
 AND filmverse_private.support_request_read(n.project_id,n.visibility,n.created_by)
 AND (coalesce(p_filters->>'need','')='' OR n.need_type=p_filters->>'need')
 AND (coalesce(p_filters->>'compensation','')='' OR n.compensation_type=p_filters->>'compensation')
 AND (coalesce(p_filters->>'department','')='' OR d.name ILIKE '%'||left(p_filters->>'department',100)||'%')))
 AND (coalesce(p_filters->>'cast','false')<>'true' OR EXISTS(
 SELECT 1 FROM public.work_opportunities w WHERE w.project_id=p.id AND w.visibility='public' AND w.hiring_active
 AND filmverse_private.org_discoverable(w.organization_id) AND w.target_kinds && ARRAY['actors','models']::text[]))
 ORDER BY p.created_at DESC,p.id LIMIT 24 OFFSET greatest(0,least(p_offset,10000))) r
$$;
CREATE FUNCTION public.student_project_search(p_filters jsonb DEFAULT '{}',p_offset int DEFAULT 0) RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$ SELECT filmverse_private.student_project_search(p_filters,p_offset) $$;

REVOKE ALL ON FUNCTION filmverse_private.student_project_guard(),filmverse_private.student_project_verified(uuid),filmverse_private.student_project_badge(uuid),public.student_project_badge(uuid),filmverse_private.student_project_search(jsonb,int),public.student_project_search(jsonb,int),filmverse_private.support_not_blocked(uuid),filmverse_private.support_request_read(uuid,text,uuid),filmverse_private.support_request_create(uuid,jsonb),public.support_request_create(uuid,jsonb),filmverse_private.support_search(text,text,text,int),public.support_search(text,text,text,int) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION filmverse_private.student_project_badge(uuid),public.student_project_badge(uuid),filmverse_private.student_project_search(jsonb,int),public.student_project_search(jsonb,int),filmverse_private.support_not_blocked(uuid),filmverse_private.support_request_read(uuid,text,uuid),filmverse_private.support_search(text,text,text,int),public.support_search(text,text,text,int) TO anon,authenticated;
-- project_can is also used by public request RLS; it still validates auth.uid().
GRANT EXECUTE ON FUNCTION filmverse_private.project_can(uuid) TO anon;
GRANT EXECUTE ON FUNCTION filmverse_private.support_request_create(uuid,jsonb),public.support_request_create(uuid,jsonb) TO authenticated;
COMMIT;
