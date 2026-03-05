(async () => {
  const BASE = '/New-Jersey-Tutoring-Corps-Portal';

  // ── Show loading veil immediately ─────────────────────────────────────────
  const veil = document.createElement('div');
  veil.id = 'njtc-auth-veil';
  veil.style.cssText = [
    'position:fixed',
    'inset:0',
    'background:linear-gradient(135deg,#001a33 0%,#003366 60%,#1a237e 100%)',
    'display:flex',
    'flex-direction:column',
    'align-items:center',
    'justify-content:center',
    'gap:1.5rem',
    'z-index:99999',
    'transition:opacity 0.5s ease'
  ].join(';');

  veil.innerHTML = `
    <div style="
      width:90px;height:90px;
      background:linear-gradient(135deg,#003366,#0066cc);
      border-radius:50%;
      display:flex;align-items:center;justify-content:center;
      font-family:system-ui,sans-serif;font-size:2.25rem;font-weight:900;
      color:#FFB81C;
      border:5px solid #fff;
      box-shadow:0 0 40px rgba(255,184,28,0.5)
    ">NJTC</div>
    <div style="
      font-family:system-ui,sans-serif;font-size:1.125rem;
      color:rgba(255,255,255,0.85);letter-spacing:0.05em;font-weight:500
    ">Verifying access&hellip;</div>
    <div style="
      width:220px;height:4px;background:rgba(255,255,255,0.15);border-radius:4px;overflow:hidden
    ">
      <div id="njtc-veil-bar" style="
        width:40%;height:100%;
        background:linear-gradient(90deg,#FFB81C,#FFC94D);
        border-radius:4px;
        animation:njtcSlide 1.4s ease-in-out infinite alternate
      "></div>
    </div>
    <style>
      @keyframes njtcSlide{
        from{transform:translateX(-60px)}
        to{transform:translateX(200px)}
      }
    </style>
  `;

  document.documentElement.appendChild(veil);

  // ── Helper: remove veil with fade ─────────────────────────────────────────
  function removeVeil() {
    veil.style.opacity = '0';
    setTimeout(() => veil.remove(), 500);
  }

  // ── Helper: redirect to login safely (loop-guard) ─────────────────────────
  function redirectToLogin() {
    const login = BASE + '/index.html';
    if (window.location.href.includes(login)) return;
    window.location.replace(login);
  }

  // ── Wait for NJTCAuth to be available ────────────────────────────────────
  let waited = 0;
  while (typeof NJTCAuth === 'undefined' && waited < 5000) {
    await new Promise(r => setTimeout(r, 50));
    waited += 50;
  }
  if (typeof NJTCAuth === 'undefined') {
    redirectToLogin();
    return;
  }

  // ── Validate session ──────────────────────────────────────────────────────
  try {
    const session = await NJTCAuth.currentSession();

    if (!session || session.dept !== 'onsite') {
      redirectToLogin();
      return;
    }

    window.NJTC_SESSION = session;
    removeVeil();

  } catch (e) {
    redirectToLogin();
  }
})();
