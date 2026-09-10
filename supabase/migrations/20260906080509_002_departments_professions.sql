/*
# Create departments and professions tables + seed data

1. New Tables
- `departments` — professional departments (Режиссура, Операторская, etc.)
  - id (uuid PK), name (text), sort_order (int)
- `professions` — individual professions within departments
  - id (uuid PK), department_id (FK), name (text), sort_order (int)

2. Security
- Both tables: public read (anon + authenticated)
- No client-side writes (managed by migrations/admin)

3. Seed Data
- 24 departments with all specified professions
- Taxonomy is extensible — new departments/professions can be added via migration
*/

CREATE TABLE IF NOT EXISTS departments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  sort_order int NOT NULL DEFAULT 0
);

ALTER TABLE departments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "departments_public_read" ON departments;
CREATE POLICY "departments_public_read"
  ON departments FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE TABLE IF NOT EXISTS professions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  department_id uuid NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
  name text NOT NULL,
  sort_order int NOT NULL DEFAULT 0
);

ALTER TABLE professions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "professions_public_read" ON professions;
CREATE POLICY "professions_public_read"
  ON professions FOR SELECT
  TO anon, authenticated
  USING (true);

-- Seed departments
INSERT INTO departments (name, sort_order) VALUES
  ('Актёрский состав', 1),
  ('Режиссёрская группа', 2),
  ('Продюсерская / Production', 3),
  ('Кастинг', 4),
  ('Операторская группа', 5),
  ('Свет', 6),
  ('Grip', 7),
  ('Художественный департамент', 8),
  ('Реквизит', 9),
  ('Костюм', 10),
  ('Грим / Волосы', 11),
  ('Звук', 12),
  ('Локации', 13),
  ('Каскадёрская группа', 14),
  ('SFX', 15),
  ('VFX / CGI', 16),
  ('Монтаж / Постпродакшн', 17),
  ('Постзвук / Музыка', 18),
  ('Транспорт', 19),
  ('Фото / EPK', 20),
  ('Административная группа', 21),
  ('Прочее', 22)
ON CONFLICT DO NOTHING;

-- Seed professions using subqueries for department_id
INSERT INTO professions (department_id, name, sort_order)
SELECT d.id, p.name, p.sort_order FROM departments d
JOIN (VALUES
  ('Актёрский состав', 'Актёр', 1),
  ('Актёрский состав', 'Актёр массовых сцен', 2),
  ('Актёрский состав', 'Актёр эпизода', 3),
  ('Актёрский состав', 'Модель', 4),
  ('Актёрский состав', 'Ребёнок-актёр', 5),
  ('Актёрский состав', 'Дублёр', 6),
  ('Режиссёрская группа', 'Режиссёр', 1),
  ('Режиссёрская группа', 'Второй режиссёр', 2),
  ('Режиссёрская группа', 'Ассистент режиссёра', 3),
  ('Режиссёрская группа', 'Script Supervisor', 4),
  ('Продюсерская / Production', 'Продюсер', 1),
  ('Продюсерская / Production', 'Исполнительный продюсер', 2),
  ('Продюсерская / Production', 'Линейный продюсер', 3),
  ('Продюсерская / Production', 'Директор картины', 4),
  ('Продюсерская / Production', 'Координатор производства', 5),
  ('Продюсерская / Production', 'Администратор', 6),
  ('Кастинг', 'Кастинг-директор', 1),
  ('Кастинг', 'Кастинг-менеджер', 2),
  ('Кастинг', 'Ассистент по кастингу', 3),
  ('Операторская группа', 'Оператор-постановщик', 1),
  ('Операторская группа', 'Камероператор', 2),
  ('Операторская группа', '1AC / Фокус-пуллер', 3),
  ('Операторская группа', '2AC', 4),
  ('Операторская группа', 'DIT', 5),
  ('Операторская группа', 'Steadicam Operator', 6),
  ('Операторская группа', 'Механик камеры', 7),
  ('Свет', 'Гафер', 1),
  ('Свет', 'Best Boy', 2),
  ('Свет', 'Осветитель', 3),
  ('Grip', 'Key Grip', 1),
  ('Grip', 'Dolly Grip', 2),
  ('Grip', 'Grip', 3),
  ('Grip', 'Rigging Specialist', 4),
  ('Художественный департамент', 'Художник-постановщик', 1),
  ('Художественный департамент', 'Арт-директор', 2),
  ('Художественный департамент', 'Декоратор', 3),
  ('Художественный департамент', 'Художник-график', 4),
  ('Реквизит', 'Художник по реквизиту', 1),
  ('Реквизит', 'Реквизитор', 2),
  ('Костюм', 'Художник по костюмам', 1),
  ('Костюм', 'Костюмер', 2),
  ('Костюм', 'Ассистент по костюмам', 3),
  ('Грим / Волосы', 'Художник по гриму', 1),
  ('Грим / Волосы', 'Гримёр', 2),
  ('Грим / Волосы', 'SFX Makeup Artist', 3),
  ('Грим / Волосы', 'Hairstylist', 4),
  ('Звук', 'Звукорежиссёр площадки', 1),
  ('Звук', 'Звукооператор', 2),
  ('Звук', 'Boom Operator', 3),
  ('Звук', 'Sound Utility', 4),
  ('Локации', 'Location Manager', 1),
  ('Локации', 'Location Scout', 2),
  ('Локации', 'Location Coordinator', 3),
  ('Каскадёрская группа', 'Постановщик трюков', 1),
  ('Каскадёрская группа', 'Каскадёр', 2),
  ('Каскадёрская группа', 'Stunt Rigger', 3),
  ('SFX', 'Practical Effects Specialist', 1),
  ('SFX', 'Пиротехник', 2),
  ('VFX / CGI', 'VFX Supervisor', 1),
  ('VFX / CGI', 'VFX Artist', 2),
  ('VFX / CGI', 'Compositor', 3),
  ('VFX / CGI', 'CGI Artist', 4),
  ('VFX / CGI', '3D Artist', 5),
  ('Монтаж / Постпродакшн', 'Монтажёр', 1),
  ('Монтаж / Постпродакшн', 'Assistant Editor', 2),
  ('Монтаж / Постпродакшн', 'Колорист', 3),
  ('Монтаж / Постпродакшн', 'Motion Designer', 4),
  ('Постзвук / Музыка', 'Sound Designer', 1),
  ('Постзвук / Музыка', 'Foley Artist', 2),
  ('Постзвук / Музыка', 'Re-recording Mixer', 3),
  ('Постзвук / Музыка', 'Композитор', 4),
  ('Транспорт', 'Транспортный координатор', 1),
  ('Транспорт', 'Водитель', 2),
  ('Транспорт', 'Picture Car Specialist', 3),
  ('Фото / EPK', 'Фотограф площадки', 1),
  ('Фото / EPK', 'Making-of', 2),
  ('Фото / EPK', 'EPK Specialist', 3),
  ('Административная группа', 'Бухгалтер проекта', 1),
  ('Административная группа', 'Юрист', 2),
  ('Административная группа', 'Координатор', 3),
  ('Прочее', 'Другой специалист', 1)
) AS p(dept_name, name, sort_order)
ON d.name = p.dept_name
ON CONFLICT DO NOTHING;
