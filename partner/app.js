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
   - "Missed-session reasons" shown to partners are limited to reasons on
     the school/scholar side (a teacher keeping a scholar in class, a
     scholar declining, etc.) — NJTC-internal reasons (tutor vacancy,
     internal errors) are never partner-facing.
   - Session-comment "highlights" are curated: only comments attached to a
     4-5 overall rating, filtered again for negative-leaning language, so
     nothing critical or lukewarm surfaces as a quoted "voice". Aggregate
     survey charts (the actual score distributions) stay fully honest —
     curation applies to anecdote quotes, never to the real numbers.
   ============================================================================ */
(function () {
  'use strict';

  const BASE = '/New-Jersey-Tutoring-Corps-Portal';

  const ATT  = { USER:0, ROLE:1, SESSION:2, SESS_STATUS:3, PLAN_START:4, SESS_DATE:5, ATT_STATUS:6, MISS_REASON:7, GRADE:8, SEX:9, RACE:10, SCHOOL:11, DISTRICT:12, USER_ID:13, CONSEC_STATUS:24, WEEK:26 };
  const INST = { FILLED_BY:0, FILLED_FOR:1, ENGAGEMENT:2, ENJOYMENT:3, LEARNING:4, OVERALL:5, COMMENT_ADMIN:6, COMMENT_SELF:7, DATE:8, SCHOOL:9, DISTRICT:10 };
  const STU  = { FILLED_BY:0, FILLED_FOR:1, CONFIDENCE:2, ENJOYMENT:3, LEARNING:4, OVERALL:5, COMMENT:6, DATE:7, SCHOOL:8, DISTRICT:9, REGION:10 };

  // Scholar-side reasons only — things a school partner can actually see and
  // act on. NJTC-internal service-interruption reasons (tutor vacancy,
  // internal errors, etc.) are a separate bucket below and are never shown
  // to partners.
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

  let BUNDLE = null;
  const charts = {};

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
    renderAll();
    hideLoading();
    document.dispatchEvent(new CustomEvent('partnerBundleReady', { detail: BUNDLE }));
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
    const byWeek = {};
    scholarRows.forEach(r => {
      const wk = (r[ATT.WEEK] || '').trim();
      if (!wk) return;
      const c = classifyAtt(r);
      if (c !== 'attended' && c !== 'absent') return;
      if (!byWeek[wk]) byWeek[wk] = { attended: 0, absent: 0 };
      byWeek[wk][c]++;
    });
    const weeks = Object.keys(byWeek).sort();
    return { weeks, rates: weeks.map(w => pct(byWeek[w].attended, byWeek[w].attended + byWeek[w].absent)) };
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

  // Scholars flagged by Pearl's own consecutive-absence signal — reframed
  // constructively for partners as scholars worth a check-in, with enough
  // detail (last attended, how many missed) to actually act on.
  function scholarsToCheckIn(scholarRows) {
    const byScholar = {};
    scholarRows.forEach(r => {
      const uid = (r[ATT.USER_ID] || '').trim();
      if (!uid) return;
      if (!byScholar[uid]) byScholar[uid] = { uid, name: (r[ATT.USER] || '').trim() || 'Unknown', flagged: false, lastAttended: null, absences: 0 };
      const s = byScholar[uid];
      const c = classifyAtt(r);
      if (c === 'attended') {
        const d = (r[ATT.SESS_DATE] || '').trim();
        if (d && (!s.lastAttended || d > s.lastAttended)) s.lastAttended = d;
      } else if (c === 'absent') {
        s.absences++;
      }
      if ((r[ATT.CONSEC_STATUS] || '').trim() === 'Attendance Concern') s.flagged = true;
    });
    return Object.values(byScholar).filter(s => s.flagged).sort((a, b) => b.absences - a.absences);
  }

  // ══════════════════════════════════════════════════════════════════════
  //  CURATED "HIGHLIGHTS" — positive-only, per partner-relationship policy
  // ══════════════════════════════════════════════════════════════════════
  function isSafelyPositive(text) {
    return !!text && text.length > 3 && !NEGATIVE_QUOTE_SIGNALS.test(text);
  }

  function sessionHighlights() {
    const scholarQuotes = (BUNDLE.scholarSurveys || [])
      .filter(r => parseFloat(r[STU.OVERALL]) >= 4)
      .map(r => ({ text: (r[STU.COMMENT] || '').trim(), who: 'Scholar' }));
    const tutorQuotes = (BUNDLE.tutorSurveys || [])
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
    renderSurveyView('scholar', BUNDLE.scholarSurveys || [], STU,
      { c1: 'CONFIDENCE', c2: 'ENJOYMENT', c3: 'LEARNING' },
      ['How confident scholars felt they understood the material', 'How much scholars enjoyed the session', 'How much scholars felt they learned']);
    renderSurveyView('tutor', BUNDLE.tutorSurveys || [], INST,
      { c1: 'ENGAGEMENT', c2: 'ENJOYMENT', c3: 'LEARNING' },
      ['How engaged scholars were during the session', 'How much the tutor enjoyed the session', 'How much the tutor felt scholars learned']);
  }

  // ══════════════════════════════════════════════════════════════════════
  //  SUMMARY
  // ══════════════════════════════════════════════════════════════════════
  function renderSummary() {
    const el = document.getElementById('view-summary');
    const id = BUNDLE.identity;
    const attAll = BUNDLE.attendance || [];

    if (!attAll.length && !(BUNDLE.scholarSurveys || []).length && !(BUNDLE.tutorSurveys || []).length) {
      el.innerHTML = heroHtml(id) + noDataCard();
      return;
    }

    const stats = scholarStats(attAll);
    const uniqueScholars = new Set(stats.rows.map(r => (r[ATT.USER_ID] || '').trim()).filter(Boolean)).size;
    const checkIns = scholarsToCheckIn(stats.rows);
    const sessions = new Set(attAll.map(r => r[ATT.SESSION]).filter(Boolean)).size;

    let scholarPos = 0, scholarScored = 0;
    (BUNDLE.scholarSurveys || []).forEach(r => {
      const v = parseFloat(r[STU.OVERALL]);
      if (isNaN(v)) return;
      scholarScored++;
      if (v >= 4) scholarPos++;
    });

    const highlights = sessionHighlights();

    el.innerHTML = heroHtml(id) + `
      <div class="pt-grid pt-grid-4" style="margin-bottom:1.1rem">
        ${kpiCard('✅', stats.rate == null ? '—' : stats.rate + '%', 'Scholar Attendance Rate')}
        ${kpiCard('🧑‍🎓', uniqueScholars.toLocaleString(), 'Scholars Served')}
        ${kpiCard('🤝', checkIns.length.toLocaleString(), 'Scholars to Check In With')}
        ${kpiCard('💛', scholarScored ? pct(scholarPos, scholarScored) + '%' : '—', 'Scholars Loving Their Sessions')}
      </div>
      <div class="pt-grid pt-grid-2">
        <div class="pt-card">
          <div class="pt-card-title">✨ Session Highlights</div>
          ${highlights.length ? highlights.map(c => `
            <div class="pt-quote">"${esc(c.text)}"<div class="pt-quote-meta">— ${c.who}</div></div>
          `).join('') : `<p style="color:var(--muted);font-size:.85rem">No highlighted comments yet this period.</p>`}
        </div>
        <div class="pt-card">
          <div class="pt-card-title">📊 This Year at a Glance</div>
          ${quickBar('Attended', stats.attended, stats.attended + stats.absent, BRAND.pos)}
          ${quickBar('Missed', stats.absent, stats.attended + stats.absent, BRAND.neg)}
          <p style="font-size:.72rem;color:var(--muted);margin:.6rem 0 .9rem">Excused time (school events, testing days, holidays) isn't counted against the rate above.</p>
          <div style="display:flex;gap:1.5rem;padding-top:.5rem;border-top:1px solid var(--border-2)">
            <div><div class="pt-kpi-val" style="font-size:1.4rem">${sessions.toLocaleString()}</div><div class="pt-kpi-sub">Sessions Delivered</div></div>
            <div><div class="pt-kpi-val" style="font-size:1.4rem">${(BUNDLE.scholarSurveys || []).length.toLocaleString()}</div><div class="pt-kpi-sub">Scholar Surveys</div></div>
          </div>
        </div>
      </div>`;
  }

  function heroHtml(id) {
    const season = (BUNDLE && BUNDLE.season) ? 'SY ' + BUNDLE.season : 'Current School Year';
    return `<div class="pt-hero">
      <h1>Welcome, ${esc((id.name || '').split(' ')[0] || 'Partner')}</h1>
      <p>${esc(scopeLabel(id))} — New Jersey Tutoring Corps ${esc(season)}</p>
    </div>`;
  }
  function kpiCard(icon, val, sub) {
    return `<div class="pt-card"><div class="pt-kpi-icon">${icon}</div><div class="pt-kpi-val">${val}</div><div class="pt-kpi-sub">${sub}</div></div>`;
  }
  function quickBar(label, n, total, color) {
    const p = pct(n, total) || 0;
    return `<div class="pt-sentiment-row">
      <div class="pt-sentiment-label">${label}</div>
      <div class="pt-sentiment-track"><div class="pt-sentiment-fill" style="width:${p}%;background:${color}">${n}</div></div>
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
    const attAll = BUNDLE.attendance || [];
    const el = document.getElementById('view-attendance');
    if (!attAll.length) { el.innerHTML = noDataCard(); return; }

    const stats = scholarStats(attAll);
    if (!stats.rows.length) { el.innerHTML = noDataCard(); return; }

    const weekly = scholarWeeklyRate(stats.rows);
    const reasons = scholarMissedReasons(stats.rows).slice(0, 8);
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
          <div class="pt-card-title">📈 Weekly Scholar Attendance Rate</div>
          <canvas id="chartWeekly" height="90"></canvas>
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
      ${checkIns.length ? `
      <div class="pt-card" style="margin-bottom:1.1rem">
        <div class="pt-card-title">🤝 Scholars to Check In With</div>
        <p style="font-size:.82rem;color:var(--text-2);margin-bottom:.9rem">These scholars have missed several sessions in a row. A quick check-in — with the scholar, a teacher, or family — often turns this around.</p>
        <table class="pt-table"><thead><tr><th>Pearl ID</th><th>Scholar</th><th>Sessions Missed</th><th>Last Attended</th></tr></thead><tbody>
          ${checkIns.slice(0, 25).map(s => `<tr><td style="font-family:'JetBrains Mono',monospace;font-size:.75rem">${esc(s.uid)}</td><td>${esc(s.name)}</td><td>${s.absences}</td><td>${esc(s.lastAttended || '—')}</td></tr>`).join('')}
        </tbody></table>
      </div>` : ''}
      <div class="pt-grid pt-grid-2" style="margin-bottom:1.1rem">
        <div class="pt-card">
          <div class="pt-card-title">🔍 Why Scholars Missed a Session</div>
          ${reasons.length ? barRows(reasons, reasons[0][1], BRAND.blue) : `<p style="color:var(--muted);font-size:.85rem">No missed sessions logged.</p>`}
        </div>
        <div class="pt-card">
          <div class="pt-card-title">👥 Scholar Attendance</div>
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

    if (weekly.weeks.length) {
      drawRateLine('chartWeekly', weekly.weeks, weekly.rates, BRAND.blue);
    }
  }

  function barRows(entries, max, color) {
    return entries.map(([label, count]) => `
      <div class="pt-bar-row" style="align-items:flex-start">
        <div style="flex:1;min-width:0">
          <div style="font-size:.78rem;color:var(--text-2);margin-bottom:.25rem">${esc(label)}</div>
          <div class="pt-bar-track"><div class="pt-bar-fill" style="width:${Math.round(count / max * 100)}%;background:${color}"></div></div>
        </div>
        <div class="pt-bar-count" style="align-self:center">${count}</div>
      </div>`).join('');
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
          <div class="pt-card-title">Sentiment Overview</div>
          ${sentimentRow('Positive', pos, scored, BRAND.pos)}
          ${sentimentRow('Neutral', neu, scored, BRAND.neu)}
          ${sentimentRow('Negative', neg, scored, BRAND.neg)}
        </div>
        <div class="pt-card">
          <div class="pt-card-title">What This Means</div>
          <p style="font-size:.85rem;color:var(--text-2);line-height:1.6">
            Positive = rated 4–5, Neutral = rated 3, Negative = rated 1–2, on the "Overall, how did this session go?" question.
            Based on ${scored.toLocaleString()} responses.
          </p>
        </div>
      </div>
      <div class="pt-grid pt-grid-2" style="margin-bottom:1.1rem">
        <div class="pt-card"><div class="pt-card-title">${esc(labels[0])}</div><canvas id="chart-${kind}-c1" height="140"></canvas></div>
        <div class="pt-card"><div class="pt-card-title">Overall, How Did This Session Go?</div><canvas id="chart-${kind}-overall" height="140"></canvas></div>
        <div class="pt-card"><div class="pt-card-title">${esc(labels[1])}</div><canvas id="chart-${kind}-c2" height="140"></canvas></div>
        <div class="pt-card"><div class="pt-card-title">${esc(labels[2])}</div><canvas id="chart-${kind}-c3" height="140"></canvas></div>
      </div>`;

    drawHistogram(`chart-${kind}-c1`, dist(rows, cols[qkeys.c1]), BRAND.blue);
    drawHistogram(`chart-${kind}-c2`, dist(rows, cols[qkeys.c2]), BRAND.blue);
    drawHistogram(`chart-${kind}-c3`, dist(rows, cols[qkeys.c3]), BRAND.blue);
    drawDonut(`chart-${kind}-overall`, dist(rows, cols.OVERALL));
  }

  function sentimentRow(label, n, total, color) {
    const p = pct(n, total) || 0;
    return `<div class="pt-sentiment-row">
      <div class="pt-sentiment-label">${label}</div>
      <div class="pt-sentiment-track"><div class="pt-sentiment-fill" style="width:${p}%;background:${color}">${p}%</div></div>
    </div>`;
  }

  function dist(rows, colIdx) {
    const counts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    rows.forEach(r => {
      const v = Math.round(parseFloat(r[colIdx]));
      if (counts[v] !== undefined) counts[v]++;
    });
    return counts;
  }

  // ── Chart.js helpers ──────────────────────────────────────────────────
  function destroy(id) { if (charts[id]) { charts[id].destroy(); delete charts[id]; } }

  function drawRateLine(id, labels, data, color) {
    const canvas = document.getElementById(id);
    if (!canvas || typeof Chart === 'undefined') return;
    destroy(id);
    charts[id] = new Chart(canvas, {
      type: 'line',
      data: { labels, datasets: [{ label: 'Scholar Attendance Rate', data, borderColor: color, backgroundColor: color + '22', tension: .3, fill: true, pointRadius: 2 }] },
      options: {
        responsive: true, plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => c.parsed.y + '%' } } },
        scales: { x: { ticks: { maxTicksLimit: 8, font: { size: 10 } } }, y: { beginAtZero: true, max: 100, ticks: { callback: v => v + '%' } } }
      }
    });
  }

  function drawHistogram(id, counts, color) {
    const canvas = document.getElementById(id);
    if (!canvas || typeof Chart === 'undefined') return;
    destroy(id);
    charts[id] = new Chart(canvas, {
      type: 'bar',
      data: { labels: ['1', '2', '3', '4', '5'], datasets: [{ data: [1,2,3,4,5].map(k => counts[k]), backgroundColor: color, borderRadius: 4 }] },
      options: {
        responsive: true, plugins: { legend: { display: false } },
        scales: { y: { beginAtZero: true, ticks: { precision: 0 } } }
      }
    });
  }

  function drawDonut(id, counts) {
    const canvas = document.getElementById(id);
    if (!canvas || typeof Chart === 'undefined') return;
    destroy(id);
    charts[id] = new Chart(canvas, {
      type: 'doughnut',
      data: { labels: ['1', '2', '3', '4', '5'], datasets: [{ data: [1,2,3,4,5].map(k => counts[k]), backgroundColor: ['#b91c1c','#dc6b3f','#7d8fa1','#1a7aff','#0050c8'] }] },
      options: { responsive: true, plugins: { legend: { position: 'right', labels: { boxWidth: 12, font: { size: 11 } } } } }
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
