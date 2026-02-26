/**
 * NJTC Portal Auth Module
 * GitHub Pages static auth: SHA-256 hash comparison + session token in localStorage.
 * NOT a hardened security system — designed to prevent casual unauthorized access
 * for an internal staff portal. See README for disclaimer.
 */

const NJTCAuth = (() => {
  const SESSION_KEY   = 'NJTC_SESSION';
  const SESSION_TTL   = 8 * 60 * 60 * 1000; // 8 hours in ms
  const CODES_URL     = './codes.json';  // relative to repo root

  // ── Hashing ────────────────────────────────────────────────────────────────
  async function sha256(str) {
    const buf = await crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode(str)
    );
    return Array.from(new Uint8Array(buf))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }

  // ── Token helpers ──────────────────────────────────────────────────────────
  // Token = base64(JSON { dept, exp, sig })
  // sig = first 16 chars of sha256(dept + exp + NJTC_STATIC_SALT)
  // Salt is NOT a secret (it's static), but prevents trivial localStorage edits.
  const STATIC_SALT = 'NJTC-2526-PORTAL-INTEGRITY';

  async function createToken(dept) {
    const exp = Date.now() + SESSION_TTL;
    const sig = (await sha256(dept + exp + STATIC_SALT)).slice(0, 24);
    const payload = { dept, exp, sig };
    return btoa(JSON.stringify(payload));
  }

  async function verifyToken(token) {
    try {
      const payload = JSON.parse(atob(token));
      const { dept, exp, sig } = payload;
      if (!dept || !exp || !sig) return null;
      if (Date.now() > exp) return null; // expired
      const expectedSig = (await sha256(dept + exp + STATIC_SALT)).slice(0, 24);
      if (sig !== expectedSig) return null; // tampered
      return { dept, exp };
    } catch {
      return null;
    }
  }

  // ── Session storage ────────────────────────────────────────────────────────
  function saveSession(token) {
    localStorage.setItem(SESSION_KEY, token);
  }

  function getStoredToken() {
    return localStorage.getItem(SESSION_KEY);
  }

  function clearSession() {
    localStorage.removeItem(SESSION_KEY);
  }

  // ── Login flow ─────────────────────────────────────────────────────────────
  async function login(enteredCode) {
    const hash = await sha256(enteredCode.trim());
    let codes;
    try {
      const res = await fetch(CODES_URL + '?v=' + Date.now());
      const data = await res.json();
      codes = data.codes;
    } catch {
      throw new Error('Unable to load auth data. Check network or contact admin.');
    }
    const match = codes.find(c => c.h === hash);
    if (!match) return null; // no match
    const token = await createToken(match.d);
    saveSession(token);
    return match.d;
  }

  // ── Guard: verify current session ─────────────────────────────────────────
  async function currentSession() {
    const token = getStoredToken();
    if (!token) return null;
    return await verifyToken(token);
  }

  // ── Logout ─────────────────────────────────────────────────────────────────
  function logout() {
    clearSession();
    window.location.href = '/index.html';
  }

  // Public API
  return { login, currentSession, logout, clearSession };
})();
