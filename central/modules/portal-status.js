// ══════════════════════════════════════════════════════════════════════════════
//  PAGE STATUS LINE — "Updated 9:42 AM" + "Report a problem"
//  Sits under each page title. The time is when this page's own data was last
//  pulled (or, when it came from the copy saved on this device, when that copy
//  was saved). If that data didn't load, a plain warning says so. No source
//  names are shown to staff.
//  Requests are recorded by the small logger in index.html <head> (window.__njtcNet).
// ══════════════════════════════════════════════════════════════════════════════
(function () {
  'use strict';

  const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const lens = () => window._currentDept || window.NJTC_VIEW_DEPT || (window.NJTC_SESSION || {}).dept || '';

  // Which data each page shows (keys match the <head> logger)
  const HOME = { hr: ['hr', 'onsite', 'concerns'], programming: ['pearl'], data: ['hr', 'pearl', 'concerns'], training: ['hr', 'onsite'],
                 finance: ['concerns', 'pearl'], leadership: ['kpi', 'pearl', 'hr'], kb: ['kpi', 'pearl', 'hr'] };
  const PAGES = {
    talent: ['hr', 'concerns', 'onsite'], concern: ['concerns'], 'pearl-ops': ['pearl'], 'tap-standalone': ['tap'],
    kpi: ['kpi'], 'kpi-analytics': ['kpi'], 'finance-analytics': ['concerns', 'pearl'],
  };
  // Copy saved on this device, used when nothing was fetched this visit
  const CACHE = {
    hr: () => 'njtc_hr_live_v4', concerns: () => 'njtc_talent_v2', onsite: () => 'njtc_onsite_live_v3',
    kpi: () => /26-27|2026-2027/.test(String(window.NJTC_KPI_SY || '')) ? 'njtc_kpi_2627_v1' : 'njtc_kpi_v2',
    pearl: () => { const p = window.po && window.po.getActivePeriod ? window.po.getActivePeriod() : ''; return p === 'sy2526' ? 'njtc_pearl_v1' : p === 'summer2026' ? 'njtc_pearl_summer_v1' : 'njtc_pearl_2627_v1'; },
  };
  const _cacheTs = {};
  function savedAt(key) {
    if (!key) return 0;
    if (key in _cacheTs) return _cacheTs[key];
    let ts = 0;
    try { const raw = localStorage.getItem(key); if (raw) { const m = raw.slice(0, 40).match(/"ts":(\d{12,14})/); ts = m ? +m[1] : ((JSON.parse(raw) || {}).ts || 0); } } catch (e) {}
    return (_cacheTs[key] = ts);
  }

  function pageSources() {
    const p = document.querySelector('.panel.active');
    if (!p) return null;
    const id = p.id.replace(/^panel-/, '');
    return { id, el: p, keys: id === 'home' ? (HOME[lens()] || []) : (PAGES[id] || []) };
  }

  function status(keys) {
    const net = window.__njtcNet || {};
    let failed = false, stale = false, times = [];
    keys.forEach(k => {
      const e = net[k];
      // Didn't load = it was requested this visit and not one request succeeded
      // (a fallback that worked, or one tab of several failing, isn't flagged)
      if (e && !e.ok && e.fail && !e.pending) failed = true;
      if (e && e.ok) times.push(e.ok);
      else if (!e || !e.pending) { const t = CACHE[k] ? savedAt(CACHE[k]()) : 0; if (t) times.push(t); }
    });
    // The staff list fell back to the older published copy (Data sees the detail on Home)
    if (keys.includes('hr') && window._njtcHRSource === 'published') stale = true;
    const loading = keys.some(k => net[k] && net[k].pending) && !times.length;
    return { failed, stale, loading, at: times.length ? Math.min.apply(null, times) : 0 };
  }

  function fmt(ts) {
    const d = new Date(ts), now = new Date();
    const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    if (d.toDateString() === now.toDateString()) return time;
    const y = new Date(now); y.setDate(now.getDate() - 1);
    if (d.toDateString() === y.toDateString()) return 'yesterday ' + time;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ' ' + time;
  }

  function render() {
    const P = pageSources();
    if (!P) return;
    let host = P.el.querySelector('.page-header .ph-text') || P.el.querySelector('.page-header');
    let line = P.el.querySelector('.njtc-status');
    if (!line) {
      line = document.createElement('div');
      line.className = 'njtc-status';
      if (host) host.appendChild(line); else P.el.insertBefore(line, P.el.firstChild);
    }
    let left = '';
    if (P.keys.length) {
      const s = status(P.keys);
      if (s.failed) left = `<span class="njtc-st-warn">⚠ Some of this page's data didn't load. <button type="button" class="njtc-st-btn" data-st="reload">Refresh</button></span>`;
      else if (s.stale) left = `<span class="njtc-st-warn">⚠ Staff data may be out of date. <button type="button" class="njtc-st-btn" data-st="reload">Refresh</button></span>`;
      else if (s.at) left = `<span class="njtc-st-ok" title="When this page's data was last pulled">● Updated ${esc(fmt(s.at))}</span>`;
      else if (s.loading) left = `<span class="njtc-st-muted">⏳ Loading latest data…</span>`;
    }
    const html = left + `<button type="button" class="njtc-st-btn njtc-st-report" data-st="report">⚑ Report a problem</button>`;
    if (line.__html !== html) { line.__html = html; line.innerHTML = html; }
  }

  // ── Report a problem → Data & Evaluation request queue ─────────────────────
  // Same Google Form as Pearl Operations → "Submit a Data Request", marked as a
  // portal problem, so it lands in the Tickets view the Data team already uses.
  const FORM_URL = 'https://docs.google.com/forms/d/e/1FAIpQLSfBqfEOWMgR4ynfbQi5t0vGMMtZjUZ6IMqRabPF9BZqTMlgqQ/formResponse';
  function pageName() {
    const p = document.querySelector('.panel.active');
    const t = p && p.querySelector('.ph-title');
    let name = t ? t.textContent.trim() : (p ? p.id.replace(/^panel-/, '') : 'Portal');
    const tab = document.querySelector('.pst-tab.active[id^="talentTab-"]');
    if (p && p.id === 'panel-talent' && tab) name += ' → ' + tab.textContent.trim();
    return name.replace(/\s+/g, ' ');
  }
  function openReport() {
    let ov = document.getElementById('njtcReport');
    if (!ov) {
      ov = document.createElement('div');
      ov.id = 'njtcReport';
      ov.addEventListener('click', e => { if (e.target === ov || e.target.closest('[data-rp="close"]')) ov.classList.remove('open'); });
      document.body.appendChild(ov);
    }
    const who = (window.NJTC_SESSION && window.NJTC_SESSION.name) || '';
    const deptLabel = (document.getElementById('deptBadge') || {}).textContent || lens();
    ov.innerHTML = `<div class="rp-box" role="dialog" aria-label="Report a problem">
        <div class="rp-hdr"><div><b>⚑ Report a problem</b><small>Goes to the Data &amp; Evaluation team</small></div>
          <button type="button" class="rp-x" data-rp="close" aria-label="Close">✕</button></div>
        <div class="rp-body">
          <label>Your name<input id="rpName" type="text" value="${esc(who)}" autocomplete="name"></label>
          <label>What looks wrong?<textarea id="rpText" rows="4" placeholder="For example: the number of active tutors at Kuser looks too low, or a button doesn't work."></textarea></label>
          <div class="rp-ctx">We'll include the page (<b>${esc(pageName())}</b>), your department view (${esc(deptLabel.trim())}) and today's date.</div>
          <div class="rp-actions"><button type="button" class="rp-send" id="rpSend">Send</button><span id="rpMsg"></span></div>
        </div></div>`;
    ov.classList.add('open');
    setTimeout(() => { const t = document.getElementById('rpText'); if (t) t.focus(); }, 30);
    document.getElementById('rpSend').onclick = send;
  }
  async function send() {
    const name = (document.getElementById('rpName').value || '').trim();
    const text = (document.getElementById('rpText').value || '').trim();
    const msg = document.getElementById('rpMsg');
    if (!name || !text) { msg.innerHTML = '<span style="color:#b91c1c">Please add your name and what looks wrong.</span>'; return; }
    const deptLabel = ((document.getElementById('deptBadge') || {}).textContent || lens()).trim();
    const link = location.origin + location.pathname + (location.hash.indexOf('#/') === 0 ? location.hash : '');
    const today = new Date();
    const body = new URLSearchParams({
      'entry.491781665': name,
      'entry.939632120_year': today.getFullYear(),
      'entry.939632120_month': today.getMonth() + 1,
      'entry.939632120_day': today.getDate(),
      'entry.2143428895': 'Both',
      'entry.1942615159': '',
      'entry.269372707': '',
      'entry.2017090049': '[Portal problem] Page: ' + pageName() + ' · View: ' + deptLabel + ' · ' + link + '\n\n' + text,
      'entry.1978739295': 'No',
      'entry.778195494': 'Moderate',
      'entry.834835718': 'Other',
    });
    const btn = document.getElementById('rpSend');
    btn.disabled = true; msg.textContent = 'Sending…';
    try {
      await fetch(FORM_URL, { method: 'POST', mode: 'no-cors', body });
      try { localStorage.removeItem('njtc_pearl_tickets_v1'); } catch (e) {}
      msg.innerHTML = '<span style="color:#047857">✓ Sent — thank you. The Data &amp; Evaluation team will follow up.</span>';
      setTimeout(() => { const ov = document.getElementById('njtcReport'); if (ov) ov.classList.remove('open'); }, 2200);
    } catch (e) {
      btn.disabled = false;
      msg.innerHTML = '<span style="color:#b91c1c">Couldn\'t send — check your connection and try again.</span>';
    }
  }
  window.njtcReportProblem = openReport;

  // ── ⓘ explanations next to key numbers ─────────────────────────────────────
  // njtcTip('text') returns a small ⓘ; hover, tap or keyboard-focus it to read the
  // one-sentence explanation. Pages call it where they draw the number.
  window.njtcTip = function (text) {
    return '<span class="njtc-tip" tabindex="0" role="button" aria-label="' + esc(text) + '" data-tip="' + esc(text) + '">ⓘ</span>';
  };
  let _tipEl = null, _tipFor = null;
  function showTip(t) {
    if (!_tipEl) { _tipEl = document.createElement('div'); _tipEl.className = 'njtc-tip-pop'; _tipEl.setAttribute('role', 'tooltip'); document.body.appendChild(_tipEl); }
    _tipFor = t;
    _tipEl.textContent = t.getAttribute('data-tip');
    _tipEl.style.display = 'block';
    const r = t.getBoundingClientRect(), w = Math.min(280, window.innerWidth - 24);
    _tipEl.style.width = w + 'px';
    const left = Math.max(12, Math.min(window.innerWidth - w - 12, r.left + r.width / 2 - w / 2));
    const h = _tipEl.offsetHeight;
    const top = r.bottom + 8 + h > window.innerHeight ? r.top - h - 8 : r.bottom + 8;
    _tipEl.style.left = left + 'px'; _tipEl.style.top = Math.max(8, top) + 'px';
  }
  function hideTip() { if (_tipEl) _tipEl.style.display = 'none'; _tipFor = null; }
  document.addEventListener('mouseover', e => { const t = e.target.closest && e.target.closest('.njtc-tip'); if (t) showTip(t); });
  document.addEventListener('mouseout', e => { const t = e.target.closest && e.target.closest('.njtc-tip'); if (t && t === _tipFor) hideTip(); });
  document.addEventListener('focusin', e => { const t = e.target.closest && e.target.closest('.njtc-tip'); if (t) showTip(t); });
  document.addEventListener('focusout', e => { if (e.target.closest && e.target.closest('.njtc-tip')) hideTip(); });
  document.addEventListener('click', e => {
    const t = e.target.closest && e.target.closest('.njtc-tip');
    // A tap shows the tip (phones send a hover and a click for one tap, so no toggling);
    // tapping anywhere else closes it.
    if (t) { e.stopPropagation(); showTip(t); return; }
    hideTip();
  }, true);
  // Scrolling (including the small scroll a tap/focus causes) keeps the tip next to its ⓘ;
  // it closes once the ⓘ leaves the screen.
  window.addEventListener('scroll', () => {
    if (!_tipFor || !_tipEl || _tipEl.style.display !== 'block') return;
    const r = _tipFor.getBoundingClientRect();
    if (!_tipFor.isConnected || r.bottom < 0 || r.top > window.innerHeight) hideTip(); else showTip(_tipFor);
  }, { passive: true, capture: true });

  document.addEventListener('click', e => {
    const b = e.target.closest('.njtc-status [data-st]');
    if (!b) return;
    if (b.dataset.st === 'reload') location.reload();
    else if (b.dataset.st === 'report') openReport();
  });

  const css = document.createElement('style');
  css.textContent = `
    .njtc-status{display:flex;flex-wrap:wrap;align-items:center;gap:.35rem .75rem;margin-top:.45rem;font-size:.74rem;color:#64748b}
    .njtc-st-ok{color:#047857;font-weight:600}
    .njtc-st-muted{color:#64748b}
    .njtc-st-warn{color:#b45309;font-weight:600;display:inline-flex;align-items:center;gap:.4rem;flex-wrap:wrap}
    .njtc-st-btn{font:inherit;font-size:.72rem;font-weight:700;border-radius:999px;padding:.15rem .6rem;border:1px solid #cbd5e1;background:#fff;color:#334155;cursor:pointer}
    .njtc-st-report{margin-left:auto;color:#64748b;font-weight:600}
    #njtcReport{position:fixed;inset:0;z-index:20060;background:rgba(10,22,40,.5);display:none;align-items:flex-start;justify-content:center;padding:8vh 1rem 1rem}
    #njtcReport.open{display:flex}
    .rp-box{width:min(520px,100%);background:#fff;border-radius:14px;box-shadow:0 24px 64px rgba(0,0,0,.3);overflow:hidden}
    .rp-hdr{display:flex;justify-content:space-between;align-items:flex-start;gap:1rem;padding:1rem 1.1rem;background:#0a1628;color:#fff}
    .rp-hdr b{display:block;font-size:1rem}.rp-hdr small{font-size:.74rem;opacity:.75}
    .rp-x{border:none;background:rgba(255,255,255,.15);color:#fff;border-radius:8px;width:34px;height:34px;cursor:pointer}
    .rp-body{padding:1rem 1.1rem;display:grid;gap:.8rem}
    .rp-body label{display:grid;gap:.3rem;font-size:.75rem;font-weight:700;color:#475569}
    .rp-body input,.rp-body textarea{font:inherit;font-size:16px;font-weight:400;padding:.5rem .65rem;border:1.5px solid #e2e8f0;border-radius:8px;color:#0f172a;width:100%;box-sizing:border-box}
    .rp-ctx{font-size:.74rem;color:#64748b}
    .rp-actions{display:flex;align-items:center;gap:.75rem;flex-wrap:wrap;font-size:.8rem}
    .rp-send{font:inherit;font-weight:700;padding:.55rem 1.4rem;border:none;border-radius:8px;background:#003087;color:#fff;cursor:pointer}
    .rp-send:disabled{opacity:.6}
    .njtc-tip{display:inline-flex;align-items:center;justify-content:center;width:1.05rem;height:1.05rem;margin-left:.25rem;border-radius:50%;font-size:.7rem;font-weight:700;font-style:normal;color:#64748b;background:#f1f5f9;border:1px solid #cbd5e1;cursor:help;vertical-align:middle;text-transform:none;letter-spacing:0;line-height:1}
    .njtc-tip:hover,.njtc-tip:focus{color:#1d4ed8;border-color:#93c5fd;outline:none}
    .njtc-tip-pop{position:fixed;z-index:20070;display:none;background:#0a1628;color:#fff;font-size:.78rem;line-height:1.45;font-weight:500;padding:.55rem .7rem;border-radius:8px;box-shadow:0 10px 30px rgba(0,0,0,.25);text-transform:none;letter-spacing:0;text-align:left}
    @media (pointer:coarse){ .njtc-tip{width:1.4rem;height:1.4rem;font-size:.8rem} }
  `;
  document.head.appendChild(css);

  // Keep the Data Compass button beside the PIE button (laptops) so PIE never covers it
  function placeCompass() {
    const g = document.getElementById('govBeacon'), p = document.getElementById('pieTrigger');
    if (!g) return;
    if (window.innerWidth <= 640 || !p || getComputedStyle(p).display === 'none') { g.style.right = ''; g.style.bottom = ''; return; }
    const r = p.getBoundingClientRect();
    if (!r.width) return;
    g.style.right = Math.round(window.innerWidth - r.left + 12) + 'px';
    g.style.bottom = Math.round(window.innerHeight - r.bottom + (r.height - 44) / 2) + 'px';
  }
  window.addEventListener('resize', placeCompass, { passive: true });

  setInterval(() => { if (!document.hidden) { render(); placeCompass(); } }, 3000);
  setTimeout(placeCompass, 1200);
  document.addEventListener('click', () => setTimeout(render, 400), true);   // after page switches
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', render); else render();
})();
