-- ==============================================================================
-- PYTHON CODING BATTLE - COMPLETE PRODUCTION DATABASE SCHEMA (SUPABASE)
-- Tagline: Think Fast. Code Faster.
-- ==============================================================================

-- 1. Enable UUID Extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. Drop existing tables if re-initializing (Clean Slate)
DROP TABLE IF EXISTS public.score_audit_logs CASCADE;
DROP TABLE IF EXISTS public.submissions CASCADE;
DROP TABLE IF EXISTS public.competition_settings CASCADE;
DROP TABLE IF EXISTS public.teams CASCADE;

-- 3. Teams Table
-- Note: Starts EMPTY. No pre-existing or dummy teams allowed!
CREATE TABLE public.teams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) UNIQUE NOT NULL,
    leader VARCHAR(100) NOT NULL,
    member2 VARCHAR(100) NOT NULL,
    member3 VARCHAR(100) NOT NULL,
    member4 VARCHAR(100) NOT NULL,
    member5 VARCHAR(100) DEFAULT '',
    department VARCHAR(150) NOT NULL,
    access_code VARCHAR(20) UNIQUE NOT NULL,
    status VARCHAR(20) DEFAULT 'registered' CHECK (status IN ('registered', 'in_progress', 'completed')),
    started_at TIMESTAMPTZ DEFAULT NULL,
    end_time TIMESTAMPTZ DEFAULT NULL,
    current_round INTEGER DEFAULT 1 CHECK (current_round BETWEEN 1 AND 4),
    points_r1 INTEGER DEFAULT 0 CHECK (points_r1 >= 0 AND points_r1 <= 20),
    points_r2 INTEGER DEFAULT 0 CHECK (points_r2 >= 0 AND points_r2 <= 20),
    points_r3 INTEGER DEFAULT 0 CHECK (points_r3 >= 0 AND points_r3 <= 30),
    points_r4 INTEGER DEFAULT 0 CHECK (points_r4 >= 0 AND points_r4 <= 20),
    points_bonus INTEGER DEFAULT 0 CHECK (points_bonus >= 0 AND points_bonus <= 10),
    total_points INTEGER GENERATED ALWAYS AS (points_r1 + points_r2 + points_r3 + points_r4 + points_bonus) STORED,
    last_submission_at TIMESTAMPTZ DEFAULT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Submissions Table
CREATE TABLE public.submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID REFERENCES public.teams(id) ON DELETE CASCADE,
    team_name VARCHAR(100) NOT NULL,
    round_id INTEGER NOT NULL CHECK (round_id BETWEEN 1 AND 4),
    question_id VARCHAR(50) NOT NULL,
    code TEXT,
    answer TEXT,
    passed BOOLEAN NOT NULL DEFAULT FALSE,
    points_awarded INTEGER DEFAULT 0,
    test_results JSONB DEFAULT '[]'::jsonb,
    submitted_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Score Audit Logs Table (Manual adjustments & admin oversight)
CREATE TABLE public.score_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_name VARCHAR(100) NOT NULL DEFAULT 'Administrator',
    team_id UUID REFERENCES public.teams(id) ON DELETE SET NULL,
    team_name VARCHAR(100) NOT NULL,
    action VARCHAR(50) NOT NULL,
    field_changed VARCHAR(50) NOT NULL,
    points_changed INTEGER NOT NULL,
    previous_points INTEGER NOT NULL,
    new_points INTEGER NOT NULL,
    reason TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Competition Settings & Globals Table
CREATE TABLE public.competition_settings (
    key VARCHAR(50) PRIMARY KEY,
    value JSONB NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert competition defaults
INSERT INTO public.competition_settings (key, value) VALUES
    ('bonus_awarded', '{"awarded": false, "team_id": null, "team_name": null, "awarded_at": null}'::jsonb),
    ('winners_published', '{"published": false}'::jsonb),
    ('competition_active', '{"active": true}'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- 7. High Performance Indexes
CREATE INDEX idx_teams_total_points ON public.teams(total_points DESC, last_submission_at ASC NULLS LAST);
CREATE INDEX idx_teams_access_code ON public.teams(access_code);
CREATE INDEX idx_submissions_team ON public.submissions(team_id, round_id, question_id);
CREATE INDEX idx_submissions_submitted ON public.submissions(submitted_at DESC);
CREATE INDEX idx_audit_created ON public.score_audit_logs(created_at DESC);

-- 8. Row Level Security (RLS) Policies
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.score_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.competition_settings ENABLE ROW LEVEL SECURITY;

-- Teams Policies:
-- Anyone can view the leaderboard and registered teams
CREATE POLICY "Public can view teams" ON public.teams
    FOR SELECT USING (true);

-- Anyone can register a new team
CREATE POLICY "Public can register teams" ON public.teams
    FOR INSERT WITH CHECK (true);

-- Teams can start their timer and update their submission timestamp
CREATE POLICY "Teams can update their timer/status" ON public.teams
    FOR UPDATE USING (true) WITH CHECK (true);

-- Teams can be removed by admin
CREATE POLICY "Allow delete teams" ON public.teams
    FOR DELETE USING (true);

-- Submissions Policies:
CREATE POLICY "Public can view submissions" ON public.submissions
    FOR SELECT USING (true);

CREATE POLICY "Public can insert submissions" ON public.submissions
    FOR INSERT WITH CHECK (true);

-- Audit Logs Policies:
CREATE POLICY "Public can view audit logs" ON public.score_audit_logs
    FOR SELECT USING (true);

CREATE POLICY "Public can insert audit logs" ON public.score_audit_logs
    FOR INSERT WITH CHECK (true);

-- Settings Policies:
CREATE POLICY "Public can view settings" ON public.competition_settings
    FOR SELECT USING (true);

CREATE POLICY "Public can update settings" ON public.competition_settings
    FOR ALL USING (true);

-- 9. Enable Realtime Publications
ALTER PUBLICATION supabase_realtime ADD TABLE public.teams;
ALTER PUBLICATION supabase_realtime ADD TABLE public.submissions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.score_audit_logs;
ALTER PUBLICATION supabase_realtime ADD TABLE public.competition_settings;
