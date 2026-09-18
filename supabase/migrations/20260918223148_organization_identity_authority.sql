BEGIN;
SET LOCAL lock_timeout = '5s';
CREATE SCHEMA IF NOT EXISTS filmverse_private;
REVOKE ALL ON SCHEMA filmverse_private FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA filmverse_private TO anon, authenticated, service_role;

CREATE TABLE public.organization_types (
  key text PRIMARY KEY, label text NOT NULL
);
INSERT INTO public.organization_types VALUES
 ('production_company','Продакшн'),('rental_house','Рентал'),('agency','Агентство'),
 ('casting_agency','Кастинг-агентство'),('studio','Студия'),('post_production','Постпродакшн'),
 ('service_company','Сервисная компания'),('education','Киношкола / образовательная организация'),('other','Другое');
-- Preserve legacy custom taxonomy values rather than renaming or discarding them.
INSERT INTO public.organization_types SELECT DISTINCT organization_type,organization_type
 FROM public.organizations ON CONFLICT DO NOTHING;
ALTER TABLE public.organizations
 ADD CONSTRAINT organization_type_key FOREIGN KEY(organization_type) REFERENCES public.organization_types(key),
 ADD COLUMN cover_url text,
 ADD COLUMN service_geography text[] NOT NULL DEFAULT '{}',
 ADD COLUMN specialties text[] NOT NULL DEFAULT '{}',
 ADD COLUMN social_links jsonb NOT NULL DEFAULT '{}' CHECK(jsonb_typeof(social_links)='object'),
 ADD COLUMN founded_year int CHECK(founded_year BETWEEN 1800 AND 2200),
 ADD COLUMN visibility text NOT NULL DEFAULT 'public' CHECK(visibility IN ('public','members_only','unlisted')),
 ADD COLUMN search_engine_indexable boolean NOT NULL DEFAULT false;
-- Creator is provenance, never permanent authority; deleting a person must not
-- cascade into a company's identity or organization-owned content.
ALTER TABLE public.organizations DROP CONSTRAINT organizations_created_by_fkey;
ALTER TABLE public.organizations ALTER COLUMN created_by DROP NOT NULL;
ALTER TABLE public.organizations ADD CONSTRAINT organizations_created_by_fkey
 FOREIGN KEY(created_by) REFERENCES auth.users(id) ON DELETE SET NULL;
CREATE INDEX organizations_discovery_idx ON public.organizations(organization_type,city,id) WHERE visibility='public';

CREATE TABLE public.organization_roles(key text PRIMARY KEY,label text NOT NULL);
INSERT INTO public.organization_roles VALUES ('owner','Владелец'),('admin','Администратор'),
 ('producer','Продюсер / руководитель проекта'),('hiring_manager','Менеджер найма'),
 ('casting_manager','Кастинг-менеджер'),('rental_manager','Рентал-менеджер'),
 ('marketing','Маркетинг'),('finance','Финансы'),('member','Участник');
INSERT INTO public.organization_roles SELECT DISTINCT role,role FROM public.organization_members ON CONFLICT DO NOTHING;
CREATE TABLE public.organization_role_permissions (
 role_key text REFERENCES public.organization_roles(key), permission text NOT NULL,
 PRIMARY KEY(role_key,permission)
);
INSERT INTO public.organization_role_permissions
SELECT role_key,permission FROM unnest(ARRAY['owner','admin']) role_key
CROSS JOIN unnest(ARRAY['manage_organization','manage_members','manage_projects','publish_jobs',
 'review_applications','manage_casting','manage_inventory','manage_marketplace',
 'manage_promotions','view_analytics','manage_inbox']) permission;
INSERT INTO public.organization_role_permissions VALUES
 ('owner','manage_billing'),('producer','manage_projects'),('producer','publish_jobs'),
 ('producer','review_applications'),('hiring_manager','publish_jobs'),('hiring_manager','review_applications'),
 ('casting_manager','manage_casting'),('casting_manager','publish_jobs'),('casting_manager','review_applications'),
 ('rental_manager','manage_inventory'),('rental_manager','manage_marketplace'),
 ('marketing','manage_promotions'),('marketing','view_analytics'),('finance','manage_billing');

ALTER TABLE public.organization_members
 ADD COLUMN active boolean NOT NULL DEFAULT true,
 ADD COLUMN public_visible boolean NOT NULL DEFAULT false,
 ADD CONSTRAINT organization_members_role_key FOREIGN KEY(role) REFERENCES public.organization_roles(key);
-- Duplicate historical memberships require review, never destructive dedupe.
CREATE UNIQUE INDEX organization_members_identity_key ON public.organization_members(organization_id,user_id);
CREATE INDEX organization_members_user_active_idx ON public.organization_members(user_id,organization_id) WHERE active;
-- The old creator authority is materialized once; existing IDs and rows survive.
INSERT INTO public.organization_members(organization_id,user_id,role)
 SELECT o.id,o.created_by,'owner' FROM public.organizations o WHERE o.created_by IS NOT NULL
 AND NOT EXISTS(SELECT 1 FROM public.organization_members m WHERE m.organization_id=o.id AND m.user_id=o.created_by);
UPDATE public.organization_members m SET role='owner'
 FROM public.organizations o WHERE o.id=m.organization_id AND o.created_by=m.user_id
 AND NOT EXISTS(SELECT 1 FROM public.organization_members x WHERE x.organization_id=o.id AND x.role='owner' AND x.active);
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM public.organizations o WHERE NOT EXISTS(
 SELECT 1 FROM public.organization_members m WHERE m.organization_id=o.id AND m.active AND m.role='owner'))
 THEN RAISE EXCEPTION 'ownerless_legacy_organization_requires_review'; END IF;
END $$;

CREATE FUNCTION filmverse_private.org_member(p_org uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT auth.uid() IS NOT NULL AND EXISTS(SELECT 1 FROM public.organization_members
 WHERE organization_id=p_org AND user_id=auth.uid() AND active)
$$;
CREATE FUNCTION filmverse_private.org_can(p_org uuid,p_permission text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT auth.uid() IS NOT NULL AND EXISTS(
 SELECT 1 FROM public.organization_members m JOIN public.organization_role_permissions r ON r.role_key=m.role
 WHERE m.organization_id=p_org AND m.user_id=auth.uid() AND m.active AND r.permission=p_permission)
$$;
CREATE FUNCTION filmverse_private.org_owner(p_org uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT auth.uid() IS NOT NULL AND EXISTS(SELECT 1 FROM public.organization_members
 WHERE organization_id=p_org AND user_id=auth.uid() AND active AND role='owner')
$$;

CREATE TABLE public.organization_audit_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
 actor_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,action text NOT NULL,
 subject_id uuid,created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX organization_audit_recent_idx ON public.organization_audit_events(organization_id,created_at DESC);
CREATE TABLE public.organization_invitations (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
 invited_email text NOT NULL CHECK(length(invited_email) BETWEEN 3 AND 254 AND invited_email=lower(btrim(invited_email))),
 role_key text NOT NULL REFERENCES public.organization_roles(key) CHECK(role_key<>'owner'),
 invited_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','accepted','declined','expired','revoked')),
 expires_at timestamptz NOT NULL DEFAULT(now()+interval '7 days'),
 accepted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX organization_invites_pending_idx ON public.organization_invitations(organization_id,invited_email) WHERE status='pending';
-- No public bearer token: acceptance binds to the authenticated account's
-- current, confirmed email in auth.users, never user_metadata/browser email.

CREATE FUNCTION filmverse_private.organization_create(p_name text,p_slug text,p_type text) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE result uuid;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication_required' USING ERRCODE='42501'; END IF;
 IF length(btrim(p_name)) NOT BETWEEN 2 AND 160 OR p_slug !~ '^[a-z0-9][a-z0-9-]{2,79}$'
 THEN RAISE EXCEPTION 'invalid_company_input' USING ERRCODE='22023'; END IF;
 INSERT INTO public.organizations(name,slug,organization_type,created_by)
 VALUES(btrim(p_name),p_slug,p_type,auth.uid()) RETURNING id INTO result;
 INSERT INTO public.organization_members(organization_id,user_id,role) VALUES(result,auth.uid(),'owner');
 INSERT INTO public.organization_audit_events(organization_id,actor_user_id,action) VALUES(result,auth.uid(),'organization_created');
 RETURN result;
END $$;
CREATE FUNCTION public.organization_create(p_name text,p_slug text,p_type text) RETURNS uuid
LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT filmverse_private.organization_create(p_name,p_slug,p_type) $$;

CREATE FUNCTION filmverse_private.organization_member_change(p_org uuid,p_user uuid,p_role text,p_active boolean) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE previous public.organization_members; self_leave boolean;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication_required' USING ERRCODE='42501'; END IF;
 PERFORM 1 FROM public.organizations WHERE id=p_org FOR UPDATE;
 SELECT * INTO previous FROM public.organization_members WHERE organization_id=p_org AND user_id=p_user;
 IF NOT FOUND THEN RAISE EXCEPTION 'member_not_found' USING ERRCODE='42501'; END IF;
 self_leave := p_user=auth.uid() AND NOT p_active AND p_role=previous.role;
 IF NOT self_leave AND NOT filmverse_private.org_can(p_org,'manage_members')
 THEN RAISE EXCEPTION 'membership_permission_required' USING ERRCODE='42501'; END IF;
 IF NOT self_leave AND (p_role IN ('owner','admin','finance') OR previous.role IN ('owner','admin','finance'))
 AND NOT filmverse_private.org_owner(p_org)
 THEN RAISE EXCEPTION 'owner_required_for_privileged_role' USING ERRCODE='42501'; END IF;
 IF p_role='owner' AND p_user=auth.uid() AND previous.role<>'owner'
 THEN RAISE EXCEPTION 'self_promotion_denied' USING ERRCODE='42501'; END IF;
 IF previous.role='owner' AND previous.active AND (NOT p_active OR p_role<>'owner')
 AND NOT EXISTS(SELECT 1 FROM public.organization_members WHERE organization_id=p_org AND user_id<>p_user AND role='owner' AND active)
 THEN RAISE EXCEPTION 'last_owner_cannot_leave' USING ERRCODE='42501'; END IF;
 -- Reactivation requires a new invitation/acceptance, not silent forced membership.
 IF NOT previous.active AND p_active THEN RAISE EXCEPTION 'invitation_required' USING ERRCODE='42501'; END IF;
 UPDATE public.organization_members SET role=p_role,active=p_active,public_visible=CASE WHEN p_active THEN public_visible ELSE false END
 WHERE id=previous.id;
 UPDATE public.organization_invitations SET status='revoked'
 WHERE organization_id=p_org AND invited_by=p_user AND status='pending';
 INSERT INTO public.organization_audit_events(organization_id,actor_user_id,action,subject_id)
 VALUES(p_org,auth.uid(),CASE WHEN p_active THEN 'member_role_changed' ELSE 'member_removed' END,p_user);
END $$;
CREATE FUNCTION public.organization_member_change(p_org uuid,p_user uuid,p_role text,p_active boolean) RETURNS void
LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT filmverse_private.organization_member_change(p_org,p_user,p_role,p_active) $$;

CREATE FUNCTION filmverse_private.organization_invite(p_org uuid,p_email text,p_role text) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE result uuid;
BEGIN
 PERFORM 1 FROM public.organizations WHERE id=p_org FOR UPDATE;
 IF NOT filmverse_private.org_can(p_org,'manage_members') THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
 IF p_role='owner' OR (p_role IN ('admin','finance') AND NOT filmverse_private.org_owner(p_org))
 THEN RAISE EXCEPTION 'privileged_invite_denied' USING ERRCODE='42501'; END IF;
 IF p_email IS NULL OR p_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
 THEN RAISE EXCEPTION 'invalid_email' USING ERRCODE='22023'; END IF;
 UPDATE public.organization_invitations SET status='expired' WHERE organization_id=p_org AND status='pending' AND expires_at<=now();
 INSERT INTO public.organization_invitations(organization_id,invited_email,role_key,invited_by)
 VALUES(p_org,lower(btrim(p_email)),p_role,auth.uid()) RETURNING id INTO result;
 INSERT INTO public.organization_audit_events(organization_id,actor_user_id,action,subject_id) VALUES(p_org,auth.uid(),'member_invited',result);
 RETURN result;
END $$;
CREATE FUNCTION public.organization_invite(p_org uuid,p_email text,p_role text) RETURNS uuid
LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT filmverse_private.organization_invite(p_org,p_email,p_role) $$;

CREATE FUNCTION filmverse_private.organization_invitation_reply(p_invite uuid,p_action text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE invitation public.organization_invitations; account_email text; org uuid;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication_required' USING ERRCODE='42501'; END IF;
 SELECT organization_id INTO org FROM public.organization_invitations WHERE id=p_invite;
 PERFORM 1 FROM public.organizations WHERE id=org FOR UPDATE;
 SELECT * INTO invitation FROM public.organization_invitations WHERE id=p_invite FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'invitation_unavailable' USING ERRCODE='42501'; END IF;
 IF p_action='revoke' THEN
   IF NOT filmverse_private.org_can(org,'manage_members') THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
 ELSE
   SELECT lower(email) INTO account_email FROM auth.users WHERE id=auth.uid() AND email_confirmed_at IS NOT NULL;
   IF account_email IS NULL OR account_email<>invitation.invited_email THEN RAISE EXCEPTION 'invitation_unavailable' USING ERRCODE='42501'; END IF;
 END IF;
 IF invitation.status='accepted' AND invitation.accepted_by=auth.uid() AND p_action='accept' THEN RETURN; END IF;
 IF invitation.status<>'pending' THEN RAISE EXCEPTION 'invitation_unavailable' USING ERRCODE='42501'; END IF;
 IF invitation.expires_at<=now() THEN
   UPDATE public.organization_invitations SET status='expired' WHERE id=p_invite; RETURN;
 END IF;
 IF p_action='accept' THEN
   INSERT INTO public.organization_members(organization_id,user_id,role) VALUES(org,auth.uid(),invitation.role_key)
   ON CONFLICT(organization_id,user_id) DO UPDATE SET active=true,role=CASE
     WHEN organization_members.active THEN organization_members.role ELSE EXCLUDED.role END;
   UPDATE public.organization_invitations SET status='accepted',accepted_by=auth.uid() WHERE id=p_invite;
 ELSIF p_action IN ('decline','revoke') THEN
   UPDATE public.organization_invitations SET status=CASE p_action WHEN 'decline' THEN 'declined' ELSE 'revoked' END WHERE id=p_invite;
 ELSE RAISE EXCEPTION 'invalid_action' USING ERRCODE='22023'; END IF;
 INSERT INTO public.organization_audit_events(organization_id,actor_user_id,action,subject_id) VALUES(org,auth.uid(),'invitation_'||p_action,p_invite);
END $$;
CREATE FUNCTION public.organization_invitation_reply(p_invite uuid,p_action text) RETURNS void
LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT filmverse_private.organization_invitation_reply(p_invite,p_action) $$;

CREATE FUNCTION filmverse_private.invitation_recipient(p_email text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT auth.uid() IS NOT NULL AND EXISTS(SELECT 1 FROM auth.users WHERE id=auth.uid()
 AND email_confirmed_at IS NOT NULL AND lower(email)=p_email)
$$;

CREATE FUNCTION filmverse_private.protect_last_owner() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 -- Account deletion also must not leave an organization ownerless.
 PERFORM 1 FROM public.organizations WHERE id=OLD.organization_id FOR UPDATE;
 IF FOUND AND OLD.active AND OLD.role='owner' AND NOT EXISTS(
 SELECT 1 FROM public.organization_members WHERE organization_id=OLD.organization_id
 AND id<>OLD.id AND active AND role='owner') THEN
 RAISE EXCEPTION 'transfer_organization_before_deleting_last_owner' USING ERRCODE='42501';
 END IF;
 RETURN OLD;
END $$;
CREATE TRIGGER organization_last_owner_delete BEFORE DELETE ON public.organization_members
 FOR EACH ROW EXECUTE FUNCTION filmverse_private.protect_last_owner();

-- Never expose the entire raw company/member record through public REST.
DO $$ DECLARE t text;p record; BEGIN
 FOREACH t IN ARRAY ARRAY['organizations','organization_members','organization_types','organization_roles',
 'organization_role_permissions','organization_invitations','organization_audit_events'] LOOP
 EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
 EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC,anon,authenticated',t);
 EXECUTE format('GRANT SELECT,INSERT,UPDATE,DELETE ON public.%I TO service_role',t);
 FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename=t LOOP
 EXECUTE format('DROP POLICY %I ON public.%I',p.policyname,t); END LOOP;
 END LOOP;
END $$;
GRANT SELECT ON public.organization_types,public.organization_roles,public.organization_role_permissions TO authenticated;
GRANT SELECT ON public.organization_types TO anon;
CREATE POLICY types_read ON public.organization_types FOR SELECT USING(true);
CREATE POLICY roles_read ON public.organization_roles FOR SELECT TO authenticated USING(true);
CREATE POLICY role_permissions_read ON public.organization_role_permissions FOR SELECT TO authenticated USING(true);
GRANT SELECT ON public.organizations,public.organization_members TO authenticated;
CREATE POLICY company_member_read ON public.organizations FOR SELECT TO authenticated USING(filmverse_private.org_member(id));
CREATE POLICY roster_read ON public.organization_members FOR SELECT TO authenticated USING(
 user_id=auth.uid() OR filmverse_private.org_can(organization_id,'manage_members'));
GRANT UPDATE(name,description,logo_url,cover_url,city,website,service_geography,specialties,social_links,founded_year,visibility,search_engine_indexable,organization_type)
 ON public.organizations TO authenticated;
CREATE POLICY company_edit ON public.organizations FOR UPDATE TO authenticated
 USING(filmverse_private.org_can(id,'manage_organization')) WITH CHECK(filmverse_private.org_can(id,'manage_organization'));
GRANT UPDATE(public_visible) ON public.organization_members TO authenticated;
CREATE POLICY member_consent ON public.organization_members FOR UPDATE TO authenticated
 USING(user_id=auth.uid() AND active) WITH CHECK(user_id=auth.uid() AND active);
GRANT SELECT ON public.organization_invitations,public.organization_audit_events TO authenticated;
CREATE POLICY invites_read ON public.organization_invitations FOR SELECT TO authenticated
 USING(filmverse_private.org_can(organization_id,'manage_members') OR filmverse_private.invitation_recipient(invited_email));
CREATE POLICY audit_read ON public.organization_audit_events FOR SELECT TO authenticated USING(filmverse_private.org_can(organization_id,'manage_members'));

CREATE FUNCTION filmverse_private.company_public(p_slug text) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT jsonb_build_object('id',o.id,'slug',o.slug,'name',o.name,'organization_type',o.organization_type,
 'description',o.description,'city',o.city,'website',o.website,'logo_url',o.logo_url,'cover_url',o.cover_url,
 'service_geography',o.service_geography,'specialties',o.specialties,'social_links',o.social_links,
 'founded_year',o.founded_year,'search_engine_indexable',o.search_engine_indexable,
 'verified',EXISTS(SELECT 1 FROM public.verification_records v WHERE v.organization_id=o.id AND v.status='approved'))
 FROM public.organizations o WHERE o.slug=p_slug AND (o.visibility IN ('public','unlisted') OR filmverse_private.org_member(o.id))
$$;
CREATE FUNCTION public.company_public(p_slug text) RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path=''
AS $$ SELECT filmverse_private.company_public(p_slug) $$;
CREATE FUNCTION filmverse_private.company_search(p_query text,p_type text,p_city text,p_offset int) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT coalesce(jsonb_agg(row_to_json(r)),'[]') FROM (
 SELECT id,slug,name,organization_type,city,logo_url,description FROM public.organizations
 WHERE visibility='public' AND (p_query='' OR name ILIKE '%'||left(p_query,120)||'%')
 AND (p_type='' OR organization_type=p_type) AND (p_city='' OR city=p_city)
 ORDER BY name,id LIMIT 24 OFFSET greatest(0,least(p_offset,10000))) r
$$;
CREATE FUNCTION public.company_search(p_query text DEFAULT '',p_type text DEFAULT '',p_city text DEFAULT '',p_offset int DEFAULT 0)
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path=''
AS $$ SELECT filmverse_private.company_search(p_query,p_type,p_city,p_offset) $$;
-- Explicit per-function privileges, including default PUBLIC revocation.
DO $$ DECLARE f record; BEGIN
 FOR f IN SELECT oid::regprocedure AS signature FROM pg_proc WHERE pronamespace='filmverse_private'::regnamespace LOOP
 EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated',f.signature);
 EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated,service_role',f.signature);
 END LOOP;
 FOR f IN SELECT oid::regprocedure AS signature FROM pg_proc WHERE pronamespace='public'::regnamespace
 AND proname IN ('organization_create','organization_member_change','organization_invite','organization_invitation_reply','company_public','company_search') LOOP
 EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated',f.signature);
 EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated,service_role',f.signature);
 END LOOP;
END $$;
GRANT EXECUTE ON FUNCTION filmverse_private.org_member(uuid),filmverse_private.company_public(text),
 filmverse_private.company_search(text,text,text,int),public.company_public(text),public.company_search(text,text,text,int) TO anon;
REVOKE ALL ON FUNCTION filmverse_private.protect_last_owner() FROM PUBLIC,anon,authenticated;
COMMIT;
