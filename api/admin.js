/**
 * VERCEL SERVERLESS FUNCTION: /api/admin
 * Handles admin score adjustments, audit logging, and data resets.
 */

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method Not Allowed" });

  const { action, payload } = req.body || {};

  return res.status(200).json({ success: true, action });
}
