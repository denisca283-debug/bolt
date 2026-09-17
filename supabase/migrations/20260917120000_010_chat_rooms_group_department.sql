/*
# Групповые чаты и чаты департаментов

1. Зачем
   Существующая таблица `conversations` жёстко рассчитана на двоих
   (participant_a / participant_b) — групповой чат в ней невозможен.
   Эта миграция добавляет комнаты с произвольным числом участников.
   Старые таблицы conversations/messages НЕ трогаются и не удаляются.

2. Новые таблицы
   - chat_rooms    — комната: личная, групповая или департаментская
   - chat_members  — кто в комнате состоит
   - chat_messages — сообщения комнаты

3. Новое поле
   - profiles.plan — 'free' | 'pro'. Подписки в базе не было вообще;
     это минимальное поле, чтобы правило «Про» можно было применять.
     Оплату оно не проводит — значение ставится вручную или будущим
     биллингом.

4. Правило создания департаментских чатов
   Создать чат департамента может только тот, у кого одновременно:
     - plan = 'pro'
     - не менее ДВУХ одобренных записей верификации РАЗНЫХ типов
   Проверка живёт в базе (функция + политика), а не только в интерфейсе,
   поэтому обойти её через прямой запрос нельзя.

5. Безопасность
   RLS включена на всех трёх таблицах. Читать и писать в комнату может
   только её участник. Проверка участия вынесена в SECURITY DEFINER
   функцию — иначе политика на chat_members ссылалась бы сама на себя
   и вызывала бесконечную рекурсию.
*/

-- ═══════════════════════════════════════════════════════════════
-- 0. Подписка
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS plan text NOT NULL DEFAULT 'free';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'profiles_plan_check'
  ) THEN
    ALTER TABLE profiles
      ADD CONSTRAINT profiles_plan_check CHECK (plan IN ('free', 'pro'));
  END IF;
END $$;

-- ═══════════════════════════════════════════════════════════════
-- 1. Таблицы
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS chat_rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL DEFAULT 'group',
  title text,
  department_id uuid REFERENCES departments(id) ON DELETE SET NULL,
  created_by uuid NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE,
  last_message_text text,
  last_message_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chat_rooms_kind_check'
  ) THEN
    ALTER TABLE chat_rooms
      ADD CONSTRAINT chat_rooms_kind_check
      CHECK (kind IN ('direct', 'group', 'department'));
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS chat_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES chat_rooms(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'member',
  last_read_at timestamptz,
  joined_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS chat_members_room_user_idx
  ON chat_members (room_id, user_id);

CREATE TABLE IF NOT EXISTS chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES chat_rooms(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS chat_messages_room_created_idx
  ON chat_messages (room_id, created_at);

-- ═══════════════════════════════════════════════════════════════
-- 2. Функции-помощники (SECURITY DEFINER — обходят RLS внутри себя,
--    иначе политики ссылались бы сами на себя)
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION is_room_member(p_room uuid, p_user uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM chat_members m
    WHERE m.room_id = p_room AND m.user_id = p_user
  );
$$;

-- Двойная верификация + подписка Про.
CREATE OR REPLACE FUNCTION can_create_department_chat(p_user uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    COALESCE((SELECT plan FROM profiles WHERE id = p_user), 'free') = 'pro'
    AND (
      SELECT count(DISTINCT verification_type)
      FROM verification_records
      WHERE user_id = p_user AND status = 'approved'
    ) >= 2;
$$;

-- ═══════════════════════════════════════════════════════════════
-- 3. RLS
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE chat_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

-- chat_rooms ------------------------------------------------------

-- Создатель включён отдельно: сразу после INSERT он ещё не участник,
-- а вернуть id только что созданной комнаты нужно — иначе в неё
-- некого будет добавить.
DROP POLICY IF EXISTS "chat_rooms_member_read" ON chat_rooms;
CREATE POLICY "chat_rooms_member_read"
  ON chat_rooms FOR SELECT
  TO authenticated
  USING (created_by = auth.uid() OR is_room_member(id, auth.uid()));

-- Личные и групповые чаты создаёт любой вошедший.
-- Департаментский — только при подписке Про и двойной верификации.
DROP POLICY IF EXISTS "chat_rooms_insert" ON chat_rooms;
CREATE POLICY "chat_rooms_insert"
  ON chat_rooms FOR INSERT
  TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND (
      kind IN ('direct', 'group')
      OR (kind = 'department' AND can_create_department_chat(auth.uid()))
    )
  );

DROP POLICY IF EXISTS "chat_rooms_owner_update" ON chat_rooms;
CREATE POLICY "chat_rooms_owner_update"
  ON chat_rooms FOR UPDATE
  TO authenticated
  USING (is_room_member(id, auth.uid()))
  WITH CHECK (is_room_member(id, auth.uid()));

-- chat_members ----------------------------------------------------

DROP POLICY IF EXISTS "chat_members_read" ON chat_members;
CREATE POLICY "chat_members_read"
  ON chat_members FOR SELECT
  TO authenticated
  USING (is_room_member(room_id, auth.uid()));

-- Добавить участника может создатель комнаты, либо человек сам себя
-- (нужно, чтобы создатель мог вписать себя в только что созданную комнату).
DROP POLICY IF EXISTS "chat_members_insert" ON chat_members;
CREATE POLICY "chat_members_insert"
  ON chat_members FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM chat_rooms r
      WHERE r.id = room_id AND r.created_by = auth.uid()
    )
  );

DROP POLICY IF EXISTS "chat_members_self_update" ON chat_members;
CREATE POLICY "chat_members_self_update"
  ON chat_members FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "chat_members_leave" ON chat_members;
CREATE POLICY "chat_members_leave"
  ON chat_members FOR DELETE
  TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM chat_rooms r
      WHERE r.id = room_id AND r.created_by = auth.uid()
    )
  );

-- chat_messages ---------------------------------------------------

DROP POLICY IF EXISTS "chat_messages_member_read" ON chat_messages;
CREATE POLICY "chat_messages_member_read"
  ON chat_messages FOR SELECT
  TO authenticated
  USING (is_room_member(room_id, auth.uid()));

DROP POLICY IF EXISTS "chat_messages_member_insert" ON chat_messages;
CREATE POLICY "chat_messages_member_insert"
  ON chat_messages FOR INSERT
  TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND is_room_member(room_id, auth.uid())
  );

DROP POLICY IF EXISTS "chat_messages_sender_delete" ON chat_messages;
CREATE POLICY "chat_messages_sender_delete"
  ON chat_messages FOR DELETE
  TO authenticated
  USING (sender_id = auth.uid());

-- ═══════════════════════════════════════════════════════════════
-- 4. Превью последнего сообщения в списке комнат
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION bump_room_last_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE chat_rooms
  SET last_message_text = left(NEW.body, 200),
      last_message_at = NEW.created_at
  WHERE id = NEW.room_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS chat_messages_bump_room ON chat_messages;
CREATE TRIGGER chat_messages_bump_room
  AFTER INSERT ON chat_messages
  FOR EACH ROW EXECUTE FUNCTION bump_room_last_message();
