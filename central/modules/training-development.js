(function() {

  function renderTrainingReviews() {
    const total = REVIEWS.length;
    if (!total) return '<div style="padding:2rem;text-align:center;color:var(--muted)">No site leader review data available.</div>';

    const d23Meets  = REVIEWS.filter(r => r.d23 && r.d23.includes('Meets') && !r.d23.includes('Partial')).length;
    const d23Part   = REVIEWS.filter(r => r.d23 && r.d23.includes('Partially')).length;
    const d1Part    = REVIEWS.filter(r => r.d1  && r.d1.includes('Partially')).length;
    const d4Part    = REVIEWS.filter(r => r.d4  && r.d4.includes('Partially')).length;
    const allMeets  = REVIEWS.filter(r =>
      r.d1.includes('Meets') && !r.d1.includes('Partial') &&
      r.d23.includes('Meets') && !r.d23.includes('Partial') &&
      r.d4.includes('Meets') && !r.d4.includes('Partial')
    ).length;
    const needsPD   = REVIEWS.filter(r => r.d1.includes('Partially') || r.d23.includes('Partially') || r.d4.includes('Partially'));
    const uniqueSites = [...new Set(REVIEWS.map(r => r.site))].length;

    const domColor = d => d && d.includes('Partially') ? '#92400e' : d && d.includes('N/A') ? '#64748b' : '#166534';
    const domBg    = d => d && d.includes('Partially') ? '#fffbeb' : d && d.includes('N/A') ? '#f8fafc' : '#f0fdf4';
    const domShort = d => d ? d.replace('Expectations','').replace('Meets','✅ Meets').replace('Partially','⚠️ Partially').replace('N/A','—').trim() : '—';

    let html = `<div style="padding:.25rem 0">`;

    // Training-specific framing: focus is PD deployment and instructional coaching
    html += `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:.6rem;margin-bottom:1.25rem">
      ${[
        { label:'Reviews Completed', val: total, color:'#1d4ed8' },
        { label:'All Domains: Meets', val: allMeets, color: allMeets===total?'#059669':'#d97706' },
        { label:'PD Deployment Needed', val: needsPD.length, color: needsPD.length>0?'#b91c1c':'#059669' },
        { label:'Sites Reviewed', val: uniqueSites, color:'#7c3aed' },
        { label:'D2&3 Instruction — Meets', val: Math.round(d23Meets/total*100)+'%', color: d23Part>0?'#d97706':'#059669' },
        { label:'D2&3 Instruction — Partial', val: d23Part, color: d23Part>0?'#b91c1c':'#059669' },
        { label:'D1 Planning — Partial', val: d1Part, color: d1Part>0?'#d97706':'#059669' },
      ].map(s=>`<div style="background:#fff;border:1px solid #e2e8f0;border-radius:8px;padding:.6rem .75rem;text-align:center">
        <div style="font-size:1.2rem;font-weight:800;color:${s.color}">${s.val}</div>
        <div style="font-size:.68rem;color:#64748b;text-transform:uppercase;letter-spacing:.04em;margin-top:1px">${s.label}</div>
      </div>`).join('')}
    </div>`;

    // Training lens: PD recommendations
    if (needsPD.length) {
      html += `<div class="ta-alert-strip" style="margin-bottom:1rem"><div class="ta-alert-icon">🎯</div><div>
        <div class="ta-alert-title">PD Deployment Recommended — ${needsPD.length} site leader${needsPD.length>1?'s':''} rated "Partially Meets" in at least one domain</div>
        <div class="ta-alert-body" style="margin-top:.3rem">
          ${needsPD.map(r=>{
            const gaps = [];
            if (r.d1.includes('Partially'))  gaps.push('D1: Planning');
            if (r.d23.includes('Partially')) gaps.push('D2&3: Instruction');
            if (r.d4.includes('Partially'))  gaps.push('D4: Professionalism');
            return `<strong>${r.leader}</strong> (${r.site}, ${r.month}) — Gap areas: ${gaps.join(', ')}`;
          }).join('<br>')}
        </div>
      </div></div>`;
    } else {
      html += `<div style="padding:.6rem 1rem;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;margin-bottom:1rem;font-size:.8rem;color:#166534">
        ✅ All reviewed site leaders are meeting expectations across all domains. No PD deployment triggered at this time.
      </div>`;
    }

    // Domain breakdown — Training framing focuses on instructional coaching capacity
    html += `<div class="ta-grid ta-grid-3" style="margin-bottom:1.25rem">`;
    const domains = [
      { key:'d1',  label:'Domain 1: Planning',               desc:'Curriculum alignment, lesson plan quality, and pacing strategy' },
      { key:'d23', label:'Domain 2&3: Instruction',           desc:'Core instructional delivery — primary Training & Development focus for PD deployment' },
      { key:'d4',  label:'Domain 4: Professionalism',         desc:'Conduct, communication standards, and site partnership norms' },
    ];
    domains.forEach(dom => {
      const meets   = REVIEWS.filter(r => r[dom.key] && r[dom.key].includes('Meets') && !r[dom.key].includes('Partial')).length;
      const part    = REVIEWS.filter(r => r[dom.key] && r[dom.key].includes('Partially')).length;
      const pct     = total ? Math.round(meets/total*100) : 0;
      const barColor = part > 0 ? '#f59e0b' : '#10b981';
      html += `<div class="ta-card">
        <div class="ta-card-title">${dom.label}</div>
        <div style="font-size:.75rem;color:#64748b;margin-bottom:.75rem">${dom.desc}</div>
        <div style="display:flex;align-items:center;gap:.5rem;margin-bottom:.4rem">
          <div style="flex:1;height:8px;background:#e2e8f0;border-radius:4px;overflow:hidden">
            <div style="width:${pct}%;height:100%;background:${barColor};border-radius:4px"></div>
          </div>
          <span style="font-size:.8rem;font-weight:700;color:${barColor};min-width:2.5rem">${pct}%</span>
        </div>
        <div style="font-size:.72rem;color:#64748b">${meets} of ${total} site leaders — Meets Expectations</div>
        ${part > 0 ? `<div style="margin-top:.4rem;padding:.3rem .5rem;background:#fffbeb;border-radius:4px;font-size:.7rem;color:#92400e">⚠️ ${part} leader${part>1?'s':''} Partially Meets — targeted PD or coaching support recommended</div>` : `<div style="margin-top:.4rem;padding:.3rem .5rem;background:#f0fdf4;border-radius:4px;font-size:.7rem;color:#166534">✅ No coaching gaps in this domain</div>`}
      </div>`;
    });
    html += `</div>`;

    // Full review log
    const sorted = REVIEWS.slice().sort((a,b) => new Date(b.ts)-new Date(a.ts));
    html += `<div class="ta-card"><div class="ta-card-title">📋 Site Leader Review Log — Training & Development View</div>
      <div style="overflow-x:auto"><table class="ta-table">
        <thead><tr><th>Leader</th><th>Site</th><th>Month</th><th>D1: Planning</th><th>D2&3: Instruction</th><th>D4: Professionalism</th><th>PD Needed?</th></tr></thead>
        <tbody>${sorted.map(r=>{
          const needsPDRow = r.d1.includes('Partially') || r.d23.includes('Partially') || r.d4.includes('Partially');
          return `<tr>
            <td><strong>${r.leader}</strong></td>
            <td style="font-size:.75rem">${r.site}</td>
            <td style="font-size:.75rem;white-space:nowrap">${r.month}</td>
            ${['d1','d23','d4'].map(dom=>`<td><span style="padding:.1rem .4rem;border-radius:4px;font-size:.67rem;font-weight:600;background:${domBg(r[dom])};color:${domColor(r[dom])}">${domShort(r[dom])}</span></td>`).join('')}
            <td><span style="padding:.1rem .4rem;border-radius:4px;font-size:.67rem;font-weight:600;background:${needsPDRow?'#fffbeb':'#f0fdf4'};color:${needsPDRow?'#92400e':'#166534'}">${needsPDRow?'⚠️ Yes':'✅ No'}</span></td>
          </tr>`;
        }).join('')}</tbody>
      </table></div>
    </div>`;

    html += `</div>`;
    return html;
  }


  function renderTrainingAnalytics() {
    const data = CONCERNS;
    const yr = window.__yrFilter_trainingAnalyticsContent || 'all';
    const filtered = yr === 'all' ? data : filterByYear(data, yr);
    if (!filtered.length) return `<div style="padding:3rem;text-align:center;color:var(--muted)">No data for selected period.</div>`;

    const total    = filtered.length;
    const lpCount  = filtered.filter(r => r.concern_type === 'Lesson Plans' || (r.concern_label||'').toLowerCase().includes('lesson')).length;
    const ldCount  = filtered.filter(r => r.concern_type === 'Overall Lesson Delivery').length;
    const attCount = filtered.filter(r => r.concern_type === 'Attendance').length;
    const tcCount  = filtered.filter(r => r.concern_type === 'Timecard incident').length;
    const otherCount = total - lpCount - ldCount - attCount - tcCount;
    const byDistrict = countBy(filtered, 'site');

    // PD need mapping
    const pdMap = [
      { category:'Lesson Planning Compliance', count:lpCount, pct:Math.round(lpCount/total*100), pd:'Lesson Plan Workshop · Submission Process Training', urgency: lpCount/total>0.3?'High':'Medium' },
      { category:'Instructional Delivery Quality', count:ldCount, pct:Math.round(ldCount/total*100), pd:'Instructional Coaching · Model Lessons · Video Analysis', urgency: ldCount>5?'High':'Low' },
      { category:'Attendance & Reliability', count:attCount, pct:Math.round(attCount/total*100), pd:'Expectations Refresher · Accountability Systems', urgency: attCount>10?'High':'Medium' },
      { category:'Timecard/Compliance', count:tcCount, pct:Math.round(tcCount/total*100), pd:'Payroll & Timecard Process Training', urgency: tcCount>3?'Medium':'Low' },
      { category:'Other / Site-Specific', count:otherCount, pct:Math.round(otherCount/total*100), pd:'Needs Assessment at Site Level', urgency:'Low' },
    ].filter(r => r.count > 0).sort((a,b)=>b.count-a.count);

    let html = `${goalAlignmentBadges('training')}
    <div style="font-size:.8125rem;color:var(--muted);margin-bottom:1.25rem;padding:.75rem 1rem;background:var(--surface);border-radius:8px;border:1px solid var(--border)">
      ℹ️ Training view shows <strong>aggregated skill gap indicators only</strong> — no individual employee names. Use this to plan PD calendar and targeted intervention sessions.
    </div>`;

    html += `<div class="ta-grid ta-grid-3" style="margin-bottom:1.25rem">
      <div class="ta-card ta-kpi ${lpCount/total>0.3?'alert':'warning'}"><div class="ta-kpi-val">${lpCount}</div><div class="ta-kpi-sub">Lesson Plan Gaps<br><span style="font-size:.7rem">(${Math.round(lpCount/total*100)}% of concerns)</span></div></div>
      <div class="ta-card ta-kpi ${ldCount>5?'warning':'ok'}"><div class="ta-kpi-val">${ldCount}</div><div class="ta-kpi-sub">Delivery Quality Issues<br><span style="font-size:.7rem">Instructional coaching needed</span></div></div>
      <div class="ta-card ta-kpi ok"><div class="ta-kpi-val">${REVIEWS.length}</div><div class="ta-kpi-sub">Site Leader Reviews<br><span style="font-size:.7rem">Performance observations</span></div></div>
    </div>`;

    // PD needs table
    html += `<div class="ta-card" style="margin-bottom:1rem">
      <div class="ta-card-title">📚 PD Needs Map — Concern Category → Intervention</div>
      <table class="ta-table">
        <thead><tr><th>Skill Gap Category</th><th>Cases</th><th>% of Total</th><th>Recommended PD Intervention</th><th>Urgency</th></tr></thead>
        <tbody>
        ${pdMap.map(r => {
          const urgColor = r.urgency==='High'?'concern-writeup':r.urgency==='Medium'?'concern-warn':'concern-no';
          return `<tr>
            <td><strong>${r.category}</strong></td>
            <td style="font-weight:700">${r.count}</td>
            <td>
              <div style="display:flex;align-items:center;gap:.5rem">
                <div style="flex:1;height:6px;background:var(--surface);border-radius:3px"><div style="height:100%;width:${r.pct}%;background:#e76f51;border-radius:3px"></div></div>
                <span style="font-size:.8rem;font-weight:700">${r.pct}%</span>
              </div>
            </td>
            <td style="font-size:.8rem">${r.pd}</td>
            <td><span class="concern-pill ${urgColor}">${r.urgency}</span></td>
          </tr>`;
        }).join('')}
        </tbody>
      </table>
    </div>`;

    // District skill gap heatmap (aggregated)
    html += `<div class="ta-card" style="margin-bottom:1rem">
      <div class="ta-card-title">🗺 District Skill Gap Distribution</div>
      <div style="font-size:.8125rem;color:var(--muted);margin-bottom:.75rem">Concern volume by district indicates where targeted PD deployment would have the highest impact. High-volume districts should be prioritized for on-site PD sessions.</div>
      ${barRows(byDistrict.slice(0,8), byDistrict[0]?.[1]||1, '#e76f51')}
    </div>`;

    // Site leader domain analysis
    const partialD23 = REVIEWS.filter(r => r.d23.includes('Partially') || r.d1.includes('Partially') || r.d4.includes('Partially'));
    html += `<div class="ta-card">
      <div class="ta-card-title">⭐ Site Leader Competency Signals — PD Priority Areas</div>
      <div class="ta-grid ta-grid-3" style="margin-top:.75rem">
        ${['d1','d23','d4'].map((domain, i) => {
          const labels = ['Domain 1\nPlanning & Prep','Domain 2&3\nInstruction & Environment','Domain 4\nProfessionalism'];
          const meets  = REVIEWS.filter(r => r[domain].includes('Meets') && !r[domain].includes('Partial')).length;
          const partial = REVIEWS.filter(r => r[domain].includes('Partially')).length;
          const pct = REVIEWS.length ? Math.round(meets/REVIEWS.length*100) : 0;
          return `<div style="padding:.875rem;background:${pct>=90?'#f0fdf4':pct>=70?'#fff7ed':'#fef2f2'};border-radius:8px;text-align:center">
            <div style="font-size:1.75rem;font-weight:800;color:${pct>=90?'#065f46':pct>=70?'#92400e':'#991b1b'}">${pct}%</div>
            <div style="font-size:.75rem;font-weight:700;white-space:pre-line">${labels[i]}</div>
            ${partial>0?`<div style="font-size:.7rem;color:#92400e;margin-top:.25rem">⚠️ ${partial} needs coaching</div>`:'<div style="font-size:.7rem;color:#065f46;margin-top:.25rem">✅ All meeting standard</div>'}
          </div>`;
        }).join('')}
      </div>
      ${partialD23.length?`<div style="margin-top:.875rem;padding:.75rem;background:#fff7ed;border-radius:8px;font-size:.8125rem;color:#92400e">
        ⚠️ ${partialD23.length} site leader(s) rated "Partially Meets" in at least one domain. Consider targeted coaching or T&D resource deployment to these sites.
      </div>`:''}
    </div>`;
    return html;
  }

  // ════════════════════════════════════════════════════════════════
  //  TALENT PANEL ROUTER — dept-aware tab + render logic
  // ════════════════════════════════════════════════════════════════

  function buildTrainingAnalytics() {
    const el = document.getElementById('trainingAnalyticsContent');
    if (!el) return;
    el.innerHTML = '';
    addYearFilter('trainingAnalyticsContent', () => {
      el.querySelectorAll('[data-training-content]').forEach(e => e.remove());
      const c = document.createElement('div');
      c.setAttribute('data-training-content','1');
      c.innerHTML = renderTrainingAnalytics();
      el.appendChild(c);
    }, true);
    const c = document.createElement('div');
    c.setAttribute('data-training-content','1');
    c.innerHTML = renderTrainingAnalytics();
    el.appendChild(c);
  }


  // ── Expose to global scope ───────────────────────────────────────────────
  window.renderTrainingReviews   = renderTrainingReviews;
  window.renderTrainingAnalytics = renderTrainingAnalytics;
  window.buildTrainingAnalytics  = buildTrainingAnalytics;

})();
