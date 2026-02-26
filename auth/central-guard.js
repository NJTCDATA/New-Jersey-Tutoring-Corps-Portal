(async () => {
  const CT_DEPTS = ['hr','finance','programming','data','training','leadership'];
  const BASE = '/New-Jersey-Tutoring-Corps-Portal';

  // getStoredToken() already handles URL hash extraction internally
  const session = await NJTCAuth.currentSession();

  if (!session || !CT_DEPTS.includes(session.dept)) {
    window.location.replace(BASE + '/index.html');
    return;
  }

  window.NJTC_SESSION = session;
})();
