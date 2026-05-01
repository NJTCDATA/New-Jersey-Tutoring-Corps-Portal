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
    const _hasQData = window.KPI_Q_DATA && window.KPI_Q_DATA.activeQs && window.KPI_Q_DATA.activeQs.length > 0;
    const _qBadge   = _hasQData ? ` <span style="background:#1e3a5f;color:#93c5fd;font-size:.6rem;font-weight:700;padding:.1rem .35rem;border-radius:8px;vertical-align:middle;margin-left:.25rem">LIVE</span>` : '';
    html += `<div class="kpia-tabs">
      <button class="kpia-tab active" id="kpiaTab-overview"   onclick="setKPIAnalyticsTab('overview')">🏠 At a Glance</button>
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
    var bigWins   = deltas.filter(function(d){ return d.moves.some(function(m){ return m.to==='Met' && _Q_RANK[m.from] <= 2; }); });
    // Critical: any move to Has Not Met
    var critical  = deltas.filter(function(d){ return d.moves.some(function(m){ return m.to==='Has Not Met'; }); });

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
        ${(window.NJTC_SESSION||{}).dept === 'data' ? `<div style="display:flex;gap:.5rem;flex-wrap:wrap;align-items:flex-start;padding-top:.25rem">
          <button onclick="exportKPIQuarterlySummaryPDF()" style="background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.3);color:white;font-size:.75rem;font-weight:700;padding:.4rem .875rem;border-radius:7px;cursor:pointer;display:flex;align-items:center;gap:.35rem">📄 Export PDF</button>
          <button onclick="exportKPIQuarterlySummaryPPTX()" style="background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.3);color:white;font-size:.75rem;font-weight:700;padding:.4rem .875rem;border-radius:7px;cursor:pointer;display:flex;align-items:center;gap:.35rem">📊 Export PPTX</button>
        </div>` : ''}
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
        html += `<div style="display:flex;align-items:flex-start;gap:.75rem;padding:.75rem;border-radius:9px;border:1px solid #bbf7d0;background:#f0fdf4">
          <div style="flex:1;min-width:0">
            <div style="font-size:.8125rem;font-weight:600;color:var(--navy);line-height:1.4;margin-bottom:.3rem">${d.target}</div>
            <div style="font-size:.7rem;color:var(--muted)">${d.goal}${d.owner?' · '+d.owner:''}</div>
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
        var critMove = d.moves.filter(function(m){ return m.to==='Has Not Met'; })[0];
        html += `<div style="display:flex;align-items:flex-start;gap:.75rem;padding:.75rem;border-radius:9px;border:1px solid #fca5a5;background:#fef2f2">
          <div style="font-size:1.125rem;flex-shrink:0">🔴</div>
          <div style="flex:1;min-width:0">
            <div style="font-size:.8125rem;font-weight:600;color:var(--navy);line-height:1.4;margin-bottom:.3rem">${d.target}</div>
            <div style="font-size:.7rem;color:var(--muted)">${d.goal}${d.owner?' · '+d.owner:''}</div>
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
        html += `<div style="display:flex;align-items:flex-start;gap:.75rem;padding:.625rem .75rem;border-radius:9px;border:1px solid #fed7aa;background:#fff7ed">
          <div style="flex:1;min-width:0">
            <div style="font-size:.8125rem;font-weight:600;color:var(--navy);line-height:1.4;margin-bottom:.2rem">${d.target}</div>
            <div style="font-size:.7rem;color:var(--muted)">${d.goal}${d.owner?' · '+d.owner:''}</div>
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
        html += `<div style="display:grid;grid-template-columns:1fr${activeQs.map(function(){ return ' minmax(72px,80px)'; }).join('')};gap:.5rem .75rem;align-items:start;padding:.375rem 0;border-bottom:1px solid var(--border-2)">
          <div style="font-size:.8rem;color:var(--navy);line-height:1.4">${tText}${deltaStr}</div>
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
      </div>`;
    } else {
      html += `<div style="padding:.875rem 1.125rem;border:1px solid #bae6fd;border-radius:12px;background:#f0f9ff;font-size:.8125rem;color:#0c4a6e;line-height:1.6;text-align:center">
        💬 <strong>Ask PIE</strong> for a quarterly summary — type <em>"quarterly summary"</em> or <em>"what changed this quarter"</em> in the chat.<br>
        <span style="font-size:.75rem;opacity:.8">PDF and PPTX exports are available to the Data &amp; Evaluation department.</span>
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

  // ── Overlay live master data onto HR_EMPS ────────────────────────────────
    // Track keys already added via live overlay to prevent duplicates on re-render
  const _hrLiveAddedKeys = new Set();

  function _hrOverlayLive(liveRows) {
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
      const anyApprent    = rows.some(r => r.yr === '2025-2026' && r.apprentice && /yes|y|true|1/i.test(r.apprentice));
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

    // ── Add NEW employees not yet tracked — current SY preferred, prior SYs as fallback ──
    // Process all live rows so prior-SY employees (e.g. a 2024-2025 terminated tutor)
    // are also added. The most recent row's SY is used for the y[] array on the new entry.
    const embKeys = new Set(HR_EMPS.map(e => _hn(e.n)));
    // Build name→rows index across ALL SYs, but prefer current-SY rows when available
    const curByKey = {};
    for (const r of liveRows) {
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
        _apprentice: ((latest.apprentice && /yes|y|true|1/i.test(latest.apprentice)) || (_apprHnSet.size > 0 && _apprHnSet.has(k))) ? 'Yes' : '',
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
      if (r.yr !== '2025-2026' || !r.apprentice || !/yes|y|true|1/i.test(r.apprentice) || !r.name) continue;
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
    if (typeof po === 'undefined' || !po || !po.getTutorAttendanceMap) return;
    try {
      // getTutorAttendanceMap() reads live _personMap — current SY Pearl data only
      const tutorAttMap = po.getTutorAttendanceMap();
      if (!tutorAttMap || !Object.keys(tutorAttMap).length) return;

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
                if (['hr','data'].includes(_dept)) _hw.innerHTML = window._buildTermAnalyticsWidget();
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
                    _hw.innerHTML = window._buildTermAnalyticsWidget();
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
      var statuses = {};
      activeQs.forEach(function(q){ statuses['Q'+q] = (r[_Q_COLS[q-1][1]]||'').trim(); });
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
      if (moves.length) deltas.push({ goal:goal, target:target, statuses:statuses, moves:moves, owner:_cleanOwner(r[5]||'') });
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
    // If live HR fetch is still in flight, render a skeleton and auto-refresh when it lands
    if (!window._hrDataFetched) {
      // Poll until live data arrives, then swap in real widget
      setTimeout(function _pollHR() {
        const hw = document.getElementById('homeDeptWidget');
        // Guard: leaderboard owns this slot — stop polling if it rendered
        if (!hw || document.getElementById('lbWrap')) return;
        if (window._hrDataFetched) {
          try { hw.innerHTML = _buildTermAnalyticsWidget(); } catch(e) {}
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
    <strong>Retention Rate</strong> = Active Staff ÷ Total Headcount for the school year.
    "Total headcount" includes every employee who worked at any point during ${CY} — both currently active and those who have since separated.
    A staff member is counted as <em>separated</em> when their ADP status is no longer "Active."
    <strong>Quarterly retention</strong> is based on when terminations occurred (Q1: Sep–Nov · Q2: Dec–Feb · Q3: Mar–May · Q4: Jun–Aug).
    Voluntary vs. involuntary split is derived from the termination type field in the HR Master List.
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
      var W = doc.internal.pageSize.getWidth();
      var NAVY=[27,42,74], GOLD=[232,168,56], WHITE=[255,255,255], MUTED=[107,114,128];
      var GREEN=[22,163,74], RED=[220,38,38], AMBER=[217,119,6], PURPLE=[109,40,217];

      var activeQs   = qd.activeQs;
      var scorecards = qd.scorecards;
      var deltas     = qd.deltas;
      var latestQ    = activeQs[activeQs.length-1];
      var latestSC   = scorecards[scorecards.length-1];
      var tsStr      = new Date(qd.lastUpdated).toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'});

      function _statusColor(s) {
        if (s==='Met')                     return GREEN;
        if (s==='Partially Met')           return AMBER;
        if (s==='In Progress')             return [37,99,235];
        if (s==='Has Not Met')             return RED;
        if (s==='Coming Down the Pipeline') return PURPLE;
        return MUTED;
      }
      function _short(s){ return (s||'').replace('Coming Down the Pipeline','Pipeline').replace('Partially Met','Partial').replace('In Progress','Progress').replace('Has Not Met','Not Met'); }

      // ── Cover page ────────────────────────────────────────────
      doc.setFillColor(...NAVY); doc.rect(0,0,W,160,'F');
      doc.setFillColor(...GOLD); doc.rect(0,160,W,4,'F');
      doc.setTextColor(...WHITE);
      doc.setFont('helvetica','bold'); doc.setFontSize(22);
      doc.text('NJTC Quarterly Goal Summary', 40, 60);
      doc.setFont('helvetica','normal'); doc.setFontSize(12);
      doc.text('Q' + latestQ + '  \u2014  SY 2025\u20132026', 40, 82);
      doc.setFontSize(9); doc.setTextColor(180,190,200);
      doc.text('Generated ' + tsStr + '  \u00B7  New Jersey Tutoring Corps', 40, 100);
      doc.text('Confidential \u2014 Internal Use Only', 40, 114);

      // Health score pill
      var hColor = latestSC.score>=85?GREEN:latestSC.score>=65?AMBER:latestSC.score>=40?[220,100,38]:RED;
      doc.setFillColor(...hColor); doc.roundedRect(40, 128, 110, 22, 4, 4, 'F');
      doc.setTextColor(...WHITE); doc.setFont('helvetica','bold'); doc.setFontSize(11);
      doc.text(latestSC.score + '%  ' + latestSC.health.label, 95, 142, {align:'center'});

      // ── Stat tiles row ────────────────────────────────────────
      var tiles = [
        {label:'Met',      val:latestSC.counts.met,     color:GREEN},
        {label:'Progress', val:latestSC.counts.prog,    color:[37,99,235]},
        {label:'Partial',  val:latestSC.counts.partial, color:AMBER},
        {label:'Pipeline', val:latestSC.counts.pipe,    color:PURPLE},
        {label:'Not Met',  val:latestSC.counts.notmet,  color:RED},
      ];
      var tW = (W-80)/tiles.length, tY=172;
      tiles.forEach(function(t,i){
        doc.setFillColor(245,247,252); doc.roundedRect(40+i*tW, tY, tW-6, 46, 4, 4, 'F');
        doc.setTextColor(...t.color); doc.setFont('helvetica','bold'); doc.setFontSize(18);
        doc.text(String(t.val), 40+i*tW+(tW-6)/2, tY+22, {align:'center'});
        doc.setTextColor(...MUTED); doc.setFont('helvetica','normal'); doc.setFontSize(7.5);
        doc.text(t.label, 40+i*tW+(tW-6)/2, tY+36, {align:'center'});
      });

      var y = 240;

      // ── Quarter progression table ─────────────────────────────
      if (scorecards.length >= 2) {
        doc.setFont('helvetica','bold'); doc.setFontSize(10); doc.setTextColor(...NAVY);
        doc.text('Quarter-by-Quarter Health Progression', 40, y); y += 14;
        var qRows = scorecards.map(function(sc,i){
          var prev = i>0?scorecards[i-1]:null;
          var delta = prev ? (sc.score - prev.score) : null;
          return [sc.label, sc.score+'%', sc.health.label,
                  sc.counts.met+' Met', sc.counts.prog+' Prog',
                  sc.counts.notmet+' Not Met',
                  delta===null?'Baseline': (delta>=0?'+':'')+delta+'pts'];
        });
        doc.autoTable({
          startY: y, head:[['Quarter','Score','Health','Met','In Progress','Not Met','Change']],
          body: qRows, theme:'grid', headStyles:{fillColor:NAVY,textColor:WHITE,fontSize:8,fontStyle:'bold'},
          bodyStyles:{fontSize:8,textColor:[45,45,45]}, margin:{left:40,right:40},
          columnStyles:{0:{cellWidth:50},1:{cellWidth:46},2:{cellWidth:70},3:{cellWidth:46},4:{cellWidth:64},5:{cellWidth:54},6:{cellWidth:56}},
          didParseCell: function(d){ if(d.section==='body'&&d.column.index===2){ var sc2=scorecards[d.row.index]; if(sc2){ d.cell.styles.textColor=_statusColor(sc2.score>=85?'Met':sc2.score>=65?'Partially Met':sc2.score>=40?'In Progress':'Has Not Met'); }}}
        });
        y = doc.lastAutoTable.finalY + 20;
      }

      // ── Notable improvements ──────────────────────────────────
      var improved = deltas.filter(function(d){ var lm=d.moves[d.moves.length-1]; return lm&&lm.dir==='up'; });
      if (improved.length && y < 650) {
        doc.setFont('helvetica','bold'); doc.setFontSize(10); doc.setTextColor(...NAVY);
        doc.text('Notable Improvements This Cycle  (' + improved.length + ')', 40, y); y += 14;
        doc.autoTable({
          startY:y, head:[['Target','Goal','From \u2192 To']],
          body: improved.slice(0,8).map(function(d){ var lm=d.moves[d.moves.length-1]; return [_safe(d.target.slice(0,70)+(d.target.length>70?'..':'')), _safe(d.goal.split(' ').slice(0,5).join(' ')), _safe(_short(lm.from)+' \u2192 '+_short(lm.to)+' (Q'+lm.fromQ+'\u2192Q'+lm.toQ+')')]; }),
          theme:'striped', headStyles:{fillColor:GREEN,textColor:WHITE,fontSize:8,fontStyle:'bold'},
          bodyStyles:{fontSize:7.5,textColor:[45,45,45]}, margin:{left:40,right:40},
          columnStyles:{0:{cellWidth:230},1:{cellWidth:140},2:{cellWidth:110}}
        });
        y = doc.lastAutoTable.finalY + 20;
      }

      // ── Critical regressions ──────────────────────────────────
      var critical = deltas.filter(function(d){ return d.moves.some(function(m){ return m.to==='Has Not Met'; }); });
      if (critical.length && y < 650) {
        if (y > 650) { doc.addPage(); y = 60; }
        doc.setFont('helvetica','bold'); doc.setFontSize(10); doc.setTextColor(...RED);
        doc.text('Critical Regressions  (' + critical.length + ')', 40, y); y += 14;
        doc.autoTable({
          startY:y, head:[['Target','Goal','Transition']],
          body: critical.map(function(d){ var cm=d.moves.filter(function(m){ return m.to==='Has Not Met'; })[0]; return [_safe(d.target.slice(0,70)+(d.target.length>70?'..':'')), _safe(d.goal.split(' ').slice(0,5).join(' ')), cm?_safe(_short(cm.from)+' \u2192 Not Met (Q'+cm.fromQ+'\u2192Q'+cm.toQ+')'):'—']; }),
          theme:'striped', headStyles:{fillColor:RED,textColor:WHITE,fontSize:8,fontStyle:'bold'},
          bodyStyles:{fontSize:7.5,textColor:[45,45,45]}, margin:{left:40,right:40},
          columnStyles:{0:{cellWidth:230},1:{cellWidth:140},2:{cellWidth:110}}
        });
        y = doc.lastAutoTable.finalY + 20;
      }

      // ── Full cross-quarter table (new page) ───────────────────
      doc.addPage();
      doc.setFillColor(...NAVY); doc.rect(0,0,W,40,'F');
      doc.setTextColor(...WHITE); doc.setFont('helvetica','bold'); doc.setFontSize(12);
      doc.text('Full Cross-Quarter Target Status  \u2014  All Goal Areas', 40, 26);
      y = 60;

      var goalOrder=[], goalGroups={};
      qd.rows.forEach(function(r){ var g=(r[0]||'').trim(),t=(r[1]||'').trim(); if(!g||!t) return; if(goalOrder.indexOf(g)<0) goalOrder.push(g); if(!goalGroups[g]) goalGroups[g]=[]; goalGroups[g].push(r); });

      var qHeaders = ['Target'].concat(activeQs.map(function(q){ return 'Q'+q; }));
      var allBodyRows = [];
      goalOrder.forEach(function(goal) {
        allBodyRows.push([{content:goal, colSpan:qHeaders.length, styles:{fillColor:NAVY,textColor:WHITE,fontStyle:'bold',fontSize:8}}]);
        goalGroups[goal].forEach(function(r){
          var row = [_safe(r[1]||'').slice(0,80)];
          activeQs.forEach(function(q){ row.push(_short((r[_Q_COLS[q-1][1]]||'').trim())||'—'); });
          allBodyRows.push(row);
        });
      });

      var colWidths = {0:{cellWidth:260}};
      activeQs.forEach(function(q,i){ colWidths[i+1]={cellWidth:Math.floor((W-80-260)/activeQs.length)}; });

      doc.autoTable({
        startY:y, head:[qHeaders], body:allBodyRows, theme:'grid',
        headStyles:{fillColor:NAVY,textColor:WHITE,fontSize:8,fontStyle:'bold'},
        bodyStyles:{fontSize:7,textColor:[45,45,45]}, margin:{left:40,right:40},
        columnStyles:colWidths,
        didParseCell:function(d){
          if(d.section==='body'&&!d.row.raw[0]?.styles){
            var colIdx=d.column.index;
            if(colIdx>0){ var s=d.cell.raw||''; d.cell.styles.textColor=_statusColor(activeQs[colIdx-1]&&(s==='Met'?'Met':s==='Partial'?'Partially Met':s==='Progress'?'In Progress':s==='Not Met'?'Has Not Met':s==='Pipeline'?'Coming Down the Pipeline':s)||''); }
          }
        }
      });

      // ── Footer on every page ──────────────────────────────────
      var pageCount = doc.internal.getNumberOfPages();
      for (var pg=1;pg<=pageCount;pg++) {
        doc.setPage(pg);
        doc.setFillColor(...NAVY); doc.rect(0,doc.internal.pageSize.getHeight()-28,W,28,'F');
        doc.setTextColor(...WHITE); doc.setFont('helvetica','normal'); doc.setFontSize(7.5);
        doc.text('New Jersey Tutoring Corps  \u00B7  Quarterly Summary  \u00B7  SY 2025\u20132026  \u00B7  Confidential', 40, doc.internal.pageSize.getHeight()-12);
        doc.text('Page '+pg+' of '+pageCount, W-40, doc.internal.pageSize.getHeight()-12, {align:'right'});
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
    function _short(s){ return (s||'').replace('Coming Down the Pipeline','Pipeline').replace('Partially Met','Partial').replace('In Progress','Progress').replace('Has Not Met','Not Met'); }
    function _statusHex(s){
      if(s==='Met')return'166534'; if(s==='Partially Met')return'B45309';
      if(s==='In Progress')return'1E40AF'; if(s==='Has Not Met')return'991B1B';
      if(s==='Coming Down the Pipeline')return'6D28D9'; return'6B7280';
    }

    _loadPptxGen(function() {
      var pptx = new window.PptxGenJS();
      pptx.layout   = 'LAYOUT_WIDE';
      pptx.author   = 'New Jersey Tutoring Corps';
      pptx.subject  = 'Quarterly Goal Summary';
      pptx.title    = 'NJTC Quarterly Summary Q' + qd.activeQs[qd.activeQs.length-1] + ' SY2025-26';
      pptx.company  = 'NJTC';

      var NAVY='1B2A4A', GOLD='E8A838', WHITE='FFFFFF', LIGHT='F7F9FC';
      var GREEN='16A34A', RED='DC2626', AMBER='D97706', PURPLE='7C3AED', BLUE='1E40AF';
      var latestQ  = qd.activeQs[qd.activeQs.length-1];
      var latestSC = qd.scorecards[qd.scorecards.length-1];
      var deltas   = qd.deltas;
      var tsStr    = new Date(qd.lastUpdated).toLocaleDateString('en-US',{month:'long',year:'numeric'});
      var hHex     = latestSC.score>=85?GREEN:latestSC.score>=65?AMBER:latestSC.score>=40?'DC6502':RED;

      // ── Slide 1: Cover ─────────────────────────────────────────
      var s1 = pptx.addSlide();
      s1.addShape(pptx.ShapeType.rect,{x:0,y:0,w:'100%',h:'100%',fill:{color:NAVY}});
      s1.addShape(pptx.ShapeType.rect,{x:0,y:3.8,w:'100%',h:0.06,fill:{color:GOLD}});
      s1.addText('NJTC',{x:0.5,y:0.4,w:9,h:0.5,fontSize:13,bold:true,color:GOLD,fontFace:'Arial'});
      s1.addText('Quarterly Goal Summary',{x:0.5,y:1.0,w:9,h:1.0,fontSize:36,bold:true,color:WHITE,fontFace:'Arial'});
      s1.addText('Q'+latestQ+' \u2014 School Year 2025\u20132026',{x:0.5,y:2.05,w:9,h:0.5,fontSize:18,color:GOLD,fontFace:'Arial'});
      s1.addText('Generated '+tsStr+'   \u00B7   New Jersey Tutoring Corps   \u00B7   Confidential',{x:0.5,y:2.7,w:9,h:0.35,fontSize:10,color:'B0BAC8',fontFace:'Arial'});
      // Health score box
      s1.addShape(pptx.ShapeType.roundRect,{x:0.5,y:3.2,w:2.2,h:0.5,fill:{color:hHex},line:{color:hHex},rectRadius:0.06});
      s1.addText(latestSC.score+'%  '+latestSC.health.label,{x:0.5,y:3.2,w:2.2,h:0.5,fontSize:13,bold:true,color:WHITE,align:'center',fontFace:'Arial'});

      // ── Slide 2: Summary Stats ─────────────────────────────────
      var s2 = pptx.addSlide();
      s2.addShape(pptx.ShapeType.rect,{x:0,y:0,w:'100%',h:1.1,fill:{color:NAVY}});
      s2.addText('Q'+latestQ+' At a Glance \u2014 Organizational Target Status',{x:0.4,y:0.2,w:9,h:0.7,fontSize:20,bold:true,color:WHITE,fontFace:'Arial'});
      var stats=[
        {label:'Met',      val:latestSC.counts.met,     hex:GREEN},
        {label:'In Progress',val:latestSC.counts.prog,  hex:BLUE},
        {label:'Partial',  val:latestSC.counts.partial, hex:AMBER},
        {label:'Pipeline', val:latestSC.counts.pipe,    hex:PURPLE},
        {label:'Not Met',  val:latestSC.counts.notmet,  hex:RED},
      ];
      stats.forEach(function(st,i){
        var cx=0.4+i*1.96, cy=1.4;
        s2.addShape(pptx.ShapeType.roundRect,{x:cx,y:cy,w:1.8,h:1.6,fill:{color:'F7F9FC'},line:{color:'E2E8F0',pt:1},rectRadius:0.08});
        s2.addText(String(st.val),{x:cx,y:cy+0.2,w:1.8,h:0.7,fontSize:32,bold:true,color:st.hex,align:'center',fontFace:'Arial'});
        s2.addText(st.label,{x:cx,y:cy+0.95,w:1.8,h:0.35,fontSize:10,bold:true,color:'334155',align:'center',fontFace:'Arial'});
      });
      // Health bar
      var barY=3.3;
      s2.addText('Organizational Health Score: '+latestSC.score+'%  ('+latestSC.health.label+')',{x:0.4,y:barY,w:9,h:0.4,fontSize:13,bold:true,color:NAVY,fontFace:'Arial'});
      s2.addShape(pptx.ShapeType.rect,{x:0.4,y:barY+0.45,w:9,h:0.22,fill:{color:'E2E8F0'}});
      s2.addShape(pptx.ShapeType.rect,{x:0.4,y:barY+0.45,w:9*(latestSC.score/100),h:0.22,fill:{color:hHex}});
      s2.addText('Scoring: Met=100pts  Partial=50pts  In Progress=25pts  Pipeline=10pts  Not Met=0pts',{x:0.4,y:barY+0.82,w:9,h:0.3,fontSize:8,color:'6B7280',fontFace:'Arial'});

      // ── Slide 3: Quarter Progression (if 2+ quarters) ─────────
      if (qd.scorecards.length >= 2) {
        var s3 = pptx.addSlide();
        s3.addShape(pptx.ShapeType.rect,{x:0,y:0,w:'100%',h:1.1,fill:{color:NAVY}});
        s3.addText('Quarter-by-Quarter Progression \u2014 SY 2025\u20132026',{x:0.4,y:0.2,w:9,h:0.7,fontSize:20,bold:true,color:WHITE,fontFace:'Arial'});
        var rows3=[['Quarter','Health Score','Health Label','Met','In Progress','Partial','Not Met','Change']];
        qd.scorecards.forEach(function(sc,i){
          var prev=i>0?qd.scorecards[i-1]:null;
          var delta=prev?(sc.score-prev.score):null;
          rows3.push([sc.label, sc.score+'%', sc.health.label, String(sc.counts.met), String(sc.counts.prog), String(sc.counts.partial), String(sc.counts.notmet), delta===null?'Baseline':(delta>=0?'+':'')+delta+'pts']);
        });
        s3.addTable(rows3,{x:0.4,y:1.25,w:9,colW:[0.9,1.0,1.1,0.7,1.0,0.7,0.7,1.0],
          border:{type:'solid',color:'E2E8F0',pt:0.5},
          autoPage:false,
          firstRowAsHeader:true,
          headFontSize:9,headBold:true,headFill:{color:NAVY},headColor:WHITE,
          bodyFontSize:9,bodyColor:'1E293B',
          bodyFill:{color:LIGHT}
        });
      }

      // ── Slide 4: Major Improvements ───────────────────────────
      var improved=deltas.filter(function(d){ var lm=d.moves[d.moves.length-1]; return lm&&lm.dir==='up'; });
      if (improved.length) {
        var s4 = pptx.addSlide();
        s4.addShape(pptx.ShapeType.rect,{x:0,y:0,w:'100%',h:1.1,fill:{color:GREEN}});
        s4.addText('\uD83C\uDFC6  Notable Improvements This Cycle  ('+improved.length+' targets)',{x:0.4,y:0.25,w:9,h:0.65,fontSize:18,bold:true,color:WHITE,fontFace:'Arial'});
        var rows4=[['Target','Goal Area','From','To','Quarters']];
        improved.slice(0,10).forEach(function(d){
          var lm=d.moves[d.moves.length-1];
          rows4.push([_safe(d.target).slice(0,75),_safe(d.goal).slice(0,40),_short(lm.from),_short(lm.to),'Q'+lm.fromQ+'\u2192Q'+lm.toQ]);
        });
        s4.addTable(rows4,{x:0.4,y:1.2,w:9,colW:[3.0,2.0,1.2,1.2,0.9],
          border:{type:'solid',color:'E2E8F0',pt:0.5},autoPage:true,
          headFontSize:9,headBold:true,headFill:{color:GREEN},headColor:WHITE,
          bodyFontSize:8,bodyColor:'1E293B',bodyFill:{color:LIGHT}
        });
      }

      // ── Slide 5: Critical Regressions ─────────────────────────
      var critical=deltas.filter(function(d){ return d.moves.some(function(m){ return m.to==='Has Not Met'; }); });
      var otherReg=deltas.filter(function(d){ var lm=d.moves[d.moves.length-1]; return lm&&lm.dir==='down'&&lm.to!=='Has Not Met'; });
      if (critical.length || otherReg.length) {
        var s5 = pptx.addSlide();
        s5.addShape(pptx.ShapeType.rect,{x:0,y:0,w:'100%',h:1.1,fill:{color:RED}});
        s5.addText('\u26A0\uFE0F  Status Regressions \u2014 Needs Leadership Attention',{x:0.4,y:0.25,w:9,h:0.65,fontSize:18,bold:true,color:WHITE,fontFace:'Arial'});
        var rows5=[['Target','Goal Area','From','To','Type']];
        critical.forEach(function(d){ var cm=d.moves.filter(function(m){ return m.to==='Has Not Met'; })[0]; if(!cm) return; rows5.push([_safe(d.target).slice(0,65),_safe(d.goal).slice(0,35),_short(cm.from),'Not Met','Critical']); });
        otherReg.slice(0,6).forEach(function(d){ var lm=d.moves[d.moves.length-1]; rows5.push([_safe(d.target).slice(0,65),_safe(d.goal).slice(0,35),_short(lm.from),_short(lm.to),'Watch']); });
        s5.addTable(rows5,{x:0.4,y:1.2,w:9,colW:[2.9,1.9,1.2,1.2,0.9],
          border:{type:'solid',color:'E2E8F0',pt:0.5},autoPage:true,
          headFontSize:9,headBold:true,headFill:{color:RED},headColor:WHITE,
          bodyFontSize:8,bodyColor:'1E293B',bodyFill:{color:LIGHT}
        });
      }

      // ── Slide 6: Goal Area Scorecard ──────────────────────────
      var goalOrder2=[], goalGroups2={};
      qd.rows.forEach(function(r){ var g=(r[0]||'').trim(),t=(r[1]||'').trim(); if(!g||!t) return; if(goalOrder2.indexOf(g)<0) goalOrder2.push(g); if(!goalGroups2[g]) goalGroups2[g]=[]; goalGroups2[g].push(r); });

      var s6 = pptx.addSlide();
      s6.addShape(pptx.ShapeType.rect,{x:0,y:0,w:'100%',h:1.1,fill:{color:NAVY}});
      s6.addText('Goal Area Scorecard \u2014 Q'+latestQ,{x:0.4,y:0.25,w:9,h:0.65,fontSize:20,bold:true,color:WHITE,fontFace:'Arial'});
      var rows6=[['Goal Area','Targets','Met','In Prog','Partial','Not Met','Score','Health']];
      goalOrder2.forEach(function(goal){
        var rs=goalGroups2[goal];
        var sc=_Q_COLS[latestQ-1][1];
        var cnt={met:0,prog:0,part:0,nm:0,pipe:0};
        var sum=0;
        rs.forEach(function(r){ var s=(r[sc]||'').trim(); if(s==='Met'){cnt.met++;sum+=1;} else if(s==='Partially Met'){cnt.part++;sum+=0.5;} else if(s==='In Progress'){cnt.prog++;sum+=0.25;} else if(s==='Has Not Met'){cnt.nm++;} else if(s==='Coming Down the Pipeline'){cnt.pipe++;sum+=0.1;} });
        var pct=rs.length?Math.round(sum/rs.length*100):0;
        var hl=pct>=85?'Healthy':pct>=65?'Watch':pct>=40?'Needs Focus':'Critical';
        rows6.push([_safe(goal).slice(0,40),String(rs.length),String(cnt.met),String(cnt.prog),String(cnt.part),String(cnt.nm),pct+'%',hl]);
      });
      s6.addTable(rows6,{x:0.4,y:1.2,w:9,colW:[2.8,0.65,0.65,0.7,0.65,0.7,0.65,0.8],
        border:{type:'solid',color:'E2E8F0',pt:0.5},autoPage:true,
        headFontSize:9,headBold:true,headFill:{color:NAVY},headColor:WHITE,
        bodyFontSize:8,bodyColor:'1E293B',bodyFill:{color:LIGHT}
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

  window.exportKPIQuarterlySummaryPDF  = exportKPIQuarterlySummaryPDF;
  window.exportKPIQuarterlySummaryPPTX = exportKPIQuarterlySummaryPPTX;
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
  window._buildTermAnalyticsWidget = _buildTermAnalyticsWidget;  // HR & Data home widget
  window._buildRetentionWidget     = _buildRetentionWidget;      // Programming home widget

})();
