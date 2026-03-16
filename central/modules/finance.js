(function() {

  function renderFinanceAnalytics() {
    const data = CONCERNS;
    const years = getAvailableYears();
    const yr = window.__yrFilter_financeAnalyticsContent || 'all';
    const filtered = yr === 'all' ? data : filterByYear(data, yr);
    if (!filtered.length) return `<div style="padding:3rem;text-align:center;color:var(--muted)">No workforce data for selected period.</div>`;

    const total = filtered.length;
    const byDistrict = countBy(filtered, 'site');
    const escalated  = filtered.filter(r => r.hr_action && (r.hr_action.includes('Write Up')||r.hr_action==='PGP'||r.hr_action.includes('Terminat'))).length;
    const onWatch    = filtered.filter(r => r.hr_action === 'On Watch').length;
    const highRisk   = byDistrict.filter(([d,c]) => c >= 6).length;

    let html = `${goalAlignmentBadges('finance')}
    <div style="font-size:.8125rem;color:var(--muted);margin-bottom:1.25rem;padding:.75rem 1rem;background:var(--surface);border-radius:8px;border:1px solid var(--border)">
      ℹ️ Finance view shows <strong>aggregated workforce stability metrics only</strong> — no individual employee data. This view supports fee-for-service partner retention modeling and turnover cost risk assessment.
    </div>`;

    html += `<div class="ta-grid ta-grid-4" style="margin-bottom:1.25rem">
      <div class="ta-card ta-kpi ${highRisk>=3?'alert':highRisk>=1?'warning':'ok'}">
        <div class="ta-kpi-val">${highRisk}</div><div class="ta-kpi-sub">High-Concern Districts<br><span style="font-size:.7rem">(6+ concern flags)</span></div>
      </div>
      <div class="ta-card ta-kpi ${onWatch>5?'warning':'ok'}">
        <div class="ta-kpi-val">${onWatch}</div><div class="ta-kpi-sub">Employees On Watch<br><span style="font-size:.7rem">(turnover risk)</span></div>
      </div>
      <div class="ta-card ta-kpi ${escalated>3?'alert':'warning'}">
        <div class="ta-kpi-val">${escalated}</div><div class="ta-kpi-sub">Formal HR Actions<br><span style="font-size:.7rem">(separation risk)</span></div>
      </div>
      <div class="ta-card ta-kpi ok">
        <div class="ta-kpi-val">${byDistrict.length}</div><div class="ta-kpi-sub">Active Partner Districts<br><span style="font-size:.7rem">(concern on record)</span></div>
      </div>
    </div>`;

    // Partner retention risk by district (aggregated)
    html += `<div class="ta-card" style="margin-bottom:1rem">
      <div class="ta-card-title">🏢 Partner Portfolio — Workforce Stability Index</div>
      <div style="font-size:.8125rem;color:var(--muted);margin-bottom:.875rem">Districts ordered by concern volume. High concern volume + escalated HR actions = elevated risk of service delivery disruption, which directly impacts fee-for-service renewal probability.</div>
      <table class="ta-table">
        <thead><tr><th>District / Partner</th><th>Concern Volume</th><th>Stability Risk</th><th>Escalated</th><th>Fee-for-Service Impact</th></tr></thead>
        <tbody>
        ${byDistrict.map(([dist, cnt]) => {
          const dRows = filtered.filter(r=>r.site===dist);
          const esc   = dRows.filter(r=>r.hr_action&&(r.hr_action.includes('Write Up')||r.hr_action==='PGP'||r.hr_action.includes('Terminat'))).length;
          const risk  = esc>0||cnt>=8?'High':'med'===(cnt>=4?'med':'low')?'Moderate':'Low';
          const rColor= risk==='High'?'#e63946':risk==='Moderate'?'#e76f51':'#2a9d8f';
          const impact= risk==='High'?'⚠️ Renewal review recommended':risk==='Moderate'?'👁 Monitor service quality':'✅ Stable';
          return `<tr>
            <td><strong>${dist}</strong></td>
            <td style="font-weight:700">${cnt}</td>
            <td><span style="font-weight:700;color:${rColor}">${risk}</span></td>
            <td><span class="concern-pill ${esc>0?'concern-writeup':'concern-no'}">${esc}</span></td>
            <td style="font-size:.8rem">${impact}</td>
          </tr>`;
        }).join('')}
        </tbody>
      </table>
    </div>`;

    // Goal alignment
    html += `<div class="ta-card">
      <div class="ta-card-title">🎯 Goal Alignment — Fee-for-Service &amp; Funding Risk Signals</div>
      <div class="ta-grid ta-grid-3" style="margin-top:.75rem">
        <div style="padding:.875rem;background:#f0fdf4;border-radius:8px">
          <div style="font-weight:700;color:#065f46;margin-bottom:.375rem">Fee-for-Service Retention</div>
          <div style="font-size:.8125rem;line-height:1.6;color:#064e3b">Goal: 50% partner retention.<br>${highRisk} district${highRisk!==1?'s':''} flagged for delivery risk.<br>${highRisk===0?'✅ Portfolio stable.':'⚠️ Proactive outreach recommended.'}</div>
        </div>
        <div style="padding:.875rem;background:#eff6ff;border-radius:8px">
          <div style="font-weight:700;color:#1e40af;margin-bottom:.375rem">Turnover Cost Risk</div>
          <div style="font-size:.8125rem;line-height:1.6;color:#1e3a8a">~${onWatch+escalated} employees at separation risk.<br>Estimated turnover cost: $${(onWatch*1500+escalated*3500).toLocaleString()} if all separate.<br><span style="font-size:.7rem;opacity:.7">(Estimate: ~$1.5K on-watch, ~$3.5K formal)</span></div>
        </div>
        <div style="padding:.875rem;background:#fff7ed;border-radius:8px">
          <div style="font-weight:700;color:#92400e;margin-bottom:.375rem">Cash Position Impact</div>
          <div style="font-size:.8125rem;line-height:1.6;color:#78350f">Goal: $500K money market.<br>Unplanned turnover at ${escalated} formal cases: potential disruption to site billing continuity.<br>${escalated<=2?'✅ Minimal risk.':'⚠️ Flag for finance review.'}</div>
        </div>
      </div>
    </div>`;
    return html;
  }

  // ════════════════════════════════════════════════════════════════
  //  TRAINING ANALYTICS — Skills gap, PD needs (no employee names)
  // ════════════════════════════════════════════════════════════════

  function buildFinanceAnalytics() {
    const el = document.getElementById('financeAnalyticsContent');
    if (!el) return;
    el.innerHTML = '';
    addYearFilter('financeAnalyticsContent', () => {
      el.querySelectorAll('[data-finance-content]').forEach(e => e.remove());
      const c = document.createElement('div');
      c.setAttribute('data-finance-content','1');
      c.innerHTML = renderFinanceAnalytics();
      el.appendChild(c);
    }, true);
    const c = document.createElement('div');
    c.setAttribute('data-finance-content','1');
    c.innerHTML = renderFinanceAnalytics();
    el.appendChild(c);
  }

  // ── Training analytics panel ────────────────────────────────────

  // ── Expose to global scope ───────────────────────────────────────────────
  window.renderFinanceAnalytics = renderFinanceAnalytics;
  window.buildFinanceAnalytics  = buildFinanceAnalytics;

})();
