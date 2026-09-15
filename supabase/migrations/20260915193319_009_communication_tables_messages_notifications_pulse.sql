/*
# Communication tables: conversations, messages, notifications, pulse_feed

## Overview
This migration creates the tables that power the messaging system,
notification center, and industry activity feed ("Пульс индустрии").
These replace the hardcoded mock data previously used in the UI.

## New Tables

### 1. conversations
1:1 messaging threads between two users.
- `id` (uuid, PK)
- `participant_a` (uuid, not null, default auth.uid(), FK → profiles.id ON DELETE CASCADE)
- `participant_b` (uuid, not null, FK → profiles.id ON DELETE CASCADE)
- `last_message_text` (text, nullable) — denormalized for quick preview
- `last_message_at` (timestamptz, nullable) — for sorting
- `created_at` (timestamptz)
- UNIQUE(participant_a, participant_b) — one conversation per pair

### 2. messages
Individual messages within a conversation.
- `id` (uuid, PK)
- `conversation_id` (uuid, not null, FK → conversations.id ON DELETE CASCADE)
- `sender_id` (uuid, not null, default auth.uid(), FK → profiles.id ON DELETE CASCADE)
- `receiver_id` (uuid, not null, FK → profiles.id ON DELETE CASCADE)
- `body` (text, not null) — message content
- `read_at` (timestamptz, nullable) — null = unread by receiver
- `created_at` (timestamptz)

### 3. notifications
User-specific notification feed.
- `id` (uuid, PK)
- `user_id` (uuid, not null, default auth.uid(), FK → profiles.id ON DELETE CASCADE)
- `icon` (text, nullable) — icon key ('mail', 'briefcase', 'users', 'star')
- `title` (text, not null)
- `body` (text, nullable) — notification text
- `read_at` (timestamptz, nullable) — null = unread
- `created_at` (timestamptz)

### 4. pulse_feed
Industry-wide activity feed entries ("Пульс индустрии").
- `id` (uuid, PK)
- `user_id` (uuid, nullable, FK → profiles.id ON DELETE SET NULL) — who performed the action
- `kind` (text, not null) — 'role', 'crew-search', 'portfolio', 'join', 'spots', 'marketplace', 'team-complete'
- `person` (text, not null) — display name of the actor
- `initials` (text, nullable) — avatar initials
- `photo_url` (text, nullable) — avatar photo URL
- `action` (text, not null) — what they did (e.g. 'получила роль в проекте')
- `target` (text, nullable) — what they did it with (e.g. '«Тихая гавань»')
- `created_at` (timestamptz)

## Security (RLS + Policies)

### conversations
- SELECT: authenticated, must be a participant (participant_a OR participant_b)
- INSERT: authenticated, must be participant_a (the initiator, defaults to auth.uid())
- UPDATE: authenticated, must be a participant (for updating last_message preview)
- DELETE: authenticated, must be a participant

### messages
- SELECT: authenticated, must be sender or receiver OR participant in the conversation
- INSERT: authenticated, sender must be auth.uid()
- UPDATE: authenticated, receiver can mark as read (auth.uid() = receiver_id)
- DELETE: authenticated, sender or receiver

### notifications
- SELECT: authenticated, owner only (auth.uid() = user_id)
- INSERT: authenticated (user_id defaults to auth.uid())
- UPDATE: authenticated, owner only (for marking as read)
- DELETE: authenticated, owner only

### pulse_feed
- SELECT: public (anon + authenticated) — activity feed is browsable by everyone
- INSERT: authenticated (user_id defaults to auth.uid())
- UPDATE: authenticated, owner only
- DELETE: authenticated, owner only

## Indexes
- conversations: participant_a, participant_b, (participant_a, participant_b) unique
- messages: conversation_id, sender_id, receiver_id, created_at
- notifications: user_id, created_at, read_at
- pulse_feed: created_at, kind
*/

-- ═══════════════════════════════════════════════════════════════
-- 1. conversations
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_a uuid NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE,
  participant_b uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  last_message_text text,
  last_message_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;

CREATE UNIQUE INDEX IF NOT EXISTS conversations_pair_key
  ON conversations (LEAST(participant_a, participant_b), GREATEST(participant_a, participant_b));
CREATE INDEX IF NOT EXISTS conversations_participant_a_idx ON conversations(participant_a);
CREATE INDEX IF NOT EXISTS conversations_participant_b_idx ON conversations(participant_b);

DROP POLICY IF EXISTS "conversations_participant_select" ON conversations;
CREATE POLICY "conversations_participant_select"
  ON conversations FOR SELECT
  TO authenticated
  USING (auth.uid() = participant_a OR auth.uid() = participant_b);

DROP POLICY IF EXISTS "conversations_owner_insert" ON conversations;
CREATE POLICY "conversations_owner_insert"
  ON conversations FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = participant_a);

DROP POLICY IF EXISTS "conversations_participant_update" ON conversations;
CREATE POLICY "conversations_participant_update"
  ON conversations FOR UPDATE
  TO authenticated
  USING (auth.uid() = participant_a OR auth.uid() = participant_b)
  WITH CHECK (auth.uid() = participant_a OR auth.uid() = participant_b);

DROP POLICY IF EXISTS "conversations_participant_delete" ON conversations;
CREATE POLICY "conversations_participant_delete"
  ON conversations FOR DELETE
  TO authenticated
  USING (auth.uid() = participant_a OR auth.uid() = participant_b);

-- ═══════════════════════════════════════════════════════════════
-- 2. messages
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE,
  receiver_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  body text NOT NULL,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS messages_conversation_id_idx ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS messages_sender_id_idx ON messages(sender_id);
CREATE INDEX IF NOT EXISTS messages_receiver_id_idx ON messages(receiver_id);
CREATE INDEX IF NOT EXISTS messages_created_at_idx ON messages(created_at);

DROP POLICY IF EXISTS "messages_participant_select" ON messages;
CREATE POLICY "messages_participant_select"
  ON messages FOR SELECT
  TO authenticated
  USING (
    auth.uid() = sender_id
    OR auth.uid() = receiver_id
    OR EXISTS (
      SELECT 1 FROM conversations c
      WHERE c.id = messages.conversation_id
      AND (c.participant_a = auth.uid() OR c.participant_b = auth.uid())
    )
  );

DROP POLICY IF EXISTS "messages_owner_insert" ON messages;
CREATE POLICY "messages_owner_insert"
  ON messages FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = sender_id);

DROP POLICY IF EXISTS "messages_receiver_update" ON messages;
CREATE POLICY "messages_receiver_update"
  ON messages FOR UPDATE
  TO authenticated
  USING (auth.uid() = receiver_id)
  WITH CHECK (auth.uid() = receiver_id);

DROP POLICY IF EXISTS "messages_owner_delete" ON messages;
CREATE POLICY "messages_owner_delete"
  ON messages FOR DELETE
  TO authenticated
  USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

-- ═══════════════════════════════════════════════════════════════
-- 3. notifications
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE,
  icon text,
  title text NOT NULL,
  body text,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS notifications_user_id_idx ON notifications(user_id);
CREATE INDEX IF NOT EXISTS notifications_created_at_idx ON notifications(created_at DESC);

DROP POLICY IF EXISTS "notifications_owner_select" ON notifications;
CREATE POLICY "notifications_owner_select"
  ON notifications FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "notifications_owner_insert" ON notifications;
CREATE POLICY "notifications_owner_insert"
  ON notifications FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "notifications_owner_update" ON notifications;
CREATE POLICY "notifications_owner_update"
  ON notifications FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "notifications_owner_delete" ON notifications;
CREATE POLICY "notifications_owner_delete"
  ON notifications FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- ═══════════════════════════════════════════════════════════════
-- 4. pulse_feed
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS pulse_feed (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  kind text NOT NULL,
  person text NOT NULL,
  initials text,
  photo_url text,
  action text NOT NULL,
  target text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE pulse_feed ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS pulse_feed_created_at_idx ON pulse_feed(created_at DESC);
CREATE INDEX IF NOT EXISTS pulse_feed_kind_idx ON pulse_feed(kind);

DROP POLICY IF EXISTS "pulse_feed_public_read" ON pulse_feed;
CREATE POLICY "pulse_feed_public_read"
  ON pulse_feed FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "pulse_feed_owner_insert" ON pulse_feed;
CREATE POLICY "pulse_feed_owner_insert"
  ON pulse_feed FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

DROP POLICY IF EXISTS "pulse_feed_owner_update" ON pulse_feed;
CREATE POLICY "pulse_feed_owner_update"
  ON pulse_feed FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "pulse_feed_owner_delete" ON pulse_feed;
CREATE POLICY "pulse_feed_owner_delete"
  ON pulse_feed FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);
