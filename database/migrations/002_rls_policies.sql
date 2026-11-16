-- Migration 002: Row Level Security Policies
-- Apply after migration 001

ALTER TABLE public.profiles             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_rooms           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.room_members         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_reads        ENABLE ROW LEVEL SECURITY;

-- ─── profiles ────────────────────────────────────────────────────────────────
CREATE POLICY "profiles_select_any"
    ON public.profiles FOR SELECT USING (true);

CREATE POLICY "profiles_update_own"
    ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- ─── chat_rooms ──────────────────────────────────────────────────────────────
CREATE POLICY "rooms_select_authenticated"
    ON public.chat_rooms FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "rooms_insert_authenticated"
    ON public.chat_rooms FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- ─── room_members ────────────────────────────────────────────────────────────
CREATE POLICY "room_members_select_authenticated"
    ON public.room_members FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "room_members_insert_own"
    ON public.room_members FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "room_members_delete_own"
    ON public.room_members FOR DELETE USING (auth.uid() = user_id);

-- ─── conversations ───────────────────────────────────────────────────────────
CREATE POLICY "conversations_select_member"
    ON public.conversations FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.conversation_members cm
            WHERE cm.conversation_id = id AND cm.user_id = auth.uid()
        )
    );

CREATE POLICY "conversations_insert_authenticated"
    ON public.conversations FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- ─── conversation_members ────────────────────────────────────────────────────
CREATE POLICY "conv_members_select_member"
    ON public.conversation_members FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.conversation_members cm2
            WHERE cm2.conversation_id = conversation_id AND cm2.user_id = auth.uid()
        )
    );

CREATE POLICY "conv_members_insert_authenticated"
    ON public.conversation_members FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- ─── messages ────────────────────────────────────────────────────────────────
CREATE POLICY "messages_select_member"
    ON public.messages FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.conversation_members cm
            WHERE cm.conversation_id = messages.conversation_id
              AND cm.user_id = auth.uid()
        )
    );

CREATE POLICY "messages_insert_own"
    ON public.messages FOR INSERT
    WITH CHECK (
        auth.uid() = sender_id
        AND EXISTS (
            SELECT 1 FROM public.conversation_members cm
            WHERE cm.conversation_id = conversation_id
              AND cm.user_id = auth.uid()
        )
    );

-- ─── message_reads ───────────────────────────────────────────────────────────
CREATE POLICY "message_reads_insert_own"
    ON public.message_reads FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "message_reads_select_own"
    ON public.message_reads FOR SELECT USING (auth.uid() = user_id);
