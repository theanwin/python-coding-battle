/**
 * VERCEL SERVERLESS FUNCTION: /api/submit
 * Confidential server-side evaluation of competition solutions.
 * Evaluates test cases, verifies code patterns, and prevents tampering.
 */

// Official Server-Side Answer Keys & Test Suites
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

async function runPythonRemote(code, stdin = "") {
  try {
    const res = await fetch("https://emkc.org/api/v2/piston/execute", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        language: "python",
        version: "3.10.0",
        files: [{ name: "main.py", content: code }],
        stdin: stdin,
        run_timeout: 3500,
      }),
    });
    if (!res.ok) return { success: false, stdout: "", stderr: "Sandbox unavailable" };
    const data = await res.json();
    const run = data.run || {};
    return {
      success: run.code === 0,
      stdout: run.stdout || "",
      stderr: run.stderr || "",
    };
  } catch (e) {
    return { success: false, stdout: "", stderr: e.message };
  }
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method Not Allowed" });

  const { teamId, teamName, roundId, questionId, code, answer } = req.body || {};

  if (!teamId || !roundId) {
    return res.status(400).json({ error: "Missing required submission fields" });
  }

  let passed = false;
  let pointsAwarded = 0;
  let testResults = [];
  let message = "";

  // -------------------------------------------------------------
  // EVALUATE BY ROUND
  // -------------------------------------------------------------
  if (Number(roundId) === 1) {
    const qData = ROUND1_KEY[questionId];
    if (!qData) return res.status(400).json({ error: "Invalid question ID" });
    passed = (answer === qData.answer);
    pointsAwarded = passed ? qData.points : 0;
    message = passed ? `Correct! +${qData.points} Points` : `Incorrect prediction.`;
  } else if (Number(roundId) === 2) {
    const bData = ROUND2_BUGS[questionId];
    if (!bData) return res.status(400).json({ error: "Invalid bug ID" });
    const runRes = await runPythonRemote(code);
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
      const runRes = await runPythonRemote(code, tc.input);
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
    // Final Boss Student Grade Calculator
    const hasNestedIf = /if\s+.*:[\s\S]*?\n\s+if\s+.*:/i.test(code);
    if (!hasNestedIf) {
      return res.status(200).json({
        passed: false,
        pointsAwarded: 0,
        testResults: [{ name: "Nested If Check", passed: false, error: "Requirement Violation: Code must use nested if statements!" }],
        message: "Requirement Violation: You must use nested if statements to check subject marks!",
      });
    }

    let allPassed = true;
    for (const tc of ROUND4_BOSS.testCases) {
      const runRes = await runPythonRemote(code, tc.input);
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
    message = passed ? `Final Boss Defeated! +20 Points Awarded!` : `Failed one or more boundary test cases.`;
  }

  return res.status(200).json({
    passed,
    pointsAwarded,
    testResults,
    message,
  });
}
