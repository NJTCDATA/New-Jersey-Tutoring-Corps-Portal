(function () {
  'use strict';

  // ── Period definitions ──────────────────────────────────────────────────────
  const PERIODS = [
    {
      id: 'sy2526',
      label: 'SY 25-26',
      start: new Date(2025, 6, 1),   // Jul 1, 2025
      end:   new Date(2026, 5, 30),  // Jun 30, 2026
      source: 'hr_emps',
      cycleKey: 'school year 25-26',
    },
    {
      id: 'summer2026',
      label: 'Summer 2026',
      start: new Date(2026, 4, 1),
      end:   new Date(2026, 7, 31),
      source: 'tracker',
      cycleKey: 'summer 2026',
    },
    {
      id: 'sy2627',
      label: 'SY 26-27',
      start: new Date(2026, 8, 1),
      end:   new Date(2027, 5, 30),
      source: 'tracker',
      cycleKey: 'school year 26-27',
    },
  ];

  // ── SY 25-26 termination date overrides ─────────────────────────────────────
  const SY2526_TERM_DATES = {
    'evan white':                          '8/19/2025',
    'manuel algarin':                      '8/28/2025',
    'clifford evan':                       '9/5/2025',
    'janelle lee':                         '9/23/2025',
    'michael d\'alessio':                  '9/24/2025',
    'aleah mcwilliams':                    '9/25/2025',
    'takiyah jackson':                     '9/25/2025',
    'dhrupalben naseet':                   '10/3/2025',
    'ciara cosby':                         '10/9/2025',
    'shanice thomas':                      '10/9/2025',
    'joann maybury':                       '10/14/2025',
    'ka\'deasia washington':               '10/17/2025',
    'kadeasia washington':                 '10/17/2025',
    'laila modzelewski':                   '10/27/2025',
    'yohanny rosario':                     '10/31/2025',
    'claudia tumelus':                     '10/31/2025',
    'hind hamoda':                         '10/31/2025',
    'hendrix garcia':                      '11/3/2025',
    'ashley garcia':                       '11/3/2025',
    'genesis rosich':                      '11/4/2025',
    'pankajbharathi sowmianarayanan':      '11/11/2025',
    'gunjan pandya':                       '11/15/2025',
    'michelle kim':                        '11/17/2025',
    'nicole cill':                         '11/24/2025',
    'colin camp':                          '12/3/2025',
    'daniel diquinzio':                    '12/3/2025',
    'lesley waszen':                       '12/3/2025',
    'zakaria imessaoudene':                '12/8/2025',
    'davide berardi':                      '12/18/2025',
    'edwin montesdeoca':                   '12/18/2025',
    'kimara ramsey':                       '12/18/2025',
    'tanya israel-sainthilaire':           '12/18/2025',
    'tanya israel sainthilaire':           '12/18/2025',
    'jodi bianchi':                        '1/2/2026',
    'laura gallucci':                      '1/2/2026',
    'disan singleton':                     '1/7/2026',
    'kamiah shelton':                      '1/7/2026',
    'sharlene rahim':                      '1/21/2026',
    'lemuer perez de jesus':               '1/22/2026',
    'lemuer pérez de jesus':               '1/22/2026',
    'everene williams':                    '1/22/2026',
    'chandler talty':                      '1/28/2026',
    'henrika hill-joseph':                 '1/28/2026',
    'henrika hill joseph':                 '1/28/2026',
    'angelica werts':                      '1/30/2026',
    'kathryn hennigan':                    '2/1/2026',
    'katie hennigan':                      '2/1/2026',
    'jeily insuasti-torres':               '2/6/2026',
    'jeily insuasti torres':               '2/6/2026',
    'glenn harris':                        '2/6/2026',
    'victoria nachimson':                  '2/17/2026',
    'amro abdelrazek':                     '2/25/2026',
    'maureen farrell':                     '2/25/2026',
    'carolyn butler':                      '2/26/2026',
    'susan dominquez':                     '2/27/2026',
    'jenny seligman':                      '2/27/2026',
    'janice reaves':                       '3/6/2026',
    'alyssa deangelis':                    '3/9/2026',
    'colleen elam':                        '3/9/2026',
    'maria zia':                           '3/11/2026',
    'shayla hibbert':                      '3/11/2026',
    'lataiva balmer':                      '3/16/2026',
    'pia walden':                          '3/17/2026',
    'jacob leebron':                       '3/19/2026',
    'sara gonzalez':                       '3/19/2026',
    'monica brown':                        '3/23/2026',
    'brittany douglas':                    '3/23/2026',
    'daivon devard':                       '3/26/2026',
    'shakirah miller':                     '3/26/2026',
    'rebeka lange':                        '3/27/2026',
    'nicole coleman-odigie':               '3/27/2026',
    'nicole coleman odigie':               '3/27/2026',
    'jaejin lee':                          '4/8/2026',
    'abdallah abada':                      '4/13/2026',
    'apollo monroy-polanco':               '4/13/2026',
    'apollo monroy polanco':               '4/13/2026',
    'jessica flores':                      '4/17/2026',
    'monifa thomas-kelsey':                '4/21/2026',
    'monifa thomas kelsey':                '4/21/2026',
    'olga berkin':                         '4/23/2026',
    'linda fenty':                         '4/27/2026',
    'shannon spillane':                    '4/30/2026',
  };

  // ── SY 25-26 Program Completion Separation dates ────────────────────────────
  // Source of truth: Pearl Operations last-session date per staff member → program end date
  // from SY 25-26 School Year Database. Staff with no personal termination who completed
  // their full program obligation are counted here as "Program Completion Separations."
  // Methodology: Pearl last-session district → SY DB program end date per site cluster.
  // Name keys are lowercase, spaces normalized. 86 staff verified against Pearl + SY DB.
  const SY2526_PROGRAM_END_DATES = {
    // ── April 2026 (38 staff) ────────────────────────────────────────────────
    'alexandra cristescu':       '4/23/2026',   // Penns Grove | Field Street
    'amanda dawson':             '4/9/2026',    // Gloucester Township | Loring Flemming
    'ariana stubbs':             '4/24/2026',   // Hamilton | Crockett MS
    'breaunna braxton':          '4/16/2026',   // GLA Charter Schools
    'caitlin evgeniadis':        '4/24/2026',   // Hamilton | Wilson Elem
    'camille rogers':            '4/24/2026',   // Hamilton | Crockett MS
    'chelsea ostrowski':         '4/23/2026',   // Penns Grove | Field Street
    'christina funderburk':      '4/30/2026',   // Paterson | PCSST
    'crysten wood':              '4/9/2026',    // Gloucester | Loring Flemming
    'danielle hallahan':         '4/16/2026',   // GLA Charter Schools (SC/IC role)
    'elizabeth mccafferty':      '4/23/2026',   // Penns Grove | Carleton
    'eric zeidman':              '4/24/2026',   // Hamilton | Grice MS
    'fasiha shaikh':             '4/24/2026',   // Hamilton | Kuser Elem
    'jessica west':              '4/24/2026',   // Hamilton | Greenwood Elem
    'jill ilagan':               '4/9/2026',    // Gloucester | Loring Flemming
    'juanita brown-lyons':       '4/16/2026',   // GLA Charter Schools
    'katharine samberg-lawrence':'4/24/2026',   // Hamilton | Crockett MS (SUB role)
    'katie rose davis':          '4/24/2026',   // Hamilton | Grice MS
    'katrina valentin':          '4/9/2026',    // Gloucester | Loring Flemming
    'laura guzzo':               '4/23/2026',   // Penns Grove | Field Street
    'lauren campbell':           '4/23/2026',   // Penns Grove | Carleton
    'lauren eckles':             '4/24/2026',   // Hamilton | IC/SC role, HR district
    'lauren groth':              '4/23/2026',   // Penns Grove | Field Street
    'lavern maison':             '4/30/2026',   // Paterson | PCSST Wabash
    'lilia quintero':            '4/24/2026',   // Hamilton | Kuser Elem
    'marta reyes':               '4/24/2026',   // Hamilton | Kuser Elem
    'marissa onesi':             '4/16/2026',   // GLA Charter Schools
    'miranda marshall':          '4/23/2026',   // Penns Grove | PGMS
    'sharmina ellis':            '4/23/2026',   // Penns Grove | PGMS
    'shirley mcdougald':         '4/9/2026',    // Gloucester | Loring Flemming
    'sophia petronglo':          '4/23/2026',   // Penns Grove | PGMS
    'susan sheerin':             '4/24/2026',   // Hamilton | Greenwood (SUB role)
    'tohrn taylor':              '4/23/2026',   // Penns Grove | Carleton
    'tabitha parris':            '4/23/2026',   // Penns Grove | Carleton
    'tanzeela qazi':             '4/24/2026',   // Hamilton | Wilson Elem
    'tara flynn-angelini':       '4/24/2026',   // Hamilton | Klockner Elem
    'vincent duong':             '4/23/2026',   // Penns Grove | PGMS
    'whitney davis':             '4/30/2026',   // Paterson | PCSST 8-12
    // ── May 2026 (44 staff) ─────────────────────────────────────────────────
    'aliviyah goodson':          '5/7/2026',    // iLearn CMO | Bergen MS
    'andrea felton':             '5/7/2026',    // iLearn CMO | Passaic MS
    'arelis rodriguez':          '5/7/2026',    // iLearn CMO | Bergen MS
    'austin kim':                '5/14/2026',   // String Theory | Phila Charter Arts
    'avani jimenez':             '5/14/2026',   // Middlesex STEM Charter
    'benjamin apell':            '5/14/2026',   // String Theory | Phila Charter Arts
    'bryanna matos':             '5/7/2026',    // iLearn CMO | Clifton MS
    'cara debonis':              '5/7/2026',    // iLearn CMO | IC role
    'carla borbon':              '5/14/2026',   // Middlesex STEM Charter
    'carlos jacho':              '5/7/2026',    // iLearn CMO | Paterson ES
    'dametris osbourne':         '5/7/2026',    // iLearn CMO | Clifton HS
    'eva meneses immerso':       '5/7/2026',    // iLearn CMO | Hudson ES
    'faye lewis':                '5/29/2026',   // Haddon Township | Jennings Elem
    'ian anderson':              '5/7/2026',    // iLearn CMO | Hudson MS
    'james dejesus':             '5/7/2026',    // iLearn CMO | Hudson MS
    'jasmine ramsey':            '5/7/2026',    // iLearn CMO | Passaic MS
    'jazmin garcia':             '5/7/2026',    // iLearn CMO | Bergen MS
    'jeanne burns':              '5/7/2026',    // iLearn CMO | Bergen ES
    'jeffrey wilder':            '5/7/2026',    // iLearn CMO | Paterson ES
    'jessica pierresaint':       '5/7/2026',    // iLearn CMO | Hudson MS
    'keisha lopez':              '5/7/2026',    // iLearn CMO | Clifton ES
    'kyeisah livingston':        '5/7/2026',    // iLearn CMO | Bergen MS
    'la shanee davis':           '5/7/2026',    // iLearn CMO | Clifton MS (Pearl: Renee Davis)
    'lakeeda sessoms':           '5/7/2026',    // iLearn CMO | Paterson MS (SC role)
    'leila einhorn':             '5/14/2026',   // String Theory | Phila Charter Arts
    'leslie seale black':        '5/7/2026',    // iLearn CMO | Passaic ES
    'loan nguyen':               '5/29/2026',   // Haddon Township | Jennings Elem
    'maria gutierrez':           '5/7/2026',    // iLearn CMO | Passaic ES (Pearl: Mary Carmen)
    'maryann ficker':            '5/7/2026',    // iLearn CMO | Paterson ES
    'melissa mazza':             '5/7/2026',    // iLearn CMO | Bergen MS
    'micaela wilkerson':         '5/29/2026',   // Haddon Township | Van Sciver
    'michael mun':               '5/7/2026',    // iLearn CMO | Paterson MS
    'mushana dunham':            '5/7/2026',    // iLearn CMO | Clifton MS
    'nicholas antoine':          '5/14/2026',   // String Theory | Phila Charter Arts
    'nicholas hoover':           '5/29/2026',   // Haddon Township | Strawbridge
    'norelis ramirez':           '5/7/2026',    // iLearn CMO | Paterson ES
    'roselyn gohagan':           '5/7/2026',    // iLearn CMO | Paterson MS
    'shahzeeb ahmad':            '5/7/2026',    // iLearn CMO | Bergen ES
    'sharon k kessel':           '5/7/2026',    // iLearn CMO | Clifton ES
    'sheimaa abada':             '5/7/2026',    // iLearn CMO | Hudson MS
    'subul sadiq':               '5/7/2026',    // iLearn CMO | Hudson ES
    'tamia williams':            '5/7/2026',    // iLearn CMO | Passaic ES
    'theodore mills':            '5/7/2026',    // iLearn CMO | Passaic MS
    'vicki toffler':             '5/7/2026',    // iLearn CMO | Silk City (SUB role)
    // ── June 2026 (4 staff — CJCP still active through program end) ─────────
    'naima boutira':             '6/2/2026',    // Central Jersey College Prep
    'pooja tyagi':               '6/2/2026',    // Central Jersey College Prep
    'rabia nawaz':               '6/2/2026',    // Central Jersey College Prep
    'shabnam mustari':           '6/2/2026',    // Central Jersey College Prep
    // ── Not included (floating subs / no program site) ─────────────────────
    // adetomiwa abayomi opeolu — Sub, All Locations, no Pearl sessions
    // jessica latanzio-crespo  — Master Trainer, org-wide role, no site
    // karen schiavi            — Sub, All Locations, no Pearl sessions
  };

  // ── SY 25-26 hardcoded new hire counts by month ──────────────────────────────
  const SY2526_NEW_HIRE_COUNTS = {
    '2025-07':  1,
    '2025-08': 16,
    '2025-09': 12,
    '2025-10': 10,
    '2025-11':  4,
    '2025-12': 23,
    '2026-01':  5,
    '2026-02': 11,
    '2026-03':  6,
  };

  const ROLE_BUCKETS = ['Tutor', 'Site Coordinator', 'Instructional Coach', 'Dual Role'];

  // ── Date helpers ─────────────────────────────────────────────────────────────
  function parseDate(str) {
    if (!str) return null;
    const s = str.trim();
    if (!s) return null;
    const mdy = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
    if (mdy) {
      let yr = parseInt(mdy[3], 10);
      if (yr < 100) yr += 2000;
      const d = new Date(yr, parseInt(mdy[1], 10) - 1, parseInt(mdy[2], 10));
      return isNaN(d.getTime()) ? null : d;
    }
    const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (iso) {
      const d = new Date(parseInt(iso[1], 10), parseInt(iso[2], 10) - 1, parseInt(iso[3], 10));
      return isNaN(d.getTime()) ? null : d;
    }
    return null;
  }

  function monthKey(date) {
    if (!date) return null;
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  }

  function monthLabel(key) {
    if (!key) return '';
    const [yr, mo] = key.split('-');
    const names = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return `${names[parseInt(mo, 10) - 1]} ${yr}`;
  }

  function monthsInRange(start, end) {
    const months = [];
    const cur  = new Date(start.getFullYear(), start.getMonth(), 1);
    const last = new Date(end.getFullYear(),   end.getMonth(),   1);
    while (cur <= last) {
      months.push(monthKey(cur));
      cur.setMonth(cur.getMonth() + 1);
    }
    return months;
  }

  // ── Employee normalization ───────────────────────────────────────────────────
  function normalizeTrackerRow(row, periodStart) {
    if (row.isPreApp) return null;
    const acceptedStr = (row.offerAccepted || '').trim().toLowerCase();
    if (!acceptedStr || acceptedStr === 'no' || acceptedStr === 'n/a') return null;
    let startDate = parseDate(row.offerAccepted);
    if (!startDate) {
      if (acceptedStr === 'yes') {
        startDate = parseDate(row.offerSent) || periodStart || new Date(2026, 5, 1);
      } else {
        return null;
      }
    }
    return {
      name:       row.fullName || `${row.firstName} ${row.lastName}`.trim(),
      role:       row.role || '',
      startDate,
      termDate:   parseDate(row.termDate) || null,
      terminated: row.isTerminated,
      resignType: (row.resignType || '').toLowerCase(),
      cycle:      (row.cycle || '').toLowerCase(),
      isSummer:   row.isSummer,
      isSY:       row.isSY,
      location:   row.location || '',
      district:   row.district || '',
    };
  }

  function normalizeHREmps() {
    const arr       = (typeof HR_EMPS !== 'undefined') ? HR_EMPS : [];
    const normName  = n => (n || '').toLowerCase().replace(/\s+/g, ' ').trim();
    return arr
      .filter(e => e && e.n && e.y && e.y.includes('2025-2026'))
      .map(e => {
        let termDate = (e._termDate && e._termDate.trim()) ? parseDate(e._termDate.trim()) : null;
        if (!termDate) {
          const override = SY2526_TERM_DATES[normName(e.n)];
          if (override) termDate = parseDate(override);
        }
        // Program completion date — only for Active staff with no personal termination
        const progEndStr = SY2526_PROGRAM_END_DATES[normName(e.n)];
        const progEndDate = progEndStr ? parseDate(progEndStr) : null;
        return {
          name:         e.n,
          role:         e.r || '',
          startDate:    new Date(2025, 8, 1),
          termDate,
          terminated:   e.s === 'Terminated' || !!termDate,
          resignType:   (e._termType || '').toLowerCase(),
          cycle:        'school year 25-26',
          isSummer:     false,
          isSY:         true,
          progEndDate,  // null for voluntarily/involuntarily terminated staff
          isActive:     e.s === 'Active' && !termDate,
        };
      });
  }

  // ── Compute program completion separations from NJTC_LOCATIONS + Tracker ────
  // For 26-27 / Summer periods: when a site's status is "Wrapped" and endpoint
  // falls in the current month, count active (non-personally-terminated) tracker
  // staff at that location as program completion separations for that month.
  function computeProgEndFromTracker(cycleMatch, mk) {
    const locRows  = window.NJTC_LOCATIONS;
    const tracker  = window.NJTC_ONSITE_TRACKER;
    if (!locRows || !locRows.length || !tracker || !tracker.length) return 0;

    const [yr, mo] = mk.split('-').map(Number);
    const firstDay = new Date(yr, mo - 1, 1);
    const lastDay  = new Date(yr, mo, 0);

    // Find locations whose endpoint falls in this month and status = Wrapped
    const wrappedSites = locRows.filter(r => {
      if ((r.cycle || '').toLowerCase().includes(cycleMatch) === false) return false;
      const endDt = parseDate(r.endpoint);
      if (!endDt) return false;
      const st = (r.status || '').toLowerCase();
      if (!st.includes('wrap') && !st.includes('ended') && !st.includes('complete')) return false;
      return endDt >= firstDay && endDt <= lastDay;
    });
    if (!wrappedSites.length) return 0;

    // Normalise location keys for matching
    const norm = s => (s || '').toLowerCase().replace(/[^a-z0-9]/g, ' ').replace(/\s+/g, ' ').trim();
    // Build set of (district, school) pairs for wrapped sites
    const wrappedKeys = new Set(wrappedSites.map(r => norm(r.district) + '|' + norm(r.school)));
    const wrappedDistrics = new Set(wrappedSites.map(r => norm(r.district)));

    let count = 0;
    // Deduplicate by name — one person counts once even if they served multiple wrapping sites
    const counted = new Set();
    tracker
      .filter(r => (r.cycle || '').toLowerCase().includes(cycleMatch))
      .filter(r => r.isActive && !r.isTerminated && !r.isPreApp)
      .forEach(r => {
        const locKey  = norm(r.district) + '|' + norm(r.location);
        const distKey = norm(r.district);
        // Match by full district|location OR by district alone (when location name varies)
        const matched = wrappedKeys.has(locKey) || wrappedDistrics.has(distKey);
        if (matched && !counted.has((r.fullName || '').toLowerCase())) {
          counted.add((r.fullName || '').toLowerCase());
          count++;
        }
      });
    return count;
  }

  // ── Stats computation ────────────────────────────────────────────────────────
  function computeMonthStats(employees, mk, newHireOverride, period) {
    const [yr, mo] = mk.split('-').map(Number);
    const firstDay = new Date(yr, mo - 1, 1);
    const lastDay  = new Date(yr, mo, 0);

    const active = employees.filter(e => {
      if (e.startDate > lastDay) return false;
      if (e.termDate && e.termDate < firstDay) return false;
      // Active staff whose program ends this month are still active during the month
      return true;
    });

    const newHiresCount = (newHireOverride && newHireOverride[mk] != null)
      ? newHireOverride[mk]
      : employees.filter(e => {
          const s = e.startDate;
          return s >= firstDay && s <= lastDay;
        }).length;

    const termsThisMonth = employees.filter(e => {
      if (!e.termDate) return false;
      if (!e.terminated) return false;
      return e.termDate >= firstDay && e.termDate <= lastDay;
    });

    // Fixed voluntary/involuntary filter — 'involuntary'.includes('volunt') is TRUE
    // so we must use exact/startsWith matching, not includes()
    const voluntary   = termsThisMonth.filter(e =>
      e.resignType === 'voluntary' || e.resignType.startsWith('voluntary')
    );
    const involuntary = termsThisMonth.filter(e =>
      e.resignType === 'involuntary' ||
      (!e.resignType.startsWith('voluntary') && e.resignType !== '')
    );

    // ── Program Completion Separations ──────────────────────────────────────
    // SY 25-26: driven by SY2526_PROGRAM_END_DATES (Pearl last-session → SY DB end dates)
    // 26-27+:   driven by live NJTC_LOCATIONS wrapped sites vs. NJTC_ONSITE_TRACKER
    let programEnd = 0;
    if (period && period.source === 'hr_emps') {
      // SY 25-26 path: count Active employees whose program ended this month
      // Active = no personal termination (not in vol/invol buckets)
      programEnd = employees.filter(e => {
        if (!e.progEndDate) return false;
        if (e.terminated) return false;  // already counted in vol/invol if they have a termDate
        return e.progEndDate >= firstDay && e.progEndDate <= lastDay;
      }).length;
    } else if (period) {
      // 26-27/Summer path: live location data
      programEnd = computeProgEndFromTracker(period.cycleKey.toLowerCase(), mk);
    }

    const byRole = {};
    ROLE_BUCKETS.forEach(r => { byRole[r] = 0; });
    active.forEach(e => {
      const key = ROLE_BUCKETS.find(r => e.role.toLowerCase().includes(r.toLowerCase())) || 'Other';
      byRole[key] = (byRole[key] || 0) + 1;
    });

    return {
      mk,
      label:       monthLabel(mk),
      total:       active.length,
      newHires:    newHiresCount,
      voluntary:   voluntary.length,
      involuntary: involuntary.length,
      programEnd,
      termTotal:   termsThisMonth.length + programEnd,
      byRole,
    };
  }

  // ── Open positions ───────────────────────────────────────────────────────────
  function computeOpenings(period) {
    const locRows    = window.NJTC_LOCATIONS;
    const cycleMatch = period.cycleKey.toLowerCase();
    if (locRows && locRows.length) {
      const filtered = locRows.filter(r => {
        const cy = (r.cycle || '').toLowerCase();
        return !cy || cy.includes(cycleMatch);
      });
      if (filtered.length) {
        const buckets = {};
        ROLE_BUCKETS.forEach(r => { buckets[r] = { filled: 0, total: 0 }; });
        const num = v => { const n = parseFloat((v || '').toString().replace(/[^0-9.]/g, '')); return isNaN(n) ? 0 : Math.round(n); };
        filtered.forEach(r => {
          buckets['Tutor'].total              += num(r.tutorPos);
          buckets['Tutor'].filled             += num(r.tutorFill);
          buckets['Site Coordinator'].total    += num(r.scPos);
          buckets['Site Coordinator'].filled   += num(r.scFill);
          buckets['Instructional Coach'].total  += num(r.icPos);
          buckets['Instructional Coach'].filled += num(r.icFill);
          buckets['Dual Role'].total            += num(r.drPos);
          buckets['Dual Role'].filled           += num(r.drFill);
        });
        return buckets;
      }
    }
    const tracker = window.NJTC_ONSITE_TRACKER;
    if (!tracker || !tracker.length) return null;
    const rows = tracker.filter(r => (r.cycle || '').toLowerCase().includes(cycleMatch));
    if (!rows.length) return null;
    const buckets = {};
    ROLE_BUCKETS.forEach(r => { buckets[r] = { filled: 0, total: 0 }; });
    rows.forEach(r => {
      if (r.isPreApp) return;
      const roleKey = ROLE_BUCKETS.find(b => (r.role || '').toLowerCase().includes(b.toLowerCase()));
      if (!roleKey) return;
      buckets[roleKey].total++;
      if (r.isActive && !r.isTerminated) buckets[roleKey].filled++;
    });
    return buckets;
  }

  // ── Render helpers ───────────────────────────────────────────────────────────
  function statCard(label, value, sub, color) {
    color = color || 'var(--navy)';
    return `
      <div style="background:var(--surface);border:1.5px solid var(--border);border-radius:10px;padding:1.25rem 1rem;text-align:center;min-width:120px;flex:1">
        <div style="font-size:2rem;font-weight:800;color:${color};line-height:1">${value}</div>
        <div style="font-size:.72rem;font-weight:700;color:var(--navy);margin-top:.35rem;text-transform:uppercase;letter-spacing:.05em">${label}</div>
        ${sub ? `<div style="font-size:.68rem;color:var(--muted);margin-top:.2rem">${sub}</div>` : ''}
      </div>`;
  }

  function renderMonthCard(stat, isSelected) {
    const border = isSelected ? '2px solid var(--accent)' : '1.5px solid var(--border)';
    const bg     = isSelected ? 'rgba(37,99,235,.06)' : 'var(--surface)';
    const hasProgramEnd = stat.programEnd > 0;

    // Program End pill — shown inline in month header when non-zero
    const progPill = hasProgramEnd
      ? `<span style="font-size:.68rem;font-weight:700;padding:.2rem .65rem;background:rgba(14,165,233,.12);color:#0369a1;border-radius:20px;border:1px solid rgba(14,165,233,.25)">
           🎓 ${stat.programEnd} program completion${stat.programEnd > 1 ? 's' : ''}
         </span>`
      : '';

    return `
      <div style="background:${bg};border:${border};border-radius:12px;padding:1.125rem 1rem;margin-bottom:.75rem">
        <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:.5rem;margin-bottom:.875rem">
          <span style="font-size:.9rem;font-weight:800;color:var(--navy)">${stat.label}</span>
          <div style="display:flex;gap:.5rem;flex-wrap:wrap;align-items:center">
            ${stat.newHires > 0 ? `<span style="font-size:.68rem;font-weight:700;padding:.2rem .65rem;background:rgba(16,185,129,.12);color:#065f46;border-radius:20px">+${stat.newHires} new hire${stat.newHires > 1 ? 's' : ''}</span>` : ''}
            ${progPill}
          </div>
        </div>
        <div style="display:flex;gap:.625rem;flex-wrap:wrap">
          ${statCard('Total Employees', stat.total, 'prev. month', 'var(--navy)')}
          ${statCard('New Hires', stat.newHires, 'this month', '#059669')}
          ${statCard('Voluntary Terms', stat.voluntary, '', '#d97706')}
          ${statCard('Involuntary Terms', stat.involuntary, '', '#dc2626')}
          ${hasProgramEnd ? statCard('Program Completions', stat.programEnd, 'program end', '#0ea5e9') : ''}
        </div>
        ${hasProgramEnd ? `
        <div style="margin-top:.75rem;padding:.625rem .875rem;background:rgba(14,165,233,.07);border-radius:8px;border-left:3px solid #0ea5e9;font-size:.75rem;color:#0369a1;line-height:1.5">
          <strong>Program Completion Separations:</strong> ${stat.programEnd} staff member${stat.programEnd > 1 ? 's' : ''} whose
          program${stat.programEnd > 1 ? 's' : ''} concluded this month per the SY program end schedule.
          These are planned, program-driven separations — not resignations or performance actions.
        </div>` : ''}
      </div>`;
  }

  function renderOpeningsTable(openings) {
    if (!openings) return '<p style="color:var(--muted);font-size:.85rem">Open position data requires Tracker data to be loaded.</p>';
    const rows = ROLE_BUCKETS.map(r => {
      const d    = openings[r] || { filled: 0, total: 0 };
      const open = Math.max(0, d.total - d.filled);
      return `<tr>
        <td style="padding:.5rem .75rem;font-weight:600;color:var(--navy)">${r}</td>
        <td style="padding:.5rem .75rem;text-align:center">${d.total}</td>
        <td style="padding:.5rem .75rem;text-align:center;color:#059669">${d.filled}</td>
        <td style="padding:.5rem .75rem;text-align:center;color:${open > 0 ? '#dc2626' : '#059669'};font-weight:700">${open}</td>
      </tr>`;
    }).join('');
    return `
      <table style="width:100%;border-collapse:collapse;font-size:.85rem">
        <thead>
          <tr style="border-bottom:2px solid var(--border)">
            <th style="padding:.5rem .75rem;text-align:left;color:var(--muted);font-size:.72rem;text-transform:uppercase;letter-spacing:.06em">Role</th>
            <th style="padding:.5rem .75rem;text-align:center;color:var(--muted);font-size:.72rem;text-transform:uppercase;letter-spacing:.06em">Positions</th>
            <th style="padding:.5rem .75rem;text-align:center;color:var(--muted);font-size:.72rem;text-transform:uppercase;letter-spacing:.06em">Filled</th>
            <th style="padding:.5rem .75rem;text-align:center;color:var(--muted);font-size:.72rem;text-transform:uppercase;letter-spacing:.06em">Vacancies</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>`;
  }

  // ── CSV export ────────────────────────────────────────────────────────────────
  function exportCSV(stats, periodLabel) {
    const rows = [
      ['Period','Month','Total Employees','New Hires','Voluntary Terminations','Involuntary Terminations','Program Completion Separations','Total Separations'],
      ...stats.map(s => [periodLabel, s.label, s.total, s.newHires, s.voluntary, s.involuntary, s.programEnd, s.termTotal]),
    ];
    const csv  = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `NJTC_DOL_Report_${periodLabel.replace(/\s+/g, '_')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // ── PDF export ────────────────────────────────────────────────────────────────
  function exportPDF(stats, periodLabel, openings) {
    const rows = stats.map(s => `
      <tr>
        <td>${s.label}</td>
        <td style="text-align:center">${s.total}</td>
        <td style="text-align:center;color:#059669">${s.newHires}</td>
        <td style="text-align:center;color:#d97706">${s.voluntary}</td>
        <td style="text-align:center;color:#dc2626">${s.involuntary}</td>
        <td style="text-align:center;color:#0369a1">${s.programEnd}</td>
        <td style="text-align:center;font-weight:700">${s.termTotal}</td>
      </tr>`).join('');

    const openRows = openings ? ROLE_BUCKETS.map(r => {
      const d    = openings[r] || { filled: 0, total: 0 };
      const open = Math.max(0, d.total - d.filled);
      return `<tr>
        <td>${r}</td>
        <td style="text-align:center">${d.total}</td>
        <td style="text-align:center">${d.filled}</td>
        <td style="text-align:center;color:${open > 0 ? '#dc2626' : '#059669'}">${open}</td>
      </tr>`;
    }).join('') : '';

    const totalProgEnd  = stats.reduce((a, s) => a + s.programEnd, 0);
    const totalVol      = stats.reduce((a, s) => a + s.voluntary, 0);
    const totalInvol    = stats.reduce((a, s) => a + s.involuntary, 0);
    const totalSep      = stats.reduce((a, s) => a + s.termTotal, 0);
    const totalHires    = stats.reduce((a, s) => a + s.newHires, 0);

    const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>NJTC DOL Monthly Employment Report — ${periodLabel}</title>
<style>
  body { font-family: 'Helvetica Neue', Arial, sans-serif; color: #1e293b; margin: 0; padding: 2rem; font-size: 12px; }
  .header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 2rem; padding-bottom: 1rem; border-bottom: 3px solid #1e3a5f; }
  .logo { font-size: 1.25rem; font-weight: 800; color: #1e3a5f; letter-spacing: -.02em; }
  .subtitle { font-size: .75rem; color: #64748b; }
  h2 { font-size: 1rem; font-weight: 700; color: #1e3a5f; margin: 1.5rem 0 .75rem; text-transform: uppercase; letter-spacing: .06em; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 1.5rem; }
  th { background: #1e3a5f; color: #fff; padding: .5rem .75rem; text-align: left; font-size: .7rem; text-transform: uppercase; letter-spacing: .06em; }
  td { padding: .45rem .75rem; border-bottom: 1px solid #e2e8f0; }
  tr:nth-child(even) td { background: #f8fafc; }
  .summary-row td { background: #f0f9ff !important; font-weight: 700; border-top: 2px solid #0ea5e9; }
  .footer { margin-top: 2rem; padding-top: 1rem; border-top: 1px solid #e2e8f0; font-size: .7rem; color: #94a3b8; }
  .note { background: #f0f9ff; border-left: 3px solid #0ea5e9; padding: .5rem .75rem; font-size: .72rem; color: #0369a1; margin-bottom: 1.5rem; }
  .prog-note { background: #ecfdf5; border-left: 3px solid #059669; padding: .5rem .75rem; font-size: .72rem; color: #065f46; margin-bottom: 1rem; }
</style>
</head>
<body>
  <div class="header">
    <div>
      <div class="logo">New Jersey Tutoring Corps</div>
      <div class="subtitle">DOL Monthly Employment Report &mdash; ${periodLabel}</div>
    </div>
    <div class="subtitle">Generated: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</div>
  </div>
  <div class="note">Pre-apprentices are not counted as employees. Tutor Apprentices are employees. Total employees = headcount active during the month (not cycle-to-date cumulative).</div>
  <div class="prog-note"><strong>Program Completion Separations</strong> are planned, program-driven separations that occur when a partner site's program concludes per the contracted end date. These are distinct from voluntary resignations and involuntary terminations and are reported separately for DOL accuracy.</div>
  <h2>Monthly Employment Summary</h2>
  <table>
    <thead>
      <tr>
        <th>Month</th>
        <th style="text-align:center">Total Employees</th>
        <th style="text-align:center">New Hires</th>
        <th style="text-align:center">Voluntary Terms</th>
        <th style="text-align:center">Involuntary Terms</th>
        <th style="text-align:center">Program Completions</th>
        <th style="text-align:center">Total Separations</th>
      </tr>
    </thead>
    <tbody>
      ${rows}
      <tr class="summary-row">
        <td>PERIOD TOTAL</td>
        <td style="text-align:center">—</td>
        <td style="text-align:center;color:#059669">${totalHires}</td>
        <td style="text-align:center;color:#d97706">${totalVol}</td>
        <td style="text-align:center;color:#dc2626">${totalInvol}</td>
        <td style="text-align:center;color:#0369a1">${totalProgEnd}</td>
        <td style="text-align:center">${totalSep}</td>
      </tr>
    </tbody>
  </table>
  ${openings ? `<h2>Positions by Role</h2>
  <table>
    <thead><tr><th>Role</th><th style="text-align:center">Positions</th><th style="text-align:center">Filled</th><th style="text-align:center">Vacancies</th></tr></thead>
    <tbody>${openRows}</tbody>
  </table>` : ''}
  <div class="footer">
    NJTC Central Team Portal &bull; Confidential — For internal DOL reporting use only &bull; Impact Solutions Group LLC
  </div>
</body>
</html>`;

    const win = window.open('', '_blank');
    if (!win) { alert('Pop-up blocked. Please allow pop-ups for this site and try again.'); return; }
    win.document.write(html);
    win.document.close();
    setTimeout(() => { win.print(); }, 600);
  }

  // ── Main render ───────────────────────────────────────────────────────────────
  window.renderDOLReport = function renderDOLReport(container) {
    if (!container) return;

    let _activePeriodId = 'sy2526';
    const today = new Date();
    for (const p of PERIODS) {
      if (today >= p.start && today <= p.end) { _activePeriodId = p.id; break; }
    }

    function getEmployees(period) {
      if (period.source === 'hr_emps') return normalizeHREmps();
      const tracker = window.NJTC_ONSITE_TRACKER;
      if (!tracker || !tracker.length) return [];
      const cycleMatch = period.cycleKey.toLowerCase();
      return tracker
        .filter(r  => (r.cycle || '').toLowerCase().includes(cycleMatch))
        .map(r     => normalizeTrackerRow(r, period.start))
        .filter(Boolean);
    }

    function render() {
      const period    = PERIODS.find(p => p.id === _activePeriodId);
      const employees = getEmployees(period);
      const months    = monthsInRange(period.start, period.end);
      const newHireOverride = period.id === 'sy2526' ? SY2526_NEW_HIRE_COUNTS : null;
      // Pass period into computeMonthStats so program-end path knows the source
      const stats     = months.map(mk => computeMonthStats(employees, mk, newHireOverride, period));
      const openings  = computeOpenings(period);

      const totalProgEnd = stats.reduce((a, s) => a + s.programEnd, 0);
      const totalVol     = stats.reduce((a, s) => a + s.voluntary, 0);
      const totalInvol   = stats.reduce((a, s) => a + s.involuntary, 0);

      const periodBtns = PERIODS.map(p =>
        `<button class="pst-tab${p.id === _activePeriodId ? ' active' : ''}" onclick="window.__dolSetPeriod('${p.id}')" style="font-size:.8rem">${p.label}</button>`
      ).join('');

      const monthRows = stats.map(s => renderMonthCard(s, false)).join('');

      // Program Completion callout strip — only visible when totalProgEnd > 0
      const progStrip = totalProgEnd > 0 ? `
        <div style="background:linear-gradient(135deg,#0c4a6e,#0369a1);color:#fff;border-radius:12px;padding:1.125rem 1.25rem;margin-bottom:1.5rem;display:flex;align-items:center;gap:1.25rem;flex-wrap:wrap">
          <div style="font-size:2.25rem;font-weight:800;color:#7dd3fc">${totalProgEnd}</div>
          <div>
            <div style="font-size:.875rem;font-weight:700;margin-bottom:.2rem">Program Completion Separations</div>
            <div style="font-size:.75rem;opacity:.8;max-width:480px">Staff whose employment concluded because their partner program ended per the contracted schedule — not resignations or performance actions. Counted separately for accurate DOL reporting.</div>
          </div>
          <div style="margin-left:auto;display:flex;gap:1.5rem;flex-wrap:wrap">
            <div style="text-align:center"><div style="font-size:1.5rem;font-weight:800;color:#7dd3fc">${totalVol}</div><div style="font-size:.68rem;opacity:.75;text-transform:uppercase;letter-spacing:.06em">Voluntary</div></div>
            <div style="text-align:center"><div style="font-size:1.5rem;font-weight:800;color:#fca5a5">${totalInvol}</div><div style="font-size:.68rem;opacity:.75;text-transform:uppercase;letter-spacing:.06em">Involuntary</div></div>
            <div style="text-align:center"><div style="font-size:1.5rem;font-weight:800">${totalProgEnd}</div><div style="font-size:.68rem;opacity:.75;text-transform:uppercase;letter-spacing:.06em">Prog. End</div></div>
          </div>
        </div>` : '';

      container.innerHTML = `
        <div style="padding:.5rem 0 1.5rem">
          <!-- Header -->
          <div style="display:flex;align-items:flex-start;justify-content:space-between;flex-wrap:wrap;gap:.75rem;margin-bottom:1.25rem">
            <div>
              <div style="font-size:1.05rem;font-weight:800;color:var(--navy);margin-bottom:.25rem">📊 DOL Monthly Employment Report</div>
              <div style="font-size:.78rem;color:var(--muted)">Monthly snapshot for U.S. Department of Labor data collection. Pre-apprentices excluded. Program Completion Separations reported as a distinct category.</div>
            </div>
            <div style="display:flex;gap:.5rem;flex-wrap:wrap">
              <button onclick="window.__dolExportCSV()" style="font-size:.78rem;padding:.45rem .9rem;background:var(--surface);border:1.5px solid var(--border);border-radius:8px;cursor:pointer;font-weight:600;color:var(--navy)">⬇ CSV</button>
              <button onclick="window.__dolExportPDF()" style="font-size:.78rem;padding:.45rem .9rem;background:var(--accent);color:#fff;border:none;border-radius:8px;cursor:pointer;font-weight:700">🖨 PDF Report</button>
            </div>
          </div>

          <!-- Period selector -->
          <div style="display:flex;gap:.5rem;align-items:center;margin-bottom:1.5rem;flex-wrap:wrap">
            <span style="font-size:.72rem;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.07em">Period</span>
            ${periodBtns}
          </div>

          <!-- Summary strip -->
          <div style="display:flex;gap:.75rem;flex-wrap:wrap;margin-bottom:1.25rem">
            ${statCard('Total Positions', employees.length, period.label, 'var(--navy)')}
            ${statCard('Total New Hires', stats.reduce((a,s)=>a+s.newHires,0), 'across period', '#059669')}
            ${statCard('Total Voluntary', totalVol, 'resignations', '#d97706')}
            ${statCard('Total Involuntary', totalInvol, 'terminations', '#dc2626')}
            ${totalProgEnd > 0 ? statCard('Program Completions', totalProgEnd, 'program-driven', '#0ea5e9') : ''}
          </div>

          <!-- Program completion callout -->
          ${progStrip}

          <!-- Month-by-month -->
          <div style="margin-bottom:1.75rem">
            <div style="font-size:.78rem;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.07em;margin-bottom:.75rem">Month-by-Month Breakdown</div>
            ${monthRows || '<p style="color:var(--muted);font-size:.85rem">No data available for this period.</p>'}
          </div>

          <!-- Open positions -->
          <div>
            <div style="font-size:.78rem;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.07em;margin-bottom:.75rem">Open Positions by Role</div>
            <div style="background:var(--surface);border:1.5px solid var(--border);border-radius:10px;padding:1rem">
              ${renderOpeningsTable(openings)}
            </div>
            ${period.source === 'tracker' && !window.NJTC_ONSITE_TRACKER ? '<p style="color:#d97706;font-size:.78rem;margin-top:.5rem">⚠ Tracker not loaded — switch to SY 26-27 in Site Analytics to load it, then return here.</p>' : ''}
          </div>
        </div>`;

      window.__dolSetPeriod = function(id) { _activePeriodId = id; render(); };
      window.__dolExportCSV = function() { exportCSV(stats, period.label); };
      window.__dolExportPDF = function() { exportPDF(stats, period.label, openings); };
    }

    render();
  };
})();
