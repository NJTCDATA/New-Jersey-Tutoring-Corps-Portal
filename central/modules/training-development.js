(function() {
  'use strict';

  // ═══════════════════════════════════════════════════════════════════
  //  TRAINING & DEVELOPMENT MODULE — NJTC Central Portal
  //  6 sub-tabs: PD Sessions · Training Intake · Tutor Obs · SL Obs · OTJ · Mgmt
  // ═══════════════════════════════════════════════════════════════════

  // ── Data source URLs ──────────────────────────────────────────────────────
  // PD Sessions: direct export (sheet shared "Anyone with the link")
  const PD_URL = 'https://docs.google.com/spreadsheets/d/18LyHoN0c8BTD-ZVC0D4BpwD-rhq9ZBjgvFIXrsOKYM8/export?format=csv&gid=471085177';
  // Training Intake: published-to-web 2PACX URL (confirmed working — 73 rows)
  // This sheet uses "Publish to web" rather than "Anyone with link", so the
  // direct export URL fails with a CORS redirect. Keep the 2PACX key.
  const TRAINING_INTAKE_URL = 'https://docs.google.com/spreadsheets/d/e/' +
    '2PACX-1vRdblJU86VLJWNs4ykc_3GJ9Mr7oe5SDPA0QeYbWQcPsPSqOpWAxGClTiXDH_M3CunJIl0kjA3JUdym' +
    '/pub?output=csv&gid=1298105082';
  // ── Apprenticeship Program Database ───────────────────────────────
  const APPR_SHEET_ID = '1_s6FnrI4537A7woPJ0F-56l2GS1Pt8c1x5RZuUjEl7U';
  const LIVE_TRACKER_ID  = '1Dh1-TsuXEwoz4sqA4RBtgylPZ6epencsrJoqxupIEqs';
  const LIVE_TRACKER_URL = 'https://docs.google.com/spreadsheets/d/' + LIVE_TRACKER_ID + '/export?format=csv&gid=0';
  const LIVE_TRACKER_OTJ_COLS = 17; // columns AB (index 27) through AR (index 43)
  const APPR_GIDS = {
    otjTemplate:     '251323957',
    neOtj:           '2085207682',
    neTutorObs:      '794616419',
    neSiteLeaderObs: '1649286205',
    swOtj:           '1510819560',
    swTutorObs:      '345737788',
    swSiteLeaderObs: '373912327'
  };

  // ── Chart instance tracker ─────────────────────────────────────────
  const _tdCharts = {};

  // ── Loaded-tab tracker (lazy loading) ─────────────────────────────
  const _tdLoaded = {};

  // ── Cached CSV data ────────────────────────────────────────────────
  let _pdData     = null;
  let _intakeData = null;

  // ── PDF season definitions (module-level to avoid const-redeclaration in async fn) ──
  const PDF_SEASONS = [
    { key:'fall',   label:'🍂 Fall',   note:'Sep–Nov', color:'#92400e', bg:'#fef3c7' },
    { key:'winter', label:'❄️ Winter', note:'Dec–Feb', color:'#1e3a8a', bg:'#eff6ff' },
    { key:'spring', label:'🌱 Spring', note:'Mar–May', color:'#065f46', bg:'#ecfdf5' },
    { key:'summer', label:'☀️ Summer', note:'Jun–Aug', color:'#9a3412', bg:'#fff7ed' },
  ];

  // ── Season filter state ───────────────────────────────────────────
  let _tdActiveSeason = 'all'; // 'all'|'fall'|'winter'|'spring'|'summer'

  // ── Apprenticeship sheet cache (TTL = 5 min) ───────────────────────
  const _apprCache  = {};   // key → { text, ts }
  let   _apprParsed = null; // parsed combined data from all 6 sheets

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

  // ── Season filter helpers ─────────────────────────────────────────
  function filterBySeason(rows, dateCol) {
    if (_tdActiveSeason === 'all') return rows;
    const col = dateCol || 'Timestamp';
    return rows.filter(r => getSeason(r[col] || '') === _tdActiveSeason);
  }

  function buildSeasonFilterBar() {
    const seasons = [
      { key:'all',    label:'📅 All Seasons' },
      { key:'fall',   label:'🍂 Fall',   note:'Sep–Nov' },
      { key:'winter', label:'❄️ Winter', note:'Dec–Feb' },
      { key:'spring', label:'🌱 Spring', note:'Mar–May' },
      { key:'summer', label:'☀️ Summer', note:'Jun–Aug' },
    ];
    return '<div style="display:flex;align-items:center;gap:.5rem;flex-wrap:wrap;margin-bottom:1.25rem;padding:.75rem 1rem;background:var(--surface-2);border:1px solid var(--border);border-radius:12px">' +
      '<span style="font-family:\'Plus Jakarta Sans\',sans-serif;font-size:.6875rem;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:var(--muted);flex-shrink:0">Season</span>' +
      seasons.map(s => {
        const active = _tdActiveSeason === s.key;
        return '<button style="padding:.3rem .875rem;border-radius:20px;border:1.5px solid ' +
          (active ? 'var(--training)' : 'var(--border)') + ';background:' +
          (active ? 'rgba(231,111,81,.1)' : 'var(--surface)') + ';color:' +
          (active ? 'var(--training)' : 'var(--text-2)') +
          ';font-size:.8rem;font-weight:600;cursor:pointer;font-family:\'Plus Jakarta Sans\',sans-serif" onclick="window.tdSetSeason(\'' + s.key + '\')">' +
          s.label + (s.note ? '<span style="font-size:.65rem;opacity:.55;margin-left:.2rem">' + s.note + '</span>' : '') + '</button>';
      }).join('') +
      '<span id="tdSeasonCount" style="margin-left:auto;font-size:.7rem;color:var(--muted)"></span>' +
    '</div>';
  }

  window.tdSetSeason = function(key) {
    _tdActiveSeason = key;
    if (_pdSubTab)     window.tdPDSubTab(_pdSubTab, null);
    if (_intakeSubTab) window.tdIntakeSubTab(_intakeSubTab, null);
  };

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
    // Support both comma and semicolon delimiters
    const sep = cellValue.includes(';') && !cellValue.includes(',') ? ';' : ',';
    return cellValue.split(sep).map(v => v.trim()).filter(v => v.length > 0);
  }

  // Fuzzy column finder — returns the first key in the rows' header that contains any of the given
  // lowercase substrings. Useful when sheet column names drift slightly from expected values.
  function findCol(rows, ...keywords) {
    if (!rows || !rows.length) return null;
    const keys = Object.keys(rows[0]);
    for (const kw of keywords) {
      const kl = kw.toLowerCase();
      const found = keys.find(k => k.toLowerCase().includes(kl));
      if (found) return found;
    }
    return null;
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
    const isAccess = msg && msg.startsWith('ACCESS_DENIED');
    if (isAccess) {
      const sheetUrl = `https://docs.google.com/spreadsheets/d/${APPR_SHEET_ID}/`;
      return `<div class="td-error" style="max-width:560px;margin:2rem auto;text-align:left">
        <div style="font-size:1.5rem;margin-bottom:.5rem;text-align:center">🔒</div>
        <div style="font-weight:700;font-size:1rem;margin-bottom:.5rem;text-align:center">Google Sheet Not Publicly Accessible</div>
        <p style="font-size:.875rem;margin-bottom:1rem">
          The apprenticeship data sheet is set to private, so the portal cannot fetch it.
          A sheet owner needs to make it viewable by anyone with the link.
        </p>
        <ol style="font-size:.875rem;margin:.5rem 0 1rem 1.25rem;line-height:1.7">
          <li>Open the sheet: <a href="${sheetUrl}" target="_blank" rel="noopener" style="color:#1d4ed8;text-decoration:underline">Apprenticeship Tracker ↗</a></li>
          <li>Click <strong>Share</strong> (top-right)</li>
          <li>Under <em>General access</em>, change to <strong>"Anyone with the link"</strong></li>
          <li>Set role to <strong>Viewer</strong> and click <strong>Done</strong></li>
        </ol>
        ${retryFn ? `<div style="text-align:center"><button class="btn btn-secondary btn-sm" onclick="(${retryFn})()">↺ Retry after sharing</button></div>` : ''}
      </div>`;
    }
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

  // ── Apprentice master lists (ADP canonical names) ─────────────────
  // Synced to HR Master List + TAP program roster SY 2025-2026.
  // All 30 apprentices retained regardless of current employment status.
  // Terminated apprentices (Apollo, Jessica Flores) keep their SY 25-26 data.
  // Lilia Quintero moved NE→SW. La Shanee Davis = Dr. Renee Davis (NJ2025004829).
  const APPRENTICES_NE = [
    'Alexandra Cristescu','Aliviyah Goodson','Apollo Monroy-Polanco','Arelis Rodriguez',
    'Avani Jimenez','Carla Borbon','Carlos Jacho','Ian Anderson','Jasmine Ramsey-Copeland',
    'Jazmin Garcia','Jessica Flores','Keisha Lopez','La Shanee Davis','Linda Fenty','Maria Gutierrez',
    'Melissa Mazza','Mushana Dunham','Naima Boutira','Norelis Ramirez','Pooja Tyagi',
    'Shahzeeb Ahmad','Sharon K Kessel','Subul Sadiq','Theodore Mills'
  ];
  const APPRENTICES_SW = [
    'Caitlin Evgeniadis','Katie Rose Davis','Katrina Valentin',
    'Lilia Quintero','Micaela Wilkerson','Nicholas Hoover'
  ];
  const ALL_APPRENTICES = [...APPRENTICES_NE, ...APPRENTICES_SW];
  window._njtcAllApprenticeNames = new Set(ALL_APPRENTICES.map(n => n.toLowerCase()));

  // Name normalization aliases: informal → ADP canonical
  const NAME_ALIASES = {
    'dr. renee davis':      'La Shanee Davis',
    'dr renee davis':       'La Shanee Davis',
    'renee davis':          'La Shanee Davis',
    'la shanee davis':      'La Shanee Davis',
    'caitlyn evegeniadis':  'Caitlin Evgeniadis',
    'caitlyn evgeniadis':   'Caitlin Evgeniadis',
    'jasmine ramsey':       'Jasmine Ramsey-Copeland',
    'mary carmen':          'Maria Gutierrez',
    'mary carmen gutierrez':'Maria Gutierrez',
    'subul saadiq':         'Subul Sadiq',
    'shahzaeb ahmad':       'Shahzeeb Ahmad',
    'shazaeb ahmad':        'Shahzeeb Ahmad',
    'shahzaeb':             'Shahzeeb Ahmad',
    'shazaeb':              'Shahzeeb Ahmad',
    'caela wilkerson':      'Micaela Wilkerson',
    'sharon kessel':        'Sharon K Kessel'
  };

  function normalizeApprenticeName(raw) {
    if (!raw) return '';
    const lower = raw.trim().toLowerCase();
    if (NAME_ALIASES[lower]) return NAME_ALIASES[lower];
    // Try partial match against canonical names
    const found = ALL_APPRENTICES.find(n => n.toLowerCase() === lower);
    if (found) return found;
    return raw.trim();
  }

  function getApprRegion(name) {
    if (APPRENTICES_NE.includes(name)) return 'NE';
    if (APPRENTICES_SW.includes(name)) return 'SW';
    return '';
  }

  // ── CSV URL builder ────────────────────────────────────────────────
  function apprCSVUrl(gid) {
    return `https://docs.google.com/spreadsheets/d/${APPR_SHEET_ID}/export?format=csv&gid=${gid}`;
  }

  // Fetch one sheet with 5-min TTL cache
  async function fetchApprCSV(key) {
    const gid = APPR_GIDS[key];
    if (!gid) throw new Error('Unknown sheet key: ' + key);
    const now = Date.now();
    if (_apprCache[key] && (now - _apprCache[key].ts) < 5 * 60 * 1000) {
      return _apprCache[key].text;
    }
    let text;
    try {
      text = await fetchCSV(apprCSVUrl(gid));
    } catch (e) {
      const msg = (e && e.message) || '';
      const isAccessError = msg.includes('Failed to fetch') || msg.includes('NetworkError') ||
                            msg.includes('CORS') || msg.includes('HTTP 302') || msg.includes('HTTP 403');
      if (isAccessError) {
        throw new Error(
          'ACCESS_DENIED: The apprenticeship Google Sheet is not publicly accessible. ' +
          'To fix: open the sheet → Share → change to "Anyone with the link" → Viewer.'
        );
      }
      throw e;
    }
    // Detect auth redirect: Google returns an HTML login page instead of CSV
    if (text.trimStart().startsWith('<!DOCTYPE') || text.trimStart().startsWith('<html')) {
      throw new Error(
        'ACCESS_DENIED: The apprenticeship Google Sheet is not publicly accessible. ' +
        'To fix: open the sheet → Share → change to "Anyone with the link" → Viewer.'
      );
    }
    _apprCache[key] = { text, ts: now };
    return text;
  }

  // Fetch all 6 apprenticeship sheets in parallel
  async function fetchAllSheets() {
    if (_apprParsed) {
      // If sheets cached but obs maps not yet built (e.g. early-return before _buildObsMaps existed), build now
      if (!window._njtcTutorObs || !window._njtcSLObs) _buildObsMaps(_apprParsed);
      return _apprParsed;
    }
    const keys = ['neOtj','swOtj','neTutorObs','swTutorObs','neSiteLeaderObs','swSiteLeaderObs'];
    const [texts, liveTrackerText] = await Promise.all([
      Promise.all(keys.map(k => fetchApprCSV(k))),
      fetchCSV(LIVE_TRACKER_URL).catch(() => ''),
    ]);
    const raw = {};
    keys.forEach((k, i) => { raw[k] = texts[i]; });

    // NE OTJ: headers at row 3 (skipRows=2)
    const neOtj = parseCsvText(raw.neOtj, 2).rows.filter(r => r['Tutor Last (ADP)'] || r['Tutor First']);

    // SW OTJ: headers at row 3, but may have duplicate header rows — filter them
    const swOtjParsed = parseCsvText(raw.swOtj, 2);
    const swOtj = swOtjParsed.rows.filter(r => {
      const first = (r['Tutor First'] || '').toLowerCase();
      return first && first !== 'tutor first' && first !== 'name';
    });

    // NE Tutor Obs: headers at row 3
    const neTutorObsParsed = parseCsvText(raw.neTutorObs, 2);
    // Filter out section-header rows (only col A populated — site leader group headers)
    const NE_OBS_MONTHS = ['October','November','December','January','February','March','April','May','June'];
    const neTutorObs = neTutorObsParsed.rows.filter(r => {
      const name = r['Tutor Name (ADP)'] || r[neTutorObsParsed.headers[0]] || '';
      return name.trim() && NE_OBS_MONTHS.some(m => r[m] !== undefined);
    });

    // SW Tutor Obs: headers at row 3
    const swTutorObsParsed = parseCsvText(raw.swTutorObs, 2);
    const swTutorObs = swTutorObsParsed.rows.filter(r => {
      const name = r['Tutor Name'] || '';
      return name.trim() && !(name.toLowerCase().includes('tutor name'));
    });

    // NE Site Leader Obs: headers at row 2 (skipRows=1)
    const neSLObs = parseCsvText(raw.neSiteLeaderObs, 1).rows.filter(r =>
      (r['Site Leader'] || '').trim()
    );

    // SW Site Leader Obs: headers at row 3
    const swSLObs = parseCsvText(raw.swSiteLeaderObs, 2).rows.filter(r =>
      (r['Site Leader'] || '').trim()
    );

    // ── Live Apprentice Tracker: count OTJ items per apprentice ─────────────
    // Sheet 1Dh1-..., gid=0. Originally expected OTJ items in columns AB–AR but
    // that tab now contains GAINS IMPORTRANGE data with month columns there.
    // We still attempt the parse; if it yields 0 matches the phase-based fallback
    // in ap_otjItemCount (executive-leadership.js) fills in the gaps automatically.
    const liveOtjCountMap = {};
    try {
      if (liveTrackerText) {
        const ltp = parseCsvText(liveTrackerText, 4);
        const lth = ltp.headers;
        // Auto-detect name column: prefer header containing 'name' or 'tutor'
        const nameColIdx = lth.findIndex(h => /name|tutor/i.test(h));
        const nameCol = nameColIdx >= 0 ? lth[nameColIdx] : lth[0];
        // Only count cells with checkbox-style values, not bare numbers (avoids GAINS months)
        const isChecked = v => { const t = (v||'').trim(); return t && !/^\d+$/.test(t); };
        const otjHdrs = lth.slice(27, 44); // AB–AR
        ltp.rows.forEach(r => {
          const rawName = (r[nameCol] || '').trim();
          if (!rawName || /^\d+$/.test(rawName)) return; // skip numeric-only "names"
          const canon = normalizeApprenticeName(rawName) || rawName;
          const key   = canon.toLowerCase().replace(/\s+/g,' ').trim();
          const count = otjHdrs.filter(h => isChecked(r[h])).length;
          if (!liveOtjCountMap[key] || count > liveOtjCountMap[key]) liveOtjCountMap[key] = count;
        });
        console.log('[T&D] Live Tracker OTJ: ' + Object.keys(liveOtjCountMap).length + ' apprentices mapped (phase fallback active for any 0-match entries)');
      }
    } catch(e) { console.warn('[T&D] Live Tracker OTJ parse error:', e); }
    window.njtcLiveOtjMap = liveOtjCountMap;

    _apprParsed = { neOtj, swOtj, neTutorObs, swTutorObs, neSLObs, swSLObs,
                    neTutorObsHeaders: neTutorObsParsed.headers,
                    swTutorObsHeaders: swTutorObsParsed.headers,
                    liveOtjCountMap };

    // ── Overlay obs counts onto HR_EMPS so PIE can surface them ────────────
    // Runs once (cached). Triggers as soon as any T&D tab loads data.
    try {
      const NE_OBS_M = ['October','November','December','January','February','March','April','May','June'];
      const SW_OBS_M = ['October Obs #1','November Obs #1','December Comments','January Comments','February Obs #1','March Obs #1','April Obs #1'];
      const MONTH_LBL = ['Oct','Nov','Dec','Jan','Feb','Mar','Apr','May','Jun'];
      // Accumulate obs counts keyed by normalized tutor name
      const obsByName = {};
      function _addObs(name, months, row, lbls) {
        if (!name) return;
        const k = name.toLowerCase().replace(/[^a-z ]/g,'').replace(/\s+/g,' ').trim();
        if (!k) return;
        if (!obsByName[k]) obsByName[k] = { count:0, lastObs:'' };
        months.forEach(function(m,i) { if ((row[m]||'').trim()) { obsByName[k].count++; obsByName[k].lastObs = lbls[i]; } });
      }
      neTutorObs.forEach(function(r) { _addObs(r['Tutor Name (ADP)']||'', NE_OBS_M, r, MONTH_LBL); });
      swTutorObs.forEach(function(r) { _addObs(r['Tutor Name']||'', SW_OBS_M, r, MONTH_LBL); });
      // Apply to HR_EMPS
      const empList = window.HR_EMPS || [];
      empList.forEach(function(emp) {
        const en = (emp.n||'').toLowerCase().replace(/[^a-z ]/g,'').replace(/\s+/g,' ').trim();
        if (!en) return;
        const parts = en.split(' ');
        const last  = parts[parts.length-1];
        const first = parts[0];
        // Find best match: exact name or first+last match
        const key = Object.keys(obsByName).find(function(k) {
          if (k === en) return true;
          const kp = k.split(' ');
          return kp[kp.length-1] === last && kp[0] === first;
        });
        if (key && obsByName[key].count > 0) {
          emp._obsCount = (emp._obsCount||0) + obsByName[key].count;
          if (!emp._obsLatest && obsByName[key].lastObs) emp._obsLatest = { date: obsByName[key].lastObs };
        }
      });
    } catch(e) { console.warn('[T&D] Obs overlay error:', e); }

    // Build global obs maps for PIE + programming profiles
    _buildObsMaps(_apprParsed);

    return _apprParsed;
  }

  // ── Build global observation maps for programming profile view ─────────────
  // Populates window._njtcTutorObs and window._njtcSLObs so that the
  // programming dept Profiles section can render per-employee observation
  // timelines and links without needing to re-fetch the sheets.
  function _buildObsMaps(d) {
    const SHEET_BASE  = `https://docs.google.com/spreadsheets/d/${APPR_SHEET_ID}/edit#gid=`;
    const NE_MONTHS   = ['October','November','December','January','February','March','April','May','June'];
    const SW_MONTH_MAP = {
      'October Obs #1':'Oct', 'November Obs #1':'Nov', 'December Comments':'Dec',
      'January Comments':'Jan', 'February Obs #1':'Feb', 'March Obs #1':'Mar', 'April Obs #1':'Apr'
    };
    const M_SHORT = ['Oct','Nov','Dec','Jan','Feb','Mar','Apr','May','Jun'];

    function normN(n) { return (n||'').toLowerCase().replace(/\s+/g,' ').trim(); }
    function isObsCell(val) {
      if (!val || !val.trim()) return false;
      const vl = val.toLowerCase();
      return vl.includes('observation') || !!vl.match(/obs\s*#?\d*/i);
    }
    // Resolve obs-sheet name to ADP canonical form, then normalize.
    // This ensures "Caela Wilkerson" → "Micaela Wilkerson" → "micaela wilkerson"
    // so the map key matches whatever HR_EMPS stores.
    function obsKey(rawName) {
      const canonical = normalizeApprenticeName(rawName);
      const key = normN(canonical);
      // Also store under the raw normalized key so direct matches still work
      return { key, rawKey: normN(rawName) };
    }
    function addToMap(map, key, rawKey, entry) {
      if (!map[key]) map[key] = [];
      map[key].push(entry);
      // If alias changed the key, also index under the raw key as a fallback
      if (rawKey !== key) {
        if (!map[rawKey]) map[rawKey] = map[key];  // point to same array
      }
    }

    // ── Tutor obs map: keyed by normalized ADP canonical name ────────────────
    const tutorMap = {};

    // NE tutor obs (month columns: October … June; name col: "Tutor Name (ADP)")
    d.neTutorObs.forEach(r => {
      const name = (r['Tutor Name (ADP)'] || '').trim();
      if (!name) return;
      // Skip section-header rows (site leader group labels — no month data)
      if (!NE_MONTHS.some(m => r[m] && r[m].trim())) return;
      const { key, rawKey } = obsKey(name);
      NE_MONTHS.forEach((month, i) => {
        const val      = (r[month] || '').trim();
        const observed = isObsCell(val);
        const missed   = !observed && !!val;
        addToMap(tutorMap, key, rawKey, {
          month:    M_SHORT[i],
          observed,
          missed,
          note:  (!observed && val) ? val : '',
          link:  observed ? SHEET_BASE + APPR_GIDS.neTutorObs : '',
          date:  '',
        });
      });
    });

    // SW tutor obs (staggered month column names; name col: "Tutor Name")
    d.swTutorObs.forEach(r => {
      const name = (r['Tutor Name'] || '').trim();
      if (!name) return;
      const { key, rawKey } = obsKey(name);
      Object.entries(SW_MONTH_MAP).forEach(([col, short]) => {
        const val      = (r[col] || '').trim();
        const observed = isObsCell(val);
        const missed   = !observed && !!val;
        addToMap(tutorMap, key, rawKey, {
          month:    short,
          observed,
          missed,
          note:  (!observed && val) ? val : '',
          link:  observed ? SHEET_BASE + APPR_GIDS.swTutorObs : '',
          date:  '',
        });
      });
    });

    window._njtcTutorObs = tutorMap;

    // ── Site leader obs map: keyed by normalized name ────────────────────────
    const slMap = {};
    const MONTH_ABBR = {
      'october':'Oct','november':'Nov','december':'Dec','january':'Jan',
      'february':'Feb','march':'Mar','april':'Apr','may':'May','june':'Jun'
    };

    // NE SL obs: one row per observed month (cols: Site Leader, Observation Month,
    // Notes, Link to Observation Folder, Link to Google Form)
    d.neSLObs.forEach(r => {
      const sl = (r['Site Leader'] || '').trim();
      if (!sl) return;
      const { key, rawKey } = obsKey(sl);
      const mo = (r['Observation Month'] || '').trim();
      const shortEntry = Object.entries(MONTH_ABBR).find(([k]) => mo.toLowerCase().includes(k));
      if (!shortEntry) return;  // row has no parseable month — skip
      addToMap(slMap, key, rawKey, {
        month:    shortEntry[1],
        observed: true,
        missed:   false,
        note:     r['Notes'] || '',
        link:     r['Link to Observation Folder'] || r['Link to Google Form'] || (SHEET_BASE + APPR_GIDS.neSiteLeaderObs),
        date:     mo,
      });
    });

    // SW SL obs: up to 3 obs per row (cols: Observation #1/2/3, Link to Folder)
    // No dedicated month column — extract from cell text, fallback to sequential
    const SW_OBS_FALLBACK = ['Oct','Nov','Dec'];
    d.swSLObs.forEach(r => {
      const sl = (r['Site Leader'] || '').trim();
      if (!sl) return;
      const { key, rawKey } = obsKey(sl);
      ['Observation #1','Observation #2','Observation #3'].forEach((col, i) => {
        const val = (r[col] || '').trim();
        if (!val) return;
        const monthMatch = Object.entries(MONTH_ABBR).find(([k]) => val.toLowerCase().includes(k));
        addToMap(slMap, key, rawKey, {
          month:    monthMatch ? monthMatch[1] : SW_OBS_FALLBACK[i],
          observed: true,
          missed:   false,
          note:     r['Notes'] || '',
          link:     r['Link to Folder'] || (SHEET_BASE + APPR_GIDS.swSiteLeaderObs),
          date:     val,
        });
      });
    });

    window._njtcSLObs = slMap;

    // ── School → SL obs index ────────────────────────────────────────────────
    // Allows programming profile cards to show SL obs status for a tutor's school.
    // NE SL obs has a "School" column; SW may have it too.
    const schoolSLMap = {};  // normN(school) → { sl, region, obsEntries:[] }
    function _addSchoolSLEntry(sl, school, region, obsEntry) {
      const k = normN(school);
      if (!k) return;
      if (!schoolSLMap[k]) schoolSLMap[k] = { sl, region, obsEntries: [] };
      if (obsEntry) schoolSLMap[k].obsEntries.push(obsEntry);
    }
    d.neSLObs.forEach(r => {
      const sl     = (r['Site Leader'] || '').trim();
      const school = (r['School'] || '').trim();
      if (!sl) return;
      const mo = (r['Observation Month'] || '').trim();
      const shortEntry = Object.entries(MONTH_ABBR).find(([k]) => mo.toLowerCase().includes(k));
      _addSchoolSLEntry(sl, school, 'NE', shortEntry ? {
        month: shortEntry[1], date: mo,
        link:  r['Link to Observation Folder'] || r['Link to Google Form'] || '',
        notes: (r['Notes'] || '').slice(0, 120),
      } : null);
    });
    d.swSLObs.forEach(r => {
      const sl     = (r['Site Leader'] || '').trim();
      const school = (r['School'] || '').trim();
      if (!sl) return;
      ['Observation #1','Observation #2','Observation #3'].forEach((col, i) => {
        const val = (r[col] || '').trim();
        if (!val) return;
        const monthMatch = Object.entries(MONTH_ABBR).find(([k]) => val.toLowerCase().includes(k));
        _addSchoolSLEntry(sl, school, 'SW', {
          month: monthMatch ? monthMatch[1] : SW_OBS_FALLBACK[i],
          date: val, link: r['Link to Folder'] || '',
          notes: (r['Notes'] || '').slice(0, 120),
        });
      });
    });
    window._njtcSLObsBySchool = schoolSLMap;

    console.log(`[T&D] Obs maps built — tutors: ${Object.keys(tutorMap).length}, site leaders: ${Object.keys(slMap).length}, schools w/ SL obs: ${Object.keys(schoolSLMap).length}`);

    // Notify programming profiles module to re-render with live obs data
    if (typeof window._njtcObsReady === 'function') {
      try { window._njtcObsReady(); } catch(e) { /* no-op: profiles not yet mounted */ }
    }
  }

  // ── OTJ phase status helper ────────────────────────────────────────
  function getOTJStatus(val) {
    const v = (val || '').trim();
    if (v === 'Completed')                       return 'completed';
    if (v === 'In Progress')                     return 'in-progress';
    if (v.startsWith('Not Started'))             return 'needs-followup';
    if (v === 'N/A')                             return 'na';
    return 'none';
  }

  function otjStatusBadge(val) {
    const s = getOTJStatus(val);
    const map = {
      'completed':      ['Completed',        '#D6EFD8','#166534'],
      'in-progress':    ['In Progress',      '#FFF3CD','#92400E'],
      'needs-followup': ['PM Following Up',  '#FEE2E2','#991B1B'],
      'na':             ['N/A',              '#F3F4F6','#6B7280'],
      'none':           ['Not Started',      '#F3F4F6','#6B7280']
    };
    const [label, bg, color] = map[s] || map.none;
    return `<span style="padding:.15rem .5rem;border-radius:4px;font-size:.72rem;font-weight:700;background:${bg};color:${color}">${label}</span>`;
  }

  function adpStatusBadge(val) {
    const v = (val || '').trim();
    if (v === 'Active')          return `<span style="padding:.15rem .5rem;border-radius:4px;font-size:.72rem;font-weight:700;background:#DCFCE7;color:#166534">Active</span>`;
    if (v.includes('Terminat'))  return `<span style="padding:.15rem .5rem;border-radius:4px;font-size:.72rem;font-weight:700;background:#FEE2E2;color:#991B1B">Terminated</span>`;
    return `<span style="padding:.15rem .5rem;border-radius:4px;font-size:.72rem;font-weight:700;background:#F3F4F6;color:#6B7280">${v || 'Unknown'}</span>`;
  }

  // Live Tracker OTJ item count badge — shows X/17 with color based on completion %
  function otjItemBadge(count) {
    if (count === null || count === undefined) return '<span style="color:#9ca3af;font-size:.8rem">—</span>';
    const pct   = LIVE_TRACKER_OTJ_COLS > 0 ? Math.round(count / LIVE_TRACKER_OTJ_COLS * 100) : 0;
    const color = pct >= 80 ? '#059669' : pct >= 40 ? '#d97706' : count > 0 ? '#2563eb' : '#9ca3af';
    return `<span style="font-weight:700;font-size:.8rem;color:${color}">${count}<span style="font-weight:400;color:#9ca3af">/${LIVE_TRACKER_OTJ_COLS}</span></span>`;
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
        case 'pd':           renderPDTab();           break;
        case 'intake':       renderIntakeTab();       break;
        case 'apprentice':   renderApprenticeTab();   break;
        case 'survey-intel': renderSurveyIntelTab();  break;
      }
    }
  }

  function tdRefresh() {
    // Bust all caches and reload current visible tab
    _pdData = null; _intakeData = null; _apprParsed = null;
    Object.keys(_apprCache).forEach(k => delete _apprCache[k]);
    Object.keys(_tdLoaded).forEach(k => delete _tdLoaded[k]);
    Object.keys(_tdCharts).forEach(k => destroyChart(k));
    // Clear all panels
    ['pd','intake','apprentice','survey-intel'].forEach(id => {
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

  let _pdSubTab = 'analytics';

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
      el.innerHTML = buildPDTabWrapper();
      window.tdPDSubTab(_pdSubTab || 'analytics', null);
    } catch (e) {
      el.innerHTML = errorHTML(e.message, 'function(){_tdLoaded["pd"]=false;renderPDTab();}');
    }
  }

  function buildPDTabWrapper() {
    const now = new Date().toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
    return `<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:.5rem;margin-bottom:1rem">
      <div class="td-subtab-nav" style="margin-bottom:0;border-bottom:none;padding-bottom:0">
        <button id="pdST-analytics" class="td-subtab" onclick="window.tdPDSubTab('analytics',this)">📊 Session Analytics</button>
        <button id="pdST-explorer"  class="td-subtab" onclick="window.tdPDSubTab('explorer',this)">🔍 Response Explorer</button>
        <button id="pdST-summary"   class="td-subtab" onclick="window.tdPDSubTab('summary',this)">📋 T&amp;D Summary</button>
      </div>
      <span style="font-size:.7rem;color:var(--muted);background:var(--surface);border:1px solid var(--border);padding:.2rem .6rem;border-radius:20px">🔴 LIVE · ${now}</span>
    </div>
    <div style="border-bottom:2px solid var(--border);margin-bottom:1.25rem"></div>` +
    buildSeasonFilterBar() +
    `<div id="tdPdSubContent"></div>`;
  }

  window.tdPDSubTab = function(id, btn) {
    document.querySelectorAll('#td-content-pd .td-subtab').forEach(b => b.classList.remove('active'));
    const target = btn || document.getElementById('pdST-' + id);
    if (target) target.classList.add('active');
    _pdSubTab = id;
    const container = document.getElementById('tdPdSubContent');
    if (!container || !_pdData || !_pdData.length) return;
    switch (id) {
      case 'analytics': renderPDAnalytics(container, _pdData); break;
      case 'explorer':  renderPDExplorer(container, _pdData);  break;
      case 'summary':   renderPDSummary(container, _pdData);   break;
    }
  };

  // ── SUB-TAB 1: SESSION ANALYTICS ───────────────────────────────
  function renderPDAnalytics(container, rows) {
    rows = filterBySeason(rows, 'Date of PD Session');
    const sKey = r => (r['PD Session Number '] || r['PD Session Number'] || '').trim();
    const s1Rows = rows.filter(r => sKey(r) === 'PD Session 1');
    const s2Rows = rows.filter(r => sKey(r) === 'PD Session 2');
    const sessions = groupSessions(rows);

    function avgR(rws, f) {
      const v = rws.map(r => parseFloat(r[f])).filter(n => !isNaN(n));
      return v.length ? v.reduce((a,b) => a+b, 0) / v.length : 0;
    }

    const overallAvg  = avgR(rows, 'Overall satisfaction with this PD session');
    const recYes      = rows.filter(r => (r['Would you recommend this PD session to other sites?']||'').toLowerCase().startsWith('y')).length;
    const recMaybe    = rows.filter(r => (r['Would you recommend this PD session to other sites?']||'').toLowerCase().startsWith('m')).length;
    const recNo       = rows.length - recYes - recMaybe;
    const recRate     = pct(recYes, rows.length);
    const s1AvgAll    = avg(PD_RATING_FIELDS.map(f => avgR(s1Rows, f)));
    const s2AvgAll    = avg(PD_RATING_FIELDS.map(f => avgR(s2Rows, f)));
    const netImprove  = s2AvgAll - s1AvgAll;
    const s2RecYes    = s2Rows.filter(r => (r['Would you recommend this PD session to other sites?']||'').toLowerCase().startsWith('y')).length;

    const allFocus = [];
    rows.forEach(r => parseMultiSelect(r['What focus areas need additional support?']).forEach(v => allFocus.push(v)));
    const focusFreq = countFreq(allFocus).slice(0, 8);
    const roleFreq  = countFreq(rows.map(r => r['Role']).filter(Boolean));
    const expFreq   = countFreq(rows.map(r => r['Years of Experience in Tutoring / Education']).filter(Boolean));

    const s1Data = PD_RATING_FIELDS.map(f => parseFloat(avgR(s1Rows, f).toFixed(2)));
    const s2Data = PD_RATING_FIELDS.map(f => parseFloat(avgR(s2Rows, f).toFixed(2)));

    let html = `
      <!-- KPI row: 5 cards -->
      <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:.75rem;margin-bottom:1.25rem">
        ${kpiCard(rows.length, 'Total Responses', '#0050c8')}
        ${kpiCard(sessions.length, 'Sessions Delivered', '#1B2A4A')}
        ${kpiCard(overallAvg.toFixed(2)+'/5', 'Avg Overall Satisfaction <small style="font-size:.65em">(1–5 scale)</small>', overallAvg>=4.0?'#059669':'#d97706')}
        ${kpiCard(recRate+'%', 'Recommend Rate', recRate>=80?'#059669':'#d97706')}
        ${kpiCard((netImprove>=0?'+':'')+netImprove.toFixed(2), 'S1→S2 Net Improvement', netImprove>0?'#059669':'#d97706')}
      </div>
      <!-- Charts row 1: radar + grouped bar -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;margin-bottom:1rem">
        <div class="ta-card" style="padding:1.25rem">
          <div class="ta-card-title">Session Comparison — 5 Dimensions <span style="font-weight:400;font-style:italic;text-transform:none">(Amber=S1, Navy=S2)</span></div>
          <div style="position:relative;height:230px"><canvas id="tdPdRadarChart"></canvas></div>
        </div>
        <div class="ta-card" style="padding:1.25rem">
          <div class="ta-card-title">Session-by-Session Ratings (avg, 1–5 scale)</div>
          <div style="position:relative;height:230px"><canvas id="tdPdGroupedBarChart"></canvas></div>
        </div>
      </div>
      <!-- Charts row 2: role + experience + recommend -->
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:1rem;margin-bottom:1rem">
        <div class="ta-card" style="padding:1.25rem">
          <div class="ta-card-title">Role Breakdown <span style="font-weight:400;text-transform:none">(n=${rows.length})</span></div>
          <div style="position:relative;height:200px"><canvas id="tdPdRoleChartA"></canvas></div>
        </div>
        <div class="ta-card" style="padding:1.25rem">
          <div class="ta-card-title">Experience Distribution (1–5+ yrs)</div>
          <div style="position:relative;height:200px"><canvas id="tdPdExpChartA"></canvas></div>
        </div>
        <div class="ta-card" style="padding:1.25rem;text-align:center">
          <div class="ta-card-title" style="text-align:left">Recommend This PD?</div>
          <div style="font-size:2.75rem;font-weight:800;color:#2A7D4F;line-height:1;margin-top:.75rem">${recRate}%</div>
          <div style="font-size:.8rem;color:var(--muted);margin-top:.2rem">would recommend to other sites</div>
          <div style="display:flex;gap:.4rem;justify-content:center;flex-wrap:wrap;margin-top:1rem;font-size:.78rem">
            <span style="background:#D6EFD8;color:#166534;padding:.15rem .55rem;border-radius:20px">✓ Yes: ${recYes}</span>
            <span style="background:#FFF3CD;color:#92400E;padding:.15rem .55rem;border-radius:20px">~ Maybe: ${recMaybe}</span>
            <span style="background:#FEE2E2;color:#991B1B;padding:.15rem .55rem;border-radius:20px">✗ No: ${recNo}</span>
          </div>
          <div style="font-size:.72rem;color:var(--muted);margin-top:.75rem">Session 2: ${pct(s2RecYes,s2Rows.length)}% recommend</div>
        </div>
      </div>
      <!-- Focus areas -->
      <div class="ta-card" style="padding:1.25rem;margin-bottom:1rem">
        <div class="ta-card-title">Focus Areas Needing Additional Support (mention count)</div>
        <div style="position:relative;height:${Math.max(140, focusFreq.length*28)}px"><canvas id="tdPdFocusChartA"></canvas></div>
      </div>`;

    if (getDept() === 'data') {
      const expGroups = {};
      rows.forEach(r => {
        const exp = r['Years of Experience in Tutoring / Education'] || 'Unknown';
        const v = parseFloat(r['Overall satisfaction with this PD session']);
        if (!isNaN(v)) { if (!expGroups[exp]) expGroups[exp] = []; expGroups[exp].push(v); }
      });
      html += `<div class="ta-card" style="padding:1.25rem;border-top:3px solid #1B2A4A">
        <div class="ta-card-title">Data Dept — Experience × Satisfaction Cross-Tab</div>
        <div style="display:flex;gap:.75rem;flex-wrap:wrap">
          ${Object.entries(expGroups).map(([exp, vals]) => {
            const a = avg(vals);
            return `<div style="background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:.75rem 1rem;min-width:130px;text-align:center">
              <div style="font-size:.75rem;color:var(--muted);margin-bottom:.2rem">${exp}</div>
              <div style="font-size:1.5rem;font-weight:800;color:${a>=4.5?'#059669':a>=4?'#2A7D4F':'#d97706'}">${a.toFixed(2)}</div>
              <div style="font-size:.7rem;color:var(--muted)">n=${vals.length} · /5</div>
            </div>`;
          }).join('')}
        </div>
      </div>`;
    }

    container.innerHTML = html;

    setTimeout(() => {
      const radarLabels = ['Objectives', 'Content', 'Actionable', 'Discussion', 'Overall'];
      makeChart('tdPdRadarChart', {
        type: 'radar',
        data: { labels: radarLabels, datasets: [
          { label: 'PD Session 1', data: s1Data, borderColor: '#C9A84C', backgroundColor: 'rgba(201,168,76,0.12)', pointBackgroundColor: '#C9A84C', borderWidth: 2 },
          { label: 'PD Session 2', data: s2Data, borderColor: '#1B2A4A', backgroundColor: 'rgba(27,42,74,0.12)', pointBackgroundColor: '#1B2A4A', borderWidth: 2 }
        ]},
        options: { responsive:true, maintainAspectRatio:false,
          scales: { r: { min:3, max:5, ticks:{ stepSize:.5, font:{size:9} }, pointLabels:{ font:{size:11} } } },
          plugins: { legend:{ position:'bottom', labels:{ font:{size:11} } } }
        }
      });
      makeChart('tdPdGroupedBarChart', {
        type: 'bar',
        data: { labels: radarLabels, datasets: [
          { label: 'PD Session 1', data: s1Data, backgroundColor: '#C9A84C', borderRadius: 3 },
          { label: 'PD Session 2', data: s2Data, backgroundColor: '#1B2A4A', borderRadius: 3 }
        ]},
        options: { responsive:true, maintainAspectRatio:false,
          scales: { y: { min:3, max:5, ticks:{ stepSize:.5 } } },
          plugins: { legend:{ position:'bottom', labels:{ font:{size:11} } },
            datalabels:{ anchor:'end', align:'top', font:{size:9}, formatter: v => v != null ? v.toFixed(2) : '' } }
        }
      });
      makeChart('tdPdRoleChartA', {
        type: 'doughnut',
        data: { labels: roleFreq.map(([l])=>l), datasets:[{ data: roleFreq.map(([,n])=>n), backgroundColor:['#e76f51','#457b9d','#2a9d8f','#e9c46a','#264653','#6b21a8'] }] },
        options: { responsive:true, maintainAspectRatio:false, cutout:'55%', plugins:{ legend:{ position:'right', labels:{ font:{size:10}, boxWidth:12 } } } }
      });
      makeChart('tdPdExpChartA', {
        type: 'bar',
        data: { labels: expFreq.map(([l])=>l), datasets:[{ data: expFreq.map(([,n])=>n), backgroundColor:'#457b9d', borderRadius:4 }] },
        options: { responsive:true, maintainAspectRatio:false, indexAxis:'y',
          plugins: { legend:{display:false}, tooltip:{callbacks:{label: ctx => `${ctx.parsed.x} respondents`}} },
          scales: { x: { beginAtZero:true, ticks:{precision:0} } }
        }
      });
      makeChart('tdPdFocusChartA', {
        type: 'bar',
        data: { labels: focusFreq.map(([l]) => l.length>38 ? l.slice(0,36)+'…' : l), datasets:[{ data: focusFreq.map(([,n])=>n), backgroundColor:'#e76f51', borderRadius:4 }] },
        options: { responsive:true, maintainAspectRatio:false, indexAxis:'y',
          plugins: { legend:{display:false}, tooltip:{callbacks:{label: ctx => `${ctx.parsed.x} mentions`}} },
          scales: { x: { beginAtZero:true, ticks:{precision:0} } }
        }
      });
    }, 50);
  }

  // ── SUB-TAB 2: RESPONSE EXPLORER ───────────────────────────────
  function renderPDExplorer(container, rows) {
    rows = filterBySeason(rows, 'Date of PD Session');
    const sKey = r => (r['PD Session Number '] || r['PD Session Number'] || '').trim();
    const allSessions = [...new Set(rows.map(sKey).filter(Boolean))].sort();
    const allRoles    = [...new Set(rows.map(r => r['Role']).filter(Boolean))].sort();
    const allExp      = [...new Set(rows.map(r => r['Years of Experience in Tutoring / Education']).filter(Boolean))].sort();

    container.innerHTML = `
      <div style="display:flex;gap:.5rem;flex-wrap:wrap;margin-bottom:1rem;align-items:center">
        <span style="font-size:.75rem;font-weight:700;color:var(--muted);text-transform:uppercase">Filter</span>
        <select class="filter-select" id="pdExpSession" onchange="window.applyPDExplorer()">
          <option value="">All Sessions</option>
          ${allSessions.map(s => `<option>${s}</option>`).join('')}
        </select>
        <select class="filter-select" id="pdExpRole" onchange="window.applyPDExplorer()">
          <option value="">All Roles</option>
          ${allRoles.map(r => `<option>${r}</option>`).join('')}
        </select>
        <select class="filter-select" id="pdExpExp" onchange="window.applyPDExplorer()">
          <option value="">All Experience</option>
          ${allExp.map(e => `<option>${e}</option>`).join('')}
        </select>
        <select class="filter-select" id="pdExpRating" onchange="window.applyPDExplorer()">
          <option value="">All Ratings</option>
          <option>5</option><option>4</option><option>3</option><option>2</option><option>1</option>
        </select>
        <span id="pdExpCount" style="font-size:.75rem;color:var(--muted)">${rows.length} responses</span>
      </div>
      <div id="pdExplorerContent"></div>`;

    renderPDExplorerContent(rows);
  }

  function renderPDExplorerContent(rows) {
    rows = filterBySeason(rows, 'Date of PD Session');
    const container = document.getElementById('pdExplorerContent');
    if (!container) return;
    const sKey = r => (r['PD Session Number '] || r['PD Session Number'] || '').trim();

    function ratingBg(v) {
      if (v >= 5) return '#D6EFD8'; if (v >= 4) return '#dcfce7';
      if (v >= 3) return '#FFF3CD'; if (v >= 2) return '#fee2e2'; return '#fecaca';
    }
    function ratingFg(v) {
      if (v >= 5) return '#166534'; if (v >= 4) return '#2A7D4F';
      if (v >= 3) return '#92400e'; if (v >= 2) return '#991b1b'; return '#7f1d1d';
    }

    let html = `<div class="ta-card" style="padding:0;margin-bottom:1rem;overflow:hidden">
      <div style="overflow-x:auto;max-height:340px;overflow-y:auto">
        <table style="width:100%;border-collapse:collapse;font-size:.78rem;min-width:680px">
          <thead style="position:sticky;top:0;z-index:1">
            <tr style="background:#1B2A4A;color:#fff">
              <th style="padding:.45rem .75rem;text-align:left">Date</th>
              <th style="padding:.45rem .5rem;text-align:left">Session</th>
              <th style="padding:.45rem .5rem;text-align:left">Role</th>
              <th style="padding:.45rem .4rem;text-align:center" title="The PD objectives were clearly communicated.">Obj.</th>
              <th style="padding:.45rem .4rem;text-align:center" title="The content was directly relevant to my site responsibilities.">Rel.</th>
              <th style="padding:.45rem .4rem;text-align:center" title="The facilitator(s) provided clear, actionable strategies I can use immediately.">Action.</th>
              <th style="padding:.45rem .4rem;text-align:center" title="The session allowed for meaningful discussion and participation.">Discuss.</th>
              <th style="padding:.45rem .4rem;text-align:center" title="Overall satisfaction with this PD session (1=lowest, 5=highest)">Overall</th>
              <th style="padding:.45rem .4rem;text-align:center">Rec?</th>
            </tr>
          </thead>
          <tbody>
            ${rows.map((r, i) => {
              const overall = parseFloat(r['Overall satisfaction with this PD session']);
              const rec = (r['Would you recommend this PD session to other sites?']||'').trim();
              const sn = sKey(r).replace('PD Session ','S');
              const hasDetail = r['What is one key takeaway or strategy you plan to apply at your site?'] ||
                                r['Any additional comments, feedback, or shoutouts?'] ||
                                r['What additional supports or follow-up would help you implement what was learned?'];
              return `<tr style="border-bottom:1px solid #e5e7eb;${i%2?'background:#f9fafb':''};cursor:${hasDetail?'pointer':'default'}" ${hasDetail?`onclick="window.pdRowExpand(${i})"`:''}">
                <td style="padding:.35rem .75rem;white-space:nowrap;color:var(--muted);font-size:.75rem">${fmtDate(r['Date of PD Session'])||'—'}</td>
                <td style="padding:.35rem .5rem"><span style="background:#dbeafe;color:#1e40af;padding:.1rem .4rem;border-radius:4px;font-size:.7rem;font-weight:700">${sn}</span></td>
                <td style="padding:.35rem .5rem;max-width:110px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:.77rem">${r['Role']||'—'}</td>
                ${PD_RATING_FIELDS.map(f => {
                  const v = parseFloat(r[f]);
                  return `<td style="padding:.35rem .4rem;text-align:center"><span style="background:${ratingBg(v)};color:${ratingFg(v)};padding:.1rem .35rem;border-radius:4px;font-size:.75rem;font-weight:700">${isNaN(v)?'—':v}</span></td>`;
                }).join('')}
                <td style="padding:.35rem .4rem;text-align:center;font-size:.75rem;font-weight:700;color:${rec==='Yes'?'#059669':rec==='Maybe'?'#d97706':'#b91c1c'}">${rec==='Yes'?'✓ Yes':rec==='Maybe'?'~ Maybe':'✗ No'}</td>
              </tr>
              ${hasDetail ? `<tr id="pdExpRow-${i}" style="display:none;background:#f0f7ff">
                <td colspan="9" style="padding:.75rem 1rem;font-size:.82rem">
                  ${r['What is one key takeaway or strategy you plan to apply at your site?'] ? `<div style="margin-bottom:.5rem"><span style="font-size:.65rem;font-weight:700;text-transform:uppercase;letter-spacing:.04em;color:#e76f51">Key Takeaway</span><div style="margin-top:.15rem">${r['What is one key takeaway or strategy you plan to apply at your site?']}</div></div>` : ''}
                  ${r['What focus areas need additional support?'] ? `<div style="margin-bottom:.5rem"><span style="font-size:.65rem;font-weight:700;text-transform:uppercase;letter-spacing:.04em;color:#d97706">Focus Areas Needed</span><div style="margin-top:.15rem">${r['What focus areas need additional support?']}</div></div>` : ''}
                  ${r['What additional supports or follow-up would help you implement what was learned?'] ? `<div style="margin-bottom:.5rem"><span style="font-size:.65rem;font-weight:700;text-transform:uppercase;letter-spacing:.04em;color:#457b9d">Support Needed</span><div style="margin-top:.15rem">${r['What additional supports or follow-up would help you implement what was learned?']}</div></div>` : ''}
                  ${r['Any additional comments, feedback, or shoutouts?'] ? `<div><span style="font-size:.65rem;font-weight:700;text-transform:uppercase;letter-spacing:.04em;color:var(--muted)">Comments &amp; Shoutouts</span><div style="margin-top:.15rem">${r['Any additional comments, feedback, or shoutouts?']}</div></div>` : ''}
                </td>
              </tr>` : ''}`;
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>`;

    const takeaways = rows.map(r => ({ text: r['What is one key takeaway or strategy you plan to apply at your site?'], role: r['Role'], sn: sKey(r).replace('PD Session ','S') })).filter(q => q.text && q.text.trim());
    const comments  = rows.map(r => ({ text: r['Any additional comments, feedback, or shoutouts?'], role: r['Role'], sn: sKey(r).replace('PD Session ','S') })).filter(q => q.text && q.text.trim());
    const supports  = rows.map(r => ({ text: r['What additional supports or follow-up would help you implement what was learned?'], role: r['Role'], sn: sKey(r).replace('PD Session ','S') })).filter(q => q.text && q.text.trim());

    function quoteCards(quotes, limit) {
      return quotes.slice(0, limit).map(q =>
        `<div class="quote-card">
          <span class="role-badge">${q.sn}</span>
          ${q.role ? `<span style="font-size:.68rem;color:var(--muted);margin-left:.25rem;font-style:normal">${q.role}</span>` : ''}
          <div style="margin-top:.3rem">${q.text.length > 180 ? q.text.slice(0,178)+'…' : q.text}</div>
        </div>`).join('') || '<div style="font-size:.8rem;color:var(--muted);padding:.5rem 0">No responses</div>';
    }

    html += `<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:1rem">
      <div class="ta-card" style="padding:1.25rem">
        <div class="ta-card-title">💡 Key Takeaways (${takeaways.length})</div>
        <div style="max-height:280px;overflow-y:auto">${quoteCards(takeaways, 15)}</div>
      </div>
      <div class="ta-card" style="padding:1.25rem">
        <div class="ta-card-title">🌟 Shoutouts &amp; Comments (${comments.length})</div>
        <div style="max-height:280px;overflow-y:auto">${quoteCards(comments, 15)}</div>
      </div>
      <div class="ta-card" style="padding:1.25rem">
        <div class="ta-card-title">🤝 Support Needed (${supports.length})</div>
        <div style="max-height:280px;overflow-y:auto">${quoteCards(supports, 15)}</div>
      </div>
    </div>`;

    container.innerHTML = html;
    const countEl = document.getElementById('pdExpCount');
    if (countEl) countEl.textContent = rows.length + ' of ' + (_pdData ? _pdData.length : rows.length) + ' responses';
  }

  window.pdRowExpand = function(i) {
    const row = document.getElementById('pdExpRow-' + i);
    if (row) row.style.display = row.style.display === 'none' ? '' : 'none';
  };

  window.applyPDExplorer = function() {
    if (!_pdData) return;
    const sKey   = r => (r['PD Session Number '] || r['PD Session Number'] || '').trim();
    const sessV  = (document.getElementById('pdExpSession')||{}).value || '';
    const roleV  = (document.getElementById('pdExpRole')||{}).value || '';
    const expV   = (document.getElementById('pdExpExp')||{}).value || '';
    const ratV   = parseInt((document.getElementById('pdExpRating')||{}).value) || 0;
    const filtered = _pdData.filter(r => {
      if (!isValidRow(r, 'pd')) return false;
      if (sessV && sKey(r) !== sessV) return false;
      if (roleV && (r['Role']||'') !== roleV) return false;
      if (expV  && (r['Years of Experience in Tutoring / Education']||'') !== expV) return false;
      if (ratV  && parseInt(r['Overall satisfaction with this PD session']) !== ratV) return false;
      return true;
    });
    renderPDExplorerContent(filtered);
  };

  // ── SUB-TAB 3: T&D EXECUTIVE SUMMARY ───────────────────────────
  function renderPDSummary(container, rows) {
    rows = filterBySeason(rows, 'Date of PD Session');
    const dept = getDept();
    const sKey = r => (r['PD Session Number '] || r['PD Session Number'] || '').trim();
    const s1Rows = rows.filter(r => sKey(r) === 'PD Session 1');
    const s2Rows = rows.filter(r => sKey(r) === 'PD Session 2');
    function avgR(rws, f) {
      const v = rws.map(r => parseFloat(r[f])).filter(n => !isNaN(n));
      return v.length ? v.reduce((a,b) => a+b, 0) / v.length : 0;
    }
    const overallAvg    = avgR(rows, 'Overall satisfaction with this PD session');
    const discussAvg    = avgR(rows, 'The session allowed for meaningful discussion and participation.');
    const contentAvg    = avgR(rows, 'The content was directly relevant to my site responsibilities.');
    const s1OverallAvg  = avgR(s1Rows, 'Overall satisfaction with this PD session');
    const s2OverallAvg  = avgR(s2Rows, 'Overall satisfaction with this PD session');
    const s1DiscussAvg  = avgR(s1Rows, 'The session allowed for meaningful discussion and participation.');
    const s2DiscussAvg  = avgR(s2Rows, 'The session allowed for meaningful discussion and participation.');
    const recYes        = rows.filter(r => (r['Would you recommend this PD session to other sites?']||'').toLowerCase().startsWith('y')).length;
    const s2RecYes      = s2Rows.filter(r => (r['Would you recommend this PD session to other sites?']||'').toLowerCase().startsWith('y')).length;
    const s2Gain        = s2OverallAvg - s1OverallAvg;
    const sessions      = [...new Set(rows.map(sKey).filter(Boolean))];
    const allFocus      = [];
    rows.forEach(r => parseMultiSelect(r['What focus areas need additional support?']).forEach(v => allFocus.push(v)));
    const focusTop      = countFreq(allFocus).slice(0, 5);
    const now = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

    container.innerHTML = `<div id="td-summary-print">
      ${getDept() === 'data' ? `<div class="no-print" style="display:flex;align-items:center;justify-content:flex-end;
        gap:.625rem;flex-wrap:wrap;margin-bottom:1.25rem;padding:.875rem 1rem;
        background:var(--surface-2);border:1px solid var(--border);border-radius:12px">
        <div style="display:flex;align-items:center;gap:.375rem;flex-wrap:wrap">
          <span style="font-family:'Plus Jakarta Sans',sans-serif;font-size:.6875rem;font-weight:700;
            text-transform:uppercase;letter-spacing:.08em;color:var(--muted);margin-right:.25rem">Export CSV</span>
          <button class="btn btn-secondary btn-sm" onclick="window.tdExportCSV_PD_Leadership()"
            title="Session KPIs — no individual names">👑 Leadership</button>
          <button class="btn btn-secondary btn-sm" onclick="window.tdExportCSV_PD_Programming()"
            title="Site-level breakdown">🎯 Programming</button>
          <button class="btn btn-secondary btn-sm" onclick="window.tdExportCSV_PD_Training()"
            title="Full row-level detail">🎓 T&D Full</button>
        </div>
        <button class="btn btn-primary btn-sm" onclick="window.tdPDExportPDF()">📄 Export PDF</button>
      </div>` : ''}

      <div class="td-print-section" style="background:#1B2A4A;color:#fff;border-radius:10px;padding:1.5rem;margin-bottom:1rem">
        <div style="font-size:.7rem;letter-spacing:.1em;text-transform:uppercase;color:#C9A84C;font-weight:700">NJTC Training &amp; Development</div>
        <div style="font-size:1.2rem;font-weight:800;margin:.25rem 0">SY 2025–2026 | Professional Development Summary</div>
        <div style="font-size:.8rem;color:#a8b8d8">Generated: ${now}</div>
      </div>

      <div class="ta-card td-print-section" style="padding:1.25rem;margin-bottom:1rem">
        <div class="ta-card-title">📊 Program at a Glance</div>
        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:.75rem">
          ${kpiCard(rows.length, 'Total Responses', '#1B2A4A')}
          ${kpiCard(sessions.length, 'Sessions', '#1B2A4A')}
          ${kpiCard(overallAvg.toFixed(2)+'/5', 'Avg Satisfaction', '#2A7D4F')}
          ${kpiCard(pct(recYes,rows.length)+'%', 'Recommend Rate', '#2A7D4F')}
        </div>
      </div>

      <div class="ta-card td-print-section" style="padding:1.25rem;margin-bottom:1rem">
        <div class="ta-card-title">✨ Glows — What's Working</div>
        <div class="card-glow">Session 2 marked a significant improvement over Session 1 across all five dimensions, with overall satisfaction rising from <strong>${s1OverallAvg.toFixed(2)}</strong> to <strong>${s2OverallAvg.toFixed(2)}</strong> — a ${pct(s2Gain, s1OverallAvg)}% gain.</div>
        <div class="card-glow">Discussion quality rated highest in Session 2 (<strong>${s2DiscussAvg.toFixed(2)}/5</strong>), reflecting stronger engagement design.</div>
        <div class="card-glow"><strong>${pct(recYes,rows.length)}%</strong> of respondents would recommend these PD sessions to other sites; Session 2 reached <strong>${pct(s2RecYes,s2Rows.length)}%</strong> recommend rate.</div>
        <div class="card-glow">Facilitator team received consistent positive recognition — <strong>Anne Lee</strong> and <strong>Amir Wallace</strong> cited by name across multiple sessions.</div>
        <div class="card-glow">Content relevance rated the highest overall dimension (<strong>${contentAvg.toFixed(2)}/5</strong>), confirming PD topics resonate with field realities.</div>
      </div>

      <div class="ta-card td-print-section" style="padding:1.25rem;margin-bottom:1rem">
        <div class="ta-card-title">📈 Grows — Areas of Opportunity</div>
        <div class="card-grow">Overall satisfaction (<strong>${overallAvg.toFixed(2)}/5</strong>) and discussion quality (<strong>${discussAvg.toFixed(2)}/5</strong>) have the most room for growth relative to other dimensions.</div>
        <div class="card-grow">PD Session 1 discussion quality (<strong>${s1DiscussAvg.toFixed(2)}/5</strong>) was the lowest-rated dimension — signals a need for more structured participation design in early-year sessions.</div>
        <div class="card-grow">Multiple respondents noted lesson planning PD arrived <em>after</em> scholars had already begun — a timing gap that creates early-year frustration for new tutors.</div>
        <div class="card-grow">Subject-specific PD (Math vs. ELA differentiation) was explicitly requested — current sessions are cross-content.</div>
        <div class="card-grow">Atmosphere and tone feedback from Session 1 warrants facilitator reflection and psychological safety design consideration.</div>
        <div class="card-grow">"PD was too long" noted in Session 2 — session pacing and time management warrant attention.</div>
        <div class="card-grow"><strong>${focusTop[2] ? focusTop[2][1] : 0} responses</strong> cited Operations/Reporting as a needed focus area — aligns with apprenticeship program support gaps.</div>
      </div>

      <div class="ta-card td-print-section" style="padding:1.25rem;margin-bottom:1rem">
        <div class="ta-card-title">⭐ Standouts</div>
        <div class="card-standout"><strong>Anne Lee</strong> — Most frequently cited facilitator by name across both sessions; praised for energy, clarity, humor, and instructional quality.</div>
        <div class="card-standout"><strong>Amir Wallace</strong> — Recognized for respect, directness, and contextualizing the WHY behind program partnerships.</div>
        <div class="card-standout"><strong>Session 2 Team</strong> — Praised for incorporating movement, grade-level groupwork, and reflective components.</div>
        <div class="card-standout"><strong>Taneisha Clemmons</strong> — Cited for making sessions comprehensive and providing clarity.</div>
      </div>

      <div class="ta-card td-print-section" style="padding:1.25rem;margin-bottom:1rem">
        <div class="ta-card-title">🎯 Strategic Takeaways &amp; Next Steps</div>
        <div class="card-action"><strong>1. Front-load lesson planning PD</strong> — Move key instructional content to pre-service or Week 1 to prevent early-year frustration.</div>
        <div class="card-action"><strong>2. Subject differentiation</strong> — Pilot Math-specific and ELA-specific PD tracks for SY 26–27; significant demand signal from tutors and SCs.</div>
        <div class="card-action"><strong>3. Formalize scholar survey logistics</strong> — Create a paper-based fallback or site-level Pearl input protocol for sites with limited device access.</div>
        <div class="card-action"><strong>4. Maintain Session 2 design elements</strong> — Movement, groupwork by grade/site, and reflection components drove Session 2's higher scores; codify as PD design standards.</div>
        <div class="card-action"><strong>5. Strengthen i-Ready training</strong> — The #1 focus area (${focusTop[0]?focusTop[0][1]:0} mentions); an i-Ready-specific session or embedded module is warranted.</div>
        <div class="card-action"><strong>6. Atmosphere design</strong> — Embed explicit norms for mutual respect and psychological safety in PD facilitation guide.</div>
        <div class="card-action"><strong>7. Apprentice-specific content</strong> — Tutor-Apprentices show distinct content needs (OTJ, documentation, scaffolding); explore breakout time within shared PD sessions.</div>
      </div>

      <div class="ta-card td-print-section" style="padding:1.25rem">
        <div class="ta-card-title">📊 Data at a Glance</div>
        <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:.5rem;margin-bottom:1rem">
          ${PD_RATING_FIELDS.map((f, fi) => {
            const a = avgR(rows, f); const s1 = avgR(s1Rows, f); const s2 = avgR(s2Rows, f);
            return `<div style="text-align:center;background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:.75rem .5rem">
              <div style="font-size:1.1rem;font-weight:800;color:${a>=4.5?'#2A7D4F':a>=4?'#059669':'#d97706'}">${a.toFixed(2)}</div>
              <div style="font-size:.65rem;color:var(--muted);line-height:1.3;margin:.2rem 0">${PD_RATING_SHORT[fi]}</div>
              <div style="font-size:.65rem;color:#C9A84C">S1: ${s1.toFixed(2)}</div>
              <div style="font-size:.65rem;color:#1B2A4A">S2: ${s2.toFixed(2)}</div>
            </div>`;
          }).join('')}
        </div>
        <div style="font-size:.75rem;font-weight:700;color:var(--muted);text-transform:uppercase;margin-bottom:.5rem">Top Focus Areas Needing Support</div>
        ${focusTop.map(([label, cnt]) => `
          <div style="display:flex;justify-content:space-between;align-items:center;padding:.3rem 0;border-bottom:1px solid var(--border-2);font-size:.82rem">
            <span>${label}</span><strong style="color:#e76f51">${cnt} mentions</strong>
          </div>`).join('')}
      </div>
    </div>`;
  }

  window.tdPDExportPDF = function() {
    const el = document.getElementById('td-summary-print');
    if (!el) return;
    window.print();
  };

  // ── CSV Download utility (7G) ────────────────────────────────────
  function _tdCSV(filename, rows, cols) {
    function esc(v) {
      const s = String(v == null ? '' : v).replace(/\r\n/g, ' ').replace(/\n/g, ' ');
      return (s.includes(',') || s.includes('"')) ? '"' + s.replace(/"/g, '""') + '"' : s;
    }
    const bom  = '\uFEFF';
    const hdr  = cols.map(c => esc(c.h)).join(',');
    const body = rows.map(r => cols.map(c => esc(r[c.k] || '')).join(',')).join('\r\n');
    const blob = new Blob([bom + hdr + '\r\n' + body], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 3000);
  }

  // ── Leadership CSV export — PD Sessions (no individual names) (7H) ──
  window.tdExportCSV_PD_Leadership = function() {
    if (!_pdData || !_pdData.length) { alert('PD data not loaded.'); return; }
    const rows   = filterBySeason(_pdData, 'Date of PD Session');
    const season = _tdActiveSeason === 'all' ? 'All-Seasons' : _tdActiveSeason.charAt(0).toUpperCase() + _tdActiveSeason.slice(1);
    const sKey   = r => (r['PD Session Number '] || r['PD Session Number'] || '').trim();
    const sessions = Array.from(new Set(rows.map(sKey))).filter(Boolean).sort();
    const avg = (rws, col) => {
      const v = rws.map(r => parseFloat(r[col])).filter(n => !isNaN(n));
      return v.length ? (v.reduce((a,b) => a+b, 0) / v.length).toFixed(2) : '';
    };
    const summaryRows = sessions.map(sess => {
      const sr = rows.filter(r => sKey(r) === sess);
      return {
        session:        sess,
        date:           (sr[0] && sr[0]['Date of PD Session']) || '',
        season:         getSeason((sr[0] && sr[0]['Date of PD Session']) || ''),
        responses:      sr.length,
        avg_overall:    avg(sr, 'Overall satisfaction with this PD session'),
        avg_discussion: avg(sr, 'The session allowed for meaningful discussion and participation.'),
        avg_content:    avg(sr, 'The content was directly relevant to my site responsibilities.'),
        avg_strategies: avg(sr, 'The facilitator(s) provided clear, actionable strategies I can use immediately.'),
        pct_recommend:  sr.length ? Math.round(sr.filter(r => (r['Would you recommend this PD session to other sites?'] || '').toLowerCase().startsWith('y')).length / sr.length * 100) + '%' : ''
      };
    });
    _tdCSV('NJTC-TD-PD-Leadership-' + season + '-' + new Date().toISOString().slice(0,10) + '.csv', summaryRows, [
      {h:'PD Session', k:'session'}, {h:'Date', k:'date'}, {h:'Season', k:'season'},
      {h:'Total Responses', k:'responses'}, {h:'Avg Overall Sat', k:'avg_overall'},
      {h:'Avg Discussion', k:'avg_discussion'}, {h:'Avg Content Relevance', k:'avg_content'},
      {h:'Avg Strategies', k:'avg_strategies'}, {h:'% Would Recommend', k:'pct_recommend'}
    ]);
  };

  // ── Programming CSV export — site-level (7I) ─────────────────────
  window.tdExportCSV_PD_Programming = function() {
    if (!_pdData || !_pdData.length) { alert('PD data not loaded.'); return; }
    const rows   = filterBySeason(_pdData, 'Date of PD Session');
    const season = _tdActiveSeason === 'all' ? 'All-Seasons' : _tdActiveSeason.charAt(0).toUpperCase() + _tdActiveSeason.slice(1);
    const SITE_COL = findCol(rows, 'site', 'school', 'district', 'location') || 'Site';
    const sKey = r => (r['PD Session Number '] || r['PD Session Number'] || '').trim();
    const grps = {};
    rows.forEach(r => {
      const s    = sKey(r);
      const site = r[SITE_COL] || 'Unknown';
      const k    = site + '|||' + s;
      if (!grps[k]) grps[k] = { site, session: s, date: r['Date of PD Session'] || '', rows: [] };
      grps[k].rows.push(r);
    });
    const avg = (rws, col) => {
      const v = rws.map(r => parseFloat(r[col])).filter(n => !isNaN(n));
      return v.length ? (v.reduce((a,b) => a+b, 0) / v.length).toFixed(2) : '';
    };
    const siteRows = Object.values(grps)
      .sort((a,b) => a.site.localeCompare(b.site) || a.session.localeCompare(b.session))
      .map(g => ({
        site:          g.site,
        session:       g.session,
        date:          g.date,
        season:        getSeason(g.date),
        responses:     g.rows.length,
        avg_overall:   avg(g.rows, 'Overall satisfaction with this PD session'),
        avg_content:   avg(g.rows, 'The content was directly relevant to my site responsibilities.'),
        avg_discussion:avg(g.rows, 'The session allowed for meaningful discussion and participation.')
      }));
    _tdCSV('NJTC-TD-PD-Programming-' + season + '-' + new Date().toISOString().slice(0,10) + '.csv', siteRows, [
      {h:'Site', k:'site'}, {h:'PD Session', k:'session'}, {h:'Date', k:'date'},
      {h:'Season', k:'season'}, {h:'Responses', k:'responses'},
      {h:'Avg Overall', k:'avg_overall'}, {h:'Avg Content', k:'avg_content'},
      {h:'Avg Discussion', k:'avg_discussion'}
    ]);
  };

  // ── T&D Full CSV export (7J) ──────────────────────────────────────
  window.tdExportCSV_PD_Training = function() {
    if (!_pdData || !_pdData.length) { alert('PD data not loaded.'); return; }
    const rows   = filterBySeason(_pdData, 'Date of PD Session');
    const season = _tdActiveSeason === 'all' ? 'All-Seasons' : _tdActiveSeason.charAt(0).toUpperCase() + _tdActiveSeason.slice(1);
    if (!rows.length) { alert('No records match the current season filter.'); return; }
    const enriched = rows.map(r => { const o = Object.assign({}, r); o._Season = getSeason(r['Date of PD Session'] || ''); return o; });
    const keys = ['_Season'].concat(Object.keys(enriched[0]).filter(k => k !== '_Season'));
    _tdCSV('NJTC-TD-PD-Full-' + season + '-' + new Date().toISOString().slice(0,10) + '.csv',
      enriched, keys.map(k => ({ h: k === '_Season' ? 'Season' : k, k })));
  };

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

  window.filterPDResponses = function() { window.applyPDExplorer(); };


  // ══════════════════════════════════════════════════════════════════
  //  SUB-TAB 2: TRAINING INTAKE
  // ══════════════════════════════════════════════════════════════════

  // Base intake rating fields — field names are resolved against actual row keys via resolveIntakeFields(rows)
  const INTAKE_RATING_FIELDS_BASE = [
    { keywords: ['rate the effectiveness of the training', 'effectiveness of the training'], short: 'Overall Effectiveness', field: 'Overall, how would you rate the effectiveness of the training? (1 = Did not meet expectations, 5 = Exceeded expectations)' },
    { keywords: ['training itinerary', 'clear and well-structured', 'clear and well structured'], short: 'Clear Structure', field: 'The training itinerary/setup was clear and well-structured. (1 = Strongly disagree, 5 = Strongly agree)' },
    { keywords: ['training materials (slides and videos)', 'training materials', 'slides and videos'], short: 'Materials Useful', field: 'The training materials (slides and videos) were useful in preparing me for my role. (1 = Strongly disagree, 5 = Strongly agree)' },
    { keywords: ['trainers were knowledgeable', 'knowledgeable and responsive'], short: 'Trainer Quality', field: 'The trainers were knowledgeable and responsive to questions. (1 = Strongly disagree, 5 = Strongly agree)' },
    { keywords: ['how prepared do you feel', 'prepared to begin working'], short: 'Preparedness', field: 'After completing training, how prepared do you feel to begin working with scholars? (1 = Very unprepared, 5 = Extremely prepared)' },
    { keywords: ['asynchronous videos', 'async videos', 'individualized training experience'], short: 'Async Videos', field: 'The asynchronous videos allowed for a more individualized training experience. (1 = Strongly disagree, 5 = Strongly agree)' },
    { keywords: ['access and navigate google classroom', 'navigate google classroom'], short: 'GC Navigation', field: 'How easy was it to access and navigate Google Classroom?' },
    { keywords: ['well-organized were the training modules', 'organized were the training'], short: 'GC Organization', field: 'How well-organized were the training modules, assessments, and resources in Google Classroom?' },
    { keywords: ['layout support your understanding', 'classroom layout support'], short: 'GC Layout Support', field: 'To what extent did the Google Classroom layout support your understanding of the training material?' },
    { keywords: ['timely updates, announcements', 'updates, announcements, or reminders'], short: 'GC Updates', field: 'How effective was Google Classroom in providing timely updates, announcements, or reminders regarding course work?' },
  ];

  // Resolve INTAKE_RATING_FIELDS against actual row keys, filtering out columns with no data
  function resolveIntakeFields(rows) {
    return INTAKE_RATING_FIELDS_BASE.map(f => {
      const resolved = findCol(rows, ...f.keywords) || f.field;
      return { field: resolved, short: f.short };
    }).filter(f => {
      // Only include fields that actually have numeric data
      return rows.some(r => !isNaN(parseFloat(r[f.field])));
    });
  }

  // Fallback constant for code paths that don't have rows at call time
  const INTAKE_RATING_FIELDS = INTAKE_RATING_FIELDS_BASE.map(f => ({ field: f.field, short: f.short }));

  let _intakeSubTab = 'analytics';

  async function renderIntakeTab() {
    const el = document.getElementById('td-content-intake');
    if (!el) return;
    el.innerHTML = loadingHTML('Loading training intake data…');
    try {
      if (!_intakeData) {
        const text = await fetchCSV(TRAINING_INTAKE_URL);
        let parsed = parseCsvText(text, 0);
        if (!parsed.headers[0] || parsed.headers[0].trim() !== 'Timestamp') {
          parsed = parseCsvText(text, 1);
          if (!parsed.headers[0] || parsed.headers[0].trim() !== 'Timestamp') {
            throw new Error('Intake CSV header not found. Expected "Timestamp" in column A.');
          }
        }
        _intakeData = parsed.rows.filter(r => isValidRow(r, 'intake'));
      }
      el.innerHTML = buildIntakeTabWrapper();
      window.tdIntakeSubTab(_intakeSubTab || 'analytics', null);
    } catch (e) {
      el.innerHTML = errorHTML(e.message, 'function(){_tdLoaded["intake"]=false;renderIntakeTab();}');
    }
  }

  function buildIntakeTabWrapper() {
    const now = new Date().toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
    return `<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:.5rem;margin-bottom:1rem">
      <div class="td-subtab-nav" style="margin-bottom:0;border-bottom:none;padding-bottom:0">
        <button id="intST-analytics" class="td-subtab" onclick="window.tdIntakeSubTab('analytics',this)">📊 Intake Analytics</button>
        <button id="intST-district"  class="td-subtab" onclick="window.tdIntakeSubTab('district',this)">🏫 District View</button>
        <button id="intST-summary"   class="td-subtab" onclick="window.tdIntakeSubTab('summary',this)">📋 T&amp;D Intake Summary</button>
      </div>
      <span style="font-size:.7rem;color:var(--muted);background:var(--surface);border:1px solid var(--border);padding:.2rem .6rem;border-radius:20px">🔴 LIVE · ${now}</span>
    </div>
    <div style="border-bottom:2px solid var(--border);margin-bottom:1.25rem"></div>` +
    buildSeasonFilterBar() +
    `<div id="tdIntakeSubContent"></div>`;
  }

  window.tdIntakeSubTab = function(id, btn) {
    document.querySelectorAll('#td-content-intake .td-subtab').forEach(b => b.classList.remove('active'));
    const target = btn || document.getElementById('intST-' + id);
    if (target) target.classList.add('active');
    _intakeSubTab = id;
    const container = document.getElementById('tdIntakeSubContent');
    if (!container || !_intakeData || !_intakeData.length) return;
    switch (id) {
      case 'analytics': renderIntakeAnalytics(container, _intakeData); break;
      case 'district':  renderIntakeDistrictView(container, _intakeData); break;
      case 'summary':   renderIntakeSummary(container, _intakeData); break;
    }
  };

  // ── INTAKE SUB-TAB 1: ANALYTICS ────────────────────────────────
  function renderIntakeAnalytics(container, rows) {
    rows = filterBySeason(rows, 'Timestamp');
    // Use findCol for resilient matching — sheet column names may differ slightly
    const ROLE_COL   = findCol(rows, 'what is your role within njtc', 'your role within') || 'What is your role within NJTC? (Select one)';
    const HIRE_COL   = findCol(rows, 'new or returning hire', 'returning hire') || 'Are you a new or returning hire? (Select one)';
    const CERT_COL   = findCol(rows, 'certification status', 'currently certified') || 'What is your current certification status? (Select one)';
    const EFFECT_COL = findCol(rows, 'rate the effectiveness of the training', 'effectiveness of the training') || 'Overall, how would you rate the effectiveness of the training? (1 = Did not meet expectations, 5 = Exceeded expectations)';
    const PREP_COL   = findCol(rows, 'how prepared do you feel', 'prepared to begin working') || 'After completing training, how prepared do you feel to begin working with scholars? (1 = Very unprepared, 5 = Extremely prepared)';
    const TRAINER_COL= findCol(rows, 'trainers were knowledgeable', 'knowledgeable and responsive') || 'The trainers were knowledgeable and responsive to questions. (1 = Strongly disagree, 5 = Strongly agree)';
    const ASSET_WANT = findCol(rows, 'additional training on implementing an asset', 'asset-based mindset in training') || 'Would you like additional training on implementing an asset-based mindset in training?';
    const HELPFUL_COL= findCol(rows, 'most helpful', 'areas of training did you find', 'find most helpful') || 'Which areas of training did you find most helpful? (Select all that apply)';

    const total      = rows.length;
    const newHires   = rows.filter(r => { const v=(r[HIRE_COL]||'').toLowerCase(); return v.includes('new')||v.includes('first'); }).length;
    const returning  = rows.filter(r => (r[HIRE_COL]||'').toLowerCase().includes('return')).length;
    const certified  = rows.filter(r => { const s=(r[CERT_COL]||'').toLowerCase(); return s.includes('certified')&&!s.includes('not')&&!s.includes('non')&&!s.includes('in progress'); }).length;
    const wantAsset  = rows.filter(r => (r[ASSET_WANT]||'').toLowerCase().startsWith('y')).length;

    function avgF(f) { const v=rows.map(r=>parseFloat(r[f])).filter(n=>!isNaN(n)); return v.length?v.reduce((a,b)=>a+b,0)/v.length:0; }
    const avgEffect  = avgF(EFFECT_COL);
    const avgPrep    = avgF(PREP_COL);
    const avgTrainer = avgF(TRAINER_COL);
    const prepColor  = avgPrep>=4?'#059669':avgPrep>=3?'#d97706':'#b91c1c';

    const allHelpful = [];
    rows.forEach(r => parseMultiSelect(r[HELPFUL_COL]).forEach(v => allHelpful.push(v)));
    const helpFreq = countFreq(allHelpful).slice(0, 10);
    const roleFreq = countFreq(rows.map(r=>r[ROLE_COL]).filter(Boolean));
    const hireFreq = countFreq(rows.map(r=>r[HIRE_COL]).filter(Boolean));
    const certFreq = [['Certified', certified], ['Non-Certified', total-certified]];

    // Ratings sorted descending for bar chart — use resolved fields for accurate column matching
    const resolvedFields = resolveIntakeFields(rows);
    const intakeRatings = resolvedFields.map(f => ({ label: f.short, val: avgF(f.field) }))
      .sort((a,b) => b.val - a.val);

    let html = `
      <!-- KPI row: 5 cards -->
      <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:.75rem;margin-bottom:1.25rem">
        ${kpiCard(total, 'Total Intake Responses', '#0050c8')}
        ${kpiCard(newHires+' / '+pct(newHires,total)+'%', 'New Hires (58% = SY avg)', '#e76f51')}
        ${kpiCard(returning+' / '+pct(returning,total)+'%', 'Returning Staff', '#2a9d8f')}
        ${kpiCard(certified+' / '+pct(certified,total)+'%', 'Certified Staff', '#457b9d')}
        ${kpiCard(avgTrainer.toFixed(2)+'/5', 'Avg Trainer Rating (highest)', avgTrainer>=4.0?'#059669':'#d97706')}
      </div>
      <!-- Preparedness gauge + ratings bar -->
      <div style="display:grid;grid-template-columns:220px 1fr;gap:1rem;margin-bottom:1rem">
        <div class="ta-card" style="padding:1.25rem;text-align:center">
          <div class="ta-card-title" style="text-align:left">Readiness Score</div>
          <div style="font-size:3rem;font-weight:800;color:${prepColor};line-height:1;margin:.75rem 0">${avgPrep.toFixed(2)}</div>
          <div style="font-size:.75rem;color:var(--muted)">/5 · preparedness to begin with scholars</div>
          <div style="margin-top:.75rem;height:8px;background:var(--border);border-radius:4px;overflow:hidden">
            <div style="height:100%;width:${(avgPrep/5*100).toFixed(0)}%;background:${prepColor};border-radius:4px"></div>
          </div>
          <div style="display:flex;justify-content:space-between;font-size:.65rem;color:var(--muted);margin-top:.2rem"><span>1 = Very Unprepared</span><span>5 = Extremely Prepared</span></div>
        </div>
        <div class="ta-card" style="padding:1.25rem">
          <div class="ta-card-title">Ratings Comparison — All Dimensions (sorted, avg 1–5 scale)</div>
          <div style="position:relative;height:220px"><canvas id="tdIntakeRatingsChartA"></canvas></div>
        </div>
      </div>
      <!-- Role, Hire type, Cert donuts -->
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:1rem;margin-bottom:1rem">
        <div class="ta-card" style="padding:1.25rem">
          <div class="ta-card-title">Role Distribution</div>
          <div style="position:relative;height:200px"><canvas id="tdIntakeRoleChartA"></canvas></div>
        </div>
        <div class="ta-card" style="padding:1.25rem">
          <div class="ta-card-title">New vs Returning Staff</div>
          <div style="position:relative;height:200px"><canvas id="tdIntakeHireChartA"></canvas></div>
        </div>
        <div class="ta-card" style="padding:1.25rem">
          <div class="ta-card-title">Certification Mix</div>
          <div style="position:relative;height:200px"><canvas id="tdIntakeCertChartA"></canvas></div>
        </div>
      </div>
      <!-- Most helpful aspects -->
      <div class="ta-card" style="padding:1.25rem;margin-bottom:1rem">
        <div class="ta-card-title">Most Helpful Training Aspects (multi-select response count)</div>
        ${helpFreq.length
          ? `<div style="position:relative;height:${Math.max(130, helpFreq.length * 26)}px"><canvas id="tdIntakeHelpfulChartA"></canvas></div>`
          : `<div style="color:var(--muted);font-size:.85rem;padding:.75rem 0;text-align:center">No responses recorded for this question in the current dataset.</div>`
        }
      </div>
      <!-- Google Classroom panel -->
      ${buildGCPanel(rows)}
      <!-- Asset-based mindset panel -->
      <div class="ta-card" style="padding:1.25rem;margin-top:1rem">
        <div class="ta-card-title">Asset-Based Mindset Signal</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;align-items:center">
          <div>
            <div style="font-size:2rem;font-weight:800;color:${pct(wantAsset,total)>=50?'#d97706':'#059669'}">${pct(wantAsset,total)}%</div>
            <div style="font-size:.85rem;color:var(--muted);margin-top:.2rem">of respondents want more asset-based mindset training</div>
            <div style="font-size:.8rem;margin-top:.5rem">${wantAsset} of ${total} responded "Yes" — a strong demand signal</div>
          </div>
          <div style="background:#FFFBEB;border:1px solid #C9A84C;border-radius:8px;padding:1rem;font-size:.85rem;color:#92400e">
            <strong>Action Signal:</strong> 57%+ demand warrants a dedicated asset-based mindset PD session or extended module for SY 25–26 second semester.
          </div>
        </div>
      </div>`;

    container.innerHTML = html;

    setTimeout(() => {
      // Ratings bar (sorted)
      makeChart('tdIntakeRatingsChartA', {
        type: 'bar',
        data: {
          labels: intakeRatings.map(d => d.label),
          datasets: [{ data: intakeRatings.map(d => d.val), backgroundColor: intakeRatings.map(d => d.val>=4?'#10b981':d.val>=3?'#f59e0b':'#ef4444'), borderRadius:4 }]
        },
        options: { responsive:true, maintainAspectRatio:false, indexAxis:'y',
          plugins: { legend:{display:false}, datalabels:{ anchor:'end', align:'right', font:{size:10}, formatter:v=>v.toFixed(2) } },
          scales: { x: { min:2.5, max:5.5, ticks:{ stepSize:.5 } } }
        }
      });
      makeChart('tdIntakeRoleChartA', {
        type: 'doughnut',
        data: { labels: roleFreq.map(([l])=>l), datasets:[{ data: roleFreq.map(([,n])=>n), backgroundColor:['#e76f51','#457b9d','#2a9d8f','#e9c46a','#264653'] }] },
        options: { responsive:true, maintainAspectRatio:false, cutout:'55%', plugins:{ legend:{ position:'right', labels:{ font:{size:10}, boxWidth:12 } } } }
      });
      makeChart('tdIntakeHireChartA', {
        type: 'doughnut',
        data: { labels: hireFreq.map(([l])=>l), datasets:[{ data: hireFreq.map(([,n])=>n), backgroundColor:['#10b981','#3b82f6','#f59e0b'] }] },
        options: { responsive:true, maintainAspectRatio:false, cutout:'55%', plugins:{ legend:{ position:'right', labels:{ font:{size:10}, boxWidth:12 } } } }
      });
      makeChart('tdIntakeCertChartA', {
        type: 'doughnut',
        data: { labels: certFreq.map(([l])=>l), datasets:[{ data: certFreq.map(([,n])=>n), backgroundColor:['#2a9d8f','#e9c46a'] }] },
        options: { responsive:true, maintainAspectRatio:false, cutout:'55%', plugins:{ legend:{ position:'right', labels:{ font:{size:10}, boxWidth:12 } } } }
      });
      if (helpFreq.length) {
        makeChart('tdIntakeHelpfulChartA', {
          type: 'bar',
          data: { labels: helpFreq.map(([l]) => l.length>40?l.slice(0,38)+'…':l), datasets:[{ data: helpFreq.map(([,n])=>n), backgroundColor:'#2a9d8f', borderRadius:4 }] },
          options: { responsive:true, maintainAspectRatio:false, indexAxis:'y',
            plugins:{ legend:{display:false}, tooltip:{callbacks:{label: ctx => `${ctx.parsed.x} respondents`}} },
            scales:{ x:{ beginAtZero:true, ticks:{precision:0} } }
          }
        });
      }
    }, 50);
  }

  // ── INTAKE SUB-TAB 2: DISTRICT VIEW ────────────────────────────
  function renderIntakeDistrictView(container, rows) {
    rows = filterBySeason(rows, 'Timestamp');
    const DIST_COL = 'What District are you assigned to?';
    const ROLE_COL = 'What is your role within NJTC? (Select one)';
    const HIRE_COL = 'Are you a new or returning hire? (Select one)';
    const PREP_COL = 'After completing training, how prepared do you feel to begin working with scholars? (1 = Very unprepared, 5 = Extremely prepared)';
    const EFFECT_COL = 'Overall, how would you rate the effectiveness of the training? (1 = Did not meet expectations, 5 = Exceeded expectations)';
    const WHAT_NEW_COL = 'What new topics or areas would you like to see added to future training?';

    const allDistricts = [...new Set(rows.map(r => r[DIST_COL]).filter(Boolean))].sort();
    const networkAvgPrep   = avg(rows.map(r=>parseFloat(r[PREP_COL])).filter(n=>!isNaN(n)));
    const networkAvgEffect = avg(rows.map(r=>parseFloat(r[EFFECT_COL])).filter(n=>!isNaN(n)));

    let selectedDist = allDistricts[0] || '';

    function renderDistrictPanel(dist) {
      const dRows = rows.filter(r => r[DIST_COL] === dist);
      if (!dRows.length) return `<div class="td-error">No responses from ${dist}</div>`;
      const dPrep   = avg(dRows.map(r=>parseFloat(r[PREP_COL])).filter(n=>!isNaN(n)));
      const dEffect = avg(dRows.map(r=>parseFloat(r[EFFECT_COL])).filter(n=>!isNaN(n)));
      const prepDelta = dPrep - networkAvgPrep;
      const effectDelta = dEffect - networkAvgEffect;
      const dNewHires = dRows.filter(r=>(r[HIRE_COL]||'').toLowerCase().includes('new')).length;
      const roleFreq = countFreq(dRows.map(r=>r[ROLE_COL]).filter(Boolean));
      const newTopics = dRows.map(r=>r[WHAT_NEW_COL]).filter(t=>t&&t.trim());

      function delta(d) {
        return d > 0.05 ? `<span style="color:#059669;font-weight:700">↑${d.toFixed(2)}</span>` :
               d < -0.05 ? `<span style="color:#b91c1c;font-weight:700">↓${Math.abs(d).toFixed(2)}</span>` :
               `<span style="color:var(--muted)">≈ avg</span>`;
      }

      return `<div>
        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:.75rem;margin-bottom:1rem">
          ${kpiCard(dRows.length, dist+' Responses', '#1B2A4A')}
          ${kpiCard(dEffect.toFixed(2)+'/5', 'Effectiveness vs Network '+delta(effectDelta), dEffect>=4?'#059669':'#d97706')}
          ${kpiCard(dPrep.toFixed(2)+'/5', 'Preparedness vs Network '+delta(prepDelta), dPrep>=4?'#059669':'#d97706')}
          ${kpiCard(dNewHires+' / '+pct(dNewHires,dRows.length)+'%', 'New Hires', '#e76f51')}
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;margin-bottom:1rem">
          <div class="ta-card" style="padding:1rem">
            <div class="ta-card-title">Role Breakdown — ${dist}</div>
            ${roleFreq.map(([role,n])=>`<div style="display:flex;justify-content:space-between;padding:.3rem 0;border-bottom:1px solid var(--border-2);font-size:.83rem"><span>${role}</span><strong>${n}</strong></div>`).join('')}
          </div>
          <div class="ta-card" style="padding:1rem">
            <div class="ta-card-title">All Districts — Responses at a Glance</div>
            <div style="overflow-x:auto;max-height:160px;overflow-y:auto">${buildIntakeDistrictTable(rows)}</div>
          </div>
        </div>
        ${newTopics.length ? `<div class="ta-card" style="padding:1rem">
          <div class="ta-card-title">New Topics Requested — ${dist} (${newTopics.length} responses)</div>
          <div style="max-height:180px;overflow-y:auto">
            ${newTopics.map(t=>`<div class="quote-card">${t.length>200?t.slice(0,198)+'…':t}</div>`).join('')}
          </div>
        </div>` : ''}
      </div>`;
    }

    container.innerHTML = `
      <div style="margin-bottom:1rem">
        <div style="font-size:.75rem;font-weight:700;color:var(--muted);text-transform:uppercase;margin-bottom:.5rem">Select District</div>
        <div style="display:flex;flex-wrap:wrap;gap:.375rem" id="intDistrictPills">
          ${allDistricts.map(d => `<button class="td-subtab${d===selectedDist?' active':''}" style="font-size:.72rem;padding:.25rem .65rem" onclick="window.intSelectDistrict('${d.replace(/'/g,"\\'")}',this)">${d}</button>`).join('')}
        </div>
      </div>
      <div id="intDistrictPanel">${renderDistrictPanel(selectedDist)}</div>`;

    window.intSelectDistrict = function(dist, btn) {
      document.querySelectorAll('#intDistrictPills .td-subtab').forEach(b => b.classList.remove('active'));
      if (btn) btn.classList.add('active');
      const panel = document.getElementById('intDistrictPanel');
      if (panel) panel.innerHTML = renderDistrictPanel(dist);
    };
  }

  // ── INTAKE SUB-TAB 3: T&D INTAKE SUMMARY ───────────────────────
  function renderIntakeSummary(container, rows) {
    rows = filterBySeason(rows, 'Timestamp');
    const dept = getDept();
    function avgF(f) { const v=rows.map(r=>parseFloat(r[f])).filter(n=>!isNaN(n)); return v.length?v.reduce((a,b)=>a+b,0)/v.length:0; }

    const total       = rows.length;
    const newHires    = rows.filter(r=>{ const v=(r['Are you a new or returning hire? (Select one)']||'').toLowerCase(); return v.includes('new')||v.includes('first'); }).length;
    const returning   = rows.filter(r=>(r['Are you a new or returning hire? (Select one)']||'').toLowerCase().includes('return')).length;
    const certified   = rows.filter(r=>{const s=(r['What is your current certification status? (Select one)']||'').toLowerCase();return s.includes('certified')&&!s.includes('not')&&!s.includes('non')&&!s.includes('in progress');}).length;
    const wantAsset   = rows.filter(r=>(r['Would you like additional training on implementing an asset-based mindset in training?']||'').toLowerCase().startsWith('y')).length;
    const avgTrainer  = avgF('The trainers were knowledgeable and responsive to questions. (1 = Strongly disagree, 5 = Strongly agree)');
    const avgEffect   = avgF('Overall, how would you rate the effectiveness of the training? (1 = Did not meet expectations, 5 = Exceeded expectations)');
    const avgPrep     = avgF('After completing training, how prepared do you feel to begin working with scholars? (1 = Very unprepared, 5 = Extremely prepared)');
    const avgMaterials= avgF('The training materials (slides and videos) were useful in preparing me for my role. (1 = Strongly disagree, 5 = Strongly agree)');
    const avgStructure= avgF('The training itinerary/setup was clear and well-structured. (1 = Strongly disagree, 5 = Strongly agree)');
    const districts   = [...new Set(rows.map(r=>r['What District are you assigned to?']).filter(Boolean))];
    const now = new Date().toLocaleDateString('en-US', { month:'long', day:'numeric', year:'numeric' });

    container.innerHTML = `<div id="td-summary-print">
      ${dept === 'data' ? `<div class="no-print" style="display:flex;justify-content:flex-end;gap:.5rem;margin-bottom:1rem">
        <button class="btn btn-primary btn-sm" onclick="window.tdIntakeExportPDF()">📄 Export as PDF</button>
      </div>` : ''}

      <div class="td-print-section" style="background:#1B2A4A;color:#fff;border-radius:10px;padding:1.5rem;margin-bottom:1rem">
        <div style="font-size:.7rem;letter-spacing:.1em;text-transform:uppercase;color:#C9A84C;font-weight:700">NJTC Training &amp; Development</div>
        <div style="font-size:1.2rem;font-weight:800;margin:.25rem 0">SY 2025–2026 | Training Intake Report</div>
        <div style="font-size:.8rem;color:#a8b8d8">Generated: ${now}</div>
      </div>

      <div class="ta-card td-print-section" style="padding:1.25rem;margin-bottom:1rem">
        <div class="ta-card-title">👥 Cohort Profile</div>
        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:.75rem">
          ${kpiCard(total, 'Staff Trained', '#1B2A4A')}
          ${kpiCard(newHires+' ('+pct(newHires,total)+'%)', 'New Hires', '#e76f51')}
          ${kpiCard(certified+' ('+pct(certified,total)+'%)', 'Certified', '#2a9d8f')}
          ${kpiCard(districts.length, 'Districts Represented', '#457b9d')}
        </div>
      </div>

      <div class="ta-card td-print-section" style="padding:1.25rem;margin-bottom:1rem">
        <div class="ta-card-title">✨ Glows — What's Working</div>
        <div class="card-glow">Trainer knowledge rated highest at <strong>${avgTrainer.toFixed(2)}/5</strong> — staff feel well-supported by the humans delivering training; invest in this strength.</div>
        <div class="card-glow">Training materials (<strong>${avgMaterials.toFixed(2)}</strong>) and structure (<strong>${avgStructure.toFixed(2)}</strong>) both meet expectations; returning staff specifically praised improved content over last year.</div>
        <div class="card-glow">Google Classroom demonstrated strong accessibility — majority of staff report no technical issues and multi-device access.</div>
        <div class="card-glow">Async/self-paced format praised for flexibility and individual pacing.</div>
        <div class="card-glow">Strong geographic spread: <strong>${districts.length} districts</strong> represented, demonstrating program-wide training reach.</div>
        <div class="card-glow">Asset-based mindset content registering — majority of respondents scored 4–5 on feeling the training helped them apply this lens.</div>
      </div>

      <div class="ta-card td-print-section" style="padding:1.25rem;margin-bottom:1rem">
        <div class="ta-card-title">📈 Grows — Areas of Opportunity</div>
        <div class="card-grow">Overall effectiveness (<strong>${avgEffect.toFixed(2)}/5</strong>) sits below the 4.0 mark — the one dimension that does not meet the threshold; warrants targeted improvement in content design.</div>
        <div class="card-grow"><strong>${newHires} new hires (${pct(newHires,total)}% of cohort)</strong> need stronger onboarding scaffolding — new staff rate preparedness differently and need earlier, more concrete role modeling.</div>
        <div class="card-grow">iReady platform training is a clear gap — new hires specifically request dedicated iReady instruction.</div>
        <div class="card-grow">Lesson planning timing: training should precede field placement, not follow it.</div>
        <div class="card-grow">Dual-role staff (SC/IC) underrepresented in survey design — no role option captured them, skewing data.</div>
        <div class="card-grow"><strong>${pct(wantAsset,total)}%</strong> of respondents want more asset-based mindset training — this is not a "nice to have," it's a demand signal from ${wantAsset} of ${total} staff.</div>
        <div class="card-grow">Google Classroom organization and navigation still a learning curve for some staff — "a printed guide" was specifically requested.</div>
      </div>

      <div class="ta-card td-print-section" style="padding:1.25rem;margin-bottom:1rem">
        <div class="ta-card-title">🎯 Next Steps &amp; Recommendations</div>
        <div class="card-action"><strong>1. Redesign training sequence</strong> — Move iReady platform training and lesson planning modules to pre-service Week 0; content must precede scholar contact.</div>
        <div class="card-action"><strong>2. Develop iReady onboarding module</strong> — Standalone training covering platform navigation, data interpretation, and application to tutoring sessions; prioritize for new hires.</div>
        <div class="card-action"><strong>3. Create dual-role training track</strong> — SC/IC Dual Role staff (n≈10, ~14%) need differentiated content; update survey to capture this role.</div>
        <div class="card-action"><strong>4. Asset-based mindset deep dive</strong> — ${pct(wantAsset,total)}% demand signal warrants a dedicated PD session or extended module for SY 25–26 second semester.</div>
        <div class="card-action"><strong>5. Google Classroom navigation guide</strong> — Produce a 1-page printed and PDF quick-reference for GC task navigation; distribute at in-person orientation.</div>
        <div class="card-action"><strong>6. Strengthen overall effectiveness score</strong> — Target 4.25+ for SY 26–27 through better pacing, more worked examples, real-scenario demonstrations, and earlier deployment of lesson plan modeling.</div>
        <div class="card-action"><strong>7. Returning staff differentiation</strong> — ${returning} returning staff (${pct(returning,total)}%); create an advanced/returning track that builds on prior knowledge.</div>
      </div>

      <div class="ta-card td-print-section" style="padding:1.25rem">
        <div class="ta-card-title">📊 Data at a Glance</div>
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:.5rem">
          ${resolveIntakeFields(rows).slice(0,6).map(f => {
            const a = avgF(f.field);
            return `<div style="text-align:center;background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:.75rem .5rem">
              <div style="font-size:1.1rem;font-weight:800;color:${a>=4.5?'#2A7D4F':a>=4?'#059669':'#d97706'}">${a.toFixed(2)}</div>
              <div style="font-size:.65rem;color:var(--muted);line-height:1.3">${f.short}</div>
            </div>`;
          }).join('')}
        </div>
      </div>
    </div>`;
  }

  window.tdIntakeExportPDF = function() { window.print(); };

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
    // Use fuzzy matching so minor column wording changes don't produce 0.0 values
    const gcFields = [
      { field: findCol(rows, 'access and navigate google classroom', 'navigate google classroom') || 'How easy was it to access and navigate Google Classroom?', short: 'Navigation Ease' },
      { field: findCol(rows, 'well-organized were the training modules', 'organized were the training') || 'How well-organized were the training modules, assessments, and resources in Google Classroom?', short: 'Organization' },
      { field: findCol(rows, 'layout support your understanding', 'classroom layout support') || 'To what extent did the Google Classroom layout support your understanding of the training material?', short: 'Layout Support' },
      { field: findCol(rows, 'timely updates, announcements', 'updates, announcements, or reminders') || 'How effective was Google Classroom in providing timely updates, announcements, or reminders regarding course work?', short: 'Updates/Reminders' },
    ];
    const techCol = findCol(rows, 'technical issues you experienced', 'technical issues') || 'Were there any technical issues you experienced while using Google Classroom?';
    const gcUnderstandCol = findCol(rows, 'clearly understand how to use google classroom', 'understand how to use google') || 'Did you clearly understand how to use Google Classroom for all required tasks (e.g., submitting assignments, watching videos, completing assessments)?';
    const hasTechIssues = rows.filter(r => {
      const v = (r[techCol] || '').toLowerCase();
      return v !== '' && v !== 'no' && v !== 'none' && v !== 'n/a';
    }).length;
    const understoodGC = rows.filter(r => {
      const v = (r[gcUnderstandCol] || '').toLowerCase();
      return v.startsWith('y');
    }).length;

    let html = `<div class="ta-card" style="margin-bottom:1.25rem">
      <div class="ta-card-title">Google Classroom Experience</div>
      <div class="ta-grid ta-grid-4" style="margin-bottom:1rem">`;

    gcFields.forEach(f => {
      const vals = rows.map(r => parseFloat(r[f.field])).filter(n => !isNaN(n));
      const a = vals.length ? vals.reduce((s, n) => s + n, 0) / vals.length : null;
      const display = a !== null ? a.toFixed(1) : 'N/A';
      const color = a === null ? 'var(--muted)' : a >= 4 ? '#059669' : '#d97706';
      html += `<div class="ta-card" style="padding:.75rem">
        <div style="font-size:1.4rem;font-weight:800;color:${color}">${display}</div>
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
    // Ratings bar chart — use resolved fields to skip columns with no data
    const resolvedFields = resolveIntakeFields(rows);
    const avgRatings = resolvedFields.map(f => {
      const vals = rows.map(r => parseFloat(r[f.field])).filter(n => !isNaN(n));
      return vals.length ? parseFloat((vals.reduce((s, n) => s + n, 0) / vals.length).toFixed(2)) : 0;
    });
    const barColors = avgRatings.map(v => v >= 4 ? '#10b981' : v >= 3 ? '#f59e0b' : '#ef4444');

    makeChart('tdIntakeRatingsChart', {
      type: 'bar',
      data: {
        labels: resolvedFields.map(f => getDisplayLabel(f.field) || f.short),
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

  // Legacy compat stubs — district view uses its own pill-based filter
  window.applyIntakeFilter = function() {};
  window.filterIntakeTable = function() {};





  // ══════════════════════════════════════════════════════════════════
  //  TAB 3 (new): OTJ OVERVIEW
  // ══════════════════════════════════════════════════════════════════

  // ── SY 25-26 Static Cohort Data ────────────────────────────────────────────
  // Embedded directly from the GAINS REPORTING xlsx snapshot.
  // The source Google Sheet (1wg0J1r0...) uses IMPORTRANGE and is not publicly
  // shared, so a live CSV fetch is not possible. This data is authoritative as
  // of the end-of-year snapshot and does not require a network call.
  const SY2526_OJT_TARGET = 4000;
  const SY2526_RTI_TARGET = 288;
  const SY2526_OJT_MONTHS = ['Mar-24','Apr-24','May-24','Jun-24','Jul-24','Aug-24','Sep-24','Oct-24','Nov-24','Dec-24','Jan-25','Feb-25','Mar-25','Apr-25'];
  const SY2526_RTI_MONTHS = ['Mar-24','Apr-24','May-24','Jun-24','Jul-24','Aug-24','Sep-24','Oct-24','Nov-24','Dec-24','Jan-25','Feb-25','Mar-25','Apr-25','May-25','Jun-25'];

  const SY2526_DATA = [{"name":"Alexandra Cristescu","status":"active","placement":"Penns Grove","usdolId":"NJ2026000468","pctOjt":0.9,"ojtReported":3655,"ojtTotalCalc":70,"ojtAprHrs":87,"ojtMayHrs":55,"ojtJunHrs":0,"ojtMonthlyHrs":[0,0,0,0,0,0,0,0,0,0,6,20,15,6],"wage":32.99,"completedProg":"n","notes":"no longer working","rtiHours":81,"rtiSessions":3,"rtiMonthly":[false,false,false,false,false,false,false,false,false,false,true,false,false,true,false,false],"coaching":"N","praxis":""},{"name":"Allison Dombrowski","status":"cancelled","placement":"","usdolId":"NJ2025002297","pctOjt":0,"ojtReported":0,"ojtTotalCalc":0,"ojtAprHrs":0,"ojtMayHrs":0,"ojtJunHrs":0,"ojtMonthlyHrs":[0,0,0,0,0,0,0,0,0,0,0,0,0,0],"wage":0,"completedProg":"","notes":"","rtiHours":0,"rtiSessions":0,"rtiMonthly":[false,false,false,true,false,false,false,false,false,false,false,false,false,false,false,false],"coaching":"","praxis":""},{"name":"Apollo Monroy-Polanco","status":"cancelled","placement":"Middlesex STEM","usdolId":"NJ2025004827","pctOjt":0,"ojtReported":0,"ojtTotalCalc":0,"ojtAprHrs":38,"ojtMayHrs":0,"ojtJunHrs":0,"ojtMonthlyHrs":[0,0,0,0,0,0,0,0,0,0,0,0,18,0],"wage":0,"completedProg":"","notes":"","rtiHours":54,"rtiSessions":2,"rtiMonthly":[false,false,false,false,false,false,false,false,false,false,false,false,false,false,false,false],"coaching":"N","praxis":"Y"},{"name":"Carla Borbon","status":"active","placement":"Middlesex STEM","usdolId":"NJ2026000857","pctOjt":1.0,"ojtReported":4066,"ojtTotalCalc":39,"ojtAprHrs":40,"ojtMayHrs":66,"ojtJunHrs":8,"ojtMonthlyHrs":[0,0,0,0,0,0,0,0,0,0,0,0,16,15],"wage":35.0,"completedProg":"n- rti","notes":"needs follow up to complete - check on site database","rtiHours":108,"rtiSessions":4,"rtiMonthly":[false,false,false,false,false,false,false,false,false,false,false,false,true,true,true,false],"coaching":"N","praxis":""},{"name":"Chelsea Jordan","status":"cancelled","placement":"","usdolId":"NJ2025001925","pctOjt":0,"ojtReported":0,"ojtTotalCalc":0,"ojtAprHrs":0,"ojtMayHrs":0,"ojtJunHrs":0,"ojtMonthlyHrs":[0,0,0,0,0,0,0,0,0,0,0,0,0,0],"wage":0,"completedProg":"","notes":"","rtiHours":60,"rtiSessions":3,"rtiMonthly":[false,false,true,false,false,true,true,false,false,false,false,false,false,false,false,false],"coaching":"","praxis":""},{"name":"Claudia Tumelus","status":"cancelled","placement":"iLearn Clifton HS","usdolId":"NJ2025004254","pctOjt":0,"ojtReported":0,"ojtTotalCalc":0,"ojtAprHrs":0,"ojtMayHrs":0,"ojtJunHrs":0,"ojtMonthlyHrs":[0,0,0,0,0,0,0,0,0,0,0,0,0,0],"wage":0,"completedProg":"","notes":"","rtiHours":60,"rtiSessions":3,"rtiMonthly":[false,false,false,false,false,false,true,true,true,false,false,false,false,false,false,false],"coaching":"","praxis":""},{"name":"Daniel DiQuinzio","status":"cancelled","placement":"","usdolId":"NJ2025001713","pctOjt":0,"ojtReported":0,"ojtTotalCalc":0,"ojtAprHrs":0,"ojtMayHrs":0,"ojtJunHrs":0,"ojtMonthlyHrs":[0,0,0,0,0,0,0,11,7,0,0,0,0,0],"wage":0,"completedProg":"","notes":"","rtiHours":80,"rtiSessions":4,"rtiMonthly":[false,false,true,false,false,true,true,true,false,false,false,false,false,false,false,false],"coaching":"","praxis":""},{"name":"Renee Davis","status":"active","placement":"iLearn Clifton MS","usdolId":"NJ2025004829","pctOjt":0.96,"ojtReported":3840,"ojtTotalCalc":71,"ojtAprHrs":0,"ojtMayHrs":0,"ojtJunHrs":0,"ojtMonthlyHrs":[0,0,0,0,0,0,0,0,25,22,5,4,7,2],"wage":33.99,"completedProg":"n- rti","notes":"needs follow up to complete","rtiHours":189,"rtiSessions":7,"rtiMonthly":[false,false,false,false,false,false,false,false,false,true,true,true,true,true,false,false],"coaching":"Y","praxis":"Y"},{"name":"Elijah Brown","status":"cancelled","placement":"","usdolId":"NJ2025002412","pctOjt":0,"ojtReported":0,"ojtTotalCalc":0,"ojtAprHrs":0,"ojtMayHrs":0,"ojtJunHrs":0,"ojtMonthlyHrs":[0,0,0,0,0,0,0,0,0,0,0,0,0,0],"wage":0,"completedProg":"","notes":"","rtiHours":0,"rtiSessions":0,"rtiMonthly":[false,false,false,true,false,false,false,false,false,false,false,false,false,false,false,false],"coaching":"","praxis":""},{"name":"Genesis Rosich","status":"cancelled","placement":"","usdolId":"NJ2025004826","pctOjt":0,"ojtReported":0,"ojtTotalCalc":0,"ojtAprHrs":0,"ojtMayHrs":0,"ojtJunHrs":0,"ojtMonthlyHrs":[0,0,0,0,0,0,0,0,0,0,0,0,0,0],"wage":0,"completedProg":"","notes":"","rtiHours":0,"rtiSessions":0,"rtiMonthly":[false,false,false,false,false,false,false,false,false,false,false,false,false,false,false,false],"coaching":"","praxis":""},{"name":"Heba Samhouri","status":"cancelled","placement":"","usdolId":"NJ2025002413","pctOjt":0,"ojtReported":0,"ojtTotalCalc":0,"ojtAprHrs":0,"ojtMayHrs":0,"ojtJunHrs":0,"ojtMonthlyHrs":[0,0,0,0,0,0,0,0,0,0,0,0,0,0],"wage":0,"completedProg":"","notes":"","rtiHours":0,"rtiSessions":0,"rtiMonthly":[false,false,false,true,false,false,false,false,false,false,false,false,false,false,false,false],"coaching":"","praxis":""},{"name":"Jacob Leebron","status":"cancelled","placement":"Haddon Township","usdolId":"NJ2025001825","pctOjt":0.94,"ojtReported":3760,"ojtTotalCalc":0,"ojtAprHrs":0,"ojtMayHrs":0,"ojtJunHrs":0,"ojtMonthlyHrs":[0,0,0,0,17,6,0,7,26,5,1,0,3,0],"wage":35.0,"completedProg":"n","notes":"quit","rtiHours":80,"rtiSessions":4,"rtiMonthly":[false,false,true,false,false,false,true,true,false,true,false,false,false,false,false,false],"coaching":"","praxis":""},{"name":"Janelle lee","status":"cancelled","placement":"","usdolId":"NJ2025003240","pctOjt":0,"ojtReported":0,"ojtTotalCalc":0,"ojtAprHrs":0,"ojtMayHrs":0,"ojtJunHrs":0,"ojtMonthlyHrs":[0,0,0,0,0,57,0,0,0,0,0,0,0,0],"wage":0,"completedProg":"","notes":"","rtiHours":0,"rtiSessions":0,"rtiMonthly":[false,false,false,false,false,false,false,false,false,false,false,false,false,false,false,false],"coaching":"","praxis":""},{"name":"Jazmin Daliza Garcia","status":"active","placement":"iLearn Bergen MS","usdolId":"NJ2026001279","pctOjt":0.95,"ojtReported":3894,"ojtTotalCalc":22,"ojtAprHrs":90,"ojtMayHrs":94,"ojtJunHrs":0,"ojtMonthlyHrs":[0,0,0,0,0,0,0,0,0,0,0,0,15,3],"wage":35.0,"completedProg":"n- rti","notes":"quit","rtiHours":27,"rtiSessions":1,"rtiMonthly":[false,false,false,false,false,false,false,false,false,false,false,false,false,true,false,false],"coaching":"","praxis":""},{"name":"Jessica Flores","status":"active","placement":"iLearn Passaic MS","usdolId":"NJ2025001718","pctOjt":1.0,"ojtReported":4000,"ojtTotalCalc":72,"ojtAprHrs":0,"ojtMayHrs":0,"ojtJunHrs":0,"ojtMonthlyHrs":[0,0,0,0,0,0,0,5,22,25,7,12,0,0],"wage":32.99,"completedProg":"n- rti","notes":"quit","rtiHours":108,"rtiSessions":4,"rtiMonthly":[false,false,true,false,false,false,true,false,false,false,true,false,false,false,false,false],"coaching":"N","praxis":""},{"name":"Katie Rose Davis","status":"active","placement":"Hamilton Township","usdolId":"NJ2025005330","pctOjt":1.0,"ojtReported":4000,"ojtTotalCalc":72,"ojtAprHrs":11,"ojtMayHrs":0,"ojtJunHrs":8,"ojtMonthlyHrs":[0,0,0,0,0,0,0,0,0,29,24,2,8,1],"wage":40.0,"completedProg":"n- rti","notes":"June participation should count for RTI- July completer","rtiHours":189,"rtiSessions":7,"rtiMonthly":[false,false,false,false,false,false,false,false,false,true,true,true,true,true,true,false],"coaching":"Y","praxis":""},{"name":"Katrina Valentin","status":"active","placement":"Gloucester","usdolId":"NJ2025001719","pctOjt":0.87,"ojtReported":3480,"ojtTotalCalc":50,"ojtAprHrs":48,"ojtMayHrs":0,"ojtJunHrs":0,"ojtMonthlyHrs":[0,0,0,0,0,0,0,0,0,0,23,4,23,0],"wage":0,"completedProg":"","notes":"","rtiHours":81,"rtiSessions":3,"rtiMonthly":[false,false,true,false,false,false,true,false,false,false,false,false,false,false,false,false],"coaching":"N","praxis":""},{"name":"Keisha Lopez","status":"active","placement":"ilearn Clifton","usdolId":"NJ2026000470","pctOjt":1.0,"ojtReported":4094,"ojtTotalCalc":76,"ojtAprHrs":107,"ojtMayHrs":94,"ojtJunHrs":0,"ojtMonthlyHrs":[0,0,0,0,0,0,0,0,0,0,0,15,8,53],"wage":33.99,"completedProg":"n- rti","notes":"needs follow up to complete","rtiHours":135,"rtiSessions":5,"rtiMonthly":[false,false,false,false,false,false,false,false,false,false,true,true,true,true,false,false],"coaching":"Y","praxis":""},{"name":"Lilia Quintero","status":"active","placement":"Hamilton-Kuser","usdolId":"NJ2026000471","pctOjt":0.99,"ojtReported":4011,"ojtTotalCalc":57,"ojtAprHrs":81,"ojtMayHrs":53,"ojtJunHrs":0,"ojtMonthlyHrs":[0,0,0,0,0,0,0,0,0,0,22,25,9,0],"wage":35.0,"completedProg":"n- both","notes":"working this summer","rtiHours":27,"rtiSessions":1,"rtiMonthly":[false,false,false,false,false,false,false,false,false,false,false,false,false,true,false,false],"coaching":"","praxis":""},{"name":"linda Fenty","status":"cancelled","placement":"iLearn Paterson MS","usdolId":"NJ2026000858","pctOjt":0,"ojtReported":0,"ojtTotalCalc":0,"ojtAprHrs":64,"ojtMayHrs":0,"ojtJunHrs":0,"ojtMonthlyHrs":[0,0,0,0,0,0,0,0,0,0,0,12,3,2],"wage":0,"completedProg":"","notes":"","rtiHours":27,"rtiSessions":1,"rtiMonthly":[false,false,false,false,false,false,false,false,false,false,false,false,false,false,false,false],"coaching":"N","praxis":""},{"name":"maria del carmen gutierrez colin","status":"active","placement":"iLearn Passaic ES","usdolId":"NJ2025005329","pctOjt":1.0,"ojtReported":4000,"ojtTotalCalc":75,"ojtAprHrs":38,"ojtMayHrs":0,"ojtJunHrs":0,"ojtMonthlyHrs":[0,0,0,0,0,0,0,0,0,0,25,30,8,8],"wage":35.0,"completedProg":"n- rti","notes":"needs follow up to complete","rtiHours":162,"rtiSessions":6,"rtiMonthly":[false,false,false,false,false,false,false,false,false,true,true,true,true,false,true,false],"coaching":"Y","praxis":""},{"name":"Marina Farag","status":"cancelled","placement":"","usdolId":"NJ2025002296","pctOjt":0,"ojtReported":0,"ojtTotalCalc":0,"ojtAprHrs":0,"ojtMayHrs":0,"ojtJunHrs":0,"ojtMonthlyHrs":[0,0,0,0,0,0,0,0,0,0,0,0,0,0],"wage":0,"completedProg":"","notes":"","rtiHours":60,"rtiSessions":3,"rtiMonthly":[false,false,false,true,false,true,true,false,false,false,false,false,false,false,false,false],"coaching":"","praxis":""},{"name":"Melissa Mazza","status":"active","placement":"iLearn Bergen MS","usdolId":"NJ2026001277","pctOjt":1.0,"ojtReported":4114,"ojtTotalCalc":85,"ojtAprHrs":108,"ojtMayHrs":88,"ojtJunHrs":8,"ojtMonthlyHrs":[0,0,0,0,0,0,0,0,0,0,0,65,5,7],"wage":35.0,"completedProg":"n- rti","notes":"needs follow up to complete","rtiHours":162,"rtiSessions":6,"rtiMonthly":[false,false,false,false,false,false,false,false,false,false,false,true,true,true,true,true],"coaching":"Y","praxis":""},{"name":"Micaela Wilkerson","status":"active","placement":"Haddon Township","usdolId":"NJ2025004825","pctOjt":0.91,"ojtReported":3640,"ojtTotalCalc":70,"ojtAprHrs":0,"ojtMayHrs":0,"ojtJunHrs":0,"ojtMonthlyHrs":[0,0,0,0,0,0,1,21,8,22,3,2,6,4],"wage":35.0,"completedProg":"n- both","notes":"","rtiHours":54,"rtiSessions":2,"rtiMonthly":[false,false,false,false,false,false,false,false,false,false,false,false,false,true,true,false],"coaching":"","praxis":""},{"name":"Michelle Kim","status":"cancelled","placement":"","usdolId":"NJ2025004252","pctOjt":0,"ojtReported":0,"ojtTotalCalc":0,"ojtAprHrs":0,"ojtMayHrs":0,"ojtJunHrs":0,"ojtMonthlyHrs":[0,0,0,0,0,0,0,13,0,0,0,0,0,0],"wage":0,"completedProg":"","notes":"","rtiHours":20,"rtiSessions":1,"rtiMonthly":[false,false,false,false,false,false,false,true,false,false,false,false,false,false,false,false],"coaching":"","praxis":""},{"name":"Monica Brown","status":"cancelled","placement":"iLEarn Clifton ES","usdolId":"NJ2025005327","pctOjt":0,"ojtReported":0,"ojtTotalCalc":0,"ojtAprHrs":0,"ojtMayHrs":0,"ojtJunHrs":0,"ojtMonthlyHrs":[0,0,0,0,0,0,0,0,5,6,14,2,0,0],"wage":0,"completedProg":"","notes":"","rtiHours":0,"rtiSessions":0,"rtiMonthly":[false,false,false,false,false,false,false,false,false,false,false,false,false,false,false,false],"coaching":"","praxis":""},{"name":"Mushana Dunham","status":"active","placement":"iLearn Clifton MS","usdolId":"NJ2025005331","pctOjt":0.9359,"ojtReported":3846,"ojtTotalCalc":48,"ojtAprHrs":98,"ojtMayHrs":102,"ojtJunHrs":8,"ojtMonthlyHrs":[0,0,0,0,0,0,0,0,0,0,3,15,8,3],"wage":35.0,"completedProg":"n- both","notes":"June participation should count for RTI- July completer","rtiHours":243,"rtiSessions":9,"rtiMonthly":[false,false,false,false,false,false,false,false,false,true,true,true,true,true,true,true],"coaching":"Y","praxis":"Y"},{"name":"Nicole Cill","status":"cancelled","placement":"","usdolId":"NJ2025004251","pctOjt":0,"ojtReported":0,"ojtTotalCalc":0,"ojtAprHrs":0,"ojtMayHrs":0,"ojtJunHrs":0,"ojtMonthlyHrs":[0,0,0,0,0,0,0,13,0,0,0,0,0,0],"wage":0,"completedProg":"","notes":"","rtiHours":60,"rtiSessions":3,"rtiMonthly":[false,false,false,false,false,false,true,true,true,false,false,false,false,false,false,false],"coaching":"","praxis":""},{"name":"Norelis Ramirez","status":"active","placement":"iLearn Paterson -ES","usdolId":"NJ2026000265","pctOjt":0.9103,"ojtReported":3723,"ojtTotalCalc":70,"ojtAprHrs":0,"ojtMayHrs":82,"ojtJunHrs":8,"ojtMonthlyHrs":[0,0,0,0,0,0,0,0,0,0,41,5,7,2],"wage":35.0,"completedProg":"n- both","notes":"needs follow up to complete","rtiHours":108,"rtiSessions":4,"rtiMonthly":[false,false,false,false,false,false,false,false,false,false,true,true,false,true,false,false],"coaching":"N","praxis":""},{"name":"Pankajbharathi Sowmianarayanan","status":"cancelled","placement":"","usdolId":"NJ2025004823","pctOjt":0,"ojtReported":0,"ojtTotalCalc":0,"ojtAprHrs":0,"ojtMayHrs":0,"ojtJunHrs":0,"ojtMonthlyHrs":[0,0,0,0,0,0,0,0,0,0,0,0,0,0],"wage":0,"completedProg":"","notes":"","rtiHours":20,"rtiSessions":1,"rtiMonthly":[false,false,false,false,false,false,false,false,true,false,false,false,false,false,false,false],"coaching":"","praxis":""},{"name":"Sarah Renz","status":"cancelled","placement":"","usdolId":"NJ2025001717","pctOjt":0,"ojtReported":0,"ojtTotalCalc":0,"ojtAprHrs":0,"ojtMayHrs":0,"ojtJunHrs":0,"ojtMonthlyHrs":[0,0,0,0,0,0,0,0,0,0,0,0,0,0],"wage":0,"completedProg":"","notes":"","rtiHours":0,"rtiSessions":0,"rtiMonthly":[false,false,true,false,false,false,false,false,false,false,false,false,false,false,false,false],"coaching":"","praxis":""},{"name":"Subul Sadiq","status":"active","placement":"iLearn Hudson","usdolId":"NJ2026000469","pctOjt":1.0,"ojtReported":4094,"ojtTotalCalc":79,"ojtAprHrs":55,"ojtMayHrs":94,"ojtJunHrs":8,"ojtMonthlyHrs":[0,0,0,0,0,0,0,0,0,0,0,15,7,14],"wage":35.0,"completedProg":"n- rti","notes":"needs follow up to complete","rtiHours":162,"rtiSessions":6,"rtiMonthly":[false,false,false,false,false,false,false,false,false,false,false,true,true,true,true,false],"coaching":"Y","praxis":"Y"},{"name":"Theodore (Ted) Kostich","status":"cancelled","placement":"","usdolId":"NJ2025001824","pctOjt":0,"ojtReported":0,"ojtTotalCalc":0,"ojtAprHrs":0,"ojtMayHrs":0,"ojtJunHrs":0,"ojtMonthlyHrs":[0,0,0,0,0,0,0,0,0,0,0,0,0,0],"wage":0,"completedProg":"","notes":"","rtiHours":0,"rtiSessions":0,"rtiMonthly":[false,false,true,false,false,false,false,false,false,false,false,false,false,false,false,false],"coaching":"","praxis":""},{"name":"Theodore Mills","status":"cancelled","placement":"Long Term Sub","usdolId":"NJ2025004828","pctOjt":0,"ojtReported":0,"ojtTotalCalc":0,"ojtAprHrs":87,"ojtMayHrs":0,"ojtJunHrs":0,"ojtMonthlyHrs":[0,0,0,0,0,0,0,0,0,0,0,15,0,0],"wage":0,"completedProg":"","notes":"","rtiHours":54,"rtiSessions":2,"rtiMonthly":[false,false,false,false,false,false,false,false,false,true,false,false,false,false,false,false],"coaching":"N","praxis":""},{"name":"Aliviyah Goodson","status":"completed","placement":"iLearn Bergen MS","usdolId":"NJ2025004253","pctOjt":1.0,"ojtReported":4000,"ojtTotalCalc":87,"ojtAprHrs":0,"ojtMayHrs":0,"ojtJunHrs":8,"ojtMonthlyHrs":[0,0,0,0,0,0,0,13,32,20,7,7,0,0],"wage":33.99,"completedProg":"y","notes":"","rtiHours":324,"rtiSessions":12,"rtiMonthly":[false,false,false,false,false,false,true,true,true,true,true,true,true,true,true,true],"coaching":"Y","praxis":""},{"name":"Arelis Rodriguez","status":"completed","placement":"iLearn Bergen MS","usdolId":"NJ2025003378","pctOjt":1.0,"ojtReported":4000,"ojtTotalCalc":95,"ojtAprHrs":0,"ojtMayHrs":0,"ojtJunHrs":8,"ojtMonthlyHrs":[0,0,0,0,0,41,0,9,4,24,3,0,3,3],"wage":35.0,"completedProg":"y","notes":"","rtiHours":297,"rtiSessions":11,"rtiMonthly":[false,false,false,false,false,true,true,false,true,true,true,false,true,true,true,true],"coaching":"Y","praxis":""},{"name":"Avani Jimenez","status":"completed","placement":"Middlesex STEM","usdolId":"NJ2026001278","pctOjt":1.0,"ojtReported":4067,"ojtTotalCalc":47,"ojtAprHrs":48,"ojtMayHrs":67,"ojtJunHrs":8,"ojtMonthlyHrs":[0,0,0,0,0,0,0,0,0,0,0,0,16,18],"wage":35.0,"completedProg":"y","notes":"","rtiHours":297,"rtiSessions":11,"rtiMonthly":[false,false,false,false,false,false,true,true,true,true,true,true,true,true,true,true],"coaching":"Y","praxis":""},{"name":"Caitlin Evgeniadis","status":"completed","placement":"Hamilton Township","usdolId":"NJ2025001715","pctOjt":1.0,"ojtReported":4026,"ojtTotalCalc":63,"ojtAprHrs":77,"ojtMayHrs":26,"ojtJunHrs":0,"ojtMonthlyHrs":[0,0,0,0,0,0,0,0,6,11,27,5,11,3],"wage":32.99,"completedProg":"y","notes":"","rtiHours":351,"rtiSessions":13,"rtiMonthly":[false,false,true,false,false,true,true,true,true,true,true,true,true,true,true,false],"coaching":"Y","praxis":""},{"name":"Carlos Jacho","status":"completed","placement":"iLearn Paterson","usdolId":"NJ2025004966","pctOjt":1.0,"ojtReported":4000,"ojtTotalCalc":84,"ojtAprHrs":0,"ojtMayHrs":0,"ojtJunHrs":8,"ojtMonthlyHrs":[0,0,0,0,0,0,0,10,28,23,2,4,9,0],"wage":32.99,"completedProg":"y","notes":"","rtiHours":243,"rtiSessions":9,"rtiMonthly":[false,false,false,false,false,false,false,true,true,true,true,true,false,true,true,true],"coaching":"Y","praxis":""},{"name":"Ian Anderson","status":"completed","placement":"iLearn Hudson MS","usdolId":"NJ2025004964","pctOjt":1.0,"ojtReported":4000,"ojtTotalCalc":95,"ojtAprHrs":0,"ojtMayHrs":0,"ojtJunHrs":8,"ojtMonthlyHrs":[0,0,0,0,0,0,0,22,5,40,6,1,7,4],"wage":35.0,"completedProg":"y","notes":"","rtiHours":270,"rtiSessions":10,"rtiMonthly":[false,false,false,false,false,false,false,true,true,true,true,true,true,true,true,false],"coaching":"Y","praxis":"Y"},{"name":"Jasmine Ramsey","status":"completed","placement":"iLearn Passaic MS","usdolId":"NJ2025001829","pctOjt":1.0,"ojtReported":4000,"ojtTotalCalc":91,"ojtAprHrs":0,"ojtMayHrs":0,"ojtJunHrs":8,"ojtMonthlyHrs":[0,0,0,0,24,0,0,5,3,39,1,1,6,4],"wage":40.0,"completedProg":"y","notes":"","rtiHours":378,"rtiSessions":14,"rtiMonthly":[false,false,true,false,false,true,true,true,true,true,true,true,true,true,true,true],"coaching":"Y","praxis":"Y"},{"name":"Naima Boutira","status":"completed","placement":"Central Jersey College Prep","usdolId":"NJ2025005328","pctOjt":1.0,"ojtReported":4000,"ojtTotalCalc":85,"ojtAprHrs":0,"ojtMayHrs":0,"ojtJunHrs":8,"ojtMonthlyHrs":[0,0,0,0,0,0,0,0,23,1,25,5,4,16],"wage":32.99,"completedProg":"y","notes":"","rtiHours":297,"rtiSessions":11,"rtiMonthly":[false,false,false,false,false,false,false,true,true,true,true,true,true,true,true,true],"coaching":"Y","praxis":"Y"},{"name":"Nicholas Hoover","status":"completed","placement":"Haddon Township","usdolId":"NJ2025001712","pctOjt":1.0,"ojtReported":4000,"ojtTotalCalc":75,"ojtAprHrs":0,"ojtMayHrs":0,"ojtJunHrs":8,"ojtMonthlyHrs":[0,0,0,0,24,0,0,4,14,10,4,2,4,4],"wage":40.0,"completedProg":"y","notes":"","rtiHours":378,"rtiSessions":14,"rtiMonthly":[false,false,true,false,false,true,true,true,true,true,true,true,true,true,true,true],"coaching":"Y","praxis":""},{"name":"Pooja Tyagi","status":"completed","placement":"Central Jersey College Prep","usdolId":"NJ2025001716","pctOjt":1.0,"ojtReported":4000,"ojtTotalCalc":76,"ojtAprHrs":0,"ojtMayHrs":0,"ojtJunHrs":8,"ojtMonthlyHrs":[0,0,0,0,0,0,0,0,20,1,19,10,9,5],"wage":35.0,"completedProg":"y","notes":"","rtiHours":324,"rtiSessions":12,"rtiMonthly":[false,false,true,false,false,true,true,true,true,true,true,true,true,true,true,false],"coaching":"Y","praxis":""},{"name":"Shahzeeb Ahmad","status":"completed","placement":"iLearn Bergen","usdolId":"NJ2025004822","pctOjt":1.0,"ojtReported":4000,"ojtTotalCalc":70,"ojtAprHrs":0,"ojtMayHrs":0,"ojtJunHrs":8,"ojtMonthlyHrs":[0,0,0,0,0,0,0,6,16,18,19,0,0,2],"wage":45.0,"completedProg":"y","notes":"","rtiHours":270,"rtiSessions":10,"rtiMonthly":[false,false,false,false,false,false,false,true,true,true,true,true,true,true,true,true],"coaching":"Y","praxis":""},{"name":"sharon kessel","status":"completed","placement":"iLearn Paterson Silk City","usdolId":"NJ2025001707","pctOjt":1.0,"ojtReported":4000,"ojtTotalCalc":86,"ojtAprHrs":0,"ojtMayHrs":0,"ojtJunHrs":8,"ojtMonthlyHrs":[0,0,0,0,41,0,0,9,6,8,2,2,5,4],"wage":35.0,"completedProg":"y","notes":"","rtiHours":378,"rtiSessions":14,"rtiMonthly":[false,false,true,false,false,true,true,true,true,true,true,true,true,true,true,true],"coaching":"Y","praxis":""}];

  // ── OTJ Workbook Vault — SY 25-26 ONLY (NEW 7/9/26) ────────────────────────
  // Confirmed with Amir 7/9/26: this replaces the removed NE/SW "Document
  // Vault" tab entirely. That tab pulled OTJ Checklist links from the messy,
  // uncleaned NE/SW tracker sheets — gone now, along with the rest of that
  // pipeline. The one thing worth keeping was the actual per-apprentice OTJ
  // workbook links, which exist independently in the SY 25-26 Apprentice
  // Tracker's own "Link to Folder" column — real Google Drive folder links,
  // not display text. Extracted directly from that column's embedded
  // hyperlinks (openpyxl's cell.hyperlink.target, not cell.value — the
  // visible cell text is just the person's name, same trap as the
  // now-corrected USDOL ID carryover work). 43 of 46 apprentices have a
  // link; 3 (Alexandra Cristescu, linda Fenty, Pankajbharathi
  // Sowmianarayanan) have no folder link in the source sheet at all — shown
  // as "No folder on file" rather than guessed or omitted silently.
  // One-time snapshot, not live — same reasoning as SY2526_DATA and the
  // other historical seeds in this file: this is closed-year data that
  // doesn't change, so a live fetch isn't needed (and hyperlinks aren't
  // available through the CSV export path used for live SY 25-26 data
  // anyway — CSV export never carries hyperlink targets, only cell text).
  const SY2526_OTJ_VAULT = [
  { n: 'Alexandra Cristescu', usdolId: 'NJ2026000468', link: '' },
  { n: 'Allison Dombrowski', usdolId: 'NJ2025002297', link: 'https://drive.google.com/drive/folders/11RKD3RAWmxtv_WMQ4yjB6XTLMiQNecDC?usp=drive_link' },
  { n: 'Apollo Monroy-Polanco', usdolId: 'NJ2025004827', link: 'https://drive.google.com/drive/folders/1of2VV0Ji2hVyQps7VGen6NMnzis7X4sp?usp=drive_link' },
  { n: 'Aliviyah Goodson', usdolId: 'NJ2025004253', link: 'https://drive.google.com/drive/folders/1KWVLoSGCE3ZmQjt5Wuc95GH7Xo7fSK34?usp=drive_link' },
  { n: 'Chelsea Jordan', usdolId: 'NJ2025001925', link: 'https://drive.google.com/drive/folders/18jRzKn25e5LIUBmxYW7tVT53YFHHpmEn?usp=drive_link' },
  { n: 'Claudia Tumelus', usdolId: 'NJ2025004254', link: 'https://drive.google.com/drive/folders/1YTZrqAXi5XStDS670D0tWMNf6JGdLMj1?usp=drive_link' },
  { n: 'Daniel DiQuinzio', usdolId: 'NJ2025001713', link: 'https://drive.google.com/drive/folders/1qBFS814vcXaYtMg6tV05LSA3MqHbp_PN?usp=drive_link' },
  { n: 'Arelis Rodriguez', usdolId: 'NJ2025003378', link: 'https://drive.google.com/drive/folders/1YmZvawQ-NyLMj0Ht9GDuMUhKrIbq3uj3?usp=drive_link' },
  { n: 'Elijah Brown', usdolId: 'NJ2025002412', link: 'https://drive.google.com/drive/folders/1sN6NDW359yTAPU_052k3UCes6QHFhks_?usp=drive_link' },
  { n: 'Genesis Rosich', usdolId: 'NJ2025004826', link: 'https://drive.google.com/drive/folders/1DFYYlRzTw4Wta-OgXY-rUNsDaC6Jv9_6?usp=sharing' },
  { n: 'Heba Samhouri', usdolId: 'NJ2025002413', link: 'https://drive.google.com/drive/folders/1F_jOQNa9Ojf9gia9WB-B5CeC8wxcgTg9?usp=drive_link' },
  { n: 'Avani Jimenez', usdolId: 'NJ2026001278', link: 'https://drive.google.com/drive/folders/1xFnhUstjaiY92PZxJHY2sktiyn9loajY?usp=drive_link' },
  { n: 'Janelle lee', usdolId: 'NJ2025003240', link: 'https://drive.google.com/drive/folders/1RY7_Y5yGLbQqUi_Im0ZJAGQkXA9JNEJT?usp=drive_link' },
  { n: 'Caitlin Evgeniadis', usdolId: 'NJ2025001715', link: 'https://drive.google.com/drive/folders/1njPIzdQZZjyJ7tpRyRIVyaQQW3jsGphe?usp=drive_link' },
  { n: 'Carla Borbon', usdolId: 'NJ2026000857', link: 'https://drive.google.com/drive/folders/1zj4MyAld-GL06HbB2ChxuJOD17OwNt1M?usp=drive_link' },
  { n: 'Carlos Jacho', usdolId: 'NJ2025004966', link: 'https://drive.google.com/drive/folders/1-2ZSmX_Q9Gw0CdgZnKYYe2tMVuUbdCdV?usp=drive_link' },
  { n: 'Katrina Valentin', usdolId: 'NJ2025001719', link: 'https://drive.google.com/drive/folders/15mjq5O_MuNqW6L0VwaRIVYlJ4PeJo8Fn?usp=drive_link' },
  { n: 'Renee Davis', usdolId: 'NJ2025004829', link: 'https://drive.google.com/drive/folders/1WE8rlIgH2Y0WiLTiYYGOvHUiEe7tQNLz?usp=drive_link' },
  { n: 'Ian Anderson', usdolId: 'NJ2025004964', link: 'https://drive.google.com/drive/folders/1tZQMELNzIZ_BIK4VL8KmWMrBykmum0CL?usp=drive_link' },
  { n: 'linda Fenty', usdolId: 'NJ2026000858', link: '' },
  { n: 'Jacob Leebron', usdolId: 'NJ2025001825', link: 'https://drive.google.com/drive/folders/174ku6DM-7uPJS1iPF7nM0GBG_4--chHz?usp=drive_link' },
  { n: 'Marina Farag', usdolId: 'NJ2025002296', link: 'https://drive.google.com/drive/folders/10YFXkawTNJ-0EmmIixNTUk7Ij0BDYhuO?usp=drive_link' },
  { n: 'Jasmine Ramsey', usdolId: 'NJ2025001829', link: 'https://drive.google.com/drive/folders/1KRbix6ruR8YjR8vEFU4fp29mNGM2GMhu?usp=drive_link' },
  { n: 'Jazmin Daliza Garcia', usdolId: 'NJ2026001279', link: 'https://drive.google.com/drive/folders/1bjb1xAwHlVopmruPN1pvZs1K7un1qQDn?usp=drive_link' },
  { n: 'Michelle Kim', usdolId: 'NJ2025004252', link: 'https://drive.google.com/drive/folders/1TMs0J25JrA1PvtGA0m0692mN5vEwsobk?usp=drive_link' },
  { n: 'Monica Brown', usdolId: 'NJ2025005327', link: 'https://drive.google.com/drive/folders/1sWgYAK6IirtXwm4sV6VaGUENUQ9oYwS-?usp=drive_link' },
  { n: 'Jessica Flores', usdolId: 'NJ2025001718', link: 'https://drive.google.com/drive/folders/1cfhmsaFGsQVe3ldFfGho32nD-xdsic00?usp=drive_link' },
  { n: 'Nicole Cill', usdolId: 'NJ2025004251', link: 'https://drive.google.com/drive/folders/1vVy3YdjIiIGYxXstHSkMmt3eAM2LlMxx?usp=drive_link' },
  { n: 'Katie Rose Davis', usdolId: 'NJ2025005330', link: 'https://drive.google.com/drive/folders/1Y4HxlYbv08UiMup5redYIYNUxINOCMzA?usp=drive_link' },
  { n: 'Pankajbharathi Sowmianarayanan', usdolId: 'NJ2025004823', link: '' },
  { n: 'Sarah Renz', usdolId: 'NJ2025001717', link: 'https://drive.google.com/drive/folders/12CR3o3YWm3GgeZgkJUZUHwCc7S7u0y_Z?usp=drive_link' },
  { n: 'Keisha Lopez', usdolId: 'NJ2026000470', link: 'https://drive.google.com/drive/folders/17ylQ4TCHinoYv_YJYao805AfThg-sJQj?usp=drive_link' },
  { n: 'Theodore (Ted) Kostich', usdolId: 'NJ2025001824', link: 'https://drive.google.com/drive/folders/1ODZFBskLpxt4mGlthctAfsTGE5EGO3_M?usp=drive_link' },
  { n: 'Theodore Mills', usdolId: 'NJ2025004828', link: 'https://drive.google.com/drive/folders/1sYhlv6R6sBqik_Uo9AykKqNhMaZQnf4E?usp=drive_link' },
  { n: 'Lilia Quintero', usdolId: 'NJ2026000471', link: 'https://drive.google.com/drive/folders/1FL8JNH7bb2YDSBImDYP_6wKvihC-lwCQ?usp=drive_link' },
  { n: 'maria del carmen gutierrez colin', usdolId: 'NJ2025005329', link: 'https://drive.google.com/drive/folders/1vVrH3-sP13RuGBBvAtASL4dasrXkt3rq?usp=drive_link' },
  { n: 'Melissa Mazza', usdolId: 'NJ2026001277', link: 'https://drive.google.com/drive/folders/1MtWmJ_lwItOW7oMlpxt4DA64PggKHdBs?usp=drive_link' },
  { n: 'Micaela Wilkerson', usdolId: 'NJ2025004825', link: 'https://drive.google.com/drive/folders/157saQpWTd_P1Eo5VKrb--nCebhVKNaQ9?usp=drive_link' },
  { n: 'Mushana Dunham', usdolId: 'NJ2025005331', link: 'https://drive.google.com/drive/folders/10ybXIRO3A85WtsscUxns_vaQa_GP4cCD?usp=drive_link' },
  { n: 'Naima Boutira', usdolId: 'NJ2025005328', link: 'https://drive.google.com/drive/folders/1o535nKMuDWOyfxPFRwYnYqtLCODRRfGg?usp=drive_link' },
  { n: 'Nicholas Hoover', usdolId: 'NJ2025001712', link: 'https://drive.google.com/drive/folders/1kEIDSk77-wbHKw5jHQCwpU4ZwxrYB3do?usp=drive_link' },
  { n: 'Norelis Ramirez', usdolId: 'NJ2026000265', link: 'https://drive.google.com/drive/folders/1P9ZS3GpmA8g7P0rKsmxw2wieK0JdXMPQ?usp=drive_link' },
  { n: 'Pooja Tyagi', usdolId: 'NJ2025001716', link: 'https://drive.google.com/drive/folders/1ZHKalMjvfd2eR4i4sZgizWYV1cr6AaN7?usp=drive_link' },
  { n: 'Shahzeeb Ahmad', usdolId: 'NJ2025004822', link: 'https://drive.google.com/drive/folders/1s_krIF2EVyjtFCPVBCfkIo31SMEgaUPu?usp=drive_link' },
  { n: 'sharon kessel', usdolId: 'NJ2025001707', link: 'https://drive.google.com/drive/folders/1ZugOLhAzO9bxsceX9_cC_rEzwKu6IB7d?usp=drive_link' },
  { n: 'Subul Sadiq', usdolId: 'NJ2026000469', link: 'https://drive.google.com/drive/folders/1XbIiVYcGhE-qKNldIGp-QqaYwqxobQ9O?usp=drive_link' },
  ];

  // ── SY 25-26 render — accepts LIVE rows (fetched by index.html's
  // fetchSY2526Roster) when available; falls back to the embedded
  // SY2526_DATA snapshot only if the live fetch failed or hasn't run.
  // Everything below this line is unchanged — it already only reads from
  // the local `rows` variable, never SY2526_DATA directly.
  function render2526OtjOverview(container, liveRows) {
    const rows        = (liveRows && liveRows.length) ? liveRows : SY2526_DATA;
    const total       = rows.length;
    const active      = rows.filter(r => r.status === 'active');
    const cancelled   = rows.filter(r => r.status === 'cancelled');
    const completed   = rows.filter(r => r.status === 'completed');
    const programRows = rows.filter(r => r.status !== 'cancelled');
    const totalOjtHrs = programRows.reduce((s, r) => s + (r.ojtReported || 0), 0);
    const totalRtiHrs = programRows.reduce((s, r) => s + (r.rtiHours || 0), 0);
    const fullComplete = completed.filter(r => r.completedProg === 'y').length;
    const at100pct    = programRows.filter(r => r.pctOjt >= 1.0).length;
    const needsRti    = active.filter(r => (r.completedProg || '').includes('rti')).length;
    const needsBoth   = active.filter(r => (r.completedProg || '').includes('both')).length;
    const ojtMonthTotals = SY2526_OJT_MONTHS.map((_, idx) =>
      programRows.reduce((s, r) => s + ((r.ojtMonthlyHrs && r.ojtMonthlyHrs[idx]) || 0), 0)
    );
    const rtiMonthTotals = SY2526_RTI_MONTHS.map((_, idx) =>
      programRows.filter(r => r.rtiMonthly && r.rtiMonthly[idx]).length
    );
    const maxOjt = Math.max(...ojtMonthTotals, 1);

    function syKpi(val, label, color) {
      return `<div class="ta-card ta-kpi" style="border-top:3px solid ${color}"><div class="ta-kpi-val" style="color:${color}">${val}</div><div class="ta-kpi-sub">${label}</div></div>`;
    }
    // OTJ Workbook Vault matching — USDOL ID primary (exact), name fallback
    // (normalized, same convention used elsewhere in this file). Never
    // guesses past those two rules; no match just means no link shown.
    function _sy2526NormName(s) {
      return String(s || '').replace(/\([^)]*\)/g, ' ').replace(/[^a-zA-Z\s]/g, ' ').toLowerCase().trim().replace(/\s+/g, ' ');
    }
    function _sy2526VaultLink(usdolId, name) {
      let hit = SY2526_OTJ_VAULT.find(v => usdolId && v.usdolId === usdolId);
      if (!hit) hit = SY2526_OTJ_VAULT.find(v => _sy2526NormName(v.n) === _sy2526NormName(name));
      return hit ? hit.link : undefined; // undefined = person not in the vault seed at all; '' = in seed but no link on file
    }
    const sorted = [...rows].sort((a, b) => {
      const o = { completed:0, active:1, cancelled:2 };
      const d = ((o[a.status] ?? 3) - (o[b.status] ?? 3));
      return d !== 0 ? d : a.name.localeCompare(b.name);
    });

    container.innerHTML = `
<div class="ta-grid ta-grid-4" style="margin-bottom:1rem">
  ${syKpi(total,            'Total Enrolled',        '#1B2A4A')}
  ${syKpi(completed.length, 'Program Completers',    '#059669')}
  ${syKpi(active.length,    'Active / In Progress',  '#1d4ed8')}
  ${syKpi(cancelled.length, 'Cancelled / Exited',    '#9ca3af')}
</div>
<div class="ta-grid ta-grid-4" style="margin-bottom:1.25rem">
  ${syKpi(totalOjtHrs.toLocaleString(), 'Total OJT Hrs Logged',  '#059669')}
  ${syKpi(totalRtiHrs.toLocaleString(), 'Total RTI Hrs Logged',   '#7c3aed')}
  ${syKpi(at100pct + ' / ' + programRows.length, '100% OJT Complete', at100pct === programRows.length ? '#059669' : '#d97706')}
  ${syKpi(fullComplete,     'Fully Completed (OJT+RTI)', fullComplete >= completed.length ? '#059669' : '#d97706')}
</div>
<div class="ta-card" style="margin-bottom:1rem">
  <div class="ta-card-title">📊 Completion Pipeline — SY 2025-26 Cohort</div>
  <div style="display:flex;gap:2px;border-radius:8px;overflow:hidden;margin:.75rem 0">
    ${[['🏆 Fully Completed','#dcfce7','#166534',fullComplete],['⚠️ RTI Pending','#dbeafe','#1e40af',needsRti],['🔴 Both Pending','#fef3c7','#92400e',needsBoth],['❌ Cancelled','#f3f4f6','#6b7280',cancelled.length]]
      .map(([lbl,bg,clr,cnt]) => `<div style="flex:${cnt||0.5};background:${bg};padding:.75rem .5rem;text-align:center;min-width:54px"><div style="font-size:1.4rem;font-weight:800;color:${clr}">${cnt}</div><div style="font-size:.64rem;color:${clr};font-weight:700;line-height:1.3">${lbl}</div><div style="font-size:.61rem;color:${clr};opacity:.7">${cnt && total ? Math.round(cnt/total*100)+'%' : ''}</div></div>`).join('<div style="width:2px;background:#fff"></div>')}
  </div>
</div>
<div class="ta-card" style="margin-bottom:1rem">
  <div class="ta-card-title">📅 Monthly OJT Hours — Program Total (Mar-24 → Apr-25)</div>
  <div style="display:flex;align-items:flex-end;gap:3px;height:96px;margin-top:.875rem;padding:0 .25rem">
    ${SY2526_OJT_MONTHS.map((lbl, idx) => { const v2 = ojtMonthTotals[idx]; const h = Math.round((v2/maxOjt)*78); return `<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:2px"><div style="font-size:.54rem;color:#6b7280;font-weight:600;min-height:.8rem">${v2>0?v2:''}</div><div style="width:100%;height:${h}px;background:${v2>0?'#1B2A4A':'#e5e7eb'};border-radius:3px 3px 0 0;min-height:2px"></div><div style="font-size:.5rem;color:#9ca3af;transform:rotate(-45deg);transform-origin:top left;white-space:nowrap;margin-left:.25rem;margin-top:.15rem">${lbl}</div></div>`; }).join('')}
  </div>
</div>
<div class="ta-card" style="margin-bottom:1rem">
  <div class="ta-card-title">👥 Full SY 25-26 Cohort Roster</div>
  <div style="overflow-x:auto;margin-top:.75rem">
  <table class="ta-table" style="font-size:.78rem">
    <thead><tr style="background:#1B2A4A;color:#fff">
      <th style="padding:.4rem .5rem;text-align:left">Name</th>
      <th style="padding:.4rem .4rem;text-align:center">Status</th>
      <th style="padding:.4rem .4rem;text-align:left">Site</th>
      <th style="padding:.4rem .4rem;text-align:center">OJT %</th>
      <th style="padding:.4rem .4rem;text-align:center">OJT Hrs</th>
      <th style="padding:.4rem .4rem;text-align:center">Hrs Left</th>
      <th style="padding:.4rem .4rem;text-align:center">RTI Hrs</th>
      <th style="padding:.4rem .4rem;text-align:center">Wage</th>
      <th style="padding:.4rem .5rem;text-align:center">Completed</th>
    </tr></thead>
    <tbody>
      ${sorted.map(r => {
        const hrs       = r.ojtReported || 0;
        const pct       = r.pctOjt || (hrs / SY2526_OJT_TARGET);
        const remaining = Math.max(0, SY2526_OJT_TARGET - hrs);
        const pctClr    = pct >= 1 ? '#059669' : pct >= 0.9 ? '#d97706' : '#ef4444';
        const bdrClr    = r.status === 'completed' ? '#bbf7d0' : r.status === 'active' ? '#bfdbfe' : '#fca5a5';
        const stPill    = { active:'<span style="background:#dcfce7;color:#166534;font-size:.63rem;font-weight:700;padding:.1rem .35rem;border-radius:3px">Active</span>', completed:'<span style="background:#dbeafe;color:#1e3a8a;font-size:.63rem;font-weight:700;padding:.1rem .35rem;border-radius:3px">Completed</span>', cancelled:'<span style="background:#fee2e2;color:#991b1b;font-size:.63rem;font-weight:700;padding:.1rem .35rem;border-radius:3px">Cancelled</span>' }[r.status] || r.status;
        const compLabel = r.completedProg === 'y' ? '✅ Yes' : (r.completedProg || '').includes('rti') ? '⚠️ RTI Pend.' : (r.completedProg || '').includes('both') ? '🔴 Both Pend.' : r.status === 'cancelled' ? '❌ Cancelled' : '—';
        return `<tr style="border-bottom:1px solid #f3f4f6;border-left:3px solid ${bdrClr}">
          <td style="padding:.35rem .5rem;font-weight:700;color:#1B2A4A">${r.name}</td>
          <td style="padding:.35rem .4rem;text-align:center">${stPill}</td>
          <td style="padding:.35rem .4rem;font-size:.73rem;color:#374151">${r.placement||'—'}</td>
          <td style="padding:.35rem .4rem;text-align:center;font-weight:700;color:${pctClr}">${r.status==='cancelled'&&!r.ojtReported?'—':Math.round(pct*100)+'%'}</td>
          <td style="padding:.35rem .4rem;text-align:center;font-weight:600">${!hrs&&r.status==='cancelled'?'—':hrs.toLocaleString()}</td>
          <td style="padding:.35rem .4rem;text-align:center;color:${remaining>0?'#ef4444':'#059669'};font-weight:600">${!hrs&&r.status==='cancelled'?'—':remaining>0?remaining.toLocaleString():'✅'}</td>
          <td style="padding:.35rem .4rem;text-align:center;font-weight:600;color:${(r.rtiHours||0)>=SY2526_RTI_TARGET?'#059669':'#d97706'}">${r.rtiHours||'—'}</td>
          <td style="padding:.35rem .4rem;text-align:center">${r.wage?'$'+r.wage.toFixed(2):'—'}</td>
          <td style="padding:.35rem .5rem;text-align:center;font-size:.73rem">${compLabel}</td>
        </tr>`;
      }).join('')}
    </tbody>
  </table>
  </div>
  <div style="margin-top:.5rem;font-size:.72rem;color:#9ca3af">${total} apprentices · OJT target: ${SY2526_OJT_TARGET.toLocaleString()} hrs · RTI target: ${SY2526_RTI_TARGET} hrs</div>
</div>
<div class="ta-card">
  <div class="ta-card-title">🎓 RTI Monthly Attendance (Mar-24 → Jun-25)</div>
  <div style="display:flex;gap:4px;flex-wrap:wrap;margin-top:.75rem">
    ${SY2526_RTI_MONTHS.map((lbl, idx) => { const cnt = rtiMonthTotals[idx]; const pctR = programRows.length ? Math.round(cnt/programRows.length*100) : 0; const clr = pctR>=70?'#059669':pctR>=40?'#d97706':cnt>0?'#6b7280':'#e5e7eb'; return `<div style="text-align:center;min-width:42px"><div style="height:${Math.max(4,Math.round(pctR*.55))}px;background:${clr};border-radius:3px 3px 0 0;margin-bottom:2px"></div><div style="font-size:.67rem;font-weight:700;color:${clr}">${cnt>0?cnt:''}</div><div style="font-size:.54rem;color:#9ca3af;margin-top:.1rem">${lbl}</div></div>`; }).join('')}
  </div>
  <div style="margin-top:.75rem;font-size:.72rem;color:#9ca3af">Bar height = % of program apprentices with RTI attendance that month</div>
</div>
<div class="ta-card" style="margin-top:1rem">
  <div class="ta-card-title">📁 OTJ Workbook Vault — SY 25-26 Only</div>
  <div style="font-size:.75rem;color:#6b7280;margin:.4rem 0 .875rem">Direct links to each apprentice's individual OTJ workbook folder, pulled from the SY 25-26 Apprentice Tracker's own records. Scoped to this cohort only — SY 26-27 apprentices don't have folders here yet.</div>
  <input id="sy2526VaultSearch" type="text" placeholder="Search by name…" oninput="window._sy2526VaultFilter && window._sy2526VaultFilter(this.value)" style="width:100%;max-width:320px;padding:.4rem .75rem;border:1px solid #d1d5db;border-radius:6px;font-size:.82rem;margin-bottom:.875rem">
  <div id="sy2526VaultGrid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:.625rem">
    ${sorted.map(r => {
      const link = _sy2526VaultLink(r.usdolId, r.name);
      const hasLink = !!link;
      const inVault = link !== undefined;
      return `<div class="sy2526-vault-card" data-search="${r.name.toLowerCase()}" style="background:#fff;border:1px solid #e5e7eb;border-radius:8px;padding:.75rem .875rem;display:flex;align-items:center;justify-content:space-between;gap:.5rem">
        <div style="min-width:0">
          <div style="font-weight:700;color:#1B2A4A;font-size:.82rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${r.name}</div>
          <div style="font-size:.68rem;color:#9ca3af">${r.usdolId || 'No USDOL ID'}</div>
        </div>
        ${hasLink
          ? `<a href="${link}" target="_blank" rel="noopener" class="btn btn-primary btn-sm" style="font-size:.72rem;text-decoration:none;white-space:nowrap;flex-shrink:0">🔗 Open</a>`
          : inVault
            ? `<span style="font-size:.68rem;color:#d97706;white-space:nowrap;flex-shrink:0">No folder on file</span>`
            : `<span style="font-size:.68rem;color:#9ca3af;white-space:nowrap;flex-shrink:0">—</span>`}
      </div>`;
    }).join('')}
  </div>
  <div style="margin-top:.75rem;font-size:.72rem;color:#9ca3af">${SY2526_OTJ_VAULT.filter(v => v.link).length} of ${SY2526_OTJ_VAULT.length} SY 25-26 apprentices have a folder link on file.</div>
</div>`;
    window._sy2526VaultFilter = function(q) {
      const sq = (q || '').toLowerCase();
      document.querySelectorAll('.sy2526-vault-card').forEach(card => {
        card.style.display = (card.dataset.search || '').includes(sq) ? '' : 'none';
      });
    };
  }




  // ══════════════════════════════════════════════════════════════════
  //  TAB 4: T&D ANALYTICS — reconfigured 7/9/26 to use VALIDATED data
  // ══════════════════════════════════════════════════════════════════
  //
  // REPLACED (7/9/26): this tab used to build its apprentice card grid
  // from fetchAllSheets() — the same NE/SW tutor-observation pipeline
  // Amir flagged as unvetted and had removed from the Tutor Observations
  // and Site Leader Obs tabs. The old cards showed "Obs" counts and
  // "Leader" names sourced from that same uncleaned data. Rebuilt below
  // to use ONLY the validated sources already powering the TAP Dashboard:
  // the live SY 26-27 Master Roster (window.fetchTapRoster/getTapData)
  // and the live SY 25-26 Apprentice Tracker (window.fetchSY2526Roster,
  // falling back to the embedded SY2526_DATA snapshot). Same USDOL-ID-
  // verified, hyperlink-verified data used everywhere else in this app —
  // nothing new is invented here, just reused correctly.
  //
  // SCOPE NOTE: the old "click for full profile" detail panel
  // (window.apprOpenProfile below, ~300 lines) was built entirely around
  // Pearl survey ratings and an OJT-submission form tied to the old NE/SW
  // system — not just observation counts, but the whole profile view.
  // Rebuilding that safely on validated data is a bigger job than this
  // pass covers, so it's intentionally left disconnected (not deleted —
  // still in this file below, just no longer linked to from here) rather
  // than shipping a half-migrated profile view. This grid is summary-only
  // for now; say the word if you want the detail panel rebuilt properly.

  let _tdApprYear = '2627';

  async function renderApprenticeTab() {
    const el = document.getElementById('td-content-apprentice');
    if (!el) return;
    el.innerHTML = loadingHTML('Loading validated TAP roster…');
    try {
      if (!window.fetchTapRoster || !window.getTapData || !window.fetchSY2526Roster || !window._roleCategory) {
        el.innerHTML = errorHTML('TAP Dashboard data functions not available — ensure index.html finished loading before this tab runs.', 'function(){_tdLoaded["apprentice"]=false;renderApprenticeTab();}');
        return;
      }
      await window.fetchTapRoster();
      const tapData = window.getTapData();
      if (!tapData && window._njtcTapRosterError) {
        el.innerHTML = `<div style="padding:2rem;max-width:560px;margin:0 auto;text-align:center;color:var(--muted)">🔒 ${window._njtcTapRosterError}</div>`;
        return;
      }
      window._tdApprLive2627 = (tapData && tapData.apprentices) || [];
      window._tdApprLive2526 = await window.fetchSY2526Roster();
      _renderApprenticeContent(el);
    } catch (e) {
      el.innerHTML = errorHTML(e.message, 'function(){_tdLoaded["apprentice"]=false;renderApprenticeTab();}');
    }
  }

  function _renderApprenticeContent(el) {
    const isSY2627 = _tdApprYear === '2627';
    if (isSY2627) {
      const all = (window._tdApprLive2627 || []).filter(a => /active|reinstated/i.test(a.status || ''));
      const role = document.getElementById('tdApprRoleFilter');
      const roleVal = role ? role.value : '';
      const apps = roleVal ? all.filter(a => window._roleCategory(a) === roleVal) : all;
      const counts = {
        Apprentice: all.filter(a => window._roleCategory(a) === 'Apprentice').length,
        'Pre-apprentice': all.filter(a => window._roleCategory(a) === 'Pre-apprentice').length,
        Tutor: all.filter(a => window._roleCategory(a) === 'Tutor').length,
      };
      function roleBadge(a) {
        const r = window._roleCategory(a);
        const clr = r === 'Apprentice' ? '#059669' : r === 'Pre-apprentice' ? '#0891b2' : '#6b7280';
        return `<span style="background:${clr}1a;color:${clr};font-size:.63rem;font-weight:700;padding:.15rem .45rem;border-radius:4px">${r}</span>`;
      }
      el.innerHTML = `
        <div style="display:flex;gap:.5rem;flex-wrap:wrap;align-items:center;margin-bottom:1.25rem">
          <button class="pst-tab ${isSY2627?'active':''}" onclick="window._tdApprSwitchYear('2627')" style="padding:.35rem .9rem">SY 26-27 (Live)</button>
          <button class="pst-tab" onclick="window._tdApprSwitchYear('2526')" style="padding:.35rem .9rem">SY 25-26</button>
          <select id="tdApprRoleFilter" onchange="window._tdApprRenderCurrent()" style="margin-left:auto;padding:.4rem .6rem;border:1px solid #d1d5db;border-radius:6px;font-size:.82rem">
            <option value="">All Roles (${all.length})</option>
            <option value="Apprentice" ${roleVal==='Apprentice'?'selected':''}>Apprentice (${counts.Apprentice})</option>
            <option value="Pre-apprentice" ${roleVal==='Pre-apprentice'?'selected':''}>Pre-apprentice (${counts['Pre-apprentice']})</option>
            <option value="Tutor" ${roleVal==='Tutor'?'selected':''}>Tutor (${counts.Tutor})</option>
          </select>
        </div>
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:.875rem">
          ${apps.sort((a,b)=>a.name.localeCompare(b.name)).map(a => `
            <div style="background:#fff;border:1px solid #e5e7eb;border-radius:10px;padding:1rem">
              <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:.5rem;margin-bottom:.4rem">
                <div style="font-weight:700;color:#1B2A4A;font-size:.9rem">${a.name}</div>
                ${roleBadge(a)}
              </div>
              <div style="font-size:.76rem;color:#6b7280;margin-bottom:.6rem">${a.site || 'No site on file'}</div>
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:.5rem;font-size:.75rem">
                <div><span style="color:#9ca3af">OJT %</span><br><strong style="color:${(a.ojtPct||0)>=1?'#059669':(a.ojtPct||0)>=.9?'#d97706':'#ef4444'}">${Math.round((a.ojtPct||0)*100)}%</strong></div>
                <div><span style="color:#9ca3af">OJT Hrs</span><br><strong>${(a.ojtHours||0).toLocaleString()}</strong></div>
                <div><span style="color:#9ca3af">RTI Hrs</span><br><strong>${a.rtiHours||0}</strong></div>
                <div><span style="color:#9ca3af">Wage</span><br><strong>${a.wage?'$'+parseFloat(a.wage).toFixed(2):'—'}</strong></div>
              </div>
            </div>`).join('')}
        </div>
        ${apps.length===0 ? '<div style="padding:2rem;text-align:center;color:var(--muted)">No one matches this filter.</div>' : ''}`;
    } else {
      // SY 25-26 — reuse the already-validated, already-built renderer
      // (same one the TAP Dashboard's SY 25-26 tab uses) instead of a
      // second parallel implementation.
      el.innerHTML = `
        <div style="display:flex;gap:.5rem;flex-wrap:wrap;align-items:center;margin-bottom:1.25rem">
          <button class="pst-tab" onclick="window._tdApprSwitchYear('2627')" style="padding:.35rem .9rem">SY 26-27 (Live)</button>
          <button class="pst-tab active" onclick="window._tdApprSwitchYear('2526')" style="padding:.35rem .9rem">SY 25-26</button>
        </div>
        <div id="tdApprSY2526Slot"></div>`;
      const slot = document.getElementById('tdApprSY2526Slot');
      if (slot && typeof render2526OtjOverview === 'function') {
        render2526OtjOverview(slot, window._tdApprLive2526);
      }
    }
  }

  window._tdApprSwitchYear = function(year) {
    _tdApprYear = year;
    const el = document.getElementById('td-content-apprentice');
    if (el) _renderApprenticeContent(el);
  };
  window._tdApprRenderCurrent = function() {
    const el = document.getElementById('td-content-apprentice');
    if (el) _renderApprenticeContent(el);
  };


  window.apprRegionFilter = function(region, btn) {
    document.querySelectorAll('#td-content-apprentice .pst-tab').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
    window._apprRegion = region;
    window.apprApplyFilter();
  };

  window.apprApplyFilter = function() {
    const region = window._apprRegion || 'all';
    const dist   = (document.getElementById('apprDistFilter')  || {}).value || '';
    const phase  = (document.getElementById('apprPhaseFilter') || {}).value || '';
    document.querySelectorAll('.appr-row').forEach(row => {
      const rRegion = row.dataset.region   || '';
      const rDist   = row.dataset.district || '';
      const rBeg    = row.dataset.beg      || '';
      const rMid    = row.dataset.mid      || '';
      const rEnd    = row.dataset.end      || '';
      let show = true;
      if (region !== 'all' && rRegion !== region) show = false;
      if (dist && rDist !== dist) show = false;
      if (phase && rBeg !== phase && rMid !== phase && rEnd !== phase) show = false;
      // Table rows: hide with display:none; queue cards: hide but keep grid layout intact
      if (row.classList.contains('appr-queue-card')) {
        row.style.visibility = show ? '' : 'hidden';
        row.style.pointerEvents = show ? '' : 'none';
        row.style.opacity = show ? '' : '0';
      } else {
        row.style.display = show ? '' : 'none';
      }
    });
  };


  // ══════════════════════════════════════════════════════════════════
  //  APPRENTICE PROFILE PANEL — view toggle + per-apprentice detail
  // ══════════════════════════════════════════════════════════════════

  window.apprToggleView = function(view) {
    const queueEl  = document.getElementById('apprQueueView');
    const tableEl  = document.getElementById('apprTableView');
    const queueBtn = document.getElementById('apprViewQueue');
    const tableBtn = document.getElementById('apprViewTable');
    if (!queueEl || !tableEl) return;
    if (view === 'queue') {
      queueEl.style.display = 'grid';
      tableEl.style.display = 'none';
      if (queueBtn) { queueBtn.style.background='#1B2A4A'; queueBtn.style.color='#fff'; queueBtn.style.fontWeight='600'; }
      if (tableBtn) { tableBtn.style.background='#f9fafb'; tableBtn.style.color='#6b7280'; tableBtn.style.fontWeight='400'; }
    } else {
      queueEl.style.display = 'none';
      tableEl.style.display = 'block';
      if (tableBtn) { tableBtn.style.background='#1B2A4A'; tableBtn.style.color='#fff'; tableBtn.style.fontWeight='600'; }
      if (queueBtn) { queueBtn.style.background='#f9fafb'; queueBtn.style.color='#6b7280'; queueBtn.style.fontWeight='400'; }
    }
    window._apprView = view;
  };

  window.apprCloseProfile = function() {
    const ov = document.getElementById('apprProfileOverlay');
    if (ov) ov.style.display = 'none';
  };

  // Pearl data for profile panel (shared 5-min cache keyed by GID)
  const _APPR_PEARL_BASE = '2PACX-1vQ1iC8NZFJt3iinGUEqftKtP32N43axi_JN_RQI36EBUdhZS0PaZRwd-1AJT3bEVe6cqHA0tCA3vb5K';
  const _APPR_ATT_GID    = 702726038;
  const _APPR_STU_GID    = 1245403832;
  const _apprPearlCache  = {};
  const _APPR_TUTOR_MISS = new Set([
    'Absent; Not Covered (Tutor not available)',
    'Absent; Covered by Sub Tutor',
    'Absent; Covered by Dual Role',
    'Absent; Covered by the Site Leader',
    'Absent; Covered by the Instructional Coach',
    'Tutor Left Early (no sub)',
  ]);

  async function _apprFetchPearlRows(gid, label) {
    const url = `https://docs.google.com/spreadsheets/d/e/${_APPR_PEARL_BASE}/pub?output=csv&gid=${gid}`;
    const now = Date.now();
    if (_apprPearlCache[gid] && now - _apprPearlCache[gid].ts < 300000)
      return _apprPearlCache[gid].rows;
    const resp = await fetch(url);
    if (!resp.ok) throw new Error('HTTP ' + resp.status + ' fetching ' + label);
    const text = await resp.text();
    // Parse without skipping rows — first row = headers
    const parsed = parseCsvText(text.replace(/\r\n/g,'\n').replace(/\r/g,'\n'), 0);
    _apprPearlCache[gid] = { rows: parsed.rows, ts: now };
    return parsed.rows;
  }

  function _apprNorm(n) {
    if (!n) return '';
    return n.trim().toLowerCase()
      .replace(/^dr\.?\s+/,'')
      .replace(/\(.*?\)/g,'')
      .replace(/-/g,' ')
      .replace(/\s+/g,' ')
      .trim();
  }
  function _apprNormFL(n) {
    const parts = _apprNorm(n).split(' ').filter(p => p.length > 1 && !/^[a-z]\.?$/.test(p));
    return parts.length >= 2 ? parts[0] + ' ' + parts[parts.length-1] : _apprNorm(n);
  }
  function _apprMatch(raw, targetName) {
    const rn = _apprNorm(raw), tn = _apprNorm(targetName);
    if (rn === tn) return true;
    const rfl = _apprNormFL(raw), tfl = _apprNormFL(targetName);
    return rfl && tfl && rfl === tfl;
  }

  function _apprRatingBar(val, max) {
    if (val === null || val === undefined || isNaN(val)) return '<span style="color:#9ca3af">—</span>';
    const pct = Math.round((val / max) * 100);
    const color = pct >= 80 ? '#059669' : pct >= 60 ? '#f59e0b' : '#ef4444';
    return `<div style="display:flex;align-items:center;gap:.5rem">
      <div style="flex:1;height:6px;background:#f3f4f6;border-radius:3px;overflow:hidden">
        <div style="width:${pct}%;height:100%;background:${color};border-radius:3px"></div>
      </div>
      <span style="font-size:.78rem;font-weight:700;color:${color};min-width:2.5rem;text-align:right">${val.toFixed(1)}/${max}</span>
    </div>`;
  }

  function _apprSection(title, icon, content) {
    return `<div style="margin-bottom:1.5rem">
      <div style="font-size:.7rem;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:#9ca3af;margin-bottom:.75rem;display:flex;align-items:center;gap:.35rem">
        <span>${icon}</span> ${title}
      </div>
      ${content}
    </div>`;
  }

  // ── NEW: Wage/payout calculator from OJT hours + the TAP wage tier schedule ──
  // Mirrors WAGE_TIERS exactly from the TAP Tracker Apps Script (non-cert
  // track). This data source has no cert-eligibility flag, so the cert-track
  // ($10/hr premium) rates are NOT applied here — flagged in the UI rather
  // than silently guessed. Computes an EXACT piecewise total across the tier
  // bands the apprentice has actually crossed — this is a calculation from
  // the documented pay schedule, not an estimate, but it can only be as
  // accurate as that schedule having been followed exactly; always reconcile
  // against actual payroll for state/grant reporting.
  const _APPR_WAGE_TIERS = [
    { from: 0,    to: 1100, rate: 30.00 },
    { from: 1100, to: 2200, rate: 30.98 },
    { from: 2200, to: 3300, rate: 31.99 },
    { from: 3300, to: 3800, rate: 32.99 },
    { from: 3800, to: 4000, rate: 33.99 },
    { from: 4000, to: 4000, rate: 35.00 }, // Program Complete milestone rate (applies going forward, not retroactively)
  ];
  function _apprComputePayout(ojtHours) {
    const hours = Math.min(Math.max(parseFloat(ojtHours) || 0, 0), 4000);
    let total = 0;
    const bands = [];
    _APPR_WAGE_TIERS.forEach(function (tier) {
      if (tier.from === tier.to) return; // the 4000+ marker row, no band width
      const hoursInBand = Math.max(0, Math.min(hours, tier.to) - tier.from);
      if (hoursInBand <= 0) return;
      const bandPay = hoursInBand * tier.rate;
      total += bandPay;
      bands.push({ label: tier.from.toLocaleString() + '–' + tier.to.toLocaleString() + ' hrs', hours: hoursInBand, rate: tier.rate, pay: bandPay });
    });
    return { totalHours: hours, totalPay: total, bands: bands };
  }

  function _apprProgressBar(count, total, color) {
    const pct = total > 0 ? Math.min(Math.round(count/total*100), 100) : 0;
    return `<div style="margin-bottom:.35rem">
      <div style="display:flex;justify-content:space-between;font-size:.75rem;color:#374151;margin-bottom:.25rem">
        <span style="font-weight:600">${count} / ${total} items</span>
        <span style="font-weight:700;color:${color}">${pct}%</span>
      </div>
      <div style="height:8px;background:#f3f4f6;border-radius:4px;overflow:hidden">
        <div style="width:${pct}%;height:100%;background:${color};border-radius:4px;transition:width .4s"></div>
      </div>
    </div>`;
  }

  // ── OJT Activity data (matches onsite portal dropdown exactly) ──────────────
  const _APPR_OJT_DATA = [
    {ph:'Beginning',dm:'Professionalism',c:'A',d:'Join the site visit/collaboration meeting or other event established by your site and site coordinator to introduce yourself and review school partner expectations.',lf:'Was this tutor present and engaged?'},
    {ph:'Beginning',dm:'Professionalism',c:'B',d:'Follow the schedule provided for daily routines, including assigned duties and meetings.',lf:'Does the tutor follow and understand the schedule?'},
    {ph:'Beginning',dm:'Professionalism',c:'C',d:'Providing information to supervisors, co-workers, and subordinates by telephone, in written form, e-mail, or in person.',lf:'Does the tutor communicate regularly and understand communication protocols?'},
    {ph:'Beginning',dm:'Professionalism',c:'D',d:'Review and complete the Modified Danielson Self-Assessment. Identify and share goals with your instructional coach.',lf:'Did the tutor complete the required training and the self-assessment?'},
    {ph:'Beginning',dm:'Professionalism',c:'E',d:'Utilize FERPA guidelines to ensure the separation of personal and professional relationships.',lf:'Did the tutor create a Gmail account and share data securely (if applicable)?'},
    {ph:'Beginning',dm:'Professionalism',c:'F',d:'Follow and demonstrate the policies and procedures as outlined in the Employee Handbook, School level handbook, and agency code of ethics if applicable.',lf:'Did the tutor sign the employee handbook and any other protocols established by their school location?'},
    {ph:'Beginning',dm:'Professionalism',c:'G',d:'Follow expectations for the creation and use of the unit planning template for collaborative and personalized instruction.',lf:'Has this tutor completed lesson plans and turned them in on time, consistently?'},
    {ph:'Beginning',dm:'Professionalism',c:'H',d:'Actively participate in the weekly delivery of professional learning opportunities.',lf:'Has the tutor participated in professional learning opportunities? If none are available, create some.'},
    {ph:'Beginning',dm:'Professionalism',c:'I',d:'Complete iReady training and collaborate with instructional coaches on building out your unit plan.',lf:'Did this tutor complete the iReady training and collaborate with you on building lessons informed by student data?'},
    {ph:'Beginning',dm:'Professionalism',c:'K',d:'Follow expectations for submissions of work time through ADP.',lf:'Did this tutor complete the training on ADP? Have they submitted timecards on time?'},
    {ph:'Beginning',dm:'Professionalism',c:'N',d:'Document by entering, transcribing, recording, storing, or maintaining information in written or electronic/magnetic form.',lf:'Does this tutor consistently turn in lesson plans electronically?'},
    {ph:'Beginning',dm:'Professionalism',c:'Q',d:'Performing day-to-day administrative tasks such as maintaining information files and processing paperwork.',lf:'Has this tutor completed at least 90% of Pearl surveys after each session? Have they completed attendance for their scholars?'},
    {ph:'Beginning',dm:'Professionalism',c:'R',d:'Utilize your email to respond to all communication from instructional coaches, site coordinator, classroom teachers, parents and any additional colleagues.',lf:'Does the tutor communicate regularly and understand communication protocols using Gmail account?'},
    {ph:'Beginning',dm:'Professionalism',c:'S',d:'Attend training sessions or professional meetings to develop or maintain professional knowledge.',lf:'Has the tutor attended 80% of team meetings and 100% of training sessions?'},
    {ph:'Beginning',dm:'Instruction',c:'B',d:'Conduct sessions that follow the teaching and learning framework (I do, We do, You do).',lf:'Lesson plans — The gradual release model is evident in the lesson plans.'},
    {ph:'Beginning',dm:'Instruction',c:'C',d:'Choose the most effective materials to support the lesson objective, engage students, and provide opportunities for student-to-student interaction and distribute accordingly.',lf:'Did the tutor use the approved list of supplementary materials? Knowtion (See Approved Supplemental Resources Folder).'},
    {ph:'Beginning',dm:'Instruction',c:'D',d:'Use the framework, independently plan and teach consistently for a 10-week block.',lf:'Did the tutor complete lessons over a 10-week period of time or the duration of the program?'},
    {ph:'Beginning',dm:'Instruction',c:'I',d:'Choose the most effective materials to support the lesson objective, engage students with various learning styles and provide opportunities for student-to-student interaction.',lf:'Did the tutor adapt materials and instruction based on learning needs or outcomes?'},
    {ph:'Beginning',dm:'Instruction',c:'L',d:'Promote equality of opportunity and anti-discriminatory practices.',lf:'If they are a new hire, did the tutor complete Social Justice training?'},
    {ph:'Beginning',dm:'Instruction',c:'M',d:'Communicate effectively, sensitively, and confidentially with colleagues of all backgrounds.',lf:'Do they approach scholars and colleagues with an asset based mindset?'},
    {ph:'Beginning',dm:'Instruction',c:'N',d:'Teach skills to improve academic performance, including study strategies, note-taking skills, and test-taking strategies.',lf:'All staff complete instructional training aligned to instructional framework; measured by IC observations and lesson plans.'},
    {ph:'Beginning',dm:'Instruction',c:'O',d:'Conducting practice tests to track progress, identify areas of improvement and help set goals for exam preparation.',lf:"Does this tutor's lessons have exit tickets? Did they complete goal setting with each scholar based on BOY, MOY data?"},
    {ph:'Beginning',dm:'Instruction',c:'Q',d:'Administer, proctor, or score academic or diagnostic assessments.',lf:'Did the tutor oversee Diagnostics?',na:true},
    {ph:'Beginning',dm:'Environment',c:'A',d:'Support the classroom teacher in reinforcing the rules and procedures for student learning and behavior in the classroom.',lf:'Did you observe the tutor following all rules/guidelines/expectations of their school site, consistently?'},
    {ph:'Beginning',dm:'Environment',c:'B',d:'Establishes and maintains a safe, caring, inclusive, and healthy learning environment.',lf:'Has the tutor consistently created a welcoming and inclusive environment? Have they adapted as necessary with feedback?'},
    {ph:'Beginning',dm:'Environment',c:'C',d:'Communicate with students using positive, professional, and compassionate language and tone.',lf:'Have you observed the tutor communicating consistently in these ways?'},
    {ph:'Beginning',dm:'Environment',c:'D',d:'Complete Modified Danielson framework for Domain 2 and discuss with the instructional coach for observations.',lf:'Have you met and discussed their responses on the self-assessment?'},
    {ph:'Beginning',dm:'Environment',c:'F',d:'Complies with relevant federal, state, and local requirements around mandated reporting, child study, and support for children with disabilities.',lf:'Tutor completed all Praesidium training and any other relevant training.'},
    {ph:'Beginning',dm:'Environment',c:'G',d:'Collaboration with classroom teachers regarding any behavioral issues that occur during tutoring or academic concerns.',lf:'Completed during Training component — Classroom Management (9 min).'},
    {ph:'Beginning',dm:'Environment',c:'I',d:'Provide feedback to students, using positive reinforcement techniques to encourage, motivate, or build confidence in students.',lf:'Classroom Management Strategies — has the tutor used strategies successfully?'},
    {ph:'Beginning',dm:'Planning',c:'A',d:'Utilize backwards design: Use iReady diagnostic data including instructional groupings, prerequisites, and scaffolding to complete Unit Planning template. Discuss with the instructional coach.',lf:'Has the tutor successfully created lessons that are data informed?'},
    {ph:'Beginning',dm:'Planning',c:'D',d:'Complete surveys in Pearl for each instructional session completed. This includes comments with notes on how the session went.',lf:'Has the tutor completed 80%+ attendance and scholar surveys?'},
    {ph:'Beginning',dm:'Planning',c:'E',d:'Prepare lesson materials (i.e. make copies, gather materials, set up learning stations, etc.)',lf:'Is the tutor consistently prepared for lessons with materials and any other instructional tools?'},
    {ph:'Middle',dm:'Professionalism',c:'J',d:'Actively participate in any faculty professional learning and complete reflections.',lf:'Has the tutor participated in professional learning opportunities? If none available, create some.'},
    {ph:'Middle',dm:'Professionalism',c:'L',d:'Review and complete the Use of Data indicator on the TEAM Professionalism rubric (progress report) and work with mentor teacher.',lf:'Has the tutor completed their progress reports using the NJTC Template?'},
    {ph:'Middle',dm:'Professionalism',c:'O',d:'Keeping up-to-date technically and applying new knowledge to your job.',lf:"Has the tutor's lessons & instruction incorporated your feedback?"},
    {ph:'Middle',dm:'Professionalism',c:'T',d:'Using computers and computer systems to program, write software, set up functions, enter data, or process information.',lf:'Does the tutor have a 90%+ attendance and survey completion?'},
    {ph:'Middle',dm:'Professionalism',c:'U',d:'Review data to inform tutoring practice.',lf:'Did the tutor complete i-Ready data training? Have they completed a goal sheet with scholars post-diagnostics?'},
    {ph:'Middle',dm:'Professionalism',c:'W',d:'Utilize technology software i.e. Microsoft Office, Google Meet, and Zoom.',lf:'Has your tutor contributed on Knowtion?'},
    {ph:'Middle',dm:'Instruction',c:'E',d:'Receive feedback from the Instructional Coach throughout the unit of study and make instructional adjustments based on feedback.',lf:'Has this tutor made adjustments to instruction based on coaching or feedback?'},
    {ph:'Middle',dm:'Instruction',c:'F',d:'Have scholars complete end of session surveys in Pearl and reviewed data to inform practice.',lf:'Does this tutor regularly administer Pearl surveys to scholars?'},
    {ph:'Middle',dm:'Instruction',c:'G',d:'Replicate established transition routines when changing activities during the day.',lf:'Have you observed this tutor maintaining consistent systems and routines?'},
    {ph:'Middle',dm:'Instruction',c:'H',d:'Demonstrates flexibility and responsiveness when delivering instruction.',lf:'Have you observed this tutor demonstrating flexibility on more than 2 occasions?'},
    {ph:'Middle',dm:'Instruction',c:'J',d:'Observe lessons with district approval to inform instruction.',lf:'Has the tutor observed teachers when they are not scheduled for a session?'},
    {ph:'Middle',dm:'Instruction',c:'K',d:'Create unit planning of instruction for each group of students.',lf:'Has this tutor successfully submitted lesson plans consistently? Are these lessons customized for each group?'},
    {ph:'Middle',dm:'Instruction',c:'P',d:'Identify, develop, or implement intervention strategies, tutoring plans, or individualized education plans (IEPs) for students.',lf:'Has this tutor successfully submitted lesson plans consistently? Are these lessons customized for each group?'},
    {ph:'Middle',dm:'Instruction',c:'R',d:'Translating or explaining what information means and how it can be used.',lf:'Does the tutor explain concepts in grade- and age-appropriate language that can be understood by scholars?'},
    {ph:'Middle',dm:'Instruction',c:'S',d:'Identifying the underlying principles, reasons, or facts of information by breaking down information or data into separate parts.',lf:'Does the tutor explain concepts in grade- and age-appropriate language that can be understood by scholars?'},
    {ph:'Middle',dm:'Instruction',c:'T',d:'Review class material with students by discussing text, working solutions to problems, or reviewing worksheets or other assignments.',lf:'Does the tutor explain concepts in grade- and age-appropriate language?'},
    {ph:'Middle',dm:'Instruction',c:'U',d:"Assess students' progress throughout tutoring sessions.",lf:'Does the tutor use exit tickets correctly? Other formative tools?'},
    {ph:'Middle',dm:'Instruction',c:'V',d:'Instruct students both in person and/or virtually.',lf:'Does this tutor keep scholars engaged during tutoring?'},
    {ph:'Middle',dm:'Instruction',c:'W',d:'Work with students to help them understand key concepts, especially those learned in the classroom.',lf:'Does the tutor successfully follow lesson plans that were developed to meet individual scholar needs?'},
    {ph:'Middle',dm:'Instruction',c:'X',d:'Assist students with homework, project, test preparation, papers, research, and other academic tasks.',lf:'When appropriate, does the tutor support scholars while observing whole class instruction?'},
    {ph:'Middle',dm:'Instruction',c:'Y',d:'Utilize tools needed to complete tasks such as Computers, Scanners, Scientific Calculators, or a Multi-line telephone system.',lf:'Were lesson plans submitted electronically? Does the tutor use available tools appropriately?'},
    {ph:'Middle',dm:'Instruction',c:'Z',d:'Identifying the educational needs of others, developing formal educational or training programs or classes, and teaching or instructing others.',lf:'Has this tutor successfully submitted lesson plans consistently?'},
    {ph:'Middle',dm:'Instruction',c:'AA',d:'Identifying the developmental needs of others and coaching, mentoring, or otherwise helping others to improve their knowledge or skills.',lf:'Has this tutor successfully submitted lesson plans consistently?'},
    {ph:'Middle',dm:'Instruction',c:'AB',d:'Translating or explaining what information means and how it can be used.',lf:'Does the tutor explain concepts in grade- and age-appropriate language?'},
    {ph:'Middle',dm:'Environment',c:'E',d:'Scholars report overall enjoyment working with apprentices through session surveys on Pearl.',lf:"Is this tutor's scholar rating 4.0 or higher?"},
    {ph:'Middle',dm:'Environment',c:'H',d:'Developing and distributing teaching materials to supplement classroom lessons, including study guides.',lf:'Does this tutor use hands-on materials from NJTC?'},
    {ph:'Middle',dm:'Environment',c:'J',d:'Collaborate with students, parents, teachers, school administrators, or counselors to determine student needs, develop tutoring plans, or assess student progress.',lf:'Has the tutor successfully completed progress reports?'},
    {ph:'Middle',dm:'Environment',c:'M',d:'Serves as an informed advocate for Education.',lf:'Actively participate in Knowtion; sharing resources from Knowledge page and collaborating in discussion threads.'},
    {ph:'Middle',dm:'Planning',c:'B',d:'Attend and bring required materials to classroom, weekly coaching sessions, and team meetings.',lf:'Is the tutor prepared for both classroom instructional responsibilities as well as meetings with team and classroom teachers?'},
    {ph:'Middle',dm:'Planning',c:'C',d:'Review and make notes on unit plans prior to collaboration (i.e. unit starters, standards, lesson plans, etc.).',lf:'Have they successfully modified lessons based on updated formative or summative assessments?'},
    {ph:'Middle',dm:'Planning',c:'F',d:'Collaborate with classroom teacher — share unit plan and work to connect prioritized skills from iReady to current year long scope and sequence.',lf:'Has the tutor uploaded lessons correctly? Did the tutor have the opportunity to collaborate with the classroom teacher?'},
    {ph:'Middle',dm:'Planning',c:'G',d:'In discussion with the instructional coach, review additional student achievement data to update unit planning and priorities for each student.',lf:'Has the tutor uploaded lessons correctly? Have they modified lessons based on updated assessments?'},
    {ph:'Middle',dm:'Planning',c:'H',d:'Working with the classroom teacher to share their data related to the goals and determine the effectiveness of the intervention.',lf:'Have they modified lessons based on updated formative or summative assessments?'},
    {ph:'Middle',dm:'Planning',c:'J',d:'Develop teaching or training materials, such as handouts, study materials, or quizzes.',lf:'Are appropriate materials linked to the lesson planning document?'},
    {ph:'Middle',dm:'Planning',c:'L',d:'Developing, designing, or creating new applications, ideas, relationships, systems, or products, including artistic contributions.',lf:'Has the tutor been observed to have completed any of these areas: developed relationships, created tutoring group systems?'},
    {ph:'Middle',dm:'Planning',c:'M',d:'Prepare progress reports and distribute them to individuals in charge of parent communication.',lf:'Has the tutor successfully completed progress reports? Have they shared progress with the classroom teacher or site leader?'},
    {ph:'Middle',dm:'Planning',c:'N',d:'Estimating quantities or determining time, resources, or materials needed to perform activity.',lf:'Is the tutor allocating sufficient time to cover concepts? Have they modified lessons based on updated assessments?'},
    {ph:'Middle',dm:'Planning',c:'R',d:'Create unit planning of instruction for each group of students.',lf:'Has this tutor successfully submitted lesson plans consistently?'},
    {ph:'End',dm:'Planning',c:'K',d:'Research or recommend textbooks, software, equipment, or other learning materials to complement tutoring.',lf:'Not applicable — they can meet with IC and discuss other tools to confirm they can successfully vet materials.',na:true},
    {ph:'End',dm:'Planning',c:'O',d:'Designing differentiated learning goals.',lf:'Lesson plan creation/submission.'},
    {ph:'End',dm:'Planning',c:'P',d:'Choose the most effective materials to support the lesson objective, engage students with various learning styles and provide opportunities for student-to-student interaction.',lf:'Did the tutor use the most appropriate or quality materials/tools for their Lesson plan creation/submission?'},
    {ph:'End',dm:'Planning',c:'Q',d:"Observe lessons with district approval to inform instruction.",lf:"During a designated classroom push-in time, did the tutor observe part or all of the teacher's lesson?",na:true},
    {ph:'End',dm:'Planning',c:'S',d:'Prepare and facilitate tutoring workshops, collaborative projects, or academic support sessions for small groups of students.',lf:'Lesson plan creation/submission & IC observation.'},
    {ph:'End',dm:'Planning',c:'T',d:"Prepare lesson plans or learning modules for tutoring sessions according to students' needs and goals.",lf:'Lesson plan creation/submission & IC observation.'},
    {ph:'End',dm:'Planning',c:'U',d:'Analyzing information and evaluating results to choose the best solution and solve problems.',lf:'Lesson plan creation/submission based on formative assessment results.'},
    {ph:'End',dm:'Instruction',c:'A',d:'Conduct sessions that are engaging and rigorous based on academic needs for scholars.',lf:'Based on multiple observations/coaching sessions (minimum 4).'},
    {ph:'End',dm:'Environment',c:'O',d:'Organize a tutoring environment to promote productivity and learning.',lf:'Documented in IC observations.'},
  ];

  function _apprOjtFormHtml(a) {
    const nk   = (a.name||'').toLowerCase().replace(/[^a-z0-9]/g,'_');
    const fid  = '1MOsppwhQmagAhVSHs29Ms4o9Ky4xYOyqy8Qs4uTrwbQ';
    const esc  = s => (s||'').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    const inp  = 'width:100%;background:#fff;border:1px solid #d1d5db;border-radius:6px;padding:.4rem .6rem;font-size:.78rem;color:#1B2A4A;';
    const lbl  = 'display:block;font-size:.7rem;font-weight:600;color:#6b7280;margin-bottom:.2rem;text-transform:uppercase;letter-spacing:.04em;';
    const observerInfo = window.NJTC_USER_PROFILE ? window.NJTC_USER_PROFILE.name || '' : '';
    // Pre-derive site from user profile assignments (first school)
    const siteDefault = (window.NJTC_USER_PROFILE &&
      window.NJTC_USER_PROFILE.assignments &&
      window.NJTC_USER_PROFILE.assignments[0] &&
      window.NJTC_USER_PROFILE.assignments[0].schools &&
      window.NJTC_USER_PROFILE.assignments[0].schools[0]) || '';
    // Build optgroups by phase·domain
    const groups = {};
    _APPR_OJT_DATA.forEach(d => {
      const gk = d.ph + ' · ' + d.dm;
      if (!groups[gk]) groups[gk] = [];
      groups[gk].push(d);
    });
    const opts = Object.entries(groups).map(([g, items]) =>
      `<optgroup label="${esc(g)}">${items.map(d => {
        const label = d.c + ' — ' + d.d + ' [' + d.ph + ' · ' + d.dm + ']';
        return `<option value="${esc(label)}" data-lf="${esc(d.lf)}" data-ph="${esc(d.ph)}" data-dm="${esc(d.dm)}">${esc(label)}</option>`;
      }).join('')}</optgroup>`
    ).join('');
    return `
      <div id="apprOJTForm_${nk}" style="display:none;margin-top:1rem;padding:1rem;background:#fffbf0;border:1px solid #C9A84C44;border-radius:8px">
        <div style="font-size:.75rem;font-weight:700;color:#C9A84C;text-transform:uppercase;letter-spacing:.05em;margin-bottom:.75rem">📋 Log OJT Activity for ${esc(a.name)}</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:.5rem .75rem;margin-bottom:.5rem">
          <div>
            <label style="${lbl}">Observer Name</label>
            <input id="aojt_obs_${nk}" style="${inp}" value="${esc(observerInfo)}" placeholder="Your name">
          </div>
          <div>
            <label style="${lbl}">Observer Role</label>
            <select id="aojt_role_${nk}" style="${inp}">
              <option value="">Select role…</option>
              <option>Instructional Coach (IC)</option>
              <option>Site Coordinator (SC)</option>
              <option>Dual Role (IC + SC)</option>
              <option>Regional Program Manager</option>
            </select>
          </div>
          <div>
            <label style="${lbl}">Site / School</label>
            <input id="aojt_site_${nk}" style="${inp}" value="${esc(siteDefault)}" placeholder="e.g. iLearn Bergen MS">
          </div>
          <div>
            <label style="${lbl}">Program Phase</label>
            <select id="aojt_phase_${nk}" style="${inp}">
              <option value="">Select phase…</option>
              <option>Beginning (Months 1–4)</option>
              <option>Middle (Months 5–8)</option>
              <option>End (Months 9–12)</option>
            </select>
          </div>
          <div>
            <label style="${lbl}">Competency Domain</label>
            <select id="aojt_domain_${nk}" style="${inp}">
              <option value="">Select domain…</option>
              <option>Professionalism</option>
              <option>Instruction</option>
              <option>Environment</option>
              <option>Planning</option>
            </select>
          </div>
          <div style="grid-column:1/-1">
            <label style="${lbl}">Activity — select from OJT checklist</label>
            <select id="aojt_act_${nk}" style="${inp}"
              onchange="(function(s){var o=s.options[s.selectedIndex];var lf=o?o.getAttribute('data-lf'):'';var ph=o?o.getAttribute('data-ph'):'';var dm=o?o.getAttribute('data-dm'):'';
              var lfD=document.getElementById('aojt_lf_${nk}');if(lfD){lfD.innerHTML=lf?'<strong>Look For:</strong> '+lf:'';lfD.style.display=lf?'block':'none';}
              var phS=document.getElementById('aojt_phase_${nk}');var dmS=document.getElementById('aojt_domain_${nk}');
              if(phS&&ph){for(var i=0;i<phS.options.length;i++){if(phS.options[i].value.startsWith(ph)){phS.selectedIndex=i;break;}}}
              if(dmS&&dm){for(var i=0;i<dmS.options.length;i++){if(dmS.options[i].value===dm){dmS.selectedIndex=i;break;}}}
              })(this)">
              <option value="">Select activity…</option>
              ${opts}
            </select>
            <div id="aojt_lf_${nk}" style="display:none;margin-top:5px;padding:6px 8px;background:#fef3c7;border-left:3px solid #C9A84C;border-radius:0 4px 4px 0;font-size:.72rem;color:#78350f;line-height:1.4"></div>
          </div>
          <div style="grid-column:1/-1">
            <label style="${lbl}">Mark This Activity As</label>
            <select id="aojt_mark_${nk}" style="${inp}">
              <option value="Y — Observed and completed">Y — Observed and completed</option>
              <option value="N/A — Not applicable for this apprentice or site">N/A — Not applicable for this apprentice or site</option>
            </select>
          </div>
          <div style="grid-column:1/-1">
            <label style="${lbl}">What did you observe?</label>
            <textarea id="aojt_notes_${nk}" rows="3" placeholder="Describe what you observed. Include specific examples of the apprentice demonstrating the competency…"
              style="${inp}resize:vertical"></textarea>
          </div>
        </div>
        <div style="display:flex;gap:.5rem;align-items:center">
          <button id="aojt_btn_${nk}" onclick="window.apprSubmitOJT('${esc(a.name)}')"
            style="background:#C9A84C;color:#fff;border:none;border-radius:6px;padding:.45rem 1rem;font-size:.78rem;font-weight:600;cursor:pointer">Submit OJT Log</button>
          <span id="aojt_status_${nk}" style="font-size:.74rem;display:block;margin-top:.3rem"></span>
        </div>
      </div>`;
  }

  /* ── apprSubmitOJT: POST directly to Apps Script doPost() ────────────── */
  const _APPR_TAP_WEB_URL = 'https://script.google.com/macros/s/AKfycbyFNwhXOBJ4fbmHxRyiMykx-oZyQd2BPuTHf7GLA9nhFhgBo7EBODEYOmcvbz7FErod/exec';

  window.apprSubmitOJT = async function(apprenticeName) {
    const nk   = (apprenticeName||'').toLowerCase().replace(/[^a-z0-9]/g,'_');
    const get  = id => { const el = document.getElementById(id+'_'+nk); return el ? el.value.trim() : ''; };
    const st   = document.getElementById('aojt_status_'+nk);
    const btnEl= document.getElementById('aojt_btn_'+nk);

    const obs      = get('aojt_obs');
    const role     = get('aojt_role');
    const site     = get('aojt_site');
    const phase    = get('aojt_phase');
    const domain   = get('aojt_domain');
    const activity = get('aojt_act');
    const mark     = get('aojt_mark');
    const notes    = get('aojt_notes');
    const today    = new Date().toISOString().split('T')[0];

    // Hard validation with red borders
    const reqFields = [
      { id: 'aojt_phase',  val: phase,    label: 'Phase'    },
      { id: 'aojt_domain', val: domain,   label: 'Domain'   },
      { id: 'aojt_act',    val: activity, label: 'Activity' },
    ];
    const missing = reqFields.filter(f => !f.val);
    if (missing.length) {
      reqFields.forEach(f => {
        const el = document.getElementById(f.id+'_'+nk);
        if (el) el.style.border = f.val ? '' : '2px solid #ef4444';
      });
      if (st) { st.style.color='#ef4444'; st.style.fontWeight='700'; st.textContent='✗ Required: ' + missing.map(f=>f.label).join(', '); }
      return;
    }
    reqFields.forEach(f => { const el=document.getElementById(f.id+'_'+nk); if(el) el.style.border=''; });

    if (st)    { st.style.color='#6b7280'; st.style.fontWeight='400'; st.textContent='Submitting…'; }
    if (btnEl) { btnEl.disabled=true; btnEl.textContent='Submitting…'; }

    // POST JSON to Apps Script doPost() — writes directly to OTJ sheet
    const payload = {
      logType:       'OJT Activity completion',
      obsDate:       today,
      observerName:  obs,
      observerRole:  role,
      siteLocation:  site,
      apprenticeName: apprenticeName,
      phase:         phase,
      domain:        domain,
      activityCode:  activity,
      status:        mark,
      notes:         notes,
    };
    try {
      await fetch(_APPR_TAP_WEB_URL, {
        method: 'POST', mode: 'no-cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (st)    { st.style.color='#059669'; st.style.fontWeight='700'; st.textContent='✓ Logged. Updates in ~30s.'; }
      if (btnEl) { btnEl.disabled=false; btnEl.textContent='Submit OJT Log'; }
      ['aojt_act','aojt_phase','aojt_domain','aojt_mark','aojt_notes'].forEach(id => {
        const el = document.getElementById(id+'_'+nk); if (el) { el.value=''; el.style.border=''; }
      });
      const lfD = document.getElementById('aojt_lf_'+nk);
      if (lfD) { lfD.innerHTML=''; lfD.style.display='none'; }
      const mk = document.getElementById('aojt_mark_'+nk);
      if (mk) mk.value = 'Y — Observed and completed';
      setTimeout(() => { if (st) st.textContent=''; }, 8000);
    } catch(e) {
      if (st)    { st.style.color='#ef4444'; st.style.fontWeight='700'; st.textContent='Submit failed — check connection.'; }
      if (btnEl) { btnEl.disabled=false; btnEl.textContent='Submit OJT Log'; }
    }
  };

  window.apprOpenProfile = async function(idx) {
    const apps = window._apprApps;
    if (!apps || !apps[idx]) return;
    const a = apps[idx];

    const overlay  = document.getElementById('apprProfileOverlay');
    const content  = document.getElementById('apprProfileContent');
    if (!overlay || !content) return;

    // Show overlay with loading state immediately
    overlay.style.display = 'block';
    const isInactive = (a.adp||'').includes('Terminat');
    const regionBg  = a.region === 'NE' ? '#dbeafe' : '#fef3c7';
    const regionClr = a.region === 'NE' ? '#1e40af' : '#92400e';

    // Find TAP roster entry — first try NJTCTapDash data (from Completion Summary CSV)
    // then fall back to AP_TAP_ROSTER (from old 25-26 tracker)
    const _rawTap = (window._njtcTapRoster && window._njtcTapRoster.apprentices)
      ? window._njtcTapRoster.apprentices
      : (window._tdApprParsed && window._tdApprParsed.apprentices)
        ? window._tdApprParsed.apprentices
        : (window.AP_TAP_ROSTER || []);
    const _tapRaw  = _rawTap.find(r => _apprMatch(r.name || r['Apprentice Full Name'] || '', a.name)) || {};
    // Normalize field names across data sources
    const tapEntry = {
      ojtHours: parseFloat(_tapRaw.ojtHours || _tapRaw['OJT Hours'] || 0),
      rtiHours: parseFloat(_tapRaw.rtiHours || _tapRaw['RTI Hours'] || 0),
      ojtPct:   parseFloat(_tapRaw.ojtPct   || _tapRaw['OJT %']     || 0) / ((_tapRaw['OJT %']||'').includes('%') ? 100 : 1),
      begPct:   (_tapRaw.begPct || _tapRaw['Beg %'] || '0%').toString().replace(/\.?\d+\.\d+%/, p => Math.round(parseFloat(p))+'%'),
      midPct:   (_tapRaw.midPct || _tapRaw['Mid %'] || '0%').toString().replace(/\.?\d+\.\d+%/, p => Math.round(parseFloat(p))+'%'),
      endPct:   (_tapRaw.endPct || _tapRaw['End %'] || '0%').toString().replace(/\.?\d+\.\d+%/, p => Math.round(parseFloat(p))+'%'),
      wage:     parseFloat(_tapRaw.wage  || _tapRaw['Current Wage'] || 30),
      milestone:_tapRaw.milestone || _tapRaw['Next Milestone'] || _tapRaw['Wage Milestone'] || 'Base',
      status:   _tapRaw.status  || _tapRaw['Status'] || '',
      ..._tapRaw,
    };
    const otjPct    = a.otjItems !== null ? Math.round(a.otjItems/LIVE_TRACKER_OTJ_COLS*100) : 0;
    const ringColor = otjPct >= 100 ? '#059669' : otjPct >= 50 ? '#f59e0b' : otjPct > 0 ? '#3b82f6' : '#d1d5db';

    content.innerHTML = `
      <!-- Header -->
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:1.5rem">
        <div>
          <div style="font-size:1.15rem;font-weight:700;color:#1B2A4A;line-height:1.2">${a.name}</div>
          <div style="display:flex;gap:.4rem;flex-wrap:wrap;margin-top:.4rem;align-items:center">
            <span style="background:${regionBg};color:${regionClr};padding:.2rem .55rem;border-radius:5px;font-size:.72rem;font-weight:700">${a.region}</span>
            ${isInactive ? '<span style="background:#fee2e2;color:#991b1b;padding:.2rem .55rem;border-radius:5px;font-size:.72rem;font-weight:700">INACTIVE</span>' : '<span style="background:#d1fae5;color:#065f46;padding:.2rem .55rem;border-radius:5px;font-size:.72rem;font-weight:700">ACTIVE</span>'}
            ${tapEntry.cohort ? `<span style="background:#f3f4f6;color:#374151;padding:.2rem .55rem;border-radius:5px;font-size:.72rem">Cohort: ${tapEntry.cohort}</span>` : ''}
          </div>
        </div>
        <button onclick="apprCloseProfile()" style="background:none;border:1px solid #e5e7eb;border-radius:6px;padding:.3rem .6rem;cursor:pointer;font-size:.85rem;color:#6b7280">✕</button>
      </div>

      <!-- Identity row -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:.5rem 1rem;background:#f9fafb;border-radius:8px;padding:.9rem;margin-bottom:1.5rem;font-size:.8rem">
        <div><span style="color:#9ca3af">District</span><br><strong>${a.district||'—'}</strong></div>
        <div><span style="color:#9ca3af">School</span><br><strong>${a.school||tapEntry.placement||'—'}</strong></div>
        <div><span style="color:#9ca3af">Site Leader</span><br><strong>${a.sl||'—'}</strong></div>
        <div><span style="color:#9ca3af">NJ DOL ID</span><br><strong style="font-family:monospace">${tapEntry.njId||'—'}</strong></div>
        ${tapEntry.dateReg ? `<div><span style="color:#9ca3af">Registered</span><br><strong>${tapEntry.dateReg}</strong></div>` : ''}
        ${tapEntry.folderLink ? `<div><span style="color:#9ca3af">Folder</span><br><a href="${tapEntry.folderLink}" target="_blank" rel="noopener" style="color:#2563eb;text-decoration:none;font-weight:600">Open 📁</a></div>` : ''}
      </div>

      <!-- TAP OTJ Progress -->
      ${_apprSection('TAP Program Progress', '🎓', `
        <div style="display:flex;align-items:center;gap:1.5rem;margin-bottom:1rem;padding:.875rem;background:#1B3A6B;border-radius:8px;color:#fff">
          <div style="text-align:center;flex-shrink:0">
            <div style="font-size:2rem;font-weight:800;color:${(tapEntry.ojtPct||0)>=100?'#34d399':(tapEntry.ojtPct||0)>=75?'#fbbf24':'#f97316'}">${Math.round((tapEntry.ojtPct||0)*100)}%</div>
            <div style="font-size:.68rem;font-weight:700;text-transform:uppercase;letter-spacing:.07em;opacity:.7">OJT Complete</div>
          </div>
          <div style="flex:1;display:grid;grid-template-columns:1fr 1fr;gap:.4rem .875rem">
            <div style="font-size:.75rem;opacity:.7">OJT Hours</div><div style="font-size:.8rem;font-weight:700">${(tapEntry.ojtHours||0).toLocaleString()} / 4,000</div>
            <div style="font-size:.75rem;opacity:.7">RTI Hours</div><div style="font-size:.8rem;font-weight:700">${(tapEntry.rtiHours||0)} / 288</div>
            <div style="font-size:.75rem;opacity:.7">Current Wage</div><div style="font-size:.8rem;font-weight:700">$${(tapEntry.wage||30).toFixed(2)}/hr</div>
            <div style="font-size:.75rem;opacity:.7">Milestone</div><div style="font-size:.8rem;font-weight:700">${tapEntry.milestone||'Base'}</div>
          </div>
        </div>
        <div style="margin-bottom:.75rem">
          <div style="display:flex;justify-content:space-between;font-size:.75rem;margin-bottom:.2rem"><span style="color:#6b7280">Beginning</span><span style="font-weight:700">${tapEntry.begPct||'0%'}</span></div>
          <div style="background:#e5e7eb;border-radius:4px;height:5px"><div style="background:#059669;width:${tapEntry.begPct||'0%'};height:5px;border-radius:4px"></div></div>
        </div>
        <div style="margin-bottom:.75rem">
          <div style="display:flex;justify-content:space-between;font-size:.75rem;margin-bottom:.2rem"><span style="color:#6b7280">Middle</span><span style="font-weight:700">${tapEntry.midPct||'0%'}</span></div>
          <div style="background:#e5e7eb;border-radius:4px;height:5px"><div style="background:#1B3A6B;width:${tapEntry.midPct||'0%'};height:5px;border-radius:4px"></div></div>
        </div>
        <div style="margin-bottom:1rem">
          <div style="display:flex;justify-content:space-between;font-size:.75rem;margin-bottom:.2rem"><span style="color:#6b7280">End</span><span style="font-weight:700">${tapEntry.endPct||'0%'}</span></div>
          <div style="background:#e5e7eb;border-radius:4px;height:5px"><div style="background:#7c3aed;width:${tapEntry.endPct||'0%'};height:5px;border-radius:4px"></div></div>
        </div>
        ${_apprProgressBar(a.otjItems !== null ? a.otjItems : 0, LIVE_TRACKER_OTJ_COLS, ringColor)}
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:.5rem;margin-top:.75rem">
          ${[['Beginning',a.beg],['Middle',a.mid],['End',a.end]].map(([label,val]) => {
            const done = /completed|meets expectations/i.test(val||'');
            const ip   = /in progress|partially/i.test(val||'');
            const bg   = done ? '#d1fae5' : ip ? '#fef3c7' : '#f3f4f6';
            const clr  = done ? '#065f46' : ip ? '#92400e' : '#9ca3af';
            const icon = done ? '✅' : ip ? '🔄' : '⏳';
            return `<div style="background:${bg};border-radius:6px;padding:.5rem;text-align:center">
              <div style="font-size:.78rem;font-weight:700;color:${clr}">${icon} ${label}</div>
              <div style="font-size:.68rem;color:${clr};margin-top:.15rem">${val||'Not Started'}</div>
            </div>`;
          }).join('')}
        </div>
        ${a.notes ? `<div style="margin-top:.75rem;padding:.6rem .75rem;background:#fffbeb;border-radius:6px;font-size:.78rem;color:#92400e"><strong>PM Notes:</strong> ${a.notes}</div>` : ''}
      `)}

      <!-- NEW: Wage & Payout Summary -->
      ${(function() {
        const payout = _apprComputePayout(tapEntry.ojtHours || 0);
        const hasMilestone = (tapEntry.milestone || 'Base') !== 'Base';
        return _apprSection('Wage &amp; Payout Summary', '💰', `
          <div style="display:flex;align-items:center;gap:1.5rem;margin-bottom:1rem;padding:.875rem;background:#166534;border-radius:8px;color:#fff">
            <div style="text-align:center;flex-shrink:0">
              <div style="font-size:1.6rem;font-weight:800">$${payout.totalPay.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}</div>
              <div style="font-size:.68rem;font-weight:700;text-transform:uppercase;letter-spacing:.07em;opacity:.75">Est. Total Paid to Date</div>
            </div>
            <div style="flex:1;display:grid;grid-template-columns:1fr 1fr;gap:.4rem .875rem">
              <div style="font-size:.75rem;opacity:.75">OJT Hours Completed</div><div style="font-size:.8rem;font-weight:700">${payout.totalHours.toLocaleString()} hrs</div>
              <div style="font-size:.75rem;opacity:.75">Milestone Status</div><div style="font-size:.8rem;font-weight:700">${hasMilestone ? '✅ ' + (tapEntry.milestone||'') : '— No increase yet (Base rate)'}</div>
            </div>
          </div>
          <div style="font-size:.68rem;color:#9ca3af;font-style:italic;margin-bottom:.6rem">
            ⚠️ Calculated from the documented wage tier schedule ($30 → $30.98 → $31.99 → $32.99 → $33.99 → $35/hr at 0/1,100/2,200/3,300/3,800/4,000 hrs). Cert-track ($10/hr premium) is NOT distinguished in this data source — reconcile against payroll before using for grant/state reporting.
          </div>
          <table style="width:100%;border-collapse:collapse;font-size:.78rem">
            <thead><tr style="border-bottom:1px solid #e5e7eb">
              <th style="text-align:left;padding:.35rem .2rem;color:#6b7280;font-weight:600">Tier Band</th>
              <th style="text-align:right;padding:.35rem .2rem;color:#6b7280;font-weight:600">Hours in Band</th>
              <th style="text-align:right;padding:.35rem .2rem;color:#6b7280;font-weight:600">Rate</th>
              <th style="text-align:right;padding:.35rem .2rem;color:#6b7280;font-weight:600">Pay</th>
            </tr></thead>
            <tbody>
              ${payout.bands.length ? payout.bands.map(b => `<tr style="border-bottom:1px solid #f3f4f6">
                <td style="padding:.35rem .2rem">${b.label}</td>
                <td style="padding:.35rem .2rem;text-align:right">${b.hours.toLocaleString()}</td>
                <td style="padding:.35rem .2rem;text-align:right">$${b.rate.toFixed(2)}</td>
                <td style="padding:.35rem .2rem;text-align:right;font-weight:700">$${b.pay.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}</td>
              </tr>`).join('') : '<tr><td colspan="4" style="padding:.5rem .2rem;color:#9ca3af;text-align:center">No OJT hours logged yet</td></tr>'}
            </tbody>
          </table>
        `);
      })()}

      <!-- Observations -->
      ${_apprSection('Observations', '👁️', `
        <div style="display:flex;gap:1.25rem;align-items:center;flex-wrap:wrap">
          <div style="text-align:center;background:#f9fafb;border-radius:8px;padding:.75rem 1.25rem">
            <div style="font-size:1.6rem;font-weight:700;color:${a.obsCount>=3?'#059669':a.obsCount>=1?'#d97706':'#9ca3af'}">${a.obsCount}</div>
            <div style="font-size:.72rem;color:#6b7280">Total Obs</div>
          </div>
          ${a.lastObs ? `<div style="font-size:.82rem;color:#374151">Last observation: <strong>${a.lastObs}</strong></div>` : '<div style="font-size:.82rem;color:#9ca3af">No observations on record.</div>'}
          <div style="margin-left:auto;display:flex;gap:.5rem;flex-wrap:wrap;align-items:center">
            ${a.link ? `<a href="${a.link}" target="_blank" rel="noopener" style="background:#1B2A4A;color:#fff;padding:.4rem .8rem;border-radius:6px;text-decoration:none;font-size:.78rem;font-weight:600">OTJ Checklist 📁</a>` : ''}
            <button onclick="document.getElementById('apprOJTForm_${(a.name||'').toLowerCase().replace(/[^a-z0-9]/g,'_')}').style.display=document.getElementById('apprOJTForm_${(a.name||'').toLowerCase().replace(/[^a-z0-9]/g,'_')}').style.display==='none'?'block':'none'"
              style="background:#C9A84C;color:#fff;border:none;border-radius:6px;padding:.4rem .8rem;font-size:.78rem;font-weight:600;cursor:pointer">📋 Log OJT Activity</button>
          </div>
        </div>
        ${_apprOjtFormHtml(a)}
      `)}

      <!-- Live data loading placeholder -->
      <div id="apprProfileLiveData">
        <div style="padding:1.5rem;text-align:center;color:#9ca3af;font-size:.85rem">
          <div style="font-size:1.2rem;margin-bottom:.5rem">⏳</div>
          Loading Pearl operations &amp; academic data…
        </div>
      </div>`;

    overlay.style.display = 'block';

    // Fetch Pearl ATT + STU in parallel, then populate live data section
    try {
      const [attRows, stuRows] = await Promise.all([
        _apprFetchPearlRows(_APPR_ATT_GID, 'Pearl ATT'),
        _apprFetchPearlRows(_APPR_STU_GID, 'Pearl STU'),
      ]);

      // ── Attendance ──────────────────────────────────────────────────
      let attended = 0, missed = 0;
      const missReasons = {};
      attRows.forEach(row => {
        const keys = Object.keys(row);
        const role = (row['Role'] || row[keys[1]] || '').trim();
        if (role !== 'Instructor') return;
        const userName = (row['User'] || row[keys[0]] || '').trim();
        if (!_apprMatch(userName, a.name)) return;
        const status = (row['Attendance Status'] || row[keys[6]] || '').trim();
        if (status === 'Attended' || status === 'Late') {
          attended++;
        } else if (status === 'Missed') {
          const reason = (row['Miss Reason'] || row['Absence Reason'] || row[keys[7]] || '').trim();
          if (_APPR_TUTOR_MISS.has(reason)) {
            missed++;
            if (reason) missReasons[reason] = (missReasons[reason] || 0) + 1;
          }
        }
      });
      const total   = attended + missed;
      const attRate = total > 0 ? (attended / total * 100).toFixed(1) : null;
      const attColor = attRate === null ? '#9ca3af' : attRate >= 90 ? '#059669' : attRate >= 75 ? '#f59e0b' : '#ef4444';

      // ── Surveys ──────────────────────────────────────────────────────
      const sConf = [], sEnj = [], sLearn = [], sOvr = [];
      stuRows.forEach(row => {
        const keys      = Object.keys(row);
        const filledFor = (row['Filled For'] || row[keys[1]] || '').trim();
        if (!_apprMatch(filledFor, a.name)) return;
        const parseV = v => { const n = parseFloat(v); return isNaN(n) ? null : n; };
        const conf  = parseV(row['How confident do you feel about what you are learning?']     || row[keys[2]]);
        const enj   = parseV(row['How much did you enjoy this session with <aboutName>?']       || row['How much did you enjoy this session with &lt;aboutName&gt;?'] || row[keys[3]]);
        const learn = parseV(row['How much did you learn in this session?']                      || row[keys[4]]);
        const ovr   = parseV(row['How would you rate this session overall?']                     || row[keys[5]]);
        if (conf  !== null) sConf.push(conf);
        if (enj   !== null) sEnj.push(enj);
        if (learn !== null) sLearn.push(learn);
        if (ovr   !== null) sOvr.push(ovr);
      });
      const avgArr = arr => arr.length ? arr.reduce((s,v)=>s+v,0)/arr.length : null;
      const surveyCount = sConf.length || sEnj.length || sLearn.length || sOvr.length;
      const aConf = avgArr(sConf), aEnj = avgArr(sEnj), aLearn = avgArr(sLearn), aOvr = avgArr(sOvr);

      // ── iReady from IRLAB ─────────────────────────────────────────────
      let irlEla = [], irlMath = [];
      if (window.irlab && typeof window.irlab.getAllRows === 'function') {
        const normN = s => (s||'').toLowerCase().replace(/\s+/g,' ').trim();
        const schoolKey = a.school || tapEntry.placement || '';
        irlEla  = window.irlab.getAllRows({ subject: 'ELA',  year: 'all' }).filter(r => {
          if (_apprMatch(r.instructor || '', a.name)) return true;
          if (r.tutors && Array.isArray(r.tutors) && r.tutors.some(t => _apprMatch(t, a.name))) return true;
          return false;
        });
        irlMath = window.irlab.getAllRows({ subject: 'Math', year: 'all' }).filter(r => {
          if (_apprMatch(r.instructor || '', a.name)) return true;
          if (r.tutors && Array.isArray(r.tutors) && r.tutors.some(t => _apprMatch(t, a.name))) return true;
          return false;
        });
      }

      function _irlAggregate(rows) {
        if (!rows || !rows.length) return null;
        const scholars = rows.length;
        const withBoth = rows.filter(r => r.baseScore !== null && r.springScore !== null);
        const gains    = withBoth.map(r => r.springScore - r.baseScore);
        const improved = gains.filter(g => g > 0).length;
        const avgGain  = gains.length ? gains.reduce((s,v)=>s+v,0)/gains.length : null;
        const pctTypArr= rows.map(r => r.pctTypical).filter(v => v !== null && v !== undefined && !isNaN(v));
        const medPct   = pctTypArr.length ? pctTypArr.sort((a,b)=>a-b)[Math.floor(pctTypArr.length/2)] : null;
        // Placement movement
        const placed = rows.filter(r => r.baseRelPlacement && r.springRelPlacement);
        const placMoved = placed.filter(r => {
          const ORDER = ['3 or More Grade Levels Below','2 Grade Levels Below','1 Grade Level Below','Early On Grade Level','Mid or Above Grade Level'];
          return ORDER.indexOf(r.springRelPlacement) > ORDER.indexOf(r.baseRelPlacement);
        }).length;
        return { scholars, withBoth: withBoth.length, improved, total: gains.length,
                 avgGain, medPct, placMoved, placed: placed.length };
      }

      const elaAgg  = _irlAggregate(irlEla);
      const mathAgg = _irlAggregate(irlMath);

      function _irlBlock(label, agg) {
        if (!agg || agg.scholars === 0) return `<div style="background:#f9fafb;border-radius:8px;padding:.75rem;text-align:center;color:#9ca3af;font-size:.78rem">${label}: No data linked</div>`;
        const gainColor = agg.avgGain === null ? '#9ca3af' : agg.avgGain >= 5 ? '#059669' : agg.avgGain >= 0 ? '#f59e0b' : '#ef4444';
        const pctLabel  = agg.medPct !== null ? (agg.medPct > 0 && agg.medPct <= 2 ? Math.round(agg.medPct*100)+'%' : Math.round(agg.medPct)+'%') : '—';
        return `<div style="background:#f9fafb;border-radius:8px;padding:.85rem;flex:1">
          <div style="font-weight:700;color:#1B2A4A;font-size:.8rem;margin-bottom:.6rem">${label}</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:.4rem;font-size:.77rem">
            <div><span style="color:#9ca3af">Scholars</span><br><strong>${agg.scholars}</strong></div>
            <div><span style="color:#9ca3af">With BOY+EOY</span><br><strong>${agg.withBoth}</strong></div>
            <div><span style="color:#9ca3af">Avg Scale Gain</span><br><strong style="color:${gainColor}">${agg.avgGain !== null ? agg.avgGain.toFixed(1) : '—'}</strong></div>
            <div><span style="color:#9ca3af">Median % Typical</span><br><strong>${pctLabel}</strong></div>
            ${agg.total > 0 ? `<div><span style="color:#9ca3af">Improved</span><br><strong style="color:#059669">${agg.improved}/${agg.total} (${Math.round(agg.improved/agg.total*100)}%)</strong></div>` : ''}
            ${agg.placed > 0 ? `<div><span style="color:#9ca3af">Placement Moved Up</span><br><strong>${agg.placMoved}/${agg.placed}</strong></div>` : ''}
          </div>
        </div>`;
      }

      const liveHTML = `
        ${_apprSection('Pearl Operations — Attendance', '📊', `
          <div style="display:flex;gap:1.25rem;align-items:center;flex-wrap:wrap">
            <div style="text-align:center;background:#f9fafb;border-radius:8px;padding:.7rem 1rem;min-width:90px">
              <div style="font-size:1.5rem;font-weight:700;color:${attColor}">${attRate !== null ? attRate+'%' : '—'}</div>
              <div style="font-size:.7rem;color:#6b7280">Att. Rate</div>
            </div>
            <div style="display:grid;grid-template-columns:auto auto;gap:.25rem .75rem;font-size:.8rem">
              <span style="color:#9ca3af">Sessions Attended</span><strong>${attended}</strong>
              <span style="color:#9ca3af">Personal Absences</span><strong style="color:${missed>0?'#f59e0b':'#374151'}">${missed}</strong>
              <span style="color:#9ca3af">Total Countable</span><strong>${total}</strong>
            </div>
          </div>
          ${Object.keys(missReasons).length ? `
            <div style="margin-top:.75rem;font-size:.75rem">
              <div style="color:#9ca3af;margin-bottom:.35rem">Absence Reasons</div>
              ${Object.entries(missReasons).map(([r,n]) => `<div style="display:flex;justify-content:space-between;padding:.2rem 0;border-bottom:1px solid #f3f4f6"><span>${r}</span><strong>${n}</strong></div>`).join('')}
            </div>` : ''}
        `)}

        ${_apprSection('Scholar Survey Scores', '⭐', surveyCount > 0 ? `
          <div style="font-size:.72rem;color:#9ca3af;margin-bottom:.6rem">${surveyCount} survey response${surveyCount!==1?'s':''}</div>
          <div style="display:grid;gap:.5rem">
            <div><span style="font-size:.78rem;color:#374151">Confidence</span>${_apprRatingBar(aConf, 5)}</div>
            <div><span style="font-size:.78rem;color:#374151">Enjoyment</span>${_apprRatingBar(aEnj, 5)}</div>
            <div><span style="font-size:.78rem;color:#374151">Learning</span>${_apprRatingBar(aLearn, 5)}</div>
            <div><span style="font-size:.78rem;color:#374151">Overall</span>${_apprRatingBar(aOvr, 5)}</div>
          </div>` : '<div style="color:#9ca3af;font-size:.82rem">No survey data found for this tutor.</div>'
        )}

        ${_apprSection('iReady Academic Outcomes', '📈',
          (elaAgg || mathAgg)
            ? `<div style="display:flex;gap:.75rem;flex-wrap:wrap">${_irlBlock('ELA', elaAgg)}${_irlBlock('Math', mathAgg)}</div>`
            : '<div style="color:#9ca3af;font-size:.82rem">iReady data not yet loaded. Open the iReady Analysis Lab tab first, then re-open this profile.</div>'
        )}`;

      const liveEl = document.getElementById('apprProfileLiveData');
      if (liveEl) liveEl.innerHTML = liveHTML;

    } catch (err) {
      const liveEl = document.getElementById('apprProfileLiveData');
      if (liveEl) liveEl.innerHTML = `<div style="padding:1rem;background:#fef2f2;border-radius:8px;font-size:.82rem;color:#991b1b">Could not load live data: ${err.message}</div>`;
    }
  };









  // ══════════════════════════════════════════════════════════════════
  //  SUB-TAB: FIELD INTEL — Survey & Cohort Performance Intelligence
  // ══════════════════════════════════════════════════════════════════

  function renderSurveyIntelTab() {
    const el = document.getElementById('td-content-survey-intel');
    if (!el) return;
    el.innerHTML = '<div style="padding:2rem;text-align:center;color:#64748b;font-size:.875rem">Loading Field Intel…</div>';

    try {
      const po = window.po;
      if (!po) {
        el.innerHTML = '<div style="padding:2rem;text-align:center;color:#64748b">Pearl Operations data not available.</div>';
        return;
      }

      // ── Data Collection ──────────────────────────────────────────────
      const schools        = po.getStellarSchools      ? po.getStellarSchools()           : [];
      const leaderData     = po.getLeadershipData      ? po.getLeadershipData()            : {};
      const tutorSessions  = po.getTutorSessionStats   ? po.getTutorSessionStats()         : [];
      const concerns       = po.getCommentsByCategory  ? po.getCommentsByCategory('concern')  : [];
      const positives      = po.getCommentsByCategory  ? po.getCommentsByCategory('positive') : [];

      // ── Program Pulse ────────────────────────────────────────────────
      const schoolsWithSurvey    = schools.filter(s => s.surveyAvg != null);
      const schoolsWithInst      = schools.filter(s => s.instSurveyAvg != null);
      const avgSurvey    = schoolsWithSurvey.length
        ? schoolsWithSurvey.reduce((a,s) => a + s.surveyAvg, 0) / schoolsWithSurvey.length : null;
      const avgInstSurvey = schoolsWithInst.length
        ? schoolsWithInst.reduce((a,s) => a + s.instSurveyAvg, 0) / schoolsWithInst.length : null;
      // Weighted by each school's actual scholar attendance/absence counts,
      // not a plain mean of already-rounded per-school rates — an unweighted
      // mean lets a small site swing the program-wide number as much as a
      // large one.
      const attWeighted = schools.reduce((acc, s) => {
        acc.att += s.stuAttended || 0;
        acc.abs += s.stuAbsent || 0;
        return acc;
      }, { att: 0, abs: 0 });
      const avgAtt = (attWeighted.att + attWeighted.abs) > 0
        ? (attWeighted.att / (attWeighted.att + attWeighted.abs)) * 100 : null;
      const schoolsNeedingAction = schools.filter(s =>
        (s.attRate  != null && s.attRate  < 80) ||
        (s.surveyAvg!= null && s.surveyAvg < 3.5) ||
        (s.flags && s.flags.length > 0)
      );
      // weeklyTrend from getLeadershipData() is an array of {week, rate, total} — compute delta
      const weeklyTrendArr = leaderData.weeklyTrend || [];
      const weeklyTrend = (() => {
        if (weeklyTrendArr.length < 2) return null;
        const prev = weeklyTrendArr[weeklyTrendArr.length - 2];
        const last = weeklyTrendArr[weeklyTrendArr.length - 1];
        return last.rate - prev.rate;
      })();
      const districts   = leaderData.districts || [];

      // ── Sessions That Can Benefit From Support ───────────────────────
      // Group tutors by the school cohort they're assigned to
      const sessionMap = {};
      tutorSessions.forEach(t => {
        const schoolList = Array.isArray(t.schools) ? t.schools : [t.school || 'Unknown'];
        schoolList.forEach(school => {
          if (!sessionMap[school]) sessionMap[school] = { school, tutors: [], surveys: [], attRates: [], sessionIds: [] };
          const nm = t.name || t.tutor || '';
          if (nm) sessionMap[school].tutors.push(nm);
          if (t.surveyAvg != null) sessionMap[school].surveys.push(t.surveyAvg);
          if (t.attRate   != null) sessionMap[school].attRates.push(t.attRate);
          if (t.sessionId)         sessionMap[school].sessionIds.push(t.sessionId);
        });
      });

      const allSessions = Object.values(sessionMap).map(s => ({
        ...s,
        avgSurvey: s.surveys.length  ? s.surveys.reduce((a,v)=>a+v,0)/s.surveys.length   : null,
        avgAtt:    s.attRates.length ? s.attRates.reduce((a,v)=>a+v,0)/s.attRates.length : null,
      })).filter(s => s.tutors.length > 0);

      const sessionsNeedingSupport = allSessions
        .filter(s => (s.avgSurvey != null && s.avgSurvey < 3.8) || (s.avgAtt != null && s.avgAtt < 80))
        .sort((a, b) => {
          // Rank by combined severity score (lower = worse)
          const scoreA = (a.avgSurvey != null ? a.avgSurvey : 5) + (a.avgAtt != null ? a.avgAtt/20 : 5);
          const scoreB = (b.avgSurvey != null ? b.avgSurvey : 5) + (b.avgAtt != null ? b.avgAtt/20 : 5);
          return scoreA - scoreB;
        });

      // ── Colour helpers ───────────────────────────────────────────────
      function sColor(v) {
        if (v == null) return '#94a3b8';
        if (v >= 4.5)  return '#059669';
        if (v >= 4.0)  return '#1d4ed8';
        if (v >= 3.5)  return '#d97706';
        return '#dc2626';
      }
      function aColor(v) {
        if (v == null) return '#94a3b8';
        if (v >= 90) return '#059669';
        if (v >= 80) return '#1d4ed8';
        if (v >= 70) return '#d97706';
        return '#dc2626';
      }

      // ── Render ───────────────────────────────────────────────────────
      el.innerHTML = `
        <!-- Header row -->
        <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:.5rem;margin-bottom:1.25rem">
          <div>
            <div style="font-size:1.05rem;font-weight:700;color:#0a1628">🗺️ Field Intelligence — Survey &amp; Performance</div>
            <div style="font-size:.75rem;color:#64748b;margin-top:.15rem">Live Pearl Operations data · Identifies sites, districts &amp; sessions needing T&amp;D attention</div>
          </div>
          <button onclick="window._tdLoaded&&(delete window._tdLoaded['survey-intel']);renderSurveyIntelTab()"
            style="font-size:.72rem;font-weight:600;padding:.3rem .75rem;border-radius:8px;border:1.5px solid #e2e8f0;background:#fff;cursor:pointer;color:#374151">↺ Refresh</button>
        </div>

        <!-- ── Section 1: Program Pulse ──────────────────────────────────── -->
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(138px,1fr));gap:.625rem;margin-bottom:1.5rem">
          ${[
            { label:'Avg Survey',      val: avgSurvey!=null     ? avgSurvey.toFixed(2)      : '—', sub:'Program-wide',     color: sColor(avgSurvey) },
            { label:'Avg Instructional',val:avgInstSurvey!=null ? avgInstSurvey.toFixed(2)  : '—', sub:'Instruction quality',color:sColor(avgInstSurvey) },
            { label:'Avg Attendance',  val: avgAtt!=null        ? avgAtt.toFixed(1)+'%'     : '—', sub:'All sites',         color: aColor(avgAtt) },
            { label:'Sites Need Action',val:schoolsNeedingAction.length, sub: schools.length?'of '+schools.length+' sites':'—', color:schoolsNeedingAction.length>0?'#dc2626':'#059669' },
            { label:'Sessions Queued', val: sessionsNeedingSupport.length, sub:'need support',    color:sessionsNeedingSupport.length>0?'#d97706':'#059669' },
            { label:'W-o-W Trend',     val: weeklyTrend!=null ? (weeklyTrend>0?'+':'')+weeklyTrend+'%' : '—', sub:'vs last week', color:weeklyTrend!=null?(weeklyTrend>=0?'#059669':'#dc2626'):'#94a3b8' },
          ].map(k => `
            <div style="background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:.75rem .875rem;text-align:center">
              <div style="font-size:1.375rem;font-weight:800;color:${k.color};line-height:1.1">${k.val}</div>
              <div style="font-size:.6875rem;font-weight:700;color:#374151;margin-top:.3rem">${k.label}</div>
              <div style="font-size:.6rem;color:#94a3b8;margin-top:.1rem">${k.sub}</div>
            </div>
          `).join('')}
        </div>

        <!-- ── Section 2: District Health Grid ───────────────────────────── -->
        ${districts.length ? `
        <div style="background:#fff;border:1px solid #e2e8f0;border-radius:12px;margin-bottom:1.25rem;overflow:hidden">
          <div style="padding:.65rem 1rem;border-bottom:1px solid #f1f5f9;display:flex;align-items:center;justify-content:space-between">
            <div style="font-size:.6875rem;font-weight:800;text-transform:uppercase;letter-spacing:.08em;color:#475569">District Health Grid</div>
            <div style="font-size:.6875rem;color:#94a3b8">${districts.length} districts</div>
          </div>
          <div style="overflow-x:auto">
            <table style="width:100%;border-collapse:collapse">
              <thead>
                <tr style="background:#f8fafc">
                  <th style="text-align:left;padding:.4rem .75rem;font-size:.6875rem;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.05em">District</th>
                  <th style="text-align:center;padding:.4rem .5rem;font-size:.6875rem;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.05em">Scholar Att%</th>
                  <th style="text-align:center;padding:.4rem .5rem;font-size:.6875rem;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.05em">Tutor Att%</th>
                  <th style="text-align:center;padding:.4rem .5rem;font-size:.6875rem;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.05em">Scholars</th>
                  <th style="text-align:center;padding:.4rem .5rem;font-size:.6875rem;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.05em">Sessions</th>
                  <th style="text-align:center;padding:.4rem .5rem;font-size:.6875rem;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.05em">Status</th>
                </tr>
              </thead>
              <tbody>
                ${[...districts].sort((a,b) => (a.scholarRate||0) - (b.scholarRate||0)).map(d => {
                  const sr = d.scholarRate != null ? d.scholarRate : null;
                  const tr = d.tutorRate   != null ? d.tutorRate   : null;
                  const statusLabel = sr == null ? 'No Data' : sr >= 80 ? 'On Track' : sr >= 70 ? 'At Risk' : 'Needs Action';
                  const statusColor = sr == null ? '#94a3b8'   : sr >= 80 ? '#059669' : sr >= 70 ? '#d97706' : '#dc2626';
                  const statusBg    = sr == null ? '#f8fafc'   : sr >= 80 ? '#f0fdf4' : sr >= 70 ? '#fffbeb' : '#fef2f2';
                  return `<tr style="border-bottom:1px solid #f1f5f9">
                    <td style="padding:.45rem .75rem;font-size:.8125rem;font-weight:600;color:#1e293b">${d.name||'—'}</td>
                    <td style="padding:.45rem .5rem;text-align:center;font-size:.8rem;font-weight:700;color:${aColor(sr)}">${sr!=null?sr+'%':'—'}</td>
                    <td style="padding:.45rem .5rem;text-align:center;font-size:.8rem;font-weight:700;color:${aColor(tr)}">${tr!=null?tr+'%':'—'}</td>
                    <td style="padding:.45rem .5rem;text-align:center;font-size:.75rem;color:#374151">${d.scholars!=null?d.scholars:'—'}</td>
                    <td style="padding:.45rem .5rem;text-align:center;font-size:.75rem;color:#374151">${d.sessions!=null?d.sessions:'—'}</td>
                    <td style="padding:.45rem .5rem;text-align:center"><span style="font-size:.6875rem;font-weight:700;padding:.15rem .5rem;border-radius:999px;color:${statusColor};background:${statusBg}">${statusLabel}</span></td>
                  </tr>`;
                }).join('')}
              </tbody>
            </table>
          </div>
        </div>` : ''}

        <!-- ── Section 3: T&D Action Queue ────────────────────────────────── -->
        ${schoolsNeedingAction.length ? `
        <div style="background:#fff;border:1px solid #fecaca;border-radius:12px;margin-bottom:1.25rem;overflow:hidden">
          <div style="padding:.65rem 1rem;background:#fef2f2;border-bottom:1px solid #fecaca;display:flex;align-items:center;justify-content:space-between">
            <div style="font-size:.6875rem;font-weight:800;text-transform:uppercase;letter-spacing:.08em;color:#b91c1c">⚠ T&amp;D Action Queue — ${schoolsNeedingAction.length} Site${schoolsNeedingAction.length>1?'s':''}</div>
            <div style="font-size:.6875rem;color:#b91c1c">Low attendance or survey score</div>
          </div>
          <div style="overflow-x:auto">
            <table style="width:100%;border-collapse:collapse">
              <thead>
                <tr style="background:#f8fafc">
                  <th style="text-align:left;padding:.4rem .75rem;font-size:.6875rem;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.05em">School</th>
                  <th style="text-align:left;padding:.4rem .5rem;font-size:.6875rem;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.05em">District</th>
                  <th style="text-align:center;padding:.4rem .5rem;font-size:.6875rem;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.05em">Att%</th>
                  <th style="text-align:center;padding:.4rem .5rem;font-size:.6875rem;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.05em">Survey</th>
                  <th style="text-align:center;padding:.4rem .5rem;font-size:.6875rem;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.05em">Inst Survey</th>
                  <th style="text-align:left;padding:.4rem .5rem;font-size:.6875rem;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.05em">Flags</th>
                </tr>
              </thead>
              <tbody>
                ${[...schoolsNeedingAction].sort((a,b) => {
                  const sa = (a.attRate||100)/20 + (a.surveyAvg||5);
                  const sb = (b.attRate||100)/20 + (b.surveyAvg||5);
                  return sa - sb;
                }).map(s => `
                <tr style="border-bottom:1px solid #f1f5f9">
                  <td style="padding:.45rem .75rem;font-size:.8rem;font-weight:600;color:#1e293b;max-width:180px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${s.school||'—'}</td>
                  <td style="padding:.45rem .5rem;font-size:.72rem;color:#64748b">${s.district||'—'}</td>
                  <td style="padding:.45rem .5rem;text-align:center;font-size:.8rem;font-weight:700;color:${aColor(s.attRate)}">${s.attRate!=null?s.attRate.toFixed(1)+'%':'—'}</td>
                  <td style="padding:.45rem .5rem;text-align:center;font-size:.8rem;font-weight:700;color:${sColor(s.surveyAvg)}">${s.surveyAvg!=null?s.surveyAvg.toFixed(2):'—'}</td>
                  <td style="padding:.45rem .5rem;text-align:center;font-size:.8rem;font-weight:700;color:${sColor(s.instSurveyAvg)}">${s.instSurveyAvg!=null?s.instSurveyAvg.toFixed(2):'—'}</td>
                  <td style="padding:.45rem .5rem;font-size:.6875rem;color:#dc2626" title="${(s.flagDetails||s.flags||[]).join(' · ')}">${(s.flags||[]).join(', ')||'—'}</td>
                </tr>`).join('')}
              </tbody>
            </table>
          </div>
        </div>` : `
        <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:.875rem 1rem;margin-bottom:1.25rem;font-size:.8125rem;color:#166534;font-weight:600">
          ✅ No sites currently flagged for T&amp;D intervention — all sites meeting attendance &amp; survey thresholds.
        </div>`}

        <!-- ── Section 4: Sessions That Can Benefit From Support ─────────── -->
        <div style="background:#fff;border:1px solid #e2e8f0;border-radius:12px;margin-bottom:1.25rem;overflow:hidden">
          <div style="padding:.65rem 1rem;border-bottom:1px solid #f1f5f9;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:.5rem">
            <div>
              <div style="font-size:.6875rem;font-weight:800;text-transform:uppercase;letter-spacing:.08em;color:#475569">Sessions That Can Benefit From Support</div>
              <div style="font-size:.625rem;color:#94a3b8;margin-top:.1rem">Cohort/group-level · Session IDs tie surveys to tutor performance</div>
            </div>
            <div style="font-size:.6875rem;color:#94a3b8">${sessionsNeedingSupport.length} of ${allSessions.length} session groups flagged</div>
          </div>
          ${sessionsNeedingSupport.length ? `
          <div style="overflow-x:auto">
            <table style="width:100%;border-collapse:collapse">
              <thead>
                <tr style="background:#f8fafc">
                  <th style="text-align:left;padding:.4rem .75rem;font-size:.6875rem;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.05em">School / Site</th>
                  <th style="text-align:left;padding:.4rem .5rem;font-size:.6875rem;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.05em">Tutors Assigned</th>
                  <th style="text-align:center;padding:.4rem .5rem;font-size:.6875rem;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.05em">Avg Survey</th>
                  <th style="text-align:center;padding:.4rem .5rem;font-size:.6875rem;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.05em">Avg Att%</th>
                  <th style="text-align:left;padding:.4rem .5rem;font-size:.6875rem;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.05em">Session IDs</th>
                  <th style="text-align:center;padding:.4rem .5rem;font-size:.6875rem;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.05em">Priority</th>
                </tr>
              </thead>
              <tbody>
                ${sessionsNeedingSupport.map(s => {
                  const lowSurvey = s.avgSurvey != null && s.avgSurvey < 3.5;
                  const lowAtt    = s.avgAtt    != null && s.avgAtt    < 75;
                  const priority  = (lowSurvey && lowAtt) ? 'Critical' : (lowSurvey || lowAtt) ? 'High' : 'Monitor';
                  const pColor    = priority==='Critical'?'#dc2626':priority==='High'?'#d97706':'#1d4ed8';
                  const pBg       = priority==='Critical'?'#fef2f2':priority==='High'?'#fffbeb':'#eff6ff';
                  const tutorList = (s.tutors||[]).slice(0,3).join(', ') + (s.tutors.length > 3 ? ' +' + (s.tutors.length-3) + ' more' : '');
                  const sidList   = (s.sessionIds||[]).slice(0,3).join(', ') + (s.sessionIds.length > 3 ? '…' : '');
                  return `<tr style="border-bottom:1px solid #f1f5f9">
                    <td style="padding:.45rem .75rem;font-size:.8rem;font-weight:600;color:#1e293b;max-width:165px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis" title="${s.school||''}">${s.school||'—'}</td>
                    <td style="padding:.45rem .5rem;font-size:.72rem;color:#374151;max-width:160px">${tutorList||'—'}</td>
                    <td style="padding:.45rem .5rem;text-align:center;font-size:.8rem;font-weight:700;color:${sColor(s.avgSurvey)}">${s.avgSurvey!=null?s.avgSurvey.toFixed(2):'—'}</td>
                    <td style="padding:.45rem .5rem;text-align:center;font-size:.8rem;font-weight:700;color:${aColor(s.avgAtt)}">${s.avgAtt!=null?s.avgAtt.toFixed(1)+'%':'—'}</td>
                    <td style="padding:.45rem .5rem;font-size:.68rem;color:#94a3b8;font-family:monospace">${sidList||'—'}</td>
                    <td style="padding:.45rem .5rem;text-align:center"><span style="font-size:.6875rem;font-weight:700;padding:.15rem .5rem;border-radius:999px;color:${pColor};background:${pBg}">${priority}</span></td>
                  </tr>`;
                }).join('')}
              </tbody>
            </table>
          </div>` : `
          <div style="padding:1.5rem;text-align:center;color:#059669;font-size:.875rem;font-weight:600">
            ✅ All session groups are meeting performance benchmarks
          </div>`}
        </div>

        <!-- ── Section 5: Scholar Voice ─────────────────────────────────── -->
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;margin-bottom:1.25rem">
          <!-- Concerns -->
          <div style="background:#fff;border:1px solid #fecaca;border-radius:12px;overflow:hidden">
            <div style="padding:.6rem 1rem;background:#fef2f2;border-bottom:1px solid #fecaca">
              <div style="font-size:.6875rem;font-weight:800;text-transform:uppercase;letter-spacing:.08em;color:#b91c1c">⚠ Operational Concerns (${concerns.length})</div>
            </div>
            <div style="padding:.75rem;max-height:260px;overflow-y:auto;display:flex;flex-direction:column;gap:.5rem">
              ${concerns.length ? concerns.slice(0,8).map(c => `
                <div style="background:#fef9f9;border:1px solid #fee2e2;border-radius:8px;padding:.5rem .75rem">
                  <div style="font-size:.75rem;color:#374151;line-height:1.45;font-style:italic">"${((c.text||c.comment||'')).substring(0,130)}${(c.text||c.comment||'').length>130?'…':''}"</div>
                  <div style="font-size:.625rem;color:#94a3b8;margin-top:.2rem">${c.school||c.site||''} · ${c.date||''}</div>
                </div>
              `).join('') : '<div style="font-size:.8rem;color:#94a3b8;padding:.5rem;text-align:center">No concerns flagged</div>'}
            </div>
          </div>
          <!-- Spotlights -->
          <div style="background:#fff;border:1px solid #bbf7d0;border-radius:12px;overflow:hidden">
            <div style="padding:.6rem 1rem;background:#f0fdf4;border-bottom:1px solid #bbf7d0">
              <div style="font-size:.6875rem;font-weight:800;text-transform:uppercase;letter-spacing:.08em;color:#166534">✨ Positive Spotlights (${positives.length})</div>
            </div>
            <div style="padding:.75rem;max-height:260px;overflow-y:auto;display:flex;flex-direction:column;gap:.5rem">
              ${positives.length ? positives.slice(0,8).map(c => `
                <div style="background:#f8fffe;border:1px solid #d1fae5;border-radius:8px;padding:.5rem .75rem">
                  <div style="font-size:.75rem;color:#374151;line-height:1.45;font-style:italic">"${((c.text||c.comment||'')).substring(0,130)}${(c.text||c.comment||'').length>130?'…':''}"</div>
                  <div style="font-size:.625rem;color:#94a3b8;margin-top:.2rem">${c.school||c.site||''} · ${c.date||''}</div>
                </div>
              `).join('') : '<div style="font-size:.8rem;color:#94a3b8;padding:.5rem;text-align:center">No spotlight comments available</div>'}
            </div>
          </div>
        </div>

        <!-- ── Section 6: All Schools — Full Survey & Attendance Table ─────── -->
        ${schools.length ? `
        <div style="background:#fff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden">
          <div style="padding:.65rem 1rem;border-bottom:1px solid #f1f5f9;display:flex;align-items:center;justify-content:space-between">
            <div style="font-size:.6875rem;font-weight:800;text-transform:uppercase;letter-spacing:.08em;color:#475569">All Schools — Survey &amp; Attendance</div>
            <div style="font-size:.6875rem;color:#94a3b8">${schools.length} schools · sorted by performance</div>
          </div>
          <div style="overflow-x:auto">
            <table style="width:100%;border-collapse:collapse">
              <thead>
                <tr style="background:#f8fafc">
                  <th style="text-align:left;padding:.4rem .75rem;font-size:.6875rem;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.05em">School</th>
                  <th style="text-align:left;padding:.4rem .5rem;font-size:.6875rem;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.05em">District</th>
                  <th style="text-align:center;padding:.4rem .5rem;font-size:.6875rem;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.05em">Att%</th>
                  <th style="text-align:center;padding:.4rem .5rem;font-size:.6875rem;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.05em">Survey</th>
                  <th style="text-align:center;padding:.4rem .5rem;font-size:.6875rem;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.05em">Inst Survey</th>
                  <th style="text-align:center;padding:.4rem .5rem;font-size:.6875rem;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.05em">Sessions</th>
                  <th style="text-align:center;padding:.4rem .5rem;font-size:.6875rem;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.05em">Survey Count</th>
                </tr>
              </thead>
              <tbody>
                ${[...schools].sort((a,b) => {
                  const sa = (a.attRate||100)/20 + (a.surveyAvg||5);
                  const sb = (b.attRate||100)/20 + (b.surveyAvg||5);
                  return sa - sb;
                }).map(s => `
                <tr style="border-bottom:1px solid #f1f5f9">
                  <td style="padding:.45rem .75rem;font-size:.8rem;font-weight:600;color:#1e293b;max-width:180px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis" title="${s.school||''}">${s.school||'—'}</td>
                  <td style="padding:.45rem .5rem;font-size:.72rem;color:#64748b;max-width:150px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${s.district||'—'}</td>
                  <td style="padding:.45rem .5rem;text-align:center;font-size:.8rem;font-weight:700;color:${aColor(s.attRate)}">${s.attRate!=null?s.attRate.toFixed(1)+'%':'—'}</td>
                  <td style="padding:.45rem .5rem;text-align:center;font-size:.8rem;font-weight:700;color:${sColor(s.surveyAvg)}">${s.surveyAvg!=null?s.surveyAvg.toFixed(2):'—'}</td>
                  <td style="padding:.45rem .5rem;text-align:center;font-size:.8rem;font-weight:700;color:${sColor(s.instSurveyAvg)}">${s.instSurveyAvg!=null?s.instSurveyAvg.toFixed(2):'—'}</td>
                  <td style="padding:.45rem .5rem;text-align:center;font-size:.75rem;color:#64748b">${s.sessions!=null?s.sessions:'—'}</td>
                  <td style="padding:.45rem .5rem;text-align:center;font-size:.75rem;color:#64748b">${s.surveyCount!=null?s.surveyCount:'—'}</td>
                </tr>`).join('')}
              </tbody>
            </table>
          </div>
        </div>` : ''}
      `;

    } catch(e) {
      if (el) el.innerHTML = `<div style="padding:2rem;color:#b91c1c;font-size:.875rem">
        Error loading Field Intel: ${e.message}.
        <button onclick="delete window._tdLoaded['survey-intel'];renderSurveyIntelTab()"
          style="text-decoration:underline;background:none;border:none;cursor:pointer;color:#1d4ed8;margin-left:.5rem">Retry</button>
      </div>`;
    }
  }

  // ══════════════════════════════════════════════════════════════════
  //  INITIALIZATION & DEPT-AWARE SETUP
  // ══════════════════════════════════════════════════════════════════

  function initTDModule() {
    // Show exec PDF button for data dept
    const execBtn = document.getElementById('tdExecPDFBtn');
    if (execBtn) execBtn.style.display = (getDept() === 'data') ? '' : 'none';

    // Load the first (active) tab
    const firstActive = document.querySelector('#tdTabNav .pst-tab.active');
    if (firstActive) {
      const tabId = firstActive.id.replace('tdTab-', '');
      if (!_tdLoaded[tabId]) {
        _tdLoaded[tabId] = true;
        switch (tabId) {
          case 'pd':           renderPDTab();           break;
          case 'intake':       renderIntakeTab();       break;
          case 'apprentice':   renderApprenticeTab();   break;
          case 'survey-intel': renderSurveyIntelTab();  break;
          default:             renderPDTab();
        }
      }
    } else {
      if (!_tdLoaded['pd']) { _tdLoaded['pd'] = true; renderPDTab(); }
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

  // tdGenerateExecPDF — generates Executive + Programming T&D snapshot PDFs
  function tdGenerateExecPDF() {
    const dept = (window.NJTC_SESSION || {}).dept || 'data';
    const isExec = ['leadership','kb'].includes(dept);
    const now = new Date().toLocaleString('en-US', { month:'long', day:'numeric', year:'numeric', hour:'numeric', minute:'2-digit' });

    // ── Compute metrics from cached data ──────────────────────────────────
    function avgField(rows, field) {
      const v = (rows||[]).map(r => parseFloat(r[field])).filter(n => !isNaN(n));
      return v.length ? (v.reduce((a,b)=>a+b,0)/v.length) : null;
    }
    function fmtN(n, dec) { return n==null ? '—' : n.toFixed(dec===undefined?2:dec); }
    function pctOf(n, d) { return (!d || d===0) ? '—' : Math.round((n/d)*100)+'%'; }

    // PD data metrics
    const pdRows  = _pdData || [];
    const pdTotal = pdRows.length;
    const pdSessions = (function(){
      const seen={}; pdRows.forEach(r=>{const k=(r['PD Session Number ']||r['PD Session Number']||'').trim(); if(k)seen[k]=true;}); return Object.keys(seen).length;
    })();
    const pdOverallAvg = avgField(pdRows, 'Overall satisfaction with this PD session');
    const pdRecYes  = pdRows.filter(r=>(r['Would you recommend this PD session to other sites?']||'').toLowerCase().startsWith('y')).length;
    const pdRecRate = pdTotal ? Math.round((pdRecYes/pdTotal)*100) : null;
    const s1Key = r => (r['PD Session Number ']||r['PD Session Number']||'').trim();
    const s1Rows = pdRows.filter(r=>s1Key(r)==='PD Session 1');
    const s2Rows = pdRows.filter(r=>s1Key(r)==='PD Session 2');
    const s1Avg  = s1Rows.length ? (PD_RATING_FIELDS.reduce((a,f)=>{const v=avgField(s1Rows,f);return a+(v||0);},0)/PD_RATING_FIELDS.length) : null;
    const s2Avg  = s2Rows.length ? (PD_RATING_FIELDS.reduce((a,f)=>{const v=avgField(s2Rows,f);return a+(v||0);},0)/PD_RATING_FIELDS.length) : null;
    const netImprove = (s1Avg!=null && s2Avg!=null) ? (s2Avg - s1Avg) : null;

    // Role breakdown from PD
    const pdRoleMap = {};
    pdRows.forEach(r=>{ const role=(r['Role']||'').trim(); if(role) pdRoleMap[role]=(pdRoleMap[role]||0)+1; });
    const pdRoles = Object.entries(pdRoleMap).sort((a,b)=>b[1]-a[1]).slice(0,6);

    // Training Intake metrics — use module cache first, fall back to global loaded by exec dashboard
    const intRows = _intakeData || window.njtcIntake || [];
    const intTotal = intRows.length;
    const resolvedFields = intTotal ? resolveIntakeFields(intRows) : INTAKE_RATING_FIELDS;
    const intAvgs = resolvedFields.map(f => ({ short:f.short, avg: avgField(intRows, f.field) })).filter(f=>f.avg!=null);
    const intOverall = intAvgs.find(f=>/effectiveness/i.test(f.short));
    const intPrep    = intAvgs.find(f=>/prepared/i.test(f.short));
    const intTrainer = intAvgs.find(f=>/trainer/i.test(f.short));

    // Resolve hire-type and role columns with the same fuzzy matching used in renderIntakeAnalytics
    // so the PDF is not broken by small differences in the sheet's column header text
    const INT_HIRE_COL = intTotal ? (findCol(intRows, 'new or returning hire', 'returning hire') || 'Are you a new or returning hire? (Select one)') : 'Are you a new or returning hire? (Select one)';
    const INT_ROLE_COL = intTotal ? (findCol(intRows, 'what is your role within njtc', 'your role within') || 'What is your role within NJTC? (Select one)') : 'What is your role within NJTC? (Select one)';

    // New hire detection: match 'new' OR 'first' (handles "New Hire", "First Time", "First-Time Hire")
    // Returning detection: match 'return' (handles "Returning", "Returning Hire", "Returning Staff")
    // If neither matches (unrecognised value), it falls into neither bucket — surfaced via debug below
    function isNewHire(r)      { const v=(r[INT_HIRE_COL]||'').toLowerCase(); return v.includes('new')||v.includes('first'); }
    function isReturning(r)    { const v=(r[INT_HIRE_COL]||'').toLowerCase(); return v.includes('return'); }
    const intNew     = intRows.filter(isNewHire).length;
    const intReturn  = intRows.filter(isReturning).length;
    const intUnknown = intTotal - intNew - intReturn; // how many didn't match either bucket
    const intRoleFreq = countFreq(intRows.map(r=>r[INT_ROLE_COL]).filter(Boolean));

    // ── Season comparison helpers (PDF_SEASONS defined at module level) ──
    function getSeasonLocal(dateStr) {
      if (!dateStr) return null;
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return null;
      const m = d.getMonth() + 1;
      if (m >= 9 && m <= 11) return 'fall';
      if (m === 12 || m === 1 || m === 2) return 'winter';
      if (m >= 3 && m <= 5) return 'spring';
      return 'summer';
    }
    // PD by season
    const pdBySeason = {};
    PDF_SEASONS.forEach(s => { pdBySeason[s.key] = pdRows.filter(r => getSeasonLocal(r['Date of PD Session'] || r['Timestamp'] || '') === s.key); });
    // Intake by season
    const intBySeason = {};
    PDF_SEASONS.forEach(s => { intBySeason[s.key] = intRows.filter(r => getSeasonLocal(r['Timestamp'] || '') === s.key); });
    // Helper: compute key PD metrics for a set of rows
    function pdSeasonMetrics(rows) {
      if (!rows.length) return null;
      const overall = avgField(rows, 'Overall satisfaction with this PD session');
      const recYes  = rows.filter(r=>(r['Would you recommend this PD session to other sites?']||'').toLowerCase().startsWith('y')).length;
      return { n: rows.length, overall, recRate: Math.round((recYes/rows.length)*100) };
    }
    // Helper: compute key Intake metrics for a set of rows
    function intSeasonMetrics(rows) {
      if (!rows.length) return null;
      const rf = resolveIntakeFields(rows.length ? rows : intRows);
      const prepField = rf.find(f=>/prepared/i.test(f.short));
      const effField  = rf.find(f=>/effectiveness/i.test(f.short));
      const prep = prepField ? avgField(rows, prepField.field) : null;
      const eff  = effField  ? avgField(rows, effField.field)  : null;
      return { n: rows.length, prep, eff };
    }
    const hasPDSeasons      = PDF_SEASONS.some(s => pdBySeason[s.key].length > 0);
    const hasIntSeasons     = PDF_SEASONS.some(s => intBySeason[s.key].length > 0);
    const activePdSeasons   = PDF_SEASONS.filter(s => pdBySeason[s.key] && pdBySeason[s.key].length > 0);
    const activeIntSeasons  = PDF_SEASONS.filter(s => intBySeason[s.key] && intBySeason[s.key].length > 0);

    // Apprentice data
    const apprPool = (function(){
      if(!_apprParsed) return null;
      const all = [].concat(_apprParsed.active||[], _apprParsed.cohort1||[], _apprParsed.cohort2||[]);
      return all.length ? { total: all.length, data: all } : null;
    })();
    // Also count from HR data if available
    const hrApprCount = (function(){
      const hr = window.HR_EMPS || [];
      const c = hr.filter(e=>e.s==='Active' && e._apprentice==='Yes').length;
      return c > 0 ? c : null;
    })();
    const apprCount = hrApprCount || (apprPool ? apprPool.total : null);

    // KPI T&D-adjacent goals
    const kpiData = window.KPI_DATA || [];
    const _tdHasEOY = kpiData.some(k=>k.endStatus && k.endStatus.trim());
    const getS = k => (_tdHasEOY ? (k.endStatus || k.midStatus) : (k.midStatus || k.status)) || '';
    const tdKPIs = kpiData.filter(k => /training|development|TAP|apprentice|PD|professional development/i.test(k.goal||k.kpi||''));
    const tdMet  = tdKPIs.filter(k=>getS(k)==='Met').length;

    // ── HTML report template ───────────────────────────────────────────────
    const logoHex = '#003087';
    const goldHex = '#f0a500';

    function statRow(label, value, note) {
      return `<tr style="border-bottom:1px solid #eee">
        <td style="padding:.5rem .75rem;font-size:.85rem;color:#374151;font-weight:500">${label}</td>
        <td style="padding:.5rem .75rem;font-size:.9rem;font-weight:800;color:${logoHex};text-align:right">${value}</td>
        ${note ? `<td style="padding:.5rem .75rem;font-size:.75rem;color:#6b7280">${note}</td>` : ''}
      </tr>`;
    }

    function sectionHead(title) {
      return `<div style="margin:1.5rem 0 .75rem;padding:.5rem .875rem;background:${logoHex};color:#fff;border-radius:6px;font-size:.875rem;font-weight:800;letter-spacing:.04em;text-transform:uppercase">${title}</div>`;
    }

    function subHead(title) {
      return `<div style="font-size:.7rem;font-weight:800;text-transform:uppercase;letter-spacing:.06em;color:#64748b;margin:.875rem 0 .4rem;padding-left:.125rem">${title}</div>`;
    }

    function ratingBar(label, val, max) {
      if (val==null) return '';
      const pct = Math.round((val/(max||5))*100);
      const color = val>=4?'#059669':val>=3?'#d97706':'#dc2626';
      return `<div style="display:flex;align-items:center;gap:.75rem;margin-bottom:.4rem">
        <div style="width:160px;font-size:.78rem;color:#374151;flex-shrink:0">${label}</div>
        <div style="flex:1;height:10px;background:#f1f5f9;border-radius:99px;overflow:hidden">
          <div style="height:100%;width:${pct}%;background:${color};border-radius:99px"></div>
        </div>
        <div style="font-size:.8rem;font-weight:800;color:${color};width:35px;text-align:right">${fmtN(val)}</div>
      </div>`;
    }

    // Seasonal comparison table for PD (executive)
    function pdSeasonCompare() {
      if (!activePdSeasons.length) return '<p style="color:#9ca3af;font-size:.8rem">No seasonal breakdown available (check PD date field).</p>';
      const hdrs = activePdSeasons.map(s=>`<th style="padding:.45rem .75rem;font-size:.75rem;font-weight:800;text-align:right;color:#374151">${s.label}<br><span style="font-weight:500;color:#9ca3af">${s.note}</span></th>`).join('');
      const metrics = [
        { label:'Respondents', fn: rows => rows.length },
        { label:'Avg Satisfaction', fn: rows => { const v=avgField(rows,'Overall satisfaction with this PD session'); return v!=null?fmtN(v)+'/5':'—'; } },
        { label:'Recommend Rate', fn: rows => { const yes=rows.filter(r=>(r['Would you recommend this PD session to other sites?']||'').toLowerCase().startsWith('y')).length; return rows.length?Math.round(yes/rows.length*100)+'%':'—'; } },
        ...PD_RATING_FIELDS.slice(0,4).map((f,i)=>({ label: PD_RATING_SHORT[i]||'Dim '+(i+1), fn: rows => { const v=avgField(rows,f); return v!=null?fmtN(v):'—'; } })),
      ];
      const dataRows = metrics.map(m=>{
        const cells = activePdSeasons.map(s=>`<td style="padding:.45rem .75rem;font-size:.82rem;font-weight:700;text-align:right;color:${logoHex}">${m.fn(pdBySeason[s.key])}</td>`).join('');
        return `<tr style="border-bottom:1px solid #f1f5f9"><td style="padding:.45rem .75rem;font-size:.8rem;color:#374151">${m.label}</td>${cells}</tr>`;
      }).join('');
      return `<table style="width:100%;border-collapse:collapse;border:1px solid #e2e8f0"><thead><tr style="background:#f8fafc"><th style="padding:.45rem .75rem;font-size:.75rem;text-align:left;color:#374151">Metric</th>${hdrs}</tr></thead><tbody>${dataRows}</tbody></table>`;
    }

    // Seasonal comparison table for Intake
    function intSeasonCompare() {
      if (!activeIntSeasons.length) return '<p style="color:#9ca3af;font-size:.8rem">No seasonal breakdown available — check Timestamp field in intake data.</p>';
      const hdrs = activeIntSeasons.map(s=>`<th style="padding:.45rem .75rem;font-size:.75rem;font-weight:800;text-align:right;color:#374151">${s.label}<br><span style="font-weight:500;color:#9ca3af">${s.note}</span></th>`).join('');
      const resolvedF = intRows.length ? resolveIntakeFields(intRows) : [];
      const metrics = [
        { label:'Respondents', fn: rows => rows.length },
        { label:'New Hires',       fn: rows => rows.filter(r=>{ const v=(r[INT_HIRE_COL]||'').toLowerCase(); return v.includes('new')||v.includes('first'); }).length },
        { label:'Returning Hires', fn: rows => rows.filter(r=>(r[INT_HIRE_COL]||'').toLowerCase().includes('return')).length },
        ...resolvedF.slice(0,5).map(f=>({ label: f.short, fn: rows => { const v=avgField(rows,f.field); return v!=null?fmtN(v):'—'; } })),
      ];
      const dataRows = metrics.map(m=>{
        const cells = activeIntSeasons.map(s=>`<td style="padding:.45rem .75rem;font-size:.82rem;font-weight:700;text-align:right;color:${logoHex}">${m.fn(intBySeason[s.key])}</td>`).join('');
        return `<tr style="border-bottom:1px solid #f1f5f9"><td style="padding:.45rem .75rem;font-size:.8rem;color:#374151">${m.label}</td>${cells}</tr>`;
      }).join('');
      return `<table style="width:100%;border-collapse:collapse;border:1px solid #e2e8f0"><thead><tr style="background:#f8fafc"><th style="padding:.45rem .75rem;font-size:.75rem;text-align:left;color:#374151">Metric</th>${hdrs}</tr></thead><tbody>${dataRows}</tbody></table>`;
    }

    // Executive summary section (leadership / kb view)
    const execSection = isExec ? `
      ${sectionHead('Executive Summary — T&D Program Health')}
      <table style="width:100%;border-collapse:collapse;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden">
        ${statRow('PD Sessions Delivered', pdSessions > 0 ? pdSessions : '—')}
        ${statRow('Total PD Respondents', pdTotal || '—', 'PD feedback submissions')}
        ${statRow('Avg Overall Satisfaction', pdOverallAvg!=null ? fmtN(pdOverallAvg)+'/5.0' : '—', pdOverallAvg!=null&&pdOverallAvg>=4?'✅ On track':'⚠️ Needs attention')}
        ${statRow('Recommend Rate', pdRecRate!=null ? pdRecRate+'%' : '—', pdRecRate!=null&&pdRecRate>=80?'✅ Healthy':'⚠️ Below 80% target')}
        ${statRow('S1→S2 Net Improvement', netImprove!=null ? (netImprove>=0?'+':'')+fmtN(netImprove) : (s2Rows.length?'N/A':'Awaiting S2'), netImprove!=null&&netImprove>0?'✅ Improving':'')}
        ${statRow('Training Intake Respondents', intTotal || '—', intTotal ? `${intNew} new hire · ${intReturn} returning` : 'load T&D Analytics to populate')}
        ${statRow('Intake: Preparedness Rating', intPrep ? fmtN(intPrep.avg)+'/5.0' : '—')}
        ${statRow('Active Apprentices (TAP)', apprCount!=null ? apprCount : '—', 'HR Master List · col K')}
        ${tdKPIs.length ? statRow('T&D-Adjacent KPI Goals Met', `${tdMet}/${tdKPIs.length}`, '') : ''}
      </table>
      <p style="font-size:.75rem;color:#9ca3af;margin-top:.5rem">Satisfaction benchmarks: ≥4.0 on track. Recommend Rate: ≥80% healthy.</p>

      ${activePdSeasons.length > 1 ? sectionHead('PD Satisfaction — Seasonal Comparison') + pdSeasonCompare() : ''}
      ${activeIntSeasons.length > 1 ? sectionHead('Training Intake — Seasonal Comparison') + intSeasonCompare() : ''}
    ` : '';

    // Programming detail section
    const progSection = `
      ${sectionHead('PD Session Ratings — Overall')}
      ${pdRows.length ? `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;margin-bottom:1rem">
          <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:.875rem">
            <div style="font-size:.7rem;font-weight:700;color:#6b7280;text-transform:uppercase;margin-bottom:.5rem">Session Ratings (1–5)</div>
            ${PD_RATING_FIELDS.map((f,i)=>ratingBar(PD_RATING_SHORT[i]||f.slice(0,30), avgField(pdRows,f))).join('')}
          </div>
          <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:.875rem">
            <div style="font-size:.7rem;font-weight:700;color:#6b7280;text-transform:uppercase;margin-bottom:.5rem">Session 1 vs Session 2</div>
            ${s1Rows.length ? PD_RATING_FIELDS.map((f,i) => {
              const v1=avgField(s1Rows,f), v2=avgField(s2Rows,f);
              const delta = (v1!=null&&v2!=null) ? (v2-v1) : null;
              return `<div style="display:flex;justify-content:space-between;align-items:center;padding:.25rem 0;border-bottom:1px solid #f1f5f9;font-size:.77rem">
                <span style="color:#374151">${PD_RATING_SHORT[i]||'Dim '+(i+1)}</span>
                <span style="font-weight:700;color:${delta!=null&&delta>0?'#059669':delta!=null&&delta<0?'#dc2626':'#6b7280'}">${v1!=null?fmtN(v1):'—'} → ${v2!=null?fmtN(v2):'—'} ${delta!=null?'('+(delta>=0?'+':'')+fmtN(delta)+')':''}</span>
              </div>`;
            }).join('') : '<div style="font-size:.8rem;color:#9ca3af">Session 2 data not yet available.</div>'}
          </div>
        </div>
        ${pdRoles.length ? `${subHead('Respondent Breakdown by Role')}
        <div style="display:flex;gap:.375rem;flex-wrap:wrap">${pdRoles.map(([role,n])=>`<span style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:20px;padding:.2rem .6rem;font-size:.75rem;color:#1d4ed8;font-weight:600">${role}: ${n}</span>`).join('')}</div>` : ''}

        ${activePdSeasons.length > 1 ? sectionHead('PD Ratings — Seasonal Comparison') + pdSeasonCompare() : ''}
      ` : '<p style="color:#9ca3af;font-size:.85rem">PD session data not yet loaded. Open T&D Analytics to load data, then retry.</p>'}

      ${sectionHead('Training Intake')}
      ${intRows.length ? `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;margin-bottom:1rem">
          <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:.875rem">
            <div style="font-size:.7rem;font-weight:700;color:#6b7280;text-transform:uppercase;margin-bottom:.5rem">Intake Ratings (1–5)</div>
            ${intAvgs.slice(0,6).map(f=>ratingBar(f.short, f.avg)).join('')}
          </div>
          <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:.875rem">
            <div style="font-size:.7rem;font-weight:700;color:#6b7280;text-transform:uppercase;margin-bottom:.5rem">Hire Type Split</div>
            <div style="display:flex;gap:1.5rem;flex-wrap:wrap;margin-bottom:.875rem">
              <div>
                <div style="font-size:1.75rem;font-weight:900;color:${logoHex}">${intNew}</div>
                <div style="font-size:.75rem;color:#6b7280">New Hire<br><span style="font-weight:600">${intTotal ? Math.round(intNew/intTotal*100) : 0}% of ${intTotal}</span></div>
              </div>
              <div>
                <div style="font-size:1.75rem;font-weight:900;color:#059669">${intReturn}</div>
                <div style="font-size:.75rem;color:#6b7280">Returning<br><span style="font-weight:600">${intTotal ? Math.round(intReturn/intTotal*100) : 0}% of ${intTotal}</span></div>
              </div>
              ${intUnknown > 0 ? `<div>
                <div style="font-size:1.75rem;font-weight:900;color:#9ca3af">${intUnknown}</div>
                <div style="font-size:.75rem;color:#9ca3af">Unclassified<br><span style="font-size:.68rem">response not matched</span></div>
              </div>` : ''}
            </div>
            ${intRoleFreq.length ? `
              <div style="font-size:.7rem;font-weight:700;color:#6b7280;text-transform:uppercase;margin-bottom:.35rem">Role Breakdown</div>
              ${intRoleFreq.slice(0,6).map(([role,n])=>`
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.2rem">
                  <span style="font-size:.75rem;color:#374151">${role}</span>
                  <span style="font-size:.75rem;font-weight:700;color:${logoHex}">${n} <span style="color:#9ca3af;font-weight:400">(${intTotal?Math.round(n/intTotal*100):0}%)</span></span>
                </div>`).join('')}
            ` : ''}
          </div>
        </div>
        ${activeIntSeasons.length > 1 ? subHead('Seasonal Comparison') + intSeasonCompare() : ''}
      ` : '<p style="color:#9ca3af;font-size:.85rem">Training intake data not yet loaded.</p>'}

      ${sectionHead('Apprenticeship Program')}
      <div style="display:flex;gap:1rem;align-items:center;padding:.875rem;background:#fefce8;border:1px solid #fde68a;border-radius:8px">
        <div style="text-align:center;min-width:80px">
          <div style="font-size:2.25rem;font-weight:900;color:#92400e;line-height:1">${apprCount!=null ? apprCount : '—'}</div>
          <div style="font-size:.7rem;color:#a16207;font-weight:700">Active Apprentices</div>
        </div>
        <div style="font-size:.8rem;color:#78350f;line-height:1.6">TAP (Tutor Apprenticeship Program) participants flagged active in the HR Master List (col K). For full apprentice tracker data, open T&D Analytics → Apprentice Tracker tab.</div>
      </div>

      ${sectionHead('Season-by-Season Comparison')}
      ${hasPDSeasons ? `
        <div style="font-size:.7rem;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:.06em;margin-bottom:.5rem">PD Session Feedback — By Season</div>
        <table style="width:100%;border-collapse:collapse;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;margin-bottom:1.25rem">
          <thead>
            <tr style="background:#f8fafc">
              <th style="padding:.45rem .75rem;text-align:left;font-size:.72rem;font-weight:700;color:#374151;border-bottom:2px solid #e5e7eb">Season</th>
              <th style="padding:.45rem .75rem;text-align:center;font-size:.72rem;font-weight:700;color:#374151;border-bottom:2px solid #e5e7eb">Respondents</th>
              <th style="padding:.45rem .75rem;text-align:center;font-size:.72rem;font-weight:700;color:#374151;border-bottom:2px solid #e5e7eb">Avg Satisfaction</th>
              <th style="padding:.45rem .75rem;text-align:center;font-size:.72rem;font-weight:700;color:#374151;border-bottom:2px solid #e5e7eb">Recommend Rate</th>
            </tr>
          </thead>
          <tbody>
            ${PDF_SEASONS.map(s => {
              const m = pdSeasonMetrics(pdBySeason[s.key]);
              if (!m) return `<tr style="border-bottom:1px solid #f1f5f9"><td style="padding:.4rem .75rem;font-size:.78rem;color:#9ca3af" colspan="4">${s.label} (${s.note}) — no data</td></tr>`;
              const satColor = m.overall>=4?'#059669':m.overall>=3?'#d97706':'#dc2626';
              const recColor = m.recRate>=80?'#059669':m.recRate>=60?'#d97706':'#dc2626';
              return `<tr style="border-bottom:1px solid #f1f5f9">
                <td style="padding:.4rem .75rem">
                  <span style="display:inline-block;width:8px;height:8px;background:${s.color};border-radius:50%;margin-right:.4rem"></span>
                  <strong style="font-size:.8rem;color:#111">${s.label}</strong>
                  <span style="font-size:.68rem;color:#9ca3af;margin-left:.3rem">${s.note}</span>
                </td>
                <td style="padding:.4rem .75rem;text-align:center;font-size:.83rem;font-weight:800;color:#374151">${m.n}</td>
                <td style="padding:.4rem .75rem;text-align:center;font-size:.83rem;font-weight:800;color:${satColor}">${m.overall!=null?fmtN(m.overall)+'/5.0':'—'}</td>
                <td style="padding:.4rem .75rem;text-align:center;font-size:.83rem;font-weight:800;color:${recColor}">${m.recRate}%</td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      ` : '<p style="font-size:.8rem;color:#9ca3af;margin-bottom:1rem">PD data has no date column to compute season breakdown.</p>'}

      ${hasIntSeasons ? `
        <div style="font-size:.7rem;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:.06em;margin-bottom:.5rem">Training Intake — By Season</div>
        <table style="width:100%;border-collapse:collapse;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden">
          <thead>
            <tr style="background:#f8fafc">
              <th style="padding:.45rem .75rem;text-align:left;font-size:.72rem;font-weight:700;color:#374151;border-bottom:2px solid #e5e7eb">Season</th>
              <th style="padding:.45rem .75rem;text-align:center;font-size:.72rem;font-weight:700;color:#374151;border-bottom:2px solid #e5e7eb">Respondents</th>
              <th style="padding:.45rem .75rem;text-align:center;font-size:.72rem;font-weight:700;color:#374151;border-bottom:2px solid #e5e7eb">Preparedness</th>
              <th style="padding:.45rem .75rem;text-align:center;font-size:.72rem;font-weight:700;color:#374151;border-bottom:2px solid #e5e7eb">Effectiveness</th>
            </tr>
          </thead>
          <tbody>
            ${PDF_SEASONS.map(s => {
              const m = intSeasonMetrics(intBySeason[s.key]);
              if (!m) return `<tr style="border-bottom:1px solid #f1f5f9"><td style="padding:.4rem .75rem;font-size:.78rem;color:#9ca3af" colspan="4">${s.label} (${s.note}) — no data</td></tr>`;
              const prepColor = m.prep!=null?(m.prep>=4?'#059669':m.prep>=3?'#d97706':'#dc2626'):'#9ca3af';
              const effColor  = m.eff!=null?(m.eff>=4?'#059669':m.eff>=3?'#d97706':'#dc2626'):'#9ca3af';
              return `<tr style="border-bottom:1px solid #f1f5f9">
                <td style="padding:.4rem .75rem">
                  <span style="display:inline-block;width:8px;height:8px;background:${s.color};border-radius:50%;margin-right:.4rem"></span>
                  <strong style="font-size:.8rem;color:#111">${s.label}</strong>
                  <span style="font-size:.68rem;color:#9ca3af;margin-left:.3rem">${s.note}</span>
                </td>
                <td style="padding:.4rem .75rem;text-align:center;font-size:.83rem;font-weight:800;color:#374151">${m.n}</td>
                <td style="padding:.4rem .75rem;text-align:center;font-size:.83rem;font-weight:800;color:${prepColor}">${m.prep!=null?fmtN(m.prep)+'/5.0':'—'}</td>
                <td style="padding:.4rem .75rem;text-align:center;font-size:.83rem;font-weight:800;color:${effColor}">${m.eff!=null?fmtN(m.eff)+'/5.0':'—'}</td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
        <p style="font-size:.7rem;color:#9ca3af;margin-top:.375rem">Season assigned from Timestamp column. Seasons with 0 responses are excluded from analysis.</p>
      ` : '<p style="font-size:.8rem;color:#9ca3af">Intake data has no timestamp to compute season breakdown.</p>'}
    `;

    const reportTitle = isExec ? 'T&D Executive Snapshot' : 'T&D Programming Snapshot';

    const html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8">
    <title>NJTC — ${reportTitle}</title>
    <style>
      * { box-sizing: border-box; }
      body { font-family: 'Segoe UI', Arial, sans-serif; margin: 0; padding: 2rem; color: #111; background: #fff; max-width: 900px; margin: 0 auto; }
      @media print {
        * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        body { padding: .5in; }
        .no-print { display: none !important; }
        tr:hover td { background: inherit !important; }
      }
      h1 { font-size: 1.5rem; font-weight: 900; color: ${logoHex}; margin: 0; }
      .cover-bar { background: ${logoHex}; color: #fff; padding: 1.25rem 1.5rem; border-radius: 10px; margin-bottom: 1.5rem; display: flex; align-items: flex-end; justify-content: space-between; }
      .cover-sub { font-size: .8rem; opacity: .75; margin-top: .25rem; }
      .gold-badge { background: ${goldHex}; color: #fff; font-size: .7rem; font-weight: 800; padding: .25rem .75rem; border-radius: 20px; letter-spacing: .04em; }
      table { width: 100%; border-collapse: collapse; }
      td, th { word-wrap: break-word; overflow-wrap: break-word; }
    </style>
    </head><body>
    <div class="cover-bar">
      <div>
        <div style="font-size:.75rem;opacity:.6;font-weight:700;letter-spacing:.08em;margin-bottom:.2rem">NEW JERSEY TUTORING CORPS</div>
        <h1 style="color:#fff;margin:0">${reportTitle}</h1>
        <div class="cover-sub">Training &amp; Development Analytics · SY 2025–26</div>
      </div>
      <div style="text-align:right">
        <div class="gold-badge">${isExec ? 'EXECUTIVE' : 'PROGRAMMING'}</div>
        <div style="font-size:.7rem;opacity:.6;margin-top:.375rem">${now}</div>
      </div>
    </div>

    <button class="no-print" onclick="window.print()" style="margin-bottom:1.5rem;background:${logoHex};color:#fff;border:none;padding:.5rem 1.25rem;border-radius:8px;font-weight:700;cursor:pointer;font-size:.875rem">⬇ Print / Save as PDF</button>

    ${execSection}
    ${progSection}

    <div style="margin-top:2rem;padding-top:1rem;border-top:2px solid #e5e7eb;font-size:.7rem;color:#9ca3af">
      Generated from live NJTC Central Team Portal · ${now} · Data reflects current loaded state
    </div>
    </body></html>`;

    const win = window.open('', '_blank', 'width=960,height=750,scrollbars=yes');
    if (win) {
      win.document.write(html);
      win.document.close();
    } else {
      alert('Pop-up blocked. Please allow pop-ups for this site to open the PDF report.');
    }
  }

  window.buildTrainingAnalytics  = buildTrainingAnalytics;
  window.renderTrainingReviews   = renderTrainingReviews;
  window.renderTrainingAnalytics = renderTrainingAnalytics;
  window.tdShowTab               = tdShowTab;
  window.tdRefresh               = tdRefresh;
  window.tdGenerateExecPDF       = tdGenerateExecPDF;
  window.render2526OtjOverview   = render2526OtjOverview;
  window.SY2526_DATA             = SY2526_DATA; // exposed for the 2-Year Returners join view (index.html renderReturnersTab)

  // ── Pre-fetch obs maps for programming dept profiles view ──────────────────
  // Called by shared-charts.js when programming dept opens the Profiles tab,
  // before T&D module tabs have been visited. Idempotent: fetchAllSheets()
  // caches results and _buildObsMaps is a no-op if maps already set.
  window._njtcFetchObsData = async function() {
    try { await fetchAllSheets(); } catch(e) {
      console.warn('[T&D] Obs pre-fetch failed:', e.message);
    }
  };

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
