/**
 * VERCEL SERVERLESS FUNCTION: /api/execute
 * Secure server-side Python execution sandbox.
 * Applies timeout, resource isolation, and stdin handling.
 */

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const { code, stdin = "" } = req.body || {};

  if (!code || !code.trim()) {
    return res.status(400).json({ error: "No Python code provided" });
  }

  const startTime = Date.now();

  try {
    // Execute using Piston API sandbox (Isolated Linux Container with Python 3.10)
    const pistonRes = await fetch("https://emkc.org/api/v2/piston/execute", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        language: "python",
        version: "3.10.0",
        files: [{ name: "submission.py", content: code }],
        stdin: stdin,
        run_timeout: 3500, // 3.5 seconds
        compile_timeout: 3000,
      }),
    });

    if (!pistonRes.ok) {
      const errText = await pistonRes.text();
      return res.status(502).json({
        success: false,
        stdout: "",
        stderr: `Sandbox execution service error: ${errText}`,
        executionTimeMs: Date.now() - startTime,
      });
    }

    const data = await pistonRes.json();
    const run = data.run || {};
    const duration = Date.now() - startTime;

    return res.status(200).json({
      success: run.code === 0,
      stdout: run.stdout || "",
      stderr: run.stderr || (run.code !== 0 ? (run.output || "Execution failed") : ""),
      error: run.signal || (run.code !== 0 ? "RuntimeError" : null),
      executionTimeMs: duration,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      stdout: "",
      stderr: `Server execution exception: ${err.message}`,
      error: "ServerError",
      executionTimeMs: Date.now() - startTime,
    });
  }
}
