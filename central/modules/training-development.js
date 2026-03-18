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
          <div class="ta-card" style="padding:1.25rem">
            <div style="font-weight:700;color:#1B2A4A;margin-bottom:1rem;font-size:1rem">NE Region OTJ Progress</div>
            <canvas id="tdNeOtjChart" height="180"></canvas>
          </div>
          <div class="ta-card" style="padding:1.25rem">
            <div style="font-weight:700;color:#1B2A4A;margin-bottom:1rem;font-size:1rem">SW Region OTJ Progress</div>
            <canvas id="tdSwOtjChart" height="180"></canvas>
          </div>
        </div>
        <div class="ta-card" style="padding:1.25rem;margin-bottom:1.5rem">
          <div style="font-weight:700;color:#1B2A4A;margin-bottom:1rem;font-size:1rem">Network Progress Matrix</div>
          <div style="overflow-x:auto">
            <table style="width:100%;border-collapse:collapse;font-size:.85rem">
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
          <div style="font-weight:700;color:#1B2A4A;margin-bottom:1rem;font-size:1rem">Monthly Observation Coverage</div>
          <canvas id="tdObsCoverageChart" height="120"></canvas>
        </div>`;

      if (actions.length) {
        html += `<div class="ta-card" style="padding:1.25rem;margin-bottom:1.5rem">
          <div style="font-weight:700;color:#1B2A4A;margin-bottom:1rem;font-size:1rem">Action Items &amp; Flags</div>
          ${actions.slice(0,20).map(a => `
            <div style="display:flex;gap:.625rem;align-items:flex-start;padding:.625rem .75rem;background:${a.sev==='red'?'#fff5f5':'#fffbeb'};border-radius:8px;margin-bottom:.5rem;font-size:.88rem">
              <span>${sevIcon[a.sev]||'🟡'}</span>
              <span>${a.msg}</span>
            </div>`).join('')}
          ${actions.length > 20 ? `<div style="font-size:.8rem;color:#6b7280;margin-top:.5rem">+ ${actions.length-20} more items</div>` : ''}
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

  // tdGenerateExecPDF — stub (exec PDF not applicable for T&D module)
  function tdGenerateExecPDF() {
    alert('Apprenticeship PDF export coming soon.');
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
