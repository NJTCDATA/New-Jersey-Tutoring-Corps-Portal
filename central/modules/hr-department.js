(function() {

  function renderTalentReviews() {
    const total=REVIEWS.length; if (!total) return '<div style="padding:2rem;text-align:center;color:var(--muted)">No review data.</div>';
    const d1Total=REVIEWS.filter(r=>r.d1.includes('Meets')&&!r.d1.includes('Partial')).length;
    const d23Total=REVIEWS.filter(r=>r.d23.includes('Meets')&&!r.d23.includes('Partial')).length;
    const d4Total=REVIEWS.filter(r=>r.d4.includes('Meets')&&!r.d4.includes('Partial')).length;
    const partial=REVIEWS.filter(r=>r.d23.includes('Partially')||r.d1.includes('Partially')||r.d4.includes('Partially'));
    let html=`<div class="ta-grid ta-grid-4" style="margin-bottom:1.25rem">
      <div class="ta-card ta-kpi ok"><div class="ta-kpi-val">${total}</div><div class="ta-kpi-sub">Reviews Completed</div></div>
      <div class="ta-card ta-kpi ${d1Total===total?'ok':'warning'}"><div class="ta-kpi-val">${Math.round(d1Total/total*100)}%</div><div class="ta-kpi-sub">Domain 1 — Planning</div></div>
      <div class="ta-card ta-kpi ${d23Total>=total*.95?'ok':'warning'}"><div class="ta-kpi-val">${Math.round(d23Total/total*100)}%</div><div class="ta-kpi-sub">Domain 2&3 — Instruction</div></div>
      <div class="ta-card ta-kpi ${d4Total===total?'ok':'warning'}"><div class="ta-kpi-val">${Math.round(d4Total/total*100)}%</div><div class="ta-kpi-sub">Domain 4 — Professionalism</div></div>
    </div>`;
    if (partial.length) html+=`<div class="ta-alert-strip"><div class="ta-alert-icon">⚠️</div><div><div class="ta-alert-title">🟡 ${partial.length} site leader(s) "Partially Meets" — coaching needed</div><div class="ta-alert-body">${partial.map(r=>`<strong>${r.leader}</strong> (${r.site}, ${r.month})`).join('; ')}</div></div></div>`;
    html+=`<div class="ta-grid ta-grid-2" style="margin-bottom:1rem">
      <div class="ta-card"><div class="ta-card-title">📍 Reviews by District</div>${barRows(countBy(REVIEWS,'site').slice(0,8),total,'#2a9d8f')}</div>
      <div class="ta-card"><div class="ta-card-title">👤 Reviews by PM/APM</div>${barRows(countBy(REVIEWS,'pm').slice(0,8),total,'#457b9d')}</div>
    </div>`;
    html+=`<div class="ta-card"><div class="ta-card-title">📋 Site Leader Review Log</div><div style="overflow-x:auto"><table class="ta-table">
      <thead><tr><th>Leader</th><th>District</th><th>PM</th><th>Month</th><th>D1</th><th>D2&3</th><th>D4</th></tr></thead>
      <tbody>${REVIEWS.map(r=>`<tr>
        <td><strong>${r.leader}</strong></td><td style="font-size:.75rem">${r.site}</td>
        <td style="font-size:.75rem">${r.pm}</td><td style="font-size:.75rem">${r.month}</td>
        ${['d1','d23','d4'].map(dom=>`<td><span class="concern-pill ${r[dom].includes('Partially')?'concern-warn':'concern-no'}" style="font-size:.65rem">${r[dom].replace('Expectations','').trim()}</span></td>`).join('')}
      </tr>`).join('')}</tbody>
    </table></div></div>`;
    return html;
  }
  function renderTalentLog() {
    const data=_filteredConcerns.slice().sort((a,b)=>new Date(b.ts)-new Date(a.ts));
    if (!data.length) return '<div style="padding:3rem;text-align:center;color:var(--muted)">No records match filters.</div>';
    return `<div class="ta-card">
      <div class="ta-card-title">📋 Full Concern Log (${data.length} records)</div>
      <div style="overflow-x:auto"><table class="ta-table">
        <thead><tr><th>Date</th><th>Employee</th><th>Role</th><th>District</th><th>Concern</th><th>Support</th><th>HR Action</th><th>First?</th></tr></thead>
        <tbody>${data.map(r=>`<tr>
          <td style="font-size:.72rem;white-space:nowrap">${r.ts.split(' ')[0]}</td>
          <td><strong style="font-size:.78rem">${r.emp||'—'}</strong></td>
          <td><span class="dept-tag dept-tag-prog" style="font-size:.65rem">${r.role||'—'}</span></td>
          <td style="font-size:.72rem">${r.site}</td>
          <td style="font-size:.72rem;max-width:140px">${(r.concern_label||r.concern_type||'').substring(0,45)}</td>
          <td style="font-size:.72rem">${r.support_type||'—'}</td>
          <td><span class="concern-pill ${hrActionClass(r.hr_action)}" style="font-size:.65rem">${r.hr_action||'—'}</span></td>
          <td style="font-size:.72rem">${r.first_time||'—'}</td>
        </tr>`).join('')}</tbody>
      </table></div>
    </div>`;
  }

  function renderHRAnalytics(data) {
    const total      = data.length;
    if (!total) return `<div style="padding:3rem;text-align:center;color:var(--muted)">No records match current filters.</div>`;
    const firstTime  = data.filter(r => r.first_time === 'Yes').length;
    const repeated   = data.filter(r => r.first_time === 'No').length;
    const onWatch    = data.filter(r => r.hr_action === 'On Watch').length;
    const writeup    = data.filter(r => r.hr_action && (r.hr_action.includes('Write Up') || r.hr_action.includes('Progress'))).length;
    const pgp        = data.filter(r => r.hr_action === 'PGP').length;
    const term       = data.filter(r => r.hr_action && r.hr_action.includes('Terminat')).length;
    const noAction   = data.filter(r => r.hr_action === 'No').length;
    const byEmp      = countBy(data, 'emp').filter(([e,c]) => c >= 2 && e);
    const byDistrict = groupBy(data, 'site');

    // Retention goal context
    const coreRet   = 80; // goal
    const onsiteRet = 60; // goal

    let html = `<div style="margin-bottom:1.25rem">
      <div style="font-size:.75rem;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.07em;margin-bottom:.5rem">📌 Annual Goal Alignment</div>
      ${goalAlignmentBadges('hr')}
    </div>`;

    // Retention rings + KPI callout
    html += `<div class="ta-grid ta-grid-4" style="margin-bottom:1.25rem">
      <div class="ta-card ta-kpi"><div class="ta-kpi-val">${total}</div><div class="ta-kpi-sub">Total Concerns on Record</div></div>
      <div class="ta-card ta-kpi ${repeated/total>0.4?'warning':'ok'}"><div class="ta-kpi-val">${repeated}</div><div class="ta-kpi-sub">Repeat Occurrences (${Math.round(repeated/total*100)}%)</div></div>
      <div class="ta-card ta-kpi ${onWatch>5?'warning':'ok'}"><div class="ta-kpi-val">${onWatch}</div><div class="ta-kpi-sub">On Watch — Active Monitoring</div></div>
      <div class="ta-card ta-kpi ${writeup+pgp+term>3?'alert':'warning'}"><div class="ta-kpi-val">${writeup+pgp+term}</div><div class="ta-kpi-sub">Formal HR Actions (W/U, PGP, Term)</div></div>
    </div>`;

    // Retention goal tie-in
    html += `<div class="ta-card" style="margin-bottom:1rem;background:linear-gradient(135deg,#1d3461,#274690);color:#fff">
      <div style="font-size:.75rem;font-weight:700;text-transform:uppercase;letter-spacing:.07em;opacity:.6;margin-bottom:.875rem">🎯 Culture Goal: Staff Retention Watchpoints</div>
      <div class="ta-grid ta-grid-3">
        <div style="text-align:center">
          <div style="font-size:2rem;font-weight:800;color:#f0a500">${onWatch}</div>
          <div style="font-size:.8125rem;opacity:.8">Employees On Watch<br><span style="font-size:.7rem;opacity:.6">Retention risk: MEDIUM</span></div>
        </div>
        <div style="text-align:center">
          <div style="font-size:2rem;font-weight:800;color:#e63946">${pgp+writeup}</div>
          <div style="font-size:.8125rem;opacity:.8">Write-Up / PGP Stage<br><span style="font-size:.7rem;opacity:.6">Retention risk: HIGH</span></div>
        </div>
        <div style="text-align:center">
          <div style="font-size:2rem;font-weight:800;color:#a8b8d8">${term}</div>
          <div style="font-size:.8125rem;opacity:.8">Recommended Termination<br><span style="font-size:.7rem;opacity:.6">Separation imminent</span></div>
        </div>
      </div>
      <div style="margin-top:1rem;padding:.75rem;background:rgba(255,255,255,.07);border-radius:8px;font-size:.8125rem;line-height:1.6;opacity:.85">
        ⚠️ <strong>Goal: 80% core staff retention / 60% onsite staff retention.</strong>
        Each formal HR action (W/U or above) represents a retention risk. ${byEmp.filter(([e,c])=>c>=3).length} employees have 3+ documented concerns — these are high-priority cases for joint Program + HR intervention before escalation.
      </div>
    </div>`;

    // Escalation pipeline
    html += `<div class="ta-card" style="margin-bottom:1rem">
      <div class="ta-card-title">📊 HR Escalation Pipeline — Full Lifecycle View</div>
      <div style="display:flex;gap:2px;border-radius:8px;overflow:hidden;margin-bottom:.75rem">
        ${[['No Action','#d1fae5','#065f46',noAction],['On Watch','#dbeafe','#1e40af',onWatch],['Write-Up','#fef3c7','#92400e',writeup],['PGP','#ede9fe','#5b21b6',pgp],['Terminated','#fee2e2','#991b1b',term]].map(([lbl,bg,col,cnt]) =>
          `<div style="flex:${cnt||0.5};background:${bg};padding:.875rem .5rem;text-align:center;min-width:56px;cursor:default">
            <div style="font-size:1.5rem;font-weight:800;color:${col}">${cnt}</div>
            <div style="font-size:.6875rem;color:${col};font-weight:700">${lbl}</div>
            <div style="font-size:.65rem;color:${col};opacity:.7">${cnt?Math.round(cnt/total*100)+'%':''}</div>
          </div>`).join('<div style="width:2px;background:#fff"></div>')}
      </div>
      <div style="font-size:.8rem;color:var(--muted);line-height:1.5">Pipeline flows left → right. Every case at Write-Up or above should have an active HR file and documented plan. PGP cases require biweekly check-ins per policy.</div>
    </div>`;

    // District HR exposure table
    html += `<div class="ta-card" style="margin-bottom:1rem">
      <div class="ta-card-title">📍 HR Exposure by District — Action Required Summary</div>
      <table class="ta-table">
        <thead><tr><th>District</th><th>Total</th><th>First</th><th>Repeat</th><th>Watch</th><th>Write-Up+</th><th>HR File?</th></tr></thead>
        <tbody>
        ${Object.entries(byDistrict).sort((a,b)=>b[1].length-a[1].length).map(([dist, rows]) => {
          const ft  = rows.filter(r => r.first_time === 'Yes').length;
          const rep = rows.filter(r => r.first_time === 'No').length;
          const w   = rows.filter(r => r.hr_action === 'On Watch').length;
          const f   = rows.filter(r => r.hr_action && (r.hr_action.includes('Write Up')||r.hr_action==='PGP'||r.hr_action.includes('Terminat'))).length;
          const needsFile = f > 0 ? '<span style="color:#e63946;font-weight:700">⚠️ Yes</span>' : '<span style="color:#2a9d8f;font-size:.75rem">Monitoring</span>';
          return `<tr>
            <td><strong>${dist}</strong></td>
            <td style="font-weight:700">${rows.length}</td>
            <td><span class="concern-pill concern-no">${ft}</span></td>
            <td><span class="concern-pill concern-warn">${rep}</span></td>
            <td><span class="concern-pill concern-watch">${w}</span></td>
            <td><span class="concern-pill ${f>0?'concern-writeup':'concern-no'}">${f}</span></td>
            <td style="font-size:.8125rem">${needsFile}</td>
          </tr>`;
        }).join('')}
        </tbody>
      </table>
    </div>`;

    // Repeat employee action queue
    if (byEmp.length) {
      html += `<div class="ta-card">
        <div class="ta-card-title">👤 HR Action Queue — Employees with 2+ Documented Concerns</div>
        <div style="font-size:.8125rem;color:var(--muted);margin-bottom:.75rem">These employees require active HR monitoring. Entries with Write-Up, PGP, or Termination require formal documentation in their HR file.</div>
        <table class="ta-table">
          <thead><tr><th>Employee</th><th>Role</th><th>District</th><th>Concerns</th><th>Most Recent Support</th><th>HR Status</th><th>Priority</th></tr></thead>
          <tbody>
          ${byEmp.map(([emp,cnt]) => {
            const rows = data.filter(r => r.emp === emp).sort((a,b) => new Date(b.ts)-new Date(a.ts));
            const latest = rows[0];
            const priority = cnt >= 5 ? '🔍 Review Recommended' : cnt >= 3 ? '🟡 Monitor Closely' : '🟢 On Track';
            return `<tr>
              <td><strong>${emp}</strong></td>
              <td><span class="dept-tag dept-tag-prog" style="font-size:.65rem">${latest?.role||'—'}</span></td>
              <td style="font-size:.75rem">${latest?.site||'—'}</td>
              <td style="font-weight:800;color:${cnt>=4?'#e63946':cnt>=3?'#e76f51':'#f0a500'}">${cnt}</td>
              <td style="font-size:.75rem">${latest?.support_type||'—'}</td>
              <td><span class="concern-pill ${hrActionClass(latest?.hr_action)}">${latest?.hr_action||'None'}</span></td>
              <td style="font-size:.75rem;font-weight:600">${priority}</td>
            </tr>`;
          }).join('')}
          </tbody>
        </table>
      </div>`;
    }
    return html;
  }

  // ════════════════════════════════════════════════════════════════
  //  PROGRAMMING ANALYTICS — Site risk, coaching, partner impact
  // ════════════════════════════════════════════════════════════════

  // ── Expose to global scope ───────────────────────────────────────────────
  window.renderTalentReviews    = renderTalentReviews;
  window.renderTalentLog        = renderTalentLog;
  window.renderHRAnalytics      = renderHRAnalytics;

})();
