import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'competition_data.json');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Initial state schema: STRICTLY EMPTY TEAMS!
const defaultState = {
  teams: [],
  submissions: [],
  auditLogs: [],
  settings: {
    bonus_awarded: false,
    bonus_team_id: null,
    bonus_team_name: null,
    winners_published: false,
  },
};

function readDb() {
  try {
    if (!fs.existsSync(DB_FILE)) {
      writeDb(defaultState);
      return defaultState;
    }
    const raw = fs.readFileSync(DB_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    console.error("DB Read error, resetting to default:", err);
    return defaultState;
  }
}

function writeDb(data) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error("DB Write error:", err);
  }
}

export const db = {
  getTeams() {
    const data = readDb();
    return data.teams || [];
  },

  getTeamById(id) {
    const teams = this.getTeams();
    return teams.find(t => t.id === id || t.access_code === id) || null;
  },

  getTeamByCode(code) {
    const teams = this.getTeams();
    const c = (code || '').trim().toUpperCase();
    return teams.find(t => (t.access_code || '').toUpperCase() === c) || null;
  },

  createTeam(teamData) {
    const data = readDb();
    if (!data.teams) data.teams = [];

    // Check duplicate
    if (data.teams.some(t => t.name.toLowerCase() === teamData.name.toLowerCase())) {
      throw new Error(`Team name "${teamData.name}" is already taken.`);
    }

    const accessCode = 'PCB-' + Math.floor(1000 + Math.random() * 9000);
    const newTeam = {
      id: 'team-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
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

    data.teams.push(newTeam);
    writeDb(data);
    return newTeam;
  },

  startTeamCompetition(teamId) {
    const data = readDb();
    const team = (data.teams || []).find(t => t.id === teamId);
    if (!team) return null;

    const now = new Date();
    team.status = 'in_progress';
    team.started_at = now.toISOString();
    team.end_time = new Date(now.getTime() + 60 * 60 * 1000).toISOString();
    team.current_round = 1;
    writeDb(data);
    return team;
  },

  updateScore(teamId, roundKey, points, setAbsolute = false) {
    const data = readDb();
    const team = (data.teams || []).find(t => t.id === teamId);
    if (!team) return null;

    const prev = team[roundKey] || 0;
    const updated = setAbsolute ? points : (prev + points);
    team[roundKey] = Math.max(0, updated);
    team.last_submission_at = new Date().toISOString();
    team.total_points = (
      (team.points_r1 || 0) +
      (team.points_r2 || 0) +
      (team.points_r3 || 0) +
      (team.points_r4 || 0) +
      (team.points_bonus || 0)
    );
    writeDb(data);
    return team;
  },

  deleteTeam(teamId) {
    const data = readDb();
    data.teams = (data.teams || []).filter(t => t.id !== teamId);
    writeDb(data);
    return true;
  },

  resetAll() {
    const data = readDb();
    data.teams = (data.teams || []).map(t => ({
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
    data.submissions = [];
    writeDb(data);
    return true;
  },

  recordSubmission(sub) {
    const data = readDb();
    if (!data.submissions) data.submissions = [];
    data.submissions.unshift(sub);
    writeDb(data);
    return sub;
  },

  getSubmissions() {
    const data = readDb();
    return data.submissions || [];
  },

  recordAudit(entry) {
    const data = readDb();
    if (!data.auditLogs) data.auditLogs = [];
    data.auditLogs.unshift(entry);
    writeDb(data);
    return entry;
  },

  getAuditLogs() {
    const data = readDb();
    return data.auditLogs || [];
  },

  getSettings() {
    const data = readDb();
    return data.settings || {};
  },

  updateSetting(key, val) {
    const data = readDb();
    if (!data.settings) data.settings = {};
    data.settings[key] = val;
    writeDb(data);
    return data.settings;
  }
};
