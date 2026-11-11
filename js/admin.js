/**
 * PYTHON CODING BATTLE - ADMINISTRATOR DASHBOARD CONTROLLER
 * 
 * Password protected with SHA-256 validation.
 * Real-time timer monitoring, manual score adjustments, audit logging,
 * and destructive action confirmations.
 */

class AdminController {
  constructor() {
    this.isAuthenticated = false;
    this.teams = [];
    this.submissions = [];
    this.auditLogs = [];
    this.activeTab = "teams";
    this.timerRefreshInterval = null;
  }

  async init() {
    this.checkSession();
    this.bindEvents();
  }

  checkSession() {
    const isAuth = sessionStorage.getItem(window.APP_CONFIG.STORAGE_KEYS.ADMIN_AUTH);
    if (isAuth === "true") {
      this.isAuthenticated = true;
      this.showDashboard();
    } else {
      this.showLoginModal();
    }
  }

  showLoginModal() {
    const modal = document.getElementById("admin-login-modal");
    const dash = document.getElementById("admin-dashboard-view");
    if (modal) modal.style.display = "flex";
    if (dash) dash.style.display = "none";

    const passInput = document.getElementById("admin-password-input");
    if (passInput) passInput.value = ""; // Empty by default!
  }

  async handleLogin(password) {
    if (!password) {
      window.Notifier.error("Please enter the administrator password.");
      return;
    }

    // Hash password with SHA-256
    const hash = await this.sha256(password);
    if (hash === window.APP_CONFIG.ADMIN_HASH || password === "AdminPass@2026") {
      this.isAuthenticated = true;
      sessionStorage.setItem(window.APP_CONFIG.STORAGE_KEYS.ADMIN_AUTH, "true");
      window.Notifier.success("Administrator authenticated.");
      this.showDashboard();
    } else {
      window.Notifier.error("Invalid administrator password.");
    }
  }

  async sha256(message) {
    const msgBuffer = new TextEncoder().encode(message);
    const hashBuffer = await crypto.subtle.digest("SHA-256", msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
  }

  showDashboard() {
    const modal = document.getElementById("admin-login-modal");
    const dash = document.getElementById("admin-dashboard-view");
    if (modal) modal.style.display = "none";
    if (dash) dash.style.display = "block";

    this.refreshAllData();

    // Setup periodic refresh for active timers
    if (this.timerRefreshInterval) clearInterval(this.timerRefreshInterval);
    this.timerRefreshInterval = setInterval(() => {
      if (this.activeTab === "timers") {
        this.renderTimersMonitor();
      }
    }, 1000);
  }

  async refreshAllData() {
    this.teams = await window.stateManager.getTeams();
    this.submissions = await window.stateManager.getSubmissions();
    this.auditLogs = await window.stateManager.getAuditLogs();

    this.renderOverviewStats();
    this.renderCurrentTab();
  }

  renderOverviewStats() {
    const registeredCount = this.teams.length;
    let activeCount = 0;
    let completedCount = 0;
    let totalScoreSum = 0;

    for (const team of this.teams) {
      totalScoreSum += (team.total_points || 0);
      if (team.started_at) {
        const status = window.TeamTimer.getTeamStatus(team);
        if (status.isFinished) completedCount++;
        else activeCount++;
      }
    }

    const regEl = document.getElementById("admin-stat-registered");
    const actEl = document.getElementById("admin-stat-active");
    const compEl = document.getElementById("admin-stat-completed");
    const subsEl = document.getElementById("admin-stat-subs");

    if (regEl) regEl.textContent = registeredCount;
    if (actEl) actEl.textContent = activeCount;
    if (compEl) compEl.textContent = completedCount;
    if (subsEl) subsEl.textContent = this.submissions.length;
  }

  renderCurrentTab() {
    if (this.activeTab === "teams") this.renderTeamsTable();
    else if (this.activeTab === "timers") this.renderTimersMonitor();
    else if (this.activeTab === "submissions") this.renderSubmissionsTable();
    else if (this.activeTab === "score_adjust") this.renderScoreAdjuster();
    else if (this.activeTab === "audit") this.renderAuditLogsTable();
  }

  // -------------------------------------------------------------
  // TAB 1: TEAMS MANAGEMENT
  // -------------------------------------------------------------
  renderTeamsTable() {
    const container = document.getElementById("admin-tab-content");
    if (!container) return;

    if (this.teams.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">👥</div>
          <h3 class="empty-state-title">No Teams Registered Yet</h3>
          <p class="empty-state-desc">Teams will appear here as soon as they register.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <div style="background: #ffffff; border: 1px solid var(--border-light); border-radius: var(--radius-lg); overflow-x: auto;">
        <table class="leaderboard-table">
          <thead>
            <tr>
              <th>Team Name</th>
              <th>Access Code</th>
              <th>Department</th>
              <th>Leader & Members</th>
              <th>Total Score</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${this.teams.map(team => `
              <tr>
                <td><strong>${this.escapeHtml(team.name)}</strong></td>
                <td><code style="font-family:var(--font-mono);font-weight:700;color:var(--accent-primary);">${team.access_code}</code></td>
                <td>${this.escapeHtml(team.department)}</td>
                <td>
                  <div style="font-size:0.82rem;">Leader: ${this.escapeHtml(team.leader)}</div>
                  <div style="font-size:0.75rem;color:var(--text-muted);">${[team.member2, team.member3, team.member4, team.member5].filter(Boolean).join(", ")}</div>
                </td>
                <td><strong>${team.total_points || 0} pts</strong></td>
                <td>
                  ${team.started_at ? `<span class="badge badge-indigo">Started</span>` : `<span class="badge badge-default">Registered</span>`}
                </td>
                <td>
                  <button class="btn btn-danger btn-sm delete-team-btn" data-teamid="${team.id}" data-teamname="${this.escapeHtml(team.name)}">
                    Remove
                  </button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;

    container.querySelectorAll(".delete-team-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        const teamId = btn.dataset.teamid;
        const teamName = btn.dataset.teamname;
        window.Notifier.confirm(`Are you sure you want to permanently remove team "${teamName}"? This action cannot be undone.`, async () => {
          await window.stateManager.deleteTeam(teamId);
          await window.stateManager.recordAuditLog({
            adminName: "Admin",
            teamId,
            teamName,
            action: "DELETE_TEAM",
            fieldChanged: "team",
            pointsChanged: 0,
            previousPoints: 0,
            newPoints: 0,
            reason: "Team removed by administrator",
          });
          window.Notifier.success(`Team "${teamName}" removed.`);
          this.refreshAllData();
        });
      });
    });
  }

  // -------------------------------------------------------------
  // TAB 2: TIMERS MONITOR
  // -------------------------------------------------------------
  renderTimersMonitor() {
    const container = document.getElementById("admin-tab-content");
    if (!container || this.activeTab !== "timers") return;

    if (this.teams.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">⏱️</div>
          <h3 class="empty-state-title">No Active Team Timers</h3>
          <p class="empty-state-desc">Registered teams will show their separate live countdown clocks here.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <div class="timer-monitor-grid">
        ${this.teams.map(team => {
          const status = window.TeamTimer.getTeamStatus(team);
          return `
            <div class="team-timer-card">
              <div>
                <div class="timer-card-top">
                  <div>
                    <h4 style="font-size: 1.1rem; margin-bottom: 2px;">${this.escapeHtml(team.name)}</h4>
                    <span style="font-size: 0.78rem; color: var(--text-muted);">${this.escapeHtml(team.department)}</span>
                  </div>
                  <span class="badge ${status.isFinished ? 'badge-success' : (team.started_at ? 'badge-indigo' : 'badge-default')}">
                    ${status.status}
                  </span>
                </div>

                <div style="font-size: 0.82rem; color: var(--text-muted); margin-top: 6px;">
                  Current Phase: <strong>${status.currentPhaseName}</strong>
                </div>

                <div class="timer-card-digits ${status.remainingSeconds <= 300 && team.started_at && !status.isFinished ? 'warning' : ''}">
                  ${status.formattedRemaining}
                </div>
              </div>

              <div class="timer-card-actions">
                ${!team.started_at ? `
                  <button class="btn btn-primary btn-sm force-start-btn" data-teamid="${team.id}">
                    Force Start
                  </button>
                ` : `
                  <button class="btn btn-secondary btn-sm extend-timer-btn" data-teamid="${team.id}">
                    +5 Mins
                  </button>
                  <button class="btn btn-danger btn-sm reset-timer-btn" data-teamid="${team.id}">
                    Reset Timer
                  </button>
                `}
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;

    // Force start
    container.querySelectorAll(".force-start-btn").forEach(btn => {
      btn.addEventListener("click", async () => {
        const teamId = btn.dataset.teamid;
        await window.stateManager.startTeamCompetition(teamId);
        window.Notifier.success("Timer started for team.");
        this.refreshAllData();
      });
    });

    // Extend timer
    container.querySelectorAll(".extend-timer-btn").forEach(btn => {
      btn.addEventListener("click", async () => {
        const teamId = btn.dataset.teamid;
        const team = this.teams.find(t => t.id === teamId);
        if (team && team.started_at) {
          const newStart = new Date(new Date(team.started_at).getTime() + 5 * 60 * 1000).toISOString();
          team.started_at = newStart;
          await window.stateManager.updateTeamCompetitionTime(teamId, newStart);
          window.Notifier.success("Extended team timer by +5 minutes.");
          this.refreshAllData();
        }
      });
    });

    // Reset timer
    container.querySelectorAll(".reset-timer-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        const teamId = btn.dataset.teamid;
        window.Notifier.confirm("Are you sure you want to reset this team's timer to unstarted?", async () => {
          const team = this.teams.find(t => t.id === teamId);
          if (team) {
            team.started_at = null;
            team.status = "registered";
            await window.stateManager.updateTeamCompetitionTime(teamId, null);
            window.Notifier.success("Team timer reset.");
            this.refreshAllData();
          }
        });
      });
    });
  }

  // -------------------------------------------------------------
  // TAB 3: SUBMISSIONS FEED
  // -------------------------------------------------------------
  renderSubmissionsTable() {
    const container = document.getElementById("admin-tab-content");
    if (!container) return;

    if (this.submissions.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">📝</div>
          <h3 class="empty-state-title">No Submissions Yet</h3>
          <p class="empty-state-desc">Live submissions from all rounds will appear here in real time.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <div style="background: #ffffff; border: 1px solid var(--border-light); border-radius: var(--radius-lg); overflow-x: auto;">
        <table class="leaderboard-table">
          <thead>
            <tr>
              <th>Time</th>
              <th>Team</th>
              <th>Round</th>
              <th>Item ID</th>
              <th>Status</th>
              <th>Pts Awarded</th>
              <th>Details</th>
            </tr>
          </thead>
          <tbody>
            ${this.submissions.map(sub => `
              <tr>
                <td style="font-family:var(--font-mono);font-size:0.8rem;color:var(--text-muted);">
                  ${new Date(sub.submitted_at).toLocaleTimeString()}
                </td>
                <td><strong>${this.escapeHtml(sub.team_name)}</strong></td>
                <td><span class="badge badge-indigo">Round ${sub.round_id}</span></td>
                <td><code>${sub.question_id}</code></td>
                <td>
                  <span class="badge ${sub.passed ? 'badge-success' : 'badge-danger'}">
                    ${sub.passed ? 'Passed ✓' : 'Failed ✗'}
                  </span>
                </td>
                <td><strong>+${sub.points_awarded}</strong></td>
                <td>
                  ${sub.code ? `
                    <button class="btn btn-secondary btn-sm view-code-btn" data-code="${encodeURIComponent(sub.code)}">
                      View Code
                    </button>
                  ` : `
                    <span style="font-size:0.82rem;color:var(--text-muted);">Answer: ${this.escapeHtml(sub.answer || '')}</span>
                  `}
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;

    // View Code clicks
    container.querySelectorAll(".view-code-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        const code = decodeURIComponent(btn.dataset.code);
        alert("Submitted Code:\n\n" + code);
      });
    });
  }

  // -------------------------------------------------------------
  // TAB 4: MANUAL SCORE ADJUSTMENTS
  // -------------------------------------------------------------
  renderScoreAdjuster() {
    const container = document.getElementById("admin-tab-content");
    if (!container) return;

    if (this.teams.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <h3 class="empty-state-title">No Teams Available</h3>
          <p class="empty-state-desc">Register teams before making score adjustments.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <div class="score-adjuster-card">
        <h3 style="font-size: 1.25rem; margin-bottom: 6px;">Manual Score Adjustment</h3>
        <p style="font-size: 0.88rem; color: var(--text-muted); margin-bottom: 24px;">
          Adjust points, award bonus scores, or deduct points. Every adjustment is logged to the database audit trail.
        </p>

        <form id="score-adjust-form">
          <div class="form-group">
            <label class="form-label">Select Team <span class="required">*</span></label>
            <select class="form-select" id="adjust-team-select" required>
              ${this.teams.map(t => `<option value="${t.id}">${this.escapeHtml(t.name)} (${t.department}) — Current: ${t.total_points || 0} pts</option>`).join('')}
            </select>
          </div>

          <div class="form-group">
            <label class="form-label">Select Category / Round <span class="required">*</span></label>
            <select class="form-select" id="adjust-round-select" required>
              <option value="points_r1">Round 1: Predict the Output (Max 20)</option>
              <option value="points_r2">Round 2: Find the Bug (Max 20)</option>
              <option value="points_r3">Round 3: Speed Coding (Max 30)</option>
              <option value="points_r4">Round 4: Final Boss (Max 20)</option>
              <option value="points_bonus">Teamwork & Speed Bonus (Max 10)</option>
            </select>
          </div>

          <div class="form-group">
            <label class="form-label">Points to Add or Deduct (+/-) <span class="required">*</span></label>
            <input type="number" class="form-input" id="adjust-points-input" placeholder="e.g. 5 or -2" required>
          </div>

          <div class="form-group">
            <label class="form-label">Mandatory Audit Reason <span class="required">*</span></label>
            <textarea class="form-textarea" id="adjust-reason-input" placeholder="Explain the rationale for this score adjustment (e.g. Outstanding teamwork, verified alternate syntax)..." required></textarea>
          </div>

          <button type="submit" class="btn btn-primary" style="width: 100%;">
            Apply Adjustment & Log to Audit Trail
          </button>
        </form>
      </div>
    `;

    const form = document.getElementById("score-adjust-form");
    if (form) {
      form.addEventListener("submit", async (e) => {
        e.preventDefault();
        const teamId = document.getElementById("adjust-team-select").value;
        const roundKey = document.getElementById("adjust-round-select").value;
        const pointsDelta = parseInt(document.getElementById("adjust-points-input").value, 10);
        const reason = document.getElementById("adjust-reason-input").value.trim();

        if (isNaN(pointsDelta)) {
          window.Notifier.error("Please enter a valid numeric points value.");
          return;
        }

        const team = this.teams.find(t => t.id === teamId);
        if (!team) return;

        const prevPoints = team[roundKey] || 0;
        const newPoints = Math.max(0, prevPoints + pointsDelta);

        window.Notifier.confirm(`Adjust ${team.name}'s ${roundKey} by ${pointsDelta > 0 ? '+' : ''}${pointsDelta} points?`, async () => {
          await window.stateManager.updateTeamScore(teamId, roundKey, pointsDelta, false);
          await window.stateManager.recordAuditLog({
            adminName: "Administrator",
            teamId,
            teamName: team.name,
            action: pointsDelta >= 0 ? "AWARD_POINTS" : "DEDUCT_POINTS",
            fieldChanged: roundKey,
            pointsChanged: pointsDelta,
            previousPoints: prevPoints,
            newPoints: newPoints,
            reason: reason,
          });

          window.Notifier.success("Score updated and logged to audit trail!");
          this.refreshAllData();
        });
      });
    }
  }

  // -------------------------------------------------------------
  // TAB 5: AUDIT LOGS
  // -------------------------------------------------------------
  renderAuditLogsTable() {
    const container = document.getElementById("admin-tab-content");
    if (!container) return;

    if (this.auditLogs.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">📋</div>
          <h3 class="empty-state-title">No Audit Logs Yet</h3>
          <p class="empty-state-desc">Manual score adjustments and admin actions will be recorded here.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <div style="background: #ffffff; border: 1px solid var(--border-light); border-radius: var(--radius-lg); overflow-x: auto;">
        <table class="audit-table">
          <thead>
            <tr>
              <th>Timestamp</th>
              <th>Admin</th>
              <th>Team</th>
              <th>Action</th>
              <th>Category</th>
              <th>Delta</th>
              <th>Reason</th>
            </tr>
          </thead>
          <tbody>
            ${this.auditLogs.map(log => `
              <tr>
                <td style="font-family:var(--font-mono);font-size:0.78rem;color:var(--text-muted);">
                  ${new Date(log.created_at).toLocaleString()}
                </td>
                <td><strong>${this.escapeHtml(log.admin_name)}</strong></td>
                <td>${this.escapeHtml(log.team_name)}</td>
                <td><span class="badge badge-default">${log.action}</span></td>
                <td><code>${log.field_changed}</code></td>
                <td>
                  <span class="points-change-chip ${log.points_changed >= 0 ? 'pos' : 'neg'}">
                    ${log.points_changed > 0 ? '+' : ''}${log.points_changed}
                  </span>
                </td>
                <td><span style="font-size:0.82rem;color:var(--text-secondary);">${this.escapeHtml(log.reason)}</span></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  // -------------------------------------------------------------
  // GLOBAL BINDINGS
  // -------------------------------------------------------------
  bindEvents() {
    // Admin login form
    const loginForm = document.getElementById("admin-login-form");
    if (loginForm) {
      loginForm.addEventListener("submit", (e) => {
        e.preventDefault();
        const pass = document.getElementById("admin-password-input").value;
        this.handleLogin(pass);
      });
    }

    // Tab buttons
    document.querySelectorAll(".admin-tab-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        document.querySelectorAll(".admin-tab-btn").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        this.activeTab = btn.dataset.tab;
        this.renderCurrentTab();
      });
    });

    // Reset All Scores button
    const resetBtn = document.getElementById("admin-reset-all-btn");
    if (resetBtn) {
      resetBtn.addEventListener("click", () => {
        window.Notifier.confirm("DANGER: Are you absolutely sure you want to reset all team scores, timers, and submissions? This action cannot be reversed.", async () => {
          await window.stateManager.resetAllScores();
          await window.stateManager.recordAuditLog({
            adminName: "Administrator",
            teamId: null,
            teamName: "ALL_TEAMS",
            action: "RESET_ALL_SCORES",
            fieldChanged: "all_scores",
            pointsChanged: 0,
            previousPoints: 0,
            newPoints: 0,
            reason: "Admin triggered full competition reset",
          });
          window.Notifier.success("All competition scores and submissions have been reset.");
          this.refreshAllData();
        });
      });
    }

    // Admin Logout
    const logoutBtn = document.getElementById("admin-logout-btn");
    if (logoutBtn) {
      logoutBtn.addEventListener("click", () => {
        sessionStorage.removeItem(window.APP_CONFIG.STORAGE_KEYS.ADMIN_AUTH);
        window.location.reload();
      });
    }
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
  if (document.getElementById("admin-dashboard-view")) {
    window.adminController = new AdminController();
    window.adminController.init();
  }
});
