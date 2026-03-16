(function() {
  'use strict';

  // ═══════════════════════════════════════════════════════════════════
  //  TRAINING & DEVELOPMENT MODULE — NJTC Central Portal
  //  6 sub-tabs: PD Sessions · Training Intake · Tutor Obs · SL Obs · OTJ · Mgmt
  // ═══════════════════════════════════════════════════════════════════

  // ── Data source URLs (published CSV — 2PACX format, no auth required) ─
  // PD Sessions feedback: spreadsheet 18LyHoN…/gid=471085177
  // Published 2PACX key mirrors NJTC_SOURCES.PD_SESSIONS_ALL in executive-leadership.js.
  // If this returns a redirect, re-publish the sheet via File → Share → Publish to web
  // and update the 2PACX key below.
  const PD_URL = 'https://docs.google.com/spreadsheets/d/e/' +
    '2PACX-1vR00JFO9EMSXhlhhBlweXCexxF6JSheT1aJH4-R7P8gWpVfWTqY18PgK5o4CoZxoNogmflERd9YsGkx' +
    '/pub?output=csv&gid=471085177';
  // Training Intake: spreadsheet 11OH4pBp…/gid=1298105082
  // Same 2PACX key used by NJTC_SOURCES.TRAINING_DETAILS (confirmed working — 73 rows).
  const TRAINING_INTAKE_URL = 'https://docs.google.com/spreadsheets/d/e/' +
    '2PACX-1vRdblJU86VLJWNs4ykc_3GJ9Mr7oe5SDPA0QeYbWQcPsPSqOpWAxGClTiXDH_M3CunJIl0kjA3JUdym' +
    '/pub?output=csv&gid=1298105082';
  // Apprenticeship DB — published to web (entire document)
  const APPRENT_2PACX = '2PACX-1vT9gdaAh2P3wunk3s3drqByMKsiViTGiT7MON_7K8MKyGkdg2jqDGCgOoFwpSPZ8g';

  // ── Chart instance tracker ─────────────────────────────────────────
  const _tdCharts = {};

  // ── Loaded-tab tracker (lazy loading) ─────────────────────────────
  const _tdLoaded = {};

  // ── Cached CSV data ────────────────────────────────────────────────
  let _pdData        = null;
  let _intakeData    = null;
  let _tutorObsData  = null;
  let _slObsData     = null;
  let _otjData       = null;   // OTJ Checklist Template (Mgmt tab)
  let _otjStatusData = null;   // OTJ Status per-tutor (OTJ tab)
  let _apprentGids   = null;

  // ══════════════════════════════════════════════════════════════════
  //  HELPER UTILITIES
  // ══════════════════════════════════════════════════════════════════

  // RFC-4180-compliant CSV line parser — handles quoted fields with embedded commas/newlines
  function parseCSVLine(line) {
    const fields = [];
    let i = 0;
    while (i < line.length) {
      if (line[i] === '"') {
        // Quoted field
        let field = '';
        i++; // skip opening quote
        while (i < line.length) {
          if (line[i] === '"') {
            if (line[i + 1] === '"') { field += '"'; i += 2; } // escaped quote
            else { i++; break; } // closing quote
          } else {
            field += line[i++];
          }
        }
        fields.push(field);
        if (line[i] === ',') i++; // skip comma after closing quote
      } else {
        // Unquoted field — read until comma or end
        let start = i;
        while (i < line.length && line[i] !== ',') i++;
        fields.push(line.slice(start, i));
        if (line[i] === ',') i++;
      }
    }
    return fields;
  }

  // Parse CSV text: skip `skipRows` rows, treat next row as headers, rest as data objects.
  // Empty trailing rows (all cells blank) are automatically excluded.
  function parseCsvText(text, skipRows) {
    // Split on newlines, but respect quoted fields that span lines
    const rawText = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    // Reassemble lines while respecting quoted fields containing newlines
    const allLines = [];
    let current = '';
    let inQuote = false;
    for (let ci = 0; ci < rawText.length; ci++) {
      const ch = rawText[ci];
      if (ch === '"') { inQuote = !inQuote; current += ch; }
      else if (ch === '\n' && !inQuote) { allLines.push(current); current = ''; }
      else { current += ch; }
    }
    if (current) allLines.push(current);

    const dataLines = allLines.slice(skipRows || 0);
    if (!dataLines.length) return { headers: [], rows: [] };
    const headers = parseCSVLine(dataLines[0]);
    const rows = [];
    for (let i = 1; i < dataLines.length; i++) {
      const cols = parseCSVLine(dataLines[i]);
      if (cols.every(c => !c.trim())) continue; // skip blank trailing rows
      const obj = {};
      headers.forEach((h, idx) => { obj[h] = (cols[idx] || '').trim(); });
      rows.push(obj);
    }
    return { headers, rows };
  }

  function getSeason(dateStr) {
    if (!dateStr) return 'fall';
    const d = new Date(dateStr);
    if (isNaN(d)) return 'fall';
    const m = d.getMonth() + 1; // 1-12
    if (m >= 9 && m <= 11) return 'fall';
    if (m === 12 || m === 1 || m === 2) return 'winter';
    if (m >= 3 && m <= 5) return 'spring';
    return 'summer';
  }

  function seasonBadge(dateStr) {
    const s = getSeason(dateStr);
    const labels = { fall: '🍂 Fall', winter: '❄️ Winter', spring: '🌱 Spring', summer: '☀️ Summer' };
    return `<span class="badge-${s}">${labels[s]}</span>`;
  }

  function fmtDate(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    if (isNaN(d)) return dateStr;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  // Rule 3 — clean date display
  const cleanDate = fmtDate;

  function dateToSeason(raw) {
    const d = new Date(raw);
    if (isNaN(d)) return '';
    const m = d.getMonth() + 1;
    if (m >= 9 && m <= 11) return 'Fall';
    if (m === 12 || m <= 2) return 'Winter';
    if (m >= 3 && m <= 5)  return 'Spring';
    return 'Summer';
  }

  function dateLabel(raw) {
    if (!raw) return '';
    const season = dateToSeason(raw);
    const date   = cleanDate(raw);
    return season ? `${season} · ${date}` : date;
  }

  // Rule 9.1 — flag data-entry dates before 2020
  function isSuspectDate(dateStr) {
    const d = new Date(dateStr);
    return !isNaN(d) && d.getFullYear() < 2020;
  }

  // Rule 4 — multi-select field helpers
  function parseMultiSelect(cellValue) {
    if (!cellValue || cellValue.trim() === '') return [];
    return cellValue.split(',').map(v => v.trim()).filter(v => v.length > 0);
  }

  function countTags(rows, columnName) {
    const counts = {};
    rows.forEach(row => {
      parseMultiSelect(row[columnName]).forEach(tag => {
        counts[tag] = (counts[tag] || 0) + 1;
      });
    });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }

  // Rule 10 — human-readable display labels
  const DISPLAY_LABELS = {
    'The PD objectives were clearly communicated.': 'Objectives Clarity',
    'The content was directly relevant to my site responsibilities.': 'Content Relevance',
    'The facilitator(s) provided clear, actionable strategies I can use immediately.': 'Actionable Strategies',
    'The session allowed for meaningful discussion and participation.': 'Discussion & Participation',
    'Overall satisfaction with this PD session': 'Overall Satisfaction',
    'Would you recommend this PD session to other sites?': 'Would Recommend',
    'Overall, how would you rate the effectiveness of the training? (1 = Did not meet expectations, 5 = Exceeded expectations)': 'Training Effectiveness',
    'The training itinerary/setup was clear and well-structured. (1 = Strongly disagree, 5 = Strongly agree)': 'Structure & Clarity',
    'The training materials (slides and videos) were useful in preparing me for my role. (1 = Strongly disagree, 5 = Strongly agree)': 'Materials Usefulness',
    'The trainers were knowledgeable and responsive to questions. (1 = Strongly disagree, 5 = Strongly agree)': 'Trainer Quality',
    'After completing training, how prepared do you feel to begin working with scholars? (1 = Very unprepared, 5 = Extremely prepared)': 'Scholar Preparedness',
    'The asynchronous videos allowed for a more individualized training experience. (1 = Strongly disagree, 5 = Strongly agree)': 'Async Video Experience',
    'How easy was it to access and navigate Google Classroom?': 'GC Navigation',
    'How well-organized were the training modules, assessments, and resources in Google Classroom?': 'GC Organization',
    'To what extent did the Google Classroom layout support your understanding of the training material?': 'GC Learning Support',
    'How effective was Google Classroom in providing timely updates, announcements, or reminders regarding course work?': 'GC Communication',
    'OTJ Beginning': 'Phase 1: Beginning (Months 1–4)',
    'OTJ Middle':    'Phase 2: Middle (Months 5–8)',
    'OTJ End':       'Phase 3: End (Months 9–12)',
  };
  function getDisplayLabel(raw) { return DISPLAY_LABELS[raw] || raw; }

  function avg(arr) {
    const nums = arr.filter(n => !isNaN(n) && n !== '');
    if (!nums.length) return 0;
    return nums.reduce((s, n) => s + parseFloat(n), 0) / nums.length;
  }

  function pct(n, d) {
    if (!d) return 0;
    return Math.round(n / d * 100);
  }

  function countFreq(arr) {
    const map = {};
    arr.forEach(v => { if (v) map[v] = (map[v] || 0) + 1; });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }

  // Rule 5 — observation cell logic
  function isObserved(cellValue) {
    if (!cellValue) return false;
    const v = cellValue.trim().toLowerCase();
    if (v === '' || v === 'n/a') return false;
    return v.includes('observation');
  }

  function obsStatus(cellValue) {
    if (!cellValue || cellValue.trim() === '') return 'none';
    const v = cellValue.trim().toLowerCase();
    if (v === 'n/a') return 'na';
    if (v.includes('observation')) return 'complete';
    if (v.includes('start')) return 'pending';
    return 'note';
  }

  function obsStatusStyle(status) {
    switch (status) {
      case 'complete': return 'background:#dcfce7;color:#166534';
      case 'pending':  return 'background:#fef9c3;color:#854d0e';
      case 'na':       return 'background:repeating-linear-gradient(45deg,#f3f4f6,#f3f4f6 5px,#e5e7eb 5px,#e5e7eb 10px);color:#6b7280';
      case 'note':     return 'background:#dbeafe;color:#1e40af';
      default:         return 'background:#f3f4f6;color:#9ca3af';
    }
  }

  // Rule 6 — OTJ phase status badges
  function otjBadge(value) {
    const v = (value || '').trim();
    if (v === 'Completed')           return { label: 'Completed',       color: '#059669', bg: '#dcfce7' };
    if (v === 'In Progress')         return { label: 'In Progress',     color: '#854d0e', bg: '#fef9c3' };
    if (v.startsWith('Not Started')) return { label: 'PM Following Up', color: '#b91c1c', bg: '#fee2e2' };
    if (v === 'N/A')                 return { label: 'N/A',             color: '#6b7280', bg: '#f3f4f6' };
    return                                  { label: 'Not Started',     color: '#6b7280', bg: '#f3f4f6' };
  }

  function otjBadgeHTML(value) {
    const b = otjBadge(value);
    return `<span style="padding:.15rem .5rem;border-radius:4px;font-size:.7rem;font-weight:700;background:${b.bg};color:${b.color}">${b.label}</span>`;
  }

  function destroyChart(id) {
    if (_tdCharts[id]) {
      try { _tdCharts[id].destroy(); } catch (e) {}
      delete _tdCharts[id];
    }
  }

  function makeChart(id, config) {
    destroyChart(id);
    const canvas = document.getElementById(id);
    if (!canvas) return null;
    const chart = new Chart(canvas, config);
    _tdCharts[id] = chart;
    return chart;
  }

  function loadingHTML(msg) {
    return `<div class="td-loading"><div class="td-spinner"></div>${msg || 'Loading data…'}</div>`;
  }

  function errorHTML(msg, retryFn) {
    return `<div class="td-error">
      <div style="font-size:1.5rem;margin-bottom:.5rem">⚠️</div>
      <div style="font-weight:700;margin-bottom:.25rem">Failed to load data</div>
      <div style="font-size:.85rem;color:#7f1d1d;margin-bottom:.75rem">${msg || 'Network error'}</div>
      ${retryFn ? `<button class="btn btn-secondary btn-sm" onclick="(${retryFn})()">↺ Retry</button>` : ''}
    </div>`;
  }

  function kpiCard(val, sub, color) {
    color = color || '#0050c8';
    return `<div class="ta-card ta-kpi">
      <div class="ta-kpi-val" style="color:${color}">${val}</div>
      <div class="ta-kpi-sub">${sub}</div>
    </div>`;
  }

  function phaseClass(phase) {
    const p = (phase || '').toLowerCase();
    if (p.includes('beginning')) return 'td-phase-beginning';
    if (p.includes('middle'))    return 'td-phase-middle';
    if (p.includes('end'))       return 'td-phase-end';
    return 'td-phase-beginning';
  }

  // Phase timing: Beginning = months 1-4 (Sept-Dec), Middle = 5-8 (Jan-Apr), End = 9-12 (May-Aug)
  function phaseMonthRange(phase) {
    const p = (phase || '').toLowerCase();
    if (p.includes('beginning')) return { start: 9, months: ['Sept','Oct','Nov','Dec'] };
    if (p.includes('middle'))    return { start: 1, months: ['Jan','Feb','Mar','Apr'] };
    return { start: 5, months: ['May','Jun','Jul','Aug'] };
  }

  function phaseIsOverdue(phase) {
    const now = new Date();
    const m = now.getMonth() + 1;
    const p = (phase || '').toLowerCase();
    if (p.includes('beginning')) return m > 12 || (m >= 9);
    if (p.includes('middle'))    return m > 4  || m === 1 || m === 2 || m === 3 || m === 4;
    return m >= 5;
  }

  function getDept() {
    return (window.NJTC_SESSION && window.NJTC_SESSION.dept) || '';
  }

  // ── Row validity guard ─────────────────────────────────────────────
  // Returns true only if the row has at least one meaningful anchor field.
  // Rows with none of the anchor fields (phantom/blank rows) are excluded.
  function isValidRow(r, tab) {
    switch (tab) {
      case 'pd':
        // Must have a Role, a session number, OR any non-blank open-text response
        return !!(
          (r['Role'] && r['Role'].trim()) ||
          (r['PD Session Number'] && r['PD Session Number'].trim()) ||
          (r['What is one key takeaway or strategy you plan to apply at your site?'] || '').trim() ||
          (r['Any additional comments, feedback, or shoutouts?'] || '').trim()
        );
      case 'intake':
        // Must have a role OR a district
        return !!(
          (r['What is your role within NJTC? (Select one)'] || '').trim() ||
          (r['What District are you assigned to?'] || '').trim()
        );
      case 'tutor-obs':
        // Must have a tutor name
        return !!(
          (r['Tutor Name'] || '').trim() ||
          (r['Master List Name'] || '').trim()
        );
      case 'sl-obs':
        // Must have a site leader
        return !!(r['Site Leader'] && r['Site Leader'].trim());
      case 'otj':
      case 'mgmt':
        // Must have a task or competency code
        return !!(
          (r['Activity / Task'] || '').trim() ||
          (r['Competency Code'] || '').trim()
        );
      default:
        return true;
    }
  }


  // ══════════════════════════════════════════════════════════════════
  //  FETCH HELPERS
  // ══════════════════════════════════════════════════════════════════

  async function fetchCSV(url) {
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    return resp.text();
  }

  async function discoverApprentGids() {
    if (_apprentGids) return _apprentGids;
    const pubhtmlUrl = `https://docs.google.com/spreadsheets/d/e/${APPRENT_2PACX}/pubhtml`;
    const TAB_NAMES = ['Tutor Observations', 'Site Leader Obs', 'OTJ Status', 'OTJ Checklist Template'];
    const gids = {};
    try {
      const resp = await fetch(pubhtmlUrl, { signal: AbortSignal.timeout(15000) });
      if (!resp.ok) throw new Error('pubhtml HTTP ' + resp.status);
      const html = await resp.text();

      // Collect all candidate GID numbers (7+ digits) from the HTML
      const allGids = new Set();
      for (const m of html.matchAll(/gid=(\d+)/g))          allGids.add(m[1]);
      for (const m of html.matchAll(/gid%3D(\d+)/g))        allGids.add(m[1]);
      for (const m of html.matchAll(/data-id="(\d{6,})"/g)) allGids.add(m[1]);
      for (const m of html.matchAll(/"id":"(\d{6,})"/g))    allGids.add(m[1]);

      const uniqueGids = [...allGids];

      // Phase 1: try name-proximity regex in the HTML
      TAB_NAMES.forEach(tn => {
        const safe = tn.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+template$/i, '');
        const re1 = new RegExp('(\\d{6,})[^<]{0,300}?' + safe, 'is');
        const re2 = new RegExp(safe + '[^<]{0,300}?(\\d{6,})', 'is');
        const m = re1.exec(html) || re2.exec(html);
        if (m) gids[tn] = m[1];
      });

      // Phase 2: probe each GID by CSV header keywords (fallback)
      const missing = TAB_NAMES.filter(tn => !gids[tn]);
      if (missing.length && uniqueGids.length) {
        await Promise.all(uniqueGids.slice(0, 10).map(async g => {
          try {
            const r = await fetch(apprentUrl(g), { signal: AbortSignal.timeout(8000) });
            if (!r.ok) return;
            const t = await r.text();
            const hdr = t.split('\n').slice(0, 3).join('|').toLowerCase();
            if (missing.includes('Tutor Observations') && !gids['Tutor Observations'] &&
                hdr.includes('tutor name') && hdr.includes('active status'))
              gids['Tutor Observations'] = g;
            if (missing.includes('Site Leader Obs') && !gids['Site Leader Obs'] &&
                hdr.includes('site leader') && hdr.includes('observation month') && !hdr.includes('tutor name'))
              gids['Site Leader Obs'] = g;
            if (missing.includes('OTJ Status') && !gids['OTJ Status'] &&
                (hdr.includes('otj beginning') || hdr.includes('otj middle')))
              gids['OTJ Status'] = g;
            if (missing.includes('OTJ Checklist Template') && !gids['OTJ Checklist Template'] &&
                (hdr.includes('competency code') || hdr.includes('activity / task') || hdr.includes('mark y')))
              gids['OTJ Checklist Template'] = g;
          } catch (e2) { /* skip failed probes */ }
        }));
      }
    } catch (e) {
      console.warn('[TD] discoverApprentGids failed:', e.message);
    }
    _apprentGids = gids;
    return gids;
  }

  function apprentUrl(gid) {
    return `https://docs.google.com/spreadsheets/d/e/${APPRENT_2PACX}/pub?output=csv&gid=${gid}&single=true`;
  }

  // ══════════════════════════════════════════════════════════════════
  //  TAB SWITCHING
  // ══════════════════════════════════════════════════════════════════

  function tdShowTab(tabId, btnEl) {
    // Hide all content panels
    document.querySelectorAll('.td-tab-content').forEach(el => { el.style.display = 'none'; });
    // Deactivate all tab buttons
    document.querySelectorAll('#tdTabNav .pst-tab').forEach(b => b.classList.remove('active'));
    // Show target panel
    const panel = document.getElementById('td-content-' + tabId);
    if (panel) panel.style.display = '';
    // Activate button
    if (btnEl) btnEl.classList.add('active');

    // Lazy-load tab on first activation
    if (!_tdLoaded[tabId]) {
      _tdLoaded[tabId] = true;
      switch (tabId) {
        case 'pd':        renderPDTab();      break;
        case 'intake':    renderIntakeTab();  break;
        case 'tutor-obs': renderTutorObsTab();break;
        case 'sl-obs':    renderSLObsTab();   break;
        case 'otj':       renderOTJTab();     break;
        case 'mgmt':      renderMgmtTab();    break;
      }
    }
  }

  function tdRefresh() {
    // Bust all caches and reload current visible tab
    _pdData = null; _intakeData = null; _tutorObsData = null;
    _slObsData = null; _otjData = null; _otjStatusData = null; _apprentGids = null;
    Object.keys(_tdLoaded).forEach(k => delete _tdLoaded[k]);
    Object.keys(_tdCharts).forEach(k => destroyChart(k));
    // Clear all panels
    ['pd','intake','tutor-obs','sl-obs','otj','mgmt'].forEach(id => {
      const el = document.getElementById('td-content-' + id);
      if (el) el.innerHTML = '';
    });
    // Re-trigger the currently visible tab
    const activeBtn = document.querySelector('#tdTabNav .pst-tab.active');
    if (activeBtn) {
      const tabId = activeBtn.id.replace('tdTab-', '');
      tdShowTab(tabId, activeBtn);
    } else {
      tdShowTab('pd', document.getElementById('tdTab-pd'));
    }
  }


  // ══════════════════════════════════════════════════════════════════
  //  SUB-TAB 1: PD SESSIONS
  // ══════════════════════════════════════════════════════════════════

  const PD_RATING_FIELDS = [
    'The PD objectives were clearly communicated.',
    'The content was directly relevant to my site responsibilities.',
    'The facilitator(s) provided clear, actionable strategies I can use immediately.',
    'The session allowed for meaningful discussion and participation.',
    'Overall satisfaction with this PD session'
  ];

  const PD_RATING_SHORT = [
    'Objectives Clear',
    'Content Relevant',
    'Actionable Strategies',
    'Discussion Quality',
    'Overall Satisfaction'
  ];

  async function renderPDTab() {
    const el = document.getElementById('td-content-pd');
    if (!el) return;
    el.innerHTML = loadingHTML('Loading PD session data…');

    try {
      if (!_pdData) {
        const text = await fetchCSV(PD_URL);
        const parsed = parseCsvText(text, 0);
        _pdData = parsed.rows.filter(r => isValidRow(r, 'pd'));
      }
      el.innerHTML = buildPDHTML(_pdData);
      renderPDContent(_pdData);
    } catch (e) {
      el.innerHTML = errorHTML(e.message, 'function(){_tdLoaded["pd"]=false;renderPDTab();}');
    }
  }

  function buildPDHTML(rows) {
    if (!rows.length) return '<div class="td-error">No PD session data found.</div>';

    const allSessions = groupSessions(rows);
    const allRoles    = [...new Set(rows.map(r => r['Role']).filter(Boolean))].sort();
    const allExp      = [...new Set(rows.map(r => r['Years of Experience in Tutoring / Education']).filter(Boolean))].sort();
    // Rule 4/7 — Focus Area filter populated via countTags
    const focusTags   = countTags(rows, 'What focus areas need additional support?').slice(0, 20);

    return `<div style="display:flex;gap:.5rem;flex-wrap:wrap;margin-bottom:1.25rem;align-items:center">
      <span style="font-size:.75rem;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.07em">Filter</span>
      <select class="filter-select" id="tdPdSessionFilter" onchange="applyPDFilter()">
        <option value="">All Sessions</option>
        ${allSessions.map(s => `<option value="${s.sessionNum}">Session ${s.sessionNum} · ${cleanDate(s.date)}</option>`).join('')}
      </select>
      <select class="filter-select" id="tdPdRoleFilter" onchange="applyPDFilter()">
        <option value="">All Roles</option>
        ${allRoles.map(r => `<option>${r}</option>`).join('')}
      </select>
      <select class="filter-select" id="tdPdSeasonFilter" onchange="applyPDFilter()">
        <option value="">All Seasons</option>
        <option>Fall</option><option>Winter</option><option>Spring</option><option>Summer</option>
      </select>
      <select class="filter-select" id="tdPdExpFilter" onchange="applyPDFilter()">
        <option value="">All Experience Levels</option>
        ${allExp.map(e => `<option>${e}</option>`).join('')}
      </select>
      <select class="filter-select" id="tdPdFocusFilter" onchange="applyPDFilter()">
        <option value="">All Focus Areas</option>
        ${focusTags.map(([tag]) => `<option>${tag}</option>`).join('')}
      </select>
      <span id="tdPdFilterCount" style="font-size:.75rem;color:var(--muted);margin-left:.25rem"></span>
    </div>
    <div id="tdPdContent"></div>`;
  }

  function renderPDContent(filteredRows) {
    const container = document.getElementById('tdPdContent');
    if (!container) return;

    if (!filteredRows.length) {
      container.innerHTML = '<div class="td-error">No responses match the current filters.</div>';
      const countEl = document.getElementById('tdPdFilterCount');
      if (countEl) countEl.textContent = '0 of ' + (_pdData ? _pdData.length : 0) + ' responses';
      return;
    }

    const totalResponses = filteredRows.length;
    const sessions = groupSessions(filteredRows);
    const totalSessions = sessions.length;

    // KPI calculations
    const overallRatings = filteredRows.map(r => parseFloat(r['Overall satisfaction with this PD session'])).filter(n => !isNaN(n));
    const avgOverall = overallRatings.length ? (overallRatings.reduce((s, n) => s + n, 0) / overallRatings.length) : 0;
    const recommendYes = filteredRows.filter(r => (r['Would you recommend this PD session to other sites?'] || '').toLowerCase().startsWith('y')).length;
    const pctRecommend = pct(recommendYes, totalResponses);

    // Latest session avg
    let latestAvg = 0;
    if (sessions.length) {
      const latest = sessions[0];
      const latestRows = latest.rows;
      const latestOverall = latestRows.map(r => parseFloat(r['Overall satisfaction with this PD session'])).filter(n => !isNaN(n));
      latestAvg = latestOverall.length ? (latestOverall.reduce((s, n) => s + n, 0) / latestOverall.length) : 0;
    }

    let html = `<div class="ta-grid ta-grid-4" style="margin-bottom:1.25rem">
      ${kpiCard(totalSessions, 'Total PD Sessions', '#e76f51')}
      ${kpiCard(totalResponses, 'Total Responses', '#0050c8')}
      ${kpiCard(avgOverall.toFixed(1) + '/5', 'Avg Overall Satisfaction', avgOverall >= 4 ? '#059669' : '#d97706')}
      ${kpiCard(pctRecommend + '%', 'Would Recommend', pctRecommend >= 80 ? '#059669' : '#d97706')}
    </div>`;

    if (sessions.length) {
      html += `<div class="ta-card" style="margin-bottom:1rem">
        <div class="ta-card-title">Latest Session Avg Satisfaction</div>
        <div style="font-size:2rem;font-weight:800;color:${latestAvg>=4?'#059669':'#d97706'}">${latestAvg.toFixed(1)}<span style="font-size:1rem;font-weight:400;color:var(--muted)">/5</span></div>
        <div style="font-size:.8rem;color:var(--muted)">${sessions[0].sessionNum} · ${fmtDate(sessions[0].date)}</div>
      </div>`;
    }

    // Session cards
    html += `<div style="margin-bottom:1.5rem">
      <div class="ta-card-title" style="margin-bottom:.75rem">Session Summaries (newest first)</div>`;
    sessions.forEach((s) => {
      const focusAreas = [];
      s.rows.forEach(r => {
        const raw = r['What focus areas need additional support?'] || '';
        raw.split(',').map(v => v.trim()).filter(Boolean).forEach(v => focusAreas.push(v));
      });
      const focusFreq = countFreq(focusAreas).slice(0, 4);
      const recYes = s.rows.filter(r => (r['Would you recommend this PD session to other sites?'] || '').toLowerCase().startsWith('y')).length;
      const recPct = pct(recYes, s.rows.length);

      html += `<div class="ta-card" style="margin-bottom:.875rem">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;flex-wrap:wrap;gap:.5rem;margin-bottom:.75rem">
          <div>
            <div style="font-size:1rem;font-weight:700">Session ${s.sessionNum}</div>
            <div style="font-size:.85rem;color:var(--muted);margin-top:.1rem">
            ${seasonBadge(s.date)} ${cleanDate(s.date)}
            ${isSuspectDate(s.date) ? `<span title="Date may be incorrect — recorded as ${new Date(s.date).getFullYear()}" style="cursor:help;margin-left:.25rem">⚠️</span>` : ''}
          </div>
          </div>
          <div style="font-size:.8rem;color:var(--muted)">
            Facilitator(s): <strong>${s.facilitators}</strong>
          </div>
        </div>
        <div class="ta-grid ta-grid-2" style="gap:.5rem;margin-bottom:.75rem">
          <div>
            <div style="font-size:.7rem;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--muted);margin-bottom:.4rem">Rating Dimensions</div>
            ${PD_RATING_FIELDS.map((field, fi) => {
              const vals = s.rows.map(r => parseFloat(r[field])).filter(n => !isNaN(n));
              const a = vals.length ? vals.reduce((sum, n) => sum + n, 0) / vals.length : 0;
              return `<div class="ta-bar-row" style="margin-bottom:.25rem">
                <div class="ta-bar-label" title="${field}" style="font-size:.72rem">${PD_RATING_SHORT[fi]}</div>
                <div class="ta-bar-track"><div class="ta-bar-fill" style="width:${(a/5*100).toFixed(0)}%;background:#e76f51"></div></div>
                <div class="ta-bar-count" style="font-size:.72rem">${a.toFixed(1)}</div>
              </div>`;
            }).join('')}
          </div>
          <div>
            <div style="font-size:.7rem;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--muted);margin-bottom:.4rem">Top Focus Areas Needing Support</div>
            ${focusFreq.length ? focusFreq.map(([label, cnt]) =>
              `<div style="display:flex;align-items:center;gap:.5rem;margin-bottom:.25rem">
                <span style="font-size:.75rem;flex:1">${label.length > 40 ? label.slice(0, 38) + '…' : label}</span>
                <span style="font-size:.72rem;font-weight:700;background:#fff0e0;color:#e76f51;padding:.1rem .4rem;border-radius:4px">${cnt}</span>
              </div>`
            ).join('') : '<div style="font-size:.8rem;color:var(--muted)">No focus areas reported</div>'}
            <div style="margin-top:.625rem;font-size:.75rem;color:var(--muted)">${s.rows.length} responses · ${recPct}% recommend</div>
          </div>
        </div>
      </div>`;
    });
    html += `</div>`;

    // Charts row
    html += `<div class="ta-grid ta-grid-2" style="margin-bottom:1.5rem">
      <div class="ta-card">
        <div class="ta-card-title">Focus Areas Needing Support</div>
        <div class="td-chart-wrap"><canvas id="tdPdFocusChart"></canvas></div>
      </div>
      <div class="ta-card">
        <div class="ta-card-title">Rating Trends by Session</div>
        <div class="td-chart-wrap"><canvas id="tdPdTrendsChart"></canvas></div>
      </div>
    </div>`;

    html += `<div class="ta-grid ta-grid-2" style="margin-bottom:1.5rem">
      <div class="ta-card">
        <div class="ta-card-title">Role Breakdown</div>
        <div class="td-chart-wrap"><canvas id="tdPdRoleChart"></canvas></div>
      </div>
      <div class="ta-card">
        <div class="ta-card-title">Years of Experience Distribution</div>
        <div class="td-chart-wrap"><canvas id="tdPdExpChart"></canvas></div>
      </div>
    </div>`;

    // Open responses feed
    const sessionNums = sessions.map(s => s.sessionNum);
    html += buildPDOpenResponses(filteredRows, sessionNums);

    container.innerHTML = html;

    // Update filter count badge
    const countEl = document.getElementById('tdPdFilterCount');
    if (countEl) countEl.textContent = totalResponses + ' of ' + (_pdData ? _pdData.length : totalResponses) + ' responses';

    // Render charts after DOM update
    setTimeout(() => renderPDCharts(filteredRows), 50);
  }

  function groupSessions(rows) {
    const map = {};
    rows.forEach(r => {
      // Rule 9.3 — PD Session Number has a trailing space in some raw headers
      const num  = ((r['PD Session Number '] || r['PD Session Number'] || 'Unknown')).trim();
      const date = r['Date of PD Session'] || '';
      const key  = num + '||' + date;
      if (!map[key]) map[key] = { sessionNum: num, date: date, facilitators: '', rows: [] };
      map[key].rows.push(r);
      // Rule 9.2 — Facilitators is a comma-separated string inside quotes; parse with parseMultiSelect
      if (!map[key].facilitators && r['Facilitator(s)']) {
        map[key].facilitators = parseMultiSelect(r['Facilitator(s)']).join(', ');
      }
    });
    return Object.values(map).sort((a, b) => new Date(b.date) - new Date(a.date));
  }

  function buildPDOpenResponses(rows, sessionNums) {
    let html = `<div class="ta-card">
      <div class="ta-card-title">Open Response Feed</div>
      <div id="tdPdResponsesList">`;

    rows.slice(0, 30).forEach(r => {
      const takeaway = (r['What is one key takeaway or strategy you plan to apply at your site?'] || '').trim();
      const comment  = (r['Any additional comments, feedback, or shoutouts?'] || '').trim();
      if (!takeaway && !comment) return;
      html += `<div class="td-check-row" data-session="${r['PD Session Number']}" data-role="${r['Role']}">
        <div style="flex:1">
          ${takeaway ? `<div style="margin-bottom:.25rem"><span style="font-size:.65rem;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:#e76f51">Takeaway</span><div style="font-size:.83rem;margin-top:.15rem">${takeaway}</div></div>` : ''}
          ${comment  ? `<div><span style="font-size:.65rem;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--muted)">Comment</span><div style="font-size:.83rem;color:var(--muted);margin-top:.15rem">${comment}</div></div>` : ''}
          <div style="font-size:.7rem;color:var(--muted);margin-top:.25rem">Session ${(r['PD Session Number '] || r['PD Session Number'] || '?').trim()} · ${r['Role'] || 'Unknown role'} · ${dateLabel(r['Date of PD Session'])}</div>
        </div>
      </div>`;
    });

    html += `</div></div>`;
    return html;
  }

  function renderPDCharts(rows) {
    // Focus areas chart
    const allFocus = [];
    rows.forEach(r => {
      const raw = r['What focus areas need additional support?'] || '';
      raw.split(',').map(v => v.trim()).filter(Boolean).forEach(v => allFocus.push(v));
    });
    const focusFreq = countFreq(allFocus).slice(0, 12);

    if (focusFreq.length) {
      makeChart('tdPdFocusChart', {
        type: 'bar',
        data: {
          labels: focusFreq.map(([l]) => l.length > 30 ? l.slice(0, 28) + '…' : l),
          datasets: [{ label: 'Responses', data: focusFreq.map(([, n]) => n), backgroundColor: '#e76f51', borderRadius: 4 }]
        },
        options: {
          indexAxis: 'y',
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { display: false }, tooltip: { enabled: true } },
          scales: { x: { beginAtZero: true, ticks: { precision: 0 } } }
        }
      });
    }

    // Rule 8 — Rating trends: grouped bar chart (one group per session, 5 bars per group)
    // Line charts fail when values cluster between 3.5–5.0; use grouped bar instead
    const sessions = groupSessions(rows);
    const sessionsSorted = sessions.slice().reverse();
    const sessionLabels  = sessionsSorted.map(s => `S${s.sessionNum}`);
    const barColors      = ['#e76f51', '#457b9d', '#2a9d8f', '#e9c46a', '#264653'];

    const ratingDatasets = PD_RATING_FIELDS.map((field, fi) => ({
      label: PD_RATING_SHORT[fi],
      data: sessionsSorted.map(s => {
        const vals = s.rows.map(r => parseFloat(r[field])).filter(n => !isNaN(n));
        return vals.length ? parseFloat((vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(2)) : null;
      }),
      backgroundColor: barColors[fi],
      borderRadius: 3,
    }));

    makeChart('tdPdTrendsChart', {
      type: 'bar',
      data: { labels: sessionLabels, datasets: ratingDatasets },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom', labels: { font: { size: 11 } } },
          tooltip: { enabled: true },
          datalabels: {
            anchor: 'end', align: 'top',
            font: { size: 9 },
            formatter: v => v != null ? v.toFixed(1) : ''
          }
        },
        // Rule 8 — y-axis min 2.5, max 5.5 so differences are visible
        scales: { y: { min: 2.5, max: 5.5, ticks: { stepSize: 0.5 } } }
      }
    });

    // Role breakdown donut
    const roleFreq = countFreq(rows.map(r => r['Role']).filter(Boolean));
    const roleColors = ['#e76f51','#457b9d','#2a9d8f','#e9c46a','#264653','#6b21a8'];
    makeChart('tdPdRoleChart', {
      type: 'doughnut',
      data: {
        labels: roleFreq.map(([l]) => l),
        datasets: [{ data: roleFreq.map(([, n]) => n), backgroundColor: roleColors }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { position: 'right', labels: { font: { size: 11 }, boxWidth: 14 } }, tooltip: { enabled: true } }
      }
    });

    // Experience distribution
    const expFreq = countFreq(rows.map(r => r['Years of Experience in Tutoring / Education']).filter(Boolean));
    makeChart('tdPdExpChart', {
      type: 'bar',
      data: {
        labels: expFreq.map(([l]) => l),
        datasets: [{ label: 'Respondents', data: expFreq.map(([, n]) => n), backgroundColor: '#457b9d', borderRadius: 4 }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false }, tooltip: { enabled: true } },
        scales: { y: { beginAtZero: true, ticks: { precision: 0 } } }
      }
    });
  }

  window.applyPDFilter = function() {
    if (!_pdData) return;
    const sessionVal = (document.getElementById('tdPdSessionFilter') || {}).value || '';
    const roleVal    = (document.getElementById('tdPdRoleFilter') || {}).value || '';
    const seasonVal  = ((document.getElementById('tdPdSeasonFilter') || {}).value || '').toLowerCase();
    const expVal     = (document.getElementById('tdPdExpFilter') || {}).value || '';
    const focusVal   = (document.getElementById('tdPdFocusFilter') || {}).value || '';

    const filtered = _pdData.filter(r => {
      if (!isValidRow(r, 'pd')) return false;
      // Rule 9.3 — trailing space fallback
      const sessionNum = ((r['PD Session Number '] || r['PD Session Number'] || '')).trim();
      if (sessionVal && sessionNum !== sessionVal) return false;
      if (roleVal && (r['Role'] || '') !== roleVal) return false;
      if (seasonVal) {
        const m = (() => { const d = new Date(r['Date of PD Session']); return isNaN(d) ? 0 : d.getMonth() + 1; })();
        const s = m >= 9 && m <= 11 ? 'fall' : (m === 12 || m === 1 || m === 2) ? 'winter' : m >= 3 && m <= 5 ? 'spring' : 'summer';
        if (s !== seasonVal) return false;
      }
      if (expVal && (r['Years of Experience in Tutoring / Education'] || '') !== expVal) return false;
      if (focusVal) {
        // Rule 4 — multi-select: any of the parsed tags must match
        const tags = parseMultiSelect(r['What focus areas need additional support?']);
        if (!tags.some(t => t === focusVal)) return false;
      }
      return true;
    });

    renderPDContent(filtered);
  };

  window.filterPDResponses = function() {
    // Legacy backward compat — delegate to applyPDFilter
    window.applyPDFilter();
  };


  // ══════════════════════════════════════════════════════════════════
  //  SUB-TAB 2: TRAINING INTAKE
  // ══════════════════════════════════════════════════════════════════

  const INTAKE_RATING_FIELDS = [
    { field: 'Overall, how would you rate the effectiveness of the training? (1 = Did not meet expectations, 5 = Exceeded expectations)', short: 'Overall Effectiveness' },
    { field: 'The training itinerary/setup was clear and well-structured. (1 = Strongly disagree, 5 = Strongly agree)', short: 'Clear Structure' },
    { field: 'The training materials (slides and videos) were useful in preparing me for my role. (1 = Strongly disagree, 5 = Strongly agree)', short: 'Materials Useful' },
    { field: 'The trainers were knowledgeable and responsive to questions. (1 = Strongly disagree, 5 = Strongly agree)', short: 'Trainer Quality' },
    { field: 'After completing training, how prepared do you feel to begin working with scholars? (1 = Very unprepared, 5 = Extremely prepared)', short: 'Preparedness' },
    { field: 'The asynchronous videos allowed for a more individualized training experience. (1 = Strongly disagree, 5 = Strongly agree)', short: 'Async Videos' },
    { field: 'How easy was it to access and navigate Google Classroom?', short: 'GC Navigation' },
    { field: 'How well-organized were the training modules, assessments, and resources in Google Classroom?', short: 'GC Organization' },
    { field: 'To what extent did the Google Classroom layout support your understanding of the training material?', short: 'GC Layout Support' },
    { field: 'How effective was Google Classroom in providing timely updates, announcements, or reminders regarding course work?', short: 'GC Updates' },
  ];

  async function renderIntakeTab() {
    const el = document.getElementById('td-content-intake');
    if (!el) return;
    el.innerHTML = loadingHTML('Loading training intake data…');
    try {
      if (!_intakeData) {
        const text = await fetchCSV(TRAINING_INTAKE_URL);
        // Rule 9.6 — detect whether row 0 or row 1 is the real header (Timestamp check)
        let parsed = parseCsvText(text, 0);
        if (!parsed.headers[0] || parsed.headers[0].trim() !== 'Timestamp') {
          parsed = parseCsvText(text, 1); // row 0 is blank; row 1 is the header
          if (!parsed.headers[0] || parsed.headers[0].trim() !== 'Timestamp') {
            throw new Error('Intake CSV header not found. Expected "Timestamp" in column A.');
          }
        }
        _intakeData = parsed.rows.filter(r => isValidRow(r, 'intake'));
      }
      el.innerHTML = buildIntakeHTML(_intakeData);
      renderIntakeContent(_intakeData);
    } catch (e) {
      el.innerHTML = errorHTML(e.message, 'function(){_tdLoaded["intake"]=false;renderIntakeTab();}');
    }
  }

  function buildIntakeHTML(rows) {
    if (!rows.length) return '<div class="td-error">No training intake data found.</div>';

    const allRoles    = [...new Set(rows.map(r => r['What is your role within NJTC? (Select one)']).filter(Boolean))].sort();
    const allCerts    = [...new Set(rows.map(r => r['What is your current certification status? (Select one)']).filter(Boolean))].sort();
    const allDistricts = [...new Set(rows.map(r => r['What District are you assigned to?']).filter(Boolean))].sort();
    const allSchools  = [...new Set(rows.map(r => r['What School Location are you assigned to?']).filter(Boolean))].sort();
    // Rule 4/7 — Grade Level is multi-select; get distinct tags
    const gradeTags   = countTags(rows, 'Which grade level(s) do you work with? (Select all that apply)').map(([tag]) => tag);

    return `<div style="display:flex;gap:.5rem;flex-wrap:wrap;margin-bottom:1.25rem;align-items:center">
      <span style="font-size:.75rem;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.07em">Filter</span>
      <select class="filter-select" id="tdIntakeRoleFilter" onchange="applyIntakeFilter()">
        <option value="">All Roles</option>
        ${allRoles.map(r => `<option>${r}</option>`).join('')}
      </select>
      <select class="filter-select" id="tdIntakeHireFilter" onchange="applyIntakeFilter()">
        <option value="">New &amp; Returning</option>
        <option value="new">New Hires</option>
        <option value="returning">Returning</option>
      </select>
      <select class="filter-select" id="tdIntakeCertFilter" onchange="applyIntakeFilter()">
        <option value="">All Certifications</option>
        ${allCerts.map(c => `<option>${c}</option>`).join('')}
      </select>
      <select class="filter-select" id="tdIntakeDistrictFilter" onchange="applyIntakeFilter()">
        <option value="">All Districts</option>
        ${allDistricts.map(d => `<option>${d}</option>`).join('')}
      </select>
      <select class="filter-select" id="tdIntakeSchoolFilter" onchange="applyIntakeFilter()">
        <option value="">All Schools</option>
        ${allSchools.map(s => `<option>${s}</option>`).join('')}
      </select>
      <select class="filter-select" id="tdIntakeGradeFilter" onchange="applyIntakeFilter()">
        <option value="">All Grade Levels</option>
        ${gradeTags.map(g => `<option>${g}</option>`).join('')}
      </select>
      <span id="tdIntakeFilterCount" style="font-size:.75rem;color:var(--muted)"></span>
    </div>
    <div id="tdIntakeContent"></div>`;
  }

  function renderIntakeContent(filteredRows) {
    const container = document.getElementById('tdIntakeContent');
    if (!container) return;

    if (!filteredRows.length) {
      container.innerHTML = '<div class="td-error">No responses match the current filters.</div>';
      const countEl = document.getElementById('tdIntakeFilterCount');
      if (countEl) countEl.textContent = '0 of ' + (_intakeData ? _intakeData.length : 0) + ' responses';
      return;
    }

    const rows = filteredRows;
    const total = rows.length;
    const newHires = rows.filter(r => (r['Are you a new or returning hire? (Select one)'] || '').toLowerCase().includes('new')).length;
    const certified = rows.filter(r => {
      const s = (r['What is your current certification status? (Select one)'] || '').toLowerCase();
      return s.includes('certified') && !s.includes('not') && !s.includes('non') && !s.includes('in progress');
    }).length;

    const effectivenessVals = rows.map(r => parseFloat(r['Overall, how would you rate the effectiveness of the training? (1 = Did not meet expectations, 5 = Exceeded expectations)'])).filter(n => !isNaN(n));
    const avgEffectiveness = effectivenessVals.length ? effectivenessVals.reduce((s, n) => s + n, 0) / effectivenessVals.length : 0;

    const prepVals = rows.map(r => parseFloat(r['After completing training, how prepared do you feel to begin working with scholars? (1 = Very unprepared, 5 = Extremely prepared)'])).filter(n => !isNaN(n));
    const avgPrep = prepVals.length ? prepVals.reduce((s, n) => s + n, 0) / prepVals.length : 0;

    const wantAsset = rows.filter(r => (r['Would you like additional training on implementing an asset-based mindset in training?'] || '').toLowerCase().startsWith('y')).length;
    const pctWantAsset = pct(wantAsset, total);

    let html = `<div class="ta-grid ta-grid-3" style="margin-bottom:1.25rem">
      ${kpiCard(total, 'Total Responses', '#0050c8')}
      ${kpiCard(pct(newHires, total) + '%', 'New Hires', '#e76f51')}
      ${kpiCard(pct(certified, total) + '%', 'Certified Staff', '#2a9d8f')}
    </div>
    <div class="ta-grid ta-grid-3" style="margin-bottom:1.5rem">
      ${kpiCard(avgEffectiveness.toFixed(1) + '/5', 'Avg Training Effectiveness', avgEffectiveness >= 4 ? '#059669' : '#d97706')}
      ${kpiCard(avgPrep.toFixed(1) + '/5', 'Avg Preparedness Score', avgPrep >= 4 ? '#059669' : '#d97706')}
      ${kpiCard(pctWantAsset + '%', 'Want More Asset-Based Training', pctWantAsset >= 50 ? '#d97706' : '#059669')}
    </div>`;

    // Ratings summary
    html += `<div class="ta-card" style="margin-bottom:1.25rem">
      <div class="ta-card-title">Ratings Summary (All Dimensions)</div>
      <div class="td-chart-wrap"><canvas id="tdIntakeRatingsChart"></canvas></div>
    </div>`;

    // Role & hire type grid
    html += `<div class="ta-grid ta-grid-2" style="margin-bottom:1.25rem">
      <div class="ta-card">
        <div class="ta-card-title">Role Distribution</div>
        <div class="td-chart-wrap-sm"><canvas id="tdIntakeRoleChart"></canvas></div>
      </div>
      <div class="ta-card">
        <div class="ta-card-title">New vs Returning Hire</div>
        <div class="td-chart-wrap-sm"><canvas id="tdIntakeHireChart"></canvas></div>
      </div>
    </div>`;

    // District distribution
    html += `<div class="ta-card" style="margin-bottom:1.25rem">
      <div class="ta-card-title">District Distribution</div>
      <div style="overflow-x:auto" id="tdIntakeDistrictTable">${buildIntakeDistrictTable(rows)}</div>
    </div>`;

    // Grade levels
    html += `<div class="ta-card" style="margin-bottom:1.25rem">
      <div class="ta-card-title">Grade Levels Worked With</div>
      <div class="td-chart-wrap-sm"><canvas id="tdIntakeGradeChart"></canvas></div>
    </div>`;

    // Google Classroom panel
    html += buildGCPanel(rows);

    // Open feedback
    html += buildIntakeFeedback(rows);

    container.innerHTML = html;

    // Update filter count badge
    const countEl = document.getElementById('tdIntakeFilterCount');
    if (countEl) countEl.textContent = total + ' of ' + (_intakeData ? _intakeData.length : total) + ' responses';

    // Render charts after DOM update
    setTimeout(() => renderIntakeCharts(rows), 50);
  }

  function buildIntakeDistrictTable(rows) {
    const distFreq = countFreq(rows.map(r => (r['What District are you assigned to?'] || 'Unknown')).filter(Boolean));
    return `<table class="ta-table">
      <thead><tr><th>District</th><th>Responses</th><th>% Share</th></tr></thead>
      <tbody>${distFreq.map(([d, n]) =>
        `<tr data-district="${d.toLowerCase()}">
          <td>${d}</td>
          <td><strong>${n}</strong></td>
          <td>
            <div style="display:flex;align-items:center;gap:.5rem">
              <div style="flex:1;height:5px;background:var(--border);border-radius:3px"><div style="height:100%;width:${pct(n, rows.length)}%;background:#0050c8;border-radius:3px"></div></div>
              <span style="font-size:.75rem">${pct(n, rows.length)}%</span>
            </div>
          </td>
        </tr>`).join('')}
      </tbody>
    </table>`;
  }

  function buildGCPanel(rows) {
    const gcFields = [
      { field: 'How easy was it to access and navigate Google Classroom?', short: 'Navigation Ease' },
      { field: 'How well-organized were the training modules, assessments, and resources in Google Classroom?', short: 'Organization' },
      { field: 'To what extent did the Google Classroom layout support your understanding of the training material?', short: 'Layout Support' },
      { field: 'How effective was Google Classroom in providing timely updates, announcements, or reminders regarding course work?', short: 'Updates/Reminders' },
    ];
    const hasTechIssues = rows.filter(r => {
      const v = (r['Were there any technical issues you experienced while using Google Classroom?'] || '').toLowerCase();
      return v !== '' && v !== 'no' && v !== 'none' && v !== 'n/a';
    }).length;
    const understoodGC = rows.filter(r => {
      const v = (r['Did you clearly understand how to use Google Classroom for all required tasks (e.g., submitting assignments, watching videos, completing assessments)?'] || '').toLowerCase();
      return v.startsWith('y');
    }).length;

    let html = `<div class="ta-card" style="margin-bottom:1.25rem">
      <div class="ta-card-title">Google Classroom Experience</div>
      <div class="ta-grid ta-grid-4" style="margin-bottom:1rem">`;

    gcFields.forEach(f => {
      const vals = rows.map(r => parseFloat(r[f.field])).filter(n => !isNaN(n));
      const a = vals.length ? vals.reduce((s, n) => s + n, 0) / vals.length : 0;
      html += `<div class="ta-card" style="padding:.75rem">
        <div style="font-size:1.4rem;font-weight:800;color:${a>=4?'#059669':'#d97706'}">${a.toFixed(1)}</div>
        <div style="font-size:.72rem;color:var(--muted)">${f.short}</div>
      </div>`;
    });
    html += `</div>
      <div class="ta-grid ta-grid-2">
        ${kpiCard(pct(hasTechIssues, rows.length) + '%', 'Reported Tech Issues', hasTechIssues > 0 ? '#d97706' : '#059669')}
        ${kpiCard(pct(understoodGC, rows.length) + '%', 'Understood GC Tasks', understoodGC / rows.length >= 0.8 ? '#059669' : '#d97706')}
      </div>
    </div>`;
    return html;
  }

  function buildIntakeFeedback(rows) {
    let html = `<div class="ta-card">
      <div class="ta-card-title">Open Feedback & Reflections</div>`;
    rows.slice(0, 25).forEach(r => {
      const reflection = (r['Please share 1-3 reflections from training, including strengths and areas for improvement.'] || '').trim();
      const final = (r['Any final comments or feedback regarding your training experience?'] || '').trim();
      if (!reflection && !final) return;
      html += `<div class="td-check-row">
        <div style="flex:1">
          ${reflection ? `<div style="margin-bottom:.25rem"><span style="font-size:.65rem;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:#457b9d">Reflection</span><div style="font-size:.83rem;margin-top:.15rem">${reflection}</div></div>` : ''}
          ${final ? `<div><span style="font-size:.65rem;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--muted)">Final Comment</span><div style="font-size:.83rem;color:var(--muted);margin-top:.15rem">${final}</div></div>` : ''}
          <div style="font-size:.7rem;color:var(--muted);margin-top:.2rem">${r['What is your role within NJTC? (Select one)'] || ''} · ${r['Are you a new or returning hire? (Select one)'] || ''}</div>
        </div>
      </div>`;
    });
    html += `</div>`;
    return html;
  }

  function renderIntakeCharts(rows) {
    // Ratings bar chart
    const avgRatings = INTAKE_RATING_FIELDS.map(f => {
      const vals = rows.map(r => parseFloat(r[f.field])).filter(n => !isNaN(n));
      return vals.length ? parseFloat((vals.reduce((s, n) => s + n, 0) / vals.length).toFixed(2)) : 0;
    });
    const barColors = avgRatings.map(v => v >= 4 ? '#10b981' : v >= 3 ? '#f59e0b' : '#ef4444');

    makeChart('tdIntakeRatingsChart', {
      type: 'bar',
      data: {
        labels: INTAKE_RATING_FIELDS.map(f => getDisplayLabel(f.field) || f.short),
        datasets: [{ label: 'Avg Score', data: avgRatings, backgroundColor: barColors, borderRadius: 4 }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { display: false }, tooltip: { enabled: true },
          // Rule 8 — data labels on every bar
          datalabels: { anchor: 'end', align: 'top', font: { size: 10 }, formatter: v => v.toFixed(1) }
        },
        // Rule 8 — y-min 2.5 so differences are visible on 1-5 scale
        scales: { y: { min: 2.5, max: 5.5, ticks: { stepSize: 0.5 } } }
      }
    });

    // Role donut
    const roleFreq = countFreq(rows.map(r => r['What is your role within NJTC? (Select one)']).filter(Boolean));
    const donutColors = ['#e76f51','#457b9d','#2a9d8f','#e9c46a','#264653','#6b21a8'];
    makeChart('tdIntakeRoleChart', {
      type: 'doughnut',
      data: { labels: roleFreq.map(([l]) => l), datasets: [{ data: roleFreq.map(([, n]) => n), backgroundColor: donutColors }] },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { position: 'right', labels: { font: { size: 10 }, boxWidth: 12 } }, tooltip: { enabled: true } }
      }
    });

    // New vs returning donut
    const hireFreq = countFreq(rows.map(r => r['Are you a new or returning hire? (Select one)']).filter(Boolean));
    makeChart('tdIntakeHireChart', {
      type: 'doughnut',
      data: { labels: hireFreq.map(([l]) => l), datasets: [{ data: hireFreq.map(([, n]) => n), backgroundColor: ['#10b981','#3b82f6','#f59e0b'] }] },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { position: 'right', labels: { font: { size: 10 }, boxWidth: 12 } }, tooltip: { enabled: true } }
      }
    });

    // Grade levels
    const gradeAll = [];
    rows.forEach(r => {
      const raw = r['Which grade level(s) do you work with? (Select all that apply)'] || '';
      raw.split(',').map(v => v.trim()).filter(Boolean).forEach(v => gradeAll.push(v));
    });
    const gradeFreq = countFreq(gradeAll);
    makeChart('tdIntakeGradeChart', {
      type: 'bar',
      data: {
        labels: gradeFreq.map(([l]) => l),
        datasets: [{ label: 'Staff Count', data: gradeFreq.map(([, n]) => n), backgroundColor: '#457b9d', borderRadius: 4 }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false }, tooltip: { enabled: true } },
        scales: { y: { beginAtZero: true, ticks: { precision: 0 } } }
      }
    });
  }

  window.applyIntakeFilter = function() {
    if (!_intakeData) return;
    const roleVal     = (document.getElementById('tdIntakeRoleFilter') || {}).value || '';
    const hireVal     = ((document.getElementById('tdIntakeHireFilter') || {}).value || '').toLowerCase();
    const certVal     = (document.getElementById('tdIntakeCertFilter') || {}).value || '';
    const districtVal = (document.getElementById('tdIntakeDistrictFilter') || {}).value || '';
    const schoolVal   = (document.getElementById('tdIntakeSchoolFilter') || {}).value || '';
    const gradeVal    = (document.getElementById('tdIntakeGradeFilter') || {}).value || '';

    // Cascade: when district changes, rebuild school options
    const schoolSel = document.getElementById('tdIntakeSchoolFilter');
    if (schoolSel && districtVal) {
      const schoolsInDist = [...new Set(
        _intakeData
          .filter(r => (r['What District are you assigned to?'] || '') === districtVal)
          .map(r => r['What School Location are you assigned to?'])
          .filter(Boolean)
      )].sort();
      const curSchool = schoolSel.value;
      schoolSel.innerHTML = `<option value="">All Schools</option>` +
        schoolsInDist.map(s => `<option ${s === curSchool ? 'selected' : ''}>${s}</option>`).join('');
    }

    const filtered = _intakeData.filter(r => {
      if (!isValidRow(r, 'intake')) return false;
      if (roleVal && (r['What is your role within NJTC? (Select one)'] || '') !== roleVal) return false;
      if (hireVal) {
        const hireStr = (r['Are you a new or returning hire? (Select one)'] || '').toLowerCase();
        if (hireVal === 'new' && !hireStr.includes('new')) return false;
        if (hireVal === 'returning' && !hireStr.includes('returning')) return false;
      }
      if (certVal && (r['What is your current certification status? (Select one)'] || '') !== certVal) return false;
      if (districtVal && (r['What District are you assigned to?'] || '') !== districtVal) return false;
      if (schoolVal && (r['What School Location are you assigned to?'] || '') !== schoolVal) return false;
      if (gradeVal) {
        // Rule 4 — multi-select field
        const tags = parseMultiSelect(r['Which grade level(s) do you work with? (Select all that apply)']);
        if (!tags.some(t => t === gradeVal)) return false;
      }
      return true;
    });

    renderIntakeContent(filtered);
  };

  window.filterIntakeTable = function() {
    // Legacy backward compat — delegate to applyIntakeFilter
    window.applyIntakeFilter();
  };


  // ══════════════════════════════════════════════════════════════════
  //  SUB-TAB 3: TUTOR OBSERVATIONS
  // ══════════════════════════════════════════════════════════════════

  const OBS_MONTHS = ['Oct','Nov','Dec','Jan','Feb','Mar','Apr'];

  async function renderTutorObsTab() {
    const el = document.getElementById('td-content-tutor-obs');
    if (!el) return;
    el.innerHTML = loadingHTML('Loading tutor observation data…');
    try {
      if (!_tutorObsData) {
        const gids = await discoverApprentGids();
        const gid = gids['Tutor Observations'];
        if (!gid) throw new Error('Could not find "Tutor Observations" tab in apprenticeship workbook. GIDs: ' + JSON.stringify(gids));
        const text = await fetchCSV(apprentUrl(gid));
        // Row 1 title, Row 2 header → skip index 0
        const parsed = parseCsvText(text, 1);
        _tutorObsData = parsed.rows.filter(r => isValidRow(r, 'tutor-obs'));
      }
      el.innerHTML = buildTutorObsHTML(_tutorObsData);
      // Rule 7 — Active Status defaults to "Active" on load
      setTimeout(() => {
        renderTutorObsCharts(_tutorObsData);
        filterTutorObsTable();
      }, 50);
    } catch (e) {
      el.innerHTML = errorHTML(e.message, 'function(){_tdLoaded["tutor-obs"]=false;renderTutorObsTab();}');
    }
  }

  function buildTutorObsHTML(rows) {
    if (!rows.length) return '<div class="td-error">No tutor observation data found.</div>';

    const active = rows.filter(r => (r['Active Status'] || '').toLowerCase().includes('active') || (r['Active Status'] || '').trim() === '');
    const terminated = rows.filter(r => (r['Active Status'] || '').toLowerCase().includes('terminat') || (r['Active Status'] || '').toLowerCase().includes('inactive'));
    const total = rows.length;

    // Count observations
    const withObs = rows.filter(r => OBS_MONTHS.some(m => isObserved(r[m]))).length;
    const with3Plus = rows.filter(r => OBS_MONTHS.filter(m => isObserved(r[m])).length >= 3).length;
    const totalObsEvents = rows.reduce((sum, r) => sum + OBS_MONTHS.filter(m => isObserved(r[m])).length, 0);

    let html = `<div class="ta-grid ta-grid-4" style="margin-bottom:1.25rem">
      ${kpiCard(active.length, 'Active Tutors', '#059669')}
      ${kpiCard(terminated.length, 'Terminated', terminated.length > 0 ? '#b91c1c' : '#6b7280')}
      ${kpiCard(pct(withObs, total) + '%', '≥1 Observation', total && withObs/total >= 0.8 ? '#059669' : '#d97706')}
      ${kpiCard(pct(with3Plus, total) + '%', '3+ Months Observed', total && with3Plus/total >= 0.5 ? '#059669' : '#d97706')}
    </div>
    <div class="ta-grid ta-grid-2" style="margin-bottom:1.25rem">
      ${kpiCard(totalObsEvents, 'Total Obs Events', '#0050c8')}
      ${kpiCard(total, 'Total Tutors Tracked', '#7b2d8b')}
    </div>`;

    // Coverage by month chart
    html += `<div class="ta-card" style="margin-bottom:1.25rem">
      <div class="ta-card-title">Monthly Observation Coverage</div>
      <div class="td-chart-wrap"><canvas id="tdTutorObsCoverageChart"></canvas></div>
    </div>`;

    // Obs rate by district
    html += `<div class="ta-card" style="margin-bottom:1.25rem">
      <div class="ta-card-title">Observation Rate by District (80% Benchmark)</div>
      <div class="td-chart-wrap"><canvas id="tdTutorObsDistrictChart"></canvas></div>
    </div>`;

    // Rule 7 — all filters dynamically populated from live data
    const regions     = [...new Set(rows.map(r => r['Region']).filter(Boolean))].sort();
    const districts   = [...new Set(rows.map(r => r['District']).filter(Boolean))].sort();
    const schools     = [...new Set(rows.map(r => r['School']).filter(Boolean))].sort();
    const siteLeaders = [...new Set(rows.map(r => r['Site Leader']).filter(Boolean))].sort();
    const roles       = [...new Set(rows.map(r => r['Role']).filter(Boolean))].sort();
    const statuses    = [...new Set(rows.map(r => r['Active Status']).filter(Boolean))].sort();

    html += `<div class="ta-card" style="margin-bottom:1.25rem">
      <div class="ta-card-title">Observation Status Table</div>
      <div style="display:flex;gap:.5rem;flex-wrap:wrap;margin-bottom:.875rem">
        <select class="filter-select" id="tdTutorRegionFilter" onchange="filterTutorObsTable()">
          <option value="">All Regions</option>
          ${regions.map(r => `<option>${r}</option>`).join('')}
        </select>
        <select class="filter-select" id="tdTutorDistFilter" onchange="filterTutorObsTable()">
          <option value="">All Districts</option>
          ${districts.map(d => `<option>${d}</option>`).join('')}
        </select>
        <select class="filter-select" id="tdTutorSchoolFilter" onchange="filterTutorObsTable()">
          <option value="">All Schools</option>
          ${schools.map(s => `<option>${s}</option>`).join('')}
        </select>
        <select class="filter-select" id="tdTutorSLFilter" onchange="filterTutorObsTable()">
          <option value="">All Site Leaders</option>
          ${siteLeaders.map(s => `<option>${s}</option>`).join('')}
        </select>
        <select class="filter-select" id="tdTutorRoleFilter" onchange="filterTutorObsTable()">
          <option value="">All Roles</option>
          ${roles.map(r => `<option>${r}</option>`).join('')}
        </select>
        <select class="filter-select" id="tdTutorStatusFilter" onchange="filterTutorObsTable()">
          <option value="">All Statuses</option>
          ${statuses.map(s => `<option ${s === 'Active' ? 'selected' : ''}>${s}</option>`).join('')}
        </select>
        <select class="filter-select" id="tdTutorMonthFilter" onchange="filterTutorObsTable()">
          <option value="">All Months</option>
          ${OBS_MONTHS.map(m => `<option>${m}</option>`).join('')}
        </select>
      </div>
      <div style="overflow-x:auto"><table class="ta-table" id="tdTutorObsTable">
        <thead><tr>
          <th>Tutor (Master List)</th><th>Role</th><th>District</th><th>School</th><th>Site Leader</th><th>Status</th>
          ${OBS_MONTHS.map(m => `<th>${m}</th>`).join('')}
          <th>Total</th>
        </tr></thead>
        <tbody>
          ${rows.map(r => {
            // Rule 9.4 — Master List Name as canonical identifier
            const canonicalName = (r['Master List Name'] || r['Tutor Name'] || '—').trim();
            const totalObs = OBS_MONTHS.filter(m => isObserved(r[m])).length;
            const statusRaw = (r['Active Status'] || '').trim();
            const isActive  = !statusRaw.toLowerCase().includes('terminat');
            return `<tr data-region="${(r['Region']||'').toLowerCase()}"
                        data-district="${(r['District']||'').toLowerCase()}"
                        data-school="${(r['School']||'').toLowerCase()}"
                        data-sl="${(r['Site Leader']||'').toLowerCase()}"
                        data-role="${(r['Role']||'').toLowerCase()}"
                        data-status="${statusRaw.toLowerCase()}">
              <td><strong>${canonicalName}</strong>${r['Tutor Name'] && r['Tutor Name'] !== canonicalName ? `<div style="font-size:.68rem;color:var(--muted)">${r['Tutor Name']}</div>` : ''}</td>
              <td style="font-size:.75rem">${r['Role'] || '—'}</td>
              <td style="font-size:.75rem">${r['District'] || '—'}</td>
              <td style="font-size:.75rem">${r['School'] || '—'}</td>
              <td style="font-size:.75rem">${r['Site Leader'] || '—'}</td>
              <td><span style="padding:.15rem .5rem;border-radius:4px;font-size:.7rem;font-weight:700;background:${isActive?'#dcfce7':'#fee2e2'};color:${isActive?'#166534':'#b91c1c'}">${statusRaw || 'Active'}</span></td>
              ${OBS_MONTHS.map(m => {
                const st  = obsStatus(r[m]);
                const sty = obsStatusStyle(st);
                const sym = st === 'complete' ? '✓' : st === 'pending' ? '⏳' : st === 'na' ? 'N/A' : '—';
                const tip = (r[m] && st === 'note') ? ` title="${(r[m]||'').replace(/"/g,'&quot;')}"` : '';
                return `<td><span${tip} style="${sty};padding:.15rem .35rem;border-radius:4px;font-size:.7rem;cursor:${tip?'help':'default'}">${sym}</span></td>`;
              }).join('')}
              <td><strong style="color:${totalObs>=3?'#059669':totalObs>=1?'#d97706':'#b91c1c'}">${totalObs}</strong></td>
            </tr>`;
          }).join('')}
        </tbody>
      </table></div>
    </div>`;

    // Termination tracker
    if (terminated.length) {
      html += `<div class="ta-card">
        <div class="ta-card-title" style="color:#b91c1c">Termination Tracker (${terminated.length})</div>
        <div style="overflow-x:auto"><table class="ta-table">
          <thead><tr><th>Tutor</th><th>District</th><th>School</th><th>Site Leader</th><th>Status</th></tr></thead>
          <tbody>${terminated.map(r =>
            `<tr>
              <td><strong>${r['Tutor Name'] || r['Master List Name'] || '—'}</strong></td>
              <td style="font-size:.75rem">${r['District']||'—'}</td>
              <td style="font-size:.75rem">${r['School']||'—'}</td>
              <td style="font-size:.75rem">${r['Site Leader']||'—'}</td>
              <td style="font-size:.75rem">${r['Active Status']||'—'}</td>
            </tr>`).join('')}
          </tbody>
        </table></div>
      </div>`;
    }

    return html;
  }

  function renderTutorObsCharts(rows) {
    // Coverage by month
    const monthlyCounts = OBS_MONTHS.map(m => rows.filter(r => isObserved(r[m])).length);
    const totalRows = rows.length;
    makeChart('tdTutorObsCoverageChart', {
      type: 'bar',
      data: {
        labels: OBS_MONTHS,
        datasets: [
          {
            label: 'Observed',
            data: monthlyCounts,
            backgroundColor: monthlyCounts.map(n => pct(n, totalRows) >= 80 ? '#10b981' : '#f59e0b'),
            borderRadius: 4
          }
        ]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false }, tooltip: { enabled: true } },
        scales: { y: { beginAtZero: true, max: totalRows, ticks: { precision: 0 } } }
      }
    });

    // Obs rate by district
    const districts = [...new Set(rows.map(r => r['District']).filter(Boolean))].sort();
    const distRates = districts.map(d => {
      const dRows = rows.filter(r => r['District'] === d);
      const obs = dRows.filter(r => OBS_MONTHS.some(m => isObserved(r[m]))).length;
      return pct(obs, dRows.length);
    });
    makeChart('tdTutorObsDistrictChart', {
      type: 'bar',
      data: {
        labels: districts,
        datasets: [
          { label: 'Obs Rate %', data: distRates, backgroundColor: distRates.map(r => r >= 80 ? '#10b981' : '#f59e0b'), borderRadius: 4 },
          { label: '80% Benchmark', data: districts.map(() => 80), type: 'line', borderColor: '#ef4444', borderDash: [5, 3], borderWidth: 1.5, pointRadius: 0, fill: false }
        ]
      },
      options: {
        indexAxis: 'y',
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { position: 'bottom', labels: { font: { size: 11 } } }, tooltip: { enabled: true } },
        scales: { x: { min: 0, max: 100, ticks: { callback: v => v + '%' } } }
      }
    });
  }

  window.filterTutorObsTable = function() {
    const region = ((document.getElementById('tdTutorRegionFilter')||{}).value||'').toLowerCase();
    const dist   = ((document.getElementById('tdTutorDistFilter')||{}).value||'').toLowerCase();
    const school = ((document.getElementById('tdTutorSchoolFilter')||{}).value||'').toLowerCase();
    const sl     = ((document.getElementById('tdTutorSLFilter')||{}).value||'').toLowerCase();
    const role   = ((document.getElementById('tdTutorRoleFilter')||{}).value||'').toLowerCase();
    const status = ((document.getElementById('tdTutorStatusFilter')||{}).value||'').toLowerCase();
    const month  = ((document.getElementById('tdTutorMonthFilter')||{}).value||'').trim();

    document.querySelectorAll('#tdTutorObsTable tbody tr').forEach(tr => {
      let match = (!region || tr.dataset.region.includes(region))
        && (!dist   || tr.dataset.district.includes(dist))
        && (!school || tr.dataset.school.includes(school))
        && (!sl     || tr.dataset.sl.includes(sl))
        && (!role   || tr.dataset.role.includes(role))
        && (!status || tr.dataset.status.includes(status));
      // Rule 7 — Observation Month: only show tutors with an obs in that month
      if (match && month) {
        const monthIdx = OBS_MONTHS.indexOf(month);
        const cells = tr.querySelectorAll('td');
        // obs months start at column index 6
        if (monthIdx >= 0 && cells[6 + monthIdx]) {
          const sym = cells[6 + monthIdx].textContent.trim();
          match = sym === '✓';
        }
      }
      tr.style.display = match ? '' : 'none';
    });

    if (_tutorObsData) {
      const filtered = _tutorObsData.filter(r => {
        if (!isValidRow(r, 'tutor-obs')) return false;
        const rRegion = (r['Region'] || '').toLowerCase();
        const rDist   = (r['District'] || '').toLowerCase();
        const rSchool = (r['School'] || '').toLowerCase();
        const rSL     = (r['Site Leader'] || '').toLowerCase();
        const rRole   = (r['Role'] || '').toLowerCase();
        const rStatus = (r['Active Status'] || '').toLowerCase();
        let ok = (!region || rRegion.includes(region))
          && (!dist   || rDist.includes(dist))
          && (!school || rSchool.includes(school))
          && (!sl     || rSL.includes(sl))
          && (!role   || rRole.includes(role))
          && (!status || rStatus.includes(status));
        if (ok && month) ok = isObserved(r[month]);
        return ok;
      });

      // Re-render district chart with filtered rows
      const districts = [...new Set(filtered.map(r => r['District']).filter(Boolean))].sort();
      const distRates = districts.map(d => {
        const dRows = filtered.filter(r => r['District'] === d);
        const obs = dRows.filter(r => OBS_MONTHS.some(m => isObserved(r[m]))).length;
        return pct(obs, dRows.length);
      });
      makeChart('tdTutorObsDistrictChart', {
        type: 'bar',
        data: {
          labels: districts,
          datasets: [
            { label: 'Obs Rate %', data: distRates, backgroundColor: distRates.map(r => r >= 80 ? '#10b981' : '#f59e0b'), borderRadius: 4 },
            { label: '80% Benchmark', data: districts.map(() => 80), type: 'line', borderColor: '#ef4444', borderDash: [5, 3], borderWidth: 1.5, pointRadius: 0, fill: false }
          ]
        },
        options: {
          indexAxis: 'y',
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { position: 'bottom', labels: { font: { size: 11 } } }, tooltip: { enabled: true } },
          scales: { x: { min: 0, max: 100, ticks: { callback: v => v + '%' } } }
        }
      });
    }
  };


  // ══════════════════════════════════════════════════════════════════
  //  SUB-TAB 4: SITE LEADER OBSERVATIONS
  // ══════════════════════════════════════════════════════════════════

  const SL_OBS_MONTHS = ['Oct','Nov','Jan','Feb'];

  async function renderSLObsTab() {
    const el = document.getElementById('td-content-sl-obs');
    if (!el) return;
    el.innerHTML = loadingHTML('Loading site leader observation data…');
    try {
      if (!_slObsData) {
        const gids = await discoverApprentGids();
        const gid = gids['Site Leader Obs'];
        if (!gid) throw new Error('Could not find "Site Leader Obs" tab. GIDs: ' + JSON.stringify(gids));
        const text = await fetchCSV(apprentUrl(gid));
        // Row 1 title, Row 2 header → skip index 0
        const parsed = parseCsvText(text, 1);
        _slObsData = parsed.rows.filter(r => isValidRow(r, 'sl-obs'));
      }
      el.innerHTML = buildSLObsHTML(_slObsData);
    } catch (e) {
      el.innerHTML = errorHTML(e.message, 'function(){_tdLoaded["sl-obs"]=false;renderSLObsTab();}');
    }
  }

  function buildSLObsHTML(rows) {
    if (!rows.length) return '<div class="td-error">No site leader observation data found.</div>';

    const uniqueSLs = [...new Set(rows.map(r => (r['Site Leader'] || '').trim()).filter(Boolean))];
    const totalSLs = uniqueSLs.length;
    const totalObs = rows.filter(r => isObserved(r['Observation Month'])).length;

    // % of scheduled months completed
    const expectedTotal = totalSLs * SL_OBS_MONTHS.length;
    const scheduledPct = pct(totalObs, expectedTotal);

    // Highest/lowest completion months
    const monthCounts = {};
    rows.forEach(r => {
      const m = (r['Observation Month'] || '').trim();
      if (m) monthCounts[m] = (monthCounts[m] || 0) + 1;
    });
    const monthEntries = Object.entries(monthCounts).sort((a, b) => b[1] - a[1]);
    const highestMonth = monthEntries[0] ? monthEntries[0][0] : 'N/A';
    const lowestMonth  = monthEntries.length > 1 ? monthEntries[monthEntries.length - 1][0] : 'N/A';

    let html = `<div class="ta-grid ta-grid-4" style="margin-bottom:1.25rem">
      ${kpiCard(totalSLs, 'Site Leaders Tracked', '#0050c8')}
      ${kpiCard(totalObs, 'Obs Completed', '#059669')}
      ${kpiCard(scheduledPct + '%', '% Scheduled Months Done', scheduledPct >= 75 ? '#059669' : '#d97706')}
      ${kpiCard(highestMonth, 'Highest Volume Month', '#e76f51')}
    </div>`;

    // Log table with filters
    const districts = [...new Set(rows.map(r => r['District']).filter(Boolean))].sort();

    html += `<div class="ta-card" style="margin-bottom:1.25rem">
      <div class="ta-card-title">Observation Log</div>
      <div style="display:flex;gap:.5rem;flex-wrap:wrap;margin-bottom:.875rem;align-items:center">
        <select class="filter-select" id="tdSLDistFilter" onchange="filterSLObsTable()">
          <option value="">All Districts</option>
          ${districts.map(d => `<option>${d}</option>`).join('')}
        </select>
        <select class="filter-select" id="tdSLMonthFilter" onchange="filterSLObsTable()">
          <option value="">All Months</option>
          ${SL_OBS_MONTHS.map(m => `<option>${m}</option>`).join('')}
        </select>
        <span id="tdSLKpiCount" style="font-size:.75rem;color:var(--muted);margin-left:.25rem"></span>
      </div>
      <div style="overflow-x:auto"><table class="ta-table" id="tdSLObsTable">
        <thead><tr><th>District</th><th>School</th><th>Site Leader</th><th>Obs Month</th><th>Added to Folder</th><th>Notes</th></tr></thead>
        <tbody>
          ${rows.map(r => {
            const month = (r['Observation Month'] || '').trim();
            const added = (r['Added to Shared Folder'] || '').trim();
            const notes = (r['Notes'] || '').trim();
            const link  = (r['Google Form Link'] || r['Observation Folder Link'] || '').trim();
            return `<tr data-district="${(r['District']||'').toLowerCase()}" data-month="${month.toLowerCase()}">
              <td style="font-size:.8rem">${r['District']||'—'}</td>
              <td style="font-size:.8rem">${r['School']||'—'}</td>
              <td><strong>${r['Site Leader']||'—'}</strong></td>
              <td>${month ? `${seasonBadge(parseMonthToDate(month))} ${month}` : '—'}</td>
              <td><span style="font-size:.7rem;padding:.1rem .35rem;border-radius:4px;background:${added.toLowerCase()==='yes'?'#dcfce7':'#f3f4f6'};color:${added.toLowerCase()==='yes'?'#166534':'#6b7280'}">${added||'—'}</span></td>
              <td style="font-size:.78rem;max-width:200px">${notes ? notes.slice(0, 80) + (notes.length>80?'…':'') : '<span style="color:var(--muted)">—</span>'}
                ${link ? `<a href="${link}" target="_blank" style="font-size:.68rem;color:#0050c8;display:block;margin-top:.1rem">📎 View</a>` : ''}
              </td>
            </tr>`;
          }).join('')}
        </tbody>
      </table></div>
    </div>`;

    // Timeline heatmap: rows = site leaders, cols = months (wrapped for reactive re-render)
    html += `<div id="tdSLTimeline">${buildSLTimeline(rows, uniqueSLs)}</div>`;

    // Notes feed
    const withNotes = rows.filter(r => (r['Notes'] || '').trim() !== '');
    if (withNotes.length) {
      html += `<div class="ta-card">
        <div class="ta-card-title">Notes by Site Leader</div>`;
      const byLeader = {};
      withNotes.forEach(r => {
        const sl = r['Site Leader'] || 'Unknown';
        if (!byLeader[sl]) byLeader[sl] = [];
        byLeader[sl].push(r);
      });
      Object.entries(byLeader).forEach(([leader, entries]) => {
        html += `<div style="margin-bottom:1rem">
          <div style="font-weight:700;font-size:.85rem;margin-bottom:.35rem">${leader}</div>
          ${entries.map(e => `<div class="td-check-row">
            <div style="flex:1">
              <div style="font-size:.8rem">${e['Notes']}</div>
              <div style="font-size:.7rem;color:var(--muted);margin-top:.15rem">${e['School']||''} · ${e['Observation Month']||''}</div>
            </div>
          </div>`).join('')}
        </div>`;
      });
      html += `</div>`;
    }

    return html;
  }

  function parseMonthToDate(month) {
    const map = { jan:'2026-01-01', feb:'2026-02-01', mar:'2026-03-01', apr:'2026-04-01',
                  may:'2026-05-01', jun:'2026-06-01', jul:'2026-07-01', aug:'2026-08-01',
                  sep:'2025-09-01', oct:'2025-10-01', nov:'2025-11-01', dec:'2025-12-01' };
    const key = (month || '').toLowerCase().slice(0, 3);
    return map[key] || '';
  }

  function buildSLTimeline(rows, uniqueSLs) {
    const MONTHS = SL_OBS_MONTHS;
    let html = `<div class="ta-card" style="margin-bottom:1.25rem">
      <div class="ta-card-title">Observation Timeline</div>
      <div style="overflow-x:auto"><table class="ta-table">
        <thead><tr>
          <th>Site Leader</th><th>School</th>
          ${MONTHS.map(m => `<th style="text-align:center">${m}</th>`).join('')}
          <th>Total</th>
        </tr></thead>
        <tbody>`;

    uniqueSLs.forEach(sl => {
      const slRows = rows.filter(r => (r['Site Leader'] || '').trim() === sl);
      const school = slRows[0] ? (slRows[0]['School'] || '—') : '—';
      const obsMonths = slRows.map(r => (r['Observation Month'] || '').trim().toLowerCase().slice(0, 3));
      const totalDone = MONTHS.filter(m => obsMonths.includes(m.toLowerCase())).length;

      html += `<tr>
        <td><strong>${sl}</strong></td>
        <td style="font-size:.75rem">${school}</td>
        ${MONTHS.map(m => {
          const done = obsMonths.includes(m.toLowerCase());
          return `<td style="text-align:center"><span class="td-heat-cell ${done?'td-heat-yes':'td-heat-no'}">${done?'✓':'—'}</span></td>`;
        }).join('')}
        <td style="text-align:center"><strong style="color:${totalDone===MONTHS.length?'#059669':totalDone>0?'#d97706':'#b91c1c'}">${totalDone}/${MONTHS.length}</strong></td>
      </tr>`;
    });

    html += `</tbody></table></div></div>`;
    return html;
  }

  window.filterSLObsTable = function() {
    const dist  = ((document.getElementById('tdSLDistFilter')||{}).value||'').toLowerCase();
    const month = ((document.getElementById('tdSLMonthFilter')||{}).value||'').toLowerCase();

    // Show/hide table rows
    let visibleCount = 0;
    document.querySelectorAll('#tdSLObsTable tbody tr').forEach(tr => {
      const show = (!dist || tr.dataset.district.includes(dist)) && (!month || tr.dataset.month.includes(month));
      tr.style.display = show ? '' : 'none';
      if (show) visibleCount++;
    });

    // Update KPI count badge
    const countEl = document.getElementById('tdSLKpiCount');
    if (countEl && _slObsData) {
      countEl.textContent = visibleCount + ' of ' + _slObsData.length + ' observations';
    }

    // Rebuild timeline heatmap with filtered data
    if (_slObsData) {
      const filtered = _slObsData.filter(r => {
        if (!isValidRow(r, 'sl-obs')) return false;
        const rDist  = (r['District'] || '').toLowerCase();
        const rMonth = (r['Observation Month'] || '').trim().toLowerCase();
        return (!dist || rDist.includes(dist)) && (!month || rMonth.includes(month));
      });
      const filteredSLs = [...new Set(filtered.map(r => (r['Site Leader'] || '').trim()).filter(Boolean))];
      const timelineEl = document.getElementById('tdSLTimeline');
      if (timelineEl) {
        timelineEl.innerHTML = buildSLTimeline(filtered, filteredSLs);
      }
    }
  };


  // ══════════════════════════════════════════════════════════════════
  //  SUB-TAB 5: OTJ CHECKLIST
  // ══════════════════════════════════════════════════════════════════

  // PD → OTJ domain mapping for skill gap analysis
  const PD_OTJ_MAP = [
    { pdFocus: 'Instruction (Scaffolding', otjDomains: ['Instruction'], label: 'Instruction (Scaffolding & Differentiation)' },
    { pdFocus: 'Instruction (i-Ready', otjDomains: ['Instruction', 'Planning'], label: 'Instruction (i-Ready Breakdown)' },
    { pdFocus: 'Operations (Reporting', otjDomains: ['Professionalism', 'Planning'], label: 'Operations (Reporting and Data Collection)' },
    { pdFocus: 'Policies and Procedures', otjDomains: ['Professionalism'], label: 'Policies and Procedures' },
    { pdFocus: 'Classroom Management', otjDomains: ['Instruction'], label: 'Classroom Management' },
    { pdFocus: 'Assessment', otjDomains: ['Planning', 'Instruction'], label: 'Assessment & Data Use' },
    { pdFocus: 'Communication', otjDomains: ['Professionalism'], label: 'Communication & Collaboration' },
    { pdFocus: 'Planning', otjDomains: ['Planning'], label: 'Lesson Planning' },
  ];

  async function renderOTJTab() {
    const el = document.getElementById('td-content-otj');
    if (!el) return;
    el.innerHTML = loadingHTML('Loading OTJ status data…');
    try {
      if (!_otjStatusData) {
        const gids = await discoverApprentGids();
        const gid  = gids['OTJ Status'];
        if (!gid) throw new Error('Could not find "OTJ Status" tab in apprenticeship workbook. GIDs: ' + JSON.stringify(gids));
        const text   = await fetchCSV(apprentUrl(gid));
        // Row 1 = title, Row 2 = real header → skip row 0
        const parsed = parseCsvText(text, 1);
        // Rule 9.5 — skip rows where Active Status is not "Active" or "Terminated" (parse error)
        _otjStatusData = parsed.rows.filter(r => {
          if (!(r['Master List Name'] || r['Tutor Name'] || '').trim()) return false;
          const as = (r['Active Status'] || '').trim();
          return as === '' || as === 'Active' || as === 'Terminated';
        });
      }
      el.innerHTML = buildOTJStatusHTML(_otjStatusData);
      setTimeout(() => filterOTJStatusTable(), 50);
    } catch (e) {
      el.innerHTML = errorHTML(e.message, 'function(){_tdLoaded["otj"]=false;renderOTJTab();}');
    }
  }

  function buildOTJStatusHTML(rows) {
    if (!rows.length) return '<div class="td-error">No OTJ status data found.</div>';

    const OTJ_PHASE_COLS = ['OTJ Beginning', 'OTJ Middle', 'OTJ End'];

    // KPIs
    const total      = rows.length;
    const active     = rows.filter(r => !(r['Active Status'] || '').toLowerCase().includes('terminat'));
    const terminated = rows.filter(r => (r['Active Status'] || '').toLowerCase().includes('terminat'));

    const phaseKPIs = OTJ_PHASE_COLS.map(col => ({
      label: getDisplayLabel(col),
      col,
      completed: rows.filter(r => (r[col] || '').trim() === 'Completed').length,
      inProgress: rows.filter(r => (r[col] || '').trim() === 'In Progress').length,
    }));

    let html = `<div class="ta-grid ta-grid-3" style="margin-bottom:1.25rem">
      ${kpiCard(active.length, 'Active Tutors', '#059669')}
      ${kpiCard(terminated.length, 'Terminated', terminated.length > 0 ? '#b91c1c' : '#6b7280')}
      ${kpiCard(total, 'Total Tutors Tracked', '#0050c8')}
    </div>
    <div class="ta-grid ta-grid-3" style="margin-bottom:1.25rem">
      ${phaseKPIs.map(p => kpiCard(
        p.completed + ' / ' + total,
        p.label + ' Complete',
        p.completed / total >= 0.5 ? '#059669' : '#d97706'
      )).join('')}
    </div>`;

    // Filters
    const districts = [...new Set(rows.map(r => r['District']).filter(Boolean))].sort();
    const statuses  = [...new Set(rows.map(r => r['Active Status']).filter(Boolean))].sort();
    const phaseVals = ['Completed', 'In Progress', 'Not Started', 'N/A'];

    html += `<div class="ta-card" style="margin-bottom:1.25rem">
      <div class="ta-card-title">OTJ Status by Tutor</div>
      <div style="display:flex;gap:.5rem;flex-wrap:wrap;margin-bottom:.875rem">
        <select class="filter-select" id="tdOTJStatusDistFilter" onchange="filterOTJStatusTable()">
          <option value="">All Districts</option>
          ${districts.map(d => `<option>${d}</option>`).join('')}
        </select>
        <select class="filter-select" id="tdOTJStatusStatusFilter" onchange="filterOTJStatusTable()">
          <option value="">All Statuses</option>
          ${statuses.map(s => `<option ${s === 'Active' ? 'selected' : ''}>${s}</option>`).join('')}
        </select>
        <select class="filter-select" id="tdOTJStatusBeginFilter" onchange="filterOTJStatusTable()">
          <option value="">Phase 1 — All</option>
          ${phaseVals.map(v => `<option>${v}</option>`).join('')}
        </select>
        <select class="filter-select" id="tdOTJStatusMidFilter" onchange="filterOTJStatusTable()">
          <option value="">Phase 2 — All</option>
          ${phaseVals.map(v => `<option>${v}</option>`).join('')}
        </select>
        <select class="filter-select" id="tdOTJStatusEndFilter" onchange="filterOTJStatusTable()">
          <option value="">Phase 3 — All</option>
          ${phaseVals.map(v => `<option>${v}</option>`).join('')}
        </select>
        <span id="tdOTJStatusCount" style="font-size:.75rem;color:var(--muted)"></span>
      </div>
      <div style="overflow-x:auto"><table class="ta-table" id="tdOTJStatusTable">
        <thead><tr>
          <th>Tutor (Master List)</th><th>District</th><th>School</th><th>Site Leader</th><th>Status</th>
          ${OTJ_PHASE_COLS.map(c => `<th>${getDisplayLabel(c)}</th>`).join('')}
          <th>PM Notes</th>
        </tr></thead>
        <tbody>
          ${rows.map(r => {
            // Rule 9.4 — Master List Name as canonical
            const name      = (r['Master List Name'] || r['Tutor Name'] || '—').trim();
            const statusRaw = (r['Active Status'] || '').trim();
            const isAct     = !statusRaw.toLowerCase().includes('terminat');
            const bVal = (r['OTJ Beginning'] || '').trim();
            const mVal = (r['OTJ Middle'] || '').trim();
            const eVal = (r['OTJ End'] || '').trim();
            return `<tr data-district="${(r['District']||'').toLowerCase()}"
                        data-status="${statusRaw.toLowerCase()}"
                        data-begin="${bVal}" data-mid="${mVal}" data-end="${eVal}">
              <td><strong>${name}</strong></td>
              <td style="font-size:.75rem">${r['District']||'—'}</td>
              <td style="font-size:.75rem">${r['School']||'—'}</td>
              <td style="font-size:.75rem">${r['Site Leader']||'—'}</td>
              <td><span style="padding:.15rem .5rem;border-radius:4px;font-size:.7rem;font-weight:700;background:${isAct?'#dcfce7':'#fee2e2'};color:${isAct?'#166534':'#b91c1c'}">${statusRaw||'Active'}</span></td>
              <td>${otjBadgeHTML(bVal)}</td>
              <td>${otjBadgeHTML(mVal)}</td>
              <td>${otjBadgeHTML(eVal)}</td>
              <td style="font-size:.72rem;color:var(--muted);max-width:180px">${(r['OTJ PM Notes']||'').slice(0,80)}</td>
            </tr>`;
          }).join('')}
        </tbody>
      </table></div>
    </div>`;

    // Also keep the Skill Gap analysis panel (cross-references PD + OTJ)
    if (_pdData && _otjData) {
      html += buildOTJSkillGapPanel(_otjData);
    }

    return html;
  }

  window.filterOTJStatusTable = function() {
    const dist  = ((document.getElementById('tdOTJStatusDistFilter')||{}).value||'').toLowerCase();
    const stat  = ((document.getElementById('tdOTJStatusStatusFilter')||{}).value||'').toLowerCase();
    const begin = ((document.getElementById('tdOTJStatusBeginFilter')||{}).value||'').trim();
    const mid   = ((document.getElementById('tdOTJStatusMidFilter')||{}).value||'').trim();
    const end   = ((document.getElementById('tdOTJStatusEndFilter')||{}).value||'').trim();

    let count = 0;
    document.querySelectorAll('#tdOTJStatusTable tbody tr').forEach(tr => {
      const matchPhase = (filterVal, dataVal) => {
        if (!filterVal) return true;
        if (filterVal === 'Not Started') return dataVal === '' || dataVal.startsWith('Not Started');
        return dataVal === filterVal;
      };
      const show = (!dist  || tr.dataset.district.includes(dist))
        && (!stat  || tr.dataset.status.includes(stat))
        && matchPhase(begin, tr.dataset.begin)
        && matchPhase(mid,   tr.dataset.mid)
        && matchPhase(end,   tr.dataset.end);
      tr.style.display = show ? '' : 'none';
      if (show) count++;
    });
    const countEl = document.getElementById('tdOTJStatusCount');
    if (countEl) countEl.textContent = count + ' tutors shown';
  };

  function buildOTJHTML(rows) {
    if (!rows.length) return '<div class="td-error">No OTJ checklist data found.</div>';

    const totalItems = rows.length;
    const completedItems = rows.filter(r => (r['Mark Y'] || '').trim().toUpperCase() === 'Y').length;
    const phases = [...new Set(rows.map(r => (r['Phase'] || '').trim()).filter(Boolean))];
    const domains = [...new Set(rows.map(r => (r['Competency Code'] || '').split('.')[0].trim()).filter(Boolean))];

    let html = `<div class="ta-grid ta-grid-3" style="margin-bottom:1.25rem">
      ${kpiCard(totalItems, 'Total Checklist Items', '#0050c8')}
      ${kpiCard(completedItems, 'Items Marked Complete', completedItems/totalItems >= 0.5 ? '#059669' : '#d97706')}
      ${kpiCard(pct(completedItems, totalItems) + '%', 'Overall Completion', completedItems/totalItems >= 0.5 ? '#059669' : '#d97706')}
    </div>`;

    // Phase progress summary
    html += `<div class="ta-grid ta-grid-3" id="tdOTJPhaseProgress" style="margin-bottom:1.25rem">`;
    phases.forEach(phase => {
      const phaseRows = rows.filter(r => (r['Phase']||'').trim() === phase);
      const done = phaseRows.filter(r => (r['Mark Y']||'').trim().toUpperCase() === 'Y').length;
      const p = pct(done, phaseRows.length);
      const isOverdue = phaseIsOverdue(phase);
      const showWarning = isOverdue && p < 50;
      html += `<div class="ta-card">
        ${showWarning ? `<div style="padding:.4rem .75rem;background:#fef3c7;border:1px solid #fde68a;border-radius:6px;font-size:.72rem;font-weight:700;color:#92400e;margin-bottom:.625rem">⚠️ Phase is overdue — less than 50% complete</div>` : ''}
        <div class="td-phase-hdr ${phaseClass(phase)}" style="margin-top:0">${phase}</div>
        <div style="display:flex;justify-content:space-between;margin-bottom:.25rem">
          <span style="font-size:.75rem;color:var(--muted)">${done}/${phaseRows.length} items</span>
          <span style="font-size:.75rem;font-weight:700;color:${p>=75?'#059669':p>=50?'#d97706':'#b91c1c'}">${p}%</span>
        </div>
        <div class="td-progress-bar"><div class="td-progress-fill" style="width:${p}%;background:${p>=75?'#10b981':p>=50?'#f59e0b':'#ef4444'}"></div></div>
      </div>`;
    });
    html += `</div>`;

    // Filters
    html += `<div style="display:flex;gap:.5rem;flex-wrap:wrap;margin-bottom:.875rem">
      <select class="filter-select" id="tdOTJPhaseFilter" onchange="filterOTJTable()">
        <option value="">All Phases</option>
        ${phases.map(p => `<option>${p}</option>`).join('')}
      </select>
      <select class="filter-select" id="tdOTJDomainFilter" onchange="filterOTJTable()">
        <option value="">All Domains</option>
        ${domains.map(d => `<option>${d}</option>`).join('')}
      </select>
      <input type="text" class="filter-input" id="tdOTJSearchFilter" placeholder="Search tasks…" oninput="filterOTJTable()" style="max-width:240px">
    </div>`;

    // Reference table grouped by phase then domain
    let lastPhase = null;
    let lastDomain = null;

    html += `<div class="ta-card" style="margin-bottom:1.5rem">
      <div class="ta-card-title">OTJ Checklist Reference Table</div>
      <div style="overflow-x:auto" id="tdOTJTableWrap">
        <div class="td-otj-row td-otj-hdr">
          <div>Code</div><div>Activity / Task</div><div>Look For / Evidence</div>
          <div>Complete</div><div>Date Completed</div><div>Notes</div>
        </div>`;

    phases.forEach(phase => {
      const phaseRows = rows.filter(r => (r['Phase']||'').trim() === phase);
      const phaseDomains = [...new Set(phaseRows.map(r => (r['Competency Code']||'').split('.')[0].trim()).filter(Boolean))];

      html += `<div class="td-phase-hdr ${phaseClass(phase)}" data-phase="${phase}" style="margin-top:.875rem">${phase}</div>`;

      phaseDomains.forEach(domain => {
        const domRows = phaseRows.filter(r => (r['Competency Code']||'').split('.')[0].trim() === domain);
        html += `<div class="td-domain-hdr" data-domain="${domain}">Domain: ${domain} (${domRows.length} items)</div>`;

        domRows.forEach(r => {
          const code = (r['Competency Code']||'').trim();
          const task = (r['Activity / Task']||'').trim();
          const lookFor = (r['Look For / Evidence']||'').trim();
          const markY = (r['Mark Y']||'').trim().toUpperCase() === 'Y';
          const dateComp = (r['Date Completed']||'').trim();
          const notes = (r['PM / SL Notes']||'').trim();

          html += `<div class="td-otj-row" data-phase="${phase}" data-domain="${domain}" data-task="${task.toLowerCase()}">
            <div style="font-family:monospace;font-size:.72rem;font-weight:700;color:var(--muted)">${code}</div>
            <div style="font-size:.8rem">${task}</div>
            <div style="font-size:.75rem;color:var(--muted)">${lookFor.slice(0, 120)}${lookFor.length>120?'…':''}</div>
            <div style="text-align:center"><span class="td-heat-cell ${markY?'td-heat-yes':'td-heat-no'}">${markY?'Y':'—'}</span></div>
            <div style="font-size:.72rem;color:var(--muted)">${dateComp||'—'}</div>
            <div style="font-size:.72rem;color:var(--muted)">${notes.slice(0,60)}${notes.length>60?'…':''}</div>
          </div>`;
        });
      });
    });

    html += `</div></div>`;

    // Skill gap analysis
    html += buildOTJSkillGapPanel(rows);

    // Asset-based mindset tracker
    html += buildAssetMindsetPanel(rows);

    // Print button — training dept only
    const dept = getDept();
    if (dept === 'training') {
      html += `<div style="margin-top:1rem">
        <button class="btn btn-primary" onclick="tdPrintOTJ()">🖨️ Print OTJ Checklist</button>
      </div>`;
    }

    return html;
  }

  function buildOTJSkillGapPanel(otjRows) {
    // Gather PD focus area data if available
    const pdFocusAll = [];
    if (_pdData) {
      _pdData.forEach(r => {
        const raw = r['What focus areas need additional support?'] || '';
        raw.split(',').map(v => v.trim()).filter(Boolean).forEach(v => pdFocusAll.push(v));
      });
    }

    let html = `<div class="ta-card" style="margin-bottom:1.25rem">
      <div class="ta-card-title">Skill Gap Analysis — PD Focus Areas × OTJ Domains</div>
      <div style="font-size:.8rem;color:var(--muted);margin-bottom:.875rem">
        Cross-referencing PD session focus areas with OTJ competency domains to identify aligned development opportunities.
      </div>
      <div class="ta-grid ta-grid-2">`;

    PD_OTJ_MAP.forEach(mapping => {
      const pdCount = pdFocusAll.filter(v => v.toLowerCase().includes(mapping.pdFocus.toLowerCase())).length;
      const relatedOTJ = otjRows.filter(r => {
        const code = (r['Competency Code']||'').toUpperCase();
        return mapping.otjDomains.some(d => code.startsWith(d.toUpperCase().slice(0,1)));
      });
      const completedOTJ = relatedOTJ.filter(r => (r['Mark Y']||'').trim().toUpperCase() === 'Y').length;
      const otjPct = relatedOTJ.length ? pct(completedOTJ, relatedOTJ.length) : 0;
      const hasGap = pdCount > 0 && otjPct < 50;

      html += `<div style="padding:.875rem;border:1px solid ${hasGap?'#fde68a':pdCount>0?'#bbf7d0':'var(--border)'};border-radius:8px;background:${hasGap?'#fffbeb':pdCount>0?'#f0fdf4':'var(--surface-2)'}">
        <div style="font-size:.8rem;font-weight:700;margin-bottom:.35rem">${mapping.label}</div>
        <div style="display:flex;gap:1rem;font-size:.75rem;flex-wrap:wrap">
          <span style="color:#e76f51"><strong>${pdCount}</strong> PD responses</span>
          <span>→</span>
          <span style="color:#0050c8">OTJ domains: <strong>${mapping.otjDomains.join(', ')}</strong></span>
        </div>
        <div style="margin-top:.4rem;font-size:.72rem;color:${hasGap?'#92400e':'#059669'}">
          ${hasGap ? '⚠️ Gap identified — ' : '✓ '}OTJ completion: ${otjPct}% (${completedOTJ}/${relatedOTJ.length} items)
        </div>
        ${relatedOTJ.length > 0 ? `<div style="font-size:.68rem;color:var(--muted);margin-top:.2rem">
          Codes: ${[...new Set(relatedOTJ.slice(0,5).map(r=>r['Competency Code']))].join(', ')}${relatedOTJ.length>5?'…':''}
        </div>` : ''}
      </div>`;
    });

    html += `</div></div>`;

    // Training Intake bridge
    if (_intakeData && _intakeData.length) {
      const trainingNeeds = [];
      _intakeData.forEach(r => {
        const raw = r['What new training topics or updates to current content would help enhance your role?'] || '';
        if (raw.trim()) trainingNeeds.push(raw.trim());
      });
      if (trainingNeeds.length) {
        html += `<div class="ta-card" style="margin-bottom:1.25rem">
          <div class="ta-card-title">Training Intake → OTJ Bridge: Identified Training Needs</div>
          <div style="font-size:.8rem;color:var(--muted);margin-bottom:.75rem">Top training need themes from intake survey mapped to OTJ competency areas.</div>
          <div>`;
        trainingNeeds.slice(0, 8).forEach(need => {
          const matchedDomains = PD_OTJ_MAP.filter(m => need.toLowerCase().includes(m.pdFocus.toLowerCase())).map(m => m.otjDomains).flat();
          html += `<div class="td-check-row">
            <div style="flex:1">
              <div style="font-size:.8rem">${need.slice(0, 100)}${need.length>100?'…':''}</div>
              ${matchedDomains.length ? `<div style="font-size:.7rem;color:#0050c8;margin-top:.15rem">→ OTJ domains: ${[...new Set(matchedDomains)].join(', ')}</div>` : ''}
            </div>
          </div>`;
        });
        html += `</div></div>`;
      }
    }

    return html;
  }

  function buildAssetMindsetPanel(otjRows) {
    let helpedByTraining = 0, wantMore = 0, intakeTotal = 0;
    if (_intakeData && _intakeData.length) {
      intakeTotal = _intakeData.length;
      helpedByTraining = _intakeData.filter(r => {
        const v = (r['Did the training help you understand and apply an asset-based mindset when working with scholars?'] || '').toLowerCase();
        return v.startsWith('y') || v.includes('yes') || v.includes('definitely') || v.includes('somewhat');
      }).length;
      wantMore = _intakeData.filter(r => {
        const v = (r['Would you like additional training on implementing an asset-based mindset in training?'] || '').toLowerCase();
        return v.startsWith('y');
      }).length;
    }

    // OTJ Instruction M/L codes
    const instructionMLCodes = otjRows.filter(r => {
      const code = (r['Competency Code']||'').toUpperCase();
      return (code.startsWith('I') || code.startsWith('M') || code.startsWith('L')) &&
             ((r['Activity / Task']||'').toLowerCase().includes('asset') || (r['Look For / Evidence']||'').toLowerCase().includes('asset'));
    });

    let html = `<div class="ta-card" style="margin-bottom:1.25rem">
      <div class="ta-card-title">Asset-Based Mindset Tracker</div>
      <div class="ta-grid ta-grid-3" style="margin-bottom:.875rem">
        ${kpiCard(intakeTotal ? pct(helpedByTraining, intakeTotal) + '%' : 'N/A', 'Training Helped — Asset Mindset', '#059669')}
        ${kpiCard(intakeTotal ? pct(wantMore, intakeTotal) + '%' : 'N/A', 'Want More Asset-Based Training', intakeTotal && wantMore/intakeTotal >= 0.5 ? '#d97706' : '#059669')}
        ${kpiCard(instructionMLCodes.length, 'Related OTJ Items Found', '#0050c8')}
      </div>
      ${instructionMLCodes.length ? `<div style="font-size:.8rem;color:var(--muted);margin-bottom:.5rem">Relevant OTJ Instruction/M/L Competency Codes:</div>
      <div style="display:flex;flex-wrap:wrap;gap:.35rem">
        ${instructionMLCodes.map(r => `<span style="font-family:monospace;font-size:.72rem;background:#dbeafe;color:#1e40af;padding:.15rem .4rem;border-radius:4px">${r['Competency Code']}</span>`).join('')}
      </div>` : '<div style="font-size:.8rem;color:var(--muted)">No specific asset-based mindset items identified in OTJ codes — check task descriptions manually.</div>'}
    </div>`;

    return html;
  }

  window.filterOTJTable = function() {
    const phase  = ((document.getElementById('tdOTJPhaseFilter')||{}).value||'').toLowerCase();
    const domain = ((document.getElementById('tdOTJDomainFilter')||{}).value||'').toLowerCase();
    const search = ((document.getElementById('tdOTJSearchFilter')||{}).value||'').toLowerCase();

    // Toggle phase headers and collect visible rows
    const visibleItems = [];
    document.querySelectorAll('#tdOTJTableWrap [data-phase]').forEach(el => {
      const elPhase  = (el.dataset.phase||'').toLowerCase();
      const elDomain = (el.dataset.domain||'').toLowerCase();
      const elTask   = (el.dataset.task||'').toLowerCase();

      if (el.classList.contains('td-otj-row')) {
        const show = (!phase || elPhase === phase)
          && (!domain || elDomain === domain)
          && (!search || elTask.includes(search));
        el.style.display = show ? '' : 'none';
        if (show) visibleItems.push({ phase: el.dataset.phase, domain: elDomain });
      }
    });

    // Re-render phase progress cards using only visible rows from _otjData
    const progressEl = document.getElementById('tdOTJPhaseProgress');
    if (progressEl && _otjData) {
      const visibleRows = _otjData.filter(r => {
        if (!isValidRow(r, 'otj')) return false;
        const rPhase  = (r['Phase'] || '').trim().toLowerCase();
        const rDomain = (r['Competency Code'] || '').split('.')[0].trim().toLowerCase();
        const rTask   = (r['Activity / Task'] || '').toLowerCase();
        return (!phase || rPhase === phase)
          && (!domain || rDomain === domain)
          && (!search || rTask.includes(search));
      });

      const visiblePhases = [...new Set(visibleRows.map(r => (r['Phase']||'').trim()).filter(Boolean))];
      let progressHTML = '';
      visiblePhases.forEach(ph => {
        const phaseRows = visibleRows.filter(r => (r['Phase']||'').trim() === ph);
        const done = phaseRows.filter(r => (r['Mark Y']||'').trim().toUpperCase() === 'Y').length;
        const p = pct(done, phaseRows.length);
        const isOverdue = phaseIsOverdue(ph);
        const showWarning = isOverdue && p < 50;
        progressHTML += `<div class="ta-card">
          ${showWarning ? `<div style="padding:.4rem .75rem;background:#fef3c7;border:1px solid #fde68a;border-radius:6px;font-size:.72rem;font-weight:700;color:#92400e;margin-bottom:.625rem">⚠️ Phase is overdue — less than 50% complete</div>` : ''}
          <div class="td-phase-hdr ${phaseClass(ph)}" style="margin-top:0">${ph}</div>
          <div style="display:flex;justify-content:space-between;margin-bottom:.25rem">
            <span style="font-size:.75rem;color:var(--muted)">${done}/${phaseRows.length} items</span>
            <span style="font-size:.75rem;font-weight:700;color:${p>=75?'#059669':p>=50?'#d97706':'#b91c1c'}">${p}%</span>
          </div>
          <div class="td-progress-bar"><div class="td-progress-fill" style="width:${p}%;background:${p>=75?'#10b981':p>=50?'#f59e0b':'#ef4444'}"></div></div>
        </div>`;
      });
      progressEl.innerHTML = progressHTML || '<div style="font-size:.8rem;color:var(--muted)">No phases match the current filters.</div>';
    }
  };

  window.tdPrintOTJ = function() {
    const panel = document.getElementById('td-content-otj');
    if (panel) {
      panel.closest('.panel') && panel.closest('.panel').classList.add('td-print-active');
      window.print();
      setTimeout(() => {
        panel.closest('.panel') && panel.closest('.panel').classList.remove('td-print-active');
      }, 1000);
    }
  };


  // ══════════════════════════════════════════════════════════════════
  //  SUB-TAB 6: CHECKLIST MANAGEMENT (Training Dept Only)
  // ══════════════════════════════════════════════════════════════════

  const OTJ_LS_KEY = 'njtc_otj_checklist_state';

  function loadOTJState() {
    try {
      const raw = localStorage.getItem(OTJ_LS_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (e) { return {}; }
  }

  function saveOTJState(state) {
    try { localStorage.setItem(OTJ_LS_KEY, JSON.stringify(state)); } catch (e) {}
  }

  async function renderMgmtTab() {
    const el = document.getElementById('td-content-mgmt');
    if (!el) return;
    el.innerHTML = loadingHTML('Loading checklist management…');
    try {
      if (!_otjData) {
        const gids = await discoverApprentGids();
        const gid = gids['OTJ Checklist Template'];
        if (!gid) throw new Error('Could not find "OTJ Checklist Template" tab. GIDs: ' + JSON.stringify(gids));
        const text = await fetchCSV(apprentUrl(gid));
        const parsed = parseCsvText(text, 2);
        _otjData = parsed.rows.filter(r => isValidRow(r, 'mgmt'));
      }
      el.innerHTML = buildMgmtHTML(_otjData);
      attachMgmtListeners();
    } catch (e) {
      el.innerHTML = errorHTML(e.message, 'function(){_tdLoaded["mgmt"]=false;renderMgmtTab();}');
    }
  }

  function buildMgmtHTML(rows) {
    const state = loadOTJState();
    const total = rows.length;
    const checkedCount = Object.values(state).filter(Boolean).length;
    const overallPct = pct(checkedCount, total);

    let html = `<div style="margin-bottom:1.5rem">
      <div style="font-size:2.5rem;font-weight:900;color:${overallPct>=75?'#059669':overallPct>=50?'#d97706':'#b91c1c'};line-height:1">${overallPct}%</div>
      <div style="font-size:.9rem;color:var(--muted);margin-top:.15rem">Overall Completion — ${checkedCount} of ${total} items checked</div>
      <div class="td-progress-bar" style="margin-top:.625rem;height:10px">
        <div class="td-progress-fill" style="width:${overallPct}%;background:${overallPct>=75?'#10b981':overallPct>=50?'#f59e0b':'#ef4444'}"></div>
      </div>
    </div>`;

    // Print fields
    html += `<div class="ta-card" style="margin-bottom:1.25rem">
      <div class="ta-card-title">Print Information</div>
      <div style="display:flex;gap:.75rem;flex-wrap:wrap">
        <div style="flex:1;min-width:180px">
          <label style="font-size:.75rem;font-weight:700;display:block;margin-bottom:.25rem">Tutor Name</label>
          <input type="text" id="tdMgmtTutorName" class="filter-input" placeholder="Enter tutor name…" style="width:100%">
        </div>
        <div style="flex:1;min-width:180px">
          <label style="font-size:.75rem;font-weight:700;display:block;margin-bottom:.25rem">Site / School</label>
          <input type="text" id="tdMgmtSite" class="filter-input" placeholder="Enter site name…" style="width:100%">
        </div>
        <div style="flex:1;min-width:180px">
          <label style="font-size:.75rem;font-weight:700;display:block;margin-bottom:.25rem">Date</label>
          <input type="date" id="tdMgmtDate" class="filter-input" style="width:100%" value="${new Date().toISOString().slice(0,10)}">
        </div>
      </div>
    </div>`;

    // Phase sections
    const phases = [...new Set(rows.map(r => (r['Phase']||'').trim()).filter(Boolean))];
    phases.forEach(phase => {
      const phaseRows = rows.filter(r => (r['Phase']||'').trim() === phase);
      const phaseChecked = phaseRows.filter(r => state[r['Competency Code']] === true).length;
      const phasePct = pct(phaseChecked, phaseRows.length);
      const isOverdue = phaseIsOverdue(phase);
      const showWarning = isOverdue && phasePct < 50;

      html += `<div style="margin-bottom:1.5rem">
        ${showWarning ? `<div style="padding:.5rem .875rem;background:#fef3c7;border:1px solid #fde68a;border-radius:8px;font-size:.78rem;font-weight:700;color:#92400e;margin-bottom:.625rem">
          ⚠️ Reminder: <strong>${phase}</strong> phase has passed and less than 50% of items are completed. Please review and catch up.
        </div>` : ''}
        <div class="td-phase-hdr ${phaseClass(phase)}" style="display:flex;align-items:center;justify-content:space-between">
          <span>${phase}</span>
          <span style="font-size:.75rem;font-weight:800">${phaseChecked}/${phaseRows.length} · ${phasePct}%</span>
        </div>
        <div class="td-progress-bar" style="margin-bottom:.875rem">
          <div class="td-progress-fill" id="tdMgmtProgress-${phase.replace(/\s/g,'-')}" style="width:${phasePct}%;background:${phasePct>=75?'#10b981':phasePct>=50?'#f59e0b':'#ef4444'}"></div>
        </div>`;

      // Group by domain
      const phaseDomains = [...new Set(phaseRows.map(r => (r['Competency Code']||'').split('.')[0].trim()).filter(Boolean))];
      phaseDomains.forEach(domain => {
        const domRows = phaseRows.filter(r => (r['Competency Code']||'').split('.')[0].trim() === domain);
        html += `<div class="td-domain-hdr">Domain: ${domain}</div>`;
        domRows.forEach(r => {
          const code = (r['Competency Code']||'').trim();
          const task = (r['Activity / Task']||'').trim();
          const lookFor = (r['Look For / Evidence']||'').trim();
          const checked = state[code] === true;
          html += `<div class="td-check-row" id="tdMgmtRow-${code.replace(/\./g,'-')}">
            <input type="checkbox" id="tdMgmtCheck-${code.replace(/\./g,'-')}"
              data-code="${code}"
              data-phase="${phase}"
              ${checked ? 'checked' : ''}
              onchange="tdMgmtToggle(this)">
            <div style="flex:1">
              <div class="${checked ? 'td-check-done' : ''}" style="font-size:.82rem;font-weight:600">
                <span style="font-family:monospace;font-size:.72rem;color:var(--muted);margin-right:.35rem">${code}</span>${task}
              </div>
              ${lookFor ? `<div style="font-size:.72rem;color:var(--muted);margin-top:.1rem">${lookFor.slice(0,100)}${lookFor.length>100?'…':''}</div>` : ''}
            </div>
          </div>`;
        });
      });

      html += `</div>`;
    });

    html += `<div style="margin-top:1rem;display:flex;gap:.625rem;flex-wrap:wrap">
      <button class="btn btn-primary" onclick="tdMgmtPrint()">🖨️ Print PDF</button>
      <button class="btn btn-secondary btn-sm" onclick="tdMgmtReset()" style="color:#b91c1c">Reset All Checks</button>
    </div>`;

    return html;
  }

  function attachMgmtListeners() {
    // Nothing extra needed — all done via inline handlers
  }

  window.tdMgmtToggle = function(checkbox) {
    const code = checkbox.dataset.code;
    const phase = checkbox.dataset.phase;
    const state = loadOTJState();
    state[code] = checkbox.checked;
    saveOTJState(state);

    // Update row styling
    const label = checkbox.nextElementSibling;
    if (label) {
      const textDiv = label.querySelector('div');
      if (textDiv) textDiv.classList.toggle('td-check-done', checkbox.checked);
    }

    // Update phase progress bar
    const allRows = _otjData || [];
    const phaseRows = allRows.filter(r => (r['Phase']||'').trim() === phase);
    const phaseChecked = phaseRows.filter(r => state[r['Competency Code']] === true).length;
    const phasePct = pct(phaseChecked, phaseRows.length);
    const barId = 'tdMgmtProgress-' + phase.replace(/\s/g, '-');
    const bar = document.getElementById(barId);
    if (bar) {
      bar.style.width = phasePct + '%';
      bar.style.background = phasePct >= 75 ? '#10b981' : phasePct >= 50 ? '#f59e0b' : '#ef4444';
    }

    // Update overall hero number
    const total = allRows.length;
    const totalChecked = Object.values(state).filter(Boolean).length;
    const overallPct = pct(totalChecked, total);
    const hero = document.querySelector('#td-content-mgmt > div > div:first-child');
    if (hero) {
      const num = hero.querySelector('div:first-child');
      if (num) {
        num.textContent = overallPct + '%';
        num.style.color = overallPct >= 75 ? '#059669' : overallPct >= 50 ? '#d97706' : '#b91c1c';
      }
      const sub = hero.querySelector('div:nth-child(2)');
      if (sub) sub.textContent = `Overall Completion — ${totalChecked} of ${total} items checked`;
      const bar2 = hero.querySelector('.td-progress-fill');
      if (bar2) {
        bar2.style.width = overallPct + '%';
        bar2.style.background = overallPct >= 75 ? '#10b981' : overallPct >= 50 ? '#f59e0b' : '#ef4444';
      }
    }
  };

  window.tdMgmtReset = function() {
    if (!confirm('Reset all checklist progress? This cannot be undone.')) return;
    saveOTJState({});
    _tdLoaded['mgmt'] = false;
    renderMgmtTab();
  };

  window.tdMgmtPrint = function() {
    const tutorName = (document.getElementById('tdMgmtTutorName') || {}).value || '';
    const site = (document.getElementById('tdMgmtSite') || {}).value || '';
    const date = (document.getElementById('tdMgmtDate') || {}).value || '';

    const printFrame = document.createElement('div');
    printFrame.id = 'td-print-frame';
    printFrame.classList.add('td-print-active');
    printFrame.style.display = 'none';
    printFrame.innerHTML = `
      <h1 style="font-size:1.4rem;font-weight:800;margin-bottom:.25rem">OTJ Checklist — On-the-Job Training Progress</h1>
      <div style="font-size:.85rem;margin-bottom:.5rem;color:#555">
        Tutor: <strong>${tutorName || 'N/A'}</strong> &nbsp;|&nbsp;
        Site: <strong>${site || 'N/A'}</strong> &nbsp;|&nbsp;
        Date: <strong>${date || new Date().toLocaleDateString()}</strong>
      </div>
      ${document.getElementById('td-content-mgmt').innerHTML}
    `;
    document.body.appendChild(printFrame);

    const mainPanel = printFrame.closest('.panel') || document.getElementById('td-content-mgmt').closest('.panel');
    if (mainPanel) mainPanel.classList.add('td-print-active');

    window.print();

    setTimeout(() => {
      document.body.removeChild(printFrame);
      if (mainPanel) mainPanel.classList.remove('td-print-active');
    }, 1500);
  };


  // ══════════════════════════════════════════════════════════════════
  //  EXECUTIVE PDF
  // ══════════════════════════════════════════════════════════════════

  function tdGenerateExecPDF() {
    const dept = getDept();
    if (dept !== 'data') return;

    const printFrame = document.createElement('div');
    printFrame.id = 'td-print-frame';

    const now = new Date().toLocaleDateString('en-US', { year:'numeric', month:'long', day:'numeric' });

    // ── Gather data snapshots ──
    const pdTotal = _pdData ? _pdData.length : null;
    const pdSessions = _pdData ? groupSessions(_pdData).length : null;
    const pdAvgOverall = _pdData && _pdData.length ? avg(_pdData.map(r => parseFloat(r['Overall satisfaction with this PD session'])).filter(n => !isNaN(n))) : null;
    const pdRecommend = _pdData ? pct(_pdData.filter(r => (r['Would you recommend this PD session to other sites?']||'').toLowerCase().startsWith('y')).length, _pdData.length) : null;

    const intakeTotal = _intakeData ? _intakeData.length : null;
    const intakeAvgEff = _intakeData && _intakeData.length ? avg(_intakeData.map(r => parseFloat(r['Overall, how would you rate the effectiveness of the training? (1 = Did not meet expectations, 5 = Exceeded expectations)'])).filter(n=>!isNaN(n))) : null;
    const intakeAvgPrep = _intakeData && _intakeData.length ? avg(_intakeData.map(r => parseFloat(r['After completing training, how prepared do you feel to begin working with scholars? (1 = Very unprepared, 5 = Extremely prepared)'])).filter(n=>!isNaN(n))) : null;

    const tutorTotal = _tutorObsData ? _tutorObsData.length : null;
    const tutorWithObs = _tutorObsData ? _tutorObsData.filter(r => OBS_MONTHS.some(m => isObserved(r[m]))).length : null;

    const otjTotal = _otjData ? _otjData.length : null;
    const otjComplete = _otjData ? _otjData.filter(r => (r['Mark Y']||'').trim().toUpperCase() === 'Y').length : null;

    const stat = (val, label, color) => {
      if (val === null) return '';
      return `<div style="display:inline-block;margin:.25rem .5rem .25rem 0;padding:.3rem .75rem;background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;vertical-align:top">
        <div style="font-size:1.3rem;font-weight:800;color:${color||'#0050c8'}">${val}</div>
        <div style="font-size:.65rem;color:#64748b;text-transform:uppercase;letter-spacing:.04em">${label}</div>
      </div>`;
    };

    // PD focus areas
    const pdFocusAll = [];
    if (_pdData) {
      _pdData.forEach(r => {
        const raw = r['What focus areas need additional support?'] || '';
        raw.split(',').map(v=>v.trim()).filter(Boolean).forEach(v=>pdFocusAll.push(v));
      });
    }
    const topFocus = countFreq(pdFocusAll).slice(0, 8);

    // Build HTML
    printFrame.innerHTML = `
      <style>
        @media print {
          body * { visibility: hidden !important; }
          #td-print-frame, #td-print-frame * { visibility: visible !important; }
          #td-print-frame { position: absolute; left: 0; top: 0; width: 100%; font-family: sans-serif; font-size: 12px; color: #0d1b2a; }
          .pg-break { page-break-before: always; }
        }
        #td-print-frame { font-family: 'DM Sans', sans-serif; font-size:13px; color:#0d1b2a; padding:0; }
      </style>
      <div style="padding:1in .75in .5in;background:#0a1628;color:#fff;-webkit-print-color-adjust:exact">
        <div style="font-size:2rem;font-weight:900;letter-spacing:-.03em">Training &amp; Development</div>
        <div style="font-size:1.1rem;font-weight:400;opacity:.8;margin-top:.25rem">Executive Summary Report</div>
        <div style="font-size:.85rem;opacity:.6;margin-top:.5rem">New Jersey Tutoring Corps · Generated ${now}</div>
      </div>

      <div style="padding:.75in">
        <h2 style="font-size:1rem;font-weight:800;border-bottom:2px solid #0a1628;padding-bottom:.25rem;margin-bottom:.625rem">AT A GLANCE — KEY METRICS</h2>
        <div style="margin-bottom:1rem">
          ${stat(pdSessions !== null ? pdSessions : '–', 'PD Sessions', '#e76f51')}
          ${stat(pdTotal !== null ? pdTotal : '–', 'PD Responses', '#0050c8')}
          ${stat(pdAvgOverall !== null ? pdAvgOverall.toFixed(1)+'/5' : '–', 'Avg PD Satisfaction', pdAvgOverall >= 4 ? '#059669' : '#d97706')}
          ${stat(pdRecommend !== null ? pdRecommend+'%' : '–', 'Would Recommend', '#059669')}
        </div>
        <div style="margin-bottom:1.25rem">
          ${stat(intakeTotal !== null ? intakeTotal : '–', 'Training Intake Responses', '#0050c8')}
          ${stat(intakeAvgEff !== null ? intakeAvgEff.toFixed(1)+'/5' : '–', 'Avg Training Effectiveness', intakeAvgEff >= 4 ? '#059669' : '#d97706')}
          ${stat(intakeAvgPrep !== null ? intakeAvgPrep.toFixed(1)+'/5' : '–', 'Avg Preparedness Score', intakeAvgPrep >= 4 ? '#059669' : '#d97706')}
        </div>
        <div style="margin-bottom:1.5rem">
          ${stat(tutorTotal !== null ? tutorTotal : '–', 'Tutors Tracked', '#7b2d8b')}
          ${stat(tutorWithObs !== null && tutorTotal ? pct(tutorWithObs, tutorTotal)+'%' : '–', '% With ≥1 Observation', tutorTotal && tutorWithObs/tutorTotal >= 0.8 ? '#059669' : '#d97706')}
          ${stat(otjTotal !== null ? otjTotal : '–', 'OTJ Checklist Items', '#0050c8')}
          ${stat(otjComplete !== null && otjTotal ? pct(otjComplete, otjTotal)+'%' : '–', 'OTJ Completion', otjTotal && otjComplete/otjTotal >= 0.5 ? '#059669' : '#d97706')}
        </div>

        <div class="pg-break"></div>

        <h2 style="font-size:1rem;font-weight:800;border-bottom:2px solid #0a1628;padding-bottom:.25rem;margin-bottom:.625rem;margin-top:1rem">PD SESSIONS — RATINGS SNAPSHOT</h2>
        ${_pdData && _pdData.length ? `
        <table style="width:100%;border-collapse:collapse;font-size:.85rem;margin-bottom:1rem">
          <thead>
            <tr style="background:#f8fafc">
              ${PD_RATING_SHORT.map(s => `<th style="text-align:left;padding:.4rem .5rem;border-bottom:2px solid #e2e8f0;font-weight:700;font-size:.72rem;text-transform:uppercase">${s}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
            <tr>
              ${PD_RATING_FIELDS.map(f => {
                const vals = _pdData.map(r => parseFloat(r[f])).filter(n=>!isNaN(n));
                const a = vals.length ? vals.reduce((s,n)=>s+n,0)/vals.length : 0;
                return `<td style="padding:.4rem .5rem;border-bottom:1px solid #e2e8f0;font-weight:700;color:${a>=4?'#059669':'#d97706'}">${a.toFixed(2)}</td>`;
              }).join('')}
            </tr>
          </tbody>
        </table>` : '<div style="font-size:.85rem;color:#64748b">PD data not yet loaded — open PD Sessions tab first.</div>'}

        <h2 style="font-size:1rem;font-weight:800;border-bottom:2px solid #0a1628;padding-bottom:.25rem;margin-bottom:.625rem;margin-top:1rem">TOP FOCUS AREAS NEEDING SUPPORT</h2>
        ${topFocus.length ? topFocus.map(([label, cnt]) =>
          `<div style="display:flex;align-items:center;gap:.5rem;margin-bottom:.3rem;font-size:.85rem">
            <div style="flex:1">${label}</div>
            <div style="width:80px;height:6px;background:#e2e8f0;border-radius:3px;overflow:hidden">
              <div style="height:100%;width:${pct(cnt, topFocus[0][1])}%;background:#e76f51"></div>
            </div>
            <div style="font-weight:700;min-width:24px;text-align:right">${cnt}</div>
          </div>`
        ).join('') : '<div style="font-size:.85rem;color:#64748b">PD data not yet loaded.</div>'}

        <h2 style="font-size:1rem;font-weight:800;border-bottom:2px solid #0a1628;padding-bottom:.25rem;margin-bottom:.625rem;margin-top:1rem">OBSERVATION COVERAGE</h2>
        ${_tutorObsData ? `
        <table style="width:100%;border-collapse:collapse;font-size:.85rem;margin-bottom:1rem">
          <thead><tr style="background:#f8fafc">
            ${OBS_MONTHS.map(m => `<th style="text-align:center;padding:.35rem;border-bottom:2px solid #e2e8f0;font-size:.72rem">${m}</th>`).join('')}
          </tr></thead>
          <tbody><tr>
            ${OBS_MONTHS.map(m => {
              const cnt = _tutorObsData.filter(r => isObserved(r[m])).length;
              const p = pct(cnt, _tutorObsData.length);
              return `<td style="text-align:center;padding:.35rem;border-bottom:1px solid #e2e8f0;font-weight:700;color:${p>=80?'#059669':'#d97706'}">${cnt} (${p}%)</td>`;
            }).join('')}
          </tr></tbody>
        </table>` : '<div style="font-size:.85rem;color:#64748b">Observation data not yet loaded — open Tutor Observations tab first.</div>'}

        <h2 style="font-size:1rem;font-weight:800;border-bottom:2px solid #0a1628;padding-bottom:.25rem;margin-bottom:.625rem;margin-top:1rem">SKILL GAP SUMMARY</h2>
        <div style="font-size:.85rem;margin-bottom:.5rem">Cross-reference of PD focus areas against OTJ competency domains:</div>
        ${PD_OTJ_MAP.slice(0, 5).map(mapping => {
          const pdCount = pdFocusAll.filter(v => v.toLowerCase().includes(mapping.pdFocus.toLowerCase())).length;
          return `<div style="display:flex;gap:.75rem;font-size:.82rem;padding:.25rem 0;border-bottom:1px solid #f1f5f9">
            <div style="flex:2;font-weight:600">${mapping.label}</div>
            <div style="flex:1;color:#e76f51">${pdCount} PD responses</div>
            <div style="flex:1;color:#0050c8">→ ${mapping.otjDomains.join(', ')}</div>
          </div>`;
        }).join('')}

        <h2 style="font-size:1rem;font-weight:800;border-bottom:2px solid #0a1628;padding-bottom:.25rem;margin-bottom:.625rem;margin-top:1rem">INSIGHT BULLETS</h2>
        <ul style="font-size:.85rem;line-height:1.8;padding-left:1.25rem">
          ${pdAvgOverall !== null ? `<li>Overall PD satisfaction averages <strong>${pdAvgOverall.toFixed(1)}/5</strong> — ${pdAvgOverall >= 4 ? 'meeting quality target' : 'below 4.0 quality target, improvement recommended'}</li>` : ''}
          ${pdRecommend !== null ? `<li><strong>${pdRecommend}%</strong> of respondents would recommend PD sessions to other sites</li>` : ''}
          ${intakeAvgPrep !== null ? `<li>Staff report average preparedness of <strong>${intakeAvgPrep.toFixed(1)}/5</strong> after completing onboarding training</li>` : ''}
          ${tutorWithObs !== null && tutorTotal ? `<li><strong>${pct(tutorWithObs, tutorTotal)}%</strong> of tracked tutors have at least one observation on record</li>` : ''}
          ${topFocus.length ? `<li>Top PD focus area cited: <strong>${topFocus[0][0]}</strong> (${topFocus[0][1]} responses)</li>` : ''}
        </ul>
      </div>
    `;

    document.body.appendChild(printFrame);
    window.print();
    setTimeout(() => {
      if (document.body.contains(printFrame)) document.body.removeChild(printFrame);
    }, 2000);
  }


  // ══════════════════════════════════════════════════════════════════
  //  INITIALIZATION & DEPT-AWARE SETUP
  // ══════════════════════════════════════════════════════════════════

  function initTDModule() {
    const dept = getDept();

    // Show/hide mgmt tab for training dept
    const mgmtBtn = document.getElementById('tdTab-mgmt');
    if (mgmtBtn) {
      mgmtBtn.style.display = (dept === 'training') ? '' : 'none';
    }

    // Show exec PDF button for data dept
    const execBtn = document.getElementById('tdExecPDFBtn');
    if (execBtn) {
      execBtn.style.display = (dept === 'data') ? '' : 'none';
    }

    // Load the first (active) tab
    const firstActive = document.querySelector('#tdTabNav .pst-tab.active');
    if (firstActive) {
      const tabId = firstActive.id.replace('tdTab-', '');
      if (!_tdLoaded[tabId]) {
        _tdLoaded[tabId] = true;
        switch (tabId) {
          case 'pd':        renderPDTab();       break;
          case 'intake':    renderIntakeTab();   break;
          case 'tutor-obs': renderTutorObsTab(); break;
          case 'sl-obs':    renderSLObsTab();    break;
          case 'otj':       renderOTJTab();      break;
          case 'mgmt':      renderMgmtTab();     break;
          default:          renderPDTab();
        }
      }
    } else {
      // Fallback: load PD tab
      if (!_tdLoaded['pd']) {
        _tdLoaded['pd'] = true;
        renderPDTab();
      }
    }
  }

  // ══════════════════════════════════════════════════════════════════
  //  LEGACY BACKWARD COMPAT (called by older panel routing code)
  // ══════════════════════════════════════════════════════════════════

  function buildTrainingAnalytics() {
    // Re-entry point — just init the TD module
    initTDModule();
    // Also handle legacy trainingAnalyticsContent target
    const legacy = document.getElementById('trainingAnalyticsContent');
    if (legacy && legacy.style.display !== 'none') {
      legacy.innerHTML = '<div style="padding:1rem;font-size:.85rem;color:var(--muted)">Training &amp; Development data is now displayed in the panels above.</div>';
    }
  }

  function renderTrainingReviews() {
    return '<div style="padding:1rem;font-size:.85rem;color:var(--muted)">Site leader reviews are now tracked in the Training & Development dashboard under the Site Leader Observations tab.</div>';
  }

  function renderTrainingAnalytics() {
    return '<div style="padding:1rem;font-size:.85rem;color:var(--muted)">Training analytics are now displayed in the Training & Development dashboard with live Google Sheets data.</div>';
  }

  // ══════════════════════════════════════════════════════════════════
  //  GLOBAL EXPORTS
  // ══════════════════════════════════════════════════════════════════

  window.buildTrainingAnalytics  = buildTrainingAnalytics;
  window.renderTrainingReviews   = renderTrainingReviews;
  window.renderTrainingAnalytics = renderTrainingAnalytics;
  window.tdShowTab               = tdShowTab;
  window.tdRefresh               = tdRefresh;
  window.tdGenerateExecPDF       = tdGenerateExecPDF;

  // ══════════════════════════════════════════════════════════════════
  //  AUTO-INIT: run when the training panel becomes visible
  //  We use a MutationObserver to watch for the training-analytics panel
  //  being shown, or call directly if already visible on load.
  // ══════════════════════════════════════════════════════════════════

  function tdAutoInit() {
    // Check if td-content-pd is in the DOM and visible or its parent panel is active
    const pdContent = document.getElementById('td-content-pd');
    if (!pdContent) return;
    // Check if the training panel (ancestor .panel) is active/visible
    const panel = pdContent.closest('.panel');
    if (!panel) return;
    if (panel.style.display === 'none' || panel.classList.contains('hidden')) return;
    initTDModule();
  }

  // Also expose initTDModule as buildTrainingAnalytics for router compatibility
  window.buildTrainingAnalytics = function() {
    initTDModule();
  };

  // Run on DOMContentLoaded if not already done
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', tdAutoInit);
  } else {
    // DOM already ready — defer one tick so other modules finish
    setTimeout(tdAutoInit, 0);
  }

  // Watch for panel visibility changes (tab switching in main nav)
  const _tdPanelObserver = new MutationObserver(function(mutations) {
    mutations.forEach(function(mutation) {
      if (mutation.type === 'attributes' && mutation.attributeName === 'style') {
        const target = mutation.target;
        if (target && target.id && target.id.includes('training')) {
          if (target.style.display !== 'none') {
            setTimeout(initTDModule, 50);
          }
        }
      }
    });
  });

  // Observe once DOM is ready
  function attachTDObserver() {
    const pdContent = document.getElementById('td-content-pd');
    if (pdContent) {
      const panel = pdContent.closest('.panel');
      if (panel) {
        _tdPanelObserver.observe(panel, { attributes: true, attributeFilter: ['style', 'class'] });
      }
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', attachTDObserver);
  } else {
    setTimeout(attachTDObserver, 0);
  }

})();
