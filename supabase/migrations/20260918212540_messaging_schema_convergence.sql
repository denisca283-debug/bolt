-- Converge the restored 011 with the deployed messaging API/security boundary.
-- Applies AFTER 011. Never renumber message sequences or reset read receipts.
BEGIN;
SET LOCAL lock_timeout = '5s';
LOCK TABLE public.chat_rooms, public.chat_members, public.chat_messages IN SHARE ROW EXCLUSIVE MODE;

-- Do not silently repair ambiguous data, choose a winning room or delete history.
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM public.chat_rooms r WHERE r.kind = 'direct' AND (
      (SELECT count(*) FROM public.chat_members m WHERE m.room_id = r.id) <> 2
      OR NOT EXISTS (SELECT 1 FROM public.chat_members m WHERE m.room_id = r.id AND m.user_id = r.direct_a)
      OR NOT EXISTS (SELECT 1 FROM public.chat_members m WHERE m.room_id = r.id AND m.user_id = r.direct_b)
    )
  ) THEN
    RAISE EXCEPTION 'Direct room membership inconsistent; reviewed data repair required';
  END IF;
END $$;

REVOKE CREATE ON SCHEMA public FROM PUBLIC, anon, authenticated;

-- Positive-list grants, including cleanup of any old column grants.
DO $$ DECLARE t text; columns text; BEGIN
  FOREACH t IN ARRAY ARRAY['chat_rooms','chat_members','chat_messages','conversations','messages'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC, anon, authenticated', t);
    SELECT string_agg(quote_ident(attname), ', ' ORDER BY attnum) INTO columns
    FROM pg_attribute WHERE attrelid = format('public.%I', t)::regclass AND attnum > 0 AND NOT attisdropped;
    EXECUTE format('REVOKE SELECT (%1$s), INSERT (%1$s), UPDATE (%1$s), REFERENCES (%1$s) ON public.%2$I FROM PUBLIC, anon, authenticated', columns, t);
    EXECUTE format('GRANT SELECT ON public.%I TO authenticated', t);
  END LOOP;
  EXECUTE format('REVOKE ALL ON SEQUENCE %s FROM PUBLIC, anon, authenticated',
    pg_get_serial_sequence('public.chat_messages', 'seq'));
END $$;

-- Canonical tables expose only membership-scoped reads; writes use checked RPCs.
DO $$ DECLARE p record; BEGIN
  FOR p IN SELECT tablename, policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename IN ('chat_rooms','chat_members','chat_messages')
  LOOP EXECUTE format('DROP POLICY %I ON public.%I', p.policyname, p.tablename); END LOOP;
END $$;
CREATE POLICY chat_rooms_read ON public.chat_rooms FOR SELECT TO authenticated
  USING (public.is_room_member(id, auth.uid()));
CREATE POLICY chat_members_read ON public.chat_members FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_room_member(room_id, auth.uid()));
CREATE POLICY chat_messages_read ON public.chat_messages FOR SELECT TO authenticated
  USING (public.is_room_member(room_id, auth.uid()));

-- No paid flag can grant a trusted capability. Retain the existing RLS as well.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON public.permissions, public.user_permissions FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.chat_list(p_query text DEFAULT '', p_offset integer DEFAULT 0)
RETURNS TABLE(id uuid, kind text, title text, last_message_text text, last_message_at timestamptz, unread bigint)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT r.id, r.kind,
    CASE WHEN r.kind = 'direct' THEN coalesce(peer.full_name, 'Участник FilmVerse') ELSE r.title END,
    r.last_message_text, r.last_message_at,
    (SELECT count(*) FROM public.chat_messages msg
     WHERE msg.room_id = r.id AND msg.seq > m.last_read_seq AND msg.sender_id <> auth.uid())
  FROM public.chat_rooms r
  JOIN public.chat_members m ON m.room_id = r.id AND m.user_id = auth.uid() AND m.left_at IS NULL
  LEFT JOIN public.profiles peer ON peer.id = CASE WHEN r.direct_a = auth.uid() THEN r.direct_b ELSE r.direct_a END
  WHERE coalesce(CASE WHEN r.kind = 'direct' THEN peer.full_name ELSE r.title END, '')
    ILIKE '%' || left(coalesce(p_query, ''), 120) || '%'
  ORDER BY coalesce(r.last_message_at, r.created_at) DESC, r.id
  LIMIT 50 OFFSET greatest(p_offset, 0)
$$;

CREATE OR REPLACE FUNCTION public.chat_unread_total()
RETURNS bigint LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT count(*) FROM public.chat_messages msg
  JOIN public.chat_members m ON m.room_id = msg.room_id
  WHERE m.user_id = auth.uid() AND m.left_at IS NULL
    AND msg.seq > m.last_read_seq AND msg.sender_id <> auth.uid()
$$;

-- Explicit signatures: do not accidentally grant an unexpected overload.
REVOKE ALL ON FUNCTION public.chat_list(text, integer), public.chat_unread_total() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.chat_list(text, integer), public.chat_unread_total() TO authenticated;
REVOKE ALL ON FUNCTION public.bump_room_last_message() FROM PUBLIC, anon, authenticated;

-- Registration is not proof of websocket delivery; verify that in staging.
DO $$ DECLARE t text; BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    RAISE EXCEPTION 'supabase_realtime publication missing; configure Realtime before applying';
  END IF;
  FOREACH t IN ARRAY ARRAY['chat_rooms','chat_members','chat_messages'] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = t) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    END IF;
  END LOOP;
END $$;
COMMIT;
