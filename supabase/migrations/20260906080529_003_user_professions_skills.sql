/*
# Create user_professions, skills, user_skills tables

1. New Tables
- `user_professions` — links users to multiple professions
  - id (uuid PK), user_id (FK auth.users), profession_id (FK professions)
  - is_primary (boolean), experience_years (int nullable), description (text nullable)
  - created_at
- `skills` — master skill list
  - id (uuid PK), name (text unique)
- `user_skills` — links users to skills
  - id (uuid PK), user_id (FK auth.users), skill_id (FK skills)
  - created_at

2. Security
- user_professions: public read; owner can CRUD only their own
- skills: public read; no client writes (managed by migration)
- user_skills: public read; owner can CRUD only their own

3. Notes
- One person may have MANY professions
- Only one profession should be is_primary = true per user
- Skills are separate from professions: "Кто ты?" vs "Что ты умеешь?"
*/

CREATE TABLE IF NOT EXISTS user_professions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  profession_id uuid NOT NULL REFERENCES professions(id) ON DELETE CASCADE,
  is_primary boolean NOT NULL DEFAULT false,
  experience_years int,
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE user_professions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_professions_public_read" ON user_professions;
CREATE POLICY "user_professions_public_read"
  ON user_professions FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "user_professions_owner_insert" ON user_professions;
CREATE POLICY "user_professions_owner_insert"
  ON user_professions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "user_professions_owner_update" ON user_professions;
CREATE POLICY "user_professions_owner_update"
  ON user_professions FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "user_professions_owner_delete" ON user_professions;
CREATE POLICY "user_professions_owner_delete"
  ON user_professions FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS skills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE
);

ALTER TABLE skills ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "skills_public_read" ON skills;
CREATE POLICY "skills_public_read"
  ON skills FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE TABLE IF NOT EXISTS user_skills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  skill_id uuid NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE user_skills ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_skills_public_read" ON user_skills;
CREATE POLICY "user_skills_public_read"
  ON user_skills FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "user_skills_owner_insert" ON user_skills;
CREATE POLICY "user_skills_owner_insert"
  ON user_skills FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "user_skills_owner_delete" ON user_skills;
CREATE POLICY "user_skills_owner_delete"
  ON user_skills FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Seed common skills
INSERT INTO skills (name) VALUES
  ('Верховая езда'), ('Фехтование'), ('Пение'), ('Танцы'), ('Языки'),
  ('Сценический бой'), ('Вождение'), ('Плавание'), ('Боевые искусства'),
  ('ARRI Alexa'), ('Sony Venice'), ('RED'), ('Steadicam'), ('Ronin'),
  ('Дрон'), ('Aputure'), ('DaVinci Resolve'), ('Avid'), ('Premiere'),
  ('Протезирование грима'), ('Возрастной грим'), ('Раны'), ('Beauty makeup'),
  ('Dolby Atmos'), ('Звуковой дизайн'), ('Compositing'), ('3D моделирование'),
  ('Motion Design'), ('Исторический'), ('Артхаус'), ('Документальное'),
  ('Реклама'), ('Сериалы'), ('Копродукция'), ('Фестивальное кино')
ON CONFLICT DO NOTHING;
