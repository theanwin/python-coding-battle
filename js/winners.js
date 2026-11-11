/**
 * PYTHON CODING BATTLE - WINNER PODIUM & CELEBRATION
 * Computes top 3 teams based on real verified scores from database,
 * launches celebratory confetti, and displays performance breakdowns.
 */

document.addEventListener("DOMContentLoaded", async () => {
  const podiumContainer = document.getElementById("podium-display-container");
  const emptyState = document.getElementById("winners-empty-state");

  if (!podiumContainer) return;

  try {
    const teams = await window.stateManager.getTeams();

    // Check empty state
    if (!teams || teams.length === 0) {
      if (podiumContainer) podiumContainer.style.display = "none";
      if (emptyState) emptyState.style.display = "block";
      return;
    }

    if (podiumContainer) podiumContainer.style.display = "flex";
    if (emptyState) emptyState.style.display = "none";

    // Sort by total_points DESC, last_submission_at ASC
    const sorted = [...teams].sort((a, b) => {
      const pDiff = (b.total_points || 0) - (a.total_points || 0);
      if (pDiff !== 0) return pDiff;
      if (!a.last_submission_at && !b.last_submission_at) return 0;
      if (!a.last_submission_at) return 1;
      if (!b.last_submission_at) return -1;
      return new Date(a.last_submission_at) - new Date(b.last_submission_at);
    });

    const first = sorted[0] || null;
    const second = sorted[1] || null;
    const third = sorted[2] || null;

    // Render 2nd place (left)
    const col2 = document.getElementById("podium-col-2");
    if (col2 && second) {
      col2.innerHTML = `
        <div class="podium-card">
          <div class="podium-place-icon">🥈</div>
          <span class="badge badge-default" style="margin-bottom:8px;">2nd Place</span>
          <h3 class="podium-team-title">${escapeHtml(second.name)}</h3>
          <div class="podium-dept">${escapeHtml(second.department)}</div>
          <div class="podium-score">${second.total_points || 0} pts</div>
          <div style="font-size:0.75rem;color:var(--text-muted);margin-top:8px;">
            R1: ${second.points_r1 || 0} | R2: ${second.points_r2 || 0} | R3: ${second.points_r3 || 0} | R4: ${second.points_r4 || 0}
          </div>
        </div>
        <div class="podium-block">2</div>
      `;
    }

    // Render 1st place (center)
    const col1 = document.getElementById("podium-col-1");
    if (col1 && first) {
      col1.innerHTML = `
        <div class="podium-card">
          <div class="podium-place-icon">👑 🥇</div>
          <span class="badge badge-warning" style="background:#fef3c7;color:#b45309;margin-bottom:8px;">CHAMPION</span>
          <h3 class="podium-team-title" style="font-size:1.35rem;">${escapeHtml(first.name)}</h3>
          <div class="podium-dept">${escapeHtml(first.department)}</div>
          <div class="podium-score" style="font-size:1.9rem;color:#b45309;">${first.total_points || 0} pts</div>
          <div style="font-size:0.78rem;color:var(--text-muted);margin-top:8px;">
            R1: ${first.points_r1 || 0} | R2: ${first.points_r2 || 0} | R3: ${first.points_r3 || 0} | R4: ${first.points_r4 || 0}
            ${first.points_bonus ? `<span style="display:block;color:#047857;font-weight:600;margin-top:2px;">+${first.points_bonus} Bonus</span>` : ''}
          </div>
        </div>
        <div class="podium-block">1</div>
      `;
    }

    // Render 3rd place (right)
    const col3 = document.getElementById("podium-col-3");
    if (col3 && third) {
      col3.innerHTML = `
        <div class="podium-card">
          <div class="podium-place-icon">🥉</div>
          <span class="badge badge-default" style="margin-bottom:8px;">3rd Place</span>
          <h3 class="podium-team-title">${escapeHtml(third.name)}</h3>
          <div class="podium-dept">${escapeHtml(third.department)}</div>
          <div class="podium-score">${third.total_points || 0} pts</div>
          <div style="font-size:0.75rem;color:var(--text-muted);margin-top:8px;">
            R1: ${third.points_r1 || 0} | R2: ${third.points_r2 || 0} | R3: ${third.points_r3 || 0} | R4: ${third.points_r4 || 0}
          </div>
        </div>
        <div class="podium-block">3</div>
      `;
    }

    // Fire Confetti if canvas-confetti library is available
    if (typeof window.confetti === "function") {
      fireCelebrationConfetti();
    }
  } catch (e) {
    console.error("Error loading winners:", e);
  }
});

function fireCelebrationConfetti() {
  const duration = 3 * 1000;
  const end = Date.now() + duration;

  (function frame() {
    window.confetti({
      particleCount: 3,
      angle: 60,
      spread: 55,
      origin: { x: 0 },
      colors: ['#4f46e5', '#6366f1', '#10b981', '#f59e0b']
    });
    window.confetti({
      particleCount: 3,
      angle: 120,
      spread: 55,
      origin: { x: 1 },
      colors: ['#4f46e5', '#6366f1', '#10b981', '#f59e0b']
    });

    if (Date.now() < end) {
      requestAnimationFrame(frame);
    }
  }());
}

function escapeHtml(str) {
  if (!str) return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
