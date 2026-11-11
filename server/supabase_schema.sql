-- ==============================================================================
-- PYTHON CODING BATTLE - SUPABASE PRODUCTION DATABASE SCHEMA
-- The Ultimate Inter-Team Coding Competition
-- ==============================================================================

-- 1. Enable UUID Extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Teams Table
CREATE TABLE IF NOT EXISTS public.teams (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) UNIQUE NOT NULL,
    leader VARCHAR(100) NOT NULL,
    member2 VARCHAR(100) NOT NULL,
    member3 VARCHAR(100) NOT NULL,
    member4 VARCHAR(100) NOT NULL,
    member5 VARCHAR(100) DEFAULT '',
    department VARCHAR(150) NOT NULL,
    points_r1 INTEGER DEFAULT 0 CHECK (points_r1 >= 0 AND points_r1 <= 20),
    points_r2 INTEGER DEFAULT 0 CHECK (points_r2 >= 0 AND points_r2 <= 20),
    points_r3 INTEGER DEFAULT 0 CHECK (points_r3 >= 0 AND points_r3 <= 30),
    points_r4 INTEGER DEFAULT 0 CHECK (points_r4 >= 0 AND points_r4 <= 20),
    points_bonus INTEGER DEFAULT 0 CHECK (points_bonus >= 0 AND points_bonus <= 10),
    total_points INTEGER GENERATED ALWAYS AS (points_r1 + points_r2 + points_r3 + points_r4 + points_bonus) STORED,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    last_submission_at TIMESTAMPTZ
);

-- 3. Competition Timer Table (Singleton)
CREATE TABLE IF NOT EXISTS public.competition_timer (
    id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    is_running BOOLEAN DEFAULT FALSE,
    start_timestamp TIMESTAMPTZ,
    duration_seconds INTEGER DEFAULT 3600,
    remaining_seconds INTEGER DEFAULT 3600,
    current_round INTEGER DEFAULT 1 CHECK (current_round BETWEEN 1 AND 4),
    round_start_timestamp TIMESTAMPTZ,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default timer singleton
INSERT INTO public.competition_timer (id, is_running, duration_seconds, remaining_seconds, current_round)
VALUES (1, FALSE, 3600, 3600, 1)
ON CONFLICT (id) DO NOTHING;

-- 4. Submissions Table
CREATE TABLE IF NOT EXISTS public.submissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    team_id UUID REFERENCES public.teams(id) ON DELETE CASCADE,
    team_name VARCHAR(100) NOT NULL,
    round_id INTEGER NOT NULL CHECK (round_id BETWEEN 1 AND 4),
    question_id VARCHAR(50) NOT NULL,
    code TEXT,
    answer TEXT,
    passed BOOLEAN NOT NULL,
    points_awarded INTEGER DEFAULT 0,
    bonus_awarded INTEGER DEFAULT 0,
    test_results JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Audit Logs Table (Manual score changes & admin actions)
CREATE TABLE IF NOT EXISTS public.score_audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    admin_name VARCHAR(100) NOT NULL DEFAULT 'Administrator',
    team_id UUID REFERENCES public.teams(id) ON DELETE SET NULL,
    team_name VARCHAR(100) NOT NULL,
    action VARCHAR(50) NOT NULL,
    field_changed VARCHAR(50),
    points_changed INTEGER,
    previous_points INTEGER,
    new_points INTEGER,
    reason TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Indexes for Performance & Realtime
CREATE INDEX IF NOT EXISTS idx_teams_total_points ON public.teams(total_points DESC, last_submission_at ASC);
CREATE INDEX IF NOT EXISTS idx_submissions_team ON public.submissions(team_id, round_id, question_id);
CREATE INDEX IF NOT EXISTS idx_audit_created ON public.score_audit_logs(created_at DESC);

-- 7. Row Level Security (RLS) Policies
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.competition_timer ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.score_audit_logs ENABLE ROW LEVEL SECURITY;

-- Public can read teams and leaderboard
CREATE POLICY "Allow public read teams" ON public.teams
    FOR SELECT USING (true);

-- Authenticated/Server role can insert or update teams
CREATE POLICY "Allow public team registration" ON public.teams
    FOR INSERT WITH CHECK (true);

-- Public can read competition timer
CREATE POLICY "Allow public read timer" ON public.competition_timer
    FOR SELECT USING (true);

-- Public can insert submissions (must specify valid team)
CREATE POLICY "Allow public insert submissions" ON public.submissions
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public read submissions" ON public.submissions
    FOR SELECT USING (true);

-- Only admin role can read/insert audit logs
CREATE POLICY "Allow read audit logs" ON public.score_audit_logs
    FOR SELECT USING (true);

-- Enable Realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.teams;
ALTER PUBLICATION supabase_realtime ADD TABLE public.competition_timer;
ALTER PUBLICATION supabase_realtime ADD TABLE public.submissions;
