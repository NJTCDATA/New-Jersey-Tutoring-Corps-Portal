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

  // ── Apprentice master lists (ADP canonical names) ─────────────────
  const APPRENTICES_NE = [
    'Alexandra Cristescu','Aliviyah Goodson','Apollo Monroy-Polanco','Arelis Rodriguez',
    'Carla Borbon','Carlos Jacho','Ian Anderson','Jasmine Ramsey-Copeland','Jessica Flores',
    'Keisha Lopez','La Shanee Davis','Lilia Quintero','Linda Fenty','Maria Gutierrez',
    'Monica Brown','Mushana Dunham','Naima Boutira','Norelis Ramirez','Pooja Tyagi',
    'Shahzeeb Ahmad','Sharon K Kessel','Subul Sadiq','Theodore Mills'
  ];
  const APPRENTICES_SW = [
    'Caitlin Evgeniadis','Jacob Leebron','Katie Rose Davis',
    'Katrina Valentin','Micaela Wilkerson','Nicholas Hoover'
  ];
  const ALL_APPRENTICES = [...APPRENTICES_NE, ...APPRENTICES_SW];

  // Name normalization aliases: informal → ADP canonical
  const NAME_ALIASES = {
    'renee davis':          'La Shanee Davis',
    'dr. davis':            'La Shanee Davis',
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
    if (_apprParsed) return _apprParsed;
    const keys = ['neOtj','swOtj','neTutorObs','swTutorObs','neSiteLeaderObs','swSiteLeaderObs'];
    const texts = await Promise.all(keys.map(k => fetchApprCSV(k)));
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

    _apprParsed = { neOtj, swOtj, neTutorObs, swTutorObs, neSLObs, swSLObs,
                    neTutorObsHeaders: neTutorObsParsed.headers,
                    swTutorObsHeaders: swTutorObsParsed.headers };

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

    return _apprParsed;
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
        case 'otj-overview': renderOTJOverviewTab();  break;
        case 'apprentice':   renderApprenticeTab();   break;
        case 'tutor-obs':    renderTutorObsTab();     break;
        case 'sl-obs':       renderSLObsTab();        break;
        case 'doc-vault':    renderDocVaultTab();     break;
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
    ['pd','intake','otj-overview','apprentice','tutor-obs','sl-obs','doc-vault'].forEach(id => {
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
    const newHires   = rows.filter(r => (r[HIRE_COL]||'').toLowerCase().includes('new')).length;
    const returning  = total - newHires;
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
    const newHires    = rows.filter(r=>(r['Are you a new or returning hire? (Select one)']||'').toLowerCase().includes('new')).length;
    const returning   = total - newHires;
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
  //  SHARED: DOCUMENT VAULT STATIC LINKS
  // ══════════════════════════════════════════════════════════════════

  const VAULT_STATIC = [
    { label:'Bergen OTJ Tracker',           url:'https://docs.google.com/spreadsheets/d/1KL3UdtkBPTVLiq4XCEIYujc8E4bl0dr4phetSeiIS8w', type:'OTJ Checklist', region:'NE', district:'iLearn Bergen' },
    { label:'CJCP OTJ Tracker',             url:'https://docs.google.com/spreadsheets/d/1Q3O3DBNcig8tpzma9yp8e8y4NeekIDiKZZpvxr_-9uA', type:'OTJ Checklist', region:'NE', district:'Somerset County (CJCP)' },
    { label:'Clifton OTJ Tracker',          url:'https://docs.google.com/spreadsheets/d/1Y9GG5SYOeatrPnSSBC_SFXFy0BgVrNoLsgZMeA9i96U', type:'OTJ Checklist', region:'NE', district:'iLearn Clifton' },
    { label:'Hudson OTJ Tracker',           url:'https://docs.google.com/spreadsheets/d/1Jra-5s5x4Fm6MShAUhkWwdreDlYoXg2ums96eJi3k6k', type:'OTJ Checklist', region:'NE', district:'iLearn Hudson' },
    { label:'Passaic OTJ Tracker',          url:'https://docs.google.com/spreadsheets/d/1ux98kbhQtSsRv9RK3hcPwgCWcG9FPFhlnrKi77gr1JU', type:'OTJ Checklist', region:'NE', district:'iLearn Passaic' },
    { label:'Paterson OTJ Tracker',         url:'https://docs.google.com/spreadsheets/d/19X4c_-KZyyWSQtkrZswwAeA7I2-lw-HOE7zT-5U5Y-U', type:'OTJ Checklist', region:'NE', district:'iLearn Paterson' },
    { label:'HoLa OTJ Tracker',             url:'https://docs.google.com/spreadsheets/d/1GjMMajULyx5kGm83xx427kbt4qJaARXl0eq5-g5481U', type:'OTJ Checklist', region:'NE', district:'Hoboken Dual Charter' },
    { label:'Middlesex OTJ Tracker',        url:'https://docs.google.com/spreadsheets/d/1WLCYUAbnszNnB9m5zL9tZH_9TlpPRDO4k7uTd4S060A', type:'OTJ Checklist', region:'NE', district:'Middlesex' },
    { label:'SW - DH OTJ Checklist (GLAW)', url:'https://docs.google.com/spreadsheets/d/1HJtYSQacQDw5VJzydM8I7kmiu2A7oiYsI3PaPTumm4A', type:'OTJ Checklist', region:'SW', district:'Hamilton Township' },
    { label:'SW - LE OTJ (Hamilton/Wilson)',url:'https://docs.google.com/spreadsheets/d/1LqzvK-Le7JRTjPCNF35T1vn6AAdNf9KLh3Nva5dNHRc', type:'OTJ Checklist', region:'SW', district:'Hamilton Township' },
    { label:'SW - FLs OTJ (Haddon)',        url:'https://docs.google.com/spreadsheets/d/1CyPa0U9UjdBvOnHEbd3nb-XYHtDGYcKZmFjnWp5vzfM', type:'OTJ Checklist', region:'SW', district:'Haddon Township' },
    { label:'SW - KS OTJ (Hamilton/Grice)', url:'https://docs.google.com/spreadsheets/d/1jDEE1Q2L_zk2oP4aYQLZNzPQTh6hW6ijuzgnEPjwP38', type:'OTJ Checklist', region:'SW', district:'Hamilton Township' },
    { label:'SW - MR OTJ (Hamilton/Kuser)', url:'https://docs.google.com/spreadsheets/d/1wbLULAJSl3JlLwNW_x24HJvMa0kAPviGz4AKtysYpk4', type:'OTJ Checklist', region:'SW', district:'Hamilton Township' },
    { label:'SW - JI OTJ (Gloucester)',     url:'https://docs.google.com/spreadsheets/d/10OtEnLDr0ggtchDqhrcrBsqbChsXKbH5LxPPHjC62YQ', type:'OTJ Checklist', region:'SW', district:'Gloucester' },
    { label:'SW - TP OTJ (Penns Grove/Carleton)', url:'https://docs.google.com/spreadsheets/d/1ToVcMG4hemGo4yC5c5VG-Ucjf44NXxJkfcGU8i1dCig', type:'OTJ Checklist', region:'SW', district:'Penns Grove' },
    { label:'SW - SE OTJ (Penns Grove/PGMS)',     url:'https://docs.google.com/spreadsheets/d/1kEm4VlCXhUk4I9jQx-2kKPZJ_n8OmTmP6kV4OCiBk3g', type:'OTJ Checklist', region:'SW', district:'Penns Grove' },
    { label:'SW - CO OTJ (Penns Grove/Field St)', url:'https://docs.google.com/spreadsheets/d/1N4tPnm-YelqutiF1qnpkzqg3_cjNr-iSSWLEFGlG044', type:'OTJ Checklist', region:'SW', district:'Penns Grove' },
    { label:'SW - MK OTJ (American Paradigm)',    url:'https://docs.google.com/spreadsheets/d/1P9N52uyOvZdpbVed2fRKp9UeDuWdPwMggMwjpvKHSU8', type:'OTJ Checklist', region:'SW', district:'American Paradigm' },
    { label:'SW - MK OTJ (String Theory)',        url:'https://docs.google.com/spreadsheets/d/1vGCTuoYUcrthVsyop0P0373LWz3_sUjCTeTyay3dOmc', type:'OTJ Checklist', region:'SW', district:'String Theory' },
    { label:'Talent Dashboard Form',       url:'https://forms.gle/6bYhspAFscoaQFsw6',                                        type:'Form',         region:'All', district:'' },
    { label:'N.Odigie Observations Folder',url:'https://drive.google.com/drive/folders/12dr_Z9n3zcPhQtHsfhSSpxnO5IzyIBfR',  type:'Folder',       region:'NE', district:'' },
    { label:'K.Ramsey Observations Folder',url:'https://drive.google.com/drive/folders/1-9m5CH_RtxlqThst1g00P1WqE80uXN8n',  type:'Folder',       region:'NE', district:'' },
    { label:'L.Sessoms Observations Folder',url:'https://drive.google.com/drive/folders/1l-54Cx4Kh-nemD7Ibwb1XihL3xyKggTW', type:'Folder',       region:'NE', district:'' }
  ];

  // ══════════════════════════════════════════════════════════════════
  //  TAB 3 (new): OTJ OVERVIEW
  // ══════════════════════════════════════════════════════════════════

  async function renderOTJOverviewTab() {
    const el = document.getElementById('td-content-otj-overview');
    if (!el) return;
    el.innerHTML = loadingHTML('Loading apprenticeship data…');
    try {
      const d = await fetchAllSheets();
      const allOtj = [...d.neOtj, ...d.swOtj];

      // Build apprentice map keyed by canonical name
      const appMap = {};
      function addOtjRow(r, region) {
        const first = (r['Tutor First'] || '').trim();
        const last  = (r['Tutor Last (ADP)'] || '').trim();
        const rawName = first && last ? first + ' ' + last : (first || last);
        const name = normalizeApprenticeName(rawName) || rawName;
        if (!name) return;
        if (!appMap[name]) appMap[name] = { name, region, district: r['District']||'', school: r['School']||'', sl: r['Site Leader']||'', beg: '', mid: '', end: '', link: '', notes: '', adp: '' };
        appMap[name].beg  = appMap[name].beg  || r['Beginning'] || '';
        appMap[name].mid  = appMap[name].mid  || r['Middle']    || '';
        appMap[name].end  = appMap[name].end  || r['End']       || '';
        appMap[name].link = appMap[name].link || r['OTJ Checklist Link'] || '';
        appMap[name].notes= appMap[name].notes|| r['PM Notes']  || '';
        appMap[name].adp  = appMap[name].adp  || r['ADP Status']|| '';
      }
      d.neOtj.forEach(r => addOtjRow(r, 'NE'));
      d.swOtj.forEach(r => addOtjRow(r, 'SW'));

      const apps = Object.values(appMap);
      const total   = apps.length;
      const active  = apps.filter(a => (a.adp||'').trim() === 'Active' || !a.adp).length;
      const begDone = apps.filter(a => getOTJStatus(a.beg) === 'completed').length;
      const midDone = apps.filter(a => getOTJStatus(a.mid) === 'completed').length;
      const needsFU = apps.filter(a =>
        getOTJStatus(a.beg) === 'needs-followup' ||
        getOTJStatus(a.mid) === 'needs-followup' ||
        getOTJStatus(a.end) === 'needs-followup'
      ).length;

      // Observation counts per month (NE + SW combined)
      const NE_MONTHS_COLS = ['October','November','December','January','February','March','April','May','June'];
      const SW_OBS_COLS    = ['October Obs #1','November Obs #1','December Comments','January Comments','February Obs #1','March Obs #1','April Obs #1'];
      const OBS_MONTH_LABELS = ['Oct','Nov','Dec','Jan','Feb','Mar','Apr','May','Jun'];
      const neObsCounts = NE_MONTHS_COLS.map(m => d.neTutorObs.filter(r => (r[m]||'').trim()).length);
      const swObsCounts = SW_OBS_COLS.map(m => d.swTutorObs.filter(r => (r[m]||'').trim()).length);
      // Pad SW to 9 months (no May/Jun columns in SW sheet)
      while (swObsCounts.length < 9) swObsCounts.push(0);

      // Chart data for NE/SW donuts
      function phaseDistrib(rows, phaseCol) {
        const out = { completed:0, 'in-progress':0, 'needs-followup':0, na:0, none:0 };
        rows.forEach(r => { const s = getOTJStatus(r[phaseCol]); out[s]++; });
        return out;
      }
      const neBegD = phaseDistrib(d.neOtj, 'Beginning');

      // Network Progress Matrix (districts)
      const distMap = {};
      apps.forEach(a => {
        const dist = a.district || 'Unknown';
        if (!distMap[dist]) distMap[dist] = { beg:[], mid:[], end:[] };
        distMap[dist].beg.push(a.beg);
        distMap[dist].mid.push(a.mid);
        distMap[dist].end.push(a.end);
      });
      function phaseIcon(vals) {
        const done = vals.filter(v => getOTJStatus(v) === 'completed').length;
        const total = vals.filter(v => getOTJStatus(v) !== 'na').length || vals.length;
        const pctV = total ? Math.round(done/total*100) : 0;
        const bg = pctV === 100 ? '#D6EFD8' : pctV >= 50 ? '#FFF3CD' : '#FEE2E2';
        const color = pctV === 100 ? '#166534' : pctV >= 50 ? '#92400E' : '#991B1B';
        return `<td style="text-align:center;padding:.35rem .5rem;background:${bg};color:${color};font-weight:700;font-size:.8rem">${pctV}%</td>`;
      }

      // Action items
      const actions = [];
      apps.forEach(a => {
        ['beg','mid','end'].forEach((p,i) => {
          const label = ['Beginning','Middle','End'][i];
          if (getOTJStatus(a[p]) === 'needs-followup') {
            actions.push({ sev:'red', msg: `<strong>${a.name}</strong> — OTJ ${label} needs PM follow-up (${a.district || a.region})` });
          }
        });
        if (a.notes && a.notes.trim()) {
          actions.push({ sev:'amber', msg: `<strong>${a.name}</strong> — PM Note: ${a.notes.trim()}` });
        }
      });
      // Flag site leaders with no obs
      const slWithObs = new Set([
        ...d.neSLObs.map(r => (r['Site Leader']||'').trim()),
        ...d.swSLObs.map(r => (r['Site Leader']||'').trim())
      ]);
      const allSLs = new Set([...d.neOtj,...d.swOtj].map(r => (r['Site Leader']||'').trim()).filter(Boolean));
      allSLs.forEach(sl => {
        if (!slWithObs.has(sl)) actions.push({ sev:'amber', msg: `Site leader <strong>${sl}</strong> has no observation records on file` });
      });

      const sevIcon = { red:'🔴', amber:'🟡', green:'🟢' };

      let html = `
        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:1rem;margin-bottom:1.5rem">
          ${kpiCard(active, 'Apprentices Active', '#059669')}
          ${kpiCard(pct(begDone,total)+'%', 'OTJ Beginning Complete', begDone/total >= .7 ? '#059669' : '#d97706')}
          ${kpiCard(pct(midDone,total)+'%', 'OTJ Middle Complete',    midDone/total >= .5 ? '#059669' : '#d97706')}
          ${kpiCard(needsFU, 'Needing Follow-Up', needsFU > 0 ? '#b91c1c' : '#059669')}
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:1.5rem;margin-bottom:1.5rem">
          <div class="ta-card" style="padding:1rem">
            <div style="font-weight:700;color:#1B2A4A;margin-bottom:.75rem;font-size:.9rem">NE Region OTJ Progress</div>
            <div style="position:relative;height:150px"><canvas id="tdNeOtjChart"></canvas></div>
          </div>
          <div class="ta-card" style="padding:1rem">
            <div style="font-weight:700;color:#1B2A4A;margin-bottom:.75rem;font-size:.9rem">SW Region OTJ Progress</div>
            <div style="position:relative;height:150px"><canvas id="tdSwOtjChart"></canvas></div>
          </div>
        </div>
        <div class="ta-card" style="padding:1.25rem;margin-bottom:1.5rem">
          <div style="font-weight:700;color:#1B2A4A;margin-bottom:1rem;font-size:1rem">Network Progress Matrix</div>
          <div style="overflow-x:auto;max-height:220px;overflow-y:auto">
            <table style="width:100%;border-collapse:collapse;font-size:.82rem">
              <thead>
                <tr style="background:#1B2A4A;color:#fff">
                  <th style="text-align:left;padding:.5rem">District / Network</th>
                  <th style="text-align:center;padding:.5rem">Beginning</th>
                  <th style="text-align:center;padding:.5rem">Middle</th>
                  <th style="text-align:center;padding:.5rem">End</th>
                  <th style="text-align:center;padding:.5rem">Apprentices</th>
                </tr>
              </thead>
              <tbody>
                ${Object.entries(distMap).sort((a,b)=>a[0].localeCompare(b[0])).map(([dist,v]) => `
                  <tr style="border-bottom:1px solid #e5e7eb">
                    <td style="padding:.4rem .5rem;font-weight:600;color:#374151">${dist}</td>
                    ${phaseIcon(v.beg)}${phaseIcon(v.mid)}${phaseIcon(v.end)}
                    <td style="text-align:center;padding:.4rem;color:#6b7280">${v.beg.length}</td>
                  </tr>`).join('')}
              </tbody>
            </table>
          </div>
        </div>
        <div class="ta-card" style="padding:1.25rem;margin-bottom:1.5rem">
          <div style="font-weight:700;color:#1B2A4A;margin-bottom:.75rem;font-size:.9rem">Monthly Observation Coverage</div>
          <div style="position:relative;height:100px"><canvas id="tdObsCoverageChart"></canvas></div>
        </div>`;

      if (actions.length) {
        html += `<div class="ta-card" style="padding:1.25rem;margin-bottom:1.5rem">
          <div style="font-weight:700;color:#1B2A4A;margin-bottom:1rem;font-size:1rem">Action Items &amp; Flags</div>
          <div style="max-height:200px;overflow-y:auto">
          ${actions.slice(0,30).map(a => `
            <div style="display:flex;gap:.5rem;align-items:flex-start;padding:.5rem .625rem;background:${a.sev==='red'?'#fff5f5':'#fffbeb'};border-radius:6px;margin-bottom:.375rem;font-size:.83rem">
              <span>${sevIcon[a.sev]||'🟡'}</span>
              <span>${a.msg}</span>
            </div>`).join('')}
          </div>
          ${actions.length > 30 ? `<div style="font-size:.8rem;color:#6b7280;margin-top:.5rem">+ ${actions.length-30} more items</div>` : ''}
        </div>`;
      } else {
        html += `<div class="ta-card" style="padding:1.25rem;text-align:center;color:#059669;font-weight:600">🟢 No action items — all apprentices on track!</div>`;
      }

      // ── Dept-specific panel (Data = advanced analytics; Programming = site ops) ──
      const dept = getDept();
      if (dept === 'data') {
        // Export CSV helper
        const csvRows = apps.map(a => [a.name,a.region,a.district,a.school,a.sl,a.beg||'',a.mid||'',a.end||'',a.adp||'',a.obsCount,a.lastObs||''].join(','));
        const csvHeader = 'Name,Region,District,School,Site Leader,OTJ Beginning,OTJ Middle,OTJ End,ADP Status,Obs Count,Last Obs';
        const csvBlob = encodeURIComponent([csvHeader,...csvRows].join('\n'));
        html += `<div class="ta-card" style="padding:1.25rem;margin-top:1.5rem;border-top:3px solid #1B2A4A">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem;flex-wrap:wrap;gap:.5rem">
            <div style="font-weight:700;color:#1B2A4A;font-size:1rem">Data Dept — Advanced Apprenticeship Analytics</div>
            <a href="data:text/csv;charset=utf-8,${csvBlob}" download="njtc-apprentice-data.csv" class="btn btn-secondary btn-sm" style="font-size:.8rem;text-decoration:none">⬇ Download Apprentice CSV</a>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;margin-bottom:1rem">
            <div><canvas id="tdDataOtjPhaseChart" height="200"></canvas></div>
            <div><canvas id="tdDataObsFreqChart" height="200"></canvas></div>
          </div>
          <div style="overflow-x:auto">
            <table style="width:100%;border-collapse:collapse;font-size:.82rem">
              <thead><tr style="background:#1B2A4A;color:#fff">
                <th style="padding:.4rem;text-align:left">Name</th><th style="padding:.4rem">Region</th><th style="padding:.4rem">District</th>
                <th style="padding:.4rem;text-align:center">Beginning</th><th style="padding:.4rem;text-align:center">Middle</th><th style="padding:.4rem;text-align:center">End</th>
                <th style="padding:.4rem;text-align:center">Obs</th><th style="padding:.4rem;text-align:center">ADP</th>
              </tr></thead>
              <tbody>
                ${apps.map((a,i)=>`<tr style="border-bottom:1px solid #e5e7eb;${i%2?'background:#f9fafb':''}">
                  <td style="padding:.35rem .4rem;font-weight:600;color:#1B2A4A">${a.name}</td>
                  <td style="padding:.35rem .4rem;text-align:center"><span style="background:${a.region==='NE'?'#dbeafe':'#fef3c7'};color:${a.region==='NE'?'#1e40af':'#92400e'};padding:.1rem .4rem;border-radius:4px;font-size:.75rem;font-weight:700">${a.region}</span></td>
                  <td style="padding:.35rem .4rem;font-size:.78rem;color:#6b7280">${a.district||'—'}</td>
                  <td style="padding:.35rem;text-align:center">${otjStatusBadge(a.beg)}</td>
                  <td style="padding:.35rem;text-align:center">${otjStatusBadge(a.mid)}</td>
                  <td style="padding:.35rem;text-align:center">${otjStatusBadge(a.end)}</td>
                  <td style="padding:.35rem;text-align:center;font-weight:700;color:${a.obsCount>=3?'#059669':a.obsCount>=1?'#d97706':'#9ca3af'}">${a.obsCount}</td>
                  <td style="padding:.35rem;text-align:center">${adpStatusBadge(a.adp)}</td>
                </tr>`).join('')}
              </tbody>
            </table>
          </div>
        </div>`;
        // charts will be rendered after innerHTML set
        setTimeout(() => {
          // Phase completion bar chart
          const phases = ['Beginning','Middle','End'];
          const doneCounts = phases.map(p => {
            const key = p.toLowerCase().replace('beginning','beg').replace('middle','mid').replace('end','end');
            return apps.filter(a => getOTJStatus(a[key.slice(0,3) === 'beg' ? 'beg' : key.slice(0,3) === 'mid' ? 'mid' : 'end']) === 'completed').length;
          });
          makeChart('tdDataOtjPhaseChart', {
            type:'bar',
            data:{ labels:phases, datasets:[{ label:'Completed', data:doneCounts, backgroundColor:['#2A7D4F','#C9A84C','#1B2A4A'], borderRadius:4 }] },
            options:{ plugins:{ legend:{display:false}, title:{display:true,text:'OTJ Phase Completion Count'} }, responsive:true, maintainAspectRatio:false, scales:{ y:{ beginAtZero:true, ticks:{precision:0}, max:apps.length } } }
          });
          // Obs frequency distribution
          const obsBuckets = { '0':0,'1':0,'2':0,'3-4':0,'5+':0 };
          apps.forEach(a => {
            const c = a.obsCount;
            if (c===0) obsBuckets['0']++;
            else if (c===1) obsBuckets['1']++;
            else if (c===2) obsBuckets['2']++;
            else if (c<=4) obsBuckets['3-4']++;
            else obsBuckets['5+']++;
          });
          makeChart('tdDataObsFreqChart', {
            type:'bar',
            data:{ labels:Object.keys(obsBuckets), datasets:[{ label:'Apprentices', data:Object.values(obsBuckets), backgroundColor:'#457b9d', borderRadius:4 }] },
            options:{ plugins:{ legend:{display:false}, title:{display:true,text:'Observation Frequency Distribution'} }, responsive:true, maintainAspectRatio:false, scales:{ y:{ beginAtZero:true, ticks:{precision:0} } } }
          });
        }, 100);
      } else if (dept === 'programming') {
        // Group by site leader for Programming dept
        const slMap = {};
        apps.forEach(a => {
          const sl = a.sl || 'Unassigned';
          if (!slMap[sl]) slMap[sl] = { sl, district:a.district, school:a.school, link:a.link, tutors:[] };
          slMap[sl].tutors.push(a);
        });
        html += `<div class="ta-card" style="padding:1.25rem;margin-top:1.5rem;border-top:3px solid #C9A84C">
          <div style="font-weight:700;color:#1B2A4A;font-size:1rem;margin-bottom:1rem">Programming Dept — Onsite Staff Apprenticeship Panel</div>
          ${Object.entries(slMap).sort((a,b)=>a[0].localeCompare(b[0])).map(([sl,info])=>`
            <div style="background:#fff;border:1px solid #e5e7eb;border-radius:8px;padding:1rem;margin-bottom:.75rem">
              <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:.5rem;margin-bottom:.5rem">
                <div>
                  <div style="font-weight:700;color:#1B2A4A">${sl}</div>
                  <div style="font-size:.8rem;color:#6b7280">${info.district||''}${info.school?' · '+info.school:''}</div>
                </div>
                ${info.link ? `<a href="${info.link}" target="_blank" rel="noopener" class="btn btn-secondary btn-sm" style="font-size:.75rem;text-decoration:none">📁 OTJ Checklist</a>` : ''}
              </div>
              <table style="width:100%;font-size:.82rem;border-collapse:collapse">
                <thead><tr style="background:#f3f4f6"><th style="text-align:left;padding:.3rem .4rem">Tutor</th><th style="padding:.3rem;text-align:center">Beginning</th><th style="padding:.3rem;text-align:center">Middle</th><th style="padding:.3rem;text-align:center">End</th><th style="padding:.3rem;text-align:center">Obs</th><th style="text-align:left;padding:.3rem .4rem">PM Notes</th></tr></thead>
                <tbody>
                  ${info.tutors.map((a,i)=>`<tr style="${i%2?'background:#f9fafb':''}">
                    <td style="padding:.3rem .4rem;font-weight:600;color:#1B2A4A">${a.name}</td>
                    <td style="padding:.3rem;text-align:center">${otjStatusBadge(a.beg)}</td>
                    <td style="padding:.3rem;text-align:center">${otjStatusBadge(a.mid)}</td>
                    <td style="padding:.3rem;text-align:center">${otjStatusBadge(a.end)}</td>
                    <td style="padding:.3rem;text-align:center;font-weight:700;color:${a.obsCount>=3?'#059669':a.obsCount>=1?'#d97706':'#9ca3af'}">${a.obsCount}</td>
                    <td style="padding:.3rem .4rem;font-size:.78rem;color:#6b7280;font-style:italic">${a.notes||'—'}</td>
                  </tr>`).join('')}
                </tbody>
              </table>
            </div>`).join('')}
        </div>`;
      }

      el.innerHTML = html;

      // Render charts
      setTimeout(() => {
        function donutCfg(rows, title) {
          const beg = rows.map(r => r['Beginning']||'');
          const mid = rows.map(r => r['Middle']||'');
          const en  = rows.map(r => r['End']||'');
          const all = [...beg,...mid,...en];
          const c = { completed:0,'in-progress':0,'needs-followup':0,na:0,none:0 };
          all.forEach(v => c[getOTJStatus(v)]++);
          return {
            type:'doughnut',
            data:{
              labels:['Completed','In Progress','Needs Follow-Up','N/A','Not Started'],
              datasets:[{ data:[c.completed,c['in-progress'],c['needs-followup'],c.na,c.none],
                backgroundColor:['#2A7D4F','#C9A84C','#C0392B','#8E9BAE','#d1d5db'] }]
            },
            options:{ plugins:{ legend:{ position:'right', labels:{ font:{size:11} } } }, cutout:'60%', responsive:true, maintainAspectRatio:false }
          };
        }
        makeChart('tdNeOtjChart', donutCfg(d.neOtj, 'NE'));
        makeChart('tdSwOtjChart', donutCfg(d.swOtj, 'SW'));
        makeChart('tdObsCoverageChart', {
          type:'bar',
          data:{
            labels: OBS_MONTH_LABELS,
            datasets:[
              { label:'NE', data:neObsCounts, backgroundColor:'#1B2A4A', borderRadius:3 },
              { label:'SW', data:swObsCounts, backgroundColor:'#C9A84C', borderRadius:3 }
            ]
          },
          options:{
            responsive:true, maintainAspectRatio:false,
            plugins:{ legend:{ position:'top' }, tooltip:{ mode:'index' } },
            scales:{ y:{ beginAtZero:true, ticks:{ precision:0 }, title:{ display:true, text:'Observation Events' } } }
          }
        });
      }, 50);
    } catch (e) {
      el.innerHTML = errorHTML(e.message, 'function(){_tdLoaded["otj-overview"]=false;renderOTJOverviewTab();}');
    }
  }


  // ══════════════════════════════════════════════════════════════════
  //  TAB 4 (new): APPRENTICE TRACKER
  // ══════════════════════════════════════════════════════════════════

  async function renderApprenticeTab() {
    const el = document.getElementById('td-content-apprentice');
    if (!el) return;
    el.innerHTML = loadingHTML('Loading apprentice roster…');
    try {
      const d = await fetchAllSheets();

      // Build canonical apprentice records
      const appMap = {};
      function ensureApp(name, region) {
        if (!appMap[name]) appMap[name] = { name, region, district:'', school:'', sl:'', beg:'', mid:'', end:'', link:'', notes:'', adp:'Active', obsCount:0, lastObs:'' };
      }
      // Initialize from master lists
      APPRENTICES_NE.forEach(n => ensureApp(n,'NE'));
      APPRENTICES_SW.forEach(n => ensureApp(n,'SW'));
      // Overlay OTJ data
      function overlayOtj(r, region) {
        const rawName = ((r['Tutor First']||'').trim() + ' ' + (r['Tutor Last (ADP)']||'').trim()).trim();
        const name = normalizeApprenticeName(rawName);
        if (!name || !appMap[name]) return;
        const a = appMap[name];
        a.district = a.district || r['District'] || '';
        a.school   = a.school   || r['School']   || '';
        a.sl       = a.sl       || r['Site Leader'] || '';
        a.beg      = a.beg      || r['Beginning'] || '';
        a.mid      = a.mid      || r['Middle']    || '';
        a.end      = a.end      || r['End']       || '';
        a.link     = a.link     || r['OTJ Checklist Link'] || '';
        a.notes    = a.notes    || r['PM Notes']  || '';
        if (r['ADP Status']) a.adp = r['ADP Status'];
      }
      d.neOtj.forEach(r => overlayOtj(r,'NE'));
      d.swOtj.forEach(r => overlayOtj(r,'SW'));

      // Overlay observation counts from NE Tutor Obs
      const NE_OBS_MONTHS = ['October','November','December','January','February','March','April','May','June'];
      const SW_OBS_COLS   = ['October Obs #1','November Obs #1','December Comments','January Comments','February Obs #1','March Obs #1','April Obs #1'];
      const MONTH_LABELS  = ['Oct','Nov','Dec','Jan','Feb','Mar','Apr','May','Jun'];
      d.neTutorObs.forEach(r => {
        const name = normalizeApprenticeName(r['Tutor Name (ADP)'] || r[Object.keys(r)[0]] || '');
        if (!name || !appMap[name]) return;
        let cnt = 0, lastM = '';
        NE_OBS_MONTHS.forEach((m,i) => { if ((r[m]||'').trim()) { cnt++; lastM = MONTH_LABELS[i]; } });
        appMap[name].obsCount += cnt;
        if (lastM) appMap[name].lastObs = lastM;
      });
      d.swTutorObs.forEach(r => {
        const name = normalizeApprenticeName(r['Tutor Name'] || '');
        if (!name || !appMap[name]) return;
        let cnt = 0, lastM = '';
        SW_OBS_COLS.forEach((m,i) => { if ((r[m]||'').trim()) { cnt++; lastM = MONTH_LABELS[i]; } });
        appMap[name].obsCount += cnt;
        if (lastM) appMap[name].lastObs = lastM;
      });

      const apps = Object.values(appMap);
      const today = new Date().toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'});

      // Stats for narrative
      const neBegDone = APPRENTICES_NE.filter(n => appMap[n] && getOTJStatus(appMap[n].beg)==='completed').length;
      const neMidIP   = APPRENTICES_NE.filter(n => appMap[n] && getOTJStatus(appMap[n].mid)==='in-progress').length;
      const swBegDone = APPRENTICES_SW.filter(n => appMap[n] && getOTJStatus(appMap[n].beg)==='completed').length;
      const swMidIP   = APPRENTICES_SW.filter(n => appMap[n] && getOTJStatus(appMap[n].mid)==='in-progress').length;

      el.innerHTML = `
        <div style="display:flex;gap:.75rem;margin-bottom:1rem;flex-wrap:wrap;align-items:center">
          <div style="font-weight:700;color:#1B2A4A;font-size:.9rem">Region:</div>
          <button class="pst-tab active" id="apprRegAll" onclick="apprRegionFilter('all',this)" style="padding:.3rem .8rem;font-size:.8rem">All (${apps.length})</button>
          <button class="pst-tab" id="apprRegNE" onclick="apprRegionFilter('NE',this)" style="padding:.3rem .8rem;font-size:.8rem">NE (${APPRENTICES_NE.length})</button>
          <button class="pst-tab" id="apprRegSW" onclick="apprRegionFilter('SW',this)" style="padding:.3rem .8rem;font-size:.8rem">SW (${APPRENTICES_SW.length})</button>
          <div style="margin-left:auto;display:flex;gap:.5rem;align-items:center;flex-wrap:wrap">
            <select id="apprDistFilter" onchange="apprApplyFilter()" style="font-size:.8rem;padding:.3rem .5rem;border:1px solid #d1d5db;border-radius:6px">
              <option value="">All Districts</option>
              ${[...new Set(apps.map(a=>a.district).filter(Boolean))].sort().map(d=>`<option value="${d}">${d}</option>`).join('')}
            </select>
            <select id="apprPhaseFilter" onchange="apprApplyFilter()" style="font-size:.8rem;padding:.3rem .5rem;border:1px solid #d1d5db;border-radius:6px">
              <option value="">All OTJ Status</option>
              <option value="completed">Completed</option>
              <option value="in-progress">In Progress</option>
              <option value="needs-followup">Needs Follow-Up</option>
              <option value="none">Not Started</option>
            </select>
          </div>
        </div>
        <div style="overflow-x:auto;margin-bottom:1.5rem">
          <table id="apprMasterTable" style="width:100%;border-collapse:collapse;font-size:.85rem">
            <thead>
              <tr style="background:#1B2A4A;color:#fff">
                <th style="padding:.5rem .4rem;text-align:left;font-size:.75rem;text-transform:uppercase;letter-spacing:.04em">#</th>
                <th style="padding:.5rem .4rem;text-align:left;font-size:.75rem;text-transform:uppercase;letter-spacing:.04em">Name (ADP)</th>
                <th style="padding:.5rem .4rem;text-align:left;font-size:.75rem;text-transform:uppercase;letter-spacing:.04em">Region</th>
                <th style="padding:.5rem .4rem;text-align:left;font-size:.75rem;text-transform:uppercase;letter-spacing:.04em">District</th>
                <th style="padding:.5rem .4rem;text-align:left;font-size:.75rem;text-transform:uppercase;letter-spacing:.04em">Site Leader</th>
                <th style="padding:.5rem .4rem;text-align:center;font-size:.75rem;text-transform:uppercase;letter-spacing:.04em">Beginning</th>
                <th style="padding:.5rem .4rem;text-align:center;font-size:.75rem;text-transform:uppercase;letter-spacing:.04em">Middle</th>
                <th style="padding:.5rem .4rem;text-align:center;font-size:.75rem;text-transform:uppercase;letter-spacing:.04em">End</th>
                <th style="padding:.5rem .4rem;text-align:center;font-size:.75rem;text-transform:uppercase;letter-spacing:.04em">Obs</th>
                <th style="padding:.5rem .4rem;text-align:center;font-size:.75rem;text-transform:uppercase;letter-spacing:.04em">Last Obs</th>
                <th style="padding:.5rem .4rem;text-align:center;font-size:.75rem;text-transform:uppercase;letter-spacing:.04em">ADP</th>
                <th style="padding:.5rem .4rem;text-align:center;font-size:.75rem;text-transform:uppercase;letter-spacing:.04em">OTJ</th>
              </tr>
            </thead>
            <tbody id="apprTableBody">
              ${apps.map((a,i) => {
                const isTerminated = (a.adp||'').includes('Terminat');
                const borderColor  = isTerminated ? '#fca5a5' : '#bbf7d0';
                return `<tr class="appr-row" data-region="${a.region}" data-district="${a.district}" data-beg="${getOTJStatus(a.beg)}" data-mid="${getOTJStatus(a.mid)}" data-end="${getOTJStatus(a.end)}"
                  style="border-bottom:1px solid #e5e7eb;border-left:3px solid ${borderColor}">
                  <td style="padding:.4rem .4rem;color:#9ca3af">${i+1}</td>
                  <td style="padding:.4rem .4rem;font-weight:600;color:#1B2A4A">${a.name}</td>
                  <td style="padding:.4rem .4rem"><span style="background:${a.region==='NE'?'#dbeafe':'#fef3c7'};color:${a.region==='NE'?'#1e40af':'#92400e'};padding:.15rem .4rem;border-radius:4px;font-size:.75rem;font-weight:700">${a.region}</span></td>
                  <td style="padding:.4rem .4rem;font-size:.8rem;color:#374151">${a.district||'—'}</td>
                  <td style="padding:.4rem .4rem;font-size:.8rem;color:#374151">${a.sl||'—'}</td>
                  <td style="padding:.4rem;text-align:center">${otjStatusBadge(a.beg)}</td>
                  <td style="padding:.4rem;text-align:center">${otjStatusBadge(a.mid)}</td>
                  <td style="padding:.4rem;text-align:center">${otjStatusBadge(a.end)}</td>
                  <td style="padding:.4rem;text-align:center;font-weight:700;color:${a.obsCount>=3?'#059669':a.obsCount>=1?'#d97706':'#9ca3af'}">${a.obsCount}</td>
                  <td style="padding:.4rem;text-align:center;font-size:.8rem;color:#6b7280">${a.lastObs||'—'}</td>
                  <td style="padding:.4rem;text-align:center">${adpStatusBadge(a.adp)}</td>
                  <td style="padding:.4rem;text-align:center">${a.link ? `<a href="${a.link}" target="_blank" rel="noopener" style="font-size:1rem" title="Open OTJ Checklist">📁</a>` : '<span style="color:#d1d5db">—</span>'}</td>
                </tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>
        <div class="ta-card" style="padding:1.25rem;background:#f0f9ff;border-left:4px solid #1B2A4A">
          <div style="font-weight:700;color:#1B2A4A;margin-bottom:.75rem;font-size:.95rem">Program Narrative</div>
          <p style="font-size:.9rem;color:#374151;line-height:1.6;margin:0">
            As of <strong>${today}</strong>, <strong>${apps.length} apprentices</strong> are enrolled and active in the NJTC Apprenticeship Program.
            In the <strong>NE region</strong>, ${neBegDone} of ${APPRENTICES_NE.length} apprentices have completed the Beginning OTJ phase
            and ${neMidIP} are currently in progress on Middle.
            In the <strong>SW region</strong>, ${swBegDone} of ${APPRENTICES_SW.length} apprentices have completed Beginning
            and ${swMidIP} are in progress on Middle.
            ${apps.filter(a=>a.obsCount===0).length > 0 ? `<strong>${apps.filter(a=>a.obsCount===0).length} apprentices</strong> have not yet received any recorded observation.` : 'All apprentices have at least one recorded observation on file.'}
          </p>
        </div>`;

      // Store apps data for filter function
      window._apprApps = apps;
    } catch (e) {
      el.innerHTML = errorHTML(e.message, 'function(){_tdLoaded["apprentice"]=false;renderApprenticeTab();}');
    }
  }

  window.apprRegionFilter = function(region, btn) {
    document.querySelectorAll('#td-content-apprentice .pst-tab').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
    window._apprRegion = region;
    window.apprApplyFilter();
  };

  window.apprApplyFilter = function() {
    const region   = window._apprRegion || 'all';
    const dist     = (document.getElementById('apprDistFilter')  || {}).value || '';
    const phase    = (document.getElementById('apprPhaseFilter') || {}).value || '';
    document.querySelectorAll('.appr-row').forEach(row => {
      const rRegion = row.dataset.region || '';
      const rDist   = row.dataset.district || '';
      const rBeg    = row.dataset.beg || '';
      const rMid    = row.dataset.mid || '';
      const rEnd    = row.dataset.end || '';
      let show = true;
      if (region !== 'all' && rRegion !== region) show = false;
      if (dist && rDist !== dist) show = false;
      if (phase && rBeg !== phase && rMid !== phase && rEnd !== phase) show = false;
      row.style.display = show ? '' : 'none';
    });
  };


  // ══════════════════════════════════════════════════════════════════
  //  TAB 5 (new): TUTOR OBSERVATIONS
  // ══════════════════════════════════════════════════════════════════

  async function renderTutorObsTab() {
    const el = document.getElementById('td-content-tutor-obs');
    if (!el) return;
    el.innerHTML = loadingHTML('Loading tutor observation data…');
    try {
      const d = await fetchAllSheets();
      const NE_MONTHS = ['October','November','December','January','February','March','April','May','June'];
      const SW_MONTHS = ['October Obs #1','November Obs #1','December Comments','January Comments','February Obs #1','March Obs #1','April Obs #1'];
      const M_LABELS  = ['Oct','Nov','Dec','Jan','Feb','Mar','Apr','May','Jun'];
      const sheetBase = `https://docs.google.com/spreadsheets/d/${APPR_SHEET_ID}/edit#gid=`;

      function cellStyle(val) {
        if (!val || !val.trim()) return { icon:'', title:'No observation', bg:'#f9fafb', color:'#d1d5db' };
        const vl = val.toLowerCase();
        if (vl.includes('observation') || vl.match(/obs\s*#?\d*/)) return { icon:'🟢', title:val, bg:'#f0fdf4', color:'#166534' };
        return { icon:'📝', title:val, bg:'#eff6ff', color:'#1e40af' };
      }

      // NE: group by site leader section headers
      // Section headers = rows where only first column is populated
      let curSite = 'All Sites';
      const neByGroup = {};
      d.neTutorObs.forEach(r => {
        const name = (r['Tutor Name (ADP)'] || '').trim();
        // Check if this is a section header (non-month cols all empty)
        const hasMonthData = NE_MONTHS.some(m => r[m] && r[m].trim());
        if (name && !hasMonthData) {
          curSite = name;
          if (!neByGroup[curSite]) neByGroup[curSite] = [];
        } else if (name) {
          if (!neByGroup[curSite]) neByGroup[curSite] = [];
          neByGroup[curSite].push(r);
        }
      });

      // SW: group by Instructional Coach
      const swByCoach = {};
      d.swTutorObs.forEach(r => {
        const coach = (r['Instructional Coach'] || 'Unknown Coach').trim();
        if (!swByCoach[coach]) swByCoach[coach] = [];
        swByCoach[coach].push(r);
      });

      // Quality metrics
      const totalNEObs = NE_MONTHS.reduce((s,m) => s + d.neTutorObs.filter(r=>(r[m]||'').trim()).length, 0);
      const totalSWObs = SW_MONTHS.reduce((s,m) => s + d.swTutorObs.filter(r=>(r[m]||'').trim()).length, 0);
      const totalObs = totalNEObs + totalSWObs;
      const with1Obs  = [...d.neTutorObs,...d.swTutorObs].filter(r => {
        const cols = [...NE_MONTHS,...SW_MONTHS];
        return cols.some(m => (r[m]||'').trim());
      }).length;

      function heatmapTable(rows, monthKeys, monthLabels, gid, nameKey) {
        if (!rows.length) return '<div style="color:#9ca3af;padding:.5rem">No data found.</div>';
        return `<div style="overflow-x:auto">
          <table style="width:100%;border-collapse:collapse;font-size:.82rem">
            <thead><tr style="background:#f3f4f6">
              <th style="text-align:left;padding:.4rem .5rem;min-width:160px;font-size:.75rem;text-transform:uppercase;letter-spacing:.04em;color:#374151">Tutor Name</th>
              ${monthLabels.map(m=>`<th style="text-align:center;padding:.4rem .35rem;font-size:.75rem;color:#374151">${m}</th>`).join('')}
            </tr></thead>
            <tbody>
              ${rows.map((r,i) => {
                const name = (r[nameKey]||'').trim();
                const isResigned = name.toLowerCase().includes('(resigned)');
                return `<tr style="border-bottom:1px solid #e5e7eb;${i%2===1?'background:#f9fafb':''}${isResigned?'opacity:.6':''}">
                  <td style="padding:.35rem .5rem;font-weight:600;color:${isResigned?'#9ca3af':'#1B2A4A'};${isResigned?'text-decoration:line-through':''}">${name}${isResigned?'<span style="margin-left:.25rem;font-size:.7rem;background:#fee2e2;color:#991B1B;padding:.1rem .3rem;border-radius:3px;font-weight:700">RESIGNED</span>':''}</td>
                  ${monthKeys.map((m,mi) => {
                    const val = (r[m]||'').trim();
                    const cs = cellStyle(val);
                    return `<td style="text-align:center;padding:.3rem;background:${cs.bg}" title="${cs.title||'No observation'}">
                      <a href="${sheetBase}${gid}" target="_blank" rel="noopener" style="text-decoration:none;font-size:1rem">${cs.icon||'⬜'}</a>
                    </td>`;
                  }).join('')}
                </tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>`;
      }

      el.innerHTML = `
        <div class="ta-grid ta-grid-4" style="margin-bottom:1.25rem">
          ${kpiCard(totalObs,'Total Obs Events','#059669')}
          ${kpiCard(totalNEObs,'NE Observations','#1B2A4A')}
          ${kpiCard(totalSWObs,'SW Observations','#C9A84C')}
          ${kpiCard(pct(with1Obs,d.neTutorObs.length+d.swTutorObs.length)+'%','Apprentices w/ ≥1 Obs',with1Obs/(d.neTutorObs.length+d.swTutorObs.length||1)>=.8?'#059669':'#d97706')}
        </div>
        <div style="display:flex;gap:.5rem;margin-bottom:1rem">
          <button class="pst-tab active" id="tdObsTabNE" onclick="tdObsSubTab('NE',this)" style="font-size:.85rem">NE Observations</button>
          <button class="pst-tab" id="tdObsTabSW" onclick="tdObsSubTab('SW',this)" style="font-size:.85rem">SW Observations</button>
        </div>
        <div id="tdObsContentNE">
          ${Object.keys(neByGroup).length === 0
            ? '<div style="color:#9ca3af">No NE observation data found.</div>'
            : Object.entries(neByGroup).map(([site, rows]) => `
              <div style="margin-bottom:1.5rem">
                <div style="font-weight:700;color:#1B2A4A;font-size:.9rem;padding:.4rem .75rem;background:#EDF1F8;border-left:3px solid #1B2A4A;margin-bottom:.5rem">${site}</div>
                ${heatmapTable(rows, NE_MONTHS, M_LABELS, APPR_GIDS.neTutorObs, 'Tutor Name (ADP)')}
              </div>`).join('')}
        </div>
        <div id="tdObsContentSW" style="display:none">
          ${Object.keys(swByCoach).length === 0
            ? '<div style="color:#9ca3af">No SW observation data found.</div>'
            : Object.entries(swByCoach).map(([coach, rows]) => `
              <div style="margin-bottom:1.5rem">
                <div style="font-weight:700;color:#1B2A4A;font-size:.9rem;padding:.4rem .75rem;background:#FEF3C7;border-left:3px solid #C9A84C;margin-bottom:.5rem">${coach}</div>
                ${heatmapTable(rows, SW_MONTHS, ['Oct','Nov','Dec','Jan','Feb','Mar','Apr'], APPR_GIDS.swTutorObs, 'Tutor Name')}
              </div>`).join('')}
        </div>`;
    } catch (e) {
      el.innerHTML = errorHTML(e.message, 'function(){_tdLoaded["tutor-obs"]=false;renderTutorObsTab();}');
    }
  }

  window.tdObsSubTab = function(region, btn) {
    document.querySelectorAll('#td-content-tutor-obs .pst-tab').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
    const neEl = document.getElementById('tdObsContentNE');
    const swEl = document.getElementById('tdObsContentSW');
    if (neEl) neEl.style.display = region==='NE' ? '' : 'none';
    if (swEl) swEl.style.display = region==='SW' ? '' : 'none';
  };


  // ══════════════════════════════════════════════════════════════════
  //  TAB 6 (new): SITE LEADER OBS
  // ══════════════════════════════════════════════════════════════════

  async function renderSLObsTab() {
    const el = document.getElementById('td-content-sl-obs');
    if (!el) return;
    el.innerHTML = loadingHTML('Loading site leader observation data…');
    try {
      const d = await fetchAllSheets();
      const ALL_MONTHS = ['October','November','December','January','February','March','April','May','June'];
      const M_SHORT    = ['Oct','Nov','Dec','Jan','Feb','Mar','Apr','May','Jun'];

      // Group NE by district
      const neByDist = {};
      d.neSLObs.forEach(r => {
        const dist = (r['District']||'Unknown').trim();
        if (!neByDist[dist]) neByDist[dist] = {};
        const sl = (r['Site Leader']||'').trim();
        if (!sl) return;
        if (!neByDist[dist][sl]) neByDist[dist][sl] = { school: r['School']||'', months:[], folder:'', form:'' };
        const entry = neByDist[dist][sl];
        if (r['Observation Month']) entry.months.push({ month: r['Observation Month'], notes: r['Notes']||'', folder: r['Link to Observation Folder']||'', form: r['Link to Google Form']||'' });
        entry.folder = entry.folder || r['Link to Observation Folder'] || '';
        entry.form   = entry.form   || r['Link to Google Form'] || '';
      });

      // Group SW by district
      const swByDist = {};
      d.swSLObs.forEach(r => {
        const dist = (r['District']||'Unknown').trim();
        if (!swByDist[dist]) swByDist[dist] = {};
        const sl = (r['Site Leader']||'').trim();
        if (!sl) return;
        if (!swByDist[dist][sl]) swByDist[dist][sl] = { school: r['School']||'', obs:[], notes:'' };
        const entry = swByDist[dist][sl];
        entry.notes = r['Notes'] || entry.notes;
        ['Observation #1','Observation #2','Observation #3'].forEach(c => {
          if (r[c] && r[c].trim()) entry.obs.push(r[c].trim());
        });
        entry.folder = r['Link to Folder'] || entry.folder || '';
      });

      // Flag SLs with no obs (NE: no months logged; SW: no obs entries)
      const flaggedNE = [], flaggedSW = [];
      Object.entries(neByDist).forEach(([dist,sls]) => {
        Object.entries(sls).forEach(([sl,info]) => {
          if (info.months.length === 0) flaggedNE.push({ sl, dist, school:info.school });
        });
      });
      Object.entries(swByDist).forEach(([dist,sls]) => {
        Object.entries(sls).forEach(([sl,info]) => {
          if (info.obs.length === 0) flaggedSW.push({ sl, dist, school:info.school });
        });
      });

      function slCard(sl, info, region) {
        const obsMonths = region==='NE' ? info.months.map(m=>m.month) : info.obs;
        const coverageBar = ALL_MONTHS.map((m,i) => {
          const obs = region==='NE'
            ? info.months.find(e => (e.month||'').toLowerCase().includes(m.toLowerCase()))
            : null;
          const hasSW = region==='SW' && info.obs.length > 0;
          const has = obs || (region==='SW' && i < info.obs.length);
          return `<span title="${m}" style="display:inline-block;width:28px;height:10px;border-radius:2px;margin:1px;background:${has?'#2A7D4F':'#e5e7eb'}" ></span>`;
        }).join('');

        return `<div style="background:#fff;border:1px solid #e5e7eb;border-radius:8px;padding:1rem;margin-bottom:.75rem">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:.5rem;flex-wrap:wrap;gap:.5rem">
            <div>
              <div style="font-weight:700;color:#1B2A4A;font-size:.95rem">${sl}</div>
              <div style="font-size:.8rem;color:#6b7280">${info.school||info.dist||''}</div>
            </div>
            <div style="display:flex;gap:.5rem;flex-wrap:wrap">
              ${info.folder ? `<a href="${info.folder}" target="_blank" rel="noopener" class="btn btn-secondary btn-sm" style="font-size:.75rem;text-decoration:none">📁 Obs Folder</a>` : ''}
              ${info.form   ? `<a href="${info.form}"   target="_blank" rel="noopener" class="btn btn-secondary btn-sm" style="font-size:.75rem;text-decoration:none">📋 Form</a>` : ''}
            </div>
          </div>
          <div style="margin-bottom:.5rem">${coverageBar}</div>
          ${region==='NE' && info.months.length > 0 ? info.months.map(e=>`
            <div style="font-size:.8rem;color:#374151;padding:.25rem 0;border-bottom:1px solid #f3f4f6">
              <span style="font-weight:600;color:#1B2A4A">${e.month}:</span> ${e.notes||'Observed'}
            </div>`).join('') : ''}
          ${region==='SW' && info.obs.length > 0 ? `<div style="font-size:.8rem;color:#374151;margin-top:.25rem">${info.obs.join(' · ')}</div>` : ''}
          ${info.notes ? `<div style="font-size:.8rem;color:#6b7280;margin-top:.25rem;font-style:italic">${info.notes}</div>` : ''}
        </div>`;
      }

      el.innerHTML = `
        <div style="display:flex;gap:.5rem;margin-bottom:1rem">
          <button class="pst-tab active" id="tdSLTabNE" onclick="tdSLSubTab('NE',this)" style="font-size:.85rem">NE Site Leaders</button>
          <button class="pst-tab" id="tdSLTabSW" onclick="tdSLSubTab('SW',this)" style="font-size:.85rem">SW Site Leaders</button>
        </div>
        <div id="tdSLContentNE">
          ${Object.keys(neByDist).length === 0 ? '<div style="color:#9ca3af">No NE site leader data found.</div>' :
            Object.entries(neByDist).sort((a,b)=>a[0].localeCompare(b[0])).map(([dist,sls]) => `
              <div style="margin-bottom:1.5rem">
                <div style="font-weight:700;color:#fff;font-size:.9rem;padding:.5rem .75rem;background:#1B2A4A;border-radius:6px 6px 0 0;margin-bottom:.5rem">${dist}</div>
                ${Object.entries(sls).map(([sl,info]) => slCard(sl,info,'NE')).join('')}
              </div>`).join('')}
          ${flaggedNE.length > 0 ? `<div style="background:#fff5f5;border:1px solid #fca5a5;border-radius:8px;padding:1rem;margin-top:1rem">
            <div style="font-weight:700;color:#991B1B;margin-bottom:.5rem">🔴 Site Leaders with No Observations on File</div>
            ${flaggedNE.map(f=>`<div style="font-size:.85rem;color:#7f1d1d;padding:.25rem 0">${f.sl} — ${f.dist}${f.school?' ('+f.school+')':''}</div>`).join('')}
          </div>` : ''}
        </div>
        <div id="tdSLContentSW" style="display:none">
          ${Object.keys(swByDist).length === 0 ? '<div style="color:#9ca3af">No SW site leader data found.</div>' :
            Object.entries(swByDist).sort((a,b)=>a[0].localeCompare(b[0])).map(([dist,sls]) => `
              <div style="margin-bottom:1.5rem">
                <div style="font-weight:700;color:#fff;font-size:.9rem;padding:.5rem .75rem;background:#1B2A4A;border-radius:6px 6px 0 0;margin-bottom:.5rem">${dist}</div>
                ${Object.entries(sls).map(([sl,info]) => slCard(sl,info,'SW')).join('')}
              </div>`).join('')}
          ${flaggedSW.length > 0 ? `<div style="background:#fff5f5;border:1px solid #fca5a5;border-radius:8px;padding:1rem;margin-top:1rem">
            <div style="font-weight:700;color:#991B1B;margin-bottom:.5rem">🔴 Site Leaders with No Observations on File</div>
            ${flaggedSW.map(f=>`<div style="font-size:.85rem;color:#7f1d1d;padding:.25rem 0">${f.sl} — ${f.dist}${f.school?' ('+f.school+')':''}</div>`).join('')}
          </div>` : ''}
        </div>`;
    } catch (e) {
      el.innerHTML = errorHTML(e.message, 'function(){_tdLoaded["sl-obs"]=false;renderSLObsTab();}');
    }
  }

  window.tdSLSubTab = function(region, btn) {
    document.querySelectorAll('#td-content-sl-obs .pst-tab').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
    const neEl = document.getElementById('tdSLContentNE');
    const swEl = document.getElementById('tdSLContentSW');
    if (neEl) neEl.style.display = region==='NE' ? '' : 'none';
    if (swEl) swEl.style.display = region==='SW' ? '' : 'none';
  };


  // ══════════════════════════════════════════════════════════════════
  //  TAB 7 (new): DOCUMENT VAULT
  // ══════════════════════════════════════════════════════════════════

  async function renderDocVaultTab() {
    const el = document.getElementById('td-content-doc-vault');
    if (!el) return;
    el.innerHTML = loadingHTML('Loading document vault…');
    try {
      const d = await fetchAllSheets();

      // Build dynamic doc list from OTJ sheets
      const dynDocs = [];
      function extractLinks(rows, region) {
        rows.forEach(r => {
          const link = r['OTJ Checklist Link'] || '';
          const rawName = ((r['Tutor First']||'').trim() + ' ' + (r['Tutor Last (ADP)']||'').trim()).trim();
          const name = normalizeApprenticeName(rawName) || rawName;
          if (link && link.startsWith('http') && name) {
            dynDocs.push({ label: name + ' — OTJ Checklist', url: link, type:'OTJ Checklist', region, district: r['District']||'', tutor: name, month:'', sl: r['Site Leader']||'' });
          }
        });
      }
      extractLinks(d.neOtj, 'NE');
      extractLinks(d.swOtj, 'SW');

      // Combine static + dynamic, dedup by URL
      const seen = new Set();
      const allDocs = [];
      [...dynDocs,...VAULT_STATIC].forEach(doc => {
        if (!seen.has(doc.url)) { seen.add(doc.url); allDocs.push(doc); }
      });

      const allDistricts = [...new Set(allDocs.map(d=>d.district).filter(Boolean))].sort();
      const allTypes = [...new Set(allDocs.map(d=>d.type).filter(Boolean))].sort();

      function docCard(doc, idx) {
        const typeIcon = { 'OTJ Checklist':'📄','Observation':'👁','Folder':'📁','Form':'📋' };
        return `<div class="vault-card" data-region="${doc.region||''}" data-type="${doc.type||''}" data-district="${doc.district||''}" data-tutor="${doc.tutor||''}" data-search="${(doc.label||'').toLowerCase()} ${(doc.district||'').toLowerCase()} ${(doc.tutor||'').toLowerCase()} ${(doc.sl||'').toLowerCase()}"
          style="background:#fff;border:1px solid #e5e7eb;border-radius:8px;padding:1rem;display:flex;flex-direction:column;gap:.5rem">
          <div style="display:flex;align-items:flex-start;gap:.625rem">
            <span style="font-size:1.4rem">${typeIcon[doc.type]||'📄'}</span>
            <div style="flex:1">
              <div style="font-weight:700;color:#1B2A4A;font-size:.9rem;line-height:1.3">${doc.label}</div>
              <div style="font-size:.75rem;color:#6b7280;margin-top:.2rem">
                ${doc.type ? `<span style="background:#EDF1F8;color:#374151;padding:.1rem .4rem;border-radius:3px;margin-right:.3rem">${doc.type}</span>` : ''}
                ${doc.region && doc.region!=='All' ? `<span style="background:${doc.region==='NE'?'#dbeafe':'#fef3c7'};color:${doc.region==='NE'?'#1e40af':'#92400e'};padding:.1rem .4rem;border-radius:3px;margin-right:.3rem">${doc.region}</span>` : ''}
                ${doc.district ? `<span style="color:#374151">${doc.district}</span>` : ''}
              </div>
              ${doc.sl ? `<div style="font-size:.75rem;color:#6b7280;margin-top:.15rem">Site Leader: ${doc.sl}</div>` : ''}
            </div>
          </div>
          <div style="display:flex;gap:.5rem;margin-top:.25rem">
            <a href="${doc.url}" target="_blank" rel="noopener" class="btn btn-primary btn-sm" style="font-size:.75rem;text-decoration:none;flex:1;text-align:center">🔗 Open Document</a>
            <button onclick="navigator.clipboard.writeText('${doc.url.replace(/'/g,"\\'")}').then(()=>this.textContent='Copied!').catch(()=>{})" class="btn btn-secondary btn-sm" style="font-size:.75rem">📋</button>
          </div>
        </div>`;
      }

      el.innerHTML = `
        <div style="display:flex;gap:.5rem;flex-wrap:wrap;align-items:center;margin-bottom:1.25rem;padding:.875rem;background:#f9fafb;border-radius:8px">
          <input id="vaultSearch" type="text" placeholder="Search documents…" oninput="vaultApplyFilter()" style="flex:1;min-width:180px;padding:.4rem .75rem;border:1px solid #d1d5db;border-radius:6px;font-size:.85rem">
          <select id="vaultRegion" onchange="vaultApplyFilter()" style="padding:.4rem .5rem;border:1px solid #d1d5db;border-radius:6px;font-size:.82rem">
            <option value="">All Regions</option><option value="NE">NE</option><option value="SW">SW</option>
          </select>
          <select id="vaultType" onchange="vaultApplyFilter()" style="padding:.4rem .5rem;border:1px solid #d1d5db;border-radius:6px;font-size:.82rem">
            <option value="">All Types</option>${allTypes.map(t=>`<option value="${t}">${t}</option>`).join('')}
          </select>
          <select id="vaultDistrict" onchange="vaultApplyFilter()" style="padding:.4rem .5rem;border:1px solid #d1d5db;border-radius:6px;font-size:.82rem">
            <option value="">All Districts</option>${allDistricts.map(d=>`<option value="${d}">${d}</option>`).join('')}
          </select>
          <span id="vaultCount" style="font-size:.8rem;color:#6b7280;white-space:nowrap">${allDocs.length} documents</span>
        </div>
        <div id="vaultGrid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:1rem">
          ${allDocs.map((doc,i) => docCard(doc,i)).join('')}
        </div>`;
    } catch (e) {
      el.innerHTML = errorHTML(e.message, 'function(){_tdLoaded["doc-vault"]=false;renderDocVaultTab();}');
    }
  }

  window.vaultApplyFilter = function() {
    const search   = (document.getElementById('vaultSearch')   || {}).value || '';
    const region   = (document.getElementById('vaultRegion')   || {}).value || '';
    const type     = (document.getElementById('vaultType')     || {}).value || '';
    const district = (document.getElementById('vaultDistrict') || {}).value || '';
    const sq = search.toLowerCase();
    let visible = 0;
    document.querySelectorAll('.vault-card').forEach(card => {
      const rRegion = card.dataset.region || '';
      const rType   = card.dataset.type   || '';
      const rDist   = card.dataset.district || '';
      const rSearch = card.dataset.search   || '';
      let show = true;
      if (region   && rRegion !== region && rRegion !== 'All')   show = false;
      if (type     && rType !== type)       show = false;
      if (district && rDist !== district)   show = false;
      if (sq       && !rSearch.includes(sq)) show = false;
      card.style.display = show ? '' : 'none';
      if (show) visible++;
    });
    const cnt = document.getElementById('vaultCount');
    if (cnt) cnt.textContent = visible + ' documents';
  };



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
          case 'pd':           renderPDTab();          break;
          case 'intake':       renderIntakeTab();      break;
          case 'otj-overview': renderOTJOverviewTab(); break;
          case 'apprentice':   renderApprenticeTab();  break;
          case 'tutor-obs':    renderTutorObsTab();    break;
          case 'sl-obs':       renderSLObsTab();       break;
          case 'doc-vault':    renderDocVaultTab();    break;
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
    const intNew     = intRows.filter(r=>(r['Are you a new or returning hire?']||'').toLowerCase().includes('new')).length;
    const intReturn  = intRows.filter(r=>(r['Are you a new or returning hire?']||'').toLowerCase().includes('return')).length;

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
    const getS = k => k.midStatus || k.status || '';
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
        { label:'New Hires', fn: rows => rows.filter(r=>(r['Are you a new or returning hire?']||'').toLowerCase().includes('new')).length },
        { label:'Returning Hires', fn: rows => rows.filter(r=>(r['Are you a new or returning hire?']||'').toLowerCase().includes('return')).length },
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
        ${statRow('Training Intake Respondents', intTotal || '—', `${intNew} new hire · ${intReturn} returning`)}
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
            <div style="font-size:2rem;font-weight:900;color:${logoHex}">${intNew}</div>
            <div style="font-size:.8rem;color:#6b7280;margin-bottom:.75rem">New Hire respondents of ${intTotal} total</div>
            <div style="font-size:1.25rem;font-weight:800;color:#059669">${intReturn}</div>
            <div style="font-size:.8rem;color:#6b7280">Returning hire respondents</div>
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
      body { font-family: 'Segoe UI', Arial, sans-serif; margin: 0; padding: 2rem; color: #111; background: #fff; max-width: 900px; margin: 0 auto; }
      @media print { body { padding: .5in; } .no-print { display: none !important; } }
      h1 { font-size: 1.5rem; font-weight: 900; color: ${logoHex}; margin: 0; }
      .cover-bar { background: ${logoHex}; color: #fff; padding: 1.25rem 1.5rem; border-radius: 10px; margin-bottom: 1.5rem; display: flex; align-items: flex-end; justify-content: space-between; }
      .cover-sub { font-size: .8rem; opacity: .75; margin-top: .25rem; }
      .gold-badge { background: ${goldHex}; color: #fff; font-size: .7rem; font-weight: 800; padding: .25rem .75rem; border-radius: 20px; letter-spacing: .04em; }
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
