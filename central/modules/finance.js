(function() {

  // ════════════════════════════════════════════════════════════════
  //  FINANCE — Partnership & Workforce Risk Analytics
  //  Data sources: window.HR_EMPS (ADP), window.po (Pearl Ops),
  //                window.CONCERNS (HR concerns log)
  // ════════════════════════════════════════════════════════════════

  function renderFinanceAnalytics() {

    // ── Live data sources ────────────────────────────────────────
    var emps       = (window.HR_EMPS || []).filter(function(e){ return e.s === 'Active'; });
    var allConc    = window.CONCERNS || [];
    var po         = window.po;
    var poStats    = (po && typeof po.getStats === 'function')           ? po.getStats()           : null;
    var poData     = (po && typeof po.getLeadershipData === 'function')  ? po.getLeadershipData()  : null;

    // Year filter applied to CONCERNS only (Pearl Ops reflects live roster)
    var yr       = window.__yrFilter_financeAnalyticsContent || 'all';
    var concerns = (yr === 'all') ? allConc : filterByYear(allConc, yr);

    // ── Workforce risk signals ───────────────────────────────────
    var withAction    = emps.filter(function(e){ return e._liveHRAction && e._liveHRAction.trim(); });
    var lowAtt70      = emps.filter(function(e){ return e.att !== null && e.att < 70; });
    var multiConcern  = emps.filter(function(e){ return (e.co || 0) >= 2; });

    // Employees needing deeper review: active HR action, very low attendance, or 2+ concerns
    var deepNames = {};
    withAction.forEach(function(e)   { deepNames[e.n] = e; });
    lowAtt70.forEach(function(e)     { deepNames[e.n] = e; });
    multiConcern.forEach(function(e) { deepNames[e.n] = e; });
    var deepReview = Object.values(deepNames).sort(function(a, b) {
      // Sort: active HR action first, then lowest attendance
      var aScore = (a._liveHRAction ? 100 : 0) + (a.att !== null && a.att < 70 ? 50 : 0) + (a.co || 0);
      var bScore = (b._liveHRAction ? 100 : 0) + (b.att !== null && b.att < 70 ? 50 : 0) + (b.co || 0);
      return bScore - aScore;
    });

    // ── Concern volume by site/district ─────────────────────────
    var byDistrict = {};
    concerns.forEach(function(c) {
      var d = c.site || 'Unknown';
      if (!byDistrict[d]) byDistrict[d] = { concerns: 0, escalated: 0, watch: 0 };
      byDistrict[d].concerns++;
      if (c.hr_action && (c.hr_action.includes('Write Up') || c.hr_action === 'PGP' || c.hr_action.includes('Terminat'))) {
        byDistrict[d].escalated++;
      }
      if (c.hr_action === 'On Watch') byDistrict[d].watch++;
    });

    // ── Pearl Ops district data ──────────────────────────────────
    var poDistricts = (poData && poData.districts) ? poData.districts : [];
    var tutorAtRisk = poDistricts.filter(function(d){ return d.tutorRate < 80; });

    // ── Financial estimates ──────────────────────────────────────
    var sepRisk      = withAction.length;
    var estTurnover  = sepRisk * 3500; // ~$3.5K per separation (recruiting + training)

    // ── District risk matrix (HR + Pearl combined) ───────────────
    var allDistNames = {};
    Object.keys(byDistrict).forEach(function(d){ allDistNames[d] = true; });
    poDistricts.forEach(function(d){ if (d.name) allDistNames[d.name] = true; });

    var distMatrix = Object.keys(allDistNames).map(function(dist) {
      var hr  = byDistrict[dist]  || { concerns: 0, escalated: 0, watch: 0 };
      var pod = null;
      for (var i = 0; i < poDistricts.length; i++) {
        if (poDistricts[i].name === dist) { pod = poDistricts[i]; break; }
      }
      var tutorAtt  = pod ? pod.tutorRate  : null;
      var scholAtt  = pod ? pod.scholarRate : null;
      var riskScore = 0;
      if (hr.escalated > 0)                         riskScore += 3;
      if (hr.watch > 0)                             riskScore += 1;
      if (hr.concerns >= 5)                         riskScore += 2;
      else if (hr.concerns >= 3)                    riskScore += 1;
      if (tutorAtt !== null && tutorAtt < 75)       riskScore += 2;
      else if (tutorAtt !== null && tutorAtt < 80)  riskScore += 1;
      return {
        dist: dist,
        hr:   hr,
        tutorAtt:  tutorAtt,
        scholAtt:  scholAtt,
        sessions:  pod ? pod.sessions  : 0,
        scholars:  pod ? pod.scholars  : 0,
        riskScore: riskScore
      };
    }).filter(function(d){ return d.hr.concerns > 0 || d.sessions > 0; })
      .sort(function(a, b){ return b.riskScore - a.riskScore; });

    var highRiskCount = distMatrix.filter(function(d){ return d.riskScore >= 4; }).length;

    // ════════════════════════════════════════════════════════════
    //  RENDER
    // ════════════════════════════════════════════════════════════

    var html = goalAlignmentBadges('finance');

    // ── Info strip ───────────────────────────────────────────────
    html += '<div style="font-size:.8125rem;color:var(--muted);margin-bottom:1.25rem;padding:.75rem 1rem;background:var(--surface);border-radius:8px;border:1px solid var(--border)">'
          + '\u2139\uFE0F <strong>Partnership &amp; Workforce Risk Analytics</strong> \u2014 ADP workforce data (attendance, HR actions) + Pearl Operations delivery metrics, combined into actionable financial risk signals. Live data.'
          + '</div>';

    // ── KPI hero cards ───────────────────────────────────────────
    html += '<div class="ta-grid ta-grid-4" style="margin-bottom:1.25rem">'
          + '<div class="ta-card ta-kpi ' + (highRiskCount >= 3 ? 'alert' : highRiskCount >= 1 ? 'warning' : 'ok') + '">'
          +   '<div class="ta-kpi-val">' + highRiskCount + '</div>'
          +   '<div class="ta-kpi-sub">High-Risk Districts<br><span style="font-size:.7rem">(HR + delivery risk)</span></div>'
          + '</div>'
          + '<div class="ta-card ta-kpi ' + (withAction.length > 3 ? 'alert' : withAction.length > 0 ? 'warning' : 'ok') + '">'
          +   '<div class="ta-kpi-val">' + withAction.length + '</div>'
          +   '<div class="ta-kpi-sub">Active HR Actions<br><span style="font-size:.7rem">(separation risk)</span></div>'
          + '</div>'
          + '<div class="ta-card ta-kpi ' + (tutorAtRisk.length >= 3 ? 'alert' : tutorAtRisk.length >= 1 ? 'warning' : 'ok') + '">'
          +   '<div class="ta-kpi-val">' + tutorAtRisk.length + '</div>'
          +   '<div class="ta-kpi-sub">Districts: Tutor Att &lt;80%<br><span style="font-size:.7rem">(contact HR now)</span></div>'
          + '</div>'
          + '<div class="ta-card ta-kpi ' + (estTurnover > 10000 ? 'alert' : estTurnover > 3500 ? 'warning' : 'ok') + '">'
          +   '<div class="ta-kpi-val">$' + estTurnover.toLocaleString() + '</div>'
          +   '<div class="ta-kpi-sub">Est. Turnover Exposure<br><span style="font-size:.7rem">(if all at-risk separate)</span></div>'
          + '</div>'
          + '</div>';

    // ── Alert: tutor attendance flags ────────────────────────────
    if (tutorAtRisk.length > 0) {
      html += '<div class="ta-alert-strip" style="margin-bottom:1rem">'
            +   '<div class="ta-alert-icon">\uD83D\uDD34</div>'
            +   '<div>'
            +   '<div class="ta-alert-title">Tutor attendance below 80% threshold \u2014 contact HR for staffing intervention</div>'
            +   '<div class="ta-alert-body">'
            +   tutorAtRisk.map(function(d){
                  return '<strong>' + d.name + '</strong>: ' + d.tutorRate + '% tutor att'
                       + (d.scholars > 0 ? ' \u00b7 ' + d.scholars + ' scholars impacted' : '');
                }).join(' &nbsp;&middot;&nbsp; ')
            +   '</div></div></div>';
    }

    // ── Employees needing deeper review ──────────────────────────
    if (deepReview.length > 0) {
      html += '<div class="ta-card" style="margin-bottom:1rem">'
            +   '<div class="ta-card-title">\uD83D\uDD0D Employees Requiring Deeper Review</div>'
            +   '<div style="font-size:.8125rem;color:var(--muted);margin-bottom:.75rem">'
            +   'Active HR action, attendance below 70%, or 2+ concern records. Finance flag: these individuals represent'
            +   ' potential separation cost, service delivery risk, or billing continuity impact.'
            +   '</div>'
            +   '<div style="overflow-x:auto"><table class="ta-table">'
            +   '<thead><tr><th>Employee</th><th>Role</th><th>District / Site</th><th>Attendance</th><th>HR Action</th><th>Concerns</th><th>Risk Signal</th></tr></thead>'
            +   '<tbody>';

      var shown = deepReview.slice(0, 25);
      shown.forEach(function(e) {
        var attPct    = e.att !== null ? e.att : null;
        var attColor  = attPct !== null ? (attPct < 70 ? '#e63946' : attPct < 80 ? '#e76f51' : '#2a9d8f') : '#94a3b8';
        var attText   = attPct !== null ? attPct + '%' : '\u2014';
        var action    = e._liveHRAction || e.hn || '\u2014';
        var riskLabel = e._liveHRAction
          ? '\uD83D\uDEA8 Active HR Action'
          : (attPct !== null && attPct < 70 ? '\u26A0\uFE0F Low Attendance' : '\uD83D\uDC41 Multiple Concerns');
        html += '<tr>'
              + '<td><strong>' + e.n + '</strong></td>'
              + '<td style="font-size:.78rem">' + (e.r || '\u2014') + '</td>'
              + '<td style="font-size:.78rem">' + (e.di || e.si || '\u2014') + '</td>'
              + '<td style="font-weight:700;color:' + attColor + '">' + attText + '</td>'
              + '<td style="font-size:.78rem">' + action + '</td>'
              + '<td style="text-align:center">' + (e.co || 0) + '</td>'
              + '<td style="font-size:.78rem">' + riskLabel + '</td>'
              + '</tr>';
      });

      if (deepReview.length > 25) {
        html += '<tr><td colspan="7" style="text-align:center;color:var(--muted);font-size:.78rem">+ ' + (deepReview.length - 25) + ' additional records</td></tr>';
      }

      html += '</tbody></table></div></div>';
    } else {
      html += '<div style="padding:.75rem 1rem;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;margin-bottom:1rem;font-size:.8rem;color:#166534">'
            + '\u2705 No employees currently flagged for deeper review. Workforce stability signals are normal.'
            + '</div>';
    }

    // ── District Risk Matrix ─────────────────────────────────────
    html += '<div class="ta-card" style="margin-bottom:1rem">'
          +   '<div class="ta-card-title">\uD83C\uDFE2 District Risk Matrix \u2014 HR + Pearl Operations</div>'
          +   '<div style="font-size:.8125rem;color:var(--muted);margin-bottom:.875rem">'
          +   'Combined HR concern volume and Pearl Operations attendance. <strong>High risk = fee-for-service renewal risk and billing continuity exposure.</strong>'
          +   ' Contact HR when tutor attendance drops below 80%.'
          +   '</div>'
          +   '<div style="overflow-x:auto"><table class="ta-table">'
          +   '<thead><tr><th>District / Partner</th><th>HR Concerns</th><th>HR Actions</th><th>Tutor Att.</th><th>Scholar Att.</th><th>Sessions</th><th>Risk Level</th><th>Recommended Action</th></tr></thead>'
          +   '<tbody>';

    if (distMatrix.length === 0) {
      html += '<tr><td colspan="8" style="text-align:center;color:var(--muted)">No district data for selected period.</td></tr>';
    } else {
      distMatrix.slice(0, 30).forEach(function(d) {
        var risk    = d.riskScore >= 4 ? 'High' : d.riskScore >= 2 ? 'Moderate' : 'Low';
        var rColor  = risk === 'High' ? '#e63946' : risk === 'Moderate' ? '#e76f51' : '#2a9d8f';
        var tColor  = d.tutorAtt !== null ? (d.tutorAtt < 75 ? '#e63946' : d.tutorAtt < 80 ? '#e76f51' : '#2a9d8f') : '#94a3b8';
        var sColor  = d.scholAtt !== null ? (d.scholAtt < 75 ? '#e76f51' : '#2a9d8f') : '#94a3b8';
        var hrCell  = d.hr.escalated > 0
          ? '<span style="color:#e63946;font-weight:700">' + d.hr.escalated + ' formal</span>'
          : d.hr.watch > 0
            ? '<span style="color:#e76f51">' + d.hr.watch + ' on watch</span>'
            : '\u2014';
        var action  = risk === 'High'     ? '\uD83D\uDEA8 Flag for finance review'
                    : risk === 'Moderate' ? '\uD83D\uDCDE Contact HR'
                    :                      '\u2705 Monitor';
        html += '<tr>'
              + '<td><strong>' + d.dist + '</strong>'
              + (d.scholars > 0 ? '<br><span style="font-size:.68rem;color:#94a3b8">' + d.scholars + ' scholars</span>' : '')
              + '</td>'
              + '<td style="font-weight:700">' + d.hr.concerns + '</td>'
              + '<td>' + hrCell + '</td>'
              + '<td style="font-weight:700;color:' + tColor + '">' + (d.tutorAtt !== null ? d.tutorAtt + '%' : '\u2014') + '</td>'
              + '<td style="color:' + sColor + '">' + (d.scholAtt !== null ? d.scholAtt + '%' : '\u2014') + '</td>'
              + '<td>' + (d.sessions || '\u2014') + '</td>'
              + '<td><span style="font-weight:700;color:' + rColor + '">' + risk + '</span></td>'
              + '<td style="font-size:.78rem">' + action + '</td>'
              + '</tr>';
      });
    }

    html += '</tbody></table></div></div>';

    // ── Pearl Ops delivery signal ─────────────────────────────────
    if (poStats && poStats.loaded) {
      var scholPct = poStats.scholAttPct || 0;
      var instPct  = poStats.instAttPct  || 0;
      var sessions = poStats.sessions    || 0;
      var tutors   = poStats.activeTutors || 0;
      var scholars = poStats.activeScholars || 0;

      html += '<div class="ta-card" style="margin-bottom:1rem">'
            +   '<div class="ta-card-title">\uD83D\uDCCA Pearl Operations \u2014 Service Delivery Financial Signal</div>'
            +   '<div class="ta-grid ta-grid-4" style="margin-top:.875rem">'
            +   _statBox(instPct + '%',  'Tutor Attendance',    'Target: 85%',   instPct >= 85 ? '#059669' : instPct >= 75 ? '#d97706' : '#e63946')
            +   _statBox(scholPct + '%', 'Scholar Attendance',  'Target: 80%',   scholPct >= 80 ? '#059669' : scholPct >= 70 ? '#d97706' : '#e63946')
            +   _statBox(sessions.toLocaleString(), 'Sessions Delivered', 'Billable service events', '#1d4ed8')
            +   _statBox(tutors,          'Active Tutors',       scholars + ' scholars served', '#7c3aed')
            +   '</div>';

      if (instPct < 80) {
        html += '<div style="margin-top:.875rem;padding:.75rem 1rem;background:#fff3cd;border:1px solid #ffc107;border-radius:8px;font-size:.8125rem;color:#856404">'
              + '\u26A0\uFE0F Tutor attendance below 80% \u2014 service delivery gaps may affect district contract compliance and fee-for-service billing. '
              + 'Initiate HR staffing review for underperforming sites immediately.'
              + '</div>';
      }

      html += '</div>';
    } else {
      html += '<div class="ta-card" style="margin-bottom:1rem">'
            +   '<div class="ta-card-title">\uD83D\uDCCA Pearl Operations \u2014 Service Delivery Financial Signal</div>'
            +   '<div style="padding:1rem;text-align:center;color:var(--muted);font-size:.8rem">'
            +   'Pearl Operations data not yet loaded. Open Pearl Operations panel to initialize, then return here.'
            +   '</div></div>';
    }

    // ── TAP Apprenticeship — Wage & Milestone Tracker ─────────────
    (function() {
      var apps     = window._apprApps     || [];
      var roster   = window.AP_TAP_ROSTER || [];
      var otjMap   = window.njtcLiveOtjMap || {};
      var OTJ_MAX  = 17;
      // Wage milestone thresholds as % of OTJ checklist completion (proxy for hours)
      var MILESTONES = [
        { pct: 25, label: 'Milestone 1 (25%)', wageNote: '+5% wage increase' },
        { pct: 50, label: 'Milestone 2 (50%)', wageNote: '+5% wage increase' },
        { pct: 75, label: 'Milestone 3 (75%)', wageNote: '+5% wage increase' },
        { pct: 100, label: 'Completion',        wageNote: '+$5.00/hr cert bonus' },
      ];

      if (!apps.length && !roster.length) {
        html += '<div class="ta-card" style="margin-bottom:1rem">'
              + '<div class="ta-card-title">🎓 TAP Apprenticeship — Wage &amp; Milestone Tracker</div>'
              + '<div style="padding:1rem;text-align:center;color:var(--muted);font-size:.8rem">'
              + 'Apprentice data not yet loaded. Open the Training &amp; Development → Apprentice Tracker tab first.'
              + '</div></div>';
        return;
      }

      var active = apps.filter(function(a){ return !(a.adp||'').includes('Terminat'); });
      var normN  = function(s){ return (s||'').trim().toLowerCase().replace(/\s+/g,' '); };

      // Build enriched apprentice list with milestone status
      var enriched = active.map(function(a) {
        var key    = normN(a.name);
        var items  = otjMap.hasOwnProperty(key) ? otjMap[key] : (a.otjItems !== null ? a.otjItems : null);
        var pct    = items !== null ? Math.min(Math.round(items / OTJ_MAX * 100), 100) : null;
        var re     = roster.find(function(r){ return normN(r.name) === key || normN(r.name).split(' ').filter(function(w){return w.length>1;})[0] + ' ' + normN(r.name).split(' ').filter(function(w){return w.length>1;})[normN(r.name).split(' ').filter(function(w){return w.length>1;}).length-1] === normN(a.name).split(' ').filter(function(w){return w.length>1;})[0]+' '+normN(a.name).split(' ').filter(function(w){return w.length>1;})[normN(a.name).split(' ').filter(function(w){return w.length>1;}).length-1]; }) || null;

        // Determine which milestone tier they're in
        var milestone = 'Pre-Milestone 1';
        var nextMilestone = MILESTONES[0];
        var actionNeeded  = false;
        if (pct !== null) {
          for (var mi = MILESTONES.length - 1; mi >= 0; mi--) {
            if (pct >= MILESTONES[mi].pct) {
              milestone    = MILESTONES[mi].label;
              nextMilestone= MILESTONES[mi + 1] || null;
              actionNeeded = (pct >= MILESTONES[mi].pct);
              break;
            }
          }
        }

        return {
          name:         a.name,
          district:     a.district || a.school || '—',
          sl:           a.sl || '—',
          region:       a.region || '—',
          obsCount:     a.obsCount || 0,
          items:        items,
          pct:          pct,
          milestone:    milestone,
          nextMilestone:nextMilestone,
          actionNeeded: actionNeeded && pct !== null && pct >= 25,
          njId:         re ? re.njId  : '—',
          cohort:       re ? re.cohort: '—',
        };
      });

      // Sort: action needed first, then by OTJ% desc
      enriched.sort(function(a, b) {
        if (a.actionNeeded && !b.actionNeeded) return -1;
        if (!a.actionNeeded && b.actionNeeded) return  1;
        return (b.pct || -1) - (a.pct || -1);
      });

      var actionCount   = enriched.filter(function(a){ return a.actionNeeded; }).length;
      var completedCount= enriched.filter(function(a){ return a.pct !== null && a.pct >= 100; }).length;
      var m1Count       = enriched.filter(function(a){ return a.pct !== null && a.pct >= 25; }).length;
      var m2Count       = enriched.filter(function(a){ return a.pct !== null && a.pct >= 50; }).length;
      var m3Count       = enriched.filter(function(a){ return a.pct !== null && a.pct >= 75; }).length;
      var noDataCount   = enriched.filter(function(a){ return a.pct === null; }).length;

      html += '<div class="ta-card" style="margin-bottom:1rem">'
            + '<div class="ta-card-title">🎓 TAP Apprenticeship — Wage &amp; Milestone Tracker</div>'
            + '<div style="font-size:.8125rem;color:var(--muted);margin-bottom:.875rem">'
            + 'SY 25-26 program · OTJ checklist progress used as milestone proxy · Verify exact OJT/RTI hours in the <a href="https://docs.google.com/spreadsheets/d/1Dh1-TsuXEwoz4sqA4RBtgylPZ6epencsrJoqxupIEqs" target="_blank" rel="noopener" style="color:var(--blue-mid)">Live Tracker</a> before processing wage changes'
            + '</div>';

      // KPI strip
      html += '<div class="ta-grid ta-grid-4" style="margin-bottom:.875rem">'
            + _statBox(active.length,    'Active Apprentices',       'SY 25-26 cohort',                     '#1d4ed8')
            + _statBox(actionCount,      'Wage Actions Pending',     'At/past a milestone threshold',       actionCount > 0 ? '#d97706' : '#059669')
            + _statBox(completedCount,   'OTJ Complete',             'All checklist items done',            completedCount > 0 ? '#059669' : '#94a3b8')
            + _statBox(noDataCount,      'No OTJ Data Yet',          'Not yet in Live Tracker',             noDataCount > 0 ? '#e76f51' : '#059669')
            + '</div>';

      // Milestone pipeline summary
      html += '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:.5rem;margin-bottom:.875rem">'
            + [
                ['25% Milestone', m1Count, active.length, '#f59e0b', '+5% wage'],
                ['50% Milestone', m2Count, active.length, '#d97706', '+5% wage'],
                ['75% Milestone', m3Count, active.length, '#92400e', '+5% wage'],
                ['Completion',   completedCount, active.length, '#059669', '+$5.00/hr'],
              ].map(function(row) {
                var barPct = active.length > 0 ? Math.round(row[1]/active.length*100) : 0;
                return '<div style="background:#f9fafb;border-radius:8px;padding:.6rem .75rem">'
                     + '<div style="font-size:.72rem;color:#6b7280;margin-bottom:.2rem">' + row[0] + '</div>'
                     + '<div style="font-size:1.1rem;font-weight:700;color:' + row[3] + '">' + row[1] + '<span style="font-size:.7rem;font-weight:400;color:#9ca3af"> / ' + row[2] + '</span></div>'
                     + '<div style="height:4px;background:#e5e7eb;border-radius:2px;margin:.3rem 0;overflow:hidden"><div style="width:' + barPct + '%;height:100%;background:' + row[3] + ';border-radius:2px"></div></div>'
                     + '<div style="font-size:.68rem;color:' + row[3] + ';font-weight:600">' + row[4] + '</div>'
                     + '</div>';
              }).join('')
            + '</div>';

      // Alert: pending wage actions
      if (actionCount > 0) {
        var actionNames = enriched.filter(function(a){ return a.actionNeeded; })
          .map(function(a){ return '<strong>' + a.name + '</strong> (' + (a.milestone) + ')'; }).join(', ');
        html += '<div style="background:#fef3c7;border:1px solid #fde68a;border-radius:8px;padding:.75rem 1rem;margin-bottom:.875rem;font-size:.8125rem;color:#92400e">'
              + '⚠️ <strong>Wage Action Required:</strong> ' + actionCount + ' apprentice' + (actionCount!==1?'s':'') + ' at or past a milestone threshold — verify hours in the Live Tracker and process wage adjustment. ' + actionNames
              + '</div>';
      }

      // Detailed table
      html += '<div style="overflow-x:auto"><table class="ta-table">'
            + '<thead><tr>'
            + '<th>Apprentice</th><th>NJ DOL ID</th><th>District / Site</th>'
            + '<th style="text-align:center">OTJ Items</th><th style="min-width:130px">Progress</th>'
            + '<th>Milestone Status</th><th>Next Action</th><th style="text-align:center">Obs</th>'
            + '</tr></thead><tbody>';

      enriched.forEach(function(a) {
        var pctNum   = a.pct !== null ? a.pct : 0;
        var barColor = pctNum >= 100 ? '#059669' : pctNum >= 75 ? '#92400e' : pctNum >= 50 ? '#d97706' : pctNum >= 25 ? '#f59e0b' : '#3b82f6';
        var msColor  = a.milestone === 'Completion' ? '#059669' : a.actionNeeded ? '#d97706' : '#6b7280';
        var nextAction = a.nextMilestone
          ? (a.pct !== null ? 'At ' + a.nextMilestone.pct + '% → ' + a.nextMilestone.wageNote : '—')
          : (a.pct !== null && a.pct >= 100 ? '✅ Cert bonus eligible' : '—');

        html += '<tr' + (a.actionNeeded ? ' style="background:#fffbeb"' : '') + '>'
              + '<td><strong>' + a.name + '</strong>'
              + (a.actionNeeded ? ' <span style="font-size:.65rem;background:#fef3c7;color:#92400e;padding:.05rem .3rem;border-radius:2px;font-weight:700">ACTION</span>' : '')
              + '</td>'
              + '<td style="font-family:monospace;font-size:.78rem;color:#6b7280">' + (a.njId||'—') + '</td>'
              + '<td style="font-size:.78rem">' + a.district + '</td>'
              + '<td style="text-align:center;font-weight:600">' + (a.items !== null ? a.items + '/' + OTJ_MAX : '—') + '</td>'
              + '<td>'
              + (a.pct !== null
                  ? '<div style="display:flex;align-items:center;gap:.4rem"><div style="flex:1;height:6px;background:#f3f4f6;border-radius:3px;overflow:hidden"><div style="width:' + pctNum + '%;height:100%;background:' + barColor + ';border-radius:3px"></div></div><span style="font-size:.72rem;font-weight:700;color:' + barColor + ';min-width:2.5rem">' + pctNum + '%</span></div>'
                  : '<span style="color:#d1d5db;font-size:.75rem">No data</span>')
              + '</td>'
              + '<td style="font-size:.78rem;font-weight:600;color:' + msColor + '">' + a.milestone + '</td>'
              + '<td style="font-size:.75rem;color:#374151">' + nextAction + '</td>'
              + '<td style="text-align:center;font-weight:700;color:' + (a.obsCount>=3?'#059669':a.obsCount>=1?'#d97706':'#9ca3af') + '">' + a.obsCount + '</td>'
              + '</tr>';
      });

      html += '</tbody></table></div>';

      // Footnote
      html += '<div style="margin-top:.625rem;font-size:.72rem;color:#9ca3af;font-style:italic">'
            + '* OTJ % reflects checklist item completion (0–17 items from Live Tracker). Actual OJT hours (target: 4,000) and RTI hours (target: 288) must be verified in the Live Tracker before processing any wage change. Wage milestones per apprenticeship agreement: 25%/50%/75% OJT = +5% each; full program completion = +$5.00/hr certification bonus.'
            + '</div>'
            + '</div>';
    }());

    // ── Financial goal alignment ──────────────────────────────────
    html += '<div class="ta-card">'
          +   '<div class="ta-card-title">\uD83C\uDFAF Financial Goal Status</div>'
          +   '<div class="ta-grid ta-grid-3" style="margin-top:.75rem">'

          +   '<div style="padding:.875rem;background:#f0fdf4;border-radius:8px">'
          +     '<div style="font-weight:700;color:#065f46;margin-bottom:.375rem">Fee-for-Service Retention</div>'
          +     '<div style="font-size:.8125rem;line-height:1.6;color:#064e3b">'
          +     'Goal: 50%+ partner retention rate.<br>'
          +     highRiskCount + ' district' + (highRiskCount !== 1 ? 's' : '') + ' at elevated delivery risk.<br>'
          +     (highRiskCount === 0 ? '\u2705 Portfolio stable.' : '\u26A0\uFE0F Proactive outreach recommended.')
          +     '</div></div>'

          +   '<div style="padding:.875rem;background:#eff6ff;border-radius:8px">'
          +     '<div style="font-weight:700;color:#1e40af;margin-bottom:.375rem">Workforce Turnover Cost Risk</div>'
          +     '<div style="font-size:.8125rem;line-height:1.6;color:#1e3a8a">'
          +     withAction.length + ' employee' + (withAction.length !== 1 ? 's' : '') + ' with active HR action.<br>'
          +     'Estimated exposure if all separate: <strong>$' + estTurnover.toLocaleString() + '</strong><br>'
          +     '<span style="font-size:.7rem;opacity:.7">~$3,500 per separation (recruiting + onboarding)</span>'
          +     '</div></div>'

          +   '<div style="padding:.875rem;background:#fff7ed;border-radius:8px">'
          +     '<div style="font-weight:700;color:#92400e;margin-bottom:.375rem">Cash Position &amp; Billing Risk</div>'
          +     '<div style="font-size:.8125rem;line-height:1.6;color:#78350f">'
          +     'Goal: $500K money market position.<br>'
          +     (tutorAtRisk.length > 0
                  ? tutorAtRisk.length + ' district' + (tutorAtRisk.length !== 1 ? 's' : '') + ' with tutor att risk may affect service billing continuity.'
                  : 'No active billing disruption signals.')
          +     '<br>'
          +     (tutorAtRisk.length > 1 ? '\u26A0\uFE0F Review billing continuity.' : '\u2705 Minimal disruption risk.')
          +     '</div></div>'

          +   '</div></div>';

    return html;
  }

  // ── Helper: stat box ─────────────────────────────────────────────
  function _statBox(val, label, sub, color) {
    return '<div style="text-align:center;padding:.875rem;background:#f8fafc;border-radius:8px">'
         +   '<div style="font-size:1.375rem;font-weight:800;color:' + color + '">' + val + '</div>'
         +   '<div style="font-size:.75rem;font-weight:700;color:var(--navy);margin-top:.2rem">' + label + '</div>'
         +   '<div style="font-size:.7rem;color:var(--muted)">' + sub + '</div>'
         + '</div>';
  }

  // ════════════════════════════════════════════════════════════════
  //  BUILD — called when panel opens
  // ════════════════════════════════════════════════════════════════

  function buildFinanceAnalytics() {
    var el = document.getElementById('financeAnalyticsContent');
    if (!el) return;
    el.innerHTML = '';

    addYearFilter('financeAnalyticsContent', function() {
      el.querySelectorAll('[data-finance-content]').forEach(function(e){ e.remove(); });
      var c = document.createElement('div');
      c.setAttribute('data-finance-content', '1');
      try { c.innerHTML = renderFinanceAnalytics(); }
      catch(err) { c.innerHTML = '<div style="padding:2rem;color:#e63946;font-size:.875rem"><strong>Error rendering analytics:</strong> ' + err.message + '</div>'; }
      el.appendChild(c);
    }, true);

    var c = document.createElement('div');
    c.setAttribute('data-finance-content', '1');
    try { c.innerHTML = renderFinanceAnalytics(); }
    catch(err) { c.innerHTML = '<div style="padding:2rem;color:#e63946;font-size:.875rem"><strong>Error rendering analytics:</strong> ' + err.message + '</div>'; }
    el.appendChild(c);
  }

  // ── Expose to global scope ────────────────────────────────────────
  window.renderFinanceAnalytics = renderFinanceAnalytics;
  window.buildFinanceAnalytics  = buildFinanceAnalytics;

  // ── Hook into showPanel ──────────────────────────────────────────
  // shared-utils.js re-exports the original showPanel at the bottom of its
  // module, overwriting the analytics-trigger patch defined mid-module.
  // Finance.js adds its own hook here (after shared-utils loads) so the
  // call is always in the chain regardless of override ordering.
  (function() {
    var _prev = window.showPanel;
    window.showPanel = function(id, btn) {
      if (typeof _prev === 'function') _prev(id, btn);
      if (id === 'finance-analytics') buildFinanceAnalytics();
    };
  })();

})();
