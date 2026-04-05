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

  // Build full analytics object fresh from live KPI_DATA
  function calcKPI(){
    const data = KPI_DATA || [];
    const getS = k => k.midStatus || k.status || 'Unknown';
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

    return { data, counts, totalPts, maxPts, score, risk, goals, total: data.length };
  }

  function buildKPIAnalytics(){
    const el = document.getElementById('kpiAnalyticsContent');
    if(!el) return;
    populateKPIMetricDropdown();
    el.innerHTML = renderKPIAnalytics();
  }

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

    const { counts, score, risk, goals, total, totalPts, maxPts } = d;

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
    html += `<div class="kpia-tabs">
      <button class="kpia-tab active" id="kpiaTab-overview"   onclick="setKPIAnalyticsTab('overview')">🏠 At a Glance</button>
      <button class="kpia-tab"        id="kpiaTab-breakdown"  onclick="setKPIAnalyticsTab('breakdown')">📊 By Goal Area</button>
      <button class="kpia-tab"        id="kpiaTab-atRisk"     onclick="setKPIAnalyticsTab('atRisk')">⚠️ Needs Attention</button>
      <button class="kpia-tab"        id="kpiaTab-pipeline"   onclick="setKPIAnalyticsTab('pipeline')">🟣 Coming Up</button>
      <button class="kpia-tab"        id="kpiaTab-scorecard"  onclick="setKPIAnalyticsTab('scorecard')">🏆 Full Scorecard</button>
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
    const { counts, score, risk, goals, total, totalPts, maxPts } = d;
    const getS = k => k.midStatus || k.status || '';

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
    }
    return '';
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
  const _kpiaOrigShowPanel = showPanel;
  // showPanel is overridden later in the file, so we patch the one that matters
  // via an event-style approach — when kpi-analytics panel opens, build it
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
      if (['hr','data','leadership','kb','finance'].includes(_er_dept)) {
        setTalentTab('profiles');
      } else { buildTalentContent(); }
      return;
    }
    el.innerHTML = '<div class="policy-loading-state"><div class="policy-loading-spinner"></div><div>Loading analytics…</div></div>';
    _talentLiveStatus = 'pending';
    _updateTalentBadge('pending');
    // Signal whether this is a forced refresh (adds cache-bust param, same as KPI refresh)
    window._talentForceRefresh = !!forceRefresh;
    try { await fetchLiveConcerns(); } catch(e) { _talentLiveStatus = 'fallback'; }
    window._talentForceRefresh = false;
    window._talentLoaded = true;
    window._filteredConcerns = CONCERNS;
    _updateTalentBadge(_talentLiveStatus);
    fetchLiveHRData(!!forceRefresh).catch(e=>console.warn('[HR]',e.message));
    fetchLiveObsData(!!forceRefresh).catch(e=>console.warn('[Obs]',e.message));
    // Fire iReady live fetch so HR profiles get fresh academic data
    // _irlFetchLive is inside irlab IIFE — call via public API
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
    if (['hr','data','leadership','kb','finance'].includes(_td)) {
      console.log('[Talent] Calling setTalentTab profiles...');
      setTalentTab('profiles');
    } else {
      buildTalentContent();
    }
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
  const HR_CACHE_KEY  = 'njtc_hr_live_v1';
  const HR_TTL_MS     = 60 * 60 * 1000;  // 1-hour cache

  // ── Site Leader Observations live sheet ──────────────────────────────
  // To enable: paste 2PACX key from File → Share → Publish to web → CSV
  // and set the GID of the observations tab
  const OBS_2PACX     = null;  // TODO: paste site leader observations 2PACX key
  const OBS_GID       = null;  // TODO: GID for observations tab
  const OBS_CACHE_KEY = 'njtc_obs_live_v1';
  const OBS_TTL_MS    = 60 * 60 * 1000;  // 1-hour cache
  let   _obsRows      = [];
  let   _obsFetched   = false;

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
    { n: 'Andrea Bowman',      _race: 'Two or More Races',          _ethnicity: '',                   s: 'Active'  },
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
    const C  = {
      yr: ci('academic'), email: ci('email'), name: ci('full name'),
      role: ci('position'), site: ci('site'), district: ci('district'),
      rehire: ci('rehire'), cycles: ci('cycles'), status: ci('terminated'),
      race: ci('race'), ethnicity: ci('ethnicity'),
      // Column K in HR Master List — apprentice designation (matches header containing "apprentice")
      apprentice: ci('apprentice'),
      // Columns N, O, P — termination detail fields
      termDate:   ci('termination date'),
      termReason: ci('reason category'),
      termType:   ci('termination type'),
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
        rehire:     (r[C.rehire]      ||'').trim(),  // live rehire status from Master List
        race:       C.race       >= 0 ? (r[C.race]       ||'').trim() : '',
        ethnicity:  C.ethnicity  >= 0 ? (r[C.ethnicity]  ||'').trim() : '',
        // Apprentice indicator from Master List (col K) — "Yes"/"Y"/non-empty = is apprentice
        apprentice: C.apprentice >= 0 ? (r[C.apprentice] ||'').trim() : (r[10] ? (r[10]||'').trim() : ''),
        // Termination detail columns N, O, P
        termDate:   C.termDate   >= 0 ? (r[C.termDate]   ||'').trim() : '',
        termReason: C.termReason >= 0 ? (r[C.termReason] ||'').trim() : '',
        termType:   C.termType   >= 0 ? (r[C.termType]   ||'').trim() : '',
      }))
      .filter(r => r.name && r.yr);
  }

  // ── Overlay live master data onto HR_EMPS ────────────────────────────────
    // Track keys already added via live overlay to prevent duplicates on re-render
  const _hrLiveAddedKeys = new Set();

  function _hrOverlayLive(liveRows) {
    // ── Reset HR_EMPS to clean base (removes prior-session push()-added entries) ──
    if (HR_EMPS.length > window._HR_BASE_LEN) {
      HR_EMPS.splice(window._HR_BASE_LEN);  // truncate back to embedded snapshot
    }
    _hrLiveAddedKeys.clear();  // allow re-evaluation of new hires

    // Group live rows by normalized name key
    const byKey = {};
    for (const r of liveRows) {
      const k = _hn(r.name);
      if (!byKey[k]) byKey[k] = [];
      byKey[k].push(r);
    }
    let updated = 0, added = 0;

    // ── Update existing HR_EMPS entries from live sheet ─────────────────────
    for (const emp of HR_EMPS) {
      const k = _hn(emp.n);
      const rows = byKey[k] || [];
      if (!rows.length) {
        // Subset token match fallback
        const ep = new Set(k.split(' '));
        for (const [lk, lr] of Object.entries(byKey)) {
          const lp = new Set(lk.split(' '));
          if (ep.size >= 2 && ([...ep].every(p=>lp.has(p)) || [...lp].every(p=>ep.has(p)))) {
            rows.push(...lr); break;
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
      // Apprentice indicator from col K — flag if any current SY row is marked
      const anyApprent = rows.some(r => r.yr === '2025-2026' && r.apprentice && /yes|y|true|1/i.test(r.apprentice));
      emp._apprentice = anyApprent ? 'Yes' : (emp._apprentice || '');
      // Track all SYs this person has appeared in
      const allYrs = [...new Set(rows.map(r=>r.yr).filter(Boolean))].sort().reverse();
      emp.y = allYrs;
      emp._liveYears = allYrs;
      // Cycles = max across all SY rows
      const maxCyc = rows.reduce((m,r)=>Math.max(m,parseInt(r.cycles)||0),0);
      if (maxCyc > 0) emp.c = maxCyc;
      emp._live = true;
      updated++;
    }

    // ── Add NEW employees: ONLY from 2025-2026 rows, ONLY if not already tracked ──
    const embKeys = new Set(HR_EMPS.map(e => _hn(e.n)));
    const curSYRows = liveRows.filter(r => r.yr === '2025-2026');
    // Build unique names from current SY only
    const curByKey = {};
    for (const r of curSYRows) {
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
      if (!latest.name || !latest.status) continue; // skip incomplete rows
      HR_EMPS.push({
        n: latest.name, a:[], e: latest.email||'',
        y: ['2025-2026'],
        c: rows.reduce((m,r)=>Math.max(m,parseInt(r.cycles)||0),1),
        r: latest.role||'', rs:[], si: (latest.site||'').slice(0,45), sis:[latest.site||''],
        di: (latest.district||'').slice(0,45), dis:[], s: latest.status||'Active', t:'incomplete',
        mp:null, py:'', am:null, em:null, lm:null, acm:null,
        pi:null, pr:null, p2:null, att:null, je:null, jl:null,
        rh: latest.rehire||null, re:null, co:0, ct:'', cd:'', hn:'', tr:null, ty:'',
        _race: latest.race||null, _ethnicity: latest.ethnicity||null,
        _apprentice: (latest.apprentice && /yes|y|true|1/i.test(latest.apprentice)) ? 'Yes' : '',
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

    _hrInvalidateOverlay();  // signal that re-render needs fresh overlays
    console.log('[HR Profiles] Live overlay: updated='+updated+' added='+added+' (current SY only)');
  }

  // ── Overlay live Pearl Ops data onto HR_EMPS ─────────────────────────────
  // Called after po data loads. Joins by tutor name → updates att, scholar counts.
  function _hrOverlayPearl() {
    if (typeof po === 'undefined' || !po || !po.getTutorAttendanceMap) return;
    try {
      // getTutorAttendanceMap() reads live _personMap — current SY Pearl data only
      const tutorAttMap = po.getTutorAttendanceMap();
      if (!tutorAttMap || !Object.keys(tutorAttMap).length) return;

      let matched = 0;
      for (const emp of HR_EMPS) {
        const ek = _hn(emp.n);  // sorted token key for emp name
        const ep = new Set(ek.split(' '));

        // Try exact match first, then subset token match, then nickname variants
        let tutorData = tutorAttMap[ek];

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
        emp._liveAtt      = tutorData.attRate;
        emp._liveAttTotal = tutorData.total;
        matched++;
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
  // ── Fetch site leader observations ──────────────────────────────────
  async function fetchLiveObsData(force=false) {
    if (!OBS_2PACX || !OBS_GID) return;
    if (!force) {
      try {
        const c = JSON.parse(localStorage.getItem(OBS_CACHE_KEY)||'null');
        if (c && c.ts && (Date.now()-c.ts) < OBS_TTL_MS && c.rows) {
          _obsRows = c.rows;
          _obsFetched = true;
          return;
        }
      } catch(e) {}
    }
    const bust = force ? '&t='+Date.now() : '';
    const url = `https://docs.google.com/spreadsheets/d/e/${OBS_2PACX}/pub?output=csv&gid=${OBS_GID}${bust}`;
    try {
      const res = await fetch(url, {signal: AbortSignal.timeout(10000)});
      if (!res.ok) return;
      const rows = _parseObsSheet(await res.text());
      _obsRows = rows;
      _obsFetched = true;
      try { localStorage.setItem(OBS_CACHE_KEY, JSON.stringify({ts:Date.now(),rows})); } catch(e){}
      console.log('[HR Profiles] Observations loaded:', rows.length, 'records');
      _hrOverlayObs();
    } catch(e) { console.warn('[HR Profiles] Obs fetch failed:', e.message); }
  }

  // ── Parse observation sheet CSV ───────────────────────────────────
  function _parseObsSheet(text) {
    const lines = text.split('\n').filter(l=>l.trim());
    if (!lines.length) return [];
    const header = lines[0].split(',').map(h=>h.replace(/"/g,'').trim().toLowerCase());
    const g = (row, ...keys) => {
      for (const k of keys) {
        const i = header.indexOf(k);
        if (i>-1) { const v=(row[i]||'').replace(/"/g,'').trim(); if(v) return v; }
      }
      return '';
    };
    return lines.slice(1).map(line => {
      const row = line.split(',');
      return {
        name:     g(row,'tutor name','instructor name','staff name','name'),
        date:     g(row,'date','observation date'),
        rating:   g(row,'rating','score','overall','overall rating'),
        type:     g(row,'type','observation type','visit type'),
        notes:    g(row,'notes','comments','feedback'),
        observer: g(row,'observer','submitted by','site leader'),
        site:     g(row,'site','school','location'),
      };
    }).filter(r=>r.name);
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
        emp._acadAvgGain     = td.avgGain        ?? null;   // avg diagnostic gain
        emp._acadMoved       = td.moved          || 0;
        emp._acadHeld        = td.held           || 0;
        emp._acadRegressed   = td.regressed      || 0;
        emp._acadCert        = td.cert           || '';
        emp._acadDistricts   = [...(td.districts||[])].filter(Boolean).join(', ');
        emp._acadYears       = [...(td.years||[])].filter(Boolean).sort().reverse().join(', ');
        emp._acadSubjects    = [...(td.subjects||[])].filter(Boolean).join(', ');
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
                // Don't blank the screen — leave existing content
              }
            }
          }
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
    // SY filter: restrict to employees who have a record in the selected SY
    if (_pSY && _pSY !== 'all') {
      list = list.filter(e => (e.y||[]).includes(_pSY) || (e._liveYears||[]).includes(_pSY));
    }
    // Tab-aware status filter: 'active' tab = Active only; 'inactive' tab = all non-Active
    if (_pViewTab === 'active')   list = list.filter(e => e.s === 'Active');
    if (_pViewTab === 'inactive') list = list.filter(e => e.s !== 'Active');
    // Additional tier and role filters
    if (_pTier !== 'all') list = list.filter(e => (e._liveT||e.t) === _pTier);
    if (_pRole !== 'all') list = list.filter(e => (e.r||'').toLowerCase().includes(_pRole.toLowerCase()));
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
      ...(noRehire>0?[{pos:false,ico:'⛔', txt:`${noRehire} employees marked Do Not Rehire`}]:[]),
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
    {v:noRehire,      l:'Not Eligible for Rehire',          sub:'pipeline constraint', bg:'#fef2f2',co:'#b91c1c'},
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

    // Watch list: needs_support active OR high concerns
    const watchList = HR_EMPS.filter(e=>
      (e.t==='needs_support'&&e.s==='Active') ||
      ((e._liveConcerns||0)>=2&&e.s==='Active')
    ).sort((a,b)=>(b._liveConcerns||0)-(a._liveConcerns||0)).slice(0,8);

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

    return `
<!-- Header -->
<div style="background:linear-gradient(135deg,#0a1628,#1a3a6b);padding:1.125rem 1.5rem;border-radius:10px;color:#fff;margin-bottom:1.125rem">
  <div style="font-size:.6rem;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:rgba(255,255,255,.4);margin-bottom:.3rem">Chief of Staff · Staff Intelligence</div>
  <div style="font-size:1.25rem;font-weight:700">Talent Landscape Overview · ${src}</div>
  <div style="font-size:.8rem;color:rgba(255,255,255,.6)">${total} employees · ${active} active · SY 2022–2026</div>
</div>

<!-- Tier distribution -->
<div style="margin-bottom:1.125rem;padding:1rem 1.125rem;background:var(--surface);border:1.5px solid var(--border);border-radius:10px">
  <div style="font-size:.7rem;font-weight:700;text-transform:uppercase;color:var(--muted);letter-spacing:.07em;margin-bottom:.625rem">Performance Tier Distribution</div>
  <div style="display:flex;gap:3px;border-radius:6px;overflow:hidden;height:10px;margin-bottom:.625rem">${tierBar}</div>
  <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:.375rem">
    ${tierOrder.map(t=>{const c=_tier(t); return`<div style="text-align:center;padding:.375rem .25rem;background:${c.bg+'33'};border-radius:6px">
      <div style="font-size:1.125rem;font-weight:800;color:${c.color}">${byTier[t]}</div>
      <div style="font-size:.6rem;color:var(--muted)">${c.label}</div>
    </div>`;}).join('')}
  </div>
</div>

<!-- 2-col: Top performers + Watch list -->
<div style="display:grid;grid-template-columns:1fr 1fr;gap:.875rem;margin-bottom:1.125rem">
  <!-- Top performers -->
  <div style="padding:.875rem 1rem;background:var(--surface);border:1.5px solid var(--border);border-radius:10px">
    <div style="font-size:.7rem;font-weight:700;text-transform:uppercase;color:#0d6e3a;letter-spacing:.07em;margin-bottom:.5rem">🌟 Stellar Performers (Active · 2+ Cycles)</div>
    ${topPerformers.length
      ? `<div style="display:flex;flex-direction:column;gap:.3rem">${topPerformers.map(e=>nameRow(e,false)).join('')}</div>`
      : '<div style="font-size:.75rem;color:var(--muted)">No records match criteria</div>'}
  </div>
  <!-- Watch list -->
  <div style="padding:.875rem 1rem;background:var(--surface);border:1.5px solid #fed7aa;border-radius:10px">
    <div style="font-size:.7rem;font-weight:700;text-transform:uppercase;color:#92400e;letter-spacing:.07em;margin-bottom:.5rem">⚠️ Active Watch List</div>
    ${watchList.length
      ? `<div style="display:flex;flex-direction:column;gap:.3rem">${watchList.map(e=>nameRow(e,true,true)).join('')}</div>`
      : '<div style="font-size:.75rem;color:#0d6e3a">No active watch items ✓</div>'}
  </div>
</div>

<!-- Risk flags panel -->
${(termRisk.length||pgpList.length||attRisk.length) ? `
<div style="padding:.875rem 1rem;background:#fff7ed;border:1.5px solid #fed7aa;border-radius:10px;margin-bottom:1.125rem">
  <div style="font-size:.7rem;font-weight:700;text-transform:uppercase;color:#92400e;letter-spacing:.07em;margin-bottom:.625rem">🚨 HR Risk Flags Requiring Leadership Awareness</div>
  <div style="display:flex;flex-direction:column;gap:.4rem">
    ${termRisk.length?`<div style="font-size:.8rem;color:#b91c1c"><strong>Termination Recommended (${termRisk.length}):</strong> ${termRisk.map(e=>esc(e.n)).join(' · ')}</div>`:''}
    ${pgpList.length?`<div style="font-size:.8rem;color:#92400e"><strong>Active PGP (${pgpList.length}):</strong> ${pgpList.map(e=>esc(e.n)).join(' · ')}</div>`:''}
    ${attRisk.length?`<div style="font-size:.8rem;color:#92400e"><strong>Attendance Below 80% - Active Staff (${attRisk.length}):</strong> ${attRisk.map(e=>esc(e.n)+' ('+getAtt(e)+'%)').join(' · ')}</div>`:''}
    ${multiConcerns.length?`<div style="font-size:.8rem;color:#92400e"><strong>Multiple Active Concerns (${multiConcerns.length}):</strong> ${multiConcerns.map(e=>esc(e.n)+' ('+e._liveConcerns+'x)').join(' · ')}</div>`:''}
  </div>
</div>` : `<div style="padding:.75rem 1rem;background:#f0fdf4;border:1.5px solid #bbf7d0;border-radius:10px;font-size:.8125rem;color:#065f46;margin-bottom:1.125rem">✅ No critical HR risk flags at this time</div>`}

<!-- Academic summary -->
${hasAcad ? `
<div style="padding:.875rem 1rem;background:var(--surface);border:1.5px solid var(--border);border-radius:10px;margin-bottom:1.125rem">
  <div style="font-size:.7rem;font-weight:700;text-transform:uppercase;color:var(--muted);letter-spacing:.07em;margin-bottom:.625rem">📚 i-Ready Academic Outcomes (Tutor-Level)</div>
  <div style="display:flex;gap:1.25rem;flex-wrap:wrap">
    <span style="font-size:.875rem"><strong style="color:#7c3aed">${totalScholars}</strong> <span style="color:var(--muted)">scholars in dataset</span></span>
    <span style="font-size:.875rem"><strong style="color:${avgPctMoved>=40?'#0d6e3a':'#d97706'}">${avgPctMoved}%</strong> <span style="color:var(--muted)">avg tutors' scholars improved placement</span></span>
    <span style="font-size:.875rem"><strong>${acadMovers.length}</strong> <span style="color:var(--muted)">tutors with academic data</span></span>
  </div>
</div>` : ''}

<!-- Rehire pipeline -->
<div style="padding:.875rem 1rem;background:var(--surface);border:1.5px solid var(--border);border-radius:10px;margin-bottom:1.125rem">
  <div style="font-size:.7rem;font-weight:700;text-transform:uppercase;color:var(--muted);letter-spacing:.07em;margin-bottom:.5rem">🔁 Rehire Pipeline</div>
  <div style="display:flex;gap:1.5rem;flex-wrap:wrap;font-size:.875rem">
    <span><strong style="color:#0d6e3a">${HR_EMPS.filter(e=>(e.rh==='Yes'||e.rh===true)&&e.s!=='Active').length}</strong> <span style="color:var(--muted)">eligible for rehire</span></span>
    <span><strong style="color:#b91c1c">${noRehire.length}</strong> <span style="color:var(--muted)">do not rehire</span></span>
    <span><strong style="color:var(--navy)">${HR_EMPS.filter(e=>e.c>=3&&(e.rh==='Yes'||e.rh===true)).length}</strong> <span style="color:var(--muted)">3+ cycle veterans eligible</span></span>
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

    // Filter to selected SY for stats
    const syEmps    = curSY === 'all' ? HR_EMPS
                    : HR_EMPS.filter(e => (e.y||[]).includes(curSY)||(e._liveYears||[]).includes(curSY));
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

      // 4 KPI tiles
      const kpiTiles = [
        { v: e.c != null ? e.c + 'cy' : '—',  l: 'Cycles',     color: 'var(--navy)' },
        { v: att != null ? att + '%' : '—',    l: isLiveAtt ? 'Att ●' : 'Attendance', color: _attColor(att) },
        { v: e.je != null ? '★' + e.je : '—', l: 'Survey',     color: '#7c3aed' },
        { v: e.mp != null ? e.mp + '/4' : '—', l: 'Perf Score', color: e.mp!=null?(e.mp>=3?'#0d6e3a':e.mp>=2?'#d97706':'#b91c1c'):'var(--muted)' },
      ].map(k => `<div style="flex:1;min-width:55px;text-align:center;padding:.4rem .2rem;background:var(--surface-2);border-radius:6px">
  <div style="font-size:.9rem;font-weight:800;color:${k.color};line-height:1.1">${esc(k.v)}</div>
  <div style="font-size:.58rem;color:${isLiveAtt && k.l.includes('Att') ? '#0ea5e9' : 'var(--muted)'};margin-top:.1rem">${k.l}</div>
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
      const rhBadge = (e.rh==='No'||e.rh===false)
        ? `<span style="font-size:.58rem;background:#fee2e2;color:#b91c1c;padding:.1rem .3rem;border-radius:4px;font-weight:700">⛔ No Rehire</span>`
        : (e.rh==='Yes'||e.rh===true)
          ? `<span style="font-size:.58rem;background:#d1fae5;color:#065f46;padding:.1rem .3rem;border-radius:4px;font-weight:700">✅ Rehire</span>` : '';

      return `<div onclick="_hrShowProfile('${esc(e.n)}')" style="cursor:pointer;background:var(--surface);border:1.5px solid ${borderColor};border-radius:10px;overflow:hidden;transition:.15s;display:flex;flex-direction:column;opacity:${isActive?'1':'0.72'}" onmouseenter="this.style.boxShadow='0 4px 18px rgba(10,22,40,.12)';this.style.opacity='1'" onmouseleave="this.style.boxShadow='none';this.style.opacity='${isActive?'1':'0.72'}'">
  <div style="background:linear-gradient(90deg,#0a1628,#1a3a6b);padding:.5rem .75rem;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:.25rem">
    <div style="display:flex;gap:.3rem;align-items:center;flex-wrap:wrap">
      <span style="background:${cfg.bg};color:${cfg.color};padding:.12rem .4rem;border-radius:6px;font-size:.58rem;font-weight:700">${cfg.emoji} ${cfg.label}</span>
      ${e._apprentice==='Yes'?`<span style="background:#fef9c3;color:#854d0e;padding:.12rem .4rem;border-radius:6px;font-size:.58rem;font-weight:700;border:1px solid #fde68a" title="DOL Apprentice: Enrolled in the NJTC DOL-registered apprenticeship program">🎓 Apprentice</span>`:''}
    </div>
    <div style="display:flex;gap:.3rem;align-items:center">${rhBadge} <span style="font-size:.6rem;padding:.1rem .35rem;border-radius:4px;font-weight:700;background:${isActive?'#d1fae5':'#f1f5f9'};color:${isActive?'#065f46':'#64748b'}">${isActive?'Active':'Inactive'}</span></div>
  </div>
  <div style="padding:.5rem .75rem .3rem">
    <div style="font-weight:800;color:var(--navy);font-size:.83rem;line-height:1.2">${esc(e.n)}</div>
    <div style="font-size:.67rem;color:var(--text-2);margin-top:.08rem">${esc(e.r||'—')}</div>
    <div style="font-size:.62rem;color:var(--muted);margin-top:.06rem">${esc((e.si||'—').slice(0,34))}${e.di?' · '+esc(e.di.slice(0,22)):''}</div>
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
  ${statCard(noRehire, 'No Rehire Flags', noRehire > 0 ? '#b91c1c' : 'var(--muted)')}
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
    const filtersRow = `
<div style="display:flex;gap:.5rem;align-items:center;flex-wrap:wrap;margin-bottom:.75rem">
  <select onchange="_hrSetRole(this.value)" style="font-size:.7rem;padding:.3rem .5rem;border:1.5px solid var(--border);border-radius:6px;background:var(--surface-2);color:var(--navy)">
    <option value="all" ${_pRole==='all'?'selected':''}>All Roles</option>
    <option value="tutor" ${_pRole==='tutor'?'selected':''}>Tutor</option>
    <option value="site coord" ${_pRole.includes('site')?'selected':''}>Site Coordinator</option>
    <option value="dual" ${_pRole==='dual'?'selected':''}>Dual Role</option>
  </select>
  <div style="position:relative;flex:1;min-width:180px">
    <input type="text" placeholder="🔍 Search name, site, role…" oninput="_hrDoSearch(this.value)" value="${esc(_pQ)}"
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
<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:.5rem">
  <div style="font-size:.72rem;font-weight:700;color:var(--navy)">Employee Profiles</div>
  <div style="display:flex;align-items:center;gap:.5rem">
    <label style="font-size:.65rem;color:var(--muted);font-weight:600">School Year:</label>
    <select onchange="_hrSetSY(this.value)" style="font-size:.72rem;padding:.3rem .625rem;border:1.5px solid var(--navy);border-radius:6px;background:var(--navy);color:#fff;font-weight:700;cursor:pointer">
      ${syOpts}
    </select>
    <span style="font-size:.62rem;color:var(--muted);font-style:italic">${src}</span>
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
    const rhBadge = (emp.rh==='No'||emp.rh===false)
      ? '<span style="background:#fee2e2;color:#b91c1c;padding:.15rem .45rem;border-radius:8px;font-size:.65rem;font-weight:700">⛔ No Rehire</span>'
      : (emp.rh==='Yes'||emp.rh===true)
        ? '<span style="background:#d1fae5;color:#065f46;padding:.15rem .45rem;border-radius:8px;font-size:.65rem;font-weight:700">✅ Eligible for Rehire</span>' : '';

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
    const employmentBody = `
<div style="display:grid;grid-template-columns:1fr 1fr;gap:.75rem">
  <div>
    <div style="font-size:.625rem;font-weight:700;text-transform:uppercase;color:var(--muted);margin-bottom:.3rem">Current Site</div>
    <div style="font-size:.875rem;color:var(--navy);font-weight:600">${esc(emp.si||'—')}</div>
    ${emp.di?`<div style="font-size:.7rem;color:var(--text-2)">${esc(emp.di.slice(0,60))}</div>`:''}
    ${emp.dis&&emp.dis.length>1?`<div style="font-size:.65rem;color:var(--muted);margin-top:.2rem">All districts: ${emp.dis.slice(0,3).map(esc).join(', ')}</div>`:''}
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

    // ── Historic performance metrics ─────────────────────────────────
    const metricsBody = emp.mp!==null ? `
<div>
  <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:.375rem;margin-bottom:.625rem">
    ${[['Att Target',emp.am],['Scholar Enjoyment',emp.em],['Scholar Learning',emp.lm],['Acad Improvement',emp.acm]]
      .map(([l,v])=>`<div style="text-align:center;padding:.4rem .25rem;background:var(--surface-2);border-radius:6px">
      <div style="font-size:.875rem;font-weight:700;color:${v==='Yes'||v===true?'#0d6e3a':'#b91c1c'}">${v==='Yes'||v===true?'✓':'✗'}</div>
      <div style="font-size:.6rem;color:var(--muted);margin-top:.1rem">${l}</div>
    </div>`).join('')}
  </div>
  ${emp.pi!=null?`<div style="display:flex;gap:.875rem;flex-wrap:wrap;padding:.5rem .75rem;background:var(--surface-2);border-radius:8px;font-size:.8125rem">
    <span>📈 <strong>${emp.pi}%</strong> <span style="color:var(--muted)">improved placement</span></span>
    ${emp.pr!=null?`<span>📉 <strong>${emp.pr}%</strong> <span style="color:var(--muted)">regressed</span></span>`:''}
    ${emp.p2!=null?`<span>⭐ <strong>${emp.p2}%</strong> <span style="color:var(--muted)">improved 2+ levels</span></span>`:''}
  </div>`:''}
  <div style="margin-top:.5rem;font-size:.7rem;color:var(--muted)">SY: ${esc(emp.py||'—')} · Overall score: ${emp.mp!==null?emp.mp+'/4':'—'}</div>
</div>` : `<div style="padding:.625rem .75rem;background:#fffbeb;border:1px solid #fde68a;border-radius:8px;font-size:.75rem;color:#92400e">ℹ️ Full performance metrics not available in embedded dataset.</div>`;

    // ── i-Ready academic outcomes ─────────────────────────────────────
    const hasAcad = emp._acadScholars != null;
    const acadBody = hasAcad ? `
<div>
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
  <div style="margin-top:.5rem;font-size:.7rem;color:var(--muted)">
    ${emp._acadSubjects?'Subjects: '+esc(emp._acadSubjects)+' · ':''}${emp._acadDistricts?'Districts: '+esc(emp._acadDistricts.slice(0,60)):''} 
    ${emp._acadCert?'· Cert: '+esc(emp._acadCert):''}
  </div>
</div>` : `<div style="padding:.5rem .75rem;background:var(--surface-2);border-radius:8px;font-size:.75rem;color:var(--muted)">i-Ready data not yet loaded. Open the i-Ready Lab panel first to enable this overlay.</div>`;

    // ── Site leader observations ──────────────────────────────────────
    const hasObs = emp._obsCount > 0;
    const obsBody = hasObs ? `
<div>
  <div style="display:flex;align-items:center;gap:.875rem;margin-bottom:.625rem;padding:.5rem .75rem;background:var(--surface-2);border-radius:8px">
    <span style="font-size:.8125rem"><strong>${emp._obsCount}</strong> observation${emp._obsCount!==1?'s':''}</span>
    ${emp._obsAvgRating!=null?`<span style="font-size:.8125rem">Avg rating: <strong style="color:${emp._obsAvgRating>=4?'#0d6e3a':emp._obsAvgRating>=3?'#d97706':'#b91c1c'}">${emp._obsAvgRating}/5</strong></span>`:''}
  </div>
  ${emp._obsLatest?`<div style="padding:.625rem .75rem;background:var(--surface-2);border-radius:8px;font-size:.75rem">
    <div style="font-size:.65rem;color:var(--muted);margin-bottom:.2rem">Most recent · ${esc(emp._obsLatest.date||'—')} · ${esc(emp._obsLatest.observer||'—')}</div>
    <div style="color:var(--navy)">${esc(emp._obsLatest.notes?.slice(0,200)||'No notes recorded')}</div>
    ${emp._obsLatest.rating?`<div style="margin-top:.3rem;font-size:.7rem;color:var(--muted)">Rating: ${esc(emp._obsLatest.rating)}</div>`:''}
  </div>`:''}
</div>` : (!OBS_2PACX ? `<div style="padding:.5rem .75rem;background:var(--surface-2);border-radius:8px;font-size:.75rem;color:var(--muted)">Site leader observations sheet not yet configured (set OBS_2PACX in code).</div>` : `<div style="padding:.5rem .75rem;background:var(--surface-2);border-radius:8px;font-size:.75rem;color:var(--muted)">No observations on record for this employee.</div>`);

    // ── Concerns ─────────────────────────────────────────────────────
    const concernBody = (concernCount>0||emp.co===1) ? `
<div style="padding:.75rem;background:#fff7ed;border:1.5px solid #fed7aa;border-radius:8px">
  <div style="font-size:.8125rem;font-weight:700;color:#92400e;margin-bottom:.3rem">⚠️ Performance Concern${concernCount>0?' ('+concernCount+' active)':''}</div>
  ${emp.ct?`<div style="font-size:.8125rem;color:#78350f;margin-bottom:.25rem">${esc(emp.ct)}</div>`:''}
  ${emp.cd?`<div style="font-size:.7rem;color:var(--muted)">Recorded: ${esc(emp.cd)}</div>`:''}
  ${hrAction?`<div style="margin-top:.375rem;font-size:.75rem;background:#fee2e2;padding:.3rem .6rem;border-radius:6px;color:#b91c1c;font-weight:600">HR Action: ${esc(hrAction)}</div>`:''}
</div>` : '';

    // ── Hiring decision summary (bottom of card) ─────────────────────
    const hiringSignals = [];
    if (emp.c >= 3)                              hiringSignals.push({ico:'⭐', txt:'3+ cycles — proven retention', pos:true});
    if (emp.c >= 2 && emp.c < 3)                 hiringSignals.push({ico:'📅', txt:'Multi-cycle — building track record', pos:true});
    if ((emp.rh==='Yes'||emp.rh===true))         hiringSignals.push({ico:'✅', txt:'Eligible for rehire', pos:true});
    if ((emp.rh==='No'||emp.rh===false))         hiringSignals.push({ico:'⛔', txt:'Not eligible for rehire', pos:false});
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
  <button onclick="document.getElementById('hrEmpModal').style.display='none'" style="position:absolute;top:.875rem;right:.875rem;background:rgba(255,255,255,.15);border:none;color:#fff;width:28px;height:28px;border-radius:50%;font-size:1rem;cursor:pointer;line-height:1">✕</button>
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
      {v:emp.mp!=null?emp.mp+'/4':'—',                   l:'Perf Score',      c:emp.mp!=null?(emp.mp>=3?'#0d6e3a':emp.mp>=2?'#d97706':'#b91c1c'):'var(--muted)'},
      {v:emp._obsCount!=null&&emp._obsCount>0?emp._obsCount:'—', l:'Obs',    c:'var(--navy)'},
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
    const hispCount = withEth.filter(e => /hispanic|latino/i.test(e._ethnicity||'')).length;
    const hispPct   = withEth.length ? Math.round(hispCount/withEth.length*100) : 0;
    // Combined: non-white OR Hispanic/Latino
    const diverseCount = pool.filter(e =>
      ((e._race||'').toLowerCase() !== 'white' && e._race && e._race !== '' && !/not listed|prefer not/i.test(e._race||'')) ||
      (/hispanic|latino/i.test(e._ethnicity||''))
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
  ${apprentices.length ? (()=>{
    const appRaceMap={};
    const appWithRace=apprentices.filter(e=>e._race&&e._race!==''&&!/not listed|prefer not/i.test(e._race||''));
    appWithRace.forEach(e=>{const r=e._race||'Unknown';appRaceMap[r]=(appRaceMap[r]||0)+1;});
    const appNonWhite=appWithRace.filter(e=>(e._race||'').toLowerCase()!=='white').length;
    const appNonWhitePct=appWithRace.length?Math.round(appNonWhite/appWithRace.length*100):0;
    const appHisp=apprentices.filter(e=>/hispanic|latino/i.test(e._ethnicity||'')).length;
    const appRaceRows=Object.entries(appRaceMap).sort((a,b)=>b[1]-a[1]);
    return `<div style="margin-top:.875rem;padding:.75rem;background:#fefce8;border:1px solid #fde68a;border-radius:8px">
      <div style="font-size:.6rem;font-weight:800;text-transform:uppercase;color:#854d0e;letter-spacing:.08em;margin-bottom:.5rem">🎓 DOL Apprentices (${apprentices.length}) — Race & Ethnicity
        <span style="font-weight:400;font-size:.55rem;color:#a16207;margin-left:.35rem">col K · HR Master List · live data</span>
      </div>
      <div style="display:flex;gap:.5rem;flex-wrap:wrap;margin-bottom:.5rem">
        <div style="text-align:center;padding:.4rem .6rem;background:#fff;border-radius:7px;min-width:90px">
          <div style="font-size:1rem;font-weight:900;color:#854d0e">${appNonWhitePct}%</div>
          <div style="font-size:.55rem;color:#92400e;font-weight:700">Non-White</div>
          <div style="font-size:.52rem;color:#94a3b8">${appNonWhite} of ${appWithRace.length}</div>
        </div>
        <div style="text-align:center;padding:.4rem .6rem;background:#fff;border-radius:7px;min-width:90px">
          <div style="font-size:1rem;font-weight:900;color:#b45309">${appHisp}</div>
          <div style="font-size:.55rem;color:#92400e;font-weight:700">Hispanic/Latino</div>
          <div style="font-size:.52rem;color:#94a3b8">of ${apprentices.length} appr.</div>
        </div>
      </div>
      ${appRaceRows.length?`<div style="font-size:.6rem;font-weight:800;text-transform:uppercase;color:#a16207;letter-spacing:.07em;margin-bottom:.35rem">Race Breakdown</div>${appRaceRows.map(([race,n])=>{const p=appWithRace.length?Math.round(n/appWithRace.length*100):0;const isW=(race||'').toLowerCase()==='white';const bc=isW?'#cbd5e1':'#d97706';return `<div style="display:flex;align-items:center;gap:.4rem;margin-bottom:.3rem"><div style="font-size:.63rem;font-weight:600;color:#1e293b;width:150px;flex-shrink:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(race)}</div>${pBar(p,bc)}<div style="font-size:.64rem;font-weight:800;color:${bc};width:28px;text-align:right;flex-shrink:0">${p}%</div><div style="font-size:.58rem;color:#94a3b8;width:22px;text-align:right;flex-shrink:0">${n}</div></div>`;}).join('')}`:'<div style="font-size:.63rem;color:#94a3b8;font-style:italic">Race data not yet on file for apprentices — available after live HR sheet syncs.</div>'}
    </div>`;
  })() : ''}
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
    const hispCount     = withEth.filter(e => /hispanic|latino/i.test(e._ethnicity)).length;
    const hispPct       = withEth.length ? Math.round(hispCount/withEth.length*100) : 0;
    const diverseCount  = pool.filter(e =>
      ((e._race||'').toLowerCase() !== 'white' && e._race && e._race !== '' && !/not listed|prefer not/i.test(e._race||'')) ||
      (/hispanic|latino/i.test(e._ethnicity||''))
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
      <div style="font-size:.58rem;color:#94a3b8">${hispCount} of ${withEth.length} w/ eth. data</div>
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

  function _hrBuildProfiles(dept) {
    // Only re-apply overlays when data has actually changed (prevents cascade re-renders)
    if (_hrOverlayVersion !== _hrLastOverlayVersion) {
      _hrOverlayConcerns();
      _hrOverlayPearl();
      _hrOverlayAcademic();
      if (_obsRows.length) _hrOverlayObs();
      _hrRecomputeTiers();
      _hrLastOverlayVersion = _hrOverlayVersion;
    }
    const showFull = ['hr','data'].includes(dept);
    if (dept==='kb')           return _hrViewKB();
    if (dept==='finance')      return _hrViewFinance();
    if (dept==='leadership')   return _hrViewLeadership();
    if (dept==='programming')  return _hrViewProgramming();
    if (dept==='training')     return _hrViewTraining();
    if (showFull)              return _hrViewFull();
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

    function tutorRegion(emp) {
      const d  = (emp.di||'').toLowerCase();
      const sc = (emp.si||'').toLowerCase();
      if (NE_KW_D.some(k=>d.includes(k)))    return 'NE';
      if (SW_KW_D.some(k=>d.includes(k)))    return 'SW';
      if (SW_SCHOOLS.some(k=>sc.includes(k))) return 'SW';
      return 'NE';
    }

    function normName(n) { return (n||'').toLowerCase().replace(/\s+/g,' ').trim(); }

    // ── Pearl data ────────────────────────────────────────────────────────────
    const sessRows = (window.po && window.po.getSessRows) ? window.po.getSessRows() : [];
    const stuRows  = (window.po && window.po.getStuRows)  ? window.po.getStuRows()  : [];
    const attMap   = (window.po && window.po.getTutorAttendanceMap) ? window.po.getTutorAttendanceMap() : {};

    const SS = { TITLE:0, INSTRUCTOR:1, STATUS:4, START:6, SCHED_DUR:7, ACTUAL_DUR:8, SUBJECT:9, SESS_ID:14, INST_ID:15, STU_IDS:16 };
    const SU = { FILLED_BY:0, FILLED_FOR:1, CONFIDENCE:2, ENJOYMENT:3, LEARNING:4, OVERALL:5, SESS_ID:11, WEEK:22 };

    // Index sessions by ID; gather per-instructor score arrays
    const sessById = {};
    sessRows.forEach(r => { if (r[SS.SESS_ID]) sessById[r[SS.SESS_ID]] = r; });

    const sessIdsWithSurveys = new Set(stuRows.map(r=>r[SU.SESS_ID]).filter(Boolean));
    const instScores = {};   // instId → { enjoyment:[], overall:[] }
    stuRows.forEach(r => {
      const sess = sessById[r[SU.SESS_ID]];
      if (!sess) return;
      const id = sess[SS.INST_ID]; if (!id) return;
      if (!instScores[id]) instScores[id] = { enjoyment:[], overall:[] };
      const enj = parseFloat(r[SU.ENJOYMENT]);
      const ov  = parseFloat(r[SU.OVERALL]);
      if (!isNaN(enj)) instScores[id].enjoyment.push(enj);
      if (!isNaN(ov))  instScores[id].overall.push(ov);
    });

    const instSessStats = {};   // instId → { total, incomplete, withSurveys }
    const sessByInst    = {};
    sessRows.forEach(r => {
      const id = r[SS.INST_ID]; if (!id) return;
      if (!sessByInst[id]) sessByInst[id] = [];
      sessByInst[id].push(r);
    });
    Object.entries(sessByInst).forEach(([id, rows]) => {
      const total      = rows.length;
      const incomplete = rows.filter(r=>{ const st=(r[SS.STATUS]||'').toLowerCase(); return st!=='completed'&&st!=='complete'; }).length;
      const withSurveys= rows.filter(r=>sessIdsWithSurveys.has(r[SS.SESS_ID])).length;
      instSessStats[id]= { total, incomplete, withSurveys };
    });

    // Build per-tutor Pearl metrics
    function buildMetrics(emp) {
      const nm = normName(emp.n);
      const attEntry = attMap[nm];
      const att = attEntry ? attEntry.attRate : (emp._liveAtt != null ? emp._liveAtt : (emp.att != null ? emp.att : null));
      let instId = null;
      for (const r of sessRows) { if (normName(r[SS.INSTRUCTOR])===nm) { instId=r[SS.INST_ID]; break; } }
      const scores = instId ? (instScores[instId]||null) : null;
      const stats  = instId ? (instSessStats[instId]||null) : null;
      const enjoyMed  = scores ? median(scores.enjoyment) : null;
      const returnMed = scores ? median(scores.overall)   : null;
      const survComp  = (stats&&stats.total>0) ? Math.round(stats.withSurveys/stats.total*100) : null;
      const incompleteCount= stats ? stats.incomplete : null;
      const incompleteRate = (stats&&stats.total>0) ? Math.round(stats.incomplete/stats.total*100) : null;
      return { att, survComp, lateSurveys:null, incompleteCount, incompleteRate, returnMed, enjoyMed, instId };
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
      const region = tutorRegion(emp);
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
    filtered.sort((a,b) => {
      const lo = (levelOrder[a.level]||2) - (levelOrder[b.level]||2);
      return lo !== 0 ? lo : a.emp.n.localeCompare(b.emp.n);
    });

    // ── Chip & badge helpers ────────────────────────────────────────────────
    const CHIP_TIPS = {
      att:      'Percentage of scheduled sessions the tutor attended. Live from Pearl. <80% = Support Needed; <70% = Escalate.',
      survComp: 'Percentage of this tutor\'s sessions with at least one scholar survey submitted. Low rates may reflect session-log gaps.',
      lateSurv: 'Surveys submitted after the expected weekly deadline. Late submissions reduce weekly reporting accuracy.',
      incomplete:'Sessions marked Incomplete in Pearl (no actual duration logged). High rates signal reporting discipline issues.',
      returnMed:'MEDIAN scholar response to "Overall, how was this session?" (1-5). Computed from all scholar surveys for sessions led by this tutor.',
      enjoyMed: 'MEDIAN scholar response to "How much did you enjoy this session?" (1-5). Computed from all scholar surveys for sessions led by this tutor.'
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
      if (!window._njtcTutorObs)
        return '<span style="font-size:.72rem;color:#94a3b8;font-style:italic">Observation data not yet connected</span>';
      const nm = normName(emp.n);
      const tutorObs = window._njtcTutorObs[nm] || window._njtcTutorObs[emp.n] || [];
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
      const { att, survComp, lateSurveys, incompleteCount, incompleteRate, returnMed, enjoyMed } = metrics;
      const co = emp._liveConcerns != null ? emp._liveConcerns : (emp.co||0);

      const attVal   = att!=null ? att.toFixed(1)+'%' : '\u2014';
      const attColor = att==null?'#94a3b8':att<70?'#b91c1c':att<80?'#d97706':'#059669';
      const survVal  = survComp!=null ? survComp+'%' : '\u2014';
      const survColor= survComp==null?'#94a3b8':survComp<40?'#b91c1c':survComp<60?'#d97706':'#059669';
      const lateVal  = lateSurveys!=null ? String(lateSurveys) : 'N/A';
      const incVal   = incompleteCount!=null
        ? incompleteCount+(incompleteRate!=null?' ('+incompleteRate+'%)':'') : '\u2014';
      const incColor = incompleteCount==null?'#94a3b8':incompleteCount===0?'#059669':incompleteRate!=null&&incompleteRate>30?'#b91c1c':'#d97706';
      const retVal   = returnMed!=null ? returnMed.toFixed(2)+' / 5' : '\u2014';
      const retColor = returnMed==null?'#94a3b8':returnMed<3.0?'#b91c1c':returnMed<3.5?'#d97706':'#059669';
      const enjVal   = enjoyMed!=null ? enjoyMed.toFixed(2)+' / 5' : '\u2014';
      const enjColor = enjoyMed==null?'#94a3b8':enjoyMed<3.0?'#b91c1c':enjoyMed<3.5?'#d97706':'#059669';

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
            +'</div>').join('')
          +'</div></div>'
        : '';

      const bl = borderColorMap[level]||'#10b981';
      return '<div style="background:#fff;border:1px solid #e2e8f0;border-left:4px solid '+bl+';border-radius:10px;padding:1rem 1.1rem;margin-bottom:.75rem;box-shadow:0 1px 3px rgba(0,0,0,.06)">'
        // Header
        +'<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:.75rem;flex-wrap:wrap;margin-bottom:.65rem">'
          +'<div>'
            +'<div style="font-weight:700;font-size:.95rem;color:#1e293b">'+esc(emp.n)+'</div>'
            +'<div style="font-size:.78rem;color:#64748b;margin-top:2px;display:flex;gap:.4rem;align-items:center;flex-wrap:wrap">'
              +'<span>'+esc(emp.r||'Tutor')+' \u00B7 '+esc(emp.si||emp.di||'\u2014')+'</span>'
              +'<span style="background:#e0f2fe;color:#0369a1;padding:.1rem .35rem;border-radius:4px;font-size:.65rem;font-weight:700">'+region+'</span>'
              +(emp._apprentice==='Yes'?'<span style="background:#fef9c3;color:#854d0e;padding:.1rem .35rem;border-radius:5px;font-size:.65rem;font-weight:700;border:1px solid #fde68a">\uD83C\uDF93 Apprentice</span>':'')
            +'</div>'
          +'</div>'
          +'<div>'+statusBadge(level,reasons)+'</div>'
        +'</div>'
        // Pearl metric strip
        +'<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(110px,1fr));gap:.4rem;margin-bottom:.65rem">'
          +metricChip('Attendance',    attVal,  attColor,  'att')
          +metricChip('Surv. Comp.',   survVal, survColor, 'survComp')
          +metricChip('Late Surveys',  lateVal, '#94a3b8', 'lateSurv')
          +metricChip('Incomplete',    incVal,  incColor,  'incomplete')
          +metricChip('Return (med)',  retVal,  retColor,  'returnMed')
          +metricChip('Enjoy (med)',   enjVal,  enjColor,  'enjoyMed')
        +'</div>'
        // Observation timeline
        +'<div style="margin-bottom:.5rem">'+obsTimeline(emp)+'</div>'
        // OTJ progress
        +'<div style="margin-bottom:.3rem">'
          +'<span style="font-size:.67rem;color:#94a3b8;text-transform:uppercase;letter-spacing:.04em;font-weight:600;margin-right:.4rem">OTJ:</span>'
          +otjBadges(emp)
        +'</div>'
        +concernHtml
        +'</div>';
    });

    // ── KPI banner ──────────────────────────────────────────────────────────
    const kpiBanner = '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:.6rem;margin-bottom:1.1rem">'
      +[
        { label:'Active Staff',      val:activeCount,   color:'#1d4ed8', sub:'', click:'' },
        { label:'Need Attention',    val:needAttention, color:needAttention>0?'#b91c1c':'#059669', sub:'click to filter',
          click:"_ppSetStatus(_ppStatus==='attention'?'all':'attention')" },
        { label:'Median Attendance', val:medAtt!=null?(medAtt.toFixed(1)+'%'):'\u2014', color:medAtt!=null&&medAtt<80?'#d97706':'#059669', sub:'active staff', click:'' },
        { label:'Median Return',     val:medReturn!=null?medReturn.toFixed(2):'\u2014', color:medReturn!=null&&medReturn<3.5?'#d97706':'#059669', sub:'scholar survey', click:'' }
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
      +'<input type="text" placeholder="Search name or site\u2026" value="'+esc(_ppQ)+'" oninput="_ppSetQ(this.value)" style="font-size:.78rem;padding:.3rem .6rem;border:1px solid #cbd5e1;border-radius:6px;flex:1;min-width:140px;color:#374151;font-family:inherit">'
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
      +(cards.length ? cards.join('') : '<div style="color:#94a3b8;font-style:italic;text-align:center;padding:2rem">No staff match the current filters.</div>')
      +'<div style="font-size:.68rem;color:#94a3b8;margin-top:.75rem;line-height:1.5">'
        +'Attendance live from Pearl \u00B7 Scholar scores are MEDIAN values from session surveys \u00B7 Terminated staff excluded'
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
    root.innerHTML = _hrBuildProfiles(dept);
  }

  // ── Global handlers (onclick= safe) ──────────────────────────────────────
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
  window._hrDoSearch   = q  => { _pQ=q;      _pPage=0; _hrRebuildProfiles(); };
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
  window._ppSetQ      = v  => { _ppQ=v;      _hrRebuildProfiles(); };
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
            _mergeKPIMeta(obj.rows); return;
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
      })
      .catch(function(){});
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
    var qrs = document.getElementById('kpiQRSection');
    if (qrs && (window.NJTC_SESSION||{}).dept !== 'data') {
      qrs.style.display = 'block';
      var dz = document.getElementById('kqrDropZone');
      if (dz) dz.style.display = 'none';
    }
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

    window.fetchAndRebuildKPI   = fetchAndRebuildKPI;
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
      

  // ── HR & Data — Termination Analytics home widget ───────────────────────
  function _buildTermAnalyticsWidget() {
    const CY = '2025-2026';
    const yearEmps = HR_EMPS.filter(e => (e.y||[]).includes(CY) || (e._liveYears||[]).includes(CY));
    const activeEmps = yearEmps.filter(e => e.s === 'Active');
    const termEmps   = yearEmps.filter(e => e.s !== 'Active');
    const total      = yearEmps.length || 1;  // avoid div/0

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
    const priorQ = curQ === 'Q1' ? 'Q4' : curQ === 'Q2' ? 'Q1' : curQ === 'Q3' ? 'Q2' : 'Q3';
    const qtrCounts = { Q1:0, Q2:0, Q3:0, Q4:0 };
    termEmps.forEach(e => { const q = _qtr((e._termDate||'').trim()); if (q) qtrCounts[q]++; });

    // Retention rates (approximate — active / total headcount)
    const retainCur   = Math.round((total - qtrCounts[curQ])   / total * 100);
    const retainPrior = Math.round((total - qtrCounts[priorQ]) / total * 100);
    const direction   = retainCur >= retainPrior ? 'up' : 'down';
    const dirIcon     = direction === 'up' ? '↑' : '↓';
    const dirColor    = direction === 'up' ? '#059669' : '#dc2626';

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
    const volCount  = termEmps.filter(e => /voluntary/i.test(e._termType||'')).length;
    const invCount  = termEmps.filter(e => /involuntary/i.test(e._termType||'')).length;
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

  <!-- KPI tiles row -->
  <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(110px,1fr));gap:.6rem;margin-bottom:1.125rem">
    ${[
      { v: activeEmps.length, l: 'Active Staff',    c: '#1d4ed8' },
      { v: termEmps.length,   l: 'Separated',       c: termEmps.length > 0 ? '#dc2626' : '#059669' },
      { v: Math.round(activeEmps.length / total * 100) + '%', l: 'Retention Rate', c: '#059669' },
      { v: dirIcon + ' ' + retainCur + '%', l: curQ + ' Retention', c: dirColor },
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
          const cnt = qtrCounts[q];
          const isCur = q === curQ;
          return `<div style="display:flex;align-items:center;justify-content:space-between;padding:.25rem .5rem;border-radius:5px;margin-bottom:.25rem;background:${isCur?'#eff6ff':'transparent'};border:1px solid ${isCur?'#bfdbfe':'#f1f5f9'}">
            <span style="font-size:.72rem;color:${isCur?'#1d4ed8':'#64748b'};font-weight:${isCur?'700':'400'}">${q}${isCur?' ●':''}</span>
            <span style="font-size:.72rem;font-weight:700;color:${cnt>0?'#dc2626':'#94a3b8'}">${cnt} sep.</span>
          </div>`;
        }).join('')}
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
      <div style="font-size:.68rem;font-weight:700;text-transform:uppercase;color:#94a3b8;letter-spacing:.06em;margin-bottom:.625rem">Rehire Pipeline</div>
      ${[
        { label: '✅ Eligible (2+ cycles)', count: rehireEligible, bg: '#f0fdf4', color: '#059669' },
        { label: '⛔ Not Eligible',         count: noRehire,       bg: '#fef2f2', color: '#dc2626' },
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

  // ── Expose to global scope ───────────────────────────────────────────────
  window.buildKPIAnalytics       = buildKPIAnalytics;
  window.renderKPIAnalytics      = renderKPIAnalytics;
  window.renderKPIAnalyticsTab   = renderKPIAnalyticsTab;
  window.setKPIAnalyticsTab      = setKPIAnalyticsTab;
  window.fetchKPIMetadata        = fetchKPIMetadata;
  window.kqrRenderSnapshot       = kqrRenderSnapshot;
  window.kqrClear                = kqrClear;
  window.kqrHandleFile           = kqrHandleFile;
  window.openKPIInquiry          = openKPIInquiry;
  window.openKPIInquiryWithMetric = openKPIInquiryWithMetric;
  window.resetKPIInquiry         = resetKPIInquiry;
  window.submitKPIInquiry        = submitKPIInquiry;

  window.buildTalentDashboard    = buildTalentDashboard;
  window.fetchLiveHRData         = fetchLiveHRData;
  window._updateTalentBadge      = _updateTalentBadge;
  window._hrBuildProfiles        = _hrBuildProfiles;  // called from shared-utils.js
  window._buildTermAnalyticsWidget = _buildTermAnalyticsWidget;  // HR & Data home widget
  window._buildRetentionWidget     = _buildRetentionWidget;      // Programming home widget

})();
