/* ══════════════════════════════════════════════════════════════════════
   NJTC Partner Satisfaction — Survey Feedback Module
   sf-* namespace | Three views: Program, Leadership, Data
   NPS scale: 1–5 | Promoters=4–5, Passives=3, Detractors=1–2
══════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  const CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRDXSqdNLRz053Y3hmA2S8QqgLqUW5oN-YpaB-U74V2_DK2fcCva4q9Yan0YUgmpKSxHTrWlBYGpAfn/pub?gid=616402823&single=true&output=csv';

  const DISTRICT_MAP = {
    'Passaic Arts And Science Charter School': 'Passaic Arts and Science Charter School',
    'Passaic Clifton Arts and Science Charter School': 'Passaic Arts and Science Charter School',
    'Paterson Arts and Science(iLearn)': 'Paterson Arts and Science Charter School',
    'Bergen / iLearn Schools': 'Bergen Arts and Science Charter',
    'Haddon Township ': 'Haddon Township',
  };

  // ── State ──────────────────────────────────────────────────────────
  let _allData = [];
  let _loading = false, _loaded = false;
  let _view = 'program';
  let _filters = { quarters: [], district: '', school: '', role: '' };
  let _dataFilters = { quarters: [], district: '', school: '', role: '', satisfaction: '', npsMin: '', npsMax: '', hasDissat: '', hasFollowUp: '' };
  let _charts = {};
  let _rawSortCol = 'timestamp', _rawSortDir = -1;
  let _csvMeta = { headers: [], totalRaw: 0, quartersFound: [], rowsWithQuarter: 0 };

  // ── CSV Parser — RFC 4180 compliant ──────────────────────────────────────
  // Handles quoted fields with embedded commas, newlines, and "" escape sequences.
  // The previous line-split approach broke whenever a text-area response contained
  // a newline, shifting all subsequent column positions and losing the Quarter column.
  function parseCSV(text) {
    const rows = [];
    let row = [], cell = '', inQ = false;
    // Strip BOM if present
    let src = text.charCodeAt(0) === 0xFEFF ? text.slice(1) : text;

    for (let i = 0; i < src.length; i++) {
      const ch = src[i];
      if (ch === '"') {
        if (inQ && src[i + 1] === '"') {
          // Escaped double-quote inside quoted field
          cell += '"'; i++;
        } else {
          inQ = !inQ;
        }
      } else if (ch === ',' && !inQ) {
        row.push(cell); cell = '';
      } else if (!inQ && (ch === '\n' || ch === '\r')) {
        // Record separator — push current cell and finalise row
        row.push(cell); cell = '';
        if (row.some(c => c.trim())) rows.push(row);
        row = [];
        if (ch === '\r' && src[i + 1] === '\n') i++; // CRLF — skip \n
      } else {
        cell += ch; // plain char (embedded newline inside quotes also lands here via else path above is skipped because !inQ is false)
      }
    }
    // Trailing row (no final newline)
    if (cell || row.length) { row.push(cell); if (row.some(c => c.trim())) rows.push(row); }

    if (!rows.length) return [];
    const headers = rows[0].map(h => h.trim());
    return rows.slice(1).map(vals => {
      const obj = {};
      headers.forEach((h, idx) => { obj[h] = (vals[idx] !== undefined ? vals[idx].trim() : ''); });
      return obj;
    });
  }

  // ── Row normalization ──────────────────────────────────────────────
  // Helper: try a list of exact names then fall back to partial key match.
  // Handles Unicode ellipsis (…), smart quotes, and minor phrasing variants.
  function pickField(raw, exactNames, partialRe) {
    for (const n of exactNames) {
      const v = (raw[n] || '').trim();
      if (v) return v;
    }
    if (partialRe) {
      for (const k of Object.keys(raw)) {
        if (partialRe.test(k)) {
          const v = (raw[k] || '').trim();
          if (v) return v;
        }
      }
    }
    return '';
  }

  function normalizeRow(raw) {
    const district = normalizeDistrict(pickField(raw,
      ['District Name:', 'District Name', 'District', 'district'],
      /district/i));

    // Satisfaction level — the exact column name varies (may use Unicode … vs ASCII ...)
    const satisfactionLevel = pickField(raw,
      ['Reflecting on all NJTC/PATC experiences to date...',
       'Reflecting on all NJTC/PATC experiences to date\u2026',  // Unicode ellipsis
       'How would you rate your overall satisfaction?',
       'Overall Satisfaction', 'Satisfaction Level', 'Satisfaction'],
      /experiences to date|overall satisfaction|satisfaction level/i);

    // NPS question — try multiple phrasings
    const npsRaw = pickField(raw,
      ['Would you recommend NJTC to a friend or a colleague?',
       'Would you recommend NJTC to a friend or colleague?',
       'Likelihood to Recommend', 'NPS', 'NPS Score',
       'How likely are you to recommend NJTC?'],
      /recommend.*njtc|likelihood.*recommend|nps/i);

    // Dissatisfaction reasons
    const dissatRaw = pickField(raw,
      ['If dissatisfied or very dissatisfied, please select the potential reason...',
       'If dissatisfied or very dissatisfied, please select the potential reason\u2026',
       'Dissatisfaction Reasons', 'Reason for Dissatisfaction'],
      /dissatisfi.*reason|reason.*dissatisfi/i);

    // Highlight / positive comment
    const highlightComment = pickField(raw,
      ["If you're satisfied... / If Neutral...",
       "If you\u2019re satisfied... / If Neutral...",   // smart apostrophe
       "If you're satisfied\u2026 / If Neutral\u2026",
       'Highlight Comment', 'Positive Comment', 'Comments'],
      /if you.?re satisfied|highlight comment|positive comment/i);

    // School name
    const school = (raw['School Name:'] || raw['School Name'] ||
                    pickField(raw, [], /school name/i) || '').trim();

    // Role
    const role = (raw['Role:'] || raw['Role'] ||
                  pickField(raw, [], /^role$/i) || '').trim();

    // Name
    const name = pickField(raw,
      ['Feel free to leave your name below...',
       'Feel free to leave your name below\u2026',
       'Name', 'Full Name', 'Your Name'],
      /leave your name|your name/i);

    return {
      timestamp:               raw['Timestamp'] || raw['timestamp'] || '',
      email:                   raw['Email Address'] || raw['email'] || '',
      district,
      school,
      role,
      name,
      npsScore:                parseInt(npsRaw) || 0,
      satisfactionLevel,
      highlightComment,
      dissatisfactionReasons:  dissatRaw.split(',').map(s => s.trim()).filter(Boolean),
      dissatisfactionCategory: pickField(raw,
        ['If applicable, which category describes the source...',
         'If applicable, which category describes the source\u2026',
         'Dissatisfaction Category'], /which category describes/i),
      improvementComment:      pickField(raw,
        ['How can we offer more support...',
         'How can we offer more support\u2026',
         'Improvement Suggestions'], /more support|improvement/i),
      followUpNote:            raw['Program Team Follow Up'] || raw['Follow Up Note'] || '',
      quarter:                 pickQuarter(raw),
    };
  }

  // Try every plausible name for the quarter column, then fall back to
  // position (column N = index 13), then scan all values for quarter-like text.
  function pickQuarter(raw) {
    // 1. Named lookup — try all common variants (with/without colon, capitalisation)
    const names = [
      'Quarter Status', 'Quarter Status:', 'quarter status',
      'Quarter', 'Quarter:', 'Q Status', 'Q Status:',
      'Survey Quarter', 'Survey Quarter:', 'Survey Q',
    ];
    for (const n of names) {
      const v = (raw[n] || '').trim();
      if (v) return v;
    }
    // 2. Partial-key match — any key that contains the word "quarter" (case-insensitive)
    const keys = Object.keys(raw);
    for (const k of keys) {
      if (/quarter/i.test(k)) {
        const v = (raw[k] || '').trim();
        if (v) return v;
      }
    }
    // 3. Position-based fallback — column N is the 14th column (0-based index 13)
    if (keys.length >= 14) {
      const v = (raw[keys[13]] || '').trim();
      if (v) return v;
    }
    // 4. Content-scan fallback — find any column whose value looks like a quarter label
    //    e.g. "Quarter 1", "Q1", "Q2 2025", "Quarter Two", "Fall 2025", etc.
    const quarterPattern = /^(q\s*[1-4]|quarter\s*[0-9one two three four]+|[0-9]+\s*q|fall|spring|winter|summer)/i;
    for (const k of keys) {
      const v = (raw[k] || '').trim();
      if (quarterPattern.test(v)) return v;
    }
    return '';
  }

  function normalizeDistrict(d) {
    const trimmed = d.trim();
    return DISTRICT_MAP[d] || DISTRICT_MAP[trimmed] || trimmed;
  }

  // ── NPS Calculation ────────────────────────────────────────────────
  // Promoters=4–5 | Passives=3 | Detractors=1–2 | NPS=((P−D)/N)×100
  function calcNPS(rows) {
    const valid = rows.filter(r => r.npsScore >= 1 && r.npsScore <= 5);
    const promoters  = valid.filter(r => r.npsScore >= 4).length;
    const detractors = valid.filter(r => r.npsScore <= 2).length;
    const passives   = valid.filter(r => r.npsScore === 3).length;
    const total = valid.length;
    const nps = total === 0 ? null : Math.round(((promoters - detractors) / total) * 1000) / 10;
    return {
      promoters, detractors, passives, total, nps,
      promoterPct:  total ? +(promoters  / total * 100).toFixed(1) : 0,
      detractorPct: total ? +(detractors / total * 100).toFixed(1) : 0,
      passivePct:   total ? +(passives   / total * 100).toFixed(1) : 0,
    };
  }

  function npsColor(nps) {
    if (nps === null || nps === undefined) return '#7d8fa1';
    if (nps >= 50) return '#0d6e3a';
    if (nps >= 20) return '#c05c00';
    return '#b91c1c';
  }

  function npsBgColor(nps) {
    if (nps === null || nps === undefined) return '#f6f8fc';
    if (nps >= 50) return '#e6f5ed';
    if (nps >= 20) return '#fff0e0';
    return '#fee2e2';
  }

  function fmtNPS(nps) {
    if (nps === null || nps === undefined) return 'N/A';
    return (nps > 0 ? '+' : '') + nps;
  }

  function scoreCategory(s) {
    return s >= 4 ? 'Promoter' : s === 3 ? 'Passive' : 'Detractor';
  }

  // ── Privacy enforcement ────────────────────────────────────────────
  // Strip PII before passing to Program or Leadership views
  function pubData(rows) {
    return rows.map(r => Object.assign({}, r, { email: null, name: null, followUpNote: null }));
  }

  // ── Data access helpers ────────────────────────────────────────────
  function getQuarters() {
    return [...new Set(_allData.map(r => r.quarter).filter(Boolean))].sort();
  }

  function getDistricts(src) {
    return [...new Set((src || _allData).map(r => r.district).filter(Boolean))].sort();
  }

  function getSchools(district) {
    const src = district ? _allData.filter(r => r.district === district) : _allData;
    return [...new Set(src.map(r => r.school).filter(Boolean))].sort();
  }

  function getRoles() {
    return [...new Set(_allData.map(r => r.role).filter(Boolean))].sort();
  }

  function applyBaseFilters(rows, f) {
    return rows.filter(r => {
      if (f.quarters && f.quarters.length && !f.quarters.includes(r.quarter)) return false;
      if (f.district && r.district !== f.district) return false;
      if (f.school && r.school !== f.school) return false;
      if (f.role && r.role !== f.role) return false;
      return true;
    });
  }

  function filteredPublicData() {
    return applyBaseFilters(pubData(_allData), _filters);
  }

  function filteredRawData() {
    const f = _dataFilters;
    return applyBaseFilters(_allData, f).filter(r => {
      if (f.satisfaction && r.satisfactionLevel !== f.satisfaction) return false;
      if (f.npsMin && r.npsScore < parseInt(f.npsMin)) return false;
      if (f.npsMax && r.npsScore > parseInt(f.npsMax)) return false;
      if (f.hasDissat === 'yes' && !r.dissatisfactionReasons.length) return false;
      if (f.hasDissat === 'no'  &&  r.dissatisfactionReasons.length) return false;
      if (f.hasFollowUp === 'yes' && !r.followUpNote) return false;
      if (f.hasFollowUp === 'no'  &&  r.followUpNote) return false;
      return true;
    });
  }

  function qoqBreakdown(rows) {
    return getQuarters().map(q => {
      const qRows = rows.filter(r => r.quarter === q);
      const { nps, total } = calcNPS(qRows);
      const avgScore = qRows.length
        ? +(qRows.reduce((s, r) => s + r.npsScore, 0) / qRows.length).toFixed(2) : null;
      const avgSat = (() => {
        const map = {'Very Satisfied':5,'Satisfied':4,'Neutral':3,'Dissatisfied':2,'Very Dissatisfied':1};
        const vals = qRows.map(r => map[r.satisfactionLevel]).filter(Boolean);
        return vals.length ? +(vals.reduce((a,b) => a+b,0)/vals.length).toFixed(2) : null;
      })();
      return { quarter: q, nps, total, avgScore, avgSat };
    });
  }

  // ── Returning respondents (matched by email) ───────────────────────
  function getReturningRespondents(allRows) {
    const byEmail = {};
    allRows.forEach(r => {
      if (!r.email) return;
      if (!byEmail[r.email]) byEmail[r.email] = [];
      byEmail[r.email].push(r);
    });
    return Object.values(byEmail).filter(g => g.length > 1);
  }

  // ── Site risk logic ────────────────────────────────────────────────
  function siteRisk(recentRows, prevRows) {
    if (!recentRows.length) return 'healthy';
    const hasDetractor = recentRows.some(r => r.npsScore <= 2);
    const { nps: currNPS } = calcNPS(recentRows);
    const dissatCount = recentRows.filter(r =>
      ['Dissatisfied', 'Very Dissatisfied'].includes(r.satisfactionLevel)
    ).length;
    let qoqDrop = 0;
    if (prevRows && prevRows.length) {
      const { nps: prevNPS } = calcNPS(prevRows);
      if (prevNPS !== null && currNPS !== null) qoqDrop = prevNPS - currNPS;
    }
    if (hasDetractor || qoqDrop >= 20 || dissatCount >= 2) return 'at-risk';
    if ((currNPS !== null && currNPS < 20) || qoqDrop >= 10) return 'watch';
    return 'healthy';
  }

  function trajBadge(currNPS, prevNPS) {
    if (prevNPS === null || currNPS === null) return { label: '—', delta: 0, cls: 'stable' };
    const delta = Math.round((currNPS - prevNPS) * 10) / 10;
    if (delta > 5) return { label: '↑ Improving', delta, cls: 'improving' };
    if (delta < -5) return { label: '↓ Declining', delta, cls: 'declining' };
    return { label: '→ Stable', delta, cls: 'stable' };
  }

  // ── Chart management ───────────────────────────────────────────────
  function destroyChart(key) {
    if (_charts[key]) { try { _charts[key].destroy(); } catch (e) {} delete _charts[key]; }
  }

  function destroyAll() {
    Object.keys(_charts).forEach(destroyChart);
  }

  // ══════════════════════════════════════════════════════════════════
  // LIFECYCLE
  // ══════════════════════════════════════════════════════════════════

  function init() {
    // Inject PDF menu item styles
    if (!document.getElementById('sfPdfMenuStyle')) {
      const st = document.createElement('style');
      st.id = 'sfPdfMenuStyle';
      st.textContent = '.sf-pdf-menu-item{display:block;width:100%;padding:.45rem .875rem;font-size:.82rem;text-align:left;background:none;border:none;cursor:pointer;color:#1b2a4a;white-space:nowrap}.sf-pdf-menu-item:hover{background:#f1f5fb}';
      document.head.appendChild(st);
    }
    const _orig = window.showPanel;
    window.showPanel = function (id, btn) {
      _orig(id, btn);
      if (id === 'survey-feedback') onPanelOpen();
    };
  }

  function onPanelOpen() {
    if (_loading) return;
    if (!_loaded) { loadData(); return; }
    renderShell();
    renderCurrentView();
  }

  async function loadData() {
    _loading = true;
    const el = document.getElementById('sfContainer');
    if (el) el.innerHTML = `
      <div class="sf-loading">
        <div class="sf-spinner"></div>
        Loading partner satisfaction data…
      </div>`;
    try {
      const resp = await fetch(CSV_URL, { signal: AbortSignal.timeout(20000) });
      if (!resp.ok) throw new Error('HTTP ' + resp.status);
      const text = await resp.text();
      const rawRows = parseCSV(text);
      // Capture column metadata for diagnostics (stored on module, shown in UI)
      _csvMeta = { headers: rawRows.length ? Object.keys(rawRows[0]) : [], totalRaw: rawRows.length };
      if (rawRows.length) console.log('[SF] CSV column headers (' + _csvMeta.headers.length + '):', _csvMeta.headers);
      _allData = rawRows
        .map(normalizeRow)
        .filter(r => r.npsScore >= 1 && r.npsScore <= 5);
      const qSample = _allData.map(r => r.quarter).filter(Boolean);
      const qUnique = [...new Set(qSample)];
      console.log('[SF] Quarter values found (' + qSample.length + ' of ' + _allData.length + ' rows):', qUnique);
      _csvMeta.quartersFound = qUnique;
      _csvMeta.rowsWithQuarter = qSample.length;
      _loaded = true;
      detectView();
      renderShell();
      renderCurrentView();
    } catch (err) {
      const el2 = document.getElementById('sfContainer');
      if (el2) el2.innerHTML = `
        <div class="sf-error">
          <strong>Failed to load survey data.</strong><br>
          ${err.message}<br><br>
          <button class="btn btn-secondary" onclick="sfRetry()">↻ Retry</button>
        </div>`;
    } finally {
      _loading = false;
    }
  }

  window.sfRetry = function () { _loaded = false; destroyAll(); onPanelOpen(); };

  function detectView() {
    const dept = (window.NJTC_SESSION || {}).dept || 'data';
    if (dept === 'programming') _view = 'program';
    else if (['leadership', 'kb'].includes(dept)) _view = 'leadership';
    else _view = 'data';
  }

  // ══════════════════════════════════════════════════════════════════
  // SHELL / VIEW TABS
  // ══════════════════════════════════════════════════════════════════

  // ── Diagnostic banner — shown below view tabs when quarter detection is uncertain ──
  function _buildDiagBanner() {
    const m = _csvMeta;
    if (!m.headers.length) return '';
    const qCol = m.headers.find(h => /quarter/i.test(h)) || null;
    const ok = m.quartersFound.length > 0;
    if (ok) return ''; // all good — hide banner
    const colList = m.headers.map((h, i) => `<span title="Col ${i+1}" style="font-size:.7rem;background:#f1f5f9;border-radius:4px;padding:1px 5px;margin:2px">${h}</span>`).join(' ');
    return `<details style="margin:1rem;border:1px solid ${qCol ? '#f59e0b' : '#ef4444'};border-radius:8px;padding:.75rem 1rem;background:${qCol ? '#fffbeb' : '#fef2f2'}">
      <summary style="font-weight:700;cursor:pointer;color:${qCol ? '#b45309' : '#b91c1c'}">
        ⚠ Quarter Detection Issue — ${m.rowsWithQuarter} of ${_allData.length} rows have a quarter value
        ${qCol ? `(column "<strong>${qCol}</strong>" found but all values empty?)` : '(no column with "quarter" in the name was found)'}
      </summary>
      <div style="margin-top:.75rem;font-size:.82rem;line-height:1.8">
        <strong>CSV columns detected (${m.headers.length} total):</strong><br>
        <div style="margin-top:.4rem;display:flex;flex-wrap:wrap;gap:2px">${colList}</div>
        <div style="margin-top:.75rem">
          ${qCol
            ? `Column <strong>"${qCol}"</strong> was found but all values are empty. The admin needs to fill in the quarter values in Google Sheets.`
            : `No column containing "quarter" was found. In Google Sheets, the admin should ensure column N (or whatever column holds the quarter) is named something containing the word <strong>Quarter</strong> (e.g. "Quarter Status").`
          }
          <br>Quarter values should be exactly: <strong>Quarter 1</strong> / <strong>Quarter 2</strong> (or Q1 / Q2).
        </div>
      </div>
    </details>`;
  }

  function renderShell() {
    const el = document.getElementById('sfContainer');
    if (!el) return;
    el.innerHTML = `
      <div class="page-header">
        <div class="ph-text">
          <div class="ph-eyebrow">Survey Feedback</div>
          <div class="ph-title">Partner Satisfaction</div>
          <div class="ph-subtitle">
            Quarterly NPS-equivalent survey for partner schools, ADAs, Principals, and Teachers.
            <span style="color:var(--muted);font-size:.8em"> · Adapted NPS (1–5 Scale)</span>
          </div>
        </div>
        <div class="ph-actions">
          <button class="btn btn-secondary" onclick="sfRefresh()" title="Re-fetch data from Google Sheets">↻ Refresh</button>
          <div id="sfPdfDropWrap" style="position:relative;display:inline-block;margin-left:.5rem">
            <button class="btn btn-primary" id="sfPdfBtn" onclick="sfPdfMenuToggle()" title="Export PDF options">⬇ Export PDF ▾</button>
            <div id="sfPdfMenu" style="display:none;position:absolute;right:0;top:110%;z-index:200;background:#fff;border:1px solid #dde3ec;border-radius:10px;box-shadow:0 8px 24px rgba(0,0,0,.13);min-width:220px;overflow:hidden">
              <div style="padding:.4rem .75rem;font-size:.68rem;font-weight:700;letter-spacing:.08em;color:#7d8fa1;text-transform:uppercase;background:#f8fafc">INTERNAL REPORTS</div>
              <button onclick="sfExportPDF('leadership')" class="sf-pdf-menu-item">🏛 Leadership Report</button>
              <button onclick="sfExportPDF('program')"    class="sf-pdf-menu-item">📍 Program Team Report</button>
              <button onclick="sfExportPDF('data')"       class="sf-pdf-menu-item">🔬 Data Department Report</button>
              <div style="padding:.4rem .75rem;font-size:.68rem;font-weight:700;letter-spacing:.08em;color:#7d8fa1;text-transform:uppercase;background:#f8fafc">REGIONAL SUMMARIES</div>
              <button onclick="sfExportRegionPDF('NE')"   class="sf-pdf-menu-item">🗺 NE Region Summary</button>
              <button onclick="sfExportRegionPDF('SW')"   class="sf-pdf-menu-item">🗺 SW Region Summary</button>
              <div style="padding:.4rem .75rem;font-size:.68rem;font-weight:700;letter-spacing:.08em;color:#7d8fa1;text-transform:uppercase;background:#f8fafc">PARTNER REPORTS</div>
              ${getSchools().map(s => `<button onclick="sfExportPartnerPDF(${JSON.stringify(s)})" class="sf-pdf-menu-item">📄 ${s}</button>`).join('')}
            </div>
          </div>
        </div>
      </div>
      <div class="sf-view-tabs" role="tablist">
        <button class="sf-tab${_view === 'program' ? ' active' : ''}" data-view="program"
          onclick="sfSetView('program',this)" role="tab">
          <span>📍</span> Program Team
        </button>
        <button class="sf-tab${_view === 'leadership' ? ' active' : ''}" data-view="leadership"
          onclick="sfSetView('leadership',this)" role="tab">
          <span>🏛</span> Leadership
        </button>
        <button class="sf-tab${_view === 'data' ? ' active' : ''}" data-view="data"
          onclick="sfSetView('data',this)" role="tab">
          <span>🔬</span> Data Department
        </button>
      </div>
      <div id="sfViewContent"></div>
      ${_buildDiagBanner()}`;

  }

  window.sfSetView = function (v, btn) {
    _view = v;
    document.querySelectorAll('.sf-tab').forEach(b => b.classList.toggle('active', b.dataset.view === v));
    renderCurrentView();
  };

  window.sfRefresh = function () {
    _loaded = false;
    destroyAll();
    loadData();
  };

  function renderCurrentView() {
    const el = document.getElementById('sfViewContent');
    if (!el) return;
    destroyAll();
    if (_view === 'program') renderProgramView(el);
    else if (_view === 'leadership') renderLeadershipView(el);
    else renderDataView(el);
  }

  // ══════════════════════════════════════════════════════════════════
  // SHARED COMPONENTS
  // ══════════════════════════════════════════════════════════════════

  function npsHeroHTML(nd, label) {
    const { nps, promoters, detractors, passives, total,
            promoterPct, detractorPct, passivePct } = nd;
    const col = npsColor(nps);
    return `
      <div class="sf-nps-hero" style="border-left-color:${col}">
        <div class="sf-nps-hero-left">
          <div class="sf-nps-label">
            Adapted NPS (1–5 Scale)
            <span class="sf-info-icon" title="Promoters = 4 or 5, Passives = 3, Detractors = 1 or 2. Formula: ((Promoters − Detractors) / Total) × 100.">ℹ</span>
          </div>
          <div class="sf-nps-score" style="color:${col}">${fmtNPS(nps)}</div>
          <div class="sf-nps-n">n = ${total}</div>
          ${label ? `<div class="sf-nps-sublabel">${label}</div>` : ''}
        </div>
        <div class="sf-nps-breakdown">
          <div class="sf-stacked-bar-wrap">
            <div class="sf-stacked-bar">
              ${promoterPct  > 0 ? `<div style="width:${promoterPct}%;background:#0d6e3a;height:100%" title="Promoters (4–5): ${promoters}"></div>` : ''}
              ${passivePct   > 0 ? `<div style="width:${passivePct}%;background:#c05c00;height:100%" title="Passives (3): ${passives}"></div>` : ''}
              ${detractorPct > 0 ? `<div style="width:${detractorPct}%;background:#b91c1c;height:100%" title="Detractors (1–2): ${detractors}"></div>` : ''}
            </div>
          </div>
          <div class="sf-nps-legend">
            <span class="sf-legend-dot" style="background:#0d6e3a"></span>
            Promoters&nbsp;<strong>${promoterPct}%</strong> (${promoters})
            &ensp;
            <span class="sf-legend-dot" style="background:#c05c00"></span>
            Passives&nbsp;<strong>${passivePct}%</strong> (${passives})
            &ensp;
            <span class="sf-legend-dot" style="background:#b91c1c"></span>
            Detractors&nbsp;<strong>${detractorPct}%</strong> (${detractors})
          </div>
        </div>
      </div>`;
  }

  function declineWarning(allQoQ) {
    if (allQoQ.length < 2) return '';
    const last = allQoQ[allQoQ.length - 1];
    const prev = allQoQ[allQoQ.length - 2];
    if (last.nps !== null && prev.nps !== null && last.nps < prev.nps) {
      const drop = (prev.nps - last.nps).toFixed(1);
      return `<div class="sf-alert-bar">⚠ NPS dropped <strong>${drop} points</strong> from ${prev.quarter} to ${last.quarter} — monitor closely.</div>`;
    }
    return '';
  }

  function filterBarHTML(showSchool) {
    const quarters = getQuarters();
    const districts = getDistricts();
    const schools = getSchools(_filters.district);
    const roles = getRoles();
    return `
      <div class="sf-filter-bar">
        <div class="sf-filter-group">
          <div class="sf-filter-label">Quarter</div>
          <div class="sf-chips" id="sfQuarterChips">
            <button class="sf-chip${!_filters.quarters.length ? ' active' : ''}"
              onclick="sfQAll()">All</button>
            ${quarters.map(q => `
              <button class="sf-chip${_filters.quarters.includes(q) ? ' active' : ''}"
                onclick="sfQToggle('${q}')">${q}</button>`).join('')}
          </div>
        </div>
        <div class="sf-filter-group">
          <div class="sf-filter-label">District</div>
          <select class="filter-select" onchange="sfFSet('district',this.value)">
            <option value="">All Districts</option>
            ${districts.map(d => `<option value="${d}"${_filters.district===d?' selected':''}>${d}</option>`).join('')}
          </select>
        </div>
        ${showSchool ? `
        <div class="sf-filter-group">
          <div class="sf-filter-label">School</div>
          <select class="filter-select" onchange="sfFSet('school',this.value)">
            <option value="">All Schools</option>
            ${schools.map(s => `<option value="${s}"${_filters.school===s?' selected':''}>${s}</option>`).join('')}
          </select>
        </div>` : ''}
        <div class="sf-filter-group">
          <div class="sf-filter-label">Role</div>
          <select class="filter-select" onchange="sfFSet('role',this.value)">
            <option value="">All Roles</option>
            ${roles.map(r => `<option value="${r}"${_filters.role===r?' selected':''}>${r}</option>`).join('')}
          </select>
        </div>
        <button class="btn btn-secondary sf-clear-btn" onclick="sfFClear()">Clear</button>
      </div>`;
  }

  // ── Filter handlers (program/leadership) ──────────────────────────
  window.sfQAll    = function () { _filters.quarters = []; renderCurrentView(); };
  window.sfQToggle = function (q) {
    // Single-select: clicking a quarter focuses on only that quarter; clicking again returns to All
    if (_filters.quarters.length === 1 && _filters.quarters[0] === q) {
      _filters.quarters = [];
    } else {
      _filters.quarters = [q];
    }
    renderCurrentView();
  };
  window.sfFSet   = function (k, v) {
    _filters[k] = v;
    if (k === 'district') _filters.school = '';
    renderCurrentView();
  };
  window.sfFClear = function () {
    _filters = { quarters: [], district: '', school: '', role: '' };
    renderCurrentView();
  };

  // ── Data view filter handlers ──────────────────────────────────────
  window.sfDQToggle = function (q) {
    // Single-select: clicking a quarter focuses on only that quarter; clicking again returns to All
    if (_dataFilters.quarters.length === 1 && _dataFilters.quarters[0] === q) {
      _dataFilters.quarters = [];
    } else {
      _dataFilters.quarters = [q];
    }
    renderCurrentView();
  };
  window.sfDQAll  = function () { _dataFilters.quarters = []; renderCurrentView(); };
  window.sfDFSet  = function (k, v) {
    _dataFilters[k] = v;
    if (k === 'district') _dataFilters.school = '';
    renderCurrentView();
  };
  window.sfDNPSRange = function (val) {
    if (!val) { _dataFilters.npsMin = ''; _dataFilters.npsMax = ''; }
    else { const p = val.split('-'); _dataFilters.npsMin = p[0]; _dataFilters.npsMax = p[1] || p[0]; }
    renderCurrentView();
  };
  window.sfDFClear = function () {
    _dataFilters = { quarters: [], district: '', school: '', role: '', satisfaction: '', npsMin: '', npsMax: '', hasDissat: '', hasFollowUp: '' };
    renderCurrentView();
  };


  // ══════════════════════════════════════════════════════════════════
  // VIEW A — PROGRAM TEAM
  // ══════════════════════════════════════════════════════════════════

  function renderProgramView(el) {
    const rows     = filteredPublicData();
    const allPub   = pubData(_allData);
    const allQoQ   = qoqBreakdown(allPub);
    const quarters = getQuarters();

    el.innerHTML = `
      ${filterBarHTML(true)}
      ${declineWarning(allQoQ)}

      <!-- A: NPS Snapshot -->
      <div class="sf-section">
        <div class="sf-section-hdr">
          <div class="sf-section-title">A &mdash; NPS Snapshot</div>
          <div class="sf-method">Adapted NPS (1–5 scale). Promoters = 4 or 5 | Passives = 3 | Detractors = 1 or 2.</div>
        </div>
        ${npsHeroHTML(calcNPS(rows))}
        <div class="sf-charts-row">
          <div class="sf-chart-card">
            <div class="sf-chart-title">Quarter-over-Quarter NPS</div>
            <div class="sf-chart-sub">All respondents across all quarters (unfiltered baseline)</div>
            <div class="sf-chart-wrap"><canvas id="sfProgTrend"></canvas></div>
          </div>
          <div class="sf-chart-card">
            <div class="sf-chart-title">Satisfaction Distribution</div>
            <div class="sf-chart-sub">Filtered respondents (n=${rows.length})</div>
            <div class="sf-chart-wrap"><canvas id="sfProgSat"></canvas></div>
          </div>
        </div>
      </div>

      <!-- B: Partner Health Cards -->
      <div class="sf-section">
        <div class="sf-section-hdr">
          <div class="sf-section-title">B &mdash; Partner Health Cards</div>
          <div class="sf-method">Risk flags auto-applied from most recent quarter scores, QoQ change, and satisfaction patterns. Sorted: 🔴 first.</div>
        </div>
        <div id="sfHealthCards" class="sf-cards-grid"></div>
      </div>

      <!-- C: Returning Respondents -->
      <div class="sf-section">
        <div class="sf-section-hdr">
          <div class="sf-section-title">C &mdash; Returning Respondents: Individual Trajectory</div>
          <div class="sf-method">Are the same people scoring us better or worse over time? Matched anonymously across quarters by email (email never displayed here).</div>
        </div>
        <div id="sfReturning" style="overflow-x:auto"></div>
      </div>

      <!-- D: Aggregate QoQ -->
      <div class="sf-section">
        <div class="sf-section-hdr">
          <div class="sf-section-title">D &mdash; Aggregate Trends &mdash; All Respondents</div>
          <div class="sf-method">Is the overall program improving each quarter regardless of who fills out the form?</div>
        </div>
        <div class="sf-chart-card" style="max-width:680px">
          <div class="sf-chart-title">NPS &amp; Avg Score by Quarter</div>
          <div class="sf-chart-wrap sf-chart-wrap-lg"><canvas id="sfProgAgg"></canvas></div>
        </div>
      </div>

      <!-- E: Role Breakdown -->
      <div class="sf-section">
        <div class="sf-section-hdr">
          <div class="sf-section-title">E &mdash; Role Satisfaction Breakdown</div>
          <div class="sf-method">Which roles are most satisfied? Which are at risk of souring the partnership?</div>
        </div>
        <div class="sf-chart-card" style="max-width:680px">
          <div class="sf-chart-title">NPS by Role</div>
          <div class="sf-chart-wrap"><canvas id="sfProgRole"></canvas></div>
        </div>
        <div class="sf-note-callout">
          "Other" respondents (e.g., instructional coaches) may reflect classroom-level friction not captured by ADAs or Principals.
        </div>
      </div>

      <!-- F: Action Queue -->
      <div class="sf-section">
        <div class="sf-section-hdr">
          <div class="sf-section-title">F &mdash; Action Queue</div>
          <div class="sf-method">Auto-surfaced responses where dissatisfaction reason is present, satisfaction = Dissatisfied/Very Dissatisfied, or improvement comment is non-empty. No names or emails shown.</div>
        </div>
        <div id="sfActionQueue" style="overflow-x:auto"></div>
      </div>`;

    setTimeout(() => {
      renderQoQChart('sfProgTrend', allQoQ);
      renderSatChart('sfProgSat', rows);
      renderHealthCards('sfHealthCards');
      renderReturningTable('sfReturning', false);
      renderAggChart('sfProgAgg', allQoQ);
      renderRoleChart('sfProgRole', allPub);
      renderActionQueue('sfActionQueue', rows);
    }, 50);
  }

  // ══════════════════════════════════════════════════════════════════
  // VIEW B — LEADERSHIP
  // ══════════════════════════════════════════════════════════════════

  function renderLeadershipView(el) {
    const rows   = filteredPublicData();
    const allPub = pubData(_allData);
    const allQoQ = qoqBreakdown(allPub);

    el.innerHTML = `
      ${filterBarHTML(false)}
      ${declineWarning(allQoQ)}

      <!-- A: Executive NPS Summary -->
      <div class="sf-section">
        <div class="sf-section-hdr">
          <div class="sf-section-title">A &mdash; Executive NPS Summary</div>
          <div class="sf-method">Adapted NPS (1–5 scale). Promoters = 4 or 5 | Passives = 3 | Detractors = 1 or 2.</div>
        </div>
        ${npsHeroHTML(calcNPS(rows))}
        <div class="sf-chart-card" style="max-width:680px;margin-top:1.25rem">
          <div class="sf-chart-title">Quarter-over-Quarter NPS Trend</div>
          <div class="sf-chart-wrap"><canvas id="sfLeadTrend"></canvas></div>
        </div>
      </div>

      <!-- B: District Risk Matrix -->
      <div class="sf-section">
        <div class="sf-section-hdr">
          <div class="sf-section-title">B &mdash; District Risk Matrix</div>
          <div class="sf-method">Risk levels based on score averages, detractor presence, and QoQ trend.</div>
        </div>
        <div class="sf-callout-warn">
          High Risk districts may not renew — recommend Program Team outreach before next quarter closes.
        </div>
        <div id="sfDistMatrix" style="overflow-x:auto"></div>
      </div>

      <!-- C: EOY Projection -->
      <div class="sf-section">
        <div class="sf-section-hdr">
          <div class="sf-section-title">C &mdash; End-of-Year NPS Projection</div>
          <div class="sf-method">Projected EOY NPS if current Q1→Q2 trajectory holds — for planning purposes only.</div>
        </div>
        <div class="sf-chart-card" style="max-width:680px">
          <div class="sf-chart-title">NPS Trend + EOY Projection (dashed)</div>
          <div class="sf-chart-wrap"><canvas id="sfLeadProj"></canvas></div>
        </div>
      </div>

      <!-- D: Role Summary -->
      <div class="sf-section">
        <div class="sf-section-hdr">
          <div class="sf-section-title">D &mdash; Role Satisfaction Summary (Network-Wide)</div>
          <div class="sf-method">NPS by role across the full network. "Other" respondents (e.g., instructional coaches) may signal classroom-level friction.</div>
        </div>
        <div class="sf-chart-card" style="max-width:680px">
          <div class="sf-chart-title">NPS by Role</div>
          <div class="sf-chart-wrap"><canvas id="sfLeadRole"></canvas></div>
        </div>
      </div>`;

    setTimeout(() => {
      renderQoQChart('sfLeadTrend', allQoQ);
      renderDistrictMatrix('sfDistMatrix');
      renderProjectionChart('sfLeadProj', allQoQ);
      renderRoleChart('sfLeadRole', allPub);
    }, 50);
  }

  // ══════════════════════════════════════════════════════════════════
  // VIEW C — DATA DEPARTMENT
  // ══════════════════════════════════════════════════════════════════

  function renderDataView(el) {
    const rows   = filteredRawData();
    const allQoQ = qoqBreakdown(_allData);
    const qs     = getQuarters();

    el.innerHTML = `
      <!-- Data dept full filter bar -->
      <div class="sf-filter-bar sf-filter-bar-wide">
        <div class="sf-filter-group">
          <div class="sf-filter-label">Quarter</div>
          <div class="sf-chips">
            <button class="sf-chip${!_dataFilters.quarters.length ? ' active' : ''}" onclick="sfDQAll()">All</button>
            ${qs.map(q => `<button class="sf-chip${_dataFilters.quarters.includes(q) ? ' active' : ''}" onclick="sfDQToggle('${q}')">${q}</button>`).join('')}
          </div>
        </div>
        <div class="sf-filter-group">
          <div class="sf-filter-label">District</div>
          <select class="filter-select" onchange="sfDFSet('district',this.value)">
            <option value="">All Districts</option>
            ${getDistricts().map(d => `<option value="${d}"${_dataFilters.district===d?' selected':''}>${d}</option>`).join('')}
          </select>
        </div>
        <div class="sf-filter-group">
          <div class="sf-filter-label">School</div>
          <select class="filter-select" onchange="sfDFSet('school',this.value)">
            <option value="">All Schools</option>
            ${getSchools(_dataFilters.district).map(s => `<option value="${s}"${_dataFilters.school===s?' selected':''}>${s}</option>`).join('')}
          </select>
        </div>
        <div class="sf-filter-group">
          <div class="sf-filter-label">Role</div>
          <select class="filter-select" onchange="sfDFSet('role',this.value)">
            <option value="">All Roles</option>
            ${getRoles().map(r => `<option value="${r}"${_dataFilters.role===r?' selected':''}>${r}</option>`).join('')}
          </select>
        </div>
        <div class="sf-filter-group">
          <div class="sf-filter-label">Satisfaction</div>
          <select class="filter-select" onchange="sfDFSet('satisfaction',this.value)">
            <option value="">All</option>
            ${['Very Satisfied','Satisfied','Neutral','Dissatisfied','Very Dissatisfied'].map(s =>
              `<option value="${s}"${_dataFilters.satisfaction===s?' selected':''}>${s}</option>`).join('')}
          </select>
        </div>
        <div class="sf-filter-group">
          <div class="sf-filter-label">NPS Range</div>
          <select class="filter-select" onchange="sfDNPSRange(this.value)">
            <option value="">1–5 (All)</option>
            <option value="1-2"${_dataFilters.npsMin==='1'?' selected':''}>1–2 (Detractors)</option>
            <option value="3-3"${_dataFilters.npsMin==='3'?' selected':''}>3 (Passives)</option>
            <option value="4-5"${_dataFilters.npsMin==='4'?' selected':''}>4–5 (Promoters)</option>
          </select>
        </div>
        <div class="sf-filter-group">
          <div class="sf-filter-label">Has Dissat. Reason</div>
          <select class="filter-select" onchange="sfDFSet('hasDissat',this.value)">
            <option value="">Any</option>
            <option value="yes"${_dataFilters.hasDissat==='yes'?' selected':''}>Yes</option>
            <option value="no"${_dataFilters.hasDissat==='no'?' selected':''}>No</option>
          </select>
        </div>
        <div class="sf-filter-group">
          <div class="sf-filter-label">Has Follow-Up Note</div>
          <select class="filter-select" onchange="sfDFSet('hasFollowUp',this.value)">
            <option value="">Any</option>
            <option value="yes"${_dataFilters.hasFollowUp==='yes'?' selected':''}>Yes</option>
            <option value="no"${_dataFilters.hasFollowUp==='no'?' selected':''}>No</option>
          </select>
        </div>
        <button class="btn btn-secondary sf-clear-btn" onclick="sfDFClear()">Clear All</button>
      </div>

      <!-- A: Full NPS Analytics -->
      <div class="sf-section">
        <div class="sf-section-hdr">
          <div class="sf-section-title">A &mdash; Full NPS Analytics</div>
          <div class="sf-method">Complete NPS breakdown with raw score histogram. Note: small sample sizes increase margin of error.</div>
        </div>
        ${npsHeroHTML(calcNPS(rows))}
        <div class="sf-charts-row" style="margin-top:1.25rem">
          <div class="sf-chart-card">
            <div class="sf-chart-title">Score Distribution (1–5)</div>
            <div class="sf-chart-sub">Raw counts — filtered respondents (n=${rows.length})</div>
            <div class="sf-chart-wrap"><canvas id="sfDataHist"></canvas></div>
          </div>
          <div class="sf-chart-card">
            <div class="sf-chart-title">Quarter-over-Quarter NPS</div>
            <div class="sf-chart-wrap"><canvas id="sfDataTrend"></canvas></div>
          </div>
        </div>
      </div>

      <!-- B: Raw Response Table -->
      <div class="sf-section">
        <div class="sf-section-hdr" style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:.5rem">
          <div>
            <div class="sf-section-title">B &mdash; Raw Response Table</div>
            <div class="sf-method">All columns including private data. Click column headers to sort. Row highlight: red = score 1–2, yellow = score 3.</div>
          </div>
          <button class="btn btn-primary" onclick="sfExportCSV()" style="font-size:.8125rem;align-self:center">
            ⬇ Export CSV
          </button>
        </div>
        <div id="sfRawTable" style="overflow-x:auto"></div>
      </div>

      <!-- C: Longitudinal Match Table -->
      <div class="sf-section">
        <div class="sf-section-hdr">
          <div class="sf-section-title">C &mdash; Longitudinal Match Table</div>
          <div class="sf-method">Respondents matched by email across quarters. Largest negative delta sorted first.</div>
        </div>
        <div id="sfLongTable" style="overflow-x:auto"></div>
      </div>

      <!-- D: Full Analytics Suite -->
      <div class="sf-section">
        <div class="sf-section-hdr">
          <div class="sf-section-title">D &mdash; Full Analytics Suite</div>
        </div>
        <div class="sf-charts-row">
          <div class="sf-chart-card">
            <div class="sf-chart-title">Dissatisfaction Reason Frequency</div>
            <div class="sf-chart-sub">Parsed from comma-separated field — all data, unfiltered</div>
            <div class="sf-chart-wrap sf-chart-wrap-lg"><canvas id="sfDataDissat"></canvas></div>
          </div>
          <div class="sf-chart-card">
            <div class="sf-chart-title">Satisfaction Distribution by Quarter</div>
            <div class="sf-chart-wrap sf-chart-wrap-lg"><canvas id="sfDataSatQ"></canvas></div>
          </div>
        </div>
        <div class="sf-section-sub-hdr" style="margin-top:1.5rem">
          District × Quarter NPS Heatmap
          <span class="sf-method" style="display:inline;margin-left:.5rem">NPS by district per quarter</span>
        </div>
        <div id="sfHeatmap" style="overflow-x:auto;margin-bottom:1.5rem"></div>
        <div class="sf-section-sub-hdr">Role NPS Breakdown (Full Network)</div>
        <div class="sf-chart-card" style="max-width:600px">
          <div class="sf-chart-wrap"><canvas id="sfDataRole"></canvas></div>
        </div>
      </div>`;

    setTimeout(() => {
      renderHistChart('sfDataHist', rows);
      renderQoQChart('sfDataTrend', allQoQ);
      renderRawTable('sfRawTable', rows);
      renderLongTable('sfLongTable');
      renderDissatChart('sfDataDissat', _allData);
      renderSatByQChart('sfDataSatQ');
      renderHeatmap('sfHeatmap');
      renderRoleChart('sfDataRole', _allData);
    }, 50);
  }


  // ══════════════════════════════════════════════════════════════════
  // CHART RENDERERS
  // ══════════════════════════════════════════════════════════════════

  function renderQoQChart(id, allQoQ) {
    const canvas = document.getElementById(id);
    if (!canvas) return;
    destroyChart(id);
    const labels = allQoQ.map(q => q.quarter);
    const vals   = allQoQ.map(q => q.nps);
    _charts[id] = new Chart(canvas, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: 'NPS',
          data: vals,
          borderColor: '#0050c8',
          backgroundColor: 'rgba(0,80,200,.08)',
          fill: true,
          tension: 0.3,
          pointBackgroundColor: vals.map(v => npsColor(v)),
          pointRadius: 6,
          pointHoverRadius: 8,
        }],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: ctx => `NPS: ${fmtNPS(ctx.parsed.y)}  (n=${allQoQ[ctx.dataIndex]?.total || 0})` } },
        },
        scales: {
          y: { min: -100, max: 100, grid: { color: '#eef1f6' },
            ticks: { callback: v => (v > 0 ? '+' : '') + v } },
          x: { grid: { display: false } },
        },
      },
    });
  }

  function renderSatChart(id, rows) {
    const canvas = document.getElementById(id);
    if (!canvas) return;
    destroyChart(id);
    const lvls   = ['Very Satisfied', 'Satisfied', 'Neutral', 'Dissatisfied', 'Very Dissatisfied'];
    const colors = ['#0d6e3a', '#4ade80', '#c05c00', '#f97316', '#b91c1c'];
    _charts[id] = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: ['Very Sat.', 'Satisfied', 'Neutral', 'Dissatisfied', 'Very Dissat.'],
        datasets: [{ data: lvls.map(l => rows.filter(r => r.satisfactionLevel === l).length),
          backgroundColor: colors, borderRadius: 6 }],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          y: { beginAtZero: true, ticks: { stepSize: 1 }, grid: { color: '#eef1f6' } },
          x: { grid: { display: false } },
        },
      },
    });
  }

  function renderAggChart(id, allQoQ) {
    const canvas = document.getElementById(id);
    if (!canvas) return;
    destroyChart(id);
    _charts[id] = new Chart(canvas, {
      type: 'line',
      data: {
        labels: allQoQ.map(q => q.quarter),
        datasets: [
          { label: 'NPS', data: allQoQ.map(q => q.nps),
            borderColor: '#0050c8', backgroundColor: 'rgba(0,80,200,.08)', fill: true, tension: 0.3, yAxisID: 'y' },
          { label: 'Avg Score (1–5)', data: allQoQ.map(q => q.avgScore),
            borderColor: '#f0a500', backgroundColor: 'transparent', tension: 0.3, yAxisID: 'y2',
            borderDash: [5, 3], pointStyle: 'rectRot', pointRadius: 5 },
          { label: 'Avg Satisfaction', data: allQoQ.map(q => q.avgSat),
            borderColor: '#7b2d8b', backgroundColor: 'transparent', tension: 0.3, yAxisID: 'y2',
            borderDash: [2, 4], pointStyle: 'triangle', pointRadius: 5 },
        ],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: true, position: 'bottom', labels: { font: { size: 11 } } } },
        scales: {
          y:  { min: -100, max: 100, position: 'left',  grid: { color: '#eef1f6' },
            ticks: { callback: v => (v > 0 ? '+' : '') + v } },
          y2: { min: 1, max: 5, position: 'right', grid: { display: false },
            title: { display: true, text: 'Score (1–5)' } },
          x: { grid: { display: false } },
        },
      },
    });
  }

  function renderRoleChart(id, rows) {
    const canvas = document.getElementById(id);
    if (!canvas) return;
    destroyChart(id);
    const roles = getRoles();
    const vals  = roles.map(r => calcNPS(rows.filter(row => row.role === r)).nps);
    const ns    = roles.map(r => rows.filter(row => row.role === r).length);
    _charts[id] = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: roles,
        datasets: [{ label: 'NPS', data: vals,
          backgroundColor: vals.map(v => v >= 50 ? 'rgba(13,110,58,.75)' : v >= 20 ? 'rgba(192,92,0,.75)' : 'rgba(185,28,28,.75)'),
          borderRadius: 6 }],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false },
          tooltip: { callbacks: { label: ctx => `NPS: ${fmtNPS(ctx.parsed.y)}  (n=${ns[ctx.dataIndex]})` } } },
        scales: {
          y: { min: -100, max: 100, grid: { color: '#eef1f6' },
            ticks: { callback: v => (v > 0 ? '+' : '') + v } },
          x: { grid: { display: false } },
        },
      },
    });
  }

  function renderHistChart(id, rows) {
    const canvas = document.getElementById(id);
    if (!canvas) return;
    destroyChart(id);
    const counts = [1, 2, 3, 4, 5].map(s => rows.filter(r => r.npsScore === s).length);
    const total  = rows.length;
    _charts[id] = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: ['1 (Detractor)', '2 (Detractor)', '3 (Passive)', '4 (Promoter)', '5 (Promoter)'],
        datasets: [{ data: counts,
          backgroundColor: ['#b91c1c', '#f97316', '#c05c00', '#4ade80', '#0d6e3a'],
          borderRadius: 6 }],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false },
          tooltip: { callbacks: { label: ctx => `${ctx.parsed.y} responses (${total ? Math.round(ctx.parsed.y / total * 100) : 0}%)` } } },
        scales: {
          y: { beginAtZero: true, ticks: { stepSize: 1 }, grid: { color: '#eef1f6' } },
          x: { grid: { display: false } },
        },
      },
    });
  }

  function renderProjectionChart(id, allQoQ) {
    const canvas = document.getElementById(id);
    if (!canvas) return;
    destroyChart(id);

    if (!allQoQ.length) {
      const wrap = canvas.closest('.sf-chart-card');
      if (wrap) wrap.innerHTML += '<div class="sf-empty" style="margin-top:.5rem">Not enough quarterly data for projection.</div>';
      return;
    }

    const actLabels = allQoQ.map(q => q.quarter);
    const actVals   = allQoQ.map(q => q.nps);
    const projLabels = [...actLabels];
    const projVals   = [];

    if (actVals.length >= 2) {
      const lastNPS = actVals[actVals.length - 1];
      const prevNPS = actVals[actVals.length - 2];
      const slope = (lastNPS !== null && prevNPS !== null) ? lastNPS - prevNPS : 0;
      for (let i = 1; i <= 2; i++) {
        projLabels.push('Q' + (actLabels.length + i) + ' (Proj.)');
        projVals.push(lastNPS !== null ? Math.round((lastNPS + slope * i) * 10) / 10 : null);
      }
    }

    const gap = projLabels.length - actLabels.length;
    const projData = new Array(Math.max(0, actLabels.length - 1)).fill(null)
      .concat(actVals.slice(-1))
      .concat(projVals);

    _charts[id] = new Chart(canvas, {
      type: 'line',
      data: {
        labels: projLabels,
        datasets: [
          { label: 'Actual NPS',
            data: actVals.concat(new Array(gap).fill(null)),
            borderColor: '#0050c8', backgroundColor: 'rgba(0,80,200,.08)', fill: true, tension: 0.3,
            pointRadius: 5 },
          { label: 'Projected NPS',
            data: projData,
            borderColor: '#9ca3af', borderDash: [6, 4], backgroundColor: 'transparent', tension: 0.3,
            pointRadius: 4, pointStyle: 'triangle' },
        ],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: true, position: 'bottom', labels: { font: { size: 11 } } } },
        scales: {
          y: { min: -100, max: 100, grid: { color: '#eef1f6' },
            ticks: { callback: v => (v > 0 ? '+' : '') + v } },
          x: { grid: { display: false } },
        },
      },
    });
  }

  function renderDissatChart(id, rows) {
    const canvas = document.getElementById(id);
    if (!canvas) return;
    destroyChart(id);
    const freq = {};
    rows.forEach(r => r.dissatisfactionReasons.forEach(reason => {
      if (reason) freq[reason] = (freq[reason] || 0) + 1;
    }));
    const sorted = Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 12);
    if (!sorted.length) {
      const wrap = canvas.parentElement;
      if (wrap) wrap.innerHTML = '<div class="sf-empty">No dissatisfaction reasons recorded.</div>';
      return;
    }
    _charts[id] = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: sorted.map(([k]) => k),
        datasets: [{ data: sorted.map(([, v]) => v),
          backgroundColor: 'rgba(185,28,28,.65)', borderRadius: 4 }],
      },
      options: {
        indexAxis: 'y',
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { beginAtZero: true, ticks: { stepSize: 1 }, grid: { color: '#eef1f6' } },
          y: { grid: { display: false }, ticks: { font: { size: 11 } } },
        },
      },
    });
  }

  function renderSatByQChart(id) {
    const canvas = document.getElementById(id);
    if (!canvas) return;
    destroyChart(id);
    const qs     = getQuarters();
    const lvls   = ['Very Satisfied', 'Satisfied', 'Neutral', 'Dissatisfied', 'Very Dissatisfied'];
    const colors = ['#0d6e3a', '#4ade80', '#c05c00', '#f97316', '#b91c1c'];
    _charts[id] = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: qs,
        datasets: lvls.map((l, i) => ({
          label: l,
          data: qs.map(q => _allData.filter(r => r.quarter === q && r.satisfactionLevel === l).length),
          backgroundColor: colors[i], borderRadius: 2,
        })),
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { position: 'bottom', labels: { font: { size: 11 } } } },
        scales: {
          x: { stacked: true, grid: { display: false } },
          y: { stacked: true, beginAtZero: true, grid: { color: '#eef1f6' } },
        },
      },
    });
  }


  // ══════════════════════════════════════════════════════════════════
  // SECTION RENDERERS
  // ══════════════════════════════════════════════════════════════════

  function renderHealthCards(containerId) {
    const el = document.getElementById(containerId);
    if (!el) return;

    const allPub  = pubData(_allData);
    const qs      = getQuarters();
    const recentQ = qs[qs.length - 1];
    const prevQ   = qs[qs.length - 2] || null;
    const schools = [...new Set(allPub.map(r => r.school).filter(Boolean))].sort();

    if (!schools.length) {
      el.innerHTML = '<div class="sf-empty">No school data available.</div>';
      return;
    }

    const cards = schools.map(school => {
      const all    = allPub.filter(r => r.school === school);
      const recent = recentQ ? all.filter(r => r.quarter === recentQ) : all;
      const prev   = prevQ   ? all.filter(r => r.quarter === prevQ)   : [];
      const dist   = (recent[0] || all[0] || {}).district || '';

      const { nps: currNPS, total } = calcNPS(recent);
      const { nps: prevNPS }        = calcNPS(prev);
      const risk  = siteRisk(recent, prev);
      const traj  = prevNPS !== null && currNPS !== null ? trajBadge(currNPS, prevNPS) : null;

      const highlights  = recent.map(r => r.highlightComment).filter(Boolean);
      const dissatTags  = [...new Set(recent.flatMap(r => r.dissatisfactionReasons))].filter(Boolean);
      const riskOrder   = { 'at-risk': 0, 'watch': 1, 'healthy': 2 }[risk];
      const riskIcon    = { 'at-risk': '🔴', 'watch': '🟡', 'healthy': '🟢' }[risk];
      const riskLabel   = { 'at-risk': 'At Risk', 'watch': 'Watch', 'healthy': 'Healthy' }[risk];

      return { school, dist, risk, riskOrder, riskIcon, riskLabel, currNPS, total, traj, highlights, dissatTags };
    });

    cards.sort((a, b) => a.riskOrder - b.riskOrder);

    el.innerHTML = cards.map(c => `
      <div class="sf-health-card sf-hc-${c.risk}">
        <div class="sf-hc-header">
          <div class="sf-hc-title-wrap">
            <div class="sf-hc-school">${c.school}</div>
            <div class="sf-hc-dist">${c.dist}</div>
          </div>
          <div class="sf-hc-meta">
            <span class="sf-risk-pill sf-risk-pill-${c.risk}">${c.riskIcon} ${c.riskLabel}</span>
            <div class="sf-hc-nps" style="color:${npsColor(c.currNPS)}">${fmtNPS(c.currNPS)}<span class="sf-hc-n"> (n=${c.total})</span></div>
          </div>
        </div>
        ${c.traj ? `<div class="sf-traj-badge sf-traj-${c.traj.cls}">
          ${c.traj.label}${c.traj.delta !== 0 ? ' (' + (c.traj.delta > 0 ? '+' : '') + c.traj.delta + ' pts from last quarter)' : ''}
        </div>` : ''}
        ${c.highlights.length ? `
          <div class="sf-hc-section-lbl">What's Working</div>
          <div class="sf-hc-highlights">
            ${c.highlights.slice(0, 2).map(h =>
              `<div class="sf-hc-hl-item">"${h.length > 130 ? h.slice(0, 130) + '…' : h}"</div>`
            ).join('')}
          </div>` : ''}
        ${c.dissatTags.length ? `
          <div class="sf-hc-section-lbl" style="margin-top:.5rem">Concern Tags</div>
          <div class="sf-tag-chips">
            ${c.dissatTags.map(t => `<span class="sf-tag-chip">${t}</span>`).join('')}
          </div>` : ''}
      </div>`).join('');
  }

  function renderReturningTable(containerId, showPrivate) {
    const el = document.getElementById(containerId);
    if (!el) return;

    const returning = getReturningRespondents(_allData);
    const qs = getQuarters();

    if (!returning.length) {
      el.innerHTML = '<div class="sf-empty">No returning respondents found across multiple quarters.</div>';
      return;
    }

    const rows = returning.map(group => {
      group.sort((a, b) => a.quarter.localeCompare(b.quarter));
      const latest  = group[group.length - 1];
      const qScores = {};
      group.forEach(r => { qScores[r.quarter] = r.npsScore; });

      const firstQ = qs.find(q => qScores[q] !== undefined);
      const lastQ  = [...qs].reverse().find(q => qScores[q] !== undefined);
      const delta  = firstQ && lastQ && firstQ !== lastQ
        ? qScores[lastQ] - qScores[firstQ] : null;

      const catChange = firstQ && lastQ
        ? (scoreCategory(qScores[firstQ]) === scoreCategory(qScores[lastQ])
            ? scoreCategory(qScores[lastQ])
            : `${scoreCategory(qScores[firstQ])} → ${scoreCategory(qScores[lastQ])}`)
        : '';
      const trend = delta === null ? 'stable' : delta > 0 ? 'improving' : delta < 0 ? 'declining' : 'stable';

      return { role: latest.role, school: latest.school, district: latest.district,
               email: latest.email, name: latest.name, qScores, delta, catChange, trend };
    });

    rows.sort((a, b) => (a.delta || 0) - (b.delta || 0));

    const rowBg = t => t === 'improving' ? '#f0fdf4' : t === 'declining' ? '#fff7ed' : '';
    const dCol  = d => d > 0 ? '#0d6e3a' : d < 0 ? '#b91c1c' : '#7d8fa1';

    el.innerHTML = `
      <table class="sf-table">
        <thead><tr>
          ${showPrivate ? '<th>Email</th><th>Name</th>' : ''}
          <th>Role</th><th>School</th><th>District</th>
          ${qs.map(q => `<th>${q}</th>`).join('')}
          <th>Trend</th><th>Category Change</th>
        </tr></thead>
        <tbody>
          ${rows.map(r => `<tr style="background:${rowBg(r.trend)}">
            ${showPrivate ? `<td class="sf-cell-sm">${r.email||''}</td><td>${r.name||''}</td>` : ''}
            <td>${r.role}</td><td>${r.school}</td><td>${r.district}</td>
            ${qs.map(q => `<td style="text-align:center;font-weight:600;color:${npsColor(r.qScores[q] >= 4 ? 100 : r.qScores[q] === 3 ? 30 : (r.qScores[q] ? -10 : null))}">${r.qScores[q] || '—'}</td>`).join('')}
            <td style="font-weight:700;color:${dCol(r.delta)}">${r.delta !== null ? (r.delta > 0 ? '+' : '') + r.delta : '—'}</td>
            <td class="sf-cell-muted">${r.catChange}</td>
          </tr>`).join('')}
        </tbody>
      </table>`;
  }

  function renderDistrictMatrix(containerId) {
    const el = document.getElementById(containerId);
    if (!el) return;

    const allPub  = pubData(_allData);
    const qs      = getQuarters();
    const recentQ = qs[qs.length - 1];
    const prevQ   = qs[qs.length - 2] || null;
    const dists   = getDistricts(allPub);

    const rows = dists.map(district => {
      const all    = allPub.filter(r => r.district === district);
      const recent = recentQ ? all.filter(r => r.quarter === recentQ) : all;
      const prev   = prevQ   ? all.filter(r => r.quarter === prevQ)   : [];

      const { nps: currNPS } = calcNPS(recent);
      const { nps: prevNPS } = calcNPS(prev);
      const avgScore = recent.length
        ? +(recent.reduce((s, r) => s + r.npsScore, 0) / recent.length).toFixed(1) : null;
      const hasDetractor = recent.some(r => r.npsScore <= 2);
      const qoqDrop = (prevNPS !== null && currNPS !== null) ? prevNPS - currNPS : 0;

      let risk = 'healthy';
      if (hasDetractor || (avgScore !== null && avgScore <= 2.5) || qoqDrop >= 20) risk = 'at-risk';
      else if ((avgScore !== null && avgScore >= 3 && avgScore <= 3.5) || (currNPS !== null && currNPS < 20)) risk = 'watch';

      const trendArrow = (prevNPS !== null && currNPS !== null)
        ? (currNPS > prevNPS + 5 ? '↑' : currNPS < prevNPS - 5 ? '↓' : '→') : '—';

      const qNPS = {};
      qs.forEach(q => { qNPS[q] = calcNPS(all.filter(r => r.quarter === q)).nps; });

      return { district, respondents: all.length, avgScore, qNPS, trendArrow, risk };
    });

    rows.sort((a, b) => ({ 'at-risk': 0, 'watch': 1, 'healthy': 2 }[a.risk] - { 'at-risk': 0, 'watch': 1, 'healthy': 2 }[b.risk]));

    const riskLabel = { 'at-risk': '🔴 High Risk', 'watch': '🟡 Watch', 'healthy': '🟢 Healthy' };

    el.innerHTML = `
      <table class="sf-table">
        <thead><tr>
          <th>District</th><th>Respondents</th><th>Avg Score</th>
          ${qs.map(q => `<th>${q} NPS</th>`).join('')}
          <th>Trend</th><th>Risk Level</th>
        </tr></thead>
        <tbody>
          ${rows.map(r => `<tr>
            <td><strong>${r.district}</strong></td>
            <td>${r.respondents}</td>
            <td style="font-weight:600">${r.avgScore || '—'}</td>
            ${qs.map(q => {
              const v = r.qNPS[q];
              return `<td style="font-weight:700;color:${npsColor(v)}">${v !== null && v !== undefined ? fmtNPS(v) : '—'}</td>`;
            }).join('')}
            <td style="font-size:1.1rem;text-align:center">${r.trendArrow}</td>
            <td><span class="sf-risk-pill sf-risk-pill-${r.risk}">${riskLabel[r.risk]}</span></td>
          </tr>`).join('')}
        </tbody>
      </table>`;
  }

  function renderRawTable(containerId, rows) {
    const el = document.getElementById(containerId);
    if (!el) return;

    if (!rows.length) { el.innerHTML = '<div class="sf-empty">No matching responses for current filters.</div>'; return; }

    const cols = [
      { k: 'timestamp',               l: 'Timestamp' },
      { k: 'name',                     l: 'Name' },
      { k: 'email',                    l: 'Email' },
      { k: 'district',                 l: 'District' },
      { k: 'school',                   l: 'School' },
      { k: 'role',                     l: 'Role' },
      { k: 'npsScore',                 l: 'NPS Score' },
      { k: 'satisfactionLevel',        l: 'Satisfaction' },
      { k: 'highlightComment',         l: 'Highlights' },
      { k: 'dissatisfactionReasons',   l: 'Dissat. Reasons' },
      { k: 'dissatisfactionCategory',  l: 'Category' },
      { k: 'improvementComment',       l: 'Improvement' },
      { k: 'followUpNote',             l: 'Follow-Up Note' },
      { k: 'quarter',                  l: 'Quarter' },
    ];

    const sorted = [...rows].sort((a, b) => {
      const av = String(a[_rawSortCol] || '');
      const bv = String(b[_rawSortCol] || '');
      return av < bv ? -_rawSortDir : av > bv ? _rawSortDir : 0;
    });

    const valOf = (r, k) => Array.isArray(r[k]) ? r[k].join(', ') : (r[k] || '');

    el.innerHTML = `
      <table class="sf-table sf-raw-table">
        <thead><tr>
          ${cols.map(c => `
            <th class="sf-th-sort${_rawSortCol === c.k ? ' sf-th-active' : ''}"
              onclick="sfSortRaw('${c.k}')">
              ${c.l}${_rawSortCol === c.k ? (_rawSortDir === 1 ? ' ↑' : ' ↓') : ''}
            </th>`).join('')}
        </tr></thead>
        <tbody>
          ${sorted.map(r => {
            const bg = r.npsScore <= 2 ? '#fee2e2' : r.npsScore === 3 ? '#fff7ed' : '';
            return `<tr style="background:${bg}">
              <td class="sf-cell-sm" style="white-space:nowrap">${r.timestamp}</td>
              <td>${r.name || ''}</td>
              <td class="sf-cell-sm">${r.email || ''}</td>
              <td>${r.district}</td>
              <td>${r.school}</td>
              <td>${r.role}</td>
              <td style="text-align:center;font-weight:700;color:${npsColor(r.npsScore >= 4 ? 80 : r.npsScore === 3 ? 30 : -10)}">${r.npsScore}</td>
              <td>${r.satisfactionLevel}</td>
              <td class="sf-cell-trunc" title="${valOf(r,'highlightComment').replace(/"/g,'&quot;')}">${valOf(r,'highlightComment')}</td>
              <td class="sf-cell-sm">${valOf(r,'dissatisfactionReasons')}</td>
              <td>${r.dissatisfactionCategory || ''}</td>
              <td class="sf-cell-trunc" title="${valOf(r,'improvementComment').replace(/"/g,'&quot;')}">${valOf(r,'improvementComment')}</td>
              <td class="sf-cell-trunc">${r.followUpNote || ''}</td>
              <td>${r.quarter}</td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>`;
  }

  window.sfSortRaw = function (col) {
    if (_rawSortCol === col) _rawSortDir *= -1;
    else { _rawSortCol = col; _rawSortDir = 1; }
    renderRawTable('sfRawTable', filteredRawData());
  };

  function renderLongTable(containerId) {
    const el = document.getElementById(containerId);
    if (!el) return;

    const returning = getReturningRespondents(_allData);
    const qs = getQuarters();

    if (!returning.length) {
      el.innerHTML = '<div class="sf-empty">No returning respondents found.</div>';
      return;
    }

    const rows = returning.map(group => {
      group.sort((a, b) => a.quarter.localeCompare(b.quarter));
      const latest  = group[group.length - 1];
      const qScores = {};
      group.forEach(r => { qScores[r.quarter] = r.npsScore; });

      const firstQ = qs.find(q => qScores[q] !== undefined);
      const lastQ  = [...qs].reverse().find(q => qScores[q] !== undefined);
      const delta  = firstQ && lastQ && firstQ !== lastQ ? qScores[lastQ] - qScores[firstQ] : null;
      const catChange = firstQ && lastQ
        ? (scoreCategory(qScores[firstQ]) === scoreCategory(qScores[lastQ])
            ? scoreCategory(qScores[lastQ])
            : `${scoreCategory(qScores[firstQ])} → ${scoreCategory(qScores[lastQ])}`)
        : '';

      return { email: latest.email, name: latest.name, school: latest.school,
               district: latest.district, role: latest.role, qScores, delta, catChange };
    });

    rows.sort((a, b) => (a.delta || 0) - (b.delta || 0));

    const dCol = d => d > 0 ? '#0d6e3a' : d < 0 ? '#b91c1c' : '#7d8fa1';

    el.innerHTML = `
      <table class="sf-table">
        <thead><tr>
          <th>Email</th><th>Name</th><th>School</th><th>District</th><th>Role</th>
          ${qs.map(q => `<th>${q} Score</th>`).join('')}
          <th>Δ Q1→Q${qs.length}</th><th>Trend</th><th>Category Change</th>
        </tr></thead>
        <tbody>
          ${rows.map(r => {
            const dv = r.delta;
            const tIcon = dv === null ? '—' : dv > 0 ? '↑' : dv < 0 ? '↓' : '→';
            return `<tr>
              <td class="sf-cell-sm">${r.email || ''}</td>
              <td>${r.name || ''}</td>
              <td>${r.school}</td>
              <td>${r.district}</td>
              <td>${r.role}</td>
              ${qs.map(q => `<td style="text-align:center;font-weight:600">${r.qScores[q] || '—'}</td>`).join('')}
              <td style="font-weight:700;color:${dCol(dv)}">${dv !== null ? (dv > 0 ? '+' : '') + dv : '—'}</td>
              <td style="text-align:center;color:${dCol(dv)};font-size:1.1rem">${tIcon}</td>
              <td class="sf-cell-muted">${r.catChange}</td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>`;
  }

  function renderHeatmap(containerId) {
    const el = document.getElementById(containerId);
    if (!el) return;

    const dists = getDistricts();
    const qs    = getQuarters();

    el.innerHTML = `
      <table class="sf-table sf-heatmap">
        <thead><tr>
          <th>District</th>
          ${qs.map(q => `<th>${q}</th>`).join('')}
        </tr></thead>
        <tbody>
          ${dists.map(d => {
            return `<tr>
              <td><strong>${d}</strong></td>
              ${qs.map(q => {
                const dRows = _allData.filter(r => r.district === d && r.quarter === q);
                if (!dRows.length) return `<td style="background:#f6f8fc;color:#dde3ec;text-align:center">—</td>`;
                const { nps } = calcNPS(dRows);
                const bg  = npsBgColor(nps);
                const col = npsColor(nps);
                return `<td style="background:${bg};color:${col};font-weight:700;text-align:center">${fmtNPS(nps)}</td>`;
              }).join('')}
            </tr>`;
          }).join('')}
        </tbody>
      </table>`;
  }

  function renderActionQueue(containerId, rows) {
    const el = document.getElementById(containerId);
    if (!el) return;

    const actionRows = rows.filter(r =>
      r.dissatisfactionReasons.length > 0 ||
      ['Dissatisfied', 'Very Dissatisfied'].includes(r.satisfactionLevel) ||
      r.improvementComment
    );

    if (!actionRows.length) {
      el.innerHTML = '<div class="sf-empty">No action items for current filters. ✓</div>';
      return;
    }

    const qs       = getQuarters();
    const sevOrder = { 'Very Dissatisfied': 0, 'Dissatisfied': 1, 'Neutral': 2, 'Satisfied': 3, 'Very Satisfied': 4 };
    actionRows.sort((a, b) => {
      const qd = qs.indexOf(b.quarter) - qs.indexOf(a.quarter);
      if (qd !== 0) return qd;
      return (sevOrder[a.satisfactionLevel] ?? 5) - (sevOrder[b.satisfactionLevel] ?? 5);
    });

    const satBg = s => s === 'Very Dissatisfied' ? '#fee2e2' : s === 'Dissatisfied' ? '#fff7ed' : '';
    const satColor = s => s === 'Very Dissatisfied' ? '#b91c1c' : s === 'Dissatisfied' ? '#c05c00' : '#7d8fa1';

    el.innerHTML = `
      <table class="sf-table">
        <thead><tr>
          <th>School</th><th>District</th><th>Role</th><th>Quarter</th>
          <th>Satisfaction</th><th>Dissatisfaction Tags</th><th>Improvement Comment</th>
        </tr></thead>
        <tbody>
          ${actionRows.map(r => `<tr style="background:${satBg(r.satisfactionLevel)}">
            <td>${r.school}</td>
            <td>${r.district}</td>
            <td>${r.role}</td>
            <td>${r.quarter}</td>
            <td><span style="font-weight:700;color:${satColor(r.satisfactionLevel)}">${r.satisfactionLevel}</span></td>
            <td>${r.dissatisfactionReasons.map(t => `<span class="sf-tag-chip">${t}</span>`).join(' ')}</td>
            <td class="sf-cell-trunc" title="${(r.improvementComment || '').replace(/"/g, '&quot;')}">${r.improvementComment || ''}</td>
          </tr>`).join('')}
        </tbody>
      </table>`;
  }

  // ── CSV Export (Data dept only — button only shown in Data view) ───
  window.sfExportCSV = function () {
    const rows = filteredRawData();
    const cols = ['timestamp','name','email','district','school','role','npsScore',
                  'satisfactionLevel','highlightComment','dissatisfactionReasons',
                  'dissatisfactionCategory','improvementComment','followUpNote','quarter'];
    const header = cols.join(',');
    const body   = rows.map(r => cols.map(c => {
      const v = Array.isArray(r[c]) ? r[c].join('; ') : (r[c] || '');
      return '"' + String(v).replace(/"/g, '""') + '"';
    }).join(',')).join('\n');
    const blob = new Blob([header + '\n' + body], { type: 'text/csv' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url;
    a.download = 'njtc-partner-satisfaction-' + new Date().toISOString().slice(0, 10) + '.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  // ══════════════════════════════════════════════════════════════════
  // PDF EXPORT
  // ══════════════════════════════════════════════════════════════════

  let _sfPdfLibLoaded = false;

  function loadSFPdfLibs() {
    return new Promise((resolve, reject) => {
      if (_sfPdfLibLoaded && window.jspdf && window.jspdf.jsPDF) { resolve(); return; }
      const s1 = document.createElement('script');
      s1.src = 'https://unpkg.com/jspdf@2.5.1/dist/jspdf.umd.min.js';
      s1.onerror = () => reject(new Error('Failed to load jsPDF'));
      s1.onload = () => {
        const s2 = document.createElement('script');
        s2.src = 'https://unpkg.com/jspdf-autotable@3.8.2/dist/jspdf.plugin.autotable.min.js';
        s2.onerror = () => reject(new Error('Failed to load autoTable'));
        s2.onload = () => { _sfPdfLibLoaded = true; resolve(); };
        document.head.appendChild(s2);
      };
      document.head.appendChild(s1);
    });
  }

  // ── PDF Menu toggle ───────────────────────────────────────────────
  function escSchool(s) { return s.replace(/'/g, '\u2019').replace(/"/g, '\u201C'); }
  window.sfPdfMenuToggle = function () {
    const m = document.getElementById('sfPdfMenu');
    if (!m) return;
    const open = m.style.display === 'block';
    m.style.display = open ? 'none' : 'block';
    if (!open) {
      // Close on outside click
      const close = function (e) {
        if (!document.getElementById('sfPdfDropWrap').contains(e.target)) {
          m.style.display = 'none';
          document.removeEventListener('click', close);
        }
      };
      setTimeout(() => document.addEventListener('click', close), 10);
    }
  };

  window.sfExportPDF = async function (viewOverride) {
    const btn = document.getElementById('sfPdfBtn');
    const menu = document.getElementById('sfPdfMenu');
    if (btn) { btn.disabled = true; btn.textContent = 'Generating…'; }
    if (menu) menu.style.display = 'none';
    try {
      await loadSFPdfLibs();
      buildSatisfactionPDF(window.jspdf.jsPDF, viewOverride || _view);
    } catch (err) {
      alert('PDF export failed: ' + err.message);
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = '⬇ Export PDF ▾'; }
    }
  };

  window.sfExportPartnerPDF = async function (schoolName, _unused) {
    const btn = document.getElementById('sfPdfBtn');
    const menu = document.getElementById('sfPdfMenu');
    if (btn) { btn.disabled = true; btn.textContent = 'Generating…'; }
    if (menu) menu.style.display = 'none';
    try {
      await loadSFPdfLibs();
      buildPartnerPDF(window.jspdf.jsPDF, schoolName);
    } catch (err) {
      alert('Partner PDF failed: ' + err.message);
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = '⬇ Export PDF ▾'; }
    }
  };

  window.sfExportRegionPDF = async function (region) {
    const btn = document.getElementById('sfPdfBtn');
    const menu = document.getElementById('sfPdfMenu');
    if (btn) { btn.disabled = true; btn.textContent = 'Generating…'; }
    if (menu) menu.style.display = 'none';
    try {
      await loadSFPdfLibs();
      buildRegionPDF(window.jspdf.jsPDF, region);
    } catch (err) {
      alert('Region PDF failed: ' + err.message);
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = '⬇ Export PDF ▾'; }
    }
  };

  function buildSatisfactionPDF(jsPDF, viewOverride) {
    const doc   = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const W     = 210;
    const ML    = 14, MR = 14, MT = 14;

    // ── Brand colours (RGB) ─────────────────────────────────────────
    const C = {
      navy:  [27,  42,  74],
      teal:  [42, 157, 143],
      green: [13, 110, 58],
      amber: [192, 92,   0],
      red:   [185, 28,  28],
      white: [255, 255, 255],
      light: [247, 249, 252],
      muted: [107, 114, 128],
      body:  [ 45,  45,  45],
    };

    // ── Helpers ─────────────────────────────────────────────────────
    function ss(s) {
      return String(s || '')
        .replace(/\u2014/g, '-').replace(/\u2013/g, '-')
        .replace(/\u2019/g, "'").replace(/\u201C/g, '"').replace(/\u201D/g, '"')
        .replace(/[^\x20-\x7E\xA0-\xFF]/g, '')
        .replace(/\s+/g, ' ').trim();
    }
    function fmtN(nps) {
      if (nps === null || nps === undefined || isNaN(nps)) return 'N/A';
      return (nps > 0 ? '+' : '') + nps;
    }
    function npsRgb(nps) {
      if (nps === null || nps === undefined || isNaN(nps)) return C.muted;
      return nps >= 50 ? C.green : nps >= 20 ? C.amber : C.red;
    }
    function riskOf(recent, prev) {
      if (!recent.length) return 'healthy';
      const hasDetractor = recent.some(r => r.npsScore <= 2);
      const dissatCount  = recent.filter(r => ['Dissatisfied', 'Very Dissatisfied'].includes(r.satisfactionLevel)).length;
      const { nps: currNPS } = calcNPS(recent);
      const { nps: prevNPS } = calcNPS(prev);
      const qoqDrop = (prevNPS !== null && currNPS !== null) ? prevNPS - currNPS : 0;
      if (hasDetractor || qoqDrop >= 20 || dissatCount >= 2) return 'at-risk';
      if ((currNPS !== null && currNPS < 20) || qoqDrop >= 10) return 'watch';
      return 'healthy';
    }

    // ── Source data based on current view ───────────────────────────
    const activeView = viewOverride || _view;
    const viewLabel  = { program: 'Program Team', leadership: 'Leadership', data: 'Data Department' }[activeView] || 'Report';
    const rows       = activeView === 'data' ? filteredRawData() : filteredPublicData();
    const allRows    = activeView === 'data' ? _allData : pubData(_allData);
    const allQoQ    = qoqBreakdown(allRows);
    const nd        = calcNPS(rows);
    const qs        = getQuarters();
    const recentQ   = qs[qs.length - 1] || null;
    const prevQ     = qs[qs.length - 2] || null;

    // Active filter summary
    const f = _view === 'data' ? _dataFilters : _filters;
    const fParts = [];
    if (f.quarters && f.quarters.length) fParts.push('Quarter: ' + f.quarters.join(', '));
    if (f.district)  fParts.push('District: ' + f.district);
    if (f.school)    fParts.push('School: '   + f.school);
    if (f.role)      fParts.push('Role: '     + f.role);
    if (_view === 'data') {
      if (_dataFilters.satisfaction) fParts.push('Satisfaction: ' + _dataFilters.satisfaction);
      if (_dataFilters.npsMin) fParts.push('NPS: ' + _dataFilters.npsMin + '-' + _dataFilters.npsMax);
    }
    const filterLine = fParts.length ? 'Filters: ' + fParts.join('  |  ') : 'All data — no filters applied';
    const dateStr = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

    let y = MT;

    // ══════════════════════════════════════════════════════════════
    // SECTION 1 — COVER HEADER
    // ══════════════════════════════════════════════════════════════
    doc.setFillColor(...C.navy);
    doc.rect(0, 0, W, 26, 'F');
    doc.setTextColor(...C.white);
    doc.setFontSize(14); doc.setFont('helvetica', 'bold');
    doc.text('NJTC — Partner Satisfaction Report', ML, 11);
    doc.setFontSize(9); doc.setFont('helvetica', 'normal');
    doc.text(viewLabel + ' View  ·  Generated ' + dateStr, ML, 18);
    doc.text(ss(filterLine), ML, 24, { maxWidth: W - ML - MR });

    y = 32;

    // ══════════════════════════════════════════════════════════════
    // SECTION 2 — NPS HERO
    // ══════════════════════════════════════════════════════════════
    doc.setFillColor(...C.light);
    doc.roundedRect(ML, y, W - ML - MR, 30, 2, 2, 'F');

    const scoreCol = npsRgb(nd.nps);
    doc.setTextColor(...scoreCol);
    doc.setFontSize(30); doc.setFont('helvetica', 'bold');
    doc.text(fmtN(nd.nps), ML + 5, y + 20);

    doc.setFontSize(8); doc.setFont('helvetica', 'normal');
    doc.setTextColor(...C.muted);
    doc.text('Adapted NPS (1-5 Scale)', ML + 5, y + 26);
    doc.text('n = ' + nd.total, ML + 5, y + 8);

    const bx = ML + 55;
    doc.setFont('helvetica', 'bold'); doc.setFontSize(9);
    doc.setTextColor(...C.green);
    doc.text('Promoters (4-5): ' + nd.promoterPct + '%  (' + nd.promoters + ')', bx, y + 9);
    doc.setTextColor(...C.amber);
    doc.text('Passives   (3):  ' + nd.passivePct  + '%  (' + nd.passives  + ')', bx, y + 17);
    doc.setTextColor(...C.red);
    doc.text('Detractors (1-2): ' + nd.detractorPct + '%  (' + nd.detractors + ')', bx, y + 25);

    y += 37;

    // ══════════════════════════════════════════════════════════════
    // SECTION 3 — SCORE DISTRIBUTION
    // ══════════════════════════════════════════════════════════════
    doc.setTextColor(...C.navy); doc.setFont('helvetica', 'bold'); doc.setFontSize(11);
    doc.text('Score Distribution (1-5)', ML, y);
    y += 4;

    const scoreDist = [1,2,3,4,5].map(s => {
      const cnt = rows.filter(r => r.npsScore === s).length;
      const pct = nd.total ? Math.round(cnt / nd.total * 100) : 0;
      return [String(s), s <= 2 ? 'Detractor' : s === 3 ? 'Passive' : 'Promoter', String(cnt), pct + '%'];
    });
    doc.autoTable({
      startY: y, head: [['Score','Category','Count','% of Total']],
      body: scoreDist,
      theme: 'striped',
      headStyles: { fillColor: C.navy, textColor: C.white, fontSize: 9, fontStyle: 'bold' },
      bodyStyles: { fontSize: 9, textColor: C.body },
      columnStyles: { 0: { halign: 'center', cellWidth: 20 }, 2: { halign: 'center' }, 3: { halign: 'center' } },
      margin: { left: ML, right: MR },
    });
    y = doc.lastAutoTable.finalY + 8;

    // ══════════════════════════════════════════════════════════════
    // SECTION 4 — QUARTER-OVER-QUARTER CHANGES
    // ══════════════════════════════════════════════════════════════
    if (allQoQ.length > 0) {
      if (y > 240) { doc.addPage(); y = MT; }
      doc.setTextColor(...C.navy); doc.setFont('helvetica', 'bold'); doc.setFontSize(11);
      doc.text('Quarter-over-Quarter NPS Changes', ML, y);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(...C.muted);
      doc.text('Green = improvement  |  Red = decline  |  — = first quarter on record', ML, y + 4);
      y += 8;

      const qoqBody = allQoQ.map((q, i) => {
        const prev2  = i > 0 ? allQoQ[i - 1] : null;
        const delta  = (prev2 && prev2.nps !== null && q.nps !== null) ? Math.round((q.nps - prev2.nps) * 10) / 10 : null;
        const dStr   = delta === null ? '—' : (delta > 0 ? '+' : '') + delta;
        const trend  = delta === null ? '—' : delta > 5 ? '↑ Improving' : delta < -5 ? '↓ Declining' : '→ Stable';
        return [ss(q.quarter), String(q.total), fmtN(q.nps), dStr, trend];
      });
      doc.autoTable({
        startY: y, head: [['Quarter','Respondents','NPS','Change (Δ)','Trend']],
        body: qoqBody,
        theme: 'striped',
        headStyles: { fillColor: C.navy, textColor: C.white, fontSize: 9, fontStyle: 'bold' },
        bodyStyles: { fontSize: 9, textColor: C.body },
        columnStyles: { 1: { halign: 'center' }, 2: { halign: 'center' }, 3: { halign: 'center' } },
        didParseCell: (d) => {
          if (d.section !== 'body') return;
          if (d.column.index === 3) {
            const v = parseFloat(d.cell.text[0]);
            if (v > 0) d.cell.styles.textColor = C.green;
            else if (v < 0) d.cell.styles.textColor = C.red;
          }
          if (d.column.index === 4) {
            const t = d.cell.text[0];
            if (t.includes('Improving')) d.cell.styles.textColor = C.green;
            else if (t.includes('Declining')) d.cell.styles.textColor = C.red;
          }
        },
        margin: { left: ML, right: MR },
      });
      y = doc.lastAutoTable.finalY + 8;
    }

    // ══════════════════════════════════════════════════════════════
    // SECTION 5 — DISTRICT ANALYSIS
    // ══════════════════════════════════════════════════════════════
    if (y > 230) { doc.addPage(); y = MT; }
    doc.setTextColor(...C.navy); doc.setFont('helvetica', 'bold'); doc.setFontSize(11);
    doc.text('District Analysis', ML, y);
    y += 4;

    const dists2 = getDistricts(allRows);
    const distBody = dists2.map(district => {
      const all2    = allRows.filter(r => r.district === district);
      const recent2 = recentQ ? all2.filter(r => r.quarter === recentQ) : all2;
      const prev2   = prevQ   ? all2.filter(r => r.quarter === prevQ)   : [];
      const { nps: cNPS } = calcNPS(recent2.length ? recent2 : all2);
      const { nps: pNPS } = calcNPS(prev2);
      const delta  = (pNPS !== null && cNPS !== null) ? Math.round((cNPS - pNPS) * 10) / 10 : null;
      const dStr   = delta === null ? '—' : (delta > 0 ? '+' : '') + delta;
      const trend  = delta === null ? '—' : delta > 5 ? '↑' : delta < -5 ? '↓' : '→';
      const rLabel = { 'at-risk': 'At Risk', 'watch': 'Watch', 'healthy': 'Healthy' }[riskOf(recent2.length ? recent2 : all2, prev2)] || '—';
      return { row: [ss(district), String(all2.length), fmtN(cNPS), dStr, trend, rLabel], delta };
    });
    doc.autoTable({
      startY: y, head: [['District','Respondents','NPS','Change (Δ)','Trend','Risk']],
      body: distBody.map(d => d.row),
      theme: 'striped',
      headStyles: { fillColor: C.navy, textColor: C.white, fontSize: 8.5, fontStyle: 'bold' },
      bodyStyles: { fontSize: 8.5, textColor: C.body },
      columnStyles: { 0: { cellWidth: 62 }, 1: { halign: 'center' }, 2: { halign: 'center' }, 3: { halign: 'center' }, 4: { halign: 'center' } },
      didParseCell: (d) => {
        if (d.section !== 'body') return;
        const delta = distBody[d.row.index]?.delta;
        if (d.column.index === 3 && delta !== null) {
          d.cell.styles.textColor = delta > 0 ? C.green : delta < 0 ? C.red : C.body;
        }
      },
      margin: { left: ML, right: MR },
    });
    y = doc.lastAutoTable.finalY + 8;

    // ══════════════════════════════════════════════════════════════
    // SECTION 6 — SCHOOL PERFORMANCE CHANGES (if 2+ quarters)
    // ══════════════════════════════════════════════════════════════
    if (recentQ && prevQ) {
      if (y > 220) { doc.addPage(); y = MT; }
      doc.setTextColor(...C.navy); doc.setFont('helvetica', 'bold'); doc.setFontSize(11);
      doc.text('School Performance: ' + ss(prevQ) + ' → ' + ss(recentQ), ML, y);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(...C.muted);
      doc.text('Sorted by risk then by largest decline first.', ML, y + 4);
      y += 8;

      const allPubSch = pubData(_allData);
      const schools2  = [...new Set(allPubSch.map(r => r.school).filter(Boolean))].sort();
      const schRows = schools2.map(school => {
        const all3 = allPubSch.filter(r => r.school === school);
        const rec3 = all3.filter(r => r.quarter === recentQ);
        const pre3 = all3.filter(r => r.quarter === prevQ);
        if (!rec3.length) return null;
        const { nps: cNPS } = calcNPS(rec3);
        const { nps: pNPS } = calcNPS(pre3);
        const delta = (pNPS !== null && cNPS !== null) ? Math.round((cNPS - pNPS) * 10) / 10 : null;
        const dStr  = delta === null ? '—' : (delta > 0 ? '+' : '') + delta;
        const trend = delta === null ? '—' : delta > 5 ? '↑ Improving' : delta < -5 ? '↓ Declining' : '→ Stable';
        const risk  = riskOf(rec3, pre3);
        const rLabel = { 'at-risk': 'At Risk', 'watch': 'Watch', 'healthy': 'Healthy' }[risk];
        return { delta, risk, row: [ss(school), String(rec3.length), fmtN(cNPS), dStr, trend, rLabel] };
      }).filter(Boolean);

      const rOrder = { 'at-risk': 0, 'watch': 1, 'healthy': 2 };
      schRows.sort((a, b) => {
        const rd = rOrder[a.risk] - rOrder[b.risk];
        return rd !== 0 ? rd : (a.delta || 0) - (b.delta || 0);
      });

      doc.autoTable({
        startY: y, head: [['School', 'N', 'NPS', 'Δ vs ' + ss(prevQ), 'Trend', 'Risk']],
        body: schRows.map(s => s.row),
        theme: 'striped',
        headStyles: { fillColor: C.navy, textColor: C.white, fontSize: 8, fontStyle: 'bold' },
        bodyStyles: { fontSize: 8, textColor: C.body },
        columnStyles: { 0: { cellWidth: 55 }, 1: { halign: 'center' }, 2: { halign: 'center' }, 3: { halign: 'center' }, 4: { halign: 'center' } },
        didParseCell: (d) => {
          if (d.section !== 'body') return;
          const delta = schRows[d.row.index]?.delta;
          if (d.column.index === 3 && delta !== null) {
            d.cell.styles.textColor = delta > 0 ? C.green : delta < 0 ? C.red : C.body;
          }
          if (d.column.index === 4) {
            const t = d.cell.text[0];
            if (t.includes('Improving')) d.cell.styles.textColor = C.green;
            else if (t.includes('Declining')) d.cell.styles.textColor = C.red;
          }
        },
        margin: { left: ML, right: MR },
      });
      y = doc.lastAutoTable.finalY + 8;
    }

    // ══════════════════════════════════════════════════════════════
    // SECTION 7 — ROLE NPS BREAKDOWN
    // ══════════════════════════════════════════════════════════════
    if (y > 230) { doc.addPage(); y = MT; }
    doc.setTextColor(...C.navy); doc.setFont('helvetica', 'bold'); doc.setFontSize(11);
    doc.text('Role NPS Breakdown', ML, y);
    y += 4;

    const roleBody = getRoles().map(role => {
      const rData = rows.filter(r => r.role === role);
      const { nps, total: rn } = calcNPS(rData);
      const cat = nps === null ? 'N/A' : nps >= 50 ? 'Strong' : nps >= 20 ? 'Moderate' : nps >= 0 ? 'Weak' : 'Negative';
      return { nps, row: [ss(role), String(rn), fmtN(nps), cat] };
    });
    doc.autoTable({
      startY: y, head: [['Role','Respondents','NPS','Category']],
      body: roleBody.map(r => r.row),
      theme: 'striped',
      headStyles: { fillColor: C.navy, textColor: C.white, fontSize: 9, fontStyle: 'bold' },
      bodyStyles: { fontSize: 9, textColor: C.body },
      columnStyles: { 1: { halign: 'center' }, 2: { halign: 'center' }, 3: { halign: 'center' } },
      didParseCell: (d) => {
        if (d.section !== 'body') return;
        const nps = roleBody[d.row.index]?.nps;
        if (d.column.index === 2 && nps !== null) {
          d.cell.styles.textColor = nps >= 50 ? C.green : nps >= 20 ? C.amber : C.red;
        }
      },
      margin: { left: ML, right: MR },
    });
    y = doc.lastAutoTable.finalY + 8;

    // ══════════════════════════════════════════════════════════════
    // SECTION 8 — DATA DEPT: INDIVIDUAL RESPONDENT CHANGES
    // ══════════════════════════════════════════════════════════════
    if (_view === 'data') {
      const returning = getReturningRespondents(_allData);
      if (returning.length) {
        if (y > 210) { doc.addPage(); y = MT; }
        doc.setTextColor(...C.navy); doc.setFont('helvetica', 'bold'); doc.setFontSize(11);
        doc.text('Individual Respondent Changes (Longitudinal)', ML, y);
        doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(...C.muted);
        doc.text('Matched by email across quarters. Sorted by largest decline first.', ML, y + 4);
        y += 9;

        const longRows = returning.map(group => {
          group.sort((a, b) => a.quarter.localeCompare(b.quarter));
          const latest = group[group.length - 1];
          const qScores = {};
          group.forEach(r => { qScores[r.quarter] = r.npsScore; });
          const fQ = qs.find(q => qScores[q] !== undefined);
          const lQ = [...qs].reverse().find(q => qScores[q] !== undefined);
          const delta = fQ && lQ && fQ !== lQ ? qScores[lQ] - qScores[fQ] : null;
          const catChg = fQ && lQ
            ? (scoreCategory(qScores[fQ]) === scoreCategory(qScores[lQ])
                ? scoreCategory(qScores[lQ])
                : scoreCategory(qScores[fQ]) + ' -> ' + scoreCategory(qScores[lQ]))
            : '';
          const dStr = delta === null ? '—' : (delta > 0 ? '+' : '') + delta;
          const trend = delta === null ? '—' : delta > 0 ? '↑' : delta < 0 ? '↓' : '→';
          return { delta, row: [ss(latest.email), ss(latest.role), ss(latest.school), dStr, trend, ss(catChg)] };
        });
        longRows.sort((a, b) => (a.delta || 0) - (b.delta || 0));

        doc.autoTable({
          startY: y, head: [['Email','Role','School','Delta','Trend','Category Change']],
          body: longRows.map(r => r.row),
          theme: 'striped',
          headStyles: { fillColor: C.navy, textColor: C.white, fontSize: 8, fontStyle: 'bold' },
          bodyStyles: { fontSize: 7.5, textColor: C.body },
          columnStyles: { 0: { cellWidth: 52 }, 3: { halign: 'center' }, 4: { halign: 'center' } },
          didParseCell: (d) => {
            if (d.section !== 'body') return;
            if (d.column.index === 3) {
              const v = parseFloat(d.cell.text[0]);
              if (v > 0) d.cell.styles.textColor = C.green;
              else if (v < 0) d.cell.styles.textColor = C.red;
            }
          },
          margin: { left: ML, right: MR },
        });
        y = doc.lastAutoTable.finalY + 8;
      }

      // ── Data Dept: Dissatisfaction Reasons ───────────────────────
      const freq = {};
      _allData.forEach(r => r.dissatisfactionReasons.forEach(reason => {
        if (reason) freq[reason] = (freq[reason] || 0) + 1;
      }));
      const dissatSorted = Object.entries(freq).sort((a, b) => b[1] - a[1]);
      if (dissatSorted.length) {
        if (y > 220) { doc.addPage(); y = MT; }
        doc.setTextColor(...C.navy); doc.setFont('helvetica', 'bold'); doc.setFontSize(11);
        doc.text('Dissatisfaction Reason Frequency', ML, y);
        y += 4;
        doc.autoTable({
          startY: y, head: [['Reason','Count']],
          body: dissatSorted.map(([k, v]) => [ss(k), String(v)]),
          theme: 'striped',
          headStyles: { fillColor: C.navy, textColor: C.white, fontSize: 9, fontStyle: 'bold' },
          bodyStyles: { fontSize: 8.5, textColor: C.body },
          columnStyles: { 1: { halign: 'center', cellWidth: 24 } },
          margin: { left: ML, right: MR },
        });
      }
    }

    // ── Page footers ────────────────────────────────────────────────
    const pageCount = doc.internal.getNumberOfPages();
    for (let p = 1; p <= pageCount; p++) {
      doc.setPage(p);
      doc.setFontSize(7); doc.setTextColor(...C.muted);
      doc.text(
        'NJTC Partner Satisfaction  ·  ' + dateStr + '  ·  Page ' + p + ' of ' + pageCount,
        ML, 292
      );
    }

    // ── Trigger download ─────────────────────────────────────────
    const filename = 'njtc-partner-satisfaction-' + new Date().toISOString().slice(0, 10) + '.pdf';
    const blob = doc.output('blob');
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  // ══════════════════════════════════════════════════════════════════
  // REGION DEFINITIONS
  // ══════════════════════════════════════════════════════════════════
  const SF_REGIONS = {
    NE: {
      label: 'Northeast Region',
      districts: [
        'Bergen Arts and Science Charter',
        'Hudson Arts & Science Charter School',
        'Passaic Arts and Science Charter School',
        'Paterson Arts and Science Charter School',
      ],
    },
    SW: {
      label: 'Southwest Region',
      districts: [
        'Haddon Township',
        'Central Jersey College Prep Charter School',
        'Global Leadership Academy',
      ],
    },
  };

  // ══════════════════════════════════════════════════════════════════
  // PARTNER PDF — school-specific, positive framing, matched QoQ only
  // ══════════════════════════════════════════════════════════════════
  function buildPartnerPDF(jsPDF, schoolName) {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const W = 210, ML = 14, MR = 14;
    const C = {
      navy: [27,42,74], teal: [42,157,143], green: [13,110,58],
      amber: [192,92,0], red: [185,28,28], white: [255,255,255],
      light: [247,249,252], muted: [107,114,128], body: [45,45,45],
    };
    function ss(s) {
      return String(s||'').replace(/[\u2014\u2013]/g,'-').replace(/\u2019/g,"'")
        .replace(/[\u201C\u201D]/g,'"').replace(/[^\x20-\x7E\xA0-\xFF]/g,'')
        .replace(/\s+/g,' ').trim();
    }
    function fmtN(n) { return n===null||n===undefined||isNaN(n)?'N/A':(n>0?'+':'')+n; }
    function npsRgb(n) { return n===null||isNaN(n)?C.muted:n>=50?C.green:n>=20?C.amber:C.red; }
    function dlPdf(doc, prefix) {
      const blob = doc.output('blob');
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = prefix + '-' + new Date().toISOString().slice(0,10) + '.pdf';
      a.click(); setTimeout(() => URL.revokeObjectURL(url), 2000);
    }

    const pub = pubData(_allData);
    const qs  = getQuarters();
    const schoolRows = pub.filter(r => r.school === schoolName);
    if (!schoolRows.length) {
      alert('No survey data found for "' + schoolName + '".');
      return;
    }
    const district = schoolRows[0].district || '';
    const recentQ  = qs[qs.length-1] || null;
    const prevQ    = qs[qs.length-2] || null;

    // ── Outlier removal (IQR method on npsScore) ───────────────────
    function removeOutliers(rows) {
      if (rows.length < 5) return rows; // too few to remove
      const scores = rows.map(r => r.npsScore).sort((a,b) => a-b);
      const q1 = scores[Math.floor(scores.length * 0.25)];
      const q3 = scores[Math.floor(scores.length * 0.75)];
      const iqr = q3 - q1;
      return rows.filter(r => r.npsScore >= q1 - 1.5*iqr && r.npsScore <= q3 + 1.5*iqr);
    }

    // ── Matched respondents: only users who responded in BOTH Q1 and Q2 ─
    function matchedQoQ(rows, qA, qB) {
      if (!qA || !qB) return { prev: [], curr: [], matched: [] };
      const prevMap = {};
      rows.filter(r => r.quarter === qA && r.email).forEach(r => { prevMap[r.email] = r; });
      const currRows = rows.filter(r => r.quarter === qB && r.email && prevMap[r.email]);
      const prevRows = currRows.map(r => prevMap[r.email]);
      return { prev: prevRows, curr: currRows, matched: currRows };
    }

    const allClean  = removeOutliers(schoolRows);
    const recentRows = recentQ ? allClean.filter(r => r.quarter === recentQ) : allClean;
    const prevRows   = prevQ   ? allClean.filter(r => r.quarter === prevQ)   : [];
    const matched    = matchedQoQ(_allData.filter(r => r.school === schoolName), prevQ, recentQ);
    const matchedNPS = matched.curr.length >= 2 ? calcNPS(matched.curr) : null;
    const matchedPrevNPS = matched.prev.length >= 2 ? calcNPS(matched.prev) : null;

    const nd = calcNPS(recentRows);
    const dateStr = new Date().toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'});

    let y = 14;
    // ── Cover header ──────────────────────────────────────────────
    doc.setFillColor(...C.navy);
    doc.rect(0, 0, W, 42, 'F');
    doc.setTextColor(...C.white);
    doc.setFontSize(18); doc.setFont('helvetica','bold');
    doc.text('Partner Satisfaction Summary', ML, 20);
    doc.setFontSize(10); doc.setFont('helvetica','normal');
    doc.text(ss(schoolName) + '  ·  ' + ss(district), ML, 29);
    doc.setFontSize(8);
    doc.text('Prepared by NJTC Program Evaluation & Impact  ·  ' + dateStr, ML, 37);
    y = 52;

    // ── Intro message (positive framing) ──────────────────────────
    doc.setTextColor(...C.body);
    doc.setFontSize(9); doc.setFont('helvetica','normal');
    const intro = 'Thank you for your continued partnership with the New Jersey Tutoring Corps. ' +
      'This report summarizes feedback from your school\'s staff about their NJTC experience ' + (recentQ ? 'in ' + recentQ : 'this quarter') + '. ' +
      'Your voice helps us continuously improve the program to better serve your scholars.';
    const introLines = doc.splitTextToSize(intro, W - ML - MR);
    doc.text(introLines, ML, y);
    y += introLines.length * 4.8 + 4;

    // ── NPS Hero box ──────────────────────────────────────────────
    doc.setFillColor(...C.light);
    doc.roundedRect(ML, y, W - ML - MR, 28, 3, 3, 'F');
    doc.setFont('helvetica','bold'); doc.setFontSize(28);
    doc.setTextColor(...npsRgb(nd.nps));
    doc.text(fmtN(nd.nps), ML+8, y+19);
    doc.setFontSize(9); doc.setTextColor(...C.body);
    doc.setFont('helvetica','normal');
    doc.text('Partner NPS Score', ML+8, y+25);
    // Promoter / passive / detractor
    const qLabel = recentQ ? 'Most Recent: ' + recentQ : 'All Quarters';
    doc.setFontSize(8);
    const heroRight = ML + 60;
    doc.text('Respondents: ' + nd.total, heroRight, y+9);
    doc.text('Supportive (4–5): ' + nd.promoterPct + '%', heroRight, y+14);
    doc.text('Neutral (3): ' + nd.passivePct + '%', heroRight, y+19);
    doc.text('Concerns (1–2): ' + nd.detractorPct + '%', heroRight, y+24);
    doc.setFontSize(7.5); doc.setTextColor(...C.muted);
    doc.text(qLabel + (allClean.length !== schoolRows.length ? ' (outliers removed)' : ''), ML+8, y+3);
    y += 34;

    // ── What Your Team Told Us ─────────────────────────────────────
    doc.setFont('helvetica','bold'); doc.setFontSize(11); doc.setTextColor(...C.navy);
    doc.text('What Your Team Told Us', ML, y);
    y += 6;
    const lvlMap = {
      'Very Satisfied': 'Very Positive', 'Satisfied': 'Positive',
      'Neutral': 'Neutral', 'Dissatisfied': 'Concerns Raised', 'Very Dissatisfied': 'Significant Concerns',
    };
    const lvlColors = {
      'Very Satisfied': C.green, 'Satisfied': C.teal,
      'Neutral': C.amber, 'Dissatisfied': C.red, 'Very Dissatisfied': C.red,
    };
    const lvlOrder = ['Very Satisfied','Satisfied','Neutral','Dissatisfied','Very Dissatisfied'];
    const lvlRows = lvlOrder.map(l => {
      const cnt = recentRows.filter(r => r.satisfactionLevel === l).length;
      const pct = nd.total ? Math.round(cnt/nd.total*100) : 0;
      return [ss(lvlMap[l]||l), cnt + ' responses', pct + '% of respondents'];
    }).filter(r => parseInt(r[1]) > 0);
    if (lvlRows.length) {
      doc.autoTable({
        startY: y,
        head: [['Sentiment', 'Count', 'Share']],
        body: lvlRows,
        margin: { left: ML, right: MR },
        styles: { fontSize: 9, cellPadding: 3 },
        headStyles: { fillColor: C.navy, textColor: C.white, fontStyle: 'bold', fontSize: 8 },
        alternateRowStyles: { fillColor: C.light },
        didParseCell: function(d) {
          if (d.section==='body' && d.column.index===0) {
            const orig = lvlOrder[lvlRows.findIndex(r=>r[0]===d.cell.text[0])];
            if (orig && lvlColors[orig]) d.cell.styles.textColor = lvlColors[orig];
          }
        },
      });
      y = doc.lastAutoTable.finalY + 8;
    }

    // ── Quarter-over-Quarter: MATCHED USERS ONLY ───────────────────
    if (matchedNPS && prevQ && recentQ) {
      doc.setFont('helvetica','bold'); doc.setFontSize(11); doc.setTextColor(...C.navy);
      doc.text('Progress: ' + ss(prevQ) + ' → ' + ss(recentQ) + ' (Returning Staff)', ML, y);
      y += 3;
      doc.setFont('helvetica','normal'); doc.setFontSize(8); doc.setTextColor(...C.muted);
      doc.text('Comparison includes only the ' + matched.curr.length + ' staff members who responded in both quarters.', ML, y);
      y += 5;
      const delta = (matchedNPS.nps !== null && matchedPrevNPS && matchedPrevNPS.nps !== null)
        ? Math.round((matchedNPS.nps - matchedPrevNPS.nps)*10)/10 : null;
      const trend = delta === null ? '—' : delta > 5 ? '↑ Improving' : delta < -5 ? '↓ Declined' : '→ Stable';
      doc.autoTable({
        startY: y,
        head: [['Period', 'NPS', 'Trend', 'Respondents']],
        body: [
          [ss(prevQ),    fmtN(matchedPrevNPS ? matchedPrevNPS.nps : null), '—',   String(matched.prev.length)],
          [ss(recentQ),  fmtN(matchedNPS.nps), delta!==null?(delta>=0?'↑ +'+delta+' pts':'↓ '+delta+' pts'):trend, String(matched.curr.length)],
        ],
        margin: { left: ML, right: MR },
        styles: { fontSize: 9, cellPadding: 3 },
        headStyles: { fillColor: C.navy, textColor: C.white, fontStyle: 'bold', fontSize: 8 },
        alternateRowStyles: { fillColor: C.light },
        didParseCell: function(d) {
          if (d.section==='body' && d.row.index===1 && d.column.index===1 && matchedNPS) {
            d.cell.styles.textColor = npsRgb(matchedNPS.nps);
            d.cell.styles.fontStyle = 'bold';
          }
        },
      });
      y = doc.lastAutoTable.finalY + 8;
    }

    // ── Positive highlights (select up to 3, anonymised) ──────────
    const highlights = recentRows.map(r => r.highlightComment).filter(Boolean);
    if (highlights.length) {
      if (y > 240) { doc.addPage(); y = 14; }
      doc.setFont('helvetica','bold'); doc.setFontSize(11); doc.setTextColor(...C.navy);
      doc.text('Voices from Your School', ML, y);
      y += 5;
      highlights.slice(0,3).forEach(h => {
        const lines = doc.splitTextToSize('"' + ss(h) + '"', W - ML - MR - 8);
        if (y + lines.length*4.5 > 275) { doc.addPage(); y = 14; }
        doc.setFont('helvetica','italic'); doc.setFontSize(8.5); doc.setTextColor(...C.body);
        doc.text(lines, ML+4, y);
        y += lines.length * 4.5 + 3;
      });
      y += 4;
    }

    // ── What Comes Next (partner-facing) ──────────────────────────
    if (y > 240) { doc.addPage(); y = 14; }
    doc.setFont('helvetica','bold'); doc.setFontSize(11); doc.setTextColor(...C.navy);
    doc.text('What Comes Next', ML, y);
    y += 5;
    doc.setFont('helvetica','normal'); doc.setFontSize(8.5); doc.setTextColor(...C.body);
    const nextSteps = [
      'NJTC will review this feedback with your site leadership team.',
      'Any areas for improvement will be reflected in our programming adjustments.',
      'We will share updates on changes made in response to your team\'s feedback.',
      'Our goal is to continuously improve the tutoring experience for every scholar.',
    ];
    nextSteps.forEach(s => {
      doc.text('• ' + s, ML+3, y);
      y += 5;
    });
    y += 4;

    // ── Footer ────────────────────────────────────────────────────
    const pageCount = doc.internal.getNumberOfPages();
    for (let p = 1; p <= pageCount; p++) {
      doc.setPage(p);
      doc.setFontSize(7); doc.setTextColor(...C.muted);
      doc.text(
        'NJTC Partner Report · ' + ss(schoolName) + ' · ' + dateStr + ' · Page ' + p + ' of ' + pageCount,
        ML, 292
      );
    }
    const slug = schoolName.replace(/[^a-z0-9]/gi,'_').toLowerCase().slice(0,30);
    dlPdf(doc, 'njtc-partner-' + slug);
  }

  // ══════════════════════════════════════════════════════════════════
  // REGIONAL PDF — aggregate by NE / SW region
  // ══════════════════════════════════════════════════════════════════
  function buildRegionPDF(jsPDF, regionKey) {
    const region = SF_REGIONS[regionKey];
    if (!region) { alert('Unknown region: ' + regionKey); return; }
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const W = 210, ML = 14, MR = 14;
    const C = {
      navy: [27,42,74], teal: [42,157,143], green: [13,110,58],
      amber: [192,92,0], red: [185,28,28], white: [255,255,255],
      light: [247,249,252], muted: [107,114,128], body: [45,45,45],
    };
    function ss(s) {
      return String(s||'').replace(/[\u2014\u2013]/g,'-').replace(/\u2019/g,"'")
        .replace(/[\u201C\u201D]/g,'"').replace(/[^\x20-\x7E\xA0-\xFF]/g,'')
        .replace(/\s+/g,' ').trim();
    }
    function fmtN(n) { return n===null||n===undefined||isNaN(n)?'N/A':(n>0?'+':'')+n; }
    function npsRgb(n) { return n===null||isNaN(n)?C.muted:n>=50?C.green:n>=20?C.amber:C.red; }
    function dlPdf(doc, prefix) {
      const blob = doc.output('blob');
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = prefix + '-' + new Date().toISOString().slice(0,10) + '.pdf';
      a.click(); setTimeout(() => URL.revokeObjectURL(url), 2000);
    }

    const pub     = pubData(_allData);
    const qs      = getQuarters();
    const recentQ = qs[qs.length-1] || null;
    const prevQ   = qs[qs.length-2] || null;
    const dateStr = new Date().toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'});

    // Filter to region districts
    const regionRows = pub.filter(r => region.districts.some(d => {
      const nd = (r.district||'').toLowerCase();
      return nd.includes(d.toLowerCase().split(' ')[0]);
    }));

    let y = 14;
    // Cover
    doc.setFillColor(...C.navy);
    doc.rect(0, 0, W, 42, 'F');
    doc.setTextColor(...C.white);
    doc.setFontSize(18); doc.setFont('helvetica','bold');
    doc.text(region.label + ' — Partner Satisfaction', ML, 20);
    doc.setFontSize(9); doc.setFont('helvetica','normal');
    doc.text('NJTC Program Evaluation & Impact  ·  ' + dateStr, ML, 29);
    doc.setFontSize(8);
    doc.text('Internal Report — Not for External Distribution', ML, 37);
    y = 52;

    // Overall NPS hero
    const nd  = calcNPS(regionRows);
    const allQoQ = qs.map(q => {
      const qRows = regionRows.filter(r => r.quarter === q);
      return { quarter: q, ...calcNPS(qRows) };
    });

    doc.setFillColor(...C.light);
    doc.roundedRect(ML, y, W-ML-MR, 24, 3, 3, 'F');
    doc.setFont('helvetica','bold'); doc.setFontSize(24); doc.setTextColor(...npsRgb(nd.nps));
    doc.text(fmtN(nd.nps), ML+6, y+17);
    doc.setFontSize(9); doc.setTextColor(...C.body); doc.setFont('helvetica','normal');
    doc.text(region.label + ' Overall NPS  ·  ' + nd.total + ' respondents', ML+30, y+10);
    doc.text('Supportive: ' + nd.promoterPct + '%  ·  Neutral: ' + nd.passivePct + '%  ·  Concerns: ' + nd.detractorPct + '%', ML+30, y+16);
    y += 30;

    // QoQ table
    if (allQoQ.length >= 2) {
      doc.setFont('helvetica','bold'); doc.setFontSize(11); doc.setTextColor(...C.navy);
      doc.text('Quarter-over-Quarter Trend', ML, y); y += 5;
      doc.autoTable({
        startY: y,
        head: [['Quarter','NPS','Change','Respondents']],
        body: allQoQ.map((q,i) => {
          const prev = i>0 ? allQoQ[i-1].nps : null;
          const delta = (prev!==null && q.nps!==null) ? Math.round((q.nps-prev)*10)/10 : null;
          return [ss(q.quarter), fmtN(q.nps), delta!==null?(delta>=0?'+'+delta:''+delta)+' pts':'—', String(q.total)];
        }),
        margin:{left:ML,right:MR},
        styles:{fontSize:9,cellPadding:3},
        headStyles:{fillColor:C.navy,textColor:C.white,fontStyle:'bold',fontSize:8},
        alternateRowStyles:{fillColor:C.light},
      });
      y = doc.lastAutoTable.finalY + 8;
    }

    // School breakdown
    doc.setFont('helvetica','bold'); doc.setFontSize(11); doc.setTextColor(...C.navy);
    doc.text('School Breakdown', ML, y); y += 5;
    const schools = [...new Set(regionRows.map(r=>r.school).filter(Boolean))].sort();
    const schoolRows = schools.map(s => {
      const sr = regionRows.filter(r=>r.school===s);
      const curr = recentQ ? sr.filter(r=>r.quarter===recentQ) : sr;
      const prev = prevQ  ? sr.filter(r=>r.quarter===prevQ)   : [];
      const { nps: cNPS, total } = calcNPS(curr);
      const { nps: pNPS } = calcNPS(prev);
      const delta = (cNPS!==null&&pNPS!==null) ? Math.round((cNPS-pNPS)*10)/10 : null;
      const risk  = siteRisk(curr, prev);
      const rIcon = risk==='at-risk'?'🔴':risk==='watch'?'🟡':'✅';
      return [rIcon+' '+ss(s), String(total), fmtN(cNPS), delta!==null?(delta>=0?'+'+delta:''+delta)+' pts':'—', risk.toUpperCase()];
    });
    if (schoolRows.length) {
      doc.autoTable({
        startY: y,
        head: [['School','N','NPS',recentQ&&prevQ?'Δ '+ss(prevQ)+'→'+ss(recentQ):'Trend','Status']],
        body: schoolRows,
        margin:{left:ML,right:MR},
        styles:{fontSize:8.5,cellPadding:3},
        headStyles:{fillColor:C.navy,textColor:C.white,fontStyle:'bold',fontSize:8},
        alternateRowStyles:{fillColor:C.light},
        columnStyles:{4:{fontStyle:'bold'}},
      });
      y = doc.lastAutoTable.finalY + 8;
    }

    // Role breakdown
    if (y < 240) {
      doc.setFont('helvetica','bold'); doc.setFontSize(11); doc.setTextColor(...C.navy);
      doc.text('Sentiment by Role', ML, y); y += 5;
      const roles = [...new Set(regionRows.map(r=>r.role).filter(Boolean))].sort();
      const roleRows = roles.map(role => {
        const rr = regionRows.filter(r=>r.role===role);
        const { nps, total } = calcNPS(rr);
        return [ss(role), String(total), fmtN(nps)];
      });
      doc.autoTable({
        startY: y,
        head: [['Role','Respondents','NPS']],
        body: roleRows,
        margin:{left:ML,right:MR},
        styles:{fontSize:9,cellPadding:3},
        headStyles:{fillColor:C.navy,textColor:C.white,fontStyle:'bold',fontSize:8},
        alternateRowStyles:{fillColor:C.light},
      });
      y = doc.lastAutoTable.finalY + 8;
    }

    // Footer
    const pageCount = doc.internal.getNumberOfPages();
    for (let p = 1; p <= pageCount; p++) {
      doc.setPage(p);
      doc.setFontSize(7); doc.setTextColor(...C.muted);
      doc.text(
        'NJTC ' + region.label + ' Summary  ·  ' + dateStr + '  ·  Page ' + p + ' of ' + pageCount,
        ML, 292
      );
    }
    dlPdf(doc, 'njtc-region-' + regionKey.toLowerCase());
  }

  // ── Public summary API (used by PIE) ──────────────────────────────
  window.sfGetSummary = function () {
    if (!_allData || !_allData.length) return null;
    const pub = pubData(_allData);
    const qs  = getQuarters();
    const qoq = qoqBreakdown(pub);
    const overall = calcNPS(pub);

    // Per-role breakdown
    const byRole = {};
    getRoles().forEach(role => {
      const rows = pub.filter(r => r.role === role);
      byRole[role] = Object.assign({ count: rows.length }, calcNPS(rows));
    });

    // Per-district breakdown
    const byDistrict = {};
    getDistricts().forEach(dist => {
      const rows = pub.filter(r => r.district === dist);
      byDistrict[dist] = Object.assign({ count: rows.length }, calcNPS(rows));
    });

    // Per-school breakdown with trajectory
    const allSchools = getSchools();
    const bySchool = {};
    allSchools.forEach(school => {
      const rows = pub.filter(r => r.school === school);
      const district = rows[0] ? rows[0].district : '';
      const { nps, total } = calcNPS(rows);
      let prevNPS = null;
      if (qs.length >= 2) {
        const prev = pub.filter(r => r.school === school && r.quarter === qs[qs.length - 2]);
        const curr = pub.filter(r => r.school === school && r.quarter === qs[qs.length - 1]);
        if (prev.length) prevNPS = calcNPS(prev).nps;
        const risk = siteRisk(curr, prev);
        const traj = trajBadge(calcNPS(curr).nps, prevNPS);
        bySchool[school] = { district, nps, total, risk, trajectory: traj.label, delta: traj.delta };
      } else {
        const curr = qs.length === 1 ? pub.filter(r => r.school === school && r.quarter === qs[0]) : rows;
        const risk = siteRisk(curr, []);
        bySchool[school] = { district, nps, total, risk, trajectory: '—', delta: 0 };
      }
    });

    // Categorise schools
    const atRisk    = Object.entries(bySchool).filter(([,v]) => v.risk === 'at-risk').map(([k]) => k);
    const watch     = Object.entries(bySchool).filter(([,v]) => v.risk === 'watch').map(([k]) => k);
    const improving = Object.entries(bySchool).filter(([,v]) => v.trajectory.includes('Improving')).map(([k]) => k);
    const declining = Object.entries(bySchool).filter(([,v]) => v.trajectory.includes('Declining')).map(([k]) => k);

    // Best / lowest school (by NPS, with ≥2 respondents)
    const schoolList = Object.entries(bySchool).filter(([,v]) => v.total >= 2);
    const bestSchool    = schoolList.length ? schoolList.reduce((a, b) => (b[1].nps || -999) > (a[1].nps || -999) ? b : a, schoolList[0]) : null;
    const lowestSchool  = schoolList.length ? schoolList.reduce((a, b) => (b[1].nps || 999) < (a[1].nps || 999) ? b : a, schoolList[0]) : null;

    // Dissatisfaction reasons frequency
    const dissatFreq = {};
    _allData.forEach(r => r.dissatisfactionReasons.forEach(reason => {
      dissatFreq[reason] = (dissatFreq[reason] || 0) + 1;
    }));
    const topDissat = Object.entries(dissatFreq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([reason, count]) => ({ reason, count }));

    // Quarter-specific NPS quick-lookup
    const quarterNPS = {};
    qoq.forEach(q => { quarterNPS[q.quarter] = { nps: q.nps, total: q.total, avgScore: q.avgScore }; });

    return {
      loaded: true,
      totalRespondents: overall.total,
      overallNPS: overall.nps,
      promoters: overall.promoters,
      passives: overall.passives,
      detractors: overall.detractors,
      promoterPct: overall.promoterPct,
      passivePct: overall.passivePct,
      detractorPct: overall.detractorPct,
      quarters: qs,
      quarterNPS,
      qoq,
      byRole,
      byDistrict,
      bySchool,
      atRisk,
      watch,
      improving,
      declining,
      bestSchool:   bestSchool   ? { name: bestSchool[0],   ...bestSchool[1]   } : null,
      lowestSchool: lowestSchool ? { name: lowestSchool[0], ...lowestSchool[1] } : null,
      topDissat,
    };
  };

  // ── Boot ─────────────────────────────────────────────────────────
  init();

})();
