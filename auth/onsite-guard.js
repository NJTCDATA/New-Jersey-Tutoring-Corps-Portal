/* ============================================================================
   NJTC ONSITE GUARD  (auth/onsite-guard.js)
   Validates session token and sets window.NJTC_SESSION for the onsite portal.
   Place this file at: /auth/onsite-guard.js
   Load order in onsite/index.html:
     <script src="../auth/auth.js"></script>
     <script src="../auth/onsite-guard.js"></script>
   ============================================================================ */

(function () {
  'use strict';

  const LOGIN_URL = '/New-Jersey-Tutoring-Corps-Portal/index.html';
  const EXPECTED_DEPT = 'onsite';

  /* ── 1. Show the loading veil immediately ─────────────────────────────── */
  function showVeil() {
    const veil = document.createElement('div');
    veil.id = 'njtc-auth-veil';
    veil.style.cssText = [
      'position:fixed', 'inset:0', 'z-index:99998',
      'background:linear-gradient(135deg,#0a1929 0%,#1a237e 100%)',
      'display:flex', 'flex-direction:column',
      'align-items:center', 'justify-content:center',
      'gap:1.25rem',
    ].join(';');

    veil.innerHTML = `
      <div style="font-family:'Epilogue',system-ui,sans-serif;font-size:2rem;
                  font-weight:900;color:#fff;letter-spacing:-.02em;">NJTC</div>
      <div style="font-family:system-ui,sans-serif;font-size:.9375rem;
                  color:rgba(255,255,255,.55);">Verifying access&hellip;</div>
      <div style="width:180px;height:2px;background:rgba(255,255,255,.12);
                  border-radius:1px;overflow:hidden;margin-top:.25rem;">
        <div id="njtc-veil-bar" style="height:100%;width:0;
             background:linear-gradient(90deg,#FFB81C,#fff);
             border-radius:1px;transition:width .4s ease;"></div>
      </div>`;
    document.documentElement.appendChild(veil);

    /* Animate the progress bar to show activity */
    requestAnimationFrame(() => {
      setTimeout(() => {
        const bar = document.getElementById('njtc-veil-bar');
        if (bar) bar.style.width = '65%';
      }, 80);
    });
  }

  function removeVeil() {
    const bar = document.getElementById('njtc-veil-bar');
    if (bar) bar.style.width = '100%';
    setTimeout(() => {
      const veil = document.getElementById('njtc-auth-veil');
      if (veil) {
        veil.style.transition = 'opacity .35s ease';
        veil.style.opacity = '0';
        setTimeout(() => veil.remove(), 380);
      }
    }, 250);
  }

  /* ── 2. Redirect to login (avoid redirect loops) ──────────────────────── */
  function redirectToLogin() {
    /* Don't bounce if we're already on the login page */
    if (window.location.pathname.endsWith('index.html') &&
        window.location.pathname.indexOf('/onsite/') === -1) {
      return;
    }
    window.location.replace(LOGIN_URL);
  }

  /* ── 3. Read token — URL hash takes priority (Safari ITP fallback) ────── */
  function extractTokenFromHash() {
    const hash = window.location.hash;          // e.g. "#t=abc123"
    if (!hash) return null;
    const match = hash.match(/[#&]t=([^&]+)/);
    if (!match) return null;
    try {
      return decodeURIComponent(match[1]);
    } catch (e) {
      return null;
    }
  }

  function clearHashToken() {
    /* Remove #t=... from the URL bar without triggering a reload */
    try {
      const url = window.location.href.replace(/#t=[^&]*(&|$)/, '#').replace(/#$/, '');
      window.history.replaceState(null, '', url);
    } catch (e) { /* ignore */ }
  }

  /* ── 4. Main guard flow ───────────────────────────────────────────────── */
  async function guard() {
    showVeil();

    /* Wait for NJTCAuth to be available (auth.js must load first) */
    let waited = 0;
    while (typeof NJTCAuth === 'undefined' && waited < 3000) {
      await new Promise(r => setTimeout(r, 50));
      waited += 50;
    }

    if (typeof NJTCAuth === 'undefined') {
      console.error('[onsite-guard] NJTCAuth not found — check auth.js load order');
      redirectToLogin();
      return;
    }

    /* Check hash token first (freshly routed from login page) */
    const hashToken = extractTokenFromHash();
    if (hashToken) {
      /* Let auth.js store it so currentSession() works next time */
      if (typeof NJTCAuth.storeToken === 'function') {
        NJTCAuth.storeToken(hashToken);
      }
      clearHashToken();
    }

    /* Validate the session */
    let session = null;
    try {
      session = await NJTCAuth.currentSession();
    } catch (e) {
      console.error('[onsite-guard] currentSession error:', e);
    }

    if (!session) {
      redirectToLogin();
      return;
    }

    /* Dept check — onsite tokens must have dept === 'onsite' */
    if (session.dept && session.dept !== EXPECTED_DEPT) {
      console.warn('[onsite-guard] Wrong dept:', session.dept, '— redirecting');
      redirectToLogin();
      return;
    }

    /* ✅ Valid session — expose to portal */
    window.NJTC_SESSION = session;
    removeVeil();
  }

  /* Run as soon as the script executes */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', guard);
  } else {
    guard();
  }
})();
