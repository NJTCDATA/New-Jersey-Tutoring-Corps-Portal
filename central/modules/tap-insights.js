/* ════════════════════════════════════════════════════════════════════════════
   TAP INSIGHTS — SY 26-27  (NJTC Central Portal)
   ────────────────────────────────────────────────────────────────────────────
   One shared, read-only view of every TAP participant, built from the TAP
   Tracker 26-27 workbook:
     • Master Roster            OJT hours / % / phases / month columns / role
     • SY 26-27 Workbook Progress   each person's own OJT workbook (site leader,
                                    workbook %, latest observation, issues)
     • RTI — Knowtion           Knowtion training hours (estimated + time spent)
     • Needs-review tabs        items the sync would not guess at
   It powers:
     1. The APPRENTICE TAG — wherever a staff name appears on any Central page
        (Pearl tables, rosters, profiles), TAP participants get a small tag.
        Clicking it opens a compact card: progress, this month, flags, training.
     2. The TRAINING & DEVELOPMENT HUB panel (#panel-td-hub) — Overview,
        Apprentices, Follow-Up, Training (Knowtion), Site Leaders, About.
   Every number shown comes straight from those tabs — nothing is estimated
   here. Names are joined on the exact Master Roster name the Apps Script
   writes; a name the portal can't match exactly (or uniquely) is not tagged.
   ════════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  // ── Sources ────────────────────────────────────────────────────────────────
  const TAP_ID  = '14UiE5ple1NYVQl5s9U085pFp50vKjnnwNQmsGS0AKJU';
  const WEB_APP = 'https://script.google.com/macros/s/AKfycbwyTmg8rYcOLb56YJuxMqSwjPmd6TiPLDzDvxty_kr-S1RZ12XXRaVgyL7PblFCQ2tU/exec';
  const MR_URL  = `https://docs.google.com/spreadsheets/d/${TAP_ID}/gviz/tq?tqx=out:csv&gid=45498361`;
  const TABS = {
    progress: { sheet: 'SY 26-27 Workbook Progress',     endpoint: 'sy2627_progress', must: 'Directory Name' },
    review:   { sheet: 'SY 26-27 Import — Needs Review', endpoint: 'sy2627_review',   must: 'Issue' },
    rti:      { sheet: 'RTI — Knowtion',                 endpoint: 'rti_knowtion',    must: 'Learner (Knowtion)' },
    rtiMatch: { sheet: 'RTI — Needs Name Match',         endpoint: 'rti_needs_match', must: 'Knowtion Learner' },
  };
  const HUB_DEPTS = ['training', 'programming', 'data', 'leadership', 'kb', 'hr'];
  const CACHE_MS = 3 * 60 * 1000;

  // Master Roster fixed column contract (0-based) — same positions the Apps
  // Script reads/writes (MR_* constants). Months after Aug-26 are appended
  // after "Role Type" as OJT/RTI pairs (tap-automation.gs).
  const MR = { status: 1, first: 2, last: 3, full: 5, usdol: 6, sy: 7, site: 8, region: 9, email: 14,
    ojtHours: 50, rtiHours: 51, ojtPct: 52, yCount: 53, possible: 54, beg: 55, mid: 56, end: 57,
    wage: 58, milestone: 59, complete: 60, track: 99 };
  const STATUS_RE = /^(active|pending|reinstated|cancelled|canceled|terminated|completed|complete|inactive|on hold|paused|withdrawn)$/i;
  const MON = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const MON_LONG = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const WAGE_TIERS = [1100, 2200, 3300, 3800, 4000];

  // ── Small helpers ──────────────────────────────────────────────────────────
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' })[c]);
  const num = v => { const x = parseFloat(String(v == null ? '' : v).replace(/[$,%]/g, '')); return isFinite(x) ? x : 0; };
  const ratio = v => { const n = num(v); return n > 1 ? n / 100 : n; };
  const normName = s => String(s || '').trim().toLowerCase().replace(/\s+/g, ' ');           // = Apps Script _normName
  const looseName = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/\([^)]*\)/g, ' ').replace(/[^a-zA-Z\s'-]/g, ' ').toLowerCase().replace(/\s+/g, ' ').trim();
  const firstLast = s => { const p = looseName(s).split(' ').filter(Boolean); return p.length > 1 ? p[0] + ' ' + p[p.length - 1] : ''; };
  const pctTxt = r => Math.round((r || 0) * 100) + '%';
  const hrs = v => (Math.round(num(v) * 10) / 10).toLocaleString();
  function parseDate(v) {
    const s = String(v || '').trim(); if (!s) return null;
    let m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (m) return new Date(+m[3], +m[1] - 1, +m[2]);
    m = s.match(/^Date\((\d+),(\d+),(\d+)/);               // gviz date literal
    if (m) return new Date(+m[1], +m[2], +m[3]);
    const d = new Date(s); return isNaN(d) ? null : d;
  }
  const fmtDate = d => d ? (d.getMonth() + 1) + '/' + d.getDate() + '/' + d.getFullYear() : '—';
  const daysAgo = d => d ? Math.floor((Date.now() - d.getTime()) / 86400000) : null;
  function monthIndex(d) { return (d.getFullYear() - 2025) * 12 + (d.getMonth() - 2); }      // 0 = Mar-25
  function monthCol(i) { return i < 18 ? 63 + i : 100 + 2 * (i - 18); }                      // Master Roster OJT column

  function parseCsv(text) {
    const rows = []; let row = [], field = '', inQ = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (inQ) { if (c === '"' && text[i + 1] === '"') { field += '"'; i++; } else if (c === '"') inQ = false; else field += c; }
      else if (c === '"') inQ = true;
      else if (c === ',') { row.push(field); field = ''; }
      else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
      else if (c !== '\r') field += c;
    }
    if (field || row.length) { row.push(field); rows.push(row); }
    return rows;
  }
  function toObjects(text, must) {
    const rows = parseCsv(text);
    const h = rows.findIndex(r => r.some(c => String(c).trim() === must));
    if (h < 0) return null;
    const H = rows[h].map(c => String(c).trim());
    return rows.slice(h + 1).filter(r => r.some(c => String(c).trim()))
      .map(r => { const o = {}; H.forEach((k, i) => { if (k) o[k] = String(r[i] == null ? '' : r[i]).trim(); }); return o; });
  }
  async function fetchText(url, ms) {
    const ctl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const t = ctl ? setTimeout(() => ctl.abort(), ms || 25000) : null;
    try { const r = await fetch(url, ctl ? { signal: ctl.signal } : {}); return r.ok ? await r.text() : ''; }
    catch (e) { return ''; } finally { if (t) clearTimeout(t); }
  }
  // Apps Script feed first (exact values + workbook links); gviz by sheet name as backup.
  async function loadTab(key) {
    const t = TABS[key];
    const viaApi = await fetchText(WEB_APP + '?tab=' + t.endpoint + '&_=' + Date.now());
    let objs = viaApi && !viaApi.trim().startsWith('<') ? toObjects(viaApi, t.must) : null;
    if (objs) return { rows: objs, source: 'web app' };
    const viaGviz = await fetchText(`https://docs.google.com/spreadsheets/d/${TAP_ID}/gviz/tq?tqx=out:csv&headers=1&sheet=${encodeURIComponent(t.sheet)}&_=${Date.now()}`);
    objs = viaGviz && !viaGviz.trim().startsWith('<') ? toObjects(viaGviz, t.must) : null;
    return { rows: objs || [], source: objs ? 'sheet' : 'unavailable' };
  }

  function roleOf(track) {
    const t = String(track || '').trim();
    if (!t || /^apprentice/i.test(t)) return 'Apprentice';
    if (/^pre-apprentice/i.test(t)) return 'Pre-apprentice';
    if (/^completed/i.test(t)) return 'Completed Program';
    return 'Tutor';
  }
  const ROLE_STYLE = {
    'Apprentice':        { short: 'Apprentice',  color: '#059669' },
    'Pre-apprentice':    { short: 'Pre-App',     color: '#0891b2' },
    'Completed Program': { short: 'TAP Completed', color: '#7c3aed' },
  };

  // ── Build the data model ───────────────────────────────────────────────────
  let _model = null, _modelTs = 0, _loading = null;

  async function load(force) {
    if (!force && _model && Date.now() - _modelTs < CACHE_MS) return _model;
    if (_loading) return _loading;
    _loading = (async () => {
      const [mrText, progress, review, rti, rtiMatch] = await Promise.all([
        fetchText(MR_URL + '&_=' + Date.now()), loadTab('progress'), loadTab('review'), loadTab('rti'), loadTab('rtiMatch'),
      ]);
      const model = build(mrText, progress, review, rti, rtiMatch);
      _model = model; _modelTs = Date.now(); _loading = null;
      try { window.dispatchEvent(new CustomEvent('njtc-tap-insights', { detail: model })); } catch (e) {}
      return model;
    })().catch(e => { _loading = null; console.warn('[TAP Insights]', e); return _model; });
    return _loading;
  }

  function build(mrText, progress, review, rti, rtiMatch) {
    const today = new Date();
    const curIdx = monthIndex(today);
    // "This month" rule: during the first 10 days of a month we look at the
    // previous full month instead, so nobody is flagged on the 2nd of the month
    // just because observations haven't been entered yet.
    const fDate = today.getDate() <= 10 ? new Date(today.getFullYear(), today.getMonth() - 1, 1) : new Date(today.getFullYear(), today.getMonth(), 1);
    const focus = { idx: monthIndex(fDate), label: MON_LONG[fDate.getMonth()] + ' ' + fDate.getFullYear(), short: MON[fDate.getMonth()], long: MON_LONG[fDate.getMonth()], isPrev: today.getDate() <= 10 };
    const curLabel = focus.label;
    const get = (r, i) => String(r[i] == null ? '' : r[i]).trim();

    // Master Roster (positional, content-detected data rows — same rule as the TAP Dashboard)
    const people = [];
    if (mrText && !mrText.trim().startsWith('<')) {
      parseCsv(mrText).forEach(r => {
        if (!STATUS_RE.test(get(r, MR.status))) return;
        const name = get(r, MR.full) || (get(r, MR.first) + ' ' + get(r, MR.last)).trim();
        if (name.length < 2) return;
        const months = {};
        for (let i = 0; i <= curIdx; i++) {
          const d = new Date(2025, 2 + i, 1);
          months[MON[d.getMonth()] + '-' + String(d.getFullYear()).slice(-2)] = num(get(r, monthCol(i)));
        }
        const prevD = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        people.push({
          name, key: normName(name), status: get(r, MR.status), site: get(r, MR.site), region: get(r, MR.region),
          usdol: get(r, MR.usdol), email: get(r, MR.email), track: get(r, MR.track), role: roleOf(get(r, MR.track)),
          ojtHours: num(get(r, MR.ojtHours)), rtiOfficial: num(get(r, MR.rtiHours)), ojtPct: ratio(get(r, MR.ojtPct)),
          yCount: num(get(r, MR.yCount)), possible: num(get(r, MR.possible)),
          beg: ratio(get(r, MR.beg)), mid: ratio(get(r, MR.mid)), end: ratio(get(r, MR.end)),
          milestone: get(r, MR.milestone), months,
          curMonthHrs: num(get(r, monthCol(focus.idx))),     // hours in the FOCUS month (see rule above)
          prevMonthHrs: curIdx > 0 ? num(get(r, monthCol(monthIndex(prevD)))) : 0,
          progress: null, rti: null, flags: [],
        });
      });
    }
    const byKey = {}; people.forEach(p => { byKey[p.key] = p; });

    // Workbook progress → person (exact Master Roster name written by the sync)
    const progUnlinked = [];
    let progSynced = null;
    progress.rows.forEach(r => {
      const p = byKey[normName(r['Master Roster Name'])];
      const synced = parseDate(r['Last Synced']); if (synced && (!progSynced || synced > progSynced)) progSynced = synced;
      if (p) p.progress = r; else progUnlinked.push(r);
    });
    // Knowtion → person
    let rtiSynced = null;
    rti.rows.forEach(r => {
      const s = parseDate(r['Last Synced']); if (s && (!rtiSynced || s > rtiSynced)) rtiSynced = s;
      const p = r['Roster Name'] ? byKey[normName(r['Roster Name'])] : null;
      if (p) p.rti = r;
    });

    // Flags — fixed, deterministic rules (see "About the data" tab)
    const tapPeople = people.filter(p => /active|reinstated/i.test(p.status) && p.role !== 'Tutor');
    tapPeople.forEach(p => {
      const f = p.flags, inTraining = p.role === 'Apprentice' || p.role === 'Pre-apprentice';
      const pr = p.progress;
      if (inTraining && p.curMonthHrs === 0)
        f.push({ level: 'amber', code: 'no-month', text: 'No OJT activity logged in ' + curLabel + (focus.isPrev ? '' : ' (so far)'), plain: 'Nothing checked off on their checklist in ' + focus.long + (focus.isPrev ? '' : ' so far') });
      if (!pr) {
        f.push({ level: 'info', code: 'not-sy', text: 'Not on the SY 26-27 OJT list (no school-year workbook)', plain: 'Not on this year’s checklist list (summer only)' });
      } else {
        const issues = pr['Issues'] || '';
        if (/no ojt workbook link|could not open|no ojt checklist tab/i.test(issues))
          f.push({ level: 'red', code: 'workbook', text: "OJT workbook can't be read — " + issues.split('|')[0].trim(), plain: 'We can’t open their checklist — the link is missing or broken' });
        const last = parseDate(pr['Latest Observation']);
        const d = daysAgo(last);
        if (inTraining && !/no ojt workbook link|could not open/i.test(issues) && (last === null || d > 30))
          f.push({ level: 'red', code: 'stale-obs', text: last ? 'No new observation in ' + d + ' days (last ' + fmtDate(last) + ')' : 'No dated observation in the SY 26-27 workbook', plain: last ? 'Not observed in ' + d + ' days' : 'No observations recorded yet this school year' });
        const bad = num(pr['Y With Invalid Date (counted, no month)']), nod = num(pr['Y With No Date (counted, no month)']);
        if (bad > 0) f.push({ level: 'amber', code: 'dates', text: bad + ' checkmark' + (bad > 1 ? 's' : '') + ' with an impossible date in the workbook', plain: 'Some checklist dates need fixing' });
        if (nod > 0) f.push({ level: 'amber', code: 'dates', text: nod + ' checkmark' + (nod > 1 ? 's' : '') + ' with no date in the workbook', plain: 'Some checklist items are missing a date' });
      }
      if (!p.rti) f.push({ level: 'amber', code: 'kn-none', text: 'No Knowtion training on record (or name not matched yet)', plain: 'No online training (Knowtion) on record yet' });
      else {
        const lc = parseDate(p.rti['Last Completed']); const dd = daysAgo(lc);
        if (lc && dd > 21) f.push({ level: 'amber', code: 'kn-stale', text: 'No Knowtion training completed in ' + dd + ' days', plain: 'No online training in ' + dd + ' days' });
      }
      if (p.role === 'Apprentice') {
        const next = WAGE_TIERS.find(t => p.ojtHours < t);
        if (next && next - p.ojtHours <= 100)
          f.push({ level: 'info', code: 'milestone', text: (next - p.ojtHours) + ' OJT hrs from the ' + next + '-hour wage milestone', plain: 'Close to a pay milestone' });
      }
      const order = { red: 0, amber: 1, info: 2 };
      f.sort((a, b) => order[a.level] - order[b.level]);
    });

    // Name index for tagging: exact, de-parenthesized, and first+last (unique only)
    const index = {}, ambiguous = {};
    const add = (k, p) => { if (!k) return; if (index[k] && index[k] !== p) ambiguous[k] = true; else index[k] = p; };
    people.filter(p => /active|reinstated/i.test(p.status)).forEach(p => {
      add(normName(p.name), p); add(looseName(p.name), p); add(firstLast(p.name), p);
      const alias = (p.name.match(/\(([^)]+)\)/) || [])[1];
      if (alias) { const parts = looseName(p.name).split(' '); add(looseName(alias) + ' ' + parts[parts.length - 1], p); }
      if (p.rti && p.rti['Learner (Knowtion)']) add(looseName(p.rti['Learner (Knowtion)']), p);
      if (p.progress && p.progress['Directory Name']) add(looseName(p.progress['Directory Name']), p);
    });
    Object.keys(ambiguous).forEach(k => delete index[k]);

    return {
      today, curLabel, focus, people, tapPeople, byKey, index, progUnlinked,
      progress: progress.rows, review: review.rows, rti: rti.rows, rtiMatch: rtiMatch.rows,
      sources: { progress: progress.source, review: review.source, rti: rti.source, rtiMatch: rtiMatch.source, mr: people.length ? 'sheet' : 'unavailable' },
      progSynced, rtiSynced,
    };
  }

  function lookup(name) {
    if (!_model) return null;
    const ix = _model.index;
    return ix[normName(name)] || ix[looseName(name)] || ix[firstLast(name)] || null;
  }

  // ── Shared UI bits ─────────────────────────────────────────────────────────
  const LVL = { red: { bg: '#fef2f2', fg: '#b91c1c', bd: '#fecaca' }, amber: { bg: '#fffbeb', fg: '#b45309', bd: '#fde68a' }, info: { bg: '#eff6ff', fg: '#1d4ed8', bd: '#bfdbfe' } };
  function flagPill(f) { const c = LVL[f.level]; return `<span style="display:inline-block;background:${c.bg};color:${c.fg};border:1px solid ${c.bd};border-radius:999px;padding:.1rem .5rem;font-size:.68rem;font-weight:600;margin:.1rem .15rem .1rem 0">${esc(f.text)}</span>`; }
  function rolePill(role) { const s = ROLE_STYLE[role]; if (!s) return ''; return `<span style="background:${s.color}1a;color:${s.color};font-size:.65rem;font-weight:700;padding:.12rem .45rem;border-radius:4px;white-space:nowrap">${esc(role)}</span>`; }
  function bar(r, color) { const p = Math.max(0, Math.min(100, Math.round((r || 0) * 100))); return `<div style="height:6px;background:#eef1f6;border-radius:3px;overflow:hidden"><div style="height:6px;width:${p}%;background:${color}"></div></div>`; }
  function flagSummary(p) {
    const red = p.flags.filter(f => f.level === 'red').length, amber = p.flags.filter(f => f.level === 'amber').length;
    return red ? 'red' : amber ? 'amber' : 'ok';
  }

  function personCard(p, full) {
    const pr = p.progress || {}, r = p.rti || {};
    const last = parseDate(pr['Latest Observation']);
    const wbUrl = pr['Workbook URL'] || '';
    const kn = p.rti
      ? `<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:.4rem;margin-top:.35rem">
           ${miniStat(hrs(r['Estimated Hours']), 'Knowtion est. hrs')}${miniStat(hrs(r['Time Spent Hours']), 'Time spent hrs')}${miniStat(hrs(r['Course 3 (RTI) Estimated Hours']) + ' / ' + hrs(r['Course 3 (RTI) Time Spent Hours']), 'Course 3 est / spent')}
         </div>
         <div style="font-size:.68rem;color:var(--muted,#7d8fa1);margin-top:.25rem">${num(r['Items Completed'])} items · last completed ${fmtDate(parseDate(r['Last Completed']))}</div>`
      : `<div style="font-size:.75rem;color:var(--muted,#7d8fa1)">No Knowtion training on record.</div>`;
    return `
      <div style="font-family:inherit;color:var(--text,#0d1b2a)">
        <div style="display:flex;align-items:center;gap:.5rem;flex-wrap:wrap;margin-bottom:.35rem">
          <strong style="font-size:${full ? '1.05rem' : '.92rem'}">${esc(p.name)}</strong>${rolePill(p.role)}
        </div>
        <div style="font-size:.72rem;color:var(--muted,#7d8fa1);margin-bottom:.6rem">${esc(p.site || 'No site listed')}${pr['Site Leader'] ? ' · Site leader: ' + esc(pr['Site Leader']) : ''}${p.usdol ? ' · USDOL ' + esc(p.usdol) : ''}</div>
        <div style="display:flex;justify-content:space-between;font-size:.72rem;font-weight:600;margin-bottom:.2rem"><span>OJT ${p.ojtHours.toLocaleString()} / 4,000 hrs</span><span>${pctTxt(p.ojtPct)} of activities</span></div>
        ${bar(p.ojtHours / 4000, '#059669')}
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:.4rem;margin-top:.55rem">
          ${miniStat(pctTxt(p.beg), 'Beginning')}${miniStat(pctTxt(p.mid), 'Middle')}${miniStat(pctTxt(p.end), 'End')}
        </div>
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:.4rem;margin-top:.4rem">
          ${miniStat(p.curMonthHrs.toLocaleString(), 'OJT hrs ' + _model.focus.short)}${miniStat(last ? fmtDate(last) : '—', 'Latest observation')}${miniStat(pr['Workbook %'] !== undefined && pr['Workbook %'] !== '' ? pctTxt(ratio(pr['Workbook %'])) : '—', 'SY 26-27 workbook')}
        </div>
        <div style="font-size:.7rem;font-weight:700;text-transform:uppercase;letter-spacing:.04em;color:var(--muted,#7d8fa1);margin:.7rem 0 .2rem">Training (Knowtion)</div>
        ${kn}
        <div style="font-size:.7rem;font-weight:700;text-transform:uppercase;letter-spacing:.04em;color:var(--muted,#7d8fa1);margin:.7rem 0 .25rem">Flags</div>
        <div>${p.flags.length ? p.flags.map(flagPill).join('') : '<span style="font-size:.75rem;color:#059669;font-weight:600">✓ No flags</span>'}</div>
        <div style="display:flex;gap:.4rem;flex-wrap:wrap;margin-top:.75rem">
          ${wbUrl ? `<a href="${esc(wbUrl)}" target="_blank" rel="noopener" class="btn btn-secondary btn-sm" style="text-decoration:none">Open OJT workbook ↗</a>` : ''}
          ${!full && hubAllowed() ? `<button class="btn btn-primary btn-sm" onclick="NJTC_TAP.openInHub(${esc(JSON.stringify(p.name))})">Open in T&amp;D Hub</button>` : ''}
        </div>
      </div>`;
  }
  function miniStat(v, l) { return `<div style="background:var(--surface-2,#f6f8fc);border:1px solid var(--border-2,#eef1f6);border-radius:8px;padding:.35rem .45rem"><div style="font-size:.85rem;font-weight:800">${v}</div><div style="font-size:.62rem;color:var(--muted,#7d8fa1);font-weight:600">${l}</div></div>`; }

  function currentDept() { return window._currentDept || window.NJTC_VIEW_DEPT || (window.NJTC_SESSION || {}).dept || ''; }
  function hubAllowed() { return HUB_DEPTS.includes(currentDept()); }

  // ── 1. Apprentice tag (any page, any department) ───────────────────────────
  let _pop = null;
  function closePop() { if (_pop) { _pop.remove(); _pop = null; } }
  function openPop(anchor, p) {
    closePop();
    _pop = document.createElement('div');
    _pop.className = 'tapi-pop';
    _pop.style.cssText = 'position:fixed;z-index:10050;width:340px;max-width:calc(100vw - 24px);max-height:80vh;overflow:auto;background:#fff;border:1px solid #dde3ec;border-radius:12px;box-shadow:0 12px 32px rgba(10,22,40,.18);padding:.9rem 1rem';
    _pop.innerHTML = `<button aria-label="Close" onclick="NJTC_TAP.closePop()" style="position:absolute;top:.4rem;right:.55rem;border:none;background:none;font-size:1.1rem;cursor:pointer;color:#7d8fa1">×</button>` +
      (lens() === 'td' ? personCard(p, false) : plainDetail(p) + (hubAllowed() ? `<button class="btn btn-primary btn-sm" style="margin-top:.6rem" onclick="NJTC_TAP.openInHub(${esc(JSON.stringify(p.name))})">See all apprentices</button>` : ''));
    document.body.appendChild(_pop);
    const r = anchor.getBoundingClientRect();
    const top = Math.min(window.innerHeight - _pop.offsetHeight - 12, r.bottom + 6);
    const left = Math.min(window.innerWidth - _pop.offsetWidth - 12, Math.max(12, r.left));
    _pop.style.top = Math.max(12, top) + 'px'; _pop.style.left = left + 'px';
  }
  document.addEventListener('click', e => { if (_pop && !e.target.closest('.tapi-pop') && !e.target.closest('.tapi-tag')) closePop(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closePop(); });

  function tagHtml(p) {
    const s = ROLE_STYLE[p.role]; const st = flagSummary(p);
    const dot = st === 'red' ? '#dc2626' : st === 'amber' ? '#d97706' : '';
    return `<span class="tapi-tag" role="button" tabindex="0" title="TAP ${esc(p.role)} — click for progress" data-tapi-name="${esc(p.name)}" style="display:inline-flex;align-items:center;gap:.2rem;margin-left:.35rem;vertical-align:middle;background:${s.color}14;color:${s.color};border:1px solid ${s.color}55;border-radius:999px;padding:0 .4rem;font-size:.6rem;font-weight:800;letter-spacing:.02em;line-height:1.5;cursor:pointer;white-space:nowrap">TAP · ${esc(s.short)}${dot ? `<span style="width:6px;height:6px;border-radius:50%;background:${dot};display:inline-block"></span>` : ''}</span>`;
  }
  document.addEventListener('click', e => {
    const t = e.target.closest('.tapi-tag'); if (!t) return;
    e.preventDefault(); e.stopPropagation();
    const p = lookup(t.getAttribute('data-tapi-name')); if (p) openPop(t, p);
  }, true);

  const SKIP = '.tapi-tag,.tapi-pop,input,textarea,select,option,script,style,button,#panel-td-hub,.ct-sidebar,svg,canvas';
  const TEXT_SEL = 'td,span,a,strong,b,div,li,h3,h4,h5,p,label';
  function tagWithin(root) {
    if (!_model || !root || !root.querySelectorAll) return;
    const els = root.matches && root.matches(TEXT_SEL) ? [root] : [];
    root.querySelectorAll(TEXT_SEL).forEach(el => els.push(el));
    for (const el of els) {
      if (el.childElementCount !== 0 || el.hasAttribute('data-tapi')) continue;
      const txt = (el.textContent || '').trim();
      if (txt.length < 4 || txt.length > 60 || !/[a-z]/i.test(txt) || !/\s/.test(txt)) continue;
      if (el.closest(SKIP)) continue;
      el.setAttribute('data-tapi', '1');
      const p = lookup(txt);
      if (p && p.role !== 'Tutor' && /active|reinstated/i.test(p.status)) el.insertAdjacentHTML('beforeend', tagHtml(p));
    }
  }
  let _pending = new Set(), _timer = null;
  function queue(node) { _pending.add(node); if (!_timer) _timer = setTimeout(flush, 350); }
  function flush() {
    _timer = null; const nodes = Array.from(_pending); _pending.clear();
    nodes.forEach(n => { if (n.isConnected) tagWithin(n); });
  }
  function startTagging() {
    const main = document.querySelector('.ct-main') || document.body;
    tagWithin(main);
    new MutationObserver(muts => {
      for (const m of muts) m.addedNodes.forEach(n => { if (n.nodeType === 1 && !n.closest('.tapi-tag,.tapi-pop')) queue(n); });
    }).observe(main, { childList: true, subtree: true });
  }

  // ── 2. Training & Development Hub ──────────────────────────────────────────
  let _tab = null, _lens = null, _filters = { role: 'Apprentice', q: '', flagged: false, kRole: 'Tutor', kq: '', pRole: 'TAP', pAttention: false, pGroup: 'leader', pq: '' };
  // Who sees which view by default. Program-facing teams get the plain view;
  // T&D (Ashley's team) and the data/leadership lenses get full detail.
  const LENS_DEFAULT = { training: 'td', data: 'td', leadership: 'td', kb: 'td', programming: 'program', hr: 'program' };
  const LENS_SWITCH = ['data', 'leadership', 'kb', 'training', 'programming'];
  // Flags the Program team can act on (payroll and data-matching items stay with T&D).
  const PROGRAM_FLAGS = ['workbook', 'stale-obs', 'no-month', 'dates', 'kn-none', 'kn-stale'];
  function lens() { if (!_lens) _lens = LENS_DEFAULT[currentDept()] || 'program'; return _lens; }
  const TD_TABS = [['overview','📊 Overview'],['apprentices','🎓 Apprentices'],['followup','🚩 Follow-Up'],['training','📚 Training (Knowtion)'],['leaders','🧭 Site Leaders'],['about','ℹ️ About the data']];
  const PG_TABS = [['p-glance','👋 At a glance'],['p-people','🎓 Our apprentices'],['p-leaders','🧭 By site leader'],['p-training','📚 Online training'],['p-help','❓ How to read this']];

  function hubShell() {
    const tabs = lens() === 'td' ? TD_TABS : PG_TABS;
    const canSwitch = LENS_SWITCH.includes(currentDept());
    return `
      ${canSwitch ? `<div style="display:flex;align-items:center;gap:.4rem;margin-bottom:.75rem;font-size:.75rem;color:var(--muted)">View:
        <button class="pst-tab ${lens() === 'td' ? 'active' : ''}" onclick="NJTC_TAP.setLens('td')">Training &amp; Development (full detail)</button>
        <button class="pst-tab ${lens() === 'program' ? 'active' : ''}" onclick="NJTC_TAP.setLens('program')">Program Team (simple)</button></div>` : ''}
      <div id="tdhTabs" style="display:flex;gap:.5rem;flex-wrap:wrap;margin-bottom:1.25rem;padding-bottom:.875rem;border-bottom:2px solid var(--border)">
        ${tabs.map(([k, l]) => `<button class="pst-tab ${_tab === k ? 'active' : ''}" data-tab="${k}" onclick="NJTC_TAP.hubTab('${k}')">${l}</button>`).join('')}
      </div>
      <div id="tdhBody"></div>`;
  }
  function renderHub() {
    const root = document.getElementById('tdHubRoot'); if (!root) return;
    if (!_model) { root.innerHTML = loadingHtml(); load().then(() => renderHub()); return; }
    const tabs = lens() === 'td' ? TD_TABS : PG_TABS;
    if (!_tab || !tabs.some(t => t[0] === _tab)) _tab = tabs[0][0];
    if (!document.getElementById('tdhTabs') || root.getAttribute('data-lens') !== lens()) { root.innerHTML = hubShell(); root.setAttribute('data-lens', lens()); }
    document.querySelectorAll('#tdhTabs .pst-tab').forEach(b => b.classList.toggle('active', b.getAttribute('data-tab') === _tab));
    const title = document.getElementById('tdHubTitle'), sub = document.getElementById('tdHubSubtitle');
    if (title) title.textContent = lens() === 'td' ? 'Training & Development Hub' : 'Apprentice Progress — Program Team';
    if (sub) sub.textContent = lens() === 'td'
      ? 'SY 26-27 apprentice OJT progress, Knowtion training hours, follow-ups and data quality — one place, straight from the TAP Tracker.'
      : 'How our apprentices are doing this school year: who has been observed, who needs attention, and who has done their online training.';
    const body = document.getElementById('tdhBody');
    const stamp = document.getElementById('tdHubStamp');
    if (stamp) stamp.textContent = 'Workbooks synced ' + (_model.progSynced ? fmtDate(_model.progSynced) : '—') + ' · Knowtion synced ' + (_model.rtiSynced ? fmtDate(_model.rtiSynced) : '—');
    const R = { overview: rOverview, apprentices: rApprentices, followup: rFollowUp, training: rTraining, leaders: rLeaders, about: rAbout,
      'p-glance': pGlance, 'p-people': pPeople, 'p-leaders': pLeaders, 'p-training': pTraining, 'p-help': pHelp }[_tab] || rOverview;
    body.innerHTML = sourceWarning() + R();
  }
  function loadingHtml() { return '<div style="padding:2rem;text-align:center;color:var(--muted)"><div class="td-spinner" style="margin:0 auto 1rem"></div>Loading SY 26-27 TAP and training data…</div>'; }
  function sourceWarning() {
    const s = _model.sources, miss = Object.keys(s).filter(k => s[k] === 'unavailable');
    if (!miss.length) return '';
    const names = { mr: 'Master Roster', progress: 'Workbook Progress', review: 'Needs Review', rti: 'RTI — Knowtion', rtiMatch: 'RTI — Needs Name Match' };
    return `<div style="background:#fffbeb;border:1px solid #fde68a;color:#92400e;border-radius:8px;padding:.6rem .8rem;font-size:.78rem;margin-bottom:1rem">⚠️ Could not load: ${miss.map(k => names[k]).join(', ')}. Numbers below exclude that source. Check that the TAP Tracker is shared “Anyone with the link can view” and the web app is deployed.</div>`;
  }
  function kpi(v, l, sub, color) { return `<div style="background:var(--surface,#fff);border:1px solid var(--border);border-radius:12px;padding:.9rem 1rem"><div style="font-size:1.6rem;font-weight:800;color:${color || 'var(--text)'}">${v}</div><div style="font-size:.74rem;font-weight:700;color:var(--text-2)">${l}</div>${sub ? `<div style="font-size:.68rem;color:var(--muted);margin-top:.15rem">${sub}</div>` : ''}</div>`; }
  function grid(cells, min) { return `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(${min || 160}px,1fr));gap:.75rem;margin-bottom:1.25rem">${cells.join('')}</div>`; }
  function section(t, sub) { return `<div style="margin:1.25rem 0 .5rem"><div style="font-size:.95rem;font-weight:800">${t}</div>${sub ? `<div style="font-size:.74rem;color:var(--muted)">${sub}</div>` : ''}</div>`; }
  function table(head, rows, opts) {
    return `<div style="overflow-x:auto;border:1px solid var(--border);border-radius:10px;background:var(--surface,#fff)"><table style="width:100%;border-collapse:collapse;font-size:.78rem">
      <thead><tr style="background:var(--surface-2)">${head.map(h => `<th style="text-align:${h.r ? 'right' : 'left'};padding:.5rem .6rem;font-size:.68rem;text-transform:uppercase;letter-spacing:.03em;color:var(--muted);white-space:nowrap;border-bottom:1px solid var(--border)">${h.t}</th>`).join('')}</tr></thead>
      <tbody>${rows.length ? rows.join('') : `<tr><td colspan="${head.length}" style="padding:1rem;text-align:center;color:var(--muted)">${(opts && opts.empty) || 'Nothing to show.'}</td></tr>`}</tbody></table></div>`;
  }
  const td = (v, r) => `<td style="padding:.45rem .6rem;border-bottom:1px solid var(--border-2);${r ? 'text-align:right;' : ''}vertical-align:top">${v}</td>`;

  function rOverview() {
    const m = _model, act = m.tapPeople;
    const ap = act.filter(p => p.role === 'Apprentice'), pre = act.filter(p => p.role === 'Pre-apprentice'), done = act.filter(p => p.role === 'Completed Program');
    const training = ap.concat(pre);
    const avg = list => list.length ? list.reduce((s, p) => s + p.ojtPct, 0) / list.length : 0;
    const monthHrs = training.reduce((s, p) => s + p.curMonthHrs, 0);
    const noMonth = training.filter(p => p.curMonthHrs === 0).length;
    const linked = m.progress.filter(r => r['Workbook URL'] || /open workbook/i.test(r['OJT Workbook'] || '') || r['Checklist Tab Read']).length;
    const red = act.filter(p => flagSummary(p) === 'red').length, amber = act.filter(p => flagSummary(p) === 'amber').length;
    const kn = m.rti, tutorsK = kn.filter(r => !/^site leader/i.test(r['Role'] || '')), slK = kn.filter(r => /^site leader/i.test(r['Role'] || ''));
    const sum = (list, col) => list.reduce((s, r) => s + num(r[col]), 0);
    const progs = {};
    kn.forEach(r => Object.keys(r).forEach(k => {
      const mm = k.match(/^(.*) — Est Hrs$/); if (!mm || /^Outside SY/i.test(mm[1])) return;
      const pg = mm[1], e = num(r[k]), s = num(r[pg + ' — Spent Hrs']);
      if (!progs[pg]) progs[pg] = { learners: 0, est: 0, spent: 0 };
      if (e || s) progs[pg].learners++; progs[pg].est += e; progs[pg].spent += s;
    }));
    const monthsK = [];
    if (kn.length) Object.keys(kn[0]).forEach(k => { const mm = k.match(/^([A-Z][a-z]{2}-\d{2}) Est Hrs$/); if (mm) monthsK.push(mm[1]); });
    const mRows = monthsK.map(lbl => ({ lbl, est: sum(kn, lbl + ' Est Hrs'), spent: sum(kn, lbl + ' Spent Hrs') })).filter(x => x.est || x.spent);
    const maxM = Math.max(1, ...mRows.map(x => x.est));
    return `
      ${section('TAP participants · SY 26-27', 'Active people on the Master Roster, by program role')}
      ${grid([
        kpi(ap.length, 'Apprentices', 'avg ' + pctTxt(avg(ap)) + ' of OJT activities', '#059669'),
        kpi(pre.length, 'Pre-apprentices', 'avg ' + pctTxt(avg(pre)) + ' of OJT activities', '#0891b2'),
        kpi(done.length, 'Completed Program', 'returning, already finished TAP', '#7c3aed'),
        kpi(monthHrs.toLocaleString(), 'OJT hrs logged in ' + m.focus.long, noMonth + ' of ' + training.length + ' apprentices/pre-apprentices with none' + (m.focus.isPrev ? '' : ' yet'), noMonth ? '#b45309' : '#059669'),
        kpi(linked + ' / ' + m.progress.length, 'SY 26-27 workbooks read', 'from the SY 26-27 OJT list'),
        kpi(red + ' · ' + amber, 'Need follow-up', 'urgent · watch — see Follow-Up', red ? '#b91c1c' : '#b45309'),
      ])}
      ${section('Training hours (Knowtion) · SY 26-27', 'Estimated = Knowtion’s planned time per item · Time spent = time logged on the Knowtion page')}
      ${grid([
        kpi(tutorsK.length, 'Learners in tutor courses', hrs(sum(tutorsK, 'Estimated Hours')) + ' est · ' + hrs(sum(tutorsK, 'Time Spent Hours')) + ' spent hrs · includes staff who took the courses'),
        kpi(slK.length, 'Site leaders with training', hrs(sum(slK, 'Estimated Hours')) + ' est · ' + hrs(sum(slK, 'Time Spent Hours')) + ' spent hrs'),
        kpi(hrs(sum(kn, 'Course 3 (RTI) Estimated Hours')), 'Course 3 (RTI) est. hrs', hrs(sum(kn, 'Course 3 (RTI) Time Spent Hours')) + ' hrs time spent', '#b45309'),
        kpi(num(sum(kn, 'Items Completed')).toLocaleString(), 'Items completed', sum(kn, 'Items Missing Estimate') + ' with no estimate'),
      ])}
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:1rem">
        <div>${section('By program')}${table([{ t: 'Program' }, { t: 'Learners', r: 1 }, { t: 'Est. hrs', r: 1 }, { t: 'Time spent', r: 1 }, { t: 'Spent / est', r: 1 }],
          Object.keys(progs).sort((a, b) => progs[b].est - progs[a].est).map(pg => { const x = progs[pg]; return `<tr>${td(esc(pg))}${td(x.learners, 1)}${td(hrs(x.est), 1)}${td(hrs(x.spent), 1)}${td(x.est ? Math.round(x.spent / x.est * 100) + '%' : '—', 1)}</tr>`; }))}</div>
        <div>${section('By month')}${table([{ t: 'Month' }, { t: 'Estimated vs time spent' }, { t: 'Est.', r: 1 }, { t: 'Spent', r: 1 }],
          mRows.map(x => `<tr>${td(x.lbl)}${td(`<div style="height:8px;background:#ede9fe;border-radius:4px;width:${Math.round(x.est / maxM * 100)}%"><div style="height:8px;background:#7c3aed;border-radius:4px;width:${x.est ? Math.round(x.spent / x.est * 100) : 0}%"></div></div>`)}${td(hrs(x.est), 1)}${td(hrs(x.spent), 1)}</tr>`))}</div>
      </div>`;
  }

  function apprRows(list) {
    return list.map(p => {
      const pr = p.progress || {}, r = p.rti;
      const last = parseDate(pr['Latest Observation']);
      return `<tr style="cursor:pointer" onclick="NJTC_TAP.showPerson(${esc(JSON.stringify(p.name))})">
        ${td(`<strong>${esc(p.name)}</strong><div style="margin-top:.15rem">${rolePill(p.role)}</div>`)}
        ${td(esc(p.site || '—') + (pr['Site Leader'] ? `<div style="font-size:.68rem;color:var(--muted)">SL: ${esc(pr['Site Leader'])}</div>` : ''))}
        ${td(p.ojtHours.toLocaleString(), 1)}${td(pctTxt(p.ojtPct), 1)}
        ${td(`<span style="font-size:.7rem">${pctTxt(p.beg)} · ${pctTxt(p.mid)} · ${pctTxt(p.end)}</span>`, 1)}
        ${td(p.curMonthHrs ? p.curMonthHrs.toLocaleString() : '<span style="color:#b45309;font-weight:700">0</span>', 1)}
        ${td(last ? fmtDate(last) : '—', 1)}
        ${td(pr['Workbook %'] !== undefined && pr['Workbook %'] !== '' ? pctTxt(ratio(pr['Workbook %'])) : '—', 1)}
        ${td(r ? hrs(r['Estimated Hours']) + ' / ' + hrs(r['Time Spent Hours']) : '—', 1)}
        ${td(r ? hrs(r['Course 3 (RTI) Estimated Hours']) + ' / ' + hrs(r['Course 3 (RTI) Time Spent Hours']) : '—', 1)}
        ${td(esc(p.role === 'Apprentice' ? (p.milestone || 'Base') : '—'))}
        ${td(p.flags.length ? p.flags.map(flagPill).join('') : '<span style="color:#059669;font-weight:600">✓</span>')}
      </tr>`;
    });
  }
  function filteredAppr() {
    const f = _filters, q = looseName(f.q);
    return _model.tapPeople
      .filter(p => f.role === 'All' || p.role === f.role)
      .filter(p => !q || looseName(p.name).indexOf(q) >= 0 || looseName(p.site).indexOf(q) >= 0 || looseName((p.progress || {})['Site Leader']).indexOf(q) >= 0)
      .filter(p => !f.flagged || p.flags.some(x => x.level !== 'info'))
      .sort((a, b) => { const o = { red: 0, amber: 1, ok: 2 }; return o[flagSummary(a)] - o[flagSummary(b)] || a.name.localeCompare(b.name); });
  }
  function rApprentices() {
    const counts = r => _model.tapPeople.filter(p => r === 'All' || p.role === r).length;
    const list = filteredAppr();
    return `
      <div style="display:flex;gap:.5rem;flex-wrap:wrap;align-items:center;margin-bottom:.9rem">
        ${['Apprentice', 'Pre-apprentice', 'Completed Program', 'All'].map(r => `<button class="pst-tab ${_filters.role === r ? 'active' : ''}" onclick="NJTC_TAP.setFilter('role','${r}')">${r} (${counts(r)})</button>`).join('')}
        <label style="font-size:.78rem;display:flex;align-items:center;gap:.3rem;margin-left:.5rem"><input type="checkbox" ${_filters.flagged ? 'checked' : ''} onchange="NJTC_TAP.setFilter('flagged',this.checked)"> Needs follow-up only</label>
        <input type="search" placeholder="Search name, site or site leader…" value="${esc(_filters.q)}" oninput="NJTC_TAP.setFilter('q',this.value,true)" style="margin-left:auto;padding:.4rem .6rem;border:1px solid var(--border);border-radius:8px;font-size:.8rem;min-width:220px">
        <button class="btn btn-secondary btn-sm" onclick="NJTC_TAP.exportCsv('apprentices')">⬇ CSV</button>
      </div>
      <div id="tdhApprTable">${table([{ t: 'Name' }, { t: 'Site' }, { t: 'OJT hrs', r: 1 }, { t: 'OJT %', r: 1 }, { t: 'Beg · Mid · End', r: 1 }, { t: 'OJT hrs ' + _model.focus.short, r: 1 }, { t: 'Latest obs.', r: 1 }, { t: 'SY workbook', r: 1 }, { t: 'Knowtion est / spent', r: 1 }, { t: 'Course 3 est / spent', r: 1 }, { t: 'Wage milestone' }, { t: 'Flags' }],
        apprRows(list), { empty: 'No one matches these filters.' })}</div>
      <div style="font-size:.7rem;color:var(--muted);margin-top:.5rem">Click a row for the full card. OJT hours, % and phases come from the Master Roster (summer + school-year activity combined). “SY workbook” is the % read from the person’s SY 26-27 workbook.</div>`;
  }

  function followItems() {
    const items = [];
    _model.tapPeople.forEach(p => p.flags.forEach(f => {
      if (f.level === 'info' && f.code !== 'milestone') return;
      const pr = p.progress || {};
      items.push({ level: f.level, code: f.code, name: p.name, role: p.role, site: p.site, contact: pr['Site Leader'] || '', supervisor: pr['Supervisor of SL'] || '', text: f.text, action: ACTION[f.code] || '' });
    }));
    _model.progUnlinked.forEach(r => items.push({ level: 'red', code: 'not-roster', name: r['Directory Name'], role: (r['Role (directory)'] || '').trim(), site: '', contact: r['Site Leader'] || '', supervisor: r['Supervisor of SL'] || '', text: 'On the SY 26-27 OJT list but not on the Master Roster — their workbook is not being read', action: ACTION['not-roster'] }));
    _model.rtiMatch.forEach(r => items.push({ level: 'amber', code: 'name-match', name: r['Knowtion Learner'], role: r['Role'] || 'Tutor', site: '', contact: '', supervisor: '', text: 'Knowtion name not linked to the roster' + (r['Possible Roster Name (check — not applied)'] ? ' (possible: ' + r['Possible Roster Name (check — not applied)'] + ')' : ''), action: ACTION['name-match'] }));
    const o = { red: 0, amber: 1, info: 2 };
    return items.sort((a, b) => o[a.level] - o[b.level] || a.code.localeCompare(b.code) || a.name.localeCompare(b.name));
  }
  const ACTION = {
    'workbook': 'Ask the Onsite team to put a working link to their OJT workbook on the SY 26-27 OJT tab.',
    'stale-obs': 'Ask the site leader to observe and mark completed activities (with dates) in the workbook.',
    'no-month': 'Confirm observations are happening this month; the nightly sync picks up new Y marks.',
    'dates': 'Ask the site leader to fix the date cells in the workbook (full date with year).',
    'kn-none': 'Check Knowtion enrollment, or add their Knowtion name on the “RTI Name Map” tab.',
    'kn-stale': 'Check in on Knowtion progress.',
    'milestone': 'Heads-up for payroll: a wage milestone is close (email goes automatically when reached).',
    'not-roster': 'Add them (with email) to Staffing SY 2026-2027 so the sync can create their roster row.',
    'name-match': 'If they are a TAP tutor, add their Knowtion name and Master Roster name to the “RTI Name Map” tab.',
  };
  const GROUPS = [['workbook', 'Workbook can’t be read'], ['not-roster', 'Not on the Master Roster'], ['stale-obs', 'No recent observation (30+ days)'], ['no-month', 'No OJT logged this month'], ['dates', 'Date fixes needed in workbook'], ['kn-none', 'No Knowtion training on record'], ['kn-stale', 'Knowtion: no recent training'], ['name-match', 'Knowtion name needs a match'], ['milestone', 'Close to a wage milestone']];
  function rFollowUp() {
    const items = followItems();
    const by = {}; items.forEach(i => (by[i.code] = by[i.code] || []).push(i));
    return `
      <div style="display:flex;gap:.5rem;align-items:center;margin-bottom:.9rem;flex-wrap:wrap">
        <div style="font-size:.8rem;color:var(--text-2)"><strong>${items.filter(i => i.level === 'red').length}</strong> urgent · <strong>${items.filter(i => i.level === 'amber').length}</strong> to watch · grouped by what needs to happen. Contacts come from the SY 26-27 OJT list.</div>
        <button class="btn btn-secondary btn-sm" style="margin-left:auto" onclick="NJTC_TAP.exportCsv('followup')">⬇ Follow-up CSV</button>
      </div>
      ${GROUPS.filter(([c]) => by[c]).map(([c, title]) => `
        <details ${['workbook', 'not-roster', 'stale-obs'].includes(c) ? 'open' : ''} style="border:1px solid var(--border);border-radius:10px;background:var(--surface,#fff);margin-bottom:.6rem">
          <summary style="cursor:pointer;padding:.65rem .8rem;font-weight:700;font-size:.85rem">${esc(title)} <span style="color:var(--muted);font-weight:600">(${by[c].length})</span><div style="font-weight:400;font-size:.72rem;color:var(--muted)">${esc(ACTION[c] || '')}</div></summary>
          <div style="padding:0 .8rem .8rem">${table([{ t: 'Name' }, { t: 'Role' }, { t: 'Detail' }, { t: 'Site leader' }, { t: 'Supervisor' }],
            by[c].map(i => `<tr>${td(`<strong>${esc(i.name)}</strong>`)}${td(esc(i.role))}${td(esc(i.text))}${td(esc(i.contact || '—'))}${td(esc(i.supervisor || '—'))}</tr>`))}</div>
        </details>`).join('') || '<div style="padding:1.5rem;text-align:center;color:#059669;font-weight:700">✓ Nothing needs follow-up right now.</div>'}`;
  }

  function rTraining() {
    const f = _filters, q = looseName(f.kq);
    const list = _model.rti
      .filter(r => f.kRole === 'All' || (f.kRole === 'Tutor' ? !/^site leader/i.test(r['Role'] || '') : /^site leader/i.test(r['Role'] || '')))
      .filter(r => !q || looseName(r['Learner (Knowtion)']).indexOf(q) >= 0 || looseName(r['Roster Name']).indexOf(q) >= 0)
      .sort((a, b) => num(b['Estimated Hours']) - num(a['Estimated Hours']));
    const cnt = k => _model.rti.filter(r => k === 'All' || (k === 'Tutor' ? !/^site leader/i.test(r['Role'] || '') : /^site leader/i.test(r['Role'] || ''))).length;
    return `
      <div style="display:flex;gap:.5rem;flex-wrap:wrap;align-items:center;margin-bottom:.9rem">
        ${['Tutor', 'Site Leader', 'All'].map(k => `<button class="pst-tab ${f.kRole === k ? 'active' : ''}" onclick="NJTC_TAP.setFilter('kRole','${k}')">${k === 'Tutor' ? 'Tutors' : k === 'Site Leader' ? 'Site leaders' : 'Everyone'} (${cnt(k)})</button>`).join('')}
        <input type="search" placeholder="Search learner…" value="${esc(f.kq)}" oninput="NJTC_TAP.setFilter('kq',this.value,true)" style="margin-left:auto;padding:.4rem .6rem;border:1px solid var(--border);border-radius:8px;font-size:.8rem;min-width:200px">
        <button class="btn btn-secondary btn-sm" onclick="NJTC_TAP.exportCsv('training')">⬇ CSV</button>
      </div>
      <div id="tdhTrainTable">${table([{ t: 'Learner (Knowtion)' }, { t: 'Roster name' }, { t: 'Role' }, { t: 'Items', r: 1 }, { t: 'Est. hrs', r: 1 }, { t: 'Time spent', r: 1 }, { t: 'Spent / est', r: 1 }, { t: 'Course 3 est / spent', r: 1 }, { t: 'No estimate', r: 1 }, { t: 'Last completed', r: 1 }],
        list.map(r => { const p = r['Roster Name'] ? _model.byKey[normName(r['Roster Name'])] : null;
          return `<tr>${td(`<strong>${esc(r['Learner (Knowtion)'])}</strong>`)}${td(r['Roster Name'] ? esc(r['Roster Name']) + (p && p.role !== 'Tutor' ? ' ' + rolePill(p.role) : '') : '<span style="color:#b45309">not linked</span>')}${td(esc(r['Role']))}${td(num(r['Items Completed']), 1)}${td(hrs(r['Estimated Hours']), 1)}${td(hrs(r['Time Spent Hours']), 1)}${td(num(r['Estimated Hours']) ? Math.round(num(r['Time Spent Hours']) / num(r['Estimated Hours']) * 100) + '%' : '—', 1)}${td(hrs(r['Course 3 (RTI) Estimated Hours']) + ' / ' + hrs(r['Course 3 (RTI) Time Spent Hours']), 1)}${td(num(r['Items Missing Estimate']) || '', 1)}${td(fmtDate(parseDate(r['Last Completed'])), 1)}</tr>`; }),
        { empty: 'No Knowtion records yet — run “RTI: Sync Knowtion Hours Now” in the TAP Tracker.' })}</div>
      <div style="font-size:.7rem;color:var(--muted);margin-top:.5rem">Time spent is time logged on the Knowtion page; live workshops, site visits and outside trainings (e.g., Praesidium) show little or none. NJTC has not yet decided which number counts toward the 288 RTI hours — the official RTI total on the Master Roster is unchanged.</div>`;
  }

  function rLeaders() {
    const leaders = {};
    _model.tapPeople.forEach(p => {
      const sl = ((p.progress || {})['Site Leader'] || '').trim(); if (!sl) return;
      const L = leaders[sl] = leaders[sl] || { name: sl, people: [], last: null };
      L.people.push(p);
      const d = parseDate((p.progress || {})['Latest Observation']); if (d && (!L.last || d > L.last)) L.last = d;
    });
    const slK = {}; _model.rti.filter(r => /^site leader/i.test(r['Role'] || '')).forEach(r => { slK[firstLast(r['Learner (Knowtion)'])] = r; });
    const rows = Object.values(leaders).sort((a, b) => b.people.filter(p => flagSummary(p) === 'red').length - a.people.filter(p => flagSummary(p) === 'red').length || a.name.localeCompare(b.name));
    return `
      ${section('Site leader coverage', 'TAP participants each site leader observes (from the SY 26-27 OJT list), with their own Knowtion training')}
      ${table([{ t: 'Site leader' }, { t: 'TAP participants', r: 1 }, { t: 'Urgent', r: 1 }, { t: 'Watch', r: 1 }, { t: 'OJT hrs ' + _model.focus.short, r: 1 }, { t: 'Most recent observation', r: 1 }, { t: 'Own training est / spent', r: 1 }, { t: 'People' }],
        rows.map(L => { const k = slK[firstLast(L.name)];
          return `<tr>${td(`<strong>${esc(L.name)}</strong>`)}${td(L.people.length, 1)}${td(L.people.filter(p => flagSummary(p) === 'red').length || '', 1)}${td(L.people.filter(p => flagSummary(p) === 'amber').length || '', 1)}${td(L.people.reduce((s, p) => s + p.curMonthHrs, 0).toLocaleString(), 1)}${td(fmtDate(L.last), 1)}${td(k ? hrs(k['Estimated Hours']) + ' / ' + hrs(k['Time Spent Hours']) : '—', 1)}${td(L.people.map(p => `<span style="white-space:nowrap">${esc(p.name)}${flagSummary(p) === 'red' ? ' 🔴' : flagSummary(p) === 'amber' ? ' 🟠' : ''}</span>`).join(', '))}</tr>`; }))}`;
  }

  function rAbout() {
    const s = _model.sources;
    const li = (t, d) => `<li style="margin-bottom:.45rem"><strong>${t}</strong> — ${d}</li>`;
    return `<div style="max-width:860px;font-size:.84rem;line-height:1.6;color:var(--text-2)">
      ${section('Where the numbers come from')}
      <ul style="padding-left:1.1rem">
        ${li('Master Roster (TAP Tracker 26-27)', 'OJT hours, OJT %, phase %, monthly OJT hours, wage milestone and program role. 50 OJT hours per completed checklist activity; summer and school-year activity combined, each activity counted once. Source: ' + s.mr + '.')}
        ${li('SY 26-27 Workbook Progress', 'each person’s own SY 26-27 OJT workbook as read by the nightly sync: site leader, workbook %, latest observation date, issues. Source: ' + s.progress + '.')}
        ${li('RTI — Knowtion', 'Knowtion completions for tutors and site leaders. Estimated = Knowtion’s planned time per item; Time spent = time on the Knowtion page. Course 3 (RTI) excludes the staff “(Master)” copies. Source: ' + s.rti + '.')}
        ${li('Needs Review / Needs Name Match', 'items the sync would not guess at (unreadable workbooks, impossible dates, unmatched names).')}
      </ul>
      ${section('Flag rules')}
      <ul style="padding-left:1.1rem">
        ${li('🔴 Workbook can’t be read', 'no working link on the SY 26-27 OJT tab, or the workbook/checklist tab can’t be opened.')}
        ${li('🔴 No recent observation', 'apprentice or pre-apprentice whose latest dated observation in the SY 26-27 workbook is more than 30 days ago (or none).')}
        ${li('🔴 Not on the Master Roster', 'on the SY 26-27 OJT list but no roster row, so nothing is read for them.')}
        ${li('🟠 No OJT logged in the month', 'apprentice or pre-apprentice with 0 OJT hours in the Master Roster column for the month. During the first 10 days of a month this checks the previous full month, so people aren’t flagged before observations are entered.')}
        ${li('🟠 Date fixes', 'checkmarks with no date or an impossible date — still counted in totals, but not placed in a month.')}
        ${li('🟠 Knowtion', 'no Knowtion record linked, or no completion in 21+ days.')}
        ${li('🔵 Wage milestone close', 'apprentice within 100 OJT hours of the next wage milestone (the email to finance is sent automatically when it is reached).')}
      </ul>
      ${section('The TAP tag')}
      <p>Anywhere a staff member’s full name appears in the portal (Pearl tables, rosters, profiles), TAP participants get a tag: <strong>Apprentice</strong>, <strong>Pre-App</strong> or <strong>TAP Completed</strong>. A red or amber dot means they have a follow-up flag; click the tag for their card. Names are matched exactly to the Master Roster — a name that could belong to two people is never tagged.</p>
      <p style="font-size:.75rem;color:var(--muted)">Workbooks last synced ${_model.progSynced ? fmtDate(_model.progSynced) : '—'} · Knowtion last synced ${_model.rtiSynced ? fmtDate(_model.rtiSynced) : '—'} · Data loaded ${new Date(_modelTs).toLocaleString()}</p>
    </div>`;
  }


  // ════════════════════════════════════════════════════════════════════════
  //  PROGRAM TEAM VIEW — plain language, fewer numbers, people-first.
  // ════════════════════════════════════════════════════════════════════════
  const ACTS = p => Math.round(p.curMonthHrs / 50);                       // 50 OJT hrs = 1 checklist activity
  function lastSeen(p) {
    const d = parseDate((p.progress || {})['Latest Observation']);
    if (!d) return { txt: 'Not yet this school year', days: null };
    const n = daysAgo(d);
    return { txt: n <= 0 ? 'Today' : n === 1 ? 'Yesterday' : n + ' days ago', days: n, date: d };
  }
  function pFlags(p) { return p.flags.filter(f => PROGRAM_FLAGS.includes(f.code)); }
  function pStatus(p) {
    const f = pFlags(p);
    if (f.some(x => x.level === 'red')) return { t: 'Needs attention', c: '#b91c1c', bg: '#fef2f2' };
    if (f.length) return { t: 'Keep an eye on', c: '#b45309', bg: '#fffbeb' };
    return { t: 'On track', c: '#047857', bg: '#ecfdf5' };
  }
  function trainingWord(p) {
    if (!p.rti) return { t: 'Not started', c: '#b91c1c' };
    const d = daysAgo(parseDate(p.rti['Last Completed']));
    return d !== null && d > 21 ? { t: 'Slowed down', c: '#b45309' } : { t: 'Active', c: '#047857' };
  }
  function pPeopleList() {
    const f = _filters, q = looseName(f.pq);
    return _model.tapPeople
      .filter(p => f.pRole === 'TAP' ? p.role !== 'Completed Program' : f.pRole === 'All' ? true : p.role === f.pRole)
      .filter(p => !q || looseName(p.name).indexOf(q) >= 0 || looseName(p.site).indexOf(q) >= 0 || looseName((p.progress || {})['Site Leader']).indexOf(q) >= 0)
      .filter(p => !f.pAttention || pFlags(p).length);
  }
  function plainCard(p, compact) {
    const st = pStatus(p), seen = lastSeen(p), tw = trainingWord(p), acts = ACTS(p);
    const done = Math.round(p.yCount), poss = Math.round(p.possible) || 80;
    return `<div style="background:var(--surface,#fff);border:1px solid var(--border,#dde3ec);border-left:4px solid ${st.c};border-radius:10px;padding:.75rem .85rem;${compact ? '' : 'cursor:pointer'}" ${compact ? '' : `onclick="NJTC_TAP.showPerson(${esc(JSON.stringify(p.name))})"`}>
      <div style="display:flex;justify-content:space-between;gap:.5rem;align-items:flex-start">
        <div><div style="font-weight:800;font-size:.9rem">${esc(p.name)}</div><div style="font-size:.7rem;color:var(--muted,#7d8fa1)">${esc(p.site || 'Site not listed')}</div></div>
        <span style="background:${st.bg};color:${st.c};font-size:.66rem;font-weight:800;padding:.15rem .5rem;border-radius:999px;white-space:nowrap">${st.t}</span>
      </div>
      <div style="margin:.55rem 0 .2rem;font-size:.75rem;font-weight:600">Checklist: ${done} of ${poss} activities done</div>
      ${bar(poss ? done / poss : 0, '#059669')}
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:.35rem .75rem;margin-top:.55rem;font-size:.74rem">
        <div><span style="color:var(--muted,#7d8fa1)">${esc(_model.focus.long)}:</span> <strong style="color:${acts ? '#047857' : '#b45309'}">${acts ? acts + ' activit' + (acts > 1 ? 'ies' : 'y') : 'Nothing checked off'}</strong></div>
        <div><span style="color:var(--muted,#7d8fa1)">Last observed:</span> <strong style="color:${seen.days === null || seen.days > 30 ? '#b91c1c' : 'inherit'}">${seen.txt}</strong></div>
        <div><span style="color:var(--muted,#7d8fa1)">Online training:</span> <strong style="color:${tw.c}">${tw.t}</strong></div>
        <div>${rolePill(p.role)}</div>
      </div>
      ${pFlags(p).length ? `<ul style="margin:.5rem 0 0;padding-left:1rem;font-size:.73rem;color:${st.c}">${pFlags(p).map(f => `<li>${esc(f.plain || f.text)}</li>`).join('')}</ul>` : ''}
    </div>`;
  }
  function plainDetail(p) {
    const pr = p.progress || {}, seen = lastSeen(p), r = p.rti;
    const row = (l, v) => `<div style="display:flex;justify-content:space-between;gap:1rem;padding:.35rem 0;border-bottom:1px solid var(--border-2,#eef1f6);font-size:.8rem"><span style="color:var(--muted,#7d8fa1)">${l}</span><strong style="text-align:right">${v}</strong></div>`;
    return `${plainCard(p, true)}
      <div style="margin-top:.75rem">
        ${row('Site leader', esc(pr['Site Leader'] || '—'))}
        ${row('Checklist progress (all program stages)', pctTxt(p.ojtPct))}
        ${row('Beginning · Middle · End stages', pctTxt(p.beg) + ' · ' + pctTxt(p.mid) + ' · ' + pctTxt(p.end))}
        ${row('Activities checked off in ' + esc(_model.focus.long), ACTS(p))}
        ${row('Last observed', seen.date ? fmtDate(seen.date) + ' (' + seen.txt + ')' : seen.txt)}
        ${row('Online training (Knowtion) — planned hours', r ? hrs(r['Estimated Hours']) : '—')}
        ${row('Online training — hours on Knowtion', r ? hrs(r['Time Spent Hours']) : '—')}
        ${row('Last online training', r ? fmtDate(parseDate(r['Last Completed'])) : '—')}
      </div>
      ${pr['Workbook URL'] ? `<a href="${esc(pr['Workbook URL'])}" target="_blank" rel="noopener" class="btn btn-secondary btn-sm" style="text-decoration:none;margin-top:.75rem;display:inline-block">Open their checklist ↗</a>` : ''}`;
  }

  function pGlance() {
    const all = _model.tapPeople.filter(p => p.role !== 'Completed Program');
    const observedMonth = all.filter(p => p.curMonthHrs > 0).length;
    const needs = all.filter(p => pStatus(p).t === 'Needs attention');
    const watch = all.filter(p => pStatus(p).t === 'Keep an eye on');
    const trained = all.filter(p => p.rti).length;
    const big = (v, l, sub, c) => `<div style="background:var(--surface,#fff);border:1px solid var(--border);border-radius:14px;padding:1rem 1.1rem"><div style="font-size:2rem;font-weight:800;color:${c}">${v}</div><div style="font-size:.85rem;font-weight:700">${l}</div><div style="font-size:.74rem;color:var(--muted)">${sub}</div></div>`;
    return `
      <div style="font-size:.85rem;color:var(--text-2);margin-bottom:1rem">Our <strong>${all.length}</strong> apprentices and pre-apprentices this school year, as of today.</div>
      ${grid([
        big(observedMonth + ' of ' + all.length, 'Had checklist activity in ' + _model.focus.long, _model.focus.isPrev ? 'Last full month (it’s early in ' + MON_LONG[_model.today.getMonth()] + ')' : 'Activities checked off so far this month', observedMonth === all.length ? '#047857' : '#b45309'),
        big(needs.length, 'Need attention now', 'Not observed in 30+ days, or we can’t open their checklist', needs.length ? '#b91c1c' : '#047857'),
        big(watch.length, 'Keep an eye on', 'Smaller things to check — see their cards', '#b45309'),
        big(trained + ' of ' + all.length, 'Have done online training', 'Knowtion courses this school year', '#0891b2'),
      ], 200)}
      ${section('Who needs attention first', 'Sorted so the most urgent are at the top. Click a name for details.')}
      ${needs.length ? `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(270px,1fr));gap:.75rem">${needs.sort((a, b) => (lastSeen(b).days === null ? 999 : lastSeen(b).days) - (lastSeen(a).days === null ? 999 : lastSeen(a).days)).map(p => plainCard(p)).join('')}</div>`
        : '<div style="padding:1rem;color:#047857;font-weight:700">✓ No one needs urgent attention right now.</div>'}`;
  }
  function pPeople() {
    const f = _filters, list = pPeopleList();
    const groups = {};
    list.forEach(p => { const k = (f.pGroup === 'leader' ? (p.progress || {})['Site Leader'] : p.site) || (f.pGroup === 'leader' ? 'No site leader listed' : 'No site listed'); (groups[k] = groups[k] || []).push(p); });
    const order = { 'Needs attention': 0, 'Keep an eye on': 1, 'On track': 2 };
    const cnt = r => _model.tapPeople.filter(p => r === 'TAP' ? p.role !== 'Completed Program' : r === 'All' ? true : p.role === r).length;
    return `
      <div style="display:flex;gap:.5rem;flex-wrap:wrap;align-items:center;margin-bottom:1rem">
        ${[['TAP', 'Apprentices & pre-apprentices'], ['Apprentice', 'Apprentices'], ['Pre-apprentice', 'Pre-apprentices'], ['Completed Program', 'Already completed'], ['All', 'Everyone']].map(([k, l]) => `<button class="pst-tab ${f.pRole === k ? 'active' : ''}" onclick="NJTC_TAP.setFilter('pRole','${k}')">${l} (${cnt(k)})</button>`).join('')}
      </div>
      <div style="display:flex;gap:.75rem;flex-wrap:wrap;align-items:center;margin-bottom:1rem;font-size:.8rem">
        <label style="display:flex;align-items:center;gap:.3rem"><input type="checkbox" ${f.pAttention ? 'checked' : ''} onchange="NJTC_TAP.setFilter('pAttention',this.checked)"> Only show who needs attention</label>
        <span>Group by: <select onchange="NJTC_TAP.setFilter('pGroup',this.value)" style="padding:.3rem .5rem;border:1px solid var(--border);border-radius:6px"><option value="leader" ${f.pGroup === 'leader' ? 'selected' : ''}>Site leader</option><option value="site" ${f.pGroup === 'site' ? 'selected' : ''}>Site</option></select></span>
        <input type="search" placeholder="Find a name or site…" value="${esc(f.pq)}" oninput="NJTC_TAP.setFilter('pq',this.value,true)" style="margin-left:auto;padding:.4rem .6rem;border:1px solid var(--border);border-radius:8px;min-width:200px">
      </div>
      <div id="tdhPeople">${Object.keys(groups).sort().map(g => `
        <div style="margin-bottom:1.1rem">
          <div style="font-weight:800;font-size:.88rem;margin-bottom:.45rem">${esc(g)} <span style="color:var(--muted);font-weight:600">· ${groups[g].length}</span></div>
          <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(270px,1fr));gap:.75rem">${groups[g].sort((a, b) => order[pStatus(a).t] - order[pStatus(b).t] || a.name.localeCompare(b.name)).map(p => plainCard(p)).join('')}</div>
        </div>`).join('') || '<div style="padding:1rem;color:var(--muted)">No one matches.</div>'}</div>`;
  }
  function pLeaders() {
    const L = {};
    _model.tapPeople.filter(p => p.role !== 'Completed Program').forEach(p => {
      const k = (p.progress || {})['Site Leader'] || 'No site leader listed';
      const x = L[k] = L[k] || { name: k, people: [] }; x.people.push(p);
    });
    const rows = Object.values(L).map(x => {
      const seen = x.people.filter(p => p.curMonthHrs > 0).length, need = x.people.filter(p => pStatus(p).t === 'Needs attention').length;
      const lasts = x.people.map(p => lastSeen(p).date).filter(Boolean).sort((a, b) => b - a);
      return { x, seen, need, last: lasts[0] || null };
    }).sort((a, b) => b.need - a.need || a.x.name.localeCompare(b.x.name));
    return `${section('How each site leader’s apprentices are doing', 'Use this for check-ins with site leaders.')}
      ${table([{ t: 'Site leader' }, { t: 'Apprentices' , r: 1}, { t: 'Had activity in ' + _model.focus.long, r: 1 }, { t: 'Need attention', r: 1 }, { t: 'Most recent observation', r: 1 }, { t: 'Who' }],
        rows.map(({ x, seen, need, last }) => `<tr>${td(`<strong>${esc(x.name)}</strong>`)}${td(x.people.length, 1)}${td(seen + ' of ' + x.people.length, 1)}${td(need ? `<strong style="color:#b91c1c">${need}</strong>` : '0', 1)}${td(last ? fmtDate(last) + ' (' + daysAgo(last) + ' days ago)' : '—', 1)}${td(x.people.map(p => `<a href="javascript:void(0)" onclick="NJTC_TAP.showPerson(${esc(JSON.stringify(p.name))})" style="color:${pStatus(p).c};font-weight:600;white-space:nowrap">${esc(p.name)}</a>`).join(', '))}</tr>`))}`;
  }
  function pTraining() {
    const list = _model.tapPeople.filter(p => p.role !== 'Completed Program').sort((a, b) => ({ 'Not started': 0, 'Slowed down': 1, 'Active': 2 })[trainingWord(a).t] - ({ 'Not started': 0, 'Slowed down': 1, 'Active': 2 })[trainingWord(b).t] || a.name.localeCompare(b.name));
    const c = w => list.filter(p => trainingWord(p).t === w).length;
    return `
      <div style="font-size:.85rem;color:var(--text-2);margin-bottom:1rem">Online training happens in <strong>Knowtion</strong>. “Planned hours” is how long the courses they finished are meant to take; “hours on Knowtion” is the time Knowtion recorded (live workshops don’t count there, so it’s usually lower).</div>
      ${grid([kpi(c('Active'), 'Active', 'trained in the last 3 weeks', '#047857'), kpi(c('Slowed down'), 'Slowed down', 'nothing in 3+ weeks', '#b45309'), kpi(c('Not started'), 'Not started', 'no online training on record', '#b91c1c')], 180)}
      ${table([{ t: 'Name' }, { t: 'Status' }, { t: 'Courses finished', r: 1 }, { t: 'Planned hours', r: 1 }, { t: 'Hours on Knowtion', r: 1 }, { t: 'Last training', r: 1 }],
        list.map(p => { const r = p.rti, w = trainingWord(p); return `<tr>${td(`<strong>${esc(p.name)}</strong> ${rolePill(p.role)}`)}${td(`<span style="color:${w.c};font-weight:700">${w.t}</span>`)}${td(r ? num(r['Items Completed']) : '—', 1)}${td(r ? hrs(r['Estimated Hours']) : '—', 1)}${td(r ? hrs(r['Time Spent Hours']) : '—', 1)}${td(r ? fmtDate(parseDate(r['Last Completed'])) : '—', 1)}</tr>`; }))}
      <div style="font-size:.72rem;color:var(--muted);margin-top:.5rem">“Not started” can also mean their name in Knowtion is spelled differently — the Training &amp; Development team matches those.</div>`;
  }
  function pHelp() {
    const li = (t, d) => `<li style="margin-bottom:.55rem"><strong>${t}</strong> — ${d}</li>`;
    return `<div style="max-width:780px;font-size:.88rem;line-height:1.65;color:var(--text-2)">
      ${section('What this page shows')}
      <p>Every apprentice has a checklist of 80 on-the-job activities. Their site leader observes them and checks activities off. This page reads those checklists every night and shows how each person is doing. It also shows the online training they have finished in Knowtion.</p>
      ${section('What the colors mean')}
      <ul style="padding-left:1.1rem">
        ${li('<span style="color:#b91c1c">Needs attention</span>', 'they haven’t been observed in more than 30 days, or we can’t open their checklist. Reach out to their site leader.')}
        ${li('<span style="color:#b45309">Keep an eye on</span>', 'nothing checked off in the month (during the first 10 days of a month we look at last month instead), some checklist dates need fixing, or online training has slowed or not started.')}
        ${li('<span style="color:#047857">On track</span>', 'observed recently and nothing to fix.')}
      </ul>
      ${section('The TAP tag')}
      <p>Wherever you see a staff member’s name in the portal (for example in Pearl), apprentices have a small <strong>TAP</strong> tag next to their name. A red or orange dot means something needs attention. Click the tag to see their card.</p>
      ${section('Who to ask')}
      <p>Questions about the numbers or a name that looks wrong: the Training &amp; Development team. Updates happen automatically every night.</p>
    </div>`;
  }

  // ── CSV export ─────────────────────────────────────────────────────────────
  function download(name, rows) {
    const csv = rows.map(r => r.map(v => { const s = String(v == null ? '' : v); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }).join(',')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = name + '_' + new Date().toISOString().slice(0, 10) + '.csv';
    document.body.appendChild(a); a.click(); a.remove();
  }
  function exportCsv(kind) {
    if (!_model) return;
    if (kind === 'apprentices') download('TAP_Apprentices_SY2627', [['Name', 'Role', 'Site', 'Site Leader', 'OJT Hours', 'OJT %', 'Beginning %', 'Middle %', 'End %', 'OJT hrs this month', 'Latest Observation', 'SY Workbook %', 'Knowtion Est Hrs', 'Knowtion Spent Hrs', 'Course 3 Est', 'Course 3 Spent', 'Wage Milestone', 'Flags']]
      .concat(filteredAppr().map(p => { const pr = p.progress || {}, r = p.rti || {}; return [p.name, p.role, p.site, pr['Site Leader'] || '', p.ojtHours, pctTxt(p.ojtPct), pctTxt(p.beg), pctTxt(p.mid), pctTxt(p.end), p.curMonthHrs, fmtDate(parseDate(pr['Latest Observation'])), pr['Workbook %'] !== undefined && pr['Workbook %'] !== '' ? pctTxt(ratio(pr['Workbook %'])) : '', r['Estimated Hours'] || '', r['Time Spent Hours'] || '', r['Course 3 (RTI) Estimated Hours'] || '', r['Course 3 (RTI) Time Spent Hours'] || '', p.role === 'Apprentice' ? (p.milestone || 'Base') : '', p.flags.map(f => f.text).join(' | ')]; })));
    if (kind === 'followup') download('TAP_FollowUp_SY2627', [['Priority', 'Issue', 'Name', 'Role', 'Detail', 'Site Leader', 'Supervisor', 'Action']]
      .concat(followItems().map(i => [i.level === 'red' ? 'Urgent' : 'Watch', (GROUPS.find(g => g[0] === i.code) || [, i.code])[1], i.name, i.role, i.text, i.contact, i.supervisor, i.action])));
    if (kind === 'training') download('Knowtion_Training_SY2627', [['Learner (Knowtion)', 'Roster Name', 'Role', 'Items Completed', 'Estimated Hours', 'Time Spent Hours', 'Course 3 Est', 'Course 3 Spent', 'Items Missing Estimate', 'Last Completed']]
      .concat(_model.rti.map(r => [r['Learner (Knowtion)'], r['Roster Name'], r['Role'], r['Items Completed'], r['Estimated Hours'], r['Time Spent Hours'], r['Course 3 (RTI) Estimated Hours'], r['Course 3 (RTI) Time Spent Hours'], r['Items Missing Estimate'], r['Last Completed']])));
  }

  // ── Public API + panel hook ────────────────────────────────────────────────
  let _qTimer = null;
  window.NJTC_TAP = {
    load, lookup, closePop, exportCsv,
    get model() { return _model; },
    hubTab(k) { _tab = k; renderHub(); },
    setLens(l) { _lens = l; _tab = null; renderHub(); },
    setFilter(k, v, debounce) {
      _filters[k] = v;
      if (!debounce) { renderHub(); return; }
      clearTimeout(_qTimer);
      _qTimer = setTimeout(() => {
        const id = _tab === 'apprentices' ? 'tdhApprTable' : _tab === 'training' ? 'tdhTrainTable' : _tab === 'p-people' ? 'tdhPeople' : null;
        const box = id && document.getElementById(id);
        if (!box) { renderHub(); return; }
        const tmp = document.createElement('div'); tmp.innerHTML = (_tab === 'apprentices' ? rApprentices() : _tab === 'p-people' ? pPeople() : rTraining());
        const fresh = tmp.querySelector('#' + id); if (fresh) box.innerHTML = fresh.innerHTML;
      }, 250);
    },
    showPerson(name) {
      const p = lookup(name); if (!p) return;
      const box = document.createElement('div');
      box.className = 'tapi-pop';
      box.style.cssText = 'position:fixed;inset:0;z-index:10040;background:rgba(10,22,40,.35);display:flex;align-items:flex-start;justify-content:center;padding:6vh 12px';
      box.innerHTML = `<div style="position:relative;background:#fff;border-radius:14px;max-width:520px;width:100%;max-height:86vh;overflow:auto;padding:1.1rem 1.25rem;box-shadow:0 20px 50px rgba(10,22,40,.25)"><button aria-label="Close" style="position:absolute;top:.5rem;right:.7rem;border:none;background:none;font-size:1.3rem;cursor:pointer;color:#7d8fa1">×</button>${lens() === 'td' ? personCard(p, true) : plainDetail(p)}</div>`;
      box.addEventListener('click', e => { if (e.target === box || e.target.getAttribute('aria-label') === 'Close') box.remove(); });
      document.body.appendChild(box);
    },
    openInHub(name) {
      closePop();
      if (lens() === 'td') { _tab = 'apprentices'; _filters.role = 'All'; _filters.q = name; _filters.flagged = false; }
      else { _tab = 'p-people'; _filters.pRole = 'All'; _filters.pq = name; _filters.pAttention = false; }
      const btn = document.querySelector('.sidebar-link[data-panel="td-hub"]');
      if (typeof window.showPanel === 'function') window.showPanel('td-hub', btn);
      setTimeout(renderHub, 60);
    },
    refresh() { _model = null; document.querySelectorAll('[data-tapi]').forEach(el => { el.removeAttribute('data-tapi'); el.querySelectorAll('.tapi-tag').forEach(t => t.remove()); }); load(true).then(() => { renderHub(); tagWithin(document.querySelector('.ct-main')); }); },
  };

  function hookPanel() {
    const orig = window.showPanel;
    if (typeof orig !== 'function') { setTimeout(hookPanel, 300); return; }
    if (orig._tapiHooked) return;
    const wrapped = function (id, btn) {
      const r = orig.apply(this, arguments);
      if (id === 'td-hub') setTimeout(renderHub, 30);
      return r;
    };
    wrapped._tapiHooked = true;
    window.showPanel = wrapped;
  }
  function boot() {
    hookPanel();
    // Load after the portal's own first render so it never slows the home page.
    setTimeout(() => load().then(m => { if (m) { startTagging(); if (document.getElementById('panel-td-hub') && document.getElementById('panel-td-hub').classList.contains('active')) renderHub(); } }), 2500);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
