-- ============================================================
-- ConnectX – Supabase / PostgreSQL schema
-- Run these statements in the Supabase SQL editor or via psql.
-- ============================================================

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── Profiles ──────────────────────────────────────────────────────────────────
-- Mirrors auth.users; populated by backend on first successful JWT auth.
CREATE TABLE IF NOT EXISTS profiles (
    id           UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    username     TEXT        UNIQUE,
    display_name TEXT,
    avatar_url   TEXT,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Rooms ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS rooms (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    name        TEXT        NOT NULL UNIQUE,
    description TEXT,
    created_by  UUID        NOT NULL REFERENCES profiles(id) ON DELETE SET NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Room members ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS room_members (
    room_id    UUID        NOT NULL REFERENCES rooms(id)    ON DELETE CASCADE,
    user_id    UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    joined_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (room_id, user_id)
);

-- ── Conversations (direct or room-linked) ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS conversations (
    id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    type       TEXT        NOT NULL CHECK (type IN ('direct', 'room')),
    room_id    UUID        REFERENCES rooms(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Conversation members ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS conversation_members (
    conversation_id UUID        NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    user_id         UUID        NOT NULL REFERENCES profiles(id)       ON DELETE CASCADE,
    joined_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (conversation_id, user_id)
);

-- ── Messages ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS messages (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID        NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    sender_id       UUID        NOT NULL REFERENCES profiles(id)      ON DELETE SET NULL,
    content         TEXT        NOT NULL CHECK (char_length(content) BETWEEN 1 AND 4096),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Message reads (for unread counts) ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS message_reads (
    message_id UUID        NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    user_id    UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    read_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (message_id, user_id)
);

-- ── Indexes ───────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_messages_conversation_created
    ON messages(conversation_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_room_members_user
    ON room_members(user_id);

CREATE INDEX IF NOT EXISTS idx_conversation_members_user
    ON conversation_members(user_id);

CREATE INDEX IF NOT EXISTS idx_message_reads_user
    ON message_reads(user_id);

-- ── Row-Level Security (RLS) ──────────────────────────────────────────────────
-- Enable RLS on all tables. The C++ backend uses the service-role key to
-- bypass RLS for writes; frontend client uses anon/user key and is restricted.

ALTER TABLE profiles           ENABLE ROW LEVEL SECURITY;
ALTER TABLE rooms              ENABLE ROW LEVEL SECURITY;
ALTER TABLE room_members       ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations      ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages           ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_reads      ENABLE ROW LEVEL SECURITY;

-- Allow users to read their own profile
CREATE POLICY "Users can view own profile"
    ON profiles FOR SELECT
    USING (auth.uid() = id);

-- Allow users to update their own profile
CREATE POLICY "Users can update own profile"
    ON profiles FOR UPDATE
    USING (auth.uid() = id);

-- Allow users to view rooms they are members of
CREATE POLICY "Room members can view room"
    ON rooms FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM room_members
            WHERE room_id = rooms.id AND user_id = auth.uid()
        )
    );

-- Allow users to view messages in conversations they belong to
CREATE POLICY "Conversation members can view messages"
    ON messages FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM conversation_members
            WHERE conversation_id = messages.conversation_id
              AND user_id = auth.uid()
        )
    );
