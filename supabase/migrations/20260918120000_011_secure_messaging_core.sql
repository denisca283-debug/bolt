-- Canonical messaging core. Apply 010 and 011 in one maintenance transaction
-- on databases still at 009; never expose 010 alone. Legacy data is retained.
ALTER TABLE public.chat_rooms ADD COLUMN direct_a uuid REFERENCES public.profiles(id);
ALTER TABLE public.chat_rooms ADD COLUMN direct_b uuid REFERENCES public.profiles(id);
ALTER TABLE public.chat_members ADD COLUMN left_at timestamptz;
ALTER TABLE public.chat_members ADD COLUMN last_read_seq bigint NOT NULL DEFAULT 0;
ALTER TABLE public.chat_messages ADD COLUMN seq bigint;
-- Backfill in chronological order, not physical heap order.
WITH ordered AS (
 SELECT id,row_number() OVER(ORDER BY created_at,id) n FROM public.chat_messages
)
UPDATE public.chat_messages m SET seq=o.n FROM ordered o WHERE o.id=m.id;
ALTER TABLE public.chat_messages ALTER COLUMN seq SET NOT NULL;
ALTER TABLE public.chat_messages ALTER COLUMN seq ADD GENERATED ALWAYS AS IDENTITY;
SELECT setval(pg_get_serial_sequence('public.chat_messages','seq'),
 coalesce((SELECT max(seq) FROM public.chat_messages),0)+1,false);
UPDATE public.chat_members m SET last_read_seq=coalesce((
 SELECT max(seq) FROM public.chat_messages msg
 WHERE msg.room_id=m.room_id AND msg.created_at<=m.last_read_at),0);
CREATE UNIQUE INDEX chat_messages_seq_key ON public.chat_messages(seq);
CREATE INDEX chat_members_user_active ON public.chat_members(user_id, room_id) WHERE left_at IS NULL;
CREATE INDEX chat_messages_room_seq ON public.chat_messages(room_id, seq DESC);
UPDATE public.chat_rooms r SET last_message_text=left(m.body,200),last_message_at=m.created_at
FROM (SELECT DISTINCT ON(room_id) room_id,body,created_at FROM public.chat_messages ORDER BY room_id,seq DESC) m
WHERE m.room_id=r.id;
-- Preserve all old data. Ambiguous/duplicate legacy direct rooms require a reviewed
-- data migration, not automatic deletion or silently choosing one conversation.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.chat_rooms r WHERE kind='direct' AND (
    (SELECT count(*) FROM public.chat_members m WHERE m.room_id=r.id) <> 2 OR
    NOT EXISTS(SELECT 1 FROM public.chat_members m WHERE m.room_id=r.id AND m.user_id=r.created_by)))
  THEN RAISE EXCEPTION 'Invalid legacy direct membership: reconcile before 011'; END IF;
END $$;
UPDATE public.chat_rooms r SET direct_a=x.a, direct_b=x.b FROM (
 SELECT room_id, (array_agg(user_id ORDER BY user_id))[1] a,
 (array_agg(user_id ORDER BY user_id))[2] b FROM public.chat_members GROUP BY room_id
) x WHERE r.id=x.room_id AND r.kind='direct';
ALTER TABLE public.chat_rooms ADD CONSTRAINT chat_direct_pair_check CHECK (
 (kind='direct' AND direct_a IS NOT NULL AND direct_b IS NOT NULL AND direct_a<direct_b)
 OR (kind<>'direct' AND direct_a IS NULL AND direct_b IS NULL));
CREATE UNIQUE INDEX chat_direct_pair_unique ON public.chat_rooms(direct_a,direct_b) WHERE kind='direct';
-- Repair ownership of existing rooms without removing membership/history.
INSERT INTO public.chat_members(room_id,user_id,role)
 SELECT id,created_by,'owner' FROM public.chat_rooms
 ON CONFLICT(room_id,user_id) DO UPDATE SET role='owner';
UPDATE public.chat_members m SET role='member' FROM public.chat_rooms r
 WHERE m.room_id=r.id AND m.user_id<>r.created_by AND m.role NOT IN ('admin','member');
ALTER TABLE public.chat_members ADD CONSTRAINT chat_member_role_check CHECK(role IN ('owner','admin','member'));
-- Remove every previous policy on canonical tables, including permissive additions.
DO $$ DECLARE p record;
BEGIN
 FOR p IN SELECT tablename,policyname FROM pg_policies WHERE schemaname='public'
   AND tablename IN ('chat_rooms','chat_members','chat_messages')
 LOOP EXECUTE format('DROP POLICY %I ON public.%I',p.policyname,p.tablename); END LOOP;
END $$;
REVOKE ALL ON public.chat_rooms,public.chat_members,public.chat_messages FROM PUBLIC,anon,authenticated;
REVOKE ALL ON SEQUENCE public.chat_messages_seq_seq FROM PUBLIC,anon,authenticated;
-- Required because SECURITY DEFINER functions intentionally resolve through public.
-- Untrusted roles must never be able to shadow a referenced function in that schema.
REVOKE CREATE ON SCHEMA public FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.chat_rooms,public.chat_members,public.chat_messages TO authenticated;
ALTER TABLE public.chat_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
-- Legacy tables remain readable under their existing RLS. All new writes disabled.
REVOKE INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER ON public.conversations,public.messages FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION public.is_room_member(p_room uuid,p_user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public
AS $$ SELECT p_user=auth.uid() AND EXISTS(SELECT 1 FROM public.chat_members
 WHERE room_id=p_room AND user_id=auth.uid() AND left_at IS NULL) $$;
CREATE OR REPLACE FUNCTION public.can_create_department_chat(p_user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public
AS $$ SELECT p_user=auth.uid() AND EXISTS(
 SELECT 1 FROM public.user_permissions u JOIN public.permissions p ON p.id=u.permission_id
 WHERE u.user_id=auth.uid() AND p.name='create_professional_discussion') $$;
CREATE POLICY chat_rooms_read ON public.chat_rooms FOR SELECT TO authenticated
 USING(public.is_room_member(id,auth.uid()));
-- Own tombstone is visible so removal is delivered via UPDATE (no DELETE leak).
CREATE POLICY chat_members_read ON public.chat_members FOR SELECT TO authenticated
 USING(user_id=auth.uid() OR public.is_room_member(room_id,auth.uid()));
CREATE POLICY chat_messages_read ON public.chat_messages FOR SELECT TO authenticated
 USING(public.is_room_member(room_id,auth.uid()));

CREATE FUNCTION public.get_or_create_direct_chat(other_user_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE me uuid:=auth.uid(); result uuid; a uuid; b uuid;
BEGIN
 IF me IS NULL OR other_user_id IS NULL OR me=other_user_id THEN RAISE EXCEPTION 'Invalid participants' USING ERRCODE='42501'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=other_user_id) THEN RAISE EXCEPTION 'Target profile not found' USING ERRCODE='P0002'; END IF;
 a:=least(me,other_user_id); b:=greatest(me,other_user_id);
 -- Pair-scoped serialization plus a UNIQUE index protects concurrent A→B/B→A.
 PERFORM pg_advisory_xact_lock(hashtextextended(a::text||b::text,0));
 SELECT id INTO result FROM public.chat_rooms WHERE direct_a=a AND direct_b=b AND kind='direct' FOR UPDATE;
 IF result IS NULL THEN
   INSERT INTO public.chat_rooms(kind,created_by,direct_a,direct_b) VALUES('direct',me,a,b) RETURNING id INTO result;
   INSERT INTO public.chat_members(room_id,user_id,role) VALUES(result,me,'owner'),(result,other_user_id,'member');
 ELSE
   -- A former direct participant may reopen their own room, never another room.
   UPDATE public.chat_members SET left_at=NULL WHERE room_id=result AND user_id=me;
 END IF;
 RETURN result;
END $$;

CREATE FUNCTION public.chat_create_group(p_title text,p_members uuid[],p_department uuid DEFAULT NULL,p_request uuid DEFAULT gen_random_uuid())
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE me uuid:=auth.uid(); result uuid; members uuid[];
BEGIN
 IF me IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
 IF p_title IS NULL OR length(btrim(p_title)) NOT BETWEEN 1 AND 120 THEN RAISE EXCEPTION 'Invalid title'; END IF;
 SELECT array_agg(DISTINCT v) INTO members FROM unnest(array_append(p_members,me)) v WHERE v IS NOT NULL;
 IF cardinality(members) NOT BETWEEN 2 AND 100 THEN RAISE EXCEPTION 'Choose 2-100 members'; END IF;
 IF p_department IS NOT NULL AND NOT public.can_create_department_chat(me)
 THEN RAISE EXCEPTION 'Trusted permission required' USING ERRCODE='42501'; END IF;
 -- Request UUID makes retries after a lost response idempotent.
 PERFORM pg_advisory_xact_lock(hashtextextended(p_request::text,1));
 SELECT id INTO result FROM public.chat_rooms WHERE id=p_request AND created_by=me;
 IF result IS NOT NULL THEN RETURN result; END IF;
 INSERT INTO public.chat_rooms(id,kind,title,department_id,created_by)
 VALUES(p_request,CASE WHEN p_department IS NULL THEN 'group' ELSE 'department' END,btrim(p_title),p_department,me)
 RETURNING id INTO result;
 INSERT INTO public.chat_members(room_id,user_id,role)
 SELECT result,v,CASE WHEN v=me THEN 'owner' ELSE 'member' END FROM unnest(members) v;
 RETURN result;
END $$;

CREATE FUNCTION public.chat_manage_member(p_room uuid,p_user uuid,p_action text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE me uuid:=auth.uid(); my_role text; room_kind text; owner_id uuid; successor uuid;
BEGIN
 SELECT kind,created_by INTO room_kind,owner_id FROM public.chat_rooms WHERE id=p_room FOR UPDATE;
 SELECT role INTO my_role FROM public.chat_members WHERE room_id=p_room AND user_id=me AND left_at IS NULL;
 IF me IS NULL OR my_role IS NULL THEN RAISE EXCEPTION 'Not a member' USING ERRCODE='42501'; END IF;
 IF p_action='leave' AND p_user=me THEN
   IF owner_id=me AND room_kind<>'direct' THEN
     SELECT user_id INTO successor FROM public.chat_members WHERE room_id=p_room AND user_id<>me AND left_at IS NULL
     ORDER BY (role='admin') DESC,joined_at,user_id LIMIT 1;
     IF successor IS NOT NULL THEN
       UPDATE public.chat_rooms SET created_by=successor WHERE id=p_room;
       UPDATE public.chat_members SET role='owner' WHERE room_id=p_room AND user_id=successor;
     END IF;
   END IF;
   UPDATE public.chat_members SET left_at=clock_timestamp(),role='member' WHERE room_id=p_room AND user_id=me;
   RETURN;
 END IF;
 IF my_role NOT IN ('owner','admin') OR room_kind='direct' OR p_user=owner_id
 THEN RAISE EXCEPTION 'Room management denied' USING ERRCODE='42501'; END IF;
 IF p_action='remove' THEN
   UPDATE public.chat_members SET left_at=clock_timestamp() WHERE room_id=p_room AND user_id=p_user;
 ELSIF p_action IN ('member','admin') THEN
   IF (SELECT count(*) FROM public.chat_members WHERE room_id=p_room AND left_at IS NULL)>=100
     AND NOT EXISTS(SELECT 1 FROM public.chat_members WHERE room_id=p_room AND user_id=p_user AND left_at IS NULL)
   THEN RAISE EXCEPTION 'Member limit'; END IF;
   INSERT INTO public.chat_members(room_id,user_id,role) VALUES(p_room,p_user,p_action)
   ON CONFLICT(room_id,user_id) DO UPDATE SET left_at=NULL,role=excluded.role;
 ELSE RAISE EXCEPTION 'Invalid action'; END IF;
END $$;

CREATE FUNCTION public.chat_rename(p_room uuid,p_title text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 PERFORM 1 FROM public.chat_rooms WHERE id=p_room FOR UPDATE;
 IF auth.uid() IS NULL OR NOT EXISTS(SELECT 1 FROM public.chat_members
 WHERE room_id=p_room AND user_id=auth.uid() AND left_at IS NULL AND role IN ('owner','admin'))
 THEN RAISE EXCEPTION 'Room management denied' USING ERRCODE='42501'; END IF;
 IF length(btrim(p_title)) NOT BETWEEN 1 AND 120 OR p_title IS NULL THEN RAISE EXCEPTION 'Invalid title'; END IF;
 UPDATE public.chat_rooms SET title=btrim(p_title) WHERE id=p_room AND kind<>'direct';
END $$;

CREATE FUNCTION public.chat_send(p_room uuid,p_body text,p_id uuid)
RETURNS public.chat_messages LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE me uuid:=auth.uid(); result public.chat_messages;
BEGIN
 PERFORM 1 FROM public.chat_rooms WHERE id=p_room FOR UPDATE;
 IF me IS NULL OR NOT public.is_room_member(p_room,me) THEN RAISE EXCEPTION 'Not a member' USING ERRCODE='42501'; END IF;
 IF p_body IS NULL OR length(btrim(p_body)) NOT BETWEEN 1 AND 10000 THEN RAISE EXCEPTION 'Message must contain 1-10000 characters'; END IF;
 SELECT * INTO result FROM public.chat_messages WHERE id=p_id;
 IF FOUND THEN
   IF result.room_id<>p_room OR result.sender_id<>me OR result.body<>btrim(p_body) THEN RAISE EXCEPTION 'Message ID conflict'; END IF;
   RETURN result;
 END IF;
 INSERT INTO public.chat_messages(id,room_id,sender_id,body,created_at)
 VALUES(p_id,p_room,me,btrim(p_body),clock_timestamp()) RETURNING * INTO result;
 RETURN result;
END $$;
CREATE OR REPLACE FUNCTION public.bump_room_last_message()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 UPDATE public.chat_rooms SET last_message_text=left(NEW.body,200),last_message_at=NEW.created_at WHERE id=NEW.room_id;
 RETURN NEW;
END $$;

CREATE FUNCTION public.chat_mark_read(p_room uuid,p_message uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE n bigint; t timestamptz;
BEGIN
 IF auth.uid() IS NULL OR NOT public.is_room_member(p_room,auth.uid()) THEN RAISE EXCEPTION 'Not a member' USING ERRCODE='42501'; END IF;
 SELECT seq,created_at INTO n,t FROM public.chat_messages WHERE id=p_message AND room_id=p_room;
 IF n IS NULL THEN RAISE EXCEPTION 'Message not found'; END IF;
 UPDATE public.chat_members SET last_read_seq=greatest(last_read_seq,n),
   last_read_at=greatest(last_read_at,t) WHERE room_id=p_room AND user_id=auth.uid() AND last_read_seq<n;
END $$;

CREATE FUNCTION public.chat_list(p_query text DEFAULT '',p_offset integer DEFAULT 0)
RETURNS TABLE(id uuid,kind text,title text,last_message_text text,last_message_at timestamptz,unread bigint)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path=public AS $$
 SELECT r.id,r.kind,
 CASE WHEN r.kind='direct' THEN coalesce(peer.full_name,'Участник FilmVerse') ELSE r.title END,
 r.last_message_text,r.last_message_at,
 (SELECT count(*) FROM public.chat_messages msg WHERE msg.room_id=r.id AND msg.seq>m.last_read_seq AND msg.sender_id<>auth.uid())
 FROM public.chat_rooms r JOIN public.chat_members m ON m.room_id=r.id AND m.user_id=auth.uid() AND m.left_at IS NULL
 LEFT JOIN public.profiles peer ON peer.id=CASE WHEN r.direct_a=auth.uid() THEN r.direct_b ELSE r.direct_a END
 WHERE coalesce(CASE WHEN r.kind='direct' THEN peer.full_name ELSE r.title END,'') ILIKE '%'||left(p_query,120)||'%'
 ORDER BY coalesce(r.last_message_at,r.created_at) DESC,r.id LIMIT 50 OFFSET greatest(p_offset,0)
$$;

-- No client can grant the trusted capability to themselves.
CREATE FUNCTION public.chat_unread_total()
RETURNS bigint LANGUAGE sql STABLE SECURITY INVOKER SET search_path=public AS $$
 SELECT count(*) FROM public.chat_messages msg JOIN public.chat_members m ON m.room_id=msg.room_id
 WHERE m.user_id=auth.uid() AND m.left_at IS NULL AND msg.seq>m.last_read_seq AND msg.sender_id<>auth.uid()
$$;
REVOKE INSERT,UPDATE,DELETE ON public.user_permissions,public.permissions FROM PUBLIC,anon,authenticated;
-- Restrict all helpers/RPCs; trigger functions are not callable APIs.
DO $$ DECLARE f record;
BEGIN
 FOR f IN SELECT p.oid::regprocedure signature,p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname='public' AND p.proname IN (
 'is_room_member','can_create_department_chat','bump_room_last_message','get_or_create_direct_chat',
 'chat_create_group','chat_manage_member','chat_rename','chat_send','chat_mark_read','chat_list','chat_unread_total')
 LOOP
   EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated',f.signature);
   IF f.proname<>'bump_room_last_message' THEN
     EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated',f.signature);
   END IF;
 END LOOP;
END $$;
-- UPDATE tombstones, not DELETE events. RLS checks every delivered row.
DO $$ DECLARE t text;
BEGIN
 IF EXISTS(SELECT 1 FROM pg_publication WHERE pubname='supabase_realtime') THEN
  FOREACH t IN ARRAY ARRAY['chat_rooms','chat_members','chat_messages'] LOOP
   IF NOT EXISTS(SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename=t)
   THEN EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I',t); END IF;
  END LOOP;
 END IF;
END $$;
