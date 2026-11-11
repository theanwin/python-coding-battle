/**
 * VERCEL SERVERLESS FUNCTION: /api/timer
 * Records official team competition start timestamps.
 */

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method Not Allowed" });

  const { action, teamId } = req.body || {};

  if (action === "start" && teamId) {
    const now = new Date();
    const endTime = new Date(now.getTime() + 60 * 60 * 1000);

    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

    if (SUPABASE_URL && SUPABASE_KEY && !SUPABASE_URL.includes("your-project")) {
      try {
        const updateRes = await fetch(`${SUPABASE_URL}/rest/v1/teams?id=eq.${teamId}`, {
          method: "PATCH",
          headers: {
            "apikey": SUPABASE_KEY,
            "Authorization": `Bearer ${SUPABASE_KEY}`,
            "Content-Type": "application/json",
            "Prefer": "return=representation",
          },
          body: JSON.stringify({
            status: "in_progress",
            started_at: now.toISOString(),
            end_time: endTime.toISOString(),
            current_round: 1,
          }),
        });

        if (updateRes.ok) {
          const updated = await updateRes.json();
          return res.status(200).json(updated[0] || updated);
        }
      } catch (e) {
        console.warn("Supabase timer update error:", e);
      }
    }

    return res.status(200).json({
      id: teamId,
      status: "in_progress",
      started_at: now.toISOString(),
      end_time: endTime.toISOString(),
      current_round: 1,
    });
  }

  return res.status(400).json({ error: "Invalid action" });
}
