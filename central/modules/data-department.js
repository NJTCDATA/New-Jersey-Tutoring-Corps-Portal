(function() {

  function renderDataAnalytics(data) {
    if (!data.length) return `<div style="padding:3rem;text-align:center;color:var(--muted)">No records match current filters.</div>`;
    const total = data.length;
    const byDistrict = countBy(data, 'site');
    const byConcern  = countBy(data, 'concern_type');
    const byRole     = countBy(data, 'role');
    const byHR       = countBy(data, 'hr_action');
    const byMonth    = {};
    data.forEach(r => { byMonth[r.month]=(byMonth[r.month]||0)+1; });
    const months = Object.keys(byMonth).sort((a,b)=>new Date('01 '+a)-new Date('01 '+b));

    let html = `${goalAlignmentBadges('data')}
    <div class="ta-grid ta-grid-4" style="margin-bottom:1.25rem">
      <div class="ta-card ta-kpi"><div class="ta-kpi-val">${total}</div><div class="ta-kpi-sub">Total Records</div></div>
      <div class="ta-card ta-kpi"><div class="ta-kpi-val">${[...new Set(data.map(r=>r.site))].length}</div><div class="ta-kpi-sub">Unique Districts</div></div>
      <div class="ta-card ta-kpi"><div class="ta-kpi-val">${[...new Set(data.map(r=>r.emp).filter(Boolean))].length}</div><div class="ta-kpi-sub">Unique Employees</div></div>
      <div class="ta-card ta-kpi"><div class="ta-kpi-val">${[...new Set(data.map(r=>r.month))].length}</div><div class="ta-kpi-sub">Months of Data</div></div>
    </div>`;

    html += `<div class="ta-grid ta-grid-2" style="margin-bottom:1rem">
      <div class="ta-card"><div class="ta-card-title">📍 District Distribution (${byDistrict.length} sites)</div>${barRows(byDistrict, byDistrict[0]?.[1]||1,'#7b2d8b')}</div>
      <div class="ta-card"><div class="ta-card-title">📅 Monthly Volume (${months.length} months)</div>
        ${months.map(m=>`<div class="ta-bar-row">
          <div class="ta-bar-label">${m}</div>
          <div class="ta-bar-track"><div class="ta-bar-fill" style="width:${Math.round((byMonth[m]||0)/Math.max(...Object.values(byMonth))*100)}%;background:#7b2d8b"></div></div>
          <div class="ta-bar-count">${byMonth[m]}</div>
        </div>`).join('')}
      </div>
    </div>
    <div class="ta-grid ta-grid-2" style="margin-bottom:1rem">
      <div class="ta-card"><div class="ta-card-title">🔍 Concern Type Breakdown</div>${barRows(byConcern, byConcern[0]?.[1]||1,'#457b9d')}</div>
      <div class="ta-card">
        <div class="ta-card-title">📋 HR Action Distribution</div>${barRows(byHR, byHR[0]?.[1]||1,'#2a9d8f')}
        <div class="ta-card-title" style="margin-top:1rem">👥 Role Breakdown</div>${barRows(byRole, byRole[0]?.[1]||1,'#e76f51')}
      </div>
    </div>`;

    // Full raw log for D&E
    html += `<div class="ta-card">
      <div class="ta-card-title">📊 Complete Analytical Record (${total} rows)</div>
      <div style="overflow-x:auto">
      <table class="ta-table">
        <thead><tr><th>Date</th><th>Employee</th><th>Role</th><th>District</th><th>Concern Category</th><th>Support Type</th><th>HR Action</th><th>First Time</th><th>Submitter</th></tr></thead>
        <tbody>
        ${data.slice(0,100).map(r=>`<tr>
          <td style="font-size:.72rem;white-space:nowrap">${r.ts.split(' ')[0]}</td>
          <td style="font-size:.78rem"><strong>${r.emp||'—'}</strong></td>
          <td><span class="dept-tag dept-tag-prog" style="font-size:.65rem">${r.role||'—'}</span></td>
          <td style="font-size:.72rem">${r.site}</td>
          <td style="font-size:.72rem;max-width:130px">${(r.concern_label||r.concern_type||'').substring(0,45)}</td>
          <td style="font-size:.72rem">${r.support_type||'—'}</td>
          <td><span class="concern-pill ${hrActionClass(r.hr_action)}" style="font-size:.65rem">${r.hr_action||'—'}</span></td>
          <td style="font-size:.72rem">${r.first_time||'—'}</td>
          <td style="font-size:.7rem;max-width:100px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${(r.submitter||'—').split(',')[0]}</td>
        </tr>`).join('')}
        </tbody>
      </table>
      ${total > 100 ? `<div style="padding:.75rem;font-size:.8rem;color:var(--muted);text-align:center">Showing first 100 of ${total} records. Use filters to narrow.</div>` : ''}
      </div>
    </div>`;
    return html;
  }

  // ════════════════════════════════════════════════════════════════
  //  FINANCE ANALYTICS — Partnership risk, workforce cost model
  // ════════════════════════════════════════════════════════════════

  const irlab = (function() {

    // ── Embedded data store (populated by Data dept CSV upload or hardcoded embed) ──
    const IRLAB_DATA = { math:[], ela:[], mathRepeat:[], elaRepeat:[], loaded:false };

    // ── Isolated state ──────────────────────────────────────────────────────
    let _irlMode        = 'embedded';  // 'embedded' | 'quickcsv'
    let _irlDept        = 'leadership';
    let _irlYear        = 'all';
    let _irlSubject     = 'all';
    let _irlDistrict    = 'all';
    let _irlSchool      = 'all';
    let _irlGrade       = 'all';
    let _irlScholarType = 'all'; // 'all' | 'repeat' | 'nonrepeat'
    let _irlPilot       = 'all'; // 'all' | 'pilot' | 'nonpilot'
    let _irlSearch      = '';         // free-text: tutor | school | district
    let _irlBreakdownTab = 'school';   // 'school' | 'grade' | 'district'
    let _irlDeepTab      = 'domains';  // 'domains' | 'repeat'
    let _irlCsvData     = null;        // Quick CSV session result (never persisted)
    let _irlBuilt       = false;
    let _irlScholarDrill = null;
    let _irlTutorDrill   = null;
    let _irlCharts       = {};         // Track Chart.js instances for cleanup
    let _irlRepeatIndex  = null;       // Cached cross-year repeat scholar index; reset on data change
    let _irlExportKind    = 'csv';     // 'csv' | 'xlsx' — which download the export modal is for
    let _irlExportFilters = null;      // Filter selections scoped to the export modal (independent of on-screen filters)

    // ── localStorage key for Data dept embedded CSV updates ─────────────────
    const EMBED_STORE_KEY  = 'njtc_irlab_embedded_v1';
    const IRLAB_LIVE_CACHE = 'njtc_irlab_live_v4';  // bumped — Aug 2026 sheet restructure (new gids/columns)
    // ── To enable live i-Ready data: set 2PACX key + tab GIDs below ──
    // Published sheet: File → Share → Publish to web → CSV → copy 2PACX key
    // GIDs: each tab's numeric ?gid= value from the sheet URL
    const IRLAB_LIVE_2PACX = '2PACX-1vREgf9glXO2QMKeZ8YHF-0XBtqoOyhNz3CnBpaeCY0mAC1lknvQ13JuXJpzHCZeGls4XEPkxyNO5ZBG';
    // GIDs are auto-discovered at runtime from pubhtml (same as Pearl Ops pattern)
    // Cache key for discovered GIDs
    const IRLAB_GID_CACHE  = 'njtc_irlab_gids_v6';  // bumped — Aug 2026 sheet restructure (new gids/columns)
    const IRLAB_GID_TTL_MS = 24 * 60 * 60 * 1000;  // 24hr — GIDs don't change often
    // Confirmed GIDs from published sheet edit URLs (authoritative — never overridden by discovery)
    // Math main: gid=1439023115  |  ELA main: gid=587043709
    // Repeat Scholar status is now a column embedded directly in the ELA/Math tabs
    // themselves ("Repeat Scholar" / "Repeat Scholar YOY") — mathRep/elaRep tabs are
    // no longer needed as separate sources, but stay wired for backward compatibility.
    let   IRLAB_LIVE_GIDS  = { math: 1439023115, ela: 587043709, mathRep: null, elaRep: null };
    const IRLAB_REFRESH_MS = 2 * 60 * 60 * 1000;   // 2-hour data cache
    let   _irlGIDsResolved = false;
    let   _irlDiscoveryPromise = null;  // promise lock — prevents concurrent discovery races
    let   _irlLiveStatus   = 'embedded';

    // ── 25-26 manual snapshot sheet — live, multi-tab, parallel fetch ────────
    // Direct sheet ID — sheet is shared "Anyone with the link" so the /export
    // endpoint works without a 2PACX published key.
    const IRLAB_2526_SHEET_ID = '1mCx6eFKscXA3y5Ox_JB9cSualR5Tw9MbKxBVN078_G0';
    const IRLAB_2526_GIDS     = { ela: 1640935949, math: 1676366557 };  // ELA + Math student-level tabs (Norming Window format)
    let   _irlManual2526Rows = [];  // normalized rows currently merged into IRLAB_DATA

    // ── Placement config ────────────────────────────────────────────────────
    const PLACEMENT_ORDER = [
      '3 or More Grade Levels Below',
      '2 Grade Levels Below',
      '1 Grade Level Below',
      'Early On Grade Level',
      'Mid or Above Grade Level',
    ];
    const PLC = {
      '3 or More Grade Levels Below': '#dc2626',
      '2 Grade Levels Below':         '#f97316',
      '1 Grade Level Below':          '#eab308',
      'Early On Grade Level':         '#0d9488',
      'Mid or Above Grade Level':     '#0d6e3a',
    };
    const PLC_SHORT = {
      '3 or More Grade Levels Below': '3+ Below',
      '2 Grade Levels Below':         '2 Below',
      '1 Grade Level Below':          '1 Below',
      'Early On Grade Level':         'Early GL',
      'Mid or Above Grade Level':     'At/Above GL',
    };

    // ── Dept config ─────────────────────────────────────────────────────────
    const DEPT_CFG = {
      leadership:          { label:'Leadership',      emoji:'👑', color:'#f0a500', bg:'#fff8e6' },
      programming:         { label:'Programming',     emoji:'🏫', color:'#457b9d', bg:'#edf4f9' },
      data:                { label:'Data & Eval',     emoji:'🔬', color:'#7b2d8b', bg:'#f5edfb' },
      hr:                  { label:'HR',              emoji:'👥', color:'#e63946', bg:'#fdedef' },
      finance:             { label:'Finance',         emoji:'💡', color:'#2a9d8f', bg:'#e6f5f3' },
      training_development:{ label:'Training & Dev',  emoji:'📋', color:'#0891b2', bg:'#ecfeff' },
    };

    // ── CSV parser ──────────────────────────────────────────────────────────
    function parseCSV(text) {
      const lines = text.replace(/\r\n/g,'\n').replace(/\r/g,'\n').split('\n');
      if (!lines.length) return [];
      const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g,''));
      return lines.slice(1).map(line => {
        if (!line.trim()) return null;
        const vals = []; let cur='', inQ=false;
        for (const ch of line) {
          if (ch==='"') inQ=!inQ;
          else if (ch===',' && !inQ) { vals.push(cur.trim()); cur=''; }
          else cur+=ch;
        }
        vals.push(cur.trim());
        const obj={};
        headers.forEach((h,i)=>{ obj[h]=vals[i]||''; });
        return obj;
      }).filter(Boolean);
    }

    // ── Field normalizer ────────────────────────────────────────────────────
    function g(r, ...keys) {
      for (const k of keys) {
        if (r[k] !== undefined && r[k] !== null) return r[k];
        const lk = k.toLowerCase().replace(/ /g,'_');
        if (r[lk] !== undefined && r[lk] !== null) return r[lk];
      }
      return '';
    }

    // ── Repeat Scholar flag parser ──────────────────────────────────────────
    // The live sheet's own "Repeat Scholar" / "Repeat Scholar YOY" column values
    // are 'Repeat' or 'Not Repeat'. A naive .includes('repeat') check matches BOTH
    // ('Not Repeat' contains the substring 'repeat'), which was marking every
    // scholar as a repeat. Only an explicit repeat value should count as true.
    function _parseRepeatFlag(raw) {
      const v = (raw == null ? '' : String(raw)).trim().toLowerCase();
      if (!v) return false;
      if (v.indexOf('not repeat') !== -1 || v === 'no' || v === 'n' || v === 'false') return false;
      return v.indexOf('repeat') !== -1 || v === 'yes' || v === 'y' || v === 'true';
    }

    function normalizeRow(r, subject) {
      // Full header normalization: lowercase, replace ALL non-alphanumeric with _, trim underscores
      // Handles Title Case, snake_case, headers with %, &, () etc.
      const _rn = {};
      for (const k of Object.keys(r)) {
        _rn[k] = r[k];
        const lk = k.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
        if (_rn[lk] === undefined) _rn[lk] = r[k];
        // Also store with spaces→underscores only (legacy compatibility)
        const lk2 = k.toLowerCase().replace(/ /g, '_');
        if (_rn[lk2] === undefined) _rn[lk2] = r[k];
      }
      r = _rn;
      const instRaw = g(r,'Instructor','Tutor','tutor','instructor').trim();
      // pctTypical is computed once, up front, so pctStretch below can cross-check against it
      // (stretch growth targets are always >= typical growth targets, so % of stretch achieved
      // can never legitimately exceed % of typical achieved for the same scholar/row).
      const _pctTypicalVal = (function(){
        // Try all known column name variants across Math (Title Case) and ELA (snake_case) sheets
        var _raw = g(r,
          'Spring pct progress typical growth',
          'spring_pct_progress_typical_growth',
          'spring_pct_toward_typical_growth',
          'Spring Pct Progress Toward Typical Growth',
          'spring__progress_typical_growth',       // % sign → _ in normalization
          'spring_growth_inclusion',               // ELA repeat sheet variant
          'Spring Growth Inclusion',
          'Spring % Progress Typical Growth',
          'spring_pct_typical',
          'pct_progress_typical_growth'
        );
        var _v=parseFloat(_raw);
        if(isNaN(_v)||_raw===''||_raw===null||_raw===undefined) return null;
        // Handle %-suffixed values: '97%' → parseFloat gives 97 → divide by 100 → 0.97
        if(typeof _raw==='string' && _raw.trim().slice(-1)==='%') { _v=_v/100; }
        // Guard: iReady ratio column is 0–~15 range (e.g. 1.50 = 150%); >15 is pct-as-integer
        else if(_v > 15) { _v=_v/100; }
        return _v;
      }());
      return {
        subject,
        year:             g(r,'Academic year','academic_year'),
        district:         g(r,'District'),
        school:           g(r,'School','school'),
        grade:            g(r,'Student grade','student_grade'),
        certStatus:       g(r,'Certification Status'),
        instructor:       instRaw,
        tutors:           instRaw ? instRaw.split(',').map(n=>n.trim()).filter(Boolean) : [],
        scholarId:        g(r,'Student id','student_id','Student ID','Student Id','Local Student ID','local_student_id','Id','ID'),
        scholarName:      g(r,'First and Last Name','first_and_last_name','Student Name','student_name','Scholar Name','Name','Full Name'),
        sex:              g(r,'Sex'),
        hispanic:         g(r,'Hispanic or latino','hispanic_or_latino'),
        race:             g(r,'Race Analytics'),
        ell:              g(r,'English language learner','english_language_learner'),
        sped:             g(r,'Special education','special_education'),
        ecodis:           g(r,'Economically disadvantaged','economically_disadvantaged'),
        baseRelPlacement: _normPlacement(g(r,'Base overall relative placement','base_overall_relative_placement')),
        baseScore:        parseFloat(g(r,'Base overall scale score','base_overall_scale_score'))||null,
        baseRushFlag:     g(r,'Base rush flag','base_rush_flag'),
        springRelPlacement:_normPlacement(g(r,'Spring overall relative placement','spring_overall_relative_placement')),
        springScore:      parseFloat(g(r,'Spring overall scale score','spring_overall_scale_score'))||null,
        springGain:       parseFloat(g(r,'Spring diagnostic gain','spring_diagnostic_gain'))||null,
        springPercentile: parseFloat(g(r,'Spring percentile','spring_percentile'))||null,
        springRushFlag:   g(r,'Spring rush flag','spring_rush_flag'),
        pctTypical:       _pctTypicalVal,
        pctStretch:       (function(){
          var _raw=g(r,'Spring pct progress stretch growth','spring_pct_progress_stretch_growth');
          var _v=parseFloat(_raw);
          if(isNaN(_v)) return null;
          if(typeof _raw==='string' && _raw.trim().slice(-1)==='%') { _v=_v/100; }
          else if(_v > 15) { _v=_v/100; }
          // Self-correcting cross-check: stretch growth targets are always harder to reach than
          // typical growth targets, so % of stretch achieved can never exceed % of typical
          // achieved for the same row. Some live sheets (e.g. the ELA tab) store this column as
          // a raw whole-number percent (e.g. 39 = 39%) rather than a decimal ratio like Math's —
          // if the parsed value is still implausibly larger than typical, it needs rescaling.
          if(_pctTypicalVal != null && _v > _pctTypicalVal) { _v = _v/100; }
          return _v;
        }()),
        annualTypical:    parseFloat(g(r,'Annual typical growth measure','annual_typical_growth_measure'))||null,
        annualStretch:    parseFloat(g(r,'Annual stretch growth measure','annual_stretch_growth_measure'))||null,
        isRepeat:         _parseRepeatFlag(g(r,'Repeat Scholar YOY','Repeat Scholar')),
        _hasRepeatCol:    !!(g(r,'Repeat Scholar YOY','Repeat Scholar')||'').toString().trim(),
        basePlacement:    g(r,'Base overall placement','base_overall_placement'),
        springPlacement:  g(r,'Spring overall placement','spring_overall_placement'),
        // "Diagnostic window and/or_weeks_between_diagnostics" is the ELA sheet's renamed/merged
        // column — most rows hold the season label ("Spring"), a minority hold the numeric weeks
        // value. parseFloat() on the season-label rows naturally yields NaN → null, so this alias
        // is safe to add without a separate guard.
        springWeeks:      parseFloat(g(r,
                            'Spring weeks between diagnostics','spring_weeks_between_diagnostics',
                            'Diagnostic window and/or_weeks_between_diagnostics','diagnostic_window_and_or_weeks_between_diagnostics'
                          ))||null,
        // ── Scale Score Progression (NJTC methodology) ─────────────────────
        // iReady's own norm assumes a full 10-month/30-week school year, but NJTC
        // programs run for a much shorter, variable window — so growth pace is
        // measured against the scholar's OWN diagnostic window instead:
        //   Expected Growth per Week = Annual Typical Growth Measure ÷ Spring Weeks Between Diagnostics
        //   Weeks of Growth          = Spring Diagnostic Gain ÷ Expected Growth per Week
        expectedGrowthPerWeek: (function(){
          var _at = parseFloat(g(r,'Annual typical growth measure','annual_typical_growth_measure'));
          var _wk = parseFloat(g(r,
                      'Spring weeks between diagnostics','spring_weeks_between_diagnostics',
                      'Diagnostic window and/or_weeks_between_diagnostics','diagnostic_window_and_or_weeks_between_diagnostics'
                    ));
          if (isNaN(_at) || isNaN(_wk) || _wk <= 0) return null;
          return _at / _wk;
        }()),
        weeksOfGrowth: (function(){
          var _gain = parseFloat(g(r,'Spring diagnostic gain','spring_diagnostic_gain'));
          var _at   = parseFloat(g(r,'Annual typical growth measure','annual_typical_growth_measure'));
          var _wk   = parseFloat(g(r,
                        'Spring weeks between diagnostics','spring_weeks_between_diagnostics',
                        'Diagnostic window and/or_weeks_between_diagnostics','diagnostic_window_and_or_weeks_between_diagnostics'
                      ));
          if (isNaN(_gain) || isNaN(_at) || isNaN(_wk) || _wk <= 0 || _at <= 0) return null;
          var _perWk = _at / _wk;
          return _perWk > 0 ? _gain / _perWk : null;
        }()),
        // ELA domain subscores
        elaPhonologicalScore:   parseFloat(g(r,'Base phonological awareness scale score','base_phonological_awareness_scale_score'))||null,
        elaPhonicsScore:        parseFloat(g(r,'Base phonics scale score','base_phonics_scale_score'))||null,
        elaHFWScore:            parseFloat(g(r,'Base high frequency words scale score','base_high_frequency_words_scale_score'))||null,
        elaVocabScore:          parseFloat(g(r,'Base vocabulary scale score','base_vocabulary_scale_score'))||null,
        elaRCOverallScore:      parseFloat(g(r,'Base reading comprehension overall scale score','base_reading_comprehension_overall_scale_score'))||null,
        elaRCLitScore:          parseFloat(g(r,'Base reading comprehension literature scale score','base_reading_comprehension_literature_scale_score'))||null,
        elaRCInfoScore:         parseFloat(g(r,'Base reading comprehension informational text scale score','base_reading_comprehension_informational_text_scale_score'))||null,
        elaPhonologicalSpringScore: parseFloat(g(r,'Spring phonological awareness scale score','spring_phonological_awareness_scale_score'))||null,
        elaPhonicsSpringScore:      parseFloat(g(r,'Spring phonics scale score','spring_phonics_scale_score'))||null,
        elaHFWSpringScore:          parseFloat(g(r,'Spring high frequency words scale score','spring_high_frequency_words_scale_score'))||null,
        elaVocabSpringScore:        parseFloat(g(r,'Spring vocabulary scale score','spring_vocabulary_scale_score'))||null,
        elaRCOverallSpringScore:    parseFloat(g(r,'Spring reading comprehension overall scale score','spring_reading_comprehension_overall_scale_score'))||null,
        elaRCLitSpringScore:        parseFloat(g(r,'Spring reading comprehension literature scale score','spring_reading_comprehension_literature_scale_score'))||null,
        elaRCInfoSpringScore:       parseFloat(g(r,'Spring reading comprehension informational text scale score','spring_reading_comprehension_informational_text_scale_score'))||null,
        // Math domain subscores
        mathNumOpsScore:     parseFloat(g(r,'Base number and operations scale score','base_number_and_operations_scale_score'))||null,
        mathAlgebraScore:    parseFloat(g(r,'Base algebra and algebraic thinking scale score','base_algebra_and_algebraic_thinking_scale_score'))||null,
        mathMeasDataScore:   parseFloat(g(r,'Base measurement and data scale score','base_measurement_and_data_scale_score'))||null,
        mathGeometryScore:   parseFloat(g(r,'Base geometry scale score','base_geometry_scale_score'))||null,
        mathNumOpsSpringScore:   parseFloat(g(r,'Spring number and operations scale score','spring_number_and_operations_scale_score'))||null,
        mathAlgebraSpringScore:  parseFloat(g(r,'Spring algebra and algebraic thinking scale score','spring_algebra_and_algebraic_thinking_scale_score'))||null,
        mathMeasDataSpringScore: parseFloat(g(r,'Spring measurement and data scale score','spring_measurement_and_data_scale_score'))||null,
        mathGeometrySpringScore: parseFloat(g(r,'Spring geometry scale score','spring_geometry_scale_score'))||null,
        isPilot: (function(){
          var _pv = g(r,'Pilot Program','pilot_program','Pilot','pilot');
          if (!_pv || _pv.trim() === '') return null;
          return /yes/i.test(_pv.trim());
        }()),
      };
    }

    // ── Data loading: embedded CSV strings (hardcoded or Data dept update) ──
    // Decode compact encoded row arrays back to normalised row objects
    function _decodeRows(rawRows, L, subject) {
      return rawRows.map(function(r) {
        var inst = r[5] || '';
        return {
          subject:            subject,
          year:               L['0'][r[0]],
          district:           L['1'][r[1]],
          school:             L['2'][r[2]],
          grade:              L['3'][r[3]],
          certStatus:         L['4'][r[4]],
          instructor:         inst,
          tutors:             inst ? inst.split(',').map(function(n){return n.trim();}).filter(Boolean) : [],
          scholarId:          r[6],
          scholarName:        r[7],
          sex:                L['8'][r[8]],
          hispanic:           L['9'][r[9]],
          race:               L['10'][r[10]],
          ell:                L['11'][r[11]],
          sped:               L['12'][r[12]],
          ecodis:             L['13'][r[13]],
          baseRelPlacement:   L['14'][r[14]],
          springRelPlacement: L['15'][r[15]],
          springGain:         r[16],
          pctTypical:         (function(){
            var _pv=r[17]; if(_pv==null) return null;
            var _pf=parseFloat(_pv); if(isNaN(_pf)) return null;
            if(typeof _pv==='string'&&_pv.trim().slice(-1)==='%'){_pf=_pf/100;}
            else if(_pf===0) { if(subject==='ELA') return null; }  // ELA zero = no data; Math zero = valid 0%
            else if(subject==='ELA'&&_pf===Math.floor(_pf)){
              // ELA integer r[17] = annualTypical (scale score points); pctTypical = springGain / annualTypical
              if(r[16]==null) return null;
              var _pct=parseFloat(r[16])/_pf;
              if(_pct>15) return null;  // cap extreme outliers
              _pf=_pct;
            } else if(_pf>15) { _pf=_pf/100; }  // legacy percentage encoding fallback
            return _pf;
          }()),
          annualTypical:      (function(){
            var _pv=r[17]; if(_pv==null||r[16]==null) return null;
            var _pf=parseFloat(_pv); if(isNaN(_pf)||_pf<=0) return null;
            if(subject==='ELA'&&_pf===Math.floor(_pf)){
              return _pf;  // ELA integer r[17] = annualTypical directly (scale score points)
            }
            if(_pf>15) _pf=_pf/100;
            if(_pf<=0) return null;
            return parseFloat((parseFloat(r[16])/_pf).toFixed(1));
          }()),
          baseRushFlag:       r[18] ? '1' : '',
          springRushFlag:     '',
          baseScore:          null,
          springScore:        null,
          isRepeat:           false,
          isPilot:            null,
        };
      });
    }

    function loadData() {
      if (IRLAB_DATA.loaded) return;

      // 1. Try localStorage (Data dept uploaded update)
      try {
        const stored = JSON.parse(localStorage.getItem(EMBED_STORE_KEY) || 'null');
        if (stored && stored.math && stored.math.length > 0) {
          IRLAB_DATA.math       = stored.math;
          IRLAB_DATA.ela        = stored.ela        || [];
          IRLAB_DATA.mathRepeat = stored.mathRep    || [];
          IRLAB_DATA.elaRepeat  = stored.elaRep     || [];
          IRLAB_DATA.loaded     = true;
          IRLAB_DATA.source     = 'Data dept update · ' + new Date(stored.ts).toLocaleDateString();
          IRLAB_DATA.ts         = stored.ts;
          return;
        }
      } catch(e) {}

      // 2. Decode pre-parsed compact EOY data (window.__IRLAB_RAW__)
      try {
        const raw = window.__IRLAB_RAW__;
        if (raw && raw.d && raw.L) {
          const L = raw.L;
          IRLAB_DATA.math       = _decodeRows(raw.d.math    || [], L, 'Math');
          IRLAB_DATA.ela        = _decodeRows(raw.d.ela     || [], L, 'ELA');
          IRLAB_DATA.mathRepeat = _decodeRows(raw.d.mathRep || [], L, 'Math');
          IRLAB_DATA.elaRepeat  = _decodeRows(raw.d.elaRep  || [], L, 'ELA');
          IRLAB_DATA.loaded     = true;
          IRLAB_DATA.source     = 'Embedded EOY data (SY 2022–2025)';
          IRLAB_DATA.ts         = null;
          return;
        }
      } catch(e) { console.warn('[irlab] decode error:', e); }

      // 3. Legacy: raw CSV in panel.dataset (fallback)
      const panel = document.getElementById('panel-iready-lab');
      if (!panel) { IRLAB_DATA.loaded = true; return; }
      const mathRaw = panel.dataset.mathCsv    || '';
      const elaRaw  = panel.dataset.elaCsv     || '';
      const mRptRaw = panel.dataset.mathRepCsv || '';
      const eRptRaw = panel.dataset.elaRepCsv  || '';
      if (mathRaw) IRLAB_DATA.math       = parseCSV(mathRaw).map(r=>normalizeRow(r,'Math'));
      if (elaRaw)  IRLAB_DATA.ela        = parseCSV(elaRaw).map(r=>normalizeRow(r,'ELA'));
      if (mRptRaw) IRLAB_DATA.mathRepeat = parseCSV(mRptRaw).map(r=>normalizeRow(r,'Math'));
      if (eRptRaw) IRLAB_DATA.elaRepeat  = parseCSV(eRptRaw).map(r=>normalizeRow(r,'ELA'));
      IRLAB_DATA.loaded = true;
      IRLAB_DATA.source = 'Embedded EOY data';
      IRLAB_DATA.ts     = null;
    }

    // ── Auto-discover tab GIDs from pubhtml (runs once per session, cached 24hr) ──
    async function _irlDiscoverGIDs() {
      if (_irlGIDsResolved) return true;
      // Promise lock: if discovery is already in-flight, wait on same promise instead of racing
      if (_irlDiscoveryPromise) return _irlDiscoveryPromise;
      _irlDiscoveryPromise = _irlDiscoverGIDsInner();
      return _irlDiscoveryPromise;
    }

    async function _irlDiscoverGIDsInner() {
      // math=1439023115 and ela=587043709 are hardcoded (confirmed from sheet edit URLs) — always authoritative.
      // Discovery only needed for mathRep and elaRep (repeat-scholar tabs).

      // 1. Try localStorage cache for repeat GIDs only
      try {
        const cached = JSON.parse(localStorage.getItem(IRLAB_GID_CACHE) || 'null');
        if (cached && cached.ts && (Date.now() - cached.ts) < IRLAB_GID_TTL_MS && cached.gids) {
          const cg = cached.gids || {};
          if (cg.mathRep != null && cg.elaRep != null) {
            IRLAB_LIVE_GIDS.mathRep = cg.mathRep;
            IRLAB_LIVE_GIDS.elaRep  = cg.elaRep;
            // Re-assert hardcoded core GIDs (cache must not override)
            IRLAB_LIVE_GIDS.math = 1439023115;
            IRLAB_LIVE_GIDS.ela  = 587043709;
            _irlGIDsResolved = true;
            console.log('[irlab] GIDs loaded from cache:', JSON.stringify(IRLAB_LIVE_GIDS));
            return true;
          }
          try { localStorage.removeItem(IRLAB_GID_CACHE); } catch(e) {}
        }
      } catch(e) {}

      // 2. Probe pubhtml for GID list
      const baseUrl  = 'https://docs.google.com/spreadsheets/d/e/' + IRLAB_LIVE_2PACX;
      const csvBase  = baseUrl + '/pub?output=csv';
      let probedGids = [];
      try {
        const res = await fetch(baseUrl + '/pubhtml', { signal: AbortSignal.timeout(30000) });
        if (res.ok) {
          const html = await res.text();
          const matches = [...html.matchAll(/[?&]gid=(\d+)/g)];
          const found = [...new Set(matches.map(m => parseInt(m[1], 10)))].filter(n => !isNaN(n));
          probedGids = found;
          console.log('[irlab] Discovered GIDs from pubhtml:', found);
        }
      } catch(e) { console.warn('[irlab] pubhtml probe failed:', e.message); }

      // 3. Fallback: common GIDs + gid=0 (default tab)
      if (!probedGids.length) probedGids = [0, 1, 2, 3, 100, 200, 300, 400];

      // 4. Fetch each candidate — capture header + first data line + row count in ONE request
      const results = await Promise.all(probedGids.map(async gid => {
        try {
          const r = await fetch(csvBase + '&gid=' + gid, { signal: AbortSignal.timeout(12000) });
          if (!r.ok) return null;
          const text = await r.text();
          const lines = text.split('\n');
          const hdr      = lines[0].toLowerCase().replace(/["\u201c\u201d]/g, '');
          const snippet  = lines.slice(0, 3).join('\n');
          const rowCount = lines.filter(l => l.trim()).length - 1; // non-empty lines minus header
          return { gid, hdr, snippet, rowCount };
        } catch { return null; }
      }));

      // 5. Helpers
      const _detectSubject = rows => {
        if (!rows.length) return '';
        return (rows[0]['Subject'] || rows[0]['subject'] || rows[0]['SUBJECT'] || '').toLowerCase();
      };
      const _isElaSubject    = s => s.includes('ela') || s.includes('reading') || s.includes('language');
      const _isMathSubject   = s => s.includes('math');
      // Handle both Title Case ("Academic Year") and snake_case ("academic_year" / "school_year")
      const _isLongitudinalH = h =>
        (h.includes('academic year') || h.includes('academic_year') ||
         h.includes('school year')   || h.includes('school_year')) &&
        !h.includes('repeat scholar') && !h.includes('repeat_scholar');
      const _hasStaffCol = h => h.includes('instructor') || h.includes('tutor');

      // 6. Assign GIDs — prefer larger tabs (more rows = more likely to be the real longitudinal)
      const resolved   = { math: null, ela: null, mathRep: null, elaRep: null };
      const resolvedRC = { math: 0, ela: 0 }; // track row counts for assigned tabs

      for (const row of results.filter(Boolean)) {
        const h = row.hdr;
        // Main longitudinal tabs
        if (_isLongitudinalH(h) && _hasStaffCol(h)) {
          const subj   = _detectSubject(parseCSV(row.snippet));
          const isMath = _isMathSubject(subj);
          const isEla  = _isElaSubject(subj);
          // Always upgrade to a larger tab if subject matches
          if (isMath && (!resolved.math || row.rowCount > resolvedRC.math)) {
            resolved.math = row.gid; resolvedRC.math = row.rowCount; continue;
          }
          if (isEla && (!resolved.ela || row.rowCount > resolvedRC.ela)) {
            resolved.ela = row.gid; resolvedRC.ela = row.rowCount; continue;
          }
          // Subject not detected — assign by order, still prefer larger
          if (!resolved.math || row.rowCount > resolvedRC.math * 3) {
            resolved.math = row.gid; resolvedRC.math = row.rowCount;
          } else if (!resolved.ela || row.rowCount > resolvedRC.ela * 3) {
            resolved.ela = row.gid; resolvedRC.ela = row.rowCount;
          }
        }
        // Repeat-scholar tabs
        if ((h.includes('repeat scholar') || h.includes('repeat_scholar')) && _hasStaffCol(h)) {
          const subj = _detectSubject(parseCSV(row.snippet));
          if (_isMathSubject(subj) && (!resolved.mathRep || row.rowCount > (resolved._mathRepRC||0))) {
            resolved.mathRep = row.gid; resolved._mathRepRC = row.rowCount;
          } else if (!resolved.elaRep || row.rowCount > (resolved._elaRepRC||0)) {
            resolved.elaRep = row.gid; resolved._elaRepRC = row.rowCount;
          }
        }
      }
      delete resolved._mathRepRC; delete resolved._elaRepRC;

      // 7. ELA fallback — scan all unassigned longitudinal tabs, pick largest
      if (!resolved.ela) {
        const assignedGids = new Set(Object.values(resolved).filter(Boolean));
        let bestEla = null, bestElaRC = 0;
        for (const row of results.filter(Boolean)) {
          if (assignedGids.has(row.gid)) continue;
          if (_isLongitudinalH(row.hdr)) {
            const subj = _detectSubject(parseCSV(row.snippet));
            if (_isElaSubject(subj) || (!_isMathSubject(subj) && row.rowCount > bestElaRC)) {
              bestEla = row.gid; bestElaRC = row.rowCount;
            }
          }
        }
        if (bestEla) {
          resolved.ela = bestEla;
          console.log('[irlab] ELA via fallback: gid=' + bestEla + ' rowCount=' + bestElaRC);
        }
      }

      // 8. Low-row-count sanity: if math has <50 rows and a larger unassigned longitudinal exists, swap
      if (resolved.math && resolvedRC.math < 50) {
        const assignedGids = new Set(Object.values(resolved).filter(Boolean));
        for (const row of results.filter(Boolean)) {
          if (assignedGids.has(row.gid)) continue;
          if (_isLongitudinalH(row.hdr) && _hasStaffCol(row.hdr) && row.rowCount > resolvedRC.math * 5) {
            console.log('[irlab] Math upgrade: ' + resolved.math + '(' + resolvedRC.math + 'r)→' + row.gid + '(' + row.rowCount + 'r)');
            resolved.math = row.gid; resolvedRC.math = row.rowCount; break;
          }
        }
      }

      // 9. Final last-resort — assign by row size if nothing resolved at all
      if (!resolved.math && !resolved.ela) {
        const withStaff = results.filter(r => r && _hasStaffCol(r.hdr)).sort((a,b) => b.rowCount - a.rowCount);
        if (withStaff.length > 0) resolved.math = withStaff[0].gid;
        if (withStaff.length > 1) resolved.ela  = withStaff[1].gid;
      }

      // Re-assert hardcoded core GIDs — discovery must never override these
      resolved.math = 1439023115;
      resolved.ela  = 587043709;

      IRLAB_LIVE_GIDS = resolved;
      _irlGIDsResolved = true; // math + ela are always known
      // Cache repeat GIDs for faster load on return visits
      try { localStorage.setItem(IRLAB_GID_CACHE, JSON.stringify({ ts: Date.now(), gids: { mathRep: resolved.mathRep, elaRep: resolved.elaRep } })); } catch(e) {}
      console.log('[irlab] GIDs resolved:', JSON.stringify(resolved));
      return true;
    }

    async function _irlFetchLive(force=false) {
      if (!IRLAB_LIVE_2PACX) return;
      // Ensure GIDs are resolved before fetching
      const gidsOk = await _irlDiscoverGIDs();
      if (!gidsOk) { console.warn('[irlab] Skipping live fetch — no GIDs resolved'); return; }

      // Kick off the 25-26 snapshot fetches immediately in parallel — one fetch per
      // configured tab (ela always; math once that tab is added to IRLAB_2526_GIDS).
      // Runs regardless of whether the longitudinal cache is still warm, so the
      // 25-26 data is always current on every refresh cycle.
      const _snap2526Pr = Promise.all(
        Object.entries(IRLAB_2526_GIDS)
          .filter(function(_e){ return _e[1] !== null && _e[1] !== undefined; })
          .map(function(_e){
            var _subj = _e[0], _gid = _e[1];
            return fetch(
              'https://docs.google.com/spreadsheets/d/' + IRLAB_2526_SHEET_ID +
              '/export?format=csv&gid=' + _gid + (force ? '&t=' + Date.now() : ''),
              { signal: AbortSignal.timeout(30000) }
            )
            .then(function(r){ return r.ok ? r.text() : Promise.reject('HTTP '+r.status); })
            .then(function(text){ return { subj: _subj === 'ela' ? 'ELA' : _subj === 'math' ? 'Math' : 'Combined', text: text }; })
            .catch(function(e){ console.warn('[irlab] 25-26 '+_subj+' fetch failed:', e); return null; });
          })
      ).then(function(results){ return results.filter(Boolean); });

      if (!force) {
        try { const c=JSON.parse(localStorage.getItem(IRLAB_LIVE_CACHE)||'null');
          if (c&&c.ts&&(Date.now()-c.ts)<IRLAB_REFRESH_MS) {
            _irlMergeLive(c);
            _irlLiveStatus='live';
            await _irlProcess2526(await _snap2526Pr);
            if (typeof _hrInvalidateOverlay === 'function') _hrInvalidateOverlay();
            if (typeof renderLab === 'function') renderLab();
            try { if (typeof window._execDashRefresh === 'function') window._execDashRefresh(true); } catch(e) {}
            try { if (typeof window._apirGenerate === 'function') window._apirGenerate(); } catch(e) {}
            return;
          }
        } catch(e) {}
      }
      const base='https://docs.google.com/spreadsheets/d/e/'+IRLAB_LIVE_2PACX+'/pub?output=csv';
      const bust=force?'&t='+Date.now():'';
      const res={};
      const _gidSeen = new Set(); // avoid double-fetching when math and ela map to same gid
      for (const [tab,gid] of Object.entries(IRLAB_LIVE_GIDS)) {
        if (gid === null || gid === undefined) continue; // gid=0 is valid (ELA default tab) — must not use !gid
        const isRepeat = tab.includes('Rep') || tab.includes('rep');
        const defaultSubj = tab.startsWith('math') ? 'Math' : 'ELA';
        // If this gid was already fetched (math/ela share same tab), reuse and split
        if (!isRepeat && _gidSeen.has(gid)) {
          // ELA rows were already extracted from this shared tab when processing math
          continue;
        }
        try {
          const r = await fetch(base+'&gid='+gid+bust, {signal:AbortSignal.timeout(30000)});
          if (r.ok) {
            const text = await r.text();
            const parsedRows = parseCSV(text);
            const allNorm = parsedRows
              .map(row => {
                // Use actual Subject field from each row when available; fall back to tab-assigned subject
                const rawSubj = (row['Subject'] || row['subject'] || row['SUBJECT'] || '').toLowerCase();
                const rowSubj = rawSubj.includes('ela') || rawSubj.includes('reading') || rawSubj.includes('language') ? 'ELA'
                              : rawSubj.includes('math') ? 'Math'
                              : defaultSubj;
                return normalizeRow(row, rowSubj);
              })
              .filter(r => r.scholarId || r.scholarName);
            if (isRepeat) {
              // Rows on a dedicated repeat-scholar tab are repeat scholars by definition,
              // even if the tab itself doesn't carry an explicit "Repeat Scholar" column.
              res[tab] = allNorm.map(rr => { rr.isRepeat = true; rr._hasRepeatCol = true; return rr; });
            } else {
              // Split by actual subject — so a single mixed-subject tab populates both math and ela
              const mathRows = allNorm.filter(r => r.subject === 'Math');
              const elaRows  = allNorm.filter(r => r.subject === 'ELA');
              if (tab === 'math' || tab === 'ela') {
                res['math'] = (res['math'] || []).concat(mathRows);
                res['ela']  = (res['ela']  || []).concat(elaRows);
                _gidSeen.add(gid);
              } else {
                res[tab] = allNorm;
              }
            }
            console.log('[irlab] Live '+tab+': '+allNorm.length+' rows (gid='+gid+')');
          }
        } catch(e) { console.warn('[irlab] live '+tab+':', e.message); }
      }
      if (Object.keys(res).length) {
        const pkg={ts:Date.now(),...res};
        try { localStorage.setItem(IRLAB_LIVE_CACHE,JSON.stringify(pkg)); } catch(e){}
        _irlMergeLive(pkg);
        _irlLiveStatus='live';
        await _irlProcess2526(await _snap2526Pr);
        // Invalidate HR profiles overlay so academic data updates
        if (typeof _hrInvalidateOverlay === 'function') _hrInvalidateOverlay();
        // If HR profiles tab is active, trigger a re-render
        const profilesTab = document.getElementById('talentTab-profiles');
        const talentEl    = document.getElementById('talentContent');
        if (profilesTab && profilesTab.classList.contains('active') && talentEl) {
          try {
            const dept = (window.NJTC_SESSION||{}).dept || 'hr';
            const _vr  = (typeof _hrOverlayVersion !== 'undefined') ? String(_hrOverlayVersion) : '0';
            talentEl.innerHTML = '<div id="hrProfilesRoot" data-overlay-version="'+_vr+'">' +
              (typeof _hrBuildProfiles === 'function' ? _hrBuildProfiles(dept) : '') + '</div>';
          } catch(e) { /* don't blank screen */ }
        }
        if (typeof renderLab === 'function') renderLab();
        try { if (typeof window._execDashRefresh === 'function') window._execDashRefresh(true); } catch(e) {}
        try { if (typeof window._apirGenerate === 'function') window._apirGenerate(); } catch(e) {}
        console.log('[irlab] Live data merged — academic overlay will update on next render');
      }
    }
    function _irlMergeLive(pkg) {
      const ly=new Set();
      for (const rows of Object.values(pkg)) if (Array.isArray(rows)) rows.forEach(r=>{ if(r.year) ly.add(r.year); });
      const mrg=(e,l)=>l&&l.length?[...e.filter(r=>!ly.has(r.year)),...l]:e;
      IRLAB_DATA.math=mrg(IRLAB_DATA.math,pkg.math); IRLAB_DATA.ela=mrg(IRLAB_DATA.ela,pkg.ela);
      IRLAB_DATA.mathRepeat=mrg(IRLAB_DATA.mathRepeat,pkg.mathRep); IRLAB_DATA.elaRepeat=mrg(IRLAB_DATA.elaRepeat,pkg.elaRep);
      IRLAB_DATA.source='Live+Embedded ('+new Date(pkg.ts).toLocaleDateString()+')';
      _irlRepeatIndex = null; // invalidate cached repeat index so it rebuilds from fresh data
    }
    // ── 25-26 manual snapshot — normalize, arbitrate, merge ──────────────────

    // Pivot per-diagnostic rows (one row per student per norming window) into
    // the same normalized shape that normalizeRow() already produces for the
    // longitudinal sheet.  Winter → base_ fields; Spring → spring_ fields.
    // subject is 'ELA' or 'Math' — determined by the tab (IRLAB_2526_GIDS key).
    function _normalize2526StudentRows(rawRows, subject) {
      const byStudent = new Map();
      rawRows.forEach(function(rawRow) {
        // Mirror normalizeRow's header normalization (lowercase + non-alphanum → _)
        const _rn = {};
        Object.keys(rawRow).forEach(function(k) {
          _rn[k] = rawRow[k];
          const lk = k.trim().toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/^_+|_+$/g,'');
          if (_rn[lk] === undefined) _rn[lk] = rawRow[k];
          const lk2 = k.toLowerCase().replace(/ /g,'_');
          if (_rn[lk2] === undefined) _rn[lk2] = rawRow[k];
        });
        const sid = g(_rn,'Student ID','student_id').trim();
        if (!sid) return;
        if (!byStudent.has(sid)) byStudent.set(sid, { rows:[], sid:sid });
        byStudent.get(sid).rows.push(_rn);
      });

      const result = [];
      byStudent.forEach(function(entry) {
        var rows = entry.rows, sid = entry.sid;
        // Norming Window pivot: use iReady's Baseline and Most Recent flags as the primary
        // source of truth so that any valid pair (Fall→Spring, Fall→Winter, Winter→Spring)
        // is captured.  Window-name matching is a secondary fallback.
        var _isBaseline = function(r){
          return (g(r,'Baseline Diagnostic (Y/N)','baseline_diagnostic_y_n')||'').trim().toUpperCase() === 'Y';
        };
        var _isMostRecent = function(r){
          return (g(r,'Most Recent Diagnostic YTD (Y/N)','most_recent_diagnostic_ytd_y_n')||'').trim().toUpperCase() === 'Y';
        };
        var win = rows.find(_isBaseline);
        var spr = rows.find(_isMostRecent);
        // If the most-recent row is the same as the baseline (only one diagnostic taken),
        // treat it as baseline-only with no endpoint — same as before.
        if (win && spr && win === spr) spr = null;
        // Fallback for rows where the flags are blank: use norming window names.
        if (!win && !spr) {
          win = rows.find(function(r){
            var nw = (g(r,'Norming Window','norming_window')||'').toLowerCase();
            return nw.includes('fall') || nw.includes('winter');
          });
          spr = rows.find(function(r){
            var nw = (g(r,'Norming Window','norming_window')||'').toLowerCase();
            return nw.includes('spring');
          });
        }
        var dem = spr || win || rows[0];
        if (!dem) return;

        // parseFloat helper — returns null instead of NaN
        function _pf(row) {
          var keys = Array.prototype.slice.call(arguments, 1);
          if (!row) return null;
          var v = g.apply(null, [row].concat(keys));
          var n = parseFloat(v);
          return isNaN(n) ? null : n;
        }
        // Percent helper — handles %-suffix and >15 integer encoding (for longitudinal data)
        function _pct(row) {
          var keys = Array.prototype.slice.call(arguments, 1);
          if (!row) return null;
          var raw = g.apply(null, [row].concat(keys));
          var v = parseFloat(raw);
          if (isNaN(v)) return null;
          if (typeof raw === 'string' && raw.trim().slice(-1) === '%') return v / 100;
          if (v > 15) return v / 100;
          return v;
        }
        // Integer-percent helper — for the 25-26 sheet columns that store integer
        // percentages (0–219). Always divides by 100. Avoids the >15 threshold
        // ambiguity: BK=15 must become 0.15, not be left as 15.
        function _iPct(row) {
          var keys = Array.prototype.slice.call(arguments, 1);
          if (!row) return null;
          var raw = g.apply(null, [row].concat(keys));
          var v = parseFloat(raw);
          if (isNaN(v)) return null;
          return v / 100;
        }

        var isELA  = subject === 'ELA';
        var isMath = subject === 'Math';

        var obj = {
          subject:            subject,
          year:               '2025-2026',
          district:           (function(){
            var _dk=['Districts','districts','District','district',
                     'School District','school_district','School Districts','school_districts',
                     'District Name','district_name','LEA','lea','LEA Name','lea_name',
                     'Student District','student_district'];
            var _row = dem||spr||win||{};
            var _val = g.apply(null,[dem].concat(_dk))||g.apply(null,[spr||{}].concat(_dk))||g.apply(null,[win||{}].concat(_dk));
            if (_val) return _val;
            // Fuzzy: find any key containing 'district' in case column was named differently
            var _fk = Object.keys(_row).find(function(k){ return k.toLowerCase().includes('district'); });
            if (_fk && _row[_fk]) return _row[_fk];
            // Fallback: infer district from school name for pilot rows with blank Districts column
            var _school = (g(_row,'School','school')||'').toLowerCase();
            if (_school.includes('penns grove') || _school.includes('carleton'))
              return 'Penns Grove - Carneys Point Regional School District';
            if (_school.includes('gloucester') || _school.includes('loring flemming'))
              return 'Gloucester Township School District';
            if (_school.includes('global leadership'))
              return 'Global Leadership Academy Charter Schools';
            return '';
          })(),
          school:             g(dem,'School','school'),
          grade:              g(dem,'Student Grade','student_grade','Grade'),
          certStatus:         '',
          instructor:         '',   // filled in below from Pearl session data
          tutors:             [],
          scholarId:          sid,
          // "User Name" (col M) is the iReady login ID, which matches the Pearl SESS_STU_IDS
          // value. Stored separately so the Pearl join uses it while scholarId (col D Student ID)
          // continues to be used for cross-year repeat detection against the longitudinal sheet.
          _pearlId:           g(dem,'User Name','user_name') || sid,
          scholarName:        g(dem,'Full Name','full_name') ||
                              (g(dem,'First Name','first_name').trim()+' '+g(dem,'Last Name','last_name').trim()).trim(),
          sex:                g(dem,'Sex','sex'),
          hispanic:           g(dem,'Hispanic or Latino','hispanic_or_latino'),
          race:               g(dem,'Race Analytics','race_analytics','Race'),
          ell:                g(dem,'English Language Learner','english_language_learner','English Language'),
          sped:               g(dem,'Special Education','special_education'),
          ecodis:             g(dem,'Economically Disadvantaged','economically_disadvantaged'),
          // Base (Winter) fields
          baseScore:          _pf(win,'Overall Scale Score','overall_scale_score','Scale Score','scale_score'),
          baseRelPlacement:   _normPlacement(g(win||{},'Overall Relative Placement','overall_relative_placement','Relative Placement','relative_placement')),
          basePlacement:      g(win||{},'Overall Placement','overall_placement','Placement','placement'),
          baseRushFlag:       '',
          // Spring fields
          springScore:        _pf(spr,'Overall Scale Score','overall_scale_score','Scale Score','scale_score'),
          springRelPlacement: _normPlacement(g(spr||{},'Overall Relative Placement','overall_relative_placement','Relative Placement','relative_placement')),
          springPlacement:    g(spr||{},'Overall Placement','overall_placement','Placement','placement'),
          springGain:         _pf(spr,'Diagnostic Gain','diagnostic_gain','Spring Diagnostic Gain','spring_diagnostic_gain'),
          springPercentile:   _pf(spr,'Percentile','percentile'),
          springRushFlag:     '',
          springWeeks:        _pf(spr,'Weeks Between Diagnostics','weeks_between_diagnostics','Spring Weeks Between Diagnostics','spring_weeks_between_diagnostics'),
          pctTypical:         _iPct(spr,'Percent Progress to Annual Typical Growth (%)','percent_progress_to_annual_typical_growth',
                                    'Spring Pct Progress Typical Growth','spring_pct_progress_typical_growth',
                                    '% Progress Toward Typical Growth','pct_progress_toward_typical_growth',
                                    'Pct Progress Typical Growth','pct_progress_typical_growth'),
          pctStretch:         _iPct(spr,'Percent Progress to Annual Stretch Growth (%)','percent_progress_to_annual_stretch_growth',
                                    'Spring Pct Progress Stretch Growth','spring_pct_progress_stretch_growth',
                                    '% Progress Toward Stretch Growth','pct_progress_toward_stretch_growth'),
          annualTypical:      _pf(win,'Typical Growth','typical_growth','Annual Typical Growth Measure','annual_typical_growth_measure'),
          annualStretch:      _pf(win,'Stretch Growth','stretch_growth','Annual Stretch Growth Measure','annual_stretch_growth_measure'),
          // Scale Score Progression (NJTC methodology) — see normalizeRow() for full formula notes.
          expectedGrowthPerWeek: (function(){
            var _at = _pf(win,'Typical Growth','typical_growth','Annual Typical Growth Measure','annual_typical_growth_measure');
            var _wk = _pf(spr,'Weeks Between Diagnostics','weeks_between_diagnostics','Spring Weeks Between Diagnostics','spring_weeks_between_diagnostics');
            return (_at != null && _wk != null && _wk > 0) ? _at / _wk : null;
          }()),
          weeksOfGrowth: (function(){
            var _gain = _pf(spr,'Diagnostic Gain','diagnostic_gain','Spring Diagnostic Gain','spring_diagnostic_gain');
            var _at   = _pf(win,'Typical Growth','typical_growth','Annual Typical Growth Measure','annual_typical_growth_measure');
            var _wk   = _pf(spr,'Weeks Between Diagnostics','weeks_between_diagnostics','Spring Weeks Between Diagnostics','spring_weeks_between_diagnostics');
            if (_gain == null || _at == null || _wk == null || _wk <= 0 || _at <= 0) return null;
            var _perWk = _at / _wk;
            return _perWk > 0 ? _gain / _perWk : null;
          }()),
          isRepeat:           false,  // set below after longitudinal ID scan
          // ELA domain subscores
          elaPhonologicalScore:       isELA ? _pf(win,'Phonological Awareness Scale Score','phonological_awareness_scale_score') : null,
          elaPhonicsScore:            isELA ? _pf(win,'Phonics Scale Score','phonics_scale_score') : null,
          elaHFWScore:                isELA ? _pf(win,'High Frequency Words Scale Score','high_frequency_words_scale_score') : null,
          elaVocabScore:              isELA ? _pf(win,'Vocabulary Scale Score','vocabulary_scale_score') : null,
          elaRCOverallScore:          isELA ? _pf(win,'Reading Comprehension Overall Scale Score','reading_comprehension_overall_scale_score') : null,
          elaRCLitScore:              isELA ? _pf(win,'Reading Comprehension Literature Scale Score','reading_comprehension_literature_scale_score') : null,
          elaRCInfoScore:             isELA ? _pf(win,'Reading Comprehension Informational Text Scale Score','reading_comprehension_informational_text_scale_score') : null,
          elaPhonologicalSpringScore: isELA ? _pf(spr,'Phonological Awareness Scale Score','phonological_awareness_scale_score') : null,
          elaPhonicsSpringScore:      isELA ? _pf(spr,'Phonics Scale Score','phonics_scale_score') : null,
          elaHFWSpringScore:          isELA ? _pf(spr,'High Frequency Words Scale Score','high_frequency_words_scale_score') : null,
          elaVocabSpringScore:        isELA ? _pf(spr,'Vocabulary Scale Score','vocabulary_scale_score') : null,
          elaRCOverallSpringScore:    isELA ? _pf(spr,'Reading Comprehension Overall Scale Score','reading_comprehension_overall_scale_score') : null,
          elaRCLitSpringScore:        isELA ? _pf(spr,'Reading Comprehension Literature Scale Score','reading_comprehension_literature_scale_score') : null,
          elaRCInfoSpringScore:       isELA ? _pf(spr,'Reading Comprehension Informational Text Scale Score','reading_comprehension_informational_text_scale_score') : null,
          // Math domain subscores
          mathNumOpsScore:        isMath ? _pf(win,'Number and Operations Scale Score','number_and_operations_scale_score') : null,
          mathAlgebraScore:       isMath ? _pf(win,'Algebra and Algebraic Thinking Scale Score','algebra_and_algebraic_thinking_scale_score') : null,
          mathMeasDataScore:      isMath ? _pf(win,'Measurement and Data Scale Score','measurement_and_data_scale_score') : null,
          mathGeometryScore:      isMath ? _pf(win,'Geometry Scale Score','geometry_scale_score') : null,
          mathNumOpsSpringScore:     isMath ? _pf(spr,'Number and Operations Scale Score','number_and_operations_scale_score') : null,
          mathAlgebraSpringScore:    isMath ? _pf(spr,'Algebra and Algebraic Thinking Scale Score','algebra_and_algebraic_thinking_scale_score') : null,
          mathMeasDataSpringScore:   isMath ? _pf(spr,'Measurement and Data Scale Score','measurement_and_data_scale_score') : null,
          mathGeometrySpringScore:   isMath ? _pf(spr,'Geometry Scale Score','geometry_scale_score') : null,
          isPilot: (function(){
            var _pv = g(dem,'Pilot Program','pilot_program','Pilot','pilot') ||
                      g(spr||{},'Pilot Program','pilot_program','Pilot','pilot') ||
                      g(win||{},'Pilot Program','pilot_program','Pilot','pilot');
            if (!_pv || _pv.trim() === '') return null;
            return /yes/i.test(_pv.trim());
          }()),
          _source2526: 'manual',  // internal tag — used for clean removal on re-fetch
        };
        // Pilot schools lack iReady-computed Diagnostic Gain and % Progress (first-time diagnostics).
        // Fall back to computing them from raw scale scores so KPI tiles populate correctly.
        if (obj.springGain === null && obj.springScore !== null && obj.baseScore !== null) {
          obj.springGain = parseFloat((obj.springScore - obj.baseScore).toFixed(1));
        }
        if (obj.pctTypical === null && obj.springGain !== null && obj.annualTypical !== null && obj.annualTypical > 0) {
          obj.pctTypical = obj.springGain / obj.annualTypical;
        }
        result.push(obj);
      });
      return result;
    }

    // Source arbitration + instructor assignment + repeat detection + merge.
    // snap2526Results: array of {subj:'ELA'|'Math', text:string} (already null-filtered).
    async function _irlProcess2526(snap2526Results) {
      if (!Array.isArray(snap2526Results)) snap2526Results = [];

      // Parse raw CSV text for each tab that was successfully fetched
      // 'Combined' tabs (eoy key) are split by their Subject column into ELA/Math buckets
      var raw2526 = { ELA: [], Math: [] };
      snap2526Results.forEach(function(item) {
        if (!item || !item.text) return;
        var rows = parseCSV(item.text);
        if (item.subj === 'ELA') {
          raw2526.ELA = raw2526.ELA.concat(rows);
        } else if (item.subj === 'Math') {
          raw2526.Math = raw2526.Math.concat(rows);
        } else if (item.subj === 'Combined') {
          // Split rows by Subject column into ELA / Math buckets
          rows.forEach(function(r) {
            var rawS = (r['Subject'] || r['subject'] || r['SUBJECT'] || '').toLowerCase();
            if (rawS.includes('ela') || rawS.includes('english') || rawS.includes('reading') || rawS.includes('language') || rawS.includes('literacy')) {
              raw2526.ELA.push(r);
            } else if (rawS.includes('math')) {
              raw2526.Math.push(r);
            } else {
              // No subject tag — add to both buckets with explicit subject field
              raw2526.ELA.push(Object.assign({}, r, { Subject: 'ELA'  }));
              raw2526.Math.push(Object.assign({}, r, { Subject: 'Math' }));
            }
          });
        }
      });
      var totalRaw = raw2526.ELA.length + raw2526.Math.length;

      // ── Source arbitration ────────────────────────────────────────────────
      // Longitudinal sheet wins if it already carries 2025-2026 rows (not tagged as manual).
      var longitudinalHas2526 = [...IRLAB_DATA.ela, ...IRLAB_DATA.math].some(function(r) {
        return (r.year || '').trim() === '2025-2026' && r._source2526 !== 'manual';
      });
      var manualSuppressed = localStorage.getItem('njtc_suppress2526manual') === 'true';

      window._iready2526Source = longitudinalHas2526 ? 'longitudinal'
                                : manualSuppressed   ? 'suppressed'
                                : totalRaw > 0       ? 'manual'
                                :                      'none';

      // Always strip any previously merged manual rows before deciding what to add
      IRLAB_DATA.ela  = IRLAB_DATA.ela.filter(function(r)  { return r._source2526 !== 'manual'; });
      IRLAB_DATA.math = IRLAB_DATA.math.filter(function(r) { return r._source2526 !== 'manual'; });
      _irlRepeatIndex = null;
      _irlManual2526Rows = [];

      // Even when the longitudinal sheet has 25-26 data, the EOY student-level tab
      // (IRLAB_2526_GIDS.eoy) carries per-row Overall Scale Score values that the
      // longitudinal format may not export. Run a score-backfill pass: for each
      // student in the EOY tab, find their existing longitudinal row by scholarId
      // and copy baseScore/springScore if they're currently null.
      if (window._iready2526Source !== 'manual') {
        // Build scale score backfill from the live ELA + Math student-level tabs
        // (Norming Window + Overall Scale Score per row format)
        var _elaTabItem = snap2526Results.find(function(i){ return i && i.subj === 'ELA'; });
        var _mathTabItem= snap2526Results.find(function(i){ return i && i.subj === 'Math'; });
        var _hasBackfillData = (_elaTabItem && _elaTabItem.text) || (_mathTabItem && _mathTabItem.text);
        if (_hasBackfillData) {
          var _eoyRaw = [];
          if (_elaTabItem && _elaTabItem.text) {
            _eoyRaw = _eoyRaw.concat(_normalize2526StudentRows(parseCSV(_elaTabItem.text), 'ELA'));
          }
          if (_mathTabItem && _mathTabItem.text) {
            _eoyRaw = _eoyRaw.concat(_normalize2526StudentRows(parseCSV(_mathTabItem.text), 'Math'));
          }
          // Build lookup maps from EOY tab: by (subject+id) primary, (subject+normname) fallback
          var _eoyById   = {};
          var _eoyByName = {};
          function _normN2(s){ return (s||'').trim().toLowerCase().replace(/\s+/g,' '); }
          _eoyRaw.forEach(function(r) {
            var sid  = (r.scholarId   || '').trim();
            var name = _normN2(r.scholarName || '');
            var scores = {};
            if (r.baseScore   !== null) scores.baseScore   = r.baseScore;
            if (r.springScore !== null) scores.springScore = r.springScore;
            if (!Object.keys(scores).length) return;
            if (sid)  { var k = r.subject+'|'+sid;  if (!_eoyById[k])   _eoyById[k]   = scores; }
            if (name) { var k2= r.subject+'|'+name; if (!_eoyByName[k2]) _eoyByName[k2]= scores; }
          });
          // Backfill missing scale scores into longitudinal rows — try ID first, then name
          var _backfilled = 0;
          [...IRLAB_DATA.ela, ...IRLAB_DATA.math].forEach(function(r) {
            if ((r.year || '').trim() !== '2025-2026') return;
            if (r.baseScore !== null && r.springScore !== null) return; // already complete
            var sid  = (r.scholarId   || '').trim();
            var name = _normN2(r.scholarName || '');
            var src  = (sid  && _eoyById[r.subject+'|'+sid])   ||
                       (name && _eoyByName[r.subject+'|'+name]) || null;
            if (!src) return;
            if (r.baseScore   === null && src.baseScore   !== undefined) { r.baseScore   = src.baseScore;   _backfilled++; }
            if (r.springScore === null && src.springScore !== undefined) { r.springScore = src.springScore; _backfilled++; }
          });
          if (_backfilled > 0) console.log('[irlab] Score backfill from EOY tab:', _backfilled, 'fields updated');
          else console.warn('[irlab] Score backfill: 0 fields updated — ID/name mismatch between longitudinal and EOY tab');

          // ── Supplemental merge: add 2526 rows for schools absent from the longitudinal sheet ──
          // The longitudinal sheet may not include every school (e.g. Hamilton Township is only
          // in the 2526 Norming Window sheet). Merge those "orphan school" rows so they appear
          // in the IRLAB and are available to the Apprentice Impact Report and other modules.
          var _longSchools2526 = new Set();
          [...IRLAB_DATA.ela, ...IRLAB_DATA.math].forEach(function(r) {
            if ((r.year||'').trim() === '2025-2026' && r.school)
              _longSchools2526.add((r.school||'').trim().toLowerCase());
          });
          var _suppRows = _eoyRaw.filter(function(r) {
            return r.school && !_longSchools2526.has((r.school||'').trim().toLowerCase());
          });
          if (_suppRows.length) {
            var _suppEla  = _suppRows.filter(function(r){ return r.subject === 'ELA';  });
            var _suppMath = _suppRows.filter(function(r){ return r.subject === 'Math'; });
            if (_suppEla.length)  IRLAB_DATA.ela  = IRLAB_DATA.ela.concat(_suppEla);
            if (_suppMath.length) IRLAB_DATA.math = IRLAB_DATA.math.concat(_suppMath);
            _irlRepeatIndex = null;
            console.log('[irlab] Supplemental 2526 merge (schools not in longitudinal) — ELA:',
                        _suppEla.length, '/ Math:', _suppMath.length);
          }
        }
        return;
      }

      // ── Cert status lookup from HR Master List ────────────────────────────
      // HR_EMPS uses shorthand keys: n=name, r=role.
      function _normN(s){ return (s||'').trim().toLowerCase().replace(/\s+/g,' '); }
      var _hrEmps = (window.HR_EMPS && Array.isArray(window.HR_EMPS)) ? window.HR_EMPS : [];
      var _nameToCert = {};
      _hrEmps.forEach(function(emp) {
        if (!emp) return;
        var empName = emp.n || emp.name || '';
        var role    = (emp.r || emp.role || '').toLowerCase();
        if (!empName || !role) return;
        var cert;
        if      (role.includes('dual'))                                    cert = 'Certified';
        else if (role.includes('non-cert') || role.includes('non cert'))  cert = 'Non Certified';
        else if (role.includes('coach') || role.includes('instructional')) cert = 'Certified';
        else if (role.includes('certified'))                               cert = 'Certified';
        else if (role.includes('site'))                                    cert = 'Certified';
        if (cert) _nameToCert[_normN(empName)] = cert;
      });

      // ── Pearl session join — tutor assignment + tutoring hours ─────────────
      // PRIMARY: student name (SESS col 2) — more reliable than Pearl IDs across systems.
      // SECONDARY: Pearl User IDs (SESS col 16) — used when IDs are present.
      // Both maps store subject-keyed { tutors: Set<name>, mins: number }.
      var sessRows = (window.po && typeof window.po.getSessRows === 'function') ? window.po.getSessRows() : [];
      var SESS_INSTRUCTOR = 1, SESS_STUDENTS = 2, SESS_STU_IDS = 16,
          SESS_SUBJECT = 9, SESS_ACTUAL_DUR_P = 8, SESS_STATUS = 4;

      function _subjKey(raw) {
        var s = (raw || '').toLowerCase();
        if (s.includes('ela') || s.includes('english') || s.includes('literacy') || s.includes('reading') || s.includes('language')) return 'ELA';
        if (s.includes('math')) return 'Math';
        return null;
      }
      function _addToMap(map, key, subj, tutor, mins) {
        if (!key || !subj) return;
        if (!map[key]) map[key] = {};
        if (!map[key][subj]) map[key][subj] = { tutors: new Set(), mins: 0 };
        if (tutor) map[key][subj].tutors.add(tutor);
        map[key][subj].mins += mins;
      }

      var idMap   = {};  // pearlId  → { ELA:{tutors,mins}, Math:{tutors,mins} }
      var nameMap = {};  // lowerName → { ELA:{tutors,mins}, Math:{tutors,mins} }

      sessRows.forEach(function(r) {
        if (!r) return;
        var status = (r[SESS_STATUS] || '').toLowerCase();
        var ok = status.includes('attended') || status.includes('complete') ||
                 status.includes('success')  || status.includes('partial');
        if (!ok) return;
        var subj = _subjKey(r[SESS_SUBJECT]);
        if (!subj) return;
        var tutor   = (r[SESS_INSTRUCTOR] || '').trim();
        var durMins = parseFloat(r[SESS_ACTUAL_DUR_P]) || 45;
        // Index 2 — comma-separated student display names (primary join)
        var stuNames = (r[SESS_STUDENTS] || '').split(',').map(function(s){ return s.trim(); }).filter(Boolean);
        stuNames.forEach(function(nm) { _addToMap(nameMap, nm.toLowerCase(), subj, tutor, durMins); });
        // Index 16 — comma-separated Pearl user IDs (secondary join)
        var stuIds = (r[SESS_STU_IDS] || '').split(',').map(function(s){ return s.trim(); }).filter(Boolean);
        stuIds.forEach(function(id)   { _addToMap(idMap,   id,              subj, tutor, durMins); });
      });

      // ── Repeat scholar detection ─────────────────────────────────────────
      var priorIds = new Set(
        [...IRLAB_DATA.ela, ...IRLAB_DATA.math].map(function(r){ return r.scholarId; }).filter(Boolean)
      );

      // ── Normalize, annotate, and merge each tab ───────────────────────────
      ['ELA', 'Math'].forEach(function(subj) {
        var rows = raw2526[subj];
        if (!rows.length) return;
        var normalized = _normalize2526StudentRows(rows, subj);
        normalized.forEach(function(row) {
          // Assign instructor from Pearl sessions (direct Pearl ID match)
          // Join on iReady User Name (= Pearl user ID) first; fall back to Student ID.
          // The "User Name" column (col M, stored as _pearlId) matches SESS_STU_IDS values.
          // Resolve Pearl session data — try ID maps first, fall back to name map
          var _pid    = row._pearlId || row.scholarId;
          var _lname  = _normN(row.scholarName);
          var _sessData = (idMap[_pid] && idMap[_pid][subj]) ||
                          (idMap[row.scholarId] && idMap[row.scholarId][subj]) ||
                          (nameMap[_lname] && nameMap[_lname][subj]) || null;
          var tutorSet = _sessData ? _sessData.tutors : null;
          if (tutorSet && tutorSet.size > 0) {
            row.instructor = [...tutorSet].join('; ');
            row.tutors     = [...tutorSet];
          } else {
            row.instructor = 'Unidentified';
            row.tutors     = ['Unidentified'];
          }
          // Tutoring hours for this scholar+subject (used by Learning Velocity)
          row._tutorHours = _sessData ? _sessData.mins / 60 : null;
          // Cert status from HR Master List via normalized name fuzzy match
          var _tutorList = tutorSet && tutorSet.size > 0 ? [...tutorSet] : [];
          var _certFound = null;
          for (var _ti = 0; _ti < _tutorList.length; _ti++) {
            var _c = _nameToCert[_normN(_tutorList[_ti])];
            if (_c) { _certFound = _c; break; }
          }
          row.certStatus = _certFound || '';
          row.isRepeat   = priorIds.has(row.scholarId);
          row._hasRepeatCol = true;  // derived via longitudinal ID scan — treat as authoritative
          _irlManual2526Rows.push(row);
        });
        if (subj === 'ELA')  IRLAB_DATA.ela  = IRLAB_DATA.ela.concat(normalized);
        if (subj === 'Math') IRLAB_DATA.math = IRLAB_DATA.math.concat(normalized);
      });

      _irlRepeatIndex = null;  // force rebuild so 25-26 scholars appear in repeat views
      console.log('[irlab] 25-26 snapshot merged — ELA:', raw2526.ELA.length,
                  'raw / Math:', raw2526.Math.length, 'raw / source:', window._iready2526Source);
    }

    // Post-render DOM injection: preliminary banner + Data-dept suppress toggle.
    // Called at the end of renderLab so it runs for every dept lens.
    function _irlPostRender2526() {
      var container = document.getElementById('irlabContainer');
      if (!container) return;

      // Remove any leftovers from the previous render cycle
      var prevBanner = document.getElementById('irlab-prelim-banner');
      if (prevBanner) prevBanner.remove();
      var prevToggle = document.getElementById('irlab-2526-toggle-wrap');
      if (prevToggle) prevToggle.remove();

      var src = window._iready2526Source;
      if (!src || src === 'none') return;

      // ── Preliminary banner — shown only when manual snapshot is active ────
      if (src === 'manual') {
        var banner = document.createElement('div');
        banner.id = 'irlab-prelim-banner';
        banner.style.cssText = [
          'background:#fff8e1','border-left:4px solid #f59e0b','border-radius:6px',
          'padding:10px 14px','margin-bottom:16px','font-size:13px','color:#92400e',
          'display:flex','align-items:center','gap:10px'
        ].join(';');
        banner.innerHTML = '<span style="font-size:16px">⚠️</span>' +
          '<span><strong>SY 2025–26 data is preliminary.</strong> ' +
          'This reflects a manual snapshot pending the official iReady report. ' +
          'Figures may change when the final report is published.</span>';
        container.insertBefore(banner, container.firstChild);
      }

      // ── Data dept suppress toggle — hidden once longitudinal has 25-26 ────
      if (src === 'longitudinal') return;
      var sess   = window.NJTC_SESSION;
      var myDept = (sess && sess.dept) ? sess.dept : _irlDept;
      if (myDept !== 'data') return;

      // Find the compact filter bar's inner flex row (contains .irlab-select elements)
      var filterRow = null;
      var allDivs = container.querySelectorAll('div');
      for (var i = 0; i < allDivs.length; i++) {
        var d = allDivs[i];
        var st = d.getAttribute('style') || '';
        if (st.includes('flex-wrap:wrap') && d.querySelector('.irlab-select')) {
          filterRow = d; break;
        }
      }
      if (!filterRow) return;

      var wrap = document.createElement('label');
      wrap.id = 'irlab-2526-toggle-wrap';
      wrap.style.cssText = 'display:flex;align-items:center;gap:8px;font-size:12px;color:#6b7280;cursor:pointer;padding-left:6px';
      var cb = document.createElement('input');
      cb.type    = 'checkbox';
      cb.id      = 'irlab-2526-toggle';
      cb.style.cursor = 'pointer';
      cb.checked = (src === 'manual');
      cb.addEventListener('change', function() {
        if (cb.checked) { localStorage.removeItem('njtc_suppress2526manual'); }
        else            { localStorage.setItem('njtc_suppress2526manual','true'); }
        _irlFetchLive(true).catch(function(){});
      });
      wrap.appendChild(cb);
      wrap.appendChild(document.createTextNode(' Use preliminary SY25–26 snapshot'));
      filterRow.appendChild(wrap);
    }

    // ── Helpers ──────────────────────────────────────────────────────────────
    // Normalize written-out placement variants (pilot schools) to canonical PLACEMENT_ORDER strings
    const _normPlacement = (v) => {
      if (!v) return v;
      switch (v.trim()) {
        case 'Three or More Grade Levels Below': return '3 or More Grade Levels Below';
        case 'Two Grade Levels Below':           return '2 Grade Levels Below';
        case 'One Grade Level Below':            return '1 Grade Level Below';
        default: return v;
      }
    };
    const pct   = (n,d) => d>0?Math.round(n/d*100):0;
    const avg   = arr  => arr.length?arr.reduce((a,b)=>a+b,0)/arr.length:0;
    const esc   = s    => String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    const medianArr = arr => {
      const nums = arr.map(v=>parseFloat(v)).filter(v=>!isNaN(v)&&isFinite(v));
      if (!nums.length) return null;
      nums.sort((a,b)=>a-b);
      const mid = Math.floor(nums.length/2);
      return nums.length%2 !== 0 ? nums[mid] : (nums[mid-1]+nums[mid])/2;
    };
    const fmtPct = val => val===null||val===undefined ? '—' : (val*100).toFixed(1)+'%';
    const plIdx = p    => PLACEMENT_ORDER.indexOf(p);
    const isOnGL= p    => p==='Early On Grade Level'||p==='Mid or Above Grade Level';
    const is2Below = p => p==='2 Grade Levels Below'||p==='3 or More Grade Levels Below';
    // Grade-level placement scale: maps each placement category to a grade-level numeric offset
    // 0="3+below"→-3, 1="2below"→-2, 2="1below"→-1, 3="Early GL"→0, 4="Mid/Above GL"→+1
    const PL_GL_SCALE = [-3, -2, -1, 0, 1];
    const plToGL = p => { const i=plIdx(p); return i>=0?PL_GL_SCALE[i]:null; };
    // Format a grade-level numeric score into readable English (e.g. -1.5 → "1½ GL below")
    function fmtGradeLevel(gl) {
      if (gl===null||gl===undefined||isNaN(gl)) return '—';
      const abs=Math.abs(gl), dir=gl>0?'above':gl<0?'below':'';
      const whole=Math.floor(abs), frac=abs-whole;
      const fracStr=frac>=0.75?'¾':frac>=0.4?'½':frac>=0.15?'¼':'';
      const numStr=(whole>0?whole:'')+(fracStr?(whole>0?' ':'')+fracStr:'');
      if (!numStr||numStr==='0') return 'On grade level';
      return numStr+' GL '+(dir||'');
    }

    // ── Repeat Scholar Cross-Year Detection ───────────────────────────────────
    // Pool ALL data sources (math + ela + mathRepeat + elaRepeat) with de-dup.
    // This handles cases where live data loads only into the repeat sheets.
    function _getPooledRows() {
      const seen = new Set();
      const rows = [];
      const addRows = arr => arr.forEach(r => {
        const rawId   = (r.scholarId   || '').trim();
        const rawName = (r.scholarName || '').trim();
        const useId   = rawId && rawId !== '0';
        const pKey    = useId ? 'id:'+rawId : rawName ? 'n:'+rawName.toLowerCase().replace(/\s+/g,' ') : null;
        if (!pKey) return;
        const k = (r.year||'') + '|' + (r.subject||'') + '|' + pKey;
        if (!seen.has(k)) { seen.add(k); rows.push(r); }
      });
      addRows(IRLAB_DATA.math);
      addRows(IRLAB_DATA.ela);
      addRows(IRLAB_DATA.mathRepeat);
      addRows(IRLAB_DATA.elaRepeat);
      return rows;
    }

    // Build the cross-year repeat scholar index from ALL pooled data.
    // Primary match: scholarId. Fallback (only when no valid ID): normalized name.
    // A scholar is "repeat" if they appear in 2+ distinct academic years.
    function _buildRepeatIndex() {
      const allRows = _getPooledRows();
      const byKey = new Map();
      allRows.forEach(r => {
        const rawId   = (r.scholarId   || '').trim();
        const rawName = (r.scholarName || '').trim();
        const useId   = rawId && rawId !== '0';
        const key     = useId ? 'id:'+rawId : rawName ? 'n:'+rawName.toLowerCase().replace(/\s+/g,' ') : null;
        if (!key) return;
        if (!byKey.has(key)) byKey.set(key, { id: useId?rawId:null, name: rawName||rawId, usedId: useId, years: new Set(), records: [] });
        const e = byKey.get(key);
        e.years.add(r.year);
        if (rawName && !e.name) e.name = rawName;
        e.records.push(r);
      });
      const repeatIdSet   = new Set();
      const repeatNameSet = new Set();
      const repeatScholars = [];
      byKey.forEach((data, key) => {
        if (data.years.size >= 2) {
          if (key.startsWith('id:')) repeatIdSet.add(key.slice(3));
          else repeatNameSet.add(key.slice(2));
          repeatScholars.push({ ...data, key, yearsArr: [...data.years].sort() });
        }
      });
      repeatScholars.sort((a,b) => b.years.size - a.years.size || a.name.localeCompare(b.name));
      return { byKey, repeatIdSet, repeatNameSet, repeatScholars };
    }

    function _getRepeatIndex() {
      if (!_irlRepeatIndex) _irlRepeatIndex = _buildRepeatIndex();
      return _irlRepeatIndex;
    }

    // Check if a single row belongs to a repeat scholar.
    // Uses ID lookup first; name lookup only when row has no valid ID.
    function _isRepeatScholar(r) {
      if (!r) return false;
      // Trust the live sheet's own "Repeat Scholar" / "Repeat Scholar YOY" column
      // when the row actually carries that column — it's the authoritative, per-row
      // source of truth straight from the ELA/Math tabs. Cross-year ID/name matching
      // is only used as a fallback for rows that don't carry that column at all
      // (e.g. legacy repeat-only tabs or the SY25-26 manual snapshot pathway).
      if (r._hasRepeatCol) return !!r.isRepeat;
      const idx    = _getRepeatIndex();
      const rawId  = (r.scholarId || '').trim();
      if (rawId && rawId !== '0') return idx.repeatIdSet.has(rawId);
      const nameKey = (r.scholarName || '').trim().toLowerCase().replace(/\s+/g,' ');
      return nameKey ? idx.repeatNameSet.has(nameKey) : false;
    }

    function getRows(opts={}) {
      const subject     = opts.subject     !== undefined ? opts.subject     : _irlSubject;
      const year        = opts.year        !== undefined ? opts.year        : _irlYear;
      const district    = opts.district    !== undefined ? opts.district    : _irlDistrict;
      const school      = opts.school      !== undefined ? opts.school      : _irlSchool;
      const grade       = opts.grade       !== undefined ? opts.grade       : _irlGrade;
      const scholarType = opts.scholarType !== undefined ? opts.scholarType : _irlScholarType;
      const pilot       = opts.pilot       !== undefined ? opts.pilot       : _irlPilot;
      // Pool all 4 sources (handles live data landing in mathRepeat/elaRepeat sheets)
      let rows = _getPooledRows();
      if (subject     !== 'all') rows = rows.filter(r => r.subject  === subject);
      if (year        !== 'all') rows = rows.filter(r => r.year     === year);
      if (district    !== 'all') rows = rows.filter(r => r.district === district);
      if (school      !== 'all') rows = rows.filter(r => r.school   === school);
      if (grade       !== 'all') rows = rows.filter(r => r.grade    === grade);
      // Repeat filter uses computed cross-year index (ID-first, name-fallback)
      if (scholarType === 'repeat')    rows = rows.filter(r =>  _isRepeatScholar(r));
      if (scholarType === 'nonrepeat') rows = rows.filter(r => !_isRepeatScholar(r));
      // Pilot filter: 'pilot' = only pilot schools; 'nonpilot' = exclude pilot schools
      if (pilot === 'pilot')    rows = rows.filter(r => r.isPilot === true);
      if (pilot === 'nonpilot') rows = rows.filter(r => r.isPilot !== true);
      if (_irlSearch) {
        const _sq = _irlSearch.toLowerCase();
        rows = rows.filter(r =>
          (r.instructor  || '').toLowerCase().includes(_sq) ||
          (r.school      || '').toLowerCase().includes(_sq) ||
          (r.district    || '').toLowerCase().includes(_sq) ||
          (r.scholarName || '').toLowerCase().includes(_sq)
        );
      }
      return rows.filter(r=>r.baseRelPlacement&&r.springRelPlacement&&
        PLACEMENT_ORDER.includes(r.baseRelPlacement)&&PLACEMENT_ORDER.includes(r.springRelPlacement));
    }

    // Get all rows without placement filter (for typical growth KPI which uses all rows with pctTypical)
    function getAllRows(opts={}) {
      const subject     = opts.subject     !== undefined ? opts.subject     : _irlSubject;
      const year        = opts.year        !== undefined ? opts.year        : _irlYear;
      const district    = opts.district    !== undefined ? opts.district    : _irlDistrict;
      const school      = opts.school      !== undefined ? opts.school      : _irlSchool;
      const grade       = opts.grade       !== undefined ? opts.grade       : _irlGrade;
      const scholarType = opts.scholarType !== undefined ? opts.scholarType : _irlScholarType;
      const pilot       = opts.pilot       !== undefined ? opts.pilot       : _irlPilot;
      let rows = _getPooledRows();
      if (subject     !== 'all') rows = rows.filter(r => r.subject  === subject);
      if (year        !== 'all') rows = rows.filter(r => r.year     === year);
      if (district    !== 'all') rows = rows.filter(r => r.district === district);
      if (school      !== 'all') rows = rows.filter(r => r.school   === school);
      if (grade       !== 'all') rows = rows.filter(r => r.grade    === grade);
      if (scholarType === 'repeat')    rows = rows.filter(r =>  _isRepeatScholar(r));
      if (scholarType === 'nonrepeat') rows = rows.filter(r => !_isRepeatScholar(r));
      if (pilot === 'pilot')    rows = rows.filter(r => r.isPilot === true);
      if (pilot === 'nonpilot') rows = rows.filter(r => r.isPilot !== true);
      if (_irlSearch) {
        const _sq = _irlSearch.toLowerCase();
        rows = rows.filter(r =>
          (r.instructor  || '').toLowerCase().includes(_sq) ||
          (r.school      || '').toLowerCase().includes(_sq) ||
          (r.district    || '').toLowerCase().includes(_sq) ||
          (r.scholarName || '').toLowerCase().includes(_sq)
        );
      }
      return rows;
    }

    // ── Core analytics ───────────────────────────────────────────────────────
    function computeMetrics(rows) {
      if (!rows || !rows.length) return null;
      const valid = rows.filter(r=>PLACEMENT_ORDER.includes(r.baseRelPlacement)&&PLACEMENT_ORDER.includes(r.springRelPlacement));
      const n=valid.length; if (!n) return null;
      const moved   = valid.filter(r=>plIdx(r.springRelPlacement)>plIdx(r.baseRelPlacement));
      const held    = valid.filter(r=>plIdx(r.springRelPlacement)===plIdx(r.baseRelPlacement));
      const regress = valid.filter(r=>plIdx(r.springRelPlacement)<plIdx(r.baseRelPlacement));
      const baseOnGL = valid.filter(r=>isOnGL(r.baseRelPlacement));
      const sprOnGL  = valid.filter(r=>isOnGL(r.springRelPlacement));
      const base2Below = valid.filter(r=>is2Below(r.baseRelPlacement));
      const spr2Below  = valid.filter(r=>is2Below(r.springRelPlacement));
      const gains   = valid.map(r=>r.springGain).filter(v=>v!==null&&!isNaN(v));
      const typPcts = valid.map(r=>r.pctTypical).filter(v=>v!==null&&!isNaN(v));
      const metTyp  = typPcts.filter(v=>v>=1.0);
      const baseDist={},springDist={};
      PLACEMENT_ORDER.forEach(p=>{baseDist[p]=0;springDist[p]=0;});
      valid.forEach(r=>{
        if(baseDist[r.baseRelPlacement]!==undefined)baseDist[r.baseRelPlacement]++;
        if(springDist[r.springRelPlacement]!==undefined)springDist[r.springRelPlacement]++;
      });
      const groupBy = key=>{const m={};valid.forEach(r=>{const k=r[key]||'Unknown';if(!m[k])m[k]=[];m[k].push(r);});return m;};
      return {
        n, valid, moved, held, regress,
        baseOnGL, sprOnGL, base2Below, spr2Below,
        gains, avgGain: gains.length?avg(gains):null,
        typPcts, metTyp, avgTyp: typPcts.length?avg(typPcts):null,
        medianTyp: medianArr(typPcts),
        metTypPct: typPcts.length?pct(metTyp.length,typPcts.length):null,
        baseDist, springDist,
        byDistrict: groupBy('district'), byGrade: groupBy('grade'),
        bySchool:   groupBy('school'),
        byCert: groupBy('certStatus'),   bySubject: groupBy('subject'),
        demog: computeDemographics(valid),
        tutorMap: buildTutorMap(valid),
        pctMoved: pct(moved.length,n), pctHeld: pct(held.length,n),
        pctRegress: pct(regress.length,n), pctOnGL: pct(sprOnGL.length,n),
        pct2Below: pct(spr2Below.length,n), glGain: sprOnGL.length-baseOnGL.length,
        below2Chg: spr2Below.length-base2Below.length,
        // Average grade-level placement (numeric scale: -3 to +1)
        avgBaseGL:   (()=>{ const s=valid.map(r=>plToGL(r.baseRelPlacement)).filter(v=>v!==null); return s.length?s.reduce((a,b)=>a+b,0)/s.length:null; })(),
        avgSpringGL: (()=>{ const s=valid.map(r=>plToGL(r.springRelPlacement)).filter(v=>v!==null); return s.length?s.reduce((a,b)=>a+b,0)/s.length:null; })(),
      };
    }

    function computeDemographics(rows) {
      if (!rows.length) return null;
      const byRace={},bySex={},byHisp={},byELL={},bySped={},byEcoDis={};
      rows.forEach(r=>{
        const race=r.race||'Not Provided';
        const sex =r.sex ||'Not Provided';
        const hisp=r.hispanic==='Y'?'Hispanic/Latino':r.hispanic==='N'?'Non-Hispanic':'Not Provided';
        const ell =r.ell ==='Y'?'ELL':'Non-ELL';
        const sped=r.sped==='Y'?'SPED':'Non-SPED';
        const eco =r.ecodis==='Y'?'Econ. Disadvantaged':'Not Identified';
        [byRace,bySex,byHisp,byELL,bySped,byEcoDis].forEach((obj,i)=>{
          const key=[race,sex,hisp,ell,sped,eco][i];
          if(!obj[key])obj[key]={total:0,moved:0,held:0,regressed:0,atGL:0,gain:[]};
          obj[key].total++;
          const mv=plIdx(r.springRelPlacement)-plIdx(r.baseRelPlacement);
          if(mv>0)obj[key].moved++;else if(mv<0)obj[key].regressed++;else obj[key].held++;
          if(isOnGL(r.springRelPlacement))obj[key].atGL++;
          if(r.springGain!==null&&!isNaN(r.springGain))obj[key].gain.push(r.springGain);
        });
      });
      return {byRace,bySex,byHisp,byELL,bySped,byEcoDis};
    }

    function buildTutorMap(rows) {
      const map={};
      rows.forEach(r=>{
        r.tutors.forEach(tutor=>{
          if(!tutor) return;
          if(!map[tutor])map[tutor]={name:tutor,scholars:new Set(),records:[],certStatus:new Set(),moved:0,held:0,regressed:0,gains:[],glCount:0,districts:new Set(),years:new Set(),subjects:new Set()};
          const tp=map[tutor];
          tp.scholars.add(r.scholarId||r.scholarName);
          tp.records.push(r); tp.certStatus.add(r.certStatus);
          tp.districts.add(r.district); tp.years.add(r.year); tp.subjects.add(r.subject);
          const mv=plIdx(r.springRelPlacement)-plIdx(r.baseRelPlacement);
          if(mv>0)tp.moved++;else if(mv<0)tp.regressed++;else tp.held++;
          if(isOnGL(r.springRelPlacement))tp.glCount++;
          if(r.springGain!==null&&!isNaN(r.springGain))tp.gains.push(r.springGain);
        });
      });
      Object.values(map).forEach(tp=>{
        tp.scholarCount=tp.scholars.size;
        tp.total=tp.moved+tp.held+tp.regressed;
        tp.pctMoved=pct(tp.moved,tp.total);
        tp.pctGL=pct(tp.glCount,tp.total);
        tp.avgGain=tp.gains.length?avg(tp.gains):null;
        tp.cert=[...tp.certStatus].filter(Boolean).join(', ');
      });
      return map;
    }

    // ── Render helpers ───────────────────────────────────────────────────────
    function demogRows(obj) {
      if(!obj) return '';
      return Object.entries(obj).sort((a,b)=>b[1].total-a[1].total).map(([label,d])=>{
        if(!d.total) return '';
        if((label==='Not Provided'||label==='Non-ELL'||label==='Non-SPED')&&d.total<10) return '';
        const mv=pct(d.moved,d.total), gl=pct(d.atGL,d.total);
        const col=mv>=55?'#0d6e3a':mv>=35?'#d97706':'#b91c1c';
        const ag=d.gain.length?avg(d.gain).toFixed(1):'—';
        return `<tr><td style="font-weight:600;color:var(--navy);overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${esc(label)}">${esc(label)}</td>
          <td style="text-align:center">${d.total}</td>
          <td style="text-align:center;font-weight:700;color:${col}">${mv}%</td>
          <td style="text-align:center;font-weight:700;color:${gl>=50?'#0d6e3a':gl>=25?'#d97706':'#b91c1c'}">${gl}%</td>
          <td style="text-align:center;color:var(--blue-mid);font-weight:600">${ag!=='—'?'+'+ag:'—'}</td></tr>`;
      }).join('');
    }

    function subgroupTable(groups, title) {
      const rows = demogRows(groups);
      if (!rows) return '';
      return `<div>
        <div style="font-size:.6875rem;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:var(--muted);margin-bottom:.4rem">${title}</div>
        <table class="irlab-rank-table" style="font-size:.775rem;width:100%;table-layout:fixed">
          <colgroup><col style="width:auto"><col style="width:38px"><col style="width:64px"><col style="width:52px"><col style="width:64px"></colgroup>
          <thead><tr><th>Group</th><th style="text-align:center">N</th><th style="text-align:center">Moved Up</th><th style="text-align:center">At GL</th><th style="text-align:center">Avg Gain</th></tr></thead>
          <tbody>${rows}</tbody>
        </table></div>`;
    }

    function renderBar(val, color) {
      return `<div style="display:flex;align-items:center;gap:.5rem">
        <div style="flex:1;height:6px;background:var(--border);border-radius:3px;overflow:hidden">
          <div style="width:${Math.min(val,100)}%;height:100%;background:${color};border-radius:3px"></div>
        </div>
        <span style="font-weight:700;color:${color};font-size:.75rem;min-width:32px">${val}%</span>
      </div>`;
    }

    function renderPlacementShift(m) {
      return `<table class="irlab-rank-table">
        <thead><tr><th>Placement Level</th><th style="text-align:right">Base</th><th style="text-align:right">Spring</th><th style="text-align:center">Change</th></tr></thead>
        <tbody>${PLACEMENT_ORDER.map(p=>{
          const b=m.baseDist[p]||0, s=m.springDist[p]||0, c=s-b;
          const cs=c>0?`<span style="color:#0d6e3a;font-weight:700">+${c}</span>`:c<0?`<span style="color:#b91c1c;font-weight:700">${c}</span>`:`<span style="color:var(--muted)">—</span>`;
          return `<tr><td style="color:${PLC[p]};font-weight:600">${PLC_SHORT[p]}</td><td style="text-align:right;font-weight:600">${b}</td><td style="text-align:right;font-weight:600">${s}</td><td style="text-align:center">${cs}</td></tr>`;
        }).join('')}</tbody></table>`;
    }

    // ── DATA DEPT: Embedded CSV Update Panel ─────────────────────────────────
    function renderDataUpdatePanel() {
      const stored = (() => { try { return JSON.parse(localStorage.getItem(EMBED_STORE_KEY)||'null'); } catch(e){return null;} })();
      const lastUpdate = stored ? new Date(stored.ts).toLocaleString() : null;
      const rowCounts  = stored ? `Math: ${(stored.math||[]).length} rows · ELA: ${(stored.ela||[]).length} rows · Math Repeat: ${(stored.mathRep||[]).length} rows · ELA Repeat: ${(stored.elaRep||[]).length} rows` : 'No update stored';

      return `
        <div class="irlab-card" style="border:2px solid #7b2d8b;margin-bottom:1.25rem">
          <div class="irlab-card-hd" style="background:#f5edfb;border-bottom-color:#e9d5f7">
            <div>
              <div class="irlab-card-title" style="color:#7b2d8b">🔬 Data & Eval — Embedded Data Manager</div>
              <div class="irlab-card-meta">Upload new CSVs to update all department views · Stored locally · No server required</div>
            </div>
            ${lastUpdate ? `<span style="font-size:.75rem;background:#ede9fe;color:#6d28d9;padding:.3rem .75rem;border-radius:12px;font-weight:600">Last updated: ${lastUpdate}</span>` : '<span style="font-size:.75rem;background:#fef3c7;color:#92400e;padding:.3rem .75rem;border-radius:12px;font-weight:600">Using embedded EOY data</span>'}
          </div>
          <div class="irlab-card-body">

            <!-- Status strip -->
            <div style="background:${stored?'#f0fdf4':'#fffbeb'};border:1px solid ${stored?'#86efac':'#fde68a'};border-radius:8px;padding:.75rem 1rem;margin-bottom:1.25rem;font-size:.8125rem;display:flex;align-items:center;gap:.75rem">
              <span style="font-size:1.25rem">${stored?'✅':'📦'}</span>
              <div>
                <div style="font-weight:700;color:var(--navy)">${stored ? 'Custom dataset active' : 'Embedded EOY data active'}</div>
                <div style="color:var(--muted)">${rowCounts}</div>
              </div>
              ${stored ? `<button onclick="irlab.clearEmbedded()" style="margin-left:auto;background:#fef2f2;border:1px solid #fecaca;color:#991b1b;border-radius:6px;padding:.375rem .875rem;font-size:.75rem;font-weight:600;cursor:pointer">↩ Revert to EOY</button>` : ''}
            </div>

            <!-- How it works -->
            <div style="background:var(--surface-2);border-radius:8px;padding:.875rem 1rem;margin-bottom:1.25rem;font-size:.8125rem;color:var(--text-2);line-height:1.6">
              <strong style="color:var(--navy)">How this works:</strong> Upload 1–4 i-Ready CSV exports below.
              Data is parsed locally in your browser and saved to <em>this device's</em> localStorage.
              All department views (Leadership, Programming, HR, Finance) will immediately reflect the new data.
              To share an update with others, each user must re-upload on their device, <strong>or</strong> use the Quick CSV tab for a session-only view.
            </div>

            <!-- Upload grid: 4 CSV slots -->
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;margin-bottom:1.25rem">
              ${[
                {key:'math',    label:'Math (Longitudinal)',      icon:'➗', required:true,  desc:'Main Math diagnostic data'},
                {key:'ela',     label:'ELA (Longitudinal)',       icon:'📖', required:true,  desc:'Main ELA diagnostic data'},
                {key:'mathRep', label:'Math Repeat Scholars',     icon:'🔁', required:false, desc:'YOY cohort — optional'},
                {key:'elaRep',  label:'ELA Repeat Scholars',      icon:'🔁', required:false, desc:'YOY cohort — optional'},
              ].map(slot => {
                const hasData = stored && (stored[slot.key]||[]).length > 0;
                const rowCount = hasData ? (stored[slot.key]||[]).length : 0;
                return `<div class="irlab-upload-slot" id="irlabSlot_${slot.key}">
                  <div style="display:flex;align-items:center;gap:.5rem;margin-bottom:.5rem">
                    <span style="font-size:1rem">${slot.icon}</span>
                    <span style="font-weight:700;font-size:.875rem;color:var(--navy)">${slot.label}</span>
                    ${slot.required ? '<span style="font-size:.625rem;background:#fef3c7;color:#92400e;padding:.1rem .4rem;border-radius:8px;font-weight:700">REQUIRED</span>' : '<span style="font-size:.625rem;background:var(--surface-3);color:var(--muted);padding:.1rem .4rem;border-radius:8px">OPTIONAL</span>'}
                  </div>
                  <div style="font-size:.75rem;color:var(--muted);margin-bottom:.5rem">${slot.desc}</div>
                  ${hasData
                    ? `<div style="background:#f0fdf4;border:1px solid #86efac;border-radius:6px;padding:.375rem .625rem;font-size:.75rem;color:#166534;font-weight:600;margin-bottom:.375rem">✅ ${rowCount} rows loaded</div>`
                    : `<div style="background:var(--surface-2);border:1px solid var(--border);border-radius:6px;padding:.375rem .625rem;font-size:.75rem;color:var(--muted);margin-bottom:.375rem">No data loaded</div>`
                  }
                  <label style="display:block;cursor:pointer">
                    <input type="file" accept=".csv" style="display:none" onchange="irlab.handleEmbedUpload('${slot.key}', this)">
                    <span style="display:inline-flex;align-items:center;gap:.375rem;background:var(--surface);border:1.5px solid var(--border);border-radius:6px;padding:.375rem .875rem;font-size:.8125rem;font-weight:600;color:var(--navy);cursor:pointer;transition:all .15s" onmouseover="this.style.borderColor='#7b2d8b'" onmouseout="this.style.borderColor=''">
                      📂 ${hasData ? 'Replace CSV' : 'Upload CSV'}
                    </span>
                  </label>
                </div>`;
              }).join('')}
            </div>

            <!-- Apply button -->
            <div style="display:flex;gap:.75rem;align-items:center;flex-wrap:wrap">
              <button id="irlabApplyBtn" onclick="irlab.applyEmbeddedUpdate()" style="background:#7b2d8b;color:#fff;border:none;border-radius:8px;padding:.625rem 1.5rem;font-size:.875rem;font-weight:700;cursor:pointer;opacity:.5" disabled>
                ✅ Apply & Refresh All Views
              </button>
              <span id="irlabApplyStatus" style="font-size:.8125rem;color:var(--muted)"></span>
            </div>

            <div style="margin-top:1rem;padding:.75rem;background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;font-size:.75rem;color:#1e40af">
              <strong>💡 Tip:</strong> After applying, all department tabs will immediately show the new data.
              The update persists on this device until you revert or upload again.
              Other users see the embedded EOY data until they upload on their own device.
            </div>
          </div>
        </div>`;
    }

    // ── Staged upload state for Data dept ────────────────────────────────────
    const _staged = { math:null, ela:null, mathRep:null, elaRep:null };

    function handleEmbedUpload(key, input) {
      // Only data dept may upload CSVs
      const _us = window.NJTC_SESSION;
      if ((_us && _us.dept) !== 'data' && ((_us && _us.dept) || _irlDept) !== 'data') {
        console.warn('[irlab] Upload blocked: not data dept'); return;
      }
      const file = input.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = e => {
        const text = e.target.result;
        const rawRows = parseCSV(text);
        if (!rawRows.length) {
          alert('Could not parse CSV — check format.');
          return;
        }
        // Detect subject from filename or content
        const isELA = file.name.toLowerCase().includes('ela') ||
          Object.keys(rawRows[0]||{}).some(k=>k.toLowerCase().includes('phonics')||k.toLowerCase().includes('vocabulary'));
        const subject = (key==='ela'||key==='elaRep') ? 'ELA' : isELA ? 'ELA' : 'Math';
        const normalized = rawRows.map(r => normalizeRow(r, subject));
        _staged[key] = normalized;

        // Update slot UI
        const slot = document.getElementById('irlabSlot_' + key);
        if (slot) {
          const statusEl = slot.querySelector('div[style*="border-radius:6px"]');
          if (statusEl) {
            statusEl.style.background='#eff6ff'; statusEl.style.borderColor='#93c5fd'; statusEl.style.color='#1e40af';
            statusEl.textContent = `📋 ${normalized.length} rows staged — click Apply`;
          }
        }

        // Enable apply button if at least math is staged or already stored
        const canApply = _staged.math || _staged.ela ||
          (() => { try { const s=JSON.parse(localStorage.getItem(EMBED_STORE_KEY)||'null'); return s&&s.math&&s.math.length; } catch(e){return false;} })();
        const btn = document.getElementById('irlabApplyBtn');
        const status = document.getElementById('irlabApplyStatus');
        if (btn) { btn.disabled = !canApply; btn.style.opacity = canApply ? '1' : '.5'; }
        if (status) status.textContent = `${Object.values(_staged).filter(Boolean).length} file(s) staged`;
      };
      reader.readAsText(file);
    }

    function applyEmbeddedUpdate() {
      // Only data dept may apply embedded updates
      const _as = window.NJTC_SESSION;
      const _aDept = (_as && _as.dept) ? _as.dept : _irlDept;
      if (_aDept !== 'data') { console.warn('[irlab] applyEmbeddedUpdate blocked: not data dept'); return; }
      // Merge staged with existing stored
      let existing = { math:[], ela:[], mathRep:[], elaRep:[], ts:null };
      try { existing = JSON.parse(localStorage.getItem(EMBED_STORE_KEY)||'null') || existing; } catch(e) {}

      const merged = {
        ts:      Date.now(),
        math:    _staged.math    || existing.math    || [],
        ela:     _staged.ela     || existing.ela      || [],
        mathRep: _staged.mathRep || existing.mathRep  || [],
        elaRep:  _staged.elaRep  || existing.elaRep   || [],
      };

      try {
        localStorage.setItem(EMBED_STORE_KEY, JSON.stringify(merged));
      } catch(e) {
        alert('Storage quota exceeded. Try reducing the CSV files (remove extra columns, limit to current SY).');
        return;
      }

      // Reset IRLAB_DATA and reload
      Object.assign(IRLAB_DATA, {math:[],ela:[],mathRepeat:[],elaRepeat:[],loaded:false,source:null,ts:null});
      _staged.math=null; _staged.ela=null; _staged.mathRep=null; _staged.elaRep=null;

      // Set source label before loadData so getSummary reflects it
      IRLAB_DATA.source = 'Data Upload · ' + new Date().toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'});
      loadData();

      // ── Broadcast snapshot to all departments ──────────────────
      // Compute summary AFTER loadData so it uses the new data
      setTimeout(function() {
        try {
          var snap = getSummary();
          if (snap) {
            var dept = window.NJTC_SESSION ? window.NJTC_SESSION.dept : 'data';
            var snapshot = {
              ts: Date.now(),
              uploadedBy: dept,
              summary: snap,
              sy: snap.activeSY || 'SY 2025-2026',
              totalRows: merged.math.length + merged.ela.length + merged.mathRep.length + merged.elaRep.length
            };
            localStorage.setItem('njtc_irlab_snapshot_v1', JSON.stringify(snapshot));
            console.log('[irlab] Snapshot saved and broadcast to all depts:', snapshot.sy, snapshot.totalRows, 'rows');
          }
        } catch(e) { console.warn('[irlab] Snapshot broadcast failed:', e.message); }
      }, 400);

      const status = document.getElementById('irlabApplyStatus');
      if (status) status.textContent = '✅ Applied! Refreshing…';
      setTimeout(() => {
        _irlMode = 'embedded';
        renderLab();
      }, 300);
    }

    function clearEmbedded() {
      if (!confirm('Revert to original embedded EOY data? Your uploaded dataset will be removed from this device.')) return;
      try { localStorage.removeItem(EMBED_STORE_KEY); } catch(e) {}
      Object.assign(IRLAB_DATA, {math:[],ela:[],mathRepeat:[],elaRepeat:[],loaded:false,source:null,ts:null});
      loadData();
      renderLab();
    }

    // ── SCHOLAR DRILL-DOWN ───────────────────────────────────────────────────
    function renderScholarDrill(scholarName) {
      const allRows = [...IRLAB_DATA.math,...IRLAB_DATA.ela,...IRLAB_DATA.mathRepeat,...IRLAB_DATA.elaRepeat];
      const sName = scholarName.trim().toLowerCase();
      const records = allRows.filter(r=>(r.scholarName||'').trim().toLowerCase()===sName);
      if (!records.length) return `<div class="irlab-empty" style="padding:2rem">
        <div class="irlab-empty-icon">🔍</div>
        <div class="irlab-empty-title">Scholar not found</div>
        <div class="irlab-empty-sub">No records found for "${esc(scholarName)}"</div>
        <button class="btn btn-secondary" style="margin-top:1rem" onclick="irlab.closeDrill()">← Back</button></div>`;

      records.sort((a,b)=>(a.year>b.year?1:-1)||(a.subject>b.subject?1:-1));
      const latest = records[records.length-1];
      const histRows = records.map(r=>{
        const mv=plIdx(r.springRelPlacement)-plIdx(r.baseRelPlacement);
        const mvStr=mv>0?`<span style="color:#0d6e3a;font-weight:700">▲ +${mv}</span>`:mv<0?`<span style="color:#b91c1c;font-weight:700">▼ ${mv}</span>`:`<span style="color:var(--muted)">→ 0</span>`;
        const sprCol=PLC[r.springRelPlacement]||'var(--muted)';
        const tutorStr=r.tutors.length?r.tutors.map(t=>`<span style="font-size:.7rem;background:var(--surface-2);padding:.1rem .35rem;border-radius:4px;border:1px solid var(--border)">${esc(t)}</span>`).join(' '):'—';
        return `<tr><td><strong>${esc(r.year)}</strong></td><td>${esc(r.subject)}</td>
          <td style="font-size:.75rem;color:var(--muted)">${esc(r.baseRelPlacement||'—')}</td>
          <td><span style="color:${sprCol};font-weight:600">${esc(r.springRelPlacement||'—')}</span></td>
          <td>${mvStr}</td><td style="color:var(--blue-mid);font-weight:600">${r.springGain!==null?'+'+r.springGain.toFixed(0):'—'}</td>
          <td style="font-size:.75rem">${tutorStr}</td><td style="font-size:.75rem;color:var(--muted)">${esc(r.school)}</td></tr>`;
      }).join('');

      return `<div style="margin-bottom:1rem;display:flex;align-items:center;gap:.75rem;flex-wrap:wrap">
        <button class="btn btn-secondary" style="font-size:.8125rem" onclick="irlab.closeDrill()">← Back</button>
        <span class="irlab-window-badge">Scholar Profile</span></div>
        <div class="irlab-card">
          <div class="irlab-card-hd">
            <div class="irlab-card-title">👤 ${esc(latest.scholarName||scholarName)}</div>
            <div class="irlab-card-meta">Grade ${esc(latest.grade||'?')} · ${esc(latest.district)} · ${esc(latest.school)}</div>
          </div>
          <div class="irlab-card-body">
            <div style="display:flex;gap:1rem;flex-wrap:wrap;margin-bottom:1rem;font-size:.8125rem">
              ${[['Race',latest.race||'—'],['Sex',latest.sex||'—'],['Hispanic',latest.hispanic==='Y'?'Yes':latest.hispanic==='N'?'No':'—'],['ELL',latest.ell==='Y'?'Yes':'—'],['SPED',latest.sped==='Y'?'Yes':'—'],['EcoDis',latest.ecodis==='Y'?'Yes':'—']].map(([l,v])=>`<div><span style="color:var(--muted)">${l}: </span><strong>${esc(v)}</strong></div>`).join('')}
            </div>
            <div style="overflow-x:auto">
              <table class="irlab-rank-table">
                <thead><tr><th>Year</th><th>Subject</th><th>Baseline</th><th>Spring</th><th>Δ Level</th><th>Scale Gain</th><th>Instructor(s)</th><th>School</th></tr></thead>
                <tbody>${histRows}</tbody>
              </table>
            </div>
          </div>
        </div>`;
    }

    // ── TUTOR DRILL-DOWN ─────────────────────────────────────────────────────
    function renderTutorDrill(tutorName, dept) {
      if (dept==='data') return `<div class="irlab-empty" style="padding:2rem">
        <div class="irlab-empty-icon">🔒</div>
        <div class="irlab-empty-title">Tutor profiles not available in Data & Eval view</div>
        <button class="btn btn-secondary" style="margin-top:1rem" onclick="irlab.closeDrill()">← Back</button></div>`;

      const allRows=[...IRLAB_DATA.math,...IRLAB_DATA.ela,...IRLAB_DATA.mathRepeat,...IRLAB_DATA.elaRepeat];
      const tName=tutorName.trim().toLowerCase();
      const records=allRows.filter(r=>{
        if(!r.instructor) return false;
        return r.instructor.split(',').map(n=>n.trim().toLowerCase()).some(t=>{
          if(t===tName) return true;
          const tp=t.split(' '), np=tName.split(' ');
          return tp.length>=2&&np.length>=2&&tp[tp.length-1]===np[np.length-1]&&tp[0][0]===np[0][0];
        });
      });

      const scholarMap={};
      records.forEach(r=>{
        const sid=r.scholarId||r.scholarName;
        if(!scholarMap[sid])scholarMap[sid]={name:r.scholarName,id:r.scholarId,records:[]};
        scholarMap[sid].records.push(r);
      });

      const validRecs=records.filter(r=>r.baseRelPlacement&&r.springRelPlacement&&PLACEMENT_ORDER.includes(r.baseRelPlacement)&&PLACEMENT_ORDER.includes(r.springRelPlacement));
      const n=validRecs.length;
      const moved=validRecs.filter(r=>plIdx(r.springRelPlacement)>plIdx(r.baseRelPlacement));
      const atGL=validRecs.filter(r=>isOnGL(r.springRelPlacement));
      const regress=validRecs.filter(r=>plIdx(r.springRelPlacement)<plIdx(r.baseRelPlacement));
      const gains=validRecs.map(r=>r.springGain).filter(v=>v!==null&&!isNaN(v));
      const multiRecs=records.filter(r=>r.tutors.length>1);

      const matchNote=records.length===0?`<div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:.875rem;margin-bottom:1rem;font-size:.8125rem;color:#991b1b">
        <strong>🔍 No exact match.</strong> Academic data may exist under a name variation (initials, abbreviations). Searched: "${esc(tutorName)}"</div>`:'';
      const multiNote=multiRecs.length?`<div style="background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:.75rem;font-size:.8125rem;color:#92400e;margin-bottom:1rem">
        <strong>⚠️ Attribution:</strong> ${multiRecs.length} records list multiple tutors. Outcomes are shared across all listed tutors — not attributable to one tutor alone.</div>`:'';

      const scholarRows=Object.values(scholarMap).slice(0,50).map(s=>{
        const vr=s.records.filter(r=>r.baseRelPlacement&&r.springRelPlacement&&PLACEMENT_ORDER.includes(r.baseRelPlacement)&&PLACEMENT_ORDER.includes(r.springRelPlacement));
        if(!vr.length) return '';
        const last=vr[vr.length-1];
        const mv=plIdx(last.springRelPlacement)-plIdx(last.baseRelPlacement);
        const mvStr=mv>0?`<span style="color:#0d6e3a">▲</span>`:mv<0?`<span style="color:#b91c1c">▼</span>`:`<span style="color:var(--muted)">→</span>`;
        return `<tr><td><button onclick="irlab.drillScholar('${esc(s.name||s.id)}')" style="background:none;border:none;cursor:pointer;color:var(--blue-mid);font-weight:600;font-size:.8125rem;text-align:left;padding:0">${esc(s.name||s.id)}</button></td>
          <td style="font-size:.75rem;color:var(--muted)">${esc(last.school)}</td><td style="font-size:.75rem">${esc(last.year)} ${esc(last.subject)}</td>
          <td style="font-size:.75rem;color:${PLC[last.springRelPlacement]||'var(--muted)'};font-weight:600">${esc(last.springRelPlacement||'—')}</td>
          <td style="text-align:center">${mvStr}</td></tr>`;
      }).join('');

      // ── TAP Apprentice context panel ────────────────────────────────────────
      const apEntry = _getApprEntry(tutorName);
      const apApp   = _getApprApp(tutorName);
      const otjMap  = window.njtcLiveOtjMap || {};
      const otjKey  = (apEntry && apEntry.name) ? apEntry.name.toLowerCase().replace(/\s+/g,' ').trim() : '';
      const otjItems= otjKey && otjMap.hasOwnProperty(otjKey) ? otjMap[otjKey] : (apApp ? apApp.otjItems : null);
      const OTJ_TOTAL = 17;
      const apPanel = (apEntry || apApp) ? (() => {
        const name     = (apEntry && apEntry.name) || (apApp && apApp.name) || tutorName;
        const njId     = (apEntry && apEntry.njId) || '—';
        const cohort   = (apEntry && apEntry.cohort) || '—';
        const school   = (apApp && apApp.school) || (apEntry && apEntry.placement) || '—';
        const sl       = (apApp && apApp.sl) || '—';
        const phase    = (apApp && (apApp.beg||apApp.mid||apApp.end)) ? [
          apApp.beg ? 'Beg: '+apApp.beg : null,
          apApp.mid ? 'Mid: '+apApp.mid : null,
          apApp.end ? 'End: '+apApp.end : null,
        ].filter(Boolean).join(' · ') : '—';
        const obsCount = (apApp && apApp.obsCount != null) ? apApp.obsCount : '—';
        const adp      = (apApp && apApp.adp) || '—';
        const pct      = otjItems !== null ? Math.min(Math.round(otjItems/OTJ_TOTAL*100), 100) : null;
        const ringClr  = pct === null ? '#d1d5db' : pct >= 100 ? '#059669' : pct >= 50 ? '#f59e0b' : '#3b82f6';
        const circ     = 175.93;
        const dashOff  = pct !== null ? (circ * (1 - pct/100)).toFixed(1) : circ.toFixed(1);
        return `<div style="background:#fffbeb;border:1.5px solid #fde68a;border-radius:10px;padding:1rem 1.1rem;margin-bottom:1rem">
          <div style="display:flex;align-items:center;gap:.5rem;margin-bottom:.65rem">
            <span style="background:#fef3c7;color:#92400e;padding:.15rem .45rem;border-radius:4px;font-size:.72rem;font-weight:700">🎓 TAP Apprentice</span>
            <span style="font-size:.75rem;color:#6b7280">SY 25-26 · ${cohort !== '—' ? 'Cohort: '+cohort : ''}</span>
            <span style="margin-left:auto;font-size:.72rem;font-weight:600;color:${adp.includes('Terminat')?'#991b1b':'#065f46'};background:${adp.includes('Terminat')?'#fee2e2':'#d1fae5'};padding:.1rem .35rem;border-radius:3px">${adp}</span>
          </div>
          <div style="display:grid;grid-template-columns:auto 1fr;gap:.75rem;align-items:center">
            <div style="position:relative;width:52px;height:52px">
              <svg viewBox="0 0 60 60" style="width:52px;height:52px;transform:rotate(-90deg)">
                <circle cx="30" cy="30" r="28" fill="none" stroke="#f3f4f6" stroke-width="6"/>
                <circle cx="30" cy="30" r="28" fill="none" stroke="${ringClr}" stroke-width="6"
                  stroke-dasharray="${circ}" stroke-dashoffset="${dashOff}" stroke-linecap="round"/>
              </svg>
              <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:.68rem;font-weight:700;color:${ringClr}">${pct !== null ? pct+'%' : '—'}</div>
            </div>
            <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:.3rem .75rem;font-size:.77rem">
              <div><span style="color:#9ca3af;font-size:.7rem">NJ DOL ID</span><br><strong style="font-family:monospace">${njId}</strong></div>
              <div><span style="color:#9ca3af;font-size:.7rem">OTJ Items</span><br><strong>${otjItems !== null ? otjItems+'/'+OTJ_TOTAL : '—'}</strong></div>
              <div><span style="color:#9ca3af;font-size:.7rem">Observations</span><br><strong>${obsCount}</strong></div>
              <div><span style="color:#9ca3af;font-size:.7rem">School</span><br><strong>${esc(school)}</strong></div>
              <div><span style="color:#9ca3af;font-size:.7rem">Site Leader</span><br><strong>${esc(sl)}</strong></div>
              <div><span style="color:#9ca3af;font-size:.7rem">OTJ Phases</span><br><span style="font-size:.7rem">${phase}</span></div>
            </div>
          </div>
        </div>`;
      })() : '';

      return `<div style="margin-bottom:1rem;display:flex;align-items:center;gap:.75rem;flex-wrap:wrap">
        <button class="btn btn-secondary" style="font-size:.8125rem" onclick="irlab.closeDrill()">← Back</button>
        <span class="irlab-window-badge">Tutor Profile</span>${apEntry||apApp?'<span style="background:#fef3c7;color:#92400e;padding:.15rem .45rem;border-radius:4px;font-size:.72rem;font-weight:700">🎓 AP Apprentice</span>':''}</div>
        ${apPanel}
        ${matchNote}${multiNote}
        <div class="irlab-card">
          <div class="irlab-card-hd"><div class="irlab-card-title">👩‍🏫 ${esc(tutorName)}</div></div>
          <div class="irlab-card-body">
            <div class="irlab-stats-grid" style="grid-template-columns:repeat(5,1fr);margin-bottom:1.25rem">
              <div class="irlab-stat" style="--irstat-color:#7b2d8b"><div class="irlab-stat-val">${Object.keys(scholarMap).length}</div><div class="irlab-stat-lbl">Scholars</div></div>
              <div class="irlab-stat" style="--irstat-color:#0d6e3a"><div class="irlab-stat-val">${n>0?pct(moved.length,n):0}%</div><div class="irlab-stat-lbl">Moved Up</div><div class="irlab-stat-sub">${moved.length} of ${n}</div></div>
              <div class="irlab-stat" style="--irstat-color:#0050c8"><div class="irlab-stat-val">${n>0?pct(atGL.length,n):0}%</div><div class="irlab-stat-lbl">At Grade Level</div></div>
              <div class="irlab-stat" style="--irstat-color:#b91c1c"><div class="irlab-stat-val">${n>0?pct(regress.length,n):0}%</div><div class="irlab-stat-lbl">Regressed</div></div>
              <div class="irlab-stat" style="--irstat-color:#d97706"><div class="irlab-stat-val">${gains.length?'+'+avg(gains).toFixed(1):'—'}</div><div class="irlab-stat-lbl">Avg Gain</div></div>
            </div>
            <div style="overflow-x:auto">
              <table class="irlab-rank-table">
                <thead><tr><th>Scholar</th><th>School</th><th>Year/Subject</th><th>Spring Placement</th><th style="text-align:center">Δ</th></tr></thead>
                <tbody>${scholarRows||'<tr><td colspan="5" style="text-align:center;color:var(--muted);padding:1.5rem">No valid pairs found</td></tr>'}</tbody>
              </table>
            </div>
          </div>
        </div>`;
    }

    // ── EQUITY SNAPSHOT ──────────────────────────────────────────────────────
    function renderEquitySnapshot(m) {
      if(!m||!m.demog) return '';
      const d=m.demog;
      return `<div class="irlab-card" style="margin-bottom:1rem">
        <div class="irlab-card-hd"><div class="irlab-card-title">⚖️ Equity & Subgroup Snapshot <span style="font-size:.7rem;font-weight:400;background:rgba(0,0,0,.06);border-radius:99px;padding:.1rem .45rem;cursor:help;margin-left:.25rem" title="Rows show placement-pair scholars grouped by demographic field from iReady CSV. 'Moved Up' = improved placement level. 'At GL' = on or above grade level at spring. 'Avg Gain' = average scale score gain. Groups with fewer than 10 valid pairs are hidden.">ⓘ How to read</span></div><div class="irlab-card-meta">Movement & GL attainment by demographic group</div></div>
        <div class="irlab-card-body" style="padding:.75rem">
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:.75rem 1.25rem;align-items:start">
            ${subgroupTable(d.byRace,'By Race/Ethnicity')}
            ${subgroupTable(d.byHisp,'Hispanic/Latino Status')}
            ${subgroupTable(d.byELL,'ELL Status')}
            ${subgroupTable(d.bySped,'Special Education')}
            ${subgroupTable(d.byEcoDis,'Economic Status')}
            ${subgroupTable(d.bySex,'By Gender')}
          </div>
        </div></div>`;
    }

    // ── TUTOR LEADERBOARD ────────────────────────────────────────────────────
    // ── TAP APPRENTICE HELPERS ────────────────────────────────────────────────
    // Build normalized name set from window.AP_TAP_ROSTER (populated by executive-leadership.js)
    function _apprNameSet() {
      if (!window.AP_TAP_ROSTER || !window.AP_TAP_ROSTER.length) return new Set();
      return new Set(window.AP_TAP_ROSTER.map(r => (r.name||'').trim().toLowerCase().replace(/\s+/g,' ')));
    }
    function _isApprTutor(name) {
      if (!name) return false;
      const n = name.trim().toLowerCase().replace(/\s+/g,' ');
      const s = _apprNameSet();
      if (s.has(n)) return true;
      // First+last fallback
      const parts = n.split(' ').filter(p => p.length > 1);
      if (parts.length < 2) return false;
      const fl = parts[0] + ' ' + parts[parts.length-1];
      for (const k of s) {
        const kp = k.split(' ').filter(p => p.length > 1);
        if (kp.length >= 2 && kp[0] + ' ' + kp[kp.length-1] === fl) return true;
      }
      return false;
    }
    function _getApprEntry(name) {
      if (!name || !window.AP_TAP_ROSTER || !window.AP_TAP_ROSTER.length) return null;
      const n = name.trim().toLowerCase().replace(/\s+/g,' ');
      const fl = n => { const p = n.split(' ').filter(w=>w.length>1); return p.length>=2?p[0]+' '+p[p.length-1]:n; };
      return window.AP_TAP_ROSTER.find(r => {
        const rn = (r.name||'').trim().toLowerCase().replace(/\s+/g,' ');
        return rn===n || fl(rn)===fl(n);
      }) || null;
    }
    function _getApprApp(name) {
      if (!name || !window._apprApps || !window._apprApps.length) return null;
      const n = name.trim().toLowerCase().replace(/\s+/g,' ');
      return window._apprApps.find(a => (a.name||'').trim().toLowerCase().replace(/\s+/g,' ') === n) || null;
    }

    function renderTutorLeaderboard(m, dept) {
      if(dept==='data') return '';
      const tutors=Object.values(m.tutorMap).filter(t=>t.total>=5).sort((a,b)=>b.pctMoved-a.pctMoved);
      if(!tutors.length) return '';
      const rows=tutors.slice(0,20).map((t,i)=>{
        const medal=i===0?'🥇':i===1?'🥈':i===2?'🥉':String(i+1)+'.';
        const col=t.pctMoved>=60?'#0d6e3a':t.pctMoved>=40?'#d97706':'#b91c1c';
        const apBadge=_isApprTutor(t.name)?'<span title="TAP Apprentice (SY 25-26)" style="margin-left:.35rem;font-size:.65rem;background:#fef3c7;color:#92400e;padding:.05rem .3rem;border-radius:3px;font-weight:700;vertical-align:middle">🎓 AP</span>':'';
        return `<tr><td><span style="margin-right:.375rem">${medal}</span>
          <button onclick="irlab.drillTutor('${esc(t.name)}')" style="background:none;border:none;cursor:pointer;color:var(--blue-mid);font-weight:600;font-size:.8125rem;text-align:left;padding:0">${esc(t.name)}</button>${apBadge}</td>
          <td style="min-width:160px">${renderBar(t.pctMoved,col)}</td>
          <td style="text-align:center"><span style="background:${t.pctGL>=50?'#dcfce7':'#fef3c7'};color:${t.pctGL>=50?'#166534':'#92400e'};padding:.15rem .5rem;border-radius:12px;font-size:.7rem;font-weight:700">${t.pctGL}%</span></td>
          <td style="text-align:center;font-size:.8125rem;font-weight:600;color:var(--blue-mid)">${t.avgGain!==null?'+'+t.avgGain.toFixed(1):'—'}</td>
          <td style="text-align:center;font-size:.75rem">${t.held}= · <span style="color:#b91c1c">${t.regressed}↓</span></td>
          <td style="text-align:right;font-size:.75rem;color:var(--muted)">${t.scholarCount}</td></tr>`;
      }).join('');
      const apCount = Object.values(m.tutorMap).filter(t=>t.total>=5&&_isApprTutor(t.name)).length;
      return `<div class="irlab-card" style="margin-bottom:1.25rem">
        <div class="irlab-card-hd"><div class="irlab-card-title">👩‍🏫 Tutor Impact Leaderboard</div><div class="irlab-card-meta">Min 5 scholars · Click name for profile${apCount?' · <span style="color:#92400e">🎓 '+apCount+' apprentice'+(apCount!==1?'s':'')+' in set</span>':''}</div></div>
        <div class="irlab-card-body" style="overflow-x:auto">
          <table class="irlab-rank-table">
            <thead><tr><th>Tutor</th><th>% Moved Up</th><th style="text-align:center">% At GL</th><th style="text-align:center">Avg Gain</th><th style="text-align:center">Held/Regressed</th><th style="text-align:right">Scholars</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div></div>`;
    }

    // ── DEPT INSIGHT BLOCKS ──────────────────────────────────────────────────
    function renderDeptInsights(m, dept) {
      if(!m) return '';
      const insights = {
        leadership:[
          {c:m.pctMoved>=60?'#0d6e3a':'#d97706',i:m.pctMoved>=60?'📈':'🔍',t:`${m.pctMoved}% of assessed scholars moved up`,b:`${m.moved.length.toLocaleString()} of ${m.n.toLocaleString()} scholars improved i-Ready placement. Grade-level attainment: ${m.pctOnGL}% by spring.`},
          {c:'#7b2d8b',i:'📍',t:'Standout & focus districts',b:(()=>{const s=Object.entries(m.byDistrict).map(([d,r])=>{const dm=computeMetrics(r);return dm?{name:d,...dm}:null}).filter(Boolean).sort((a,b)=>b.pctMoved-a.pctMoved);return s.length?`${esc(s[0].name)} leads (${s[0].pctMoved}% moved up)${s.length>1?' · '+esc(s[s.length-1].name)+' ('+s[s.length-1].pctMoved+'%) needs attention':''}`:''})()},
          {c:m.below2Chg<=0?'#0d6e3a':'#b91c1c',i:'⚖️',t:`Deep gap tier: ${m.pct2Below}% still 2+ levels below (spring)`,b:`${Math.abs(m.below2Chg)} scholars ${m.below2Chg<=0?'moved out of':'moved into'} the deepest gap tier. Key equity outcome for board and funder reporting.`},
        ],
        programming:[
          {c:'#0050c8',i:'🏫',t:`Site quality: ${m.pctMoved}% movement · ${m.regress.length} regressions`,b:`${m.moved.length} scholars improved. Sites with high regression rates warrant implementation review — session frequency, pacing, tutor-scholar match.`},
          {c:'#7b2d8b',i:'📐',t:(()=>{const g=Object.entries(m.byGrade).map(([gr,r])=>{const dm=computeMetrics(r);return dm?{grade:gr,pct:dm.pctMoved,n:dm.n}:null}).filter(Boolean).sort((a,b)=>a.pct-b.pct)[0];return g?`Grade ${g.grade}: lowest movement (${g.pct}% of ${g.n} scholars)`:'Grade differentiation signal'})(),b:'Consider whether lesson plan rigor and tutor strategy match grade-level expectations for underperforming grades.'},
          {c:m.metTypPct>=70?'#0d6e3a':'#d97706',i:'⭐',t:`${m.metTypPct!==null?m.metTypPct+'%':'N/A'} met typical growth target`,b:m.metTypPct!==null?`${m.metTyp.length} scholars met i-Ready typical growth. Scholars below typical growth should be prioritized for increased session frequency.`:'Typical growth data not fully available.'},
        ],
        data:[
          {c:'#7b2d8b',i:'🔬',t:`${m.n} valid baseline-spring pairs · ${m.valid.filter(r=>r.isRepeat).length} repeat scholars`,b:'Valid pair rate reflects diagnostic window coverage. Missing pairs reduce confidence in site-level comparisons.'},
          {c:'#0050c8',i:'📋',t:'Certification field completeness',b:`"Unidentified" certification: ${(m.byCert['Unidentified']||[]).length} records. May reflect onboarding delays or data entry gaps.`},
          {c:m.valid.filter(r=>r.baseRushFlag==='1'||r.springRushFlag==='1').length>0?'#d97706':'#0d6e3a',i:'⏱️',t:`Rush flag check: ${m.valid.filter(r=>r.baseRushFlag==='1'||r.springRushFlag==='1').length} flagged diagnostics`,b:'Rushed assessments may underrepresent ability. Flag when reporting to funders requiring assessment fidelity certification.'},
          {c:'#0d9488',i:'🔁',t:'Repeat scholar cohort — strongest longitudinal signal',b:'Use repeat-scholar cohort to anchor multi-year impact claims and control for regression-to-mean.'},
        ],
        hr:[
          {c:'#0d6e3a',i:'👥',t:(()=>{const c=m.byCert['Certified'];const dm=c?computeMetrics(c):null;return `Certified cohort: ${dm?dm.pctMoved+'% moved up':'insufficient data'}`})(),b:'Certified tutor records provide a comparison baseline. Use placement movement rate as a directional signal alongside observation data.'},
          {c:'#e63946',i:'🔍',t:`${(m.byCert['Unidentified']||[]).length} records with unidentified certification`,b:'May reflect onboarding gaps, substitute tutors, or data entry issues.'},
          {c:'#d97706',i:'📊',t:'Staffing continuity & academic outcomes',b:'High-movement tutors may reflect stronger relationship continuity. Consider multi-year tutor-scholar pairings as a retention argument.'},
        ],
        finance:[
          {c:'#2a9d8f',i:'💡',t:`Program ROI: ${m.pctMoved}% of scholars improved placement`,b:`${m.moved.length.toLocaleString()} scholars received measurable academic benefit — core metric for cost-per-outcome calculations.`},
          {c:'#0d6e3a',i:'🏅',t:`Grade-level attainment: ${m.pctOnGL}% (${m.sprOnGL.length.toLocaleString()} scholars)`,b:'This should be the headline number in budget and impact discussions.'},
          {c:'#0050c8',i:'📍',t:'Site-level resource allocation signal',b:'High-performing sites justify investment continuity; lower-performing sites warrant cost-effectiveness review.'},
        ],
        training_development:[
          // Framed around "where/what should T&D coaches support" — district-first, instruction-second
          {c:'#0891b2',i:'🎯',t:`${m.metTypPct!==null?m.metTypPct+'%':'—'} of scholars met typical growth target`,b:`Scholars meeting typical growth indicate tutors are differentiating instruction effectively. Districts below 60% are priority coaching visits — bring targeted PD, not generic check-ins.`},
          {c:(()=>{const mD=m.byDistrict?Object.values(m.byDistrict).length:0;const low=Object.entries(m.byDistrict||{}).map(([,r])=>computeMetrics(r)).filter(Boolean).filter(d=>d.pctMoved<50).length;return low>0?'#d97706':'#0d6e3a';})(),i:'📍',t:(()=>{const dArr=Object.entries(m.byDistrict||{}).map(([n,r])=>{const dm=computeMetrics(r);return dm?{name:n,pct:dm.pctMoved}:null}).filter(Boolean).sort((a,b)=>a.pct-b.pct);return dArr.length?`${dArr[0].name}: lowest district movement (${dArr[0].pct}%)`:'District coaching signal — apply filters for breakdown';})(),b:'This district should receive the next T&D coaching visit. Bring subject-specific strategies and session observation tools tailored to their scholars\' gap profile.'},
          {c:'#d97706',i:'📐',t:(()=>{const g=Object.entries(m.byGrade||{}).map(([gr,r])=>{const dm=computeMetrics(r);return dm?{grade:gr,pct:dm.pctMoved,n:dm.n}:null}).filter(Boolean).sort((a,b)=>a.pct-b.pct)[0];return g?`Grade ${g.grade} needs coaching focus (${g.pct}% moved, ${g.n} scholars)`:'Grade-band signal: apply a year filter for detail';})(),b:'Grade-level performance gaps signal that tutors may need support with grade-appropriate pacing, scaffolding, and small-group strategies. Prioritize PD sessions for this grade band.'},
          {c:m.regress.length>0?'#dc2626':'#059669',i:'🔄',t:`${m.regress.length} scholar${m.regress.length!==1?'s':''} regressed — ${Math.round(m.regress.length/Math.max(m.n,1)*100)}% of assessed`,b:m.regress.length>0?'Regressions signal instructional misalignment — sessions may not be meeting scholars at their level. T&D should prioritize differentiation coaching at the sites with the highest regression counts.':'No regressions this period — strong instructional fidelity signal.'},
        ],
      };
      return (insights[dept]||insights.leadership).map(ins=>`
        <div class="irlab-insight" style="--ins-color:${ins.c}">
          <div class="irlab-insight-icon">${ins.i}</div>
          <div><div class="irlab-insight-title">${ins.t}</div><div class="irlab-insight-body">${ins.b}</div></div>
        </div>`).join('');
    }

    // ── LEADERSHIP EXECUTIVE VIEW ─────────────────────────────────────────────
    function renderLeadershipView(m) {
      if(!m) return '<div class="irlab-empty"><div class="irlab-empty-icon">📊</div><div class="irlab-empty-title">No data loaded</div></div>';
      const dists=Object.entries(m.byDistrict).map(([name,rows])=>{const dm=computeMetrics(rows);return dm?{name,...dm}:null}).filter(Boolean).sort((a,b)=>b.pctMoved-a.pctMoved);
      const stars=dists.slice(0,3).map(d=>`<div style="display:flex;align-items:center;gap:.625rem;padding:.5rem .875rem;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;margin-bottom:.375rem">
        <span>⭐</span><div><div style="font-weight:700;color:#166534;font-size:.875rem">${esc(d.name)}</div>
        <div style="font-size:.75rem;color:#166534">${d.pctMoved}% moved up · ${d.pctOnGL}% at GL · +${d.avgGain?.toFixed(1)||'—'} avg gain</div></div></div>`).join('');
      const watch=dists.slice(-2).reverse().map(d=>`<div style="display:flex;align-items:center;gap:.625rem;padding:.5rem .875rem;background:#fef2f2;border:1px solid #fecaca;border-radius:8px;margin-bottom:.375rem">
        <span>🔍</span><div><div style="font-weight:700;color:#991b1b;font-size:.875rem">${esc(d.name)}</div>
        <div style="font-size:.75rem;color:#991b1b">${d.pctMoved}% moved up · ${d.n} scholars</div></div></div>`).join('');
      return `
        <div style="background:linear-gradient(135deg,#0a1628 0%,#1a3a6b 100%);border-radius:var(--radius);padding:1.5rem 2rem;margin-bottom:1.25rem;color:#fff;position:relative;overflow:hidden">
          <div style="position:absolute;top:-20px;right:-20px;font-size:8rem;opacity:.05">🎓</div>
          <div style="font-size:.6875rem;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:rgba(255,255,255,.5);margin-bottom:.5rem">NJTC Academic Impact Summary</div>
          <div style="display:flex;gap:2.5rem;flex-wrap:wrap;margin-top:.5rem">
            ${[{v:`${m.pctMoved}%`,l:'Scholars moved up',c:'#f0a500'},{v:`${m.pctOnGL}%`,l:'At grade level (spring)',c:'#4ade80'},{v:m.avgGain!==null?'+'+m.avgGain.toFixed(1):'—',l:'Avg scale gain',c:'#60a5fa'},{v:m.n.toLocaleString(),l:'Scholars analyzed',c:'#fff'}].map(x=>`
            <div style="text-align:center"><div style="font-family:'DM Serif Display',Georgia,serif;font-size:2.25rem;font-weight:400;color:${x.c};line-height:1">${x.v}</div><div style="font-size:.75rem;color:rgba(255,255,255,.6)">${x.l}</div></div>`).join('')}
          </div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;margin-bottom:1.25rem">
          <div class="irlab-card"><div class="irlab-card-hd"><div class="irlab-card-title">⭐ Standout Districts</div></div><div class="irlab-card-body">${stars||'<p style="color:var(--muted)">Not enough data</p>'}</div></div>
          <div class="irlab-card"><div class="irlab-card-hd"><div class="irlab-card-title">🔍 Needs Attention</div></div><div class="irlab-card-body">${watch||'<p style="color:var(--muted)">Not enough data</p>'}</div></div>
        </div>
        ${renderEquitySnapshot(m)}
        <div class="irlab-card">
          <div class="irlab-card-hd"><div class="irlab-card-title">📋 Talking Points</div><div class="irlab-card-meta">Funder · Board · Partner use</div></div>
          <div class="irlab-card-body">
            ${[`${m.pctMoved}% of assessed scholars — ${m.moved.length.toLocaleString()} students — improved i-Ready placement from baseline to spring.`,`${m.pctOnGL}% reached Early On Grade Level or above (${m.sprOnGL.length.toLocaleString()} scholars).`,m.avgGain!==null?`Average scale score gain: +${m.avgGain.toFixed(1)} points across the portfolio.`:'',m.below2Chg<0?`${Math.abs(m.below2Chg)} scholars moved out of the 2+ grade levels below tier — a direct equity impact.`:'',dists.length?`${esc(dists[0].name)} led with ${dists[0].pctMoved}% of scholars moving up placement levels.`:''].filter(Boolean).map((pt,i)=>`
            <div style="display:flex;align-items:flex-start;gap:.75rem;padding:.625rem .875rem;background:${i%2===0?'var(--surface-2)':'var(--surface)'};border-radius:8px;border:1px solid var(--border-2);margin-bottom:.5rem">
              <div style="width:22px;height:22px;border-radius:50%;background:var(--navy);color:#fff;display:flex;align-items:center;justify-content:center;font-size:.6875rem;font-weight:700;flex-shrink:0">${i+1}</div>
              <div style="font-size:.875rem;line-height:1.5;color:var(--navy)">${pt}</div>
            </div>`).join('')}
          </div>
        </div>`;
    }

    // ── STANDARD VIEW (non-leadership depts) ─────────────────────────────────
    function renderStandardView(m) {
      const mathM = getRows({subject:'Math'}).length ? computeMetrics(getRows({subject:'Math'})) : null;
      const elaM  = getRows({subject:'ELA'}).length  ? computeMetrics(getRows({subject:'ELA'}))  : null;
      return `
        <div class="irlab-stats-grid" style="margin-bottom:1.25rem">
          <div class="irlab-stat" style="--irstat-color:#0d6e3a"><div class="irlab-stat-val">${m.pctMoved}%</div><div class="irlab-stat-lbl">Scholars Moved Up</div><div class="irlab-stat-sub">${m.moved.length.toLocaleString()} of ${m.n.toLocaleString()}</div></div>
          <div class="irlab-stat" style="--irstat-color:#0050c8"><div class="irlab-stat-val">${m.pctOnGL}%</div><div class="irlab-stat-lbl">At/Near Grade Level</div><div class="irlab-stat-sub">Spring · was ${pct(m.baseOnGL.length,m.n)}% at baseline</div></div>
          <div class="irlab-stat" style="--irstat-color:#b91c1c"><div class="irlab-stat-val">${m.pct2Below}%</div><div class="irlab-stat-lbl">Still 2+ Below</div></div>
          <div class="irlab-stat" style="--irstat-color:#d97706"><div class="irlab-stat-val">${m.avgGain!==null?'+'+m.avgGain.toFixed(1):'—'}</div><div class="irlab-stat-lbl">Avg Scale Gain</div></div>
          <div class="irlab-stat" style="--irstat-color:#7b2d8b"><div class="irlab-stat-val">${m.metTypPct!==null?m.metTypPct+'%':'—'}</div><div class="irlab-stat-lbl">Met Typical Growth</div></div>
        </div>
        <div class="irlab-card" style="margin-bottom:1.25rem">
          <div class="irlab-card-hd"><div class="irlab-card-title" style="color:${DEPT_CFG[_irlDept]?.color}">${DEPT_CFG[_irlDept]?.emoji} ${DEPT_CFG[_irlDept]?.label} Insight View</div></div>
          <div class="irlab-card-body">${renderDeptInsights(m,_irlDept)}</div>
        </div>
        ${mathM&&elaM?`<div class="irlab-card" style="margin-bottom:1.25rem">
          <div class="irlab-card-hd"><div class="irlab-card-title">📐 Math vs ELA</div></div>
          <div class="irlab-card-body"><div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem">
            ${[{label:'Math',sc:mathM,color:'#0050c8',icon:'➗'},{label:'ELA',sc:elaM,color:'#7b2d8b',icon:'📖'}].map(({label,sc,color,icon})=>`
            <div style="border:1.5px solid ${color}22;border-radius:10px;padding:1rem;background:${color}07">
              <div style="font-size:.9rem;margin-bottom:.5rem">${icon} <strong style="color:${color}">${label}</strong></div>
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:.5rem;font-size:.8125rem">
                <div><div style="font-family:'DM Serif Display',Georgia,serif;font-size:1.5rem;color:var(--navy)">${sc.pctMoved}%</div><div style="color:var(--muted)">Moved up</div></div>
                <div><div style="font-family:'DM Serif Display',Georgia,serif;font-size:1.5rem;color:var(--navy)">${sc.pctOnGL}%</div><div style="color:var(--muted)">At GL</div></div>
                <div><div style="font-weight:700;color:var(--blue-mid)">${sc.avgGain!==null?'+'+sc.avgGain.toFixed(1):'—'}</div><div style="color:var(--muted)">Avg gain</div></div>
                <div><div style="font-weight:700">${sc.n.toLocaleString()}</div><div style="color:var(--muted)">Scholars</div></div>
              </div>
            </div>`).join('')}
          </div></div></div>`:''}
        ${_irlDept!=='finance'?renderEquitySnapshot(m):''}
        <div class="irlab-card" style="margin-bottom:1.25rem">
          <div class="irlab-card-hd"><div class="irlab-card-title">📊 Placement Shift</div><div class="irlab-card-meta">Baseline → Spring</div></div>
          <div class="irlab-card-body" style="display:grid;grid-template-columns:1fr 1fr;gap:1.5rem;align-items:start">
            <div><div style="font-size:.6875rem;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--muted);margin-bottom:.625rem">Spring Distribution</div>
              ${PLACEMENT_ORDER.map(p=>{const pc=pct(m.springDist[p]||0,m.n);return `<div class="irlab-funnel-row"><div class="irlab-funnel-label" style="color:${PLC[p]}">${PLC_SHORT[p]}</div><div class="irlab-funnel-bar-wrap"><div class="irlab-funnel-bar" style="width:${pc}%;background:${PLC[p]}"></div></div><div class="irlab-funnel-pct" style="color:${PLC[p]}">${pc}%</div><div class="irlab-funnel-n">${m.springDist[p]||0}</div></div>`;}).join('')}
            </div>
            <div>${renderPlacementShift(m)}</div>
          </div>
        </div>
        <div class="irlab-card" style="margin-bottom:1.25rem">
          <div class="irlab-card-hd"><div class="irlab-card-title">🏆 District Rankings</div></div>
          <div class="irlab-card-body" style="overflow-x:auto">
            <table class="irlab-rank-table">
              <thead><tr><th>District</th><th>% Moved Up</th><th style="text-align:center">Spring GL%</th><th style="text-align:center">Avg Gain</th><th style="text-align:right">N</th></tr></thead>
              <tbody>${Object.entries(m.byDistrict).map(([name,rows])=>{const dm=computeMetrics(rows);return dm?{name,...dm}:null}).filter(Boolean).sort((a,b)=>b.pctMoved-a.pctMoved).map((d,i)=>{
                const medal=i===0?'🥇':i===1?'🥈':i===2?'🥉':`${i+1}.`;
                return `<tr><td><span style="margin-right:.375rem">${medal}</span><strong style="font-size:.8125rem">${esc(d.name)}</strong></td>
                  <td style="min-width:140px">${renderBar(d.pctMoved,d.pctMoved>=50?'#0d6e3a':'#d97706')}</td>
                  <td style="text-align:center"><span style="background:${d.pctOnGL>=50?'#dcfce7':'#fef3c7'};color:${d.pctOnGL>=50?'#166534':'#92400e'};padding:.15rem .5rem;border-radius:12px;font-size:.7rem;font-weight:700">${d.pctOnGL}% at GL</span></td>
                  <td style="text-align:center;font-weight:600;color:var(--blue-mid);font-size:.8125rem">${d.avgGain!==null?'+'+d.avgGain.toFixed(1):'—'}</td>
                  <td style="text-align:right;font-size:.75rem;color:var(--muted)">${d.n}</td></tr>`;
              }).join('')}</tbody>
            </table>
          </div>
        </div>
        <div class="irlab-card" style="margin-bottom:1.25rem">
          <div class="irlab-card-hd"><div class="irlab-card-title">📚 Grade-Level Trends</div></div>
          <div class="irlab-card-body" style="overflow-x:auto">
            <table class="irlab-rank-table">
              <thead><tr><th>Grade</th><th style="text-align:center">% Moved Up</th><th style="text-align:center">% At GL (Spring)</th><th style="text-align:center">Avg Gain</th><th style="text-align:right">N</th></tr></thead>
              <tbody>${Object.entries(m.byGrade).map(([gr,rows])=>{const dm=computeMetrics(rows);return dm?{grade:gr,...dm}:null}).filter(Boolean).sort((a,b)=>{const na=a.grade==='K'?0:parseInt(a.grade)||99,nb=b.grade==='K'?0:parseInt(b.grade)||99;return na-nb;}).map(({grade,pctMoved,pctOnGL,avgGain,n})=>{
                const mc=pctMoved>=60?'#0d6e3a':pctMoved>=40?'#d97706':'#b91c1c';
                return `<tr><td style="font-weight:700">Grade ${esc(grade)}</td><td style="text-align:center;font-weight:700;color:${mc}">${pctMoved}%</td><td style="text-align:center;font-weight:700;color:${pctOnGL>=50?'#0d6e3a':pctOnGL>=25?'#d97706':'#b91c1c'}">${pctOnGL}%</td><td style="text-align:center;font-weight:600;color:var(--blue-mid)">${avgGain!==null?'+'+avgGain.toFixed(1):'—'}</td><td style="text-align:right;font-size:.75rem;color:var(--muted)">${n}</td></tr>`;
              }).join('')}</tbody>
            </table>
          </div>
        </div>
        ${renderTutorLeaderboard(m,_irlDept)}
        ${_irlDept==='programming'?renderLeaderCohortView():''}
        <div class="irlab-card" style="margin-bottom:1.25rem">
          <div class="irlab-card-hd"><div class="irlab-card-title">👩‍🏫 Certification Cohort</div><div class="irlab-card-meta">Observational · Not causal</div></div>
          <div class="irlab-card-body">
            <div class="irlab-cohort-grid">
              ${Object.entries(m.byCert).map(([cert,rows])=>{const dm=computeMetrics(rows);if(!dm)return'';const cols={'Certified':'#0d6e3a','Non Certified':'#0050c8','Mixed Cert Status':'#7b2d8b','Unidentified':'#7d8fa1'};const col=cols[cert]||'#7d8fa1';return `<div class="irlab-cohort-card" style="--coh-color:${col}"><div class="irlab-cohort-name">${esc(cert)}</div><div class="irlab-cohort-val">${dm.pctMoved}%</div><div class="irlab-cohort-sub">Moved up</div><div style="font-size:.75rem;margin-top:.5rem;color:var(--text-2)"><div>GL: <strong>${dm.pctOnGL}%</strong></div><div>Avg gain: <strong>${dm.avgGain!==null?'+'+dm.avgGain.toFixed(1):'—'}</strong></div><div style="color:var(--muted)">N=${dm.n}</div></div></div>`;}).join('')}
            </div>
            <div style="margin-top:.875rem;padding:.75rem;background:#fffbeb;border:1px solid #fde68a;border-radius:8px;font-size:.75rem;color:#92400e">
              <strong>ℹ️ Observational:</strong> Differences may reflect site assignment, grade level, or student population — not certification alone.
            </div>
          </div>
        </div>
        ${renderRepeatSection()}`;
    }

    // ── TAP LEADER COHORT IMPACT VIEW ────────────────────────────────────────
    // Shows each site leader's apprentice cohort: academic outcomes + OTJ + ops
    function renderLeaderCohortView() {
      const apps = window._apprApps;
      if (!apps || !apps.length) return '';

      // Group apprentices by site leader
      const byLeader = {};
      apps.forEach(a => {
        const sl = (a.sl || 'Unassigned').trim();
        if (!byLeader[sl]) byLeader[sl] = [];
        byLeader[sl].push(a);
      });

      const leaders = Object.entries(byLeader).filter(([,arr]) => arr.length > 0)
        .sort(([a],[b]) => a.localeCompare(b));
      if (!leaders.length) return '';

      const allRows = [...IRLAB_DATA.math, ...IRLAB_DATA.ela, ...IRLAB_DATA.mathRepeat, ...IRLAB_DATA.elaRepeat];
      const OTJ_TOTAL = 17;
      const otjMap = window.njtcLiveOtjMap || {};

      const normN = s => (s||'').trim().toLowerCase().replace(/\s+/g,' ');
      const normFL = s => { const p = normN(s).split(' ').filter(w=>w.length>1); return p.length>=2?p[0]+' '+p[p.length-1]:normN(s); };

      function irlRowsForAppr(name) {
        const n = normN(name), fl = normFL(name);
        return allRows.filter(r => {
          if (!r.instructor) return false;
          return r.instructor.split(',').map(x=>normN(x.trim())).some(t =>
            t === n || normFL(t) === fl
          );
        });
      }

      const leaderCards = leaders.map(([leader, cohort]) => {
        // Aggregate academics for all apprentices in this cohort
        const cohortRows = cohort.flatMap(a => irlRowsForAppr(a.name));
        const validRows  = cohortRows.filter(r =>
          r.baseRelPlacement && r.springRelPlacement &&
          PLACEMENT_ORDER.includes(r.baseRelPlacement) &&
          PLACEMENT_ORDER.includes(r.springRelPlacement)
        );
        const n          = validRows.length;
        const moved      = validRows.filter(r => plIdx(r.springRelPlacement) > plIdx(r.baseRelPlacement));
        const atGL       = validRows.filter(r => isOnGL(r.springRelPlacement));
        const gains      = validRows.map(r => r.springGain).filter(v => v !== null && !isNaN(v));
        const avgGainVal = gains.length ? gains.reduce((s,v)=>s+v,0)/gains.length : null;
        const pctMovedVal= n > 0 ? Math.round(moved.length/n*100) : null;
        const pctGLVal   = n > 0 ? Math.round(atGL.length/n*100) : null;

        // Aggregate OTJ for cohort
        const otjTotals  = cohort.map(a => {
          const key = normN(a.name);
          return otjMap.hasOwnProperty(key) ? otjMap[key] : (a.otjItems !== null ? a.otjItems : null);
        }).filter(v => v !== null);
        const avgOtjPct  = otjTotals.length ?
          Math.round(otjTotals.reduce((s,v)=>s+v,0) / otjTotals.length / OTJ_TOTAL * 100) : null;
        const completedOtj = otjTotals.filter(v => v >= OTJ_TOTAL).length;

        // Aggregate obs
        const totalObs   = cohort.reduce((s,a) => s + (a.obsCount || 0), 0);
        const avgObs     = cohort.length ? (totalObs / cohort.length).toFixed(1) : '—';
        const withObs    = cohort.filter(a => a.obsCount > 0).length;

        // Site (first non-blank district in cohort)
        const site       = cohort.map(a => a.district||a.school||'').filter(Boolean)[0] || '—';

        const impactColor = pctMovedVal === null ? '#9ca3af' :
                            pctMovedVal >= 65 ? '#059669' :
                            pctMovedVal >= 45 ? '#f59e0b' : '#ef4444';
        const impactLabel = pctMovedVal === null ? 'No data yet' :
                            pctMovedVal >= 65 ? 'Strong Impact' :
                            pctMovedVal >= 45 ? 'Developing' : 'Needs Support';

        const apprRows = cohort.map(a => {
          const aOtjKey = normN(a.name);
          const aOtj    = otjMap.hasOwnProperty(aOtjKey) ? otjMap[aOtjKey] : (a.otjItems !== null ? a.otjItems : null);
          const aOtjPct = aOtj !== null ? Math.min(Math.round(aOtj/OTJ_TOTAL*100),100) : null;
          const aRows   = irlRowsForAppr(a.name).filter(r =>
            r.baseRelPlacement && r.springRelPlacement &&
            PLACEMENT_ORDER.includes(r.baseRelPlacement) &&
            PLACEMENT_ORDER.includes(r.springRelPlacement)
          );
          const aMoved  = aRows.filter(r => plIdx(r.springRelPlacement) > plIdx(r.baseRelPlacement));
          const aPctMov = aRows.length ? Math.round(aMoved.length/aRows.length*100) : null;
          const aGains  = aRows.map(r=>r.springGain).filter(v=>v!==null&&!isNaN(v));
          const aGain   = aGains.length ? (aGains.reduce((s,v)=>s+v,0)/aGains.length).toFixed(1) : null;
          const isInact = (a.adp||'').includes('Terminat');
          return `<tr style="${isInact?'opacity:.6':''}">
            <td style="font-size:.78rem;font-weight:600;color:#1B2A4A">
              ${esc(a.name)}${isInact?' <span style="font-size:.62rem;background:#fee2e2;color:#991b1b;padding:.05rem .25rem;border-radius:2px">Inactive</span>':''}
            </td>
            <td style="font-size:.75rem;color:#6b7280">${esc(a.school||a.district||'—')}</td>
            <td style="text-align:center">
              ${aOtjPct !== null ? `<div style="display:inline-flex;align-items:center;gap:.3rem">
                <div style="width:40px;height:5px;background:#f3f4f6;border-radius:3px;overflow:hidden">
                  <div style="width:${aOtjPct}%;height:100%;background:${aOtjPct>=100?'#059669':aOtjPct>=50?'#f59e0b':'#3b82f6'};border-radius:3px"></div>
                </div>
                <span style="font-size:.7rem;font-weight:700;color:${aOtjPct>=100?'#059669':aOtjPct>=50?'#f59e0b':'#3b82f6'}">${aOtjPct}%</span>
              </div>` : '<span style="color:#d1d5db;font-size:.72rem">—</span>'}
            </td>
            <td style="text-align:center;font-size:.75rem;font-weight:600;color:${a.obsCount>=3?'#059669':a.obsCount>=1?'#f59e0b':'#9ca3af'}">${a.obsCount||0}</td>
            <td style="text-align:center;font-size:.75rem;font-weight:600;color:${aPctMov===null?'#9ca3af':aPctMov>=65?'#059669':aPctMov>=40?'#f59e0b':'#ef4444'}">${aPctMov!==null?aPctMov+'%':'—'}</td>
            <td style="text-align:center;font-size:.75rem;color:var(--blue-mid);font-weight:600">${aGain!==null?'+'+aGain:'—'}</td>
            <td style="text-align:center;font-size:.75rem;color:#374151">${aRows.length||'—'}</td>
          </tr>`;
        }).join('');

        return `<div style="background:#fff;border:1px solid #e5e7eb;border-radius:10px;padding:1.1rem;margin-bottom:1rem">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:.85rem;flex-wrap:wrap;gap:.5rem">
            <div>
              <div style="font-weight:700;color:#1B2A4A;font-size:.92rem">${esc(leader)}</div>
              <div style="font-size:.75rem;color:#6b7280;margin-top:.15rem">${esc(site)} · ${cohort.length} apprentice${cohort.length!==1?'s':''}</div>
            </div>
            <span style="background:${impactColor}18;color:${impactColor};border:1px solid ${impactColor}44;padding:.2rem .6rem;border-radius:6px;font-size:.72rem;font-weight:700">${impactLabel}</span>
          </div>
          <!-- Cohort aggregate KPIs -->
          <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:.5rem;margin-bottom:.85rem">
            ${[
              [n>0?pctMovedVal+'%':'—','Scholars Moved Up',impactColor],
              [n>0?pctGLVal+'%':'—','At Grade Level (Spring)','#0050c8'],
              [avgGainVal!==null?'+'+avgGainVal.toFixed(1):'—','Avg Scale Gain','#7b2d8b'],
              [avgOtjPct!==null?avgOtjPct+'%':'—','Avg OTJ Complete','#f59e0b'],
              [totalObs,'Total Obs ('+avgObs+' avg)','#059669'],
            ].map(([val,lbl,clr])=>`<div style="background:#f9fafb;border-radius:7px;padding:.5rem;text-align:center">
              <div style="font-size:1.1rem;font-weight:700;color:${clr}">${val}</div>
              <div style="font-size:.65rem;color:#6b7280;margin-top:.1rem">${lbl}</div>
            </div>`).join('')}
          </div>
          <!-- Per-apprentice breakdown table -->
          <div style="overflow-x:auto">
            <table style="width:100%;border-collapse:collapse;font-size:.78rem">
              <thead><tr style="background:#f9fafb;font-size:.68rem;color:#9ca3af;text-transform:uppercase;letter-spacing:.04em">
                <th style="padding:.3rem .4rem;text-align:left">Apprentice</th>
                <th style="padding:.3rem .4rem;text-align:left">School</th>
                <th style="padding:.3rem .4rem;text-align:center">OTJ %</th>
                <th style="padding:.3rem .4rem;text-align:center">Obs</th>
                <th style="padding:.3rem .4rem;text-align:center">% Moved</th>
                <th style="padding:.3rem .4rem;text-align:center">Avg Gain</th>
                <th style="padding:.3rem .4rem;text-align:center">N</th>
              </tr></thead>
              <tbody>${apprRows}</tbody>
            </table>
          </div>
          ${completedOtj > 0 ? `<div style="margin-top:.6rem;font-size:.72rem;color:#065f46;background:#d1fae5;padding:.35rem .6rem;border-radius:5px;display:inline-block">✅ ${completedOtj}/${cohort.length} apprentice${completedOtj!==1?'s':''} completed all OTJ items</div>` : ''}
          ${withObs < cohort.length ? `<div style="margin-top:.4rem;font-size:.72rem;color:#92400e;background:#fef3c7;padding:.35rem .6rem;border-radius:5px;display:inline-block">⚠️ ${cohort.length-withObs} apprentice${cohort.length-withObs!==1?'s':''} with no recorded observation</div>` : ''}
        </div>`;
      }).join('');

      return `<div class="irlab-card" style="margin-bottom:1.25rem">
        <div class="irlab-card-hd">
          <div class="irlab-card-title">🧑‍🏫 Site Leader — TAP Cohort Performance</div>
          <div class="irlab-card-meta">SY 25-26 · ${apps.filter(a=>!a.adp||!a.adp.includes('Terminat')).length} active apprentices · OTJ + Observations + iReady outcomes</div>
        </div>
        <div class="irlab-card-body">${leaderCards}</div>
      </div>`;
    }

    // ── REPEAT SCHOLARS ───────────────────────────────────────────────────────
    function renderRepeatSection() {
      // Repeat status now comes primarily from the "Repeat Scholar" / "Repeat Scholar YOY"
      // column embedded directly in the main ELA/Math tabs — pool ALL sources (main +
      // any legacy dedicated repeat tabs) and filter by the authoritative repeat flag,
      // rather than relying solely on the (now largely unused) repeat-only tabs.
      const repRows=_getPooledRows().filter(r=>_isRepeatScholar(r)&&r.baseRelPlacement&&r.springRelPlacement&&PLACEMENT_ORDER.includes(r.baseRelPlacement)&&PLACEMENT_ORDER.includes(r.springRelPlacement));
      if(!repRows.length) return '';
      const m=computeMetrics(repRows); if(!m) return '';
      const allM=computeMetrics(getRows({}));
      const diff=allM?m.pctMoved-allM.pctMoved:null;
      return `<div class="irlab-card" style="border-left:4px solid #7b2d8b;margin-bottom:1.25rem">
        <div class="irlab-card-hd"><div class="irlab-card-title">🔁 Repeat Scholar YOY</div><div class="irlab-card-meta">Longitudinal · Strongest program signal</div></div>
        <div class="irlab-card-body">
          <div class="irlab-stats-grid" style="grid-template-columns:repeat(4,1fr);margin-bottom:1rem">
            <div class="irlab-stat" style="--irstat-color:#7b2d8b"><div class="irlab-stat-val">${m.n.toLocaleString()}</div><div class="irlab-stat-lbl">Repeat Scholars</div></div>
            <div class="irlab-stat" style="--irstat-color:#0d6e3a"><div class="irlab-stat-val">${m.pctMoved}%</div><div class="irlab-stat-lbl">Moved Up</div><div class="irlab-stat-sub">${diff!==null?`${diff>=0?'+':''}${diff}pp vs overall`:''}</div></div>
            <div class="irlab-stat" style="--irstat-color:#0050c8"><div class="irlab-stat-val">${m.pctOnGL}%</div><div class="irlab-stat-lbl">At GL (Spring)</div></div>
            <div class="irlab-stat" style="--irstat-color:#d97706"><div class="irlab-stat-val">${m.avgGain!==null?'+'+m.avgGain.toFixed(1):'—'}</div><div class="irlab-stat-lbl">Avg Scale Gain</div></div>
          </div>
          <div class="irlab-insight" style="--ins-color:#7b2d8b;margin-bottom:1rem">
            <div class="irlab-insight-icon">🔁</div>
            <div><div class="irlab-insight-title">Cleanest multi-year program signal</div>
            <div class="irlab-insight-body">Eliminates selection bias from mid-year entrants. ${m.pctMoved}% improved — ${diff!==null?Math.abs(diff)+'pp '+(diff>=0?'above':'below')+' overall':''}.  Anchor grant reports requiring longitudinal evidence to this cohort.</div></div>
          </div>
          ${renderPlacementShift(m)}
        </div>
      </div>`;
    }

    // ── CHART CLEANUP ─────────────────────────────────────────────────────────
    function _destroyCharts() {
      Object.values(_irlCharts).forEach(c => { try { c.destroy(); } catch(e) {} });
      _irlCharts = {};
    }

    // ── SECTION A: KPI CARDS ─────────────────────────────────────────────────
    function renderAnalyticsKPIs(allRowsELA, allRowsMath, rows) {
      // MEDIAN typical growth — all rows with pctTypical (not filtered to placement pairs)
      const elaTyp  = allRowsELA.map(r=>r.pctTypical).filter(v=>v!==null&&!isNaN(v));
      const mathTyp = allRowsMath.map(r=>r.pctTypical).filter(v=>v!==null&&!isNaN(v));
      const elaMed  = medianArr(elaTyp);
      const mathMed = medianArr(mathTyp);
      // % meeting typical growth (pct >= 1.0)
      const elaMet  = elaTyp.length  ? pct(elaTyp.filter(v=>v>=1.0).length,  elaTyp.length)  : null;
      const mathMet = mathTyp.length ? pct(mathTyp.filter(v=>v>=1.0).length, mathTyp.length) : null;
      // Avg scale gain — use placement-pair rows
      const elaGains  = rows.filter(r=>r.subject==='ELA' ).map(r=>r.springGain).filter(v=>v!==null&&!isNaN(v));
      const mathGains = rows.filter(r=>r.subject==='Math').map(r=>r.springGain).filter(v=>v!==null&&!isNaN(v));
      const elaAvgG   = elaGains.length  ? avg(elaGains)  : null;
      const mathAvgG  = mathGains.length ? avg(mathGains) : null;
      // Total unique scholars
      const uids = new Set(rows.map(r=>r.scholarId||r.scholarName).filter(Boolean));
      const kpis = [
        {
          val: uids.size.toLocaleString(),
          lbl: 'Total Scholars Served',
          sub: `${rows.length} valid diagnostic pairs`,
          color: '#7b2d8b', icon: '👥',
        },
        {
          val: elaMed !== null ? (elaMed*100).toFixed(1)+'%' : '—',
          lbl: 'Median Typical Growth (ELA)',
          sub: elaMed !== null ? `${elaTyp.length} scholars w/ growth data` : 'No ELA growth data',
          color: elaMed !== null && elaMed >= 1.0 ? '#0d6e3a' : '#d97706', icon: '📖',
          tip: 'Median of spring_pct_progress_typical_growth (iReady pre-computed col) across all ELA rows with a valid value. 100% = met exactly typical growth; >100% = exceeded typical growth norms. The MEDIAN (not average) is used to be robust to outliers.',
        },
        {
          val: mathMed !== null ? (mathMed*100).toFixed(1)+'%' : '—',
          lbl: 'Median Typical Growth (Math)',
          sub: mathMed !== null ? `${mathTyp.length} scholars w/ growth data` : 'No Math growth data',
          color: mathMed !== null && mathMed >= 1.0 ? '#0d6e3a' : '#d97706', icon: '➗',
          tip: 'Median of spring_pct_progress_typical_growth (iReady pre-computed col) across all Math rows with a valid value. 100% = met exactly typical growth norms.',
        },
        {
          val: elaMet !== null ? elaMet+'%' : '—',
          lbl: '% Meeting Typical Growth (ELA)',
          sub: `Scholars with ≥100% typical growth`,
          color: elaMet !== null && elaMet >= 50 ? '#0d6e3a' : '#b91c1c', icon: '🎯',
        },
        {
          val: mathMet !== null ? mathMet+'%' : '—',
          lbl: '% Meeting Typical Growth (Math)',
          sub: `Scholars with ≥100% typical growth`,
          color: mathMet !== null && mathMet >= 50 ? '#0d6e3a' : '#b91c1c', icon: '🎯',
        },
        {
          val: elaAvgG !== null ? (elaAvgG>=0?'+':'')+elaAvgG.toFixed(1) : '—',
          lbl: 'Avg Scale Score Gain (ELA)',
          sub: elaGains.length ? `${elaGains.length} scholars` : 'No ELA gain data',
          color: '#0050c8', icon: '📈',
        },
        {
          val: mathAvgG !== null ? (mathAvgG>=0?'+':'')+mathAvgG.toFixed(1) : '—',
          lbl: 'Avg Scale Score Gain (Math)',
          sub: mathGains.length ? `${mathGains.length} scholars` : 'No Math gain data',
          color: '#0050c8', icon: '📐',
        },
      ];
      return `<div class="irlab-stats-grid" style="grid-template-columns:repeat(auto-fill,minmax(180px,1fr));margin-bottom:1.5rem">
        ${kpis.map(k=>`<div class="irlab-stat" style="--irstat-color:${k.color}"${k.tip?` title="${k.tip.replace(/"/g,"'")}"`:''}">
          <div style="font-size:1.5rem;margin-bottom:.25rem">${k.icon}</div>
          <div class="irlab-stat-val">${esc(k.val)}</div>
          <div class="irlab-stat-lbl">${esc(k.lbl)}${k.tip?` <span style="font-size:.55rem;background:rgba(0,0,0,.08);border-radius:99px;padding:.05rem .25rem;cursor:help" title="${k.tip.replace(/"/g,"'")}">ⓘ</span>`:''}
          </div>
          <div class="irlab-stat-sub">${esc(k.sub)}</div>
        </div>`).join('')}
      </div>`;
    }

    // ── SECTION B: GROWTH DISTRIBUTION CHART ─────────────────────────────────
    function renderGrowthDistChart(rows) {
      if (_irlPilot === 'pilot') {
        const gainRows = (rows||[]).filter(r => r.springGain !== null && !isNaN(r.springGain));
        const bins = [
          {l:'< 0 pts',  min:-Infinity, max:0,        col:'#ef4444'},
          {l:'1 – 10',   min:0,         max:10,       col:'#fb923c'},
          {l:'11 – 20',  min:10,        max:20,       col:'#fbbf24'},
          {l:'21 – 30',  min:20,        max:30,       col:'#4ade80'},
          {l:'31 – 40',  min:30,        max:40,       col:'#22c55e'},
          {l:'41 – 50',  min:40,        max:50,       col:'#16a34a'},
          {l:'> 50 pts', min:50,        max:Infinity, col:'#15803d'},
        ];
        const maxN = Math.max(1, ...bins.map(b => gainRows.filter(r=>r.springGain>=b.min&&r.springGain<b.max).length));
        return `<div class="irlab-card" style="margin:0">
          <div class="irlab-card-hd">
            <div class="irlab-card-title">📊 Scale Gain Distribution</div>
            <div class="irlab-card-meta">Spring − Winter scale score · ${gainRows.length} scholars</div>
          </div>
          <div class="irlab-card-body" style="padding:.875rem">
            ${bins.map(b=>{
              const n = gainRows.filter(r=>r.springGain>=b.min&&r.springGain<b.max).length;
              const w = Math.round(n/maxN*100);
              return `<div style="display:flex;align-items:center;gap:.5rem;margin-bottom:.35rem">
                <div style="font-size:.68rem;color:var(--text);min-width:54px;text-align:right;font-weight:500">${b.l}</div>
                <div style="flex:1;background:#f1f5f9;border-radius:4px;height:14px;overflow:hidden">
                  <div style="height:100%;width:${w}%;background:${b.col};border-radius:4px;min-width:${n>0?'4':'0'}px;transition:width .4s"></div>
                </div>
                <div style="font-size:.7rem;font-weight:700;color:${b.col};min-width:20px;text-align:right">${n}</div>
              </div>`;
            }).join('')}
            <div style="font-size:.6rem;color:var(--muted);margin-top:.5rem;border-top:1px solid var(--border);padding-top:.4rem">
              Scale gain = Spring Overall Scale Score − Winter Overall Scale Score.
              iReady does not assign annual growth targets for first-year diagnostic programs.
            </div>
          </div>
        </div>`;
      }
      return `<div class="irlab-card" style="margin:0">
        <div class="irlab-card-hd">
          <div class="irlab-card-title">📊 Growth Distribution</div>
          <div class="irlab-card-meta">% of Typical Growth · all spring diagnostics</div>
        </div>
        <div class="irlab-card-body">
          <canvas id="irlGrowthDistChart" height="220" style="max-height:220px"></canvas>
        </div>
      </div>`;
    }

    function _initGrowthDistChart(allRowsELA, allRowsMath) {
      const canvas = document.getElementById('irlGrowthDistChart');
      if (!canvas || typeof Chart === 'undefined') return;
      const bins = [
        { label: '< 0%',      min: -Infinity, max: 0 },
        { label: '0–25%',     min: 0,         max: 0.25 },
        { label: '26–50%',    min: 0.25,      max: 0.50 },
        { label: '51–75%',    min: 0.50,      max: 0.75 },
        { label: '76–99%',    min: 0.75,      max: 1.0 },
        { label: '100–149%',  min: 1.0,       max: 1.50 },
        { label: '150–199%',  min: 1.50,      max: 2.0 },
        { label: '200%+',     min: 2.0,       max: Infinity },
      ];
      const binRows = (rows) => bins.map(b => rows.filter(r => r.pctTypical !== null && !isNaN(r.pctTypical) && r.pctTypical >= b.min && r.pctTypical < b.max).length);
      const elaCounts  = binRows(allRowsELA);
      const mathCounts = binRows(allRowsMath);
      _irlCharts['growthDist'] = new Chart(canvas, {
        type: 'bar',
        data: {
          labels: bins.map(b=>b.label),
          datasets: [
            { label: 'ELA',  data: elaCounts,  backgroundColor: 'rgba(123,45,139,0.75)', borderColor: '#7b2d8b', borderWidth: 1 },
            { label: 'Math', data: mathCounts, backgroundColor: 'rgba(0,80,200,0.65)',   borderColor: '#0050c8', borderWidth: 1 },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { position: 'top' }, tooltip: { callbacks: { label: ctx => `${ctx.dataset.label}: ${ctx.raw} scholars` } } },
          scales: {
            x: { grid: { display: false } },
            y: { beginAtZero: true, ticks: { stepSize: 1 }, title: { display: true, text: 'Number of Scholars' } },
          },
        },
      });
    }

    // ── SECTION C: PLACEMENT DISTRIBUTION BOY vs EOY ─────────────────────────
    function renderPlacementDistChart() {
      return `<div class="irlab-card" style="margin:0">
        <div class="irlab-card-hd">
          <div class="irlab-card-title">📍 Placement: BOY vs Spring</div>
          <div class="irlab-card-meta">Relative placement · valid diagnostic pairs</div>
        </div>
        <div class="irlab-card-body">
          <canvas id="irlPlacementChart" height="220" style="max-height:220px"></canvas>
        </div>
      </div>`;
    }

    function _initPlacementDistChart(rows) {
      const canvas = document.getElementById('irlPlacementChart');
      if (!canvas || typeof Chart === 'undefined') return;
      const labels   = PLACEMENT_ORDER.map(p => PLC_SHORT[p]);
      const baseData = PLACEMENT_ORDER.map(p => rows.filter(r=>r.baseRelPlacement===p).length);
      const sprData  = PLACEMENT_ORDER.map(p => rows.filter(r=>r.springRelPlacement===p).length);
      const colors   = PLACEMENT_ORDER.map(p => PLC[p]);
      _irlCharts['placement'] = new Chart(canvas, {
        type: 'bar',
        data: {
          labels,
          datasets: [
            { label: 'BOY (Baseline)',  data: baseData, backgroundColor: colors.map(c=>c+'99'), borderColor: colors, borderWidth: 2 },
            { label: 'Spring (EOY)',    data: sprData,  backgroundColor: colors, borderColor: colors, borderWidth: 2 },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { position: 'top' }, tooltip: { callbacks: { label: ctx => `${ctx.dataset.label}: ${ctx.raw} scholars` } } },
          scales: {
            x: { grid: { display: false } },
            y: { beginAtZero: true, title: { display: true, text: 'Number of Scholars' } },
          },
        },
      });
    }

    // ── SECTION D: SCHOOL-LEVEL BREAKDOWN TABLE ───────────────────────────────
    function renderSchoolBreakdown(rows, allRowsForTypical) {
      // Build school-level map
      const schoolMap = {};
      // From placement-pair rows
      rows.forEach(r => {
        const key = r.school || 'Unknown';
        if (!schoolMap[key]) schoolMap[key] = { school: key, district: r.district||'', year: r.year||'', subjects: new Set(), rows: [], typRows: [] };
        schoolMap[key].rows.push(r);
        schoolMap[key].subjects.add(r.subject);
      });
      // Add typical growth rows (all rows not just placement pairs)
      allRowsForTypical.forEach(r => {
        const key = r.school || 'Unknown';
        if (schoolMap[key] && r.pctTypical !== null && !isNaN(r.pctTypical)) {
          schoolMap[key].typRows.push(r.pctTypical);
        }
      });
      const schools = Object.values(schoolMap).filter(s=>s.rows.length>=2).map(s=>{
        const sm = computeMetrics(s.rows);
        const medTyp = medianArr(s.typRows);
        return {
          school: s.school,
          district: s.district,
          subjects: [...s.subjects].join(', '),
          n: s.rows.length,
          medianTyp: medTyp,
          metTypPct: sm ? sm.metTypPct : null,
          avgGain: sm ? sm.avgGain : null,
          pctMoved: sm ? sm.pctMoved : null,
        };
      }).sort((a,b)=> {
        const am = a.medianTyp !== null ? a.medianTyp : -Infinity;
        const bm = b.medianTyp !== null ? b.medianTyp : -Infinity;
        return bm - am;
      });
      if (!schools.length) return '';
      const rows_html = schools.map(s=>{
        const medC = s.medianTyp !== null && s.medianTyp >= 1.0 ? '#0d6e3a' : s.medianTyp !== null ? '#b91c1c' : 'var(--muted)';
        const metC = s.metTypPct !== null && s.metTypPct >= 50  ? '#0d6e3a' : s.metTypPct !== null ? '#b91c1c' : 'var(--muted)';
        return `<tr>
          <td style="font-weight:600;color:var(--navy)">${esc(s.school)}</td>
          <td style="font-size:.8rem;color:var(--muted)">${esc(s.district)}</td>
          <td style="font-size:.75rem">${esc(s.subjects)}</td>
          <td style="text-align:center">${s.n}</td>
          <td style="text-align:center;font-weight:700;color:${medC}">${s.medianTyp !== null ? (s.medianTyp*100).toFixed(1)+'%' : '—'}</td>
          <td style="text-align:center;font-weight:700;color:${metC}">${s.metTypPct !== null ? s.metTypPct+'%' : '—'}</td>
          <td style="text-align:center;color:var(--blue-mid);font-weight:600">${s.avgGain !== null ? (s.avgGain>=0?'+':'')+s.avgGain.toFixed(1) : '—'}</td>
        </tr>`;
      }).join('');
      return `<div class="irlab-card" style="margin-bottom:1.25rem">
        <div class="irlab-card-hd">
          <div class="irlab-card-title">🏫 School-Level Breakdown</div>
          <div class="irlab-card-meta">Sorted by Median Typical Growth % · min 2 scholars</div>
        </div>
        <div class="irlab-card-body" style="overflow-x:auto">
          <table class="irlab-rank-table">
            <thead><tr>
              <th>School</th>
              <th>District</th>
              <th>Subject(s)</th>
              <th style="text-align:center">N</th>
              <th style="text-align:center">Median Typical Growth %</th>
              <th style="text-align:center">% Meeting Typical</th>
              <th style="text-align:center">Avg Gain</th>
            </tr></thead>
            <tbody>${rows_html}</tbody>
          </table>
        </div>
      </div>`;
    }

    // ── SECTION E: REPEAT SCHOLAR LONGITUDINAL ────────────────────────────────
    // Repeat scholars = same Student ID (fallback: name) across 2+ academic years.
    // This view always shows ALL years regardless of the year filter (longitudinal
    // analysis requires the full trajectory), but respects the subject filter.
    function renderRepeatLongitudinal() {
      const idx = _getRepeatIndex();
      const subjectFilter = _irlSubject === 'all' ? null : _irlSubject;

      if (!idx.repeatScholars.length) {
        const pooled = _getPooledRows();
        const yearCount = new Set(pooled.map(r=>r.year).filter(Boolean)).size;
        return `<div class="irlab-card" style="border-left:4px solid #7b2d8b;margin-bottom:1.25rem">
          <div class="irlab-card-hd"><div class="irlab-card-title">🔁 Repeat Scholar Longitudinal Analysis</div></div>
          <div class="irlab-card-body"><div class="irlab-empty">
            <div class="irlab-empty-icon">🔁</div>
            <div class="irlab-empty-title">No repeat scholars found</div>
            <div class="irlab-empty-sub">${yearCount < 2
              ? 'Load data from at least 2 academic years to identify year-over-year repeat scholars.'
              : 'No scholars matched by Student ID (or name) across multiple years in the loaded data.'
            }</div>
          </div></div>
        </div>`;
      }

      // Build per-scholar cycle data, filtered by subject if active
      const scholars = idx.repeatScholars.map(s => {
        let recs = s.records;
        if (subjectFilter) recs = recs.filter(r => r.subject === subjectFilter);
        // Group by year+subject → keep one representative row (valid placement pair preferred)
        const byYS = {};
        recs.forEach(r => {
          const k = (r.year||'') + '|' + (r.subject||'');
          if (!byYS[k] || (r.baseRelPlacement && !byYS[k].baseRelPlacement)) byYS[k] = r;
        });
        const cycles = Object.values(byYS).filter(r=>r.year&&r.baseRelPlacement).sort((a,b)=>a.year>b.year?1:-1);
        const uniqueYrs = [...new Set(cycles.map(r=>r.year))].sort();
        if (uniqueYrs.length < 2) return null; // not truly multi-year for this subject
        return { id: s.id, name: s.name, usedId: s.usedId, cycles, uniqueYrs, numYears: uniqueYrs.length };
      }).filter(Boolean);

      if (!scholars.length) {
        return `<div class="irlab-card" style="border-left:4px solid #7b2d8b;margin-bottom:1.25rem">
          <div class="irlab-card-hd"><div class="irlab-card-title">🔁 Repeat Scholar Longitudinal Analysis</div></div>
          <div class="irlab-card-body"><div class="irlab-empty">
            <div class="irlab-empty-icon">🔁</div>
            <div class="irlab-empty-title">No repeat scholars for ${esc(subjectFilter||'selected')} subject</div>
            <div class="irlab-empty-sub">Try switching to "All Subjects" or check that multi-year ${esc(subjectFilter||'')} data is loaded.</div>
          </div></div>
        </div>`;
      }

      const twoYr = scholars.filter(s=>s.numYears===2).length;
      const threeYr = scholars.filter(s=>s.numYears===3).length;
      const fourPlus = scholars.filter(s=>s.numYears>=4).length;

      // All valid placement-pair records across all repeat scholars' cycles
      const allCycleRecs = scholars.flatMap(s=>s.cycles).filter(r=>
        r.baseRelPlacement && r.springRelPlacement &&
        PLACEMENT_ORDER.includes(r.baseRelPlacement) && PLACEMENT_ORDER.includes(r.springRelPlacement));
      const aggM = allCycleRecs.length ? computeMetrics(allCycleRecs) : null;

      // Retention: did a scholar's BOY in year N+1 meet or exceed their Spring in year N?
      let retTotal = 0, retKept = 0;
      scholars.forEach(s => {
        // Group cycles by subject for proper consecutive-year comparison
        const bySubj = {};
        s.cycles.forEach(r => { if (!bySubj[r.subject]) bySubj[r.subject]=[]; bySubj[r.subject].push(r); });
        Object.values(bySubj).forEach(subjC => {
          subjC.sort((a,b)=>a.year>b.year?1:-1);
          for (let i=1; i<subjC.length; i++) {
            const prev=subjC[i-1], curr=subjC[i];
            if (prev.springRelPlacement && curr.baseRelPlacement) {
              retTotal++;
              if (plIdx(curr.baseRelPlacement) >= plIdx(prev.springRelPlacement)) retKept++;
            }
          }
        });
      });
      const retPct = retTotal > 0 ? Math.round(retKept/retTotal*100) : null;

      // Per-year aggregate metrics (across all repeat scholars, for that year)
      const allYears = [...new Set(allCycleRecs.map(r=>r.year))].sort();
      const yearMetrics = allYears.map(yr => {
        const yRows = allCycleRecs.filter(r=>r.year===yr);
        const boyGLs = yRows.map(r=>plToGL(r.baseRelPlacement)).filter(v=>v!==null);
        const sprGLs = yRows.map(r=>plToGL(r.springRelPlacement)).filter(v=>v!==null);
        const gains  = yRows.map(r=>r.springGain).filter(v=>v!==null&&!isNaN(v));
        const moved  = yRows.filter(r=>plIdx(r.springRelPlacement)>plIdx(r.baseRelPlacement)).length;
        const onGL   = yRows.filter(r=>isOnGL(r.springRelPlacement)).length;
        return {
          yr, n: yRows.length,
          avgBoyGL: boyGLs.length ? boyGLs.reduce((a,b)=>a+b,0)/boyGLs.length : null,
          avgSprGL: sprGLs.length ? sprGLs.reduce((a,b)=>a+b,0)/sprGLs.length : null,
          avgGain:  gains.length  ? gains.reduce((a,b)=>a+b,0)/gains.length   : null,
          pctMoved: yRows.length  ? Math.round(moved/yRows.length*100) : null,
          pctOnGL:  yRows.length  ? Math.round(onGL/yRows.length*100)  : null,
        };
      });

      // GL label helper: -3→"3 GL↓", -2→"2 GL↓", -1→"1 GL↓", 0→"GL", 1→"✓GL"
      const glLbl = (gl, bold) => {
        if (gl === null) return '—';
        const s = gl >= 1 ? '✓GL' : gl === 0 ? 'GL' : Math.abs(gl)+'GL↓';
        const c = gl >= 0 ? '#0d6e3a' : gl >= -1 ? '#d97706' : '#b91c1c';
        return bold ? `<strong style="color:${c}">${s}</strong>` : `<span style="color:${c}">${s}</span>`;
      };

      // ── Summary strip ──────────────────────────────────────────────────────
      const summaryHtml = `
        <div class="irlab-stats-grid" style="grid-template-columns:repeat(4,1fr);margin-bottom:1.25rem">
          <div class="irlab-stat" style="--irstat-color:#7b2d8b">
            <div class="irlab-stat-val">${scholars.length.toLocaleString()}</div>
            <div class="irlab-stat-lbl">Repeat Scholars</div>
            <div style="font-size:.6875rem;color:var(--muted);margin-top:.15rem">${twoYr} two-yr · ${threeYr} three-yr${fourPlus?' · '+fourPlus+' four+':''}</div>
          </div>
          <div class="irlab-stat" style="--irstat-color:#0d6e3a">
            <div class="irlab-stat-val">${aggM ? aggM.pctMoved+'%' : '—'}</div>
            <div class="irlab-stat-lbl">Moved Up / Cycle</div>
            <div style="font-size:.6875rem;color:var(--muted);margin-top:.15rem">placement level improvement</div>
          </div>
          <div class="irlab-stat" style="--irstat-color:#0050c8">
            <div class="irlab-stat-val">${aggM&&aggM.avgGain!==null?(aggM.avgGain>=0?'+':'')+aggM.avgGain.toFixed(1):'—'}</div>
            <div class="irlab-stat-lbl">Avg Scale Gain / Cycle</div>
            <div style="font-size:.6875rem;color:var(--muted);margin-top:.15rem">scale score points</div>
          </div>
          <div class="irlab-stat" style="--irstat-color:${retPct!==null&&retPct>=50?'#0d6e3a':'#d97706'}">
            <div class="irlab-stat-val">${retPct!==null?retPct+'%':'—'}</div>
            <div class="irlab-stat-lbl">Gains Retained</div>
            <div style="font-size:.6875rem;color:var(--muted);margin-top:.15rem">BOY ≥ prior-year Spring</div>
          </div>
        </div>`;

      // ── Cycle-over-cycle progression table ────────────────────────────────
      const cycleTableHtml = yearMetrics.length >= 2 ? `
        <div style="margin-bottom:1.25rem">
          <div style="font-size:.6875rem;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:var(--muted);margin-bottom:.5rem">📅 Cycle-Over-Cycle Progression — Repeat Scholars Only</div>
          <div style="overflow-x:auto">
            <table class="irlab-rank-table" style="font-size:.8rem">
              <thead><tr>
                <th>Year</th>
                <th style="text-align:center">N</th>
                <th style="text-align:center">Avg BOY GL</th>
                <th style="text-align:center">Avg Spring GL</th>
                <th style="text-align:center">Within-Cycle Gain</th>
                <th style="text-align:center">Avg Scale Gain</th>
                <th style="text-align:center">% Moved Up</th>
                <th style="text-align:center">% At/Above GL</th>
              </tr></thead>
              <tbody>${yearMetrics.map((ym,i) => {
                const glGain = (ym.avgBoyGL!==null&&ym.avgSprGL!==null) ? ym.avgSprGL-ym.avgBoyGL : null;
                const glGainStr = glGain!==null
                  ? (glGain>0.05?`<span style="color:#0d6e3a;font-weight:700">+${glGain.toFixed(2)} GL</span>`
                     :glGain<-0.05?`<span style="color:#b91c1c;font-weight:700">${glGain.toFixed(2)} GL</span>`
                     :`<span style="color:var(--muted)">Stable</span>`) : '—';
                // BOY trend vs previous year BOY
                let boyTrend = '';
                if (i>0 && yearMetrics[i-1].avgBoyGL!==null && ym.avgBoyGL!==null) {
                  const d = ym.avgBoyGL - yearMetrics[i-1].avgBoyGL;
                  boyTrend = d>0.05?' <span style="color:#0d6e3a;font-size:.65rem">↑</span>' : d<-0.05?' <span style="color:#b91c1c;font-size:.65rem">↓</span>' : '';
                }
                return `<tr>
                  <td style="font-weight:700;color:var(--navy)">${esc(ym.yr)}</td>
                  <td style="text-align:center">${ym.n}</td>
                  <td style="text-align:center">${ym.avgBoyGL!==null?glLbl(Math.round(ym.avgBoyGL))+boyTrend:'—'}</td>
                  <td style="text-align:center">${ym.avgSprGL!==null?glLbl(Math.round(ym.avgSprGL),true):'—'}</td>
                  <td style="text-align:center">${glGainStr}</td>
                  <td style="text-align:center;font-weight:600;color:var(--blue-mid)">${ym.avgGain!==null?(ym.avgGain>=0?'+':'')+ym.avgGain.toFixed(1):'—'}</td>
                  <td style="text-align:center;font-weight:700;color:${ym.pctMoved!==null&&ym.pctMoved>=50?'#0d6e3a':'#d97706'}">${ym.pctMoved!==null?ym.pctMoved+'%':'—'}</td>
                  <td style="text-align:center;font-weight:700;color:${ym.pctOnGL!==null&&ym.pctOnGL>=30?'#0d6e3a':'#d97706'}">${ym.pctOnGL!==null?ym.pctOnGL+'%':'—'}</td>
                </tr>`;
              }).join('')}</tbody>
            </table>
          </div>
        </div>` : '';

      // ── Individual scholar trajectory table (top 50 by most years, then alpha) ──
      const top50 = scholars.slice(0, 50);
      const scholarTableHtml = `
        <div>
          <div style="font-size:.6875rem;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:var(--muted);margin-bottom:.5rem">
            🎓 Multi-Year Scholar Trajectories · ${scholars.length.toLocaleString()} total${scholars.length>50?' · 50 shown':''}
          </div>
          <div style="overflow-x:auto;max-height:420px;overflow-y:auto">
            <table class="irlab-rank-table" style="font-size:.78rem">
              <thead style="position:sticky;top:0;background:var(--surface-2);z-index:2">
                <tr>
                  <th>Scholar</th>
                  <th style="text-align:center">Yrs</th>
                  <th>Grades</th>
                  <th>Cycle Trajectory <span style="font-weight:400;font-size:.65rem">(BOY→Spring per year)</span></th>
                  <th style="text-align:right">Tot. Gain</th>
                  <th style="text-align:center">Long-Term Trend</th>
                </tr>
              </thead>
              <tbody>${top50.map(s => {
                const gradesByYear = {};
                s.cycles.forEach(r => { if (r.grade && !gradesByYear[r.year]) gradesByYear[r.year] = r.grade; });
                const grades = s.uniqueYrs.map(yr=>gradesByYear[yr]).filter(Boolean);
                const gradePath = grades.length ? 'Gr.'+grades.join('→') : '—';

                // Build trajectory string: "22-23: 1GL↓→GL  23-24: GL→✓GL"
                const trajParts = s.cycles.map(r => {
                  const boyGL = plToGL(r.baseRelPlacement);
                  const sprGL = plToGL(r.springRelPlacement);
                  const yr = r.year ? r.year.slice(2,7) : '?';
                  const boy = boyGL!==null ? (boyGL>=1?'✓GL':boyGL===0?'GL':Math.abs(boyGL)+'GL↓') : '?';
                  const spr = sprGL!==null ? (sprGL>=1?'✓GL':sprGL===0?'GL':Math.abs(sprGL)+'GL↓') : '?';
                  const boyC = boyGL!==null ? (boyGL>=0?'#0d6e3a':boyGL>=-1?'#d97706':'#b91c1c') : 'var(--muted)';
                  const sprC = sprGL!==null ? (sprGL>=0?'#0d6e3a':sprGL>=-1?'#d97706':'#b91c1c') : 'var(--muted)';
                  const arrow = sprGL!==null&&boyGL!==null ? (sprGL>boyGL?' ↑':sprGL<boyGL?' ↓':' →') : '';
                  return `<span style="white-space:nowrap;margin-right:.625rem"><span style="color:var(--muted)">${yr}:</span> <span style="color:${boyC}">${boy}</span>→<strong style="color:${sprC}">${spr}</strong>${arrow}</span>`;
                }).join('');

                // Total gain: sum of springGain across all cycles
                const totalGain = s.cycles.map(r=>r.springGain).filter(v=>v!==null&&!isNaN(v)).reduce((a,b)=>a+b,0);
                const hasGain = s.cycles.some(r=>r.springGain!==null&&!isNaN(r.springGain));

                // Long-term trend: first cycle BOY GL → last cycle Spring GL
                const firstRec = s.cycles[0], lastRec = s.cycles[s.cycles.length-1];
                let trendStr = '—', trendColor = 'var(--muted)';
                if (firstRec && lastRec && firstRec.baseRelPlacement && lastRec.springRelPlacement) {
                  const startGL = plToGL(firstRec.baseRelPlacement);
                  const endGL   = plToGL(lastRec.springRelPlacement);
                  if (startGL!==null && endGL!==null) {
                    const delta = endGL - startGL;
                    if (delta > 0)      { trendStr='↑ +'+delta+' GL'; trendColor='#0d6e3a'; }
                    else if (delta < 0) { trendStr='↓ '+delta+' GL'; trendColor='#b91c1c'; }
                    else                { trendStr='→ Stable';        trendColor='var(--muted)'; }
                  }
                }

                return `<tr>
                  <td>
                    <div style="font-weight:600;color:var(--navy);max-width:130px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${esc(s.name)}">${esc(s.name)}</div>
                    <div style="font-size:.65rem;color:var(--muted)">by ${s.usedId?'ID':'Name'}</div>
                  </td>
                  <td style="text-align:center;font-weight:700;color:#7b2d8b">${s.numYears}</td>
                  <td style="font-size:.72rem;color:var(--muted);white-space:nowrap">${esc(gradePath)}</td>
                  <td style="font-size:.72rem">${trajParts||'—'}</td>
                  <td style="text-align:right;font-weight:600;color:var(--blue-mid)">${hasGain?(totalGain>=0?'+':'')+totalGain.toFixed(1):'—'}</td>
                  <td style="text-align:center;font-weight:700;color:${trendColor};white-space:nowrap">${trendStr}</td>
                </tr>`;
              }).join('')}</tbody>
            </table>
          </div>
          <div style="font-size:.7rem;color:var(--muted);margin-top:.5rem;line-height:1.6">
            ✓GL = At/Above Grade Level · GL = Early On Grade Level · 1GL↓ = 1 Grade Level Below · 2GL↓ = 2 Below · 3GL↓ = 3+ Below
            ${retTotal>0?` · <strong>${retPct}%</strong> of return-year transitions: scholar's BOY matched or exceeded their prior-year Spring placement`:''}
            · Scholars matched by ${idx.repeatIdSet.size} IDs${idx.repeatNameSet.size?' + '+idx.repeatNameSet.size+' names (ID absent)':''}
          </div>
        </div>`;

      return `<div class="irlab-card" style="border-left:4px solid #7b2d8b;margin-bottom:1.25rem">
        <div class="irlab-card-hd">
          <div class="irlab-card-title">🔁 Repeat Scholar Longitudinal Analysis</div>
          <div class="irlab-card-meta">Year-over-year scholars matched by Student ID · Are they moving toward grade level?</div>
        </div>
        <div class="irlab-card-body">${summaryHtml}${cycleTableHtml}${scholarTableHtml}</div>
      </div>`;
    }

    // ── SECTION F: ELA DOMAIN SUBSCORES ───────────────────────────────────────
    function renderELADomainSubscores(rows) {
      const elaRows = rows.filter(r=>r.subject==='ELA');
      if (!elaRows.length) return '';
      const domains = [
        { key: 'elaPhonologicalScore',   springKey: 'elaPhonologicalSpringScore',   label: 'Phonological Awareness' },
        { key: 'elaPhonicsScore',         springKey: 'elaPhonicsSpringScore',         label: 'Phonics' },
        { key: 'elaHFWScore',             springKey: 'elaHFWSpringScore',             label: 'High Frequency Words' },
        { key: 'elaVocabScore',           springKey: 'elaVocabSpringScore',           label: 'Vocabulary' },
        { key: 'elaRCOverallScore',       springKey: 'elaRCOverallSpringScore',       label: 'Reading Comprehension (Overall)' },
        { key: 'elaRCLitScore',           springKey: 'elaRCLitSpringScore',           label: 'Reading Comprehension (Literature)' },
        { key: 'elaRCInfoScore',          springKey: 'elaRCInfoSpringScore',          label: 'Reading Comprehension (Informational)' },
      ];
      const domainRows = domains.map(d => {
        const baseVals   = elaRows.map(r=>r[d.key]).filter(v=>v!==null&&!isNaN(v)&&v>0);
        const springVals = elaRows.map(r=>r[d.springKey]).filter(v=>v!==null&&!isNaN(v)&&v>0);
        if (!baseVals.length && !springVals.length) return null;
        const baseMed   = medianArr(baseVals);
        const springMed = medianArr(springVals);
        const diff = baseMed !== null && springMed !== null ? springMed - baseMed : null;
        return { label: d.label, baseMed, springMed, diff, n: Math.max(baseVals.length, springVals.length) };
      }).filter(Boolean);
      if (!domainRows.length) return '';
      return `<div class="irlab-card" style="margin-bottom:1.25rem">
        <div class="irlab-card-hd"><div class="irlab-card-title">📖 ELA Domain Subscores</div><div class="irlab-card-meta">Median scale score — BOY vs Spring</div></div>
        <div class="irlab-card-body" style="overflow-x:auto">
          <table class="irlab-rank-table">
            <thead><tr><th>Domain</th><th style="text-align:right">BOY Median</th><th style="text-align:right">Spring Median</th><th style="text-align:center">Change</th><th style="text-align:right">N</th></tr></thead>
            <tbody>${domainRows.map(d=>{
              const diffStr = d.diff !== null ? (d.diff>=0?`<span style="color:#0d6e3a;font-weight:700">+${d.diff.toFixed(1)}</span>`:`<span style="color:#b91c1c;font-weight:700">${d.diff.toFixed(1)}</span>`) : '—';
              return `<tr>
                <td style="font-weight:600;color:var(--navy)">${esc(d.label)}</td>
                <td style="text-align:right;color:var(--muted)">${d.baseMed !== null ? d.baseMed.toFixed(1) : '—'}</td>
                <td style="text-align:right;font-weight:700;color:var(--blue-mid)">${d.springMed !== null ? d.springMed.toFixed(1) : '—'}</td>
                <td style="text-align:center">${diffStr}</td>
                <td style="text-align:right;font-size:.75rem;color:var(--muted)">${d.n}</td>
              </tr>`;
            }).join('')}</tbody>
          </table>
        </div>
      </div>`;
    }

    // ── SECTION G: MATH DOMAIN SUBSCORES ──────────────────────────────────────
    function renderMathDomainSubscores(rows) {
      const mathRows = rows.filter(r=>r.subject==='Math');
      if (!mathRows.length) return '';
      const domains = [
        { key: 'mathNumOpsScore',    springKey: 'mathNumOpsSpringScore',    label: 'Number and Operations' },
        { key: 'mathAlgebraScore',   springKey: 'mathAlgebraSpringScore',   label: 'Algebra and Algebraic Thinking' },
        { key: 'mathMeasDataScore',  springKey: 'mathMeasDataSpringScore',  label: 'Measurement and Data' },
        { key: 'mathGeometryScore',  springKey: 'mathGeometrySpringScore',  label: 'Geometry' },
      ];
      const domainRows = domains.map(d => {
        const baseVals   = mathRows.map(r=>r[d.key]).filter(v=>v!==null&&!isNaN(v)&&v>0);
        const springVals = mathRows.map(r=>r[d.springKey]).filter(v=>v!==null&&!isNaN(v)&&v>0);
        if (!baseVals.length && !springVals.length) return null;
        const baseMed   = medianArr(baseVals);
        const springMed = medianArr(springVals);
        const diff = baseMed !== null && springMed !== null ? springMed - baseMed : null;
        return { label: d.label, baseMed, springMed, diff, n: Math.max(baseVals.length, springVals.length) };
      }).filter(Boolean);
      if (!domainRows.length) return '';
      return `<div class="irlab-card" style="margin-bottom:1.25rem">
        <div class="irlab-card-hd"><div class="irlab-card-title">➗ Math Domain Subscores</div><div class="irlab-card-meta">Median scale score — BOY vs Spring</div></div>
        <div class="irlab-card-body" style="overflow-x:auto">
          <table class="irlab-rank-table">
            <thead><tr><th>Domain</th><th style="text-align:right">BOY Median</th><th style="text-align:right">Spring Median</th><th style="text-align:center">Change</th><th style="text-align:right">N</th></tr></thead>
            <tbody>${domainRows.map(d=>{
              const diffStr = d.diff !== null ? (d.diff>=0?`<span style="color:#0d6e3a;font-weight:700">+${d.diff.toFixed(1)}</span>`:`<span style="color:#b91c1c;font-weight:700">${d.diff.toFixed(1)}</span>`) : '—';
              return `<tr>
                <td style="font-weight:600;color:var(--navy)">${esc(d.label)}</td>
                <td style="text-align:right;color:var(--muted)">${d.baseMed !== null ? d.baseMed.toFixed(1) : '—'}</td>
                <td style="text-align:right;font-weight:700;color:var(--blue-mid)">${d.springMed !== null ? d.springMed.toFixed(1) : '—'}</td>
                <td style="text-align:center">${diffStr}</td>
                <td style="text-align:right;font-size:.75rem;color:var(--muted)">${d.n}</td>
              </tr>`;
            }).join('')}</tbody>
          </table>
        </div>
      </div>`;
    }

    // ── QUICK CSV MODE (session-only snapshots) ───────────────────────────────
    function renderQuickCSVMode() {
      const hasResult = _irlCsvData && _irlCsvData.rows;
      return `<div class="irlab-card">
        <div class="irlab-card-hd">
          <div class="irlab-card-title">📸 Quick CSV — Session Snapshot</div>
          <div class="irlab-card-meta">Upload any i-Ready export · Session-only · Never persisted · Never affects embedded data</div>
        </div>
        <div class="irlab-card-body">
          <div style="margin-bottom:1rem;padding:.75rem;background:#fffbeb;border:1px solid #fde68a;border-radius:8px;font-size:.8125rem;color:#92400e">
            <strong>⚠️ Session-only:</strong> Data parsed locally. Cleared on refresh. Does not update any view's embedded data.
            ${_irlDept==='data'?'<br><strong>Data & Eval:</strong> To update embedded data for all departments, use the <em>Embedded Data Manager</em> in the Analysis tab.':''}
          </div>
          <div class="irlab-upload-zone" id="irlabDropZone">
            <input type="file" accept=".csv" onchange="irlab.handleFileUpload(event)">
            <div class="irlab-upload-icon">📂</div>
            <div class="irlab-upload-title">Drop i-Ready CSV here or click to browse</div>
            <div class="irlab-upload-sub">Math or ELA longitudinal export · Base + Spring columns required</div>
          </div>
          ${hasResult ? renderQuickCSVResult() : ''}
        </div>
      </div>`;
    }

    function renderQuickCSVResult() {
      const {rows,filename} = _irlCsvData;
      const isELA = Object.keys(rows[0]||{}).some(k=>k.toLowerCase().includes('phonics')||k.toLowerCase().includes('vocabulary'));
      const norm = rows.map(r=>normalizeRow(r, isELA?'ELA':'Math'));
      const valid = norm.filter(r=>r.baseRelPlacement&&r.springRelPlacement&&PLACEMENT_ORDER.includes(r.baseRelPlacement)&&PLACEMENT_ORDER.includes(r.springRelPlacement));
      const m = computeMetrics(valid);
      if (!m) return `<div class="irlab-empty" style="margin-top:1rem"><div class="irlab-empty-icon">🔍</div><div class="irlab-empty-title">No valid diagnostic pairs found</div></div>`;
      return `<div style="margin-top:1.25rem">
        <div class="irlab-file-chip valid" style="margin-bottom:1rem">📄 ${esc(filename)} · ${rows.length} rows · ${valid.length} valid pairs</div>
        <div class="irlab-stats-grid" style="margin-bottom:1rem">
          <div class="irlab-stat" style="--irstat-color:#0d6e3a"><div class="irlab-stat-val">${m.pctMoved}%</div><div class="irlab-stat-lbl">Moved Up</div></div>
          <div class="irlab-stat" style="--irstat-color:#0050c8"><div class="irlab-stat-val">${m.pctOnGL}%</div><div class="irlab-stat-lbl">At GL</div></div>
          <div class="irlab-stat" style="--irstat-color:#b91c1c"><div class="irlab-stat-val">${m.pct2Below}%</div><div class="irlab-stat-lbl">2+ Below</div></div>
          <div class="irlab-stat" style="--irstat-color:#d97706"><div class="irlab-stat-val">${m.avgGain!==null?'+'+m.avgGain.toFixed(1):'—'}</div><div class="irlab-stat-lbl">Avg Gain</div></div>
        </div>
        ${renderPlacementShift(m)}
        <button class="btn btn-secondary" style="margin-top:1rem;font-size:.8125rem" onclick="irlab.clearCsv()">✕ Clear</button>
      </div>`;
    }

    // ── MAIN RENDER ───────────────────────────────────────────────────────────
    function renderLab() {
      loadData();
      _destroyCharts();
      const el = document.getElementById('irlabContainer');
      if (!el) return;

      if (_irlScholarDrill) { el.innerHTML=`<div class="irlab-wrap">${renderScholarDrill(_irlScholarDrill)}</div>`; return; }
      if (_irlTutorDrill)   { el.innerHTML=`<div class="irlab-wrap">${renderTutorDrill(_irlTutorDrill, _irlDept)}</div>`; return; }

      const allRows = [...IRLAB_DATA.math,...IRLAB_DATA.ela];
      const years   = [...new Set(allRows.map(r=>r.year))].filter(Boolean).sort();
      // Filters cascade: year → district → school/grade (only show options that exist in the selected year)
      const yearRows = _irlYear !== 'all' ? allRows.filter(r=>r.year===_irlYear) : allRows;
      const dists   = [...new Set(yearRows.map(r=>r.district))].filter(Boolean).sort();
      const distFiltered = _irlDistrict !== 'all' ? yearRows.filter(r=>r.district===_irlDistrict) : yearRows;
      const schools = [...new Set(distFiltered.map(r=>r.school))].filter(Boolean).sort();
      const grades  = [...new Set(distFiltered.map(r=>r.grade))].filter(Boolean).sort((a,b)=>{
        const na=parseInt(a)||99, nb=parseInt(b)||99; return na-nb;
      });
      const hasData = allRows.length > 0;

      // Year defaults to 'all' (show all available years) — users can filter via dropdown

      const yearOpts   = ['all',...years].map(y=>`<option value="${y}" ${_irlYear===y?'selected':''}>${y==='all'?'All Years':y}</option>`).join('');
      const subOpts    = `<option value="all" ${_irlSubject==='all'?'selected':''}>Both Subjects</option><option value="Math" ${_irlSubject==='Math'?'selected':''}>Math</option><option value="ELA" ${_irlSubject==='ELA'?'selected':''}>ELA</option>`;
      const distOpts   = ['all',...dists].map(d=>`<option value="${esc(d)}" ${_irlDistrict===d?'selected':''}>${d==='all'?'All Districts':esc(d)}</option>`).join('');
      const schoolOpts = ['all',...schools].map(s=>`<option value="${esc(s)}" ${_irlSchool===s?'selected':''}>${s==='all'?'All Schools':esc(s)}</option>`).join('');
      const gradeOpts  = ['all',...grades].map(g=>`<option value="${esc(g)}" ${_irlGrade===g?'selected':''}>${g==='all'?'All Grades':'Grade '+esc(g)}</option>`).join('');
      const typeOpts   = `<option value="all" ${_irlScholarType==='all'?'selected':''}>All Scholars</option><option value="repeat" ${_irlScholarType==='repeat'?'selected':''}>Repeat Only</option><option value="nonrepeat" ${_irlScholarType==='nonrepeat'?'selected':''}>Non-Repeat Only</option>`;
      // Only show pilot filter when the data actually has tagged rows (25-26 EOY sheet)
      const hasPilotData = allRows.some(r => r.isPilot !== null && r.isPilot !== undefined);
      const pilotOpts  = hasPilotData
        ? `<option value="all" ${_irlPilot==='all'?'selected':''}>All Programs</option><option value="nonpilot" ${_irlPilot==='nonpilot'?'selected':''}>Non-Pilot Only</option><option value="pilot" ${_irlPilot==='pilot'?'selected':''}>Pilot Only</option>`
        : null;

      // Live data status badge
      const liveStatus = _irlLiveStatus === 'live'
        ? `<span style="font-size:.6875rem;background:#dcfce7;color:#166534;padding:.2rem .625rem;border-radius:20px;font-weight:600">🟢 Live data</span>`
        : `<span style="font-size:.6875rem;background:#fef3c7;color:#92400e;padding:.2rem .625rem;border-radius:20px;font-weight:600">⏳ Loading…</span>`;
      const srcBadge = IRLAB_DATA.ts
        ? `<span style="font-size:.6875rem;background:#ede9fe;color:#6d28d9;padding:.2rem .625rem;border-radius:20px;font-weight:600">📤 Updated ${new Date(IRLAB_DATA.ts).toLocaleDateString()}</span>`
        : liveStatus;

      // ── Academic Insight Panel (moved from Exec Dashboard) ──────────────────
      const _irlIm = (typeof getInsightMetrics === 'function') ? getInsightMetrics({
        year:        _irlYear        !== 'all' ? _irlYear        : '',
        district:    _irlDistrict    !== 'all' ? _irlDistrict    : '',
        school:      _irlSchool      !== 'all' ? _irlSchool      : '',
        grade:       _irlGrade       !== 'all' ? _irlGrade       : '',
        subject:     _irlSubject     !== 'all' ? _irlSubject     : '',
        scholarType: _irlScholarType !== 'all' ? _irlScholarType : '',
      }) : null;
      window._njtcIM = _irlIm; // keep drilldown modal working
      const _irlIMLoaded = _irlIm && _irlIm.hasData;
      const _irlIMN      = _irlIm ? _irlIm.n : 0;
      const _irlIMSY     = _irlIm ? (_irlIm.allYears && _irlIm.allYears.length ? 'SY: ' + _irlIm.allYears.join(', ') : '') : '';
      function _irlEcdiVal(v, unit, prefix) {
        if (v == null) return '<div class="ecdi-val" style="color:#cbd5e1">&mdash;</div>';
        return '<div class="ecdi-val">'+(prefix||'')+v+(unit?'<span class="ecdi-val-unit">'+unit+'</span>':'')+'</div>';
      }
      const _irlInsightHTML = '<div class="ecd-insight-panel">'
        +'<div class="ecdi-panel-hdr"><span>Academic Insights</span><span style="font-size:.55rem;color:#94a3b8;font-weight:500">iReady diagnostic</span></div>'
        // Card A: Scale Gain
        +'<div class="ecdi-card cci-teal">'
        +'<div class="ecdi-eyebrow">Scale Gain<span class="ecdi-tip" title="Median Scale Score Gain&#10;&#10;Formula: median(springScore &minus; baselineScore)&#10;Source: Spring Diagnostic Gain column (iReady CSV).&#10;Positive values indicate forward progress.&#10;Median used to reduce outlier distortion.">ⓘ</span></div>'
        +_irlEcdiVal(_irlIMLoaded ? _irlIm.medianScaleGain : null, ' pts', (_irlIMLoaded && _irlIm.medianScaleGain > 0 ? '+' : ''))
        +'<div class="ecdi-card-title">Median Scale Score Gain</div>'
        +'<div class="ecdi-card-desc">Median improvement in iReady scale score between baseline and most recent diagnostic.</div>'
        +'<div class="ecdi-card-foot">'
        +'<span class="ecdi-n">'+((_irlIMLoaded&&_irlIMN>0)?'n='+_irlIMN.toLocaleString():'Loading&hellip;')+'</span>'
        +(_irlIMLoaded?'<button class="ecdi-drill-btn" onclick="window._njtcInsightDrill(\'growth\')">Drilldown &rarr;</button>':'')
        +'</div></div>'
        // Card B: Learning Progress
        +'<div class="ecdi-card cci-blue">'
        +'<div class="ecdi-eyebrow">Learning Progress<span class="ecdi-tip" title="Months of Learning Gained&#10;&#10;Formula: Scale Score Gain &divide; (Differentiated Typical Growth &divide; 10)&#10;= pctTypical &times; 10&#10;&#10;10 = school months in a year per iReady norms.&#10;1.0 = one month of expected growth.&#10;Source: Spring_pct_progress_typical_growth column.">ⓘ</span></div>'
        +_irlEcdiVal(_irlIMLoaded ? _irlIm.medianMonthsGrowth : null, ' mo')
        +'<div class="ecdi-card-title">Months of Learning Gained</div>'
        +'<div class="ecdi-card-desc">Estimated months of academic progress based on scale score change relative to expected yearly growth.</div>'
        +'<div class="ecdi-card-foot">'
        +'<span class="ecdi-n">'+(_irlIMSY||'&mdash;')+'</span>'
        +(_irlIMLoaded?'<button class="ecdi-drill-btn" onclick="window._njtcInsightDrill(\'demo\')">Drilldown &rarr;</button>':'')
        +'</div></div>'
        // Card C: Target Progress — program-window adjusted using median springWeeks
        +(function(){
          var _adj  = _irlIMLoaded && _irlIm.windowAdjustedPct  != null ? _irlIm.windowAdjustedPct  : null;
          var _raw  = _irlIMLoaded && _irlIm.medianPctExpected   != null ? _irlIm.medianPctExpected   : null;
          var _wks  = _irlIMLoaded && _irlIm.medianSpringWeeks   != null ? _irlIm.medianSpringWeeks   : null;
          var _disp = _adj != null ? Math.round(_adj) : (_raw != null ? Math.round(_raw) : null);
          var _wkLbl = _wks != null ? ('~'+Math.round(_wks)+' wk window') : '&mdash;';
          var _desc = _wks != null
            ? 'Scholars’ growth relative to what’s expected for a ~'+Math.round(_wks)+'-week program window. 100 % = on pace for your program duration.'
            : 'Median scholar progress toward expected yearly academic growth. 100 % = on pace with iReady norms.';
          var _tip = 'Program-Window Progress&#10;&#10;'
            + 'Adjusts for your actual program duration instead of iReady’s 30-week annual standard.&#10;&#10;'
            + 'Formula: Median % of typical annual growth ÷ (median diagnostic weeks ÷ 30)&#10;&#10;'
            + 'Each scholar’s pctTypical = actual gain ÷ expected annual gain (pre-computed by iReady).&#10;'
            + 'The median across scholars is then divided by (median weeks ÷ 30) to rescale to program duration.&#10;&#10;'
            + '100% = scholars achieved exactly what is expected for their program window&#10;'
            + '>100% = scholars exceeded program-window expectations&#10;'
            + '<100% = scholars are below program-window expectations&#10;&#10;'
            + (_wks != null ? 'Median diagnostic window: ~'+Math.round(_wks)+' wks (iReady standard = 30 wks)&#10;' : '')
            + 'Source: spring_pct_progress_typical_growth + spring_weeks_between_diagnostics';
          return '<div class="ecdi-card cci-gold">'
            +'<div class="ecdi-eyebrow">Target Progress<span class="ecdi-tip" title="'+_tip+'">ⓘ</span></div>'
            +_irlEcdiVal(_disp, '%')
            +'<div class="ecdi-card-title">Program-Window Progress</div>'
            +'<div class="ecdi-card-desc">'+_desc+'</div>'
            +'<div class="ecdi-card-foot">'
            +'<span class="ecdi-n">'+_wkLbl+'</span>'
            +(_irlIMLoaded?'<button class="ecdi-drill-btn" onclick="window._njtcInsightDrill(\'district\')">Drilldown &rarr;</button>':'')
            +'</div></div>';
        })()
        // Card C2: Scale Score Progression — NJTC/Mysti "Weeks of Growth" methodology
        +(function(){
          var _wksG = _irlIMLoaded && _irlIm.medianWeeksOfGrowth != null ? _irlIm.medianWeeksOfGrowth : null;
          var _n    = _irlIMLoaded ? (_irlIm.weeksOfGrowthN || 0) : 0;
          var _moEq = _wksG != null ? (_wksG/3).toFixed(1) : null; // iReady standard: 30 wks = 10 mo → 3 wks/mo
          var _tip  = 'Scale Score Progression&#10;&#10;'
            + 'NJTC programs run for a shorter, variable window than iReady’s 10-month/30-week&#10;'
            + 'annual standard, so growth is measured against each scholar’s OWN diagnostic&#10;'
            + 'window instead:&#10;&#10;'
            + 'Expected Growth per Week = Annual Typical Growth Measure &divide; Spring Weeks Between Diagnostics&#10;'
            + 'Weeks of Growth = Spring Diagnostic Gain &divide; Expected Growth per Week&#10;&#10;'
            + '1 week of growth = the scale-score gain expected in one week of typical growth pace.&#10;'
            + (_moEq != null ? ('&#8776; '+_moEq+' months of growth (at iReady’s 3 wks/mo standard)&#10;&#10;') : '')
            + 'Source: annual_typical_growth_measure + spring_weeks_between_diagnostics + spring_diagnostic_gain';
          return '<div class="ecdi-card cci-rose">'
            +'<div class="ecdi-eyebrow">Scale Score Progression<span class="ecdi-tip" title="'+_tip+'">ⓘ</span></div>'
            +_irlEcdiVal(_wksG, ' wks')
            +'<div class="ecdi-card-title">Median Weeks of Growth</div>'
            +'<div class="ecdi-card-desc">Scale score gain translated into weeks of typical growth, measured against each scholar’s own diagnostic window.'
            +(_moEq!=null?' &#8776; '+_moEq+' months.':'')+'</div>'
            +'<div class="ecdi-card-foot">'
            +'<span class="ecdi-n">'+((_irlIMLoaded&&_n>0)?'n='+_n.toLocaleString():'Loading&hellip;')+'</span>'
            +'</div></div>';
        })()
        // Card D: Learning Velocity
        +'<div class="ecdi-card cci-purple'+((!_irlIm||!_irlIm.syAligned)?' ecdi-ph':'')+'">'
        +'<div class="ecdi-eyebrow">Learning Velocity<span class="ecdi-tip" title="Learning Velocity&#10;&#10;Formula: Scale Score Gain &divide; Tutoring Hours&#10;Requires academic and operational data from the same school year.&#10;Pearl data is SY 2025&ndash;2026; this card activates automatically when iReady corpus includes that year.">ⓘ</span></div>'
        +((_irlIm&&_irlIm.syAligned&&_irlIm.medVelocity!=null)
          ?'<div class="ecdi-val">'+_irlIm.medVelocity.toFixed(2)+'<span style="font-size:.55rem;font-weight:400;color:#a5b4fc;margin-left:.25rem">pts/hr</span></div>'
          :'<div class="ecdi-val" style="color:#cbd5e1">&mdash;</div>')
        +'<div class="ecdi-card-title">Learning Velocity</div>'
        +((!_irlIm||!_irlIm.syAligned)?'<div class="ecdi-ph-msg">Learning Velocity will activate once 2025&ndash;2026 academic diagnostic data becomes available.</div>':'<div class="ecdi-card-desc">Scale score points gained per tutoring hour (requires matching SY data).</div>')
        +'</div>'
        // Card E: Tutor Impact
        +'<div class="ecdi-card cci-green'+((!_irlIm||!_irlIm.syAligned)?' ecdi-ph':'')+'">'
        +'<div class="ecdi-eyebrow">Tutor Impact<span class="ecdi-tip" title="Tutor Impact Leaders&#10;&#10;Identifies tutors whose scholars demonstrate the strongest average scale score gains.&#10;Requires academic and operational data from the same school year (min 2 scholars per tutor).&#10;Activates automatically when 2025&ndash;2026 iReady data is added.">ⓘ</span></div>'
        +((_irlIm&&_irlIm.syAligned&&_irlIm.tutorImpactLeaders&&_irlIm.tutorImpactLeaders.length)
          ?('<div style="margin-top:.35rem;display:flex;flex-direction:column;gap:.3rem">'+_irlIm.tutorImpactLeaders.slice(0,3).map(function(t,i){return '<div style="display:flex;align-items:center;gap:.375rem;font-size:.7rem"><span style="font-weight:800;color:#059669;width:20px">'+['🥇','🥈','🥉'][i]+'</span><span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:600">'+t.tutor+'</span><span style="font-weight:700;color:#059669">+'+(t.avgGain).toFixed(1)+'pts</span></div>';}).join('')+'</div>')
          :'<div class="ecdi-val" style="color:#cbd5e1">&mdash;</div>')
        +'<div class="ecdi-card-title" style="margin-top:.4rem">Tutor Impact Leaders</div>'
        +((!_irlIm||!_irlIm.syAligned)?'<div class="ecdi-ph-msg">When 2025&ndash;2026 academic results are added, tutor impact analytics will automatically populate.</div>':'<div class="ecdi-card-desc">Average scale score growth by tutor (min 2 scholars).</div>')
        +'</div>'
        +'</div>'; // end .ecd-insight-panel

      // ── Diagnostic Testing Windows ──────────────────────────────────────
      // Pull from Pearl Operations: missed reasons = NJTC Diagnostic Testing
      // or School-administered Testing. Aggregated by school → unique weeks.
      const _diagData = (window.po && typeof window.po.getDiagnosticTestingData === 'function')
        ? window.po.getDiagnosticTestingData() : [];
      const _diagSection = (function(){
        if (!_diagData.length) return '';
        const maxNJTC = _diagData.reduce(function(m,d){ return Math.max(m, d.njtcWeeks); }, 0);
        const _wkCell = function(labels, makeup, colFn) {
          const col = colFn(labels.length);
          const wkStr = labels.length
            ? labels.slice(0,4).join(', ') + (labels.length > 4 ? '…' : '')
            : '—';
          const mu = makeup > 0 ? '&nbsp;<span style="font-size:.6rem;color:#94a3b8;white-space:nowrap">(+' + makeup + ' make-up)</span>' : '';
          return { num: labels.length, col, wkStr, mu };
        };
        const njtcCol  = function(n){ return n >= 3 ? '#d97706' : n > 0 ? '#ca8a04' : '#94a3b8'; };
        const schoolCol = function(n){ return n >= 3 ? '#7c3aed' : n > 0 ? '#8b5cf6' : '#94a3b8'; };
        const rows = _diagData.map(function(d){
          const njtc   = _wkCell(d.njtcWeekLabels,   d.njtcMakeup,   njtcCol);
          const school = _wkCell(d.schoolWeekLabels, d.schoolMakeup, schoolCol);
          const njtcNum = njtc.num  > 0
            ? '<span style="font-weight:700;color:' + njtc.col  + ';font-size:.8rem;white-space:nowrap">' + njtc.num  + '</span>' + njtc.mu
            : '<span style="color:#cbd5e1;font-size:.75rem">—</span>';
          const scNum   = school.num > 0
            ? '<span style="font-weight:700;color:' + school.col + ';font-size:.8rem;white-space:nowrap">' + school.num + '</span>' + school.mu
            : '<span style="color:#cbd5e1;font-size:.75rem">—</span>';
          // Flag rows where only School-administered shows (possible Pearl coding issue)
          const njtcMissNote = njtc.num === 0 && school.num > 0
            ? ' <span style="font-size:.58rem;color:#7c3aed;opacity:.7" title="Pearl missed reason recorded as \'School-administered Testing\'. If this site had NJTC-coordinated iReady diagnostics, the data entry may need review.">†</span>'
            : '';
          return '<tr style="border-bottom:1px solid #f1f5f9">'
            +'<td style="padding:.4rem .5rem;font-size:.7rem;font-weight:600;color:#1e293b;min-width:160px">' + d.school + njtcMissNote + '</td>'
            +'<td style="padding:.4rem .5rem;font-size:.68rem;color:#64748b;min-width:130px">' + (d.district||'—') + '</td>'
            +'<td style="padding:.4rem .5rem;text-align:center;white-space:nowrap;min-width:60px">' + njtcNum + '</td>'
            +'<td style="padding:.4rem .5rem;font-size:.65rem;color:#94a3b8;min-width:150px">' + (njtc.num > 0 ? njtc.wkStr : '—') + '</td>'
            +'<td style="padding:.4rem .5rem;text-align:center;white-space:nowrap;min-width:60px">' + scNum + '</td>'
            +'<td style="padding:.4rem .5rem;font-size:.65rem;color:#94a3b8;min-width:150px">' + (school.num > 0 ? school.wkStr : '—') + '</td>'
            +'<td style="padding:.4rem .5rem;text-align:center;font-size:.68rem;color:#64748b;white-space:nowrap;min-width:55px">' + d.scholars + '</td>'
            +'</tr>';
        }).join('');
        const totalSites = _diagData.length;
        const njtcMissCount = _diagData.filter(function(d){ return d.njtcWeeks === 0 && d.schoolWeeks > 0; }).length;
        return '<details style="margin-top:.75rem;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden">'
          +'<summary style="padding:.6rem 1rem;cursor:pointer;font-size:.75rem;font-weight:700;color:#1e293b;display:flex;align-items:center;gap:.5rem;list-style:none">'
          +'<span style="flex:1">🔬 Diagnostic Testing Windows — ' + totalSites + ' site' + (totalSites>1?'s':'') + ' · Up to ' + maxNJTC + ' NJTC diagnostic week' + (maxNJTC!==1?'s':'') + ' per site</span>'
          +'<span style="font-size:.65rem;color:#94a3b8;font-weight:400">NJTC Diagnostic Testing · School-administered Testing &nbsp;▼</span>'
          +'</summary>'
          +'<div style="padding:.5rem 1rem 1rem">'
          +'<p style="font-size:.68rem;color:#64748b;margin:.25rem 0 .5rem">Weeks where <strong>3+ distinct scholars</strong> had the missed reason counts as a testing window; fewer than 3 scholars = individual make-up, shown as <em>+N</em>. '
          +'<strong style="color:#d97706">NJTC Diagnostic Testing</strong> (orange) = NJTC-administered iReady diagnostic. '
          +'<strong style="color:#7c3aed">School-administered Testing</strong> (purple) = school-side testing entered separately in Pearl.</p>'
          + (njtcMissCount > 0
            ? '<p style="font-size:.68rem;color:#7c3aed;background:#f5f3ff;border-left:3px solid #a78bfa;padding:.4rem .625rem;border-radius:0 6px 6px 0;margin:.4rem 0 .75rem">† <strong>' + njtcMissCount + ' site' + (njtcMissCount>1?'s':'') + '</strong> show School-administered Testing only — no NJTC Diagnostic Testing recorded in Pearl. If NJTC-coordinated iReady diagnostics occurred at these sites (e.g. iLearn, Penns Grove), the Pearl missed reason may have been entered as "School-administered Testing" instead of "NJTC Diagnostic Testing." Verify with Pearl data entry and correct if needed.</p>'
            : '')
          +'<div style="overflow-x:auto">'
          +'<table style="border-collapse:collapse;min-width:780px;width:100%">'
          +'<colgroup>'
          +'<col style="min-width:170px">'
          +'<col style="min-width:140px">'
          +'<col style="width:54px">'
          +'<col style="min-width:160px">'
          +'<col style="width:54px">'
          +'<col style="min-width:160px">'
          +'<col style="width:58px">'
          +'</colgroup>'
          +'<thead>'
          +'<tr style="background:#f1f5f9">'
          +'<th colspan="2" style="padding:.3rem .5rem;font-size:.6rem;text-align:left;color:#64748b;font-weight:600;border-bottom:1px solid #e2e8f0"></th>'
          +'<th colspan="2" style="padding:.3rem .5rem;font-size:.6rem;text-align:center;color:#d97706;font-weight:700;border-bottom:1px solid #e2e8f0;border-left:2px solid #fde68a;background:#fffbeb">NJTC Diagnostic Testing</th>'
          +'<th colspan="2" style="padding:.3rem .5rem;font-size:.6rem;text-align:center;color:#7c3aed;font-weight:700;border-bottom:1px solid #e2e8f0;border-left:2px solid #ede9fe;background:#f5f3ff">School-administered Testing</th>'
          +'<th style="padding:.3rem .5rem;font-size:.6rem;text-align:center;color:#64748b;font-weight:600;border-bottom:1px solid #e2e8f0"></th>'
          +'</tr>'
          +'<tr style="border-bottom:2px solid #e2e8f0">'
          +'<th style="padding:.35rem .5rem;font-size:.65rem;text-align:left;color:#64748b;font-weight:600;white-space:nowrap">School</th>'
          +'<th style="padding:.35rem .5rem;font-size:.65rem;text-align:left;color:#64748b;font-weight:600;white-space:nowrap">District</th>'
          +'<th style="padding:.35rem .5rem;font-size:.65rem;text-align:center;color:#d97706;font-weight:700;border-left:2px solid #fde68a;background:#fffbeb;white-space:nowrap">Wks</th>'
          +'<th style="padding:.35rem .5rem;font-size:.65rem;text-align:left;color:#64748b;font-weight:600;background:#fffbeb;white-space:nowrap">Week Labels</th>'
          +'<th style="padding:.35rem .5rem;font-size:.65rem;text-align:center;color:#7c3aed;font-weight:700;border-left:2px solid #ede9fe;background:#f5f3ff;white-space:nowrap">Wks</th>'
          +'<th style="padding:.35rem .5rem;font-size:.65rem;text-align:left;color:#64748b;font-weight:600;background:#f5f3ff;white-space:nowrap">Week Labels</th>'
          +'<th style="padding:.35rem .5rem;font-size:.65rem;text-align:center;color:#64748b;font-weight:600;white-space:nowrap">Scholars</th>'
          +'</tr></thead>'
          +'<tbody>' + rows + '</tbody>'
          +'</table>'
          +'</div>'
          +'</div>'
          +'</details>';
      })();

      el.innerHTML = `<div class="irlab-wrap">
        <div class="irlab-header">
          <div>
            <div class="irlab-eyebrow">Academic Intelligence · NJTC</div>
            <h2 class="irlab-title">iReady Analytics</h2>
            <p class="irlab-sub">${years.join(', ')||'Fetching live data…'} · ${dists.length} districts ${srcBadge}</p>
          </div>
          <div style="display:flex;flex-direction:column;gap:.75rem;align-items:flex-end">
            <div class="irlab-mode-tabs">
              <button class="irlab-mode-tab ${_irlMode==='embedded'?'active':''}" onclick="irlab.setMode('embedded')">📊 Analytics</button>
              ${(()=>{
                const sess = window.NJTC_SESSION;
                const myDept = (sess && sess.dept) ? sess.dept : _irlDept;
                return myDept === 'data'
                  ? `<button class="irlab-mode-tab ${_irlMode==='quickcsv'?'active':''}" onclick="irlab.setMode('quickcsv')">📸 Quick CSV</button>`
                  : '';
              })()}
            </div>
          </div>
        </div>

        ${_irlMode==='quickcsv'
          ? renderQuickCSVMode()
          : `<div class="ecd-outer-grid"><div class="ecd-main-col">${renderAnalyticsMode(hasData, yearOpts, subOpts, distOpts, schoolOpts, gradeOpts, typeOpts, pilotOpts)}${_diagSection}</div>${_irlInsightHTML}</div>`
        }
        ${(()=>{ try { return (typeof impactBuilder!=='undefined') ? impactBuilder.renderSection() : ''; } catch(e){ return ''; } })()}
        ${renderMOYSection()}
        ${renderSMSection()}
      </div>`;

      // Initialize Chart.js charts after HTML is set
      if (_irlMode === 'embedded' && hasData) {
        const pairRows = getRows({});
        const elaAllRows  = getAllRows({subject:'ELA'});
        const mathAllRows = getAllRows({subject:'Math'});
        _initGrowthDistChart(elaAllRows, mathAllRows);
        _initPlacementDistChart(pairRows);
      }
      // Initialize Impact Report Builder charts (if report is generated)
      try { if (typeof impactBuilder !== 'undefined') impactBuilder.postRender(); } catch(e) {}
      // Inject 25-26 preliminary banner and Data-dept suppress toggle
      try { _irlPostRender2526(); } catch(e) {}
    }

    function renderAnalyticsMode(hasData, yearOpts, subOpts, distOpts, schoolOpts, gradeOpts, typeOpts, pilotOpts) {
      const sess    = window.NJTC_SESSION;
      const _sessRawDept = (sess && sess.dept) ? sess.dept : _irlDept;
      // Normalize: shared-utils uses 'training' but DEPT_CFG uses 'training_development'
      const myDept  = _sessRawDept === 'training' ? 'training_development' : _sessRawDept;
      const canSwitch = ['leadership','data'].includes(myDept);
      if (!canSwitch && DEPT_CFG[myDept]) _irlDept = myDept;
      const cfg = DEPT_CFG[_irlDept] || DEPT_CFG.leadership;
      const dataUpdatePanel = myDept === 'data' ? renderDataUpdatePanel() : '';

      if (!hasData) return `
        ${dataUpdatePanel}
        <div class="irlab-card">
          <div class="irlab-empty">
            <div class="irlab-empty-icon">⏳</div>
            <div class="irlab-empty-title">Loading live iReady data…</div>
            <div class="irlab-empty-sub">Fetching ELA, Math, ELA Repeat, Math Repeat from Google Sheets. Usually ready in 3–5 seconds.</div>
          </div>
        </div>`;

      const rows    = getRows({});
      const allELA  = getAllRows({subject:'ELA'});
      const allMath = getAllRows({subject:'Math'});
      const allRows = getAllRows({});
      const m       = rows.length ? computeMetrics(rows) : null;
      const mathM   = getRows({subject:'Math'}).length ? computeMetrics(getRows({subject:'Math'})) : null;
      const elaM    = getRows({subject:'ELA'}).length  ? computeMetrics(getRows({subject:'ELA'}))  : null;

      const activeFilt = [
        _irlYear!=='all'?_irlYear:null, _irlSubject!=='all'?_irlSubject:null,
        _irlDistrict!=='all'?_irlDistrict:null, _irlSchool!=='all'?_irlSchool:null,
        _irlGrade!=='all'?'Grade '+_irlGrade:null, _irlScholarType!=='all'?_irlScholarType:null,
        _irlPilot==='pilot'?'Pilot Only':_irlPilot==='nonpilot'?'Non-Pilot Only':null,
      ].filter(Boolean);
      const totalUnique = [...new Set(allRows.map(r=>r.scholarId||r.scholarName).filter(Boolean))].length;

      // Dept tabs
      const deptTabsHtml = `<div class="irlab-dept-tabs" style="margin-bottom:.875rem">
        ${canSwitch
          ? Object.entries(DEPT_CFG).map(([key,c])=>`<button class="irlab-dept-tab ${_irlDept===key?'active':''}" style="${_irlDept===key?'background:'+c.color+';border-color:'+c.color+';color:#fff':''}" onclick="irlab.setDept('${key}')">${c.emoji} ${c.label}</button>`).join('')
          : `<div style="display:inline-flex;align-items:center;gap:.375rem;padding:.35rem .875rem;background:${cfg.color};border-radius:20px;color:#fff;font-size:.8125rem;font-weight:700">${cfg.emoji} ${cfg.label} View 🔒</div>`
        }
      </div>`;

      // Pre-compute key values — getSummary only covers org-wide year-level data; skip it when
      // district, school, grade, scholarType, or search filters are active so the KPI strip
      // reflects the filtered cohort rather than the full org.
      const _hasNonYearFilter = _irlDistrict !== 'all' || _irlSchool !== 'all' || _irlGrade !== 'all' || _irlScholarType !== 'all' || !!_irlSearch || _irlPilot !== 'all';
      const _irlCtxSum  = _hasNonYearFilter ? null : getSummary(_irlYear !== 'all' ? _irlYear : 'ALL');
      const _elaRaw     = _irlCtxSum ? (_irlYear !== 'all' ? _irlCtxSum.elaMedianPctTypical  : _irlCtxSum.elaMedianPctAllYears)  : null;
      const _mathRaw    = _irlCtxSum ? (_irlYear !== 'all' ? _irlCtxSum.mathMedianPctTypical : _irlCtxSum.mathMedianPctAllYears) : null;
      // getSummary returns integers (100 = 100%); convert to ratio (1.0) to match existing display code
      const elaMedian   = _elaRaw  !== null && _elaRaw  !== undefined ? _elaRaw  / 100 : medianArr(allELA.map(r=>r.pctTypical).filter(v=>v!==null&&!isNaN(v)));
      const mathMedian  = _mathRaw !== null && _mathRaw !== undefined ? _mathRaw / 100 : medianArr(allMath.map(r=>r.pctTypical).filter(v=>v!==null&&!isNaN(v)));
      const elaMeetPct = (()=>{ const t=allELA.map(r=>r.pctTypical).filter(v=>v!==null&&!isNaN(v)); return t.length?pct(t.filter(v=>v>=1.0).length,t.length):null; })();
      const mathMeetPct= (()=>{ const t=allMath.map(r=>r.pctTypical).filter(v=>v!==null&&!isNaN(v)); return t.length?pct(t.filter(v=>v>=1.0).length,t.length):null; })();
      const elaGainAvg = (()=>{ const g=rows.filter(r=>r.subject==='ELA').map(r=>r.springGain).filter(v=>v!==null&&!isNaN(v)); return g.length?avg(g):null; })();
      const mathGainAvg= (()=>{ const g=rows.filter(r=>r.subject==='Math').map(r=>r.springGain).filter(v=>v!==null&&!isNaN(v)); return g.length?avg(g):null; })();
      // Grade level placement (from placement-pair rows)
      const avgBaseGLAll   = m ? m.avgBaseGL   : null;
      const avgSpringGLAll = m ? m.avgSpringGL : null;

      return `
        <!-- ── COMPACT FILTER BAR ── -->
        <div style="background:var(--surface-2);border:1px solid var(--border);border-radius:10px;padding:.625rem .875rem;margin-bottom:.875rem">
          <div style="display:flex;flex-wrap:wrap;gap:.4rem;align-items:center">
            <select class="irlab-select" onchange="irlab.setYear(this.value)">${yearOpts}</select>
            <select class="irlab-select" onchange="irlab.setSubject(this.value)">${subOpts}</select>
            <select class="irlab-select" onchange="irlab.setDistrict(this.value)">${distOpts}</select>
            <select class="irlab-select" onchange="irlab.setSchool(this.value)">${schoolOpts}</select>
            <select class="irlab-select" onchange="irlab.setGrade(this.value)">${gradeOpts}</select>
            <select class="irlab-select" onchange="irlab.setScholarType(this.value)">${typeOpts}</select>
            ${pilotOpts ? `<select class="irlab-select" onchange="irlab.setPilot(this.value)">${pilotOpts}</select>` : ''}
            ${activeFilt.length ? activeFilt.map(f=>`<span style="background:#dbeafe;color:#1e40af;font-size:.68rem;font-weight:700;padding:.15rem .45rem;border-radius:20px">✓ ${esc(f)}</span>`).join('') : ''}
            <span style="font-size:.725rem;color:var(--muted);margin-left:auto"><strong>${totalUnique.toLocaleString()}</strong> scholars · <strong>${rows.length.toLocaleString()}</strong> pairs</span>
          </div>
          <!-- Search bar — persistent across both longitudinal and 25-26 data -->
          <div style="display:flex;align-items:center;gap:.4rem;margin-top:.45rem;padding-top:.45rem;border-top:1px solid var(--border)">
            <span style="font-size:.8rem;color:var(--muted);flex-shrink:0">🔍</span>
            <input type="text" id="irlab-search-input"
                   placeholder="Search by tutor, school, or district…"
                   value="${esc(_irlSearch)}"
                   oninput="irlab.setSearch(this.value)"
                   style="flex:1;border:none;background:transparent;font-size:.8125rem;color:var(--text,#1e293b);outline:none;min-width:0"/>
            ${_irlSearch ? `<button onclick="irlab.setSearch('')" title="Clear search" style="background:none;border:none;cursor:pointer;color:var(--muted);font-size:.75rem;padding:0 .2rem;line-height:1">✕</button>` : ''}
          </div>
          ${myDept === 'data' ? `
          <!-- Export row — Data dept only -->
          <div style="display:flex;align-items:center;gap:.5rem;margin-top:.45rem;padding-top:.45rem;border-top:1px solid var(--border);flex-wrap:wrap">
            <span style="font-size:.725rem;font-weight:700;color:var(--navy);flex-shrink:0">📥 Export data:</span>
            <button onclick="irlab.openExportModal('csv')" title="Choose filters, then download as CSV (opens in Excel, Google Sheets)" style="display:inline-flex;align-items:center;gap:.3rem;padding:.3rem .75rem;background:#fff;border:1.5px solid var(--border);border-radius:7px;font-size:.75rem;font-weight:600;color:var(--navy);cursor:pointer;font-family:inherit">
              📄 CSV
            </button>
            <button onclick="irlab.openExportModal('xlsx')" title="Choose filters, then download an Excel workbook with 6 pre-built summary sheets: raw data, network summary, placement shifts, growth by school/grade/district" style="display:inline-flex;align-items:center;gap:.3rem;padding:.3rem .75rem;background:#fff;border:1.5px solid #16a34a;border-radius:7px;font-size:.75rem;font-weight:600;color:#15803d;cursor:pointer;font-family:inherit">
              📊 XLSX
            </button>
            <button onclick="irlab.downloadHTMLReport()" title="Generate a full NJTC-branded HTML impact report with 4 charts and scholar highlight cards — open in browser then Print → Save as PDF" style="display:inline-flex;align-items:center;gap:.3rem;padding:.3rem .75rem;background:linear-gradient(135deg,#0a2342,#1565c0);border:none;border-radius:7px;font-size:.75rem;font-weight:700;color:#fff;cursor:pointer;font-family:inherit;box-shadow:0 1px 4px rgba(10,35,66,.25)">
              📈 Report
            </button>
            <span style="font-size:.685rem;color:var(--muted)">Current filters applied · ${allRows.length.toLocaleString()} rows · includes Pearl operational data</span>
          </div>` : ''}
        </div>

        ${(function(){
          // ── Pilot spring-only view: pilots have Spring data but no BOY baseline ──
          if (!m && _irlPilot === 'pilot' && allRows.length > 0) {
            const sprRows  = allRows.filter(r => PLACEMENT_ORDER.includes(r.springRelPlacement));
            const pilotGains = allRows.map(r=>r.springGain).filter(v=>v!==null&&!isNaN(v));
            const pilotPcts  = allRows.map(r=>r.pctTypical).filter(v=>v!==null&&!isNaN(v));
            const pilotMedGain = medianArr(pilotGains);
            const pilotMedPct  = medianArr(pilotPcts);
            // ELA growth % (pilot ELA students have iReady-pre-computed pctTypical + pctStretch)
            const _pilotELATyp = allELA.map(r=>r.pctTypical).filter(v=>v!==null&&!isNaN(v)&&v>0);
            const _pilotELAStr = allELA.map(r=>r.pctStretch).filter(v=>v!==null&&!isNaN(v)&&v>0);
            const pilotMedELATyp = medianArr(_pilotELATyp);
            const pilotMedELAStr = medianArr(_pilotELAStr);
            // Math growth % (pilot Math students also have pctTypical + pctStretch)
            const _pilotMathTyp = allMath.map(r=>r.pctTypical).filter(v=>v!==null&&!isNaN(v)&&v>0);
            const _pilotMathStr = allMath.map(r=>r.pctStretch).filter(v=>v!==null&&!isNaN(v)&&v>0);
            const pilotMedMathTyp = medianArr(_pilotMathTyp);
            const pilotMedMathStr = medianArr(_pilotMathStr);
            // Spring placement distribution
            const springDist = {};
            PLACEMENT_ORDER.forEach(p=>{springDist[p]=0;});
            sprRows.forEach(r=>{springDist[r.springRelPlacement]++;});
            const sprTotal = sprRows.length;
            // School × Subject breakdown
            const schoolMap = {};
            allRows.forEach(r=>{
              const k = r.school||'Unknown';
              if(!schoolMap[k]) schoolMap[k]={subj:{},n:0,gains:[],pcts:[]};
              schoolMap[k].n++;
              schoolMap[k].subj[r.subject] = (schoolMap[k].subj[r.subject]||0)+1;
              if(r.springGain!==null&&!isNaN(r.springGain)) schoolMap[k].gains.push(r.springGain);
              if(r.pctTypical!==null&&!isNaN(r.pctTypical)) schoolMap[k].pcts.push(r.pctTypical);
            });
            const schoolRows = Object.entries(schoolMap).sort((a,b)=>b[1].n-a[1].n).map(([nm,d])=>{
              const medG = medianArr(d.gains); const medP = medianArr(d.pcts);
              const subjStr = Object.entries(d.subj).map(([s,n])=>`${s} (${n})`).join(', ');
              return `<tr style="border-bottom:1px solid #f1f5f9">
                <td style="padding:.4rem .5rem;font-size:.7rem;font-weight:600;color:#1e293b">${esc(nm)}</td>
                <td style="padding:.4rem .5rem;font-size:.68rem;color:#64748b;text-align:center">${d.n}</td>
                <td style="padding:.4rem .5rem;font-size:.68rem;color:#64748b">${esc(subjStr)}</td>
                <td style="padding:.4rem .5rem;font-size:.7rem;font-weight:700;color:#0d6e3a;text-align:center">${medG!==null?(medG>=0?'+':'')+medG.toFixed(1):'—'}</td>
                <td style="padding:.4rem .5rem;font-size:.7rem;font-weight:700;color:#1d4ed8;text-align:center">${medP!==null?Math.round(medP*100)+'%':'—'}</td>
              </tr>`;
            }).join('');
            return `
            <div style="background:#fff8e1;border-left:4px solid #f59e0b;border-radius:6px;padding:.75rem 1rem;margin-bottom:.875rem;font-size:.8125rem;color:#92400e;display:flex;align-items:flex-start;gap:.625rem">
              <span style="font-size:1rem;flex-shrink:0">📋</span>
              <span><strong>Spring-only diagnostic data (Pilot Program view).</strong> Pilot sites submit a single Spring assessment — no BOY baseline is available, so BOY→Spring movement metrics cannot be calculated. Showing Spring placement snapshot and available growth metrics below.</span>
            </div>
            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:.625rem;margin-bottom:.875rem">
              ${[
                {v:allRows.length.toLocaleString(), l:'Pilot Scholars', s:'Spring diagnostic', c:'#fff'},
                {v:pilotMedGain!==null?(pilotMedGain>=0?'+':'')+pilotMedGain.toFixed(1)+' pts':'—', l:'Median Scale Gain', s:'Spring diagnostic gain', c:'#34d399'},
                {v:pilotMedELATyp!==null?(pilotMedELATyp*100).toFixed(1)+'%':'—', l:'Median % to Typical (ELA)', s:_pilotELATyp.length+' ELA scholars · iReady pre-computed', c:'#4ade80'},
                {v:pilotMedELAStr!==null?(pilotMedELAStr*100).toFixed(1)+'%':'—', l:'Median % to Stretch (ELA)', s:_pilotELAStr.length+' ELA scholars · iReady pre-computed', c:'#a3e635'},
                {v:pilotMedMathTyp!==null?(pilotMedMathTyp*100).toFixed(1)+'%':'—', l:'Median % to Typical (Math)', s:_pilotMathTyp.length+' Math scholars · iReady pre-computed', c:'#60a5fa'},
                {v:pilotMedMathStr!==null?(pilotMedMathStr*100).toFixed(1)+'%':'—', l:'Median % to Stretch (Math)', s:_pilotMathStr.length+' Math scholars · iReady pre-computed', c:'#93c5fd'},
                {v:sprTotal+' placed', l:'Spring Placement Available', s:PLACEMENT_ORDER.slice(-2).filter(p=>springDist[p]>0).map(p=>pct(springDist[p],sprTotal)+'% '+PLC_SHORT[p]).join(' · ')||'—', c:'#fbbf24'},
              ].map(k=>`<div style="background:rgba(255,255,255,.08);border-radius:8px;padding:.625rem .75rem;border:1px solid rgba(255,255,255,.12);background:var(--surface-2);border:1px solid var(--border)">
                <div style="font-size:1.3rem;font-weight:800;color:${k.c==='#fff'?'var(--navy)':k.c};letter-spacing:-.02em">${k.v}</div>
                <div style="font-size:.65rem;font-weight:700;color:var(--navy);margin:.1rem 0">${k.l}</div>
                <div style="font-size:.6rem;color:var(--muted)">${k.s}</div>
              </div>`).join('')}
            </div>
            ${sprTotal > 0 ? `<div class="irlab-card" style="margin-bottom:.875rem">
              <div class="irlab-card-hd"><div class="irlab-card-title">📊 Spring Placement Distribution</div><div class="irlab-card-meta">${sprTotal} scholars with placement data</div></div>
              <div class="irlab-card-body">
                ${PLACEMENT_ORDER.slice().reverse().map(p=>{
                  const n=springDist[p]; if(!n) return '';
                  const pctVal=pct(n,sprTotal);
                  return `<div style="display:flex;align-items:center;gap:.5rem;margin-bottom:.35rem">
                    <div style="font-size:.7rem;color:var(--text);min-width:170px;font-weight:${n>0?'600':'400'}">${PLC_SHORT[p]}</div>
                    <div style="flex:1;background:#f1f5f9;border-radius:4px;height:14px;overflow:hidden">
                      <div style="height:100%;width:${pctVal}%;background:${PLC[p]};border-radius:4px;min-width:${n>0?'4px':'0'}"></div>
                    </div>
                    <div style="font-size:.7rem;font-weight:700;color:${PLC[p]};min-width:36px;text-align:right">${pctVal}%</div>
                    <div style="font-size:.65rem;color:var(--muted);min-width:28px;text-align:right">n=${n}</div>
                  </div>`;
                }).join('')}
              </div>
            </div>` : ''}
            ${schoolRows ? `<div class="irlab-card">
              <div class="irlab-card-hd"><div class="irlab-card-title">🏫 By School</div></div>
              <div class="irlab-card-body" style="overflow-x:auto">
                <table class="irlab-rank-table">
                  <thead><tr><th>School</th><th style="text-align:center">Scholars</th><th>Subjects</th><th style="text-align:center">Median Gain</th><th style="text-align:center">Median Typical</th></tr></thead>
                  <tbody>${schoolRows}</tbody>
                </table>
              </div>
            </div>` : ''}`;
          }
          if (!m) return `<div class="irlab-card"><div class="irlab-empty"><div class="irlab-empty-icon">🔍</div><div class="irlab-empty-title">No matching records</div><div class="irlab-empty-sub">Try broadening your filters.</div></div></div>`;
          return '';
        })()}

        ${m ? `
        <!-- ── SECTION A: KPI STRIP (2-row compact) ── -->
        <div style="background:linear-gradient(135deg,#0a1628 0%,#1a3a6b 60%,#003087 100%);border-radius:12px;padding:1rem 1.25rem;margin-bottom:.875rem;position:relative;overflow:hidden">
          <div style="position:absolute;inset:0;background:url('data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%22400%22 height=%22200%22><circle cx=%22350%22 cy=%2250%22 r=%22120%22 fill=%22rgba(255,255,255,.03)%22/><circle cx=%2250%22 cy=%22150%22 r=%2280%22 fill=%22rgba(255,255,255,.02)%22/></svg>');background-size:cover;pointer-events:none"></div>
          <div style="position:relative">
            <div style="font-size:.58rem;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:rgba(255,255,255,.45);margin-bottom:.625rem">📊 NJTC · iReady Academic Impact · Live Data</div>
            <div class="irlab-kpi-strip">
              ${(_irlPilot === 'pilot' ? [
                { v: totalUnique.toLocaleString(), l: 'Pilot Scholars', s: rows.length+' valid pairs', c:'#fff' },
                { v: avgSpringGLAll!==null?fmtGradeLevel(avgSpringGLAll):'—', l:'Avg Grade Level (Spring)', s: avgBaseGLAll!==null?'BOY: '+fmtGradeLevel(avgBaseGLAll):'BOY → Spring', c:'#fbbf24' },
                { v: elaGainAvg!==null?(elaGainAvg>=0?'+':'')+elaGainAvg.toFixed(1)+' pts':'—', l:'Avg Scale Gain ELA', s:'spring minus winter score', c:'#34d399' },
                { v: mathGainAvg!==null?(mathGainAvg>=0?'+':'')+mathGainAvg.toFixed(1)+' pts':'—', l:'Avg Scale Gain Math', s:'spring minus winter score', c:'#fdba74' },
                { v: m.pctMoved+'%', l:'Placement Moved Up', s:'improved placement level', c:'#60a5fa' },
                { v:(()=>{ const t=allELA.map(r=>r.pctTypical).filter(v=>v!==null&&!isNaN(v)&&v>0); const med=medianArr(t); return t.length&&med!==null?(med*100).toFixed(1)+'%':'—'; })(), l:'Median % to Typical (ELA)', s:(()=>{ const n=allELA.filter(r=>r.pctTypical!==null&&!isNaN(r.pctTypical)&&r.pctTypical>0).length; return n+' ELA scholar'+(n!==1?'s':''); })(), c:'#4ade80', tip:'Median % Progress to Annual Typical Growth (ELA) · iReady pre-computed · 100% = exactly typical growth norms · >100% = above typical' },
                { v:(()=>{ const t=allELA.map(r=>r.pctStretch).filter(v=>v!==null&&!isNaN(v)&&v>0); const med=medianArr(t); return t.length&&med!==null?(med*100).toFixed(1)+'%':'—'; })(), l:'Median % to Stretch (ELA)', s:(()=>{ const n=allELA.filter(r=>r.pctStretch!==null&&!isNaN(r.pctStretch)&&r.pctStretch>0).length; return n+' ELA scholar'+(n!==1?'s':''); })(), c:'#a3e635', tip:'Median % Progress to Annual Stretch Growth (ELA) · iReady pre-computed · Stretch target is more ambitious than typical growth · values >100% = exceeded stretch goal' },
                { v:(()=>{ const t=allMath.map(r=>r.pctTypical).filter(v=>v!==null&&!isNaN(v)&&v>0); const med=medianArr(t); return t.length&&med!==null?(med*100).toFixed(1)+'%':'—'; })(), l:'Median % to Typical (Math)', s:(()=>{ const n=allMath.filter(r=>r.pctTypical!==null&&!isNaN(r.pctTypical)&&r.pctTypical>0).length; return n+' Math scholar'+(n!==1?'s':''); })(), c:'#60a5fa', tip:'Median % Progress to Annual Typical Growth (Math) · iReady pre-computed · 100% = exactly typical growth norms · >100% = above typical' },
                { v:(()=>{ const t=allMath.map(r=>r.pctStretch).filter(v=>v!==null&&!isNaN(v)&&v>0); const med=medianArr(t); return t.length&&med!==null?(med*100).toFixed(1)+'%':'—'; })(), l:'Median % to Stretch (Math)', s:(()=>{ const n=allMath.filter(r=>r.pctStretch!==null&&!isNaN(r.pctStretch)&&r.pctStretch>0).length; return n+' Math scholar'+(n!==1?'s':''); })(), c:'#93c5fd', tip:'Median % Progress to Annual Stretch Growth (Math) · iReady pre-computed · Stretch target is more ambitious than typical growth · values >100% = exceeded stretch goal' },
              ] : [
                { v: totalUnique.toLocaleString(), l: 'Total Scholars', s: rows.length+' valid pairs', c:'#fff' },
                { v: elaMedian!==null?(elaMedian*100).toFixed(1)+'%':'—', l:'ELA Median Typical Growth', s: allELA.filter(r=>r.pctTypical!==null&&!isNaN(r.pctTypical)).length+' scholars', c:'#4ade80', tip:'Median of spring_pct_progress_typical_growth (iReady col) · 100% = exactly typical growth norms · >100% = above typical · Values come directly from iReady CSV, pre-computed by iReady per scholar' },
                { v: mathMedian!==null?(mathMedian*100).toFixed(1)+'%':'—', l:'Math Median Typical Growth', s: allMath.filter(r=>r.pctTypical!==null&&!isNaN(r.pctTypical)).length+' scholars', c:'#60a5fa', tip:'Median of spring_pct_progress_typical_growth (iReady col) · 100% = exactly typical growth norms · Values come directly from iReady CSV' },
                { v: avgSpringGLAll!==null?fmtGradeLevel(avgSpringGLAll):'—', l:'Avg Grade Level Placement', s: avgBaseGLAll!==null?'BOY: '+fmtGradeLevel(avgBaseGLAll):'Spring (BOY→Spring)', c:'#fbbf24' },
                { v: elaMeetPct!==null?elaMeetPct+'%':'—', l:'% Meeting Typical ELA', s:'≥100% typical growth', c:'#f9a8d4' },
                { v: mathMeetPct!==null?mathMeetPct+'%':'—', l:'% Meeting Typical Math', s:'≥100% typical growth', c:'#a78bfa' },
                { v: elaGainAvg!==null?(elaGainAvg>=0?'+':'')+elaGainAvg.toFixed(1):'—', l:'Avg Scale Gain ELA', s:'scale score points', c:'#34d399' },
                { v: mathGainAvg!==null?(mathGainAvg>=0?'+':'')+mathGainAvg.toFixed(1):'—', l:'Avg Scale Gain Math', s:'scale score points', c:'#fdba74' },
              ]).map(k=>`<div${k.tip?` title="${k.tip.replace(/"/g,"'")}"`:''}>

                <div style="font-family:'DM Serif Display',Georgia,serif;font-size:1.5rem;font-weight:400;color:${k.c};line-height:1.1;margin-bottom:.2rem">${k.v}</div>
                <div style="font-size:.63rem;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:rgba(255,255,255,.65);line-height:1.3">${k.l}${k.tip?`<span style="font-size:.55rem;background:rgba(255,255,255,.15);border-radius:99px;padding:.05rem .25rem;margin-left:.2rem;cursor:help">ⓘ</span>`:''}</div>
                <div style="font-size:.6rem;color:rgba(255,255,255,.35)">${k.s}</div>
              </div>`).join('')}
            </div>
          </div>
        </div>

        <!-- ── DEPT LENS + DEPT INSIGHT (compact) ── -->
        ${deptTabsHtml}
        <div class="irlab-card" style="margin-bottom:.875rem;border-left:4px solid ${cfg.color}">
          <div class="irlab-card-hd" style="background:${cfg.bg||'var(--surface-2)'}">
            <div class="irlab-card-title" style="color:${cfg.color}">${cfg.emoji} ${cfg.label} View</div>
            <div class="irlab-card-meta">${_irlDept==='leadership'?'Program-wide academic outcomes':'Dept insights · '+m.n.toLocaleString()+' scholars'}</div>
          </div>
          <div class="irlab-card-body" style="padding:.875rem">
            ${_irlDept==='leadership' ? renderLeadershipInsights(m, mathM, elaM) : _irlDept==='training_development' ? renderTDInsights(m, mathM, elaM) : renderDeptInsights(m, _irlDept)}
          </div>
        </div>
        ${dataUpdatePanel}

        <!-- ── ROW: MATH vs ELA + PLACEMENT SHIFT (2-col) ── -->
        <div class="irlab-2col">
          <!-- Math vs ELA -->
          <div class="irlab-card" style="margin:0">
            <div class="irlab-card-hd"><div class="irlab-card-title">📐 ELA vs Math</div></div>
            <div class="irlab-card-body" style="padding:.875rem">
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:.75rem">
                ${[{label:'ELA',sc:elaM,color:'#7b2d8b',icon:'📖',aRows:allELA},{label:'Math',sc:mathM,color:'#0050c8',icon:'➗',aRows:allMath}].map(({label,sc,color,icon,aRows})=>{
                  if (!sc) return `<div style="border:1.5px solid ${color}22;border-radius:10px;padding:.875rem;background:${color}07;text-align:center;color:var(--muted);font-size:.75rem">No ${label} data</div>`;
                  const _subjRaw = _irlCtxSum ? (label==='ELA' ? (_irlYear!=='all'?_irlCtxSum.elaMedianPctTypical:_irlCtxSum.elaMedianPctAllYears) : (_irlYear!=='all'?_irlCtxSum.mathMedianPctTypical:_irlCtxSum.mathMedianPctAllYears)) : null;
                  const medT = (_subjRaw!==null&&_subjRaw!==undefined) ? _subjRaw/100 : medianArr(aRows.map(r=>r.pctTypical).filter(v=>v!==null&&!isNaN(v)));
                  const totT = aRows.filter(r=>r.pctTypical!==null&&!isNaN(r.pctTypical));
                  const metT = totT.filter(v=>v.pctTypical>=1.0);
                  return `<div style="border:1.5px solid ${color}33;border-radius:10px;padding:.875rem;background:${color}06">
                    <div style="font-size:.8125rem;font-weight:700;color:${color};margin-bottom:.625rem">${icon} ${label}</div>
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:.4rem;font-size:.75rem">
                      ${_irlPilot === 'pilot' ? (()=>{
                        const _pilTypArr = aRows.map(r=>r.pctTypical).filter(v=>v!==null&&!isNaN(v)&&v>0);
                        const _pilStrArr = aRows.map(r=>r.pctStretch).filter(v=>v!==null&&!isNaN(v)&&v>0);
                        const _pilTypMed = medianArr(_pilTypArr);
                        const _pilStrMed = medianArr(_pilStrArr);
                        const _hasGrowthPct = _pilTypArr.length > 0;
                        return (_hasGrowthPct ? `
                        <div><div style="font-size:1.25rem;font-weight:700;color:#4ade80">${_pilTypMed!==null?(_pilTypMed*100).toFixed(1)+'%':'—'}</div><div style="color:var(--muted);font-size:.65rem">Median % to Typical</div></div>
                        <div><div style="font-size:1.25rem;font-weight:700;color:#fbbf24">${_pilStrMed!==null?(_pilStrMed*100).toFixed(1)+'%':'—'}</div><div style="color:var(--muted);font-size:.65rem">Median % to Stretch</div></div>
                        <div><div style="font-weight:700;color:var(--blue-mid)">${sc.avgGain!==null?(sc.avgGain>=0?'+':'')+sc.avgGain.toFixed(1):'—'}</div><div style="color:var(--muted);font-size:.65rem">Avg Scale Gain</div></div>
                        <div><div style="font-weight:700;color:#0d6e3a">${sc.pctOnGL}%</div><div style="color:var(--muted);font-size:.65rem">At Grade Level</div></div>
                        <div><div style="font-weight:700">${sc.pctMoved}%</div><div style="color:var(--muted);font-size:.65rem">Moved Up</div></div>
                        <div><div style="font-weight:700;color:var(--muted);font-size:.875rem">${fmtGradeLevel(sc.avgSpringGL)}</div><div style="color:var(--muted);font-size:.65rem">Avg GL Placement</div></div>
                        ` : `
                        <div style="grid-column:1/-1;background:#fff8e1;border-radius:4px;padding:.25rem .4rem;font-size:.62rem;color:#92400e;margin-bottom:.2rem">
                          Growth targets not available for first-year programs
                        </div>
                        <div><div style="font-size:1.25rem;font-weight:700;color:var(--blue-mid)">${sc.avgGain!==null?(sc.avgGain>=0?'+':'')+sc.avgGain.toFixed(1):'—'}</div><div style="color:var(--muted);font-size:.65rem">Avg Scale Gain</div></div>
                        <div><div style="font-size:1.25rem;font-weight:700;color:#0d6e3a">${sc.pctOnGL}%</div><div style="color:var(--muted);font-size:.65rem">At Grade Level</div></div>
                        <div><div style="font-weight:700">${sc.pctMoved}%</div><div style="color:var(--muted);font-size:.65rem">Moved Up</div></div>
                        <div><div style="font-weight:700;color:var(--muted);font-size:.875rem">${fmtGradeLevel(sc.avgSpringGL)}</div><div style="color:var(--muted);font-size:.65rem">Avg GL Placement</div></div>
                        `);
                      })() : `
                      <div><div style="font-size:1.25rem;font-weight:700;color:var(--navy)">${medT!==null?(medT*100).toFixed(1)+'%':'—'}</div><div style="color:var(--muted);font-size:.65rem">Median Typical Growth</div></div>
                      <div><div style="font-size:1.25rem;font-weight:700;color:var(--navy)">${totT.length?pct(metT.length,totT.length)+'%':'—'}</div><div style="color:var(--muted);font-size:.65rem">% Meeting Typical</div></div>
                      <div><div style="font-weight:700;color:var(--blue-mid)">${sc.avgGain!==null?(sc.avgGain>=0?'+':'')+sc.avgGain.toFixed(1):'—'}</div><div style="color:var(--muted);font-size:.65rem">Avg Scale Gain</div></div>
                      <div><div style="font-weight:700;color:#0d6e3a">${sc.pctOnGL}%</div><div style="color:var(--muted);font-size:.65rem">At Grade Level</div></div>
                      <div><div style="font-weight:700">${sc.pctMoved}%</div><div style="color:var(--muted);font-size:.65rem">Moved Up</div></div>
                      <div><div style="font-weight:700;color:var(--muted);font-size:.875rem">${fmtGradeLevel(sc.avgSpringGL)}</div><div style="color:var(--muted);font-size:.65rem">Avg GL Placement</div></div>
                      `}
                    </div>
                  </div>`;
                }).join('')}
              </div>
            </div>
          </div>
          <!-- Placement Shift -->
          <div class="irlab-card" style="margin:0">
            <div class="irlab-card-hd"><div class="irlab-card-title">📊 Placement Shift: BOY → Spring</div><div class="irlab-card-meta">${m.n.toLocaleString()} scholars</div></div>
            <div class="irlab-card-body" style="padding:.875rem">
              ${PLACEMENT_ORDER.map(p=>{const b=pct(m.baseDist[p]||0,m.n),s=pct(m.springDist[p]||0,m.n),chg=(m.springDist[p]||0)-(m.baseDist[p]||0);return `<div style="margin-bottom:.5rem">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.2rem">
                  <span style="font-size:.7rem;font-weight:700;color:${PLC[p]}">${PLC_SHORT[p]}</span>
                  <span style="font-size:.65rem;color:${chg<0?'#0d6e3a':chg>0?'#b91c1c':'var(--muted)'};font-weight:600">${chg>0?'+':''}${chg}</span>
                </div>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:.25rem">
                  <div style="background:${PLC[p]}33;border-radius:3px;height:7px;overflow:hidden"><div style="width:${b}%;height:100%;background:${PLC[p]}88"></div></div>
                  <div style="background:${PLC[p]}55;border-radius:3px;height:7px;overflow:hidden"><div style="width:${s}%;height:100%;background:${PLC[p]}"></div></div>
                </div>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:.25rem;font-size:.6rem;color:var(--muted)">
                  <span>BOY ${b}%</span><span>Spring ${s}%</span>
                </div>
              </div>`; }).join('')}
            </div>
          </div>
        </div>

        <!-- ── ROW: CHARTS B + C (side by side) ── -->
        <div class="irlab-2col">
          ${renderGrowthDistChart(rows)}
          ${renderPlacementDistChart()}
        </div>

        <!-- ── SECTION D: BREAKDOWNS (tabbed — School | Grade | District) ── -->
        <div class="irlab-card" style="margin-bottom:.875rem">
          <div class="irlab-card-hd">
            <div class="irlab-card-title">📋 Breakdown Tables</div>
            <div style="display:flex;gap:.375rem;margin-left:auto">
              ${['school','grade','district'].map(t=>`<button onclick="irlab.setBreakdownTab('${t}')" style="font-size:.7rem;padding:.2rem .6rem;border-radius:8px;border:1px solid var(--border);background:${_irlBreakdownTab===t?'var(--navy)':'var(--surface-2)'};color:${_irlBreakdownTab===t?'#fff':'var(--text)'};cursor:pointer;font-weight:${_irlBreakdownTab===t?'700':'500'}">${t==='school'?'🏫 School':t==='grade'?'📚 Grade':'🏆 District'}</button>`).join('')}
            </div>
          </div>
          <div class="irlab-card-body" style="padding:0;overflow:hidden">
            <div style="overflow-x:auto;max-height:320px;overflow-y:auto">
              ${_irlBreakdownTab === 'school' ? `
              <table class="irlab-rank-table" style="font-size:.78rem">
                <thead><tr><th>School</th><th>${_irlPilot==='pilot'?'Median % Typical':'Median Typ. Growth'}</th>${_irlPilot==='pilot'?'':'<th style="text-align:center">% Meet Typ.</th>'}<th style="text-align:center">% Moved Up</th><th style="text-align:center">Avg GL Spring</th><th style="text-align:center">Avg Gain</th><th style="text-align:right">N</th></tr></thead>
                <tbody>${Object.entries(m.bySchool).map(([name,srows])=>{
                  const sm=computeMetrics(srows); if(!sm) return '';
                  const sTyp=_irlPilot==='pilot'
                    ? medianArr(getAllRows({school:name}).map(r=>r.pctTypical).filter(v=>v!==null&&!isNaN(v)&&v>0))
                    : medianArr(getAllRows({school:name}).map(r=>r.pctTypical).filter(v=>v!==null&&!isNaN(v)));
                  const sC=sTyp!==null&&sTyp>=1.0?'#0d6e3a':sTyp!==null?'#b91c1c':'var(--muted)';
                  return {n:sm.n,html:`<tr>
                    <td style="font-weight:600;max-width:160px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(name)}</td>
                    <td><div style="display:flex;align-items:center;gap:.4rem"><div style="width:50px;height:5px;background:var(--border);border-radius:3px;overflow:hidden"><div style="width:${Math.min((sTyp||0)*100,200)/2}%;height:100%;background:${sC};border-radius:3px"></div></div><span style="font-weight:700;color:${sC};font-size:.75rem">${sTyp!==null?(sTyp*100).toFixed(1)+'%':'—'}</span></div></td>
                    ${_irlPilot==='pilot'?'':`<td style="text-align:center"><span style="background:${sm.metTypPct!==null&&sm.metTypPct>=50?'#dcfce7':'#fef3c7'};color:${sm.metTypPct!==null&&sm.metTypPct>=50?'#166534':'#92400e'};padding:.1rem .4rem;border-radius:10px;font-size:.72rem;font-weight:700">${sm.metTypPct!==null?sm.metTypPct+'%':'—'}</span></td>`}
                    <td style="text-align:center;font-weight:700;color:${sm.pctMoved>=50?'#0d6e3a':'#d97706'}">${sm.pctMoved}%</td>
                    <td style="text-align:center;font-size:.75rem;color:var(--blue-mid);font-weight:600">${fmtGradeLevel(sm.avgSpringGL)}</td>
                    <td style="text-align:center;font-weight:600;color:var(--blue-mid)">${sm.avgGain!==null?(sm.avgGain>=0?'+':'')+sm.avgGain.toFixed(1):'—'}</td>
                    <td style="text-align:right;font-size:.7rem;color:var(--muted)">${sm.n}</td>
                  </tr>`};
                }).filter(Boolean).sort((a,b)=>b.n-a.n).map(x=>x.html).join('')}</tbody>
              </table>` : _irlBreakdownTab === 'grade' ? `
              <table class="irlab-rank-table" style="font-size:.78rem">
                <thead><tr><th>Grade</th><th>${_irlPilot==='pilot'?'Median % Typical':'Median Typ. Growth'}</th>${_irlPilot==='pilot'?'':'<th style="text-align:center">% Meet Typ.</th>'}<th style="text-align:center">% Moved Up</th><th style="text-align:center">At GL</th><th style="text-align:center">Avg GL Spring</th><th style="text-align:center">Avg Gain</th><th style="text-align:right">N</th></tr></thead>
                <tbody>${Object.entries(m.byGrade).map(([gr,grows])=>{
                  const gm=computeMetrics(grows); if(!gm) return '';
                  const gTyp=_irlPilot==='pilot'
                    ? medianArr(getAllRows({grade:gr}).map(r=>r.pctTypical).filter(v=>v!==null&&!isNaN(v)&&v>0))
                    : medianArr(getAllRows({grade:gr}).map(r=>r.pctTypical).filter(v=>v!==null&&!isNaN(v)));
                  const gC=gTyp!==null&&gTyp>=1.0?'#0d6e3a':gTyp!==null?'#b91c1c':'var(--muted)';
                  return {num:parseInt(gr)||99,html:`<tr>
                    <td style="font-weight:700">Gr. ${esc(gr)}</td>
                    <td><div style="display:flex;align-items:center;gap:.4rem"><div style="width:50px;height:5px;background:var(--border);border-radius:3px;overflow:hidden"><div style="width:${Math.min((gTyp||0)*100,200)/2}%;height:100%;background:${gC};border-radius:3px"></div></div><span style="font-weight:700;color:${gC};font-size:.75rem">${gTyp!==null?(gTyp*100).toFixed(1)+'%':'—'}</span></div></td>
                    ${_irlPilot==='pilot'?'':`<td style="text-align:center"><span style="background:${gm.metTypPct!==null&&gm.metTypPct>=50?'#dcfce7':'#fef3c7'};color:${gm.metTypPct!==null&&gm.metTypPct>=50?'#166534':'#92400e'};padding:.1rem .4rem;border-radius:10px;font-size:.72rem;font-weight:700">${gm.metTypPct!==null?gm.metTypPct+'%':'—'}</span></td>`}
                    <td style="text-align:center;font-weight:700;color:${gm.pctMoved>=50?'#0d6e3a':'#d97706'}">${gm.pctMoved}%</td>
                    <td style="text-align:center;font-weight:700;color:#0d6e3a">${gm.pctOnGL}%</td>
                    <td style="text-align:center;font-size:.75rem;color:var(--blue-mid);font-weight:600">${fmtGradeLevel(gm.avgSpringGL)}</td>
                    <td style="text-align:center;font-weight:600;color:var(--blue-mid)">${gm.avgGain!==null?(gm.avgGain>=0?'+':'')+gm.avgGain.toFixed(1):'—'}</td>
                    <td style="text-align:right;font-size:.7rem;color:var(--muted)">${gm.n}</td>
                  </tr>`};
                }).filter(Boolean).sort((a,b)=>a.num-b.num).map(x=>x.html).join('')}</tbody>
              </table>` : `
              <table class="irlab-rank-table" style="font-size:.78rem">
                <thead><tr><th>District</th><th>${_irlPilot==='pilot'?'Median % Typical':'Median Typ. Growth'}</th>${_irlPilot==='pilot'?'':'<th style="text-align:center">% Meet Typ.</th>'}<th style="text-align:center">% Moved Up</th><th style="text-align:center">Avg GL Spring</th><th style="text-align:center">Avg Gain</th><th style="text-align:right">N</th></tr></thead>
                <tbody>${Object.entries(m.byDistrict).map(([name,drows])=>{
                  const dm=computeMetrics(drows); if(!dm) return '';
                  const dTyp=_irlPilot==='pilot'
                    ? medianArr(getAllRows({district:name}).map(r=>r.pctTypical).filter(v=>v!==null&&!isNaN(v)&&v>0))
                    : medianArr(getAllRows({district:name}).map(r=>r.pctTypical).filter(v=>v!==null&&!isNaN(v)));
                  const dC=dTyp!==null&&dTyp>=1.0?'#0d6e3a':dTyp!==null?'#b91c1c':'var(--muted)';
                  return {n:dm.n,medT:dTyp||0,html:`<tr>
                    <td style="font-weight:700;color:var(--navy)">${esc(name)}</td>
                    <td><div style="display:flex;align-items:center;gap:.4rem"><div style="width:60px;height:5px;background:var(--border);border-radius:3px;overflow:hidden"><div style="width:${Math.min((dTyp||0)*100,200)/2}%;height:100%;background:${dC};border-radius:3px"></div></div><span style="font-weight:700;color:${dC};font-size:.75rem">${dTyp!==null?(dTyp*100).toFixed(1)+'%':'—'}</span></div></td>
                    ${_irlPilot==='pilot'?'':`<td style="text-align:center"><span style="background:${dm.metTypPct!==null&&dm.metTypPct>=50?'#dcfce7':'#fef3c7'};color:${dm.metTypPct!==null&&dm.metTypPct>=50?'#166534':'#92400e'};padding:.1rem .4rem;border-radius:10px;font-size:.72rem;font-weight:700">${dm.metTypPct!==null?dm.metTypPct+'%':'—'}</span></td>`}
                    <td style="text-align:center;font-weight:700;color:${dm.pctMoved>=50?'#0d6e3a':'#d97706'}">${dm.pctMoved}%</td>
                    <td style="text-align:center;font-size:.75rem;color:var(--blue-mid);font-weight:600">${fmtGradeLevel(dm.avgSpringGL)}</td>
                    <td style="text-align:center;font-weight:600;color:var(--blue-mid)">${dm.avgGain!==null?(dm.avgGain>=0?'+':'')+dm.avgGain.toFixed(1):'—'}</td>
                    <td style="text-align:right;font-size:.7rem;color:var(--muted)">${dm.n}</td>
                  </tr>`};
                }).filter(Boolean).sort((a,b)=>b.n-a.n).map(x=>x.html).join('')}</tbody>
              </table>`}
            </div>
          </div>
        </div>

        <!-- ── ROW: CERT COHORT (full-width, compact 4-across) ── -->
        <div class="irlab-card" style="margin-bottom:.875rem">
          <div class="irlab-card-hd"><div class="irlab-card-title">🎓 Cert Cohort</div><div class="irlab-card-meta">Observational · outcomes by cert status</div></div>
          <div class="irlab-card-body" style="padding:.75rem">
            <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:.5rem">
              ${Object.entries(m.byCert).map(([cert,crows])=>{
                const cm=computeMetrics(crows); if(!cm) return '';
                const cTyp=_irlPilot==='pilot'?null:medianArr(getAllRows({}).filter(r=>r.certStatus===cert).map(r=>r.pctTypical).filter(v=>v!==null&&!isNaN(v)));
                const cols={'Certified':'#0d6e3a','Non Certified':'#0050c8','Mixed Cert Status':'#7b2d8b','Unidentified':'#7d8fa1'};
                const col=cols[cert]||'#7d8fa1';
                return `<div style="border:1.5px solid ${col}33;border-radius:8px;padding:.625rem;background:${col}07">
                  <div style="font-size:.7rem;font-weight:700;color:${col};margin-bottom:.25rem">${esc(cert)}</div>
                  ${_irlPilot==='pilot'
                    ? `<div style="font-size:1.25rem;font-weight:700;color:var(--blue-mid)">${cm.avgGain!==null?(cm.avgGain>=0?'+':'')+cm.avgGain.toFixed(1)+' pts':'—'}</div>
                  <div style="font-size:.6rem;color:var(--muted)">Avg Scale Gain</div>`
                    : `<div style="font-size:1.25rem;font-weight:700;color:var(--navy)">${cTyp!==null?(cTyp*100).toFixed(0)+'%':'—'}</div>
                  <div style="font-size:.6rem;color:var(--muted)">Median Typical Growth</div>`}
                  <div style="font-size:.7rem;margin-top:.35rem;color:var(--text-2)">Moved up: <strong>${cm.pctMoved}%</strong> · At GL: <strong>${cm.pctOnGL}%</strong></div>
                  <div style="font-size:.65rem;color:var(--muted)">N = ${cm.n}</div>
                </div>`;
              }).join('')}
            </div>
          </div>
        </div>

        <!-- ── ROW: EQUITY SNAPSHOT (full-width) ── -->
        ${renderEquitySnapshot(m)}

        <!-- ── TUTOR LEADERBOARD ── -->
        ${_irlDept !== 'data' ? renderTutorLeaderboard(m, _irlDept) : ''}

        <!-- ── SECTIONS E + F + G: LONGITUDINAL + DOMAINS (tabbed) ── -->
        <div class="irlab-card" style="margin-bottom:.875rem">
          <div class="irlab-card-hd">
            <div class="irlab-card-title">🔬 Deep Dive</div>
            <div style="display:flex;gap:.375rem;margin-left:auto">
              ${['domains','repeat'].map(t=>`<button onclick="irlab.setDeepTab('${t}')" style="font-size:.7rem;padding:.2rem .6rem;border-radius:8px;border:1px solid var(--border);background:${_irlDeepTab===t?'var(--navy)':'var(--surface-2)'};color:${_irlDeepTab===t?'#fff':'var(--text)'};cursor:pointer;font-weight:${_irlDeepTab===t?'700':'500'}">${t==='domains'?'📊 Domain Subscores':'🔄 Repeat Scholars'}</button>`).join('')}
            </div>
          </div>
          <div class="irlab-card-body" style="padding:.875rem">
            ${_irlDeepTab === 'repeat' ? renderRepeatLongitudinal() : `
            ${_irlPilot === 'pilot' ? `
            <div style="background:#fff8e1;border-left:4px solid #f59e0b;border-radius:6px;padding:.75rem 1rem;font-size:.8125rem;color:#92400e;display:flex;align-items:flex-start;gap:.625rem">
              <span style="font-size:1rem;flex-shrink:0">ℹ️</span>
              <span><strong>Domain subscores not available for Pilot Programs.</strong> Pilot sites provide Overall Relative Placement and Scale Score data only — individual domain breakdowns (Phonological Awareness, Phonics, Number &amp; Operations, Algebra, etc.) are not included in the Pilot Program extract. Switch to <em>Non-Pilot Only</em> or <em>All Programs</em> to view domain data.</span>
            </div>` : `
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:1.25rem">
              <div style="min-width:0">${renderELADomainSubscores(rows)}</div>
              <div style="min-width:0">${renderMathDomainSubscores(rows)}</div>
            </div>`}`}
          </div>
        </div>

        ` : ''}
      `;
    }

    // Leadership-specific insight block (replaces old renderLeadershipView dept section)
    function renderLeadershipInsights(m, mathM, elaM) {
      if (!m) return '';
      const dists = Object.entries(m.byDistrict).map(([name,drows])=>{
        const dm=computeMetrics(drows);
        if (!dm) return null;
        const dTyp = medianArr(getAllRows({district:name}).map(r=>r.pctTypical).filter(v=>v!==null&&!isNaN(v)));
        return {name, ...dm, medianTyp:dTyp};
      }).filter(Boolean).sort((a,b)=>(b.medianTyp||0)-(a.medianTyp||0));

      const stars = dists.slice(0,3).map(d=>`<div style="display:flex;align-items:center;gap:.625rem;padding:.5rem .875rem;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;margin-bottom:.375rem">
        <span>⭐</span><div><div style="font-weight:700;color:#166534;font-size:.875rem">${esc(d.name)}</div>
        <div style="font-size:.75rem;color:#166534">${d.medianTyp!==null?(d.medianTyp*100).toFixed(0)+'% median growth · ':''}${d.pctMoved}% moved up · +${d.avgGain?.toFixed(1)||'—'} avg gain</div></div></div>`).join('');
      const watch = dists.slice(-Math.min(2,dists.length)).reverse().map(d=>`<div style="display:flex;align-items:center;gap:.625rem;padding:.5rem .875rem;background:#fef2f2;border:1px solid #fecaca;border-radius:8px;margin-bottom:.375rem">
        <span>🔍</span><div><div style="font-weight:700;color:#991b1b;font-size:.875rem">${esc(d.name)}</div>
        <div style="font-size:.75rem;color:#991b1b">${d.medianTyp!==null?(d.medianTyp*100).toFixed(0)+'% median growth · ':''}${d.n} scholars</div></div></div>`).join('');

      // Talking points with live numbers
      const pts = [
        m.pctMoved + '% of assessed scholars — ' + m.moved.length.toLocaleString() + ' students — improved their i-Ready placement from BOY to spring.',
        m.pctOnGL + '% reached Early On Grade Level or above (' + m.sprOnGL.length.toLocaleString() + ' scholars).',
        m.avgGain !== null ? 'Average scale score gain: +' + m.avgGain.toFixed(1) + ' points across the full portfolio.' : null,
        m.below2Chg < 0 ? Math.abs(m.below2Chg) + ' scholars moved out of the 2+ grade levels below tier — a direct equity impact.' : null,
        dists.length ? dists[0].name + ' led all districts with ' + (dists[0].medianTyp!==null?(dists[0].medianTyp*100).toFixed(0)+'% median typical growth':'—') + '.' : null,
      ].filter(Boolean);

      return `<div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;margin-bottom:1rem">
        <div>
          <div style="font-size:.6875rem;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:var(--muted);margin-bottom:.5rem">⭐ Standout Districts</div>
          ${stars || '<div style="color:var(--muted);font-size:.875rem">Insufficient data</div>'}
        </div>
        <div>
          <div style="font-size:.6875rem;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:var(--muted);margin-bottom:.5rem">🔍 Needs Attention</div>
          ${watch || '<div style="color:var(--muted);font-size:.875rem">All districts performing well</div>'}
        </div>
      </div>
      <div style="font-size:.6875rem;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:var(--muted);margin-bottom:.5rem">📋 Ready-to-Use Talking Points</div>
      ${pts.map((pt,i)=>`<div style="display:flex;align-items:flex-start;gap:.75rem;padding:.625rem .875rem;background:${i%2===0?'var(--surface-2)':'var(--surface)'};border-radius:8px;border:1px solid var(--border-2);margin-bottom:.375rem">
        <div style="width:22px;height:22px;border-radius:50%;background:var(--navy);color:#fff;display:flex;align-items:center;justify-content:center;font-size:.6875rem;font-weight:700;flex-shrink:0">${i+1}</div>
        <div style="font-size:.875rem;line-height:1.5;color:var(--navy)">${pt}</div>
      </div>`).join('')}`;
    }

    // ── TRAINING & DEVELOPMENT VIEW ──────────────────────────────────────────
    // Purpose: surfaces where T&D coaches should go (district-first) and what
    // they should train on (subject content + grade band), always from live data.
    function renderTDInsights(m, mathM, elaM) {
      if (!m) return renderDeptInsights(m, 'training_development');

      // ── Per-district coaching metrics (sorted worst-first) ────────────────
      const dists = Object.entries(m.byDistrict).map(([name, drows]) => {
        const dm     = computeMetrics(drows); if (!dm) return null;
        const dmMath = computeMetrics(drows.filter(r => r.subject === 'Math'));
        const dmELA  = computeMetrics(drows.filter(r => r.subject === 'ELA'));
        const dTyp   = medianArr(getAllRows({district: name}).map(r => r.pctTypical).filter(v => v !== null && !isNaN(v)));
        return { name, ...dm, mathPct: dmMath ? dmMath.pctMoved : null, elaPct: dmELA ? dmELA.pctMoved : null, medianTyp: dTyp };
      }).filter(Boolean).sort((a, b) => (a.pctMoved || 0) - (b.pctMoved || 0)); // worst first

      // ── Grade-band cards ──────────────────────────────────────────────────
      const BANDS = [
        {label:'K–2', gr:['K','1','2']},
        {label:'3–5', gr:['3','4','5']},
        {label:'6–8', gr:['6','7','8']},
        {label:'9–12',gr:['9','10','11','12']},
      ];
      const bandCards = BANDS.map(band => {
        const bRows = Object.entries(m.byGrade)
          .filter(([g]) => band.gr.includes(String(g)))
          .flatMap(([, r]) => r);
        const bm = bRows.length ? computeMetrics(bRows) : null;
        if (!bm) return `<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:.75rem;text-align:center;color:#94a3b8;font-size:.72rem">${band.label}<br>No data</div>`;
        const clr = bm.pctMoved >= 65 ? '#059669' : bm.pctMoved >= 50 ? '#d97706' : '#dc2626';
        const lbl = bm.pctMoved >= 65 ? 'On Track' : bm.pctMoved >= 50 ? 'Monitor' : 'Priority';
        return `<div style="background:#fff;border:1.5px solid ${clr}30;border-radius:10px;padding:.75rem;text-align:center">
          <div style="font-size:.65rem;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:${clr};margin-bottom:.25rem">${band.label}</div>
          <div style="font-size:1.5rem;font-weight:700;color:${clr};line-height:1.1">${bm.pctMoved}%</div>
          <div style="font-size:.6rem;color:#94a3b8;margin:.15rem 0">moved · ${bm.n} scholars</div>
          <div style="display:inline-block;font-size:.6rem;font-weight:700;padding:.1rem .4rem;border-radius:999px;color:${clr};background:${clr}18">${lbl}</div>
        </div>`;
      }).join('');

      // ── Subject focus callout ─────────────────────────────────────────────
      const mathPct = mathM ? mathM.pctMoved : null;
      const elaPct  = elaM  ? elaM.pctMoved  : null;
      let subjectCallout = '';
      if (mathPct !== null && elaPct !== null) {
        const weaker = mathPct < elaPct ? 'Math' : 'ELA';
        const gap    = Math.abs(mathPct - elaPct);
        subjectCallout = `<div style="margin-top:.625rem;padding:.5rem .875rem;background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;font-size:.8rem;color:#1e40af">
          📌 <strong>${weaker} is the coaching priority this period</strong> — ${gap}pp behind the stronger subject
          (Math: ${mathPct}% moved · ELA: ${elaPct}% moved). Focus next PD cycle on
          <strong>${weaker} instructional strategies</strong> and domain fluency for tutors.
        </div>`;
      }

      return `
        <!-- T&D insight cards (framed around coaching action) -->
        ${renderDeptInsights(m, 'training_development')}

        <!-- District Coaching Priority Grid -->
        ${dists.length > 1 ? `<div style="margin-top:.875rem">
          <div style="font-size:.6875rem;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:#475569;margin-bottom:.5rem">📍 District Coaching Priority — Sorted by Need</div>
          <div style="overflow-x:auto;border-radius:10px;border:1px solid #e2e8f0">
            <table style="width:100%;border-collapse:collapse;font-size:.8rem">
              <thead><tr style="background:#f8fafc">
                <th style="text-align:left;padding:.4rem .75rem;font-size:.6rem;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.04em">District</th>
                <th style="text-align:center;padding:.4rem .4rem;font-size:.6rem;font-weight:700;color:#64748b;text-transform:uppercase">#</th>
                <th style="text-align:center;padding:.4rem .4rem;font-size:.6rem;font-weight:700;color:#0050c8;text-transform:uppercase">Math%</th>
                <th style="text-align:center;padding:.4rem .4rem;font-size:.6rem;font-weight:700;color:#7b2d8b;text-transform:uppercase">ELA%</th>
                <th style="text-align:center;padding:.4rem .4rem;font-size:.6rem;font-weight:700;color:#d97706;text-transform:uppercase">Typical Growth</th>
                <th style="text-align:center;padding:.4rem .4rem;font-size:.6rem;font-weight:700;color:#dc2626;text-transform:uppercase">Regress</th>
                <th style="text-align:center;padding:.4rem .75rem;font-size:.6rem;font-weight:700;color:#64748b;text-transform:uppercase">T&amp;D Priority</th>
              </tr></thead>
              <tbody>
                ${dists.map(d => {
                  const pm    = d.pctMoved;
                  const pri   = pm < 40 ? 'Urgent' : pm < 55 ? 'High' : pm < 70 ? 'Monitor' : 'On Track';
                  const pClr  = pri==='Urgent'?'#dc2626':pri==='High'?'#d97706':pri==='Monitor'?'#0369a1':'#059669';
                  const pBg   = pri==='Urgent'?'#fef2f2':pri==='High'?'#fffbeb':pri==='Monitor'?'#eff6ff':'#f0fdf4';
                  const mClr  = d.mathPct!==null?(d.mathPct<50?'#dc2626':d.mathPct<65?'#d97706':'#059669'):'#94a3b8';
                  const eClr  = d.elaPct !==null?(d.elaPct <50?'#dc2626':d.elaPct <65?'#d97706':'#059669'):'#94a3b8';
                  const tClr  = d.medianTyp!==null?(d.medianTyp<0.7?'#dc2626':d.medianTyp<1.0?'#d97706':'#059669'):'#94a3b8';
                  const regN  = d.regress ? d.regress.length : 0;
                  return `<tr style="border-bottom:1px solid #f1f5f9">
                    <td style="padding:.45rem .75rem;font-weight:600;color:#1e293b;max-width:180px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis" title="${esc(d.name)}">${esc(d.name)}</td>
                    <td style="padding:.45rem .4rem;text-align:center;color:#64748b;font-size:.75rem">${d.n}</td>
                    <td style="padding:.45rem .4rem;text-align:center;font-weight:700;color:${mClr}">${d.mathPct!==null?d.mathPct+'%':'—'}</td>
                    <td style="padding:.45rem .4rem;text-align:center;font-weight:700;color:${eClr}">${d.elaPct!==null?d.elaPct+'%':'—'}</td>
                    <td style="padding:.45rem .4rem;text-align:center;font-weight:700;color:${tClr}">${d.medianTyp!==null?(d.medianTyp*100).toFixed(0)+'%':'—'}</td>
                    <td style="padding:.45rem .4rem;text-align:center;font-weight:${regN>0?'700':'400'};color:${regN>0?'#dc2626':'#94a3b8'}">${regN>0?regN:'—'}</td>
                    <td style="padding:.45rem .75rem;text-align:center"><span style="font-size:.65rem;font-weight:700;padding:.15rem .5rem;border-radius:999px;color:${pClr};background:${pBg}">${pri}</span></td>
                  </tr>`;
                }).join('')}
              </tbody>
            </table>
          </div>
        </div>` : ''}

        <!-- Grade-Band Coaching Focus -->
        <div style="margin-top:.875rem">
          <div style="font-size:.6875rem;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:#475569;margin-bottom:.5rem">📐 Grade-Band Coaching Focus</div>
          <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:.5rem">${bandCards}</div>
          ${subjectCallout}
        </div>`;
    }

    // ════════════════════════════════════════════════════════════════
    //  MOY (MID-YEAR) iREADY MODULE
    //  Fetches Winter diagnostic CSVs from the live Google Sheet.
    //  Each row contains BOTH a Fall (base_) and Winter diagnostic.
    //  Uses same irlab infrastructure: parseCSV, normalizeRow patterns,
    //  medianArr, pct, PLACEMENT_ORDER, PLC, esc helpers.
    // ════════════════════════════════════════════════════════════════

    const MOY_SHEET_ID  = '1AIMqvTRrZ-XBf_-ePzVnGaPExFU3DfdPg_1sPj33RnI';
    const MOY_MATH_GID  = '186448147';
    const MOY_ELA_GID   = '912997533';
    const MOY_2PACX     = '2PACX-1vQCMey9qbjXf7CFNbK-8Fq-qA0nn-DURIlOVjwQ-U1OwHxSo4PRVOy7eLs0w9JHGtBFwgQTzCqy_sMm';
    const MOY_MATH_URL  = `https://docs.google.com/spreadsheets/d/e/${MOY_2PACX}/pub?output=csv&gid=${MOY_MATH_GID}`;
    const MOY_ELA_URL   = `https://docs.google.com/spreadsheets/d/e/${MOY_2PACX}/pub?output=csv&gid=${MOY_ELA_GID}`;
    const MOY_CACHE_KEY = 'njtc_moy_live_v3'; // v3 — bumped to re-fetch with fixed winterWeeks column lookup
    const MOY_CACHE_TTL = 2 * 60 * 60 * 1000; // 2 hours — matches EOY cache

    // ── Authoritative school → region map (built from actual MOY data, all 33 schools) ──
    // School name is the most reliable signal — used first before keyword/prefix fallback.
    // nj-theco spans BOTH regions (Hoboken/Central Jersey = NE; Penns Grove/Gloucester = SW)
    // so prefix alone cannot determine region for those schools.
    const MOY_SCHOOL_REGION = {
      // NE — iLearn Charter Network (nj-ilear9963)
      'bergen ascs elementary':                                 'NE',
      'bergen middle school':                                   'NE',
      'clifton high':                                           'NE',
      'hudson ascs elementary':                                 'NE',
      'hudson middle school':                                   'NE',
      'passaic clifton elementary':                             'NE',
      'passaic clifton middle':                                 'NE',
      'passaic elementary':                                     'NE',
      'passaic middle':                                         'NE',
      'paterson arts and science charter school elementary':    'NE',
      'paterson arts and science charter school middle':        'NE',
      'paterson silk city primary':                             'NE',
      'ilearn paterson silk city':                              'NE',  // iReady alternate label for same school
      // NE — The Co (nj-theco8038) Hoboken + Central Jersey sites
      'hoboken dual language charter elementary school':        'NE',
      'hoboken dual language charter middle school':            'NE',
      'central jersey college prep':                            'NE',
      // SW — The Co (nj-theco8038) Penns Grove + Gloucester sites
      'gloucester-loring flemming elementary':                  'SW',
      'penns grove field street elementary school':             'SW',
      'penns grove middle school':                              'SW',
      'penns grove paul w carleton elementary school':          'SW',
      // SW — Hamilton Township (nj-hamil4497)
      'greenwood elementary school':                            'SW',
      'kuser elementary school':                                'SW',
      'crockett middle school':                                 'SW',
      'grice middle school':                                    'SW',
      'klockner elementary school':                             'SW',
      'wilson elementary school':                               'SW',
      // SW — Pennsauken (nj-penns9072)
      'field street elementary school':                         'SW',
      'paul w carleton elem school':                            'SW',
      // SW — Haddon Township (nj-haddo6593)
      'clyde s jennings elem school':                           'SW',
      'stoy elementary school':                                 'SW',
      'strawbridge elementary school':                          'SW',
      'thomas a edison elem school':                            'SW',
      'van sciver elementary school':                           'SW',
      // SW — First Philadelphia / American Paradigm (pa-newje1899)
      'american paradigm first philadelphia preparatory charter school': 'SW',
      'first philadelphia preparatory charter school':          'SW',
    };

    // ── Pearl → iReady school name crossref ──────────────────────────────────
    // Pearl names schools as "LEA - iLearn [City] ES/MS/HS".
    // iReady uses descriptive names that don't match. This map bridges the gap
    // so schoolIndex and schoolOpsMap can be joined from both sides.
    // Keys = Pearl school name (lowercase). Values = iReady school name (lowercase).
    const PEARL_SCHOOL_CROSSREF = {
      // iLearn Charter Network — NE
      'lea - ilearn bergen es':          'bergen ascs elementary',
      'lea - ilearn bergen ms':          'bergen middle school',
      'lea - ilearn clifton es':         'passaic clifton elementary',
      'lea - ilearn clifton ms':         'passaic clifton middle',
      'lea - ilearn clifton hs':         'clifton high',
      'lea - ilearn hudson es':          'hudson ascs elementary',
      'lea - ilearn hudson ms':          'hudson middle school',
      'lea - ilearn passaic es':         'passaic elementary',
      'lea - ilearn passaic ms':         'passaic middle',
      'lea - ilearn paterson es':        'paterson arts and science charter school elementary',
      'lea - ilearn paterson ms':        'paterson arts and science charter school middle',
      'lea - ilearn paterson':           'paterson arts and science charter school elementary',  // legacy/no-level suffix = ASCS ES
      // Paterson Silk City — Pearl uses "LEA - iLearn Paterson Silk City"; iReady uses "Paterson Silk City Primary"
      'lea - ilearn paterson silk city': 'paterson silk city primary',
      'lea - ilearn paterson silk city es': 'paterson silk city primary',
      // Also handle without "lea - " prefix if Pearl shortens it
      'ilearn bergen es':                'bergen ascs elementary',
      'ilearn bergen ms':                'bergen middle school',
      'ilearn clifton es':               'passaic clifton elementary',
      'ilearn clifton ms':               'passaic clifton middle',
      'ilearn clifton hs':               'clifton high',
      'ilearn hudson es':                'hudson ascs elementary',
      'ilearn hudson ms':                'hudson middle school',
      'ilearn passaic es':               'passaic elementary',
      'ilearn passaic ms':               'passaic middle',
      'ilearn paterson es':              'paterson arts and science charter school elementary',
      'ilearn paterson ms':              'paterson arts and science charter school middle',
      'ilearn paterson':                 'paterson arts and science charter school elementary',
      'ilearn paterson silk city':       'paterson silk city primary',
      'ilearn paterson silk city es':    'paterson silk city primary',
      'paterson silk city':              'paterson silk city primary',  // Pearl short-form
      // The Co — SW sites (if Pearl uses LEA prefix for these too)
      'lea - theco gloucester':          'gloucester-loring flemming elementary',
      'lea - theco penns grove es':      'penns grove field street elementary school',
      'lea - theco penns grove ms':      'penns grove middle school',
      'lea - theco penns grove carleton':'penns grove paul w carleton elementary school',
    };
    // Reverse crossref (iReady → Pearl) for lookups in both directions
    const IREADY_TO_PEARL_SCHOOL = {};
    Object.entries(PEARL_SCHOOL_CROSSREF).forEach(([p,i]) => { if (!IREADY_TO_PEARL_SCHOOL[i]) IREADY_TO_PEARL_SCHOOL[i] = p; });

    // Broad keyword lists — fallback when school name is not in the lookup above
    const MOY_NE_KW = ['ilearn','i-learn','paterson','pcsst','paterson charter','hoboken','middlesex','central jersey','bergen'];
    const MOY_SW_KW = ['american paradigm','first philadelphia','first philly','philadelphia charter',
      'string theory','global leadership','penns grove','pennsauken','carneys point','haddon township','haddon',
      'hamilton township','gloucester township','gloucester','loring flemming','salem','lawrence','slackwood'];
    const MOY_SW_SC = ['erial','field street','penns grove middle','van sciver',
      'strawbridge','first philadelphia prep','first philly prep','global leadership academy',
      'kuser','mercerville','john fenwick','fenwick','salem middle','stoy','jennings'];

    function _moySchoolRegion(school, extId) {
      const s = (school  || '').toLowerCase().trim();
      const e = (extId   || '').toLowerCase().trim();

      // 1. Exact school name lookup (highest confidence — covers all 33 known schools)
      if (MOY_SCHOOL_REGION[s]) return MOY_SCHOOL_REGION[s];

      // 2. Partial match against the lookup table (handles minor name variations)
      for (const [knownSchool, region] of Object.entries(MOY_SCHOOL_REGION)) {
        if (s.length > 6 && knownSchool.length > 6) {
          if (s.includes(knownSchool) || knownSchool.includes(s)) return region;
        }
      }

      // 3. Keyword scan — school name then external_account_id
      for (const kw of MOY_NE_KW) { if (s.includes(kw) || e.includes(kw)) return 'NE'; }
      for (const kw of MOY_SW_KW) { if (s.includes(kw) || e.includes(kw)) return 'SW'; }
      for (const kw of MOY_SW_SC) { if (s.includes(kw)) return 'SW'; }

      // 4. Prefix fallback — nj-theco without a school match defaults NE
      //    (Hoboken + Central Jersey are the majority of The Co scholars)
      if (e.startsWith('nj-ilear')) return 'NE';
      if (e.startsWith('nj-hamil') || e.startsWith('nj-penns') || e.startsWith('nj-haddo') || e.startsWith('pa-')) return 'SW';
      return 'NE'; // default NE (iLearn, Paterson, Hoboken networks)
    }

    // ── Operational data join engine ──────────────────────────────────────────
    // Joins MOY academic rows to Pearl _attRows + _sessRows via student_id (primary)
    // or scholar name (fallback). Returns per-scholar operational context.
    // Also builds tutor survey map from _instRows and scholar survey map from _stuRows.
    function _moyBuildOperationalMap(moyRows) {
      const attRows  = (window.po && typeof window.po.getAttRows  === 'function') ? window.po.getAttRows()  : [];
      const sessRows = (window.po && typeof window.po.getSessRows === 'function') ? window.po.getSessRows() : [];
      const instRows = (window.po && typeof window.po.getInstRows === 'function') ? window.po.getInstRows() : [];
      const stuRows  = (window.po && typeof window.po.getStuRows  === 'function') ? window.po.getStuRows()  : [];
      if (!attRows.length && !sessRows.length) return null;

      const ATT_USER_ID = 13, ATT_USER = 0, ATT_ROLE = 1, ATT_ATT_STATUS = 6,
            ATT_MISS_REASON = 7, ATT_SCHOOL = 11, ATT_DISTRICT = 12;
      const SESS_INSTRUCTOR = 1, SESS_STUDENTS = 2, SESS_STU_IDS = 16,
            SESS_SUBJECT = 9, SESS_ACTUAL_DUR = 8, SESS_STATUS = 4, SESS_INST_ID = 15,
            SESS_SCHOOL = 11;
      // Survey column indices — mirrors programming.js STU_S / INST_S constants
      const STU_FILLED_BY_ID = 12, STU_OVERALL = 5, STU_CONF = 2, STU_ENJOY = 3, STU_LEARN = 4;
      const STU_SCHOOL = 8, STU_DISTRICT = 9, STU_REGION = 10;
      const INST_FILLED_BY_ID = 12, INST_FILLED_BY = 0,
            INST_OVERALL = 5, INST_ENGAGE = 2, INST_ENJOY = 3, INST_LEARN = 4;
      const INST_SCHOOL = 9, INST_DISTRICT = 10;

      // ── Attendance classification — mirrors classifyRecord() in programming.js ─
      // ATT_STATUS is ALWAYS "Attended", "Late", "Missed", or "Not recorded".
      // It is NEVER "service interruption". SIs are ATT_STATUS="Missed" with a
      // reason that is NOT a scholar-caused miss (not in SCHOLAR_MISS_REASONS).

      // Scholar-caused misses (count against scholar; matches programming.js SCHOLAR_MISS_REASONS)
      const SCHOLAR_MISS_REASONS = new Set([
        'Absent',
        'Scholar declined attending tutoring session',
        'Classroom Teacher Requested to Keep Scholar in Class',
        'HADDON TWP ONLY -- Teacher requested whole group support',
        'Scholar Left Early',
      ]);
      // Classroom Teacher pull-out reasons (subset of SCHOLAR_MISS_REASONS — tracked separately)
      const CT_PULL_REASONS = new Set([
        'Classroom Teacher Requested to Keep Scholar in Class',
        'HADDON TWP ONLY -- Teacher requested whole group support',
      ]);

      // Tutor-caused SIs (staffing/coverage failures — matches Pearl MISS_REASON values)
      const SI_TUTOR = new Set([
        'Tutor Vacancy',                                   // HIGH — staffing gap
        'NJTC Internal Issue/Error',                       // CRITICAL
        // Legacy/alternate Pearl values
        'Absent; Not Covered (Tutor not available)',
        'Absent; Covered by Sub Tutor',
        'Absent; Covered by Dual Role',
        'Absent; Covered by the Site Leader',
        'Absent; Covered by the Instructional Coach',
        'Tutor Left Early (no sub)',
        'Instructor no-show','Instructor cancelled','Tutor no show','Tutor no-show',
        'No Tutor Coverage','Tutor Absent','Tutor absent','Tutor absent - excused',
        'Tutor absent - unexcused','Tutor left early','Coverage Issue','No Coverage',
        'Tutor No Show','Tutor Cancel',
      ]);
      // School/site-caused SIs (facility, testing, scheduling — matches Pearl SI_SEVERITY keys)
      const SI_SCHOOL = new Set([
        'Unscheduled School Closure/Delay/Dismissal',      // HIGH
        'Scholar Archived - Removed from Sessions',        // HIGH
        'NJTC Diagnostic Testing',                         // MEDIUM
        'School-administered Testing',                     // MEDIUM
        'School Event',                                    // MEDIUM
        'Scheduled/Unscheduled School Drill',              // MEDIUM
        'HADDON TWP ONLY -- Program Redevelopment',        // MEDIUM
        'Half Day',                                        // LOW
        'Holiday - scheduled',                             // LOW
        // Legacy/alternate values
        'School closed','Site closed','School event','No School / Holiday',
        'No School','Testing / Assessment','Standardized Testing','Testing',
        'Standardized testing','District event','School holiday','Snow day',
        'Emergency closure','Field Trip','School Assembly','Early Dismissal',
        'School Cancelled','Site Cancelled',
      ]);

      // Classify a single ATT row (student role only)
      // Returns: 'attended' | 'absent' | 'service_interruption' | 'other'
      function _classifyAttRow(attStatus, missReason) {
        if (attStatus === 'Attended' || attStatus === 'Late') return 'attended';
        if (attStatus === 'Missed') {
          // Scholar-caused: blank reason also counts as absent (unknown = missed)
          return (SCHOLAR_MISS_REASONS.has(missReason) || missReason === '')
                 ? 'absent' : 'service_interruption';
        }
        return 'other';
      }

      // ── Scholar map (keyed by Pearl UID or normalized name) ───────────────
      const scholarMap  = {};   // uid/name → profile
      const schoolIndex = {};   // schoolName(lower) → Set<scholarKeys>
      const tutorScholarMap = {};

      attRows.forEach(r => {
        if ((r[ATT_ROLE] || '') !== 'Student') return;
        const uid  = r[ATT_USER_ID] || '';
        const name = (r[ATT_USER]   || '').trim().toLowerCase();
        const key  = uid || name;
        if (!key) return;
        if (!scholarMap[key]) scholarMap[key] = {
          uid, name: r[ATT_USER] || '',
          attended: 0, absent: 0, ctPulls: 0, siCount: 0,
          siTutor: 0, siSchool: 0, siOther: 0,
          missReasons: {}, tutors: new Set(),
          minutesBySubject: { Math: 0, ELA: 0 },
          surveyScores: [],
        };

        // School-scoped index for fuzzy name matching
        // Index under BOTH Pearl name and mapped iReady name so cross-system lookups work.
        const sc = (r[ATT_SCHOOL] || '').toLowerCase().trim();
        if (sc) {
          if (!schoolIndex[sc]) schoolIndex[sc] = new Set();
          schoolIndex[sc].add(key);
          const ireadySc = PEARL_SCHOOL_CROSSREF[sc];
          if (ireadySc) {
            if (!schoolIndex[ireadySc]) schoolIndex[ireadySc] = new Set();
            schoolIndex[ireadySc].add(key);
          }
        }

        const attStatus = r[ATT_ATT_STATUS] || '';
        const mr        = r[ATT_MISS_REASON] || '';
        const cls       = _classifyAttRow(attStatus, mr);

        if (cls === 'attended') {
          scholarMap[key].attended++;
        } else if (cls === 'service_interruption') {
          scholarMap[key].siCount++;
          scholarMap[key].missReasons[mr] = (scholarMap[key].missReasons[mr] || 0) + 1;
          if      (SI_TUTOR.has(mr))  scholarMap[key].siTutor++;
          else if (SI_SCHOOL.has(mr)) scholarMap[key].siSchool++;
          else                        scholarMap[key].siOther++;
        } else if (cls === 'absent') {
          scholarMap[key].absent++;
          if (mr) scholarMap[key].missReasons[mr] = (scholarMap[key].missReasons[mr] || 0) + 1;
          if (CT_PULL_REASONS.has(mr)) scholarMap[key].ctPulls++;
        }
      });

      // ── Session rows: (1) direct name→tutor index + (2) scholarMap updates ──
      // sessStudentNameToTutors is the PRIMARY tutor-lookup path for MOY matching.
      // It maps student names directly from SESS col 2 → tutor keys, bypassing the
      // iReady student_id ≠ Pearl USER_ID mismatch that breaks all UID-based joins.
      // It also handles the case where SESS_STU_IDS (col 16) is empty and stuIds.forEach
      // would silently produce no entries at all.
      const sessStudentNameToTutors = {}; // lowercase name → { tutors: Set, minutesBySubject }

      sessRows.forEach(r => {
        if (!r) return;
        const status = (r[SESS_STATUS] || '').toLowerCase();
        if (status !== 'attended' && status !== 'complete' && status !== 'success'
            && !status.includes('partial')) return;
        const durMins    = parseFloat(r[SESS_ACTUAL_DUR]) || 45;
        const subjectRaw = (r[SESS_SUBJECT] || '').toLowerCase();
        const subject    = subjectRaw.includes('ela') || subjectRaw.includes('english') || subjectRaw.includes('literacy') || subjectRaw.includes('reading') ? 'ELA' : 'Math';
        const tutorId    = r[SESS_INST_ID] || '';
        const tutorName  = (r[SESS_INSTRUCTOR] || '').trim();
        const tutorKey   = tutorId || tutorName;
        const stuIds     = (r[SESS_STU_IDS]   || '').split(',').map(s => s.trim()).filter(Boolean);
        const stuNamesRaw = (r[SESS_STUDENTS] || '').split(',').map(s => s.trim()).filter(Boolean);
        const stuNames   = stuNamesRaw.map(s => s.toLowerCase());

        // — PRIMARY: build name→tutor index from SESS student names (col 2) —
        // This is the most reliable cross-system join since both iReady and Pearl
        // store student full names in the same format.
        stuNames.forEach(nm => {
          if (!nm) return;
          if (!sessStudentNameToTutors[nm]) sessStudentNameToTutors[nm] = { tutors: new Set(), minutesBySubject: { Math: 0, ELA: 0 } };
          if (tutorKey) sessStudentNameToTutors[nm].tutors.add(tutorKey);
          sessStudentNameToTutors[nm].minutesBySubject[subject] += durMins;
        });

        // — SECONDARY: update scholarMap for att-data merge via _moyMatchOps —
        // Use Pearl IDs as keys when available; fall back to names when SESS_STU_IDS empty.
        const items = stuIds.length > 0
          ? stuIds.map((sid, i) => ({ key: sid, rawName: stuNamesRaw[i] || '', nm: stuNames[i] || '' }))
          : stuNamesRaw.map((n, i) => ({ key: n.toLowerCase(), rawName: n, nm: n.toLowerCase() }));

        items.forEach(({ key, rawName, nm }) => {
          if (!key) return;
          if (!scholarMap[key]) scholarMap[key] = {
            uid: stuIds.length ? key : '', name: rawName || nm,
            attended: 0, absent: 0, ctPulls: 0, siCount: 0,
            siTutor: 0, siSchool: 0, siOther: 0,
            missReasons: {}, tutors: new Set(),
            minutesBySubject: { Math: 0, ELA: 0 }, surveyScores: [],
          };
          if (tutorKey) scholarMap[key].tutors.add(tutorKey);
          scholarMap[key].minutesBySubject[subject] += durMins;

          if (tutorKey) {
            if (!tutorScholarMap[tutorKey]) tutorScholarMap[tutorKey] = {
              name: tutorName, id: tutorId, scholars: new Set(),
              minutesBySubject: { Math: 0, ELA: 0 },
            };
            tutorScholarMap[tutorKey].scholars.add(key);
            tutorScholarMap[tutorKey].minutesBySubject[subject] += durMins;
          }
        });
      });

      // ── Scholar survey index (by Pearl scholar UID) ──────────────────────
      const scholSurveyByUid = {};
      stuRows.forEach(r => {
        const uid = r[STU_FILLED_BY_ID];
        if (!uid) return;
        if (!scholSurveyByUid[uid]) scholSurveyByUid[uid] = [];
        const o = parseFloat(r[STU_OVERALL]);
        if (!isNaN(o) && o > 0) scholSurveyByUid[uid].push(o);
      });
      // Attach per-scholar survey avg
      Object.entries(scholarMap).forEach(([key, sch]) => {
        const scores = scholSurveyByUid[sch.uid] || [];
        sch.surveyAvg   = scores.length ? parseFloat((scores.reduce((a,b)=>a+b,0)/scores.length).toFixed(2)) : null;
        sch.surveyCount = scores.length;
      });

      // ── Tutor survey index (by Pearl instructor UID, fallback name) ──────
      const tutorSurveyByUid = {};
      instRows.forEach(r => {
        const uid  = r[INST_FILLED_BY_ID];
        const name = (r[INST_FILLED_BY] || '').trim();
        const key  = uid || name;
        if (!key) return;
        if (!tutorSurveyByUid[key]) tutorSurveyByUid[key] = {
          uid, name,
          overall: [], engagement: [], enjoyment: [], learning: [],
        };
        const o  = parseFloat(r[INST_OVERALL]);  if (!isNaN(o)  && o  > 0) tutorSurveyByUid[key].overall.push(o);
        const eg = parseFloat(r[INST_ENGAGE]);   if (!isNaN(eg) && eg > 0) tutorSurveyByUid[key].engagement.push(eg);
        const ej = parseFloat(r[INST_ENJOY]);    if (!isNaN(ej) && ej > 0) tutorSurveyByUid[key].enjoyment.push(ej);
        const l  = parseFloat(r[INST_LEARN]);    if (!isNaN(l)  && l  > 0) tutorSurveyByUid[key].learning.push(l);
      });
      const _ta = arr => arr.length ? parseFloat((arr.reduce((a,b)=>a+b,0)/arr.length).toFixed(2)) : null;
      Object.values(tutorSurveyByUid).forEach(t => {
        t.avgOverall    = _ta(t.overall);
        t.avgEngagement = _ta(t.engagement);
        t.avgEnjoyment  = _ta(t.enjoyment);
        t.avgLearning   = _ta(t.learning);
        t.count         = t.overall.length;
      });

      // ── Name index: maps normalized-name variants → scholarMap key ──────────
      // Required because scholarMap is keyed by Pearl UID for scholars that have
      // one — so scholarMap[name] fails for UID-keyed entries. iReady student_id
      // rarely matches Pearl UID directly, making the name index the primary join.
      const nameIndex = {};
      Object.entries(scholarMap).forEach(([key, sch]) => {
        const nl = (sch.name || '').trim().toLowerCase();
        if (!nl) return;
        if (!nameIndex[nl]) nameIndex[nl] = key;
        // "Lastname Firstname" ↔ "Firstname Lastname" variant
        const parts = nl.split(/\s+/);
        if (parts.length >= 2) {
          const flipped = parts.slice(1).join(' ') + ' ' + parts[0];
          if (!nameIndex[flipped]) nameIndex[flipped] = key;
          // Last name only (for school-scoped fallback enrichment)
          const lastOnly = parts[parts.length - 1];
          if (lastOnly.length > 2 && !nameIndex['__last__' + lastOnly]) {
            nameIndex['__last__' + lastOnly] = key;
          }
        }
      });

      // ── School-level ops aggregates ──────────────────────────────────────────
      // Provides school/district/region context even when tutor-level matching fails.
      // Joined to MOY academic data by school name in the rendering layer.
      const schoolOpsMap = {}; // schoolKey(lower) → { name, district, region, siTutor, siSchool, siOther, stuSurvScores, instSurvScores }

      attRows.forEach(r => {
        if ((r[ATT_ROLE] || '') !== 'Student') return;
        const sc = (r[ATT_SCHOOL] || '').trim();
        if (!sc) return;
        const scKey = sc.toLowerCase();
        if (!schoolOpsMap[scKey]) schoolOpsMap[scKey] = {
          name: sc, district: r[ATT_DISTRICT] || '', region: '',
          siTutor: 0, siSchool: 0, siOther: 0, siCount: 0,
          absent: 0, ctPulls: 0, stuSurvScores: [], instSurvScores: [],
        };
        const attStatus = r[ATT_ATT_STATUS] || '';
        const mr        = r[ATT_MISS_REASON] || '';
        const cls       = _classifyAttRow(attStatus, mr);
        if (cls === 'service_interruption') {
          schoolOpsMap[scKey].siCount++;
          if      (SI_TUTOR.has(mr))  schoolOpsMap[scKey].siTutor++;
          else if (SI_SCHOOL.has(mr)) schoolOpsMap[scKey].siSchool++;
          else                        schoolOpsMap[scKey].siOther++;
        } else if (cls === 'absent') {
          schoolOpsMap[scKey].absent++;
          if (CT_PULL_REASONS.has(mr)) schoolOpsMap[scKey].ctPulls++;
        }
      });
      stuRows.forEach(r => {
        const sc = (r[STU_SCHOOL] || '').trim();
        if (!sc) return;
        const scKey = sc.toLowerCase();
        if (!schoolOpsMap[scKey]) {
          schoolOpsMap[scKey] = { name: sc, district: '', region: r[STU_REGION] || '', siTutor: 0, siSchool: 0, siOther: 0, stuSurvScores: [], instSurvScores: [] };
        } else if (!schoolOpsMap[scKey].region) {
          schoolOpsMap[scKey].region = r[STU_REGION] || '';
        }
        const o = parseFloat(r[STU_OVERALL]);
        if (!isNaN(o) && o > 0) schoolOpsMap[scKey].stuSurvScores.push(o);
      });
      instRows.forEach(r => {
        const sc = (r[INST_SCHOOL] || '').trim();
        if (!sc) return;
        const scKey = sc.toLowerCase();
        if (!schoolOpsMap[scKey]) {
          schoolOpsMap[scKey] = { name: sc, district: r[INST_DISTRICT] || '', region: '', siTutor: 0, siSchool: 0, siOther: 0, stuSurvScores: [], instSurvScores: [] };
        }
        const o = parseFloat(r[INST_OVERALL]);
        if (!isNaN(o) && o > 0) schoolOpsMap[scKey].instSurvScores.push(o);
      });
      const _sAvg = arr => arr.length ? parseFloat((arr.reduce((a,b)=>a+b,0)/arr.length).toFixed(2)) : null;
      Object.values(schoolOpsMap).forEach(s => {
        s.stuSurvAvg  = _sAvg(s.stuSurvScores);
        s.instSurvAvg = _sAvg(s.instSurvScores);
      });

      // ── Bridge Pearl → iReady school names in schoolOpsMap ──────────────────
      // For every Pearl school entry that has a crossref, also register it under
      // the iReady school name so that the correlations join finds it directly.
      Object.entries(PEARL_SCHOOL_CROSSREF).forEach(([pearlName, ireadyName]) => {
        if (schoolOpsMap[pearlName] && !schoolOpsMap[ireadyName]) {
          schoolOpsMap[ireadyName] = schoolOpsMap[pearlName];
        }
      });
      // Also bridge the reverse: iReady entry → Pearl key (if Pearl data came in under iReady name)
      Object.entries(IREADY_TO_PEARL_SCHOOL).forEach(([ireadyName, pearlName]) => {
        if (schoolOpsMap[ireadyName] && !schoolOpsMap[pearlName]) {
          schoolOpsMap[pearlName] = schoolOpsMap[ireadyName];
        }
      });

      return { scholarMap, tutorScholarMap, schoolIndex, tutorSurveyByUid, nameIndex, sessStudentNameToTutors, schoolOpsMap };
    }

    // ── Match a MOY row to its operational profile ────────────────────────────
    // Join strategy (in order of confidence):
    //   1. Pearl student_id → MOY student_id   (exact, most reliable)
    //   2. Name index lookup (handles UID-keyed scholarMap entries)
    //   3. Last-name + first-name token match   (fuzzy fallback)
    //   4. Same school + last-name              (school-scoped fallback — handles The Co ambiguity)
    function _moyMatchOps(moyRow, opsMap) {
      if (!opsMap) return null;
      const { scholarMap, schoolIndex, nameIndex } = opsMap;

      // 1. Exact Pearl student_id
      const sid = (moyRow.scholarId || '').trim();
      if (sid && scholarMap[sid]) return scholarMap[sid];

      // 2. Name index lookup — covers both name-keyed and UID-keyed entries
      const fullName = (moyRow.scholarName || '').trim().toLowerCase();
      if (fullName) {
        const nk = nameIndex && nameIndex[fullName];
        if (nk && scholarMap[nk]) return scholarMap[nk];
        if (scholarMap[fullName]) return scholarMap[fullName]; // direct name-keyed fallback
      }

      // 3. Fuzzy last-name + at least one other token
      const nameParts = fullName.split(/\s+/);
      const last = nameParts[nameParts.length - 1];
      if (last && last.length > 2) {
        const school = (moyRow.school || '').toLowerCase().trim();
        // First try school-scoped match (reduces false positives in multi-school datasets like The Co)
        if (school && schoolIndex && schoolIndex[school]) {
          for (const key of schoolIndex[school]) {
            const kn = (scholarMap[key] ? scholarMap[key].name : key).toLowerCase();
            if (kn.includes(last) && nameParts.some(p => p.length > 2 && kn.includes(p))) {
              return scholarMap[key];
            }
          }
        }
        // Global fallback (no school filter)
        for (const key of Object.keys(scholarMap)) {
          const kn = (scholarMap[key].name || key).toLowerCase();
          if (kn.includes(last) && nameParts.some(p => p.length > 2 && kn.includes(p))) {
            return scholarMap[key];
          }
        }
      }
      return null;
    }

    // ── Build tutor impact from MOY + ops join ────────────────────────────────
    // Returns per-tutor objects combining academic (iReady), operational (Pearl
    // sessions/attendance), service interruption breakdown, and survey scores.
    function _moyBuildTutorImpact(rows, subject, opsMap) {
      const tutorScholarMapRef = opsMap ? (opsMap.tutorScholarMap     || {}) : {};
      const tutorSurveyMap     = opsMap ? (opsMap.tutorSurveyByUid   || {}) : {};

      // tutorKey → accumulator
      const tutorData = {};

      rows.forEach(r => {
        if (!r.hasGrowth || r.pctTypical === null) return;

        // Primary tutor lookup: SESS student-name index — bypasses Pearl UID mismatch.
        // Maps MOY scholar name directly to tutors via SESS col 2 student names.
        const moyName   = (r.scholarName || '').trim().toLowerCase();
        const sessEntry = opsMap && opsMap.sessStudentNameToTutors && moyName
                          ? opsMap.sessStudentNameToTutors[moyName] : null;
        // Secondary: att-based scholar profile (for attendance, SI, scholar survey data)
        const ops = opsMap ? _moyMatchOps(r, opsMap) : null;

        // Resolve tutors: SESS-name index → ops.tutors → MOY instructor field → unassigned
        const tutorSet = (sessEntry && sessEntry.tutors && sessEntry.tutors.size)
                         ? sessEntry.tutors
                         : (ops && ops.tutors && ops.tutors.size ? ops.tutors : null);
        const tutors = tutorSet ? [...tutorSet] : (r.instructor ? [r.instructor] : []);
        if (!tutors.length) tutors.push('__unassigned__');

        tutors.forEach(t => {
          if (!tutorData[t]) {
            // Resolve real tutor name: tutorScholarMap stores { name, id } per key
            const realName = (tutorScholarMapRef[t] && tutorScholarMapRef[t].name)
                              || (t === '__unassigned__' ? 'Unassigned' : t);
            tutorData[t] = {
              key: t, name: realName,
              scholars: new Set(), pcts: [], gains: [], months: [],
              movedUp: 0, held: 0, movedDown: 0,
              minutesMath: 0, minutesELA: 0,
              siCount: 0, siTutor: 0, siSchool: 0, siOther: 0,
              scholAttended: 0, scholAbsent: 0, scholCtPulls: 0,
              scholSurveyScores: [],
            };
          }
          const td = tutorData[t];
          td.scholars.add(r.scholarId || r.scholarName);
          td.pcts.push(r.pctTypical);
          if (r.winterWeeks > 0) td.months.push(r.pctTypical * (r.winterWeeks / 4));
          if (r.winterGain !== null) td.gains.push(r.winterGain);

          const shift = _moyPlShift(r.baseRelPlacement, r.winterRelPlacement);
          if (shift === 'up')   td.movedUp++;
          else if (shift === 'down') td.movedDown++;
          else                  td.held++;

          // Minutes: SESS entry is authoritative — avoids double-counting with ops.minutesBySubject
          if (sessEntry) {
            td.minutesMath += (sessEntry.minutesBySubject.Math || 0);
            td.minutesELA  += (sessEntry.minutesBySubject.ELA  || 0);
          } else if (ops) {
            td.minutesMath += (ops.minutesBySubject.Math || 0);
            td.minutesELA  += (ops.minutesBySubject.ELA  || 0);
          }
          // Att / SI / CT / survey: from ATT-row-based ops profile (separate data source)
          if (ops) {
            td.siCount       += (ops.siCount   || 0);
            td.siTutor       += (ops.siTutor   || 0);
            td.siSchool      += (ops.siSchool  || 0);
            td.siOther       += (ops.siOther   || 0);
            td.scholAttended += (ops.attended  || 0);
            td.scholAbsent   += (ops.absent    || 0);
            td.scholCtPulls  += (ops.ctPulls   || 0);
            if (ops.surveyAvg !== null && ops.surveyAvg !== undefined) {
              td.scholSurveyScores.push(ops.surveyAvg);
            }
          }
        });
      });

      const _med  = arr => _moyMedian(arr);
      const _avg  = arr => arr.length ? parseFloat((arr.reduce((a,b)=>a+b,0)/arr.length).toFixed(2)) : null;

      return Object.values(tutorData)
        .filter(t => t.scholars.size >= 3 && t.pcts.length >= 3 && t.name !== 'Unassigned')
        .map(t => {
          const totalMins   = t.minutesMath + t.minutesELA;
          const scholTotal  = t.scholAttended + t.scholAbsent;
          const siTotal     = t.siTutor + t.siSchool + t.siOther;
          // Tutor survey: match by Pearl ID key first, fallback to name scan
          const tSurvey = tutorSurveyMap[t.key]
            || Object.values(tutorSurveyMap).find(s =>
                 s.name && t.name &&
                 s.name.toLowerCase().trim() === t.name.toLowerCase().trim()
               )
            || null;
          return {
            name:           t.name,
            n:              t.scholars.size,
            medianPct:      Math.round(_med(t.pcts) * 100),
            medianGain:     t.gains.length ? Math.round(_med(t.gains) * 10) / 10 : null,
            medianMonths:   t.months.length ? parseFloat((_med(t.months)).toFixed(1)) : null,
            movedUp:        t.movedUp,
            held:           t.held,
            movedDown:      t.movedDown,
            pctMovedUp:     (t.movedUp + t.held + t.movedDown) > 0
                              ? Math.round(t.movedUp / (t.movedUp + t.held + t.movedDown) * 100) : 0,
            // Instructional hours (total + per-subject)
            hours:          Math.round(totalMins / 60 * 10) / 10,
            hoursMath:      Math.round(t.minutesMath / 60 * 10) / 10,
            hoursELA:       Math.round(t.minutesELA  / 60 * 10) / 10,
            // Scholar attendance (attended vs absent, excluding SIs from denominator)
            scholAttRate:   scholTotal > 0 ? Math.round(t.scholAttended / scholTotal * 100) : null,
            scholAttended:  t.scholAttended,
            scholAbsent:    t.scholAbsent,
            scholCtPulls:   t.scholCtPulls,
            // Service interruptions — categorised
            siCount:        t.siCount,
            siTotal,
            siTutor:        t.siTutor,
            siSchool:       t.siSchool,
            siOther:        t.siOther,
            // Survey scores
            scholSurveyAvg: _avg(t.scholSurveyScores),
            tutorSurveyAvg: tSurvey ? tSurvey.avgOverall : null,
            tutorSurveyCount: tSurvey ? tSurvey.count : 0,
            // Impact tier
            tier: _med(t.pcts) >= 1.0 ? 'High Impact'
                : _med(t.pcts) >= 0.5 ? 'On Track'
                :                       'Needs Support',
          };
        })
        .sort((a, b) => b.medianPct - a.medianPct);
    }

    // ── MOY CSV export ────────────────────────────────────────────────────────
    function _moyExportCSV(subject) {
      const subj = subject || _moySubject;
      const rows = subj === 'ELA' ? MOY_DATA.ela : MOY_DATA.math;
      if (!rows.length) { alert('No MOY data loaded. Click Refresh first.'); return; }
      const _esc = v => { const s = String(v == null ? '' : v); return (s.includes(',') || s.includes('"') || s.includes('\n')) ? '"' + s.replace(/"/g,'""') + '"' : s; };
      const headers = ['Scholar Name','School','Region','Grade','Subject',
        'Fall Placement','Winter Placement','Placement Movement',
        'Winter Scale Score','Scale Gain','% Typical Growth','Months of Learning Gained',
        'Met Typical Growth','Has Growth Data','Winter-Only (no Fall baseline)',
        'Rush Flag','Instructor'];
      const csvRows = rows.map(r => {
        const months = r.pctTypical !== null && r.winterWeeks > 0 ? parseFloat((r.pctTypical * (r.winterWeeks / 4)).toFixed(1)) : '';
        const shift  = r.hasGrowth ? _moyPlShift(r.baseRelPlacement, r.winterRelPlacement) : '';
        return [
          r.scholarName, r.school, r.region, r.grade, subj,
          r.baseRelPlacement || '', r.winterRelPlacement || '',
          shift === 'up' ? 'Up' : shift === 'down' ? 'Down' : shift === 'held' ? 'Held' : '',
          r.winterScore != null ? r.winterScore : '',
          r.winterGain  != null ? r.winterGain  : '',
          r.pctTypical  != null ? Math.round(r.pctTypical * 100) + '%' : '',
          months !== '' ? months + ' mo' : '',
          r.hasGrowth ? (r.pctTypical >= 1.0 ? 'Yes' : 'No') : '',
          r.hasGrowth ? 'Yes' : 'No',
          r.winterWeeks === 0 ? 'Yes' : 'No',
          r.winterRush || '',
          r.instructor || '',
        ].map(_esc).join(',');
      });
      const csv  = [headers.map(_esc).join(','), ...csvRows].join('\r\n');
      const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href = url; a.download = 'njtc-moy-' + subj.toLowerCase() + '-' + new Date().toISOString().slice(0,10) + '.csv';
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }

    // ── MOY XLSX export ───────────────────────────────────────────────────────
    function _moyExportXLSX(subject) {
      const subj = subject || _moySubject;
      const rows = subj === 'ELA' ? MOY_DATA.ela : MOY_DATA.math;
      if (!rows.length) { alert('No MOY data loaded. Click Refresh first.'); return; }
      if (typeof XLSX === 'undefined') { _moyExportCSV(subject); return; }
      const metrics  = _moyGetMetrics(subj);
      const net      = metrics ? metrics.network : null;
      const opsMap   = _moyBuildOperationalMap(rows);
      const dated    = new Date().toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'});

      // Sheet 1: Individual Scholar Data
      const scholarSheet = rows.map(r => {
        const months = r.pctTypical !== null && r.winterWeeks > 0 ? parseFloat((r.pctTypical * (r.winterWeeks / 4)).toFixed(1)) : null;
        const shift  = r.hasGrowth ? _moyPlShift(r.baseRelPlacement, r.winterRelPlacement) : null;
        return {
          'Scholar Name':            r.scholarName || '',
          'School':                  r.school      || '',
          'Region':                  r.region      || '',
          'Grade':                   r.grade       != null ? String(r.grade) : '',
          'Subject':                 subj,
          'Fall Placement':          r.baseRelPlacement    || '',
          'Winter Placement':        r.winterRelPlacement  || '',
          'Placement Movement':      shift === 'up' ? 'Up' : shift === 'down' ? 'Down' : shift === 'held' ? 'Held' : '',
          'Winter Scale Score':      r.winterScore != null ? r.winterScore : '',
          'Scale Score Gain':        r.winterGain  != null ? r.winterGain  : '',
          '% Typical Growth':        r.pctTypical  != null ? Math.round(r.pctTypical * 100) : '',
          'Months of Learning Gained': months != null ? months : '',
          'Met Typical Growth':      r.hasGrowth ? (r.pctTypical >= 1.0 ? 'Yes' : 'No') : '',
          'Has Growth Data':         r.hasGrowth ? 'Yes' : 'No',
          'Winter-Only':             r.winterWeeks === 0 ? 'Yes' : 'No',
          'Rush Flag':               r.winterRush || '',
          'Instructor':              r.instructor  || '',
        };
      });

      // Sheet 2: Network Summary
      const summarySheet = net ? [
        { 'Metric': 'Subject',                  'Value': subj },
        { 'Metric': 'Report Date',              'Value': dated },
        { 'Metric': 'Total Scholars',           'Value': net.total },
        { 'Metric': 'With Growth Data',         'Value': net.withGrowth },
        { 'Metric': 'Winter-Only (no Fall)',     'Value': net.total - net.withGrowth },
        { 'Metric': 'Median % Typical Growth',  'Value': net.medianPctTypical != null ? net.medianPctTypical + '%' : '—' },
        { 'Metric': 'Median Months of Learning','Value': net.medianMonthsGrowth != null ? net.medianMonthsGrowth + ' mo' : '—' },
        { 'Metric': 'Avg Months of Learning',  'Value': net.avgMonthsGrowth   != null ? net.avgMonthsGrowth   + ' mo' : '—' },
        { 'Metric': '% Met Typical Growth',     'Value': net.pctMetTypical != null ? net.pctMetTypical + '%' : '—' },
        { 'Metric': 'Median Scale Gain',        'Value': net.medianGain != null ? (net.medianGain > 0 ? '+' : '') + net.medianGain : '—' },
        { 'Metric': 'Moved Up (placement)',     'Value': net.movedUp },
        { 'Metric': 'Held (placement)',         'Value': net.held },
        { 'Metric': 'Moved Down (placement)',   'Value': net.movedDown },
        { 'Metric': '% Met or Exceeded',        'Value': net.pctMetTypical != null ? net.pctMetTypical + '%' : '—' },
        { 'Metric': '% Progressing (50–99%)',   'Value': net.pctProgressing != null ? net.pctProgressing + '%' : '—' },
        { 'Metric': '% Needs Acceleration',     'Value': net.pctNeedsAccel != null ? net.pctNeedsAccel + '%' : '—' },
        { 'Metric': '% Regressed',              'Value': net.pctRegressed != null ? net.pctRegressed + '%' : '—' },
      ] : [];

      // Sheet 3: By School
      const schoolSheet = metrics ? Object.entries(metrics.bySchool)
        .filter(([sc]) => sc !== 'Unknown')
        .sort((a,b) => (b[1].medianPctTypical||0) - (a[1].medianPctTypical||0))
        .map(([sc,m]) => ({
          'School':                   sc,
          'Total Scholars':           m.total,
          'With Growth Data':         m.withGrowth,
          'Winter-Only':              m.total - m.withGrowth,
          'Median Scale Gain':        m.medianGain != null ? m.medianGain : '',
          'Median % Typical Growth':  m.medianPctTypical != null ? m.medianPctTypical : '',
          'Median Months Gained':       m.medianMonthsGrowth != null ? m.medianMonthsGrowth : '',
          '% Met Typical':            m.pctMetTypical != null ? m.pctMetTypical : '',
        })) : [];

      // Sheet 4: Tutor Impact (if Pearl loaded)
      const validRows   = rows.filter(r => r.hasGrowth && r.pctTypical !== null);
      const tutorImpact = _moyBuildTutorImpact(validRows, subj, opsMap);
      const tutorSheet  = tutorImpact.map(t => ({
        'Tutor':                    t.name,
        'Scholars':                 t.n,
        'Median % Typical Growth':  t.medianPct,
        'Median Months Gained':       t.medianMonths != null ? t.medianMonths : '',
        'Median Scale Gain':        t.medianGain   != null ? t.medianGain   : '',
        'Moved Up':                 t.movedUp,
        'Moved Down':               t.movedDown,
        'Inst. Hours':              t.hours > 0 ? t.hours : '',
        'Scholar Att. Rate %':      t.scholAttRate != null ? t.scholAttRate  : '',
        'Scholar Absences':         t.scholAbsent,
        'CT Pulls':                 t.scholCtPulls,
        'SIs Tutor-Caused':         t.siTutor,
        'SIs School-Caused':        t.siSchool,
        'SIs Other':                t.siOther,
        'Scholar Sat. Avg':         t.scholSurveyAvg != null ? t.scholSurveyAvg : '',
        'Tutor Survey Avg':         t.tutorSurveyAvg != null ? t.tutorSurveyAvg : '',
        'Tier':                     t.tier,
      }));

      const autoWidth = sheet => {
        const ref = sheet['!ref'];
        if (!ref) return;
        const range = XLSX.utils.decode_range(ref);
        const widths = [];
        for (let C = range.s.c; C <= range.e.c; C++) {
          let max = 10;
          for (let R = range.s.r; R <= range.e.r; R++) {
            const cell = sheet[XLSX.utils.encode_cell({ r: R, c: C })];
            if (cell && cell.v != null) max = Math.max(max, String(cell.v).length);
          }
          widths.push({ wch: Math.min(max + 2, 40) });
        }
        sheet['!cols'] = widths;
      };

      const wb = XLSX.utils.book_new();
      const ws1 = XLSX.utils.json_to_sheet(scholarSheet); autoWidth(ws1); XLSX.utils.book_append_sheet(wb, ws1, subj + ' Scholars');
      const ws2 = XLSX.utils.json_to_sheet(summarySheet); autoWidth(ws2); XLSX.utils.book_append_sheet(wb, ws2, 'Network Summary');
      if (schoolSheet.length) { const ws3 = XLSX.utils.json_to_sheet(schoolSheet); autoWidth(ws3); XLSX.utils.book_append_sheet(wb, ws3, 'By School'); }
      if (tutorSheet.length)  { const ws4 = XLSX.utils.json_to_sheet(tutorSheet);  autoWidth(ws4); XLSX.utils.book_append_sheet(wb, ws4, 'Tutor Impact'); }
      XLSX.writeFile(wb, 'njtc-moy-' + subj.toLowerCase() + '-' + new Date().toISOString().slice(0,10) + '.xlsx');
    }

    // ── MOY PDF/PPTX generation ────────────────────────────────────────────────
    async function _moyGeneratePDF(scope, subject) {
      const metrics = _moyGetMetrics(subject);
      if (!metrics) { alert('MOY data not loaded. Please load MOY data first.'); return; }
      const rows = subject === 'ELA' ? MOY_DATA.ela : MOY_DATA.math;
      const opsMap = _moyBuildOperationalMap(rows);

      // Load jsPDF from the existing portal infrastructure
      try {
        if (!window.jspdf || !window.jspdf.jsPDF) {
          await new Promise((resolve, reject) => {
            const s = document.createElement('script');
            s.src = 'https://unpkg.com/jspdf@2.5.1/dist/jspdf.umd.min.js';
            s.onload = resolve; s.onerror = reject;
            document.head.appendChild(s);
          });
          await new Promise((resolve, reject) => {
            const s = document.createElement('script');
            s.src = 'https://unpkg.com/jspdf-autotable@3.8.2/dist/jspdf.plugin.autotable.min.js';
            s.onload = resolve; s.onerror = reject;
            document.head.appendChild(s);
          });
        }
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' });
        const NET = metrics.network;
        const dated = new Date().toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'});
        const scopeLabel = scope === 'ALL' ? 'Network' : scope + ' Region';

        const NAVY  = [10, 22, 40];
        const BLUE  = [0, 48, 135];
        const GOLD  = [240, 165, 0];
        const GREEN = [13, 110, 58];
        const RED   = [185, 28, 28];
        const WHITE = [255,255,255];

        function safe(s) { return (s||'').toString().replace(/[^\x00-\xFF]/g, c => ''); }

        // ── PAGE 1: Cover + Narrative ────────────────────────────────────────
        doc.setFillColor(...NAVY);
        doc.rect(0, 0, 216, 279, 'F');
        doc.setFillColor(...GOLD);
        doc.rect(0, 0, 216, 3, 'F');

        doc.setTextColor(...WHITE);
        doc.setFontSize(9); doc.setFont('helvetica','bold');
        doc.text('NEW JERSEY TUTORING CORPS', 20, 20);
        doc.setFontSize(22); doc.setFont('helvetica','bold');
        doc.text(safe('Mid-Year Academic Snapshot'), 20, 38);
        doc.setFontSize(14); doc.setFont('helvetica','normal');
        doc.text(safe('SY 2025\u20132026 \u00B7 ' + subject + ' \u00B7 ' + scopeLabel), 20, 48);
        doc.setFontSize(9); doc.setTextColor(180,192,210);
        doc.text('Generated ' + dated + '  \u00B7  Confidential \u00B7  NJTC Central Team Portal', 20, 58);

        // KPI tiles
        const tiles = [
          { label:'Scholars', val: NET.total },
          { label:'w/ Growth Data', val: NET.withGrowth },
          { label:'Median % Typical', val: (NET.medianPctTypical||'—')+(NET.medianPctTypical?'%':'') },
          { label:'Months Gained', val: NET.medianMonthsGrowth != null ? NET.medianMonthsGrowth+' mo' : '—' },
          { label:'Met Typical', val: (NET.pctMetTypical||'—')+(NET.pctMetTypical?'%':'') },
          { label:'Median Gain', val: NET.medianGain !== null ? (NET.medianGain>0?'+':'')+NET.medianGain+' pts' : '—' },
        ];
        // 6 tiles, two rows of 3 at 57mm each fits 176mm total
        const tileW = 28, tileGap = 1, tileY = 68;
        tiles.forEach((t,i) => {
          const col = i % 3, row = Math.floor(i / 3);
          const x = 20 + col * (tileW + tileGap), y = tileY + row * 26;
          doc.setFillColor(20,36,60);
          doc.roundedRect(x, y, tileW, 22, 2, 2, 'F');
          doc.setTextColor(...GOLD);
          doc.setFontSize(11); doc.setFont('helvetica','bold');
          doc.text(safe(String(t.val)), x + tileW/2, y+10, {align:'center'});
          doc.setTextColor(160,175,195);
          doc.setFontSize(5.5); doc.setFont('helvetica','normal');
          doc.text(safe(t.label.toUpperCase()), x + tileW/2, y+17, {align:'center'});
        });

        // Narrative
        const pct = NET.medianPctTypical || 0;
        const moStr = NET.medianMonthsGrowth != null ? ` \u2014 equivalent to <strong>${NET.medianMonthsGrowth} months</strong> of academic learning gained` : '';
        const trend = pct >= 80 ? 'on a strong trajectory toward year-end targets' : pct >= 50 ? 'making measurable progress' : 'in need of intensified support before the spring window';
        const narrative = `At the mid-year checkpoint, our ${subject} scholars across the ${scopeLabel} are achieving a median of ${pct}% of their expected annual growth` +
          (NET.medianMonthsGrowth != null ? ` (${NET.medianMonthsGrowth} months of learning gained)` : '') +
          ` \u2014 ${trend}. Of ${NET.withGrowth} scholars with valid Fall + Winter diagnostic pairs, ${NET.movedUp} improved their relative placement band, ${NET.held} held their band, and ${NET.movedDown} dropped a placement band (note: band movement \u2260 score regression \u2014 positive gains can still result in a band drop if below the band threshold).` +
          (NET.rushFlags && NET.rushFlags.red > 0 ? ` ${NET.rushFlags.red} scholars had Red Rush Flags on their Winter diagnostic and are flagged for review (included in calculations).` : '');

        doc.setFillColor(15,30,55);
        doc.roundedRect(20, 124, 176, 30, 2, 2, 'F');
        doc.setFillColor(...GOLD);
        doc.rect(20, 124, 3, 30, 'F');
        doc.setTextColor(...WHITE);
        doc.setFontSize(7.5); doc.setFont('helvetica','italic');
        const nLines = doc.splitTextToSize(safe(narrative), 164);
        doc.text(nLines.slice(0,4), 28, 132);

        // Placement shift
        doc.setTextColor(...GOLD);
        doc.setFontSize(7); doc.setFont('helvetica','bold');
        doc.text('PLACEMENT MOVEMENT (FALL \u2192 WINTER)', 20, 162);
        [['\u2191 Moved Up', NET.movedUp, GREEN],['\u2192 Held', NET.held, BLUE],['\u2193 Moved Down', NET.movedDown, RED]].forEach(([lbl,n,col],i) => {
          const x = 20+i*60;
          doc.setFillColor(15,30,55); doc.roundedRect(x,165,55,18,2,2,'F');
          doc.setTextColor(...col); doc.setFontSize(16); doc.setFont('helvetica','bold');
          doc.text(String(n), x+27.5, 176, {align:'center'});
          doc.setTextColor(160,175,195); doc.setFontSize(7); doc.setFont('helvetica','normal');
          doc.text(safe(lbl), x+27.5, 181, {align:'center'});
        });

        // ── How to Read This Report ──────────────────────────────────────────
        const howY = 190;
        doc.setFillColor(20,36,60); doc.roundedRect(20, howY, 176, 80, 2, 2, 'F');
        doc.setFillColor(...GOLD); doc.rect(20, howY, 3, 80, 'F');
        doc.setTextColor(...GOLD); doc.setFontSize(6.5); doc.setFont('helvetica','bold');
        doc.text('HOW TO READ THIS REPORT', 28, howY+7);
        doc.setTextColor(...WHITE); doc.setFontSize(6); doc.setFont('helvetica','normal');
        const howItems = [
          ['Median % Typical Growth', 'How much of the expected full-year iReady growth a scholar achieved by mid-year. 100% = exactly on pace. 80%+ = on track. 50-79% = progressing but needs support. Below 50% = needs acceleration.'],
          ['Median Months of Learning Gained', 'Estimated months of academic learning gained by mid-year. Formula: pctTypical x winterWeeks / 4 per scholar (median). winterWeeks = actual weeks between Fall and Winter diagnostics. 4.5+ months = strong. 3.0-4.4 = progressing. Below 3.0 = needs support. Avg months also shown for spreadsheet alignment.'],
          ['N (Total) vs N (Growth)', '"N Total" is every scholar in the MOY sheet. "N Growth" is only scholars with BOTH a Fall AND Winter iReady diagnostic. Schools marked (W) appear in the Winter sheet but have no Fall baseline -- growth cannot be calculated.'],
          ['Placement Movement', 'Whether a scholar moved to a higher (Up), same (Held), or lower (Down) relative placement level between Fall and Winter. Directional placement change, not a growth score.'],
          ['Red Rush Flag', 'iReady flags diagnostics completed unusually fast (possible guessing). Scholars with Red Rush Flags are INCLUDED in all growth calculations but flagged for review. Contact iReady if re-administration is warranted.'],
        ];
        let hiy = howY+12;
        howItems.forEach(([term,def]) => {
          doc.setTextColor(...GOLD); doc.setFont('helvetica','bold');
          doc.text(safe(term+':'), 28, hiy);
          doc.setTextColor(200,210,230); doc.setFont('helvetica','normal');
          const defLines = doc.splitTextToSize(safe(def), 152);
          doc.text(defLines.slice(0,2), 28, hiy+4);
          hiy += (defLines.length>1?12:9);
        });

        doc.setFontSize(7); doc.setTextColor(100,120,145);
        doc.text('Data Source: iReady SY 2025\u20132026  \u00B7  NJTC Central Team Staff Portal  \u00B7  Confidential', 108, 272, {align:'center'});

        // ── PAGE 2: Region & School breakdown ───────────────────────────────
        doc.addPage();
        doc.setFillColor(...NAVY); doc.rect(0,0,216,14,'F');
        doc.setTextColor(...WHITE); doc.setFontSize(9); doc.setFont('helvetica','bold');
        doc.text('BY REGION \u00B7 ' + subject.toUpperCase() + ' \u00B7 ' + scopeLabel.toUpperCase(), 20, 9);

        const regionEntries = Object.entries(metrics.byRegion).sort((a,b)=>(b[1].medianPctTypical||0)-(a[1].medianPctTypical||0));
        doc.autoTable({
          startY: 18,
          head: [['Region','N','w/ Growth','Median Gain','Median % Typical','% Met Typical']],
          body: regionEntries.map(([rg,m]) => [
            rg, m.total, m.withGrowth,
            m.medianGain !== null ? (m.medianGain>0?'+':'')+m.medianGain : '—',
            m.medianPctTypical !== null ? m.medianPctTypical+'%' : '—',
            m.pctMetTypical !== null ? m.pctMetTypical+'%' : '—',
          ]),
          headStyles:{ fillColor:NAVY, textColor:WHITE, fontSize:7, fontStyle:'bold' },
          bodyStyles:{ fontSize:7 },
          alternateRowStyles:{ fillColor:[245,248,255] },
          styles:{ overflow:'linebreak', cellPadding:2.5 },
          margin:{ left:20, right:20 },
        });

        // All schools in MOY sheet — growth first (sorted by median % typical), winter-only last
        const schoolEntries = Object.entries(metrics.bySchool)
          .filter(([sc]) => sc !== 'Unknown')
          .sort((a,b) => {
            const aHas = a[1].withGrowth>0, bHas = b[1].withGrowth>0;
            if (aHas && !bHas) return -1;
            if (!aHas && bHas) return 1;
            return (b[1].medianPctTypical||0) - (a[1].medianPctTypical||0);
          });
        const nextY = doc.lastAutoTable.finalY + 10;
        doc.setFontSize(7); doc.setFont('helvetica','bold');
        doc.setTextColor(...NAVY);
        doc.text('BY SCHOOL \u00B7 ALL SCHOOLS IN MOY SHEET (* = <3 scholars  |  (W) = Winter only, no Fall baseline)', 20, nextY-2);
        doc.autoTable({
          startY: nextY,
          head: [['School','N Total','N Growth','Med Gain','Med % Typical','% Met Typical']],
          body: schoolEntries.map(([sc,m]) => {
            const tag = m.withGrowth===0?' (W)':m.withGrowth<3?' *':'';
            return [
              safe((sc.length>40?sc.slice(0,39)+'...':sc)+tag),
              m.total,
              m.withGrowth>0?m.withGrowth:'--',
              m.withGrowth>0&&m.medianGain!==null?(m.medianGain>0?'+':'')+m.medianGain:'N/A',
              m.withGrowth>0&&m.medianPctTypical!==null?m.medianPctTypical+'%':'N/A',
              m.withGrowth>0&&m.pctMetTypical!==null?m.pctMetTypical+'%':'N/A',
            ];
          }),
          headStyles:{ fillColor:NAVY, textColor:WHITE, fontSize:6.5, fontStyle:'bold' },
          bodyStyles:{ fontSize:6.5 },
          alternateRowStyles:{ fillColor:[245,248,255] },
          styles:{ overflow:'linebreak', cellPadding:2 },
          margin:{ left:20, right:20 },
          columnStyles:{
            0:{ cellWidth:54 },
            1:{ cellWidth:16, halign:'center' },
            2:{ cellWidth:16, halign:'center' },
            3:{ cellWidth:18, halign:'center' },
            4:{ cellWidth:26, halign:'center' },
            5:{ cellWidth:26, halign:'center' },
          },
          didParseCell: function(d) {
            if (d.section!=='body') return;
            if (d.column.index===4) {
              if (d.cell.raw==='N/A') { d.cell.styles.textColor=[160,160,160]; return; }
              const v=parseInt(d.cell.raw);
              if (!isNaN(v)) { d.cell.styles.textColor=v>=80?GREEN:v>=50?[180,100,0]:RED; d.cell.styles.fontStyle='bold'; }
            }
            if (d.column.index===5&&d.cell.raw==='N/A') d.cell.styles.textColor=[160,160,160];
            if (d.column.index===3&&d.cell.raw==='N/A') d.cell.styles.textColor=[160,160,160];
          },
        });
        doc.setFontSize(7); doc.setTextColor(100,120,145);
        doc.text('Data Source: iReady SY 2025\u20132026  \u00B7  NJTC Central Team Staff Portal  \u00B7  Confidential', 108, 272, {align:'center'});

        // ── PAGE 3: Tutor Academic Impact (full integrated report) ───────────
        doc.addPage();
        doc.setFillColor(...NAVY); doc.rect(0,0,216,14,'F');
        doc.setTextColor(...WHITE); doc.setFontSize(9); doc.setFont('helvetica','bold');
        doc.text('TUTOR ACADEMIC IMPACT \u00B7 ' + subject.toUpperCase() + ' \u00B7 ' + scopeLabel.toUpperCase(), 20, 9);

        const validRows   = rows.filter(r => r.hasGrowth && r.pctTypical !== null);
        const tutorImpact = _moyBuildTutorImpact(validRows, subject, opsMap);

        // ── Aggregate summary chips ──────────────────────────────────────────
        let p3y = 18;

        if (tutorImpact.length) {
          const hiCt   = tutorImpact.filter(t => t.tier === 'High Impact').length;
          const onCt   = tutorImpact.filter(t => t.tier === 'On Track').length;
          const nsCt   = tutorImpact.filter(t => t.tier === 'Needs Support').length;
          const totHrs = tutorImpact.reduce((s, t) => s + (t.hours || 0), 0);
          const totSiT = tutorImpact.reduce((s, t) => s + (t.siTutor  || 0), 0);
          const totSiS = tutorImpact.reduce((s, t) => s + (t.siSchool || 0), 0);
          const tutorsWithAtt  = tutorImpact.filter(t => t.scholAttRate !== null);
          const avgAttRate     = tutorsWithAtt.length
            ? Math.round(tutorsWithAtt.reduce((s,t) => s + t.scholAttRate, 0) / tutorsWithAtt.length) : null;
          const tutorsWithSurv = tutorImpact.filter(t => t.tutorSurveyAvg !== null);
          const avgTutorSurv   = tutorsWithSurv.length
            ? parseFloat((tutorsWithSurv.reduce((s,t) => s + t.tutorSurveyAvg, 0) / tutorsWithSurv.length).toFixed(2)) : null;
          const scholsWithSurv = tutorImpact.filter(t => t.scholSurveyAvg !== null);
          const avgScholSurv   = scholsWithSurv.length
            ? parseFloat((scholsWithSurv.reduce((s,t) => s + t.scholSurveyAvg, 0) / scholsWithSurv.length).toFixed(2)) : null;
          const totalScholars  = tutorImpact.reduce((s, t) => s + t.n, 0);

          // ── Row 1: 5 academic/ops chips ──────────────────────────────────
          const chips1 = [
            { val: String(tutorImpact.length), lbl: 'Tutors Matched', color: NAVY },
            { val: String(totalScholars),       lbl: 'Scholars Covered', color: NAVY },
            { val: Math.round(tutorImpact.reduce((s,t)=>s+t.medianPct,0)/tutorImpact.length)+'%',
              lbl: 'Avg Med % Typical',
              color: Math.round(tutorImpact.reduce((s,t)=>s+t.medianPct,0)/tutorImpact.length) >= 80 ? GREEN : GOLD },
            { val: totHrs.toFixed(1)+'h',       lbl: 'Total Inst. Hours', color: BLUE },
            { val: avgAttRate !== null ? avgAttRate+'%' : '\u2014', lbl: 'Avg Scholar Att.', color: avgAttRate && avgAttRate >= 95 ? GREEN : GOLD },
          ];
          const chipW1 = (176) / chips1.length;
          chips1.forEach((c, i) => {
            const cx = 20 + i * chipW1;
            doc.setFillColor(240,244,255); doc.roundedRect(cx, p3y, chipW1-2, 18, 1.5, 1.5, 'F');
            doc.setFillColor(...c.color); doc.rect(cx, p3y, chipW1-2, 2, 'F');
            doc.setTextColor(...c.color); doc.setFontSize(11); doc.setFont('helvetica','bold');
            doc.text(safe(c.val), cx + (chipW1-2)/2, p3y+11, {align:'center'});
            doc.setTextColor(100,115,135); doc.setFontSize(5.5); doc.setFont('helvetica','normal');
            doc.text(safe(c.lbl), cx + (chipW1-2)/2, p3y+16, {align:'center'});
          });
          p3y += 22;

          // ── Row 2: Survey + SI + tier chips ───────────────────────────────
          const chips2 = [
            ...(avgTutorSurv !== null ? [{ val: avgTutorSurv+'/5', lbl: 'Avg Tutor Survey', color: avgTutorSurv >= 4 ? GREEN : GOLD }] : []),
            ...(avgScholSurv !== null ? [{ val: avgScholSurv+'/5', lbl: 'Avg Scholar Sat.', color: avgScholSurv >= 4 ? GREEN : GOLD }] : []),
            { val: String(totSiT), lbl: 'Tutor-Caused SIs', color: totSiT > 5 ? RED : GOLD },
            { val: String(totSiS), lbl: 'School-Caused SIs', color: GOLD },
            { val: String(hiCt),   lbl: 'High Impact',   color: GREEN },
            { val: String(onCt),   lbl: 'On Track',      color: BLUE  },
            { val: String(nsCt),   lbl: 'Needs Support', color: RED   },
          ];
          if (chips2.length) {
            const chipW2 = 176 / chips2.length;
            chips2.forEach((c, i) => {
              const cx = 20 + i * chipW2;
              doc.setFillColor(248,250,255); doc.roundedRect(cx, p3y, chipW2-2, 14, 1.5, 1.5, 'F');
              doc.setFillColor(...c.color); doc.rect(cx, p3y, chipW2-2, 1.5, 'F');
              doc.setTextColor(...c.color); doc.setFontSize(9); doc.setFont('helvetica','bold');
              doc.text(safe(c.val), cx + (chipW2-2)/2, p3y+8, {align:'center'});
              doc.setTextColor(100,115,135); doc.setFontSize(5); doc.setFont('helvetica','normal');
              doc.text(safe(c.lbl), cx + (chipW2-2)/2, p3y+12.5, {align:'center'});
            });
            p3y += 18;
          }

          // ── Main leaderboard table ─────────────────────────────────────────
          p3y += 2;
          doc.setFontSize(7); doc.setFont('helvetica','bold'); doc.setTextColor(...NAVY);
          doc.text('TUTOR LEADERBOARD \u00B7 RANKED BY MEDIAN % TYPICAL GROWTH (MIN 3 SCHOLARS)', 20, p3y);
          p3y += 4;

          const hasPearlData = opsMap !== null;
          const impactHead = hasPearlData
            ? [['Tutor','N','Med % Typ','Mo Gained','Med Gain','\u2191Up/\u2193Dn','Hours','Sch Att%','SIs T/S','Sch Sat.','Tutor Surv.','Tier']]
            : [['Tutor','N','Med % Typ','Mo Gained','Med Gain','\u2191 Up','\u2193 Down','Tier']];

          const impactBody = tutorImpact.slice(0, 30).map(t => {
            const nm = t.name.length > 26 ? t.name.slice(0, 25) + '\u2026' : t.name;
            const base = [
              safe(nm), t.n, t.medianPct + '%',
              t.medianMonths !== null ? t.medianMonths + ' mo' : '\u2014',
              t.medianGain !== null ? (t.medianGain > 0 ? '+' : '') + t.medianGain : '\u2014',
            ];
            if (hasPearlData) {
              return [
                ...base,
                t.movedUp + ' / ' + t.movedDown,
                t.hours > 0 ? t.hours + 'h' : '\u2014',
                t.scholAttRate !== null ? t.scholAttRate + '%' : '\u2014',
                t.siTutor + 'T / ' + t.siSchool + 'S',
                t.scholSurveyAvg !== null ? t.scholSurveyAvg.toFixed(2) : '\u2014',
                t.tutorSurveyAvg !== null ? t.tutorSurveyAvg.toFixed(2) : '\u2014',
                t.tier,
              ];
            }
            return [...base, t.movedUp, t.movedDown, t.tier];
          });

          const tierCol = hasPearlData ? 11 : 7;
          const pctCol  = 2;
          const moCol   = 3;
          const attCol  = hasPearlData ? 7  : -1;

          doc.autoTable({
            startY: p3y,
            head:   impactHead,
            body:   impactBody,
            headStyles:          { fillColor: NAVY, textColor: WHITE, fontSize: 6, fontStyle: 'bold' },
            bodyStyles:          { fontSize: 5.5, cellPadding: 1.5 },
            alternateRowStyles:  { fillColor: [245, 248, 255] },
            styles:              { overflow: 'linebreak', cellPadding: 1.8 },
            margin:              { left: 20, right: 20 },
            columnStyles: hasPearlData ? {
              0: { cellWidth: 32 },
              1: { cellWidth: 9,  halign: 'center' },
              2: { cellWidth: 14, halign: 'center' },
              3: { cellWidth: 13, halign: 'center' },
              4: { cellWidth: 12, halign: 'center' },
              5: { cellWidth: 13, halign: 'center' },
              6: { cellWidth: 12, halign: 'center' },
              7: { cellWidth: 13, halign: 'center' },
              8: { cellWidth: 13, halign: 'center' },
              9: { cellWidth: 12, halign: 'center' },
             10: { cellWidth: 12, halign: 'center' },
             11: { cellWidth: 19, halign: 'center' },
            } : {
              0: { cellWidth: 52 },
              1: { cellWidth: 13, halign: 'center' },
              2: { cellWidth: 22, halign: 'center' },
              3: { cellWidth: 18, halign: 'center' },
              4: { cellWidth: 18, halign: 'center' },
              5: { cellWidth: 13, halign: 'center' },
              6: { cellWidth: 13, halign: 'center' },
              7: { cellWidth: 22, halign: 'center' },
            },
            didParseCell: function(d) {
              if (d.section !== 'body') return;
              // Color-code % typical
              if (d.column.index === pctCol) {
                const v = parseInt(d.cell.raw);
                if (!isNaN(v)) {
                  d.cell.styles.textColor = v >= 80 ? GREEN : v >= 50 ? [180, 100, 0] : RED;
                  d.cell.styles.fontStyle = 'bold';
                }
              }
              // Color-code months gained
              if (d.column.index === moCol) {
                const v = parseFloat(d.cell.raw);
                if (!isNaN(v)) {
                  d.cell.styles.textColor = v >= 8 ? GREEN : v >= 5 ? [180, 100, 0] : RED;
                  d.cell.styles.fontStyle = 'bold';
                }
              }
              // Color-code tier
              if (d.column.index === tierCol) {
                if (d.cell.raw === 'High Impact')   { d.cell.styles.textColor = GREEN; d.cell.styles.fontStyle = 'bold'; }
                if (d.cell.raw === 'Needs Support') { d.cell.styles.textColor = RED; }
              }
              // Color-code scholar att rate
              if (hasPearlData && d.column.index === attCol) {
                const v = parseInt(d.cell.raw);
                if (!isNaN(v)) d.cell.styles.textColor = v >= 85 ? GREEN : v >= 75 ? [180, 100, 0] : RED;
              }
            },
          });
          p3y = doc.lastAutoTable.finalY + 6;

          // ── Service interruption breakdown ─────────────────────────────────
          if (hasPearlData && (tutorImpact.some(t => t.siTutor > 0 || t.siSchool > 0))) {
            if (p3y > 252) { doc.addPage(); p3y = 20; }
            doc.setFontSize(7); doc.setFont('helvetica','bold'); doc.setTextColor(...NAVY);
            doc.text('SERVICE INTERRUPTION ANALYSIS \u00B7 TUTOR-CAUSED vs SCHOOL-CAUSED', 20, p3y);
            p3y += 4;
            // Top tutors by tutor-caused SIs (excluding zero)
            const withSI = tutorImpact.filter(t => t.siTutor > 0 || t.siSchool > 0)
              .sort((a, b) => (b.siTutor + b.siSchool) - (a.siTutor + a.siSchool)).slice(0, 8);
            if (withSI.length) {
              doc.autoTable({
                startY: p3y,
                head:   [['Tutor','Scholars','Tutor-Caused SIs','School-Caused SIs','Other SIs','Total SIs','Impact on Growth']],
                body:   withSI.map(t => [
                  safe(t.name.length > 28 ? t.name.slice(0,27)+'\u2026' : t.name),
                  t.n,
                  t.siTutor  > 0 ? '\u26a0 ' + t.siTutor  : '0',
                  t.siSchool > 0 ? t.siSchool : '0',
                  t.siOther  > 0 ? t.siOther  : '0',
                  t.siTutor + t.siSchool + t.siOther,
                  t.tier === 'High Impact' ? 'Mitigated' : t.siTutor > 3 ? 'Likely impacted' : 'Monitor',
                ]),
                headStyles:         { fillColor: [150, 60, 0], textColor: WHITE, fontSize: 6.5, fontStyle: 'bold' },
                bodyStyles:         { fontSize: 6, cellPadding: 1.8 },
                alternateRowStyles: { fillColor: [255, 248, 240] },
                styles:             { overflow: 'linebreak' },
                margin:             { left: 20, right: 20 },
                columnStyles: {
                  0: { cellWidth: 40 }, 1: { cellWidth: 14, halign: 'center' },
                  2: { cellWidth: 26, halign: 'center' }, 3: { cellWidth: 26, halign: 'center' },
                  4: { cellWidth: 16, halign: 'center' }, 5: { cellWidth: 16, halign: 'center' },
                  6: { cellWidth: 32, halign: 'center' },
                },
                didParseCell: function(d) {
                  if (d.section !== 'body') return;
                  if (d.column.index === 2) {
                    const v = parseInt(d.cell.raw);
                    if (!isNaN(v) && v > 0) { d.cell.styles.textColor = RED; d.cell.styles.fontStyle = 'bold'; }
                  }
                },
              });
              p3y = doc.lastAutoTable.finalY + 6;
            }
          }

          // ── Survey summary ────────────────────────────────────────────────
          if (hasPearlData && tutorImpact.some(t => t.tutorSurveyAvg !== null || t.scholSurveyAvg !== null)) {
            if (p3y > 252) { doc.addPage(); p3y = 20; }
            doc.setFontSize(7); doc.setFont('helvetica','bold'); doc.setTextColor(...NAVY);
            doc.text('SURVEY DATA \u00B7 TUTOR & SCHOLAR SATISFACTION BY INSTRUCTOR', 20, p3y);
            p3y += 4;
            const withSurvey = tutorImpact.filter(t => t.tutorSurveyAvg !== null || t.scholSurveyAvg !== null)
              .sort((a, b) => (b.tutorSurveyAvg || 0) - (a.tutorSurveyAvg || 0)).slice(0, 10);
            if (withSurvey.length) {
              doc.autoTable({
                startY: p3y,
                head:   [['Tutor','Scholars','Med % Typical','Tutor Survey Avg','Scholar Sat. Avg','Survey-Growth Signal']],
                body:   withSurvey.map(t => [
                  safe(t.name.length > 28 ? t.name.slice(0,27)+'\u2026' : t.name),
                  t.n,
                  t.medianPct + '%',
                  t.tutorSurveyAvg !== null ? t.tutorSurveyAvg.toFixed(2) + ' / 5' : '\u2014',
                  t.scholSurveyAvg !== null ? t.scholSurveyAvg.toFixed(2) + ' / 5' : '\u2014',
                  (t.tutorSurveyAvg !== null && t.medianPct >= 80)  ? 'High sat. + High growth'
                    : (t.tutorSurveyAvg !== null && t.medianPct < 50) ? 'Survey gap \u2014 coach'
                    : 'Monitor',
                ]),
                headStyles:         { fillColor: [30, 80, 150], textColor: WHITE, fontSize: 6.5, fontStyle: 'bold' },
                bodyStyles:         { fontSize: 6, cellPadding: 1.8 },
                alternateRowStyles: { fillColor: [240, 246, 255] },
                styles:             { overflow: 'linebreak' },
                margin:             { left: 20, right: 20 },
                columnStyles: {
                  0: { cellWidth: 40 }, 1: { cellWidth: 14, halign: 'center' },
                  2: { cellWidth: 22, halign: 'center' }, 3: { cellWidth: 28, halign: 'center' },
                  4: { cellWidth: 28, halign: 'center' }, 5: { cellWidth: 42 },
                },
                didParseCell: function(d) {
                  if (d.section !== 'body') return;
                  if (d.column.index === 3) {
                    const v = parseFloat(d.cell.raw);
                    if (!isNaN(v)) d.cell.styles.textColor = v >= 4 ? GREEN : v >= 3 ? [180, 100, 0] : RED;
                  }
                  if (d.column.index === 4) {
                    const v = parseFloat(d.cell.raw);
                    if (!isNaN(v)) d.cell.styles.textColor = v >= 4 ? GREEN : v >= 3 ? [180, 100, 0] : RED;
                  }
                },
              });
              p3y = doc.lastAutoTable.finalY + 4;
            }
          }

          // ── Highlight callouts ────────────────────────────────────────────
          if (p3y < 255) {
            const highImpact  = tutorImpact.filter(t => t.tier === 'High Impact');
            const needsSupport = tutorImpact.filter(t => t.tier === 'Needs Support');
            if (highImpact.length) {
              doc.setFontSize(6.5); doc.setFont('helvetica','bold'); doc.setTextColor(...GREEN);
              doc.text('\u2605 High Impact: ' + highImpact.slice(0,6).map(t=>safe(t.name)).join(', '), 20, p3y);
              p3y += 6;
            }
            if (needsSupport.length) {
              doc.setFontSize(6.5); doc.setFont('helvetica','italic'); doc.setTextColor(...RED);
              doc.text('\u25b6 Coaching support recommended: ' + needsSupport.slice(0,4).map(t=>safe(t.name)).join(', '), 20, p3y);
              p3y += 5;
            }
          }
        } else {
          // No tutor-level Pearl match -- show full iReady academic breakdown by region & school
          doc.setFontSize(7); doc.setFont('helvetica','bold'); doc.setTextColor(...NAVY);
          doc.text('ACADEMIC PERFORMANCE BY REGION & SCHOOL', 20, p3y);
          p3y += 4;
          doc.setFontSize(6); doc.setFont('helvetica','italic'); doc.setTextColor(100,120,145);
          const _p3Note = opsMap
            ? 'Pearl data was loaded but no tutor-scholar matches were found. Showing iReady-only academic breakdown.'
            : 'Pearl operational data was not loaded. Showing iReady-only academic breakdown by region and school.';
          doc.text(safe(_p3Note), 20, p3y); p3y += 6;

          // Region breakdown table
          const _p3Regions = Object.entries(metrics.byRegion)
            .filter(([,m]) => m.withGrowth > 0)
            .sort((a,b) => (b[1].medianPctTypical||0) - (a[1].medianPctTypical||0));
          if (_p3Regions.length) {
            doc.setFontSize(7); doc.setFont('helvetica','bold'); doc.setTextColor(...NAVY);
            doc.text('REGION PERFORMANCE', 20, p3y); p3y += 3;
            doc.autoTable({
              startY: p3y,
              head: [['Region','N','w/ Growth','Med % Typical','% Met Typical','Med Gain','Moved Up','Moved Down']],
              body: _p3Regions.map(([rg,m]) => [
                safe(rg), m.total, m.withGrowth,
                m.medianPctTypical!==null?m.medianPctTypical+'%':'--',
                m.pctMetTypical!==null?m.pctMetTypical+'%':'--',
                m.medianGain!==null?(m.medianGain>0?'+':'')+m.medianGain:'--',
                m.movedUp||0, m.movedDown||0,
              ]),
              headStyles:{ fillColor:NAVY, textColor:WHITE, fontSize:6.5, fontStyle:'bold' },
              bodyStyles:{ fontSize:6, cellPadding:1.8 },
              alternateRowStyles:{ fillColor:[245,248,255] },
              styles:{ overflow:'linebreak', cellPadding:2 },
              margin:{ left:20, right:20 },
              didParseCell: function(d) {
                if (d.section!=='body') return;
                if (d.column.index===3) {
                  const v=parseInt(d.cell.raw);
                  if (!isNaN(v)) { d.cell.styles.textColor=v>=80?GREEN:v>=50?[180,100,0]:RED; d.cell.styles.fontStyle='bold'; }
                }
              },
            });
            p3y = doc.lastAutoTable.finalY + 5;
          }

          // All schools with any growth data
          // All schools in the MOY sheet — includes winter-only (no Fall pair) with N/A growth
          // withGrowth=0 means scholars are in the sheet but have no Fall baseline (winter-only)
          const _p3Schools = Object.entries(metrics.bySchool)
            .filter(([sc,m]) => m.total >= 1 && sc !== 'Unknown')
            .sort((a,b) => {
              // Schools with growth data first (sorted by median % typical desc), then winter-only last
              const aHas = a[1].withGrowth > 0, bHas = b[1].withGrowth > 0;
              if (aHas && !bHas) return -1;
              if (!aHas && bHas) return 1;
              return (b[1].medianPctTypical||0) - (a[1].medianPctTypical||0);
            });
          if (_p3Schools.length) {
            doc.setFontSize(7); doc.setFont('helvetica','bold'); doc.setTextColor(...NAVY);
            doc.text('ALL SCHOOLS IN MOY DATA \u00B7 SORTED BY MEDIAN % TYPICAL GROWTH', 20, p3y); p3y += 3;
            // Legend for markers
            doc.setFontSize(5.5); doc.setFont('helvetica','normal'); doc.setTextColor(100,120,145);
            doc.text('* = fewer than 3 scholars with growth data  |  (W) = Winter diagnostic only -- no Fall baseline, growth not calculable', 20, p3y); p3y += 4;
            doc.autoTable({
              startY: p3y,
              head: [['School','N (Total)','N (Growth)','Med % Typical','% Met Typical','Med Gain','Up / Down']],
              body: _p3Schools.map(([sc,m]) => {
                const nameTag = m.withGrowth===0?' (W)':m.withGrowth<3?' *':'';
                return [
                  safe((sc.length>36?sc.slice(0,35)+'...':sc)+nameTag),
                  m.total,
                  m.withGrowth>0?m.withGrowth:'--',
                  m.withGrowth>0&&m.medianPctTypical!==null?m.medianPctTypical+'%':'N/A',
                  m.withGrowth>0&&m.pctMetTypical!==null?m.pctMetTypical+'%':'N/A',
                  m.withGrowth>0&&m.medianGain!==null?(m.medianGain>0?'+':'')+m.medianGain:'N/A',
                  m.withGrowth>0?(m.movedUp||0)+' / '+(m.movedDown||0):'N/A',
                ];
              }),
              headStyles:{ fillColor:NAVY, textColor:WHITE, fontSize:6.5, fontStyle:'bold' },
              bodyStyles:{ fontSize:6, cellPadding:1.8 },
              alternateRowStyles:{ fillColor:[245,248,255] },
              styles:{ overflow:'linebreak', cellPadding:2 },
              margin:{ left:20, right:20 },
              columnStyles:{
                0:{ cellWidth:54 },
                1:{ cellWidth:16, halign:'center' },
                2:{ cellWidth:16, halign:'center' },
                3:{ cellWidth:22, halign:'center' },
                4:{ cellWidth:22, halign:'center' },
                5:{ cellWidth:16, halign:'center' },
                6:{ cellWidth:20, halign:'center' },
              },
              didParseCell: function(d) {
                if (d.section!=='body') return;
                if (d.column.index===3) {
                  if (d.cell.raw==='N/A') { d.cell.styles.textColor=[160,160,160]; return; }
                  const v=parseInt(d.cell.raw);
                  if (!isNaN(v)) { d.cell.styles.textColor=v>=80?GREEN:v>=50?[180,100,0]:RED; d.cell.styles.fontStyle='bold'; }
                }
                if (d.column.index===4||d.column.index===5||d.column.index===6) {
                  if (d.cell.raw==='N/A') d.cell.styles.textColor=[160,160,160];
                }
              },
            });
            p3y = doc.lastAutoTable.finalY + 3;
          }

          // Rush flag summary
          if (NET.rushFlags && NET.rushFlags.red > 0) {
            doc.setFontSize(6.5); doc.setFont('helvetica','bold'); doc.setTextColor(...RED);
            doc.text(safe(NET.rushFlags.red+' scholar'+(NET.rushFlags.red!==1?'s':'')+' flagged with Red Rush on Winter diagnostic — included in calculations, review recommended.'), 20, p3y);
            p3y += 5;
          }
          if (NET.rushFlags && NET.rushFlags.yellow > 0) {
            doc.setFontSize(6.5); doc.setFont('helvetica','normal'); doc.setTextColor(180,100,0);
            doc.text(safe(NET.rushFlags.yellow+' scholar'+(NET.rushFlags.yellow!==1?'s have':' has')+' a Yellow Rush Flag -- growth may be slightly inflated.'), 20, p3y);
          }
        }
        doc.setFontSize(6.5); doc.setTextColor(100,120,145);
        doc.text('Scholar\u2013tutor match: Pearl student ID (primary) \u00B7 name (secondary) \u00B7 school-scoped last-name (fallback)  \u00B7  iReady + Pearl Operational Data + Surveys  \u00B7  Confidential', 108, 272, {align:'center'});

        // ── PAGE 4: Next Steps ───────────────────────────────────────────────
        doc.addPage();
        doc.setFillColor(...NAVY); doc.rect(0,0,216,14,'F');
        doc.setTextColor(...WHITE); doc.setFontSize(9); doc.setFont('helvetica','bold');
        doc.text('WHAT THIS MEANS \u00B7 NEXT STEPS FOR PROGRAM LEADERSHIP', 20, 9);

        const pct2 = NET.medianPctTypical||0;
        const pctNeedsAccel2 = NET.pctNeedsAccel||0;
        let p4y = 18;

        // ── Status banner ──────────────────────────────────────────────────
        const _p4StatusColor = pct2>=80 ? GREEN : pct2>=50 ? [210,145,0] : RED;
        const _p4StatusLabel = pct2>=80 ? 'ON TRACK' : pct2>=50 ? 'PROGRESSING -- NEEDS TARGETED SUPPORT' : 'CRITICAL -- IMMEDIATE ACTION REQUIRED';
        doc.setFillColor(..._p4StatusColor); doc.roundedRect(20, p4y, 176, 10, 2, 2, 'F');
        doc.setTextColor(...WHITE); doc.setFontSize(8); doc.setFont('helvetica','bold');
        doc.text(safe('MID-YEAR STATUS: '+_p4StatusLabel), 108, p4y+6.5, {align:'center'});
        p4y += 13;

        // ── Region data ──────────────────────────────────────────────────
        const _p4Regions = Object.entries(metrics.byRegion)
          .filter(([,m]) => m.withGrowth > 0)
          .sort((a,b) => (b[1].medianPctTypical||0) - (a[1].medianPctTypical||0));
        const _p4Best  = _p4Regions[0] || null;
        const _p4Worst = _p4Regions[_p4Regions.length-1] || null;
        const _p4Gap   = (_p4Best && _p4Worst && _p4Best[0] !== _p4Worst[0])
          ? ((_p4Best[1].medianPctTypical||0) - (_p4Worst[1].medianPctTypical||0)) : 0;

        // ── Performance narrative ────────────────────────────────────────
        const _p4Narr = safe(
          'At mid-year, the '+scopeLabel+' '+subject+' cohort shows a median of '+pct2+'% of expected annual growth across '+NET.withGrowth+' scholars with valid diagnostic pairs. ' +
          (_p4Best&&_p4Worst&&_p4Best[0]!==_p4Worst[0]
            ? 'Top region: '+_p4Best[0]+' ('+(_p4Best[1].medianPctTypical||'--')+'% typical). Lowest: '+_p4Worst[0]+' ('+(_p4Worst[1].medianPctTypical||'--')+'% typical) -- a '+_p4Gap+'-point gap requiring attention. '
            : '') +
          NET.movedDown+' scholars dropped a relative placement band ('+(NET.withGrowth>0?Math.round(NET.movedDown/NET.withGrowth*100):0)+'% of those with data; band drop ≠ score regression). '+
          (NET.pctMetTypical||0)+'% met or exceeded typical annual growth' +
          (pctNeedsAccel2>0 ? '; '+pctNeedsAccel2+'% still need acceleration to reach year-end targets.' : '.')
        );
        doc.setFillColor(15,30,55); doc.roundedRect(20, p4y, 176, 22, 2, 2, 'F');
        doc.setFillColor(...GOLD); doc.rect(20, p4y, 3, 22, 'F');
        doc.setTextColor(...WHITE); doc.setFontSize(7); doc.setFont('helvetica','normal');
        doc.text(doc.splitTextToSize(_p4Narr, 162).slice(0,4), 28, p4y+6);
        p4y += 26;

        // ── Key metric chips ─────────────────────────────────────────────
        const _p4Chips = [
          { val: pct2+'%',                       lbl: 'Median % Typical',     col: pct2>=80?GREEN:pct2>=50?[200,140,0]:RED },
          { val: (NET.pctMetTypical||0)+'%',     lbl: '% Met Typical Growth', col: (NET.pctMetTypical||0)>=70?GREEN:(NET.pctMetTypical||0)>=40?[200,140,0]:RED },
          { val: String(NET.movedDown),          lbl: 'Dropped Placement Band', col: NET.movedDown>10?RED:NET.movedDown>3?[200,140,0]:GREEN },
          { val: pctNeedsAccel2+'%',             lbl: '% Need Acceleration',  col: pctNeedsAccel2>40?RED:pctNeedsAccel2>20?[200,140,0]:GREEN },
        ];
        const _p4cw = 176/_p4Chips.length;
        _p4Chips.forEach((c,i) => {
          const cx = 20+i*_p4cw;
          doc.setFillColor(240,244,255); doc.roundedRect(cx, p4y, _p4cw-2, 15, 1.5, 1.5, 'F');
          doc.setFillColor(...c.col); doc.rect(cx, p4y, _p4cw-2, 2, 'F');
          doc.setTextColor(...c.col); doc.setFontSize(10); doc.setFont('helvetica','bold');
          doc.text(safe(String(c.val)), cx+(_p4cw-2)/2, p4y+9, {align:'center'});
          doc.setTextColor(100,115,135); doc.setFontSize(5.5); doc.setFont('helvetica','normal');
          doc.text(safe(c.lbl), cx+(_p4cw-2)/2, p4y+13.5, {align:'center'});
        });
        p4y += 19;

        // ── Region ranking table ─────────────────────────────────────────
        if (_p4Regions.length > 1) {
          doc.setFontSize(7); doc.setFont('helvetica','bold'); doc.setTextColor(...NAVY);
          doc.text('REGION PERFORMANCE RANKING', 20, p4y); p4y += 3;
          doc.autoTable({
            startY: p4y,
            head: [['Rank','Region','N (Data)','Med % Typical','% Met Typical','Med Gain','Regressed','Status']],
            body: _p4Regions.map(([rg,m],i) => {
              const regPct = m.withGrowth>0 ? Math.round(m.movedDown/m.withGrowth*100) : 0;
              const st = (m.medianPctTypical||0)>=80?'On Track':(m.medianPctTypical||0)>=50?'Progressing':'Needs Focus';
              return [
                i+1, safe(rg), m.withGrowth,
                m.medianPctTypical!==null?m.medianPctTypical+'%':'--',
                m.pctMetTypical!==null?m.pctMetTypical+'%':'--',
                m.medianGain!==null?(m.medianGain>0?'+':'')+m.medianGain:'--',
                m.movedDown+' ('+regPct+'%)',
                st,
              ];
            }),
            headStyles:{ fillColor:NAVY, textColor:WHITE, fontSize:6.5, fontStyle:'bold' },
            bodyStyles:{ fontSize:6, cellPadding:1.8 },
            alternateRowStyles:{ fillColor:[245,248,255] },
            styles:{ overflow:'linebreak', cellPadding:2 },
            margin:{ left:20, right:20 },
            columnStyles:{
              0:{ cellWidth:9, halign:'center' },
              1:{ cellWidth:38 },
              2:{ cellWidth:16, halign:'center' },
              3:{ cellWidth:22, halign:'center' },
              4:{ cellWidth:22, halign:'center' },
              5:{ cellWidth:15, halign:'center' },
              6:{ cellWidth:20, halign:'center' },
              7:{ cellWidth:26 },
            },
            didParseCell: function(d) {
              if (d.section!=='body') return;
              if (d.column.index===3) {
                const v=parseInt(d.cell.raw);
                if (!isNaN(v)) { d.cell.styles.textColor=v>=80?GREEN:v>=50?[180,100,0]:RED; d.cell.styles.fontStyle='bold'; }
              }
              if (d.column.index===7) {
                if (d.cell.raw==='On Track') d.cell.styles.textColor=GREEN;
                else if (d.cell.raw==='Needs Focus') { d.cell.styles.textColor=RED; d.cell.styles.fontStyle='bold'; }
              }
            },
          });
          p4y = doc.lastAutoTable.finalY + 5;
        }

        // ── Bottom schools needing attention ──────────────────────────────
        const _p4BotSchools = Object.entries(metrics.bySchool)
          .filter(([,m]) => m.withGrowth >= 1)
          .sort((a,b) => (a[1].medianPctTypical||0) - (b[1].medianPctTypical||0))
          .slice(0, 8);
        const _p4TopSchools = Object.entries(metrics.bySchool)
          .filter(([,m]) => m.withGrowth >= 2)
          .sort((a,b) => (b[1].medianPctTypical||0) - (a[1].medianPctTypical||0))
          .slice(0, 5);

        if (_p4BotSchools.length && p4y < 220) {
          if (p4y > 210) { doc.addPage(); p4y = 20; }
          doc.setFontSize(7); doc.setFont('helvetica','bold'); doc.setTextColor(...RED);
          doc.text('PRIORITY SCHOOLS: LOWEST ACADEMIC GROWTH (ACTION REQUIRED)', 20, p4y); p4y += 3;
          doc.autoTable({
            startY: p4y,
            head: [['School','N','Med % Typical','% Met Typical','Regressed','Priority']],
            body: _p4BotSchools.map(([sc,m]) => {
              const regPct = m.withGrowth>0 ? Math.round(m.movedDown/m.withGrowth*100) : 0;
              const pri = (m.medianPctTypical||0)<30?'CRITICAL':(m.medianPctTypical||0)<50?'High':'Monitor';
              return [
                safe(sc.length>40?sc.slice(0,39)+'...':sc), m.withGrowth,
                m.medianPctTypical!==null?m.medianPctTypical+'%':'--',
                m.pctMetTypical!==null?m.pctMetTypical+'%':'--',
                m.movedDown+' ('+regPct+'%)',
                pri,
              ];
            }),
            headStyles:{ fillColor:[150,20,20], textColor:WHITE, fontSize:6.5, fontStyle:'bold' },
            bodyStyles:{ fontSize:6.5, cellPadding:2 },
            alternateRowStyles:{ fillColor:[255,245,245] },
            styles:{ overflow:'linebreak', cellPadding:2 },
            margin:{ left:20, right:20 },
            columnStyles:{
              0:{ cellWidth:58 },
              1:{ cellWidth:12, halign:'center' },
              2:{ cellWidth:22, halign:'center' },
              3:{ cellWidth:22, halign:'center' },
              4:{ cellWidth:22, halign:'center' },
              5:{ cellWidth:28, halign:'center' },
            },
            didParseCell: function(d) {
              if (d.section!=='body') return;
              if (d.column.index===2) {
                const v=parseInt(d.cell.raw);
                if (!isNaN(v)) { d.cell.styles.textColor=v>=80?GREEN:v>=50?[180,100,0]:RED; d.cell.styles.fontStyle='bold'; }
              }
              if (d.column.index===5) {
                if (d.cell.raw==='CRITICAL') { d.cell.styles.textColor=RED; d.cell.styles.fontStyle='bold'; }
                else if (d.cell.raw==='High') d.cell.styles.textColor=[180,100,0];
              }
            },
          });
          p4y = doc.lastAutoTable.finalY + 5;
        }

        if (_p4TopSchools.length && p4y < 210) {
          doc.setFontSize(7); doc.setFont('helvetica','bold'); doc.setTextColor(...GREEN);
          doc.text('TOP PERFORMING SCHOOLS: MODELS FOR NETWORK REPLICATION', 20, p4y); p4y += 3;
          doc.autoTable({
            startY: p4y,
            head: [['School','N','Med % Typical','% Met Typical','Med Gain']],
            body: _p4TopSchools.map(([sc,m]) => [
              safe(sc.length>50?sc.slice(0,49)+'...':sc), m.withGrowth,
              m.medianPctTypical!==null?m.medianPctTypical+'%':'--',
              m.pctMetTypical!==null?m.pctMetTypical+'%':'--',
              m.medianGain!==null?(m.medianGain>0?'+':'')+m.medianGain:'--',
            ]),
            headStyles:{ fillColor:GREEN, textColor:WHITE, fontSize:6.5, fontStyle:'bold' },
            bodyStyles:{ fontSize:6.5, cellPadding:2 },
            alternateRowStyles:{ fillColor:[240,255,247] },
            styles:{ overflow:'linebreak', cellPadding:2 },
            margin:{ left:20, right:20 },
          });
          p4y = doc.lastAutoTable.finalY + 5;
        }

        // ── Recommended action items ──────────────────────────────────────
        if (p4y > 220) { doc.addPage(); p4y = 20; }
        doc.setFontSize(7); doc.setFont('helvetica','bold'); doc.setTextColor(...NAVY);
        doc.text('RECOMMENDED ACTIONS FOR PROGRAM LEADERSHIP', 20, p4y); p4y += 4;

        // Helper: format school callout with N-size context for readers
        const _p4SchoolRef = (sc, m) => {
          const nm = safe(sc.length>40?sc.slice(0,39)+'...':sc);
          const nNote = m.withGrowth<3 ? ' (NOTE: small sample, n='+m.withGrowth+' -- interpret with caution)' : ' (n='+m.withGrowth+' scholars with growth data)';
          return nm + nNote;
        };

        const _p4Actions = [
          {
            title: pct2>=80?'Sustain Momentum Through Spring Window':pct2>=50?'Intensify Support Before Spring Diagnostic':'Launch Immediate Intervention Protocol',
            detail: pct2>=80
              ? 'With '+pct2+'% median typical growth (n='+NET.withGrowth+' scholars), the network is on track. Focus on the '+NET.movedDown+' scholars who regressed in placement. Schedule PM check-ins and prioritize these scholars in upcoming sessions.'
              : pct2>=50
              ? 'At '+pct2+'% of typical growth (n='+NET.withGrowth+' scholars with valid data), the network needs a push. Identify all scholars below 50% typical growth and connect tutors with coaching support before the spring window closes.'
              : 'Network-wide median of '+pct2+'% (n='+NET.withGrowth+' scholars) is critical. Immediately review session quality, attendance, and caseloads. Escalate '+NET.movedDown+' regressed scholars to program leadership for direct intervention.',
          },
          ...(_p4Gap>15&&_p4Best&&_p4Worst?[{
            title: 'Close the '+_p4Gap+'-Point Regional Performance Gap',
            detail: safe(_p4Worst[0])+' (n='+_p4Worst[1].withGrowth+') is '+_p4Gap+' points behind '+safe(_p4Best[0])+' (n='+_p4Best[1].withGrowth+'). Schedule a regional PM call to identify root causes: staffing gaps, attendance trends, or session frequency issues.',
          }]:[]),
          ...(_p4BotSchools.length?[{
            title: 'Engage Program Managers at Lowest-Growth Schools',
            detail: _p4SchoolRef(_p4BotSchools[0][0],_p4BotSchools[0][1])+' -- '+(_p4BotSchools[0][1].medianPctTypical||'--')+'% median typical growth. PMs should conduct school visits, review scholar attendance, and evaluate session scheduling at all bottom-tier sites.',
          }]:[]),
          ...(_p4TopSchools.length?[{
            title: 'Document and Replicate Best Practices from Top Schools',
            detail: _p4SchoolRef(_p4TopSchools[0][0],_p4TopSchools[0][1])+(_p4TopSchools[0][1].medianPctTypical!==null?' -- '+_p4TopSchools[0][1].medianPctTypical+'% typical growth':'')+'. Note sample size when benchmarking. Document session structure and PM engagement -- share with underperforming sites before spring.',
          }]:[]),
          {
            title: 'Address '+NET.movedDown+' Scholar Regressions in Relative Placement',
            detail: NET.movedDown+' of '+NET.withGrowth+' scholars ('+(NET.withGrowth>0?Math.round(NET.movedDown/NET.withGrowth*100):0)+'%) moved down in relative placement from Fall to Winter. Cross-reference with attendance records -- scholars below 75% attendance show significantly higher regression rates.',
          },
          ...(opsMap?[{
            title: 'Use Tutor Tier Data to Drive Coaching Conversations',
            detail: 'Pearl data is loaded. Review tutors in the Needs Support tier (page 3) and schedule coaching conversations with their Program Managers. Focus on schools with the highest tutor-caused service interruption counts.',
          }]:[{
            title: 'Load Pearl Data to Unlock Tutor-Level Analysis',
            detail: 'Pearl operational data was not available for this export. Load Pearl data and re-export the PDF to enable tutor impact matching, instructional hours correlations, and service interruption analysis by tutor and school.',
          }]),
          ...(NET.rushFlags&&NET.rushFlags.red>0?[{
            title: 'Review '+NET.rushFlags.red+' Red Rush Flag Scholar'+(NET.rushFlags.red!==1?'s':''),
            detail: NET.rushFlags.red+' scholar'+(NET.rushFlags.red!==1?'s have':'has')+' a Red Rush Flag on their Winter diagnostic. These scholars ARE included in all growth calculations. Review testing conditions and contact iReady if re-administration is warranted.',
          }]:[]),
        ];

        _p4Actions.slice(0,7).forEach((item,i) => {
          if (p4y > 258) return;
          const boxH = 20;
          doc.setFillColor(15,30,55); doc.roundedRect(20, p4y, 176, boxH, 2, 2, 'F');
          doc.setFillColor(...GOLD); doc.circle(28, p4y+boxH/2, 4.5, 'F');
          doc.setTextColor(...NAVY); doc.setFontSize(9); doc.setFont('helvetica','bold');
          doc.text(String(i+1), 28, p4y+boxH/2+3.5, {align:'center'});
          doc.setTextColor(...GOLD); doc.setFontSize(7); doc.setFont('helvetica','bold');
          doc.text(safe(item.title), 36, p4y+6.5);
          doc.setTextColor(...WHITE); doc.setFontSize(6.5); doc.setFont('helvetica','normal');
          doc.text(doc.splitTextToSize(safe(item.detail), 158).slice(0,2), 36, p4y+11);
          p4y += boxH+2;
        });

        doc.setFontSize(7); doc.setTextColor(100,120,145);
        doc.text('Data Source: iReady SY 2025\u20132026  \u00B7  NJTC Central Team Staff Portal  \u00B7  Confidential', 108, 272, {align:'center'});

        // ── PAGE 5: Operational + Academic Marriage ──────────────────────────
        if (opsMap && tutorImpact.length) {
          doc.addPage();
          doc.setFillColor(...NAVY); doc.rect(0,0,216,14,'F');
          doc.setTextColor(...WHITE); doc.setFontSize(9); doc.setFont('helvetica','bold');
          doc.text('OPERATIONAL IMPACT ON ACADEMIC GROWTH · ' + subject.toUpperCase(), 20, 9);
          let p5y = 18;

          // Plain-language intro for teachers
          doc.setFillColor(240,244,255); doc.roundedRect(20, p5y, 176, 16, 2, 2, 'F');
          doc.setFillColor(...BLUE); doc.rect(20, p5y, 3, 16, 'F');
          doc.setTextColor(...NAVY); doc.setFontSize(7); doc.setFont('helvetica','bold');
          doc.text('WHAT IS THIS PAGE?', 28, p5y+5);
          doc.setFont('helvetica','normal'); doc.setFontSize(6.5); doc.setTextColor(30,50,90);
          const p5intro = 'This page connects what happened in sessions (service interruptions, attendance, surveys) with how much scholars learned. ' +
            'Use it to understand where operational challenges may have limited growth, and where tutors delivered strong outcomes despite disruptions.';
          doc.text(doc.splitTextToSize(safe(p5intro), 162).slice(0,2), 28, p5y+9.5);
          p5y += 20;

          // Network operational snapshot chips
          const totSIs5   = tutorImpact.reduce(function(s,t){ return s + t.siTutor + t.siSchool + t.siOther; }, 0);
          const totSiT5   = tutorImpact.reduce(function(s,t){ return s + t.siTutor; }, 0);
          const totSiS5   = tutorImpact.reduce(function(s,t){ return s + t.siSchool; }, 0);
          const totHrs5   = tutorImpact.reduce(function(s,t){ return s + t.hours; }, 0);
          const tutWAtt5  = tutorImpact.filter(function(t){ return t.scholAttRate !== null; });
          const netAtt5   = tutWAtt5.length ? Math.round(tutWAtt5.reduce(function(s,t){ return s+t.scholAttRate; },0) / tutWAtt5.length) : null;
          const tutWMo5   = tutorImpact.filter(function(t){ return t.medianMonths !== null; });
          const netMo5    = tutWMo5.length ? parseFloat((tutWMo5.reduce(function(s,t){ return s+t.medianMonths; },0) / tutWMo5.length).toFixed(1)) : null;
          const tutWSurv5 = tutorImpact.filter(function(t){ return t.scholSurveyAvg !== null; });
          const netSurv5  = tutWSurv5.length ? parseFloat((tutWSurv5.reduce(function(s,t){ return s+t.scholSurveyAvg; },0) / tutWSurv5.length).toFixed(2)) : null;

          doc.setFontSize(7); doc.setFont('helvetica','bold'); doc.setTextColor(...NAVY);
          doc.text('NETWORK SNAPSHOT · PEARL + IREADY COMBINED', 20, p5y); p5y += 4;

          const opsChips5 = [
            { v: totHrs5.toFixed(1)+'h',               l: 'Inst. Hours',        c: BLUE  },
            { v: netAtt5 !== null ? netAtt5+'%' : '—', l: 'Avg Scholar Att.', c: netAtt5&&netAtt5>=90?GREEN:GOLD },
            { v: totSIs5,                               l: 'Total SIs',          c: totSIs5>20?RED:GOLD },
            { v: totSiT5,                               l: 'Tutor-Caused SIs',   c: totSiT5>10?RED:GOLD },
            { v: totSiS5,                               l: 'School-Caused SIs',  c: GOLD  },
            { v: netSurv5 !== null ? netSurv5+'/5':'—', l: 'Avg Scholar Sat.', c: netSurv5&&netSurv5>=4?GREEN:GOLD },
            { v: netMo5 !== null ? netMo5+' mo':'—',   l: 'Avg Months Gained', c: netMo5&&netMo5>=4.5?GREEN:netMo5&&netMo5>=3.0?GOLD:RED },
          ];
          const opsW5 = 176 / opsChips5.length;
          opsChips5.forEach(function(c,i) {
            const cx = 20 + i*opsW5;
            doc.setFillColor(245,248,255); doc.roundedRect(cx, p5y, opsW5-2, 16, 1.5, 1.5, 'F');
            doc.setFillColor(...c.c); doc.rect(cx, p5y, opsW5-2, 2, 'F');
            doc.setTextColor(...c.c); doc.setFontSize(9); doc.setFont('helvetica','bold');
            doc.text(safe(String(c.v)), cx+(opsW5-2)/2, p5y+9, {align:'center'});
            doc.setTextColor(100,115,135); doc.setFontSize(5); doc.setFont('helvetica','normal');
            doc.text(safe(c.l), cx+(opsW5-2)/2, p5y+14, {align:'center'});
          });
          p5y += 20;

          // SI vs Months table
          doc.setFontSize(7); doc.setFont('helvetica','bold'); doc.setTextColor(...NAVY);
          doc.text('SERVICE INTERRUPTIONS vs MONTHS OF LEARNING GAINED · BY TUTOR', 20, p5y);
          doc.setFontSize(5.5); doc.setFont('helvetica','normal'); doc.setTextColor(100,120,145);
          doc.text('Tutors with high SIs but strong growth demonstrate resilience. High SIs + low growth = coaching conversation needed.', 20, p5y+4);
          p5y += 8;

          const siVsGrowth5 = tutorImpact
            .filter(function(t){ return t.medianMonths !== null; })
            .sort(function(a,b){ return (b.siTutor+b.siSchool)-(a.siTutor+a.siSchool); }).slice(0,20);

          doc.autoTable({
            startY: p5y,
            head: [['Tutor','N','Mo Gained','% Typical','Att%','T-SIs','S-SIs','Hrs','Scholar Sat.','Signal']],
            body: siVsGrowth5.map(function(t) {
              const siTot5 = t.siTutor + t.siSchool;
              const sig5 = siTot5===0
                ? (t.medianMonths>=4.5?'Excellent':t.medianMonths>=3.0?'Good':'Monitor')
                : t.medianMonths>=4.5?'Resilient':siTot5>5?'SIs limited growth':'Monitor';
              return [
                safe(t.name.length>22?t.name.slice(0,21)+'…':t.name),
                t.n,
                t.medianMonths!==null?t.medianMonths+' mo':'—',
                t.medianPct+'%',
                t.scholAttRate!==null?t.scholAttRate+'%':'—',
                t.siTutor>0?'⚠ '+t.siTutor:'0',
                t.siSchool>0?t.siSchool:'0',
                t.hours>0?t.hours+'h':'—',
                t.scholSurveyAvg!==null?t.scholSurveyAvg.toFixed(1)+'/5':'—',
                safe(sig5),
              ];
            }),
            headStyles:{ fillColor:NAVY, textColor:WHITE, fontSize:6, fontStyle:'bold' },
            bodyStyles:{ fontSize:5.5, cellPadding:1.5 },
            alternateRowStyles:{ fillColor:[245,248,255] },
            styles:{ overflow:'linebreak', cellPadding:1.5 },
            margin:{ left:20, right:20 },
            columnStyles:{
              0:{cellWidth:30}, 1:{cellWidth:10,halign:'center'},
              2:{cellWidth:14,halign:'center'}, 3:{cellWidth:13,halign:'center'},
              4:{cellWidth:11,halign:'center'}, 5:{cellWidth:11,halign:'center'},
              6:{cellWidth:11,halign:'center'}, 7:{cellWidth:11,halign:'center'},
              8:{cellWidth:15,halign:'center'}, 9:{cellWidth:30},
            },
            didParseCell: function(d) {
              if (d.section!=='body') return;
              if (d.column.index===2){ const v=parseFloat(d.cell.raw); if(!isNaN(v)){d.cell.styles.textColor=v>=8?GREEN:v>=5?[180,100,0]:RED; d.cell.styles.fontStyle='bold';} }
              if (d.column.index===3){ const v=parseInt(d.cell.raw); if(!isNaN(v)) d.cell.styles.textColor=v>=80?GREEN:v>=50?[180,100,0]:RED; }
              if (d.column.index===5 && d.cell.raw!=='0'){ d.cell.styles.textColor=RED; d.cell.styles.fontStyle='bold'; }
            },
          });
          p5y = doc.lastAutoTable.finalY + 5;

          // Attendance-growth correlation callout
          if (p5y < 242) {
            const hiAtt5 = tutorImpact.filter(function(t){ return t.scholAttRate!==null&&t.scholAttRate>=90&&t.medianMonths!==null; });
            const loAtt5 = tutorImpact.filter(function(t){ return t.scholAttRate!==null&&t.scholAttRate<75&&t.medianMonths!==null; });
            const hiAvg5 = hiAtt5.length ? parseFloat((hiAtt5.reduce(function(s,t){return s+t.medianMonths;},0)/hiAtt5.length).toFixed(1)) : null;
            const loAvg5 = loAtt5.length ? parseFloat((loAtt5.reduce(function(s,t){return s+t.medianMonths;},0)/loAtt5.length).toFixed(1)) : null;
            if (hiAvg5!==null || loAvg5!==null) {
              doc.setFillColor(15,30,55); doc.roundedRect(20, p5y, 176, 22, 2, 2, 'F');
              doc.setFillColor(...GOLD); doc.rect(20, p5y, 3, 22, 'F');
              doc.setTextColor(...GOLD); doc.setFontSize(6.5); doc.setFont('helvetica','bold');
              doc.text('ATTENDANCE → LEARNING CORRELATION', 28, p5y+6);
              doc.setTextColor(...WHITE); doc.setFontSize(6); doc.setFont('helvetica','normal');
              let attNarr5 = '';
              if (hiAvg5!==null && loAvg5!==null) {
                const diff5 = parseFloat((hiAvg5-loAvg5).toFixed(1));
                attNarr5 = 'Tutors with 90%+ scholar attendance averaged '+hiAvg5+' months of learning vs '+loAvg5+' months for sub-75% attendance — a '+(diff5>0?'+':'')+diff5+'-month difference. '+(diff5>2?'Meaningful gap. Attendance conversations with scholars and families should be a PM priority before the spring window.':diff5>0?'Attendance is a positive lever. Continue reinforcing session commitment.':'Attendance gap is minimal this period. Monitor trends into spring.');
              } else {
                attNarr5 = hiAvg5!==null ? 'Tutors with 90%+ scholar attendance averaged '+hiAvg5+' months of learning gained at mid-year.' : 'Tutors with scholar attendance below 75% averaged '+loAvg5+' months of learning. Attendance is a lever for program leaders to act on.';
              }
              doc.text(doc.splitTextToSize(safe(attNarr5), 162).slice(0,3), 28, p5y+11.5);
            }
          }
          doc.setFontSize(6.5); doc.setTextColor(100,120,145);
          doc.text('Source: Pearl Attendance + iReady Diagnostics  ·  NJTC Central Team Staff Portal  ·  Confidential', 108, 272, {align:'center'});
        }

        const regionSlug = scope === 'ALL' ? 'Network' : scope;
        const dateStr = new Date().toISOString().slice(0,10);
        const filename = 'NJTC-MOY-' + subject + '-' + regionSlug + '-' + dateStr + '.pdf';
        doc.save(filename);

      } catch(err) {
        console.error('[MOY PDF]', err);
        alert('PDF generation failed: ' + err.message);
      }
    }

    const MOY_DATA = { math: [], ela: [], loaded: false, ts: null };
    let _moySubject  = 'Math';   // 'Math' | 'ELA'
    let _moyView     = 'overview'; // 'overview' | 'regions' | 'tutor' | 'correlations'
    let _moyLoading  = false;
    let _moyError    = null;
    let _moyComputed = null;

    // ── Standards Mastery (SM) — Middlesex County STEM Charter School ─────────
    // All grade levels combined into one tab (gid=457164791) on the live sheet.
    const SM_SHEET_ID  = '1__l9A4hyX_-4veVUP606sN9rYg9Fa0hE';
    const SM_2PACX     = '2PACX-1vTs5uDk0bg_E4rorRHadFm5i_1lerAlgj5HfSJ3NQPLMDaCbHju0VeEdbaN_mDDzA';
    const SM_ALL_GID   = '457164791';
    const SM_ALL_URL   = `https://docs.google.com/spreadsheets/d/e/${SM_2PACX}/pub?output=csv&gid=${SM_ALL_GID}`;
    const SM_CACHE_KEY = 'njtc_sm_v2'; // bumped — grade now from data column, not tab
    const SM_CACHE_TTL = 2 * 60 * 60 * 1000;
    let SM_DATA        = { rows: [], pairs: [], loaded: false, ts: null };
    let _smLoading     = false;
    let _smError       = null;
    let _smFilterGrade    = 'all';
    let _smFilterInstr    = 'all';
    let _smFilterStandard = 'all';

    // ── MOY row normalizer — maps winter_ prefix fields ───────────────────────
    function normalizeMOYRow(r, subject) {
      // Full header normalization (same pattern as normalizeRow)
      const _rn = {};
      for (const k of Object.keys(r)) {
        _rn[k] = r[k];
        const lk = k.trim().toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/^_+|_+$/g,'');
        if (_rn[lk] === undefined) _rn[lk] = r[k];
        const lk2 = k.toLowerCase().replace(/ /g,'_');
        if (_rn[lk2] === undefined) _rn[lk2] = r[k];
      }
      r = _rn;

      const gv = (...keys) => { for (const k of keys) { if (r[k] !== undefined && r[k] !== '') return r[k]; } return ''; };

      // Derive region using Pearl's canonical NE/SW logic (same as pdf-export.js)
      const extId = gv('external_account_id','external_account_id');
      const school = gv('school');
      const region = _moySchoolRegion(school, extId);

      // winter_pct_progress_typical_growth: ratio where 1.0 = 100% of annual typical growth
      const _rawPct = gv('winter_pct_progress_typical_growth');
      let pctTypical = parseFloat(_rawPct);
      if (isNaN(pctTypical) || _rawPct === '') pctTypical = null;
      else if (typeof _rawPct === 'string' && _rawPct.trim().slice(-1) === '%') pctTypical = pctTypical / 100;
      else if (pctTypical > 15) pctTypical = pctTypical / 100;

      const _rawStretch = gv('winter_pct_progress_stretch_growth');
      let pctStretch = parseFloat(_rawStretch);
      if (isNaN(pctStretch) || _rawStretch === '') pctStretch = null;
      else if (typeof _rawStretch === 'string' && _rawStretch.trim().slice(-1) === '%') pctStretch = pctStretch / 100;
      else if (pctStretch > 15) pctStretch = pctStretch / 100;

      // iReady Winter exports may name this "Weeks Between Diagnostics" (no winter_ prefix),
      // same as Spring exports. Try all known variants so winterWeeks resolves correctly.
      const winterWeeks = parseFloat(gv(
        'winter_weeks_between_diagnostics',
        'weeks_between_diagnostics',
        'Weeks Between Diagnostics',
        'Winter Weeks Between Diagnostics',
        'weeks_between_fall_and_winter_diagnostics',
      )) || 0;
      const winterRush  = gv('winter_rush_flag', 'rush_flag', 'Rush Flag', 'rush flag');
      const baseRush    = gv('base_rush_flag', 'base rush flag', 'Base Rush Flag');
      const isRedRush   = /red/i.test(winterRush);
      // Valid growth = has both Fall + Winter diagnostics (weeks > 0)
      // Red Rush scholars are flagged but INCLUDED in all calculations
      const hasGrowth   = winterWeeks > 0 && pctTypical !== null;

      return {
        subject,
        region,
        school:               gv('school'),
        grade:                gv('student_grade'),
        scholarId:            gv('student_id'),
        scholarName:          gv('full_name'),
        extId,
        // Fall (base) diagnostic
        baseScore:            parseFloat(gv('base_overall_scale_score')) || null,
        baseRelPlacement:     gv('base_overall_relative_placement'),
        // Winter diagnostic
        winterScore:          parseFloat(gv('winter_overall_scale_score')) || null,
        winterRelPlacement:   gv('winter_overall_relative_placement'),
        winterGain:           (function(){ const _g = parseFloat(gv('winter_diagnostic_gain')); return isNaN(_g) ? null : _g; })(),
        winterWeeks,
        winterRush,
        baseRush,
        isRedRush,
        hasGrowth,
        pctTypical,
        pctStretch,
        annualTypical:        parseFloat(gv('annual_typical_growth_measure')) || null,
        // Math domain scores (winter)
        mathNumOpsWinter:     parseFloat(gv('winter_number_and_operations_scale_score')) || null,
        mathAlgebraWinter:    parseFloat(gv('winter_algebra_and_algebraic_thinking_scale_score')) || null,
        mathMeasDataWinter:   parseFloat(gv('winter_measurement_and_data_scale_score')) || null,
        mathGeometryWinter:   parseFloat(gv('winter_geometry_scale_score')) || null,
      };
    }

    // ── MOY fetch — parallel fetch of both CSVs, cache 2hr ───────────────────
    async function _moyFetchLive(force = false) {
      if (_moyLoading) return;
      // Check cache
      if (!force) {
        try {
          const c = JSON.parse(localStorage.getItem(MOY_CACHE_KEY) || 'null');
          if (c && c.ts && (Date.now() - c.ts) < MOY_CACHE_TTL) {
            MOY_DATA.math   = c.math   || [];
            MOY_DATA.ela    = c.ela    || [];
            MOY_DATA.loaded = true;
            MOY_DATA.ts     = c.ts;
            _moyComputed    = null; // reset so re-compute happens
            return;
          }
        } catch(e) {}
      }
      _moyLoading = true;
      _moyError   = null;
      try {
        const bust = force ? '&t=' + Date.now() : '';
        const [mathRes, elaRes] = await Promise.all([
          fetch(MOY_MATH_URL + bust, { signal: AbortSignal.timeout(30000) }),
          fetch(MOY_ELA_URL  + bust, { signal: AbortSignal.timeout(30000) }),
        ]);
        const [mathText, elaText] = await Promise.all([mathRes.text(), elaRes.text()]);
        MOY_DATA.math   = parseCSV(mathText).map(r => normalizeMOYRow(r, 'Math')).filter(r => r.scholarId || r.scholarName);
        MOY_DATA.ela    = parseCSV(elaText).map(r => normalizeMOYRow(r, 'ELA')).filter(r => r.scholarId || r.scholarName);
        MOY_DATA.loaded = true;
        MOY_DATA.ts     = Date.now();
        _moyComputed    = null; // invalidate computed cache
        try { localStorage.setItem(MOY_CACHE_KEY, JSON.stringify({ ts: MOY_DATA.ts, math: MOY_DATA.math, ela: MOY_DATA.ela })); } catch(e) {}
      } catch(e) {
        _moyError = 'Could not load MOY data. Check your connection and try again.';
        console.warn('[MOY] fetch failed:', e.message);
      } finally {
        _moyLoading = false;
      }
    }

    // ── MOY median helper (same pattern as existing medianArr) ────────────────
    function _moyMedian(arr) {
      if (!arr.length) return null;
      const s = arr.slice().sort((a, b) => a - b);
      const m = Math.floor(s.length / 2);
      return s.length % 2 ? s[m] : (s[m-1] + s[m]) / 2;
    }

    // ── Placement shift helper ────────────────────────────────────────────────
    function _moyPlShift(base, winter) {
      const bi = PLACEMENT_ORDER.indexOf(base);
      const wi = PLACEMENT_ORDER.indexOf(winter);
      if (bi < 0 || wi < 0) return 'held';
      if (wi > bi) return 'up';
      if (wi < bi) return 'down';
      return 'held';
    }

    // ── MOY compute engine ────────────────────────────────────────────────────
    // Returns { network, byRegion, bySchool } each a metricBlock
    function computeMOY(rows) {
      function metricBlock(subset) {
        const total     = subset.length;
        const valid     = subset.filter(r => r.hasGrowth); // Fall+Winter pair (red rush flagged but included)
        const withGrowth = valid.length;
        const plShifts  = valid.filter(r => PLACEMENT_ORDER.includes(r.baseRelPlacement) && PLACEMENT_ORDER.includes(r.winterRelPlacement));
        const movedUp   = plShifts.filter(r => _moyPlShift(r.baseRelPlacement, r.winterRelPlacement) === 'up').length;
        const held      = plShifts.filter(r => _moyPlShift(r.baseRelPlacement, r.winterRelPlacement) === 'held').length;
        const movedDown = plShifts.filter(r => _moyPlShift(r.baseRelPlacement, r.winterRelPlacement) === 'down').length;
        const gains     = valid.map(r => r.winterGain).filter(v => v !== null && !isNaN(v));
        const pcts      = valid.map(r => r.pctTypical).filter(v => v !== null && !isNaN(v));
        // months of learning = pctTypical × winterWeeks / 4
        // Uses actual weeks between Fall and Winter diagnostics per scholar (same approach as EOY).
        const months    = valid.filter(r => r.pctTypical !== null && r.winterWeeks > 0)
                               .map(r => r.pctTypical * (r.winterWeeks / 4));
        const metTyp    = pcts.filter(v => v >= 1.0);
        const progressing = pcts.filter(v => v >= 0.5 && v < 1.0);
        const needsAccel  = pcts.filter(v => v >= 0 && v < 0.5);
        const regressed   = pcts.filter(v => v < 0);
        const winterOnlyCount = subset.filter(r => r.winterWeeks === 0).length;
        const redRushCount    = subset.filter(r => r.isRedRush).length;
        const yellowRushCount = subset.filter(r => /yellow/i.test(r.winterRush)).length;

        // Placement distribution — Fall (BOY) and Winter (MOY) snapshots
        const placementDist = {};
        const fallPlacementDist = {};
        PLACEMENT_ORDER.forEach(p => { placementDist[p] = 0; fallPlacementDist[p] = 0; });
        subset.forEach(r => {
          if (placementDist[r.winterRelPlacement] !== undefined) placementDist[r.winterRelPlacement]++;
          if (fallPlacementDist[r.baseRelPlacement] !== undefined) fallPlacementDist[r.baseRelPlacement]++;
        });

        // Band-to-band movement breakdown (Fall → Winter)
        const movementMap = {};
        plShifts.forEach(r => {
          const key = r.baseRelPlacement + '→' + r.winterRelPlacement;
          movementMap[key] = (movementMap[key] || 0) + 1;
        });
        const movementBreakdown = Object.entries(movementMap)
          .map(([k, count]) => { const [from, to] = k.split('→'); return { from, to, count, dir: _moyPlShift(from, to) }; })
          .sort((a, b) => b.count - a.count);

        return {
          total,
          withGrowth,
          winterOnly:     winterOnlyCount,
          medianGain:     gains.length ? Math.round(_moyMedian(gains) * 10) / 10 : null,
          medianPctTypical: pcts.length ? Math.round(_moyMedian(pcts) * 100) : null,
          pctMetTypical:   pcts.length ? Math.round(metTyp.length / pcts.length * 100) : null,
          pctProgressing:  pcts.length ? Math.round(progressing.length / pcts.length * 100) : null,
          pctNeedsAccel:   pcts.length ? Math.round(needsAccel.length / pcts.length * 100) : null,
          pctRegressed:    pcts.length ? Math.round(regressed.length / pcts.length * 100) : null,
          movedUp, held, movedDown,
          medianMonthsGrowth: months.length ? parseFloat((_moyMedian(months)).toFixed(1)) : null,
          avgMonthsGrowth:    months.length ? parseFloat((months.reduce((a,b)=>a+b,0)/months.length).toFixed(1)) : null,
          placementDist,
          fallPlacementDist,
          movementBreakdown,
          rushFlags: { red: redRushCount, yellow: yellowRushCount },
        };
      }

      const network   = metricBlock(rows);
      const byRegion  = {};
      const bySchool  = {};

      // Group by region
      const regionGroups = {};
      rows.forEach(r => {
        const rg = r.region || 'Unknown';
        if (!regionGroups[rg]) regionGroups[rg] = [];
        regionGroups[rg].push(r);
      });
      Object.entries(regionGroups).forEach(([rg, rws]) => { byRegion[rg] = metricBlock(rws); });

      // Group by school
      const schoolGroups = {};
      rows.forEach(r => {
        const sc = r.school || 'Unknown';
        if (!schoolGroups[sc]) schoolGroups[sc] = [];
        schoolGroups[sc].push(r);
      });
      Object.entries(schoolGroups).forEach(([sc, rws]) => { bySchool[sc] = metricBlock(rws); });

      return { network, byRegion, bySchool };
    }

    // ── Get or compute cached MOY metrics ─────────────────────────────────────
    function _moyGetMetrics(subject) {
      const subj = subject || _moySubject;
      const rows = subj === 'ELA' ? MOY_DATA.ela : MOY_DATA.math;
      if (!rows.length) return null;
      const key = subj + '_' + rows.length; // invalidate when row count changes
      if (_moyComputed && _moyComputed._key === key) return _moyComputed[subj];
      if (!_moyComputed) _moyComputed = { _key: key };
      _moyComputed[subj] = computeMOY(rows);
      _moyComputed._key  = key;
      return _moyComputed[subj];
    }

    // ── Growth tier pill helper ───────────────────────────────────────────────
    function _moyTierPill(medianPct) {
      if (medianPct === null) return '';
      if (medianPct >= 100) return `<span style="background:#d1fae5;color:#065f46;font-size:.6875rem;font-weight:700;padding:.2rem .6rem;border-radius:20px">✅ Met or Exceeded</span>`;
      if (medianPct >= 80)  return `<span style="background:#dbeafe;color:#1e40af;font-size:.6875rem;font-weight:700;padding:.2rem .6rem;border-radius:20px">🔵 On Pace</span>`;
      if (medianPct >= 50)  return `<span style="background:#fef3c7;color:#92400e;font-size:.6875rem;font-weight:700;padding:.2rem .6rem;border-radius:20px">🟡 Making Progress</span>`;
      return `<span style="background:#fee2e2;color:#991b1b;font-size:.6875rem;font-weight:700;padding:.2rem .6rem;border-radius:20px">🔴 Needs Acceleration</span>`;
    }

    // ── Main MOY render function ──────────────────────────────────────────────
    function renderMOYSection() {
      const isLoading = _moyLoading;
      const hasData   = MOY_DATA.loaded && (MOY_DATA.math.length > 0 || MOY_DATA.ela.length > 0);
      const metrics   = hasData ? _moyGetMetrics(_moySubject) : null;
      const net       = metrics ? metrics.network : null;

      // PDF export is restricted to the Data & Evaluation team only
      const _isDataDept = (window.NJTC_SESSION||{}).dept === 'data';

      // Color logic for median
      const medColor = (m) => m === null ? 'var(--muted)' : m >= 80 ? '#0d6e3a' : m >= 50 ? '#d97706' : '#b91c1c';

      // overflow-x:auto overrides .irlab-card overflow:hidden so wide tables
      // (Tutor Impact, School Operational Context) get a horizontal scrollbar
      // rather than clipping or expanding outside the portal container.
      let html = `
      <div class="irlab-card" id="moySection" style="margin-top:1.5rem;overflow-x:auto">
        <!-- MOY Header -->
        <div style="display:flex;align-items:flex-start;justify-content:space-between;flex-wrap:wrap;gap:.875rem;margin-bottom:1.25rem;padding-bottom:1rem;border-bottom:2px solid var(--border)">
          <div>
            <div style="font-size:.625rem;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:#0891b2;margin-bottom:.25rem">Mid-Year Snapshot · SY 2025–2026</div>
            <div style="font-family:'DM Serif Display',serif;font-size:1.25rem;color:var(--navy)">Mid-Year (MOY) Academic Results</div>
            <div style="font-size:.8125rem;color:var(--muted);margin-top:.25rem">Winter diagnostic data — Fall + Winter pairs · Live from Google Sheets</div>
          </div>
          <div style="display:flex;gap:.5rem;align-items:center;flex-wrap:wrap">
            <!-- Subject toggle -->
            <div style="display:flex;gap:.25rem;background:var(--surface-3);border-radius:20px;padding:.2rem">
              <button onclick="irlab.moySetSubject('Math')" class="irlab-mode-tab ${_moySubject==='Math'?'active':''}" style="font-size:.75rem;padding:.3rem .875rem;border-radius:18px">Math</button>
              <button onclick="irlab.moySetSubject('ELA')" class="irlab-mode-tab ${_moySubject==='ELA'?'active':''}" style="font-size:.75rem;padding:.3rem .875rem;border-radius:18px">ELA</button>
            </div>
            <button onclick="irlab.moyRefresh()" style="font-size:.75rem;padding:.35rem .75rem;border-radius:8px;border:1.5px solid var(--border);background:var(--surface);cursor:pointer;color:var(--text-2)">↺ Refresh</button>
            ${_isDataDept ? `<button onclick="irlab._moyExportPDF('ALL','${_moySubject==='ELA'?'ELA':'Math'}')" style="font-size:.75rem;padding:.35rem .875rem;border-radius:8px;border:none;background:linear-gradient(135deg,#0a1628,#003087);color:#fff;cursor:pointer;font-weight:600">⬇ PDF Report</button>
            <button onclick="irlab._moyExportCSV('${_moySubject==='ELA'?'ELA':'Math'}')" style="font-size:.75rem;padding:.35rem .75rem;border-radius:8px;border:1.5px solid var(--border);background:var(--surface);cursor:pointer;color:var(--text-2);font-weight:600">⬇ CSV</button>
            <button onclick="irlab._moyExportXLSX('${_moySubject==='ELA'?'ELA':'Math'}')" style="font-size:.75rem;padding:.35rem .75rem;border-radius:8px;border:1.5px solid #16a34a;background:#f0fdf4;cursor:pointer;color:#15803d;font-weight:600">⬇ XLSX</button>` : ''}
          </div>
        </div>`;

      // Loading state
      if (isLoading) {
        html += `<div style="padding:2.5rem;text-align:center;color:var(--muted)">
          <div style="font-size:1.5rem;margin-bottom:.75rem">⏳</div>
          <div style="font-size:.9375rem;font-weight:600">Loading MOY data…</div>
          <div style="font-size:.8125rem;margin-top:.375rem">Fetching Math and ELA winter diagnostics in parallel.</div>
        </div>`;
        html += `</div>`;
        return html;
      }

      // Error state
      if (_moyError) {
        html += `<div style="background:#fee2e2;border:1px solid #fca5a5;border-radius:10px;padding:1rem 1.25rem;display:flex;align-items:center;gap:.75rem">
          <span style="font-size:1.25rem">⚠️</span>
          <div style="flex:1;font-size:.875rem;color:#991b1b">${_moyError}</div>
          <button onclick="irlab.moyRefresh()" style="font-size:.8125rem;padding:.375rem .75rem;border-radius:8px;background:#b91c1c;color:#fff;border:none;cursor:pointer">Retry</button>
        </div>`;
        html += `</div>`;
        return html;
      }

      // Not yet loaded
      if (!hasData) {
        html += `<div style="padding:2.5rem;text-align:center;color:var(--muted)">
          <div style="font-size:1.5rem;margin-bottom:.75rem">📊</div>
          <div style="font-size:.9375rem;font-weight:600">MOY data not yet loaded</div>
          <div style="font-size:.8125rem;margin-top:.375rem;margin-bottom:1rem">Click below to fetch the live Winter diagnostic data.</div>
          <button onclick="irlab.moyRefresh()" style="font-size:.875rem;padding:.5rem 1.25rem;border-radius:10px;background:linear-gradient(135deg,#0a1628,#003087);color:#fff;border:none;cursor:pointer;font-weight:600">⬇ Load MOY Data</button>
        </div>`;
        html += `</div>`;
        return html;
      }

      // Rush flag banner
      if (net && net.rushFlags.red > 0) {
        html += `<div style="background:#fef3c7;border:1px solid #f59e0b;border-radius:8px;padding:.625rem 1rem;font-size:.8125rem;color:#92400e;margin-bottom:1rem">
          ⚠️ <strong>${net.rushFlags.red} scholar${net.rushFlags.red!==1?'s':''} had a Red Rush Flag on their Winter diagnostic.</strong> These scholars are included in all growth calculations — review the flagged list below and contact iReady if re-administration is needed.
        </div>`;
      }

      // ── View pill toggles ──────────────────────────────────────────────────
      html += `<div style="display:flex;gap:.375rem;flex-wrap:wrap;margin-bottom:1.25rem">
        ${[['overview','📊 Overview'],['regions','🗺️ By Region & School'],['correlations','📈 Correlations'],['tutor','🏆 Tutor Impact']].map(([v,l]) =>
          `<button onclick="irlab.moySetView('${v}')" style="font-size:.8125rem;padding:.375rem .875rem;border-radius:20px;border:1.5px solid ${_moyView===v?'var(--navy)':'var(--border)'};background:${_moyView===v?'var(--navy)':'var(--surface)'};color:${_moyView===v?'#fff':'var(--text-2)'};cursor:pointer;font-weight:${_moyView===v?'700':'500'};transition:all .15s">${l}</button>`
        ).join('')}
      </div>`;

      if (_moyView === 'overview' && net) {
        // ── KPI cards ────────────────────────────────────────────────────────
        html += `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:.875rem;margin-bottom:1.25rem">
          <div class="ta-card ta-kpi" style="position:relative">
            <div style="font-size:2rem;font-weight:800;color:var(--navy)">${net.total}</div>
            <div class="ta-kpi-sub">Total Scholars
              <span title="Every scholar who appears in the Winter diagnostic sheet — including those who only have a Winter score with no Fall baseline. These scholars are counted in placement totals but cannot have a growth score." style="cursor:help;margin-left:.3em;color:#0891b2;font-size:.75rem">ⓘ</span>
            </div>
          </div>
          <div class="ta-card ta-kpi" style="position:relative">
            <div style="font-size:2rem;font-weight:800;color:var(--navy)">${net.withGrowth}</div>
            <div class="ta-kpi-sub">With Growth Data
              <span title="Scholars who have BOTH a Fall AND a Winter iReady diagnostic — the only scholars where we can calculate how much they grew. Scholars missing a Fall baseline (Winter-only) are in Total but excluded here." style="cursor:help;margin-left:.3em;color:#0891b2;font-size:.75rem">ⓘ</span>
            </div>
            ${net.winterOnly > 0 ? `<div style="font-size:.6875rem;color:var(--muted);margin-top:.2rem">${net.total - net.withGrowth} Winter-only</div>` : ''}
          </div>
          <div class="ta-card ta-kpi"><div style="font-size:2rem;font-weight:800;color:${medColor(net.medianPctTypical)}">${net.medianPctTypical !== null ? net.medianPctTypical+'%' : '—'}</div><div class="ta-kpi-sub">Median % Typical Growth</div>${_moyTierPill(net.medianPctTypical) ? '<div style="margin-top:.35rem">'+_moyTierPill(net.medianPctTypical)+'</div>' : ''}</div>
          <div class="ta-card ta-kpi">
            <div style="font-size:2rem;font-weight:800;color:${net.medianMonthsGrowth !== null ? (net.medianMonthsGrowth >= 4.5 ? '#0d6e3a' : net.medianMonthsGrowth >= 3.0 ? '#d97706' : '#b91c1c') : 'var(--navy)'}">
              ${net.medianMonthsGrowth !== null ? net.medianMonthsGrowth + ' mo' : '—'}
            </div>
            <div class="ta-kpi-sub">Median Months of Learning
              <span title="Median months of academic learning gained. Formula: pctTypical × winterWeeks ÷ 4 per scholar — uses the actual weeks between each scholar's Fall and Winter diagnostic. Same approach as EOY. Median is the primary metric (robust to outliers). Avg shown as footnote for spreadsheet reference. Thresholds: 4.5+ mo = strong · 3.0–4.4 = progressing · below 3.0 = needs support." style="cursor:help;margin-left:.3em;color:#0891b2;font-size:.75rem">ⓘ</span>
            </div>
            ${net.avgMonthsGrowth !== null ? '<div style="font-size:.6875rem;color:var(--muted);margin-top:.2rem">avg: ' + net.avgMonthsGrowth + ' mo</div>' : ''}
          </div>
          <div class="ta-card ta-kpi"><div style="font-size:2rem;font-weight:800;color:${medColor(net.pctMetTypical)}">${net.pctMetTypical !== null ? net.pctMetTypical+'%' : '—'}</div><div class="ta-kpi-sub">% Met Typical</div></div>
          <div class="ta-card ta-kpi"><div style="font-size:2rem;font-weight:800;color:var(--navy)">${net.medianGain !== null ? (net.medianGain > 0 ? '+' : '') + net.medianGain : '—'}</div><div class="ta-kpi-sub">Median Scale Gain</div></div>
        </div>`;

        // ── Placement distribution — Fall (BOY) and Winter (MOY) bars ────────
        {
          const TIERS = [
            { label: '3+ GL Below',  full: '3 or More Grade Levels Below', color: '#dc2626' },
            { label: '2 GL Below',   full: '2 Grade Levels Below',          color: '#f97316' },
            { label: '1 GL Below',   full: '1 Grade Level Below',           color: '#eab308' },
            { label: 'Early On GL',  full: 'Early On Grade Level',          color: '#0d9488' },
            { label: 'Mid/Above GL', full: 'Mid or Above Grade Level',      color: '#0d6e3a' },
          ];
          const mkBar = (dist, label) => {
            const total = PLACEMENT_ORDER.reduce((s, p) => s + (dist[p] || 0), 0);
            if (!total) return '';
            const tiers = TIERS.map(t => ({ ...t, count: dist[t.full] || 0, pct: Math.round((dist[t.full] || 0) / total * 100) }));
            return `<div style="margin-bottom:.875rem">
              <div style="font-size:.6875rem;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--muted);margin-bottom:.375rem">${label} · ${total} scholars</div>
              <div style="height:22px;border-radius:6px;overflow:hidden;display:flex;margin-bottom:.375rem">
                ${tiers.map(t => t.count > 0 ? `<div style="flex:${t.count};background:${t.color}" title="${t.full}: ${t.pct}% (${t.count})"></div>` : '').join('')}
              </div>
              <div style="display:flex;flex-wrap:wrap;gap:.5rem">
                ${tiers.filter(t => t.count > 0).map(t => `<div style="display:flex;align-items:center;gap:.3rem;font-size:.7rem"><div style="width:8px;height:8px;border-radius:2px;background:${t.color};flex-shrink:0"></div><span style="color:var(--muted)">${t.label}</span><strong style="color:${t.color}">${t.pct}%</strong><span style="color:var(--muted);font-size:.625rem">(${t.count})</span></div>`).join('')}
              </div>
            </div>`;
          };
          const fallBar  = mkBar(net.fallPlacementDist  || {}, 'Fall (BOY)');
          const winterBar = mkBar(net.placementDist || {}, 'Winter (MOY)');
          if (fallBar || winterBar) {
            html += `<div style="margin-bottom:1.25rem">
              <div style="font-size:.6875rem;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:var(--muted);margin-bottom:.625rem">Placement Distribution — ${_moySubject}</div>
              ${fallBar}${winterBar}
            </div>`;
          }
        }

        // ── Placement movement breakdown ──────────────────────────────────────
        {
          const PLC_SHORT_MOY = {
            '3 or More Grade Levels Below': '3+ GL Below',
            '2 Grade Levels Below':         '2 GL Below',
            '1 Grade Level Below':          '1 GL Below',
            'Early On Grade Level':         'Early On GL',
            'Mid or Above Grade Level':     'Mid/Above GL',
          };
          const dirColor = { up: '#16a34a', held: '#0050c8', down: '#dc2626' };
          const dirIcon  = { up: '↑', held: '→', down: '↓' };
          const moves    = net.movementBreakdown || [];
          const upRows   = moves.filter(m => m.dir === 'up');
          const heldRows = moves.filter(m => m.dir === 'held');
          const downRows = moves.filter(m => m.dir === 'down');

          const renderGroup = (label, rows, color, icon, total) => {
            if (!total) return '';
            const detail = rows.map(m =>
              `<div style="display:flex;justify-content:space-between;align-items:center;padding:.2rem 0;border-bottom:1px solid rgba(0,0,0,.05)">
                <span style="color:var(--muted);font-size:.75rem">${PLC_SHORT_MOY[m.from]||m.from} ${icon} ${PLC_SHORT_MOY[m.to]||m.to}</span>
                <span style="font-weight:700;font-size:.75rem;color:${color}">${m.count}</span>
              </div>`
            ).join('');
            return `<div class="ta-card" style="border-top:3px solid ${color};padding:.75rem 1rem">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.4rem">
                <span style="font-weight:800;font-size:1.25rem;color:${color}">${icon} ${total}</span>
                <span style="font-size:.6875rem;font-weight:600;text-transform:uppercase;letter-spacing:.06em;color:${color}">${label}</span>
              </div>
              ${detail}
            </div>`;
          };

          html += `<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:.875rem;margin-bottom:1.25rem">
            ${renderGroup('Moved Up', upRows, dirColor.up, dirIcon.up, net.movedUp)}
            ${renderGroup('Held Band', heldRows, dirColor.held, dirIcon.held, net.held)}
            ${renderGroup('Moved Down', downRows, dirColor.down, dirIcon.down, net.movedDown)}
          </div>
          <div style="font-size:.6875rem;color:var(--muted);margin-bottom:.75rem">Placement band movement (Fall → Winter). A positive scale score gain can still result in a band drop if growth was below the threshold to hold the current band — grade-level benchmarks rise through the year.</div>`;
        }

        // ── Winter-only note ──────────────────────────────────────────────────
        if (net.winterOnly > 0) {
          html += `<div style="font-size:.75rem;color:var(--muted);margin-bottom:.875rem">ⓘ ${net.winterOnly} scholar${net.winterOnly!==1?'s':''} had only a Winter diagnostic (no Fall baseline) — counted in placement totals but excluded from growth calculations.</div>`;
        }
      }

      if (_moyView === 'regions' && metrics) {
        // ── Region & School sortable table ─────────────────────────────────
        const regionEntries = Object.entries(metrics.byRegion).sort((a,b) => (b[1].medianPctTypical||0) - (a[1].medianPctTypical||0));
        html += `<div style="margin-bottom:1.5rem">
          <div style="font-size:.6875rem;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:var(--muted);margin-bottom:.75rem">By Region — ${_moySubject}</div>
          <div style="overflow-x:auto;width:100%;max-width:100%"><table style="min-width:500px;width:100%;border-collapse:collapse;font-size:.8125rem">
            <thead><tr style="background:var(--navy)">
              <th style="padding:.625rem 1rem;text-align:left;color:rgba(255,255,255,.7);font-size:.6875rem;font-weight:700;text-transform:uppercase;letter-spacing:.06em">Region</th>
              <th style="padding:.625rem .75rem;text-align:center;color:rgba(255,255,255,.7);font-size:.6875rem;font-weight:700;text-transform:uppercase;letter-spacing:.06em">N</th>
              <th style="padding:.625rem .75rem;text-align:center;color:rgba(255,255,255,.7);font-size:.6875rem;font-weight:700;text-transform:uppercase;letter-spacing:.06em">w/ Growth</th>
              <th style="padding:.625rem .75rem;text-align:center;color:rgba(255,255,255,.7);font-size:.6875rem;font-weight:700;text-transform:uppercase;letter-spacing:.06em">Median Gain</th>
              <th style="padding:.625rem .75rem;text-align:center;color:rgba(255,255,255,.7);font-size:.6875rem;font-weight:700;text-transform:uppercase;letter-spacing:.06em">Median % Typical</th>
              <th style="padding:.625rem .75rem;text-align:center;color:rgba(255,255,255,.7);font-size:.6875rem;font-weight:700;text-transform:uppercase;letter-spacing:.06em">% Met Typical</th>
            </tr></thead>
            <tbody>
            ${regionEntries.map(([rg, m]) => {
              const bg = m.medianPctTypical === null ? '' : m.medianPctTypical >= 80 ? 'background:#f0fdf4' : m.medianPctTypical >= 50 ? 'background:#fffbeb' : 'background:#fef2f2';
              return `<tr style="${bg};border-bottom:1px solid var(--border-2)">
                <td style="padding:.75rem 1rem;font-weight:700;color:var(--navy)">${esc(rg)}</td>
                <td style="padding:.75rem;text-align:center">${m.total}</td>
                <td style="padding:.75rem;text-align:center">${m.withGrowth}</td>
                <td style="padding:.75rem;text-align:center;font-weight:600;color:var(--blue-mid)">${m.medianGain !== null ? (m.medianGain > 0 ? '+' : '') + m.medianGain : '—'}</td>
                <td style="padding:.75rem;text-align:center;font-weight:700;color:${medColor(m.medianPctTypical)}">${m.medianPctTypical !== null ? m.medianPctTypical+'%' : '—'}</td>
                <td style="padding:.75rem;text-align:center;font-weight:600">${m.pctMetTypical !== null ? m.pctMetTypical+'%' : '—'}</td>
              </tr>`;
            }).join('')}
            </tbody>
          </table></div>
        </div>`;

        // School breakdown
        const schoolEntries = Object.entries(metrics.bySchool)
          .filter(([,m]) => m.withGrowth >= 3)
          .sort((a,b) => (b[1].medianPctTypical||0) - (a[1].medianPctTypical||0));
        html += `<div>
          <div style="font-size:.6875rem;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:var(--muted);margin-bottom:.75rem">By School — ${_moySubject} (min 3 scholars with growth data)</div>
          <div style="overflow-x:auto;width:100%;max-width:100%"><table style="min-width:500px;width:100%;border-collapse:collapse;font-size:.8125rem">
            <thead><tr style="background:var(--surface-2)">
              <th style="padding:.5rem .875rem;text-align:left;font-size:.6875rem;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--muted);border-bottom:1px solid var(--border)">School</th>
              <th style="padding:.5rem .75rem;text-align:center;font-size:.6875rem;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--muted);border-bottom:1px solid var(--border)">N</th>
              <th style="padding:.5rem .75rem;text-align:center;font-size:.6875rem;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--muted);border-bottom:1px solid var(--border)">Median Gain</th>
              <th style="padding:.5rem .75rem;text-align:center;font-size:.6875rem;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--muted);border-bottom:1px solid var(--border)">Median % Typical</th>
              <th style="padding:.5rem .75rem;text-align:center;font-size:.6875rem;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--muted);border-bottom:1px solid var(--border)">% Met Typical</th>
            </tr></thead>
            <tbody>
            ${schoolEntries.map(([sc, m]) => {
              const bg = m.medianPctTypical === null ? '' : m.medianPctTypical >= 80 ? 'background:#f0fdf4' : m.medianPctTypical >= 50 ? 'background:#fffbeb' : 'background:#fef2f2';
              return `<tr style="${bg};border-bottom:1px solid var(--border-2)">
                <td style="padding:.625rem .875rem;font-size:.8rem;color:var(--navy);max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${esc(sc)}">${esc(sc)}</td>
                <td style="padding:.625rem;text-align:center">${m.withGrowth}</td>
                <td style="padding:.625rem;text-align:center;color:var(--blue-mid);font-weight:600">${m.medianGain !== null ? (m.medianGain > 0 ? '+' : '') + m.medianGain : '—'}</td>
                <td style="padding:.625rem;text-align:center;font-weight:700;color:${medColor(m.medianPctTypical)}">${m.medianPctTypical !== null ? m.medianPctTypical+'%' : '—'}</td>
                <td style="padding:.625rem;text-align:center">${m.pctMetTypical !== null ? m.pctMetTypical+'%' : '—'}</td>
              </tr>`;
            }).join('')}
            </tbody>
          </table></div>
        </div>`;
      }

      if (_moyView === 'correlations' && metrics) {
        const allRows = _moySubject === 'ELA' ? MOY_DATA.ela : MOY_DATA.math;
        const validRows = allRows.filter(r => r.hasGrowth && r.pctTypical !== null);

        // Grade band breakdown
        const gradeBands = { 'K–2': [0,1,2,'K','1','2'], '3–5': [3,4,5,'3','4','5'], '6–8': [6,7,8,'6','7','8'] };
        html += `<div style="margin-bottom:1.5rem">
          <div style="font-size:.6875rem;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:var(--muted);margin-bottom:.875rem">Growth by Grade Band — ${_moySubject}</div>
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:.875rem">
          ${Object.entries(gradeBands).map(([band, grades]) => {
            const bandRows = validRows.filter(r => grades.includes(r.grade) || grades.map(String).includes(String(r.grade)));
            const pcts     = bandRows.map(r => r.pctTypical).filter(v => v !== null);
            const med      = pcts.length ? Math.round(_moyMedian(pcts) * 100) : null;
            return `<div class="ta-card ta-kpi">
              <div style="font-size:1.5rem;font-weight:800;color:${medColor(med)}">${med !== null ? med+'%' : '—'}</div>
              <div class="ta-kpi-sub">Grade ${band}</div>
              <div style="font-size:.6875rem;color:var(--muted);margin-top:.25rem">${bandRows.length} scholars</div>
            </div>`;
          }).join('')}
          </div>
        </div>`;

        // Placement level distribution comparison (Fall vs Winter)
        html += `<div style="margin-bottom:1.5rem">
          <div style="font-size:.6875rem;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:var(--muted);margin-bottom:.875rem">Placement Distribution — Fall vs Winter · ${_moySubject}</div>
          <div style="overflow-x:auto;width:100%;max-width:100%"><table style="min-width:500px;width:100%;border-collapse:collapse;font-size:.8125rem">
            <thead><tr style="background:var(--surface-2)">
              <th style="padding:.5rem 1rem;text-align:left;font-size:.6875rem;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--muted);border-bottom:1px solid var(--border)">Placement Level</th>
              <th style="padding:.5rem .75rem;text-align:center;font-size:.6875rem;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--muted);border-bottom:1px solid var(--border)">Fall</th>
              <th style="padding:.5rem .75rem;text-align:center;font-size:.6875rem;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--muted);border-bottom:1px solid var(--border)">Winter</th>
              <th style="padding:.5rem .75rem;text-align:center;font-size:.6875rem;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--muted);border-bottom:1px solid var(--border)">Change</th>
            </tr></thead>
            <tbody>
            ${PLACEMENT_ORDER.slice().reverse().map(p => {
              const fallN   = allRows.filter(r => r.baseRelPlacement === p).length;
              const winterN = allRows.filter(r => r.winterRelPlacement === p).length;
              const diff    = winterN - fallN;
              const diffStr = diff > 0 ? `<span style="color:#0d6e3a;font-weight:700">+${diff}</span>` : diff < 0 ? `<span style="color:#b91c1c;font-weight:700">${diff}</span>` : `<span style="color:var(--muted)">0</span>`;
              const color   = PLC[p] || '#888';
              return `<tr style="border-bottom:1px solid var(--border-2)">
                <td style="padding:.625rem 1rem;font-weight:600;color:${color}">${p}</td>
                <td style="padding:.625rem;text-align:center">${fallN}</td>
                <td style="padding:.625rem;text-align:center;font-weight:600">${winterN}</td>
                <td style="padding:.625rem;text-align:center">${diffStr}</td>
              </tr>`;
            }).join('')}
            </tbody>
          </table></div>
        </div>`;

        // Educator callout
        if (net && net.medianPctTypical !== null) {
          const pct = net.medianPctTypical;
          const trend = pct >= 100 ? 'on pace to meet or exceed expected annual growth' : pct >= 80 ? 'on track to close significant ground by year end' : pct >= 50 ? 'making progress but will need continued intensity to reach full-year targets' : 'behind the expected pace — targeted intervention is recommended before the spring window';
          html += `<div style="background:linear-gradient(135deg,#0a1628,#162347);border-radius:12px;padding:1.25rem 1.5rem;color:#fff">
            <div style="font-size:.625rem;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:#f0a500;margin-bottom:.5rem">📣 What This Means</div>
            <div style="font-size:.9375rem;line-height:1.65;color:rgba(255,255,255,.9)">At the mid-year checkpoint, our ${_moySubject} scholars are achieving a median of <strong style="color:#f0a500">${pct}%</strong> of their expected annual growth — meaning they are <strong>${trend}</strong>. ${net.movedUp} scholars improved their iReady placement band since Fall; ${net.held} held their band; ${net.movedDown} dropped a band. (Note: placement band movement reflects grade-level positioning — a positive scale score gain can still result in a band drop if growth was below the threshold to maintain the current level.) The data tells us our overall trajectory is ${pct >= 80 ? 'strong' : pct >= 50 ? 'developing' : 'in need of urgent attention'}.</div>
          </div>`;
        }
      }

      if (_moyView === 'tutor' && metrics) {
        const allRows   = _moySubject === 'ELA' ? MOY_DATA.ela : MOY_DATA.math;
        const validRows = allRows.filter(r => r.hasGrowth && r.pctTypical !== null);
        const opsMap    = _moyBuildOperationalMap(allRows);
        const tutors    = _moyBuildTutorImpact(validRows, _moySubject, opsMap);
        const hasPearl  = opsMap !== null;

        // ── Aggregate SI summary (tutor-caused vs school-caused) ─────────
        let totalSiTutor = 0, totalSiSchool = 0, totalSiOther = 0;
        const siBySchool = {};
        if (hasPearl) {
          allRows.forEach(r => {
            const ops = _moyMatchOps(r, opsMap);
            if (!ops) return;
            const siSum = (ops.siTutor || 0) + (ops.siSchool || 0) + (ops.siOther || 0);
            if (siSum > 0) {
              siBySchool[r.school] = (siBySchool[r.school] || { t: 0, s: 0, o: 0 });
              siBySchool[r.school].t += (ops.siTutor  || 0);
              siBySchool[r.school].s += (ops.siSchool || 0);
              siBySchool[r.school].o += (ops.siOther  || 0);
            }
          });
          tutors.forEach(t => {
            totalSiTutor  += t.siTutor;
            totalSiSchool += t.siSchool;
            totalSiOther  += t.siOther;
          });
        }

        // ── Network aggregate cards ─────────────────────────────────────
        if (hasPearl && tutors.length) {
          const matchedScholars = tutors.reduce((s, t) => s + t.n, 0);
          const totalHrs        = tutors.reduce((s, t) => s + t.hours, 0);
          const avgPct          = tutors.length ? Math.round(tutors.reduce((s, t) => s + t.medianPct, 0) / tutors.length) : null;
          const avgMonths       = tutors.filter(t => t.medianMonths !== null);
          const avgMedianMonths = avgMonths.length ? parseFloat((avgMonths.reduce((s,t) => s + t.medianMonths, 0) / avgMonths.length).toFixed(1)) : null;
          const avgScholarAtt   = tutors.filter(t => t.scholAttRate !== null);
          const avgAttRate      = avgScholarAtt.length ? Math.round(avgScholarAtt.reduce((s,t) => s + t.scholAttRate, 0) / avgScholarAtt.length) : null;
          const tutorWithSurvey = tutors.filter(t => t.tutorSurveyAvg !== null);
          const avgTutorSurvey  = tutorWithSurvey.length ? (tutorWithSurvey.reduce((s,t)=>s+t.tutorSurveyAvg,0)/tutorWithSurvey.length).toFixed(2) : null;

          html += `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:.625rem;margin-bottom:1rem">
            ${[
              { v: tutors.length,         l: 'Matched Tutors',         c: 'var(--navy)' },
              { v: matchedScholars,        l: 'Scholars Matched',       c: 'var(--navy)' },
              { v: (avgPct !== null ? avgPct + '%' : '—'),   l: 'Avg Med % Typical',  c: avgPct >= 80 ? '#0d6e3a' : avgPct >= 50 ? '#d97706' : '#b91c1c' },
              { v: avgMedianMonths !== null ? avgMedianMonths + ' mo' : '—', l: 'Avg Months Gained', c: avgMedianMonths >= 4.5 ? '#0d6e3a' : avgMedianMonths >= 3.0 ? '#d97706' : '#b91c1c' },
              { v: totalHrs.toFixed(1) + 'h', l: 'Total Inst. Hours',   c: '#0050c8' },
              { v: avgAttRate !== null ? avgAttRate + '%' : '—', l: 'Avg Scholar Att.',  c: avgAttRate >= 95 ? '#0d6e3a' : '#d97706' },
              { v: (totalSiTutor + totalSiSchool + totalSiOther) || '0', l: 'Total SIs',  c: (totalSiTutor + totalSiSchool + totalSiOther) > 10 ? '#b91c1c' : '#92400e' },
              ...(avgTutorSurvey ? [{ v: avgTutorSurvey + '/5', l: 'Avg Tutor Survey', c: parseFloat(avgTutorSurvey) >= 4 ? '#0d6e3a' : '#d97706' }] : []),
            ].map(c => `<div style="background:var(--surface-2);border-radius:8px;padding:.75rem;text-align:center;border:1px solid var(--border-2)">
              <div style="font-size:1.375rem;font-weight:800;color:${c.c}">${c.v}</div>
              <div style="font-size:.6875rem;color:var(--muted);margin-top:.2rem;text-transform:uppercase;letter-spacing:.04em">${c.l}</div>
            </div>`).join('')}
          </div>`;
        }

        if (!hasPearl) {
          html += `<div style="background:#fffbeb;border:1px solid #f59e0b;border-radius:10px;padding:1rem 1.25rem;font-size:.875rem;color:#92400e;margin-bottom:1rem">
            ⚠️ Pearl operational data not yet loaded. Tutor impact will populate once Pearl finishes syncing.
            Scholar–tutor matching uses Pearl session IDs (primary) then name matching (fallback).
          </div>`;
        }

        // ── Service interruption summary panel ─────────────────────────
        if (hasPearl && (totalSiTutor + totalSiSchool + totalSiOther) > 0) {
          const topSISchools = Object.entries(siBySchool)
            .map(([sc, v]) => ({ sc, total: v.t + v.s + v.o, ...v }))
            .sort((a, b) => b.total - a.total).slice(0, 5);
          html += `<div style="background:#fff8f0;border:1px solid #fed7aa;border-radius:10px;padding:.875rem 1rem;margin-bottom:1rem">
            <div style="font-size:.6875rem;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:#92400e;margin-bottom:.625rem">
              Service Interruptions — ${_moySubject} · ${totalSiTutor + totalSiSchool + totalSiOther} total events
            </div>
            <div style="display:flex;gap:1rem;flex-wrap:wrap;margin-bottom:.625rem">
              <div style="font-size:.8125rem;color:#92400e">
                <span style="font-weight:700;color:#b91c1c">${totalSiTutor}</span>
                <span style="color:var(--muted)"> tutor-caused</span>
              </div>
              <div style="font-size:.8125rem;color:#92400e">
                <span style="font-weight:700;color:#d97706">${totalSiSchool}</span>
                <span style="color:var(--muted)"> school-caused</span>
              </div>
              <div style="font-size:.8125rem;color:#92400e">
                <span style="font-weight:700;color:var(--muted)">${totalSiOther}</span>
                <span style="color:var(--muted)"> other</span>
              </div>
            </div>
            ${topSISchools.length ? `<div style="font-size:.75rem;color:var(--muted)">Top schools: ${topSISchools.map(s => `${esc(s.sc)} (${s.total})`).join(' · ')}</div>` : ''}
          </div>`;
        }

        if (!tutors.length) {
          html += `<div style="padding:1.5rem;text-align:center;color:var(--muted);font-size:.875rem;border:1.5px dashed var(--border-2);border-radius:10px;margin-bottom:1rem">
            ${hasPearl ? 'Tutor impact requires at least 3 scholars per tutor with valid growth data. Scholar–tutor matching uses SESS student names (col 2) → direct name join.' : 'Waiting for Pearl operational data to load.'}
          </div>`;
        } else {
          const tierColor = t => t === 'High Impact' ? '#0d6e3a' : t === 'On Track' ? '#0050c8' : '#b91c1c';
          const tierBg    = t => t === 'High Impact' ? '#d1fae5' : t === 'On Track' ? '#dbeafe' : '#fee2e2';
          const fmtRate   = v => v !== null ? v + '%' : '—';
          const fmtSurvey = v => v !== null ? v.toFixed(2) + '/5' : '—';

          html += `
          <div style="font-size:.6875rem;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:var(--muted);margin-bottom:.75rem">
            Tutor Academic Impact — ${_moySubject} · ${tutors.length} tutors · Ranked by Median % Typical Growth · Min 3 scholars
          </div>
          <div style="overflow-x:auto;width:100%;max-width:100%"><table style="min-width:500px;width:100%;border-collapse:collapse;font-size:.8125rem">
            <thead><tr style="background:var(--navy)">
              <th style="padding:.625rem 1rem;text-align:left;color:rgba(255,255,255,.7);font-size:.6875rem;font-weight:700;text-transform:uppercase;white-space:nowrap">Tutor</th>
              <th style="padding:.625rem .5rem;text-align:center;color:rgba(255,255,255,.7);font-size:.6875rem;font-weight:700">Scholars</th>
              <th style="padding:.625rem .5rem;text-align:center;color:rgba(255,255,255,.7);font-size:.6875rem;font-weight:700">Med % Typical</th>
              <th style="padding:.625rem .5rem;text-align:center;color:rgba(255,255,255,.7);font-size:.6875rem;font-weight:700" title="Estimated months of learning gained (% Typical ÷ 100 × 10)">Months Gained</th>
              <th style="padding:.625rem .5rem;text-align:center;color:rgba(255,255,255,.7);font-size:.6875rem;font-weight:700">Med Gain</th>
              <th style="padding:.625rem .5rem;text-align:center;color:rgba(255,255,255,.7);font-size:.6875rem;font-weight:700">↑ Up</th>
              <th style="padding:.625rem .5rem;text-align:center;color:rgba(255,255,255,.7);font-size:.6875rem;font-weight:700">↓ Down</th>
              ${hasPearl ? `
              <th style="padding:.625rem .5rem;text-align:center;color:rgba(255,255,255,.7);font-size:.6875rem;font-weight:700" title="Total instructional hours delivered">Hours</th>
              <th style="padding:.625rem .5rem;text-align:center;color:rgba(255,255,255,.7);font-size:.6875rem;font-weight:700" title="Math hours / ELA hours">M/E Hrs</th>
              <th style="padding:.625rem .5rem;text-align:center;color:rgba(255,255,255,.7);font-size:.6875rem;font-weight:700" title="Scholar attendance rate (attended ÷ attended+absent, SIs excluded)">Att%</th>
              <th style="padding:.625rem .5rem;text-align:center;color:rgba(255,255,255,.7);font-size:.6875rem;font-weight:700" title="Scholar absences (scholar-caused misses)">Abs</th>
              <th style="padding:.625rem .5rem;text-align:center;color:rgba(255,255,255,.7);font-size:.6875rem;font-weight:700" title="Classroom Teacher pull-outs (counted as scholar absence)">CT Pulls</th>
              <th style="padding:.625rem .5rem;text-align:center;color:rgba(255,255,255,.7);font-size:.6875rem;font-weight:700" title="Service interruptions: Tutor-caused / School-caused / Other">SIs (T/S/O)</th>
              <th style="padding:.625rem .5rem;text-align:center;color:rgba(255,255,255,.7);font-size:.6875rem;font-weight:700" title="Scholar post-session satisfaction avg">Scholar Sat.</th>
              <th style="padding:.625rem .5rem;text-align:center;color:rgba(255,255,255,.7);font-size:.6875rem;font-weight:700" title="Instructor post-session survey avg">Tutor Survey</th>
              ` : ''}
              <th style="padding:.625rem .5rem;text-align:center;color:rgba(255,255,255,.7);font-size:.6875rem;font-weight:700">Tier</th>
            </tr></thead>
            <tbody>
            ${tutors.map((t, i) => `<tr style="border-bottom:1px solid var(--border-2);${i%2===0?'background:var(--surface-2)':''}">
              <td style="padding:.625rem 1rem;font-weight:700;color:var(--navy);max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${esc(t.name)}">${esc(t.name)}</td>
              <td style="padding:.5rem;text-align:center">${t.n}</td>
              <td style="padding:.5rem;text-align:center;font-weight:800;color:${t.medianPct>=80?'#0d6e3a':t.medianPct>=50?'#d97706':'#b91c1c'}">${t.medianPct}%</td>
              <td style="padding:.5rem;text-align:center;font-weight:700;color:${t.medianMonths>=4.5?'#0d6e3a':t.medianMonths>=3.0?'#d97706':'#b91c1c'}">${t.medianMonths !== null ? t.medianMonths+' mo' : '—'}</td>
              <td style="padding:.5rem;text-align:center;color:var(--blue-mid);font-weight:600">${t.medianGain!==null?(t.medianGain>0?'+':'')+t.medianGain:'—'}</td>
              <td style="padding:.5rem;text-align:center;color:#16a34a;font-weight:700">${t.movedUp}</td>
              <td style="padding:.5rem;text-align:center;color:#dc2626">${t.movedDown}</td>
              ${hasPearl ? `
              <td style="padding:.5rem;text-align:center;color:var(--muted)">${t.hours > 0 ? t.hours : '—'}</td>
              <td style="padding:.5rem;text-align:center;color:var(--muted);font-size:.75rem">${t.hoursMath > 0 || t.hoursELA > 0 ? t.hoursMath+'M/'+t.hoursELA+'E' : '—'}</td>
              <td style="padding:.5rem;text-align:center;font-weight:700;color:${t.scholAttRate===null?'var(--muted)':t.scholAttRate>=95?'#16a34a':'#d97706'}">${fmtRate(t.scholAttRate)}</td>
              <td style="padding:.5rem;text-align:center;font-weight:${t.scholAbsent>0?'700':'400'};color:${t.scholAbsent>0?'#d97706':'var(--muted)'}">${t.scholAbsent > 0 ? t.scholAbsent : '—'}</td>
              <td style="padding:.5rem;text-align:center;font-weight:${t.scholCtPulls>0?'700':'400'};color:${t.scholCtPulls>0?'#b91c1c':'var(--muted)'}" title="Classroom Teacher pulled scholar from tutoring">${t.scholCtPulls > 0 ? t.scholCtPulls : '—'}</td>
              <td style="padding:.5rem;text-align:center;font-size:.75rem">
                <span style="color:${t.siTutor>0?'#b91c1c':'var(--muted)'};font-weight:${t.siTutor>0?'700':'400'}">${t.siTutor}T</span>
                <span style="color:var(--muted)"> / </span>
                <span style="color:${t.siSchool>0?'#d97706':'var(--muted)'};font-weight:${t.siSchool>0?'700':'400'}">${t.siSchool}S</span>
                <span style="color:var(--muted)"> / </span>
                <span style="color:var(--muted)">${t.siOther}O</span>
              </td>
              <td style="padding:.5rem;text-align:center;color:${t.scholSurveyAvg===null?'var(--muted)':t.scholSurveyAvg>=4?'#16a34a':'#d97706'}">${fmtSurvey(t.scholSurveyAvg)}</td>
              <td style="padding:.5rem;text-align:center;color:${t.tutorSurveyAvg===null?'var(--muted)':t.tutorSurveyAvg>=4?'#16a34a':'#d97706'}">${fmtSurvey(t.tutorSurveyAvg)}</td>
              ` : ''}
              <td style="padding:.5rem;text-align:center"><span style="font-size:.6875rem;font-weight:700;padding:.2rem .625rem;border-radius:20px;background:${tierBg(t.tier)};color:${tierColor(t.tier)}">${t.tier}</span></td>
            </tr>`).join('')}
            </tbody>
          </table></div>
          <div style="font-size:.75rem;color:var(--muted);margin-top:.75rem;line-height:1.5">
            Matching: SESS student names (primary) · Pearl UID · name index · school-scoped fuzzy fallback.
            Att% = scholar sessions attended ÷ (attended + absent); SIs excluded from denominator.
            SIs: T=tutor/coverage-caused · S=school/facility-caused · O=other (not scholar's fault).
            Abs = scholar-caused absences. CT Pulls = Classroom Teacher kept scholar from tutoring.
            Scholar Sat. / Tutor Survey = post-session survey averages. Min 3 scholars per tutor.
          </div>`;
        }

        // ── School Operational Context Panel ─────────────────────────────────
        // Always shown when Pearl data is available. Joins MOY academic school names
        // to Pearl school-level SIs and survey scores to surface ops impact on outcomes.
        if (hasPearl && opsMap && opsMap.schoolOpsMap) {
          const schoolOpsData = opsMap.schoolOpsMap;
          // Fuzzy school name normalizer — strips common suffixes for cross-system matching
          const _normSc = n => (n || '').toLowerCase().replace(/[^a-z0-9 ]/g,'').replace(/\b(school|elementary|middle|high|charter|the|of|at|a|and)\b/g,'').replace(/\s+/g,' ').trim();
          const moySchools = [...new Set(allRows.map(r => (r.school || '').trim()).filter(Boolean))];
          const schoolCtxEntries = moySchools.map(sc => {
            const scL = sc.toLowerCase();
            const scN = _normSc(sc);
            // 3-tier match: exact key → exact name → normalized fuzzy
            const sops = schoolOpsData[scL]
              || Object.values(schoolOpsData).find(s => s.name.toLowerCase() === scL)
              || Object.values(schoolOpsData).find(s => {
                   const sN = _normSc(s.name);
                   return sN && scN && (sN === scN || sN.includes(scN) || scN.includes(sN)
                          || scN.split(' ').filter(t=>t.length>3).every(t=>sN.includes(t)));
                 });
            const scRows = allRows.filter(r => (r.school||'').trim().toLowerCase()===scL && r.hasGrowth && r.pctTypical!==null);
            const medGrowth = scRows.length ? Math.round(_moyMedian(scRows.map(r=>r.pctTypical))*100) : null;
            return {
              name: sc, n: scRows.length, medGrowth,
              siCount:    sops ? (sops.siCount  || 0) : null,
              siTutor:    sops ? (sops.siTutor  || 0) : null,
              siSchool:   sops ? (sops.siSchool || 0) : null,
              siOther:    sops ? (sops.siOther  || 0) : null,
              absent:     sops ? (sops.absent   || 0) : null,
              ctPulls:    sops ? (sops.ctPulls  || 0) : null,
              stuSurvAvg: sops ? sops.stuSurvAvg  : null,
              instSurvAvg:sops ? sops.instSurvAvg : null,
              district:   sops ? (sops.district || '') : '',
              noData:     !sops,
            };
          }).sort((a,b) => {
            // Sort: schools with data first (by total SIs desc), no-data schools last
            if (a.noData && !b.noData) return 1;
            if (!a.noData && b.noData) return -1;
            return ((b.siTutor||0)+(b.siSchool||0)+(b.siOther||0)) - ((a.siTutor||0)+(a.siSchool||0)+(a.siOther||0));
          });

          if (schoolCtxEntries.length) {
            html += `<div style="margin-top:1.5rem">
              <div style="font-size:.6875rem;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:var(--muted);margin-bottom:.75rem;display:flex;align-items:center;gap:.5rem;flex-wrap:wrap">
                <span>School Operational Context — ${_moySubject} · Pearl attendance &amp; survey data by school</span>
                <span style="font-size:.6875rem;font-weight:400;color:var(--muted)">· Did operations impact academic outcomes?</span>
              </div>
              <div style="overflow-x:auto;width:100%;max-width:100%"><table style="min-width:500px;width:100%;border-collapse:collapse;font-size:.8125rem">
                <thead><tr style="background:#f0f4ff">
                  <th style="padding:.5rem 1rem;text-align:left;color:var(--navy);font-size:.6875rem;font-weight:700;text-transform:uppercase;border-bottom:2px solid var(--border-2)">School</th>
                  <th style="padding:.5rem .5rem;text-align:center;color:var(--navy);font-size:.6875rem;font-weight:700;border-bottom:2px solid var(--border-2)" title="Scholars with valid Fall+Winter growth data">N</th>
                  <th style="padding:.5rem .5rem;text-align:center;color:var(--navy);font-size:.6875rem;font-weight:700;border-bottom:2px solid var(--border-2)">Med % Typical</th>
                  <th style="padding:.5rem .5rem;text-align:center;color:var(--navy);font-size:.6875rem;font-weight:700;border-bottom:2px solid var(--border-2)" title="Total scholar absences (scholar-caused misses)">Scholar Abs</th>
                  <th style="padding:.5rem .5rem;text-align:center;color:#7c3aed;font-size:.6875rem;font-weight:700;border-bottom:2px solid var(--border-2)" title="Classroom Teacher pull-outs (scholars kept from tutoring by teacher)">CT Pulls</th>
                  <th style="padding:.5rem .5rem;text-align:center;color:var(--navy);font-size:.6875rem;font-weight:700;border-bottom:2px solid var(--border-2)" title="Total interrupted sessions (not scholar's fault)">Total SIs</th>
                  <th style="padding:.5rem .5rem;text-align:center;color:#b91c1c;font-size:.6875rem;font-weight:700;border-bottom:2px solid var(--border-2)" title="Tutor/coverage-caused service interruptions">Tutor SIs</th>
                  <th style="padding:.5rem .5rem;text-align:center;color:#d97706;font-size:.6875rem;font-weight:700;border-bottom:2px solid var(--border-2)" title="School/site/testing-caused service interruptions">School SIs</th>
                  <th style="padding:.5rem .5rem;text-align:center;color:var(--navy);font-size:.6875rem;font-weight:700;border-bottom:2px solid var(--border-2)" title="Scholar post-session satisfaction avg">Scholar Sat.</th>
                  <th style="padding:.5rem .5rem;text-align:center;color:var(--navy);font-size:.6875rem;font-weight:700;border-bottom:2px solid var(--border-2)" title="Instructor post-session survey avg">Tutor Survey</th>
                </tr></thead>
                <tbody>
                ${schoolCtxEntries.map((s, i) => {
                  const siHighT = (s.siTutor || 0) > 5;
                  const siHighS = (s.siSchool || 0) > 5;
                  const ctHigh  = (s.ctPulls  || 0) > 3;
                  return `<tr style="border-bottom:1px solid var(--border-2);${i%2===0?'background:var(--surface-2)':''}${s.noData?';opacity:.55':''}">
                    <td style="padding:.5rem 1rem;font-weight:600;color:var(--navy);max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${esc(s.name)}">${esc(s.name)}${s.district ? `<div style="font-size:.6875rem;color:var(--muted);font-weight:400">${esc(s.district)}</div>` : ''}</td>
                    <td style="padding:.5rem;text-align:center;color:var(--muted)">${s.n || '—'}</td>
                    <td style="padding:.5rem;text-align:center;font-weight:700;color:${s.medGrowth===null?'var(--muted)':s.medGrowth>=80?'#0d6e3a':s.medGrowth>=50?'#d97706':'#b91c1c'}">${s.medGrowth !== null ? s.medGrowth+'%' : '—'}</td>
                    <td style="padding:.5rem;text-align:center;color:${s.absent===null?'var(--muted)':(s.absent||0)>10?'#b91c1c':'#d97706'};font-weight:${(s.absent||0)>0?'700':'400'}">${s.absent !== null ? (s.absent||0) : '—'}</td>
                    <td style="padding:.5rem;text-align:center;color:${s.ctPulls===null?'var(--muted)':ctHigh?'#7c3aed':'var(--muted)'};font-weight:${ctHigh?'700':'400'}">${s.ctPulls !== null ? (s.ctPulls||0) : '—'}</td>
                    <td style="padding:.5rem;text-align:center;font-weight:${(s.siCount||0)>0?'700':'400'};color:${(s.siCount||0)>10?'#b91c1c':(s.siCount||0)>0?'#d97706':'var(--muted)'}">${s.siCount !== null ? (s.siCount||0) : '—'}</td>
                    <td style="padding:.5rem;text-align:center;font-weight:${siHighT?'700':'400'};color:${siHighT?'#b91c1c':(s.siTutor||0)>0?'#b91c1c99':'var(--muted)'}">${s.siTutor !== null ? (s.siTutor||0) : '—'}</td>
                    <td style="padding:.5rem;text-align:center;font-weight:${siHighS?'700':'400'};color:${siHighS?'#d97706':(s.siSchool||0)>0?'#d9770699':'var(--muted)'}">${s.siSchool !== null ? (s.siSchool||0) : '—'}</td>
                    <td style="padding:.5rem;text-align:center;font-weight:${s.stuSurvAvg!==null?'600':'400'};color:${s.stuSurvAvg===null?'var(--muted)':s.stuSurvAvg>=4?'#16a34a':'#d97706'}">${s.stuSurvAvg !== null ? s.stuSurvAvg+'/5' : '—'}</td>
                    <td style="padding:.5rem;text-align:center;font-weight:${s.instSurvAvg!==null?'600':'400'};color:${s.instSurvAvg===null?'var(--muted)':s.instSurvAvg>=4?'#16a34a':'#d97706'}">${s.instSurvAvg !== null ? s.instSurvAvg+'/5' : '—'}</td>
                  </tr>`;
                }).join('')}
                </tbody>
              </table></div>
              <div style="font-size:.75rem;color:var(--muted);margin-top:.625rem;line-height:1.5">
                Att classification mirrors Pearl's classifyRecord(): Absent = scholar-caused (Absent / Declined / CT pull) ·
                SIs = ATT_STATUS "Missed" with non-scholar reason (tutor vacancy, testing, closure, etc.).
                CT Pulls = "Classroom Teacher Requested to Keep Scholar in Class" (counted as scholar absence, tracked separately).
                Faded rows = no Pearl attendance data found for that school name.
              </div>
            </div>`;
          }
        }
      }

      html += `</div>`; // close irlab-card
      return html;
    }

    // ── MOY public setters (called from rendered HTML buttons) ───────────────
    function moySetSubject(s) { _moySubject = s; renderLab(); }
    function moySetView(v)    { _moyView = v;    renderLab(); }
    async function moyRefresh() {
      _moyLoading = false; // reset so _moyFetchLive doesn't skip due to stale loading flag
      renderLab(); // show loading skeleton immediately
      await _moyFetchLive(true);
      renderLab(); // re-render with live data
    }

    // ── Standards Mastery helpers ─────────────────────────────────────────────
    function _smParseRow(raw) {
      // Class Teacher(s): "Last, First; Last2, First2" — primary-teacher field,
      // but only shows the "grading" teacher, not all instructors in the class.
      const ct = raw['Class Teacher(s)'] || '';
      const teachersFromCT = ct.split(';').map(t => {
        const parts = t.trim().split(',');
        return parts.length >= 2 ? (parts[1].trim() + ' ' + parts[0].trim()) : t.trim();
      }).filter(Boolean);

      // Class(es): "First Last - School - Grade - Subject; ..." — contains ALL
      // instructors (including Apollo Monroy-Polanco when Class Teacher only shows Carla Borbon).
      // Extract the name portion before the first " - ".
      const classes = raw['Class(es)'] || '';
      const teachersFromClasses = classes.split(';').map(entry => {
        const dashIdx = entry.indexOf(' - ');
        return dashIdx > 0 ? entry.slice(0, dashIdx).trim() : '';
      }).filter(Boolean);

      // Merge both sources, deduplicate by normalized name
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
        studentId:     raw['Student ID'] || '',
        lastName:      raw['Last Name']  || '',
        firstName:     raw['First Name'] || '',
        grade:         String(raw['Student Grade'] || '').trim(),
        school:        raw['School']    || '',
        subject:       raw['Subject']   || 'Reading',
        asmName, asmBase, isFormA, isFormB,
        score:         parseFloat(raw['Assessment Score (%)']) || 0,
        placement:     raw['Relative Placement']  || '',
        direction:     raw['Pre to Post Score']   || '',
        date:          raw['Completion Date']      || '',
        teachers,
        primaryTeacher: teachers[0] || '',
      };
    }

    function _smBuildPairs(rows) {
      const map = {};
      rows.forEach(r => {
        const key = r.studentId + '|' + r.asmBase;
        if (!map[key]) map[key] = { ...r, formA: null, formB: null };
        if (r.isFormA) map[key].formA = r;
        if (r.isFormB) map[key].formB = r;
      });
      return Object.values(map);
    }

    async function _smFetchLive(force) {
      if (_smLoading) return;
      if (!force && SM_DATA.loaded) return;
      if (!force) {
        try {
          const cached = JSON.parse(localStorage.getItem(SM_CACHE_KEY) || 'null');
          if (cached && Date.now() - cached.ts < SM_CACHE_TTL) {
            SM_DATA.rows   = cached.rows || [];
            SM_DATA.pairs  = _smBuildPairs(SM_DATA.rows);
            SM_DATA.loaded = true;
            SM_DATA.ts     = cached.ts;
            return;
          }
        } catch(e) {}
      }
      _smLoading = true;
      _smError   = null;
      renderLab();
      try {
        // All grades combined into one tab on the live sheet
        const url  = SM_ALL_URL + (force ? '&t=' + Date.now() : '');
        const resp = await fetch(url);
        if (!resp.ok) throw new Error('HTTP ' + resp.status + ' fetching Standards Mastery');
        const text = await resp.text();
        const allRows = parseCSV(text)
          .filter(r => r['Student ID'])
          .map(r => _smParseRow(r))
          .filter(r => r.isFormA || r.isFormB);
        SM_DATA.rows   = allRows;
        SM_DATA.pairs  = _smBuildPairs(allRows);
        SM_DATA.loaded = true;
        SM_DATA.ts     = Date.now();
        try { localStorage.setItem(SM_CACHE_KEY, JSON.stringify({ rows: allRows, ts: SM_DATA.ts })); } catch(e) {}
      } catch(err) {
        _smError = 'Failed to load Standards Mastery data: ' + err.message;
        console.error('[SM]', err);
      } finally {
        _smLoading = false;
      }
    }

    async function smRefresh() {
      SM_DATA.loaded = false;
      _smLoading = false;
      renderLab();
      await _smFetchLive(true);
      renderLab();
    }

    function smSetFilterGrade(g)    { _smFilterGrade    = g; const m = document.getElementById('smModal'); if(m) _smRenderModalFilters(); }
    function smSetFilterInstr(a)    { _smFilterInstr    = a; const m = document.getElementById('smModal'); if(m) _smRenderModalFilters(); }
    function smSetFilterStandard(s) { _smFilterStandard = s; const m = document.getElementById('smModal'); if(m) _smRenderModalFilters(); }

    function _smGetFilteredRows() {
      const allRows = SM_DATA.rows;
      const instrSet = new Set();
      allRows.forEach(r => r.teachers.forEach(t => { if (t) instrSet.add(t); }));
      const instructors = [...instrSet].sort();
      const standardSet = new Set();
      allRows.forEach(r => { if (r.asmBase) standardSet.add(r.asmBase); });
      const standards = [...standardSet].sort();
      const grades = [...new Set(allRows.map(r => r.grade))].sort((a,b)=>parseInt(a)-parseInt(b));

      let pairs = SM_DATA.pairs;
      if (_smFilterInstr !== 'all') {
        pairs = pairs.filter(p => {
          const rows = [p.formA, p.formB].filter(Boolean);
          return rows.some(r => r.teachers.includes(_smFilterInstr));
        });
      }
      if (_smFilterGrade !== 'all') {
        pairs = pairs.filter(p => p.grade === _smFilterGrade);
      }
      if (_smFilterStandard !== 'all') {
        pairs = pairs.filter(p => p.asmBase === _smFilterStandard);
      }
      return { pairs, instructors, standards, grades };
    }

    function _smBuildTable(pairs) {
      const PLACE_COLOR = { 'Beginning':'#dc2626','Progressing':'#d97706','Proficient':'#0d6e3a' };
      const rows = pairs.map(p => {
        const src  = p.formA || p.formB || p;
        const preS = p.formA ? p.formA.score : null;
        const posS = p.formB ? p.formB.score : null;
        const gain = (preS !== null && posS !== null) ? Math.round((posS - preS) * 10) / 10 : null;
        return {
          name:   src.firstName + ' ' + src.lastName,
          grade:  p.grade,
          asmBase: p.asmBase,
          subject: src.subject || 'Reading',
          appr:   src.primaryTeacher,
          preScore: preS, postScore: posS, gain,
          prePl:  p.formA ? p.formA.placement : '',
          postPl: p.formB ? p.formB.placement : '',
          dir:    p.formB ? (p.formB.direction || '') : '',
        };
      }).sort((a,b) => (parseInt(a.grade)||99) - (parseInt(b.grade)||99) || a.name.localeCompare(b.name));

      const withData = rows.filter(r => r.gain !== null);
      const improved = withData.filter(r => r.gain > 0).length;
      const avgGain  = withData.length > 0 ? Math.round(withData.reduce((s,r)=>s+r.gain,0)/withData.length*10)/10 : null;
      const pctImp   = withData.length > 0 ? Math.round(improved/withData.length*100) : null;

      const tableRows = rows.map(r => {
        const gainColor = r.gain === null ? '#94a3b8' : r.gain > 0 ? '#0d6e3a' : r.gain < 0 ? '#dc2626' : '#64748b';
        const dirIcon   = r.dir === 'Increase' ? '▲' : r.dir === 'Decrease' ? '▼' : r.dir === 'Same' ? '→' : '';
        const dirColor  = r.dir === 'Increase' ? '#0d6e3a' : r.dir === 'Decrease' ? '#dc2626' : '#64748b';
        const prePlC    = PLACE_COLOR[r.prePl]  || '#64748b';
        const postPlC   = PLACE_COLOR[r.postPl] || '#64748b';
        return `<tr style="border-bottom:1px solid #f1f5f9">
          <td style="padding:.5rem .625rem;font-weight:500">${esc(r.name)}</td>
          <td style="padding:.5rem .625rem;text-align:center">Gr ${esc(r.grade)}</td>
          <td style="padding:.5rem .625rem;font-size:.75rem;max-width:180px">${esc(r.asmBase)}</td>
          <td style="padding:.5rem .625rem;font-size:.75rem">${esc(r.subject)}</td>
          <td style="padding:.5rem .625rem;font-size:.75rem">${esc(r.appr)}</td>
          <td style="padding:.5rem .625rem;text-align:center">${r.preScore !== null ? r.preScore+'%' : '—'}</td>
          <td style="padding:.5rem .625rem;text-align:center">${r.postScore !== null ? r.postScore+'%' : '—'}</td>
          <td style="padding:.5rem .625rem;text-align:center;font-weight:700;color:${gainColor}">${r.gain !== null ? (r.gain>0?'+':'')+r.gain+'%' : '—'}</td>
          <td style="padding:.5rem .625rem;text-align:center"><span style="color:${prePlC};font-size:.75rem;font-weight:600">${esc(r.prePl||'—')}</span></td>
          <td style="padding:.5rem .625rem;text-align:center"><span style="color:${postPlC};font-size:.75rem;font-weight:600">${esc(r.postPl||'—')}</span></td>
          <td style="padding:.5rem .625rem;text-align:center;color:${dirColor};font-weight:600;font-size:.75rem">${dirIcon}${r.dir ? ' '+esc(r.dir) : '—'}</td>
        </tr>`;
      }).join('');

      return { rows, withData, improved, avgGain, pctImp, tableRows };
    }

    function _smRenderModalFilters() {
      const modal = document.getElementById('smModal');
      if (!modal) return;
      const { pairs, instructors, standards, grades } = _smGetFilteredRows();
      const { rows, withData, avgGain, pctImp, tableRows } = _smBuildTable(pairs);

      const selStyle = (active) => `font-size:.8125rem;padding:.3rem .625rem;border-radius:6px;border:1.5px solid ${active?'#7c3aed':'#e2e8f0'};background:${active?'#f5f3ff':'#fff'};color:${active?'#6d28d9':'#475569'};cursor:pointer`;

      const instrSel = `<select onchange="irlab.smSetFilterInstr(this.value)" style="${selStyle(_smFilterInstr!=='all')}">
        <option value="all"${_smFilterInstr==='all'?' selected':''}>All Instructors</option>
        ${instructors.map(t=>`<option value="${esc(t)}"${_smFilterInstr===t?' selected':''}>${esc(t)}</option>`).join('')}
      </select>`;

      const gradeSel = `<select onchange="irlab.smSetFilterGrade(this.value)" style="${selStyle(_smFilterGrade!=='all')}">
        <option value="all"${_smFilterGrade==='all'?' selected':''}>All Grades</option>
        ${grades.map(g=>`<option value="${esc(g)}"${_smFilterGrade===g?' selected':''}>Grade ${esc(g)}</option>`).join('')}
      </select>`;

      const stdSel = `<select onchange="irlab.smSetFilterStandard(this.value)" style="${selStyle(_smFilterStandard!=='all')}">
        <option value="all"${_smFilterStandard==='all'?' selected':''}>All Standards</option>
        ${standards.map(s=>`<option value="${esc(s)}"${_smFilterStandard===s?' selected':''}>${esc(s)}</option>`).join('')}
      </select>`;

      const kpis = `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:.75rem;margin-bottom:1.25rem" id="smKpis">
        <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:.75rem;text-align:center">
          <div style="font-size:1.5rem;font-weight:800;color:#0a1628">${rows.length}</div>
          <div style="font-size:.75rem;color:#64748b;margin-top:.15rem">Assessment Pairs</div>
        </div>
        <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:.75rem;text-align:center">
          <div style="font-size:1.5rem;font-weight:800;color:${pctImp!==null&&pctImp>=50?'#0d6e3a':'#d97706'}">${pctImp!==null?pctImp+'%':'—'}</div>
          <div style="font-size:.75rem;color:#64748b;margin-top:.15rem">Improved</div>
        </div>
        <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:.75rem;text-align:center">
          <div style="font-size:1.5rem;font-weight:800;color:${avgGain!==null&&avgGain>0?'#0d6e3a':avgGain!==null&&avgGain<0?'#dc2626':'#64748b'}">${avgGain!==null?(avgGain>0?'+':'')+avgGain+'%':'—'}</div>
          <div style="font-size:.75rem;color:#64748b;margin-top:.15rem">Avg Score Δ</div>
        </div>
        <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:.75rem;text-align:center">
          <div style="font-size:1.5rem;font-weight:800;color:#0a1628">${withData.length}</div>
          <div style="font-size:.75rem;color:#64748b;margin-top:.15rem">Pre &amp; Post</div>
        </div>
      </div>`;

      const body = modal.querySelector('#smModalBody');
      if (body) body.innerHTML = `
        <div style="display:flex;gap:.5rem;flex-wrap:wrap;align-items:center;margin-bottom:1.25rem;padding:.75rem;background:#f8fafc;border-radius:10px;border:1px solid #e2e8f0" id="smFilters">
          <span style="font-size:.75rem;font-weight:700;color:#475569;margin-right:.25rem">Filter:</span>
          ${instrSel} ${gradeSel} ${stdSel}
          ${(_smFilterInstr!=='all'||_smFilterGrade!=='all'||_smFilterStandard!=='all') ?
            `<button onclick="irlab.smClearFilters()" style="font-size:.75rem;padding:.3rem .625rem;border-radius:6px;border:none;background:#fee2e2;color:#b91c1c;cursor:pointer;font-weight:600">✕ Clear</button>` : ''}
        </div>
        ${kpis}
        <div style="overflow-x:auto">
          <table style="width:100%;border-collapse:collapse;font-size:.8125rem">
            <thead>
              <tr style="background:#f8fafc;border-bottom:2px solid #e2e8f0">
                <th style="padding:.5rem .625rem;text-align:left;color:#475569;font-size:.75rem">Scholar</th>
                <th style="padding:.5rem .625rem;text-align:center;color:#475569;font-size:.75rem">Grade</th>
                <th style="padding:.5rem .625rem;text-align:left;color:#475569;font-size:.75rem">Standard</th>
                <th style="padding:.5rem .625rem;text-align:left;color:#475569;font-size:.75rem">Subject</th>
                <th style="padding:.5rem .625rem;text-align:left;color:#475569;font-size:.75rem">Instructor</th>
                <th style="padding:.5rem .625rem;text-align:center;color:#475569;font-size:.75rem">Pre</th>
                <th style="padding:.5rem .625rem;text-align:center;color:#475569;font-size:.75rem">Post</th>
                <th style="padding:.5rem .625rem;text-align:center;color:#475569;font-size:.75rem">Δ Score</th>
                <th style="padding:.5rem .625rem;text-align:center;color:#475569;font-size:.75rem">Pre Placement</th>
                <th style="padding:.5rem .625rem;text-align:center;color:#475569;font-size:.75rem">Post Placement</th>
                <th style="padding:.5rem .625rem;text-align:center;color:#475569;font-size:.75rem">Direction</th>
              </tr>
            </thead>
            <tbody>
              ${tableRows || '<tr><td colspan="11" style="padding:1.5rem;text-align:center;color:#94a3b8">No data for this selection.</td></tr>'}
            </tbody>
          </table>
        </div>`;
    }

    function smShowModal() {
      // Reset filters on fresh open so previous selections don't persist unexpectedly
      _smFilterGrade    = 'all';
      _smFilterInstr    = 'all';
      _smFilterStandard = 'all';

      const existing = document.getElementById('smModal');
      if (existing) existing.remove();

      const modalHtml = `
<div id="smModal" style="position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:9999;display:flex;align-items:flex-start;justify-content:center;padding:2rem 1rem;overflow-y:auto" onclick="if(event.target===this)irlab.smCloseModal()">
  <div style="background:#fff;border-radius:16px;padding:1.5rem;max-width:1100px;width:100%;box-shadow:0 20px 60px rgba(0,0,0,.25);max-height:90vh;overflow-y:auto">
    <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:1.25rem">
      <div>
        <div style="font-size:.625rem;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:#7c3aed">Standards Mastery · Middlesex County STEM Charter School</div>
        <div style="font-family:'DM Serif Display',serif;font-size:1.25rem;color:#0a1628;margin-top:.2rem">All Apprentices — Scholar Details</div>
        <div style="font-size:.8125rem;color:#64748b;margin-top:.2rem">EOY SY 2025–2026 · Form A = Pre &nbsp;|&nbsp; Form B = Post · Live from Google Sheets</div>
      </div>
      <button onclick="irlab.smCloseModal()" style="background:none;border:none;font-size:1.25rem;cursor:pointer;color:#94a3b8;padding:.25rem">✕</button>
    </div>
    <div id="smModalBody"></div>
    <div style="margin-top:1rem;font-size:.6875rem;color:#94a3b8;padding-top:.75rem;border-top:1px solid #f1f5f9">
      Source: Standards Mastery · Middlesex County STEM Charter School · SY 2025–2026 · Live from Google Sheets
      ${SM_DATA.ts ? ' · Updated ' + new Date(SM_DATA.ts).toLocaleString() : ''}
    </div>
  </div>
</div>`;
      document.body.insertAdjacentHTML('beforeend', modalHtml);
      _smRenderModalFilters();
    }

    function smClearFilters() {
      _smFilterGrade = 'all'; _smFilterInstr = 'all'; _smFilterStandard = 'all';
      _smRenderModalFilters();
    }

    function smCloseModal() {
      const m = document.getElementById('smModal');
      if (m) m.remove();
    }

    function renderSMSection() {
      const hasData = SM_DATA.loaded && SM_DATA.rows.length > 0;

      let html = `<div class="irlab-card" id="smSection" style="margin-top:1.5rem">
        <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:.75rem">
          <div>
            <div style="font-size:.625rem;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:#7c3aed;margin-bottom:.2rem">Standards Mastery · EOY SY 2025–2026</div>
            <div style="font-family:'DM Serif Display',serif;font-size:1.125rem;color:var(--navy)">Reading Standards Mastery</div>
            <div style="font-size:.8125rem;color:var(--muted);margin-top:.2rem">Middlesex County STEM Charter School · All Grades · Live from Google Sheets</div>
          </div>
          <div style="display:flex;gap:.5rem;align-items:center;flex-wrap:wrap">`;

      if (_smLoading) {
        html += `<span style="font-size:.8125rem;color:var(--muted)">⏳ Loading…</span>`;
      } else if (_smError) {
        html += `<span style="font-size:.8125rem;color:#b91c1c">⚠️ Error</span>
          <button onclick="irlab.smRefresh()" style="font-size:.75rem;padding:.35rem .75rem;border-radius:8px;background:#b91c1c;color:#fff;border:none;cursor:pointer">Retry</button>`;
      } else if (!hasData) {
        html += `<button onclick="irlab.smRefresh()" style="font-size:.875rem;padding:.45rem 1.1rem;border-radius:10px;background:linear-gradient(135deg,#5b21b6,#7c3aed);color:#fff;border:none;cursor:pointer;font-weight:600">⬇ Load Data</button>`;
      } else {
        // Summary KPIs (compact inline)
        const allRows   = SM_DATA.rows;
        const pairs     = SM_DATA.pairs;
        const scholars  = new Set(allRows.map(r => r.studentId)).size;
        const bothPairs = pairs.filter(p => p.formA && p.formB);
        const gains     = bothPairs.map(p => p.formB.score - p.formA.score);
        const improved  = gains.filter(g => g > 0).length;
        const pctImp    = gains.length > 0 ? Math.round(improved/gains.length*100) : null;
        const avgGain   = gains.length > 0 ? Math.round(gains.reduce((s,g)=>s+g,0)/gains.length*10)/10 : null;

        html += `
          <span style="font-size:.8125rem;color:var(--muted)">${scholars} scholars · ${bothPairs.length} pre/post pairs · <strong style="color:${pctImp!==null&&pctImp>=50?'#0d6e3a':'#d97706'}">${pctImp!==null?pctImp+'%':'—'} improved</strong> · avg <strong style="color:${avgGain!==null&&avgGain>0?'#0d6e3a':avgGain!==null&&avgGain<0?'#dc2626':'#64748b'}">${avgGain!==null?(avgGain>0?'+':'')+avgGain+'%':'—'}</strong></span>
          <button onclick="irlab.smShowModal()" style="font-size:.875rem;padding:.45rem 1.1rem;border-radius:10px;background:linear-gradient(135deg,#5b21b6,#7c3aed);color:#fff;border:none;cursor:pointer;font-weight:600">View Scholar Details →</button>
          <button onclick="irlab.smRefresh()" style="font-size:.75rem;padding:.35rem .75rem;border-radius:8px;border:1.5px solid var(--border);background:var(--surface);cursor:pointer;color:var(--text-2)">↺ Refresh</button>`;
      }

      html += `</div></div></div>`;
      return html;
    }

    // ── Public API ────────────────────────────────────────────────────────────
    function onPanelOpen() {
      // Always re-read session dept so dept is locked even if session was set after first open
      const sess = window.NJTC_SESSION;
      if (sess && sess.dept) {
        // Normalize: shared-utils uses 'training' but DEPT_CFG uses 'training_development'
        const _normDept = sess.dept === 'training' ? 'training_development' : sess.dept;
        if (DEPT_CFG[_normDept]) _irlDept = _normDept;
      }
      if (!_irlBuilt) {
        _irlBuilt = true;
        loadData(); renderLab();
        if (IRLAB_LIVE_2PACX) {
          setTimeout(()=>_irlFetchLive(false).catch(()=>{}),800);
          setInterval(()=>{ const p=document.getElementById('panel-iready-lab'); if(p&&p.classList.contains('active')) _irlFetchLive(false).catch(()=>{}); },IRLAB_REFRESH_MS);
        }
        // Auto-fetch MOY data on first open — no user action required
        setTimeout(() => {
          _moyFetchLive(false).then(() => {
            if (MOY_DATA.loaded && (MOY_DATA.math.length > 0 || MOY_DATA.ela.length > 0)) {
              renderLab(); // re-render now that MOY data is available
            }
          }).catch(() => {});
        }, 1200); // after EOY fetch starts — staggered to avoid bandwidth contention
        // Auto-fetch Standards Mastery data on first open
        setTimeout(() => {
          _smFetchLive(false).then(() => {
            if (SM_DATA.loaded) renderLab();
          }).catch(() => {});
        }, 2000); // staggered after MOY fetch
      } else {
        renderLab();  // re-render on every open so dept lock persists
        if (IRLAB_LIVE_2PACX) { _irlFetchLive(false).catch(()=>{}); }
        // Re-fetch MOY if not yet loaded or cache is stale
        if (!MOY_DATA.loaded) {
          _moyFetchLive(false).then(() => {
            if (MOY_DATA.loaded) renderLab();
          }).catch(() => {});
        }
        // Re-fetch SM if not yet loaded
        if (!SM_DATA.loaded) {
          _smFetchLive(false).then(() => {
            if (SM_DATA.loaded) renderLab();
          }).catch(() => {});
        }
      }
    }

    function setMode(m) {
      // Quick CSV mode restricted to data dept only
      if (m === 'quickcsv') {
        const sess = window.NJTC_SESSION;
        const myDept = (sess && sess.dept) ? sess.dept : _irlDept;
        if (myDept !== 'data') return;
      }
      _irlMode = m;
      _irlScholarDrill = null;
      _irlTutorDrill   = null;
      renderLab();
    }
    function setYear(y)        { _irlYear=y; _irlDistrict='all'; _irlSchool='all'; _irlGrade='all'; renderLab(); }
    function setSubject(s)     { _irlSubject=s;      renderLab(); }
    function setDistrict(d)    { _irlDistrict=d; _irlSchool='all'; renderLab(); }
    function setSchool(s)      { _irlSchool=s;       renderLab(); }
    function setGrade(g)       { _irlGrade=g;        renderLab(); }
    function setScholarType(t) { _irlScholarType=t;  renderLab(); }
    function setPilot(p)       { _irlPilot=p;        renderLab(); }
    function setSearch(q)      { _irlSearch=q;       renderLab(); }
    function setBreakdownTab(t){ _irlBreakdownTab=t; renderLab(); }
    function setDeepTab(t)     { _irlDeepTab=t;      renderLab(); }
    function setDept(d) {
      // Only leadership and data may switch dept views
      const sess = window.NJTC_SESSION;
      const myDept = (sess && sess.dept) ? sess.dept : _irlDept;
      const canSwitch = ['leadership','data'].includes(myDept);
      if (!canSwitch) {
        // Non-privileged dept — silently ignore any attempt to switch
        return;
      }
      _irlDept = d;
      renderLab();
    }

    function drillScholar(name) { _irlScholarDrill=name; _irlTutorDrill=null;   renderLab(); }
    function drillTutor(name)   { _irlTutorDrill=name;   _irlScholarDrill=null; renderLab(); }
    function closeDrill()       { _irlScholarDrill=null;  _irlTutorDrill=null;   renderLab(); }

    function handleFileUpload(e) {
      const file=e.target.files[0]; if(!file) return;
      const reader=new FileReader();
      reader.onload=ev=>{
        const rows=parseCSV(ev.target.result);
        if(!rows.length){alert('Could not parse CSV.');return;}
        _irlCsvData={rows,filename:file.name};
        renderLab();
      };
      reader.readAsText(file);
    }
    function clearCsv() { _irlCsvData=null; renderLab(); }

    // Called from legacy embed script (now a no-op — data loads from localStorage or panel dataset)
    function embedData(mathCsv,elaCsv,mathRepCsv,elaRepCsv) {
      const panel=document.getElementById('panel-iready-lab');
      if(!panel) return;
      if(mathCsv)    panel.dataset.mathCsv=mathCsv;
      if(elaCsv)     panel.dataset.elaCsv=elaCsv;
      if(mathRepCsv) panel.dataset.mathRepCsv=mathRepCsv;
      if(elaRepCsv)  panel.dataset.elaRepCsv=elaRepCsv;
      // Reset so loadData() re-reads on next panel open
      IRLAB_DATA.loaded=false;
    }

    // ── Export tutor academic data for HR profile overlay ──────────────
    function getTutorAcademicData() {
      const allRows = [...IRLAB_DATA.math, ...IRLAB_DATA.ela,
                       ...IRLAB_DATA.mathRepeat, ...IRLAB_DATA.elaRepeat];
      if (!allRows.length) return null;
      return buildTutorMap(allRows);
    }

    // ── getTutorAcademicImpact(tutorName?) ─────────────────────────────────
    // Returns per-tutor academic outcome metrics (median pctTypical for Math
    // and ELA separately) across ALL school years in the dataset.
    // pctTypical is stored as a ratio (1.0 = 100% typical growth) — output
    // is rounded to integer percentage (e.g., 83 = 83% of typical growth).
    // Tutor name matching: requires last-name token match + at least one
    // other token, case-insensitive.
    // Returns: array of impact objects, or null if no data/no match.
    function getTutorAcademicImpact(tutorName) {
      if (!IRLAB_DATA.loaded) loadData();
      const allRows = [
        ...(IRLAB_DATA.math      || []), ...(IRLAB_DATA.ela      || []),
        ...(IRLAB_DATA.mathRepeat|| []), ...(IRLAB_DATA.elaRepeat|| [])
      ];
      if (!allRows.length) return null;

      // Accumulate per-tutor data across all rows and years
      const tutorData = {};
      allRows.forEach(function(r) {
        (r.tutors || []).forEach(function(t) {
          if (!t || !t.trim()) return;
          var tname = t.trim();
          if (!tutorData[tname]) {
            tutorData[tname] = {
              name: tname, mathTyp: [], elaTyp: [],
              scholars: new Set(), years: new Set(),
              moved: 0, held: 0, regressed: 0, glCount: 0, total: 0, gains: []
            };
          }
          var d = tutorData[tname];
          d.scholars.add(r.scholarId || r.scholarName || '');
          if (r.year) d.years.add(r.year);
          if (r.pctTypical !== null && !isNaN(r.pctTypical) && isFinite(r.pctTypical)) {
            if (r.subject === 'Math') d.mathTyp.push(r.pctTypical);
            else                      d.elaTyp.push(r.pctTypical);
          }
          var mv = plIdx(r.springRelPlacement) - plIdx(r.baseRelPlacement);
          if (mv > 0) d.moved++; else if (mv < 0) d.regressed++; else d.held++;
          d.total++;
          if (isOnGL(r.springRelPlacement)) d.glCount++;
          if (r.springGain !== null && !isNaN(r.springGain)) d.gains.push(r.springGain);
        });
      });

      // Summarise each tutor entry
      var results = Object.values(tutorData).map(function(d) {
        var mMed = medianArr(d.mathTyp), eMed = medianArr(d.elaTyp);
        var sortedYears = [...d.years].sort();
        return {
          name:                  d.name,
          scholarCount:          d.scholars.size,
          years:                 sortedYears,
          yearSpan:              sortedYears.length > 1 ? sortedYears[0] + ' – ' + sortedYears[sortedYears.length-1] : (sortedYears[0] || ''),
          mathMedianPctTypical:  mMed !== null ? Math.round(mMed * 100) : null,
          elaMedianPctTypical:   eMed !== null ? Math.round(eMed * 100) : null,
          mathRecords:           d.mathTyp.length,
          elaRecords:            d.elaTyp.length,
          pctMoved:              d.total > 0 ? Math.round(d.moved   / d.total * 100) : null,
          pctGL:                 d.total > 0 ? Math.round(d.glCount / d.total * 100) : null,
          avgGain:               d.gains.length ? Math.round(d.gains.reduce(function(a,b){return a+b;},0)/d.gains.length) : null,
          total:                 d.total
        };
      });

      if (!tutorName) return results; // return all tutors

      // Fuzzy name filter — require last-name token match + at least one other token
      var normQ = tutorName.toLowerCase().replace(/[^a-z ]/g,'').replace(/\s+/g,' ').trim();
      var qToks = normQ.split(' ').filter(function(t){ return t.length > 1; });
      var qLast = qToks[qToks.length - 1] || '';
      var matches = results.filter(function(r) {
        var normN = r.name.toLowerCase().replace(/[^a-z ]/g,'').replace(/\s+/g,' ').trim();
        if (normN === normQ) return true;
        var nToks = normN.split(' ').filter(function(t){ return t.length > 1; });
        var nLast = nToks[nToks.length - 1] || '';
        if (nLast !== qLast) return false;
        return qToks.some(function(t){ return nToks.indexOf(t) >= 0; });
      });
      return matches.length > 0 ? matches : null;
    }

    // getSummary() — returns aggregate iReady outcomes using named row properties
    function getSummary(syFilter) {
      if (!IRLAB_DATA.loaded) loadData();
      // IRLAB_DATA rows are OBJECTS (from normalizeRow/decodeRows), not arrays.
      // Fields: r.scholarId, r.year, r.grade, r.school, r.district,
      //         r.springGain, r.pctTypical, r.baseRelPlacement, r.springRelPlacement,
      //         r.race, r.sex, r.ell, r.sped, r.ecodis, r.subject
      var allRows = [].concat(IRLAB_DATA.math || [], IRLAB_DATA.ela || [],
                              IRLAB_DATA.mathRepeat || [], IRLAB_DATA.elaRepeat || []);
      if (!allRows.length) return null;
      // Sets for main-sheet membership — used to exclude repeat-sheet rows from "All Scholar" medians.
      // Repeat scholars already appear in the main sheets; including the repeat sheet again
      // would double-weight them and pull the median away from the true "All Scholar" value.
      var _mathMainSet = new Set(IRLAB_DATA.math || []);
      var _elaMainSet  = new Set(IRLAB_DATA.ela  || []);

      // SY filter: if syFilter passed, restrict to that year. Otherwise use most recent.
      var allYears = [];
      allRows.forEach(function(r){ if (r.year) allYears.push(r.year); });
      var uniqueYears = allYears.filter(function(v,i,a){ return a.indexOf(v)===i; }).sort();
      // syFilter='ALL' → include all years; falsy → default to most recent year
      var activeSY = (syFilter && syFilter !== 'ALL') ? syFilter : (syFilter === 'ALL' ? null : (uniqueYears[uniqueYears.length-1] || null));

      // Filter to active SY (or all years if no year data found)
      var filtered = activeSY
        ? allRows.filter(function(r){ return r.year === activeSY; })
        : allRows;

      var totalScholars = new Set();
      var totalWithGrowth = 0, totalRows = 0;
      var gradeSet = new Set();
      var schoolSet = new Set();
      var districtSet = new Set();
      // Placement breakdown
      var placementCounts = { base: {}, spring: {} };
      // Avg placement index by subject (PLACEMENT_ORDER index 0–4)
      var mathBasePlIdx=0,mathSpringPlIdx=0,mathPlN=0;
      var elaBasePlIdx=0,elaSpringPlIdx=0,elaPlN=0;
      var PL_ORDER=['3 or More Grade Levels Below','2 Grade Levels Below','1 Grade Level Below','Early On Grade Level','Mid or Above Grade Level'];
      var PL_SHORT=['3+ Below','2 Below','1 Below','Early GL','On/Above GL'];
      function _plIdx(p){var i=PL_ORDER.indexOf(p);return i>=0?i:null;}
      // Avg diagnostic gain vs typical growth by subject
      var mathGainSum=0,mathGainN=0,mathTypicalSum=0,mathTypicalN=0;
      var elaGainSum=0,elaGainN=0,elaTypicalSum=0,elaTypicalN=0;
      // Per-scholar pctTypical arrays for median.
      // Read r.pctTypical DIRECTLY — this is the BW col (Math) and CP col (ELA) from iReady CSVs.
      // Both store the ratio: 1.0 = 100% of typical growth. Include ALL rows with a numeric value
      // (including zeros) — matches iReady's own pivot-table median.
      // Computed from embedded data corpus: Math all-years≈83%, ELA all-years≈89%, ELA 2024-2025=100%, Math 2024-2025≈86%.
      var mathPctTypArr=[], elaPctTypArr=[];
      // Growth by subject
      var mathGrowth = 0, mathTotal = 0, elaGrowth = 0, elaTotal = 0;
      // Race breakdown (unique scholars)
      var scholarRace = {};
      var seenScholars = {};

      filtered.forEach(function(r) {
        if (!r) return;
        totalRows++;
        var sid = r.scholarId || r.scholarName || '';
        if (sid) totalScholars.add(sid);
        var gain = r.springGain != null ? parseFloat(r.springGain) : NaN;
        var hasGrowth = !isNaN(gain) && gain > 0;
        if (hasGrowth) totalWithGrowth++;
        if (r.grade) gradeSet.add(r.grade);
        if (r.school) schoolSet.add(r.school);
        if (r.district) districtSet.add(r.district);
        // Placement
        if (r.baseRelPlacement) placementCounts.base[r.baseRelPlacement] = (placementCounts.base[r.baseRelPlacement]||0)+1;
        if (r.springRelPlacement) placementCounts.spring[r.springRelPlacement] = (placementCounts.spring[r.springRelPlacement]||0)+1;
        // By subject
        var subj = (r.subject||'').toLowerCase();
        if (subj.indexOf('math')>=0) {
          mathTotal++;
          if(hasGrowth) mathGrowth++;
          var _mb=_plIdx(r.baseRelPlacement),_ms=_plIdx(r.springRelPlacement);
          if(_mb!==null&&_ms!==null){mathBasePlIdx+=_mb;mathSpringPlIdx+=_ms;mathPlN++;}
          var _mg=r.springGain!=null?parseFloat(r.springGain):NaN;
          if(!isNaN(_mg)){mathGainSum+=_mg;mathGainN++;}
          var _mt=r.annualTypical!=null?parseFloat(r.annualTypical):NaN;
          if(!isNaN(_mt)&&_mt>0){mathTypicalSum+=_mt;mathTypicalN++;}
          // Read BW col directly: r.pctTypical is the stored ratio (1.0=100%)
          // Only collect from main-sheet rows (_mathMainSet) — repeat scholars are already present
          // in the main sheet; pulling from mathRepeat again would double-weight them.
          if(_mathMainSet.has(r)){var _mp=r.pctTypical!=null?parseFloat(r.pctTypical):NaN;if(!isNaN(_mp)){mathPctTypArr.push(_mp);}}
        } else if (subj.indexOf('ela')>=0) {
          elaTotal++;
          if(hasGrowth) elaGrowth++;
          var _eb=_plIdx(r.baseRelPlacement),_es=_plIdx(r.springRelPlacement);
          if(_eb!==null&&_es!==null){elaBasePlIdx+=_eb;elaSpringPlIdx+=_es;elaPlN++;}
          var _eg=r.springGain!=null?parseFloat(r.springGain):NaN;
          if(!isNaN(_eg)){elaGainSum+=_eg;elaGainN++;}
          var _et=r.annualTypical!=null?parseFloat(r.annualTypical):NaN;
          if(!isNaN(_et)&&_et>0){elaTypicalSum+=_et;elaTypicalN++;}
          // Only collect from main-sheet rows (_elaMainSet) — same double-count fix as Math above
          if(_elaMainSet.has(r)){var _ep=r.pctTypical!=null?parseFloat(r.pctTypical):NaN;if(!isNaN(_ep)){elaPctTypArr.push(_ep);}}
        }
        // Race — count unique scholars
        if (sid && !seenScholars[sid]) {
          seenScholars[sid] = true;
          var race = r.race || 'Not Specified';
          scholarRace[race] = (scholarRace[race]||0)+1;
        }
      });

      var growthPct = totalRows > 0 ? parseFloat((totalWithGrowth/totalRows*100).toFixed(1)) : null;
      // Avg placement labels (short) from index
      // Returns numeric placement avg on 0–4 scale (1 decimal), e.g. "2.5"
      function _plAvg(sum,n){if(!n)return null;return (sum/n).toFixed(1);}
      // Avg gain and pct of typical
      var mathAvgGain    = mathGainN    ? Math.round(mathGainSum/mathGainN)       : null;
      var mathAvgTypical = mathTypicalN ? Math.round(mathTypicalSum/mathTypicalN) : null;
      var mathPctTypical = (mathAvgGain!==null&&mathAvgTypical) ? Math.round(mathAvgGain/mathAvgTypical*100) : null;
      var elaAvgGain     = elaGainN     ? Math.round(elaGainSum/elaGainN)         : null;
      var elaAvgTypical  = elaTypicalN  ? Math.round(elaTypicalSum/elaTypicalN)   : null;
      var elaPctTypical  = (elaAvgGain!==null&&elaAvgTypical)  ? Math.round(elaAvgGain/elaAvgTypical*100)   : null;
      // Median % to Typical Growth — median of per-scholar gain/annualTypical ratios → *100 for display
      function _median(arr) {
        if (!arr.length) return null;
        var sorted = arr.slice().sort(function(a,b){return a-b;});
        var mid = Math.floor(sorted.length/2);
        return sorted.length%2 ? sorted[mid] : (sorted[mid-1]+sorted[mid])/2;
      }
      var mathMedianPctTypical = mathPctTypArr.length ? Math.round(_median(mathPctTypArr)*100) : null;
      var elaMedianPctTypical  = elaPctTypArr.length  ? Math.round(_median(elaPctTypArr)*100)  : null;
      return {
        activeSY: activeSY,
        allYears: uniqueYears,
        hasCurrentYearData: uniqueYears.indexOf('2025-2026') >= 0,
        dataSource: IRLAB_DATA.source || 'Embedded Historical (SY 2022-2025)',
        totalScholars: totalScholars.size,
        totalRows: totalRows,
        totalWithGrowth: totalWithGrowth,
        growthPct: growthPct,
        mathRows: (IRLAB_DATA.math||[]).length,      // main sheet only — "All Scholar: Diagnostic Count"
        elaRows:  (IRLAB_DATA.ela||[]).length,       // main sheet only — repeat scholars already included
        mathGrowthPct: mathTotal>0 ? parseFloat((mathGrowth/mathTotal*100).toFixed(1)) : null,
        elaGrowthPct:  elaTotal>0  ? parseFloat((elaGrowth/elaTotal*100).toFixed(1)) : null,
        grades: Array.from(gradeSet).sort(),
        schools: schoolSet.size,
        districts: districtSet.size,
        schoolYears: uniqueYears,
        placementCounts: placementCounts,
        scholarRace: scholarRace,
        mathAvgBasePl:   _plAvg(mathBasePlIdx,mathPlN),
        mathAvgSpringPl: _plAvg(mathSpringPlIdx,mathPlN),
        elaAvgBasePl:    _plAvg(elaBasePlIdx,elaPlN),
        elaAvgSpringPl:  _plAvg(elaSpringPlIdx,elaPlN),
        mathPlN: mathPlN,
        elaPlN:  elaPlN,
        mathAvgGain:    mathAvgGain,
        mathAvgTypical: mathAvgTypical,
        mathPctTypical: mathPctTypical,
        mathMedianPctTypical: mathMedianPctTypical,
        elaAvgGain:     elaAvgGain,
        elaAvgTypical:  elaAvgTypical,
        elaPctTypical:  elaPctTypical,
        elaMedianPctTypical: elaMedianPctTypical,
        mathGainN:      mathGainN,
        elaGainN:       elaGainN,
        // All-years program-wide medians (for exec dashboard — full embedded corpus regardless of SY filter)
        // Use MAIN sheet only — repeat scholars are already included in the main "All Scholar" sheet.
        // Combining main+repeat would double-count repeats and skew the median downward.
        mathMedianPctAllYears: (function(){
          var arr=[];
          (IRLAB_DATA.math||[]).forEach(function(r){
            if(!r) return;
            var p=r.pctTypical!=null?parseFloat(r.pctTypical):NaN;
            if(!isNaN(p)) arr.push(p);
          });
          if(!arr.length) return mathMedianPctTypical;
          var s=arr.slice().sort(function(a,b){return a-b;}); var m=Math.floor(s.length/2);
          return Math.round((s.length%2?s[m]:(s[m-1]+s[m])/2)*100);
        }()),
        elaMedianPctAllYears: (function(){
          var arr=[];
          (IRLAB_DATA.ela||[]).forEach(function(r){
            if(!r) return;
            var p=r.pctTypical!=null?parseFloat(r.pctTypical):NaN;
            if(!isNaN(p)) arr.push(p);
          });
          if(!arr.length) return elaMedianPctTypical;
          var s=arr.slice().sort(function(a,b){return a-b;}); var m=Math.floor(s.length/2);
          return Math.round((s.length%2?s[m]:(s[m-1]+s[m])/2)*100);
        }())
      };
    }

    // Expose snapshot reader so any module can access the latest Data upload
    function getSnapshot() {
      try {
        var snap = JSON.parse(localStorage.getItem('njtc_irlab_snapshot_v1') || 'null');
        return snap;
      } catch(e) { return null; }
    }

    // ── Executive Insight Panel data ─────────────────────────────────────────
    // getInsightMetrics(syFilter) — compute Cards A–E metrics + drilldown data.
    // Use IRLAB_DATA main sheets only (math + ela); repeat sheets excluded to prevent
    // double-counting scholars who appear in both main and repeat datasets.
    // syFilter: specific SY string (e.g. '2024-2025'), '' or 'ALL' for program-wide.
    function getInsightMetrics(optsOrYear) {
      if (!IRLAB_DATA.loaded) loadData();
      // Accept either a legacy string year arg or a full opts object
      var _opts = (optsOrYear && typeof optsOrYear === 'object') ? optsOrYear : {};
      var _fYear        = (typeof optsOrYear === 'string') ? optsOrYear : (_opts.year        !== undefined ? _opts.year        : (_irlYear        !== 'all' ? _irlYear        : ''));
      var _fDistrict    = _opts.district    !== undefined ? _opts.district    : (_irlDistrict    !== 'all' ? _irlDistrict    : '');
      var _fSchool      = _opts.school      !== undefined ? _opts.school      : (_irlSchool      !== 'all' ? _irlSchool      : '');
      var _fGrade       = _opts.grade       !== undefined ? _opts.grade       : (_irlGrade       !== 'all' ? _irlGrade       : '');
      var _fSubject     = _opts.subject     !== undefined ? _opts.subject     : (_irlSubject     !== 'all' ? _irlSubject     : '');
      var _fScholarType = _opts.scholarType !== undefined ? _opts.scholarType : (_irlScholarType !== 'all' ? _irlScholarType : '');
      var _fPilot       = _opts.pilot       !== undefined ? _opts.pilot       : (_irlPilot       !== 'all' ? _irlPilot       : '');
      if (!IRLAB_DATA.loaded) loadData();
      var rows = [].concat(IRLAB_DATA.math || [], IRLAB_DATA.ela || []);
      if (_fYear    && _fYear    !== 'ALL') rows = rows.filter(function(r){ return r && r.year     === _fYear;    });
      if (_fDistrict)                       rows = rows.filter(function(r){ return r && r.district === _fDistrict; });
      if (_fSchool)                         rows = rows.filter(function(r){ return r && r.school   === _fSchool;   });
      if (_fGrade)                          rows = rows.filter(function(r){ return r && r.grade    === _fGrade;    });
      if (_fSubject)                        rows = rows.filter(function(r){ return r && r.subject  === _fSubject;  });
      if (_fScholarType === 'repeat')    rows = rows.filter(function(r){ return r && _isRepeatScholar(r); });
      if (_fScholarType === 'nonrepeat') rows = rows.filter(function(r){ return r && !_isRepeatScholar(r); });
      if (_fPilot === 'pilot')    rows = rows.filter(function(r){ return r && r.isPilot === true; });
      if (_fPilot === 'nonpilot') rows = rows.filter(function(r){ return r && r.isPilot !== true; });
      // All available years from main sheets (for SY-alignment check with Pearl)
      var allSrcRows = [].concat(IRLAB_DATA.math || [], IRLAB_DATA.ela || []);
      var allYears = [];
      allSrcRows.forEach(function(r){ if(r && r.year && allYears.indexOf(r.year)<0) allYears.push(r.year); });
      allYears.sort();

      function _med(arr) {
        if (!arr.length) return null;
        var s = arr.slice().sort(function(a,b){ return a-b; });
        var m = Math.floor(s.length/2);
        return s.length%2 ? s[m] : (s[m-1]+s[m])/2;
      }

      var scaleGains=[], monthsArr=[], pctExpArr=[], springWeeksArr=[], weeksGrowthArr=[];
      var drillRows=[];
      var byRace={}, byEthnicity={}, byEconStatus={}, byDistrict={}, bySchool={}, byGrade={}, byTutor={};

      rows.forEach(function(r) {
        if (!r) return;
        // Scale score gain: use iReady's pre-computed springGain (diagnostic gain) as primary.
        // Fall back to springScore - baseScore when springGain not present (live-fetched data).
        var gain = (r.springGain != null && !isNaN(parseFloat(r.springGain)))
          ? parseFloat(r.springGain)
          : (r.springScore != null && r.baseScore != null ? r.springScore - r.baseScore : NaN);
        // pctTypical: Spring_pct_progress_typical_growth — ratio where 1.0 = 100% of typical growth.
        var pct    = (r.pctTypical != null) ? parseFloat(r.pctTypical) : NaN;
        // Months of growth = scale gain ÷ (annualTypical ÷ 10) = pctTypical × 10.
        var months = !isNaN(pct) ? pct * 10 : NaN;
        var pctExp = !isNaN(pct) ? pct * 100 : NaN;

        if (!isNaN(gain)) scaleGains.push(gain);
        if (!isNaN(months)) monthsArr.push(months);
        if (!isNaN(pctExp)) pctExpArr.push(pctExp);
        var wks = (r.springWeeks != null && parseFloat(r.springWeeks) > 0) ? parseFloat(r.springWeeks) : NaN;
        if (!isNaN(wks)) springWeeksArr.push(wks);
        // Weeks of Growth (NJTC/Mysti methodology) — pre-computed per row in normalizeRow().
        var wksGrowth = (r.weeksOfGrowth != null && !isNaN(parseFloat(r.weeksOfGrowth))) ? parseFloat(r.weeksOfGrowth) : NaN;
        if (!isNaN(wksGrowth)) weeksGrowthArr.push(wksGrowth);

        var raceKey = (r.race||'').trim() || 'Not Specified';
        var ethKey  = /yes/i.test(r.hispanic||'') ? 'Hispanic/Latino'
                    : /no/i.test(r.hispanic||'')  ? 'Non-Hispanic' : 'Not Specified';
        var econKey = /yes/i.test(r.ecodis||'')   ? 'Eco. Disadvantaged'
                    : /no/i.test(r.ecodis||'')    ? 'Not Disadvantaged' : 'Not Specified';
        var distKey = (r.district||'Unknown').trim();
        var tutorArr = (r.tutors && r.tutors.length) ? r.tutors : (r.instructor ? [r.instructor] : []);

        if (!isNaN(gain)) {
          function _push(map, key, obj) { if (!map[key]) map[key]=[]; map[key].push(obj); }
          var gobj = { gain:gain, months:isNaN(months)?null:months, pctExp:isNaN(pctExp)?null:pctExp };
          _push(byRace, raceKey, gobj);
          _push(byEthnicity, ethKey, gobj);
          _push(byEconStatus, econKey, gobj);
          _push(byDistrict, distKey, gobj);
          _push(bySchool, (r.school||'Unknown').trim(), gobj);
          _push(byGrade,  (r.grade ||'Unknown').trim(), gobj);
          tutorArr.forEach(function(t){ if(t){ _push(byTutor, t, gobj); } });
        }
        if (!isNaN(gain) || !isNaN(pct)) {
          drillRows.push({
            scholarId:   r.scholarId   || '',
            district:    r.district    || '',
            school:      r.school      || '',
            grade:       r.grade       || '',
            subject:     r.subject     || '',
            year:        r.year        || '',
            tutor:       r.instructor  || '',
            race:        raceKey,
            ethnicity:   ethKey,
            econ:        econKey,
            baseScore:   r.baseScore   != null ? Math.round(r.baseScore)   : null,
            springScore: r.springScore != null ? Math.round(r.springScore) : null,
            scaleGain:   isNaN(gain)   ? null : parseFloat(gain.toFixed(1)),
            monthsGrowth:isNaN(months) ? null : parseFloat(months.toFixed(1)),
            pctExpected: isNaN(pctExp) ? null : parseFloat(pctExp.toFixed(1))
          });
        }
      });

      function _groupMeds(obj) {
        return Object.keys(obj).map(function(k) {
          var arr  = obj[k];
          var g    = arr.map(function(x){return x.gain;}).filter(function(x){return x!=null&&!isNaN(x);});
          var mo   = arr.map(function(x){return x.months;}).filter(function(x){return x!=null&&!isNaN(x);});
          var pe   = arr.map(function(x){return x.pctExp;}).filter(function(x){return x!=null&&!isNaN(x);});
          return { label:k, n:g.length, medGain:_med(g), medMonths:_med(mo), medPct:_med(pe) };
        }).filter(function(x){ return x.n>=1; }).sort(function(a,b){ return b.n-a.n; });
      }

      // Card D/E SY-alignment: Pearl operational data is SY 2025–2026.
      // These cards activate automatically once iReady corpus includes that same year.
      var PEARL_SY   = '2025-2026';
      var syAligned  = allYears.indexOf(PEARL_SY) >= 0;

      // Card E: tutor impact leaders (only when SY-aligned; require ≥2 scholars per tutor)
      var tutorImpactLeaders = null;
      if (syAligned) {
        tutorImpactLeaders = _groupMeds(byTutor)
          .filter(function(x){return x.n>=2;})
          .sort(function(a,b){return (b.medGain||0)-(a.medGain||0);})
          .slice(0,5)
          .map(function(x){ return { tutor:x.label, avgGain:x.medGain, n:x.n }; });
      }

      // Card D: Learning Velocity (scale score gain ÷ tutoring hours) — 2025-2026 only.
      // Uses _tutorHours pre-computed in _irlProcess2526 (name+ID dual-join, already resolved).
      var medVelocity = null;
      if (syAligned) {
        var velArr = [];
        var _sy2526 = [].concat(IRLAB_DATA.math || [], IRLAB_DATA.ela || []).filter(function(r){ return r && r.year === PEARL_SY; });
        _sy2526.forEach(function(r) {
          var gain = (r.springGain != null && !isNaN(parseFloat(r.springGain)))
            ? parseFloat(r.springGain)
            : (r.springScore != null && r.baseScore != null ? r.springScore - r.baseScore : NaN);
          if (isNaN(gain)) return;
          var hrs = r._tutorHours;
          if (!hrs || hrs <= 0) return;
          velArr.push(gain / hrs);
        });
        medVelocity = _med(velArr);
      }

      var medGain   = _med(scaleGains);
      var medMonths = _med(monthsArr);
      var medPct    = _med(pctExpArr);
      var medWeeks  = _med(springWeeksArr);
      var medWeeksGrowth = _med(weeksGrowthArr);
      // Window-adjusted pct: compares median growth to what's expected for the actual
      // program window (medianSpringWeeks) rather than the iReady 30-week annual standard.
      // windowAdjustedPct = medianPctExpected ÷ (medianSpringWeeks ÷ 30)
      // 100% = scholars achieved exactly what is expected for their program's duration.
      var windowAdjustedPct = (medPct != null && medWeeks != null && medWeeks > 0)
        ? parseFloat((medPct / (medWeeks / 30)).toFixed(1))
        : null;

      return {
        hasData:            rows.length > 0,
        n:                  scaleGains.length,
        allYears:           allYears,
        medianScaleGain:    medGain   != null ? parseFloat(medGain.toFixed(1))   : null,
        medianMonthsGrowth: medMonths != null ? parseFloat(medMonths.toFixed(1)) : null,
        medianPctExpected:  medPct    != null ? parseFloat(medPct.toFixed(1))    : null,
        medianSpringWeeks:  medWeeks  != null ? parseFloat(medWeeks.toFixed(1))  : null,
        windowAdjustedPct:  windowAdjustedPct,
        // Scale Score Progression (NJTC/Mysti methodology) — median "Weeks of Growth"
        // across scholars, each measured against their OWN diagnostic window rather
        // than iReady's 30-week annual standard. See normalizeRow() for the formula.
        medianWeeksOfGrowth: medWeeksGrowth != null ? parseFloat(medWeeksGrowth.toFixed(1)) : null,
        weeksOfGrowthN:      weeksGrowthArr.length,
        syAligned:          syAligned,
        medVelocity:        medVelocity != null ? parseFloat(medVelocity.toFixed(2)) : null,
        tutorImpactLeaders: tutorImpactLeaders,
        drillRows:          drillRows,
        byRace:             _groupMeds(byRace),
        byEthnicity:        _groupMeds(byEthnicity),
        byEconStatus:       _groupMeds(byEconStatus),
        byDistrict:         _groupMeds(byDistrict),
        bySchool:           _groupMeds(bySchool),
        byGrade:            _groupMeds(byGrade),
        byTutor:            _groupMeds(byTutor)
      };
    }

    // ── Export filter modal (Data dept only) ─────────────────────────────────
    // Lets the user pick Subject/Year/District/School/Grade/Scholar Type for the
    // CSV/XLSX download independently of whatever filters are applied on-screen.
    function _irlExportOptions() {
      const allRows = _getPooledRows();
      const years   = [...new Set(allRows.map(r=>r.year))].filter(Boolean).sort();
      const dists   = [...new Set(allRows.map(r=>r.district))].filter(Boolean).sort();
      const distFiltered = (_irlExportFilters && _irlExportFilters.district !== 'all')
        ? allRows.filter(r=>r.district===_irlExportFilters.district) : allRows;
      const schools = [...new Set(distFiltered.map(r=>r.school))].filter(Boolean).sort();
      const grades  = [...new Set(distFiltered.map(r=>r.grade))].filter(Boolean).sort((a,b)=>{
        const na=parseInt(a)||99, nb=parseInt(b)||99; return na-nb;
      });
      return { years, dists, schools, grades };
    }

    function openExportModal(kind) {
      _irlExportKind = kind === 'xlsx' ? 'xlsx' : 'csv';
      // Seed from current on-screen filters so the export matches what's visible by default —
      // the user can then loosen or narrow further before downloading.
      _irlExportFilters = {
        subject: _irlSubject, year: _irlYear, district: _irlDistrict, school: _irlSchool,
        grade: _irlGrade, scholarType: _irlScholarType, pilot: _irlPilot,
      };
      const existing = document.getElementById('irlExportModal');
      if (existing) existing.remove();
      const modalHtml = `
<div id="irlExportModal" style="position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:9999;display:flex;align-items:center;justify-content:center;padding:1rem" onclick="if(event.target===this)irlab.closeExportModal()">
  <div style="background:#fff;border-radius:16px;padding:1.5rem;max-width:480px;width:100%;box-shadow:0 20px 60px rgba(0,0,0,.25);max-height:90vh;overflow-y:auto;font-family:inherit">
    <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:1rem">
      <div>
        <div style="font-size:.625rem;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:#7b2d8b">iReady Analysis Lab</div>
        <div style="font-family:'DM Serif Display',serif;font-size:1.15rem;color:#0a1628;margin-top:.2rem">Export ${_irlExportKind.toUpperCase()} — Choose Filters</div>
      </div>
      <button onclick="irlab.closeExportModal()" style="background:none;border:none;font-size:1.25rem;cursor:pointer;color:#94a3b8;padding:.25rem;line-height:1">✕</button>
    </div>
    <div id="irlExportModalBody"></div>
    <div style="display:flex;gap:.5rem;justify-content:flex-end;margin-top:1.25rem;padding-top:.75rem;border-top:1px solid #f1f5f9">
      <button onclick="irlab.closeExportModal()" style="padding:.45rem 1rem;border-radius:8px;border:1.5px solid var(--border);background:#fff;font-size:.8rem;font-weight:600;color:#475569;cursor:pointer;font-family:inherit">Cancel</button>
      <button onclick="irlab.confirmExport()" style="padding:.45rem 1.1rem;border-radius:8px;border:none;background:#0a2342;font-size:.8rem;font-weight:700;color:#fff;cursor:pointer;font-family:inherit">⬇ Download ${_irlExportKind.toUpperCase()}</button>
    </div>
  </div>
</div>`;
      document.body.insertAdjacentHTML('beforeend', modalHtml);
      _irlRenderExportModalBody();
    }

    function setExportFilter(key, val) {
      if (!_irlExportFilters) return;
      _irlExportFilters[key] = val;
      if (key === 'district') _irlExportFilters.school = 'all';  // reset dependent filter
      _irlRenderExportModalBody();
    }

    function _irlRenderExportModalBody() {
      const body = document.getElementById('irlExportModalBody');
      if (!body || !_irlExportFilters) return;
      const opt = _irlExportOptions();
      const f   = _irlExportFilters;
      const previewN = getAllRows(f).length;
      body.innerHTML = `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:.6rem;font-size:.78rem;color:#334155">
          <label style="display:flex;flex-direction:column;gap:.25rem">Subject
            <select onchange="irlab.setExportFilter('subject',this.value)" style="padding:.35rem .4rem;border-radius:6px;border:1px solid var(--border);font-family:inherit">
              <option value="all" ${f.subject==='all'?'selected':''}>Both Subjects</option>
              <option value="Math" ${f.subject==='Math'?'selected':''}>Math</option>
              <option value="ELA" ${f.subject==='ELA'?'selected':''}>ELA</option>
            </select>
          </label>
          <label style="display:flex;flex-direction:column;gap:.25rem">Year
            <select onchange="irlab.setExportFilter('year',this.value)" style="padding:.35rem .4rem;border-radius:6px;border:1px solid var(--border);font-family:inherit">
              <option value="all" ${f.year==='all'?'selected':''}>All Years</option>
              ${opt.years.map(y=>`<option value="${y}" ${f.year===y?'selected':''}>${y}</option>`).join('')}
            </select>
          </label>
          <label style="display:flex;flex-direction:column;gap:.25rem">District
            <select onchange="irlab.setExportFilter('district',this.value)" style="padding:.35rem .4rem;border-radius:6px;border:1px solid var(--border);font-family:inherit">
              <option value="all" ${f.district==='all'?'selected':''}>All Districts</option>
              ${opt.dists.map(d=>`<option value="${esc(d)}" ${f.district===d?'selected':''}>${esc(d)}</option>`).join('')}
            </select>
          </label>
          <label style="display:flex;flex-direction:column;gap:.25rem">School
            <select onchange="irlab.setExportFilter('school',this.value)" style="padding:.35rem .4rem;border-radius:6px;border:1px solid var(--border);font-family:inherit">
              <option value="all" ${f.school==='all'?'selected':''}>All Schools</option>
              ${opt.schools.map(s=>`<option value="${esc(s)}" ${f.school===s?'selected':''}>${esc(s)}</option>`).join('')}
            </select>
          </label>
          <label style="display:flex;flex-direction:column;gap:.25rem">Grade
            <select onchange="irlab.setExportFilter('grade',this.value)" style="padding:.35rem .4rem;border-radius:6px;border:1px solid var(--border);font-family:inherit">
              <option value="all" ${f.grade==='all'?'selected':''}>All Grades</option>
              ${opt.grades.map(gr=>`<option value="${esc(gr)}" ${f.grade===gr?'selected':''}>Grade ${esc(gr)}</option>`).join('')}
            </select>
          </label>
          <label style="display:flex;flex-direction:column;gap:.25rem">Scholar Type
            <select onchange="irlab.setExportFilter('scholarType',this.value)" style="padding:.35rem .4rem;border-radius:6px;border:1px solid var(--border);font-family:inherit">
              <option value="all" ${f.scholarType==='all'?'selected':''}>All Scholars</option>
              <option value="repeat" ${f.scholarType==='repeat'?'selected':''}>Repeat Only</option>
              <option value="nonrepeat" ${f.scholarType==='nonrepeat'?'selected':''}>Non-Repeat Only</option>
            </select>
          </label>
        </div>
        <div style="margin-top:.85rem;font-size:.78rem;font-weight:700;color:#0a2342;background:#f5f7fb;border-radius:8px;padding:.55rem .7rem">
          ${previewN.toLocaleString()} row${previewN===1?'':'s'} match these filters
        </div>
      `;
    }

    function confirmExport() {
      const f = _irlExportFilters || {};
      if (_irlExportKind === 'xlsx') downloadXLSX(f); else downloadCSV(f);
      closeExportModal();
    }

    function closeExportModal() {
      const m = document.getElementById('irlExportModal');
      if (m) m.remove();
      _irlExportFilters = null;
    }

    // ── Data export (Data dept only) ─────────────────────────────────────────
    function _irlBuildExportRows(opts) {
      const rows = getAllRows(opts || {});
      return rows.map(r => ({
        'Scholar Name':              r.scholarName  || '',
        'Scholar ID':                r.scholarId    || '',
        'Subject':                   r.subject      || '',
        'Year':                      r.year         || '',
        'District':                  r.district     || '',
        'School':                    r.school       || '',
        'Grade':                     r.grade        || '',
        'Sex':                       r.sex          || '',
        'Hispanic/Latino':           r.hispanic     || '',
        'Race':                      r.race         || '',
        'ELL':                       r.ell          || '',
        'Special Education':         r.sped         || '',
        'Econ. Disadvantaged':       r.ecodis       || '',
        'Instructor (Pearl)':        r.instructor   || '',
        'Tutoring Hours (Pearl)':    r._tutorHours  != null ? r._tutorHours.toFixed(2)          : '',
        'Base Scale Score':          r.baseScore    != null ? r.baseScore                        : '',
        'Base Relative Placement':   r.baseRelPlacement    || '',
        'Base Placement':            r.basePlacement       || '',
        'Spring Scale Score':        r.springScore  != null ? r.springScore                      : '',
        'Spring Relative Placement': r.springRelPlacement  || '',
        'Spring Placement':          r.springPlacement     || '',
        'Scale Score Gain':          r.springGain   != null ? r.springGain                       : '',
        // Scale Score Progression (NJTC/Mysti methodology) — added to the right of
        // Scale Score Gain per the "Scale Score Progression" breakdown.
        'Expected Growth per Week':  r.expectedGrowthPerWeek != null ? r.expectedGrowthPerWeek.toFixed(2) : '',
        'Weeks of Growth':           r.weeksOfGrowth != null ? r.weeksOfGrowth.toFixed(2)        : '',
        'Diagnostic Weeks (BOY→EOY)':r.springWeeks  != null ? r.springWeeks                      : '',
        'Pct of Typical Growth':     r.pctTypical   != null ? (r.pctTypical * 100).toFixed(1)+'%': '',
        'Window-Adj. Growth %':      (r.pctTypical != null && r.springWeeks > 0)
                                       ? ((r.pctTypical / (r.springWeeks / 30)) * 100).toFixed(1)+'%'
                                       : '',
        'Annual Typical Growth':     r.annualTypical!= null ? r.annualTypical                    : '',
        'Annual Stretch Growth':     r.annualStretch!= null ? r.annualStretch                    : '',
        'Repeat Scholar':            r.isRepeat ? 'Yes' : 'No',
        'Pilot Program':             r.isPilot === true ? 'Yes' : r.isPilot === false ? 'No' : '',
      }));
    }

    function downloadCSV(opts) {
      const rows = _irlBuildExportRows(opts);
      if (!rows.length) { alert('No data to export with current filters.'); return; }
      const headers = Object.keys(rows[0]);
      const _esc = v => { const s = String(v == null ? '' : v); return (s.includes(',') || s.includes('"') || s.includes('\n')) ? '"' + s.replace(/"/g,'""') + '"' : s; };
      const csv = [headers.map(_esc).join(','), ...rows.map(r => headers.map(h => _esc(r[h])).join(','))].join('\r\n');
      const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href = url; a.download = 'njtc-iready-' + new Date().toISOString().slice(0,10) + '.csv';
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }

    function downloadXLSX(opts) {
      if (typeof XLSX === 'undefined') { downloadCSV(opts); return; }
      const exportRows = _irlBuildExportRows(opts);
      if (!exportRows.length) { alert('No data to export with current filters.'); return; }

      const validRows = getRows(opts || {});
      const allRows   = getAllRows(opts || {});
      const m         = validRows.length ? computeMetrics(validRows) : null;
      const dated     = new Date().toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' });

      const _aw = ws => {
        const ref = ws['!ref']; if (!ref) return;
        const range = XLSX.utils.decode_range(ref);
        const widths = [];
        for (let C = range.s.c; C <= range.e.c; C++) {
          let max = 8;
          for (let R = range.s.r; R <= range.e.r; R++) {
            const cell = ws[XLSX.utils.encode_cell({r:R,c:C})];
            if (cell && cell.v != null) max = Math.min(Math.max(max, String(cell.v).length + 2), 52);
          }
          widths.push({ wch: max });
        }
        ws['!cols'] = widths;
      };

      // ── Sheet 1: iReady Data (raw export) ───────────────────────────────────
      const ws1 = XLSX.utils.json_to_sheet(exportRows);
      _aw(ws1);

      // ── SYA fallback for XLSX: program-calendar weeks when springWeeks missing ─
      // Priority: window.sya.getSites() (live) → localStorage cache
      const _xNorm   = s => String(s || '').toLowerCase().replace(/\s+/g, ' ').trim();
      const _xFlexDt = s => {
        if (!s) return null;
        let d = new Date(s); if (!isNaN(d) && d.getFullYear() > 2000) return d;
        const hit = s.match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
        if (hit) { let yr = parseInt(hit[3]); if (yr < 100) yr += (yr < 50 ? 2000 : 1900); const c = new Date(yr, parseInt(hit[1])-1, parseInt(hit[2])); if (!isNaN(c)) return c; }
        return null;
      };
      const _xSyaSites = (() => {
        try { if (typeof window !== 'undefined' && window.sya && typeof window.sya.getSites === 'function') { const live = window.sya.getSites(); if (live && live.length) return live; } } catch(_e) {}
        try { const raw = typeof localStorage !== 'undefined' ? localStorage.getItem('njtc_sya_v1') : null; if (raw) { const p = JSON.parse(raw); return Array.isArray(p.d) ? p.d : null; } } catch(_e) {}
        return null;
      })();
      const _xSyaEntries = {};
      (_xSyaSites || []).forEach(site => {
        if (!site.school) return;
        let wks = (site.progWeeks > 0) ? site.progWeeks : 0;
        if (!wks) {
          const sd = _xFlexDt(site.startDate), ed = _xFlexDt(site.endpoint);
          if (sd && ed && !isNaN(sd) && !isNaN(ed))
            wks = Math.round((ed - sd) / (1000*60*60*24*7));
        }
        if (wks <= 0 || wks > 60) return;
        const blk = (site.block || '').toLowerCase();
        const isSpring = blk.includes('spring') && !blk.includes('fall');
        const key = _xNorm(site.school);
        if (!_xSyaEntries[key]) _xSyaEntries[key] = [];
        _xSyaEntries[key].push({ wks, isSpring, district: site.district || '' });
      });
      const _xSyaMap = {};
      Object.entries(_xSyaEntries).forEach(([key, arr]) => {
        const preferred = arr.filter(e => e.isSpring);
        const pool = preferred.length ? preferred : arr;
        _xSyaMap[key] = Math.min(...pool.map(e => e.wks));
      });
      // District+school combo keys for fuzzy fallback
      const _xSyaComboMap = {};
      (_xSyaSites || []).forEach(site => {
        if (!site.school) return;
        const sk = _xNorm(site.school);
        if (!(_xSyaMap[sk] > 0)) return;
        const ck = _xNorm((site.district || '') + ' ' + site.school);
        if (ck !== sk) _xSyaComboMap[ck] = _xSyaMap[sk];
      });
      const _xStopTok = new Set(['school','elementary','middle','high','charter','the','of','at','a','and','twp','township','district','ms','es','hs','preparatory','prep','sciences','arts','science','technology','tech','for','its','an','or','k','grade','grades','campus','center']);
      const _xTok = s => _xNorm(s).split(/\s+/).filter(t => t.length > 1 && !_xStopTok.has(t));
      const _xAllEntries = [...Object.entries(_xSyaMap), ...Object.entries(_xSyaComboMap)];
      const _xFuzzyLookup = schoolName => {
        const nk = _xNorm(schoolName);
        if (_xSyaMap[nk] > 0) return _xSyaMap[nk];
        if (_xSyaComboMap[nk] > 0) return _xSyaComboMap[nk];
        const toks = _xTok(schoolName);
        if (!toks.length) return 0;
        let bestScore = 0, bestWks = 0;
        for (const [k, wks] of _xAllEntries) {
          const kToks = _xTok(k);
          if (!kToks.length) continue;
          const overlap = toks.filter(t => kToks.includes(t)).length;
          const score = overlap / Math.min(toks.length, kToks.length);
          if ((overlap >= 2 || score >= 0.5) && overlap > bestScore) { bestScore = overlap; bestWks = wks; }
        }
        return bestWks;
      };
      const _xEffWks = r => r.springWeeks > 0 ? r.springWeeks : (_xFuzzyLookup(r.school || '') || 0);

      // ── Sheet 2: Network Summary ─────────────────────────────────────────────
      const elaTyp   = allRows.filter(r => r.subject==='ELA'  && r.pctTypical!==null && !isNaN(r.pctTypical)).map(r => r.pctTypical);
      const mathTyp  = allRows.filter(r => r.subject==='Math' && r.pctTypical!==null && !isNaN(r.pctTypical)).map(r => r.pctTypical);
      const elaMedT  = medianArr(elaTyp);
      const mathMedT = medianArr(mathTyp);
      const elaMedMo = medianArr(allRows.filter(r => r.subject==='ELA'  && r.pctTypical!==null && !isNaN(r.pctTypical)).map(r => r.pctTypical * 10));
      const mathMedMo= medianArr(allRows.filter(r => r.subject==='Math' && r.pctTypical!==null && !isNaN(r.pctTypical)).map(r => r.pctTypical * 10));
      // Window-adjusted growth — uses _xEffWks() so SYA calendar weeks fill in
      // when iReady's springWeeks is unavailable, maximising scholar coverage
      const _elaWkR  = allRows.filter(r => r.subject==='ELA'  && r.pctTypical!==null && !isNaN(r.pctTypical) && _xEffWks(r) > 0);
      const _mathWkR = allRows.filter(r => r.subject==='Math' && r.pctTypical!==null && !isNaN(r.pctTypical) && _xEffWks(r) > 0);
      const _allWkR  = allRows.filter(r => r.pctTypical!==null && !isNaN(r.pctTypical) && _xEffWks(r) > 0);
      const elaWkAdj    = medianArr(_elaWkR.map(r  => r.pctTypical / (_xEffWks(r) / 30)));
      const mathWkAdj   = medianArr(_mathWkR.map(r => r.pctTypical / (_xEffWks(r) / 30)));
      const allWkAdj    = medianArr(_allWkR.map(r  => r.pctTypical / (_xEffWks(r) / 30)));
      const medWeeksELA  = medianArr(_elaWkR.map(r  => _xEffWks(r)));
      const medWeeksMath = medianArr(_mathWkR.map(r => _xEffWks(r)));
      const medWeeksAll  = medianArr(_allWkR.map(r  => _xEffWks(r)));
      const ws2 = XLSX.utils.json_to_sheet([
        { 'Metric': 'Report Date',                       'Value': dated },
        { 'Metric': '── SCHOLARS ───────────────────',  'Value': '' },
        { 'Metric': 'Total Scholars (valid pairs)',      'Value': m ? m.n : 0 },
        { 'Metric': 'ELA Scholars (with growth data)',   'Value': elaTyp.length },
        { 'Metric': 'Math Scholars (with growth data)',  'Value': mathTyp.length },
        { 'Metric': '── GROWTH ──────────────────────', 'Value': '' },
        { 'Metric': 'ELA Median % Typical Growth',       'Value': elaMedT  !== null ? (elaMedT*100).toFixed(1)+'%'  : '—' },
        { 'Metric': 'Math Median % Typical Growth',      'Value': mathMedT !== null ? (mathMedT*100).toFixed(1)+'%' : '—' },
        { 'Metric': 'ELA Median Months of Growth',       'Value': elaMedMo  !== null ? elaMedMo.toFixed(1)+' mo'   : '—' },
        { 'Metric': 'Math Median Months of Growth',      'Value': mathMedMo !== null ? mathMedMo.toFixed(1)+' mo'  : '—' },
        { 'Metric': '% Meeting Typical Growth (≥100%)',  'Value': m && m.metTypPct !== null ? m.metTypPct+'%' : '—' },
        { 'Metric': '── PLACEMENT MOVEMENT ───────────', 'Value': '' },
        { 'Metric': 'Scholars Advanced 1+ Level',        'Value': m ? m.moved.length : 0 },
        { 'Metric': '% Advanced 1+ Level',               'Value': m ? m.pctMoved+'%' : '—' },
        { 'Metric': 'Scholars Held Placement',           'Value': m ? m.held.length : 0 },
        { 'Metric': '% Held Placement',                  'Value': m ? m.pctHeld+'%' : '—' },
        { 'Metric': 'Scholars Regressed',                'Value': m ? m.regress.length : 0 },
        { 'Metric': '% Regressed',                       'Value': m ? m.pctRegress+'%' : '—' },
        { 'Metric': '── GRADE LEVEL ─────────────────',  'Value': '' },
        { 'Metric': '% On/Above Grade Level — Spring',   'Value': m ? m.pctOnGL+'%' : '—' },
        { 'Metric': '% On/Above Grade Level — BOY',      'Value': m && m.n>0 ? Math.round(m.baseOnGL.length/m.n*100)+'%' : '—' },
        { 'Metric': '% 2+ Grade Levels Below — Spring',  'Value': m ? m.pct2Below+'%' : '—' },
        { 'Metric': '% 2+ Grade Levels Below — BOY',     'Value': m && m.n>0 ? Math.round(m.base2Below.length/m.n*100)+'%' : '—' },
        { 'Metric': '── DIAGNOSTIC WINDOW ───────────────────', 'Value': '' },
        { 'Metric': 'iReady Norm Assumes (weeks)',             'Value': '30 wks' },
        { 'Metric': 'Median Avail. Weeks — ELA',              'Value': medWeeksELA  !== null ? Math.round(medWeeksELA)+' wks (iReady or SYA)' : '—' },
        { 'Metric': 'Median Avail. Weeks — Math',             'Value': medWeeksMath !== null ? Math.round(medWeeksMath)+' wks (iReady or SYA)' : '—' },
        { 'Metric': 'Median Avail. Weeks — Network',          'Value': medWeeksAll  !== null ? Math.round(medWeeksAll)+' wks (iReady or SYA)'  : '—' },
        { 'Metric': 'ELA Window-Adj. Median Growth',          'Value': elaWkAdj  !== null ? (elaWkAdj*100).toFixed(1)+'%'  : '—' },
        { 'Metric': 'Math Window-Adj. Median Growth',         'Value': mathWkAdj !== null ? (mathWkAdj*100).toFixed(1)+'%' : '—' },
        { 'Metric': 'Network Window-Adj. Median Growth',      'Value': allWkAdj  !== null ? (allWkAdj*100).toFixed(1)+'%'  : '—' },
      ]);
      _aw(ws2);

      // ── Sheet 3: Placement Shifts by School (BOY vs EOY counts + %) ──────────
      const _schoolPairs = {};
      validRows.forEach(r => {
        const k = r.school || 'Unknown';
        if (!_schoolPairs[k]) _schoolPairs[k] = { school:k, district:r.district||'', rows:[] };
        _schoolPairs[k].rows.push(r);
      });
      const placementShiftRows = [];
      Object.values(_schoolPairs).filter(s => s.rows.length >= 2).forEach(s => {
        const sm = computeMetrics(s.rows);
        if (!sm) return;
        ['BOY (Baseline)','EOY (Spring)'].forEach((period, pi) => {
          const dist = pi===0 ? sm.baseDist : sm.springDist;
          const row  = { 'School': s.school, 'District': s.district, 'Period': period, 'N': sm.n };
          PLACEMENT_ORDER.forEach(p => { row[PLC_SHORT[p]+' Count'] = dist[p]||0; });
          PLACEMENT_ORDER.forEach(p => { row[PLC_SHORT[p]+' %']     = sm.n>0 ? ((( dist[p]||0)/sm.n)*100).toFixed(1)+'%' : '0%'; });
          placementShiftRows.push(row);
        });
      });
      const ws3 = XLSX.utils.json_to_sheet(placementShiftRows);
      _aw(ws3);

      // ── Sheet 4: Growth Summary by School ────────────────────────────────────
      const schoolGrowthRows = Object.values(_schoolPairs).filter(s => s.rows.length >= 2).map(s => {
        const sm      = computeMetrics(s.rows);
        const typNums = allRows.filter(r => (r.school||'Unknown')===s.school && r.pctTypical!==null && !isNaN(r.pctTypical)).map(r => r.pctTypical);
        const moNums  = allRows.filter(r => (r.school||'Unknown')===s.school && r.pctTypical!==null && !isNaN(r.pctTypical)).map(r => r.pctTypical * 10);
        const wkRows  = allRows.filter(r => (r.school||'Unknown')===s.school && r.pctTypical!==null && !isNaN(r.pctTypical) && _xEffWks(r) > 0);
        const medTyp  = medianArr(typNums);
        const medMo   = medianArr(moNums);
        const sWkAdj  = medianArr(wkRows.map(r => r.pctTypical / (_xEffWks(r) / 30)));
        const sWks    = medianArr(wkRows.map(r => _xEffWks(r)));
        return {
          'School':                    s.school,
          'District':                  s.district,
          'N (valid pairs)':           sm ? sm.n : 0,
          'Median Avail. Weeks':        sWks   !== null ? Math.round(sWks)+' wks'       : '—',
          'Median % Typical Growth':   medTyp !== null ? (medTyp*100).toFixed(1)+'%'   : '—',
          'Window-Adj. Growth %':      sWkAdj !== null ? (sWkAdj*100).toFixed(1)+'%'  : '—',
          'Median Months of Growth':   medMo  !== null ? medMo.toFixed(1)+' mo'        : '—',
          '% Advanced 1+ Level':       sm ? sm.pctMoved+'%'   : '—',
          '# Advanced':                sm ? sm.moved.length   : 0,
          '% Held Placement':          sm ? sm.pctHeld+'%'    : '—',
          '% Regressed':               sm ? sm.pctRegress+'%' : '—',
          '% On/Above GL (Spring)':    sm ? sm.pctOnGL+'%'    : '—',
          '% On/Above GL (BOY)':       sm && sm.n>0 ? Math.round(sm.baseOnGL.length/sm.n*100)+'%' : '—',
        };
      }).sort((a,b) => parseFloat(b['% Advanced 1+ Level'])-parseFloat(a['% Advanced 1+ Level']));
      const ws4 = XLSX.utils.json_to_sheet(schoolGrowthRows);
      _aw(ws4);

      // ── Sheet 5: Growth by Grade ─────────────────────────────────────────────
      const _gradePairs = {};
      validRows.forEach(r => {
        const k = r.grade || 'Unknown';
        if (!_gradePairs[k]) _gradePairs[k] = { grade:k, rows:[] };
        _gradePairs[k].rows.push(r);
      });
      const gradeRows = Object.values(_gradePairs).map(g => {
        const sm      = computeMetrics(g.rows);
        const typNums = allRows.filter(r => (r.grade||'Unknown')===g.grade && r.pctTypical!==null && !isNaN(r.pctTypical)).map(r => r.pctTypical);
        const moNums  = allRows.filter(r => (r.grade||'Unknown')===g.grade && r.pctTypical!==null && !isNaN(r.pctTypical)).map(r => r.pctTypical * 10);
        const medTyp  = medianArr(typNums);
        const medMo   = medianArr(moNums);
        return {
          'Grade':                     g.grade,
          'N':                         sm ? sm.n : 0,
          'Median % Typical Growth':   medTyp !== null ? (medTyp*100).toFixed(1)+'%' : '—',
          'Median Months of Growth':   medMo  !== null ? medMo.toFixed(1)+' mo'      : '—',
          '% Advanced 1+ Level':       sm ? sm.pctMoved+'%'   : '—',
          '# Advanced':                sm ? sm.moved.length   : 0,
          '% On/Above GL (Spring)':    sm ? sm.pctOnGL+'%'    : '—',
        };
      }).sort((a,b) => { const na=parseInt(a['Grade'])||999, nb=parseInt(b['Grade'])||999; return na-nb; });
      const ws5 = XLSX.utils.json_to_sheet(gradeRows);
      _aw(ws5);

      // ── Sheet 6: Growth by District ──────────────────────────────────────────
      const _distPairs = {};
      validRows.forEach(r => {
        const k = r.district || 'Unknown';
        if (!_distPairs[k]) _distPairs[k] = { district:k, rows:[] };
        _distPairs[k].rows.push(r);
      });
      const distRows = Object.values(_distPairs).map(d => {
        const sm      = computeMetrics(d.rows);
        const typNums = allRows.filter(r => (r.district||'Unknown')===d.district && r.pctTypical!==null && !isNaN(r.pctTypical)).map(r => r.pctTypical);
        const moNums  = allRows.filter(r => (r.district||'Unknown')===d.district && r.pctTypical!==null && !isNaN(r.pctTypical)).map(r => r.pctTypical * 10);
        const medTyp  = medianArr(typNums);
        const medMo   = medianArr(moNums);
        return {
          'District':                  d.district,
          'N':                         sm ? sm.n : 0,
          'Median % Typical Growth':   medTyp !== null ? (medTyp*100).toFixed(1)+'%' : '—',
          'Median Months of Growth':   medMo  !== null ? medMo.toFixed(1)+' mo'      : '—',
          '% Advanced 1+ Level':       sm ? sm.pctMoved+'%'   : '—',
          '# Advanced':                sm ? sm.moved.length   : 0,
          '% On/Above GL (Spring)':    sm ? sm.pctOnGL+'%'    : '—',
        };
      }).sort((a,b) => parseFloat(b['% Advanced 1+ Level'])-parseFloat(a['% Advanced 1+ Level']));
      const ws6 = XLSX.utils.json_to_sheet(distRows);
      _aw(ws6);

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws1, 'iReady Data');
      XLSX.utils.book_append_sheet(wb, ws2, 'Network Summary');
      XLSX.utils.book_append_sheet(wb, ws3, 'Placement Shifts');
      XLSX.utils.book_append_sheet(wb, ws4, 'Growth by School');
      XLSX.utils.book_append_sheet(wb, ws5, 'Growth by Grade');
      XLSX.utils.book_append_sheet(wb, ws6, 'Growth by District');
      XLSX.writeFile(wb, 'njtc-iready-' + new Date().toISOString().slice(0,10) + '.xlsx');
    }

    // ── HTML Impact Report (Option B) ──────────────────────────────────────────
    function downloadHTMLReport() {
      const validRows = getRows({});
      const allRows   = getAllRows({});
      if (!validRows.length) { alert('No data to generate a report with current filters.'); return; }
      const m = computeMetrics(validRows);
      if (!m) return;

      // ── SYA program-calendar lookup ─────────────────────────────────────────
      // Priority: window.sya.getSites() (live, always current, has new fields)
      //        → localStorage njtc_sya_v1 (cached, may be older)
      // Week source per site: col V progWeeks (authoritative) → date calculation
      // Multi-row per school: prefer Spring-only block; among ties take minimum
      const _norm   = s => String(s || '').toLowerCase().replace(/\s+/g, ' ').trim();
      const _flexDt = s => {
        if (!s) return null;
        let d = new Date(s); if (!isNaN(d) && d.getFullYear() > 2000) return d;
        const hit = s.match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
        if (hit) { let yr = parseInt(hit[3]); if (yr < 100) yr += (yr < 50 ? 2000 : 1900); const c = new Date(yr, parseInt(hit[1])-1, parseInt(hit[2])); if (!isNaN(c)) return c; }
        return null;
      };
      const _syaSites = (() => {
        try { if (typeof window !== 'undefined' && window.sya && typeof window.sya.getSites === 'function') { const live = window.sya.getSites(); if (live && live.length) return live; } } catch(_e) {}
        try { const raw = typeof localStorage !== 'undefined' ? localStorage.getItem('njtc_sya_v1') : null; if (raw) { const p = JSON.parse(raw); return Array.isArray(p.d) ? p.d : null; } } catch(_e) {}
        return null;
      })();
      const _syaEntries = {};
      (_syaSites || []).forEach(site => {
        if (!site.school) return;
        let wks = (site.progWeeks > 0) ? site.progWeeks : 0;
        if (!wks) { const sd = _flexDt(site.startDate), ed = _flexDt(site.endpoint); if (sd && ed && !isNaN(sd) && !isNaN(ed)) wks = Math.round((ed - sd) / (1000*60*60*24*7)); }
        if (wks <= 0 || wks > 60) return;
        const blk = (site.block || '').toLowerCase();
        const isSpring = blk.includes('spring') && !blk.includes('fall');
        const key = _norm(site.school);
        if (!_syaEntries[key]) _syaEntries[key] = [];
        _syaEntries[key].push({ wks, isSpring });
      });
      const _syaWkMap = {};
      Object.entries(_syaEntries).forEach(([key, arr]) => {
        const preferred = arr.filter(e => e.isSpring);
        const pool = preferred.length ? preferred : arr;
        _syaWkMap[key] = Math.min(...pool.map(e => e.wks));
      });
      // Build district+school combo keys for fuzzy fallback
      // (SYA col F = district e.g. "Penns Grove", col G = school e.g. "Field Street Elementary"
      //  iReady school name may include both: "Penns Grove Field Street Elementary School")
      const _syaComboMap = {};
      (_syaSites || []).forEach(site => {
        if (!site.school) return;
        const sk = _norm(site.school);
        if (!(_syaWkMap[sk] > 0)) return;
        const ck = _norm((site.district || '') + ' ' + site.school);
        if (ck !== sk) _syaComboMap[ck] = _syaWkMap[sk];
      });
      // Token-based fuzzy lookup: strips common education stopwords, matches on ≥2 shared tokens
      const _stopTok = new Set(['school','elementary','middle','high','charter','the','of','at','a','and','twp','township','district','ms','es','hs','preparatory','prep','sciences','arts','science','technology','tech','for','its','an','or','k','grade','grades','campus','center']);
      const _tok = s => _norm(s).split(/\s+/).filter(t => t.length > 1 && !_stopTok.has(t));
      const _syaAllEntries = [...Object.entries(_syaWkMap), ...Object.entries(_syaComboMap)];
      const _fuzzyLookup = schoolName => {
        const nk = _norm(schoolName);
        if (_syaWkMap[nk] > 0) return _syaWkMap[nk];      // exact school name
        if (_syaComboMap[nk] > 0) return _syaComboMap[nk]; // exact district+school
        const toks = _tok(schoolName);
        if (!toks.length) return 0;
        let bestScore = 0, bestWks = 0;
        for (const [k, wks] of _syaAllEntries) {
          const kToks = _tok(k);
          if (!kToks.length) continue;
          const overlap = toks.filter(t => kToks.includes(t)).length;
          const score = overlap / Math.min(toks.length, kToks.length);
          if ((overlap >= 2 || score >= 0.5) && overlap > bestScore) { bestScore = overlap; bestWks = wks; }
        }
        return bestWks;
      };
      // View-specific: only schools that actually appear in this filtered report
      const _viewSchoolKeys = [...new Set(validRows.map(r => r.school || ''))].filter(Boolean);
      const _viewWkArr      = _viewSchoolKeys.map(s => _fuzzyLookup(s)).filter(w => w > 0);
      const _viewMedWks     = _viewWkArr.length ? medianArr(_viewWkArr) : null;
      // Prefer iReady's own diagnostic weeks; fall back to fuzzy SYA calendar weeks
      const _effWks = r => r.springWeeks > 0 ? r.springWeeks : (_fuzzyLookup(r.school || '') || 0);
      const _smap = {};
      validRows.forEach(r => {
        const k = r.school || 'Unknown';
        if (!_smap[k]) _smap[k] = { school:k, district:r.district||'', rows:[], typR:[], moR:[], wkR:[] };
        _smap[k].rows.push(r);
      });
      allRows.forEach(r => {
        const k = r.school || 'Unknown';
        if (_smap[k] && r.pctTypical!==null && !isNaN(r.pctTypical)) {
          _smap[k].typR.push(r.pctTypical);
          _smap[k].moR.push(r.pctTypical * 10);
          const ew = _effWks(r);
          if (ew > 0) _smap[k].wkR.push({ pct: r.pctTypical, weeks: ew });
        }
      });
      const schools = Object.values(_smap).filter(s => s.rows.length >= 2).map(s => {
        const sm     = computeMetrics(s.rows);
        const medT   = medianArr(s.typR);
        const medMo  = medianArr(s.moR);
        const wkAdj  = medianArr(s.wkR.map(r => r.pct / (r.weeks / 30)));
        const medWks = medianArr(s.wkR.map(r => r.weeks));
        return {
          school:    s.school,
          district:  s.district,
          n:         s.rows.length,
          pctMoved:  sm ? sm.pctMoved  : 0,
          pctHeld:   sm ? sm.pctHeld   : 0,
          pctReg:    sm ? sm.pctRegress: 0,
          moved:     sm ? sm.moved.length : 0,
          medTyp:    medT,
          medMo:     medMo,
          wkAdj:     wkAdj,
          medWks:    medWks,
          baseDist:  sm ? sm.baseDist   : {},
          springDist:sm ? sm.springDist : {},
          pctOnGL:   sm ? sm.pctOnGL    : 0,
        };
      });

      // ── Network-level growth numbers ────────────────────────────────────────
      const elaR    = allRows.filter(r => r.subject==='ELA'  && r.pctTypical!==null && !isNaN(r.pctTypical));
      const mathR   = allRows.filter(r => r.subject==='Math' && r.pctTypical!==null && !isNaN(r.pctTypical));
      const elaMedian  = medianArr(elaR.map(r => r.pctTypical));
      const mathMedian = medianArr(mathR.map(r => r.pctTypical));
      const elaMonths  = medianArr(elaR.map(r => r.pctTypical * 10));
      const mathMonths = medianArr(mathR.map(r => r.pctTypical * 10));
      const allMonths  = medianArr(allRows.filter(r => r.pctTypical!==null && !isNaN(r.pctTypical)).map(r => r.pctTypical * 10));
      // Window-adjusted network growth — _effWks() fills in SYA calendar weeks
      // when iReady's own springWeeks is absent, maximising scholar coverage
      const _hElaWk  = elaR.filter(r => _effWks(r) > 0);
      const _hMathWk = mathR.filter(r => _effWks(r) > 0);
      const _hAllWk  = allRows.filter(r => r.pctTypical!==null && !isNaN(r.pctTypical) && _effWks(r) > 0);
      const netWkAdjELA  = medianArr(_hElaWk.map(r  => r.pctTypical / (_effWks(r) / 30)));
      const netWkAdjMath = medianArr(_hMathWk.map(r => r.pctTypical / (_effWks(r) / 30)));
      const netWkAdjAll  = medianArr(_hAllWk.map(r  => r.pctTypical / (_effWks(r) / 30)));
      const netMedWks    = medianArr(_hAllWk.map(r  => _effWks(r)));
      // Best available diagnostic window: iReady-derived first, then SYA view-specific median
      const _dispWks = netMedWks !== null ? netMedWks : _viewMedWks;

      // ── Strategic / partner-facing metrics ──────────────────────────────────
      // Lead with whichever subject shows stronger window-adjusted growth; fall back to raw if unavailable
      const _elaComp  = netWkAdjELA  !== null ? netWkAdjELA  : elaMedian;
      const _mathComp = netWkAdjMath !== null ? netWkAdjMath : mathMedian;
      const bestSubjMedian = (elaMedian !== null && mathMedian !== null) ? Math.max(elaMedian, mathMedian) : (elaMedian !== null ? elaMedian : mathMedian);
      const bestSubjLabel  = (_elaComp !== null && _mathComp !== null && _elaComp >= _mathComp) ? 'ELA' : 'Math';
      // Featured window-adjusted metric: pick the stronger subject's adjusted growth
      const featWkAdj = bestSubjLabel === 'ELA' ? netWkAdjELA : netWkAdjMath;
      const glGain = m.sprOnGL.length - m.baseOnGL.length;
      const uniqueSchoolCount = schools.length;
      const uniqueDistrictSet = new Set(validRows.map(r => r.district).filter(Boolean));
      const districtCount = uniqueDistrictSet.size;

      // ── BOY vs EOY network placement distribution ───────────────────────────
      const boyDist = {}; const eoyDist = {};
      PLACEMENT_ORDER.forEach(p => { boyDist[p]=0; eoyDist[p]=0; });
      validRows.forEach(r => {
        if (boyDist[r.baseRelPlacement]   !== undefined) boyDist[r.baseRelPlacement]++;
        if (eoyDist[r.springRelPlacement] !== undefined) eoyDist[r.springRelPlacement]++;
      });
      const nV = validRows.length;
      const c2Datasets = PLACEMENT_ORDER.map((p,i) => ({
        label: p,
        data: [
          nV > 0 ? parseFloat(((boyDist[p]/nV)*100).toFixed(1)) : 0,
          nV > 0 ? parseFloat(((eoyDist[p]/nV)*100).toFixed(1)) : 0,
        ],
        backgroundColor: [
          'rgba(220,38,38,0.88)',
          'rgba(249,115,22,0.88)',
          'rgba(234,179,8,0.88)',
          'rgba(13,148,136,0.88)',
          'rgba(13,110,58,0.88)',
        ][i],
        borderColor: '#fff',
        borderWidth: 2,
      }));

      // ── Chart dataset arrays ────────────────────────────────────────────────
      const byMove   = [...schools].sort((a,b) => b.pctMoved - a.pctMoved);
      const c1Labels = byMove.map(s => s.school);
      const c1Data   = byMove.map(s => s.pctMoved);
      const c1N      = byMove.map(s => s.n);
      const c1Colors = byMove.map(s => s.pctMoved >= 50 ? '#00695c' : s.pctMoved >= 25 ? '#1565c0' : '#64748b');

      // Chart 3 uses window-adjusted growth; falls back to raw typical if no weeks data
      const byWkAdj  = [...schools].filter(s => s.wkAdj !== null || s.medTyp !== null)
                        .sort((a,b) => ((b.wkAdj !== null ? b.wkAdj : b.medTyp)||0) - ((a.wkAdj !== null ? a.wkAdj : a.medTyp)||0));
      const c3Labels = byWkAdj.map(s => s.school);
      const c3Data   = byWkAdj.map(s => parseFloat(((s.wkAdj !== null ? s.wkAdj : s.medTyp||0)*100).toFixed(1)));
      const c3Wks    = byWkAdj.map(s => s.medWks !== null ? Math.round(s.medWks) : null);
      const c3Colors = byWkAdj.map(s => { const v = s.wkAdj !== null ? s.wkAdj : s.medTyp||0; return v >= 1.0 ? '#00695c' : v >= 0.5 ? '#1565c0' : '#ea580c'; });

      const byMo     = [...schools].filter(s => s.medMo !== null).sort((a,b) => (b.medMo||0) - (a.medMo||0));
      const c4Labels = byMo.map(s => s.school);
      const c4Data   = byMo.map(s => parseFloat((s.medMo||0).toFixed(1)));
      const c4Colors = byMo.map(s => (s.medMo||0) >= 4.5 ? '#00695c' : (s.medMo||0) >= 3.0 ? '#f0b429' : '#ea580c');

      // ── Scholar Impact Profiles (Top 10) ───────────────────────────────────
      const H = s => String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
      const plcColor = p => p==='Mid or Above Grade Level'?'#0d6e3a':p==='Early On Grade Level'?'#0d9488':p==='1 Grade Level Below'?'#ca8a04':p==='2 Grade Levels Below'?'#ea580c':'#dc2626';
      const ELA_DOM = [
        ['elaPhonologicalScore','elaPhonologicalSpringScore','Phonological Awareness'],
        ['elaPhonicsScore','elaPhonicsSpringScore','Phonics'],
        ['elaHFWScore','elaHFWSpringScore','High Freq. Words'],
        ['elaVocabScore','elaVocabSpringScore','Vocabulary'],
        ['elaRCOverallScore','elaRCOverallSpringScore','Reading Comp.'],
      ];
      const MATH_DOM = [
        ['mathNumOpsScore','mathNumOpsSpringScore','Number & Operations'],
        ['mathAlgebraScore','mathAlgebraSpringScore','Algebra'],
        ['mathMeasDataScore','mathMeasDataSpringScore','Measurement & Data'],
        ['mathGeometryScore','mathGeometrySpringScore','Geometry'],
      ];

      const topScholars = validRows
        .filter(r => r.pctTypical!==null && !isNaN(r.pctTypical))
        .map(r => {
          const shift   = plIdx(r.springRelPlacement) - plIdx(r.baseRelPlacement);
          const domList = (r.subject === 'ELA' ? ELA_DOM : MATH_DOM)
            .map(([bk, sk, nm]) => ({ nm, base: r[bk], spring: r[sk] }))
            .filter(d => d.base !== null && d.base > 0 && d.spring !== null && d.spring > 0);
          const rawGain = r.springGain != null ? r.springGain
                        : (r.baseScore != null && r.springScore != null ? r.springScore - r.baseScore : null);
          return {
            name:     r.scholarName || 'Scholar',
            school:   r.school      || '—',
            grade:    r.grade       || '—',
            subj:     r.subject     || '—',
            baseP:    r.baseRelPlacement   || '—',
            sprP:     r.springRelPlacement || '—',
            shift,
            pct:      r.pctTypical,
            mo:       parseFloat((r.pctTypical * 10).toFixed(1)),
            baseScore:r.baseScore,
            sprScore: r.springScore,
            gain:     rawGain,
            tutors:   (r.tutors && r.tutors.length ? r.tutors : (r.instructor ? [r.instructor] : []))
                        .filter(t => t && t !== 'Unidentified'),
            tutorHrs: r._tutorHours != null ? r._tutorHours : null,
            domains:  domList,
          };
        })
        .filter(s => s.shift > 0 || s.pct >= 0.75)
        .sort((a,b) => b.shift !== a.shift ? b.shift - a.shift : b.pct - a.pct)
        .slice(0, 10);

      const scholarsHTML = topScholars.map(s => {
        const shiftTxt   = s.shift > 0 ? `+${s.shift} Level${s.shift>1?'s':''}` : 'Met Growth Target';
        const shiftColor = s.shift > 0 ? '#00695c' : '#1565c0';
        const shiftBg    = s.shift > 0 ? '#f0fdf4' : '#eff6ff';
        const shiftIcon  = s.shift > 0 ? '▲' : '✓';
        const pctNum     = (s.pct * 100).toFixed(0);
        const pctColor   = s.pct >= 1.0 ? '#00695c' : '#1565c0';
        const bc = plcColor(s.baseP), sc2 = plcColor(s.sprP);

        // Placement journey — 5 dots representing each band, highlighting the arc
        const fIdx = plIdx(s.baseP), tIdx = plIdx(s.sprP);
        const journeyDots = PLACEMENT_ORDER.map((p, i) => {
          const col = plcColor(p);
          if (i === tIdx) return `<span title="${p}" style="display:inline-block;width:17px;height:17px;border-radius:50%;background:${col};border:2px solid #fff;box-shadow:0 0 0 2px ${col};vertical-align:middle;margin:0 2px"></span>`;
          if (i === fIdx) return `<span title="${p}" style="display:inline-block;width:13px;height:13px;border-radius:50%;background:${col}30;border:2px solid ${col};vertical-align:middle;margin:0 2px"></span>`;
          const inArc = s.shift > 0 ? (i > fIdx && i < tIdx) : false;
          if (inArc)     return `<span style="display:inline-block;width:9px;height:9px;border-radius:50%;background:${col}50;border:1.5px solid ${col}80;vertical-align:middle;margin:0 2px"></span>`;
          return         `<span style="display:inline-block;width:9px;height:9px;border-radius:50%;background:${col}15;border:1.5px solid ${col}30;vertical-align:middle;margin:0 2px"></span>`;
        }).join('<span style="display:inline-block;width:14px;height:1.5px;background:#e2e8f0;vertical-align:middle"></span>');

        // Domain bars
        const domainHtml = s.domains.length ? `
<div class="sc-domains">
  <div class="sc-dl">Domain Growth &nbsp;(BOY → EOY scale scores)</div>
  ${s.domains.map(d => {
    const gain = Math.round(d.spring - d.base);
    const gainColor = gain > 0 ? '#0d6e3a' : gain < 0 ? '#dc2626' : '#64748b';
    const bW = Math.min(d.base / 800 * 100, 100).toFixed(1);
    const sW = Math.min(d.spring / 800 * 100, 100).toFixed(1);
    return `  <div class="sc-d-row">
    <div class="sc-d-name">${H(d.nm)}</div>
    <div class="sc-d-bar-wrap"><div class="sc-d-bar-base" style="width:${bW}%"></div><div class="sc-d-bar" style="width:${sW}%"></div></div>
    <div class="sc-d-vals" style="color:${gainColor}">${gain>0?'+':''}${gain}<span style="color:#94a3b8;font-weight:400"> (${Math.round(d.base)}→${Math.round(d.spring)})</span></div>
  </div>`;
  }).join('')}
</div>` : '';

        // Tutor & Pearl row
        const tutorHtml = s.tutors.length ? `
<div class="sc-tutor-row">
  <span style="font-size:.75rem">👤</span>
  <span>${s.tutors.map(H).join(', ')}</span>
  ${s.tutorHrs != null ? `<span class="sc-pearl-hrs">&#x23F1; ${Math.round(s.tutorHrs * 60)} inst. min &nbsp;(${s.tutorHrs.toFixed(1)} hrs)</span>` : ''}
</div>` : '';

        return `<div class="sc-card">
  <div class="sc-prof-top">
    <div class="sc-badge" style="background:${shiftBg};color:${shiftColor};border-color:${shiftColor}40">${shiftIcon} ${H(shiftTxt)}</div>
    <div style="display:flex;align-items:center;gap:.3rem">
      <span class="sc-subj-pill" style="background:${s.subj==='ELA'?'#eff6ff':'#f0fdf4'};color:${s.subj==='ELA'?'#1e40af':'#14532d'}">${H(s.subj)}</span>
      <span class="sc-grade-pill">Gr. ${H(s.grade)}</span>
    </div>
  </div>
  <div class="sc-name">${H(s.name)}</div>
  <div class="sc-meta">${H(s.school)}</div>
  <div class="sc-journey">
    <div class="sc-dl">Placement Journey</div>
    <div class="sc-journey-flow">
      <span class="sc-chip" style="color:${bc};background:${bc}14;border:1px solid ${bc}30">${H(s.baseP)}</span>
      <span style="color:${shiftColor};font-weight:900;font-size:.875rem">${shiftIcon}</span>
      <span class="sc-chip" style="color:${sc2};background:${sc2}14;border:1px solid ${sc2}30">${H(s.sprP)}</span>
    </div>
    <div style="margin-top:.4rem;line-height:1.2">${journeyDots}</div>
  </div>
  <div class="sc-kpi-row">
    <div class="sc-kpi-cell"><div class="sc-kpi-v" style="color:${pctColor}">${pctNum}%</div><div class="sc-kpi-l">Typical Growth</div></div>
    <div class="sc-kpi-cell"><div class="sc-kpi-v" style="color:#d97706">${s.mo}</div><div class="sc-kpi-l">Months Gained</div></div>
    ${s.gain !== null ? `<div class="sc-kpi-cell"><div class="sc-kpi-v" style="color:#0a2342">${s.gain > 0 ? '+' : ''}${s.gain}</div><div class="sc-kpi-l">Scale Score Gain</div></div>` : ''}
    ${s.baseScore !== null && s.sprScore !== null ? `<div class="sc-kpi-cell"><div class="sc-kpi-v" style="color:#475569;font-size:.8rem">${s.baseScore}→${s.sprScore}</div><div class="sc-kpi-l">Score</div></div>` : ''}
  </div>
  ${domainHtml}${tutorHtml}
</div>`;
      }).join('\n');

      // ── Filter label ────────────────────────────────────────────────────────
      const filterLabel = [
        _irlYear     !== 'all' ? _irlYear     : null,
        _irlSubject  !== 'all' ? _irlSubject  : null,
        _irlDistrict !== 'all' ? _irlDistrict : null,
        _irlSchool   !== 'all' ? _irlSchool   : null,
      ].filter(Boolean).join(' · ') || 'All Schools · All Years';

      // ── Dynamic chart heights ───────────────────────────────────────────────
      const ch1 = Math.max(300, byMove.length  * 34);
      const ch3 = Math.max(300, byWkAdj.length * 34);
      const ch4 = Math.max(300, byMo.length    * 34);
      const reportDate = new Date().toLocaleDateString('en-US', { month:'long', day:'numeric', year:'numeric' });

      // ── Full HTML ───────────────────────────────────────────────────────────
      const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>NJTC iReady Impact Report · ${H(filterLabel)}</title>
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.4/dist/chart.umd.min.js"><\/script>
<script src="https://cdn.jsdelivr.net/npm/chartjs-plugin-datalabels@2.2.0/dist/chartjs-plugin-datalabels.min.js"><\/script>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',sans-serif;background:#edf1f7;color:#1e293b;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.page{max-width:1120px;margin:0 auto;padding:1.75rem 1.5rem}
/* ── Header ── */
.rpt-header{background:linear-gradient(135deg,#071829 0%,#0a2342 45%,#0d3166 100%);border-radius:16px;padding:2.25rem 2.75rem;margin-bottom:.875rem;display:flex;align-items:center;justify-content:space-between;gap:1.5rem;position:relative;overflow:hidden;box-shadow:0 8px 32px rgba(10,35,66,.35)}
.rpt-header::before{content:'';position:absolute;right:-60px;top:-60px;width:320px;height:320px;border-radius:50%;background:radial-gradient(circle,rgba(240,180,41,.12) 0%,transparent 70%);pointer-events:none}
.rpt-header::after{content:'';position:absolute;left:-40px;bottom:-80px;width:260px;height:260px;border-radius:50%;background:radial-gradient(circle,rgba(0,105,92,.18) 0%,transparent 70%);pointer-events:none}
.rh-inner{position:relative;z-index:1}
.rh-badge{font-size:.625rem;font-weight:700;text-transform:uppercase;letter-spacing:.14em;color:rgba(255,255,255,.42);margin-bottom:.5rem}
.rh-title{font-size:2rem;font-weight:900;color:#fff;line-height:1.1;margin-bottom:.35rem;letter-spacing:-.02em}
.rh-sub{font-size:.9125rem;color:rgba(255,255,255,.58)}
.rh-right{position:relative;z-index:1;text-align:right;flex-shrink:0}
.rh-date{font-size:.8125rem;color:rgba(255,255,255,.45);margin-bottom:.2rem}
.rh-source{font-size:.7rem;color:rgba(255,255,255,.3)}
/* ── Accent ── */
.accent{height:5px;background:linear-gradient(90deg,#f0b429 0%,#00695c 40%,#1565c0 75%,#0a2342 100%);border-radius:99px;margin-bottom:1.375rem}
/* ── KPI strip ── */
.kpi-row{display:grid;grid-template-columns:repeat(6,1fr);gap:.75rem;margin-bottom:1.375rem}
.kpi{background:#fff;border-radius:13px;padding:1.1rem 1.25rem;border:1.5px solid #e2e8f0;box-shadow:0 1px 4px rgba(0,0,0,.06);position:relative;overflow:hidden}
.kpi::after{content:'';position:absolute;bottom:0;left:0;right:0;height:3px;border-radius:0 0 13px 13px}
.kpi.g::after{background:#00695c}.kpi.b::after{background:#1565c0}.kpi.go::after{background:#f0b429}.kpi.n::after{background:#0a2342}.kpi.r::after{background:#dc2626}.kpi.t::after{background:#0d9488}
.kpi-v{font-size:1.875rem;font-weight:900;line-height:1;margin-bottom:.22rem;letter-spacing:-.02em}
.kpi.g .kpi-v{color:#00695c}.kpi.b .kpi-v{color:#1565c0}.kpi.go .kpi-v{color:#d97706}.kpi.n .kpi-v{color:#0a2342}.kpi.r .kpi-v{color:#dc2626}.kpi.t .kpi-v{color:#0d9488}
.kpi-l{font-size:.65rem;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.07em;line-height:1.35}
.kpi-s{font-size:.6375rem;color:#94a3b8;margin-top:.12rem}
/* ── Section cards ── */
.sec{background:#fff;border-radius:14px;border:1.5px solid #e2e8f0;padding:1.625rem 1.75rem;margin-bottom:1.25rem;box-shadow:0 1px 5px rgba(0,0,0,.06)}
.sec-hd{display:flex;align-items:flex-start;gap:.75rem;margin-bottom:1.25rem;padding-bottom:.9rem;border-bottom:2px solid #f1f5f9}
.sec-dot{width:12px;height:12px;border-radius:3px;flex-shrink:0;margin-top:3px}
.sec-ttl{font-size:1.0625rem;font-weight:800;color:#0a2342;line-height:1.2}
.sec-sub{font-size:.775rem;color:#64748b;margin-top:.2rem}
/* ── Chart layout ── */
.c-layout{display:grid;grid-template-columns:1fr 210px;gap:1.25rem;align-items:start}
.c-layout.wide{grid-template-columns:1fr}
.c-wrap{position:relative}
.c-side{display:flex;flex-direction:column;gap:.6rem}
.ckpi{background:#f8fafc;border-radius:11px;padding:.85rem 1rem;border:1.5px solid #e8edf4}
.ck-v{font-size:1.4375rem;font-weight:800;line-height:1;margin-bottom:.18rem}
.ck-l{font-size:.65rem;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.06em}
/* ── Legend ── */
.legend{display:flex;flex-wrap:wrap;gap:.45rem .875rem;margin-top:.9rem}
.leg-item{display:flex;align-items:center;gap:.3rem;font-size:.7rem;color:#475569;font-weight:500}
.leg-dot{width:11px;height:11px;border-radius:3px;flex-shrink:0}
/* ── Scholar profiles ── */
.sc-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(340px,1fr));gap:1rem;margin-top:.5rem}
.sc-card{background:#fff;border-radius:14px;padding:1.25rem 1.375rem;border:1.5px solid #e2e8f0;box-shadow:0 2px 8px rgba(0,0,0,.07)}
.sc-prof-top{display:flex;align-items:center;justify-content:space-between;margin-bottom:.5rem}
.sc-badge{font-size:.7rem;font-weight:800;padding:.22rem .65rem;border-radius:99px;border:1.5px solid;white-space:nowrap}
.sc-subj-pill,.sc-grade-pill{font-size:.6rem;font-weight:800;padding:.18rem .52rem;border-radius:99px}
.sc-grade-pill{background:#f1f5f9;color:#475569}
.sc-name{font-size:1.0625rem;font-weight:900;color:#0a2342;margin-bottom:.1rem}
.sc-meta{font-size:.675rem;color:#64748b;margin-bottom:.7rem}
.sc-dl{font-size:.575rem;font-weight:700;text-transform:uppercase;letter-spacing:.09em;color:#94a3b8;margin-bottom:.28rem}
.sc-journey{margin-bottom:.75rem}
.sc-journey-flow{display:flex;align-items:center;gap:.3rem;flex-wrap:wrap;margin-bottom:.3rem}
.sc-chip{font-size:.6rem;font-weight:700;padding:.15rem .5rem;border-radius:99px;white-space:nowrap}
.sc-kpi-row{display:grid;grid-template-columns:repeat(auto-fill,minmax(68px,1fr));gap:.4rem .55rem;margin-bottom:.75rem;background:#f8fafc;border-radius:10px;padding:.6rem .75rem}
.sc-kpi-cell{text-align:center}
.sc-kpi-v{font-size:1.0625rem;font-weight:900;line-height:1;letter-spacing:-.02em;margin-bottom:.1rem}
.sc-kpi-l{font-size:.54rem;color:#94a3b8;font-weight:700;text-transform:uppercase;letter-spacing:.05em;line-height:1.25}
.sc-domains{margin-bottom:.65rem}
.sc-d-row{display:flex;align-items:center;gap:.4rem;margin-bottom:.2rem}
.sc-d-name{font-size:.6rem;color:#475569;font-weight:600;width:106px;flex-shrink:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.sc-d-bar-wrap{flex:1;height:6px;background:#f1f5f9;border-radius:3px;position:relative}
.sc-d-bar-base{position:absolute;top:0;left:0;height:100%;background:#cbd5e1;border-radius:3px}
.sc-d-bar{position:absolute;top:0;left:0;height:100%;background:#1565c0;border-radius:3px;opacity:.78}
.sc-d-vals{font-size:.6rem;font-weight:800;white-space:nowrap;width:90px;text-align:right;flex-shrink:0}
.sc-tutor-row{display:flex;align-items:center;gap:.4rem;font-size:.65rem;color:#64748b;padding-top:.5rem;border-top:1px solid #f1f5f9;flex-wrap:wrap}
.sc-pearl-hrs{margin-left:auto;font-size:.6rem;font-weight:700;color:#0a2342;background:#eff6ff;padding:.1rem .45rem;border-radius:99px;border:1px solid #bfdbfe}
/* ── Footer ── */
.rpt-footer{text-align:center;padding:1.5rem 0 .5rem;font-size:.7rem;color:#94a3b8}
/* ── Print / PDF ── */
@page{size:letter portrait;margin:.55in .5in .55in .5in}
@media print{
  body{background:#fff!important}
  .page{max-width:100%;padding:0}
  .no-print{display:none!important}
  .rpt-header{box-shadow:none;-webkit-print-color-adjust:exact;print-color-adjust:exact;border-radius:10px}
  .accent{margin-bottom:.875rem}
  .sec{box-shadow:none;border-color:#dde3ef;margin-bottom:.75rem;break-inside:auto;page-break-inside:auto}
  .sec-hd{break-after:avoid;page-break-after:avoid}
  .kpi-row{break-inside:avoid;page-break-inside:avoid;grid-template-columns:repeat(6,1fr);gap:.4rem;margin-bottom:.875rem}
  .kpi{padding:.65rem .875rem}
  .kpi-v{font-size:1.3rem}
  canvas{break-inside:avoid;page-break-inside:avoid}
  .c-layout{break-inside:avoid;page-break-inside:avoid;grid-template-columns:1fr 180px}
  .c-wrap{break-inside:avoid;page-break-inside:avoid}
  .c-side{break-inside:avoid;page-break-inside:avoid}
  .sc-card{break-inside:avoid;page-break-inside:avoid;box-shadow:none;border-color:#dde3ef}
  .sc-grid{grid-template-columns:repeat(2,1fr);gap:.7rem}
  .sc-d-bar-wrap,.sc-d-bar-base,.sc-d-bar{-webkit-print-color-adjust:exact;print-color-adjust:exact}
  .sec-after-pb{break-before:page;page-break-before:always}
  .legend{break-inside:avoid;page-break-inside:avoid}
}
@media(max-width:900px){.kpi-row{grid-template-columns:repeat(3,1fr)}.c-layout{grid-template-columns:1fr}}
@media(max-width:540px){.kpi-row{grid-template-columns:repeat(2,1fr)}}
/* ── Print button ── */
.print-btn{position:fixed;bottom:1.5rem;right:1.5rem;display:inline-flex;align-items:center;gap:.45rem;padding:.7rem 1.25rem;background:linear-gradient(135deg,#0a2342,#1565c0);color:#fff;font-size:.8125rem;font-weight:800;border:none;border-radius:99px;cursor:pointer;box-shadow:0 4px 16px rgba(10,35,66,.35);letter-spacing:.02em;z-index:999;font-family:inherit;transition:box-shadow .15s}
.print-btn:hover{box-shadow:0 6px 22px rgba(10,35,66,.45)}
</style>
</head>
<body>
<div class="page">

<!-- ── Header ─────────────────────────────────────── -->
<div class="rpt-header">
  <div class="rh-inner">
    <div class="rh-badge">New Jersey Tutoring Corps &nbsp;·&nbsp; Academic Intelligence Division</div>
    <div class="rh-title">iReady Impact Report</div>
    <div class="rh-sub">${H(filterLabel)}</div>
  </div>
  <div class="rh-right">
    <div class="rh-date">${H(reportDate)}</div>
    <div class="rh-source">*data source: Curriculum Associates</div>
  </div>
</div>
<div class="accent"></div>

<!-- ── Impact Banner ──────────────────────────────── -->
<div style="background:linear-gradient(90deg,#f0fdf4 0%,#eff6ff 100%);border:1.5px solid #bbf7d0;border-radius:12px;padding:.9rem 1.5rem;margin-bottom:1rem;display:flex;align-items:center;gap:.875rem" class="no-print-fade">
  <span style="font-size:1.25rem;flex-shrink:0">🎯</span>
  <div>
    <div style="font-size:.8375rem;font-weight:800;color:#0a2342;line-height:1.35">${m.moved.length.toLocaleString()} scholars made measurable academic progress this program year${_irlYear !== 'all' ? ' ('+_irlYear+')' : ''}.</div>
    <div style="font-size:.7rem;color:#475569;margin-top:.15rem">NJTC tutoring supported scholars across ${uniqueSchoolCount} school${uniqueSchoolCount!==1?'s':''} in ${districtCount} district${districtCount!==1?'s':''} — with a median of ${allMonths !== null ? allMonths.toFixed(1) : '—'} months of academic learning gained per scholar as measured by iReady diagnostics (Curriculum Associates).</div>
  </div>
</div>

<!-- ── KPI Strip ──────────────────────────────────── -->
<div class="kpi-row">
  <div class="kpi g">
    <div class="kpi-v">${m.moved.length.toLocaleString()}</div>
    <div class="kpi-l">Scholars Advanced</div>
    <div class="kpi-s">${m.pctMoved}% moved up 1+ placement level</div>
  </div>
  <div class="kpi go">
    <div class="kpi-v">${allMonths !== null ? allMonths.toFixed(1) : '—'}</div>
    <div class="kpi-l">Median Months Gained</div>
    <div class="kpi-s">Academic learning per scholar</div>
  </div>
  <div class="kpi b">
    <div class="kpi-v">${featWkAdj !== null ? (featWkAdj*100).toFixed(1)+'%' : (bestSubjMedian !== null ? (bestSubjMedian*100).toFixed(1)+'%' : '—')}</div>
    <div class="kpi-l">${bestSubjLabel} Median Typical Growth</div>
    <div class="kpi-s">Window-adjusted to ${_dispWks !== null ? Math.round(_dispWks) : '—'}-wk actual window (÷ ${_dispWks !== null ? (Math.round(_dispWks)/30).toFixed(2) : '—'})</div>
  </div>
  <div class="kpi n">
    <div class="kpi-v" style="font-size:clamp(.95rem,2.8vw,1.55rem);letter-spacing:-.01em">${elaMedian !== null ? (elaMedian*100).toFixed(1)+'%' : '—'}&thinsp;/&thinsp;${mathMedian !== null ? (mathMedian*100).toFixed(1)+'%' : '—'}</div>
    <div class="kpi-l">ELA / Math Median Typical Growth</div>
    <div class="kpi-s">iReady standard · 30-wk norm · unadjusted</div>
  </div>
  <div class="kpi t">
    <div class="kpi-v">${m.metTypPct !== null ? m.metTypPct+'%' : '—'}</div>
    <div class="kpi-l">Met Growth Target</div>
    <div class="kpi-s">Scholars at/above typical growth</div>
  </div>
  <div class="kpi n">
    <div class="kpi-v">${m.n.toLocaleString()}</div>
    <div class="kpi-l">Scholars Served</div>
    <div class="kpi-s">With iReady diagnostic pairs</div>
  </div>
  <div class="kpi g">
    <div class="kpi-v">${m.sprOnGL.length.toLocaleString()}</div>
    <div class="kpi-l">On/Above Grade Level</div>
    <div class="kpi-s">Spring · ${glGain >= 0 ? '+' + glGain : glGain} vs. BOY baseline</div>
  </div>
</div>

<!-- ── Program Window Context ─────────────────────── -->
<div style="background:#f8faff;border:1.5px solid #bfdbfe;border-radius:12px;padding:.85rem 1.4rem;margin-bottom:1rem;display:flex;align-items:flex-start;gap:.75rem">
  <span style="font-size:1.05rem;flex-shrink:0;margin-top:.05rem">📏</span>
  <div>
    <div style="font-size:.8rem;font-weight:800;color:#0a2342;margin-bottom:.2rem">Understanding Growth Benchmarks &nbsp;·&nbsp; Actual Diagnostic Window</div>
    <div style="font-size:.7rem;color:#475569;line-height:1.65">iReady's 100% typical growth benchmark assumes <strong>30 instructional weeks</strong>. NJTC scholars' BOY → EOY diagnostic window spanned <strong>${_dispWks !== null ? Math.round(_dispWks) : '—'} weeks</strong>${_dispWks !== null && _dispWks < 30 ? ' — a shorter window than iReady\'s norm' : ''}. Both metrics are reported: <strong>iReady % Typical Growth</strong> (direct from the diagnostic, measured against the 30-wk standard) and <strong>Window-Adjusted Growth</strong> (recalibrated to the actual diagnostic window). The adjusted figure provides a fairer picture of NJTC's impact when scholars receive fewer than 30 weeks of programming.</div>
  </div>
</div>

<!-- ── Section 1: Placement Level Movement ────────── -->
<div class="sec">
  <div class="sec-hd">
    <div class="sec-dot" style="background:#00695c"></div>
    <div>
      <div class="sec-ttl">Partnership Impact — Placement Level Advancement &nbsp;·&nbsp; By School</div>
      <div class="sec-sub">Percentage of scholars at each school who advanced at least one iReady relative placement level from BOY Baseline to EOY Spring — sorted by strongest performance</div>
    </div>
  </div>
  <div class="c-layout">
    <div class="c-wrap"><canvas id="c1" style="height:${ch1}px"></canvas></div>
    <div class="c-side">
      <div class="ckpi"><div class="ck-v" style="color:#00695c">${m.pctMoved}%</div><div class="ck-l">Network Advancement Rate</div></div>
      <div class="ckpi"><div class="ck-v" style="color:#0a2342">${m.moved.length.toLocaleString()}</div><div class="ck-l">Scholars Advanced</div></div>
      <div class="ckpi"><div class="ck-v" style="color:#0a2342">${m.n.toLocaleString()}</div><div class="ck-l">Scholars Served</div></div>
      <div class="ckpi"><div class="ck-v" style="color:#1565c0">${m.pctHeld}%</div><div class="ck-l">Held Placement Level</div></div>
      <div class="ckpi"><div class="ck-v" style="color:#00695c">${m.sprOnGL.length.toLocaleString()}</div><div class="ck-l">At/Above Grade Level (Spring)</div></div>
    </div>
  </div>
</div>

<!-- ── Section 2: Placement Distribution Shift ────── -->
<div class="sec">
  <div class="sec-hd">
    <div class="sec-dot" style="background:#1565c0"></div>
    <div>
      <div class="sec-ttl">Overall Relative Placement Shifts &nbsp;·&nbsp; Network</div>
      <div class="sec-sub">Scholar placement across all 5 iReady relative bands shifted toward grade level from BOY Baseline to EOY Spring — showing the full portfolio picture</div>
    </div>
  </div>
  <div class="c-layout wide"><canvas id="c2" height="200"></canvas></div>
  <div class="legend">
    <div class="leg-item"><div class="leg-dot" style="background:rgba(220,38,38,.88)"></div>3+ Grade Levels Below</div>
    <div class="leg-item"><div class="leg-dot" style="background:rgba(249,115,22,.88)"></div>2 Grade Levels Below</div>
    <div class="leg-item"><div class="leg-dot" style="background:rgba(234,179,8,.88)"></div>1 Grade Level Below</div>
    <div class="leg-item"><div class="leg-dot" style="background:rgba(13,148,136,.88)"></div>Early On Grade Level</div>
    <div class="leg-item"><div class="leg-dot" style="background:rgba(13,110,58,.88)"></div>Mid or Above Grade Level</div>
  </div>
</div>

<!-- ── Section 3: Window-Adjusted Typical Growth ───── -->
<div class="sec">
  <div class="sec-hd">
    <div class="sec-dot" style="background:#1565c0"></div>
    <div>
      <div class="sec-ttl">Scholar Progress — Median % Typical Growth by School &nbsp;·&nbsp; Window-Adjusted</div>
      <div class="sec-sub">Same iReady Median % Typical Growth metric — recalibrated to the actual ${_dispWks !== null ? Math.round(_dispWks)+'-week' : 'actual'} diagnostic window instead of iReady's assumed 30 weeks &nbsp;·&nbsp; 100% = exactly on-pace for the true available weeks &nbsp;·&nbsp; Sidebar shows both adjusted and standard (30-wk) values for direct comparison</div>
    </div>
  </div>
  <div class="c-layout">
    <div class="c-wrap"><canvas id="c3" style="height:${ch3}px"></canvas></div>
    <div class="c-side">
      <div class="ckpi"><div class="ck-v" style="color:#0a2342">${_dispWks !== null ? Math.round(_dispWks)+' wks' : '—'}</div><div class="ck-l">Diagnostic Window</div></div>
      <div style="border-top:1.5px solid #e2e8f0;margin:.35rem 0 .2rem;padding-top:.35rem">
        <div style="font-size:.6rem;font-weight:800;color:#1565c0;text-transform:uppercase;letter-spacing:.06em;margin-bottom:.25rem">Median Typical Growth — Window-Adjusted</div>
        <div style="font-size:.58rem;color:#94a3b8;margin-bottom:.2rem">% Typical ÷ (actual wks / 30)</div>
      </div>
      <div class="ckpi"><div class="ck-v" style="color:${bestSubjLabel==='ELA'?'#1565c0':'#475569'}">${netWkAdjELA !== null ? (netWkAdjELA*100).toFixed(1)+'%' : '—'}</div><div class="ck-l">ELA (adj.)</div></div>
      <div class="ckpi"><div class="ck-v" style="color:${bestSubjLabel==='Math'?'#1565c0':'#475569'}">${netWkAdjMath !== null ? (netWkAdjMath*100).toFixed(1)+'%' : '—'}</div><div class="ck-l">Math (adj.)</div></div>
      <div style="border-top:1.5px solid #e2e8f0;margin:.35rem 0 .2rem;padding-top:.35rem">
        <div style="font-size:.6rem;font-weight:800;color:#64748b;text-transform:uppercase;letter-spacing:.06em;margin-bottom:.25rem">Median Typical Growth — iReady Standard</div>
        <div style="font-size:.58rem;color:#94a3b8;margin-bottom:.2rem">% Typical as reported · 30-wk norm</div>
      </div>
      <div class="ckpi"><div class="ck-v" style="color:#64748b;font-size:1.05rem">${elaMedian !== null ? (elaMedian*100).toFixed(1)+'%' : '—'}</div><div class="ck-l">ELA (standard)</div></div>
      <div class="ckpi"><div class="ck-v" style="color:#64748b;font-size:1.05rem">${mathMedian !== null ? (mathMedian*100).toFixed(1)+'%' : '—'}</div><div class="ck-l">Math (standard)</div></div>
      <div style="border-top:1.5px solid #e2e8f0;margin:.35rem 0 .2rem"></div>
      <div class="ckpi"><div class="ck-v" style="color:#00695c">${m.metTypPct !== null ? m.metTypPct+'%' : '—'}</div><div class="ck-l">Met Growth Target</div></div>
    </div>
  </div>
</div>

<!-- ── Section 4: Months of Growth ───────────────── -->
<div class="sec">
  <div class="sec-hd">
    <div class="sec-dot" style="background:#f0b429"></div>
    <div>
      <div class="sec-ttl">Months of Learning Gained &nbsp;·&nbsp; By School</div>
      <div class="sec-sub">Each month of academic learning gained represents real progress toward grade-level readiness — median across scholars with diagnostic pairs at each school</div>
    </div>
  </div>
  <div class="c-layout">
    <div class="c-wrap"><canvas id="c4" style="height:${ch4}px"></canvas></div>
    <div class="c-side">
      <div class="ckpi"><div class="ck-v" style="color:#d97706">${elaMonths !== null ? elaMonths.toFixed(1) : '—'}</div><div class="ck-l">ELA Median Months</div></div>
      <div class="ckpi"><div class="ck-v" style="color:#d97706">${mathMonths !== null ? mathMonths.toFixed(1) : '—'}</div><div class="ck-l">Math Median Months</div></div>
      <div class="ckpi"><div class="ck-v" style="color:#0a2342">${allMonths !== null ? allMonths.toFixed(1) : '—'}</div><div class="ck-l">Overall Network</div></div>
    </div>
  </div>
</div>

<!-- ── Section 5: Scholar Impact Profiles ────────── -->
<div class="sec sec-after-pb">
  <div class="sec-hd">
    <div class="sec-dot" style="background:#f0b429"></div>
    <div>
      <div class="sec-ttl">Top 10 Scholar Impact Profiles</div>
      <div class="sec-sub">Scholars who advanced in iReady placement level or exceeded 75% of their typical growth target — ranked by placement advancement, then growth pace &nbsp;·&nbsp; Domain scores shown where available in export &nbsp;·&nbsp; Instructional minutes shown when Pearl session data is loaded</div>
    </div>
  </div>
  <div class="sc-grid">
${scholarsHTML || '<div style="padding:1.5rem;color:#94a3b8;text-align:center">No qualifying scholars found for the selected filters.</div>'}
  </div>
</div>

<!-- ── Footer ─────────────────────────────────────── -->
<div class="rpt-footer">
  New Jersey Tutoring Corps &nbsp;·&nbsp; Academic Intelligence Report &nbsp;·&nbsp; ${H(reportDate)}<br>
  <span style="color:#cbd5e1">Growth data from iReady diagnostics (Curriculum Associates) &nbsp;·&nbsp; Operational data from Pearl &nbsp;·&nbsp; Confidential — for partner use only</span>
</div>

</div>

<!-- ── Print button ─────────────────────────────── -->
<button class="print-btn no-print" onclick="window.print()">
  🖨&nbsp; Print / Save as PDF
</button>

<script>
(function(){
  'use strict';
  if (typeof ChartDataLabels !== 'undefined') Chart.register(ChartDataLabels);
  Chart.defaults.font.family = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
  Chart.defaults.color = '#475569';

  var c1l = ${JSON.stringify(c1Labels)};
  var c1d = ${JSON.stringify(c1Data)};
  var c1n = ${JSON.stringify(c1N)};
  var c1c = ${JSON.stringify(c1Colors)};

  // Chart 1 — % Scholars Advanced 1+ Level · By School
  new Chart(document.getElementById('c1'), {
    type: 'bar',
    data: {
      labels: c1l,
      datasets: [{ data: c1d, backgroundColor: c1c, borderRadius: 5, barThickness: 24 }]
    },
    options: {
      indexAxis: 'y', responsive: true, maintainAspectRatio: false,
      layout: { padding: { right: 120 } },
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: function(ctx){ return ' ' + ctx.raw + '% advanced  ·  n = ' + c1n[ctx.dataIndex]; } } },
        datalabels: {
          anchor: 'end', align: 'end', clamp: false,
          color: '#1e293b',
          font: { size: 11, weight: '700' },
          formatter: function(value, ctx){ return value + '%   n = ' + c1n[ctx.dataIndex]; }
        }
      },
      scales: {
        x: { min:0, max:100, ticks:{ callback: function(v){ return v+'%'; }, maxTicksLimit:6 }, grid:{ color:'#f1f5f9' }, title:{ display:true, text:'% Scholars Advanced 1+ Placement Level', font:{ size:11 } } },
        y: { grid:{ display:false }, ticks:{ font:{ size:11 } } }
      }
    }
  });

  // Chart 2 — Placement Distribution BOY vs EOY
  var c2ds = ${JSON.stringify(c2Datasets)};
  new Chart(document.getElementById('c2'), {
    type: 'bar',
    data: { labels: ['BOY (Baseline)', 'EOY (Spring)'], datasets: c2ds },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: function(ctx){ return ' ' + ctx.dataset.label + ': ' + ctx.raw + '%'; } } },
        datalabels: {
          anchor: 'center', align: 'center',
          color: function(ctx){ var v=ctx.dataset.backgroundColor; return v==='rgba(234,179,8,.88)'?'#78350f':'#fff'; },
          font: { size: 11.5, weight: '800' },
          formatter: function(value){ return value >= 5 ? value + '%' : ''; }
        }
      },
      scales: {
        x: { stacked:true, grid:{ display:false }, ticks:{ font:{ size:13, weight:'700' } } },
        y: { stacked:true, min:0, max:100, ticks:{ callback: function(v){ return v+'%'; }, maxTicksLimit:6 }, grid:{ color:'#f1f5f9' } }
      }
    }
  });

  // Chart 3 — Window-Adjusted Typical Growth · By School
  var c3l = ${JSON.stringify(c3Labels)};
  var c3d = ${JSON.stringify(c3Data)};
  var c3c = ${JSON.stringify(c3Colors)};
  var c3w = ${JSON.stringify(c3Wks)};
  new Chart(document.getElementById('c3'), {
    type: 'bar',
    data: {
      labels: c3l,
      datasets: [{ data: c3d, backgroundColor: c3c, borderRadius: 5, barThickness: 24 }]
    },
    options: {
      indexAxis: 'y', responsive: true, maintainAspectRatio: false,
      layout: { padding: { right: 88 } },
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: function(ctx){ var wks = c3w[ctx.dataIndex]; return ' ' + ctx.raw + '% window-adj. growth' + (wks ? '  ·  ' + wks + '-wk window' : ''); } } },
        datalabels: {
          anchor: 'end', align: 'end', clamp: false,
          color: '#1e293b',
          font: { size: 11, weight: '700' },
          formatter: function(value, ctx){ return value + '%' + (c3w[ctx.dataIndex] ? ' / ' + c3w[ctx.dataIndex] + 'w' : ''); }
        }
      },
      scales: {
        x: { min:0, ticks:{ callback: function(v){ return v+'%'; }, maxTicksLimit:6 }, grid:{ color:'#f1f5f9' }, title:{ display:true, text:'Window-Adjusted Growth % (100% = on-pace for actual diagnostic window)', font:{ size:11 } } },
        y: { grid:{ display:false }, ticks:{ font:{ size:11 } } }
      }
    }
  });

  // Chart 4 — Months of Learning Gained · By School
  var c4l = ${JSON.stringify(c4Labels)};
  var c4d = ${JSON.stringify(c4Data)};
  var c4c = ${JSON.stringify(c4Colors)};
  new Chart(document.getElementById('c4'), {
    type: 'bar',
    data: {
      labels: c4l,
      datasets: [{ data: c4d, backgroundColor: c4c, borderRadius: 5, barThickness: 24 }]
    },
    options: {
      indexAxis: 'y', responsive: true, maintainAspectRatio: false,
      layout: { padding: { right: 72 } },
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: function(ctx){ return ' ' + ctx.raw + ' months of learning gained'; } } },
        datalabels: {
          anchor: 'end', align: 'end', clamp: false,
          color: '#1e293b',
          font: { size: 11, weight: '700' },
          formatter: function(value){ return value + ' mo'; }
        }
      },
      scales: {
        x: { min:0, ticks:{ maxTicksLimit:6 }, grid:{ color:'#f1f5f9' }, title:{ display:true, text:'Median Months of Learning Gained', font:{ size:11 } } },
        y: { grid:{ display:false }, ticks:{ font:{ size:11 } } }
      }
    }
  });
})();
<\/script>
</body>
</html>`;

      const blob = new Blob([html], { type:'text/html;charset=utf-8;' });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href = url;
      a.download = 'njtc-iready-report-' + new Date().toISOString().slice(0,10) + '.html';
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }

    return { onPanelOpen, setMode, setYear, setSubject, setDistrict, setSchool, setGrade, setScholarType, setPilot, setSearch, setDept, setBreakdownTab, setDeepTab,
             drillScholar, drillTutor, closeDrill,
             handleFileUpload, clearCsv, embedData,
             // getAllRows exposed for cross-module use (Apprentice Impact Report, etc.)
             // Accepts same opts as the internal function: { subject, year, district, school, grade }
             // IMPORTANT: unlike the internal getAllRows, this version does NOT apply _irlSearch,
             // so reports always get complete data regardless of what the user has typed in the
             // IRLAB search box.
             getAllRows: function(opts) {
               opts = opts || {};
               var rows = _getPooledRows();
               if (opts.subject && opts.subject !== 'all') rows = rows.filter(function(r){ return r.subject === opts.subject; });
               if (opts.year    && opts.year    !== 'all') rows = rows.filter(function(r){ return r.year    === opts.year;    });
               if (opts.district && opts.district !== 'all') rows = rows.filter(function(r){ return r.district === opts.district; });
               if (opts.school   && opts.school   !== 'all') rows = rows.filter(function(r){ return r.school   === opts.school;   });
               if (opts.grade    && opts.grade    !== 'all') rows = rows.filter(function(r){ return r.grade    === opts.grade;    });
               return rows;
             },
             handleEmbedUpload, applyEmbeddedUpdate, clearEmbedded,
             getTutorAcademicData, getTutorAcademicImpact, getSummary, getSnapshot, getInsightMetrics,
             fetchLive: _irlFetchLive,
             downloadCSV, downloadXLSX, downloadHTMLReport,
             openExportModal, setExportFilter, confirmExport, closeExportModal,
             // MOY public API
             moySetSubject, moySetView, moyRefresh,
             getMOYData: () => MOY_DATA,
             // Standards Mastery public API
             smRefresh, smSetFilterGrade, smSetFilterInstr, smSetFilterStandard,
             smShowModal, smCloseModal, smClearFilters,
             getSMData: () => SM_DATA,
             // Scholars truly excluded: appear in MOY sheet but have no Fall+Winter pair
             getMOYMissingScholars: (subject) => {
               const rows = subject === 'ELA' ? (MOY_DATA.ela || []) : (MOY_DATA.math || []);
               return rows
                 .filter(r => r.winterWeeks === 0 || r.pctTypical === null)
                 .map(r => ({
                   name:        r.scholarName || '—',
                   school:      r.school      || '—',
                   grade:       r.grade       || '—',
                   reason:      r.winterWeeks === 0 ? 'No Fall Baseline (Winter-only)' : 'Missing % Typical data',
                   winterScore: r.winterScore,
                 }))
                 .sort((a,b) => a.school.localeCompare(b.school));
             },
             // Red Rush flagged scholars — included in calculations, surfaced for review
             getMOYRushFlagged: (subject) => {
               const rows = subject === 'ELA' ? (MOY_DATA.ela || []) : (MOY_DATA.math || []);
               return rows
                 .filter(r => r.isRedRush)
                 .map(r => ({
                   name:        r.scholarName || '—',
                   school:      r.school      || '—',
                   grade:       r.grade       || '—',
                   winterScore: r.winterScore,
                   pctTypical:  r.pctTypical !== null ? Math.round(r.pctTypical * 100) + '%' : '—',
                   rushFlag:    r.winterRush  || 'Red',
                 }))
                 .sort((a,b) => a.school.localeCompare(b.school));
             },
             computeMOY,
             _moyExportPDF:  _moyGeneratePDF,
             _moyExportCSV:  _moyExportCSV,
             _moyExportXLSX: _moyExportXLSX,
           };  // exposed so Talent panel can trigger academic refresh
  })();



  // ── Expose to global scope ───────────────────────────────────────────────
  window.renderDataAnalytics   = renderDataAnalytics;
  window.irlab                 = irlab;
  window.irlabRefreshLive      = () => irlab.refreshIRLabLive();

  // ── Data Sources File Cabinet ─────────────────────────────────────────────
  const DATA_SOURCES_CATALOG = [
    {
      name: 'Pearl Operations Report',
      type: 'sheets',
      url:  'https://docs.google.com/spreadsheets/d/1yMa4-7SJlfT-Z8ZlRwhQ0wlstkPPvHP0o61YK6MzAiA/edit?gid=117217808#gid=117217808',
      desc: 'Attendance Detail, Session Detail, Instructor Surveys, Student Surveys, Instructor Attendance Summary (used for apprentice tag inclusion only)',
      tag:  'Pearl · Program Data',
    },
    {
      name: 'iReady Longitudinal Report',
      type: 'sheets',
      url:  'https://docs.google.com/spreadsheets/d/16TGLCi5zCzrujBFRjOckcScYt47VKOr-RcKvu2EMiT0/edit?gid=394721793#gid=394721793',
      desc: 'Tutor-Scholar Association, Cycle-over-Cycle Analysis, Overall Relative Placement, Scale Score Gains, Median Typical Growth',
      tag:  'iReady · Academic',
    },
    {
      name: 'iReady 25-26 ELA Academic Report (Student Level)',
      type: 'sheets',
      url:  'https://docs.google.com/spreadsheets/d/1mCx6eFKscXA3y5Ox_JB9cSualR5Tw9MbKxBVN078_G0/edit?gid=1640935949#gid=1640935949',
      desc: '2025-2026 ELA student-level iReady data — Norming Window, Overall Scale Score, placement, diagnostic gains. Used for BOY/EOY score backfill into longitudinal rows.',
      tag:  'iReady · Academic · ELA · 2025-2026',
    },
    {
      name: 'iReady 25-26 Math Academic Report (Student Level)',
      type: 'sheets',
      url:  'https://docs.google.com/spreadsheets/d/1mCx6eFKscXA3y5Ox_JB9cSualR5Tw9MbKxBVN078_G0/edit?gid=1676366557#gid=1676366557',
      desc: '2025-2026 Math student-level iReady data — Norming Window, Overall Scale Score, placement, diagnostic gains. Used for BOY/EOY score backfill into longitudinal rows.',
      tag:  'iReady · Academic · Math · 2025-2026',
    },
    {
      name: 'Annual Goal Database',
      type: 'sheets',
      url:  'https://docs.google.com/spreadsheets/d/1woHFd7OzO_IS5yD8HOGifVCu0hW3qAStyja63hcxvWg/edit?gid=1313501732#gid=1313501732',
      desc: 'Annual Goal Targets, Owners, Metrics Captured, Goal Target, Quarterly to Mid/End Review',
      tag:  'KPI · Strategy',
    },
    {
      name: 'HIT Compliance Database (Current SY)',
      type: 'sheets',
      url:  'https://docs.google.com/spreadsheets/d/1IZSYmLgMddPtn5Ei9mehqTWJAbpcm5Tx1GL-YytLj0k/edit?gid=274671201#gid=274671201',
      desc: 'Partner Details, Personnel Details (Staff Fulfillment), Terminations, Retention Bonuses, iReady Dashboard Credentials, Program Concerns, Site Observations',
      tag:  'HIT · Compliance · HR',
    },
    {
      name: 'Apprenticeship Database',
      type: 'sheets',
      url:  'https://docs.google.com/spreadsheets/d/1_s6FnrI4537A7woPJ0F-56l2GS1Pt8c1x5RZuUjEl7U/edit?gid=1649286205#gid=1649286205',
      desc: 'On-the-Job (OTJ) Checklist, NE & SW Apprenticeship Database (new/updated), Master Apprenticeship Database (not currently in use)',
      tag:  'TAP · OTJ',
    },
    {
      name: 'Apprentice Tracker — Import Range',
      type: 'sheets',
      url:  'https://docs.google.com/spreadsheets/d/1Dh1-TsuXEwoz4sqA4RBtgylPZ6epencsrJoqxupIEqs/edit?gid=0#gid=0',
      desc: 'Apprenticeship tracker imported range (automated) — managed by Ashley',
      tag:  'TAP · Automated',
    },
    {
      name: 'Leaderboard / Team Meeting Database',
      type: 'sheets',
      url:  'https://docs.google.com/spreadsheets/d/1kCMKkIfN_2ONjvHooIk5xbyXlw5j-UGWNqRpttD5uaA/edit?gid=1827144938#gid=1827144938',
      desc: 'Team meeting leaderboard submissions — replaces Team Meeting Pre-work document',
      tag:  'Leaderboard · Submissions',
    },
    {
      name: 'Leaderboard Submission Form',
      type: 'forms',
      url:  'https://docs.google.com/forms/d/1gLj4Rvo0zwsBxFCHxzo15msQoDPEwlw06BhZi2F0n2I/edit',
      desc: 'Weekly Team Meeting Notes submission form (linked to Portal)',
      tag:  'Form · Leaderboard',
    },
    {
      name: 'Annual Goal Intake Questionnaire',
      type: 'sheets',
      url:  'https://docs.google.com/spreadsheets/d/1meBFuYvhzzOaDiuyT-1QIkMI4Q6JTp6MYOUdFDiWe3k/edit?gid=34364495#gid=34364495',
      desc: 'KPI Target Google Form — Question submission and response log',
      tag:  'KPI · Form Responses',
    },
    {
      name: 'Asana Annual Goal Tracking',
      type: 'asana',
      url:  'https://app.asana.com/1/1202967547815613/project/1211431518555737/list/1211431677026997',
      desc: 'Annual Goal Tracking Project Plan, Potential Department Project Plans',
      tag:  'Asana · Project Mgmt',
    },
    {
      name: 'Hiring Decisions Form',
      type: 'forms',
      url:  'https://docs.google.com/forms/d/e/1FAIpQLScg2aTj4-GwyDQHvms5Cwkuf03JpaRWkXHWl5gzfoXClsyAIg/viewform',
      desc: 'Hiring decisions submitted by the Hiring Team',
      tag:  'Form · HR · Hiring',
    },
    {
      name: 'T&D — Professional Development',
      type: 'sheets',
      url:  'https://docs.google.com/spreadsheets/d/18LyHoN0c8BTD-ZVC0D4BpwD-rhq9ZBjgvFIXrsOKYM8/edit?gid=471085177#gid=471085177',
      desc: 'Professional Development tracking for field staff',
      tag:  'T&D · Field Staff',
    },
    {
      name: 'T&D — Training Intake Form',
      type: 'sheets',
      url:  'https://docs.google.com/spreadsheets/d/11OH4pBpKhJ80miKDnbKhQ2fB1ZHuRoQPn3i3oLmdruk/edit?gid=1298105082#gid=1298105082',
      desc: 'Training intake form responses for field staff',
      tag:  'T&D · Intake · Field Staff',
    },
    {
      name: 'T&D — Quarterly Satisfaction Survey',
      type: 'sheets',
      url:  'https://docs.google.com/spreadsheets/d/1wp50xdBU7dRcJBzh4-sr5BJ7wn6lrOyFiHUUIG8XNrY/edit?gid=616402823#gid=616402823',
      desc: 'Quarterly satisfaction survey responses from partner organizations',
      tag:  'T&D · Survey · Partner',
    },
    {
      name: 'Pearl Ops Ticket System',
      type: 'sheets',
      url:  'https://docs.google.com/spreadsheets/d/1OsgHVtWiQVEKvqqnRSwuzJ0Gt1GrvawSZzWu3eK-w7c/edit?gid=1157594489#gid=1157594489',
      desc: 'Programming & Data escalation tickets for Pearl Operations — review submissions and enter responses in column K.',
      tag:  'Pearl · Tickets · Escalations',
    },
    {
      name: 'Pearl Ops Ticket Form',
      type: 'forms',
      url:  'https://docs.google.com/forms/d/e/1FAIpQLSfBqfEOWMgR4ynfbQi5t0vGMMtZjUZ6IMqRabPF9BZqTMlgqQ/viewform',
      desc: 'Form for Programming & Data to submit Pearl Operations data requests, context questions, and meeting requests.',
      tag:  'Pearl · Form · Escalations',
    },
  ];

  function _buildDataCabinet() {
    const TYPE_META = {
      sheets: { icon: '📊', label: 'Google Sheets', color: '#1a7340', bg: '#e8f5e9', border: '#a5d6a7', btn: '#1a7340' },
      forms:  { icon: '📝', label: 'Google Forms',  color: '#6a1b9a', bg: '#f3e5f5', border: '#ce93d8', btn: '#6a1b9a' },
      asana:  { icon: '🎯', label: 'Asana',          color: '#e05a2b', bg: '#fff3ef', border: '#ffb59a', btn: '#e05a2b' },
    };

    const grouped = {};
    DATA_SOURCES_CATALOG.forEach(s => {
      const g = s.type;
      if (!grouped[g]) grouped[g] = [];
      grouped[g].push(s);
    });

    const sectionOrder = ['sheets', 'forms', 'asana'];
    const sectionLabels = { sheets: 'Google Sheets Databases', forms: 'Google Forms', asana: 'Project Management' };

    let html = `
<div style="padding:1.5rem 1.25rem 2rem">
  <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:.75rem;margin-bottom:1.25rem">
    <div>
      <div style="font-size:.7rem;font-weight:700;color:#7b2d8b;text-transform:uppercase;letter-spacing:.08em;margin-bottom:.2rem">Data & Evaluation · Internal Use Only</div>
      <div style="font-size:.8125rem;color:#475569">${DATA_SOURCES_CATALOG.length} data sources · Click any entry to open in Google Sheets, Google Forms, or Asana</div>
    </div>
    <div style="font-size:.7rem;color:#94a3b8;display:flex;gap:.625rem;flex-wrap:wrap">
      <span style="display:inline-flex;align-items:center;gap:.3rem"><span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:#1a7340"></span>Sheets</span>
      <span style="display:inline-flex;align-items:center;gap:.3rem"><span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:#6a1b9a"></span>Forms</span>
      <span style="display:inline-flex;align-items:center;gap:.3rem"><span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:#e05a2b"></span>Asana</span>
    </div>
  </div>`;

    sectionOrder.forEach(type => {
      const items = grouped[type];
      if (!items || !items.length) return;
      const m = TYPE_META[type];
      html += `
  <div style="margin-bottom:1.5rem">
    <div style="font-size:.65rem;font-weight:800;text-transform:uppercase;letter-spacing:.1em;color:${m.color};margin-bottom:.625rem;padding-bottom:.3rem;border-bottom:1.5px solid ${m.border}">${m.icon} ${sectionLabels[type]} (${items.length})</div>
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(340px,1fr));gap:.625rem">`;

      items.forEach((s, i) => {
        html += `
      <div style="background:#fff;border:1px solid #e8edf4;border-left:3px solid ${m.color};border-radius:8px;padding:.75rem 1rem;display:flex;flex-direction:column;gap:.3rem;box-shadow:0 1px 3px rgba(0,0,0,.05)">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:.5rem">
          <div style="font-size:.8125rem;font-weight:700;color:#1e293b;line-height:1.3">${s.name}</div>
          <a href="${s.url}" target="_blank" rel="noopener noreferrer"
             style="flex-shrink:0;font-size:.68rem;font-weight:700;color:#fff;background:${m.btn};border-radius:5px;padding:.25rem .6rem;text-decoration:none;white-space:nowrap;margin-top:.05rem">
            Open ↗
          </a>
        </div>
        <div style="font-size:.72rem;color:#475569;line-height:1.5">${s.desc}</div>
        <div style="margin-top:.15rem">
          ${s.tag.split('·').map(t => `<span style="display:inline-block;font-size:.6rem;font-weight:600;color:${m.color};background:${m.bg};border:1px solid ${m.border};border-radius:99px;padding:.1rem .45rem;margin-right:.25rem;margin-bottom:.15rem">${t.trim()}</span>`).join('')}
        </div>
      </div>`;
      });

      html += `
    </div>
  </div>`;
    });

    html += `
  <div style="margin-top:1rem;padding:.625rem .875rem;background:#f8fafc;border:1px solid #e2e8f0;border-radius:7px;font-size:.7rem;color:#94a3b8;line-height:1.6">
    🔒 <strong style="color:#475569">Data Department access only.</strong> These links connect to live operational databases. Contact the Director of Program Evaluation &amp; Impact (PEI) for questions about data definitions, access, or methodology.
  </div>
</div>`;
    return html;
  }

  window._buildDataCabinet = _buildDataCabinet;

  // ── Data Department Device Security ────────────────────────────────────────
  // Shows a deterrent overlay to any device that is not registered as trusted.
  // Trusted devices are registered per-device via the admin code flow.
  // Access events are logged locally so the admin can review them on their device.
  (function() {
    const TRUSTED_KEY = 'njtcDataTrustedDevices';
    const LOG_KEY     = 'njtcDataAccessLog';

    function getFingerprint() {
      const raw = [
        navigator.userAgent,
        screen.width + 'x' + screen.height,
        screen.colorDepth,
        (Intl.DateTimeFormat().resolvedOptions().timeZone || ''),
        navigator.language,
        (navigator.hardwareConcurrency || '')
      ].join('|');
      let h = 5381;
      for (let i = 0; i < raw.length; i++) h = ((h << 5) + h) ^ raw.charCodeAt(i);
      return (h >>> 0).toString(36);
    }

    function getTrusted() {
      try { return JSON.parse(localStorage.getItem(TRUSTED_KEY) || '[]'); } catch(e) { return []; }
    }

    function trustDevice(fp) {
      const list = getTrusted();
      if (!list.find(d => d.fp === fp)) {
        const label = /mac os x|macintosh/i.test(navigator.userAgent) ? 'MacBook'
                    : /windows/i.test(navigator.userAgent)             ? 'Windows PC'
                    : /linux/i.test(navigator.userAgent)               ? 'Linux Device'
                    : 'Authorized Device';
        list.push({ fp, label, registered: new Date().toLocaleString() });
        localStorage.setItem(TRUSTED_KEY, JSON.stringify(list));
      }
    }

    function logAccess(fp, trusted) {
      try {
        const log = JSON.parse(localStorage.getItem(LOG_KEY) || '[]');
        log.unshift({ fp, trusted, time: new Date().toLocaleString(), ua: (navigator.userAgent||'').substring(0, 90) });
        localStorage.setItem(LOG_KEY, JSON.stringify(log.slice(0, 60)));
      } catch(e) {}
    }

    function showDeterrentOverlay(fp) {
      const ts = new Date().toLocaleString('en-US', {
        weekday:'long', year:'numeric', month:'long', day:'numeric',
        hour:'2-digit', minute:'2-digit', second:'2-digit', timeZoneName:'short'
      });

      const ov = document.createElement('div');
      ov.id = 'njtc-data-sec-overlay';
      ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.93);z-index:999999;display:flex;align-items:center;justify-content:center;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;';
      ov.innerHTML =
        '<div style="max-width:600px;width:94%;background:#0a0e18;border:2px solid #dc2626;border-radius:16px;padding:2.5rem;color:#fff;box-shadow:0 0 90px rgba(220,38,38,.45)">' +
          '<div style="display:flex;align-items:center;gap:.875rem;margin-bottom:1.25rem">' +
            '<div style="width:48px;height:48px;background:#dc2626;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:1.5rem;flex-shrink:0">⚠</div>' +
            '<div>' +
              '<div style="font-size:.6rem;font-weight:800;letter-spacing:.2em;text-transform:uppercase;color:#dc2626;margin-bottom:.25rem">NJTC — DATA &amp; EVALUATION — SECURITY NOTICE</div>' +
              '<div style="font-size:1.1rem;font-weight:800;line-height:1.25">Unrecognized Device Access Flagged</div>' +
            '</div>' +
          '</div>' +
          '<div style="background:#1a0707;border:1px solid #7f1d1d;border-radius:8px;padding:1rem;margin-bottom:1.25rem;font-size:.8125rem;color:#fca5a5;line-height:1.8">' +
            '<div><strong>Access Timestamp:</strong> ' + ts + '</div>' +
            '<div><strong>Department:</strong> Data &amp; Evaluation</div>' +
            '<div><strong>Device Status:</strong> <span style="color:#f87171;font-weight:700">UNRECOGNIZED — NOT IN TRUSTED REGISTRY</span></div>' +
          '</div>' +
          '<p style="font-size:.875rem;color:#e5e7eb;line-height:1.75;margin:0 0 .875rem">' +
            'The <strong>NJTC Data &amp; Evaluation Department</strong> has detected this login and recorded this access event. ' +
            'The department has been notified and this breach has been escalated per data security protocol.' +
          '</p>' +
          '<p style="font-size:.875rem;color:#e5e7eb;line-height:1.75;margin:0 0 1.5rem">' +
            '<strong>If you are not an authorized member of the Data &amp; Evaluation team, log out immediately.</strong> ' +
            'Unauthorized access to NJTC internal data systems is a violation of organizational policy.' +
          '</p>' +
          '<div style="display:flex;gap:.75rem;flex-wrap:wrap;margin-bottom:1.25rem">' +
            '<button id="njtc-sec-logout" style="flex:1;padding:.8rem 1.25rem;background:#dc2626;color:#fff;border:none;border-radius:8px;font-size:.875rem;font-weight:700;cursor:pointer;min-width:160px">🚪 Log Out Now</button>' +
            '<button id="njtc-sec-continue" style="flex:1;padding:.8rem 1.25rem;background:#1f2937;color:#d1d5db;border:1px solid #374151;border-radius:8px;font-size:.875rem;font-weight:600;cursor:pointer;min-width:160px">I Am Authorized — Continue</button>' +
          '</div>' +
          '<div id="njtc-sec-reg-wrap" style="display:none;border-top:1px solid #374151;padding-top:1rem;margin-top:.25rem">' +
            '<div style="font-size:.8rem;color:#9ca3af;margin-bottom:.625rem">Authorized admin: enter your Data &amp; Evaluation department code to permanently register this device as trusted.</div>' +
            '<div style="display:flex;gap:.5rem">' +
              '<input id="njtc-sec-code" type="password" placeholder="Department code" style="flex:1;padding:.55rem .75rem;background:#111827;border:1px solid #374151;border-radius:6px;color:#fff;font-size:.875rem">' +
              '<button id="njtc-sec-register" style="padding:.55rem 1rem;background:#1d4ed8;color:#fff;border:none;border-radius:6px;font-size:.875rem;font-weight:700;cursor:pointer">Register Device</button>' +
            '</div>' +
            '<div id="njtc-sec-reg-msg" style="font-size:.75rem;margin-top:.4rem;min-height:1rem"></div>' +
          '</div>' +
          '<div style="text-align:center;margin-top:.875rem">' +
            '<button id="njtc-sec-reg-toggle" style="background:none;border:none;color:#6b7280;font-size:.7rem;cursor:pointer;text-decoration:underline">Authorized admin: register this device as trusted</button>' +
          '</div>' +
        '</div>';

      document.body.appendChild(ov);

      document.getElementById('njtc-sec-logout').onclick = function() { ov.remove(); if (typeof NJTCAuth !== 'undefined') NJTCAuth.logout(); };
      document.getElementById('njtc-sec-continue').onclick = function() { ov.remove(); };
      document.getElementById('njtc-sec-reg-toggle').onclick = function() {
        var w = document.getElementById('njtc-sec-reg-wrap');
        w.style.display = w.style.display === 'none' ? 'block' : 'none';
      };
      document.getElementById('njtc-sec-register').onclick = async function() {
        var code = (document.getElementById('njtc-sec-code').value || '').trim();
        var msg  = document.getElementById('njtc-sec-reg-msg');
        if (!code) { msg.style.color='#ef4444'; msg.textContent='Enter your department code.'; return; }
        try {
          var result = await NJTCAuth.login(code);
          if (result && result.dept === 'data') {
            trustDevice(fp);
            msg.style.color = '#22c55e';
            msg.textContent = '✓ Device registered as trusted. You will not see this warning again on this browser.';
            setTimeout(function() { ov.remove(); }, 2000);
          } else {
            msg.style.color = '#ef4444';
            msg.textContent = 'Code not recognized. Contact the Data & Evaluation Director.';
          }
        } catch(e) {
          msg.style.color = '#ef4444';
          msg.textContent = 'Verification failed — check your connection and try again.';
        }
      };
    }

    function runSecurityCheck() {
      var session = window.NJTC_SESSION;
      if (!session || session.dept !== 'data') return;
      var fp = getFingerprint();
      var trusted = getTrusted();
      var isTrusted = trusted.some(function(d) { return d.fp === fp; });
      logAccess(fp, isTrusted);
      if (!isTrusted) showDeterrentOverlay(fp);
    }

    // Run after DOM ready and after session has had time to be set
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', function() { setTimeout(runSecurityCheck, 600); });
    } else {
      setTimeout(runSecurityCheck, 600);
    }

    // ── Access Log Widget — injected into Data Dept home panel ────────────────
    // Shows recent access events (from this device's localStorage) and trusted
    // device registry. Only visible to logged-in data dept users.
    function renderSecurityWidget() {
      var session = window.NJTC_SESSION;
      if (!session || session.dept !== 'data') return;
      var hp = document.getElementById('panel-home');
      if (!hp || document.getElementById('njtc-data-sec-widget')) return;

      var log = (function() { try { return JSON.parse(localStorage.getItem(LOG_KEY)||'[]'); } catch(e) { return []; } })();
      var trusted = getTrusted();
      var fp = getFingerprint();

      var widget = document.createElement('div');
      widget.id = 'njtc-data-sec-widget';
      widget.style.cssText = 'margin-top:1.5rem;background:#fff;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.05)';

      var untrustedCount = log.filter(function(e) { return !e.trusted; }).length;
      var headerColor = untrustedCount > 0 ? '#7f1d1d' : '#0f2d5e';
      var headerBg    = untrustedCount > 0 ? '#fef2f2' : '#f0f4fa';

      var rows = log.slice(0, 8).map(function(e) {
        var devLabel = trusted.find(function(d) { return d.fp === e.fp; });
        var devName  = devLabel ? devLabel.label : 'Unknown Device';
        var isMe     = e.fp === fp;
        var statusColor = e.trusted ? '#16a34a' : '#dc2626';
        var statusLabel = e.trusted ? (isMe ? 'This Device' : 'Trusted') : '⚠ Unrecognized';
        return '<tr style="border-bottom:1px solid #f3f4f6">' +
          '<td style="padding:.45rem .75rem;font-size:.75rem;color:#374151;white-space:nowrap">' + (e.time||'—') + '</td>' +
          '<td style="padding:.45rem .75rem;font-size:.75rem;font-weight:600;color:#1e293b">' + devName + '</td>' +
          '<td style="padding:.45rem .75rem"><span style="font-size:.65rem;font-weight:700;color:' + statusColor + ';background:' + (e.trusted?'#dcfce7':'#fee2e2') + ';padding:.15rem .5rem;border-radius:8px">' + statusLabel + '</span></td>' +
        '</tr>';
      }).join('');

      var trustedRows = trusted.map(function(d) {
        var isMe = d.fp === fp;
        return '<div style="display:flex;align-items:center;justify-content:space-between;padding:.5rem .875rem;border-bottom:1px solid #f3f4f6">' +
          '<div>' +
            '<div style="font-size:.8rem;font-weight:600;color:#1e293b">' + d.label + (isMe?' <span style="font-size:.65rem;color:#2563eb;font-weight:700">(this device)</span>':'') + '</div>' +
            '<div style="font-size:.7rem;color:#9ca3af">Registered: ' + (d.registered||'—') + '</div>' +
          '</div>' +
          (!isMe ? '<button onclick="window._njtcDataRevokeDevice(\'' + d.fp + '\');document.getElementById(\'njtc-data-sec-widget\').remove();setTimeout(window._njtcDataSecRenderWidget,100)" style="font-size:.65rem;color:#ef4444;background:none;border:none;cursor:pointer;padding:.2rem .5rem">Revoke</button>' : '') +
        '</div>';
      }).join('');

      widget.innerHTML =
        '<div style="display:flex;align-items:center;justify-content:space-between;padding:.875rem 1.125rem;background:' + headerBg + ';border-bottom:1px solid #e5e7eb;cursor:pointer" onclick="var b=document.getElementById(\'njtc-sec-body\');b.style.display=b.style.display===\'none\'?\'block\':\'none\'">' +
          '<div style="display:flex;align-items:center;gap:.625rem">' +
            '<span style="font-size:1rem">🔒</span>' +
            '<div>' +
              '<div style="font-size:.7rem;font-weight:800;text-transform:uppercase;letter-spacing:.08em;color:' + headerColor + '">Data Department Access Security</div>' +
              '<div style="font-size:.7rem;color:#6b7280;margin-top:.1rem">' +
                (untrustedCount > 0
                  ? '<span style="color:#dc2626;font-weight:700">⚠ ' + untrustedCount + ' unrecognized access event' + (untrustedCount>1?'s':'') + ' logged on this device</span>'
                  : 'All recent access events from recognized devices') +
              '</div>' +
            '</div>' +
          '</div>' +
          '<span style="font-size:.7rem;color:#9ca3af">▾ expand</span>' +
        '</div>' +
        '<div id="njtc-sec-body" style="display:none">' +
          '<div style="padding:.875rem 1.125rem;border-bottom:1px solid #f3f4f6">' +
            '<div style="font-size:.7rem;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:#374151;margin-bottom:.5rem">📋 Recent Access Log (this device)</div>' +
            (log.length
              ? '<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse"><thead><tr style="background:#f8fafc"><th style="padding:.4rem .75rem;font-size:.65rem;color:#6b7280;text-align:left;font-weight:700">Timestamp</th><th style="padding:.4rem .75rem;font-size:.65rem;color:#6b7280;text-align:left;font-weight:700">Device</th><th style="padding:.4rem .75rem;font-size:.65rem;color:#6b7280;text-align:left;font-weight:700">Status</th></tr></thead><tbody>' + rows + '</tbody></table></div>'
              : '<div style="font-size:.75rem;color:#9ca3af;padding:.25rem 0">No access events recorded on this device yet.</div>') +
            '<div style="font-size:.65rem;color:#9ca3af;margin-top:.5rem">ⓘ Access events are logged locally on each device. Cross-device activity is not available without a backend service.</div>' +
          '</div>' +
          '<div style="padding:.875rem 1.125rem">' +
            '<div style="font-size:.7rem;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:#374151;margin-bottom:.5rem">✅ Trusted Devices (this browser)</div>' +
            (trusted.length
              ? '<div style="border:1px solid #e5e7eb;border-radius:8px;overflow:hidden">' + trustedRows + '</div>'
              : '<div style="font-size:.75rem;color:#9ca3af">No trusted devices registered yet. Log in and use the deterrent overlay to register this device.</div>') +
          '</div>' +
        '</div>';

      hp.appendChild(widget);
    }

    window._njtcDataSecRenderWidget = renderSecurityWidget;

    // Render widget after home builds — give the home panel 1.5s to settle
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', function() { setTimeout(renderSecurityWidget, 1500); });
    } else {
      setTimeout(renderSecurityWidget, 1500);
    }

    // Expose access log + trusted device management to the home panel
    window._njtcDataSecurityLog    = function() { try { return JSON.parse(localStorage.getItem(LOG_KEY)||'[]'); } catch(e) { return []; } };
    window._njtcDataTrustedDevices = function() { return getTrusted(); };
    window._njtcDataRevokeDevice   = function(fp) {
      var list = getTrusted().filter(function(d) { return d.fp !== fp; });
      localStorage.setItem(TRUSTED_KEY, JSON.stringify(list));
    };
  })();

})();
