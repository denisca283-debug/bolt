BEGIN;
SET LOCAL lock_timeout='5s';
CREATE TABLE public.professional_graph_policy(id boolean PRIMARY KEY DEFAULT true CHECK(id),freshness_days int NOT NULL CHECK(freshness_days BETWEEN 30 AND 1095));
INSERT INTO public.professional_graph_policy VALUES(true,365);
CREATE TABLE public.organization_professional_relationships(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),organization_id uuid NOT NULL REFERENCES public.organizations(id),user_id uuid NOT NULL REFERENCES public.profiles(id),
 profession_id uuid REFERENCES public.professions(id),custom_role text CHECK(length(custom_role)<=120),
 relationship_type text NOT NULL CHECK(relationship_type IN ('staff','regular_freelancer','preferred_crew','technical_partner','vendor_partner','instructor','mentor','other')),
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','active','declined','ended','expired')),
 initiated_by text NOT NULL CHECK(initiated_by IN ('organization','professional')),
 organization_confirmed_at timestamptz,professional_confirmed_at timestamptz,
 public_on_organization_profile boolean NOT NULL DEFAULT false,public_on_professional_profile boolean NOT NULL DEFAULT false,
 started_at timestamptz,ended_at timestamptz,last_confirmed_at timestamptz,created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(organization_id,user_id,relationship_type),CHECK(status<>'active' OR (organization_confirmed_at IS NOT NULL AND professional_confirmed_at IS NOT NULL))
);
CREATE INDEX graph_person_idx ON public.organization_professional_relationships(user_id,organization_id);
CREATE FUNCTION filmverse_private.relationship_request(p_org uuid,p_person uuid,p_kind text,p_role text) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE result uuid; orgside boolean;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication_required' USING ERRCODE='42501';END IF;
 orgside:=filmverse_private.org_can(p_org,'manage_members');
 IF (auth.uid()<>p_person AND NOT orgside) OR NOT filmverse_private.person_visible(p_person) OR NOT filmverse_private.org_public(p_org) THEN RAISE EXCEPTION 'relationship_unavailable' USING ERRCODE='42501';END IF;
 IF auth.uid()<>p_person AND NOT filmverse_private.person_contactable(p_person,'invite') THEN RAISE EXCEPTION 'relationship_unavailable' USING ERRCODE='42501';END IF;
 INSERT INTO public.organization_professional_relationships(organization_id,user_id,relationship_type,custom_role,initiated_by,organization_confirmed_at,professional_confirmed_at)
 VALUES(p_org,p_person,p_kind,p_role,CASE WHEN auth.uid()=p_person THEN 'professional' ELSE 'organization' END,
 CASE WHEN auth.uid()<>p_person AND orgside THEN now() END,CASE WHEN auth.uid()=p_person THEN now() END)
 ON CONFLICT(organization_id,user_id,relationship_type) DO NOTHING RETURNING id INTO result;
 IF result IS NULL THEN SELECT id INTO result FROM public.organization_professional_relationships WHERE organization_id=p_org AND user_id=p_person AND relationship_type=p_kind;END IF;
 RETURN result;
END $$;
CREATE FUNCTION filmverse_private.relationship_respond(p_id uuid,p_action text,p_public_org boolean DEFAULT false,p_public_person boolean DEFAULT false) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r public.organization_professional_relationships; personside boolean;
BEGIN
 SELECT * INTO r FROM public.organization_professional_relationships WHERE id=p_id FOR UPDATE;
 IF NOT FOUND OR auth.uid() IS NULL OR (r.user_id<>auth.uid() AND NOT filmverse_private.org_can(r.organization_id,'manage_members')) THEN RAISE EXCEPTION 'relationship_unavailable' USING ERRCODE='42501';END IF;
 personside:=r.user_id=auth.uid();
 IF p_action='confirm' THEN
 IF r.status NOT IN ('pending','active') THEN RAISE EXCEPTION 'relationship_closed' USING ERRCODE='23514';END IF;
 IF NOT filmverse_private.person_visible(r.user_id) OR NOT filmverse_private.org_public(r.organization_id) OR (NOT personside AND NOT filmverse_private.person_contactable(r.user_id,'invite')) THEN RAISE EXCEPTION 'relationship_unavailable' USING ERRCODE='42501';END IF;
 IF personside THEN r.professional_confirmed_at:=now();r.public_on_organization_profile:=coalesce(p_public_org,false);r.public_on_professional_profile:=coalesce(p_public_person,false);
 ELSE r.organization_confirmed_at:=now();END IF;
 IF r.professional_confirmed_at IS NOT NULL AND r.organization_confirmed_at IS NOT NULL THEN r.status:='active';r.last_confirmed_at:=least(r.professional_confirmed_at,r.organization_confirmed_at);r.started_at:=coalesce(r.started_at,now());END IF;
 ELSIF p_action IN ('decline','end') THEN r.status:=CASE p_action WHEN 'decline' THEN 'declined' ELSE 'ended' END;r.ended_at:=now();
 ELSE RAISE EXCEPTION 'invalid_action' USING ERRCODE='22023';END IF;
 UPDATE public.organization_professional_relationships SET status=r.status,organization_confirmed_at=r.organization_confirmed_at,professional_confirmed_at=r.professional_confirmed_at,
 public_on_organization_profile=r.public_on_organization_profile,public_on_professional_profile=r.public_on_professional_profile,started_at=r.started_at,ended_at=r.ended_at,last_confirmed_at=r.last_confirmed_at,updated_at=now() WHERE id=p_id;
END $$;
CREATE FUNCTION filmverse_private.professional_graph(p_org uuid,p_person uuid) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',r.id,'organization_id',o.id,'organization_name',o.name,'organization_slug',o.slug,'user_id',p.id,'full_name',p.full_name,'avatar_url',p.avatar_url,'public_slug',p.public_slug,'city',p.city,'role',r.custom_role,'relationship_type',r.relationship_type,'last_confirmed_at',r.last_confirmed_at,'stale',r.last_confirmed_at<now()-make_interval(days=>policy.freshness_days))),'[]')
 FROM public.organization_professional_relationships r JOIN public.organizations o ON o.id=r.organization_id JOIN public.profiles p ON p.id=r.user_id CROSS JOIN public.professional_graph_policy policy
 WHERE r.status='active' AND r.organization_confirmed_at IS NOT NULL AND r.professional_confirmed_at IS NOT NULL
 AND ((p_org IS NOT NULL AND r.organization_id=p_org AND r.public_on_organization_profile) OR (p_person IS NOT NULL AND r.user_id=p_person AND r.public_on_professional_profile))
 AND filmverse_private.org_public(o.id) AND filmverse_private.person_visible(p.id) AND filmverse_private.support_not_blocked(p.id)
$$;
CREATE TABLE public.education_programs(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),organization_id uuid NOT NULL REFERENCES public.organizations(id),created_by uuid NOT NULL DEFAULT auth.uid() REFERENCES public.profiles(id),
 title text NOT NULL CHECK(length(btrim(title)) BETWEEN 2 AND 180),program_type text NOT NULL CHECK(program_type IN ('course','degree','intensive','masterclass','workshop','lab','webinar','lecture','certification','other')),
 category text NOT NULL DEFAULT '' CHECK(length(category)<=100),description text NOT NULL DEFAULT '' CHECK(length(description)<=10000),
 format text NOT NULL CHECK(format IN ('offline','online','hybrid')),city text,duration_text text,level text,
 price_amount numeric(12,2) CHECK(price_amount>=0),currency text CHECK(currency ~ '^[A-Z]{3}$'),price_type text NOT NULL CHECK(price_type IN ('free','paid','contact')),
 registration_url text CHECK(length(registration_url)<=2000 AND registration_url ~ '^https://[^/[:space:]]+'),
 status text NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','published','archived')),visibility text NOT NULL DEFAULT 'public' CHECK(visibility IN ('public','members','private')),
 created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),
 CHECK(price_type<>'paid' OR (price_amount IS NOT NULL AND currency IS NOT NULL))
);
CREATE INDEX education_discovery_idx ON public.education_programs(status,city,format);
CREATE TABLE public.education_program_instructors(
 program_id uuid NOT NULL REFERENCES public.education_programs(id),user_id uuid NOT NULL REFERENCES public.profiles(id),role_title text NOT NULL CHECK(length(role_title)<=120),sort_order int NOT NULL DEFAULT 0,
 PRIMARY KEY(program_id,user_id)
);
CREATE TABLE public.industry_events(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),organizer_type text NOT NULL CHECK(organizer_type IN ('organization','user')),organization_id uuid REFERENCES public.organizations(id),user_id uuid REFERENCES public.profiles(id),created_by uuid NOT NULL DEFAULT auth.uid() REFERENCES public.profiles(id),
 title text NOT NULL CHECK(length(btrim(title)) BETWEEN 2 AND 180),event_type text NOT NULL CHECK(event_type IN ('masterclass','workshop','lecture','webinar','screening','premiere','festival','networking','open_day','pitching','conference','expo','competition','meetup','other')),
 category text NOT NULL DEFAULT '' CHECK(length(category)<=100),description text NOT NULL DEFAULT '' CHECK(length(description)<=10000),
 format text NOT NULL CHECK(format IN ('offline','online','hybrid')),city text,venue_public_text text,starts_at timestamptz NOT NULL,ends_at timestamptz NOT NULL,timezone text NOT NULL DEFAULT 'UTC',
 price_type text NOT NULL CHECK(price_type IN ('free','paid','contact')),price_amount numeric(12,2) CHECK(price_amount>=0),currency text CHECK(currency ~ '^[A-Z]{3}$'),
 registration_url text CHECK(length(registration_url)<=2000 AND registration_url ~ '^https://[^/[:space:]]+'),capacity int CHECK(capacity>0),
 status text NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','published','cancelled','ended')),visibility text NOT NULL DEFAULT 'public' CHECK(visibility IN ('public','members','private')),
 moderation_status text NOT NULL DEFAULT 'visible' CHECK(moderation_status IN ('visible','hidden')),
 created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),
 CHECK(ends_at>starts_at),CHECK(price_type<>'paid' OR (price_amount IS NOT NULL AND currency IS NOT NULL)),
 CHECK((organizer_type='organization' AND organization_id IS NOT NULL AND user_id IS NULL) OR (organizer_type='user' AND user_id IS NOT NULL AND organization_id IS NULL))
);
CREATE INDEX industry_event_discovery_idx ON public.industry_events(status,starts_at,city);
CREATE FUNCTION filmverse_private.education_manage(p_org uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT filmverse_private.org_can(p_org,'manage_organization') AND EXISTS(SELECT 1 FROM public.organizations WHERE id=p_org AND organization_type='education')
$$;
DO $$ DECLARE t text;BEGIN
 FOREACH t IN ARRAY ARRAY['professional_graph_policy','organization_professional_relationships','education_programs','education_program_instructors','industry_events'] LOOP
 EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC,anon,authenticated',t);EXECUTE format('GRANT ALL ON public.%I TO service_role',t);END LOOP;
END $$;
GRANT SELECT ON public.organization_professional_relationships TO authenticated;
CREATE POLICY relation_participants ON public.organization_professional_relationships FOR SELECT TO authenticated USING(user_id=auth.uid() OR filmverse_private.org_can(organization_id,'manage_members'));
GRANT SELECT ON public.education_programs,public.education_program_instructors,public.industry_events TO anon,authenticated;
GRANT INSERT(organization_id,title,program_type,category,description,format,city,duration_text,level,price_amount,currency,price_type,registration_url,status,visibility),UPDATE(title,program_type,category,description,format,city,duration_text,level,price_amount,currency,price_type,registration_url,status,visibility) ON public.education_programs TO authenticated;
CREATE POLICY program_read ON public.education_programs FOR SELECT TO anon,authenticated USING(filmverse_private.education_manage(organization_id) OR (status='published' AND filmverse_private.org_public(organization_id) AND (visibility='public' OR (visibility='members' AND auth.uid() IS NOT NULL))));
CREATE POLICY program_create ON public.education_programs FOR INSERT TO authenticated WITH CHECK(created_by=auth.uid() AND filmverse_private.education_manage(organization_id));
CREATE POLICY program_edit ON public.education_programs FOR UPDATE TO authenticated USING(filmverse_private.education_manage(organization_id)) WITH CHECK(filmverse_private.education_manage(organization_id));
-- Instructors are published only after the individual has confirmed the school relationship.
GRANT INSERT,UPDATE(role_title,sort_order),DELETE ON public.education_program_instructors TO authenticated;
CREATE FUNCTION filmverse_private.instructor_visible(p_program uuid,p_user uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT filmverse_private.person_visible(p_user) AND EXISTS(SELECT 1 FROM public.education_programs p JOIN public.organization_professional_relationships r ON r.organization_id=p.organization_id AND r.user_id=p_user WHERE p.id=p_program AND r.status='active' AND r.public_on_organization_profile AND r.professional_confirmed_at IS NOT NULL AND r.organization_confirmed_at IS NOT NULL)
$$;
REVOKE ALL ON FUNCTION filmverse_private.instructor_visible(uuid,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION filmverse_private.instructor_visible(uuid,uuid) TO anon,authenticated;
CREATE POLICY instructors_read ON public.education_program_instructors FOR SELECT TO anon,authenticated USING(EXISTS(SELECT 1 FROM public.education_programs p WHERE p.id=program_id) AND filmverse_private.instructor_visible(program_id,user_id));
CREATE POLICY instructors_create ON public.education_program_instructors FOR INSERT TO authenticated WITH CHECK(EXISTS(SELECT 1 FROM public.education_programs p JOIN public.organization_professional_relationships r ON r.organization_id=p.organization_id AND r.user_id=education_program_instructors.user_id AND r.status='active' AND r.public_on_organization_profile WHERE p.id=program_id AND filmverse_private.education_manage(p.organization_id)));
CREATE POLICY instructors_edit ON public.education_program_instructors FOR UPDATE TO authenticated USING(EXISTS(SELECT 1 FROM public.education_programs p WHERE p.id=program_id AND filmverse_private.education_manage(p.organization_id))) WITH CHECK(EXISTS(SELECT 1 FROM public.education_programs p WHERE p.id=program_id AND filmverse_private.education_manage(p.organization_id)));
CREATE POLICY instructors_delete ON public.education_program_instructors FOR DELETE TO authenticated USING(EXISTS(SELECT 1 FROM public.education_programs p WHERE p.id=program_id AND filmverse_private.education_manage(p.organization_id)));
GRANT INSERT(organizer_type,organization_id,user_id,title,event_type,category,description,format,city,venue_public_text,starts_at,ends_at,timezone,price_type,price_amount,currency,registration_url,capacity,status,visibility),UPDATE(title,event_type,category,description,format,city,venue_public_text,starts_at,ends_at,timezone,price_type,price_amount,currency,registration_url,capacity,status,visibility) ON public.industry_events TO authenticated;
CREATE POLICY event_read ON public.industry_events FOR SELECT TO anon,authenticated USING((organizer_type='user' AND user_id=auth.uid()) OR filmverse_private.org_can(organization_id,'manage_organization') OR (status IN ('published','cancelled','ended') AND moderation_status='visible' AND (visibility='public' OR (visibility='members' AND auth.uid() IS NOT NULL)) AND (organizer_type='user' OR filmverse_private.org_public(organization_id))));
CREATE POLICY event_create ON public.industry_events FOR INSERT TO authenticated WITH CHECK(created_by=auth.uid() AND ((organizer_type='user' AND user_id=auth.uid()) OR filmverse_private.org_can(organization_id,'manage_organization')));
CREATE POLICY event_edit ON public.industry_events FOR UPDATE TO authenticated USING((organizer_type='user' AND user_id=auth.uid()) OR filmverse_private.org_can(organization_id,'manage_organization')) WITH CHECK((organizer_type='user' AND user_id=auth.uid()) OR filmverse_private.org_can(organization_id,'manage_organization'));
CREATE FUNCTION public.relationship_request(p_org uuid,p_person uuid,p_kind text,p_role text) RETURNS uuid LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT filmverse_private.relationship_request(p_org,p_person,p_kind,p_role) $$;
CREATE FUNCTION public.relationship_respond(p_id uuid,p_action text,p_public_org boolean DEFAULT false,p_public_person boolean DEFAULT false) RETURNS void LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT filmverse_private.relationship_respond(p_id,p_action,p_public_org,p_public_person) $$;
CREATE FUNCTION public.professional_graph(p_org uuid DEFAULT NULL,p_person uuid DEFAULT NULL) RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$ SELECT filmverse_private.professional_graph(p_org,p_person) $$;
DO $$ DECLARE f record;BEGIN
 FOR f IN SELECT p.oid::regprocedure sig,p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname IN ('public','filmverse_private') AND p.proname=ANY(ARRAY['relationship_request','relationship_respond','professional_graph','education_manage']) LOOP
 EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated',f.sig);EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated',f.sig);
 IF f.proname IN ('professional_graph','education_manage') THEN EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO anon',f.sig);END IF; END LOOP;
END $$;
COMMIT;
