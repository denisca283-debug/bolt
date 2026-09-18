-- Preparatory security gate for resume entitlements. No data is deleted.
-- Ship explicit frontend profile projections BEFORE applying this migration.
-- Legacy profiles.plan is display-only: historic values are NOT proof of payment.
BEGIN;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Table grants override column revocations, so remove both layers first.
REVOKE ALL PRIVILEGES ON TABLE public.profiles FROM PUBLIC, anon, authenticated;
DO $$
DECLARE column_list text;
BEGIN
  SELECT string_agg(quote_ident(attname), ', ' ORDER BY attnum)
  INTO column_list FROM pg_attribute
  WHERE attrelid = 'public.profiles'::regclass AND attnum > 0 AND NOT attisdropped;
  EXECUTE format('REVOKE SELECT (%1$s), INSERT (%1$s), UPDATE (%1$s), REFERENCES (%1$s) ON public.profiles FROM PUBLIC, anon, authenticated', column_list);
END $$;

-- Public professional projection. date_of_birth stays stored but cannot be
-- selected, filtered, sorted, or returned through the client Data API.
GRANT SELECT (
  id, full_name, public_slug, city, country, gender, avatar_url, about,
  availability_status, created_at, updated_at
) ON public.profiles TO anon, authenticated;

-- Own-row RLS remains mandatory. ID only belongs in INSERT, never UPDATE.
-- Server timestamps and subscription flags are intentionally excluded.
GRANT INSERT (
  id, full_name, public_slug, city, country, gender, avatar_url, about,
  availability_status, onboarding_completed
) ON public.profiles TO authenticated;
GRANT UPDATE (
  full_name, public_slug, city, country, gender, avatar_url, about,
  availability_status, onboarding_completed
) ON public.profiles TO authenticated;

COMMIT;
