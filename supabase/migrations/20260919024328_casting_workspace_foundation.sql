BEGIN;
SET LOCAL lock_timeout='5s';
CREATE TABLE public.casting_roles(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),project_id uuid NOT NULL REFERENCES public.projects(id),
 title text NOT NULL CHECK(length(btrim(title)) BETWEEN 2 AND 160),description text NOT NULL DEFAULT '' CHECK(length(description)<=5000),
 status text NOT NULL DEFAULT 'open' CHECK(status IN ('open','closed','archived')),created_by uuid NOT NULL DEFAULT auth.uid() REFERENCES public.profiles(id),created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.role_candidates(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),role_id uuid NOT NULL REFERENCES public.casting_roles(id),
 casting_subject_id uuid NOT NULL REFERENCES public.casting_subjects(id),application_id uuid REFERENCES public.work_applications(id),
 source text NOT NULL CHECK(source IN ('application','invitation','search')),
 status text NOT NULL DEFAULT 'new' CHECK(status IN ('new','review','shortlist','audition','hold','approved','backup','rejected')),
 project_tags text[] NOT NULL DEFAULT '{}' CHECK(cardinality(project_tags)<=20 AND octet_length(project_tags::text)<=2000),
 created_by uuid NOT NULL DEFAULT auth.uid() REFERENCES public.profiles(id),created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(role_id,casting_subject_id),
 CHECK((source='application')=(application_id IS NOT NULL))
);
CREATE INDEX casting_roles_project_idx ON public.casting_roles(project_id,id);
CREATE INDEX candidates_subject_idx ON public.role_candidates(casting_subject_id);
CREATE FUNCTION filmverse_private.casting_can(p_role uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM public.casting_roles WHERE id=p_role AND filmverse_private.project_can(project_id))
$$;
CREATE FUNCTION filmverse_private.candidate_can(p_candidate uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM public.role_candidates WHERE id=p_candidate AND filmverse_private.casting_can(role_id))
$$;
CREATE FUNCTION filmverse_private.candidate_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE project uuid; mid uuid;
BEGIN
 SELECT project_id INTO project FROM public.casting_roles WHERE id=NEW.role_id;
 IF NOT filmverse_private.casting_can(NEW.role_id) OR NOT filmverse_private.subject_visible(NEW.casting_subject_id) THEN RAISE EXCEPTION 'candidate_unavailable' USING ERRCODE='42501';END IF;
 SELECT minor_talent_id INTO mid FROM public.casting_subjects WHERE id=NEW.casting_subject_id;
 IF mid IS NOT NULL AND (NOT filmverse_private.network_permission('search_minor_talent') OR NOT EXISTS(
 SELECT 1 FROM public.minor_project_consents c JOIN public.minor_guardians g ON g.minor_talent_id=mid AND g.guardian_user_id=c.guardian_user_id
 WHERE c.casting_subject_id=NEW.casting_subject_id AND c.project_id=project AND c.scope='application' AND c.revoked_at IS NULL AND c.expires_at>now() AND g.status='approved' AND g.valid_until>now()))
 THEN RAISE EXCEPTION 'minor_project_consent_required' USING ERRCODE='42501';END IF;
 IF NEW.source='application' AND NOT EXISTS(SELECT 1 FROM public.work_applications a JOIN public.work_opportunities w ON w.id=a.work_id WHERE a.id=NEW.application_id AND a.casting_subject_id=NEW.casting_subject_id AND a.status='applied' AND w.project_id=project) THEN RAISE EXCEPTION 'application_context_mismatch' USING ERRCODE='23514';END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER candidate_insert BEFORE INSERT ON public.role_candidates FOR EACH ROW EXECUTE FUNCTION filmverse_private.candidate_guard();
CREATE TABLE public.casting_reviewer_notes(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),candidate_id uuid NOT NULL REFERENCES public.role_candidates(id),reviewer_id uuid NOT NULL DEFAULT auth.uid() REFERENCES public.profiles(id),
 body text NOT NULL CHECK(length(btrim(body)) BETWEEN 1 AND 5000),created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.casting_comments(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),candidate_id uuid NOT NULL REFERENCES public.role_candidates(id),author_id uuid NOT NULL DEFAULT auth.uid() REFERENCES public.profiles(id),
 body text NOT NULL CHECK(length(btrim(body)) BETWEEN 1 AND 5000),created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.auditions(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),role_candidate_id uuid NOT NULL REFERENCES public.role_candidates(id),
 type text NOT NULL CHECK(type IN ('self_tape','live','callback','chemistry','other')),scheduled_at timestamptz,
 status text NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','requested','submitted','reviewed','cancelled')),
 instructions text NOT NULL DEFAULT '' CHECK(length(instructions)<=5000),created_by uuid NOT NULL DEFAULT auth.uid() REFERENCES public.profiles(id),created_at timestamptz NOT NULL DEFAULT now()
);
-- Media ingress deliberately unavailable until private versioned upload/retention pipeline is reviewed.
CREATE TABLE public.audition_media_versions(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),audition_id uuid NOT NULL REFERENCES public.auditions(id),version int NOT NULL CHECK(version>0),
 private_object_path text NOT NULL UNIQUE,sanitized_at timestamptz,created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(audition_id,version)
);
CREATE TABLE public.casting_ensembles(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),project_id uuid NOT NULL REFERENCES public.projects(id),title text NOT NULL CHECK(length(btrim(title)) BETWEEN 2 AND 160));
CREATE TABLE public.casting_ensemble_members(ensemble_id uuid NOT NULL REFERENCES public.casting_ensembles(id),candidate_id uuid NOT NULL REFERENCES public.role_candidates(id),PRIMARY KEY(ensemble_id,candidate_id));
CREATE TABLE filmverse_private.casting_share_keys(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),project_id uuid NOT NULL REFERENCES public.projects(id),token_hash text NOT NULL UNIQUE,
 candidate_ids uuid[] NOT NULL CHECK(cardinality(candidate_ids) BETWEEN 1 AND 30),created_by uuid NOT NULL REFERENCES public.profiles(id),
 expires_at timestamptz NOT NULL,revoked_at timestamptz,created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE filmverse_private.casting_share_keys ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON filmverse_private.casting_share_keys FROM PUBLIC,anon,authenticated;
CREATE FUNCTION filmverse_private.casting_share_create(p_project uuid,p_candidates uuid[],p_expires timestamptz) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE token text:=replace(gen_random_uuid()::text,'-','')||replace(gen_random_uuid()::text,'-',''); key uuid;
BEGIN
 IF NOT filmverse_private.project_can(p_project) THEN RAISE EXCEPTION 'project_authority_required' USING ERRCODE='42501';END IF;
 IF p_expires IS NULL OR p_expires<=now() OR p_expires>now()+interval '7 days' OR coalesce(cardinality(p_candidates),0) NOT BETWEEN 1 AND 30 THEN RAISE EXCEPTION 'bounded_share_required' USING ERRCODE='22023';END IF;
 IF EXISTS(SELECT 1 FROM unnest(p_candidates) requested(id) WHERE NOT EXISTS(SELECT 1 FROM public.role_candidates c JOIN public.casting_roles r ON r.id=c.role_id JOIN public.casting_subjects s ON s.id=c.casting_subject_id
 WHERE c.id=requested.id AND r.project_id=p_project AND s.subject_type='adult' AND filmverse_private.person_visible(s.adult_user_id))) THEN RAISE EXCEPTION 'share_subject_unavailable' USING ERRCODE='42501';END IF;
 INSERT INTO filmverse_private.casting_share_keys(project_id,token_hash,candidate_ids,created_by,expires_at) VALUES(p_project,encode(sha256(convert_to(token,'UTF8')),'hex'),p_candidates,auth.uid(),p_expires) RETURNING id INTO key;
 RETURN jsonb_build_object('id',key,'token',token,'expires_at',p_expires);
END $$;
CREATE FUNCTION filmverse_private.casting_share_read(p_token text) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT coalesce(jsonb_agg(jsonb_build_object('candidate_id',c.id,'role',r.title,'name',p.full_name)),'[]')
 FROM filmverse_private.casting_share_keys k JOIN public.role_candidates c ON c.id=ANY(k.candidate_ids)
 JOIN public.casting_roles r ON r.id=c.role_id AND r.project_id=k.project_id JOIN public.casting_subjects s ON s.id=c.casting_subject_id AND s.subject_type='adult'
 JOIN public.profiles p ON p.id=s.adult_user_id
 WHERE k.token_hash=encode(sha256(convert_to(p_token,'UTF8')),'hex') AND length(p_token)=64 AND k.expires_at>now() AND k.revoked_at IS NULL
 -- Recheck anonymous public visibility; private work-context identity cannot be exported.
 AND coalesce((SELECT profile_visibility FROM public.profile_privacy_settings WHERE user_id=p.id),'public')='public'
$$;
CREATE FUNCTION filmverse_private.casting_share_revoke(p_id uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN UPDATE filmverse_private.casting_share_keys SET revoked_at=now() WHERE id=p_id AND filmverse_private.project_can(project_id);IF NOT FOUND THEN RAISE EXCEPTION 'share_unavailable' USING ERRCODE='42501';END IF;END $$;
DO $$ DECLARE t text;BEGIN
 FOREACH t IN ARRAY ARRAY['casting_roles','role_candidates','casting_reviewer_notes','casting_comments','auditions','audition_media_versions','casting_ensembles','casting_ensemble_members'] LOOP
 EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC,anon,authenticated',t);EXECUTE format('GRANT ALL ON public.%I TO service_role',t);END LOOP;
END $$;
GRANT SELECT,INSERT(project_id,title,description),UPDATE(title,description,status) ON public.casting_roles TO authenticated;
CREATE POLICY roles_read ON public.casting_roles FOR SELECT TO authenticated USING(filmverse_private.project_can(project_id));
CREATE POLICY roles_create ON public.casting_roles FOR INSERT TO authenticated WITH CHECK(created_by=auth.uid() AND filmverse_private.project_can(project_id));
CREATE POLICY roles_update ON public.casting_roles FOR UPDATE TO authenticated USING(filmverse_private.project_can(project_id)) WITH CHECK(filmverse_private.project_can(project_id));
GRANT SELECT,INSERT(role_id,casting_subject_id,application_id,source),UPDATE(status,project_tags) ON public.role_candidates TO authenticated;
CREATE POLICY candidates_read ON public.role_candidates FOR SELECT TO authenticated USING(filmverse_private.casting_can(role_id) AND filmverse_private.subject_visible(casting_subject_id));
CREATE POLICY candidates_create ON public.role_candidates FOR INSERT TO authenticated WITH CHECK(created_by=auth.uid() AND filmverse_private.casting_can(role_id));
CREATE POLICY candidates_update ON public.role_candidates FOR UPDATE TO authenticated USING(filmverse_private.casting_can(role_id) AND filmverse_private.subject_visible(casting_subject_id)) WITH CHECK(filmverse_private.casting_can(role_id));
GRANT SELECT,INSERT(candidate_id,body),UPDATE(body),DELETE ON public.casting_reviewer_notes TO authenticated;
CREATE POLICY notes_owner ON public.casting_reviewer_notes FOR ALL TO authenticated USING(reviewer_id=auth.uid() AND filmverse_private.candidate_can(candidate_id)) WITH CHECK(reviewer_id=auth.uid() AND filmverse_private.candidate_can(candidate_id));
GRANT SELECT,INSERT(candidate_id,body) ON public.casting_comments TO authenticated;
CREATE POLICY comments_read ON public.casting_comments FOR SELECT TO authenticated USING(filmverse_private.candidate_can(candidate_id));
CREATE POLICY comments_create ON public.casting_comments FOR INSERT TO authenticated WITH CHECK(author_id=auth.uid() AND filmverse_private.candidate_can(candidate_id));
GRANT SELECT,INSERT(role_candidate_id,type,scheduled_at,instructions),UPDATE(type,scheduled_at,instructions) ON public.auditions TO authenticated;
CREATE POLICY auditions_read ON public.auditions FOR SELECT TO authenticated USING(filmverse_private.candidate_can(role_candidate_id));
CREATE POLICY auditions_create ON public.auditions FOR INSERT TO authenticated WITH CHECK(created_by=auth.uid() AND filmverse_private.candidate_can(role_candidate_id));
CREATE POLICY auditions_update ON public.auditions FOR UPDATE TO authenticated USING(filmverse_private.candidate_can(role_candidate_id)) WITH CHECK(filmverse_private.candidate_can(role_candidate_id));
GRANT SELECT,INSERT(project_id,title),UPDATE(title) ON public.casting_ensembles TO authenticated;
CREATE POLICY ensemble_read ON public.casting_ensembles FOR SELECT TO authenticated USING(filmverse_private.project_can(project_id));
CREATE POLICY ensemble_create ON public.casting_ensembles FOR INSERT TO authenticated WITH CHECK(filmverse_private.project_can(project_id));
CREATE POLICY ensemble_edit ON public.casting_ensembles FOR UPDATE TO authenticated USING(filmverse_private.project_can(project_id)) WITH CHECK(filmverse_private.project_can(project_id));
GRANT SELECT,INSERT,DELETE ON public.casting_ensemble_members TO authenticated;
CREATE POLICY ensemble_member_read ON public.casting_ensemble_members FOR SELECT TO authenticated USING(filmverse_private.candidate_can(candidate_id));
CREATE POLICY ensemble_member_create ON public.casting_ensemble_members FOR INSERT TO authenticated WITH CHECK(EXISTS(SELECT 1 FROM public.casting_ensembles e JOIN public.role_candidates c ON c.id=candidate_id JOIN public.casting_roles r ON r.id=c.role_id WHERE e.id=ensemble_id AND e.project_id=r.project_id AND filmverse_private.project_can(e.project_id)));
CREATE POLICY ensemble_member_delete ON public.casting_ensemble_members FOR DELETE TO authenticated USING(filmverse_private.candidate_can(candidate_id));
CREATE FUNCTION public.casting_share_create(p_project uuid,p_candidates uuid[],p_expires timestamptz) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT filmverse_private.casting_share_create(p_project,p_candidates,p_expires) $$;
CREATE FUNCTION public.casting_share_read(p_token text) RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$ SELECT filmverse_private.casting_share_read(p_token) $$;
CREATE FUNCTION public.casting_share_revoke(p_id uuid) RETURNS void LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT filmverse_private.casting_share_revoke(p_id) $$;
DO $$ DECLARE f record;BEGIN
 FOR f IN SELECT p.oid::regprocedure sig,p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname IN ('public','filmverse_private') AND p.proname=ANY(ARRAY['casting_can','candidate_can','candidate_guard','casting_share_create','casting_share_read','casting_share_revoke']) LOOP
 EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated',f.sig);
 IF f.proname<>'candidate_guard' THEN EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated',f.sig);END IF;
 IF f.proname='casting_share_read' THEN EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO anon',f.sig);END IF;
 END LOOP;
END $$;
COMMIT;
