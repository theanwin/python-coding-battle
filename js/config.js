/**
 * PYTHON CODING BATTLE - APPLICATION CONFIGURATION
 * 
 * Replace SUPABASE_URL and SUPABASE_ANON_KEY with your own Supabase project credentials.
 * The website will automatically use Supabase Realtime and Database when configured.
 * When not yet configured, the built-in resilient storage layer gracefully falls back
 * to local/server state so the entire competition can be tested immediately!
 */

window.APP_CONFIG = {
  // SUPABASE CREDENTIALS
  // Get these from: Supabase Dashboard -> Settings -> API
  SUPABASE_URL: window.ENV_SUPABASE_URL || "https://your-project.supabase.co",
  SUPABASE_ANON_KEY: window.ENV_SUPABASE_ANON_KEY || "your-anon-key",

  // BACKEND API ENDPOINTS
  // Uses relative paths so it seamlessly works on both local Express and Vercel Serverless
  API_BASE_URL: "",
  ENDPOINTS: {
    EXECUTE: "/api/execute",
    SUBMIT: "/api/submit",
    TEAMS: "/api/teams",
    TIMER: "/api/timer",
    ADMIN: "/api/admin",
  },

  // COMPETITION TIMING
  TOTAL_DURATION_MINUTES: 60,
  ROUND_SCHEDULE: {
    INTRO: { start: 0, end: 5, round: 0, label: "Introduction" },
    ROUND_1: { start: 5, end: 15, round: 1, label: "Round 1: Predict the Output" },
    ROUND_2: { start: 15, end: 25, round: 2, label: "Round 2: Find the Bug" },
    ROUND_3: { start: 25, end: 45, round: 3, label: "Round 3: Speed Coding" },
    ROUND_4: { start: 45, end: 55, round: 4, label: "Round 4: Final Boss" },
    REVIEW: { start: 55, end: 60, round: 5, label: "Review & Completion" },
  },

  // LOCAL STORAGE KEYS
  STORAGE_KEYS: {
    CURRENT_TEAM: "pcb_current_team",
    TEAM_SESSION: "pcb_team_session",
    ADMIN_AUTH: "pcb_admin_authenticated",
    LOCAL_TEAMS: "pcb_local_teams",
    LOCAL_SUBMISSIONS: "pcb_local_submissions",
    LOCAL_AUDIT: "pcb_local_audit_logs",
    LOCAL_SETTINGS: "pcb_local_settings",
  },

  // SCORING CONFIG
  MAX_SCORES: {
    R1: 20,
    R2: 20,
    R3: 30,
    R4: 20,
    BONUS: 10,
    TOTAL: 100,
  },

  // SECURE ADMIN HASH
  // SHA-256 of 'AdminPass@2026' (No plaintext password in client code!)
  ADMIN_HASH: "15c6d3283259e84737d2fcf7f339ef60db12b8764aa5568e6f1f3e7e83466f22",
};
