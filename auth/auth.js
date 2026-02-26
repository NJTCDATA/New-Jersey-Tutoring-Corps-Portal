Yes that's exactly what's happening. The URL is changing to `njtcdata.github.io/index.html` which means `auth.js` is loading but **the fetch to `codes.json` is failing**, which triggers the error handler, which calls logout, which redirects to the wrong path.

The root cause is **line 12 of `auth.js` in your repo still has the old path**. The file in your repo has not been updated yet.

---

## One Fix — Update `auth/auth.js` Right Now

1. Go to your repo → click `auth` folder → click `auth.js`
2. Click the **pencil icon** to edit
3. **Select all** (Ctrl+A or Cmd+A)
4. **Delete everything**
5. Paste this entire file:

```javascript
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
```

6. Scroll down → click **Commit changes** → commit directly to `main`

---

## Then Immediately Check `auth/codes.json`

After committing `auth.js`, click `auth/codes.json` in your repo. It needs to show real hashes — 64-character strings like `a3f2c9...`. If it still shows `REPLACE_WITH_SHA256_OF_...` then:

1. Go to **Actions → Rotate Access Code Hashes (Manual) → Run workflow**
2. Leave all the default codes as-is
3. Click **Run workflow**
4. Wait for green checkmark

---

After both of those — wait 2 minutes for deploy, then go to:
```
https://njtcdata.github.io/New-Jersey-Tutoring-Corps-Portal/
```

Enter `NJTC-LDR-2526` and tell me what happens.
