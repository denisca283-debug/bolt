BEGIN;
SET LOCAL lock_timeout='5s';
-- Explicit privileges, independent of installation-wide default grants.
GRANT SELECT ON public.profile_contacts,public.profile_media TO anon,authenticated;
-- Raw representations contain a separately-private contact. Only the owner
-- reads raw rows; other audiences use person_representatives with redaction.
REVOKE ALL ON public.profile_representations FROM anon;
GRANT SELECT ON public.profile_representations TO authenticated;
ALTER TABLE public.profile_representations DROP CONSTRAINT profile_representations_visibility_check;
ALTER TABLE public.profile_representations ADD CONSTRAINT profile_representations_visibility_check
 CHECK(visibility IN ('private','work_context','members','public'));

ALTER TABLE public.skills DROP CONSTRAINT skills_scope_check;
ALTER TABLE public.skills ADD CONSTRAINT skills_scope_check CHECK(scope IN ('actor','professional','both'));
ALTER TABLE public.user_custom_skills DROP CONSTRAINT user_custom_skills_scope_check;
ALTER TABLE public.user_custom_skills ADD CONSTRAINT user_custom_skills_scope_check CHECK(scope IN ('actor','professional','both'));
UPDATE public.skills SET scope='both' WHERE category IN ('movement','combat','vehicles','animals') OR name='Языки';
-- Structured proficiency is a separate, owner-controlled fact, not another
-- copy of a canonical skill. UI/module deliberately deferred.
CREATE TABLE public.profile_languages(
 user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES public.profiles(id) ON DELETE CASCADE,
 language_code text NOT NULL CHECK(language_code ~ '^[a-z]{2,3}(-[A-Z]{2})?$'),
 proficiency text NOT NULL CHECK(proficiency IN ('native','fluent','intermediate','basic')),
 PRIMARY KEY(user_id,language_code)
);
ALTER TABLE public.profile_languages ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.profile_languages FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.profile_languages TO anon,authenticated;
GRANT INSERT(language_code,proficiency),UPDATE(proficiency),DELETE ON public.profile_languages TO authenticated;
GRANT ALL ON public.profile_languages TO service_role;
CREATE POLICY language_read ON public.profile_languages FOR SELECT TO anon,authenticated USING(filmverse_private.person_visible(user_id));
CREATE POLICY language_write ON public.profile_languages FOR ALL TO authenticated USING(user_id=auth.uid()) WITH CHECK(user_id=auth.uid());

-- Resume is independently consented professional publication, not profile access.
ALTER TABLE public.profile_publications DROP CONSTRAINT profile_publications_visibility_check;
UPDATE public.profile_publications SET visibility=CASE visibility WHEN 'members' THEN 'hiring_members' WHEN 'private' THEN 'link_only' ELSE visibility END;
ALTER TABLE public.profile_publications ADD CONSTRAINT profile_publications_visibility_check CHECK(visibility IN ('public','hiring_members','link_only'));
ALTER TABLE public.profile_publications ADD COLUMN display_name text NOT NULL DEFAULT '' CHECK(length(display_name)<=160);
-- Existing headline/description already carry intentionally published identity.
-- Do not copy private profile fields into existing publications automatically.
GRANT INSERT(display_name),UPDATE(display_name) ON public.profile_publications TO authenticated;
CREATE OR REPLACE VIEW public.resume_publications WITH(security_invoker=true) AS
 SELECT id,user_id,headline,desired_profession_ids,custom_professions,cities,travel_ready,availability,rate_text,description,visibility,
 CASE WHEN status='active' AND ((expires_at IS NOT NULL AND expires_at<=now()) OR NOT filmverse_private.resume_licensed(id)) THEN 'expired' ELSE status END AS status,
 published_at,expires_at,created_at,updated_at,display_name FROM public.profile_publications;
ALTER TABLE public.work_opportunities ADD COLUMN hiring_active boolean NOT NULL DEFAULT true;
GRANT INSERT(hiring_active),UPDATE(hiring_active) ON public.work_opportunities TO authenticated;
CREATE FUNCTION filmverse_private.resume_hiring_authority() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT auth.uid() IS NOT NULL AND (
 EXISTS(SELECT 1 FROM public.work_opportunities WHERE user_id=auth.uid() AND organization_id IS NULL AND hiring_active)
 OR EXISTS(SELECT 1 FROM public.projects WHERE user_id=auth.uid() AND organization_id IS NULL AND stage IS NOT NULL AND stage<>'Завершён')
 OR EXISTS(SELECT 1 FROM public.organization_members m JOIN public.organization_role_permissions rp ON rp.role_key=m.role
 WHERE m.user_id=auth.uid() AND m.active AND rp.permission IN ('publish_jobs','review_applications')))
$$;
DROP POLICY resume_read ON public.profile_publications;
CREATE POLICY resume_read ON public.profile_publications FOR SELECT TO anon,authenticated USING(
 user_id=auth.uid() OR (status='active' AND (expires_at IS NULL OR expires_at>now()) AND filmverse_private.resume_licensed(id)
 AND (visibility='public' OR (visibility='hiring_members' AND filmverse_private.resume_hiring_authority()))));
CREATE TABLE filmverse_private.resume_share_keys(
 publication_id uuid PRIMARY KEY REFERENCES public.profile_publications(id) ON DELETE CASCADE,
 token_hash text NOT NULL,created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE filmverse_private.resume_share_keys ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON filmverse_private.resume_share_keys FROM PUBLIC,anon,authenticated;
CREATE FUNCTION filmverse_private.resume_share(p_id uuid,p_revoke boolean) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE token text;
BEGIN
 IF auth.uid() IS NULL OR NOT EXISTS(SELECT 1 FROM public.profile_publications WHERE id=p_id AND user_id=auth.uid())
 THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
 IF p_revoke THEN DELETE FROM filmverse_private.resume_share_keys WHERE publication_id=p_id; RETURN NULL; END IF;
 token:=replace(gen_random_uuid()::text||gen_random_uuid()::text,'-','');
 INSERT INTO filmverse_private.resume_share_keys(publication_id,token_hash)
 VALUES(p_id,encode(sha256(convert_to(token,'UTF8')),'hex'))
 ON CONFLICT(publication_id) DO UPDATE SET token_hash=EXCLUDED.token_hash,created_at=now();
 RETURN token;
END $$;
CREATE FUNCTION public.resume_share(p_id uuid,p_revoke boolean DEFAULT false) RETURNS text
LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT filmverse_private.resume_share(p_id,p_revoke) $$;
CREATE FUNCTION filmverse_private.resume_read(p_id uuid,p_token text) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT jsonb_build_object('id',r.id,'user_id',r.user_id,'display_name',r.display_name,'headline',r.headline,
 'custom_professions',r.custom_professions,'cities',r.cities,'travel_ready',r.travel_ready,'availability',r.availability,
 'rate_text',r.rate_text,'description',r.description,'visibility',r.visibility,'status',r.status)
 FROM public.profile_publications r WHERE r.id=p_id AND (r.user_id=auth.uid() OR (
 r.status='active' AND (r.expires_at IS NULL OR r.expires_at>now()) AND filmverse_private.resume_licensed(r.id)
 AND (r.visibility='public' OR (r.visibility='hiring_members' AND filmverse_private.resume_hiring_authority())
 OR (r.visibility='link_only' AND length(p_token)=64 AND EXISTS(SELECT 1 FROM filmverse_private.resume_share_keys k
 WHERE k.publication_id=r.id AND k.token_hash=encode(sha256(convert_to(p_token,'UTF8')),'hex'))))))
$$;
CREATE FUNCTION public.resume_read(p_id uuid,p_token text DEFAULT NULL) RETURNS jsonb
LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$ SELECT filmverse_private.resume_read(p_id,p_token) $$;
-- This view is discovery, not a bearer-link resolver. RLS filters hiring access.
CREATE VIEW public.resume_discovery WITH(security_invoker=true) AS
 SELECT id,headline,display_name,custom_professions,cities,travel_ready,availability FROM public.profile_publications
 WHERE visibility IN ('public','hiring_members') AND status='active' AND filmverse_private.resume_licensed(id)
 AND (expires_at IS NULL OR expires_at>now());
REVOKE ALL ON public.resume_discovery FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.resume_discovery TO anon,authenticated;

CREATE FUNCTION filmverse_private.organization_invitation_cards(p_offset int) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT coalesce(jsonb_agg(row_to_json(r)),'[]') FROM (
 SELECT i.id,i.organization_id,o.name AS organization_name,o.organization_type,o.logo_url,i.role_key,
 CASE WHEN i.status='pending' AND i.expires_at<=now() THEN 'expired' ELSE i.status END AS status,i.expires_at,
 CASE WHEN filmverse_private.person_visible(i.invited_by) THEN p.full_name ELSE NULL END AS inviter_name,
 filmverse_private.invitation_recipient(i.invited_email) AS is_recipient
 FROM public.organization_invitations i JOIN public.organizations o ON o.id=i.organization_id
 LEFT JOIN public.profiles p ON p.id=i.invited_by
 WHERE auth.uid() IS NOT NULL AND (filmverse_private.invitation_recipient(i.invited_email) OR filmverse_private.org_can(i.organization_id,'manage_members'))
 ORDER BY i.created_at DESC,i.id LIMIT 50 OFFSET greatest(0,least(p_offset,10000))) r
$$;
CREATE FUNCTION public.organization_invitation_cards(p_offset int DEFAULT 0) RETURNS jsonb
LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$ SELECT filmverse_private.organization_invitation_cards(p_offset) $$;

CREATE FUNCTION filmverse_private.org_discoverable(p_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT p_id IS NULL OR EXISTS(SELECT 1 FROM public.organizations WHERE id=p_id AND visibility='public')
$$;
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['projects','work_opportunities','marketplace_listings'] LOOP
 EXECUTE format('CREATE VIEW public.%I WITH(security_invoker=true) AS SELECT * FROM public.%I WHERE visibility=''public'' AND filmverse_private.org_discoverable(organization_id)',t||'_discovery',t);
 EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC,anon,authenticated',t||'_discovery');
 EXECUTE format('GRANT SELECT ON public.%I TO anon,authenticated',t||'_discovery');
 END LOOP;
END $$;
REVOKE ALL ON FUNCTION filmverse_private.resume_hiring_authority(),filmverse_private.resume_read(uuid,text),public.resume_read(uuid,text),filmverse_private.resume_share(uuid,boolean),public.resume_share(uuid,boolean),filmverse_private.organization_invitation_cards(int),public.organization_invitation_cards(int),filmverse_private.org_discoverable(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION filmverse_private.resume_hiring_authority(),filmverse_private.resume_read(uuid,text),public.resume_read(uuid,text),filmverse_private.org_discoverable(uuid) TO anon,authenticated;
GRANT EXECUTE ON FUNCTION filmverse_private.resume_share(uuid,boolean),public.resume_share(uuid,boolean),filmverse_private.organization_invitation_cards(int),public.organization_invitation_cards(int) TO authenticated;
COMMIT;
