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
      return '<div class="pds-stat">' +
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
    { val: cw.scholarSurvey !== null ? cw.scholarSurvey + '/5' : '—', label: 'Scholar Survey',  color: cw.scholarSurvey && cw.scholarSurvey < 3.5 ? '#dc2626' : '#7c3aed' },
    { val: cw.tutorSurvey   !== null ? cw.tutorSurvey   + '/5' : '—', label: 'Tutor Survey',    color: cw.tutorSurvey   && cw.tutorSurvey   < 3.5 ? '#dc2626' : '#7c3aed' },
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
