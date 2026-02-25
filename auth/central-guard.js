/**
 * NJTC Central Portal Route Guard
 * Add <script src="/auth/auth.js"></script> BEFORE this file.
 * Drop: <script src="/auth/central-guard.js"></script> as second script in central pages.
 *
 * Exposes window.NJTC_SESSION = { dept } for central/index.html to use.
 * Bounces non-CT users back to gate.
 */
(async () => {
  const session = await NJTCAuth.currentSession();
  const CT_DEPTS = ['hr','finance','programming','data','training','leadership'];

  if (!session || !CT_DEPTS.includes(session.dept)) {
    window.location.replace('/index.html');
    return;
  }

  // Expose to page
  window.NJTC_SESSION = session;
})();
