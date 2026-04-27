(function() {
'use strict';

// ══════════════════════════════════════════════════════════════════════════
//  PROGRAM DATA SUMMARY  —  "Program Pulse"
//  Visible to: programming, data departments
//  Reads from: po.getProgramSummaryData(), irlab.getInsightMetrics()
//  No direct API calls — all data is already in memory.
// ══════════════════════════════════════════════════════════════════════════

// ── CSS ───────────────────────────────────────────────────────────────────
(function injectStyles() {
  const css = `
  /* ── Trigger button (floating pill) ─────────────────────────── */
  #pdsPulseBtn {
    position: fixed; bottom: 1.5rem; left: 50%;
    transform: translateX(-50%);
    z-index: 440;
    display: none;
    align-items: center; gap: .55rem;
    background: linear-gradient(135deg, #1a3a5c 0%, #1d5fa8 100%);
    color: #fff;
    border: none; border-radius: 30px;
    padding: .55rem 1.35rem .55rem 1rem;
    font-size: .8125rem; font-weight: 700;
    font-family: 'DM Sans', sans-serif;
    letter-spacing: .01em;
    cursor: pointer;
    box-shadow: 0 4px 20px rgba(26,58,92,.40), 0 1px 4px rgba(0,0,0,.15);
    transition: transform .18s ease, box-shadow .18s ease;
    white-space: nowrap;
  }
  #pdsPulseBtn.visible { display: flex; }
  #pdsPulseBtn:hover {
    transform: translateX(-50%) translateY(-2px);
    box-shadow: 0 8px 28px rgba(26,58,92,.50);
  }
  #pdsPulseBtn .pds-btn-dot {
    width: 8px; height: 8px; border-radius: 50%;
    background: #4ade80;
    animation: pdsBlink 2.2s ease infinite;
    flex-shrink: 0;
  }
  @keyframes pdsBlink { 0%,100%{opacity:1} 50%{opacity:.35} }

  /* ── Full-screen overlay ─────────────────────────────────────── */
  #pdsOverlay {
    display: none; position: fixed; inset: 0;
    background: rgba(10,22,40,.55);
    backdrop-filter: blur(3px);
    z-index: 8800;
  }
  #pdsOverlay.open { display: block; }

  /* ── Sheet panel (slides up from bottom) ────────────────────── */
  #pdsSheet {
    position: fixed; left: 0; right: 0; bottom: 0;
    height: 88vh;
    background: var(--surface);
    border-radius: 20px 20px 0 0;
    box-shadow: 0 -8px 48px rgba(10,22,40,.20);
    z-index: 8801;
    display: flex; flex-direction: column;
    transform: translateY(100%);
    transition: transform .36s cubic-bezier(.32,.72,0,1);
    overflow: hidden;
  }
  #pdsSheet.open { transform: translateY(0); }

  /* ── Sheet header ─────────────────────────────────────────────── */
  .pds-header {
    display: flex; align-items: center; gap: 1rem;
    padding: 1.125rem 1.5rem 0;
    flex-shrink: 0;
  }
  .pds-header-left { flex: 1; min-width: 0; }
  .pds-eyebrow {
    font-size: .6875rem; font-weight: 700; text-transform: uppercase;
    letter-spacing: .09em; color: var(--muted); margin-bottom: .2rem;
  }
  .pds-title {
    font-family: 'DM Serif Display', serif;
    font-size: 1.3rem; color: var(--navy); line-height: 1.2;
  }
  .pds-subtitle { font-size: .8rem; color: var(--muted); margin-top: .2rem; }
  .pds-close-btn {
    background: var(--surface-2); border: 1.5px solid var(--border);
    border-radius: 10px; width: 36px; height: 36px;
    display: flex; align-items: center; justify-content: center;
    font-size: 1.1rem; cursor: pointer; color: var(--muted);
    transition: background .15s, color .15s; flex-shrink: 0;
  }
  .pds-close-btn:hover { background: var(--border); color: var(--navy); }

  /* ── Tabs ────────────────────────────────────────────────────── */
  .pds-tab-bar {
    display: flex; gap: .3rem; padding: .875rem 1.5rem .5rem;
    border-bottom: 1.5px solid var(--border); flex-shrink: 0;
    overflow-x: auto; scrollbar-width: none;
  }
  .pds-tab-bar::-webkit-scrollbar { display: none; }
  .pds-tab {
    padding: .4rem 1rem; border-radius: 20px;
    font-size: .8125rem; font-weight: 600;
    background: transparent; border: 1.5px solid transparent;
    color: var(--muted); cursor: pointer;
    font-family: 'DM Sans', sans-serif; white-space: nowrap;
    transition: background .15s, color .15s, border-color .15s;
  }
  .pds-tab:hover { background: var(--surface-2); color: var(--navy); }
  .pds-tab.active {
    background: var(--navy); color: #fff;
    border-color: var(--navy);
  }

  /* ── Scrollable body ─────────────────────────────────────────── */
  .pds-body {
    flex: 1; overflow-y: auto; padding: 1.25rem 1.5rem 2rem;
    scrollbar-width: thin; scrollbar-color: var(--border) transparent;
  }
  .pds-body::-webkit-scrollbar { width: 4px; }
  .pds-body::-webkit-scrollbar-thumb { background: var(--border); border-radius: 4px; }

  /* ── Refresh bar ─────────────────────────────────────────────── */
  .pds-sync-bar {
    display: flex; align-items: center; gap: .5rem;
    padding: .5rem 1.5rem; background: var(--surface-2);
    border-bottom: 1px solid var(--border);
    font-size: .75rem; color: var(--muted); flex-shrink: 0;
  }

  /* ── Health banner ───────────────────────────────────────────── */
  .pds-banner {
    border-radius: 12px; padding: 1rem 1.25rem;
    display: flex; align-items: flex-start; gap: .875rem;
    margin-bottom: 1.25rem;
  }
  .pds-banner.green { background: #f0fdf4; border: 1.5px solid #86efac; }
  .pds-banner.amber { background: #fffbeb; border: 1.5px solid #fcd34d; }
  .pds-banner.red   { background: #fff1f2; border: 1.5px solid #fca5a5; }
  .pds-banner-icon { font-size: 1.75rem; flex-shrink: 0; line-height: 1; }
  .pds-banner-title { font-weight: 700; font-size: .9375rem; color: var(--navy); margin-bottom: .2rem; }
  .pds-banner-body  { font-size: .8125rem; color: var(--text-2); line-height: 1.55; }

  /* ── Stat grid ───────────────────────────────────────────────── */
  .pds-stat-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
    gap: .625rem; margin-bottom: 1.25rem;
  }
  .pds-stat {
    background: var(--surface); border: 1.5px solid var(--border);
    border-radius: 10px; padding: .75rem .875rem; text-align: center;
  }
  .pds-stat-val {
    font-size: 1.6rem; font-weight: 800; line-height: 1;
    font-family: 'DM Serif Display', serif;
  }
  .pds-stat-label {
    font-size: .6875rem; color: var(--muted);
    text-transform: uppercase; letter-spacing: .05em;
    margin-top: .3rem; line-height: 1.3;
  }

  /* ── Section card ────────────────────────────────────────────── */
  .pds-card {
    background: var(--surface); border: 1.5px solid var(--border);
    border-radius: 12px; padding: 1rem 1.125rem; margin-bottom: .875rem;
  }
  .pds-card-title {
    font-weight: 700; font-size: .875rem; color: var(--navy);
    margin-bottom: .625rem;
  }
  .pds-card-body { font-size: .8125rem; color: var(--text-2); line-height: 1.6; }

  /* ── Action callout box ──────────────────────────────────────── */
  .pds-action-box {
    background: #eff6ff; border: 1.5px solid #bfdbfe;
    border-left: 4px solid #2563eb;
    border-radius: 0 10px 10px 0;
    padding: .875rem 1rem; margin-bottom: 1.25rem;
    font-size: .8125rem; line-height: 1.65;
  }
  .pds-action-label {
    font-size: .6875rem; font-weight: 700; text-transform: uppercase;
    letter-spacing: .07em; color: #1d4ed8; margin-bottom: .35rem;
  }

  /* ── Alert row ───────────────────────────────────────────────── */
  .pds-alert-row {
    display: flex; align-items: flex-start; gap: .625rem;
    padding: .625rem .75rem; border-radius: 8px;
    margin-bottom: .4rem; font-size: .8125rem;
  }
  .pds-alert-row.critical { background: #fff1f2; border: 1px solid #fca5a5; }
  .pds-alert-row.high     { background: #fff7ed; border: 1px solid #fed7aa; }
  .pds-alert-row.medium   { background: #fffbeb; border: 1px solid #fde68a; }
  .pds-alert-row.ok       { background: #f0fdf4; border: 1px solid #86efac; }
  .pds-alert-row.neutral  { background: var(--surface-2); border: 1px solid var(--border); }

  /* ── Bar row (reason breakdown) ─────────────────────────────── */
  .pds-bar-row {
    display: flex; align-items: center; gap: .5rem;
    margin-bottom: .35rem; font-size: .8rem;
  }
  .pds-bar-label { min-width: 0; flex: 1; color: var(--text-2); truncate: ellipsis; overflow: hidden; white-space: nowrap; }
  .pds-bar-track { width: 90px; height: 6px; background: var(--border-2); border-radius: 3px; flex-shrink: 0; overflow: hidden; }
  .pds-bar-fill  { height: 100%; border-radius: 3px; background: var(--blue-mid); }
  .pds-bar-count { font-weight: 700; color: var(--navy); min-width: 22px; text-align: right; flex-shrink: 0; }

  /* ── Trend bar chart ─────────────────────────────────────────── */
  .pds-trend-chart {
    display: flex; align-items: flex-end; gap: 3px;
    height: 72px; margin-bottom: .5rem;
  }
  .pds-trend-col { display: flex; flex-direction: column; align-items: center; flex: 1; position: relative; }
  .pds-trend-bar { width: 100%; border-radius: 3px 3px 0 0; min-height: 3px; cursor: default; }
  .pds-trend-lbl { font-size: .55rem; color: var(--muted); margin-top: 2px; text-align: center; white-space: nowrap; overflow: hidden; }

  /* ── Regional comparison ────────────────────────────────────── */
  .pds-region-grid { display: grid; grid-template-columns: 1fr 1fr; gap: .875rem; margin-bottom: 1.25rem; }
  .pds-region-card { background: var(--surface); border: 1.5px solid var(--border); border-radius: 12px; padding: 1rem; }
  .pds-region-label { font-size: .6875rem; font-weight: 700; text-transform: uppercase; letter-spacing: .08em; color: var(--muted); margin-bottom: .375rem; }
  .pds-region-name  { font-size: 1.125rem; font-weight: 800; color: var(--navy); margin-bottom: .625rem; }

  /* ── Comment card ────────────────────────────────────────────── */
  .pds-comment { padding: .625rem .75rem; border-radius: 8px; margin-bottom: .4rem; font-size: .8125rem; line-height: 1.5; }
  .pds-comment.concern  { background: #fff7ed; border-left: 3px solid #f59e0b; }
  .pds-comment.positive { background: #f0fdf4; border-left: 3px solid #22c55e; }
  .pds-comment-meta { font-size: .7rem; color: var(--muted); margin-top: .25rem; }

  /* ── Discrepancy flag ────────────────────────────────────────── */
  .pds-flag { background: #fff7ed; border: 1px solid #fed7aa; border-left: 3px solid #f59e0b; border-radius: 0 8px 8px 0; padding: .625rem .875rem; margin-bottom: .5rem; font-size: .8125rem; }
  .pds-flag-title { font-weight: 700; color: #92400e; margin-bottom: .2rem; }
  .pds-flag-body  { color: var(--text-2); line-height: 1.5; }

  /* ── Empty state ─────────────────────────────────────────────── */
  .pds-empty { text-align: center; padding: 3rem 1.5rem; color: var(--muted); font-size: .875rem; }
  .pds-empty-icon { font-size: 2.5rem; margin-bottom: .75rem; }

  /* ── Loading spinner ─────────────────────────────────────────── */
  .pds-loading { text-align: center; padding: 3rem; color: var(--muted); font-size: .875rem; }

  /* ── Academic section ────────────────────────────────────────── */
  .pds-acad-tier { display: flex; align-items: center; gap: .75rem; padding: .5rem 0; border-bottom: 1px solid var(--border-2); }
  .pds-acad-tier:last-child { border-bottom: none; }
  .pds-acad-tier-dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }

  @media (max-width: 640px) {
    #pdsSheet { height: 94vh; }
    .pds-region-grid { grid-template-columns: 1fr; }
    .pds-stat-grid { grid-template-columns: repeat(2, 1fr); }
    .pds-body { padding: 1rem 1rem 2rem; }
    .pds-header, .pds-tab-bar, .pds-sync-bar { padding-left: 1rem; padding-right: 1rem; }
  }
  `;
  const el = document.createElement('style');
  el.textContent = css;
  document.head.appendChild(el);
})();

// ── Helpers ────────────────────────────────────────────────────────────────
function rateColor(r) {
  if (r === null || r === undefined) return 'var(--muted)';
  if (r >= 90) return '#059669';
  if (r >= 80) return '#d97706';
  return '#dc2626';
}
function rateBg(r) {
  if (r === null || r === undefined) return 'var(--surface-2)';
  if (r >= 90) return '#f0fdf4';
  if (r >= 80) return '#fffbeb';
  return '#fff1f2';
}
function rateIcon(r) {
  if (r === null || r === undefined) return '—';
  if (r >= 90) return '✅';
  if (r >= 80) return '🟡';
  return '🔴';
}
function survIcon(v) {
  if (!v) return '—';
  if (v >= 4.5) return '⭐⭐⭐⭐⭐';
  if (v >= 4.0) return '⭐⭐⭐⭐';
  if (v >= 3.5) return '⭐⭐⭐';
  return '⭐⭐';
}
function pct(n, d) { return d > 0 ? Math.round(n / d * 100) : 0; }

// ── Banner builder ─────────────────────────────────────────────────────────
function buildBanner(icon, title, body, tone) {
  var cls = tone === 'green' ? 'green' : tone === 'red' ? 'red' : 'amber';
  return '<div class="pds-banner ' + cls + '">' +
    '<div class="pds-banner-icon">' + icon + '</div>' +
    '<div><div class="pds-banner-title">' + title + '</div>' +
    '<div class="pds-banner-body">' + body + '</div></div></div>';
}

// ── Stat grid builder ──────────────────────────────────────────────────────
function buildStatGrid(stats) {
  return '<div class="pds-stat-grid">' +
    stats.map(function(s) {
      var tipAttr = s.tooltip ? ' title="' + s.tooltip + '"' : '';
      return '<div class="pds-stat"' + tipAttr + (s.tooltip ? ' style="cursor:help"' : '') + '>' +
        '<div class="pds-stat-val" style="color:' + (s.color||'var(--navy)') + '">' + s.val + '</div>' +
        '<div class="pds-stat-label">' + s.label + '</div>' +
        '</div>';
    }).join('') + '</div>';
}

// ── Bar row builder ────────────────────────────────────────────────────────
function buildBarRows(items, max, color) {
  if (!items || !items.length) return '<div style="font-size:.8rem;color:var(--muted);padding:.25rem 0">None recorded</div>';
  return items.slice(0, 7).map(function(it) {
    var w = max > 0 ? Math.round(it.count / max * 100) : 0;
    var fill = color || 'var(--blue-mid)';
    return '<div class="pds-bar-row">' +
      '<div class="pds-bar-label" title="' + it.reason + '">' + it.reason + '</div>' +
      '<div class="pds-bar-track"><div class="pds-bar-fill" style="width:' + w + '%;background:' + fill + '"></div></div>' +
      '<div class="pds-bar-count">' + it.count + '</div></div>';
  }).join('');
}

// ── Trend chart builder ────────────────────────────────────────────────────
function buildTrendChart(weeks) {
  if (!weeks || !weeks.length) return '<div class="pds-empty"><div class="pds-empty-icon">📊</div>No trend data yet.</div>';
  var rates = weeks.map(function(w){ return w.scholarRate || 0; });
  var maxR = Math.max.apply(null, rates) || 1;
  var bars = weeks.map(function(w) {
    var h = Math.round((( w.scholarRate || 0) / maxR) * 60);
    var col = rateColor(w.scholarRate);
    var lbl = (w.week || '').replace(/week\s*/i, 'W').replace(/\s.*$/, '');
    return '<div class="pds-trend-col" title="' + w.week + ': ' + (w.scholarRate !== null ? w.scholarRate + '%' : '—') + '">' +
      '<div class="pds-trend-bar" style="height:' + h + 'px;background:' + col + '"></div>' +
      '<div class="pds-trend-lbl">' + lbl + '</div></div>';
  }).join('');
  return '<div class="pds-trend-chart">' + bars + '</div>';
}

// ── TAB: This Week ─────────────────────────────────────────────────────────
function renderThisWeek(d) {
  var cw = d.currentWeek;
  if (!cw) return '<div class="pds-empty"><div class="pds-empty-icon">⏳</div>Pearl data is still loading. Try again in a moment.</div>';

  var schRate = cw.scholarAtt.rate, tutRate = cw.tutorAtt.rate;
  var tone = schRate >= 90 ? 'green' : schRate >= 80 ? 'amber' : 'red';
  var bannerTitle = schRate >= 90 ? 'Program is running strong this week' :
                    schRate >= 80 ? 'Solid week — a few areas worth checking' :
                    'Attendance needs attention — follow up with your sites';
  var bannerBody = schRate >= 90
    ? 'Scholar attendance is above goal. Tutors are showing up. Keep the momentum going.'
    : schRate >= 80
    ? 'Attendance is in a healthy range but not yet at the 90% goal. Check the sites flagged below.'
    : 'Scholar attendance is below 80%. This affects scholar progress and partner satisfaction. Review the flagged sites and reach out this week.';

  var html = buildBanner(rateIcon(schRate), bannerTitle, bannerBody, tone);

  // Key numbers
  html += buildStatGrid([
    { val: schRate !== null ? schRate + '%' : '—', label: 'Scholar Attendance', color: rateColor(schRate) },
    { val: tutRate !== null ? tutRate + '%' : '—', label: 'Tutor Attendance',   color: rateColor(tutRate) },
    { val: cw.incompletes,                          label: 'Incomplete Sessions',color: cw.incompletes > 5 ? '#dc2626' : 'var(--navy)' },
    { val: cw.siTotal,                              label: 'Service Interruptions', color: cw.siTotal > 3 ? '#d97706' : 'var(--navy)' },
    { val: cw.scholarSurvey !== null ? cw.scholarSurvey + '/5' : (cw.surveyLoading ? 'Loading…' : 'No data'), label: 'Scholar Survey',  color: cw.scholarSurvey && cw.scholarSurvey < 3.5 ? '#dc2626' : cw.scholarSurvey ? '#7c3aed' : '#94a3b8', tooltip: 'Avg scholar survey score for surveys linked to this week\'s sessions by Session ID — captures surveys regardless of when they were submitted, including late submissions.' },
    { val: cw.tutorSurvey   !== null ? cw.tutorSurvey   + '/5' : (cw.surveyLoading ? 'Loading…' : 'No data'), label: 'Tutor Survey',    color: cw.tutorSurvey   && cw.tutorSurvey   < 3.5 ? '#dc2626' : cw.tutorSurvey ? '#7c3aed' : '#94a3b8', tooltip: 'Avg tutor survey score for surveys linked to this week\'s sessions by Session ID — captures surveys regardless of when they were submitted, including late submissions.' },
  ]);

  // What to do
  var actions = [];
  if (cw.incompletes > 0) actions.push('📋 <strong>' + cw.incompletes + ' sessions</strong> are still marked Scheduled — remind tutors to complete their attendance entry.');
  if (cw.siByLevel && (cw.serviceInterruptions.critical.length || cw.serviceInterruptions.high.length)) {
    var critN = cw.serviceInterruptions.critical.length, highN = cw.serviceInterruptions.high.length;
    if (critN) actions.push('🔴 <strong>' + critN + ' critical interruption' + (critN>1?'s':'') + '</strong> — review immediately (NJTC Internal Error).');
    if (highN) actions.push('🟠 <strong>' + highN + ' high-severity interruption' + (highN>1?'s':'') + '</strong> — check for tutor vacancies and escalate to HR if needed.');
  }
  if (cw.lowRatingSites && cw.lowRatingSites.length) actions.push('⭐ <strong>' + cw.lowRatingSites.length + ' site' + (cw.lowRatingSites.length>1?'s have':' has') + ' survey scores below 3.5</strong> — schedule a follow-up conversation with those site leaders.');
  if (schRate !== null && schRate < 80) actions.push('📞 Attendance is below 80%. Contact Program Managers to identify root causes at the lowest-performing sites.');
  if (!actions.length) actions.push('✅ No urgent actions this week. Keep checking in with your sites and reviewing comments below.');

  html += '<div class="pds-action-box"><div class="pds-action-label">🎯 What to Focus On This Week</div>' + actions.join('<br>') + '</div>';

  // Missed reasons
  html += '<div class="pds-card"><div class="pds-card-title">📊 Why Were Sessions Missed? (' + cw.label + ')</div>';
  var topMiss = cw.missedReasons.slice(0, 6);
  var maxMiss = topMiss.length ? topMiss[0].count : 1;
  html += buildBarRows(topMiss, maxMiss, '#457b9d');
  html += '<div class="pds-card-body" style="margin-top:.75rem;padding-top:.75rem;border-top:1px solid var(--border-2)">Absences marked <strong>Tutor Absent</strong> are a staffing issue — loop in HR. <strong>Scholar Absent</strong> is normal but watch for patterns. <strong>School Closure</strong> requires no action.</div></div>';

  // Service interruptions
  var siCards = '';
  var siLevels = [
    { key:'critical', label:'Critical',  color:'#dc2626', bg:'#fff1f2' },
    { key:'high',     label:'High',      color:'#ea580c', bg:'#fff7ed' },
    { key:'medium',   label:'Medium',    color:'#d97706', bg:'#fffbeb' },
  ];
  siLevels.forEach(function(lv) {
    var items = cw.serviceInterruptions[lv.key] || [];
    if (!items.length) return;
    items.forEach(function(it) {
      siCards += '<div class="pds-alert-row ' + lv.key + '"><span>' + lv.label.toUpperCase() + '</span><span style="flex:1">' + it.reason + '</span><strong>' + it.count + '</strong></div>';
    });
  });
  if (siCards) html += '<div class="pds-card"><div class="pds-card-title">⚡ Service Interruptions</div>' + siCards + '</div>';

  // Sites needing review
  if (d.areasToReview && d.areasToReview.length) {
    html += '<div class="pds-card"><div class="pds-card-title">🔍 Sites Requiring Attention (Below 80% Attendance)</div>';
    html += '<div class="pds-card-body" style="margin-bottom:.625rem">These sites have attendance below 80% overall. Reach out to the onsite lead and ask what\'s getting in the way.</div>';
    d.areasToReview.forEach(function(site) {
      html += '<div class="pds-alert-row ' + (site.attRate < 70 ? 'critical' : 'high') + '">' +
        '<span style="font-size:1rem">' + rateIcon(site.attRate) + '</span>' +
        '<div style="flex:1"><strong>' + site.school + '</strong><div style="font-size:.75rem;opacity:.75">' + site.district + '</div></div>' +
        '<strong style="color:' + rateColor(site.attRate) + '">' + site.attRate + '%</strong></div>';
    });
    html += '</div>';
  }

  // Positive callouts
  if (cw.positiveCallouts && cw.positiveCallouts.length) {
    html += '<div class="pds-card"><div class="pds-card-title">🌟 Positive Call-Outs This Week</div>';
    html += '<div class="pds-card-body" style="margin-bottom:.625rem">These sites are showing up strong. Shout them out in your next team meeting.</div>';
    cw.positiveCallouts.forEach(function(site) {
      html += '<div class="pds-alert-row ok">⭐ <div style="flex:1"><strong>' + site.school + '</strong><div style="font-size:.75rem;opacity:.75">' + site.district + '</div></div>' +
        '<strong style="color:#059669">' + site.attRate + '%</strong>' +
        (site.surveyAvg ? ' <span style="font-size:.75rem;color:#7c3aed;margin-left:.4rem">' + site.surveyAvg + '/5 ⭐</span>' : '') + '</div>';
    });
    html += '</div>';
  }

  // Stellar sites (overall)
  if (d.stellarSites && d.stellarSites.length) {
    html += '<div class="pds-card"><div class="pds-card-title">🏆 Top Performing Sites (Overall Program)</div>';
    d.stellarSites.forEach(function(site) {
      html += '<div class="pds-alert-row ok">🏅 <div style="flex:1"><strong>' + site.school + '</strong><div style="font-size:.75rem;opacity:.75">' + site.district + '</div></div>' +
        '<strong style="color:#059669">' + site.attRate + '%</strong>' +
        (site.surveyAvg ? ' <span style="font-size:.75rem;color:#7c3aed;margin-left:.4rem">' + site.surveyAvg + '/5</span>' : '') + '</div>';
    });
    html += '</div>';
  }

  return html;
}

// ── TAB: Trends ────────────────────────────────────────────────────────────
function renderTrends(d) {
  var trend = d.weeklyTrend || [];
  if (!trend.length) return '<div class="pds-empty"><div class="pds-empty-icon">📈</div>No trend data yet.</div>';

  var last = trend[trend.length - 1] || {};
  var prev = trend[trend.length - 2] || {};
  var delta = (last.scholarRate !== null && prev.scholarRate !== null) ? last.scholarRate - prev.scholarRate : null;
  var trendTone = delta === null ? 'amber' : delta >= 0 ? 'green' : delta < -5 ? 'red' : 'amber';
  var trendMsg  = delta === null ? 'Not enough data to show a trend yet.' :
                  delta >  2 ? 'Attendance is going up — great momentum. Keep the focus.' :
                  delta < -5 ? 'Attendance dropped ' + Math.abs(delta) + ' points this week. Something changed — follow up with your sites.' :
                               'Attendance is holding steady week over week.';

  var html = buildBanner('📈', 'Week-Over-Week Trend', trendMsg, trendTone);
  html += '<div class="pds-card"><div class="pds-card-title">Scholar Attendance % — Last ' + trend.length + ' Weeks</div>';
  html += buildTrendChart(trend);

  // Legend
  html += '<div style="display:flex;gap:1rem;font-size:.75rem;color:var(--muted);margin-top:.5rem;flex-wrap:wrap">' +
    '<span style="display:flex;align-items:center;gap:.3rem"><span style="width:10px;height:10px;border-radius:2px;background:#059669;display:inline-block"></span>90%+</span>' +
    '<span style="display:flex;align-items:center;gap:.3rem"><span style="width:10px;height:10px;border-radius:2px;background:#d97706;display:inline-block"></span>80–89%</span>' +
    '<span style="display:flex;align-items:center;gap:.3rem"><span style="width:10px;height:10px;border-radius:2px;background:#dc2626;display:inline-block"></span>Below 80%</span>' +
    '</div></div>';

  // Detailed week table
  html += '<div class="pds-card"><div class="pds-card-title">Week-by-Week Detail</div><div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:.8rem">';
  html += '<thead><tr style="background:var(--surface-2)"><th style="padding:.4rem .5rem;text-align:left;font-size:.7rem;color:var(--muted);border-bottom:1px solid var(--border)">Week</th><th style="padding:.4rem .5rem;text-align:center;font-size:.7rem;color:var(--muted);border-bottom:1px solid var(--border)">Scholar Att</th><th style="padding:.4rem .5rem;text-align:center;font-size:.7rem;color:var(--muted);border-bottom:1px solid var(--border)">Tutor Att</th><th style="padding:.4rem .5rem;text-align:center;font-size:.7rem;color:var(--muted);border-bottom:1px solid var(--border)">Interruptions</th><th style="padding:.4rem .5rem;text-align:center;font-size:.7rem;color:var(--muted);border-bottom:1px solid var(--border)">Survey Avg</th></tr></thead><tbody>';
  trend.slice().reverse().forEach(function(w) {
    html += '<tr style="border-bottom:1px solid var(--border-2)">' +
      '<td style="padding:.35rem .5rem;font-weight:600">' + w.week + '</td>' +
      '<td style="padding:.35rem .5rem;text-align:center;font-weight:700;color:' + rateColor(w.scholarRate) + '">' + (w.scholarRate !== null ? w.scholarRate + '%' : '—') + '</td>' +
      '<td style="padding:.35rem .5rem;text-align:center;color:' + rateColor(w.tutorRate) + '">'   + (w.tutorRate   !== null ? w.tutorRate   + '%' : '—') + '</td>' +
      '<td style="padding:.35rem .5rem;text-align:center;color:' + (w.siCount > 3 ? '#d97706' : 'var(--navy)') + '">' + (w.siCount || 0) + '</td>' +
      '<td style="padding:.35rem .5rem;text-align:center;color:#7c3aed">' + (w.surveyAvg || '—') + '</td></tr>';
  });
  html += '</tbody></table></div></div>';
  return html;
}

// ── TAB: Regional ──────────────────────────────────────────────────────────
function renderRegional(d) {
  var ne = d.regional.NE, sw = d.regional.SW;
  if (!ne && !sw) return '<div class="pds-empty"><div class="pds-empty-icon">🗺</div>Regional data not yet available.</div>';

  function regionCard(label, r, color) {
    if (!r) return '<div class="pds-region-card"><div class="pds-region-label">' + label + ' Region</div><div style="color:var(--muted);font-size:.8rem">No data</div></div>';
    return '<div class="pds-region-card" style="border-top:4px solid ' + color + '">' +
      '<div class="pds-region-label">' + label + ' Region</div>' +
      '<div class="pds-region-name" style="color:' + color + '">' + label + '</div>' +
      '<div style="font-size:.8rem;color:var(--muted);margin-bottom:.75rem">' + (r.schools || 0) + ' schools tracked</div>' +
      '<div style="display:flex;flex-direction:column;gap:.4rem">' +
        statRow('Scholar Attendance', r.scholarRate !== null ? r.scholarRate + '%' : '—', rateColor(r.scholarRate)) +
        statRow('Tutor Attendance',   r.tutorRate   !== null ? r.tutorRate   + '%' : '—', rateColor(r.tutorRate)) +
        statRow('Service Interruptions', r.siCount, r.siCount > 5 ? '#d97706' : 'var(--navy)') +
        statRow('Survey Avg', r.surveyAvg ? r.surveyAvg + '/5' : '—', '#7c3aed') +
      '</div></div>';
  }
  function statRow(label, val, color) {
    return '<div style="display:flex;justify-content:space-between;padding:.3rem 0;border-bottom:1px solid var(--border-2)">' +
      '<span style="font-size:.8rem;color:var(--text-2)">' + label + '</span>' +
      '<strong style="font-size:.8rem;color:' + color + '">' + val + '</strong></div>';
  }

  var html = '<div class="pds-region-grid">' + regionCard('NE', ne, '#2563eb') + regionCard('SW', sw, '#059669') + '</div>';

  // Comparison insight
  if (ne && sw && ne.scholarRate !== null && sw.scholarRate !== null) {
    var diff = ne.scholarRate - sw.scholarRate;
    var stronger = diff > 0 ? 'NE' : 'SW';
    var weaker   = diff > 0 ? 'SW' : 'NE';
    var absDiff  = Math.abs(diff);
    var insight  = absDiff < 3
      ? 'Both regions are performing very similarly. Great consistency across the network.'
      : 'The <strong>' + stronger + ' Region</strong> is running <strong>' + absDiff + ' percentage points higher</strong> in scholar attendance than the ' + weaker + ' Region. Look at what\'s working in ' + stronger + ' and share those practices.';
    html += buildBanner('🗺', 'Regional Comparison', insight, absDiff < 3 ? 'green' : 'amber');
  }

  // Onsite comments by region
  if (d.onsiteComments && d.onsiteComments.length) {
    html += '<div class="pds-card"><div class="pds-card-title">💬 Recent Onsite Comments</div>';
    html += '<div class="pds-card-body" style="margin-bottom:.75rem">These comments came from tutor and scholar surveys in the past 2 weeks. <strong>Orange = needs follow-up.</strong> Green = worth sharing as a positive.</div>';
    d.onsiteComments.slice(0, 10).forEach(function(c) {
      html += '<div class="pds-comment ' + c.type + '">"' + c.text.substring(0, 200) + (c.text.length > 200 ? '…' : '') + '"' +
        '<div class="pds-comment-meta">' + c.school + (c.district ? ' · ' + c.district : '') + ' · ' + c.week + '</div></div>';
    });
    html += '</div>';
  }
  return html;
}

// ── TAB: Academic (i-Ready) — SY 2025-2026 MOY + EOY ─────────────────────
function renderAcademic() {
  var irlab = window.irlab;
  if (!irlab) {
    return '<div class="pds-empty"><div class="pds-empty-icon">📚</div>i-Ready Lab not initialized.</div>';
  }

  var html = '';
  var medColor = function(v) { return v === null ? 'var(--muted)' : v >= 80 ? '#059669' : v >= 50 ? '#d97706' : '#dc2626'; };
  var gainColor = function(v) { return v === null ? 'var(--muted)' : v > 0 ? '#059669' : '#dc2626'; };

  // ── Section header helper ──────────────────────────────────────────────
  function secHead(emoji, label, badge, badgeColor) {
    return '<div style="display:flex;align-items:center;gap:.625rem;margin-bottom:.875rem;padding-bottom:.5rem;border-bottom:2px solid var(--border)">' +
      '<span style="font-size:1.25rem">' + emoji + '</span>' +
      '<span style="font-family:serif;font-size:1rem;color:var(--navy);font-weight:700">' + label + '</span>' +
      (badge ? '<span style="font-size:.6875rem;font-weight:700;padding:.2rem .6rem;border-radius:20px;background:' + (badgeColor||'#dbeafe') + ';color:' + (badgeColor ? '#fff' : '#1e40af') + '">' + badge + '</span>' : '') +
      '</div>';
  }

  function kpiRow(stats) {
    return '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:.5rem;margin-bottom:.875rem">' +
      stats.map(function(s) {
        return '<div style="background:var(--surface-2);border:1.5px solid var(--border);border-radius:10px;padding:.625rem .75rem;text-align:center">' +
          '<div style="font-size:1.375rem;font-weight:800;color:' + (s.color || 'var(--navy)') + ';line-height:1">' + s.val + '</div>' +
          '<div style="font-size:.6rem;color:var(--muted);text-transform:uppercase;letter-spacing:.05em;margin-top:.25rem;line-height:1.3">' + s.label + '</div>' +
          (s.note ? '<div style="font-size:.6rem;color:var(--muted);margin-top:.15rem">' + s.note + '</div>' : '') +
          '</div>';
      }).join('') + '</div>';
  }

  function stacked(tiers) {
    var total = tiers.reduce(function(s,t){return s+t.pct;}, 0);
    if (!total) return '';
    return '<div style="height:14px;border-radius:6px;overflow:hidden;display:flex;margin-bottom:.375rem">' +
      tiers.filter(function(t){return t.pct>0;}).map(function(t){
        return '<div style="flex:' + t.pct + ';background:' + t.color + '" title="' + t.label + ': ' + t.pct + '%"></div>';
      }).join('') +
      '</div>' +
      '<div style="display:flex;flex-wrap:wrap;gap:.5rem">' +
      tiers.map(function(t) {
        return '<div style="display:flex;align-items:center;gap:.3rem;font-size:.7rem">' +
          '<div style="width:8px;height:8px;border-radius:2px;background:' + t.color + '"></div>' +
          '<span style="color:var(--muted)">' + t.label + '</span>' +
          '<strong style="color:' + t.color + '">' + t.pct + '%</strong></div>';
      }).join('') + '</div>';
  }

  // ═══════════════════════════════════════════════════════════════════════
  // BLOCK 1: MOY — Winter Diagnostic (Live · SY 2025-2026)
  // ═══════════════════════════════════════════════════════════════════════
  var moyData = (typeof irlab.getMOYData === 'function') ? irlab.getMOYData() : null;
  var hasMOY  = moyData && moyData.loaded && (moyData.math.length > 0 || moyData.ela.length > 0);

  html += '<div class="pds-card" style="margin-bottom:1rem">';
  html += secHead('❄️', 'Mid-Year (MOY) · Winter Diagnostics · SY 2025–2026', 'Live', '#0891b2');

  if (!hasMOY) {
    html += '<div style="padding:.75rem;text-align:center;font-size:.8125rem;color:var(--muted);border:1.5px dashed var(--border-2);border-radius:8px">' +
      '<div style="font-size:1.25rem;margin-bottom:.35rem">❄️</div>' +
      'MOY data not yet loaded. Open the <strong>i-Ready Analysis Lab → MOY tab</strong> and click Refresh to load live Winter 2025-2026 diagnostics.' +
      '</div>';
  } else {
    // Compute for both subjects
    var moyMath = (typeof irlab.computeMOY === 'function') ? irlab.computeMOY(moyData.math) : null;
    var moyELA  = (typeof irlab.computeMOY === 'function') ? irlab.computeMOY(moyData.ela)  : null;
    var netM = moyMath ? moyMath.network : null;
    var netE = moyELA  ? moyELA.network  : null;

    // Render each subject block
    [[netM, 'Math', '#0050c8', moyData.math.length], [netE, 'ELA', '#7c3aed', moyData.ela.length]].forEach(function(row) {
      var net = row[0], subj = row[1], color = row[2], rawN = row[3];
      if (!net || rawN === 0) return;

      html += '<div style="margin-bottom:1rem;padding:.875rem;background:var(--surface-2);border-radius:10px;border-left:4px solid ' + color + '">';
      html += '<div style="font-size:.6875rem;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:' + color + ';margin-bottom:.625rem">' + subj + '</div>';
      html += kpiRow([
        { val: net.total,      label: 'Total Scholars', note: net.winterOnly > 0 ? net.winterOnly + ' winter-only' : null },
        { val: net.withGrowth, label: 'With Growth Data',
          note: net.total !== net.withGrowth ? (net.total - net.withGrowth) + ' no Fall baseline' : null,
          color: 'var(--navy)' },
        { val: net.medianPctTypical !== null ? net.medianPctTypical + '%' : '—',
          label: 'Median % Typical', color: medColor(net.medianPctTypical) },
        { val: net.medianMonthsGrowth !== null ? net.medianMonthsGrowth + ' mo' + (net.avgMonthsGrowth !== null && net.avgMonthsGrowth !== net.medianMonthsGrowth ? ' <span style="font-size:.65rem;color:var(--muted)">(avg ' + net.avgMonthsGrowth + ')</span>' : '') : '—',
          label: 'Median Months of Learning',
          color: net.medianMonthsGrowth !== null ? (net.medianMonthsGrowth >= 4.5 ? '#059669' : net.medianMonthsGrowth >= 3.0 ? '#d97706' : '#dc2626') : 'var(--muted)' },
        { val: net.pctMetTypical !== null ? net.pctMetTypical + '%' : '—',
          label: '% Met Typical', color: medColor(net.pctMetTypical) },
        { val: net.medianGain !== null ? (net.medianGain > 0 ? '+' : '') + net.medianGain : '—',
          label: 'Median Scale Gain', color: 'var(--blue-mid)' },
      ]);

      if (net.withGrowth > 0) {
        // ── Placement distribution: Fall (BOY) + Winter (MOY) bars ────────
        var PL_TIERS = [
          { label: '3+ GL Below',  full: '3 or More Grade Levels Below', color: '#dc2626' },
          { label: '2 GL Below',   full: '2 Grade Levels Below',          color: '#f97316' },
          { label: '1 GL Below',   full: '1 Grade Level Below',           color: '#eab308' },
          { label: 'Early On GL',  full: 'Early On Grade Level',          color: '#0d9488' },
          { label: 'Mid/Above GL', full: 'Mid or Above Grade Level',      color: '#0d6e3a' },
        ];
        var PL_ORDER = ['3 or More Grade Levels Below','2 Grade Levels Below','1 Grade Level Below','Early On Grade Level','Mid or Above Grade Level'];
        function mkPlBar(dist, label) {
          if (!dist) return '';
          var total = PL_ORDER.reduce(function(s,p){ return s+(dist[p]||0); }, 0);
          if (!total) return '';
          var tiers = PL_TIERS.map(function(t){ var c=dist[t.full]||0; return Object.assign({},t,{count:c,pct:Math.round(c/total*100)}); });
          return '<div style="margin-bottom:.75rem">' +
            '<div style="font-size:.625rem;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--muted);margin-bottom:.25rem">' + label + ' · ' + total + ' scholars</div>' +
            '<div style="height:16px;border-radius:5px;overflow:hidden;display:flex;margin-bottom:.3rem">' +
            tiers.filter(function(t){return t.count>0;}).map(function(t){
              return '<div style="flex:' + t.count + ';background:' + t.color + '" title="' + t.full + ': ' + t.pct + '% (' + t.count + ')"></div>';
            }).join('') + '</div>' +
            '<div style="display:flex;flex-wrap:wrap;gap:.4rem">' +
            tiers.filter(function(t){return t.count>0;}).map(function(t){
              return '<div style="display:flex;align-items:center;gap:.25rem;font-size:.65rem">' +
                '<div style="width:7px;height:7px;border-radius:2px;background:' + t.color + ';flex-shrink:0"></div>' +
                '<span style="color:var(--muted)">' + t.label + '</span>' +
                '<strong style="color:' + t.color + '">' + t.pct + '%</strong>' +
                '<span style="color:var(--muted);font-size:.6rem">(' + t.count + ')</span></div>';
            }).join('') + '</div></div>';
        }
        html += mkPlBar(net.fallPlacementDist, 'Fall (BOY)');
        html += mkPlBar(net.placementDist, 'Winter (MOY)');

        // ── Band-to-band movement summary ──────────────────────────────────
        var moves = net.movementBreakdown || [];
        function mvGroup(dir, icon, col) {
          var rows = moves.filter(function(m){return m.dir===dir;});
          var tot  = rows.reduce(function(s,m){return s+m.count;},0);
          if (!tot) return '';
          var detail = rows.map(function(m){
            return '<div style="display:flex;justify-content:space-between;padding:.15rem 0;border-bottom:1px solid rgba(0,0,0,.05)">' +
              '<span style="color:var(--muted);font-size:.65rem">' + (m.from.replace('3 or More Grade Levels','3+ GL').replace('Grade Level','GL').replace('Grade Levels','GL').replace(' Below','↓').replace('Early On Grade Level','Early On GL').replace('Mid or Above Grade Level','Mid/Above GL')) +
              ' ' + icon + ' ' +
              (m.to.replace('3 or More Grade Levels','3+ GL').replace('Grade Level','GL').replace('Grade Levels','GL').replace(' Below','↓').replace('Early On Grade Level','Early On GL').replace('Mid or Above Grade Level','Mid/Above GL')) + '</span>' +
              '<strong style="color:' + col + ';font-size:.7rem">' + m.count + '</strong></div>';
          }).join('');
          return '<div style="border:1px solid ' + col + '33;border-radius:6px;padding:.5rem .625rem;flex:1;min-width:140px">' +
            '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.3rem">' +
            '<span style="font-weight:800;font-size:1rem;color:' + col + '">' + icon + ' ' + tot + '</span>' +
            '<span style="font-size:.55rem;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:' + col + '">' + (dir==='up'?'Moved Up':dir==='held'?'Held Band':'Moved Down') + '</span></div>' +
            detail + '</div>';
        }
        html += '<div style="display:flex;gap:.5rem;flex-wrap:wrap;margin-top:.375rem;margin-bottom:.625rem">' +
          mvGroup('up','↑','#16a34a') + mvGroup('held','→','#0050c8') + mvGroup('down','↓','#dc2626') +
          '</div>';
        html += '<div style="font-size:.625rem;color:var(--muted);margin-bottom:.5rem">Band movement (Fall → Winter). A positive scale score gain can still result in a band drop if growth was below the threshold — grade-level benchmarks rise through the year.</div>';
      }

      // Excluded scholars panel — no Fall baseline, cannot compute growth
      var missingCount = net.total - net.withGrowth;
      if (missingCount > 0 && typeof irlab.getMOYMissingScholars === 'function') {
        var missing = irlab.getMOYMissingScholars(subj);
        if (missing.length > 0) {
          html += '<details style="margin-top:.625rem;font-size:.75rem">';
          html += '<summary style="cursor:pointer;color:#b45309;font-weight:700;user-select:none">' +
            '⛔ ' + missing.length + ' scholar' + (missing.length !== 1 ? 's' : '') + ' excluded from growth calculations (no Fall baseline) — click to view</summary>';
          html += '<div style="margin-top:.5rem;max-height:160px;overflow-y:auto;border:1px solid #fde68a;border-radius:6px;background:#fffbeb">';
          html += '<table style="width:100%;border-collapse:collapse;font-size:.7rem">';
          html += '<thead><tr style="background:#fef3c7"><th style="padding:.3rem .5rem;text-align:left">Scholar</th><th style="padding:.3rem .5rem;text-align:left">School</th><th style="padding:.3rem .5rem;text-align:left">Grade</th><th style="padding:.3rem .5rem;text-align:left">Reason</th></tr></thead><tbody>';
          missing.forEach(function(s, i) {
            html += '<tr style="background:' + (i % 2 === 0 ? '#fffbeb' : '#fefce8') + '">' +
              '<td style="padding:.3rem .5rem">' + s.name + '</td>' +
              '<td style="padding:.3rem .5rem">' + s.school + '</td>' +
              '<td style="padding:.3rem .5rem">' + s.grade + '</td>' +
              '<td style="padding:.3rem .5rem;color:#92400e">' + s.reason + '</td></tr>';
          });
          html += '</tbody></table></div></details>';
        }
      }

      // Rush-flagged scholars panel — included in calculations, shown for transparency
      if (net.rushFlags && net.rushFlags.red > 0 && typeof irlab.getMOYRushFlagged === 'function') {
        var flagged = irlab.getMOYRushFlagged(subj);
        if (flagged.length > 0) {
          html += '<details style="margin-top:.375rem;font-size:.75rem">';
          html += '<summary style="cursor:pointer;color:#1d4ed8;font-weight:700;user-select:none">' +
            'ℹ ' + flagged.length + ' scholar' + (flagged.length !== 1 ? 's' : '') + ' with Red Rush Flag (included in calculations) — click to review</summary>';
          html += '<div style="margin-top:.5rem;max-height:160px;overflow-y:auto;border:1px solid #bfdbfe;border-radius:6px;background:#eff6ff">';
          html += '<div style="font-size:.7rem;padding:.4rem .625rem;color:#1e40af;border-bottom:1px solid #bfdbfe">These scholars are counted in all growth metrics. Red Rush means iReady detected unusually fast test completion. Review with school staff and contact iReady if re-administration is needed.</div>';
          html += '<table style="width:100%;border-collapse:collapse;font-size:.7rem">';
          html += '<thead><tr style="background:#dbeafe"><th style="padding:.3rem .5rem;text-align:left">Scholar</th><th style="padding:.3rem .5rem;text-align:left">School</th><th style="padding:.3rem .5rem;text-align:left">Grade</th><th style="padding:.3rem .5rem;text-align:center">% Typical</th></tr></thead><tbody>';
          flagged.forEach(function(s, i) {
            html += '<tr style="background:' + (i % 2 === 0 ? '#eff6ff' : '#dbeafe') + '">' +
              '<td style="padding:.3rem .5rem">' + s.name + '</td>' +
              '<td style="padding:.3rem .5rem">' + s.school + '</td>' +
              '<td style="padding:.3rem .5rem">' + s.grade + '</td>' +
              '<td style="padding:.3rem .5rem;text-align:center">' + s.pctTypical + '</td></tr>';
          });
          html += '</tbody></table></div></details>';
        }
      }

      html += '</div>';
    });

    // Pearl operational alignment for MOY
    var poData = null;
    try { if (window.po && typeof window.po.getProgramSummaryData === 'function') poData = window.po.getProgramSummaryData(); } catch(e){}
    if (poData && poData.loaded && poData.currentWeek) {
      var cw = poData.currentWeek;
      var schAtt = cw.scholarAtt ? cw.scholarAtt.rate : null;
      html += '<div style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:8px;padding:.75rem 1rem;margin-top:.5rem">';
      html += '<div style="font-size:.6875rem;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:#0891b2;margin-bottom:.5rem">Pearl Alignment · Current Week</div>';
      html += '<div style="display:flex;gap:1rem;flex-wrap:wrap;font-size:.8rem">';
      if (schAtt !== null) html += '<div><span style="color:var(--muted)">Scholar Att: </span><strong style="color:' + (schAtt>=90?'#059669':schAtt>=80?'#d97706':'#dc2626') + '">' + schAtt + '%</strong></div>';
      if (cw.siTotal !== undefined) html += '<div><span style="color:var(--muted)">SIs This Week: </span><strong style="color:' + (cw.siTotal>3?'#d97706':'var(--navy)') + '">' + cw.siTotal + '</strong></div>';
      if (cw.scholarSurvey) html += '<div><span style="color:var(--muted)">Scholar Survey: </span><strong style="color:#7c3aed">' + cw.scholarSurvey + '/5</strong></div>';
      html += '</div>';
      // Plain-language insight connecting attendance to academic growth
      if (schAtt !== null) {
        var connMsg = schAtt >= 90
          ? 'Attendance is strong this week. Scholars who attend consistently are on the best path to hitting MOY growth targets.'
          : schAtt >= 80
          ? 'Attendance is in range but every missed session affects growth trajectory. A scholar missing 2+ sessions/month sees noticeably slower scale score gains.'
          : 'Attendance is below 80% this week — this is the #1 risk factor for low MOY growth. Reach out to Program Managers today.';
        html += '<div style="font-size:.75rem;color:#0c4a6e;margin-top:.5rem;line-height:1.5">' + connMsg + '</div>';
      }
      html += '</div>';
    }

    html += '<div style="font-size:.7rem;color:var(--muted);margin-top:.625rem">Source: Live Google Sheets · iReady Winter 2025–2026 Diagnostics · ' +
      (moyData.math.length + moyData.ela.length) + ' total rows loaded</div>';
  }
  html += '</div>';

  // ═══════════════════════════════════════════════════════════════════════
  // BLOCK 2: EOY — Longitudinal (Uploaded · SY 2025-2026)
  // ═══════════════════════════════════════════════════════════════════════
  html += '<div class="pds-card" style="margin-bottom:1rem">';
  html += secHead('🎓', 'End-of-Year (EOY) · Longitudinal Data · SY 2025–2026', null, null);

  var eoyM = (typeof irlab.getInsightMetrics === 'function')
    ? irlab.getInsightMetrics({ year: '2025-2026' }) : null;
  var hasEOY = eoyM && eoyM.hasData && eoyM.n > 0;

  if (!hasEOY) {
    var allM = (typeof irlab.getInsightMetrics === 'function') ? irlab.getInsightMetrics({}) : null;
    var hasAny = allM && allM.hasData;
    html += '<div style="padding:.75rem;font-size:.8125rem;color:var(--muted);border:1.5px dashed var(--border-2);border-radius:8px;text-align:center">' +
      '<div style="font-size:1.25rem;margin-bottom:.35rem">🎓</div>';
    if (!hasAny) {
      html += 'EOY longitudinal data not uploaded. Go to the <strong>i-Ready Analysis Lab</strong> and upload the SY 2025–2026 diagnostic CSV to see end-of-year results.';
    } else {
      var yrList = (allM.allYears || []).join(', ');
      html += 'SY 2025–2026 EOY data not yet uploaded. Data currently loaded covers: <strong>' + (yrList || 'unknown years') + '</strong>.<br>When SY 2025–2026 spring diagnostics are complete, upload the CSV in the i-Ready Lab.';
    }
    html += '</div>';
  } else {
    var tone2 = eoyM.medianPctExpected >= 100 ? 'green' : eoyM.medianPctExpected >= 75 ? 'amber' : 'red';
    var pctColor2 = tone2 === 'green' ? '#059669' : tone2 === 'amber' ? '#d97706' : '#dc2626';
    html += kpiRow([
      { val: eoyM.n,           label: 'Scholars w/ Gain Data' },
      { val: eoyM.medianScaleGain !== null ? (eoyM.medianScaleGain > 0 ? '+' : '') + eoyM.medianScaleGain + ' pts' : '—',
        label: 'Median Scale Gain', color: gainColor(eoyM.medianScaleGain) },
      { val: eoyM.medianMonthsGrowth !== null ? eoyM.medianMonthsGrowth + ' mo' : '—',
        label: 'Months of Learning',
        color: eoyM.medianMonthsGrowth !== null ? (eoyM.medianMonthsGrowth >= 8 ? '#059669' : eoyM.medianMonthsGrowth >= 5 ? '#d97706' : '#dc2626') : 'var(--muted)' },
      { val: eoyM.medianPctExpected !== null ? Math.round(eoyM.medianPctExpected) + '%' : '—',
        label: 'Median % Typical Growth', color: pctColor2 },
      { val: eoyM.windowAdjustedPct !== null ? Math.round(eoyM.windowAdjustedPct) + '%' : '—',
        label: 'Window-Adjusted %', color: pctColor2 },
      { val: eoyM.medianSpringWeeks !== null ? eoyM.medianSpringWeeks + ' wks' : '—',
        label: 'Avg Program Window' },
    ]);

    var eoyMsg = eoyM.medianPctExpected >= 100
      ? 'Scholars met or exceeded expected full-year growth — a strong end-of-year result.'
      : eoyM.medianPctExpected >= 75
      ? 'Scholars made meaningful progress toward full-year targets. Continued intensity through spring is key.'
      : 'End-of-year growth is below the typical benchmark. Review session quality, attendance trends, and tutor support.';
    html += '<div style="font-size:.8125rem;color:var(--text-2);line-height:1.6;margin-bottom:.625rem">' + eoyMsg + '</div>';

    // Top school performers
    if (eoyM.bySchool && eoyM.bySchool.length) {
      var topSchools = eoyM.bySchool.filter(function(s){return s.n>=3;}).sort(function(a,b){return (b.medPct||0)-(a.medPct||0);}).slice(0,5);
      if (topSchools.length) {
        html += '<div style="font-size:.6875rem;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:var(--muted);margin-bottom:.375rem">Top Schools · % Typical Growth</div>';
        topSchools.forEach(function(s) {
          var pctV = s.medPct !== null ? Math.round(s.medPct) : null;
          html += '<div style="display:flex;align-items:center;gap:.5rem;padding:.3rem 0;border-bottom:1px solid var(--border-2);font-size:.8rem">' +
            '<div style="flex:1;color:var(--navy);font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + s.label + '</div>' +
            '<div style="font-size:.75rem;color:var(--muted)">' + s.n + ' scholars</div>' +
            '<div style="font-weight:700;color:' + (pctV!==null?medColor(pctV):'var(--muted)') + ';min-width:42px;text-align:right">' + (pctV!==null?pctV+'%':'—') + '</div>' +
            '</div>';
        });
      }
    }

    if (eoyM.syAligned) {
      html += '<div style="font-size:.7rem;color:#059669;margin-top:.5rem">✅ SY 2025–2026 aligned with Pearl operational records</div>';
    }
    html += '<div style="font-size:.7rem;color:var(--muted);margin-top:.25rem">Source: Uploaded iReady Longitudinal CSV · SY 2025–2026 filter active · ' + eoyM.n + ' records with gain data</div>';
  }
  html += '</div>';

  // ═══════════════════════════════════════════════════════════════════════
  // BLOCK 3: What to do with this data
  // ═══════════════════════════════════════════════════════════════════════
  html += '<div class="pds-action-box"><div class="pds-action-label">🎯 How to Use This Data</div>' +
    '<strong>MOY (Winter Diagnostics)</strong> — live data, available right now. Use it to identify scholars who are falling behind and adjust tutor focus before spring. ' +
    'A scholar at 50% of typical growth by MOY has roughly <strong>5 months left</strong> to close the gap before EOY testing.<br><br>' +
    '<strong>EOY (Longitudinal Data)</strong> — uploaded after spring diagnostics are complete. This is your full-year impact story — share it with school partners and funders.<br><br>' +
    '<strong>The #1 lever you have right now:</strong> attendance. Scholars who attend 90%+ of sessions consistently achieve <strong>2–3x the scale score gains</strong> of low-attenders. ' +
    'Every conversation about a missed session is an academic intervention.</div>';

  return html;
}

// ── TAB: Discrepancies ─────────────────────────────────────────────────────
function renderDiscrepancies(d) {
  var disc = d.discrepancies || [];
  var html = '';

  html += buildBanner('🔍', 'Pearl Data Health Check',
    'These are issues found in your Pearl data that need to be cleaned up. They don\'t fix themselves — someone needs to log in and correct them. Think of this as your data hygiene checklist.',
    disc.length === 0 ? 'green' : 'amber');

  if (!disc.length) {
    html += '<div class="pds-alert-row ok">✅ <strong>No discrepancies found.</strong> Your Pearl data looks clean.</div>';
    return html;
  }

  disc.forEach(function(group) {
    html += '<div class="pds-flag">';
    html += '<div class="pds-flag-title">⚠️ ' + group.label + ' (' + group.total + ')</div>';
    var desc = '';
    if (group.type === 'archived_conflict') desc = 'These scholars are marked as Archived in Pearl but still appear in active session records. This creates incorrect attendance calculations. Remove them from active sessions or un-archive if still enrolled.';
    else if (group.type === 'missing_subject') desc = 'These delivered sessions have no Subject recorded. Your academic reports need this to be accurate. Have tutors go back and update their session records.';
    else if (group.type === 'consecutive_absent') desc = 'These scholars have an Attendance Concern flag in Pearl — meaning they missed several consecutive sessions. Reach out to the site lead to check if they\'re still enrolled or need re-engagement.';
    html += '<div class="pds-flag-body">' + desc + '</div>';

    if (group.items && group.items.length) {
      html += '<div style="margin-top:.625rem;display:flex;flex-direction:column;gap:.25rem">';
      group.items.slice(0, 8).forEach(function(it) {
        html += '<div style="font-size:.775rem;padding:.3rem .5rem;background:rgba(255,255,255,.6);border-radius:6px;display:flex;gap:.5rem;flex-wrap:wrap">' +
          '<strong>' + (it.name || it.title || 'Unknown') + '</strong>' +
          '<span style="color:var(--muted)">' + (it.school || '') + (it.district ? ' · ' + it.district : '') + '</span></div>';
      });
      if (group.total > 8) html += '<div style="font-size:.75rem;color:var(--muted);margin-top:.25rem">+ ' + (group.total - 8) + ' more…</div>';
      html += '</div>';
    }
    html += '</div>';
  });
  return html;
}

// ── State ──────────────────────────────────────────────────────────────────
var _activeTab = 'week';
var _lastRendered = 0;
var TABS = [
  { id: 'week',   label: '📋 This Week' },
  { id: 'trends', label: '📈 Trends' },
  { id: 'regional', label: '🗺 Regional' },
  { id: 'academic', label: '📚 Academic' },
  { id: 'discrepancies', label: '🔍 Data Health' },
];

// ── Open / Close ───────────────────────────────────────────────────────────
function open() {
  var ov = document.getElementById('pdsOverlay');
  var sh = document.getElementById('pdsSheet');
  if (!ov || !sh) { buildDOM(); ov = document.getElementById('pdsOverlay'); sh = document.getElementById('pdsSheet'); }
  ov.classList.add('open');
  sh.classList.add('open');
  renderActiveTab();
}

function close() {
  var ov = document.getElementById('pdsOverlay');
  var sh = document.getElementById('pdsSheet');
  if (ov) ov.classList.remove('open');
  if (sh) sh.classList.remove('open');
}

function switchTab(tabId) {
  _activeTab = tabId;
  // Update tab buttons
  TABS.forEach(function(t) {
    var btn = document.getElementById('pdsTab-' + t.id);
    if (btn) btn.className = 'pds-tab' + (t.id === tabId ? ' active' : '');
  });
  renderActiveTab();
}

function renderActiveTab() {
  var body = document.getElementById('pdsBody');
  if (!body) return;

  // Check data
  var poReady = window.po && typeof window.po.getProgramSummaryData === 'function' && window.po.isDataLoaded && window.po.isDataLoaded();
  if (!poReady) {
    body.innerHTML = '<div class="pds-loading">⏳ Pearl data is loading… Open the Pearl Operations panel first to load data, then come back here.</div>';
    return;
  }

  var d;
  try { d = window.po.getProgramSummaryData(); } catch(e) { d = { loaded: false }; }

  if (!d.loaded) {
    body.innerHTML = '<div class="pds-loading">⏳ Loading program data… this usually takes under 10 seconds.</div>';
    return;
  }

  var html = '';
  if      (_activeTab === 'week')          html = renderThisWeek(d);
  else if (_activeTab === 'trends')        html = renderTrends(d);
  else if (_activeTab === 'regional')      html = renderRegional(d);
  else if (_activeTab === 'academic')      html = renderAcademic();
  else if (_activeTab === 'discrepancies') html = renderDiscrepancies(d);

  body.innerHTML = html;
  body.scrollTop = 0;
  _lastRendered = Date.now();

  // Update sync time
  var syncTxt = document.getElementById('pdsSyncTxt');
  if (syncTxt) syncTxt.textContent = 'Data as of ' + new Date().toLocaleTimeString();
}

// ── Build DOM (called once) ────────────────────────────────────────────────
function buildDOM() {
  if (document.getElementById('pdsOverlay')) return;

  // Overlay
  var ov = document.createElement('div');
  ov.id = 'pdsOverlay';
  ov.onclick = function(e) { if (e.target === ov) close(); };
  document.body.appendChild(ov);

  // Sheet
  var sh = document.createElement('div');
  sh.id = 'pdsSheet';
  sh.innerHTML =
    '<div class="pds-header">' +
      '<div class="pds-header-left">' +
        '<div class="pds-eyebrow">Program Intelligence · SY 2025–2026</div>' +
        '<div class="pds-title">Program Pulse</div>' +
        '<div class="pds-subtitle">Your week at a glance — attendance, surveys, interruptions, and what needs your attention.</div>' +
      '</div>' +
      '<button class="pds-close-btn" onclick="window.pds.close()" title="Close">✕</button>' +
    '</div>' +
    '<div class="pds-sync-bar"><span class="sync-dot" style="width:8px;height:8px;border-radius:50%;background:#4ade80;display:inline-block;flex-shrink:0"></span>' +
      '<span id="pdsSyncTxt">Live Pearl data</span>' +
      '<button onclick="window.pds.refresh()" style="margin-left:auto;background:none;border:1px solid var(--border);border-radius:6px;padding:.25rem .625rem;font-size:.75rem;cursor:pointer;font-family:inherit;color:var(--muted)">↺ Refresh</button>' +
    '</div>' +
    '<div class="pds-tab-bar">' +
      TABS.map(function(t) {
        return '<button id="pdsTab-' + t.id + '" class="pds-tab' + (t.id === _activeTab ? ' active' : '') + '" onclick="window.pds.switchTab(\'' + t.id + '\')">' + t.label + '</button>';
      }).join('') +
    '</div>' +
    '<div class="pds-body" id="pdsBody"><div class="pds-loading">Loading…</div></div>';
  document.body.appendChild(sh);

  // Trigger button
  var btn = document.createElement('button');
  btn.id = 'pdsPulseBtn';
  btn.innerHTML = '<span class="pds-btn-dot"></span> Program Pulse';
  btn.onclick = function() { open(); };
  document.body.appendChild(btn);
}

// ── Refresh ────────────────────────────────────────────────────────────────
function refresh() {
  _lastRendered = 0;
  renderActiveTab();
}

// ── Show/hide button based on dept ─────────────────────────────────────────
function updateVisibility(dept) {
  var allowed = ['programming', 'data', 'leadership', 'kb'];
  var btn = document.getElementById('pdsPulseBtn');
  if (!btn) { buildDOM(); btn = document.getElementById('pdsPulseBtn'); }
  if (btn) btn.className = allowed.includes(dept) ? 'visible' : '';
}

// ── Init ───────────────────────────────────────────────────────────────────
buildDOM();

// ── Public API ─────────────────────────────────────────────────────────────
window.pds = { open: open, close: close, switchTab: switchTab, refresh: refresh, updateVisibility: updateVisibility };

})(); // end IIFE
