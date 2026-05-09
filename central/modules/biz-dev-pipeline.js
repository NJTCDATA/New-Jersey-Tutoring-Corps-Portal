(function () {
  'use strict';

  // ═══════════════════════════════════════════════════════════════════
  //  BUSINESS DEVELOPMENT PIPELINE
  //  Tracks Anthony's outreach & partnership pipeline for Leadership/KB.
  //
  //  Dept access:  leadership, kb — full dashboard + pipeline board
  //  Submission:   any leadership user (Anthony) logs updates via modal form
  //  Dollar value: stored in localStorage, editable by Leadership/KB only
  //  Share-outs:   "Post Share-Out" submits to the existing LB form so the
  //                message appears in the bell for all departments
  //
  //  Data source:  Google Sheet ID 13QXbzTnZMrfIlTxH9vfBnxejs1HNgPGOMpREL3-Ijnk
  //                GID 760912308  (responses tab from the BD pipeline form)
  // ═══════════════════════════════════════════════════════════════════

  // ── Config ─────────────────────────────────────────────────────────
  const BD_SHEET_ID  = '13QXbzTnZMrfIlTxH9vfBnxejs1HNgPGOMpREL3-Ijnk';
  const BD_GID       = '760912308';
  const BD_GVIZ_URL  = 'https://docs.google.com/spreadsheets/d/' + BD_SHEET_ID +
                       '/gviz/tq?tqx=out:json&gid=' + BD_GID;

  // Paste the Google Form's "formResponse" URL here once available.
  // Get it from: Form → ⋮ → Get pre-filled link → copy action URL.
  const BD_FORM_ACTION = 'https://docs.google.com/forms/d/e/1FAIpQLSeBhEl3Bu-JIYP2vfaxGosjQg1iYkJoSsJxIdkur_eEyk65LA/formResponse';

  // Entry IDs from the BD Pipeline Google Form
  const BD_ENTRY = {
    orgName:     'entry.834835718',
    contactName: 'entry.2017090049',
    contactTitle:'entry.1704046748',
    partnerType: 'entry.782352842',
    stage:       'entry.1791426684',
    howAcquired: 'entry.943721963',
    update:      'entry.1613033347',
    nextStep:    'entry.652952828',
    dateYear:    'entry.1129804643_year',
    dateMonth:   'entry.1129804643_month',
    dateDay:     'entry.1129804643_day',
  };

  // LB form constants (mirrors shared-utils.js) — used for share-out submissions
  const BD_LB_FORM_ACTION = 'https://docs.google.com/forms/d/e/1FAIpQLSdqsDYL9ZSepSWL0sx2ay-Flg3Bj9jBvUEJSujdcz26mhbOMw/formResponse';
  const BD_LB_DEPT_ENTRY  = 'entry.834835718';
  const BD_LB_ORG_ENTRY   = 'entry.943721963';

  const BD_STAGES = [
    { key: 'Identified',          label: '🔍 Identified',          color: '#94a3b8' },
    { key: 'Reached Out',         label: '📧 Reached Out',         color: '#60a5fa' },
    { key: 'Responded / Curious', label: '💬 Responded / Curious', color: '#34d399' },
    { key: 'Meeting Scheduled',   label: '📅 Meeting Scheduled',   color: '#fb923c' },
    { key: 'Meeting Held',        label: '🤝 Meeting Held',        color: '#f59e0b' },
    { key: 'Proposal Sent',       label: '📄 Proposal Sent',       color: '#8b5cf6' },
    { key: 'Negotiating',         label: '⚖️ Negotiating',         color: '#ec4899' },
    { key: 'Active Partnership',  label: '✅ Active Partnership',   color: '#10b981' },
    { key: 'On Hold',             label: '⏸️ On Hold',             color: '#6366f1' },
    { key: 'No Longer Pursuing',  label: '❌ No Longer Pursuing',  color: '#ef4444' },
  ];
  const BD_ACTIVE_KEY = 'Active Partnership';
  const BD_STUCK_DAYS = 14;

  const BD_PARTNER_TYPES = [
    'School/District', 'Foundation/Grant', 'Corporate Sponsor',
    'Gov/Municipality', 'Community Org', 'Other',
  ];
  const BD_SOURCES = [
    'Cold Outreach — Email',
    'Cold Outreach — LinkedIn / Social',
    'Cold Outreach — Phone / In-Person',
    'Internal Referral (staff connection)',
    'External Referral (existing partner)',
    'Event / Conference',
    'Inbound Inquiry (they came to us)',
  ];

  // ── localStorage helpers ────────────────────────────────────────────
  const BD_VALUE_KEY   = 'njtc_bd_values_v1';
  const BD_NOTIF_KEY   = 'njtc_bd_notif_dismissed_v1';
  const BD_CACHE_TTL   = 60 * 1000;
  let _bdCache = null, _bdCacheTs = 0;

  function _bdGetValues()  { try { return JSON.parse(localStorage.getItem(BD_VALUE_KEY) || '{}'); } catch(e) { return {}; } }
  function _bdSaveValue(org, val) {
    const all = _bdGetValues();
    const k   = (org || '').trim().toLowerCase();
    if (val) all[k] = { value: val, ts: Date.now() };
    else delete all[k];
    try { localStorage.setItem(BD_VALUE_KEY, JSON.stringify(all)); } catch(e) {}
  }
  function _bdGetValue(org) {
    return ((_bdGetValues()[(org||'').trim().toLowerCase()] || {}).value) || '';
  }

  function _bdGetDismissed()    { try { return JSON.parse(localStorage.getItem(BD_NOTIF_KEY) || '[]'); } catch(e) { return []; } }
  function _bdSaveDismissed(d)  { try { localStorage.setItem(BD_NOTIF_KEY, JSON.stringify(d)); } catch(e) {} }
  function _bdIsDismissed(key)  { return _bdGetDismissed().includes(key); }
  function _bdDismissKey(key) {
    const d = _bdGetDismissed();
    if (!d.includes(key)) { d.push(key); _bdSaveDismissed(d); }
  }

  // ── GViz fetch & parse ──────────────────────────────────────────────
  function _bdParseGViz(text) {
    try {
      const clean = text.replace(/^[^\[{]*/, '').replace(/[^\]};]*$/, '');
      const json  = JSON.parse(clean);
      if (!json || !json.table) return [];
      const cols = (json.table.cols || []).map(c => c.label || '');
      const rows = (json.table.rows || []).map(row => {
        const obj = {};
        (row.c || []).forEach((cell, i) => {
          obj[cols[i]] = cell ? (cell.f !== undefined && cell.f !== null ? cell.f : (cell.v !== null && cell.v !== undefined ? String(cell.v) : '')) : '';
        });
        return obj;
      }).filter(r => Object.values(r).some(v => v && String(v).trim()));
      return rows;
    } catch(e) {
      console.warn('[BD] GViz parse error:', e);
      return null;
    }
  }

  async function _bdFetch(force) {
    if (!force && _bdCache && (Date.now() - _bdCacheTs) < BD_CACHE_TTL) return _bdCache;
    try {
      const res = await fetch(BD_GVIZ_URL + '&t=' + Date.now(), { signal: AbortSignal.timeout(8000) });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const rows = _bdParseGViz(await res.text());
      if (rows !== null) { _bdCache = rows; _bdCacheTs = Date.now(); return rows; }
    } catch(e) {
      console.warn('[BD] Fetch failed:', e.message);
    }
    return _bdCache || [];
  }

  // ── Row accessors ───────────────────────────────────────────────────
  function _bdTs(row) {
    const v = row['Timestamp'] || Object.values(row)[0] || '';
    const d = new Date(v); return isNaN(d.getTime()) ? null : d;
  }
  function _bdOrg(row)     { return (row['Organization Name'] || '').trim(); }
  function _bdContact(row) { return (row['Contact Name'] || '').trim(); }
  function _bdTitle(row)   { return (row['Contact Title'] || '').trim(); }
  function _bdType(row)    { return (row['Partner Type'] || row['School / District'] || '').trim(); }
  function _bdSource(row)  { return (row['How Acquired'] || row['Cold Outreach — LinkedIn / Social'] || '').trim(); }
  function _bdUpdate(row)  { return (row['Update / What Happened?'] || row['Update / What happened?'] || row['Update'] || '').trim(); }
  function _bdNext(row)    { return (row['Next Step?'] || row['Next Step'] || '').trim(); }
  function _bdTargetDate(row) { return (row['Target Date'] || '').trim(); }

  function _bdStage(row) {
    const raw = (row['Current Stage'] || row['📧 Reached Out'] || '').trim();
    if (!raw) return '';
    const match = BD_STAGES.find(s => raw.includes(s.key) || s.key.includes(raw.replace(/^[^\w]*/,'')));
    return match ? match.key : raw;
  }

  function _bdNormStageKey(raw) {
    if (!raw) return '';
    const lc = raw.toLowerCase();
    if (lc.includes('identif'))                        return 'Identified';
    if (lc.includes('reached'))                        return 'Reached Out';
    if (lc.includes('respond') || lc.includes('curi')) return 'Responded / Curious';
    if (lc.includes('sched'))                          return 'Meeting Scheduled';
    if (lc.includes('held'))                           return 'Meeting Held';
    if (lc.includes('proposal'))                       return 'Proposal Sent';
    if (lc.includes('negotiat'))                       return 'Negotiating';
    if (lc.includes('active'))                         return BD_ACTIVE_KEY;
    if (lc.includes('hold'))                           return 'On Hold';
    if (lc.includes('no longer') || lc.includes('clos') || lc.includes('lost')) return 'No Longer Pursuing';
    return raw;
  }

  // ── Group rows by org (history sorted newest-first) ─────────────────
  function _bdGroupByOrg(rows) {
    const map = {};
    rows.forEach(row => {
      const org = _bdOrg(row);
      if (!org) return;
      if (!map[org]) map[org] = [];
      map[org].push(row);
    });
    Object.values(map).forEach(arr => arr.sort((a, b) => (_bdTs(b) || 0) - (_bdTs(a) || 0)));
    return map;
  }

  // ── Helpers ─────────────────────────────────────────────────────────
  function _esc(s) { return (s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

  function _bdStageCfg(keyOrRaw) {
    const key = _bdNormStageKey(keyOrRaw);
    return BD_STAGES.find(s => s.key === key) || { key, label: key, color: '#94a3b8' };
  }

  function _bdFmtDate(d) {
    if (!d) return '';
    return d.toLocaleString('en-US', { weekday:'short', month:'short', day:'numeric', year:'numeric', hour:'2-digit', minute:'2-digit' });
  }

  function _bdDaysAgo(d) {
    if (!d) return null;
    return Math.floor((Date.now() - d.getTime()) / 86400000);
  }

  // ── CSS ────────────────────────────────────────────────────────────
  function _bdInjectCSS() {
    if (document.getElementById('bdPipelineCSS')) return;
    const s = document.createElement('style');
    s.id = 'bdPipelineCSS';
    s.textContent = `
      /* ── BD Pipeline panel ── */
      .bd-header {
        background: linear-gradient(135deg, #0a1628 0%, #1a3a5c 100%);
        padding: 1.125rem 1.5rem;
        display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: .75rem;
      }
      .bd-header-title { font-size: 1rem; font-weight: 800; color: #fff; letter-spacing: -.01em; }
      .bd-header-sub   { font-size: .7rem; color: rgba(255,255,255,.5); margin-top: .15rem; }
      .bd-header-btns  { display: flex; gap: .625rem; flex-wrap: wrap; }
      .bd-btn {
        display: inline-flex; align-items: center; gap: .375rem;
        padding: .4375rem 1rem; border-radius: 9px; font-size: .7875rem;
        font-weight: 700; font-family: inherit; cursor: pointer;
        border: none; transition: filter .15s;
      }
      .bd-btn:hover { filter: brightness(1.1); }
      .bd-btn-primary { background: linear-gradient(135deg,#0a6e3a,#16a34a); color: #fff; }
      .bd-btn-ghost   { background: rgba(255,255,255,.12); color: rgba(255,255,255,.85); border: 1px solid rgba(255,255,255,.2); }
      .bd-body { padding: 1.25rem 1.5rem; }

      /* Scorecard */
      .bd-scorecard {
        display: grid; grid-template-columns: repeat(auto-fit, minmax(108px, 1fr));
        gap: .75rem; margin-bottom: 1.5rem;
      }
      .bd-sc-tile {
        border-radius: 12px; padding: .875rem 1rem; text-align: center;
        transition: transform .15s;
      }
      .bd-sc-tile:hover { transform: translateY(-2px); }
      .bd-sc-n     { font-size: 1.625rem; font-weight: 800; line-height: 1.1; }
      .bd-sc-lbl   { font-size: .65rem; font-weight: 700; color: var(--muted,#64748b); margin-top: .2rem; text-transform: uppercase; letter-spacing: .05em; }

      /* Section header */
      .bd-sec-hdr {
        display: flex; align-items: center; gap: .5rem;
        font-size: .7rem; font-weight: 800; text-transform: uppercase;
        letter-spacing: .09em; color: var(--muted,#64748b);
        margin-bottom: .875rem; margin-top: 1.375rem;
      }
      .bd-sec-hdr::after {
        content: ''; flex: 1; height: 1px; background: var(--border,#e2e8f0);
      }

      /* Board columns */
      .bd-board { display: flex; gap: .875rem; overflow-x: auto; padding-bottom: .5rem; }
      .bd-col {
        min-width: 168px; max-width: 210px; flex-shrink: 0;
        background: var(--surface-2,#f8fafc); border: 1px solid var(--border,#e2e8f0);
        border-radius: 12px; overflow: hidden;
      }
      .bd-col-hdr {
        padding: .5rem .75rem; font-size: .625rem; font-weight: 800;
        text-transform: uppercase; letter-spacing: .07em;
        display: flex; align-items: center; justify-content: space-between;
      }
      .bd-col-badge {
        font-size: .575rem; font-weight: 800; padding: .1rem .45rem;
        border-radius: 20px; background: rgba(0,0,0,.1);
      }
      .bd-col-body { padding: .5rem; display: flex; flex-direction: column; gap: .4rem; min-height: 48px; }
      .bd-org-card {
        background: #fff; border-radius: 9px; padding: .625rem .75rem;
        border: 1px solid var(--border,#e2e8f0); cursor: pointer;
        transition: box-shadow .15s, transform .15s; position: relative;
      }
      .bd-org-card:hover { box-shadow: 0 4px 12px rgba(0,0,0,.1); transform: translateY(-1px); }
      .bd-org-name  { font-size: .7875rem; font-weight: 700; color: var(--navy,#0a1628); line-height: 1.3; }
      .bd-org-sub   { font-size: .6125rem; color: var(--muted,#64748b); margin-top: .2rem; line-height: 1.4; }
      .bd-org-value { font-size: .65rem; font-weight: 700; color: #10b981; margin-top: .25rem; }
      .bd-stuck-dot { display: inline-block; width: 6px; height: 6px; border-radius: 50%; background: #f59e0b; margin-left: .3rem; vertical-align: middle; }

      /* Activity feed */
      .bd-feed { display: flex; flex-direction: column; gap: .625rem; max-height: 420px; overflow-y: auto; }
      .bd-feed-item {
        display: flex; gap: .875rem; padding: .75rem 1rem;
        background: var(--surface-2,#f8fafc); border-radius: 10px;
        border: 1px solid var(--border,#e2e8f0);
      }
      .bd-feed-stage-dot {
        width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; margin-top: .3rem;
      }
      .bd-feed-body  { flex: 1; min-width: 0; }
      .bd-feed-org   { font-size: .8rem; font-weight: 700; color: var(--navy,#0a1628); }
      .bd-feed-stage { font-size: .675rem; font-weight: 600; display: inline-block; margin-left: .35rem; }
      .bd-feed-ts    { font-size: .625rem; color: var(--muted,#64748b); margin-top: .15rem; }
      .bd-feed-note  { font-size: .7375rem; color: var(--text-2,#374151); margin-top: .35rem; line-height: 1.55; }

      /* Detail modal */
      .bd-modal-overlay {
        display: none; position: fixed; inset: 0;
        background: rgba(10,22,40,.65); backdrop-filter: blur(5px);
        z-index: 1100; align-items: center; justify-content: center; padding: 1rem;
      }
      .bd-modal-overlay.open { display: flex; }
      .bd-modal {
        background: var(--surface,#fff); border-radius: 16px;
        box-shadow: 0 24px 64px rgba(0,0,0,.25); width: 100%; max-width: 560px;
        max-height: 90vh; overflow-y: auto; position: relative;
      }
      .bd-modal-hdr {
        background: linear-gradient(135deg,#0a1628,#1a3a5c);
        padding: 1.125rem 1.5rem; border-radius: 16px 16px 0 0;
        display: flex; align-items: center; justify-content: space-between;
      }
      .bd-modal-title { font-size: .9375rem; font-weight: 800; color: #fff; }
      .bd-modal-sub   { font-size: .65rem; color: rgba(255,255,255,.5); margin-top: .15rem; }
      .bd-modal-close {
        background: rgba(255,255,255,.1); border: 1px solid rgba(255,255,255,.15); color: #fff;
        border-radius: 8px; width: 30px; height: 30px; display: flex; align-items: center;
        justify-content: center; cursor: pointer; font-size: .875rem; font-family: inherit;
      }
      .bd-modal-body  { padding: 1.375rem 1.5rem; }
      .bd-form-group  { margin-bottom: 1rem; }
      .bd-form-label  {
        display: block; font-size: .675rem; font-weight: 700; text-transform: uppercase;
        letter-spacing: .07em; color: var(--muted,#64748b); margin-bottom: .375rem;
      }
      .bd-form-required { color: #ef4444; margin-left: .2rem; }
      .bd-form-input, .bd-form-select, .bd-form-textarea {
        width: 100%; padding: .5625rem .875rem; border: 1.5px solid var(--border,#e2e8f0);
        border-radius: 9px; font-size: .8125rem; font-family: inherit;
        background: var(--surface,#fff); color: var(--text,#0a1628);
        transition: border-color .15s; box-sizing: border-box;
      }
      .bd-form-input:focus, .bd-form-select:focus, .bd-form-textarea:focus {
        outline: none; border-color: #3b82f6; box-shadow: 0 0 0 3px rgba(59,130,246,.12);
      }
      .bd-form-textarea { resize: vertical; min-height: 80px; line-height: 1.55; }
      .bd-form-row      { display: grid; grid-template-columns: 1fr 1fr; gap: .875rem; }
      .bd-form-err   { font-size: .7rem; color: #ef4444; margin-top: .75rem; display: none; }
      .bd-form-ok    { display: none; text-align: center; padding: 2rem 1rem; }
      .bd-form-ok-icon { font-size: 2.5rem; margin-bottom: .625rem; }
      .bd-form-ok-msg  { font-size: .9rem; font-weight: 700; color: var(--navy,#0a1628); }
      .bd-form-ok-sub  { font-size: .7625rem; color: var(--muted,#64748b); margin-top: .35rem; }
      .bd-modal-footer { display: flex; gap: .625rem; justify-content: flex-end; padding: 0 1.5rem 1.375rem; }

      /* Value editor inside modal */
      .bd-value-section {
        margin-top: 1rem; padding: .875rem 1rem;
        background: #f0fdf4; border: 1px solid #86efac; border-radius: 10px;
      }
      .bd-value-lbl  { font-size: .625rem; font-weight: 800; text-transform: uppercase; letter-spacing: .07em; color: #166534; margin-bottom: .5rem; }
      .bd-value-row  { display: flex; gap: .5rem; align-items: center; }
      .bd-value-inp  { flex: 1; padding: .4375rem .75rem; border: 1.5px solid #86efac; border-radius: 8px; font-size: .825rem; font-family: inherit; background: #fff; }
      .bd-value-save { padding: .4375rem .875rem; background: #16a34a; color: #fff; border: none; border-radius: 8px; font-size: .75rem; font-weight: 700; font-family: inherit; cursor: pointer; }

      /* Org detail modal */
      .bd-det-field   { margin-bottom: .875rem; }
      .bd-det-lbl     { font-size: .6rem; font-weight: 700; text-transform: uppercase; letter-spacing: .07em; color: var(--muted,#64748b); margin-bottom: .2rem; }
      .bd-det-val     { font-size: .825rem; color: var(--navy,#0a1628); line-height: 1.55; padding: .4rem .7rem; border-radius: 0 7px 7px 0; border-left: 3px solid var(--border,#e2e8f0); background: var(--surface-2,#f8fafc); }
      .bd-history-row { display: flex; gap: .5rem; align-items: flex-start; margin-bottom: .625rem; }
      .bd-history-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; margin-top: .35rem; }
      .bd-history-ts  { font-size: .625rem; color: var(--muted); min-width: 90px; flex-shrink: 0; margin-top: .15rem; }
      .bd-history-stage { font-size: .7rem; font-weight: 700; margin-bottom: .15rem; }
      .bd-history-note  { font-size: .7rem; color: var(--text-2,#374151); line-height: 1.5; }

      /* Acquisition chart */
      .bd-acq-bar   { display: flex; align-items: center; gap: .625rem; margin-bottom: .5rem; }
      .bd-acq-lbl   { font-size: .7rem; color: var(--text-2); min-width: 200px; flex-shrink: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .bd-acq-track { flex: 1; background: var(--surface-2,#f1f5f9); border-radius: 99px; height: 8px; overflow: hidden; }
      .bd-acq-fill  { height: 100%; border-radius: 99px; background: #3b82f6; transition: width .4s; }
      .bd-acq-n     { font-size: .675rem; font-weight: 700; color: var(--navy); min-width: 20px; text-align: right; }

      /* Bell notification cards for BD */
      .lbn-card.bd-notif { background: #f0fdf4; border-left: 4px solid #10b981; }
      .lbn-card.bd-notif-warn { background: #fffbeb; border-left: 4px solid #f59e0b; }
    `;
    document.head.appendChild(s);
  }

  // ── Scorecard ───────────────────────────────────────────────────────
  function _bdScorecard(byOrg) {
    const orgs      = Object.values(byOrg);
    const total     = orgs.length;
    const active    = orgs.filter(h => _bdNormStageKey(_bdStage(h[0])) === BD_ACTIVE_KEY).length;
    const proposals = orgs.filter(h => ['Proposal Sent','Negotiating',BD_ACTIVE_KEY].includes(_bdNormStageKey(_bdStage(h[0])))).length;
    const meetings  = orgs.filter(h => ['Meeting Held','Proposal Sent','Negotiating',BD_ACTIVE_KEY].includes(_bdNormStageKey(_bdStage(h[0])))).length;
    const pursuing  = orgs.filter(h => !['On Hold','No Longer Pursuing'].includes(_bdNormStageKey(_bdStage(h[0])))).length;
    const tile = (icon, n, lbl, col) =>
      `<div class="bd-sc-tile" style="background:${col}14;border:1px solid ${col}40">
        <div style="font-size:1.1rem">${icon}</div>
        <div class="bd-sc-n" style="color:${col}">${n}</div>
        <div class="bd-sc-lbl">${lbl}</div>
      </div>`;
    return `<div class="bd-scorecard">
      ${tile('🎯', total,     'Total Prospects',   '#60a5fa')}
      ${tile('🤝', meetings,  'Meetings Held',      '#f59e0b')}
      ${tile('📄', proposals, 'Proposals Out',      '#8b5cf6')}
      ${tile('✅', active,    'Active Partners',    '#10b981')}
      ${tile('🔥', pursuing,  'Actively Pursuing',  '#f97316')}
    </div>`;
  }

  // ── Pipeline board ──────────────────────────────────────────────────
  function _bdBoard(byOrg) {
    const funnelStages = BD_STAGES.filter(s => s.key !== 'On Hold' && s.key !== 'No Longer Pursuing');
    const sideStages   = BD_STAGES.filter(s => s.key === 'On Hold' || s.key === 'No Longer Pursuing');

    function orgCard(org, history) {
      const latest  = history[0];
      const stageK  = _bdNormStageKey(_bdStage(latest));
      const contact = _bdContact(latest);
      const type    = _bdType(latest);
      const ts      = _bdTs(latest);
      const daysOld = _bdDaysAgo(ts);
      const stuck   = daysOld !== null && daysOld >= BD_STUCK_DAYS &&
                      !['Active Partnership','On Hold','No Longer Pursuing'].includes(stageK);
      const val     = _bdGetValue(org);
      return `<div class="bd-org-card" onclick="window._bdOpenOrgDetail(${_esc(JSON.stringify(org))})">
        <div class="bd-org-name">${_esc(org)}${stuck ? '<span class="bd-stuck-dot" title="Stuck '+daysOld+'d"></span>' : ''}</div>
        ${contact ? `<div class="bd-org-sub">${_esc(contact)}${type ? ' · ' + _esc(type) : ''}</div>` : ''}
        ${val ? `<div class="bd-org-value">💰 ${_esc(val)}</div>` : ''}
      </div>`;
    }

    function col(stageCfg) {
      const orgsHere = Object.entries(byOrg)
        .filter(([, h]) => _bdNormStageKey(_bdStage(h[0])) === stageCfg.key);
      const cards = orgsHere.map(([org, h]) => orgCard(org, h)).join('');
      return `<div class="bd-col">
        <div class="bd-col-hdr" style="background:${stageCfg.color}18;color:${stageCfg.color}">
          <span style="font-size:.7rem">${_esc(stageCfg.label)}</span>
          <span class="bd-col-badge" style="background:${stageCfg.color}22;color:${stageCfg.color}">${orgsHere.length}</span>
        </div>
        <div class="bd-col-body">${cards || '<div style="font-size:.65rem;color:var(--muted);padding:.25rem .25rem">—</div>'}</div>
      </div>`;
    }

    const funnelCols = funnelStages.map(col).join('');
    const sideCols   = sideStages.map(col).join('');

    return `
      <div class="bd-sec-hdr">Pipeline Board</div>
      <div class="bd-board">${funnelCols}</div>
      ${sideCols ? `<div class="bd-board" style="margin-top:.75rem">${sideCols}</div>` : ''}
    `;
  }

  // ── Acquisition breakdown ───────────────────────────────────────────
  function _bdAcqBreakdown(byOrg) {
    const counts = {};
    Object.values(byOrg).forEach(h => {
      const src = _bdSource(h[0]) || 'Unknown';
      counts[src] = (counts[src] || 0) + 1;
    });
    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    if (!sorted.length) return '';
    const max = sorted[0][1];
    const bars = sorted.map(([src, n]) =>
      `<div class="bd-acq-bar">
        <div class="bd-acq-lbl" title="${_esc(src)}">${_esc(src)}</div>
        <div class="bd-acq-track"><div class="bd-acq-fill" style="width:${Math.round(n/max*100)}%"></div></div>
        <div class="bd-acq-n">${n}</div>
      </div>`
    ).join('');
    return `<div class="bd-sec-hdr">Acquisition Breakdown</div><div>${bars}</div>`;
  }

  // ── Activity feed ───────────────────────────────────────────────────
  function _bdFeed(rows) {
    const recent = [...rows]
      .filter(r => _bdOrg(r))
      .sort((a, b) => (_bdTs(b) || 0) - (_bdTs(a) || 0))
      .slice(0, 30);
    if (!recent.length) return '';
    const items = recent.map(row => {
      const org    = _bdOrg(row);
      const stageK = _bdNormStageKey(_bdStage(row));
      const cfg    = _bdStageCfg(stageK);
      const ts     = _bdTs(row);
      const note   = _bdUpdate(row) || _bdNext(row);
      return `<div class="bd-feed-item">
        <div class="bd-feed-stage-dot" style="background:${cfg.color}"></div>
        <div class="bd-feed-body">
          <div><span class="bd-feed-org">${_esc(org)}</span>
            <span class="bd-feed-stage" style="color:${cfg.color}">${_esc(cfg.label)}</span></div>
          ${ts ? `<div class="bd-feed-ts">${_bdFmtDate(ts)}</div>` : ''}
          ${note ? `<div class="bd-feed-note">${_esc(note)}</div>` : ''}
        </div>
      </div>`;
    }).join('');
    return `<div class="bd-sec-hdr">Activity Feed</div><div class="bd-feed">${items}</div>`;
  }

  // ── Full render ─────────────────────────────────────────────────────
  async function _bdRender(dept) {
    const el = document.getElementById('bdPipelineRoot');
    if (!el) return;

    _bdInjectCSS();

    const isAllowed = ['leadership','kb','data'].includes(dept);
    if (!isAllowed) return;

    // Data dept: read-only view (no submit/share-out buttons)
    const isReadOnly = dept === 'data';

    el.innerHTML = `
      <div class="bd-header">
        <div>
          <div class="bd-header-title">🌱 Business Development Pipeline</div>
          <div class="bd-header-sub">Partner outreach tracker · Growth &amp; Business Development</div>
        </div>
        ${!isReadOnly ? `<div class="bd-header-btns">
          <button class="bd-btn bd-btn-ghost" onclick="window._bdOpenShareOut()">📢 Post Share-Out</button>
          <button class="bd-btn bd-btn-primary" onclick="window._bdOpenUpdateForm()">+ Log Pipeline Update</button>
        </div>` : ''}
      </div>
      <div class="bd-body" id="bdPipelineBody">
        <div style="text-align:center;padding:2.5rem;color:var(--muted)">⏳ Loading pipeline data…</div>
      </div>`;

    const rows  = await _bdFetch(false);
    const byOrg = _bdGroupByOrg(rows);
    const body  = document.getElementById('bdPipelineBody');
    if (!body) return;

    if (!rows.length) {
      body.innerHTML = `<div style="text-align:center;padding:2.5rem;color:var(--muted)">
        <div style="font-size:2rem;margin-bottom:.625rem">📋</div>
        <div style="font-weight:700;margin-bottom:.35rem">No pipeline data yet</div>
        <div style="font-size:.7875rem">Anthony can log the first prospect using the button above.</div>
      </div>`;
      return;
    }

    body.innerHTML =
      _bdScorecard(byOrg) +
      _bdBoard(byOrg) +
      _bdAcqBreakdown(byOrg) +
      _bdFeed(rows);
  }

  // ── Org detail modal ────────────────────────────────────────────────
  window._bdOpenOrgDetail = function(org) {
    const byOrg = _bdGroupByOrg(_bdCache || []);
    const history = byOrg[org];
    if (!history || !history.length) return;

    const latest   = history[0];
    const stageK   = _bdNormStageKey(_bdStage(latest));
    const cfg      = _bdStageCfg(stageK);
    const val      = _bdGetValue(org);

    const field = (lbl, v, col) => v
      ? `<div class="bd-det-field">
           <div class="bd-det-lbl">${lbl}</div>
           <div class="bd-det-val" style="border-left-color:${col||'var(--border)'};">${_esc(v)}</div>
         </div>`
      : '';

    const histRows = history.map(row => {
      const sk  = _bdNormStageKey(_bdStage(row));
      const sc  = _bdStageCfg(sk);
      const ts  = _bdTs(row);
      const upd = _bdUpdate(row);
      const nxt = _bdNext(row);
      return `<div class="bd-history-row">
        <div class="bd-history-dot" style="background:${sc.color}"></div>
        <div>
          ${ts ? `<div class="bd-history-ts">${ts.toLocaleString('en-US',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'})}</div>` : ''}
          <div class="bd-history-stage" style="color:${sc.color}">${_esc(sc.label)}</div>
          ${upd ? `<div class="bd-history-note">${_esc(upd)}</div>` : ''}
          ${nxt ? `<div class="bd-history-note" style="color:var(--muted)">→ ${_esc(nxt)}</div>` : ''}
        </div>
      </div>`;
    }).join('');

    const modal = document.createElement('div');
    modal.className = 'bd-modal-overlay open';
    modal.id = 'bdDetailModal';
    modal.onclick = e => { if (e.target === modal) modal.remove(); };
    modal.innerHTML = `
      <div class="bd-modal" style="max-width:580px">
        <div class="bd-modal-hdr" style="background:linear-gradient(135deg,${cfg.color}cc,${cfg.color}88)">
          <div>
            <div class="bd-modal-title">${_esc(org)}</div>
            <div class="bd-modal-sub">${_esc(cfg.label)} · ${history.length} update${history.length!==1?'s':''}</div>
          </div>
          <button class="bd-modal-close" onclick="document.getElementById('bdDetailModal').remove()">✕</button>
        </div>
        <div class="bd-modal-body">
          ${field('Contact',      _bdContact(latest) + (_bdTitle(latest) ? ', ' + _bdTitle(latest) : ''), cfg.color)}
          ${field('Partner Type', _bdType(latest),    '#60a5fa')}
          ${field('Acquisition',  _bdSource(latest),  '#8b5cf6')}
          ${field('Next Step',    _bdNext(latest),    '#f59e0b')}
          ${field('Target Date',  _bdTargetDate(latest), '#94a3b8')}

          <!-- Dollar Value — Leadership fills this in -->
          <div class="bd-value-section">
            <div class="bd-value-lbl">💰 Partnership Value (Leadership Only)</div>
            <div class="bd-value-row">
              <input class="bd-value-inp" id="bdValInp_${_esc(org).replace(/\s/g,'_')}" type="text"
                placeholder="e.g. $50,000" value="${_esc(val)}"
                onkeydown="if(event.key==='Enter') window._bdSaveVal(${_esc(JSON.stringify(org))})">
              <button class="bd-value-save" onclick="window._bdSaveVal(${_esc(JSON.stringify(org))})">Save</button>
            </div>
            <div style="font-size:.6rem;color:#166534;margin-top:.375rem">Filled by Leadership team · stored locally · visible in pipeline board</div>
          </div>

          <div class="bd-sec-hdr" style="margin-top:1.25rem">Full History</div>
          <div style="max-height:220px;overflow-y:auto">${histRows}</div>
        </div>
        <div class="bd-modal-footer">
          <button class="bd-btn bd-btn-primary" onclick="document.getElementById('bdDetailModal').remove();window._bdOpenUpdateForm(${_esc(JSON.stringify(org))})">+ Log Update</button>
          <button class="bd-btn" style="background:var(--surface-2);color:var(--navy)" onclick="document.getElementById('bdDetailModal').remove()">Close</button>
        </div>
      </div>`;
    document.body.appendChild(modal);
  };

  window._bdSaveVal = function(org) {
    const id  = 'bdValInp_' + (org || '').replace(/\s/g, '_');
    const inp = document.getElementById(id);
    if (!inp) return;
    _bdSaveValue(org, inp.value.trim());
    // Refresh the pipeline board to show updated value
    const dept = (window.NJTC_SESSION || {}).dept || '';
    _bdRender(dept);
    const modal = document.getElementById('bdDetailModal');
    if (modal) modal.remove();
  };

  // ── Pipeline Update Form ────────────────────────────────────────────
  window._bdOpenUpdateForm = function(prefillOrg) {
    if (document.getElementById('bdUpdateModal')) return;
    const stages  = BD_STAGES.map(s => `<option value="${_esc(s.label)}">${_esc(s.label)}</option>`).join('');
    const types   = BD_PARTNER_TYPES.map(t => `<option value="${_esc(t)}">${_esc(t)}</option>`).join('');
    const sources = BD_SOURCES.map(s => `<option value="${_esc(s)}">${_esc(s)}</option>`).join('');
    const formDisabled = !BD_FORM_ACTION;

    const modal = document.createElement('div');
    modal.className = 'bd-modal-overlay open';
    modal.id = 'bdUpdateModal';
    modal.onclick = e => { if (e.target === modal) modal.remove(); };
    modal.innerHTML = `
      <div class="bd-modal">
        <div class="bd-modal-hdr">
          <div>
            <div class="bd-modal-title">📋 Log Pipeline Update</div>
            <div class="bd-modal-sub">Business Development · every meaningful interaction</div>
          </div>
          <button class="bd-modal-close" onclick="document.getElementById('bdUpdateModal').remove()">✕</button>
        </div>
        <div class="bd-modal-body" id="bdUpdateFormBody">
          ${formDisabled ? `<div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:.875rem 1rem;margin-bottom:1rem;font-size:.75rem;color:#dc2626">
            <strong>⚠️ Form not yet configured.</strong> Ask your tech team to add the BD Form's <code>formResponse</code> URL to <code>biz-dev-pipeline.js</code>.
          </div>` : ''}
          <div class="bd-form-row">
            <div class="bd-form-group">
              <label class="bd-form-label">Organization Name<span class="bd-form-required">*</span></label>
              <input class="bd-form-input" id="bdF_org" type="text" placeholder="e.g. Camden City SD" value="${prefillOrg ? _esc(prefillOrg) : ''}">
            </div>
            <div class="bd-form-group">
              <label class="bd-form-label">Partner Type</label>
              <select class="bd-form-select" id="bdF_type">
                <option value="">— Select —</option>${types}
              </select>
            </div>
          </div>
          <div class="bd-form-row">
            <div class="bd-form-group">
              <label class="bd-form-label">Contact Name</label>
              <input class="bd-form-input" id="bdF_contact" type="text" placeholder="Full name">
            </div>
            <div class="bd-form-group">
              <label class="bd-form-label">Contact Title</label>
              <input class="bd-form-input" id="bdF_title" type="text" placeholder="e.g. Superintendent">
            </div>
          </div>
          <div class="bd-form-row">
            <div class="bd-form-group">
              <label class="bd-form-label">Current Stage<span class="bd-form-required">*</span></label>
              <select class="bd-form-select" id="bdF_stage">
                <option value="">— Select —</option>${stages}
              </select>
            </div>
            <div class="bd-form-group">
              <label class="bd-form-label">How Acquired</label>
              <select class="bd-form-select" id="bdF_source">
                <option value="">— Select —</option>${sources}
              </select>
            </div>
          </div>
          <div class="bd-form-group">
            <label class="bd-form-label">Update / What Happened?<span class="bd-form-required">*</span></label>
            <textarea class="bd-form-textarea" id="bdF_update" placeholder="Describe what happened, what was discussed, outcome…"></textarea>
          </div>
          <div class="bd-form-row">
            <div class="bd-form-group">
              <label class="bd-form-label">Next Step</label>
              <input class="bd-form-input" id="bdF_next" type="text" placeholder="Specific action pending">
            </div>
            <div class="bd-form-group">
              <label class="bd-form-label">Target Date</label>
              <input class="bd-form-input" id="bdF_date" type="date">
            </div>
          </div>
          <div class="bd-form-err" id="bdFormErr"></div>
        </div>
        <div id="bdUpdateFormOK" class="bd-form-ok">
          <div class="bd-form-ok-icon">✅</div>
          <div class="bd-form-ok-msg">Pipeline update logged!</div>
          <div class="bd-form-ok-sub">It may take a minute to appear in the board.</div>
        </div>
        <div class="bd-modal-footer">
          <button class="bd-btn" style="background:var(--surface-2);color:var(--navy)" onclick="document.getElementById('bdUpdateModal').remove()">Cancel</button>
          <button class="bd-btn bd-btn-primary" id="bdSubmitBtn" onclick="window._bdSubmitUpdate()" ${formDisabled ? 'disabled style="opacity:.5;cursor:not-allowed"' : ''}>
            <span id="bdSubmitTxt">✅ Submit</span>
            <span id="bdSubmitSpin" style="display:none;width:13px;height:13px;border:2px solid rgba(255,255,255,.3);border-top-color:#fff;border-radius:50%;animation:spin .6s linear infinite"></span>
          </button>
        </div>
      </div>`;
    document.body.appendChild(modal);
  };

  window._bdSubmitUpdate = async function() {
    if (!BD_FORM_ACTION) return;
    const org    = (document.getElementById('bdF_org')     || {}).value || '';
    const stage  = (document.getElementById('bdF_stage')   || {}).value || '';
    const update = (document.getElementById('bdF_update')  || {}).value || '';
    const err    = document.getElementById('bdFormErr');

    if (!org.trim())    { if (err) { err.textContent='Organization Name is required.'; err.style.display='block'; } return; }
    if (!stage.trim())  { if (err) { err.textContent='Current Stage is required.'; err.style.display='block'; } return; }
    if (!update.trim()) { if (err) { err.textContent='Please describe what happened.'; err.style.display='block'; } return; }
    if (err) err.style.display = 'none';

    const btn  = document.getElementById('bdSubmitBtn');
    const txt  = document.getElementById('bdSubmitTxt');
    const spin = document.getElementById('bdSubmitSpin');
    if (btn) btn.disabled = true;
    if (txt) txt.textContent = 'Submitting…';
    if (spin) spin.style.display = 'inline-block';

    const dateRaw = (document.getElementById('bdF_date') || {}).value || '';
    let yr = '', mo = '', dy = '';
    if (dateRaw) { const dp = dateRaw.split('-'); yr = dp[0]||''; mo = String(parseInt(dp[1]||0)); dy = String(parseInt(dp[2]||0)); }

    const p = new URLSearchParams();
    p.append(BD_ENTRY.orgName,     org.trim());
    p.append(BD_ENTRY.contactName, (document.getElementById('bdF_contact')||{}).value||'');
    p.append(BD_ENTRY.contactTitle,(document.getElementById('bdF_title')||{}).value||'');
    p.append(BD_ENTRY.partnerType, (document.getElementById('bdF_type')||{}).value||'');
    p.append(BD_ENTRY.stage,       stage);
    p.append(BD_ENTRY.howAcquired, (document.getElementById('bdF_source')||{}).value||'');
    p.append(BD_ENTRY.update,      update.trim());
    p.append(BD_ENTRY.nextStep,    (document.getElementById('bdF_next')||{}).value||'');
    if (yr) { p.append(BD_ENTRY.dateYear, yr); p.append(BD_ENTRY.dateMonth, mo); p.append(BD_ENTRY.dateDay, dy); }

    try {
      await fetch(BD_FORM_ACTION, { method:'POST', mode:'no-cors', headers:{'Content-Type':'application/x-www-form-urlencoded'}, body: p.toString() });
      _bdCache = null; // invalidate so next render fetches fresh
      const formBody = document.getElementById('bdUpdateFormBody');
      const formOK   = document.getElementById('bdUpdateFormOK');
      const footer   = document.querySelector('#bdUpdateModal .bd-modal-footer');
      if (formBody) formBody.style.display = 'none';
      if (formOK)   formOK.style.display = 'block';
      if (footer)   footer.innerHTML = `<button class="bd-btn bd-btn-primary" onclick="document.getElementById('bdUpdateModal').remove();window._bdRenderPipeline()">Close &amp; Refresh</button>`;
    } catch(e) {
      if (err) { err.textContent = 'Submission failed — please try again.'; err.style.display = 'block'; }
      if (btn) btn.disabled = false;
      if (txt) txt.textContent = '✅ Submit';
      if (spin) spin.style.display = 'none';
    }
  };

  // ── Share-Out form ──────────────────────────────────────────────────
  window._bdOpenShareOut = function() {
    if (document.getElementById('bdShareOutModal')) return;
    const modal = document.createElement('div');
    modal.className = 'bd-modal-overlay open';
    modal.id = 'bdShareOutModal';
    modal.onclick = e => { if (e.target === modal) modal.remove(); };
    modal.innerHTML = `
      <div class="bd-modal" style="max-width:460px">
        <div class="bd-modal-hdr">
          <div>
            <div class="bd-modal-title">📢 Post Share-Out</div>
            <div class="bd-modal-sub">Will appear in the 🔔 bell for all departments</div>
          </div>
          <button class="bd-modal-close" onclick="document.getElementById('bdShareOutModal').remove()">✕</button>
        </div>
        <div class="bd-modal-body" id="bdShareOutBody">
          <div class="bd-form-group">
            <label class="bd-form-label">Your Message<span class="bd-form-required">*</span></label>
            <textarea class="bd-form-textarea" id="bdSO_text" placeholder="Share a win, an update, or a cross-department message…" style="min-height:110px"></textarea>
          </div>
          <div style="font-size:.7rem;color:var(--muted);background:var(--surface-2,#f8fafc);border-radius:8px;padding:.625rem .875rem">
            This posts to the Leadership Inbox (bell) so other departments can see it in their notifications.
          </div>
          <div class="bd-form-err" id="bdSOErr"></div>
        </div>
        <div id="bdShareOutOK" class="bd-form-ok">
          <div class="bd-form-ok-icon">📣</div>
          <div class="bd-form-ok-msg">Share-out posted!</div>
          <div class="bd-form-ok-sub">It will appear in the bell for all departments shortly.</div>
        </div>
        <div class="bd-modal-footer" id="bdSOFooter">
          <button class="bd-btn" style="background:var(--surface-2);color:var(--navy)" onclick="document.getElementById('bdShareOutModal').remove()">Cancel</button>
          <button class="bd-btn bd-btn-primary" id="bdSOBtn" onclick="window._bdSubmitShareOut()">📢 Post</button>
        </div>
      </div>`;
    document.body.appendChild(modal);
  };

  window._bdSubmitShareOut = async function() {
    const text = (document.getElementById('bdSO_text') || {}).value || '';
    const err  = document.getElementById('bdSOErr');
    if (!text.trim()) { if (err) { err.textContent='Please write a message first.'; err.style.display='block'; } return; }
    if (err) err.style.display = 'none';

    const btn = document.getElementById('bdSOBtn');
    if (btn) { btn.disabled = true; btn.textContent = 'Posting…'; }

    const p = new URLSearchParams();
    p.append(BD_LB_DEPT_ENTRY, 'leadership');
    p.append(BD_LB_ORG_ENTRY,  text.trim());

    try {
      await fetch(BD_LB_FORM_ACTION, { method:'POST', mode:'no-cors', headers:{'Content-Type':'application/x-www-form-urlencoded'}, body: p.toString() });
      const body = document.getElementById('bdShareOutBody');
      const ok   = document.getElementById('bdShareOutOK');
      const foot = document.getElementById('bdSOFooter');
      if (body) body.style.display = 'none';
      if (ok)   ok.style.display = 'block';
      if (foot) foot.innerHTML = `<button class="bd-btn bd-btn-primary" onclick="document.getElementById('bdShareOutModal').remove()">Close</button>`;
    } catch(e) {
      if (err) { err.textContent='Post failed — please try again.'; err.style.display='block'; }
      if (btn) { btn.disabled = false; btn.textContent = '📢 Post'; }
    }
  };

  // ── Bell notification injection ─────────────────────────────────────
  // Called by shared-utils.js _lbNotifPopulate after rendering LB cards.
  window._bdInjectNotifs = async function(body, dismissed) {
    const rows  = await _bdFetch(false);
    if (!rows.length) return;

    const byOrg = _bdGroupByOrg(rows);
    const bdDismissed = _bdGetDismissed();
    const cards  = [];

    Object.entries(byOrg).forEach(([org, history]) => {
      const latest  = history[0];
      const stageK  = _bdNormStageKey(_bdStage(latest));
      const ts      = _bdTs(latest);
      const tsStr   = ts ? ts.toLocaleString('en-US',{weekday:'short',month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'}) : '';

      // Alert 1: just became Active Partnership
      if (stageK === BD_ACTIVE_KEY) {
        const key = 'bd_active|' + org;
        const unread = !bdDismissed.includes(key);
        cards.push({ key, unread, type: 'active', org, tsStr, ts });
      }

      // Alert 2: stuck in non-terminal stage > BD_STUCK_DAYS
      const daysOld = _bdDaysAgo(ts);
      if (daysOld !== null && daysOld >= BD_STUCK_DAYS &&
          !['Active Partnership','On Hold','No Longer Pursuing'].includes(stageK) && stageK) {
        const key = 'bd_stuck|' + org + '|' + (ts ? ts.toISOString().slice(0,10) : '');
        const unread = !bdDismissed.includes(key);
        cards.push({ key, unread, type: 'stuck', org, stageK, daysOld, tsStr, ts });
      }
    });

    if (!cards.length) return;

    // Prepend BD cards before existing LB cards
    const bdHtml = cards.map(c => {
      const safeKey = c.key.replace(/[^a-z0-9]/gi, '_');
      const isActive = c.type === 'active';
      const dismissFn = `window._bdBellDismiss('${c.key.replace(/'/g,"\\'")}')`;
      return `
        <div class="lbn-card ${isActive ? 'bd-notif' : 'bd-notif-warn'} ${c.unread ? 'lbn-unread' : ''}" id="lbnCard_${safeKey}">
          <button class="lbn-dismiss-btn" onclick="${dismissFn}" title="Dismiss">✕</button>
          <div class="lbn-card-dept-row">
            ${c.unread ? '<span class="lbn-unread-dot"></span>' : ''}
            <span class="lbn-dept-chip" style="background:${isActive ? '#d1fae5' : '#fef3c7'};color:${isActive ? '#065f46' : '#92400e'};border:1px solid ${isActive ? '#6ee7b7' : '#fcd34d'}">${isActive ? '✅ Active Partnership' : '⏰ Stuck in Stage'}</span>
            <span class="lbn-ts">${c.tsStr}</span>
          </div>
          <div class="lbn-field">
            <div class="lbn-field-lbl">${isActive ? '🤝 New Active Partner' : '⚠️ No Movement · ' + c.daysOld + ' days'}</div>
            <div class="lbn-field-txt" style="background:${isActive ? '#f0fdf4' : '#fffbeb'};border-left-color:${isActive ? '#10b981' : '#f59e0b'}">
              <strong>${_esc(c.org)}</strong>${!isActive ? ` — still in <em>${_esc(c.stageK)}</em>` : ' just reached Active Partnership status'}
            </div>
          </div>
        </div>`;
    }).join('');

    // Insert BD cards at the top of the bell body
    body.insertAdjacentHTML('afterbegin', bdHtml);

    // Update badge to count BD unread + existing LB unread
    const bell = document.getElementById('lbNotifBell');
    if (bell) {
      const lbKeys  = JSON.parse(bell.dataset.allKeys || '[]');
      const bdKeys  = cards.map(c => c.key);
      const allKeys = [...new Set([...bdKeys, ...lbKeys])];
      bell.dataset.allKeys = JSON.stringify(allKeys);
      bell.dataset.bdKeys  = JSON.stringify(bdKeys);
    }

    if (typeof window._lbNotifUpdateBadge === 'function') {
      window._lbNotifUpdateBadge();
    }
  };

  window._bdBellDismiss = function(key) {
    _bdDismissKey(key);
    const safeKey = key.replace(/[^a-z0-9]/gi, '_');
    const card = document.getElementById('lbnCard_' + safeKey);
    if (card) {
      card.style.transition = 'opacity .2s,transform .2s';
      card.style.opacity = '0'; card.style.transform = 'translateX(12px)';
      setTimeout(() => { if (card.parentNode) card.parentNode.removeChild(card); }, 210);
    }
    // Update badge: remove this key from bell's allKeys
    const bell = document.getElementById('lbNotifBell');
    if (bell) {
      const bdDismissed = _bdGetDismissed();
      const allKeys = JSON.parse(bell.dataset.allKeys || '[]');
      // Recalculate — dismissed is tracked in bdDismissed for BD keys
      const dismissed = (function() { try { return JSON.parse(localStorage.getItem('njtc_lb_notif_dismissed_v2')||'[]'); } catch(e) { return []; } })();
      const unread = allKeys.filter(k => {
        if (k.startsWith('bd_')) return !bdDismissed.includes(k);
        return !dismissed.includes(k);
      }).length;
      const badge = document.getElementById('lbNotifBadge');
      if (badge) { badge.textContent = unread > 9 ? '9+' : unread; badge.style.display = unread > 0 ? 'flex' : 'none'; }
    }
  };

  // ── Public re-render ────────────────────────────────────────────────
  window._bdRenderPipeline = function() {
    const dept = (window.NJTC_SESSION || {}).dept || '';
    _bdRender(dept);
  };

  // ── Init ────────────────────────────────────────────────────────────
  // The panel renders on demand via showPanel('biz-dev') → _bdRenderPipeline().
  // _bdInjectCSS is called lazily on first render.
  // No auto-render needed — the panel is only populated when the user navigates to it.
  window._bdInit = function() {};  // no-op, kept for compatibility

})();
