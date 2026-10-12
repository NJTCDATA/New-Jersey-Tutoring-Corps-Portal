// ══════════════════════════════════════════════════════════════════════════════
//  PAGE LINKS + BACK BUTTON
//  Every page has its own address so staff can bookmark it or send it to a
//  coworker, and the browser / phone Back button goes back a page:
//     #/talent           a page (any sidebar destination)
//     #/talent/dol       a Talent Analytics tab
//     #/profile/<name>   a staff profile (opens over Talent Analytics)
//  Links never widen access: a page opens only when that department's view can
//  open it (its sidebar link is showing), otherwise the portal stays on Home.
//  "#t=" is the sign-in token (auth.js) — these links always start with "#/".
// ══════════════════════════════════════════════════════════════════════════════
(function () {
  'use strict';

  const DEEP_KEY = 'njtc_deeplink_v1';      // saved before a sign-in redirect (see index.html <head>)
  let _applying = false;                    // true while we navigate FROM the address bar
  let _ready = false;

  const lens = () => window._currentDept || window.NJTC_VIEW_DEPT || (window.NJTC_SESSION || {}).dept || '';
  const visible = el => !!el && el.offsetParent !== null && getComputedStyle(el).display !== 'none';
  const canOpenPanel = id => id === 'home' || visible(document.querySelector('.ct-sidebar .sidebar-link[data-panel="' + id + '"]'))
    // a panel the sidebar shows under another name (e.g. Finance's Partnership Risk)
    || [...document.querySelectorAll('.ct-sidebar .sidebar-link')].some(b => visible(b) && b.getAttribute('data-panel') === id);
  const canOpenProfiles = () => lens() !== 'leadership' && canOpenPanel('talent');

  function parse(hash) {
    const h = (hash || '').replace(/^#/, '');
    if (!h.startsWith('/')) return null;
    const parts = h.slice(1).split('/');
    if (parts[0] === 'profile') return { profile: decodeURIComponent(parts.slice(1).join('/')) };
    return { panel: parts[0] || 'home', tab: parts[1] || '' };
  }
  function currentPanel() { const p = document.querySelector('.panel.active'); return p ? p.id.replace(/^panel-/, '') : 'home'; }
  function currentTalentTab() { const t = document.querySelector('.pst-tab.active[id^="talentTab-"]'); return t ? t.id.replace('talentTab-', '') : ''; }

  function setHash(h, replace) {
    if (!_ready || _applying) return;
    if (location.hash === h) return;
    try { history[replace ? 'replaceState' : 'pushState'](null, '', location.pathname + location.search + h); } catch (e) {}
  }

  // ── Record navigation in the address bar ───────────────────────────────────
  function wrap() {
    const sp = window.showPanel;
    if (typeof sp === 'function' && !sp.__njtcLinks) {
      const w = function (id, btn) {
        const r = sp.apply(this, arguments);
        // showPanel can refuse (e.g. Support Log outside HR/Data) — record where we actually are
        setTimeout(() => { const cur = currentPanel(); setHash(cur === 'home' ? '#/' : '#/' + cur); }, 0);
        return r;
      };
      w.__njtcLinks = true;
      window.showPanel = w;
    }
    const st = window.setTalentTab;
    if (typeof st === 'function' && !st.__njtcLinks) {
      const w = function (tab) {
        const r = st.apply(this, arguments);
        if (currentPanel() === 'talent' && tab) setHash('#/talent/' + tab, true);   // a tab switch replaces, not adds
        return r;
      };
      w.__njtcLinks = true;
      window.setTalentTab = w;
    }
    const prof = window._hrShowProfile;
    if (typeof prof === 'function' && !prof.__njtcLinks) {
      const w = function (name) {
        const r = prof.apply(this, arguments);
        const m = document.getElementById('hrEmpModal');
        if (m && m.style.display === 'block') {
          setHash('#/profile/' + encodeURIComponent(name));
          addCopyLink(name);
        }
        return r;
      };
      w.__njtcLinks = true;
      window._hrShowProfile = w;
    }
  }

  // "Copy link" on a profile so it can be sent to a coworker
  function addCopyLink(name) {
    const inner = document.getElementById('hrEmpModalInner');
    if (!inner || inner.querySelector('.njtc-copy-link')) return;
    const close = inner.querySelector('button[onclick*="hrEmpModal"]');
    if (!close || !close.parentElement) return;
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'njtc-copy-link';
    b.textContent = '🔗 Copy link';
    b.title = 'Copy a link to this profile';
    b.style.cssText = 'background:rgba(255,255,255,.15);border:1px solid rgba(255,255,255,.25);color:#fff;border-radius:999px;padding:.2rem .65rem;font:inherit;font-size:.72rem;font-weight:700;cursor:pointer;margin-right:.4rem;white-space:nowrap';
    b.addEventListener('click', ev => {
      ev.stopPropagation();
      const url = location.origin + location.pathname + '#/profile/' + encodeURIComponent(name);
      copyText(url).then(ok => { b.textContent = ok ? '✓ Link copied' : '🔗 Copy link'; if (!ok) window.prompt('Copy this link:', url); setTimeout(() => { b.textContent = '🔗 Copy link'; }, 2000); });
    });
    close.parentElement.insertBefore(b, close);
  }
  function copyText(t) {
    if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(t).then(() => true, () => false);
    return Promise.resolve(false);
  }
  window.njtcCopyLink = copyText;

  // Closing a profile (✕ or the dark background) returns the address to the page underneath
  function watchProfileModal() {
    const m = document.getElementById('hrEmpModal');
    if (!m || m.__njtcWatched) return;
    m.__njtcWatched = true;
    new MutationObserver(() => {
      if (m.style.display === 'none' && /^#\/profile\//.test(location.hash) && !_applying) {
        const tab = currentTalentTab();
        setHash(currentPanel() === 'talent' && tab ? '#/talent/' + tab : '#/' + (currentPanel() === 'home' ? '' : currentPanel()), true);
      }
    }).observe(m, { attributes: true, attributeFilter: ['style'] });
  }

  // ── Open what the address says ─────────────────────────────────────────────
  function waitFor(test, ms, step) {
    return new Promise(res => {
      const t0 = Date.now();
      (function poll() { if (test()) return res(true); if (Date.now() - t0 > ms) return res(false); setTimeout(poll, step || 250); })();
    });
  }

  // A link this department view can't open: stay on (or go to) Home and say so in the address
  function refuse() {
    if (currentPanel() !== 'home') window.showPanel('home');
    try { history.replaceState(null, '', location.pathname + location.search + '#/'); } catch (e) {}
  }

  async function apply(hash) {
    const r = parse(hash);
    if (!r) return;
    _applying = true;
    try {
      const m = document.getElementById('hrEmpModal');
      if (r.profile) {
        if (!canOpenProfiles()) { refuse(); return; }
        if (currentPanel() !== 'talent') window.showPanel('talent');
        const ok = await waitFor(() => (window.HR_EMPS || []).some(e => e.n === r.profile) && typeof window._hrShowProfile === 'function', 30000);
        if (ok) { window._hrShowProfile(r.profile); addCopyLink(r.profile); }
        return;
      }
      if (m && m.style.display === 'block') m.style.display = 'none';
      const panel = r.panel === '' ? 'home' : r.panel;
      if (!document.getElementById('panel-' + panel) || !canOpenPanel(panel)) { refuse(); return; }
      if (currentPanel() !== panel) window.showPanel(panel, document.querySelector('.ct-sidebar .sidebar-link[data-panel="' + panel + '"]'));
      if (panel === 'talent' && r.tab) {
        await new Promise(res => setTimeout(res, 500));   // Talent picks its default tab ~300ms after opening
        const btn = document.getElementById('talentTab-' + r.tab);
        if (visible(btn) && typeof window.setTalentTab === 'function') window.setTalentTab(r.tab);
      }
    } finally {
      setTimeout(() => { _applying = false; }, 0);
    }
  }

  window.addEventListener('popstate', () => { if (_ready) apply(location.hash || '#/'); });

  // Used by the portal search: go to a page / tab / profile and record it like a click
  window.njtcLinks = {
    go(hash) {
      if (!_ready) return;
      try { history.pushState(null, '', location.pathname + location.search + hash); } catch (e) {}
      apply(hash);
    },
    canOpenPanel, canOpenProfiles,
  };

  // ── Start once the portal has signed in and built Home ─────────────────────
  async function start() {
    await waitFor(() => {
      const lay = document.getElementById('ctLayout');
      return lay && lay.style.display !== 'none' && lens() && typeof window.showPanel === 'function';
    }, 60000, 200);
    wrap();
    watchProfileModal();
    // A link opened before signing in was saved by the <head> snippet
    let target = parse(location.hash) ? location.hash : '';
    if (!target) {
      try {
        const saved = JSON.parse(sessionStorage.getItem(DEEP_KEY) || 'null');
        if (saved && saved.h && Date.now() - saved.ts < 30 * 60000) target = saved.h;
      } catch (e) {}
    }
    try { sessionStorage.removeItem(DEEP_KEY); } catch (e) {}
    _ready = true;
    if (target && target !== '#/') {
      try { history.replaceState(null, '', location.pathname + location.search + target); } catch (e) {}
      await new Promise(res => setTimeout(res, 300));
      await apply(target);
    } else {
      setHash('#/' + (currentPanel() === 'home' ? '' : currentPanel()), true);
    }
    // Late-loading modules can re-wrap showPanel; keep our wrapper on the outside
    setInterval(wrap, 3000);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
