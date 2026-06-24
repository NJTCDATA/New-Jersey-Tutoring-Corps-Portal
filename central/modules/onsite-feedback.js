/* ══════════════════════════════════════════════════════════════════════
   NJTC On-Site Staff Impact — Onsite Feedback Module
   osf-* namespace | Role-conditional satisfaction (Site Coordinator / Coach /
   Dual Role SC-IC / Tutor), Derived NPS by Region & Role, annual goal tracking.
   Diversity benchmark + non-responder list are computed by cross-referencing
   window.HR_EMPS (the live Talent Analytics roster already in this portal) —
   NOT fetched from a separate Google Sheet, per direction from Master W.
══════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  const CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTOGUuxRmOMR9PVMJNCc7rsLuueqY8Onc-79jm4pYT-J_7jkyzvCDzllxuLA8CAZ__x1_qBdKMtT9z-/pub?gid=1560652927&single=true&output=csv';

  // Goal targets (literal annual goal metrics, per the source workbook)
  const GOAL_GREW_PROF_PCT = 80;
  const GOAL_MADE_DIFF_PCT = 80;
  const DIVERSITY_BENCHMARK_PCT = 43; // % non-White benchmark

  // ── State ──────────────────────────────────────────────────────────
  let _allData = [];
  let _loading = false, _loaded = false;
  let _filters = { region: '', role: '' };
  let _csvMeta = { headers: [], totalRaw: 0 };

  // ── CSV Parser — RFC 4180 compliant (shared pattern) ──────────────────
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

  const _AGREE_SET = new Set(['Strongly agree', 'Agree', 'Strongly Agree']);
  function isAgree(v) { return _AGREE_SET.has((v || '').trim()); }
  function isAnswered(v) { const t = (v || '').trim(); return !!t && t.toLowerCase() !== 'n/a'; }

  // ── Role-conditional column lookup ──────────────────────────────────
  // Each role has its own satisfaction + agreement question block in the form.
  const ROLE_BLOCKS = {
    'Site Coordinator': {
      satisfaction: /satisfaction with your role as a Site Coordinator/i,
      managingExpected: /Managing site coordinator responsibilities has been what I expected/i,
      supportingRewarding: /Supporting the tutors has been rewarding\]$/i,
      siteStaffEasy: /Working with the site staff has been easy\]$/i,
      madeDifference: /I feel like I have made a difference\]$/i,
      commConsistent: /Communicating with my site team has been consistent\]$/i,
      grewProfessionally: /I feel like I have grown professionally\]$/i,
    },
    'Coach': {
      satisfaction: /satisfaction with your role as a Coach/i,
      managingExpected: /Managing Coaching responsibilities has been what I expected\]$/i,
      supportingRewarding: /Supporting the tutors has been rewarding\] 2$/i,
      siteStaffEasy: /Working with the site staff has been easy\] 2$/i,
      madeDifference: /I feel like I have made a difference\] 2$/i,
      commConsistent: /Communicating with my site team has been consistent\] 2$/i,
      grewProfessionally: /I feel like I have grown professionally\] 2$/i,
    },
    'SC/IC Dual Role': {
      satisfaction: /satisfaction with your role as a\s+Dual Role SC\/IC/i,
      managingExpected: /Managing Coaching responsibilities has been what I expected\] 2$/i,
      supportingRewarding: /Supporting the tutors has been rewarding\] 3$/i,
      siteStaffEasy: /Working with the site staff has been easy\] 3$/i,
      madeDifference: /I feel like I have made a difference\] 3$/i,
      commConsistent: /Communicating with my site team has been consistent\] 3$/i,
      grewProfessionally: /I feel like I have grown professionally\] 3$/i,
    },
    'Tutor': {
      satisfaction: /satisfaction with your role as a Tutor/i,
      managingExpected: /Managing tutoring responsibilities has been what I expected/i,
      supportingRewarding: /Supporting the scholars has been rewarding/i,
      siteStaffEasy: /Working with the site staff has been easy\] 4$/i,
      madeDifference: /I feel like I have made a difference\] 4$/i,
      commConsistent: /Communicating with my site team has been consistent\] 4$/i,
      grewProfessionally: /I feel like I have grown professionally\] 4$/i,
    },
  };

  function findKeyByRegex(raw, re) {
    for (const k of Object.keys(raw)) { if (re.test(k)) return k; }
    return null;
  }

  // ── Row normalization ────────────────────────────────────────────────
  function normalizeRow(raw) {
    const name = pickField(raw, ['Please write your name'], /write your name/i);
    const site = pickField(raw, ['Please identify the site(s) you have supported this year'], /site\(s\) you have supported/i);
    const role = pickField(raw, ['Select your role'], /^select your role$/i);
    const region = pickField(raw, ['Region Assigned: ', 'Region Assigned:', 'Region Assigned'], /region assigned/i);
    const wouldWorkAgain = pickField(raw, ['Would you be interested in working with us again? ', 'Would you be interested in working with us again?'], /interested in working with us again/i);
    const raceEthnicity = pickField(raw, [], /race\/ethnicity/i);
    const email = raw['Email Address'] || '';

    const block = ROLE_BLOCKS[role];
    let satisfaction = null, managingExpected = '', supportingRewarding = '',
        siteStaffEasy = '', madeDifference = '', commConsistent = '', grewProfessionally = '';

    if (block) {
      const satKey = findKeyByRegex(raw, block.satisfaction);
      satisfaction = satKey ? (parseInt(raw[satKey]) || null) : null;
      const meKey = findKeyByRegex(raw, block.managingExpected);
      managingExpected = meKey ? raw[meKey] : '';
      const srKey = findKeyByRegex(raw, block.supportingRewarding);
      supportingRewarding = srKey ? raw[srKey] : '';
      const sseKey = findKeyByRegex(raw, block.siteStaffEasy);
      siteStaffEasy = sseKey ? raw[sseKey] : '';
      const mdKey = findKeyByRegex(raw, block.madeDifference);
      madeDifference = mdKey ? raw[mdKey] : '';
      const ccKey = findKeyByRegex(raw, block.commConsistent);
      commConsistent = ccKey ? raw[ccKey] : '';
      const gpKey = findKeyByRegex(raw, block.grewProfessionally);
      grewProfessionally = gpKey ? raw[gpKey] : '';
    }

    return {
      timestamp: raw['Timestamp'] || '',
      email, name, site, role,
      region: (region || '').replace(/\s*Region\s*$/i, '').trim() || region,
      regionRaw: region,
      satisfaction,
      grewProfessionally, grewProfessionallyAgree: isAgree(grewProfessionally), grewProfessionallyAnswered: isAnswered(grewProfessionally),
      madeDifference, madeDifferenceAgree: isAgree(madeDifference), madeDifferenceAnswered: isAnswered(madeDifference),
      supportingRewarding, supportingRewardingAgree: isAgree(supportingRewarding), supportingRewardingAnswered: isAnswered(supportingRewarding),
      siteStaffEasy, siteStaffEasyAgree: isAgree(siteStaffEasy), siteStaffEasyAnswered: isAnswered(siteStaffEasy),
      commConsistent, commConsistentAgree: isAgree(commConsistent), commConsistentAnswered: isAnswered(commConsistent),
      managingExpected, managingExpectedAgree: isAgree(managingExpected), managingExpectedAnswered: isAnswered(managingExpected),
      wouldWorkAgain,
      raceEthnicity,
    };
  }

  // ── NPS calc — Promoters(4-5)/Passives(3)/Detractors(1-2) on 1-5 satisfaction ──
  function calcNPS(rows) {
    const valid = rows.filter(r => r.satisfaction >= 1 && r.satisfaction <= 5);
    const promoters  = valid.filter(r => r.satisfaction >= 4).length;
    const detractors = valid.filter(r => r.satisfaction <= 2).length;
    const passives   = valid.filter(r => r.satisfaction === 3).length;
    const total = valid.length;
    const avg = total ? valid.reduce((s, r) => s + r.satisfaction, 0) / total : null;
    const nps = total === 0 ? null : Math.round(((promoters - detractors) / total) * 100);
    return { promoters, detractors, passives, total, avg, nps };
  }
  function fmtNPS(nps) { return nps === null ? 'N/A' : (nps > 0 ? '+' : '') + nps; }
  function npsColor(nps) {
    if (nps === null) return '#7d8fa1';
    if (nps >= 70) return '#0d6e3a';
    if (nps >= 40) return '#c05c00';
    return '#b91c1c';
  }
  function pct1(n, total) { return total ? Math.round(n / total * 100) : null; }
  function fmtPct(p) { return p === null ? '—' : p + '%'; }

  // ── Name normalization for fuzzy person lookup (self-contained — mirrors
  //    the internal _nameMatch logic used elsewhere in the portal, since that
  //    helper is module-private and not exposed on window) ──────────────────
  function _osfNormName(s) {
    return (s || '').toLowerCase().replace(/[^a-z ]/g, '').replace(/\s+/g, ' ').trim();
  }
  function _osfNameMatch(a, b) {
    const na = _osfNormName(a), nb = _osfNormName(b);
    if (!na || !nb) return false;
    if (na === nb) return true;
    const pa = na.split(' '), pb = nb.split(' ');
    const lastA = pa[pa.length - 1], lastB = pb[pb.length - 1];
    if (lastA !== lastB) return false;
    return pa.some(t => t.length > 1 && pb.indexOf(t) >= 0);
  }

  // ── Filtering ──────────────────────────────────────────────────────
  function filteredData() {
    return _allData.filter(r =>
      (!_filters.region || r.region === _filters.region) &&
      (!_filters.role   || r.role === _filters.role));
  }
  function getRegions() { return [...new Set(_allData.map(r => r.region).filter(Boolean))].sort(); }
  function getRoles()   { return [...new Set(_allData.map(r => r.role).filter(Boolean))].sort(); }

  // ── Data load ──────────────────────────────────────────────────────
  function onPanelOpen() {
    if (_loading) return;
    if (!_loaded) { loadData(); return; }
    renderShell();
    renderBody();
  }

  async function loadData() {
    _loading = true;
    const el = document.getElementById('osfContainer');
    if (el) el.innerHTML = `
      <div class="sf-loading">
        <div class="sf-spinner"></div>
        Loading on-site staff feedback…
      </div>`;
    try {
      const resp = await fetch(CSV_URL, { signal: AbortSignal.timeout(20000) });
      if (!resp.ok) throw new Error('HTTP ' + resp.status);
      const text = await resp.text();
      const rawRows = parseCSV(text);
      _csvMeta = { headers: rawRows.length ? Object.keys(rawRows[0]) : [], totalRaw: rawRows.length };
      _allData = rawRows.map(normalizeRow).filter(r => r.role);
      _loaded = true;
      renderShell();
      renderBody();
    } catch (err) {
      const el2 = document.getElementById('osfContainer');
      if (el2) el2.innerHTML = `
        <div class="sf-error">
          <strong>Failed to load on-site staff feedback data.</strong><br>
          ${err.message}<br><br>
          <button class="btn btn-secondary" onclick="osfRetry()">↻ Retry</button>
        </div>`;
    } finally {
      _loading = false;
    }
  }
  window.osfRetry   = function () { _loaded = false; onPanelOpen(); };
  window.osfRefresh = function () { _loaded = false; loadData(); };

  // ── Shell ────────────────────────────────────────────────────────────
  function renderShell() {
    const el = document.getElementById('osfContainer');
    if (!el) return;
    el.innerHTML = `
      <div class="page-header">
        <div class="ph-text">
          <div class="ph-eyebrow">Survey Feedback</div>
          <div class="ph-title">Onsite Feedback</div>
          <div class="ph-subtitle">
            NJTC On-Site Staff Impact — tutors, site coordinators, and instructional coaches.
            <span style="color:var(--muted);font-size:.8em"> &middot; Derived NPS (1&ndash;5 Scale)</span>
          </div>
        </div>
        <div class="ph-actions">
          <button class="btn btn-secondary" onclick="osfRefresh()" title="Re-fetch data from Google Sheets">&#8635; Refresh</button>
        </div>
      </div>
      <div id="osfFilterBar"></div>
      <div id="osfBody"></div>`;
  }

  function filterBarHTML() {
    const regions = getRegions(), roles = getRoles();
    return `
      <div class="sf-filter-bar">
        <div class="sf-filter-group">
          <div class="sf-filter-label">Region</div>
          <div class="sf-chips">
            <button class="sf-chip${!_filters.region ? ' active' : ''}" onclick="osfSetRegion('')">All</button>
            ${regions.map(r => `<button class="sf-chip${_filters.region===r?' active':''}" onclick="osfSetRegion('${r.replace(/'/g,"\\'")}')">${r}</button>`).join('')}
          </div>
        </div>
        <div class="sf-filter-group">
          <div class="sf-filter-label">Role</div>
          <select class="filter-select" onchange="osfSetRole(this.value)">
            <option value="">All Roles</option>
            ${roles.map(r => `<option value="${r.replace(/"/g,'&quot;')}"${_filters.role===r?' selected':''}>${r}</option>`).join('')}
          </select>
        </div>
        <button class="btn btn-secondary sf-clear-btn" onclick="osfClearFilters()">Clear</button>
      </div>`;
  }
  window.osfSetRegion = function (r) { _filters.region = r; renderBody(); };
  window.osfSetRole   = function (r) { _filters.role = r; renderBody(); };
  window.osfClearFilters = function () { _filters = { region: '', role: '' }; renderBody(); };

  // ── Body ──────────────────────────────────────────────────────────
  function renderBody() {
    const fbEl = document.getElementById('osfFilterBar');
    if (fbEl) fbEl.innerHTML = filterBarHTML();
    const el = document.getElementById('osfBody');
    if (!el) return;

    const rows = filteredData();
    if (!rows.length) {
      el.innerHTML = '<div class="sf-empty">No on-site staff survey responses match the current filters.</div>';
      return;
    }

    const grewProf = rows.filter(r => r.grewProfessionallyAnswered);
    const grewProfYes = grewProf.filter(r => r.grewProfessionallyAgree).length;
    const madeDiff = rows.filter(r => r.madeDifferenceAnswered);
    const madeDiffYes = madeDiff.filter(r => r.madeDifferenceAgree).length;

    const goalGrewPct = pct1(grewProfYes, grewProf.length);
    const goalDiffPct = pct1(madeDiffYes, madeDiff.length);

    el.innerHTML = `
      <!-- A: Annual Goals -->
      <div class="sf-section">
        <div class="sf-section-hdr">
          <div class="sf-section-title">A &mdash; Annual Goals &mdash; Influence Practice: Support Professional Growth</div>
          <div class="sf-method">Literal annual goal metrics, filtered scope (n=${rows.length} respondents).</div>
        </div>
        <div class="ta-grid ta-grid-2">
          ${goalCardHTML('% who Agree/Strongly Agree NJTC helped them grow professionally', goalGrewPct, grewProf.length, GOAL_GREW_PROF_PCT)}
          ${goalCardHTML("% reporting they made a difference in scholars' lives", goalDiffPct, madeDiff.length, GOAL_MADE_DIFF_PCT)}
        </div>
      </div>

      <!-- B: By Region -->
      <div class="sf-section">
        <div class="sf-section-hdr">
          <div class="sf-section-title">B &mdash; By Region</div>
          <div class="sf-method">Derived NPS from role satisfaction (1&ndash;5). Promoters = 4 or 5 | Passives = 3 | Detractors = 1 or 2.</div>
        </div>
        <div id="osfRegionTable" style="overflow-x:auto"></div>
      </div>

      <!-- C: By Role -->
      <div class="sf-section">
        <div class="sf-section-hdr">
          <div class="sf-section-title">C &mdash; By Role</div>
        </div>
        <div id="osfRoleTable" style="overflow-x:auto"></div>
      </div>

      <!-- D: Diversity Benchmark -->
      <div class="sf-section">
        <div class="sf-section-hdr">
          <div class="sf-section-title">D &mdash; Diversity &mdash; Benchmark: ${DIVERSITY_BENCHMARK_PCT}% non-White</div>
          <div class="sf-method">Two distinct populations — HR Roster (all active staff) vs. survey self-report (respondents only). Not averaged together.</div>
        </div>
        <div id="osfDiversityTable" style="overflow-x:auto"></div>
      </div>

      <!-- E: Non-Responders -->
      <div class="sf-section">
        <div class="sf-section-hdr">
          <div class="sf-section-title">E &mdash; Active Staff Who Haven't Responded</div>
          <div class="sf-method">Cross-referenced against the live Talent Analytics roster.</div>
        </div>
        <div id="osfNonResponders"></div>
      </div>

      <!-- F: Would Work Again -->
      <div class="sf-section">
        <div class="sf-section-hdr">
          <div class="sf-section-title">F &mdash; Would Work With NJTC Again</div>
        </div>
        <div id="osfWorkAgain"></div>
      </div>`;

    renderRegionTable('osfRegionTable', rows);
    renderRoleTable('osfRoleTable', rows);
    renderDiversityTable('osfDiversityTable', rows);
    renderNonResponders('osfNonResponders', rows);
    renderWorkAgain('osfWorkAgain', rows);
  }

  function goalCardHTML(label, pctVal, n, target) {
    const met = pctVal !== null && pctVal >= target;
    const color = pctVal === null ? '#7d8fa1' : met ? '#0d6e3a' : '#c05c00';
    return `<div class="ta-card" style="text-align:center">
      <div class="ta-card-title">${label}</div>
      <div style="font-size:2.25rem;font-weight:800;color:${color};line-height:1">${fmtPct(pctVal)}</div>
      <div style="font-size:.75rem;color:var(--muted);margin-top:.3rem">n = ${n} answered &middot; Goal: ${target}%${met ? ' &mdash; ✅ Met' : ''}</div>
    </div>`;
  }

  function renderRegionTable(containerId, rows) {
    const el = document.getElementById(containerId);
    if (!el) return;
    const byRegion = {};
    rows.forEach(r => { if (!byRegion[r.region]) byRegion[r.region] = []; byRegion[r.region].push(r); });
    const regionRows = Object.entries(byRegion).map(([region, rs]) => buildRowStats(region, rs))
      .sort((a, b) => b.n - a.n);
    el.innerHTML = statsTableHTML('Region', regionRows);
  }
  function renderRoleTable(containerId, rows) {
    const el = document.getElementById(containerId);
    if (!el) return;
    const byRole = {};
    rows.forEach(r => { if (!byRole[r.role]) byRole[r.role] = []; byRole[r.role].push(r); });
    const roleRows = Object.entries(byRole).map(([role, rs]) => buildRowStats(role, rs))
      .sort((a, b) => b.n - a.n);
    el.innerHTML = statsTableHTML('Role', roleRows);
  }
  function buildRowStats(label, rs) {
    const nps = calcNPS(rs);
    const grew = rs.filter(r => r.grewProfessionallyAnswered);
    const grewYes = grew.filter(r => r.grewProfessionallyAgree).length;
    const diff = rs.filter(r => r.madeDifferenceAnswered);
    const diffYes = diff.filter(r => r.madeDifferenceAgree).length;
    const work = rs.filter(r => r.wouldWorkAgain);
    const workYes = work.filter(r => r.wouldWorkAgain.trim().toLowerCase() === 'yes').length;
    return {
      label, n: rs.length, avg: nps.avg, nps: nps.nps,
      grewPct: pct1(grewYes, grew.length), diffPct: pct1(diffYes, diff.length), workPct: pct1(workYes, work.length),
    };
  }
  function statsTableHTML(labelHdr, rows) {
    return `<table class="sf-table">
      <thead><tr><th>${labelHdr}</th><th>n</th><th>Avg Satisfaction</th><th>Derived NPS</th><th>% Grew Professionally</th><th>% Made a Difference</th><th>% Would Work Again</th></tr></thead>
      <tbody>
        ${rows.map(r => `<tr>
          <td><strong>${r.label}</strong></td>
          <td style="font-weight:700">${r.n}</td>
          <td>${r.avg !== null ? r.avg.toFixed(2) : '—'}</td>
          <td style="font-weight:700;color:${npsColor(r.nps)}">${fmtNPS(r.nps)}</td>
          <td>${fmtPct(r.grewPct)}</td>
          <td>${fmtPct(r.diffPct)}</td>
          <td>${fmtPct(r.workPct)}</td>
        </tr>`).join('')}
      </tbody>
    </table>`;
  }

  // ── Diversity — cross-referenced against window.HR_EMPS (live roster) ──
  function renderDiversityTable(containerId, rowsAllFiltered) {
    const el = document.getElementById(containerId);
    if (!el) return;
    const hr = window.HR_EMPS || [];
    if (!hr.length) {
      el.innerHTML = `<div class="sf-empty">Talent Analytics roster (window.HR_EMPS) is not loaded in this session — open the Talent Analytics panel once, then revisit this section.</div>`;
      return;
    }
    const active = hr.filter(e => e.s === 'Active');
    const activeWithRace = active.filter(e => e._race || e._ethnicity);
    const nonWhiteHR = active.filter(e => isNonWhite(e)).length;
    const hrCoveragePct = pct1(activeWithRace.length, active.length);
    const hrNonWhitePct = pct1(nonWhiteHR, active.length);

    // Self-report from the survey (all respondents, unfiltered by region/role chips —
    // diversity should reflect the full respondent pool, not the active filter view)
    const allRespondents = _allData;
    const withSelfReport = allRespondents.filter(r => r.raceEthnicity);
    const nonWhiteSelf = withSelfReport.filter(r => isNonWhiteSelfReport(r.raceEthnicity)).length;
    const selfCoveragePct = pct1(withSelfReport.length, allRespondents.length);
    const selfNonWhitePct = pct1(nonWhiteSelf, withSelfReport.length);

    el.innerHTML = `<table class="sf-table">
      <thead><tr><th>Source</th><th>Coverage</th><th>% Non-White</th><th>vs. Benchmark (${DIVERSITY_BENCHMARK_PCT}%)</th><th>Note</th></tr></thead>
      <tbody>
        <tr>
          <td><strong>HR Roster (authoritative)</strong></td>
          <td>${activeWithRace.length} / ${active.length} active (${fmtPct(hrCoveragePct)})</td>
          <td style="font-weight:700">${fmtPct(hrNonWhitePct)}</td>
          <td>${vsBenchmark(hrNonWhitePct)}</td>
          <td class="sf-cell-sm">Race + Ethnicity fields; Hispanic/Latino counted non-White</td>
        </tr>
        <tr>
          <td><strong>Form self-report (secondary)</strong></td>
          <td>${withSelfReport.length} / ${allRespondents.length} respondents (${fmtPct(selfCoveragePct)})</td>
          <td style="font-weight:700">${fmtPct(selfNonWhitePct)}</td>
          <td>${vsBenchmark(selfNonWhitePct)}</td>
          <td class="sf-cell-sm">${allRespondents.length - withSelfReport.length} declined to answer</td>
        </tr>
      </tbody>
    </table>
    <div class="sf-note-callout">Two different populations (all active staff vs. survey respondents) &mdash; not averaged together.</div>`;
  }
  function isNonWhite(e) {
    if (e._ethnicity === 'Hispanic or Latino') return true;
    if (e._race && e._race !== 'White') return true;
    return false;
  }
  function isNonWhiteSelfReport(raceEthnicity) {
    const t = (raceEthnicity || '').toLowerCase();
    if (!t) return false;
    if (t.includes('hispanic') || t.includes('latino')) return true;
    if (t.includes('white') && !t.includes('non')) {
      // "White" alone (not combined with another race) = White
      return /,|black|asian|native|pacific|two or more/.test(t);
    }
    return !t.includes('white') || /,|black|asian|native|pacific|two or more/.test(t);
  }
  function vsBenchmark(p) {
    if (p === null) return '—';
    const d = p - DIVERSITY_BENCHMARK_PCT;
    const color = d >= 0 ? '#0d6e3a' : '#b91c1c';
    return `<span style="color:${color};font-weight:700">${d >= 0 ? '+' : ''}${d}pts</span>`;
  }

  // ── Non-responders — cross-referenced against window.HR_EMPS ──────────
  function renderNonResponders(containerId, rowsAllFiltered) {
    const el = document.getElementById(containerId);
    if (!el) return;
    const hr = window.HR_EMPS || [];
    if (!hr.length) {
      el.innerHTML = `<div class="sf-empty">Talent Analytics roster (window.HR_EMPS) is not loaded in this session — open the Talent Analytics panel once, then revisit this section.</div>`;
      return;
    }
    const active = hr.filter(e => e.s === 'Active');
    const respondentNames = _allData.map(r => r.name).filter(Boolean);

    const nonResponders = active.filter(e => {
      if (!e.n) return false;
      return !respondentNames.some(rn => _osfNameMatch(e.n, rn));
    });

    const total = active.length;
    const responded = total - nonResponders.length;
    const responseRate = pct1(responded, total);

    el.innerHTML = `
      <div class="ta-grid ta-grid-3" style="margin-bottom:1rem">
        <div class="ta-card ta-kpi ok"><div class="ta-kpi-val">${responded}</div><div class="ta-kpi-sub">Responded</div></div>
        <div class="ta-card ta-kpi warning"><div class="ta-kpi-val">${nonResponders.length}</div><div class="ta-kpi-sub">Active Staff — No Response</div></div>
        <div class="ta-card ta-kpi"><div class="ta-kpi-val">${fmtPct(responseRate)}</div><div class="ta-kpi-sub">Response Rate (${responded} of ${total} active)</div></div>
      </div>
      ${nonResponders.length ? `<table class="sf-table">
        <thead><tr><th>Name</th><th>HR Role</th><th>Pearl Location</th></tr></thead>
        <tbody>
          ${nonResponders.map(e => `<tr>
            <td><strong>${e.n}</strong></td>
            <td>${e.r || '—'}</td>
            <td class="sf-cell-sm">${e.di || e.si || '—'}</td>
          </tr>`).join('')}
        </tbody>
      </table>` : '<div class="sf-empty">All active staff have responded.</div>'}`;
  }

  function renderWorkAgain(containerId, rows) {
    const el = document.getElementById(containerId);
    if (!el) return;
    const answered = rows.filter(r => r.wouldWorkAgain);
    const counts = {};
    answered.forEach(r => { const v = r.wouldWorkAgain.trim(); counts[v] = (counts[v]||0)+1; });
    const entries = Object.entries(counts).sort((a,b) => b[1]-a[1]);
    el.innerHTML = `<div class="sf-charts-row">
      ${entries.map(([label, n]) => `
        <div class="sf-chart-card" style="flex:1;min-width:160px;text-align:center">
          <div class="sf-chart-title">${label}</div>
          <div style="font-size:1.75rem;font-weight:800;color:var(--navy)">${n}</div>
          <div class="sf-nps-n">${fmtPct(pct1(n, answered.length))} of respondents</div>
        </div>`).join('')}
    </div>`;
  }

  // ── Hook into showPanel ──────────────────────────────────────────
  if (typeof window.showPanel === 'function') {
    const _orig = window.showPanel;
    window.showPanel = function (id, btn) {
      _orig(id, btn);
      if (id === 'onsite-feedback') onPanelOpen();
    };
  }

})();
