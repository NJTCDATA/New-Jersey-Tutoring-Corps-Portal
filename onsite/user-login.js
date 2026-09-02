/* ============================================================================
   NJTC PORTAL - STAFF ID LOGIN MODULE
   New Jersey Tutoring Corps - Personalized Staff Authentication
   ============================================================================ */

(function () {
  'use strict';

  const STORAGE_KEY    = 'njtc_user_v1';
  const SESSION_HOURS  = 8;
  const USERS_JSON_PATH = '/New-Jersey-Tutoring-Corps-Portal/onsite/users.json';

  // Same HR sheet the central portal uses — fetched live in the user's browser.
  // See data-sources.js (loaded before this file) for the single source of truth.
  const SRC = (typeof NJTC_SOURCES !== 'undefined') ? NJTC_SOURCES : {};
  const HR_2PACX     = SRC.HR_2PACX;
  const HR_GID       = SRC.HR_GID;
  const HR_CACHE_KEY = 'njtc_hr_roles_v1';
  const HR_TTL_MS    = 60 * 60 * 1000; // 1 hour

  const PERSONAL_COLORS = [
    '#2563eb', '#7c3aed', '#059669', '#d97706',
    '#db2777', '#0891b2', '#dc2626', '#4f46e5'
  ];

  // ─── Utility: deterministic color from ID string ───────────────────────────
  function colorFromId(id) {
    let hash = 0;
    for (let i = 0; i < id.length; i++) {
      hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
    }
    return PERSONAL_COLORS[hash % PERSONAL_COLORS.length];
  }

  // ─── Utility: initials from full name ─────────────────────────────────────
  function getInitials(name) {
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
  }

  // ─── HR: normalize name for fuzzy matching ────────────────────────────────
  function normName(n) {
    return (n || '').toLowerCase()
      .replace(/\(.*?\)/g, '')   // remove parentheticals like (Roz)
      .replace(/[-']/g, ' ')     // dashes/apostrophes → space
      .replace(/\s+/g, ' ')
      .trim();
  }

  // ─── HR: minimal CSV parser (mirrors central portal's _parseHRMaster) ─────
  function parseHRCsv(text) {
    const rows = [];
    let row = [], cur = '', inQ = false;
    for (const ch of text.replace(/\r\n/g, '\n').replace(/\r/g, '\n') + '\n') {
      if (inQ) {
        if (ch === '"') inQ = false; else cur += ch;
      } else {
        if      (ch === '"')  { inQ = true; }
        else if (ch === ',')  { row.push(cur); cur = ''; }
        else if (ch === '\n') { row.push(cur); if (row.some(c => c)) rows.push(row); row = []; cur = ''; }
        else cur += ch;
      }
    }
    const hIdx = rows.findIndex(r => (r[0] || '').toLowerCase().includes('academic'));
    if (hIdx < 0) return [];
    const H       = rows[hIdx].map(h => h.trim().toLowerCase());
    const nameCol = H.findIndex(h => h.includes('full name'));
    const roleCol = H.findIndex(h => h.includes('position'));
    const syCol   = H.findIndex(h => h.includes('academic'));
    if (nameCol < 0 || roleCol < 0) return [];
    return rows.slice(hIdx + 1)
      .filter(r => r[nameCol])
      .map(r => ({
        name: (r[nameCol] || '').trim(),
        role: (r[roleCol] || '').trim(),
        sy:   (r[syCol]   || '').trim()
      }));
  }

  // ─── HR: fetch + cache the Master List CSV ────────────────────────────────
  async function fetchHRRows() {
    try {
      const cached = JSON.parse(localStorage.getItem(HR_CACHE_KEY) || 'null');
      if (cached && cached.ts && (Date.now() - cached.ts) < HR_TTL_MS && cached.rows) {
        return cached.rows;
      }
    } catch (e) {}
    try {
      const url = `https://docs.google.com/spreadsheets/d/e/${HR_2PACX}/pub?output=csv&gid=${HR_GID}`;
      const res = await fetch(url, { signal: AbortSignal.timeout(9000) });
      if (!res.ok) return null;
      const rows = parseHRCsv(await res.text());
      if (rows.length) {
        try { localStorage.setItem(HR_CACHE_KEY, JSON.stringify({ ts: Date.now(), rows })); } catch (e) {}
      }
      return rows.length ? rows : null;
    } catch (e) {
      return null;
    }
  }

  // ─── HR: find the most recent role for a given name ───────────────────────
  function findHRRole(rows, userName) {
    if (!rows || !rows.length) return null;
    const needle = normName(userName);
    // Prefer current SY row, fall back to any match
    const matches = rows.filter(r => normName(r.name) === needle);
    if (!matches.length) return null;
    const currentSY = matches.find(r => r.sy === '2025-2026') || matches[matches.length - 1];
    return currentSY.role || null;
  }

  // ─── HR: map raw HR role string to friendly display label ─────────────────
  function displayRole(hrRole) {
    const r = (hrRole || '').trim();
    if (!r) return 'Tutor';
    if (r.toLowerCase().includes('site coord'))     return 'Site Coordinator';
    if (r.toLowerCase().includes('instructional'))  return 'Instructional Coach';
    if (r.toLowerCase().includes('sub'))            return 'Substitute';
    if (r.toLowerCase().includes('dual'))           return 'Dual Role';
    if (r.toLowerCase().includes('certified'))      return 'Certified Tutor';
    if (r.toLowerCase().includes('non-cert'))       return 'Tutor';
    return r;
  }

  // ─── Utility: greeting by time of day ─────────────────────────────────────
  function getGreeting() {
    const hour = new Date().getHours();
    if (hour < 12) return 'morning';
    if (hour < 17) return 'afternoon';
    return 'evening';
  }

  // ─── Inject CSS ────────────────────────────────────────────────────────────
  function injectStyles() {
    const style = document.createElement('style');
    style.id = 'njtc-user-auth-styles';
    style.textContent = `
      /* ── Staff ID Screen ── */
      #staffIdScreen {
        position: fixed;
        inset: 0;
        z-index: 9999;
        display: flex;
        align-items: center;
        justify-content: center;
        background: linear-gradient(135deg, #0f172a 0%, #1e3a5f 50%, #0f172a 100%);
        animation: njtcFadeIn 0.4s ease both;
        padding: 1rem;
      }

      #staffIdScreen.njtc-fade-out {
        animation: njtcFadeOut 0.5s ease forwards;
      }

      @keyframes njtcFadeIn {
        from { opacity: 0; }
        to   { opacity: 1; }
      }

      @keyframes njtcFadeOut {
        from { opacity: 1; transform: scale(1); }
        to   { opacity: 0; transform: scale(1.03); }
      }

      /* ── Login card ── */
      .staff-id-box {
        background: rgba(255, 255, 255, 0.04);
        backdrop-filter: blur(20px);
        -webkit-backdrop-filter: blur(20px);
        border: 1px solid rgba(255, 255, 255, 0.12);
        border-radius: 1.5rem;
        padding: 2.75rem 2.5rem 2.25rem;
        width: 100%;
        max-width: 480px;
        text-align: center;
        box-shadow: 0 32px 80px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(255,255,255,0.05);
      }

      /* ── NJTC branding inside card ── */
      .staff-id-logo-wrap {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 0.5rem;
        margin-bottom: 1.75rem;
      }

      .staff-id-logo-circle {
        width: 56px;
        height: 56px;
        border-radius: 50%;
        background: linear-gradient(135deg, #2563eb, #4f46e5);
        display: flex;
        align-items: center;
        justify-content: center;
        font-family: 'Epilogue', sans-serif;
        font-weight: 900;
        font-size: 1.1rem;
        color: #fff;
        letter-spacing: 0.05em;
        box-shadow: 0 4px 20px rgba(37, 99, 235, 0.5);
        margin-bottom: 0.25rem;
      }

      .staff-id-org-name {
        font-family: 'Epilogue', sans-serif;
        font-size: 0.8rem;
        font-weight: 600;
        color: rgba(255, 255, 255, 0.55);
        letter-spacing: 0.06em;
        text-transform: uppercase;
      }

      /* ── Headings ── */
      .staff-id-heading {
        font-family: 'Epilogue', sans-serif;
        font-size: 1.6rem;
        font-weight: 800;
        color: #fff;
        margin: 0 0 0.5rem;
        line-height: 1.2;
      }

      .staff-id-subtext {
        font-size: 0.95rem;
        color: rgba(255, 255, 255, 0.55);
        margin: 0 0 1.75rem;
        line-height: 1.5;
      }

      /* ── Input ── */
      #staffIdInput {
        display: block;
        width: 100%;
        box-sizing: border-box;
        font-family: 'Courier New', Courier, monospace;
        font-size: 1.5rem;
        font-weight: 600;
        text-align: center;
        letter-spacing: 0.5rem;
        padding: 0.85rem 1rem;
        border: 2px solid rgba(255, 255, 255, 0.18);
        border-radius: 0.75rem;
        background: rgba(255, 255, 255, 0.07);
        color: #fff;
        outline: none;
        transition: border-color 0.2s, box-shadow 0.2s, background 0.2s;
        margin-bottom: 1rem;
      }

      #staffIdInput::placeholder {
        letter-spacing: 0.15rem;
        color: rgba(255, 255, 255, 0.3);
        font-size: 1rem;
      }

      #staffIdInput:focus {
        border-color: #2563eb;
        background: rgba(37, 99, 235, 0.08);
        box-shadow: 0 0 0 4px rgba(37, 99, 235, 0.25);
      }

      #staffIdInput.njtc-shake {
        animation: njtcShake 0.45s ease;
        border-color: #dc2626;
        box-shadow: 0 0 0 4px rgba(220, 38, 38, 0.25);
      }

      @keyframes njtcShake {
        0%, 100% { transform: translateX(0); }
        15%       { transform: translateX(-8px); }
        30%       { transform: translateX(8px); }
        45%       { transform: translateX(-6px); }
        60%       { transform: translateX(6px); }
        75%       { transform: translateX(-3px); }
        90%       { transform: translateX(3px); }
      }

      /* ── Submit button ── */
      #staffIdSubmit {
        display: block;
        width: 100%;
        padding: 0.9rem 1rem;
        border: none;
        border-radius: 0.75rem;
        background: linear-gradient(135deg, #2563eb, #4f46e5);
        color: #fff;
        font-family: 'Epilogue', sans-serif;
        font-size: 1.05rem;
        font-weight: 700;
        cursor: pointer;
        transition: opacity 0.2s, transform 0.15s, box-shadow 0.2s;
        box-shadow: 0 4px 20px rgba(37, 99, 235, 0.45);
        margin-bottom: 1rem;
      }

      #staffIdSubmit:hover {
        opacity: 0.9;
        transform: translateY(-1px);
        box-shadow: 0 8px 28px rgba(37, 99, 235, 0.55);
      }

      #staffIdSubmit:active {
        transform: translateY(0);
      }

      #staffIdSubmit:disabled {
        opacity: 0.6;
        cursor: not-allowed;
        transform: none;
      }

      /* ── Error message ── */
      .staff-id-error {
        display: none;
        color: #fca5a5;
        font-size: 0.9rem;
        margin-top: 0.25rem;
        padding: 0.6rem 0.75rem;
        background: rgba(220, 38, 38, 0.15);
        border-radius: 0.5rem;
        border: 1px solid rgba(220, 38, 38, 0.3);
      }

      .staff-id-error.visible {
        display: block;
      }

      /* ── User Assignment Card ── */
      #userAssignmentCard {
        border-radius: 1rem;
        padding: 1.25rem 1.5rem;
        margin-bottom: 1.5rem;
        background: linear-gradient(135deg, var(--uac-color, #2563eb) 0%, rgba(0,0,0,0.15) 100%);
        border: 1px solid rgba(255, 255, 255, 0.15);
        backdrop-filter: blur(8px);
        color: #fff;
        text-align: left;
        animation: njtcFadeIn 0.5s ease 0.1s both;
      }

      .uac-identity {
        display: flex;
        align-items: center;
        gap: 0.875rem;
        margin-bottom: 1rem;
      }

      .uac-avatar {
        width: 48px;
        height: 48px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-family: 'Epilogue', sans-serif;
        font-weight: 800;
        font-size: 1.1rem;
        color: #fff;
        flex-shrink: 0;
        border: 2px solid rgba(255,255,255,0.35);
        box-shadow: 0 2px 10px rgba(0,0,0,0.3);
      }

      .uac-name-block {
        flex: 1;
        min-width: 0;
      }

      .uac-full-name {
        font-family: 'Epilogue', sans-serif;
        font-weight: 700;
        font-size: 1.05rem;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .uac-role-tag {
        display: inline-block;
        margin-top: 0.25rem;
        font-size: 0.72rem;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        padding: 0.2rem 0.6rem;
        border-radius: 999px;
        background: rgba(255,255,255,0.18);
        border: 1px solid rgba(255,255,255,0.25);
      }

      .uac-id-label {
        font-size: 0.72rem;
        color: rgba(255,255,255,0.55);
        margin-top: 0.15rem;
        font-family: 'Courier New', Courier, monospace;
        letter-spacing: 0.05em;
      }

      .uac-assignments {
        display: flex;
        flex-direction: column;
        gap: 0.6rem;
      }

      .uac-district-block {
        background: rgba(0,0,0,0.2);
        border-radius: 0.625rem;
        padding: 0.6rem 0.75rem;
      }

      .uac-district-name {
        font-size: 0.78rem;
        font-weight: 700;
        color: rgba(255,255,255,0.75);
        text-transform: uppercase;
        letter-spacing: 0.06em;
        margin-bottom: 0.3rem;
      }

      .uac-school-list {
        display: flex;
        flex-direction: column;
        gap: 0.2rem;
      }

      .uac-school-item {
        font-size: 0.88rem;
        color: rgba(255,255,255,0.92);
        display: flex;
        align-items: flex-start;
        gap: 0.35rem;
        line-height: 1.35;
      }

      .uac-school-item::before {
        content: '🏫';
        font-size: 0.75rem;
        flex-shrink: 0;
        margin-top: 0.05rem;
      }
    `;
    document.head.appendChild(style);
  }

  // ─── Build and inject the login screen overlay ────────────────────────────
  function buildLoginScreen() {
    const overlay = document.createElement('div');
    overlay.id = 'staffIdScreen';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', 'Staff ID Login');

    overlay.innerHTML = `
      <div class="staff-id-box">
        <div class="staff-id-logo-wrap">
          <div class="staff-id-logo-circle" aria-hidden="true">NJTC</div>
          <span class="staff-id-org-name">New Jersey Tutoring Corps</span>
        </div>
        <h1 class="staff-id-heading">Hey! Enter your Staff ID</h1>
        <p class="staff-id-subtext">Your Staff ID is the code from your welcome email</p>
        <input
          type="text"
          id="staffIdInput"
          placeholder="Enter your ID"
          autocomplete="off"
          autocorrect="off"
          autocapitalize="off"
          spellcheck="false"
          maxlength="20"
          aria-label="Staff ID"
          aria-describedby="staffIdError"
        />
        <button id="staffIdSubmit" type="button">Let&rsquo;s Go &rarr;</button>
        <div class="staff-id-error" id="staffIdError" role="alert" aria-live="polite">
          That ID didn&rsquo;t match. Double-check and try again.
        </div>
        <a href="/New-Jersey-Tutoring-Corps-Portal/index.html"
           style="display:block;margin-top:1rem;color:rgba(255,184,28,0.75);font-size:0.8rem;text-align:center;text-decoration:none;"
           onmouseover="this.style.color='#FFB81C'" onmouseout="this.style.color='rgba(255,184,28,0.75)'">
          &larr; Back to Portal Home
        </a>
      </div>
    `;

    document.body.insertBefore(overlay, document.body.firstChild);
    return overlay;
  }

  // ─── Wire up login screen interactions ────────────────────────────────────
  function attachLoginListeners(overlay, onSuccess) {
    const input  = overlay.querySelector('#staffIdInput');
    const btn    = overlay.querySelector('#staffIdSubmit');
    const errDiv = overlay.querySelector('#staffIdError');

    function showError() {
      errDiv.classList.add('visible');
      input.classList.remove('njtc-shake');
      // Force reflow so animation re-triggers
      void input.offsetWidth;
      input.classList.add('njtc-shake');
      input.addEventListener('animationend', () => input.classList.remove('njtc-shake'), { once: true });
    }

    function hideError() {
      errDiv.classList.remove('visible');
    }

    async function attempt() {
      const raw = input.value.trim();
      if (!raw) { input.focus(); return; }

      btn.disabled = true;
      btn.textContent = 'Checking…';
      hideError();

      try {
        const usersResp = await fetch(USERS_JSON_PATH + '?_=' + Date.now());
        if (!usersResp.ok) throw new Error('Network error');
        const data = await usersResp.json();
        const user = (data.users || []).find(u => u.id === raw);

        if (user) {
          const now = Date.now();
          const profile = Object.assign({}, user, {
            loginTime: now,
            expires:   now + SESSION_HOURS * 60 * 60 * 1000
          });
          localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));

          // Fade out overlay
          overlay.classList.add('njtc-fade-out');
          overlay.addEventListener('animationend', () => {
            overlay.remove();
            onSuccess(profile);
          }, { once: true });
        } else {
          showError();
          btn.disabled = false;
          btn.innerHTML = 'Let&rsquo;s Go &rarr;';
          input.focus();
        }
      } catch (err) {
        console.error('[NJTCUserAuth] fetch error:', err);
        showError();
        btn.disabled = false;
        btn.innerHTML = 'Let&rsquo;s Go &rarr;';
      }
    }

    btn.addEventListener('click', attempt);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') attempt();
    });
    input.addEventListener('input', hideError);

    // Focus input after render
    requestAnimationFrame(() => input.focus());
  }

  // ─── Personalize the portal with user data ────────────────────────────────
  function personalizePortal(user) {
    window.NJTC_USER_PROFILE = user;

    // Greeting in hero
    const heroH1 = document.querySelector('.hero-brand h1');
    if (heroH1) {
      heroH1.textContent = `Good ${getGreeting()}, ${user.firstName}!`;
    }

    // Hero subtitle — primary school
    const heroSubtitle = document.querySelector('.hero-subtitle');
    if (heroSubtitle) {
      const primarySchool =
        user.assignments && user.assignments.length > 0 && user.assignments[0].schools.length > 0
          ? user.assignments[0].schools[0]
          : 'Your NJTC Portal';
      heroSubtitle.textContent = primarySchool;
    }

    // Build and inject assignment card
    const color = colorFromId(user.id);
    const initials = getInitials(user.name);
    const roleLabel = user.role || 'Tutor';

    const assignmentHTML = (user.assignments || []).map(a => `
      <div class="uac-district-block">
        <div class="uac-district-name">${escapeHtml(a.district)}</div>
        <div class="uac-school-list">
          ${(a.schools || []).map(s => `<div class="uac-school-item">${escapeHtml(s)}</div>`).join('')}
        </div>
      </div>
    `).join('');

    const card = document.createElement('div');
    card.id = 'userAssignmentCard';
    card.style.setProperty('--uac-color', color);
    card.innerHTML = `
      <div class="uac-identity">
        <div class="uac-avatar" style="background-color:${color};" aria-hidden="true">${initials}</div>
        <div class="uac-name-block">
          <div class="uac-full-name">${escapeHtml(user.name)}</div>
          <span class="uac-role-tag">${escapeHtml(roleLabel)}</span>
          <div class="uac-id-label">ID: ${escapeHtml(user.id)}</div>
        </div>
      </div>
      <div class="uac-assignments">${assignmentHTML}</div>
    `;

    const heroContent = document.querySelector('.hero-content');
    const roleSelectorCard = document.querySelector('.role-selector-card');
    if (heroContent && roleSelectorCard) {
      heroContent.insertBefore(card, roleSelectorCard);
    } else if (heroContent) {
      heroContent.appendChild(card);
    }

    // Header personalization
    const headerName = document.getElementById('headerUserName');
    if (headerName) {
      headerName.textContent = user.firstName + ' · ';
    }

    // Sync Pearl ID to ack-gate UID key so ack-gate skips its own ID modal
    try { localStorage.setItem('NJTC_UID', user.id); } catch(e) {}

    // Dispatch event
    document.dispatchEvent(new CustomEvent('userProfileReady', { detail: user }));
  }

  // ─── Simple HTML escaping ──────────────────────────────────────────────────
  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // ─── Public API ────────────────────────────────────────────────────────────
  function getProfile() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const profile = JSON.parse(raw);
      if (!profile || !profile.expires) return null;
      if (Date.now() > profile.expires) {
        localStorage.removeItem(STORAGE_KEY);
        return null;
      }
      return profile;
    } catch (e) {
      return null;
    }
  }

  function logout() {
    localStorage.removeItem(STORAGE_KEY);
  }

  function init() {
    injectStyles();

    const existing = getProfile();
    if (existing) {
      // Valid session — personalize immediately, then silently refresh role from HR
      function runPersonalize() {
        personalizePortal(existing);
      }
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', runPersonalize);
      } else {
        runPersonalize();
      }
      return;
    }

    // No valid session — show login screen
    function showLogin() {
      const overlay = buildLoginScreen();
      attachLoginListeners(overlay, (user) => {
        personalizePortal(user);
      });
    }

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', showLogin);
    } else {
      showLogin();
    }
  }

  // ─── Expose globally ───────────────────────────────────────────────────────
  window.NJTCUserAuth = { init, getProfile, logout };

  // Auto-init
  init();

})();
