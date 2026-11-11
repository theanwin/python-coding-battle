# ⚡ PYTHON CODING BATTLE
### *The Ultimate Inter-Team Coding Competition*
**Tagline:** *Think Fast. Code Faster.*

---

## 🌟 Overview

**Python Coding Battle** is a complete, fully functional, production-ready website designed for an intensive, one-hour inter-team Python programming competition for first-year college students.

Built strictly using **HTML5, CSS3, and Vanilla JavaScript**, the platform adheres to a clean, minimalist, premium developer SaaS aesthetic inspired directly by **[Spell.sh](https://spell.sh/)**, **Linear**, and **Vercel**:
- **Clean SaaS Aesthetics**: Soft off-white backgrounds, deep charcoal typography, subtle indigo/violet accents, generous whitespace, and soft elevated shadows. No gaming, esports, or neon arcade clutter.
- **Strictly No Frontend Frameworks**: Pure HTML, modular CSS, and Vanilla JavaScript. No React, Vue, Angular, or Tailwind CSS.
- **Embedded Python Code Editors**: CodeMirror editors embedded strictly inside programming rounds (Rounds 2, 3, and 4). No standalone compiler page or compiler navigation options.
- **Team-Based 60-Minute Competition Timer**: Starts separately for each team when the team leader clicks **Start Competition**. Resilient across browser refreshes and device restarts using server timestamp synchronization.
- **Automated Server-Side Python Evaluation**: High-speed, isolated Python sandbox with 3.5-second execution limits, stdin handling, and automated test-case scoring without exposing test cases to the frontend.
- **Real-Time Live Leaderboard**: Real-time score updates, automated rank sorting with tie-breaker logic, and an **Auditorium Projector View** for large screen presentation.
- **Secure Administrator Command Center**: Password-protected master console with masked inputs, timer monitoring, live submissions inspection, manual score adjustments, and a database audit trail.
- **Grand Podium & Winner Celebration**: Gold, Silver, and Bronze podium reveal powered by real database scores with celebratory confetti.

---

## 🎯 Competition Schedule & Scoring (60 Minutes • 100 Total Points)

| Time Window | Round / Phase | Description | Max Points |
| :--- | :--- | :--- | :---: |
| **00 – 05 min** | **Phase 0: Introduction** | Team lobby, rules briefing, and environment orientation | — |
| **05 – 15 min** | **Round 1: Predict the Output** | Precedence, floor division, string multiplication, boolean logic, nested if *(No Compiler)* | **20 Pts** |
| **15 – 25 min** | **Round 2: Find the Bug 🐛** | Syntax errors, missing colons, indentation errors, wrong comparison operators | **20 Pts** |
| **25 – 45 min** | **Round 3: Speed Coding ⚡** | 5 Algorithmic challenges (Name, Even/Odd, Calculator, Table, Guessing Game) | **30 Pts** |
| **45 – 55 min** | **Round 4: Final Boss 👑** | Student Grade Calculator enforcing strict nested if logic + Server Speed Bonus | **20 Pts** |
| **55 – 60 min** | **Review & Podium Reveal** | Review scores, administrator audit confirmation, and grand winner ceremony | **10 Pts Bonus** |
| **TOTAL** | | **Standard Inter-Team Competition Evaluation** | **100 Pts** |

---

## 🛠️ Technology Stack

- **Frontend**: HTML5, CSS3 (Custom SaaS Design System), Vanilla JavaScript (Modular ES6).
- **Code Editor**: CodeMirror 5 with Python syntax highlighting, line numbers, automatic indentation, and match brackets.
- **Database & Realtime**: Supabase (PostgreSQL with Row Level Security, Triggers, and Realtime Publications) + Local Resilient State Fallback.
- **Python Execution Sandbox**:
  - **Local Development**: Native Python subprocess runner (`server/runner.py`) with 3.5-second timeout and stdin simulation.
  - **Public Deployment (Vercel)**: Serverless functions calling isolated Piston API execution containers.
- **Deployment**: Vercel ready with standard HTML/CSS/JS and `/api` Serverless Functions.

---

## 🚀 Local Development Setup

### 1. Prerequisites
- **Node.js** (v18 or higher)
- **Python** (v3.10+ installed and added to PATH)

### 2. Installation
```bash
# Clone the repository
git clone https://github.com/your-username/python-coding-battle.git
cd python-coding-battle

# Install dependencies (Express & CORS for local server)
npm install
```

### 3. Start Local Server
```bash
npm start
```
Open **[http://localhost:3001](http://localhost:3001)** in your web browser.

---

## 🗄️ Supabase Production Database Setup

The website starts with a **strictly empty database** (no sample teams or fake scores). All registered teams and submissions are stored in Supabase.

### 1. Create a Free Supabase Project
1. Go to [supabase.com](https://supabase.com) and create a new project.
2. Open your project dashboard, navigate to the **SQL Editor**, and paste the contents of `schema.sql`.
3. Click **Run** to execute the script. This creates:
   - `teams` table (with constraints, generated `total_points`, and unique access codes)
   - `submissions` table (tracks all submitted code and test results)
   - `score_audit_logs` table (records every manual score adjustment by administrators)
   - `competition_settings` table (tracks bonus awards and competition flags)
   - Row Level Security (RLS) policies and Realtime publications.

### 2. Configure Client Credentials
Open `js/config.js` and update your project credentials:
```javascript
window.APP_CONFIG = {
  SUPABASE_URL: "https://your-project-id.supabase.co",
  SUPABASE_ANON_KEY: "your-actual-anon-public-key",
  // ...
};
```

---

## 🌐 Deploying to Vercel (Public Hosting)

The website is fully configured for deployment on Vercel as a standard static website with serverless API functions in `/api`.

### Option A: Deploy via GitHub & Vercel Dashboard
1. Push this codebase to a GitHub repository:
   ```bash
   git init
   git add .
   git commit -m "Deploy Python Coding Battle"
   git branch -M main
   git remote add origin https://github.com/<your-username>/python-coding-battle.git
   git push -u origin main
   ```
2. Log into [vercel.com](https://vercel.com) and click **Add New > Project**.
3. Import your GitHub repository.
4. Set the **Framework Preset** to **Other** (Standard HTML/CSS/JS).
5. (Optional) In **Environment Variables**, add:
   - `SUPABASE_URL`: `https://your-project.supabase.co`
   - `SUPABASE_ANON_KEY`: `your-anon-key`
6. Click **Deploy**. Vercel will provide your public URL (e.g., `https://python-coding-battle.vercel.app`).

### Option B: Deploy via Vercel CLI
```bash
npm install -g vercel
vercel
vercel --prod
```

---

## 🔒 Security & Admin Access

- **Admin Password**: The administrator dashboard at `/admin.html` is password protected.
  - The password input is **empty by default** and **masked** when typed.
  - Authentication uses client-side SHA-256 verification (no plaintext password in source code).
  - Default Admin Password: `AdminPass@2026`
- **Audit Logging**: Any points added, deducted, or reset by the administrator are automatically logged to the `score_audit_logs` table with mandatory reason text.
- **Server-Side Test Case Verification**: Test cases and expected outputs are verified on the server to prevent participants from reverse-engineering hidden test suites.

---

## 📱 Mobile & WhatsApp Sharing

- The platform is fully responsive and supports smartphones, tablets, laptops, and projector screens.
- Participants can open the website link directly through WhatsApp or chat without installing any software or installing Python on their devices.

---

## 🏆 License
Educational competition license. Designed for inter-team collegiate hackathons and coding tournaments.
