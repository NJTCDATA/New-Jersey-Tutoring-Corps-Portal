(async () => {
  const BASE = '/New-Jersey-Tutoring-Corps-Portal';
  const session = await NJTCAuth.currentSession();

  if (!session || session.dept !== 'onsite') {
    window.location.replace(BASE + '/index.html');
    return;
  }

  window.NJTC_SESSION = session;
})();  }

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
