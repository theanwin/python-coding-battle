import express from 'express';
import cors from 'cors';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { db } from './db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: '2mb' }));

// Serve static frontend files
app.use(express.static(ROOT_DIR));

// Python executable path
const PYTHON_PATH = "python";

// Helper: Run python code in sandbox
async function executePythonLocal(code, stdin = "", timeoutMs = 3500) {
  return new Promise((resolve) => {
    const payload = { code, stdin };
    const tempDir = path.join(__dirname, 'temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    const tempFile = path.join(tempDir, `exec_${Date.now()}_${Math.random().toString(36).substring(2, 7)}.json`);
    fs.writeFileSync(tempFile, JSON.stringify(payload), 'utf-8');

    const runnerScript = path.join(__dirname, 'runner.py');
    const proc = spawn(PYTHON_PATH, [runnerScript, tempFile], {
      windowsHide: true,
    });

    let stdoutData = '';
    let stderrData = '';
    let timedOut = false;

    const timer = setTimeout(() => {
      timedOut = true;
      try {
        proc.kill('SIGKILL');
      } catch (e) {}
    }, timeoutMs);

    proc.stdout.on('data', (data) => {
      stdoutData += data.toString();
    });

    proc.stderr.on('data', (data) => {
      stderrData += data.toString();
    });

    proc.on('close', () => {
      clearTimeout(timer);
      try {
        if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
      } catch (e) {}

      if (timedOut) {
        return resolve({
          success: false,
          stdout: stdoutData,
          stderr: "Execution timed out! (Maximum 3.5 seconds allowed. Possible infinite loop).",
          error: "TimeoutError",
          executionTimeMs: timeoutMs,
        });
      }

      try {
        const parsed = JSON.parse(stdoutData.trim());
        resolve(parsed);
      } catch (e) {
        resolve({
          success: false,
          stdout: stdoutData,
          stderr: stderrData || stdoutData || "Execution failed.",
          error: "ParseError",
          executionTimeMs: 0,
        });
      }
    });

    proc.on('error', async (err) => {
      clearTimeout(timer);
      // Fallback to Piston API if local python executable fails
      try {
        const pistonRes = await fetch("https://emkc.org/api/v2/piston/execute", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            language: "python",
            version: "3.10.0",
            files: [{ name: "code.py", content: code }],
            stdin: stdin,
            run_timeout: timeoutMs,
          }),
        });
        const pData = await pistonRes.json();
        const run = pData.run || {};
        resolve({
          success: run.code === 0,
          stdout: run.stdout || "",
          stderr: run.stderr || "",
          executionTimeMs: 500,
        });
      } catch (pistonErr) {
        resolve({
          success: false,
          stdout: "",
          stderr: `Execution error: ${err.message}`,
          error: "ExecutionFailed",
          executionTimeMs: 0,
        });
      }
    });
  });
}

// -------------------------------------------------------------
// API: PYTHON EXECUTION
// -------------------------------------------------------------
app.post('/api/execute', async (req, res) => {
  const { code, stdin = "" } = req.body || {};
  if (!code || !code.trim()) {
    return res.status(400).json({ error: "Code cannot be empty" });
  }

  const result = await executePythonLocal(code, stdin);
  res.json(result);
});

// -------------------------------------------------------------
// API: SOLUTION EVALUATION
// -------------------------------------------------------------
const ROUND1_KEY = {
  q1: { answer: "20", points: 3 },
  q2: { answer: "3 3", points: 3 },
  q3: { answer: "PythonPython!", points: 3 },
  q4: { answer: "True", points: 3 },
  q5: { answer: "Divisible by 6", points: 3 },
  q6: { answer: "Grade A+", points: 3 },
  q7: { answer: "Access Granted", points: 2 },
};

const ROUND2_BUGS = {
  b1: { expected: "Passed", points: 4 },
  b2: { expected: "x is greater than 5", points: 4 },
  b3: { expected: "User is online", points: 4 },
  b4: { expected: "200", points: 4 },
  b5: { expected: "Eligible to drive", points: 4 },
};

const ROUND3_CHALLENGES = {
  c1: {
    points: 5,
    testCases: [
      { input: "Alex", output: "Hello, Alex!" },
      { input: "Python Titan", output: "Hello, Python Titan!" },
      { input: "Coder", output: "Hello, Coder!" },
    ],
  },
  c2: {
    points: 5,
    testCases: [
      { input: "4", output: "Even" },
      { input: "7", output: "Odd" },
      { input: "0", output: "Even" },
      { input: "99", output: "Odd" },
      { input: "-8", output: "Even" },
    ],
  },
  c3: {
    points: 6,
    testCases: [
      { input: "10\n5\n+", output: "15" },
      { input: "20\n4\n/", output: "5.0" },
      { input: "7\n3\n*", output: "21" },
      { input: "10\n0\n/", output: "Error" },
      { input: "12\n8\n-", output: "4" },
    ],
  },
  c4: {
    points: 7,
    testCases: [
      { 
        input: "5", 
        output: "5 x 1 = 5\n5 x 2 = 10\n5 x 3 = 15\n5 x 4 = 20\n5 x 5 = 25\n5 x 6 = 30\n5 x 7 = 35\n5 x 8 = 40\n5 x 9 = 45\n5 x 10 = 50" 
      },
      { 
        input: "3", 
        output: "3 x 1 = 3\n3 x 2 = 6\n3 x 3 = 9\n3 x 4 = 12\n3 x 5 = 15\n3 x 6 = 18\n3 x 7 = 21\n3 x 8 = 24\n3 x 9 = 27\n3 x 10 = 30" 
      },
    ],
  },
  c5: {
    points: 7,
    testCases: [
      { input: "50\n75", output: "Too High" },
      { input: "50\n25", output: "Too Low" },
      { input: "50\n50", output: "Correct" },
      { input: "100\n101", output: "Too High" },
      { input: "100\n99", output: "Too Low" },
    ],
  },
};

const ROUND4_BOSS = {
  points: 20,
  testCases: [
    { name: "Passing Student", input: "75\n80\n85", expected: "PASS" },
    { name: "Subject Below 35 Fail", input: "90\n30\n80", expected: "FAIL" },
    { name: "Average Below 40 Fail", input: "38\n36\n37", expected: "FAIL" },
    { name: "Exact Boundary 40 Avg", input: "35\n35\n50", expected: "PASS" },
  ],
};

app.post('/api/submit', async (req, res) => {
  const { teamId, teamName, roundId, questionId, code, answer } = req.body || {};

  if (!teamId || !roundId) {
    return res.status(400).json({ error: "Missing required submission fields" });
  }

  // Strict server-side check: Team must exist on the server
  const existingTeam = db.getTeamById(teamId);
  if (!existingTeam) {
    return res.status(403).json({
      error: "Unauthorized: Team has not been created on the server. You must register your team first."
    });
  }

  let passed = false;
  let pointsAwarded = 0;
  let testResults = [];
  let message = "";

  if (Number(roundId) === 1) {
    const qData = ROUND1_KEY[questionId];
    if (!qData) return res.status(400).json({ error: "Invalid question ID" });
    passed = (answer === qData.answer);
    pointsAwarded = passed ? qData.points : 0;
    message = passed ? `Correct! +${qData.points} Points` : `Incorrect prediction.`;
  } else if (Number(roundId) === 2) {
    const bData = ROUND2_BUGS[questionId];
    if (!bData) return res.status(400).json({ error: "Invalid bug ID" });
    const runRes = await executePythonLocal(code);
    const actual = (runRes.stdout || "").trim();
    const expected = bData.expected.trim();
    passed = runRes.success && (actual === expected);
    pointsAwarded = passed ? bData.points : 0;
    message = passed ? `Bug resolved! +${bData.points} Points` : `Output does not match expected fix. Got: "${actual}"`;
  } else if (Number(roundId) === 3) {
    const cData = ROUND3_CHALLENGES[questionId];
    if (!cData) return res.status(400).json({ error: "Invalid challenge ID" });

    let allPassed = true;
    for (let i = 0; i < cData.testCases.length; i++) {
      const tc = cData.testCases[i];
      const runRes = await executePythonLocal(code, tc.input);
      const actual = (runRes.stdout || "").trim().replace(/\r\n/g, "\n");
      const expected = tc.output.trim().replace(/\r\n/g, "\n");
      const tcPassed = runRes.success && (actual === expected);
      if (!tcPassed) allPassed = false;
      testResults.push({
        caseNumber: i + 1,
        passed: tcPassed,
        input: tc.input,
      });
    }
    passed = allPassed;
    pointsAwarded = passed ? cData.points : 0;
    message = passed ? `All test cases passed! +${cData.points} Points` : `Some test cases failed.`;
  } else if (Number(roundId) === 4) {
    // Nested if check
    const hasNestedIf = /if\s+.*:[\s\S]*?\n\s+if\s+.*:/i.test(code);
    if (!hasNestedIf) {
      return res.status(200).json({
        passed: false,
        pointsAwarded: 0,
        testResults: [{ name: "Nested If Check", passed: false, error: "Must use nested if statements!" }],
        message: "Requirement Violation: You must use nested if statements to check subject marks!",
      });
    }

    let allPassed = true;
    for (const tc of ROUND4_BOSS.testCases) {
      const runRes = await executePythonLocal(code, tc.input);
      const actual = (runRes.stdout || "").trim().toUpperCase();
      const tcPassed = runRes.success && actual.includes(tc.expected);
      if (!tcPassed) allPassed = false;
      testResults.push({
        name: tc.name,
        passed: tcPassed,
      });
    }
    passed = allPassed;
    pointsAwarded = passed ? ROUND4_BOSS.points : 0;

    // Check first-team bonus award!
    let speedBonus = 0;
    if (passed) {
      const settings = db.getSettings();
      if (!settings.bonus_awarded) {
        speedBonus = 5;
        db.updateSetting('bonus_awarded', true);
        db.updateSetting('bonus_team_id', teamId);
        db.updateSetting('bonus_team_name', teamName);
        db.updateScore(teamId, 'points_bonus', speedBonus);
        message = `Final Boss Defeated! You earned the +5 FIRST TEAM SPEED BONUS!`;
      } else {
        message = `Final Boss Defeated! +20 Points Awarded!`;
      }
    } else {
      message = `Failed one or more boundary test cases.`;
    }
  }

  // Update Score in DB
  if (passed && pointsAwarded > 0) {
    const roundKey = `points_r${roundId}`;
    db.updateScore(teamId, roundKey, pointsAwarded);
  }

  // Record submission
  db.recordSubmission({
    id: 'sub-' + Date.now(),
    team_id: teamId,
    team_name: teamName || 'Team',
    round_id: Number(roundId),
    question_id: questionId,
    code,
    answer,
    passed,
    points_awarded: pointsAwarded,
    test_results: testResults,
    submitted_at: new Date().toISOString(),
  });

  res.json({
    passed,
    pointsAwarded,
    testResults,
    message,
  });
});

// -------------------------------------------------------------
// API: TEAMS & TIMERS
// -------------------------------------------------------------
app.get('/api/teams', (req, res) => {
  res.json(db.getTeams());
});

app.post('/api/teams', (req, res) => {
  try {
    const team = db.createTeam(req.body);
    res.status(201).json(team);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Verification endpoint: Validates whether a team actually exists on the server
app.post('/api/teams/verify', (req, res) => {
  const { teamId, accessCode, teamName } = req.body || {};
  let team = null;

  if (teamId) team = db.getTeamById(teamId);
  if (!team && accessCode) team = db.getTeamByCode(accessCode);
  if (!team && teamName) {
    team = db.getTeams().find(t => t.name.toLowerCase() === teamName.trim().toLowerCase());
  }

  if (!team) {
    return res.status(403).json({
      success: false,
      error: "Team has not been created on the server. You must create and register your team first before joining the competition."
    });
  }

  res.json({ success: true, team });
});

// Join endpoint: Requires team to exist on the server
app.post('/api/teams/join', (req, res) => {
  const { accessCode, teamId } = req.body || {};
  let team = null;

  if (teamId) team = db.getTeamById(teamId);
  if (!team && accessCode) team = db.getTeamByCode(accessCode);

  if (!team) {
    return res.status(403).json({
      success: false,
      error: "No matching team found on the server. Please register your team first to join the competition."
    });
  }

  res.json({ success: true, team });
});

app.post('/api/timer', (req, res) => {
  const { action, teamId } = req.body || {};
  if (action === 'start' && teamId) {
    // Strict server-side check: Team must exist on the server
    const existing = db.getTeamById(teamId);
    if (!existing) {
      return res.status(403).json({
        error: "Unauthorized: Team has not been created on the server. You must register your team first."
      });
    }
    const team = db.startTeamCompetition(teamId);
    if (!team) return res.status(404).json({ error: "Team not found" });
    return res.json(team);
  }
  res.status(400).json({ error: "Invalid action" });
});

// Catch-all route to serve index.html for direct navigation
app.get('*', (req, res) => {
  const filePath = path.join(ROOT_DIR, req.path);
  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    return res.sendFile(filePath);
  }
  res.sendFile(path.join(ROOT_DIR, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`⚡ Python Coding Battle Server running on http://localhost:${PORT}`);
  console.log(`📁 Serving static HTML/CSS/JS from ${ROOT_DIR}`);
});
