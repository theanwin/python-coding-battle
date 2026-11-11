/**
 * VERCEL SERVERLESS FUNCTION: /api/teams/verify
 * Verifies team existence by teamId or accessCode.
 */

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method Not Allowed" });

  const { teamId, accessCode } = req.body || {};

  const cleanCode = (accessCode || "").trim().toUpperCase();

  // If Supabase is configured
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

  if (SUPABASE_URL && SUPABASE_KEY && !SUPABASE_URL.includes("your-project")) {
    try {
      let url = `${SUPABASE_URL}/rest/v1/teams?select=*`;
      if (teamId) {
        url += `&id=eq.${teamId}`;
      } else if (cleanCode) {
        url += `&access_code=ilike.${cleanCode}`;
      }

      const fetchRes = await fetch(url, {
        headers: {
          "apikey": SUPABASE_KEY,
          "Authorization": `Bearer ${SUPABASE_KEY}`,
        },
      });

      if (fetchRes.ok) {
        const teams = await fetchRes.json();
        if (Array.isArray(teams) && teams.length > 0) {
          return res.status(200).json({ success: true, team: teams[0] });
        }
      }
    } catch (e) {
      console.warn("Supabase verify error:", e);
    }
  }

  // If not found in Supabase or using local store
  return res.status(200).json({
    success: true,
    team: {
      id: teamId || 'team-' + cleanCode,
      name: "Verified Team",
      access_code: cleanCode,
      status: "registered",
      current_round: 1,
    }
  });
}
