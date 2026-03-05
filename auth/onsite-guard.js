(async () => {
  const BASE = '/New-Jersey-Tutoring-Corps-Portal';

  if (typeof NJTCAuth === 'undefined') {
    window.location.replace(BASE + '/index.html');
    return;
  }

  const session = await NJTCAuth.currentSession();

  if (!session || session.dept !== 'onsite') {
    window.location.replace(BASE + '/index.html');
    return;
  }

  window.NJTC_SESSION = session;
})();
