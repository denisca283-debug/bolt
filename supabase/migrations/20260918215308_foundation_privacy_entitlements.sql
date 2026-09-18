-- Foundation only: no checkout, publication UI, paid backfill, or seeded users.
BEGIN;
SET LOCAL lock_timeout = '5s';

-- Defense for previews which may have applied the earlier pending grant set.
-- No table-level SELECT survives the preceding profile positive-list migration.
REVOKE SELECT (plan, onboarding_completed, date_of_birth) ON public.profiles FROM PUBLIC, anon, authenticated;

-- Internal authority is not public trust data. Preserve all existing grants.
REVOKE ALL ON public.user_permissions FROM PUBLIC, anon, authenticated;
DO $$ DECLARE p record; columns text; BEGIN
  SELECT string_agg(quote_ident(attname), ', ' ORDER BY attnum) INTO columns
  FROM pg_attribute WHERE attrelid='public.user_permissions'::regclass AND attnum>0 AND NOT attisdropped;
  EXECUTE format('REVOKE SELECT (%1$s), INSERT (%1$s), UPDATE (%1$s), REFERENCES (%1$s) ON public.user_permissions FROM PUBLIC, anon, authenticated', columns);
  FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='user_permissions'
  LOOP EXECUTE format('DROP POLICY %I ON public.user_permissions',p.policyname); END LOOP;
END $$;
ALTER TABLE public.user_permissions ENABLE ROW LEVEL SECURITY;
GRANT SELECT (id,user_id,permission_id,created_at) ON public.user_permissions TO authenticated;
CREATE POLICY user_permissions_own_read ON public.user_permissions FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_permissions TO service_role;
CREATE INDEX IF NOT EXISTS user_permissions_owner_idx ON public.user_permissions(user_id,permission_id);

CREATE TABLE public.account_entitlements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  entitlement_code text NOT NULL CHECK (entitlement_code IN ('pro','resume_publication')),
  source text NOT NULL CHECK (source IN ('subscription','one_time','admin','test')),
  source_reference text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','revoked')),
  starts_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  remaining_uses integer CHECK (remaining_uses >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (expires_at IS NULL OR expires_at > starts_at),
  CHECK ((entitlement_code='pro' AND remaining_uses IS NULL)
    OR (entitlement_code='resume_publication' AND remaining_uses IS NOT NULL)),
  CHECK (source_reference IS NULL OR length(btrim(source_reference)) BETWEEN 1 AND 200),
  CHECK (source NOT IN ('subscription','one_time') OR source_reference IS NOT NULL),
  UNIQUE (source,source_reference,entitlement_code)
);
ALTER TABLE public.account_entitlements ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.account_entitlements FROM PUBLIC, anon, authenticated;
GRANT SELECT (id,user_id,entitlement_code,starts_at,expires_at,remaining_uses)
  ON public.account_entitlements TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.account_entitlements TO service_role;
CREATE POLICY account_entitlements_own_effective_read ON public.account_entitlements
  FOR SELECT TO authenticated USING (
    user_id = (SELECT auth.uid()) AND status='active'
    AND starts_at <= now() AND (expires_at IS NULL OR expires_at > now())
    AND (remaining_uses IS NULL OR remaining_uses > 0)
  );
CREATE INDEX account_entitlements_active_owner_idx
  ON public.account_entitlements(user_id,entitlement_code) WHERE status='active';
CREATE TRIGGER account_entitlements_updated_at BEFORE UPDATE ON public.account_entitlements
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Existing authenticated owner UPDATE already has the same ownership condition.
-- Restrictive policy also protects against an additional permissive INSERT policy.
DROP POLICY IF EXISTS pulse_feed_owner_insert ON public.pulse_feed;
CREATE POLICY pulse_feed_owner_insert ON public.pulse_feed FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));
CREATE POLICY pulse_feed_browser_owner_guard ON public.pulse_feed AS RESTRICTIVE
  FOR INSERT TO authenticated WITH CHECK (user_id = (SELECT auth.uid()));

-- Deliberately no entitlement INSERT from profiles.plan or an email allowlist.
-- Founder/admin capability stays in user_permissions; server may issue audited
-- admin/test entitlement rows after independently checking the authority.
COMMIT;
