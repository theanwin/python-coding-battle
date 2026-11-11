/**
 * PYTHON CODING BATTLE - UNIFIED DATA & REALTIME STATE MANAGER
 * 
 * Manages Supabase DB connection, Realtime subscriptions, and local fallback storage.
 * Ensures the website starts with an EMPTY database (no dummy teams!),
 * and that all teams and updates are synchronized in real-time.
 */

class StateManager {
  constructor() {
    this.supabase = null;
    this.isSupabaseConfigured = false;
    this.listeners = {
      leaderboard: [],
      timer: [],
      submissions: [],
    };
    this.init();
  }

  init() {
    // Check if Supabase credentials are provided and valid
    const url = window.APP_CONFIG.SUPABASE_URL;
    const key = window.APP_CONFIG.SUPABASE_ANON_KEY;
    
    if (url && key && !url.includes("your-project") && typeof window.supabase !== "undefined") {
      try {
        this.supabase = window.supabase.createClient(url, key);
        this.isSupabaseConfigured = true;
        this.setupRealtimeSubscriptions();
        console.log("⚡ Supabase connected successfully! Real-time syncing active.");
      } catch (e) {
        console.warn("Could not initialize Supabase client:", e);
        this.isSupabaseConfigured = false;
      }
    } else {
      console.log("ℹ️ Supabase credentials not set or using local mode. Utilizing API/Storage fallback.");
    }
  }

  setupRealtimeSubscriptions() {
    if (!this.supabase) return;

    try {
      this.supabase
        .channel('public:teams')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'teams' }, (payload) => {
          this.notify('leaderboard', payload);
        })
        .subscribe();

      this.supabase
        .channel('public:submissions')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'submissions' }, (payload) => {
          this.notify('submissions', payload);
        })
        .subscribe();
    } catch (err) {
      console.warn("Realtime subscription setup failed:", err);
    }
  }

  on(channel, callback) {
    if (this.listeners[channel]) {
      this.listeners[channel].push(callback);
    }
  }

  notify(channel, data) {
    if (this.listeners[channel]) {
      this.listeners[channel].forEach(cb => {
        try { cb(data); } catch (e) { console.error(e); }
      });
    }
  }

  // -----------------------------------------------------------
  // TEAMS & LEADERBOARD
  // -----------------------------------------------------------
  async getTeams() {
    if (this.isSupabaseConfigured && this.supabase) {
      try {
        const { data, error } = await this.supabase
          .from('teams')
          .select('*')
          .order('total_points', { ascending: false })
          .order('last_submission_at', { ascending: true, nullsFirst: false });
        
        if (!error && data) return data;
      } catch (e) {
        console.warn("Supabase fetch error, checking API/local:", e);
      }
    }

    // Server API or Local Storage fallback
    try {
      const res = await fetch(window.APP_CONFIG.ENDPOINTS.TEAMS);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) return data;
      }
    } catch (e) {
      // Local fallback
    }

    const localRaw = localStorage.getItem(window.APP_CONFIG.STORAGE_KEYS.LOCAL_TEAMS);
    return localRaw ? JSON.parse(localRaw) : [];
  }

  async getTeamById(id) {
    const teams = await this.getTeams();
    return teams.find(t => t.id === id || t.access_code === id) || null;
  }

  async getTeamByCode(code) {
    const teams = await this.getTeams();
    const cleanCode = (code || '').trim().toUpperCase();
    return teams.find(t => (t.access_code || '').toUpperCase() === cleanCode) || null;
  }

  async verifyTeamOnServer(teamId, accessCode) {
    const cleanCode = (accessCode || '').trim().toUpperCase();

    // 1. Check local state / cache first
    if (cleanCode) {
      const localTeam = await this.getTeamByCode(cleanCode);
      if (localTeam) return localTeam;
    } else if (teamId) {
      const localTeam = await this.getTeamById(teamId);
      if (localTeam) return localTeam;
    }

    // 2. Check current session storage
    const curRaw = localStorage.getItem(window.APP_CONFIG.STORAGE_KEYS.CURRENT_TEAM);
    if (curRaw) {
      try {
        const parsed = JSON.parse(curRaw);
        if ((cleanCode && (parsed.access_code || '').trim().toUpperCase() === cleanCode) ||
            (teamId && parsed.id === teamId)) {
          return parsed;
        }
      } catch (e) {}
    }

    // 3. Fallback: check all teams via getTeams()
    const allTeams = await this.getTeams();
    const match = allTeams.find(t => 
      (cleanCode && (t.access_code || '').trim().toUpperCase() === cleanCode) ||
      (teamId && t.id === teamId)
    );

    if (match) return match;

    throw new Error(`Team not found with code "${cleanCode || teamId}". Please verify your access code or register your team first.`);
  }

  async registerTeam(teamData) {
    // Generate unique access code: e.g. PCB-7821
    const accessCode = 'PCB-' + Math.floor(1000 + Math.random() * 9000);
    const newTeam = {
      id: (typeof crypto !== "undefined" && crypto.randomUUID) ? crypto.randomUUID() : 'team-' + Date.now(),
      name: teamData.name.trim(),
      leader: teamData.leader.trim(),
      member2: teamData.member2.trim(),
      member3: teamData.member3.trim(),
      member4: teamData.member4.trim(),
      member5: (teamData.member5 || '').trim(),
      department: teamData.department.trim(),
      access_code: accessCode,
      status: 'registered',
      started_at: null,
      end_time: null,
      current_round: 1,
      points_r1: 0,
      points_r2: 0,
      points_r3: 0,
      points_r4: 0,
      points_bonus: 0,
      total_points: 0,
      last_submission_at: null,
      created_at: new Date().toISOString(),
    };

    // Check duplicate name
    const existing = await this.getTeams();
    if (existing.some(t => t.name.toLowerCase() === newTeam.name.toLowerCase())) {
      throw new Error(`Team name "${newTeam.name}" is already registered. Please choose a different name.`);
    }

    if (this.isSupabaseConfigured && this.supabase) {
      try {
        const { data, error } = await this.supabase
          .from('teams')
          .insert([newTeam])
          .select()
          .single();
        if (error) throw error;
        this.notify('leaderboard', { event: 'INSERT', new: data });
        return data;
      } catch (e) {
        console.warn("Supabase insert error, saving via API/local:", e);
      }
    }

    // Try server API
    try {
      const res = await fetch(window.APP_CONFIG.ENDPOINTS.TEAMS, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newTeam),
      });
      if (res.ok) {
        const data = await res.json();
        this.notify('leaderboard', { event: 'INSERT', new: data });
        return data;
      }
    } catch (e) {}

    // Fallback save in localStorage
    existing.push(newTeam);
    localStorage.setItem(window.APP_CONFIG.STORAGE_KEYS.LOCAL_TEAMS, JSON.stringify(existing));
    this.notify('leaderboard', { event: 'INSERT', new: newTeam });
    return newTeam;
  }

  async startTeamCompetition(teamId) {
    const now = new Date();
    const endTime = new Date(now.getTime() + window.APP_CONFIG.TOTAL_DURATION_MINUTES * 60 * 1000);
    const updates = {
      status: 'in_progress',
      started_at: now.toISOString(),
      end_time: endTime.toISOString(),
      current_round: 1,
    };

    if (this.isSupabaseConfigured && this.supabase) {
      try {
        const { data, error } = await this.supabase
          .from('teams')
          .update(updates)
          .eq('id', teamId)
          .select()
          .single();
        if (!error && data) {
          this.notify('timer', data);
          return data;
        }
      } catch (e) {
        console.warn("Supabase timer update error:", e);
      }
    }

    // Try API
    try {
      const res = await fetch(window.APP_CONFIG.ENDPOINTS.TIMER, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'start', teamId }),
      });
      if (res.ok) {
        const data = await res.json();
        this.notify('timer', data);
        return data;
      }
    } catch (e) {}

    // Local storage fallback
    const teams = await this.getTeams();
    const idx = teams.findIndex(t => t.id === teamId);
    if (idx !== -1) {
      teams[idx] = { ...teams[idx], ...updates };
      localStorage.setItem(window.APP_CONFIG.STORAGE_KEYS.LOCAL_TEAMS, JSON.stringify(teams));
      this.notify('timer', teams[idx]);
      return teams[idx];
    }
    return null;
  }

  async updateTeamScore(teamId, roundKey, pointsToAdd, setAbsolute = false) {
    const teams = await this.getTeams();
    const team = teams.find(t => t.id === teamId);
    if (!team) throw new Error("Team not found");

    let newPoints = setAbsolute ? pointsToAdd : ((team[roundKey] || 0) + pointsToAdd);
    
    // Bounds check
    const maxScore = roundKey === 'points_r1' ? 20 :
                     roundKey === 'points_r2' ? 20 :
                     roundKey === 'points_r3' ? 30 :
                     roundKey === 'points_r4' ? 20 : 10;
    newPoints = Math.max(0, Math.min(newPoints, maxScore));

    const updates = {
      [roundKey]: newPoints,
      last_submission_at: new Date().toISOString(),
    };

    const calculatedTotal = (
      (roundKey === 'points_r1' ? newPoints : (team.points_r1 || 0)) +
      (roundKey === 'points_r2' ? newPoints : (team.points_r2 || 0)) +
      (roundKey === 'points_r3' ? newPoints : (team.points_r3 || 0)) +
      (roundKey === 'points_r4' ? newPoints : (team.points_r4 || 0)) +
      (roundKey === 'points_bonus' ? newPoints : (team.points_bonus || 0))
    );
    updates.total_points = calculatedTotal;

    if (this.isSupabaseConfigured && this.supabase) {
      try {
        const { data, error } = await this.supabase
          .from('teams')
          .update(updates)
          .eq('id', teamId)
          .select()
          .single();
        if (!error && data) {
          this.notify('leaderboard', { event: 'UPDATE', new: data });
          return data;
        }
      } catch (e) {
        console.warn("Supabase update score error:", e);
      }
    }

    // Local update
    const idx = teams.findIndex(t => t.id === teamId);
    if (idx !== -1) {
      teams[idx] = { ...teams[idx], ...updates };
      localStorage.setItem(window.APP_CONFIG.STORAGE_KEYS.LOCAL_TEAMS, JSON.stringify(teams));
      this.notify('leaderboard', { event: 'UPDATE', new: teams[idx] });
      return teams[idx];
    }
    return team;
  }

  // -----------------------------------------------------------
  // SUBMISSIONS
  // -----------------------------------------------------------
  async recordSubmission(subData) {
    const submission = {
      id: (typeof crypto !== "undefined" && crypto.randomUUID) ? crypto.randomUUID() : 'sub-' + Date.now(),
      team_id: subData.teamId,
      team_name: subData.teamName,
      round_id: subData.roundId,
      question_id: subData.questionId,
      code: subData.code || null,
      answer: subData.answer || null,
      passed: Boolean(subData.passed),
      points_awarded: subData.pointsAwarded || 0,
      test_results: subData.testResults || [],
      submitted_at: new Date().toISOString(),
    };

    if (this.isSupabaseConfigured && this.supabase) {
      try {
        const { data, error } = await this.supabase
          .from('submissions')
          .insert([submission])
          .select()
          .single();
        if (!error && data) {
          this.notify('submissions', data);
          return data;
        }
      } catch (e) {
        console.warn("Supabase submission record error:", e);
      }
    }

    // Local storage
    const raw = localStorage.getItem(window.APP_CONFIG.STORAGE_KEYS.LOCAL_SUBMISSIONS);
    const list = raw ? JSON.parse(raw) : [];
    list.unshift(submission);
    localStorage.setItem(window.APP_CONFIG.STORAGE_KEYS.LOCAL_SUBMISSIONS, JSON.stringify(list));
    this.notify('submissions', submission);
    return submission;
  }

  async getSubmissions(teamId = null, roundId = null) {
    if (this.isSupabaseConfigured && this.supabase) {
      try {
        let query = this.supabase.from('submissions').select('*').order('submitted_at', { ascending: false });
        if (teamId) query = query.eq('team_id', teamId);
        if (roundId) query = query.eq('round_id', roundId);
        const { data, error } = await query;
        if (!error && data) return data;
      } catch (e) {
        console.warn("Supabase fetch submissions error:", e);
      }
    }

    const raw = localStorage.getItem(window.APP_CONFIG.STORAGE_KEYS.LOCAL_SUBMISSIONS);
    let list = raw ? JSON.parse(raw) : [];
    if (teamId) list = list.filter(s => s.team_id === teamId);
    if (roundId) list = list.filter(s => s.round_id === Number(roundId));
    return list;
  }

  // -----------------------------------------------------------
  // AUDIT LOGS
  // -----------------------------------------------------------
  async recordAuditLog(entry) {
    const log = {
      id: (typeof crypto !== "undefined" && crypto.randomUUID) ? crypto.randomUUID() : 'audit-' + Date.now(),
      admin_name: entry.adminName || 'Admin',
      team_id: entry.teamId,
      team_name: entry.teamName,
      action: entry.action,
      field_changed: entry.fieldChanged,
      points_changed: entry.pointsChanged,
      previous_points: entry.previousPoints,
      new_points: entry.newPoints,
      reason: entry.reason,
      created_at: new Date().toISOString(),
    };

    if (this.isSupabaseConfigured && this.supabase) {
      try {
        await this.supabase.from('score_audit_logs').insert([log]);
      } catch (e) {
        console.warn("Supabase audit log insert error:", e);
      }
    }

    const raw = localStorage.getItem(window.APP_CONFIG.STORAGE_KEYS.LOCAL_AUDIT);
    const logs = raw ? JSON.parse(raw) : [];
    logs.unshift(log);
    localStorage.setItem(window.APP_CONFIG.STORAGE_KEYS.LOCAL_AUDIT, JSON.stringify(logs));
    return log;
  }

  async getAuditLogs() {
    if (this.isSupabaseConfigured && this.supabase) {
      try {
        const { data, error } = await this.supabase
          .from('score_audit_logs')
          .select('*')
          .order('created_at', { ascending: false });
        if (!error && data) return data;
      } catch (e) {
        console.warn("Supabase audit log fetch error:", e);
      }
    }

    const raw = localStorage.getItem(window.APP_CONFIG.STORAGE_KEYS.LOCAL_AUDIT);
    return raw ? JSON.parse(raw) : [];
  }

  // -----------------------------------------------------------
  // ADMIN DESTRUCTIVE ACTIONS
  // -----------------------------------------------------------
  async deleteTeam(teamId) {
    if (this.isSupabaseConfigured && this.supabase) {
      try {
        await this.supabase.from('teams').delete().eq('id', teamId);
      } catch (e) {
        console.warn("Supabase delete team error:", e);
      }
    }
    const teams = await this.getTeams();
    const updated = teams.filter(t => t.id !== teamId);
    localStorage.setItem(window.APP_CONFIG.STORAGE_KEYS.LOCAL_TEAMS, JSON.stringify(updated));
    this.notify('leaderboard', { event: 'DELETE', id: teamId });
    return true;
  }

  async resetAllScores() {
    if (this.isSupabaseConfigured && this.supabase) {
      try {
        await this.supabase.from('teams').update({
          points_r1: 0,
          points_r2: 0,
          points_r3: 0,
          points_r4: 0,
          points_bonus: 0,
          total_points: 0,
          started_at: null,
          end_time: null,
          status: 'registered',
          current_round: 1,
          last_submission_at: null,
        }).neq('id', '00000000-0000-0000-0000-000000000000');
        await this.supabase.from('submissions').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      } catch (e) {
        console.warn("Supabase reset all error:", e);
      }
    }
    const teams = await this.getTeams();
    const resetTeams = teams.map(t => ({
      ...t,
      points_r1: 0,
      points_r2: 0,
      points_r3: 0,
      points_r4: 0,
      points_bonus: 0,
      total_points: 0,
      started_at: null,
      end_time: null,
      status: 'registered',
      current_round: 1,
      last_submission_at: null,
    }));
    localStorage.setItem(window.APP_CONFIG.STORAGE_KEYS.LOCAL_TEAMS, JSON.stringify(resetTeams));
    localStorage.removeItem(window.APP_CONFIG.STORAGE_KEYS.LOCAL_SUBMISSIONS);
    this.notify('leaderboard', { event: 'RESET' });
    return true;
  }
}

// Global state instance
window.stateManager = new StateManager();
