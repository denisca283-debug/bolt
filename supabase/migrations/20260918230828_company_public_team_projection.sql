BEGIN;
CREATE FUNCTION filmverse_private.company_team(p_org uuid,p_offset int) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT coalesce(jsonb_agg(row_to_json(r)),'[]') FROM (
 SELECT p.id,p.full_name,p.public_slug,p.avatar_url FROM public.organization_members m
 JOIN public.profiles p ON p.id=m.user_id WHERE m.organization_id=p_org AND m.active AND m.public_visible
 AND filmverse_private.person_visible(p.id) AND (filmverse_private.org_public(p_org) OR filmverse_private.org_member(p_org))
 ORDER BY p.full_name,p.id LIMIT 24 OFFSET greatest(0,least(p_offset,10000))) r
$$;
CREATE FUNCTION public.company_team(p_org uuid,p_offset int DEFAULT 0) RETURNS jsonb
LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$ SELECT filmverse_private.company_team(p_org,p_offset) $$;
CREATE FUNCTION filmverse_private.company_cards(p_ids uuid[]) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT coalesce(jsonb_agg(row_to_json(r)),'[]') FROM (
 SELECT id,name,slug,logo_url,organization_type FROM public.organizations WHERE id=ANY(p_ids[1:100])
 AND (visibility IN ('public','unlisted') OR filmverse_private.org_member(id))) r
$$;
CREATE FUNCTION public.company_cards(p_ids uuid[]) RETURNS jsonb
LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$ SELECT filmverse_private.company_cards(p_ids) $$;
REVOKE ALL ON FUNCTION filmverse_private.company_team(uuid,int),public.company_team(uuid,int),filmverse_private.company_cards(uuid[]),public.company_cards(uuid[]) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION filmverse_private.company_team(uuid,int),public.company_team(uuid,int),filmverse_private.company_cards(uuid[]),public.company_cards(uuid[]) TO anon,authenticated;
CREATE FUNCTION filmverse_private.person_representatives(p_user uuid) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT coalesce(jsonb_agg(row_to_json(r)),'[]') FROM (
 SELECT id,name,role_type,organization_id,
 CASE WHEN filmverse_private.contact_visible(user_id,contact_visibility) THEN contact ELSE NULL END AS contact
 FROM public.profile_representations WHERE user_id=p_user AND active
 AND filmverse_private.contact_visible(user_id,visibility) ORDER BY created_at,id LIMIT 20) r
$$;
CREATE FUNCTION public.person_representatives(p_user uuid) RETURNS jsonb
LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$ SELECT filmverse_private.person_representatives(p_user) $$;
REVOKE ALL ON FUNCTION filmverse_private.person_representatives(uuid),public.person_representatives(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION filmverse_private.person_representatives(uuid),public.person_representatives(uuid) TO anon,authenticated;
-- Re-admitting a former group member must respect the current invitation policy.
CREATE OR REPLACE FUNCTION filmverse_private.group_invite_privacy_guard() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF TG_OP='UPDATE' AND NOT (OLD.left_at IS NOT NULL AND NEW.left_at IS NULL) THEN RETURN NEW; END IF;
 IF auth.uid() IS NOT NULL AND NEW.user_id<>auth.uid()
 AND EXISTS(SELECT 1 FROM public.chat_rooms WHERE id=NEW.room_id AND kind<>'direct')
 AND NOT filmverse_private.person_contactable(NEW.user_id,'invite') THEN
 RAISE EXCEPTION 'recipient_invite_privacy_denied' USING ERRCODE='42501'; END IF;
 RETURN NEW;
END $$;
DROP TRIGGER group_invite_privacy ON public.chat_members;
CREATE TRIGGER group_invite_privacy BEFORE INSERT OR UPDATE OF left_at ON public.chat_members
 FOR EACH ROW EXECUTE FUNCTION filmverse_private.group_invite_privacy_guard();
COMMIT;
