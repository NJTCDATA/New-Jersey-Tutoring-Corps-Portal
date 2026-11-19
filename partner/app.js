/* ============================================================================
   NJTC PARTNER DASHBOARD
   Renders Summary / Attendance Tracking / Scholar Survey / Tutor Survey from
   the single scoped bundle at partner/data/<token>.json. This page never
   fetches any other district's data — see scripts/build-partner-data.js.

   Editorial rules baked into this file (per Aug 2026 partner-review pass):
   - Attendance rate methodology matches onsite/pearl-data.js exactly:
     Late counts as Attended; Service Interruptions (school closures,
     testing days, tutor staffing, NJTC-side issues, etc.) are excluded
     from both the numerator and denominator, never held against the rate.
   - Attendance views are scholar-only. Tutor staffing/coverage is an NJTC
     operational concern, not something a school partner needs to track.
   - "Missed-session reasons" shown to partners, and a scholar's missed-
     session detail list, are limited to reasons on the school/scholar side
     (a teacher keeping a scholar in class, a scholar declining, etc.).
     NJTC-internal reasons (tutor vacancy, internal errors — the "si"
     classification below) never surface to a partner in any form.
   - "Scholars to Check In With" (Summary count + PDF) is computed directly from real attendance
     records (0 attended and at least one genuine miss, or a meaningfully
     low rate with enough sessions to be a real pattern) — not from Pearl's
     own concern flag, which under-fires and silently misses real 0%-
     attendance scholars.
   - Session Highlights are curated weekly in partner/partner-report.js:
     scholar comments first (tutor comments only top up a thin week), 4-5
     overall rating only, no negative/sensitive language, no profanity, no
     scholar/tutor names, and nothing on NJTC's exclusion list
     (partner/highlight-exclusions.json). Aggregate survey distributions stay
     fully honest — curation applies to anecdote quotes, never the numbers.
   - The attendance methodology itself also lives in partner-report.js so
     the dashboard and the Weekly Operations Report PDF (downloaded here or
     from Central) always show the same figures.
   - Every distribution on this page (survey ratings, missed reasons) is
     rendered as an always-labeled horizontal bar list, not a canvas chart —
     the count and share are visible without hovering, and sizing can't
     balloon out of proportion the way Chart.js's own bar/donut defaults did.
   ============================================================================ */
(function () {
  'use strict';

  const BASE = '/New-Jersey-Tutoring-Corps-Portal';

  const ATT  = { USER:0, ROLE:1, SESSION:2, SESS_STATUS:3, PLAN_START:4, SESS_DATE:5, ATT_STATUS:6, MISS_REASON:7, GRADE:8, SEX:9, RACE:10, SCHOOL:11, DISTRICT:12, USER_ID:13, WEEK:26 };
  const INST = { FILLED_BY:0, FILLED_FOR:1, ENGAGEMENT:2, ENJOYMENT:3, LEARNING:4, OVERALL:5, COMMENT_ADMIN:6, COMMENT_SELF:7, DATE:8, SCHOOL:9, DISTRICT:10, SESS_ID:11, FILLED_BY_ID:12 };
  const STU  = { FILLED_BY:0, FILLED_FOR:1, CONFIDENCE:2, ENJOYMENT:3, LEARNING:4, OVERALL:5, COMMENT:6, DATE:7, SCHOOL:8, DISTRICT:9, REGION:10, SESS_ID:11, FILLED_BY_ID:12, FILLED_FOR_ID:13 };
  // Session Details — durations only. DUR_MINS is computed server-side
  // (scripts/build-partner-data.js) from Pearl's Actual/Scheduled Duration
  // text, not a real Pearl column. Absent entirely from older cached
  // bundles, so every reader below treats a missing sessions array as "no
  // duration data yet" rather than zero minutes.
  const SESS = { TITLE:0, INSTRUCTOR:1, STUDENTS:2, LOCATION:3, STATUS:4, ATTENDANCE:5, START:6, SCHED_DUR:7, ACTUAL_DUR:8, SUBJECT:9, GRADE:10, SCHOOL:11, DISTRICT:12, REGION:13, SESS_ID:14, INST_ID:15, STU_IDS:16, DUR_MINS:17 };

  // Scholar-side vs. NJTC-internal missed-session reasons are defined once in
  // partner/partner-report.js (SCHOLAR_MISS_REASONS / TUTOR_MISS_REASONS).
  // NJTC-internal service-interruption reasons are never shown to partners.

  const BRAND = { pos: '#0d6e3a', neu: '#7d8fa1', neg: '#b91c1c', blue: '#0050c8', gold: '#f0a500' };
  // A missed session logged with no reason (Mysti, 11/19: was "Not specified").
  const REASON_UNKNOWN = 'Reason Unknown';

  // ── Attendance bands (Mysti, 11/19) ────────────────────────────────────
  // Scholar target 80%: 0% gray · 1–59% red · 60–79% yellow · 80%+ green.
  // Tutor target 90%:   0% gray · 1–69% red · 70–89% yellow · 90%+ green.
  // 0% = no attended session yet: usually a data-quality / rostering check,
  // or a program that is just starting.
  const BANDS = {
    scholar: { target: 80, red: 60, noun: 'scholar', nounPl: 'scholars' },
    tutor:   { target: 90, red: 70, noun: 'tutor', nounPl: 'tutors' },
  };
  function bandOf(kind, attended, total, rate) {
    if (!total) return null;
    if (!attended) return 'zero';
    return rate >= BANDS[kind].target ? 'met' : 'low';
  }
  function bandColor(kind, attended, total, rate) {
    const B = BANDS[kind];
    if (!total) return '#7d8fa1';
    if (!attended) return '#7d8fa1';
    return rate >= B.target ? BRAND.pos : rate >= B.red ? '#a16207' : BRAND.neg;
  }
  function bandPillClass(kind, attended, total, rate) {
    const B = BANDS[kind];
    if (!total) return '';
    if (!attended) return 'pt-pill-zero';
    return rate >= B.target ? 'pt-pill-good' : rate >= B.red ? 'pt-pill-mid' : 'pt-pill-bad';
  }
  function bandLegendHtml(kind) {
    const B = BANDS[kind];
    return `<div class="pt-band-legend">
      <span><i style="background:#7d8fa1"></i>0% · data quality / rostering review, or program just starting</span>
      <span><i style="background:${BRAND.neg}"></i>1–${B.red - 1}% · urgent</span>
      <span><i style="background:#ca8a04"></i>${B.red}–${B.target - 1}% · check in${kind === 'scholar' ? ' with the teacher' : ''}</span>
      <span><i style="background:${BRAND.pos}"></i>${B.target}%+ · at goal</span>
    </div>`;
  }

  const ICONS = {
    school: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21h18"/><path d="M5 21V8l7-5 7 5v13"/><path d="M9 21v-6h6v6"/><path d="M10 10h4"/></svg>',
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>',
    users: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
    handshake: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m11 17 2 2a1 1 0 1 0 3-3"/><path d="m14 14 2.5 2.5a1 1 0 1 0 3-3l-3.88-3.88a3 3 0 0 0-4.24 0l-.88.88a1 1 0 1 1-3-3l2.81-2.81a5.79 5.79 0 0 1 7.06-.87l.47.28a2 2 0 0 0 1.42.25L21 4"/><path d="m21 3 1 11h-2"/><path d="M3 3 2 14l6.5 6.5a1 1 0 1 0 3-3"/><path d="M3 4h8"/></svg>',
    heart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>',
    trend: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 7 13.5 15.5 8.5 10.5 2 17"/><path d="M16 7h6v6"/></svg>',
    search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>',
    roster: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1"/><path d="M9 12h6M9 16h6"/></svg>',
    sparkle: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M5.6 18.4l2.8-2.8M15.6 8.4l2.8-2.8"/></svg>'
  };

  // Single source of truth for "what does this mean" — the modal below and
  // PIE (pie-bot.js) both read this exact list, so the explanation is
  // always the same wherever a partner asks.
  const GLOSSARY = [
    { term: 'Scholar Attendance Rate', def: 'Attended sessions ÷ (Attended + Missed) sessions, scholars only. Late arrivals still count as Attended. Excused time — school events, testing days, holidays, tutor staffing gaps — is left out of both sides of that math entirely, so it never pulls the rate down. This matches the calculation NJTC uses internally.' },
    { term: 'Missed Session', def: 'A scheduled session the scholar did not attend, for a scholar-side reason (absent, declined the session, left early, out of the classroom, or kept in class by a classroom teacher). Sessions that did not happen because of an NJTC-side issue (a staffing gap, an internal error) are handled separately and never count as a scholar "missing" anything.' },
    { term: 'Excused Time', def: "Sessions that didn't happen for reasons outside anyone's control — a school event, a testing day, a holiday, weather — or an NJTC-side staffing gap. Never counted against the attendance rate." },
    { term: 'Scholars to Check In With', def: "The count on the Summary tab and in the weekly PDF: scholars with a real pattern of missed sessions — either they've never yet attended, or their attendance rate is below 80% across at least 3 real sessions. Computed directly from session records, counting only scholar-side reasons for a missed session. Every scholar's detail is in the Scholar Attendance Detail table." },
    { term: 'Scholar Attendance Detail', def: 'Every scholar in your current view with their school, sessions attended out of total sessions, and attendance rate, lowest first. Filter by 0%, 1–79% (the default), 80–100% or All. Click a name for each missed session: the date, the session name and the reason.' },
    { term: 'Attendance Colors', def: 'Scholars (goal 80%+): 0% gray — usually a data-quality or rostering check, or a program that is just starting; 1–59% red — urgent; 60–79% yellow — check in with the teacher; 80%+ green — at goal. Tutors (goal 90%+, NJTC Program Team view): 0% gray; 1–69% red; 70–89% yellow; 90%+ green.' },
    { term: 'Reason Unknown', def: 'A missed session logged in Pearl without a missed-session reason. It still counts as a missed session.' },
    { term: 'Session', def: 'One scheduled tutoring block for one scholar. "Sessions Delivered" counts each unique session that took place, regardless of how many scholars were in it.' },
    { term: 'Sessions Not Delivered (school-driven)', def: 'Unique tutoring sessions that could not take place for a school-side reason — a school event or assembly, school-administered testing, a schedule change, an unscheduled closure, delay or dismissal, a drill, weather, a half day or a scheduled holiday. Counted once per session. These never count against the attendance rate.' },
    { term: 'Overall Rating', def: 'The "Overall, how did this session go?" question on the post-session survey, rated 1 (Poor) to 5 (Excellent). Positive = 4–5, Neutral = 3, Negative = 1–2.' },
    { term: 'Session Highlights', def: 'A curated weekly selection of comments from sessions rated 4–5 overall. Scholar comments are shown first; tutor comments fill in when a week has fewer scholar comments. Comments that name a scholar, or contain sensitive or inappropriate language, are never shown. This is a highlight reel, not a representative sample of every comment left.' },
    { term: 'Scholars Kept in Class', def: 'Scholars a classroom teacher kept in class during their tutoring time (Pearl missed reason "Classroom Teacher Requested to Keep Scholar in Class"). The tile counts each scholar once; each time it happens is a missed tutoring session that counts against the attendance rate.' },
    { term: 'Scholars Loving Their Sessions', def: 'The share of scholar survey responses rated 4–5 on the Overall question.' },
    { term: 'Total Session Minutes', def: "Every delivered session's duration, added up once per session — a 40-minute session with 3 scholars in it still counts as 40 minutes here." },
    // NJTC Program Team (Admin / Regional) only — hidden from partner logins.
    { program: true, term: 'Tutor Attendance Detail', def: "Every tutor in the current view with their school, sessions attended out of total sessions, and attendance rate, lowest first. Filter by 0%, 1–89% (the default), 90–100% or All; click a name for each missed session. Comes from the tutor's own Pearl attendance rows (role Instructor) only — it is not cross-checked against ADP status or hire dates, so a 0% tutor is worth a data-quality check first." },
    { program: true, term: 'Tutor Incompletes', def: 'Sessions still marked Scheduled in Pearl after the session date — attendance was never taken. Grouped by tutor, most incompletes first; click a name for every incomplete session (date, session, school). The tutor or Site Leader completes or cancels each one in Pearl.' },
    { program: true, term: 'Tutor Profiles', def: "One card per tutor in the current view: content (subjects), grade levels (from their scholars' roster grades), overall rating (scholar surveys about the tutor, and the tutor's own post-session rating), scholars, attendance and apprentice status." },
    { program: true, term: 'Apprentice Status', def: 'From the TAP Tracker Master Roster, matched by name. Is apprentice: Yes if the tutor is on the roster as an Apprentice, Pre-apprentice or Completed Program (and has not left the program); otherwise No. Completed apprenticeship: Yes (Completed Program), In progress (current apprentice) or No.' },
    { program: true, term: 'Region Drill-Down', def: 'NJTC Program Team logins can filter by Region (North-East / South-West), then District, then School. Regional Directors open on their home region and can switch to All Regions to see every location.' },
    { term: 'Total Scholar-Attended Minutes', def: "Every minute a scholar personally attended, summed across all scholars — the same 40-minute session with 3 scholars who all attended counts as 120 minutes here. This is the total instructional contact time scholars actually received." }
  ];
  // Partner logins never see Program Team terms.
  function visibleGlossary() { return GLOSSARY.filter(g => !g.program || isProgramView()); }
  window.NJTC_GLOSSARY = GLOSSARY.filter(g => !g.program);

  let BUNDLE = null;
  // Current (live) season bundle + any archived seasons loaded on demand.
  // Archived season files are immutable, so the browser may cache them.
  let CURRENT_BUNDLE = null;
  const SEASON_BUNDLES = {};
  let _seasonSession = null;
  let EXCLUSIONS = []; // partner/highlight-exclusions.json
  const charts = {};
  // Client-side drill-down for broad-scope accounts (Network/Regional/Admin).
  // Purely a view filter over data already inside this account's own bundle
  // — it can only narrow what's shown, never reach outside the district(s)/
  // school(s) that bundle was built for.
  const SCOPE = { region: 'ALL', district: 'ALL', school: 'ALL', week: 'ALL' };
  // Program Team drill-down: a row's NJTC region comes from its district
  // (REGION_DISTRICTS in partner-report.js). Districts outside both lists
  // read as 'Other'.
  let _regionDefaulted = false;
  const _regionCache = {};
  function regionOfDistrict(d) {
    const k = String(d || '').trim();
    if (k in _regionCache) return _regionCache[k];
    const c = window.NJTCPartnerReport.canonDistrict(k);
    const R = window.NJTCPartnerReport.REGION_DISTRICTS;
    const hit = Object.keys(R).find(r => R[r].some(x => window.NJTCPartnerReport.canonDistrict(x) === c));
    return (_regionCache[k] = hit || 'Other');
  }

  // Pearl's own "Week" text column is sparse/unreliable in practice — the
  // weekly trend came up permanently empty relying on it. Session date is
  // reliably present (it's what "last attended" already uses correctly), so
  // every week bucket on this page is derived from it directly: the Monday
  // of the session's calendar week, which also sorts correctly by its key
  // (unlike a free-text week label, which does not).
  function parseDate(s) {
    if (!s) return null;
    const d = new Date(s);
    return isNaN(d.getTime()) ? null : d;
  }
  // Shared, cached implementation (partner/partner-report.js).
  function weekBucket(dateStr) { return window.NJTCPartnerReport.weekBucket(dateStr); }

  function esc(s) { return String(s == null ? '' : s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
  function $(sel, root) { return (root || document).querySelector(sel); }
  function pct(n, d) { return d > 0 ? Math.round((n / d) * 1000) / 10 : null; }

  function waitFor(fn, timeout) {
    return new Promise((resolve, reject) => {
      if (fn()) return resolve(fn());
      const iv = setInterval(() => { if (fn()) { clearInterval(iv); resolve(fn()); } }, 40);
      setTimeout(() => { clearInterval(iv); reject(new Error('timeout waiting for session')); }, timeout || 6000);
    });
  }

  async function boot() {
    let session;
    try { session = await waitFor(() => window.NJTC_SESSION); }
    catch { return; } // partner-guard.js already redirected home

    // Wire the nav (Sign Out, tabs) immediately — before the data fetch, not
    // after — so Sign Out always works even if the fetch below fails.
    wireChrome();

    let res;
    try {
      res = await fetch(`${BASE}/partner/data/${session.pid}.json?v=${Date.now()}`);
    } catch (e) {
      fatalError();
      return;
    }

    if (res.status === 404) {
      // Session token was issued before the current login/data refresh (e.g.
      // a PIN rotation happened since this browser last logged in). Clear it
      // and send the user back to log in fresh rather than show a dead page.
      NJTCAuth.clearSession();
      window.location.replace(BASE + '/index.html?relogin=1');
      return;
    }

    try {
      if (!res.ok) throw new Error('HTTP ' + res.status);
      BUNDLE = await res.json();
    } catch (e) {
      fatalError();
      return;
    }

    CORE.fixAttReasons(BUNDLE.attendance); // bundles built before the Haddon-reason rule
    window.NJTC_BUNDLE = BUNDLE; // read-only handoff to pie-bot.js
    CURRENT_BUNDLE = BUNDLE;
    if (BUNDLE.season) SEASON_BUNDLES[BUNDLE.season] = BUNDLE;
    _seasonSession = session;
    EXCLUSIONS = await CORE.loadExclusions();
    personalize();
    initSeasonBar();
    initScopeFilter();
    renderAll();
    hideLoading();
    document.dispatchEvent(new CustomEvent('partnerBundleReady', { detail: BUNDLE }));
  }

  // ── School-year toggle ─────────────────────────────────────────────────
  // Live year loads with the page (small bundle). A prior year's file is
  // fetched only when a user switches to it, then kept in memory.
  function seasonName(s) { return 'SY ' + s; }
  function initSeasonBar() {
    const bar = document.getElementById('seasonBar');
    const seasons = (CURRENT_BUNDLE && CURRENT_BUNDLE.seasons) || [];
    if (!bar || seasons.length < 2) return;
    bar.hidden = false;
    renderSeasonButtons();
  }
  // Prior school years are a read-only "final summary" built from the small
  // per-year summary already inside this account's bundle (CURRENT_BUNDLE.
  // trend) — never the full prior-year row file, which runs to tens of MB.
  let ARCHIVE = null; // trend entry while a prior year is selected
  function renderSeasonButtons() {
    const wrap = document.getElementById('seasonButtons');
    const note = document.getElementById('seasonNote');
    const seasons = CURRENT_BUNDLE.seasons || [];
    const shown = ARCHIVE ? ARCHIVE.season : CURRENT_BUNDLE.season;
    wrap.innerHTML = `<select class="pt-select" id="seasonSelect" aria-label="School year">${seasons.map(s =>
      `<option value="${esc(s)}"${s === shown ? ' selected' : ''}>${esc(seasonName(s))}${s === CURRENT_BUNDLE.season ? ' (current)' : ' (final summary)'}</option>`).join('')}</select>`;
    document.getElementById('seasonSelect').addEventListener('change', e => switchSeason(e.target.value));
    note.hidden = !ARCHIVE;
    if (ARCHIVE) note.textContent = 'Viewing ' + seasonName(ARCHIVE.season) + ' final summary — read-only, for comparison';
  }
  function setArchiveChrome(on) {
    ['tutor', 'profiles'].forEach(v => { const t = document.querySelector(`.pt-tab[data-view="${v}"]`); if (t) t.hidden = on; });
    syncProgramTabs(on);
    const pdf = document.getElementById('pdfBtn'); if (pdf) pdf.style.display = on ? 'none' : '';
    const active = document.querySelector('.pt-tab.active');
    if (on && active && ['tutor', 'profiles', 'tutorAtt', 'tutorProfiles'].includes(active.dataset.view)) goTab('summary');
  }
  function switchSeason(season) {
    if (!CURRENT_BUNDLE) return;
    SCOPE.region = 'ALL'; SCOPE.district = 'ALL'; SCOPE.school = 'ALL'; SCOPE.week = 'ALL';
    resetScopeBar();
    if (season === CURRENT_BUNDLE.season) {
      ARCHIVE = null;
      BUNDLE = CURRENT_BUNDLE;
      window.NJTC_BUNDLE = BUNDLE;
      setArchiveChrome(false);
      renderSeasonButtons();
      initScopeFilter();
      renderAll();
      return;
    }
    ARCHIVE = ((CURRENT_BUNDLE.trend || []).find(t => t.season === season)) || null;
    renderSeasonButtons();
    setArchiveChrome(!!ARCHIVE);
    if (ARCHIVE) renderArchive(ARCHIVE);
  }

  function renderArchive(sum) {
    const id = CURRENT_BUNDLE.identity;
    document.getElementById('ptMain').innerHTML = ['summary', 'attendance', 'scholar', 'tutor', 'profiles']
      .map(v => `<div id="view-${v}" class="pt-view"></div>`).join('');
    const active = (document.querySelector('.pt-tab.active') || {}).dataset;
    document.getElementById('view-' + ((active && active.view) || 'summary')).classList.add('active');
    const fmtN = v => v == null ? '—' : Number(v).toLocaleString();
    const pctTxt = v => v == null ? '—' : v + '%';
    const banner = `<div class="pt-card" style="margin-bottom:1.1rem;border-left:4px solid var(--blue-mid)"><div class="pt-card-title">${ICONS.trend} ${esc(seasonName(sum.season))} — Final Operations Summary</div>
      <p style="font-size:.82rem;color:var(--text-2)">The year's final totals for comparison. Choose the current year above to return to live data.</p></div>`;
    const pending = `<p style="font-size:.8rem;color:var(--muted)">More detail for this year appears after the next data refresh.</p>`;

    let schoolsTbl = '';
    if ((sum.bySchool || []).length > 1) {
      schoolsTbl = `<div class="pt-card" style="margin-top:1.1rem"><div class="pt-card-title">${ICONS.roster} By School</div>
        <table class="pt-table"><thead><tr><th>School</th><th style="text-align:right">Attendance</th><th style="text-align:right">Scholars</th><th style="text-align:right">Loving sessions</th></tr></thead><tbody>
        ${sum.bySchool.map(x => `<tr><td>${esc(x.school)}</td><td style="text-align:right;font-weight:700;color:${rateColor(x.scholarAttendanceRate)}">${pctTxt(x.scholarAttendanceRate)}</td><td style="text-align:right">${fmtN(x.scholarsServed)}</td><td style="text-align:right">${pctTxt(x.lovingPct)}</td></tr>`).join('')}
        </tbody></table></div>`;
    }
    document.getElementById('view-summary').innerHTML = heroHtml(id) + banner + `
      <div class="pt-grid ${sum.keptInClass != null ? 'pt-grid-5' : 'pt-grid-4'}">
        ${kpiCard(ICONS.check, BRAND.pos, pctTxt(sum.scholarAttendanceRate), 'Scholar Attendance Rate', { view: 'attendance' })}
        ${kpiCard(ICONS.users, BRAND.blue, fmtN(sum.scholarsServed), 'Scholars Served')}
        ${kpiCard(ICONS.handshake, BRAND.gold, fmtN(sum.sessionsDelivered), 'Sessions Delivered')}
        ${sum.keptInClass != null ? kpiCard(ICONS.school, BRAND.neg, fmtN(sum.keptInClass), 'Times Kept in Class', { view: 'attendance', note: 'Sessions a teacher kept a scholar in class' }) : ''}
        ${kpiCard(ICONS.heart, '#c0367a', pctTxt(sum.lovingPct), 'Scholars Loving Their Sessions', { view: 'scholar' })}
      </div>
      <div class="pt-card" style="margin-top:1.1rem;display:flex;gap:2.2rem;flex-wrap:wrap">
        <div><div class="pt-kpi-val" style="font-size:1.4rem">${sum.scholarSurveyAvg == null ? '—' : sum.scholarSurveyAvg.toFixed(2)}</div><div class="pt-kpi-sub">Scholar survey average (of 5)</div></div>
        <div><div class="pt-kpi-val" style="font-size:1.4rem">${sum.tutoredMinutes == null ? '—' : Math.round(sum.tutoredMinutes / 60).toLocaleString()}</div><div class="pt-kpi-sub">Tutoring hours delivered</div></div>
        <div><div class="pt-kpi-val" style="font-size:1.4rem">${fmtN(sum.scholarSurveys)}</div><div class="pt-kpi-sub">Scholar surveys</div></div>
      </div>${schoolsTbl}`;

    const reasons = sum.missedReasons || null;
    const reasonTotal = reasons ? reasons.reduce((a, [, n]) => a + n, 0) : 0;
    document.getElementById('view-attendance').innerHTML = banner + `
      <div class="pt-grid pt-grid-2">
        <div class="pt-card"><div class="pt-card-title">Scholar Attendance Rate</div>
          <div class="pt-kpi-val pt-kpi-val-lg">${pctTxt(sum.scholarAttendanceRate)}</div>
          <div style="margin-top:1rem">${quickBar('Attended', sum.attended || 0, (sum.attended || 0) + (sum.absent || 0), BRAND.pos)}${quickBar('Missed', sum.absent || 0, (sum.attended || 0) + (sum.absent || 0), BRAND.neg)}</div>
          ${sum.keptInClass != null ? `<p style="font-size:.8rem;color:var(--text-2);margin-top:.8rem"><b>${fmtN(sum.keptInClass)}</b> missed sessions were scholars kept in class by a teacher during tutoring.</p>` : ''}
        </div>
        <div class="pt-card"><div class="pt-card-title">${ICONS.search} Why Scholars Missed a Session</div>
          ${reasons ? distRows(reasons, reasonTotal, BRAND.blue) : pending}</div>
      </div>`;

    const dist = sum.surveyDist || null;
    const fromCounts = (key) => { const sc = SCALE_LABELS[key] || SCALE_LABELS.OVERALL; const c = dist[key] || {}; return [5, 4, 3, 2, 1].map(k => [`${k} — ${sc[k]}`, c[k] || 0]); };
    const total = key => [1, 2, 3, 4, 5].reduce((a, k) => a + ((dist[key] || {})[k] || 0), 0);
    document.getElementById('view-scholar').innerHTML = banner + (dist ? `
      <div class="pt-card" style="margin-bottom:1.1rem"><div class="pt-card-title">Overall Sentiment</div>
        ${sentimentRow('Positive', (dist.OVERALL[4] || 0) + (dist.OVERALL[5] || 0), total('OVERALL'), BRAND.pos)}
        ${sentimentRow('Neutral', dist.OVERALL[3] || 0, total('OVERALL'), BRAND.neu)}
        ${sentimentRow('Negative', (dist.OVERALL[1] || 0) + (dist.OVERALL[2] || 0), total('OVERALL'), BRAND.neg)}
      </div>
      <div class="pt-grid pt-grid-3">
        <div class="pt-card"><div class="pt-card-title">How confident scholars felt they understood the material</div>${distRows(fromCounts('CONFIDENCE'), total('CONFIDENCE'), BRAND.blue)}</div>
        <div class="pt-card"><div class="pt-card-title">How much scholars enjoyed the session</div>${distRows(fromCounts('ENJOYMENT'), total('ENJOYMENT'), BRAND.blue)}</div>
        <div class="pt-card"><div class="pt-card-title">How much scholars felt they learned</div>${distRows(fromCounts('LEARNING'), total('LEARNING'), BRAND.blue)}</div>
      </div>` : `<div class="pt-card">${pending}</div>`);
  }
  // Replace the drill-down selects with fresh clones so re-initializing for
  // another season never stacks duplicate change listeners.
  function resetScopeBar() {
    ['scopeRegion', 'scopeDistrict', 'scopeSchool', 'scopeWeek'].forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      const c = el.cloneNode(false);
      c.hidden = true; c.innerHTML = '';
      el.replaceWith(c);
    });
    const bar = document.getElementById('scopeBar'); if (bar) bar.hidden = true;
    const badge = document.getElementById('scopeActive'); if (badge) badge.hidden = true;
  }

  // Year-over-year card — summaries are computed server-side per partner
  // scope with the same methodology as this dashboard (seasonSummary()).
  function trendCardHtml() {
    const t = (CURRENT_BUNDLE && CURRENT_BUNDLE.trend) || [];
    if (t.length < 2) return '';
    const fmtN = v => v == null ? '—' : Number(v).toLocaleString();
    const rows = t.slice().sort((a, b) => a.season < b.season ? 1 : -1);
    const cur = rows[0], prev = rows[1];
    // Change is shown only for like-for-like measures (rates/averages); counts
    // for the in-progress current year are not comparable to a full prior year.
    const d = (a, b, unit, dp) => {
      if (a == null || b == null) return '<span style="color:#94a3b8">—</span>';
      const diff = Math.round((a - b) * Math.pow(10, dp)) / Math.pow(10, dp);
      return `<span style="font-size:.72rem;font-weight:700;color:${diff >= 0 ? '#0d6e3a' : '#b91c1c'}">${diff > 0 ? '▲' : diff < 0 ? '▼' : '='} ${Math.abs(diff).toFixed(dp)}${unit}</span>`;
    };
    const line = (label, key, fmt, cmp) => `<tr><td style="padding:.4rem .5rem;color:#475569">${label}</td>${rows.map(r => `<td style="padding:.4rem .5rem;text-align:center;font-weight:700;color:#0a1628">${fmt(r[key])}</td>`).join('')}<td style="padding:.4rem .5rem;text-align:center">${cmp ? d(cur[key], prev[key], cmp.unit, cmp.dp) : '<span style="font-size:.7rem;color:#94a3b8">year in progress</span>'}</td></tr>`;
    return `<details class="pt-card pt-fold" style="overflow-x:auto">
      <summary>Compare with last school year</summary>
      <p style="margin:0 0 .75rem;font-size:.8rem;color:#64748b">Your full program scope, ${esc(seasonName(prev.season))} compared with ${esc(seasonName(cur.season))} (school year to date). Same attendance methodology in both years.</p>
      <table style="width:100%;border-collapse:collapse;font-size:.85rem">
        <thead><tr style="color:#64748b;font-size:.72rem;text-transform:uppercase;letter-spacing:.04em"><th style="text-align:left;padding:.4rem .5rem">Measure</th>${rows.map(r => `<th style="padding:.4rem .5rem">${esc(seasonName(r.season))}${r.season === CURRENT_BUNDLE.season ? ' (to date)' : ''}</th>`).join('')}<th style="padding:.4rem .5rem">Change</th></tr></thead>
        <tbody>
          ${line('Scholar attendance rate', 'scholarAttendanceRate', v => v == null ? '—' : v + '%', { unit: ' pts', dp: 1 })}
          ${line('Scholars loving their sessions', 'lovingPct', v => v == null ? '—' : v + '%', { unit: ' pts', dp: 1 })}
          ${line('Scholar survey average (of 5)', 'scholarSurveyAvg', v => v == null ? '—' : v.toFixed(2), { unit: '', dp: 2 })}
          ${line('Scholars served (attended ≥1 session)', 'scholarsServed', fmtN, null)}
          ${line('Sessions delivered', 'sessionsDelivered', fmtN, null)}
          ${line('Tutoring hours delivered', 'tutoredMinutes', v => v == null ? '—' : Math.round(v / 60).toLocaleString(), null)}
        </tbody>
      </table>
      <p style="margin:.5rem 0 0;font-size:.72rem;color:#94a3b8">The current year is in progress, so totals grow through the year — attendance rate and survey average are the like-for-like comparisons.</p>
    </details>`;
  }

  // ── Drill-down filter (Network/Regional/Admin accounts only see this if
  // their bundle actually spans more than one school) ─────────────────────
  function scoped(rows, distIdx, schIdx, dateIdx) {
    return rows.filter(r => {
      if (SCOPE.region !== 'ALL' && regionOfDistrict(r[distIdx]) !== SCOPE.region) return false;
      if (SCOPE.district !== 'ALL' && (r[distIdx] || '').trim() !== SCOPE.district) return false;
      if (SCOPE.school !== 'ALL' && (r[schIdx] || '').trim() !== SCOPE.school) return false;
      if (SCOPE.week !== 'ALL' && dateIdx != null) {
        const wk = weekBucket(r[dateIdx]);
        if (!wk || wk.key !== SCOPE.week) return false;
      }
      return true;
    });
  }
  function scopedAttendance() { return scoped(BUNDLE.attendance || [], ATT.DISTRICT, ATT.SCHOOL, ATT.SESS_DATE); }
  function scopedScholarSurveys() { return scoped(BUNDLE.scholarSurveys || [], STU.DISTRICT, STU.SCHOOL, STU.DATE); }
  function scopedTutorSurveys() { return scoped(BUNDLE.tutorSurveys || [], INST.DISTRICT, INST.SCHOOL, INST.DATE); }
  function scopedSessions() { return scoped(BUNDLE.sessions || [], SESS.DISTRICT, SESS.SCHOOL, SESS.START); }

  // Older cached bundles (or a run where the sessions tab fetch failed
  // server-side) simply carry no `sessions` array — treated as "duration
  // data not available yet", never as zero minutes.
  function hasSessionData() { return !!(BUNDLE.sessions && BUNDLE.sessions.length); }

  // '2:40:00 PM' or '2:40 PM' -> '2:40 PM' — strips seconds so the sessions
  // sheet's START time and the attendance sheet's PLAN_START time compare
  // equal even though only one of them carries seconds.
  function normTime(t) {
    const m = /^(\d{1,2}):(\d{2})(?::\d{2})?\s*([AP]M)$/i.exec((t || '').trim());
    return m ? `${+m[1]}:${m[2]} ${m[3].toUpperCase()}` : (t || '').trim();
  }

  // Attendance rows carry a session TITLE (e.g. "Gr. 2 (Mrs. Lang)"), not a
  // session ID — the same title is reused every time that recurring group
  // meets, so title alone isn't a safe key (verified against real data:
  // collapsing by title alone silently collides thousands of times across
  // partners whenever a recurring session's duration changed from one
  // occurrence to the next, e.g. a shortened session). Keying by
  // title+school+date+time instead — the same four fields a human would use
  // to recognize "this specific occurrence" — cuts that from thousands of
  // collisions to a small residual (verified: 11 across all 42 current
  // partner bundles, none of which zeroes out a partner's total) without
  // requiring a session ID that the attendance sheet doesn't have.
  //
  // key -> minutes, delivered sessions only (Status === Completed, parsed
  // duration > 0). Built once from the full bundle (already scoped to this
  // partner server-side) so a scholar's per-session minutes can be looked
  // up regardless of the current district/school/week drill-down.
  function sessionDurationMap(sessRows) {
    const map = {};
    sessRows.forEach(r => {
      if ((r[SESS.STATUS] || '').trim() !== 'Completed') return;
      const title = (r[SESS.TITLE] || '').trim();
      const school = (r[SESS.SCHOOL] || '').trim();
      const start = (r[SESS.START] || '').trim(); // "MM/DD/YYYY H:MM:SS AM"
      const spaceIdx = start.indexOf(' ');
      const date = spaceIdx === -1 ? start : start.slice(0, spaceIdx);
      const time = spaceIdx === -1 ? '' : start.slice(spaceIdx + 1);
      const mins = parseInt(r[SESS.DUR_MINS], 10);
      if (title && date && mins > 0) map[title + '||' + school + '||' + date + '||' + normTime(time)] = mins;
    });
    return map;
  }

  function sessionDurationKey(attRow) {
    return (attRow[ATT.SESSION] || '').trim() + '||' + (attRow[ATT.SCHOOL] || '').trim() + '||' +
      (attRow[ATT.SESS_DATE] || '').trim() + '||' + normTime(attRow[ATT.PLAN_START]);
  }

  function initScopeFilter() {
    const bar = document.getElementById('scopeBar');
    const regSel = document.getElementById('scopeRegion');
    const distSel = document.getElementById('scopeDistrict');
    const schSel = document.getElementById('scopeSchool');
    const weekSel = document.getElementById('scopeWeek');
    const activeBadge = document.getElementById('scopeActive');
    if (!bar) return;

    const allRows = [
      ...(BUNDLE.attendance || []).map(r => [((r[ATT.DISTRICT] || '').trim()), (r[ATT.SCHOOL] || '').trim()]),
      ...(BUNDLE.scholarSurveys || []).map(r => [(r[STU.DISTRICT] || '').trim(), (r[STU.SCHOOL] || '').trim()]),
      ...(BUNDLE.tutorSurveys || []).map(r => [(r[INST.DISTRICT] || '').trim(), (r[INST.SCHOOL] || '').trim()])
    ].filter(([d, s]) => d || s);

    const districts = [...new Set(allRows.map(([d]) => d).filter(Boolean))].sort();
    const schoolsByDistrict = {};
    allRows.forEach(([d, s]) => {
      if (!s) return;
      const key = d || '';
      if (!schoolsByDistrict[key]) schoolsByDistrict[key] = new Set();
      schoolsByDistrict[key].add(s);
    });
    const allSchools = [...new Set(allRows.map(([, s]) => s).filter(Boolean))];

    const weekMap = new Map(); // key -> label
    (BUNDLE.attendance || []).forEach(r => {
      const wk = weekBucket(r[ATT.SESS_DATE]);
      if (wk) weekMap.set(wk.key, wk.label);
    });
    // Most recent week first (Mysti, 11/19).
    const weeks = [...weekMap.keys()].sort().reverse();

    const hasSchoolDrilldown = districts.length > 1 || allSchools.length > 1;
    if (!hasSchoolDrilldown && !weeks.length) return; // single school, no dated sessions yet — nothing to drill into

    bar.hidden = false;

    // Region (Program Team logins only) → District → School.
    const regions = [...new Set(districts.map(regionOfDistrict))].sort();
    const inRegion = d => SCOPE.region === 'ALL' || regionOfDistrict(d) === SCOPE.region;
    function populateDistricts() {
      const list = districts.filter(inRegion);
      distSel.innerHTML = `<option value="ALL">All Districts${SCOPE.region !== 'ALL' ? ' in ' + esc(SCOPE.region) : ''}</option>` + list.map(d => `<option value="${esc(d)}">${esc(d)}</option>`).join('');
      distSel.value = list.includes(SCOPE.district) ? SCOPE.district : 'ALL';
    }
    function populateSchools(district) {
      let schools;
      if (district === 'ALL') schools = SCOPE.region === 'ALL' ? allSchools : districts.filter(inRegion).flatMap(d => [...(schoolsByDistrict[d] || [])]);
      else schools = [...(schoolsByDistrict[district] || [])];
      schools = [...new Set(schools)].sort();
      schSel.innerHTML = `<option value="ALL">All Schools</option>` + schools.map(s => `<option value="${esc(s)}">${esc(s)}</option>`).join('');
    }

    if (hasSchoolDrilldown) {
      schSel.hidden = false;
      if (isProgramView() && regions.length > 1 && regSel) {
        regSel.hidden = false;
        regSel.innerHTML = `<option value="ALL">All Regions</option>` + regions.map(r => `<option value="${esc(r)}">${esc(r === 'Other' ? 'Other / unassigned' : r + ' Region')}</option>`).join('');
        // Regional Directors open on their home region; every location is one pick away.
        const home = BUNDLE.identity && BUNDLE.identity.level === 'Regional' ? BUNDLE.identity.region : null;
        if (home && regions.includes(home) && SCOPE.region === 'ALL' && !_regionDefaulted) { SCOPE.region = home; _regionDefaulted = true; }
        regSel.value = SCOPE.region;
        regSel.addEventListener('change', () => {
          SCOPE.region = regSel.value;
          SCOPE.district = 'ALL'; SCOPE.school = 'ALL';
          populateDistricts();
          populateSchools('ALL');
          applyScopeChange();
        });
      }
      if (districts.length > 1) {
        distSel.hidden = false;
        populateDistricts();
        distSel.addEventListener('change', () => {
          SCOPE.district = distSel.value;
          SCOPE.school = 'ALL';
          populateSchools(SCOPE.district);
          applyScopeChange();
        });
      }
      populateSchools(SCOPE.district);
      schSel.addEventListener('change', () => {
        SCOPE.school = schSel.value;
        // Picking a school implicitly fixes its district too, so the two
        // filters can't disagree with each other.
        if (SCOPE.school !== 'ALL' && districts.length > 1) {
          const owner = districts.find(d => (schoolsByDistrict[d] || new Set()).has(SCOPE.school));
          if (owner) { SCOPE.district = owner; distSel.value = owner; }
          if (owner && regSel && !regSel.hidden && SCOPE.region !== 'ALL' && regionOfDistrict(owner) !== SCOPE.region) { SCOPE.region = regionOfDistrict(owner); regSel.value = SCOPE.region; populateDistricts(); }
        }
        applyScopeChange();
      });
    } else {
      schSel.hidden = true;
    }

    if (weeks.length) {
      weekSel.hidden = false;
      weekSel.innerHTML = `<option value="ALL">All Weeks</option>` + weeks.map(k => `<option value="${k}">Week of ${esc(weekMap.get(k))}</option>`).join('');
      weekSel.addEventListener('change', () => {
        SCOPE.week = weekSel.value;
        applyScopeChange();
      });
    }

    function applyScopeChange() {
      const parts = [];
      if (SCOPE.school !== 'ALL') parts.push(SCOPE.school);
      else if (SCOPE.district !== 'ALL') parts.push(SCOPE.district);
      else if (SCOPE.region !== 'ALL') parts.push(SCOPE.region + ' Region');
      if (SCOPE.week !== 'ALL') parts.push('week of ' + esc(weekMap.get(SCOPE.week) || SCOPE.week));
      if (parts.length) { activeBadge.hidden = false; activeBadge.textContent = 'Showing: ' + parts.join(' · '); }
      else activeBadge.hidden = true;
      renderAll();
    }
    if (SCOPE.region !== 'ALL') {
      const b = document.getElementById('scopeActive');
      if (b) { b.hidden = false; b.textContent = 'Showing: ' + SCOPE.region + ' Region'; }
    }
  }
  function hideLoading() {
    const el = document.getElementById('loadingScreen');
    if (!el) return;
    el.style.opacity = '0';
    setTimeout(() => el.remove(), 300);
  }

  function fatalError() {
    hideLoading();
    document.getElementById('ptMain').innerHTML = `
      <div class="pt-card pt-empty" style="margin-top:2rem">
        <h3>We couldn't load your dashboard</h3>
        <p>Please refresh the page, or <a href="${BASE}/index.html?signout=1" style="color:var(--blue-mid);font-weight:700">sign in again</a>. If this keeps happening, contact your NJTC Program Manager — your login may need to be re-issued.</p>
      </div>`;
  }

  function initials(name) {
    const p = (name || '?').trim().split(/\s+/);
    return p.length > 1 ? (p[0][0] + p[p.length - 1][0]).toUpperCase() : p[0].slice(0, 2).toUpperCase();
  }

  function scopeLabel(id) {
    if (id.level === 'Admin') return 'All Districts · All Schools';
    if (id.level === 'Regional') return `${id.region} Region`;
    if (id.schools && id.schools[0] === 'ALL') return id.district + ' · All Schools';
    return (id.schools || []).join(', ') || id.district || '—';
  }

  // ── Program Team view (Admin + Regional logins) ──────────────────────
  // NJTC staff use these logins for regular data collection: they get the
  // tutor-side pages (Tutor Attendance Tracking, tutor summary row, staff
  // tiles, survey comment tables). Partner logins never see them.
  // Tutor Profiles is behind TUTOR_PROFILES_READY (released 11/2026).
  const TUTOR_PROFILES_READY = true;
  function isProgramView() {
    const l = (CURRENT_BUNDLE && CURRENT_BUNDLE.identity && CURRENT_BUNDLE.identity.level) || '';
    return l === 'Admin' || l === 'Regional';
  }
  function syncProgramTabs(archive) {
    const prog = isProgramView();
    document.querySelectorAll('.pt-tab[data-program-label]').forEach(t => {
      if (!t.dataset.partnerLabel) t.dataset.partnerLabel = t.textContent;
      t.textContent = prog ? t.dataset.programLabel : t.dataset.partnerLabel;
    });
    document.querySelectorAll('.pt-tab[data-program-only]').forEach(t => {
      t.hidden = !prog || !!archive || (t.hasAttribute('data-not-ready') && !TUTOR_PROFILES_READY);
    });
  }

  function personalize() {
    const id = BUNDLE.identity;
    window.NJTC_GLOSSARY = visibleGlossary(); // PIE reads this
    syncProgramTabs(false);
    $('#idName').textContent = id.name;
    $('#idRole').textContent = id.level + (id.district && id.level !== 'Admin' ? ' · ' + id.district : '');
    $('#idAvatar').textContent = initials(id.name);
    $('#navSubtitle').textContent = scopeLabel(id);

    const freshness = $('#footerFreshness');
    if (freshness) {
      if (BUNDLE.generatedAt) {
        const when = new Date(BUNDLE.generatedAt).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });
        freshness.textContent = `Data as of ${when} · updates automatically`;
      } else {
        freshness.textContent = 'Data updates automatically.';
      }
    }
    const scopeEl = $('#footerScope');
    if (scopeEl) scopeEl.textContent = `You're viewing: ${scopeLabel(id)}`;
    const contactEl = $('#footerContact');
    if (contactEl) {
      const c = CORE.contactsFor(id);
      const link = (p, subj) => `<a href="${CORE.mailtoHref(p.email, subj)}" style="color:var(--blue-mid);font-weight:700">${esc(p.name.split(' ')[0])}</a>`;
      contactEl.innerHTML = 'Program questions: ' + c.programManagers.map(p => link(p, 'NJTC tutoring question')).join(' or ') +
        ' &middot; Data questions: ' + link(c.data, 'NJTC dashboard data question');
    }
  }

  function wireChrome() {
    document.querySelectorAll('.pt-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        const target = document.getElementById('view-' + tab.dataset.view);
        if (!target) return; // renderAll() hasn't run yet — no-op rather than throw
        document.querySelectorAll('.pt-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        document.querySelectorAll('.pt-view').forEach(v => v.classList.remove('active'));
        target.classList.add('active');
      });
    });
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) logoutBtn.addEventListener('click', () => NJTCAuth.logout());

    const glossaryBtn = document.getElementById('glossaryBtn');
    const glossaryModal = document.getElementById('glossaryModal');
    if (glossaryBtn && glossaryModal) {
      glossaryBtn.addEventListener('click', () => {
        document.getElementById('glossaryBody').innerHTML = visibleGlossary().map(g => `
        <div class="pt-glossary-item">
          <div class="pt-glossary-term">${esc(g.term)}</div>
          <div class="pt-glossary-def">${esc(g.def)}</div>
        </div>`).join('');
        glossaryModal.classList.add('open');
      });
      document.getElementById('glossaryClose').addEventListener('click', () => glossaryModal.classList.remove('open'));
      glossaryModal.addEventListener('click', e => { if (e.target === glossaryModal) glossaryModal.classList.remove('open'); });
    }

    wirePdf();

    const tourBtn = document.getElementById('tourBtn');
    if (tourBtn) tourBtn.addEventListener('click', () => { if (window.NJTCTour) window.NJTCTour.start(); });

    const scholarModal = document.getElementById('scholarModal');
    if (scholarModal) {
      document.getElementById('scholarModalClose').addEventListener('click', () => scholarModal.classList.remove('open'));
      scholarModal.addEventListener('click', e => { if (e.target === scholarModal) scholarModal.classList.remove('open'); });
    }
  }

  // Weekly Operations Report PDF — same generator Central uses for this
  // partner (partner/partner-report.js), scoped to the current drill-down.
  function wirePdf() {
    const btn = document.getElementById('pdfBtn');
    const modal = document.getElementById('pdfModal');
    if (!btn || !modal) return;
    const weekSel = document.getElementById('pdfWeek');
    const status = document.getElementById('pdfStatus');
    const go = document.getElementById('pdfGo');
    const close = () => modal.classList.remove('open');
    btn.addEventListener('click', () => {
      if (!BUNDLE) return;
      const weeks = CORE.allWeeks(BUNDLE).reverse();
      weekSel.innerHTML = weeks.map(w => `<option value="${w.key}">Week of ${esc(CORE.weekRangeLabel(w.key))}</option>`).join('') +
        `<option value="ALL">Full school year to date</option>`;
      weekSel.value = SCOPE.week !== 'ALL' ? SCOPE.week : (weeks[0] ? weeks[0].key : 'ALL');
      document.getElementById('pdfScope').textContent = CORE.scopeLabel(BUNDLE.identity, SCOPE) || 'Your schools';
      status.textContent = '';
      go.disabled = false;
      modal.classList.add('open');
    });
    document.getElementById('pdfModalClose').addEventListener('click', close);
    modal.addEventListener('click', e => { if (e.target === modal) close(); });
    go.addEventListener('click', async () => {
      go.disabled = true;
      status.textContent = 'Building your report…';
      try {
        await CORE.generatePDF(BUNDLE, { district: SCOPE.district, school: SCOPE.school, week: weekSel.value }, { exclusions: EXCLUSIONS });
        status.textContent = 'Downloaded.';
        setTimeout(close, 900);
      } catch (e) {
        console.error(e);
        status.textContent = "Couldn't build the PDF — check your internet connection and try again.";
      } finally {
        go.disabled = false;
      }
    });
  }

  // ══════════════════════════════════════════════════════════════════════
  //  ATTENDANCE METHODOLOGY — mirrors onsite/pearl-data.js exactly
  // ══════════════════════════════════════════════════════════════════════
  // Methodology lives in partner/partner-report.js so the dashboard, the
  // partner PDF and Central's copy of that PDF can never disagree.
  const CORE = window.NJTCPartnerReport;
  const isScholarRow = CORE.isScholarRow;
  const classifyAtt = CORE.classifyAtt;
  const scholarStats = CORE.scholarStats;
  const scholarMissedReasons = CORE.scholarMissedReasons;
  // Scholars worth a check-in: at least one genuine scholar-side miss AND
  // either never attended, or under 80% across 3+ sessions. Service
  // Interruptions never count and never appear in the detail list.
  const scholarsToCheckIn = CORE.scholarsToCheckIn;
  function scholarWeeklyRate(scholarRows) {
    const weeks = CORE.scholarWeekly(scholarRows);
    return { weeks: weeks.map(w => w.label), rates: weeks.map(w => w.rate) };
  }

  // ══════════════════════════════════════════════════════════════════════
  //  SCHOLAR PROFILES — one card per scholar, honest/uncurated (this is
  //  case-management detail for the partner's own staff, not a highlight
  //  reel), excluding anyone with zero real attended sessions (assigned but
  //  the program never actually started for them — nothing to profile).
  // ══════════════════════════════════════════════════════════════════════
  const CT_REASONS = new Set(['Classroom Teacher Requested to Keep Scholar in Class', 'HADDON TWP ONLY -- Teacher requested whole group support']);
  const STALE_DAYS = 14; // "missing more than 2 weeks"

  function sessionTutorMap(attRows) {
    const map = {};
    attRows.forEach(r => {
      if ((r[ATT.ROLE] || '').trim() !== 'Instructor') return;
      const sess = (r[ATT.SESSION] || '').trim();
      const name = (r[ATT.USER] || '').trim();
      if (!sess || !name) return;
      const k = sess + '|' + (r[ATT.SCHOOL] || '').trim();
      if (!map[k]) map[k] = new Set();
      map[k].add(name);
    });
    return map;
  }

  // Scholar → tutors / subjects / grades, from the Pearl sessions this
  // scholar was actually rostered on in the current view (this school year,
  // current drill-down). Cancelled / rescheduled sessions don't count.
  function scholarSessionIndex() {
    const idx = {};
    if (!hasSessionData()) return null;
    scopedSessions().forEach(r => {
      const st = (r[SESS.STATUS] || '').trim();
      if (st === 'Cancelled' || st === 'Rescheduled') return;
      const tutor = (r[SESS.INSTRUCTOR] || '').trim(), subj = (r[SESS.SUBJECT] || '').trim();
      (r[SESS.STU_IDS] || '').split(',').map(x => x.trim()).filter(Boolean).forEach(u => {
        const e = idx[u] = idx[u] || { tutors: new Set(), subjects: new Set() };
        if (tutor) e.tutors.add(tutor); if (subj) e.subjects.add(subj);
      });
    });
    return idx;
  }
  const gradeSort = (a, b) => (parseInt(a, 10) || 0) - (parseInt(b, 10) || 0) || a.localeCompare(b);

  function scholarProfiles(attAll, surveys, durMap) {
    const tutorMap = sessionTutorMap(attAll);
    const sessIdx = scholarSessionIndex();
    const byScholar = {};
    attAll.filter(isScholarRow).forEach(r => {
      const uid = (r[ATT.USER_ID] || '').trim();
      if (!uid) return;
      if (!byScholar[uid]) {
        byScholar[uid] = {
          uid, name: (r[ATT.USER] || '').trim() || 'Unknown',
          district: (r[ATT.DISTRICT] || '').trim(), school: (r[ATT.SCHOOL] || '').trim(),
          attended: 0, absences: 0, excused: 0, lastAttended: null, lastAttendedSort: null,
          missed: [], sessions: new Set(), attendedSessions: new Set(), weeklyRows: [], ctFlag: false, rosterGrade: ''
        };
      }
      const s = byScholar[uid];
      // Grade = roster grade (the build writes it onto the scholar's rows);
      // never the session's grade.
      if (!s.rosterGrade && (r[ATT.GRADE] || '').trim()) s.rosterGrade = r[ATT.GRADE].trim();
      const sess = (r[ATT.SESSION] || '').trim();
      if (sess) s.sessions.add(sess + '|' + (r[ATT.SCHOOL] || '').trim());
      const c = classifyAtt(r);
      const reason = (r[ATT.MISS_REASON] || '').trim();
      if (c === 'attended') {
        s.attended++;
        if (sess) s.attendedSessions.add(sessionDurationKey(r));
        const raw = (r[ATT.SESS_DATE] || '').trim();
        const parsed = parseDate(raw);
        if (raw && parsed && (!s.lastAttendedSort || parsed > s.lastAttendedSort)) { s.lastAttended = raw; s.lastAttendedSort = parsed; }
      } else if (c === 'absent') {
        s.absences++;
        s.missed.push({ date: (r[ATT.SESS_DATE] || '').trim() || 'Date not recorded', reason: reason || REASON_UNKNOWN });
        if (CT_REASONS.has(reason)) s.ctFlag = true;
      }
      if (c === 'attended' || c === 'absent') {
        const wk = weekBucket(r[ATT.SESS_DATE]);
        if (wk) s.weeklyRows.push({ key: wk.key, label: wk.label, attended: c === 'attended' ? 1 : 0, absent: c === 'absent' ? 1 : 0 });
      }
      if (c === 'si') s.excused++;
    });

    const profiles = Object.values(byScholar).filter(s => s.attended > 0);
    const datasetMaxDate = profiles.reduce((max, s) => (s.lastAttendedSort && (!max || s.lastAttendedSort > max)) ? s.lastAttendedSort : max, null);

    // Own survey responses + comments (STU.FILLED_BY_ID = the scholar who
    // filled out the survey about their own session).
    const surveysByScholar = {};
    surveys.forEach(r => {
      const uid = (r[STU.FILLED_BY_ID] || '').trim();
      if (!uid) return;
      if (!surveysByScholar[uid]) surveysByScholar[uid] = [];
      surveysByScholar[uid].push(r);
    });

    return profiles.map(s => {
      const total = s.attended + s.absences;
      const staleFlag = !!(datasetMaxDate && s.lastAttendedSort && (datasetMaxDate - s.lastAttendedSort) / 86400000 > STALE_DAYS);
      const si = sessIdx && sessIdx[s.uid];
      const tutors = si ? [...si.tutors].sort() : [...new Set([...s.sessions].flatMap(sess => [...(tutorMap[sess] || [])]))].sort();
      const subjects = si ? [...si.subjects].sort() : [];
      const grades = s.rosterGrade ? [s.rosterGrade] : [];
      const weekly = {};
      s.weeklyRows.forEach(w => {
        if (!weekly[w.key]) weekly[w.key] = { label: w.label, attended: 0, absent: 0 };
        weekly[w.key].attended += w.attended; weekly[w.key].absent += w.absent;
      });
      const weeklyKeys = Object.keys(weekly).sort();
      const mySurveys = surveysByScholar[s.uid] || [];
      const overallVals = mySurveys.map(r => parseFloat(r[STU.OVERALL])).filter(v => !isNaN(v));
      const minutes = durMap ? [...s.attendedSessions].reduce((sum, sid) => sum + (durMap[sid] || 0), 0) : 0;
      return {
        ...s, total, rate: pct(s.attended, total), staleFlag, tutors, subjects, grades, minutes,
        overallAvg: overallVals.length ? Math.round(overallVals.reduce((a, b) => a + b, 0) / overallVals.length * 10) / 10 : null,
        weekly: weeklyKeys.map(k => ({ label: weekly[k].label, rate: pct(weekly[k].attended, weekly[k].attended + weekly[k].absent) })),
        surveys: mySurveys, surveyCount: mySurveys.length,
      };
    }).sort((a, b) => a.name.localeCompare(b.name));
  }

  let PROFILES_CACHE = [];
  const PROFILES_PAGE_SIZE = 10;
  let profilesPage = 1;
  let profilesShowAll = false;

  function renderProfiles() {
    const el = document.getElementById('view-profiles');
    const durMap = sessionDurationMap(BUNDLE.sessions || []);
    const profiles = scholarProfiles(scopedAttendance(), scopedScholarSurveys(), durMap);
    PROFILES_CACHE = profiles;
    profilesPage = 1;
    profilesShowAll = false;

    if (!profiles.length) {
      el.innerHTML = `<div class="pt-card pt-empty"><h3>No scholar profiles yet</h3><p>Profiles appear once a scholar has at least one attended session logged.</p></div>`;
      return;
    }

    el.innerHTML = `
      <div class="pt-profile-search-wrap">
        <input type="text" class="pt-profile-search" id="profileSearch" placeholder="Search by scholar name or Pearl ID…" autocomplete="off"/>
        <div class="pt-profile-suggest" id="profileSuggest" hidden></div>
      </div>
      <div class="pt-profile-grid" id="profileGrid"></div>
      <div class="pt-profile-pager" id="profilePager"></div>`;

    renderProfileGrid(profiles);

    document.getElementById('profileGrid').addEventListener('click', e => {
      const card = e.target.closest('.pt-profile-card');
      if (card) openScholarDetail(card.dataset.uid);
    });

    const searchInput = document.getElementById('profileSearch');
    const suggestBox = document.getElementById('profileSuggest');

    function currentMatches(q) {
      if (!q) return profiles;
      return profiles.filter(s => s.name.toLowerCase().includes(q) || s.uid.toLowerCase().includes(q));
    }

    searchInput.addEventListener('input', e => {
      const raw = e.target.value.trim();
      const q = raw.toLowerCase();
      const matches = currentMatches(q);

      // Type-ahead dropdown — up to 8 names, click one to jump straight to
      // that scholar rather than hunting through the (paginated) grid below.
      if (q && matches.length) {
        suggestBox.innerHTML = matches.slice(0, 8).map(s => `
          <button type="button" class="pt-profile-suggest-item" data-uid="${esc(s.uid)}">
            <span>${esc(s.name)}</span><span class="pt-profile-suggest-id">${esc(s.uid)}</span>
          </button>`).join('');
        suggestBox.hidden = false;
      } else {
        suggestBox.hidden = true;
        suggestBox.innerHTML = '';
      }

      profilesPage = 1;
      renderProfileGrid(matches, raw);
    });
    searchInput.addEventListener('blur', () => {
      // Delay so a click on a suggestion registers before the list vanishes.
      setTimeout(() => { suggestBox.hidden = true; }, 150);
    });
    suggestBox.addEventListener('click', e => {
      const item = e.target.closest('.pt-profile-suggest-item');
      if (!item) return;
      suggestBox.hidden = true;
      searchInput.value = '';
      renderProfileGrid(profiles);
      openScholarDetail(item.dataset.uid);
    });
  }

  function renderProfileGrid(list, queryForEmptyMsg) {
    const grid = document.getElementById('profileGrid');
    const pager = document.getElementById('profilePager');
    if (!grid) return;

    if (!list.length) {
      grid.innerHTML = `<p style="color:var(--muted);font-size:.85rem">No scholars match "${esc(queryForEmptyMsg || '')}".</p>`;
      grid.classList.remove('pt-profile-grid-scroll');
      pager.innerHTML = '';
      return;
    }

    const totalPages = Math.max(1, Math.ceil(list.length / PROFILES_PAGE_SIZE));
    if (profilesPage > totalPages) profilesPage = totalPages;

    if (profilesShowAll) {
      grid.classList.add('pt-profile-grid-scroll');
      grid.innerHTML = list.map(profileCardHtml).join('');
    } else {
      grid.classList.remove('pt-profile-grid-scroll');
      const start = (profilesPage - 1) * PROFILES_PAGE_SIZE;
      grid.innerHTML = list.slice(start, start + PROFILES_PAGE_SIZE).map(profileCardHtml).join('');
    }

    if (list.length <= PROFILES_PAGE_SIZE) {
      pager.innerHTML = '';
      return;
    }

    pager.innerHTML = profilesShowAll
      ? `<span class="pt-profile-pager-count">Showing all ${list.length} scholars</span>
         <button type="button" class="pt-profile-pager-btn" id="profilePagedBtn">Show 10 per page</button>`
      : `<button type="button" class="pt-profile-pager-btn" id="profilePrevBtn" ${profilesPage === 1 ? 'disabled' : ''}>Prev</button>
         <span class="pt-profile-pager-count">Page ${profilesPage} of ${totalPages} · ${list.length} scholars</span>
         <button type="button" class="pt-profile-pager-btn" id="profileNextBtn" ${profilesPage === totalPages ? 'disabled' : ''}>Next</button>
         <button type="button" class="pt-profile-pager-btn pt-profile-pager-all" id="profileShowAllBtn">Show all</button>`;

    const prev = document.getElementById('profilePrevBtn');
    const next = document.getElementById('profileNextBtn');
    const showAllBtn = document.getElementById('profileShowAllBtn');
    const pagedBtn = document.getElementById('profilePagedBtn');
    if (prev) prev.addEventListener('click', () => { profilesPage--; renderProfileGrid(list, queryForEmptyMsg); });
    if (next) next.addEventListener('click', () => { profilesPage++; renderProfileGrid(list, queryForEmptyMsg); });
    if (showAllBtn) showAllBtn.addEventListener('click', () => { profilesShowAll = true; renderProfileGrid(list, queryForEmptyMsg); });
    if (pagedBtn) pagedBtn.addEventListener('click', () => { profilesShowAll = false; profilesPage = 1; renderProfileGrid(list, queryForEmptyMsg); });
  }

  function profileCardHtml(s) {
    const cls = s.rate == null ? '' : s.rate >= 90 ? 'pt-pill-good' : s.rate >= 75 ? 'pt-pill-warn' : 'pt-pill-bad';
    return `<button class="pt-profile-card" data-uid="${esc(s.uid)}" type="button">
      <div class="pt-profile-card-name">${esc(s.name)}</div>
      <div class="pt-profile-card-id">${esc(s.uid)}${s.school ? ' · ' + esc(s.school) : ''}</div>
      ${s.subjects.length || s.grades.length ? `<div class="pt-profile-card-id">${esc([s.subjects.join(' / '), s.grades.join(', ')].filter(Boolean).join(' · '))}</div>` : ''}
      <div class="pt-profile-card-foot">
        <span class="pt-pill ${cls}">${s.rate == null ? '—' : s.rate + '%'} attended</span>
        <span style="font-size:.72rem;color:var(--muted)">${s.total} session${s.total === 1 ? '' : 's'}</span>
      </div>
      <div class="pt-flag-row">
        ${s.ctFlag ? '<span class="pt-flag pt-flag-ct">Teacher Pull-Out</span>' : ''}
        ${s.absences > 0 ? `<span class="pt-flag pt-flag-early">${s.absences} Absence${s.absences === 1 ? '' : 's'}</span>` : ''}
        ${s.staleFlag ? '<span class="pt-flag pt-flag-stale">2+ Weeks Since Attended</span>' : ''}
      </div>
    </button>`;
  }

  function openScholarDetail(uid) {
    const s = PROFILES_CACHE.find(p => p.uid === uid);
    if (!s) return;
    document.getElementById('scholarModalName').textContent = s.name;

    const surveyAvg = key => {
      const vals = s.surveys.map(r => parseFloat(r[STU[key]])).filter(v => !isNaN(v));
      return vals.length ? (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1) : null;
    };
    const comments = s.surveys.map(r => ({ date: (r[STU.DATE] || '').trim(), text: CORE.partnerSafeText((r[STU.COMMENT] || '').trim()) })).filter(c => c.text);

    document.getElementById('scholarModalBody').innerHTML = `
      <div class="pt-scholar-section">
        <div class="pt-scholar-section-title">Identity</div>
        <p style="font-size:.85rem;color:var(--text-2)">Pearl ID <b>${esc(s.uid)}</b> · ${esc(s.school || s.district || 'School not recorded')}</p>
        <p style="font-size:.85rem;color:var(--text-2);margin-top:.3rem">Content: <b>${esc(s.subjects.join(', ') || '—')}</b> · Grade level: <b>${esc(s.grades.join(', ') || '—')}</b></p>
        <p style="font-size:.85rem;color:var(--text-2);margin-top:.3rem">Overall survey rating: <b style="color:${s.overallAvg == null ? 'inherit' : s.overallAvg >= 4 ? BRAND.pos : s.overallAvg >= 3 ? '#b45309' : BRAND.neg}">${s.overallAvg == null ? '—' : s.overallAvg.toFixed(1) + ' / 5'}</b>${s.surveyCount ? ` <span style="color:var(--muted)">(${s.surveyCount} survey${s.surveyCount === 1 ? '' : 's'}, based on the filters selected)</span>` : ''}</p>
      </div>
      <div class="pt-scholar-section">
        <div class="pt-scholar-section-title">Tutors</div>
        <p style="font-size:.75rem;color:var(--muted);margin-bottom:.4rem">All tutors and substitute tutors who have supported this scholar this school year (based on the filters selected).</p>
        ${s.tutors.length ? s.tutors.map(t => `<span class="pt-tutor-chip">${esc(t)}</span>`).join('') : `<p style="font-size:.85rem;color:var(--muted)">No tutor on record for these sessions.</p>`}
      </div>
      <div class="pt-scholar-section">
        <div class="pt-scholar-section-title">Attendance</div>
        <div class="pt-kpi-val" style="font-size:1.8rem">${s.rate == null ? '—' : s.rate + '%'}</div>
        ${quickBar('Attended', s.attended, s.total, BRAND.pos)}
        ${quickBar('Missed', s.absences, s.total, BRAND.neg)}
        ${s.excused ? `<p style="font-size:.72rem;color:var(--muted);margin-top:.4rem">${s.excused} additional excused session${s.excused === 1 ? '' : 's'} not counted here.</p>` : ''}
        <p style="font-size:.78rem;color:var(--text-2);margin-top:.5rem">Last attended: <b>${esc(s.lastAttended || 'never')}</b></p>
        ${hasSessionData() ? `<p style="font-size:.78rem;color:var(--text-2);margin-top:.25rem">Tutoring minutes received: <b>${s.minutes.toLocaleString()} min</b> (${(s.minutes / 60).toFixed(1)} hrs)</p>` : ''}
      </div>
      ${s.weekly.length ? `<div class="pt-scholar-section">
        <div class="pt-scholar-section-title">Attendance by Week</div>
        ${distRows(s.weekly.map(w => [w.label, w.rate == null ? 0 : w.rate]), null, BRAND.blue)}
      </div>` : ''}
      ${s.missed.length ? `<div class="pt-scholar-section">
        <div class="pt-scholar-section-title">Missed Sessions</div>
        <table class="pt-table"><thead><tr><th>Date</th><th>Reason</th></tr></thead><tbody>
          ${s.missed.slice().sort((a, b) => (parseDate(b.date) || 0) - (parseDate(a.date) || 0)).map(m => `<tr><td>${esc(m.date)}</td><td>${esc(m.reason)}</td></tr>`).join('')}
        </tbody></table>
      </div>` : ''}
      <div class="pt-scholar-section">
        <div class="pt-scholar-section-title">Survey Responses (${s.surveyCount})</div>
        ${s.surveyCount ? `
          <div style="display:flex;gap:1.5rem;flex-wrap:wrap;margin-bottom:.9rem">
            ${['CONFIDENCE', 'ENJOYMENT', 'LEARNING', 'OVERALL'].map(k => `<div><div class="pt-kpi-val" style="font-size:1.3rem">${surveyAvg(k) ?? '—'}</div><div class="pt-kpi-sub" style="text-transform:capitalize">${k.toLowerCase()}</div></div>`).join('')}
          </div>
          ${comments.length ? comments.slice().reverse().map(c => `<div class="pt-quote">"${esc(c.text)}"<div class="pt-quote-meta">${esc(c.date || '')}</div></div>`).join('') : `<p style="font-size:.85rem;color:var(--muted)">No written comments.</p>`}
        ` : `<p style="font-size:.85rem;color:var(--muted)">No survey responses from this scholar yet.</p>`}
      </div>`;

    document.getElementById('scholarModal').classList.add('open');
  }

  // ══════════════════════════════════════════════════════════════════════
  //  PROGRAM TEAM VIEW — tutor-side pages (Admin + Regional logins only)
  //  Same drill-down filters (district / school / week) as every other page.
  // ══════════════════════════════════════════════════════════════════════
  const TUTOR_TARGET = 90;        // tutor attendance goal (same as Pearl Ops)
  const isTutorRow = r => (r[ATT.ROLE] || '').trim() === 'Instructor';
  const dayOnly = v => { const t = String(v || '').trim(); const sp = t.indexOf(' '); return sp < 0 ? t : t.slice(0, sp); };
  const avg1 = a => a.length ? Math.round(a.reduce((x, y) => x + y, 0) / a.length * 10) / 10 : null;
  const tutorColor = t => bandColor('tutor', t.attended, t.sessions, t.rate);
  const ratingColor = v => v == null ? '#7d8fa1' : v >= 4 ? BRAND.pos : v >= 3 ? '#b45309' : BRAND.neg;

  function tutorStatsOf(attRows) {
    let attended = 0, absent = 0, excused = 0;
    attRows.forEach(r => {
      if (!isTutorRow(r)) return;
      const c = classifyAtt(r);
      if (c === 'attended') attended++; else if (c === 'absent') absent++; else if (c === 'si') excused++;
    });
    return { attended, absent, excused, rate: pct(attended, attended + absent) };
  }

  // A session is "incomplete" when Pearl still shows it as Scheduled after
  // its date — attendance was never taken. Counted once per Pearl session.
  function asOfDay() { const d = BUNDLE && BUNDLE.generatedAt ? new Date(BUNDLE.generatedAt) : new Date(); d.setHours(0, 0, 0, 0); return d; }
  function incompleteSessions() {
    if (!hasSessionData()) return [];
    const today = asOfDay(), seen = new Set();
    return scopedSessions().filter(r => {
      if ((r[SESS.STATUS] || '').trim() !== 'Scheduled') return false;
      const d = parseDate(dayOnly(r[SESS.START]));
      if (!d || d >= today) return false;
      const id = (r[SESS.SESS_ID] || '').trim() || [r[SESS.TITLE], r[SESS.SCHOOL], r[SESS.START]].join('|');
      if (seen.has(id)) return false;
      seen.add(id); return true;
    });
  }

  // One record per tutor (Pearl instructor) in the current view.
  function tutorRoster() {
    const T = {};
    const get = (id, name) => {
      const k = id || ('name:' + name.toLowerCase());
      if (!T[k]) T[k] = { id: id || '', name, schools: {}, attended: 0, absent: 0, excused: 0, missed: [], lastAttended: '', lastSort: null,
        scholars: new Set(), incomplete: 0, incompleteRows: [], blankMissed: 0, subjects: new Set(), grades: new Set(), stuPos: 0, stuN: 0, stuRatings: [], selfRatings: [] };
      return T[k];
    };
    const find = (id, name) => T[id] || T['name:' + String(name || '').toLowerCase()] || null;
    scopedAttendance().forEach(r => {
      if (!isTutorRow(r)) return;
      const name = (r[ATT.USER] || '').trim(); if (!name) return;
      const t = get((r[ATT.USER_ID] || '').trim(), name);
      const sc = (r[ATT.SCHOOL] || '').trim(); if (sc) t.schools[sc] = (t.schools[sc] || 0) + 1;
      const c = classifyAtt(r), reason = (r[ATT.MISS_REASON] || '').trim();
      if (c === 'attended') {
        t.attended++;
        const d = parseDate(dayOnly(r[ATT.SESS_DATE]));
        if (d && (!t.lastSort || d > t.lastSort)) { t.lastSort = d; t.lastAttended = (r[ATT.SESS_DATE] || '').trim(); }
      } else if (c === 'absent') {
        t.absent++;
        t.missed.push({ date: (r[ATT.SESS_DATE] || '').trim(), reason: reason || REASON_UNKNOWN, session: (r[ATT.SESSION] || '').trim() });
      } else if (c === 'si') {
        t.excused++;
        if ((r[ATT.ATT_STATUS] || '').trim() === 'Missed' && !reason) t.blankMissed++;
      }
    });
    if (hasSessionData()) {
      scopedSessions().forEach(r => {
        const name = (r[SESS.INSTRUCTOR] || '').trim(); if (!name) return;
        const st = (r[SESS.STATUS] || '').trim(); if (st === 'Cancelled' || st === 'Rescheduled') return;
        const t = get((r[SESS.INST_ID] || '').trim(), name);
        const sc = (r[SESS.SCHOOL] || '').trim(); if (sc && !(sc in t.schools)) t.schools[sc] = 0;
        (r[SESS.STU_IDS] || '').split(',').map(x => x.trim()).filter(Boolean).forEach(u => t.scholars.add(u));
        if ((r[SESS.SUBJECT] || '').trim()) t.subjects.add(r[SESS.SUBJECT].trim());
        // grade levels come from these scholars' roster grades (below)
      });
      incompleteSessions().forEach(r => {
        const name = (r[SESS.INSTRUCTOR] || '').trim(); if (!name) return;
        const t = get((r[SESS.INST_ID] || '').trim(), name);
        t.incomplete++; t.incompleteRows.push(r);
      });
    }
    // Tutor grade levels = the roster grades of the scholars they teach.
    const rosterGrade = {};
    scopedAttendance().forEach(r => { if (isScholarRow(r) && (r[ATT.GRADE] || '').trim()) rosterGrade[(r[ATT.USER_ID] || '').trim()] = r[ATT.GRADE].trim(); });
    Object.values(T).forEach(t => t.scholars.forEach(u => { if (rosterGrade[u]) t.grades.add(rosterGrade[u]); }));
    // Scholar surveys about the tutor (FILLED_FOR) → "scholars loving sessions"
    scopedScholarSurveys().forEach(r => {
      const v = parseFloat(r[STU.OVERALL]); if (isNaN(v)) return;
      const t = find((r[STU.FILLED_FOR_ID] || '').trim(), (r[STU.FILLED_FOR] || '').trim()); if (!t) return;
      t.stuN++; if (v >= 4) t.stuPos++; t.stuRatings.push(v);
    });
    // Tutor's own post-session ratings
    scopedTutorSurveys().forEach(r => {
      const v = parseFloat(r[INST.OVERALL]); if (isNaN(v)) return;
      const t = find((r[INST.FILLED_BY_ID] || '').trim(), (r[INST.FILLED_BY] || '').trim()); if (t) t.selfRatings.push(v);
    });
    return Object.values(T).map(t => {
      const schoolList = Object.entries(t.schools).sort((a, b) => b[1] - a[1]).map(e => e[0]);
      return Object.assign(t, { schoolList, school: schoolList[0] || '', rate: pct(t.attended, t.attended + t.absent),
        sessions: t.attended + t.absent, scholarCount: t.scholars.size, loving: t.stuN ? pct(t.stuPos, t.stuN) : null, stuAvg: avg1(t.stuRatings), selfAvg: avg1(t.selfRatings) });
    });
  }

  // Summary — second KPI row (tutor side)
  function tutorKpiRowHtml(attAll, tutorSurveys) {
    const st = tutorStatsOf(attAll);
    const locations = new Set();
    attAll.forEach(r => { const sc = (r[ATT.SCHOOL] || '').trim(); if (sc) locations.add(sc); });
    const staff = tutorRoster().filter(t => t.sessions > 0 || t.scholarCount > 0).length;
    const inc = incompleteSessions().length;
    let pos = 0, n = 0;
    tutorSurveys.forEach(r => { const v = parseFloat(r[INST.OVERALL]); if (isNaN(v)) return; n++; if (v >= 4) pos++; });
    return `<div class="pt-grid pt-grid-5" style="margin-bottom:1.1rem" id="tutorKpis">
        ${kpiCard(ICONS.check, BRAND.pos, st.rate == null ? '—' : st.rate + '%', 'Tutor Attendance', { view: 'tutorAtt' })}
        ${kpiCard(ICONS.school, BRAND.blue, locations.size.toLocaleString(), 'Number of Locations', { view: 'summary', anchor: 'tourSchools' })}
        ${kpiCard(ICONS.users, BRAND.gold, staff.toLocaleString(), 'Tutors &amp; Site Leaders', { view: 'summary', anchor: 'staffTiles' })}
        ${kpiCard(ICONS.roster, BRAND.neg, inc.toLocaleString(), 'Incomplete Sessions', { view: 'tutorAtt', anchor: 'tutorIncompletes', note: inc ? 'Pearl clean-up' : '' })}
        ${kpiCard(ICONS.heart, '#c0367a', n ? pct(pos, n) + '%' : '—', 'Tutors Loving Their Sessions', { view: 'tutor' })}
      </div>`;
  }

  // Summary — "Your Staff" tiles, lowest tutor attendance first
  function staffTilesHtml() {
    const list = tutorRoster().filter(t => t.sessions > 0 || t.scholarCount > 0)
      .sort((a, b) => (a.rate ?? 101) - (b.rate ?? 101) || a.name.localeCompare(b.name));
    if (!list.length) return '';
    const SHOW = 12;
    const tile = x => `<div class="pt-school-tile" style="--tile-c:${tutorColor(x)};cursor:default">
        <div class="pt-school-name">${esc(x.name)}</div>
        <div class="pt-staff-meta">${esc(x.school || '—')}${x.schoolList.length > 1 ? ' +' + (x.schoolList.length - 1) + ' more' : ''}</div>
        <div class="pt-school-rate">${x.rate == null ? '—' : x.rate + '%'}<span>attendance</span></div>
        <div class="pt-school-stats">
          <div><b>${x.scholarCount.toLocaleString()}</b> scholars</div>
          <div><b>${x.sessions.toLocaleString()}</b> sessions</div>
          <div><b>${x.loving == null ? '—' : x.loving + '%'}</b> scholars loving</div>
          <div><b>${x.incomplete}</b> incomplete</div>
        </div>
      </div>`;
    return `<div class="pt-card" style="margin-bottom:1.1rem" id="staffTiles">
      <div class="pt-card-title">${ICONS.users} Your Staff<span class="pt-card-title-note">${list.length} tutors &amp; site leaders · lowest tutor attendance first</span></div>
      <div class="pt-schools">${list.slice(0, SHOW).map(tile).join('')}</div>
      ${list.length > SHOW ? `<details style="margin-top:.75rem"><summary class="pt-more">Show all ${list.length}</summary><div class="pt-schools" style="margin-top:.75rem">${list.slice(SHOW).map(tile).join('')}</div></details>` : ''}
      <p style="font-size:.72rem;color:var(--muted);margin-top:.7rem">Attendance = the tutor's own attendance. Scholars loving = scholar surveys about this tutor rated 4–5 overall. Incomplete = sessions still open in Pearl.</p>
    </div>`;
  }

  // Tutor Attendance Tracking page
  function renderTutorAttendance() {
    const el = document.getElementById('view-tutorAtt'); if (!el) return;
    const rows = scopedAttendance().filter(isTutorRow);
    const inc = incompleteSessions();
    if (!rows.length && !inc.length) { el.innerHTML = noDataCard(); return; }
    const st = tutorStatsOf(rows);
    const wk = {};
    rows.forEach(r => {
      const c = classifyAtt(r); if (c !== 'attended' && c !== 'absent') return;
      const b = weekBucket(r[ATT.SESS_DATE]); if (!b) return;
      const w = wk[b.key] = wk[b.key] || { label: b.label, a: 0, m: 0 };
      if (c === 'attended') w.a++; else w.m++;
    });
    const keys = Object.keys(wk).sort();
    const roster = tutorRoster();
    const reasons = {};
    rows.forEach(r => { if (classifyAtt(r) !== 'absent') return; const k = (r[ATT.MISS_REASON] || '').trim() || REASON_UNKNOWN; reasons[k] = (reasons[k] || 0) + 1; });
    const reasonList = Object.entries(reasons).sort((a, b) => b[1] - a[1]);
    const reasonTotal = reasonList.reduce((a, [, n]) => a + n, 0);
    const blank = roster.reduce((a, t) => a + t.blankMissed, 0);
    const incByTutor = roster.filter(t => t.incomplete).sort((a, b) => b.incomplete - a.incomplete || a.name.localeCompare(b.name));
    const byDate = (a, b) => (parseDate(dayOnly(b[SESS.START])) || 0) - (parseDate(dayOnly(a[SESS.START])) || 0); // newest first

    el.innerHTML = `
      <div class="pt-grid pt-grid-main-side" style="margin-bottom:1.1rem">
        <div class="pt-card">
          <div class="pt-card-title">${ICONS.trend} Weekly Tutor Attendance Rate</div>
          <div class="pt-chart-wrap"><canvas id="chartTutorWeekly"></canvas></div>
        </div>
        <div class="pt-card">
          <div class="pt-card-title">Tutor Attendance Rate</div>
          <div class="pt-kpi-val pt-kpi-val-lg">${st.rate == null ? '—' : st.rate + '%'}</div>
          <div style="margin-top:1rem">
            ${quickBar('Attended', st.attended, st.attended + st.absent, BRAND.pos)}
            ${quickBar('Missed', st.absent, st.attended + st.absent, BRAND.neg)}
          </div>
          <p style="font-size:.72rem;color:var(--muted);margin-top:.6rem">Tutor-side misses only (absent, left early). ${st.excused.toLocaleString()} other missed sessions (school events, testing, closures) aren't counted. Goal: ${TUTOR_TARGET}%.</p>
        </div>
      </div>
      ${attendanceDetailHtml('tutor', tutorDetailList(roster))}
      <div class="pt-card" style="margin-bottom:1.1rem" id="tutorIncompletes">
        <div class="pt-card-title">${ICONS.roster} Tutor Incompletes<span class="pt-card-title-note">${inc.length.toLocaleString()} session${inc.length !== 1 ? 's' : ''} · ${incByTutor.length} tutor${incByTutor.length !== 1 ? 's' : ''} · Pearl clean-up</span></div>
        <p style="font-size:.82rem;color:var(--text-2);margin-bottom:.8rem">Sessions still marked <b>Scheduled</b> in Pearl after the session date — attendance was never taken, so the session doesn't count anywhere. The tutor (or Site Leader) completes or cancels each one in Pearl. Most incompletes first; click a name for every incomplete session.${blank ? ` Also ${blank.toLocaleString()} tutor attendance row${blank !== 1 ? 's are' : ' is'} marked Missed with no reason.` : ''}</p>
        ${incByTutor.length ? `<div id="tutorIncBox">${incByTutor.map((t, i) => {
          const list = t.incompleteRows.slice().sort(byDate);
          const oldest = list.length ? dayOnly(list[list.length - 1][SESS.START]) : '';
          return `<details class="pt-checkin" data-pg="${Math.floor(i / CHECKIN_PAGE)}"${i >= CHECKIN_PAGE ? ' hidden' : ''}>
            <summary>
              <span class="pt-checkin-id">${esc(t.id || '—')}</span>
              <span class="pt-checkin-name">${esc(t.name)} <span style="font-weight:400;color:var(--muted);font-size:.78rem">· ${esc(t.school || 'School not recorded')}${t.schoolList.length > 1 ? ' +' + (t.schoolList.length - 1) + ' more' : ''}</span></span>
              <span class="pt-checkin-stat"><span class="pt-pill pt-pill-bad">${t.incomplete} incomplete</span>
                <span style="color:var(--muted);font-size:.78rem">oldest ${esc(oldest || '—')}</span></span>
            </summary>
            <div class="pt-checkin-detail"><table><thead><tr><th>Date</th><th>Session</th><th>School</th></tr></thead><tbody>
              ${list.map(r => `<tr><td>${esc(dayOnly(r[SESS.START]))}</td><td>${esc(r[SESS.TITLE] || '—')}</td><td>${esc(r[SESS.SCHOOL] || '—')}</td></tr>`).join('')}
            </tbody></table></div>
          </details>`;
        }).join('')}${incByTutor.length > CHECKIN_PAGE ? pagerHtml('tutorIncBox', incByTutor.length) : ''}</div>`
        : `<p style="font-size:.85rem;color:var(--text-2)">${hasSessionData() ? 'No incomplete sessions in this view.' : 'Session data is not available yet.'}</p>`}
      </div>
      <div class="pt-card" style="margin-bottom:1.1rem">
        <div class="pt-card-title">${ICONS.search} Why Tutors Missed a Session</div>
        ${reasonList.length ? distRows(reasonList, reasonTotal, BRAND.blue) : `<p style="color:var(--muted);font-size:.85rem">No tutor-side missed sessions logged.</p>`}
      </div>`;
    drawRateLine('chartTutorWeekly', keys.map(k => wk[k].label), keys.map(k => pct(wk[k].a, wk[k].a + wk[k].m)), BRAND.pos, 'Tutor Attendance Rate');
  }

  // ── Tutor Profiles (Program Team only) ────────────────────────────────
  // One card per tutor in the current view: content, grade levels, overall
  // rating, scholars, attendance and apprentice status.
  //
  // Apprentice status comes from the TAP Tracker Master Roster (the same
  // sheet Central's TAP pages read), matched by name. Fetched only for
  // Program Team logins; only status/track are kept in memory.
  //   Is apprentice:            Yes = on the roster as an Apprentice, Pre-
  //                             apprentice or Completed Program (and not
  //                             cancelled/terminated/withdrawn); else No.
  //   Completed apprenticeship: Yes = Completed Program track or Completed
  //                             status · In progress = current apprentice ·
  //                             No = not an apprentice.
  const TAP_MR_URL = 'https://docs.google.com/spreadsheets/d/14UiE5ple1NYVQl5s9U085pFp50vKjnnwNQmsGS0AKJU/gviz/tq?tqx=out:csv&gid=45498361';
  const MR_COL = { status: 1, first: 2, last: 3, full: 5, track: 99 };
  const MR_STATUS_RE = /^(active|pending|reinstated|cancelled|canceled|terminated|completed|complete|inactive|on hold|paused|withdrawn)$/i;
  let TAP_STATUS = null; // null = not loaded · {} map · false = unavailable
  let _tapLoading = null;
  const looseName = v => String(v || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/\([^)]*\)/g, ' ').replace(/[^a-zA-Z\s'-]/g, ' ').toLowerCase().replace(/\s+/g, ' ').trim();
  const firstLastKey = v => { const p = looseName(v).split(' ').filter(Boolean); return p.length > 1 ? p[0] + ' ' + p[p.length - 1] : ''; };
  function apprenticeFromRoster(status, track) {
    const st = String(status || '').trim(), tr = String(track || '').trim();
    const role = !tr || /^apprentice/i.test(tr) ? 'Apprentice' : /^pre-apprentice/i.test(tr) ? 'Pre-apprentice' : /^completed/i.test(tr) ? 'Completed Program' : 'Tutor';
    if (role === 'Tutor') return { is: 'No', done: 'No', note: '' };
    if (role === 'Completed Program' || /^complete/i.test(st)) return { is: 'Yes', done: 'Yes', note: 'Completed Program' };
    if (/cancel|terminat|withdrawn|inactive/i.test(st)) return { is: 'No', done: 'No', note: 'Left the program (' + st + ')' };
    return { is: 'Yes', done: 'In progress', note: role + (st ? ' · ' + st : '') };
  }
  function loadTapStatus() {
    if (TAP_STATUS !== null || _tapLoading) return _tapLoading;
    _tapLoading = fetch(TAP_MR_URL + '&_=' + Date.now()).then(r => r.ok ? r.text() : Promise.reject(new Error('HTTP ' + r.status))).then(text => {
      if (text.trim().startsWith('<')) throw new Error('roster not shared');
      const map = {}, rank = { Yes: 3, 'In progress': 2, No: 1 };
      CORE.parseCSV(text).forEach(r => {
        const g = i => String(r[i] == null ? '' : r[i]).trim();
        if (!MR_STATUS_RE.test(g(MR_COL.status))) return;
        const name = g(MR_COL.full) || (g(MR_COL.first) + ' ' + g(MR_COL.last)).trim();
        if (name.length < 2) return;
        const a = apprenticeFromRoster(g(MR_COL.status), g(MR_COL.track));
        // A person can have more than one roster row (e.g. a cancelled
        // Summer row and an active SY row) — keep the strongest status.
        [looseName(name), 'fl:' + firstLastKey(name)].forEach(k => {
          if (!k || k === 'fl:') return;
          const cur = map[k];
          if (!cur || (rank[a.done] || 0) > (rank[cur.done] || 0) || (a.is === 'Yes' && cur.is === 'No')) map[k] = a;
        });
      });
      TAP_STATUS = map;
    }).catch(e => { console.warn('[Tutor Profiles] TAP roster unavailable:', e.message); TAP_STATUS = false; })
      .then(() => { _tapLoading = null; if (isProgramView() && document.getElementById('view-tutorProfiles')) renderTutorProfiles(true); });
    return _tapLoading;
  }
  function apprenticeOf(name) {
    if (TAP_STATUS === null) return { is: '…', done: '…', note: 'Checking the TAP roster…' };
    if (TAP_STATUS === false) return { is: '—', done: '—', note: 'TAP roster unavailable right now' };
    return TAP_STATUS[looseName(name)] || TAP_STATUS['fl:' + firstLastKey(name)] || { is: 'No', done: 'No', note: 'Not on the TAP roster' };
  }
  const ynClass = v => v === 'Yes' ? 'pt-pill-good' : v === 'In progress' ? 'pt-pill-mid' : v === 'No' ? 'pt-pill-zero' : '';

  let TUTOR_PROFILES = [];
  const TP = { q: '', page: 1 };
  function renderTutorProfiles(keepState) {
    const el = document.getElementById('view-tutorProfiles'); if (!el) return;
    if (TAP_STATUS === null) loadTapStatus();
    const nameOf = {};
    scopedAttendance().forEach(r => { if (isScholarRow(r)) { const u = (r[ATT.USER_ID] || '').trim(); if (u && !nameOf[u]) nameOf[u] = (r[ATT.USER] || '').trim(); } });
    TUTOR_PROFILES = tutorRoster().filter(t => t.sessions > 0 || t.scholarCount > 0 || t.incomplete > 0)
      .map(t => Object.assign(t, { tap: apprenticeOf(t.name), scholarNames: [...t.scholars].map(u => ({ uid: u, name: nameOf[u] || '' })).sort((a, b) => (a.name || '~').localeCompare(b.name || '~')) }))
      .sort((a, b) => a.name.localeCompare(b.name));
    if (!keepState) { TP.q = ''; TP.page = 1; }
    if (!TUTOR_PROFILES.length) {
      el.innerHTML = `<div class="pt-card pt-empty"><h3>No tutor profiles yet</h3><p>Profiles appear once a tutor has a session in Pearl for this view.</p></div>`;
      return;
    }
    const nApp = TUTOR_PROFILES.filter(t => t.tap.is === 'Yes').length;
    el.innerHTML = `
      <div class="pt-card" style="margin-bottom:1rem" id="tutorProfilesIntro">
        <div class="pt-card-title">${ICONS.users} Tutor Profiles<span class="pt-card-title-note">${TUTOR_PROFILES.length} tutor${TUTOR_PROFILES.length !== 1 ? 's' : ''}${TAP_STATUS ? ' · ' + nApp + ' apprentice' + (nApp !== 1 ? 's' : '') : ''}</span></div>
        <p style="font-size:.82rem;color:var(--text-2)">Content, grade levels, overall rating, scholars, attendance and apprentice status for every tutor in this view. Click a card for the full profile. Apprentice status comes from the TAP Tracker roster, matched by name.</p>
      </div>
      <div class="pt-profile-search-wrap">
        <input type="text" class="pt-profile-search" id="tutorProfileSearch" placeholder="Search by tutor name, Pearl ID or school…" autocomplete="off" value="${esc(TP.q)}"/>
      </div>
      <div class="pt-profile-grid" id="tutorProfileGrid"></div>
      <div class="pt-profile-pager" id="tutorProfilePager"></div>`;
    drawTutorGrid();
    const input = document.getElementById('tutorProfileSearch');
    input.addEventListener('input', e => { TP.q = e.target.value; TP.page = 1; drawTutorGrid(); });
    document.getElementById('tutorProfileGrid').addEventListener('click', e => {
      const card = e.target.closest('.pt-profile-card'); if (card) openTutorDetail(card.dataset.key);
    });
  }
  function tutorKey(t) { return t.id || ('name:' + t.name.toLowerCase()); }
  function drawTutorGrid() {
    const grid = document.getElementById('tutorProfileGrid'), pager = document.getElementById('tutorProfilePager');
    if (!grid) return;
    const q = TP.q.trim().toLowerCase();
    const list = q ? TUTOR_PROFILES.filter(t => t.name.toLowerCase().includes(q) || (t.id || '').toLowerCase().includes(q) || t.schoolList.some(sc => sc.toLowerCase().includes(q))) : TUTOR_PROFILES;
    if (!list.length) { grid.innerHTML = `<p style="color:var(--muted);font-size:.85rem">No tutors match "${esc(TP.q)}".</p>`; pager.innerHTML = ''; return; }
    const pages = Math.max(1, Math.ceil(list.length / PROFILES_PAGE_SIZE));
    TP.page = Math.min(Math.max(1, TP.page), pages);
    const start = (TP.page - 1) * PROFILES_PAGE_SIZE;
    grid.innerHTML = list.slice(start, start + PROFILES_PAGE_SIZE).map(tutorCardHtml).join('');
    pager.innerHTML = list.length <= PROFILES_PAGE_SIZE ? '' :
      `<button type="button" class="pt-profile-pager-btn" ${TP.page === 1 ? 'disabled' : ''} onclick="NJTCPartnerNav.tutorPage(-1)">Prev</button>
       <span class="pt-profile-pager-count">Page ${TP.page} of ${pages} · ${list.length} tutors</span>
       <button type="button" class="pt-profile-pager-btn" ${TP.page === pages ? 'disabled' : ''} onclick="NJTCPartnerNav.tutorPage(1)">Next</button>`;
  }
  const rating = v => v == null ? '—' : v.toFixed(1) + ' / 5';
  function tutorCardHtml(t) {
    const cls = bandPillClass('tutor', t.attended, t.sessions, t.rate);
    return `<button class="pt-profile-card" data-key="${esc(tutorKey(t))}" type="button">
      <div class="pt-profile-card-name">${esc(t.name)}</div>
      <div class="pt-profile-card-id">${esc(t.id || '—')}${t.school ? ' · ' + esc(t.school) : ''}${t.schoolList.length > 1 ? ' +' + (t.schoolList.length - 1) : ''}</div>
      <div class="pt-profile-card-id">${esc([[...t.subjects].sort().join(' / '), [...t.grades].sort(gradeSort).join(', ') ? 'Gr. ' + [...t.grades].sort(gradeSort).join(', ') : ''].filter(Boolean).join(' · ') || 'Content / grade not recorded')}</div>
      <div class="pt-profile-card-foot">
        <span class="pt-pill ${cls}">${t.rate == null ? '—' : t.rate + '%'} attended</span>
        <span style="font-size:.72rem;color:var(--muted)">${t.scholarCount} scholar${t.scholarCount === 1 ? '' : 's'} · rating ${rating(t.stuAvg)}</span>
      </div>
      <div class="pt-flag-row">
        <span class="pt-pill ${ynClass(t.tap.is)}" style="font-size:.66rem">Apprentice: ${esc(t.tap.is)}</span>
        <span class="pt-pill ${ynClass(t.tap.done)}" style="font-size:.66rem">Completed: ${esc(t.tap.done)}</span>
        ${t.incomplete ? `<span class="pt-flag pt-flag-early">${t.incomplete} Incomplete</span>` : ''}
      </div>
    </button>`;
  }
  function openTutorDetail(key) {
    const t = TUTOR_PROFILES.find(x => tutorKey(x) === key); if (!t) return;
    document.getElementById('scholarModalName').textContent = t.name;
    const subjects = [...t.subjects].sort(), grades = [...t.grades].sort(gradeSort);
    document.getElementById('scholarModalBody').innerHTML = `
      <div class="pt-scholar-section">
        <div class="pt-scholar-section-title">Identity</div>
        <p style="font-size:.85rem;color:var(--text-2)">Pearl ID <b>${esc(t.id || '—')}</b> · ${esc(t.schoolList.join(', ') || 'School not recorded')}</p>
        <p style="font-size:.85rem;color:var(--text-2);margin-top:.3rem">Content: <b>${esc(subjects.join(', ') || '—')}</b> · Grade levels: <b>${esc(grades.join(', ') || '—')}</b></p>
      </div>
      <div class="pt-scholar-section">
        <div class="pt-scholar-section-title">Apprentice Status</div>
        <div style="display:flex;gap:1.5rem;flex-wrap:wrap">
          <div><div class="pt-kpi-sub">Is apprentice</div><span class="pt-pill ${ynClass(t.tap.is)}">${esc(t.tap.is)}</span></div>
          <div><div class="pt-kpi-sub">Completed apprenticeship</div><span class="pt-pill ${ynClass(t.tap.done)}">${esc(t.tap.done)}</span></div>
        </div>
        ${t.tap.note ? `<p style="font-size:.72rem;color:var(--muted);margin-top:.45rem">${esc(t.tap.note)} · from the TAP Tracker roster, matched by name.</p>` : ''}
      </div>
      <div class="pt-scholar-section">
        <div class="pt-scholar-section-title">Overall Rating</div>
        <div style="display:flex;gap:1.5rem;flex-wrap:wrap">
          <div><div class="pt-kpi-val" style="font-size:1.4rem;color:${ratingColor(t.stuAvg)}">${rating(t.stuAvg)}</div><div class="pt-kpi-sub">from scholars (${t.stuN} survey${t.stuN === 1 ? '' : 's'})</div></div>
          <div><div class="pt-kpi-val" style="font-size:1.4rem;color:${ratingColor(t.selfAvg)}">${rating(t.selfAvg)}</div><div class="pt-kpi-sub">tutor's own post-session (${t.selfRatings.length})</div></div>
          <div><div class="pt-kpi-val" style="font-size:1.4rem">${t.loving == null ? '—' : t.loving + '%'}</div><div class="pt-kpi-sub">scholars loving sessions</div></div>
        </div>
      </div>
      <div class="pt-scholar-section">
        <div class="pt-scholar-section-title">Attendance</div>
        <div class="pt-kpi-val" style="font-size:1.8rem;color:${bandColor('tutor', t.attended, t.sessions, t.rate)}">${t.rate == null ? '—' : t.rate + '%'}</div>
        ${quickBar('Attended', t.attended, t.sessions, BRAND.pos)}
        ${quickBar('Missed', t.absent, t.sessions, BRAND.neg)}
        <p style="font-size:.78rem;color:var(--text-2);margin-top:.5rem">Last attended: <b>${esc(t.lastAttended || 'never')}</b>${t.excused ? ` · ${t.excused} excused not counted` : ''}${t.incomplete ? ` · <b style="color:${BRAND.neg}">${t.incomplete} incomplete</b> in Pearl` : ''}</p>
      </div>
      <div class="pt-scholar-section">
        <div class="pt-scholar-section-title">Scholars (${t.scholarCount})</div>
        <p style="font-size:.75rem;color:var(--muted);margin-bottom:.4rem">Scholars on this tutor's Pearl sessions (based on the filters selected).</p>
        ${t.scholarNames.length ? t.scholarNames.map(x => `<span class="pt-tutor-chip">${esc(x.name || x.uid)}</span>`).join('') : '<p style="font-size:.85rem;color:var(--muted)">No scholars on record for these sessions.</p>'}
      </div>
      ${t.missed.length ? `<div class="pt-scholar-section">
        <div class="pt-scholar-section-title">Missed Sessions</div>
        <table class="pt-table"><thead><tr><th>Date</th><th>Session</th><th>Reason</th></tr></thead><tbody>
          ${t.missed.slice().sort((a, b) => (parseDate(b.date) || 0) - (parseDate(a.date) || 0)).map(m => `<tr><td>${esc(m.date)}</td><td>${esc(m.session || '—')}</td><td>${esc(m.reason)}</td></tr>`).join('')}
        </tbody></table></div>` : ''}`;
    document.getElementById('scholarModal').classList.add('open');
  }

  // Survey pages — every comment in the current view, grouped by the person
  // who wrote it; the number is that person's average Overall rating.
  function surveyCommentsHtml(kind, rows) {
    const sch = kind === 'scholar';
    const C = sch ? { id: STU.FILLED_BY_ID, name: STU.FILLED_BY, text: STU.COMMENT, date: STU.DATE, overall: STU.OVERALL, school: STU.SCHOOL }
                  : { id: INST.FILLED_BY_ID, name: INST.FILLED_BY, text: INST.COMMENT_ADMIN, date: INST.DATE, overall: INST.OVERALL, school: INST.SCHOOL };
    const G = {};
    rows.forEach(r => {
      const name = (r[C.name] || '').trim(); if (!name) return;
      const id = (r[C.id] || '').trim(), k = id || name.toLowerCase();
      const g = G[k] = G[k] || { id, name, school: (r[C.school] || '').trim(), ratings: [], comments: [] };
      const v = parseFloat(r[C.overall]); if (!isNaN(v)) g.ratings.push(v);
      const t = (r[C.text] || '').trim();
      if (t) g.comments.push({ date: dayOnly(r[C.date]), sort: parseDate(dayOnly(r[C.date])) || 0, text: t, rating: isNaN(v) ? '' : v, tutor: sch ? (r[STU.FILLED_FOR] || '').trim() : '' });
    });
    const list = Object.values(G).filter(g => g.comments.length).map(g => Object.assign(g, { avg: avg1(g.ratings) }))
      .sort((a, b) => (a.avg ?? 6) - (b.avg ?? 6) || a.name.localeCompare(b.name));
    const nComments = list.reduce((a, g) => a + g.comments.length, 0);
    const box = 'cmtBox-' + kind;
    const who = sch ? 'scholar' : 'tutor';
    return `<div class="pt-card" style="margin-top:1.1rem" id="${kind}Comments">
      <div class="pt-card-title">${ICONS.sparkle} ${sch ? 'Scholar' : 'Tutors’'} Session Comments<span class="pt-card-title-note">${list.length.toLocaleString()} ${who}${list.length !== 1 ? 's' : ''} · ${nComments.toLocaleString()} comment${nComments !== 1 ? 's' : ''}</span></div>
      <p style="font-size:.82rem;color:var(--text-2);margin-bottom:.8rem">Each ${who}’s comments per session, based on the filters above. The number is that ${who}’s <b>average Overall rating</b> (1–5) across all their sessions in this view — lowest first.${sch ? '' : ' Shows the "comment for admin" field; tutors’ private notes to themselves are not shown.'}</p>
      ${list.length ? `<div id="${box}">${list.map((g, i) => `
        <details class="pt-cmt-group" data-pg="${Math.floor(i / CHECKIN_PAGE)}"${i >= CHECKIN_PAGE ? ' hidden' : ''}>
          <summary><span class="pt-cmt-id">${esc(g.id || '—')}</span><span class="pt-cmt-name">${esc(g.name)} <span style="font-weight:400;color:var(--muted);font-size:.75rem">· ${esc(g.school)}</span></span>
            <span class="pt-cmt-n">${g.comments.length} comment${g.comments.length !== 1 ? 's' : ''} · ${g.ratings.length} rated</span>
            <span class="pt-cmt-avg" style="color:${ratingColor(g.avg)}">${g.avg == null ? '—' : g.avg.toFixed(1)}</span></summary>
          <table><thead><tr><th>Date</th><th>Rating</th>${sch ? '<th>Tutor</th>' : ''}<th>Comment</th></tr></thead><tbody>
            ${g.comments.slice().sort((a, b) => b.sort - a.sort).map(c => `<tr><td style="white-space:nowrap">${esc(c.date)}</td><td>${c.rating === '' ? '—' : c.rating}</td>${sch ? `<td>${esc(c.tutor)}</td>` : ''}<td>${esc(c.text)}</td></tr>`).join('')}
          </tbody></table>
        </details>`).join('')}
        ${list.length > CHECKIN_PAGE ? pagerHtml(box, list.length) : ''}</div>`
      : `<p style="font-size:.85rem;color:var(--muted)">No written comments in this view.</p>`}
    </div>`;
  }

  // ══════════════════════════════════════════════════════════════════════
  //  CURATED "HIGHLIGHTS" — positive-only, per partner-relationship policy
  // ══════════════════════════════════════════════════════════════════════
  // Scholar comments first, tutor comments only top up the list; rotates
  // weekly (the drill-down week, or the latest week with a good comment).
  // Filtering rules + the NJTC exclusion list live in partner-report.js.
  function sessionHighlights() {
    const place = { district: SCOPE.district, school: SCOPE.school, week: 'ALL' };
    return CORE.curateHighlights({
      scholarSurveys: CORE.scoped(BUNDLE.scholarSurveys, STU.DISTRICT, STU.SCHOOL, STU.DATE, place),
      tutorSurveys: CORE.scoped(BUNDLE.tutorSurveys, INST.DISTRICT, INST.SCHOOL, INST.DATE, place),
      attendance: CORE.scoped(BUNDLE.attendance, ATT.DISTRICT, ATT.SCHOOL, ATT.SESS_DATE, place)
    }, { week: SCOPE.week, exclusions: EXCLUSIONS });
  }

  // ══════════════════════════════════════════════════════════════════════
  //  PARTNER LENSES — district partners (many schools) see every school at a
  //  glance and click into one; school partners see only their school.
  // ══════════════════════════════════════════════════════════════════════
  const CT_PULL_SHARE = 10; // % of missed sessions — same threshold NJTC uses internally

  function bundleSchools() {
    const set = new Set();
    (BUNDLE.attendance || []).forEach(r => {
      const d = (r[ATT.DISTRICT] || '').trim(), sc = (r[ATT.SCHOOL] || '').trim();
      if (sc && (SCOPE.district === 'ALL' || d === SCOPE.district) && (SCOPE.region === 'ALL' || regionOfDistrict(d) === SCOPE.region)) set.add(sc);
    });
    return [...set].sort();
  }
  // District lens = the account spans several schools and none is picked yet.
  function isDistrictLens() { return SCOPE.school === 'ALL' && bundleSchools().length > 1; }
  function multiSchoolAccount() { return bundleSchools().length > 1 || SCOPE.school !== 'ALL'; }

  // "Kept in class" — a classroom teacher kept the scholar during tutoring.
  // Counted as a missed session (it is the scholar's dosage), shown so the
  // school can act on it.
  function keptInClass(attRows) {
    const rows = attRows.filter(r => isScholarRow(r) && (r[ATT.ATT_STATUS] || '').trim() === 'Missed' && CT_REASONS.has((r[ATT.MISS_REASON] || '').trim()));
    const byScholar = {};
    rows.forEach(r => {
      const k = (r[ATT.USER_ID] || r[ATT.USER] || '').trim();
      if (!byScholar[k]) byScholar[k] = { uid: (r[ATT.USER_ID] || '').trim(), name: (r[ATT.USER] || '').trim(), n: 0, sessions: {} };
      byScholar[k].n++;
      // Session Name from Session Details — usually the classroom teacher's name.
      const sn = (r[ATT.SESSION] || '').trim();
      if (sn) byScholar[k].sessions[sn] = (byScholar[k].sessions[sn] || 0) + 1;
    });
    return { count: rows.length, scholars: Object.values(byScholar).sort((a, b) => b.n - a.n) };
  }

  function schoolMetrics(name) {
    const inSchool = r => (r[ATT.SCHOOL] || '').trim() === name;
    const att = scopedAttendance().filter(inSchool);
    const st = scholarStats(att);
    const kept = keptInClass(att);
    return {
      name, rate: st.rate, served: CORE.servedScholars(att), checkIns: scholarsToCheckIn(st.rows).length,
      loving: CORE.lovingPct(scopedScholarSurveys().filter(r => (r[STU.SCHOOL] || '').trim() === name)),
      kept: kept.count, keptScholars: kept.scholars.length, keptShare: st.absent ? Math.round(kept.count / st.absent * 100) : 0,
    };
  }

  const rateColor = r => r == null ? '#7d8fa1' : r >= 80 ? BRAND.pos : r >= 75 ? '#b45309' : BRAND.neg;

  function openSchool(name) {
    const sel = document.getElementById('scopeSchool');
    if (sel && [...sel.options].some(o => o.value === name)) { sel.value = name; sel.dispatchEvent(new Event('change')); }
    else { SCOPE.school = name; renderAll(); }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  function backToAllSchools() {
    const sel = document.getElementById('scopeSchool');
    if (sel) { sel.value = 'ALL'; sel.dispatchEvent(new Event('change')); }
    else { SCOPE.school = 'ALL'; renderAll(); }
  }
  function goTab(view) { const t = document.querySelector(`.pt-tab[data-view="${view}"]`); if (t) t.click(); }
  // KPI tiles drill into the tab (and card) that explains the number.
  function drill(view, anchor) {
    goTab(view);
    const el = anchor && document.getElementById(anchor);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      el.classList.remove('pt-flash'); void el.offsetWidth; el.classList.add('pt-flash');
    } else window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  window.NJTCPartnerNav = { openSchool, backToAllSchools, goTab, drill, isDistrictLens: () => isDistrictLens(), isProgramView: () => isProgramView() };

  function contactCardHtml(id) {
    const c = CORE.contactsFor(id);
    const where = SCOPE.school !== 'ALL' ? SCOPE.school : (id.district && id.district !== 'ALL' ? id.district : 'my program');
    const subject = 'NJTC tutoring - ' + where;
    return `<div class="pt-contact" id="tourContact">
      <div class="pt-contact-title">Questions? Email NJTC</div>
      ${c.programManagers.map(p => `<a href="${CORE.mailtoHref(p.email, subject)}">${esc(p.name)} &middot; Program Management</a>`).join('')}
      <a href="${CORE.mailtoHref(c.data.email, 'NJTC dashboard data question - ' + where)}">${esc(c.data.name)} &middot; Data questions</a>
      <small>Program questions go to Program Management; questions about a number go to the Data team.</small>
    </div>`;
  }

  // At most four short lines — what a busy partner should look at first.
  function attentionHtml(schoolList) {
    const items = [];
    const attAll = scopedAttendance();
    const st = scholarStats(attAll);
    const checkIns = scholarsToCheckIn(st.rows).length;
    if (schoolList) {
      const low = schoolList.filter(x => x.rate != null && x.rate < 80).sort((a, b) => a.rate - b.rate);
      if (low.length) items.push({ c: BRAND.neg, html: `<b>${low.length} school${low.length !== 1 ? 's' : ''} below 80% attendance:</b> ${low.slice(0, 3).map(x => esc(x.name) + ' (' + x.rate + '%)').join(', ')}${low.length > 3 ? '…' : ''}` });
      const kept = schoolList.filter(x => x.keptShare > CT_PULL_SHARE && x.kept > 0).sort((a, b) => b.kept - a.kept);
      if (kept.length) items.push({ c: BRAND.gold, html: `<b>Scholars kept in class during tutoring</b> at ${kept.slice(0, 3).map(x => esc(x.name) + ' (' + x.kept + ')').join(', ')}${kept.length > 3 ? ' and ' + (kept.length - 3) + ' more' : ''} — each one is a missed tutoring session.` });
    } else {
      if (st.rate != null && st.rate < 80) items.push({ c: BRAND.neg, html: `<b>Attendance is ${st.rate}%</b> — the goal is 80% or higher.` });
      const kept = keptInClass(attAll);
      const share = st.absent ? Math.round(kept.count / st.absent * 100) : 0;
      if (kept.count && share > CT_PULL_SHARE) items.push({ c: BRAND.gold, html: `<b>Scholars were kept in class during tutoring ${kept.count} time${kept.count !== 1 ? 's' : ''}</b> (${share}% of missed sessions). <a onclick="NJTCPartnerNav.goTab('attendance')">See who &rarr;</a>` });
    }
    if (checkIns) items.push({ c: BRAND.blue, html: `<b>${checkIns.toLocaleString()} scholar${checkIns !== 1 ? 's' : ''} to check in with</b> — a pattern of missed sessions. <a onclick="NJTCPartnerNav.goTab('attendance')">View list &rarr;</a>` });
    if (!items.length) items.push({ c: BRAND.pos, html: '<b>Everything is on track</b> — attendance is at goal and no scholars are flagged for a check-in.' });
    return `<div class="pt-card pt-attn" id="tourAttention">
      <div class="pt-card-title">${ICONS.search} What needs your attention</div>
      <ul>${items.slice(0, 4).map(i => `<li><span class="dot" style="background:${i.c}"></span><span>${i.html}</span></li>`).join('')}</ul>
    </div>`;
  }

  function schoolTilesHtml(list) {
    return `<div class="pt-card" style="margin-bottom:1.1rem" id="tourSchools">
      <div class="pt-card-title">${ICONS.roster} Your Schools<span class="pt-card-title-note">Click a school for its full view</span></div>
      <div class="pt-schools">
        ${list.map(x => `<button type="button" class="pt-school-tile" style="--tile-c:${rateColor(x.rate)}" data-school="${esc(x.name).replace(/"/g, '&quot;')}" onclick="NJTCPartnerNav.openSchool(this.dataset.school)">
          <div class="pt-school-name">${esc(x.name)}</div>
          <div class="pt-school-rate">${x.rate == null ? '—' : x.rate + '%'}<span>attendance</span></div>
          <div class="pt-school-stats">
            <div><b>${x.served.toLocaleString()}</b> scholars</div>
            <div><b>${x.checkIns}</b> to check in</div>
            <div><b>${x.loving == null ? '—' : x.loving + '%'}</b> loving sessions</div>
            <div><b>${x.keptScholars}</b> kept in class</div>
          </div>
          <div class="pt-school-go">View school &rarr;</div>
        </button>`).join('')}
      </div>
    </div>`;
  }

  function renderAll() {
    document.getElementById('ptMain').innerHTML = `
      <div id="view-summary" class="pt-view active"></div>
      <div id="view-attendance" class="pt-view"></div>
      <div id="view-scholar" class="pt-view"></div>
      <div id="view-tutor" class="pt-view"></div>
      <div id="view-profiles" class="pt-view"></div>
      <div id="view-tutorAtt" class="pt-view"></div>
      <div id="view-tutorProfiles" class="pt-view"></div>`;
    renderSummary();
    renderAttendance();
    if (isProgramView()) { renderTutorAttendance(); renderTutorProfiles(); }
    renderSurveyView('scholar', scopedScholarSurveys(), STU,
      { c1: 'CONFIDENCE', c2: 'ENJOYMENT', c3: 'LEARNING' },
      ['How confident scholars felt they understood the material', 'How much scholars enjoyed the session', 'How much scholars felt they learned']);
    renderSurveyView('tutor', scopedTutorSurveys(), INST,
      { c1: 'ENGAGEMENT', c2: 'ENJOYMENT', c3: 'LEARNING' },
      ['How engaged scholars were during the session', 'How much the tutor enjoyed the session', 'How much the tutor felt scholars learned']);
    renderProfiles();
    // #ptTabs lives outside #ptMain, so its active state survives the
    // innerHTML wipe above — re-sync the freshly-injected views to whichever
    // tab was already selected (e.g. after a scope-filter change while on
    // the Attendance tab), instead of silently jumping back to Summary.
    let activeTab = document.querySelector('.pt-tab.active') || document.querySelector('.pt-tab');
    if (activeTab.hidden) { activeTab.classList.remove('active'); activeTab = document.querySelector('.pt-tab[data-view="summary"]'); activeTab.classList.add('active'); }
    if (activeTab.dataset.view !== 'summary') {
      document.getElementById('view-summary').classList.remove('active');
      document.getElementById('view-' + activeTab.dataset.view).classList.add('active');
    }

    // PIE reads window.NJTC_BUNDLE directly — keep it in sync with whatever
    // the drill-down filter currently shows, so PIE never quotes a wider
    // (or narrower) number than what's on screen.
    window.NJTC_BUNDLE = { ...BUNDLE, attendance: scopedAttendance(), scholarSurveys: scopedScholarSurveys(), tutorSurveys: scopedTutorSurveys(), sessions: hasSessionData() ? scopedSessions() : [] };

    // Year-over-year card on Summary — after the headline KPIs (or the
    // welcome banner when there's no data yet). Full scope, not drill-down.
    const yoy = trendCardHtml();
    const sum = document.getElementById('view-summary');
    if (yoy && sum) sum.insertAdjacentHTML('beforeend', yoy);
  }

  // ══════════════════════════════════════════════════════════════════════
  //  SUMMARY
  // ══════════════════════════════════════════════════════════════════════
  function renderSummary() {
    const el = document.getElementById('view-summary');
    const id = BUNDLE.identity;
    const attAll = scopedAttendance();
    const scholarSurveys = scopedScholarSurveys();
    const tutorSurveys = scopedTutorSurveys();

    if (!attAll.length && !scholarSurveys.length && !tutorSurveys.length) {
      el.innerHTML = heroHtml(id) + noDataCard();
      return;
    }

    const stats = scholarStats(attAll);
    // Shared definitions (partner-report.js) — identical to the PDF and YoY card
    const uniqueScholars = CORE.servedScholars(attAll);
    const checkIns = scholarsToCheckIn(stats.rows);
    const kept = keptInClass(attAll);
    const sessions = CORE.deliveredSessions(hasSessionData() ? scopedSessions() : [], attAll);
    // School-driven only — NJTC-side reasons never surface to partners.
    const notDelivered = hasSessionData() ? CORE.schoolDrivenNotDelivered(scopedSessions(), attAll) : null;

    let scholarPos = 0, scholarScored = 0;
    scholarSurveys.forEach(r => {
      const v = parseFloat(r[STU.OVERALL]);
      if (isNaN(v)) return;
      scholarScored++;
      if (v >= 4) scholarPos++;
    });

    const highlights = sessionHighlights();

    let minutesCard = '';
    if (hasSessionData()) {
      const durMap = sessionDurationMap(BUNDLE.sessions || []);
      const seen = new Set();
      let totalSessionMinutes = 0;
      scopedSessions().forEach(r => {
        if ((r[SESS.STATUS] || '').trim() !== 'Completed') return;
        const sid = (r[SESS.SESS_ID] || '').trim();
        const mins = parseInt(r[SESS.DUR_MINS], 10) || 0;
        if (sid && mins > 0 && !seen.has(sid)) { seen.add(sid); totalSessionMinutes += mins; }
      });
      let totalScholarMinutes = 0;
      attAll.filter(isScholarRow).forEach(r => {
        if (classifyAtt(r) !== 'attended') return;
        totalScholarMinutes += durMap[sessionDurationKey(r)] || 0;
      });
      minutesCard = `
        <details class="pt-card pt-fold">
          <summary>Tutoring Time Delivered</summary>
          <div style="display:flex;gap:2.2rem;flex-wrap:wrap">
            <div>
              <div class="pt-kpi-val">${totalSessionMinutes.toLocaleString()}<span style="font-size:.9rem;font-weight:600;color:var(--muted)"> min</span></div>
              <div class="pt-kpi-sub">Total Session Minutes (${(totalSessionMinutes / 60).toFixed(1)} hrs)</div>
            </div>
            <div>
              <div class="pt-kpi-val">${totalScholarMinutes.toLocaleString()}<span style="font-size:.9rem;font-weight:600;color:var(--muted)"> min</span></div>
              <div class="pt-kpi-sub">Total Scholar-Attended Minutes (${(totalScholarMinutes / 60).toFixed(1)} hrs)</div>
            </div>
          </div>
          <p style="font-size:.72rem;color:var(--muted);margin-top:.7rem">Session Minutes counts each delivered session once. Scholar-Attended Minutes is every minute a scholar personally attended, summed across all scholars.</p>
        </details>`;
    }

    const district = isDistrictLens();
    const schoolList = district ? bundleSchools().map(schoolMetrics).sort((a, b) => (a.rate ?? 101) - (b.rate ?? 101)) : null;
    const HL_SHOW = 3;
    const hlItem = c => `<div class="pt-quote">"${esc(c.text)}"<div class="pt-quote-meta">— ${c.who}</div></div>`;

    el.innerHTML = heroHtml(id) + attentionHtml(schoolList) + `
      <div class="pt-grid pt-grid-5" style="margin-bottom:1.1rem" id="tourKpis">
        ${kpiCard(ICONS.check, BRAND.pos, stats.rate == null ? '—' : stats.rate + '%', 'Scholar Attendance Rate', { view: 'attendance' })}
        ${kpiCard(ICONS.users, BRAND.blue, uniqueScholars.toLocaleString(), 'Scholars Served', { view: 'attendance', anchor: 'tourRoster' })}
        ${kpiCard(ICONS.handshake, BRAND.gold, checkIns.length.toLocaleString(), 'Scholars to Check In With', { view: 'attendance', anchor: 'tourCheckin' })}
        ${kpiCard(ICONS.school, BRAND.neg, kept.scholars.length.toLocaleString(), 'Scholars Kept in Class', { view: 'attendance', anchor: 'tourKept', note: kept.count ? kept.count.toLocaleString() + ' missed session' + (kept.count !== 1 ? 's' : '') : '' })}
        ${kpiCard(ICONS.heart, '#c0367a', scholarScored ? pct(scholarPos, scholarScored) + '%' : '—', 'Scholars Loving Their Sessions', { view: 'scholar' })}
      </div>
      ${isProgramView() ? tutorKpiRowHtml(attAll, tutorSurveys) : ''}
      ${district ? schoolTilesHtml(schoolList) : ''}
      ${isProgramView() ? staffTilesHtml() : ''}
      <div class="pt-grid pt-grid-2">
        <div class="pt-card" id="tourHighlights">
          <div class="pt-card-title">${ICONS.sparkle} Session Highlights${highlights.weekLabel ? `<span class="pt-card-title-note">Week of ${esc(highlights.weekLabel)}</span>` : ''}</div>
          ${highlights.items.length ? highlights.items.slice(0, HL_SHOW).map(hlItem).join('') +
            (highlights.items.length > HL_SHOW ? `<details><summary class="pt-more">Show ${highlights.items.length - HL_SHOW} more</summary>${highlights.items.slice(HL_SHOW).map(hlItem).join('')}</details>` : '')
            : `<p style="color:var(--muted);font-size:.85rem">No highlighted comments yet this period.</p>`}
        </div>
        <div class="pt-card">
          <div class="pt-card-title">${ICONS.trend} This Year at a Glance</div>
          ${quickBar('Attended', stats.attended, stats.attended + stats.absent, BRAND.pos)}
          ${quickBar('Missed', stats.absent, stats.attended + stats.absent, BRAND.neg)}
          <p style="font-size:.72rem;color:var(--muted);margin:.6rem 0 .9rem">Excused time (school events, testing days, holidays, NJTC staffing gaps) isn't counted against the rate above.</p>
          <div style="display:flex;gap:1.5rem;padding-top:.5rem;border-top:1px solid var(--border-2)">
            <div><div class="pt-kpi-val" style="font-size:1.4rem">${sessions.toLocaleString()}</div><div class="pt-kpi-sub" style="margin-top:.2rem">Sessions Delivered</div></div>
            <div><div class="pt-kpi-val" style="font-size:1.4rem">${scholarSurveys.length.toLocaleString()}</div><div class="pt-kpi-sub" style="margin-top:.2rem">Scholar Surveys</div></div>
            ${notDelivered ? `<div><div class="pt-kpi-val" style="font-size:1.4rem">${notDelivered.total.toLocaleString()}</div><div class="pt-kpi-sub" style="margin-top:.2rem">Sessions Not Delivered <span style="white-space:nowrap">(school-driven)</span></div></div>` : ''}
          </div>
          ${notDelivered && notDelivered.total ? `<details style="margin-top:.6rem"><summary class="pt-more">Why sessions were not delivered</summary>
            ${notDelivered.byReason.map(([r, n]) => `<div style="display:flex;justify-content:space-between;gap:1rem;font-size:.8rem;padding:.2rem 0;border-bottom:1px solid var(--border-2)"><span>${esc(r)}</span><strong>${n.toLocaleString()}</strong></div>`).join('')}
            <p style="font-size:.72rem;color:var(--muted);margin:.5rem 0 0">Sessions that could not take place because of a school event, testing, schedule change, closure, drill, weather, half day or scheduled holiday. Never counted against the attendance rate.</p>
          </details>` : ''}
        </div>
      </div>${minutesCard}`;
  }

  function heroHtml(id) {
    const season = ARCHIVE ? 'SY ' + ARCHIVE.season + ' (final summary)' : (BUNDLE && BUNDLE.season) ? 'SY ' + BUNDLE.season : 'Current School Year';
    const drilled = SCOPE.school !== 'ALL' && multiSchoolAccount();
    const place = drilled ? SCOPE.school : scopeLabel(id);
    return `<div class="pt-hero"><div class="pt-hero-row">
      <div>
        ${drilled ? `<button type="button" class="pt-crumb" onclick="NJTCPartnerNav.backToAllSchools()">&larr; All schools</button>` : ''}
        <h1>${drilled ? esc(SCOPE.school) : 'Welcome, ' + esc(id.name || 'Partner')}</h1>
        <p>${drilled ? 'School view' : esc(place)} — New Jersey Tutoring Corps ${esc(season)}</p>
      </div>
      ${contactCardHtml(id)}
    </div></div>`;
  }
  // go: { view, anchor, note } makes the tile a button that drills into
  // the tab/card behind the number.
  function kpiCard(iconSvg, color, val, sub, go) {
    const body = `
      <div class="pt-kpi-icon" style="background:${color}18;color:${color}">${iconSvg}</div>
      <div class="pt-kpi-val">${val}</div>
      <div class="pt-kpi-sub">${sub}</div>
      ${go && go.note ? `<div class="pt-kpi-note">${esc(go.note)}</div>` : ''}`;
    if (!go || !go.view) return `<div class="pt-card">${body}</div>`;
    return `<button type="button" class="pt-card pt-kpi-link" onclick="NJTCPartnerNav.drill('${go.view}','${go.anchor || ''}')" aria-label="${esc(sub)}: ${esc(String(val))} - view details">${body}
      <div class="pt-kpi-go">View details &rarr;</div></button>`;
  }
  // Value sits beside the bar, not inside it, so a short bar (e.g. 1.7%)
  // never clips its own label on narrower screens.
  function quickBar(label, n, total, color) {
    const p = pct(n, total) || 0;
    return `<div class="pt-sentiment-row">
      <div class="pt-sentiment-label">${label}</div>
      <div class="pt-sentiment-track"><div class="pt-sentiment-fill" style="width:${p}%;background:${color}"></div></div>
      <div class="pt-sentiment-val">${n.toLocaleString()}</div>
    </div>`;
  }
  function noDataCard() {
    return `<div class="pt-card pt-empty">
      <h3>No Pearl data yet for this school year</h3>
      <p>NJTC hasn't started delivering tutoring sessions here yet this year, or attendance/survey data hasn't synced. Check back after your program launches — this dashboard updates automatically.</p>
    </div>`;
  }

  // ══════════════════════════════════════════════════════════════════════
  //  ATTENDANCE TRACKING — scholar-only throughout
  // ══════════════════════════════════════════════════════════════════════
  function renderAttendance() {
    const attAll = scopedAttendance();
    const el = document.getElementById('view-attendance');
    if (!attAll.length) { el.innerHTML = noDataCard(); return; }

    const stats = scholarStats(attAll);
    if (!stats.rows.length) { el.innerHTML = noDataCard(); return; }

    const weekly = scholarWeeklyRate(stats.rows);
    const reasons = scholarMissedReasons(stats.rows).slice(0, 8);
    const reasonTotal = reasons.reduce((sum, [, n]) => sum + n, 0);
    const byScholar = {};
    stats.rows.forEach(r => {
      const uid = (r[ATT.USER_ID] || '').trim();
      const name = (r[ATT.USER] || '').trim();
      if (!uid && !name) return;
      const key = uid || name;
      if (!byScholar[key]) byScholar[key] = { uid: uid || '—', name: name || 'Unknown', attended: 0, absent: 0 };
      const c = classifyAtt(r);
      if (c === 'attended') byScholar[key].attended++;
      else if (c === 'absent') byScholar[key].absent++;
    });
    const roster = Object.values(byScholar)
      .map(s => ({ ...s, total: s.attended + s.absent, rate: pct(s.attended, s.attended + s.absent) }))
      .sort((a, b) => (a.rate ?? 100) - (b.rate ?? 100)); // lowest attendance first — most actionable

    el.innerHTML = `
      <div class="pt-grid pt-grid-main-side" style="margin-bottom:1.1rem">
        <div class="pt-card">
          <div class="pt-card-title">${ICONS.trend} Weekly Scholar Attendance Rate</div>
          <div class="pt-chart-wrap"><canvas id="chartWeekly"></canvas></div>
        </div>
        <div class="pt-card">
          <div class="pt-card-title">Scholar Attendance Rate</div>
          <div class="pt-kpi-val pt-kpi-val-lg">${stats.rate == null ? '—' : stats.rate + '%'}</div>
          <div style="margin-top:1rem">
            ${quickBar('Attended', stats.attended, stats.attended + stats.absent, BRAND.pos)}
            ${quickBar('Missed', stats.absent, stats.attended + stats.absent, BRAND.neg)}
          </div>
          <p style="font-size:.72rem;color:var(--muted);margin-top:.6rem">${stats.excused.toLocaleString()} additional sessions were excused (school events, testing, holidays) and aren't counted here.</p>
        </div>
      </div>
      ${attendanceDetailHtml('scholar', scholarDetailList(stats.rows))}
      ${keptInClassHtml(attAll, stats.absent)}
      <div class="pt-grid pt-grid-2" style="margin-bottom:1.1rem">
        <div class="pt-card">
          <div class="pt-card-title">${ICONS.search} Why Scholars Missed a Session</div>
          ${reasons.length ? distRows(reasons, reasonTotal, BRAND.blue) + missedReasonInsight(reasons) : `<p style="color:var(--muted);font-size:.85rem">No missed sessions logged.</p>`}
        </div>
        <div class="pt-card" id="tourRoster">
          <div class="pt-card-title">${ICONS.roster} Scholar Attendance</div>
          <div id="rosterBox">
            <table class="pt-table"><thead><tr><th>Pearl ID</th><th>Scholar</th><th>Attendance</th></tr></thead><tbody>
              ${roster.map((s, i) => {
                const cls = bandPillClass('scholar', s.attended, s.total, s.rate);
                return `<tr data-pg="${Math.floor(i / CHECKIN_PAGE)}"${i >= CHECKIN_PAGE ? ' hidden' : ''}><td style="font-family:'JetBrains Mono',monospace;font-size:.75rem">${esc(s.uid)}</td><td>${esc(s.name)}</td><td><span class="pt-pill ${cls}">${s.rate == null ? '—' : s.rate + '%'}</span></td></tr>`;
              }).join('')}
            </tbody></table>
            ${roster.length > CHECKIN_PAGE ? pagerHtml('rosterBox', roster.length) : ''}
          </div>
        </div>
      </div>`;

    drawRateLine('chartWeekly', weekly.weeks, weekly.rates, BRAND.blue);
  }

  // ── Attendance Detail (scholar + tutor) ─────────────────────────────
  // Every person in the current view, one accordion row each, filterable by
  // band: 0% / below goal (default) / at goal / All. Click a name for the
  // missed sessions (date, session, reason).
  function scholarDetailList(scholarRows) {
    const by = {};
    scholarRows.forEach(r => {
      const uid = (r[ATT.USER_ID] || '').trim(), name = (r[ATT.USER] || '').trim();
      if (!uid && !name) return;
      const k = uid || ('name:' + name.toLowerCase());
      const p = by[k] = by[k] || { id: uid, name: name || 'Unknown', schools: {}, attended: 0, absent: 0, excused: 0, missed: [], lastAttended: '', lastSort: null };
      const sc = (r[ATT.SCHOOL] || '').trim(); if (sc) p.schools[sc] = (p.schools[sc] || 0) + 1;
      const c = classifyAtt(r);
      if (c === 'attended') {
        p.attended++;
        const d = parseDate((r[ATT.SESS_DATE] || '').trim());
        if (d && (!p.lastSort || d > p.lastSort)) { p.lastSort = d; p.lastAttended = (r[ATT.SESS_DATE] || '').trim(); }
      } else if (c === 'absent') {
        p.absent++;
        p.missed.push({ date: (r[ATT.SESS_DATE] || '').trim() || 'Date not recorded', session: (r[ATT.SESSION] || '').trim(), reason: (r[ATT.MISS_REASON] || '').trim() || REASON_UNKNOWN });
      } else if (c === 'si') p.excused++;
    });
    return Object.values(by).map(p => {
      const schoolList = Object.entries(p.schools).sort((a, b) => b[1] - a[1]).map(e => e[0]);
      const total = p.attended + p.absent;
      return Object.assign(p, { schoolList, school: schoolList[0] || '', total, rate: pct(p.attended, total) });
    }).filter(p => p.total > 0);
  }
  function tutorDetailList(roster) {
    return roster.filter(t => t.sessions > 0).map(t => Object.assign({}, t, { total: t.sessions }));
  }

  const DETAIL = { scholar: { list: [], band: 'low' }, tutor: { list: [], band: 'low' } };
  const DETAIL_META = {
    scholar: { id: 'tourCheckin', box: 'scholarDetailBox', title: 'Scholar Attendance Detail' },
    tutor:   { id: 'tutorCheckin', box: 'tutorDetailBox', title: 'Tutor Attendance Detail' },
  };
  function attendanceDetailHtml(kind, list) {
    const B = BANDS[kind], M = DETAIL_META[kind];
    list = list.slice().sort((a, b) => (a.rate ?? -1) - (b.rate ?? -1) || b.absent - a.absent || a.name.localeCompare(b.name));
    DETAIL[kind].list = list;
    DETAIL[kind].band = 'low'; // default: 1% up to just under goal
    const n = band => band === 'all' ? list.length : list.filter(p => bandOf(kind, p.attended, p.total, p.rate) === band).length;
    const chips = [['zero', '0%'], ['low', `1–${B.target - 1}%`], ['met', `${B.target}–100%`], ['all', 'All']];
    return `<div class="pt-card" style="margin-bottom:1.1rem" id="${M.id}">
      <div class="pt-card-title">${ICONS.handshake} ${M.title}<span class="pt-card-title-note">Goal: ${B.target}%+ attendance</span></div>
      <p style="font-size:.82rem;color:var(--text-2);margin-bottom:.7rem">Every ${B.noun} in this view, lowest attendance first. Click a name for the sessions missed${kind === 'scholar' ? ', the session name and the reason' : ' and the reason'}.</p>
      <div class="pt-band-chips" role="group" aria-label="Filter by attendance">
        ${chips.map(([b, l]) => `<button type="button" class="pt-band-chip${b === 'low' ? ' active' : ''}" data-band="${b}" onclick="NJTCPartnerNav.detailBand('${kind}','${b}')">${l} <b>${n(b).toLocaleString()}</b></button>`).join('')}
      </div>
      ${bandLegendHtml(kind)}
      <div id="${M.box}">${detailRowsHtml(kind)}</div>
    </div>`;
  }
  function detailRowsHtml(kind) {
    const B = BANDS[kind], M = DETAIL_META[kind], band = DETAIL[kind].band;
    const rows = DETAIL[kind].list.filter(p => band === 'all' || bandOf(kind, p.attended, p.total, p.rate) === band);
    if (!rows.length) {
      const what = band === 'zero' ? 'at 0%' : band === 'low' ? `between 1% and ${B.target - 1}%` : band === 'met' ? `at ${B.target}% or higher` : 'with attendance logged';
      return `<p style="font-size:.85rem;color:var(--text-2);padding:.4rem 0">No ${B.nounPl} ${what} in this view.</p>`;
    }
    return rows.map((p, i) => `
      <details class="pt-checkin" data-pg="${Math.floor(i / CHECKIN_PAGE)}"${i >= CHECKIN_PAGE ? ' hidden' : ''}>
        <summary>
          <span class="pt-checkin-id">${esc(p.id || '—')}</span>
          <span class="pt-checkin-name">${esc(p.name)} <span style="font-weight:400;color:var(--muted);font-size:.78rem">· ${esc(p.school || 'School not recorded')}${p.schoolList && p.schoolList.length > 1 ? ' +' + (p.schoolList.length - 1) + ' more' : ''}</span></span>
          <span class="pt-checkin-stat">
            <span class="pt-pill ${bandPillClass(kind, p.attended, p.total, p.rate)}">${p.rate == null ? '—' : p.rate + '%'} attended</span>
            <span style="color:var(--muted);font-size:.78rem">${p.attended} of ${p.total} session${p.total === 1 ? '' : 's'} · ${p.absent} missed · last attended ${esc(p.lastAttended || 'never')}</span>
          </span>
        </summary>
        <div class="pt-checkin-detail">
          ${p.missed.length ? `<table><thead><tr><th>Date</th><th>Session</th><th>Reason</th></tr></thead><tbody>
            ${p.missed.slice().sort((a, b) => (parseDate(b.date) || 0) - (parseDate(a.date) || 0)).map(m => `<tr><td>${esc(m.date)}</td><td>${esc(m.session || '—')}</td><td>${esc(m.reason)}</td></tr>`).join('')}
          </tbody></table>` : `<p style="padding:.3rem 0">No missed sessions.</p>`}
          ${p.excused ? `<p style="font-size:.72rem;color:var(--muted);margin-top:.4rem">${p.excused} excused session${p.excused === 1 ? '' : 's'} (school events, testing, closures) not counted.</p>` : ''}
        </div>
      </details>`).join('') + (rows.length > CHECKIN_PAGE ? pagerHtml(M.box, rows.length) : '');
  }
  NJTCPartnerNav.tutorPage = function (d) { TP.page += d; drawTutorGrid(); };
  NJTCPartnerNav.detailBand = function (kind, band) {
    if (!DETAIL[kind]) return;
    DETAIL[kind].band = band;
    const card = document.getElementById(DETAIL_META[kind].id);
    if (card) card.querySelectorAll('.pt-band-chip').forEach(c => c.classList.toggle('active', c.dataset.band === band));
    const box = document.getElementById(DETAIL_META[kind].box);
    if (box) box.innerHTML = detailRowsHtml(kind);
  };

  const CHECKIN_PAGE = 10;
  // Generic 10-per-page pager for any container whose rows carry data-pg.
  const _pages = {};
  function pagerHtml(boxId, total) {
    _pages[boxId] = 0;
    return `<div class="pt-pager" data-pager-for="${boxId}">
      <button type="button" onclick="NJTCPartnerNav.page('${boxId}',-1)" disabled>&larr; Previous</button>
      <span class="pt-pager-label">1–${Math.min(total, CHECKIN_PAGE)} of ${total.toLocaleString()}</span>
      <button type="button" onclick="NJTCPartnerNav.page('${boxId}',1)">Next &rarr;</button>
    </div>`;
  }
  NJTCPartnerNav.page = function (boxId, delta) {
    const box = document.getElementById(boxId); if (!box) return;
    const rows = [...box.querySelectorAll('[data-pg]')];
    const pages = Math.ceil(rows.length / CHECKIN_PAGE);
    _pages[boxId] = Math.max(0, Math.min(pages - 1, (_pages[boxId] || 0) + delta));
    const p = _pages[boxId];
    rows.forEach(r => { r.hidden = Number(r.dataset.pg) !== p; });
    const pager = box.querySelector('[data-pager-for]');
    if (pager) {
      pager.querySelector('.pt-pager-label').textContent = (p * CHECKIN_PAGE + 1) + '–' + Math.min(rows.length, (p + 1) * CHECKIN_PAGE) + ' of ' + rows.length.toLocaleString();
      const b = pager.querySelectorAll('button'); b[0].disabled = p === 0; b[1].disabled = p >= pages - 1;
    }
  };

  function keptInClassHtml(attRows, absent) {
    const k = keptInClass(attRows);
    if (!k.count) return `<div class="pt-card" style="margin-bottom:1.1rem" id="tourKept">
      <div class="pt-card-title">${ICONS.school} Kept in Class During Tutoring</div>
      <p style="font-size:.85rem;color:var(--text-2)">No scholars were kept in class by a teacher during tutoring.</p>
    </div>`;
    const share = absent ? Math.round(k.count / absent * 100) : 0;
    return `<div class="pt-card" style="margin-bottom:1.1rem" id="tourKept">
      <div class="pt-card-title">${ICONS.school} Kept in Class During Tutoring<span class="pt-card-title-note">${k.count.toLocaleString()} session${k.count !== 1 ? 's' : ''} · ${share}% of missed sessions</span></div>
      <p style="font-size:.82rem;color:var(--text-2);margin-bottom:.8rem">A classroom teacher kept these scholars in class during their tutoring time. Session Name comes from Pearl's Session Details and is usually the classroom teacher's name. Each one counts as a missed tutoring session, so scholars receive less of the tutoring they're scheduled for. A quick word with the teachers about the tutoring schedule usually helps.</p>
      <table class="pt-table"><thead><tr><th>Pearl ID</th><th>Scholar</th><th>Session Name</th><th style="text-align:right">Times kept in class</th></tr></thead><tbody>
        ${k.scholars.slice(0, 10).map(x => {
          const names = Object.entries(x.sessions || {}).sort((a, b) => b[1] - a[1]).map(e => e[0]);
          return `<tr><td style="font-family:'JetBrains Mono',monospace;font-size:.75rem">${esc(x.uid || '—')}</td><td>${esc(x.name)}</td><td style="font-size:.78rem">${names.length ? names.map(esc).join('<br>') : '—'}</td><td style="text-align:right;font-weight:700">${x.n}</td></tr>`;
        }).join('')}
      </tbody></table>
      ${k.scholars.length > 10 ? `<p style="font-size:.75rem;color:var(--muted);margin-top:.5rem">Showing the 10 scholars kept in class most often, of ${k.scholars.length}.</p>` : ''}
    </div>`;
  }

  // Always-labeled horizontal bar list — shows count AND share permanently,
  // used for every distribution on this page instead of a canvas chart.
  function distRows(entries, total, color) {
    const max = Math.max(...entries.map(([, n]) => n), 1);
    return entries.map(([label, count]) => `
      <div class="pt-dist-row">
        <div class="pt-dist-head">
          <span class="pt-dist-label">${esc(label)}</span>
          <span class="pt-dist-count">${count.toLocaleString()}${total ? ` <span>(${pct(count, total)}%)</span>` : ''}</span>
        </div>
        <div class="pt-bar-track"><div class="pt-bar-fill" style="width:${Math.round(count / max * 100)}%;background:${color}"></div></div>
      </div>`).join('');
  }

  // A short, constructive note connecting the leading reason to something
  // the partner can actually do — the point of showing this at all.
  function missedReasonInsight([topReason]) {
    if (!topReason) return '';
    const [reason] = topReason;
    if (/Classroom Teacher Requested|whole group support/i.test(reason)) {
      return `<p style="font-size:.78rem;color:var(--text-2);margin-top:.9rem;padding-top:.75rem;border-top:1px solid var(--border-2)">The leading reason here comes from classroom teachers keeping scholars in class. A quick check-in with those teachers about tutoring block scheduling is often all it takes.</p>`;
    }
    if (/Out of the Classroom/i.test(reason)) {
      return `<p style="font-size:.78rem;color:var(--text-2);margin-top:.9rem;padding-top:.75rem;border-top:1px solid var(--border-2)">The leading reason here is scholars being out of the classroom when tutoring starts (another pull-out, the nurse, an appointment). A quick look at what else is scheduled during the tutoring block usually helps.</p>`;
    }
    if (/declined/i.test(reason)) {
      return `<p style="font-size:.78rem;color:var(--text-2);margin-top:.9rem;padding-top:.75rem;border-top:1px solid var(--border-2)">The leading reason here is scholars declining the session. Worth a conversation with those scholars about what's getting in the way.</p>`;
    }
    return '';
  }

  // ══════════════════════════════════════════════════════════════════════
  //  SURVEYS (scholar + tutor share this renderer)
  // ══════════════════════════════════════════════════════════════════════
  function renderSurveyView(kind, rows, cols, qkeys, labels) {
    const el = document.getElementById('view-' + kind);
    if (!rows.length) { el.innerHTML = noDataCard(); return; }

    let pos = 0, neu = 0, neg = 0;
    rows.forEach(r => {
      const v = parseFloat(r[cols.OVERALL]);
      if (isNaN(v)) return;
      if (v >= 4) pos++; else if (v === 3) neu++; else if (v >= 1) neg++;
    });
    const scored = pos + neu + neg;

    el.innerHTML = `
      <div class="pt-grid pt-grid-wide-narrow" style="margin-bottom:1.1rem">
        <div class="pt-card">
          <div class="pt-card-title">Overall Sentiment</div>
          ${sentimentRow('Positive', pos, scored, BRAND.pos)}
          ${sentimentRow('Neutral', neu, scored, BRAND.neu)}
          ${sentimentRow('Negative', neg, scored, BRAND.neg)}
        </div>
        <div class="pt-card">
          <div class="pt-card-title">What This Means</div>
          <p style="font-size:.85rem;color:var(--text-2);line-height:1.6">
            Positive = rated 4–5, Neutral = rated 3, Negative = rated 1–2, on "Overall, how did this session go?"
            Based on ${scored.toLocaleString()} responses.
          </p>
        </div>
      </div>
      <div class="pt-grid pt-grid-3">
        <div class="pt-card"><div class="pt-card-title">${esc(labels[0])}</div>${distRows(ratingEntries(rows, cols[qkeys.c1], qkeys.c1), rows.length, BRAND.blue)}</div>
        <div class="pt-card"><div class="pt-card-title">${esc(labels[1])}</div>${distRows(ratingEntries(rows, cols[qkeys.c2], qkeys.c2), rows.length, BRAND.blue)}</div>
        <div class="pt-card"><div class="pt-card-title">${esc(labels[2])}</div>${distRows(ratingEntries(rows, cols[qkeys.c3], qkeys.c3), rows.length, BRAND.blue)}</div>
      </div>${isProgramView() ? surveyCommentsHtml(kind, rows) : ''}`;
  }

  function sentimentRow(label, n, total, color) {
    const p = pct(n, total) || 0;
    return `<div class="pt-sentiment-row">
      <div class="pt-sentiment-label">${label}</div>
      <div class="pt-sentiment-track"><div class="pt-sentiment-fill" style="width:${p}%;background:${color}"></div></div>
      <div class="pt-sentiment-val">${p}%</div>
    </div>`;
  }

  // Each survey question uses its own 1–5 wording (matches the buttons on
  // the actual post-session survey) rather than a generic Excellent…Poor
  // scale — 5 is always the rightmost/best button, 1 the leftmost/worst.
  const SCALE_LABELS = {
    CONFIDENCE: { 5: 'Extremely confident', 4: 'Quite confident', 3: 'Somewhat confident', 2: 'Slightly confident', 1: 'Not confident at all' },
    ENGAGEMENT: { 5: 'Extremely engaged', 4: 'Quite engaged', 3: 'Somewhat engaged', 2: 'A little engaged', 1: 'Not engaged at all' },
    ENJOYMENT: { 5: 'Enjoyed a tremendous amount', 4: 'Enjoyed quite a bit', 3: 'Enjoyed somewhat', 2: 'Enjoyed a little bit', 1: 'Did not enjoy at all' },
    LEARNING: { 5: 'A tremendous amount', 4: 'Quite a bit', 3: 'Some', 2: 'A little bit', 1: 'Almost nothing' },
    OVERALL: { 5: 'Extremely well', 4: 'Quite well', 3: 'Somewhat well', 2: 'Slightly well', 1: 'Not well at all' }
  };
  function ratingEntries(rows, colIdx, scaleKey) {
    const scale = SCALE_LABELS[scaleKey] || SCALE_LABELS.OVERALL;
    const counts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    rows.forEach(r => {
      const v = Math.round(parseFloat(r[colIdx]));
      if (counts[v] !== undefined) counts[v]++;
    });
    return [5, 4, 3, 2, 1].map(k => [`${k} — ${scale[k]}`, counts[k]]);
  }

  // ── Weekly trend chart (the one real canvas chart on this page) ────────
  function destroy(id) { if (charts[id]) { charts[id].destroy(); delete charts[id]; } }

  // Draws the % value above each point so the numbers are visible without
  // hovering, not just via tooltip.
  const valueLabelPlugin = {
    id: 'valueLabels',
    afterDatasetsDraw(chart) {
      const { ctx } = chart;
      chart.data.datasets.forEach((dataset, i) => {
        const meta = chart.getDatasetMeta(i);
        // Label every point when there's room; on narrow charts label every
        // 2nd/3rd point so the numbers never pile on top of each other.
        const spacing = meta.data.length > 1 ? Math.abs(meta.data[1].x - meta.data[0].x) : 999;
        const every = spacing >= 30 ? 1 : spacing >= 16 ? 2 : 3;
        meta.data.forEach((point, idx) => {
          const val = dataset.data[idx];
          if (val == null) return;
          if (idx % every !== 0 && idx !== meta.data.length - 1) return;
          ctx.save();
          ctx.fillStyle = '#3d5166';
          ctx.font = "600 10px 'DM Sans', sans-serif";
          ctx.textAlign = 'center';
          ctx.fillText(Math.round(val) + '%', point.x, point.y - 8);
          ctx.restore();
        });
      });
    }
  };

  function drawRateLine(id, labels, data, color, seriesLabel) {
    const canvas = document.getElementById(id);
    if (!canvas) return;
    if (!labels.length || typeof Chart === 'undefined') {
      canvas.closest('.pt-chart-wrap').outerHTML = `<div class="pt-chart-empty">Not enough weekly data yet to show a trend — check back as more sessions are logged.</div>`;
      return;
    }
    destroy(id);
    charts[id] = new Chart(canvas, {
      type: 'line',
      data: { labels, datasets: [{ label: seriesLabel || 'Scholar Attendance Rate', data, borderColor: color, backgroundColor: color + '1a', tension: .3, fill: true, pointRadius: 3, pointBackgroundColor: color }] },
      options: {
        responsive: true, maintainAspectRatio: false,
        layout: { padding: { top: 18, right: 8 } },
        plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => c.parsed.y + '%' } } },
        scales: {
          x: { ticks: { maxTicksLimit: 8, font: { size: 10 } }, grid: { display: false } },
          y: { beginAtZero: true, max: 100, ticks: { callback: v => v + '%', stepSize: 25, font: { size: 10 } } }
        }
      },
      plugins: [valueLabelPlugin]
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
