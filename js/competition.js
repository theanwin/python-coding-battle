/**
 * PYTHON CODING BATTLE - COMPETITION ROUNDS CONTROLLER
 * 
 * Manages team entry, team-specific 60-minute countdown,
 * automatic round scheduling, CodeMirror instances, and answer submissions.
 */

class CompetitionController {
  constructor() {
    this.currentTeam = null;
    this.timer = null;
    this.activeRoundNumber = 0; // 0: intro, 1: R1, 2: R2, 3: R3, 4: R4, 5: review
    this.cmEditors = {}; // CodeMirror instances by editor ID
    this.solvedQuestions = {
      1: {}, // qId -> boolean
      2: {}, // bId -> boolean
      3: {}, // cId -> boolean
      4: false, // boss -> boolean
    };

    // Sub-tab pointers
    this.currentSubTab = {
      1: "q1",
      2: "b1",
      3: "c1",
    };
  }

  async init() {
    // 1. Check if a team is already selected in local session
    let storedTeam = localStorage.getItem(window.APP_CONFIG.STORAGE_KEYS.CURRENT_TEAM);
    
    // Fallback: If not in current team session, pick the latest registered local team
    if (!storedTeam) {
      const localTeamsRaw = localStorage.getItem(window.APP_CONFIG.STORAGE_KEYS.LOCAL_TEAMS);
      if (localTeamsRaw) {
        try {
          const list = JSON.parse(localTeamsRaw);
          if (Array.isArray(list) && list.length > 0) {
            storedTeam = JSON.stringify(list[list.length - 1]);
            localStorage.setItem(window.APP_CONFIG.STORAGE_KEYS.CURRENT_TEAM, storedTeam);
          }
        } catch (e) {}
      }
    }

    if (storedTeam) {
      try {
        const parsed = JSON.parse(storedTeam);
        try {
          if (window.stateManager && window.stateManager.getTeamById) {
            const fresh = await window.stateManager.getTeamById(parsed.id);
            this.currentTeam = fresh || parsed;
          } else {
            this.currentTeam = parsed;
          }
        } catch (e) {
          this.currentTeam = parsed;
        }
      } catch (e) {
        this.currentTeam = null;
      }
    }

    if (!this.currentTeam) {
      this.showEntryScreen();
    } else {
      this.handleTeamLoaded();
    }

    this.bindGlobalEvents();
  }

  // -------------------------------------------------------------
  // TEAM ENTRY & SELECTION (Prompt to register if no team exists)
  // -------------------------------------------------------------
  showEntryScreen() {
    document.getElementById("comp-entry-view").style.display = "block";
    document.getElementById("comp-lobby-view").style.display = "none";
    document.getElementById("comp-active-view").style.display = "none";
    document.getElementById("comp-timer-header").style.display = "none";
  }

  handleTeamLoaded() {
    document.getElementById("comp-entry-view").style.display = "none";
    
    // Check if team has already started their competition
    if (!this.currentTeam.started_at) {
      this.showLobbyScreen();
    } else {
      this.startActiveCompetition();
    }
  }

  showLobbyScreen() {
    document.getElementById("comp-lobby-view").style.display = "block";
    document.getElementById("comp-active-view").style.display = "none";
    document.getElementById("comp-timer-header").style.display = "none";

    const nameEl = document.getElementById("lobby-team-name");
    if (nameEl) nameEl.textContent = this.currentTeam.name;

    const deptEl = document.getElementById("lobby-team-dept");
    if (deptEl) deptEl.textContent = this.currentTeam.department;

    const codeEl = document.getElementById("lobby-access-code");
    if (codeEl) codeEl.textContent = this.currentTeam.access_code || "";

    // Render team members
    const membersList = document.getElementById("lobby-members-list");
    if (membersList) {
      membersList.innerHTML = `
        <span class="member-chip">👑 Leader: ${this.currentTeam.leader}</span>
        <span class="member-chip">${this.currentTeam.member2}</span>
        <span class="member-chip">${this.currentTeam.member3}</span>
        <span class="member-chip">${this.currentTeam.member4}</span>
        ${this.currentTeam.member5 ? `<span class="member-chip">${this.currentTeam.member5}</span>` : ""}
      `;
    }

    const startBtn = document.getElementById("start-competition-btn");
    startBtn.onclick = async () => {
      startBtn.disabled = true;
      startBtn.innerHTML = `Starting Competition...`;

      try {
        const updated = await window.stateManager.startTeamCompetition(this.currentTeam.id);
        if (updated) this.currentTeam = updated;
        localStorage.setItem(window.APP_CONFIG.STORAGE_KEYS.CURRENT_TEAM, JSON.stringify(this.currentTeam));
        this.startActiveCompetition();
      } catch (err) {
        window.Notifier.error("Could not start competition: " + err.message);
        startBtn.disabled = false;
        startBtn.innerHTML = `Start Competition ⚡`;
      }
    };
  }

  // -------------------------------------------------------------
  // ACTIVE COMPETITION & TIMER
  // -------------------------------------------------------------
  async startActiveCompetition() {
    document.getElementById("comp-lobby-view").style.display = "none";
    document.getElementById("comp-entry-view").style.display = "none";
    document.getElementById("comp-active-view").style.display = "block";
    document.getElementById("comp-timer-header").style.display = "block";

    // Setup header team info
    document.getElementById("header-team-name").textContent = this.currentTeam.name;
    document.getElementById("header-team-dept").textContent = this.currentTeam.department;

    // Load past submissions for this team to mark solved items
    await this.loadPreviousSubmissions();

    // Initialize Timer
    this.timer = new window.TeamTimer(this.currentTeam, {
      onTick: (tickData) => this.handleTimerTick(tickData),
      onRoundChange: (newPhase, prevPhase) => this.handleRoundTransition(newPhase, prevPhase),
      onWarning: (warnData) => this.handleRoundWarning(warnData),
      onFinish: () => this.handleCompetitionFinished(),
    });

    this.timer.start();
  }

  async loadPreviousSubmissions() {
    const subs = await window.stateManager.getSubmissions(this.currentTeam.id);
    for (const sub of subs) {
      if (sub.passed) {
        if (sub.round_id === 1) this.solvedQuestions[1][sub.question_id] = true;
        if (sub.round_id === 2) this.solvedQuestions[2][sub.question_id] = true;
        if (sub.round_id === 3) this.solvedQuestions[3][sub.question_id] = true;
        if (sub.round_id === 4) this.solvedQuestions[4] = true;
      }
    }
  }

  handleTimerTick(tickData) {
    const totalDigits = document.getElementById("header-total-timer");
    const roundDigits = document.getElementById("header-round-timer");
    const roundLabel = document.getElementById("header-round-label");

    if (totalDigits) {
      totalDigits.textContent = tickData.formattedTotalRemaining || "00:00";
      if (tickData.remainingTotalSec <= 300) {
        totalDigits.classList.add("warning");
      }
    }

    if (roundDigits) {
      roundDigits.textContent = tickData.formattedRoundRemaining || "00:00";
      if (tickData.remainingRoundSec <= 60 && tickData.currentPhase.isRound) {
        roundDigits.classList.add("warning");
      } else {
        roundDigits.classList.remove("warning");
      }
    }

    if (roundLabel) {
      roundLabel.textContent = tickData.currentPhase.name;
    }
  }

  handleRoundTransition(newPhase, prevPhase) {
    this.activeRoundNumber = newPhase.roundNumber;
    window.Notifier.info(`Transitioned to: ${newPhase.name}`, "Schedule Update");

    // Update Step Indicators
    document.querySelectorAll(".step-item").forEach(step => {
      const stepRound = Number(step.dataset.round);
      step.classList.remove("active");
      if (stepRound === newPhase.roundNumber) {
        step.classList.add("active");
      } else if (stepRound < newPhase.roundNumber) {
        step.classList.add("completed");
      }
    });

    // Render Round View
    this.renderActiveRoundView(newPhase.roundNumber);
  }

  handleRoundWarning(warnData) {
    window.Notifier.showRoundWarning(warnData.roundId, warnData.roundName);
  }

  handleCompetitionFinished() {
    window.Notifier.warning("Competition time is up! All rounds have concluded.", "Time Up");
    this.renderActiveRoundView(5); // Completion screen
  }

  // -------------------------------------------------------------
  // ROUND RENDERING
  // -------------------------------------------------------------
  renderActiveRoundView(roundNum) {
    const container = document.getElementById("round-content-container");
    if (!container) return;

    if (roundNum === 0) {
      this.renderIntroView(container);
    } else if (roundNum === 1) {
      this.renderRound1View(container);
    } else if (roundNum === 2) {
      this.renderRound2View(container);
    } else if (roundNum === 3) {
      this.renderRound3View(container);
    } else if (roundNum === 4) {
      this.renderRound4View(container);
    } else {
      this.renderReviewView(container);
    }

    // Refresh icons
    if (window.lucide && typeof window.lucide.createIcons === "function") {
      window.lucide.createIcons();
    }
  }

  // Phase 0: Intro View (00-05 min)
  renderIntroView(container) {
    container.innerHTML = `
      <div class="card" style="text-align: center; padding: 40px 24px;">
        <span class="badge badge-indigo" style="margin-bottom: 14px;">Schedule: 00–05 min</span>
        <h2 style="font-size: 1.8rem; margin-bottom: 12px;">Phase 0: Introduction & Event Briefing</h2>
        <p style="color: var(--text-secondary); max-width: 620px; margin: 0 auto 30px;">
          Welcome, <strong>${this.currentTeam.name}</strong>! Read the competition guidelines carefully before Round 1 starts at the 5-minute mark.
        </p>
        <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; text-align: left; max-width: 700px; margin: 0 auto 30px;">
          <div style="background: var(--bg-secondary); padding: 16px; border-radius: var(--radius-md); border: 1px solid var(--border-light);">
            <div style="font-weight: 600; margin-bottom: 4px;">🧠 Round 1: Predict the Output</div>
            <div style="font-size: 0.82rem; color: var(--text-muted);">10 Mins • 20 Pts • Pure mental execution. No compiler allowed!</div>
          </div>
          <div style="background: var(--bg-secondary); padding: 16px; border-radius: var(--radius-md); border: 1px solid var(--border-light);">
            <div style="font-weight: 600; margin-bottom: 4px;">🐛 Round 2: Find the Bug</div>
            <div style="font-size: 0.82rem; color: var(--text-muted);">10 Mins • 20 Pts • Syntax, logic, indentation debugging with embedded editor.</div>
          </div>
          <div style="background: var(--bg-secondary); padding: 16px; border-radius: var(--radius-md); border: 1px solid var(--border-light);">
            <div style="font-weight: 600; margin-bottom: 4px;">⚡ Round 3: Speed Coding</div>
            <div style="font-size: 0.82rem; color: var(--text-muted);">20 Mins • 30 Pts • 5 algorithmic challenges with test-case scoring.</div>
          </div>
          <div style="background: var(--bg-secondary); padding: 16px; border-radius: var(--radius-md); border: 1px solid var(--border-light);">
            <div style="font-weight: 600; margin-bottom: 4px;">👑 Round 4: Final Boss</div>
            <div style="font-size: 0.82rem; color: var(--text-muted);">10 Mins • 20 Pts • Student Grade Calculator with nested if logic.</div>
          </div>
        </div>
        <p style="font-size: 0.85rem; color: var(--text-muted);">
          Round 1 will automatically unlock at the 5-minute mark. Prepare your team!
        </p>
      </div>
    `;
  }

  // -------------------------------------------------------------
  // ROUND 1: PREDICT THE OUTPUT (MCQs - No Compiler!)
  // -------------------------------------------------------------
  renderRound1View(container) {
    const questions = window.ROUND1_QUESTIONS;
    const activeQId = this.currentSubTab[1] || questions[0].id;
    const currentQ = questions.find(q => q.id === activeQId) || questions[0];
    const isSolved = Boolean(this.solvedQuestions[1][currentQ.id]);

    container.innerHTML = `
      <div class="card" style="margin-bottom: 24px;">
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 18px; flex-wrap: wrap; gap: 10px;">
          <div>
            <div style="display: flex; align-items: center; gap: 8px;">
              <span class="badge badge-indigo">Round 1 of 4</span>
              <span class="badge badge-warning">No Compiler Allowed</span>
            </div>
            <h2 style="font-size: 1.5rem; margin-top: 6px;">Predict the Output</h2>
          </div>
          <div style="text-align: right;">
            <div style="font-size: 0.78rem; color: var(--text-muted);">Round Points</div>
            <div style="font-size: 1.3rem; font-weight: 700; color: var(--accent-primary);">
              ${this.currentTeam.points_r1 || 0} / 20 Pts
            </div>
          </div>
        </div>

        <!-- Question Tabs -->
        <div class="sub-tabs">
          ${questions.map((q, idx) => `
            <button class="sub-tab-btn ${q.id === activeQId ? 'active' : ''} ${this.solvedQuestions[1][q.id] ? 'solved' : ''}" data-qid="${q.id}">
              Q${idx + 1} (${q.points}p) ${this.solvedQuestions[1][q.id] ? '✓' : ''}
            </button>
          `).join('')}
        </div>

        <!-- Question Details -->
        <div style="margin-bottom: 16px;">
          <h3 style="font-size: 1.15rem; margin-bottom: 6px;">${currentQ.title}</h3>
          <span class="badge badge-default" style="margin-bottom: 14px;">Concept: ${currentQ.concept}</span>
        </div>

        <!-- Code Block -->
        <pre class="code-box-static"><code>${this.escapeHtml(currentQ.code)}</code></pre>

        <!-- MCQ Options -->
        <div class="mcq-options" id="mcq-options-container">
          ${currentQ.options.map(opt => `
            <label class="mcq-option-label" data-option="${this.escapeHtml(opt)}">
              <input type="radio" name="round1_answer" value="${this.escapeHtml(opt)}" ${isSolved ? 'disabled' : ''}>
              <span>${this.escapeHtml(opt)}</span>
            </label>
          `).join('')}
        </div>

        <!-- Action / Status -->
        <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px;">
          <button class="btn btn-primary" id="r1-submit-btn" ${isSolved ? 'disabled' : ''}>
            ${isSolved ? 'Submitted ✓' : `Submit Answer (+${currentQ.points} Pts)`}
          </button>
          <span style="font-size: 0.82rem; color: var(--text-muted);">
            Solve mentally using operator precedence and Python rules.
          </span>
        </div>

        <!-- Explanation Card (Shown after solved or submitted) -->
        <div id="r1-explanation-box" style="display: ${isSolved ? 'block' : 'none'};" class="explanation-card">
          <strong>Explanation:</strong> ${currentQ.explanation}
        </div>
      </div>
    `;

    // Tab clicks
    container.querySelectorAll(".sub-tab-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        this.currentSubTab[1] = btn.dataset.qid;
        this.renderRound1View(container);
      });
    });

    // Option selections
    const labels = container.querySelectorAll(".mcq-option-label");
    labels.forEach(label => {
      label.addEventListener("click", () => {
        if (isSolved) return;
        labels.forEach(l => l.classList.remove("selected"));
        label.classList.add("selected");
        const radio = label.querySelector("input[type='radio']");
        if (radio) radio.checked = true;
      });
    });

    // Submit handler
    const submitBtn = document.getElementById("r1-submit-btn");
    if (submitBtn && !isSolved) {
      submitBtn.addEventListener("click", async () => {
        const selectedRadio = container.querySelector("input[name='round1_answer']:checked");
        if (!selectedRadio) {
          window.Notifier.error("Please select an answer option first.");
          return;
        }

        submitBtn.disabled = true;
        submitBtn.innerText = "Evaluating...";

        const answer = selectedRadio.value;
        const res = await window.CodeRunner.submitSolution({
          teamId: this.currentTeam.id,
          teamName: this.currentTeam.name,
          roundId: 1,
          questionId: currentQ.id,
          answer: answer,
        });

        // Update local solved cache
        this.solvedQuestions[1][currentQ.id] = true;
        if (res.passed) {
          window.Notifier.success(res.message);
          this.currentTeam.points_r1 = (this.currentTeam.points_r1 || 0) + res.pointsAwarded;
        } else {
          window.Notifier.error(res.message);
        }

        // Show explanation and refresh tab
        this.renderRound1View(container);
      });
    }
  }

  // -------------------------------------------------------------
  // ROUND 2: FIND THE BUG (CodeMirror Editor + Debugging)
  // -------------------------------------------------------------
  renderRound2View(container) {
    const bugs = window.ROUND2_BUGS;
    const activeBugId = this.currentSubTab[2] || bugs[0].id;
    const currentBug = bugs.find(b => b.id === activeBugId) || bugs[0];
    const isSolved = Boolean(this.solvedQuestions[2][currentBug.id]);

    container.innerHTML = `
      <div class="card" style="margin-bottom: 24px;">
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 18px; flex-wrap: wrap; gap: 10px;">
          <div>
            <div style="display: flex; align-items: center; gap: 8px;">
              <span class="badge badge-indigo">Round 2 of 4</span>
              <span class="badge badge-warning">Find the Bug 🐛</span>
            </div>
            <h2 style="font-size: 1.5rem; margin-top: 6px;">Syntax, Indentation & Logic Debugging</h2>
          </div>
          <div style="text-align: right;">
            <div style="font-size: 0.78rem; color: var(--text-muted);">Round Points</div>
            <div style="font-size: 1.3rem; font-weight: 700; color: var(--accent-primary);">
              ${this.currentTeam.points_r2 || 0} / 20 Pts
            </div>
          </div>
        </div>

        <!-- Bug Tabs -->
        <div class="sub-tabs">
          ${bugs.map((b, idx) => `
            <button class="sub-tab-btn ${b.id === activeBugId ? 'active' : ''} ${this.solvedQuestions[2][b.id] ? 'solved' : ''}" data-bid="${b.id}">
              Bug ${idx + 1} (${b.points}p) ${this.solvedQuestions[2][b.id] ? '✓' : ''}
            </button>
          `).join('')}
        </div>

        <div class="coding-workspace">
          <!-- Prompt Column -->
          <div class="coding-prompt-col">
            <h3 style="font-size: 1.15rem;">${currentBug.title}</h3>
            <span class="badge badge-danger">Category: ${currentBug.category}</span>
            <p style="font-size: 0.9rem; color: var(--text-secondary);">${currentBug.description}</p>
            
            <div style="background: var(--bg-secondary); padding: 12px 16px; border-radius: var(--radius-md); border: 1px solid var(--border-light); font-size: 0.85rem;">
              <strong>Expected Output:</strong>
              <code style="display: block; margin-top: 4px; font-family: var(--font-mono); color: var(--accent-primary); font-weight: 600;">${currentBug.expectedOutput}</code>
            </div>

            <div style="font-size: 0.82rem; color: var(--text-muted);">
              💡 <strong>Hint:</strong> ${currentBug.hint}
            </div>

            <!-- Explanation Box if solved -->
            <div id="r2-explanation-box" style="display: ${isSolved ? 'block' : 'none'};" class="explanation-card">
              <strong>Bug Resolution:</strong> ${currentBug.explanation}
            </div>
          </div>

          <!-- CodeMirror Editor Column -->
          <div class="coding-editor-col">
            <div class="editor-wrapper">
              <div class="editor-toolbar">
                <span>Python Editor</span>
                <div class="editor-actions">
                  <button class="btn btn-secondary btn-sm" id="r2-reset-btn">Reset Code</button>
                </div>
              </div>
              <textarea id="r2-editor-textarea"></textarea>
            </div>

            <!-- Run & Submit Actions -->
            <div style="display: flex; align-items: center; gap: 10px;">
              <button class="btn btn-secondary btn-sm" id="r2-run-btn">
                Run Code ▶
              </button>
              <button class="btn btn-primary btn-sm" id="r2-submit-btn" ${isSolved ? 'disabled' : ''}>
                ${isSolved ? 'Fix Accepted ✓' : `Submit Fix (+${currentBug.points} Pts)`}
              </button>
            </div>

            <!-- Terminal Console -->
            <div class="io-console">
              <div class="io-header">
                <span>OUTPUT CONSOLE</span>
                <span id="r2-console-status" class="io-status-tag">Ready</span>
              </div>
              <div class="io-body" id="r2-console-out">Click "Run Code" to test your fix...</div>
            </div>
          </div>
        </div>
      </div>
    `;

    // Mount CodeMirror
    const textarea = document.getElementById("r2-editor-textarea");
    const initialCode = currentBug.buggyCode;
    textarea.value = initialCode;

    const cm = window.CodeMirror.fromTextArea(textarea, {
      mode: "python",
      lineNumbers: true,
      indentUnit: 4,
      matchBrackets: true,
      theme: "default",
    });
    this.cmEditors["r2"] = cm;

    // Tab buttons
    container.querySelectorAll(".sub-tab-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        this.currentSubTab[2] = btn.dataset.bid;
        this.renderRound2View(container);
      });
    });

    // Reset code
    document.getElementById("r2-reset-btn").addEventListener("click", () => {
      cm.setValue(currentBug.buggyCode);
      window.Notifier.info("Code restored to original buggy state.");
    });

    // Run code
    document.getElementById("r2-run-btn").addEventListener("click", async () => {
      const code = cm.getValue();
      const statusTag = document.getElementById("r2-console-status");
      const outBox = document.getElementById("r2-console-out");

      statusTag.className = "io-status-tag";
      statusTag.textContent = "Executing...";
      outBox.textContent = "Running in Python sandbox...";

      const runRes = await window.CodeRunner.runCode(code);
      if (runRes.success) {
        statusTag.className = "io-status-tag accepted";
        statusTag.textContent = `Success (${runRes.executionTimeMs}ms)`;
        outBox.textContent = runRes.stdout || "(No output produced)";
      } else {
        statusTag.className = "io-status-tag error";
        statusTag.textContent = "Error";
        outBox.textContent = runRes.stderr || runRes.error || "Execution failed.";
      }
    });

    // Submit Fix
    const submitBtn = document.getElementById("r2-submit-btn");
    if (submitBtn && !isSolved) {
      submitBtn.addEventListener("click", async () => {
        const code = cm.getValue();
        submitBtn.disabled = true;
        submitBtn.innerText = "Evaluating...";

        const res = await window.CodeRunner.submitSolution({
          teamId: this.currentTeam.id,
          teamName: this.currentTeam.name,
          roundId: 2,
          questionId: currentBug.id,
          code: code,
        });

        if (res.passed) {
          this.solvedQuestions[2][currentBug.id] = true;
          this.currentTeam.points_r2 = (this.currentTeam.points_r2 || 0) + res.pointsAwarded;
          window.Notifier.success(res.message);
          this.renderRound2View(container);
        } else {
          window.Notifier.error(res.message);
          submitBtn.disabled = false;
          submitBtn.innerText = `Submit Fix (+${currentBug.points} Pts)`;
        }
      });
    }
  }

  // -------------------------------------------------------------
  // ROUND 3: SPEED CODING (5 Challenges • 30 Pts)
  // -------------------------------------------------------------
  renderRound3View(container) {
    const challenges = window.ROUND3_CHALLENGES;
    const activeCId = this.currentSubTab[3] || challenges[0].id;
    const currentChallenge = challenges.find(c => c.id === activeCId) || challenges[0];
    const isSolved = Boolean(this.solvedQuestions[3][currentChallenge.id]);

    container.innerHTML = `
      <div class="card" style="margin-bottom: 24px;">
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 18px; flex-wrap: wrap; gap: 10px;">
          <div>
            <div style="display: flex; align-items: center; gap: 8px;">
              <span class="badge badge-indigo">Round 3 of 4</span>
              <span class="badge badge-warning">Speed Coding ⚡</span>
            </div>
            <h2 style="font-size: 1.5rem; margin-top: 6px;">Algorithmic Challenges</h2>
          </div>
          <div style="text-align: right;">
            <div style="font-size: 0.78rem; color: var(--text-muted);">Round Points</div>
            <div style="font-size: 1.3rem; font-weight: 700; color: var(--accent-primary);">
              ${this.currentTeam.points_r3 || 0} / 30 Pts
            </div>
          </div>
        </div>

        <!-- Challenge Tabs -->
        <div class="sub-tabs">
          ${challenges.map((c, idx) => `
            <button class="sub-tab-btn ${c.id === activeCId ? 'active' : ''} ${this.solvedQuestions[3][c.id] ? 'solved' : ''}" data-cid="${c.id}">
              Challenge ${idx + 1} (${c.points}p) ${this.solvedQuestions[3][c.id] ? '✓' : ''}
            </button>
          `).join('')}
        </div>

        <div class="coding-workspace">
          <!-- Prompt Column -->
          <div class="coding-prompt-col">
            <h3 style="font-size: 1.15rem;">${currentChallenge.title}</h3>
            <span class="badge badge-default">Difficulty: ${currentChallenge.difficulty}</span>
            <p style="font-size: 0.9rem; color: var(--text-secondary);">${currentChallenge.description}</p>
            
            <div style="background: var(--bg-secondary); padding: 12px 16px; border-radius: var(--radius-md); border: 1px solid var(--border-light); font-size: 0.85rem;">
              <strong>Instructions:</strong>
              <div style="font-family: var(--font-mono); font-size: 0.82rem; margin-top: 4px; white-space: pre-wrap;">${currentChallenge.instructions}</div>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; font-size: 0.85rem;">
              <div style="background: var(--bg-secondary); padding: 10px; border-radius: var(--radius-md); border: 1px solid var(--border-light);">
                <strong>Sample Stdin:</strong>
                <pre style="margin-top: 4px; font-family: var(--font-mono); font-size: 0.8rem;">${currentChallenge.sampleInput}</pre>
              </div>
              <div style="background: var(--bg-secondary); padding: 10px; border-radius: var(--radius-md); border: 1px solid var(--border-light);">
                <strong>Sample Stdout:</strong>
                <pre style="margin-top: 4px; font-family: var(--font-mono); font-size: 0.8rem;">${currentChallenge.sampleOutput}</pre>
              </div>
            </div>

            <!-- Test Results List -->
            <div id="r3-test-results-container"></div>
          </div>

          <!-- Code Editor Column -->
          <div class="coding-editor-col">
            <div class="editor-wrapper">
              <div class="editor-toolbar">
                <span>Python Editor</span>
                <div class="editor-actions">
                  <button class="btn btn-secondary btn-sm" id="r3-reset-btn">Reset Starter Code</button>
                </div>
              </div>
              <textarea id="r3-editor-textarea"></textarea>
            </div>

            <!-- Stdin Input -->
            <div class="stdin-container">
              <label class="form-label" style="font-size: 0.78rem;">Custom Stdin (Input to program):</label>
              <textarea class="stdin-textarea" id="r3-stdin-input" placeholder="Type test input here...">${currentChallenge.sampleInput}</textarea>
            </div>

            <!-- Actions -->
            <div style="display: flex; align-items: center; gap: 10px;">
              <button class="btn btn-secondary btn-sm" id="r3-run-btn">Run Code ▶</button>
              <button class="btn btn-secondary btn-sm" id="r3-clear-btn">Clear Output</button>
              <button class="btn btn-primary btn-sm" id="r3-submit-btn" ${isSolved ? 'disabled' : ''}>
                ${isSolved ? 'Challenge Passed ✓' : `Submit & Test (+${currentChallenge.points} Pts)`}
              </button>
            </div>

            <!-- Output Console -->
            <div class="io-console">
              <div class="io-header">
                <span>TERMINAL OUTPUT</span>
                <span id="r3-console-status" class="io-status-tag">Ready</span>
              </div>
              <div class="io-body" id="r3-console-out">Click "Run Code" to test with custom stdin...</div>
            </div>
          </div>
        </div>
      </div>
    `;

    // Initialize CodeMirror
    const textarea = document.getElementById("r3-editor-textarea");
    textarea.value = currentChallenge.starterCode;

    const cm = window.CodeMirror.fromTextArea(textarea, {
      mode: "python",
      lineNumbers: true,
      indentUnit: 4,
      matchBrackets: true,
      theme: "default",
    });
    this.cmEditors["r3"] = cm;

    // Tabs
    container.querySelectorAll(".sub-tab-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        this.currentSubTab[3] = btn.dataset.cid;
        this.renderRound3View(container);
      });
    });

    // Reset code
    document.getElementById("r3-reset-btn").addEventListener("click", () => {
      cm.setValue(currentChallenge.starterCode);
    });

    // Clear console
    document.getElementById("r3-clear-btn").addEventListener("click", () => {
      document.getElementById("r3-console-out").textContent = "";
      document.getElementById("r3-console-status").className = "io-status-tag";
      document.getElementById("r3-console-status").textContent = "Cleared";
    });

    // Run Code
    document.getElementById("r3-run-btn").addEventListener("click", async () => {
      const code = cm.getValue();
      const stdin = document.getElementById("r3-stdin-input").value;
      const statusTag = document.getElementById("r3-console-status");
      const outBox = document.getElementById("r3-console-out");

      statusTag.className = "io-status-tag";
      statusTag.textContent = "Executing...";
      outBox.textContent = "Running in sandbox...";

      const runRes = await window.CodeRunner.runCode(code, stdin);
      if (runRes.success) {
        statusTag.className = "io-status-tag accepted";
        statusTag.textContent = `Success (${runRes.executionTimeMs}ms)`;
        outBox.textContent = runRes.stdout || "(No output produced)";
      } else {
        statusTag.className = "io-status-tag error";
        statusTag.textContent = "Error";
        outBox.textContent = runRes.stderr || runRes.error || "Execution error";
      }
    });

    // Submit Solution
    const submitBtn = document.getElementById("r3-submit-btn");
    if (submitBtn && !isSolved) {
      submitBtn.addEventListener("click", async () => {
        const code = cm.getValue();
        submitBtn.disabled = true;
        submitBtn.innerText = "Running Test Cases...";

        const res = await window.CodeRunner.submitSolution({
          teamId: this.currentTeam.id,
          teamName: this.currentTeam.name,
          roundId: 3,
          questionId: currentChallenge.id,
          code: code,
        });

        // Render test case summary
        const testContainer = document.getElementById("r3-test-results-container");
        if (testContainer && res.testResults) {
          testContainer.innerHTML = `
            <div class="test-results-list">
              <div style="font-size: 0.85rem; font-weight: 700; margin-bottom: 4px;">Test Case Verification:</div>
              ${res.testResults.map(tc => `
                <div class="test-result-row ${tc.passed ? 'passed' : 'failed'}">
                  <div>Case ${tc.caseNumber}: Input <code>${this.escapeHtml(tc.input)}</code></div>
                  <span class="badge ${tc.passed ? 'badge-success' : 'badge-danger'}">
                    ${tc.passed ? 'Passed ✓' : 'Failed ✗'}
                  </span>
                </div>
              `).join('')}
            </div>
          `;
        }

        if (res.passed) {
          this.solvedQuestions[3][currentChallenge.id] = true;
          this.currentTeam.points_r3 = (this.currentTeam.points_r3 || 0) + res.pointsAwarded;
          window.Notifier.success(res.message);
          this.renderRound3View(container);
        } else {
          window.Notifier.error(res.message);
          submitBtn.disabled = false;
          submitBtn.innerText = `Submit & Test (+${currentChallenge.points} Pts)`;
        }
      });
    }
  }

  // -------------------------------------------------------------
  // ROUND 4: FINAL BOSS (Student Grade Calculator - 20 Pts)
  // -------------------------------------------------------------
  renderRound4View(container) {
    const boss = window.ROUND4_BOSS;
    const isSolved = Boolean(this.solvedQuestions[4]);

    container.innerHTML = `
      <div class="card" style="margin-bottom: 24px; border-color: #fde68a;">
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 18px; flex-wrap: wrap; gap: 10px;">
          <div>
            <div style="display: flex; align-items: center; gap: 8px;">
              <span class="badge badge-indigo">Round 4 of 4</span>
              <span class="badge badge-warning" style="background: #fef3c7; color: #b45309;">FINAL BOSS 👑</span>
              <span class="badge badge-success">+5 Speed Bonus Eligible</span>
            </div>
            <h2 style="font-size: 1.6rem; margin-top: 6px;">Student Grade Calculator</h2>
          </div>
          <div style="text-align: right;">
            <div style="font-size: 0.78rem; color: var(--text-muted);">Boss Points</div>
            <div style="font-size: 1.4rem; font-weight: 700; color: #b45309;">
              ${this.currentTeam.points_r4 || 0} / 20 Pts
            </div>
          </div>
        </div>

        <div class="coding-workspace">
          <!-- Requirements Column -->
          <div class="coding-prompt-col">
            <h3 style="font-size: 1.15rem;">Challenge Specifications</h3>
            <p style="font-size: 0.9rem; color: var(--text-secondary);">${boss.description}</p>
            
            <div style="background: var(--bg-secondary); padding: 14px 16px; border-radius: var(--radius-md); border: 1px solid var(--border-light); font-size: 0.85rem;">
              <strong style="display: block; margin-bottom: 6px;">Mandatory Rules:</strong>
              <ul style="padding-left: 20px; line-height: 1.6;">
                ${boss.specifications.map(s => `<li>${s}</li>`).join('')}
              </ul>
            </div>

            <div style="background: #fffbeb; border: 1px solid #fde68a; padding: 12px 14px; border-radius: var(--radius-md); font-size: 0.82rem; color: #92400e;">
              ⚡ <strong>Nested If Requirement:</strong> Your code will be automatically inspected by the server to verify that nested if statements are used for subject checking.
            </div>

            <!-- Test Results Container -->
            <div id="r4-test-results-container"></div>
          </div>

          <!-- Code Editor Column -->
          <div class="coding-editor-col">
            <div class="editor-wrapper">
              <div class="editor-toolbar">
                <span>Python Editor</span>
                <div class="editor-actions">
                  <button class="btn btn-secondary btn-sm" id="r4-reset-btn">Reset Starter Code</button>
                </div>
              </div>
              <textarea id="r4-editor-textarea"></textarea>
            </div>

            <!-- Stdin Input -->
            <div class="stdin-container">
              <label class="form-label" style="font-size: 0.78rem;">Custom Stdin (3 marks on 3 separate lines):</label>
              <textarea class="stdin-textarea" id="r4-stdin-input">${boss.sampleInput}</textarea>
            </div>

            <!-- Actions -->
            <div style="display: flex; align-items: center; gap: 10px;">
              <button class="btn btn-secondary btn-sm" id="r4-run-btn">Run Code ▶</button>
              <button class="btn btn-secondary btn-sm" id="r4-clear-btn">Clear Output</button>
              <button class="btn btn-primary btn-sm" id="r4-submit-btn" ${isSolved ? 'disabled' : ''}>
                ${isSolved ? 'Boss Defeated 👑' : `Submit Final Boss (+20 Pts)`}
              </button>
            </div>

            <!-- Output Console -->
            <div class="io-console">
              <div class="io-header">
                <span>TERMINAL OUTPUT</span>
                <span id="r4-console-status" class="io-status-tag">Ready</span>
              </div>
              <div class="io-body" id="r4-console-out">Click "Run Code" to test with custom marks...</div>
            </div>
          </div>
        </div>
      </div>
    `;

    // Mount CodeMirror
    const textarea = document.getElementById("r4-editor-textarea");
    textarea.value = boss.starterCode;

    const cm = window.CodeMirror.fromTextArea(textarea, {
      mode: "python",
      lineNumbers: true,
      indentUnit: 4,
      matchBrackets: true,
      theme: "default",
    });
    this.cmEditors["r4"] = cm;

    // Reset starter code
    document.getElementById("r4-reset-btn").addEventListener("click", () => {
      cm.setValue(boss.starterCode);
    });

    // Clear console
    document.getElementById("r4-clear-btn").addEventListener("click", () => {
      document.getElementById("r4-console-out").textContent = "";
      document.getElementById("r4-console-status").textContent = "Cleared";
    });

    // Run Code
    document.getElementById("r4-run-btn").addEventListener("click", async () => {
      const code = cm.getValue();
      const stdin = document.getElementById("r4-stdin-input").value;
      const statusTag = document.getElementById("r4-console-status");
      const outBox = document.getElementById("r4-console-out");

      statusTag.className = "io-status-tag";
      statusTag.textContent = "Executing...";
      outBox.textContent = "Running in sandbox...";

      const runRes = await window.CodeRunner.runCode(code, stdin);
      if (runRes.success) {
        statusTag.className = "io-status-tag accepted";
        statusTag.textContent = `Success (${runRes.executionTimeMs}ms)`;
        outBox.textContent = runRes.stdout || "(No output produced)";
      } else {
        statusTag.className = "io-status-tag error";
        statusTag.textContent = "Error";
        outBox.textContent = runRes.stderr || runRes.error || "Execution error";
      }
    });

    // Submit Boss
    const submitBtn = document.getElementById("r4-submit-btn");
    if (submitBtn && !isSolved) {
      submitBtn.addEventListener("click", async () => {
        const code = cm.getValue();
        submitBtn.disabled = true;
        submitBtn.innerText = "Evaluating Final Boss...";

        const res = await window.CodeRunner.submitSolution({
          teamId: this.currentTeam.id,
          teamName: this.currentTeam.name,
          roundId: 4,
          questionId: "boss",
          code: code,
        });

        const testContainer = document.getElementById("r4-test-results-container");
        if (testContainer && res.testResults) {
          testContainer.innerHTML = `
            <div class="test-results-list">
              <div style="font-size: 0.85rem; font-weight: 700; margin-bottom: 4px;">Boss Test Suite:</div>
              ${res.testResults.map(tc => `
                <div class="test-result-row ${tc.passed ? 'passed' : 'failed'}">
                  <div>
                    <strong>${tc.name}:</strong> 
                    <span style="font-size: 0.78rem; color: var(--text-muted); display: block;">${tc.explanation || tc.error || ''}</span>
                  </div>
                  <span class="badge ${tc.passed ? 'badge-success' : 'badge-danger'}">
                    ${tc.passed ? 'Passed ✓' : 'Failed ✗'}
                  </span>
                </div>
              `).join('')}
            </div>
          `;
        }

        if (res.passed) {
          this.solvedQuestions[4] = true;
          this.currentTeam.points_r4 = 20;
          window.Notifier.success(res.message);
          this.renderRound4View(container);
        } else {
          window.Notifier.error(res.message);
          submitBtn.disabled = false;
          submitBtn.innerText = `Submit Final Boss (+20 Pts)`;
        }
      });
    }
  }

  // Phase 5: Review & Completion View (55-60 min)
  async renderReviewView(container) {
    // Refresh latest team score from database
    const freshTeam = await window.stateManager.getTeamById(this.currentTeam.id);
    if (freshTeam) this.currentTeam = freshTeam;

    container.innerHTML = `
      <div class="card" style="text-align: center; padding: 48px 24px; max-width: 680px; margin: 0 auto;">
        <div style="font-size: 3rem; margin-bottom: 12px;">🏆</div>
        <h2 style="font-size: 1.8rem; margin-bottom: 8px;">Competition Completed!</h2>
        <p style="color: var(--text-secondary); margin-bottom: 30px;">
          Outstanding effort by <strong>${this.currentTeam.name}</strong> (${this.currentTeam.department}).
          Here is your official performance summary across all rounds.
        </p>

        <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 30px;">
          <div style="background: var(--bg-secondary); padding: 14px; border-radius: var(--radius-md); border: 1px solid var(--border-light);">
            <div style="font-size: 0.75rem; color: var(--text-muted);">Round 1</div>
            <div style="font-size: 1.25rem; font-weight: 700;">${this.currentTeam.points_r1 || 0} / 20</div>
          </div>
          <div style="background: var(--bg-secondary); padding: 14px; border-radius: var(--radius-md); border: 1px solid var(--border-light);">
            <div style="font-size: 0.75rem; color: var(--text-muted);">Round 2</div>
            <div style="font-size: 1.25rem; font-weight: 700;">${this.currentTeam.points_r2 || 0} / 20</div>
          </div>
          <div style="background: var(--bg-secondary); padding: 14px; border-radius: var(--radius-md); border: 1px solid var(--border-light);">
            <div style="font-size: 0.75rem; color: var(--text-muted);">Round 3</div>
            <div style="font-size: 1.25rem; font-weight: 700;">${this.currentTeam.points_r3 || 0} / 30</div>
          </div>
          <div style="background: var(--bg-secondary); padding: 14px; border-radius: var(--radius-md); border: 1px solid var(--border-light);">
            <div style="font-size: 0.75rem; color: var(--text-muted);">Round 4</div>
            <div style="font-size: 1.25rem; font-weight: 700;">${this.currentTeam.points_r4 || 0} / 20</div>
          </div>
        </div>

        <div style="background: var(--accent-subtle); border: 1px solid var(--accent-border); border-radius: var(--radius-lg); padding: 20px; margin-bottom: 32px;">
          <div style="font-size: 0.85rem; color: var(--accent-primary); font-weight: 600;">FINAL OFFICIAL SCORE</div>
          <div style="font-size: 2.5rem; font-weight: 800; color: var(--accent-primary); font-family: var(--font-mono);">
            ${this.currentTeam.total_points || 0} / 100
          </div>
          ${this.currentTeam.points_bonus ? `<div style="font-size: 0.82rem; color: #047857; margin-top: 4px;">Includes +${this.currentTeam.points_bonus} Bonus Points</div>` : ''}
        </div>

        <div style="display: flex; align-items: center; justify-content: center; gap: 14px;">
          <a href="leaderboard.html" class="btn btn-primary">
            View Live Leaderboard 🏆
          </a>
          <a href="winners.html" class="btn btn-secondary">
            Winner Podium
          </a>
        </div>
      </div>
    `;
  }

  // -------------------------------------------------------------
  // GLOBAL LISTENERS & NAVIGATION
  // -------------------------------------------------------------
  bindGlobalEvents() {
    // Step item navigation clicks (participants can review unlocked rounds)
    document.querySelectorAll(".step-item").forEach(step => {
      step.addEventListener("click", () => {
        const roundNum = Number(step.dataset.round);
        // Only allow clicking rounds up to active round or if competition is finished
        if (this.timer && roundNum <= this.activeRoundNumber) {
          this.renderActiveRoundView(roundNum);
          document.querySelectorAll(".step-item").forEach(s => s.classList.remove("active"));
          step.classList.add("active");
        } else {
          window.Notifier.info(`This round will unlock when reached according to your team schedule.`);
        }
      });
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

// Instantiate on DOM ready
document.addEventListener("DOMContentLoaded", () => {
  if (document.getElementById("round-content-container")) {
    window.compController = new CompetitionController();
    window.compController.init();
  }
});
