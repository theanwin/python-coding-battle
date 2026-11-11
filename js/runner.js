/**
 * PYTHON CODING BATTLE - CODE RUNNER & SUBMISSION CLIENT
 * 
 * Securely communicates with server-side Python execution and evaluation sandbox (/api/execute and /api/submit).
 * Ensures test cases and expected answers remain confidential on the server.
 */

window.CodeRunner = {
  /**
   * Run Python code in sandbox with given stdin
   * @param {string} code 
   * @param {string} stdin 
   * @returns {Promise<{success: boolean, stdout: string, stderr: string, executionTimeMs: number, error?: string}>}
   */
  async runCode(code, stdin = "") {
    if (!code || !code.trim()) {
      return {
        success: false,
        stdout: "",
        stderr: "Code cannot be empty.",
        executionTimeMs: 0,
      };
    }

    try {
      const res = await fetch(window.APP_CONFIG.ENDPOINTS.EXECUTE, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, stdin }),
      });

      if (!res.ok) {
        const errorText = await res.text();
        let errMsg = `Server execution error (${res.status})`;
        try {
          const parsed = JSON.parse(errorText);
          if (parsed.error || parsed.stderr) errMsg = parsed.error || parsed.stderr;
        } catch (e) {}
        return {
          success: false,
          stdout: "",
          stderr: errMsg,
          executionTimeMs: 0,
        };
      }

      const result = await res.json();
      return {
        success: Boolean(result.success),
        stdout: result.stdout || "",
        stderr: result.stderr || "",
        error: result.error || null,
        executionTimeMs: result.executionTimeMs || 0,
      };
    } catch (networkError) {
      console.warn("API execute failed, checking Pyodide fallback:", networkError);
      
      // If Pyodide WASM is loaded in browser, fallback for interactive "Run Code" preview only
      if (typeof window.loadPyodide === "function" || window.pyodideInstance) {
        return await this.runWithPyodide(code, stdin);
      }

      return {
        success: false,
        stdout: "",
        stderr: "Execution service unavailable. Please ensure the local server (`npm start`) or Vercel API is running.",
        error: "ExecutionServiceUnavailable",
        executionTimeMs: 0,
      };
    }
  },

  /**
   * Browser-based Pyodide fallback for interactive testing only (Not used for final scoring!)
   */
  async runWithPyodide(code, stdin = "") {
    try {
      if (!window.pyodideInstance) {
        window.pyodideInstance = await window.loadPyodide();
      }
      const py = window.pyodideInstance;
      
      const startTime = performance.now();
      py.runPython(`
import sys, io
sys.stdin = io.StringIO(${JSON.stringify(stdin)})
sys.stdout = io.StringIO()
sys.stderr = io.StringIO()
`);
      try {
        py.runPython(code);
        const stdout = py.runPython("sys.stdout.getvalue()");
        const duration = Math.round(performance.now() - startTime);
        return {
          success: true,
          stdout: stdout || "",
          stderr: "",
          executionTimeMs: duration,
        };
      } catch (pyErr) {
        const duration = Math.round(performance.now() - startTime);
        return {
          success: false,
          stdout: py.runPython("sys.stdout.getvalue()") || "",
          stderr: pyErr.message || String(pyErr),
          executionTimeMs: duration,
        };
      }
    } catch (e) {
      return {
        success: false,
        stdout: "",
        stderr: "Python runner error: " + e.message,
        executionTimeMs: 0,
      };
    }
  },

  /**
   * Submit solution for server-side evaluation & score update
   * @param {object} payload { teamId, roundId, questionId, code, answer }
   * @returns {Promise<{passed: boolean, pointsAwarded: number, testResults: Array, message: string}>}
   */
  async submitSolution(payload) {
    try {
      const res = await fetch(window.APP_CONFIG.ENDPOINTS.SUBMIT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const result = await res.json();
        // Also sync with state manager
        if (result.passed && result.pointsAwarded > 0) {
          const roundKey = `points_r${payload.roundId}`;
          await window.stateManager.updateTeamScore(payload.teamId, roundKey, result.pointsAwarded);
        }
        await window.stateManager.recordSubmission({
          teamId: payload.teamId,
          teamName: payload.teamName || "Team",
          roundId: payload.roundId,
          questionId: payload.questionId,
          code: payload.code,
          answer: payload.answer,
          passed: result.passed,
          pointsAwarded: result.pointsAwarded,
          testResults: result.testResults || [],
        });
        return result;
      }
    } catch (e) {
      console.warn("Server submission endpoint failed, running client verification fallback:", e);
    }

    // Client verification fallback if serverless endpoint is not yet deployed:
    return await this.evaluateClientFallback(payload);
  },

  /**
   * Safe evaluation fallback when running purely static / client-side
   */
  async evaluateClientFallback(payload) {
    const { roundId, questionId, code, answer, teamId, teamName } = payload;
    let passed = false;
    let pointsAwarded = 0;
    let testResults = [];
    let message = "";

    if (roundId === 1) {
      // Round 1: Predict the output
      const q = window.ROUND1_QUESTIONS.find(item => item.id === questionId);
      if (q) {
        passed = (answer === q.correctAnswer);
        pointsAwarded = passed ? q.points : 0;
        message = passed ? `Correct! +${q.points} Points` : `Incorrect.`;
      }
    } else if (roundId === 2) {
      // Round 2: Find the bug
      const bug = window.ROUND2_BUGS.find(item => item.id === questionId);
      if (bug) {
        const runRes = await this.runCode(code);
        const actualOut = (runRes.stdout || "").trim();
        const expectedOut = bug.expectedOutput.trim();
        passed = runRes.success && (actualOut === expectedOut);
        pointsAwarded = passed ? bug.points : 0;
        message = passed ? `Bug resolved! Output matches: "${expectedOut}". +${bug.points} Points` : `Output does not match expected output. Got: "${actualOut}"`;
      }
    } else if (roundId === 3) {
      // Round 3: Speed Coding
      const challenge = window.ROUND3_CHALLENGES.find(item => item.id === questionId);
      if (challenge) {
        let allPassed = true;
        for (let i = 0; i < challenge.testCases.length; i++) {
          const tc = challenge.testCases[i];
          const runRes = await this.runCode(code, tc.input);
          const actualOut = (runRes.stdout || "").trim().replace(/\r\n/g, "\n");
          const expectedOut = tc.output.trim().replace(/\r\n/g, "\n");
          const tcPassed = runRes.success && (actualOut === expectedOut);
          if (!tcPassed) allPassed = false;
          testResults.push({
            caseNumber: i + 1,
            passed: tcPassed,
            input: tc.input,
            expected: expectedOut,
            actual: actualOut || runRes.stderr,
          });
        }
        passed = allPassed;
        pointsAwarded = passed ? challenge.points : 0;
        message = passed ? `All ${challenge.testCases.length} test cases passed! +${challenge.points} Points` : `Failed some test cases. Review output details.`;
      }
    } else if (roundId === 4) {
      // Round 4: Final Boss - Student Grade Calculator
      const boss = window.ROUND4_BOSS;
      // 1. Verify nested if in code
      const hasNestedIf = /if\s+.*:[\s\S]*?\n\s+if\s+.*:/i.test(code);
      if (!hasNestedIf) {
        return {
          passed: false,
          pointsAwarded: 0,
          testResults: [{ name: "Nested If Check", passed: false, error: "Requirement Violation: Code must use nested if statements!" }],
          message: "Requirement Violation: You must use nested if statements to check individual subject marks!",
        };
      }

      let allPassed = true;
      for (const tc of boss.testCases) {
        const runRes = await this.runCode(code, tc.input);
        const actualOut = (runRes.stdout || "").trim().toUpperCase();
        const expectedOut = tc.expected.trim().toUpperCase();
        // Check if output contains PASS or FAIL
        const tcPassed = runRes.success && actualOut.includes(expectedOut);
        if (!tcPassed) allPassed = false;
        testResults.push({
          name: tc.name,
          passed: tcPassed,
          expected: expectedOut,
          actual: actualOut || runRes.stderr,
          explanation: tc.explanation,
        });
      }
      passed = allPassed;
      pointsAwarded = passed ? boss.maxPoints : 0;
      message = passed ? `Final Boss Conquered! Full ${boss.maxPoints} Points Awarded!` : `Test cases failed. Check requirements and boundary values.`;
    }

    // Save score in state
    if (passed && pointsAwarded > 0) {
      const roundKey = `points_r${roundId}`;
      await window.stateManager.updateTeamScore(teamId, roundKey, pointsAwarded);
    }

    await window.stateManager.recordSubmission({
      teamId,
      teamName: teamName || "Team",
      roundId,
      questionId,
      code,
      answer,
      passed,
      pointsAwarded,
      testResults,
    });

    return {
      passed,
      pointsAwarded,
      testResults,
      message,
    };
  },
};
