/**
 * PYTHON CODING BATTLE - NAVIGATION BAR COMPONENT
 * Renders fixed, minimalist Spell.sh-inspired header.
 * NO Compiler navigation link!
 */

document.addEventListener("DOMContentLoaded", () => {
  const navContainer = document.getElementById("site-navbar");
  if (!navContainer) return;

  const currentPath = window.location.pathname.split("/").pop() || "index.html";

  navContainer.innerHTML = `
    <nav class="navbar-wrapper">
      <div class="navbar-inner">
        <!-- Brand / Logo -->
        <a href="index.html" class="nav-brand">
          <span class="brand-icon">⚡</span>
          <span class="brand-text">PYTHON CODING BATTLE</span>
        </a>

        <!-- Desktop Navigation Links -->
        <div class="nav-links">
          <a href="index.html" class="nav-link ${currentPath === 'index.html' || currentPath === '' ? 'active' : ''}">Home</a>
          <a href="competition.html" class="nav-link ${currentPath === 'competition.html' ? 'active' : ''}">Competition</a>
          <a href="index.html#rounds" class="nav-link">Rounds</a>
          <a href="leaderboard.html" class="nav-link ${currentPath === 'leaderboard.html' ? 'active' : ''}">Leaderboard</a>
          <a href="register.html" class="nav-link ${currentPath === 'register.html' ? 'active' : ''}">Register</a>
          <a href="admin.html" class="nav-link nav-link-admin ${currentPath === 'admin.html' ? 'active' : ''}">Admin</a>
        </div>

        <!-- Action Button -->
        <div class="nav-actions">
          <a href="competition.html" class="btn btn-primary btn-sm">Enter Competition</a>
          <button class="mobile-toggle" id="mobile-toggle" aria-label="Toggle menu">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>
          </button>
        </div>
      </div>

      <!-- Mobile Dropdown -->
      <div class="mobile-menu" id="mobile-menu">
        <a href="index.html" class="mobile-link">Home</a>
        <a href="competition.html" class="mobile-link">Competition</a>
        <a href="index.html#rounds" class="mobile-link">Rounds</a>
        <a href="leaderboard.html" class="mobile-link">Leaderboard</a>
        <a href="register.html" class="mobile-link">Register Team</a>
        <a href="admin.html" class="mobile-link">Admin Dashboard</a>
        <a href="winners.html" class="mobile-link">Podium & Winners</a>
      </div>
    </nav>
  `;

  // Mobile menu toggle
  const mobileToggle = document.getElementById("mobile-toggle");
  const mobileMenu = document.getElementById("mobile-menu");
  if (mobileToggle && mobileMenu) {
    mobileToggle.addEventListener("click", () => {
      mobileMenu.classList.toggle("open");
    });
  }

  // Initialize Lucide icons if available
  if (window.lucide && typeof window.lucide.createIcons === "function") {
    window.lucide.createIcons();
  }
});
