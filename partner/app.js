/* ============================================================================
   NJTC PARTNER DASHBOARD
   Renders Summary / Attendance Tracking / Scholar Survey / Tutor Survey from
   the single scoped bundle at partner/data/<token>.json. This page never
   fetches any other district's data — see scripts/build-partner-data.js.
   ============================================================================ */
(function () {
  'use strict';

  const BASE = '/New-Jersey-Tutoring-Corps-Portal';

  const ATT  = { USER:0, ROLE:1, SESSION:2, SESS_STATUS:3, PLAN_START:4, SESS_DATE:5, ATT_STATUS:6, MISS_REASON:7, GRADE:8, SEX:9, RACE:10, SCHOOL:11, DISTRICT:12, USER_ID:13, WEEK:26 };
  const INST = { FILLED_BY:0, FILLED_FOR:1, ENGAGEMENT:2, ENJOYMENT:3, LEARNING:4, OVERALL:5, COMMENT_ADMIN:6, COMMENT_SELF:7, DATE:8, SCHOOL:9, DISTRICT:10 };
  const STU  = { FILLED_BY:0, FILLED_FOR:1, CONFIDENCE:2, ENJOYMENT:3, LEARNING:4, OVERALL:5, COMMENT:6, DATE:7, SCHOOL:8, DISTRICT:9, REGION:10 };

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

    try {
      const res = await fetch(`${BASE}/partner/data/${session.pid}.json?v=${Date.now()}`);
      if (!res.ok) throw new Error('HTTP ' + res.status);
      BUNDLE = await res.json();
    } catch (e) {
      fatalError();
      return;
    }

    window.NJTC_BUNDLE = BUNDLE; // read-only handoff to pie-bot.js
    personalize();
    wireChrome();
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
        <p>Please refresh the page. If this keeps happening, contact your NJTC Program Manager — your login may need to be re-issued.</p>
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
        document.querySelectorAll('.pt-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        document.querySelectorAll('.pt-view').forEach(v => v.classList.remove('active'));
        document.getElementById('view-' + tab.dataset.view).classList.add('active');
      });
    });
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) logoutBtn.addEventListener('click', () => window.NJTCAuth.logout());
  }

  // ── Attendance classification (mirrors onsite/pearl-data.js) ─────────────
  function classifyAtt(row) {
    const status = (row[ATT.ATT_STATUS] || '').trim();
    const reason = (row[ATT.MISS_REASON] || '').trim();
    const isInstructor = (row[ATT.ROLE] || '').trim() === 'Instructor';
    if (status === 'Attended') return 'attended';
    if (status === 'Late') return 'late';
    if (status === 'Not recorded') return 'not_recorded';
    if (status === 'Missed') {
      if (isInstructor) return TUTOR_MISS_REASONS.has(reason) ? 'absent' : 'si';
      return (SCHOLAR_MISS_REASONS.has(reason) || reason === '') ? 'absent' : 'si';
    }
    return 'other';
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
    const att = BUNDLE.attendance || [];
    const el = document.getElementById('view-summary');
    const id = BUNDLE.identity;

    if (!att.length && !(BUNDLE.scholarSurveys || []).length && !(BUNDLE.tutorSurveys || []).length) {
      el.innerHTML = heroHtml(id) + noDataCard();
      return;
    }

    const sessions = new Set(att.map(r => r[ATT.SESSION]).filter(Boolean)).size;
    let attended = 0, missedTotal = 0, late = 0;
    att.forEach(r => {
      const c = classifyAtt(r);
      if (c === 'attended') attended++;
      else if (c === 'late') late++;
      else if (c === 'absent' || c === 'si') missedTotal++;
    });
    const rate = pct(attended + late, attended + late + missedTotal);

    const allComments = [
      ...(BUNDLE.scholarSurveys || []).map(r => ({ text: (r[STU.COMMENT] || '').trim(), who: 'Scholar' })),
      ...(BUNDLE.tutorSurveys || []).map(r => ({ text: (r[INST.COMMENT_SELF] || '').trim(), who: 'Tutor' }))
    ].filter(c => c.text && c.text.length > 3).slice(-8).reverse();

    el.innerHTML = heroHtml(id) + `
      <div class="pt-grid pt-grid-4" style="margin-bottom:1.1rem">
        ${kpiCard('📅', sessions.toLocaleString(), 'Total Sessions Delivered')}
        ${kpiCard('✅', rate == null ? '—' : rate + '%', 'Average Attendance Rate')}
        ${kpiCard('📝', (BUNDLE.scholarSurveys || []).length.toLocaleString(), 'Scholar Surveys Collected')}
        ${kpiCard('🎓', (BUNDLE.tutorSurveys || []).length.toLocaleString(), 'Tutor Surveys Collected')}
      </div>
      <div class="pt-grid pt-grid-2">
        <div class="pt-card">
          <div class="pt-card-title">💬 Scholar &amp; Tutor Voice</div>
          ${allComments.length ? allComments.map(c => `
            <div class="pt-quote">"${esc(c.text)}"<div class="pt-quote-meta">— ${c.who}</div></div>
          `).join('') : `<p style="color:var(--muted);font-size:.85rem">No written comments in this range yet.</p>`}
        </div>
        <div class="pt-card">
          <div class="pt-card-title">📊 Quick Review</div>
          ${quickBar('Attended', attended, attended + late + missedTotal, BRAND.pos)}
          ${quickBar('Late', late, attended + late + missedTotal, BRAND.gold)}
          ${quickBar('Missed', missedTotal, attended + late + missedTotal, BRAND.neg)}
        </div>
      </div>`;
  }

  function heroHtml(id) {
    return `<div class="pt-hero">
      <h1>Welcome, ${esc((id.name || '').split(' ')[0] || 'Partner')}</h1>
      <p>${esc(scopeLabel(id))} — New Jersey Tutoring Corps SY 2025–26</p>
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
  //  ATTENDANCE TRACKING
  // ══════════════════════════════════════════════════════════════════════
  function renderAttendance() {
    const att = BUNDLE.attendance || [];
    const el = document.getElementById('view-attendance');
    if (!att.length) { el.innerHTML = noDataCard(); return; }

    // Weekly missed trend
    const byWeek = {};
    att.forEach(r => {
      const wk = (r[ATT.WEEK] || '').trim() || 'Unknown';
      if (!byWeek[wk]) byWeek[wk] = { missed: 0, total: 0 };
      byWeek[wk].total++;
      const c = classifyAtt(r);
      if (c === 'absent' || c === 'si') byWeek[wk].missed++;
    });
    const weeks = Object.keys(byWeek).filter(w => w !== 'Unknown').sort();

    // Missed reasons
    const reasonCounts = {};
    att.forEach(r => {
      const c = classifyAtt(r);
      if (c !== 'absent' && c !== 'si') return;
      const reason = (r[ATT.MISS_REASON] || 'Unspecified').trim() || 'Unspecified';
      reasonCounts[reason] = (reasonCounts[reason] || 0) + 1;
    });
    const topReasons = Object.entries(reasonCounts).sort((a, b) => b[1] - a[1]).slice(0, 8);

    // Per-person table (scholars only — role !== Instructor)
    const byPerson = {};
    att.forEach(r => {
      const isInstructor = (r[ATT.ROLE] || '').trim() === 'Instructor';
      if (isInstructor) return;
      const uid = (r[ATT.USER_ID] || '').trim();
      const name = (r[ATT.USER] || '').trim();
      if (!uid && !name) return;
      const key = uid || name;
      if (!byPerson[key]) byPerson[key] = { uid: uid || '—', name: name || 'Unknown', attended: 0, late: 0, missed: 0 };
      const c = classifyAtt(r);
      if (c === 'attended') byPerson[key].attended++;
      else if (c === 'late') byPerson[key].late++;
      else if (c === 'absent' || c === 'si') byPerson[key].missed++;
    });
    const people = Object.values(byPerson).sort((a, b) => a.name.localeCompare(b.name));

    let attended = 0, late = 0, missed = 0;
    att.forEach(r => { const c = classifyAtt(r); if (c === 'attended') attended++; else if (c === 'late') late++; else if (c === 'absent' || c === 'si') missed++; });
    const rate = pct(attended + late, attended + late + missed);

    el.innerHTML = `
      <div class="pt-grid" style="grid-template-columns:2fr 1fr;gap:1.1rem;margin-bottom:1.1rem">
        <div class="pt-card">
          <div class="pt-card-title">📈 Weekly Missed-Session Trend</div>
          <canvas id="chartWeekly" height="90"></canvas>
        </div>
        <div class="pt-card">
          <div class="pt-card-title">Average Attendance Rate</div>
          <div class="pt-kpi-val" style="font-size:2.6rem">${rate == null ? '—' : rate + '%'}</div>
          <div style="margin-top:1rem">
            ${quickBar('Attended', attended, attended + late + missed, BRAND.pos)}
            ${quickBar('Late', late, attended + late + missed, BRAND.gold)}
            ${quickBar('Missed', missed, attended + late + missed, BRAND.neg)}
          </div>
        </div>
      </div>
      <div class="pt-grid pt-grid-2" style="margin-bottom:1.1rem">
        <div class="pt-card">
          <div class="pt-card-title">🔍 Missed-Session Reasons</div>
          ${topReasons.length ? barRows(topReasons, topReasons[0][1], BRAND.blue) : `<p style="color:var(--muted);font-size:.85rem">No missed sessions logged.</p>`}
        </div>
        <div class="pt-card">
          <div class="pt-card-title">👥 Scholar Attendance</div>
          <div style="max-height:360px;overflow:auto">
            <table class="pt-table"><thead><tr><th>Pearl ID</th><th>Scholar</th><th>Attendance</th></tr></thead><tbody>
              ${people.slice(0, 300).map(p => {
                const r = pct(p.attended + p.late, p.attended + p.late + p.missed);
                const cls = r == null ? '' : r >= 90 ? 'pt-pill-good' : r >= 75 ? 'pt-pill-warn' : 'pt-pill-bad';
                return `<tr><td style="font-family:'JetBrains Mono',monospace;font-size:.75rem">${esc(p.uid)}</td><td>${esc(p.name)}</td><td><span class="pt-pill ${cls}">${r == null ? '—' : r + '%'}</span></td></tr>`;
              }).join('')}
            </tbody></table>
          </div>
        </div>
      </div>`;

    if (weeks.length) {
      drawLine('chartWeekly', weeks.map(w => w), weeks.map(w => byWeek[w].missed), BRAND.blue);
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

  function drawLine(id, labels, data, color) {
    const canvas = document.getElementById(id);
    if (!canvas || typeof Chart === 'undefined') return;
    destroy(id);
    charts[id] = new Chart(canvas, {
      type: 'line',
      data: { labels, datasets: [{ label: 'Missed Sessions', data, borderColor: color, backgroundColor: color + '22', tension: .3, fill: true, pointRadius: 2 }] },
      options: { responsive: true, plugins: { legend: { display: false } }, scales: { x: { ticks: { maxTicksLimit: 8, font: { size: 10 } } }, y: { beginAtZero: true } } }
    });
  }

  function drawHistogram(id, counts, color) {
    const canvas = document.getElementById(id);
    if (!canvas || typeof Chart === 'undefined') return;
    destroy(id);
    charts[id] = new Chart(canvas, {
      type: 'bar',
      data: { labels: ['1', '2', '3', '4', '5'], datasets: [{ data: [1,2,3,4,5].map(k => counts[k]), backgroundColor: color, borderRadius: 4 }] },
      options: { responsive: true, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { precision: 0 } } } }
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
