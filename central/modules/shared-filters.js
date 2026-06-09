(function() {

  function initDeptNav(dept) {
    // Show/hide perf + talent + concern nav based on dept
    const perfBtns    = document.querySelectorAll('.dept-nav-perf');
    const concernBtns = document.querySelectorAll('.dept-nav-concern');
    const talentBtns  = document.querySelectorAll('.dept-nav-talent');
    const label       = document.getElementById('talentNavLabel');

    const showPerf    = TALENT_FULL_DEPTS.includes(dept);
    const showConcern = ['hr','programming','data'].includes(dept);
    const showTalent  = TALENT_FULL_DEPTS.includes(dept) || TALENT_FINANCE_DEPT.includes(dept) || TALENT_TRAINING_DEPT.includes(dept);

    perfBtns.forEach(b    => b.style.display = showPerf    ? '' : 'none');
    concernBtns.forEach(b => b.style.display = showConcern ? '' : 'none');
    talentBtns.forEach(b  => b.style.display = showTalent  ? '' : 'none');

    // Rename the talent nav link and panel for finance/training
    if (dept === 'finance') {
      if (label) label.textContent = 'Partnership Risk';
      talentBtns.forEach(b => {
        b.setAttribute('data-panel', 'finance-analytics');
        b.setAttribute('onclick', "showPanel('finance-analytics',this)");
        b.onclick = () => showPanel('finance-analytics', b);
      });
    } else if (dept === 'training') {
      if (label) label.textContent = 'T&D Analytics';
      talentBtns.forEach(b => {
        b.setAttribute('data-panel', 'training-analytics');
        b.onclick = () => showPanel('training-analytics', b);
      });
    } else {
      if (label) label.textContent = 'Talent Analytics';
      talentBtns.forEach(b => {
        b.setAttribute('data-panel', 'talent');
        b.onclick = () => showPanel('talent', b);
      });
    }

    // Training & Development dept: show Checklist Mgmt tab
    const mgmtTabs = document.querySelectorAll('.td-mgmt-tab');
    mgmtTabs.forEach(b => b.style.display = (dept === 'training') ? '' : 'none');

    // Data + Programming dept: show T&D/Apprentice Analytics sidebar link
    // Also show for Finance, HR, Leadership, and KB as a dedicated TAP section
    const dataTDBtns = document.querySelectorAll('.dept-nav-td-data');
    const TAP_VISIBLE_DEPTS = ['data', 'programming', 'training', 'finance', 'hr', 'leadership', 'kb'];
    dataTDBtns.forEach(b => {
      b.style.display = TAP_VISIBLE_DEPTS.includes(dept) ? '' : 'none';
      // dept-nav-td-data always points to T&D Analytics panel (training-analytics)
      // It should ALWAYS be labeled T&D Analytics — it is the T&D section, not TAP
      b.textContent = '🎓 T&D Analytics';
      b.title = 'Training and Development program performance and staff outcome data';
    });
    // TAP Standalone Dashboard — visible to all departments that interact with the apprenticeship program
    const TAP_STANDALONE_DEPTS = ['data', 'programming', 'training', 'finance', 'hr', 'leadership', 'kb'];
    document.querySelectorAll('.dept-nav-tap-standalone').forEach(b => {
      b.style.display = TAP_STANDALONE_DEPTS.includes(dept) ? '' : 'none';
      // Update the label span to match department context
      const labelSpan = b.querySelector('.dept-nav-tap-standalone-label');
      if (labelSpan) {
        if (['programming', 'hr', 'training'].includes(dept)) {
          labelSpan.textContent = 'Apprentice Analytics';
          b.title = 'Apprentice Analytics — OJT activity tracking, phase completion, and program outcomes';
        } else {
          labelSpan.textContent = 'TAP Dashboard';
          b.title = 'TAP Apprenticeship Dashboard — active roster, OJT progress, wage milestones, and program completion';
        }
      }
    });

    // TAP sub-tab visibility rules (some tabs are dept-specific)
    const tapFinanceTabs = document.querySelectorAll('.dept-tap-finance');
    tapFinanceTabs.forEach(b => b.style.display = ['finance', 'hr', 'leadership', 'kb', 'data'].includes(dept) ? '' : 'none');
    const tapLogTabs = document.querySelectorAll('.dept-tap-log');
    tapLogTabs.forEach(b => b.style.display = ['programming', 'training', 'data'].includes(dept) ? '' : 'none');

    // T&D PDF button — visible for data, leadership, kb, and training depts
    const execPDFBtn = document.getElementById('tdExecPDFBtn');
    if (execPDFBtn) {
      const showPDF = ['data','leadership','kb','training'].includes(dept);
      execPDFBtn.style.display = showPDF ? '' : 'none';
      // Label varies by audience
      if (showPDF) execPDFBtn.textContent = ['leadership','kb'].includes(dept) ? '📄 Executive PDF' : '📄 T&D Report PDF';
    }

    // Pearl Operations PDF buttons — Data dept only
    document.querySelectorAll('.po-pdf-data-only').forEach(b => b.style.display = (dept === 'data') ? '' : 'none');

    // Pearl Operations Ticket System — Programming, Data, Leadership, KB
    const TICKET_DEPTS = ['programming','data','leadership','kb'];
    document.querySelectorAll('.po-ticket-btn').forEach(b =>
      b.style.display = TICKET_DEPTS.includes(dept) ? '' : 'none'
    );

    // Impact Report Builder — Data dept only
    document.querySelectorAll('.dept-nav-irb').forEach(b => b.style.display = (dept === 'data') ? '' : 'none');

    // Show export button only for leadership and kb
    const expBtn = document.getElementById('sidebarExportBtn');
    if (expBtn) {
      if (dept === 'leadership' || dept === 'kb') {
        expBtn.classList.add('visible');
      } else {
        expBtn.classList.remove('visible');
      }
    }

    // Show advocacy nav for leadership and kb only — Data dept has i-Ready Lab (upload access), not Advocacy
    const ADV_DEPTS = ['leadership','kb'];
    const advBtns = document.querySelectorAll('.dept-nav-advocacy');
    advBtns.forEach(b => b.style.display = ADV_DEPTS.includes(dept) ? '' : 'none');

    // Survey Feedback — visible to programming, data, leadership, kb
    const SURVEY_DEPTS = ['programming','data','leadership','kb'];
    document.querySelectorAll('.dept-nav-survey').forEach(b =>
      b.style.display = SURVEY_DEPTS.includes(dept) ? '' : 'none'
    );

    // Drive Center (upload) — Leadership, Data, and KB only
    const UPLOAD_DEPTS = ['leadership','data','kb'];
    document.querySelectorAll('.dept-nav-upload').forEach(b =>
      b.style.display = UPLOAD_DEPTS.includes(dept) ? '' : 'none'
    );

    // Data Sources File Cabinet — Data dept only
    document.querySelectorAll('.dept-nav-data-cabinet').forEach(b =>
      b.style.display = (dept === 'data') ? '' : 'none'
    );

  }

  // ── Year extraction helpers ────────────────────────────────────
  function getAvailableYears() {
    const years = [...new Set(CONCERNS.map(c => c.yr))].sort((a,b) => b-a);
    if (!years.length) years.push(new Date().getFullYear());
    return years;
  }

  function getSchoolYear(yr) {
    // School year: SY25-26 means Jul 2025 – Jun 2026
    return `SY${String(yr-1).slice(2)}-${String(yr).slice(2)}`;
  }

  function addYearFilter(containerId, filterFn, defaultAll) {
    const el = document.getElementById(containerId);
    if (!el) return;
    const years = getAvailableYears();
    const wrap = document.createElement('div');
    wrap.style.cssText = 'display:flex;gap:.5rem;align-items:center;margin-bottom:1rem;flex-wrap:wrap';
    wrap.innerHTML = `<span style="font-size:.75rem;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.07em">Year</span>
      <button class="pst-tab active" data-yr="all" onclick="__setYr(this,'all','${containerId}')">All Years</button>
      ${years.map(y => `<button class="pst-tab" data-yr="${y}" onclick="__setYr(this,${y},'${containerId}')">${y} <span style="font-size:.65rem;opacity:.6">${getSchoolYear(y)}</span></button>`).join('')}
      <span id="${containerId}_yrcount" style="font-size:.75rem;color:var(--muted);margin-left:.5rem"></span>`;
    el.prepend(wrap);
    window[`__yrFilter_${containerId}`] = defaultAll ? 'all' : (years[0] || 'all');
    window[`__yrFilterFn_${containerId}`] = filterFn;
  }

  window.__setYr = function(btn, yr, containerId) {
    document.querySelectorAll(`#${containerId} .pst-tab[data-yr]`).forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    window[`__yrFilter_${containerId}`] = yr;
    const fn = window[`__yrFilterFn_${containerId}`];
    if (fn) fn(yr === 'all' ? null : Number(yr));
  };

  function filterByYear(data, yr) {
    if (!yr || yr === 'all') return data;
    return data.filter(c => c.yr === Number(yr));
  }

  // ── Shared render utilities ────────────────────────────────────
  // (countBy, groupBy, barRows, hrActionClass, etc. are already defined above)

  function goalAlignmentBadges(dept) {
    const goals = GOAL_DEPT_MAP[dept] || [];
    if (!goals.length) return '';
    return `<div style="display:flex;gap:.375rem;flex-wrap:wrap;margin-bottom:1.25rem">
      ${goals.map(g => `<span style="font-size:.7rem;font-weight:700;padding:.3rem .7rem;border-radius:20px;background:rgba(240,165,0,.12);color:#92400e;border:1px solid rgba(240,165,0,.3)">🎯 ${g}</span>`).join('')}
    </div>`;
  }

  function retentionRing(label, current, target, color) {
    const pct = Math.min(100, Math.round(current / target * 100));
    const r = 30, circ = 2 * Math.PI * r;
    const dash = (pct / 100) * circ;
    const status = pct >= 100 ? 'ok' : pct >= 75 ? 'warning' : 'alert';
    return `<div class="ta-card" style="text-align:center;padding:1.25rem .875rem">
      <svg width="80" height="80" style="transform:rotate(-90deg)">
        <circle cx="40" cy="40" r="${r}" fill="none" stroke="#e5e7eb" stroke-width="6"/>
        <circle cx="40" cy="40" r="${r}" fill="none" stroke="${color}" stroke-width="6"
          stroke-dasharray="${dash.toFixed(1)} ${circ.toFixed(1)}" stroke-linecap="round"/>
      </svg>
      <div style="font-size:1.375rem;font-weight:800;color:${color};margin-top:-.25rem">${pct}%</div>
      <div style="font-size:.75rem;font-weight:700;color:var(--navy);margin-top:.2rem">${label}</div>
      <div style="font-size:.7rem;color:var(--muted)">Goal: ${target}%</div>
    </div>`;
  }

  // ════════════════════════════════════════════════════════════════
  //  HR ANALYTICS — Escalation pipeline, risk, action queue

  // ── TAP panel sub-tab switcher ─────────────────────────────
  window.tapShowTab = function(id, btn) {
    document.querySelectorAll('#tapTabNav .pst-tab').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
    document.querySelectorAll('[id^="tap-content-"]').forEach(el => el.style.display = 'none');
    const target = document.getElementById('tap-content-' + id);
    if (target) {
      target.style.display = '';
      if (!target.dataset.loaded) {
        target.dataset.loaded = '1';
        if (window.NJTCTapDash && typeof window.NJTCTapDash.renderTab === 'function') {
          window.NJTCTapDash.renderTab(id, target);
        } else {
          // Delegate to Training & Development module which has the full TAP dataset
          if (id === 'overview' || id === 'roster' || id === 'ojt' || id === 'milestones') {
            target.innerHTML = '<div style="padding:2rem;text-align:center;color:var(--muted)">Loading TAP data… make sure training-development.js is loaded.</div>';
            if (window.tdShowTab) {
              // Re-use the apprentice tab from T&D for cross-portal consistency
              if (id === 'ojt' || id === 'overview') window.tdShowTab('apprentice', null);
              if (id === 'ojt-log') window.tdShowTab('otj-overview', null);
            }
          }
        }
      }
    }
  };

  // ── Expose to global scope ───────────────────────────────────────────────
  window.initDeptNav           = initDeptNav;
  window.addYearFilter         = addYearFilter;
  window.getAvailableYears     = getAvailableYears;
  window.filterByYear          = filterByYear;
  window.goalAlignmentBadges   = goalAlignmentBadges;
  window.retentionRing         = retentionRing;

})();
