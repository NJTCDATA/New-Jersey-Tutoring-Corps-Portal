(function() {

  function buildExecDashboard(dept) {
    const el = document.getElementById('execDashboard');
    if (!el) return;
    try {
      _buildExecDashboardInner(dept, el);
    } catch(e) {
      console.error('[ExecDash] render error:', e);
      el.innerHTML = `<div style="padding:1rem;background:#fef2f2;border:1px solid #fecaca;border-radius:8px;color:#dc2626;font-size:.75rem">
        <strong>Dashboard Error:</strong> ${e.message}. Pearl data may still be loading — this will auto-refresh.
      </div>`;
    }
  }
  function _buildExecDashboardInner(dept, el) {

    // ── Period selector state (persisted on el.dataset) ───────────────
    const execPeriod = el.dataset.execPeriod || 'sy2526';
    const _isLive    = execPeriod !== 'sy2526'; // Summer 2026 or SY 26-27 — Pearl/iReady not yet available
    const _syaStats  = (window._syaStats && window._syaStats[execPeriod]) || null;
    const _periodLabel = execPeriod === 'sy2526' ? '📁 SY 25-26 Archived' : execPeriod === 'summer2026' ? '☀️ Summer 2026' : '🎓 SY 26-27';
    const _periodLong  = execPeriod === 'sy2526' ? 'SY 25-26 Archived Snapshot' : execPeriod === 'summer2026' ? 'Summer 2026 · Live Data' : 'SY 26-27 · Live Data';

    // ── Data sources ──────────────────────────────────────────────────
    const po   = (typeof window.po   !== 'undefined') ? window.po   : null;
    const irlb = (typeof window.irlab !== 'undefined') ? window.irlab : null;

    // po holds exactly one period's data in memory at a time — po.getStats().activePeriod
    // tells us which. Only trust it here when it matches the period THIS dashboard is
    // currently showing (execPeriod); otherwise nudge po to load the right one and show
    // the "not yet available" state for a beat rather than mislabeling the wrong period's
    // numbers. This applies to SY 25-26 too, now that po can also be sitting on Summer data.
    const _poLiveStats = po ? po.getStats() : null;
    const _pearlPeriodMatches = !!(_poLiveStats && _poLiveStats.activePeriod === execPeriod && _poLiveStats.loaded);
    if (po && !_pearlPeriodMatches && (execPeriod === 'sy2526' || execPeriod === 'summer2026') && typeof po.setPeriod === 'function') {
      po.setPeriod(execPeriod);
    }
    const _pearlForPeriod = _pearlPeriodMatches;
    // Show the footprint tile section immediately for SY 25-26 (original behavior —
    // values render as "—" via fv()/fc() during the brief window before po finishes
    // its first load). For Summer, wait for a confirmed period match so we never
    // flash SY numbers mislabeled as Summer (or vice versa).
    const _showFootprintTiles = execPeriod === 'sy2526' || _pearlPeriodMatches;
    // Scholar tiers / school leaderboard / race demographics / iReady academic data
    // are SY 25-26-only builds for now — not yet computed for Summer, so these stay
    // gated to sy2526 specifically (in addition to matching po's live period).
    const _pearlDeepAvailable = execPeriod === 'sy2526' && _pearlPeriodMatches;
    const poStats = _pearlForPeriod    ? _poLiveStats           : null;
    const ldData  = (_pearlDeepAvailable && po)   ? po.getLeadershipData() : null;
    const stellar = (_pearlDeepAvailable && po)   ? po.getStellarSchools() : null;
    const raceRaw = (_pearlDeepAvailable && po)   ? po.getRaceData()       : null;
    const irl     = (!_isLive && irlb) ? irlb.getSummary('ALL') : null;

    // ── SY Drill-down state (persisted on el dataset) ─────────────────
    // Available SYs from iReady corpus
    const irlYears = (irl && irl.allYears) ? irl.allYears.filter(y=>y) : [];
    const _selSY   = el.dataset.selectedSY || '';  // '' = all-years / program-wide
    // Build filtered iReady summary for selected SY
    function _irlForSY(sy) {
      if (!irlb || typeof irlb.getSummary !== 'function') return null;
      // Pass 'ALL' to getSummary for program-wide all-years view (no activeSY filter)
      try { return irlb.getSummary(sy || 'ALL'); } catch(e) { return irl; }
    }
    const irlView = _irlForSY(_selSY); // what we display

    // ── Helpers ───────────────────────────────────────────────────────
    const fv  = (v, suf='') => (v == null || v === '' || (typeof v==='number' && isNaN(v))) ? '\u2014' : (v + suf);
    const fp  = v => (v == null || isNaN(v)) ? '\u2014' : Math.round(v) + '%';
    const fc  = v => (v == null || isNaN(v)) ? '\u2014' : Number(v).toLocaleString();
    // Scholar benchmark: 80% (program standard). Tutor benchmark: 90%.
    const scholAttCls = v => v >= 80 ? 'c-g' : v >= 70 ? 'c-a' : v > 0 ? 'c-r' : 'c-x';
    const tutAttCls   = v => v >= 90 ? 'c-g' : v >= 80 ? 'c-a' : v > 0 ? 'c-r' : 'c-x';
    const att = scholAttCls; // legacy alias used by other non-attendance calcs
    const fmins = m => { if (!m) return '\u2014'; if (m >= 1000) return (m/1000).toFixed(1)+'K min'; return fc(Math.round(m))+' min'; };

    // ── 1. Program Footprint ──────────────────────────────────────────
    // Active Tutors: sourced from HR_EMPS (authoritative employee roster) not Pearl personMap.
    // Only read HR_EMPS after live HR data has been fetched — prevents showing stale embedded snapshot count.
    const hrActiveTutors = (window._hrDataFetched && typeof HR_EMPS !== 'undefined' && HR_EMPS.length)
      ? HR_EMPS.filter(function(e){ return e.s === 'Active'; }).length
      : null;
    // For live periods: staff/districts/schools come from SY Analytics tracker stats (period-specific).
    // For SY 25-26: staff from HR Master List, districts/schools from Pearl + SYA.
    // Summer 2026: "Active Onsite Staff" here means active per Pearl (>=1 completed
    // session), sourced from _syaStats.staffActive — distinct from SY 26-27's tracker
    // headcount and from SY 25-26's HR Master List path below, both unchanged.
    const tutors = _isLive
      ? (execPeriod === 'summer2026' && _syaStats && _syaStats.staffActive != null
          ? _syaStats.staffActive
          : (_syaStats ? _syaStats.staff : null))
      : (hrActiveTutors != null ? hrActiveTutors : (poStats ? poStats.activeTutors : null));
    const _pearlScholars = poStats ? poStats.activeScholars : null;
    const activeScholars   = _pearlScholars != null ? _pearlScholars : (ldData ? (ldData.scholarsServed || ldData.activeScholars) : null);
    const rosteredScholars = poStats ? poStats.rosteredScholars : (ldData ? ldData.rosteredScholars : null);
    const districts = _isLive
      ? (_syaStats ? _syaStats.districts : null)
      : (ldData ? (ldData.districts ? ldData.districts.length : null) : (poStats ? poStats.districtCount : null));
    // Schools: sourced from SY Analytics cached stats (period-aware, breaks DOM coupling with syStatSites).
    // Falls back to Pearl schoolCount only if SYA stats not yet cached for this period.
    const schools = (_syaStats && _syaStats.sites != null)
      ? _syaStats.sites
      : (poStats ? poStats.schoolCount : null);
    const sessions  = ldData  ? ldData.sessionsDelivered : (poStats ? poStats.sessions : null);
    const siCount   = poStats ? poStats.siCount       : null;
    const totalMins       = poStats ? poStats.totalMins       : null;
    // Aggregate scholar tutored minutes: sum of each scholar's individual session minutes (all time).
    // Differs from totalMins — each session's duration is counted once per scholar present in that session.
    const totalScholarMins = poStats ? (poStats.totalScholarMins || null) : null;
    const survAvg   = ldData  ? ldData.scholarSurvey  : (poStats ? poStats.surveyAvg : null);

    // ── 2. Operational Health ─────────────────────────────────────────
    const scholAtt = ldData ? ldData.scholarRate : (poStats ? poStats.scholAttPct : null);
    const tutorAtt = ldData ? ldData.tutorRate   : (poStats ? poStats.instAttPct  : null);
    const tierOn   = ldData ? (ldData.scholarOnTrack    || 0) : 0;
    const tierRisk = ldData ? (ldData.scholarAtRisk      || 0) : 0;
    const tierAct  = ldData ? (ldData.scholarNeedsAction || 0) : 0;
    const scholPct = scholAtt != null ? Math.min(100, Math.round(scholAtt)) : 0;
    const tutPct   = tutorAtt != null ? Math.min(100, Math.round(tutorAtt)) : 0;

    // ── 3. Academic Impact — SY-aware ────────────────────────────────
    // Cycle (diagnostic window) drill-down state
    const _selCycle = el.dataset.selectedCycle || ''; // '' = all cycles
    // Median % of Typical Growth calculation:
    //   - Source: iReady Longitudinal CSV, column "Spring pct progress typical growth"
    //   - pctTypical (spring_pct_progress_typical_growth) is pre-computed by iReady — valid for all rows
    //   - When a specific SY is selected: mathMedianPctTypical (median of that SY's values)
    //   - When "All Years" is selected: mathMedianPctAllYears (median across all embedded SYs)
    //   - Formula: median(scholar_spring_scale_score / annual_typical_growth_measure) × 100
    //   - 100% = exactly typical growth; >100% = above typical; <100% = below typical
    const _mPctAll  = irlView ? irlView.mathMedianPctAllYears  : null;
    const _mPctTyp  = irlView ? irlView.mathMedianPctTypical   : null;
    const _ePctAll  = irlView ? irlView.elaMedianPctAllYears   : null;
    const _ePctTyp  = irlView ? irlView.elaMedianPctTypical    : null;
    // Use SY-filtered median when a year is active; use program-wide all-years median otherwise
    const mathPct   = _selSY ? (_mPctTyp != null ? _mPctTyp : _mPctAll) : (_mPctAll != null ? _mPctAll : _mPctTyp);
    const elaPct    = _selSY ? (_ePctTyp != null ? _ePctTyp : _ePctAll) : (_ePctAll != null ? _ePctAll : _ePctTyp);
    // Data source label for transparency
    const _dataSource = irlView ? (irlView.dataSource || 'iReady Longitudinal CSV') : 'iReady Longitudinal CSV';
    const mathGain  = irlView ? irlView.mathAvgGain  : null;
    const elaGain   = irlView ? irlView.elaAvgGain   : null;
    // Row counts: use mathRows/elaRows (main sheet only = "All Scholar: Diagnostic Count").
    // mathGainN/elaGainN are inflated because they come from the combined main+repeat loop;
    // mathRows is now correctly set to IRLAB_DATA.math.length (main sheet only).
    const mathN     = irlView ? irlView.mathRows : null;
    const elaN      = irlView ? irlView.elaRows  : null;
    const irlSY     = irlView ? (irlView.activeSY || null) : null;
    const mathBar   = mathPct != null ? Math.min(100, Math.round(mathPct/150*100)) : 0;
    const elaBar    = elaPct  != null ? Math.min(100, Math.round(elaPct /150*100)) : 0;
    const hasAcad   = mathPct != null || elaPct != null;

    // ── 4. School Leaderboard ─────────────────────────────────────────
    const topSchools = (stellar && stellar.length) ? stellar.slice(0,6) : [];

    // ── 5. KPI Status ─────────────────────────────────────────────────
    const _kpiHasEOY = (KPI_DATA||[]).some(k=>k.endStatus && k.endStatus.trim());
    const gS   = k => (_kpiHasEOY ? (k.endStatus || k.midStatus) : (k.midStatus || k.status)) || '';
    const kMet  = KPI_DATA.filter(k=>gS(k)==='Met').length;
    const kProg = KPI_DATA.filter(k=>gS(k)==='In Progress').length;
    const kPart = KPI_DATA.filter(k=>gS(k)==='Partially Met').length;
    const kNot  = KPI_DATA.filter(k=>gS(k)==='Has Not Met').length;
    const kPipe = KPI_DATA.filter(k=>gS(k)==='Coming Down the Pipeline').length;

    // ── 6. Talent Risk ────────────────────────────────────────────────
    const concerns = (typeof CONCERNS !== 'undefined' && Array.isArray(CONCERNS)) ? CONCERNS : [];
    const cTotal   = concerns.length;
    const cDists   = new Set(concerns.map(c=>(c&&c.site||'').split('-')[0].trim()).filter(Boolean)).size;

    // ── 7. Race Analytics ─────────────────────────────────────────────
    const raceMap  = (raceRaw && raceRaw.byScholar) ? raceRaw.byScholar : null;
    const raceTot  = raceMap ? Object.values(raceMap).reduce((a,b)=>a+b,0) : 0;
    // Sort top 5 by count
    const raceRows = raceMap
      ? Object.entries(raceMap).filter(([k])=>k&&k!=='Not Specified'&&k!=='Not Provided').sort((a,b)=>b[1]-a[1]).slice(0,5)
      : [];

    // ── Medal / helpers ───────────────────────────────────────────────
    const medal = i => i===0?'m1':i===1?'m2':i===2?'m3':'mx';
    const nowStr = new Date().toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'});

    // ── SY pill bar HTML ─────────────────────────────────────────────
    const syPills = irlYears.length ? `
      <div class="ecd-sy-bar">
        <span class="ecd-sy-lbl">School Year:</span>
        <button class="ecd-sy-pill${!_selSY?' active':''}" onclick="document.getElementById('execDashboard').dataset.selectedSY='';window._execDashRefresh&&window._execDashRefresh(true)">All Years</button>
        ${irlYears.map(sy=>`<button class="ecd-sy-pill${_selSY===sy?' active':''}" onclick="document.getElementById('execDashboard').dataset.selectedSY='${sy}';window._execDashRefresh&&window._execDashRefresh(true)">${sy}</button>`).join('')}
      </div>` : '';
    // Note: Cycle filter is informational — iReady methodology counts only scholars with a completed
    // spring diagnostic. pctTypical is pre-computed by iReady for all rows with a spring window.
    // only those with a spring score contribute to % of Typical Growth calculations.

    // ── Time breakdown popover helper ─────────────────────────────────────────
    // Toggle visibility of a time-breakdown popover; closes the other if open.
    window._njtcTimePop = function(id) {
      ['ecdTmBrk1','ecdTmBrk2'].forEach(function(pid) {
        var el = document.getElementById(pid);
        if (!el) return;
        if (pid === id) { el.style.display = el.style.display === 'none' ? 'flex' : 'none'; }
        else { el.style.display = 'none'; }
      });
    };
    // Close any open time popover when clicking elsewhere
    document.onclick = (function(_prev) { return function(e) {
      if (!e.target.closest || !e.target.closest('[data-timepop]')) {
        ['ecdTmBrk1','ecdTmBrk2'].forEach(function(pid) { var el=document.getElementById(pid); if(el) el.style.display='none'; });
      }
      if (_prev) _prev(e);
    }; })(document.onclick);

    // Pre-compute breakdown rows for each time metric
    function _minsBreakdownHTML(m) {
      if (!m) return '';
      var mins = Math.round(m);
      var h = Math.floor(mins / 60), r = mins % 60;
      var schoolDays = Math.round(mins / 390);           // 6.5h school day = 390 min
      var months     = (mins / 60 / 6.5 / 20).toFixed(1); // 20 school days/month
      return '<div style="font-size:.6rem;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:#94a3b8;padding-bottom:.4rem;border-bottom:1px solid #f1f5f9;margin-bottom:.1rem">⏱ Time Breakdown</div>'
        + '<div style="display:flex;justify-content:space-between;gap:2rem"><span style="color:#64748b">Minutes</span><strong>' + mins.toLocaleString() + ' min</strong></div>'
        + '<div style="display:flex;justify-content:space-between;gap:2rem"><span style="color:#64748b">Hours</span><strong>' + h.toLocaleString() + 'h' + (r > 0 ? ' ' + r + 'm' : '') + '</strong></div>'
        + '<div style="display:flex;justify-content:space-between;gap:2rem"><span style="color:#64748b">School days (~6.5h)</span><strong>~' + schoolDays.toLocaleString() + '</strong></div>'
        + '<div style="display:flex;justify-content:space-between;gap:2rem"><span style="color:#64748b">Months (~20 school days)</span><strong>~' + months + '</strong></div>';
    }
    var _tmBrkHTML  = totalMins       ? _minsBreakdownHTML(totalMins)       : '';
    var _tsmBrkHTML = totalScholarMins ? _minsBreakdownHTML(totalScholarMins) : '';

    // ── Executive Insight Panel ────────────────────────────────────────────────
    var im = (irlb && typeof irlb.getInsightMetrics === 'function')
      ? irlb.getInsightMetrics(_selSY)
      : null;

    // Store latest metrics globally so the drilldown modal can access them
    window._njtcIM = im;

    // ── Insight drilldown modal ──────────────────────────────────────────────
    // Defined at module level below so it's always available regardless of which
    // dept view is active when the iReady KPI tiles are clicked.

    el.innerHTML = `<div class="ecd-main-col">
      <!-- ═══ HEADER ═══ -->
      <div class="ecd-header">
        <div style="flex:1">
          <div class="ecd-header-title">Executive Command Center</div>
          <div class="ecd-header-sub">${_periodLong} · ${nowStr}</div>
          <div style="display:flex;gap:.3rem;margin-top:.5rem;flex-wrap:wrap">
            <button onclick="document.getElementById('execDashboard').dataset.execPeriod='sy2526';window._execDashRefresh&&window._execDashRefresh(true)" style="font-size:.65rem;font-weight:700;padding:.2rem .65rem;border-radius:20px;border:1px solid ${execPeriod==='sy2526'?'#003087':'#dde3ec'};background:${execPeriod==='sy2526'?'#003087':'#f0f4fa'};color:${execPeriod==='sy2526'?'#fff':'#475569'};cursor:pointer">📁 SY 25-26</button>
            <button onclick="(function(){document.getElementById('execDashboard').dataset.execPeriod='summer2026';if(!(window._syaStats&&window._syaStats['summer2026'])){window.sya&&window.sya.fetchOnsiteTracker&&window.sya.fetchOnsiteTracker();}window._execDashRefresh&&window._execDashRefresh(true);})()" style="font-size:.65rem;font-weight:700;padding:.2rem .65rem;border-radius:20px;border:1px solid ${execPeriod==='summer2026'?'#d97706':'#dde3ec'};background:${execPeriod==='summer2026'?'#fef3c7':'#f0f4fa'};color:${execPeriod==='summer2026'?'#d97706':'#475569'};cursor:pointer">☀️ Summer 2026</button>
            <button onclick="document.getElementById('execDashboard').dataset.execPeriod='sy2627';window._execDashRefresh&&window._execDashRefresh(true)" style="font-size:.65rem;font-weight:700;padding:.2rem .65rem;border-radius:20px;border:1px solid ${execPeriod==='sy2627'?'#059669':'#dde3ec'};background:${execPeriod==='sy2627'?'#dcfce7':'#f0f4fa'};color:${execPeriod==='sy2627'?'#059669':'#475569'};cursor:pointer">🎓 SY 26-27</button>
          </div>
        </div>
        <div style="display:flex;align-items:center;gap:.625rem;flex-wrap:wrap">
          <span style="font-size:.6rem;background:#f0f4fa;color:#475569;border:1px solid #dde3ec;border-radius:20px;padding:.2rem .625rem;font-weight:600">${_dataSource}</span>
          <button onclick="(function(){if(window.po&&window.po.refresh)window.po.refresh(true);if(window.irlab&&window.irlab.fetchLive)window.irlab.fetchLive(true).catch(function(){});setTimeout(function(){window._execDashRefresh&&window._execDashRefresh(true);},1200);})()" title="Refresh all live data sources" style="display:flex;align-items:center;gap:.35rem;background:linear-gradient(135deg,#003087,#0050c8);color:#fff;border:none;border-radius:8px;padding:.4rem .875rem;font-size:.75rem;font-weight:700;cursor:pointer;letter-spacing:.01em;box-shadow:0 2px 8px rgba(0,48,135,.2)">↺ Refresh</button>
          <div class="ecd-header-badge">Leadership View</div>
        </div>
      </div>

      <!-- ═══ 1. PROGRAM FOOTPRINT ═══ -->
      <div class="ecd-divider"><div class="ecd-divider-txt">Program Footprint</div><div class="ecd-divider-line"></div></div>
      <div class="ecd-hero">
        <div class="ecd-kpi ck-navy" title="${_isLive ? 'Active Onsite Staff: SY Analytics tracker count for this period.' : 'Active Onsite Staff: Count of employees with Active status in HR Master List. Sourced from live HR data — click ⟳ to force-sync immediately after updating the Google Sheet.'}" style="position:relative">
          <div class="ecd-kpi-lbl">Active Onsite Staff</div>
          <div class="ecd-kpi-val">${fv(tutors)}</div>
          <div class="ecd-kpi-foot">${execPeriod === 'summer2026' && _syaStats && _syaStats.staffActive != null ? 'Pearl · Attended ≥1 session' : (_isLive ? 'SY Analytics · ' + (execPeriod === 'summer2026' ? 'Summer tracker' : 'SY 26-27 tracker') : 'Active FT staff · HR Master List')}</div>
          ${!_isLive ? `<button onclick="(function(btn){btn.disabled=true;btn.textContent='…';var k='njtc_hr_live_v2';try{localStorage.removeItem(k);}catch(e){}if(typeof window.fetchLiveHRData==='function'){window.fetchLiveHRData(true).then(function(){btn.textContent='⟳';btn.disabled=false;}).catch(function(){btn.textContent='⟳';btn.disabled=false;});}else{btn.textContent='⟳';btn.disabled=false;}})(this)" title="Clear HR cache and sync live data now" style="position:absolute;top:6px;right:6px;background:rgba(255,255,255,.18);border:1px solid rgba(255,255,255,.35);border-radius:5px;color:#fff;font-size:.7rem;padding:2px 6px;cursor:pointer;line-height:1.4">⟳</button>` : ''}
        </div>
        <div class="ecd-kpi ck-gold" title="Districts: ${_isLive ? 'Unique districts from SY Analytics tracker for this period.' : 'Count of unique partner districts derived from Pearl Operations attendance records.'}">
          <div class="ecd-kpi-lbl">Districts</div>
          <div class="ecd-kpi-val">${fv(districts)}</div>
          <div class="ecd-kpi-foot">${_isLive ? 'SY Analytics · Partner districts' : 'Partner districts'}</div>
        </div>
        <div class="ecd-kpi ck-blue" title="Schools: Total active sites from SY Analytics for this period.">
          <div class="ecd-kpi-lbl">Schools</div>
          <div class="ecd-kpi-val">${fv(schools)}</div>
          <div class="ecd-kpi-foot">Active sites · SY Analytics</div>
        </div>
        ${_showFootprintTiles ? `
        <div class="ecd-kpi ck-green" title="Sessions Delivered: Total session records from Pearl Sessions tab. Counts all completed sessions (full and partial).">
          <div class="ecd-kpi-lbl">Sessions</div>
          <div class="ecd-kpi-val sm">${sessions != null ? fc(sessions) : '—'}</div>
          <div class="ecd-kpi-foot">Total delivered</div>
        </div>
        <div class="ecd-kpi ck-navy" title="Active Scholars: Unique students with at least 1 attended session in Pearl Operations. Live from Pearl data.">
          <div class="ecd-kpi-lbl">Active Scholars</div>
          <div class="ecd-kpi-val">${activeScholars != null ? fc(activeScholars) : '—'}</div>
          <div class="ecd-kpi-foot">Attended ≥1 session</div>
        </div>
        <div class="ecd-kpi ck-blue" title="Rostered Scholars: Unique student IDs from the Pearl Attendance tab — all scholars who appear in Pearl regardless of whether their sessions were delivered or cancelled, and regardless of attendance. Enrollment does not require attending a session. Consistent with the Scholar Demographics n= count below.">
          <div class="ecd-kpi-lbl">Rostered Scholars</div>
          <div class="ecd-kpi-val">${rosteredScholars != null ? fc(rosteredScholars) : '—'}</div>
          <div class="ecd-kpi-foot">Total Pearl enrollment</div>
        </div>
        <div class="ecd-kpi ck-teal" style="${siCount > 0 ? 'border-color:#f97316' : ''}" title="Service Interruptions: Attendance records classified as disruptions NOT caused by scholar absence — e.g. tutor no-shows, site closures, admin cancellations. Excludes scholar-initiated absences. Source: Pearl Ops — same value shown on Pearl Operations dashboard.">
          <div class="ecd-kpi-lbl">Service Interruptions</div>
          <div class="ecd-kpi-val" style="${siCount > 0 ? 'color:#f97316' : 'color:#059669'}">${siCount != null ? siCount : '—'}</div>
          <div class="ecd-kpi-foot">${siCount === 0 ? 'None logged ✓' : 'Logged this period'}</div>
        </div>
        <div class="ecd-kpi ck-rose" data-timepop="1" title="Total Instructional Minutes: Sum of session duration in minutes across all delivered sessions. Sourced from Pearl Operations session data. Click ⓘ for breakdown." style="overflow:visible">
          <div class="ecd-kpi-lbl">Total Minutes</div>
          <div class="ecd-kpi-val sm" style="position:relative">
            ${fmins(totalMins)}${totalMins ? `<button data-timepop="1" onclick="event.stopPropagation();window._njtcTimePop('ecdTmBrk1')" style="font-size:.5rem;background:#eef2ff;color:#3730a3;border:1px solid #c7d2fe;border-radius:99px;padding:.08rem .3rem;cursor:pointer;vertical-align:super;margin-left:.2rem;font-weight:700;line-height:1.3" title="View breakdown in hours, days, months">ⓘ</button><div id="ecdTmBrk1" data-timepop="1" onclick="event.stopPropagation()" style="display:none;position:absolute;left:0;top:calc(100% + .4rem);z-index:600;background:#fff;border:1px solid #e2e8f0;border-radius:10px;box-shadow:0 8px 28px rgba(0,0,0,.14);padding:.75rem 1rem;min-width:230px;flex-direction:column;gap:.32rem;font-size:.77rem;white-space:nowrap">${_tmBrkHTML}</div>` : ''}
          </div>
          <div class="ecd-kpi-foot">Instructional time · ⓘ breakdown</div>
        </div>
        <div class="ecd-kpi ck-green" data-timepop="2" title="Scholar Tutored Minutes: Aggregate total instructional minutes across all scholars — each scholar's individual session minutes summed program-wide. Differs from Total Minutes: a session with multiple scholars is counted once per scholar, so this reflects total scholar contact-time (not total session time). Source: Pearl Sessions, all time. Click ⓘ for breakdown." style="overflow:visible">
          <div class="ecd-kpi-lbl">Scholar Tutored Min</div>
          <div class="ecd-kpi-val sm" style="position:relative">
            ${totalScholarMins != null ? fmins(totalScholarMins) : '—'}${totalScholarMins ? `<button data-timepop="2" onclick="event.stopPropagation();window._njtcTimePop('ecdTmBrk2')" style="font-size:.5rem;background:#eef2ff;color:#3730a3;border:1px solid #c7d2fe;border-radius:99px;padding:.08rem .3rem;cursor:pointer;vertical-align:super;margin-left:.2rem;font-weight:700;line-height:1.3" title="View breakdown in hours, days, months">ⓘ</button><div id="ecdTmBrk2" data-timepop="2" onclick="event.stopPropagation()" style="display:none;position:absolute;left:0;top:calc(100% + .4rem);z-index:600;background:#fff;border:1px solid #e2e8f0;border-radius:10px;box-shadow:0 8px 28px rgba(0,0,0,.14);padding:.75rem 1rem;min-width:230px;flex-direction:column;gap:.32rem;font-size:.77rem;white-space:nowrap">${_tsmBrkHTML}</div>` : ''}
          </div>
          <div class="ecd-kpi-foot">Aggregate contact-time · ⓘ breakdown</div>
        </div>` : `
        <div style="grid-column:1/-1;background:#f8fafc;border:1px dashed #cbd5e1;border-radius:10px;padding:1rem 1.25rem;text-align:center;color:#64748b;font-size:.8rem">
          <strong>Pearl operational data (sessions, scholars, attendance, time)</strong> will appear here once ${execPeriod === 'summer2026' ? 'Summer 2026' : 'SY 26-27'} is underway.<br>
          <span style="font-size:.7rem;color:#94a3b8">This period is tracked in Pearl. New program ID and live sheet will be configured when ready.</span>
        </div>`}
      </div>

      ${_isLive ? `
      <div style="background:#f8fafc;border:1px dashed #cbd5e1;border-radius:12px;padding:1.5rem;text-align:center;color:#64748b;margin-bottom:.75rem">
        <div style="font-size:2rem;margin-bottom:.5rem">🔒</div>
        <div style="font-weight:700;font-size:.875rem;margin-bottom:.35rem">Operational &amp; Academic Data — SY 25-26 Only</div>
        <div style="font-size:.78rem;line-height:1.6;max-width:440px;margin:0 auto">
          Attendance, scholar tiers, school leaderboard, race demographics, and iReady academic data
          are currently available for <strong>SY 25-26</strong> only.<br>
          ${execPeriod === 'summer2026'
            ? 'Summer 2026 operational data will appear here once the summer program is underway and Pearl is configured.'
            : 'SY 26-27 academic data will appear after fall diagnostics are completed.'}
        </div>
      </div>` : `      <!-- ═══ 2. OPERATIONAL HEALTH ═══ -->
      <div class="ecd-divider"><div class="ecd-divider-txt">Operational Health</div><div class="ecd-divider-line"></div></div>
      <div class="ecd-2col">
        <div class="ecd-card">
          <div class="ecd-card-title">Attendance Rates</div>
          <div class="ecd-att-row" title="Scholar Attendance Rate: Attended ÷ (Attended + Absent) × 100. Excludes service interruption records — those are not scholar-caused absences. Benchmark: 80%. Source: Pearl Operations.">
            <div class="ecd-att-lbl">Scholar</div>
            <div class="ecd-att-track"><div class="ecd-att-fill ${scholAttCls(scholAtt||0)}" style="width:${scholPct}%"></div></div>
            <div class="ecd-att-pct">${fp(scholAtt)}</div>
          </div>
          <div class="ecd-att-row" title="Tutor Attendance Rate: Attended ÷ (Attended + Absent) × 100 for Instructor role records. Benchmark: 90%. Source: Pearl Operations.">
            <div class="ecd-att-lbl">Tutor</div>
            <div class="ecd-att-track"><div class="ecd-att-fill ${tutAttCls(tutorAtt||0)}" style="width:${tutPct}%"></div></div>
            <div class="ecd-att-pct">${fp(tutorAtt)}</div>
          </div>
          ${survAvg != null ? `<div class="ecd-survey-row">Survey Avg <strong>${survAvg.toFixed(1)}/5.0</strong>${sessions != null ? ` &nbsp;&middot;&nbsp; ${fc(sessions)} sessions` : ''}${totalMins ? ` &nbsp;&middot;&nbsp; ${fmins(totalMins)}` : ''}</div>` : ''}
        </div>
        <div class="ecd-card">
          <div class="ecd-card-title">Scholar Attendance Tiers <span style="font-size:.6rem;color:#94a3b8;font-weight:500;margin-left:.25rem" title="Tiers are calculated per unique scholar using only true scholar absences (Absent, Declined). Service interruptions (testing, school closures, holidays, tutor vacancies) are excluded — they do not count against scholars. Program benchmark: 80%. On Track ≥80% · At Risk 70–79% · Needs Action <70%.">ⓘ</span></div>
          <div class="ecd-tier">
            <div class="ecd-tier-dot" style="background:#059669"></div>
            <div class="ecd-tier-lbl">On Track (&ge;80%)</div>
            <div class="ecd-tier-n" style="color:#059669">${tierOn}</div>
          </div>
          <div class="ecd-tier">
            <div class="ecd-tier-dot" style="background:#d97706"></div>
            <div class="ecd-tier-lbl">At Risk (70&ndash;79%)</div>
            <div class="ecd-tier-n" style="color:#d97706">${tierRisk}</div>
          </div>
          <div class="ecd-tier">
            <div class="ecd-tier-dot" style="background:#e11d48"></div>
            <div class="ecd-tier-lbl">Needs Action (&lt;70%)</div>
            <div class="ecd-tier-n" style="color:#e11d48">${tierAct}</div>
          </div>
        </div>
      </div>

      <!-- ═══ 3. ACADEMIC IMPACT ═══ -->
      <div class="ecd-divider"><div class="ecd-divider-txt">Academic Impact</div><div class="ecd-divider-line"></div></div>
      ${syPills}
      <div class="ecd-academic">
        <div class="ecd-academic-glow"></div>
        <div class="ecd-academic-inner">
          <div class="ecd-academic-eyebrow" style="display:flex;align-items:center;gap:.5rem;flex-wrap:wrap">
            <span>iReady Diagnostic &mdash; Median % of Typical Growth &middot; ${_selSY || 'All Years (Program-Wide)'}</span>
            <span title="Median % of Typical Growth Definition:&#10;&#10;Formula: median(Spring Pct Progress Typical Growth) × 100&#10;&#10;Source column: 'spring_pct_progress_typical_growth' in iReady Longitudinal CSV&#10;&#10;Inclusion rule: Only scholars with a completed spring diagnostic are included.&#10;&#10;This value reflects scholar growth as a % of iReady's full 30-week annual growth norm.&#10;&#10;Important context: iReady's 100% benchmark assumes a 30-week school year program.&#10;Many NJTC partnerships run shorter programs (4–15 weeks), so values below 100% do&#10;not necessarily indicate underperformance — they often reflect program duration.&#10;&#10;The iReady Analysis Lab shows a Program-Window adjusted view that&#10;rescales this metric to your program's actual median weeks.&#10;&#10;This is the MEDIAN (middle value), not an average, making it robust to outliers." style="background:rgba(255,255,255,.15);border-radius:99px;padding:.15rem .5rem;font-size:.6rem;font-weight:700;cursor:help;border:1px solid rgba(255,255,255,.2)">ⓘ How it's calculated</span>
          </div>
          <div class="ecd-academic-row">
            ${mathPct != null ? `
            <div class="ecd-achip" title="Mathematics Median % of Typical Growth&#10;Source: iReady Longitudinal CSV (Math tab)&#10;Column: spring_pct_progress_typical_growth&#10;n = ${mathN != null ? mathN.toLocaleString() : '?'} scholars with completed spring diagnostic">
              <div class="ecd-achip-subj">Mathematics</div>
              <div class="ecd-achip-pct-row">
                <div class="ecd-achip-pct">${mathPct}</div>
                <div class="ecd-achip-pct-unit">% of Typical</div>
              </div>
              ${mathGain != null ? `<div class="ecd-achip-gain">Avg gain: +${mathGain} pts${mathN != null ? ' &middot; n='+fc(mathN) : ''}</div>` : ''}
              <div class="ecd-achip-track"><div class="ecd-achip-fill math" style="width:${mathBar}%"></div></div>
            </div>` : `<div class="ecd-achip" style="opacity:.35"><div class="ecd-achip-subj">Mathematics</div><div class="ecd-achip-pct" style="font-size:1.5rem">&#8212;</div><div class="ecd-achip-desc" style="color:#94a3b8">Loading&hellip;</div></div>`}
            ${elaPct != null ? `
            <div class="ecd-achip" title="ELA/Reading Median % of Typical Growth&#10;Source: iReady Longitudinal CSV (ELA tab)&#10;Column: spring_pct_progress_typical_growth&#10;n = ${elaN != null ? elaN.toLocaleString() : '?'} scholars with completed spring diagnostic">
              <div class="ecd-achip-subj">ELA / Reading</div>
              <div class="ecd-achip-pct-row">
                <div class="ecd-achip-pct">${elaPct}</div>
                <div class="ecd-achip-pct-unit">% of Typical</div>
              </div>

              ${elaGain != null ? `<div class="ecd-achip-gain">Avg gain: +${elaGain} pts${elaN != null ? ' &middot; n='+fc(elaN) : ''}</div>` : ''}
              <div class="ecd-achip-track"><div class="ecd-achip-fill ela" style="width:${elaBar}%"></div></div>
            </div>` : `<div class="ecd-achip" style="opacity:.35"><div class="ecd-achip-subj">ELA / Reading</div><div class="ecd-achip-pct" style="font-size:1.5rem">&#8212;</div><div class="ecd-achip-desc" style="color:#94a3b8">Loading&hellip;</div></div>`}
          </div>
          <div class="ecd-academic-foot">
            <span>Source: ${_dataSource} &middot; Scholars with completed spring diagnostic only</span>
            ${!hasAcad ? '<span style="color:#fbbf24">\u26a0 iReady data loading &mdash; refresh in a moment</span>' : `<span>${_selSY ? 'SY '+_selSY : 'Program-wide all years'} &middot; ${(mathN||0)+(elaN||0) > 0 ? 'n='+(((mathN||0)+(elaN||0)).toLocaleString())+' records' : ''}</span>`}
          </div>
        </div>
      </div>

      <!-- ═══ 4. SCHOOL LEADERBOARD + RACE ═══ -->
      <div class="ecd-2col" style="margin-top:.75rem">
        ${topSchools.length ? `
        <div class="ecd-card">
          <div class="ecd-card-title">Top Schools &mdash; Scholar Attendance</div>
          ${topSchools.map((s,i)=>`
            <div class="ecd-lb-row">
              <div class="ecd-lb-medal ${medal(i)}">${i+1}</div>
              <div>
                <div class="ecd-lb-name">${s.school||s.name||'&mdash;'}</div>
                ${s.district ? `<span class="ecd-lb-dist">${s.district}</span>` : ''}
              </div>
              <div style="margin-left:auto;text-align:right">
                <div class="ecd-lb-att">${s.attRate != null ? s.attRate+'%' : '&mdash;'}</div>
                ${s.sessions ? `<div class="ecd-lb-sess">${fc(s.sessions)} sess</div>` : ''}
              </div>
            </div>`).join('')}
        </div>` : '<div class="ecd-card"><div class="ecd-card-title">School Leaderboard</div><div style="color:#94a3b8;font-size:.75rem;padding:.5rem 0">Loading Pearl data&hellip;</div></div>'}

        ${raceRows.length ? `
        <div class="ecd-card">
          <div class="ecd-card-title">Scholar Demographics &mdash; Race / Ethnicity</div>
          ${raceRows.map(([race, n])=>{
            const pct = raceTot > 0 ? Math.round(n/raceTot*100) : 0;
            return `
            <div class="ecd-race-row">
              <div class="ecd-race-lbl">${race}</div>
              <div class="ecd-race-track"><div class="ecd-race-fill" style="width:${pct}%"></div></div>
              <div class="ecd-race-pct">${pct}%</div>
              <div class="ecd-race-n">${fc(n)}</div>
            </div>`;
          }).join('')}
          <div class="ecd-race-foot">n=${fc(raceTot)} scholars &middot; Total Pearl enrollment</div>
        </div>` : '<div class="ecd-card"><div class="ecd-card-title">Scholar Demographics</div><div style="color:#94a3b8;font-size:.75rem;padding:.5rem 0">Loading attendance data&hellip;</div></div>'}
      </div>

`}
      <!-- ═══ 5. KPI GOAL TRACKING ═══ -->
      ${!_isLive ? `<div class="ecd-divider"><div class="ecd-divider-txt">KPI Goal Tracking</div><div class="ecd-divider-line"></div></div>
      <div class="ecd-goals">
        <div class="ecd-goal g-met"><div class="ecd-goal-n">${kMet}</div><div class="ecd-goal-lbl">Met</div></div>
        <div class="ecd-goal g-prog"><div class="ecd-goal-n">${kProg}</div><div class="ecd-goal-lbl">In Progress</div></div>
        <div class="ecd-goal g-part"><div class="ecd-goal-n">${kPart}</div><div class="ecd-goal-lbl">Partial</div></div>
        <div class="ecd-goal g-pipe"><div class="ecd-goal-n">${kPipe}</div><div class="ecd-goal-lbl">Pipeline</div></div>
        <div class="ecd-goal g-not"><div class="ecd-goal-n">${kNot}</div><div class="ecd-goal-lbl">Not Met</div></div>
      </div>

      <!-- ═══ 5b. STAFF DIVERSITY ═══ -->
      ${(function(){
        const _hrPool    = (typeof HR_EMPS !== 'undefined' && HR_EMPS.length) ? HR_EMPS : [];
        const _activeP   = _hrPool.filter(e => e.s === 'Active');
        const _withDivP  = _activeP.filter(e => e._race || e._ethnicity);
        if (!_withDivP.length) return '';
        const _tot    = _activeP.length;
        const _withR  = _withDivP.filter(e => e._race && e._race !== '' && !/not listed|prefer not/i.test(e._race||''));
        const _withE  = _withDivP.filter(e => e._ethnicity && e._ethnicity !== '' && !/not listed|prefer not/i.test(e._ethnicity||''));
        const _nw     = _withR.filter(e => (e._race||'').toLowerCase() !== 'white').length;
        const _hisp   = _withE.filter(e => /hispanic|latino/i.test(e._ethnicity||'')).length;
        const _div    = _activeP.filter(e =>
          ((e._race||'').toLowerCase() !== 'white' && e._race && e._race !== '' && !/not listed|prefer not/i.test(e._race||'')) ||
          (/hispanic|latino/i.test(e._ethnicity||''))
        ).length;
        const _divPct  = _tot   ? Math.round(_div/_tot*100)          : 0;
        const _nwPct   = _withR.length ? Math.round(_nw/_withR.length*100)   : 0;
        const _hispPct = _withE.length ? Math.round(_hisp/_withE.length*100) : 0;
        const _rMap = {};
        _withR.forEach(e => { const r = e._race||'Unknown'; _rMap[r] = (_rMap[r]||0)+1; });
        const _rRows = Object.entries(_rMap).sort((a,b)=>b[1]-a[1]).slice(0,6);
        return `<div class="ecd-divider"><div class="ecd-divider-txt">Staff Diversity & Equity</div><div class="ecd-divider-line"></div></div>
<div style="background:#fff;border:1px solid #e8edf4;border-radius:12px;padding:1rem 1.25rem;box-shadow:0 1px 4px rgba(0,0,0,.05);margin-bottom:.75rem">
  <div style="display:flex;gap:.625rem;flex-wrap:wrap;margin-bottom:.75rem;align-items:stretch">
    <div style="background:linear-gradient(135deg,#0a1628,#003087);color:#fff;border-radius:10px;padding:.625rem .875rem;min-width:100px;text-align:center">
      <div style="font-size:1.375rem;font-weight:900;line-height:1;color:#f0a500">${_divPct}%</div>
      <div style="font-size:.58rem;opacity:.75;margin-top:.15rem">Non-White or Hispanic</div>
      <div style="font-size:.55rem;opacity:.45">${_div} of ${_tot} active staff</div>
    </div>
    <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:.625rem .875rem;min-width:100px;text-align:center">
      <div style="font-size:1.375rem;font-weight:900;line-height:1;color:#059669">${_nwPct}%</div>
      <div style="font-size:.58rem;color:#065f46;margin-top:.15rem;font-weight:700">Non-White</div>
      <div style="font-size:.55rem;color:#94a3b8">${_nw} of ${_withR.length}</div>
    </div>
    <div style="background:#fef3c7;border:1px solid #fde68a;border-radius:10px;padding:.625rem .875rem;min-width:100px;text-align:center">
      <div style="font-size:1.375rem;font-weight:900;line-height:1;color:#d97706">${_hispPct}%</div>
      <div style="font-size:.58rem;color:#92400e;margin-top:.15rem;font-weight:700">Hispanic / Latino</div>
      <div style="font-size:.55rem;color:#94a3b8">${_hisp} of ${_withE.length}</div>
    </div>
    ${_rRows.length ? `<div style="display:flex;flex-direction:column;justify-content:center;gap:.3rem;flex:1;min-width:160px;padding:.25rem 0">
      ${_rRows.map(([r,n])=>{const p=_withR.length?Math.round(n/_withR.length*100):0;const isW=(r||'').toLowerCase()==='white';return `<div style="display:flex;align-items:center;gap:.375rem"><div style="font-size:.62rem;color:#1e293b;font-weight:600;width:110px;flex-shrink:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${r}</div><div style="flex:1;height:5px;background:#f1f5f9;border-radius:99px;overflow:hidden"><div style="height:100%;width:${p}%;background:${isW?'#cbd5e1':'#0050c8'};border-radius:99px"></div></div><div style="font-size:.61rem;font-weight:700;color:${isW?'#94a3b8':'#0050c8'};width:26px;text-align:right">${p}%</div></div>`;}).join('')}
    </div>` : ''}
  </div>
  <div style="font-size:.6rem;color:#94a3b8;font-weight:600">Active on-site staff · Live HR sheet · ${_withR.length} of ${_tot} with race data on file</div>
</div>`;
      }())}

      <!-- ═══ 5c. CENTRAL TEAM STAFF DIVERSITY ═══ -->
      ${(function(){
        if (typeof _buildCentralTeamDiversityCard === 'function') {
          return `<div class="ecd-divider"><div class="ecd-divider-txt">Central Team — Staff Diversity</div><div class="ecd-divider-line"></div></div>` + _buildCentralTeamDiversityCard();
        }
        return '';
      }())}

      <!-- ═══ 6. TALENT RISK ═══ -->
      <div class="ecd-divider"><div class="ecd-divider-txt">Talent Risk Intelligence</div><div class="ecd-divider-line"></div></div>
      <div class="ecd-risk">
        <div class="ecd-risk-stat">
          <div class="ecd-risk-n ${cTotal > 10 ? 'hot' : ''}">${cTotal}</div>
          <div class="ecd-risk-lbl">Active Concerns</div>
        </div>
        <div class="ecd-risk-stat">
          <div class="ecd-risk-n">${cDists}</div>
          <div class="ecd-risk-lbl">Sites Affected</div>
        </div>
        <button class="ecd-risk-cta" onclick="showPanel('talent',document.querySelector('[data-panel=talent]'))">
          View Talent Analytics &rarr;
        </button>
      </div>` : ''}
    </div>
    `;
  } // end _buildExecDashboardInner


  function renderLeadershipAnalytics(data) {
    // Leadership Exec Summary — sourced entirely from live CONCERNS + REVIEWS data.
    // No attendance/Pearl data here. This is the talent & performance intelligence view.
    // No individual employee names. Aggregated signals only for executive decision-making.

    if (!data || !data.length) {
      return `<div style="padding:3rem;text-align:center;color:var(--muted)">
        <div style="font-size:1.5rem;margin-bottom:.5rem">📋</div>
        <div style="font-weight:600">No concern records match current filters.</div>
      </div>`;
    }

    const total     = data.length;
    const onWatch   = data.filter(r => r.hr_action === 'On Watch').length;
    const writeUp   = data.filter(r => r.hr_action && r.hr_action.includes('Write Up')).length;
    const pgp       = data.filter(r => r.hr_action === 'PGP').length;
    const term      = data.filter(r => r.hr_action && r.hr_action.includes('Terminat')).length;
    const formal    = writeUp + pgp + term;
    const firstTime = data.filter(r => r.first_time === 'Yes').length;
    const repeated  = data.filter(r => r.first_time === 'No').length;
    const hrEscalated = data.filter(r => r.hr_action && r.hr_action !== 'No' && r.hr_action !== 'On Watch').length;

    // Unique employees with concerns
    const uniqueEmps = [...new Set(data.map(r => r.emp).filter(Boolean))].length;

    // Monthly trend
    const byMonth = {};
    data.forEach(r => { byMonth[r.month] = (byMonth[r.month]||0) + 1; });
    const monthKeys = Object.keys(byMonth).sort((a,b) => {
      const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
      const [ma, ya] = [a.split(' ')[0], a.split(' ')[1]];
      const [mb, yb] = [b.split(' ')[0], b.split(' ')[1]];
      return ya !== yb ? ya - yb : months.indexOf(ma) - months.indexOf(mb);
    });
    const lastMo  = monthKeys[monthKeys.length - 1];
    const prevMo  = monthKeys[monthKeys.length - 2];
    const mTrend  = (prevMo && byMonth[prevMo] > 0)
      ? Math.round((byMonth[lastMo] - byMonth[prevMo]) / byMonth[prevMo] * 100) : 0;
    const trendDir   = mTrend > 15 ? '▲' : mTrend < -15 ? '▼' : '→';
    const trendColor = mTrend > 15 ? '#dc2626' : mTrend < -15 ? '#16a34a' : '#64748b';
    const trendLabel = mTrend > 15 ? `Up ${mTrend}% vs prior month — review recommended`
                     : mTrend < -15 ? `Down ${Math.abs(mTrend)}% vs prior month — positive signal`
                     : 'Volume stable month-over-month';

    // Concern type breakdown
    const byConcern  = {};
    data.forEach(r => {
      const k = r.concern_type === 'Other (please explain below)' ? 'Other / Site-Specific' : (r.concern_type || 'Unknown');
      byConcern[k] = (byConcern[k]||0) + 1;
    });
    const concernRows = Object.entries(byConcern).sort((a,b)=>b[1]-a[1]);
    const maxConcern  = concernRows[0]?.[1] || 1;

    // District heat — concern volume per district
    const byDistrict = {};
    data.forEach(r => { byDistrict[r.site] = (byDistrict[r.site]||0) + 1; });
    const distRows = Object.entries(byDistrict).sort((a,b)=>b[1]-a[1]).slice(0,8);
    const maxDist  = distRows[0]?.[1] || 1;

    // Support type breakdown
    const bySupport = {};
    data.forEach(r => {
      let k = (r.support_type||'Other');
      if (k.includes('Warning/Write')) k = 'Warning / Write-Up';
      else if (k.includes('Verbal Warning') || k.includes('Reminder')) k = 'Verbal Warning / Reminder';
      else if (k.includes('Coaching')) k = 'Coaching Support';
      else if (k.includes('Observation')) k = 'Observation';
      else if (k.includes('Additional Coaching')) k = 'Coaching Support';
      else k = 'Other';
      bySupport[k] = (bySupport[k]||0) + 1;
    });
    const supportRows = Object.entries(bySupport).sort((a,b)=>b[1]-a[1]);
    const maxSupport  = supportRows[0]?.[1] || 1;

    // Site Leader Review stats
    const revTotal    = REVIEWS.length;
    const revMeets    = REVIEWS.filter(r => r.d1.includes('Meets') && r.d23.includes('Meets') && r.d4.includes('Meets') && !r.d1.includes('Partial') && !r.d23.includes('Partial') && !r.d4.includes('Partial')).length;
    const revPartial  = REVIEWS.filter(r => r.d1.includes('Partially') || r.d23.includes('Partially') || r.d4.includes('Partially')).length;
    const revSites    = [...new Set(REVIEWS.map(r => r.site))].length;
    const d23Partial  = REVIEWS.filter(r => r.d23.includes('Partially')).length;

    // Executive briefing — auto-generated action items
    const briefs = [];
    if (term > 0)          briefs.push({ sev:'critical', icon:'📋', text:`${term} termination-level action${term>1?'s':''} on record — confirm HR closure and documentation are complete.` });
    if (pgp > 0)           briefs.push({ sev:'critical', icon:'🌱', text:`${pgp} employee${pgp>1?'s are':' is'} on a Performance Growth Plan — track milestone progress and provide continued support.` });
    if (writeUp > 0)       briefs.push({ sev:'warning',  icon:'⚠️', text:`${writeUp} formal write-up${writeUp>1?'s':''} issued this period. Ensure all are documented in personnel files.` });
    if (onWatch > 5)       briefs.push({ sev:'warning',  icon:'👁', text:`${onWatch} employees currently On Watch — elevated separation risk. HR + Programming alignment recommended.` });
    if (repeated/total>0.4) briefs.push({ sev:'warning', icon:'🔁', text:`${Math.round(repeated/total*100)}% of concern records are repeat occurrences for the same employee — systemic intervention may be needed.` });
    if (mTrend > 15)       briefs.push({ sev:'warning',  icon:'📈', text:`Concern volume is up ${mTrend}% this month vs. last. Review whether this reflects a new site issue or data catch-up.` });
    if (d23Partial > 0)    briefs.push({ sev:'info',     icon:'🎯', text:`${d23Partial} site leader${d23Partial>1?'s':''} rated "Partially Meets" in Instruction (Domain 2&3) — targeted coaching or PD deployment recommended.` });
    if (mTrend < -15)      briefs.push({ sev:'info',     icon:'✅', text:`Concern volume is trending down ${Math.abs(mTrend)}% vs. last month — positive signal. Continue monitoring.` });
    if (!briefs.length)    briefs.push({ sev:'info',     icon:'✅', text:`No workforce concerns flagged in the current filter window. Program is operating well.` });

    const sevColor = s => s==='critical'?'#fef2f2':s==='warning'?'#fffbeb':'#f0fdf4';
    const sevBorder = s => s==='critical'?'#fecaca':s==='warning'?'#fde68a':'#bbf7d0';
    const sevText = s => s==='critical'?'#991b1b':s==='warning'?'#92400e':'#166534';

    // Monthly volume sparkline (last 8 months)
    const sparkMonths = monthKeys.slice(-8);
    const sparkMax = Math.max(...sparkMonths.map(m => byMonth[m]||0), 1);

    return `<div style="padding:.25rem 0">

      <!-- ── KPI STRIP ── -->
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:.75rem;margin-bottom:1.5rem">

        <div style="background:#fff;border:1.5px solid #e2e8f0;border-top:3px solid var(--navy);border-radius:10px;padding:1rem;text-align:center">
          <div style="font-family:'DM Serif Display',serif;font-size:2rem;font-weight:700;color:var(--navy);line-height:1">${total}</div>
          <div style="font-size:.75rem;font-weight:700;color:#334155;margin:.3rem 0 .1rem">Total Concerns</div>
          <div style="font-size:.7rem;color:#64748b">${uniqueEmps} unique employees</div>
        </div>

        <div style="background:#fffbeb;border:1.5px solid #fde68a;border-top:3px solid #d97706;border-radius:10px;padding:1rem;text-align:center">
          <div style="font-family:'DM Serif Display',serif;font-size:2rem;font-weight:700;color:#92400e;line-height:1">${onWatch}</div>
          <div style="font-size:.75rem;font-weight:700;color:#92400e;margin:.3rem 0 .1rem">On Watch</div>
          <div style="font-size:.7rem;color:#92400e">Active monitoring</div>
        </div>

        <div style="background:${formal>3?'#fef2f2':'#f8fafc'};border:1.5px solid ${formal>3?'#fecaca':'#e2e8f0'};border-top:3px solid ${formal>3?'#dc2626':'#94a3b8'};border-radius:10px;padding:1rem;text-align:center">
          <div style="font-family:'DM Serif Display',serif;font-size:2rem;font-weight:700;color:${formal>3?'#991b1b':'#334155'};line-height:1">${formal}</div>
          <div style="font-size:.75rem;font-weight:700;color:${formal>3?'#991b1b':'#334155'};margin:.3rem 0 .1rem">Formal HR Actions</div>
          <div style="font-size:.7rem;color:#64748b">${writeUp} W/U · ${pgp} PGP · ${term} Term</div>
        </div>

        <div style="background:#fff;border:1.5px solid #e2e8f0;border-top:3px solid #e63946;border-radius:10px;padding:1rem;text-align:center">
          <div style="font-family:'DM Serif Display',serif;font-size:2rem;font-weight:700;color:#e63946;line-height:1">${repeated}</div>
          <div style="font-size:.75rem;font-weight:700;color:#334155;margin:.3rem 0 .1rem">Repeat Occurrences</div>
          <div style="font-size:.7rem;color:#64748b">${Math.round(repeated/total*100)}% of all concerns</div>
        </div>

        <div style="background:#fff;border:1.5px solid #e2e8f0;border-top:3px solid #2a9d8f;border-radius:10px;padding:1rem;text-align:center">
          <div style="font-family:'DM Serif Display',serif;font-size:2rem;font-weight:700;color:${revPartial>0?'#92400e':'#2a9d8f'};line-height:1">${revMeets}/${revTotal}</div>
          <div style="font-size:.75rem;font-weight:700;color:#334155;margin:.3rem 0 .1rem">Site Leader Reviews</div>
          <div style="font-size:.7rem;color:#64748b">${revSites} sites · ${revPartial} need coaching</div>
        </div>

      </div>

      <!-- ── TREND BANNER ── -->
      <div style="display:flex;align-items:center;gap:1rem;padding:.875rem 1.125rem;background:#f8fafc;border:1px solid #e2e8f0;border-left:4px solid ${trendColor};border-radius:10px;margin-bottom:1.5rem;flex-wrap:wrap">
        <span style="font-size:1.125rem;font-weight:800;color:${trendColor}">${trendDir}</span>
        <div>
          <div style="font-size:.8125rem;font-weight:700;color:#1e293b">${trendLabel}</div>
          <div style="font-size:.7rem;color:#64748b">${lastMo}: ${byMonth[lastMo]||0} concern${(byMonth[lastMo]||0)!==1?'s':''} logged${prevMo?` · ${prevMo}: ${byMonth[prevMo]||0}`:''}</div>
        </div>
        <div style="margin-left:auto;display:flex;align-items:flex-end;gap:3px;height:32px">
          ${sparkMonths.map(m => {
            const h = Math.max(3, Math.round((byMonth[m]||0)/sparkMax*32));
            const c = m===lastMo?'var(--navy)':'#cbd5e1';
            return `<div title="${m}: ${byMonth[m]||0}" style="width:10px;height:${h}px;background:${c};border-radius:2px 2px 0 0"></div>`;
          }).join('')}
        </div>
      </div>

      <!-- ── TWO-COLUMN: CONCERN TYPES + DISTRICT HEAT ── -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:.875rem;margin-bottom:1.5rem">

        <div style="background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:1.25rem">
          <div style="font-size:.6875rem;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#64748b;margin-bottom:.875rem">📂 Concern Type Breakdown</div>
          ${concernRows.map(([label, cnt]) => `
            <div style="display:flex;align-items:center;gap:.625rem;margin-bottom:.5rem">
              <div style="font-size:.8rem;color:#334155;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${label}">${label}</div>
              <div style="min-width:90px"><div style="height:6px;background:#e2e8f0;border-radius:3px"><div style="height:100%;width:${Math.round(cnt/maxConcern*100)}%;background:var(--navy);border-radius:3px"></div></div></div>
              <div style="font-size:.75rem;font-weight:700;color:var(--navy);min-width:28px;text-align:right">${cnt}</div>
            </div>`).join('')}
        </div>

        <div style="background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:1.25rem">
          <div style="font-size:.6875rem;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#64748b;margin-bottom:.875rem">🏢 District Concern Volume</div>
          ${distRows.map(([site, cnt]) => {
            const escInDist = data.filter(r => r.site===site && r.hr_action && (r.hr_action.includes('Write Up')||r.hr_action==='PGP'||r.hr_action.includes('Terminat'))).length;
            const col = escInDist > 0 ? '#dc2626' : cnt >= 6 ? '#d97706' : '#2a9d8f';
            const flag = escInDist > 0 ? `<span style="font-size:.6rem;font-weight:700;background:#fef2f2;color:#dc2626;border-radius:4px;padding:.1rem .35rem;margin-left:.35rem">ESC</span>` : '';
            return `<div style="display:flex;align-items:center;gap:.625rem;margin-bottom:.5rem">
              <div style="font-size:.8rem;color:#334155;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${site}">${site}${flag}</div>
              <div style="min-width:90px"><div style="height:6px;background:#e2e8f0;border-radius:3px"><div style="height:100%;width:${Math.round(cnt/maxDist*100)}%;background:${col};border-radius:3px"></div></div></div>
              <div style="font-size:.75rem;font-weight:700;color:${col};min-width:28px;text-align:right">${cnt}</div>
            </div>`;
          }).join('')}
          ${Object.keys(byDistrict).length > 8 ? `<div style="font-size:.7rem;color:#94a3b8;margin-top:.25rem">Showing top 8 of ${Object.keys(byDistrict).length} districts</div>` : ''}
        </div>

      </div>

      <!-- ── TWO-COLUMN: SUPPORT TYPE + SITE LEADER REVIEWS ── -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:.875rem;margin-bottom:1.5rem">

        <div style="background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:1.25rem">
          <div style="font-size:.6875rem;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#64748b;margin-bottom:.875rem">🛠 Intervention Type Distribution</div>
          ${supportRows.map(([label, cnt]) => {
            const col = label.includes('Write') ? '#dc2626' : label.includes('Verbal') ? '#d97706' : '#2a9d8f';
            return `<div style="display:flex;align-items:center;gap:.625rem;margin-bottom:.5rem">
              <div style="font-size:.8rem;color:#334155;flex:1">${label}</div>
              <div style="min-width:90px"><div style="height:6px;background:#e2e8f0;border-radius:3px"><div style="height:100%;width:${Math.round(cnt/maxSupport*100)}%;background:${col};border-radius:3px"></div></div></div>
              <div style="font-size:.75rem;font-weight:700;color:${col};min-width:28px;text-align:right">${cnt}</div>
            </div>`;
          }).join('')}
        </div>

        <div style="background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:1.25rem">
          <div style="font-size:.6875rem;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#64748b;margin-bottom:.875rem">⭐ Site Leader Observation Summary</div>
          ${revTotal === 0 ? `<div style="color:#64748b;font-size:.8125rem">No reviews on record for current period.</div>` : `
            <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:.5rem;margin-bottom:.875rem">
              ${['d1','d23','d4'].map((dom, i) => {
                const labels = ['Domain 1\nPlanning','Domain 2&3\nInstruction','Domain 4\nProfessionalism'];
                const meets  = REVIEWS.filter(r => r[dom] && r[dom].includes('Meets') && !r[dom].includes('Partial')).length;
                const part   = REVIEWS.filter(r => r[dom] && r[dom].includes('Partially')).length;
                const pct    = revTotal ? Math.round(meets/revTotal*100) : 0;
                const bg     = pct >= 90 ? '#f0fdf4' : pct >= 70 ? '#fffbeb' : '#fef2f2';
                const vc     = pct >= 90 ? '#166534' : pct >= 70 ? '#92400e' : '#991b1b';
                return `<div style="background:${bg};border-radius:8px;padding:.75rem .5rem;text-align:center">
                  <div style="font-size:1.375rem;font-weight:800;color:${vc}">${pct}%</div>
                  <div style="font-size:.65rem;font-weight:700;color:${vc};white-space:pre-line;line-height:1.3">${labels[i]}</div>
                  ${part>0?`<div style="font-size:.6rem;color:#92400e;margin-top:.2rem">⚠️ ${part} coaching needed</div>`:''}
                </div>`;
              }).join('')}
            </div>
            <div style="font-size:.75rem;color:#64748b">${revTotal} review${revTotal!==1?'s':''} across ${revSites} site${revSites!==1?'s':''} · ${revMeets} fully meeting all standards</div>
            ${revPartial > 0 ? `<div style="margin-top:.5rem;padding:.5rem .75rem;background:#fffbeb;border-radius:6px;font-size:.75rem;color:#92400e">⚠️ ${revPartial} site leader${revPartial>1?'s':''} rated Partially Meets in at least one domain — PD or coaching deployment recommended.</div>` : `<div style="margin-top:.5rem;padding:.5rem .75rem;background:#f0fdf4;border-radius:6px;font-size:.75rem;color:#166534">✅ All reviewed site leaders are meeting expectations across all domains.</div>`}
          `}
        </div>

      </div>

      <!-- ── EXECUTIVE BRIEFING ── -->
      <div style="background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:1.25rem">
        <div style="font-size:.6875rem;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#64748b;margin-bottom:.875rem">📌 Executive Briefing — Action Items</div>
        <div style="display:flex;flex-direction:column;gap:.5rem">
          ${briefs.map(b => `
            <div style="display:flex;align-items:flex-start;gap:.75rem;padding:.75rem 1rem;background:${sevColor(b.sev)};border:1px solid ${sevBorder(b.sev)};border-radius:8px">
              <span style="font-size:1.125rem;line-height:1.2;flex-shrink:0">${b.icon}</span>
              <div style="font-size:.8125rem;line-height:1.55;color:${sevText(b.sev)}">${b.text}</div>
            </div>`).join('')}
        </div>
        <div style="margin-top:.875rem;font-size:.75rem;color:#94a3b8">For individual employee records, HR actions, and full concern logs — see the HR, Programming, or Full Log tabs.</div>
      </div>

    </div>`;
  }

  // ════════════════════════════════════════════════════════════════
  //  DATA DEPT ANALYTICS — Full analytical, year-over-year, raw
  // ════════════════════════════════════════════════════════════════

  // ══════════════════════════════════════════════════════════════
  //  NJTC LEADERSHIP EXPORT MODULE
  // ══════════════════════════════════════════════════════════════
  var _expCurrentMode = 'kb';
  var _expBuilt = { kb: false, leadership: false };

  // ── Helpers ────────────────────────────────────────────────
  function _expGetStatus(k) {
    var hasEOY = (typeof KPI_DATA !== 'undefined' && KPI_DATA) ? KPI_DATA.some(function(x){ return x.endStatus && x.endStatus.trim(); }) : false;
    return (hasEOY ? (k.endStatus || k.midStatus) : (k.midStatus || k.status)) || '';
  }

  function _expScore(k) {
    var s = _expGetStatus(k);
    if (s === 'Met')                          return 1.0;
    if (s === 'Partially Met')                return 0.5;
    if (s === 'In Progress')                  return 0.25;
    if (s === 'Coming Down the Pipeline')     return 0.1;
    if (s === 'Has Not Met')                  return 0.0;
    return 0;
  }

  function _expHealthLabel(pct) {
    if (pct >= 0.85) return { label: 'Healthy',        cls: 'hp-healthy', bar: '#16a34a' };
    if (pct >= 0.65) return { label: 'Watch',          cls: 'hp-watch',   bar: '#d97706' };
    if (pct >= 0.40) return { label: 'Needs Focus',    cls: 'hp-focus',   bar: '#ea580c' };
    return            { label: 'Area of Support',      cls: 'hp-support', bar: '#dc2626' };
  }

  function _expKSP(s) {
    var map = {
      'Met':                        ['ksp-met',     '&#10003; Met'],
      'Partially Met':              ['ksp-partial',  '&#9711; Partial'],
      'In Progress':                ['ksp-prog',     '&#9679; In Progress'],
      'Coming Down the Pipeline':   ['ksp-pipe',     '&#9675; Pipeline'],
      'Has Not Met':                ['ksp-notmet',   '&#10005; Not Met'],
    };
    var d = map[s] || ['ksp-prog', s || '&#8212;'];
    return '<span class="ksp ' + d[0] + '">' + d[1] + '</span>';
  }

  function _expNow() {
    var d = new Date();
    var months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    return months[d.getMonth()] + ' ' + d.getDate() + ', ' + d.getFullYear();
  }

  function _expComputeGoalAreas() {
    var areas = {};
    KPI_DATA.forEach(function(k) {
      var g = k.goal || 'Other';
      if (!areas[g]) areas[g] = { goal: g, items: [], met:0, partial:0, prog:0, pipe:0, notmet:0, total:0 };
      areas[g].items.push(k);
      areas[g].total++;
      var s = _expGetStatus(k);
      if (s === 'Met')                          areas[g].met++;
      else if (s === 'Partially Met')           areas[g].partial++;
      else if (s === 'In Progress')             areas[g].prog++;
      else if (s === 'Coming Down the Pipeline')areas[g].pipe++;
      else if (s === 'Has Not Met')             areas[g].notmet++;
    });
    // Compute weighted health score per area
    Object.keys(areas).forEach(function(g) {
      var a = areas[g];
      if (!a.total) { a.health = 0; return; }
      var sum = 0;
      a.items.forEach(function(k) { sum += _expScore(k); });
      a.health = sum / a.total;
    });
    return areas;
  }

  function _expComputeOrgHealth() {
    if (!KPI_DATA.length) return 0;
    var sum = 0;
    KPI_DATA.forEach(function(k) { sum += _expScore(k); });
    return sum / KPI_DATA.length;
  }

  function _expReportHeader(title, subtitle, mode) {
    var dept = (window.NJTC_SESSION || {}).dept || 'leadership';
    var modeLabel = dept === 'kb' ? 'CEO Executive Brief' : 'Leadership Detail Brief';
    var orgH = _expComputeOrgHealth();
    var hlth = _expHealthLabel(orgH);
    var pct = Math.round(orgH * 100);
    var met = KPI_DATA.filter(function(k){ return _expGetStatus(k)==='Met'; }).length;
    var total = KPI_DATA.length;

    return '<div class="exp-hdr">' +
      '<div class="exp-hdr-njtc">' +
        '<div class="exp-hdr-logo">N</div>' +
        '<div>' +
          '<div class="exp-hdr-org">NJTC</div>' +
          '<div class="exp-hdr-full">New Jersey Tutoring Corps</div>' +
        '</div>' +
      '</div>' +
      '<div class="exp-hdr-title">' + title + '</div>' +
      '<div class="exp-hdr-subtitle">' + subtitle + '</div>' +
      '<div class="exp-hdr-meta">' +
        '<div class="exp-hdr-meta-item"><strong>SY 2025–2026</strong>School Year</div>' +
        '<div class="exp-hdr-meta-item"><strong>' + _expNow() + '</strong>Generated</div>' +
        '<div class="exp-hdr-meta-item"><strong>' + modeLabel + '</strong>Report Type</div>' +
        '<div class="exp-hdr-meta-item"><strong>' + met + ' of ' + total + ' targets</strong>Goals Met</div>' +
      '</div>' +
    '</div>' +
    '<div class="exp-confidence">' +
      '<div>' +
        '<div class="exp-conf-label">Organizational Health Score</div>' +
        '<div style="display:flex;align-items:baseline;gap:.5rem">' +
          '<div class="exp-conf-score">' + pct + '%</div>' +
          '<div class="exp-conf-band">' + hlth.label + '</div>' +
        '</div>' +
      '</div>' +
      '<div class="exp-conf-bar-wrap"><div class="exp-conf-bar-fill" style="width:' + pct + '%;background:' + hlth.bar + '"></div></div>' +
      '<div style="font-size:.7rem;color:rgba(255,255,255,.4);font-family:sans-serif;text-align:right">Weighted composite across<br>all ' + total + ' organizational targets</div>' +
    '</div>';
  }

  function _expReportFooter() {
    return '<div class="exp-footer">' +
      '<div class="exp-footer-l">' +
        '<strong>New Jersey Tutoring Corps — Central Team Portal</strong>' +
        'Data & Evaluation Department &nbsp;·&nbsp; Director of Program Evaluation &amp; Impact' +
      '</div>' +
      '<div class="exp-footer-conf">' +
        'CONFIDENTIAL — For Internal Leadership Use Only<br>Not for External Distribution Without Director Approval' +
      '</div>' +
    '</div>';
  }

  // ── KB MODE: CEO Executive Brief ──────────────────────────
  function _buildKbReport() {
    var areas = _expComputeGoalAreas();
    var orgH = _expComputeOrgHealth();
    var hlth = _expHealthLabel(orgH);
    var pct = Math.round(orgH * 100);

    var met     = KPI_DATA.filter(function(k){ return _expGetStatus(k)==='Met'; }).length;
    var partial = KPI_DATA.filter(function(k){ return _expGetStatus(k)==='Partially Met'; }).length;
    var prog    = KPI_DATA.filter(function(k){ return _expGetStatus(k)==='In Progress'; }).length;
    var pipe    = KPI_DATA.filter(function(k){ return _expGetStatus(k)==='Coming Down the Pipeline'; }).length;
    var notmet  = KPI_DATA.filter(function(k){ return _expGetStatus(k)==='Has Not Met'; }).length;
    var total   = KPI_DATA.length;

    // Momentum items (Met)
    var wins = KPI_DATA.filter(function(k){ return _expGetStatus(k)==='Met'; }).slice(0,4);
    // Attention items (Not Met)
    var attn = KPI_DATA.filter(function(k){ return _expGetStatus(k)==='Has Not Met' || _expGetStatus(k)==='Partially Met'; }).slice(0,4);
    // Goal area health summary
    var areaKeys = Object.keys(areas);
    var healthyAreas = areaKeys.filter(function(g){ return areas[g].health >= 0.85; }).length;
    var watchAreas   = areaKeys.filter(function(g){ return areas[g].health >= 0.65 && areas[g].health < 0.85; }).length;
    var focusAreas   = areaKeys.filter(function(g){ return areas[g].health < 0.65; }).length;

    var html = _expReportHeader(
      'Executive Performance Brief',
      'A summary of NJTC\'s organizational standing for SY 2025–2026 — scholar impact, program momentum, and goal progress across all strategic areas.',
      'kb'
    );

    html += '<div class="exp-body">';

    // ── OPENING NARRATIVE (Sandwich Top) ──
    html += '<div class="exp-section">';
    html += '<div class="exp-slabel">Organizational Standing</div>';
    html += '<p class="exp-narrative">';
    html += 'NJTC is demonstrating <strong>sustained organizational momentum</strong> across SY 2025–2026. ';
    html += 'Of ' + total + ' strategic targets tracked this school year, <strong>' + met + ' have been fully met</strong> — ';
    html += 'with an additional ' + (partial + prog) + ' actively in progress. ';
    html += 'The organization\'s weighted health score of <em>' + pct + '%</em> reflects a <strong>' + hlth.label.toLowerCase() + ' standing</strong> ';
    html += 'across our three strategic pillars: scholar impact, financial sustainability, and organizational infrastructure.';
    html += '</p>';
    html += '<p class="exp-narrative" style="margin-top:.875rem">';
    html += healthyAreas + ' of ' + areaKeys.length + ' goal areas are operating at a <strong>Healthy</strong> threshold. ';
    if (watchAreas > 0) html += watchAreas + ' area' + (watchAreas > 1 ? 's are' : ' is') + ' in a <strong>Watch</strong> position — progressing with areas warranting continued attention. ';
    if (focusAreas > 0) html += focusAreas + ' area' + (focusAreas > 1 ? 's are' : ' is') + ' identified for <strong>focused leadership attention</strong> in the current cycle.';
    html += '</p>';
    html += '</div>';

    // ── KPI STATUS SUMMARY ──
    html += '<div class="exp-section">';
    html += '<div class="exp-section-hdr"><span class="exp-section-icon">&#127919;</span><span class="exp-section-title">Goal Progress at a Glance</span><span class="exp-section-badge">Mid-Year Status</span></div>';
    html += '<div class="exp-stat-row cols-3">';
    html += '<div class="exp-stat-card green"><div class="exp-stat-num">' + met + '</div><div class="exp-stat-label">Targets Met</div><div class="exp-stat-sub">Fully achieved</div></div>';
    html += '<div class="exp-stat-card accent"><div class="exp-stat-num">' + (partial + prog) + '</div><div class="exp-stat-label">In Progress</div><div class="exp-stat-sub">Partial + active</div></div>';
    html += '<div class="exp-stat-card ' + (notmet > 0 ? 'red' : 'gold') + '"><div class="exp-stat-num">' + notmet + '</div><div class="exp-stat-label">Not Yet Met</div><div class="exp-stat-sub">Requires attention</div></div>';
    html += '</div>';
    html += '</div>';

    // ── MOMENTUM SPOTLIGHTS ──
    html += '<div class="exp-section">';
    html += '<div class="exp-section-hdr"><span class="exp-section-icon">&#127775;</span><span class="exp-section-title">Program Spotlights</span></div>';
    html += '<div class="exp-spot-grid">';

    // Wins
    html += '<div class="exp-spot-card momentum">';
    html += '<div class="exp-spot-hdr momentum-txt">&#10003; Where We Are Delivering</div>';
    if (wins.length) {
      wins.forEach(function(k) {
        html += '<div class="exp-spot-item"><span class="exp-spot-item-name">' + k.goal + '</span><br>';
        html += '<span style="font-size:.75rem;color:#374151">' + (k.target||'').substring(0,90) + (k.target && k.target.length > 90 ? '…' : '') + '</span>';
        html += '</div>';
      });
    } else {
      html += '<div class="exp-spot-item" style="color:#64748b">Targets in progress — data populating as cycle advances.</div>';
    }
    html += '</div>';

    // Attention
    html += '<div class="exp-spot-card attention">';
    html += '<div class="exp-spot-hdr attention-txt">&#9888; Areas Warranting Leadership Visibility</div>';
    if (attn.length) {
      attn.forEach(function(k) {
        html += '<div class="exp-spot-item"><span class="exp-spot-item-name">' + k.goal + '</span><br>';
        html += '<span style="font-size:.75rem;color:#374151">' + (k.target||'').substring(0,85) + (k.target && k.target.length > 85 ? '…' : '') + '</span>';
        html += '</div>';
      });
    } else {
      html += '<div class="exp-spot-item" style="color:#64748b">No targets in Not Met status at this time.</div>';
    }
    html += '</div>';
    html += '</div>';
    html += '</div>';

    // ── GOAL AREA OVERVIEW (simplified for CEO) ──
    html += '<div class="exp-section">';
    html += '<div class="exp-section-hdr"><span class="exp-section-icon">&#128200;</span><span class="exp-section-title">Strategic Goal Area Summary</span></div>';
    html += '<table class="exp-table">';
    html += '<thead><tr><th style="width:40%">Goal Area</th><th class="t-count">Total</th><th class="t-count">Met</th><th class="t-count">Active</th><th class="t-health">Health</th></tr></thead>';
    html += '<tbody>';
    areaKeys.forEach(function(g) {
      var a = areas[g];
      var hl = _expHealthLabel(a.health);
      html += '<tr>';
      html += '<td class="t-goal">' + g + '</td>';
      html += '<td class="t-count">' + a.total + '</td>';
      html += '<td class="t-count" style="color:#15803d;font-weight:700">' + a.met + '</td>';
      html += '<td class="t-count" style="color:#2563eb">' + (a.partial + a.prog) + '</td>';
      html += '<td class="t-health"><span class="hp ' + hl.cls + '">' + hl.label + '</span></td>';
      html += '</tr>';
    });
    html += '</tbody></table>';
    html += '</div>';

    // ── FORWARD MOMENTUM (Sandwich Close) ──
    html += '<div class="exp-forward">';
    html += '<div class="exp-forward-title">&#128336; Forward Indicators</div>';

    var forwardItems = [
      { lbl: 'Scholar Impact Trajectory', txt: 'Academic performance data from iReady is actively informing tutoring placements across all program sites. MOY assessment windows position NJTC to demonstrate measurable scholar growth ahead of EOY reporting.' },
      { lbl: 'Program Operational Strength', txt: 'Pearl Operations data reflects consistent session delivery across sites. Attendance monitoring and HIT compliance reviews are ongoing as part of NJTC\'s quality assurance infrastructure.' },
      { lbl: 'Workforce Pipeline', txt: 'Staff onboarding and talent analytics reflect active program operations with ' + (KPI_DATA.filter(function(k){return _expGetStatus(k)==='In Progress';}).length) + ' workforce and infrastructure targets currently in progress toward year-end benchmarks.' },
    ];
    if (pipe > 0) {
      forwardItems.push({ lbl: 'Upcoming Targets (' + pipe + ' in Pipeline)', txt: 'A set of targets are staged for activation in the second half of the school year — strategically sequenced to align with program milestones and reporting cycles.' });
    }
    forwardItems.forEach(function(fi) {
      html += '<div class="exp-forward-item"><strong>' + fi.lbl + ': </strong>' + fi.txt + '</div>';
    });
    html += '</div>';

    // ── CLOSING NARRATIVE ──
    html += '<div style="margin-top:1.5rem">';
    html += '<p class="exp-narrative">';
    html += 'NJTC\'s SY 2025–2026 performance reflects the organization\'s <strong>commitment to evidence-based programming</strong> ';
    html += 'and the strength of its operational infrastructure. The data presented in this brief is drawn live from the NJTC Central Team Portal ';
    html += 'and reflects the most current available information as of the date of this report. ';
    html += 'Goal owners across all departments continue to drive progress toward each target.';
    html += '</p>';
    html += '</div>';

    html += '</div>'; // exp-body
    html += _expReportFooter();
    return html;
  }

  // ── LEADERSHIP MODE: Chief of Staff Detail Brief ──────────
  function _buildLeadershipReport() {
    var areas = _expComputeGoalAreas();
    var orgH = _expComputeOrgHealth();
    var pct = Math.round(orgH * 100);
    var hlth = _expHealthLabel(orgH);

    var met     = KPI_DATA.filter(function(k){ return _expGetStatus(k)==='Met'; }).length;
    var partial = KPI_DATA.filter(function(k){ return _expGetStatus(k)==='Partially Met'; }).length;
    var prog    = KPI_DATA.filter(function(k){ return _expGetStatus(k)==='In Progress'; }).length;
    var pipe    = KPI_DATA.filter(function(k){ return _expGetStatus(k)==='Coming Down the Pipeline'; }).length;
    var notmet  = KPI_DATA.filter(function(k){ return _expGetStatus(k)==='Has Not Met'; }).length;
    var total   = KPI_DATA.length;
    var areaKeys = Object.keys(areas);

    var html = _expReportHeader(
      'Leadership Performance Report',
      'Detailed organizational performance brief for SY 2025–2026 — goal-area breakdown, KPI status, owner accountability, and current standing across all strategic dimensions.',
      'leadership'
    );

    html += '<div class="exp-body">';

    // ── OPENING NARRATIVE ──
    html += '<div class="exp-section">';
    html += '<div class="exp-slabel">Executive Summary</div>';
    html += '<p class="exp-narrative">';
    html += 'Across SY 2025–2026, NJTC\'s leadership team is navigating a <strong>complex and ambitious year</strong> with notable achievement and clear directional progress. ';
    html += 'The organization is actively tracking <strong>' + total + ' strategic targets</strong> across ' + areaKeys.length + ' annual goal areas. ';
    html += 'With <strong>' + met + ' targets fully achieved</strong> at mid-year, ' + partial + ' partially met, and ' + prog + ' actively in progress, ';
    html += 'NJTC\'s operational engine is producing real results while maintaining focus on the areas that require leadership attention.';
    html += '</p>';
    html += '<p class="exp-narrative" style="margin-top:.875rem">';
    html += 'The organization\'s weighted health score of <em>' + pct + '%</em> places NJTC in a <strong>' + hlth.label + '</strong> standing — ';
    html += 'a composite measure that accounts for both fully achieved targets and work that is meaningfully underway. ';
    html += 'This report provides goal-area level detail, accountability mapping, and forward context to support leadership decision-making in the current cycle.';
    html += '</p>';
    html += '</div>';

    // ── FULL STAT GRID ──
    html += '<div class="exp-section">';
    html += '<div class="exp-section-hdr"><span class="exp-section-icon">&#127919;</span><span class="exp-section-title">Mid-Year KPI Status Distribution</span><span class="exp-section-badge">' + total + ' Targets Total</span></div>';
    html += '<div class="exp-stat-row cols-4" style="grid-template-columns:repeat(5,1fr)">';
    html += '<div class="exp-stat-card green"><div class="exp-stat-num">' + met + '</div><div class="exp-stat-label">Met</div><div class="exp-stat-sub">' + Math.round(met/total*100) + '% of targets</div></div>';
    html += '<div class="exp-stat-card accent"><div class="exp-stat-num">' + partial + '</div><div class="exp-stat-label">Partially Met</div><div class="exp-stat-sub">Progress made</div></div>';
    html += '<div class="exp-stat-card" style="border-color:#bfdbfe;background:#eff6ff"><div class="exp-stat-num" style="color:#1d4ed8">' + prog + '</div><div class="exp-stat-label">In Progress</div><div class="exp-stat-sub">Active work</div></div>';
    html += '<div class="exp-stat-card" style="border-color:#ddd6fe;background:#f5f3ff"><div class="exp-stat-num" style="color:#7c3aed">' + pipe + '</div><div class="exp-stat-label">Pipeline</div><div class="exp-stat-sub">Upcoming</div></div>';
    html += '<div class="exp-stat-card ' + (notmet > 0 ? 'red' : 'gold') + '"><div class="exp-stat-num">' + notmet + '</div><div class="exp-stat-label">Not Met</div><div class="exp-stat-sub">Attention needed</div></div>';
    html += '</div>';
    html += '</div>';

    // ── GOAL AREA DETAIL TABLE ──
    html += '<div class="exp-section">';
    html += '<div class="exp-section-hdr"><span class="exp-section-icon">&#128200;</span><span class="exp-section-title">Goal Area Performance Breakdown</span></div>';
    html += '<table class="exp-table">';
    html += '<thead><tr><th style="width:32%">Goal Area</th><th class="t-count">Total</th><th class="t-count">Met</th><th class="t-count">Partial</th><th class="t-count">Active</th><th class="t-count">Not Met</th><th class="t-health">Health</th></tr></thead>';
    html += '<tbody>';
    areaKeys.forEach(function(g) {
      var a = areas[g];
      var hl = _expHealthLabel(a.health);
      html += '<tr>';
      html += '<td class="t-goal">' + g + '</td>';
      html += '<td class="t-count">' + a.total + '</td>';
      html += '<td class="t-count" style="color:#15803d;font-weight:700">' + a.met + '</td>';
      html += '<td class="t-count" style="color:#c2410c">' + a.partial + '</td>';
      html += '<td class="t-count" style="color:#2563eb">' + a.prog + '</td>';
      html += '<td class="t-count" style="color:#dc2626;font-weight:700">' + a.notmet + '</td>';
      html += '<td class="t-health"><span class="hp ' + hl.cls + '">' + hl.label + '</span></td>';
      html += '</tr>';
    });
    html += '</tbody></table>';
    html += '</div>';

    // ── FULL KPI DETAIL by area ──
    html += '<div class="exp-section">';
    html += '<div class="exp-section-hdr"><span class="exp-section-icon">&#128221;</span><span class="exp-section-title">Detailed KPI Standings by Goal Area</span></div>';

    areaKeys.forEach(function(g) {
      var a = areas[g];
      html += '<div style="margin-bottom:1.5rem">';
      html += '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:.5rem">';
      html += '<div style="font-size:.8125rem;font-weight:800;color:#0a1628;font-family:sans-serif;text-transform:uppercase;letter-spacing:.04em">' + g + '</div>';
      var ahl = _expHealthLabel(a.health);
      html += '<span class="hp ' + ahl.cls + '">' + ahl.label + ' &nbsp;' + Math.round(a.health*100) + '%</span>';
      html += '</div>';
      html += '<table class="exp-table" style="font-size:.76rem">';
      html += '<thead><tr><th style="width:52%">Target</th><th>Mid-Year</th><th>EOY</th><th>Owner</th></tr></thead>';
      html += '<tbody>';
      a.items.forEach(function(k) {
        var ms = _expGetStatus(k);
        var es = k.endStatus || '—';
        html += '<tr>';
        html += '<td>' + (k.target || '—') + '</td>';
        html += '<td style="white-space:nowrap">' + _expKSP(ms) + '</td>';
        html += '<td style="white-space:nowrap;color:#64748b;font-size:.72rem">' + (es === 'Pending' || !es || es === '—' ? '<span style="color:#94a3b8">Pending</span>' : _expKSP(es)) + '</td>';
        html += '<td class="t-owner">' + (k.owner || '—') + '</td>';
        html += '</tr>';
      });
      html += '</tbody></table>';
      html += '</div>';
    });
    html += '</div>';

    // ── AREAS REQUIRING ATTENTION ──
    var attnItems = KPI_DATA.filter(function(k){ return _expGetStatus(k)==='Has Not Met' || _expGetStatus(k)==='Partially Met'; });
    if (attnItems.length) {
      html += '<div class="exp-section">';
      html += '<div class="exp-section-hdr"><span class="exp-section-icon">&#9888;</span><span class="exp-section-title">Targets Requiring Leadership Visibility</span><span class="exp-section-badge">' + attnItems.length + ' targets</span></div>';
      html += '<p class="exp-narrative" style="margin-bottom:1rem">';
      html += 'The following targets are currently tracking below threshold. These are surfaced for leadership visibility — ';
      html += 'each reflects an area where organizational attention, resources, or context may be relevant to the current cycle\'s outcome.';
      html += '</p>';
      html += '<table class="exp-table">';
      html += '<thead><tr><th style="width:28%">Goal Area</th><th style="width:42%">Target</th><th>Status</th><th>Owner</th></tr></thead>';
      html += '<tbody>';
      attnItems.forEach(function(k) {
        html += '<tr>';
        html += '<td class="t-goal" style="color:#64748b;font-size:.76rem">' + (k.goal||'—') + '</td>';
        html += '<td style="font-size:.76rem">' + (k.target||'—') + '</td>';
        html += '<td style="white-space:nowrap">' + _expKSP(_expGetStatus(k)) + '</td>';
        html += '<td class="t-owner">' + (k.owner||'—') + '</td>';
        html += '</tr>';
      });
      html += '</tbody></table>';
      html += '</div>';
    }

    // ── PIPELINE TARGETS ──
    var pipeItems = KPI_DATA.filter(function(k){ return _expGetStatus(k)==='Coming Down the Pipeline'; });
    if (pipeItems.length) {
      html += '<div class="exp-section">';
      html += '<div class="exp-section-hdr"><span class="exp-section-icon">&#128336;</span><span class="exp-section-title">Pipeline — Targets Activating This Cycle</span><span class="exp-section-badge">' + pipeItems.length + ' upcoming</span></div>';
      html += '<table class="exp-table" style="font-size:.76rem">';
      html += '<thead><tr><th>Goal Area</th><th>Target</th><th>Owner</th></tr></thead>';
      html += '<tbody>';
      pipeItems.forEach(function(k) {
        html += '<tr><td class="t-goal">' + (k.goal||'—') + '</td><td>' + (k.target||'—') + '</td><td class="t-owner">' + (k.owner||'—') + '</td></tr>';
      });
      html += '</tbody></table>';
      html += '</div>';
    }

    // ── CLOSING NARRATIVE (Sandwich Close) ──
    html += '<div class="exp-forward" style="margin-top:1.75rem">';
    html += '<div class="exp-forward-title">&#128336; EOY Horizon & Forward Context</div>';
    html += '<div class="exp-forward-item"><strong>EOY Status Pending: </strong>End-of-Year statuses for ' + (KPI_DATA.filter(function(k){return !k.endStatus || k.endStatus==='Pending';}).length) + ' targets are pending — final assessments will be completed at program wrap-up (May–June). Current Mid-Year standing reflects the most complete available view.</div>';
    html += '<div class="exp-forward-item"><strong>Academic Impact Window: </strong>iReady EOY diagnostics (April–May) will finalize scholar placement movement data — the primary outcome metric for NJTC\'s impact narrative with funders and partners.</div>';
    html += '<div class="exp-forward-item"><strong>Workforce Cycle: </strong>ADP Suite rehire decisions are staged for EOY finalization following academic data availability. Current talent pipeline positions NJTC for effective program continuity into SY 2026–2027.</div>';
    html += '</div>';

    // Closing
    html += '<div style="margin-top:1.5rem">';
    html += '<p class="exp-narrative">';
    html += 'This report was generated from live data in the NJTC Central Team Portal and reflects mid-year standing across all tracked organizational targets. ';
    html += 'Goal owners across all departments are accountable for final EOY status entries. ';
    html += 'For questions on specific targets, source data, or validation methodology, contact the <strong>Director of Program Evaluation & Impact</strong>.';
    html += '</p>';
    html += '</div>';

    html += '</div>'; // exp-body
    html += _expReportFooter();
    return html;
  }

  // ── Public API ────────────────────────────────────────────
  function expOpen() {
    var dept = (window.NJTC_SESSION || {}).dept || 'leadership';
    var modal = document.getElementById('njtcExportModal');
    if (!modal) return;

    // Determine default mode
    _expCurrentMode = (dept === 'kb') ? 'kb' : 'leadership';

    // Show mode switcher only for leadership (not kb — they see one view)
    var pills = document.getElementById('expModePills');
    if (pills) pills.style.display = (dept === 'leadership') ? 'flex' : 'none';

    // Update toolbar subtitle
    var sub = document.getElementById('expToolbarSub');
    if (sub) {
      sub.textContent = dept === 'kb'
        ? 'CEO Executive Brief  ·  SY 2025–2026'
        : 'Leadership Detail Brief  ·  SY 2025–2026  ·  Chief of Staff View';
    }

    // Build reports
    _expBuildMode('kb');
    if (dept === 'leadership') _expBuildMode('leadership');

    // Set active mode
    expSwitchMode(_expCurrentMode);

    modal.classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  function _expBuildMode(mode) {
    if (_expBuilt[mode]) return;
    var paperId = mode === 'kb' ? 'expPaperKb' : 'expPaperLeadership';
    var paper = document.getElementById(paperId);
    if (!paper) return;
    paper.innerHTML = mode === 'kb' ? _buildKbReport() : _buildLeadershipReport();
    _expBuilt[mode] = true;
  }

  function expSwitchMode(mode) {
    _expCurrentMode = mode;
    var kbPanel = document.getElementById('expPanelKb');
    var ldPanel = document.getElementById('expPanelLeadership');
    var kbPill  = document.getElementById('expPillKb');
    var ldPill  = document.getElementById('expPillLeadership');

    if (kbPanel) { kbPanel.style.display = mode === 'kb' ? 'block' : 'none'; kbPanel.classList.toggle('print-active', mode === 'kb'); }
    if (ldPanel) { ldPanel.style.display = mode === 'leadership' ? 'block' : 'none'; ldPanel.classList.toggle('print-active', mode === 'leadership'); }
    if (kbPill)  kbPill.classList.toggle('active',  mode === 'kb');
    if (ldPill)  ldPill.classList.toggle('active',  mode === 'leadership');

    // Scroll to top
    var modal = document.getElementById('njtcExportModal');
    if (modal) modal.scrollTop = 0;
  }

  function expClose() {
    var modal = document.getElementById('njtcExportModal');
    if (modal) modal.classList.remove('open');
    document.body.style.overflow = '';
  }

  function expPrint() {
    window.print();
  }

  // Force rebuild on next open (e.g. after KPI data refreshes)
  function expInvalidate() {
    _expBuilt.kb = false;
    _expBuilt.leadership = false;
  }

  window.expOpen       = expOpen;
  window.expClose      = expClose;
  window.expPrint      = expPrint;
  window.expSwitchMode = expSwitchMode;
  window.expInvalidate = expInvalidate;

  // ── iReady Academic Insight drilldown modal ──────────────────────────────
  // Defined at module level so it's always available — iReady panel buttons call
  // this from any dept view, not just the leadership exec dashboard.
  window._njtcInsightDrill = function(tab) {
    var d = window._njtcIM;
    if (!d) return;
    var old = document.getElementById('ecdiModal');
    if (old) old.remove();

    function _barCell(val, max, cls) {
      var pct = (max > 0 && val != null) ? Math.min(100, Math.max(0, Math.round(val/max*100))) : 0;
      return '<td class="ecdi-bar-cell"><div class="ecdi-bar-wrap"><div class="ecdi-bar-fill" style="width:'+pct+'%;background:'+(cls||'#0050c8')+'"></div></div></td>';
    }
    function _gainSpan(v) {
      if (v == null) return '—';
      var s = (v>0?'+':'')+v;
      return '<span class="'+(v>0?'ecdi-gain-pos':v<0?'ecdi-gain-neg':'')+'">' +s+'</span>';
    }
    function _fmt1(v) { return v != null ? v.toFixed(1) : '—'; }
    function _fmtPct(v) { return v != null ? Math.round(v)+'%' : '—'; }

    var rows   = d.drillRows || [];
    var _uniq  = function(field) {
      var s={}; rows.forEach(function(r){if(r[field]) s[r[field]]=1;}); return Object.keys(s).sort();
    };
    var selects = [
      { id:'ecdi-f-year',    label:'Year',       field:'year',       vals:_uniq('year')       },
      { id:'ecdi-f-dist',    label:'District',   field:'district',   vals:_uniq('district')   },
      { id:'ecdi-f-school',  label:'School',     field:'school',     vals:_uniq('school')     },
      { id:'ecdi-f-grade',   label:'Grade',      field:'grade',      vals:_uniq('grade')      },
      { id:'ecdi-f-subject', label:'Subject',    field:'subject',    vals:_uniq('subject')    },
      { id:'ecdi-f-race',    label:'Race',       field:'race',       vals:_uniq('race')       },
      { id:'ecdi-f-eth',     label:'Ethnicity',  field:'ethnicity',  vals:_uniq('ethnicity')  },
      { id:'ecdi-f-econ',    label:'Econ Status',field:'econ',       vals:_uniq('econ')       },
    ].filter(function(s){ return s.vals.length > 1; });

    function _sel(s) {
      return '<select id="'+s.id+'" class="ecdi-filter-sel" onchange="window._ecdiApplyFilters()">'
        +'<option value="">'+s.label+' (all)</option>'
        +s.vals.map(function(v){return '<option value="'+v.replace(/"/g,'&quot;')+'">'+v+'</option>';}).join('')
        +'</select>';
    }

    var _ecdiPage = 0, _ecdiPageSize = 50, _ecdiSortCol = 'scaleGain', _ecdiSortAsc = false;
    window._ecdiApplyFilters = function() {
      var filtered = rows.filter(function(r) {
        return selects.every(function(s) {
          var el2 = document.getElementById(s.id);
          var v = el2 ? el2.value : '';
          return !v || r[s.field] === v;
        });
      });
      filtered.sort(function(a,b){
        var av=a[_ecdiSortCol], bv=b[_ecdiSortCol];
        if(av==null&&bv==null) return 0; if(av==null) return 1; if(bv==null) return -1;
        return _ecdiSortAsc ? (av>bv?1:av<bv?-1:0) : (av<bv?1:av>bv?-1:0);
      });
      _ecdiPage = 0;
      window._ecdiFiltered = filtered;
      _ecdiRender();
    };
    window._ecdiSort = function(col) {
      if(_ecdiSortCol===col) _ecdiSortAsc=!_ecdiSortAsc; else {_ecdiSortCol=col;_ecdiSortAsc=false;}
      window._ecdiApplyFilters();
    };
    window._ecdiChangePage = function(dir) {
      var pages = Math.ceil((window._ecdiFiltered||[]).length/_ecdiPageSize);
      _ecdiPage = Math.max(0, Math.min(pages-1, _ecdiPage+dir));
      _ecdiRender();
    };

    function _thSort(col, label) {
      var arr = _ecdiSortCol===col ? (_ecdiSortAsc?' ▲':' ▼') : '';
      return '<th onclick="window._ecdiSort(\''+col+'\')" title="Sort by '+label+'">'+label+arr+'</th>';
    }

    function _ecdiRender() {
      var filtered = window._ecdiFiltered || [];
      var start    = _ecdiPage * _ecdiPageSize;
      var page     = filtered.slice(start, start+_ecdiPageSize);
      var body     = document.getElementById('ecdi-body');
      if (!body) return;
      var rows2 = page.map(function(r){
        return '<tr>'
          +'<td>'+(r.scholarId||'—')+'</td>'
          +'<td>'+(r.district||'—')+'</td>'
          +'<td>'+(r.school||'—')+'</td>'
          +'<td>'+(r.grade||'—')+'</td>'
          +'<td>'+(r.subject||'—')+'</td>'
          +'<td class="num">'+(r.baseScore!=null?r.baseScore:'—')+'</td>'
          +'<td class="num">'+(r.springScore!=null?r.springScore:'—')+'</td>'
          +'<td class="num">'+_gainSpan(r.scaleGain)+'</td>'
          +'<td class="num">'+_fmt1(r.monthsGrowth)+'</td>'
          +'<td class="num">'+_fmtPct(r.pctExpected)+'</td>'
          +'</tr>';
      }).join('');
      body.innerHTML = '<table class="ecdi-tbl"><thead><tr>'
        +_thSort('scholarId','Scholar ID')
        +_thSort('district','District')
        +_thSort('school','School')
        +_thSort('grade','Grade')
        +_thSort('subject','Subject')
        +_thSort('baseScore','Baseline')
        +_thSort('springScore','Spring')
        +_thSort('scaleGain','Scale Gain')
        +_thSort('monthsGrowth','Months')
        +_thSort('pctExpected','% Expected')
        +'</tr></thead><tbody>'+rows2+'</tbody></table>'
        +'<div class="ecdi-paginate">'
        +'<button class="ecdi-pg-btn" onclick="window._ecdiChangePage(-1)" '+(start<=0?'disabled':'')+'>← Prev</button>'
        +'<span>Showing '+(filtered.length?start+1:0)+'–'+Math.min(start+_ecdiPageSize,filtered.length)+' of '+filtered.length.toLocaleString()+' records</span>'
        +'<button class="ecdi-pg-btn" onclick="window._ecdiChangePage(1)" '+(start+_ecdiPageSize>=filtered.length?'disabled':'')+'>Next →</button>'
        +'</div>';
    }

    var _tabs = [
      { id:'growth',   label:'Scholar Growth Detail' },
      { id:'demo',     label:'Demographic Insights'  },
      { id:'district', label:'District Outcomes'     },
      { id:'school',   label:'School Breakdown'      },
      { id:'grade',    label:'Grade Level'           },
      { id:'tutors',   label:'Tutor Contributors'    }
    ];
    var _activeTab = tab || 'growth';

    function _demoTable(groups, title) {
      if (!groups || !groups.length) return '<div style="color:#94a3b8;font-size:.75rem;padding:.5rem 0">No data.</div>';
      var maxGain = Math.max.apply(null, groups.map(function(g){return g.medGain||0;}));
      var rows3 = groups.map(function(g){
        return '<tr>'
          +'<td>'+g.label+'</td>'
          +'<td class="num">'+g.n+'</td>'
          +'<td class="num">'+_gainSpan(g.medGain!=null?parseFloat(g.medGain.toFixed(1)):null)+'</td>'
          +_barCell(g.medGain, maxGain, '#0891b2')
          +'<td class="num">'+_fmt1(g.medMonths)+'</td>'
          +'<td class="num">'+_fmtPct(g.medPct)+'</td>'
          +'</tr>';
      }).join('');
      return '<div style="font-size:.72rem;font-weight:700;color:#0a1628;margin-bottom:.5rem">'+title+'</div>'
        +'<table class="ecdi-tbl" style="margin-bottom:1.25rem"><thead><tr>'
        +'<th>Group</th><th>n</th><th>Median Scale Gain</th><th style="min-width:70px">Bar</th><th>Med. Months</th><th>% Expected</th>'
        +'</tr></thead><tbody>'+rows3+'</tbody></table>';
    }

    function _groupTable(groups, labelCol, color) {
      if (!groups || !groups.length) return '<div style="color:#94a3b8;font-size:.75rem;padding:.5rem 0">No data.</div>';
      var sorted = groups.slice().sort(function(a,b){ return (b.medGain||0)-(a.medGain||0); });
      var maxGain = Math.max.apply(null, sorted.map(function(g){return g.medGain||0;}));
      var rowsHtml = sorted.map(function(g, i){
        return '<tr>'
          +(i<3?'<td style="font-size:.75rem;font-weight:800;color:#f0a500">'+['🥇','🥈','🥉'][i]+'</td>':'<td></td>')
          +'<td>'+g.label+'</td>'
          +'<td class="num">'+g.n+'</td>'
          +'<td class="num">'+_gainSpan(g.medGain!=null?parseFloat(g.medGain.toFixed(1)):null)+'</td>'
          +_barCell(g.medGain, maxGain, color||'#059669')
          +'<td class="num">'+_fmt1(g.medMonths)+'</td>'
          +'<td class="num">'+_fmtPct(g.medPct)+'</td>'
          +'</tr>';
      }).join('');
      return '<table class="ecdi-tbl"><thead><tr>'
        +'<th></th><th>'+labelCol+'</th><th>n</th><th>Median Scale Gain</th><th style="min-width:70px">Bar</th><th>Med. Months</th><th>% Expected</th>'
        +'</tr></thead><tbody>'+rowsHtml+'</tbody></table>';
    }

    function _tutorTable() {
      var groups = d.byTutor||[];
      if (!groups.length) return '<div style="color:#94a3b8;font-size:.75rem;padding:.5rem 0">No tutor data.</div>';
      var hrEmps = window.HR_EMPS || [];
      var sorted = groups.slice().sort(function(a,b){ return (b.medGain||0)-(a.medGain||0); });
      var maxGain = Math.max.apply(null, sorted.map(function(g){return g.medGain||0;}));
      function _certBadge(name) {
        var emp = hrEmps.find(function(e){ return e.n && e.n.toLowerCase() === (name||'').toLowerCase(); });
        if (!emp) return '';
        var isCert = emp._tutorCert === 'Yes' || emp._tutorCert === true || /certified/i.test(emp._tutorCert||'');
        return isCert
          ? '<span style="font-size:.58rem;background:#d1fae5;color:#065f46;padding:.1rem .3rem;border-radius:4px;font-weight:700;margin-left:.3rem">✓ Cert</span>'
          : '<span style="font-size:.58rem;background:#fef3c7;color:#92400e;padding:.1rem .3rem;border-radius:4px;font-weight:600;margin-left:.3rem">Non-Cert</span>';
      }
      var rowsHtml = sorted.map(function(g, i){
        return '<tr>'
          +(i<3?'<td style="font-size:.75rem;font-weight:800;color:#f0a500">'+['🥇','🥈','🥉'][i]+'</td>':'<td></td>')
          +'<td>'+g.label+_certBadge(g.label)+'</td>'
          +'<td class="num">'+g.n+'</td>'
          +'<td class="num">'+_gainSpan(g.medGain!=null?parseFloat(g.medGain.toFixed(1)):null)+'</td>'
          +_barCell(g.medGain, maxGain, '#7c3aed')
          +'<td class="num">'+_fmt1(g.medMonths)+'</td>'
          +'<td class="num">'+_fmtPct(g.medPct)+'</td>'
          +'</tr>';
      }).join('');
      return '<table class="ecdi-tbl"><thead><tr>'
        +'<th></th><th>Tutor</th><th>Scholars</th><th>Median Scale Gain</th><th style="min-width:70px">Bar</th><th>Med. Months</th><th>% Expected</th>'
        +'</tr></thead><tbody>'+rowsHtml+'</tbody></table>';
    }

    function _tabBody() {
      if (_activeTab==='growth')   return '<div id="ecdi-filters-wrap"><div class="ecdi-modal-filters">'+selects.map(_sel).join('')+'</div></div><div class="ecdi-modal-body" id="ecdi-body"></div>';
      if (_activeTab==='demo')     return '<div class="ecdi-modal-body">'+_demoTable(d.byRace||[],'By Race')+_demoTable(d.byEthnicity||[],'By Ethnicity')+_demoTable(d.byEconStatus||[],'By Economic Status')+'</div>';
      if (_activeTab==='district') return '<div class="ecdi-modal-body">'+_groupTable(d.byDistrict||[],'District','#059669')+'</div>';
      if (_activeTab==='school')   return '<div class="ecdi-modal-body">'+_groupTable(d.bySchool||[],'School','#0891b2')+'</div>';
      if (_activeTab==='grade')    return '<div class="ecdi-modal-body">'+_groupTable((d.byGrade||[]).slice().sort(function(a,b){return (a.label||'').localeCompare(b.label||'');}), 'Grade','#d97706')+'</div>';
      if (_activeTab==='tutors')   return '<div class="ecdi-modal-body">'+_tutorTable()+'</div>';
      return '';
    }

    function _switchTab(t) {
      _activeTab = t;
      var mc = document.getElementById('ecdi-modal-content');
      if (mc) mc.innerHTML = _tabBody();
      _tabs.forEach(function(tb){
        var btn = document.getElementById('ecdi-tab-'+tb.id);
        if (btn) btn.className = 'ecdi-tab'+(tb.id===t?' active':'');
      });
      if (t==='growth') window._ecdiApplyFilters();
    }
    window._ecdiSwitchTab = _switchTab;

    var modalHTML = '<div id="ecdiModal" class="ecdi-overlay">'
      +'<div class="ecdi-modal">'
      +'<div class="ecdi-modal-hdr">'
      +'<div><div class="ecdi-modal-title">Academic Insight Drilldown</div>'
      +'<div class="ecdi-modal-sub">iReady diagnostic outcomes · '
      +(d.allYears&&d.allYears.length ? d.allYears.join(', ') : 'All Years')
      +' · '+d.n+' records with growth data</div></div>'
      +'<button class="ecdi-modal-close" onclick="window._ecdiClose()">✕</button>'
      +'</div>'
      +'<div class="ecdi-modal-tabs">'
      +_tabs.map(function(t){
        return '<button id="ecdi-tab-'+t.id+'" class="ecdi-tab'+(t.id===_activeTab?' active':'')+'" onclick="window._ecdiSwitchTab(\''+t.id+'\')">'+t.label+'</button>';
      }).join('')
      +'</div>'
      +'<div id="ecdi-modal-content">'+_tabBody()+'</div>'
      +'</div></div>';

    document.body.insertAdjacentHTML('beforeend', modalHTML);
    requestAnimationFrame(function(){
      var o = document.getElementById('ecdiModal');
      if (o) { o.classList.add('open'); if (tab==='growth') window._ecdiApplyFilters(); }
    });
  };

  window._ecdiClose = function() {
    var o = document.getElementById('ecdiModal');
    if (o) { o.classList.remove('open'); setTimeout(function(){ if(o.parentNode) o.remove(); }, 250); }
  };
  document.addEventListener('click', function(e) {
    if (e.target && e.target.id === 'ecdiModal') window._ecdiClose();
  });

  // ── Expose to global scope ───────────────────────────────────────────────
  window.buildExecDashboard       = buildExecDashboard;
  window.renderLeadershipAnalytics = renderLeadershipAnalytics;
  window.expOpen                  = expOpen;
  window.expClose                 = expClose;
  window.expPrint                 = expPrint;
  window.expSwitchMode            = expSwitchMode;
  window.expInvalidate            = expInvalidate;

})();
