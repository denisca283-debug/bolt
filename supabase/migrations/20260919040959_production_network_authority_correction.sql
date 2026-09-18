BEGIN;
SET LOCAL lock_timeout = '5s';

-- Draft authorship is not reviewed representative authority. No discovery policy changes.
CREATE FUNCTION filmverse_private.manage_private_minor_draft(p_minor uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT auth.uid() IS NOT NULL AND EXISTS (
 SELECT 1 FROM public.minor_talent_profiles p JOIN public.minor_guardians g ON g.minor_talent_id=p.id
 WHERE p.id=p_minor AND p.created_by=auth.uid() AND NOT p.discoverable
 AND g.guardian_user_id=auth.uid() AND g.status='pending')
$$;
REVOKE ALL ON FUNCTION filmverse_private.manage_private_minor_draft(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION filmverse_private.manage_private_minor_draft(uuid) TO authenticated;
ALTER POLICY minor_profile_edit ON public.minor_talent_profiles
 USING (filmverse_private.minor_guardian(id) OR filmverse_private.manage_private_minor_draft(id))
 WITH CHECK (filmverse_private.minor_guardian(id) OR (NOT discoverable AND filmverse_private.manage_private_minor_draft(id)));

-- Only trusted domain administration writes delegations; broad project membership grants nothing.
CREATE TABLE public.project_casting_authorities (
 project_id uuid NOT NULL REFERENCES public.projects(id),
 user_id uuid NOT NULL REFERENCES public.profiles(id),
 permission text NOT NULL CHECK(permission IN ('view_casting','manage_candidates','manage_auditions','approve_cast','share_casting')),
 granted_by uuid NOT NULL REFERENCES public.profiles(id),
 granted_at timestamptz NOT NULL DEFAULT now(),revoked_at timestamptz,
 PRIMARY KEY(project_id,user_id,permission)
);
ALTER TABLE public.project_casting_authorities ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.project_casting_authorities FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.project_casting_authorities TO service_role;
GRANT SELECT ON public.project_casting_authorities TO authenticated;
CREATE POLICY casting_authority_read ON public.project_casting_authorities FOR SELECT TO authenticated USING(user_id=auth.uid());
CREATE FUNCTION filmverse_private.project_casting_can(p_project uuid,p_permission text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT auth.uid() IS NOT NULL AND p_permission IN ('view_casting','manage_candidates','manage_auditions','approve_cast','share_casting')
 AND EXISTS(SELECT 1 FROM public.projects p WHERE p.id=p_project AND
 ((p.organization_id IS NULL AND p.user_id=auth.uid())
 OR EXISTS(SELECT 1 FROM public.organization_members owner WHERE owner.organization_id=p.organization_id AND owner.user_id=auth.uid() AND owner.active AND owner.role='owner')
 OR EXISTS(SELECT 1 FROM public.project_casting_authorities a
 JOIN public.project_members m ON m.project_id=a.project_id AND m.user_id=a.user_id AND m.status='active'
 WHERE a.project_id=p.id AND a.user_id=auth.uid() AND a.revoked_at IS NULL
 AND (a.permission=p_permission OR p_permission='view_casting'))))
$$;
CREATE FUNCTION filmverse_private.casting_permission(p_role uuid,p_permission text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM public.casting_roles WHERE id=p_role AND filmverse_private.project_casting_can(project_id,p_permission))
$$;
CREATE FUNCTION filmverse_private.candidate_permission(p_candidate uuid,p_permission text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM public.role_candidates WHERE id=p_candidate AND filmverse_private.casting_permission(role_id,p_permission))
$$;
CREATE OR REPLACE FUNCTION filmverse_private.casting_can(p_role uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT filmverse_private.casting_permission(p_role,'manage_candidates')
$$;
CREATE OR REPLACE FUNCTION filmverse_private.candidate_can(p_candidate uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT filmverse_private.candidate_permission(p_candidate,'manage_candidates')
$$;
REVOKE ALL ON FUNCTION filmverse_private.project_casting_can(uuid,text),filmverse_private.casting_permission(uuid,text),filmverse_private.candidate_permission(uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION filmverse_private.project_casting_can(uuid,text),filmverse_private.casting_permission(uuid,text),filmverse_private.candidate_permission(uuid,text) TO authenticated;
ALTER POLICY roles_read ON public.casting_roles USING(filmverse_private.project_casting_can(project_id,'view_casting'));
ALTER POLICY roles_create ON public.casting_roles WITH CHECK(created_by=auth.uid() AND filmverse_private.project_casting_can(project_id,'manage_candidates'));
ALTER POLICY roles_update ON public.casting_roles USING(filmverse_private.project_casting_can(project_id,'manage_candidates')) WITH CHECK(filmverse_private.project_casting_can(project_id,'manage_candidates'));
ALTER POLICY candidates_read ON public.role_candidates USING(filmverse_private.casting_permission(role_id,'view_casting') AND filmverse_private.subject_visible(casting_subject_id));
ALTER POLICY auditions_read ON public.auditions USING(filmverse_private.candidate_permission(role_candidate_id,'view_casting'));
ALTER POLICY auditions_create ON public.auditions WITH CHECK(created_by=auth.uid() AND filmverse_private.candidate_permission(role_candidate_id,'manage_auditions'));
ALTER POLICY auditions_update ON public.auditions USING(filmverse_private.candidate_permission(role_candidate_id,'manage_auditions')) WITH CHECK(filmverse_private.candidate_permission(role_candidate_id,'manage_auditions'));
ALTER POLICY ensemble_read ON public.casting_ensembles USING(filmverse_private.project_casting_can(project_id,'view_casting'));
ALTER POLICY ensemble_create ON public.casting_ensembles WITH CHECK(filmverse_private.project_casting_can(project_id,'manage_candidates'));
ALTER POLICY ensemble_edit ON public.casting_ensembles USING(filmverse_private.project_casting_can(project_id,'manage_candidates')) WITH CHECK(filmverse_private.project_casting_can(project_id,'manage_candidates'));
ALTER POLICY ensemble_member_create ON public.casting_ensemble_members WITH CHECK(EXISTS(SELECT 1 FROM public.casting_ensembles e JOIN public.role_candidates c ON c.id=candidate_id JOIN public.casting_roles r ON r.id=c.role_id WHERE e.id=ensemble_id AND e.project_id=r.project_id AND filmverse_private.project_casting_can(e.project_id,'manage_candidates')));
CREATE FUNCTION filmverse_private.candidate_approval_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF (NEW.status='approved' OR (TG_OP='UPDATE' AND OLD.status='approved'))
 AND NOT filmverse_private.casting_permission(NEW.role_id,'approve_cast') THEN
 RAISE EXCEPTION 'cast_approval_authority_required' USING ERRCODE='42501';END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION filmverse_private.candidate_approval_guard() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER candidate_approval BEFORE INSERT OR UPDATE ON public.role_candidates FOR EACH ROW EXECUTE FUNCTION filmverse_private.candidate_approval_guard();

-- Disable the context-free endpoint, including direct invocation of its private helper.
CREATE OR REPLACE FUNCTION filmverse_private.minor_contact(p_subject uuid) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN RAISE EXCEPTION 'reviewed_casting_context_required' USING ERRCODE='42501'; END $$;
REVOKE ALL ON FUNCTION public.minor_contact(uuid),filmverse_private.minor_contact(uuid) FROM PUBLIC,anon,authenticated;
-- A responsibility record is independently reviewed, explicitly accepted and revocable.
CREATE TABLE public.minor_project_responsibilities (
 project_id uuid NOT NULL REFERENCES public.projects(id),adult_user_id uuid NOT NULL REFERENCES public.profiles(id),
 policy_version text NOT NULL CHECK(length(policy_version) BETWEEN 1 AND 100),
 reviewed_by uuid NOT NULL REFERENCES public.profiles(id),reviewed_at timestamptz NOT NULL DEFAULT now(),
 valid_until timestamptz NOT NULL CHECK(valid_until>reviewed_at),
 accepted_at timestamptz,revoked_at timestamptz,
 PRIMARY KEY(project_id,adult_user_id),CHECK(reviewed_by<>adult_user_id)
);
ALTER TABLE public.minor_project_responsibilities ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.minor_project_responsibilities FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.minor_project_responsibilities TO service_role;
GRANT SELECT ON public.minor_project_responsibilities TO authenticated;
CREATE POLICY responsibility_read ON public.minor_project_responsibilities FOR SELECT TO authenticated
 USING(adult_user_id=auth.uid() OR filmverse_private.project_casting_can(project_id,'view_casting'));
CREATE FUNCTION filmverse_private.responsible_adult_associated(p_project uuid,p_adult uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM public.projects p WHERE p.id=p_project AND
 ((p.organization_id IS NULL AND p.user_id=p_adult)
 OR EXISTS(SELECT 1 FROM public.organization_members owner WHERE owner.organization_id=p.organization_id AND owner.user_id=p_adult AND owner.active AND owner.role='owner')
 OR EXISTS(SELECT 1 FROM public.project_members m WHERE m.project_id=p.id AND m.user_id=p_adult AND m.status='active')))
$$;
CREATE FUNCTION filmverse_private.responsibility_accept(p_project uuid,p_policy text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF auth.uid() IS NULL OR NOT filmverse_private.responsible_adult_associated(p_project,auth.uid()) THEN
 RAISE EXCEPTION 'project_association_required' USING ERRCODE='42501';END IF;
 UPDATE public.minor_project_responsibilities SET accepted_at=coalesce(accepted_at,now())
 WHERE project_id=p_project AND adult_user_id=auth.uid() AND policy_version=p_policy AND revoked_at IS NULL AND valid_until>now();
 IF NOT FOUND THEN RAISE EXCEPTION 'reviewed_responsibility_required' USING ERRCODE='42501';END IF;
END $$;
CREATE FUNCTION public.minor_responsibility_accept(p_project uuid,p_policy text) RETURNS void LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$
 SELECT filmverse_private.responsibility_accept(p_project,p_policy)
$$;
CREATE FUNCTION filmverse_private.responsible_adult_ready(p_project uuid,p_adult uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT filmverse_private.responsible_adult_associated(p_project,p_adult) AND EXISTS(
 SELECT 1 FROM public.minor_project_responsibilities WHERE project_id=p_project AND adult_user_id=p_adult
 AND accepted_at IS NOT NULL AND revoked_at IS NULL AND valid_until>now())
$$;
CREATE FUNCTION filmverse_private.minor_responsibility_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NEW.minor_opportunity AND NOT filmverse_private.responsible_adult_ready(NEW.project_id,NEW.minor_responsible_adult) THEN
 RAISE EXCEPTION 'accepted_reviewed_project_responsibility_required' USING ERRCODE='42501';END IF;RETURN NEW;
END $$;
CREATE TRIGGER minor_responsibility_guard BEFORE INSERT OR UPDATE ON public.work_opportunities FOR EACH ROW EXECUTE FUNCTION filmverse_private.minor_responsibility_guard();
-- Revocation/expiry invalidates discoverability and applications even without editing the work row.
CREATE OR REPLACE FUNCTION filmverse_private.minor_work_reviewed(p_work uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM filmverse_private.minor_opportunity_reviews r JOIN public.work_opportunities w ON w.id=r.work_id
 WHERE w.id=p_work AND r.reviewer IS DISTINCT FROM w.user_id
 AND filmverse_private.responsible_adult_ready(w.project_id,w.minor_responsible_adult)
 AND r.content_hash=encode(sha256(convert_to((to_jsonb(w)-'updated_at')::text,'UTF8')),'hex'))
$$;
CREATE TABLE public.minor_casting_invitations (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),casting_subject_id uuid NOT NULL REFERENCES public.casting_subjects(id),
 role_id uuid NOT NULL REFERENCES public.casting_roles(id),work_id uuid NOT NULL REFERENCES public.work_opportunities(id),
 invited_by uuid NOT NULL REFERENCES public.profiles(id),guardian_user_id uuid NOT NULL REFERENCES public.profiles(id),
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','accepted','declined')),
 created_at timestamptz NOT NULL DEFAULT now(),responded_at timestamptz,
 UNIQUE(casting_subject_id,role_id,work_id)
);
ALTER TABLE public.minor_casting_invitations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.minor_casting_invitations FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.minor_casting_invitations TO service_role;
GRANT SELECT ON public.minor_casting_invitations TO authenticated;
CREATE POLICY minor_invitation_read ON public.minor_casting_invitations FOR SELECT TO authenticated USING(
 guardian_user_id=auth.uid() OR filmverse_private.casting_permission(role_id,'view_casting'));
CREATE FUNCTION filmverse_private.minor_contact(p_subject uuid,p_role uuid,p_work uuid) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE mid uuid; guardian uuid; invitation uuid;
BEGIN
 IF NOT filmverse_private.network_permission('search_minor_talent') OR NOT filmverse_private.casting_permission(p_role,'manage_candidates')
 OR NOT EXISTS(SELECT 1 FROM public.casting_roles r JOIN public.work_opportunities w ON w.project_id=r.project_id
 WHERE r.id=p_role AND r.status='open' AND w.id=p_work AND w.minor_opportunity AND filmverse_private.minor_work_reviewed(w.id)) THEN
 RAISE EXCEPTION 'reviewed_casting_context_required' USING ERRCODE='42501';END IF;
 SELECT minor_talent_id INTO mid FROM public.casting_subjects WHERE id=p_subject AND subject_type='minor';
 IF mid IS NULL OR NOT filmverse_private.minor_visible(mid) THEN RAISE EXCEPTION 'contact_unavailable' USING ERRCODE='42501';END IF;
 SELECT guardian_user_id INTO guardian FROM public.minor_guardians WHERE minor_talent_id=mid AND status='approved'
 AND valid_until>now() AND filmverse_private.person_contactable(guardian_user_id,'invite') ORDER BY is_primary DESC,id LIMIT 1;
 IF guardian IS NULL THEN RAISE EXCEPTION 'contact_unavailable' USING ERRCODE='42501';END IF;
 INSERT INTO public.minor_casting_invitations(casting_subject_id,role_id,work_id,invited_by,guardian_user_id)
 VALUES(p_subject,p_role,p_work,auth.uid(),guardian) ON CONFLICT(casting_subject_id,role_id,work_id) DO NOTHING RETURNING id INTO invitation;
 IF invitation IS NULL THEN SELECT id INTO invitation FROM public.minor_casting_invitations
 WHERE casting_subject_id=p_subject AND role_id=p_role AND work_id=p_work AND guardian_user_id=guardian AND status<>'declined';END IF;
 IF invitation IS NULL THEN RAISE EXCEPTION 'invitation_unavailable' USING ERRCODE='42501';END IF;
 -- Invitation is not a DM or a candidate. Guardian explicitly responds first.
 RETURN invitation;
END $$;
CREATE FUNCTION public.minor_contact(p_subject uuid,p_role uuid,p_work uuid) RETURNS uuid LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$
 SELECT filmverse_private.minor_contact(p_subject,p_role,p_work)
$$;
CREATE FUNCTION filmverse_private.minor_invitation_respond(p_id uuid,p_accept boolean,p_terms text,p_until timestamptz) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE i public.minor_casting_invitations; project uuid;
BEGIN
 SELECT * INTO i FROM public.minor_casting_invitations WHERE id=p_id FOR UPDATE;
 IF NOT FOUND OR auth.uid() IS DISTINCT FROM i.guardian_user_id OR NOT filmverse_private.subject_manage(i.casting_subject_id)
 OR i.status<>'pending' OR p_accept IS NULL THEN RAISE EXCEPTION 'guardian_invitation_unavailable' USING ERRCODE='42501';END IF;
 SELECT project_id INTO project FROM public.casting_roles WHERE id=i.role_id;
 IF p_accept THEN
 IF NOT filmverse_private.minor_work_reviewed(i.work_id) OR p_until IS NULL OR p_until<=now() OR p_until>now()+interval '90 days' THEN
 RAISE EXCEPTION 'reviewed_context_and_bounded_consent_required' USING ERRCODE='42501';END IF;
 INSERT INTO public.minor_project_consents(casting_subject_id,project_id,guardian_user_id,scope,terms_version,expires_at)
 VALUES(i.casting_subject_id,project,auth.uid(),'application',p_terms,p_until);
 END IF;
 UPDATE public.minor_casting_invitations SET status=CASE WHEN p_accept THEN 'accepted' ELSE 'declined' END,responded_at=now() WHERE id=p_id;
END $$;
CREATE FUNCTION public.minor_invitation_respond(p_id uuid,p_accept boolean,p_terms text,p_until timestamptz) RETURNS void LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$
 SELECT filmverse_private.minor_invitation_respond(p_id,p_accept,p_terms,p_until)
$$;
CREATE FUNCTION filmverse_private.minor_candidate_source_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NEW.source<>'application' AND EXISTS(SELECT 1 FROM public.casting_subjects WHERE id=NEW.casting_subject_id AND subject_type='minor')
 AND NOT EXISTS(SELECT 1 FROM public.minor_casting_invitations i WHERE i.casting_subject_id=NEW.casting_subject_id AND i.role_id=NEW.role_id
 AND i.status='accepted' AND filmverse_private.minor_work_reviewed(i.work_id)) THEN
 RAISE EXCEPTION 'accepted_guardian_invitation_required' USING ERRCODE='42501';END IF;RETURN NEW;
END $$;
CREATE TRIGGER minor_candidate_source BEFORE INSERT ON public.role_candidates FOR EACH ROW EXECUTE FUNCTION filmverse_private.minor_candidate_source_guard();
DO $$ DECLARE f record;BEGIN
 FOR f IN SELECT p.oid::regprocedure sig,p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname IN ('public','filmverse_private') AND p.proname IN ('responsible_adult_associated','responsible_adult_ready','responsibility_accept','minor_responsibility_accept','minor_responsibility_guard','minor_candidate_source_guard','minor_invitation_respond') LOOP
 EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated',f.sig);
 IF f.proname IN ('responsibility_accept','minor_responsibility_accept','minor_invitation_respond') THEN EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated',f.sig);END IF;
 END LOOP;
END $$;
REVOKE ALL ON FUNCTION public.minor_contact(uuid,uuid,uuid),filmverse_private.minor_contact(uuid,uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.minor_contact(uuid,uuid,uuid),filmverse_private.minor_contact(uuid,uuid,uuid) TO authenticated;
-- Sharing is an independent authority, not general project management.
CREATE OR REPLACE FUNCTION filmverse_private.casting_share_create(p_project uuid,p_candidates uuid[],p_expires timestamptz) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE token text:=replace(gen_random_uuid()::text,'-','')||replace(gen_random_uuid()::text,'-',''); key uuid;
BEGIN
 IF NOT filmverse_private.project_casting_can(p_project,'share_casting') THEN RAISE EXCEPTION 'project_authority_required' USING ERRCODE='42501';END IF;
 IF p_expires IS NULL OR p_expires<=now() OR p_expires>now()+interval '7 days' OR coalesce(cardinality(p_candidates),0) NOT BETWEEN 1 AND 30 THEN RAISE EXCEPTION 'bounded_share_required' USING ERRCODE='22023';END IF;
 IF EXISTS(SELECT 1 FROM unnest(p_candidates) requested(id) WHERE NOT EXISTS(SELECT 1 FROM public.role_candidates c JOIN public.casting_roles r ON r.id=c.role_id JOIN public.casting_subjects s ON s.id=c.casting_subject_id
 WHERE c.id=requested.id AND r.project_id=p_project AND s.subject_type='adult' AND filmverse_private.person_visible(s.adult_user_id))) THEN RAISE EXCEPTION 'share_subject_unavailable' USING ERRCODE='42501';END IF;
 INSERT INTO filmverse_private.casting_share_keys(project_id,token_hash,candidate_ids,created_by,expires_at) VALUES(p_project,encode(sha256(convert_to(token,'UTF8')),'hex'),p_candidates,auth.uid(),p_expires) RETURNING id INTO key;
 RETURN jsonb_build_object('id',key,'token',token,'expires_at',p_expires);
END $$;
CREATE OR REPLACE FUNCTION filmverse_private.casting_share_revoke(p_id uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN UPDATE filmverse_private.casting_share_keys SET revoked_at=now() WHERE id=p_id AND filmverse_private.project_casting_can(project_id,'share_casting');IF NOT FOUND THEN RAISE EXCEPTION 'share_unavailable' USING ERRCODE='42501';END IF;END $$;

ALTER TABLE public.organization_professional_relationships
 ADD COLUMN organization_displays_relationship boolean NOT NULL DEFAULT false;
-- Existing consent is retained; companies explicitly opt into their own public projection.
CREATE FUNCTION filmverse_private.graph_contact_allowed(p_person uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT auth.uid() IS NOT NULL AND p_person<>auth.uid() AND filmverse_private.support_not_blocked(p_person)
 AND EXISTS(SELECT 1 FROM public.profiles WHERE id=p_person)
 AND (coalesce((SELECT invite_permission FROM public.profile_privacy_settings WHERE user_id=p_person),'members')='members'
 OR (coalesce((SELECT invite_permission FROM public.profile_privacy_settings WHERE user_id=p_person),'members')='work_context'
 AND filmverse_private.person_work_context(p_person)))
$$;
REVOKE ALL ON FUNCTION filmverse_private.graph_contact_allowed(uuid) FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION filmverse_private.relationship_request(p_org uuid,p_person uuid,p_kind text,p_role text) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE result uuid; orgside boolean;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication_required' USING ERRCODE='42501';END IF;
 orgside:=filmverse_private.org_can(p_org,'manage_members');
 IF (auth.uid()<>p_person AND NOT orgside) OR NOT EXISTS(SELECT 1 FROM public.organizations WHERE id=p_org) OR (NOT orgside AND NOT filmverse_private.org_public(p_org) AND NOT filmverse_private.org_member(p_org)) THEN RAISE EXCEPTION 'relationship_unavailable' USING ERRCODE='42501';END IF;
 IF auth.uid()<>p_person AND NOT filmverse_private.graph_contact_allowed(p_person) THEN RAISE EXCEPTION 'relationship_unavailable' USING ERRCODE='42501';END IF;
 INSERT INTO public.organization_professional_relationships(organization_id,user_id,relationship_type,custom_role,initiated_by,organization_confirmed_at,professional_confirmed_at)
 VALUES(p_org,p_person,p_kind,p_role,CASE WHEN auth.uid()=p_person THEN 'professional' ELSE 'organization' END,
 CASE WHEN auth.uid()<>p_person AND orgside THEN now() END,CASE WHEN auth.uid()=p_person THEN now() END)
 ON CONFLICT(organization_id,user_id,relationship_type) DO NOTHING RETURNING id INTO result;
 IF result IS NULL THEN SELECT id INTO result FROM public.organization_professional_relationships WHERE organization_id=p_org AND user_id=p_person AND relationship_type=p_kind;END IF;
 RETURN result;
END $$;
CREATE OR REPLACE FUNCTION filmverse_private.relationship_respond(p_id uuid,p_action text,p_public_org boolean DEFAULT false,p_public_person boolean DEFAULT false) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r public.organization_professional_relationships; personside boolean;
BEGIN
 SELECT * INTO r FROM public.organization_professional_relationships WHERE id=p_id FOR UPDATE;
 IF NOT FOUND OR auth.uid() IS NULL OR (r.user_id<>auth.uid() AND NOT filmverse_private.org_can(r.organization_id,'manage_members')) THEN RAISE EXCEPTION 'relationship_unavailable' USING ERRCODE='42501';END IF;
 personside:=r.user_id=auth.uid();
 IF p_action='confirm' THEN
 IF r.status NOT IN ('pending','active') THEN RAISE EXCEPTION 'relationship_closed' USING ERRCODE='23514';END IF;
 IF NOT personside AND NOT filmverse_private.graph_contact_allowed(r.user_id) THEN RAISE EXCEPTION 'relationship_unavailable' USING ERRCODE='42501';END IF;
 IF personside THEN r.professional_confirmed_at:=now();r.public_on_organization_profile:=coalesce(p_public_org,false);r.public_on_professional_profile:=coalesce(p_public_person,false);
 ELSE r.organization_confirmed_at:=now();r.organization_displays_relationship:=coalesce(p_public_org,false);END IF;
 IF r.professional_confirmed_at IS NOT NULL AND r.organization_confirmed_at IS NOT NULL THEN r.status:='active';r.last_confirmed_at:=least(r.professional_confirmed_at,r.organization_confirmed_at);r.started_at:=coalesce(r.started_at,now());END IF;
 ELSIF p_action IN ('decline','end') THEN r.status:=CASE p_action WHEN 'decline' THEN 'declined' ELSE 'ended' END;r.ended_at:=now();
 ELSE RAISE EXCEPTION 'invalid_action' USING ERRCODE='22023';END IF;
 UPDATE public.organization_professional_relationships SET status=r.status,organization_confirmed_at=r.organization_confirmed_at,professional_confirmed_at=r.professional_confirmed_at,
 organization_displays_relationship=r.organization_displays_relationship,public_on_organization_profile=r.public_on_organization_profile,public_on_professional_profile=r.public_on_professional_profile,started_at=r.started_at,ended_at=r.ended_at,last_confirmed_at=r.last_confirmed_at,updated_at=now() WHERE id=p_id;
END $$;
CREATE OR REPLACE FUNCTION filmverse_private.professional_graph(p_org uuid,p_person uuid) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',r.id,'organization_id',o.id,'organization_name',o.name,'organization_slug',o.slug,'user_id',p.id,'full_name',p.full_name,'avatar_url',p.avatar_url,'public_slug',p.public_slug,'city',p.city,'role',r.custom_role,'relationship_type',r.relationship_type,'last_confirmed_at',r.last_confirmed_at,'stale',r.last_confirmed_at<now()-make_interval(days=>policy.freshness_days))),'[]')
 FROM public.organization_professional_relationships r JOIN public.organizations o ON o.id=r.organization_id JOIN public.profiles p ON p.id=r.user_id CROSS JOIN public.professional_graph_policy policy
 WHERE r.status='active' AND r.organization_confirmed_at IS NOT NULL AND r.professional_confirmed_at IS NOT NULL
 AND ((p_org IS NOT NULL AND r.organization_id=p_org AND r.public_on_organization_profile AND r.organization_displays_relationship) OR (p_person IS NOT NULL AND r.user_id=p_person AND r.public_on_professional_profile))
 AND filmverse_private.org_discoverable(o.id) AND coalesce((SELECT profile_visibility FROM public.profile_privacy_settings WHERE user_id=p.id),'public')='public' AND filmverse_private.support_not_blocked(p.id)
$$;
CREATE OR REPLACE FUNCTION filmverse_private.instructor_visible(p_program uuid,p_user uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT coalesce((SELECT profile_visibility FROM public.profile_privacy_settings WHERE user_id=p_user),'public')='public' AND EXISTS(SELECT 1 FROM public.education_programs p JOIN public.organization_professional_relationships r ON r.organization_id=p.organization_id AND r.user_id=p_user WHERE filmverse_private.org_discoverable(p.organization_id) AND p.id=p_program AND r.status='active' AND r.public_on_organization_profile AND r.organization_displays_relationship AND r.professional_confirmed_at IS NOT NULL AND r.organization_confirmed_at IS NOT NULL)
$$;
-- Legacy links remain constrained and unchanged. New links use typed destinations.
ALTER TABLE public.referral_campaigns
 ADD COLUMN destination_type text CHECK(destination_type IN ('work','casting_role','project','company','education_program','event','sourcing_event','other_supported_internal')),
 ADD COLUMN destination_entity_id uuid,
 ADD COLUMN destination_payload jsonb NOT NULL DEFAULT '{}' CHECK(jsonb_typeof(destination_payload)='object' AND octet_length(destination_payload::text)<=512);
CREATE FUNCTION filmverse_private.referral_destination(p_type text,p_entity uuid,p_payload jsonb) RETURNS text
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE slug text;
BEGIN
 IF p_payload IS NULL OR jsonb_typeof(p_payload)<>'object' OR octet_length(p_payload::text)>512 THEN RAISE EXCEPTION 'invalid_destination' USING ERRCODE='22023';END IF;
 IF p_type='other_supported_internal' THEN
 IF p_entity IS NOT NULL OR p_payload-'page'<>'{}'::jsonb THEN RAISE EXCEPTION 'invalid_destination' USING ERRCODE='22023';END IF;
 RETURN CASE p_payload->>'page' WHEN 'students' THEN '/students' WHEN 'industry' THEN '/industry'
 WHEN 'actors' THEN '/actors' WHEN 'models' THEN '/models' ELSE NULL END;
 END IF;
 IF p_payload<>'{}'::jsonb THEN RAISE EXCEPTION 'invalid_destination' USING ERRCODE='22023';END IF;
 IF p_type='company' AND p_entity IS NOT NULL THEN
 SELECT o.slug INTO slug FROM public.organizations o WHERE o.id=p_entity AND filmverse_private.org_discoverable(o.id);
 IF slug IS NULL OR slug !~ '^[a-zA-Z0-9_-]+$' THEN RETURN NULL;END IF;RETURN '/company/'||slug;
 END IF;
 RETURN CASE p_type WHEN 'work' THEN '/work' WHEN 'project' THEN CASE WHEN p_entity IS NULL THEN '/projects' ELSE '/project/'||p_entity::text END WHEN 'company' THEN '/companies'
 WHEN 'education_program' THEN '/education' WHEN 'event' THEN '/events'
 -- No live deep-link UI yet; never invent a route to private casting/sourcing records.
 WHEN 'casting_role' THEN '/projects' WHEN 'sourcing_event' THEN '/projects' ELSE NULL END
 || CASE WHEN p_entity IS NOT NULL AND p_type IN ('work','education_program','event') THEN '/'||p_entity::text ELSE '' END;
END $$;
REVOKE ALL ON FUNCTION filmverse_private.referral_destination(text,uuid,jsonb) FROM PUBLIC,anon,authenticated;
ALTER TABLE public.referral_campaigns ALTER COLUMN destination_path SET DEFAULT '/projects';
CREATE FUNCTION filmverse_private.referral_destination_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NEW.destination_type IS NOT NULL AND filmverse_private.referral_destination(NEW.destination_type,NEW.destination_entity_id,NEW.destination_payload) IS NULL THEN
 RAISE EXCEPTION 'unsupported_typed_destination' USING ERRCODE='22023';END IF;
 IF NEW.destination_type IS NULL AND (NEW.destination_entity_id IS NOT NULL OR NEW.destination_payload<>'{}'::jsonb) THEN
 RAISE EXCEPTION 'typed_destination_required' USING ERRCODE='22023';END IF;RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION filmverse_private.referral_destination_guard() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER referral_destination_guard BEFORE INSERT OR UPDATE ON public.referral_campaigns FOR EACH ROW EXECUTE FUNCTION filmverse_private.referral_destination_guard();
CREATE OR REPLACE FUNCTION filmverse_private.referral_resolve(p_code text) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT jsonb_build_object('destination_path',CASE WHEN c.destination_type IS NULL THEN c.destination_path
 ELSE filmverse_private.referral_destination(c.destination_type,c.destination_entity_id,c.destination_payload) END,'campaign_name',c.name)
 FROM public.referral_codes k JOIN public.referral_campaigns c ON c.id=k.campaign_id JOIN public.growth_partners p ON p.id=c.partner_id
 WHERE k.code=p_code AND k.status='active' AND c.status='active' AND p.status='active' AND now()>=c.starts_at AND now()<c.ends_at
$$;
CREATE FUNCTION filmverse_private.minor_contact_contexts() RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT coalesce(jsonb_agg(to_jsonb(context)),'[]') FROM (
 SELECT r.id AS role_id,w.id AS work_id,r.title AS role_title,w.title AS work_title
 FROM public.casting_roles r JOIN public.work_opportunities w ON w.project_id=r.project_id
 WHERE filmverse_private.network_permission('search_minor_talent') AND filmverse_private.casting_permission(r.id,'manage_candidates')
 AND r.status='open' AND w.minor_opportunity AND filmverse_private.minor_work_reviewed(w.id)
 ORDER BY r.created_at DESC LIMIT 100) context
$$;
CREATE FUNCTION public.minor_contact_contexts() RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$ SELECT filmverse_private.minor_contact_contexts() $$;
REVOKE ALL ON FUNCTION filmverse_private.minor_contact_contexts(),public.minor_contact_contexts() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION filmverse_private.minor_contact_contexts(),public.minor_contact_contexts() TO authenticated;
COMMIT;
