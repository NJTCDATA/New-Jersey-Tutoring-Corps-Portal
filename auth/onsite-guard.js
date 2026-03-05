(async () => {
  const BASE = '/New-Jersey-Tutoring-Corps-Portal';

  // Wait for NJTCAuth to be available (handles script load-order races)
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

  if (!session || session.dept !== 'onsite') {
    window.location.replace(BASE + '/index.html');
    return;
  }

  window.NJTC_SESSION = session;

  // Hide loading screen now that auth is confirmed
  const loader = document.getElementById('loadingScreen');
  if (loader) {
    loader.style.opacity = '0';
    loader.style.transition = 'opacity 0.3s ease';
    setTimeout(() => { loader.style.display = 'none'; }, 300);
  }
})();
