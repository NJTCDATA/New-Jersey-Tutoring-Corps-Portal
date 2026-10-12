// ══════════════════════════════════════════════════════════════════════════════
//  HOME — "Your shortcuts" row + "Needs your attention" (per department view)
//  Sits at the top of Department Home. Shortcuts open the pages each team uses
//  every day; "Needs attention" lists only things someone should act on, using
//  the same rules as the page it opens (Support Log, DOL, Field Support Report),
//  so the counts always match.
// ══════════════════════════════════════════════════════════════════════════════
(function () {
  'use strict';

  const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  // ── Navigation helpers ─────────────────────────────────────────────────────
  function nav(panel) {
    if (typeof window.showPanel !== 'function') return;
    window.showPanel(panel, document.querySelector('.sidebar-link[data-panel="' + panel + '"]'));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  // Talent Analytics opens on Profiles after ~300ms for some views — pick the tab after that.
  function talentTab(tab) {
    nav('talent');
    setTimeout(() => { if (typeof window.setTalentTab === 'function') window.setTalentTab(tab); }, 450);
  }
  function fieldSupport(from, to) {
    if (!window.njtcFieldSupport || typeof window.njtcFieldSupport.open !== 'function') { nav('pearl-ops'); return; }
    window.njtcFieldSupport.open('ALL');
    const f = document.getElementById('fsFrom'), t = document.getElementById('fsTo');
    if (f) f.value = from || '';
    if (t) t.value = to || '';
  }
  function execCenter() {
    const el = document.getElementById('execDashboard');
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // ── Shortcuts by department view (order agreed with the Central Team) ─────
  const S = {
    profiles:    { icon: '👤', label: 'Staff Profiles',          go: () => talentTab('profiles') },
    supportLog:  { icon: '📝', label: 'Support Log',             go: () => nav('concern') },
    logConcern:  { icon: '➕', label: 'Log a Concern',           go: () => nav('perf') },
    dol:         { icon: '📊', label: 'DOL Report',              go: () => talentTab('dol') },
    fullLog:     { icon: '📋', label: 'Full Concern Log',        go: () => talentTab('log') },
    policies:    { icon: '📚', label: 'Policies',                go: () => nav('policies') },
    pearl:       { icon: '📊', label: 'Pearl Operations',        go: () => nav('pearl-ops') },
    fieldReport: { icon: '🧭', label: 'Field Support Report',    go: () => fieldSupport() },
    sites:       { icon: '🗺️', label: 'Site Analytics',          go: () => nav('sy-analytics') },
    partnerSat:  { icon: '📋', label: 'Partner Satisfaction',    go: () => nav('survey-feedback') },
    kpi:         { icon: '🎯', label: 'KPI Targets',             go: () => nav('kpi') },
    irb:         { icon: '📊', label: 'Impact Report Builder',   go: () => nav('impact-report') },
    drive:       { icon: '☁️', label: 'Drive Center',            go: () => nav('upload') },
    talent:      { icon: '📊', label: 'Talent Analytics',        go: () => nav('talent') },
    iready:      { icon: '🔬', label: 'i-Ready Lab',             go: () => nav('iready-lab') },
    td:          { icon: '🎓', label: 'T&D Analytics',           go: () => nav('training-analytics') },
    apAnalytics: { icon: '📋', label: 'Apprentice Analytics',    go: () => nav('tap-standalone') },
    tapDash:     { icon: '📋', label: 'TAP Dashboard',           go: () => nav('tap-standalone') },
    trainingMat: { icon: '📚', label: 'Training Materials',      go: () => nav('policies') },
    partnerRisk: { icon: '📊', label: 'Partnership Risk',        go: () => nav('finance-analytics') },
    finPolicies: { icon: '📚', label: 'Finance Policies',        go: () => nav('policies') },
    execCenter:  { icon: '⭐', label: 'Executive Command Center', go: () => execCenter() },
    annual:      { icon: '📘', label: 'Annual Impact Report',    go: () => nav('annual-report') },
  };
  const SHORTCUTS = {
    hr:          ['profiles', 'supportLog', 'logConcern', 'dol', 'fullLog', 'policies'],
    programming: ['pearl', 'fieldReport', 'sites', 'logConcern', 'profiles', 'partnerSat'],
    data:        ['kpi', 'pearl', 'irb', 'drive', 'talent', 'iready'],
    training:    ['td', 'apAnalytics', 'trainingMat', 'kpi'],
    finance:     ['partnerRisk', 'tapDash', 'kpi', 'finPolicies'],
    leadership:  ['execCenter', 'kpi', 'talent', 'tapDash', 'annual', 'drive'],
    kb:          ['execCenter', 'kpi', 'talent', 'tapDash', 'annual', 'drive'],
  };
  const ATTENTION_DEPTS = ['hr', 'programming'];

  // ── Shared name matching (ignores middle names/initials and punctuation) ──
  const toks = n => (n || '').toLowerCase().replace(/[^a-z ]/g, ' ').split(/\s+/).filter(t => t.length > 1);
  const nameKey = n => toks(n).sort().join(' ');
  function nameIndex(names) {
    const exact = new Map(), list = [];
    names.forEach(n => { const k = nameKey(n); if (!k) return; if (!exact.has(k)) exact.set(k, n); list.push({ n, t: toks(n) }); });
    return {
      has(n) {
        const k = nameKey(n); if (!k) return false;
        if (exact.has(k)) return true;
        const t = toks(n);
        if (t.length < 2) return false;
        // All of one name's words inside the other ("Mary Pfund" ↔ "Mary Elizabeth Pfund")
        if (list.some(x => x.t.length >= 2 && (x.t.every(w => t.includes(w)) || t.every(w => x.t.includes(w))))) return true;
        // Same last name + first initial, only when exactly one person fits
        const last = t[t.length - 1], fi = t[0][0];
        return list.filter(x => x.t[x.t.length - 1] === last && x.t[0][0] === fi).length === 1;
      },
    };
  }

  // ── HR: what needs attention ──────────────────────────────────────────────
  const SY_CYCLE = 'school year 26-27';
  let _slOpen = null, _slAt = 0, _slBusy = false;
  function refreshSupportLogOpen() {
    if (_slBusy || typeof window._njtcSupportLogOpen !== 'function') return;
    if (_slOpen && Date.now() - _slAt < 120000) return;
    _slBusy = true;
    window._njtcSupportLogOpen().then(r => { _slOpen = r || []; _slAt = Date.now(); })
      .catch(() => {}).then(() => { _slBusy = false; scheduleRender(); });
  }

  function hrItems() {
    const items = [], loading = [];
    const HR = window.HR_EMPS || [];
    const curSY = typeof window._hrCurSY === 'function' ? window._hrCurSY() : '';
    const syLbl = curSY ? 'SY ' + curSY.slice(2, 4) + '-' + curSY.slice(7, 9) : 'this school year';
    const profileRow = (n, sub) => ({ n, sub, profile: HR.some(e => e.n === n) });

    // 1. Support Log entries waiting on HR (same "Open" count as the Support Log)
    refreshSupportLogOpen();
    if (_slOpen === null) loading.push('Support Log');
    else if (_slOpen.length) {
      items.push({
        icon: '📝', tone: 'red', count: _slOpen.length,
        text: 'Support Log ' + (_slOpen.length === 1 ? 'entry' : 'entries') + ' waiting on HR to resolve',
        rows: _slOpen.slice().sort((a, b) => new Date(b.ts) - new Date(a.ts))
          .map(c => ({ n: c.emp || '—', sub: [(c.ts || '').split(' ')[0], c.concern_label || c.concern_type || ''].filter(Boolean).join(' · '), entry: c })),
        open: 'Open Support Log', go: () => nav('concern'),
      });
    }

    const hrReady = !!window._hrDataFetched && HR.length && curSY;
    if (!hrReady) loading.push('HR Master List');

    // 2. Active staff with 3+ concerns this school year (same matching as profiles)
    if (hrReady && Array.isArray(window.CONCERNS) && typeof window._hrConcernMatches === 'function') {
      const sySOf = window._njtcConcernSY || (() => '');
      const counts = new Map();
      window.CONCERNS.forEach(c => {
        if (!c.emp || sySOf(c) !== curSY) return;
        const emp = HR.find(e => window._hrConcernMatches(e.n, c));
        if (emp) counts.set(emp, (counts.get(emp) || 0) + 1);
      });
      const rows = [...counts.entries()]
        .filter(([e, n]) => n >= 3 && ((e._byYear || {})[curSY] || {}).s === 'Active')
        .sort((a, b) => b[1] - a[1]).map(([e, n]) => profileRow(e.n, n + ' concerns in ' + syLbl));
      if (rows.length) items.push({ icon: '⚠️', tone: 'red', count: rows.length,
        text: 'Active staff with 3 or more concerns in ' + syLbl, rows, open: 'Open Profiles', go: () => talentTab('profiles') });
    }

    // 3–4. Onsite Tracker roster vs ADP (HR Master List rows for the current SY)
    const roster = window._njtcOnsiteRoster2627;
    if (!Array.isArray(roster) || !roster.length) {
      loading.push('Onsite Tracker');
      if (typeof window.fetchLiveOnsiteData === 'function' && !window.__homeOnsiteAsked) {
        window.__homeOnsiteAsked = true;
        Promise.resolve(window.fetchLiveOnsiteData()).catch(() => {}).then(scheduleRender);
      }
    } else if (hrReady) {
      const onRoster = roster.filter(r => (r.cycle || '').toLowerCase().includes(SY_CYCLE)
        && !/^yes$/i.test(r.terminated || '')
        && !/^(no|n\/a|declined)$/i.test((r.offerAccepted || '').trim()));
      const mlRows = HR.map(e => ({ e, y: (e._byYear || {})[curSY] })).filter(x => x.y);
      const withADP = mlRows.filter(x => (x.y.adpHire || '').trim());
      const adpIdx = nameIndex(withADP.map(x => x.e.n));
      const notInADP = onRoster.filter(r => !adpIdx.has(r.name))
        .sort((a, b) => a.name.localeCompare(b.name))
        .map(r => {
          const ml = mlRows.find(x => nameKey(x.e.n) === nameKey(r.name));
          return profileRow(ml ? ml.e.n : r.name, [r.role, r.location || r.district, r.source].filter(Boolean).join(' · ') + (ml ? ' · on Master List, no ADP hire date' : ''));
        });
      if (notInADP.length) items.push({ icon: '🆕', tone: 'amber', count: notInADP.length,
        text: 'On the Onsite Tracker for ' + syLbl + ' with no ADP hire date yet', rows: notInADP,
        open: 'Open DOL Report', go: () => talentTab('dol') });

      const rosterIdx = nameIndex(onRoster.map(r => r.name));
      const notOnRoster = withADP.filter(x => /^active$/i.test(x.y.s || '') && !/pre-?apprentice|\bpace\b/i.test(x.y.r || x.e.r || '') && !rosterIdx.has(x.e.n))
        .map(x => profileRow(x.e.n, [x.y.r || x.e.r, x.y.si || x.e.si].filter(Boolean).join(' · ') + ' · ADP hire ' + x.y.adpHire))
        .sort((a, b) => a.n.localeCompare(b.n));
      if (notOnRoster.length) items.push({ icon: '🔎', tone: 'amber', count: notOnRoster.length,
        text: 'Active in ADP for ' + syLbl + ' but not on the Onsite Tracker', rows: notOnRoster,
        open: 'Open Profiles', go: () => talentTab('profiles') });
    }

    // 5. Separations with no reason recorded (Terminations tab, current SY)
    const terms = window._njtcOnsiteTerms2627;
    if (Array.isArray(terms)) {
      const rows = terms.filter(t => (t.cycle || '').toLowerCase().includes(SY_CYCLE) && !(t.termReason || '').trim())
        .map(t => profileRow(t.name, [t.role, t.termDate ? 'separated ' + t.termDate : 'no termination date'].filter(Boolean).join(' · ')));
      if (rows.length) items.push({ icon: '🚪', tone: 'amber', count: rows.length,
        text: 'Separation' + (rows.length === 1 ? '' : 's') + ' in ' + syLbl + ' with no reason recorded', rows,
        open: 'Open DOL Report', go: () => talentTab('dol') });
    }

    // 6. Last month's DOL numbers are complete (first 10 days of the month)
    const now = new Date();
    if (now.getDate() <= 10) {
      const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      items.push({ icon: '📊', tone: 'blue', count: null,
        text: prev.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) + ' DOL numbers are complete and ready to report',
        open: 'Open DOL Report', go: () => talentTab('dol') });
    }
    return { items, loading };
  }

  // ── Programming: what needs attention (Field Support Report engine) ───────
  let _fsCache = null;
  function fieldSupportResults() {
    const po = window.po, fs = window.njtcFieldSupport;
    if (!po || typeof po.getFieldSupportInput !== 'function' || !fs || typeof fs.computeFieldSupport !== 'function') return null;
    const base = po.getFieldSupportInput('ALL');
    if (!base || !base.attRows || !base.attRows.length) return null;
    const period = typeof po.getActivePeriod === 'function' ? po.getActivePeriod() : '';
    const today = new Date();
    const ymd = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    const wkFrom = ymd(new Date(today.getFullYear(), today.getMonth(), today.getDate() - 6)), wkTo = ymd(today);
    const sig = period + '|' + base.attRows.length + '|' + (base.instRows || []).length + '|' + (base.stuRows || []).length + '|' + wkTo;
    if (_fsCache && _fsCache.sig === sig) return _fsCache;
    const all = fs.computeFieldSupport(Object.assign({}, base, { region: 'ALL', school: '', from: '', to: '' }));
    const week = fs.computeFieldSupport(Object.assign({}, po.getFieldSupportInput('ALL'), { region: 'ALL', school: '', from: wkFrom, to: wkTo }));
    _fsCache = { sig, all, week, wkFrom, wkTo };
    return _fsCache;
  }

  function programmingItems() {
    const items = [], loading = [];
    const F = fieldSupportResults();
    if (!F) { loading.push('Pearl session data'); return { items, loading }; }
    const R = F.all, T = R.totals;
    const UNIT = { incomplete: ['session', 'sessions'], missingTutorSurveys: ['survey', 'surveys'], blankReasons: ['absence', 'absences'] };
    const tutorRows = key => R.tutors.filter(t => t[key] > 0).sort((a, b) => b[key] - a[key])
      .map(t => ({ n: t.tutor, sub: t.school + ' · ' + t[key] + ' ' + UNIT[key][t[key] === 1 ? 0 : 1],
        profile: (window.HR_EMPS || []).some(e => e.n === t.tutor) }));
    if (T.incomplete) items.push({ icon: '⏳', tone: 'red', count: T.incomplete,
      text: 'Incomplete Pearl session' + (T.incomplete === 1 ? '' : 's') + ' (still Scheduled — never completed)', rows: tutorRows('incomplete'),
      open: 'Open Field Support Report', go: () => fieldSupport() });
    if (T.missingTutorSurveys) items.push({ icon: '📝', tone: 'amber', count: T.missingTutorSurveys,
      text: 'Missing tutor survey' + (T.missingTutorSurveys === 1 ? '' : 's'), rows: tutorRows('missingTutorSurveys'),
      open: 'Open Field Support Report', go: () => fieldSupport() });
    if (T.blankReasons) items.push({ icon: '❔', tone: 'amber', count: T.blankReasons,
      text: 'Absence' + (T.blankReasons === 1 ? '' : 's') + ' with no reason entered', rows: tutorRows('blankReasons'),
      open: 'Open Field Support Report', go: () => fieldSupport() });
    const low = F.week.schools.filter(s => s.scholarAttendance !== null && s.scholarAttendance < 80)
      .sort((a, b) => a.scholarAttendance - b.scholarAttendance)
      .map(s => ({ n: s.school, sub: s.scholarAttendance + '% scholar attendance · ' + s.delivered + ' sessions' }));
    if (low.length) items.push({ icon: '📉', tone: 'red', count: low.length,
      text: 'Campus' + (low.length === 1 ? '' : 'es') + ' below the 80% scholar attendance target in the last 7 days', rows: low,
      open: 'Open Field Support Report', go: () => fieldSupport(F.wkFrom, F.wkTo) });
    return { items, loading };
  }

  // ── Rendering ─────────────────────────────────────────────────────────────
  let _dept = '', _items = [], _timer = null, _poll = null, _since = 0;
  const TONE = { red: ['#fef2f2', '#b91c1c', '#fecaca'], amber: ['#fffbeb', '#b45309', '#fde68a'], blue: ['#eff6ff', '#1d4ed8', '#bfdbfe'] };

  function container() {
    let el = document.getElementById('homeShortcuts');
    if (!el) {
      const home = document.getElementById('panel-home');
      const hdr = home && home.querySelector('.page-header');
      if (!hdr) return null;
      el = document.createElement('div'); el.id = 'homeShortcuts';
      hdr.insertAdjacentElement('afterend', el);
    }
    return el;
  }

  function shortcutsHTML(dept) {
    const keys = SHORTCUTS[dept] || [];
    if (!keys.length) return '';
    return `<div class="hs-label">Your shortcuts</div>
      <div class="hs-row">${keys.map(k => `<button class="hs-btn" data-hs-go="${k}"><span class="hs-ic">${S[k].icon}</span>${esc(S[k].label)}</button>`).join('')}</div>`;
  }

  function attentionHTML(dept) {
    if (!ATTENTION_DEPTS.includes(dept)) return '';
    const res = dept === 'hr' ? hrItems() : programmingItems();
    _items = res.items;
    const body = res.items.length
      ? res.items.map((it, i) => {
          const [bg, fg, bd] = TONE[it.tone] || TONE.blue;
          const names = (it.rows || []);
          return `<div class="hs-item" style="border-left-color:${fg}">
            <div class="hs-item-top">
              ${it.count != null ? `<span class="hs-count" style="background:${bg};color:${fg};border-color:${bd}">${it.count}</span>` : `<span class="hs-count" style="background:${bg};color:${fg};border-color:${bd}">${it.icon}</span>`}
              <span class="hs-text">${esc(it.text)}</span>
              <span class="hs-actions">
                ${names.length ? `<button class="hs-link" data-hs-toggle="${i}">Show ${names.length === 1 ? 'name' : 'list'} ▾</button>` : ''}
                <button class="hs-open" data-hs-item="${i}">${esc(it.open)} →</button>
              </span>
            </div>
            ${names.length ? `<div class="hs-names" id="hsNames${i}" style="display:none">${names.map((r, j) => `
              <div class="hs-name">${r.profile ? `<button class="hs-person" data-hs-person="${i}:${j}">${esc(r.n)}</button>` : r.entry ? `<button class="hs-person" data-hs-entry="${i}:${j}">${esc(r.n)}</button>` : `<strong>${esc(r.n)}</strong>`}
                ${r.sub ? `<span class="hs-sub">${esc(r.sub.length > 110 ? r.sub.slice(0, 107).trim() + '…' : r.sub)}</span>` : ''}</div>`).join('')}</div>` : ''}
          </div>`;
        }).join('')
      : (res.loading.length ? '' : `<div class="hs-clear">✅ Nothing needs your attention right now.</div>`);
    if (!_since) _since = Date.now();
    const slow = Date.now() - _since > 90000;
    const load = res.loading.length
      ? `<div class="hs-loading">${slow ? `⚠️ Couldn't load ${esc(res.loading.join(', '))} — some items may be missing. Refresh the page to try again.` : `⏳ Still loading: ${esc(res.loading.join(', '))}…`}</div>`
      : '';
    return `<div class="hs-att">
      <div class="hs-att-hdr">Needs your attention${res.items.length ? ` <span class="hs-att-n">${res.items.length}</span>` : ''}</div>
      ${body}${load}
    </div>`;
  }

  function render(dept) {
    if (dept) _dept = dept;
    if (!_dept) return;
    const el = container();
    if (!el) return;
    // The shortcut row replaces the old below-the-fold quick-link cards.
    const ql = document.getElementById('homeQuickLinks');
    if (ql) ql.style.display = 'none';
    const open = new Set([...el.querySelectorAll('.hs-names')].filter(n => n.style.display !== 'none').map(n => n.id));
    let att = '';
    try { att = attentionHTML(_dept); } catch (e) { console.warn('[Home] attention error:', e); }
    const html = `<div class="hs-wrap">${shortcutsHTML(_dept)}${att}</div>`;
    if (el.__html === html) return;      // nothing changed — keep the DOM (and scroll) as is
    el.__html = html;
    el.innerHTML = html;
    open.forEach(id => { const n = document.getElementById(id); if (n) n.style.display = ''; });
    startPolling();
  }

  function scheduleRender() {
    clearTimeout(_timer);
    _timer = setTimeout(() => {
      const home = document.getElementById('panel-home');
      if (home && home.classList.contains('active')) render();
    }, 300);
  }
  // Data arrives in the background (HR list, Onsite Tracker, Pearl) — refresh the
  // box while Home is on screen; render() skips the DOM when nothing changed.
  function startPolling() {
    if (_poll) return;
    _poll = setInterval(() => { if (!document.hidden) scheduleRender(); }, 5000);
  }

  // One delegated click handler for the whole block
  document.addEventListener('click', ev => {
    const t = ev.target.closest('[data-hs-go],[data-hs-item],[data-hs-toggle],[data-hs-person],[data-hs-entry]');
    if (!t || !t.closest('#homeShortcuts')) return;
    if (t.dataset.hsGo) { const s = S[t.dataset.hsGo]; if (s) s.go(); return; }
    if (t.dataset.hsItem) { const it = _items[+t.dataset.hsItem]; if (it && it.go) it.go(); return; }
    if (t.dataset.hsToggle) {
      const n = document.getElementById('hsNames' + t.dataset.hsToggle);
      if (n) { const show = n.style.display === 'none'; n.style.display = show ? '' : 'none'; t.textContent = (show ? 'Hide ' : 'Show ') + (t.textContent.includes('name') ? 'name' : 'list') + (show ? ' ▴' : ' ▾'); }
      return;
    }
    if (t.dataset.hsPerson) {
      const [i, j] = t.dataset.hsPerson.split(':').map(Number);
      const r = _items[i] && _items[i].rows[j];
      if (r && typeof window._hrShowProfile === 'function') window._hrShowProfile(r.n);
      return;
    }
    if (t.dataset.hsEntry) {
      const [i, j] = t.dataset.hsEntry.split(':').map(Number);
      const r = _items[i] && _items[i].rows[j];
      if (r && r.entry && typeof window._njtcShowConcernEntry === 'function') window._njtcShowConcernEntry(r.entry.ts, r.entry.emp);
    }
  });

  // Styles (scoped to the block)
  const css = document.createElement('style');
  css.textContent = `
    #homeShortcuts{margin:0 0 1.25rem}
    .hs-wrap{display:flex;flex-direction:column;gap:1rem}
    .hs-label,.hs-att-hdr{font-size:.6875rem;font-weight:700;letter-spacing:.07em;text-transform:uppercase;color:var(--muted,#64748b);margin-bottom:.45rem}
    .hs-row{display:flex;flex-wrap:wrap;gap:.5rem}
    .hs-btn{display:inline-flex;align-items:center;gap:.45rem;padding:.55rem .9rem;border-radius:10px;border:1.5px solid var(--border,#e2e8f0);background:var(--surface,#fff);color:var(--navy,#0a1628);font:inherit;font-size:.82rem;font-weight:700;cursor:pointer;box-shadow:0 1px 2px rgba(15,23,42,.05);transition:border-color .15s,transform .15s}
    .hs-btn:hover{border-color:var(--blue-mid,#1a7aff);transform:translateY(-1px)}
    .hs-ic{font-size:1rem;line-height:1}
    .hs-att{background:var(--surface,#fff);border:1px solid var(--border,#e2e8f0);border-radius:12px;padding:.9rem 1rem;box-shadow:0 1px 3px rgba(15,23,42,.05)}
    .hs-att-hdr{display:flex;align-items:center;gap:.4rem;margin-bottom:.6rem}
    .hs-att-n{background:#b91c1c;color:#fff;border-radius:999px;padding:0 .45rem;font-size:.66rem;letter-spacing:0}
    .hs-item{border-left:3px solid;padding:.5rem .1rem .5rem .7rem;margin-bottom:.45rem;border-radius:0 8px 8px 0;background:var(--surface-2,#f8fafc)}
    .hs-item-top{display:flex;align-items:center;gap:.6rem;flex-wrap:wrap}
    .hs-count{min-width:1.9rem;text-align:center;font-weight:800;font-size:.85rem;border:1px solid;border-radius:8px;padding:.1rem .4rem}
    .hs-text{flex:1 1 260px;font-size:.84rem;color:var(--text,#0f172a);font-weight:600}
    .hs-actions{display:flex;gap:.4rem;margin-left:auto;padding-right:.4rem}
    .hs-link,.hs-open{font:inherit;font-size:.74rem;font-weight:700;border-radius:7px;padding:.25rem .6rem;cursor:pointer}
    .hs-link{background:transparent;border:1px solid var(--border,#e2e8f0);color:var(--muted,#64748b)}
    .hs-open{background:var(--navy,#0a1628);border:1px solid var(--navy,#0a1628);color:#fff}
    .hs-names{margin:.5rem .4rem .1rem 2.5rem;max-height:240px;overflow:auto;border-top:1px dashed var(--border,#e2e8f0);padding-top:.4rem}
    .hs-name{display:flex;gap:.6rem;align-items:baseline;flex-wrap:wrap;font-size:.78rem;padding:.18rem 0}
    .hs-person{background:none;border:none;padding:0;font:inherit;font-weight:700;color:#1d4ed8;text-decoration:underline;cursor:pointer}
    .hs-sub{color:var(--muted,#64748b);font-size:.74rem}
    .hs-clear{font-size:.84rem;color:#047857;font-weight:600;padding:.2rem 0}
    .hs-loading{font-size:.74rem;color:var(--muted,#64748b);margin-top:.35rem}
    @media (max-width:640px){.hs-btn{flex:1 1 calc(50% - .5rem);justify-content:flex-start}.hs-actions{margin-left:0}.hs-names{margin-left:.2rem}}
  `;
  document.head.appendChild(css);

  window.njtcHome = { render, refresh: scheduleRender };
  // Home may already be built if this file loads late
  try { if (window._currentDept && document.getElementById('panel-home')) render(window._currentDept); } catch (e) {}
})();
