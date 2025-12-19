-- Create memories table
CREATE TABLE IF NOT EXISTS public.memories (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) NOT NULL,
    content TEXT NOT NULL,
    category TEXT DEFAULT 'general', -- e.g. preference, fact, summary
    source TEXT DEFAULT 'chat', -- e.g. chat, manual
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.memories ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view their own memories"
    ON public.memories FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own memories"
    ON public.memories FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own memories"
    ON public.memories FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own memories"
    ON public.memories FOR DELETE
    USING (auth.uid() = user_id);

-- Create index for faster querying
CREATE INDEX idx_memories_user_id ON public.memories(user_id);
