(async () => {
  const CT_DEPTS = ['hr','finance','programming','data','training','leadership','kb'];
  const BASE = '/New-Jersey-Tutoring-Corps-Portal';

  // getStoredToken() already handles URL hash extraction internally
  const session = await NJTCAuth.currentSession();

  if (!session || !CT_DEPTS.includes(session.dept)) {
    window.location.replace(BASE + '/index.html');
    return;
  }

  // KB doesn't need a separate portal (Central Team feedback, Oct 2026): the KB
  // login is still accepted and opens the Leadership view.
  if (session.dept === 'kb') session.dept = 'leadership';

  window.NJTC_SESSION = session;
})();
