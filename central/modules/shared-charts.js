(function() {

  //  KPI ANALYTICS DASHBOARD
  // ════════════════════════════════════════════════════════════════

  let _kpiAnalyticsTab = 'overview';

  // ════════════════════════════════════════════════════════════════
  //  SCORING ENGINE  (live — reads directly from KPI_DATA each call)
  //  Met=1.0 | Partial=0.5 | In Progress=0.25 | Pipeline=0.10 | Not Met=0
  //  Risk: ≥85% Healthy · 65–84% Watch · 40–64% At Risk · <40% Critical
  // ════════════════════════════════════════════════════════════════

  const KPI_PT = { 'Met':1, 'Partially Met':.5, 'In Progress':.25, 'Coming Down the Pipeline':.1, 'Has Not Met':0 };

  function kpiPts(s){ return KPI_PT[s] ?? 0; }

  function riskBucket(pct){
    if(pct >= 85) return { label:'Healthy',  short:'Healthy',  color:'#166534', bg:'#dcfce7', icon:'🟢', tip:'On track — keep going!' };
    if(pct >= 65) return { label:'Watch',    short:'Watch',    color:'#92400e', bg:'#fef3c7', icon:'🟡', tip:'Making progress but monitor closely.' };
    if(pct >= 40) return { label:'Needs Focus',  short:'Needs Focus',  color:'#9a3412', bg:'#ffedd5', icon:'🟠', tip:'Area of focus — additional support recommended.' };
    return               { label:'Area of Support', short:'Area of Support', color:'#991b1b', bg:'#fee2e2', icon:'🔴', tip:'Warrants closer investigation and team discussion.' };
  }

  // Build full analytics object fresh from live KPI_DATA.
  // Auto-detects end-of-year data the same way the Quarterly engine detects
  // active quarters: once ANY row has a populated endStatus, the whole
  // dashboard switches to end-of-year scoring (falling back to midStatus
  // per-row only where that row's endStatus is still blank).
  function calcKPI(){
    const data = KPI_DATA || [];
    const hasEOY = data.some(k => k.endStatus && k.endStatus.trim());
    const getS = k => (hasEOY ? (k.endStatus || k.midStatus) : (k.midStatus || k.status)) || 'Unknown';
    let totalPts=0, maxPts=0;
    const counts = { Met:0,'Partially Met':0,'In Progress':0,'Coming Down the Pipeline':0,'Has Not Met':0 };
    const goals = {};

    data.forEach(k => {
      const s = getS(k);
      totalPts += kpiPts(s);
      maxPts++;
      if(counts[s] !== undefined) counts[s]++;
      const g = k.goal || 'Other';
      if(!goals[g]) goals[g] = {pts:0,max:0,counts:{Met:0,'Partially Met':0,'In Progress':0,'Coming Down the Pipeline':0,'Has Not Met':0},items:[]};
      goals[g].pts += kpiPts(s);
      goals[g].max++;
      if(goals[g].counts[s] !== undefined) goals[g].counts[s]++;
      goals[g].items.push(k);
    });

    const score = maxPts ? (totalPts/maxPts*100) : 0;
    const risk  = riskBucket(score);

    Object.entries(goals).forEach(([,g]) => {
      g.score = g.max ? (g.pts/g.max*100) : 0;
      g.risk  = riskBucket(g.score);
    });

    return { data, counts, totalPts, maxPts, score, risk, goals, total: data.length, hasEOY, cycle: hasEOY ? 'end' : 'mid' };
  }

  function buildKPIAnalytics(){
    const el = document.getElementById('kpiAnalyticsContent');
    if(!el) return;
    populateKPIMetricDropdown();
    el.innerHTML = renderKPIAnalytics();
  }

  // Exposed so other modules (e.g. growth-tree.js) can read the exact same
  // live-scored, goal-level health numbers the KPI Analytics tab itself uses —
  // one scoring engine, no duplicated logic, no numbers that can drift apart.
  window.calcKPI    = calcKPI;
  window.riskBucket = riskBucket;
  window.kpiPts     = kpiPts;

  // ════════════════════════════════════════════════════════════════
  //  YEAR-OVER-YEAR SNAPSHOT  (SY24-25 vs. SY25-26 EOY)
  //  SY24-25 is a frozen static dataset (KPI_DATA_24_25) that only ever
  //  recorded one status per target — it never used health buckets or a
  //  weighted %. Scored here with the exact same KPI_PT / riskBucket
  //  methodology as this year, so the two years are truly comparable.
  //  Surfaced only in downloadable/live presentations, and only once
  //  this year's EOY data is present (calcKPI().hasEOY).
  // ════════════════════════════════════════════════════════════════
  function calcPriorYearKPI(){
    const data = window.KPI_DATA_24_25 || [];
    const getS = k => k.status || 'Unknown';
    let totalPts=0, maxPts=0;
    const counts = { Met:0,'Partially Met':0,'In Progress':0,'Coming Down the Pipeline':0,'Has Not Met':0 };
    data.forEach(k => {
      const s = getS(k);
      totalPts += kpiPts(s);
      maxPts++;
      if(counts[s] !== undefined) counts[s]++;
    });
    const score = maxPts ? (totalPts/maxPts*100) : 0;
    const risk  = riskBucket(score);
    return { data, counts, totalPts, maxPts, score, risk, total: data.length };
  }

  // Returns null when either side of the comparison isn't ready yet —
  // callers use that to hide the YoY section entirely.
  function _buildYoYSnapshot(){
    const py = calcPriorYearKPI();
    const cy = calcKPI();
    if (!py.total || !cy.hasEOY) return null;
    const delta = cy.score - py.score;
    return {
      priorYear:   { label:'SY 2024–2025', score: py.score, risk: py.risk, counts: py.counts, total: py.total },
      currentYear: { label:'SY 2025–2026', score: cy.score, risk: cy.risk, counts: cy.counts, total: cy.total },
      delta,
      deltaLabel: (delta>=0?'+':'') + delta.toFixed(1) + ' pts',
      improved: delta >= 0,
      bucketChanged: py.risk.label !== cy.risk.label,
      note: 'SY24–25 tracked a single end-of-year status per target and did not use health buckets or a weighted score. To make this an apples-to-apples comparison, both years above are scored with this year’s methodology: Met = 1.0 pt, Partially Met = 0.5, In Progress = 0.25, Coming Down the Pipeline = 0.10, Has Not Met = 0 — points earned divided by targets tracked.'
    };
  }
  window.calcPriorYearKPI  = calcPriorYearKPI;
  window._buildYoYSnapshot = _buildYoYSnapshot;

  function setKPIAnalyticsTab(tab){
    _kpiAnalyticsTab = tab;
    document.querySelectorAll('.kpia-tab').forEach(t=>t.classList.remove('active'));
    const btn = document.getElementById('kpiaTab-'+tab);
    if(btn) btn.classList.add('active');
    const con = document.getElementById('kpiaTabContent');
    if(con) con.innerHTML = renderKPIAnalyticsTab(tab);

  }

  // ── Friendly plain-English headline ─────────────────────────────
  function friendlyHeadline(risk, score){
    const s = score.toFixed(0);
    if(risk.label==='Healthy')  return `We're performing well overall — ${s}% of our goals are on track.`;
    if(risk.label==='Watch')    return `Solid progress at ${s}%, but a few goal areas need closer attention.`;
    if(risk.label==='Needs Focus')  return `We're at ${s}% — several areas would benefit from team attention before year-end.`;
    return `At ${s}%, we have significant gaps to close. Immediate focus is needed.`;
  }

  // ── Plain-English goal summary ───────────────────────────────────
  function friendlyGoalLine(g, name){
    const s = g.score.toFixed(0);
    const c = g.counts;
    const parts = [];
    if(c['Met'])    parts.push(`${c['Met']} completed`);
    if(c['In Progress']) parts.push(`${c['In Progress']} in progress`);
    if(c['Partially Met']) parts.push(`${c['Partially Met']} partially done`);
    if(c['Coming Down the Pipeline']) parts.push(`${c['Coming Down the Pipeline']} not yet started`);
    if(c['Has Not Met']) parts.push(`${c['Has Not Met']} not met`);
    return parts.join(' · ');
  }

  // ════════════════════════════════════════════════════════════════
  //  MAIN RENDER
  // ════════════════════════════════════════════════════════════════
  function renderKPIAnalytics(){
    const d = calcKPI();
    if(!d.total){
      return `<div style="padding:3rem;text-align:center;color:var(--muted)">
        <div style="font-size:2.5rem;margin-bottom:1rem">📊</div>
        <div style="font-weight:600;color:var(--navy);margin-bottom:.5rem">No KPI data loaded yet</div>
        <button class="btn btn-secondary" onclick="fetchAndRebuildKPI(true).then(()=>buildKPIAnalytics())">↺ Refresh Data</button>
      </div>`;
    }

    const { counts, score, risk, goals, total, totalPts, maxPts, hasEOY } = d;

    // Quick counts for hero
    const criticalGoals = Object.entries(goals).filter(([,g])=>g.risk.label==='Critical');
    const healthyGoals  = Object.entries(goals).filter(([,g])=>g.risk.label==='Healthy');

    let html = '';

    // ── Friendly Summary Banner ──────────────────────────────────
    html += `
    <div class="kpia-summary-banner" style="background:linear-gradient(135deg,${risk.bg},white);border:2px solid ${risk.color}22;border-radius:16px;padding:1.5rem 1.75rem;margin-bottom:1.5rem;display:flex;gap:1.5rem;align-items:flex-start;flex-wrap:wrap">
      <div style="font-size:2.75rem;line-height:1">${risk.icon}</div>
      <div style="flex:1;min-width:220px">
        <div style="font-size:1.125rem;font-weight:700;color:var(--navy);margin-bottom:.375rem;line-height:1.4">${friendlyHeadline(risk,score)}</div>
        <div style="font-size:.875rem;color:var(--text-2);line-height:1.5">
          Out of <strong>${total} targets</strong> this cycle:
          ${counts['Met']>0?`<strong style="color:#166534">${counts['Met']} fully completed</strong>`:''}${counts['Met']>0&&counts['In Progress']>0?' · ':''}${counts['In Progress']>0?`<strong style="color:var(--progress)">${counts['In Progress']} in progress</strong>`:''}${(counts['Met']+counts['In Progress']>0)&&(counts['Partially Met']+counts['Has Not Met'])>0?' · ':''}${counts['Partially Met']>0?`<strong style="color:#92400e">${counts['Partially Met']} partially done</strong>`:''}${counts['Has Not Met']>0?` · <strong style="color:#991b1b">${counts['Has Not Met']} not yet met</strong>`:''}${counts['Coming Down the Pipeline']>0?` · <strong style="color:var(--pipeline)">${counts['Coming Down the Pipeline']} upcoming</strong>`:''}
        </div>
        ${criticalGoals.length ? `<div style="margin-top:.625rem;font-size:.8125rem;background:#fff8e7;color:#92400e;padding:.375rem .75rem;border-radius:20px;display:inline-block;font-weight:600">
          🔍 ${criticalGoals.length} goal area${criticalGoals.length>1?'s warrant':'warrants'} further investigation: ${criticalGoals.map(([name])=>name).join(', ')}
        </div>` : `<div style="margin-top:.625rem;font-size:.8125rem;background:#dcfce7;color:#166534;padding:.375rem .75rem;border-radius:20px;display:inline-block;font-weight:600">✅ All goal areas are on track — great work!</div>`}
      </div>
      <div style="text-align:center;background:white;border-radius:12px;padding:1rem 1.25rem;border:1px solid ${risk.color}33;min-width:100px;flex-shrink:0">
        <div style="font-size:2.25rem;font-weight:800;color:${risk.color};font-family:'DM Serif Display',serif;line-height:1">${score.toFixed(0)}%</div>
        <div style="font-size:.6875rem;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:${risk.color};margin-top:.25rem">${risk.label}</div>
        <div style="font-size:.7rem;color:var(--muted);margin-top:.25rem">Weighted Score</div>
        <div style="font-size:.625rem;font-weight:700;color:${hasEOY?'#9a3412':'var(--muted)'};background:${hasEOY?'#ffedd5':'var(--surface-2)'};border-radius:10px;padding:.1rem .5rem;margin-top:.375rem;display:inline-block">${hasEOY?'📅 End of Year':'🔹 Mid-Year'}</div>
      </div>
    </div>`;

    // ── What does this score mean? (beginner callout) ─────────────
    html += `
    <details class="kpia-explainer" style="margin-bottom:1.25rem;border:1px solid var(--border);border-radius:10px;overflow:hidden">
      <summary style="padding:.875rem 1.125rem;cursor:pointer;font-size:.8125rem;font-weight:600;color:var(--navy);list-style:none;display:flex;justify-content:space-between;align-items:center;background:var(--surface-2)">
        <span>ℹ️ How is this score calculated?</span>
        <span style="color:var(--muted);font-weight:400;font-size:.75rem">Click to expand</span>
      </summary>
      <div style="padding:1rem 1.25rem;font-size:.8125rem;color:var(--text-2);line-height:1.6;background:white">
        <p style="margin:0 0 .625rem">Each target earns points based on its status. Points are added up and divided by the maximum possible to get a <strong>weighted score</strong> — a fair measure that accounts for targets still in progress.</p>
        <div style="display:flex;gap:.625rem;flex-wrap:wrap;margin-bottom:.625rem">
          ${[['✅ Completed (Met)','1.0 pt','#166534','#dcfce7'],['🟠 Partially Done','0.5 pts','#9a3412','#ffedd5'],['🔵 In Progress','0.25 pts','var(--progress)','#eff6ff'],['🟣 Coming Up','0.10 pts','var(--pipeline)','var(--pipe-bg)'],['🔴 Not Met','0 pts','#991b1b','#fee2e2']].map(([l,p,c,bg])=>
            `<span style="background:${bg};color:${c};padding:.3rem .6rem;border-radius:6px;font-weight:600;font-size:.75rem;white-space:nowrap">${l} = ${p}</span>`
          ).join('')}
        </div>
        <p style="margin:0">Health levels: <strong style="color:#166534">🟢 Strong ≥85%</strong> · <strong style="color:#92400e">🟡 Developing 65–84%</strong> · <strong style="color:#9a3412">🟠 Needs Focus 40–64%</strong> · <strong style="color:#991b1b">🔴 Area of Support &lt;40%</strong></p>
      </div>
    </details>`;

    // ── Tab nav ──────────────────────────────────────────────────
    const _hasQData = window.KPI_Q_DATA && window.KPI_Q_DATA.activeQs && window.KPI_Q_DATA.activeQs.length > 0;
    const _qBadge   = _hasQData ? ` <span style="background:#1e3a5f;color:#93c5fd;font-size:.6rem;font-weight:700;padding:.1rem .35rem;border-radius:8px;vertical-align:middle;margin-left:.25rem">LIVE</span>` : '';
    html += `<div class="kpia-tabs">
      <button class="kpia-tab active" id="kpiaTab-overview"   onclick="setKPIAnalyticsTab('overview')">🏠 At a Glance</button>
      <button class="kpia-tab"        id="kpiaTab-tree"       onclick="setKPIAnalyticsTab('tree')">🌳 Growth Tree</button>
      <button class="kpia-tab"        id="kpiaTab-breakdown"  onclick="setKPIAnalyticsTab('breakdown')">📊 By Goal Area</button>
      <button class="kpia-tab"        id="kpiaTab-atRisk"     onclick="setKPIAnalyticsTab('atRisk')">⚠️ Needs Attention</button>
      <button class="kpia-tab"        id="kpiaTab-pipeline"   onclick="setKPIAnalyticsTab('pipeline')">🟣 Coming Up</button>
      <button class="kpia-tab"        id="kpiaTab-scorecard"  onclick="setKPIAnalyticsTab('scorecard')">🏆 Full Scorecard</button>
      <button class="kpia-tab"        id="kpiaTab-quarterly"  onclick="setKPIAnalyticsTab('quarterly')">📅 Quarterly${_qBadge}</button>
    </div>`;

    html += `<div id="kpiaTabContent">${renderKPIAnalyticsTab('overview')}</div>`;

    html += `<div class="kpia-cta-banner">
      <div class="kpia-cta-icon">💬</div>
      <div class="kpia-cta-body">
        <div class="kpia-cta-title">Questions about a specific goal?</div>
        <div class="kpia-cta-sub">Submit a KPI inquiry to provide context, ask for clarification, or flag something leadership should know.</div>
      </div>
      <button class="kpia-cta-btn" onclick="openKPIInquiry()">✏️ Ask a Question</button>
    </div>`;

    return html;
  }

  // ════════════════════════════════════════════════════════════════
  //  TAB RENDERS
  // ════════════════════════════════════════════════════════════════
  function renderKPIAnalyticsTab(tab){
    const d = calcKPI();
    if(!d.total) return '';
    const { counts, score, risk, goals, total, totalPts, maxPts, hasEOY } = d;
    const getS = k => (hasEOY ? (k.endStatus || k.midStatus) : (k.midStatus || k.status)) || '';

    // ── GROWTH TREE — delegated to growth-tree.js ─────────────────
    if(tab === 'tree'){
      if (typeof window.renderGrowthTreeTab === 'function') return window.renderGrowthTreeTab();
      return `<div style="padding:3rem;text-align:center;color:var(--muted)">
        <div style="font-size:2.5rem;margin-bottom:1rem">🌳</div>
        <div style="font-weight:600;color:var(--navy);margin-bottom:.5rem">Growth Tree module not loaded</div>
        <div style="font-size:.8125rem">Make sure <code>modules/growth-tree.js</code> is included in index.html.</div>
      </div>`;
    }

    // ── AT A GLANCE ──────────────────────────────────────────────
    if(tab === 'overview'){
      // Goal area health grid — the meat of the overview
      const sortedGoals = Object.entries(goals).sort((a,b)=>b[1].score-a[1].score);

      let html = '';

      // 4 big stat tiles
      html += `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:.875rem;margin-bottom:1.5rem">
        ${[
          { icon:'✅', val: counts['Met'], label:'Completed', color:'#166534', bg:'#dcfce7', desc:'Fully achieved' },
          { icon:'🔵', val: counts['In Progress'], label:'In Progress', color:'var(--progress)', bg:'#eff6ff', desc:'Actively tracked' },
          { icon:'🟠', val: counts['Partially Met']+counts['Has Not Met'], label:'In Progress / Focus Area', color:'#9a3412', bg:'#ffedd5', desc:'Partial or needs further work' },
          { icon:'🟣', val: counts['Coming Down the Pipeline'], label:'Coming Up', color:'var(--pipeline)', bg:'var(--pipe-bg)', desc:'Planned ahead' },
        ].map(s=>`<div style="background:${s.bg};border-radius:12px;padding:1rem 1.125rem;border:1px solid ${s.color}22">
          <div style="font-size:1.625rem;margin-bottom:.25rem">${s.icon}</div>
          <div style="font-size:1.75rem;font-weight:800;color:${s.color};font-family:'DM Serif Display',serif;line-height:1">${s.val}</div>
          <div style="font-size:.8125rem;font-weight:700;color:var(--navy);margin-top:.25rem">${s.label}</div>
          <div style="font-size:.7rem;color:var(--muted);margin-top:.125rem">${s.desc}</div>
        </div>`).join('')}
      </div>`;

      // Overall progress bar — visual + plain English
      html += `<div class="kpia-card" style="margin-bottom:1.25rem">
        <div class="kpia-card-header" style="margin-bottom:.875rem">
          <div class="kpia-card-title">📈 Overall Progress — How Are We Doing?</div>
          <div class="kpia-card-meta">Live from Google Sheet · updates automatically when data changes</div>
        </div>
        <div style="display:flex;gap:2px;height:22px;border-radius:11px;overflow:hidden;margin-bottom:.75rem">
          ${counts['Met']               ?`<div style="flex:${counts['Met']};background:#22c55e" title="Completed: ${counts['Met']}"></div>`:''}
          ${counts['In Progress']       ?`<div style="flex:${counts['In Progress']};background:var(--progress)" title="In Progress: ${counts['In Progress']}"></div>`:''}
          ${counts['Partially Met']     ?`<div style="flex:${counts['Partially Met']};background:#f97316" title="Partially Done: ${counts['Partially Met']}"></div>`:''}
          ${counts['Coming Down the Pipeline']?`<div style="flex:${counts['Coming Down the Pipeline']};background:var(--pipeline)" title="Coming Up: ${counts['Coming Down the Pipeline']}"></div>`:''}
          ${counts['Has Not Met']       ?`<div style="flex:${counts['Has Not Met']};background:#ef4444" title="Not Met: ${counts['Has Not Met']}"></div>`:''}
        </div>
        <div style="display:flex;gap:1rem;flex-wrap:wrap;font-size:.75rem">
          ${[['#22c55e','✅ Completed',counts['Met']],['var(--progress)','🔵 In Progress',counts['In Progress']],['#f97316','🟠 Partially Done',counts['Partially Met']],['var(--pipeline)','🟣 Coming Up',counts['Coming Down the Pipeline']],['#ef4444','🔴 Not Met',counts['Has Not Met']]].filter(x=>x[2]>0).map(([c,l,v])=>`
            <span style="display:flex;align-items:center;gap:.3rem">
              <span style="width:10px;height:10px;border-radius:2px;background:${c};display:inline-block;flex-shrink:0"></span>
              <span style="color:var(--text-2)">${l}</span>
              <strong style="color:var(--navy)">${v}</strong>
              <span style="color:var(--muted)">(${Math.round(v/total*100)}%)</span>
            </span>`).join('')}
        </div>
      </div>`;

      // Goal area health — simplified cards
      html += `<div class="kpia-card">
        <div class="kpia-card-header" style="margin-bottom:1rem">
          <div class="kpia-card-title">🗂️ Goal Areas — Health at a Glance</div>
          <div class="kpia-card-meta">Sorted best to lowest · Click "By Goal Area" tab for full breakdown</div>
        </div>
        <div style="display:flex;flex-direction:column;gap:.625rem">
          ${sortedGoals.map(([name,g])=>{
            const pct = g.score.toFixed(0);
            return `<div style="display:flex;align-items:center;gap:.75rem;padding:.75rem 1rem;border-radius:10px;border:1px solid ${g.risk.color}22;background:${g.risk.bg}11">
              <span style="font-size:1.125rem;flex-shrink:0" title="${g.risk.tip}">${g.risk.icon}</span>
              <div style="flex:1;min-width:0">
                <div style="display:flex;align-items:baseline;justify-content:space-between;gap:.5rem;flex-wrap:wrap;margin-bottom:.3rem">
                  <span style="font-size:.8125rem;font-weight:700;color:var(--navy);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:280px" title="${name}">${name}</span>
                  <span style="font-size:.75rem;color:${g.risk.color};font-weight:700;flex-shrink:0">${pct}% · ${g.risk.label}</span>
                </div>
                <div style="height:6px;background:var(--border);border-radius:3px;overflow:hidden">
                  <div style="height:100%;width:${Math.min(g.score,100).toFixed(1)}%;background:${g.risk.color};border-radius:3px;transition:width .5s ease"></div>
                </div>
                <div style="font-size:.7rem;color:var(--muted);margin-top:.3rem">${friendlyGoalLine(g,name)}</div>
              </div>
              <span style="background:${g.risk.bg};color:${g.risk.color};font-size:.6875rem;font-weight:700;padding:.2rem .5rem;border-radius:20px;flex-shrink:0;white-space:nowrap">${g.risk.short}</span>
            </div>`;
          }).join('')}
        </div>
      </div>`;

      return html;

    // ── BY GOAL AREA ─────────────────────────────────────────────
    } else if(tab === 'breakdown'){
      const sorted = Object.entries(goals).sort((a,b)=>b[1].score-a[1].score);
      let html = `<div style="margin-bottom:1.25rem;padding:.875rem 1rem;background:#f0f9ff;border:1px solid #bae6fd;border-radius:10px;font-size:.8125rem;color:#0c4a6e;line-height:1.5">
        💡 <strong>How to read this:</strong> Each goal area has multiple targets. The <strong>score</strong> reflects how close we are to completing all of them — higher is better. Green = on track, yellow = watch closely, orange = needs action, red = urgent.
      </div>`;

      sorted.forEach(([name,g])=>{
        const pct = g.score.toFixed(1);
        const c = g.counts;
        const statusBars = [
          {s:'Met',n:c['Met'],color:'#22c55e',icon:'✅',label:'Completed'},
          {s:'In Progress',n:c['In Progress'],color:'var(--progress)',icon:'🔵',label:'In Progress'},
          {s:'Partially Met',n:c['Partially Met'],color:'#f97316',icon:'🟠',label:'Partially Done'},
          {s:'Coming Down the Pipeline',n:c['Coming Down the Pipeline'],color:'var(--pipeline)',icon:'🟣',label:'Coming Up'},
          {s:'Has Not Met',n:c['Has Not Met'],color:'#ef4444',icon:'🔴',label:'Not Met'},
        ].filter(x=>x.n>0);

        html += `<div class="kpia-card" style="margin-bottom:1rem;border-left:4px solid ${g.risk.color}">
          <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:1rem;flex-wrap:wrap;margin-bottom:.875rem">
            <div style="flex:1">
              <div style="display:flex;align-items:center;gap:.5rem;flex-wrap:wrap;margin-bottom:.25rem">
                <span style="font-size:1rem">${g.risk.icon}</span>
                <span style="font-size:.9375rem;font-weight:700;color:var(--navy)">${name}</span>
                <span style="background:${g.risk.bg};color:${g.risk.color};font-size:.6875rem;font-weight:700;padding:.2rem .5rem;border-radius:20px">${g.risk.label}</span>
              </div>
              <div style="font-size:.8125rem;color:var(--text-2)">${g.risk.tip} · ${g.max} targets total</div>
            </div>
            <div style="text-align:right;flex-shrink:0">
              <div style="font-family:'DM Serif Display',serif;font-size:1.75rem;font-weight:700;color:${g.risk.color};line-height:1">${pct}%</div>
              <div style="font-size:.7rem;color:var(--muted)">weighted score</div>
            </div>
          </div>

          <!-- Progress bar -->
          <div style="height:10px;background:var(--border);border-radius:5px;overflow:hidden;margin-bottom:.875rem">
            <div style="height:100%;width:${Math.min(g.score,100).toFixed(1)}%;background:${g.risk.color};border-radius:5px;transition:width .5s ease"></div>
          </div>

          <!-- What makes up this score -->
          <div style="font-size:.75rem;font-weight:600;color:var(--muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:.5rem">Target Breakdown</div>
          <div style="display:flex;flex-direction:column;gap:.375rem">
            ${statusBars.map(sb=>`
              <div style="display:flex;align-items:center;gap:.625rem">
                <span style="font-size:.875rem;flex-shrink:0">${sb.icon}</span>
                <span style="font-size:.8125rem;color:var(--text-2);flex:1">${sb.label}</span>
                <span style="font-weight:700;color:${sb.color};font-size:.8125rem;min-width:1.5rem;text-align:right">${sb.n}</span>
                <div style="width:80px;height:6px;background:var(--border);border-radius:3px;overflow:hidden;flex-shrink:0">
                  <div style="height:100%;width:${Math.round(sb.n/g.max*100)}%;background:${sb.color};border-radius:3px"></div>
                </div>
                <span style="font-size:.7rem;color:var(--muted);width:28px;text-align:right">${Math.round(sb.n/g.max*100)}%</span>
              </div>`).join('')}
          </div>

          <!-- Individual targets (expandable) -->
          <details style="margin-top:.875rem">
            <summary style="font-size:.8125rem;color:var(--blue-mid);cursor:pointer;font-weight:600;list-style:none">▸ Show all ${g.max} individual targets</summary>
            <div style="margin-top:.625rem;display:flex;flex-direction:column;gap:.375rem">
              ${g.items.map(k=>{
                const s = getS(k);
                const pts = kpiPts(s);
                const stColor = s==='Met'?'#166534':s==='In Progress'?'var(--progress)':s==='Partially Met'?'#9a3412':s==='Coming Down the Pipeline'?'var(--pipeline)':'#991b1b';
                const stBg    = s==='Met'?'#dcfce7':s==='In Progress'?'#eff6ff':s==='Partially Met'?'#ffedd5':s==='Coming Down the Pipeline'?'var(--pipe-bg)':'#fee2e2';
                return `<div style="display:flex;align-items:flex-start;gap:.625rem;padding:.5rem .625rem;border-radius:7px;border:1px solid var(--border);background:var(--surface-2)">
                  <div style="flex:1;font-size:.8125rem;color:var(--navy);line-height:1.4">${k.target}</div>
                  <span style="background:${stBg};color:${stColor};font-size:.6875rem;font-weight:700;padding:.15rem .4rem;border-radius:4px;white-space:nowrap;flex-shrink:0">${s}</span>
                </div>`;
              }).join('')}
            </div>
          </details>
        </div>`;
      });
      return html;

    // ── NEEDS ATTENTION ──────────────────────────────────────────
    } else if(tab === 'atRisk'){
      const atRiskItems = d.data.filter(k=>['Partially Met','Has Not Met'].includes(getS(k)));

      if(!atRiskItems.length){
        return `<div style="padding:3rem;text-align:center">
          <div style="font-size:2.5rem;margin-bottom:.75rem">🎉</div>
          <div style="font-size:1rem;font-weight:700;color:var(--navy);margin-bottom:.5rem">No At-Risk Targets Right Now</div>
          <div style="font-size:.875rem;color:var(--muted)">All current targets are Met, In Progress, or planned ahead — great work!</div>
        </div>`;
      }

      const notMetN  = atRiskItems.filter(k=>getS(k)==='Has Not Met').length;
      const partialN = atRiskItems.filter(k=>getS(k)==='Partially Met').length;

      let html = `<div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:12px;padding:1rem 1.25rem;margin-bottom:1.25rem">
        <div style="font-weight:700;color:#9a3412;margin-bottom:.375rem;font-size:.9375rem">🔍 ${atRiskItems.length} target${atRiskItems.length>1?'s warrant':'warrants'} further investigation</div>
        <div style="font-size:.8125rem;color:#7c2d12;line-height:1.5">
          ${notMetN>0?`<strong>${notMetN} not yet met</strong> — additional context and support may be helpful.`:''}
          ${partialN>0?`<strong>${partialN} partially completed</strong> — making solid progress and on the right track.`:''}
          Use the "Ask a Question" button below to share context or request support from leadership.
          Use the "Ask a Question" button below to flag context or request support from leadership.
        </div>
      </div>`;

      // Group by goal
      const byGoal = {};
      atRiskItems.forEach(k=>{if(!byGoal[k.goal])byGoal[k.goal]=[];byGoal[k.goal].push(k);});

      Object.entries(byGoal).sort((a,b)=>b[1].length-a[1].length).forEach(([gname,items])=>{
        const gd = goals[gname];
        html += `<div class="kpia-card" style="margin-bottom:1rem;border-left:4px solid ${gd?gd.risk.color:'#f97316'}">
          <div class="kpia-card-header" style="margin-bottom:.75rem">
            <div style="display:flex;align-items:center;gap:.5rem;flex-wrap:wrap">
              <div class="kpia-card-title">${gname}</div>
              ${gd?`<span style="background:${gd.risk.bg};color:${gd.risk.color};font-size:.6875rem;font-weight:700;padding:.2rem .5rem;border-radius:20px">${gd.risk.icon} ${gd.risk.label} · ${gd.score.toFixed(0)}%</span>`:''}
            </div>
            <div class="kpia-card-meta">${items.length} target${items.length>1?'s':''} need attention</div>
          </div>
          <div style="display:flex;flex-direction:column;gap:.5rem">
            ${items.sort((a,b)=>kpiPts(getS(a))-kpiPts(getS(b))).map(k=>{
              const s = getS(k);
              const isNotMet = s==='Has Not Met';
              const bColor = isNotMet?'#991b1b':'#9a3412';
              const bBg    = isNotMet?'#fee2e2':'#ffedd5';
              return `<div style="display:flex;align-items:flex-start;gap:.75rem;padding:.75rem;border-radius:9px;border:1px solid ${bColor}22;background:${bBg}44">
                <div style="font-size:1.125rem;flex-shrink:0">${isNotMet?'🔴':'🟠'}</div>
                <div style="flex:1;min-width:0">
                  <div style="font-size:.8125rem;font-weight:600;color:var(--navy);line-height:1.4;margin-bottom:.25rem">${k.target}</div>
                  <div style="font-size:.75rem;color:var(--muted)">Owner: ${k.owner||'Unassigned'}</div>
                </div>
                <div style="display:flex;flex-direction:column;align-items:flex-end;gap:.375rem;flex-shrink:0">
                  <span style="background:${bBg};color:${bColor};font-size:.6875rem;font-weight:700;padding:.15rem .4rem;border-radius:4px;white-space:nowrap">${s}</span>
                  <button style="font-size:.7rem;color:var(--blue-mid);background:none;border:1px solid var(--blue-mid);padding:.2rem .5rem;border-radius:4px;cursor:pointer;white-space:nowrap" onclick="openKPIInquiryWithMetric(${JSON.stringify(k.target).replace(/"/g,'&quot;')})">Ask about this →</button>
                </div>
              </div>`;
            }).join('')}
          </div>
        </div>`;
      });
      return html;

    // ── COMING UP ────────────────────────────────────────────────
    } else if(tab === 'pipeline'){
      const pipeItems = d.data.filter(k=>getS(k)==='Coming Down the Pipeline');
      if(!pipeItems.length){
        return `<div style="padding:3rem;text-align:center;color:var(--muted)">
          <div style="font-size:2rem;margin-bottom:.75rem">🟣</div>
          <div>No upcoming pipeline targets at this time.</div>
        </div>`;
      }

      const byGoal = {};
      pipeItems.forEach(k=>{if(!byGoal[k.goal])byGoal[k.goal]=[];byGoal[k.goal].push(k);});

      let html = `<div style="background:#faf5ff;border:1px solid #d8b4fe;border-radius:12px;padding:1rem 1.25rem;margin-bottom:1.25rem">
        <div style="font-weight:700;color:var(--pipeline);margin-bottom:.375rem;font-size:.9375rem">🟣 ${pipeItems.length} targets are planned ahead</div>
        <div style="font-size:.8125rem;color:#6b21a8;line-height:1.5">
          These targets are <strong>intentionally planned</strong> for later in the cycle — they haven't started yet, but the intent is documented.
          Each earns <strong>0.10 points</strong> now and will earn full credit when completed.
        </div>
      </div>`;

      Object.entries(byGoal).forEach(([gname,items])=>{
        html += `<div class="kpia-card" style="margin-bottom:1rem;border-left:4px solid var(--pipeline)">
          <div class="kpia-card-header" style="margin-bottom:.75rem">
            <div class="kpia-card-title">🟣 ${gname}</div>
            <div class="kpia-card-meta">${items.length} upcoming target${items.length>1?'s':''}</div>
          </div>
          <div style="display:flex;flex-direction:column;gap:.5rem">
            ${items.map(k=>`
              <div style="display:flex;align-items:flex-start;gap:.75rem;padding:.75rem;border-radius:9px;border:1px solid #e9d5ff;background:#faf5ff">
                <div style="font-size:1.125rem;flex-shrink:0">🟣</div>
                <div style="flex:1;min-width:0">
                  <div style="font-size:.8125rem;font-weight:600;color:var(--navy);line-height:1.4;margin-bottom:.25rem">${k.target}</div>
                  <div style="font-size:.75rem;color:var(--muted)">Owner: ${k.owner||'Unassigned'} · Intent confirmed · 0.10 pts now</div>
                </div>
                <button style="font-size:.7rem;color:var(--pipeline);background:none;border:1px solid var(--pipeline);padding:.2rem .5rem;border-radius:4px;cursor:pointer;white-space:nowrap;flex-shrink:0" onclick="openKPIInquiryWithMetric(${JSON.stringify(k.target).replace(/"/g,'&quot;')})">Ask about this →</button>
              </div>`).join('')}
          </div>
        </div>`;
      });
      return html;

    // ── FULL SCORECARD ───────────────────────────────────────────
    } else if(tab === 'scorecard'){
      const sorted = Object.entries(goals).sort((a,b)=>b[1].score-a[1].score);
      let html = `<div style="margin-bottom:1.25rem;padding:.875rem 1rem;background:#f0f9ff;border:1px solid #bae6fd;border-radius:10px;font-size:.8125rem;color:#0c4a6e;line-height:1.5">
        📋 <strong>Full Scorecard</strong> — All goal areas ranked from highest to lowest performance. Use this to present to leadership or compare across quarters.
      </div>`;

      html += `<div style="display:flex;flex-direction:column;gap:1rem">`;
      sorted.forEach(([name,g],rank)=>{
        const pct = g.score.toFixed(1);
        html += `<div class="kpia-card" style="border-left:4px solid ${g.risk.color}">
          <div style="display:flex;align-items:center;gap:.875rem;flex-wrap:wrap;margin-bottom:.75rem">
            <div style="font-family:'DM Serif Display',serif;font-size:1.5rem;color:var(--muted);width:28px;text-align:center;flex-shrink:0">#${rank+1}</div>
            <div style="flex:1;min-width:0">
              <div style="font-size:.9375rem;font-weight:700;color:var(--navy);margin-bottom:.25rem">${name}</div>
              <div style="font-size:.8125rem;color:var(--text-2)">${friendlyGoalLine(g,name)}</div>
            </div>
            <div style="text-align:right;flex-shrink:0">
              <div style="font-family:'DM Serif Display',serif;font-size:2rem;font-weight:700;color:${g.risk.color};line-height:1">${pct}%</div>
              <span style="background:${g.risk.bg};color:${g.risk.color};font-size:.6875rem;font-weight:700;padding:.2rem .5rem;border-radius:20px">${g.risk.icon} ${g.risk.label}</span>
            </div>
          </div>

          <!-- Score bar with threshold markers -->
          <div style="position:relative;margin-bottom:.5rem">
            <div style="height:10px;background:var(--border);border-radius:5px;overflow:hidden">
              <div style="height:100%;width:${Math.min(g.score,100).toFixed(1)}%;background:${g.risk.color};border-radius:5px;transition:width .5s ease"></div>
            </div>
            <div style="display:flex;justify-content:space-between;font-size:.65rem;color:var(--muted);margin-top:.25rem;padding:0 1px">
              <span>0%</span><span>|40% Needs Focus</span><span>|65% Developing</span><span>|85% Strong</span><span>100%</span>
            </div>
          </div>

          <!-- Target status bar -->
          <div style="display:flex;gap:2px;height:6px;border-radius:3px;overflow:hidden;margin-bottom:.625rem">
            ${g.counts['Met']?`<div style="flex:${g.counts['Met']};background:#22c55e" title="Met: ${g.counts['Met']}"></div>`:''}
            ${g.counts['In Progress']?`<div style="flex:${g.counts['In Progress']};background:var(--progress)" title="In Progress: ${g.counts['In Progress']}"></div>`:''}
            ${g.counts['Partially Met']?`<div style="flex:${g.counts['Partially Met']};background:#f97316" title="Partially Met: ${g.counts['Partially Met']}"></div>`:''}
            ${g.counts['Coming Down the Pipeline']?`<div style="flex:${g.counts['Coming Down the Pipeline']};background:var(--pipeline)" title="Pipeline: ${g.counts['Coming Down the Pipeline']}"></div>`:''}
            ${g.counts['Has Not Met']?`<div style="flex:${g.counts['Has Not Met']};background:#ef4444" title="Not Met: ${g.counts['Has Not Met']}"></div>`:''}
          </div>

          <div style="font-size:.75rem;color:var(--muted)">
            ${g.pts.toFixed(2)} pts earned of ${g.max} possible · ${g.max} targets
          </div>
        </div>`;
      });
      html += `</div>`;
      return html;

    // ── QUARTERLY SUMMARY ────────────────────────────────────────
    } else if(tab === 'quarterly'){
      return renderQuarterlyTab();
    }
    return '';
  }

  // ════════════════════════════════════════════════════════════════
  //  QUARTERLY ANALYTICS TAB
  //  Cross-quarter comparison: health scores, status shifts, exports
  // ════════════════════════════════════════════════════════════════

  function renderQuarterlyTab() {
    var qd = window.KPI_Q_DATA;

    if (!qd || !qd.activeQs || !qd.activeQs.length) {
      return `<div style="padding:3rem;text-align:center">
        <div style="font-size:2.5rem;margin-bottom:.875rem">📅</div>
        <div style="font-size:1rem;font-weight:700;color:var(--navy);margin-bottom:.5rem">Quarterly data loading…</div>
        <div style="font-size:.875rem;color:var(--muted);max-width:380px;margin:0 auto .5rem">
          Pulling from the Quarterly Goal Tracking tab. This usually resolves within a few seconds.
        </div>
        <button class="btn btn-secondary" style="margin-top:.75rem" onclick="fetchKPIMetadata(true);setTimeout(()=>setKPIAnalyticsTab('quarterly'),1800)">↺ Reload quarterly data</button>
      </div>`;
    }

    var activeQs   = qd.activeQs;
    var scorecards = qd.scorecards;
    var deltas     = qd.deltas;
    var latestQ    = activeQs[activeQs.length - 1];
    var latestSC   = scorecards[scorecards.length - 1];

    // Improved: last move was 'up'
    var improved  = deltas.filter(function(d){ var lm=d.moves[d.moves.length-1]; return lm && lm.dir==='up'; });
    // Regressed: last move was 'down'
    var regressed = deltas.filter(function(d){ var lm=d.moves[d.moves.length-1]; return lm && lm.dir==='down'; });
    // Big wins: any move from ≤ In Progress → Met
    var bigWins   = deltas.filter(function(d){ var lm=d.moves[d.moves.length-1]; return lm && lm.to==='Met' && _Q_RANK[lm.from] <= 2; });
    // Critical: any move to Has Not Met
    var critical  = deltas.filter(function(d){ var lm=d.moves[d.moves.length-1]; return lm && lm.to==='Has Not Met'; });

    var tsStr = new Date(qd.lastUpdated).toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'});
    var qLabel = 'Q' + latestQ + ' \u2014 SY 2025\u20132026';

    var html = '';

    // ── Header banner ─────────────────────────────────────────────
    html += `<div style="background:linear-gradient(135deg,#0a1628 0%,#1a3060 100%);border-radius:14px;padding:1.5rem 1.75rem;margin-bottom:1.25rem;color:white">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:1rem;flex-wrap:wrap">
        <div>
          <div style="display:inline-flex;align-items:center;gap:.4rem;background:rgba(255,255,255,.15);border:1px solid rgba(255,255,255,.3);border-radius:20px;padding:.2rem .75rem;font-size:.8rem;font-weight:700;margin-bottom:.625rem">
            📅 ${qLabel}
          </div>
          <div style="font-size:1.25rem;font-weight:900;line-height:1.2;margin-bottom:.375rem">NJTC Quarterly Goal Summary</div>
          <div style="font-size:.8rem;opacity:.7;line-height:1.5">Live from Google Sheet · ${qd.rows.length} targets · Last synced ${tsStr}</div>
        </div>
        <div style="display:flex;gap:.5rem;flex-wrap:wrap;align-items:flex-start;padding-top:.25rem">
          <button onclick="openKPILivePresentation()" style="background:rgba(232,168,56,.22);border:1px solid rgba(232,168,56,.55);color:white;font-size:.75rem;font-weight:700;padding:.4rem .875rem;border-radius:7px;cursor:pointer;display:flex;align-items:center;gap:.35rem">🎥 Open Live Presentation</button>
          <button onclick="openKPILiveWorkbook()" style="background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.3);color:white;font-size:.75rem;font-weight:700;padding:.4rem .875rem;border-radius:7px;cursor:pointer;display:flex;align-items:center;gap:.35rem">📗 Open Live Workbook</button>
          ${(window.NJTC_SESSION||{}).dept === 'data' ? `<button onclick="exportKPIQuarterlySummaryPDF()" style="background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.3);color:white;font-size:.75rem;font-weight:700;padding:.4rem .875rem;border-radius:7px;cursor:pointer;display:flex;align-items:center;gap:.35rem">📄 Export PDF</button>
          <button onclick="exportKPIQuarterlySummaryPPTX()" style="background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.3);color:white;font-size:.75rem;font-weight:700;padding:.4rem .875rem;border-radius:7px;cursor:pointer;display:flex;align-items:center;gap:.35rem">📊 Export PPTX</button>
          <button onclick="exportKPIQuarterlySummaryDOCX()" style="background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.3);color:white;font-size:.75rem;font-weight:700;padding:.4rem .875rem;border-radius:7px;cursor:pointer;display:flex;align-items:center;gap:.35rem">📝 Export Word (board memo)</button>` : ''}
        </div>
      </div>
      <div style="display:flex;gap:1.25rem;flex-wrap:wrap;margin-top:1.25rem;padding-top:1rem;border-top:1px solid rgba(255,255,255,.15)">
        <div style="text-align:center;min-width:60px"><div style="font-size:1.75rem;font-weight:900;color:#4ade80">${latestSC.counts.met}</div><div style="font-size:.58rem;text-transform:uppercase;letter-spacing:.08em;opacity:.6;margin-top:.1rem">Met</div></div>
        <div style="text-align:center;min-width:60px"><div style="font-size:1.75rem;font-weight:900;color:#60a5fa">${latestSC.counts.prog}</div><div style="font-size:.58rem;text-transform:uppercase;letter-spacing:.08em;opacity:.6;margin-top:.1rem">In Progress</div></div>
        <div style="text-align:center;min-width:60px"><div style="font-size:1.75rem;font-weight:900;color:#fbbf24">${latestSC.counts.partial}</div><div style="font-size:.58rem;text-transform:uppercase;letter-spacing:.08em;opacity:.6;margin-top:.1rem">Partial</div></div>
        <div style="text-align:center;min-width:60px"><div style="font-size:1.75rem;font-weight:900;color:#c084fc">${latestSC.counts.pipe}</div><div style="font-size:.58rem;text-transform:uppercase;letter-spacing:.08em;opacity:.6;margin-top:.1rem">Pipeline</div></div>
        <div style="text-align:center;min-width:60px"><div style="font-size:1.75rem;font-weight:900;color:#f87171">${latestSC.counts.notmet}</div><div style="font-size:.58rem;text-transform:uppercase;letter-spacing:.08em;opacity:.6;margin-top:.1rem">Not Met</div></div>
        <div style="text-align:center;min-width:60px;margin-left:auto"><div style="font-size:1.75rem;font-weight:900;color:${latestSC.health.color === '#166534' ? '#4ade80' : latestSC.score >= 65 ? '#fbbf24' : latestSC.score >= 40 ? '#fb923c' : '#f87171'}">${latestSC.score}%</div><div style="font-size:.58rem;text-transform:uppercase;letter-spacing:.08em;opacity:.6;margin-top:.1rem">Health Score</div></div>
      </div>
    </div>`;

    // ── Quarter-by-quarter progression ────────────────────────────
    if (scorecards.length >= 2) {
      html += `<div class="kpia-card" style="margin-bottom:1.25rem">
        <div class="kpia-card-header" style="margin-bottom:1rem">
          <div class="kpia-card-title">📈 Quarter-by-Quarter Progression</div>
          <div class="kpia-card-meta">Health score trend across completed quarters · SY 2025–2026</div>
        </div>
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:.875rem">`;
      scorecards.forEach(function(sc, idx) {
        var prev = idx > 0 ? scorecards[idx-1] : null;
        var delta = prev ? sc.score - prev.score : null;
        var arrow = delta === null ? '' : delta > 0 ? ' ↑+' + delta : delta < 0 ? ' ↓' + delta : ' →0';
        var arrowColor = delta === null ? 'inherit' : delta > 0 ? '#16a34a' : delta < 0 ? '#dc2626' : '#6b7280';
        var isCurrent = sc.q === latestQ;
        html += `<div style="border-radius:12px;padding:1rem;border:${isCurrent?'2px solid '+sc.health.color:'1px solid var(--border)'};background:${isCurrent?sc.health.bg+'44':'var(--surface-2)'}">
          <div style="font-size:.65rem;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:var(--muted);margin-bottom:.375rem">${sc.label}${isCurrent?' · Current':''}</div>
          <div style="font-size:1.75rem;font-weight:800;color:${sc.health.color};line-height:1;font-family:'DM Serif Display',serif">${sc.score}%</div>
          <div style="font-size:.7rem;font-weight:700;color:${sc.health.color};margin-top:.25rem">${sc.health.label}</div>
          ${delta !== null ? `<div style="font-size:.75rem;font-weight:700;color:${arrowColor};margin-top:.375rem">${arrow} from ${prev.label}</div>` : ''}
          <div style="height:4px;background:var(--border);border-radius:2px;overflow:hidden;margin-top:.5rem">
            <div style="height:100%;width:${Math.min(sc.score,100)}%;background:${sc.health.color};border-radius:2px"></div>
          </div>
          <div style="font-size:.65rem;color:var(--muted);margin-top:.375rem">${sc.counts.met} Met · ${sc.counts.total} total</div>
        </div>`;
      });
      html += `</div></div>`;
    }

    // ── Status shift summary ───────────────────────────────────────
    if (deltas.length > 0) {
      html += `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:.875rem;margin-bottom:1.25rem">
        <div style="background:#f0fdf4;border:1px solid #86efac;border-radius:12px;padding:1rem">
          <div style="font-size:1.625rem;font-weight:800;color:#16a34a">${improved.length}</div>
          <div style="font-size:.8125rem;font-weight:700;color:#15803d;margin:.2rem 0">↑ Improved</div>
          <div style="font-size:.7rem;color:#166534">targets moved to a better status</div>
        </div>
        <div style="background:#fef2f2;border:1px solid #fca5a5;border-radius:12px;padding:1rem">
          <div style="font-size:1.625rem;font-weight:800;color:#dc2626">${regressed.length}</div>
          <div style="font-size:.8125rem;font-weight:700;color:#b91c1c;margin:.2rem 0">↓ Regressed</div>
          <div style="font-size:.7rem;color:#991b1b">targets moved to a worse status</div>
        </div>
        <div style="background:#f0fdf4;border:1px solid #86efac;border-radius:12px;padding:1rem">
          <div style="font-size:1.625rem;font-weight:800;color:#16a34a">${bigWins.length}</div>
          <div style="font-size:.8125rem;font-weight:700;color:#15803d;margin:.2rem 0">🏆 Big Wins</div>
          <div style="font-size:.7rem;color:#166534">targets reached Met status this cycle</div>
        </div>
        <div style="background:${critical.length?'#fef2f2':'var(--surface-2)'};border:1px solid ${critical.length?'#fca5a5':'var(--border)'};border-radius:12px;padding:1rem">
          <div style="font-size:1.625rem;font-weight:800;color:${critical.length?'#dc2626':'var(--muted)'}">${critical.length}</div>
          <div style="font-size:.8125rem;font-weight:700;color:${critical.length?'#b91c1c':'var(--muted)'};margin:.2rem 0">⚠️ Critical Shifts</div>
          <div style="font-size:.7rem;color:${critical.length?'#991b1b':'var(--muted)'}">targets dropped to Has Not Met</div>
        </div>
      </div>`;
    }

    // ── Top improvements ──────────────────────────────────────────
    if (improved.length) {
      var topImprovements = improved.slice(0, 5);
      html += `<div class="kpia-card" style="margin-bottom:1.25rem;border-left:4px solid #16a34a">
        <div class="kpia-card-header" style="margin-bottom:.875rem">
          <div class="kpia-card-title">🏆 Notable Improvements This Cycle</div>
          <div class="kpia-card-meta">Targets that moved to a stronger status between quarters</div>
        </div>
        <div style="display:flex;flex-direction:column;gap:.5rem">`;
      topImprovements.forEach(function(d) {
        var lm = d.moves[d.moves.length-1];
        var mStr = _deltaMetricStr(d);
        html += `<div style="display:flex;align-items:flex-start;gap:.75rem;padding:.75rem;border-radius:9px;border:1px solid #bbf7d0;background:#f0fdf4">
          <div style="flex:1;min-width:0">
            <div style="font-size:.8125rem;font-weight:600;color:var(--navy);line-height:1.4;margin-bottom:.3rem">${d.target}</div>
            <div style="font-size:.7rem;color:var(--muted)">${d.goal}${d.owner?' · '+d.owner:''}</div>
            ${mStr?`<div style="font-size:.7rem;color:#15803d;font-weight:700;margin-top:.25rem">📊 ${mStr}</div>`:''}
          </div>
          <div style="display:flex;align-items:center;gap:.35rem;flex-shrink:0;flex-wrap:wrap;justify-content:flex-end">
            <span style="background:#fee2e2;color:#991b1b;font-size:.65rem;font-weight:700;padding:.15rem .4rem;border-radius:4px;white-space:nowrap">${lm.from}</span>
            <span style="font-size:.8rem;color:#16a34a;font-weight:700">→</span>
            <span style="background:#dcfce7;color:#15803d;font-size:.65rem;font-weight:700;padding:.15rem .4rem;border-radius:4px;white-space:nowrap">${lm.to}</span>
            <span style="font-size:.65rem;color:#6b7280;white-space:nowrap">Q${lm.fromQ}→Q${lm.toQ}</span>
          </div>
        </div>`;
      });
      if (improved.length > 5) html += `<div style="font-size:.75rem;color:var(--muted);text-align:center;padding:.5rem">+${improved.length - 5} more improvements</div>`;
      html += `</div></div>`;
    }

    // ── Critical regressions ──────────────────────────────────────
    if (critical.length) {
      html += `<div class="kpia-card" style="margin-bottom:1.25rem;border-left:4px solid #dc2626">
        <div class="kpia-card-header" style="margin-bottom:.875rem">
          <div class="kpia-card-title">🔴 Critical Regressions — Immediate Attention Required</div>
          <div class="kpia-card-meta">Targets that reached "Has Not Met" status this cycle</div>
        </div>
        <div style="display:flex;flex-direction:column;gap:.5rem">`;
      critical.forEach(function(d) {
        var critMove = d.moves[d.moves.length-1];
        var mStr = _deltaMetricStr(d);
        html += `<div style="display:flex;align-items:flex-start;gap:.75rem;padding:.75rem;border-radius:9px;border:1px solid #fca5a5;background:#fef2f2">
          <div style="font-size:1.125rem;flex-shrink:0">🔴</div>
          <div style="flex:1;min-width:0">
            <div style="font-size:.8125rem;font-weight:600;color:var(--navy);line-height:1.4;margin-bottom:.3rem">${d.target}</div>
            <div style="font-size:.7rem;color:var(--muted)">${d.goal}${d.owner?' · '+d.owner:''}</div>
            ${mStr?`<div style="font-size:.7rem;color:#991b1b;font-weight:700;margin-top:.25rem">📊 ${mStr}</div>`:''}
          </div>
          ${critMove?`<div style="flex-shrink:0;text-align:right">
            <span style="background:#fef2f2;color:#991b1b;font-size:.65rem;font-weight:700;padding:.15rem .4rem;border-radius:4px;white-space:nowrap">${critMove.from} → Has Not Met</span>
            <div style="font-size:.65rem;color:#6b7280;margin-top:.2rem">Q${critMove.fromQ}→Q${critMove.toQ}</div>
          </div>`:''}
        </div>`;
      });
      html += `</div></div>`;
    }

    // ── Other regressions (non-critical) ─────────────────────────
    var otherRegressed = regressed.filter(function(d){ return !critical.some(function(c){ return c.target===d.target; }); });
    if (otherRegressed.length) {
      html += `<div class="kpia-card" style="margin-bottom:1.25rem;border-left:4px solid #d97706">
        <div class="kpia-card-header" style="margin-bottom:.875rem">
          <div class="kpia-card-title">🟠 Status Declines — Monitor Closely</div>
          <div class="kpia-card-meta">${otherRegressed.length} target${otherRegressed.length>1?'s':''} moved to a weaker status between quarters</div>
        </div>
        <div style="display:flex;flex-direction:column;gap:.5rem">`;
      otherRegressed.slice(0, 6).forEach(function(d) {
        var lm = d.moves[d.moves.length-1];
        var mStr = _deltaMetricStr(d);
        html += `<div style="display:flex;align-items:flex-start;gap:.75rem;padding:.625rem .75rem;border-radius:9px;border:1px solid #fed7aa;background:#fff7ed">
          <div style="flex:1;min-width:0">
            <div style="font-size:.8125rem;font-weight:600;color:var(--navy);line-height:1.4;margin-bottom:.2rem">${d.target}</div>
            <div style="font-size:.7rem;color:var(--muted)">${d.goal}${d.owner?' · '+d.owner:''}</div>
            ${mStr?`<div style="font-size:.7rem;color:#9a3412;font-weight:700;margin-top:.2rem">📊 ${mStr}</div>`:''}
          </div>
          <div style="flex-shrink:0;display:flex;align-items:center;gap:.3rem;flex-wrap:wrap;justify-content:flex-end">
            <span style="background:#dcfce7;color:#15803d;font-size:.65rem;font-weight:700;padding:.15rem .4rem;border-radius:4px;white-space:nowrap">${lm.from}</span>
            <span style="font-size:.8rem;color:#d97706;font-weight:700">→</span>
            <span style="background:#fff7ed;color:#9a3412;font-size:.65rem;font-weight:700;padding:.15rem .4rem;border-radius:4px;white-space:nowrap">${lm.to}</span>
            <span style="font-size:.65rem;color:#6b7280;white-space:nowrap">Q${lm.fromQ}→Q${lm.toQ}</span>
          </div>
        </div>`;
      });
      if (otherRegressed.length > 6) html += `<div style="font-size:.75rem;color:var(--muted);text-align:center;padding:.5rem">+${otherRegressed.length - 6} more</div>`;
      html += `</div></div>`;
    }

    // ── Full cross-quarter breakdown by goal area ─────────────────
    var goalOrder = [], goalGroups = {};
    qd.rows.forEach(function(r) {
      var g = (r[0]||'').trim(), t = (r[1]||'').trim();
      if (!g || !t) return;
      if (goalOrder.indexOf(g) < 0) goalOrder.push(g);
      if (!goalGroups[g]) goalGroups[g] = [];
      goalGroups[g].push(r);
    });

    function _sBg(s){ return s==='Met'?'#dcfce7':s==='Partially Met'?'#fff7ed':s==='In Progress'?'#eff6ff':s==='Has Not Met'?'#fee2e2':s==='Coming Down the Pipeline'?'#f5f3ff':'#f3f4f6'; }
    function _sClr(s){ return s==='Met'?'#166534':s==='Partially Met'?'#9a3412':s==='In Progress'?'#1e40af':s==='Has Not Met'?'#991b1b':s==='Coming Down the Pipeline'?'#6d28d9':'#6b7280'; }
    function _sShort(s){ return (s||'').replace('Coming Down the Pipeline','Pipeline').replace('Partially Met','Partial').replace('In Progress','Progress').replace('Has Not Met','Not Met'); }

    html += `<div class="kpia-card" style="margin-bottom:1.25rem">
      <div class="kpia-card-header" style="margin-bottom:1rem">
        <div class="kpia-card-title">📊 Full Cross-Quarter Breakdown by Goal Area</div>
        <div class="kpia-card-meta">Every target with status across all completed quarters · SY 2025–2026</div>
      </div>`;

    goalOrder.forEach(function(goal) {
      var rows2 = goalGroups[goal];
      // Per-goal counts for latest quarter
      var gMet = rows2.filter(function(r){ return (_Q_COLS[latestQ-1] && (r[_Q_COLS[latestQ-1][1]]||'').trim()==='Met'); }).length;
      html += `<details style="margin-bottom:.75rem;border:1px solid var(--border);border-radius:10px;overflow:hidden">
        <summary style="padding:.75rem 1rem;cursor:pointer;background:var(--navy);color:white;font-size:.8125rem;font-weight:700;display:flex;justify-content:space-between;align-items:center;list-style:none">
          <span>${goal}</span>
          <span style="font-size:.7rem;opacity:.7;font-weight:400">${gMet}/${rows2.length} Met · Q${latestQ}</span>
        </summary>
        <div style="padding:.75rem 1rem;background:white">
          <div style="display:grid;grid-template-columns:1fr${activeQs.map(function(){ return ' minmax(72px,80px)'; }).join('')};gap:.5rem .75rem;align-items:center;margin-bottom:.5rem;padding-bottom:.375rem;border-bottom:2px solid var(--border)">
            <div style="font-size:.65rem;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--muted)">Target</div>
            ${activeQs.map(function(q){ var isCur=q===latestQ; return '<div style="font-size:.65rem;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:'+(isCur?'var(--navy)':'var(--muted)')+';text-align:center">Q'+q+(isCur?' ▾':'')+'</div>'; }).join('')}
          </div>`;
      rows2.forEach(function(r) {
        var tText = (r[1]||'').trim();
        var qPills = activeQs.map(function(q) {
          var s = (r[_Q_COLS[q-1][1]]||'').trim();
          if (!s) return '<div style="text-align:center;font-size:.65rem;color:var(--muted)">—</div>';
          var isCur = q === latestQ;
          return '<div style="text-align:center"><span style="background:'+_sBg(s)+';color:'+_sClr(s)+';font-size:.6rem;font-weight:700;padding:.1rem .3rem;border-radius:4px;white-space:nowrap;display:inline-block'+(isCur?';border:1px solid '+_sClr(s)+'44':'')+'">' + _sShort(s) + '</span></div>';
        }).join('');
        // Delta indicator for last transition
        var deltaD = deltas.find(function(d){ return d.target === tText; });
        var deltaStr = '';
        if (deltaD) {
          var lm2 = deltaD.moves[deltaD.moves.length-1];
          deltaStr = ' <span style="font-size:.65rem;color:'+(lm2.dir==='up'?'#16a34a':'#dc2626')+';">'+(lm2.dir==='up'?'↑':'↓')+'</span>';
        }
        // Captured Metric / Goal Target trend line — pulled live from columns G/I/K/M
        var trend = _quarterMetricTrend(r, activeQs);
        var trendLine = trend ? `<div style="font-size:.7rem;color:var(--muted);margin-top:.2rem;font-weight:600" title="Live from Quarterly Goal Tracking tab">📊 ${trend}</div>` : '';
        html += `<div style="display:grid;grid-template-columns:1fr${activeQs.map(function(){ return ' minmax(72px,80px)'; }).join('')};gap:.5rem .75rem;align-items:start;padding:.375rem 0;border-bottom:1px solid var(--border-2)">
          <div style="font-size:.8rem;color:var(--navy);line-height:1.4">${tText}${deltaStr}${trendLine}</div>
          ${qPills}
        </div>`;
      });
      html += `</div></details>`;
    });

    html += `</div>`;

    // ── Export footer ─────────────────────────────────────────────
    var _dept = (window.NJTC_SESSION||{}).dept;
    if (_dept === 'data') {
      html += `<div style="display:flex;gap:.75rem;justify-content:center;padding:1rem;border:1px solid var(--border);border-radius:12px;background:var(--surface-2);flex-wrap:wrap">
        <div style="font-size:.8125rem;color:var(--muted);align-self:center;flex-basis:100%;text-align:center;margin-bottom:.25rem">Export this quarterly summary for presentations and reports:</div>
        <button onclick="exportKPIQuarterlySummaryPDF()" class="btn btn-secondary" style="display:flex;align-items:center;gap:.5rem;font-weight:700">📄 Download PDF Summary</button>
        <button onclick="exportKPIQuarterlySummaryPPTX()" class="btn btn-secondary" style="display:flex;align-items:center;gap:.5rem;font-weight:700">📊 Download PPTX Slides</button>
        <button onclick="exportKPIQuarterlySummaryDOCX()" class="btn btn-secondary" style="display:flex;align-items:center;gap:.5rem;font-weight:700">📝 Download Word Board Memo</button>
        <button onclick="openKPILivePresentation()" class="btn btn-secondary" style="display:flex;align-items:center;gap:.5rem;font-weight:700">🎥 Open Live Presentation</button>
        <button onclick="openKPILiveWorkbook()" class="btn btn-secondary" style="display:flex;align-items:center;gap:.5rem;font-weight:700">📗 Open Live Workbook</button>
      </div>`;
    } else {
      html += `<div style="display:flex;gap:.75rem;justify-content:center;padding:1rem;border:1px solid var(--border);border-radius:12px;background:var(--surface-2);flex-wrap:wrap">
        <button onclick="openKPILivePresentation()" class="btn btn-secondary" style="display:flex;align-items:center;gap:.5rem;font-weight:700">🎥 Open Live Presentation</button>
        <button onclick="openKPILiveWorkbook()" class="btn btn-secondary" style="display:flex;align-items:center;gap:.5rem;font-weight:700">📗 Open Live Workbook</button>
      </div>
      <div style="padding:.875rem 1.125rem;border:1px solid #bae6fd;border-radius:12px;background:#f0f9ff;font-size:.8125rem;color:#0c4a6e;line-height:1.6;text-align:center;margin-top:.75rem">
        💬 <strong>Ask PIE</strong> for a quarterly summary — type <em>"quarterly summary"</em> or <em>"what changed this quarter"</em> in the chat.<br>
        <span style="font-size:.75rem;opacity:.8">PDF and PPTX file exports are available to the Data &amp; Evaluation department.</span>
      </div>`;
    }

    return html;
  }

  // ════════════════════════════════════════════════════════════════
  //  KPI INQUIRY FORM
  // ════════════════════════════════════════════════════════════════

  const KPI_INQUIRY_FORM = 'https://docs.google.com/forms/d/e/1FAIpQLSd59ZRol4DKvJjX2oDAuO2mSICuo5H7ac3giNbUQQfAoMkUTg/formResponse';

  const KPI_INQUIRY_ENTRY = {
    userName:   'entry.1971354312',   // Name of user
    context:    'entry.1060571871',   // Open field - context / question
    metric:     'entry.1490774208',   // KPI metric being reported
  };

  function populateKPIMetricDropdown() {
    const sel = document.getElementById('kpiq_metric');
    if (!sel || sel.options.length > 1) return;
    const seen = new Set();
    KPI_DATA.forEach(k => {
      if (!seen.has(k.target)) {
        seen.add(k.target);
        const o = document.createElement('option');
        o.value = k.target;
        o.textContent = k.target.length > 80 ? k.target.slice(0,80) + '…' : k.target;
        sel.appendChild(o);
      }
    });
  }

  function openKPIInquiry(preselect) {
    populateKPIMetricDropdown();
    if (preselect) {
      const sel = document.getElementById('kpiq_metric');
      if (sel) {
        for (let i = 0; i < sel.options.length; i++) {
          if (sel.options[i].value === preselect) { sel.selectedIndex = i; break; }
        }
      }
    }
    document.getElementById('kpiInquiryModal').classList.add('open');
    const nameField = document.getElementById('kpiq_name');
    if (nameField && !nameField.value && window.NJTC_SESSION) {
      nameField.value = window.NJTC_SESSION.name || '';
    }
  }

  function openKPIInquiryWithMetric(metric) {
    openKPIInquiry(metric);
  }

  function closeKPIInquiry() {
    document.getElementById('kpiInquiryModal').classList.remove('open');
  }

  function resetKPIInquiry() {
    document.getElementById('kpiInquiryForm').style.display = '';
    document.getElementById('kpiInquirySuccess').classList.remove('show');
    document.getElementById('kpiq_name').value = '';
    document.getElementById('kpiq_metric').selectedIndex = 0;
    document.getElementById('kpiq_context').value = '';
    document.getElementById('kpiq_error').style.display = 'none';
    const btn = document.getElementById('kpiqSubmitBtn');
    if (btn) { btn.classList.remove('loading'); btn.disabled = false; }
  }

  async function submitKPIInquiry() {
    const name    = (document.getElementById('kpiq_name')?.value || '').trim();
    const context = (document.getElementById('kpiq_context')?.value || '').trim();
    const metric  = document.getElementById('kpiq_metric')?.value || '';
    const errEl   = document.getElementById('kpiq_error');

    // Validate
    const missing = [];
    if (!name)    missing.push('Your Name');
    if (!metric)  missing.push('KPI Metric');
    if (!context) missing.push('Question / Context');
    if (missing.length) {
      errEl.textContent = `Please complete: ${missing.join(', ')}`;
      errEl.style.display = 'block';
      return;
    }
    errEl.style.display = 'none';

    const btn = document.getElementById('kpiqSubmitBtn');
    btn.classList.add('loading');
    btn.disabled = true;

    // Build form data — Google Forms requires application/x-www-form-urlencoded
    const params = new URLSearchParams();
    params.append(KPI_INQUIRY_ENTRY.userName, name);
    params.append(KPI_INQUIRY_ENTRY.context, context);
    params.append(KPI_INQUIRY_ENTRY.metric, metric);

    try {
      await fetch(KPI_INQUIRY_FORM, {
        method: 'POST',
        body: params.toString(),
        mode: 'no-cors',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      });
    } catch(e) { /* no-cors fetch always resolves */ }

    // Reset button then show success
    btn.classList.remove('loading');
    btn.disabled = false;
    document.getElementById('kpiInquiryForm').style.display = 'none';
    document.getElementById('kpiInquirySuccess').classList.add('show');
  }

  // ── Wire KPI Analytics panel into showPanel ──────────────────────
  // Uses MutationObserver — showPanel is defined in index.html and may not
  // exist yet when this IIFE runs, so we watch for panel activation instead.
  const _kpiaPanelObserver = new MutationObserver(() => {
    const p = document.getElementById('panel-kpi-analytics');
    if (p && p.classList.contains('active')) {
      const content = document.getElementById('kpiAnalyticsContent');
      if (content && !content.innerHTML.trim()) buildKPIAnalytics();
    }
  });
  document.addEventListener('DOMContentLoaded', () => {
    const p = document.getElementById('panel-kpi-analytics');
    if (p) _kpiaPanelObserver.observe(p, { attributes: true, attributeFilter: ['class'] });
  });

  // ── Wire dept-aware init ─────────────────────────────────────────
  async function buildTalentDashboard(forceRefresh) {
    const el = document.getElementById('talentContent');
    if (!el) return;
    if (window._talentLoaded && !forceRefresh) {
      const _er_dept=(window.NJTC_SESSION||{}).dept||'hr';
      console.log('[Talent] Early-return path, dept:', _er_dept);
      if (['hr','data','leadership','kb','finance','programming','training'].includes(_er_dept)) {
        setTalentTab('profiles');
      } else { buildTalentContent(); }
      return;
    }
    el.innerHTML = '<div class="policy-loading-state"><div class="policy-loading-spinner"></div><div>Loading analytics…</div></div>';
    _talentLiveStatus = 'pending';
    _updateTalentBadge('pending');
    // Signal whether this is a forced refresh (adds cache-bust param, same as KPI refresh)
    window._talentForceRefresh = !!forceRefresh;

    // ── Non-blocking concerns fetch ───────────────────────────────────────────
    // fetchLiveConcerns synchronously loads cached data on first call, then fires
    // a background network request. We do NOT await — render immediately with
    // whatever is in CONCERNS (cached or seed), then refresh the concerns tab
    // when the network response arrives.
    const _concernsFetch = fetchLiveConcerns().catch(e => { _talentLiveStatus = 'fallback'; });

    window._talentForceRefresh = false;
    window._talentLoaded = true;
    window._filteredConcerns = CONCERNS; // cached or seed data — available immediately
    _updateTalentBadge(_talentLiveStatus === 'live' ? 'live' : 'pending');

    // Fire all background data fetches (non-blocking)
    fetchLiveHRData(!!forceRefresh).catch(e=>console.warn('[HR]',e.message));
    fetchLiveOnsiteData(!!forceRefresh).catch(e=>console.warn('[Onsite]',e.message));
    fetchLiveObsData(!!forceRefresh).catch(e=>console.warn('[Obs]',e.message));
    // Sync hiring decisions from the shared Google Sheet into localStorage so decisions
    // recorded by any team member are visible to all users on next talent load.
    _hiringFetchSheet().then(rows => {
      if (!rows.length) return;
      const local = _hiringLoad();
      const localKeys = new Set(local.map(r => (r.ts||'').slice(0,16) + '|' + (r.ek||r.en||'')));
      let added = 0;
      for (const r of rows) {
        const ek = (r.en||'').replace(/\W/g,'_');
        const k = (r.ts||'').slice(0,16) + '|' + (r.en||'');
        if (!localKeys.has(k)) {
          local.push({ ek, en: r.en, d: r.d, n: r.n||'', sy: r.sy||'2025-2026',
                       ts: r.ts, by: r.by||'', role: r.role||'', loc: r.loc||'', src: 'sheet' });
          localKeys.add(k);
          added++;
        }
      }
      if (added) {
        _hiringSave(local);
        window._njtcHiringDecisions = local;
        console.log('[Hiring] Synced', added, 'decision(s) from Google Sheet');
      }
    }).catch(() => {});
    if (typeof irlab !== 'undefined' && irlab && irlab.fetchLive) {
      irlab.fetchLive(!!forceRefresh).catch(e=>console.warn('[irlab live]',e.message));
    }

    try { initTalentFilters(); } catch(e) { console.error('[Talent] initFilters error:', e); }
    try { initTalentTabsForDept(window._currentDept || 'hr'); } catch(e) { console.error('[Talent] initTabs error:', e); }
    // Render Central Team race/ethnicity card at top of Talent Analytics
    try {
      const _ctCard = document.getElementById('centralTeamRaceCard');
      if (_ctCard && typeof _buildCentralTeamDiversityCard === 'function') {
        _ctCard.innerHTML = _buildCentralTeamDiversityCard();
      }
    } catch(e) { console.warn('[Talent] Central team race card error:', e); }

    const _td=(window.NJTC_SESSION||{}).dept||'hr';
    console.log('[Talent] About to route, dept:', _td, '_talentLoaded:', window._talentLoaded);
    if (['hr','data','leadership','kb','finance','programming','training'].includes(_td)) {
      console.log('[Talent] Calling setTalentTab profiles...');
      setTalentTab('profiles');
    } else {
      buildTalentContent();
    }

    // When concerns fetch completes, update badge and silently refresh concerns tab if active
    _concernsFetch.then(() => {
      _updateTalentBadge(_talentLiveStatus);
      window._filteredConcerns = CONCERNS;
      try {
        const _activeTab = document.querySelector('[data-tab].talent-tab-btn.active, .talent-tab.active');
        const _activeId  = _activeTab ? (_activeTab.dataset.tab || _activeTab.id || '') : '';
        if (_activeId === 'all' || _activeId === 'talent-tab-all') buildTalentContent();
      } catch(e) {}
    });
  }

  function _updateTalentBadge(status) {
    const badge = document.getElementById('talent-live-badge');
    if (!badge) return;
    if (status === 'live') {
      badge.style.cssText = 'font-size:.7rem;color:#0d6e3a;background:#d1fae5';
      badge.textContent = 'LIVE DATA';
    } else if (status === 'fallback') {
      badge.style.cssText = 'font-size:.7rem;color:#92400e;background:#fef3c7';
      badge.textContent = 'BUILT-IN DATA';
    } else {
      badge.style.cssText = 'font-size:.7rem;color:#1d4ed8;background:#dbeafe';
      badge.textContent = 'LOADING…';
    }
  }


  // ══════════════════════════════════════════════════════════════════════════
  //  TALENT PROFILES MODULE  —  NJTC Central Team Portal
  //  SY 2025-2026 | Architecture: Static historical snapshot + live overlay
  //
  //  DATA ARCHITECTURE:
  //    LAYER 1 — Static snapshot (embedded at deploy time)
  //              HR CSVs: Master List + Employee Profile + Terminations
  //              Source of truth for historical data (22-23 → 24-25)
  //              Never changes without a redeploy — "snapshot in time"
  //
  //    LAYER 2 — Live HR sheet (published 2PACX CSV, auto-refreshed)
  //              Master List tab: current SY roster, active/terminated,
  //              cycles, role, site. Overlays names + status for 25-26.
  //
  //    LAYER 3 — Live Pearl Ops data (already loaded in po module)
  //              Tutor attendance, scholar counts from operational data.
  //              Joined by normalized name at render time.
  //
  //    LAYER 4 — Live Program Concerns (already loaded in CONCERNS array)
  //              Concern counts, HR actions joined by employee name.
  //
  //    LAYER 5 — Live Site Leader Observations (future: add obs sheet URL)
  //              Observation counts per employee.
  //
  //  FUZZY MATCHING: normalize name → strip punctuation, remove single-char
  //  middle initials, sort tokens. Sharon K Kessel == Sharon Kessel.
  //  Micalea Wilkerson ~= Caela Wilkerson (subset match).
  //
  //  ROLE GATES:
  //    kb          → Org health KPIs only (exec 30-second view)
  //    leadership  → Chief of Staff view: tier dist, retention, risk flags
  //    hr / data   → Full ADP-style profiles: search, filter, modal detail
  //    finance     → Attendance risk + no-rehire pipeline (cost/continuity)
  //    programming → Concerns tab only (profile tab hidden)
  //    training    → Concerns tab only (profile tab hidden)
  // ══════════════════════════════════════════════════════════════════════════

  // ── HR Sheet live config ──────────────────────────────────────────────────
  // ── HTML escape helper for HR module (scoped to outer IIFE) ──────
  const esc = s => String(s == null ? '' : s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#39;');

  const HR_2PACX  = '2PACX-1vRc-Air9jhOtvkVelwfvOguzAyFmGIFpQ0sDtu4q8S5kFAgQz_IZo-XBeIfQgy4GB8OdSXoyonTeLT8';
  const HR_GID_MASTER = '911694457';  // Master List tab
  const HR_CACHE_KEY  = 'njtc_hr_live_v2';
  const HR_TTL_MS     = 10 * 60 * 1000;  // 10-min cache — live changes visible within 10 min

  // ── Onsite Tracker — Summer 2026 → SY 2026-2027 rollover ─────────────────
  // "Automated: Onsite 26-27 Tracker" — the roster + terminations source for the next school
  // year, replacing the 2025-2026 Master List once SY 2026-2027 begins. Unlike the Master List,
  // this tracker records a real hire date ("Offer Accepted") per person, so — unlike last
  // year — cycle retention here can be fully computed live (active ÷ everyone who was ever on
  // that cycle's roster); no manual quarterly entry table is needed. HR (Mysti Diaz) maintains
  // both tabs directly in the Google Sheet; the portal only ever reads them, so her edits are
  // visible to everyone on next load and never disappear on refresh.
  // Using the sheet ID + /export?format=csv (same pattern as _WR_HISTORY_URL below) instead of
  // a "publish to web" 2PACX ID — the 2PACX string mixes visually-identical characters (I/l)
  // that don't survive being read off a screenshot, and a single wrong character there fails
  // silently ("file does not exist") with no way to tell it apart from a real outage.
  const ONSITE_SHEET_ID   = '1x3dWZQhx9XWqB8YASInOMTr0JDjSRMqv3w7PmcruuMU';
  const ONSITE_GID_ROSTER = '0';          // "Onsite Tracker" tab — active/onboarding roster
  const ONSITE_GID_TERM   = '1788942666'; // Terminations tab
  const ONSITE_CACHE_KEY  = 'njtc_onsite_live_v1';
  const ONSITE_TTL_MS     = 10 * 60 * 1000;
  let _onsiteStatus = 'pending';

  // ── Site Leader Observations — Apprenticeship Program Database ───────────
  // NE tab gid=1649286205 · SW tab gid=373912327
  // Same sheet as apprenticeship OTJ — direct export URL (sheet shared with anyone)
  const OBS_SHEET_ID  = '1IZSYmLgMddPtn5Ei9mehqTWJAbpcm5Tx1GL-YytLj0k';
  const OBS_SL_GID    = '63958401';    // Onsite Monthly Site Leader Reviews (combined)
  const OBS_CACHE_KEY = 'njtc_obs_live_v1';
  const OBS_TTL_MS    = 60 * 60 * 1000;  // 1-hour cache
  let   _obsRows      = [];
  let   _obsFetched   = false;

  // ── Hiring Decision Store ─────────────────────────────────────────────────
  // Records persist in localStorage keyed by employee ID; visible to HR + Data only.
  // ── Hiring Decision Store + Google Form write-through ────────────────────
  // Google Form entry IDs — must match the form fields exactly
  const HIRING_FORM_ENTRIES = {
    dateYear:  'entry.939632120_year',
    dateMonth: 'entry.939632120_month',
    dateDay:   'entry.939632120_day',
    empName:   'entry.491781665',
    location:  'entry.1942615159',
    decision:  'entry.834835718',
    rationale: 'entry.2017090049',
    decidedBy: 'entry.778195494',
  };
  // Google Sheet (published CSV) — for reading historical decisions
  const HIRING_SHEET_2PACX = '2PACX-1vRRtGvwqKiDtvUdoU6tf3u_Rqlyd84co09ULwzgCTGeHEOBVLoYQKPdQf57HM_kgZEpeY1fc7V8cRQp';
  const HIRING_SHEET_GID   = '786776521';
  // Google Form action URL — get from your form's viewform link: replace /viewform with /formResponse
  // Share your form → Copy link (1FAIpQLSe...) → paste here as the FORM_ID segment
  const HIRING_FORM_ID = '1FAIpQLScg2aTj4-GwyDQHvms5Cwkuf03JpaRWkXHWl5gzfoXClsyAIg';

  const HIRING_KEY = 'njtc_hiring_decisions_v2';
  let _hiringSheetCache = null;  // cached sheet rows to merge into file cabinet

  function _hiringLoad()  { try { return JSON.parse(localStorage.getItem(HIRING_KEY)||'[]'); } catch(e) { return []; } }
  function _hiringSave(r) { try { localStorage.setItem(HIRING_KEY, JSON.stringify(r)); } catch(e) {} }
  function _hiringGet(ek) { return _hiringLoad().filter(r => r.ek === ek); }

  // Submit the decision to the Google Form (fire-and-forget, no-cors)
  function _hiringSubmitToForm(rec, empSite) {
    if (!HIRING_FORM_ID) return;
    try {
      const now = new Date();
      const p = new URLSearchParams();
      p.append(HIRING_FORM_ENTRIES.dateYear,  now.getFullYear());
      p.append(HIRING_FORM_ENTRIES.dateMonth, now.getMonth() + 1);
      p.append(HIRING_FORM_ENTRIES.dateDay,   now.getDate());
      p.append(HIRING_FORM_ENTRIES.empName,   rec.en || '');
      p.append(HIRING_FORM_ENTRIES.location,  empSite || '');
      p.append(HIRING_FORM_ENTRIES.decision,  rec.d  || '');
      p.append(HIRING_FORM_ENTRIES.rationale, rec.n  || '');
      p.append(HIRING_FORM_ENTRIES.decidedBy, rec.by || '');
      fetch(`https://docs.google.com/forms/d/e/${HIRING_FORM_ID}/formResponse`,
            { method: 'POST', body: p, mode: 'no-cors' })
        .then(() => console.log('[Hiring] Form response submitted for', rec.en))
        .catch(e => console.warn('[Hiring] Form submit failed:', e.message));
    } catch(e) { console.warn('[Hiring] Form submit error:', e.message); }
  }

  // Parse simple CSV — handles double-quoted fields with embedded commas/newlines
  function _parseHiringCSVLine(line) {
    const out = []; let cur = ''; let inQ = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"' && !inQ) { inQ = true; }
      else if (c === '"' && inQ) { if (line[i+1]==='"') { cur+='"'; i++; } else inQ=false; }
      else if (c === ',' && !inQ) { out.push(cur); cur=''; }
      else cur += c;
    }
    out.push(cur); return out;
  }

  // Fetch and parse historical decisions from the Google Sheet
  async function _hiringFetchSheet() {
    const url = `https://docs.google.com/spreadsheets/d/e/${HIRING_SHEET_2PACX}/pub?output=csv&gid=${HIRING_SHEET_GID}`;
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
      if (!res.ok) return [];
      const text = await res.text();
      const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
      if (lines.length < 2) return [];
      // Column order from form: Timestamp | Date | Employee Name | Location | Decision | Rationale | Decided By
      return lines.slice(1).map(line => {
        const c = _parseHiringCSVLine(line);
        return { ts: c[0]||'', en: c[2]||'', loc: c[3]||'', d: c[4]||'', n: c[5]||'', by: c[6]||'', sy:'2025-2026', src:'sheet' };
      }).filter(r => r.en && r.d);
    } catch(e) { return []; }
  }

  const _H_COLOR = {'Invite Back':'#065f46','Do Not Rehire':'#b91c1c','Conditional':'#d97706','Hold':'#1e40af'};
  const _H_BG    = {'Invite Back':'#d1fae5','Do Not Rehire':'#fee2e2','Conditional':'#fef3c7','Hold':'#dbeafe'};

  function _hiringRecordsHtml(ek) {
    const recs = _hiringGet(ek).sort((a,b) => b.ts.localeCompare(a.ts));
    const e2 = s => (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    if (!recs.length) return '<div style="font-size:.75rem;color:var(--muted);padding:.375rem 0">No decisions on record yet.</div>';
    return recs.map(r => `<div style="margin-bottom:.5rem;padding:.5rem .625rem;background:#fff;border:1px solid var(--border);border-radius:8px">
  <div style="display:flex;align-items:center;gap:.4rem;flex-wrap:wrap;margin-bottom:${r.n?'.25rem':'0'}">
    <span style="padding:.15rem .5rem;border-radius:20px;font-size:.72rem;font-weight:700;background:${_H_BG[r.d]||'#f3f4f6'};color:${_H_COLOR[r.d]||'#374151'}">${e2(r.d)}</span>
    <span style="font-size:.63rem;color:var(--muted)">SY ${e2(r.sy||'—')} · ${e2((r.ts||'').slice(0,10))} · ${e2(r.by||'—')} (${e2(r.role||'—')})</span>
  </div>
  ${r.n?`<div style="font-size:.75rem;color:var(--navy);line-height:1.5;margin-top:.1rem">${e2(r.n)}</div>`:''}
</div>`).join('');
  }

  // ── Academic data overlay (from irlab) ──────────────────────────────
  // Pulled at render time from irlab.getTutorAcademicData() — no extra fetch needed

  let _hrStatus  = 'embedded';   // 'embedded' | 'live' | 'error'
  let _hrFetched = false;
  // Year-indexed race/ethnicity stats built from live HR sheet rows (for YoY trend)
  // Structure: { '2025-2026': { total, withRace, nonWhite, hispanic, withEth, raceMap, ethMap }, ... }
  let _hrRaceByYear = {};

  // ── Central Team Staff — Race & Ethnicity ─────────────────────────────────
  // Hardcoded values are from confirmed staff self-identification on file.
  // Rene Lintz, Ashley Petty, and Tierney Tittermary have race on file in the
  // HR Master List (Google Sheet) — their values are fetched via live overlay.
  // Jessica Kelly retired from role March 5, 2026 (SY 25-26); replaced by Scott Oswald.
  const CENTRAL_TEAM_STAFF = [
    { n: 'Andrea Brooks',      _race: 'Two or More Races',          _ethnicity: '',                   s: 'Active'  },
    { n: 'Tierney Tittermary', _race: '',                           _ethnicity: '',                   s: 'Active'  },
    { n: 'Rene Lintz',        _race: '',                           _ethnicity: '',                   s: 'Active'  },
    { n: 'Jessica Kelly',      _race: '',                           _ethnicity: '',                   s: 'Retired', _retiredDate: 'March 5, 2026', _retiredNote: 'Retired end of SY 25-26; role transitioned to Scott Oswald' },
    { n: 'Scott Oswald',       _race: '',                           _ethnicity: '',                   s: 'Active',  _note: 'Replaced Jessica Kelly as of March 5, 2026' },
    { n: 'Taneisha Clemons',   _race: 'Black or African American',  _ethnicity: '',                   s: 'Active'  },
    { n: 'Jenny Irwin',        _race: 'Asian',                      _ethnicity: '',                   s: 'Active'  },
    { n: 'Anne Lee',           _race: 'Asian',                      _ethnicity: '',                   s: 'Active'  },
    { n: 'Katherine Bassett',  _race: 'White',                      _ethnicity: '',                   s: 'Active'  },
    { n: 'Ashley Bencan',      _race: 'White',                      _ethnicity: '',                   s: 'Active'  },
    { n: 'Bertin Lefcovick',   _race: 'White',                      _ethnicity: '',                   s: 'Active'  },
    { n: 'Amir Wallace',       _race: 'Black or African American',  _ethnicity: '',                   s: 'Active'  },
    { n: 'Ashley Petty',       _race: '',                           _ethnicity: '',                   s: 'Active'  },
    { n: 'Mariely Rodriguez',  _race: '',                           _ethnicity: 'Hispanic or Latino', s: 'Active'  },
    { n: 'Mysti Diaz',         _race: 'White',                      _ethnicity: '',                   s: 'Active'  },
    { n: 'Dalitza Sanchez',    _race: '',                           _ethnicity: 'Hispanic or Latino', s: 'Active'  },
  ];

  // ── Fuzzy name normalize ──────────────────────────────────────────────────
  function _hn(name) {
    return (name || '')
      .replace(/\s*-\s*sub\b/gi, '')            // strip "-SUB" suffix (Pearl sub-tutors)
      .replace(/\s*-\s*sub$/gi, '')
      .replace(/\([^)]*\)/g, '')                 // strip parenthetical nicknames: (Mary Carmen)
      .replace(/\s*-\s*(sub|pilot only)\b/gi,'') // strip other Pearl suffixes
      .toLowerCase()
      .replace(/-/g, ' ')                        // treat hyphens as word separators (e.g. Ramsey-Copeland)
      .replace(/[^a-z ]/g, '')                   // keep only letters+spaces
      .split(' ')
      .filter(p => p.length > 1)
      .sort()
      .join(' ');
  }

  // ── Live HR CSV parser (master list tab) ─────────────────────────────────
  function _parseHRMaster(text) {
    const rows = [];
    let row = [], cur = '', inQ = false, esc2 = false;
    for (const ch of text.replace(/\r\n/g,'\n').replace(/\r/g,'\n') + '\n') {
      if (esc2)  { esc2 = false; cur += ch; continue; }
      if (ch === '\\' && inQ) { esc2 = true; continue; }
      if (inQ) {
        if (ch === '"' ) inQ = false; else cur += ch;
      } else {
        if      (ch === '"') inQ = true;
        else if (ch === ',') { row.push(cur); cur = ''; }
        else if (ch === '\n') { row.push(cur); if (row.some(c=>c)) rows.push(row); row = []; cur = ''; }
        else cur += ch;
      }
    }
    // Parse header
    const hIdx = rows.findIndex(r => (r[0]||'').toLowerCase().includes('academic'));
    if (hIdx < 0) return [];
    const H = rows[hIdx].map(h => h.trim().toLowerCase());
    const ci = s => H.findIndex(h => h.includes(s.toLowerCase()));
    // Multi-keyword column finder — tries each alias in order, returns first match
    const ciAny = (...aliases) => { for (const a of aliases) { const i = H.findIndex(h => h.includes(a.toLowerCase())); if (i >= 0) return i; } return -1; };
    const C  = {
      yr: ci('academic'), email: ci('email'), name: ci('full name'),
      role: ci('position'), site: ci('site'), district: ci('district'),
      rehire: ci('rehire'), cycles: ci('cycles'), status: ci('terminated'),
      race: ci('race'), ethnicity: ci('ethnicity'),
      // Optional alias for Pearl login name — fill in HR sheet when HR name ≠ Pearl name
      pearlName: ciAny('pearl name', 'pearl login', 'also known as', 'preferred name', 'aka'),
      // Column K in HR Master List — header may be "Apprentice", "Apprentice (TAP)", "DOL Apprentice", etc.
      apprentice: ciAny('apprentice', 'apprenticeship'),
      // Termination detail fields — try multiple header aliases, then positional fallback (N=13, O=14, P=15)
      termDate:   ciAny('termination date', 'term date', 'date of term', 'separation date', 'end date'),
      termReason: ciAny('reason category', 'term reason', 'reason for', 'separation reason', 'exit reason'),
      termType:   ciAny('termination type', 'term type', 'separation type', 'exit type', 'voluntary'),
    };
    return rows.slice(hIdx + 1)
      .map(r => ({
        yr:         (r[C.yr]          ||'').trim(),
        name:       (r[C.name]        ||'').trim(),
        email:      (r[C.email]       ||'').trim().toLowerCase(),
        role:       (r[C.role]        ||'').trim(),
        site:       (r[C.site]        ||'').trim(),
        district:   (r[C.district]    ||'').trim(),
        status:     (r[C.status]      ||'').trim(),
        cycles:     (r[C.cycles]      ||'').trim(),
        rehire:     (r[C.rehire]      ||'').trim(),
        pearlName:  C.pearlName >= 0 ? (r[C.pearlName]||'').trim() : '',
        race:       C.race       >= 0 ? (r[C.race]       ||'').trim() : '',
        ethnicity:  C.ethnicity  >= 0 ? (r[C.ethnicity]  ||'').trim() : '',
        // Apprentice indicator from col K — positional fallback at index 10
        apprentice: C.apprentice >= 0 ? (r[C.apprentice] ||'').trim() : (r[10] ? (r[10]||'').trim() : ''),
        // Termination detail: header lookup with positional fallback at cols N(13), O(14), P(15)
        termDate:   C.termDate   >= 0 ? (r[C.termDate]   ||'').trim() : (r[13]||'').trim(),
        termReason: C.termReason >= 0 ? (r[C.termReason] ||'').trim() : (r[14]||'').trim(),
        termType:   C.termType   >= 0 ? (r[C.termType]   ||'').trim() : (r[15]||'').trim(),
      }))
      .map(r => {
        // If yr field is blank but a termination date exists, infer the academic year
        // (handles rows where the Academic Year column was left empty)
        if (!r.yr && r.termDate) {
          const td = new Date(r.termDate);
          if (!isNaN(td.getTime())) {
            const m = td.getMonth() + 1, y = td.getFullYear();
            r.yr = m >= 9 ? `${y}-${y+1}` : `${y-1}-${y}`;
          }
        }
        return r;
      })
      .filter(r => r.name && r.yr);
  }

  // ── Generic CSV tokenizer (quoted multiline cells) — shared by the Onsite Tracker parsers ──
  function _csvRowsGeneric(text) {
    const rows = [];
    let row = [], cur = '', inQ = false, esc2 = false;
    for (const ch of text.replace(/\r\n/g,'\n').replace(/\r/g,'\n') + '\n') {
      if (esc2)  { esc2 = false; cur += ch; continue; }
      if (ch === '\\' && inQ) { esc2 = true; continue; }
      if (inQ) {
        if (ch === '"' ) inQ = false; else cur += ch;
      } else {
        if      (ch === '"') inQ = true;
        else if (ch === ',') { row.push(cur); cur = ''; }
        else if (ch === '\n') { row.push(cur); if (row.some(c=>c)) rows.push(row); row = []; cur = ''; }
        else cur += ch;
      }
    }
    if (cur || row.length) { row.push(cur); if (row.some(c=>c)) rows.push(row); }
    return rows;
  }

  // ── Live Onsite Tracker parser — "Onsite Tracker" tab (active/onboarding roster) ────────
  // Terminated staff are removed from this tab (verified against the 2026-2027 termination
  // export — none of its rows overlap this roster), so every row here is an active person.
  // Includes a real hire date ("Offer Accepted") per person, unlike the 2025-2026 Master List.
  function _parseOnsiteRoster(text) {
    const rows = _csvRowsGeneric(text);
    const hIdx = rows.findIndex(r => (r[0]||'').trim().toLowerCase() === 'cycle');
    if (hIdx < 0) return [];
    const H = rows[hIdx].map(h => (h||'').trim().toLowerCase());
    const ci = s => H.findIndex(h => h.includes(s.toLowerCase()));
    const C = {
      cycle: ci('cycle'), role: ci('role'), county: ci('county'), district: ci('district'),
      first: ci('first name'), last: ci('last name'), email: ci('email'),
      offerAccepted: ci('offer accepted'),
      terminated:    H.findIndex(h => h === 'terminated?'),
      resignType:    ci('resignation type'),
      resignReason:  ci('resignation reason'),
      termDate:      H.findIndex(h => h === 'termination date'),
    };
    return rows.slice(hIdx + 1)
      .map(r => ({
        cycle:         (r[C.cycle]         || '').trim(),
        role:          (r[C.role]          || '').trim(),
        county:        (r[C.county]        || '').trim(),
        district:      (r[C.district]      || '').trim(),
        // Built from First + Last directly — the sheet's own "Full Name" column is a formula
        // bug (concatenates Source + First Name, e.g. "Rehire Angel" instead of "Angel Blue").
        name:          `${r[C.first]||''} ${r[C.last]||''}`.trim(),
        email:         (r[C.email]         || '').trim().toLowerCase(),
        offerAccepted: (r[C.offerAccepted] || '').trim(),
        terminated:    C.terminated   >= 0 ? (r[C.terminated]   || '').trim() : '',
        resignType:    C.resignType   >= 0 ? (r[C.resignType]   || '').trim() : '',
        resignReason:  C.resignReason >= 0 ? (r[C.resignReason] || '').trim() : '',
        termDate:      C.termDate     >= 0 ? (r[C.termDate]     || '').trim() : '',
      }))
      .filter(r => r.name && r.cycle);
  }

  // ── Live Onsite Tracker parser — Terminations tab ────────────────────────────────────────
  // Same column layout as the 2025-2026 termination tracker Mysti emailed (Termination Date /
  // Quarter / Reason Category), just scoped to the new "Automated: Onsite 26-27 Tracker" sheet.
  // "Termination Quarter" holds the cycle name directly this year (e.g. "Summer 2026") rather
  // than a Q1-Q4 label, since HR is now tracking by named hiring cycle instead of school-year
  // quarter.
  function _parseOnsiteTerminations(text) {
    const rows = _csvRowsGeneric(text);
    const hIdx = rows.findIndex(r => (r[0]||'').trim().toLowerCase() === 'cycle');
    if (hIdx < 0) return [];
    const H = rows[hIdx].map(h => (h||'').trim().toLowerCase());
    const ci = s => H.findIndex(h => h.includes(s.toLowerCase()));
    const C = {
      cycle: ci('cycle'), first: ci('first name'), last: ci('last name'), email: ci('email'),
      termDate: ci('termination date'), termQuarter: ci('termination quarter'),
      termReason: ci('termination reason'), comments: ci('comments'),
    };
    return rows.slice(hIdx + 1)
      .map(r => ({
        cycle:      ((r[C.cycle]||'').trim() || (r[C.termQuarter]||'').trim()),
        name:       `${(r[C.first]||'').trim()} ${(r[C.last]||'').trim()}`.trim(),
        email:      (r[C.email]      || '').trim().toLowerCase(),
        termDate:   (r[C.termDate]   || '').trim(),
        termReason: (r[C.termReason] || '').trim(),
        // Type isn't a separate column here — same convention as last year's tracker, reason
        // text always starts with "Voluntary"/"Involuntary" so the type is derived from it.
        termType:   /^involuntary/i.test((r[C.termReason]||'').trim()) ? 'Involuntary'
                  : /^voluntary/i.test((r[C.termReason]||'').trim())   ? 'Voluntary' : '',
        comments:   (r[C.comments]   || '').trim(),
      }))
      .filter(r => r.name);
  }

  async function fetchLiveOnsiteData(force=false) {
    if (!force) {
      try {
        const c = JSON.parse(localStorage.getItem(ONSITE_CACHE_KEY)||'null');
        if (c && c.ts && (Date.now()-c.ts) < ONSITE_TTL_MS && c.rosterOk && c.termsOk) {
          window._njtcOnsiteRoster2627 = c.roster || [];
          window._njtcOnsiteTerms2627  = c.terms  || [];
          window._onsiteRosterOk       = true;
          window._onsiteTermsOk        = true;
          window._onsiteDataFetched    = true;
          _onsiteStatus = 'live';
          _reRenderOnsiteWidget();
          return;
        }
      } catch(e) {}
    }
    const bust = force ? '&t='+Date.now() : '';
    const rosterUrl = `https://docs.google.com/spreadsheets/d/${ONSITE_SHEET_ID}/export?format=csv&gid=${ONSITE_GID_ROSTER}${bust}`;
    const termUrl   = `https://docs.google.com/spreadsheets/d/${ONSITE_SHEET_ID}/export?format=csv&gid=${ONSITE_GID_TERM}${bust}`;

    // Fetch + parse each tab independently (not Promise.all on the raw fetches) — a failure on
    // one sheet must never wipe out data we already got from the other. `ok` reflects whether
    // the HTTP request itself succeeded — a legitimately empty terminations sheet (no
    // departures yet) still counts as `ok`, so it isn't confused with a fetch/parse failure.
    async function _fetchOne(url, parseFn, label) {
      try {
        const res = await fetch(url, {signal: AbortSignal.timeout(10000)});
        if (!res.ok) { console.warn(`[Onsite Tracker] ${label} fetch returned ${res.status}`); return {ok:false, rows:[]}; }
        const text = await res.text();
        const rows = parseFn(text);
        if (rows.length === 0) console.warn(`[Onsite Tracker] ${label} fetch succeeded but parsed 0 rows (first 200 chars): `, text.slice(0,200));
        return {ok:true, rows};
      } catch(e) {
        console.warn(`[Onsite Tracker] ${label} fetch failed:`, e.message);
        return {ok:false, rows:[]};
      }
    }

    const [rosterRes, termsRes] = await Promise.all([
      _fetchOne(rosterUrl, _parseOnsiteRoster, 'Roster'),
      _fetchOne(termUrl,   _parseOnsiteTerminations, 'Terminations'),
    ]);

    window._onsiteRosterOk = rosterRes.ok;
    window._onsiteTermsOk  = termsRes.ok;

    if (rosterRes.ok || termsRes.ok) {
      if (rosterRes.ok) window._njtcOnsiteRoster2627 = rosterRes.rows;
      if (termsRes.ok)  window._njtcOnsiteTerms2627  = termsRes.rows;
      if (rosterRes.ok && termsRes.ok) {
        try {
          localStorage.setItem(ONSITE_CACHE_KEY, JSON.stringify({
            ts:Date.now(), roster:rosterRes.rows, terms:termsRes.rows, rosterOk:true, termsOk:true,
          }));
        } catch(e){}
      }
      _onsiteStatus = 'live';
      console.log('[Onsite Tracker] Live sheets loaded: '+rosterRes.rows.length+' active ('+rosterRes.ok+'), '+termsRes.rows.length+' terminated ('+termsRes.ok+')');
    } else {
      _onsiteStatus = 'error';
    }
    window._onsiteDataFetched = true;
    _reRenderOnsiteWidget();
  }

  function _reRenderOnsiteWidget() {
    requestAnimationFrame(() => {
      try {
        const el = document.getElementById('onsiteRetentionWidget');
        if (el && typeof _buildOnsiteRetentionWidget === 'function') el.outerHTML = _buildOnsiteRetentionWidget();
      } catch(_e) {}
    });
  }

  // ── Overlay live master data onto HR_EMPS ────────────────────────────────
    // Track keys already added via live overlay to prevent duplicates on re-render
  const _hrLiveAddedKeys = new Set();

  function _hrOverlayLive(liveRows) {
    // ── Known Master List data-quality corrections (2025-2026), verified against HR's
    // termination tracker (Mysti Diaz, Aug 2026) — fixed here rather than in the source sheet:
    //   1. "Michael Alessio" is a duplicate row that copy-pasted Aleah McWilliams' email,
    //      termination date, and reason. No such person exists in the termination tracker,
    //      so it's dropped to avoid double-counting terminations (73 → 72).
    //   2. "Nicole Odigie" is miscategorized here as "Voluntary - other"; the termination
    //      tracker has her correctly as "Voluntary - found full time employment".
    liveRows = liveRows.filter(r => !(
      (r.name  || '').trim().toLowerCase() === 'michael alessio' &&
      (r.email || '').trim().toLowerCase() === 'mcwilliams.aleah@gmail.com'
    ));
    liveRows.forEach(r => {
      if ((r.name || '').trim().toLowerCase() === 'nicole odigie' &&
          (r.email || '').trim().toLowerCase() === 'nicknax79@gmail.com') {
        r.termReason = 'Voluntary - found full time employment';
      }
    });

    // ── Reset HR_EMPS to clean base (removes prior-session push()-added entries) ──
    if (HR_EMPS.length > window._HR_BASE_LEN) {
      HR_EMPS.splice(window._HR_BASE_LEN);  // truncate back to embedded snapshot
    }
    _hrLiveAddedKeys.clear();  // allow re-evaluation of new hires

    // Pre-build _hn() keyed set of canonical apprentice names for supplementary flagging
    const _apprHnSet = new Set();
    if (window._njtcAllApprenticeNames) {
      for (const n of window._njtcAllApprenticeNames) _apprHnSet.add(_hn(n));
    }

    // Group live rows by normalized name key
    const byKey = {};
    for (const r of liveRows) {
      const k = _hn(r.name);
      if (!byKey[k]) byKey[k] = [];
      byKey[k].push(r);
    }

    // Pre-build inverted token index for O(1) fuzzy fallback lookup
    // Maps each token → array of [lk, rows] so we only check keys sharing ≥1 token
    const _tokenIdx = new Map();
    for (const [lk, lr] of Object.entries(byKey)) {
      for (const tok of lk.split(' ')) {
        if (!_tokenIdx.has(tok)) _tokenIdx.set(tok, []);
        _tokenIdx.get(tok).push([lk, lr]);
      }
    }

    let updated = 0, added = 0;

    // ── Update existing HR_EMPS entries from live sheet ─────────────────────
    for (const emp of HR_EMPS) {
      const k = _hn(emp.n);
      const rows = byKey[k] || [];
      if (!rows.length) {
        // Subset token match fallback — use pre-built index (O(tokens) vs O(n²))
        const ep = new Set(k.split(' '));
        if (ep.size >= 2) {
          const seen = new Set();
          outer: for (const tok of ep) {
            for (const [lk, lr] of (_tokenIdx.get(tok) || [])) {
              if (seen.has(lk)) continue;
              seen.add(lk);
              const lp = new Set(lk.split(' '));
              if ([...ep].every(p=>lp.has(p)) || [...lp].every(p=>ep.has(p))) {
                rows.push(...lr); break outer;
              }
            }
          }
        }
      }
      if (!rows.length) continue;
      // Use the CURRENT SY row if available, else most recent
      const curSYRows = rows.filter(r => r.yr === '2025-2026');
      const latest = (curSYRows.length ? curSYRows : rows).sort((a,b)=>b.yr.localeCompare(a.yr))[0];
      // Live sheet is source of truth — overwrite all fields
      if (latest.name)      emp.n          = latest.name;
      if (latest.role)      emp.r          = latest.role;
      if (latest.site)      emp.si         = latest.site.slice(0,45);
      if (latest.district)  emp.di         = latest.district.slice(0,45);
      if (latest.status)    emp.s          = latest.status;
      if (latest.rehire)    emp.rh         = latest.rehire;
      if (latest.email)     emp.e          = latest.email;
      if (latest.race)        emp._race        = latest.race;
      if (latest.ethnicity)   emp._ethnicity   = latest.ethnicity;
      // Termination detail fields (cols N, O, P) — always write so empty clears stale values
      emp._termDate   = latest.termDate   || '';
      emp._termReason = latest.termReason || '';
      emp._termType   = latest.termType   || '';
      // Apprentice indicator from col K — flag if any current SY row is marked,
      // or if the employee's canonical name is in the ALL_APPRENTICES master list
      const anyApprent    = rows.some(r => r.yr === '2025-2026' && r.apprentice && /yes|y|true|1|active/i.test(r.apprentice));
      const inApprList    = _apprHnSet.size > 0 && _apprHnSet.has(_hn(emp.n));
      emp._apprentice = (anyApprent || inApprList) ? 'Yes' : (emp._apprentice || '');
      // Track all SYs this person has appeared in
      const allYrs = [...new Set(rows.map(r=>r.yr).filter(Boolean))].sort().reverse();
      emp.y = allYrs;
      emp._liveYears = allYrs;
      // Cycles = max across all SY rows
      const maxCyc = rows.reduce((m,r)=>Math.max(m,parseInt(r.cycles)||0),0);
      if (maxCyc > 0) emp.c = maxCyc;
      emp._live = true;
      // Store Pearl alias name from HR sheet column so _hrOverlayPearl()
      // can use it as the primary lookup key (e.g. "LaShanee Davis" → "Renee Davis")
      emp._pearlName = latest.pearlName || '';
      updated++;
    }

    // ── Flag stale embedded employees absent from live 2025-2026 sheet ─────────
    // If the live sheet loaded successfully and has 2025-2026 rows, any embedded
    // employee that (a) carries '2025-2026' in their static y[] but (b) wasn't
    // matched above should be hidden from the 2025-2026 view (e.g. Youngsoo Kim).
    const liveHas2526 = liveRows.some(r => r.yr === '2025-2026');
    if (liveHas2526) {
      for (const emp of HR_EMPS) {
        if (emp._live) {
          emp._notInLive2526 = false;  // confirmed in live sheet
        } else if ((emp.y || []).includes('2025-2026')) {
          emp._notInLive2526 = true;   // stale embed — not in current live roster
        }
      }
    }

    // ── Add NEW employees not yet tracked — current + immediately prior SY only ──
    // Includes 2024-2025 so terminated employees from last year (e.g. Mattelyn Bullock)
    // are visible in the inactive tab. Older SYs are excluded to avoid flooding the portal.
    const PRIOR_SY = '2024-2025';
    const embKeys = new Set(HR_EMPS.map(e => _hn(e.n)));
    const curByKey = {};
    for (const r of liveRows) {
      if (r.yr !== '2025-2026' && r.yr !== PRIOR_SY) continue;
      const k = _hn(r.name);
      if (!curByKey[k]) curByKey[k] = [];
      curByKey[k].push(r);
    }

    for (const [k, rows] of Object.entries(curByKey)) {
      // Skip if already in embedded data
      if (embKeys.has(k)) continue;
      // Skip if already added this session (prevent double-add on re-render)
      if (_hrLiveAddedKeys.has(k)) continue;
      // Skip if fuzzy match exists in embedded
      let found = false;
      const kp = new Set(k.split(' '));
      for (const ek of embKeys) {
        const ep = new Set(ek.split(' '));
        if (kp.size >= 2 && ([...kp].every(p=>ep.has(p)) || [...ep].every(p=>kp.has(p)))) {
          found = true; break;
        }
      }
      if (found) continue;
      const latest = rows.sort((a,b)=>b.yr.localeCompare(a.yr))[0];
      if (!latest.name) continue; // skip rows with no name
      // Infer status: use sheet value if present; otherwise default to Active (blank = still employed),
      // or Terminated if a termination date is populated
      const inferredStatus = latest.status || (latest.termDate ? 'Terminated' : 'Active');
      HR_EMPS.push({
        n: latest.name, a:[], e: latest.email||'',
        y: [latest.yr||'2025-2026'],
        c: rows.reduce((m,r)=>Math.max(m,parseInt(r.cycles)||0),1),
        r: latest.role||'', rs:[], si: (latest.site||'').slice(0,45), sis:[latest.site||''],
        di: (latest.district||'').slice(0,45), dis:[], s: inferredStatus, t:'incomplete',
        mp:null, py:'', am:null, em:null, lm:null, acm:null,
        pi:null, pr:null, p2:null, att:null, je:null, jl:null,
        rh: latest.rehire||null, re:null, co:0, ct:'', cd:'', hn:'', tr:null, ty:'',
        _race: latest.race||null, _ethnicity: latest.ethnicity||null,
        _apprentice: ((latest.apprentice && /yes|y|true|1|active/i.test(latest.apprentice)) || (_apprHnSet.size > 0 && _apprHnSet.has(k))) ? 'Yes' : '',
        _termDate: latest.termDate||'', _termReason: latest.termReason||'', _termType: latest.termType||'',
        _live:true, _liveYears:['2025-2026'],
      });
      _hrLiveAddedKeys.add(k);
      added++;
    }
    // ── Build year-indexed race/ethnicity stats from all raw live rows ──────────
    // Deduplicate by name within each year so each person counts once per SY.
    const _rByYr = {};
    const _seen  = {};  // 'yr|normalizedName' dedup key
    for (const r of liveRows) {
      if (!r.yr || !r.name) continue;
      const _dk = r.yr + '|' + _hn(r.name);
      if (_seen[_dk]) continue;
      _seen[_dk] = true;
      if (!_rByYr[r.yr]) _rByYr[r.yr] = { total:0, withRace:0, nonWhite:0, hispanic:0, withEth:0, raceMap:{}, ethMap:{} };
      const y = _rByYr[r.yr];
      y.total++;
      const rc = (r.race||'').trim();
      const et = (r.ethnicity||'').trim();
      if (rc && !/not listed|prefer not/i.test(rc)) {
        y.withRace++;
        y.raceMap[rc] = (y.raceMap[rc]||0)+1;
        if (rc.toLowerCase() !== 'white') y.nonWhite++;
      }
      if (et && !/not listed|prefer not/i.test(et)) {
        y.withEth++;
        y.ethMap[et] = (y.ethMap[et]||0)+1;
        if (/hispanic|latino/i.test(et)) y.hispanic++;
      }
    }
    _hrRaceByYear = _rByYr;

    // Raw apprentice count + race breakdown from col K — deduped by name, no HR_EMPS matching needed
    const _rawApprSet  = new Set();
    const _apprRaceMap = {};
    const _apprEthMap  = {};
    let _apprNonWhite = 0, _apprHisp = 0, _apprWithRace = 0, _apprWithEth = 0;
    for (const r of liveRows) {
      if (r.yr !== '2025-2026' || !r.apprentice || !/yes|y|true|1|active/i.test(r.apprentice) || !r.name) continue;
      const nk = _hn(r.name);
      if (_rawApprSet.has(nk)) continue;  // deduplicate
      _rawApprSet.add(nk);
      const rc = (r.race||'').trim();
      const et = (r.ethnicity||'').trim();
      if (rc && !/not listed|prefer not/i.test(rc)) {
        _apprWithRace++;
        _apprRaceMap[rc] = (_apprRaceMap[rc]||0) + 1;
        if (rc.toLowerCase() !== 'white') _apprNonWhite++;
      }
      if (et && !/not listed|prefer not/i.test(et)) {
        _apprWithEth++;
        if (/hispanic|latino/i.test(et)) _apprHisp++;
      }
    }
    window._liveApprenticeCount    = _rawApprSet.size;
    window._liveApprenticeRaceData = {
      total:        _rawApprSet.size,
      withRace:     _apprWithRace,
      nonWhite:     _apprNonWhite,
      nonWhitePct:  _apprWithRace ? Math.round(_apprNonWhite / _apprWithRace * 100) : null,
      hispanic:     _apprHisp,
      withEth:      _apprWithEth,
      raceMap:      _apprRaceMap,
    };

    // Cache CY-terminated employees directly from live rows — used by attrition widget so
    // count and reasons come from the source of truth, not HR_EMPS name-matching
    const _liveTermCache = {};
    liveRows.forEach(r => {
      if (!r.name) return;
      // Accept common year formats: '2025-2026', '2025/2026', 'SY 2025-2026', etc.
      const normYr = (r.yr || '').replace(/\s/g, '');
      const isCY = normYr === '2025-2026' || /2025.{0,3}2026/.test(normYr);
      if (!isCY) return;
      // Terminated = status field is non-blank and not 'Active',
      // OR status is blank but termDate or termReason confirms separation
      const hasStatus = r.status && !/^active$/i.test(r.status.trim());
      const isTermByEvidence = !r.status && (r.termDate || r.termReason);
      if (!hasStatus && !isTermByEvidence) return;
      // Use exact lowercased name as key — _hn() sorts name parts alphabetically which
      // causes two different people (e.g. "Kim Park" / "Park Kim") to collide
      const k = r.name.trim().toLowerCase();
      if (!_liveTermCache[k]) _liveTermCache[k] = r;
    });
    window._njtcLiveTerminated2526 = Object.values(_liveTermCache);

    _hrInvalidateOverlay();  // signal that re-render needs fresh overlays
    console.log('[HR Profiles] Live overlay: updated='+updated+' added='+added+' (current SY only) · apprentices:', _rawApprSet.size, '· terminated:', window._njtcLiveTerminated2526.length);
  }

  // ── Overlay live Pearl Ops data onto HR_EMPS ─────────────────────────────
  // Called after po data loads. Joins by tutor name → updates att, scholar counts.

  // Hardcoded alias map for known HR↔Pearl name mismatches (preferred names,
  // nicknames, legal vs. display name). Key = _hn(HR name), value = Pearl display name.
  // Add new entries here when HR sheet "Pearl Name" column isn't an option.
  // Exposed as window._njtcPearlAliasMap so PIE can resolve aliases during queries.
  const _PEARL_ALIAS_MAP = {
    'davis la shanee':      'Renee Davis',       // La Shanee Davis (HR) = Renee Davis (Pearl)
    'davis lashanee':       'Renee Davis',       // alternate compact spelling
    'elizabeth mccafferty': 'Betsy McCafferty',  // Elizabeth McCafferty (HR) = Betsy McCafferty (Pearl)
  };
  window._njtcPearlAliasMap = _PEARL_ALIAS_MAP;

  function _hrOverlayPearl() {
    const _poReady = typeof po !== 'undefined' && po && typeof po.getTutorAttendanceMap === 'function';
    if (!_poReady) { console.warn('[HR Profiles] Pearl overlay skipped — po not ready'); return; }
    try {
      // getTutorAttendanceMap() reads live _personMap — current SY Pearl data only
      const tutorAttMap = po.getTutorAttendanceMap();
      console.log('[HR Profiles] Pearl overlay called — tutorAttMap size:', Object.keys(tutorAttMap||{}).length,
        '| surveyFn:', typeof po.getTutorSurveyScores, '| sessionFn:', typeof po.getTutorSessionStats);
      if (!tutorAttMap || !Object.keys(tutorAttMap).length) { console.warn('[HR Profiles] Pearl overlay skipped — empty tutorAttMap'); return; }

      // Pre-build survey and session maps keyed by _hn(pearlName) for O(1) lookup
      // once the attendance fuzzy-match has identified the canonical Pearl name.
      const survMap = {}, sessMap = {};
      try {
        if (po.getTutorSurveyScores) {
          po.getTutorSurveyScores().forEach(s => { survMap[_hn(s.name)] = s; });
        }
      } catch(e) { console.warn('[HR Profiles] Pearl survey pre-build error:', e); }
      try {
        if (po.getTutorSessionStats) {
          po.getTutorSessionStats().forEach(s => { sessMap[_hn(s.name)] = s; });
        }
      } catch(e) { console.warn('[HR Profiles] Pearl session pre-build error:', e); }

      let matched = 0;
      for (const emp of HR_EMPS) {
        const ek = _hn(emp.n);  // sorted token key for emp name
        const ep = new Set(ek.split(' '));

        // 0. Pearl alias resolution — in priority order:
        //    (a) HR sheet "Pearl Name" column (emp._pearlName set by _hrOverlayLive)
        //    (b) Hardcoded alias map for known nickname/legal-name mismatches
        const _pearlAlias = (emp._pearlName && emp._pearlName.trim())
          ? emp._pearlName.trim()
          : (_PEARL_ALIAS_MAP[ek] || null);
        let tutorData = _pearlAlias ? (tutorAttMap[_hn(_pearlAlias)] || null) : null;

        // 1. Exact _hn() key match on HR name
        if (!tutorData) tutorData = tutorAttMap[ek];

        if (!tutorData) {
          // Subset token match: every token in shorter name exists in longer
          for (const [pk, pd] of Object.entries(tutorAttMap)) {
            const kp = new Set(pk.split(' '));
            if (
              (ep.size >= 2 && [...ep].every(t => kp.has(t))) ||
              (kp.size >= 2 && [...kp].every(t => ep.has(t)))
            ) { tutorData = pd; break; }
          }
        }

        if (!tutorData) {
          // Nickname/suffix fallback: match on last name + first initial only
          const epArr = ek.split(' ');  // already sorted
          if (epArr.length >= 2) {
            const lastName = epArr[epArr.length - 1];
            const firstInit = epArr[0][0];
            for (const [pk, pd] of Object.entries(tutorAttMap)) {
              const pkArr = pk.split(' ');
              if (pkArr.includes(lastName) && pkArr.some(t => t[0] === firstInit)) {
                tutorData = pd; break;
              }
            }
          }
        }

        if (!tutorData) continue;

        // Write live Pearl current-SY attendance to employee record
        emp._liveAtt          = tutorData.attRate;
        emp._liveAttTotal     = tutorData.total;
        // Store the resolved Pearl display name so PIE can use it for direct lookups
        // without re-running alias resolution (critical for LaShanee→Renee, Elizabeth→Betsy)
        emp._resolvedPearlName = tutorData.name;
        matched++;

        // Use the matched Pearl name to do O(1) lookups for survey + session data.
        // This avoids re-running the fuzzy match for each additional data type.
        const pearlKey = _hn(tutorData.name);
        const survData = survMap[pearlKey] || null;
        const sessData = sessMap[pearlKey] || null;

        // Store full survey entry — used by buildCard() (compact grid) and
        // buildMetrics() fallback (programming view) for hyphenated-name cases.
        if (survData) emp._liveSurveyEntry = survData;

        // Store full session entry + schools array — used by buildCard() for
        // location display and by buildMetrics() fallback.
        if (sessData) {
          emp._liveSessEntry  = sessData;
          // Schools where this tutor ran ≥1 Pearl session this SY (active locations)
          emp._liveSchools    = (sessData.schools || []).filter(Boolean);
        }
      }
      console.log('[HR Profiles] Pearl overlay: matched', matched, 'of', Object.keys(tutorAttMap).length, 'instructors');
    } catch(e) { console.warn('[HR Profiles] Pearl overlay error:', e); }
  }

  // ── Overlay live Program Concerns onto HR_EMPS ────────────────────────────
  // CONCERNS array is already loaded by the Talent concerns fetch.
  function _hrOverlayConcerns() {
    if (!Array.isArray(CONCERNS) || !CONCERNS.length) return;
    // Reset live concern counts
    for (const emp of HR_EMPS) { emp._liveConcerns = 0; emp._liveHRAction = null; }
    for (const c of CONCERNS) {
      const empName = c.emp || '';
      if (!empName) continue;
      const k = _hn(empName);
      const emp = HR_EMPS.find(e => {
        const ek = _hn(e.n);
        if (ek === k) return true;
        const ep = new Set(ek.split(' ')), kp = new Set(k.split(' '));
        return [...ep].every(p=>kp.has(p)) || [...kp].every(p=>ep.has(p));
      });
      if (!emp) continue;
      emp._liveConcerns = (emp._liveConcerns || 0) + 1;
      // Keep most severe HR action
      const sev = ['Recommended Termination','PGP','First Write Up - Employee Progress Report','On Watch','Yes'];
      const cur = emp._liveHRAction || '';
      if (c.hr_action && sev.indexOf(c.hr_action) < sev.indexOf(cur)) {
        emp._liveHRAction = c.hr_action;
      }
    }
  }

  // ── Async live HR fetch ───────────────────────────────────────────────────
  // ── Fetch site leader observations (NE + SW) in parallel ────────────────
  async function fetchLiveObsData(force=false) {
    if (!force) {
      try {
        const c = JSON.parse(localStorage.getItem(OBS_CACHE_KEY)||'null');
        if (c && c.ts && (Date.now()-c.ts) < OBS_TTL_MS && c.rows && c.rows.length) {
          _obsRows = c.rows;
          _obsFetched = true;
          _hrOverlayObs();
          return;
        }
      } catch(e) {}
    }
    const bust = force ? '&t='+Date.now() : '';
    const slUrl = `https://docs.google.com/spreadsheets/d/${OBS_SHEET_ID}/export?format=csv&gid=${OBS_SL_GID}${bust}`;
    try {
      const combined = [];
      const slRes = await fetch(slUrl, {signal: AbortSignal.timeout(10000)}).catch(e => ({ ok: false, _err: e }));
      if (slRes.ok) {
        const rows = _parseObsSheet(await slRes.text(), 0);
        combined.push(...rows);
      } else if (slRes.status) {
        console.info('[Obs] Site Leader Reviews sheet HTTP ' + slRes.status + ' — ensure the sheet is shared ("Anyone with the link can view").');
      } else {
        console.info('[Obs] Site Leader Reviews fetch failed:', slRes._err?.message || 'network error');
      }
      if (!combined.length) return;
      _obsRows = combined;
      _obsFetched = true;
      try { localStorage.setItem(OBS_CACHE_KEY, JSON.stringify({ts:Date.now(),rows:combined})); } catch(e){}
      console.log('[HR Profiles] Site Leader Reviews loaded:', combined.length, 'records');
      _hrOverlayObs();
      // Re-render talent profiles if currently visible
      const _lb = document.getElementById('talentTab-profiles');
      if (_lb && _lb.classList.contains('active')) {
        const _le = document.getElementById('talentContent');
        if (_le) {
          try {
            const _vr = (typeof _hrOverlayVersion !== 'undefined') ? String(_hrOverlayVersion) : '0';
            _le.innerHTML = '<div id="hrProfilesRoot" data-overlay-version="'+_vr+'">' +
              _hrBuildProfiles((window.NJTC_SESSION||{}).dept||'hr') + '</div>';
          } catch(e) { /* non-critical */ }
        }
      }
    } catch(e) { console.warn('[HR Profiles] Obs fetch failed:', e.message); }
  }

  // ── Proper quoted-CSV row parser ─────────────────────────────────────────
  function _splitCsvRow(line) {
    const cols = []; let cur = '', inQ = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"' && !inQ) { inQ = true; continue; }
      if (ch === '"' && inQ)  { if (line[i+1] === '"') { cur += '"'; i++; } else inQ = false; continue; }
      if (ch === ',' && !inQ) { cols.push(cur.trim()); cur = ''; continue; }
      cur += ch;
    }
    cols.push(cur.trim());
    return cols;
  }

  // ── Parse observation sheet CSV ───────────────────────────────────────────
  // skipRows: number of rows before the header row (NE=1, SW=2)
  function _parseObsSheet(text, skipRows) {
    const lines = text.replace(/\r\n/g,'\n').replace(/\r/g,'\n').split('\n').filter(l=>l.trim());
    const sr = skipRows || 0;
    if (lines.length <= sr) return [];
    const header = _splitCsvRow(lines[sr]).map(h=>h.toLowerCase());
    // Flexible column getter — tries multiple aliases
    const g = (row, ...keys) => {
      for (const k of keys) {
        const i = header.findIndex(h => h.includes(k.toLowerCase()));
        if (i > -1) { const v = (row[i]||'').trim(); if (v) return v; }
      }
      return '';
    };
    return lines.slice(sr + 1).map(line => {
      const row = _splitCsvRow(line);
      const name = g(row, 'tutor name','instructor name','staff name','tutor','name','site leader');
      if (!name) return null;
      return {
        name,
        date:     g(row, 'observation date','date','month','observation month'),
        rating:   g(row, 'rating','score','overall rating','overall'),
        type:     g(row, 'observation type','visit type','type'),
        notes:    g(row, 'notes','comments','feedback'),
        observer: g(row, 'observer','submitted by','site leader','sl name'),
        site:     g(row, 'site','school','location'),
      };
    }).filter(Boolean);
  }

  // ── Academic data overlay from irlab tutorMap ─────────────────────
  function _hrOverlayAcademic() {
    if (typeof irlab === 'undefined' || !irlab || !irlab.getTutorAcademicData) return;
    try {
      const tutorMap = irlab.getTutorAcademicData();
      if (!tutorMap) return;
      let matched = 0;
      for (const [tutorName, td] of Object.entries(tutorMap)) {
        const k = _hn(tutorName);
        const emp = HR_EMPS.find(e => {
          const ek = _hn(e.n);
          if (ek === k) return true;
          // Fuzzy: every token in shorter name must appear in longer
          const ep = new Set(ek.split(' ')), kp = new Set(k.split(' '));
          return [...ep].every(p=>kp.has(p)) || [...kp].every(p=>ep.has(p));
        });
        if (!emp) continue;
        emp._acadScholars    = td.scholarCount   || 0;
        emp._acadPctMoved    = td.pctMoved       ?? null;   // % scholars improved placement
        emp._acadPctGL       = td.pctGL          ?? null;   // % on grade level at spring
        emp._acadAvgGain     = td.avgGain != null ? Math.round(td.avgGain * 10) / 10 : null;
        emp._acadMoved       = td.moved          || 0;
        emp._acadHeld        = td.held           || 0;
        emp._acadRegressed   = td.regressed      || 0;
        emp._acadCert        = td.cert           || '';
        emp._acadDistricts   = [...(td.districts||[])].filter(Boolean).join(', ');
        emp._acadYears       = [...(td.years||[])].filter(Boolean).sort().reverse().join(', ');
        emp._acadSubjects    = [...(td.subjects||[])].filter(Boolean).join(', ');
        // Year-over-year improvement: compare current live % moved vs prior SY %
        // If prior year data is absent, the metric is N/A (doesn't count against score)
        if (emp._acadPctMoved !== null && emp.pi !== null) {
          emp._acadImproveYoY = emp._acadPctMoved > emp.pi ? 'Yes' : 'No';
        } else if (emp._acadPctMoved !== null && emp.pi === null) {
          emp._acadImproveYoY = 'N/A'; // no baseline to compare — don't penalize
        } else {
          emp._acadImproveYoY = null;  // academic data not loaded
        }
        matched++;
      }
      console.log('[HR Profiles] Academic overlay matched:', matched, 'employees');
    } catch(e) { console.warn('[HR Profiles] Academic overlay error:', e); }
  }

  // ── Site leader observation overlay ──────────────────────────────
  function _hrOverlayObs() {
    if (!_obsRows.length) return;
    // Reset
    for (const emp of HR_EMPS) { emp._obsCount=0; emp._obsLatest=null; emp._obsRatings=[]; }
    for (const obs of _obsRows) {
      const k = _hn(obs.name);
      const emp = HR_EMPS.find(e => {
        const ek = _hn(e.n);
        if (ek===k) return true;
        const ep=new Set(ek.split(' ')), kp=new Set(k.split(' '));
        return [...ep].every(p=>kp.has(p)) || [...kp].every(p=>ep.has(p));
      });
      if (!emp) continue;
      emp._obsCount = (emp._obsCount||0) + 1;
      if (!emp._obsLatest || obs.date > emp._obsLatest.date) emp._obsLatest = obs;
      const r = parseFloat(obs.rating);
      if (!isNaN(r)) emp._obsRatings.push(r);
    }
    // Compute avg rating
    for (const emp of HR_EMPS) {
      emp._obsAvgRating = emp._obsRatings&&emp._obsRatings.length
        ? Math.round(emp._obsRatings.reduce((a,b)=>a+b,0)/emp._obsRatings.length*10)/10 : null;
    }
    console.log('[HR Profiles] Obs overlay applied');
  }

  // ── T&D observation overlay — maps OTJ observation sheet onto HR_EMPS ────────
  // window._njtcTutorObs is keyed by normalized name; each value is array of
  // {month, observed, missed, note, link} entries from the OTJ live sheet.
  function _hrOverlayTndObs() {
    const tnd = window._njtcTutorObs;
    if (!tnd) return;
    const normN = n => (n||'').toLowerCase().replace(/\s+/g,' ').trim();

    // Reverse index: normalized emp name → emp object
    const empByNorm = new Map();
    for (const emp of HR_EMPS) {
      empByNorm.set(normN(emp.n), emp);
    }

    // Three-tier fuzzy match: exact → "First L." initial → token subset
    function findEmp(tndKey) {
      if (empByNorm.has(tndKey)) return empByNorm.get(tndKey);
      const parts = tndKey.split(' ').filter(Boolean);
      // "First L." pattern — e.g., "james d." → "james dejesus"
      if (parts.length === 2 && /^[a-z]\.$/.test(parts[1])) {
        const first = parts[0], lastInit = parts[1][0];
        for (const [k, emp] of empByNorm) {
          const kp = k.split(' ');
          if (kp.length >= 2 && kp[0] === first && kp[kp.length-1].startsWith(lastInit)) return emp;
        }
      }
      // Token subset: all meaningful tokens in tndKey appear in emp name
      const tndToks = parts.filter(p => p.length > 1 && !/\.$/.test(p));
      if (tndToks.length >= 2) {
        for (const [k, emp] of empByNorm) {
          const kToks = k.split(' ');
          if (tndToks.every(t => kToks.includes(t))) return emp;
        }
      }
      return null;
    }

    let matched = 0;
    for (const [tndKey, entries] of Object.entries(tnd)) {
      const emp = findEmp(tndKey);
      if (!emp) continue;
      // Skip alias keys pointing to same emp (rawKey → same array as canonical key)
      if (emp._tndObsTotal !== undefined) continue;
      const observed = entries.filter(e => e.observed).length;
      const missed   = entries.filter(e => e.missed).length;
      const link     = (entries.find(e => e.link) || {}).link || '';
      emp._tndObsTotal    = entries.length;
      emp._tndObsObserved = observed;
      emp._tndObsMissed   = missed;
      emp._tndObsLink     = link;
      emp._tndObsMonths   = entries.filter(e => e.observed).map(e => e.month).join(', ');
      matched++;
    }
    console.log('[HR Profiles] T&D obs overlay matched:', matched, 'employees');
  }

  async function fetchLiveHRData(force=false) {
    if (!force) {
      try {
        const c = JSON.parse(localStorage.getItem(HR_CACHE_KEY)||'null');
        if (c && c.ts && (Date.now()-c.ts) < HR_TTL_MS && c.rows && c.rows.length) {
          _hrOverlayLive(c.rows);
          _hrStatus = 'live';
          _hrFetched = true;
          window._hrDataFetched = true;
          window._njtcActiveEmployees = HR_EMPS.filter(e => e.s === 'Active').length;
          // Re-render home widget from cache data — defer to next frame so UI stays responsive
          requestAnimationFrame(() => {
            try {
              const _hw = document.getElementById('homeDeptWidget');
              // Guard: leaderboard owns this slot — never overwrite it
              if (_hw && _hw.innerHTML && !document.getElementById('lbWrap') && typeof window._buildTermAnalyticsWidget === 'function') {
                const _dept = (window.NJTC_SESSION||{}).dept||'';
                const _onsiteHtml = typeof window._buildOnsiteRetentionWidget === 'function' ? window._buildOnsiteRetentionWidget() : '';
                if (['hr','data'].includes(_dept)) _hw.innerHTML = window._buildTermAnalyticsWidget() + _onsiteHtml;
                else if (_dept === 'programming' && typeof window._buildRetentionWidget === 'function') _hw.innerHTML = window._buildRetentionWidget();
              }
            } catch(_we) {}
          });
          // Trigger exec dashboard refresh so tutor count updates from correct live data
          try { if (typeof window._execDashRefresh === 'function') window._execDashRefresh(true); } catch(_e) {}
          return;
        }
      } catch(e) {}
    }
    const bust = force ? '&t='+Date.now() : '';
    const url  = `https://docs.google.com/spreadsheets/d/e/${HR_2PACX}/pub?output=csv&gid=${HR_GID_MASTER}${bust}`;
    try {
      const res = await fetch(url, {signal: AbortSignal.timeout(10000)});
      if (res.ok) {
        const rows = _parseHRMaster(await res.text());
        if (rows.length > 0) {
          try { localStorage.setItem(HR_CACHE_KEY, JSON.stringify({ts:Date.now(),rows})); } catch(e){}
          _hrOverlayLive(rows);
          _hrStatus = 'live';
          console.log('[HR Profiles] Live sheet loaded: '+rows.length+' rows');
          // Defer all DOM updates to next animation frame so data processing
          // never blocks user interaction mid-frame
          requestAnimationFrame(() => {
            // Re-render if profiles tab is active
            const _lb=document.getElementById('talentTab-profiles');
            if (_lb&&_lb.classList.contains('active')) {
              const _le=document.getElementById('talentContent');
              if (_le) {
                try {
                  const _vr = (typeof _hrOverlayVersion !== 'undefined') ? String(_hrOverlayVersion) : '0';
                  _le.innerHTML='<div id="hrProfilesRoot" data-overlay-version="'+_vr+'">'+_hrBuildProfiles((window.NJTC_SESSION||{}).dept||'hr')+'</div>';
                } catch(_re) {
                  console.warn('[HR Profiles] Re-render after live fetch failed:', _re.message);
                }
              }
            }
            // Re-render home attrition/retention widget in its own frame after profiles
            requestAnimationFrame(() => {
              try {
                const _hw = document.getElementById('homeDeptWidget');
                // Guard: leaderboard owns this slot — never overwrite it
                if (_hw && _hw.innerHTML && !document.getElementById('lbWrap') && typeof window._buildTermAnalyticsWidget === 'function') {
                  const _dept = (window.NJTC_SESSION||{}).dept||'';
                  if (['hr','data'].includes(_dept)) {
                    const _onsiteHtml = typeof window._buildOnsiteRetentionWidget === 'function' ? window._buildOnsiteRetentionWidget() : '';
                    _hw.innerHTML = window._buildTermAnalyticsWidget() + _onsiteHtml;
                  } else if (_dept === 'programming' && typeof window._buildRetentionWidget === 'function') {
                    _hw.innerHTML = window._buildRetentionWidget();
                  }
                }
              } catch(_we) { /* widget re-render non-critical */ }
            });
          });
        } else { _hrStatus = 'error'; }
      } else { _hrStatus = 'error'; }
    } catch(e) {
      console.warn('[HR Profiles] Live fetch failed:', e.message);
      _hrStatus = 'error';
    }
    _hrFetched = true;
    window._hrDataFetched = true;
    if (_hrStatus === 'live') window._njtcActiveEmployees = HR_EMPS.filter(e => e.s === 'Active').length;
    // Trigger exec dashboard refresh so tutor count updates from live HR data
    try { if (typeof window._execDashRefresh === 'function') window._execDashRefresh(true); } catch(_e) {}
  }

  // ── Tier config ───────────────────────────────────────────────────────────
  function _tier(t) {
    return ({
      stellar:      {label:'Stellar',       color:'#0d6e3a',bg:'#d1fae5',emoji:'⭐'},
      strong:       {label:'Strong',        color:'#0050c8',bg:'#dbeafe',emoji:'✅'},
      developing:   {label:'Developing',    color:'#d97706',bg:'#fef3c7',emoji:'📈'},
      needs_support:{label:'Needs Support', color:'#b91c1c',bg:'#fee2e2',emoji:'🤝'},
      incomplete:   {label:'No Score',      color:'#7d8fa1',bg:'#f1f5f9',emoji:'📋'},
    })[t] || {label:'—',color:'#7d8fa1',bg:'#f1f5f9',emoji:'❓'};
  }

  // ── Filter state ──────────────────────────────────────────────────────────
  let _pTier='all', _pRole='all', _pStatus='active', _pQ='', _pViewTab='active', _pSY='2025-2026', _pApprentice=false, _pPage=0;

  // ── Programming Profile view filter state ────────────────────────────────
  let _ppStatus='all', _ppRegion='all', _ppQ='';

  function _filtered() {
    let list = HR_EMPS;
    // SY filter: restrict active employees to those who have a record in the selected SY.
    // The inactive tab is exempt — terminated staff from any SY should always be browseable.
    // Also exclude stale embedded employees absent from live 2025-2026 sheet
    // (e.g. someone removed from HR Master whose embed data hasn't been purged yet).
    if (_pSY && _pSY !== 'all' && _pViewTab !== 'inactive') {
      list = list.filter(e => {
        if (!((e.y||[]).includes(_pSY) || (e._liveYears||[]).includes(_pSY))) return false;
        if (_pSY === '2025-2026' && e._notInLive2526) return false;
        return true;
      });
    }
    // Tab-aware status filter: 'active' tab = Active only; 'inactive' tab = all non-Active
    if (_pViewTab === 'active')   list = list.filter(e => e.s === 'Active');
    if (_pViewTab === 'inactive') list = list.filter(e => e.s !== 'Active');
    // Additional tier and role filters
    if (_pTier !== 'all') list = list.filter(e => (e._liveT||e.t) === _pTier);
    // Role filter — options are now exact role strings from live data (exact match, case-insensitive)
    if (_pRole !== 'all') list = list.filter(e => (e.r||'').toLowerCase() === _pRole.toLowerCase());
    // Apprentice filter — source of truth is HR Master List col K (_apprentice field, set by live overlay)
    if (_pApprentice) {
      const before = list.length;
      list = list.filter(e => e._apprentice === 'Yes');
      console.log('[HR Filter] Apprentice filter: ' + before + ' → ' + list.length);
    }
    // Search
    if (_pQ) {
      const q = _pQ.toLowerCase();
      list = list.filter(e =>
        (e.n||'').toLowerCase().includes(q) ||
        (e.si||'').toLowerCase().includes(q) ||
        (e.r||'').toLowerCase().includes(q) ||
        (e.di||'').toLowerCase().includes(q) ||
        (e.a||[]).some(alt => alt.toLowerCase().includes(q))
      );
    }
    // Sort: concerns first, then by name
    list.sort((a,b) => {
      const ca = (a._liveConcerns||0)>0||a.co===1 ? 1 : 0;
      const cb = (b._liveConcerns||0)>0||b.co===1 ? 1 : 0;
      if (cb !== ca) return cb - ca;  // concerns first
      return (a.n||'').localeCompare(b.n||'');
    });
    return list;
  }

  // ── Render helpers ────────────────────────────────────────────────────────
  function _statusDot(s) {
    return s==='Active'
      ? '<span style="color:#0d6e3a;font-weight:700;font-size:.65rem">● Active</span>'
      : '<span style="color:#94a3b8;font-size:.65rem">○ Past</span>';
  }
  function _yesNo(v) {
    if (v==='Yes')   return '<span style="color:#0d6e3a;font-weight:700">✓</span>';
    if (v==='No')    return '<span style="color:#b91c1c;font-weight:700">✗</span>';
    return '<span style="color:#94a3b8">—</span>';
  }
  function _attColor(v) {
    if (v===null||v===undefined) return '#94a3b8';
    return v>=90?'#0d6e3a':v>=80?'#d97706':'#b91c1c';
  }
  function _rehireBadge(rh) {
    if (!rh) return '';
    const rl = (rh||'').toLowerCase();
    const bg = rl.startsWith('yes')?'#d1fae5':rl.startsWith('no')?'#fee2e2':'#fef3c7';
    const co = rl.startsWith('yes')?'#065f46':rl.startsWith('no')?'#b91c1c':'#92400e';
    return `<span style="background:${bg};color:${co};padding:.15rem .5rem;border-radius:10px;font-size:.65rem;font-weight:700">${esc(rh)}</span>`;
  }

  // ── KB VIEW ───────────────────────────────────────────────────────────────
  function _hrViewKB() {
    const total   = HR_EMPS.length;
    const active  = HR_EMPS.filter(e=>e.s==='Active').length;
    const byTier  = {stellar:0,strong:0,developing:0,needs_support:0,incomplete:0};
    HR_EMPS.forEach(e=>{ if(byTier[e.t]!==undefined) byTier[e.t]++; });
    const highPerf= byTier.stellar + byTier.strong;
    const atRisk  = byTier.needs_support;
    const multiCy = HR_EMPS.filter(e=>e.c>=2).length;
    const noRehire= HR_EMPS.filter(e=>e.rh==='No'||e.rh===false).length;
    const concerns= HR_EMPS.filter(e=>(e._liveConcerns||0)>0||e.co===1).length;
    const getAtt  = e => e._liveAtt!==undefined ? e._liveAtt : e.att;
    const attRisk = HR_EMPS.filter(e=>e.s==='Active'&&getAtt(e)!==null&&getAtt(e)<80).length;
    const src     = _hrStatus==='live' ? '🟢 Live' : '📋 Snapshot';

    // Academic summary if irlab data available
    const hasAcad   = HR_EMPS.some(e=>e._acadPctMoved!=null);
    const acadScholars = hasAcad ? HR_EMPS.reduce((a,e)=>a+(e._acadScholars||0),0) : null;
    const academicMovers = hasAcad ? HR_EMPS.filter(e=>e._acadPctMoved!=null) : [];
    const avgPctMoved = academicMovers.length
      ? Math.round(academicMovers.reduce((a,e)=>a+e._acadPctMoved,0)/academicMovers.length) : null;

    // Tier bar
    const tierOrder = ['stellar','strong','developing','needs_support','incomplete'];
    const tierBar = tierOrder.map(t=>{
      const cfg=_tier(t); const n=byTier[t]; if(!n) return '';
      const pct=Math.round(n/total*100);
      return `<div style="flex:${pct};background:${cfg.color};height:8px;border-radius:3px" title="${cfg.label}: ${n} (${pct}%)"></div>`;
    }).join('');

    // Executive KPIs
    const kpis = [
      {v:total,        l:'Total Employees', sub:active+' active',       c:'var(--navy)'},
      {v:highPerf,     l:'High Performers', sub:`${Math.round(highPerf/total*100)}% of staff`, c:'#0d6e3a'},
      {v:multiCy,      l:'Multi-Cycle Staff',sub:`${Math.round(multiCy/total*100)}% retention`, c:'var(--navy)'},
      {v:concerns,     l:'Active Concerns', sub:atRisk+' needs support',  c:concerns>5?'#b91c1c':'#d97706'},
      {v:attRisk,      l:'Attendance Risk', sub:'active staff <80%',      c:attRisk>5?'#b91c1c':'#d97706'},
      ...(avgPctMoved!=null?[{v:avgPctMoved+'%', l:'Avg Scholar Gains', sub:acadScholars+' scholars total', c:'#7c3aed'}]:[]),
    ];

    const kpiGrid = kpis.map(k=>`
<div style="text-align:center;padding:.875rem .75rem;background:var(--surface);border:1.5px solid var(--border);border-radius:10px">
  <div style="font-size:1.75rem;font-weight:800;color:${k.c};line-height:1;font-family:'DM Serif Display',serif">${k.v}</div>
  <div style="font-size:.75rem;font-weight:700;color:var(--navy);margin:.3rem 0 .15rem">${k.l}</div>
  <div style="font-size:.65rem;color:var(--muted)">${k.sub}</div>
</div>`).join('');

    // Top retention flags
    const rehireable = HR_EMPS.filter(e=>e.s==='Active'&&(e.rh==='Yes'||e.rh===true)&&e.c>=2).length;
    const termRisk   = HR_EMPS.filter(e=>(e._liveHRAction||e.hn||'').includes('Termination')).length;

    return `
<div style="background:linear-gradient(135deg,#0a1628,#1a3a6b);padding:1.25rem 1.5rem;border-radius:10px;color:#fff;margin-bottom:1.25rem">
  <div style="font-size:.6rem;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:rgba(255,255,255,.4);margin-bottom:.375rem">Executive Talent Summary · ${src}</div>
  <div style="font-size:1.375rem;font-weight:700;margin-bottom:.25rem">Staff Intelligence Overview</div>
  <div style="font-size:.8125rem;color:rgba(255,255,255,.6)">SY 2022–2026 aggregate · ${total} employees in system · ${active} currently active</div>
</div>

<!-- Tier health bar -->
<div style="margin-bottom:1.125rem">
  <div style="display:flex;justify-content:space-between;margin-bottom:.4rem">
    <span style="font-size:.7rem;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.07em">Staff Performance Distribution</span>
    <span style="font-size:.7rem;color:var(--muted)">${src}</span>
  </div>
  <div style="display:flex;gap:3px;border-radius:6px;overflow:hidden;height:8px;margin-bottom:.5rem">${tierBar}</div>
  <div style="display:flex;gap:.875rem;flex-wrap:wrap">
    ${tierOrder.filter(t=>byTier[t]>0).map(t=>{const c=_tier(t);return`<span style="font-size:.7rem;color:${c.color}">${c.emoji} ${c.label}: ${byTier[t]}</span>`;}).join('')}
  </div>
</div>

<!-- KPI grid -->
<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:.75rem;margin-bottom:1.25rem">
  ${kpiGrid}
</div>

<!-- Executive signal flags -->
<div style="margin-bottom:1.125rem">
  <div style="font-size:.7rem;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.07em;margin-bottom:.625rem">Key Signals for Leadership Review</div>
  <div style="display:flex;flex-direction:column;gap:.35rem">
    ${[
      {pos:true,  ico:'🌟', txt:`${highPerf} high performers (Stellar+Strong) — ${Math.round(highPerf/total*100)}% of total staff`},
      {pos:true,  ico:'🔁', txt:`${multiCy} multi-cycle employees — institutional knowledge retention strength`},
      {pos:true,  ico:'✅', txt:`${rehireable} currently active & eligible for rehire with 2+ cycles`},
      ...(noRehire>0?[{pos:true,ico:'🆕', txt:`${noRehire} employees are new this SY (first-time hires, not rehires from a prior cycle)`}]:[]),
      ...(termRisk>0?[{pos:false,ico:'⚠️', txt:`${termRisk} employees with active termination recommendation`}]:[]),
      ...(attRisk>5?[{pos:false,ico:'🔴', txt:`${attRisk} active staff below 80% attendance — immediate attention needed`}]:[]),
      ...(avgPctMoved!=null?[{pos:avgPctMoved>=40,ico:'📚',txt:`${avgPctMoved}% of tutored scholars improved i-Ready placement (${acadScholars} scholars total)`}]:[]),
    ].map(s=>`<div style="display:flex;gap:.5rem;align-items:flex-start;padding:.4rem .75rem;background:${s.pos?'#f0fdf4':'#fff7ed'};border:1px solid ${s.pos?'#bbf7d0':'#fed7aa'};border-radius:8px">
      <span>${s.ico}</span>
      <span style="font-size:.8125rem;color:${s.pos?'#065f46':'#92400e'}">${s.txt}</span>
    </div>`).join('')}
  </div>
</div>

<div style="font-size:.7rem;color:var(--muted);text-align:right">Detailed employee profiles available to HR and Data departments</div>`;
  }

  // ── FINANCE VIEW ──────────────────────────────────────────────────────────
  function _hrViewFinance() {
    const active  = HR_EMPS.filter(e=>e.s==='Active');
    const getAtt  = e => e._liveAtt !== undefined ? e._liveAtt : e.att;
    const attRisk = active.filter(e=>getAtt(e)!==null&&getAtt(e)<85)
                          .sort((a,b)=>getAtt(a)-getAtt(b));
    const ns      = HR_EMPS.filter(e=>e.t==='needs_support').length;
    const noRehire= HR_EMPS.filter(e=>(e.rh||'').toLowerCase().startsWith('no')).length;
    const concern = HR_EMPS.filter(e=>e._liveConcerns>0||e.co===1).length;
    return `
<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:.875rem;margin-bottom:1.25rem">
  ${[
    {v:attRisk.length,l:'Active Staff Below 85% Attendance',sub:'service delivery risk',bg:'#fef2f2',co:'#b91c1c'},
    {v:ns,            l:'Needs Support Performance',        sub:'across all cycles',   bg:'#fff7ed',co:'#d97706'},
    {v:noRehire,      l:'New This SY',                      sub:'first-time hires',    bg:'#eff6ff',co:'#1d4ed8'},
  ].map(x=>`<div style="background:${x.bg};border-radius:var(--radius-sm);padding:1.25rem;border:1px solid ${x.co}33;text-align:center"><div style="font-family:'DM Serif Display',serif;font-size:2rem;color:${x.co}">${x.v}</div><div style="font-size:.8125rem;font-weight:700;color:${x.co};margin-top:.25rem">${x.l}</div><div style="font-size:.7rem;color:var(--muted)">${x.sub}</div></div>`).join('')}
</div>
${attRisk.length ? `
<div class="po-detail-card">
  <div class="po-section-hd">⚠️ Active Staff — Attendance Warrants Review</div>
  <div style="overflow-x:auto;padding:0 1rem 1rem">
    <table style="width:100%;border-collapse:collapse;font-size:.8125rem">
      <thead><tr style="background:var(--surface-2)">
        ${['Staff Member','Role','Site','Attendance','Profile Year','Tier'].map(h=>`<th style="padding:.5rem .75rem;text-align:left;font-size:.625rem;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.06em">${h}</th>`).join('')}
      </tr></thead>
      <tbody>
        ${attRisk.slice(0,25).map(e=>{
          const att=getAtt(e); const cfg=_tier(e.t);
          const live=e._liveAtt!==undefined;
          return `<tr style="border-bottom:1px solid var(--border-2)">
            <td style="padding:.5rem .75rem;font-weight:600;color:var(--navy)">${esc(e.n)}</td>
            <td style="padding:.5rem .75rem;color:var(--text-2);font-size:.75rem">${esc(e.r||'—')}</td>
            <td style="padding:.5rem .75rem;color:var(--muted);font-size:.7rem">${esc((e.si||'—').slice(0,30))}</td>
            <td style="padding:.5rem .75rem;font-weight:700;color:${_attColor(att)}">${att!==null?att+'%':'—'}${live?' <span style="font-size:.6rem;color:var(--blue-mid)">live</span>':''}</td>
            <td style="padding:.5rem .75rem;color:var(--muted);font-size:.7rem">${esc(e.py||'—')}</td>
            <td style="padding:.5rem .75rem"><span style="background:${cfg.bg};color:${cfg.color};padding:.1rem .4rem;border-radius:8px;font-size:.65rem;font-weight:700">${cfg.emoji} ${cfg.label}</span></td>
          </tr>`;
        }).join('')}
      </tbody>
    </table>
  </div>
</div>` : '<div class="po-detail-card" style="padding:1.5rem;text-align:center;color:var(--muted)">✅ No active staff with attendance below 85%</div>'}`;
  }

  // ── LEADERSHIP VIEW ───────────────────────────────────────────────────────
  function _hrViewLeadership() {
    const total   = HR_EMPS.length;
    const active  = HR_EMPS.filter(e=>e.s==='Active').length;
    const byTier  = {stellar:0,strong:0,developing:0,needs_support:0,incomplete:0};
    HR_EMPS.forEach(e=>{ if(byTier[e.t]!==undefined) byTier[e.t]++; });
    const getAtt  = e => e._liveAtt!==undefined ? e._liveAtt : e.att;
    const src     = _hrStatus==='live' ? '🟢 Live' : '📋 Snapshot';

    // Academic overlay summary
    const hasAcad = HR_EMPS.some(e=>e._acadPctMoved!=null);
    const acadMovers = hasAcad ? HR_EMPS.filter(e=>e._acadPctMoved!=null) : [];
    const avgPctMoved = acadMovers.length ? Math.round(acadMovers.reduce((a,e)=>a+e._acadPctMoved,0)/acadMovers.length) : null;
    const totalScholars = HR_EMPS.reduce((a,e)=>a+(e._acadScholars||0),0);

    // Risk flags
    const termRisk  = HR_EMPS.filter(e=>(e._liveHRAction||e.hn||'').includes('Termination'));
    const pgpList   = HR_EMPS.filter(e=>(e._liveHRAction||e.hn||'').includes('PGP'));
    const attRisk   = HR_EMPS.filter(e=>e.s==='Active'&&getAtt(e)!==null&&getAtt(e)<80);
    const noRehire  = HR_EMPS.filter(e=>e.rh==='No'||e.rh===false);
    const multiConcerns = HR_EMPS.filter(e=>(e._liveConcerns||0)>=2);

    // Top performers (stellar, active, multi-cycle)
    const topPerformers = HR_EMPS.filter(e=>e.t==='stellar'&&e.s==='Active'&&e.c>=2)
      .sort((a,b)=>b.c-a.c).slice(0,8);

    // Watch list: needs_support OR high concerns — but NEVER stellar performers
    // (Stellar is a performance designation; watch list is for operational/HR risk.
    // A stellar performer with old concern records should not appear here unless
    // they have an active HR action — Termination, Write Up, or PGP.)
    const watchList = HR_EMPS.filter(e=>{
      if (e.s !== 'Active') return false;
      const hasActiveAction = /termination|write.?up|pgp/i.test(e._liveHRAction||'');
      if (e.t === 'stellar' && !hasActiveAction) return false; // exclude stellar unless active HR action
      return e.t === 'needs_support' || (e._liveConcerns||0) >= 2;
    }).sort((a,b)=>(b._liveConcerns||0)-(a._liveConcerns||0)).slice(0,8);

    // Tier bar
    const tierOrder=['stellar','strong','developing','needs_support','incomplete'];
    const tierBar = tierOrder.map(t=>{
      const cfg=_tier(t); const n=byTier[t]; if(!n) return '';
      const pct=Math.round(n/total*100);
      return `<div style="flex:${pct};background:${cfg.color};height:10px;border-radius:3px" title="${cfg.label}: ${n} (${pct}%)"></div>`;
    }).join('');

    const nameRow = (e, showTier=true, showAtt=false) => {
      const cfg=_tier(e.t); const a=getAtt(e);
      return `<div style="display:flex;justify-content:space-between;align-items:center;padding:.4rem .625rem;background:var(--surface-2);border-radius:6px;font-size:.75rem">
        <span style="font-weight:600;color:var(--navy)">${esc(e.n)}</span>
        <div style="display:flex;gap:.35rem;align-items:center">
          ${showTier?`<span style="font-size:.6rem;background:${cfg.bg};color:${cfg.color};padding:.1rem .35rem;border-radius:5px;font-weight:700">${cfg.emoji} ${cfg.label}</span>`:''}
          <span style="font-size:.65rem;color:var(--muted)">${e.c}cy · ${esc(e.si||'—').slice(0,25)}</span>
          ${showAtt&&a!==null?`<span style="font-size:.65rem;padding:.1rem .35rem;border-radius:5px;font-weight:600;background:${a<80?'#fee2e2':'#fef3c7'};color:${a<80?'#b91c1c':'#92400e'}">${a}%</span>`:''}
          ${(e._liveConcerns||0)>0?`<span style="font-size:.6rem;background:#fee2e2;color:#b91c1c;padding:.1rem .35rem;border-radius:5px;font-weight:700">⚠️${e._liveConcerns}</span>`:''}
        </div>
      </div>`;
    };

    // Aggregate watch-list summary (no individual names — confidential)
    const watchNeedsSupport = watchList.filter(e=>e.t==='needs_support').length;
    const watchHighConcerns = watchList.filter(e=>(e._liveConcerns||0)>=2&&e.t!=='needs_support').length;
    const watchActiveAction = watchList.filter(e=>/termination|write.?up|pgp/i.test(e._liveHRAction||'')).length;

    return `
<!-- Header -->
<div style="background:linear-gradient(135deg,#0a1628,#1a3a6b);padding:1.125rem 1.5rem;border-radius:10px;color:#fff;margin-bottom:1.125rem">
  <div style="font-size:.6rem;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:rgba(255,255,255,.4);margin-bottom:.3rem">Chief of Staff · Staff Intelligence</div>
  <div style="font-size:1.25rem;font-weight:700">Talent Landscape Overview · ${src}</div>
  <div style="font-size:.8rem;color:rgba(255,255,255,.6)">${total} employees · ${active} active · SY 2022–2026</div>
</div>

<!-- Performance Tier Distribution + Definitions -->
<div style="margin-bottom:1.125rem;padding:1rem 1.125rem;background:var(--surface);border:1.5px solid var(--border);border-radius:10px">
  <div style="font-size:.7rem;font-weight:700;text-transform:uppercase;color:var(--muted);letter-spacing:.07em;margin-bottom:.625rem">Performance Tier Distribution</div>
  <div style="display:flex;gap:3px;border-radius:6px;overflow:hidden;height:10px;margin-bottom:.625rem">${tierBar}</div>
  <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:.375rem;margin-bottom:.75rem">
    ${tierOrder.map(t=>{const c=_tier(t); return`<div style="text-align:center;padding:.375rem .25rem;background:${c.bg+'33'};border-radius:6px">
      <div style="font-size:1.125rem;font-weight:800;color:${c.color}">${byTier[t]}</div>
      <div style="font-size:.6rem;color:var(--muted)">${c.label}</div>
    </div>`;}).join('')}
  </div>
  <!-- Tier definitions — always visible per CEO direction -->
  <details style="margin-top:.5rem">
    <summary style="font-size:.7rem;font-weight:700;color:var(--blue-mid);cursor:pointer;list-style:none;display:flex;align-items:center;gap:.3rem">
      <span>▸</span> What do these tiers mean?
    </summary>
    <div style="margin-top:.625rem;display:flex;flex-direction:column;gap:.4rem;padding:.625rem;background:var(--surface-2);border-radius:8px;font-size:.75rem">
      <div><span style="font-weight:700;color:#0d6e3a">⭐ Stellar</span> — Meets or exceeds ALL benchmarks consistently: scholar att ≥85%, tutor att ≥90%, surveys on time, no active HR concerns, scholar survey avg ≥4.0/5, sustained 8+ weeks. Identified as a program model and retention priority.</div>
      <div><span style="font-weight:700;color:#2563eb">✅ Strong</span> — Meeting core benchmarks with no critical flags. Minor operational gaps acceptable. No active HR action. Solid, reliable performer.</div>
      <div><span style="font-weight:700;color:#d97706">📈 Developing</span> — Below one or more benchmarks but progressing. Scholar att 75–84% or tutor att 80–89%, or ≥2 late surveys. Needs monitoring and proactive support.</div>
      <div><span style="font-weight:700;color:#b91c1c">🔴 Needs Support</span> — Critically below benchmarks: scholar att &lt;75%, tutor att &lt;80%, multiple missed surveys, or active HR action (Write Up, PGP, or Termination). Requires immediate intervention.</div>
      <div><span style="font-weight:700;color:var(--muted)">— No Score</span> — Insufficient data to compute a tier. New hire or missing Pearl/survey records.</div>
      <div style="margin-top:.375rem;padding-top:.375rem;border-top:1px solid var(--border);color:var(--muted);font-style:italic">Note: Operational flags (late survey, HIT ratio) are separate from performance tiers. A Stellar employee may carry minor operational flags — review context before acting on a flag alone.</div>
    </div>
  </details>
</div>

<!-- 2-col: Stellar performers + Operational risk summary -->
<div style="display:grid;grid-template-columns:1fr 1fr;gap:.875rem;margin-bottom:1.125rem">
  <!-- Stellar performers — positive recognition, appropriate for exec visibility -->
  <div style="padding:.875rem 1rem;background:var(--surface);border:1.5px solid #bbf7d0;border-radius:10px">
    <div style="font-size:.7rem;font-weight:700;text-transform:uppercase;color:#0d6e3a;letter-spacing:.07em;margin-bottom:.5rem">🌟 Stellar Performers (Active · 2+ Cycles)</div>
    ${topPerformers.length
      ? `<div style="display:flex;flex-direction:column;gap:.3rem">${topPerformers.map(e=>nameRow(e,false)).join('')}</div>`
      : '<div style="font-size:.75rem;color:var(--muted)">No records match criteria</div>'}
  </div>
  <!-- Operational risk summary — aggregate only, no individual names -->
  <div style="padding:.875rem 1rem;background:var(--surface);border:1.5px solid ${watchList.length?'#fed7aa':'#bbf7d0'};border-radius:10px">
    <div style="font-size:.7rem;font-weight:700;text-transform:uppercase;color:${watchList.length?'#92400e':'#0d6e3a'};letter-spacing:.07em;margin-bottom:.5rem">⚠️ Operational Risk Summary</div>
    ${watchList.length ? `
    <div style="display:flex;flex-direction:column;gap:.5rem">
      <div style="font-size:.875rem;font-weight:700;color:#92400e">${watchList.length} employee${watchList.length!==1?'s':''} flagged for review</div>
      <div style="display:flex;flex-direction:column;gap:.3rem;font-size:.775rem;color:var(--muted)">
        ${watchActiveAction>0?`<div>🔴 <strong style="color:#b91c1c">${watchActiveAction}</strong> with active HR action (Termination/PGP/Write Up)</div>`:''}
        ${watchNeedsSupport>0?`<div>🟠 <strong style="color:#92400e">${watchNeedsSupport}</strong> in Needs Support tier</div>`:''}
        ${watchHighConcerns>0?`<div>⚠️ <strong style="color:#b45309">${watchHighConcerns}</strong> with multiple active concern records</div>`:''}
      </div>
      <div style="font-size:.7rem;color:var(--muted);border-top:1px solid var(--border);padding-top:.375rem;margin-top:.125rem;font-style:italic">Individual details are confidential. Open Talent Analytics → HR view for full records.</div>
    </div>` : '<div style="font-size:.75rem;color:#0d6e3a">✅ No active operational risk flags</div>'}
  </div>
</div>

<!-- HR Actions Panel — counts only, no individual names (confidential) -->
${(termRisk.length||pgpList.length||attRisk.length||multiConcerns.length) ? `
<div style="padding:.875rem 1rem;background:#fff7ed;border:1.5px solid #fed7aa;border-radius:10px;margin-bottom:1.125rem">
  <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:.5rem">
    <div style="font-size:.7rem;font-weight:700;text-transform:uppercase;color:#92400e;letter-spacing:.07em">🚨 Active HR Actions — Leadership Awareness</div>
    <div style="font-size:.65rem;color:#b45309;font-style:italic;text-align:right;max-width:55%">Confidential — individual records restricted to HR dept view</div>
  </div>
  <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:.5rem">
    ${termRisk.length?`<div style="padding:.5rem .75rem;background:#fee2e2;border-radius:8px;text-align:center">
      <div style="font-size:1.5rem;font-weight:800;color:#b91c1c">${termRisk.length}</div>
      <div style="font-size:.7rem;color:#b91c1c;font-weight:600">Termination Recommended</div>
      <div style="font-size:.65rem;color:var(--muted);margin-top:.2rem">Escalate to CEO + HR Director</div>
    </div>`:''}
    ${pgpList.length?`<div style="padding:.5rem .75rem;background:#FEF3C7;border-radius:8px;text-align:center">
      <div style="font-size:1.5rem;font-weight:800;color:#92400e">${pgpList.length}</div>
      <div style="font-size:.7rem;color:#92400e;font-weight:600">Active PGP</div>
      <div style="font-size:.65rem;color:var(--muted);margin-top:.2rem">Performance growth plans in progress</div>
    </div>`:''}
    ${attRisk.length?`<div style="padding:.5rem .75rem;background:#FEF3C7;border-radius:8px;text-align:center">
      <div style="font-size:1.5rem;font-weight:800;color:#d97706">${attRisk.length}</div>
      <div style="font-size:.7rem;color:#d97706;font-weight:600">Attendance Below 80%</div>
      <div style="font-size:.65rem;color:var(--muted);margin-top:.2rem">Active staff — see breakdown in HR view</div>
    </div>`:''}
    ${multiConcerns.length?`<div style="padding:.5rem .75rem;background:#FEF3C7;border-radius:8px;text-align:center">
      <div style="font-size:1.5rem;font-weight:800;color:#b45309">${multiConcerns.length}</div>
      <div style="font-size:.7rem;color:#b45309;font-weight:600">Multiple Active Concerns</div>
      <div style="font-size:.65rem;color:var(--muted);margin-top:.2rem">2+ concern records on file</div>
    </div>`:''}
  </div>
</div>` : `<div style="padding:.75rem 1rem;background:#f0fdf4;border:1.5px solid #bbf7d0;border-radius:10px;font-size:.8125rem;color:#065f46;margin-bottom:1.125rem">✅ No active HR actions at this time</div>`}

<!-- Academic summary -->
${hasAcad ? `
<div style="padding:.875rem 1rem;background:var(--surface);border:1.5px solid var(--border);border-radius:10px;margin-bottom:1.125rem">
  <div style="font-size:.7rem;font-weight:700;text-transform:uppercase;color:var(--muted);letter-spacing:.07em;margin-bottom:.625rem">📚 i-Ready Academic Outcomes (Program-Level)</div>
  <div style="display:flex;gap:1.25rem;flex-wrap:wrap">
    <span style="font-size:.875rem"><strong style="color:#7c3aed">${totalScholars}</strong> <span style="color:var(--muted)">scholars in dataset</span></span>
    <span style="font-size:.875rem"><strong style="color:${avgPctMoved>=40?'#0d6e3a':'#d97706'}">${avgPctMoved}%</strong> <span style="color:var(--muted)">avg of scholars improved placement</span></span>
    <span style="font-size:.875rem"><strong>${acadMovers.length}</strong> <span style="color:var(--muted)">tutors with academic data</span></span>
  </div>
  <div style="font-size:.7rem;color:var(--muted);margin-top:.375rem;font-style:italic">For tutor-level academic detail, open iReady Analysis Lab or T&D Analytics.</div>
</div>` : ''}

<!-- SY Rehire Status -->
<div style="padding:.875rem 1rem;background:var(--surface);border:1.5px solid var(--border);border-radius:10px;margin-bottom:1.125rem">
  <div style="font-size:.7rem;font-weight:700;text-transform:uppercase;color:var(--muted);letter-spacing:.07em;margin-bottom:.5rem">🔁 SY Rehire Status</div>
  <div style="display:flex;gap:1.5rem;flex-wrap:wrap;font-size:.875rem">
    <span><strong style="color:#0d6e3a">${HR_EMPS.filter(e=>(e.rh==='Yes'||e.rh===true)).length}</strong> <span style="color:var(--muted)">returning from previous cycle</span></span>
    <span><strong style="color:var(--navy)">${noRehire.length}</strong> <span style="color:var(--muted)">new this SY</span></span>
    <span><strong style="color:#7c3aed">${HR_EMPS.filter(e=>e.c>=3&&(e.rh==='Yes'||e.rh===true)).length}</strong> <span style="color:var(--muted)">3+ cycle veterans who returned</span></span>
  </div>
</div>
${_buildStaffDiversityHtml(HR_EMPS.filter(e=>e.s==='Active'), 'Active Staff — Race & Ethnicity')}
${_buildStaffDiversityHtml(HR_EMPS, 'All Staff (Active + Inactive) — Race & Ethnicity')}`;
  }

  // ── FULL HR / DATA VIEW ───────────────────────────────────────────────────
  function _hrViewFull() {
    // Available SYs from embedded data + live overlay years
    const allSYs = [...new Set(HR_EMPS.flatMap(e => e.y||[]))].sort().reverse();
    const curSY  = _pSY || '2025-2026';

    // Filter to selected SY for stats — mirror _hrBuildExportPool's _notInLive2526 exclusion
    // so the portal active count matches the PDF report count.
    const syEmps    = curSY === 'all' ? HR_EMPS
                    : HR_EMPS.filter(e => {
                        if (!((e.y||[]).includes(curSY)||(e._liveYears||[]).includes(curSY))) return false;
                        if (curSY === '2025-2026' && e._notInLive2526) return false;
                        return true;
                      });
    const allEmps   = syEmps;
    const active    = allEmps.filter(e => e.s === 'Active');
    const inactive  = allEmps.filter(e => e.s !== 'Active');
    const src       = _hrStatus === 'live' ? '🟢 Live' : '📋 Snapshot';
    // ── Diversity section for current SY pool ────────────────────
    const _divHtml  = _buildStaffDiversityHtml(allEmps, `Staff Diversity · ${curSY === 'all' ? 'All Years' : curSY}`);

    // ── Summary stats for active cohort ──────────────────────────
    const activeTiers = {stellar:0, strong:0, developing:0, needs_support:0, incomplete:0};
    active.forEach(e => {
      const t = e._liveT || e.t;
      if (activeTiers[t] !== undefined) activeTiers[t]++;
    });
    const withAtt   = active.filter(e => (e._liveAtt ?? e.att) !== null && (e._liveAtt ?? e.att) !== undefined);
    const avgAtt    = withAtt.length ? Math.round(withAtt.reduce((s,e)=>(s + (e._liveAtt ?? e.att)),0) / withAtt.length) : null;
    const concerns  = active.filter(e => (e._liveConcerns||0) > 0 || e.co === 1).length;
    const noRehire  = active.filter(e => e.rh === 'No' || e.rh === false).length;
    const attColor  = avgAtt == null ? 'var(--muted)' : avgAtt >= 90 ? '#0d6e3a' : avgAtt >= 80 ? '#d97706' : '#b91c1c';

    // ── Tier pills (operate on current view tab's pool) ───────────
    const pool = _pViewTab === 'inactive' ? inactive : active;
    const poolByTier = {stellar:0, strong:0, developing:0, needs_support:0, incomplete:0};
    pool.forEach(e => { const t = e._liveT||e.t; if (poolByTier[t]!==undefined) poolByTier[t]++; });

    const tierPills = Object.entries(poolByTier).map(([t,n]) => {
      const c = _tier(t); const on = _pTier === t;
      return `<button onclick="_hrSetTier('${t}')" style="padding:.25rem .65rem;border-radius:20px;border:1.5px solid ${on?c.color:c.color+'55'};background:${on?c.bg:'transparent'};color:${c.color};font-size:.68rem;font-weight:700;cursor:pointer;white-space:nowrap">${c.emoji} ${c.label} <span style="font-weight:400">(${n})</span></button>`;
    }).join('');
    const allPillOn = _pTier === 'all';
    const allPill = `<button onclick="_hrSetTier('all')" style="padding:.25rem .65rem;border-radius:20px;border:1.5px solid ${allPillOn?'var(--navy)':'var(--border)'};background:${allPillOn?'var(--navy)':'transparent'};color:${allPillOn?'#fff':'var(--navy)'};font-size:.68rem;font-weight:700;cursor:pointer">All (${pool.length})</button>`;

    // ── Filtered list for current view ───────────────────────────
    const filtered = _filtered();  // _pStatus is synced to _pViewTab by _hrSetViewTab

    // Dynamic role options — derived from the SY+tab base pool (before role filter)
    // so the dropdown always reflects the actual roles present in the current data.
    const _roleBase = (() => {
      let l = HR_EMPS;
      if (_pSY && _pSY !== 'all') l = l.filter(e => (e.y||[]).includes(_pSY)||(e._liveYears||[]).includes(_pSY));
      if (_pViewTab === 'active')   l = l.filter(e => e.s === 'Active');
      if (_pViewTab === 'inactive') l = l.filter(e => e.s !== 'Active');
      return l;
    })();
    const _liveRoles = [...new Set(_roleBase.map(e => (e.r||'').trim()).filter(Boolean))].sort();

    // ── Card builder ─────────────────────────────────────────────
    const buildCard = (e) => {
      const cfg          = _tier(e._liveT || e.t);
      const hasConcern   = (e._liveConcerns||0) > 0 || e.co === 1;
      const att          = e._liveAtt !== undefined ? e._liveAtt : e.att;
      const concernCount = e._liveConcerns || 0;
      const hrActionRaw  = e._liveHRAction || e.hn || null;
      const isActive     = e.s === 'Active';
      const borderColor  = hasConcern ? '#fecaca' : (isActive ? cfg.color+'33' : 'var(--border)');
      const isLiveAtt    = e._liveAtt !== undefined;

      // Survey: prefer static EOY upload (e.je), fall back to live Pearl enjoyment score
      const _liveSurvEnjoy = e._liveSurveyEntry ? e._liveSurveyEntry.enjoyment : null;
      const _survDisplay   = e.je != null ? '★' + e.je
                           : (_liveSurvEnjoy != null ? '★' + _liveSurvEnjoy.toFixed(1) : '—');
      const _isLiveSurv    = e.je == null && _liveSurvEnjoy != null;

      // Location: prefer Pearl session schools for 2025-2026, fall back to static HR site/district
      const _pearlSchools  = e._liveSchools && e._liveSchools.length ? e._liveSchools : null;
      const _locDisplay    = _pearlSchools
        ? _pearlSchools.slice(0, 2).join(' · ')
        : ((e.si || '—') + (e.di ? ' · ' + e.di : ''));

      // 4 KPI tiles
      const kpiTiles = [
        { v: e.c != null ? e.c + 'cy' : '—',  l: 'Cycles',     color: 'var(--navy)' },
        { v: att != null ? att + '%' : '—',    l: isLiveAtt ? 'Att ●' : 'Attendance', color: _attColor(att) },
        { v: _survDisplay, l: _isLiveSurv ? 'Survey ●' : 'Survey', color: '#7c3aed' },
        { v: e.mp != null ? e.mp + '/4' : '—', l: 'Perf Score', color: e.mp!=null?(e.mp>=3?'#0d6e3a':e.mp>=2?'#d97706':'#b91c1c'):'var(--muted)' },
      ].map(k => `<div style="flex:1;min-width:55px;text-align:center;padding:.4rem .2rem;background:var(--surface-2);border-radius:6px">
  <div style="font-size:.9rem;font-weight:800;color:${k.color};line-height:1.1">${esc(k.v)}</div>
  <div style="font-size:.58rem;color:${(isLiveAtt && k.l.includes('Att')) || (_isLiveSurv && k.l.includes('Survey')) ? '#0ea5e9' : 'var(--muted)'};margin-top:.1rem">${k.l}</div>
</div>`).join('');

      // Pass/fail metric flags
      const metricRow = e.mp != null ? `<div style="display:flex;gap:.2rem;flex-wrap:wrap;margin-top:.4rem">
  ${[['Att',e.am],['Enjoy',e.em],['Learn',e.lm],['Acad',e.acm]].map(([l,v]) =>
    `<span style="font-size:.58rem;padding:.1rem .3rem;border-radius:4px;font-weight:700;background:${v?'#d1fae5':'#fee2e2'};color:${v?'#065f46':'#b91c1c'}">${l} ${v?'✓':'✗'}</span>`).join('')}
</div>` : '';

      // Academic mini badge (if iReady data available)
      const acadBadge = e._acadPctMoved != null ? `<div style="margin-top:.35rem;font-size:.6rem;color:#7c3aed;font-weight:600">📊 ${e._acadPctMoved}% scholars advanced placement</div>` : '';
      // Pearl data gap flag — active staff with no Pearl attendance record
      const noPearlFlag = (e.s==='Active' && e._liveAtt===undefined && e.att===null)
        ? `<div style="margin-top:.35rem;font-size:.6rem;color:#64748b;font-weight:600">⬜ Not yet in Pearl this SY</div>` : '';

      // Termination detail — cols N, O, P (shown on inactive cards only; "—" suppressed on active)
      const _td = (e._termDate||'').trim(), _tr2 = (e._termReason||'').trim(), _tt = (e._termType||'').trim();
      const _fmtTD = raw => { if (!raw||raw==='#VALUE!') return '—'; const d=new Date(raw); return isNaN(d)?raw:((d.getMonth()+1)+'/'+(d.getDate())+'/'+d.getFullYear()); };
      const _termTypeBadge = t => {
        if (!t||t==='#VALUE!') return '—';
        const bg = /involuntary/i.test(t)?'#fee2e2':/voluntary/i.test(t)?'#ccfbf1':'#f1f5f9';
        const co = /involuntary/i.test(t)?'#b91c1c':/voluntary/i.test(t)?'#0f766e':'#64748b';
        return `<span style="background:${bg};color:${co};padding:.08rem .35rem;border-radius:4px;font-size:.6rem;font-weight:700">${esc(t)}</span>`;
      };
      const termDetailHtml = !isActive && (_td||_tr2||_tt) ? `<div style="margin-top:.35rem;padding:.3rem .5rem;background:#f8fafc;border:1px solid #e2e8f0;border-radius:5px;font-size:.65rem">
  <span style="color:#94a3b8;font-size:.58rem;font-weight:700;text-transform:uppercase;letter-spacing:.04em;margin-right:.35rem">Term:</span><span style="color:#64748b;margin-right:.4rem">${_fmtTD(_td)}</span>${_tr2&&_tr2!=='#VALUE!'?`<span style="color:#475569;margin-right:.4rem">${esc(_tr2)}</span>`:''}${_termTypeBadge(_tt)}
</div>` : '';

      // Concern badge
      const concernBadge = hasConcern ? `<div style="margin-top:.4rem;padding:.25rem .5rem;background:#fff7ed;border:1px solid #fed7aa;border-radius:5px;font-size:.62rem;color:#92400e;font-weight:600">⚠️ ${concernCount > 0 ? concernCount + ' concern' + (concernCount>1?'s':'') : 'Concern on record'}${hrActionRaw ? ' · ' + esc(hrActionRaw.slice(0,22)) : ''}</div>` : '';

      // Rehire + status badges
      // SY Rehire column = "Yes" means this person was a rehire from a previous cycle (returning staff).
      // "No" means they were new this year — it does NOT mean ineligible for future rehire.
      const _rhTipYes = 'Returning Staff: This individual was a rehire from a previous program cycle (SY Rehire = Yes in HR Master List). They have prior NJTC experience.';
      const rhBadge = (e.rh==='Yes'||e.rh===true)
          ? `<span title="${_rhTipYes}" style="cursor:help;font-size:.58rem;background:#d1fae5;color:#065f46;padding:.1rem .3rem;border-radius:4px;font-weight:700">✅ Returning ⓘ</span>` : '';

      // Hiring decision badge — show the latest HR decision directly on the card
      const _empHiringRecs = _hiringGet(e.n.replace(/\W/g,'_'));
      const _latestHiringDecision = _empHiringRecs.length
        ? _empHiringRecs.sort((a,b) => (b.ts||'').localeCompare(a.ts||''))[0].d : '';
      const hiringDecisionBadge = _latestHiringDecision === 'Do Not Rehire'
        ? `<span style="font-size:.58rem;background:#fee2e2;color:#b91c1c;padding:.1rem .3rem;border-radius:4px;font-weight:700" title="HR Decision: Do Not Rehire (see full profile for details)">🚫 Do Not Rehire</span>`
        : _latestHiringDecision === 'Conditional'
          ? `<span style="font-size:.58rem;background:#fef3c7;color:#92400e;padding:.1rem .3rem;border-radius:4px;font-weight:700" title="HR Decision: Conditional rehire (see full profile for details)">⚠️ Conditional</span>`
          : _latestHiringDecision === 'Hold'
            ? `<span style="font-size:.58rem;background:#dbeafe;color:#1e40af;padding:.1rem .3rem;border-radius:4px;font-weight:700" title="HR Decision: On Hold (see full profile for details)">⏸ Hold</span>`
            : '';

      return `<div onclick="window._hrShowProfile(this.getAttribute('data-empn'))" data-empn="${esc(e.n)}" style="cursor:pointer;background:var(--surface);border:1.5px solid ${borderColor};border-radius:10px;overflow:hidden;transition:.15s;display:flex;flex-direction:column;opacity:${isActive?'1':'0.72'}" onmouseenter="this.style.boxShadow='0 4px 18px rgba(10,22,40,.12)';this.style.opacity='1'" onmouseleave="this.style.boxShadow='none';this.style.opacity='${isActive?'1':'0.72'}'">
  <div style="background:linear-gradient(90deg,#0a1628,#1a3a6b);padding:.5rem .75rem;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:.25rem">
    <div style="display:flex;gap:.3rem;align-items:center;flex-wrap:wrap">
      <span style="background:${cfg.bg};color:${cfg.color};padding:.12rem .4rem;border-radius:6px;font-size:.58rem;font-weight:700">${cfg.emoji} ${cfg.label}</span>
      ${e._apprentice==='Yes'?`<span style="background:#fef9c3;color:#854d0e;padding:.12rem .4rem;border-radius:6px;font-size:.58rem;font-weight:700;border:1px solid #fde68a" title="DOL Apprentice: Enrolled in the NJTC DOL-registered apprenticeship program">🎓 Apprentice</span>`:''}
      ${hiringDecisionBadge}
    </div>
    <div style="display:flex;gap:.3rem;align-items:center">${rhBadge} <span style="font-size:.6rem;padding:.1rem .35rem;border-radius:4px;font-weight:700;background:${isActive?'#d1fae5':'#f1f5f9'};color:${isActive?'#065f46':'#64748b'}">${isActive?'Active':'Inactive'}</span></div>
  </div>
  <div style="padding:.5rem .75rem .3rem">
    <div style="font-weight:800;color:var(--navy);font-size:.83rem;line-height:1.2">${esc(e.n)}</div>
    <div style="font-size:.67rem;color:var(--text-2);margin-top:.08rem">${esc(e.r||'—')}</div>
    <div style="font-size:.62rem;color:var(--muted);margin-top:.06rem">${esc(_locDisplay.slice(0,50))}${_pearlSchools?'<span style="font-size:.55rem;color:#38bdf8;font-weight:700;margin-left:.25rem">●</span>':''}</div>
  </div>
  <div style="padding:0 .75rem .4rem;display:flex;gap:.2rem">${kpiTiles}</div>
  <div style="padding:0 .75rem .5rem">${metricRow}${acadBadge}${concernBadge}${noPearlFlag}${termDetailHtml}</div>
  <div style="margin-top:auto;padding:.3rem .75rem;border-top:1px solid var(--border);font-size:.58rem;color:var(--muted);text-align:right">View full profile →</div>
</div>`;
    };

    // Pagination — 60 cards per page, state in _pPage (reset by filter changes)
    const PAGE_SIZE = 60;
    const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    // Clamp page index in case filter narrowed the result set
    if (_pPage >= totalPages) _pPage = totalPages - 1;
    const _pageStart = _pPage * PAGE_SIZE;
    const displayCards = filtered.slice(_pageStart, _pageStart + PAGE_SIZE);
    const cards = displayCards.map(buildCard).join('');
    const hasMore = filtered.length > PAGE_SIZE;

    // ── Header summary stats ──────────────────────────────────────
    const statCard = (val, label, color='var(--navy)') =>
      `<div style="text-align:center;padding:.75rem 1rem;background:var(--surface);border:1px solid var(--border);border-radius:8px;min-width:90px">
  <div style="font-size:1.5rem;font-weight:900;color:${color};line-height:1">${val}</div>
  <div style="font-size:.62rem;color:var(--muted);margin-top:.2rem;font-weight:600">${label}</div>
</div>`;

    const summaryBar = `
<div style="display:flex;gap:.625rem;flex-wrap:wrap;margin-bottom:1.25rem;align-items:stretch">
  ${statCard(active.length, 'Active Staff', 'var(--navy)')}
  ${statCard(inactive.length, 'Inactive / Term.', '#64748b')}
  ${statCard(activeTiers.stellar + activeTiers.strong, 'High Performers', '#0d6e3a')}
  ${statCard(concerns, 'Active Concerns', concerns > 0 ? '#b91c1c' : 'var(--muted)')}
  ${statCard(avgAtt != null ? avgAtt + '%' : '—', 'Avg Attendance', attColor)}
  ${statCard(noRehire, 'New This SY', 'var(--navy)')}
  <div style="display:flex;align-items:center;margin-left:auto;font-size:.65rem;color:var(--muted);font-style:italic">${src}</div>
</div>
<div style="display:flex;align-items:center;gap:.375rem;font-size:.6875rem;color:var(--muted);background:var(--surface-2);border:1px solid var(--border-2);border-radius:6px;padding:.375rem .75rem;margin-bottom:.875rem;line-height:1.4">
  <span style="flex-shrink:0">ℹ️</span>
  <span><strong style="color:var(--navy)">Att ●</strong> = Live attendance rate from Pearl (per-person average, Active HR staff only).
  This may differ from Pearl Operations, which shows a session-weighted rate across <em>all</em> instructors including termed staff.
  The <span style="color:#0050c8;font-weight:600">●</span> dot indicates data pulled live from Pearl this session.</span>
</div>`;

    // ── View-tab toggle: Active | Inactive ───────────────────────
    const tabStyle = (isOn) =>
      `padding:.45rem 1.25rem;border-radius:8px 8px 0 0;border:1.5px solid ${isOn?'var(--navy)':'var(--border)'};border-bottom:${isOn?'1.5px solid var(--surface)':'1.5px solid var(--border)'};background:${isOn?'var(--surface)':'var(--surface-2)'};color:${isOn?'var(--navy)':'var(--muted)'};font-size:.75rem;font-weight:${isOn?'800':'600'};cursor:pointer;margin-bottom:-1.5px;position:relative;z-index:${isOn?'2':'1'}`;

    const isActiveTab   = _pViewTab === 'active';
    const isInactiveTab = _pViewTab === 'inactive';

    const viewTabs = `
<div style="display:flex;gap:0;margin-bottom:0;margin-top:.25rem">
  <button onclick="_hrSetViewTab('active')"   style="${tabStyle(isActiveTab)}">👥 Active  <span style="font-weight:400;font-size:.68rem">(${active.length})</span></button>
  <button onclick="_hrSetViewTab('inactive')" style="${tabStyle(isInactiveTab)}">📁 Inactive  <span style="font-weight:400;font-size:.68rem">(${inactive.length})</span></button>
</div>
<div style="border:1.5px solid var(--border);border-radius:0 8px 8px 8px;padding:.875rem;background:var(--surface);margin-bottom:1rem">`;

    // ── Filters row ──────────────────────────────────────────────
    const _roleOpts = `<option value="all" ${_pRole==='all'?'selected':''}>All Roles</option>` +
      _liveRoles.map(r => {
        const esc2 = s => (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
        const sel = _pRole !== 'all' && r.toLowerCase() === _pRole.toLowerCase() ? 'selected' : '';
        return `<option value="${esc2(r)}" ${sel}>${esc2(r)}</option>`;
      }).join('');
    const filtersRow = `
<div style="display:flex;gap:.5rem;align-items:center;flex-wrap:wrap;margin-bottom:.75rem">
  <select onchange="_hrSetRole(this.value)" style="font-size:.7rem;padding:.3rem .5rem;border:1.5px solid var(--border);border-radius:6px;background:var(--surface-2);color:var(--navy)">
    ${_roleOpts}
  </select>
  <div style="position:relative;flex:1;min-width:180px">
    <input id="hrSearchInput" type="text" placeholder="🔍 Search name, site, role…" oninput="_hrDoSearch(this.value)" value="${esc(_pQ)}"
      style="width:100%;padding:.3rem .625rem;border:1.5px solid var(--border);border-radius:6px;font-size:.72rem;background:var(--surface-2);color:var(--navy);box-sizing:border-box">
  </div>
  <button onclick="_hrSetApprentice()" style="padding:.3rem .65rem;border-radius:6px;border:1.5px solid ${_pApprentice?'#854d0e':'var(--border)'};background:${_pApprentice?'#fef9c3':'var(--surface-2)'};color:${_pApprentice?'#854d0e':'var(--navy)'};font-size:.7rem;font-weight:${_pApprentice?'800':'600'};cursor:pointer;white-space:nowrap">🎓 Apprentice${_pApprentice?' ✓':''}</button>
  <div style="font-size:.68rem;color:var(--muted);white-space:nowrap">${filtered.length} shown</div>
</div>
<div style="display:flex;gap:.3rem;flex-wrap:wrap;margin-bottom:.75rem">${allPill} ${tierPills}</div>`;

    const gridClose = `</div>`; // closes the tab content box

    // SY selector dropdown options
    const syOpts = ['all',...allSYs].map(sy =>
      `<option value="${sy}" ${sy===curSY?'selected':''}>${sy==='all'?'All Years':sy}</option>`
    ).join('');

    return `
${summaryBar}
${_divHtml}
<div style="display:flex;flex-wrap:wrap;gap:.3rem;align-items:center;margin-bottom:.75rem;padding:.4rem .75rem;background:var(--surface-2);border:1px solid var(--border);border-radius:8px">
  <span style="font-size:.6rem;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.06em;margin-right:.2rem">Tiers:</span>
  <span style="background:#d1fae5;color:#0d6e3a;padding:.1rem .4rem;border-radius:5px;font-size:.65rem;font-weight:700">⭐ Stellar ≥75%</span>
  <span style="background:#dbeafe;color:#0050c8;padding:.1rem .4rem;border-radius:5px;font-size:.65rem;font-weight:700">✅ Strong 55–74%</span>
  <span style="background:#fef3c7;color:#d97706;padding:.1rem .4rem;border-radius:5px;font-size:.65rem;font-weight:700">📈 Developing 38–54%</span>
  <span style="background:#fee2e2;color:#b91c1c;padding:.1rem .4rem;border-radius:5px;font-size:.65rem;font-weight:700">🤝 Needs Support &lt;38%</span>
  <span style="background:#f1f5f9;color:#7d8fa1;padding:.1rem .4rem;border-radius:5px;font-size:.65rem;font-weight:700">📋 No Score</span>
  <span style="margin-left:auto;font-size:.6rem;color:#2563eb;font-weight:700;cursor:pointer;white-space:nowrap" onclick="setTalentTab('definitions')">📖 Full definitions &rarr;</span>
</div>
<div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:.4rem;margin-bottom:.5rem">
  <div style="font-size:.72rem;font-weight:700;color:var(--navy)">Employee Profiles</div>
  <div style="display:flex;align-items:center;gap:.5rem;flex-wrap:wrap">
    <label style="font-size:.65rem;color:var(--muted);font-weight:600">School Year:</label>
    <select onchange="_hrSetSY(this.value)" style="font-size:.72rem;padding:.3rem .625rem;border:1.5px solid var(--navy);border-radius:6px;background:var(--navy);color:#fff;font-weight:700;cursor:pointer">
      ${syOpts}
    </select>
    <span style="font-size:.62rem;color:var(--muted);font-style:italic">${src}</span>
    <button onclick="(function(){localStorage.removeItem('${HR_CACHE_KEY}');buildTalentDashboard(true);})()" style="padding:.25rem .6rem;border-radius:6px;border:1.5px solid #0ea5e9;background:#f0f9ff;color:#0369a1;font-size:.65rem;font-weight:700;cursor:pointer;white-space:nowrap" title="Clear cache and reload live data now">⟳ Sync Live</button>
    ${(window.NJTC_SESSION||{}).dept==='data'?`<div style="position:relative;display:inline-block">
      <button onclick="(function(el){el.nextElementSibling.style.display=el.nextElementSibling.style.display==='block'?'none':'block'})(this)" style="padding:.25rem .6rem;border-radius:6px;border:1.5px solid #7c3aed;background:#faf5ff;color:#6d28d9;font-size:.65rem;font-weight:700;cursor:pointer;white-space:nowrap">📄 Export ▾</button>
      <div style="display:none;position:absolute;right:0;top:110%;background:#fff;border:1.5px solid #e2e8f0;border-radius:8px;box-shadow:0 8px 24px rgba(0,0,0,.12);z-index:999;min-width:210px;padding:.4rem 0" onclick="this.style.display='none'">
        <div style="padding:.25rem .75rem .1rem;font-size:.6rem;font-weight:700;text-transform:uppercase;color:#94a3b8;letter-spacing:.06em">📄 PDF — Active + Terminated split</div>
        <button onclick="window._hrExportAggregatePDF('overall','','${curSY}')" style="display:block;width:100%;text-align:left;padding:.35rem .75rem;font-size:.75rem;border:none;background:none;cursor:pointer;color:#1e293b" onmouseover="this.style.background='#f1f5f9'" onmouseout="this.style.background='none'">📊 Org-Wide PDF</button>
        ${[...new Set(filtered.map(e=>e.di||'').filter(Boolean))].sort().slice(0,10).map(d=>`<button onclick="window._hrExportAggregatePDF('district',this.dataset.v,'${curSY}')" data-v="${esc(d)}" style="display:block;width:100%;text-align:left;padding:.35rem .75rem;font-size:.7rem;border:none;background:none;cursor:pointer;color:#334155;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:210px" onmouseover="this.style.background='#f1f5f9'" onmouseout="this.style.background='none'">🏫 ${esc(d.slice(0,32))}</button>`).join('')}
        ${[...new Set(filtered.flatMap(e=>e._liveSchools&&e._liveSchools.length?e._liveSchools:[e.si||'']).filter(Boolean))].sort().slice(0,8).map(s=>`<button onclick="window._hrExportAggregatePDF('school',this.dataset.v,'${curSY}')" data-v="${esc(s)}" style="display:block;width:100%;text-align:left;padding:.35rem .75rem;font-size:.7rem;border:none;background:none;cursor:pointer;color:#334155;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:210px" onmouseover="this.style.background='#f1f5f9'" onmouseout="this.style.background='none'">🏢 ${esc(s.slice(0,32))}</button>`).join('')}
        <div style="margin:.35rem .75rem 0;border-top:1px solid #e2e8f0;padding-top:.35rem;font-size:.6rem;font-weight:700;text-transform:uppercase;color:#94a3b8;letter-spacing:.06em">📊 CSV — all fields, all rows</div>
        <button onclick="window._hrExportCSV('overall','','${curSY}')" style="display:block;width:100%;text-align:left;padding:.35rem .75rem;font-size:.75rem;border:none;background:none;cursor:pointer;color:#0369a1;font-weight:700" onmouseover="this.style.background='#f0f9ff'" onmouseout="this.style.background='none'">⬇ Full Org CSV</button>
        ${[...new Set(filtered.map(e=>e.di||'').filter(Boolean))].sort().slice(0,10).map(d=>`<button onclick="window._hrExportCSV('district',this.dataset.v,'${curSY}')" data-v="${esc(d)}" style="display:block;width:100%;text-align:left;padding:.3rem .75rem;font-size:.7rem;border:none;background:none;cursor:pointer;color:#0369a1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:210px" onmouseover="this.style.background='#f0f9ff'" onmouseout="this.style.background='none'">⬇ ${esc(d.slice(0,30))}</button>`).join('')}
      </div>
    </div>`:''}
  </div>
</div>
${viewTabs}
${filtersRow}
<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:.75rem;margin-bottom:.5rem">
  ${cards || `<div style="grid-column:1/-1;text-align:center;padding:2.5rem;color:var(--muted);font-size:.8rem">No employees match your filters.</div>`}
</div>
${hasMore ? `<div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:.5rem;padding:.75rem;background:var(--surface-2);border-radius:6px;margin-top:.5rem">
  <span style="font-size:.72rem;color:var(--muted)">Page ${_pPage+1} of ${totalPages} · Showing ${_pageStart+1}–${Math.min(_pageStart+PAGE_SIZE,filtered.length)} of ${filtered.length}</span>
  <div style="display:flex;gap:.4rem">
    ${_pPage > 0 ? `<button onclick="_hrSetPage(${_pPage-1})" style="padding:.3rem .75rem;font-size:.72rem;font-weight:700;border:1.5px solid var(--navy);border-radius:6px;background:var(--surface);color:var(--navy);cursor:pointer">← Prev</button>` : ''}
    ${_pPage < totalPages-1 ? `<button onclick="_hrSetPage(${_pPage+1})" style="padding:.3rem .75rem;font-size:.72rem;font-weight:700;border:1.5px solid var(--navy);border-radius:6px;background:var(--navy);color:#fff;cursor:pointer">Next →</button>` : ''}
  </div>
</div>` : ''}
${gridClose}
`; }

  // ── Employee modal ────────────────────────────────────────────────────────
  function _hrModal(emp) {
    const cfg          = _tier(emp.t);
    const att          = emp._liveAtt!==undefined ? emp._liveAtt : emp.att;
    const liveLabel    = emp._liveAtt!==undefined ? ' <span style="font-size:.6rem;color:#38bdf8;font-weight:700">● LIVE</span>' : '';
    const concernCount = emp._liveConcerns||0;
    const hrAction     = emp._liveHRAction || emp.hn || null;
    const scholars     = emp._liveScholars !== undefined ? emp._liveScholars : null;
    const uid          = emp.n.replace(/\W/g,'_');

    // Rehire badge
    // SY Rehire column = "Yes" means returning from a previous cycle; "No" means new this year.
    const _rhTipDrwYes = 'Returning Staff — This individual was a rehire from a previous program cycle (SY Rehire = Yes in HR Master List). They have prior NJTC experience.';
    const rhBadge = (emp.rh==='Yes'||emp.rh===true)
        ? '<span title="'+_rhTipDrwYes+'" style="cursor:help;background:#d1fae5;color:#065f46;padding:.15rem .45rem;border-radius:8px;font-size:.65rem;font-weight:700">✅ Returning Staff ⓘ</span>' : '';

    // Section header helper with collapse toggle
    const sec = (label, id, body, defaultOpen=true) => body ? `
<div style="margin-bottom:1.125rem">
  <div onclick="_hrToggle('${id}')" style="display:flex;justify-content:space-between;align-items:center;cursor:pointer;padding:.4rem .625rem;background:var(--surface-2);border-radius:6px;margin-bottom:.5rem;user-select:none">
    <span style="font-size:.68rem;font-weight:700;text-transform:uppercase;color:var(--muted);letter-spacing:.08em">${label}</span>
    <span id="${id}_btn" style="font-size:.65rem;color:var(--muted)">${defaultOpen?'▼ Hide':'▶ Show'}</span>
  </div>
  <div id="${id}" style="${defaultOpen?'':'display:none'}">${body}</div>
</div>` : '';

    // ── Employment section ───────────────────────────────────────────
    // For 2025-2026, prefer live Pearl session schools over static HR site field.
    const _modalPearlSchools = emp._liveSchools && emp._liveSchools.length ? emp._liveSchools : null;
    const employmentBody = `
<div style="display:grid;grid-template-columns:1fr 1fr;gap:.75rem">
  <div>
    <div style="font-size:.625rem;font-weight:700;text-transform:uppercase;color:var(--muted);margin-bottom:.3rem">Current Site${_modalPearlSchools?'&nbsp;<span style="font-size:.55rem;color:#38bdf8;font-weight:700">● Pearl Live</span>':''}</div>
    <div style="font-size:.875rem;color:var(--navy);font-weight:600">${esc((_modalPearlSchools?_modalPearlSchools.join(', '):emp.si)||'—')}</div>
    ${!_modalPearlSchools&&emp.di?`<div style="font-size:.7rem;color:var(--text-2)">${esc(emp.di.slice(0,60))}</div>`:''}
    ${emp.dis&&emp.dis.length>1&&!_modalPearlSchools?`<div style="font-size:.65rem;color:var(--muted);margin-top:.2rem">All districts: ${emp.dis.slice(0,3).map(esc).join(', ')}</div>`:''}
    ${_modalPearlSchools&&emp.si?`<div style="font-size:.65rem;color:var(--muted);margin-top:.15rem">HR record: ${esc(emp.si)}</div>`:''}
  </div>
  <div>
    <div style="font-size:.625rem;font-weight:700;text-transform:uppercase;color:var(--muted);margin-bottom:.3rem">SY History (${emp.c} cycle${emp.c!==1?'s':''})</div>
    <div style="font-size:.8125rem;color:var(--navy)">${esc((emp.y||[]).join(', ')||'—')}</div>
    ${emp.rs&&emp.rs.length>1?`<div style="font-size:.7rem;color:var(--text-2);margin-top:.2rem">Roles held: ${emp.rs.slice(0,3).map(esc).join(' · ')}</div>`:''}
    ${emp.e?`<div style="margin-top:.4rem"><a href="mailto:${esc(emp.e)}" style="font-size:.75rem;color:var(--blue-mid)">${esc(emp.e)}</a></div>`:''}
  </div>
</div>
${scholars!=null?`<div style="margin-top:.625rem;display:flex;gap:.875rem;flex-wrap:wrap;padding:.5rem .75rem;background:var(--surface-2);border-radius:6px;font-size:.8125rem">
  <span>👩‍🎓 <strong>${scholars}</strong> <span style="color:var(--muted)">scholars (live)</span></span>
  ${emp._liveSessions?`<span>📅 <strong>${emp._liveSessions}</strong> <span style="color:var(--muted)">sessions</span></span>`:''}
</div>`:''}`;

    // ── Historic performance metrics (with live YoY acad improvement override) ──
    // Live acad improvement: compare current _acadPctMoved vs prior year pi
    // 'Yes' = improved, 'No' = did not improve, 'N/A' = no prior year data (not penalized)
    const liveAcadImprove = emp._acadImproveYoY ?? null;
    const acadDisplay     = liveAcadImprove !== null ? liveAcadImprove : emp.acm;
    const acadIsNA        = liveAcadImprove === 'N/A';
    const acadIsLive      = liveAcadImprove !== null;
    // Compute adjusted score using live acad status when available
    const _amPt = (emp.am === 'Yes' || emp.am === true) ? 1 : 0;
    const _emPt = (emp.em === 'Yes' || emp.em === true) ? 1 : 0;
    const _lmPt = (emp.lm === 'Yes' || emp.lm === true) ? 1 : 0;
    const _acPt = (!acadIsNA && (acadDisplay === 'Yes' || acadDisplay === true)) ? 1 : 0;
    const adjDenom = acadIsNA ? 3 : 4;
    const adjScore = _amPt + _emPt + _lmPt + (acadIsNA ? 0 : _acPt);
    const metricsBody = emp.mp!==null ? `
<div>
  <div style="padding:.5rem .75rem;background:#f0f9ff;border:1px solid #bae6fd;border-radius:6px;margin-bottom:.625rem">
    <div style="font-size:.7rem;font-weight:700;color:#0369a1;margin-bottom:.25rem">📐 How Perf Score is Calculated</div>
    <div style="font-size:.68rem;color:#0369a1;line-height:1.6">
      Score = count of binary metrics met · SY: <strong>${esc(emp.py||'—')}</strong>${acadIsLive?' <span style="background:#dbeafe;color:#1e40af;padding:.05rem .35rem;border-radius:8px;font-weight:700">④ updated from live data</span>':''}<br>
      <span style="color:#075985">① Att Target — tutor met ≥95% school-year attendance goal</span><br>
      <span style="color:#075985">② Scholar Enjoyment — majority of tutored scholars reported enjoying sessions in survey</span><br>
      <span style="color:#075985">③ Scholar Learning — majority of tutored scholars reported learning in survey</span><br>
      <span style="color:#075985">④ Acad Improvement — ${acadIsLive?'current SY placement gain vs prior SY (live)':'scholars showed measurable placement gain in i-Ready diagnostics (prior SY)'}</span>${acadIsNA?'<br><span style="color:#d97706;font-weight:600">ⓘ No prior year baseline — academic metric excluded from score</span>':''}
    </div>
  </div>
  <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:.375rem;margin-bottom:.625rem">
    ${[['Att Target',emp.am,false],['Scholar Enjoyment',emp.em,false],['Scholar Learning',emp.lm,false],['Acad Improvement',acadDisplay,acadIsLive]]
      .map(([l,v,isLive])=>{
        const isYes = v==='Yes'||v===true;
        const isNA  = v==='N/A';
        return `<div style="text-align:center;padding:.4rem .25rem;background:var(--surface-2);border-radius:6px${isLive?';border:1.5px solid #93c5fd':''}" title="${isLive?'Updated from live iReady data':'From prior SY Master List'}">
        <div style="font-size:.875rem;font-weight:700;color:${isNA?'#d97706':isYes?'#0d6e3a':'#b91c1c'}">${isNA?'N/A':isYes?'✓':'✗'}</div>
        <div style="font-size:.6rem;color:var(--muted);margin-top:.1rem">${l}${isLive?'<span style="color:#2563eb"> ●</span>':''}</div>
      </div>`;}).join('')}
  </div>
  ${emp.pi!=null?`<div style="display:flex;gap:.875rem;flex-wrap:wrap;padding:.5rem .75rem;background:var(--surface-2);border-radius:8px;font-size:.8125rem">
    <span>📈 <strong>${emp.pi}%</strong> <span style="color:var(--muted)">improved placement (${esc(emp.py||'prior SY')})</span></span>
    ${emp.pr!=null?`<span>📉 <strong>${emp.pr}%</strong> <span style="color:var(--muted)">regressed</span></span>`:''}
    ${emp.p2!=null?`<span>⭐ <strong>${emp.p2}%</strong> <span style="color:var(--muted)">improved 2+ levels</span></span>`:''}
  </div>`:''}
  <div style="margin-top:.5rem;font-size:.7rem;color:var(--muted)">${acadIsLive?`Live-adjusted score: <strong>${adjScore}/${adjDenom}</strong> · `:''}SY: ${esc(emp.py||'—')} · Historical score: ${emp.mp!==null?emp.mp+'/4':'—'}</div>
</div>` : `<div style="padding:.625rem .75rem;background:#fffbeb;border:1px solid #fde68a;border-radius:8px;font-size:.75rem;color:#92400e">ℹ️ Full performance metrics not available in embedded dataset.</div>`;

    // ── i-Ready academic outcomes (current SY + prior SY cycle comparison) ────
    const hasAcad = emp._acadScholars != null;
    const hasPriorAcad = emp.pi != null;
    const acadBody = hasAcad ? `
<div>
  ${(emp.c >= 2 && hasPriorAcad) ? `<div style="display:flex;gap:.375rem;margin-bottom:.75rem;font-size:.68rem">
    <span style="padding:.2rem .6rem;border-radius:20px;background:#e0f2fe;color:#0369a1;font-weight:700">Current SY (Live)</span>
    <span style="padding:.2rem .6rem;border-radius:20px;background:#f1f5f9;color:var(--muted)">vs Prior SY: ${esc(emp.py||'—')} — ${emp.pi}% improved placement</span>
    ${emp.pi!=null&&emp._acadPctMoved!=null?`<span style="padding:.2rem .6rem;border-radius:20px;font-weight:700;background:${emp._acadPctMoved>emp.pi?'#dcfce7':'#fef2f2'};color:${emp._acadPctMoved>emp.pi?'#166534':'#991b1b'}">${emp._acadPctMoved>emp.pi?'▲ +'+(emp._acadPctMoved-emp.pi)+'%':'▼ '+(emp._acadPctMoved-emp.pi)+'%'} cycle-over-cycle</span>`:''}
  </div>` : ''}
  <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:.375rem;margin-bottom:.625rem">
    ${[
      {v:emp._acadScholars,          l:'Scholars',           c:'var(--navy)'},
      {v:emp._acadPctMoved!=null?emp._acadPctMoved+'%':'—', l:'% Improved Placement', c:emp._acadPctMoved>=50?'#0d6e3a':emp._acadPctMoved>=30?'#d97706':'#b91c1c'},
      {v:emp._acadPctGL!=null?emp._acadPctGL+'%':'—',      l:'% On Grade Level',     c:emp._acadPctGL>=50?'#0d6e3a':emp._acadPctGL>=30?'#d97706':'#b91c1c'},
    ].map(k=>`<div style="text-align:center;padding:.5rem .25rem;background:var(--surface-2);border-radius:6px">
      <div style="font-size:1.25rem;font-weight:800;color:${k.c};line-height:1">${esc(String(k.v??'—'))}</div>
      <div style="font-size:.6rem;color:var(--muted);margin-top:.15rem">${k.l}</div>
    </div>`).join('')}
  </div>
  <div style="display:flex;gap:.5rem;flex-wrap:wrap;padding:.5rem .75rem;background:var(--surface-2);border-radius:8px;font-size:.75rem">
    <span>✅ Moved: <strong>${emp._acadMoved||0}</strong></span>
    <span>→ Held: <strong>${emp._acadHeld||0}</strong></span>
    <span>⚠️ Regressed: <strong>${emp._acadRegressed||0}</strong></span>
    ${emp._acadAvgGain!=null?`<span>📊 Avg gain: <strong>${emp._acadAvgGain} pts</strong></span>`:''}
  </div>
  ${emp._acadYears?`<div style="margin-top:.375rem;font-size:.68rem;color:var(--muted)">Data spans: ${esc(emp._acadYears)}</div>`:''}
  <div style="margin-top:.375rem;font-size:.7rem;color:var(--muted)">
    ${emp._acadSubjects?'Subjects: '+esc(emp._acadSubjects)+' · ':''}${emp._acadDistricts?'Districts: '+esc(emp._acadDistricts.slice(0,60)):''}
    ${emp._acadCert?'· Cert: '+esc(emp._acadCert):''}
  </div>
</div>` : `<div style="padding:.5rem .75rem;background:var(--surface-2);border-radius:8px;font-size:.75rem;color:var(--muted)">i-Ready data not yet loaded. Open the i-Ready Lab panel first to enable this overlay.</div>`;

    // ── Site leader observations + T&D OTJ observations ──────────────────────
    const hasTndObs  = (emp._tndObsObserved || 0) > 0;
    const hasSLObs   = emp._obsCount > 0;
    const hasObs     = hasSLObs || hasTndObs;
    const obsBody = hasObs ? `
<div>
  ${hasSLObs ? `<div style="margin-bottom:.625rem">
    <div style="font-size:.65rem;font-weight:700;text-transform:uppercase;color:var(--muted);letter-spacing:.06em;margin-bottom:.375rem">📋 Site Leader Observations</div>
    <div style="display:flex;align-items:center;gap:.875rem;margin-bottom:.375rem;padding:.5rem .75rem;background:var(--surface-2);border-radius:8px">
      <span style="font-size:.8125rem"><strong>${emp._obsCount}</strong> observation${emp._obsCount!==1?'s':''}</span>
      ${emp._obsAvgRating!=null?`<span style="font-size:.8125rem">Avg rating: <strong style="color:${emp._obsAvgRating>=4?'#0d6e3a':emp._obsAvgRating>=3?'#d97706':'#b91c1c'}">${emp._obsAvgRating}/5</strong></span>`:''}
    </div>
    ${emp._obsLatest?`<div style="padding:.5rem .75rem;background:var(--surface-2);border-radius:8px;font-size:.75rem">
      <div style="font-size:.65rem;color:var(--muted);margin-bottom:.2rem">Most recent · ${esc(emp._obsLatest.date||'—')} · ${esc(emp._obsLatest.observer||'—')}</div>
      <div style="color:var(--navy)">${esc(emp._obsLatest.notes?.slice(0,200)||'No notes recorded')}</div>
      ${emp._obsLatest.rating?`<div style="margin-top:.3rem;font-size:.7rem;color:var(--muted)">Rating: ${esc(emp._obsLatest.rating)}</div>`:''}
    </div>`:''}
  </div>` : ''}
  ${hasTndObs ? `<div>
    <div style="font-size:.65rem;font-weight:700;text-transform:uppercase;color:var(--muted);letter-spacing:.06em;margin-bottom:.375rem">👁️ T&D OTJ Observations (Live Sheet)</div>
    <div style="display:flex;align-items:center;gap:.875rem;padding:.5rem .75rem;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;flex-wrap:wrap">
      <span style="font-size:.8125rem"><strong style="color:#0d6e3a">${emp._tndObsObserved}</strong> <span style="color:var(--muted)">observed</span></span>
      ${emp._tndObsMissed?`<span style="font-size:.8125rem"><strong style="color:#d97706">${emp._tndObsMissed}</strong> <span style="color:var(--muted)">missed/unlogged</span></span>`:''}
      ${emp._tndObsMonths?`<span style="font-size:.75rem;color:var(--muted)">${esc(emp._tndObsMonths)}</span>`:''}
      ${emp._tndObsLink?`<a href="${esc(emp._tndObsLink)}" target="_blank" rel="noopener" style="margin-left:auto;font-size:.75rem;color:#0369a1;font-weight:600;text-decoration:none">📄 View OTJ Sheet ↗</a>`:''}
    </div>
  </div>` : ''}
</div>` : (!(window._njtcTutorObs || window._njtcSLObs) ? `<div style="padding:.5rem .75rem;background:var(--surface-2);border-radius:8px;font-size:.75rem;color:var(--muted)">Observation data not yet loaded. Open T&D Analytics or trigger a data refresh.</div>` : `<div style="padding:.5rem .75rem;background:var(--surface-2);border-radius:8px;font-size:.75rem;color:var(--muted)">No observations on record for this employee.</div>`);

    // ── Concerns ─────────────────────────────────────────────────────
    const _liveConcernRecs = (window.CONCERNS||[]).filter(c=>c.emp===emp.n).sort((a,b)=>new Date(b.ts)-new Date(a.ts));
    const concernBody = (concernCount>0||emp.co===1||_liveConcernRecs.length>0) ? `
<div style="padding:.75rem;background:#fff7ed;border:1.5px solid #fed7aa;border-radius:8px">
  <div style="font-size:.8125rem;font-weight:700;color:#92400e;margin-bottom:.5rem">⚠️ Performance Concern${_liveConcernRecs.length>0?' ('+_liveConcernRecs.length+' on record)':''}</div>
  ${_liveConcernRecs.length>0
    ? _liveConcernRecs.map(c=>`<div style="margin-bottom:.5rem;padding:.4rem .6rem;background:#fff;border:1px solid #fed7aa;border-radius:6px">
        <div style="display:flex;align-items:center;gap:.4rem;flex-wrap:wrap">
          <span style="font-size:.78rem;font-weight:700;color:#92400e">${esc(c.concern_label||c.concern_type||'Concern')}</span>
          ${c.hr_action?`<span style="font-size:.68rem;padding:.1rem .4rem;background:#fee2e2;border-radius:4px;color:#b91c1c;font-weight:600">${esc(c.hr_action)}</span>`:''}
          <span style="margin-left:auto;font-size:.68rem;color:var(--muted)">${esc((c.ts||'').substring(0,10))}</span>
        </div>
        ${c.concern_detail?`<div style="font-size:.72rem;color:#78350f;margin-top:.25rem">${esc(c.concern_detail)}</div>`:''}
        ${c.hr_followup?`<div style="margin-top:.3rem;padding:.25rem .5rem;background:#eff6ff;border-left:2px solid #3b82f6;border-radius:0 4px 4px 0;font-size:.72rem;color:#1e40af"><span style="font-weight:700">HR Follow-Up:</span> ${esc(c.hr_followup)}</div>`:''}
      </div>`).join('')
    : `${emp.ct?`<div style="font-size:.8125rem;color:#78350f;margin-bottom:.25rem">${esc(emp.ct)}</div>`:''}
  ${emp.cd?`<div style="font-size:.7rem;color:var(--muted)">Recorded: ${esc(emp.cd)}</div>`:''}
  ${hrAction?`<div style="margin-top:.375rem;font-size:.75rem;background:#fee2e2;padding:.3rem .6rem;border-radius:6px;color:#b91c1c;font-weight:600">HR Action: ${esc(hrAction)}</div>`:''}`}
</div>` : '';

    // ── Hiring decision summary (bottom of card) ─────────────────────
    const hiringSignals = [];
    if (emp.c >= 3)                              hiringSignals.push({ico:'⭐', txt:'3+ cycles — proven retention', pos:true});
    if (emp.c >= 2 && emp.c < 3)                 hiringSignals.push({ico:'📅', txt:'Multi-cycle — building track record', pos:true});
    if ((emp.rh==='Yes'||emp.rh===true))         hiringSignals.push({ico:'🔁', txt:'Returning staff — rehired from previous cycle', pos:true});
    if (emp.mp>=3)                               hiringSignals.push({ico:'📈', txt:'Strong performance score ('+emp.mp+'/4)', pos:true});
    if (emp.mp!==null&&emp.mp<2)                 hiringSignals.push({ico:'📉', txt:'Below-threshold performance score', pos:false});
    if (att!==null&&att>=90)                     hiringSignals.push({ico:'🟢', txt:'Excellent attendance ('+att+'%)', pos:true});
    if (att!==null&&att<80)                      hiringSignals.push({ico:'🔴', txt:'Attendance concern ('+att+'%)', pos:false});
    if (concernCount>1)                          hiringSignals.push({ico:'⚠️', txt:concernCount+' active program concerns', pos:false});
    if (emp._obsCount>=3)                        hiringSignals.push({ico:'👁️', txt:emp._obsCount+' observations on record', pos:true});
    if (emp._acadPctMoved!=null&&emp._acadPctMoved>=50) hiringSignals.push({ico:'📚', txt:emp._acadPctMoved+'% scholars improved placement', pos:true});
    if (emp._acadPctMoved!=null&&emp._acadPctMoved<25)  hiringSignals.push({ico:'📉', txt:'Low scholar placement gains ('+emp._acadPctMoved+'%)', pos:false});

    const hiringBody = hiringSignals.length ? `
<div style="display:flex;flex-direction:column;gap:.35rem">
  ${hiringSignals.map(s=>`<div style="display:flex;align-items:flex-start;gap:.5rem;padding:.375rem .625rem;background:${s.pos?'#f0fdf4':'#fff7ed'};border:1px solid ${s.pos?'#bbf7d0':'#fed7aa'};border-radius:6px">
    <span>${s.ico}</span>
    <span style="font-size:.75rem;color:${s.pos?'#065f46':'#92400e'}">${s.txt}</span>
  </div>`).join('')}
</div>` : `<div style="font-size:.75rem;color:var(--muted);padding:.5rem .75rem;background:var(--surface-2);border-radius:8px">Insufficient data for hiring signals. Expand data sources to generate signals.</div>`;

    return `
<div style="background:linear-gradient(135deg,#0a1628,#1a3a6b);padding:1.375rem 1.75rem;color:#fff;position:relative">
  <div style="position:absolute;top:.875rem;right:.875rem;display:flex;align-items:center;gap:.4rem">
    ${(window.NJTC_SESSION||{}).dept==='data'?`<button onclick="window._hrExportProfilePDF(this.dataset.n)" data-n="${esc(emp.n)}" style="background:rgba(255,255,255,.18);border:1px solid rgba(255,255,255,.35);color:#fff;padding:.3rem .65rem;border-radius:5px;font-size:.65rem;font-weight:700;cursor:pointer" title="Export this profile as a printable PDF">📄 PDF</button><button onclick="window._hrExportProfileCSV(this.dataset.n)" data-n="${esc(emp.n)}" style="background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.25);color:#fff;padding:.3rem .65rem;border-radius:5px;font-size:.65rem;font-weight:700;cursor:pointer" title="Download this profile as a CSV row">⬇ CSV</button>`:''}
    <button onclick="document.getElementById('hrEmpModal').style.display='none'" style="background:rgba(255,255,255,.15);border:none;color:#fff;width:28px;height:28px;border-radius:50%;font-size:1rem;cursor:pointer;line-height:1">✕</button>
  </div>
  <div style="font-size:.55rem;font-weight:700;letter-spacing:.12em;color:rgba(255,255,255,.4);text-transform:uppercase;margin-bottom:.375rem">Employee Profile · NJTC ADP Intelligence</div>
  <div style="font-size:1.375rem;font-weight:800;margin-bottom:.2rem">${esc(emp.n)}</div>
  ${emp.a&&emp.a.length?`<div style="font-size:.7rem;color:rgba(255,255,255,.4)">Also listed as: ${emp.a.map(esc).join(', ')}</div>`:''}
  <div style="display:flex;gap:.5rem;flex-wrap:wrap;margin-top:.625rem;align-items:center">
    <span style="background:${cfg.bg};color:${cfg.color};padding:.2rem .5rem;border-radius:10px;font-size:.7rem;font-weight:700">${cfg.emoji} ${cfg.label}</span>
    <span style="font-size:.75rem;color:rgba(255,255,255,.6)">${esc(emp.r||'—')}</span>
    ${_statusDot(emp.s)}
    ${rhBadge}
  </div>
</div>
<div style="padding:1.25rem 1.75rem;max-height:78vh;overflow-y:auto">
  <!-- 5-KPI header row -->
  <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:.5rem;margin-bottom:1.125rem">
    ${[
      {v:emp.c!=null?emp.c:'—',                          l:'Cycles',          c:'var(--navy)'},
      {v:att!=null?att+'%':'—',                           l:`Att${liveLabel}`, c:_attColor(att)},
      {v:emp.je!=null?'★'+emp.je:'—',                    l:'Survey',          c:'#7c3aed'},
      {v:emp.mp!=null?emp.mp+'/4':'—',                   l:'Perf Score <span title="4 binary metrics from prior SY: Att Target · Scholar Enjoyment · Scholar Learning · Acad Improvement" style="cursor:help;font-size:.55rem">ⓘ</span>', c:emp.mp!=null?(emp.mp>=3?'#0d6e3a':emp.mp>=2?'#d97706':'#b91c1c'):'var(--muted)'},
      {v:(()=>{const t=(emp._obsCount||0)+(emp._tndObsObserved||0);return t>0?t:'—';})(), l:'Obs', c:'var(--navy)'},
    ].map(x=>`<div style="text-align:center;padding:.625rem .375rem;background:var(--surface-2);border-radius:8px">
      <div style="font-size:1.375rem;font-weight:800;color:${x.c};line-height:1">${esc(String(x.v??'—'))}</div>
      <div style="font-size:.6rem;color:var(--muted);margin-top:.2rem">${x.l}</div>
    </div>`).join('')}
  </div>

  ${sec('Employment & Assignment', uid+'_assign', employmentBody)}
  ${sec('Historical Performance Metrics', uid+'_metrics', metricsBody)}
  ${sec('i-Ready Academic Outcomes', uid+'_acad', acadBody, emp._acadScholars!=null)}
  ${concernBody ? sec('Program Concerns', uid+'_concern', concernBody, true) : ''}
  ${sec('Site Leader Observations', uid+'_obs', obsBody, hasObs)}
  ${sec('Hiring Decision Signals', uid+'_hiring', hiringBody, true)}
  ${(()=>{
    const _d = (window.NJTC_SESSION||{}).dept||'';
    if (!['hr','data'].includes(_d)) return '';
    const _ek = uid;
    const _en = emp.n;
    const _sy = '2025-2026';
    const existingRecs = _hiringGet(_ek).sort((a,b)=>b.ts.localeCompare(a.ts));
    const latestRec = existingRecs[0];
    const latestBadge = latestRec
      ? `<span style="padding:.2rem .6rem;border-radius:20px;font-size:.72rem;font-weight:700;background:${_H_BG[latestRec.d]||'#f3f4f6'};color:${_H_COLOR[latestRec.d]||'#374151'}">${esc(latestRec.d)}</span>`
      : '<span style="font-size:.72rem;color:var(--muted)">No decision yet</span>';
    const isOverride = !!latestRec;
    const sessionName = (window.NJTC_SESSION||{}).name || '';
    const overrideBanner = isOverride ? `
  <div style="margin-bottom:.625rem;padding:.5rem .625rem;background:#fff7ed;border:1px solid #fed7aa;border-radius:6px;font-size:.72rem;color:#92400e;line-height:1.5">
    <strong>⚠️ Overriding existing decision</strong> — a prior decision is already on record.
    Notes are <strong>required</strong>: explain who authorized this change and why.
  </div>` : '';
    const notesPlaceholder = isOverride
      ? 'Required — who authorized this change and why is the decision being updated?'
      : 'Notes — rationale, conditions, context...';
    const formLabel = isOverride ? `Override Decision · SY ${_sy}` : `Record New Decision · SY ${_sy}`;
    const byLine = sessionName
      ? `<div style="font-size:.68rem;color:var(--muted);margin-bottom:.4rem">Recorded by: <strong>${esc(sessionName)}</strong></div>` : '';
    const body = `<div>
  <div style="display:flex;align-items:center;gap:.5rem;margin-bottom:.625rem">${latestBadge}</div>
  <div id="hiring_records_${_ek}" style="margin-bottom:.75rem">${_hiringRecordsHtml(_ek)}</div>
  <div style="padding:.75rem;background:#f8fafc;border:1px solid var(--border);border-radius:8px">
    <div style="font-size:.68rem;font-weight:700;text-transform:uppercase;color:var(--muted);margin-bottom:.5rem;letter-spacing:.06em">${esc(formLabel)}</div>
    ${overrideBanner}
    ${byLine}
    <select id="hiring_sel_${_ek}" style="width:100%;padding:.4rem .6rem;border:1px solid var(--border);border-radius:6px;font-size:.8125rem;margin-bottom:.5rem;font-family:inherit;background:#fff">
      <option value="">— Select Decision —</option>
      <option value="Invite Back">✅ Invite Back</option>
      <option value="Conditional">⚠️ Conditional — Needs Review</option>
      <option value="Hold">⏸ Hold — Pending More Info</option>
      <option value="Do Not Rehire">🚫 Do Not Rehire</option>
    </select>
    <textarea id="hiring_notes_${_ek}" rows="3" placeholder="${esc(notesPlaceholder)}" style="width:100%;padding:.4rem .6rem;border:1px solid ${isOverride?'#fca5a5':'var(--border)'};border-radius:6px;font-size:.8125rem;margin-bottom:.5rem;resize:vertical;font-family:inherit;box-sizing:border-box"></textarea>
    <button id="hiring_save_${_ek}" onclick="_hrSaveHiringDecision('${_ek}','${_en.replace(/'/g,"&#39;")}',document.getElementById('hiring_sel_${_ek}').value,document.getElementById('hiring_notes_${_ek}').value,${isOverride})" style="padding:.4rem 1rem;background:#0a1628;color:#fff;border:none;border-radius:6px;font-size:.8125rem;font-weight:700;cursor:pointer;font-family:inherit">Save Decision</button>
  </div>
</div>`;
    return sec('🗂️ Hiring Decision Record', uid+'_hiringrec', body, true);
  })()}

  ${emp.tr?`<div style="font-size:.75rem;color:var(--muted);padding:.5rem .75rem;background:var(--surface-2);border-radius:6px;margin-bottom:.75rem">Termination reason: ${esc(emp.tr)}</div>`:''}
</div>`;
  }

  // ── Main profile panel router ─────────────────────────────────────────────
  // ── Live tier recalculation ────────────────────────────────────────
  // Adjusts static tier using live data: attendance, concerns, academic outcomes.
  // Does NOT permanently override emp.t (stored in _liveT for display).
  function _hrRecomputeTiers() {
    for (const emp of HR_EMPS) {
      let score = 0; let factors = 0;

      // Factor 1: Static performance score (0–4) — highest weight
      if (emp.mp !== null) {
        score += emp.mp * 2.5;  // max 10 pts
        factors++;
      }

      // Factor 2: Attendance
      const att = emp._liveAtt !== undefined ? emp._liveAtt : emp.att;
      if (att !== null && att !== undefined) {
        const attScore = att >= 95 ? 10 : att >= 90 ? 8 : att >= 85 ? 6 : att >= 80 ? 4 : att >= 75 ? 2 : 0;
        score += attScore;
        factors++;
      }

      // Factor 3: Academic outcomes (iReady) — if available
      if (emp._acadPctMoved !== null && emp._acadPctMoved !== undefined) {
        const acadScore = emp._acadPctMoved >= 60 ? 10 : emp._acadPctMoved >= 45 ? 8 : emp._acadPctMoved >= 30 ? 5 : emp._acadPctMoved >= 15 ? 2 : 0;
        score += acadScore;
        factors++;
      }

      // Factor 4: Program concerns (penalty)
      const concerns = emp._liveConcerns || 0;
      if (concerns > 0) { score -= concerns * 3; }

      // Factor 5: Cycles (longevity bonus)
      if (emp.c >= 3) score += 3;
      else if (emp.c >= 2) score += 1;

      // Compute effective tier if enough data
      if (factors < 1 || emp.mp === null) {
        emp._liveT = emp.t;  // keep static tier if no live data
        continue;
      }

      const maxScore = factors * 10 + 3;
      const pct = Math.max(0, score) / maxScore;
      emp._liveT = pct >= 0.75 ? 'stellar' : pct >= 0.55 ? 'strong' : pct >= 0.38 ? 'developing' : pct >= 0.2 ? 'needs_support' : 'needs_support';

      // Hard override: serious concern states → cap at needs_support
      const haAction = (emp._liveHRAction || emp.hn || '').toLowerCase();
      if (haAction.includes('termination') || haAction.includes('pgp')) {
        if (['stellar','strong'].includes(emp._liveT)) emp._liveT = 'needs_support';
      }
    }
  }

    // Overlay version tracking — skip re-applying if data hasn't changed
  let _hrOverlayVersion = 0;
  let _hrLastOverlayVersion = -1;

  function _hrInvalidateOverlay() { _hrOverlayVersion++; }  // call when data changes

  // ── Callback: fired by T&D module after obs maps are built ───────────────
  // Re-renders the profiles tab (if active) so obs timelines appear immediately
  // without the user needing to refresh.
  window._njtcObsReady = function() {
    _hrInvalidateOverlay();
    const lb = document.getElementById('talentTab-profiles');
    if (lb && lb.classList.contains('active')) {
      const le = document.getElementById('talentContent');
      if (le) {
        try {
          const dept = (window.NJTC_SESSION || {}).dept || 'hr';
          le.innerHTML = '<div id="hrProfilesRoot">' + _hrBuildProfiles(dept) + '</div>';
        } catch(e) { console.warn('[HR Profiles] Obs re-render failed:', e.message); }
      }
    }
  };

  // ── Staff Diversity & Equity Analytics ────────────────────────────────────
  function _buildStaffDiversityHtml(pool, title) {
    if (!pool || !pool.length) return '';
    const withRace = pool.filter(e => e._race && e._race !== '' && !/not listed|prefer not/i.test(e._race||''));
    const withEth  = pool.filter(e => e._ethnicity && e._ethnicity !== '' && !/not listed|prefer not/i.test(e._ethnicity||''));
    if (!withRace.length && !withEth.length) return '';
    const tot = pool.length;
    // Apprentices in this pool
    const apprentices = pool.filter(e => e._apprentice === 'Yes');
    // Race breakdown
    const raceMap = {};
    withRace.forEach(e => { const r = e._race||'Unknown'; raceMap[r] = (raceMap[r]||0)+1; });
    const nonWhiteCount = withRace.filter(e => (e._race||'').toLowerCase() !== 'white').length;
    const nonWhitePct   = withRace.length ? Math.round(nonWhiteCount/withRace.length*100) : 0;
    // Ethnicity breakdown
    const ethMap = {};
    withEth.forEach(e => { const v = e._ethnicity||'Unknown'; ethMap[v] = (ethMap[v]||0)+1; });
    const hispCount = withEth.filter(e => !/not hispanic/i.test(e._ethnicity||'') && /hispanic|latino/i.test(e._ethnicity||'')).length;
    const hispPct   = withEth.length ? Math.round(hispCount/withEth.length*100) : 0;
    // Combined: non-white OR Hispanic/Latino
    const diverseCount = pool.filter(e =>
      ((e._race||'').toLowerCase() !== 'white' && e._race && e._race !== '' && !/not listed|prefer not/i.test(e._race||'')) ||
      (!/not hispanic/i.test(e._ethnicity||'') && /hispanic|latino/i.test(e._ethnicity||''))
    ).length;
    const diversePct = tot ? Math.round(diverseCount/tot*100) : 0;
    const raceRows = Object.entries(raceMap).sort((a,b)=>b[1]-a[1]);
    const ethRows  = Object.entries(ethMap).sort((a,b)=>b[1]-a[1]);
    const pBar = (p, color) => `<div style="flex:1;height:6px;border-radius:99px;background:#f1f5f9;overflow:hidden"><div style="height:100%;width:${p}%;background:${color};border-radius:99px;transition:width .6s"></div></div>`;

    return `
<div style="padding:1rem 1.125rem;background:var(--surface);border:1.5px solid var(--border);border-radius:12px;margin-bottom:1.125rem;box-shadow:0 1px 4px rgba(0,0,0,.04)">
  <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:.875rem;flex-wrap:wrap;gap:.5rem">
    <div style="font-size:.7rem;font-weight:900;text-transform:uppercase;color:#475569;letter-spacing:.1em">👥 ${title||'Staff Diversity & Equity'}</div>
    <span style="font-size:.6rem;color:#94a3b8;font-weight:600">${tot} staff · ${withRace.length} race on file · ${withEth.length} ethnicity on file · Live HR Sheet</span>
  </div>
  <div style="display:flex;gap:.625rem;flex-wrap:wrap;margin-bottom:.875rem">
    <div style="background:linear-gradient(135deg,#0a1628,#003087);color:#fff;border-radius:10px;padding:.625rem .875rem;min-width:110px;text-align:center">
      <div style="font-size:1.5rem;font-weight:900;line-height:1;color:#f0a500">${diversePct}%</div>
      <div style="font-size:.62rem;opacity:.75;margin-top:.2rem">Non-White or Hispanic</div>
      <div style="font-size:.58rem;opacity:.45">${diverseCount} of ${tot} staff</div>
    </div>
    <div style="background:#f0fdf4;border:1.5px solid #bbf7d0;border-radius:10px;padding:.625rem .875rem;min-width:110px;text-align:center">
      <div style="font-size:1.5rem;font-weight:900;line-height:1;color:#059669">${nonWhitePct}%</div>
      <div style="font-size:.62rem;color:#065f46;margin-top:.2rem;font-weight:700">Non-White (Race)</div>
      <div style="font-size:.58rem;color:#94a3b8">${nonWhiteCount} of ${withRace.length} w/ race data</div>
    </div>
    <div style="background:#fef3c7;border:1.5px solid #fde68a;border-radius:10px;padding:.625rem .875rem;min-width:110px;text-align:center">
      <div style="font-size:1.5rem;font-weight:900;line-height:1;color:#d97706">${hispPct}%</div>
      <div style="font-size:.62rem;color:#92400e;margin-top:.2rem;font-weight:700">Hispanic / Latino</div>
      <div style="font-size:.58rem;color:#94a3b8">${hispCount} of ${withEth.length} w/ eth. data</div>
    </div>
  </div>
  ${raceRows.length ? `
  <div style="margin-bottom:.75rem">
    <div style="font-size:.6rem;font-weight:800;text-transform:uppercase;color:#94a3b8;letter-spacing:.08em;margin-bottom:.5rem">Race Distribution</div>
    ${raceRows.map(([race,n])=>{const p=withRace.length?Math.round(n/withRace.length*100):0;const isW=(race||'').toLowerCase()==='white';const bc=isW?'#cbd5e1':'#0050c8';return `<div style="display:flex;align-items:center;gap:.5rem;margin-bottom:.35rem"><div style="font-size:.67rem;font-weight:600;color:#1e293b;width:160px;flex-shrink:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(race)}</div>${pBar(p,bc)}<div style="font-size:.68rem;font-weight:800;color:${bc};width:30px;text-align:right;flex-shrink:0">${p}%</div><div style="font-size:.62rem;color:#94a3b8;width:28px;text-align:right;flex-shrink:0">${n}</div></div>`;}).join('')}
  </div>` : ''}
  ${ethRows.length ? `
  <div style="margin-bottom:.75rem">
    <div style="font-size:.6rem;font-weight:800;text-transform:uppercase;color:#94a3b8;letter-spacing:.08em;margin-bottom:.5rem">Ethnicity Distribution</div>
    ${ethRows.map(([eth,n])=>{const p=withEth.length?Math.round(n/withEth.length*100):0;const isH=/hispanic|latino/i.test(eth);const bc=isH?'#d97706':'#7c3aed';return `<div style="display:flex;align-items:center;gap:.5rem;margin-bottom:.35rem"><div style="font-size:.67rem;font-weight:600;color:#1e293b;width:160px;flex-shrink:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(eth)}</div>${pBar(p,bc)}<div style="font-size:.68rem;font-weight:800;color:${bc};width:30px;text-align:right;flex-shrink:0">${p}%</div><div style="font-size:.62rem;color:#94a3b8;width:28px;text-align:right;flex-shrink:0">${n}</div></div>`;}).join('')}
  </div>` : ''}
  ${(()=>{
    // Year-over-year race/ethnicity trend from _hrRaceByYear (populated from live HR sheet)
    const yrs = Object.keys(_hrRaceByYear||{}).sort().reverse();
    if (yrs.length < 2) return '';
    const yData = yrs.map(yr => {
      const d = _hrRaceByYear[yr];
      const nwPct  = d.withRace ? Math.round(d.nonWhite/d.withRace*100)  : null;
      const hPct   = d.withEth  ? Math.round(d.hispanic/d.withEth*100)   : null;
      const divPct = d.total    ? Math.round((d.nonWhite + (d.hispanic - (d.withRace ? _hrRaceByYear[yr].raceMap['Not Provided']||0 : 0))) / d.total * 100) : null;
      // Simpler: non-white % of those with race data
      return { yr, total: d.total, withRace: d.withRace, nwPct, hPct, withEth: d.withEth, raceMap: d.raceMap };
    });
    // Build year-over-year change indicators
    const yoyRows = yData.map((d, i) => {
      const prev = yData[i+1];
      const nwChg  = (prev && d.nwPct !== null && prev.nwPct !== null) ? d.nwPct - prev.nwPct : null;
      const hChg   = (prev && d.hPct  !== null && prev.hPct  !== null) ? d.hPct  - prev.hPct  : null;
      const nwChgStr = nwChg === null ? '—' : (nwChg > 0 ? `<span style="color:#0d6e3a;font-weight:800">▲${nwChg}pp</span>` : nwChg < 0 ? `<span style="color:#b91c1c;font-weight:800">▼${Math.abs(nwChg)}pp</span>` : `<span style="color:#94a3b8">→0pp</span>`);
      const hChgStr  = hChg  === null ? '—' : (hChg  > 0 ? `<span style="color:#0d6e3a;font-weight:800">▲${hChg}pp</span>`  : hChg  < 0 ? `<span style="color:#b91c1c;font-weight:800">▼${Math.abs(hChg)}pp</span>`  : `<span style="color:#94a3b8">→0pp</span>`);
      // Top 3 races this year
      const top3 = Object.entries(d.raceMap||{}).sort((a,b)=>b[1]-a[1]).slice(0,3)
        .map(([r,n])=>`<span style="font-size:.55rem;background:#f1f5f9;color:#334155;border-radius:4px;padding:.05rem .3rem">${r}: ${d.withRace?Math.round(n/d.withRace*100):0}%</span>`).join(' ');
      return `<tr>
        <td style="font-size:.68rem;font-weight:700;color:#0a1628;white-space:nowrap;padding:.3rem .5rem">${esc(d.yr)}</td>
        <td style="text-align:center;font-size:.68rem;color:#475569;padding:.3rem .4rem">${d.total}<br><span style="font-size:.55rem;color:#94a3b8">${d.withRace} w/ race</span></td>
        <td style="text-align:center;padding:.3rem .4rem">
          <span style="font-size:.82rem;font-weight:900;color:${d.nwPct!==null&&d.nwPct>=50?'#0050c8':'#334155'}">${d.nwPct!==null?d.nwPct+'%':'—'}</span>
          <div style="font-size:.6rem;margin-top:.1rem">${nwChgStr}</div>
        </td>
        <td style="text-align:center;padding:.3rem .4rem">
          <span style="font-size:.82rem;font-weight:900;color:${d.hPct!==null&&d.hPct>=20?'#d97706':'#334155'}">${d.hPct!==null?d.hPct+'%':'—'}</span>
          <div style="font-size:.6rem;margin-top:.1rem">${hChgStr}</div>
        </td>
        <td style="padding:.3rem .5rem;display:flex;gap:.2rem;flex-wrap:wrap;align-items:center">${top3}</td>
      </tr>`;
    }).join('');
    return `<div style="margin-bottom:.75rem">
    <div style="font-size:.6rem;font-weight:800;text-transform:uppercase;color:#94a3b8;letter-spacing:.08em;margin-bottom:.5rem">📅 Year-over-Year Race Trends
      <span style="font-weight:400;font-size:.55rem;color:#94a3b8;margin-left:.35rem" title="Unique staff per school year · Source: HR Master List (live sheet) · pp = percentage point change vs prior year. ▲ = increased representation, ▼ = decreased">ⓘ unique staff per SY · pp = percentage point change</span>
    </div>
    <div style="overflow-x:auto">
    <table style="width:100%;border-collapse:collapse;min-width:440px">
      <thead>
        <tr style="background:#f8fafc">
          <th style="font-size:.6rem;font-weight:700;color:#64748b;text-align:left;padding:.25rem .5rem;border-bottom:1.5px solid #e2e8f0">SY</th>
          <th style="font-size:.6rem;font-weight:700;color:#64748b;text-align:center;padding:.25rem .4rem;border-bottom:1.5px solid #e2e8f0">Total Staff</th>
          <th style="font-size:.6rem;font-weight:700;color:#0050c8;text-align:center;padding:.25rem .4rem;border-bottom:1.5px solid #e2e8f0">Non-White %<br><span style="color:#94a3b8;font-weight:400">(of w/ race)</span></th>
          <th style="font-size:.6rem;font-weight:700;color:#d97706;text-align:center;padding:.25rem .4rem;border-bottom:1.5px solid #e2e8f0">Hispanic/Latino<br><span style="color:#94a3b8;font-weight:400">(of w/ eth.)</span></th>
          <th style="font-size:.6rem;font-weight:700;color:#64748b;text-align:left;padding:.25rem .5rem;border-bottom:1.5px solid #e2e8f0">Top Races This SY</th>
        </tr>
      </thead>
      <tbody>${yoyRows}</tbody>
    </table>
    </div>
  </div>`;
  })()}
  ${(()=>{
    // DOL Apprentice race breakdown — sourced directly from raw live HR rows (col K),
    // deduped by name before matching, so count reflects true 30 not the 22 name-matched.
    const ard = window._liveApprenticeRaceData;
    if (!ard || !ard.total) return '';
    const appRaceRows = Object.entries(ard.raceMap).sort((a,b)=>b[1]-a[1]);
    return `<div style="margin-top:.875rem;padding:.75rem;background:#fefce8;border:1px solid #fde68a;border-radius:8px">
      <div style="font-size:.6rem;font-weight:800;text-transform:uppercase;color:#854d0e;letter-spacing:.08em;margin-bottom:.5rem">🎓 DOL Apprentices (${ard.total}) — Race & Ethnicity
        <span style="font-weight:400;font-size:.55rem;color:#a16207;margin-left:.35rem">col K · Live HR Dashboard · 2025-2026</span>
      </div>
      <div style="display:flex;gap:.5rem;flex-wrap:wrap;margin-bottom:.5rem">
        ${ard.withRace ? `<div style="text-align:center;padding:.4rem .6rem;background:#fff;border-radius:7px;min-width:90px">
          <div style="font-size:1rem;font-weight:900;color:#854d0e">${ard.nonWhitePct}%</div>
          <div style="font-size:.55rem;color:#92400e;font-weight:700">Non-White</div>
          <div style="font-size:.52rem;color:#94a3b8">${ard.nonWhite} of ${ard.withRace} w/ race data</div>
        </div>` : ''}
        ${ard.withEth ? `<div style="text-align:center;padding:.4rem .6rem;background:#fff;border-radius:7px;min-width:90px">
          <div style="font-size:1rem;font-weight:900;color:#b45309">${ard.hispanic}</div>
          <div style="font-size:.55rem;color:#92400e;font-weight:700">Hispanic/Latino</div>
          <div style="font-size:.52rem;color:#94a3b8">of ${ard.withEth} w/ eth. data</div>
        </div>` : ''}
        <div style="text-align:center;padding:.4rem .6rem;background:#fff;border-radius:7px;min-width:90px">
          <div style="font-size:1rem;font-weight:900;color:#92400e">${ard.total - ard.withRace}</div>
          <div style="font-size:.55rem;color:#92400e;font-weight:700">No Race On File</div>
          <div style="font-size:.52rem;color:#94a3b8">of ${ard.total} total appr.</div>
        </div>
      </div>
      ${appRaceRows.length ? `<div style="font-size:.6rem;font-weight:800;text-transform:uppercase;color:#a16207;letter-spacing:.07em;margin-bottom:.35rem">Race Breakdown</div>
        ${appRaceRows.map(([race,n])=>{const p=ard.withRace?Math.round(n/ard.withRace*100):0;const isW=(race||'').toLowerCase()==='white';const bc=isW?'#cbd5e1':'#d97706';return `<div style="display:flex;align-items:center;gap:.4rem;margin-bottom:.3rem"><div style="font-size:.63rem;font-weight:600;color:#1e293b;width:160px;flex-shrink:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(race)}</div>${pBar(p,bc)}<div style="font-size:.64rem;font-weight:800;color:${bc};width:28px;text-align:right;flex-shrink:0">${p}%</div><div style="font-size:.58rem;color:#94a3b8;width:22px;text-align:right;flex-shrink:0">${n}</div></div>`;}).join('')}` : '<div style="font-size:.63rem;color:#94a3b8;font-style:italic">Race data loading — will appear after live HR sheet syncs.</div>'}
    </div>`;
  })()}
</div>`;
  }

  // ── Central Team Staff Diversity Card ────────────────────────────────────
  // Renders a race/ethnicity breakdown card for central team staff using hardcoded
  // CENTRAL_TEAM_STAFF data. Used in Talent Analytics (top) and Home Dashboard.
  function _buildCentralTeamDiversityCard() {
    // Merge hardcoded CENTRAL_TEAM_STAFF with live HR_EMPS data for race/ethnicity lookup.
    // Priority: HR_EMPS live-overlay value → hardcoded value → empty.
    // Only Active staff count in diversity stats. Retired members are noted separately.
    const _hrPool = (typeof HR_EMPS !== 'undefined') ? HR_EMPS : [];
    const _normalize = n => (n||'').toLowerCase().replace(/[^a-z ]/g,'').trim();

    const merged = CENTRAL_TEAM_STAFF.map(ct => {
      // Look up in HR_EMPS by normalized name for live race/ethnicity overlay
      const match = _hrPool.find(e => _normalize(e.n) === _normalize(ct.n));
      const liveRace = (match && match._race  && match._race  !== '') ? match._race  : '';
      const liveEth  = (match && match._ethnicity && match._ethnicity !== '') ? match._ethnicity : '';
      return Object.assign({}, ct, {
        _race:      liveRace  || ct._race      || '',
        _ethnicity: liveEth   || ct._ethnicity || '',
      });
    });

    // Active pool only for diversity stats (excludes retired Jessica Kelly)
    const pool    = merged.filter(e => e.s === 'Active');
    const retired = merged.filter(e => e.s === 'Retired');
    const tot     = pool.length;

    // Consistent with _buildStaffDiversityHtml — exclude "not listed / prefer not" responses
    const withRace = pool.filter(e => e._race && e._race !== '' && !/not listed|prefer not/i.test(e._race||''));
    const withEth  = pool.filter(e => e._ethnicity && e._ethnicity !== '' && !/not listed|prefer not/i.test(e._ethnicity||''));
    const raceMap  = {};
    withRace.forEach(e => { const r = e._race; raceMap[r] = (raceMap[r]||0)+1; });
    const ethMap   = {};
    withEth.forEach(e => { const v = e._ethnicity; ethMap[v] = (ethMap[v]||0)+1; });
    const nonWhiteCount = withRace.filter(e => e._race.toLowerCase() !== 'white').length;
    const nonWhitePct   = withRace.length ? Math.round(nonWhiteCount/withRace.length*100) : 0;
    const hispCount     = withEth.filter(e => !/not hispanic/i.test(e._ethnicity||'') && /hispanic|latino/i.test(e._ethnicity||'')).length;
    const hispPct       = tot ? Math.round(hispCount/tot*100) : 0;
    const diverseCount  = pool.filter(e =>
      ((e._race||'').toLowerCase() !== 'white' && e._race && e._race !== '' && !/not listed|prefer not/i.test(e._race||'')) ||
      (!/not hispanic/i.test(e._ethnicity||'') && /hispanic|latino/i.test(e._ethnicity||''))
    ).length;
    const diversePct   = tot ? Math.round(diverseCount/tot*100) : 0;
    const raceRows     = Object.entries(raceMap).sort((a,b)=>b[1]-a[1]);
    const ethRows      = Object.entries(ethMap).sort((a,b)=>b[1]-a[1]);
    const pBar         = (p, color) => `<div style="flex:1;height:6px;border-radius:99px;background:#f1f5f9;overflow:hidden"><div style="height:100%;width:${p}%;background:${color};border-radius:99px;transition:width .6s"></div></div>`;
    const unknownCount = pool.filter(e => !e._race && !e._ethnicity).length;
    const liveCount    = pool.filter(e => {
      const m = _hrPool.find(h => _normalize(h.n) === _normalize(e.n));
      return m && (m._race || m._ethnicity);
    }).length;

    return `
<div style="padding:1rem 1.125rem;background:var(--surface);border:2px solid #c7d2fe;border-radius:12px;margin-bottom:1.125rem;box-shadow:0 1px 4px rgba(0,0,0,.06)">
  <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:.875rem;flex-wrap:wrap;gap:.5rem">
    <div style="font-size:.7rem;font-weight:900;text-transform:uppercase;color:#3730a3;letter-spacing:.1em">🏢 Central Team Staff — Race &amp; Ethnicity</div>
    <span style="font-size:.6rem;color:#6366f1;font-weight:600;background:#eef2ff;border:1px solid #c7d2fe;border-radius:6px;padding:.15rem .5rem">${tot} active · ${withRace.length} race on file · ${withEth.length} ethnicity on file${liveCount ? ' · ' + liveCount + ' from live HR' : ''}</span>
  </div>
  <div style="display:flex;gap:.625rem;flex-wrap:wrap;margin-bottom:.875rem">
    <div style="background:linear-gradient(135deg,#1e1b4b,#3730a3);color:#fff;border-radius:10px;padding:.625rem .875rem;min-width:110px;text-align:center">
      <div style="font-size:1.5rem;font-weight:900;line-height:1;color:#a5b4fc">${diversePct}%</div>
      <div style="font-size:.62rem;opacity:.75;margin-top:.2rem">Non-White or Hispanic</div>
      <div style="font-size:.58rem;opacity:.45">${diverseCount} of ${tot} active</div>
    </div>
    <div style="background:#f0fdf4;border:1.5px solid #bbf7d0;border-radius:10px;padding:.625rem .875rem;min-width:110px;text-align:center">
      <div style="font-size:1.5rem;font-weight:900;line-height:1;color:#059669">${nonWhitePct}%</div>
      <div style="font-size:.62rem;color:#065f46;margin-top:.2rem;font-weight:700">Non-White (Race)</div>
      <div style="font-size:.58rem;color:#94a3b8">${nonWhiteCount} of ${withRace.length} w/ race data</div>
    </div>
    <div style="background:#fef3c7;border:1.5px solid #fde68a;border-radius:10px;padding:.625rem .875rem;min-width:110px;text-align:center">
      <div style="font-size:1.5rem;font-weight:900;line-height:1;color:#d97706">${hispPct}%</div>
      <div style="font-size:.62rem;color:#92400e;margin-top:.2rem;font-weight:700">Hispanic / Latino</div>
      <div style="font-size:.58rem;color:#94a3b8">${hispCount} of ${tot} active</div>
    </div>
  </div>
  ${raceRows.length ? `
  <div style="margin-bottom:.75rem">
    <div style="font-size:.6rem;font-weight:800;text-transform:uppercase;color:#94a3b8;letter-spacing:.08em;margin-bottom:.5rem">Race Distribution</div>
    ${raceRows.map(([race,n])=>{const p=withRace.length?Math.round(n/withRace.length*100):0;const isW=race.toLowerCase()==='white';const bc=isW?'#cbd5e1':'#6366f1';return `<div style="display:flex;align-items:center;gap:.5rem;margin-bottom:.35rem"><div style="font-size:.67rem;font-weight:600;color:#1e293b;width:160px;flex-shrink:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(race)}</div>${pBar(p,bc)}<div style="font-size:.68rem;font-weight:800;color:${bc};width:30px;text-align:right;flex-shrink:0">${p}%</div><div style="font-size:.62rem;color:#94a3b8;width:28px;text-align:right;flex-shrink:0">${n}</div></div>`;}).join('')}
  </div>` : ''}
  ${ethRows.length ? `
  <div style="margin-bottom:.75rem">
    <div style="font-size:.6rem;font-weight:800;text-transform:uppercase;color:#94a3b8;letter-spacing:.08em;margin-bottom:.5rem">Ethnicity Distribution</div>
    ${ethRows.map(([eth,n])=>{const p=withEth.length?Math.round(n/withEth.length*100):0;const bc='#d97706';return `<div style="display:flex;align-items:center;gap:.5rem;margin-bottom:.35rem"><div style="font-size:.67rem;font-weight:600;color:#1e293b;width:160px;flex-shrink:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(eth)}</div>${pBar(p,bc)}<div style="font-size:.68rem;font-weight:800;color:${bc};width:30px;text-align:right;flex-shrink:0">${p}%</div><div style="font-size:.62rem;color:#94a3b8;width:28px;text-align:right;flex-shrink:0">${n}</div></div>`;}).join('')}
  </div>` : ''}
  ${unknownCount ? `<div style="font-size:.6rem;color:#94a3b8;font-style:italic;border-top:1px solid #f1f5f9;padding-top:.5rem;margin-top:.25rem">⚠️ ${unknownCount} active staff member${unknownCount>1?'s':''} — race/ethnicity pending on HR Master List (will auto-populate on live sync).</div>` : ''}
  ${retired.length ? `<div style="margin-top:.625rem;padding:.5rem .75rem;background:#f8fafc;border:1px solid #e2e8f0;border-radius:7px;font-size:.62rem;color:#64748b">
    <span style="font-weight:800;color:#94a3b8;text-transform:uppercase;letter-spacing:.06em;font-size:.58rem">Retired This SY</span>
    ${retired.map(e=>`<div style="margin-top:.25rem"><strong>${esc(e.n)}</strong>${e._retiredDate?' — retired '+esc(e._retiredDate):''}${e._retiredNote?' · <em>'+esc(e._retiredNote)+'</em>':''}</div>`).join('')}
  </div>` : ''}
  <div style="font-size:.58rem;color:#a5b4fc;font-weight:600;margin-top:.5rem">Hardcoded per staff self-identification · Live HR overlay for Lintz, Petty, Tittermary · Active staff only in diversity stats</div>
</div>`;
  }

  // ── Summer 2026 Profiles (Tracker-based) ────────────────────────────────────
  let _pSummerMode = false; // toggle between SY and Summer profiles

  function _buildSummerProfiles(dept) {
    const tracker = window.NJTC_ONSITE_TRACKER || [];
    const sumRows = tracker.filter(r => r.isSummer);
    if (!sumRows.length) {
      return `<div style="padding:2rem;text-align:center;color:var(--muted)">
        <div style="font-size:2rem;margin-bottom:.75rem">☀️</div>
        <div style="font-weight:600;margin-bottom:.5rem">Summer 2026 tracker not loaded</div>
        <div style="font-size:.82rem">Open <strong>SY Site Analytics</strong> → click <strong>☀️ Summer 2026</strong> to load tracker data, then return here.</div>
      </div>`;
    }

    const esc = s => (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    const pip = (label, val) => {
      const ok = val && val.toLowerCase() !== 'no' && val.toLowerCase() !== 'n/a' && val.toLowerCase() !== 'not eligible';
      return `<span style="font-size:.62rem;font-weight:700;padding:.18rem .45rem;border-radius:5px;background:${ok?'#d1fae5':'#f1f5f9'};color:${ok?'#065f46':'#94a3b8'}">${ok?'✓':''} ${label}</span>`;
    };

    const showFull = ['hr','data'].includes(dept);
    const emps     = sumRows.filter(r => !r.isPreApp);
    const preApps  = sumRows.filter(r => r.isPreApp);

    let _sumQ = '';
    let _sumRoleFilter = '';

    const buildCard = (r, isEmp) => {
      const statusBg    = r.isTerminated ? '#fee2e2' : r.isActive ? '#d1fae5' : '#f1f5f9';
      const statusColor = r.isTerminated ? '#b91c1c' : r.isActive ? '#065f46' : '#64748b';
      const statusLabel = r.isTerminated ? 'Terminated' : r.isActive ? 'Active' : 'Pending';
      const roleLabel   = isEmp ? (r.role || 'Staff') : 'Pre-Apprentice';
      const location    = [r.location, r.county || r.district].filter(Boolean).join(' · ');
      const termBadge   = r.isTerminated && (r.termDate || r.resignType) ? `<div style="margin-top:.35rem;padding:.25rem .5rem;background:#fff1f2;border:1px solid #fecaca;border-radius:5px;font-size:.62rem;color:#b91c1c">
        ${r.termDate ? 'Term: ' + r.termDate + ' · ' : ''}${r.resignType || ''}${r.resignReason ? ' · ' + r.resignReason : ''}
      </div>` : '';

      return `<div style="background:var(--surface);border:1.5px solid ${r.isTerminated?'#fecaca':r.isActive?'#bbf7d0':'var(--border)'};border-radius:12px;padding:1.125rem;display:flex;flex-direction:column;gap:.5rem">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:.5rem">
          <div>
            <div style="font-size:.92rem;font-weight:800;color:var(--navy)">${esc(r.fullName || r.firstName + ' ' + r.lastName)}</div>
            <div style="font-size:.72rem;color:var(--muted);margin-top:.15rem">${esc(roleLabel)}${location ? ' · ' + esc(location) : ''}</div>
          </div>
          <span style="font-size:.6rem;font-weight:700;padding:.18rem .5rem;border-radius:20px;background:${statusBg};color:${statusColor};white-space:nowrap">${statusLabel}</span>
        </div>
        <div style="display:flex;gap:.3rem;flex-wrap:wrap;margin-top:.1rem">
          ${pip('ADP', r.adpProfile)}
          ${pip('Offer Sent', r.offerSent)}
          ${pip('Accepted', r.offerAccepted)}
          ${pip('Welcome Email', r.welcomeEmail)}
          ${pip('I-9 Docs', r.i9Docs)}
          ${pip('Fingerprint', r.fingerprint)}
          ${isEmp ? '' : pip('TAP Registered', r.tapRegistered)}
        </div>
        ${r.email && showFull ? `<div style="font-size:.65rem;color:#6366f1">${esc(r.email)}</div>` : ''}
        ${termBadge}
      </div>`;
    };

    const activeEmps = emps.filter(r => r.isActive && !r.isTerminated);
    const termEmps   = emps.filter(r => r.isTerminated);
    const pendEmps   = emps.filter(r => !r.isActive && !r.isTerminated);

    const grid = arr => arr.length ? `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(290px,1fr));gap:.875rem">${arr.map(r=>buildCard(r,true)).join('')}</div>` : '<p style="color:var(--muted);font-size:.82rem">None</p>';
    const preGrid = arr => arr.length ? `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(290px,1fr));gap:.875rem">${arr.map(r=>buildCard(r,false)).join('')}</div>` : '<p style="color:var(--muted);font-size:.82rem">None</p>';

    const section = (title, count, content, accent) => `
      <div style="margin-bottom:1.75rem">
        <div style="font-size:.75rem;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:${accent||'var(--muted)'};margin-bottom:.75rem">${title} <span style="font-weight:400;opacity:.7">(${count})</span></div>
        ${content}
      </div>`;

    return `<div style="padding:.25rem 0">
      <!-- Summary strip -->
      <div style="display:flex;gap:.75rem;flex-wrap:wrap;margin-bottom:1.5rem">
        <div style="background:var(--surface);border:1.5px solid var(--border);border-radius:10px;padding:1rem 1.25rem;text-align:center;flex:1;min-width:120px">
          <div style="font-size:1.75rem;font-weight:800;color:#059669">${activeEmps.length}</div>
          <div style="font-size:.7rem;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.05em">Active Employees</div>
        </div>
        <div style="background:var(--surface);border:1.5px solid var(--border);border-radius:10px;padding:1rem 1.25rem;text-align:center;flex:1;min-width:120px">
          <div style="font-size:1.75rem;font-weight:800;color:#6366f1">${preApps.filter(r=>r.isActive).length}</div>
          <div style="font-size:.7rem;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.05em">Pre-Apprentices</div>
        </div>
        <div style="background:var(--surface);border:1.5px solid var(--border);border-radius:10px;padding:1rem 1.25rem;text-align:center;flex:1;min-width:120px">
          <div style="font-size:1.75rem;font-weight:800;color:#dc2626">${termEmps.length}</div>
          <div style="font-size:.7rem;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.05em">Terminated</div>
        </div>
        <div style="background:var(--surface);border:1.5px solid var(--border);border-radius:10px;padding:1rem 1.25rem;text-align:center;flex:1;min-width:120px">
          <div style="font-size:1.75rem;font-weight:800;color:#d97706">${pendEmps.length}</div>
          <div style="font-size:.7rem;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.05em">Offer Pending</div>
        </div>
      </div>
      <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:.6rem .875rem;font-size:.75rem;color:#065f46;margin-bottom:1.5rem">
        ☀️ Summer 2026 · Sourced from live Onboarding Tracker · Pearl performance data not yet available for summer
      </div>
      ${section('Active Employees', activeEmps.length, grid(activeEmps), '#059669')}
      ${pendEmps.length ? section('Offer Pending / Not Yet Active', pendEmps.length, grid(pendEmps), '#d97706') : ''}
      ${termEmps.length ? section('Terminated', termEmps.length, grid(termEmps), '#dc2626') : ''}
      ${section('Pre-Apprentices (not employees)', preApps.filter(r=>r.isActive).length, preGrid(preApps.filter(r=>r.isActive)), '#6366f1')}
    </div>`;
  }

  function _hrBuildProfiles(dept) {
    // Pre-fetch obs maps when programming dept opens Profiles (T&D tabs may not have been visited yet)
    if (dept === 'programming' && !window._njtcTutorObs && !window._njtcSLObs) {
      if (typeof window._njtcFetchObsData === 'function') {
        window._njtcFetchObsData();  // async; re-renders via _njtcObsReady callback when done
      }
    }
    // Only re-apply overlays when data has actually changed (prevents cascade re-renders)
    if (_hrOverlayVersion !== _hrLastOverlayVersion) {
      _hrOverlayConcerns();
      _hrOverlayPearl();
      _hrOverlayAcademic();
      if (_obsRows.length) _hrOverlayObs();
      if (window._njtcTutorObs) _hrOverlayTndObs();  // T&D OTJ observation sheet
      _hrRecomputeTiers();
      _hrLastOverlayVersion = _hrOverlayVersion;
    }
    // Summer mode: only HR and Data can see tracker-based summer profiles
    if (_pSummerMode && ['hr','data'].includes(dept)) {
      const toggle = `<div style="display:flex;gap:.5rem;align-items:center;margin-bottom:1.25rem;flex-wrap:wrap">
        <span style="font-size:.72rem;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.07em">Period</span>
        <button onclick="window._hrSetSummerMode(false)" style="font-size:.78rem;padding:.35rem .8rem;border-radius:8px;border:1.5px solid var(--border);background:var(--surface);color:var(--navy);cursor:pointer;font-weight:600">📅 SY 2025-2026</button>
        <button style="font-size:.78rem;padding:.35rem .8rem;border-radius:8px;border:2px solid #059669;background:#d1fae5;color:#065f46;cursor:pointer;font-weight:700">☀️ Summer 2026</button>
      </div>`;
      return toggle + _buildSummerProfiles(dept);
    }
    const showFull = ['hr','data'].includes(dept);
    // Period toggle strip — prepend to full SY view for HR and Data
    const _syToggle = showFull ? `<div style="display:flex;gap:.5rem;align-items:center;margin-bottom:1.25rem;flex-wrap:wrap">
        <span style="font-size:.72rem;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.07em">Period</span>
        <button style="font-size:.78rem;padding:.35rem .8rem;border-radius:8px;border:2px solid var(--navy);background:var(--navy);color:#fff;cursor:pointer;font-weight:700">📅 SY 2025-2026</button>
        <button onclick="window._hrSetSummerMode(true)" style="font-size:.78rem;padding:.35rem .8rem;border-radius:8px;border:1.5px solid var(--border);background:var(--surface);color:var(--navy);cursor:pointer;font-weight:600">☀️ Summer 2026</button>
      </div>` : '';
    if (dept==='kb')           return _hrViewKB();
    if (dept==='finance')      return _hrViewFinance();
    if (dept==='leadership')   return _hrViewLeadership();
    if (dept==='programming')  return _hrViewProgramming();
    if (dept==='training')     return _hrViewTraining();
    if (showFull)              return _syToggle + _hrViewFull();
    return '';
  }

  // ── Programming Dept Profile View — Onsite Performance Profile ───────────
  function _hrViewProgramming() {
    const esc = s => (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

    // ── Helpers ──────────────────────────────────────────────────────────────
    function median(arr) {
      if (!arr || !arr.length) return null;
      const s = arr.slice().sort((a,b)=>a-b);
      const m = Math.floor(s.length/2);
      return s.length % 2 ? s[m] : (s[m-1]+s[m])/2;
    }

    const NE_KW_D   = ['ilearn','i-learn','paterson','pcsst','paterson charter','hoboken','middlesex','central jersey'];
    const SW_KW_D   = ['american paradigm','first philadelphia','first philly','philadelphia charter','string theory','global leadership academy','global leadership','penns grove','carneys point','haddon township','haddon','hamilton township','gloucester township'];
    const SW_SCHOOLS= ['erial','loring flemming','field street','penns grove middle','van sciver','strawbridge','first philadelphia prep','first philly prep','the philadelphia charter','philadelphia charter school','global leadership academy'];

    function tutorRegion(emp, pearlSchools) {
      // Classify a single text (school or district name) against keyword lists
      function _classifyText(text) {
        const t = (text||'').toLowerCase();
        if (NE_KW_D.some(k=>t.includes(k)))    return 'NE';
        if (SW_KW_D.some(k=>t.includes(k)))    return 'SW';
        if (SW_SCHOOLS.some(k=>t.includes(k))) return 'SW';
        return null;
      }
      // Prefer Pearl operational data (where tutor actually works in SY 2025-2026)
      if (pearlSchools && pearlSchools.length) {
        const votes = { NE: 0, SW: 0 };
        pearlSchools.forEach(s => {
          const r = _classifyText(s);
          if (r) votes[r]++;
        });
        if (votes.NE > votes.SW) return 'NE';
        if (votes.SW > votes.NE) return 'SW';
        // Tie-break or partial: first definitive match wins
        for (const s of pearlSchools) {
          const r = _classifyText(s);
          if (r) return r;
        }
      }
      // Fall back to HR-recorded district/school
      const r = _classifyText(emp.di) || _classifyText(emp.si);
      return r || 'NE';
    }

    function normName(n) { return (n||'').toLowerCase().replace(/\s+/g,' ').trim(); }

    // ── Pearl data — pre-computed ONCE for all tutors (O(n) not O(n×m)) ───────
    // All three APIs iterate potentially thousands of rows. Calling per-employee
    // would cost ~550k iterations for 50 employees. We build maps keyed by
    // normName once, then do O(1) lookups in buildMetrics.
    const attMap      = (window.po && window.po.getTutorAttendanceMap) ? window.po.getTutorAttendanceMap() : {};
    const lateFilers  = (window.po && window.po.getLateFilerStats)    ? window.po.getLateFilerStats().flagged : [];
    const lateFilerMap = {}; // normName → { late, lateRate }
    lateFilers.forEach(f => { lateFilerMap[normName(f.name)] = { late: f.late || 0, lateRate: f.lateRate || 0 }; });

    // Survey scores map — keyed by normName(result.name)
    const _allSurveyMap = {};
    try {
      if (window.po && window.po.getTutorSurveyScores) {
        window.po.getTutorSurveyScores().forEach(s => { _allSurveyMap[normName(s.name)] = s; });
      }
    } catch(e) { console.warn('[Talent] survey pre-compute error:', e); }

    // Session stats map — keyed by normName(result.name)
    const _allSessMap = {};
    try {
      if (window.po && window.po.getTutorSessionStats) {
        window.po.getTutorSessionStats().forEach(s => { _allSessMap[normName(s.name)] = s; });
      }
    } catch(e) { console.warn('[Talent] session pre-compute error:', e); }

    // Academic impact map — keyed by normName(result.name)
    const _allAcadMap = {};
    try {
      if (window.irlab && window.irlab.getTutorAcademicImpact) {
        const _allAcad = window.irlab.getTutorAcademicImpact(); // returns all tutors
        if (Array.isArray(_allAcad)) {
          _allAcad.forEach(a => { _allAcadMap[normName(a.name)] = a; });
        }
      }
    } catch(e) { console.warn('[Talent] acad pre-compute error:', e); }

    // Build per-tutor Pearl metrics — all lookups are now O(1)
    function buildMetrics(emp) {
      // Attendance — live overlay first, then stored value
      const att = emp._liveAtt != null ? emp._liveAtt
                : (emp.att != null ? emp.att : null);

      const nm = normName(emp.n);

      // Survey scores — O(1) map lookup; fall back to Pearl overlay for hyphenated names
      // where normName() can't bridge the HR ↔ Pearl name gap.
      const survEntry  = _allSurveyMap[nm] || emp._liveSurveyEntry || null;
      const confMed    = survEntry ? survEntry.confidence : null;
      const enjoyMed   = survEntry ? survEntry.enjoyment  : null;
      const learnMed   = survEntry ? survEntry.learning   : null;
      const returnMed  = survEntry ? survEntry.overall    : null;
      const survCount  = survEntry ? survEntry.count       : 0;

      // Session stats — O(1) map lookup; fall back to Pearl overlay for hyphenated names
      const sessEntry  = _allSessMap[nm] || emp._liveSessEntry || null;
      const survComp      = sessEntry ? sessEntry.survComp    : null;
      const incompleteCount = sessEntry ? sessEntry.incomplete : null;
      const incompleteRate  = (sessEntry && sessEntry.total > 0)
                              ? Math.round(sessEntry.incomplete / sessEntry.total * 100) : null;
      const totalSessions   = sessEntry ? sessEntry.total : null;
      const scholarCount    = sessEntry ? (sessEntry.scholarCount || 0) : null;
      // Schools: prefer Pearl overlay (_liveSchools) so region + location use active 2025-26 sites
      const tutorSchools    = (emp._liveSchools && emp._liveSchools.length)
                              ? emp._liveSchools
                              : (sessEntry ? (sessEntry.schools || []) : []);

      // Late surveys — from precomputed lateFilerMap (only populated for ≥50% late rate)
      const _lateEntry  = lateFilerMap[nm] || null;
      const lateSurveys = _lateEntry ? _lateEntry.late     : null;
      const lateRate    = _lateEntry ? _lateEntry.lateRate : null;

      // Academic impact — O(1) map lookup (pre-computed above)
      const acadEntry  = _allAcadMap[nm] || null;

      return {
        att, survComp, lateSurveys, lateRate, incompleteCount, incompleteRate, totalSessions,
        returnMed, enjoyMed, confMed, learnMed, survCount, acadEntry,
        scholarCount, tutorSchools
      };
    }

    // Support Status: evaluates 6 signals, returns { level:'ok'|'warn'|'critical', reasons:[] }
    function supportStatus(emp, m) {
      const co = emp._liveConcerns != null ? emp._liveConcerns : (emp.co||0);
      const reasons=[]; let level='ok';
      const bump = (to) => { if (to==='critical') level='critical'; else if (to==='warn'&&level==='ok') level='warn'; };
      if (m.att!=null&&m.att<70)  { reasons.push('Attendance critical (<70%)');          bump('critical'); }
      else if (m.att!=null&&m.att<80) { reasons.push('Attendance low (<80%)');           bump('warn'); }
      if (m.survComp!=null&&m.survComp<40) { reasons.push('Survey completion very low (<40%)'); bump('warn'); }
      else if (m.survComp!=null&&m.survComp<60) { reasons.push('Survey completion low (<60%)'); bump('warn'); }
      if (m.returnMed!=null&&m.returnMed<3.0) { reasons.push('Scholar return score critical (<3.0)'); bump('critical'); }
      else if (m.returnMed!=null&&m.returnMed<3.5) { reasons.push('Scholar return score low (<3.5)');  bump('warn'); }
      if (m.enjoyMed!=null&&m.enjoyMed<3.0) { reasons.push('Scholar enjoyment critical (<3.0)'); bump('critical'); }
      else if (m.enjoyMed!=null&&m.enjoyMed<3.5) { reasons.push('Scholar enjoyment low (<3.5)');  bump('warn'); }
      if (m.confMed!=null&&m.confMed<3.0)  { reasons.push('Scholar confidence critical (<3.0)');  bump('critical'); }
      else if (m.confMed!=null&&m.confMed<3.5) { reasons.push('Scholar confidence low (<3.5)');    bump('warn'); }
      if (m.learnMed!=null&&m.learnMed<3.0) { reasons.push('Scholar learning score critical (<3.0)'); bump('critical'); }
      else if (m.learnMed!=null&&m.learnMed<3.5) { reasons.push('Scholar learning score low (<3.5)');  bump('warn'); }
      if (m.lateRate!=null&&m.lateRate>=75) { reasons.push(m.lateRate+'% of surveys submitted late'); bump('critical'); }
      else if (m.lateRate!=null&&m.lateRate>=50) { reasons.push(m.lateRate+'% of surveys submitted late'); bump('warn'); }
      if (co>=2) { reasons.push(co+' concern logs on file'); bump('critical'); }
      else if (co===1) { reasons.push('1 concern log on file'); bump('warn'); }
      if (m.incompleteRate!=null&&m.incompleteRate>30) { reasons.push('High incomplete session rate ('+m.incompleteRate+'%)'); bump('warn'); }
      return { level, reasons };
    }

    // Active pool (exclude Terminated)
    const pool = HR_EMPS.filter(e => e.s !== 'Terminated');

    // Pre-compute all tutor profiles
    const profileData = pool.map(emp => {
      const metrics = buildMetrics(emp);
      const { level, reasons } = supportStatus(emp, metrics);
      const region = tutorRegion(emp, metrics.tutorSchools);
      return { emp, metrics, level, reasons, region };
    });

    // KPI banner stats (median-based)
    const activeCount  = profileData.length;
    const needAttention= profileData.filter(p=>p.level!=='ok').length;
    const allAtt    = profileData.map(p=>p.metrics.att).filter(v=>v!=null);
    const allReturn = profileData.map(p=>p.metrics.returnMed).filter(v=>v!=null);
    const medAtt    = median(allAtt);
    const medReturn = median(allReturn);

    // Filter
    const levelOrder = { critical:0, warn:1, ok:2 };
    let filtered = profileData.filter(p => {
      if (_ppStatus === 'attention' && p.level === 'ok')       return false;
      if (_ppStatus === 'escalate'  && p.level !== 'critical') return false;
      if (_ppStatus === 'support'   && p.level !== 'warn')     return false;
      if (_ppStatus === 'on_track'  && p.level !== 'ok')       return false;
      if (_ppRegion !== 'all' && p.region !== _ppRegion)       return false;
      if (_ppQ) {
        const q = _ppQ.toLowerCase();
        if (!p.emp.n.toLowerCase().includes(q) && !(p.emp.si||'').toLowerCase().includes(q)) return false;
      }
      return true;
    });
    filtered.sort((a,b) => a.emp.n.localeCompare(b.emp.n));

    // ── Chip & badge helpers ────────────────────────────────────────────────
    const CHIP_TIPS = {
      att:       'Percentage of scheduled sessions the tutor attended. Live from Pearl. <80% = Support Needed; <70% = Escalate.',
      sessions:  'Total sessions on record for this tutor in Pearl.',
      survComp:  'Percentage of this tutor\'s sessions with at least one scholar survey submitted. Computed via session-level matching. Low rates may reflect session-log gaps.',
      lateSurv:  'Number of surveys this tutor submitted after the expected weekly deadline. Late submissions reduce weekly reporting accuracy.',
      incomplete: 'Sessions marked Incomplete in Pearl (no actual duration logged). High rates signal reporting discipline issues.',
      returnMed:  'AVERAGE scholar response to "Overall, how was this session?" (1-5). Computed from all scholar surveys for sessions led by this tutor.',
      enjoyMed:   'AVERAGE scholar response to "How much did you enjoy this session?" (1-5). Computed from all scholar surveys for sessions led by this tutor.',
      confMed:    'AVERAGE scholar response to "How confident did you feel?" (1-5). Higher scores indicate tutors build scholar self-efficacy.',
      learnMed:   'AVERAGE scholar response to "How much did you learn?" (1-5). Directly reflects perceived instructional effectiveness.',
    };

    function metricChip(label, val, color, tipKey) {
      const tip = (CHIP_TIPS[tipKey]||'').replace(/'/g,'&#39;').replace(/"/g,'&quot;');
      return '<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:7px;padding:.45rem .6rem;min-width:100px">'
        +'<div style="display:flex;align-items:center;gap:.2rem;margin-bottom:2px">'
        +'<span style="font-size:.67rem;color:#64748b;text-transform:uppercase;letter-spacing:.04em;font-weight:600">'+label+'</span>'
        +'<span onclick="_ppShowTip(this.dataset.tip)" data-tip="'+tip+'" style="font-size:.62rem;color:#94a3b8;cursor:pointer;line-height:1;flex-shrink:0" title="More info">\u24d8</span>'
        +'</div>'
        +'<div style="font-size:.88rem;font-weight:800;color:'+color+'">'+val+'</div>'
        +'</div>';
    }

    function statusBadge(level, reasons) {
      const cfg = {
        critical:{ label:'Escalate to HR', bg:'#fef2f2', col:'#b91c1c', border:'#fecaca', icon:'\uD83D\uDD34' },
        warn:    { label:'Support Needed',  bg:'#fffbeb', col:'#92400e', border:'#fde68a', icon:'\uD83D\uDFE1' },
        ok:      { label:'On Track',        bg:'#f0fdf4', col:'#166534', border:'#bbf7d0', icon:'\u2705'       }
      };
      const c   = cfg[level]||cfg.ok;
      const tip = (reasons.length ? reasons.join(' \u00B7 ') : 'No flags detected across all monitored signals.').replace(/'/g,'&#39;').replace(/"/g,'&quot;');
      return '<span onclick="_ppShowTip(this.dataset.tip)" data-tip="'+tip+'" style="display:inline-flex;align-items:center;gap:.3rem;font-size:.72rem;padding:.2rem .55rem;border-radius:999px;font-weight:700;background:'+c.bg+';color:'+c.col+';border:1px solid '+c.border+';cursor:pointer">'
        +c.icon+' '+c.label+' \u24d8</span>';
    }

    // ── OTJ badges ──────────────────────────────────────────────────────────
    function otjBadges(emp) {
      const nm = normName(emp.n);
      let otjRow = null;
      if (window.njtcOTJMap && window.njtcOTJMap[nm]) {
        otjRow = window.njtcOTJMap[nm];
      } else if (window.njtcOTJ) {
        const arr = Array.isArray(window.njtcOTJ)
          ? window.njtcOTJ
          : [...(window.njtcOTJ.NE||[]), ...(window.njtcOTJ.SW||[])];
        const parts = nm.split(' ');
        const first = arr.find(r => {
          const rn = normName((r['Tutor First']||'')+' '+(r['Tutor Last (ADP)']||''));
          return rn === nm || (parts[0] && rn.startsWith(parts[0]));
        });
        if (first) otjRow = first;
      }
      if (!otjRow) return '<span style="font-size:.72rem;color:#94a3b8;font-style:italic">OTJ data not found</span>';

      const phases = ['Beginning','Middle','End'];
      const badges = phases.map(ph => {
        const val = ((otjRow[ph]||otjRow[ph+' Phase'])||'').toLowerCase();
        const done = val.includes('complete')||val==='yes';
        const ip   = val.includes('progress');
        const bg   = done?'#f0fdf4':ip?'#fffbeb':'#f8fafc';
        const col  = done?'#166534':ip?'#92400e':'#64748b';
        const bdr  = done?'#bbf7d0':ip?'#fde68a':'#e2e8f0';
        const icon = done?'\u2705':ip?'\uD83D\uDD04':'\u2B1C';
        return '<span style="font-size:.7rem;padding:.15rem .45rem;border-radius:5px;font-weight:600;background:'+bg+';color:'+col+';border:1px solid '+bdr+'">'+icon+' '+ph+'</span>';
      }).join('');
      const link = otjRow['Link']||otjRow['OTJ Link']||otjRow['Checklist Link']||null;
      const linkHtml = link
        ? '<a href="'+esc(link)+'" target="_blank" rel="noopener" style="font-size:.7rem;color:#2563eb;text-decoration:underline;margin-left:.4rem">\uD83D\uDCCB View Checklist</a>'
        : '<span style="font-size:.7rem;color:#94a3b8;margin-left:.4rem">No checklist link</span>';
      return '<div style="display:flex;gap:.35rem;align-items:center;flex-wrap:wrap">'+badges+linkHtml+'</div>';
    }

    // ── Observation timeline ────────────────────────────────────────────────
    const OBS_MONTHS = ['Oct','Nov','Dec','Jan','Feb','Mar','Apr','May','Jun'];
    function obsTimeline(emp) {
      const hasAnyMap = !!(window._njtcTutorObs || window._njtcSLObs);
      if (!hasAnyMap)
        return '<span style="font-size:.72rem;color:#94a3b8;font-style:italic">Observation data not yet connected</span>';

      const nm = normName(emp.n);

      // Fuzzy token-subset lookup — handles abbreviated/middle-initial name mismatches
      function fuzzyLookup(map) {
        if (!map) return null;
        if (map[nm]) return map[nm];
        // Fallback: every token in the shorter name must appear in the longer
        const np = nm.split(' ').filter(t => t.length > 1);
        if (np.length < 2) return null;
        const npSet = new Set(np);
        for (const [k, v] of Object.entries(map)) {
          const kp = new Set(k.split(' ').filter(t => t.length > 1));
          if ([...npSet].every(p => kp.has(p)) || [...kp].every(p => npSet.has(p))) return v;
        }
        return null;
      }

      // Site leaders use the SL obs map first; tutors use tutor obs map first.
      const isSL = /site.?leader|instructional.?coach/i.test(emp.r || '');
      const tutorObs = (isSL ? fuzzyLookup(window._njtcSLObs) : null)
                    || fuzzyLookup(window._njtcTutorObs)
                    || (isSL ? null : fuzzyLookup(window._njtcSLObs))
                    || null;

      if (!tutorObs || !tutorObs.length)
        return '<span style="font-size:.72rem;color:#94a3b8;font-style:italic">No observations on file</span>';

      const pills = OBS_MONTHS.map(mo => {
        const entry = tutorObs.find(o=>(o.month||'').includes(mo));
        let bg='#f1f5f9', col='#94a3b8', title2=mo;
        let inner = mo;
        if (entry) {
          if (entry.observed) {
            bg='#dbeafe'; col='#1d4ed8'; title2='Observed '+(entry.date||'');
            inner = entry.link ? '<a href="'+esc(entry.link)+'" target="_blank" rel="noopener" style="color:#1d4ed8;text-decoration:none">'+mo+'</a>' : mo;
          } else if (entry.missed && entry.note) {
            bg='#fef3c7'; col='#92400e'; title2='Missed \u2014 '+entry.note;
          } else if (entry.missed) {
            bg='#fee2e2'; col='#b91c1c'; title2='Missed';
          }
        }
        return '<span title="'+esc(title2)+'" style="font-size:.65rem;font-weight:600;padding:.1rem .35rem;border-radius:4px;background:'+bg+';color:'+col+';white-space:nowrap">'+inner+'</span>';
      }).join('');
      return '<div style="display:flex;gap:.25rem;flex-wrap:wrap;align-items:center"><span style="font-size:.68rem;color:#94a3b8;margin-right:.1rem;white-space:nowrap">Obs:</span>'+pills+'</div>';
    }

    // ── Build cards ─────────────────────────────────────────────────────────
    const borderColorMap = { critical:'#ef4444', warn:'#f59e0b', ok:'#10b981' };
    const cards = filtered.map(({ emp, metrics, level, reasons, region }) => {
      const { att, survComp, lateSurveys, lateRate, incompleteCount, incompleteRate, totalSessions,
              returnMed, enjoyMed, confMed, learnMed, survCount, acadEntry,
              scholarCount, tutorSchools } = metrics;
      const co = emp._liveConcerns != null ? emp._liveConcerns : (emp.co||0);

      const attVal   = att!=null ? att.toFixed(1)+'%' : '\u2014';
      const attColor = att==null?'#94a3b8':att<70?'#b91c1c':att<80?'#d97706':'#059669';
      const survVal  = survComp!=null ? survComp+'%' : '\u2014';
      const survColor= survComp==null?'#94a3b8':survComp<40?'#b91c1c':survComp<60?'#d97706':'#059669';
      // Late surveys: ≥50% late rate flags → show "N late (X%)", else "✓ On Time"
      const lateVal  = lateRate!=null ? lateSurveys+' late ('+lateRate+'%)' : '\u2713 On Time';
      const lateColor= lateRate==null?'#059669':lateRate>=75?'#b91c1c':'#d97706';
      const incVal   = incompleteCount!=null
        ? incompleteCount+(incompleteRate!=null?' ('+incompleteRate+'%)':'') : '\u2014';
      const incColor = incompleteCount==null?'#94a3b8':incompleteCount===0?'#059669':incompleteRate!=null&&incompleteRate>30?'#b91c1c':'#d97706';
      const retVal   = returnMed!=null ? returnMed.toFixed(2)+' / 5' : '\u2014';
      const retColor = returnMed==null?'#94a3b8':returnMed<3.0?'#b91c1c':returnMed<3.5?'#d97706':'#059669';
      const enjVal   = enjoyMed!=null ? enjoyMed.toFixed(2)+' / 5' : '\u2014';
      const enjColor = enjoyMed==null?'#94a3b8':enjoyMed<3.0?'#b91c1c':enjoyMed<3.5?'#d97706':'#059669';
      const confVal  = confMed!=null ? confMed.toFixed(2)+' / 5' : '\u2014';
      const confColor= confMed==null?'#94a3b8':confMed<3.0?'#b91c1c':confMed<3.5?'#d97706':'#059669';
      const learnVal = learnMed!=null ? learnMed.toFixed(2)+' / 5' : '\u2014';
      const learnColor=learnMed==null?'#94a3b8':learnMed<3.0?'#b91c1c':learnMed<3.5?'#d97706':'#059669';
      const sessVal  = totalSessions!=null ? String(totalSessions) : '\u2014';

      // Scholar survey count note (n = number of survey responses)
      const survCountNote = survCount > 0
        ? '<div style="font-size:.62rem;color:#94a3b8;margin-top:.15rem">Based on '+survCount+' scholar response'+(survCount!==1?'s':'')+' · avg scores (not median)</div>'
        : '<div style="font-size:.62rem;color:#94a3b8;margin-top:.15rem">No scholar survey responses on file</div>';

      // Academic impact row — pctTypical already in % units from getTutorAcademicImpact
      // (mathMedianPctTypical = Math.round(ratio * 100), e.g. 55 = 55% of typical growth)
      // N = mathRecords / elaRecords (scholars with valid pctTypical data, not total scholars)
      let acadRow = '';
      if (acadEntry) {
        const mathPct   = acadEntry.mathMedianPctTypical!=null ? acadEntry.mathMedianPctTypical+'%' : '\u2014';
        const elaPct    = acadEntry.elaMedianPctTypical!=null  ? acadEntry.elaMedianPctTypical+'%'  : '\u2014';
        const mPct      = acadEntry.mathMedianPctTypical;
        const ePct      = acadEntry.elaMedianPctTypical;
        const mathColor = mPct==null?'#94a3b8':mPct>=100?'#059669':mPct>=60?'#d97706':'#b91c1c';
        const elaColor  = ePct==null?'#94a3b8':ePct>=100?'#059669':ePct>=60?'#d97706':'#b91c1c';
        const mN        = acadEntry.mathRecords || 0;
        const eN        = acadEntry.elaRecords  || 0;
        acadRow = '<div style="margin-top:.4rem;padding:.35rem .6rem;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:6px">'
          +'<div style="font-size:.62rem;font-weight:700;color:#166534;text-transform:uppercase;letter-spacing:.05em;margin-bottom:.2rem">📊 iReady · Median % of Typical Growth ('+esc(acadEntry.yearSpan)+')</div>'
          +'<div style="display:flex;gap:.75rem;flex-wrap:wrap;align-items:baseline">'
          +(mN>0?'<span style="font-size:.8rem;font-weight:800;color:'+mathColor+'">Math '+mathPct+'</span><span style="font-size:.62rem;color:#64748b">n='+mN+'</span>':'')
          +(eN>0?'<span style="font-size:.8rem;font-weight:800;color:'+elaColor+'">ELA '+elaPct+'</span><span style="font-size:.62rem;color:#64748b">n='+eN+'</span>':'')
          +'<span style="font-size:.62rem;color:#94a3b8;font-style:italic">scholars may overlap across tutors</span>'
          +'</div>'
          +'</div>';
      }

      // Concern log (expandable)
      const coId = 'ppco_'+emp.n.replace(/\W/g,'_');
      const concernRows = (typeof CONCERNS!=='undefined'?CONCERNS:[])
        .filter(c=>c.emp===emp.n).sort((a,b)=>new Date(b.ts)-new Date(a.ts));
      const concernHtml = concernRows.length>0
        ? '<div style="margin-top:.5rem;border-top:1px solid #f1f5f9;padding-top:.4rem">'
          +'<button id="'+coId+'_btn" onclick="_hrToggle(\''+coId+'\')" style="font-size:.7rem;background:none;border:none;color:#94a3b8;cursor:pointer;padding:0">'
          +'\u25B6 Show '+concernRows.length+' concern log'+(concernRows.length>1?'s':'')+'</button>'
          +'<div id="'+coId+'" style="display:none;margin-top:.4rem">'
          +concernRows.map(c=>'<div style="font-size:.72rem;padding:.3rem .5rem;background:#fef2f2;border-radius:5px;margin-bottom:.25rem">'
            +'<span style="font-weight:600;color:#b91c1c">'+esc(c.concern_type||'Concern')+'</span>'
            +(c.hr_action?'<span style="margin-left:.4rem;font-size:.68rem;color:#92400e;background:#fffbeb;padding:.1rem .3rem;border-radius:3px">'+esc(c.hr_action)+'</span>':'')
            +'<span style="float:right;color:#94a3b8">'+esc((c.ts||'').substring(0,10))+'</span>'
            +(c.concern_detail?'<div style="margin-top:.2rem;color:#64748b">'+esc(c.concern_detail)+'</div>':'')
            +(c.hr_followup?'<div style="margin-top:.25rem;padding:.2rem .4rem;background:#eff6ff;border-left:2px solid #3b82f6;border-radius:0 4px 4px 0;color:#1e40af;font-size:.68rem"><span style="font-weight:700">HR Follow-Up:</span> '+esc(c.hr_followup)+'</div>':'')
            +'</div>').join('')
          +'</div></div>'
        : '';

      // ── Site Leader Obs for this tutor's school ───────────────────────────────
      // Looks up school in _njtcSLObsBySchool (keyed by normalized school name)
      let slObsSection = '';
      const schoolName = (emp.si || '').trim();
      if (schoolName && window._njtcSLObsBySchool) {
        const schoolKey = normName(schoolName);
        // Fuzzy: try exact then token-subset
        let slEntry = window._njtcSLObsBySchool[schoolKey] || null;
        if (!slEntry) {
          const kp = new Set(schoolKey.split(' ').filter(t=>t.length>2));
          for (const [k2, v2] of Object.entries(window._njtcSLObsBySchool)) {
            const k2p = new Set(k2.split(' ').filter(t=>t.length>2));
            if ([...kp].every(p=>k2p.has(p)) || [...k2p].every(p=>kp.has(p))) { slEntry=v2; break; }
          }
        }
        if (slEntry) {
          const slN = slEntry.obsEntries.length;
          const slLink = slN > 0 ? (slEntry.obsEntries.find(e=>e.link)||{}).link : null;
          const slMonths = [...new Set(slEntry.obsEntries.map(e=>e.month))].join(' · ');
          const slLatestNote = slN > 0 ? (slEntry.obsEntries[slN-1].notes||'').trim() : '';
          slObsSection = '<div style="margin-top:.35rem;padding:.3rem .55rem;background:#eff6ff;border:1px solid #bfdbfe;border-radius:6px;font-size:.68rem">'
            +'<span style="font-weight:700;color:#1d4ed8">🏫 Site Leader: '+esc(slEntry.sl)+'</span>'
            +'<span style="color:#64748b;margin-left:.4rem">'+slN+' obs'+( slMonths?' ('+slMonths+')':'')+' </span>'
            +(slLink?'<a href="'+esc(slLink)+'" target="_blank" rel="noopener" style="color:#2563eb;text-decoration:underline;margin-left:.25rem">📁 View Folder</a>':'')
            +(slLatestNote?'<div style="color:#475569;margin-top:.15rem;font-style:italic">'+esc(slLatestNote)+'</div>':'')
            +'</div>';
        } else {
          slObsSection = '<div style="margin-top:.35rem;font-size:.67rem;color:#94a3b8;font-style:italic">No SL observation record found for this school</div>';
        }
      }

      // ── Formal Obs summary (from live obs overlay sheet) ──────────────────────
      let formalObsSection = '';
      if (emp._obsCount > 0) {
        const obsRatingBadge = emp._obsAvgRating!=null
          ? '<span style="font-weight:800;color:'+(emp._obsAvgRating>=4?'#059669':emp._obsAvgRating>=3?'#d97706':'#b91c1c')+'"> '+emp._obsAvgRating+'/5</span>'
          : '';
        formalObsSection = '<div style="margin-top:.35rem;padding:.35rem .55rem;background:#faf5ff;border:1px solid #e9d5ff;border-radius:6px;font-size:.68rem">'
          +'<span style="font-weight:700;color:#7c3aed">👁 Formal Obs: '+emp._obsCount+'</span>'+obsRatingBadge
          +(emp._obsLatest ? ' · <span style="color:#64748b">Last: '+esc(emp._obsLatest.date||'')+(emp._obsLatest.observer?' by '+esc(emp._obsLatest.observer):'')+'</span>' : '')
          +(emp._obsLatest && emp._obsLatest.notes ? '<div style="color:#475569;margin-top:.15rem;font-style:italic">'+esc((emp._obsLatest.notes||'').slice(0,120))+(emp._obsLatest.notes.length>120?'…':'')+'</div>' : '')
          +'</div>';
      }

      // ── Active HR flag (programming-visible, discrete) ────────────────────────
      const hrFlagBanner = emp._liveHRAction
        ? '<div style="margin-top:.35rem;padding:.25rem .55rem;background:#fef3c7;border:1px solid #fcd34d;border-radius:6px;font-size:.68rem;font-weight:700;color:#92400e">⚠️ Active HR Action on file — contact HR for details</div>'
        : '';

      // ── Scholar reach badge ────────────────────────────────────────────────────
      const scholarBadge = (scholarCount != null && scholarCount > 0)
        ? '<span style="background:#f0fdf4;border:1px solid #bbf7d0;color:#166534;padding:.1rem .4rem;border-radius:5px;font-size:.65rem;font-weight:700">'+scholarCount+' scholars</span>'
        : '';

      // ── NEW: Weekly Recap button (reuses the existing concern-log expand
      // pattern for consistency). Content is fetched lazily on first open —
      // see window._hrShowRecaps below — from the same live Google Sheet the
      // onsite portal's Weekly Recap feature writes to.
      const wrId = 'ppwr_'+emp.n.replace(/\W/g,'_');
      const weeklyRecapSection = '<div style="margin-top:.5rem;border-top:1px solid #f1f5f9;padding-top:.4rem">'
        +'<button onclick="window._hrShowRecaps(\''+esc(emp.n).replace(/'/g,"\\'")+'\',\''+wrId+'\')" '
        +'style="font-size:.72rem;font-weight:700;background:#eff6ff;border:1px solid #bfdbfe;color:#1d4ed8;padding:.3rem .65rem;border-radius:6px;cursor:pointer">'
        +'📋 Weekly Recaps</button>'
        +'<div id="'+wrId+'" style="display:none;margin-top:.5rem"></div>'
        +'</div>';

      const bl = borderColorMap[level]||'#10b981';
      return '<div style="background:#fff;border:1px solid #e2e8f0;border-left:4px solid '+bl+';border-radius:10px;padding:1rem 1.1rem;margin-bottom:.75rem;box-shadow:0 1px 3px rgba(0,0,0,.06)">'
        // Header
        +'<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:.75rem;flex-wrap:wrap;margin-bottom:.55rem">'
          +'<div>'
            +'<div style="font-weight:700;font-size:.95rem;color:#1e293b">'+esc(emp.n)+'</div>'
            +'<div style="font-size:.75rem;color:#64748b;margin-top:2px;display:flex;gap:.35rem;align-items:center;flex-wrap:wrap">'
              +'<span>'+esc(emp.r||'Tutor')+' \u00B7 '+(tutorSchools.length?esc(tutorSchools.slice(0,2).join(', ')):esc(emp.si||emp.di||'\u2014'))+'</span>'
              +(tutorSchools.length?'<span style="font-size:.55rem;color:#38bdf8;font-weight:700" title="Active Pearl locations this SY">\u25CF Live</span>':'')
              +'<span style="background:#e0f2fe;color:#0369a1;padding:.1rem .35rem;border-radius:4px;font-size:.65rem;font-weight:700">'+region+'</span>'
              +(emp._apprentice==='Yes'?'<span style="background:#fef9c3;color:#854d0e;padding:.1rem .35rem;border-radius:5px;font-size:.65rem;font-weight:700;border:1px solid #fde68a">\uD83C\uDF93 Apprentice</span>':'')
              +scholarBadge
            +'</div>'
          +'</div>'
          +'<div>'+statusBadge(level,reasons)+'</div>'
        +'</div>'
        +hrFlagBanner
        // Row 1 — attendance, session logistics
        +'<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(110px,1fr));gap:.4rem;margin-bottom:.4rem;margin-top:.4rem">'
          +metricChip('Attendance',   attVal,  attColor,  'att')
          +metricChip('Sessions',     sessVal, '#64748b',  'sessions')
          +metricChip('Incomplete',   incVal,  incColor,  'incomplete')
          +metricChip('Late Surveys', lateVal, lateColor, 'lateSurv')
          +metricChip('Surv. Comp.',  survVal, survColor, 'survComp')
        +'</div>'
        // Row 2 — scholar survey scores
        +'<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(110px,1fr));gap:.4rem;margin-bottom:.2rem">'
          +metricChip('Return (avg)',  retVal,   retColor,   'returnMed')
          +metricChip('Enjoy (avg)',   enjVal,   enjColor,   'enjoyMed')
          +metricChip('Confidence',    confVal,  confColor,  'confMed')
          +metricChip('Learning',      learnVal, learnColor, 'learnMed')
        +'</div>'
        +survCountNote
        // Academic impact (iReady)
        +acadRow
        // Observation timeline (Apprentice Tracker — month pills)
        +'<div style="margin-top:.4rem;margin-bottom:.2rem">'+obsTimeline(emp)+'</div>'
        // Formal obs summary (live obs sheet)
        +formalObsSection
        // Site leader obs at this school
        +slObsSection
        // OTJ progress
        +'<div style="margin-top:.4rem;margin-bottom:.25rem">'
          +'<span style="font-size:.65rem;color:#94a3b8;text-transform:uppercase;letter-spacing:.04em;font-weight:600;margin-right:.4rem">OTJ:</span>'
          +otjBadges(emp)
        +'</div>'
        +concernHtml
        +weeklyRecapSection
        +'</div>';
    });

    // ── KPI banner ──────────────────────────────────────────────────────────
    const allEnjoy  = profileData.map(p=>p.metrics.enjoyMed).filter(v=>v!=null);
    const allConf   = profileData.map(p=>p.metrics.confMed).filter(v=>v!=null);
    const medEnjoy  = median(allEnjoy);
    const medConf   = median(allConf);
    const kpiBanner = '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:.6rem;margin-bottom:1.1rem">'
      +[
        { label:'Active Staff',      val:activeCount,   color:'#1d4ed8', sub:'', click:'' },
        { label:'Need Attention',    val:needAttention, color:needAttention>0?'#b91c1c':'#059669', sub:'click to filter',
          click:"_ppSetStatus(_ppStatus==='attention'?'all':'attention')" },
        { label:'Median Attendance', val:medAtt!=null?(medAtt.toFixed(1)+'%'):'\u2014', color:medAtt!=null&&medAtt<80?'#d97706':'#059669', sub:'active staff', click:'' },
        { label:'Median Return',     val:medReturn!=null?medReturn.toFixed(2):'\u2014', color:medReturn!=null&&medReturn<3.5?'#d97706':'#059669', sub:'scholar survey', click:'' },
        { label:'Median Enjoyment',  val:medEnjoy!=null?medEnjoy.toFixed(2):'\u2014', color:medEnjoy!=null&&medEnjoy<3.5?'#d97706':'#059669', sub:'scholar survey', click:'' },
        { label:'Median Confidence', val:medConf!=null?medConf.toFixed(2):'\u2014',  color:medConf!=null&&medConf<3.5?'#d97706':'#059669', sub:'scholar survey', click:'' },
      ].map(s=>'<div '+(s.click?'onclick="'+s.click+'" ':'')+' style="background:#fff;border:1px solid #e2e8f0;border-radius:8px;padding:.65rem .8rem;text-align:center'+(s.click?';cursor:pointer':'')+'">'
          +'<div style="font-size:1.35rem;font-weight:800;color:'+s.color+'">'+s.val+'</div>'
          +'<div style="font-size:.68rem;color:#64748b;text-transform:uppercase;letter-spacing:.04em;margin-top:1px;font-weight:600">'+s.label+'</div>'
          +(s.sub?'<div style="font-size:.6rem;color:#94a3b8;margin-top:1px">'+s.sub+'</div>':'')
        +'</div>').join('')
      +'</div>';

    // ── Filter bar ──────────────────────────────────────────────────────────
    const regions = ['all',...new Set(profileData.map(p=>p.region).filter(Boolean))].sort((a,b)=>a==='all'?-1:b==='all'?1:a.localeCompare(b));
    const filterBar = '<div style="display:flex;gap:.5rem;align-items:center;flex-wrap:wrap;margin-bottom:1rem;padding:.6rem .75rem;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px">'
      +'<select onchange="_ppSetStatus(this.value)" style="font-size:.78rem;padding:.3rem .5rem;border:1px solid #cbd5e1;border-radius:6px;background:#fff;color:#374151;font-family:inherit">'
        +'<option value="all"'+(_ppStatus==='all'?' selected':'')+'>All Statuses</option>'
        +'<option value="attention"'+(_ppStatus==='attention'?' selected':'')+'>All Flagged</option>'
        +'<option value="escalate"'+(_ppStatus==='escalate'?' selected':'')+'>&#128308; Escalate to HR</option>'
        +'<option value="support"'+(_ppStatus==='support'?' selected':'')+'>&#128993; Support Needed</option>'
        +'<option value="on_track"'+(_ppStatus==='on_track'?' selected':'')+'>&#9989; On Track</option>'
      +'</select>'
      +'<select onchange="_ppSetRegion(this.value)" style="font-size:.78rem;padding:.3rem .5rem;border:1px solid #cbd5e1;border-radius:6px;background:#fff;color:#374151;font-family:inherit">'
        +regions.map(r=>'<option value="'+r+'"'+(_ppRegion===r?' selected':'')+'>'+( r==='all'?'All Regions':r)+'</option>').join('')
      +'</select>'
      +'<input id="ppSearchInput" type="text" placeholder="Search name or site\u2026" value="'+esc(_ppQ)+'" oninput="_ppSetQ(this.value)" style="font-size:.78rem;padding:.3rem .6rem;border:1px solid #cbd5e1;border-radius:6px;flex:1;min-width:140px;color:#374151;font-family:inherit">'
      +(_ppStatus!=='all'||_ppRegion!=='all'||_ppQ ? '<button onclick="_ppClear()" style="font-size:.75rem;padding:.3rem .55rem;border:1px solid #cbd5e1;border-radius:6px;background:#fff;color:#64748b;cursor:pointer">\u2715 Clear</button>' : '')
      +'<span style="font-size:.72rem;color:#94a3b8;margin-left:auto">'+filtered.length+' of '+activeCount+' shown</span>'
      +'</div>';

    // ── Tooltip modal ────────────────────────────────────────────────────────
    const tipModal = '<div id="ppTipModal" onclick="this.style.display=\'none\'" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:9999">'
      +'<div onclick="event.stopPropagation()" style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);background:#fff;border-radius:10px;padding:1.25rem 1.5rem;max-width:420px;width:90%;box-shadow:0 8px 32px rgba(0,0,0,.18)">'
        +'<button onclick="document.getElementById(\'ppTipModal\').style.display=\'none\'" style="position:absolute;top:.6rem;right:.8rem;background:none;border:none;font-size:1.1rem;cursor:pointer;color:#94a3b8">\u2715</button>'
        +'<div id="ppTipText" style="font-size:.84rem;color:#1e293b;line-height:1.6"></div>'
      +'</div>'
      +'</div>';

    return '<div style="padding:.25rem 0">'
      +tipModal
      +kpiBanner
      +filterBar
      +'<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(520px,1fr));gap:.65rem">'
      +(cards.length ? cards.join('') : '<div style="grid-column:1/-1;color:#94a3b8;font-style:italic;text-align:center;padding:2rem">No staff match the current filters.</div>')
      +'</div>'
      +'<div style="font-size:.65rem;color:#94a3b8;margin-top:.75rem;line-height:1.5">'
        +'Attendance: live from Pearl \u00B7 Scholar scores: avg of all survey responses for sessions led by this tutor \u00B7 Survey completion: % of sessions with \u22651 scholar survey submitted'
        +' \u00B7 iReady: MEDIAN % of typical growth; n = scholars w/ valid spring data; same scholar may appear across tutors \u00B7 Late surveys: flagged if \u226550% of submissions are late'
        +' \u00B7 Terminated staff excluded'
      +'</div>'
      +'</div>';
  }

  // ── Training & Development Dept Profile View ─────────────────────────────
  function _hrViewTraining() {
    const esc = s => (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

    const pool = HR_EMPS.filter(e => e.s === 'Active');
    const withSurv = pool.filter(e => e.je != null && e.jl != null);
    const survRate = pool.length ? Math.round(withSurv.length / pool.length * 100) : 0;

    // Survey completion note: surveys only deploy when ≥1 scholar attends
    // So survey rate is % of active staff with qualifying sessions who responded
    const withAtt = pool.filter(e => (e._liveAtt ?? e.att) != null && (e._liveAtt ?? e.att) > 0);
    const eligibleForSurvey = withAtt.length;  // tutors with attendance > 0 are eligible
    const survCompleteRate = eligibleForSurvey
      ? Math.round(withSurv.length / eligibleForSurvey * 100) : 0;

    // Group by satisfaction zone for PD targeting
    const high    = withSurv.filter(e => e.je >= 4.5 && e.jl >= 4.5);
    const solid   = withSurv.filter(e => (e.je >= 4.0 && e.jl >= 4.0) && !(e.je >= 4.5 && e.jl >= 4.5));
    const concern = withSurv.filter(e => e.je < 4.0 || e.jl < 4.0);
    const noSurv  = pool.filter(e => e.je == null || e.jl == null);

    // Domain analysis from observations
    const obsEmps = pool.filter(e => e._obsCount > 0);
    const avgObsRating = obsEmps.length
      ? Math.round(obsEmps.reduce((s,e)=>s+(e._obsAvgRating||0),0)/obsEmps.length*10)/10 : null;

    const sorted = [...pool].sort((a,b) => {
      // Sort: concern → no survey → solid/high
      const scoreFn = e => {
        if (e.je == null || e.jl == null) return 1;
        if (e.je < 4.0 || e.jl < 4.0) return 2;
        return 0;
      };
      return scoreFn(b) - scoreFn(a) || a.n.localeCompare(b.n);
    });

    const rows = sorted.map(emp => {
      const hasSurvey = emp.je != null && emp.jl != null;
      const att = emp._liveAtt ?? emp.att;
      const attTxt = att != null ? att.toFixed(1)+'%' : '—';
      const attColor = att == null ? '#94a3b8' : att < 70 ? '#b91c1c' : att < 80 ? '#d97706' : '#1d4ed8';

      let zone = '—', zoneColor = '#94a3b8', zoneBg = '#f8fafc';
      if (hasSurvey) {
        const avg = (emp.je + emp.jl) / 2;
        if (avg >= 4.5)      { zone = 'High Engagement'; zoneColor = '#059669'; zoneBg = '#f0fdf4'; }
        else if (avg >= 4.0) { zone = 'Solid';           zoneColor = '#1d4ed8'; zoneBg = '#eff6ff'; }
        else if (avg >= 3.5) { zone = 'Monitor';         zoneColor = '#d97706'; zoneBg = '#fffbeb'; }
        else                 { zone = 'Check-In Needed'; zoneColor = '#b91c1c'; zoneBg = '#fef2f2'; }
      } else {
        zone = 'No Survey Yet'; zoneColor = '#64748b'; zoneBg = '#f1f5f9';
      }

      const obsTxt = emp._obsCount > 0
        ? `${emp._obsCount} obs · ${emp._obsAvgRating!=null?'Avg '+emp._obsAvgRating:'no rating'}`
        : 'None';
      const obsColor = emp._obsCount > 0 ? '#7c3aed' : '#94a3b8';

      return `<tr style="border-bottom:1px solid #f1f5f9">
  <td style="padding:.5rem .5rem;font-weight:600;color:#1e293b;font-size:.82rem">${esc(emp.n)}</td>
  <td style="padding:.5rem .4rem;font-size:.78rem;color:#64748b">${esc((emp.si||emp.di||'').substring(0,28))}</td>
  <td style="padding:.5rem .4rem;text-align:center;font-weight:700;font-size:.82rem;color:${attColor}">${attTxt}</td>
  <td style="padding:.5rem .4rem;text-align:center;font-size:.8rem;font-weight:600;color:${hasSurvey?'#1e293b':'#94a3b8'}">${hasSurvey?emp.je.toFixed(1):'—'}</td>
  <td style="padding:.5rem .4rem;text-align:center;font-size:.8rem;font-weight:600;color:${hasSurvey?'#1e293b':'#94a3b8'}">${hasSurvey?emp.jl.toFixed(1):'—'}</td>
  <td style="padding:.5rem .4rem">
    <span style="font-size:.72rem;padding:.15rem .5rem;border-radius:999px;font-weight:600;color:${zoneColor};background:${zoneBg};border:1px solid ${zoneColor}30">${zone}</span>
  </td>
  <td style="padding:.5rem .4rem;font-size:.75rem;color:${obsColor}">${esc(obsTxt)}</td>
  <td style="padding:.5rem .4rem;font-size:.72rem;color:#94a3b8;font-style:italic">Placeholder</td>
  <td style="padding:.5rem .4rem;font-size:.75rem;color:#94a3b8">—</td>
  <td style="padding:.5rem .4rem;font-size:.75rem;color:#94a3b8">—</td>
  <td style="padding:.5rem .4rem;font-size:.75rem;color:#94a3b8">—</td>
</tr>`;
    });

    return `<div style="padding:.25rem 0">
  <!-- Stats row -->
  <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:.6rem;margin-bottom:1.1rem">
    ${[
      { label:'Active Staff',      val: pool.length,       color:'#1d4ed8' },
      { label:'Survey Completed',  val: withSurv.length+' / '+eligibleForSurvey, color: survCompleteRate < 70 ? '#d97706' : '#059669' },
      { label:'Survey Rate',       val: survCompleteRate+'%', color: survCompleteRate < 70 ? '#b91c1c' : '#059669' },
      { label:'High Engagement',   val: high.length,       color:'#059669' },
      { label:'Monitor / At Risk', val: concern.length,    color: concern.length>0?'#b91c1c':'#059669' },
      { label:'No Survey Yet',     val: noSurv.length,     color: noSurv.length>0?'#d97706':'#059669' },
      { label:'Observed',          val: obsEmps.length,    color:'#7c3aed' },
      { label:'Avg Obs Rating',    val: avgObsRating!=null?avgObsRating:'—', color:'#7c3aed' },
    ].map(s=>`<div style="background:#fff;border:1px solid #e2e8f0;border-radius:8px;padding:.6rem .75rem;text-align:center">
      <div style="font-size:1.15rem;font-weight:800;color:${s.color}">${s.val}</div>
      <div style="font-size:.68rem;color:#64748b;text-transform:uppercase;letter-spacing:.04em;margin-top:1px">${s.label}</div>
    </div>`).join('')}
  </div>
  <div style="font-size:.72rem;color:#94a3b8;margin-bottom:.85rem;line-height:1.5">
    📋 Survey rule: a session survey only deploys when ≥1 scholar attends. "Survey Rate" = staff with live Pearl sessions who completed the survey.
    Staff sorted by engagement zone: Check-In Needed → No Survey → Solid → High Engagement.
  </div>
  <div style="overflow-x:auto">
  <table style="width:100%;border-collapse:collapse;font-size:.82rem">
    <thead>
      <tr style="background:#f8fafc;border-bottom:2px solid #e2e8f0">
        <th style="text-align:left;padding:.5rem .5rem;font-size:.72rem;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.05em">Staff</th>
        <th style="text-align:left;padding:.5rem .4rem;font-size:.72rem;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.05em">Site</th>
        <th style="text-align:center;padding:.5rem .4rem;font-size:.72rem;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.05em">Att</th>
        <th style="text-align:center;padding:.5rem .4rem;font-size:.72rem;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.05em">Enjoy</th>
        <th style="text-align:center;padding:.5rem .4rem;font-size:.72rem;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.05em">Return</th>
        <th style="text-align:left;padding:.5rem .4rem;font-size:.72rem;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.05em">Engagement</th>
        <th style="text-align:left;padding:.5rem .4rem;font-size:.72rem;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.05em">Observations</th>
        <th style="text-align:left;padding:.5rem .4rem;font-size:.72rem;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.05em">Training</th>
        <th style="text-align:left;padding:.5rem .4rem;font-size:.72rem;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.05em">Term Date</th>
        <th style="text-align:left;padding:.5rem .4rem;font-size:.72rem;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.05em">Term Reason</th>
        <th style="text-align:left;padding:.5rem .4rem;font-size:.72rem;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.05em">Term Type</th>
      </tr>
    </thead>
    <tbody>
      ${rows.join('')}
    </tbody>
  </table>
  </div>
</div>`;
  }

  function _hrRebuildProfiles() {
    const root = document.getElementById('hrProfilesRoot');
    if (!root) { console.warn('[HR] _hrRebuildProfiles: hrProfilesRoot not found'); return; }
    const dept = (window.NJTC_SESSION||{}).dept || 'hr';
    // Preserve focus on search inputs so typing isn't interrupted
    const activeId    = document.activeElement && document.activeElement.id;
    const activeStart = document.activeElement && document.activeElement.selectionStart;
    const activeEnd   = document.activeElement && document.activeElement.selectionEnd;
    root.innerHTML = _hrBuildProfiles(dept);
    if (activeId) {
      const el = document.getElementById(activeId);
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA')) {
        el.focus();
        try { el.setSelectionRange(activeEnd, activeEnd); } catch(e) {}
      }
    }
  }

  // ── Global handlers (onclick= safe) ──────────────────────────────────────
  window._hrSetSummerMode = on => { _pSummerMode = !!on; _hrRebuildProfiles(); };
  window._hrSetTier    = t  => { _pTier=t;   _pPage=0; _hrRebuildProfiles(); };
  window._hrSetViewTab = tab => {
    _pViewTab = tab;
    _pStatus  = tab === 'active' ? 'active' : tab === 'inactive' ? 'terminated' : 'all';
    _pTier    = 'all';
    _pQ       = '';
    _pPage    = 0;
    _hrRebuildProfiles();
  };
  window._hrSetSY = sy => { _pSY = sy; _pViewTab='active'; _pTier='all'; _pQ=''; _pPage=0; _hrRebuildProfiles(); };
  window._hrSetRole    = r  => { _pRole=r;   _pPage=0; _hrRebuildProfiles(); };
  window._hrSetStatus  = s  => { _pStatus=s; _pPage=0; _hrRebuildProfiles(); };
  window._hrDoSearch   = q  => {
    _pQ = q; _pPage = 0; _hrRebuildProfiles();
    // After full DOM rebuild the original input node is gone — restore focus + cursor
    // so continuous typing works without re-clicking the field.
    requestAnimationFrame(() => {
      const inp = document.getElementById('hrSearchInput');
      if (inp) { inp.focus(); inp.setSelectionRange(q.length, q.length); }
    });
  };
  window._hrSetPage    = p  => { _pPage=p;             _hrRebuildProfiles(); };
  window._hrSetApprentice = () => { _pApprentice=!_pApprentice; _pPage=0; console.log('[HR] Apprentice filter toggled:', _pApprentice); _hrRebuildProfiles(); };
  // Toggle collapsible section in profiles
  window._hrToggle = (id) => {
    const el = document.getElementById(id);
    const btn = document.getElementById(id+'_btn');
    if (!el) return;
    const isOpen = el.style.display !== 'none';
    el.style.display = isOpen ? 'none' : '';
    if (btn) btn.textContent = isOpen ? '▶ Show' : '▼ Hide';
  };

  // ── NEW: Weekly Recap viewer for Talent Analytics profile cards ──────────
  // Reads the SAME live Google Sheet the onsite portal's "Weekly Recap"
  // feature writes to (see weekly-recap.js RECAP_HISTORY_URL — keep these in
  // sync if the Sheet ever moves). Matches by name since Central Team's HR
  // records are the authoritative name source here (not email).
  const _WR_SHEET_ID = '1y9d9cLn6-EBLSiCuCrf_6iKd0qq9xAzogCaCVUD0mpY';
  const _WR_SHEET_GID = '540898531';
  const _WR_HISTORY_URL = 'https://docs.google.com/spreadsheets/d/' + _WR_SHEET_ID + '/export?format=csv&gid=' + _WR_SHEET_GID;
  let _wrCache = null; // { ts, rows }
  const _WR_CACHE_TTL = 2 * 60 * 1000;

  function _wrParseCsv(text) {
    const rows = []; let row = [], field = '', inQ = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i], n = text[i+1];
      if (inQ) { if (c === '"' && n === '"') { field += '"'; i++; } else if (c === '"') { inQ = false; } else field += c; }
      else { if (c === '"') inQ = true; else if (c === ',') { row.push(field); field = ''; } else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; } else if (c !== '\r') field += c; }
    }
    if (field || row.length) { row.push(field); rows.push(row); }
    return rows;
  }
  function _wrCsvToObjects(text) {
    const rows = _wrParseCsv(text);
    if (rows.length < 2) return [];
    const headers = rows[0].map(h => h.trim());
    return rows.slice(1).map(r => { const o = {}; headers.forEach((h,i) => { o[h] = (r[i]||'').trim(); }); return o; });
  }
  function _wrFindCol(row, candidates) {
    const keys = Object.keys(row);
    for (let i = 0; i < keys.length; i++) {
      const kl = keys[i].toLowerCase();
      for (let j = 0; j < candidates.length; j++) if (kl.indexOf(candidates[j]) >= 0) return row[keys[i]];
    }
    return '';
  }

  window._hrShowRecaps = (empName, containerId) => {
    window._hrToggle(containerId);
    const el = document.getElementById(containerId);
    if (!el || el.style.display === 'none') return; // just collapsed — nothing to load
    if (el.dataset.loaded === '1') return; // already populated once — don't refetch every toggle
    el.innerHTML = '<div style="font-size:.75rem;color:#94a3b8;padding:.5rem 0">Loading weekly recaps…</div>';

    const now = Date.now();
    const renderFor = (rows) => {
      const targetNorm = String(empName||'').trim().toLowerCase().replace(/\s+/g,' ');
      // Prefer the precise "[Portal: Name ·" context tag the onsite portal's
      // weekly-recap.js embeds — falls back to a plain substring match only
      // if nothing tagged is found (covers submissions made directly via the
      // Google Form, bypassing the portal, which have no context tag).
      const tagged = rows.filter(r => _wrFindCol(r, ['discuss']).toLowerCase().indexOf('[portal: '+targetNorm) >= 0);
      const mine = (tagged.length ? tagged : rows.filter(r => _wrFindCol(r, ['discuss']).toLowerCase().indexOf(targetNorm) >= 0))
        .sort((a,b) => new Date(_wrFindCol(b,['timestamp'])) - new Date(_wrFindCol(a,['timestamp'])));

      if (!mine.length) {
        el.innerHTML = '<div style="font-size:.75rem;color:#94a3b8;font-style:italic;padding:.4rem 0">No weekly recaps found for '+esc(empName)+' yet.</div>';
        el.dataset.loaded = '1';
        return;
      }
      el.innerHTML = mine.map(r => {
        const ts = _wrFindCol(r, ['timestamp']);
        const d = new Date(ts);
        const dateStr = isNaN(d.getTime()) ? ts : (d.getMonth()+1)+'/'+d.getDate()+'/'+d.getFullYear();
        const group = _wrFindCol(r, ['which group']);
        const discuss = _wrFindCol(r, ['discuss']);
        const roadblocks = _wrFindCol(r, ['roadblock']);
        const accomplishments = _wrFindCol(r, ['accomplishment']);
        const assistance = _wrFindCol(r, ['assistance']);
        return '<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:.6rem .75rem;margin-bottom:.5rem;font-size:.75rem">'
          +'<div style="font-weight:700;color:#1d4ed8;margin-bottom:.3rem">'+esc(dateStr)+(group?' · '+esc(group):'')+'</div>'
          +(discuss?'<div style="margin-bottom:.2rem"><b>Discussed:</b> '+esc(discuss)+'</div>':'')
          +(roadblocks?'<div style="margin-bottom:.2rem"><b>Roadblocks:</b> '+esc(roadblocks)+'</div>':'')
          +(accomplishments?'<div style="margin-bottom:.2rem"><b>Accomplishments:</b> '+esc(accomplishments)+'</div>':'')
          +(assistance?'<div><b>Needed from Central:</b> '+esc(assistance)+'</div>':'')
          +'</div>';
      }).join('');
      el.dataset.loaded = '1';
    };

    if (_wrCache && (now - _wrCache.ts) < _WR_CACHE_TTL) { renderFor(_wrCache.rows); return; }
    fetch(_WR_HISTORY_URL).then(res => { if (!res.ok) throw new Error('HTTP '+res.status); return res.text(); })
      .then(text => { const rows = _wrCsvToObjects(text); _wrCache = { ts: Date.now(), rows: rows }; renderFor(rows); })
      .catch(err => {
        console.warn('[HR] Weekly recap fetch failed:', err);
        el.innerHTML = '<div style="font-size:.75rem;color:#b91c1c;padding:.4rem 0">Could not load recaps right now.</div>';
      });
  };

  window._hrShowProfile= nm => {
    const emp = HR_EMPS.find(e=>e.n===nm);
    if (!emp) return;
    const modal = document.getElementById('hrEmpModal');
    const inner = document.getElementById('hrEmpModalInner');
    if (modal && inner) { inner.innerHTML = _hrModal(emp); modal.style.display='block'; }
  };

  // ── Programming Profile (Onsite Performance) filter/tooltip handlers ──────
  window._ppSetStatus = v  => { _ppStatus=v; _hrRebuildProfiles(); };
  window._ppSetRegion = v  => { _ppRegion=v; _hrRebuildProfiles(); };
  window._ppSetQ      = v  => {
    _ppQ = v; _hrRebuildProfiles();
    requestAnimationFrame(() => {
      const inp = document.getElementById('ppSearchInput');
      if (inp) { inp.focus(); inp.setSelectionRange(v.length, v.length); }
    });
  };
  window._ppClear     = () => { _ppStatus='all'; _ppRegion='all'; _ppQ=''; _hrRebuildProfiles(); };
  window._ppShowTip   = text => {
    const m = document.getElementById('ppTipModal');
    const t = document.getElementById('ppTipText');
    if (!m || !t) return;
    t.textContent = text;
    m.style.display = 'block';
  };



  // ══════════════════════════════════════════════════════════════════════════
  //  SY ANALYTICS MODULE  —  NJTC Central Team Portal  SY 2025-2026
  //
  //  LIVE SOURCE — identical pattern to SHEET_CSV_URL and TALENT_CSV_URL:
  //    Uses the published-to-web embed URL (2PACX-… format).
  //    File → Share → Publish to web → Tab → CSV → Publish → copy URL.
  //    This is the ONLY format that works from a static GitHub Pages host.
  //    The /export?format=csv URL requires Google login and causes a CORS
  //    redirect to accounts.google.com — do NOT use that format here.
  //
  //  DATA LAYOUT (from CSV):
  //    Row 1 (idx 0) : summary row — skip
  //    Row 2 (idx 1) : aggregate totals row — skip
  //    Row 3 (idx 2) : HEADERS  ("Fee for service partner", "Status", …)
  //    Row 4+ (idx 3+): DATA
  //
  //  CSV PARSING:
  //    Full RFC-4180 state-machine parser (parseCSVFull).
  //    This sheet has 170+ embedded newlines inside quoted cells.
  //    A naive text.split('\n') breaks those into corrupt fragments → wrong numbers.
  //
  //  ROLE GATING:
  //    Fee for service (col A / idx 0)  : finance, leadership only
  //    Percent hired   (col AH / idx 33): programming, leadership, hr only
  //    Fields are not rendered at all for unauthorised roles.
  //
  //  CHANGE DETECTION:
  //    Diffs district+school keyed snapshots between refreshes.
  //    Badge + modal show added / removed / changed rows with field detail.
  //
  //  GEOCODING:
  //    Nominatim (OSM) client-side, rate-limited ≤1 req/sec.
  //    Results cached in localStorage (key: njtc_sy_geocache_v4).
  //    Re-geocodes only when address changes or cache is cold.
  // ══════════════════════════════════════════════════════════════════════════


  function _mergeKPIMeta(dataRows) {
    if (!KPI_DATA || !dataRows) return;
    var lookup = {};
    dataRows.forEach(function(r) {
      var g = (r[0]||'').trim(); var t = (r[1]||'').trim();
      var owner  = _cleanOwner(r[5]||'');
      var source = _cleanSource(r[3]||'', r[4]||'');
      if (!g || !t) return;
      var key1 = (g + '||' + t).toLowerCase();
      var key2 = (g + '||' + t.slice(0, 60)).toLowerCase();
      var val  = {owner: owner, source: source};
      lookup[key1] = val; lookup[key2] = val;
    });
    KPI_DATA.forEach(function(k) {
      var key1 = (k.goal + '||' + k.target).toLowerCase();
      var key2 = (k.goal + '||' + k.target.slice(0, 60)).toLowerCase();
      var meta = lookup[key1] || lookup[key2];
      if (meta) { k.owner = meta.owner; k.source = meta.source; }
    });
    if (typeof filterKPI === 'function') filterKPI();
  }

    function _cleanOwner(raw) {
    if (!raw) return '';
    var lines = raw.replace(/\r/g,'').split('\n').map(function(l){ return l.trim(); }).filter(Boolean);
    var full = lines.join(' ');
    var m = full.match(/Primary Metric Owner[s]?\s*[:\s]+([^&\n\r]+?)(?:\s*&|\s*Secondary|$)/i);
    if (m) return m[1].trim().replace(/,\s*$/, '').trim();
    var m2 = lines[0].match(/(?:Goal Responsibility[^:]*:|Metric Owner[s]?:)\s*(.+)/i);
    if (m2) return m2[1].trim();
    return lines[0].slice(0, 50);
  }

  function _cleanSource(src1, src2) {
    var s1 = (src1||'').replace(/Validation Method\s*:/i,'').replace(/Validation\s*:/i,'').trim();
    var s2 = (src2||'').replace(/S?e?condary Validation\s*:/i,'').replace(/N\/A/gi,'').trim();
    return [s1, s2].filter(function(s){ return s && s.length > 0; }).join(' \u00B7 ');
  }

  function fetchKPIMetadata(force) {
    if (!force) {
      try {
        var cached = localStorage.getItem(KPI_META_CACHE_KEY);
        if (cached) {
          var obj = JSON.parse(cached);
          if (obj && obj.ts && (Date.now() - obj.ts < KPI_META_TTL) && obj.rows) {
            _mergeKPIMeta(obj.rows);
            _extractAndStoreQuarterlyData(obj.rows);
            return;
          }
        }
      } catch(e) {}
    }
    // Also clear any stale 404 suppression flag from previous code version
    try { localStorage.removeItem('njtc_kpi_meta_404'); } catch(e) {}
    fetch(KPI_META_URL)
      .then(function(r){ return r.ok ? r.text() : ''; })
      .then(function(csv){
        if (!csv) return;
        var rows = _parseKPIcsv(csv);
        if (!rows || rows.length < 2) return;
        // Row 0 = legend/description, Row 1 = headers → data starts at row 2
        var dataRows = rows.slice(2).filter(function(r2){ return r2[0] && r2[1]; });
        try { localStorage.setItem(KPI_META_CACHE_KEY, JSON.stringify({ts: Date.now(), rows: dataRows})); } catch(e) {}
        _mergeKPIMeta(dataRows);
        _extractAndStoreQuarterlyData(dataRows);
      })
      .catch(function(){});
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  QUARTERLY DATA ENGINE
  //  Reads Q1–Q4 columns from the Quarterly Goal Tracking tab and builds:
  //    - per-quarter scorecards (counts, weighted health score)
  //    - cross-quarter deltas (which targets improved or regressed)
  //  Stored globally as window.KPI_Q_DATA and auto-populates kpiQRReport.
  // ══════════════════════════════════════════════════════════════════════════

  var KPI_Q_DATA = null;

  // Column layout in the Quarterly Goal Tracking tab:
  //  [0]=Goal  [1]=Target  [2]=Metric Type  [3]=Validation  [4]=SecondaryVal  [5]=Owner
  //  [6]=Q1Data  [7]=Q1Status  [8]=Q2Data  [9]=Q2Status
  //  [10]=Q3Data [11]=Q3Status [12]=Q4Data [13]=Q4Status
  var _Q_COLS = [[6,7],[8,9],[10,11],[12,13]];

  // Status rank for direction-of-change: higher = better
  var _Q_RANK = {'Met':4,'Partially Met':3,'In Progress':2,'Coming Down the Pipeline':1,'Has Not Met':0};
  var _Q_SCORE = {'Met':1,'Partially Met':0.5,'In Progress':0.25,'Coming Down the Pipeline':0.1,'Has Not Met':0};

  // ══════════════════════════════════════════════════════════════════════════
  //  GOAL / CAPTURED METRIC PARSER
  //  Each Q1–Q4 "data" cell (columns G, I, K, M in the Quarterly Goal Tracking
  //  tab) contains a combined text block, e.g.:
  //    "Goal: 2,000\n\nCaptured Metric: 1,047"
  //    "Goal:\n80%\nCaptured Metric:\n51.40% (aggregate)\n52% - Math\n51% - ELA"
  //    "Goal:\n\nCaptured Metric:"                (quarter not yet reported)
  //    "Goal: N/A\nCaptured Metric: N/A"           (not a quantifiable target)
  //  This parses that block into { goal, metric, hasData, isNA } once, so every
  //  render/export path (portal live view, PDF, PPTX) reads it the same way.
  // ══════════════════════════════════════════════════════════════════════════
  function _joinLines(s) {
    return String(s || '').split(/\n+/).map(function(x){ return x.replace(/\s{2,}/g,' ').trim(); }).filter(Boolean).join(' / ');
  }
  function _parseGoalMetric(raw) {
    if (!raw) return null;
    var text = String(raw).replace(/\r/g, '');
    var m = text.match(/Goal:\s*([\s\S]*?)Captured Metric:\s*([\s\S]*)$/i);
    if (!m) return null;
    var goalText   = _joinLines(m[1]);
    var metricText = _joinLines(m[2]);
    var isNA = /^n\/a$/i.test(goalText) || /^n\/a$/i.test(metricText);
    var hasData = !isNA && !!metricText;
    return { goal: goalText, metric: metricText, hasData: hasData, isNA: isNA };
  }

  // Canonical short status label (module scope — shared by narrative builder)
  function _qShortStatus(s) {
    return (s || '').replace('Coming Down the Pipeline', 'Pipeline').replace('Partially Met', 'Partial').replace('In Progress', 'Progress').replace('Has Not Met', 'Not Met');
  }

  // Compact "Goal: X · Actual: Y" caption for a single quarter's data cell.
  // Returns '' when there's nothing reportable yet (future quarter, N/A target).
  function _metricCaption(raw) {
    var pg = _parseGoalMetric(raw);
    if (!pg || !pg.hasData) return '';
    if (pg.goal) return 'Goal: ' + pg.goal + '  ·  Actual: ' + pg.metric;
    return 'Actual: ' + pg.metric;
  }

  // Cross-quarter trend string for one target row, e.g.
  // "Q1: 1,047  →  Q2: 1,460  →  Q3: 1,738  (Goal: 2,000)"
  function _quarterMetricTrend(r, activeQs) {
    var parts = [], lastGoal = '';
    activeQs.forEach(function(q) {
      var raw = r[_Q_COLS[q-1][0]] || '';
      var pg = _parseGoalMetric(raw);
      if (pg && pg.hasData) {
        parts.push('Q' + q + ': ' + pg.metric);
        if (pg.goal) lastGoal = pg.goal;
      }
    });
    if (!parts.length) return '';
    return parts.join('  \u2192  ') + (lastGoal ? '  (Goal: ' + lastGoal + ')' : '');
  }

  // For a single delta (target that moved status between two quarters), return
  // the matching "before → after" captured-metric string, if both quarters
  // have parseable numbers. e.g. "1,460 → 1,738 (Goal: 2,000)"
  function _deltaMetricStr(d) {
    if (!d || !d.dataText) return '';
    var lm = d.moves[d.moves.length - 1];
    var pf = _parseGoalMetric(d.dataText['Q' + lm.fromQ]);
    var pt = _parseGoalMetric(d.dataText['Q' + lm.toQ]);
    if (pf && pt && pf.hasData && pt.hasData) {
      return pf.metric + ' \u2192 ' + pt.metric + (pt.goal ? '  (Goal: ' + pt.goal + ')' : '');
    }
    return '';
  }

  function _extractAndStoreQuarterlyData(dataRows) {
    if (!dataRows || !dataRows.length) { KPI_Q_DATA = null; window.KPI_Q_DATA = null; return; }

    // ── Detect which quarters have any status data ────────────────
    var activeQs = [];
    for (var qi = 0; qi < 4; qi++) {
      var sc = _Q_COLS[qi][1];
      if (dataRows.some(function(r){ return r[sc] && r[sc].trim(); })) activeQs.push(qi + 1);
    }

    // ── Per-quarter scorecards ────────────────────────────────────
    var scorecards = activeQs.map(function(q) {
      var sc = _Q_COLS[q-1][1];
      var counts = {met:0,partial:0,prog:0,notmet:0,pipe:0,total:0};
      var scoreSum = 0;
      dataRows.forEach(function(r) {
        var s = (r[sc]||'').trim();
        if (!s) return;
        counts.total++;
        if      (s==='Met')                     { counts.met++;     scoreSum += 1;    }
        else if (s==='Partially Met')            { counts.partial++; scoreSum += 0.5;  }
        else if (s==='In Progress')              { counts.prog++;    scoreSum += 0.25; }
        else if (s==='Has Not Met')              { counts.notmet++;  scoreSum += 0;    }
        else if (s==='Coming Down the Pipeline') { counts.pipe++;    scoreSum += 0.1;  }
      });
      var score = counts.total ? Math.round(scoreSum / counts.total * 100) : 0;
      return { q: q, label: 'Q' + q, counts: counts, score: score, health: riskBucket(score) };
    });

    // ── Cross-quarter deltas ──────────────────────────────────────
    var deltas = [];
    dataRows.forEach(function(r) {
      var goal   = (r[0]||'').trim();
      var target = (r[1]||'').trim();
      if (!goal || !target) return;
      var statuses = {}, dataText = {};
      activeQs.forEach(function(q){ statuses['Q'+q] = (r[_Q_COLS[q-1][1]]||'').trim(); dataText['Q'+q] = (r[_Q_COLS[q-1][0]]||'').trim(); });
      var moves = [];
      for (var i = 1; i < activeQs.length; i++) {
        var fromQ = activeQs[i-1], toQ = activeQs[i];
        var fromS = statuses['Q'+fromQ], toS = statuses['Q'+toQ];
        if (!fromS || !toS || fromS === toS) continue;
        var fromRk = (_Q_RANK[fromS] !== undefined) ? _Q_RANK[fromS] : -1;
        var toRk   = (_Q_RANK[toS]   !== undefined) ? _Q_RANK[toS]   : -1;
        if (fromRk < 0 || toRk < 0) continue;
        moves.push({ fromQ:fromQ, toQ:toQ, from:fromS, to:toS,
                     dir: toRk > fromRk ? 'up' : 'down', mag: Math.abs(toRk - fromRk) });
      }
      if (moves.length) deltas.push({ goal:goal, target:target, statuses:statuses, dataText:dataText, moves:moves, owner:_cleanOwner(r[5]||'') });
    });

    KPI_Q_DATA = { rows:dataRows, activeQs:activeQs, scorecards:scorecards, deltas:deltas, lastUpdated:Date.now() };
    window.KPI_Q_DATA = KPI_Q_DATA;

    // Auto-populate the quarterly snapshot panel (kpiQRReport) if it exists
    var rptEl = document.getElementById('kpiQRReport');
    if (rptEl) { kqrRenderSnapshot(dataRows, 'live', true); }

    // If the quarterly analytics tab is currently active, refresh it
    if (typeof _kpiAnalyticsTab !== 'undefined' && _kpiAnalyticsTab === 'quarterly') {
      var con = document.getElementById('kpiaTabContent');
      if (con) con.innerHTML = renderKPIAnalyticsTab('quarterly');
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  NJTC BRAND ICON SET (base64 PNG, 256px source) — shared by the PDF and
  //  PPTX quarterly exports so both documents use identical iconography.
  //  Rasterized once; no runtime dependency, no external fetch.
  // ══════════════════════════════════════════════════════════════════════════
  var _NJTC_ICONS = {
    grad_gold: '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',
    chartline_white: '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',
    check_gold: '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',
    bullseye_white: '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',
    trophy_white: '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',
    check_green: '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',
    warning_white: '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',
    flag_navy: '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',
    clipboard_navy: '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'
  };

  // ══════════════════════════════════════════════════════════════════════════
  //  QUARTERLY NARRATIVE ENGINE
  //  Builds the leadership "story arc" — headline, positives, concerns,
  //  focus areas, and next steps — entirely from live qd data. Shared by both
  //  the PDF and PPTX exports so the two documents always tell the same story.
  //  Nothing here is hardcoded to a specific quarter; it re-derives from
  //  whatever KPI_Q_DATA looks like at export time.
  // ══════════════════════════════════════════════════════════════════════════
  function _buildQuarterlyNarrative(qd) {
    var activeQs   = qd.activeQs;
    var scorecards = qd.scorecards;
    var deltas     = qd.deltas;
    var latestQ    = activeQs[activeQs.length - 1];
    var latestSC   = scorecards[scorecards.length - 1];
    var prevSC     = scorecards.length > 1 ? scorecards[scorecards.length - 2] : null;

    var improved  = deltas.filter(function(d){ var lm=d.moves[d.moves.length-1]; return lm && lm.dir==='up'; });
    var regressed = deltas.filter(function(d){ var lm=d.moves[d.moves.length-1]; return lm && lm.dir==='down'; });
    var bigWins   = deltas.filter(function(d){ var lm=d.moves[d.moves.length-1]; return lm && lm.to==='Met' && _Q_RANK[lm.from] <= 2; });
    var critical  = deltas.filter(function(d){ var lm=d.moves[d.moves.length-1]; return lm && lm.to==='Has Not Met'; });
    var otherReg  = regressed.filter(function(d){ return !critical.some(function(c){ return c.target===d.target; }); });

    // Stalled: targets with a non-final status in the latest quarter that never
    // registered a status change across all tracked quarters (flat trajectory).
    var changedTargets = {};
    deltas.forEach(function(d){ changedTargets[d.target] = true; });
    var stalled = [];
    if (activeQs.length > 1) {
      qd.rows.forEach(function(r) {
        var g = (r[0]||'').trim(), t = (r[1]||'').trim();
        if (!g || !t || changedTargets[t]) return;
        var latestStatus = (r[_Q_COLS[latestQ-1][1]]||'').trim();
        if (latestStatus==='In Progress' || latestStatus==='Partially Met' || latestStatus==='Coming Down the Pipeline') {
          stalled.push({ goal:g, target:t, status:latestStatus, owner:_cleanOwner(r[5]||'') });
        }
      });
    }

    // ── Headline / Where We Stand ──────────────────────────────────
    var pct = latestSC.counts.total ? Math.round(latestSC.counts.met/latestSC.counts.total*100) : 0;
    var headline, trendLine;
    if (prevSC) {
      var deltaPts = latestSC.score - prevSC.score;
      var trendWord = deltaPts > 0 ? 'improved' : (deltaPts < 0 ? 'declined' : 'held steady');
      trendLine = 'Organizational health has ' + trendWord + ' ' + (deltaPts !== 0 ? 'by ' + Math.abs(deltaPts) + ' points ' : '') + 'since Q' + prevSC.q + ' (' + prevSC.score + '% \u2192 ' + latestSC.score + '%).';
    } else {
      trendLine = 'This is the first quarter tracked this school year, establishing the baseline for future comparison.';
    }
    headline = 'As of Q' + latestQ + ', organizational health stands at ' + latestSC.score + '% (' + latestSC.health.label + '). ' + trendLine + ' ' +
      latestSC.counts.met + ' of ' + latestSC.counts.total + ' targets (' + pct + '%) are fully Met this quarter, with ' +
      latestSC.counts.notmet + ' Not Met and ' + latestSC.counts.partial + ' Partially Met still requiring attention.';

    // ── What's Working (positives) ──────────────────────────────────
    var positives = [];
    var posSeen = {};
    bigWins.concat(improved).forEach(function(d) {
      if (posSeen[d.target]) return; posSeen[d.target] = true;
      var lm = d.moves[d.moves.length-1];
      var mStr = _deltaMetricStr(d);
      positives.push({
        target: d.target, goalArea: d.goal, owner: d.owner,
        text: d.target + ' moved from ' + _qShortStatus(lm.from) + ' to ' + _qShortStatus(lm.to) + (mStr ? ' (' + mStr + ')' : '') + '.'
      });
    });

    // ── What Needs Attention (concerns) ──────────────────────────────
    var concerns = [];
    critical.forEach(function(d) {
      var cm = d.moves[d.moves.length-1];
      var mStr = _deltaMetricStr(d);
      concerns.push({
        target: d.target, goalArea: d.goal, owner: d.owner, severity: 'critical',
        text: d.target + ' dropped to Has Not Met' + (cm ? ' from ' + _qShortStatus(cm.from) : '') + (mStr ? ' (' + mStr + ')' : '') + '.'
      });
    });
    otherReg.forEach(function(d) {
      var lm = d.moves[d.moves.length-1];
      var mStr = _deltaMetricStr(d);
      concerns.push({
        target: d.target, goalArea: d.goal, owner: d.owner, severity: 'watch',
        text: d.target + ' declined from ' + _qShortStatus(lm.from) + ' to ' + _qShortStatus(lm.to) + (mStr ? ' (' + mStr + ')' : '') + '.'
      });
    });

    // ── Where to Focus (stalled / flat targets) ──────────────────────
    var focus = stalled.map(function(s) {
      return {
        target: s.target, goalArea: s.goal, owner: s.owner,
        text: s.target + ' has shown no status change across Q' + activeQs.join('\u2013Q') + ' and remains ' + _qShortStatus(s.status) + (s.owner ? ' (owner: ' + s.owner + ')' : '') + '.'
      };
    });

    // ── Action Plan — one concrete, named-owner, dated action per          ──
    // ── "What Needs Attention" item, so it's clear what to actually do.   ──
    var nextQLabel = 'Q' + (latestQ < 4 ? latestQ+1 : 1);
    function _actionFor(c) {
      var who = c.owner || 'The metric owner';
      if (c.severity === 'critical') {
        return who + ' to submit a written corrective-action plan for "' + c.target + '" — root cause, corrective steps, and a revised target date — before the ' + nextQLabel + ' review.';
      }
      return who + ' to confirm by the ' + nextQLabel + ' review whether the change on "' + c.target + '" is a data-timing issue or a genuine trend, and adjust the plan if needed.';
    }
    var actionPlan = concerns.map(function(c) {
      return { target:c.target, goalArea:c.goalArea, owner:c.owner, severity:c.severity, text:c.text, action:_actionFor(c), dueLabel:nextQLabel };
    });

    // ── Recommended Next Steps (org-level priorities beyond the action plan) ──
    var nextSteps = [];
    if (bigWins.length) nextSteps.push('Document the approach behind the ' + bigWins.length + ' target' + (bigWins.length>1?'s':'') + ' that reached Met status this cycle so it can be repeated elsewhere.');
    if (stalled.length) nextSteps.push('Revisit the ' + stalled.length + ' stalled target' + (stalled.length>1?'s':'') + ' with no quarter-over-quarter movement (see Where to Focus) to confirm they remain achievable this school year.');
    nextSteps.push('Maintain the quarterly review cadence; the next formal checkpoint is ' + nextQLabel + '.');

    return {
      latestQ: latestQ, latestSC: latestSC, prevSC: prevSC,
      headline: headline,
      positives: positives, concerns: concerns, focus: focus, actionPlan: actionPlan, nextSteps: nextSteps, nextQLabel: nextQLabel,
      counts: { improved:improved.length, regressed:regressed.length, bigWins:bigWins.length, critical:critical.length, otherReg:otherReg.length, stalled:stalled.length }
    };
  }

  // Cache-restore path: also extract quarterly data when restoring from localStorage
  function _mergeKPIMetaWithQ(dataRows) {
    _mergeKPIMeta(dataRows);
    _extractAndStoreQuarterlyData(dataRows);
  }

  function kqrHandleFile(file) {
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function(e) {
      try {
        var rows = _parseKPIcsv(e.target.result);
        if (!rows || rows.length < 3) { alert('Could not parse CSV. Make sure you are using the Quarterly Goal Tracking tab export.'); return; }
        var dataRows = rows.slice(2).filter(function(r){ return r[0] && r[1]; });
        kqrRenderSnapshot(dataRows, file.name);
        try { sessionStorage.setItem('njtc_kqr_snapshot', JSON.stringify({rows: dataRows, fname: file.name, ts: Date.now()})); } catch(ex) {}
      } catch(err) { alert('Error reading CSV: ' + err.message); }
    };
    reader.readAsText(file);
  }

  function kqrRestoreSnapshot() {
    try {
      var saved = sessionStorage.getItem('njtc_kqr_snapshot');
      if (!saved) return;
      var obj = JSON.parse(saved);
      if (obj && obj.rows && obj.rows.length) kqrRenderSnapshot(obj.rows, obj.fname, true);
    } catch(e) {}
  }

  function kqrRenderSnapshot(dataRows, fname, isRestore) {
    var qCols = [[6,7],[8,9],[10,11],[12,13]];
    var activeQ = 0;
    for (var qi = 3; qi >= 0; qi--) {
      var sc = qCols[qi][1];
      var hasData = dataRows.some(function(r){ return r[sc] && r[sc].trim(); });
      if (hasData) { activeQ = qi + 1; break; }
    }
    var qLabel     = activeQ ? ('Q' + activeQ + ' \u2014 SY 2025\u20132026') : 'SY 2025\u20132026';
    var qStatusCol = activeQ > 0 ? qCols[activeQ-1][1] : 7;
    var qDataCol   = activeQ > 0 ? qCols[activeQ-1][0] : 6;

    var SCORE_MAP = {'Met':1,'Partially Met':0.5,'In Progress':0.25,'Coming Down the Pipeline':0.1,'Has Not Met':0};
    var counts = {met:0,partial:0,prog:0,notmet:0,pipe:0,total:0};
    var scoreSum = 0;
    dataRows.forEach(function(r) {
      var s = (r[qStatusCol]||'').trim();
      if (!s) return;
      counts.total++;
      if (s==='Met') counts.met++;
      else if (s==='Partially Met') counts.partial++;
      else if (s==='In Progress') counts.prog++;
      else if (s==='Has Not Met') counts.notmet++;
      else if (s==='Coming Down the Pipeline') counts.pipe++;
      scoreSum += (SCORE_MAP[s] !== undefined ? SCORE_MAP[s] : 0);
    });
    var healthPct   = counts.total ? Math.round((scoreSum/counts.total)*100) : 0;
    var healthLabel = healthPct>=85?'Healthy':healthPct>=65?'Watch':healthPct>=40?'Needs Focus':'Area of Support';
    var healthClass = healthPct>=85?'hb-healthy':healthPct>=65?'hb-watch':healthPct>=40?'hb-risk':'hb-crit';
    var fillColor   = healthPct>=85?'#16a34a':healthPct>=65?'#d97706':healthPct>=40?'#dc2626':'#7c3aed';
    var tsStr = new Date().toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'});

    var wins  = dataRows.filter(function(r){ return (r[qStatusCol]||'').trim()==='Met'; }).slice(0,4);
    var needs = dataRows.filter(function(r){ var s=(r[qStatusCol]||'').trim(); return s==='Has Not Met'||s==='Partially Met'; }).slice(0,4);
    var pipe  = dataRows.filter(function(r){ return (r[qStatusCol]||'').trim()==='Coming Down the Pipeline'; }).slice(0,4);
    function hlItems(arr) {
      if (!arr.length) return '<div class="kqr-sl-empty">None this quarter</div>';
      return arr.map(function(r){ var t=r[1].trim(); return '<div class="kqr-sl-item">'+(t.length>80?t.slice(0,80)+'&hellip;':t)+'</div>'; }).join('');
    }

    var goalOrder=[]; var groups={};
    dataRows.forEach(function(r){
      var g=(r[0]||'').trim(); var t=(r[1]||'').trim();
      if(!g||!t) return;
      if(goalOrder.indexOf(g)<0) goalOrder.push(g);
      if(!groups[g]) groups[g]=[];
      groups[g].push(r);
    });

    function tbClass(s){ if(s==='Met') return 'kqr-t-met'; if(s==='Partially Met') return 'kqr-t-partial'; if(s==='In Progress') return 'kqr-t-prog'; if(s==='Has Not Met') return 'kqr-t-notmet'; if(s==='Coming Down the Pipeline') return 'kqr-t-pipe'; return 'kqr-t-default'; }
    function pillClass(s){ if(s==='Met') return 'kqr-tp-met'; if(s==='Partially Met') return 'kqr-tp-partial'; if(s==='In Progress') return 'kqr-tp-prog'; if(s==='Has Not Met') return 'kqr-tp-notmet'; if(s==='Coming Down the Pipeline') return 'kqr-tp-pipe'; return ''; }
    function shortStatus(s){ return s.replace('Coming Down the Pipeline','Pipeline').replace('Partially Met','Partial').replace('In Progress','Progress').replace('Has Not Met','Not Met'); }
    function parseQData(raw){
      if(!raw) return {g:'',c:''};
      var lines=raw.replace(/\r/g,'').split('\n').map(function(l){return l.trim();}).filter(Boolean);
      var g='',c='',mode='';
      lines.forEach(function(l){
        if(/^Goal:/i.test(l)){g=l.replace(/^Goal:\s*/i,'');mode='g';}
        else if(/^Captured Metric:/i.test(l)){c=l.replace(/^Captured Metric:\s*/i,'');mode='c';}
        else if(mode==='g') g+=' '+l;
        else if(mode==='c') c+=' '+l;
      });
      return {g:g.trim(),c:c.trim()};
    }

    var cardsHtml = goalOrder.map(function(goal){
      var rows2=groups[goal];
      var gMet=rows2.filter(function(r){return (r[qStatusCol]||'').trim()==='Met';}).length;
      var body=rows2.map(function(r){
        var s=(r[qStatusCol]||'').trim();
        var qd=parseQData(r[qDataCol]||'');
        var owner=_cleanOwner(r[5]||'');
        var src=_cleanSource(r[3]||'',r[4]||'');
        var metaParts=[];
        if(owner) metaParts.push('Owner: '+owner);
        if(src)   metaParts.push('Source: '+src);
        var metaStr=metaParts.join('  &middot;  ');
        var detailStr='';
        if(qd.g&&qd.g!=='N/A'&&qd.g.replace(/\s/g,'')!=='') detailStr+='Goal: '+qd.g;
        if(qd.c&&qd.c!=='N/A'&&qd.c.replace(/\s/g,'')!=='') detailStr+=(detailStr?' &mdash; ':'')+' Captured: '+qd.c;
        var prevPills='';
        for(var pqi=0;pqi<4;pqi++){
          if(pqi+1===activeQ) continue;
          var ps=(r[qCols[pqi][1]]||'').trim();
          if(ps) prevPills+='<span class="kqr-t-pill '+pillClass(ps)+'">Q'+(pqi+1)+': '+shortStatus(ps)+'</span>';
        }
        return '<div class="kqr-t-row">'+
          '<div class="kqr-t-badge '+tbClass(s)+'">'+shortStatus(s||'TBD')+'</div>'+
          '<div class="kqr-t-body">'+
            '<div class="kqr-t-txt">'+r[1].trim()+'</div>'+
            (detailStr?'<div class="kqr-t-meta">'+detailStr+'</div>':'')+
            (metaStr?'<div class="kqr-t-meta">'+metaStr+'</div>':'')+
            (prevPills?'<div class="kqr-t-pills">'+prevPills+'</div>':'')+
          '</div>'+
          '</div>';
      }).join('');
      return '<div class="kqr-goal-card">'+
        '<div class="kqr-gc-hdr"><div class="kqr-gc-title">'+goal+'</div><div class="kqr-gc-count">'+gMet+'/'+rows2.length+' Met</div></div>'+
        '<div class="kqr-gc-body">'+body+'</div>'+
        '</div>';
    }).join('');

    var clearBtn = (!isRestore) ? '<button class="kqr-action-btn" onclick="kqrClear()">&#xD7; Clear Report</button>' : '';

    var html =
      '<div class="kqr-snap-bar">'+
        '<div class="kqr-snap-top">'+
          '<div>'+
            '<div class="kqr-snap-q-badge">&#128197; '+qLabel+'</div>'+
            '<div class="kqr-snap-title">NJTC Quarterly Performance Snapshot</div>'+
            '<div class="kqr-snap-desc">Executive summary across '+counts.total+' organizational targets &mdash; snapshot generated '+tsStr+'</div>'+
          '</div>'+
          '<div class="kqr-snap-actions">'+clearBtn+'</div>'+
        '</div>'+
        '<div class="kqr-snap-stats">'+
          '<div class="kqr-stat sv-met"><div class="kqr-stat-n">'+counts.met+'</div><div class="kqr-stat-l">Met</div></div>'+
          '<div class="kqr-stat sv-partial"><div class="kqr-stat-n">'+counts.partial+'</div><div class="kqr-stat-l">Partial</div></div>'+
          '<div class="kqr-stat sv-prog"><div class="kqr-stat-n">'+counts.prog+'</div><div class="kqr-stat-l">In Progress</div></div>'+
          '<div class="kqr-stat sv-pipe"><div class="kqr-stat-n">'+counts.pipe+'</div><div class="kqr-stat-l">Pipeline</div></div>'+
          '<div class="kqr-stat sv-notmet"><div class="kqr-stat-n">'+counts.notmet+'</div><div class="kqr-stat-l">Not Met</div></div>'+
        '</div>'+
      '</div>'+
      '<div class="kqr-health-strip">'+
        '<div class="kqr-hs-lbl">Organizational Health Score</div>'+
        '<div class="kqr-hs-track"><div class="kqr-hs-fill" style="width:'+healthPct+'%;background:'+fillColor+'"></div></div>'+
        '<div class="kqr-hs-pct">'+healthPct+'%</div>'+
        '<div class="kqr-hs-badge '+healthClass+'">'+healthLabel+'</div>'+
      '</div>'+
      '<div class="kqr-spotlights">'+
        '<div class="kqr-sl-col"><div class="kqr-sl-title">Wins This Quarter</div>'+hlItems(wins)+'</div>'+
        '<div class="kqr-sl-col"><div class="kqr-sl-title">Needs Attention</div>'+hlItems(needs)+'</div>'+
        '<div class="kqr-sl-col"><div class="kqr-sl-title">Coming Up</div>'+hlItems(pipe)+'</div>'+
      '</div>'+
      '<div class="kqr-goals-section">'+
        '<div class="kqr-goals-section-title">All Targets &mdash; '+qLabel+'</div>'+
        '<div class="kqr-goals-grid">'+cardsHtml+'</div>'+
      '</div>';

    var rptEl = document.getElementById('kpiQRReport');
    if (rptEl) { rptEl.innerHTML = html; rptEl.classList.add('visible'); }
    // Visibility is controlled by showPanel (kpi-analytics trigger) — no override needed here
  }

  function kqrClear() {
    try { sessionStorage.removeItem('njtc_kqr_snapshot'); } catch(e) {}
    var rptEl = document.getElementById('kpiQRReport');
    if (rptEl) { rptEl.innerHTML = ''; rptEl.classList.remove('visible'); }
    var dz = document.getElementById('kqrDropZone');
    if (dz) dz.style.display = '';
  }

  window.kqrHandleFile      = kqrHandleFile;
  window.kqrClear           = kqrClear;
  window.kqrRestoreSnapshot = kqrRestoreSnapshot;

  // fetchAndRebuildKPI is defined in shared-utils.js and exposed as window.fetchAndRebuildKPI there.
  // Do NOT re-assign here — shared-utils.js loads first and this scope has no local definition.
  // Expose KPI data accessors for Advocacy module (read-only)
  window.advGetKPIData   = function() { return (typeof KPI_DATA !== 'undefined'        && KPI_DATA.length)        ? KPI_DATA        : []; };
  window.advGetKPIStatic = function() { return (typeof KPI_DATA_STATIC !== 'undefined' && KPI_DATA_STATIC.length) ? KPI_DATA_STATIC  : []; };
  window.buildKPIAnalytics    = buildKPIAnalytics;
  window.buildTalentDashboard = buildTalentDashboard;
  window._showProfiles = function() {
    const dept = (window.NJTC_SESSION||{}).dept||'hr';
    console.log('[Manual] _showProfiles called, dept:', dept);
    setTalentTab('profiles');
  };
  // buildPolicies is defined in shared-utils.js and exported from there
  window.clearTalentFilters   = clearTalentFilters;
  window.closeConnectionsModal= closeConnectionsModal;
  window.openConnectionsModal = openConnectionsModal;
  window.closeKPIInquiry      = closeKPIInquiry;
  // closePolicyModal and goStep are defined + exported in shared-utils.js


  const KPI_Q_GID       = '880469';
    const KPI_Q_TTL       = 30 * 60 * 1000;  // 30 min, same as main

  // Minimal CSV parser (handles quoted multiline cells)
  function _parseKPIcsv(text) {
    var rows=[], row=[], field='', inQ=false;
    for (var i=0; i<text.length; i++) {
      var c=text[i];
      if (inQ) {
        if (c==='"' && text[i+1]==='"') { field+='"'; i++; }
        else if (c==='"') { inQ=false; }
        else { field+=c; }
      } else {
        if (c==='"') { inQ=true; }
        else if (c===',') { row.push(field); field=''; }
        else if (c==='\n' || c==='\r') {
          if (c==='\r' && text[i+1]==='\n') i++;
          row.push(field); field=''; rows.push(row); row=[];
        } else { field+=c; }
      }
    }
    if (field || row.length) { row.push(field); rows.push(row); }
    return rows;
  }

  // Parse Q data cell: "Goal: X\n\nCaptured Metric: Y"
    // Merge quarterly rows into KPI_DATA items
    // Fetch quarterly sheet (called after main KPI fetch succeeds)
      

  // ── Quarterly Retention — manually verified by HR each quarter ───────────
  // HR (Mysti Diaz) calculates this from headcount on the Staff Onboarding Tracker as of the
  // first day of the quarter — a snapshot the live Master List doesn't capture (it has no
  // hire-date field), so this can't be auto-computed from the sheet the portal already reads.
  // Formula: retained ÷ startCount × 100, where startCount = staff on the Onboarding Tracker
  // as of the quarter's first day, and retained = startCount − (terminations from that same
  // starting cohort during the quarter). Staff hired *and* terminated within the same quarter
  // are excluded from both startCount and the termination count ("retention does not consider
  // new hires"), per HR's definition.
  //
  // Update the entry for each quarter once HR reports the finalized numbers; leave startCount/
  // retainedCount null until then (renders as "Pending").
  const QUARTERLY_RETENTION_2526 = {
    Q1: { months: 'Sep–Nov', startCount: null, retainedCount: null, asOfStart: null,    asOfEnd: null },
    Q2: { months: 'Dec–Feb', startCount: 73,   retainedCount: 54,   asOfStart: '12/1/25', asOfEnd: '2/28/26' },
    Q3: { months: 'Mar–May', startCount: 82,   retainedCount: 62,   asOfStart: '3/1/26',  asOfEnd: '5/31/26' },
    Q4: { months: 'Jun–Aug', startCount: null, retainedCount: null, asOfStart: null,    asOfEnd: null },
  };
  const _qtrRetentionRate = q => {
    const d = QUARTERLY_RETENTION_2526[q];
    if (!d || d.startCount == null || d.retainedCount == null) return null;
    return Math.round((d.retainedCount / d.startCount) * 10000) / 100;
  };

  // ── HR & Data — Termination Analytics home widget ───────────────────────
  function _buildTermAnalyticsWidget() {
    const CY = '2025-2026';
    // If live HR fetch is still in flight, render a skeleton and auto-refresh when it lands
    if (!window._hrDataFetched) {
      // Poll until live data arrives, then swap in real widget
      setTimeout(function _pollHR() {
        const hw = document.getElementById('homeDeptWidget');
        // Guard: leaderboard owns this slot — stop polling if it rendered
        if (!hw || document.getElementById('lbWrap')) return;
        if (window._hrDataFetched) {
          try {
            const _onsiteHtml = typeof window._buildOnsiteRetentionWidget === 'function' ? window._buildOnsiteRetentionWidget() : '';
            hw.innerHTML = _buildTermAnalyticsWidget() + _onsiteHtml;
          } catch(e) {}
        } else {
          setTimeout(_pollHR, 600);
        }
      }, 600);
      return `<div style="background:#fff;border:1.5px solid #e2e8f0;border-radius:12px;padding:1.125rem 1.25rem;margin-top:1.5rem">
  <div style="display:flex;align-items:center;gap:.75rem;margin-bottom:.75rem">
    <div style="width:12px;height:12px;border-radius:50%;border:2px solid #3b82f6;border-top-color:transparent;animation:njtcSpin .8s linear infinite"></div>
    <div style="font-size:.75rem;color:#64748b;font-weight:600">Loading live HR data…</div>
  </div>
  <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:.6rem;margin-bottom:.9rem">
    ${[1,2,3,4,5].map(()=>`<div style="height:64px;background:#f1f5f9;border-radius:8px;animation:njtcPulse 1.4s ease-in-out infinite"></div>`).join('')}
  </div>
  <div style="height:10px;background:#f1f5f9;border-radius:4px;margin-bottom:.4rem;animation:njtcPulse 1.4s ease-in-out infinite"></div>
  <div style="height:10px;background:#f1f5f9;border-radius:4px;width:70%;animation:njtcPulse 1.4s ease-in-out infinite"></div>
  <style>
    @keyframes njtcSpin{to{transform:rotate(360deg)}}
    @keyframes njtcPulse{0%,100%{opacity:1}50%{opacity:.4}}
  </style>
</div>`;
    }
    // Normalize year strings to handle spacing variants like '2025 - 2026' vs '2025-2026'
    const _normY = y => (y||'').replace(/\s/g,'');
    const _normCY = _normY(CY);
    const yearEmps = HR_EMPS.filter(e => {
      const yrs = [...(e.y||[]), ...(e._liveYears||[])];
      return yrs.some(y => _normY(y) === _normCY);
    });
    const activeEmps = yearEmps.filter(e => e.s === 'Active');
    // Use live-sheet terminated data directly so count and reasons match the HR Master List
    // exactly — bypasses HR_EMPS name-matching failures that caused Unknown entries
    const _liveTerm = window._njtcLiveTerminated2526 || [];
    const termEmps = _liveTerm.length > 0
      ? _liveTerm.map(r => ({ _termReason: r.termReason||'', _termType: r.termType||'', _termDate: r.termDate||'' }))
      : yearEmps.filter(e => e.s !== 'Active');
    const total = (activeEmps.length + termEmps.length) || 1;  // avoid div/0

    // Quarter helper (academic year quarters: Q1=Sep-Nov, Q2=Dec-Feb, Q3=Mar-May, Q4=Jun-Aug)
    const _qtr = raw => {
      if (!raw || raw === '#VALUE!') return null;
      const d = new Date(raw);
      if (isNaN(d.getTime())) return null;
      const m = d.getMonth() + 1;
      if (m >= 9  && m <= 11) return 'Q1';
      if (m === 12 || m <= 2) return 'Q2';
      if (m >= 3  && m <= 5)  return 'Q3';
      return 'Q4';
    };
    const today = new Date();
    const _cm = today.getMonth() + 1;
    const curQ   = _cm >= 9 && _cm <= 11 ? 'Q1' : (_cm === 12 || _cm <= 2) ? 'Q2' : _cm >= 3 && _cm <= 5 ? 'Q3' : 'Q4';
    const qtrCounts = { Q1:0, Q2:0, Q3:0, Q4:0 };
    termEmps.forEach(e => { const q = _qtr((e._termDate||'').trim()); if (q) qtrCounts[q]++; });

    // Quarterly retention — HR's own formula (retained ÷ start-of-quarter headcount), sourced
    // from QUARTERLY_RETENTION_2526 above rather than derived from termination counts alone,
    // since the live sheet has no hire-date field to reconstruct start-of-quarter cohorts.
    const curQRate    = _qtrRetentionRate(curQ);
    const curQPending = curQRate == null;

    // Reason breakdown
    const reasonMap = {};
    termEmps.forEach(e => {
      const r = (e._termReason||'').trim() || 'Unknown';
      reasonMap[r] = (reasonMap[r] || 0) + 1;
    });
    const reasonEntries = Object.entries(reasonMap).sort((a,b) => b[1]-a[1]);
    const maxReason = reasonEntries.length ? reasonEntries[0][1] : 1;
    const reasonBarsHtml = reasonEntries.map(([label, count]) => {
      const pct = Math.round(count / (termEmps.length || 1) * 100);
      const barPct = Math.round(count / maxReason * 100);
      const isVol = /voluntary/i.test(label);
      const barColor = isVol ? '#0891b2' : /involuntary/i.test(label) ? '#dc2626' : '#94a3b8';
      return `<div style="margin-bottom:.45rem">
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.2rem">
    <span style="font-size:.7rem;color:#475569;max-width:70%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${esc(label)}">${esc(label)}</span>
    <span style="font-size:.7rem;font-weight:700;color:${barColor}">${count} <span style="font-weight:400;color:#94a3b8">(${pct}%)</span></span>
  </div>
  <div style="height:7px;background:#f1f5f9;border-radius:4px;overflow:hidden">
    <div style="height:100%;width:${barPct}%;background:${barColor};border-radius:4px;transition:width .4s"></div>
  </div>
</div>`;
    }).join('') || '<div style="font-size:.72rem;color:#94a3b8;font-style:italic">No termination reason data available yet.</div>';

    // Type split
    // Anchor with ^ so "Involuntary" doesn't substring-match /voluntary/
    const volCount  = termEmps.filter(e => /^voluntary/i.test((e._termType||'').trim())).length;
    const invCount  = termEmps.filter(e => /^involuntary/i.test((e._termType||'').trim())).length;
    const unkCount  = termEmps.length - volCount - invCount;
    const volPct    = termEmps.length ? Math.round(volCount / termEmps.length * 100) : 0;

    const src = _hrStatus === 'live' ? '🟢 Live' : '📋 Snapshot';

    return `<div style="background:#fff;border:1.5px solid #e2e8f0;border-radius:12px;padding:1.125rem 1.25rem;margin-top:1.5rem">
  <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:.5rem;margin-bottom:1rem">
    <div>
      <div style="font-size:.62rem;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#94a3b8;margin-bottom:.2rem">HR &amp; Data · Termination Analytics · ${CY}</div>
      <div style="font-size:1rem;font-weight:800;color:#0a1628">Staff Attrition Overview</div>
    </div>
    <span style="font-size:.62rem;color:#94a3b8;font-style:italic">${src}</span>
  </div>

  <!-- Definition callout -->
  <div style="background:#f0f7ff;border:1px solid #bfdbfe;border-radius:8px;padding:.625rem .875rem;margin-bottom:1rem;font-size:.7rem;color:#1e40af;line-height:1.55">
    <strong style="display:block;margin-bottom:.2rem;font-size:.68rem;text-transform:uppercase;letter-spacing:.06em;color:#1d4ed8">ℹ How Retention Is Calculated</strong>
    <strong>Annual</strong> = Active Staff ÷ Total Headcount for the school year (${CY}).
    <strong>Quarterly</strong> (Q1: Sep–Nov · Q2: Dec–Feb · Q3: Mar–May · Q4: Jun–Aug) = Retained ÷ Headcount at the start of that quarter, ×100 — new hires who leave within the same quarter aren't counted either way.
    Quarters without a confirmed figure show as "Pending."
  </div>

  <!-- KPI tiles row -->
  <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(110px,1fr));gap:.6rem;margin-bottom:1.125rem">
    ${[
      { v: activeEmps.length, l: 'Active Staff',    c: '#1d4ed8' },
      { v: termEmps.length,   l: 'Separated',       c: termEmps.length > 0 ? '#dc2626' : '#059669' },
      { v: Math.round(activeEmps.length / total * 100) + '%', l: 'Retention Rate', c: '#059669' },
      { v: curQPending ? 'Pending' : curQRate + '%', l: curQ + ' (' + QUARTERLY_RETENTION_2526[curQ].months + ')', c: curQPending ? '#94a3b8' : (curQRate >= 70 ? '#059669' : curQRate >= 50 ? '#d97706' : '#dc2626') },
      { v: volPct + '%', l: 'Voluntary', c: '#0891b2' },
    ].map(t => `<div style="text-align:center;padding:.625rem .5rem;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px">
      <div style="font-size:1.25rem;font-weight:800;color:${t.c};line-height:1.1">${t.v}</div>
      <div style="font-size:.62rem;color:#64748b;text-transform:uppercase;letter-spacing:.04em;margin-top:2px">${t.l}</div>
    </div>`).join('')}
  </div>

  <!-- Reason breakdown -->
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;align-items:start">
    <div>
      <div style="font-size:.68rem;font-weight:700;text-transform:uppercase;color:#94a3b8;letter-spacing:.06em;margin-bottom:.625rem">Termination Reason Breakdown</div>
      ${reasonBarsHtml}
    </div>
    <div>
      <div style="font-size:.68rem;font-weight:700;text-transform:uppercase;color:#94a3b8;letter-spacing:.06em;margin-bottom:.625rem">Type Split</div>
      ${[
        { label:'Voluntary',   count: volCount, color:'#0891b2', bg:'#e0f2fe' },
        { label:'Involuntary', count: invCount, color:'#dc2626', bg:'#fee2e2' },
        { label:'Unknown',     count: unkCount, color:'#94a3b8', bg:'#f1f5f9' },
      ].filter(x => x.count > 0).map(x => `<div style="display:flex;align-items:center;justify-content:space-between;padding:.35rem .6rem;background:${x.bg};border-radius:6px;margin-bottom:.35rem">
        <span style="font-size:.75rem;font-weight:600;color:${x.color}">${x.label}</span>
        <span style="font-size:.75rem;font-weight:800;color:${x.color}">${x.count}</span>
      </div>`).join('') || '<div style="font-size:.72rem;color:#94a3b8;font-style:italic">No type data yet.</div>'}
      <div style="margin-top:.75rem">
        <div style="font-size:.68rem;font-weight:700;text-transform:uppercase;color:#94a3b8;letter-spacing:.06em;margin-bottom:.45rem">By Quarter (Sep–Aug)</div>
        ${['Q1','Q2','Q3','Q4'].map(q => {
          const cnt   = qtrCounts[q];
          const isCur = q === curQ;
          const rate  = _qtrRetentionRate(q);
          const d     = QUARTERLY_RETENTION_2526[q];
          const rateLabel = rate == null ? 'Pending' : rate + '% retention';
          const rateColor = rate == null ? '#94a3b8' : (rate >= 70 ? '#059669' : rate >= 50 ? '#d97706' : '#dc2626');
          const dateRange = d.asOfStart && d.asOfEnd ? `${d.asOfStart}–${d.asOfEnd}` : d.months;
          const title = rate == null ? `${cnt} separation(s) logged; awaiting HR's start-of-quarter count` : `${d.retainedCount}/${d.startCount} retained (as of ${d.asOfStart}–${d.asOfEnd})`;
          return `<div style="display:flex;align-items:center;justify-content:space-between;padding:.25rem .5rem;border-radius:5px;margin-bottom:.25rem;background:${isCur?'#eff6ff':'transparent'};border:1px solid ${isCur?'#bfdbfe':'#f1f5f9'}" title="${esc(title)}">
            <span style="font-size:.72rem;color:${isCur?'#1d4ed8':'#64748b'};font-weight:${isCur?'700':'400'}">${q}${isCur?' ●':''} <span style="color:#94a3b8;font-weight:400">(${dateRange} · ${cnt} sep.)</span></span>
            <span style="font-size:.72rem;font-weight:700;color:${rateColor}">${rateLabel}</span>
          </div>`;
        }).join('')}
      </div>
    </div>
  </div>
</div>`;
  }

  // ── HR & Data — Onsite Tracker (Summer 2026 → SY 2026-2027) home widget ─────────────────
  // Fully live-computed: the Onsite Tracker records a real hire date ("Offer Accepted") per
  // person, so retention here is Active ÷ (Active + Terminated) for everyone who was ever on
  // a given cycle's roster — no manual quarterly entry table needed like 2025-2026's. HR
  // maintains the roster and terminations tabs directly in the Google Sheet; this widget only
  // ever reads them, so edits are live for every viewer and never lost on refresh.
  function _buildOnsiteRetentionWidget() {
    if (!window._onsiteDataFetched) {
      setTimeout(function _pollOnsite() {
        const el = document.getElementById('onsiteRetentionWidget');
        if (!el) return;
        if (window._onsiteDataFetched) {
          try { el.outerHTML = _buildOnsiteRetentionWidget(); } catch(e) {}
        } else {
          setTimeout(_pollOnsite, 600);
        }
      }, 600);
      return `<div id="onsiteRetentionWidget" style="background:#fff;border:1.5px solid #e2e8f0;border-radius:12px;padding:1.125rem 1.25rem;margin-top:1.5rem">
  <div style="display:flex;align-items:center;gap:.75rem;margin-bottom:.75rem">
    <div style="width:12px;height:12px;border-radius:50%;border:2px solid #3b82f6;border-top-color:transparent;animation:njtcSpin .8s linear infinite"></div>
    <div style="font-size:.75rem;color:#64748b;font-weight:600">Loading Onsite Tracker (2026-2027)…</div>
  </div>
  <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:.6rem">
    ${[1,2,3,4].map(()=>`<div style="height:64px;background:#f1f5f9;border-radius:8px;animation:njtcPulse 1.4s ease-in-out infinite"></div>`).join('')}
  </div>
</div>`;
    }

    const roster   = window._njtcOnsiteRoster2627 || [];
    const terms    = window._njtcOnsiteTerms2627  || [];
    const rosterOk = window._onsiteRosterOk === true;
    const termsOk  = window._onsiteTermsOk  === true;

    // Either sheet failed to load — show this distinctly from a real 0%/100%, so an outage
    // never gets mistaken for an actual figure (retention needs both sheets to be trustworthy).
    if (!rosterOk || !termsOk) {
      const which = !rosterOk && !termsOk ? 'the roster and terminations sheets'
                  : !rosterOk ? 'the roster sheet' : 'the terminations sheet';
      return `<div id="onsiteRetentionWidget" style="background:#fff;border:1.5px solid #e2e8f0;border-radius:12px;padding:1.125rem 1.25rem;margin-top:1.5rem">
  <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:.5rem;margin-bottom:.75rem">
    <div>
      <div style="font-size:.62rem;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#94a3b8;margin-bottom:.2rem">HR &amp; Data · Onsite Tracker · Summer 2026 → SY 2026-2027</div>
      <div style="font-size:1rem;font-weight:800;color:#0a1628">Onboarding Retention (Next Cycle)</div>
    </div>
    <span style="font-size:.62rem;color:#b91c1c;font-style:italic">⚠️ Unavailable</span>
  </div>
  <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:.75rem .875rem;font-size:.72rem;color:#991b1b;line-height:1.5">
    Couldn't load ${which} right now. Not showing a retention figure here on purpose — a fetch failure isn't a real 0%.
  </div>
</div>`;
    }

    // Group by cycle (e.g. "Summer 2026", and later "Fall 2026", "SY 2026-2027", etc.)
    const cycles = [...new Set([...roster.map(r=>r.cycle), ...terms.map(r=>r.cycle)])].filter(Boolean);
    const byCycle = {};
    cycles.forEach(c => { byCycle[c] = { active: 0, term: 0 }; });
    roster.forEach(r => { if (byCycle[r.cycle]) byCycle[r.cycle].active++; });
    terms.forEach(r => { if (byCycle[r.cycle]) byCycle[r.cycle].term++; });

    const activeTotal = roster.length;
    const termTotal   = terms.length;
    const grandTotal  = (activeTotal + termTotal) || 1;
    const retentionPct = Math.round(activeTotal / grandTotal * 100);

    // Reason breakdown (terminations only)
    const reasonMap = {};
    terms.forEach(t => {
      const r = (t.termReason||'').trim() || 'Unknown';
      reasonMap[r] = (reasonMap[r]||0) + 1;
    });
    const reasonEntries = Object.entries(reasonMap).sort((a,b)=>b[1]-a[1]);
    const maxReason = reasonEntries.length ? reasonEntries[0][1] : 1;
    const reasonBarsHtml = reasonEntries.map(([label,count]) => {
      const pct = Math.round(count / (termTotal||1) * 100);
      const barPct = Math.round(count / maxReason * 100);
      const isVol = /voluntary/i.test(label);
      const barColor = isVol ? '#0891b2' : /involuntary/i.test(label) ? '#dc2626' : '#94a3b8';
      return `<div style="margin-bottom:.45rem">
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.2rem">
    <span style="font-size:.7rem;color:#475569;max-width:70%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${esc(label)}">${esc(label)}</span>
    <span style="font-size:.7rem;font-weight:700;color:${barColor}">${count} <span style="font-weight:400;color:#94a3b8">(${pct}%)</span></span>
  </div>
  <div style="height:7px;background:#f1f5f9;border-radius:4px;overflow:hidden">
    <div style="height:100%;width:${barPct}%;background:${barColor};border-radius:4px;transition:width .4s"></div>
  </div>
</div>`;
    }).join('') || '<div style="font-size:.72rem;color:#94a3b8;font-style:italic">No terminations logged yet for 2026-2027.</div>';

    const volCount = terms.filter(t => t.termType === 'Voluntary').length;
    const invCount = terms.filter(t => t.termType === 'Involuntary').length;
    const unkCount = termTotal - volCount - invCount;
    const volPct   = termTotal ? Math.round(volCount / termTotal * 100) : 0;

    const cycleRows = cycles.map(c => {
      const d = byCycle[c];
      const t = (d.active + d.term) || 1;
      const rate = Math.round(d.active / t * 100);
      const rateColor = rate >= 70 ? '#059669' : rate >= 50 ? '#d97706' : '#dc2626';
      return `<div style="display:flex;align-items:center;justify-content:space-between;padding:.25rem .5rem;border-radius:5px;margin-bottom:.25rem;background:transparent;border:1px solid #f1f5f9" title="${esc(d.active+'/'+t+' retained')}">
        <span style="font-size:.72rem;color:#64748b;font-weight:400">${esc(c)} <span style="color:#94a3b8;font-weight:400">(${d.term} sep.)</span></span>
        <span style="font-size:.72rem;font-weight:700;color:${rateColor}">${rate}% retention</span>
      </div>`;
    }).join('') || '<div style="font-size:.72rem;color:#94a3b8;font-style:italic">No cycle data yet.</div>';

    const src = _onsiteStatus === 'live' ? '🟢 Live' : '📋 Pending';

    return `<div id="onsiteRetentionWidget" style="background:#fff;border:1.5px solid #e2e8f0;border-radius:12px;padding:1.125rem 1.25rem;margin-top:1.5rem">
  <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:.5rem;margin-bottom:1rem">
    <div>
      <div style="font-size:.62rem;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#94a3b8;margin-bottom:.2rem">HR &amp; Data · Onsite Tracker · Summer 2026 → SY 2026-2027</div>
      <div style="font-size:1rem;font-weight:800;color:#0a1628">Onboarding Retention (Next Cycle)</div>
    </div>
    <span style="font-size:.62rem;color:#94a3b8;font-style:italic">${src}</span>
  </div>

  <!-- Definition callout -->
  <div style="background:#f0f7ff;border:1px solid #bfdbfe;border-radius:8px;padding:.625rem .875rem;margin-bottom:1rem;font-size:.7rem;color:#1e40af;line-height:1.55">
    <strong style="display:block;margin-bottom:.2rem;font-size:.68rem;text-transform:uppercase;letter-spacing:.06em;color:#1d4ed8">ℹ How Retention Is Calculated</strong>
    Retention = Active ÷ (Active + Terminated) for everyone who has been on a cycle's roster, ×100 — computed automatically from hire and termination dates.
  </div>

  <!-- KPI tiles row -->
  <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(110px,1fr));gap:.6rem;margin-bottom:1.125rem">
    ${[
      { v: activeTotal, l: 'Active Staff', c: '#1d4ed8' },
      { v: termTotal,   l: 'Separated',    c: termTotal > 0 ? '#dc2626' : '#059669' },
      { v: retentionPct + '%', l: 'Retention Rate', c: retentionPct >= 70 ? '#059669' : retentionPct >= 50 ? '#d97706' : '#dc2626' },
      { v: volPct + '%', l: 'Voluntary', c: '#0891b2' },
    ].map(t => `<div style="text-align:center;padding:.625rem .5rem;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px">
      <div style="font-size:1.25rem;font-weight:800;color:${t.c};line-height:1.1">${t.v}</div>
      <div style="font-size:.62rem;color:#64748b;text-transform:uppercase;letter-spacing:.04em;margin-top:2px">${t.l}</div>
    </div>`).join('')}
  </div>

  <!-- Reason breakdown -->
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;align-items:start">
    <div>
      <div style="font-size:.68rem;font-weight:700;text-transform:uppercase;color:#94a3b8;letter-spacing:.06em;margin-bottom:.625rem">Termination Reason Breakdown</div>
      ${reasonBarsHtml}
    </div>
    <div>
      <div style="font-size:.68rem;font-weight:700;text-transform:uppercase;color:#94a3b8;letter-spacing:.06em;margin-bottom:.625rem">Type Split</div>
      ${[
        { label:'Voluntary',   count: volCount, color:'#0891b2', bg:'#e0f2fe' },
        { label:'Involuntary', count: invCount, color:'#dc2626', bg:'#fee2e2' },
        { label:'Unknown',     count: unkCount, color:'#94a3b8', bg:'#f1f5f9' },
      ].filter(x => x.count > 0).map(x => `<div style="display:flex;align-items:center;justify-content:space-between;padding:.35rem .6rem;background:${x.bg};border-radius:6px;margin-bottom:.35rem">
        <span style="font-size:.75rem;font-weight:600;color:${x.color}">${x.label}</span>
        <span style="font-size:.75rem;font-weight:800;color:${x.color}">${x.count}</span>
      </div>`).join('') || '<div style="font-size:.72rem;color:#94a3b8;font-style:italic">No type data yet.</div>'}
      <div style="margin-top:.75rem">
        <div style="font-size:.68rem;font-weight:700;text-transform:uppercase;color:#94a3b8;letter-spacing:.06em;margin-bottom:.45rem">By Cycle</div>
        ${cycleRows}
      </div>
    </div>
  </div>
</div>`;
  }

  // ── Programming — Staff Retention Rate home widget ───────────────────────
  function _buildRetentionWidget() {
    const CY = '2025-2026';
    const PY = '2024-2025';
    const activeEmps  = HR_EMPS.filter(e => e.s === 'Active' && ((e.y||[]).includes(CY) || (e._liveYears||[]).includes(CY)));
    const cyEmps      = HR_EMPS.filter(e => (e.y||[]).includes(CY) || (e._liveYears||[]).includes(CY));
    const pyEmps      = HR_EMPS.filter(e => (e.y||[]).includes(PY));
    // Multi-cycle staff = active staff who also appear in a prior year
    const returning   = activeEmps.filter(e => e.c != null && e.c >= 2).length;
    const cyTotal     = cyEmps.length || 1;
    const retentionPct = Math.round(returning / cyTotal * 100);

    // Year-over-year headcount
    const cyActive    = cyEmps.filter(e => e.s === 'Active').length;
    const pyActive    = pyEmps.filter(e => e.s === 'Active').length;
    const yoyDelta    = cyActive - pyActive;
    const yoyColor    = yoyDelta >= 0 ? '#059669' : '#dc2626';
    const yoyIcon     = yoyDelta >= 0 ? '↑' : '↓';

    // Rehire-eligible pipeline (active, eligible, 2+ cycles)
    const rehireEligible = HR_EMPS.filter(e => (e.rh==='Yes'||e.rh===true) && e.c >= 2 && e.s === 'Active').length;
    const noRehire       = HR_EMPS.filter(e => (e.rh==='No'||e.rh===false) && e.s === 'Active').length;

    // Avg cycles of active staff
    const withCycles = activeEmps.filter(e => e.c != null && e.c > 0);
    const avgCycles  = withCycles.length ? (withCycles.reduce((s,e) => s + e.c, 0) / withCycles.length).toFixed(1) : '—';

    // Cycle distribution
    const cycleDist = {};
    activeEmps.forEach(e => { const c = e.c||1; cycleDist[c] = (cycleDist[c]||0)+1; });
    const cycleEntries = Object.entries(cycleDist).sort((a,b) => Number(a[0])-Number(b[0]));
    const maxCycleCt = cycleEntries.length ? Math.max(...cycleEntries.map(([,v])=>v)) : 1;

    const src = _hrStatus === 'live' ? '🟢 Live' : '📋 Snapshot';

    return `<div style="background:#fff;border:1.5px solid #e2e8f0;border-radius:12px;padding:1.125rem 1.25rem;margin-top:1.5rem">
  <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:.5rem;margin-bottom:1rem">
    <div>
      <div style="font-size:.62rem;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#94a3b8;margin-bottom:.2rem">Programming · Staff Retention Rate · ${CY}</div>
      <div style="font-size:1rem;font-weight:800;color:#0a1628">Tutor Retention &amp; Loyalty</div>
    </div>
    <span style="font-size:.62rem;color:#94a3b8;font-style:italic">${src}</span>
  </div>

  <!-- KPI tiles -->
  <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(110px,1fr));gap:.6rem;margin-bottom:1.125rem">
    ${[
      { v: cyActive,           l: 'Active ' + CY,    c: '#1d4ed8' },
      { v: returning,          l: 'Returning Staff',  c: '#7c3aed' },
      { v: retentionPct + '%', l: 'Retention Rate',  c: retentionPct >= 70 ? '#059669' : retentionPct >= 50 ? '#d97706' : '#dc2626' },
      { v: yoyIcon + Math.abs(yoyDelta), l: 'YoY Headcount',  c: yoyColor },
      { v: avgCycles,          l: 'Avg Cycles',       c: '#0891b2' },
    ].map(t => `<div style="text-align:center;padding:.625rem .5rem;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px">
      <div style="font-size:1.25rem;font-weight:800;color:${t.c};line-height:1.1">${t.v}</div>
      <div style="font-size:.62rem;color:#64748b;text-transform:uppercase;letter-spacing:.04em;margin-top:2px">${t.l}</div>
    </div>`).join('')}
  </div>

  <!-- Cycle distribution + rehire pipeline -->
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;align-items:start">
    <div>
      <div style="font-size:.68rem;font-weight:700;text-transform:uppercase;color:#94a3b8;letter-spacing:.06em;margin-bottom:.625rem">Cycle Distribution (Active Staff)</div>
      ${cycleEntries.map(([c, n]) => {
        const pct = Math.round(n / (activeEmps.length||1) * 100);
        const barPct = Math.round(n / maxCycleCt * 100);
        const color = Number(c) >= 3 ? '#7c3aed' : Number(c) === 2 ? '#1d4ed8' : '#94a3b8';
        return `<div style="margin-bottom:.4rem">
  <div style="display:flex;justify-content:space-between;margin-bottom:.18rem">
    <span style="font-size:.7rem;color:#475569">${c} Cycle${Number(c)!==1?'s':''}</span>
    <span style="font-size:.7rem;font-weight:700;color:${color}">${n} <span style="font-weight:400;color:#94a3b8">(${pct}%)</span></span>
  </div>
  <div style="height:7px;background:#f1f5f9;border-radius:4px;overflow:hidden">
    <div style="height:100%;width:${barPct}%;background:${color};border-radius:4px;transition:width .4s"></div>
  </div>
</div>`;
      }).join('') || '<div style="font-size:.72rem;color:#94a3b8;font-style:italic">No cycle data available.</div>'}
    </div>
    <div>
      <div style="font-size:.68rem;font-weight:700;text-transform:uppercase;color:#94a3b8;letter-spacing:.06em;margin-bottom:.625rem">SY Rehire Status</div>
      ${[
        { label: '✅ Returning (2+ cycles)', count: rehireEligible, bg: '#f0fdf4', color: '#059669' },
        { label: '🆕 New This SY',            count: noRehire,       bg: '#eff6ff', color: '#1d4ed8' },
      ].map(x => `<div style="display:flex;align-items:center;justify-content:space-between;padding:.4rem .65rem;background:${x.bg};border-radius:6px;margin-bottom:.35rem">
        <span style="font-size:.75rem;font-weight:600;color:${x.color}">${x.label}</span>
        <span style="font-size:.75rem;font-weight:800;color:${x.color}">${x.count}</span>
      </div>`).join('')}
      <div style="margin-top:.75rem;padding:.5rem .65rem;background:#eff6ff;border-radius:6px">
        <div style="font-size:.68rem;font-weight:700;text-transform:uppercase;color:#94a3b8;letter-spacing:.06em;margin-bottom:.3rem">Year-over-Year</div>
        <div style="display:flex;gap:1rem;flex-wrap:wrap;font-size:.8rem">
          <span><strong style="color:#1d4ed8">${cyActive}</strong> <span style="color:#64748b">active ${CY}</span></span>
          <span><strong style="color:#64748b">${pyActive}</strong> <span style="color:#94a3b8">active ${PY}</span></span>
          <span style="font-weight:700;color:${yoyColor}">${yoyDelta >= 0 ? '+' : ''}${yoyDelta} YoY</span>
        </div>
      </div>
    </div>
  </div>
</div>`;
  }

  // ════════════════════════════════════════════════════════════════
  //  QUARTERLY PDF EXPORT  (Data dept only)
  //  Uses jsPDF — loaded on demand same as Pearl Ops PDF
  // ════════════════════════════════════════════════════════════════
  function exportKPIQuarterlySummaryPDF() {
    var qd = window.KPI_Q_DATA;
    if (!qd || !qd.activeQs || !qd.activeQs.length) { alert('Quarterly data not yet loaded. Wait a moment and try again.'); return; }

    function _loadJsPDF(cb) {
      if (window.jspdf && window.jspdf.jsPDF) { cb(); return; }
      var s1 = document.createElement('script');
      s1.src = 'https://unpkg.com/jspdf@2.5.1/dist/jspdf.umd.min.js';
      s1.onload = function() {
        var s2 = document.createElement('script');
        s2.src = 'https://unpkg.com/jspdf-autotable@3.8.2/dist/jspdf.plugin.autotable.min.js';
        s2.onload = cb;
        document.head.appendChild(s2);
      };
      document.head.appendChild(s1);
    }

    function _safe(s) {
      return String(s||'').replace(/\u2014/g,'-').replace(/\u2013/g,'-').replace(/\u2019/g,"'")
        .replace(/\u201C/g,'"').replace(/\u201D/g,'"').replace(/[^\x20-\x7E\xA0-\xFF]/g,'').replace(/\s+/g,' ').trim();
    }

    _loadJsPDF(function() {
      var jsPDF = window.jspdf.jsPDF;
      var doc = new jsPDF({ orientation:'portrait', unit:'pt', format:'letter' });
      var W = doc.internal.pageSize.getWidth(), H = doc.internal.pageSize.getHeight();
      var M = 46;

      // ── NJTC brand palette (RGB arrays) ─────────────────────────
      var NAVY=[27,42,74], NAVY_D=[19,32,58], GOLD=[232,168,56], WHITE=[255,255,255];
      var ICEBLUE=[238,242,249], INK=[30,41,59], MUTED=[100,116,139];
      var GREEN=[22,163,74], GREEN_BG=[234,247,238], RED=[220,38,38], RED_BG=[252,234,234];
      var AMBER=[217,119,6], AMBER_BG=[253,243,227], BLUE=[37,99,235], PURPLE=[124,58,237];
      var LINEGRID=[231,234,240];

      var activeQs   = qd.activeQs;
      var scorecards = qd.scorecards;
      var latestQ    = activeQs[activeQs.length-1];
      var latestSC   = scorecards[scorecards.length-1];
      var tsStr      = new Date(qd.lastUpdated).toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'});
      var narrative  = _buildQuarterlyNarrative(qd);

      function statusColor(s) {
        if (s==='Met') return GREEN; if (s==='Partially Met') return AMBER;
        if (s==='In Progress') return BLUE; if (s==='Has Not Met') return RED;
        if (s==='Coming Down the Pipeline') return PURPLE; return MUTED;
      }
      function _short(s){ return _qShortStatus(s); }

      // ── Drawing helpers ──────────────────────────────────────────
      function fillRect(x,y,w,h,color,r){ doc.setFillColor.apply(doc,color); if(r){doc.roundedRect(x,y,w,h,r,r,'F');} else {doc.rect(x,y,w,h,'F');} }
      function circle(cx,cy,r,color){ doc.setFillColor.apply(doc,color); doc.circle(cx,cy,r,'F'); }
      function icon(name, x, y, w, h) { doc.addImage('data:image/png;base64,'+_NJTC_ICONS[name], 'PNG', x, y, w, h, 'icon_'+name, 'FAST'); }
      function iconInCircle(cx,cy,d,circColor,iconName,iconScale){
        circle(cx,cy,d/2,circColor);
        var isz = d*(iconScale||0.52);
        icon(iconName, cx-isz/2, cy-isz/2, isz, isz);
      }
      function text(str,x,y,opts){
        opts=opts||{};
        doc.setFont('helvetica', opts.bold?'bold':(opts.italic?'italic':'normal'));
        doc.setFontSize(opts.size||10);
        doc.setTextColor.apply(doc, opts.color||INK);
        var o = {};
        if (opts.align) o.align = opts.align;
        doc.setCharSpace(opts.charSpace||0);
        doc.text(_safe(str), x, y, o);
        doc.setCharSpace(0);
      }
      function paragraph(str,x,y,maxW,opts){
        opts=opts||{};
        doc.setFont('helvetica', opts.bold?'bold':'normal');
        doc.setFontSize(opts.size||10);
        doc.setTextColor.apply(doc, opts.color||INK);
        var lines = doc.splitTextToSize(_safe(str), maxW);
        doc.text(lines, x, y, {lineHeightFactor: opts.lineHeightFactor||1.35});
        return y + lines.length * (opts.size||10) * (opts.lineHeightFactor||1.35);
      }
      // Thick stroked arc, degrees, 0 = top (12 o'clock), clockwise positive.
      function drawArc(cx, cy, r, startDeg, endDeg, color, lineWidth) {
        var steps = Math.max(2, Math.ceil(Math.abs(endDeg-startDeg)/3));
        doc.setDrawColor.apply(doc, color);
        doc.setLineWidth(lineWidth);
        try { doc.setLineCap(1); } catch(e){}
        for (var i=0;i<steps;i++){
          var a1 = (startDeg + (endDeg-startDeg)*i/steps - 90) * Math.PI/180;
          var a2 = (startDeg + (endDeg-startDeg)*(i+1)/steps - 90) * Math.PI/180;
          var x1 = cx + r*Math.cos(a1), y1 = cy + r*Math.sin(a1);
          var x2 = cx + r*Math.cos(a2), y2 = cy + r*Math.sin(a2);
          doc.line(x1,y1,x2,y2);
        }
      }
      function gaugeRing(cx, cy, r, pct, color, trackColor, lw){
        drawArc(cx,cy,r,0,360,trackColor,lw);
        if (pct>0) drawArc(cx,cy,r,0,Math.min(360,pct*3.6),color,lw);
      }
      function pageHeader(title, subtitle, iconName, circColor) {
        iconInCircle(M+22, 56, 44, circColor, iconName);
        text(title, M+56, 52, {size:19, bold:true, color:NAVY});
        if (subtitle) text(subtitle, M+56, 68, {size:9.5, color:MUTED});
      }

      // ══════════════════════════════════════════════════════════
      // PAGE 1 — COVER
      // ══════════════════════════════════════════════════════════
      fillRect(0,0,W,H,NAVY);
      circle(W+40, -60, 210, NAVY_D);
      circle(W+10, 20, 150, [31,49,89]);
      icon('grad_gold', M, 44, 26, 26);
      text('NEW JERSEY TUTORING CORPS', M+34, 63, {size:11.5, bold:true, color:GOLD, charSpace:1.6});

      text('Quarterly Goal Summary', M, 150, {size:30, bold:true, color:WHITE});
      text('Q'+latestQ+'  \u2014  SY 2025\u20132026  \u00B7  Leadership Review', M, 178, {size:14.5, color:GOLD});
      text('Generated '+tsStr+'   \u00B7   Confidential \u2014 Internal Use Only', M, 200, {size:9.5, color:[170,180,200]});

      var gx=W-130, gy=245, gr=62;
      gaugeRing(gx,gy,gr,latestSC.score,GOLD,[42,59,99],14);
      doc.setFont('helvetica','bold'); doc.setFontSize(26); doc.setTextColor.apply(doc,WHITE);
      doc.text(latestSC.score+'%', gx, gy+9, {align:'center'});
      doc.setFont('helvetica','bold'); doc.setFontSize(9); doc.setTextColor.apply(doc,GOLD);
      doc.text(latestSC.health.label.toUpperCase(), gx, gy+28, {align:'center'});

      var coverTiles=[
        {label:'Targets Met', val:latestSC.counts.met, icon:'check_gold'},
        {label:'In Progress', val:latestSC.counts.prog, icon:'chartline_white'},
        {label:'Total Tracked', val:latestSC.counts.total, icon:'bullseye_white'},
      ];
      coverTiles.forEach(function(t,i){
        var tx = M + i*185;
        icon(t.icon, tx, 335, 22, 22);
        text(String(t.val), tx+30, 353, {size:20, bold:true, color:WHITE});
        text(t.label.toUpperCase(), tx+30, 368, {size:8, color:[170,180,200], charSpace:0.6});
      });
      text('Prepared by the Data & Evaluation Department', M, H-40, {size:9, italic:true, color:[130,142,168]});

      // ══════════════════════════════════════════════════════════
      // PAGE 2 — WHERE WE STAND
      // ══════════════════════════════════════════════════════════
      doc.addPage();
      fillRect(0,0,W,H,WHITE);
      pageHeader('Where We Stand', 'Executive Summary  \u00B7  Q'+latestQ+' SY 2025\u20132026', 'chartline_white', NAVY);

      fillRect(M, 92, 300, 96, ICEBLUE, 8);
      paragraph(narrative.headline, M+16, 112, 268, {size:9, lineHeightFactor:1.3});

      var sstats=[
        {label:'Met', val:latestSC.counts.met, color:GREEN, bg:GREEN_BG},
        {label:'Progress', val:latestSC.counts.prog, color:BLUE, bg:[234,241,254]},
        {label:'Partial', val:latestSC.counts.partial, color:AMBER, bg:AMBER_BG},
        {label:'Not Met', val:latestSC.counts.notmet, color:RED, bg:RED_BG},
      ];
      sstats.forEach(function(st,i){
        var cx = M+320 + (i%2)*115, cy = 92 + Math.floor(i/2)*48;
        fillRect(cx, cy, 108, 42, st.bg, 6);
        doc.setFont('helvetica','bold'); doc.setFontSize(18); doc.setTextColor.apply(doc,st.color);
        doc.text(String(st.val), cx+10, cy+27);
        doc.setFont('helvetica','bold'); doc.setFontSize(8); doc.setTextColor.apply(doc,INK);
        doc.text(st.label, cx+50, cy+27);
      });

      var chartY = 215;
      text('Health Score Trend', M, chartY, {size:11, bold:true, color:NAVY});
      var plotX=M, plotY=chartY+18, plotW=300, plotH=150;
      fillRect(plotX,plotY,plotW,plotH,[252,253,254]);
      doc.setDrawColor.apply(doc,LINEGRID); doc.setLineWidth(0.75);
      for (var gl=0; gl<=4; gl++){ var yy=plotY+plotH-(plotH*gl/4); doc.line(plotX,yy,plotX+plotW,yy); }
      var scPts = scorecards.map(function(sc,i){
        var xx = plotX + (scorecards.length>1 ? plotW*i/(scorecards.length-1) : plotW/2);
        var yy2 = plotY+plotH - plotH*(sc.score/100);
        return {x:xx,y:yy2,sc:sc};
      });
      doc.setDrawColor.apply(doc,GOLD); doc.setLineWidth(2.5);
      for (var i=0;i<scPts.length-1;i++){ doc.line(scPts[i].x,scPts[i].y,scPts[i+1].x,scPts[i+1].y); }
      scPts.forEach(function(p){
        circle(p.x,p.y,5,NAVY); circle(p.x,p.y,3,GOLD);
        doc.setFont('helvetica','bold'); doc.setFontSize(8.5); doc.setTextColor.apply(doc,NAVY);
        doc.text(p.sc.score+'%', p.x, p.y-10, {align:'center'});
        doc.setFont('helvetica','normal'); doc.setFontSize(8); doc.setTextColor.apply(doc,MUTED);
        doc.text(p.sc.label, p.x, plotY+plotH+14, {align:'center'});
      });

      text('Q'+latestQ+' Status Mix', M+330, chartY, {size:11, bold:true, color:NAVY});
      var segs=[
        {label:'Met', val:latestSC.counts.met, color:GREEN},
        {label:'Progress', val:latestSC.counts.prog, color:BLUE},
        {label:'Partial', val:latestSC.counts.partial, color:AMBER},
        {label:'Not Met', val:latestSC.counts.notmet, color:RED},
      ];
      if (latestSC.counts.pipe) segs.push({label:'Pipeline', val:latestSC.counts.pipe, color:PURPLE});
      var dcx=M+420, dcy=plotY+66, dr=58;
      var cum=0, total=latestSC.counts.total;
      drawArc(dcx,dcy,dr,0,360,[236,239,244],20);
      segs.forEach(function(sg){
        if (!sg.val) return;
        var start=cum/total*360, end=(cum+sg.val)/total*360;
        drawArc(dcx,dcy,dr,start,end,sg.color,20);
        cum+=sg.val;
      });
      doc.setFont('helvetica','bold'); doc.setFontSize(16); doc.setTextColor.apply(doc,NAVY);
      doc.text(String(total), dcx, dcy+6, {align:'center'});
      doc.setFont('helvetica','normal'); doc.setFontSize(7.5); doc.setTextColor.apply(doc,MUTED);
      doc.text('TARGETS', dcx, dcy+18, {align:'center'});
      var lgY = dcy+dr+26;
      segs.forEach(function(sg,i){
        var lx = M+330 + (i%3)*70, ly = lgY + Math.floor(i/3)*16;
        circle(lx,ly-3,3.5,sg.color);
        text(sg.label+' ('+sg.val+')', lx+8, ly, {size:7.5, color:INK});
      });

      // ══════════════════════════════════════════════════════════
      // PAGE 2B — YEAR-OVER-YEAR SNAPSHOT (only once EOY data exists)
      // ══════════════════════════════════════════════════════════
      var yoy = (typeof _buildYoYSnapshot === 'function') ? _buildYoYSnapshot() : null;
      if (yoy) {
        function _hexRgb(hex){ var h=String(hex||'').replace('#',''); return [parseInt(h.substr(0,2),16)||0, parseInt(h.substr(2,2),16)||0, parseInt(h.substr(4,2),16)||0]; }

        doc.addPage();
        fillRect(0,0,W,H,WHITE);
        pageHeader('Year-over-Year Snapshot', 'SY 2024–2025 vs. SY 2025–2026  ·  End-of-Year Comparison', 'chartline_white', GOLD);

        var yColW = (W-2*M-40)/2, yPyX = M, yCyX = M+yColW+40, yCardY = 100, yCardH = 236;
        [
          { x:yPyX, d:yoy.priorYear, tintBg:ICEBLUE, ringTrack:[222,228,238] },
          { x:yCyX, d:yoy.currentYear, tintBg:[253,247,232], ringTrack:[240,225,190] },
        ].forEach(function(col){
          var rc = _hexRgb(col.d.risk.color);
          fillRect(col.x, yCardY, yColW, yCardH, col.tintBg, 10);
          text(col.d.label, col.x+18, yCardY+26, {size:12.5, bold:true, color:NAVY});
          var gx = col.x+yColW/2, gy = yCardY+108, gr=46;
          gaugeRing(gx, gy, gr, col.d.score, rc, col.ringTrack, 12);
          doc.setFont('helvetica','bold'); doc.setFontSize(19); doc.setTextColor.apply(doc,NAVY);
          doc.text(col.d.score.toFixed(1)+'%', gx, gy+7, {align:'center'});
          doc.setFont('helvetica','bold'); doc.setFontSize(8); doc.setTextColor.apply(doc,rc);
          doc.text(col.d.risk.label.toUpperCase(), gx, gy+22, {align:'center'});
          paragraph(friendlyGoalLine({score:col.d.score, counts:col.d.counts}) + ' — ' + col.d.total + ' targets tracked', col.x+16, yCardY+186, yColW-32, {size:8, color:MUTED, lineHeightFactor:1.3});
        });

        var yDeltaY = yCardY+yCardH+18, yDeltaH = 54;
        var yDeltaBg = yoy.improved ? GREEN_BG : RED_BG, yDeltaC = yoy.improved ? GREEN : RED;
        fillRect(M, yDeltaY, W-2*M, yDeltaH, yDeltaBg, 8);
        doc.setFont('helvetica','bold'); doc.setFontSize(15); doc.setTextColor.apply(doc,yDeltaC);
        doc.text((yoy.improved?'▲ ':'▼ ')+yoy.deltaLabel, M+18, yDeltaY+yDeltaH/2+5);
        text('year-over-year weighted score'+(yoy.bucketChanged ? '  ·  '+yoy.priorYear.risk.label+' → '+yoy.currentYear.risk.label : ''), M+150, yDeltaY+yDeltaH/2+4, {size:9.5, color:INK});

        paragraph(yoy.note, M, yDeltaY+yDeltaH+22, W-2*M, {size:7.75, color:MUTED, italic:true, lineHeightFactor:1.35});
      }

      // ══════════════════════════════════════════════════════════
      // PAGE 3 — WHAT'S WORKING
      // ══════════════════════════════════════════════════════════
      if (narrative.positives.length) {
        doc.addPage();
        fillRect(0,0,W,H,WHITE);
        pageHeader('What\u2019s Working', narrative.positives.length+' target'+(narrative.positives.length===1?'':'s')+' moved to a stronger status this cycle', 'trophy_white', GREEN);

        var topPos = narrative.positives.slice(0,4);
        var restPos = narrative.positives.slice(4,10);
        var cardW=(W-2*M-16)/2, cardH=64;
        topPos.forEach(function(p,i){
          var col=i%2, row=Math.floor(i/2);
          var cx=M+col*(cardW+16), cy=96+row*(cardH+14);
          fillRect(cx,cy,cardW,cardH,GREEN_BG,7);
          icon('check_green', cx+12, cy+cardH/2-13, 26, 26);
          paragraph(p.text, cx+50, cy+18, cardW-64, {size:8.75, color:INK, lineHeightFactor:1.28});
        });

        var afterCardsY = 96 + 2*(cardH+14) + 12;
        if (restPos.length) {
          text('Additional improvements this cycle', M, afterCardsY, {size:11, bold:true, color:NAVY});
          var ly = afterCardsY+22;
          restPos.forEach(function(p){
            var d = qd.deltas.find(function(x){return x.target===p.target;});
            var lm = d.moves[d.moves.length-1];
            var compact = p.target+'  \u2014  '+_short(lm.from)+' \u2192 '+_short(lm.to);
            circle(M+3, ly-3, 2.2, GREEN);
            text(compact, M+12, ly, {size:8.75, color:INK});
            ly += 16;
          });
          if (narrative.positives.length > 10) {
            text('+ '+(narrative.positives.length-10)+' more \u2014 see the appendix for the full breakdown.', M, ly+10, {size:8, italic:true, color:MUTED});
          }
        }
      }

      // ══════════════════════════════════════════════════════════
      // PAGE 4 — WHAT NEEDS ATTENTION (+ WHERE TO FOCUS)
      // ══════════════════════════════════════════════════════════
      if (narrative.concerns.length) {
        doc.addPage();
        fillRect(0,0,W,H,WHITE);
        pageHeader('What Needs Attention', 'Regressions and risk requiring leadership follow-up  ·  see Recommended Next Steps for the owner-assigned action on each item', 'warning_white', RED);

        var cy4 = 96;
        narrative.concerns.slice(0,6).forEach(function(c){
          var critical = c.severity==='critical';
          var bg = critical?RED_BG:AMBER_BG, dot = critical?RED:AMBER;
          var rowH = 56;
          fillRect(M, cy4, W-2*M, rowH, bg, 6);
          circle(M+22, cy4+rowH/2, 4, dot);
          doc.setFont('helvetica','bold'); doc.setFontSize(6.75); doc.setTextColor.apply(doc,dot);
          doc.text(critical?'CRITICAL':'WATCH', M+22, cy4+rowH/2+16, {align:'center'});
          paragraph(c.text, M+50, cy4+15, W-2*M-66, {size:8.75, color:INK, lineHeightFactor:1.25});
          cy4 += rowH+12;
        });
        if (narrative.concerns.length > 6) {
          text('+ '+(narrative.concerns.length-6)+' more \u2014 see the appendix for the full breakdown.', M, cy4+8, {size:8, italic:true, color:MUTED});
        }

        if (narrative.focus.length) {
          var fy = cy4 + (narrative.concerns.length>6?26:14);
          if (fy > H-160) { doc.addPage(); fillRect(0,0,W,H,WHITE); pageHeader('Where to Focus', 'Targets with no status movement across every tracked quarter', 'bullseye_white', AMBER); fy=96; }
          else { iconInCircle(M+22, fy+22, 44, AMBER, 'bullseye_white'); text('Where to Focus', M+56, fy+18, {size:15, bold:true, color:NAVY}); fy += 48; }
          narrative.focus.slice(0,5).forEach(function(f){
            var rowH=48;
            fillRect(M, fy, W-2*M, rowH, AMBER_BG, 6);
            paragraph(f.text, M+14, fy+16, W-2*M-28, {size:8.75, color:INK, lineHeightFactor:1.25});
            fy += rowH+10;
          });
        }
      } else if (narrative.focus.length) {
        doc.addPage();
        fillRect(0,0,W,H,WHITE);
        pageHeader('Where to Focus', 'Targets with no status movement across every tracked quarter', 'bullseye_white', AMBER);
        var fy2 = 96;
        narrative.focus.slice(0,8).forEach(function(f){
          var rowH=48;
          fillRect(M, fy2, W-2*M, rowH, AMBER_BG, 6);
          paragraph(f.text, M+14, fy2+16, W-2*M-28, {size:8.75, color:INK, lineHeightFactor:1.25});
          fy2 += rowH+10;
        });
      }

      // ══════════════════════════════════════════════════════════
      // PAGE 5 — RECOMMENDED NEXT STEPS
      // (owner-assigned, dated action plan for each at-risk target,
      //  followed by shorter org-level priorities)
      // ══════════════════════════════════════════════════════════
      function _wrapLines(str, size, maxW, bold){ doc.setFont('helvetica', bold?'bold':'normal'); doc.setFontSize(size); return doc.splitTextToSize(_safe(str), maxW); }

      doc.addPage();
      fillRect(0,0,W,H,NAVY);
      circle(-40, H-90, 170, NAVY_D);
      iconInCircle(M+22, 56, 44, GOLD, 'flag_navy');
      text('Recommended Next Steps', M+56, 52, {size:19, bold:true, color:WHITE});
      text(narrative.actionPlan.length ? 'Owner-assigned action plan, plus priorities heading into '+narrative.nextQLabel : 'Priorities heading into '+narrative.nextQLabel, M+56, 68, {size:9.5, color:[170,180,200]});

      var apY = 100;
      if (narrative.actionPlan.length) {
        narrative.actionPlan.slice(0,4).forEach(function(a){
          var critical = a.severity==='critical';
          var accent = critical ? [239,109,109] : GOLD;
          var titleX = M+70, titleW = W-M-titleX;
          var titleLines = _wrapLines(a.target, 10.25, titleW, true);
          var titleH = titleLines.length * 10.25 * 1.2;
          var actionLines = _wrapLines(a.action, 9, W-2*M-32, false);
          var rowH = 18 + titleH + 8 + actionLines.length*9*1.3 + 18;
          fillRect(M, apY, W-2*M, rowH, [28,42,74], 8);
          fillRect(M, apY, 4, rowH, accent);
          doc.setFont('helvetica','bold'); doc.setFontSize(7); doc.setTextColor.apply(doc, accent);
          doc.text(critical?'CRITICAL':'WATCH', M+16, apY+17);
          paragraph(a.target, titleX, apY+15, titleW, {size:10.25, bold:true, color:WHITE, lineHeightFactor:1.2});
          var actionY = apY + 18 + titleH + 8;
          paragraph(a.action, M+16, actionY, W-2*M-32, {size:9, color:[210,218,232], lineHeightFactor:1.3});
          text('Owner: '+(a.owner||'Unassigned')+'   ·   Due: '+a.dueLabel+' review', M+16, apY+rowH-8, {size:7.5, color:accent});
          apY += rowH + 12;
        });
        if (narrative.actionPlan.length > 4) {
          text('+ '+(narrative.actionPlan.length-4)+' more action item'+(narrative.actionPlan.length-4>1?'s':'')+' — see What Needs Attention for the full list.', M, apY+4, {size:8, italic:true, color:[170,180,200]});
          apY += 22;
        }
        apY += 6;
        text('Additional Priorities', M, apY, {size:11.5, bold:true, color:GOLD});
        apY += 20;
      }

      narrative.nextSteps.forEach(function(step,i){
        circle(M+11, apY+11, 11, GOLD);
        doc.setFont('helvetica','bold'); doc.setFontSize(10.5); doc.setTextColor.apply(doc,NAVY);
        doc.text(String(i+1), M+11, apY+14.5, {align:'center'});
        var lines2 = paragraph(step, M+34, apY+7, W-2*M-34, {size:9.5, color:WHITE, lineHeightFactor:1.3});
        apY = Math.max(apY+34, lines2+10);
      });

      // ══════════════════════════════════════════════════════════
      // PAGE 6 — GOAL AREA SCORECARD (native bar chart)
      // ══════════════════════════════════════════════════════════
      doc.addPage();
      fillRect(0,0,W,H,WHITE);
      pageHeader('Goal Area Scorecard', 'Weighted health score by goal area  \u00B7  Q'+latestQ, 'clipboard_navy', ICEBLUE);

      var goalOrder=[], goalGroups={};
      qd.rows.forEach(function(r){ var g=(r[0]||'').trim(),t=(r[1]||'').trim(); if(!g||!t) return; if(goalOrder.indexOf(g)<0) goalOrder.push(g); if(!goalGroups[g]) goalGroups[g]=[]; goalGroups[g].push(r); });
      var scCol = _Q_COLS[latestQ-1][1];
      var goalScores = goalOrder.map(function(goal){
        var rs = goalGroups[goal], sum=0;
        rs.forEach(function(r){ var s=(r[scCol]||'').trim(); if(s==='Met')sum+=1; else if(s==='Partially Met')sum+=0.5; else if(s==='In Progress')sum+=0.25; else if(s==='Coming Down the Pipeline')sum+=0.1; });
        return { goal:goal, pct: rs.length?Math.round(sum/rs.length*100):0, n:rs.length };
      });

      var barX = M+190, barMaxW = W-M-barX-40, barH=20, barGap=14, by=100;
      goalScores.forEach(function(g){
        var col = g.pct>=85?GREEN:g.pct>=65?AMBER:g.pct>=40?[220,100,38]:RED;
        paragraph(g.goal, M, by+2, 178, {size:8, color:INK, lineHeightFactor:1.15});
        fillRect(barX, by, barMaxW, barH, [240,242,246], 4);
        fillRect(barX, by, barMaxW*(g.pct/100), barH, col, 4);
        doc.setFont('helvetica','bold'); doc.setFontSize(8.5); doc.setTextColor.apply(doc,INK);
        doc.text(g.pct+'%', barX+barMaxW+6, by+barH-6);
        by += barH+barGap;
      });

      // ══════════════════════════════════════════════════════════
      // APPENDIX — Full cross-quarter target status + captured metrics
      // ══════════════════════════════════════════════════════════
      doc.addPage();
      fillRect(0,0,W,42,NAVY);
      text('Appendix  \u2014  Full Cross-Quarter Target Status & Captured Metrics', M, 27, {size:12, bold:true, color:WHITE});

      var apGoalOrder=[], apGoalGroups={};
      qd.rows.forEach(function(r){ var g=(r[0]||'').trim(),t=(r[1]||'').trim(); if(!g||!t) return; if(apGoalOrder.indexOf(g)<0) apGoalOrder.push(g); if(!apGoalGroups[g]) apGoalGroups[g]=[]; apGoalGroups[g].push(r); });
      var qHeaders = ['Target'].concat(activeQs.map(function(q){return 'Q'+q;})).concat(['Q'+latestQ+' Goal vs. Actual']);
      var allBodyRows=[];
      apGoalOrder.forEach(function(goal){
        allBodyRows.push([{content:goal, colSpan:qHeaders.length, styles:{fillColor:NAVY,textColor:WHITE,fontStyle:'bold',fontSize:8}}]);
        apGoalGroups[goal].forEach(function(r){
          var row=[_safe(r[1]||'').slice(0,72)];
          activeQs.forEach(function(q){ row.push(_short((r[_Q_COLS[q-1][1]]||'').trim())||'\u2014'); });
          var cap = _metricCaption(r[_Q_COLS[latestQ-1][0]]||'');
          row.push(cap?_safe(cap).slice(0,60):'\u2014');
          allBodyRows.push(row);
        });
      });
      var qColW=40, lastColW=W-2*M-220-qColW*activeQs.length;
      var colWidths={0:{cellWidth:220}};
      activeQs.forEach(function(q,i){ colWidths[i+1]={cellWidth:qColW}; });
      colWidths[activeQs.length+1]={cellWidth:lastColW};
      doc.autoTable({
        startY:58, head:[qHeaders], body:allBodyRows, theme:'grid',
        headStyles:{fillColor:NAVY,textColor:WHITE,fontSize:7.5,fontStyle:'bold'},
        bodyStyles:{fontSize:6.75,textColor:INK}, margin:{left:M,right:M},
        columnStyles:colWidths,
        didParseCell:function(d){
          if(d.section==='body' && !(d.row.raw[0] && d.row.raw[0].styles)){
            var colIdx=d.column.index;
            if(colIdx>0 && colIdx<=activeQs.length){ var s=d.cell.raw||''; d.cell.styles.textColor=statusColor(s==='Met'?'Met':s==='Partial'?'Partially Met':s==='Progress'?'In Progress':s==='Not Met'?'Has Not Met':s==='Pipeline'?'Coming Down the Pipeline':s)||MUTED; }
            if(colIdx===activeQs.length+1){ d.cell.styles.fontStyle='bold'; d.cell.styles.textColor=NAVY; }
          }
        }
      });

      // ── Footer on every page ──────────────────────────────────
      var pageCount = doc.internal.getNumberOfPages();
      for (var pg=1; pg<=pageCount; pg++){
        doc.setPage(pg);
        fillRect(0,H-26,W,26,NAVY);
        text('New Jersey Tutoring Corps  \u00B7  Quarterly Summary  \u00B7  SY 2025\u20132026  \u00B7  Confidential', M, H-10, {size:7, color:WHITE});
        doc.setFont('helvetica','normal'); doc.setFontSize(7); doc.setTextColor.apply(doc,WHITE);
        doc.text('Page '+pg+' of '+pageCount, W-M, H-10, {align:'right'});
      }

      var blob = doc.output('blob');
      var url  = URL.createObjectURL(blob);
      var a    = document.createElement('a');
      a.href   = url; a.download = 'NJTC_Quarterly_Summary_Q'+latestQ+'_SY2526.pdf';
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      setTimeout(function(){ URL.revokeObjectURL(url); }, 2000);
    });
  }

  // ════════════════════════════════════════════════════════════════
  //  QUARTERLY PPTX EXPORT  (Data dept only)
  //  Uses PptxGenJS loaded on demand from CDN
  // ════════════════════════════════════════════════════════════════
  function exportKPIQuarterlySummaryPPTX() {
    var qd = window.KPI_Q_DATA;
    if (!qd || !qd.activeQs || !qd.activeQs.length) { alert('Quarterly data not yet loaded. Wait a moment and try again.'); return; }

    function _loadPptxGen(cb) {
      if (window.PptxGenJS) { cb(); return; }
      var s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/pptxgenjs@3.12.0/dist/pptxgen.bundle.js';
      s.onload = cb;
      s.onerror = function(){ alert('Could not load PPTX library. Check network connection.'); };
      document.head.appendChild(s);
    }

    function _safe(s){ return String(s||'').replace(/[^\x20-\x7E]/g,'').replace(/\s+/g,' ').trim(); }
    function _short(s){ return _qShortStatus(s); }

    _loadPptxGen(function() {
      var pptx = new window.PptxGenJS();
      pptx.layout  = 'LAYOUT_WIDE'; // 13.3 x 7.5 in
      pptx.author  = 'New Jersey Tutoring Corps';
      pptx.subject = 'Quarterly Goal Summary';
      pptx.title   = 'NJTC Quarterly Summary Q' + qd.activeQs[qd.activeQs.length-1] + ' SY2025-26';
      pptx.company = 'NJTC';

      // ── NJTC brand palette ──────────────────────────────────────
      var NAVY='1B2A4A', NAVY_D='13203A', GOLD='E8A838', WHITE='FFFFFF';
      var CREAM='F7F5F0', ICEBLUE='EEF2F9', INK='1E293B', MUTED='64748B';
      var GREEN='16A34A', GREEN_BG='EAF7EE', RED='DC2626', RED_BG='FCEAEA';
      var AMBER='D97706', AMBER_BG='FDF3E3', BLUE='2563EB', PURPLE='7C3AED';

      var latestQ  = qd.activeQs[qd.activeQs.length-1];
      var latestSC = qd.scorecards[qd.scorecards.length-1];
      var deltas   = qd.deltas;
      var tsStr    = new Date(qd.lastUpdated).toLocaleDateString('en-US',{month:'long',year:'numeric'});
      var hHex     = latestSC.score>=85?GREEN:latestSC.score>=65?AMBER:latestSC.score>=40?'DC6502':RED;
      var narrative = _buildQuarterlyNarrative(qd);

      function icon(name) { return { data: 'image/png;base64,' + _NJTC_ICONS[name] }; }
      function iconCircle(slide, iconName, cx, cy, d, circleColor) {
        slide.addShape(pptx.shapes.OVAL, {x:cx-d/2, y:cy-d/2, w:d, h:d, fill:{color:circleColor}});
        var isz = d*0.52;
        slide.addImage(Object.assign(icon(iconName), {x:cx-isz/2, y:cy-isz/2, w:isz, h:isz}));
      }
      function freshShadow(opts) { return Object.assign({type:'outer', color:'0B1220', blur:14, offset:4, angle:90, opacity:0.14}, opts||{}); }
      function slideHeader(slide, title, subtitle, iconName, circleColor) {
        iconCircle(slide, iconName, 0.85, 0.85, 0.62, circleColor);
        slide.addText(title, {x:1.35, y:0.5, w:9.5, h:0.5, fontSize:26, bold:true, color:NAVY, fontFace:'Cambria', margin:0});
        if (subtitle) slide.addText(subtitle, {x:1.35, y:0.95, w:10, h:0.35, fontSize:11.5, color:MUTED, fontFace:'Calibri', margin:0});
      }

      // ══════════════════════════════════════════════════════════
      // SLIDE 1 — COVER
      // ══════════════════════════════════════════════════════════
      var s1 = pptx.addSlide();
      s1.background = { color: NAVY };
      s1.addShape(pptx.shapes.OVAL, {x:9.6, y:-2.2, w:7, h:7, fill:{color:NAVY_D}, line:{type:'none'}});
      s1.addShape(pptx.shapes.OVAL, {x:10.6, y:-1.2, w:5, h:5, fill:{color:'1F3159'}, line:{type:'none'}});
      s1.addImage(Object.assign(icon('grad_gold'), {x:0.7, y:0.55, w:0.5, h:0.5}));
      s1.addText('NEW JERSEY TUTORING CORPS', {x:1.25, y:0.55, w:7, h:0.5, fontSize:13, bold:true, color:GOLD, charSpacing:2, fontFace:'Calibri', valign:'middle'});
      s1.addText('Quarterly Goal Summary', {x:0.7, y:2.15, w:10.5, h:0.85, fontSize:44, bold:true, color:WHITE, fontFace:'Cambria', valign:'top'});
      s1.addText('Q'+latestQ+' \u2014 School Year 2025\u20132026  \u00B7  Leadership Review', {x:0.7, y:3.12, w:10, h:0.55, fontSize:18, color:GOLD, fontFace:'Calibri'});
      s1.addText('Generated '+tsStr+'   \u00B7   Confidential \u2014 Internal Use Only', {x:0.7, y:3.72, w:10, h:0.4, fontSize:10.5, color:'A9B4C9', fontFace:'Calibri'});

      var gaugeData = [{ name:'Score', labels:['Health','Remaining'], values:[latestSC.score, 100-latestSC.score] }];
      s1.addChart(pptx.charts.DOUGHNUT, gaugeData, {
        x:9.7, y:2.05, w:2.9, h:2.9, holeSize:72,
        chartColors:[GOLD, '2A3B63'], showLegend:false, showValue:false, showPercent:false,
        dataBorder:{ pt:0, color:NAVY }
      });
      s1.addText(latestSC.score+'%', {x:9.7, y:2.98, w:2.9, h:0.6, fontSize:30, bold:true, color:WHITE, align:'center', fontFace:'Cambria'});
      s1.addText(latestSC.health.label.toUpperCase(), {x:9.7, y:3.52, w:2.9, h:0.35, fontSize:10.5, bold:true, color:GOLD, align:'center', charSpacing:1.5, fontFace:'Calibri'});

      var coverTiles = [
        {label:'Targets Met', val:latestSC.counts.met, icon:'check_gold'},
        {label:'In Progress', val:latestSC.counts.prog, icon:'chartline_white'},
        {label:'Total Tracked', val:latestSC.counts.total, icon:'bullseye_white'},
      ];
      coverTiles.forEach(function(t,i){
        var cx = 0.7 + i*3.6;
        s1.addImage(Object.assign(icon(t.icon), {x:cx, y:5.15, w:0.42, h:0.42}));
        s1.addText(String(t.val), {x:cx+0.55, y:5.02, w:1.6, h:0.5, fontSize:26, bold:true, color:WHITE, fontFace:'Cambria', margin:0});
        s1.addText(t.label.toUpperCase(), {x:cx+0.55, y:5.5, w:2.4, h:0.3, fontSize:9, color:'A9B4C9', charSpacing:1, fontFace:'Calibri', margin:0});
      });
      s1.addText('Prepared by the Data & Evaluation Department', {x:0.7, y:6.85, w:8, h:0.35, fontSize:9.5, italic:true, color:'7C89A6', fontFace:'Calibri'});

      // ══════════════════════════════════════════════════════════
      // SLIDE 2 — WHERE WE STAND
      // ══════════════════════════════════════════════════════════
      var s2 = pptx.addSlide();
      s2.background = { color: WHITE };
      slideHeader(s2, 'Where We Stand', 'Executive Summary \u2014 Q'+latestQ+' SY 2025\u20132026', 'chartline_white', NAVY);

      s2.addShape(pptx.shapes.ROUNDED_RECTANGLE, {x:0.6, y:1.55, w:7.2, h:1.55, fill:{color:ICEBLUE}, rectRadius:0.09, shadow: freshShadow()});
      s2.addText(_safe(narrative.headline), {x:0.85, y:1.72, w:6.7, h:1.25, fontSize:11.5, color:INK, fontFace:'Calibri', valign:'top', lineSpacingMultiple:1.18});

      var s2stats=[
        {label:'Met', val:latestSC.counts.met, hex:GREEN, bg:GREEN_BG},
        {label:'Progress', val:latestSC.counts.prog, hex:BLUE, bg:'EAF1FE'},
        {label:'Partial', val:latestSC.counts.partial, hex:AMBER, bg:AMBER_BG},
        {label:'Not Met', val:latestSC.counts.notmet, hex:RED, bg:RED_BG},
      ];
      s2stats.forEach(function(st,i){
        var cx = 8.05 + (i%2)*2.35, cy = 1.55 + Math.floor(i/2)*0.82;
        s2.addShape(pptx.shapes.ROUNDED_RECTANGLE, {x:cx, y:cy, w:2.15, h:0.7, fill:{color:st.bg}, rectRadius:0.08});
        s2.addText(String(st.val), {x:cx+0.12, y:cy+0.06, w:0.9, h:0.58, fontSize:24, bold:true, color:st.hex, fontFace:'Cambria', valign:'middle', margin:0});
        s2.addText(st.label, {x:cx+1.0, y:cy+0.06, w:1.1, h:0.58, fontSize:10, bold:true, color:INK, fontFace:'Calibri', valign:'middle', margin:0});
      });

      if (qd.scorecards.length >= 2) {
        s2.addText('Health Score Trend', {x:0.6, y:3.4, w:5, h:0.3, fontSize:12, bold:true, color:NAVY, fontFace:'Calibri'});
        var trendData = [{ name: 'Organizational Health', labels: qd.scorecards.map(function(sc){return sc.label;}), values: qd.scorecards.map(function(sc){return sc.score;}) }];
        s2.addChart(pptx.charts.LINE, trendData, {
          x:0.5, y:3.7, w:6.0, h:3.15,
          chartColors:[GOLD], lineSize:3, lineSmooth:false,
          lineDataSymbol:'circle', lineDataSymbolSize:7, lineDataSymbolLineColor:NAVY,
          showValue:true, dataLabelColor:NAVY, dataLabelPosition:'t', dataLabelFontSize:10,
          catAxisLabelColor:MUTED, valAxisLabelColor:MUTED, valAxisLabelFormatCode:'0"%"',
          valGridLine:{color:'E7EAF0', size:0.75}, catGridLine:{style:'none'},
          chartArea:{fill:{color:WHITE}}, showLegend:false,
          valAxisMinVal:0, valAxisMaxVal:100
        });
      }

      s2.addText('Q'+latestQ+' Status Mix', {x:6.85, y:3.4, w:5, h:0.3, fontSize:12, bold:true, color:NAVY, fontFace:'Calibri'});
      var mixLabels=['Met','Progress','Partial','Not Met'], mixVals=[latestSC.counts.met, latestSC.counts.prog, latestSC.counts.partial, latestSC.counts.notmet];
      if (latestSC.counts.pipe) { mixLabels.push('Pipeline'); mixVals.push(latestSC.counts.pipe); }
      var mixData=[{name:'Status', labels:mixLabels, values:mixVals}];
      s2.addChart(pptx.charts.DOUGHNUT, mixData, {
        x:6.85, y:3.7, w:3.0, h:3.15, holeSize:55,
        chartColors:[GREEN, BLUE, AMBER, RED, PURPLE],
        showLegend:true, legendPos:'b', legendColor:INK, legendFontSize:9,
        showValue:true, dataLabelColor:WHITE, dataLabelFontSize:10, dataLabelPosition:'ctr',
        dataBorder:{pt:1.5,color:WHITE}
      });

      // ══════════════════════════════════════════════════════════
      // SLIDE 2B — YEAR-OVER-YEAR SNAPSHOT (only once EOY data exists)
      // ══════════════════════════════════════════════════════════
      var yoy = (typeof _buildYoYSnapshot === 'function') ? _buildYoYSnapshot() : null;
      if (yoy) {
        var s2b = pptx.addSlide();
        s2b.background = { color: WHITE };
        slideHeader(s2b, 'Year-over-Year Snapshot', 'SY 2024–2025 vs. SY 2025–2026 — End-of-Year Comparison', 'chartline_white', GOLD);

        [
          { x:0.6,  d:yoy.priorYear,   bg:ICEBLUE },
          { x:6.85, d:yoy.currentYear, bg:'FDF7E8' },
        ].forEach(function(col){
          var hex = col.d.risk.color.replace('#','');
          s2b.addShape(pptx.shapes.ROUNDED_RECTANGLE, {x:col.x, y:1.55, w:5.9, h:3.55, fill:{color:col.bg}, rectRadius:0.09, shadow:freshShadow()});
          s2b.addText(col.d.label, {x:col.x+0.3, y:1.75, w:5.3, h:0.4, fontSize:15, bold:true, color:NAVY, fontFace:'Cambria'});
          var gaugeData2 = [{ name:'Score', labels:['Score','Remaining'], values:[col.d.score, 100-col.d.score] }];
          s2b.addChart(pptx.charts.DOUGHNUT, gaugeData2, {
            x:col.x+1.85, y:2.2, w:2.2, h:2.2, holeSize:70,
            chartColors:[hex, 'E2E8F0'], showLegend:false, showValue:false, showPercent:false, dataBorder:{pt:0,color:col.bg}
          });
          s2b.addText(col.d.score.toFixed(1)+'%', {x:col.x+1.85, y:2.95, w:2.2, h:0.5, fontSize:20, bold:true, color:NAVY, align:'center', fontFace:'Cambria'});
          s2b.addText(col.d.risk.label.toUpperCase(), {x:col.x+1.85, y:3.4, w:2.2, h:0.3, fontSize:9, bold:true, color:hex, align:'center', charSpacing:1, fontFace:'Calibri'});
          s2b.addText(_safe(friendlyGoalLine({score:col.d.score, counts:col.d.counts}) + ' — ' + col.d.total + ' targets tracked'), {x:col.x+0.3, y:4.55, w:5.3, h:0.45, fontSize:9, color:MUTED, align:'center', fontFace:'Calibri', valign:'top'});
        });

        var deltaHex = yoy.improved ? GREEN : RED, deltaBg = yoy.improved ? GREEN_BG : RED_BG;
        s2b.addShape(pptx.shapes.ROUNDED_RECTANGLE, {x:0.6, y:5.35, w:12.1, h:0.72, fill:{color:deltaBg}, rectRadius:0.08});
        s2b.addText((yoy.improved?'▲ ':'▼ ')+yoy.deltaLabel, {x:0.85, y:5.35, w:2.2, h:0.72, fontSize:17, bold:true, color:deltaHex, valign:'middle', fontFace:'Cambria', margin:0});
        s2b.addText('year-over-year weighted score'+(yoy.bucketChanged ? '  ·  '+yoy.priorYear.risk.label+' → '+yoy.currentYear.risk.label : ''), {x:3.05, y:5.35, w:9.4, h:0.72, fontSize:11, color:INK, valign:'middle', fontFace:'Calibri', margin:0});

        s2b.addText(_safe(yoy.note), {x:0.6, y:6.25, w:12.1, h:0.9, fontSize:8.5, italic:true, color:MUTED, fontFace:'Calibri', valign:'top', lineSpacingMultiple:1.25});
      }

      // ══════════════════════════════════════════════════════════
      // SLIDE 3 — WHAT'S WORKING
      // ══════════════════════════════════════════════════════════
      if (narrative.positives.length) {
        var s3 = pptx.addSlide();
        s3.background = { color: WHITE };
        slideHeader(s3, 'What\u2019s Working', narrative.positives.length+' target'+(narrative.positives.length===1?'':'s')+' moved to a stronger status this cycle', 'trophy_white', GREEN);

        var top4 = narrative.positives.slice(0,4);
        var rest6 = narrative.positives.slice(4,10);
        top4.forEach(function(p,i){
          var col = i%2, row = Math.floor(i/2);
          var cx = 0.6 + col*6.15, cy = 1.55 + row*1.15;
          s3.addShape(pptx.shapes.ROUNDED_RECTANGLE, {x:cx, y:cy, w:5.9, h:1.0, fill:{color:GREEN_BG}, rectRadius:0.08, shadow:freshShadow({blur:8,offset:2})});
          s3.addImage(Object.assign(icon('check_green'), {x:cx+0.18, y:cy+0.28, w:0.42, h:0.42}));
          s3.addText(_safe(p.text), {x:cx+0.72, y:cy+0.08, w:5.0, h:0.85, fontSize:10, color:INK, fontFace:'Calibri', valign:'middle', lineSpacingMultiple:1.08});
        });

        if (rest6.length) {
          s3.addText('Additional improvements this cycle', {x:0.6, y:4.05, w:6, h:0.3, fontSize:11.5, bold:true, color:NAVY, fontFace:'Calibri'});
          var ly3 = 4.45;
          rest6.forEach(function(p){
            var d = deltas.find(function(x){ return x.target===p.target; });
            var lm = d.moves[d.moves.length-1];
            var compact = p.target + '  \u2014  ' + _short(lm.from) + ' \u2192 ' + _short(lm.to);
            s3.addShape(pptx.shapes.OVAL, {x:0.65, y:ly3+0.07, w:0.09, h:0.09, fill:{color:GREEN}});
            s3.addText(_safe(compact), {x:0.88, y:ly3-0.04, w:11.6, h:0.36, fontSize:9.75, color:INK, fontFace:'Calibri', margin:0, valign:'top'});
            ly3 += 0.38;
          });
        }
        if (narrative.positives.length > 10) {
          s3.addText('+ ' + (narrative.positives.length-10) + ' more \u2014 see the appendix for the full breakdown.', {x:0.6, y:7.1, w:9, h:0.3, fontSize:9, italic:true, color:MUTED, fontFace:'Calibri'});
        }
      }

      // ══════════════════════════════════════════════════════════
      // SLIDE 4 — WHAT NEEDS ATTENTION
      // ══════════════════════════════════════════════════════════
      if (narrative.concerns.length) {
        var s4 = pptx.addSlide();
        s4.background = { color: WHITE };
        slideHeader(s4, 'What Needs Attention', 'Regressions and risk requiring leadership follow-up  ·  see Recommended Next Steps for the owner-assigned action on each item', 'warning_white', RED);

        var cy4 = 1.6;
        narrative.concerns.slice(0,5).forEach(function(c){
          var critical = c.severity === 'critical';
          var bg = critical ? RED_BG : AMBER_BG;
          var dot = critical ? RED : AMBER;
          s4.addShape(pptx.shapes.ROUNDED_RECTANGLE, {x:0.6, y:cy4, w:12.1, h:0.86, fill:{color:bg}, rectRadius:0.07});
          s4.addShape(pptx.shapes.OVAL, {x:0.82, y:cy4+0.33, w:0.2, h:0.2, fill:{color:dot}});
          s4.addText(critical ? 'CRITICAL' : 'WATCH', {x:0.6, y:cy4, w:1.2, h:0.86, fontSize:8, bold:true, color:dot, align:'center', valign:'middle', charSpacing:1, fontFace:'Calibri'});
          s4.addText(_safe(c.text), {x:1.9, y:cy4+0.07, w:10.6, h:0.72, fontSize:9.75, color:INK, fontFace:'Calibri', valign:'middle', margin:0, lineSpacingMultiple:1.05});
          cy4 += 1.0;
        });
        if (narrative.concerns.length > 5) {
          s4.addText('+ ' + (narrative.concerns.length-5) + ' more \u2014 see the appendix for the full breakdown.', {x:0.6, y:cy4+0.05, w:9, h:0.3, fontSize:9, italic:true, color:MUTED, fontFace:'Calibri'});
        }
      }

      // ══════════════════════════════════════════════════════════
      // SLIDE 5 — WHERE TO FOCUS (stalled targets, if any)
      // ══════════════════════════════════════════════════════════
      if (narrative.focus.length) {
        var s5 = pptx.addSlide();
        s5.background = { color: WHITE };
        slideHeader(s5, 'Where to Focus', 'Targets with no status movement across every tracked quarter', 'bullseye_white', AMBER);
        var cy5 = 1.6;
        narrative.focus.slice(0,6).forEach(function(f){
          s5.addShape(pptx.shapes.ROUNDED_RECTANGLE, {x:0.6, y:cy5, w:12.1, h:0.78, fill:{color:AMBER_BG}, rectRadius:0.07});
          s5.addText(_safe(f.text), {x:0.9, y:cy5+0.06, w:11.5, h:0.66, fontSize:9.75, color:INK, fontFace:'Calibri', valign:'middle', margin:0, lineSpacingMultiple:1.05});
          cy5 += 0.9;
        });
        if (narrative.focus.length > 6) {
          s5.addText('+ ' + (narrative.focus.length-6) + ' more \u2014 see the appendix for the full breakdown.', {x:0.6, y:cy5+0.05, w:9, h:0.3, fontSize:9, italic:true, color:MUTED, fontFace:'Calibri'});
        }
      }

      // ══════════════════════════════════════════════════════════
      // SLIDE 6 — RECOMMENDED NEXT STEPS
      // (owner-assigned, dated action plan for each at-risk target,
      //  followed by shorter org-level priorities)
      // ══════════════════════════════════════════════════════════
      var s6 = pptx.addSlide();
      s6.background = { color: NAVY };
      s6.addShape(pptx.shapes.OVAL, {x:-2.5, y:4.8, w:6, h:6, fill:{color:NAVY_D}, line:{type:'none'}});
      iconCircle(s6, 'flag_navy', 0.85, 0.85, 0.62, GOLD);
      s6.addText('Recommended Next Steps', {x:1.35, y:0.5, w:9, h:0.5, fontSize:26, bold:true, color:WHITE, fontFace:'Cambria', margin:0});
      s6.addText(narrative.actionPlan.length ? 'Owner-assigned action plan, plus priorities heading into '+narrative.nextQLabel : 'Priorities heading into '+narrative.nextQLabel, {x:1.35, y:0.95, w:11, h:0.35, fontSize:11.5, color:'A9B4C9', fontFace:'Calibri', margin:0});

      var cy6 = 1.55;
      if (narrative.actionPlan.length) {
        narrative.actionPlan.slice(0,3).forEach(function(a){
          var critical = a.severity==='critical';
          var accent = critical ? 'EF6D6D' : GOLD;
          s6.addShape(pptx.shapes.ROUNDED_RECTANGLE, {x:0.6, y:cy6, w:12.1, h:1.15, fill:{color:'1C2C4E'}, rectRadius:0.06});
          s6.addShape(pptx.shapes.RECTANGLE, {x:0.6, y:cy6, w:0.06, h:1.15, fill:{color:accent}, line:{type:'none'}});
          s6.addText(critical?'CRITICAL':'WATCH', {x:0.8, y:cy6+0.08, w:1.3, h:0.22, fontSize:7.5, bold:true, color:accent, charSpacing:1, fontFace:'Calibri', margin:0});
          s6.addText(_safe(a.target), {x:2.1, y:cy6+0.05, w:10.4, h:0.4, fontSize:10.5, bold:true, color:WHITE, fontFace:'Calibri', valign:'top', lineSpacingMultiple:1.05, margin:0});
          s6.addText(_safe(a.action), {x:0.8, y:cy6+0.46, w:11.7, h:0.46, fontSize:9, color:'D2DAE8', fontFace:'Calibri', valign:'top', lineSpacingMultiple:1.1, margin:0});
          s6.addText('Owner: '+_safe(a.owner||'Unassigned')+'   ·   Due: '+a.dueLabel+' review', {x:0.8, y:cy6+0.94, w:11.5, h:0.2, fontSize:7.5, color:accent, fontFace:'Calibri', margin:0});
          cy6 += 1.3;
        });
        if (narrative.actionPlan.length > 3) {
          s6.addText('+ ' + (narrative.actionPlan.length-3) + ' more action item' + (narrative.actionPlan.length-3>1?'s':'') + ' — see What Needs Attention for the full list.', {x:0.6, y:cy6, w:11, h:0.3, fontSize:9, italic:true, color:'A9B4C9', fontFace:'Calibri'});
          cy6 += 0.32;
        }
        s6.addText('Additional Priorities', {x:0.6, y:cy6+0.06, w:6, h:0.3, fontSize:13, bold:true, color:GOLD, fontFace:'Cambria'});
        cy6 += 0.46;
      }
      narrative.nextSteps.forEach(function(step,i){
        s6.addShape(pptx.shapes.OVAL, {x:0.7, y:cy6, w:0.36, h:0.36, fill:{color:GOLD}});
        s6.addText(String(i+1), {x:0.7, y:cy6, w:0.36, h:0.36, fontSize:12.5, bold:true, color:NAVY, align:'center', valign:'middle', fontFace:'Cambria', margin:0});
        s6.addText(_safe(step), {x:1.25, y:cy6-0.06, w:11.2, h:0.5, fontSize:10.25, color:WHITE, fontFace:'Calibri', valign:'middle', lineSpacingMultiple:1.1});
        cy6 += 0.58;
      });

      // ══════════════════════════════════════════════════════════
      // SLIDE 7 — GOAL AREA SCORECARD (native bar chart)
      // ══════════════════════════════════════════════════════════
      var s7 = pptx.addSlide();
      s7.background = { color: WHITE };
      slideHeader(s7, 'Goal Area Scorecard', 'Weighted health score by goal area \u2014 Q'+latestQ, 'clipboard_navy', ICEBLUE);

      var goalOrder2=[], goalGroups2={};
      qd.rows.forEach(function(r){ var g=(r[0]||'').trim(),t=(r[1]||'').trim(); if(!g||!t) return; if(goalOrder2.indexOf(g)<0) goalOrder2.push(g); if(!goalGroups2[g]) goalGroups2[g]=[]; goalGroups2[g].push(r); });
      var scCol = _Q_COLS[latestQ-1][1];
      var goalScores = goalOrder2.map(function(goal){
        var rs = goalGroups2[goal], sum=0;
        rs.forEach(function(r){ var s=(r[scCol]||'').trim(); if(s==='Met')sum+=1; else if(s==='Partially Met')sum+=0.5; else if(s==='In Progress')sum+=0.25; else if(s==='Coming Down the Pipeline')sum+=0.1; });
        return { goal:goal, pct: rs.length?Math.round(sum/rs.length*100):0, n:rs.length };
      });
      var barData = [{ name:'Score', labels: goalScores.map(function(g){ return g.goal.length>28?g.goal.slice(0,26)+'\u2026':g.goal; }), values: goalScores.map(function(g){ return g.pct; }) }];
      s7.addChart(pptx.charts.BAR, barData, {
        x:0.5, y:1.55, w:12.3, h:5.6, barDir:'bar',
        chartColors: goalScores.map(function(g){ return g.pct>=85?GREEN:g.pct>=65?AMBER:g.pct>=40?'DC6502':RED; }),
        valAxisMinVal:0, valAxisMaxVal:100, valAxisLabelFormatCode:'0"%"',
        showValue:true, dataLabelPosition:'outEnd', dataLabelColor:INK, dataLabelFontSize:9.5,
        catAxisLabelColor:INK, catAxisLabelFontSize:9.5, valAxisLabelColor:MUTED,
        valGridLine:{color:'E7EAF0', size:0.75}, catGridLine:{style:'none'},
        chartArea:{fill:{color:WHITE}}, showLegend:false, barGapWidthPct:35
      });

      // ══════════════════════════════════════════════════════════
      // SLIDE 8 — APPENDIX (full target status + live captured metrics)
      // ══════════════════════════════════════════════════════════
      var goalOrder=[], goalGroups={};
      qd.rows.forEach(function(r){ var g=(r[0]||'').trim(),t=(r[1]||'').trim(); if(!g||!t) return; if(goalOrder.indexOf(g)<0) goalOrder.push(g); if(!goalGroups[g]) goalGroups[g]=[]; goalGroups[g].push(r); });
      var s8 = pptx.addSlide();
      s8.background = { color: WHITE };
      s8.addShape(pptx.shapes.RECTANGLE,{x:0,y:0,w:'100%',h:1.1,fill:{color:NAVY}});
      s8.addText('Appendix \u2014 Full Target Status & Captured Metrics (Q'+latestQ+')',{x:0.4,y:0.25,w:11,h:0.65,fontSize:18,bold:true,color:WHITE,fontFace:'Arial'});
      var rows8=[['Target','Goal Area','Q'+latestQ+' Status','Q'+latestQ+' Goal vs. Actual']];
      goalOrder.forEach(function(goal){
        goalGroups[goal].forEach(function(r){
          var s = (r[_Q_COLS[latestQ-1][1]]||'').trim();
          var cap = _metricCaption(r[_Q_COLS[latestQ-1][0]]||'');
          rows8.push([_safe(r[1]||'').slice(0,58), _safe(goal).slice(0,26), _short(s)||'\u2014', _safe(cap).slice(0,48)||'\u2014']);
        });
      });
      s8.addTable(rows8,{x:0.4,y:1.2,w:12.3,colW:[4.2,2.6,1.5,4.0],
        border:{type:'solid',color:'E2E8F0',pt:0.5},autoPage:true,
        headFontSize:8.5,headBold:true,headFill:{color:NAVY},headColor:WHITE,
        bodyFontSize:7,bodyColor:'1E293B',bodyFill:{color:'F7F9FC'}
      });

      pptx.writeFile({fileName:'NJTC_Quarterly_Summary_Q'+latestQ+'_SY2526.pptx'})
        .catch(function(e){ console.error('PPTX export error:',e); alert('PPTX generation failed — check console for details.'); });
    });
  }

  // ── Expose to global scope ───────────────────────────────────────────────
  window.buildKPIAnalytics       = buildKPIAnalytics;
  window.renderKPIAnalytics      = renderKPIAnalytics;
  window.renderKPIAnalyticsTab   = renderKPIAnalyticsTab;
  window.renderQuarterlyTab      = renderQuarterlyTab;
  window.setKPIAnalyticsTab      = setKPIAnalyticsTab;
  window.fetchKPIMetadata        = fetchKPIMetadata;
  window.kqrRenderSnapshot       = kqrRenderSnapshot;
  window.kqrClear                = kqrClear;
  window.kqrHandleFile           = kqrHandleFile;
  window.openKPIInquiry          = openKPIInquiry;
  window.openKPIInquiryWithMetric = openKPIInquiryWithMetric;
  window.resetKPIInquiry         = resetKPIInquiry;
  window.submitKPIInquiry        = submitKPIInquiry;

  // ══════════════════════════════════════════════════════════════════════════
  //  LIVE WORKBOOK — direct link to the source Google Sheet (Quarterly tab)
  // ══════════════════════════════════════════════════════════════════════════
  var _NJTC_SHEET_ID = '1woHFd7OzO_IS5yD8HOGifVCu0hW3qAStyja63hcxvWg';
  var _NJTC_QUARTERLY_GID = '1313501732';
  function openKPILiveWorkbook() {
    window.open('https://docs.google.com/spreadsheets/d/' + _NJTC_SHEET_ID + '/edit#gid=' + _NJTC_QUARTERLY_GID, '_blank');
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  LIVE PRESENTATION — a self-contained, chart-driven, keyboard-navigable
  //  presentation built fresh from window.KPI_Q_DATA every time it's opened.
  //  Opens in a new tab via a Blob URL. Uses inline SVG for every chart
  //  (gauge ring, line trend, donut mix, bar scorecard) — no external
  //  dependencies, so it renders identically anywhere and can be shared by
  //  forwarding the downloaded/saved HTML if needed.
  // ══════════════════════════════════════════════════════════════════════════
  function _svgGauge(pct, size, colorHex, trackHex) {
    var r = size/2 - 14, c = size/2, circ = 2*Math.PI*r;
    var dash = circ * Math.min(100,Math.max(0,pct))/100;
    return '<svg width="'+size+'" height="'+size+'" viewBox="0 0 '+size+' '+size+'">'
      + '<circle cx="'+c+'" cy="'+c+'" r="'+r+'" fill="none" stroke="'+trackHex+'" stroke-width="14"/>'
      + '<circle cx="'+c+'" cy="'+c+'" r="'+r+'" fill="none" stroke="'+colorHex+'" stroke-width="14" '
      + 'stroke-dasharray="'+dash.toFixed(1)+' '+circ.toFixed(1)+'" stroke-linecap="round" '
      + 'transform="rotate(-90 '+c+' '+c+')"/></svg>';
  }
  function _svgDonut(segments, size) {
    var r = size/2 - 18, c = size/2, circ = 2*Math.PI*r, cum = 0;
    var total = segments.reduce(function(a,s){ return a+s.val; }, 0) || 1;
    var arcs = segments.filter(function(s){ return s.val>0; }).map(function(s){
      var dash = circ*s.val/total;
      var offset = -circ*cum/total;
      cum += s.val;
      return '<circle cx="'+c+'" cy="'+c+'" r="'+r+'" fill="none" stroke="'+s.color+'" stroke-width="20" '
        + 'stroke-dasharray="'+dash.toFixed(1)+' '+circ.toFixed(1)+'" stroke-dashoffset="'+offset.toFixed(1)+'" '
        + 'transform="rotate(-90 '+c+' '+c+')"/>';
    }).join('');
    return '<svg width="'+size+'" height="'+size+'" viewBox="0 0 '+size+' '+size+'">'+arcs+'</svg>';
  }
  function _svgLineChart(scorecards, w, h) {
    var pad = 34, pw = w-2*pad, ph = h-2*pad;
    var pts = scorecards.map(function(sc,i){
      var x = pad + (scorecards.length>1 ? pw*i/(scorecards.length-1) : pw/2);
      var y = pad + ph - ph*(sc.score/100);
      return {x:x,y:y,sc:sc};
    });
    var path = pts.map(function(p,i){ return (i===0?'M':'L')+p.x.toFixed(1)+','+p.y.toFixed(1); }).join(' ');
    var grid = [0,25,50,75,100].map(function(g){
      var y = pad+ph-ph*g/100;
      return '<line x1="'+pad+'" y1="'+y+'" x2="'+(pad+pw)+'" y2="'+y+'" stroke="#E7EAF0" stroke-width="1"/>'
        + '<text x="'+(pad-8)+'" y="'+(y+3)+'" font-size="9" fill="#94A3B8" text-anchor="end">'+g+'%</text>';
    }).join('');
    var dots = pts.map(function(p){
      return '<circle cx="'+p.x.toFixed(1)+'" cy="'+p.y.toFixed(1)+'" r="5" fill="#1B2A4A"/>'
        + '<circle cx="'+p.x.toFixed(1)+'" cy="'+p.y.toFixed(1)+'" r="3" fill="#E8A838"/>'
        + '<text x="'+p.x.toFixed(1)+'" y="'+(p.y-12)+'" font-size="11" font-weight="700" fill="#1B2A4A" text-anchor="middle">'+p.sc.score+'%</text>'
        + '<text x="'+p.x.toFixed(1)+'" y="'+(pad+ph+18)+'" font-size="10" fill="#64748B" text-anchor="middle">'+p.sc.label+'</text>';
    }).join('');
    return '<svg width="'+w+'" height="'+h+'" viewBox="0 0 '+w+' '+h+'">'+grid
      + '<path d="'+path+'" fill="none" stroke="#E8A838" stroke-width="3"/>'+dots+'</svg>';
  }
  function openKPILivePresentation() {
    var qd = window.KPI_Q_DATA;
    if (!qd || !qd.activeQs || !qd.activeQs.length) { alert('Quarterly data not yet loaded. Wait a moment and try again.'); return; }
    var narrative = _buildQuarterlyNarrative(qd);
    var activeQs = qd.activeQs, latestQ = activeQs[activeQs.length-1], latestSC = qd.scorecards[qd.scorecards.length-1];
    var tsStr = new Date(qd.lastUpdated).toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric',hour:'numeric',minute:'2-digit'});
    var esc = function(s){ var d=document.createElement('div'); d.textContent=String(s==null?'':s); return d.innerHTML; };

    var slides = [];

    // Slide 1: Cover
    slides.push('<section class="slide cover">'
      + '<div class="ring-bg"></div>'
      + '<div class="brand">🎓 NEW JERSEY TUTORING CORPS</div>'
      + '<h1>Quarterly Goal Summary</h1>'
      + '<div class="sub">Q'+latestQ+' &mdash; School Year 2025&ndash;2026 &middot; Live Presentation</div>'
      + '<div class="meta">Live as of '+esc(tsStr)+' &middot; Confidential &mdash; Internal Use Only</div>'
      + '<div class="gauge-wrap">'+_svgGauge(latestSC.score, 220, '#E8A838', '#2A3B63')
      + '<div class="gauge-label"><div class="gauge-pct">'+latestSC.score+'%</div><div class="gauge-health">'+esc(latestSC.health.label.toUpperCase())+'</div></div></div>'
      + '<div class="cover-tiles">'
      + '<div class="tile"><div class="tv">'+latestSC.counts.met+'</div><div class="tl">TARGETS MET</div></div>'
      + '<div class="tile"><div class="tv">'+latestSC.counts.prog+'</div><div class="tl">IN PROGRESS</div></div>'
      + '<div class="tile"><div class="tv">'+latestSC.counts.total+'</div><div class="tl">TOTAL TRACKED</div></div>'
      + '</div></section>');

    // Slide 2: Where We Stand
    var mixSegs = [
      {label:'Met', val:latestSC.counts.met, color:'#16A34A'},
      {label:'Progress', val:latestSC.counts.prog, color:'#2563EB'},
      {label:'Partial', val:latestSC.counts.partial, color:'#D97706'},
      {label:'Not Met', val:latestSC.counts.notmet, color:'#DC2626'},
    ];
    if (latestSC.counts.pipe) mixSegs.push({label:'Pipeline', val:latestSC.counts.pipe, color:'#7C3AED'});
    slides.push('<section class="slide light">'
      + '<div class="head"><div class="hicon navy">📈</div><div><h2>Where We Stand</h2><div class="hsub">Executive Summary &middot; Q'+latestQ+' SY 2025&ndash;2026</div></div></div>'
      + '<div class="row">'
      + '<div class="headline-card">'+esc(narrative.headline)+'</div>'
      + '<div class="stat-grid">'
        + '<div class="stat green"><div class="sv">'+latestSC.counts.met+'</div><div class="sl">Met</div></div>'
        + '<div class="stat blue"><div class="sv">'+latestSC.counts.prog+'</div><div class="sl">Progress</div></div>'
        + '<div class="stat amber"><div class="sv">'+latestSC.counts.partial+'</div><div class="sl">Partial</div></div>'
        + '<div class="stat red"><div class="sv">'+latestSC.counts.notmet+'</div><div class="sl">Not Met</div></div>'
      + '</div></div>'
      + '<div class="row charts">'
      + (qd.scorecards.length>=2 ? '<div class="chart-block"><h3>Health Score Trend</h3>'+_svgLineChart(qd.scorecards,340,220)+'</div>' : '<div></div>')
      + '<div class="chart-block"><h3>Q'+latestQ+' Status Mix</h3><div class="donut-wrap">'+_svgDonut(mixSegs,180)
        + '<div class="donut-center"><div class="dv">'+latestSC.counts.total+'</div><div class="dl">TARGETS</div></div></div>'
        + '<div class="legend">'+mixSegs.map(function(s){ return '<span><i style="background:'+s.color+'"></i>'+esc(s.label)+' ('+s.val+')</span>'; }).join('')+'</div>'
        + '</div></div></section>');

    // Slide 2B: Year-over-Year Snapshot (only once EOY data exists)
    var yoy = (typeof _buildYoYSnapshot === 'function') ? _buildYoYSnapshot() : null;
    if (yoy) {
      var yoyCol = function(d, cls){
        return '<div class="yoy-card '+cls+'">'
          + '<div class="yoy-year">'+esc(d.label)+'</div>'
          + '<div class="yoy-gauge-wrap">'+_svgGauge(d.score, 150, cls==='cy' ? '#E8A838' : '#94A3B8', '#E2E8F0')
          + '<div class="yoy-gauge-label"><div class="yv">'+d.score.toFixed(1)+'%</div><div class="yl" style="color:'+d.risk.color+'">'+esc(d.risk.label.toUpperCase())+'</div></div></div>'
          + '<div class="yoy-sub">'+esc(friendlyGoalLine({score:d.score, counts:d.counts}))+' &mdash; '+d.total+' targets tracked</div>'
          + '</div>';
      };
      slides.push('<section class="slide light">'
        + '<div class="head"><div class="hicon gold">📅</div><div><h2>Year-over-Year Snapshot</h2><div class="hsub">SY 2024&ndash;2025 vs. SY 2025&ndash;2026 &middot; End-of-Year Comparison</div></div></div>'
        + '<div class="yoy-row">'+yoyCol(yoy.priorYear,'py')+yoyCol(yoy.currentYear,'cy')+'</div>'
        + '<div class="yoy-delta '+(yoy.improved?'up':'down')+'"><span class="yoy-delta-val">'+(yoy.improved?'▲ ':'▼ ')+esc(yoy.deltaLabel)+'</span><span class="yoy-delta-label">year-over-year weighted score'+(yoy.bucketChanged?' &middot; '+esc(yoy.priorYear.risk.label)+' → '+esc(yoy.currentYear.risk.label):'')+'</span></div>'
        + '<div class="yoy-note">'+esc(yoy.note)+'</div>'
        + '</section>');
    }

    // Slide 3: What's Working
    if (narrative.positives.length) {
      var top4 = narrative.positives.slice(0,4), rest = narrative.positives.slice(4,10);
      slides.push('<section class="slide light">'
        + '<div class="head"><div class="hicon green">🏆</div><div><h2>What\u2019s Working</h2><div class="hsub">'+narrative.positives.length+' target'+(narrative.positives.length===1?'':'s')+' moved to a stronger status this cycle</div></div></div>'
        + '<div class="card-grid">'+top4.map(function(p){ return '<div class="feature-card green"><span class="fc-icon">✓</span><span>'+esc(p.text)+'</span></div>'; }).join('')+'</div>'
        + (rest.length ? '<h3 class="sub-h">Additional improvements this cycle</h3><ul class="compact-list">'+rest.map(function(p){
            var d = qd.deltas.find(function(x){return x.target===p.target;});
            var lm = d.moves[d.moves.length-1];
            return '<li><i class="dot green"></i>'+esc(p.target)+' &mdash; '+esc(_qShortStatus(lm.from))+' \u2192 '+esc(_qShortStatus(lm.to))+'</li>';
          }).join('')+'</ul>' : '')
        + (narrative.positives.length>10 ? '<div class="more-note">+ '+(narrative.positives.length-10)+' more &mdash; see the full breakdown in the appendix.</div>' : '')
        + '</section>');
    }

    // Slide 4: What Needs Attention
    if (narrative.concerns.length) {
      slides.push('<section class="slide light">'
        + '<div class="head"><div class="hicon red">⚠️</div><div><h2>What Needs Attention</h2><div class="hsub">Regressions and risk requiring leadership follow-up &middot; see Recommended Next Steps for the owner-assigned action on each item</div></div></div>'
        + '<div class="concern-list">'+narrative.concerns.map(function(c){
            var critical = c.severity==='critical';
            return '<div class="concern-row '+(critical?'crit':'watch')+'"><span class="badge">'+(critical?'CRITICAL':'WATCH')+'</span><span>'+esc(c.text)+'</span></div>';
          }).join('')+'</div></section>');
    }

    // Slide 5: Where to Focus
    if (narrative.focus.length) {
      slides.push('<section class="slide light">'
        + '<div class="head"><div class="hicon amber">🎯</div><div><h2>Where to Focus</h2><div class="hsub">Targets with no status movement across every tracked quarter</div></div></div>'
        + '<div class="concern-list">'+narrative.focus.map(function(f){ return '<div class="concern-row watch"><span>'+esc(f.text)+'</span></div>'; }).join('')+'</div></section>');
    }

    // Slide 6: Recommended Next Steps — owner-assigned action plan, then priorities
    slides.push('<section class="slide cover dark-alt">'
      + '<div class="head light-head"><div class="hicon gold">🚩</div><div><h2 class="white">Recommended Next Steps</h2><div class="hsub light">'+(narrative.actionPlan.length ? 'Owner-assigned action plan, plus priorities heading into '+esc(narrative.nextQLabel) : 'Priorities heading into '+esc(narrative.nextQLabel))+'</div></div></div>'
      + (narrative.actionPlan.length ? '<div class="action-plan">'+narrative.actionPlan.map(function(a){
          var critical = a.severity==='critical';
          return '<div class="action-card '+(critical?'crit':'watch')+'"><span class="ac-badge">'+(critical?'CRITICAL':'WATCH')+'</span>'
            + '<span class="ac-target">'+esc(a.target)+'</span>'
            + '<div class="ac-action">'+esc(a.action)+'</div>'
            + '<div class="ac-meta">Owner: '+esc(a.owner||'Unassigned')+' &middot; Due: '+esc(a.dueLabel)+' review</div></div>';
        }).join('')+'</div><h3 class="sub-h light">Additional Priorities</h3>' : '')
      + '<ol class="steps'+(narrative.actionPlan.length?' compact':'')+'">'+narrative.nextSteps.map(function(s){ return '<li>'+esc(s)+'</li>'; }).join('')+'</ol></section>');

    // Slide 7: Goal Area Scorecard
    var goalOrder=[], goalGroups={};
    qd.rows.forEach(function(r){ var g=(r[0]||'').trim(),t=(r[1]||'').trim(); if(!g||!t) return; if(goalOrder.indexOf(g)<0) goalOrder.push(g); if(!goalGroups[g]) goalGroups[g]=[]; goalGroups[g].push(r); });
    var scCol = _Q_COLS[latestQ-1][1];
    var goalScores = goalOrder.map(function(goal){
      var rs = goalGroups[goal], sum=0;
      rs.forEach(function(r){ var s=(r[scCol]||'').trim(); if(s==='Met')sum+=1; else if(s==='Partially Met')sum+=0.5; else if(s==='In Progress')sum+=0.25; else if(s==='Coming Down the Pipeline')sum+=0.1; });
      return { goal:goal, pct: rs.length?Math.round(sum/rs.length*100):0 };
    });
    slides.push('<section class="slide light">'
      + '<div class="head"><div class="hicon navy">📋</div><div><h2>Goal Area Scorecard</h2><div class="hsub">Weighted health score by goal area &middot; Q'+latestQ+'</div></div></div>'
      + '<div class="bar-chart">'+goalScores.map(function(g){
          var col = g.pct>=85?'#16A34A':g.pct>=65?'#D97706':g.pct>=40?'#DC6502':'#DC2626';
          return '<div class="bar-row"><div class="bar-label">'+esc(g.goal)+'</div><div class="bar-track"><div class="bar-fill" style="width:'+g.pct+'%;background:'+col+'"></div></div><div class="bar-val">'+g.pct+'%</div></div>';
        }).join('')+'</div></section>');

    // Slide 8: Appendix
    var apRows = [];
    goalOrder.forEach(function(goal){
      apRows.push('<tr class="grp"><td colspan="'+(activeQs.length+3)+'">'+esc(goal)+'</td></tr>');
      goalGroups[goal].forEach(function(r){
        var cells = activeQs.map(function(q){ var s=(r[_Q_COLS[q-1][1]]||'').trim(); return '<td class="st-'+(s?s.replace(/\s+/g,''):'none')+'">'+esc(_qShortStatus(s)||'\u2014')+'</td>'; }).join('');
        var cap = _metricCaption(r[_Q_COLS[latestQ-1][0]]||'');
        apRows.push('<tr><td class="tgt">'+esc(r[1]||'')+'</td>'+cells+'<td class="cap">'+esc(cap||'\u2014')+'</td></tr>');
      });
    });
    slides.push('<section class="slide light appendix">'
      + '<div class="head"><div class="hicon navy">📎</div><div><h2>Appendix</h2><div class="hsub">Full cross-quarter target status &amp; live captured metrics</div></div></div>'
      + '<div class="table-wrap"><table><thead><tr><th>Target</th>'+activeQs.map(function(q){return '<th>Q'+q+'</th>';}).join('')+'<th>Q'+latestQ+' Goal vs. Actual</th></tr></thead><tbody>'+apRows.join('')+'</tbody></table></div></section>');

    var html = '<!DOCTYPE html><html><head><meta charset="utf-8"><title>NJTC Quarterly Goal Summary — Q'+latestQ+'</title>'
      + '<style>'
      + ':root{--navy:#1B2A4A;--gold:#E8A838;--ink:#1E293B;--muted:#64748B;--green:#16A34A;--red:#DC2626;--amber:#D97706;}'
      + '*{box-sizing:border-box;margin:0;padding:0;}'
      + 'body{font-family:Calibri,Arial,sans-serif;background:#0a1220;overflow:hidden;}'
      + '.deck{width:100vw;height:100vh;position:relative;}'
      + '.slide{position:absolute;inset:0;display:none;padding:56px 64px;background:#fff;flex-direction:column;overflow-y:auto;}'
      + '.slide.active{display:flex;}'
      + '.slide.cover{background:linear-gradient(135deg,#0f1c38,#1B2A4A);color:#fff;justify-content:center;}'
      + '.slide.dark-alt{justify-content:flex-start;}'
      + '.ring-bg{position:absolute;top:-160px;right:-120px;width:480px;height:480px;border-radius:50%;background:#13203A;}'
      + '.brand{font-weight:700;letter-spacing:2px;color:var(--gold);font-size:14px;margin-bottom:28px;}'
      + '.slide.cover h1{font-family:Cambria,Georgia,serif;font-size:52px;font-weight:700;margin-bottom:14px;}'
      + '.slide.cover .sub{font-size:20px;color:var(--gold);margin-bottom:10px;}'
      + '.slide.cover .meta{font-size:13px;color:#A9B4C9;margin-bottom:40px;}'
      + '.gauge-wrap{position:relative;width:220px;height:220px;position:absolute;top:60px;right:80px;}'
      + '.gauge-label{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;}'
      + '.gauge-pct{font-family:Cambria,Georgia,serif;font-size:38px;font-weight:700;}'
      + '.gauge-health{font-size:12px;font-weight:700;color:var(--gold);letter-spacing:1.5px;margin-top:4px;}'
      + '.cover-tiles{display:flex;gap:56px;margin-top:16px;}'
      + '.tile .tv{font-family:Cambria,Georgia,serif;font-size:32px;font-weight:700;}'
      + '.tile .tl{font-size:11px;color:#A9B4C9;letter-spacing:1px;margin-top:2px;}'
      + '.head{display:flex;align-items:center;gap:18px;margin-bottom:28px;}'
      + '.hicon{width:52px;height:52px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:22px;flex-shrink:0;}'
      + '.hicon.navy{background:var(--navy);} .hicon.green{background:var(--green);} .hicon.red{background:var(--red);} .hicon.amber{background:var(--amber);} .hicon.gold{background:var(--gold);}'
      + 'h2{font-family:Cambria,Georgia,serif;font-size:28px;color:var(--navy);}'
      + 'h2.white{color:#fff;}'
      + '.hsub{font-size:13px;color:var(--muted);margin-top:2px;}'
      + '.hsub.light{color:#A9B4C9;}'
      + '.row{display:flex;gap:24px;margin-bottom:20px;}'
      + '.headline-card{flex:1.4;background:#EEF2F9;border-radius:12px;padding:20px 24px;font-size:15px;line-height:1.55;color:var(--ink);}'
      + '.stat-grid{flex:1;display:grid;grid-template-columns:1fr 1fr;gap:12px;}'
      + '.stat{border-radius:10px;padding:14px 16px;}'
      + '.stat .sv{font-family:Cambria,Georgia,serif;font-size:28px;font-weight:700;}'
      + '.stat .sl{font-size:11px;font-weight:700;color:var(--ink);margin-top:2px;}'
      + '.stat.green{background:#EAF7EE;} .stat.green .sv{color:var(--green);}'
      + '.stat.blue{background:#EAF1FE;} .stat.blue .sv{color:#2563EB;}'
      + '.stat.amber{background:#FDF3E3;} .stat.amber .sv{color:var(--amber);}'
      + '.stat.red{background:#FCEAEA;} .stat.red .sv{color:var(--red);}'
      + '.charts{align-items:flex-start;}'
      + '.chart-block{flex:1;}'
      + '.chart-block h3{font-size:14px;color:var(--navy);margin-bottom:10px;}'
      + '.donut-wrap{position:relative;width:180px;height:180px;}'
      + '.donut-center{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;}'
      + '.dv{font-family:Cambria,Georgia,serif;font-size:22px;font-weight:700;color:var(--navy);}'
      + '.dl{font-size:9px;color:var(--muted);letter-spacing:1px;}'
      + '.legend{display:flex;flex-wrap:wrap;gap:10px 16px;margin-top:14px;font-size:11px;color:var(--ink);}'
      + '.legend i{display:inline-block;width:9px;height:9px;border-radius:50%;margin-right:5px;}'
      + '.card-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:22px;}'
      + '.feature-card{background:#EAF7EE;border-radius:10px;padding:16px;display:flex;gap:12px;align-items:flex-start;font-size:13px;line-height:1.4;color:var(--ink);}'
      + '.fc-icon{background:var(--green);color:#fff;width:26px;height:26px;border-radius:50%;display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:14px;}'
      + '.sub-h{font-size:14px;color:var(--navy);margin-bottom:10px;font-weight:700;}'
      + '.compact-list{list-style:none;font-size:12.5px;color:var(--ink);line-height:2;}'
      + '.dot{display:inline-block;width:7px;height:7px;border-radius:50%;margin-right:8px;}'
      + '.dot.green{background:var(--green);}'
      + '.more-note{font-size:11px;color:var(--muted);font-style:italic;margin-top:14px;}'
      + '.concern-list{display:flex;flex-direction:column;gap:12px;}'
      + '.concern-row{border-radius:10px;padding:14px 18px;display:flex;align-items:center;gap:16px;font-size:13px;line-height:1.4;color:var(--ink);}'
      + '.concern-row.crit{background:#FCEAEA;} .concern-row.watch{background:#FDF3E3;}'
      + '.badge{font-size:9px;font-weight:700;letter-spacing:1px;flex-shrink:0;width:56px;}'
      + '.concern-row.crit .badge{color:var(--red);} .concern-row.watch .badge{color:var(--amber);}'
      + '.steps{list-style:none;counter-reset:step;margin-top:20px;}'
      + '.steps li{counter-increment:step;position:relative;padding:14px 0 14px 46px;font-size:15px;color:#fff;line-height:1.4;}'
      + '.steps.compact{margin-top:10px;}'
      + '.steps.compact li{padding:8px 0 8px 40px;font-size:12.5px;}'
      + '.steps.compact li::before{width:24px;height:24px;font-size:12px;top:8px;}'
      + '.sub-h.light{color:var(--gold);margin-top:18px;}'
      + '.action-plan{display:flex;flex-direction:column;gap:10px;margin-top:14px;}'
      + '.action-card{background:rgba(255,255,255,.06);border-radius:10px;padding:12px 16px 10px 18px;position:relative;border-left:4px solid var(--gold);}'
      + '.action-card.crit{border-left-color:#EF6D6D;}'
      + '.action-card .ac-badge{display:block;font-size:9px;font-weight:700;letter-spacing:1px;color:var(--gold);margin-bottom:2px;}'
      + '.action-card.crit .ac-badge{color:#EF6D6D;}'
      + '.action-card .ac-target{font-size:13.5px;font-weight:700;color:#fff;}'
      + '.action-card .ac-action{font-size:11.5px;color:#C9D2E4;line-height:1.4;margin-top:4px;}'
      + '.action-card .ac-meta{font-size:10px;color:var(--gold);margin-top:6px;}'
      + '.action-card.crit .ac-meta{color:#EF6D6D;}'
      + '.steps li::before{content:counter(step);position:absolute;left:0;top:12px;width:30px;height:30px;background:var(--gold);color:var(--navy);border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:700;font-family:Cambria,Georgia,serif;}'
      + '.light-head{color:#fff;}'
      + '.bar-chart{display:flex;flex-direction:column;gap:14px;margin-top:8px;}'
      + '.bar-row{display:flex;align-items:center;gap:14px;}'
      + '.bar-label{width:260px;font-size:12px;color:var(--ink);flex-shrink:0;}'
      + '.bar-track{flex:1;height:18px;background:#F0F2F6;border-radius:4px;overflow:hidden;}'
      + '.bar-fill{height:100%;border-radius:4px;}'
      + '.bar-val{width:44px;font-size:12px;font-weight:700;color:var(--ink);text-align:right;}'
      + '.yoy-row{display:flex;gap:24px;margin-bottom:20px;}'
      + '.yoy-card{flex:1;border-radius:12px;padding:22px 20px;text-align:center;}'
      + '.yoy-card.py{background:#EEF2F9;}'
      + '.yoy-card.cy{background:#FDF7E8;}'
      + '.yoy-year{font-family:Cambria,Georgia,serif;font-size:17px;font-weight:700;color:var(--navy);margin-bottom:10px;}'
      + '.yoy-gauge-wrap{position:relative;width:150px;height:150px;margin:0 auto;}'
      + '.yoy-gauge-label{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;}'
      + '.yv{font-family:Cambria,Georgia,serif;font-size:24px;font-weight:700;color:var(--navy);}'
      + '.yl{font-size:10px;font-weight:700;letter-spacing:1px;margin-top:3px;}'
      + '.yoy-sub{font-size:11.5px;color:var(--muted);margin-top:14px;line-height:1.4;}'
      + '.yoy-delta{border-radius:10px;padding:14px 20px;display:flex;align-items:center;gap:18px;margin-bottom:16px;}'
      + '.yoy-delta.up{background:#EAF7EE;} .yoy-delta.down{background:#FCEAEA;}'
      + '.yoy-delta-val{font-family:Cambria,Georgia,serif;font-size:22px;font-weight:700;}'
      + '.yoy-delta.up .yoy-delta-val{color:var(--green);} .yoy-delta.down .yoy-delta-val{color:var(--red);}'
      + '.yoy-delta-label{font-size:13px;color:var(--ink);}'
      + '.yoy-note{font-size:11px;font-style:italic;color:var(--muted);line-height:1.5;}'
      + '.appendix h2{font-size:24px;}'
      + '.table-wrap{overflow:auto;flex:1;border:1px solid #E5E9F0;border-radius:8px;}'
      + 'table{width:100%;border-collapse:collapse;font-size:11px;}'
      + 'thead th{background:var(--navy);color:#fff;text-align:left;padding:8px 10px;position:sticky;top:0;}'
      + 'tbody td{padding:6px 10px;border-bottom:1px solid #EEF1F5;color:var(--ink);}'
      + 'tr.grp td{background:var(--navy);color:#fff;font-weight:700;}'
      + 'td.cap{font-weight:700;color:var(--navy);}'
      + '.st-Met{color:var(--green);font-weight:700;} .st-PartiallyMet{color:var(--amber);font-weight:700;} .st-InProgress{color:#2563EB;font-weight:700;} .st-HasNotMet{color:var(--red);font-weight:700;} .st-ComingDowntheDPipeline,.st-ComingDowntheP{color:#7C3AED;font-weight:700;}'
      + '.navbar{position:fixed;bottom:0;left:0;right:0;height:52px;background:rgba(10,18,32,.92);display:flex;align-items:center;justify-content:center;gap:18px;z-index:10;}'
      + '.navbar button{background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.25);color:#fff;padding:8px 16px;border-radius:6px;cursor:pointer;font-size:13px;font-weight:700;}'
      + '.navbar button:hover{background:rgba(255,255,255,.22);}'
      + '.navbar .count{color:#A9B4C9;font-size:12px;min-width:60px;text-align:center;}'
      + '.footer-note{position:absolute;bottom:20px;left:64px;font-size:10px;color:var(--muted);}'
      + '</style></head><body>'
      + '<div class="deck">' + slides.map(function(s,i){ return s.replace('<section class="slide', '<section id="s'+i+'" class="slide'+(i===0?' active':'')); }).join('') + '</div>'
      + '<div class="navbar"><button onclick="nav(-1)">\u2190 Prev</button><span class="count" id="cnt"></span><button onclick="nav(1)">Next \u2192</button><button onclick="document.documentElement.requestFullscreen&&document.documentElement.requestFullscreen()">⛶ Fullscreen</button></div>'
      + '<script>'
      + 'var cur=0; var total='+slides.length+';'
      + 'function show(i){ cur=Math.max(0,Math.min(total-1,i)); for(var j=0;j<total;j++){ var el=document.getElementById("s"+j); if(el) el.classList.toggle("active", j===cur); } document.getElementById("cnt").textContent=(cur+1)+" / "+total; }'
      + 'function nav(d){ show(cur+d); }'
      + 'document.addEventListener("keydown", function(e){ if(e.key==="ArrowRight"||e.key===" ") nav(1); if(e.key==="ArrowLeft") nav(-1); });'
      + 'show(0);'
      + '</script></body></html>';

    var blob = new Blob([html], {type:'text/html'});
    var url = URL.createObjectURL(blob);
    window.open(url, '_blank');
    setTimeout(function(){ URL.revokeObjectURL(url); }, 30000);
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  WORD DOCUMENT EXPORT — a board-ready memo Katherine can open in Word,
  //  edit freely (wording, add commentary), and send directly — no slides
  //  required for the same information. Built as Word-compatible HTML
  //  (the standard technique Word/Office natively opens and edits as a full
  //  document), so no external library or CDN load is needed. Reuses the
  //  exact same narrative/action-plan data as the PDF, PPTX, and Live
  //  Presentation so all four exports always agree.
  // ══════════════════════════════════════════════════════════════════════════
  function exportKPIQuarterlySummaryDOCX() {
    var qd = window.KPI_Q_DATA;
    if (!qd || !qd.activeQs || !qd.activeQs.length) { alert('Quarterly data not yet loaded. Wait a moment and try again.'); return; }

    function _esc(s){ var d=document.createElement('div'); d.textContent=String(s==null?'':s); return d.innerHTML; }

    var activeQs  = qd.activeQs, latestQ = activeQs[activeQs.length-1], latestSC = qd.scorecards[qd.scorecards.length-1];
    var tsStr     = new Date(qd.lastUpdated).toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'});
    var narrative = _buildQuarterlyNarrative(qd);
    var yoy       = (typeof _buildYoYSnapshot === 'function') ? _buildYoYSnapshot() : null;

    var goalOrder=[], goalGroups={};
    qd.rows.forEach(function(r){ var g=(r[0]||'').trim(),t=(r[1]||'').trim(); if(!g||!t) return; if(goalOrder.indexOf(g)<0) goalOrder.push(g); if(!goalGroups[g]) goalGroups[g]=[]; goalGroups[g].push(r); });
    var scCol = _Q_COLS[latestQ-1][1];
    var goalScores = goalOrder.map(function(goal){
      var rs = goalGroups[goal], sum=0;
      rs.forEach(function(r){ var s=(r[scCol]||'').trim(); if(s==='Met')sum+=1; else if(s==='Partially Met')sum+=0.5; else if(s==='In Progress')sum+=0.25; else if(s==='Coming Down the Pipeline')sum+=0.1; });
      return { goal:goal, pct: rs.length?Math.round(sum/rs.length*100):0 };
    });

    var body = '';
    body += '<h1>New Jersey Tutoring Corps</h1>';
    body += '<p class="deck">Quarterly Goal Summary &mdash; Q'+latestQ+', School Year 2025&ndash;2026</p>';
    body += '<p class="meta">Prepared by the Data &amp; Evaluation Department &middot; Generated '+_esc(tsStr)+' &middot; Confidential &mdash; Internal Use Only</p>';

    body += '<h2>Where We Stand</h2>';
    body += '<p>'+_esc(narrative.headline)+'</p>';
    body += '<table class="stat-table"><tr><th>Met</th><th>In Progress</th><th>Partially Met</th><th>Not Met</th><th>Weighted Score</th></tr>'
      + '<tr><td>'+latestSC.counts.met+'</td><td>'+latestSC.counts.prog+'</td><td>'+latestSC.counts.partial+'</td><td>'+latestSC.counts.notmet+'</td><td><b>'+latestSC.score+'% ('+_esc(latestSC.health.label)+')</b></td></tr></table>';

    if (yoy) {
      body += '<h2>Year-over-Year Snapshot</h2>';
      body += '<p>SY 2024&ndash;2025 vs. SY 2025&ndash;2026, both scored with this year’s weighted methodology for an apples-to-apples comparison.</p>';
      body += '<table><tr><th>School Year</th><th>Weighted Score</th><th>Health</th><th>Targets Tracked</th></tr>'
        + '<tr><td>'+_esc(yoy.priorYear.label)+'</td><td>'+yoy.priorYear.score.toFixed(1)+'%</td><td>'+_esc(yoy.priorYear.risk.label)+'</td><td>'+yoy.priorYear.total+'</td></tr>'
        + '<tr><td>'+_esc(yoy.currentYear.label)+'</td><td>'+yoy.currentYear.score.toFixed(1)+'%</td><td>'+_esc(yoy.currentYear.risk.label)+'</td><td>'+yoy.currentYear.total+'</td></tr></table>';
      body += '<p class="note">'+(yoy.improved?'▲ ':'▼ ')+_esc(yoy.deltaLabel)+' year-over-year'+(yoy.bucketChanged?' &middot; '+_esc(yoy.priorYear.risk.label)+' &rarr; '+_esc(yoy.currentYear.risk.label):'')+'. '+_esc(yoy.note)+'</p>';
    }

    if (narrative.positives.length) {
      body += '<h2>What&rsquo;s Working</h2><p>'+narrative.positives.length+' target'+(narrative.positives.length===1?'':'s')+' moved to a stronger status this cycle.</p><ul>';
      narrative.positives.forEach(function(p){ body += '<li>'+_esc(p.text)+'</li>'; });
      body += '</ul>';
    }

    body += '<h2>What Needs Attention &mdash; Action Plan</h2>';
    if (narrative.actionPlan.length) {
      body += '<p>Each target below is paired with a named owner and a due date so this can move straight into follow-up &mdash; no separate slide needed.</p>';
      body += '<table><tr><th>Target</th><th>Goal Area</th><th>Status</th><th>Owner</th><th>Recommended Action</th><th>Due</th></tr>';
      narrative.actionPlan.forEach(function(a){
        body += '<tr><td>'+_esc(a.target)+'</td><td>'+_esc(a.goalArea)+'</td>'
          + '<td class="'+(a.severity==='critical'?'sev-crit':'sev-watch')+'">'+(a.severity==='critical'?'Critical':'Watch')+'</td>'
          + '<td>'+_esc(a.owner||'Unassigned')+'</td><td>'+_esc(a.action)+'</td><td>'+_esc(a.dueLabel)+' review</td></tr>';
      });
      body += '</table>';
    } else {
      body += '<p>No targets are currently Critical or Watch &mdash; nothing requires an escalation this cycle.</p>';
    }

    if (narrative.focus.length) {
      body += '<h2>Where to Focus</h2><p>Targets with no status movement across every tracked quarter:</p><ul>';
      narrative.focus.forEach(function(f){ body += '<li>'+_esc(f.text)+'</li>'; });
      body += '</ul>';
    }

    body += '<h2>Additional Priorities</h2><ol>';
    narrative.nextSteps.forEach(function(s){ body += '<li>'+_esc(s)+'</li>'; });
    body += '</ol>';

    body += '<h2>Goal Area Scorecard</h2><table><tr><th>Goal Area</th><th>Score</th><th>Status</th></tr>';
    goalScores.forEach(function(g){
      var status = g.pct>=85?'Healthy':g.pct>=65?'Watch':g.pct>=40?'Needs Focus':'Area of Support';
      body += '<tr><td>'+_esc(g.goal)+'</td><td>'+g.pct+'%</td><td>'+status+'</td></tr>';
    });
    body += '</table>';

    body += '<p class="footer">New Jersey Tutoring Corps &middot; Quarterly Summary &middot; SY 2025&ndash;2026 &middot; Confidential</p>';

    var html = '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">'
      + '<head><meta charset="utf-8"><title>NJTC Quarterly Summary Q'+latestQ+'</title>'
      + '<!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View><w:Zoom>100</w:Zoom><w:DoNotOptimizeForBrowser/></w:WordDocument></xml><![endif]-->'
      + '<style>'
      + '@page{margin:1in;}'
      + 'body{font-family:Calibri,Arial,sans-serif;font-size:11pt;color:#1E293B;line-height:1.4;}'
      + 'h1{font-family:Cambria,Georgia,serif;font-size:22pt;color:#1B2A4A;margin-bottom:2pt;}'
      + 'p.deck{font-size:13pt;color:#E8A838;font-weight:bold;margin-top:0;margin-bottom:2pt;}'
      + 'p.meta{font-size:9pt;color:#64748B;margin-top:0;margin-bottom:18pt;}'
      + 'h2{font-family:Cambria,Georgia,serif;font-size:15pt;color:#1B2A4A;border-bottom:1pt solid #1B2A4A;padding-bottom:2pt;margin-top:22pt;}'
      + 'table{border-collapse:collapse;width:100%;margin:8pt 0 12pt 0;}'
      + 'th{background:#1B2A4A;color:#ffffff;font-size:9.5pt;text-align:left;padding:5pt 8pt;}'
      + 'td{border:1pt solid #D8DEE9;font-size:9.5pt;padding:5pt 8pt;vertical-align:top;}'
      + '.stat-table td{text-align:center;}'
      + '.sev-crit{color:#DC2626;font-weight:bold;}'
      + '.sev-watch{color:#D97706;font-weight:bold;}'
      + 'ul,ol{margin:6pt 0;padding-left:22pt;}'
      + 'li{font-size:10.5pt;margin-bottom:4pt;}'
      + 'p.note{font-size:9pt;font-style:italic;color:#64748B;}'
      + 'p.footer{font-size:8pt;color:#94A3B8;border-top:1pt solid #D8DEE9;padding-top:6pt;margin-top:24pt;}'
      + '</style></head><body>' + body + '</body></html>';

    var blob = new Blob(['﻿' + html], {type:'application/msword'});
    var url  = URL.createObjectURL(blob);
    var a    = document.createElement('a');
    a.href = url; a.download = 'NJTC_Quarterly_Summary_Q'+latestQ+'_SY2526.doc';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(function(){ URL.revokeObjectURL(url); }, 2000);
  }

  window.exportKPIQuarterlySummaryDOCX = exportKPIQuarterlySummaryDOCX;
  window.exportKPIQuarterlySummaryPDF  = exportKPIQuarterlySummaryPDF;
  window.exportKPIQuarterlySummaryPPTX = exportKPIQuarterlySummaryPPTX;
  window.openKPILivePresentation       = openKPILivePresentation;
  window.openKPILiveWorkbook           = openKPILiveWorkbook;
  window.KPI_Q_DATA                    = KPI_Q_DATA;

  // ════════════════════════════════════════════════════════════════
  //  TALENT PROFILE PDF EXPORT  (Data dept only)
  //  Opens a print-ready HTML window; user uses browser Print → Save as PDF.
  // ════════════════════════════════════════════════════════════════

  function _profilePrintCSS() {
    return `
      *{box-sizing:border-box;margin:0;padding:0}
      body{font-family:'Segoe UI',Arial,sans-serif;font-size:11pt;color:#1a1a2e;background:#fff;padding:0}
      @page{size:letter portrait;margin:.75in .65in .75in .65in}
      @media print{.no-print{display:none!important}body{padding:0}}
      .pg-header{background:#0a1628;color:#fff;padding:14pt 18pt;margin-bottom:14pt;border-radius:0}
      .pg-header h1{font-size:15pt;font-weight:800;margin-bottom:2pt}
      .pg-header .sub{font-size:8pt;color:rgba(255,255,255,.55);letter-spacing:.05em;text-transform:uppercase}
      .pg-header .meta{font-size:8.5pt;color:rgba(255,255,255,.75);margin-top:6pt}
      .section{border:1pt solid #e2e8f0;border-radius:5pt;margin-bottom:10pt;overflow:hidden}
      .section-head{background:#f8fafc;padding:6pt 10pt;font-size:8pt;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:#64748b;border-bottom:1pt solid #e2e8f0}
      .section-body{padding:8pt 10pt}
      .kpi-row{display:flex;gap:8pt;flex-wrap:wrap;margin-bottom:8pt}
      .kpi{flex:1;min-width:70pt;text-align:center;padding:7pt 5pt;border:1pt solid #e2e8f0;border-radius:4pt;background:#f8fafc}
      .kpi-val{font-size:15pt;font-weight:800;line-height:1.1}
      .kpi-lbl{font-size:7pt;color:#64748b;margin-top:2pt;text-transform:uppercase;letter-spacing:.04em}
      .two-col{display:grid;grid-template-columns:1fr 1fr;gap:10pt}
      .label{font-size:7pt;font-weight:700;text-transform:uppercase;color:#94a3b8;margin-bottom:2pt}
      .value{font-size:9.5pt;font-weight:600;color:#1a1a2e}
      .subval{font-size:8pt;color:#64748b;margin-top:1pt}
      .tier-badge{display:inline-block;padding:2pt 7pt;border-radius:10pt;font-size:8.5pt;font-weight:700}
      .metric-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:5pt;margin-bottom:6pt}
      .metric-cell{text-align:center;padding:5pt 3pt;border-radius:4pt;border:1pt solid #e2e8f0}
      .metric-val{font-size:13pt;font-weight:800}
      .metric-lbl{font-size:6.5pt;color:#64748b;margin-top:1pt}
      .signal{display:flex;align-items:flex-start;gap:5pt;padding:4pt 7pt;border-radius:3pt;margin-bottom:3pt;font-size:8pt}
      .summary-box{background:#f0f9ff;border:1pt solid #bae6fd;border-radius:5pt;padding:9pt 11pt;font-size:9pt;line-height:1.6;color:#0c4a6e}
      .live-dot{color:#0ea5e9;font-weight:700;font-size:7pt}
      .concern-box{background:#fff7ed;border:1pt solid #fed7aa;border-radius:4pt;padding:6pt 9pt;margin-bottom:4pt}
      .footer{margin-top:12pt;padding-top:6pt;border-top:1pt solid #e2e8f0;font-size:7pt;color:#94a3b8;display:flex;justify-content:space-between}
      table{width:100%;border-collapse:collapse;font-size:8.5pt}
      th{background:#f1f5f9;padding:4pt 6pt;text-align:left;font-size:7.5pt;font-weight:700;color:#64748b;border-bottom:1pt solid #e2e8f0}
      td{padding:4pt 6pt;border-bottom:1pt solid #f1f5f9;color:#1e293b}
      tr:last-child td{border-bottom:none}
    `;
  }

  function _buildProfilePrintHTML(emp) {
    const e = emp;
    const cfg = _tier(e._liveT || e.t);
    const att  = e._liveAtt !== undefined ? e._liveAtt : e.att;
    const liveAtt = e._liveAtt !== undefined;
    const survEnjoy = e._liveSurveyEntry ? e._liveSurveyEntry.enjoyment : null;
    const survDisplay = e.je != null ? e.je : (survEnjoy != null ? survEnjoy.toFixed(1) : null);
    const liveSurv = e.je == null && survEnjoy != null;
    const pearlSchools = e._liveSchools && e._liveSchools.length ? e._liveSchools : null;
    const concerns = e._liveConcerns || 0;
    const hrAction = e._liveHRAction || e.hn || null;
    const acad = e._acadPctMoved;
    const obsTotal = (e._obsCount || 0) + (e._tndObsObserved || 0);
    const today = new Date().toLocaleDateString('en-US',{year:'numeric',month:'long',day:'numeric'});

    // Tier colors for print (use hex directly — no CSS vars)
    const TIER_HEX = {stellar:{bg:'#d1fae5',color:'#065f46'},strong:{bg:'#dbeafe',color:'#1e40af'},developing:{bg:'#fef3c7',color:'#92400e'},needs_support:{bg:'#fee2e2',color:'#b91c1c'},incomplete:{bg:'#f1f5f9',color:'#374151'}};
    const tc = TIER_HEX[e._liveT || e.t] || TIER_HEX.incomplete;

    // Score strip
    const score = (() => {
      let s=0,f=0;
      if(e.mp!=null){s+=e.mp*2.5;f++;}
      if(att!=null){s+=(att>=95?10:att>=90?8:att>=85?6:att>=80?4:att>=75?2:0);f++;}
      if(acad!=null){s+=(acad>=60?10:acad>=45?8:acad>=30?5:acad>=15?2:0);f++;}
      if(concerns>0)s-=concerns*3;
      if(e.c>=3)s+=3; else if(e.c>=2)s+=1;
      const max=f*10+(e.c>=3?3:e.c>=2?1:0);
      return max>0?Math.round(s/max*100):null;
    })();

    // Auto-generated narrative summary
    const summaryParts = [];
    summaryParts.push(`${e.n} is a ${e.r||'Tutor'} with ${e.c||1} cycle${e.c!==1?'s':''} at NJTC (${(e.y||[]).join(', ')||'—'}).`);
    if (att != null) summaryParts.push(`Attendance this SY is ${att}%${att>=90?' — strong punctuality record':att>=80?' — above threshold':' — below target; warrants follow-up'}.`);
    if (survDisplay != null) summaryParts.push(`Scholar satisfaction survey score: ★${survDisplay}${liveSurv?' (live Pearl data)':'(EOY upload)'}.`);
    if (e.mp != null) summaryParts.push(`Performance score: ${e.mp}/4 binary metrics passed from prior SY EOY upload.`);
    if (acad != null) summaryParts.push(`Academic impact: ${acad}% of assigned scholars advanced at least one placement level in i-Ready diagnostics.`);
    if (pearlSchools && pearlSchools.length) summaryParts.push(`Active Pearl locations this SY: ${pearlSchools.join(', ')}.`);
    if (concerns > 0) summaryParts.push(`${concerns} program concern${concerns>1?'s':''} on record${hrAction?' (HR action: '+hrAction+')':''}.`);
    const hiringRecs = _hiringGet(e.n.replace(/\W/g,'_'));
    const latestHiring = hiringRecs.sort((a,b)=>b.ts.localeCompare(a.ts))[0];
    if (latestHiring) summaryParts.push(`Most recent hiring decision: ${latestHiring.d} (${new Date(latestHiring.ts).toLocaleDateString()}).`);
    if (score != null) summaryParts.push(`Overall talent tier: ${cfg.label} (${score}% composite score).`);

    // Metric rows
    const metricRows = [
      ['Att Target', e.am, false],
      ['Scholar Enjoyment', e.em, false],
      ['Scholar Learning', e.lm, false],
      ['Acad Improvement', e._acadImproveYoY ?? e.acm, e._acadImproveYoY != null],
    ];

    // Concerns list (from CONCERNS array)
    const empConcernList = Array.isArray(window.CONCERNS)
      ? window.CONCERNS.filter(c => _hn(c.emp||'') === _hn(e.n) || (() => {
          const ep=new Set(_hn(e.n).split(' ')),cp=new Set(_hn(c.emp||'').split(' '));
          return [...ep].every(p=>cp.has(p))||[...cp].every(p=>ep.has(p));
        })())
      : [];

    // Observations list
    const obsArr = [];
    if (window._njtcTutorObs) {
      const ek = _hn(e.n);
      for (const o of window._njtcTutorObs) {
        if (_hn(o.tutor||o.name||'') === ek) obsArr.push(o);
      }
    }

    return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Talent Profile — ${e.n}</title><style>${_profilePrintCSS()}</style></head><body>
<div class="pg-header">
  <div class="sub">New Jersey Tutoring Corps · Talent Analytics · CONFIDENTIAL — Data Department Only</div>
  <h1>${e.n}</h1>
  <div class="meta">${e.r||'Tutor'} &nbsp;·&nbsp; ${e.s||'Active'} &nbsp;·&nbsp; ${e.e||'—'} &nbsp;·&nbsp; Generated ${today}</div>
</div>

<div class="kpi-row">
  <div class="kpi"><div class="kpi-val" style="color:${tc.color}">${cfg.emoji} ${cfg.label}</div><div class="kpi-lbl">Talent Tier${score!=null?' ('+score+'%)':''}</div></div>
  <div class="kpi"><div class="kpi-val" style="color:${e.c>2?'#065f46':'#1e293b'}">${e.c||1}</div><div class="kpi-lbl">Cycles</div></div>
  <div class="kpi"><div class="kpi-val" style="color:${att==null?'#94a3b8':att>=90?'#065f46':att>=80?'#d97706':'#b91c1c'}">${att!=null?att+'%':'—'}</div><div class="kpi-lbl">Attendance${liveAtt?' ●':''}</div></div>
  <div class="kpi"><div class="kpi-val" style="color:#7c3aed">${survDisplay!=null?'★'+survDisplay:'—'}</div><div class="kpi-lbl">Survey${liveSurv?' ●':''}</div></div>
  <div class="kpi"><div class="kpi-val" style="color:${e.mp!=null?e.mp>=3?'#065f46':e.mp>=2?'#d97706':'#b91c1c':'#94a3b8'}">${e.mp!=null?e.mp+'/4':'—'}</div><div class="kpi-lbl">Perf Score</div></div>
  <div class="kpi"><div class="kpi-val" style="color:${acad!=null?acad>=50?'#065f46':acad>=25?'#d97706':'#b91c1c':'#94a3b8'}">${acad!=null?acad+'%':'—'}</div><div class="kpi-lbl">Acad Impact</div></div>
  <div class="kpi"><div class="kpi-val" style="color:#1e293b">${obsTotal>0?obsTotal:'—'}</div><div class="kpi-lbl">Observations</div></div>
  <div class="kpi"><div class="kpi-val" style="color:${concerns>0?'#b91c1c':'#065f46'}">${concerns>0?concerns:'✓'}</div><div class="kpi-lbl">Concerns</div></div>
</div>

<div class="section">
  <div class="section-head">Employment & Historical Footprint</div>
  <div class="section-body">
    <div class="two-col">
      <div>
        <div class="label">Current Site${pearlSchools?' ● Pearl Live':''}</div>
        <div class="value">${pearlSchools?pearlSchools.join(', '):(e.si||'—')}</div>
        ${e.di&&!pearlSchools?`<div class="subval">${e.di}</div>`:''}
        ${pearlSchools&&e.si?`<div class="subval">HR record: ${e.si}</div>`:''}
      </div>
      <div>
        <div class="label">SY History (${e.c} cycle${e.c!==1?'s':''})</div>
        <div class="value">${(e.y||[]).join(', ')||'—'}</div>
        ${e.rs&&e.rs.length>1?`<div class="subval">Roles: ${e.rs.slice(0,4).join(' · ')}</div>`:''}
      </div>
    </div>
    ${(e.y||[]).length > 1 ? `<div style="margin-top:8pt">
      <div class="label">Year-by-Year Record</div>
      <table><thead><tr><th>School Year</th><th>Role</th><th>Site</th><th>District</th><th>Status</th></tr></thead><tbody>
        ${(e.y||[]).map(yr=>`<tr><td>${yr}</td><td>${e.r||'—'}</td><td>${e.si||'—'}</td><td>${e.di||'—'}</td><td>${e.s||'—'}</td></tr>`).join('')}
      </tbody></table>
    </div>`:''}
  </div>
</div>

${e.mp!=null?`<div class="section">
  <div class="section-head">Historical Performance Metrics (${e.py||'Prior SY'} EOY Upload)</div>
  <div class="section-body">
    <div class="metric-grid">
      ${metricRows.map(([l,v,isLive])=>{
        const isYes=v==='Yes'||v===true, isNA=v==='N/A';
        return `<div class="metric-cell" style="background:${isNA?'#fffbeb':isYes?'#f0fdf4':'#fff5f5'}">
          <div class="metric-val" style="color:${isNA?'#d97706':isYes?'#065f46':'#b91c1c'}">${isNA?'N/A':isYes?'✓':'✗'}</div>
          <div class="metric-lbl">${l}${isLive?' ●':''}</div>
        </div>`;}).join('')}
    </div>
    ${e.pi!=null?`<div style="font-size:8.5pt;color:#1e293b"><strong>${e.pi}%</strong> improved placement · ${e.pr!=null?`<strong>${e.pr}%</strong> regressed`:''} ${e.p2!=null?`· <strong>${e.p2}%</strong> improved 2+ levels`:''}</div>`:''}
  </div>
</div>`:''}

${acad!=null?`<div class="section">
  <div class="section-head">i-Ready Academic Outcomes (Current SY · Live)</div>
  <div class="section-body">
    <div style="display:flex;gap:10pt;flex-wrap:wrap">
      <div><div class="label">Scholars Advanced</div><div class="value" style="color:#065f46">${acad}%</div></div>
      ${e._acadScholars!=null?`<div><div class="label">Total Scholars</div><div class="value">${e._acadScholars}</div></div>`:''}
      ${e._liveSessions!=null?`<div><div class="label">Sessions</div><div class="value">${e._liveSessions}</div></div>`:''}
    </div>
  </div>
</div>`:''}

${concerns>0||empConcernList.length?`<div class="section">
  <div class="section-head">Program Concerns &amp; HR Actions</div>
  <div class="section-body">
    ${hrAction?`<div style="margin-bottom:6pt"><div class="label">HR Action</div><div class="value" style="color:#b91c1c">${hrAction}</div></div>`:''}
    ${empConcernList.length?empConcernList.slice(0,10).map(c=>`<div class="concern-box">
      <div style="font-size:8.5pt;font-weight:700;color:#92400e">${c.type||c.category||'Concern'} ${c.date?'· '+c.date:''}</div>
      <div style="font-size:8pt;color:#78350f;margin-top:2pt">${c.notes||c.desc||c.description||''}</div>
    </div>`).join(''):concerns>0?`<div class="concern-box"><div style="font-size:8.5pt;color:#92400e">${concerns} concern${concerns>1?'s':''} on record</div></div>`:''}
  </div>
</div>`:''}

${obsArr.length?`<div class="section">
  <div class="section-head">Site Leader Observations</div>
  <div class="section-body">
    <table><thead><tr><th>Date</th><th>Observer</th><th>Rating</th><th>Notes</th></tr></thead><tbody>
      ${obsArr.slice(0,8).map(o=>`<tr><td>${o.date||'—'}</td><td>${o.observer||o.sl||'—'}</td><td>${o.rating||o.score||'—'}</td><td>${(o.notes||o.comments||'').slice(0,80)}</td></tr>`).join('')}
    </tbody></table>
  </div>
</div>`:''}

${latestHiring||hiringRecs.length?`<div class="section">
  <div class="section-head">Hiring Decision Record</div>
  <div class="section-body">
    <table><thead><tr><th>Date</th><th>Decision</th><th>By</th><th>Notes</th></tr></thead><tbody>
      ${hiringRecs.sort((a,b)=>b.ts.localeCompare(a.ts)).slice(0,5).map(r=>`<tr><td>${new Date(r.ts).toLocaleDateString()}</td><td style="font-weight:700">${r.d}</td><td>${r.by||'—'}</td><td>${(r.n||'').slice(0,80)}</td></tr>`).join('')}
    </tbody></table>
  </div>
</div>`:''}

<div class="section">
  <div class="section-head">Profile Summary</div>
  <div class="section-body">
    <div class="summary-box">${summaryParts.join(' ')}</div>
  </div>
</div>

<div class="footer">
  <span>NJTC Talent Analytics · Data Department Only · Confidential</span>
  <span>Generated ${today} · njtc-central-portal</span>
</div>

<script>window.onload=function(){window.print();}</script>
</body></html>`;
  }

  // ── Shared pool builder (PDF + CSV use same filter logic) ────────────────
  function _hrBuildExportPool(scope, value, sy) {
    sy = sy || _pSY || '2025-2026';
    let pool = HR_EMPS.filter(e => {
      if (sy !== 'all' && !((e.y||[]).includes(sy)||(e._liveYears||[]).includes(sy))) return false;
      if (sy === '2025-2026' && e._notInLive2526) return false;
      return true;
    });
    if (scope === 'district' && value && value !== 'all') {
      pool = pool.filter(e => (e.di||'').toLowerCase() === value.toLowerCase());
    } else if (scope === 'school' && value && value !== 'all') {
      const vl = value.toLowerCase();
      pool = pool.filter(e =>
        (e._liveSchools && e._liveSchools.some(s => s.toLowerCase() === vl)) ||
        (e.si||'').toLowerCase() === vl
      );
    } else if (scope === 'region' && value && value !== 'all') {
      const vl = value.toLowerCase();
      pool = pool.filter(e => (e.di||'').toLowerCase().includes(vl) || (e.si||'').toLowerCase().includes(vl));
    }
    return pool;
  }

  // ── CSV download helper ───────────────────────────────────────────────────
  function _csvCell(v) {
    if (v == null) return '';
    const s = String(v).replace(/"/g, '""');
    return /[,"\n\r]/.test(s) ? '"' + s + '"' : s;
  }
  function _csvLine(cells) { return cells.map(_csvCell).join(','); }
  function _csvTriggerDownload(filename, rows) {
    const content = '﻿' + rows.join('\r\n');  // BOM for Excel UTF-8
    const blob = new Blob([content], {type: 'text/csv;charset=utf-8;'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.style.display = 'none';
    document.body.appendChild(a); a.click();
    setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 150);
  }

  // ── Individual profile PDF ────────────────────────────────────────────────
  window._hrExportProfilePDF = function(empName) {
    const emp = HR_EMPS.find(e => e.n === empName);
    if (!emp) { alert('Employee not found: ' + empName); return; }
    const html = _buildProfilePrintHTML(emp);
    const w = window.open('', '_blank', 'width=850,height=1100');
    if (!w) { alert('Pop-up blocked — please allow pop-ups for this site and try again.'); return; }
    w.document.open(); w.document.write(html); w.document.close();
  };

  // ── Individual profile CSV row export ────────────────────────────────────
  window._hrExportProfileCSV = function(empName) {
    const e = HR_EMPS.find(x => x.n === empName);
    if (!e) { alert('Employee not found: ' + empName); return; }
    const _fmtDate = raw => { if(!raw||raw==='#VALUE!')return ''; const d=new Date(raw); return isNaN(d)?raw:((d.getMonth()+1)+'/'+(d.getDate())+'/'+d.getFullYear()); };
    const isActive  = e.s === 'Active';
    const att       = e._liveAtt??e.att;
    const attSrc    = e._liveAtt!==undefined ? 'Pearl Live' : e.att!=null ? 'Static' : '';
    const survEnjoy = e.je!=null ? e.je : (e._liveSurveyEntry?.enjoyment ?? null);
    const survSrc   = e.je!=null ? 'EOY Upload' : e._liveSurveyEntry ? 'Pearl Live' : '';
    const locs      = (e._liveSchools&&e._liveSchools.length) ? e._liveSchools.join('; ') : '';
    const hd        = _hiringGet(e.n.replace(/\W/g,'_')).sort((a,b)=>b.ts.localeCompare(a.ts))[0];
    const acadImprove = e._acadImproveYoY??e.acm;
    const dataNote  = isActive
      ? (e._liveAtt!==undefined ? 'Active · Pearl data live' : 'Active · Not yet matched in Pearl this SY')
      : 'Inactive/Terminated · Historical data only · Real-time Pearl data not collected';
    const header = _csvLine(['Name','Status','Role','Email','Site (HR)','District (HR)','Pearl Locations (Live)',
      'School Year(s)','Cycles','Returning Staff','TAP Apprentice',
      'Talent Tier','Talent Tier Source',
      'Attendance %','Attendance Source','Survey Score','Survey Source',
      'Perf Score (/4)','Att Target','Scholar Enjoyment','Scholar Learning','Acad Improvement',
      'iReady % Scholars Advanced','iReady Scholar Count',
      'Concerns Count','HR Action',
      'Term Date','Term Reason','Term Type',
      'Hiring Decision','Hiring Notes','Hiring By','Hiring Date',
      'Race','Ethnicity','Data Status Note']);
    const row = _csvLine([
      e.n, e.s||'', e.r||'', e.e||'',
      e.si||'', e.di||'', locs,
      (e.y||[]).join('; '), e.c||'', e.rh||'', e._apprentice||'',
      (e._liveT||e.t)||'', (e._liveT&&e._liveT!==e.t)?'Live-computed':'Static',
      att!=null?att:'', attSrc,
      survEnjoy!=null?survEnjoy:'', survSrc,
      e.mp!=null?e.mp:'',
      e.am!=null?e.am:'', e.em!=null?e.em:'', e.lm!=null?e.lm:'', acadImprove!=null?acadImprove:'',
      e._acadPctMoved!=null?e._acadPctMoved:'', e._acadScholars!=null?e._acadScholars:'',
      e._liveConcerns||0, e._liveHRAction||e.hn||'',
      _fmtDate(e._termDate||''), e._termReason&&e._termReason!=='#VALUE!'?e._termReason:'', e._termType&&e._termType!=='#VALUE!'?e._termType:'',
      hd?hd.d:'', hd?hd.n:'', hd?hd.by:'', hd?_fmtDate(hd.ts):'',
      e._race||'', e._ethnicity||'', dataNote,
    ]);
    const filename = `NJTC_Profile_${(e.n||'employee').replace(/[^a-z0-9]/gi,'_')}_${new Date().toISOString().slice(0,10)}.csv`;
    _csvTriggerDownload(filename, [header, row]);
  };

  // ── Aggregate PDF (split active / terminated) ─────────────────────────────
  window._hrExportAggregatePDF = function(scope, value, sy) {
    sy = sy || _pSY || '2025-2026';
    const pool = _hrBuildExportPool(scope, value, sy);
    if (!pool.length) { alert('No employees found for this filter.'); return; }

    const today = new Date().toLocaleDateString('en-US',{year:'numeric',month:'long',day:'numeric'});
    const scopeLabel = scope === 'overall' ? 'Organization-Wide' : `${scope.charAt(0).toUpperCase()+scope.slice(1)}: ${value||'All'}`;

    const active   = pool.filter(e => e.s === 'Active');
    const inactive = pool.filter(e => e.s !== 'Active');

    const TMAP = {stellar:{bg:'#d1fae5',c:'#065f46',e:'⭐'},strong:{bg:'#dbeafe',c:'#1e40af',e:'✅'},developing:{bg:'#fef3c7',c:'#92400e',e:'📈'},needs_support:{bg:'#fee2e2',c:'#b91c1c',e:'🤝'},incomplete:{bg:'#f1f5f9',c:'#374151',e:'📋'}};
    const tierOrder = ['stellar','strong','developing','needs_support','incomplete'];

    // Stats from active cohort only (terminated have stale/empty data)
    const tierCounts = {stellar:0,strong:0,developing:0,needs_support:0,incomplete:0};
    active.forEach(e => { const t=e._liveT||e.t; if(tierCounts[t]!==undefined)tierCounts[t]++; });
    const withAtt  = active.filter(e => (e._liveAtt??e.att)!=null);
    const avgAtt   = withAtt.length ? Math.round(withAtt.reduce((s,e)=>s+(e._liveAtt??e.att),0)/withAtt.length) : null;
    const withSurv = active.filter(e => e.je!=null||(e._liveSurveyEntry&&e._liveSurveyEntry.enjoyment!=null));
    const avgSurv  = withSurv.length ? (withSurv.reduce((s,e)=>s+(e.je!=null?e.je:e._liveSurveyEntry.enjoyment),0)/withSurv.length).toFixed(1) : null;
    const withAcad = active.filter(e => e._acadPctMoved!=null);
    const avgAcad  = withAcad.length ? Math.round(withAcad.reduce((s,e)=>s+e._acadPctMoved,0)/withAcad.length) : null;
    const totalConcerns = active.filter(e => (e._liveConcerns||0)>0||e.co===1).length;

    // Active table row builder
    const activeRow = e => {
      const t = e._liveT||e.t; const tm = TMAP[t]||TMAP.incomplete;
      const ea = e._liveAtt??e.att;
      const locs = e._liveSchools&&e._liveSchools.length ? e._liveSchools.slice(0,2).join(', ') : (e.si||'—');
      const hd = _hiringGet(e.n.replace(/\W/g,'_')).sort((a,b)=>b.ts.localeCompare(a.ts))[0];
      return `<tr>
        <td style="font-weight:600">${e.n}</td>
        <td>${e.r||'—'}</td>
        <td><span style="background:${tm.bg};color:${tm.c};padding:1pt 4pt;border-radius:3pt;font-size:7.5pt;font-weight:700">${tm.e} ${t.replace(/_/g,' ')}</span></td>
        <td style="color:${ea==null?'#94a3b8':ea>=90?'#065f46':ea>=80?'#d97706':'#b91c1c'}">${ea!=null?ea+'%':'—'}</td>
        <td>${e.je!=null?'★'+e.je:e._liveSurveyEntry&&e._liveSurveyEntry.enjoyment!=null?'★'+e._liveSurveyEntry.enjoyment.toFixed(1):'—'}</td>
        <td>${e.mp!=null?e.mp+'/4':'—'}</td>
        <td>${e._acadPctMoved!=null?e._acadPctMoved+'%':'—'}</td>
        <td>${(e._liveConcerns||0)>0?`<span style="color:#b91c1c;font-weight:700">${e._liveConcerns}</span>`:'—'}</td>
        <td style="font-size:7.5pt">${locs.slice(0,40)}</td>
        <td style="font-size:7.5pt">${hd?hd.d:'—'}</td>
      </tr>`;
    };

    // Terminated table row builder — includes term details, explains data gaps
    const _fmtDate = raw => { if(!raw||raw==='#VALUE!')return '—'; const d=new Date(raw); return isNaN(d)?raw:((d.getMonth()+1)+'/'+(d.getDate())+'/'+d.getFullYear()); };
    const inactiveRow = e => {
      const ea = e._liveAtt??e.att;
      const hd = _hiringGet(e.n.replace(/\W/g,'_')).sort((a,b)=>b.ts.localeCompare(a.ts))[0];
      const termBg = /involuntary/i.test(e._termType||'')?'#fee2e2':/voluntary/i.test(e._termType||'')?'#ccfbf1':'#f1f5f9';
      const termCo = /involuntary/i.test(e._termType||'')?'#b91c1c':/voluntary/i.test(e._termType||'')?'#0f766e':'#64748b';
      return `<tr>
        <td style="font-weight:600">${e.n}</td>
        <td>${e.r||'—'}</td>
        <td style="color:#64748b">${e.s||'Inactive'}</td>
        <td style="font-size:7.5pt">${_fmtDate(e._termDate||'')}</td>
        <td style="font-size:7.5pt">${e._termReason&&e._termReason!=='#VALUE!'?e._termReason:'—'}</td>
        <td>${e._termType&&e._termType!=='#VALUE!'?`<span style="background:${termBg};color:${termCo};padding:1pt 4pt;border-radius:3pt;font-size:7pt;font-weight:700">${e._termType}</span>`:'—'}</td>
        <td style="color:${ea==null?'#94a3b8':ea>=90?'#065f46':ea>=80?'#d97706':'#b91c1c'}">${ea!=null?ea+'% *':'—'}</td>
        <td>${e.mp!=null?e.mp+'/4 *':'—'}</td>
        <td style="font-size:7.5pt">${(e.si||'—').slice(0,35)}</td>
        <td style="font-size:7.5pt">${hd?hd.d:'—'}</td>
      </tr>`;
    };

    const sortFn = (a,b) => { const at=tierOrder.indexOf(a._liveT||a.t), bt=tierOrder.indexOf(b._liveT||b.t); return at!==bt?at-bt:a.n.localeCompare(b.n); };
    const activeRows   = [...active].sort(sortFn).map(activeRow).join('');
    const inactiveRows = [...inactive].sort((a,b)=>a.n.localeCompare(b.n)).map(inactiveRow).join('');

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Talent Aggregate — ${scopeLabel}</title>
<style>${_profilePrintCSS()}body{font-size:10pt}table{font-size:8pt}th,td{padding:3pt 5pt}
.notice{padding:6pt 9pt;border-radius:4pt;font-size:8pt;margin-bottom:8pt}
</style></head><body>
<div class="pg-header">
  <div class="sub">New Jersey Tutoring Corps · Talent Analytics · CONFIDENTIAL — Data Department Only</div>
  <h1>Aggregate Talent Report · ${scopeLabel}</h1>
  <div class="meta">School Year: ${sy} &nbsp;·&nbsp; ${active.length} active · ${inactive.length} inactive/terminated &nbsp;·&nbsp; Generated ${today}</div>
</div>

<div class="kpi-row">
  <div class="kpi"><div class="kpi-val" style="color:#065f46">${active.length}</div><div class="kpi-lbl">Active</div></div>
  <div class="kpi"><div class="kpi-val" style="color:#64748b">${inactive.length}</div><div class="kpi-lbl">Inactive / Term.</div></div>
  <div class="kpi"><div class="kpi-val" style="color:${avgAtt==null?'#94a3b8':avgAtt>=90?'#065f46':avgAtt>=80?'#d97706':'#b91c1c'}">${avgAtt!=null?avgAtt+'%':'—'}</div><div class="kpi-lbl">Active Avg Att</div></div>
  <div class="kpi"><div class="kpi-val" style="color:#7c3aed">${avgSurv!=null?'★'+avgSurv:'—'}</div><div class="kpi-lbl">Active Avg Survey</div></div>
  <div class="kpi"><div class="kpi-val" style="color:${avgAcad!=null?avgAcad>=50?'#065f46':avgAcad>=30?'#d97706':'#b91c1c':'#94a3b8'}">${avgAcad!=null?avgAcad+'%':'—'}</div><div class="kpi-lbl">Active Acad Impact</div></div>
  <div class="kpi"><div class="kpi-val" style="color:${totalConcerns>0?'#b91c1c':'#065f46'}">${totalConcerns>0?totalConcerns:'✓ 0'}</div><div class="kpi-lbl">Active w/ Concerns</div></div>
</div>

<div class="section">
  <div class="section-head">Tier Distribution — Active Staff Only (${active.length})</div>
  <div class="section-body">
    <div style="display:flex;gap:8pt;flex-wrap:wrap">
      ${Object.entries(tierCounts).map(([t,n])=>{const tm=TMAP[t];return `<div style="flex:1;min-width:65pt;text-align:center;padding:6pt;background:${tm.bg};border-radius:4pt"><div style="font-size:14pt;font-weight:800;color:${tm.c}">${n}</div><div style="font-size:7pt;color:${tm.c};font-weight:700;text-transform:uppercase">${tm.e} ${t.replace(/_/g,' ')}</div><div style="font-size:7pt;color:${tm.c}">${active.length>0?Math.round(n/active.length*100)+'%':''}</div></div>`;}).join('')}
    </div>
  </div>
</div>

${active.length ? `
<div class="section" style="page-break-inside:avoid">
  <div class="section-head" style="background:#065f46;color:#fff">Section A — Active Staff (${active.length}) · Live Pearl + iReady data applies</div>
  <div class="section-body" style="padding:0">
    <table>
      <thead><tr><th>Name</th><th>Role</th><th>Tier</th><th>Att ●</th><th>Survey ●</th><th>Perf</th><th>Acad %</th><th>Concerns</th><th>Location ●</th><th>Hiring</th></tr></thead>
      <tbody>${activeRows}</tbody>
    </table>
  </div>
</div>` : ''}

${inactive.length ? `
<div class="section" style="page-break-before:always">
  <div class="section-head" style="background:#475569;color:#fff">Section B — Inactive / Terminated (${inactive.length}) · Historical data only</div>
  <div class="section-body" style="padding:0 0 4pt 0">
    <div class="notice" style="background:#f8fafc;border:1pt solid #e2e8f0;margin:6pt 8pt 4pt">
      <strong>Why some fields are empty for these employees:</strong> Attendance (marked *) reflects the last period they were active in Pearl.
      Performance Score (*) is from their last EOY upload. Real-time Pearl and iReady data is not collected for inactive staff.
      Termination details (Date, Reason, Type) are sourced from the HR Master List columns N–P.
    </div>
    <table>
      <thead><tr><th>Name</th><th>Role</th><th>Status</th><th>Term Date</th><th>Reason</th><th>Type</th><th>Last Att *</th><th>Last Perf *</th><th>Last Site</th><th>Hiring</th></tr></thead>
      <tbody>${inactiveRows}</tbody>
    </table>
  </div>
</div>` : ''}

<div class="footer">
  <span>NJTC Talent Analytics · Data Department Only · Confidential &nbsp;·&nbsp; ● = Pearl Live data &nbsp;·&nbsp; * = last known value (employee no longer active)</span>
  <span>Generated ${today} · ${scopeLabel} · SY ${sy}</span>
</div>
<script>window.onload=function(){window.print();}</script>
</body></html>`;

    const w = window.open('', '_blank', 'width=1100,height=1100');
    if (!w) { alert('Pop-up blocked — please allow pop-ups for this site and try again.'); return; }
    w.document.open(); w.document.write(html); w.document.close();
  };

  // ── Aggregate CSV export (Data dept only) ────────────────────────────────
  window._hrExportCSV = function(scope, value, sy) {
    sy = sy || _pSY || '2025-2026';
    const pool = _hrBuildExportPool(scope, value, sy);
    if (!pool.length) { alert('No employees found for this filter.'); return; }

    const scopeLabel = scope === 'overall' ? 'OrgWide' : `${scope}-${(value||'all').replace(/[^a-z0-9]/gi,'_')}`;
    const _fmtDate = raw => { if(!raw||raw==='#VALUE!')return ''; const d=new Date(raw); return isNaN(d)?raw:((d.getMonth()+1)+'/'+(d.getDate())+'/'+d.getFullYear()); };

    const header = _csvLine([
      'Name','Status','Role','Email','Site (HR)','District (HR)','Pearl Locations (Live)',
      'School Year(s)','Cycles','Returning Staff','TAP Apprentice',
      'Talent Tier','Talent Tier Source',
      'Attendance %','Attendance Source',
      'Survey Score','Survey Source',
      'Perf Score (/4)','Att Target','Scholar Enjoyment','Scholar Learning','Acad Improvement',
      'iReady % Scholars Advanced','iReady Scholar Count',
      'Concerns Count','HR Action',
      'Term Date','Term Reason','Term Type',
      'Hiring Decision','Hiring Decision Notes','Hiring Decision By','Hiring Decision Date',
      'Race','Ethnicity',
      'Data Status Note',
    ]);

    // Sort: Active first, then Inactive/Terminated, each group alphabetical
    const sorted = [...pool].sort((a,b) => {
      if ((a.s==='Active') !== (b.s==='Active')) return a.s==='Active' ? -1 : 1;
      return a.n.localeCompare(b.n);
    });

    const rows = sorted.map(e => {
      const isActive  = e.s === 'Active';
      const att       = e._liveAtt??e.att;
      const attSrc    = e._liveAtt!==undefined ? 'Pearl Live' : e.att!=null ? 'Static' : '';
      const survEnjoy = e.je!=null ? e.je : (e._liveSurveyEntry?.enjoyment ?? null);
      const survSrc   = e.je!=null ? 'EOY Upload' : e._liveSurveyEntry ? 'Pearl Live' : '';
      const tierSrc   = e._liveT && e._liveT !== e.t ? 'Live-computed' : 'Static embed';
      const locs      = (e._liveSchools&&e._liveSchools.length) ? e._liveSchools.join('; ') : '';
      const hd        = _hiringGet(e.n.replace(/\W/g,'_')).sort((a,b)=>b.ts.localeCompare(a.ts))[0];
      const acadImprove = e._acadImproveYoY??e.acm;
      const dataNote  = isActive
        ? (e._liveAtt!==undefined ? 'Active · Pearl data live this SY' : 'Active · Not yet matched in Pearl this SY')
        : `Inactive/Terminated · Last active data shown · Real-time Pearl data not collected`;

      return _csvLine([
        e.n, e.s||'', e.r||'', e.e||'',
        e.si||'', e.di||'', locs,
        (e.y||[]).join('; '), e.c||'', e.rh||'', e._apprentice||'',
        (e._liveT||e.t)||'', tierSrc,
        att!=null?att:'', attSrc,
        survEnjoy!=null?survEnjoy:'', survSrc,
        e.mp!=null?e.mp:'',
        e.am!=null?e.am:'', e.em!=null?e.em:'', e.lm!=null?e.lm:'', acadImprove!=null?acadImprove:'',
        e._acadPctMoved!=null?e._acadPctMoved:'', e._acadScholars!=null?e._acadScholars:'',
        e._liveConcerns||0, e._liveHRAction||e.hn||'',
        _fmtDate(e._termDate||''), e._termReason&&e._termReason!=='#VALUE!'?e._termReason:'', e._termType&&e._termType!=='#VALUE!'?e._termType:'',
        hd?hd.d:'', hd?hd.n:'', hd?hd.by:'', hd?_fmtDate(hd.ts):'',
        e._race||'', e._ethnicity||'',
        dataNote,
      ]);
    });

    const filename = `NJTC_Talent_${scopeLabel}_${sy.replace('-','_')}_${new Date().toISOString().slice(0,10)}.csv`;
    _csvTriggerDownload(filename, [header, ...rows]);
  };



  window.buildTalentDashboard    = buildTalentDashboard;
  // ── Hiring Decision: global save handler (called from inline onclick) ─────
  window._hrSaveHiringDecision = function(ek, en, decision, notes, isOverride) {
    if (!decision) { alert('Please select a decision before saving.'); return; }
    if (isOverride && !(notes||'').trim()) {
      // Notes are required when overriding an existing decision
      const notesEl = document.getElementById('hiring_notes_' + ek);
      if (notesEl) {
        notesEl.style.borderColor = '#dc2626';
        notesEl.focus();
        notesEl.setAttribute('placeholder', 'Required — who authorized this change and why?');
      }
      alert('Notes are required when overriding an existing decision.\n\nPlease explain who authorized this change and why the decision is being updated.');
      return;
    }
    const sess = window.NJTC_SESSION || {};
    const emp  = (typeof HR_EMPS !== 'undefined' ? HR_EMPS : []).find(e => e.n.replace(/\W/g,'_') === ek);
    const empSite = (emp && emp.si) || '';
    const recs = _hiringLoad();
    const rec = {
      id:   Date.now() + '_' + Math.random().toString(36).slice(2,7),
      ek, en: en, d: decision, n: notes || '', sy: '2025-2026',
      ts:   new Date().toISOString(), by: sess.name || 'Unknown', role: sess.dept || 'unknown',
      loc:  empSite,
    };
    recs.push(rec);
    _hiringSave(recs);
    // Also submit to Google Form for durable historical record
    _hiringSubmitToForm(rec, empSite);
    // Expose to PIE context
    window._njtcHiringDecisions = recs;
    // Refresh the records list in the open modal
    const listEl = document.getElementById('hiring_records_' + ek);
    if (listEl) listEl.innerHTML = _hiringRecordsHtml(ek);
    // Clear the form
    const sel = document.getElementById('hiring_sel_' + ek);
    const txt = document.getElementById('hiring_notes_' + ek);
    const btn = document.getElementById('hiring_save_' + ek);
    if (sel) sel.value = '';
    if (txt) { txt.value = ''; txt.style.borderColor = ''; }
    if (btn) {
      const orig = btn.textContent;
      btn.textContent = '✓ Saved — export from 🗂️ Hiring Records tab to back up';
      btn.style.background='#16a34a';
      btn.style.fontSize='.72rem';
      setTimeout(()=>{ btn.textContent=orig; btn.style.background='#0a1628'; btn.style.fontSize=''; },4000);
    }
  };

  // Expose current decisions to PIE on load
  window._njtcHiringDecisions = _hiringLoad();

  // ── Hiring File Cabinet — table of all decisions (localStorage + Google Sheet) ──
  function _hrHiringFileCabinet() {
    const esc2 = s => (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    // Merge localStorage + cached sheet rows; sheet rows older than local get de-duped by ts+name
    const local = _hiringLoad();
    const sheet = _hiringSheetCache || [];
    const localTsNames = new Set(local.map(r => (r.ts||'').slice(0,16) + '|' + (r.en||r.ek)));
    const sheetOnly = sheet.filter(r => {
      const k = (r.ts||'').slice(0,16) + '|' + (r.en||'');
      return !localTsNames.has(k);
    });
    const recs = [...local, ...sheetOnly].sort((a,b) => b.ts.localeCompare(a.ts));

    // Trigger async sheet fetch to refresh cache, re-render when done
    _hiringFetchSheet().then(rows => {
      _hiringSheetCache = rows;
      // Re-render only if the file cabinet is still visible
      const el = document.getElementById('talentContent');
      if (el && document.getElementById('talentTab-hiring') &&
          document.getElementById('talentTab-hiring').classList.contains('active')) {
        el.innerHTML = _hrHiringFileCabinet();
      }
    });
    const bySY = {};
    recs.forEach(r => { const sy = r.sy||'Unknown'; if (!bySY[sy]) bySY[sy] = []; bySY[sy].push(r); });
    const summary = ['Invite Back','Conditional','Hold','Do Not Rehire'].map(d => {
      const n = recs.filter(r=>r.d===d).length;
      return n ? `<span style="padding:.2rem .6rem;border-radius:20px;font-size:.75rem;font-weight:700;background:${_H_BG[d]||'#f3f4f6'};color:${_H_COLOR[d]||'#374151'}">${d}: <strong>${n}</strong></span>` : '';
    }).filter(Boolean).join(' ');

    const tableRows = recs.map(r => `<tr>
      <td style="padding:.5rem .625rem;font-weight:600;color:var(--navy)">${esc2(r.en||r.ek)}</td>
      <td style="padding:.5rem .625rem">${esc2(r.sy||'—')}</td>
      <td style="padding:.5rem .625rem"><span style="padding:.15rem .5rem;border-radius:20px;font-size:.72rem;font-weight:700;background:${_H_BG[r.d]||'#f3f4f6'};color:${_H_COLOR[r.d]||'#374151'}">${esc2(r.d)}</span></td>
      <td style="padding:.5rem .625rem;font-size:.75rem;color:var(--muted)">${esc2((r.ts||'').slice(0,10))}</td>
      <td style="padding:.5rem .625rem;font-size:.75rem">${esc2(r.by||'—')}</td>
      <td style="padding:.5rem .625rem;font-size:.75rem;color:var(--text-2);max-width:260px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc2(r.n||'—')}</td>
    </tr>`).join('');

    return `
<div style="padding:1.25rem">
  <div style="padding:.625rem .875rem;background:${HIRING_FORM_ID?'#f0fdf4':'#fef3c7'};border:1px solid ${HIRING_FORM_ID?'#bbf7d0':'#fde68a'};border-radius:8px;margin-bottom:1rem;display:flex;align-items:flex-start;gap:.625rem;flex-wrap:wrap">
    <span style="font-size:1rem;flex-shrink:0">${HIRING_FORM_ID?'✅':'⚠️'}</span>
    <div style="font-size:.75rem;color:${HIRING_FORM_ID?'#065f46':'#92400e'};line-height:1.6;flex:1;min-width:200px">
      ${HIRING_FORM_ID
        ? `<strong>Google Form write-through active</strong> — every decision is automatically submitted to the form and recorded in the Google Sheet. Local browser cache provides instant access.
           <a href="https://docs.google.com/spreadsheets/d/e/${HIRING_SHEET_2PACX}/pubhtml" target="_blank" rel="noopener" style="color:#065f46;font-weight:700;margin-left:.5rem">📊 View Google Sheet ↗</a>`
        : `<strong>Google Form not yet connected</strong> — decisions are saved locally only. Provide your form's ID to enable permanent Google Sheet write-through.
           <a href="https://docs.google.com/spreadsheets/d/e/${HIRING_SHEET_2PACX}/pubhtml" target="_blank" rel="noopener" style="color:#92400e;font-weight:700;margin-left:.5rem">📊 View Sheet ↗</a>`}
    </div>
    <div style="display:flex;gap:.375rem;flex-shrink:0">
      <button onclick="window._hrExportHiringCSV()" style="padding:.3rem .625rem;background:#fff;border:1.5px solid #e2e8f0;border-radius:6px;font-size:.7rem;font-weight:700;color:#374151;cursor:pointer;font-family:inherit;white-space:nowrap">📄 Backup CSV</button>
    </div>
  </div>
  <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:.75rem;margin-bottom:1.125rem">
    <div>
      <div style="font-size:1.125rem;font-weight:800;color:var(--navy);margin-bottom:.25rem">🗂️ Hiring Decision File Cabinet</div>
      <div style="font-size:.75rem;color:var(--muted)">${recs.length} decision${recs.length!==1?'s':''} on record · visible to HR and Data department only</div>
      ${summary?`<div style="display:flex;gap:.375rem;flex-wrap:wrap;margin-top:.5rem">${summary}</div>`:''}
    </div>
    <div style="display:flex;gap:.5rem">
      <button onclick="window._hrExportHiringCSV()" style="padding:.4rem .875rem;background:#fff;border:1.5px solid #e2e8f0;border-radius:7px;font-size:.75rem;font-weight:700;color:#374151;cursor:pointer;font-family:inherit">📄 Export CSV</button>
      <button onclick="window._hrExportHiringXLSX()" style="padding:.4rem .875rem;background:#166534;color:#fff;border:none;border-radius:7px;font-size:.75rem;font-weight:700;cursor:pointer;font-family:inherit">📗 Export XLSX (ADP)</button>
    </div>
  </div>
  ${recs.length === 0
    ? `<div style="text-align:center;padding:3rem;color:var(--muted);background:var(--surface-2);border-radius:12px">No hiring decisions recorded yet. Open an employee profile to record the first decision.</div>`
    : `<div style="overflow-x:auto;border-radius:10px;border:1px solid var(--border)">
  <table style="width:100%;border-collapse:collapse;font-size:.8125rem">
    <thead>
      <tr style="background:var(--surface-2)">
        <th style="padding:.5rem .625rem;text-align:left;font-size:.68rem;text-transform:uppercase;color:var(--muted);font-weight:700;letter-spacing:.06em">Employee</th>
        <th style="padding:.5rem .625rem;text-align:left;font-size:.68rem;text-transform:uppercase;color:var(--muted);font-weight:700;letter-spacing:.06em">SY</th>
        <th style="padding:.5rem .625rem;text-align:left;font-size:.68rem;text-transform:uppercase;color:var(--muted);font-weight:700;letter-spacing:.06em">Decision</th>
        <th style="padding:.5rem .625rem;text-align:left;font-size:.68rem;text-transform:uppercase;color:var(--muted);font-weight:700;letter-spacing:.06em">Date</th>
        <th style="padding:.5rem .625rem;text-align:left;font-size:.68rem;text-transform:uppercase;color:var(--muted);font-weight:700;letter-spacing:.06em">Decided By</th>
        <th style="padding:.5rem .625rem;text-align:left;font-size:.68rem;text-transform:uppercase;color:var(--muted);font-weight:700;letter-spacing:.06em">Notes</th>
      </tr>
    </thead>
    <tbody>${tableRows}</tbody>
  </table>
</div>`}
</div>`;
  }

  // ── Hiring export helpers ────────────────────────────────────────────────
  window._hrExportHiringCSV = function() {
    const recs = _hiringLoad().sort((a,b) => b.ts.localeCompare(a.ts));
    if (!recs.length) { alert('No hiring decisions to export.'); return; }
    // Enrich with HR_EMPS operational fields
    const header = ['Employee Name','School Year','Decision','Date','Decided By','Role/Dept','Notes','Cycles','Current Site','District','Status','Perf Score','Attendance','iReady % Improved','Concerns'];
    const rows = recs.map(r => {
      const emp = HR_EMPS.find(e => e.n.replace(/\W/g,'_') === r.ek) || {};
      const att = emp._liveAtt !== undefined ? emp._liveAtt : emp.att;
      return [
        r.en||r.ek, r.sy||'', r.d||'', (r.ts||'').slice(0,10), r.by||'', r.role||'', r.n||'',
        emp.c??'', emp.si||'', emp.di||'', emp.s||'',
        emp.mp!=null?emp.mp+'/4':'', att!=null?att+'%':'',
        emp._acadPctMoved!=null?emp._acadPctMoved+'%':'',
        emp._liveConcerns||0
      ].map(v => '"'+String(v).replace(/"/g,'""')+'"');
    });
    const csv = [header.map(h=>'"'+h+'"').join(','), ...rows.map(r=>r.join(','))].join('\n');
    const a = document.createElement('a');
    a.href = 'data:text/csv;charset=utf-8,﻿'+encodeURIComponent(csv);
    a.download = 'njtc-hiring-decisions-'+new Date().toISOString().slice(0,10)+'.csv';
    a.click();
  };

  window._hrExportHiringXLSX = function() {
    if (!window.XLSX) { alert('XLSX library not loaded — use CSV export instead.'); return; }
    const recs = _hiringLoad().sort((a,b) => b.ts.localeCompare(a.ts));
    if (!recs.length) { alert('No hiring decisions to export.'); return; }
    const rows = recs.map(r => {
      const emp = HR_EMPS.find(e => e.n.replace(/\W/g,'_') === r.ek) || {};
      const att = emp._liveAtt !== undefined ? emp._liveAtt : emp.att;
      return {
        'Employee Name': r.en||r.ek, 'School Year': r.sy||'', 'Decision': r.d||'',
        'Date': (r.ts||'').slice(0,10), 'Decided By': r.by||'', 'Dept/Role': r.role||'',
        'Notes': r.n||'', 'Cycles': emp.c??'', 'Current Site': emp.si||'',
        'District': emp.di||'', 'Status': emp.s||'', 'Role': emp.r||'',
        'Perf Score': emp.mp!=null?emp.mp+'/4':'', 'Perf Score (num)': emp.mp??'',
        'Attendance %': att??'', 'iReady % Improved': emp._acadPctMoved??'',
        'iReady Scholars': emp._acadScholars??'', 'Concerns': emp._liveConcerns||0,
        'HR Action': emp._liveHRAction||'', 'Returning Staff': emp.rh||'',
        'Race': emp._race||'', 'Ethnicity': emp._ethnicity||'',
        'TAP Apprentice': emp.em||'', 'Email': emp.e||''
      };
    });
    const ws = window.XLSX.utils.json_to_sheet(rows);
    ws['!cols'] = [22,12,20,12,22,12,40,8,35,30,12,20,14,14,14,18,16,10,22,16,22,22,14,32].map(w=>({wch:w}));
    const wb = window.XLSX.utils.book_new();
    window.XLSX.utils.book_append_sheet(wb, ws, 'Hiring Decisions');
    window.XLSX.writeFile(wb, 'njtc-hiring-decisions-adp-'+new Date().toISOString().slice(0,10)+'.xlsx');
  };

  window._hrHiringFileCabinet = _hrHiringFileCabinet;

  // ── PIE: expose metric definitions and hiring data for AI context ─────────
  window._njtcTalentDefs = {
    perfScore: {
      label: 'Performance Score (Perf Score)',
      format: '0–4 integer',
      source: 'Pearl HR Master List · prior school year (emp.py)',
      description: 'Count of 4 binary performance metrics met in the prior SY. Each metric is Yes/No based on Pearl data.',
      metrics: {
        'Att Target':         'Tutor met ≥95% school-year attendance goal',
        'Scholar Enjoyment':  'Majority of tutored scholars reported enjoying sessions in end-of-cycle survey',
        'Scholar Learning':   'Majority of tutored scholars reported learning in end-of-cycle survey',
        'Acad Improvement':   'Scholar cohort showed measurable i-Ready placement gain from fall to spring',
      },
      tiers: { stellar:'≥3/4', strong:'2/4', developing:'1/4', needs_support:'0/4' }
    },
    liveTier: {
      label: 'Live Performance Tier',
      description: 'Composite score computed from: Perf Score (×2.5 weight) + Attendance + iReady % Improved + Concerns (penalty) + Cycles (bonus). Scaled to 0–100% then bucketed into Stellar/Strong/Developing/Needs Support.',
    },
    attendance: { label: 'Attendance %', source: 'Pearl Ops (live)', description: 'Tutor session attendance rate for current SY from Pearl.' },
    survey: { label: 'Survey Score', source: 'Scholar surveys (end of cycle)', description: 'Average scholar-reported enjoyment and learning rating on a 1–5 scale.' },
    iReady: {
      label: 'i-Ready Academic Outcomes',
      source: 'i-Ready Analysis Lab (live)',
      metrics: {
        '% Improved Placement': 'Scholars who moved to a higher placement band fall→spring',
        '% On Grade Level': 'Scholars at or above grade-level placement in spring',
        'Avg Gain': 'Average diagnostic score gain in points across all tutored scholars',
      }
    },
    hiringDecision: {
      label: 'Hiring Decision Record',
      access: 'HR and Data departments only',
      description: 'Persistent decision record stored per employee. Options: Invite Back / Conditional / Hold / Do Not Rehire. Records accumulate and are exportable as CSV/XLSX.',
      persistence: 'Browser localStorage (njtc_hiring_decisions_v2) — export regularly to maintain durable record',
    },
    apprentice: {
      label: 'TAP Apprentice',
      source: 'HR Master List col K · 2025-2026',
      description: 'DOL-registered apprentice enrolled in NJTC Tutor Apprenticeship Program (TAP). Count from raw live HR data before name-matching.',
    },
  };

  // Re-apply T&D obs overlay whenever T&D data becomes available
  const _origTndObsReady = window._njtcObsReady;
  window._njtcObsReady = function() {
    if (window._njtcTutorObs) { _hrInvalidateOverlay(); _hrOverlayTndObs(); }
    if (typeof _origTndObsReady === 'function') _origTndObsReady();
  };

  // ── Talent Analytics: Definitions tab ────────────────────────────────────
  function _hrViewDefinitions() {
    const sec = (icon, title, body) =>
      `<div style="background:var(--surface);border:1.5px solid var(--border);border-radius:10px;overflow:hidden;margin-bottom:.875rem">
        <div style="padding:.55rem .875rem;background:linear-gradient(90deg,#0a1628,#1a3a6b);display:flex;align-items:center;gap:.5rem">
          <span style="font-size:.85rem">${icon}</span>
          <span style="font-size:.75rem;font-weight:800;color:#fff;letter-spacing:.02em">${title}</span>
        </div>
        <div style="padding:.75rem .875rem">${body}</div>
      </div>`;

    const row = (label, value, note='', valueColor='var(--navy)') =>
      `<div style="display:flex;align-items:baseline;gap:.5rem;padding:.3rem 0;border-bottom:1px solid var(--border)">
        <span style="font-size:.7rem;font-weight:700;color:var(--navy);min-width:180px;flex-shrink:0">${label}</span>
        <span style="font-size:.7rem;font-weight:800;color:${valueColor}">${value}</span>
        ${note?`<span style="font-size:.65rem;color:var(--muted);font-style:italic">${note}</span>`:''}
      </div>`;

    const tierChip = (bg,col,label) =>
      `<span style="background:${bg};color:${col};padding:.2rem .55rem;border-radius:6px;font-size:.72rem;font-weight:700;display:inline-block">${label}</span>`;

    // ── Section 1: Tier Overview ──────────────────────────────────────────────
    const tierOverview = sec('🏅', 'Performance Tiers — What Each Bucket Means',
      `<div style="display:flex;flex-direction:column;gap:.625rem">
        <div style="display:grid;grid-template-columns:auto 1fr;gap:.5rem .875rem;align-items:start">
          ${tierChip('#d1fae5','#0d6e3a','⭐ Stellar')}
          <div>
            <div style="font-size:.72rem;font-weight:700;color:#0d6e3a;margin-bottom:.15rem">Consistently meets or exceeds all program benchmarks</div>
            <div style="font-size:.68rem;color:var(--navy);line-height:1.6">Scored ≥75% of the maximum possible weighted tier score. Typically: strong Perf Score (3–4/4), attendance ≥90–95%, positive iReady academic outcomes, no active concerns. These are the program's model tutors — retention priority and candidates for leadership responsibilities.</div>
          </div>
          ${tierChip('#dbeafe','#0050c8','✅ Strong')}
          <div>
            <div style="font-size:.72rem;font-weight:700;color:#0050c8;margin-bottom:.15rem">Meeting core benchmarks reliably; no critical flags</div>
            <div style="font-size:.68rem;color:var(--navy);line-height:1.6">Scored 55–74%. Solid performance across most dimensions. Minor attendance gaps or one missed survey metric are acceptable at this tier. No active HR action. These tutors are dependable program contributors who may be one growth area away from Stellar.</div>
          </div>
          ${tierChip('#fef3c7','#d97706','📈 Developing')}
          <div>
            <div style="font-size:.72rem;font-weight:700;color:#d97706;margin-bottom:.15rem">Below one or more benchmarks; progressing with support</div>
            <div style="font-size:.68rem;color:var(--navy);line-height:1.6">Scored 38–54%. Meaningful gaps exist in attendance, scholar outcomes, or the Perf Score, but the tutor is not in a critical state. Proactive check-ins, coaching, and monitoring are appropriate. New tutors with limited historical data often start here as they build track records.</div>
          </div>
          ${tierChip('#fee2e2','#b91c1c','🤝 Needs Support')}
          <div>
            <div style="font-size:.72rem;font-weight:700;color:#b91c1c;margin-bottom:.15rem">Critically below benchmarks — requires immediate intervention</div>
            <div style="font-size:.68rem;color:var(--navy);line-height:1.6">Scored &lt;38%, OR has an active HR action (Write-Up, PGP, Recommended Termination). May include tutors with very low attendance, multiple program concerns, or poor Perf Scores. This tier is a call to action for supervisors and HR — not a judgment of character, but a signal that structured support is needed urgently.</div>
          </div>
          ${tierChip('#f1f5f9','#7d8fa1','📋 No Score')}
          <div>
            <div style="font-size:.72rem;font-weight:700;color:#7d8fa1;margin-bottom:.15rem">Insufficient data to compute a live tier</div>
            <div style="font-size:.68rem;color:var(--navy);line-height:1.6">No prior-SY Perf Score has been uploaded to the HR Master List for this person. The tier shown (if any) is carried over from the last SY in which a Perf Score existed. This is common for new hires mid-cycle and for any tutor whose EOY upload is still pending.</div>
          </div>
        </div>
        <div style="padding:.4rem .625rem;background:#f0f9ff;border:1px solid #bae6fd;border-radius:7px;font-size:.67rem;color:#0369a1;line-height:1.6">
          <b>Note:</b> Operational flags (late surveys, incomplete sessions, HIT ratio) appear on individual cards and profiles but are <em>separate</em> from the tier system. A Stellar employee may carry minor operational flags — always review context before acting on a flag in isolation.
        </div>
      </div>`
    );

    // ── Section 2: Tier Score Formula ─────────────────────────────────────────
    const formulaBody =
      `<div style="display:grid;grid-template-columns:1fr 1fr;gap:.75rem;margin-bottom:.75rem">
        <div style="padding:.5rem .7rem;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px">
          <div style="font-size:.6rem;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:#166534;margin-bottom:.4rem">Formula at a Glance</div>
          <div style="font-size:.68rem;color:#1e293b;line-height:2">
            <b>Score</b> = sum of factor points − penalties + bonuses<br>
            <b>Tier</b> = Score ÷ MaxPossible<br>
            &nbsp;&nbsp;≥ 75% → ⭐ Stellar<br>
            &nbsp;&nbsp;55–74% → ✅ Strong<br>
            &nbsp;&nbsp;38–54% → 📈 Developing<br>
            &nbsp;&nbsp;&lt; 38% → 🤝 Needs Support
          </div>
        </div>
        <div style="padding:.5rem .7rem;background:#fef9f0;border:1px solid #fed7aa;border-radius:8px">
          <div style="font-size:.6rem;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:#92400e;margin-bottom:.4rem">Override Rules</div>
          <div style="font-size:.68rem;color:#1e293b;line-height:1.8">
            <span style="color:#b91c1c;font-weight:700">Hard cap at Needs Support</span> when active HR action includes:<br>
            Recommended Termination, PGP (Performance Growth Plan), or First Write-Up — regardless of how high the raw score is.<br>
            <span style="font-size:.63rem;color:#92400e;font-style:italic">Rationale: unresolved HR actions create organizational risk that outweighs positive metrics.</span>
          </div>
        </div>
      </div>
      <div style="display:flex;flex-direction:column;gap:0">
        ${row('① Perf Score (0–4) × 2.5', 'Max 10 pts', 'Highest-weight factor — manual year-end assessment', '#0d6e3a')}
        <div style="font-size:.65rem;color:var(--muted);padding:.2rem 0 .4rem 180px;line-height:1.5"><b>Rationale:</b> The Perf Score is the most authoritative measure of tutor effectiveness — a human-reviewed composite of attendance target, scholar satisfaction, and academic impact from the prior SY. Weighting it at 2.5× reflects that it's the program's most deliberate and holistic evaluation.</div>
        ${row('② Attendance (live Pearl)', 'Max 10 pts', '≥95%=10 · ≥90%=8 · ≥85%=6 · ≥80%=4 · ≥75%=2 · <75%=0', '#0050c8')}
        <div style="font-size:.65rem;color:var(--muted);padding:.2rem 0 .4rem 180px;line-height:1.5"><b>Rationale:</b> Presence is foundational. A tutor who is absent cannot tutor. Every missed session is a gap in scholar support. Attendance is the most direct, measurable proxy for program delivery and is weighted equally to the academic outcome factor because both reflect program execution.</div>
        ${row('③ iReady Academic Outcomes', 'Max 10 pts', '≥60% scholars advanced=10 · ≥45%=8 · ≥30%=5 · ≥15%=2 · <15%=0', '#7c3aed')}
        <div style="font-size:.65rem;color:var(--muted);padding:.2rem 0 .4rem 180px;line-height:1.5"><b>Rationale:</b> Academic growth is the program's core mission. This factor measures whether the students a tutor worked with actually advanced placement levels in iReady diagnostics — the ultimate upstream outcome metric. It's weighted equally to attendance because impact matters as much as presence.</div>
        ${row('④ Longevity Bonus', '+3 pts (3+ cycles) / +1 pt (2 cycles)', 'Rewards institutional knowledge and scholar relationships', '#d97706')}
        <div style="font-size:.65rem;color:var(--muted);padding:.2rem 0 .4rem 180px;line-height:1.5"><b>Rationale:</b> Returning tutors know the program, build long-term scholar relationships, and reduce onboarding costs. A modest bonus (not a multiplier) reflects that experience adds value without over-riding poor current-SY performance.</div>
        ${row('⑤ Concern Penalty', '−3 pts per active program concern', 'Applied for each concern logged in the Talent system', '#b91c1c')}
        <div style="font-size:.65rem;color:var(--muted);padding:.2rem 0 .4rem 180px;line-height:1.5"><b>Rationale:</b> Program concerns — conduct, reliability, policy violations — signal risk to scholars and sites. They are penalized heavily enough to move a tutor down one tier per concern, preventing high academic scores from masking behavioral or HR issues.</div>
      </div>`;

    const formulaSection = sec('⚖️', 'Tier Score — Weighted Formula & Rationale', formulaBody);

    // ── Section 3: Perf Score (0–4) ───────────────────────────────────────────
    const perfBody =
      `<div style="font-size:.68rem;color:var(--navy);margin-bottom:.625rem;line-height:1.6">
        The Perf Score is a <b>manual year-end (EOY) upload</b> from the HR Master List. It is computed at the end of each school year and reflects the prior SY's performance. It is <em>not</em> recalculated live — it is a snapshot. Each of the 4 metrics below is binary: 1 if the standard was met, 0 if not. The total is the number met (0–4).
      </div>
      <div style="display:flex;flex-direction:column;gap:0;margin-bottom:.625rem">
        ${row('① Attendance Target', 'Pass / Fail', 'Tutor met ≥95% school-year attendance goal across all sessions')}
        <div style="font-size:.65rem;color:var(--muted);padding:.15rem 0 .35rem 180px;line-height:1.5"><b>How measured:</b> Total sessions attended ÷ total sessions scheduled ≥ 0.95. This is the <em>tutor's</em> attendance — not scholar attendance. Threshold reflects NJTC's 95% program standard.</div>
        ${row('② Scholar Enjoyment', 'Pass / Fail', 'Majority of scholars who completed surveys reported enjoying sessions')}
        <div style="font-size:.65rem;color:var(--muted);padding:.15rem 0 .35rem 180px;line-height:1.5"><b>How measured:</b> Median or majority scholar response to the enjoyment question in the Pearl end-of-session survey ≥ threshold. Enjoyment is a strong leading indicator of continued attendance and engagement.</div>
        ${row('③ Scholar Learning', 'Pass / Fail', 'Majority of scholars reported learning something in their sessions')}
        <div style="font-size:.65rem;color:var(--muted);padding:.15rem 0 .35rem 180px;line-height:1.5"><b>How measured:</b> Scholar self-report on the learning question in the Pearl end-of-session survey. While subjective, scholar-perceived learning correlates with academic outcome improvement and is an accessible real-time signal.</div>
        ${row('④ Academic Improvement', 'Pass / Fail', 'Scholars showed measurable iReady diagnostic placement gain')}
        <div style="font-size:.65rem;color:var(--muted);padding:.15rem 0 .35rem 180px;line-height:1.5"><b>How measured:</b> Comparison of iReady diagnostic placements for scholars assigned to this tutor across two testing windows (typically fall → spring). "Improved" = scholar moved to a higher placement band. This metric is <em>N/A</em> (and excluded from scoring) when no prior-SY baseline exists.</div>
      </div>
      <div style="padding:.4rem .625rem;background:#f0f9ff;border:1px solid #bae6fd;border-radius:7px;font-size:.67rem;color:#0369a1;line-height:1.6">
        <b>When is Perf Score missing?</b> A tutor will show <b>No Score</b> if: (a) they are in their first SY and no EOY data has been uploaded yet, (b) their EOY upload is pending for the current SY, or (c) they were added from the live HR sheet but not yet included in a completed EOY review. The 2025-2026 SY Perf Scores will appear once the EOY upload is complete.
      </div>`;

    const perfSection = sec('📐', 'Perf Score (0–4) — Prior SY Binary Metrics', perfBody);

    // ── Section 4: Pearl Live Data ────────────────────────────────────────────
    const pearlBody =
      `<div style="font-size:.68rem;color:var(--navy);margin-bottom:.625rem;line-height:1.6">
        For the current SY (2025-2026), the following data is pulled <b>live from Pearl Operations</b> and overlaid on each tutor's profile. A blue <span style="color:#38bdf8;font-weight:700">●</span> indicator appears next to any field using live data. Pearl data is cached and refreshes up to <b>every 10 minutes</b>, or instantly via the <b>⟳ Sync Live</b> button on the Profiles view.
      </div>
      <div style="display:flex;flex-direction:column;gap:0;margin-bottom:.625rem">
        ${row('Att ● (Attendance)', 'Live from Pearl', 'Sessions attended ÷ sessions scheduled; only instructors with ≥1 attendance record', '#38bdf8')}
        ${row('Survey ● (Scholar Enjoyment)', 'Live from Pearl', 'Average scholar enjoyment score across all sessions this SY; used when no EOY upload exists', '#38bdf8')}
        ${row('Location ●', 'Live from Pearl', 'Schools where tutor ran ≥1 Pearl session as instructor this SY — replaces static HR site field', '#38bdf8')}
        ${row('Scholar Count', 'Live from Pearl', 'Unique scholars across all of this tutor\'s sessions this SY', '#38bdf8')}
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:.5rem">
        <div style="padding:.4rem .625rem;background:#f0f9ff;border:1px solid #bae6fd;border-radius:7px;font-size:.67rem;color:#0369a1;line-height:1.6">
          <b>Name matching:</b> Profiles are matched to Pearl records using a fuzzy token-sorted algorithm that handles middle initials, hyphenated surnames (e.g. Ramsey-Copeland → matches "Ramsey"), parenthetical nicknames, and "-SUB" suffixes. If a tutor shows "Not yet in Pearl this SY," their HR name may need to be reconciled with their Pearl login name.
        </div>
        <div style="padding:.4rem .625rem;background:#faf5ff;border:1px solid #e9d5ff;border-radius:7px;font-size:.67rem;color:#6d28d9;line-height:1.6">
          <b>Tier score update:</b> Live attendance from Pearl feeds directly into the tier score computation (Factor ②). This means tiers shift in real time as Pearl data updates — a tutor's tier may change week-to-week as their attendance rate moves across a threshold.
        </div>
      </div>`;

    const pearlSection = sec('🔵', 'Pearl Live Data — How Real-Time Overlay Works', pearlBody);

    // ── Section 5: iReady Academic Outcomes ──────────────────────────────────
    const acadBody =
      `<div style="font-size:.68rem;color:var(--navy);margin-bottom:.625rem;line-height:1.6">
        iReady diagnostic data is imported via the <b>iReady Lab</b> module and matched to tutors through their scholar roster. The metric shown is the <b>median % of typical growth</b> achieved by scholars under each tutor — e.g., 85% means the median scholar achieved 85% of the growth that iReady considers "typical" for that grade level.
      </div>
      <div style="display:flex;flex-direction:column;gap:0;margin-bottom:.625rem">
        ${row('≥ 100% typical growth', 'Excellent (green)', 'Scholars growing at or above grade-level expectation', '#059669')}
        ${row('60–99% typical growth', 'On Track (yellow)', 'Meaningful growth, approaching grade-level pace', '#d97706')}
        ${row('< 60% typical growth', 'Below Pace (red)', 'Growth is happening but slower than expected; warrants review', '#b91c1c')}
      </div>
      <div style="padding:.4rem .625rem;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:7px;font-size:.67rem;color:#166534;line-height:1.6">
        <b>Important context:</b> Scholars may overlap across multiple tutors (e.g., a scholar in both math and ELA tutoring). The "n=" count shown reflects the number of scholars with valid diagnostic data for that tutor — not total scholars. Low n (&lt;3) should be interpreted cautiously. The 2025-26 academic data will appear once iReady diagnostic windows close and data is imported.
      </div>`;

    const acadSection = sec('📊', 'iReady Academic Outcomes — Interpretation Guide', acadBody);

    // ── Section 6: Data Sources ───────────────────────────────────────────────
    const sourcesBody =
      `<div style="display:grid;grid-template-columns:1fr 1fr;gap:.5rem">
        <div>
          <div style="font-size:.6rem;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:var(--muted);margin-bottom:.3rem">Static (HR Master List)</div>
          <div style="font-size:.67rem;color:var(--navy);line-height:1.75">
            Name, role, status (Active/Terminated)<br>
            School year history &amp; cycle count<br>
            Rehire / returning status<br>
            Prior-SY Perf Score (0–4) and binary metrics<br>
            Prior-SY academic improvement (iReady EOY)<br>
            Apprentice status (DOL-registered)<br>
            Termination date, reason, type
          </div>
        </div>
        <div>
          <div style="font-size:.6rem;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:var(--muted);margin-bottom:.3rem">Live (Pearl Operations · refreshes every 10 min)</div>
          <div style="font-size:.67rem;color:var(--navy);line-height:1.75">
            Current-SY attendance rate &amp; session count<br>
            Current-SY scholar survey scores<br>
            Current-SY session stats (complete / incomplete)<br>
            Active school locations this SY<br>
            Scholar roster &amp; unique scholar count<br>
            Late survey filing rate
          </div>
        </div>
        <div>
          <div style="font-size:.6rem;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:var(--muted);margin-bottom:.3rem">Live (iReady Lab · imported per diagnostic window)</div>
          <div style="font-size:.67rem;color:var(--navy);line-height:1.75">
            Per-tutor median % of typical growth (Math &amp; ELA)<br>
            Scholar count with valid diagnostic data<br>
            Year-over-year placement comparison (when available)
          </div>
        </div>
        <div>
          <div style="font-size:.6rem;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:var(--muted);margin-bottom:.3rem">Live (Talent System · real-time)</div>
          <div style="font-size:.67rem;color:var(--navy);line-height:1.75">
            Program concern logs (type, date, detail)<br>
            HR action status (Watch / Write-Up / PGP / Term)<br>
            Site Leader observation records<br>
            OTJ (On-the-Job) training progress<br>
            Formal observation ratings &amp; notes
          </div>
        </div>
      </div>`;

    const sourcesSection = sec('🗂️', 'Data Sources — What Comes From Where', sourcesBody);

    return `
<div style="max-width:900px">
  <div style="margin-bottom:1rem;padding:.5rem .875rem;background:linear-gradient(90deg,#0a1628,#1a3a6b);border-radius:10px;display:flex;align-items:center;justify-content:space-between">
    <div>
      <div style="font-size:.85rem;font-weight:800;color:#fff">📖 Talent Analytics — Definitions &amp; Methodology</div>
      <div style="font-size:.62rem;color:#94a3b8;margin-top:.15rem">How performance buckets are computed, what each metric means, and where data comes from</div>
    </div>
    <button onclick="setTalentTab('profiles')" style="padding:.3rem .75rem;background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.2);border-radius:6px;color:#fff;font-size:.68rem;font-weight:700;cursor:pointer;white-space:nowrap">← Back to Profiles</button>
  </div>
  ${tierOverview}
  ${formulaSection}
  ${perfSection}
  ${pearlSection}
  ${acadSection}
  ${sourcesSection}
</div>`;
  }

  window.fetchLiveHRData         = fetchLiveHRData;
  window.fetchLiveObsData        = fetchLiveObsData;   // NE+SW site leader observations
  window._updateTalentBadge      = _updateTalentBadge;
  window._hrBuildProfiles        = _hrBuildProfiles;  // called from shared-utils.js
  window._hrViewDefinitions      = _hrViewDefinitions; // called from shared-utils.js buildTalentContent
  window._buildTermAnalyticsWidget    = _buildTermAnalyticsWidget;    // HR & Data home widget
  window._buildOnsiteRetentionWidget  = _buildOnsiteRetentionWidget;  // HR & Data — Summer 2026/SY 2026-2027 home widget
  window._buildRetentionWidget        = _buildRetentionWidget;        // Programming home widget
  window.fetchLiveOnsiteData          = fetchLiveOnsiteData;

})();
