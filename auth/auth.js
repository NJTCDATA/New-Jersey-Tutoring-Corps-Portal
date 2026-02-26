const NJTCAuth = (() => {
  const SESSION_KEY = 'NJTC_SESSION';
  const SESSION_TTL = 8 * 60 * 60 * 1000;
  const BASE        = '/New-Jersey-Tutoring-Corps-Portal';
  const CODES_URL   = BASE + '/auth/codes.json';

  async function sha256(str) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
  }

  const STATIC_SALT = 'NJTC-2526-PORTAL-INTEGRITY';

  async function createToken(dept) {
    const exp = Date.now() + SESSION_TTL;
    const sig = (await sha256(dept + exp + STATIC_SALT)).slice(0, 24);
    return btoa(JSON.stringify({ dept, exp, sig }));
  }

  async function verifyToken(token) {
    try {
      const { dept, exp, sig } = JSON.parse(atob(token));
      if (!dept || !exp || !sig) return null;
      if (Date.now() > exp) return null;
      const expectedSig = (await sha256(dept + exp + STATIC_SALT)).slice(0, 24);
      if (sig !== expectedSig) return null;
      return { dept, exp };
    } catch { return null; }
  }

  function saveSession(token) { localStorage.setItem(SESSION_KEY, token); }
  function getStoredToken()   { return localStorage.getItem(SESSION_KEY); }
  function clearSession()     { localStorage.removeItem(SESSION_KEY); }

  async function login(enteredCode) {
    const hash = await sha256(enteredCode.trim());
    let codes;
    try {
      const res  = await fetch(CODES_URL + '?v=' + Date.now());
      const data = await res.json();
      codes = data.codes;
    } catch {
      throw new Error('Unable to load auth data. Check network or contact admin.');
    }
    const match = codes.find(c => c.h === hash);
    if (!match) return null;
    const token = await createToken(match.d);
    saveSession(token);
    return match.d;
  }

  async function currentSession() {
    const token = getStoredToken();
    if (!token) return null;
    return await verifyToken(token);
  }

  function logout() {
    clearSession();
    window.location.href = BASE + '/index.html';
  }

  return { login, currentSession, logout, clearSession };
})();
