/* ══════════════════════════════════════════════════════════════════════
   NJTC Scholar Survey — Scholar Feedback Module
   schf-* namespace | Confidence NPS (1–5) for Math & Literacy, by region/site
   Mirrors the architecture of survey-feedback.js (Partner Satisfaction)
══════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  const CSV_URL = 'https://docs.google.com/spreadsheets/d/19Ox5UtW9BgJoMYSXH7ybDCSwS0vmOKGUmxkozm7rk9A/export?format=csv&gid=1733049715';

  // ── Site → Region map ──────────────────────────────────────────────
  // Built and verified directly against the SY 25-26 Scholar Survey roster
  // (33 sites). Region split confirmed against source dashboard: NE=597, SW=429.
  const SITE_REGION = {
    'iLearn Charter School Paterson ES':                                                   'NE',
    'iLearn Charter School Paterson MS':                                                   'NE',
    'iLearn Charter School Paterson Silk City Campus [K-3]':                                'NE',
    'iLearn Charter School Bergen ES':                                                      'NE',
    'iLearn Charter School Bergen MS':                                                      'NE',
    'iLearn Charter School Clifton ES':                                                     'NE',
    'iLearn Charter School Clifton MS':                                                     'NE',
    'iLearn Charter School Clifton HS':                                                     'NE',
    'iLearn Charter School Hudson ES':                                                       'NE',
    'iLearn Charter School Hudson MS':                                                       'NE',
    'iLearn Charter School Passaic ES':                                                      'NE',
    'iLearn Charter School Passaic MS':                                                      'NE',
    'Central Jersey College Prep':                                                           'NE',
    'Middlesex STEM':                                                                        'NE',
    'Paterson Charter (PCSST) - Paterson Charter School Science & Tech (MS 4-7) - Wabash':    'NE',
    'AMERICAN PARADIGM SCHOOLS - First Philadelphia Preparatory Charter School':              'NE',
    'Global Leadership Academy':                                                              'SW',
    'Gloucester Twp - Loring-Flemming':                                                       'SW',
    'Haddon Township - Clyde S Jennings Elementary School':                                   'SW',
    'Haddon Township - Stoy Elementary School':                                               'SW',
    'Haddon Township - Strawbridge Elementary School':                                        'SW',
    'Haddon Township - Thomas Edison Elementary School':                                      'SW',
    'Haddon Township - Van Sciver Elementary School':                                         'SW',
    'Hamilton Township School District  Albert E. Grice Middle School':                       'SW',
    'Hamilton Township School District  Crockett Middle School':                              'SW',
    'Hamilton Township School District  Greenwood  Elementary School':                        'SW',
    'Hamilton Township School District  Klockner  Elementary School':                         'SW',
    'Hamilton Township School District  Kuser Elementary School':                              'SW',
    'Hamilton Township School District  Wilson Elementary School':                            'SW',
    'Penns Grove - Field Street Elementary':                                                   'SW',
    'Penns Grove - P.W. Carleton Elementary':                                                  'SW',
    'Penns Grove Penns Grove - MS':                                                            'SW',
    'STRING THEORY SCHOOLS - The Philadelphia Charter School For Arts & Sciences':             'SW',
  };
  function siteRegion(site) {
    const s = (site || '').trim();
    if (SITE_REGION[s]) return SITE_REGION[s];
    // Fallback fuzzy match for any future site name variants
    const ls = s.toLowerCase();
    if (ls.includes('ilearn') || ls.includes('paterson') || ls.includes('central jersey') ||
        ls.includes('middlesex') || ls.includes('american paradigm') || ls.includes('first philadelphia')) return 'NE';
    if (ls.includes('haddon') || ls.includes('hamilton') || ls.includes('penns grove') ||
        ls.includes('gloucester') || ls.includes('global leadership') || ls.includes('string theory')) return 'SW';
    return 'Unknown';
  }

  // ── State ──────────────────────────────────────────────────────────
  let _allData = [];
  let _loading = false, _loaded = false;
  let _filters = { region: '', site: '' };
  let _charts = {};
  let _csvMeta = { headers: [], totalRaw: 0 };

  // ── CSV Parser — RFC 4180 compliant (shared pattern w/ survey-feedback.js) ──
  function parseCSV(text) {
    const rows = [];
    let row = [], cell = '', inQ = false;
    let src = text.charCodeAt(0) === 0xFEFF ? text.slice(1) : text;
    for (let i = 0; i < src.length; i++) {
      const ch = src[i];
      if (ch === '"') {
        if (inQ && src[i + 1] === '"') { cell += '"'; i++; }
        else { inQ = !inQ; }
      } else if (ch === ',' && !inQ) {
        row.push(cell); cell = '';
      } else if (!inQ && (ch === '\n' || ch === '\r')) {
        row.push(cell); cell = '';
        if (row.some(c => c.trim())) rows.push(row);
        row = [];
        if (ch === '\r' && src[i + 1] === '\n') i++;
      } else {
        cell += ch;
      }
    }
    if (cell || row.length) { row.push(cell); if (row.some(c => c.trim())) rows.push(row); }
    if (!rows.length) return [];
    const headers = rows[0].map(h => h.trim());
    return rows.slice(1).map(vals => {
      const obj = {};
      headers.forEach((h, idx) => { obj[h] = (vals[idx] !== undefined ? vals[idx].trim() : ''); });
      return obj;
    });
  }

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

  function isYes(v) { return (v || '').trim().toLowerCase() === 'yes'; }
  function isNo(v)  { return (v || '').trim().toLowerCase() === 'no';  }

  // ── Row normalization ────────────────────────────────────────────────
  function normalizeRow(raw) {
    const site = pickField(raw,
      ['Select your site location from the list below:', 'Select your site location from the list below', 'Site'],
      /site location/i);
    const name = pickField(raw, ["Type student's name", "Type student's name:", 'Name'], /student.?s name/i);

    const mathParticipated = pickField(raw, ["Did you participate in Math tutoring this school year?"], /participate in math/i);
    const mathConfidence    = parseInt(pickField(raw, ['Do you feel stronger doing math now compared to how you felt when tutoring started?'], /stronger doing math/i)) || null;
    const mathEnjoyTutor     = pickField(raw, ['Did you enjoy working with your tutor?'], /enjoy working with your tutor\??$/i);
    const mathLikedProgram   = pickField(raw, ['Did you like participating in the program? '], /like participating in the program/i);
    const mathHelpFriends    = pickField(raw, ['Do you feel like you could help your friends with MATH if they asked or needed it? '], /help your friends with math/i);
    const mathParticipateMore= pickField(raw, ['Do you think you will participate more in math class after tutoring?'], /participate more in math class/i);
    const mathEnjoyLearning  = pickField(raw, ['Do you enjoy learning more now than you did before tutoring started?'], /enjoy learning more now than you did before tutoring started\?$/i);

    const litParticipated = pickField(raw, ['Did you participate in literacy tutoring? '], /participate in literacy/i);
    const litConfidence     = parseInt(pickField(raw, ['Do you feel stronger in reading and writing now compared to how you felt when tutoring started?'], /stronger in reading and writing/i)) || null;
    const litEnjoyTutor      = pickField(raw, ['Did you enjoy working with your tutor? 2'], /enjoy working with your tutor.*2/i);
    const litLikedProgram    = pickField(raw, ['Did you like participating in the program?  2'], /like participating in the program.*2/i);
    const litParticipateMore = pickField(raw, ['Do you think you will participate more in Reading/Writing class now?'], /participate more in reading.?writing/i);
    const litHelpFriends     = pickField(raw, ['Do you feel like you could help your friends with reading or writing if they needed help?'], /help your friends with reading or writing/i);
    const litEnjoyLearning   = pickField(raw, ['Do you enjoy learning more now than you did before tutoring started? 2'], /enjoy learning more now than you did before tutoring started.*2/i);

    return {
      timestamp: raw['Timestamp'] || '',
      name, site,
      region: siteRegion(site),
      mathParticipated: isYes(mathParticipated),
      mathConfidence,
      mathEnjoyTutor: isYes(mathEnjoyTutor), mathEnjoyTutorAnswered: !!mathEnjoyTutor,
      mathLikedProgram: isYes(mathLikedProgram), mathLikedProgramAnswered: !!mathLikedProgram,
      mathHelpFriends: isYes(mathHelpFriends), mathHelpFriendsAnswered: !!mathHelpFriends,
      mathParticipateMore: isYes(mathParticipateMore), mathParticipateMoreAnswered: !!mathParticipateMore,
      mathEnjoyLearning: isYes(mathEnjoyLearning), mathEnjoyLearningAnswered: !!mathEnjoyLearning,
      litParticipated: isYes(litParticipated),
      litConfidence,
      litEnjoyTutor: isYes(litEnjoyTutor), litEnjoyTutorAnswered: !!litEnjoyTutor,
      litLikedProgram: isYes(litLikedProgram), litLikedProgramAnswered: !!litLikedProgram,
      litParticipateMore: isYes(litParticipateMore), litParticipateMoreAnswered: !!litParticipateMore,
      litHelpFriends: isYes(litHelpFriends), litHelpFriendsAnswered: !!litHelpFriends,
      litEnjoyLearning: isYes(litEnjoyLearning), litEnjoyLearningAnswered: !!litEnjoyLearning,
    };
  }

  // ── NPS-style confidence calc — Promoters(4-5)/Passives(3)/Detractors(1-2) ──
  function calcConfNPS(rows, scoreKey) {
    const valid = rows.filter(r => r[scoreKey] >= 1 && r[scoreKey] <= 5);
    const promoters  = valid.filter(r => r[scoreKey] >= 4).length;
    const detractors = valid.filter(r => r[scoreKey] <= 2).length;
    const passives   = valid.filter(r => r[scoreKey] === 3).length;
    const total = valid.length;
    const avg = total ? valid.reduce((s, r) => s + r[scoreKey], 0) / total : null;
    const nps = total === 0 ? null : Math.round(((promoters - detractors) / total) * 100);
    return { promoters, detractors, passives, total, avg, nps };
  }
  function npsRating(nps) {
    if (nps === null) return { label: '—', color: '#7d8fa1' };
    if (nps >= 70) return { label: '🟢 Strong',           color: '#0d6e3a' };
    if (nps >= 50) return { label: '🟡 Good',             color: '#c05c00' };
    if (nps >= 30) return { label: '🟠 Moderate',         color: '#c05c00' };
    if (nps >= 0)  return { label: '⚠️ Needs Attention',  color: '#b45309' };
    return { label: '🔴 Critical', color: '#b91c1c' };
  }
  function fmtNPS(nps) { return nps === null ? 'N/A' : (nps > 0 ? '+' : '') + nps + '%'; }

  function yesPct(rows, key, answeredKey) {
    const answered = rows.filter(r => r[answeredKey]);
    const yes = answered.filter(r => r[key]).length;
    return { yes, total: answered.length, pct: answered.length ? yes / answered.length : null };
  }

  // ── Filtering ──────────────────────────────────────────────────────
  function filteredData() {
    return _allData.filter(r =>
      (!_filters.region || r.region === _filters.region) &&
      (!_filters.site   || r.site === _filters.site));
  }
  function getSites() {
    return [...new Set(_allData.map(r => r.site).filter(Boolean))].sort();
  }

  // ── Data load ──────────────────────────────────────────────────────
  function onPanelOpen() {
    if (_loading) return;
    if (!_loaded) { loadData(); return; }
    renderShell();
    renderBody();
  }

  async function loadData() {
    _loading = true;
    const el = document.getElementById('schfContainer');
    if (el) el.innerHTML = `
      <div class="sf-loading">
        <div class="sf-spinner"></div>
        Loading scholar survey data…
      </div>`;
    try {
      const resp = await fetch(CSV_URL, { signal: AbortSignal.timeout(20000) });
      if (!resp.ok) throw new Error('HTTP ' + resp.status);
      const text = await resp.text();
      const rawRows = parseCSV(text);
      _csvMeta = { headers: rawRows.length ? Object.keys(rawRows[0]) : [], totalRaw: rawRows.length };
      _allData = rawRows.map(normalizeRow).filter(r => r.site);
      _loaded = true;
      renderShell();
      renderBody();
    } catch (err) {
      const el2 = document.getElementById('schfContainer');
      if (el2) el2.innerHTML = `
        <div class="sf-error">
          <strong>Failed to load scholar survey data.</strong><br>
          ${err.message}<br>
          <span style="font-size:.75rem;color:var(--muted);word-break:break-all">${CSV_URL}</span><br><br>
          <button class="btn btn-secondary" onclick="schfRetry()">↻ Retry</button>
        </div>`;
    } finally {
      _loading = false;
    }
  }
  window.schfRetry   = function () { _loaded = false; destroyAll(); onPanelOpen(); };
  window.schfRefresh = function () { _loaded = false; destroyAll(); loadData(); };

  function destroyAll() {
    Object.values(_charts).forEach(c => { try { c.destroy(); } catch (e) {} });
    _charts = {};
  }

  // ── Shell ────────────────────────────────────────────────────────────
  function renderShell() {
    const el = document.getElementById('schfContainer');
    if (!el) return;
    el.innerHTML = `
      <div class="page-header">
        <div class="ph-text">
          <div class="ph-eyebrow">Survey Feedback</div>
          <div class="ph-title">Scholar Feedback</div>
          <div class="ph-subtitle">
            SY 25-26 Scholar Survey — self-reported confidence and program satisfaction, Math &amp; Literacy.
            <span style="color:var(--muted);font-size:.8em"> &middot; Confidence NPS (1&ndash;5 Scale)</span>
          </div>
        </div>
        <div class="ph-actions">
          <button class="btn btn-secondary" onclick="schfRefresh()" title="Re-fetch data from Google Sheets">&#8635; Refresh</button>
        </div>
      </div>
      <div id="schfFilterBar"></div>
      <div id="schfBody"></div>`;
  }

  function filterBarHTML() {
    const sites = getSites();
    return `
      <div class="sf-filter-bar">
        <div class="sf-filter-group">
          <div class="sf-filter-label">Region</div>
          <div class="sf-chips">
            <button class="sf-chip${!_filters.region ? ' active' : ''}" onclick="schfSetRegion('')">All</button>
            <button class="sf-chip${_filters.region === 'NE' ? ' active' : ''}" onclick="schfSetRegion('NE')">🔵 North-East</button>
            <button class="sf-chip${_filters.region === 'SW' ? ' active' : ''}" onclick="schfSetRegion('SW')">🟠 South-West</button>
          </div>
        </div>
        <div class="sf-filter-group">
          <div class="sf-filter-label">Site</div>
          <select class="filter-select" onchange="schfSetSite(this.value)">
            <option value="">All Sites</option>
            ${sites.map(s => `<option value="${s.replace(/"/g,'&quot;')}"${_filters.site===s?' selected':''}>${s}</option>`).join('')}
          </select>
        </div>
        <button class="btn btn-secondary sf-clear-btn" onclick="schfClearFilters()">Clear</button>
      </div>`;
  }
  window.schfSetRegion = function (r) { _filters.region = r; _filters.site = ''; renderBody(); };
  window.schfSetSite   = function (s) { _filters.site = s; renderBody(); };
  window.schfClearFilters = function () { _filters = { region: '', site: '' }; renderBody(); };

  // ── Body ──────────────────────────────────────────────────────────
  function renderBody() {
    const fbEl = document.getElementById('schfFilterBar');
    if (fbEl) fbEl.innerHTML = filterBarHTML();
    const el = document.getElementById('schfBody');
    if (!el) return;
    destroyAll();

    const rows = filteredData();
    if (!rows.length) {
      el.innerHTML = '<div class="sf-empty">No scholar survey responses match the current filters.</div>';
      return;
    }

    const mathRows = rows.filter(r => r.mathParticipated);
    const litRows  = rows.filter(r => r.litParticipated);
    const bothRows = rows.filter(r => r.mathParticipated && r.litParticipated);
    const neRows = rows.filter(r => r.region === 'NE');
    const swRows = rows.filter(r => r.region === 'SW');

    const mathNPS = calcConfNPS(mathRows, 'mathConfidence');
    const litNPS  = calcConfNPS(litRows, 'litConfidence');
    const mathNPSne = calcConfNPS(neRows.filter(r => r.mathParticipated), 'mathConfidence');
    const mathNPSsw = calcConfNPS(swRows.filter(r => r.mathParticipated), 'mathConfidence');
    const litNPSne  = calcConfNPS(neRows.filter(r => r.litParticipated), 'litConfidence');
    const litNPSsw  = calcConfNPS(swRows.filter(r => r.litParticipated), 'litConfidence');

    el.innerHTML = `
      <!-- A: Program Overview -->
      <div class="sf-section">
        <div class="sf-section-hdr">
          <div class="sf-section-title">A &mdash; Program Overview</div>
          <div class="sf-method">Total respondents and program participation, filtered scope (n=${rows.length}).</div>
        </div>
        <div class="ta-grid ta-grid-4" style="margin-bottom:.75rem">
          <div class="ta-card ta-kpi ok"><div class="ta-kpi-val">${rows.length}</div><div class="ta-kpi-sub">Total Respondents</div></div>
          <div class="ta-card ta-kpi"><div class="ta-kpi-val">${mathRows.length}</div><div class="ta-kpi-sub">Math Participants (${pct(mathRows.length, rows.length)})</div></div>
          <div class="ta-card ta-kpi"><div class="ta-kpi-val">${litRows.length}</div><div class="ta-kpi-sub">Literacy Participants (${pct(litRows.length, rows.length)})</div></div>
          <div class="ta-card ta-kpi"><div class="ta-kpi-val">${bothRows.length}</div><div class="ta-kpi-sub">Dual-Enrolled (${pct(bothRows.length, rows.length)})</div></div>
        </div>
        <div class="ta-grid ta-grid-3">
          <div class="ta-card ta-kpi"><div class="ta-kpi-val">${neRows.length}</div><div class="ta-kpi-sub">🔵 NE Region Scholars (${pct(neRows.length, rows.length)})</div></div>
          <div class="ta-card ta-kpi"><div class="ta-kpi-val">${swRows.length}</div><div class="ta-kpi-sub">🟠 SW Region Scholars (${pct(swRows.length, rows.length)})</div></div>
          <div class="ta-card ta-kpi"><div class="ta-kpi-val">${getSites().length}</div><div class="ta-kpi-sub">Sites Represented</div></div>
        </div>
      </div>

      <!-- B: Confidence NPS -->
      <div class="sf-section">
        <div class="sf-section-hdr">
          <div class="sf-section-title">B &mdash; Scholar Confidence NPS</div>
          <div class="sf-method">Adapted NPS (1&ndash;5 scale). Promoters = 4 or 5 | Passives = 3 | Detractors = 1 or 2. Formula: ((Promoters &minus; Detractors) &divide; Total) &times; 100.</div>
        </div>
        <div class="sf-charts-row" style="margin-bottom:1rem">
          ${confCardHTML('📐 Math — All Regions', mathNPS)}
          ${confCardHTML('📖 Literacy — All Regions', litNPS)}
        </div>
        <div style="overflow-x:auto">
          <table class="sf-table">
            <thead><tr><th>Subject / Segment</th><th>N Scored</th><th>Promoters (4&ndash;5)</th><th>Passives (3)</th><th>Detractors (1&ndash;2)</th><th>Avg Score (/5)</th><th>NPS</th><th>Rating</th></tr></thead>
            <tbody>
              ${confRowHTML('📐 Math — All Regions', mathNPS)}
              ${confRowHTML('&nbsp;&nbsp;• Math — North-East', mathNPSne)}
              ${confRowHTML('&nbsp;&nbsp;• Math — South-West', mathNPSsw)}
              ${confRowHTML('📖 Literacy — All Regions', litNPS)}
              ${confRowHTML('&nbsp;&nbsp;• Literacy — North-East', litNPSne)}
              ${confRowHTML('&nbsp;&nbsp;• Literacy — South-West', litNPSsw)}
            </tbody>
          </table>
        </div>
      </div>

      <!-- C: Math Outcomes -->
      <div class="sf-section">
        <div class="sf-section-hdr">
          <div class="sf-section-title">C &mdash; Math Tutoring Outcomes</div>
          <div class="sf-method">n = ${mathRows.length} Math Participants. % Yes of those who answered each question.</div>
        </div>
        ${outcomesTableHTML(mathRows, neRows.filter(r=>r.mathParticipated), swRows.filter(r=>r.mathParticipated), [
          ['Enjoyed working with their tutor', 'mathEnjoyTutor', 'mathEnjoyTutorAnswered'],
          ['Liked participating in the program', 'mathLikedProgram', 'mathLikedProgramAnswered'],
          ['Feel they can help friends with Math', 'mathHelpFriends', 'mathHelpFriendsAnswered'],
          ['Will participate more in math class', 'mathParticipateMore', 'mathParticipateMoreAnswered'],
          ['Enjoy learning more after tutoring', 'mathEnjoyLearning', 'mathEnjoyLearningAnswered'],
        ])}
      </div>

      <!-- D: Literacy Outcomes -->
      <div class="sf-section">
        <div class="sf-section-hdr">
          <div class="sf-section-title">D &mdash; Literacy Tutoring Outcomes</div>
          <div class="sf-method">n = ${litRows.length} Literacy Participants. % Yes of those who answered each question.</div>
        </div>
        ${outcomesTableHTML(litRows, neRows.filter(r=>r.litParticipated), swRows.filter(r=>r.litParticipated), [
          ['Enjoyed working with their tutor', 'litEnjoyTutor', 'litEnjoyTutorAnswered'],
          ['Liked participating in the program', 'litLikedProgram', 'litLikedProgramAnswered'],
          ['Will participate more in Reading/Writing', 'litParticipateMore', 'litParticipateMoreAnswered'],
          ['Feel they can help friends with reading/writing', 'litHelpFriends', 'litHelpFriendsAnswered'],
          ['Enjoy learning more after literacy tutoring', 'litEnjoyLearning', 'litEnjoyLearningAnswered'],
        ])}
      </div>

      <!-- E: Region Head-to-Head -->
      <div class="sf-section">
        <div class="sf-section-hdr">
          <div class="sf-section-title">E &mdash; Region Head-to-Head Comparison</div>
          <div class="sf-method">North-East vs. South-West, across key confidence and satisfaction metrics.</div>
        </div>
        ${regionCompareTableHTML(rows)}
      </div>

      <!-- F: Site Breakdown -->
      <div class="sf-section">
        <div class="sf-section-hdr">
          <div class="sf-section-title">F &mdash; Site-Level Breakdown</div>
          <div class="sf-method">All sites, sorted by total respondents.</div>
        </div>
        <div id="schfSiteTable" style="overflow-x:auto"></div>
      </div>

      <!-- G: Intelligence Summary -->
      <div class="sf-section">
        <div class="sf-section-hdr">
          <div class="sf-section-title">G &mdash; Scholar Intelligence Summary</div>
        </div>
        ${intelligenceSummaryHTML(rows, mathRows, litRows, neRows, swRows, mathNPS, litNPS, mathNPSne, mathNPSsw)}
      </div>`;

    renderSiteTable('schfSiteTable', rows);
  }

  function pct(n, total) { return total ? Math.round(n / total * 100) + '%' : '0%'; }

  function confCardHTML(label, nd) {
    const r = npsRating(nd.nps);
    return `
      <div class="sf-chart-card" style="flex:1;min-width:220px">
        <div class="sf-chart-title">${label}</div>
        <div class="sf-nps-score" style="color:${r.color}">${fmtNPS(nd.nps)}</div>
        <div class="sf-nps-n">n = ${nd.total}${nd.avg !== null ? ' &middot; avg ' + nd.avg.toFixed(2) + '/5' : ''}</div>
        <div class="sf-nps-sublabel">${r.label}</div>
      </div>`;
  }

  function confRowHTML(label, nd) {
    const r = npsRating(nd.nps);
    return `<tr>
      <td>${label}</td>
      <td>${nd.total}</td>
      <td>${nd.promoters} (${pct(nd.promoters, nd.total)})</td>
      <td>${nd.passives} (${pct(nd.passives, nd.total)})</td>
      <td>${nd.detractors} (${pct(nd.detractors, nd.total)})</td>
      <td>${nd.avg !== null ? nd.avg.toFixed(2) + '/5' : '—'}</td>
      <td style="font-weight:700;color:${r.color}">${fmtNPS(nd.nps)}</td>
      <td>${r.label}</td>
    </tr>`;
  }

  function outcomesTableHTML(allRows, neRows, swRows, questions) {
    return `<div style="overflow-x:auto"><table class="sf-table">
      <thead><tr><th>Outcome Question</th><th>Overall Yes</th><th>Overall %</th><th>NE Yes</th><th>NE %</th><th>SW Yes</th><th>SW %</th></tr></thead>
      <tbody>
        ${questions.map(([label, key, answeredKey]) => {
          const all = yesPct(allRows, key, answeredKey);
          const ne  = yesPct(neRows, key, answeredKey);
          const sw  = yesPct(swRows, key, answeredKey);
          return `<tr>
            <td>${label}</td>
            <td>${all.yes}</td><td style="font-weight:700">${all.pct !== null ? Math.round(all.pct*100)+'%' : '—'}</td>
            <td>${ne.yes}</td><td>${ne.pct !== null ? Math.round(ne.pct*100)+'%' : '—'}</td>
            <td>${sw.yes}</td><td>${sw.pct !== null ? Math.round(sw.pct*100)+'%' : '—'}</td>
          </tr>`;
        }).join('')}
      </tbody>
    </table></div>`;
  }

  function regionCompareTableHTML(rows) {
    const ne = rows.filter(r => r.region === 'NE');
    const sw = rows.filter(r => r.region === 'SW');
    const neMath = ne.filter(r => r.mathParticipated), swMath = sw.filter(r => r.mathParticipated);
    const neLit  = ne.filter(r => r.litParticipated),  swLit  = sw.filter(r => r.litParticipated);
    const allMath = rows.filter(r => r.mathParticipated), allLit = rows.filter(r => r.litParticipated);

    const mathNPSall = calcConfNPS(allMath, 'mathConfidence');
    const mathNPSne  = calcConfNPS(neMath, 'mathConfidence');
    const mathNPSsw  = calcConfNPS(swMath, 'mathConfidence');
    const litNPSall  = calcConfNPS(allLit, 'litConfidence');
    const litNPSne   = calcConfNPS(neLit, 'litConfidence');
    const litNPSsw   = calcConfNPS(swLit, 'litConfidence');

    const enjoyMathAll = yesPct(allMath, 'mathEnjoyTutor', 'mathEnjoyTutorAnswered');
    const enjoyMathNE  = yesPct(neMath, 'mathEnjoyTutor', 'mathEnjoyTutorAnswered');
    const enjoyMathSW  = yesPct(swMath, 'mathEnjoyTutor', 'mathEnjoyTutorAnswered');

    const rowsDef = [
      ['Math Confidence NPS', fmtPctPair(mathNPSall.nps), fmtPctPair(mathNPSne.nps), fmtPctPair(mathNPSsw.nps), deltaPP(mathNPSne.nps, mathNPSsw.nps)],
      ['Math Avg Score (/5)', fmt2(mathNPSall.avg), fmt2(mathNPSne.avg), fmt2(mathNPSsw.avg), deltaNum(mathNPSne.avg, mathNPSsw.avg)],
      ['Literacy Confidence NPS', fmtPctPair(litNPSall.nps), fmtPctPair(litNPSne.nps), fmtPctPair(litNPSsw.nps), deltaPP(litNPSne.nps, litNPSsw.nps)],
      ['Enjoyed Math Tutor %', fmtPct1(enjoyMathAll.pct), fmtPct1(enjoyMathNE.pct), fmtPct1(enjoyMathSW.pct), deltaPP(pctToWhole(enjoyMathNE.pct), pctToWhole(enjoyMathSW.pct))],
    ];
    return `<div style="overflow-x:auto"><table class="sf-table">
      <thead><tr><th>Metric</th><th>Overall</th><th>North-East</th><th>South-West</th><th>NE vs SW Delta</th></tr></thead>
      <tbody>${rowsDef.map(r => `<tr><td>${r[0]}</td><td>${r[1]}</td><td>${r[2]}</td><td>${r[3]}</td><td>${r[4]}</td></tr>`).join('')}</tbody>
    </table></div>`;
  }
  function fmtPctPair(nps) { return nps === null ? '—' : nps + '%'; }
  function fmtPct1(p) { return p === null ? '—' : Math.round(p*100) + '%'; }
  function pctToWhole(p) { return p === null ? null : Math.round(p*100); }
  function fmt2(v) { return v === null ? '—' : v.toFixed(2); }
  function deltaPP(a, b) {
    if (a === null || b === null) return '—';
    const d = b - a;
    return (d > 0 ? '+' : '') + d + 'pp';
  }
  function deltaNum(a, b) {
    if (a === null || b === null) return '—';
    const d = b - a;
    return (d > 0 ? '+' : '') + d.toFixed(2);
  }

  function renderSiteTable(containerId, rows) {
    const el = document.getElementById(containerId);
    if (!el) return;
    const bySite = {};
    rows.forEach(r => {
      if (!bySite[r.site]) bySite[r.site] = { site: r.site, region: r.region, rows: [] };
      bySite[r.site].rows.push(r);
    });
    const siteRows = Object.values(bySite).map(s => {
      const mathR = s.rows.filter(r => r.mathParticipated);
      const litR  = s.rows.filter(r => r.litParticipated);
      const mNPS = calcConfNPS(mathR, 'mathConfidence');
      const lNPS = calcConfNPS(litR, 'litConfidence');
      return {
        site: s.site, region: s.region, total: s.rows.length,
        math: mathR.length, lit: litR.length,
        mathNPS: mNPS.nps, litNPS: lNPS.nps,
        mathAvg: mNPS.avg, litAvg: lNPS.avg,
      };
    }).sort((a, b) => b.total - a.total);

    el.innerHTML = `<table class="sf-table">
      <thead><tr><th>Site</th><th>Region</th><th>Total</th><th>Math</th><th>Lit</th><th>Math NPS</th><th>Lit NPS</th><th>Math Avg/5</th><th>Lit Avg/5</th></tr></thead>
      <tbody>
        ${siteRows.map(s => `<tr>
          <td><strong>${s.site}</strong></td>
          <td>${s.region === 'NE' ? '🔵 NE' : s.region === 'SW' ? '🟠 SW' : s.region}</td>
          <td style="font-weight:700">${s.total}</td>
          <td>${s.math}</td><td>${s.lit}</td>
          <td>${s.mathNPS !== null ? fmtNPS(s.mathNPS) : '—'}</td>
          <td>${s.litNPS !== null ? fmtNPS(s.litNPS) : '—'}</td>
          <td>${s.mathAvg !== null ? s.mathAvg.toFixed(2) : '—'}</td>
          <td>${s.litAvg !== null ? s.litAvg.toFixed(2) : '—'}</td>
        </tr>`).join('')}
      </tbody>
    </table>`;
  }

  function intelligenceSummaryHTML(rows, mathRows, litRows, neRows, swRows, mathNPS, litNPS, mathNPSne, mathNPSsw) {
    const enjoyMath = yesPct(mathRows, 'mathEnjoyTutor', 'mathEnjoyTutorAnswered');
    const enjoyLit  = yesPct(litRows, 'litEnjoyTutor', 'litEnjoyTutorAnswered');
    const likedMath = yesPct(mathRows, 'mathLikedProgram', 'mathLikedProgramAnswered');
    const likedLit  = yesPct(litRows, 'litLikedProgram', 'litLikedProgramAnswered');
    const moreMath  = yesPct(mathRows, 'mathParticipateMore', 'mathParticipateMoreAnswered');
    const moreLit   = yesPct(litRows, 'litParticipateMore', 'litParticipateMoreAnswered');
    const helpMath  = yesPct(mathRows, 'mathHelpFriends', 'mathHelpFriendsAnswered');
    const learnMath = yesPct(mathRows, 'mathEnjoyLearning', 'mathEnjoyLearningAnswered');
    const learnLit  = yesPct(litRows, 'litEnjoyLearning', 'litEnjoyLearningAnswered');
    const delta = (mathNPSne.nps !== null && mathNPSsw.nps !== null) ? mathNPSsw.nps - mathNPSne.nps : null;

    const lines = [
      `📌 <strong>SURVEY SCOPE:</strong> ${rows.length} total scholar respondents across ${getSites().length} sites. ${pct(neRows.length, rows.length)} NE Region (n=${neRows.length}) &middot; ${pct(swRows.length, rows.length)} SW Region (n=${swRows.length}). Math participants: ${mathRows.length} (${pct(mathRows.length, rows.length)}) &middot; Literacy: ${litRows.length} (${pct(litRows.length, rows.length)}).`,
      `📊 <strong>CONFIDENCE NPS:</strong> Math Confidence NPS = ${fmtNPS(mathNPS.nps)} (${npsRating(mathNPS.nps).label}) &mdash; avg score ${mathNPS.avg !== null ? mathNPS.avg.toFixed(2) : '—'}/5 across ${mathNPS.total} scored responses. Literacy Confidence NPS = ${fmtNPS(litNPS.nps)} (${npsRating(litNPS.nps).label}) &mdash; avg ${litNPS.avg !== null ? litNPS.avg.toFixed(2) : '—'}/5 across ${litNPS.total} scored responses.`,
      `⭐ <strong>TUTOR RELATIONSHIPS:</strong> ${fmtPct1(enjoyMath.pct)} of math scholars and ${fmtPct1(enjoyLit.pct)} of literacy scholars report enjoying working with their tutor.`,
      `🎯 <strong>PROGRAM SATISFACTION:</strong> ${fmtPct1(likedMath.pct)} of math scholars and ${fmtPct1(likedLit.pct)} of literacy scholars liked participating in the program. Math "will participate more in class": ${fmtPct1(moreMath.pct)} &middot; Lit "will participate more in RW": ${fmtPct1(moreLit.pct)}.`,
      delta !== null ? `🗺️ <strong>REGIONAL MATH SPLIT:</strong> SW Region Math NPS = ${fmtNPS(mathNPSsw.nps)} (avg ${mathNPSsw.avg !== null ? mathNPSsw.avg.toFixed(2) : '—'}/5) vs. NE Region = ${fmtNPS(mathNPSne.nps)} (avg ${mathNPSne.avg !== null ? mathNPSne.avg.toFixed(2) : '—'}/5). ${delta > 0 ? `SW scholars are reporting higher math confidence — a ${Math.abs(delta)} point differential.` : delta < 0 ? `NE scholars are reporting higher math confidence — a ${Math.abs(delta)} point differential.` : 'Both regions report comparable math confidence.'}` : '',
      `📈 <strong>LEARNING DISPOSITION:</strong> ${fmtPct1(learnMath.pct)} of math scholars report enjoying learning more now than before tutoring. ${fmtPct1(helpMath.pct)} feel confident enough to help peers with math. Literacy "enjoy learning more": ${fmtPct1(learnLit.pct)}.`,
    ].filter(Boolean);

    return `<div style="display:flex;flex-direction:column;gap:.625rem">
      ${lines.map(l => `<div class="sf-note-callout" style="margin-top:0">${l}</div>`).join('')}
    </div>`;
  }

  // ── Hook into showPanel ──────────────────────────────────────────
  if (typeof window.showPanel === 'function') {
    const _orig = window.showPanel;
    window.showPanel = function (id, btn) {
      _orig(id, btn);
      if (id === 'scholar-feedback') onPanelOpen();
    };
  }

  window.schfGetSummary = function () {
    if (!_loaded) return null;
    const rows = _allData;
    return {
      total: rows.length,
      math: rows.filter(r => r.mathParticipated).length,
      lit: rows.filter(r => r.litParticipated).length,
    };
  };

})();
