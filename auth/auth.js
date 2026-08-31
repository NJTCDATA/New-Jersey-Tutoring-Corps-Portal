const NJTCAuth = (() => {
  const SESSION_KEY = 'NJTC_SESSION';
  const SESSION_TTL = 8 * 60 * 60 * 1000;
  const BASE        = '/New-Jersey-Tutoring-Corps-Portal';
  const CODES_URL   = BASE + '/auth/codes.json';
  const PARTNER_CODES_URL = BASE + '/auth/partner-codes.json';

  // ── Storage: tries localStorage, sessionStorage, then in-memory ──────────
  let _memStore = {};

  function storageSet(key, val) {
    _memStore[key] = val;
    try { localStorage.setItem(key, val); } catch(e) {}
    try { sessionStorage.setItem(key, val); } catch(e) {}
  }

  function storageGet(key) {
    if (_memStore[key]) return _memStore[key];
    try { const v = localStorage.getItem(key);   if (v) { _memStore[key] = v; return v; } } catch(e) {}
    try { const v = sessionStorage.getItem(key); if (v) { _memStore[key] = v; return v; } } catch(e) {}
    return null;
  }

  function storageRemove(key) {
    delete _memStore[key];
    try { localStorage.removeItem(key); }   catch(e) {}
    try { sessionStorage.removeItem(key); } catch(e) {}
  }

  // ── Also check URL hash for token (Safari ITP fallback) ──────────────────
  function loadTokenFromHash() {
    try {
      const hash = window.location.hash;
      if (hash && hash.startsWith('#t=')) {
        const token = decodeURIComponent(hash.slice(3));
        storageSet(SESSION_KEY, token);
        // Clean the URL without reloading
        history.replaceState(null, '', window.location.pathname + window.location.search);
        return token;
      }
    } catch(e) {}
    return null;
  }

  // ── Hashing ───────────────────────────────────────────────────────────────
  async function sha256(str) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,'0')).join('');
  }

  const STATIC_SALT = 'NJTC-2526-PORTAL-INTEGRITY';

  // pid (partner directory id) is only set for individual email+PIN logins
  // (dept === 'partner'). Concatenating '' for shared department codes keeps
  // the signed string identical to the pre-partner-portal format, so existing
  // sessions/tokens are unaffected.
  async function createToken(dept, extra) {
    const exp = Date.now() + SESSION_TTL;
    const pid = (extra && extra.pid) || '';
    const sig = (await sha256(dept + exp + pid + STATIC_SALT)).slice(0, 24);
    return btoa(JSON.stringify({ dept, exp, pid, sig }));
  }

  async function verifyToken(token) {
    try {
      const { dept, exp, pid, sig } = JSON.parse(atob(token));
      if (!dept || !exp || !sig) return null;
      if (Date.now() > exp) return null;
      const expectedSig = (await sha256(dept + exp + (pid || '') + STATIC_SALT)).slice(0, 24);
      if (sig !== expectedSig) return null;
      return { dept, exp, pid: pid || null };
    } catch { return null; }
  }

  function saveSession(token)  { storageSet(SESSION_KEY, token); }
  function getStoredToken()    { return loadTokenFromHash() || storageGet(SESSION_KEY); }
  function clearSession()      { storageRemove(SESSION_KEY); }

  async function login(enteredCode) {
    const raw = enteredCode.trim();
    // Shared department/onsite codes are case-sensitive (unchanged behavior).
    // Individual partner logins ("email-PIN") are matched case-insensitively
    // since email addresses aren't reliably typed with consistent casing.
    const hashExact = await sha256(raw);
    const hashLower = await sha256(raw.toLowerCase());

    let codes;
    try {
      const res  = await fetch(CODES_URL + '?v=' + Date.now());
      const data = await res.json();
      codes = data.codes;
    } catch {
      throw new Error('Unable to load auth data. Check network or contact admin.');
    }

    const match = codes.find(c => c.h === hashExact);
    if (match) {
      const token = await createToken(match.d);
      saveSession(token);
      return { dept: match.d, token };
    }

    // Fall back to the individual partner/admin/regional directory.
    try {
      const pres = await fetch(PARTNER_CODES_URL + '?v=' + Date.now());
      const pdata = await pres.json();
      const pmatch = (pdata.codes || []).find(c => c.h === hashLower);
      if (pmatch) {
        // pmatch.pid is an opaque HMAC token (partner/data/<pid>.json), not a
        // readable identifier — see scripts/build-partner-data.js.
        const token = await createToken('partner', { pid: pmatch.pid });
        saveSession(token);
        return { dept: 'partner', token, pid: pmatch.pid };
      }
    } catch { /* partner directory is optional — absence isn't a hard error */ }

    return null;
  }

  async function currentSession() {
    const token = getStoredToken();
    if (!token) return null;
    return await verifyToken(token);
  }

  function logout() {
    clearSession();
    window.location.href = BASE + '/index.html?signout=1';
  }

  return { login, currentSession, logout, clearSession, getStoredToken };
})();
