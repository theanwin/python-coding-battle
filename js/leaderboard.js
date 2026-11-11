/**
 * PYTHON CODING BATTLE - REALTIME LIVE LEADERBOARD
 * Automatically updates scores, ranks teams, handles Projector Mode,
 * and maintains strict empty states when no teams are registered.
 */

class LeaderboardController {
  constructor() {
    this.teams = [];
    this.searchQuery = "";
    this.isProjectorMode = false;
  }

  async init() {
    await this.fetchAndRender();

    // Listen to real-time events from state manager
    window.stateManager.on("leaderboard", () => {
      this.fetchAndRender();
    });

    // Auto-poll fallback every 5 seconds for reliable live updates
    setInterval(() => {
      this.fetchAndRender(true);
    }, 5000);

    this.bindEvents();
  }

  async fetchAndRender(isSilent = false) {
    try {
      const teams = await window.stateManager.getTeams();
      this.teams = teams || [];
      this.render();
    } catch (err) {
      if (!isSilent) console.error("Error fetching leaderboard:", err);
    }
  }

  render() {
    const tableBody = document.getElementById("leaderboard-tbody");
    const emptyState = document.getElementById("leaderboard-empty-state");
    const tableContainer = document.getElementById("leaderboard-table-container");
    const countBadge = document.getElementById("leaderboard-count-badge");

    if (!tableBody) return;

    // Filter by search query if any
    let filtered = [...this.teams];
    if (this.searchQuery) {
      const q = this.searchQuery.toLowerCase();
      filtered = filtered.filter(t => 
        (t.name || "").toLowerCase().includes(q) ||
        (t.department || "").toLowerCase().includes(q) ||
        (t.leader || "").toLowerCase().includes(q)
      );
    }

    // Sort by total_points DESC, last_submission_at ASC (tie breaker)
    filtered.sort((a, b) => {
      const pDiff = (b.total_points || 0) - (a.total_points || 0);
      if (pDiff !== 0) return pDiff;
      if (!a.last_submission_at && !b.last_submission_at) return 0;
      if (!a.last_submission_at) return 1;
      if (!b.last_submission_at) return -1;
      return new Date(a.last_submission_at) - new Date(b.last_submission_at);
    });

    if (countBadge) {
      countBadge.textContent = `${this.teams.length} ${this.teams.length === 1 ? 'Team' : 'Teams'} Registered`;
    }

    // Check Empty State
    if (this.teams.length === 0) {
      if (tableContainer) tableContainer.style.display = "none";
      if (emptyState) emptyState.style.display = "block";
      return;
    }

    if (tableContainer) tableContainer.style.display = "block";
    if (emptyState) emptyState.style.display = "none";

    // Populate rows
    tableBody.innerHTML = filtered.map((team, idx) => {
      const rank = idx + 1;
      let rankBadgeClass = "rank-normal";
      let rankIcon = rank;

      if (rank === 1) {
        rankBadgeClass = "rank-gold";
        rankIcon = "🥇 1";
      } else if (rank === 2) {
        rankBadgeClass = "rank-silver";
        rankIcon = "🥈 2";
      } else if (rank === 3) {
        rankBadgeClass = "rank-bronze";
        rankIcon = "🥉 3";
      }

      const statusBadge = this.getStatusBadge(team);

      return `
        <tr>
          <td>
            <span class="rank-badge ${rankBadgeClass}">${rankIcon}</span>
          </td>
          <td>
            <div class="team-cell-name">${this.escapeHtml(team.name)}</div>
            <div class="team-cell-dept">${this.escapeHtml(team.department)} • Leader: ${this.escapeHtml(team.leader)}</div>
          </td>
          <td><span class="score-pill">${team.points_r1 || 0} / 20</span></td>
          <td><span class="score-pill">${team.points_r2 || 0} / 20</span></td>
          <td><span class="score-pill">${team.points_r3 || 0} / 30</span></td>
          <td><span class="score-pill">${team.points_r4 || 0} / 20</span></td>
          <td>
            ${team.points_bonus ? `<span class="score-pill" style="background:#ecfdf5;color:#047857;font-weight:700;">+${team.points_bonus}</span>` : '<span style="color:var(--text-subtle);">0</span>'}
          </td>
          <td>
            <div class="score-cell-total">${team.total_points || 0}</div>
          </td>
          <td>${statusBadge}</td>
        </tr>
      `;
    }).join("");
  }

  getStatusBadge(team) {
    if (!team.started_at) {
      return `<span class="badge badge-default">Registered</span>`;
    }
    const timerStatus = window.TeamTimer.getTeamStatus(team);
    if (timerStatus.isFinished) {
      return `<span class="badge badge-success">Completed</span>`;
    }
    return `<span class="badge badge-indigo">In Progress (${timerStatus.currentPhaseName})</span>`;
  }

  bindEvents() {
    // Search input
    const searchInput = document.getElementById("leaderboard-search");
    if (searchInput) {
      searchInput.addEventListener("input", (e) => {
        this.searchQuery = e.target.value.trim();
        this.render();
      });
    }

    // Projector Mode toggle button
    const projectorBtn = document.getElementById("toggle-projector-btn");
    if (projectorBtn) {
      projectorBtn.addEventListener("click", () => {
        this.isProjectorMode = !this.isProjectorMode;
        document.body.classList.toggle("projector-mode", this.isProjectorMode);
        projectorBtn.textContent = this.isProjectorMode ? "Exit Projector Mode ✕" : "Projector View 📺";
      });
    }

    // ESC key to exit projector mode
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && this.isProjectorMode) {
        this.isProjectorMode = false;
        document.body.classList.remove("projector-mode");
        if (projectorBtn) projectorBtn.textContent = "Projector View 📺";
      }
    });
  }

  escapeHtml(str) {
    if (!str) return "";
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }
}

document.addEventListener("DOMContentLoaded", () => {
  if (document.getElementById("leaderboard-tbody")) {
    window.leaderboardController = new LeaderboardController();
    window.leaderboardController.init();
  }
});
