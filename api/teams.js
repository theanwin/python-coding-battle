/**
 * VERCEL SERVERLESS FUNCTION: /api/teams
 * Handles team listing and registration on server.
 */

// In-memory store for serverless instance lifecycle
let teamsMemory = [];

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();

  // If Supabase is configured via server environment variables, proxy to Supabase
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

  if (SUPABASE_URL && SUPABASE_KEY && !SUPABASE_URL.includes("your-project")) {
    try {
      if (req.method === "GET") {
        const fetchRes = await fetch(`${SUPABASE_URL}/rest/v1/teams?select=*&order=total_points.desc,last_submission_at.asc`, {
          headers: {
            "apikey": SUPABASE_KEY,
            "Authorization": `Bearer ${SUPABASE_KEY}`,
          },
        });
        if (fetchRes.ok) {
          const data = await fetchRes.json();
          return res.status(200).json(data);
        }
      } else if (req.method === "POST") {
        const teamData = req.body;
        const insertRes = await fetch(`${SUPABASE_URL}/rest/v1/teams`, {
          method: "POST",
          headers: {
            "apikey": SUPABASE_KEY,
            "Authorization": `Bearer ${SUPABASE_KEY}`,
            "Content-Type": "application/json",
            "Prefer": "return=representation",
          },
          body: JSON.stringify(teamData),
        });
        if (insertRes.ok) {
          const inserted = await insertRes.json();
          return res.status(201).json(inserted[0] || inserted);
        }
      }
    } catch (e) {
      console.warn("Supabase API error, using memory fallback:", e);
    }
  }

  // Memory fallback
  if (req.method === "GET") {
    // Return empty array initially if no teams registered!
    return res.status(200).json(teamsMemory);
  } else if (req.method === "POST") {
    const newTeam = req.body;
    if (!newTeam || !newTeam.name) {
      return res.status(400).json({ error: "Invalid team data" });
    }
    // Check duplicate
    if (teamsMemory.some(t => t.name.toLowerCase() === newTeam.name.toLowerCase())) {
      return res.status(409).json({ error: "Team name already taken" });
    }
    teamsMemory.push(newTeam);
    return res.status(201).json(newTeam);
  }

  return res.status(405).json({ error: "Method Not Allowed" });
}
