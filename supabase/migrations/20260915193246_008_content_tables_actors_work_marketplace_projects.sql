/*
# Content tables: actors, actor_projects, work_opportunities, marketplace_listings, projects

## Overview
This migration creates the core content tables that power the main browsable
sections of the film industry platform: the actor directory, casting/job
board, equipment marketplace, and project showcase. Previously these sections
were rendered from hardcoded mock data; now they persist in the database.

## New Tables

### 1. actors
Actor-specific profile data that extends the base `profiles` table.
- `id` (uuid, PK)
- `user_id` (uuid, nullable, FK → profiles.id ON DELETE CASCADE) — links to
  the registered user. Nullable so admin/seeded directory entries can exist
  without a registered account.
- `full_name` (text, not null) — display name
- `age` (int, nullable)
- `gender` (text, nullable) — 'М' or 'Ж'
- `city` (text, nullable)
- `height` (int, nullable) — height in cm
- `category` (text, nullable) — 'Актёр', 'Актриса', 'Массовка', 'Студент', 'Модель'
- `status` (text, nullable) — 'Профессиональный', 'Начинающий', 'Студент', 'Массовка'
- `hair_color` (text, nullable)
- `eye_color` (text, nullable)
- `skills` (text[], default '{}') — array of skill names
- `experience_years` (int, nullable)
- `photo_url` (text, nullable) — main portrait photo URL
- `gallery` (text[], default '{}') — array of photo URLs
- `bio` (text, nullable)
- `availability` (text, not null, default 'Свободен') — 'Свободен', 'Занят', 'Ограниченно'
- `featured_score` (int, nullable) — higher = more prominent in featured sections
- `created_at`, `updated_at` (timestamptz)

### 2. actor_projects
Filmography entries for each actor (one-to-many).
- `id` (uuid, PK)
- `actor_id` (uuid, not null, FK → actors.id ON DELETE CASCADE)
- `title` (text, not null) — project title
- `role` (text, nullable) — role played
- `year` (text, nullable) — year as text (e.g. '2025')
- `director` (text, nullable)
- `sort_order` (int, default 0)
- `created_at` (timestamptz)

### 3. work_opportunities
Casting calls and crew job postings.
- `id` (uuid, PK)
- `user_id` (uuid, not null, default auth.uid(), FK → profiles.id ON DELETE CASCADE)
- `title` (text, not null)
- `type` (text, not null) — 'Массовка', 'Главная роль', 'Вторая роль', etc.
- `audience` (text, not null) — 'Актёрам', 'Массовка', 'Специалистам'
- `project_name` (text, nullable) — associated project
- `city` (text, nullable)
- `shoot_date` (text, nullable) — human-readable date string
- `age_range` (text, nullable)
- `genre` (text, nullable)
- `pay` (text, nullable) — compensation description
- `spots_total` (int, nullable)
- `spots_left` (int, nullable)
- `description` (text, nullable)
- `applicants_count` (int, not null, default 0)
- `created_at` (timestamptz)

### 4. marketplace_listings
Equipment, services, and locations for rent, sale, or hire.
- `id` (uuid, PK)
- `user_id` (uuid, not null, default auth.uid(), FK → profiles.id ON DELETE CASCADE)
- `title` (text, not null)
- `mode` (text, not null) — 'Аренда', 'Продажа', 'Услуги'
- `category` (text, nullable) — 'Камеры', 'Свет', 'Звук', 'Транспорт', 'Локации', etc.
- `city` (text, nullable)
- `price` (text, nullable) — price description (text for flexibility)
- `image_url` (text, nullable)
- `description` (text, nullable)
- `created_at` (timestamptz)

### 5. projects
Film projects with team and casting information.
- `id` (uuid, PK)
- `user_id` (uuid, not null, default auth.uid(), FK → profiles.id ON DELETE CASCADE)
- `title` (text, not null)
- `logline` (text, nullable) — short description
- `genre` (text, nullable)
- `stage` (text, nullable) — 'Препродакшн', 'Постпродакшн', 'Разработка сценария', etc.
- `city` (text, nullable)
- `director` (text, nullable)
- `team_size` (int, nullable)
- `image_url` (text, nullable)
- `casting_roles` (text[], default '{}') — array of open role descriptions
- `created_at`, `updated_at` (timestamptz)

## Security (RLS + Policies)

### actors
- SELECT: public (anon + authenticated) — actor directory is browsable by everyone
- INSERT: authenticated, owner only (auth.uid() = user_id OR user_id IS NULL for admin)
- UPDATE: authenticated, owner only (auth.uid() = user_id)
- DELETE: authenticated, owner only (auth.uid() = user_id)

### actor_projects
- SELECT: public (anon + authenticated)
- INSERT/UPDATE/DELETE: authenticated, owner of the parent actor record

### work_opportunities
- SELECT: public — job board is browsable by everyone
- INSERT: authenticated (user_id defaults to auth.uid())
- UPDATE/DELETE: authenticated, owner only

### marketplace_listings
- SELECT: public
- INSERT: authenticated (user_id defaults to auth.uid())
- UPDATE/DELETE: authenticated, owner only

### projects
- SELECT: public
- INSERT: authenticated (user_id defaults to auth.uid())
- UPDATE/DELETE: authenticated, owner only

## Indexes
- actors: user_id (unique), city, category
- actor_projects: actor_id
- work_opportunities: user_id, city, created_at
- marketplace_listings: user_id, city, category
- projects: user_id, city, created_at
*/

-- ═══════════════════════════════════════════════════════════════
-- 1. actors
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS actors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  age int,
  gender text,
  city text,
  height int,
  category text,
  status text,
  hair_color text,
  eye_color text,
  skills text[] NOT NULL DEFAULT '{}',
  experience_years int,
  photo_url text,
  gallery text[] NOT NULL DEFAULT '{}',
  bio text,
  availability text NOT NULL DEFAULT 'Свободен',
  featured_score int,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE actors ENABLE ROW LEVEL SECURITY;

CREATE UNIQUE INDEX IF NOT EXISTS actors_user_id_key ON actors(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS actors_city_idx ON actors(city);
CREATE INDEX IF NOT EXISTS actors_category_idx ON actors(category);

DROP POLICY IF EXISTS "actors_public_read" ON actors;
CREATE POLICY "actors_public_read"
  ON actors FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "actors_owner_insert" ON actors;
CREATE POLICY "actors_owner_insert"
  ON actors FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

DROP POLICY IF EXISTS "actors_owner_update" ON actors;
CREATE POLICY "actors_owner_update"
  ON actors FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "actors_owner_delete" ON actors;
CREATE POLICY "actors_owner_delete"
  ON actors FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- ═══════════════════════════════════════════════════════════════
-- 2. actor_projects
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS actor_projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid NOT NULL REFERENCES actors(id) ON DELETE CASCADE,
  title text NOT NULL,
  role text,
  year text,
  director text,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE actor_projects ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS actor_projects_actor_id_idx ON actor_projects(actor_id);

DROP POLICY IF EXISTS "actor_projects_public_read" ON actor_projects;
CREATE POLICY "actor_projects_public_read"
  ON actor_projects FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "actor_projects_owner_insert" ON actor_projects;
CREATE POLICY "actor_projects_owner_insert"
  ON actor_projects FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM actors
      WHERE actors.id = actor_projects.actor_id
      AND actors.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "actor_projects_owner_update" ON actor_projects;
CREATE POLICY "actor_projects_owner_update"
  ON actor_projects FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM actors
      WHERE actors.id = actor_projects.actor_id
      AND actors.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "actor_projects_owner_delete" ON actor_projects;
CREATE POLICY "actor_projects_owner_delete"
  ON actor_projects FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM actors
      WHERE actors.id = actor_projects.actor_id
      AND actors.user_id = auth.uid()
    )
  );

-- ═══════════════════════════════════════════════════════════════
-- 3. work_opportunities
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS work_opportunities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE,
  title text NOT NULL,
  type text NOT NULL,
  audience text NOT NULL,
  project_name text,
  city text,
  shoot_date text,
  age_range text,
  genre text,
  pay text,
  spots_total int,
  spots_left int,
  description text,
  applicants_count int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE work_opportunities ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS work_opportunities_user_id_idx ON work_opportunities(user_id);
CREATE INDEX IF NOT EXISTS work_opportunities_city_idx ON work_opportunities(city);
CREATE INDEX IF NOT EXISTS work_opportunities_created_at_idx ON work_opportunities(created_at DESC);

DROP POLICY IF EXISTS "work_opportunities_public_read" ON work_opportunities;
CREATE POLICY "work_opportunities_public_read"
  ON work_opportunities FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "work_opportunities_owner_insert" ON work_opportunities;
CREATE POLICY "work_opportunities_owner_insert"
  ON work_opportunities FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "work_opportunities_owner_update" ON work_opportunities;
CREATE POLICY "work_opportunities_owner_update"
  ON work_opportunities FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "work_opportunities_owner_delete" ON work_opportunities;
CREATE POLICY "work_opportunities_owner_delete"
  ON work_opportunities FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- ═══════════════════════════════════════════════════════════════
-- 4. marketplace_listings
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS marketplace_listings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE,
  title text NOT NULL,
  mode text NOT NULL,
  category text,
  city text,
  price text,
  image_url text,
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE marketplace_listings ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS marketplace_listings_user_id_idx ON marketplace_listings(user_id);
CREATE INDEX IF NOT EXISTS marketplace_listings_city_idx ON marketplace_listings(city);
CREATE INDEX IF NOT EXISTS marketplace_listings_category_idx ON marketplace_listings(category);

DROP POLICY IF EXISTS "marketplace_listings_public_read" ON marketplace_listings;
CREATE POLICY "marketplace_listings_public_read"
  ON marketplace_listings FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "marketplace_listings_owner_insert" ON marketplace_listings;
CREATE POLICY "marketplace_listings_owner_insert"
  ON marketplace_listings FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "marketplace_listings_owner_update" ON marketplace_listings;
CREATE POLICY "marketplace_listings_owner_update"
  ON marketplace_listings FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "marketplace_listings_owner_delete" ON marketplace_listings;
CREATE POLICY "marketplace_listings_owner_delete"
  ON marketplace_listings FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- ═══════════════════════════════════════════════════════════════
-- 5. projects
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE,
  title text NOT NULL,
  logline text,
  genre text,
  stage text,
  city text,
  director text,
  team_size int,
  image_url text,
  casting_roles text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS projects_user_id_idx ON projects(user_id);
CREATE INDEX IF NOT EXISTS projects_city_idx ON projects(city);
CREATE INDEX IF NOT EXISTS projects_created_at_idx ON projects(created_at DESC);

DROP POLICY IF EXISTS "projects_public_read" ON projects;
CREATE POLICY "projects_public_read"
  ON projects FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "projects_owner_insert" ON projects;
CREATE POLICY "projects_owner_insert"
  ON projects FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "projects_owner_update" ON projects;
CREATE POLICY "projects_owner_update"
  ON projects FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "projects_owner_delete" ON projects;
CREATE POLICY "projects_owner_delete"
  ON projects FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- updated_at trigger for actors and projects
DROP TRIGGER IF EXISTS actors_updated_at ON actors;
CREATE TRIGGER actors_updated_at BEFORE UPDATE ON actors
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS projects_updated_at ON projects;
CREATE TRIGGER projects_updated_at BEFORE UPDATE ON projects
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
