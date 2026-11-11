/**
 * PYTHON CODING BATTLE - NOTIFICATIONS & ALERT SYSTEM
 * Spell.sh minimalist notification toasts, modals, and round warning banners.
 */

window.Notifier = {
  container: null,

  init() {
    if (!this.container) {
      this.container = document.createElement("div");
      this.container.id = "toast-container";
      this.container.className = "toast-container";
      document.body.appendChild(this.container);
    }
  },

  show({ title, message, type = "info", duration = 4000 }) {
    this.init();

    const toast = document.createElement("div");
    toast.className = `toast toast-${type}`;

    let iconSvg = '';
    if (type === 'success') {
      iconSvg = `<svg class="toast-icon text-emerald-500" viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`;
    } else if (type === 'error') {
      iconSvg = `<svg class="toast-icon text-rose-500" viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`;
    } else if (type === 'warning') {
      iconSvg = `<svg class="toast-icon text-amber-500" viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`;
    } else {
      iconSvg = `<svg class="toast-icon text-indigo-500" viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`;
    }

    toast.innerHTML = `
      <div class="toast-content">
        ${iconSvg}
        <div class="toast-text">
          ${title ? `<div class="toast-title">${title}</div>` : ""}
          <div class="toast-message">${message}</div>
        </div>
      </div>
      <button class="toast-close" aria-label="Close">&times;</button>
    `;

    toast.querySelector(".toast-close").addEventListener("click", () => {
      this.dismiss(toast);
    });

    this.container.appendChild(toast);

    if (duration > 0) {
      setTimeout(() => this.dismiss(toast), duration);
    }
  },

  dismiss(toast) {
    toast.classList.add("toast-hiding");
    setTimeout(() => {
      if (toast.parentElement) toast.parentElement.removeChild(toast);
    }, 300);
  },

  success(message, title = "Success") {
    this.show({ title, message, type: "success" });
  },

  error(message, title = "Error") {
    this.show({ title, message, type: "error", duration: 6000 });
  },

  warning(message, title = "Warning") {
    this.show({ title, message, type: "warning", duration: 7000 });
  },

  info(message, title = "Notice") {
    this.show({ title, message, type: "info" });
  },

  /**
   * Prominent Banner for 1-minute round end warning
   */
  showRoundWarning(roundNumber, roundTitle) {
    const banner = document.createElement("div");
    banner.className = "round-warning-banner";
    banner.innerHTML = `
      <div class="round-warning-body">
        <span class="warning-pulse-dot"></span>
        <strong>1 MINUTE REMAINING:</strong> ${roundTitle} is ending in 60 seconds! Submit your final solution now.
      </div>
      <button class="warning-close">&times;</button>
    `;
    banner.querySelector(".warning-close").addEventListener("click", () => {
      if (banner.parentElement) banner.parentElement.removeChild(banner);
    });

    document.body.prepend(banner);
    setTimeout(() => {
      if (banner.parentElement) banner.parentElement.removeChild(banner);
    }, 15000);
  },

  /**
   * Simple modal confirmation helper
   */
  confirm(message, onConfirm) {
    const modal = document.createElement("div");
    modal.className = "confirm-modal-overlay";
    modal.innerHTML = `
      <div class="confirm-modal-card">
        <h3 class="confirm-modal-title">Please Confirm</h3>
        <p class="confirm-modal-text">${message}</p>
        <div class="confirm-modal-actions">
          <button class="btn btn-secondary cancel-btn">Cancel</button>
          <button class="btn btn-danger confirm-btn">Confirm</button>
        </div>
      </div>
    `;

    const close = () => {
      if (modal.parentElement) modal.parentElement.removeChild(modal);
    };

    modal.querySelector(".cancel-btn").addEventListener("click", close);
    modal.querySelector(".confirm-btn").addEventListener("click", () => {
      close();
      onConfirm();
    });

    document.body.appendChild(modal);
  }
};
