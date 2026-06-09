(function () {
  'use strict';

  /* ─────────────────────────────────────────────
     CONSTANTS
  ───────────────────────────────────────────── */
  const PEARL_KEY  = '2PACX-1vQ1iC8NZFJt3iinGUEqftKtP32N43axi_JN_RQI36EBUdhZS0PaZRwd-1AJT3bEVe6cqHA0tCA3vb5K';
  const PEARL_ATT_GID  = '702726038';
  const PEARL_STU_GID  = '1245403832';
  // Pearl Login/ID sheet — holds staff name, email, Pearl username, school assignment, district
  const PEARL_LOGIN_KEY = '2PACX-1vS2fgss4HiKpr61wJ2_si8klythckgGZ3yOYer4FSAdThkQz-X1cdL83xbgPBnHbMpTGPHZCtnttKRv';
  const IREADY_KEY = '2PACX-1vREgf9glXO2QMKeZ8YHF-0XBtqoOyhNz3CnBpaeCY0mAC1lknvQ13JuXJpzHCZeGls4XEPkxyNO5ZBG';
  const IREADY_ELA_GID  = '0';
  const IREADY_MATH_GID = '127145553';
  // iReady 25-26 EOY Preliminary / Longitudinal Academic Data
  // EOY Preliminary is used until Longitudinal is populated; same sheet, same GIDs.
  // When longitudinal rows appear they take precedence (detected by non-empty Spring Score).
  const IR_2526_SHEET_ID  = '1mCx6eFKscXA3y5Ox_JB9cSualR5Tw9MbKxBVN078_G0';
  const IR_2526_ELA_GID   = '1640935949';
  const IR_2526_MATH_GID  = '1676366557';
  // Standards Mastery (Middlesex STEM only)
  const SM_2PACX  = '2PACX-1vTs5uDk0bg_E4rorRHadFm5i_1lerAlgj5HfSJ3NQPLMDaCbHju0VeEdbaN_mDDzA';
  const SM_GID    = '457164791';
  const SM_SCHOOLS = new Set(['middlesex stem']);
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
    att:        'njtc_team_att_v1',
    stu:        'njtc_team_stu_v1',
    irEla:      'njtc_team_ir_ela_v1',
    irMath:     'njtc_team_ir_math_v1',
    ir2526Ela:  'njtc_team_ir2526_ela_v1',
    ir2526Math: 'njtc_team_ir2526_math_v1',
    sm:         'njtc_team_sm_v1',
    tap:        'njtc_team_tap_v1',
    concerns:   'njtc_team_concerns_v1',
    pearlLogin: 'njtc_team_pearl_login_v1',
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
    let lastErr;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const res = await fetch(url, { signal: AbortSignal.timeout(30000) });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const text = await res.text();
        if (text.trim().startsWith('<')) throw new Error('HTML response — sheet not public');
        const data = csvToObjects(text);
        if (cacheKey) cacheSet(cacheKey, data);
        return data;
      } catch (e) {
        lastErr = e;
        if (attempt < 2) await new Promise(r => setTimeout(r, (attempt + 1) * 1000));
      }
    }
    throw lastErr;
  }

  function pearlUrl(gid) {
    return `https://docs.google.com/spreadsheets/d/e/${PEARL_KEY}/pub?output=csv&gid=${gid}`;
  }
  function pearlLoginUrl() {
    return `https://docs.google.com/spreadsheets/d/e/${PEARL_LOGIN_KEY}/pub?output=csv&gid=0`;
  }
  function ireadyUrl(gid) {
    return `https://docs.google.com/spreadsheets/d/e/${IREADY_KEY}/pub?output=csv&gid=${gid}`;
  }
  function ir2526Url(gid) {
    return `https://docs.google.com/spreadsheets/d/${IR_2526_SHEET_ID}/gviz/tq?tqx=out:csv&gid=${gid}`;
  }
  function smUrl() {
    return `https://docs.google.com/spreadsheets/d/e/${SM_2PACX}/pub?output=csv&gid=${SM_GID}`;
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
    const [attRows, stuRows, irElaRows, irMathRows, tapRows, concernRows, loginRows,
           ir2526ElaRows, ir2526MathRows, smRows] = await Promise.allSettled([
      fetchCSV(pearlUrl(PEARL_ATT_GID),     CACHE_KEYS.att),
      fetchCSV(pearlUrl(PEARL_STU_GID),     CACHE_KEYS.stu),
      fetchCSV(ireadyUrl(IREADY_ELA_GID),   CACHE_KEYS.irEla),
      fetchCSV(ireadyUrl(IREADY_MATH_GID),  CACHE_KEYS.irMath),
      fetchCSV(TAP_URL,                     CACHE_KEYS.tap),
      fetchCSV(concernsUrl(),               CACHE_KEYS.concerns),
      fetchCSV(pearlLoginUrl(),             CACHE_KEYS.pearlLogin),
      fetchCSV(ir2526Url(IR_2526_ELA_GID),  CACHE_KEYS.ir2526Ela),
      fetchCSV(ir2526Url(IR_2526_MATH_GID), CACHE_KEYS.ir2526Math),
      fetchCSV(smUrl(),                     CACHE_KEYS.sm),
    ]);

    const srcLabels = ['PearlATT','PearlSTU','iReadyELA','iReadyMath','TAP','Concerns','PearlLogin',
                       'iReady2526ELA','iReady2526Math','SM'];
    [attRows,stuRows,irElaRows,irMathRows,tapRows,concernRows,loginRows,
     ir2526ElaRows,ir2526MathRows,smRows].forEach((r,i) => {
      if (r.status === 'rejected') console.warn('[NJTCTeam] Source failed:', srcLabels[i], r.reason);
    });
    function val(result) { return result.status === 'fulfilled' ? result.value : []; }

    const att       = val(attRows);
    const stu       = val(stuRows);
    const irEla     = val(irElaRows);
    const irMath    = val(irMathRows);
    const tap       = val(tapRows);
    const concerns  = val(concernRows);
    const login     = val(loginRows);
    const ir2526Ela  = val(ir2526ElaRows);
    const ir2526Math = val(ir2526MathRows);
    const sm         = val(smRows);

    const leaderNorm = normName(leaderName || '');

    // ── Step 1 (PRIMARY): Pearl Login/ID sheet ────────────────────────────────
    // The login sheet maps every staff member to their school(s) and district.
    // It's the most authoritative source because it's maintained by site admins.
    // Columns vary — try common permutations for name, email, school, district.
    const loginSchools = new Set();
    if (login.length > 0) {
      login.forEach(r => {
        const rName  = normName(r['Full Name'] || r['Name'] || r['Staff Name'] || r['User'] || '');
        const rEmail = (r['Email'] || r['Email Address'] || r['email'] || '').trim().toLowerCase();
        const isMatch = rName === leaderNorm ||
          (rEmail && rEmail === (window.NJTC_USER_PROFILE && window.NJTC_USER_PROFILE.email || '').toLowerCase());
        if (!isMatch) return;
        // Collect every school field on the row (may be comma-separated or multi-column)
        ['School', 'School Name', 'Site', 'Site / School', 'Schools', 'school'].forEach(col => {
          const val = (r[col] || '').trim();
          if (!val) return;
          val.split(/[,;]/).map(s => s.trim()).filter(Boolean).forEach(s => loginSchools.add(s));
        });
      });
    }

    // ── Step 2 (SECONDARY): Pearl ATT non-Instructor rows ────────────────────
    // Captures sessions the leader supervised — authoritative when Login sheet
    // doesn't have separate rows per school for Dual Role leaders.
    const attLeaderSchools = new Set();
    att.forEach(r => {
      const role = (r['Role'] || '').trim();
      if (role === 'Instructor') return;
      const u = normName(r['User'] || '');
      if (!u || u !== leaderNorm) return;
      const school = (r['School'] || r['Site'] || '').trim();
      if (school) attLeaderSchools.add(school);
    });

    // Merge both sources
    const combinedSchools = new Set([...loginSchools, ...attLeaderSchools]);

    // ── Step 3: campus sibling expansion ─────────────────────────────────────
    // Dual Role: "iLearn Paterson MS" → also pull "iLearn Paterson ES" (same base)
    function campusBase(s) {
      return s.toLowerCase()
        .replace(/\s*[-–]\s*(ms|es|hs|middle|elementary|high|k-\d+)\s*$/i, '')
        .replace(/\s+(ms|es|hs|middle\s+school|elementary\s+school|high\s+school)\s*$/i, '')
        .trim();
    }
    const leaderBases = new Set([...combinedSchools].map(campusBase));
    const allPearlSchools = new Set(att.map(r => (r['School'] || r['Site'] || '').trim()).filter(Boolean));
    const expandedSchools = new Set(combinedSchools);
    if (leaderBases.size > 0) {
      allPearlSchools.forEach(school => {
        if (leaderBases.has(campusBase(school))) expandedSchools.add(school);
      });
    }

    // ── Step 4: site-match predicate ─────────────────────────────────────────
    // Primary: exact Pearl school name set (Login + ATT derived, Dual-Role-aware)
    // Fallback: HR site field substring matching (leader not yet in any Pearl data)
    function siteMatch(r) {
      const school = (r['School'] || r['Site'] || '').trim();
      const dist   = (r['District'] || r['district'] || '').trim();
      if (expandedSchools.size > 0) return expandedSchools.has(school);
      return leaderDistricts.some(ld => distMatch(dist, ld) || distMatch(school, ld));
    }

    // ATT: Instructor rows only for tutor roster
    const filteredAtt  = att.filter(r  => (r['Role'] || '').trim() === 'Instructor' && siteMatch(r));

    // Build the set of tutor keys from the ATT-filtered roster so we can scope STU rows
    const leaderTutorKeys = new Set(filteredAtt.map(r => normName(r['User'] || r['Tutor Name'] || '')).filter(Boolean));

    // STU sheet: "Filled For" = tutor name the survey/session is about (NOT "User" which is student login)
    // If the leader has no ATT-based roster yet, fall back to school-match on STU (rare but safe)
    const filteredStu  = stu.filter(r  => {
      const filledFor = normName(r['Filled For'] || r['Tutor Name'] || '');
      if (leaderTutorKeys.size > 0) return filledFor && leaderTutorKeys.has(filledFor);
      return siteMatch(r);
    });

    // Legacy iReady (prior-year MOY/snapshot)
    const filteredEla  = irEla.filter(r  => siteMatch(r));
    const filteredMath = irMath.filter(r => siteMatch(r));

    // iReady 25-26 EOY Preliminary / Longitudinal: school-match
    // When longitudinal rows are present (Spring Score non-empty) they automatically
    // provide richer data; preliminary and longitudinal share the same sheet/columns.
    const filtered2526Ela  = ir2526Ela.filter(r  => siteMatch(r));
    const filtered2526Math = ir2526Math.filter(r => siteMatch(r));

    // Standards Mastery: all rows (per-tutor filter happens in build() by Class Teacher)
    const filteredSm = sm;

    const filteredTap  = tap.filter(r  => {
      const site = r['Site'] || r['C'] || '';
      return leaderDistricts.some(ld => distMatch(site, ld));
    });

    const tapLoaded = tap.length > 0;

    console.log('[NJTCTeam] Login schools:', [...loginSchools], '| ATT schools:', [...attLeaderSchools]);
    console.log('[NJTCTeam] Expanded schools:', [...expandedSchools]);
    console.log('[NJTCTeam] Filtered tutors (ATT):', filteredAtt.length, '| STU:', filteredStu.length, '| TAP loaded:', tapLoaded);

    return { att: filteredAtt, stu: filteredStu, irEla: filteredEla, irMath: filteredMath,
             ir2526Ela: filtered2526Ela, ir2526Math: filtered2526Math, sm: filteredSm,
             tap: filteredTap, concerns, tapLoaded };
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
      // Pearl ATT exact status values (confirmed from Central portal)
      if (status === 'Attended' || status === 'Late') attended++;
      else if (status === 'Missed' || /^Absent/i.test(status) || /^Tutor Left/i.test(status)) {
        absent++;
        if (reason) absenceReasons[reason] = (absenceReasons[reason] || 0) + 1;
      }
      // Service interruption = tutor was absent without a sub
      const SI_PATTERNS = [
        'Absent; Not Covered (Tutor not available)',
        'Tutor Left Early (no sub)',
        'Absent; Not Covered',
      ];
      if (SI_PATTERNS.some(p => status.includes(p))) si++;
    });
    return { attended, absent, si, total, absenceReasons, rate: pct(attended, total) };
  }

  function computeStuMetrics(stuRows) {
    const scholarMap = {};
    stuRows.forEach(r => {
      // Pearl STU: "User" = student login (scholar), "Filled For" = tutor name
      const name = r['User'] || r['Scholar Name'] || r['Student Name'] || '';
      const grade = r['Grade'] || '';
      const status = r['Attendance Status'] || r['Status'] || '';
      const key = normName(name);
      if (!key) return;
      if (!scholarMap[key]) scholarMap[key] = { name, grade, attended: 0, absent: 0, si: 0, total: 0 };
      scholarMap[key].total++;
      if (status === 'Attended' || status === 'Late') scholarMap[key].attended++;
      else if (status === 'Missed' || /^Absent/i.test(status)) scholarMap[key].absent++;
      const SI_PATTERNS = ['Absent; Not Covered (Tutor not available)', 'Tutor Left Early (no sub)', 'Absent; Not Covered'];
      if (SI_PATTERNS.some(p => status.includes(p))) scholarMap[key].si++;
    });
    const scholars = Object.values(scholarMap);
    scholars.forEach(s => { s.rate = pct(s.attended, s.total); });
    const uniqueCount = scholars.length;
    // survey data — Pearl STU uses full question text as column names;
    // the enjoyment column may be HTML-entity-encoded in the CSV export
    const parseV = v => { const n = parseFloat(v); return isNaN(n) ? null : n; };
    const surveyFields = {
      confidence: r => { const keys = Object.keys(r); return parseV(r['How confident do you feel about what you are learning?'] || r[keys[2]] || r['Confidence'] || null); },
      enjoyment:  r => { const keys = Object.keys(r); return parseV(r['How much did you enjoy this session with <aboutName>?'] || r['How much did you enjoy this session with &lt;aboutName&gt;?'] || r[keys[3]] || r['Enjoyment'] || null); },
      learning:   r => { const keys = Object.keys(r); return parseV(r['How much did you learn in this session?'] || r[keys[4]] || r['Learning'] || null); },
      overall:    r => { const keys = Object.keys(r); return parseV(r['How would you rate this session overall?'] || r[keys[5]] || r['Overall'] || null); },
    };
    // A row has survey data if any of the four fields parse to a number
    const surveyRows = stuRows.filter(r => {
      return surveyFields.confidence(r) !== null || surveyFields.enjoyment(r) !== null ||
             surveyFields.learning(r) !== null   || surveyFields.overall(r)  !== null;
    });
    const sConf = [], sEnj = [], sLearn = [], sOvr = [];
    surveyRows.forEach(r => {
      const c = surveyFields.confidence(r), e = surveyFields.enjoyment(r),
            l = surveyFields.learning(r),   o = surveyFields.overall(r);
      if (c !== null) sConf.push(c);
      if (e !== null) sEnj.push(e);
      if (l !== null) sLearn.push(l);
      if (o !== null) sOvr.push(o);
    });
    const avgArr = arr => arr.length ? Math.round(arr.reduce((s,v)=>s+v,0)/arr.length*10)/10 : 0;
    const surveyScores = {
      confidence: avgArr(sConf), enjoyment: avgArr(sEnj),
      learning:   avgArr(sLearn), overall:  avgArr(sOvr),
      count: Math.max(sConf.length, sEnj.length, sLearn.length, sOvr.length),
    };
    return { scholars, uniqueCount, surveyScores };
  }

  // Extract iReady 25-26 EOY/Longitudinal columns (normalizeIRSheet2526 approach from my-dashboard)
  function normalizeIr2526Row(r) {
    return {
      name:      r['Student Name'] || r['Name'] || '',
      id:        r['Student ID']   || r['Student Id'] || '',
      grade:     r['Grade']        || '',
      school:    r['School']       || '',
      district:  r['District']     || '',
      basePlacement:   r['Base/Fall Overall Relative Placement']   || r['Fall Overall Relative Placement'] || r['Beginning of Year Placement'] || '',
      springPlacement: r['Spring/EOY Overall Relative Placement']  || r['Spring Overall Relative Placement'] || r['End of Year Placement'] || '',
      pctTypical:      parseFloat(r['Spring %'] || r['Pct Progress Toward Typical Growth'] || r['% Typical Growth'] || 0),
      isLongitudinal:  !!(r['Spring/EOY Overall Relative Placement'] || r['Spring Overall Relative Placement']),
      _raw: r,
    };
  }

  function placementLevel(str) {
    const s = (str || '').toLowerCase();
    if (s.includes('mid') || s.includes('on grade') || s.includes('at grade')) return 2;
    if (s.includes('early') || s.includes('below')) return 1;
    if (s.includes('above') || s.includes('advanc')) return 3;
    return 0;
  }

  function computeIReadyMetrics(irRows, is2526) {
    if (!irRows || irRows.length === 0) return { total: 0, scholars: [] };
    const rows = is2526 ? irRows.map(normalizeIr2526Row) : irRows;
    let improved = 0, maintained = 0, declined = 0;
    const growthVals = [], gainVals = [];

    rows.forEach(r => {
      if (is2526) {
        const base   = placementLevel(r.basePlacement);
        const spring = placementLevel(r.springPlacement);
        if (base && spring) {
          if (spring > base) improved++;
          else if (spring === base) maintained++;
          else declined++;
        }
        if (!isNaN(r.pctTypical) && r.pctTypical > 0) growthVals.push(r.pctTypical);
      } else {
        const mv = (r['Movement'] || r['Placement Level Change'] || '').toLowerCase();
        if (mv.includes('improv') || mv === '▲' || mv === 'up') improved++;
        else if (mv.includes('maintain') || mv === '=' || mv === 'same') maintained++;
        else if (mv.includes('declin') || mv === '▼' || mv === 'down') declined++;
        const gv = parseFloat(r['% Typical Growth'] || r['Typical Growth'] || 0);
        if (!isNaN(gv) && gv > 0) growthVals.push(gv);
        const gain = parseFloat(r['Scale Score Gain'] || r['SS Gain'] || 0);
        if (!isNaN(gain)) gainVals.push(gain);
      }
    });

    const total = irRows.length;
    const sorted = [...growthVals].sort((a,b)=>a-b);
    const medGrowth = sorted.length ? Math.round(sorted[Math.floor(sorted.length/2)]) : null;
    const avgGain   = gainVals.length ? Math.round(gainVals.reduce((a,b)=>a+b,0)/gainVals.length) : null;
    return {
      total,
      improved, maintained, declined,
      pctImproved:   pct(improved, total),
      pctMaintained: pct(maintained, total),
      pctDeclined:   pct(declined, total),
      medGrowth, avgGain,
      scholars: is2526 ? rows : irRows,
      is2526,
    };
  }

  function computeSmMetrics(smRows, tutorName) {
    const tn = normName(tutorName);
    const myRows = smRows.filter(r => {
      const teacher = normName(r['Class Teacher(s)'] || r['Class Teacher'] || r['Instructor'] || r['Teacher'] || '');
      return teacher && teacher.includes(tn);
    });
    if (!myRows.length) return null;
    const scholarMap = {};
    myRows.forEach(r => {
      const name = r['Student Name'] || r['Student'] || '';
      const key  = normName(name);
      if (!key) return;
      if (!scholarMap[key]) scholarMap[key] = { name, formA: null, formB: null, assessment: r['Assessment'] || '' };
      const form = (r['Form'] || '').toUpperCase();
      const score = parseFloat(r['Score'] || r['Percent Correct'] || 0);
      if (form === 'A' || form.includes('PRE'))  scholarMap[key].formA = score;
      if (form === 'B' || form.includes('POST')) scholarMap[key].formB = score;
    });
    const scholars = Object.values(scholarMap).map(s => ({
      ...s,
      improved: s.formA !== null && s.formB !== null ? s.formB > s.formA : null,
      gain:     s.formA !== null && s.formB !== null ? Math.round((s.formB - s.formA) * 10) / 10 : null,
    }));
    const withBoth = scholars.filter(s => s.improved !== null);
    const pctImproved = withBoth.length ? pct(withBoth.filter(s => s.improved).length, withBoth.length) : null;
    return { total: scholars.length, withBoth: withBoth.length, pctImproved, scholars };
  }

  // Service interruption sessions with date/reason detail
  function computeSIDetails(attRows) {
    const SI_PATTERNS = ['Absent; Not Covered (Tutor not available)', 'Tutor Left Early (no sub)', 'Absent; Not Covered'];
    return attRows.filter(r => {
      const status = (r['Attendance Status'] || r['Status'] || '').trim();
      return SI_PATTERNS.some(p => status.includes(p));
    }).map(r => ({
      date:   r['Session Date'] || r['Date'] || r['Sess Date'] || '',
      status: r['Attendance Status'] || r['Status'] || '',
      reason: r['Absence Reason'] || r['Miss Reason'] || '',
      school: r['School'] || r['Site'] || '',
    }));
  }

  // Scholar survey rows that need attention (any dimension avg < 3.0 for a scholar)
  function computeSurveyAttention(stuRows) {
    const parseV = v => { const n = parseFloat(v); return isNaN(n) ? null : n; };
    const scholarSurveys = {};
    stuRows.forEach(r => {
      const scholar = r['User'] || r['Scholar Name'] || r['Student Name'] || '';
      const key = normName(scholar);
      if (!key) return;
      if (!scholarSurveys[key]) scholarSurveys[key] = { name: scholar, scores: [] };
      const conf  = parseV(r['How confident do you feel about what you are learning?']);
      const enj   = parseV(r['How much did you enjoy this session with <aboutName>?'] || r['How much did you enjoy this session with &lt;aboutName&gt;?']);
      const learn = parseV(r['How much did you learn in this session?']);
      const ovr   = parseV(r['How would you rate this session overall?']);
      const vals  = [conf, enj, learn, ovr].filter(v => v !== null);
      if (vals.length) scholarSurveys[key].scores.push(...vals);
    });
    return Object.values(scholarSurveys)
      .map(s => ({ name: s.name, avg: s.scores.length ? Math.round(s.scores.reduce((a,b)=>a+b,0)/s.scores.length*10)/10 : null, count: s.scores.length }))
      .filter(s => s.avg !== null && s.avg < 3.0)
      .sort((a,b) => a.avg - b.avg);
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
  function renderBadge(tapData, tapLoaded) {
    if (!tapData) {
      // Only show "Not Enrolled" when TAP roster data is confirmed loaded — not when unavailable
      return tapLoaded ? `<span class="njtc-badge njtc-badge-none">Not Enrolled</span>` : '';
    }
    const status = (tapData['Apprentice Program Status'] || tapData['K'] || '').trim();
    if (/active/i.test(status))           return `<span class="njtc-badge njtc-badge-active">TAP Active</span>`;
    if (/prior|complete|graduate/i.test(status)) return `<span class="njtc-badge njtc-badge-prior">TAP Prior</span>`;
    return tapLoaded ? `<span class="njtc-badge njtc-badge-none">Not Enrolled</span>` : '';
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
    const { name, id, role, attMetrics, stuMetrics, irElaMetrics, irMathMetrics, tap, tapLoaded } = tutor;
    const color = avatarColor(id || name);
    const ini = initials(name);
    const badge = renderBadge(tap, tapLoaded);
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
    const { name, id, role, school, attMetrics, stuMetrics, irElaMetrics, irMathMetrics,
            smMetrics, siDetails, surveyAttn, tap, tapLoaded, concerns } = tutor;
    const color = avatarColor(id || name);
    const ini = initials(name);
    const badge = renderBadge(tap, tapLoaded);
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
          <button onclick="(function(){var b=document.getElementById('ojtFormBody_${escHtml(normName(name))}');if(b)b.style.display=b.style.display==='none'?'block':'none';})()"
            style="background:#1C7C8C;color:#fff;border:none;border-radius:6px;padding:6px 14px;font-size:.78rem;font-weight:600;cursor:pointer;margin-top:8px">
            📋 Log OJT Activity
          </button>
        </div>
      `;
    } else {
      tapHtml = '';
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

    // iReady blocks (supports both legacy and 25-26 EOY/Longitudinal)
    function renderIReadyBlock(metrics, subject) {
      const dataLabel = metrics && metrics.is2526
        ? '25–26 EOY / Preliminary'
        : 'Academic Data';
      if (!metrics || metrics.total === 0) {
        return `
          <div class="njtc-section-block">
            <div class="njtc-section-block-title">iReady ${subject} — ${dataLabel}</div>
            <div style="color:#94a3b8;font-size:0.82rem">No iReady data linked to this tutor's scholars.</div>
          </div>
        `;
      }
      const schRows = metrics.scholars.slice(0, 60).map(r => {
        let sName, sGrade, sBase, sSpring, sPct, mvIcon, mvColor;
        if (metrics.is2526) {
          sName   = r.name   || '—';
          sGrade  = r.grade  || '—';
          sBase   = r.basePlacement   || '—';
          sSpring = r.springPlacement || (r.isLongitudinal ? '—' : 'Preliminary');
          sPct    = r.pctTypical > 0 ? r.pctTypical + '%' : '—';
          const bl = placementLevel(r.basePlacement), sl = placementLevel(r.springPlacement);
          mvIcon  = (bl && sl) ? (sl > bl ? '▲' : sl < bl ? '▼' : '=') : '—';
          mvColor = mvIcon === '▲' ? '#10b981' : mvIcon === '▼' ? '#ef4444' : '#94a3b8';
        } else {
          sName   = r['Student Name'] || r['Scholar Name'] || r['Name'] || '—';
          sGrade  = r['Grade'] || '—';
          sBase   = r['Beginning of Year Placement'] || r['BOY Level'] || '—';
          sSpring = r['End of Year Placement'] || r['EOY Level'] || '—';
          sPct    = r['% Typical Growth'] || r['Typical Growth'] || '—';
          mvIcon  = iReadyMovementIcon(r);
          mvColor = mvIcon === '▲' ? '#10b981' : mvIcon === '▼' ? '#ef4444' : '#94a3b8';
        }
        return `<tr>
          <td>${escHtml(sName)}</td><td>${escHtml(sGrade)}</td>
          <td>${escHtml(sBase)}</td><td>${escHtml(sSpring)}</td>
          <td style="color:${mvColor};font-weight:700">${mvIcon}</td>
          <td>${escHtml(String(sPct))}</td>
        </tr>`;
      }).join('');

      return `
        <div class="njtc-section-block">
          <div class="njtc-section-block-title">iReady ${subject} — ${dataLabel}</div>
          <div class="njtc-ir-meta">
            <div class="njtc-ir-stat"><div class="njtc-ir-stat-val" style="color:#10b981">${metrics.pctImproved != null ? metrics.pctImproved+'%' : '—'}</div><div class="njtc-ir-stat-label">Improved</div></div>
            <div class="njtc-ir-stat"><div class="njtc-ir-stat-val" style="color:#94a3b8">${metrics.pctMaintained != null ? metrics.pctMaintained+'%' : '—'}</div><div class="njtc-ir-stat-label">Maintained</div></div>
            <div class="njtc-ir-stat"><div class="njtc-ir-stat-val" style="color:#ef4444">${metrics.pctDeclined != null ? metrics.pctDeclined+'%' : '—'}</div><div class="njtc-ir-stat-label">Declined</div></div>
            <div class="njtc-ir-stat"><div class="njtc-ir-stat-val">${metrics.medGrowth != null ? metrics.medGrowth+'%' : '—'}</div><div class="njtc-ir-stat-label">Med. Growth</div></div>
            ${!metrics.is2526 && metrics.avgGain != null ? `<div class="njtc-ir-stat"><div class="njtc-ir-stat-val">${metrics.avgGain}</div><div class="njtc-ir-stat-label">Avg SS Gain</div></div>` : ''}
          </div>
          ${schRows ? `<div style="overflow-x:auto"><table class="njtc-table">
            <thead><tr><th>Scholar</th><th>Gr</th><th>Baseline</th><th>Current</th><th>Mvmt</th><th>% Growth</th></tr></thead>
            <tbody>${schRows}</tbody></table></div>` : ''}
        </div>
      `;
    }

    // Standards Mastery block (Middlesex STEM only)
    function renderSmBlock(sm) {
      if (!sm) return '';
      return `
        <div class="njtc-section-block">
          <div class="njtc-section-block-title">Standards Mastery (Middlesex STEM)</div>
          <div class="njtc-ir-meta">
            <div class="njtc-ir-stat"><div class="njtc-ir-stat-val">${sm.total}</div><div class="njtc-ir-stat-label">Scholars</div></div>
            <div class="njtc-ir-stat"><div class="njtc-ir-stat-val" style="color:#10b981">${sm.pctImproved != null ? sm.pctImproved+'%' : '—'}</div><div class="njtc-ir-stat-label">Improved</div></div>
          </div>
          <div style="overflow-x:auto"><table class="njtc-table">
            <thead><tr><th>Scholar</th><th>Assessment</th><th>Pre</th><th>Post</th><th>Gain</th></tr></thead>
            <tbody>${sm.scholars.map(s => `<tr>
              <td>${escHtml(s.name)}</td><td>${escHtml(s.assessment)}</td>
              <td>${s.formA != null ? s.formA+'%' : '—'}</td>
              <td>${s.formB != null ? s.formB+'%' : '—'}</td>
              <td style="color:${s.gain > 0 ? '#10b981' : s.gain < 0 ? '#ef4444' : '#94a3b8'}">${s.gain != null ? (s.gain > 0 ? '+' : '') + s.gain + '%' : '—'}</td>
            </tr>`).join('')}</tbody>
          </table></div>
        </div>
      `;
    }

    // Service interruption detail block
    function renderSIBlock(siList) {
      if (!siList || siList.length === 0) return '';
      return `
        <div class="njtc-section-block" style="border-color:#ef444444">
          <div class="njtc-section-block-title" style="color:#ef4444">⚡ Service Interruptions (${siList.length})</div>
          <div style="overflow-x:auto"><table class="njtc-table">
            <thead><tr><th>Date</th><th>Status</th><th>School</th></tr></thead>
            <tbody>${siList.map(s => `<tr>
              <td>${escHtml(s.date)}</td>
              <td>${escHtml(s.status)}</td>
              <td>${escHtml(s.school)}</td>
            </tr>`).join('')}</tbody>
          </table></div>
        </div>
      `;
    }

    // Survey attention block (scholars rating < 3.0)
    function renderSurveyAttnBlock(attn) {
      if (!attn || attn.length === 0) return '';
      return `
        <div class="njtc-section-block" style="border-color:#f59e0b44">
          <div class="njtc-section-block-title" style="color:#f59e0b">⚠ Scholar Feedback — Needs Attention</div>
          <div style="font-size:.75rem;color:#94a3b8;margin-bottom:8px">Scholars averaging below 3.0/5 across survey dimensions</div>
          <div style="overflow-x:auto"><table class="njtc-table">
            <thead><tr><th>Scholar</th><th>Avg Score</th><th>Responses</th></tr></thead>
            <tbody>${attn.map(s => `<tr>
              <td>${escHtml(s.name)}</td>
              <td style="color:#ef4444;font-weight:700">${s.avg}/5</td>
              <td>${s.count}</td>
            </tr>`).join('')}</tbody>
          </table></div>
        </div>
      `;
    }

    const elaHtml  = renderIReadyBlock(irElaMetrics, 'ELA');
    const mathHtml = renderIReadyBlock(irMathMetrics, 'Math');
    const smHtml   = renderSmBlock(smMetrics);
    const siHtml   = renderSIBlock(siDetails);
    const attnHtml = renderSurveyAttnBlock(surveyAttn);

    // ── Notes block (localStorage) ──────────────────────────────────────────
    const noteKey  = 'njtc_note_' + normName(name);
    const noteVal  = (function(){ try { return localStorage.getItem(noteKey) || ''; } catch(e){ return ''; } })();
    const notesHtml = `
      <div class="njtc-section-block" id="notesBlock_${escHtml(normName(name))}">
        <div class="njtc-section-block-title" style="display:flex;justify-content:space-between;align-items:center">
          📝 Leader Notes
          <button onclick="window.NJTCTeam.editNote('${escHtml(name).replace(/'/g,"\\'")}','${noteKey}')"
            style="font-size:.72rem;background:rgba(28,124,140,.15);border:1px solid #1C7C8C44;color:#1C7C8C;padding:3px 10px;border-radius:5px;cursor:pointer">
            ${noteVal ? 'Edit' : '+ Add Note'}
          </button>
        </div>
        <div id="noteDisplay_${escHtml(normName(name))}" style="font-size:.82rem;color:${noteVal ? '#e2e8f0' : '#64748b'};white-space:pre-wrap;margin-top:4px">
          ${noteVal ? escHtml(noteVal) : 'No notes yet. Click to add.'}
        </div>
      </div>
    `;

    // ── OJT Activity Log inline form ─────────────────────────────────────────
    const ojtFormId = '1MOsppwhQmagAhVSHs29Ms4o9Ky4xYOyqy8Qs4uTrwbQ';
    const leaderEmail = (window.NJTC_USER_PROFILE && window.NJTC_USER_PROFILE.email) || '';
    const leaderName2 = (window.NJTC_USER_PROFILE && window.NJTC_USER_PROFILE.name)  || '';
    const safeName = escHtml(name).replace(/'/g,"\\'");
    const ojtFormHtml = `
      <div class="njtc-section-block" style="border-color:#1C7C8C44">
        <div class="njtc-section-block-title" style="display:flex;justify-content:space-between;align-items:center">
          📋 Log OJT Activity
          <button onclick="document.getElementById('ojtFormBody_${escHtml(normName(name))}').style.display=document.getElementById('ojtFormBody_${escHtml(normName(name))}').style.display==='none'?'block':'none'"
            style="font-size:.72rem;background:rgba(28,124,140,.15);border:1px solid #1C7C8C44;color:#1C7C8C;padding:3px 10px;border-radius:5px;cursor:pointer">
            Toggle Form
          </button>
        </div>
        <div id="ojtFormBody_${escHtml(normName(name))}" style="display:none;margin-top:10px">
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px">
            <div>
              <label style="font-size:.7rem;color:#94a3b8;display:block;margin-bottom:2px">Apprentice Name</label>
              <input id="ojt_name_${escHtml(normName(name))}" value="${escHtml(name)}" readonly
                style="width:100%;background:#0f172a;border:1px solid #334155;border-radius:5px;color:#e2e8f0;padding:5px 8px;font-size:.8rem">
            </div>
            <div>
              <label style="font-size:.7rem;color:#94a3b8;display:block;margin-bottom:2px">Phase</label>
              <select id="ojt_phase_${escHtml(normName(name))}"
                style="width:100%;background:#0f172a;border:1px solid #334155;border-radius:5px;color:#e2e8f0;padding:5px 8px;font-size:.8rem">
                <option value="">Select phase…</option>
                <option value="Phase 1 — Beginning">Phase 1 — Beginning</option>
                <option value="Phase 2 — Middle">Phase 2 — Middle</option>
                <option value="Phase 3 — End">Phase 3 — End</option>
              </select>
            </div>
            <div>
              <label style="font-size:.7rem;color:#94a3b8;display:block;margin-bottom:2px">Domain</label>
              <input id="ojt_domain_${escHtml(normName(name))}" placeholder="e.g. Instructional Delivery"
                style="width:100%;background:#0f172a;border:1px solid #334155;border-radius:5px;color:#e2e8f0;padding:5px 8px;font-size:.8rem">
            </div>
            <div>
              <label style="font-size:.7rem;color:#94a3b8;display:block;margin-bottom:2px">Completed?</label>
              <select id="ojt_completed_${escHtml(normName(name))}"
                style="width:100%;background:#0f172a;border:1px solid #334155;border-radius:5px;color:#e2e8f0;padding:5px 8px;font-size:.8rem">
                <option value="Yes">Yes</option>
                <option value="No">No — In Progress</option>
              </select>
            </div>
            <div>
              <label style="font-size:.7rem;color:#94a3b8;display:block;margin-bottom:2px">Hours Logged</label>
              <input id="ojt_hours_${escHtml(normName(name))}" type="number" min="0" step="0.5" placeholder="e.g. 2"
                style="width:100%;background:#0f172a;border:1px solid #334155;border-radius:5px;color:#e2e8f0;padding:5px 8px;font-size:.8rem">
            </div>
            <div>
              <label style="font-size:.7rem;color:#94a3b8;display:block;margin-bottom:2px">Observer Email</label>
              <input id="ojt_email_${escHtml(normName(name))}" type="email" value="${escHtml(leaderEmail)}" placeholder="observer@njtc.org"
                style="width:100%;background:#0f172a;border:1px solid #334155;border-radius:5px;color:#e2e8f0;padding:5px 8px;font-size:.8rem">
            </div>
          </div>
          <div style="margin-bottom:8px">
            <label style="font-size:.7rem;color:#94a3b8;display:block;margin-bottom:2px">Activity Description</label>
            <textarea id="ojt_activity_${escHtml(normName(name))}" rows="2" placeholder="Describe the OJT activity completed…"
              style="width:100%;background:#0f172a;border:1px solid #334155;border-radius:5px;color:#e2e8f0;padding:5px 8px;font-size:.8rem;resize:vertical"></textarea>
          </div>
          <div style="margin-bottom:10px">
            <label style="font-size:.7rem;color:#94a3b8;display:block;margin-bottom:2px">Additional Notes</label>
            <textarea id="ojt_notes_${escHtml(normName(name))}" rows="2" placeholder="Optional notes…"
              style="width:100%;background:#0f172a;border:1px solid #334155;border-radius:5px;color:#e2e8f0;padding:5px 8px;font-size:.8rem;resize:vertical"></textarea>
          </div>
          <div style="display:flex;gap:8px;align-items:center">
            <button onclick="window.NJTCTeam.submitOJT('${safeName}','${ojtFormId}')"
              style="background:#1C7C8C;color:#fff;border:none;border-radius:6px;padding:7px 18px;font-size:.8rem;font-weight:600;cursor:pointer">
              Submit OJT Log
            </button>
            <span id="ojt_status_${escHtml(normName(name))}" style="font-size:.75rem;color:#94a3b8"></span>
          </div>
        </div>
      </div>
    `;

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
        ${notesHtml}
        ${ojtFormHtml}
        <hr class="njtc-divider">
        ${concernsHtml}
        ${tapHtml}
        ${pearlHtml}
        ${siHtml}
        <hr class="njtc-divider">
        ${surveyHtml}
        ${attnHtml}
        <hr class="njtc-divider">
        ${elaHtml}
        ${mathHtml}
        ${smHtml}
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

    // Pearl STU uses "Filled For" for the tutor's name — add any tutors present in STU but missing from ATT
    data.stu.forEach(r => {
      const tutorName = (r['Filled For'] || r['Tutor Name'] || '').trim();
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
      // STU sheet: "Filled For" = tutor name; "User" = student login (scholar Pearl ID)
      const myStuRows = data.stu.filter(r => normName(r['Filled For'] || r['Tutor Name'] || '') === tn);

      // Scholar matching: Pearl "User" (student login) for ID-based match + name-based match
      const scholarIds   = new Set(myStuRows.map(r => (r['User'] || '').trim()).filter(Boolean));
      const scholarNames = new Set(myStuRows.map(r => normName(r['User'] || r['Scholar Name'] || r['Student Name'] || '')).filter(Boolean));

      function matchScholar(r) {
        const sid  = (r['Student ID'] || r['Student Id'] || '').trim();
        const snam = normName(r['Student Name'] || r['Scholar Name'] || r['Name'] || '');
        return (sid && scholarIds.has(sid)) || (snam && scholarNames.has(snam));
      }

      // Legacy iReady (prior year) — kept for fallback
      const myElaRows  = data.irEla.filter(matchScholar);
      const myMathRows = data.irMath.filter(matchScholar);

      // iReady 25-26 EOY Preliminary / Longitudinal
      const my2526Ela  = data.ir2526Ela.filter(matchScholar);
      const my2526Math = data.ir2526Math.filter(matchScholar);

      // Standards Mastery (Middlesex STEM)
      const tutorSchoolNorm = normName(t.school || '');
      const isSMTutor = [...SM_SCHOOLS].some(s => tutorSchoolNorm.includes(s));

      const attMetrics    = computeAttMetrics(myAttRows);
      const stuMetrics    = computeStuMetrics(myStuRows);
      // Prefer 25-26 data; fall back to legacy if 25-26 is empty
      const irElaMetrics  = computeIReadyMetrics(my2526Ela.length  ? my2526Ela  : myElaRows,  !!my2526Ela.length);
      const irMathMetrics = computeIReadyMetrics(my2526Math.length ? my2526Math : myMathRows, !!my2526Math.length);
      const smMetrics     = isSMTutor ? computeSmMetrics(data.sm, t.name) : null;
      const siDetails     = computeSIDetails(myAttRows);
      const surveyAttn    = computeSurveyAttention(myStuRows);
      const tap           = getTapForTutor(data.tap, t.name);
      const tapLoaded     = data.tapLoaded;
      const concerns      = getConcernsForTutor(data.concerns, t.name);

      return { ...t, attMetrics, stuMetrics, irElaMetrics, irMathMetrics, smMetrics, siDetails, surveyAttn, tap, tapLoaded, concerns };
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
  /* ─────────────────────────────────────────────
     NOTES — localStorage per tutor
  ───────────────────────────────────────────── */
  function editNote(tutorName, noteKey) {
    const displayId = 'noteDisplay_' + normName(tutorName);
    const display   = document.getElementById(displayId);
    if (!display) return;

    const current = (function(){ try { return localStorage.getItem(noteKey) || ''; } catch(e){ return ''; } })();

    const editId = 'noteEdit_' + normName(tutorName);
    if (document.getElementById(editId)) {
      document.getElementById(editId).remove();
      return;
    }

    const wrap = document.createElement('div');
    wrap.id = editId;
    wrap.style.cssText = 'margin-top:8px';
    wrap.innerHTML = `
      <textarea id="noteTA_${escHtml(normName(tutorName))}" rows="4"
        style="width:100%;background:#0f172a;border:1px solid #334155;border-radius:5px;color:#e2e8f0;padding:6px 8px;font-size:.82rem;resize:vertical"
      >${escHtml(current)}</textarea>
      <div style="display:flex;gap:8px;margin-top:6px">
        <button onclick="window.NJTCTeam.saveNote('${escHtml(tutorName).replace(/'/g,"\\'")}','${noteKey}')"
          style="background:#1C7C8C;color:#fff;border:none;border-radius:5px;padding:5px 14px;font-size:.78rem;cursor:pointer">Save</button>
        <button onclick="document.getElementById('${editId}').remove()"
          style="background:transparent;border:1px solid #334155;color:#94a3b8;border-radius:5px;padding:5px 14px;font-size:.78rem;cursor:pointer">Cancel</button>
      </div>
    `;
    display.after(wrap);
    document.getElementById('noteTA_' + normName(tutorName)).focus();
  }

  function saveNote(tutorName, noteKey) {
    const ta = document.getElementById('noteTA_' + normName(tutorName));
    if (!ta) return;
    const val = ta.value.trim();
    try { if (val) localStorage.setItem(noteKey, val); else localStorage.removeItem(noteKey); } catch(e){}
    const display = document.getElementById('noteDisplay_' + normName(tutorName));
    if (display) {
      display.style.color = val ? '#e2e8f0' : '#64748b';
      display.textContent = val || 'No notes yet. Click to add.';
    }
    const editEl = document.getElementById('noteEdit_' + normName(tutorName));
    if (editEl) editEl.remove();
    // Update button text
    const block = document.getElementById('notesBlock_' + normName(tutorName));
    if (block) {
      const btn = block.querySelector('button');
      if (btn) btn.textContent = val ? 'Edit' : '+ Add Note';
    }
  }

  /* ─────────────────────────────────────────────
     OJT FORM SUBMISSION
  ───────────────────────────────────────────── */
  async function submitOJT(tutorName, formId) {
    const k     = normName(tutorName);
    const statusEl = document.getElementById('ojt_status_' + k);
    const get   = id => { const el = document.getElementById(id + '_' + k); return el ? el.value.trim() : ''; };

    const apprenticeName = get('ojt_name');
    const phase          = get('ojt_phase');
    const domain         = get('ojt_domain');
    const activity       = get('ojt_activity');
    const completed      = get('ojt_completed');
    const hours          = get('ojt_hours');
    const obsEmail       = get('ojt_email');
    const notes          = get('ojt_notes');

    if (!phase || !domain || !activity) {
      if (statusEl) statusEl.textContent = '⚠ Please fill in Phase, Domain, and Activity.';
      return;
    }

    if (statusEl) statusEl.textContent = 'Submitting…';

    // Submit to Google Form via no-cors (response unreadable but form accepts it)
    const endpoint = `https://docs.google.com/forms/d/${formId}/formResponse`;
    const body     = new URLSearchParams({
      'entry.1113592438': apprenticeName,
      'entry.2084410404': phase,
      'entry.1916953177': domain,
      'entry.1818518596': activity + (hours ? ` [${hours} hrs]` : '') + (notes ? ` | Notes: ${notes}` : ''),
      'entry.338482221':  completed,
    });

    try {
      await fetch(endpoint, { method: 'POST', body, mode: 'no-cors' });
    } catch(e) {
      // no-cors fetch always "fails" from JS perspective — that's expected
    }

    // Store locally for reference
    try {
      const logKey  = 'njtc_ojt_log_' + k;
      const existing = JSON.parse(localStorage.getItem(logKey) || '[]');
      existing.unshift({
        ts:       new Date().toISOString(),
        phase, domain, activity, completed,
        hours:    hours || '—',
        obsEmail: obsEmail || '—',
        notes:    notes || '',
      });
      localStorage.setItem(logKey, JSON.stringify(existing.slice(0, 50)));
    } catch(e) {}

    if (statusEl) {
      statusEl.style.color = '#34d399';
      statusEl.textContent = '✓ Submitted! Entry sent to OJT Activity Log.';
    }

    // Clear form fields
    ['ojt_phase','ojt_domain','ojt_activity','ojt_hours','ojt_notes'].forEach(id => {
      const el = document.getElementById(id + '_' + k);
      if (el) el.value = '';
    });

    setTimeout(() => { if (statusEl) statusEl.textContent = ''; }, 5000);
  }

  window.NJTCTeam = { build, openDetail, closeDetail, refresh, editNote, saveNote, submitOJT };

})();
