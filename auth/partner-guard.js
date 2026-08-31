(async () => {
  const BASE = '/New-Jersey-Tutoring-Corps-Portal';

  function waitForAuth(timeout = 5000) {
    return new Promise((resolve, reject) => {
      if (typeof NJTCAuth !== 'undefined') { resolve(); return; }
      const interval = setInterval(() => {
        if (typeof NJTCAuth !== 'undefined') { clearInterval(interval); resolve(); }
      }, 50);
      setTimeout(() => { clearInterval(interval); reject(new Error('NJTCAuth timeout')); }, timeout);
    });
  }

  try {
    await waitForAuth();
  } catch {
    window.location.replace(BASE + '/index.html');
    return;
  }

  const session = await NJTCAuth.currentSession();

  if (!session || session.dept !== 'partner' || !session.pid) {
    window.location.replace(BASE + '/index.html');
    return;
  }

  window.NJTC_SESSION = session; // { dept: 'partner', exp, pid }
})();
