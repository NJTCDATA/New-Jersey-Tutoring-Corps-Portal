/* ============================================================================
   NJTC APPRENTICE IMPACT REPORT MODULE  (SY 25-26)
   Combines Pearl Operations Data + iReady EOY/MOY Academic Data for all
   30 TAP apprentices.

   Data source rules:
     • iLearn schools                  → MOY (Winter 2026) Google Sheet (2PACX published CSV)
     • Hamilton Township + Haddon Twp  → MOY (Winter 2026) Google Sheet (same sheet, district-paired)
     • All other schools               → EOY Preliminary via window.irlab.getAllRows()
     • Middlesex STEM                  → Standards Mastery (no iReady data; surveys only)
     • CJCP                            → EOY Preliminary (auto-populates when data arrives)
     • Gloucester                      → EOY Preliminary filtered by district OR school name
     NOTE: When EOY Preliminary data is added for Hamilton Township + Haddon Township,
     remove them from MOY_SCHOOLS so they fall through to the EOY path.
   ============================================================================ */

(function () {
  'use strict';

  const ROOT_ID = 'apprImpactRoot';

  // ── Pearl Published CSV constants ─────────────────────────────────────────
  const PEARL_BASE = '2PACX-1vQ1iC8NZFJt3iinGUEqftKtP32N43axi_JN_RQI36EBUdhZS0PaZRwd-1AJT3bEVe6cqHA0tCA3vb5K';
  const PEARL_URL  = gid => `https://docs.google.com/spreadsheets/d/e/${PEARL_BASE}/pub?output=csv&gid=${gid}`;
  const ATT_GID = 702726038;
  const STU_GID = 1245403832;

  // Pearl Session Details tab
  const SESS_GID = 625567780;
  // SESS column positions (matches pearl-data.js + data-department.js constants):
  //   0 = session name/title
  //   1 = instructor name
  //   2 = student names (comma-separated display names)
  //   4 = session status
  //   9 = subject
  //  16 = student Pearl IDs (comma-separated)
  const SESS_COL = { NAME:0, INSTRUCTOR:1, STUDENTS:2, STATUS:4, SUBJECT:9, STU_IDS:16 };

  // MOY iLearn sheet (Winter 2026) — stable sheet ID via GViz CSV export
  const MOY_SHEET_ID = '1AIMqvTRrZ-XBf_-ePzVnGaPExFU3DfdPg_1sPj33RnI';
  const MOY_ELA_GID  = '912997533';
  const MOY_MATH_GID = '186448147';
  const MOY_URL      = gid => `https://docs.google.com/spreadsheets/d/${MOY_SHEET_ID}/gviz/tq?tqx=out:csv&gid=${gid}`;

  // Standards Mastery — all grades combined into one tab (gid=457164791)
  const SM_SHEET_ID = '1__l9A4hyX_-4veVUP606sN9rYg9Fa0hE';
  const SM_2PACX    = '2PACX-1vTs5uDk0bg_E4rorRHadFm5i_1lerAlgj5HfSJ3NQPLMDaCbHju0VeEdbaN_mDDzA';
  const SM_ALL_GID  = '457164791';
  const SM_ALL_URL  = `https://docs.google.com/spreadsheets/d/e/${SM_2PACX}/pub?output=csv&gid=${SM_ALL_GID}`;

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
  // [displayName, njId, schoolRaw, region, surveyName]
  // Synced to HR Master List + TAP program roster SY 2025-2026.
  // All 30 apprentices retained regardless of current employment status — terminated
  // apprentices keep their data for the full SY 25-26 record.
  // La Shanee Davis and Dr. Renee Davis are the same person — NJ ID NJ2025004829, known by both names.
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
    ['La Shanee Davis',         'NJ2025004829', 'iLearn Clifton MS',           'NE', 'La Shanee Davis'],
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
    ['Shahzeeb Ahmad',          'NJ2025004822', 'iLearn Bergen',               'NE', 'Shahzeeb Ahmad'],
    ['Sharon K Kessel',         'NJ2025001707', 'iLearn Paterson Silk City',   'NE', 'Sharon K Kessel'],
    ['Subul Sadiq',             'NJ2026000469', 'iLearn Hudson',               'NE', 'Subul Sadiq'],
    ['Theodore Mills',          'NJ2025004828', 'Long Term Sub',               'NE', 'Theodore Mills'],
  ];

  // ── Hardcoded scholar seeds — supplement session attribution when Pearl ID
  //    matching fails (e.g. iReady legal names differ from Pearl display names) ─
  const HARDCODED_SCHOLAR_SEEDS = {
    'La Shanee Davis': [
      'adam gonzalez', 'alexandra velez', 'alison blanco', 'elias rivera',
      'emma arriaga', 'estrella rotte', 'grace perez', 'hamza mosleh',
      'ishmael echavarria', 'jawad alatiyat', 'jeriel del toro ortega',
      'jonathan facundo-hernandez', 'jonathan facundo hernandez',
      'julian alas', 'kaycee corniffe', 'kaylin grullon', 'leah cody',
      'lujain abuhadba', 'nadeen sadeh', 'nesreen atiyat',
      'rylein andrade-then', 'rylein andrade then',
      'sebastian hernandez', 'sophia figuereo mendoza', 'sophia roncati', 'talia alva',
    ],
  };

  // ── Pearl miss-reason classification (matches pearl-data.js exactly) ─────
  // Only these miss reasons count as a personal tutor absence.
  // Everything else (school closures, testing, holidays, scholar reasons) is a
  // service interruption and is EXCLUDED from the attendance rate denominator —
  // matching the Pearl Operations portal calculation exactly.
  const TUTOR_MISS_REASONS = new Set([
    'Absent; Not Covered (Tutor not available)',
    'Absent; Covered by Sub Tutor',
    'Absent; Covered by Dual Role',
    'Absent; Covered by the Site Leader',
    'Absent; Covered by the Instructional Coach',
    'Tutor Left Early (no sub)',
  ]);

  // Schools using Standards Mastery — no iReady academic section
  const STANDARDS_MASTERY_SCHOOLS = new Set(['Middlesex STEM']);
  // Schools with no iReady data available (e.g. long-term sub, untracked)
  const NO_DATA_SCHOOLS = new Set(['Long Term Sub']);
  // Schools where EOY Preliminary data is expected but not yet uploaded to IRLAB.
  // Show 0 / "Pending" rather than pulling stale data.  Remove a school from this
  // set once its current-year EOY Preliminary data has been confirmed in the IRLAB.
  const PENDING_EOY_SCHOOLS = new Set([
    // 'Hamilton-Kuser' removed — Hamilton Township and Haddon Township now use MOY path.
    // Once EOY Preliminary data is uploaded to IRLAB for these districts, remove them
    // from MOY_SCHOOLS below and let them fall through to the EOY path via EOY_DISTRICT_FILTERS.
  ]);

  // iLearn schools → use MOY Google Sheet (Winter 2026)
  const ILEARN_SCHOOLS = new Set([
    'iLearn Bergen MS', 'iLearn Bergen', 'iLearn Passaic MS', 'iLearn Passaic ES',
    'iLearn Paterson', 'iLearn Paterson MS', 'iLearn Paterson -ES',
    'iLearn Paterson Silk City', 'iLearn Hudson MS', 'iLearn Hudson',
    'iLearn Clifton', 'iLearn Clifton MS',
  ]);

  // Additional MOY schools (not iLearn branded but use same MOY Google Sheet).
  // Paired via Pearl district account IDs in Column G of the MOY sheet:
  //   nj-hamil44973 → Hamilton Township / Hamilton-Kuser
  //   nj-haddo65937 → Haddon Township
  //   nj-penns90725 → Penns Grove (Field Street + Paul W Carleton)
  // IMPORTANT: once EOY Preliminary data is uploaded to IRLAB for any of these,
  // remove that school from this set so it falls through to the EOY path.
  const MOY_SCHOOLS = new Set([
    'Hamilton Township', 'Hamilton-Kuser', 'Haddon Township', 'Penns Grove',
  ]);

  // EOY Preliminary schools → filtered from window.irlab.getAllRows()
  // Matches on district name OR school name (district may be empty in some IRLAB rows)
  const EOY_DISTRICT_FILTERS = {
    'Gloucester': r => {
      const d = (r.district || '').toLowerCase();
      const s = (r.school   || '').toLowerCase();
      // Require "gloucester township" specifically — avoids matching Gloucester City,
      // Gloucester County, or other "gloucester" districts that share the county name.
      return d.includes('gloucester township') ||
             s.includes('loring flemming') ||
             (s.includes('gloucester') && !d.includes('gloucester city') &&
              !d.includes('gloucester county') && !d.includes('south gloucester'));
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
    // Hamilton-Kuser: filter removed — EOY Preliminary data pending upload.
    // Added to PENDING_EOY_SCHOOLS above so the report shows "EOY Preliminary (Pending)".
    // Restore this entry once current-year data is confirmed in the IRLAB:
    //   'Hamilton-Kuser': r => (r.school || '').toLowerCase().includes('kuser'),
    'Haddon Township': r => {
      const d = (r.district || '').toLowerCase();
      const s = (r.school   || '').toLowerCase();
      return d.includes('haddon township') || d.includes('haddon twp') ||
             d.includes('haddon') ||
             s.includes('van sciver') || s.includes('strawbridge') ||
             s.includes('jennings')   || s.includes('stoy elementary') ||
             s.includes('thomas a. edison') || s.includes('thomas a edison') ||
             s.includes('thomas edison')    || s.includes('haddon');
    },
    'Central Jersey College Prep': r => {
      const d = (r.district || '').toLowerCase();
      const s = (r.school   || '').toLowerCase();
      return d.includes('central jersey') || s.includes('central jersey');
    },
  };

  // MOY school name mapping: TAP school key → lowercase iReady MOY school names
  // Hamilton Township and Haddon Township: names will be confirmed once the report
  // is run and the diagnostic log "[APIR] MOY ELA/Math schools in sheet:" is checked.
  // Common iReady name patterns are included as best-effort; add the exact string
  // from the diagnostic log if attribution shows 0 scholars for these apprentices.
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
    'iLearn Clifton':            ['clifton high', 'passaic clifton middle', 'passaic clifton elementary',
                                  'clifton middle', 'clifton ms', 'passaic clifton ms'],
    'iLearn Clifton MS':         ['passaic clifton middle', 'clifton high', 'clifton middle',
                                  'clifton ms', 'passaic clifton ms', 'passaic clifton middle school',
                                  'ilearn clifton ms'],
    // Hamilton Township (Pearl district ID: nj-hamil44973) — Caitlin, Katherine R., Lilia
    // School names currently in the MOY sheet (June 2026 export):
    'Hamilton Township':         ['crockett middle school', 'grice middle school',
                                  'klockner elementary school',
                                  // Prior school names (kept in case sheet reverts):
                                  'greenwood elementary school', 'kuser elementary school',
                                  'alexander crockett elementary', 'hamilton township'],
    'Hamilton-Kuser':            ['kuser elementary school'],
    // Haddon Township (Pearl district ID: nj-haddo65937) — Micaela Wilkerson, Nicholas Hoover
    // Confirmed exact school names from the MOY sheet (case-insensitive match applied):
    'Haddon Township':           ['van sciver elementary school',
                                  'strawbridge elementary school',
                                  'stoy elementary school',
                                  // Additional Haddon schools confirmed in Pearl data:
                                  'clyde s jennings elem school',
                                  'thomas a edison elem school'],
    // Penns Grove (Pearl district ID: nj-penns90725) — Alexandra Cristescu
    'Penns Grove':               ['field street elementary school', 'paul w carleton elem school'],
  };

  // Pearl district account ID (Column G in MOY sheet) → TAP school keys
  // Used as a secondary scoping mechanism when school name matching fails or is ambiguous.
  // nj-ilear99637 covers ALL iLearn-branded schools; individual school name narrows further.
  const MOY_DISTRICT_ID_MAP = {
    'nj-ilear99637': [...ILEARN_SCHOOLS],
    'nj-hamil44973': ['Hamilton Township', 'Hamilton-Kuser'],
    'nj-haddo65937': ['Haddon Township'],
    'nj-penns90725': ['Penns Grove'],
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

  // ── Helper: first + last name only (strips middle names / initials) ────────
  // Used for cross-system name matching where middle names differ.
  function normNameFL(n) {
    if (!n) return '';
    const base = normName(n);
    // Drop single-character tokens that are initials (e.g. "k")
    const parts = base.split(' ').filter(p => p.length > 1);
    if (parts.length < 2) return base;
    return parts[0] + ' ' + parts[parts.length - 1];
  }

  // ── Helper: check if a scholar name is in a name-set ─────────────────────
  // Tries exact normalized match first, then first+last-only fallback,
  // then scans the set for any entry whose first+last matches.
  function inScholarSet(nameSet, scholarN) {
    if (!nameSet || !scholarN) return false;
    const n  = normName(scholarN);
    if (nameSet.has(n)) return true;
    const fl = normNameFL(n);
    if (fl && nameSet.has(fl)) return true;
    // Cross-check every stored name's first+last against our first+last
    if (fl && fl.includes(' ')) {
      for (const stored of nameSet) {
        if (normNameFL(stored) === fl) return true;
      }
    }
    return false;
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
      'katie davis':            'Katherine R. Davis',
      'mary carmen':            'Maria Del Carmen',
      'mary carmen gutierrez':  'Maria Del Carmen',
      'maria gutierrez':        'Maria Del Carmen',
      'renee davis':            'La Shanee Davis',
      'dr. renee davis':        'La Shanee Davis',
      'dr renee davis':         'La Shanee Davis',
      'lashanee davis':         'La Shanee Davis',   // Pearl spelling variant (no space)
      'la shanee':              'La Shanee Davis',
      'lashanee':               'La Shanee Davis',
      'caitlyn evgeniadis':     'Caitlin Evgeniadis',
      'caitlyn evegeniadis':    'Caitlin Evgeniadis',
      'subul saadiq':           'Subul Sadiq',
      'shahzaeb ahmad':         'Shahzeeb Ahmad',
      'shazaeb ahmad':          'Shahzeeb Ahmad',
      'sharon kessel':          'Sharon K Kessel',
      // Apollo: Pearl may omit the hyphen in "Monroy-Polanco"
      'apollo monroy polanco':  'Apollo Monroy-Polanco',
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
      // iReady "User Name" column = Pearl student login ID — enables Tier 0 exact join
      _pearlId:    g('user_name', 'username', 'student_username', 'user_id'),
      school:      g('school', 'school_name', 'school_attended', 'site_name'),
      district:    g('district', 'district_name'),
      // Column G in MOY sheet = Pearl district account ID (e.g. 'nj-ilear99637').
      // Try explicit account ID column names first; fall back to detecting the Pearl ID
      // pattern (nj-<letters><digits>) in the district field if no dedicated column exists.
      districtId:  (function () {
        const acc = g('external_account_id', 'account', 'account_id', 'district_id',
                      'user_account', 'org_id', 'organization_id', 'account_name');
        if (acc) return acc.toLowerCase().trim();
        const d = g('district', 'district_name');
        // Pearl district IDs look like 'nj-ilear99637', 'nj-hamil44973', etc.
        if (d && /^nj-[a-z]{2,}[0-9]{4,}$/i.test(d.trim())) return d.trim().toLowerCase();
        return '';
      }()),
      grade:       g('student_grade', 'grade'),
      instructor:  g('instructor', 'tutor'),
      boyPlacement: normPlacement(g('base_overall_relative_placement',
                                    'fall_overall_relative_placement',
                                    'boy_overall_relative_placement',
                                    'overall_relative_placement')),
      boyScore:     safeFloat(g('base_overall_scale_score',
                                'fall_overall_scale_score',
                                'boy_overall_scale_score')),
      moyPlacement: normPlacement(g('winter_overall_relative_placement',
                                    'mid_overall_relative_placement',
                                    'moy_overall_relative_placement',
                                    'overall_relative_placement')),
      moyScore:     safeFloat(g('winter_overall_scale_score',
                                'mid_overall_scale_score',
                                'moy_overall_scale_score',
                                'overall_scale_score')),
      pctTypical:   (function () {
        const raw = g('winter_pct_progress_typical_growth', 'winter_pct_toward_typical_growth',
                      'winter_pct_typical', 'pct_progress_typical_growth',
                      'mid_pct_progress_typical_growth', 'pct_toward_typical_growth');
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
      _pearlId:     r._pearlId || '',  // Pearl student login ID — used for exact session joins
    };
  }

  // ── Standards Mastery helpers ─────────────────────────────────────────────
  function normSmRow(raw) {
    // Class Teacher(s): "Last, First" — primary only, misses co-instructors like Apollo.
    const ct = raw['Class Teacher(s)'] || '';
    const teachersFromCT = ct.split(';').map(t => {
      const parts = t.trim().split(',');
      return parts.length >= 2 ? (parts[1].trim() + ' ' + parts[0].trim()) : t.trim();
    }).filter(Boolean);

    // Class(es): "First Last - School - Grade - Subject; ..." — all instructors.
    const classes = raw['Class(es)'] || '';
    const teachersFromClasses = classes.split(';').map(entry => {
      const dashIdx = entry.indexOf(' - ');
      return dashIdx > 0 ? entry.slice(0, dashIdx).trim() : '';
    }).filter(Boolean);

    // Merge, deduplicate
    const seen = new Set();
    const teachers = [];
    [...teachersFromClasses, ...teachersFromCT].forEach(t => {
      const key = t.toLowerCase().replace(/\s+/g, ' ').trim();
      if (key && !seen.has(key)) { seen.add(key); teachers.push(t); }
    });

    const asmName = raw['Assessment Name'] || '';
    const isFormA = /\bForm A\b/i.test(asmName);
    const isFormB = /\bForm B\b/i.test(asmName);
    const asmBase = asmName.replace(/\s*Form [AB]\s*/i, '').replace(/:\s*Grade \d+\s*/i, '').trim();
    return {
      studentId:  raw['Student ID'] || '',
      lastName:   raw['Last Name']  || '',
      firstName:  raw['First Name'] || '',
      grade:      String(raw['Student Grade'] || '').trim(),
      subject:    raw['Subject'] || 'Reading',
      asmName, asmBase, isFormA, isFormB,
      score:      parseFloat(raw['Assessment Score (%)']) || 0,
      placement:  raw['Relative Placement']  || '',
      direction:  raw['Pre to Post Score']   || '',
      teachers,
      primaryTeacher: teachers[0] || '',
    };
  }

  function buildSmByAppr(smRows, tapApprSet) {
    // Build hyphen/space-normalized lookup so "Monroy Polanco, Apollo" (no hyphen)
    // still resolves to the canonical "Apollo Monroy-Polanco" display name.
    const normKey  = s => s.toLowerCase().replace(/[-\s]+/g, ' ').trim();
    const normAppr = {};
    tapApprSet.forEach(d => { normAppr[normKey(d)] = d; });
    const resolveTeacher = raw =>
      tapApprSet.has(raw) ? raw : (normAppr[normKey(raw)] || null);

    const map = {};
    smRows.forEach(r => {
      const key = r.studentId + '|' + r.asmBase;
      if (!map[key]) map[key] = { ...r, formA: null, formB: null };
      if (r.isFormA) map[key].formA = r;
      if (r.isFormB) map[key].formB = r;
    });
    const pairs = Object.values(map);
    const byAppr = {};
    pairs.forEach(p => {
      const src = p.formA || p.formB;
      if (!src) return;
      let canon = null;
      for (const t of src.teachers) {
        canon = resolveTeacher(t);
        if (canon) break;
      }
      if (!canon) return;
      if (!byAppr[canon]) byAppr[canon] = [];
      byAppr[canon].push(p);
    });
    return byAppr;
  }

  function aggregateSmAcad(pairs) {
    if (!pairs || !pairs.length) return null;
    const scholars  = new Set(pairs.map(p => p.studentId)).size;
    const withBoth  = pairs.filter(p => p.formA && p.formB);
    const gains     = withBoth.map(p => p.formB.score - p.formA.score);
    const improved  = gains.filter(g => g > 0).length;
    const avgGain   = gains.length > 0 ? Math.round(gains.reduce((s,g)=>s+g,0)/gains.length*10)/10 : null;
    const pctImp    = gains.length > 0 ? Math.round(improved/gains.length*100) : null;
    const plCount = which => {
      const c = { Beginning: 0, Progressing: 0, Proficient: 0 };
      withBoth.forEach(p => {
        const pl = which === 'pre' ? p.formA.placement : p.formB.placement;
        if (c[pl] !== undefined) c[pl]++;
      });
      return c;
    };
    return {
      scholars, pairs: pairs.length, withBoth: withBoth.length,
      avgGain, pctImproved: pctImp, improved, total: gains.length,
      prePl: plCount('pre'), postPl: plCount('post'),
      rawPairs: pairs,
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
      // ── 1. Fetch Pearl data (ATT + STU + SESS in parallel) ─────────────
      setStatus('Fetching Pearl attendance, surveys & session data…'); setProgress(5);
      const [attText, stuText, sessText] = await Promise.all([
        cachedFetch(PEARL_URL(ATT_GID),  'Pearl ATT'),
        cachedFetch(PEARL_URL(STU_GID),  'Pearl STU surveys'),
        cachedFetch(PEARL_URL(SESS_GID), 'Pearl SESS'),
      ]);

      const attRows  = parseCsv(attText);
      const stuRows  = parseCsv(stuText);
      const sessRows = parseCsv(sessText);
      console.log('[APIR] Pearl rows — ATT:', attRows.length,
                  'STU:', stuRows.length, 'SESS:', sessRows.length);

      // ── 2. Fetch MOY iLearn academic data ───────────────────────────────
      setStatus('Fetching MOY ELA data…'); setProgress(18);
      const moyElaText  = await cachedFetch(MOY_URL(MOY_ELA_GID),  'MOY ELA');
      setStatus('Fetching MOY Math data…'); setProgress(26);
      const moyMathText = await cachedFetch(MOY_URL(MOY_MATH_GID), 'MOY Math');

      const moyElaRaw   = parseCsv(moyElaText);
      const moyMathRaw  = parseCsv(moyMathText);
      // Log raw column headers so we can verify winter placement column names
      if (moyElaRaw.length)  console.log('[APIR] MOY ELA  CSV columns:', Object.keys(moyElaRaw[0]));
      if (moyMathRaw.length) console.log('[APIR] MOY Math CSV columns:', Object.keys(moyMathRaw[0]));
      const moyElaRows  = moyElaRaw.map(normMoyRow);
      const moyMathRows = moyMathRaw.map(normMoyRow);
      // Log how many rows have valid BOY + Winter placements
      const elaValid  = moyElaRows.filter(r => r.boyPlacement && r.moyPlacement).length;
      const mathValid = moyMathRows.filter(r => r.boyPlacement && r.moyPlacement).length;
      console.log('[APIR] MOY placement coverage — ELA valid (BOY+Winter):', elaValid, '/', moyElaRows.length,
                  '| Math valid (BOY+Winter):', mathValid, '/', moyMathRows.length);

      // Diagnostic: log MOY row counts and which schools are present
      console.log('[APIR] MOY rows fetched — ELA:', moyElaRows.length, 'Math:', moyMathRows.length);
      {
        const elaSchools  = [...new Set(moyElaRows.map(r => r.school).filter(Boolean))].sort();
        const mathSchools = [...new Set(moyMathRows.map(r => r.school).filter(Boolean))].sort();
        console.log('[APIR] MOY ELA schools in sheet:', elaSchools);
        console.log('[APIR] MOY Math schools in sheet:', mathSchools);

        // Build the full set of school names recognized by MOY_SCHOOL_MAP
        const knownMoySchools = new Set();
        Object.values(MOY_SCHOOL_MAP).forEach(arr => arr.forEach(s => knownMoySchools.add(s)));
        // Log any school name in the sheet that our map doesn't recognise — reveals new/renamed schools
        const elaUnknown  = elaSchools.filter(s => !knownMoySchools.has(s.toLowerCase().trim()));
        const mathUnknown = mathSchools.filter(s => !knownMoySchools.has(s.toLowerCase().trim()));
        if (elaUnknown.length)  console.warn('[APIR] MOY ELA schools NOT in MOY_SCHOOL_MAP (need mapping):', elaUnknown);
        if (mathUnknown.length) console.warn('[APIR] MOY Math schools NOT in MOY_SCHOOL_MAP (need mapping):', mathUnknown);

        // Log which district IDs appear in ELA and Math rows
        const elaDistIds  = [...new Set(moyElaRows.map(r => r.districtId).filter(Boolean))].sort();
        const mathDistIds = [...new Set(moyMathRows.map(r => r.districtId).filter(Boolean))].sort();
        console.log('[APIR] MOY ELA district IDs (Column G):', elaDistIds.length ? elaDistIds : '← none extracted (check column header name)');
        console.log('[APIR] MOY Math district IDs (Column G):', mathDistIds.length ? mathDistIds : '← none extracted (check column header name)');

        // Per-district school breakdown for Hamilton and Haddon
        const hamiltonAllNames = (MOY_SCHOOL_MAP['Hamilton Township'] || []).concat(MOY_SCHOOL_MAP['Hamilton-Kuser'] || []);
        const haddonAllNames   = MOY_SCHOOL_MAP['Haddon Township'] || [];
        const hamiltonEla  = moyElaRows.filter(r =>
          hamiltonAllNames.includes((r.school || '').toLowerCase().trim()) ||
          (r.districtId || '') === 'nj-hamil44973');
        const hamiltonMath = moyMathRows.filter(r =>
          hamiltonAllNames.includes((r.school || '').toLowerCase().trim()) ||
          (r.districtId || '') === 'nj-hamil44973');
        console.log('[APIR] MOY Hamilton ELA rows:', hamiltonEla.length,
                    hamiltonEla.length ? '— schools: ' + [...new Set(hamiltonEla.map(r=>r.school))].join(', ') : '← 0 rows');
        console.log('[APIR] MOY Hamilton Math rows:', hamiltonMath.length,
                    hamiltonMath.length ? '— schools: ' + [...new Set(hamiltonMath.map(r=>r.school))].join(', ') : '← 0 rows (not in Math tab)');
        const haddonEla  = moyElaRows.filter(r =>
          haddonAllNames.includes((r.school || '').toLowerCase().trim()) ||
          (r.districtId || '') === 'nj-haddo65937');
        const haddonMath = moyMathRows.filter(r =>
          haddonAllNames.includes((r.school || '').toLowerCase().trim()) ||
          (r.districtId || '') === 'nj-haddo65937');
        console.log('[APIR] MOY Haddon ELA rows:', haddonEla.length,
                    haddonEla.length ? '— schools: ' + [...new Set(haddonEla.map(r=>r.school))].join(', ') : '← 0 rows');
        console.log('[APIR] MOY Haddon Math rows:', haddonMath.length,
                    haddonMath.length ? '— schools: ' + [...new Set(haddonMath.map(r=>r.school))].join(', ') : '← 0 rows');
      }

      // ── 2.5. Fetch Standards Mastery data (Middlesex STEM) ──────────────
      // All grades combined into one tab on the live Google Sheet.
      setStatus('Fetching Standards Mastery data…'); setProgress(32);
      let smRows = [];
      try {
        const smText = await cachedFetch(SM_ALL_URL, 'SM All Grades');
        smRows = parseCsv(smText)
          .filter(r => r['Student ID'])
          .map(r => normSmRow(r))
          .filter(r => r.isFormA || r.isFormB);
        console.log('[APIR] Standards Mastery rows:', smRows.length,
          '— grades:', [...new Set(smRows.map(r=>r.grade))].sort().join(', '));
      } catch(err) {
        console.warn('[APIR] Standards Mastery fetch failed:', err.message);
      }

      // ── 3. Load EOY Preliminary (IRLAB) data ────────────────────────────
      setStatus('Loading EOY Preliminary data (IRLAB)…'); setProgress(38);
      let irlabElaRows = [], irlabMathRows = [];
      if (window.irlab && typeof window.irlab.getAllRows === 'function') {
        // year:'all' bypasses the IRLAB's active year filter so we get SY 25-26 rows
        irlabElaRows  = window.irlab.getAllRows({ subject: 'ELA',  year: 'all' }).map(normIrlabRow);
        irlabMathRows = window.irlab.getAllRows({ subject: 'Math', year: 'all' }).map(normIrlabRow);
        console.log('[APIR] IRLAB rows — ELA:', irlabElaRows.length, 'Math:', irlabMathRows.length);

        if (window._apirDebug) {
          const eoyDistricts = [...new Set(irlabElaRows.map(r => r.district).filter(Boolean))].sort();
          const eoySchools   = [...new Set(irlabElaRows.map(r => r.school).filter(Boolean))].sort();
          console.log('[APIR DEBUG] ELA districts:', eoyDistricts);
          console.log('[APIR DEBUG] ELA schools:', eoySchools);
        }
      } else {
        console.warn('[APIR] window.irlab not available — EOY data will be empty');
      }

      // ── 4. Build apprentice lookup table ────────────────────────────────
      const apprLut = buildApprLookup();

      // ── 5. Build session attribution (SESS tab + ATT session join) ──────
      // This is the primary method for tying scholars to their exact tutor.
      // Uses Pearl Session Details (SESS_GID) + Attendance Detail (ATT_GID)
      // joined on (session name + date) to produce exact scholar→tutor maps.
      // Returns:
      //   sets  — per-apprentice scholar name sets (for name-based matching)
      //   idMap — Pearl student ID → canonical apprentice (for exact ID matching)
      setStatus('Building session attribution from Pearl data…'); setProgress(50);
      const { sets: sessionSets, idMap: sessionIdMap, subjects: apprSubjects } = buildSessionAttribution(sessRows, attRows, apprLut);
      // Log subject coverage so we can verify ELA/Math assignments from Pearl sessions
      {
        const subjSummary = TAP_APPRENTICES.map(([d]) => {
          const s = apprSubjects[d];
          return s && s.size ? `${d.split(' ')[0]}: [${[...s].join('/')}]` : null;
        }).filter(Boolean).join(', ');
        console.log('[APIR] Session subjects by apprentice:', subjSummary || '← none');
      }

      // Diagnostic: specifically log La Shanee Davis session and survey scholar counts
      {
        const rdSess = sessionSets['La Shanee Davis'];
        console.log('[APIR] La Shanee Davis session set size:', rdSess ? rdSess.size : 0,
                    rdSess && rdSess.size ? '— sample: ' + [...rdSess].slice(0, 3).join(', ') : '← NO SESSION DATA');
      }

      // ── 6. Process surveys and attendance ────────────────────────────────
      setStatus('Processing scholar surveys…'); setProgress(60);
      const surveyAgg         = processSurveys(stuRows, apprLut);
      const surveyScholarSets = buildSurveyScholarSets(stuRows, apprLut); // Tier 4/5 fallback

      // Diagnostic: log survey scholar set for La Shanee Davis
      {
        const rdSurv = surveyScholarSets['La Shanee Davis'];
        console.log('[APIR] La Shanee Davis survey set size:', rdSurv ? rdSurv.size : 0,
                    rdSurv && rdSurv.size ? '— sample: ' + [...rdSurv].slice(0, 5).join(', ') : '← NO SURVEY DATA');
      }

      setStatus('Processing instructor attendance…'); setProgress(68);
      const attAgg = processAttendance(attRows, apprLut);

      // ── 7. Build MOY ID bridge then attribute scholars to apprentices ─────
      // The MOY ELA tab has a "User Name" column (Pearl login IDs), but the MOY Math
      // tab typically does not. Without Pearl IDs, Math rows fall through to session-name
      // Tier 2, which silently returns 0 for multi-apprentice schools (e.g. Bergen MS with
      // 5 apprentices) when names don't exactly match.
      //
      // Fix: build the bridge from BOTH IRLAB rows AND MOY ELA rows.
      // Since the same scholars appear in both ELA and Math diagnostics, any scholar
      // attributed via Pearl ID in ELA gets their normalized name added to the bridge here,
      // so Math Tier 1.5 will catch them without needing a Pearl ID in the Math CSV.
      const moyIdBridge = {}; // normalized iReady scholar name → canonical apprentice
      const _addToBridge = (pid, scholarName) => {
        if (!pid || !scholarName) return;
        const appr = sessionIdMap[pid];
        if (!appr) return;
        const nn = normName(scholarName);
        if (nn && !moyIdBridge[nn]) moyIdBridge[nn] = appr;
        const fl = normNameFL(nn);
        if (fl && fl !== nn && !moyIdBridge[fl]) moyIdBridge[fl] = appr;
      };
      // Source 1: IRLAB rows (EOY schools)
      [...irlabElaRows, ...irlabMathRows].forEach(r =>
        _addToBridge((r._pearlId || '').trim(), r.scholarName));
      // Source 2: MOY ELA Pearl IDs (if ELA tab has User Name column)
      moyElaRows.forEach(r =>
        _addToBridge((r._pearlId || '').trim(), r.scholarName));
      console.log('[APIR] MOY ID bridge (pre-ELA) — entries:', Object.keys(moyIdBridge).length);

      // ── ELA attribution first, then extend bridge with results ─────────────
      // Guaranteed fix for Math attribution: same student takes ELA and Math.
      // If they were attributed in ELA (via any tier including Tier 0 Pearl ID,
      // Tier 2 session-name, etc.), add their name to the bridge so Math Tier 1.5
      // catches them — regardless of whether the Math tab has a Pearl ID column.
      setStatus('Attributing ELA scholars…'); setProgress(74);
      const moyElaByAppr = attributeMoyScholars(moyElaRows, sessionSets, surveyScholarSets, apprLut, moyIdBridge, sessionIdMap);

      // Extend bridge with all ELA-attributed scholar names
      Object.entries(moyElaByAppr).forEach(([appr, rows]) => {
        rows.forEach(r => {
          const nn = normName(r.scholarName);
          if (nn && !moyIdBridge[nn]) moyIdBridge[nn] = appr;
          const fl = normNameFL(nn);
          if (fl && fl !== nn && !moyIdBridge[fl]) moyIdBridge[fl] = appr;
        });
      });
      console.log('[APIR] MOY ID bridge (post-ELA) — entries:', Object.keys(moyIdBridge).length);

      setStatus('Attributing Math scholars…'); setProgress(76);
      const moyMathByAppr = attributeMoyScholars(moyMathRows, sessionSets, surveyScholarSets, apprLut, moyIdBridge, sessionIdMap);
      const irlElaByAppr  = attributeIrlabScholars(irlabElaRows,  sessionSets, surveyScholarSets, apprLut, sessionIdMap);
      const irlMathByAppr = attributeIrlabScholars(irlabMathRows, sessionSets, surveyScholarSets, apprLut, sessionIdMap);

      // Diagnostic: Alexandra Cristescu (Penns Grove — MOY path, single-apprentice)
      // Note: Alexandra moved from EOY path to MOY path (nj-penns90725 in Column G).
      // Attribution via Tier 3.5 (single-apprentice district fallback) since Penns Grove
      // has exactly one TAP apprentice.
      {
        const pgSchools = new Set(['field street elementary school', 'paul w carleton elem school']);
        const pgMoyEla  = moyElaRows.filter(r =>
          pgSchools.has((r.school||'').toLowerCase().trim()) || (r.districtId||'') === 'nj-penns90725');
        const pgMoyMath = moyMathRows.filter(r =>
          pgSchools.has((r.school||'').toLowerCase().trim()) || (r.districtId||'') === 'nj-penns90725');
        const alexSess  = sessionSets['Alexandra Cristescu'];
        console.log('[APIR] Alexandra (Penns Grove MOY) — session set size:', alexSess ? alexSess.size : 0,
                    '| MOY ELA in sheet:', pgMoyEla.length,
                    '| MOY Math in sheet:', pgMoyMath.length);
        if (pgMoyMath.length > 0) {
          const s = pgMoyMath[0];
          console.log('[APIR] Alexandra first MOY Math row — school:', s.school,
                      'districtId:', s.districtId, 'boyScore:', s.boyScore);
        }
      }

      // Diagnostic: Katrina Valentin (Gloucester — single-apprentice EOY school)
      {
        const katEla  = irlElaByAppr['Katrina Valentin']  || [];
        const katMath = irlMathByAppr['Katrina Valentin'] || [];
        const gtEla   = irlabElaRows.filter(EOY_DISTRICT_FILTERS['Gloucester']);
        const gtMath  = irlabMathRows.filter(EOY_DISTRICT_FILTERS['Gloucester']);
        const gtMathWithScores = gtMath.filter(r => r.boyScore !== null || r.eoyScore !== null);
        console.log('[APIR] Katrina — IRLAB ELA total/attributed:', gtEla.length + '/' + katEla.length,
                    '| Math total/attributed:', gtMath.length + '/' + katMath.length,
                    '| Math rows with scale scores:', gtMathWithScores.length + '/' + gtMath.length);
        if (gtMath.length > 0) {
          const s = gtMath[0];
          console.log('[APIR] Katrina first Math row — boyScore:', s.boyScore, 'eoyScore:', s.eoyScore,
                      'boyPlacement:', s.boyPlacement, 'school:', s.school, 'district:', s.district);
        }
      }

      // Diagnostic: La Shanee Davis (iLearn Clifton MS — MOY multi-apprentice)
      {
        const rdEla  = moyElaByAppr['La Shanee Davis']  || [];
        const rdMath = moyMathByAppr['La Shanee Davis'] || [];
        console.log('[APIR] La Shanee Davis — MOY ELA attributed:', rdEla.length,
                    '| MOY Math attributed:', rdMath.length,
                    rdEla.length + rdMath.length === 0
                      ? '← ZERO rows: check MOY URL points to live sheet'
                      : '');
      }

      // Diagnostic: iLearn district summary (all iLearn apprentices — verifies district ID attribution)
      {
        const iLearnApprs = TAP_APPRENTICES.filter(([,,s]) => ILEARN_SCHOOLS.has(s)).map(([d]) => d);
        let iLearnElaTotal = 0, iLearnMathTotal = 0;
        iLearnApprs.forEach(appr => {
          const ela  = moyElaByAppr[appr]  ? moyElaByAppr[appr].length  : 0;
          const math = moyMathByAppr[appr] ? moyMathByAppr[appr].length : 0;
          iLearnElaTotal  += ela;
          iLearnMathTotal += math;
          if (ela + math === 0)
            console.warn('[APIR]', appr, '(iLearn MOY) — ELA: 0, Math: 0 ← check session sets / district ID');
        });
        console.log('[APIR] iLearn totals — ELA scholars attributed:', iLearnElaTotal,
                    '| Math scholars attributed:', iLearnMathTotal,
                    iLearnMathTotal === 0 ? '← MATH STILL 0: check districtId extraction from Column G' : '');
        // Log what district IDs and schools appeared in Math rows
        const mathDistIds  = [...new Set(moyMathRows.map(r => r.districtId).filter(Boolean))];
        const mathSchoolsL = [...new Set(moyMathRows.map(r => (r.school||'').toLowerCase().trim()).filter(Boolean))];
        console.log('[APIR] Math rows — district IDs found:', mathDistIds);
        console.log('[APIR] Math rows — schools found (lowercase):', mathSchoolsL);
      }

      // Diagnostic: Penns Grove MOY path (Alexandra Cristescu)
      {
        const alexEla  = moyElaByAppr['Alexandra Cristescu']  || [];
        const alexMath = moyMathByAppr['Alexandra Cristescu'] || [];
        const pgMoyEla  = moyElaRows.filter(r =>
          ['field street elementary school','paul w carleton elem school']
            .includes((r.school||'').toLowerCase().trim()) ||
          (r.districtId||'') === 'nj-penns90725');
        const pgMoyMath = moyMathRows.filter(r =>
          ['field street elementary school','paul w carleton elem school']
            .includes((r.school||'').toLowerCase().trim()) ||
          (r.districtId||'') === 'nj-penns90725');
        console.log('[APIR] Alexandra (Penns Grove MOY) — ELA in sheet:', pgMoyEla.length,
                    '/ attributed:', alexEla.length,
                    '| Math in sheet:', pgMoyMath.length, '/ attributed:', alexMath.length);
      }

      // Diagnostic: Hamilton Township (MOY — multi-apprentice: Caitlin, Katherine R., Lilia)
      {
        const htAppr = TAP_APPRENTICES.filter(([,, s]) => s === 'Hamilton Township' || s === 'Hamilton-Kuser').map(([d]) => d);
        htAppr.forEach(appr => {
          const ela  = moyElaByAppr[appr]  || [];
          const math = moyMathByAppr[appr] || [];
          console.log('[APIR]', appr, '(Hamilton MOY) — ELA attributed:', ela.length,
                      '| Math attributed:', math.length,
                      ela.length + math.length === 0
                        ? '← 0 rows — check MOY school names match MOY sheet for Hamilton' : '');
        });
      }

      // Diagnostic: Haddon Township (MOY — multi-apprentice: Micaela, Nicholas)
      {
        const hdAppr = TAP_APPRENTICES.filter(([,, s]) => s === 'Haddon Township').map(([d]) => d);
        hdAppr.forEach(appr => {
          const ela  = moyElaByAppr[appr]  || [];
          const math = moyMathByAppr[appr] || [];
          console.log('[APIR]', appr, '(Haddon MOY) — ELA attributed:', ela.length,
                      '| Math attributed:', math.length,
                      ela.length + math.length === 0
                        ? '← 0 rows — check MOY school names match MOY sheet for Haddon' : '');
        });
      }

      // ── 8. Build per-apprentice records ───────────────────────────────────
      setStatus('Building report…'); setProgress(85);
      // Build SM attribution — match teacher names directly to TAP apprentice names
      const smApprSet  = new Set(TAP_APPRENTICES
        .filter(([,, school]) => STANDARDS_MASTERY_SCHOOLS.has(school))
        .map(([display]) => display));
      const smByAppr   = buildSmByAppr(smRows, smApprSet);
      console.log('[APIR] SM apprentices with data:', Object.keys(smByAppr).join(', '));
      const records = buildRecords(
        moyElaByAppr, moyMathByAppr, irlElaByAppr, irlMathByAppr,
        surveyAgg, attAgg, smByAppr, apprSubjects
      );

      // ── 9. Generate CSV ────────────────────────────────────────────────
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
  //
  // Classification matches Pearl Operations portal logic exactly:
  //   "Attended" or "Late"                              → attended (present)
  //   "Missed" + reason in TUTOR_MISS_REASONS           → missed (personal absence)
  //   "Missed" + any other reason (SI / scholar reason) → service interruption — EXCLUDED
  //   "Not recorded"                                    → EXCLUDED from denominator
  //
  // Attendance rate = attended / (attended + personal_absences)
  // Service interruptions are NOT in the denominator — this matches the Pearl
  // Operations attendance % shown on the portal.
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
        // Column 7 = Miss Reason — determines tutor absence vs service interruption
        const missReason = (row['Miss Reason'] || row['Absence Reason'] || row[keys[7]] || '').trim();
        if (TUTOR_MISS_REASONS.has(missReason)) {
          // Personal tutor absence — counts against attendance rate
          agg[canon].missed++;
        }
        // else: service interruption (school closure, testing, holiday, scholar reason,
        // or blank reason) → excluded from denominator (matches Pearl Operations portal)
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
  // Stores both full normalized name AND first+last variant so that Tier 4
  // matches even when iReady uses a different middle name than the survey.
  function buildSurveyScholarSets(stuRows, lut) {
    const sets = {};
    TAP_APPRENTICES.forEach(([d]) => { sets[d] = new Set(); });

    stuRows.forEach(row => {
      const keys      = Object.keys(row);
      const filledBy  = (row['Filled By']  || row[keys[0]] || '').trim();
      const filledFor = (row['Filled For'] || row[keys[1]] || '').trim();
      const canon = resolveAppr(filledFor, lut);
      if (!canon || !sets[canon] || !filledBy) return;
      const nn = normName(filledBy);
      sets[canon].add(nn);
      // Also add first+last-only variant — handles cases where iReady includes
      // a middle name or initial that the scholar omitted on their Pearl survey
      // (e.g. iReady "Grace M. Perez" vs. survey "Grace Perez").
      const fl = normNameFL(nn);
      if (fl && fl !== nn) sets[canon].add(fl);
    });
    return sets;
  }

  // ── Build session-based scholar attribution ───────────────────────────────
  // Primary method for tying scholars to their exact apprentice-tutor.
  // Uses two passes:
  //   Pass 1 — Pearl SESS tab:  each row lists instructor + student names directly.
  //   Pass 2 — Pearl ATT join:  group ATT rows by (session name + date); instructor
  //                              row (Attended/Late) identifies the tutor; all student
  //                              rows in that group are added to the tutor's scholar set.
  function buildSessionAttribution(sessRows, attRows, lut) {
    const sets     = {};
    const idMap    = {};  // Pearl student ID → canonical apprentice name
    const subjects = {}; // canonical apprentice name → Set of subjects (e.g. 'Math', 'Reading')
    TAP_APPRENTICES.forEach(([d]) => { sets[d] = new Set(); subjects[d] = new Set(); });

    // Helper: add a scholar name (both full-norm and first+last forms) to a set
    function addScholar(set, raw) {
      const nn = normName(raw);
      if (!nn) return;
      set.add(nn);
      const fl = normNameFL(nn);
      if (fl && fl !== nn) set.add(fl);
    }

    // ── Pass 1: SESS tab direct assignment ───────────────────────────────
    sessRows.forEach(row => {
      const keys   = Object.keys(row);
      const getCol = pos => (row[keys[pos]] || '').trim();

      const status = getCol(SESS_COL.STATUS).toLowerCase();
      const ok = status.includes('attended') || status.includes('complete') ||
                 status.includes('success')  || status.includes('partial');
      if (!ok) return;

      const instrRaw = getCol(SESS_COL.INSTRUCTOR);
      const canon    = resolveAppr(instrRaw, lut);
      if (!canon || !sets[canon]) return;

      // Col 9 = subject — track which subjects each apprentice actually teaches
      const subj = getCol(SESS_COL.SUBJECT);
      if (subj) subjects[canon].add(subj);

      // Col 2 = comma-separated student display names
      const stuNamesRaw = getCol(SESS_COL.STUDENTS);
      stuNamesRaw.split(',').map(s => s.trim()).filter(Boolean)
        .forEach(sn => addScholar(sets[canon], sn));

      // Col 16 = comma-separated Pearl student IDs — build exact ID→apprentice map
      const stuIdsRaw = getCol(SESS_COL.STU_IDS);
      stuIdsRaw.split(',').map(s => s.trim()).filter(Boolean)
        .forEach(pid => { if (!idMap[pid]) idMap[pid] = canon; });
    });

    // ── Pass 2: ATT session join ─────────────────────────────────────────
    // Group ATT rows by (sessionName|sessionDate) so we can find
    // the instructor for each session instance and attribute its students.
    const attBySession = {};
    attRows.forEach(row => {
      const keys        = Object.keys(row);
      const sessionName = (row['Session']           || row[keys[2]] || '').trim();
      const sessionDate = (row['Session Date']       || row[keys[5]] || '').trim();
      if (!sessionName) return;

      const key = sessionName + '|' + sessionDate;
      if (!attBySession[key]) attBySession[key] = { instructor: null, students: [], studentIds: [] };

      const role   = (row['Role']              || row[keys[1]]  || '').trim();
      const user   = (row['User']              || row[keys[0]]  || '').trim();
      const userId = (row['User ID']           || row[keys[13]] || '').trim();  // Pearl student ID
      const status = (row['Attendance Status'] || row[keys[6]]  || '').trim();

      if (role === 'Instructor') {
        // Only mark instructor if they were actually there (Attended or Late)
        if ((status === 'Attended' || status === 'Late') && user) {
          attBySession[key].instructor = user;
        }
      } else {
        // Students: include regardless of their attendance status —
        // we want to know which students are ASSIGNED to this tutor,
        // not just who showed up on a specific day.
        if (user) {
          attBySession[key].students.push(user);
          if (userId) attBySession[key].studentIds.push(userId);
        }
      }
    });

    Object.values(attBySession).forEach(({ instructor, students, studentIds }) => {
      if (!instructor || !students.length) return;
      const canon = resolveAppr(instructor, lut);
      if (!canon || !sets[canon]) return;
      students.forEach(sn => addScholar(sets[canon], sn));
      // Add Pearl student IDs from ATT col 13 to idMap (backs up SESS col 16 data)
      (studentIds || []).forEach(pid => { if (!idMap[pid]) idMap[pid] = canon; });
    });

    // Supplement session sets with hardcoded fallback seeds for apprentices where
    // Pearl ID matching may fail due to cross-system name differences (e.g. iReady
    // legal name vs. Pearl display name for iLearn Clifton MS scholars).
    Object.entries(HARDCODED_SCHOLAR_SEEDS).forEach(([appr, names]) => {
      if (!sets[appr]) return;
      names.forEach(name => {
        const nn = normName(name);
        if (!nn) return;
        sets[appr].add(nn);
        const fl = normNameFL(nn);
        if (fl && fl !== nn) sets[appr].add(fl);
      });
    });

    // Debug summary
    const summary = Object.entries(sets)
      .filter(([, s]) => s.size > 0)
      .map(([n, s]) => `${n.split(' ')[0]}: ${s.size}`).join(', ');
    console.log('[APIR] Session attribution —', summary || 'no scholars found');
    console.log('[APIR] Pearl ID map — entries:', Object.keys(idMap).length);

    return { sets, idMap, subjects };
  }

  // ── MOY scholar attribution ───────────────────────────────────────────────
  // Attribution tiers (in priority order):
  //   Tier 0:   iReady User Name = Pearl student login ID → exact join via sessionIdMap
  //   Tier 1:   instructor field in MOY CSV matches apprentice name
  //   Tier 1.5: Pearl ID bridge (built from ELA Pearl IDs + IRLAB; fixes Math when Math
  //             tab lacks User Name column — scholars attributed via ELA seed the bridge)
  //   Tier 2:   session-confirmed scholar name, scoped to the school's/district's apprentices
  //             Multi-apprentice scope: only check sessions for apprentices at THIS school.
  //             If school name not in map: use Pearl district account ID (Column G) to scope.
  //             Single-apprentice scope: global session search (won't cross-pollinate).
  //   Tier 3:   single-apprentice school-level fallback (schoolToAppr)
  //   Tier 3.5: single-apprentice district fallback (district ID → 1 apprentice only)
  //   Tier 4:   survey-confirmed scholar name (last resort)
  function attributeMoyScholars(moyRows, sessionSets, surveyScholarSets, lut, moyIdBridge, sessionIdMap) {
    const byAppr = {};
    TAP_APPRENTICES.forEach(([d]) => { byAppr[d] = []; });

    // Build district account ID → [apprentice display names] from TAP roster.
    // Used when school name is missing/unrecognized but Column G district ID is present.
    const distIdToApprs = {};
    Object.entries(MOY_DISTRICT_ID_MAP).forEach(([distId, schoolKeys]) => {
      distIdToApprs[distId] = TAP_APPRENTICES
        .filter(([,,s]) => schoolKeys.includes(s))
        .map(([d]) => d);
    });

    // Build school → apprentice map (single-appr MOY schools only — for Tier 3)
    const schoolToAppr = {};
    TAP_APPRENTICES.forEach(([display,, school]) => {
      if (MULTI_APPR_SCHOOLS.has(school))         return;
      if (STANDARDS_MASTERY_SCHOOLS.has(school))  return;
      if (NO_DATA_SCHOOLS.has(school))            return;
      if (!ILEARN_SCHOOLS.has(school) && !MOY_SCHOOLS.has(school)) return;
      const names = MOY_SCHOOL_MAP[school] || [];
      names.forEach(sn => { schoolToAppr[sn] = display; });
    });

    // Build school → [all apprentices] for multi-apprentice MOY schools (Tier 2 scoping).
    // Prevents cross-school collisions where a common name (e.g. "Grace Perez") in one
    // school's session set would steal a scholar from a different school's apprentice.
    const schoolApprList = {}; // lowercase MOY school name → [canonical apprentice names]
    TAP_APPRENTICES.forEach(([display,, school]) => {
      if (!ILEARN_SCHOOLS.has(school) && !MOY_SCHOOLS.has(school)) return;
      const moyNames = MOY_SCHOOL_MAP[school] || [];
      moyNames.forEach(sn => {
        if (!schoolApprList[sn]) schoolApprList[sn] = [];
        if (!schoolApprList[sn].includes(display)) schoolApprList[sn].push(display);
      });
    });

    // Pre-compute which apprentices have non-empty session sets
    const hasSessionData = {};
    TAP_APPRENTICES.forEach(([d]) => {
      hasSessionData[d] = sessionSets && sessionSets[d] && sessionSets[d].size > 0;
    });
    const anySessionData = Object.values(hasSessionData).some(Boolean);

    moyRows.forEach(row => {
      const scholarN   = normName(row.scholarName);
      const schoolLc   = (row.school || '').toLowerCase().trim();
      const districtId = (row.districtId || '').toLowerCase().trim();

      // Tier 0: Pearl student login ID → sessionIdMap direct join (most authoritative)
      if (row._pearlId && sessionIdMap) {
        const appr = sessionIdMap[row._pearlId];
        if (appr && byAppr[appr]) { byAppr[appr].push(row); return; }
      }

      // Tier 1: instructor field in MOY CSV matches an apprentice name
      if (row.instructor) {
        const appr = resolveAppr(row.instructor, lut);
        if (appr && byAppr[appr]) { byAppr[appr].push(row); return; }
      }

      // Tier 1.5: Pearl ID bridge — scholar name matched from prior ELA/IRLAB attribution
      if (scholarN && moyIdBridge) {
        const appr = moyIdBridge[scholarN] || moyIdBridge[normNameFL(scholarN)];
        if (appr && byAppr[appr]) { byAppr[appr].push(row); return; }
      }

      // Tier 2: session-confirmed scholar name, scoped to school's/district's apprentices.
      // Priority: school-name scope (most precise) → district ID scope (Column G fallback
      //   for Math CSVs where school column header differs from ELA) → global search.
      if (scholarN && anySessionData) {
        // Determine candidate apprentice pool for this row
        let scopedApprs = schoolApprList[schoolLc];  // school-level (tightest scope)

        // If school name isn't recognised but Column G district ID is known,
        // use the district to restore scope (catches Math CSVs with different school headers).
        if (!scopedApprs && districtId && distIdToApprs[districtId]) {
          scopedApprs = distIdToApprs[districtId];
        }

        const isMultiScope = scopedApprs && scopedApprs.length > 1;

        if (isMultiScope) {
          // Scoped search: only check session sets for apprentices in this scope
          for (const appr of scopedApprs) {
            const nameSet = sessionSets[appr];
            if (nameSet && inScholarSet(nameSet, scholarN)) {
              byAppr[appr].push(row); return;
            }
          }
          // No session match within scope — fall through to Tier 3/4 rather than
          // silently dropping. Tier 3 will handle single-apprentice schools;
          // multi-apprentice schools then fall to Tier 4 (survey names).
        } else if (scopedApprs && scopedApprs.length === 1) {
          // Exactly one apprentice at this school/district — check their session set,
          // then fall through to Tier 3 for direct attribution
          const appr = scopedApprs[0];
          const nameSet = sessionSets[appr];
          if (nameSet && inScholarSet(nameSet, scholarN)) {
            byAppr[appr].push(row); return;
          }
          // Fall through — Tier 3 or 3.5 will attribute directly
        } else {
          // School/district unknown: global session search (no cross-school scope risk
          // since we don't know which school this row belongs to)
          for (const [appr, nameSet] of Object.entries(sessionSets || {})) {
            if (inScholarSet(nameSet, scholarN)) { byAppr[appr].push(row); return; }
          }
        }
      }

      // Tier 3: single-apprentice school map fallback
      // Catches iLearn/MOY schools with exactly one apprentice when session matching fails.
      const apprBySchool = schoolToAppr[schoolLc];
      if (apprBySchool) { byAppr[apprBySchool].push(row); return; }

      // Tier 3.5: single-apprentice district fallback via Column G district ID.
      // For districts with only one TAP apprentice (e.g. Penns Grove → Alexandra Cristescu),
      // the district ID is unambiguous — attribute directly even without a school name match.
      if (districtId && distIdToApprs[districtId]) {
        const dApprs = distIdToApprs[districtId];
        if (dApprs.length === 1 && byAppr[dApprs[0]]) {
          byAppr[dApprs[0]].push(row); return;
        }
      }

      // Tier 4: survey-confirmed scholar name (last resort)
      if (scholarN && surveyScholarSets) {
        for (const [appr, nameSet] of Object.entries(surveyScholarSets)) {
          if (inScholarSet(nameSet, scholarN)) { byAppr[appr].push(row); return; }
        }
      }
    });
    return byAppr;
  }

  // ── IRLAB (EOY Preliminary) scholar attribution ───────────────────────────
  //
  // Attribution logic per row (in priority order):
  //
  // A. IRLAB instructor field is set and is NOT 'Unidentified':
  //      → The IRLAB's Pearl session join assigned a specific teacher.
  //        If that teacher is this apprentice → include.
  //        Otherwise → SKIP entirely (prevents whole-school over-attribution).
  //        Note: non-NJTC teachers (Jill Ilagan, Crysten Wood, etc.) resolve
  //        to null here — they are also skipped.
  //
  // B. Instructor is empty or 'Unidentified' (no Pearl join result):
  //    B1. Session sets: if this apprentice has Pearl session data, check the
  //        scholar name against their session set (most precise).
  //    B2. For single-apprentice schools with NO session data at all → school-
  //        level (broad fallback, keeps 0 from showing when session data is absent).
  //    B3. Multi-apprentice school + no session match → survey name fallback.
  //
  // This design means:
  //   • Katrina Valentin gets only her ~20-30 scholars (not 300+ school-wide)
  //   • Haddon/multi-appr EOY schools resolve correctly via session attribution
  //   • Hamilton / CJCP stay at 0 until their data is in the IRLAB (expected)
  function attributeIrlabScholars(irlabRows, sessionSets, surveyScholarSets, lut, sessionIdMap) {
    const byAppr = {};
    TAP_APPRENTICES.forEach(([d]) => { byAppr[d] = []; });

    TAP_APPRENTICES.forEach(([display,, school]) => {
      const filterFn = EOY_DISTRICT_FILTERS[school];
      if (!filterFn) return; // not an EOY school

      const isMulti = MULTI_APPR_SCHOOLS.has(school);
      const sessSet  = sessionSets && sessionSets[display];
      const hasSess  = sessSet && sessSet.size > 0;

      // Two-pass B2 gate: check whether ANY filtered row for this subject is captured
      // by an early path (Tier 0, Path A instructor, tutors, or B1 session name).
      // If ≥1 row would be captured early → B2 is suppressed (prevents whole-district
      // flooding when sessions are working, e.g. Katrina/Gloucester ELA and Math).
      // If 0 rows captured → Pearl data doesn't name-match iReady for this subject
      // → B2 fires as fallback (e.g. Alexandra/Penns Grove Math).
      const hasAnyEarlyCapture = !isMulti && irlabRows.some(r => {
        if (!filterFn(r)) return false;
        // Tier 0: Pearl student ID
        const pid = (r._pearlId || '').trim();
        if (pid && sessionIdMap && sessionIdMap[pid] === display) return true;
        // Path A: IRLAB instructor field resolves to this apprentice
        const inst = (r.instructor || '').trim();
        if (inst && inst !== 'Unidentified' && inst !== 'Unknown' &&
            resolveAppr(inst, lut) === display) return true;
        // Path B tutors array
        if (r.tutors && r.tutors.length) {
          const kt = r.tutors.filter(t => t && t !== 'Unidentified' && t !== 'Unknown');
          if (kt.some(t => resolveAppr(t, lut) === display)) return true;
        }
        // B1: session set name match
        if (!hasSess) return false;
        const n = normName(r.scholarName);
        return n && inScholarSet(sessSet, n);
      });
      const useB2 = !isMulti && !hasAnyEarlyCapture;

      irlabRows.forEach(row => {
        if (!filterFn(row)) return;

        const scholarN = normName(row.scholarName);

        // ── Tier 0: Pearl ID direct join — most authoritative ────────────
        // Uses the Pearl student login ID stored in IRLAB as _pearlId.
        // This ID is the same as SESS col-16 STU_IDS values, so it provides
        // an exact, name-variation-proof link between iReady data and Pearl sessions.
        // Bypasses all name-matching (handles legal vs. display name differences,
        // middle initials, accent marks, etc.).
        // If the Pearl ID is in the session map: use it and stop — don't fall through.
        // If not in the map: proceed to name-based matching below.
        const pearlId = (row._pearlId || '').trim();
        if (pearlId && sessionIdMap && (pearlId in sessionIdMap)) {
          if (sessionIdMap[pearlId] === display) byAppr[display].push(row);
          return; // Pearl ID is definitive — trust it for all apprentices
        }

        // ── Path A: IRLAB instructor field is authoritative ──────────────
        const instVal = (row.instructor || '').trim();
        if (instVal && instVal !== 'Unidentified' && instVal !== 'Unknown') {
          const resolved = resolveAppr(instVal, lut);
          if (resolved === display) {
            byAppr[display].push(row);
            return;
          }
          // Multi-apprentice school: another NJTC apprentice or non-NJTC instructor
          // means this row belongs elsewhere — skip it entirely.
          if (isMulti) return;
          // Single-apprentice school: iReady stores the classroom teacher name, not
          // the NJTC tutor. A non-NJTC instructor name does NOT exclude the scholar —
          // fall through to session/school-level attribution below.
          // (This fixes Penns Grove Math scholars being skipped because iReady lists
          // the school's Math teacher rather than Alexandra Cristescu as instructor.)
        }

        // ── Path B: instructor field empty / Unidentified ────────────────
        // Try tutors array (longitudinal IRLAB rows carry an array)
        if (row.tutors && row.tutors.length) {
          const knownTutors = row.tutors.filter(t => t && t !== 'Unidentified' && t !== 'Unknown');
          if (knownTutors.length) {
            for (const t of knownTutors) {
              if (resolveAppr(t, lut) === display) { byAppr[display].push(row); return; }
            }
            if (isMulti) return; // multi-appr: known tutors but none match → belongs elsewhere
            // Single-appr: tutors are school classroom teachers (non-NJTC), fall through to B1/B2
          }
        }

        // B1: session-confirmed scholar name (precise — for both single & multi)
        if (scholarN && hasSess) {
          if (inScholarSet(sessSet, scholarN)) {
            byAppr[display].push(row);
            return;
          }
          // Multi-apprentice: stop here — no school-level fallback.
          if (isMulti) return;
          // Single-apprentice: fall through to B2.
          // No other NJTC apprentice at this school, so IRLAB scholars not yet
          // in a Pearl session still belong to this apprentice (e.g. Math scholars
          // for Alexandra Cristescu when Pearl sessions are recorded by subject).
        }

        // B2: school-level fallback — single-apprentice schools only, and only
        //     when B1 matched zero scholars for this subject (useB2 pre-computed above).
        //     Suppressed when sessions already identified real scholars (Katrina/Gloucester).
        //     Active when Pearl names don't align with iReady names (Alexandra/Math).
        if (useB2) {
          byAppr[display].push(row);
          return;
        }

        // B3: multi-apprentice + no session data → survey name fallback
        // Uses inScholarSet for the same name-variation handling as Tier 2.
        if (scholarN && surveyScholarSets && surveyScholarSets[display]) {
          if (inScholarSet(surveyScholarSets[display], scholarN)) {
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
                         surveyAgg, attAgg, smByAppr, apprSubjects) {
    smByAppr     = smByAppr     || {};
    apprSubjects = apprSubjects || {};

    // Normalize Pearl subject values to ELA / Math buckets.
    // Pearl uses 'Reading' or 'ELA' for literacy sessions; 'Math' for math.
    const teachesEla  = d => {
      const s = apprSubjects[d];
      if (!s || !s.size) return true; // no session data → don't suppress
      return [...s].some(v => /reading|ela|literacy/i.test(v));
    };
    const teachesMath = d => {
      const s = apprSubjects[d];
      if (!s || !s.size) return true; // no session data → don't suppress
      return [...s].some(v => /math/i.test(v));
    };

    return TAP_APPRENTICES.map(([display, njId, school, region]) => {
      const isMidYr   = ILEARN_SCHOOLS.has(school) || MOY_SCHOOLS.has(school);
      const isStdMas  = STANDARDS_MASTERY_SCHOOLS.has(school);
      const isNoData  = NO_DATA_SCHOOLS.has(school);
      const isPending = PENDING_EOY_SCHOOLS.has(school);

      let elaAcad = null, mathAcad = null, smAcad = null;
      if (isStdMas) {
        smAcad = aggregateSmAcad(smByAppr[display] || []);
      } else if (!isNoData && !isPending) {
        if (isMidYr) {
          if (teachesEla(display))
            elaAcad  = aggregateAcademic(moyElaByAppr[display]  || [], 'moy');
          if (teachesMath(display))
            mathAcad = aggregateAcademic(moyMathByAppr[display] || [], 'moy');
        } else {
          if (teachesEla(display))
            elaAcad  = aggregateAcademic(irlElaByAppr[display]  || [], 'eoy');
          if (teachesMath(display))
            mathAcad = aggregateAcademic(irlMathByAppr[display] || [], 'eoy');
        }
      }

      const dataNote = isStdMas  ? 'Standards Mastery (EOY SY 25-26)' :
                       isNoData  ? 'No iReady data' :
                       isPending ? 'EOY Preliminary (Pending)' :
                       isMidYr   ? 'MOY (Winter 2026)' : 'EOY Preliminary';

      return {
        display, njId, school, region, dataNote, isStdMas,
        ela:    elaAcad,
        math:   mathAcad,
        sm:     smAcad,
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
      const e = rec.ela, m = rec.math, s = rec.survey, a = rec.att, sm = rec.sm;
      const noAcad = !e && !m && !sm;
      // For Standards Mastery schools — summarise in ELA columns, leave Math blank
      const smNote = rec.isStdMas ? 'See Section 4 — Standards Mastery' : rec.dataNote;
      lines.push(row(
        rec.display, rec.njId, rec.school, rec.region, rec.dataNote,
        // ELA academic (SM: scholar count in validCount col, % improved in placement cols)
        noAcad  ? smNote                       : (rec.isStdMas ? (sm ? sm.scholars     : '0') : (e ? fmt0(e.validCount)         : '0')),
        noAcad  ? ''                           : (rec.isStdMas ? (sm ? 'Pre avg—see §4' : '') : (e ? fmt1(e.avgBoyScore)        : '')),
        noAcad  ? ''                           : (rec.isStdMas ? (sm ? 'Post avg—see §4': '') : (e ? fmt1(e.avgEndScore)        : '')),
        noAcad  ? ''                           : (rec.isStdMas ? (sm && sm.avgGain !== null ? sm.avgGain + '%' : '') : (e ? fmt1(e.avgScoreGain) : '')),
        noAcad  ? ''                           : (rec.isStdMas ? ''                    : (e ? fmtPct(e.medianPctTypical) : '')),
        noAcad  ? ''                           : (rec.isStdMas ? (sm && sm.pctImproved !== null ? sm.pctImproved + '%' : '') : (e ? fmtPct(e.pctMeetTypical) : '')),
        noAcad  ? ''                           : (rec.isStdMas ? (sm ? sm.improved     : '') : (e ? fmt0(e.improved)          : '0')),
        noAcad  ? ''                           : (rec.isStdMas ? ''                    : (e ? fmt0(e.maintained)        : '0')),
        noAcad  ? ''                           : (rec.isStdMas ? ''                    : (e ? fmt0(e.declined)          : '0')),
        // Math academic (SM: not applicable)
        noAcad  ? smNote                       : (rec.isStdMas ? 'N/A — Standards Mastery' : (m ? fmt0(m.validCount)          : '0')),
        noAcad  ? ''                           : (rec.isStdMas ? '' : (m ? fmt1(m.avgBoyScore)        : '')),
        noAcad  ? ''                           : (rec.isStdMas ? '' : (m ? fmt1(m.avgEndScore)        : '')),
        noAcad  ? ''                           : (rec.isStdMas ? '' : (m ? fmt1(m.avgScoreGain)       : '')),
        noAcad  ? ''                           : (rec.isStdMas ? '' : (m ? fmtPct(m.medianPctTypical) : '')),
        noAcad  ? ''                           : (rec.isStdMas ? '' : (m ? fmtPct(m.pctMeetTypical)   : '')),
        noAcad  ? ''                           : (rec.isStdMas ? '' : (m ? fmt0(m.improved)           : '0')),
        noAcad  ? ''                           : (rec.isStdMas ? '' : (m ? fmt0(m.maintained)         : '0')),
        noAcad  ? ''                           : (rec.isStdMas ? '' : (m ? fmt0(m.declined)           : '0')),
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
    lines.push(row('MOY (Winter 2026) data source: Google Sheet ID 1AIMqvTRrZ-XBf_-ePzVnGaPExFU3DfdPg_1sPj33RnI — ELA gid=912997533, Math gid=186448147. Live pull, 5-min cache.'));
    lines.push(row('iLearn schools (Pearl district ID nj-ilear99637) use MOY data. All 21 school names matched via MOY_SCHOOL_MAP; school attribution scoped per apprentice using Pearl session records.'));
    lines.push(row('Hamilton Township / Hamilton-Kuser (nj-hamil44973) and Haddon Township (nj-haddo65937) use MOY data. Remove from MOY_SCHOOLS once EOY Preliminary is confirmed in IRLAB.'));
    lines.push(row('Penns Grove (nj-penns90725) uses MOY data — Field Street Elementary and Paul W Carleton Elem. Alexandra Cristescu is the sole Penns Grove apprentice (Tier 3.5 district fallback).'));
    lines.push(row('All other schools use EOY Preliminary data from the portal IRLAB (live data).'));
    lines.push(row('Middlesex STEM uses Standards Mastery — iReady academic section excluded; surveys and attendance included.'));
    lines.push(row('Central Jersey College Prep: EOY Preliminary data not yet uploaded to IRLAB — academic columns populate once data arrives.'));
    lines.push(row('Gloucester ELA/Math from EOY Preliminary IRLAB filtered by Gloucester Township district and school name.'));
    lines.push(row('Scholar attribution (MOY, in priority order): (0) iReady User Name = Pearl login ID exact join; (1) instructor field in MOY CSV; (1.5) name bridge from ELA Pearl IDs — fixes Math when Math tab lacks User Name column; (2) Pearl session sets scoped to school or Pearl district ID (Column G); (3) single-apprentice school fallback; (3.5) single-apprentice district ID fallback; (4) survey name fallback.'));
    lines.push(row('Scholar attribution (EOY/IRLAB): (0) Pearl student ID; (A) IRLAB instructor field; (B) Pearl session name sets; (B2) school-level fallback when no session data; (B3) survey name fallback.'));
    lines.push(row('Pearl district account IDs (Column G in MOY sheet) scope attribution to correct district: nj-ilear99637 (iLearn), nj-hamil44973 (Hamilton), nj-haddo65937 (Haddon), nj-penns90725 (Penns Grove).'));
    lines.push(row('Attendance rate = attended / (attended + personal absences). Service interruptions excluded — matches Pearl Operations portal exactly.'));
    lines.push(row('Academic data as of June 5 2026 — EOY diagnostics incomplete for some sites.'));
    lines.push(row('Standards Mastery: Class Teacher(s) field identifies the NJTC apprentice. Form A = Pre-assessment, Form B = Post-assessment.'));
    lines.push('');

    // ─── SECTION 4: Standards Mastery ────────────────────────────────────
    const smRecs = records.filter(r => r.isStdMas);
    if (smRecs.length > 0) {
      lines.push(row('SECTION 4 -- STANDARDS MASTERY (MIDDLESEX COUNTY STEM CHARTER SCHOOL)'));
      lines.push(row(
        'Apprentice', 'Total Scholars', 'Assessment Pairs', 'Pre & Post Pairs',
        '% Improved', 'Avg Score Change (%)',
        'Pre: Beginning', 'Pre: Progressing', 'Pre: Proficient',
        'Post: Beginning', 'Post: Progressing', 'Post: Proficient'
      ));
      smRecs.forEach(rec => {
        const sm = rec.sm;
        if (!sm) { lines.push(row(rec.display, 'No data fetched', ...Array(11).fill(''))); return; }
        lines.push(row(
          rec.display, sm.scholars, sm.pairs, sm.withBoth,
          sm.pctImproved !== null ? sm.pctImproved + '%' : '',
          sm.avgGain     !== null ? sm.avgGain     + '%' : '',
          sm.prePl.Beginning, sm.prePl.Progressing, sm.prePl.Proficient,
          sm.postPl.Beginning, sm.postPl.Progressing, sm.postPl.Proficient
        ));
      });
      lines.push('');

      // Section 4b: per-scholar detail
      lines.push(row('SECTION 4B -- STANDARDS MASTERY SCHOLAR DETAIL'));
      lines.push(row(
        'Apprentice', 'Scholar', 'Grade', 'Assessment',
        'Pre Score (%)', 'Pre Placement',
        'Post Score (%)', 'Post Placement',
        'Score Change (%)', 'Direction'
      ));
      smRecs.forEach(rec => {
        const sm = rec.sm;
        if (!sm || !sm.rawPairs) return;
        const detailPairs = sm.rawPairs
          .filter(p => p.formA && p.formB)
          .sort((a,b) => (parseInt(a.grade)||99) - (parseInt(b.grade)||99) ||
                         ((a.formA||a.formB).lastName+'').localeCompare((b.formA||b.formB).lastName+''));
        detailPairs.forEach(p => {
          const src   = p.formA || p.formB;
          const gain  = Math.round((p.formB.score - p.formA.score) * 10) / 10;
          lines.push(row(
            rec.display,
            src.firstName + ' ' + src.lastName,
            p.grade, p.asmBase,
            p.formA.score, p.formA.placement,
            p.formB.score, p.formB.placement,
            gain, p.formB.direction
          ));
        });
      });
      lines.push('');
    }

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
