(function () {
  'use strict';

  /* ─────────────────────────────────────────────
     CONSTANTS
  ───────────────────────────────────────────── */
  const PEARL_KEY  = '2PACX-1vQ1iC8NZFJt3iinGUEqftKtP32N43axi_JN_RQI36EBUdhZS0PaZRwd-1AJT3bEVe6cqHA0tCA3vb5K';
  const PEARL_ATT_GID  = '702726038';
  const PEARL_STU_GID  = '1245403832';
  const IREADY_KEY = '2PACX-1vREgf9glXO2QMKeZ8YHF-0XBtqoOyhNz3CnBpaeCY0mAC1lknvQ13JuXJpzHCZeGls4XEPkxyNO5ZBG';
  const IREADY_ELA_GID  = '0';
  const IREADY_MATH_GID = '127145553';
  // TAP Master Roster — requires the workbook to be shared "Anyone with link can view"
  // in Google Drive. Set sharing, then the gviz URL works without auth.
  const TAP_URL    = 'https://docs.google.com/spreadsheets/d/14UiE5ple1NYVQl5s9U085pFp50vKjnnwNQmsGS0AKJU/gviz/tq?tqx=out:csv&gid=45498361';
  const HR_KEY     = '2PACX-1vRc-Air9jhOtvkVelwfvOguzAyFmGIFpQ0sDtu4q8S5kFAgQz_IZo-XBeIfQgy4GB8OdSXoyonTeLT8';
  const HR_GID     = '911694457';
  const CONCERNS_SHEET_ID = '1IZSYmLgMddPtn5Ei9mehqTWJAbpcm5Tx1GL-YytLj0k';
  const CONCERNS_GID      = '274671201';
  const OJT_FORM_ID = '1MOsppwhQmagAhVSHs29Ms4o9Ky4xYOyqy8Qs4uTrwbQ';

  const LEADER_ROLES = new Set([
    'Instructional Coach', 'Certified - Instructional Coach', 'Site Coordinator',
    'Certified - Site Coordinator', 'Site Coordinator / Tutor', 'Dual Role',
    'Instructional Coach/ Site Coordinator Dual', 'Master Trainer', 'Central Team'
  ]);

  const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
  const CACHE_KEYS = {
    att:      'njtc_team_att_v1',
    stu:      'njtc_team_stu_v1',
    irEla:    'njtc_team_ir_ela_v1',
    irMath:   'njtc_team_ir_math_v1',
    tap:      'njtc_team_tap_v1',
    concerns: 'njtc_team_concerns_v1'
  };

  let _stylesInjected = false;
  let _leaderProfile  = null;
  let _leaderDistricts = [];
  let _teamData = {};

  /* ─────────────────────────────────────────────
     UTILS
  ───────────────────────────────────────────── */
  function escHtml(str) {
    if (str == null) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function normName(str) {
    if (!str) return '';
    return String(str)
      .toLowerCase()
      .replace(/\(.*?\)/g, '')
      .replace(/-/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function normDist(str) {
    if (!str) return '';
    return String(str).toLowerCase().trim();
  }

  function distMatch(a, b) {
    const na = normDist(a), nb = normDist(b);
    if (!na || !nb) return false;
    return na.includes(nb) || nb.includes(na);
  }

  function safe(val, fallback) {
    if (val == null || val === '' || String(val).toLowerCase() === 'null' || String(val).toLowerCase() === 'undefined') {
      return fallback !== undefined ? fallback : '—';
    }
    return val;
  }

  function pct(num, den) {
    if (!den || isNaN(den) || den === 0) return null;
    return Math.round((num / den) * 100);
  }

  function avatarColor(id) {
    const colors = ['#1B3A6B','#1C7C8C','#4f46e5','#7c3aed','#db2777','#0891b2','#059669','#d97706'];
    let hash = 0;
    for (let i = 0; i < String(id || '').length; i++) hash = (hash * 31 + String(id)[i].charCodeAt(0)) & 0xffffffff;
    return colors[Math.abs(hash) % colors.length];
  }

  function initials(name) {
    if (!name) return '?';
    const parts = String(name).trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    return (parts[0][0] || '?').toUpperCase();
  }

  function attColor(p) {
    if (p == null) return '#6b7280';
    if (p >= 95) return '#10b981';
    if (p >= 90) return '#34d399';
    if (p >= 80) return '#f59e0b';
    return '#ef4444';
  }

  function surveyColor(score) {
    if (score == null) return '#6b7280';
    if (score >= 4.5) return '#10b981';
    if (score >= 4.0) return '#1C7C8C';
    if (score >= 3.5) return '#f59e0b';
    return '#ef4444';
  }

  /* ─────────────────────────────────────────────
     CSV PARSER
  ───────────────────────────────────────────── */
  function parseCSV(text) {
    const rows = [];
    let row = [], field = '', inQuote = false;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i], next = text[i + 1];
      if (inQuote) {
        if (ch === '"' && next === '"') { field += '"'; i++; }
        else if (ch === '"') { inQuote = false; }
        else { field += ch; }
      } else {
        if (ch === '"') { inQuote = true; }
        else if (ch === ',') { row.push(field); field = ''; }
        else if (ch === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
        else if (ch === '\r') { /* skip */ }
        else { field += ch; }
      }
    }
    if (field || row.length) { row.push(field); rows.push(row); }
    return rows;
  }

  function csvToObjects(text) {
    const rows = parseCSV(text);
    if (rows.length < 2) return [];
    const headers = rows[0].map(h => h.trim());
    return rows.slice(1).map(row => {
      const obj = {};
      headers.forEach((h, i) => { obj[h] = (row[i] || '').trim(); });
      return obj;
    });
  }

  /* ─────────────────────────────────────────────
     SESSION CACHE
  ───────────────────────────────────────────── */
  function cacheGet(key) {
    try {
      const raw = sessionStorage.getItem(key);
      if (!raw) return null;
      const { ts, data } = JSON.parse(raw);
      if (Date.now() - ts > CACHE_TTL) { sessionStorage.removeItem(key); return null; }
      return data;
    } catch (e) { return null; }
  }

  function cacheSet(key, data) {
    try { sessionStorage.setItem(key, JSON.stringify({ ts: Date.now(), data })); } catch (e) {}
  }

  /* ─────────────────────────────────────────────
     FETCH HELPERS
  ───────────────────────────────────────────── */
  async function fetchCSV(url, cacheKey) {
    if (cacheKey) {
      const cached = cacheGet(cacheKey);
      if (cached) return cached;
    }
    const res = await fetch(url);
    if (!res.ok) throw new Error('HTTP ' + res.status + ' fetching ' + url);
    const text = await res.text();
    const data = csvToObjects(text);
    if (cacheKey) cacheSet(cacheKey, data);
    return data;
  }

  function pearlUrl(gid) {
    return `https://docs.google.com/spreadsheets/d/e/${PEARL_KEY}/pub?output=csv&gid=${gid}`;
  }
  function ireadyUrl(gid) {
    return `https://docs.google.com/spreadsheets/d/e/${IREADY_KEY}/pub?output=csv&gid=${gid}`;
  }
  function hrUrl() {
    return `https://docs.google.com/spreadsheets/d/e/${HR_KEY}/pub?output=csv&gid=${HR_GID}`;
  }
  function concernsUrl() {
    return `https://docs.google.com/spreadsheets/d/${CONCERNS_SHEET_ID}/gviz/tq?tqx=out:csv&gid=${CONCERNS_GID}`;
  }

  /* ─────────────────────────────────────────────
     LEADER DETECTION (from HR Master List)
  ───────────────────────────────────────────── */
  async function detectLeader(userProfile) {
    let hrRows;
    try {
      hrRows = await fetchCSV(hrUrl(), null);
    } catch (e) {
      console.warn('[NJTCTeam] Could not fetch HR list:', e);
      return null;
    }
    const active = hrRows.filter(r =>
      r['Academic Year'] === '2025-2026' &&
      r['Active / Terminated Status'] === 'Active'
    );
    const matchRow = active.find(r =>
      normName(r['Full Name']) === normName(userProfile.name) ||
      (r['Email Address'] && r['Email Address'].toLowerCase() === (userProfile.email || '').toLowerCase())
    );
    if (!matchRow) return null;
    const role = (matchRow['Position / Role'] || '').trim();
    if (!LEADER_ROLES.has(role)) return null;
    const siteField = matchRow['Site / School'] || '';
    const districts = siteField.split(',').map(s => s.trim()).filter(Boolean);
    return { role, districts, siteField };
  }

  /* ─────────────────────────────────────────────
     DATA LOADING
  ───────────────────────────────────────────── */
  async function loadAllData(leaderDistricts, leaderName) {
    const [attRows, stuRows, irElaRows, irMathRows, tapRows, concernRows] = await Promise.allSettled([
      fetchCSV(pearlUrl(PEARL_ATT_GID), CACHE_KEYS.att),
      fetchCSV(pearlUrl(PEARL_STU_GID), CACHE_KEYS.stu),
      fetchCSV(ireadyUrl(IREADY_ELA_GID), CACHE_KEYS.irEla),
      fetchCSV(ireadyUrl(IREADY_MATH_GID), CACHE_KEYS.irMath),
      fetchCSV(TAP_URL, CACHE_KEYS.tap),
      fetchCSV(concernsUrl(), CACHE_KEYS.concerns)
    ]);

    function val(result) { return result.status === 'fulfilled' ? result.value : []; }

    const att      = val(attRows);
    const stu      = val(stuRows);
    const irEla    = val(irElaRows);
    const irMath   = val(irMathRows);
    const tap      = val(tapRows);
    const concerns = val(concernRows);

    // ── Step 1: find this leader's exact Pearl school assignments ─────────────
    // Pearl ATT stores non-Instructor rows for Site Coordinators / ICs / Dual Roles.
    // A Dual Role leader appears on rows for BOTH the MS and ES of their campus.
    const leaderNorm = normName(leaderName || '');
    const pearlLeaderSchools = new Set();
    att.forEach(r => {
      const role = (r['Role'] || '').trim();
      if (role === 'Instructor') return;
      const u = normName(r['User'] || '');
      if (!u || u !== leaderNorm) return;
      const school = (r['School'] || r['Site'] || '').trim();
      if (school) pearlLeaderSchools.add(school);
    });

    // ── Step 2: expand to campus siblings (same base name, different grade suffix) ──
    // e.g. "iLearn Paterson MS" leader also covers "iLearn Paterson ES"
    function campusBase(s) {
      return s.toLowerCase()
        .replace(/\s*[-–]\s*(ms|es|hs|middle|elementary|high|k-\d+)\s*$/i, '')
        .replace(/\s+(ms|es|hs|middle\s+school|elementary\s+school|high\s+school)\s*$/i, '')
        .trim();
    }
    const leaderBases = new Set([...pearlLeaderSchools].map(campusBase));
    const allPearlSchools = new Set(att.map(r => (r['School'] || r['Site'] || '').trim()).filter(Boolean));
    const expandedSchools = new Set(pearlLeaderSchools);
    if (leaderBases.size > 0) {
      allPearlSchools.forEach(school => {
        if (leaderBases.has(campusBase(school))) expandedSchools.add(school);
      });
    }

    // ── Step 3: build site-match predicate ────────────────────────────────────
    // Primary: exact Pearl school set (captures Dual Role MS+ES+HS automatically)
    // Fallback: HR site field substring matching (when leader not yet in Pearl data)
    function siteMatch(r) {
      const school = (r['School'] || r['Site'] || '').trim();
      const dist   = (r['District'] || r['district'] || '').trim();
      if (expandedSchools.size > 0) return expandedSchools.has(school);
      return leaderDistricts.some(ld => distMatch(dist, ld) || distMatch(school, ld));
    }

    // ATT: only Instructor rows for tutor cards; STU/iReady: no role filter
    const filteredAtt  = att.filter(r  => (r['Role'] || '').trim() === 'Instructor' && siteMatch(r));
    const filteredStu  = stu.filter(r  => siteMatch(r));
    const filteredEla  = irEla.filter(r  => siteMatch(r));
    const filteredMath = irMath.filter(r => siteMatch(r));
    const filteredTap  = tap.filter(r  => {
      const site = r['Site'] || r['C'] || '';
      return leaderDistricts.some(ld => distMatch(site, ld));
    });

    console.log('[NJTCTeam] Leader Pearl schools:', [...expandedSchools]);
    console.log('[NJTCTeam] Filtered ATT rows:', filteredAtt.length, '| STU:', filteredStu.length);

    return { att: filteredAtt, stu: filteredStu, irEla: filteredEla, irMath: filteredMath, tap: filteredTap, concerns };
  }

  /* ─────────────────────────────────────────────
     DATA AGGREGATION
  ───────────────────────────────────────────── */
  function buildTutorMap(attRows) {
    // Pearl ATT uses "User" for the person's name; only Instructor rows reach here
    const map = {};
    attRows.forEach(r => {
      const tutorName = (r['User'] || r['Tutor Name'] || r['Staff Name'] || '').trim();
      if (!tutorName) return;
      const key = normName(tutorName);
      if (!map[key]) {
        map[key] = {
          name: tutorName,
          district: r['District'] || '',
          school: r['School'] || r['Site'] || '',
          role: 'Instructor',
          id: key,
          attRows: []
        };
      }
      map[key].attRows.push(r);
    });
    return map;
  }

  function computeAttMetrics(attRows) {
    let attended = 0, absent = 0, si = 0, total = 0;
    const absenceReasons = {};
    attRows.forEach(r => {
      const status = (r['Attendance Status'] || r['Status'] || '').trim();
      const reason = (r['Absence Reason'] || r['Reason'] || '').trim();
      total++;
      if (/present|attended/i.test(status)) attended++;
      else if (/absent/i.test(status)) {
        absent++;
        if (reason) absenceReasons[reason] = (absenceReasons[reason] || 0) + 1;
      }
      if (/service interruption|SI/i.test(status)) si++;
    });
    return { attended, absent, si, total, absenceReasons, rate: pct(attended, total) };
  }

  function computeStuMetrics(stuRows) {
    const scholarMap = {};
    stuRows.forEach(r => {
      const name = r['Scholar Name'] || r['Student Name'] || '';
      const grade = r['Grade'] || '';
      const status = r['Attendance Status'] || r['Status'] || '';
      const key = normName(name);
      if (!key) return;
      if (!scholarMap[key]) scholarMap[key] = { name, grade, attended: 0, absent: 0, si: 0, total: 0 };
      scholarMap[key].total++;
      if (/present|attended/i.test(status)) scholarMap[key].attended++;
      else if (/absent/i.test(status)) scholarMap[key].absent++;
      if (/service interruption|SI/i.test(status)) scholarMap[key].si++;
    });
    const scholars = Object.values(scholarMap);
    scholars.forEach(s => { s.rate = pct(s.attended, s.total); });
    const uniqueCount = scholars.length;
    // survey data
    const surveyFields = {
      confidence: r => parseFloat(r['Confidence'] || r['Survey Confidence'] || 0),
      enjoyment:  r => parseFloat(r['Enjoyment']  || r['Survey Enjoyment']  || 0),
      learning:   r => parseFloat(r['Learning']   || r['Survey Learning']   || 0),
      overall:    r => parseFloat(r['Overall']    || r['Survey Overall']    || 0)
    };
    const surveyRows = stuRows.filter(r =>
      r['Confidence'] || r['Enjoyment'] || r['Learning'] || r['Overall'] ||
      r['Survey Confidence'] || r['Survey Enjoyment'] || r['Survey Learning'] || r['Survey Overall']
    );
    let surveyScores = { confidence: 0, enjoyment: 0, learning: 0, overall: 0, count: 0 };
    if (surveyRows.length) {
      surveyRows.forEach(r => {
        surveyScores.confidence += surveyFields.confidence(r);
        surveyScores.enjoyment  += surveyFields.enjoyment(r);
        surveyScores.learning   += surveyFields.learning(r);
        surveyScores.overall    += surveyFields.overall(r);
      });
      surveyScores.count = surveyRows.length;
      ['confidence','enjoyment','learning','overall'].forEach(k => {
        surveyScores[k] = Math.round((surveyScores[k] / surveyRows.length) * 10) / 10;
      });
    }
    return { scholars, uniqueCount, surveyScores };
  }

  function computeIReadyMetrics(irRows) {
    const improved = irRows.filter(r => {
      const mv = (r['Movement'] || r['Placement Level Change'] || '').toLowerCase();
      return mv.includes('improv') || mv === '▲' || mv === 'up';
    }).length;
    const maintained = irRows.filter(r => {
      const mv = (r['Movement'] || r['Placement Level Change'] || '').toLowerCase();
      return mv.includes('maintain') || mv === '=' || mv === 'same';
    }).length;
    const declined = irRows.filter(r => {
      const mv = (r['Movement'] || r['Placement Level Change'] || '').toLowerCase();
      return mv.includes('declin') || mv === '▼' || mv === 'down';
    }).length;
    const total = irRows.length || 1;
    const growthVals = irRows.map(r => parseFloat(r['% Typical Growth'] || r['Typical Growth'] || 0)).filter(v => !isNaN(v));
    const medGrowth = growthVals.length ? growthVals.sort((a,b)=>a-b)[Math.floor(growthVals.length/2)] : null;
    const gainVals = irRows.map(r => parseFloat(r['Scale Score Gain'] || r['SS Gain'] || 0)).filter(v => !isNaN(v));
    const avgGain = gainVals.length ? Math.round(gainVals.reduce((a,b)=>a+b,0)/gainVals.length) : null;
    return {
      total: irRows.length,
      pctImproved:   pct(improved, total),
      pctMaintained: pct(maintained, total),
      pctDeclined:   pct(declined, total),
      medGrowth, avgGain,
      scholars: irRows
    };
  }

  function getTapForTutor(tapRows, tutorName) {
    return tapRows.find(r => normName(r['Full Name'] || r['A'] || '') === normName(tutorName)) || null;
  }

  function getConcernsForTutor(concernRows, tutorName) {
    const nn = normName(tutorName);
    return concernRows.filter(r => {
      const cn = normName(r['Tutor Name'] || r['Staff Name'] || r['Name'] || '');
      return cn === nn;
    });
  }

  /* ─────────────────────────────────────────────
     STYLES
  ───────────────────────────────────────────── */
  function injectTeamStyles() {
    if (_stylesInjected) return;
    _stylesInjected = true;
    const css = `
      #njtcTeamContainer { font-family: 'Epilogue', sans-serif; color: #e2e8f0; min-height: 60vh; }
      .njtc-team-loading { display:flex; align-items:center; justify-content:center; height:200px; gap:12px; color:#94a3b8; font-size:1rem; }
      .njtc-spinner { width:28px; height:28px; border:3px solid rgba(255,255,255,0.1); border-top-color:#1C7C8C; border-radius:50%; animation:njtcSpin 0.7s linear infinite; }
      @keyframes njtcSpin { to { transform:rotate(360deg); } }

      /* KPI Strip */
      .njtc-kpi-strip { display:flex; flex-wrap:wrap; gap:12px; margin-bottom:28px; }
      .njtc-kpi-card { flex:1 1 130px; min-width:130px; background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.08); border-radius:12px; padding:16px 14px; }
      .njtc-kpi-label { font-size:0.72rem; color:#94a3b8; text-transform:uppercase; letter-spacing:0.05em; margin-bottom:6px; }
      .njtc-kpi-value { font-size:1.6rem; font-weight:700; line-height:1; }
      .njtc-kpi-sub { font-size:0.72rem; color:#94a3b8; margin-top:4px; }

      /* Section headers */
      .njtc-section-title { font-size:1rem; font-weight:700; color:#FFB81C; text-transform:uppercase; letter-spacing:0.06em; margin:24px 0 14px; border-left:3px solid #FFB81C; padding-left:10px; }

      /* Tutor Grid */
      .njtc-tutor-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(280px,1fr)); gap:16px; }
      .njtc-tutor-card { background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.08); border-radius:14px; padding:18px 16px; cursor:pointer; transition:transform 0.15s,border-color 0.15s,box-shadow 0.15s; }
      .njtc-tutor-card:hover { transform:translateY(-3px); border-color:rgba(28,124,140,0.5); box-shadow:0 8px 24px rgba(0,0,0,0.3); }
      .njtc-tutor-card.flagged { border-color:rgba(239,68,68,0.4); }
      .njtc-tutor-card.flagged-warn { border-color:rgba(245,158,11,0.4); }

      .njtc-card-header { display:flex; align-items:center; gap:12px; margin-bottom:14px; }
      .njtc-avatar { width:44px; height:44px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:0.95rem; font-weight:700; color:#fff; flex-shrink:0; }
      .njtc-card-name { font-size:0.95rem; font-weight:600; }
      .njtc-card-role { font-size:0.75rem; color:#94a3b8; margin-top:2px; }

      .njtc-badge { display:inline-block; font-size:0.65rem; font-weight:700; border-radius:20px; padding:2px 8px; margin-left:6px; vertical-align:middle; }
      .njtc-badge-active { background:#FFB81C22; color:#FFB81C; border:1px solid #FFB81C55; }
      .njtc-badge-prior { background:#1B3A6B33; color:#93c5fd; border:1px solid #1B3A6B55; }
      .njtc-badge-none { background:transparent; color:#6b7280; border:1px solid #374151; }

      .njtc-metrics-row { display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-bottom:12px; }
      .njtc-metric { background:rgba(0,0,0,0.2); border-radius:8px; padding:8px 10px; }
      .njtc-metric-val { font-size:1.1rem; font-weight:700; }
      .njtc-metric-label { font-size:0.65rem; color:#94a3b8; text-transform:uppercase; letter-spacing:0.04em; }

      .njtc-chips { display:flex; flex-wrap:wrap; gap:6px; margin-bottom:12px; }
      .njtc-chip { font-size:0.7rem; border-radius:20px; padding:3px 9px; background:rgba(255,255,255,0.07); color:#cbd5e1; }
      .njtc-chip.ela { border:1px solid #1C7C8C44; }
      .njtc-chip.math { border:1px solid #FFB81C44; }

      .njtc-flags { display:flex; gap:6px; flex-wrap:wrap; margin-bottom:10px; font-size:0.78rem; }
      .njtc-cta { font-size:0.78rem; color:#1C7C8C; font-weight:600; cursor:pointer; }
      .njtc-cta:hover { color:#34d399; }

      /* Detail Panel */
      .njtc-detail-overlay { position:fixed; inset:0; background:rgba(0,0,0,0.5); z-index:9990; opacity:0; transition:opacity 0.25s; pointer-events:none; }
      .njtc-detail-overlay.open { opacity:1; pointer-events:all; }
      .njtc-detail-panel { position:fixed; top:0; right:-640px; width:600px; max-width:100vw; height:100vh; overflow-y:auto; background:#0f172a; border-left:1px solid rgba(255,255,255,0.1); z-index:9991; transition:right 0.3s cubic-bezier(0.4,0,0.2,1); box-shadow:-8px 0 40px rgba(0,0,0,0.5); padding:0; }
      .njtc-detail-panel.open { right:0; }
      .njtc-detail-close { position:sticky; top:0; z-index:2; display:flex; justify-content:flex-end; padding:14px 16px 0; background:#0f172a; }
      .njtc-detail-close button { background:rgba(255,255,255,0.08); border:1px solid rgba(255,255,255,0.12); color:#e2e8f0; border-radius:8px; padding:6px 14px; cursor:pointer; font-size:0.85rem; }
      .njtc-detail-close button:hover { background:rgba(255,255,255,0.14); }
      .njtc-detail-body { padding:0 24px 48px; }

      .njtc-detail-header { display:flex; gap:16px; align-items:flex-start; margin-bottom:24px; padding-top:8px; }
      .njtc-detail-avatar { width:68px; height:68px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:1.4rem; font-weight:700; color:#fff; flex-shrink:0; }
      .njtc-detail-name { font-size:1.3rem; font-weight:700; }
      .njtc-detail-sub { font-size:0.82rem; color:#94a3b8; margin-top:3px; }
      .njtc-att-big { font-size:2rem; font-weight:800; margin-top:6px; }

      /* Concerns */
      .njtc-concerns-block { background:rgba(245,158,11,0.07); border:1px solid rgba(245,158,11,0.3); border-radius:10px; padding:14px 16px; margin-bottom:20px; }
      .njtc-concerns-title { font-size:0.78rem; color:#f59e0b; font-weight:700; text-transform:uppercase; letter-spacing:0.05em; margin-bottom:10px; }
      .njtc-concern-item { font-size:0.82rem; color:#fbbf24; border-bottom:1px solid rgba(245,158,11,0.15); padding:7px 0; }
      .njtc-concern-item:last-child { border-bottom:none; }
      .njtc-concern-date { font-size:0.7rem; color:#94a3b8; margin-left:8px; }

      /* TAP Section */
      .njtc-tap-block { background:rgba(255,184,28,0.06); border:1px solid rgba(255,184,28,0.2); border-radius:10px; padding:16px; margin-bottom:20px; }
      .njtc-tap-title { font-size:0.78rem; color:#FFB81C; font-weight:700; text-transform:uppercase; letter-spacing:0.05em; margin-bottom:12px; }
      .njtc-tap-meta { display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-bottom:14px; }
      .njtc-tap-field { font-size:0.8rem; }
      .njtc-tap-field span { color:#94a3b8; }
      .njtc-progress-row { margin-bottom:10px; }
      .njtc-progress-label { display:flex; justify-content:space-between; font-size:0.75rem; color:#94a3b8; margin-bottom:4px; }
      .njtc-progress-bar { height:8px; border-radius:4px; background:rgba(255,255,255,0.07); overflow:hidden; }
      .njtc-progress-fill { height:100%; border-radius:4px; transition:width 0.4s; }
      .njtc-progress-fill.ojt { background:#1C7C8C; }
      .njtc-progress-fill.rti { background:#FFB81C; }
      .njtc-ojt-link { display:inline-block; font-size:0.78rem; color:#1C7C8C; border:1px solid #1C7C8C44; border-radius:6px; padding:5px 12px; margin-top:8px; text-decoration:none; }
      .njtc-ojt-link:hover { background:rgba(28,124,140,0.1); }

      /* Pearl Ops Section */
      .njtc-section-block { margin-bottom:24px; }
      .njtc-section-block-title { font-size:0.82rem; font-weight:700; color:#1C7C8C; text-transform:uppercase; letter-spacing:0.05em; margin-bottom:12px; padding-bottom:6px; border-bottom:1px solid rgba(255,255,255,0.07); }
      .njtc-kpi-mini-row { display:flex; gap:12px; flex-wrap:wrap; margin-bottom:14px; }
      .njtc-kpi-mini { background:rgba(0,0,0,0.25); border-radius:8px; padding:10px 14px; flex:1 1 80px; }
      .njtc-kpi-mini-val { font-size:1.2rem; font-weight:700; }
      .njtc-kpi-mini-label { font-size:0.65rem; color:#94a3b8; text-transform:uppercase; }

      .njtc-table { width:100%; border-collapse:collapse; font-size:0.78rem; }
      .njtc-table th { text-align:left; padding:7px 10px; background:rgba(0,0,0,0.3); color:#94a3b8; font-size:0.68rem; text-transform:uppercase; letter-spacing:0.04em; }
      .njtc-table td { padding:7px 10px; border-bottom:1px solid rgba(255,255,255,0.04); }
      .njtc-table tr:nth-child(even) td { background:rgba(255,255,255,0.02); }
      .njtc-table td.flag-red { color:#ef4444; }
      .njtc-table td.flag-amber { color:#f59e0b; }
      .njtc-table td.ok { color:#10b981; }

      /* Survey */
      .njtc-survey-grid { display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:10px; }
      .njtc-survey-card { background:rgba(0,0,0,0.2); border-radius:8px; padding:10px 14px; text-align:center; }
      .njtc-survey-val { font-size:1.4rem; font-weight:700; }
      .njtc-survey-label { font-size:0.68rem; color:#94a3b8; text-transform:uppercase; }

      /* iReady */
      .njtc-ir-meta { display:grid; grid-template-columns:repeat(3,1fr); gap:10px; margin-bottom:14px; }
      .njtc-ir-stat { background:rgba(0,0,0,0.2); border-radius:8px; padding:10px; text-align:center; }
      .njtc-ir-stat-val { font-size:1.1rem; font-weight:700; }
      .njtc-ir-stat-label { font-size:0.65rem; color:#94a3b8; }

      /* Divider */
      .njtc-divider { border:none; border-top:1px solid rgba(255,255,255,0.07); margin:20px 0; }

      @media (max-width: 640px) {
        .njtc-detail-panel { width:100vw; right:-100vw; }
        .njtc-tutor-grid { grid-template-columns:1fr; }
        .njtc-kpi-strip { flex-direction:column; }
        .njtc-kpi-card { min-width:unset; }
        .njtc-tap-meta { grid-template-columns:1fr; }
        .njtc-ir-meta { grid-template-columns:1fr 1fr; }
        .njtc-survey-grid { grid-template-columns:1fr 1fr; }
      }
    `;
    const style = document.createElement('style');
    style.id = 'njtc-team-styles';
    style.textContent = css;
    document.head.appendChild(style);
  }

  /* ─────────────────────────────────────────────
     RENDER HELPERS
  ───────────────────────────────────────────── */
  function renderBadge(tapData) {
    if (!tapData) return `<span class="njtc-badge njtc-badge-none">Not Enrolled</span>`;
    const status = (tapData['Apprentice Program Status'] || tapData['K'] || '').trim();
    if (/active/i.test(status)) return `<span class="njtc-badge njtc-badge-active">TAP Active</span>`;
    if (/prior|complete|graduate/i.test(status)) return `<span class="njtc-badge njtc-badge-prior">TAP Prior</span>`;
    return `<span class="njtc-badge njtc-badge-none">Not Enrolled</span>`;
  }

  function renderAttColor(p) {
    return `color:${attColor(p)}`;
  }

  function renderFlags(attMetrics, stuMetrics) {
    const flags = [];
    if (attMetrics.rate != null && attMetrics.rate < 80)
      flags.push('<span title="Attendance below 80%">🔴 Low Att.</span>');
    if ((!stuMetrics.surveyScores || stuMetrics.surveyScores.count === 0))
      flags.push('<span title="No survey responses recorded">⚠️ No Surveys</span>');
    if (attMetrics.si >= 5)
      flags.push('<span title="5 or more service interruptions">🔴 High SIs</span>');
    const highAbsScholars = stuMetrics.scholars.filter(s => s.rate != null && s.rate < 60);
    if (highAbsScholars.length > 0)
      flags.push(`<span title="${highAbsScholars.length} scholar(s) with low attendance">⚠️ ${highAbsScholars.length} Scholar Abs.</span>`);
    return flags;
  }

  function tutorCardFlagClass(attMetrics, stuMetrics) {
    if ((attMetrics.rate != null && attMetrics.rate < 80) || attMetrics.si >= 5) return 'flagged';
    if (!stuMetrics.surveyScores || stuMetrics.surveyScores.count === 0) return 'flagged-warn';
    return '';
  }

  function iReadyMovementIcon(row) {
    const mv = (row['Movement'] || row['Placement Level Change'] || '').toLowerCase();
    if (mv.includes('improv') || mv === '▲' || mv === 'up') return '▲';
    if (mv.includes('declin') || mv === '▼' || mv === 'down') return '▼';
    return '=';
  }

  /* ─────────────────────────────────────────────
     RENDER SITE KPI STRIP
  ───────────────────────────────────────────── */
  function renderKPIStrip(tutors, tapRows) {
    const totalTutors = tutors.length;
    let totalSessions = 0, totalScholars = new Set(), totalSI = 0, flaggedBelow80 = 0;
    let attRates = [], surveyTotals = [], surveyCount = 0;
    let activeApprentices = 0;

    tutors.forEach(t => {
      totalSessions += t.attMetrics.total;
      totalSI += t.attMetrics.si;
      if (t.attMetrics.rate != null) attRates.push(t.attMetrics.rate);
      if (t.attMetrics.rate != null && t.attMetrics.rate < 80) flaggedBelow80++;
      t.stuMetrics.scholars.forEach(s => totalScholars.add(normName(s.name)));
      if (t.stuMetrics.surveyScores && t.stuMetrics.surveyScores.count > 0) {
        surveyTotals.push(t.stuMetrics.surveyScores.overall);
        surveyCount++;
      }
      const tap = t.tap;
      if (tap && /active/i.test(tap['Apprentice Program Status'] || tap['K'] || '')) activeApprentices++;
    });

    const avgAtt = attRates.length ? Math.round(attRates.reduce((a,b)=>a+b,0)/attRates.length) : null;
    const avgSurvey = surveyCount ? Math.round((surveyTotals.reduce((a,b)=>a+b,0)/surveyCount)*10)/10 : null;

    const attGoal = 90;
    const attStatus = avgAtt == null ? '#6b7280' : attColor(avgAtt);

    return `
      <div class="njtc-kpi-strip">
        <div class="njtc-kpi-card">
          <div class="njtc-kpi-label">Tutors on Your Team</div>
          <div class="njtc-kpi-value" style="color:#1C7C8C">${totalTutors}</div>
        </div>
        <div class="njtc-kpi-card">
          <div class="njtc-kpi-label">Site Attendance Rate</div>
          <div class="njtc-kpi-value" style="${renderAttColor(avgAtt)}">${avgAtt != null ? avgAtt+'%' : '—'}</div>
          <div class="njtc-kpi-sub">Goal: ${attGoal}%</div>
        </div>
        <div class="njtc-kpi-card">
          <div class="njtc-kpi-label">Total Sessions</div>
          <div class="njtc-kpi-value" style="color:#e2e8f0">${totalSessions}</div>
        </div>
        <div class="njtc-kpi-card">
          <div class="njtc-kpi-label">Scholars Served</div>
          <div class="njtc-kpi-value" style="color:#e2e8f0">${totalScholars.size}</div>
        </div>
        <div class="njtc-kpi-card">
          <div class="njtc-kpi-label">Avg Survey Score</div>
          <div class="njtc-kpi-value" style="color:${surveyColor(avgSurvey)}">${avgSurvey != null ? avgSurvey : '—'}</div>
          <div class="njtc-kpi-sub">Scale: 1–5</div>
        </div>
        <div class="njtc-kpi-card">
          <div class="njtc-kpi-label">Active Apprentices</div>
          <div class="njtc-kpi-value" style="color:#FFB81C">${activeApprentices}</div>
          <div class="njtc-kpi-sub">TAP enrolled</div>
        </div>
        <div class="njtc-kpi-card">
          <div class="njtc-kpi-label">Service Interruptions</div>
          <div class="njtc-kpi-value" style="color:${totalSI > 10 ? '#ef4444' : '#e2e8f0'}">${totalSI}</div>
          <div class="njtc-kpi-sub">${flaggedBelow80} tutor(s) &lt;80%</div>
        </div>
      </div>
    `;
  }

  /* ─────────────────────────────────────────────
     RENDER TUTOR CARD
  ───────────────────────────────────────────── */
  function renderTutorCard(tutor) {
    const { name, id, role, attMetrics, stuMetrics, irElaMetrics, irMathMetrics, tap } = tutor;
    const color = avatarColor(id || name);
    const ini = initials(name);
    const badge = renderBadge(tap);
    const flags = renderFlags(attMetrics, stuMetrics);
    const flagClass = tutorCardFlagClass(attMetrics, stuMetrics);
    const surveyVal = stuMetrics.surveyScores && stuMetrics.surveyScores.count > 0 ? stuMetrics.surveyScores.overall : null;

    const elaChip = irElaMetrics && irElaMetrics.total > 0
      ? `<span class="njtc-chip ela">ELA: ${irElaMetrics.pctImproved != null ? irElaMetrics.pctImproved+'% improved' : '—'}</span>` : '';
    const mathChip = irMathMetrics && irMathMetrics.total > 0
      ? `<span class="njtc-chip math">Math: ${irMathMetrics.pctImproved != null ? irMathMetrics.pctImproved+'% improved' : '—'}</span>` : '';

    return `
      <div class="njtc-tutor-card ${escHtml(flagClass)}" data-tutor-name="${escHtml(name)}" onclick="window.NJTCTeam.openDetail('${escHtml(name).replace(/'/g,"\\'")}')">
        <div class="njtc-card-header">
          <div class="njtc-avatar" style="background:${color}">${escHtml(ini)}</div>
          <div>
            <div class="njtc-card-name">${escHtml(name)}${badge}</div>
            <div class="njtc-card-role">${escHtml(safe(role))}</div>
          </div>
        </div>
        <div class="njtc-metrics-row">
          <div class="njtc-metric">
            <div class="njtc-metric-val" style="${renderAttColor(attMetrics.rate)}">${attMetrics.rate != null ? attMetrics.rate+'%' : '—'}</div>
            <div class="njtc-metric-label">Attendance</div>
          </div>
          <div class="njtc-metric">
            <div class="njtc-metric-val">${stuMetrics.uniqueCount}</div>
            <div class="njtc-metric-label">Scholars</div>
          </div>
          <div class="njtc-metric">
            <div class="njtc-metric-val" style="${attMetrics.si >= 5 ? 'color:#ef4444' : ''}">${attMetrics.si}</div>
            <div class="njtc-metric-label">Serv. Int.</div>
          </div>
          <div class="njtc-metric">
            <div class="njtc-metric-val" style="color:${surveyColor(surveyVal)}">${surveyVal != null ? surveyVal : '—'}</div>
            <div class="njtc-metric-label">Survey Avg</div>
          </div>
        </div>
        ${elaChip || mathChip ? `<div class="njtc-chips">${elaChip}${mathChip}</div>` : ''}
        ${flags.length ? `<div class="njtc-flags">${flags.join('')}</div>` : ''}
        <div class="njtc-cta">View Full Profile →</div>
      </div>
    `;
  }

  /* ─────────────────────────────────────────────
     RENDER DETAIL PANEL
  ───────────────────────────────────────────── */
  function renderDetailPanel(tutor) {
    const { name, id, role, school, attMetrics, stuMetrics, irElaMetrics, irMathMetrics, tap, concerns } = tutor;
    const color = avatarColor(id || name);
    const ini = initials(name);
    const badge = renderBadge(tap);
    const surveyData = stuMetrics.surveyScores;
    const surveyVal = surveyData && surveyData.count > 0 ? surveyData.overall : null;

    // Concerns block
    let concernsHtml = '';
    if (concerns && concerns.length > 0) {
      const items = concerns.map(c => {
        const note = c['Note'] || c['Concern'] || c['Description'] || Object.values(c).join(' | ');
        const date = c['Date'] || c['Timestamp'] || '';
        return `<div class="njtc-concern-item">${escHtml(note)}<span class="njtc-concern-date">${escHtml(date)}</span></div>`;
      }).join('');
      concernsHtml = `
        <div class="njtc-concerns-block">
          <div class="njtc-concerns-title">⚠️ HR Concerns on Record (${concerns.length})</div>
          ${items}
        </div>
      `;
    }

    // TAP block — always show OJT log link; show full TAP details only when master roster data loaded
    const ojtFormUrl = `https://docs.google.com/forms/d/${OJT_FORM_ID}/viewform` +
      `?entry.1113592438=${encodeURIComponent(name)}` +
      (tap ? `&entry.2084410404=${encodeURIComponent(tap['Phase'] || tap['I'] || '')}` : '');

    let tapHtml = '';
    if (tap) {
      const tapStatus = tap['Apprentice Program Status'] || tap['K'] || '';
      const usdol     = tap['USDOL ID']      || tap['B'] || '—';
      const phase     = tap['Phase']         || tap['I'] || '—';
      const wage      = tap['Current Wage']  || tap['F'] || '—';
      const milestone = tap['Milestone']     || tap['J'] || '—';
      const ojtHours  = parseFloat(tap['OJT Hours'] || tap['G'] || 0);
      const rtiHours  = parseFloat(tap['RTI Hours'] || tap['H'] || 0);
      const ojtTotal  = 4000, rtiTotal = 288;
      const ojtPct    = Math.min(100, Math.round((ojtHours / ojtTotal) * 100));
      const rtiPct    = Math.min(100, Math.round((rtiHours / rtiTotal) * 100));

      tapHtml = `
        <div class="njtc-tap-block">
          <div class="njtc-tap-title">TAP Apprenticeship${badge}</div>
          <div class="njtc-tap-meta">
            <div class="njtc-tap-field"><span>USDOL ID: </span>${escHtml(usdol)}</div>
            <div class="njtc-tap-field"><span>Phase: </span>${escHtml(phase)}</div>
            <div class="njtc-tap-field"><span>Current Wage: </span>${escHtml(wage)}</div>
            <div class="njtc-tap-field"><span>Milestone: </span>${escHtml(milestone)}</div>
            <div class="njtc-tap-field"><span>Status: </span>${escHtml(tapStatus)}</div>
          </div>
          <div class="njtc-progress-row">
            <div class="njtc-progress-label"><span>OJT Hours</span><span>${ojtHours} / ${ojtTotal} (${ojtPct}%)</span></div>
            <div class="njtc-progress-bar"><div class="njtc-progress-fill ojt" style="width:${ojtPct}%"></div></div>
          </div>
          <div class="njtc-progress-row">
            <div class="njtc-progress-label"><span>RTI Hours</span><span>${rtiHours} / ${rtiTotal} (${rtiPct}%)</span></div>
            <div class="njtc-progress-bar"><div class="njtc-progress-fill rti" style="width:${rtiPct}%"></div></div>
          </div>
          <a href="${escHtml(ojtFormUrl)}" target="_blank" class="njtc-ojt-link">📋 Log OJT Activity →</a>
        </div>
      `;
    } else {
      // No TAP master roster data — still provide OJT log access for all tutors
      tapHtml = `
        <div class="njtc-tap-block" style="border-color:#334155;background:rgba(30,41,59,0.6)">
          <div class="njtc-tap-title" style="color:#94a3b8">OJT Activity Log</div>
          <div style="font-size:0.78rem;color:#64748b;margin-bottom:10px">
            Log an OJT activity for this tutor. If they are a TAP apprentice, this entry will be recorded and processed automatically.
          </div>
          <a href="${escHtml(ojtFormUrl)}" target="_blank" class="njtc-ojt-link">📋 Log OJT Activity →</a>
        </div>
      `;
    }

    // Pearl Ops block
    const { attended, absent, si, total, absenceReasons } = attMetrics;
    const absReasonRows = Object.entries(absenceReasons || {}).map(([reason, count]) =>
      `<tr><td>${escHtml(reason)}</td><td>${count}</td></tr>`
    ).join('');

    const scholarRows = stuMetrics.scholars.slice(0, 50).map(s => {
      const rate = s.rate;
      const rateClass = rate == null ? '' : rate < 60 ? 'flag-red' : rate < 80 ? 'flag-amber' : 'ok';
      const status = rate == null ? '—' : rate >= 80 ? 'On Track' : rate >= 60 ? 'At Risk' : 'Critical';
      return `<tr>
        <td>${escHtml(s.name)}</td>
        <td>${escHtml(s.grade || '—')}</td>
        <td>${s.attended}</td><td>${s.absent}</td><td>${s.si}</td>
        <td class="${rateClass}">${rate != null ? rate+'%' : '—'}</td>
        <td class="${rateClass}">${status}</td>
      </tr>`;
    }).join('');

    const pearlHtml = `
      <div class="njtc-section-block">
        <div class="njtc-section-block-title">Pearl Operations</div>
        <div class="njtc-kpi-mini-row">
          <div class="njtc-kpi-mini"><div class="njtc-kpi-mini-val" style="${renderAttColor(attMetrics.rate)}">${attMetrics.rate != null ? attMetrics.rate+'%' : '—'}</div><div class="njtc-kpi-mini-label">Att. Rate</div></div>
          <div class="njtc-kpi-mini"><div class="njtc-kpi-mini-val">${attended}</div><div class="njtc-kpi-mini-label">Attended</div></div>
          <div class="njtc-kpi-mini"><div class="njtc-kpi-mini-val">${absent}</div><div class="njtc-kpi-mini-label">Absent</div></div>
          <div class="njtc-kpi-mini"><div class="njtc-kpi-mini-val" style="${si >= 5 ? 'color:#ef4444' : ''}">${si}</div><div class="njtc-kpi-mini-label">Serv. Int.</div></div>
          <div class="njtc-kpi-mini"><div class="njtc-kpi-mini-val">${total}</div><div class="njtc-kpi-mini-label">Total</div></div>
        </div>
        ${absReasonRows ? `
        <div style="margin-bottom:14px">
          <div style="font-size:0.72rem;color:#94a3b8;text-transform:uppercase;letter-spacing:0.04em;margin-bottom:8px">Absence Reasons</div>
          <table class="njtc-table"><thead><tr><th>Reason</th><th>Count</th></tr></thead><tbody>${absReasonRows}</tbody></table>
        </div>` : ''}
        ${scholarRows ? `
        <div>
          <div style="font-size:0.72rem;color:#94a3b8;text-transform:uppercase;letter-spacing:0.04em;margin-bottom:8px">Scholar Attendance</div>
          <div style="overflow-x:auto">
            <table class="njtc-table">
              <thead><tr><th>Name</th><th>Grade</th><th>Att.</th><th>Abs.</th><th>SI</th><th>Rate</th><th>Status</th></tr></thead>
              <tbody>${scholarRows}</tbody>
            </table>
          </div>
        </div>` : '<div style="color:#94a3b8;font-size:0.82rem">No scholar data available.</div>'}
      </div>
    `;

    // Survey block
    let surveyHtml = '';
    if (surveyData && surveyData.count > 0) {
      surveyHtml = `
        <div class="njtc-section-block">
          <div class="njtc-section-block-title">Scholar Surveys (n=${surveyData.count})</div>
          <div class="njtc-survey-grid">
            <div class="njtc-survey-card">
              <div class="njtc-survey-val" style="color:${surveyColor(surveyData.confidence)}">${surveyData.confidence || '—'}</div>
              <div class="njtc-survey-label">Confidence</div>
            </div>
            <div class="njtc-survey-card">
              <div class="njtc-survey-val" style="color:${surveyColor(surveyData.enjoyment)}">${surveyData.enjoyment || '—'}</div>
              <div class="njtc-survey-label">Enjoyment</div>
            </div>
            <div class="njtc-survey-card">
              <div class="njtc-survey-val" style="color:${surveyColor(surveyData.learning)}">${surveyData.learning || '—'}</div>
              <div class="njtc-survey-label">Learning</div>
            </div>
            <div class="njtc-survey-card">
              <div class="njtc-survey-val" style="color:${surveyColor(surveyData.overall)}">${surveyData.overall || '—'}</div>
              <div class="njtc-survey-label">Overall</div>
            </div>
          </div>
        </div>
      `;
    } else {
      surveyHtml = `
        <div class="njtc-section-block">
          <div class="njtc-section-block-title">Scholar Surveys</div>
          <div style="color:#94a3b8;font-size:0.82rem">No survey responses on record.</div>
        </div>
      `;
    }

    // iReady blocks
    function renderIReadyBlock(metrics, subject) {
      if (!metrics || metrics.total === 0) {
        return `
          <div class="njtc-section-block">
            <div class="njtc-section-block-title">iReady — ${subject}</div>
            <div style="color:#94a3b8;font-size:0.82rem">No iReady data available for this tutor's scholars.</div>
          </div>
        `;
      }
      const schRows = metrics.scholars.slice(0, 50).map(r => {
        const boyLevel = r['Beginning of Year Placement'] || r['BOY Level'] || r['BOY'] || '—';
        const eoyLevel = r['End of Year Placement'] || r['EOY Level'] || r['EOY'] || '—';
        const mv = iReadyMovementIcon(r);
        const mvColor = mv === '▲' ? '#10b981' : mv === '▼' ? '#ef4444' : '#94a3b8';
        const growth = r['% Typical Growth'] || r['Typical Growth'] || '—';
        const name = r['Student Name'] || r['Scholar Name'] || r['Name'] || '—';
        const grade = r['Grade'] || '—';
        return `<tr>
          <td>${escHtml(name)}</td>
          <td>${escHtml(grade)}</td>
          <td>${escHtml(boyLevel)}</td>
          <td>${escHtml(eoyLevel)}</td>
          <td style="color:${mvColor}">${mv}</td>
          <td>${escHtml(String(growth))}</td>
        </tr>`;
      }).join('');

      return `
        <div class="njtc-section-block">
          <div class="njtc-section-block-title">iReady — ${subject}</div>
          <div class="njtc-ir-meta">
            <div class="njtc-ir-stat"><div class="njtc-ir-stat-val" style="color:#10b981">${metrics.pctImproved != null ? metrics.pctImproved+'%' : '—'}</div><div class="njtc-ir-stat-label">Improved</div></div>
            <div class="njtc-ir-stat"><div class="njtc-ir-stat-val" style="color:#94a3b8">${metrics.pctMaintained != null ? metrics.pctMaintained+'%' : '—'}</div><div class="njtc-ir-stat-label">Maintained</div></div>
            <div class="njtc-ir-stat"><div class="njtc-ir-stat-val" style="color:#ef4444">${metrics.pctDeclined != null ? metrics.pctDeclined+'%' : '—'}</div><div class="njtc-ir-stat-label">Declined</div></div>
            <div class="njtc-ir-stat"><div class="njtc-ir-stat-val">${metrics.medGrowth != null ? metrics.medGrowth+'%' : '—'}</div><div class="njtc-ir-stat-label">Median Growth</div></div>
            <div class="njtc-ir-stat"><div class="njtc-ir-stat-val">${metrics.avgGain != null ? metrics.avgGain : '—'}</div><div class="njtc-ir-stat-label">Avg SS Gain</div></div>
          </div>
          ${schRows ? `
          <div style="overflow-x:auto">
            <table class="njtc-table">
              <thead><tr><th>Name</th><th>Grade</th><th>BOY Level</th><th>EOY Level</th><th>Mvmt</th><th>% Typ. Growth</th></tr></thead>
              <tbody>${schRows}</tbody>
            </table>
          </div>` : ''}
        </div>
      `;
    }

    const elaHtml  = renderIReadyBlock(irElaMetrics, 'ELA');
    const mathHtml = renderIReadyBlock(irMathMetrics, 'Math');

    return `
      <div class="njtc-detail-close"><button onclick="window.NJTCTeam.closeDetail()">✕ Close</button></div>
      <div class="njtc-detail-body">
        <div class="njtc-detail-header">
          <div class="njtc-detail-avatar" style="background:${color}">${escHtml(ini)}</div>
          <div>
            <div class="njtc-detail-name">${escHtml(name)}${badge}</div>
            <div class="njtc-detail-sub">${escHtml(safe(role))} &bull; ${escHtml(safe(school))}</div>
            <div class="njtc-att-big" style="${renderAttColor(attMetrics.rate)}">${attMetrics.rate != null ? attMetrics.rate+'%' : '—'}</div>
          </div>
        </div>
        <hr class="njtc-divider">
        ${concernsHtml}
        ${tapHtml}
        ${pearlHtml}
        <hr class="njtc-divider">
        ${surveyHtml}
        <hr class="njtc-divider">
        ${elaHtml}
        ${mathHtml}
      </div>
    `;
  }

  /* ─────────────────────────────────────────────
     MAIN BUILD FUNCTION
  ───────────────────────────────────────────── */
  async function build(userProfile) {
    if (!userProfile) return;

    injectTeamStyles();

    const container = document.getElementById('njtcTeamContainer');
    if (!container) return;

    container.innerHTML = `<div class="njtc-team-loading"><div class="njtc-spinner"></div> Loading team data…</div>`;

    // Detect leader role
    const leaderInfo = await detectLeader(userProfile);
    if (!leaderInfo) {
      container.innerHTML = `<div style="color:#94a3b8;padding:32px;text-align:center">You do not appear to have a leader role in the HR system for 2025–2026.</div>`;
      return;
    }

    _leaderProfile  = userProfile;
    _leaderDistricts = leaderInfo.districts;

    // Unhide "My Team" tab
    const teamTab = document.getElementById('njtcTeamTab');
    if (teamTab) teamTab.style.display = 'flex';

    let data;
    try {
      data = await loadAllData(_leaderDistricts, userProfile.name);
    } catch (e) {
      console.error('[NJTCTeam] Data load error:', e);
      container.innerHTML = `<div style="color:#ef4444;padding:32px">Error loading team data. Please refresh and try again.</div>`;
      return;
    }

    _teamData = data;

    // Build tutor map from ATT rows
    const tutorMap = buildTutorMap(data.att);

    // Pearl STU uses "User" for the tutor's name — add any tutors present in STU but missing from ATT
    data.stu.forEach(r => {
      const tutorName = (r['User'] || r['Tutor Name'] || '').trim();
      if (!tutorName) return;
      const key = normName(tutorName);
      if (!tutorMap[key]) {
        tutorMap[key] = {
          name: tutorName,
          district: r['District'] || '',
          school: r['School'] || r['Site'] || '',
          role: 'Instructor',
          id: key,
          attRows: []
        };
      }
    });

    // Compute per-tutor metrics
    const tutors = Object.values(tutorMap).map(t => {
      const tn = normName(t.name);
      const myAttRows = data.att.filter(r => normName(r['User'] || r['Tutor Name'] || '') === tn);
      // STU sheet: "User" = tutor who ran the session; "Filled For" = scholar name
      const myStuRows = data.stu.filter(r => normName(r['User'] || r['Tutor Name'] || '') === tn);

      // iReady: match by scholar name cross-reference using STU "Filled For" column
      const scholarNames = new Set(myStuRows.map(r => normName(r['Filled For'] || r['Scholar Name'] || r['Student Name'] || '')).filter(Boolean));
      const myElaRows  = data.irEla.filter(r  => scholarNames.has(normName(r['Student Name'] || r['Scholar Name'] || r['Name'] || '')));
      const myMathRows = data.irMath.filter(r => scholarNames.has(normName(r['Student Name'] || r['Scholar Name'] || r['Name'] || '')));

      const attMetrics = computeAttMetrics(myAttRows);
      const stuMetrics = computeStuMetrics(myStuRows);
      const irElaMetrics  = computeIReadyMetrics(myElaRows);
      const irMathMetrics = computeIReadyMetrics(myMathRows);
      const tap = getTapForTutor(data.tap, t.name);
      const concerns = getConcernsForTutor(data.concerns, t.name);

      return { ...t, attMetrics, stuMetrics, irElaMetrics, irMathMetrics, tap, concerns };
    });

    // Sort: flagged first, then alpha
    tutors.sort((a, b) => {
      const aFlag = (a.attMetrics.rate != null && a.attMetrics.rate < 80) || a.attMetrics.si >= 5 ? 0 : 1;
      const bFlag = (b.attMetrics.rate != null && b.attMetrics.rate < 80) || b.attMetrics.si >= 5 ? 0 : 1;
      if (aFlag !== bFlag) return aFlag - bFlag;
      return a.name.localeCompare(b.name);
    });

    // Store for openDetail
    window._njtcTeamTutors = tutors;

    const needsAttention = tutors.filter(t =>
      (t.attMetrics.rate != null && t.attMetrics.rate < 80) ||
      t.attMetrics.si >= 5 ||
      (!t.stuMetrics.surveyScores || t.stuMetrics.surveyScores.count === 0) ||
      t.stuMetrics.scholars.some(s => s.rate != null && s.rate < 60)
    );
    const apprentices = tutors.filter(t => t.tap && /active/i.test(t.tap['Apprentice Program Status'] || t.tap['K'] || ''));

    let html = renderKPIStrip(tutors, data.tap);

    if (needsAttention.length > 0) {
      html += `<div class="njtc-section-title">⚠️ Needs Attention (${needsAttention.length})</div>`;
      html += `<div class="njtc-tutor-grid">${needsAttention.map(renderTutorCard).join('')}</div>`;
    }

    if (apprentices.length > 0) {
      html += `<div class="njtc-section-title">🎓 TAP Apprentices (${apprentices.length})</div>`;
      html += `<div class="njtc-tutor-grid">${apprentices.map(renderTutorCard).join('')}</div>`;
    }

    html += `<div class="njtc-section-title">Full Team Roster (${tutors.length})</div>`;
    html += `<div class="njtc-tutor-grid">${tutors.map(renderTutorCard).join('')}</div>`;

    container.innerHTML = html;

    // Ensure overlay/panel exist in DOM
    ensureDetailDOM();
  }

  /* ─────────────────────────────────────────────
     DETAIL OVERLAY DOM
  ───────────────────────────────────────────── */
  function ensureDetailDOM() {
    if (document.getElementById('njtcDetailOverlay')) return;

    const overlay = document.createElement('div');
    overlay.id = 'njtcDetailOverlay';
    overlay.className = 'njtc-detail-overlay';
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) window.NJTCTeam.closeDetail();
    });

    const panel = document.createElement('div');
    panel.id = 'njtcDetailPanel';
    panel.className = 'njtc-detail-panel';

    document.body.appendChild(overlay);
    document.body.appendChild(panel);
  }

  function openDetail(tutorName) {
    ensureDetailDOM();
    const tutors = window._njtcTeamTutors || [];
    const tutor = tutors.find(t => normName(t.name) === normName(tutorName));
    const panel = document.getElementById('njtcDetailPanel');
    const overlay = document.getElementById('njtcDetailOverlay');
    if (!panel || !overlay) return;

    panel.innerHTML = tutor
      ? renderDetailPanel(tutor)
      : `<div class="njtc-detail-close"><button onclick="window.NJTCTeam.closeDetail()">✕ Close</button></div><div style="padding:32px;color:#94a3b8">Tutor not found.</div>`;

    overlay.classList.add('open');
    panel.classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  function closeDetail() {
    const panel = document.getElementById('njtcDetailPanel');
    const overlay = document.getElementById('njtcDetailOverlay');
    if (panel) panel.classList.remove('open');
    if (overlay) overlay.classList.remove('open');
    document.body.style.overflow = '';
  }

  async function refresh() {
    // Clear cache
    Object.values(CACHE_KEYS).forEach(k => { try { sessionStorage.removeItem(k); } catch (e) {} });
    if (_leaderProfile) await build(_leaderProfile);
  }

  /* ─────────────────────────────────────────────
     KEYBOARD CLOSE
  ───────────────────────────────────────────── */
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') closeDetail();
  });

  /* ─────────────────────────────────────────────
     PROFILE READY LISTENER
  ───────────────────────────────────────────── */
  document.addEventListener('userProfileReady', function (e) {
    const profile = (e && e.detail) ? e.detail : window.NJTC_USER_PROFILE;
    if (profile) build(profile);
  });

  // If profile already available on load
  if (window.NJTC_USER_PROFILE) {
    build(window.NJTC_USER_PROFILE);
  }

  /* ─────────────────────────────────────────────
     PUBLIC API
  ───────────────────────────────────────────── */
  window.NJTCTeam = { build, openDetail, closeDetail, refresh };

})();
