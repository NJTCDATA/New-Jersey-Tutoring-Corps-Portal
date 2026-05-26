/* ============================================================================
   NJTC APPRENTICE IMPACT REPORT MODULE  (SY 25-26)
   Combines Pearl Operations Data + iReady EOY/MOY Academic Data for all
   30 TAP apprentices.

   Data source rules:
     • iLearn schools      → MOY (Winter 2026) Google Sheet
     • All other schools   → EOY Preliminary via window.irlab.getAllRows()
     • Middlesex STEM      → Standards Mastery (no iReady data; surveys only)
     • CJCP + Hamilton     → EOY Preliminary (auto-populates when data arrives)
     • Gloucester ELA      → EOY Preliminary via window.irlab (pulled by district)
   ============================================================================ */

(function () {
  'use strict';

  // ── Panel root ────────────────────────────────────────────────────────────
  const ROOT_ID = 'apprImpactRoot';

  // ── Pearl Published CSV ───────────────────────────────────────────────────
  const PEARL_BASE = '2PACX-1vQ1iC8NZFJt3iinGUEqftKtP32N43axi_JN_RQI36EBUdhZS0PaZRwd-1AJT3bEVe6cqHA0tCA3vb5K';
  const PEARL_URL  = gid => `https://docs.google.com/spreadsheets/d/e/${PEARL_BASE}/pub?output=csv&gid=${gid}`;
  const ATT_GID  = 702726038;
  const STU_GID  = 1245403832;

  // ATT column indexes
  const ATT = { USER:0, ROLE:1, SESSION:2, SESS_STATUS:3, PLAN_START:4,
                SESS_DATE:5, ATT_STATUS:6, MISS_REASON:7, GRADE:8,
                SEX:9, RACE:10, SCHOOL:11, DISTRICT:12, USER_ID:13,
                IND_ATT_RATE:14, STU_ATT_CNT:19, STU_MISS_CNT:20,
                INST_ATT_CNT:21, INST_MISS_CNT:22 };

  // STU column indexes
  const STU = { FILLED_BY:0, FILLED_FOR:1, CONFIDENCE:2, ENJOYMENT:3,
                LEARNING:4, OVERALL:5, COMMENT:6, DATE:7, SCHOOL:8,
                DISTRICT:9, REGION:10, SESS_ID:11 };

  // ── MOY iLearn sheet (Winter 2026) ────────────────────────────────────────
  const MOY_2PACX    = '2PACX-1vQCMey9qbjXf7CFNbK-8Fq-qA0nn-DURIlOVjwQ-U1OwHxSo4PRVOy7eLs0w9JHGtBFwgQTzCqy_sMm';
  const MOY_ELA_GID  = '912997533';
  const MOY_MATH_GID = '186448147';
  const MOY_URL      = gid => `https://docs.google.com/spreadsheets/d/e/${MOY_2PACX}/pub?output=csv&gid=${gid}`;

  // ── Placement levels ──────────────────────────────────────────────────────
  const PLACEMENT_ORDER = [
    '3 or More Grade Levels Below',
    '2 Grade Levels Below',
    '1 Grade Level Below',
    'Early On Grade Level',
    'Mid or Above Grade Level',
  ];
  const PLACEMENT_IDX = {};
  PLACEMENT_ORDER.forEach((p, i) => { PLACEMENT_IDX[p] = i; });

  function normPlacement(raw) {
    if (!raw) return '';
    const map = {
      '3+ grade levels below':        '3 or More Grade Levels Below',
      '3 or more grade levels below': '3 or More Grade Levels Below',
      '2 grade levels below':         '2 Grade Levels Below',
      '1 grade level below':          '1 Grade Level Below',
      'early on grade level':         'Early On Grade Level',
      'mid or above grade level':     'Mid or Above Grade Level',
      'on or above grade level':      'Mid or Above Grade Level',
      'at or above grade level':      'Mid or Above Grade Level',
    };
    return map[raw.trim().toLowerCase()] || raw.trim();
  }

  // ── Master apprentice roster (SY 25-26) ──────────────────────────────────
  // Fields: [displayName, njId, schoolRaw, region, surveyName]
  const TAP_APPRENTICES = [
    ['Alexandra Cristescu',     'NJ2026000468', 'Penns Grove',                 'SW', 'Alexandra Cristescu'],
    ['Aliviyah Goodson',        'NJ2025004253', 'iLearn Bergen MS',            'NE', 'Aliviyah Goodson'],
    ['Apollo Monroy-Polanco',   'NJ2025004827', 'Middlesex STEM',              'NE', 'Apollo Monroy-Polanco'],
    ['Arelis Rodriguez',        'NJ2025003378', 'iLearn Bergen MS',            'NE', 'Arelis Rodriguez'],
    ['Avani Jimenez',           'NJ2026001278', 'Middlesex STEM',              'NE', 'Avani Jimenez'],
    ['Caitlin Evgeniadis',      'NJ2025001715', 'Hamilton Township',           'SW', 'Caitlin Evgeniadis'],
    ['Carla Borbon',            'NJ2026000857', 'Middlesex STEM',              'NE', 'Carla Borbon'],
    ['Carlos Jacho',            'NJ2025004966', 'iLearn Paterson',             'NE', 'Carlos Jacho'],
    ['Ian Anderson',            'NJ2025004964', 'iLearn Hudson MS',            'NE', 'Ian Anderson'],
    ['Jasmine Ramsey-Copeland', 'NJ2025001829', 'iLearn Passaic MS',           'NE', 'Jasmine Ramsey'],
    ['Jazmin Garcia',           'NJ2026001279', 'iLearn Bergen MS',            'NE', 'Jazmin Garcia'],
    ['Jessica Flores',          'NJ2025001718', 'iLearn Passaic MS',           'NE', 'Jessica Flores'],
    ['Katherine R. Davis',      'NJ2025005330', 'Hamilton Township',           'SW', 'Katie Rose Davis'],
    ['Katrina Valentin',        'NJ2025001719', 'Gloucester',                  'SW', 'Katrina Valentin'],
    ['Keisha Lopez',            'NJ2026000470', 'iLearn Clifton',              'NE', 'Keisha Lopez'],
    ['Lilia Quintero',          'NJ2026000471', 'Hamilton-Kuser',              'SW', 'Lilia Quintero'],
    ['Linda Fenty',             'NJ2026000858', 'iLearn Paterson MS',          'NE', 'Linda Fenty'],
    ['Maria Del Carmen',        'NJ2025005329', 'iLearn Passaic ES',           'NE', 'Maria (Mary Carmen) Gutierrez'],
    ['Melissa Mazza',           'NJ2026001277', 'iLearn Bergen MS',            'NE', 'Melissa Mazza'],
    ['Micaela Wilkerson',       'NJ2025004825', 'Haddon Township',             'SW', 'Caela Wilkerson'],
    ['Mushana Dunham',          'NJ2025005331', 'iLearn Clifton MS',           'NE', 'Mushana Dunham'],
    ['Naima Boutira',           'NJ2025005328', 'Central Jersey College Prep', 'NE', 'Naima Boutira'],
    ['Nicholas Hoover',         'NJ2025001712', 'Haddon Township',             'SW', 'Nicholas Hoover'],
    ['Norelis Ramirez',         'NJ2026000265', 'iLearn Paterson -ES',         'NE', 'Norelis Ramirez'],
    ['Pooja Tyagi',             'NJ2025001716', 'Central Jersey College Prep', 'NE', 'Pooja Tyagi'],
    ['Dr. Renee Davis',         'NJ2025004829', 'iLearn Clifton MS',           'NE', 'Renee Davis'],
    ['Shahzeeb Ahmad',          'NJ2025004822', 'iLearn Bergen',               'NE', 'Shahzeeb Ahmad'],
    ['Sharon K Kessel',         'NJ2025001707', 'iLearn Paterson Silk City',   'NE', 'Sharon K Kessel'],
    ['Subul Sadiq',             'NJ2026000469', 'iLearn Hudson',               'NE', 'Subul Sadiq'],
    ['Theodore Mills',          'NJ2025004828', 'Long Term Sub',               'NE', 'Theodore Mills'],
  ];

  // Schools using Standards Mastery — no iReady academic data
  const STANDARDS_MASTERY_SCHOOLS = new Set(['Middlesex STEM']);

  // Schools with no iReady data available
  const NO_DATA_SCHOOLS = new Set(['Long Term Sub']);

  // iLearn schools → use MOY Google Sheet
  const ILEARN_SCHOOLS = new Set([
    'iLearn Bergen MS', 'iLearn Bergen', 'iLearn Passaic MS', 'iLearn Passaic ES',
    'iLearn Paterson', 'iLearn Paterson MS', 'iLearn Paterson -ES',
    'iLearn Paterson Silk City', 'iLearn Hudson MS', 'iLearn Hudson',
    'iLearn Clifton', 'iLearn Clifton MS',
  ]);

  // EOY Preliminary schools → filter IRLAB by district/school keywords
  // Note: Hamilton-Kuser is a sub-school of Hamilton Township — same district filter
  const EOY_DISTRICT_FILTERS = {
    'Gloucester':                 r => (r.district || '').toLowerCase().includes('gloucester township'),
    'Penns Grove':                r => (r.district || '').toLowerCase().includes('penns grove') ||
                                       (r.district || '').toLowerCase().includes('carneys point'),
    'Hamilton Township':          r => (r.district || '').toLowerCase().includes('hamilton township') ||
                                       (r.school   || '').toLowerCase().includes('kuser') ||
                                       (r.school   || '').toLowerCase().includes('crockett') ||
                                       (r.school   || '').toLowerCase().includes('greenwood') ||
                                       (r.school   || '').toLowerCase().includes('wilson'),
    'Hamilton-Kuser':             r => (r.school || '').toLowerCase().includes('kuser'),
    'Haddon Township':            r => (r.district || '').toLowerCase().includes('haddon township') ||
                                       (r.district || '').toLowerCase().includes('haddon twp'),
    'Central Jersey College Prep':r => (r.school || '').toLowerCase().includes('central jersey') ||
                                       (r.district || '').toLowerCase().includes('central jersey'),
  };

  // MOY school name mapping: TAP raw → iReady MOY CSV school names (case-insensitive match)
  const MOY_SCHOOL_MAP = {
    'iLearn Bergen MS':          ['bergen middle school'],
    'iLearn Bergen':             ['bergen middle school', 'bergen ascs elementary'],
    'iLearn Passaic MS':         ['passaic middle'],
    'iLearn Passaic ES':         ['passaic elementary', 'passaic clifton elementary'],
    'iLearn Paterson':           ['paterson arts and science charter school middle',
                                  'paterson arts and science charter school elementary'],
    'iLearn Paterson MS':        ['paterson arts and science charter school middle'],
    'iLearn Paterson -ES':       ['paterson arts and science charter school elementary'],
    'iLearn Paterson Silk City': ['paterson silk city primary'],
    'iLearn Hudson MS':          ['hudson middle school'],
    'iLearn Hudson':             ['hudson ascs elementary', 'hudson middle school'],
    'iLearn Clifton':            ['clifton high', 'passaic clifton middle', 'passaic clifton elementary'],
    'iLearn Clifton MS':         ['passaic clifton middle', 'clifton high'],
  };

  // Build multi-apprentice school set (school attribution ambiguous)
  const _schoolApprCount = {};
  TAP_APPRENTICES.forEach(([,, school]) => {
    _schoolApprCount[school] = (_schoolApprCount[school] || 0) + 1;
  });
  const MULTI_APPR_SCHOOLS = new Set(
    Object.entries(_schoolApprCount).filter(([, n]) => n > 1).map(([s]) => s)
  );

  // ── Helpers ───────────────────────────────────────────────────────────────
  function normName(n) {
    if (!n) return '';
    return n.trim().toLowerCase().replace(/^dr\.?\s+/, '').replace(/\s+/g, ' ');
  }

  // Build lookup: normalized survey name / display name → display name
  function buildApprLookup() {
    const lut = {};
    TAP_APPRENTICES.forEach(([display,, , , surveyName]) => {
      lut[normName(surveyName)] = display;
      lut[normName(display)]   = display;
    });
    // Extra aliases from training-development.js NAME_ALIASES
    const aliases = {
      'jasmine ramsey':         'Jasmine Ramsey-Copeland',
      'caela wilkerson':        'Micaela Wilkerson',
      'katie rose davis':       'Katherine R. Davis',
      'mary carmen':            'Maria Del Carmen',
      'mary carmen gutierrez':  'Maria Del Carmen',
      'renee davis':            'Dr. Renee Davis',
      'la shanee davis':        'Dr. Renee Davis',
      'caitlyn evgeniadis':     'Caitlin Evgeniadis',
      'caitlyn evegeniadis':    'Caitlin Evgeniadis',
      'subul saadiq':           'Subul Sadiq',
      'shahzaeb ahmad':         'Shahzeeb Ahmad',
      'shazaeb ahmad':          'Shahzeeb Ahmad',
      'sharon kessel':          'Sharon K Kessel',
    };
    Object.assign(lut, aliases);
    return lut;
  }

  function resolveAppr(raw, lut) {
    if (!raw) return null;
    const n = normName(raw);
    if (lut[n]) return lut[n];
    // Partial first+last match
    const nParts = n.split(' ');
    if (nParts.length >= 2) {
      for (const [key, canon] of Object.entries(lut)) {
        const kp = key.split(' ');
        if (kp.length >= 2 && kp[0] === nParts[0] && kp[kp.length-1] === nParts[nParts.length-1])
          return canon;
      }
    }
    return null;
  }

  function avg(arr) {
    const v = arr.filter(x => x !== null && !isNaN(x));
    return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
  }

  function median(arr) {
    const v = arr.filter(x => x !== null && !isNaN(x)).sort((a, b) => a - b);
    if (!v.length) return null;
    const m = Math.floor(v.length / 2);
    return v.length % 2 ? v[m] : (v[m-1] + v[m]) / 2;
  }

  function fmt1(v) { return v !== null && !isNaN(v) ? v.toFixed(1) : ''; }
  function fmt0(v) { return v !== null && !isNaN(v) ? Math.round(v).toString() : ''; }
  function fmtPct(v) { return v !== null && !isNaN(v) ? (v * 100).toFixed(1) + '%' : ''; }

  // ── CSV parsing ───────────────────────────────────────────────────────────
  function parseCsv(text) {
    if (!text || !text.trim()) return [];
    const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
    if (!lines.length) return [];
    const parseRow = line => {
      const cells = [];
      let cur = '', inQ = false;
      for (let i = 0; i < line.length; i++) {
        const c = line[i];
        if (inQ) {
          if (c === '"' && line[i+1] === '"') { cur += '"'; i++; }
          else if (c === '"') inQ = false;
          else cur += c;
        } else {
          if (c === '"') inQ = true;
          else if (c === ',') { cells.push(cur); cur = ''; }
          else cur += c;
        }
      }
      cells.push(cur);
      return cells;
    };
    const hdrRow = parseRow(lines[0]);
    const rows = [];
    for (let i = 1; i < lines.length; i++) {
      if (!lines[i].trim()) continue;
      const vals = parseRow(lines[i]);
      const obj = {};
      hdrRow.forEach((h, idx) => { obj[h] = (vals[idx] || '').trim(); });
      rows.push(obj);
    }
    return rows;
  }

  // ── Fetch with 5-min cache ────────────────────────────────────────────────
  const _fetchCache = {};
  async function cachedFetch(url, label) {
    const now = Date.now();
    if (_fetchCache[url] && (now - _fetchCache[url].ts) < 5 * 60 * 1000)
      return _fetchCache[url].text;
    setStatus(`Fetching ${label}…`);
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`HTTP ${resp.status} fetching ${label}`);
    const text = await resp.text();
    _fetchCache[url] = { text, ts: now };
    return text;
  }

  // ── MOY CSV normalization ─────────────────────────────────────────────────
  function normMoyRow(r) {
    // Header normalization: lowercase + non-alnum→underscore
    const rn = {};
    for (const k of Object.keys(r)) {
      const lk = k.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
      rn[lk] = r[k];
    }
    const g = (...keys) => {
      for (const k of keys) { if (rn[k] !== undefined && rn[k] !== '') return rn[k]; }
      return '';
    };
    return {
      scholarName:    g('student_name','first_and_last_name','name'),
      scholarId:      g('student_id','local_student_id','id'),
      school:         g('school'),
      district:       g('district'),
      grade:          g('student_grade','grade'),
      instructor:     g('instructor','tutor'),
      boyPlacement:   normPlacement(g('base_overall_relative_placement')),
      boyScore:       parseFloat(g('base_overall_scale_score')) || null,
      moyPlacement:   normPlacement(g('winter_overall_relative_placement')),
      moyScore:       parseFloat(g('winter_overall_scale_score')) || null,
      pctTypical:     (function() {
        const raw = g('winter_pct_progress_typical_growth','winter_pct_toward_typical_growth',
                      'winter_pct_typical','pct_progress_typical_growth');
        let v = parseFloat(raw);
        if (isNaN(v)) return null;
        if (typeof raw === 'string' && raw.trim().slice(-1) === '%') v /= 100;
        else if (v > 15) v /= 100;
        return v;
      }()),
    };
  }

  // ── IRLAB row normalization ───────────────────────────────────────────────
  // window.irlab.getAllRows() already returns normalized objects; map to our schema
  function normIrlabRow(r) {
    return {
      scholarName:    r.scholarName  || '',
      scholarId:      r.scholarId    || '',
      school:         r.school       || '',
      district:       r.district     || '',
      grade:          r.grade        || '',
      instructor:     r.instructor   || '',
      tutors:         r.tutors       || [],
      boyPlacement:   normPlacement(r.baseRelPlacement  || ''),
      boyScore:       r.baseScore    || null,
      eoyPlacement:   normPlacement(r.springRelPlacement || ''),
      eoyScore:       r.springScore  || null,
      pctTypical:     r.pctTypical   || null,
      subject:        r.subject      || '',
    };
  }

  // ── Status helpers ────────────────────────────────────────────────────────
  function setStatus(msg) {
    const el = document.getElementById('apirStatus');
    if (el) el.textContent = msg;
  }

  function setProgress(pct) {
    const bar = document.getElementById('apirProgressBar');
    if (bar) bar.style.width = pct + '%';
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  CORE REPORT GENERATOR
  // ══════════════════════════════════════════════════════════════════════════
  async function generateReport() {
    const btn = document.getElementById('apirGenBtn');
    if (btn) { btn.disabled = true; btn.textContent = '⏳ Generating…'; }

    try {
      setStatus('Loading Pearl attendance data…'); setProgress(5);
      const [attText, stuText] = await Promise.all([
        cachedFetch(PEARL_URL(ATT_GID), 'Pearl ATT'),
        cachedFetch(PEARL_URL(STU_GID), 'Pearl STU surveys'),
      ]);

      setStatus('Loading MOY iLearn data…'); setProgress(15);
      const [moyElaText, moyMathText] = await Promise.all([
        cachedFetch(MOY_URL(MOY_ELA_GID), 'MOY ELA'),
        cachedFetch(MOY_URL(MOY_MATH_GID), 'MOY Math'),
      ]);

      setStatus('Processing Pearl surveys…'); setProgress(30);
      const apprLut = buildApprLookup();
      const surveyAgg = processSurveys(parseCsv(stuText), apprLut);

      setStatus('Processing attendance…'); setProgress(40);
      const attAgg = processAttendance(parseCsv(attText), apprLut);

      setStatus('Processing MOY academic data…'); setProgress(55);
      const moyElaRows  = parseCsv(moyElaText).map(normMoyRow);
      const moyMathRows = parseCsv(moyMathText).map(normMoyRow);

      setStatus('Loading EOY Preliminary (IRLAB) data…'); setProgress(65);
      let irlabElaRows = [], irlabMathRows = [];
      if (window.irlab && typeof window.irlab.getAllRows === 'function') {
        irlabElaRows  = window.irlab.getAllRows({subject:'ELA',  year:'all'}).map(normIrlabRow);
        irlabMathRows = window.irlab.getAllRows({subject:'Math', year:'all'}).map(normIrlabRow);
      }

      setStatus('Building apprentice records…'); setProgress(75);
      const report = buildReport(moyElaRows, moyMathRows, irlabElaRows, irlabMathRows,
                                  surveyAgg, attAgg, apprLut);

      setStatus('Generating CSV…'); setProgress(90);
      const csv = buildCsv(report);

      setProgress(100);
      setStatus('Report ready — click Download.');
      renderDownload(csv);

    } catch (err) {
      setStatus('Error: ' + err.message);
      console.error('[APIR] Error generating report:', err);
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = '⚡ Generate Report'; }
    }
  }

  // ── Process student surveys ───────────────────────────────────────────────
  function processSurveys(rows, lut) {
    const agg = {}; // displayName → {conf, enj, learn, overall, count}
    TAP_APPRENTICES.forEach(([d]) => { agg[d] = {conf:[], enj:[], learn:[], overall:[], count:0}; });

    rows.forEach(row => {
      const filledFor = row[Object.keys(row)[STU.FILLED_FOR]] ||
                        row['Filled For'] || row['filled_for'] || '';
      const canon = resolveAppr(filledFor, lut);
      if (!canon || !agg[canon]) return;

      const conf   = parseFloat(row['How confident do you feel about what you are learning?'] ||
                                row[Object.keys(row)[STU.CONFIDENCE]] || '');
      const enj    = parseFloat(row['How much did you enjoy this session with <aboutName>?'] ||
                                row['How much did you enjoy this session with &lt;aboutName&gt;?'] ||
                                row[Object.keys(row)[STU.ENJOYMENT]] || '');
      const learn  = parseFloat(row['How much did you learn in this session?'] ||
                                row[Object.keys(row)[STU.LEARNING]] || '');
      const ovr    = parseFloat(row['How would you rate this session overall?'] ||
                                row[Object.keys(row)[STU.OVERALL]] || '');

      if (!isNaN(conf))  agg[canon].conf.push(conf);
      if (!isNaN(enj))   agg[canon].enj.push(enj);
      if (!isNaN(learn)) agg[canon].learn.push(learn);
      if (!isNaN(ovr))   agg[canon].overall.push(ovr);
      agg[canon].count++;
    });

    // Summarize
    const out = {};
    for (const [name, d] of Object.entries(agg)) {
      out[name] = {
        surveyCount:       d.count,
        avgConfidence:     avg(d.conf),
        avgEnjoyment:      avg(d.enj),
        avgLearning:       avg(d.learn),
        avgOverall:        avg(d.overall),
      };
    }
    return out;
  }

  // ── Process attendance ────────────────────────────────────────────────────
  function processAttendance(rows, lut) {
    // We need instructor rows only; key columns: USER, ROLE, ATT_STATUS
    const agg = {};
    TAP_APPRENTICES.forEach(([d]) => { agg[d] = {attended:0, missed:0}; });

    rows.forEach(row => {
      const keys = Object.keys(row);
      const role = (row['Role'] || row[keys[ATT.ROLE]] || '').trim();
      if (role !== 'Instructor') return;

      const userName = (row['User'] || row[keys[ATT.USER]] || '').trim();
      const canon = resolveAppr(userName, lut);
      if (!canon || !agg[canon]) return;

      const status = (row['Attendance Status'] || row[keys[ATT.ATT_STATUS]] || '').trim().toLowerCase();
      if (status === 'present') agg[canon].attended++;
      else if (status === 'absent') agg[canon].missed++;
    });

    const out = {};
    for (const [name, d] of Object.entries(agg)) {
      const total = d.attended + d.missed;
      out[name] = {
        sessionsAttended: d.attended,
        sessionsMissed:   d.missed,
        totalSessions:    total,
        attRate:          total > 0 ? d.attended / total : null,
      };
    }
    return out;
  }

  // ── Scholar attribution from MOY rows ────────────────────────────────────
  function attributeMoyScholars(moyRows, subject, surveyApprScholarSets) {
    // Returns: displayName → [{...moyRow}]
    const byAppr = {};
    TAP_APPRENTICES.forEach(([d]) => { byAppr[d] = []; });

    // Build school→apprentice map (single-appr only)
    const schoolToAppr = {};
    TAP_APPRENTICES.forEach(([display,, school]) => {
      if (!MULTI_APPR_SCHOOLS.has(school) && !STANDARDS_MASTERY_SCHOOLS.has(school) &&
          !NO_DATA_SCHOOLS.has(school) && ILEARN_SCHOOLS.has(school)) {
        const schoolNames = MOY_SCHOOL_MAP[school] || [];
        schoolNames.forEach(sn => { schoolToAppr[sn] = display; });
      }
    });

    moyRows.forEach(row => {
      const schoolLc = (row.school || '').toLowerCase().trim();

      // Tier 1: instructor field match
      if (row.instructor) {
        const appr = resolveAppr(row.instructor, buildApprLookup());
        if (appr && byAppr[appr]) { byAppr[appr].push(row); return; }
      }

      // Tier 2: school attribution (single-appr schools only)
      const apprBySchool = schoolToAppr[schoolLc];
      if (apprBySchool) { byAppr[apprBySchool].push(row); return; }

      // Tier 3: survey-confirmed scholar set (multi-appr schools)
      if (surveyApprScholarSets) {
        const scholarN = normName(row.scholarName);
        for (const [appr, nameSet] of Object.entries(surveyApprScholarSets)) {
          if (nameSet.has(scholarN)) { byAppr[appr].push(row); return; }
        }
      }
    });
    return byAppr;
  }

  // ── Scholar attribution from IRLAB rows ──────────────────────────────────
  function attributeIrlabScholars(irlabRows, surveyApprScholarSets) {
    const byAppr = {};
    TAP_APPRENTICES.forEach(([d]) => { byAppr[d] = []; });

    TAP_APPRENTICES.forEach(([display,, school]) => {
      if (!EOY_DISTRICT_FILTERS[school]) return; // not an EOY school
      const filterFn = EOY_DISTRICT_FILTERS[school];
      const isMulti = MULTI_APPR_SCHOOLS.has(school);

      irlabRows.forEach(row => {
        if (!filterFn(row)) return;

        // Tier 1: instructor match
        if (row.instructor) {
          const appr = resolveAppr(row.instructor, buildApprLookup());
          if (appr === display) { byAppr[display].push(row); return; }
        }

        // Tier 2: tutor array
        if (row.tutors && row.tutors.length) {
          for (const t of row.tutors) {
            const appr = resolveAppr(t, buildApprLookup());
            if (appr === display) { byAppr[display].push(row); return; }
          }
        }

        // Tier 3: skip if multi-appr school (ambiguous), attribute if single
        if (!isMulti) {
          byAppr[display].push(row);
        } else if (surveyApprScholarSets && surveyApprScholarSets[display]) {
          const scholarN = normName(row.scholarName);
          if (surveyApprScholarSets[display].has(scholarN))
            byAppr[display].push(row);
        }
      });
    });
    return byAppr;
  }

  // ── Build survey-confirmed scholar name sets (for multi-appr disambiguation) ──
  function buildSurveyScholarSets(stuRows, lut) {
    const sets = {};
    TAP_APPRENTICES.forEach(([d]) => { sets[d] = new Set(); });
    stuRows.forEach(row => {
      const filledBy  = row['Filled By']  || row['filled_by']  || '';
      const filledFor = row['Filled For'] || row['filled_for'] || '';
      const canon = resolveAppr(filledFor, lut);
      if (!canon || !sets[canon]) return;
      if (filledBy) sets[canon].add(normName(filledBy));
    });
    return sets;
  }

  // ── Academic aggregation ──────────────────────────────────────────────────
  function aggregateAcademic(rows, dataSource) {
    // dataSource: 'moy' (has boyPlacement/moyPlacement) or 'eoy' (has boyPlacement/eoyPlacement)
    const endField = dataSource === 'moy' ? 'moyPlacement' : 'eoyPlacement';
    const endScore = dataSource === 'moy' ? 'moyScore'     : 'eoyScore';

    const valid = rows.filter(r =>
      PLACEMENT_IDX[r.boyPlacement] !== undefined &&
      PLACEMENT_IDX[r[endField]]    !== undefined
    );

    const n = valid.length;
    if (!n) return {
      scholarCount: rows.length, validCount: 0,
      avgBoyScore: null, avgEndScore: null, avgScoreGain: null,
      medianPctTypical: null, pctMeetTypical: null,
      improved: 0, maintained: 0, declined: 0,
      boyDist: {}, endDist: {},
      dataSource,
    };

    const scores = valid.map(r => ({
      boy: r.boyScore, end: r[endScore], pct: r.pctTypical,
      boyP: r.boyPlacement, endP: r[endField],
    }));

    const boyScores  = scores.map(s => s.boy).filter(v => v !== null);
    const endScores  = scores.map(s => s.end).filter(v => v !== null);
    const pctTyp     = scores.map(s => s.pct).filter(v => v !== null && !isNaN(v));

    const improved   = valid.filter(r => PLACEMENT_IDX[r[endField]] > PLACEMENT_IDX[r.boyPlacement]).length;
    const maintained = valid.filter(r => PLACEMENT_IDX[r[endField]] === PLACEMENT_IDX[r.boyPlacement]).length;
    const declined   = valid.filter(r => PLACEMENT_IDX[r[endField]] < PLACEMENT_IDX[r.boyPlacement]).length;

    const boyDist = {}, endDist = {};
    PLACEMENT_ORDER.forEach(p => { boyDist[p] = 0; endDist[p] = 0; });
    valid.forEach(r => {
      boyDist[r.boyPlacement]++;
      endDist[r[endField]]++;
    });

    return {
      scholarCount:    rows.length,
      validCount:      n,
      avgBoyScore:     avg(boyScores),
      avgEndScore:     avg(endScores),
      avgScoreGain:    (avg(boyScores) !== null && avg(endScores) !== null)
                         ? avg(endScores) - avg(boyScores) : null,
      medianPctTypical: median(pctTyp),
      pctMeetTypical:   pctTyp.length ? pctTyp.filter(v => v >= 1.0).length / pctTyp.length : null,
      improved, maintained, declined,
      boyDist, endDist,
      dataSource,
    };
  }

  // ── Build full report ─────────────────────────────────────────────────────
  function buildReport(moyElaRows, moyMathRows, irlabElaRows, irlabMathRows,
                        surveyAgg, attAgg, apprLut) {
    const stuRowsCached = _fetchCache[PEARL_URL(STU_GID)]
      ? parseCsv(_fetchCache[PEARL_URL(STU_GID)].text) : [];
    const surveyScholarSets = buildSurveyScholarSets(stuRowsCached, apprLut);

    // Attribute scholars
    const moyElaByAppr  = attributeMoyScholars(moyElaRows,  'ELA',  surveyScholarSets);
    const moyMathByAppr = attributeMoyScholars(moyMathRows, 'Math', surveyScholarSets);
    const irlElaByAppr  = attributeIrlabScholars(irlabElaRows,  surveyScholarSets);
    const irlMathByAppr = attributeIrlabScholars(irlabMathRows, surveyScholarSets);

    const records = TAP_APPRENTICES.map(([display, njId, school, region]) => {
      const isMidYr    = ILEARN_SCHOOLS.has(school);
      const isStandMas = STANDARDS_MASTERY_SCHOOLS.has(school);
      const isNoData   = NO_DATA_SCHOOLS.has(school);

      let elaAcad = null, mathAcad = null;
      if (!isStandMas && !isNoData) {
        if (isMidYr) {
          elaAcad  = aggregateAcademic(moyElaByAppr[display]  || [], 'moy');
          mathAcad = aggregateAcademic(moyMathByAppr[display] || [], 'moy');
        } else {
          elaAcad  = aggregateAcademic(irlElaByAppr[display]  || [], 'eoy');
          mathAcad = aggregateAcademic(irlMathByAppr[display] || [], 'eoy');
        }
      }

      return {
        display, njId, school, region,
        dataNote: isStandMas ? 'Standards Mastery (no iReady)' :
                  isNoData   ? 'No iReady data' :
                  isMidYr    ? 'MOY (Winter 2026)' : 'EOY Preliminary',
        ela:  elaAcad,
        math: mathAcad,
        survey: surveyAgg[display] || { surveyCount:0, avgConfidence:null, avgEnjoyment:null, avgLearning:null, avgOverall:null },
        att:    attAgg[display]    || { sessionsAttended:0, sessionsMissed:0, totalSessions:0, attRate:null },
      };
    });

    return records;
  }

  // ── Build CSV ─────────────────────────────────────────────────────────────
  function buildCsv(records) {
    const esc = v => {
      const s = v === null || v === undefined ? '' : String(v);
      return (s.includes(',') || s.includes('"') || s.includes('\n'))
        ? '"' + s.replace(/"/g, '""') + '"' : s;
    };
    const row = (...cells) => cells.map(esc).join(',');

    const lines = [];
    const now = new Date().toLocaleDateString('en-US', {month:'long', day:'numeric', year:'numeric'});
    lines.push(row('NJTC TAP Apprentice Impact Report', 'Generated: ' + now, '', 'Data snapshot: June 5 2026 (EOY Incomplete)'));
    lines.push('');

    // ── SECTION 1: Summary ─────────────────────────────────────────────────
    lines.push(row('=== SECTION 1: APPRENTICE SUMMARY (30 APPRENTICES — SY 25-26) ==='));
    lines.push(row(
      'Apprentice Name', 'NJ DOL ID', 'School / Site', 'Region', 'Data Source',
      // ELA
      'ELA Scholars (Matched)', 'ELA BOY Avg Score', 'ELA End Avg Score', 'ELA Avg Score Gain',
      'ELA Median % Typical Growth', 'ELA % Meeting Typical', 'ELA Improved', 'ELA Maintained', 'ELA Declined',
      // Math
      'Math Scholars (Matched)', 'Math BOY Avg Score', 'Math End Avg Score', 'Math Avg Score Gain',
      'Math Median % Typical Growth', 'Math % Meeting Typical', 'Math Improved', 'Math Maintained', 'Math Declined',
      // Surveys
      'Survey Responses', 'Avg Confidence (1-5)', 'Avg Enjoyment (1-5)', 'Avg Learning (1-5)', 'Avg Overall (1-5)',
      // Attendance
      'Sessions Attended', 'Sessions Missed', 'Total Sessions', 'Attendance Rate'
    ));

    records.forEach(rec => {
      const e = rec.ela, m = rec.math, s = rec.survey, a = rec.att;
      const noAcad = !e && !m;
      lines.push(row(
        rec.display, rec.njId, rec.school, rec.region, rec.dataNote,
        noAcad ? rec.dataNote : fmt0(e && e.validCount),
        noAcad ? '' : fmt1(e && e.avgBoyScore),
        noAcad ? '' : fmt1(e && e.avgEndScore),
        noAcad ? '' : fmt1(e && e.avgScoreGain),
        noAcad ? '' : fmtPct(e && e.medianPctTypical),
        noAcad ? '' : fmtPct(e && e.pctMeetTypical),
        noAcad ? '' : fmt0(e && e.improved),
        noAcad ? '' : fmt0(e && e.maintained),
        noAcad ? '' : fmt0(e && e.declined),
        noAcad ? rec.dataNote : fmt0(m && m.validCount),
        noAcad ? '' : fmt1(m && m.avgBoyScore),
        noAcad ? '' : fmt1(m && m.avgEndScore),
        noAcad ? '' : fmt1(m && m.avgScoreGain),
        noAcad ? '' : fmtPct(m && m.medianPctTypical),
        noAcad ? '' : fmtPct(m && m.pctMeetTypical),
        noAcad ? '' : fmt0(m && m.improved),
        noAcad ? '' : fmt0(m && m.maintained),
        noAcad ? '' : fmt0(m && m.declined),
        s.surveyCount,
        fmt1(s.avgConfidence),
        fmt1(s.avgEnjoyment),
        fmt1(s.avgLearning),
        fmt1(s.avgOverall),
        a.sessionsAttended,
        a.sessionsMissed,
        a.totalSessions,
        fmtPct(a.attRate)
      ));
    });

    lines.push('');

    // ── SECTION 2: Placement distribution per apprentice ──────────────────
    lines.push(row('=== SECTION 2: BOY → END PLACEMENT DISTRIBUTION PER APPRENTICE ==='));
    lines.push(row(
      'Apprentice Name', 'Subject', 'Data Source',
      'BOY: 3+ Below', 'BOY: 2 Below', 'BOY: 1 Below', 'BOY: Early On GL', 'BOY: Mid/Above GL',
      'END: 3+ Below', 'END: 2 Below', 'END: 1 Below', 'END: Early On GL', 'END: Mid/Above GL',
      'Net Placement Change',
    ));

    const distRow = (rec, subj, acad) => {
      if (!acad || !acad.validCount) return null;
      const endLabel = acad.dataSource === 'moy' ? 'MOY' : 'EOY';
      const bd = acad.boyDist, ed = acad.endDist;
      const po = PLACEMENT_ORDER;
      // Net = weighted avg end - weighted avg boy (in placement index units)
      const wAvg = dist => {
        let sum = 0, cnt = 0;
        po.forEach((p, i) => { sum += i * (dist[p] || 0); cnt += (dist[p] || 0); });
        return cnt ? sum / cnt : null;
      };
      const net = (wAvg(ed) !== null && wAvg(bd) !== null) ? (wAvg(ed) - wAvg(bd)).toFixed(2) : '';
      return row(
        rec.display, subj, endLabel,
        bd[po[0]]||0, bd[po[1]]||0, bd[po[2]]||0, bd[po[3]]||0, bd[po[4]]||0,
        ed[po[0]]||0, ed[po[1]]||0, ed[po[2]]||0, ed[po[3]]||0, ed[po[4]]||0,
        net,
      );
    };

    records.forEach(rec => {
      const er = distRow(rec, 'ELA',  rec.ela);
      const mr = distRow(rec, 'Math', rec.math);
      if (er) lines.push(er);
      if (mr) lines.push(mr);
    });

    lines.push('');

    // ── SECTION 3: Program-level aggregate ───────────────────────────────
    lines.push(row('=== SECTION 3: PROGRAM-LEVEL AGGREGATE (ALL TAP APPRENTICES) ==='));
    const allWithData = records.filter(r => r.ela || r.math);

    const aggAll = (getter) => {
      const vals = allWithData.map(getter).filter(v => v !== null && !isNaN(v));
      return avg(vals);
    };
    const elaRecs  = records.filter(r => r.ela  && r.ela.validCount  > 0);
    const mathRecs = records.filter(r => r.math && r.math.validCount > 0);

    const totalElaScholars  = elaRecs.reduce((s, r)  => s + r.ela.validCount,  0);
    const totalMathScholars = mathRecs.reduce((s, r) => s + r.math.validCount, 0);
    const totalElaImproved  = elaRecs.reduce((s, r)  => s + r.ela.improved,   0);
    const totalMathImproved = mathRecs.reduce((s, r) => s + r.math.improved,  0);

    lines.push(row('Metric', 'ELA', 'Math'));
    lines.push(row('Total Scholars with Placement Data', totalElaScholars, totalMathScholars));
    lines.push(row('Avg BOY Scale Score', fmt1(avg(elaRecs.map(r=>r.ela.avgBoyScore).filter(v=>v))),
                                           fmt1(avg(mathRecs.map(r=>r.math.avgBoyScore).filter(v=>v)))));
    lines.push(row('Avg End Scale Score',  fmt1(avg(elaRecs.map(r=>r.ela.avgEndScore).filter(v=>v))),
                                           fmt1(avg(mathRecs.map(r=>r.math.avgEndScore).filter(v=>v)))));
    lines.push(row('Avg Score Gain',       fmt1(avg(elaRecs.map(r=>r.ela.avgScoreGain).filter(v=>v))),
                                           fmt1(avg(mathRecs.map(r=>r.math.avgScoreGain).filter(v=>v)))));
    lines.push(row('Median % Typical Growth',
      fmtPct(median(elaRecs.map(r=>r.ela.medianPctTypical).filter(v=>v!==null))),
      fmtPct(median(mathRecs.map(r=>r.math.medianPctTypical).filter(v=>v!==null)))));
    lines.push(row('Scholars Improved Placement', totalElaImproved, totalMathImproved));
    lines.push(row('% Improved',
      totalElaScholars  ? fmtPct(totalElaImproved  / totalElaScholars)  : '',
      totalMathScholars ? fmtPct(totalMathImproved / totalMathScholars) : ''));

    const totalSurveys   = records.reduce((s, r) => s + r.survey.surveyCount, 0);
    const avgConf        = avg(records.map(r => r.survey.avgConfidence).filter(v => v !== null));
    const avgEnj         = avg(records.map(r => r.survey.avgEnjoyment).filter(v => v !== null));
    const avgLearn       = avg(records.map(r => r.survey.avgLearning).filter(v => v !== null));
    const avgOvr         = avg(records.map(r => r.survey.avgOverall).filter(v => v !== null));
    const totalAtt       = records.reduce((s, r) => s + r.att.sessionsAttended, 0);
    const totalSess      = records.reduce((s, r) => s + r.att.totalSessions, 0);

    lines.push('');
    lines.push(row('Scholar Survey Responses (total)', totalSurveys, ''));
    lines.push(row('Avg Scholar Confidence',   fmt1(avgConf),  ''));
    lines.push(row('Avg Scholar Enjoyment',    fmt1(avgEnj),   ''));
    lines.push(row('Avg Scholar Learning',     fmt1(avgLearn), ''));
    lines.push(row('Avg Scholar Overall',      fmt1(avgOvr),   ''));
    lines.push('');
    lines.push(row('Total Sessions Attended (all apprentices)', totalAtt,  ''));
    lines.push(row('Total Sessions (all)',                       totalSess, ''));
    lines.push(row('Program Attendance Rate',
      totalSess ? fmtPct(totalAtt / totalSess) : '', ''));

    lines.push('');
    lines.push(row('--- Notes ---'));
    lines.push(row('* iLearn schools use MOY (Winter 2026) iReady diagnostic data.'));
    lines.push(row('* All other schools use EOY Preliminary data from the IRLAB (live data via portal).'));
    lines.push(row('* Middlesex STEM apprentices use Standards Mastery — iReady academic data excluded.'));
    lines.push(row('* CJCP and Hamilton Township rows will auto-populate when EOY Preliminary data arrives.'));
    lines.push(row('* Gloucester ELA data sourced from EOY Preliminary IRLAB (Gloucester Township School District).'));
    lines.push(row('* Scholar attribution: (1) instructor name match, (2) single-apprentice school attribution, (3) survey-confirmed scholar name match.'));
    lines.push(row('* Academic data as of June 5 2026 — EOY diagnostics incomplete for some sites.'));

    return '﻿' + lines.join('\n'); // UTF-8 BOM for Excel
  }

  // ── Render download link ──────────────────────────────────────────────────
  function renderDownload(csv) {
    const area = document.getElementById('apirDownloadArea');
    if (!area) return;
    area.innerHTML = '';

    const blob = new Blob([csv], {type: 'text/csv;charset=utf-8;'});
    const url  = URL.createObjectURL(blob);
    const today = new Date().toISOString().slice(0, 10);
    const fname = `NJTC_TAP_Apprentice_Impact_Report_${today}.csv`;

    const a = document.createElement('a');
    a.href       = url;
    a.download   = fname;
    a.className  = 'apir-dl-btn';
    a.innerHTML  = '⬇️ Download CSV Report';
    area.appendChild(a);

    // Also show quick summary stats
    const snap = buildSnapshotHtml(csv);
    const snapDiv = document.createElement('div');
    snapDiv.className = 'apir-snapshot';
    snapDiv.innerHTML = snap;
    area.appendChild(snapDiv);
  }

  function buildSnapshotHtml(csv) {
    // Parse first summary section to show a quick stat strip
    return `<p class="apir-snap-note">✅ Report generated. Click the button above to download the full CSV.</p>`;
  }

  // ── Panel HTML ────────────────────────────────────────────────────────────
  function renderPanel() {
    const root = document.getElementById(ROOT_ID);
    if (!root) return;
    root.innerHTML = `
      <div class="apir-wrap">
        <div class="apir-hero">
          <div class="apir-hero-icon">🎓</div>
          <div class="apir-hero-text">
            <h3>TAP Apprentice Impact Report — SY 25-26</h3>
            <p>Combines Pearl Operations attendance &amp; survey data with iReady academic outcomes
               for all <strong>30 active TAP apprentices</strong>. Generates a three-section CSV:</p>
            <ul>
              <li>📋 <strong>Section 1 — Summary</strong>: academic outcomes, survey averages &amp; attendance per apprentice</li>
              <li>📊 <strong>Section 2 — Placement Distribution</strong>: BOY→EOY/MOY placement movement</li>
              <li>🏆 <strong>Section 3 — Program Aggregate</strong>: program-level impact metrics</li>
            </ul>
            <div class="apir-source-legend">
              <span class="apir-badge apir-badge-moy">MOY</span> iLearn schools (Winter 2026 iReady)
              &nbsp;&nbsp;
              <span class="apir-badge apir-badge-eoy">EOY Prelim</span> All other schools (live IRLAB data)
              &nbsp;&nbsp;
              <span class="apir-badge apir-badge-sm">Standards Mastery</span> Middlesex STEM
            </div>
          </div>
        </div>

        <div class="apir-controls">
          <button id="apirGenBtn" class="apir-gen-btn" onclick="window._apirGenerate()">
            ⚡ Generate Report
          </button>
          <div class="apir-status-row">
            <div class="apir-progress-track">
              <div id="apirProgressBar" class="apir-progress-bar" style="width:0%"></div>
            </div>
            <span id="apirStatus" class="apir-status-text">Ready — click Generate to build the report.</span>
          </div>
        </div>

        <div id="apirDownloadArea" class="apir-dl-area"></div>

        <div class="apir-roster-preview">
          <h4>Apprentice Roster (30 Active TAP Apprentices)</h4>
          <div class="apir-roster-grid" id="apirRosterGrid"></div>
        </div>
      </div>
    `;

    // Render roster cards
    const grid = document.getElementById('apirRosterGrid');
    if (grid) {
      TAP_APPRENTICES.forEach(([display, njId, school, region]) => {
        const badge = STANDARDS_MASTERY_SCHOOLS.has(school) ? 'apir-badge-sm' :
                      NO_DATA_SCHOOLS.has(school)            ? 'apir-badge-nd' :
                      ILEARN_SCHOOLS.has(school)             ? 'apir-badge-moy' : 'apir-badge-eoy';
        const label = STANDARDS_MASTERY_SCHOOLS.has(school) ? 'Std. Mastery' :
                      NO_DATA_SCHOOLS.has(school)            ? 'No Data' :
                      ILEARN_SCHOOLS.has(school)             ? 'MOY' : 'EOY Prelim';
        const card = document.createElement('div');
        card.className = 'apir-card';
        card.innerHTML = `
          <span class="apir-card-region apir-region-${region.toLowerCase()}">${region}</span>
          <div class="apir-card-name">${display}</div>
          <div class="apir-card-school">${school}</div>
          <span class="apir-badge ${badge}">${label}</span>
        `;
        grid.appendChild(card);
      });
    }

    // Expose generate function globally
    window._apirGenerate = generateReport;
  }

  // ── Styles ────────────────────────────────────────────────────────────────
  function injectStyles() {
    if (document.getElementById('apirStyles')) return;
    const s = document.createElement('style');
    s.id = 'apirStyles';
    s.textContent = `
      .apir-wrap { padding: 1.5rem 2rem; max-width: 1200px; }
      .apir-hero { display:flex; gap:1.25rem; align-items:flex-start;
                   background:#f0f9ff; border:1px solid #bae6fd;
                   border-radius:12px; padding:1.25rem 1.5rem; margin-bottom:1.5rem; }
      .apir-hero-icon { font-size:2.5rem; line-height:1; flex-shrink:0; }
      .apir-hero-text h3 { margin:0 0 .4rem; font-size:1.15rem; color:#0c4a6e; }
      .apir-hero-text p  { margin:0 0 .5rem; font-size:.875rem; color:#374151; }
      .apir-hero-text ul { margin:.25rem 0 .75rem 1rem; padding:0;
                           font-size:.85rem; color:#374151; }
      .apir-hero-text li { margin:.2rem 0; }
      .apir-source-legend { font-size:.8rem; color:#6b7280; display:flex;
                            flex-wrap:wrap; gap:.5rem; align-items:center; }
      .apir-badge { display:inline-block; padding:2px 8px; border-radius:10px;
                    font-size:.7rem; font-weight:700; }
      .apir-badge-moy  { background:#dbeafe; color:#1d4ed8; }
      .apir-badge-eoy  { background:#dcfce7; color:#166534; }
      .apir-badge-sm   { background:#fef9c3; color:#854d0e; }
      .apir-badge-nd   { background:#f1f5f9; color:#64748b; }
      .apir-controls { display:flex; flex-direction:column; gap:.75rem; margin-bottom:1.5rem; }
      .apir-gen-btn { display:inline-flex; align-items:center; gap:.5rem;
                      background:linear-gradient(135deg,#2563eb,#4f46e5); color:#fff;
                      border:none; border-radius:8px; padding:.7rem 1.5rem;
                      font-size:1rem; font-weight:700; cursor:pointer;
                      transition:opacity .15s; width:fit-content; }
      .apir-gen-btn:hover { opacity:.9; }
      .apir-gen-btn:disabled { opacity:.5; cursor:not-allowed; }
      .apir-status-row { display:flex; align-items:center; gap:1rem; }
      .apir-progress-track { flex:1; max-width:360px; height:6px;
                              background:#e5e7eb; border-radius:3px; overflow:hidden; }
      .apir-progress-bar   { height:100%; background:#2563eb;
                              transition:width .3s ease; border-radius:3px; }
      .apir-status-text { font-size:.85rem; color:#6b7280; }
      .apir-dl-area { margin-bottom:1.5rem; }
      .apir-dl-btn { display:inline-flex; align-items:center; gap:.5rem;
                     background:#16a34a; color:#fff; border-radius:8px;
                     padding:.65rem 1.4rem; font-size:.95rem; font-weight:700;
                     text-decoration:none; cursor:pointer; margin-right:1rem; }
      .apir-dl-btn:hover { background:#15803d; }
      .apir-snap-note { display:inline-block; margin:.5rem 0;
                        font-size:.875rem; color:#374151;
                        background:#f0fdf4; border:1px solid #bbf7d0;
                        border-radius:6px; padding:.4rem .75rem; }
      .apir-roster-preview h4 { margin:0 0 .75rem; font-size:.95rem;
                                 color:#374151; font-weight:700; }
      .apir-roster-grid { display:grid;
                          grid-template-columns:repeat(auto-fill,minmax(220px,1fr));
                          gap:.625rem; }
      .apir-card { background:#fff; border:1px solid #e5e7eb; border-radius:8px;
                   padding:.625rem .75rem; font-size:.8rem; position:relative; }
      .apir-card-region { position:absolute; top:.5rem; right:.625rem;
                          font-size:.65rem; font-weight:800; }
      .apir-region-ne { color:#7c3aed; }
      .apir-region-sw { color:#ea580c; }
      .apir-card-name   { font-weight:700; color:#111827; margin-bottom:.2rem; }
      .apir-card-school { color:#6b7280; font-size:.75rem; margin-bottom:.35rem; }
    `;
    document.head.appendChild(s);
  }

  // ── Init ──────────────────────────────────────────────────────────────────
  function init() {
    injectStyles();
    const root = document.getElementById(ROOT_ID);
    if (root) {
      renderPanel();
    } else {
      // Panel not yet in DOM — observe for it
      const obs = new MutationObserver(() => {
        if (document.getElementById(ROOT_ID)) {
          obs.disconnect();
          renderPanel();
        }
      });
      obs.observe(document.body, { childList: true, subtree: true });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
