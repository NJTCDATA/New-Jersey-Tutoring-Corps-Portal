/* ============================================================================
   COMMENT FOLLOW-UP QUEUE — Pearl Operations → 🚩 Comment Follow-Up
   ============================================================================
   Every tutor and scholar survey comment that needs someone to act, with a
   status that stays until it is closed. Which comments are flagged is decided
   by shared/comment-flags.js (the same rules as the Support Report workbook's
   "Flagged Comments" tab and the Onsite Staff Report).

   Escalations (scholar wellbeing / safety) are also emailed every morning to
   the Regional Directors by apps-scripts/comment-followup.gs. That script is
   where status updates are stored: this page reads them (GET ?tab=updates)
   and saves them (POST, fire-and-forget), like the Support Log resolutions.

   Until FOLLOWUP_URL is set, the queue still lists every flagged comment;
   updates are kept only in this browser and the page says so.
   ============================================================================ */
(function () {
  'use strict';

  // Apps Script web app /exec URL from apps-scripts/comment-followup.gs setup step 4.
  const FOLLOWUP_URL = 'https://script.google.com/macros/s/AKfycbzDPNNW46xYIe29Ymnp7quy5CADYzI4_FFChzEE7PvL8NgLZm0ILb7pL2uq2ad2cS3E/exec';

  const STATUSES = ['Open', 'In progress', 'Resolved', 'No action needed'];
  const CLOSED = new Set(['Resolved', 'No action needed']);
  const LOCAL_KEY = 'njtc_comment_followup_local_v1';
  const ESC_HOURS = 24;

  let _rows = [];           // flagged comments (from Pearl, via shared rules)
  let _updates = {};        // comment id → latest { status, owner, note, updated_by, timestamp }
  let _filters = { region: 'ALL', status: 'open', tier: 'ALL', days: '30', q: '' };
  let _editing = null;

  const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const ymdOf = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  function toYMD(v) {
    const t = String(v == null ? '' : v).trim();
    let m = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (m) return m[1] + '-' + m[2].padStart(2, '0') + '-' + m[3].padStart(2, '0');
    m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
    if (m) return (m[3].length === 2 ? '20' + m[3] : m[3]) + '-' + m[1].padStart(2, '0') + '-' + m[2].padStart(2, '0');
    return '';
  }
  function parseCSV(text) {
    const rows = []; let row = [], f = '', q = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (q) { if (c === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; }
      else if (c === '"') q = true;
      else if (c === ',') { row.push(f); f = ''; }
      else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(f); f = ''; rows.push(row); row = []; }
      else f += c;
    }
    if (f || row.length) { row.push(f); rows.push(row); }
    return rows;
  }
  const me = () => (window.NJTC_SESSION && window.NJTC_SESSION.name) || '';

  // ── Data ──────────────────────────────────────────────────────────────────
  function buildRows() {
    const CF = window.NJTC_COMMENT_FLAGS;
    const input = window.po && window.po.getFieldSupportInput ? window.po.getFieldSupportInput() : null;
    if (!CF || !input || !(input.instRows || []).length) return null;
    const sessById = {};
    (input.sessions || []).forEach(s => { if (s && s.id) sessById[s.id] = s; });
    const isArch = v => /^\s*(z{3}|njtc\s*$)/i.test(v || '');
    return CF.collect({
      instRows: input.instRows, stuRows: input.stuRows, INST_S: input.INST_S, STU_S: input.STU_S, sessById, toYMD,
      inScope: (school, district) => !!school && !isArch(school) && !isArch(district),
    }).map(c => Object.assign(c, { region: input.regionOf(c.school, c.district) || '' }));
  }

  function loadLocal() {
    try { return JSON.parse(localStorage.getItem(LOCAL_KEY) || '{}') || {}; } catch (e) { return {}; }
  }
  function saveLocal(map) { try { localStorage.setItem(LOCAL_KEY, JSON.stringify(map)); } catch (e) {} }

  async function loadUpdates() {
    const merged = {};
    if (FOLLOWUP_URL) {
      try {
        const res = await fetch(FOLLOWUP_URL + '?tab=updates&t=' + Date.now(), { signal: AbortSignal.timeout(10000) });
        const rows = parseCSV(await res.text());
        const h = (rows[0] || []).map(x => x.trim().toLowerCase()), ix = k => h.indexOf(k);
        rows.slice(1).forEach(r => {
          const id = r[ix('comment_id')]; if (!id) return;
          merged[id] = { status: r[ix('status')], owner: r[ix('owner')], note: r[ix('note')], updated_by: r[ix('updated_by')], timestamp: r[ix('timestamp')] };
        });
      } catch (e) { console.warn('[Comment Follow-Up] could not load updates:', e.message); }
    }
    // Saves from this browser that the sheet has not returned yet (POST is fire-and-forget)
    const local = loadLocal();
    Object.keys(local).forEach(id => {
      const l = local[id], s = merged[id];
      if (!s || String(l.timestamp) > String(s.timestamp || '')) merged[id] = l;
      else delete local[id];
    });
    saveLocal(local);
    _updates = merged;
  }

  function statusOf(c) { return (_updates[c.id] && _updates[c.id].status) || 'Open'; }
  function overdue(c) {
    if (c.tier !== 'escalate' || CLOSED.has(statusOf(c)) || statusOf(c) === 'In progress') return false;
    const d = new Date(c.date + 'T23:59:59');
    return (Date.now() - d.getTime()) / 36e5 > ESC_HOURS;
  }

  function visible() {
    const f = _filters, q = f.q.trim().toLowerCase();
    const since = f.days === 'SY' ? '' : ymdOf(new Date(Date.now() - (+f.days) * 864e5));
    return _rows.filter(c => {
      const st = statusOf(c);
      if (f.region !== 'ALL' && c.region !== f.region) return false;
      if (f.tier !== 'ALL' && c.tier !== f.tier) return false;
      if (f.status === 'open' && CLOSED.has(st)) return false;
      if (f.status === 'closed' && !CLOSED.has(st)) return false;
      if (since && c.date < since) return false;
      if (q && ![c.school, c.tutor, c.session, c.text, c.category, c.scholar].join(' ').toLowerCase().includes(q)) return false;
      return true;
    });
  }

  // ── UI ────────────────────────────────────────────────────────────────────
  function open() {
    let ov = document.getElementById('cfuOverlay');
    if (!ov) {
      ov = document.createElement('div');
      ov.id = 'cfuOverlay';
      ov.style.cssText = 'position:fixed;inset:0;background:rgba(15,23,42,.55);z-index:9500;display:flex;align-items:flex-start;justify-content:center;padding:2.5vh 1rem;overflow:auto';
      ov.onclick = e => { if (e.target === ov) close(); };
      document.body.appendChild(ov);
    }
    ov.style.display = 'flex';
    ov.innerHTML = '<div style="background:#fff;border-radius:14px;max-width:1280px;width:100%;padding:1.5rem;font-size:.85rem;color:#1e293b">Loading flagged comments…</div>';
    refresh();
  }
  function close() { const ov = document.getElementById('cfuOverlay'); if (ov) ov.style.display = 'none'; }

  async function refresh() {
    const rows = buildRows();
    if (!rows) { render('Pearl survey data is still loading. Open Pearl Operations, wait for the data to finish loading, then try again.'); return; }
    _rows = rows;
    await loadUpdates();
    render();
  }

  function setFilter(k, v) { _filters[k] = v; render(); }
  function edit(id) { _editing = _editing === id ? null : id; render(); }

  function save(id) {
    const c = _rows.find(r => r.id === id); if (!c) return;
    const g = k => (document.getElementById('cfu-' + k) || {}).value || '';
    const upd = { status: g('status') || 'Open', owner: g('owner').trim(), note: g('note').trim(), updated_by: me(), timestamp: new Date().toISOString() };
    if (CLOSED.has(upd.status) && !upd.note) { const st = document.getElementById('cfu-msg'); if (st) st.textContent = 'Add a short note on what was done before closing.'; return; }
    _updates[id] = upd;
    const local = loadLocal(); local[id] = upd; saveLocal(local);
    if (FOLLOWUP_URL) {
      try {
        fetch(FOLLOWUP_URL, { method: 'POST', mode: 'no-cors', body: JSON.stringify(Object.assign({ comment_id: id, region: c.region }, upd)) });
      } catch (e) {}
    }
    _editing = null;
    render();
  }

  function exportCSV() {
    const head = ['Priority', 'Category', 'Date', 'Region', 'School', 'Tutor', 'Session', 'Session ID', 'From', 'Comment', 'Suggested step', 'Status', 'Owner', 'Note', 'Updated by', 'Comment ID'];
    const cell = v => { const s = String(v == null ? '' : v); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
    const lines = [head.join(',')].concat(visible().map(c => {
      const u = _updates[c.id] || {};
      return [c.tierLabel, c.categories.join('; '), c.date, c.region, c.school, c.tutor, c.session, c.sessionId,
        c.from === 'tutor' ? 'Tutor' : 'Scholar', c.text, c.step, statusOf(c), u.owner || '', u.note || '', u.updated_by || '', c.id].map(cell).join(',');
    }));
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([lines.join('\n')], { type: 'text/csv' }));
    a.download = 'NJTC-Comment-Follow-Up-' + ymdOf(new Date()) + '.csv';
    a.click();
  }

  function render(message) {
    const ov = document.getElementById('cfuOverlay'); if (!ov) return;
    const sel = (k, opts) => '<select onchange="njtcCommentFollowUp.setFilter(\'' + k + '\', this.value)" style="padding:.35rem .5rem;border:1px solid #cbd5e1;border-radius:7px;font-size:.8rem">' +
      opts.map(([v, l]) => '<option value="' + v + '"' + (_filters[k] === v ? ' selected' : '') + '>' + l + '</option>').join('') + '</select>';
    const rows = message ? [] : visible();
    // Summary chips follow the region and period filters (not status/priority)
    const since = _filters.days === 'SY' ? '' : ymdOf(new Date(Date.now() - (+_filters.days) * 864e5));
    const inView = _rows.filter(c => (_filters.region === 'ALL' || c.region === _filters.region) && (!since || c.date >= since));
    const openRows = inView.filter(c => !CLOSED.has(statusOf(c)));
    const chip = (n, label, bg, fg) => '<div style="background:' + bg + ';color:' + fg + ';border-radius:9px;padding:.5rem .8rem;min-width:120px"><div style="font-size:1.25rem;font-weight:800">' + n + '</div><div style="font-size:.72rem;font-weight:600">' + label + '</div></div>';
    const tierBadge = c => '<span style="display:inline-block;padding:.15rem .45rem;border-radius:6px;font-size:.7rem;font-weight:700;' +
      (c.tier === 'escalate' ? 'background:#fee2e2;color:#b91c1c' : 'background:#ffedd5;color:#c2410c') + '">' + (c.tier === 'escalate' ? 'Escalate' : 'Follow up') + '</span>' +
      (overdue(c) ? '<div style="font-size:.68rem;color:#b91c1c;font-weight:700;margin-top:.2rem">Over 24 hrs</div>' : '');
    const statusCell = c => {
      const u = _updates[c.id] || {}, st = statusOf(c);
      const color = CLOSED.has(st) ? '#15803d' : st === 'In progress' ? '#b45309' : '#475569';
      return '<b style="color:' + color + '">' + esc(st) + '</b>' + (u.owner ? '<div style="font-size:.72rem">' + esc(u.owner) + '</div>' : '') +
        (u.note ? '<div style="font-size:.72rem;color:#64748b">"' + esc(u.note) + '"</div>' : '') +
        (u.updated_by ? '<div style="font-size:.68rem;color:#94a3b8">' + esc(u.updated_by) + (u.timestamp ? ' · ' + esc(String(u.timestamp).slice(0, 10)) : '') + '</div>' : '');
    };
    const editor = c => {
      const u = _updates[c.id] || {};
      return '<tr><td colspan="7" style="background:#f8fafc;padding:.75rem 1rem;border-bottom:1px solid #e2e8f0">' +
        '<div style="display:flex;gap:.6rem;flex-wrap:wrap;align-items:flex-end">' +
        '<label style="font-size:.72rem;font-weight:700">Status<br><select id="cfu-status" style="padding:.35rem;border:1px solid #cbd5e1;border-radius:7px">' +
        STATUSES.map(s => '<option' + (statusOf(c) === s ? ' selected' : '') + '>' + s + '</option>').join('') + '</select></label>' +
        '<label style="font-size:.72rem;font-weight:700">Owner<br><input id="cfu-owner" value="' + esc(u.owner || me()) + '" style="padding:.35rem;border:1px solid #cbd5e1;border-radius:7px;width:180px"></label>' +
        '<label style="font-size:.72rem;font-weight:700;flex:1;min-width:240px">What was done / next step<br><input id="cfu-note" value="' + esc(u.note || '') + '" placeholder="e.g. Site Leader told the counselor 11/3" style="padding:.35rem;border:1px solid #cbd5e1;border-radius:7px;width:100%"></label>' +
        '<button onclick="njtcCommentFollowUp.save(\'' + c.id + '\')" style="padding:.45rem .9rem;background:#1b2a4a;color:#fff;border:none;border-radius:7px;font-weight:700;cursor:pointer">Save</button>' +
        '<button onclick="njtcCommentFollowUp.edit(\'' + c.id + '\')" style="padding:.45rem .9rem;background:#fff;border:1px solid #cbd5e1;border-radius:7px;cursor:pointer">Cancel</button>' +
        '<span id="cfu-msg" style="color:#b91c1c;font-size:.75rem"></span></div></td></tr>';
    };
    const body = rows.map(c => '<tr style="border-bottom:1px solid #e2e8f0;vertical-align:top">' +
      '<td style="padding:.55rem .5rem">' + tierBadge(c) + '</td>' +
      '<td style="padding:.55rem .5rem;white-space:nowrap">' + esc(c.date) + '<div style="font-size:.7rem;color:#64748b">' + esc(c.region) + '</div></td>' +
      '<td style="padding:.55rem .5rem">' + esc(c.school.replace(/^LEA - iLearn /, 'iLearn ')) + '<div style="font-size:.72rem;color:#64748b">' + esc(c.tutor) + (c.session ? ' · ' + esc(c.session) : '') + '</div></td>' +
      '<td style="padding:.55rem .5rem;max-width:420px"><b>' + esc(c.category) + '</b> <span style="font-size:.7rem;color:#64748b">· ' + (c.from === 'tutor' ? 'Tutor ' + esc(c.field.toLowerCase()) : 'Scholar survey') + (c.rating !== '' ? ' · rated ' + esc(c.rating) : '') + '</span><div style="margin-top:.2rem">' + esc(c.text) + '</div></td>' +
      '<td style="padding:.55rem .5rem;font-size:.75rem;color:#334155;max-width:220px">' + esc(c.step) + '</td>' +
      '<td style="padding:.55rem .5rem;min-width:130px">' + statusCell(c) + '</td>' +
      '<td style="padding:.55rem .5rem"><button onclick="njtcCommentFollowUp.edit(\'' + c.id + '\')" style="padding:.35rem .7rem;border:1px solid #cbd5e1;background:#fff;border-radius:7px;cursor:pointer;font-size:.75rem;font-weight:600">Update</button></td></tr>' +
      (_editing === c.id ? editor(c) : '')).join('');

    ov.innerHTML = '<div style="background:#fff;border-radius:14px;max-width:1280px;width:100%;padding:1.4rem 1.5rem;color:#1e293b;font-size:.82rem;box-shadow:0 20px 60px rgba(0,0,0,.25)">' +
      '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:1rem;flex-wrap:wrap">' +
        '<div><div style="font-size:1.2rem;font-weight:800;color:#1b2a4a">🚩 Comment Follow-Up</div>' +
        '<div style="color:#64748b;max-width:760px;margin-top:.2rem">Tutor and scholar survey comments that need someone to act. <b>Escalate</b> = scholar wellbeing or safety: check in within 24 hours (also emailed each morning to the Regional Directors). <b>Follow up</b> = tutor support or a fix this week. A signal to check in, not an HR action.</div></div>' +
        '<div style="display:flex;gap:.5rem"><button onclick="njtcCommentFollowUp.exportCSV()" style="padding:.45rem .8rem;border:1px solid #cbd5e1;background:#fff;border-radius:8px;cursor:pointer;font-weight:600">⬇ CSV</button>' +
        '<button onclick="njtcCommentFollowUp.refresh()" style="padding:.45rem .8rem;border:1px solid #cbd5e1;background:#fff;border-radius:8px;cursor:pointer;font-weight:600">↻ Refresh</button>' +
        '<button onclick="njtcCommentFollowUp.close()" style="padding:.45rem .8rem;border:none;background:#1b2a4a;color:#fff;border-radius:8px;cursor:pointer;font-weight:600">Close</button></div></div>' +
      (FOLLOWUP_URL ? '' : '<div style="margin-top:.8rem;background:#fef3c7;border:1px solid #fcd34d;color:#92400e;border-radius:8px;padding:.55rem .8rem">Status tracking is not connected yet, so updates are saved in this browser only. Set up <code>apps-scripts/comment-followup.gs</code> and add its web-app URL to <code>FOLLOWUP_URL</code> in <code>central/modules/comment-followup.js</code>.</div>') +
      (message ? '<div style="margin-top:1rem;color:#64748b">' + esc(message) + '</div></div>' :
      '<div style="display:flex;gap:.6rem;flex-wrap:wrap;margin:1rem 0">' +
        chip(openRows.filter(c => c.tier === 'escalate').length, 'Escalations open', '#fee2e2', '#991b1b') +
        chip(openRows.filter(overdue).length, 'Escalations over 24 hrs', '#fecaca', '#7f1d1d') +
        chip(openRows.filter(c => c.tier === 'followup').length, 'Follow-ups open', '#ffedd5', '#9a3412') +
        chip(inView.filter(c => CLOSED.has(statusOf(c))).length, 'Closed', '#dcfce7', '#166534') + '</div>' +
      '<div style="display:flex;gap:.5rem;flex-wrap:wrap;align-items:center;margin-bottom:.6rem">' +
        sel('region', [['ALL', 'All regions'], ['NE', 'NE'], ['SW', 'SW']]) +
        sel('status', [['open', 'Open + in progress'], ['closed', 'Closed'], ['all', 'All statuses']]) +
        sel('tier', [['ALL', 'All priorities'], ['escalate', 'Escalate only'], ['followup', 'Follow up only']]) +
        sel('days', [['7', 'Last 7 days'], ['14', 'Last 14 days'], ['30', 'Last 30 days'], ['SY', 'School year']]) +
        '<input placeholder="Search school, tutor, comment…" value="' + esc(_filters.q) + '" onchange="njtcCommentFollowUp.setFilter(\'q\', this.value)" style="padding:.38rem .6rem;border:1px solid #cbd5e1;border-radius:7px;min-width:240px">' +
        '<span style="color:#64748b;margin-left:auto">' + rows.length + ' comment' + (rows.length === 1 ? '' : 's') + '</span></div>' +
      '<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse"><thead><tr style="background:#1b2a4a;color:#fff;text-align:left">' +
        ['Priority', 'Date', 'School · Tutor', 'What was said', 'Suggested step', 'Status', ''].map(h => '<th style="padding:.5rem;font-size:.72rem">' + h + '</th>').join('') +
      '</tr></thead><tbody>' + (body || '<tr><td colspan="7" style="padding:1.2rem;text-align:center;color:#64748b">Nothing to follow up for these filters.</td></tr>') + '</tbody></table></div></div>');
  }

  window.njtcCommentFollowUp = { open, close, refresh, setFilter, edit, save, exportCSV };
})();
