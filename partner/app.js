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
   - "Scholars to Check In With" is computed directly from real attendance
     records (0 attended and at least one genuine miss, or a meaningfully
     low rate with enough sessions to be a real pattern) — not from Pearl's
     own concern flag, which under-fires and silently misses real 0%-
     attendance scholars.
   - Session-comment "highlights" are curated: only comments attached to a
     4-5 overall rating, filtered again for negative-leaning language, so
     nothing critical or lukewarm surfaces as a quoted "voice". Aggregate
     survey distributions stay fully honest — curation applies to anecdote
     quotes, never to the real numbers.
   - Every distribution on this page (survey ratings, missed reasons) is
     rendered as an always-labeled horizontal bar list, not a canvas chart —
     the count and share are visible without hovering, and sizing can't
     balloon out of proportion the way Chart.js's own bar/donut defaults did.
   ============================================================================ */
(function () {
  'use strict';

  const BASE = '/New-Jersey-Tutoring-Corps-Portal';

  const ATT  = { USER:0, ROLE:1, SESSION:2, SESS_STATUS:3, PLAN_START:4, SESS_DATE:5, ATT_STATUS:6, MISS_REASON:7, GRADE:8, SEX:9, RACE:10, SCHOOL:11, DISTRICT:12, USER_ID:13, WEEK:26 };
  const INST = { FILLED_BY:0, FILLED_FOR:1, ENGAGEMENT:2, ENJOYMENT:3, LEARNING:4, OVERALL:5, COMMENT_ADMIN:6, COMMENT_SELF:7, DATE:8, SCHOOL:9, DISTRICT:10 };
  const STU  = { FILLED_BY:0, FILLED_FOR:1, CONFIDENCE:2, ENJOYMENT:3, LEARNING:4, OVERALL:5, COMMENT:6, DATE:7, SCHOOL:8, DISTRICT:9, REGION:10 };

  // Scholar-side reasons only — things a school partner can actually see and
  // act on. NJTC-internal service-interruption reasons (tutor vacancy,
  // internal errors, etc.) are a separate bucket below and are never shown
  // to partners, in any list or detail view.
  const SCHOLAR_MISS_REASONS = new Set([
    'Absent', 'Scholar declined attending tutoring session',
    'Classroom Teacher Requested to Keep Scholar in Class',
    'HADDON TWP ONLY -- Teacher requested whole group support', 'Scholar Left Early'
  ]);
  const TUTOR_MISS_REASONS = new Set([
    'Absent; Not Covered (Tutor not available)', 'Absent; Covered by Sub Tutor',
    'Absent; Covered by Dual Role', 'Absent; Covered by the Site Leader',
    'Absent; Covered by the Instructional Coach', 'Tutor Left Early (no sub)'
  ]);

  // Safety net so a lukewarm/critical comment can't slip through even when
  // attached to a positively-scored (4-5) response.
  const NEGATIVE_QUOTE_SIGNALS = /\b(not|n't|no|never|struggl\w*|withdraw\w*|difficult|concern\w*|problem\w*|issue\w*|refus\w*|distract\w*|bored|hate\w*|dislike\w*|worst|\bbad\b|upset|frustrat\w*|absent|missed|late|disrupt\w*|behavior|complain\w*)/i;

  const BRAND = { pos: '#0d6e3a', neu: '#7d8fa1', neg: '#b91c1c', blue: '#0050c8', gold: '#f0a500' };

  const ICONS = {
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
    { term: 'Missed Session', def: 'A scheduled session the scholar did not attend, for a reason on the school/scholar side (declined the session, kept in class by a teacher, etc.). Sessions that did not happen because of an NJTC-side issue (a staffing gap, an internal error) are handled separately and never count as a scholar "missing" anything.' },
    { term: 'Excused Time', def: "Sessions that didn't happen for reasons outside anyone's control — a school event, a testing day, a holiday, weather — or an NJTC-side staffing gap. Never counted against the attendance rate." },
    { term: 'Scholars to Check In With', def: "Scholars with a real pattern of missed sessions: either they've never yet attended, or their attendance rate is below 80% across at least 3 real sessions. Computed directly from session records, and only counts misses on the school/scholar side — never an NJTC-side issue." },
    { term: 'Session', def: 'One scheduled tutoring block for one scholar. "Sessions Delivered" counts each unique session that took place, regardless of how many scholars were in it.' },
    { term: 'Overall Rating', def: 'The "Overall, how did this session go?" question on the post-session survey, rated 1 (Poor) to 5 (Excellent). Positive = 4–5, Neutral = 3, Negative = 1–2.' },
    { term: 'Session Highlights', def: 'A curated selection of comments from sessions rated 4–5 overall. This is a highlight reel, not a full transcript — it is intentionally not a representative sample of every comment left.' },
    { term: 'Scholars Loving Their Sessions', def: 'The share of scholar survey responses rated 4–5 on the Overall question.' }
  ];
  window.NJTC_GLOSSARY = GLOSSARY;

  let BUNDLE = null;
  const charts = {};
  // Client-side drill-down for broad-scope accounts (Network/Regional/Admin).
  // Purely a view filter over data already inside this account's own bundle
  // — it can only narrow what's shown, never reach outside the district(s)/
  // school(s) that bundle was built for.
  const SCOPE = { district: 'ALL', school: 'ALL', week: 'ALL' };

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
  function weekBucket(dateStr) {
    const d = parseDate(dateStr);
    if (!d) return null;
    const day = d.getDay(); // 0=Sun..6=Sat
    const monday = new Date(d);
    monday.setDate(d.getDate() + (day === 0 ? -6 : 1 - day));
    const key = monday.toISOString().slice(0, 10); // YYYY-MM-DD — sorts chronologically
    const label = monday.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    return { key, label };
  }

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

    window.NJTC_BUNDLE = BUNDLE; // read-only handoff to pie-bot.js
    personalize();
    initScopeFilter();
    renderAll();
    hideLoading();
    document.dispatchEvent(new CustomEvent('partnerBundleReady', { detail: BUNDLE }));
  }

  // ── Drill-down filter (Network/Regional/Admin accounts only see this if
  // their bundle actually spans more than one school) ─────────────────────
  function scoped(rows, distIdx, schIdx, dateIdx) {
    return rows.filter(r => {
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

  function initScopeFilter() {
    const bar = document.getElementById('scopeBar');
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
    const weeks = [...weekMap.keys()].sort();

    const hasSchoolDrilldown = districts.length > 1 || allSchools.length > 1;
    if (!hasSchoolDrilldown && !weeks.length) return; // single school, no dated sessions yet — nothing to drill into

    bar.hidden = false;

    function populateSchools(district) {
      let schools;
      if (district === 'ALL') schools = allSchools;
      else schools = [...(schoolsByDistrict[district] || [])];
      schools = schools.sort();
      schSel.innerHTML = `<option value="ALL">All Schools</option>` + schools.map(s => `<option value="${esc(s)}">${esc(s)}</option>`).join('');
    }

    if (hasSchoolDrilldown) {
      schSel.hidden = false;
      if (districts.length > 1) {
        distSel.hidden = false;
        distSel.innerHTML = `<option value="ALL">All Districts</option>` + districts.map(d => `<option value="${esc(d)}">${esc(d)}</option>`).join('');
        distSel.addEventListener('change', () => {
          SCOPE.district = distSel.value;
          SCOPE.school = 'ALL';
          populateSchools(SCOPE.district);
          applyScopeChange();
        });
      }
      populateSchools('ALL');
      schSel.addEventListener('change', () => {
        SCOPE.school = schSel.value;
        // Picking a school implicitly fixes its district too, so the two
        // filters can't disagree with each other.
        if (SCOPE.school !== 'ALL' && districts.length > 1) {
          const owner = districts.find(d => (schoolsByDistrict[d] || new Set()).has(SCOPE.school));
          if (owner) { SCOPE.district = owner; distSel.value = owner; }
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
      if (SCOPE.week !== 'ALL') parts.push('week of ' + esc(weekMap.get(SCOPE.week) || SCOPE.week));
      if (parts.length) { activeBadge.hidden = false; activeBadge.textContent = 'Showing: ' + parts.join(' · '); }
      else activeBadge.hidden = true;
      renderAll();
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

  function personalize() {
    const id = BUNDLE.identity;
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
      document.getElementById('glossaryBody').innerHTML = GLOSSARY.map(g => `
        <div class="pt-glossary-item">
          <div class="pt-glossary-term">${esc(g.term)}</div>
          <div class="pt-glossary-def">${esc(g.def)}</div>
        </div>`).join('');
      glossaryBtn.addEventListener('click', () => glossaryModal.classList.add('open'));
      document.getElementById('glossaryClose').addEventListener('click', () => glossaryModal.classList.remove('open'));
      glossaryModal.addEventListener('click', e => { if (e.target === glossaryModal) glossaryModal.classList.remove('open'); });
    }

    const tourBtn = document.getElementById('tourBtn');
    if (tourBtn) tourBtn.addEventListener('click', () => { if (window.NJTCTour) window.NJTCTour.start(); });
  }

  // ══════════════════════════════════════════════════════════════════════
  //  ATTENDANCE METHODOLOGY — mirrors onsite/pearl-data.js exactly
  // ══════════════════════════════════════════════════════════════════════
  function isScholarRow(r) { return (r[ATT.ROLE] || '').trim() !== 'Instructor'; }

  function classifyAtt(row) {
    const status = (row[ATT.ATT_STATUS] || '').trim();
    const reason = (row[ATT.MISS_REASON] || '').trim();
    const isInstructor = (row[ATT.ROLE] || '').trim() === 'Instructor';
    if (status === 'Attended' || status === 'Late') return 'attended';
    if (status === 'Missed') {
      if (isInstructor) return TUTOR_MISS_REASONS.has(reason) ? 'absent' : 'si';
      return (SCHOLAR_MISS_REASONS.has(reason) || reason === '') ? 'absent' : 'si';
    }
    return 'other'; // 'Not recorded' and anything else — excluded from the rate
  }

  function scholarStats(attRows) {
    const rows = attRows.filter(isScholarRow);
    let attended = 0, absent = 0, excused = 0;
    rows.forEach(r => {
      const c = classifyAtt(r);
      if (c === 'attended') attended++;
      else if (c === 'absent') absent++;
      else if (c === 'si') excused++; // shown as context only, never counted against the rate
    });
    const total = attended + absent;
    return { rows, attended, absent, excused, total, rate: pct(attended, total) };
  }

  function scholarWeeklyRate(scholarRows) {
    const byWeek = {}; // key (sortable) -> { label, attended, absent }
    scholarRows.forEach(r => {
      const wk = weekBucket(r[ATT.SESS_DATE]);
      if (!wk) return;
      const c = classifyAtt(r);
      if (c !== 'attended' && c !== 'absent') return;
      if (!byWeek[wk.key]) byWeek[wk.key] = { label: wk.label, attended: 0, absent: 0 };
      byWeek[wk.key][c]++;
    });
    const keys = Object.keys(byWeek).sort();
    return {
      weeks: keys.map(k => byWeek[k].label),
      rates: keys.map(k => pct(byWeek[k].attended, byWeek[k].attended + byWeek[k].absent))
    };
  }

  // Partner-side reasons only — the SCHOLAR_MISS_REASONS bucket. Service
  // Interruptions (the "si" classification) are never included here.
  function scholarMissedReasons(scholarRows) {
    const counts = {};
    scholarRows.forEach(r => {
      if (classifyAtt(r) !== 'absent') return;
      const reason = (r[ATT.MISS_REASON] || '').trim() || 'Not specified';
      counts[reason] = (counts[reason] || 0) + 1;
    });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }

  // Scholars worth a check-in — computed directly from real attendance
  // records, not Pearl's own concern flag (which under-fires: it missed
  // real 0%-attendance scholars entirely in testing). A scholar qualifies
  // if they have at least one genuine miss (SCHOLAR_MISS_REASONS bucket —
  // never a Service Interruption, which is NJTC's own gap, not theirs) AND
  // either never attended at all, or their rate is low across a real
  // sample (3+ scholar sessions) rather than a single one-off absence.
  // Each entry carries the specific missed sessions (date + reason) so a
  // partner can see exactly what happened, not just a count.
  function scholarsToCheckIn(scholarRows) {
    const byScholar = {};
    scholarRows.forEach(r => {
      const uid = (r[ATT.USER_ID] || '').trim();
      if (!uid) return;
      if (!byScholar[uid]) byScholar[uid] = { uid, name: (r[ATT.USER] || '').trim() || 'Unknown', attended: 0, absences: 0, lastAttended: null, lastAttendedSort: null, missed: [] };
      const s = byScholar[uid];
      const c = classifyAtt(r);
      if (c === 'attended') {
        s.attended++;
        // Compare parsed dates, not raw strings — Pearl's date format isn't
        // guaranteed to sort correctly as text (e.g. "9/8/2025" vs "12/1/2025").
        const raw = (r[ATT.SESS_DATE] || '').trim();
        const parsed = parseDate(raw);
        if (raw && parsed && (!s.lastAttendedSort || parsed > s.lastAttendedSort)) {
          s.lastAttended = raw;
          s.lastAttendedSort = parsed;
        }
      } else if (c === 'absent') {
        s.absences++;
        s.missed.push({
          date: (r[ATT.SESS_DATE] || '').trim() || 'Date not recorded',
          reason: (r[ATT.MISS_REASON] || '').trim() || 'Not specified'
        });
      }
      // 'si' rows (Service Interruptions — tutor vacancy, NJTC internal
      // issues, school closures, testing days, etc.) are never counted as a
      // miss and never appear in a scholar's detail list — that's NJTC's
      // gap to close, or a neutral school event, never a reason to flag a
      // scholar.
    });
    return Object.values(byScholar)
      .map(s => ({ ...s, total: s.attended + s.absences, rate: pct(s.attended, s.attended + s.absences) }))
      .filter(s => s.absences > 0 && (s.attended === 0 || (s.total >= 3 && s.rate < 80)))
      .sort((a, b) => (a.rate ?? 0) - (b.rate ?? 0) || b.absences - a.absences);
  }

  // ══════════════════════════════════════════════════════════════════════
  //  CURATED "HIGHLIGHTS" — positive-only, per partner-relationship policy
  // ══════════════════════════════════════════════════════════════════════
  function isSafelyPositive(text) {
    return !!text && text.length > 3 && !NEGATIVE_QUOTE_SIGNALS.test(text);
  }

  function sessionHighlights() {
    const scholarQuotes = scopedScholarSurveys()
      .filter(r => parseFloat(r[STU.OVERALL]) >= 4)
      .map(r => ({ text: (r[STU.COMMENT] || '').trim(), who: 'Scholar' }));
    const tutorQuotes = scopedTutorSurveys()
      .filter(r => parseFloat(r[INST.OVERALL]) >= 4)
      .map(r => ({ text: (r[INST.COMMENT_SELF] || '').trim(), who: 'Tutor' }));
    return [...scholarQuotes, ...tutorQuotes]
      .filter(c => isSafelyPositive(c.text))
      .slice(-10).reverse();
  }

  function renderAll() {
    document.getElementById('ptMain').innerHTML = `
      <div id="view-summary" class="pt-view active"></div>
      <div id="view-attendance" class="pt-view"></div>
      <div id="view-scholar" class="pt-view"></div>
      <div id="view-tutor" class="pt-view"></div>`;
    renderSummary();
    renderAttendance();
    renderSurveyView('scholar', scopedScholarSurveys(), STU,
      { c1: 'CONFIDENCE', c2: 'ENJOYMENT', c3: 'LEARNING' },
      ['How confident scholars felt they understood the material', 'How much scholars enjoyed the session', 'How much scholars felt they learned']);
    renderSurveyView('tutor', scopedTutorSurveys(), INST,
      { c1: 'ENGAGEMENT', c2: 'ENJOYMENT', c3: 'LEARNING' },
      ['How engaged scholars were during the session', 'How much the tutor enjoyed the session', 'How much the tutor felt scholars learned']);
    // #ptTabs lives outside #ptMain, so its active state survives the
    // innerHTML wipe above — re-sync the freshly-injected views to whichever
    // tab was already selected (e.g. after a scope-filter change while on
    // the Attendance tab), instead of silently jumping back to Summary.
    const activeTab = document.querySelector('.pt-tab.active') || document.querySelector('.pt-tab');
    if (activeTab.dataset.view !== 'summary') {
      document.getElementById('view-summary').classList.remove('active');
      document.getElementById('view-' + activeTab.dataset.view).classList.add('active');
    }

    // PIE reads window.NJTC_BUNDLE directly — keep it in sync with whatever
    // the drill-down filter currently shows, so PIE never quotes a wider
    // (or narrower) number than what's on screen.
    window.NJTC_BUNDLE = { ...BUNDLE, attendance: scopedAttendance(), scholarSurveys: scopedScholarSurveys(), tutorSurveys: scopedTutorSurveys() };
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
    const uniqueScholars = new Set(stats.rows.map(r => (r[ATT.USER_ID] || '').trim()).filter(Boolean)).size;
    const checkIns = scholarsToCheckIn(stats.rows);
    const sessions = new Set(attAll.map(r => r[ATT.SESSION]).filter(Boolean)).size;

    let scholarPos = 0, scholarScored = 0;
    scholarSurveys.forEach(r => {
      const v = parseFloat(r[STU.OVERALL]);
      if (isNaN(v)) return;
      scholarScored++;
      if (v >= 4) scholarPos++;
    });

    const highlights = sessionHighlights();

    el.innerHTML = heroHtml(id) + `
      <div class="pt-grid pt-grid-4" style="margin-bottom:1.1rem" id="tourKpis">
        ${kpiCard(ICONS.check, BRAND.pos, stats.rate == null ? '—' : stats.rate + '%', 'Scholar Attendance Rate')}
        ${kpiCard(ICONS.users, BRAND.blue, uniqueScholars.toLocaleString(), 'Scholars Served')}
        ${kpiCard(ICONS.handshake, BRAND.gold, checkIns.length.toLocaleString(), 'Scholars to Check In With')}
        ${kpiCard(ICONS.heart, '#c0367a', scholarScored ? pct(scholarPos, scholarScored) + '%' : '—', 'Scholars Loving Their Sessions')}
      </div>
      <div class="pt-grid pt-grid-2">
        <div class="pt-card" id="tourHighlights">
          <div class="pt-card-title">${ICONS.sparkle} Session Highlights</div>
          ${highlights.length ? highlights.map(c => `
            <div class="pt-quote">"${esc(c.text)}"<div class="pt-quote-meta">— ${c.who}</div></div>
          `).join('') : `<p style="color:var(--muted);font-size:.85rem">No highlighted comments yet this period.</p>`}
        </div>
        <div class="pt-card">
          <div class="pt-card-title">${ICONS.trend} This Year at a Glance</div>
          ${quickBar('Attended', stats.attended, stats.attended + stats.absent, BRAND.pos)}
          ${quickBar('Missed', stats.absent, stats.attended + stats.absent, BRAND.neg)}
          <p style="font-size:.72rem;color:var(--muted);margin:.6rem 0 .9rem">Excused time (school events, testing days, holidays) isn't counted against the rate above.</p>
          <div style="display:flex;gap:1.5rem;padding-top:.5rem;border-top:1px solid var(--border-2)">
            <div><div class="pt-kpi-val" style="font-size:1.4rem">${sessions.toLocaleString()}</div><div class="pt-kpi-sub" style="margin-top:.2rem">Sessions Delivered</div></div>
            <div><div class="pt-kpi-val" style="font-size:1.4rem">${scholarSurveys.length.toLocaleString()}</div><div class="pt-kpi-sub" style="margin-top:.2rem">Scholar Surveys</div></div>
          </div>
        </div>
      </div>`;
  }

  function heroHtml(id) {
    const season = (BUNDLE && BUNDLE.season) ? 'SY ' + BUNDLE.season : 'Current School Year';
    return `<div class="pt-hero">
      <h1>Welcome, ${esc(id.name || 'Partner')}</h1>
      <p>${esc(scopeLabel(id))} — New Jersey Tutoring Corps ${esc(season)}</p>
    </div>`;
  }
  function kpiCard(iconSvg, color, val, sub) {
    return `<div class="pt-card">
      <div class="pt-kpi-icon" style="background:${color}18;color:${color}">${iconSvg}</div>
      <div class="pt-kpi-val">${val}</div>
      <div class="pt-kpi-sub">${sub}</div>
    </div>`;
  }
  function quickBar(label, n, total, color) {
    const p = pct(n, total) || 0;
    return `<div class="pt-sentiment-row">
      <div class="pt-sentiment-label">${label}</div>
      <div class="pt-sentiment-track"><div class="pt-sentiment-fill" style="width:${p}%;background:${color}">${n.toLocaleString()}</div></div>
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
    const checkIns = scholarsToCheckIn(stats.rows);

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
      .map(s => ({ ...s, rate: pct(s.attended, s.attended + s.absent) }))
      .sort((a, b) => (a.rate ?? 100) - (b.rate ?? 100)); // lowest attendance first — most actionable

    el.innerHTML = `
      <div class="pt-grid" style="grid-template-columns:2fr 1fr;gap:1.1rem;margin-bottom:1.1rem">
        <div class="pt-card">
          <div class="pt-card-title">${ICONS.trend} Weekly Scholar Attendance Rate</div>
          <div class="pt-chart-wrap"><canvas id="chartWeekly"></canvas></div>
        </div>
        <div class="pt-card">
          <div class="pt-card-title">Scholar Attendance Rate</div>
          <div class="pt-kpi-val" style="font-size:2.6rem">${stats.rate == null ? '—' : stats.rate + '%'}</div>
          <div style="margin-top:1rem">
            ${quickBar('Attended', stats.attended, stats.attended + stats.absent, BRAND.pos)}
            ${quickBar('Missed', stats.absent, stats.attended + stats.absent, BRAND.neg)}
          </div>
          <p style="font-size:.72rem;color:var(--muted);margin-top:.6rem">${stats.excused.toLocaleString()} additional sessions were excused (school events, testing, holidays) and aren't counted here.</p>
        </div>
      </div>
      ${checkinSectionHtml(checkIns)}
      <div class="pt-grid pt-grid-2" style="margin-bottom:1.1rem">
        <div class="pt-card">
          <div class="pt-card-title">${ICONS.search} Why Scholars Missed a Session</div>
          ${reasons.length ? distRows(reasons, reasonTotal, BRAND.blue) + missedReasonInsight(reasons) : `<p style="color:var(--muted);font-size:.85rem">No missed sessions logged.</p>`}
        </div>
        <div class="pt-card">
          <div class="pt-card-title">${ICONS.roster} Scholar Attendance</div>
          <div style="max-height:360px;overflow:auto">
            <table class="pt-table"><thead><tr><th>Pearl ID</th><th>Scholar</th><th>Attendance</th></tr></thead><tbody>
              ${roster.slice(0, 300).map(s => {
                const cls = s.rate == null ? '' : s.rate >= 90 ? 'pt-pill-good' : s.rate >= 75 ? 'pt-pill-warn' : 'pt-pill-bad';
                return `<tr><td style="font-family:'JetBrains Mono',monospace;font-size:.75rem">${esc(s.uid)}</td><td>${esc(s.name)}</td><td><span class="pt-pill ${cls}">${s.rate == null ? '—' : s.rate + '%'}</span></td></tr>`;
              }).join('')}
            </tbody></table>
          </div>
        </div>
      </div>`;

    drawRateLine('chartWeekly', weekly.weeks, weekly.rates, BRAND.blue);
  }

  function checkinSectionHtml(checkIns) {
    if (!checkIns.length) {
      return `<div class="pt-card" style="margin-bottom:1.1rem" id="tourCheckin">
        <div class="pt-card-title">${ICONS.handshake} Scholars to Check In With</div>
        <p style="font-size:.85rem;color:var(--text-2)">No scholars are currently flagged for a check-in — attendance looks solid across the board.</p>
      </div>`;
    }
    return `<div class="pt-card" style="margin-bottom:1.1rem" id="tourCheckin">
      <div class="pt-card-title">${ICONS.handshake} Scholars to Check In With</div>
      <p style="font-size:.82rem;color:var(--text-2);margin-bottom:.9rem">These scholars have a real pattern of missed sessions — never an NJTC-side issue, always something on our end to fix instead. A quick check-in with the scholar, a teacher, or family often turns this around. Click a name for the specific sessions missed.</p>
      ${checkIns.slice(0, 30).map(s => `
        <details class="pt-checkin">
          <summary>
            <span class="pt-checkin-id">${esc(s.uid)}</span>
            <span class="pt-checkin-name">${esc(s.name)}</span>
            <span class="pt-checkin-stat">
              <span class="pt-pill pt-pill-bad">${s.rate == null ? '0%' : s.rate + '%'} attended</span>
              <span style="color:var(--muted);font-size:.78rem">${s.absences} missed · last attended ${esc(s.lastAttended || 'never')}</span>
            </span>
          </summary>
          <div class="pt-checkin-detail">
            <table><thead><tr><th>Date</th><th>Reason</th></tr></thead><tbody>
              ${s.missed.slice().sort((a, b) => (parseDate(b.date) || 0) - (parseDate(a.date) || 0)).map(m => `<tr><td>${esc(m.date)}</td><td>${esc(m.reason)}</td></tr>`).join('')}
            </tbody></table>
          </div>
        </details>`).join('')}
    </div>`;
  }

  // Always-labeled horizontal bar list — shows count AND share permanently,
  // used for every distribution on this page instead of a canvas chart.
  function distRows(entries, total, color) {
    const max = Math.max(...entries.map(([, n]) => n), 1);
    return entries.map(([label, count]) => `
      <div class="pt-bar-row" style="align-items:flex-start">
        <div style="flex:1;min-width:0">
          <div style="font-size:.78rem;color:var(--text-2);margin-bottom:.25rem">${esc(label)}</div>
          <div class="pt-bar-track"><div class="pt-bar-fill" style="width:${Math.round(count / max * 100)}%;background:${color}"></div></div>
        </div>
        <div class="pt-bar-count" style="align-self:center">${count.toLocaleString()}${total ? ` <span style="opacity:.6">(${pct(count, total)}%)</span>` : ''}</div>
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
      <div class="pt-grid" style="grid-template-columns:1.3fr 1fr;gap:1.1rem;margin-bottom:1.1rem">
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
        <div class="pt-card"><div class="pt-card-title">${esc(labels[0])}</div>${distRows(ratingEntries(rows, cols[qkeys.c1]), rows.length, BRAND.blue)}</div>
        <div class="pt-card"><div class="pt-card-title">${esc(labels[1])}</div>${distRows(ratingEntries(rows, cols[qkeys.c2]), rows.length, BRAND.blue)}</div>
        <div class="pt-card"><div class="pt-card-title">${esc(labels[2])}</div>${distRows(ratingEntries(rows, cols[qkeys.c3]), rows.length, BRAND.blue)}</div>
      </div>`;
  }

  function sentimentRow(label, n, total, color) {
    const p = pct(n, total) || 0;
    return `<div class="pt-sentiment-row">
      <div class="pt-sentiment-label">${label}</div>
      <div class="pt-sentiment-track"><div class="pt-sentiment-fill" style="width:${p}%;background:${color}">${p}%</div></div>
    </div>`;
  }

  const RATING_LABELS = { 5: '5 — Excellent', 4: '4 — Good', 3: '3 — Okay', 2: '2 — Needs Work', 1: '1 — Poor' };
  function ratingEntries(rows, colIdx) {
    const counts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    rows.forEach(r => {
      const v = Math.round(parseFloat(r[colIdx]));
      if (counts[v] !== undefined) counts[v]++;
    });
    return [5, 4, 3, 2, 1].map(k => [RATING_LABELS[k], counts[k]]);
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
        meta.data.forEach((point, idx) => {
          const val = dataset.data[idx];
          if (val == null) return;
          ctx.save();
          ctx.fillStyle = '#3d5166';
          ctx.font = "600 10px 'DM Sans', sans-serif";
          ctx.textAlign = 'center';
          ctx.fillText(val + '%', point.x, point.y - 8);
          ctx.restore();
        });
      });
    }
  };

  function drawRateLine(id, labels, data, color) {
    const canvas = document.getElementById(id);
    if (!canvas) return;
    if (!labels.length || typeof Chart === 'undefined') {
      canvas.closest('.pt-chart-wrap').outerHTML = `<div class="pt-chart-empty">Not enough weekly data yet to show a trend — check back as more sessions are logged.</div>`;
      return;
    }
    destroy(id);
    charts[id] = new Chart(canvas, {
      type: 'line',
      data: { labels, datasets: [{ label: 'Scholar Attendance Rate', data, borderColor: color, backgroundColor: color + '1a', tension: .3, fill: true, pointRadius: 3, pointBackgroundColor: color }] },
      options: {
        responsive: true, maintainAspectRatio: false,
        layout: { padding: { top: 18 } },
        plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => c.parsed.y + '%' } } },
        scales: {
          x: { ticks: { maxTicksLimit: 8, font: { size: 10 } }, grid: { display: false } },
          y: { beginAtZero: true, max: 100, ticks: { callback: v => v + '%', stepSize: 25 } }
        }
      },
      plugins: [valueLabelPlugin]
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
