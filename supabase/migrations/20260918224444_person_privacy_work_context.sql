BEGIN;
SET LOCAL lock_timeout='5s';
CREATE TABLE public.profile_privacy_settings (
 user_id uuid PRIMARY KEY DEFAULT auth.uid() REFERENCES public.profiles(id) ON DELETE CASCADE,
 profile_visibility text NOT NULL DEFAULT 'public' CHECK(profile_visibility IN ('public','members','private')),
 search_discoverable boolean NOT NULL DEFAULT true,
 search_engine_indexable boolean NOT NULL DEFAULT false,
 message_permission text NOT NULL DEFAULT 'members' CHECK(message_permission IN ('members','work_context','none')),
 invite_permission text NOT NULL DEFAULT 'members' CHECK(invite_permission IN ('members','work_context','none')),
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER profile_privacy_updated BEFORE UPDATE ON public.profile_privacy_settings
 FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TABLE public.work_applications (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),work_id uuid NOT NULL REFERENCES public.work_opportunities(id) ON DELETE CASCADE,
 user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES public.profiles(id) ON DELETE CASCADE,
 status text NOT NULL DEFAULT 'applied' CHECK(status IN ('applied','withdrawn')),
 created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(work_id,user_id)
);
CREATE INDEX applications_person_idx ON public.work_applications(user_id,work_id);
CREATE TABLE public.project_members (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
 user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
 status text NOT NULL DEFAULT 'invited' CHECK(status IN ('invited','active','declined','removed')),
 invited_by uuid DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
 created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(project_id,user_id)
);
CREATE INDEX project_members_person_idx ON public.project_members(user_id,project_id) WHERE status='active';
CREATE FUNCTION filmverse_private.work_reviewer(p_work uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT auth.uid() IS NOT NULL AND EXISTS(SELECT 1 FROM public.work_opportunities w WHERE w.id=p_work AND
 ((w.organization_id IS NULL AND w.user_id=auth.uid()) OR filmverse_private.org_can(w.organization_id,'review_applications')))
$$;
CREATE FUNCTION filmverse_private.project_collaborator(p_project uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT auth.uid() IS NOT NULL AND (filmverse_private.project_can(p_project) OR EXISTS(
 SELECT 1 FROM public.project_members WHERE project_id=p_project AND user_id=auth.uid() AND status='active'))
$$;
CREATE FUNCTION filmverse_private.person_work_context(p_user uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT auth.uid() IS NOT NULL AND (
 EXISTS(SELECT 1 FROM public.work_applications a WHERE a.user_id=p_user AND a.status='applied' AND filmverse_private.work_reviewer(a.work_id))
 OR EXISTS(SELECT 1 FROM public.project_members m WHERE m.user_id=p_user AND m.status='active' AND filmverse_private.project_collaborator(m.project_id)))
$$;
CREATE FUNCTION filmverse_private.person_visible(p_user uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT p_user IS NOT NULL AND (p_user=auth.uid() OR
 coalesce((SELECT profile_visibility FROM public.profile_privacy_settings WHERE user_id=p_user),'public')='public'
 OR (auth.uid() IS NOT NULL AND (SELECT profile_visibility FROM public.profile_privacy_settings WHERE user_id=p_user)='members')
 OR filmverse_private.person_work_context(p_user))
$$;
CREATE FUNCTION filmverse_private.person_discoverable(p_user uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT filmverse_private.person_visible(p_user) AND coalesce(
 (SELECT search_discoverable AND profile_visibility<>'private' FROM public.profile_privacy_settings WHERE user_id=p_user),true)
$$;
CREATE FUNCTION public.person_discoverable(p_user uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$ SELECT filmverse_private.person_discoverable(p_user) $$;
CREATE FUNCTION filmverse_private.person_contactable(p_user uuid,p_action text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT auth.uid() IS NOT NULL AND p_user<>auth.uid() AND filmverse_private.person_visible(p_user)
 AND (coalesce((SELECT CASE p_action WHEN 'message' THEN message_permission ELSE invite_permission END
 FROM public.profile_privacy_settings WHERE user_id=p_user),'members')='members'
 OR (coalesce((SELECT CASE p_action WHEN 'message' THEN message_permission ELSE invite_permission END
 FROM public.profile_privacy_settings WHERE user_id=p_user),'members')='work_context' AND filmverse_private.person_work_context(p_user)))
$$;
CREATE FUNCTION public.person_contactable(p_user uuid,p_action text DEFAULT 'message') RETURNS boolean
LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$ SELECT filmverse_private.person_contactable(p_user,p_action) $$;

-- Restrictive guards compose with existing positive-list grants and own writes.
CREATE POLICY profile_viewer_guard ON public.profiles AS RESTRICTIVE FOR SELECT TO anon,authenticated
 USING(filmverse_private.person_visible(id));
CREATE POLICY actor_viewer_guard ON public.actors AS RESTRICTIVE FOR SELECT TO anon,authenticated
 USING(user_id IS NOT NULL AND filmverse_private.person_visible(user_id));
CREATE POLICY actor_insert_owner_guard ON public.actors AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK(user_id=auth.uid());
CREATE POLICY profession_viewer_guard ON public.user_professions AS RESTRICTIVE FOR SELECT TO anon,authenticated
 USING(filmverse_private.person_visible(user_id));
CREATE POLICY skill_viewer_guard ON public.user_skills AS RESTRICTIVE FOR SELECT TO anon,authenticated
 USING(filmverse_private.person_visible(user_id));
CREATE POLICY actor_credit_viewer_guard ON public.actor_projects AS RESTRICTIVE FOR SELECT TO anon,authenticated
 USING(EXISTS(SELECT 1 FROM public.actors a WHERE a.id=actor_id AND filmverse_private.person_visible(a.user_id)));

CREATE TABLE public.profile_contacts (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES public.profiles(id) ON DELETE CASCADE,
 kind text NOT NULL CHECK(kind IN ('email','phone')),value text NOT NULL CHECK(length(btrim(value)) BETWEEN 1 AND 254),
 visibility text NOT NULL DEFAULT 'private' CHECK(visibility IN ('private','work_context','members','public')),
 UNIQUE(user_id,kind)
);
CREATE TABLE public.profile_representations (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES public.profiles(id) ON DELETE CASCADE,
 organization_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL,
 name text NOT NULL CHECK(length(btrim(name)) BETWEEN 1 AND 160),role_type text NOT NULL DEFAULT 'agent',
 contact text,contact_visibility text NOT NULL DEFAULT 'private' CHECK(contact_visibility IN ('private','work_context','members','public')),
 visibility text NOT NULL DEFAULT 'private' CHECK(visibility IN ('private','members','public')),
 active boolean NOT NULL DEFAULT true,created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.profile_media (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES public.profiles(id) ON DELETE CASCADE,
 media_type text NOT NULL CHECK(media_type IN ('headshot','gallery','showreel','video_intro','self_tape','audio')),
 object_path text NOT NULL UNIQUE,
 visibility text NOT NULL DEFAULT 'private' CHECK(visibility IN ('public','members','application_context','project_context','private')),
 application_id uuid REFERENCES public.work_applications(id) ON DELETE CASCADE,
 project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE,
 created_at timestamptz NOT NULL DEFAULT now(),
 CHECK((visibility='application_context')=(application_id IS NOT NULL)),
 CHECK((visibility='project_context')=(project_id IS NOT NULL))
);
CREATE FUNCTION filmverse_private.contact_visible(p_user uuid,p_visibility text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT p_user=auth.uid() OR (filmverse_private.person_visible(p_user) AND
 (p_visibility='public' OR (p_visibility='members' AND auth.uid() IS NOT NULL)
 OR (p_visibility='work_context' AND filmverse_private.person_work_context(p_user))))
$$;
CREATE FUNCTION filmverse_private.media_visible(p_path text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM public.profile_media m WHERE m.object_path=p_path AND (
 m.user_id=auth.uid()
 OR (m.visibility IN ('public','members') AND filmverse_private.contact_visible(m.user_id,m.visibility))
 OR (m.visibility='application_context' AND EXISTS(SELECT 1 FROM public.work_applications a
 WHERE a.id=m.application_id AND a.user_id=m.user_id AND a.status='applied' AND filmverse_private.work_reviewer(a.work_id)))
 OR (m.visibility='project_context' AND filmverse_private.project_collaborator(m.project_id))))
$$;
CREATE FUNCTION filmverse_private.media_owner_context(p_user uuid,p_application uuid,p_project uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT p_user=auth.uid()
 AND (p_application IS NULL OR EXISTS(SELECT 1 FROM public.work_applications WHERE id=p_application AND user_id=auth.uid() AND status='applied'))
 AND (p_project IS NULL OR filmverse_private.project_collaborator(p_project))
$$;
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['profile_privacy_settings','work_applications','project_members','profile_contacts','profile_representations','profile_media'] LOOP
 EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
 EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC,anon,authenticated',t);
 EXECUTE format('GRANT SELECT,INSERT,UPDATE,DELETE ON public.%I TO service_role',t);
 END LOOP;
END $$;
GRANT SELECT,INSERT(user_id,profile_visibility,search_discoverable,search_engine_indexable,message_permission,invite_permission),
 UPDATE(profile_visibility,search_discoverable,search_engine_indexable,message_permission,invite_permission)
 ON public.profile_privacy_settings TO authenticated;
CREATE POLICY privacy_owner ON public.profile_privacy_settings FOR ALL TO authenticated USING(user_id=auth.uid()) WITH CHECK(user_id=auth.uid());
GRANT SELECT,INSERT(work_id),UPDATE(status) ON public.work_applications TO authenticated;
CREATE POLICY application_read ON public.work_applications FOR SELECT TO authenticated USING(user_id=auth.uid() OR filmverse_private.work_reviewer(work_id));
CREATE POLICY application_apply ON public.work_applications FOR INSERT TO authenticated WITH CHECK(user_id=auth.uid() AND status='applied'
 AND EXISTS(SELECT 1 FROM public.work_opportunities WHERE id=work_id));
CREATE POLICY application_withdraw ON public.work_applications FOR UPDATE TO authenticated USING(user_id=auth.uid()) WITH CHECK(user_id=auth.uid() AND status='withdrawn');
GRANT SELECT,INSERT(project_id,user_id) ON public.project_members TO authenticated;
CREATE POLICY project_member_read ON public.project_members FOR SELECT TO authenticated USING(user_id=auth.uid() OR filmverse_private.project_can(project_id));
CREATE POLICY project_member_invite ON public.project_members FOR INSERT TO authenticated
 WITH CHECK(status='invited' AND filmverse_private.project_can(project_id) AND filmverse_private.person_contactable(user_id,'invite'));
GRANT SELECT,INSERT(user_id,kind,value,visibility),UPDATE(kind,value,visibility),DELETE ON public.profile_contacts TO authenticated;
GRANT SELECT ON public.profile_contacts TO anon;
CREATE POLICY contact_read ON public.profile_contacts FOR SELECT TO anon,authenticated USING(filmverse_private.contact_visible(user_id,visibility));
CREATE POLICY contact_write ON public.profile_contacts FOR ALL TO authenticated USING(user_id=auth.uid()) WITH CHECK(user_id=auth.uid());
GRANT SELECT,INSERT(user_id,organization_id,name,role_type,contact,contact_visibility,visibility,active),
 UPDATE(organization_id,name,role_type,contact,contact_visibility,visibility,active),DELETE ON public.profile_representations TO authenticated;
CREATE POLICY representation_owner ON public.profile_representations FOR ALL TO authenticated USING(user_id=auth.uid()) WITH CHECK(user_id=auth.uid());
GRANT SELECT,INSERT(user_id,media_type,object_path,visibility,application_id,project_id),
 UPDATE(media_type,visibility,application_id,project_id),DELETE ON public.profile_media TO authenticated;
GRANT SELECT ON public.profile_media TO anon;
CREATE POLICY media_read ON public.profile_media FOR SELECT TO anon,authenticated USING(filmverse_private.media_visible(object_path));
CREATE POLICY media_owner ON public.profile_media FOR ALL TO authenticated USING(user_id=auth.uid())
 WITH CHECK(user_id=auth.uid() AND split_part(object_path,'/',1)=auth.uid()::text
 AND filmverse_private.media_owner_context(user_id,application_id,project_id));
INSERT INTO storage.buckets(id,name,public) VALUES('profile-media','profile-media',false) ON CONFLICT(id) DO NOTHING;
CREATE POLICY professional_media_read ON storage.objects FOR SELECT TO anon,authenticated
 USING(bucket_id='profile-media' AND filmverse_private.media_visible(name));
CREATE POLICY professional_media_insert ON storage.objects FOR INSERT TO authenticated
 WITH CHECK(bucket_id='profile-media' AND (storage.foldername(name))[1]=auth.uid()::text);
CREATE POLICY professional_media_delete ON storage.objects FOR DELETE TO authenticated
 USING(bucket_id='profile-media' AND (storage.foldername(name))[1]=auth.uid()::text);

CREATE FUNCTION filmverse_private.project_membership_reply(p_member uuid,p_status text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE member public.project_members;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication_required' USING ERRCODE='42501'; END IF;
 SELECT * INTO member FROM public.project_members WHERE id=p_member FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'not_found' USING ERRCODE='42501'; END IF;
 IF p_status IN ('active','declined') THEN
 IF member.user_id<>auth.uid() OR member.status<>'invited' THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
 ELSIF p_status='removed' THEN
 IF member.user_id<>auth.uid() AND NOT filmverse_private.project_can(member.project_id) THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
 ELSE RAISE EXCEPTION 'invalid_status' USING ERRCODE='22023'; END IF;
 UPDATE public.project_members SET status=p_status WHERE id=p_member;
END $$;
CREATE FUNCTION public.project_membership_reply(p_member uuid,p_status text) RETURNS void
LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT filmverse_private.project_membership_reply(p_member,p_status) $$;

CREATE FUNCTION filmverse_private.person_public(p_slug text) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT jsonb_build_object('id',p.id,'full_name',p.full_name,'public_slug',p.public_slug,'city',p.city,
 'country',p.country,'gender',p.gender,'avatar_url',p.avatar_url,'about',p.about,
 'availability_status',p.availability_status,'created_at',p.created_at,'updated_at',p.updated_at,
 'search_engine_indexable',coalesce((SELECT s.search_engine_indexable AND s.profile_visibility='public' FROM public.profile_privacy_settings s WHERE s.user_id=p.id),false))
 FROM public.profiles p WHERE p.public_slug=p_slug AND filmverse_private.person_visible(p.id)
$$;
CREATE FUNCTION public.person_public(p_slug text) RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path=''
 AS $$ SELECT filmverse_private.person_public(p_slug) $$;
-- Database boundary on canonical direct creation; existing conversations remain
-- legitimate history, but privacy can prevent initiating new direct rooms.
CREATE FUNCTION filmverse_private.direct_privacy_guard() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE target uuid;
BEGIN
 IF NEW.kind='direct' AND auth.uid() IS NOT NULL THEN
 target:=CASE WHEN NEW.direct_a=auth.uid() THEN NEW.direct_b ELSE NEW.direct_a END;
 IF NOT filmverse_private.person_contactable(target,'message') THEN RAISE EXCEPTION 'recipient_privacy_denied' USING ERRCODE='42501'; END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER direct_privacy BEFORE INSERT ON public.chat_rooms FOR EACH ROW EXECUTE FUNCTION filmverse_private.direct_privacy_guard();

CREATE FUNCTION filmverse_private.group_invite_privacy_guard() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF auth.uid() IS NOT NULL AND NEW.user_id<>auth.uid()
 AND EXISTS(SELECT 1 FROM public.chat_rooms WHERE id=NEW.room_id AND kind<>'direct')
 AND NOT filmverse_private.person_contactable(NEW.user_id,'invite') THEN
 RAISE EXCEPTION 'recipient_invite_privacy_denied' USING ERRCODE='42501'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER group_invite_privacy BEFORE INSERT ON public.chat_members FOR EACH ROW EXECUTE FUNCTION filmverse_private.group_invite_privacy_guard();
REVOKE ALL ON FUNCTION filmverse_private.group_invite_privacy_guard() FROM PUBLIC,anon,authenticated;

DO $$ DECLARE f record; BEGIN
 FOR f IN SELECT oid::regprocedure signature FROM pg_proc WHERE pronamespace='filmverse_private'::regnamespace
 AND proname IN ('work_reviewer','project_collaborator','person_work_context','person_visible','person_discoverable','person_contactable',
 'contact_visible','media_visible','media_owner_context','project_membership_reply','person_public','direct_privacy_guard') LOOP
 EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated',f.signature);
 IF f.signature::text NOT LIKE '%direct_privacy_guard%' THEN
 EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated,service_role',f.signature); END IF;
 END LOOP;
END $$;
GRANT EXECUTE ON FUNCTION filmverse_private.person_visible(uuid),filmverse_private.person_discoverable(uuid),
 filmverse_private.contact_visible(uuid,text),filmverse_private.media_visible(text),filmverse_private.person_public(text) TO anon;
REVOKE ALL ON FUNCTION public.person_public(text),public.person_discoverable(uuid),public.person_contactable(uuid,text),public.project_membership_reply(uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.person_public(text),public.person_discoverable(uuid) TO anon,authenticated;
GRANT EXECUTE ON FUNCTION public.person_contactable(uuid,text),public.project_membership_reply(uuid,text) TO authenticated;
CREATE FUNCTION filmverse_private.actor_directory(p_city text,p_category text,p_gender text,p_availability text,p_offset int) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT coalesce(jsonb_agg(row_to_json(r)),'[]') FROM (
 SELECT a.id,a.user_id,a.full_name,a.city,a.category,a.gender,a.availability,a.photo_url,a.gallery,
 p.public_slug AS slug,p.avatar_url AS "avatarUrl" FROM public.actors a JOIN public.profiles p ON p.id=a.user_id
 WHERE filmverse_private.person_discoverable(p.id) AND (p_city='' OR a.city=p_city)
 AND (p_category='' OR a.category=p_category) AND (p_gender='' OR a.gender=p_gender)
 AND (p_availability='' OR a.availability=p_availability)
 ORDER BY a.created_at DESC,a.id LIMIT 24 OFFSET greatest(0,least(p_offset,10000))) r
$$;
CREATE FUNCTION public.actor_directory(p_city text DEFAULT '',p_category text DEFAULT '',p_gender text DEFAULT '',p_availability text DEFAULT '',p_offset int DEFAULT 0)
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path=''
AS $$ SELECT filmverse_private.actor_directory(p_city,p_category,p_gender,p_availability,p_offset) $$;
CREATE FUNCTION filmverse_private.professional_directory(p_query text,p_department uuid,p_profession uuid,p_availability text,p_offset int) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT coalesce(jsonb_agg(row_to_json(r)),'[]') FROM (
 SELECT p.id AS "userId",p.public_slug AS slug,p.full_name AS name,p.city,p.avatar_url AS "avatarUrl",
 CASE p.availability_status WHEN 'busy' THEN 'Занят' WHEN 'limited' THEN 'Ограниченно' ELSE 'Свободен' END AS availability,
 pr.id AS "professionId",pr.name AS "professionName",pr.department_id AS "departmentId",up.experience_years AS "experienceYears",
 ARRAY(SELECT s.name FROM public.user_skills us JOIN public.skills s ON s.id=us.skill_id WHERE us.user_id=p.id LIMIT 50) AS skills
 FROM public.profiles p JOIN public.user_professions up ON up.user_id=p.id AND up.is_primary
 JOIN public.professions pr ON pr.id=up.profession_id
 WHERE filmverse_private.person_discoverable(p.id)
 AND (p_department IS NULL OR pr.department_id=p_department) AND (p_profession IS NULL OR pr.id=p_profession)
 AND (p_availability='' OR p.availability_status=p_availability)
 AND (p_query='' OR concat_ws(' ',p.full_name,p.city,pr.name) ILIKE '%'||left(p_query,120)||'%')
 ORDER BY p.full_name,p.id LIMIT 24 OFFSET greatest(0,least(p_offset,10000))) r
$$;
CREATE FUNCTION public.professional_directory(p_query text DEFAULT '',p_department uuid DEFAULT NULL,p_profession uuid DEFAULT NULL,p_availability text DEFAULT '',p_offset int DEFAULT 0)
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path=''
AS $$ SELECT filmverse_private.professional_directory(p_query,p_department,p_profession,p_availability,p_offset) $$;
REVOKE ALL ON FUNCTION filmverse_private.actor_directory(text,text,text,text,int),public.actor_directory(text,text,text,text,int),
 filmverse_private.professional_directory(text,uuid,uuid,text,int),public.professional_directory(text,uuid,uuid,text,int) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION filmverse_private.actor_directory(text,text,text,text,int),public.actor_directory(text,text,text,text,int),
 filmverse_private.professional_directory(text,uuid,uuid,text,int),public.professional_directory(text,uuid,uuid,text,int) TO anon,authenticated;
CREATE FUNCTION filmverse_private.person_recipients(p_query text,p_action text) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT coalesce(jsonb_agg(row_to_json(r)),'[]') FROM (
 SELECT id,full_name,city,avatar_url FROM public.profiles
 WHERE filmverse_private.person_discoverable(id) AND filmverse_private.person_contactable(id,p_action)
 AND (p_query='' OR concat_ws(' ',full_name,city) ILIKE '%'||left(p_query,120)||'%')
 ORDER BY full_name,id LIMIT 24) r
$$;
CREATE FUNCTION public.person_recipients(p_query text DEFAULT '',p_action text DEFAULT 'message') RETURNS jsonb
LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$ SELECT filmverse_private.person_recipients(p_query,p_action) $$;
REVOKE ALL ON FUNCTION filmverse_private.person_recipients(text,text),public.person_recipients(text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION filmverse_private.person_recipients(text,text),public.person_recipients(text,text) TO authenticated;
COMMIT;
