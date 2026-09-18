BEGIN;
ALTER TABLE public.skills ADD COLUMN scope text NOT NULL DEFAULT 'professional' CHECK(scope IN ('actor','professional')),
 ADD COLUMN department_id uuid REFERENCES public.departments(id),ADD COLUMN category text NOT NULL DEFAULT 'other',
 ADD COLUMN sort_order int NOT NULL DEFAULT 0,ADD COLUMN is_active boolean NOT NULL DEFAULT true;
INSERT INTO public.skills(name,scope,category,department_id,sort_order)
 SELECT v.name,v.scope,v.category,d.id,v.sort_order FROM (VALUES
('Импровизация','actor','performance',NULL,0),
('Сценическая речь','actor','performance',NULL,1),
('Озвучивание','actor','performance',NULL,2),
('Дубляж','actor','performance',NULL,3),
('Работа с телесуфлёром','actor','performance',NULL,4),
('Пантомима','actor','performance',NULL,5),
('Клоунада','actor','performance',NULL,6),
('Хореография','actor','movement',NULL,100),
('Современные танцы','actor','movement',NULL,101),
('Классический танец','actor','movement',NULL,102),
('Бальные танцы','actor','movement',NULL,103),
('Народные танцы','actor','movement',NULL,104),
('Hip-hop','actor','movement',NULL,105),
('Акробатика','actor','movement',NULL,106),
('Гимнастика','actor','movement',NULL,107),
('Танцы','actor','movement',NULL,108),
('Сценический бой','actor','combat',NULL,200),
('Фехтование','actor','combat',NULL,201),
('Боевые искусства','actor','combat',NULL,202),
('Бокс','actor','combat',NULL,203),
('Кикбоксинг','actor','combat',NULL,204),
('Борьба','actor','combat',NULL,205),
('Работа с оружием','actor','combat',NULL,206),
('Падения','actor','combat',NULL,207),
('Базовые трюки','actor','combat',NULL,208),
('Плавание','actor','sport',NULL,300),
('Бег','actor','sport',NULL,301),
('Футбол','actor','sport',NULL,302),
('Баскетбол','actor','sport',NULL,303),
('Волейбол','actor','sport',NULL,304),
('Теннис','actor','sport',NULL,305),
('Лыжи','actor','sport',NULL,306),
('Сноуборд','actor','sport',NULL,307),
('Коньки','actor','sport',NULL,308),
('Скалолазание','actor','sport',NULL,309),
('Вождение автомобиля','actor','vehicles',NULL,400),
('Мотоцикл','actor','vehicles',NULL,401),
('Квадроцикл','actor','vehicles',NULL,402),
('Велосипед','actor','vehicles',NULL,403),
('Водный транспорт','actor','vehicles',NULL,404),
('Вождение','actor','vehicles',NULL,405),
('Верховая езда','actor','animals',NULL,500),
('Работа с животными','actor','animals',NULL,501),
('Пение','actor','music',NULL,600),
('Гитара','actor','music',NULL,601),
('Фортепиано','actor','music',NULL,602),
('Ударные','actor','music',NULL,603),
('Другие музыкальные инструменты','actor','music',NULL,604),
('Языки','actor','other',NULL,700),
('Диалекты / акценты','actor','other',NULL,701),
('Модельный опыт','actor','other',NULL,702),
('Ведущий','actor','other',NULL,703),
('Танцевальная пластика','actor','other',NULL,704),
('ARRI Alexa','professional','camera','Операторская группа',800),
('ARRI Alexa Mini LF','professional','camera','Операторская группа',801),
('Sony Venice','professional','camera','Операторская группа',802),
('Sony FX6','professional','camera','Операторская группа',803),
('RED','professional','camera','Операторская группа',804),
('Blackmagic','professional','camera','Операторская группа',805),
('Steadicam','professional','camera','Операторская группа',806),
('Ronin','professional','camera','Операторская группа',807),
('Focus pulling','professional','camera','Операторская группа',808),
('Wireless focus','professional','camera','Операторская группа',809),
('Camera rigging','professional','camera','Операторская группа',810),
('Lens control','professional','camera','Операторская группа',811),
('DIT workflow','professional','camera','Операторская группа',812),
('Data management','professional','camera','Операторская группа',813),
('Дрон','professional','camera','Операторская группа',814),
('Aputure','professional','lighting','Свет',900),
('ARRI Lighting','professional','lighting','Свет',901),
('Astera','professional','lighting','Свет',902),
('DMX','professional','lighting','Свет',903),
('Lighting console','professional','lighting','Свет',904),
('Generator work','professional','lighting','Свет',905),
('Rigging light','professional','lighting','Свет',906),
('Dolly','professional','grip','Grip',1000),
('Crane','professional','grip','Grip',1001),
('Slider','professional','grip','Grip',1002),
('Rigging','professional','grip','Grip',1003),
('Car rig','professional','grip','Grip',1004),
('Overhead rig','professional','grip','Grip',1005),
('Track laying','professional','grip','Grip',1006),
('Avid','professional','post','Монтаж / Постпродакшн',1100),
('Premiere Pro','professional','post','Монтаж / Постпродакшн',1101),
('Premiere','professional','post','Монтаж / Постпродакшн',1102),
('DaVinci Resolve','professional','post','Монтаж / Постпродакшн',1103),
('Final Cut Pro','professional','post','Монтаж / Постпродакшн',1104),
('After Effects','professional','post','Монтаж / Постпродакшн',1105),
('Media Composer','professional','post','Монтаж / Постпродакшн',1106),
('Color grading','professional','post','Монтаж / Постпродакшн',1107),
('Proxy workflow','professional','post','Монтаж / Постпродакшн',1108),
('Conforming','professional','post','Монтаж / Постпродакшн',1109),
('Online editing','professional','post','Монтаж / Постпродакшн',1110),
('Compositing','professional','vfx','VFX / CGI',1200),
('Nuke','professional','vfx','VFX / CGI',1201),
('Fusion','professional','vfx','VFX / CGI',1202),
('Blender','professional','vfx','VFX / CGI',1203),
('Maya','professional','vfx','VFX / CGI',1204),
('Cinema 4D','professional','vfx','VFX / CGI',1205),
('Houdini','professional','vfx','VFX / CGI',1206),
('Unreal Engine','professional','vfx','VFX / CGI',1207),
('3D modelling','professional','vfx','VFX / CGI',1208),
('3D моделирование','professional','vfx','VFX / CGI',1209),
('Tracking','professional','vfx','VFX / CGI',1210),
('Rotoscoping','professional','vfx','VFX / CGI',1211),
('Motion Design','professional','vfx','VFX / CGI',1212),
('Pro Tools','professional','sound','Звук',1300),
('Reaper','professional','sound','Звук',1301),
('Location sound','professional','sound','Звук',1302),
('Boom operation','professional','sound','Звук',1303),
('Wireless microphones','professional','sound','Звук',1304),
('Foley','professional','sound','Звук',1305),
('Sound design','professional','sound','Звук',1306),
('Звуковой дизайн','professional','sound','Звук',1307),
('Dolby Atmos','professional','sound','Звук',1308),
('Mixing','professional','sound','Звук',1309),
('ADR','professional','sound','Звук',1310),
('Beauty makeup','professional','makeup','Грим / Волосы',1400),
('Character makeup','professional','makeup','Грим / Волосы',1401),
('Age makeup','professional','makeup','Грим / Волосы',1402),
('Prosthetic makeup','professional','makeup','Грим / Волосы',1403),
('SFX makeup','professional','makeup','Грим / Волосы',1404),
('Wounds','professional','makeup','Грим / Волосы',1405),
('Wig work','professional','makeup','Грим / Волосы',1406),
('Hairstyling','professional','makeup','Грим / Волосы',1407),
('Протезирование грима','professional','makeup','Грим / Волосы',1408),
('Возрастной грим','professional','makeup','Грим / Волосы',1409),
('Раны','professional','makeup','Грим / Волосы',1410),
('Scheduling','professional','production','Продюсерская / Production',1500),
('Budgeting','professional','production','Продюсерская / Production',1501),
('Call sheets','professional','production','Продюсерская / Production',1502),
('Crew coordination','professional','production','Продюсерская / Production',1503),
('Production logistics','professional','production','Продюсерская / Production',1504),
('Location management','professional','production','Продюсерская / Production',1505),
('Movie Magic Scheduling','professional','production','Продюсерская / Production',1506),
('Movie Magic Budgeting','professional','production','Продюсерская / Production',1507),
('Stunt coordination','professional','stunts','Каскадёрская группа',1600),
('Fight choreography','professional','stunts','Каскадёрская группа',1601),
('Wire work','professional','stunts','Каскадёрская группа',1602),
('High falls','professional','stunts','Каскадёрская группа',1603),
('Vehicle stunts','professional','stunts','Каскадёрская группа',1604),
('Fire stunts','professional','stunts','Каскадёрская группа',1605),
('Эскизирование','professional','art','Художественный департамент',1700),
('Декорации','professional','art','Художественный департамент',1701),
('Сценография','professional','art','Художественный департамент',1702),
('Конструирование костюма','professional','costume','Костюм',1800),
('Исторический костюм','professional','costume','Костюм',1801),
('Пошив','professional','costume','Костюм',1802)
 ) v(name,scope,category,department,sort_order) LEFT JOIN public.departments d ON d.name=v.department
 ON CONFLICT(name) DO UPDATE SET scope=EXCLUDED.scope,category=EXCLUDED.category,department_id=EXCLUDED.department_id,sort_order=EXCLUDED.sort_order;
CREATE INDEX skills_scope_department_idx ON public.skills(scope,department_id,sort_order) WHERE is_active;
CREATE TABLE public.experience_tags(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),name text NOT NULL UNIQUE,sort_order int NOT NULL DEFAULT 0);
INSERT INTO public.experience_tags(name) VALUES('Реклама'),('Сериал'),('Документальный'),('Артхаус'),('Исторический'),('Фестивальное кино'),('Копродукция');
CREATE TABLE public.user_experience_tags(user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES public.profiles(id) ON DELETE CASCADE,
 tag_id uuid NOT NULL REFERENCES public.experience_tags(id),PRIMARY KEY(user_id,tag_id));
-- Preserve original skill IDs and selections; map historical format selections.
INSERT INTO public.user_experience_tags(user_id,tag_id)
 SELECT us.user_id,t.id FROM public.user_skills us JOIN public.skills s ON s.id=us.skill_id
 JOIN public.experience_tags t ON t.name=CASE s.name WHEN 'Сериалы' THEN 'Сериал' WHEN 'Документальное' THEN 'Документальный' ELSE s.name END
 ON CONFLICT DO NOTHING;
UPDATE public.skills SET is_active=false WHERE name IN ('Реклама','Сериалы','Сериал','Документальное','Документальный','Артхаус','Исторический','Фестивальное кино','Копродукция');
CREATE TABLE public.user_custom_skills(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES public.profiles(id) ON DELETE CASCADE,
 name text NOT NULL CHECK(length(name) BETWEEN 2 AND 80),scope text NOT NULL CHECK(scope IN ('actor','professional')),
 department_id uuid REFERENCES public.departments(id),created_at timestamptz NOT NULL DEFAULT now());
CREATE UNIQUE INDEX custom_skill_name_owner_idx ON public.user_custom_skills(user_id,lower(name));
CREATE FUNCTION filmverse_private.validate_custom_skill() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF auth.uid() IS NULL OR NEW.user_id<>auth.uid() THEN RAISE EXCEPTION 'owner_required' USING ERRCODE='42501'; END IF;
 NEW.name:=btrim(regexp_replace(NEW.name,'\s+',' ','g'));
 PERFORM 1 FROM public.profiles WHERE id=NEW.user_id FOR UPDATE;
 IF TG_OP='INSERT' AND (SELECT count(*) FROM public.user_custom_skills WHERE user_id=NEW.user_id)>=50 THEN
 RAISE EXCEPTION 'custom_skill_limit' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER custom_skill_validate BEFORE INSERT OR UPDATE ON public.user_custom_skills FOR EACH ROW EXECUTE FUNCTION filmverse_private.validate_custom_skill();
REVOKE ALL ON FUNCTION filmverse_private.validate_custom_skill() FROM PUBLIC,anon,authenticated;
ALTER TABLE public.experience_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_experience_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_custom_skills ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.skills,public.experience_tags,public.user_experience_tags,public.user_custom_skills FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.skills,public.experience_tags,public.user_experience_tags,public.user_custom_skills TO anon,authenticated;
GRANT ALL ON public.skills,public.experience_tags,public.user_experience_tags,public.user_custom_skills TO service_role;
GRANT INSERT(tag_id),DELETE ON public.user_experience_tags TO authenticated;
GRANT INSERT(name,scope,department_id),UPDATE(name,scope,department_id),DELETE ON public.user_custom_skills TO authenticated;
CREATE POLICY experience_dictionary_read ON public.experience_tags FOR SELECT TO anon,authenticated USING(true);
CREATE POLICY experience_read ON public.user_experience_tags FOR SELECT TO anon,authenticated USING(filmverse_private.person_visible(user_id));
CREATE POLICY experience_insert ON public.user_experience_tags FOR INSERT TO authenticated WITH CHECK(user_id=auth.uid());
CREATE POLICY experience_delete ON public.user_experience_tags FOR DELETE TO authenticated USING(user_id=auth.uid());
CREATE POLICY custom_skill_read ON public.user_custom_skills FOR SELECT TO anon,authenticated USING(filmverse_private.person_visible(user_id));
CREATE POLICY custom_skill_insert ON public.user_custom_skills FOR INSERT TO authenticated WITH CHECK(user_id=auth.uid());
CREATE POLICY custom_skill_update ON public.user_custom_skills FOR UPDATE TO authenticated USING(user_id=auth.uid()) WITH CHECK(user_id=auth.uid());
CREATE POLICY custom_skill_delete ON public.user_custom_skills FOR DELETE TO authenticated USING(user_id=auth.uid());
COMMIT;
