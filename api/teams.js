/**
 * VERCEL SERVERLESS FUNCTION: /api/teams
 * Handles team listing, registration, and verification on server.
 */

// In-memory store for serverless instance lifecycle
let teamsMemory = [];

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
  const isSupabase = SUPABASE_URL && SUPABASE_KEY && !SUPABASE_URL.includes("your-project");

  // GET: Return all teams
  if (req.method === "GET") {
    if (isSupabase) {
      try {
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
      } catch (e) {
        console.warn("Supabase teams fetch error:", e);
      }
    }
    return res.status(200).json(teamsMemory);
  }

  // POST: Register or Verify
  if (req.method === "POST") {
    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});

    // Action: Verify team
    if (body.action === "verify" || body.accessCode) {
      const code = (body.accessCode || "").trim().toUpperCase();
      const id = body.teamId;

      if (isSupabase) {
        try {
          let url = `${SUPABASE_URL}/rest/v1/teams?select=*`;
          if (id) url += `&id=eq.${id}`;
          else if (code) url += `&access_code=ilike.${code}`;

          const r = await fetch(url, {
            headers: {
              "apikey": SUPABASE_KEY,
              "Authorization": `Bearer ${SUPABASE_KEY}`,
            },
          });
          if (r.ok) {
            const list = await r.json();
            if (Array.isArray(list) && list.length > 0) {
              return res.status(200).json({ success: true, team: list[0] });
            }
          }
        } catch (e) {}
      }

      const match = teamsMemory.find(t => 
        (code && (t.access_code || "").trim().toUpperCase() === code) ||
        (id && t.id === id)
      );
      if (match) {
        return res.status(200).json({ success: true, team: match });
      }
      return res.status(404).json({ error: "Team not found on server" });
    }

    // Action: Register new team
    const newTeam = body;
    if (!newTeam || !newTeam.name) {
      return res.status(400).json({ error: "Invalid team data" });
    }

    if (isSupabase) {
      try {
        const insertRes = await fetch(`${SUPABASE_URL}/rest/v1/teams`, {
          method: "POST",
          headers: {
            "apikey": SUPABASE_KEY,
            "Authorization": `Bearer ${SUPABASE_KEY}`,
            "Content-Type": "application/json",
            "Prefer": "return=representation",
          },
          body: JSON.stringify(newTeam),
        });
        if (insertRes.ok) {
          const inserted = await insertRes.json();
          return res.status(201).json(inserted[0] || inserted);
        }
      } catch (e) {
        console.warn("Supabase register error:", e);
      }
    }

    // Memory save
    if (teamsMemory.some(t => t.name.toLowerCase() === newTeam.name.toLowerCase())) {
      return res.status(409).json({ error: "Team name already taken" });
    }
    teamsMemory.push(newTeam);
    return res.status(201).json(newTeam);
  }

  return res.status(405).json({ error: "Method Not Allowed" });
}
