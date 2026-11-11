/**
 * PYTHON CODING BATTLE - TEAM-BASED COMPETITION TIMER
 * 
 * Enforces per-team 60-minute competition schedule.
 * Calculates countdown strictly from server/team started_at timestamp.
 * Resilient against page refreshes and browser restarts.
 */

class TeamTimer {
  /**
   * @param {object} team 
   * @param {object} callbacks { onTick, onRoundChange, onWarning, onFinish }
   */
  constructor(team, callbacks = {}) {
    this.team = team;
    this.callbacks = callbacks;
    this.intervalId = null;
    this.currentPhase = null;
    this.warningGivenForRound = {};
    this.isFinished = false;

    // Schedule phases in seconds from start
    this.phases = [
      { id: 0, name: "Introduction & Instructions", startSec: 0, endSec: 300, isRound: false, roundNumber: 0 },
      { id: 1, name: "Round 1: Predict the Output", startSec: 300, endSec: 900, isRound: true, roundNumber: 1 },
      { id: 2, name: "Round 2: Find the Bug 🐛", startSec: 900, endSec: 1500, isRound: true, roundNumber: 2 },
      { id: 3, name: "Round 3: Speed Coding ⚡", startSec: 1500, endSec: 2700, isRound: true, roundNumber: 3 },
      { id: 4, name: "Round 4: Final Boss 👑", startSec: 2700, endSec: 3300, isRound: true, roundNumber: 4 },
      { id: 5, name: "Review & Completion", startSec: 3300, endSec: 3600, isRound: false, roundNumber: 5 },
    ];
  }

  start() {
    if (this.intervalId) clearInterval(this.intervalId);
    this.tick();
    this.intervalId = setInterval(() => this.tick(), 1000);
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  tick() {
    if (!this.team.started_at) {
      return;
    }

    const now = Date.now();
    const startTime = new Date(this.team.started_at).getTime();
    const elapsedSec = Math.max(0, Math.floor((now - startTime) / 1000));
    const totalSec = window.APP_CONFIG.TOTAL_DURATION_MINUTES * 60; // 3600s
    const remainingTotalSec = Math.max(0, totalSec - elapsedSec);

    // Identify current phase
    let activePhase = this.phases[this.phases.length - 1];
    for (const phase of this.phases) {
      if (elapsedSec >= phase.startSec && elapsedSec < phase.endSec) {
        activePhase = phase;
        break;
      }
    }

    if (elapsedSec >= totalSec) {
      this.isFinished = true;
      this.stop();
      if (this.callbacks.onTick) {
        this.callbacks.onTick({
          elapsedSec,
          remainingTotalSec: 0,
          remainingRoundSec: 0,
          currentPhase: { id: 6, name: "Competition Concluded", isRound: false, roundNumber: 6 },
          isFinished: true,
        });
      }
      if (this.callbacks.onFinish) this.callbacks.onFinish();
      return;
    }

    const phaseRemainingSec = Math.max(0, activePhase.endSec - elapsedSec);

    // Check 1-minute warning (60 seconds remaining in active round)
    if (activePhase.isRound && phaseRemainingSec === 60 && !this.warningGivenForRound[activePhase.id]) {
      this.warningGivenForRound[activePhase.id] = true;
      if (this.callbacks.onWarning) {
        this.callbacks.onWarning({
          roundId: activePhase.roundNumber,
          roundName: activePhase.name,
          remainingSeconds: 60,
        });
      }
    }

    // Check Phase Change
    if (!this.currentPhase || this.currentPhase.id !== activePhase.id) {
      const prevPhase = this.currentPhase;
      this.currentPhase = activePhase;
      if (this.callbacks.onRoundChange) {
        this.callbacks.onRoundChange(activePhase, prevPhase);
      }
    }

    // Tick callback
    if (this.callbacks.onTick) {
      this.callbacks.onTick({
        elapsedSec,
        remainingTotalSec,
        remainingRoundSec: phaseRemainingSec,
        currentPhase: activePhase,
        isFinished: false,
        formattedTotalRemaining: TeamTimer.formatSeconds(remainingTotalSec),
        formattedRoundRemaining: TeamTimer.formatSeconds(phaseRemainingSec),
      });
    }
  }

  static formatSeconds(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  }

  /**
   * Helper for Admin Dashboard to compute any team's live status
   */
  static getTeamStatus(team) {
    if (!team.started_at) {
      return {
        status: "Registered",
        currentPhaseName: "Not Started",
        currentRound: 0,
        elapsedSeconds: 0,
        remainingSeconds: 3600,
        formattedRemaining: "60:00",
        isFinished: false,
      };
    }

    const elapsed = Math.max(0, Math.floor((Date.now() - new Date(team.started_at).getTime()) / 1000));
    const total = 3600;
    const remaining = Math.max(0, total - elapsed);

    if (elapsed >= total || team.status === 'completed') {
      return {
        status: "Completed",
        currentPhaseName: "Completed",
        currentRound: 4,
        elapsedSeconds: total,
        remainingSeconds: 0,
        formattedRemaining: "00:00",
        isFinished: true,
      };
    }

    let phaseName = "Intro";
    let roundNum = 0;
    if (elapsed < 300) { phaseName = "Intro (00–05m)"; roundNum = 0; }
    else if (elapsed < 900) { phaseName = "Round 1 (05–15m)"; roundNum = 1; }
    else if (elapsed < 1500) { phaseName = "Round 2 (15–25m)"; roundNum = 2; }
    else if (elapsed < 2700) { phaseName = "Round 3 (25–45m)"; roundNum = 3; }
    else if (elapsed < 3300) { phaseName = "Round 4 (45–55m)"; roundNum = 4; }
    else { phaseName = "Review (55–60m)"; roundNum = 5; }

    return {
      status: "In Progress",
      currentPhaseName: phaseName,
      currentRound: roundNum,
      elapsedSeconds: elapsed,
      remainingSeconds: remaining,
      formattedRemaining: TeamTimer.formatSeconds(remaining),
      isFinished: false,
    };
  }
}

window.TeamTimer = TeamTimer;
