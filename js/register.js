/**
 * PYTHON CODING BATTLE - TEAM REGISTRATION LOGIC
 * Validates fields, generates unique access code, inserts into database,
 * and presents clean confirmation screen.
 */

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("team-register-form");
  const successCard = document.getElementById("registration-success-card");
  const formCard = document.getElementById("registration-form-card");

  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const submitBtn = document.getElementById("register-submit-btn");
    submitBtn.disabled = true;
    submitBtn.innerHTML = `
      <svg class="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10" stroke-opacity="0.25"></circle>
        <path d="M12 2a10 10 0 0 1 10 10"></path>
      </svg> Registering Team...
    `;

    const teamData = {
      name: document.getElementById("team-name").value.trim(),
      leader: document.getElementById("team-leader").value.trim(),
      member2: document.getElementById("member-2").value.trim(),
      member3: document.getElementById("member-3").value.trim(),
      member4: document.getElementById("member-4").value.trim(),
      member5: (document.getElementById("member-5").value || "").trim(),
      department: document.getElementById("department").value.trim(),
    };

    // Client-side validations
    if (!teamData.name || !teamData.leader || !teamData.member2 || !teamData.member3 || !teamData.member4 || !teamData.department) {
      window.Notifier.error("Please fill in all required fields (minimum 4 team members).");
      submitBtn.disabled = false;
      submitBtn.innerText = "Register Team";
      return;
    }

    try {
      const createdTeam = await window.stateManager.registerTeam(teamData);

      // Save as active team in local session
      localStorage.setItem(window.APP_CONFIG.STORAGE_KEYS.CURRENT_TEAM, JSON.stringify(createdTeam));

      // Show success confirmation
      formCard.style.display = "none";
      successCard.style.display = "block";

      document.getElementById("registered-team-name").textContent = createdTeam.name;
      document.getElementById("registered-access-code").textContent = createdTeam.access_code;
      document.getElementById("registered-leader").textContent = createdTeam.leader;
      document.getElementById("registered-dept").textContent = createdTeam.department;

      window.Notifier.success(`Team "${createdTeam.name}" registered successfully!`);
    } catch (err) {
      console.error(err);
      window.Notifier.error(err.message || "Failed to register team. Please try again.");
      submitBtn.disabled = false;
      submitBtn.innerText = "Register Team";
    }
  });

  // Copy Access Code button
  const copyBtn = document.getElementById("copy-code-btn");
  if (copyBtn) {
    copyBtn.addEventListener("click", () => {
      const code = document.getElementById("registered-access-code").textContent;
      navigator.clipboard.writeText(code).then(() => {
        window.Notifier.success("Access code copied to clipboard!");
      });
    });
  }
});
