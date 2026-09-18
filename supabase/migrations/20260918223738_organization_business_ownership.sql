BEGIN;
SET LOCAL lock_timeout='5s';
CREATE FUNCTION filmverse_private.org_public(p_org uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM public.organizations WHERE id=p_org AND visibility IN ('public','unlisted'))
$$;
-- user_id remains the compatibility provenance/personal-owner field. Company
-- authority is ALWAYS organization membership, never this creator field.
CREATE FUNCTION filmverse_private.content_owner_guard() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF TG_OP='UPDATE' AND (NEW.organization_id IS DISTINCT FROM OLD.organization_id
 OR (NEW.user_id IS DISTINCT FROM OLD.user_id AND NOT (
 NEW.user_id IS NULL AND OLD.organization_id IS NOT NULL AND
 NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=OLD.user_id)))) THEN
 RAISE EXCEPTION 'ownership_transfer_requires_reviewed_server_path' USING ERRCODE='42501';
 END IF;
 IF NEW.organization_id IS NOT NULL AND auth.uid() IS NOT NULL THEN
 PERFORM 1 FROM public.organizations WHERE id=NEW.organization_id FOR UPDATE;
 IF NOT filmverse_private.org_can(NEW.organization_id,TG_ARGV[0]) THEN
 RAISE EXCEPTION 'organization_permission_required' USING ERRCODE='42501'; END IF;
 END IF;
 RETURN NEW;
END $$;
DO $$ DECLARE t text;permission text;p record; BEGIN
 FOREACH t IN ARRAY ARRAY['projects','work_opportunities','marketplace_listings'] LOOP
 permission:=CASE t WHEN 'projects' THEN 'manage_projects' WHEN 'work_opportunities' THEN 'publish_jobs' ELSE 'manage_marketplace' END;
 EXECUTE format('ALTER TABLE public.%I ADD COLUMN organization_id uuid REFERENCES public.organizations(id) ON DELETE RESTRICT',t);
 EXECUTE format('ALTER TABLE public.%I ADD COLUMN created_by_user_id uuid GENERATED ALWAYS AS (user_id) STORED',t);
 EXECUTE format('ALTER TABLE public.%I ADD COLUMN visibility text NOT NULL DEFAULT ''public'' CHECK(visibility IN (''public'',''unlisted'',''private''))',t);
 EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT %I',t,t||'_user_id_fkey');
 EXECUTE format('ALTER TABLE public.%I ALTER COLUMN user_id DROP NOT NULL',t);
 EXECUTE format('ALTER TABLE public.%I ADD CONSTRAINT %I FOREIGN KEY(user_id) REFERENCES public.profiles(id) ON DELETE SET NULL',t,t||'_user_id_fkey');
 EXECUTE format('ALTER TABLE public.%I ADD CONSTRAINT %I CHECK(organization_id IS NOT NULL OR user_id IS NOT NULL)',t,t||'_owner_required');
 EXECUTE format('CREATE INDEX %I ON public.%I(organization_id,created_at DESC)',t||'_organization_idx',t);
 FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename=t LOOP
 EXECUTE format('DROP POLICY %I ON public.%I',p.policyname,t); END LOOP;
 EXECUTE format('CREATE POLICY content_read ON public.%I FOR SELECT TO anon,authenticated USING (
 (visibility IN (''public'',''unlisted'') AND (organization_id IS NULL OR filmverse_private.org_public(organization_id)))
 OR (organization_id IS NULL AND user_id=auth.uid()) OR filmverse_private.org_can(organization_id,%L))',t,permission);
 EXECUTE format('CREATE POLICY content_insert ON public.%I FOR INSERT TO authenticated WITH CHECK (
 user_id=auth.uid() AND (organization_id IS NULL OR filmverse_private.org_can(organization_id,%L)))',t,permission);
 EXECUTE format('CREATE POLICY content_update ON public.%I FOR UPDATE TO authenticated USING (
 (organization_id IS NULL AND user_id=auth.uid()) OR filmverse_private.org_can(organization_id,%L))
 WITH CHECK ((organization_id IS NULL AND user_id=auth.uid()) OR filmverse_private.org_can(organization_id,%L))',t,permission,permission);
 EXECUTE format('CREATE POLICY content_delete ON public.%I FOR DELETE TO authenticated USING (
 (organization_id IS NULL AND user_id=auth.uid()) OR filmverse_private.org_can(organization_id,%L))',t,permission);
 EXECUTE format('CREATE TRIGGER content_ownership BEFORE INSERT OR UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION filmverse_private.content_owner_guard(%L)',t,permission);
 END LOOP;
END $$;

CREATE FUNCTION filmverse_private.project_can(p_project uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT auth.uid() IS NOT NULL AND EXISTS(SELECT 1 FROM public.projects WHERE id=p_project AND
 ((organization_id IS NULL AND user_id=auth.uid()) OR filmverse_private.org_can(organization_id,'manage_projects')))
$$;
CREATE TABLE public.project_organizations (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
 organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
 relationship_type text NOT NULL CHECK(relationship_type IN ('client','agency','production_company','co_producer','casting_agency','rental_partner','post_partner','service_vendor','distribution_partner','other')),
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','accepted','declined','ended')),
 created_by uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE RESTRICT,
 created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(project_id,organization_id,relationship_type)
);
CREATE INDEX project_organizations_org_idx ON public.project_organizations(organization_id,project_id);
CREATE TABLE public.organization_briefs (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
 created_by uuid DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
 title text NOT NULL CHECK(length(btrim(title)) BETWEEN 2 AND 200), description text NOT NULL DEFAULT '' CHECK(length(description)<=20000),
 project_type text,city text,dates text,
 budget_visibility text NOT NULL DEFAULT 'private' CHECK(budget_visibility IN ('private','invited','public')),
 confidential_budget text,
 status text NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','active','awarded','closed','cancelled')),
 visibility text NOT NULL DEFAULT 'private' CHECK(visibility IN ('private','invited','public')),
 created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.organization_inventory_items (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
 created_by uuid DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
 category text NOT NULL,subcategory text,brand text,model text,custom_name text NOT NULL CHECK(length(btrim(custom_name)) BETWEEN 1 AND 160),
 description text,quantity int NOT NULL DEFAULT 1 CHECK(quantity BETWEEN 0 AND 100000),
 condition text, replacement_value numeric CHECK(replacement_value>=0),city text,active boolean NOT NULL DEFAULT true,
 attributes jsonb NOT NULL DEFAULT '{}' CHECK(jsonb_typeof(attributes)='object' AND octet_length(attributes::text)<=8192),
 created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(organization_id,id)
);
CREATE INDEX inventory_category_idx ON public.organization_inventory_items(organization_id,category) WHERE active;
CREATE TABLE public.equipment_packages (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
 created_by uuid DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
 name text NOT NULL CHECK(length(btrim(name)) BETWEEN 2 AND 160),description text,
 active boolean NOT NULL DEFAULT true,created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(organization_id,id)
);
CREATE TABLE public.equipment_package_items (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
 package_id uuid NOT NULL, inventory_item_id uuid NOT NULL,
 requirement text NOT NULL DEFAULT 'required' CHECK(requirement IN ('required','optional')),
 quantity int NOT NULL DEFAULT 1 CHECK(quantity BETWEEN 1 AND 100000),
 FOREIGN KEY(organization_id,package_id) REFERENCES public.equipment_packages(organization_id,id) ON DELETE CASCADE,
 FOREIGN KEY(organization_id,inventory_item_id) REFERENCES public.organization_inventory_items(organization_id,id) ON DELETE RESTRICT,
 UNIQUE(package_id,inventory_item_id)
);
ALTER TABLE public.marketplace_listings
 ADD COLUMN inventory_item_id uuid,
 ADD COLUMN equipment_package_id uuid,
 ADD CONSTRAINT listing_inventory_owner FOREIGN KEY(organization_id,inventory_item_id) REFERENCES public.organization_inventory_items(organization_id,id),
 ADD CONSTRAINT listing_package_owner FOREIGN KEY(organization_id,equipment_package_id) REFERENCES public.equipment_packages(organization_id,id),
 ADD CONSTRAINT listing_single_source CHECK(NOT(inventory_item_id IS NOT NULL AND equipment_package_id IS NOT NULL)),
 ADD CONSTRAINT listing_source_org CHECK((inventory_item_id IS NULL AND equipment_package_id IS NULL) OR organization_id IS NOT NULL);

CREATE TABLE public.organization_entitlements (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
 entitlement_code text NOT NULL CHECK(entitlement_code IN ('organization_pro','featured_company','promoted_job','promoted_listing','campaign_credit','additional_seat')),
 source text NOT NULL CHECK(source IN ('subscription','one_time','admin','test')),
 source_reference text,status text NOT NULL DEFAULT 'active' CHECK(status IN ('active','revoked')),
 starts_at timestamptz NOT NULL DEFAULT now(),expires_at timestamptz,
 remaining_uses int CHECK(remaining_uses>=0),created_at timestamptz NOT NULL DEFAULT now(),
 CHECK(expires_at IS NULL OR expires_at>starts_at),
 CHECK(source NOT IN ('subscription','one_time') OR source_reference IS NOT NULL),
 UNIQUE(source,source_reference,entitlement_code)
);
CREATE TABLE public.advertising_products (
 code text PRIMARY KEY,label text NOT NULL,active boolean NOT NULL DEFAULT false
);
INSERT INTO public.advertising_products(code,label) VALUES ('featured_company','Компания в фокусе'),
 ('promoted_job','Продвижение вакансии'),('promoted_listing','Продвижение объявления'),
 ('promoted_project','Продвижение проекта / кастинга'),('brand_campaign','Кампания бренда');
CREATE FUNCTION filmverse_private.valid_professional_targeting(value jsonb) RETURNS boolean
LANGUAGE sql IMMUTABLE SET search_path='' AS $$
 SELECT jsonb_typeof(value)='object' AND octet_length(value::text)<=4096 AND
 NOT EXISTS(SELECT 1 FROM jsonb_each(CASE WHEN jsonb_typeof(value)='object' THEN value ELSE '{}' END) e
 WHERE key NOT IN ('country','city','department','profession','organization_type','project_type','marketplace_category')
 OR jsonb_typeof(e.value)<>'array')
$$;
CREATE TABLE public.organization_promotions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
 created_by uuid DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
 product_code text NOT NULL REFERENCES public.advertising_products(code),
 target_type text CHECK(target_type IN ('organization','work','listing','project')),target_id uuid,
 starts_at timestamptz,ends_at timestamptz,
 status text NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','review','scheduled','active','paused','completed','rejected')),
 targeting jsonb NOT NULL DEFAULT '{}' CHECK(filmverse_private.valid_professional_targeting(targeting)),
 creative text CHECK(length(creative)<=5000),billing_reference text,created_at timestamptz NOT NULL DEFAULT now(),
 CHECK(ends_at IS NULL OR starts_at IS NULL OR ends_at>starts_at)
);
-- Server aggregation only; no public client-counter INSERT or invented ROI.
CREATE TABLE public.organization_campaign_daily_metrics (
 promotion_id uuid NOT NULL REFERENCES public.organization_promotions(id) ON DELETE CASCADE,
 organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
 day date NOT NULL,impressions bigint NOT NULL DEFAULT 0 CHECK(impressions>=0),
 clicks bigint NOT NULL DEFAULT 0 CHECK(clicks>=0),qualified_actions bigint NOT NULL DEFAULT 0 CHECK(qualified_actions>=0),
 PRIMARY KEY(promotion_id,day)
);
-- Company inbox is a distinct mapping to canonical chats, not employee DMs.
-- No client grants/room creation yet: shared membership synchronization needs a
-- dedicated reviewed RPC before exposing a company Message action.
CREATE TABLE public.organization_inbox_threads (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
 room_id uuid NOT NULL UNIQUE REFERENCES public.chat_rooms(id) ON DELETE RESTRICT,
 external_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
 created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(organization_id,external_user_id)
);

CREATE FUNCTION filmverse_private.business_audit() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE org uuid;actor uuid:=auth.uid();payload jsonb;
BEGIN
 payload:=CASE WHEN TG_OP='DELETE' THEN to_jsonb(OLD) ELSE to_jsonb(NEW) END;
 org:=(payload->>'organization_id')::uuid;
 IF TG_OP='UPDATE' AND (NEW.organization_id IS DISTINCT FROM OLD.organization_id) THEN
 RAISE EXCEPTION 'organization_reassignment_denied' USING ERRCODE='42501'; END IF;
 IF org IS NOT NULL THEN
   IF actor IS NOT NULL THEN
     PERFORM 1 FROM public.organizations WHERE id=org FOR UPDATE;
     IF NOT filmverse_private.org_can(org,TG_ARGV[0]) THEN
       RAISE EXCEPTION 'organization_permission_required' USING ERRCODE='42501';
     END IF;
   END IF;
   INSERT INTO public.organization_audit_events(organization_id,actor_user_id,action,subject_id)
   VALUES(org,actor,TG_TABLE_NAME||'_'||lower(TG_OP),(payload->>'id')::uuid);
 END IF;
 RETURN CASE WHEN TG_OP='DELETE' THEN OLD ELSE NEW END;
END $$;
CREATE TRIGGER company_project_audit BEFORE INSERT OR UPDATE OR DELETE ON public.projects
 FOR EACH ROW EXECUTE FUNCTION filmverse_private.business_audit('manage_projects');
CREATE TRIGGER company_job_audit BEFORE INSERT OR UPDATE OR DELETE ON public.work_opportunities
 FOR EACH ROW EXECUTE FUNCTION filmverse_private.business_audit('publish_jobs');
CREATE TRIGGER company_listing_audit BEFORE INSERT OR UPDATE OR DELETE ON public.marketplace_listings
 FOR EACH ROW EXECUTE FUNCTION filmverse_private.business_audit('manage_marketplace');
DO $$ DECLARE t text;permission text;insert_columns text;update_columns text; BEGIN
 FOREACH t IN ARRAY ARRAY['organization_briefs','organization_inventory_items','equipment_packages','equipment_package_items',
 'project_organizations','organization_entitlements','advertising_products','organization_promotions',
 'organization_campaign_daily_metrics','organization_inbox_threads'] LOOP
 EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
 EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC,anon,authenticated',t);
 EXECUTE format('GRANT SELECT,INSERT,UPDATE,DELETE ON public.%I TO service_role',t);
 IF t IN ('organization_briefs','organization_inventory_items','equipment_packages','equipment_package_items') THEN
   permission:=CASE t WHEN 'organization_briefs' THEN 'manage_projects' ELSE 'manage_inventory' END;
   SELECT string_agg(quote_ident(attname),',') INTO insert_columns FROM pg_attribute
   WHERE attrelid=format('public.%I',t)::regclass AND attnum>0 AND NOT attisdropped
   AND attname NOT IN ('id','created_by','created_at','updated_at');
   SELECT string_agg(quote_ident(attname),',') INTO update_columns FROM pg_attribute
   WHERE attrelid=format('public.%I',t)::regclass AND attnum>0 AND NOT attisdropped
   AND attname NOT IN ('id','organization_id','created_by','created_at','updated_at');
   EXECUTE format('GRANT SELECT,DELETE,INSERT(%s),UPDATE(%s) ON public.%I TO authenticated',insert_columns,update_columns,t);
   EXECUTE format('CREATE POLICY business_access ON public.%I FOR ALL TO authenticated
   USING(filmverse_private.org_can(organization_id,%L)) WITH CHECK(filmverse_private.org_can(organization_id,%L))',t,permission,permission);
 END IF;
 IF t<>'advertising_products' THEN
 EXECUTE format('CREATE INDEX %I ON public.%I(organization_id)',t||'_owner_idx',t);
 END IF;
 IF t IN ('organization_briefs','organization_inventory_items','equipment_packages','equipment_package_items','organization_promotions') THEN
 permission:=CASE t WHEN 'organization_briefs' THEN 'manage_projects' WHEN 'organization_promotions' THEN 'manage_promotions' ELSE 'manage_inventory' END;
 EXECUTE format('CREATE TRIGGER business_audit BEFORE INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION filmverse_private.business_audit(%L)',t,permission);
 END IF;
 END LOOP;
END $$;
GRANT SELECT ON public.project_organizations TO authenticated;
CREATE POLICY relationship_read ON public.project_organizations FOR SELECT TO authenticated
 USING(filmverse_private.project_can(project_id) OR filmverse_private.org_can(organization_id,'manage_projects'));
GRANT INSERT(project_id,organization_id,relationship_type) ON public.project_organizations TO authenticated;
CREATE POLICY relationship_request ON public.project_organizations FOR INSERT TO authenticated
 WITH CHECK(created_by=auth.uid() AND status='pending' AND filmverse_private.project_can(project_id));
GRANT SELECT ON public.organization_entitlements TO authenticated;
CREATE POLICY company_entitlement_read ON public.organization_entitlements FOR SELECT TO authenticated
 USING(filmverse_private.org_can(organization_id,'manage_billing'));
GRANT SELECT ON public.advertising_products TO authenticated;
CREATE POLICY ad_products_read ON public.advertising_products FOR SELECT TO authenticated USING(true);
GRANT SELECT(id,organization_id,created_by,product_code,target_type,target_id,starts_at,ends_at,status,targeting,creative,created_at)
 ON public.organization_promotions TO authenticated;
CREATE POLICY promotions_read ON public.organization_promotions FOR SELECT TO authenticated
 USING(filmverse_private.org_can(organization_id,'manage_promotions'));
GRANT INSERT(organization_id,product_code,target_type,target_id,targeting,creative) ON public.organization_promotions TO authenticated;
CREATE POLICY promotions_draft ON public.organization_promotions FOR INSERT TO authenticated
 WITH CHECK(created_by=auth.uid() AND status='draft' AND filmverse_private.org_can(organization_id,'manage_promotions'));
GRANT SELECT ON public.organization_campaign_daily_metrics TO authenticated;
CREATE POLICY metrics_read ON public.organization_campaign_daily_metrics FOR SELECT TO authenticated
 USING(filmverse_private.org_can(organization_id,'view_analytics'));
-- Data collection, billing-backed activation and company inbox mutation remain
-- server-only foundations; neither implies verification nor public promotion.
REVOKE ALL ON FUNCTION filmverse_private.org_public(uuid),filmverse_private.project_can(uuid),
 filmverse_private.content_owner_guard(),filmverse_private.business_audit(),
 filmverse_private.valid_professional_targeting(jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION filmverse_private.org_public(uuid),filmverse_private.org_can(uuid,text) TO anon,authenticated;
GRANT EXECUTE ON FUNCTION filmverse_private.project_can(uuid),filmverse_private.valid_professional_targeting(jsonb) TO authenticated,service_role;
COMMIT;
