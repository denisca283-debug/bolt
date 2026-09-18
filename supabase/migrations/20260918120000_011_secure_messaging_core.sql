/*
# Secure messaging core

This file restores the migration that is already applied in the live FilmVerse
Supabase project. It keeps local/GitHub migration history aligned with remote
history so Supabase Preview can build correctly.

The migration converts chat writes to authenticated SECURITY DEFINER RPCs,
adds canonical direct-chat pairing, read sequence tracking and stricter RLS.
*/

ALTER TABLE public.chat_rooms
  ADD COLUMN IF NOT EXISTS direct_a uuid REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS direct_b uuid REFERENCES public.profiles(id);

ALTER TABLE public.chat_members
  ADD COLUMN IF NOT EXISTS left_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_read_seq bigint NOT NULL DEFAULT 0;

ALTER TABLE public.chat_messages
  ADD COLUMN IF NOT EXISTS seq bigint GENERATED ALWAYS AS IDENTITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chat_member_role_check'
  ) THEN
    ALTER TABLE public.chat_members
      ADD CONSTRAINT chat_member_role_check
      CHECK (role IN ('owner', 'admin', 'member'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chat_direct_pair_check'
  ) THEN
    ALTER TABLE public.chat_rooms
      ADD CONSTRAINT chat_direct_pair_check
      CHECK (
        (
          kind = 'direct'
          AND direct_a IS NOT NULL
          AND direct_b IS NOT NULL
          AND direct_a < direct_b
        )
        OR
        (
          kind <> 'direct'
          AND direct_a IS NULL
          AND direct_b IS NULL
        )
      );
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS chat_direct_pair_unique
  ON public.chat_rooms (direct_a, direct_b)
  WHERE kind = 'direct';

CREATE INDEX IF NOT EXISTS chat_members_user_active
  ON public.chat_members (user_id, room_id)
  WHERE left_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS chat_messages_seq_key
  ON public.chat_messages (seq);

CREATE INDEX IF NOT EXISTS chat_messages_room_seq
  ON public.chat_messages (room_id, seq DESC);

CREATE OR REPLACE FUNCTION public.is_room_member(p_room uuid, p_user uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p_user = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.chat_members
      WHERE room_id = p_room
        AND user_id = auth.uid()
        AND left_at IS NULL
    )
$$;

CREATE OR REPLACE FUNCTION public.can_create_department_chat(p_user uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p_user = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.user_permissions u
      JOIN public.permissions p ON p.id = u.permission_id
      WHERE u.user_id = auth.uid()
        AND p.name = 'create_professional_discussion'
    )
$$;

CREATE OR REPLACE FUNCTION public.get_or_create_direct_chat(other_user_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  me uuid := auth.uid();
  result uuid;
  a uuid;
  b uuid;
BEGIN
  IF me IS NULL OR other_user_id IS NULL OR me = other_user_id THEN
    RAISE EXCEPTION 'Invalid participants' USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = other_user_id
  ) THEN
    RAISE EXCEPTION 'Target profile not found' USING ERRCODE = 'P0002';
  END IF;

  a := least(me, other_user_id);
  b := greatest(me, other_user_id);

  PERFORM pg_advisory_xact_lock(hashtextextended(a::text || b::text, 0));

  SELECT id
  INTO result
  FROM public.chat_rooms
  WHERE direct_a = a
    AND direct_b = b
    AND kind = 'direct'
  FOR UPDATE;

  IF result IS NULL THEN
    INSERT INTO public.chat_rooms(kind, created_by, direct_a, direct_b)
    VALUES ('direct', me, a, b)
    RETURNING id INTO result;

    INSERT INTO public.chat_members(room_id, user_id, role)
    VALUES
      (result, me, 'owner'),
      (result, other_user_id, 'member');
  ELSE
    UPDATE public.chat_members
    SET left_at = NULL
    WHERE room_id = result
      AND user_id = me;
  END IF;

  RETURN result;
END
$$;

CREATE OR REPLACE FUNCTION public.chat_create_group(
  p_title text,
  p_members uuid[],
  p_department uuid DEFAULT NULL,
  p_request uuid DEFAULT gen_random_uuid()
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  me uuid := auth.uid();
  result uuid;
  members uuid[];
BEGIN
  IF me IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

  IF p_title IS NULL OR length(btrim(p_title)) NOT BETWEEN 1 AND 120 THEN
    RAISE EXCEPTION 'Invalid title';
  END IF;

  SELECT array_agg(DISTINCT v)
  INTO members
  FROM unnest(array_append(p_members, me)) v
  WHERE v IS NOT NULL;

  IF cardinality(members) NOT BETWEEN 2 AND 100 THEN
    RAISE EXCEPTION 'Choose 2-100 members';
  END IF;

  IF p_department IS NOT NULL
     AND NOT public.can_create_department_chat(me) THEN
    RAISE EXCEPTION 'Trusted permission required' USING ERRCODE = '42501';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(p_request::text, 1));

  SELECT id
  INTO result
  FROM public.chat_rooms
  WHERE id = p_request
    AND created_by = me;

  IF result IS NOT NULL THEN
    RETURN result;
  END IF;

  INSERT INTO public.chat_rooms(id, kind, title, department_id, created_by)
  VALUES (
    p_request,
    CASE WHEN p_department IS NULL THEN 'group' ELSE 'department' END,
    btrim(p_title),
    p_department,
    me
  )
  RETURNING id INTO result;

  INSERT INTO public.chat_members(room_id, user_id, role)
  SELECT
    result,
    v,
    CASE WHEN v = me THEN 'owner' ELSE 'member' END
  FROM unnest(members) v;

  RETURN result;
END
$$;

CREATE OR REPLACE FUNCTION public.chat_send(
  p_room uuid,
  p_body text,
  p_id uuid
)
RETURNS public.chat_messages
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  me uuid := auth.uid();
  result public.chat_messages;
BEGIN
  PERFORM 1
  FROM public.chat_rooms
  WHERE id = p_room
  FOR UPDATE;

  IF me IS NULL OR NOT public.is_room_member(p_room, me) THEN
    RAISE EXCEPTION 'Not a member' USING ERRCODE = '42501';
  END IF;

  IF p_body IS NULL OR length(btrim(p_body)) NOT BETWEEN 1 AND 10000 THEN
    RAISE EXCEPTION 'Message must contain 1-10000 characters';
  END IF;

  SELECT *
  INTO result
  FROM public.chat_messages
  WHERE id = p_id;

  IF FOUND THEN
    IF result.room_id <> p_room
       OR result.sender_id <> me
       OR result.body <> btrim(p_body) THEN
      RAISE EXCEPTION 'Message ID conflict';
    END IF;
    RETURN result;
  END IF;

  INSERT INTO public.chat_messages(id, room_id, sender_id, body, created_at)
  VALUES (p_id, p_room, me, btrim(p_body), clock_timestamp())
  RETURNING * INTO result;

  RETURN result;
END
$$;

CREATE OR REPLACE FUNCTION public.chat_mark_read(
  p_room uuid,
  p_message uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  n bigint;
  t timestamptz;
BEGIN
  IF auth.uid() IS NULL
     OR NOT public.is_room_member(p_room, auth.uid()) THEN
    RAISE EXCEPTION 'Not a member' USING ERRCODE = '42501';
  END IF;

  SELECT seq, created_at
  INTO n, t
  FROM public.chat_messages
  WHERE id = p_message
    AND room_id = p_room;

  IF n IS NULL THEN
    RAISE EXCEPTION 'Message not found';
  END IF;

  UPDATE public.chat_members
  SET
    last_read_seq = greatest(last_read_seq, n),
    last_read_at = greatest(last_read_at, t)
  WHERE room_id = p_room
    AND user_id = auth.uid()
    AND last_read_seq < n;
END
$$;

CREATE OR REPLACE FUNCTION public.chat_manage_member(
  p_room uuid,
  p_user uuid,
  p_action text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  me uuid := auth.uid();
  my_role text;
  room_kind text;
  owner_id uuid;
  successor uuid;
BEGIN
  SELECT kind, created_by
  INTO room_kind, owner_id
  FROM public.chat_rooms
  WHERE id = p_room
  FOR UPDATE;

  SELECT role
  INTO my_role
  FROM public.chat_members
  WHERE room_id = p_room
    AND user_id = me
    AND left_at IS NULL;

  IF me IS NULL OR my_role IS NULL THEN
    RAISE EXCEPTION 'Not a member' USING ERRCODE = '42501';
  END IF;

  IF p_action = 'leave' AND p_user = me THEN
    IF owner_id = me AND room_kind <> 'direct' THEN
      SELECT user_id
      INTO successor
      FROM public.chat_members
      WHERE room_id = p_room
        AND user_id <> me
        AND left_at IS NULL
      ORDER BY (role = 'admin') DESC, joined_at, user_id
      LIMIT 1;

      IF successor IS NOT NULL THEN
        UPDATE public.chat_rooms
        SET created_by = successor
        WHERE id = p_room;

        UPDATE public.chat_members
        SET role = 'owner'
        WHERE room_id = p_room
          AND user_id = successor;
      END IF;
    END IF;

    UPDATE public.chat_members
    SET left_at = clock_timestamp(), role = 'member'
    WHERE room_id = p_room
      AND user_id = me;

    RETURN;
  END IF;

  IF my_role NOT IN ('owner', 'admin')
     OR room_kind = 'direct'
     OR p_user = owner_id THEN
    RAISE EXCEPTION 'Room management denied' USING ERRCODE = '42501';
  END IF;

  IF p_action = 'remove' THEN
    UPDATE public.chat_members
    SET left_at = clock_timestamp()
    WHERE room_id = p_room
      AND user_id = p_user;
  ELSIF p_action IN ('member', 'admin') THEN
    IF (
      SELECT count(*)
      FROM public.chat_members
      WHERE room_id = p_room
        AND left_at IS NULL
    ) >= 100
    AND NOT EXISTS (
      SELECT 1
      FROM public.chat_members
      WHERE room_id = p_room
        AND user_id = p_user
        AND left_at IS NULL
    ) THEN
      RAISE EXCEPTION 'Member limit';
    END IF;

    INSERT INTO public.chat_members(room_id, user_id, role)
    VALUES (p_room, p_user, p_action)
    ON CONFLICT (room_id, user_id)
    DO UPDATE SET left_at = NULL, role = excluded.role;
  ELSE
    RAISE EXCEPTION 'Invalid action';
  END IF;
END
$$;

CREATE OR REPLACE FUNCTION public.chat_rename(
  p_room uuid,
  p_title text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM 1
  FROM public.chat_rooms
  WHERE id = p_room
  FOR UPDATE;

  IF auth.uid() IS NULL
     OR NOT EXISTS (
       SELECT 1
       FROM public.chat_members
       WHERE room_id = p_room
         AND user_id = auth.uid()
         AND left_at IS NULL
         AND role IN ('owner', 'admin')
     ) THEN
    RAISE EXCEPTION 'Room management denied' USING ERRCODE = '42501';
  END IF;

  IF p_title IS NULL OR length(btrim(p_title)) NOT BETWEEN 1 AND 120 THEN
    RAISE EXCEPTION 'Invalid title';
  END IF;

  UPDATE public.chat_rooms
  SET title = btrim(p_title)
  WHERE id = p_room
    AND kind <> 'direct';
END
$$;

CREATE OR REPLACE FUNCTION public.bump_room_last_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.chat_rooms
  SET
    last_message_text = left(NEW.body, 200),
    last_message_at = NEW.created_at
  WHERE id = NEW.room_id;
  RETURN NEW;
END
$$;

DROP POLICY IF EXISTS "chat_rooms_member_read" ON public.chat_rooms;
DROP POLICY IF EXISTS "chat_rooms_insert" ON public.chat_rooms;
DROP POLICY IF EXISTS "chat_rooms_owner_update" ON public.chat_rooms;

DROP POLICY IF EXISTS "chat_members_read" ON public.chat_members;
DROP POLICY IF EXISTS "chat_members_insert" ON public.chat_members;
DROP POLICY IF EXISTS "chat_members_self_update" ON public.chat_members;
DROP POLICY IF EXISTS "chat_members_leave" ON public.chat_members;

DROP POLICY IF EXISTS "chat_messages_member_read" ON public.chat_messages;
DROP POLICY IF EXISTS "chat_messages_member_insert" ON public.chat_messages;
DROP POLICY IF EXISTS "chat_messages_sender_delete" ON public.chat_messages;

DROP POLICY IF EXISTS "chat_rooms_read" ON public.chat_rooms;
CREATE POLICY "chat_rooms_read"
  ON public.chat_rooms FOR SELECT
  TO authenticated
  USING (public.is_room_member(id, auth.uid()));

DROP POLICY IF EXISTS "chat_members_read" ON public.chat_members;
CREATE POLICY "chat_members_read"
  ON public.chat_members FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR public.is_room_member(room_id, auth.uid())
  );

DROP POLICY IF EXISTS "chat_messages_read" ON public.chat_messages;
CREATE POLICY "chat_messages_read"
  ON public.chat_messages FOR SELECT
  TO authenticated
  USING (public.is_room_member(room_id, auth.uid()));

REVOKE ALL ON FUNCTION public.is_room_member(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.can_create_department_chat(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_or_create_direct_chat(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.chat_create_group(text, uuid[], uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.chat_send(uuid, text, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.chat_mark_read(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.chat_manage_member(uuid, uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.chat_rename(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.bump_room_last_message() FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.is_room_member(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_create_department_chat(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_or_create_direct_chat(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.chat_create_group(text, uuid[], uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.chat_send(uuid, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.chat_mark_read(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.chat_manage_member(uuid, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.chat_rename(uuid, text) TO authenticated;
