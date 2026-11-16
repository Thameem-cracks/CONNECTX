-- ConnectX Database Schema
-- Run this in your Supabase SQL Editor (or via migration tool)
-- All tables use UUID primary keys and RLS policies

-- ─────────────────────────────────────────────────────────────────────────────
-- Enable UUID extension
-- ─────────────────────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─────────────────────────────────────────────────────────────────────────────
-- profiles
-- Linked to auth.users via id. Created via trigger on first sign-up.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.profiles (
    id            UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    username      TEXT        NOT NULL UNIQUE,
    display_name  TEXT        NOT NULL,
    avatar_url    TEXT,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT username_length CHECK (char_length(username) BETWEEN 3 AND 32),
    CONSTRAINT username_format CHECK (username ~ '^[a-zA-Z0-9_]+$')
);

-- Index for fast username lookups
CREATE INDEX IF NOT EXISTS idx_profiles_username ON public.profiles(username);

-- ─────────────────────────────────────────────────────────────────────────────
-- chat_rooms
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.chat_rooms (
    id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    name        TEXT        NOT NULL,
    description TEXT        DEFAULT '',
    created_by  UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT room_name_length CHECK (char_length(name) BETWEEN 1 AND 100)
);

CREATE INDEX IF NOT EXISTS idx_chat_rooms_created_by ON public.chat_rooms(created_by);

-- ─────────────────────────────────────────────────────────────────────────────
-- room_members
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.room_members (
    id        UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    room_id   UUID        NOT NULL REFERENCES public.chat_rooms(id) ON DELETE CASCADE,
    user_id   UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(room_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_room_members_room    ON public.room_members(room_id);
CREATE INDEX IF NOT EXISTS idx_room_members_user    ON public.room_members(user_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- conversations
-- type: 'room' | 'direct'
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.conversations (
    id                UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_type TEXT        NOT NULL CHECK (conversation_type IN ('room', 'direct')),
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- conversation_members
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.conversation_members (
    id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID        NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
    user_id         UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    joined_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(conversation_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_conv_members_conv ON public.conversation_members(conversation_id);
CREATE INDEX IF NOT EXISTS idx_conv_members_user ON public.conversation_members(user_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- messages
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.messages (
    id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID        NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
    sender_id       UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
    content         TEXT        NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT message_content_length CHECK (char_length(content) BETWEEN 1 AND 65536)
);

CREATE INDEX IF NOT EXISTS idx_messages_conversation ON public.messages(conversation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_sender       ON public.messages(sender_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- message_reads
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.message_reads (
    id         UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    message_id UUID        NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
    user_id    UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    read_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(message_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_message_reads_message ON public.message_reads(message_id);
CREATE INDEX IF NOT EXISTS idx_message_reads_user    ON public.message_reads(user_id);
