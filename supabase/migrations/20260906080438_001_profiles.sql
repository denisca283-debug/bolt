/*
# Create profiles table

1. New Tables
- `profiles` — public application profile linked 1:1 to auth.users
  - id (uuid, PK, references auth.users.id ON DELETE CASCADE)
  - full_name (text, nullable)
  - public_slug (text, unique, nullable)
  - city (text, nullable)
  - country (text, nullable)
  - date_of_birth (date, nullable)
  - gender (text, nullable)
  - avatar_url (text, nullable)
  - about (text, nullable)
  - availability_status (text, default 'available')
  - onboarding_completed (boolean, default false)
  - created_at, updated_at (timestamptz)

2. Security
- RLS enabled on profiles
- Public SELECT: anyone (anon + authenticated) can read profile fields
- Authenticated UPDATE: users can update ONLY their own profile
- Authenticated INSERT: users can insert ONLY their own profile
- No DELETE from client (managed by auth cascade)

3. Notes
- ONE PERSON = ONE ACCOUNT. No separate account types.
- public_slug is used for shareable public profiles
*/

CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text,
  public_slug text UNIQUE,
  city text,
  country text,
  date_of_birth date,
  gender text,
  avatar_url text,
  about text,
  availability_status text NOT NULL DEFAULT 'available',
  onboarding_completed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_public_read" ON profiles;
CREATE POLICY "profiles_public_read"
  ON profiles FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "profiles_owner_insert" ON profiles;
CREATE POLICY "profiles_owner_insert"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_owner_update" ON profiles;
CREATE POLICY "profiles_owner_update"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS profiles_updated_at ON profiles;
CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
