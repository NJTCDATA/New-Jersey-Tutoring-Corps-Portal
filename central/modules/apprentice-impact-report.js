/* ============================================================================
   NJTC APPRENTICE IMPACT REPORT MODULE  (SY 25-26)
   Combines Pearl Operations Data + iReady EOY/MOY Academic Data for all
   30 TAP apprentices.

   Data source rules:
     • iLearn schools      → MOY (Winter 2026) Google Sheet (2PACX published CSV)
     • All other schools   → EOY Preliminary via window.irlab.getAllRows()
     • Middlesex STEM      → Standards Mastery (no iReady data; surveys only)
     • CJCP + Hamilton     → EOY Preliminary (auto-populates when data arrives)
     • Gloucester          → EOY Preliminary filtered by district OR school name
   ============================================================================ */

(function () {
  'use strict';

  const ROOT_ID = 'apprImpactRoot';

  // ── Pearl Published CSV constants ─────────────────────────────────────────
  const PEARL_BASE = '2PACX-1vQ1iC8NZFJt3iinGUEqftKtP32N43axi_JN_RQI36EBUdhZS0PaZRwd-1AJT3bEVe6cqHA0tCA3vb5K';
  const PEARL_URL  = gid => `https://docs.google.com/spreadsheets/d/e/${PEARL_BASE}/pub?output=csv&gid=${gid}`;
  const ATT_GID = 702726038;
  const STU_GID = 1245403832;

  // MOY iLearn sheet (Winter 2026) — published 2PACX CSV
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

  // ── Master Apprentice Roster (SY 25-26) ──────────────────────────────────
  // [displayName, njId, schoolRaw, region, surveyName]
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

  // Schools using Standards Mastery — no iReady academic section
  const STANDARDS_MASTERY_SCHOOLS = new Set(['Middlesex STEM']);
  // Schools with no iReady data available (e.g. long-term sub, untracked)
  const NO_DATA_SCHOOLS = new Set(['Long Term Sub']);

  // iLearn schools → use MOY Google Sheet (Winter 2026)
  const ILEARN_SCHOOLS = new Set([
    'iLearn Bergen MS', 'iLearn Bergen', 'iLearn Passaic MS', 'iLearn Passaic ES',
    'iLearn Paterson', 'iLearn Paterson MS', 'iLearn Paterson -ES',
    'iLearn Paterson Silk City', 'iLearn Hudson MS', 'iLearn Hudson',
    'iLearn Clifton', 'iLearn Clifton MS',
  ]);

  // EOY Preliminary schools → filtered from window.irlab.getAllRows()
  // Matches on district name OR school name (district may be empty in some IRLAB rows)
  const EOY_DISTRICT_FILTERS = {
    'Gloucester': r => {
      const d = (r.district || '').toLowerCase();
      const s = (r.school   || '').toLowerCase();
      return d.includes('gloucester') || s.includes('gloucester') || s.includes('loring flemming');
    },
    'Penns Grove': r => {
      const d = (r.district || '').toLowerCase();
      const s = (r.school   || '').toLowerCase();
      return d.includes('penns grove') || d.includes('carneys point') ||
             s.includes('penns grove') || s.includes('carneys point') ||
             s.includes('field street') || s.includes('carleton');
    },
    'Hamilton Township': r => {
      const d = (r.district || '').toLowerCase();
      const s = (r.school   || '').toLowerCase();
      return d.includes('hamilton township') ||
             (s.includes('kuser')     && (d.includes('hamilton') || !d)) ||
             (s.includes('crockett')  && (d.includes('hamilton') || !d)) ||
             (s.includes('greenwood') && (d.includes('hamilton') || !d)) ||
             (s.includes('wilson')    && (d.includes('hamilton') || !d));
    },
    'Hamilton-Kuser': r => {
      const s = (r.school || '').toLowerCase();
      return s.includes('kuser');
    },
    'Haddon Township': r => {
      const d = (r.district || '').toLowerCase();
      const s = (r.school   || '').toLowerCase();
      return d.includes('haddon township') || d.includes('haddon twp') ||
             s.includes('van sciver') || s.includes('strawbridge') ||
             s.includes('jennings')   || s.includes('stoy elementary') ||
             s.includes('thomas a edison');
    },
    'Central Jersey College Prep': r => {
      const d = (r.district || '').toLowerCase();
      const s = (r.school   || '').toLowerCase();
      return d.includes('central jersey') || s.includes('central jersey');
    },
  };

  // MOY school name mapping: TAP school key → lowercase iReady MOY school names
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

  // Build multi-apprentice school set (TAP-key level, not MOY-school level)
  const _schoolKeyCount = {};
  TAP_APPRENTICES.forEach(([,, school]) => {
    _schoolKeyCount[school] = (_schoolKeyCount[school] || 0) + 1;
  });
  const MULTI_APPR_SCHOOLS = new Set(
    Object.entries(_schoolKeyCount).filter(([, n]) => n > 1).map(([s]) => s)
  );

  // ── Helper: normalize a name for comparison ───────────────────────────────
  function normName(n) {
    if (!n) return '';
    return n.trim().toLowerCase()
            .replace(/^dr\.?\s+/, '')
            .replace(/\s+/g, ' ');
  }

  // ── Build survey-name lookup: normalized name → canonical display name ────
  function buildApprLookup() {
    const lut = {};
    TAP_APPRENTICES.forEach(([display,,,, surveyName]) => {
      lut[normName(surveyName)] = display;
      lut[normName(display)]   = display;
    });
    // Cross-system name aliases (Pearl informal names → canonical)
    Object.assign(lut, {
      'jasmine ramsey':         'Jasmine Ramsey-Copeland',
      'caela wilkerson':        'Micaela Wilkerson',
      'katie rose davis':       'Katherine R. Davis',
      'mary carmen':            'Maria Del Carmen',
      'mary carmen gutierrez':  'Maria Del Carmen',
      'maria gutierrez':        'Maria Del Carmen',
      'renee davis':            'Dr. Renee Davis',
      'la shanee davis':        'Dr. Renee Davis',
      'caitlyn evgeniadis':     'Caitlin Evgeniadis',
      'caitlyn evegeniadis':    'Caitlin Evgeniadis',
      'subul saadiq':           'Subul Sadiq',
      'shahzaeb ahmad':         'Shahzeeb Ahmad',
      'shazaeb ahmad':          'Shahzeeb Ahmad',
      'sharon kessel':          'Sharon K Kessel',
    });
    return lut;
  }

  function resolveAppr(raw, lut) {
    if (!raw) return null;
    const n = normName(raw);
    if (lut[n]) return lut[n];
    // First + last name partial match
    const nParts = n.split(' ');
    if (nParts.length >= 2) {
      for (const [key, canon] of Object.entries(lut)) {
        const kp = key.split(' ');
        if (kp.length >= 2 &&
            kp[0] === nParts[0] &&
            kp[kp.length - 1] === nParts[nParts.length - 1])
          return canon;
      }
    }
    return null;
  }

  // ── Math helpers ──────────────────────────────────────────────────────────
  function avg(arr) {
    const v = arr.filter(x => x !== null && x !== undefined && !isNaN(x));
    return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
  }
  function median(arr) {
    const v = arr.filter(x => x !== null && x !== undefined && !isNaN(x)).sort((a, b) => a - b);
    if (!v.length) return null;
    const m = Math.floor(v.length / 2);
    return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
  }
  const fmt1   = v => (v !== null && v !== undefined && !isNaN(v)) ? v.toFixed(1)            : '';
  const fmt0   = v => (v !== null && v !== undefined && !isNaN(v)) ? Math.round(v).toString() : '';
  const fmtPct = v => (v !== null && v !== undefined && !isNaN(v)) ? (v * 100).toFixed(1) + '%' : '';
  // Safe parse: returns null (not 0) when NaN
  const safeFloat = v => { const n = parseFloat(v); return isNaN(n) ? null : n; };

  // ── CSV parser (returns array of header-keyed objects) ────────────────────
  function parseCsv(text) {
    if (!text || !text.trim()) return [];
    // Strip UTF-8 BOM if present
    const clean = text.charCodeAt(0) === 0xFEFF ? text.slice(1) : text;
    const lines  = clean.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
    const parseRow = line => {
      const cells = []; let cur = '', inQ = false;
      for (let i = 0; i < line.length; i++) {
        const c = line[i];
        if (inQ) {
          if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; }
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
    const hdr = parseRow(lines[0]);
    const rows = [];
    for (let i = 1; i < lines.length; i++) {
      if (!lines[i].trim()) continue;
      const vals = parseRow(lines[i]);
      const obj  = {};
      hdr.forEach((h, idx) => { obj[h] = (vals[idx] || '').trim(); });
      rows.push(obj);
    }
    return rows;
  }

  // ── Fetch with 5-min cache ────────────────────────────────────────────────
  const _cache = {};
  async function cachedFetch(url, label) {
    const now = Date.now();
    if (_cache[url] && (now - _cache[url].ts) < 300000) return _cache[url].text;
    setStatus(`Fetching ${label}…`);
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`HTTP ${resp.status} fetching ${label}`);
    const text = await resp.text();
    _cache[url] = { text, ts: now };
    return text;
  }

  // ── MOY CSV row normalization (wide format: base_ + winter_ on same row) ──
  function normMoyRow(r) {
    const rn = {};
    for (const k of Object.keys(r)) {
      const lk = k.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
      rn[lk] = r[k];
    }
    const g = (...keys) => {
      for (const k of keys) {
        if (rn[k] !== undefined && rn[k] !== null && rn[k] !== '') return rn[k];
      }
      return '';
    };
    return {
      scholarName: g('student_name', 'first_and_last_name', 'name', 'full_name'),
      scholarId:   g('student_id', 'local_student_id', 'id'),
      school:      g('school'),
      district:    g('district'),
      grade:       g('student_grade', 'grade'),
      instructor:  g('instructor', 'tutor'),
      boyPlacement: normPlacement(g('base_overall_relative_placement')),
      boyScore:     safeFloat(g('base_overall_scale_score')),
      moyPlacement: normPlacement(g('winter_overall_relative_placement')),
      moyScore:     safeFloat(g('winter_overall_scale_score')),
      pctTypical:   (function () {
        const raw = g('winter_pct_progress_typical_growth', 'winter_pct_toward_typical_growth',
                      'winter_pct_typical', 'pct_progress_typical_growth');
        let v = parseFloat(raw);
        if (isNaN(v)) return null;
        if (typeof raw === 'string' && raw.trim().endsWith('%')) v /= 100;
        else if (v > 15) v /= 100;
        return v;
      }()),
    };
  }

  // ── IRLAB row normalization (already normalized by IRLAB module) ──────────
  // window.irlab.getAllRows() returns objects with camelCase fields.
  function normIrlabRow(r) {
    // baseScore / springScore of 0 is valid — use explicit null check not ||
    const bScore = (r.baseScore   !== undefined && r.baseScore   !== null && !isNaN(r.baseScore))
                     ? r.baseScore   : null;
    const eScore = (r.springScore !== undefined && r.springScore !== null && !isNaN(r.springScore))
                     ? r.springScore : null;
    return {
      scholarName:  r.scholarName  || '',
      scholarId:    r.scholarId    || '',
      school:       r.school       || '',
      district:     r.district     || '',
      grade:        r.grade        || '',
      instructor:   r.instructor   || '',
      tutors:       Array.isArray(r.tutors) ? r.tutors : [],
      boyPlacement: normPlacement(r.baseRelPlacement  || ''),
      boyScore:     bScore,
      eoyPlacement: normPlacement(r.springRelPlacement || ''),
      eoyScore:     eScore,
      pctTypical:   (r.pctTypical !== undefined && r.pctTypical !== null && !isNaN(r.pctTypical))
                      ? r.pctTypical : null,
      subject:      r.subject || '',
    };
  }

  // ── Status / progress helpers ─────────────────────────────────────────────
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
      // ── 1. Fetch Pearl data ─────────────────────────────────────────────
      setStatus('Fetching Pearl attendance data…'); setProgress(5);
      const attText = await cachedFetch(PEARL_URL(ATT_GID), 'Pearl ATT');

      setStatus('Fetching Pearl student surveys…'); setProgress(12);
      const stuText = await cachedFetch(PEARL_URL(STU_GID), 'Pearl STU surveys');

      const attRows = parseCsv(attText);
      const stuRows = parseCsv(stuText);

      // ── 2. Fetch MOY iLearn academic data ───────────────────────────────
      setStatus('Fetching MOY ELA data…'); setProgress(20);
      const moyElaText  = await cachedFetch(MOY_URL(MOY_ELA_GID),  'MOY ELA');
      setStatus('Fetching MOY Math data…'); setProgress(28);
      const moyMathText = await cachedFetch(MOY_URL(MOY_MATH_GID), 'MOY Math');

      const moyElaRows  = parseCsv(moyElaText).map(normMoyRow);
      const moyMathRows = parseCsv(moyMathText).map(normMoyRow);

      // ── 3. Load EOY Preliminary (IRLAB) data ────────────────────────────
      setStatus('Loading EOY Preliminary data (IRLAB)…'); setProgress(40);
      let irlabElaRows = [], irlabMathRows = [];
      if (window.irlab && typeof window.irlab.getAllRows === 'function') {
        // year:'all' bypasses the IRLAB's active year filter so we get SY 25-26 rows
        irlabElaRows  = window.irlab.getAllRows({ subject: 'ELA',  year: 'all' }).map(normIrlabRow);
        irlabMathRows = window.irlab.getAllRows({ subject: 'Math', year: 'all' }).map(normIrlabRow);
        console.log('[APIR] IRLAB rows loaded — ELA:', irlabElaRows.length, 'Math:', irlabMathRows.length);

        // Debug: log unique districts / schools for EOY schools so filter can be verified
        if (window._apirDebug) {
          const eoyDistricts = [...new Set(irlabElaRows.map(r => r.district).filter(Boolean))].sort();
          const eoySchools   = [...new Set(irlabElaRows.map(r => r.school).filter(Boolean))].sort();
          console.log('[APIR DEBUG] ELA districts:', eoyDistricts);
          console.log('[APIR DEBUG] ELA schools:', eoySchools);
        }
      } else {
        console.warn('[APIR] window.irlab not available — EOY data will be empty');
      }

      // ── 4. Process surveys and attendance ────────────────────────────────
      setStatus('Processing surveys…'); setProgress(55);
      const apprLut   = buildApprLookup();
      const surveyAgg = processSurveys(stuRows, apprLut);

      setStatus('Processing attendance…'); setProgress(65);
      const attAgg = processAttendance(attRows, apprLut);

      // ── 5. Build scholar attribution sets ────────────────────────────────
      setStatus('Attributing scholars…'); setProgress(72);
      const surveyScholarSets = buildSurveyScholarSets(stuRows, apprLut);

      // ── 6. Attribute scholars to apprentices ─────────────────────────────
      const moyElaByAppr  = attributeMoyScholars(moyElaRows,  surveyScholarSets, apprLut);
      const moyMathByAppr = attributeMoyScholars(moyMathRows, surveyScholarSets, apprLut);
      const irlElaByAppr  = attributeIrlabScholars(irlabElaRows,  surveyScholarSets, apprLut);
      const irlMathByAppr = attributeIrlabScholars(irlabMathRows, surveyScholarSets, apprLut);

      // ── 7. Build per-apprentice records ───────────────────────────────────
      setStatus('Building report…'); setProgress(82);
      const records = buildRecords(
        moyElaByAppr, moyMathByAppr, irlElaByAppr, irlMathByAppr,
        surveyAgg, attAgg
      );

      // ── 8. Generate CSV ────────────────────────────────────────────────
      setStatus('Generating CSV…'); setProgress(93);
      const csv = buildCsv(records);

      setProgress(100);
      setStatus('Report ready — click Download.');
      renderDownload(csv, records);

    } catch (err) {
      setStatus('Error: ' + err.message);
      console.error('[APIR] Report generation failed:', err);
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = '⚡ Generate Report'; }
    }
  }

  // ── Process student surveys ───────────────────────────────────────────────
  // Aggregates per-session survey scores by the apprentice who was rated.
  function processSurveys(stuRows, lut) {
    const agg = {};
    TAP_APPRENTICES.forEach(([d]) => { agg[d] = { conf: [], enj: [], learn: [], ovr: [], count: 0 }; });

    stuRows.forEach(row => {
      const keys      = Object.keys(row);
      const filledFor = (row['Filled For'] || row[keys[1]] || '').trim();
      const canon     = resolveAppr(filledFor, lut);
      if (!canon || !agg[canon]) return;

      // Try named headers first; fall back to column-index keys
      const conf  = safeFloat(row['How confident do you feel about what you are learning?']     || row[keys[2]]);
      const enj   = safeFloat(row['How much did you enjoy this session with <aboutName>?']       ||
                               row['How much did you enjoy this session with &lt;aboutName&gt;?']||
                               row[keys[3]]);
      const learn = safeFloat(row['How much did you learn in this session?']                      || row[keys[4]]);
      const ovr   = safeFloat(row['How would you rate this session overall?']                     || row[keys[5]]);

      if (conf  !== null) agg[canon].conf.push(conf);
      if (enj   !== null) agg[canon].enj.push(enj);
      if (learn !== null) agg[canon].learn.push(learn);
      if (ovr   !== null) agg[canon].ovr.push(ovr);
      agg[canon].count++;
    });

    const out = {};
    for (const [name, d] of Object.entries(agg)) {
      out[name] = {
        surveyCount:   d.count,
        avgConfidence: avg(d.conf),
        avgEnjoyment:  avg(d.enj),
        avgLearning:   avg(d.learn),
        avgOverall:    avg(d.ovr),
      };
    }
    return out;
  }

  // ── Process instructor attendance ─────────────────────────────────────────
  // Counts sessions per apprentice using Pearl ATT published CSV.
  // Pearl ATT status values:
  //   "Attended" or "Late"  → instructor was present (counts as attended)
  //   "Missed"              → instructor absent (counts as missed)
  //   "Not recorded"        → excluded from denominator
  function processAttendance(attRows, lut) {
    const agg = {};
    TAP_APPRENTICES.forEach(([d]) => { agg[d] = { attended: 0, missed: 0 }; });

    attRows.forEach(row => {
      const keys = Object.keys(row);

      // Column 1 = Role
      const role = (row['Role'] || row[keys[1]] || '').trim();
      if (role !== 'Instructor') return;

      // Column 0 = User (Pearl display name)
      const userName = (row['User'] || row[keys[0]] || '').trim();
      if (!userName) return;

      const canon = resolveAppr(userName, lut);
      if (!canon || !agg[canon]) return;

      // Column 6 = Attendance Status
      const status = (row['Attendance Status'] || row[keys[6]] || '').trim();

      if (status === 'Attended' || status === 'Late') {
        agg[canon].attended++;
      } else if (status === 'Missed') {
        // "Missed" covers both tutor-absent and service interruptions
        // We count all missed rows so the total session count is accurate
        agg[canon].missed++;
      }
      // "Not recorded" → excluded (don't increment either counter)
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

  // ── Build survey-confirmed scholar name sets ──────────────────────────────
  // For multi-apprentice schools where school-level attribution is ambiguous,
  // this set allows matching scholars whose names appear in Pearl surveys.
  function buildSurveyScholarSets(stuRows, lut) {
    const sets = {};
    TAP_APPRENTICES.forEach(([d]) => { sets[d] = new Set(); });

    stuRows.forEach(row => {
      const keys      = Object.keys(row);
      const filledBy  = (row['Filled By']  || row[keys[0]] || '').trim();
      const filledFor = (row['Filled For'] || row[keys[1]] || '').trim();
      const canon = resolveAppr(filledFor, lut);
      if (!canon || !sets[canon] || !filledBy) return;
      sets[canon].add(normName(filledBy));
    });
    return sets;
  }

  // ── MOY scholar attribution ───────────────────────────────────────────────
  // Tier 1: instructor field in MOY CSV matches apprentice name
  // Tier 2: single-apprentice school attribution (school → one apprentice)
  // Tier 3: survey-confirmed scholar name match (for ambiguous/multi schools)
  //
  // NOTE on school-name collisions: when two TAP keys map to the same underlying
  // iReady school name (e.g. "iLearn Paterson" and "iLearn Paterson MS" both map
  // to "paterson arts and science charter school middle"), the LAST entry in the
  // TAP_APPRENTICES list wins for school attribution. More specific designations
  // (Linda Fenty's "iLearn Paterson MS") come after Carlos Jacho's "iLearn Paterson"
  // and therefore win. Carlos's scholars are attributed via Tier 3 (survey match).
  function attributeMoyScholars(moyRows, surveyScholarSets, lut) {
    const byAppr = {};
    TAP_APPRENTICES.forEach(([d]) => { byAppr[d] = []; });

    // Build school → apprentice map (iLearn single-appr schools only)
    const schoolToAppr = {};
    TAP_APPRENTICES.forEach(([display,, school]) => {
      if (MULTI_APPR_SCHOOLS.has(school))         return;
      if (STANDARDS_MASTERY_SCHOOLS.has(school))  return;
      if (NO_DATA_SCHOOLS.has(school))            return;
      if (!ILEARN_SCHOOLS.has(school))            return;
      const names = MOY_SCHOOL_MAP[school] || [];
      names.forEach(sn => { schoolToAppr[sn] = display; });
    });

    moyRows.forEach(row => {
      const schoolLc = (row.school || '').toLowerCase().trim();

      // Tier 1: instructor name in MOY CSV
      if (row.instructor) {
        const appr = resolveAppr(row.instructor, lut);
        if (appr && byAppr[appr]) { byAppr[appr].push(row); return; }
      }

      // Tier 2: single-apprentice school map
      const apprBySchool = schoolToAppr[schoolLc];
      if (apprBySchool) { byAppr[apprBySchool].push(row); return; }

      // Tier 3: survey-confirmed scholar name (catches multi-appr and overlap schools)
      if (surveyScholarSets) {
        const scholarN = normName(row.scholarName);
        if (scholarN) {
          for (const [appr, nameSet] of Object.entries(surveyScholarSets)) {
            if (nameSet.has(scholarN)) { byAppr[appr].push(row); return; }
          }
        }
      }
    });
    return byAppr;
  }

  // ── IRLAB (EOY Preliminary) scholar attribution ───────────────────────────
  function attributeIrlabScholars(irlabRows, surveyScholarSets, lut) {
    const byAppr = {};
    TAP_APPRENTICES.forEach(([d]) => { byAppr[d] = []; });

    TAP_APPRENTICES.forEach(([display,, school]) => {
      const filterFn = EOY_DISTRICT_FILTERS[school];
      if (!filterFn) return; // not an EOY school

      const isMulti = MULTI_APPR_SCHOOLS.has(school);

      irlabRows.forEach(row => {
        if (!filterFn(row)) return;

        // Tier 1: instructor name field (only present in longitudinal data rows)
        if (row.instructor) {
          const appr = resolveAppr(row.instructor, lut);
          if (appr === display) { byAppr[display].push(row); return; }
        }

        // Tier 2: tutors array (longitudinal data rows)
        if (row.tutors && row.tutors.length) {
          for (const t of row.tutors) {
            const appr = resolveAppr(t, lut);
            if (appr === display) { byAppr[display].push(row); return; }
          }
        }

        // Tier 3: school-level attribution (single-apprentice schools only)
        if (!isMulti) {
          byAppr[display].push(row);
          return;
        }

        // Tier 4 (multi-appr only): survey-confirmed scholar name
        if (surveyScholarSets && surveyScholarSets[display]) {
          const scholarN = normName(row.scholarName);
          if (scholarN && surveyScholarSets[display].has(scholarN)) {
            byAppr[display].push(row);
          }
        }
      });
    });
    return byAppr;
  }

  // ── Academic aggregation ──────────────────────────────────────────────────
  function aggregateAcademic(rows, dataSource) {
    // dataSource: 'moy' → uses moyPlacement/moyScore; 'eoy' → uses eoyPlacement/eoyScore
    const endPField = dataSource === 'moy' ? 'moyPlacement' : 'eoyPlacement';
    const endSField = dataSource === 'moy' ? 'moyScore'     : 'eoyScore';

    const valid = rows.filter(r =>
      PLACEMENT_IDX[r.boyPlacement]  !== undefined &&
      PLACEMENT_IDX[r[endPField]]    !== undefined
    );

    const base = {
      scholarCount: rows.length, validCount: 0,
      avgBoyScore: null, avgEndScore: null, avgScoreGain: null,
      medianPctTypical: null, pctMeetTypical: null,
      improved: 0, maintained: 0, declined: 0,
      boyDist: {}, endDist: {},
      dataSource,
    };
    PLACEMENT_ORDER.forEach(p => { base.boyDist[p] = 0; base.endDist[p] = 0; });
    if (!valid.length) return base;

    const n = valid.length;
    const boyScores  = valid.map(r => r.boyScore).filter(v => v !== null);
    const endScores  = valid.map(r => r[endSField]).filter(v => v !== null);
    const pctTyp     = valid.map(r => r.pctTypical).filter(v => v !== null && !isNaN(v));

    const improved   = valid.filter(r => PLACEMENT_IDX[r[endPField]] > PLACEMENT_IDX[r.boyPlacement]).length;
    const maintained = valid.filter(r => PLACEMENT_IDX[r[endPField]] === PLACEMENT_IDX[r.boyPlacement]).length;
    const declined   = valid.filter(r => PLACEMENT_IDX[r[endPField]] < PLACEMENT_IDX[r.boyPlacement]).length;

    const boyDist = {}, endDist = {};
    PLACEMENT_ORDER.forEach(p => { boyDist[p] = 0; endDist[p] = 0; });
    valid.forEach(r => {
      boyDist[r.boyPlacement]++;
      endDist[r[endPField]]++;
    });

    return {
      scholarCount: rows.length,
      validCount:   n,
      avgBoyScore:  avg(boyScores),
      avgEndScore:  avg(endScores),
      avgScoreGain: (boyScores.length && endScores.length)
                      ? avg(endScores) - avg(boyScores) : null,
      medianPctTypical: median(pctTyp),
      pctMeetTypical:   pctTyp.length ? pctTyp.filter(v => v >= 1.0).length / pctTyp.length : null,
      improved, maintained, declined,
      boyDist, endDist,
      dataSource,
    };
  }

  // ── Build per-apprentice records ──────────────────────────────────────────
  function buildRecords(moyElaByAppr, moyMathByAppr, irlElaByAppr, irlMathByAppr,
                         surveyAgg, attAgg) {
    return TAP_APPRENTICES.map(([display, njId, school, region]) => {
      const isMidYr  = ILEARN_SCHOOLS.has(school);
      const isStdMas = STANDARDS_MASTERY_SCHOOLS.has(school);
      const isNoData = NO_DATA_SCHOOLS.has(school);

      let elaAcad = null, mathAcad = null;
      if (!isStdMas && !isNoData) {
        if (isMidYr) {
          elaAcad  = aggregateAcademic(moyElaByAppr[display]  || [], 'moy');
          mathAcad = aggregateAcademic(moyMathByAppr[display] || [], 'moy');
        } else {
          elaAcad  = aggregateAcademic(irlElaByAppr[display]  || [], 'eoy');
          mathAcad = aggregateAcademic(irlMathByAppr[display] || [], 'eoy');
        }
      }

      const dataNote = isStdMas ? 'Standards Mastery (no iReady)' :
                       isNoData ? 'No iReady data' :
                       isMidYr  ? 'MOY (Winter 2026)' : 'EOY Preliminary';

      return {
        display, njId, school, region, dataNote,
        ela:    elaAcad,
        math:   mathAcad,
        survey: surveyAgg[display] || { surveyCount: 0, avgConfidence: null, avgEnjoyment: null, avgLearning: null, avgOverall: null },
        att:    attAgg[display]    || { sessionsAttended: 0, sessionsMissed: 0, totalSessions: 0, attRate: null },
      };
    });
  }

  // ── Build CSV output ──────────────────────────────────────────────────────
  function buildCsv(records) {
    const esc = v => {
      const s = v === null || v === undefined ? '' : String(v);
      if (s.includes(',') || s.includes('"') || s.includes('\n') || s.startsWith('='))
        return '"' + s.replace(/"/g, '""') + '"';
      return s;
    };
    const row = (...cells) => cells.map(esc).join(',');
    const blank = () => '';
    const lines = [];

    const now = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    lines.push(row('NJTC TAP Apprentice Impact Report', 'Generated: ' + now,
                   '', 'Data snapshot: June 5 2026 (EOY Incomplete)'));
    lines.push('');

    // ─── SECTION 1: Apprentice Summary ────────────────────────────────────
    lines.push(row('SECTION 1 -- APPRENTICE SUMMARY (30 APPRENTICES -- SY 25-26)'));
    lines.push(row(
      'Apprentice Name', 'NJ DOL ID', 'School / Site', 'Region', 'Data Source',
      // ELA
      'ELA Scholars (Matched)', 'ELA BOY Avg Score', 'ELA End Avg Score', 'ELA Avg Score Gain',
      'ELA Median % Typical Growth', 'ELA % Meeting Typical Growth',
      'ELA Improved Placement', 'ELA Maintained Placement', 'ELA Declined Placement',
      // Math
      'Math Scholars (Matched)', 'Math BOY Avg Score', 'Math End Avg Score', 'Math Avg Score Gain',
      'Math Median % Typical Growth', 'Math % Meeting Typical Growth',
      'Math Improved Placement', 'Math Maintained Placement', 'Math Declined Placement',
      // Surveys
      'Survey Responses', 'Avg Confidence (1-5)', 'Avg Enjoyment (1-5)',
      'Avg Learning (1-5)', 'Avg Overall (1-5)',
      // Attendance
      'Sessions Attended', 'Sessions Missed', 'Total Sessions', 'Attendance Rate'
    ));

    records.forEach(rec => {
      const e = rec.ela, m = rec.math, s = rec.survey, a = rec.att;
      const noAcad = !e && !m;
      lines.push(row(
        rec.display, rec.njId, rec.school, rec.region, rec.dataNote,
        // ELA academic
        noAcad ? rec.dataNote            : (e ? fmt0(e.validCount)          : '0'),
        noAcad ? ''                      : (e ? fmt1(e.avgBoyScore)         : ''),
        noAcad ? ''                      : (e ? fmt1(e.avgEndScore)         : ''),
        noAcad ? ''                      : (e ? fmt1(e.avgScoreGain)        : ''),
        noAcad ? ''                      : (e ? fmtPct(e.medianPctTypical)  : ''),
        noAcad ? ''                      : (e ? fmtPct(e.pctMeetTypical)    : ''),
        noAcad ? ''                      : (e ? fmt0(e.improved)            : '0'),
        noAcad ? ''                      : (e ? fmt0(e.maintained)          : '0'),
        noAcad ? ''                      : (e ? fmt0(e.declined)            : '0'),
        // Math academic
        noAcad ? rec.dataNote            : (m ? fmt0(m.validCount)          : '0'),
        noAcad ? ''                      : (m ? fmt1(m.avgBoyScore)         : ''),
        noAcad ? ''                      : (m ? fmt1(m.avgEndScore)         : ''),
        noAcad ? ''                      : (m ? fmt1(m.avgScoreGain)        : ''),
        noAcad ? ''                      : (m ? fmtPct(m.medianPctTypical)  : ''),
        noAcad ? ''                      : (m ? fmtPct(m.pctMeetTypical)    : ''),
        noAcad ? ''                      : (m ? fmt0(m.improved)            : '0'),
        noAcad ? ''                      : (m ? fmt0(m.maintained)          : '0'),
        noAcad ? ''                      : (m ? fmt0(m.declined)            : '0'),
        // Surveys
        s.surveyCount,
        fmt1(s.avgConfidence),
        fmt1(s.avgEnjoyment),
        fmt1(s.avgLearning),
        fmt1(s.avgOverall),
        // Attendance
        a.sessionsAttended,
        a.sessionsMissed,
        a.totalSessions,
        fmtPct(a.attRate)
      ));
    });

    lines.push('');

    // ─── SECTION 2: Placement Distribution ───────────────────────────────
    lines.push(row('SECTION 2 -- BOY TO END PLACEMENT DISTRIBUTION PER APPRENTICE'));
    lines.push(row(
      'Apprentice Name', 'Subject', 'Data Source',
      'BOY: 3+ Grade Levels Below', 'BOY: 2 Grade Levels Below',
      'BOY: 1 Grade Level Below',   'BOY: Early On Grade Level', 'BOY: Mid/Above Grade Level',
      'END: 3+ Grade Levels Below', 'END: 2 Grade Levels Below',
      'END: 1 Grade Level Below',   'END: Early On Grade Level', 'END: Mid/Above Grade Level',
      'Net Placement Shift (levels)'
    ));

    records.forEach(rec => {
      const wAvg = dist => {
        let sum = 0, cnt = 0;
        PLACEMENT_ORDER.forEach((p, i) => { sum += i * (dist[p] || 0); cnt += (dist[p] || 0); });
        return cnt ? sum / cnt : null;
      };
      const addDistRow = (subj, acad) => {
        if (!acad || !acad.validCount) return;
        const endLabel = acad.dataSource === 'moy' ? 'MOY Winter 2026' : 'EOY Preliminary';
        const bd = acad.boyDist, ed = acad.endDist;
        const po = PLACEMENT_ORDER;
        const wb = wAvg(bd), we = wAvg(ed);
        const net = (wb !== null && we !== null) ? (we - wb).toFixed(2) : '';
        lines.push(row(
          rec.display, subj, endLabel,
          bd[po[0]] || 0, bd[po[1]] || 0, bd[po[2]] || 0, bd[po[3]] || 0, bd[po[4]] || 0,
          ed[po[0]] || 0, ed[po[1]] || 0, ed[po[2]] || 0, ed[po[3]] || 0, ed[po[4]] || 0,
          net
        ));
      };
      addDistRow('ELA',  rec.ela);
      addDistRow('Math', rec.math);
    });

    lines.push('');

    // ─── SECTION 3: Program-Level Aggregate ──────────────────────────────
    lines.push(row('SECTION 3 -- PROGRAM-LEVEL AGGREGATE (ALL 30 TAP APPRENTICES)'));
    lines.push(row('Metric', 'ELA', 'Math'));

    const elaRecs  = records.filter(r => r.ela  && r.ela.validCount  > 0);
    const mathRecs = records.filter(r => r.math && r.math.validCount > 0);

    const totElaScholars  = elaRecs.reduce((s, r)  => s + r.ela.validCount,  0);
    const totMathScholars = mathRecs.reduce((s, r) => s + r.math.validCount, 0);
    const totElaImproved  = elaRecs.reduce((s, r)  => s + r.ela.improved,   0);
    const totMathImproved = mathRecs.reduce((s, r) => s + r.math.improved,  0);

    lines.push(row('Total Scholars with Placement Data',
      totElaScholars, totMathScholars));
    lines.push(row('Avg BOY Scale Score',
      fmt1(avg(elaRecs.map(r => r.ela.avgBoyScore).filter(v => v !== null))),
      fmt1(avg(mathRecs.map(r => r.math.avgBoyScore).filter(v => v !== null)))));
    lines.push(row('Avg End Scale Score',
      fmt1(avg(elaRecs.map(r => r.ela.avgEndScore).filter(v => v !== null))),
      fmt1(avg(mathRecs.map(r => r.math.avgEndScore).filter(v => v !== null)))));
    lines.push(row('Avg Scale Score Gain',
      fmt1(avg(elaRecs.map(r => r.ela.avgScoreGain).filter(v => v !== null))),
      fmt1(avg(mathRecs.map(r => r.math.avgScoreGain).filter(v => v !== null)))));
    lines.push(row('Median % of Typical Annual Growth',
      fmtPct(median(elaRecs.map(r => r.ela.medianPctTypical).filter(v => v !== null))),
      fmtPct(median(mathRecs.map(r => r.math.medianPctTypical).filter(v => v !== null)))));
    lines.push(row('Scholars Who Improved Placement Level',
      totElaScholars  ? fmt0(totElaImproved)  + ' of ' + totElaScholars  : '',
      totMathScholars ? fmt0(totMathImproved) + ' of ' + totMathScholars : ''));
    lines.push(row('% Scholars Improved Placement',
      totElaScholars  ? fmtPct(totElaImproved  / totElaScholars)  : '',
      totMathScholars ? fmtPct(totMathImproved / totMathScholars) : ''));
    lines.push('');

    const totalSurveys = records.reduce((s, r) => s + r.survey.surveyCount, 0);
    const avgConf      = avg(records.map(r => r.survey.avgConfidence).filter(v => v !== null));
    const avgEnj       = avg(records.map(r => r.survey.avgEnjoyment).filter(v => v !== null));
    const avgLearn     = avg(records.map(r => r.survey.avgLearning).filter(v => v !== null));
    const avgOvr       = avg(records.map(r => r.survey.avgOverall).filter(v => v !== null));
    const totalAtt     = records.reduce((s, r) => s + r.att.sessionsAttended, 0);
    const totalSess    = records.reduce((s, r) => s + r.att.totalSessions,    0);

    lines.push(row('Scholar Survey Responses (total)', totalSurveys, ''));
    lines.push(row('Avg Scholar Confidence (1-5)',    fmt1(avgConf),  ''));
    lines.push(row('Avg Scholar Enjoyment (1-5)',     fmt1(avgEnj),   ''));
    lines.push(row('Avg Scholar Learning (1-5)',      fmt1(avgLearn), ''));
    lines.push(row('Avg Scholar Overall Rating (1-5)',fmt1(avgOvr),   ''));
    lines.push('');
    lines.push(row('Total Sessions Attended (all apprentices)', totalAtt,  ''));
    lines.push(row('Total Sessions (all)',                       totalSess, ''));
    lines.push(row('Program Attendance Rate',
      totalSess ? fmtPct(totalAtt / totalSess) : '', ''));
    lines.push('');

    // ─── Notes ───────────────────────────────────────────────────────────
    lines.push(row('NOTES'));
    lines.push(row('iLearn schools use MOY (Winter 2026) iReady diagnostic data.'));
    lines.push(row('All other schools use EOY Preliminary data from the portal IRLAB (live data).'));
    lines.push(row('Middlesex STEM uses Standards Mastery — iReady academic section is excluded; surveys and attendance are included.'));
    lines.push(row('CJCP and Hamilton Township show 0 scholars until EOY Preliminary data is uploaded to the IRLAB — will auto-populate.'));
    lines.push(row('Gloucester ELA/Math data is sourced from EOY Preliminary IRLAB filtered by Gloucester Township district and school name.'));
    lines.push(row('Scholar attribution uses 3 tiers: (1) instructor name in iReady CSV, (2) single-apprentice school attribution, (3) survey-confirmed scholar name match.'));
    lines.push(row('For schools with multiple apprentices (Bergen MS, Passaic MS, Clifton MS, Haddon, Hamilton, CJCP), attribution relies on tiers 1 and 3 — 0 means no instructor-level data available yet.'));
    lines.push(row('Attendance counts sessions where Pearl Attendance Status = Attended or Late; Missed = absent. Not Recorded rows are excluded from denominator.'));
    lines.push(row('Academic data as of June 5 2026 — EOY diagnostics are incomplete for some sites.'));

    // UTF-8 BOM for Excel compatibility
    return '﻿' + lines.join('\n');
  }

  // ── Render download button and summary panel ──────────────────────────────
  function renderDownload(csv, records) {
    const area = document.getElementById('apirDownloadArea');
    if (!area) return;
    area.innerHTML = '';

    const blob  = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url   = URL.createObjectURL(blob);
    const today = new Date().toISOString().slice(0, 10);
    const fname = `NJTC_TAP_Apprentice_Impact_Report_${today}.csv`;

    const a = document.createElement('a');
    a.href     = url;
    a.download = fname;
    a.className = 'apir-dl-btn';
    a.innerHTML = '⬇️&nbsp; Download CSV Report';
    area.appendChild(a);

    // Quick stat strip
    const elaRecs  = records.filter(r => r.ela  && r.ela.validCount  > 0);
    const mathRecs = records.filter(r => r.math && r.math.validCount > 0);
    const totalEla  = elaRecs.reduce((s, r)  => s + r.ela.validCount,  0);
    const totalMath = mathRecs.reduce((s, r) => s + r.math.validCount, 0);
    const totalSurveys = records.reduce((s, r) => s + r.survey.surveyCount, 0);
    const totalAtt     = records.reduce((s, r) => s + r.att.sessionsAttended, 0);
    const totalSess    = records.reduce((s, r) => s + r.att.totalSessions, 0);

    const strip = document.createElement('div');
    strip.className = 'apir-stat-strip';
    strip.innerHTML = `
      <div class="apir-stat"><span class="apir-stat-val">${totalEla}</span><span class="apir-stat-lbl">ELA scholars matched</span></div>
      <div class="apir-stat"><span class="apir-stat-val">${totalMath}</span><span class="apir-stat-lbl">Math scholars matched</span></div>
      <div class="apir-stat"><span class="apir-stat-val">${totalSurveys.toLocaleString()}</span><span class="apir-stat-lbl">survey responses</span></div>
      <div class="apir-stat"><span class="apir-stat-val">${totalSess > 0 ? Math.round(totalAtt / totalSess * 100) + '%' : '—'}</span><span class="apir-stat-lbl">program att. rate</span></div>
    `;
    area.appendChild(strip);

    const note = document.createElement('p');
    note.className = 'apir-dl-note';
    note.textContent = 'Three-section CSV: Apprentice Summary · Placement Distribution · Program Aggregate';
    area.appendChild(note);
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
            <h3>TAP Apprentice Impact Report &mdash; SY 25-26</h3>
            <p>Combines Pearl attendance &amp; scholar survey data with iReady diagnostic outcomes
               for all <strong>30 active TAP apprentices</strong>. Generates a three-section downloadable CSV.</p>
            <div class="apir-source-legend">
              <span class="apir-badge apir-badge-moy">MOY</span> iLearn schools &nbsp;|&nbsp;
              <span class="apir-badge apir-badge-eoy">EOY Prelim</span> All other schools &nbsp;|&nbsp;
              <span class="apir-badge apir-badge-sm">Std. Mastery</span> Middlesex STEM
            </div>
          </div>
        </div>

        <div class="apir-controls">
          <button id="apirGenBtn" class="apir-gen-btn" onclick="window._apirGenerate()">
            ⚡ Generate Report
          </button>
          <div class="apir-progress-row">
            <div class="apir-progress-track">
              <div id="apirProgressBar" class="apir-progress-bar" style="width:0%"></div>
            </div>
            <span id="apirStatus" class="apir-status-txt">Ready &mdash; click Generate to build the report.</span>
          </div>
        </div>

        <div id="apirDownloadArea" class="apir-dl-area"></div>

        <div class="apir-roster-section">
          <h4>Active TAP Roster (30 Apprentices)</h4>
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
          <span class="apir-card-rgn apir-rgn-${region.toLowerCase()}">${region}</span>
          <div class="apir-card-name">${display}</div>
          <div class="apir-card-school">${school}</div>
          <span class="apir-badge ${badge}">${label}</span>
        `;
        grid.appendChild(card);
      });
    }

    window._apirGenerate = generateReport;
  }

  // ── Styles ────────────────────────────────────────────────────────────────
  function injectStyles() {
    if (document.getElementById('apirStyles')) return;
    const s = document.createElement('style');
    s.id = 'apirStyles';
    s.textContent = `
      .apir-wrap { padding:1.5rem 2rem; max-width:1200px; }
      .apir-hero { display:flex;gap:1.25rem;align-items:flex-start;
        background:#f0f9ff;border:1px solid #bae6fd;border-radius:12px;
        padding:1.25rem 1.5rem;margin-bottom:1.5rem; }
      .apir-hero-icon { font-size:2.5rem;line-height:1;flex-shrink:0; }
      .apir-hero-text h3 { margin:0 0 .4rem;font-size:1.1rem;color:#0c4a6e;font-weight:700; }
      .apir-hero-text p  { margin:0 0 .6rem;font-size:.875rem;color:#374151; }
      .apir-source-legend { font-size:.8rem;color:#6b7280;display:flex;flex-wrap:wrap;gap:.5rem;align-items:center; }
      .apir-badge { display:inline-block;padding:2px 8px;border-radius:10px;font-size:.7rem;font-weight:700; }
      .apir-badge-moy { background:#dbeafe;color:#1d4ed8; }
      .apir-badge-eoy { background:#dcfce7;color:#166534; }
      .apir-badge-sm  { background:#fef9c3;color:#854d0e; }
      .apir-badge-nd  { background:#f1f5f9;color:#64748b; }
      .apir-controls  { display:flex;flex-direction:column;gap:.75rem;margin-bottom:1.5rem; }
      .apir-gen-btn   { display:inline-flex;align-items:center;gap:.5rem;
        background:linear-gradient(135deg,#2563eb,#4f46e5);color:#fff;border:none;
        border-radius:8px;padding:.7rem 1.5rem;font-size:1rem;font-weight:700;
        cursor:pointer;transition:opacity .15s;width:fit-content; }
      .apir-gen-btn:hover { opacity:.9; }
      .apir-gen-btn:disabled { opacity:.45;cursor:not-allowed; }
      .apir-progress-row  { display:flex;align-items:center;gap:1rem; }
      .apir-progress-track { flex:1;max-width:360px;height:6px;background:#e5e7eb;border-radius:3px;overflow:hidden; }
      .apir-progress-bar  { height:100%;background:#2563eb;transition:width .3s ease;border-radius:3px; }
      .apir-status-txt    { font-size:.85rem;color:#6b7280; }
      .apir-dl-area  { margin-bottom:1.5rem; }
      .apir-dl-btn   { display:inline-flex;align-items:center;gap:.5rem;
        background:#16a34a;color:#fff;border-radius:8px;padding:.65rem 1.4rem;
        font-size:.95rem;font-weight:700;text-decoration:none;margin-right:1rem; }
      .apir-dl-btn:hover { background:#15803d; }
      .apir-stat-strip { display:flex;flex-wrap:wrap;gap:.75rem;margin:.75rem 0 .5rem; }
      .apir-stat { background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;
        padding:.5rem .875rem;min-width:130px;text-align:center; }
      .apir-stat-val { display:block;font-size:1.3rem;font-weight:800;color:#0f172a; }
      .apir-stat-lbl { display:block;font-size:.7rem;color:#64748b;margin-top:.1rem; }
      .apir-dl-note { font-size:.8rem;color:#64748b;margin:.4rem 0 0; }
      .apir-roster-section h4 { margin:0 0 .75rem;font-size:.95rem;color:#374151;font-weight:700; }
      .apir-roster-grid { display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:.6rem; }
      .apir-card { background:#fff;border:1px solid #e5e7eb;border-radius:8px;
        padding:.625rem .75rem;font-size:.8rem;position:relative; }
      .apir-card-rgn { position:absolute;top:.5rem;right:.625rem;font-size:.65rem;font-weight:800; }
      .apir-rgn-ne { color:#7c3aed; }
      .apir-rgn-sw { color:#ea580c; }
      .apir-card-name   { font-weight:700;color:#111827;margin-bottom:.2rem;padding-right:1.5rem; }
      .apir-card-school { color:#6b7280;font-size:.73rem;margin-bottom:.35rem; }
    `;
    document.head.appendChild(s);
  }

  // ── Init ──────────────────────────────────────────────────────────────────
  function init() {
    injectStyles();
    if (document.getElementById(ROOT_ID)) {
      renderPanel();
    } else {
      const obs = new MutationObserver(() => {
        if (document.getElementById(ROOT_ID)) { obs.disconnect(); renderPanel(); }
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
