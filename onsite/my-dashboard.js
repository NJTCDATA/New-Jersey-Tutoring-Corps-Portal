/* ============================================================================
   NJTC MY DASHBOARD - PERSONALIZED STAFF DASHBOARD MODULE
   New Jersey Tutoring Corps - Onsite Staff Portal
   ============================================================================ */

(function () {
  'use strict';

  // ── Helpers ─────────────────────────────────────────────────────────────────

  function esc(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function toInitials(name) {
    if (!name) return '??';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return (parts[0][0] + (parts[0][1] || '')).toUpperCase();
    return (parts[0][0] + '.' + parts[parts.length - 1][0] + '.').toUpperCase();
  }

  function attColor(rate) {
    if (rate === null || rate === undefined) return '#6b7280';
    if (rate >= 90) return '#22c55e';
    if (rate >= 75) return '#f59e0b';
    return '#ef4444';
  }

  function attLabel(rate) {
    if (rate === null || rate === undefined) return '';
    if (rate >= 90) return '✅ Solid';
    if (rate >= 75) return '⚡ Almost There';
    return '🎯 Needs Support';
  }

  function gradePillColor(grade) {
    const g = parseInt(grade, 10);
    if (isNaN(g)) return '#6b7280';
    if (g <= 2) return '#3b82f6';
    if (g <= 5) return '#22c55e';
    if (g <= 8) return '#8b5cf6';
    return '#f97316';
  }

  function scoreColor(score) {
    if (score >= 4.0) return '#22c55e';
    if (score >= 3.0) return '#f59e0b';
    return '#ef4444';
  }

  function scoreLabel(score) {
    if (score >= 4.0) return 'Great!';
    if (score >= 3.0) return 'Good';
    return 'Room to grow';
  }

  function surveyColor(rate) {
    if (rate >= 90) return '#22c55e';
    if (rate >= 70) return '#f59e0b';
    return '#ef4444';
  }

  function donutChart(pct, color, size) {
    size = size || 80;
    const r = (size / 2) - 8;
    const circ = 2 * Math.PI * r;
    const fill = pct != null ? (pct / 100) * circ : 0;
    return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" role="img" aria-label="${pct != null ? pct + '%' : 'No data'}">
      <circle cx="${size/2}" cy="${size/2}" r="${r}" fill="none" stroke="rgba(255,255,255,0.1)" stroke-width="8"/>
      <circle cx="${size/2}" cy="${size/2}" r="${r}" fill="none" stroke="${color}" stroke-width="8"
        stroke-dasharray="${fill} ${circ}" stroke-dashoffset="${circ/4}"
        stroke-linecap="round" style="transition:stroke-dasharray 1s ease"/>
      <text x="50%" y="50%" text-anchor="middle" dy=".35em" fill="#fff" font-size="${size*0.18}" font-weight="700" font-family="Epilogue,sans-serif">
        ${pct != null ? pct + '%' : '—'}
      </text>
    </svg>`;
  }

  function friendlyTutorReason(reason) {
    const map = {
      'Absent; Not Covered (Tutor not available)': 'Out — no coverage',
      'Absent; Covered by Sub Tutor': 'Out — sub covered',
      'Absent; Covered by Dual Role': 'Out — dual role covered',
      'Absent; Covered by the Site Leader': 'Out — site lead covered',
      'Absent; Covered by the Instructional Coach': 'Out — coach covered',
      'Tutor Left Early (no sub)': 'Left early'
    };
    return map[reason] || reason;
  }

  function friendlyScholarReason(reason) {
    const map = {
      'Absent': 'Student not in school',
      'Scholar declined attending tutoring session': 'Student opted out',
      'Classroom Teacher Requested to Keep Scholar in Class': 'Teacher kept student in class',
      'Scholar Left Early': 'Student left session early',
      'HADDON TWP ONLY -- Teacher requested whole group support': 'Teacher group session'
    };
    return map[reason] || reason;
  }

  function shortenSchool(school) {
    if (!school) return '';
    return school.replace(/elementary/gi, 'Elem.').replace(/middle school/gi, 'MS').replace(/high school/gi, 'HS').replace(/school/gi, 'Sch.');
  }

  // ── CSS ──────────────────────────────────────────────────────────────────────

  function injectStyles() {
    if (document.getElementById('njtc-dash-styles')) return;
    const style = document.createElement('style');
    style.id = 'njtc-dash-styles';
    style.textContent = `
      /* ── KPI Strip ── */
      .njtc-kpi-strip {
        display: flex;
        gap: 1rem;
        margin: 1.25rem 0;
        overflow-x: auto;
        padding-bottom: 0.25rem;
        scrollbar-width: thin;
        scrollbar-color: rgba(255,255,255,0.2) transparent;
      }
      .njtc-kpi-strip::-webkit-scrollbar { height: 4px; }
      .njtc-kpi-strip::-webkit-scrollbar-track { background: transparent; }
      .njtc-kpi-strip::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.2); border-radius: 4px; }

      .njtc-kpi-card {
        flex: 0 0 auto;
        min-width: 140px;
        background: rgba(255,255,255,0.08);
        border: 1px solid rgba(255,255,255,0.12);
        border-radius: 1rem;
        padding: 1rem 1.25rem;
        text-align: center;
        backdrop-filter: blur(12px);
        transition: transform 0.2s ease, box-shadow 0.2s ease;
      }
      .njtc-kpi-card:hover {
        transform: translateY(-2px);
        box-shadow: 0 8px 24px rgba(0,0,0,0.3);
      }
      .njtc-kpi-value {
        font-family: 'Epilogue', sans-serif;
        font-size: 2rem;
        font-weight: 800;
        color: #fff;
        line-height: 1;
        margin-bottom: 0.25rem;
      }
      .njtc-kpi-label {
        font-size: 0.78rem;
        font-weight: 600;
        color: rgba(255,255,255,0.7);
        text-transform: uppercase;
        letter-spacing: 0.05em;
        margin-bottom: 0.25rem;
      }
      .njtc-kpi-sub {
        font-size: 0.72rem;
        color: rgba(255,255,255,0.45);
      }

      /* ── Skeleton shimmer ── */
      @keyframes njtcShimmer {
        0% { background-position: -200% 0; }
        100% { background-position: 200% 0; }
      }
      .njtc-skeleton {
        background: linear-gradient(90deg,
          rgba(255,255,255,0.06) 25%,
          rgba(255,255,255,0.12) 50%,
          rgba(255,255,255,0.06) 75%);
        background-size: 200% 100%;
        animation: njtcShimmer 1.5s infinite;
        border-radius: 0.5rem;
      }
      .njtc-skeleton-kpi {
        width: 64px; height: 40px;
        margin: 0 auto 0.5rem;
      }
      .njtc-skeleton-line {
        height: 12px;
        margin: 4px auto;
        border-radius: 6px;
      }

      /* ── Dashboard sections ── */
      .njtc-dash-section {
        background: rgba(255,255,255,0.04);
        border: 1px solid rgba(255,255,255,0.1);
        border-radius: 1.25rem;
        padding: 1.75rem;
        margin-bottom: 1.5rem;
      }
      .njtc-section-title {
        font-family: 'Epilogue', sans-serif;
        font-size: 0.8rem;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.1em;
        color: rgba(255,255,255,0.55);
        margin-bottom: 1.25rem;
        padding-bottom: 0.75rem;
        border-bottom: 2px solid #2563eb;
        display: inline-block;
      }

      /* ── Attendance section ── */
      .njtc-att-layout {
        display: grid;
        grid-template-columns: auto 1fr;
        gap: 2rem;
        align-items: start;
      }
      @media (max-width: 640px) {
        .njtc-att-layout { grid-template-columns: 1fr; }
        .njtc-att-donut-wrap { text-align: center; }
      }
      .njtc-att-donut-wrap {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 0.5rem;
      }
      .njtc-att-donut-sub {
        font-size: 0.8rem;
        color: rgba(255,255,255,0.55);
        text-align: center;
      }
      .njtc-att-table { width: 100%; }
      .njtc-att-row {
        display: flex;
        align-items: center;
        gap: 1rem;
        padding: 0.6rem 0;
        border-bottom: 1px solid rgba(255,255,255,0.06);
      }
      .njtc-att-row:last-child { border-bottom: none; }
      .njtc-att-row-label {
        flex: 1;
        font-size: 0.9rem;
        color: rgba(255,255,255,0.8);
      }
      .njtc-att-row-count {
        font-family: 'Epilogue', sans-serif;
        font-weight: 700;
        font-size: 1.1rem;
        min-width: 2.5rem;
        text-align: right;
      }
      .njtc-att-si-note {
        font-size: 0.78rem;
        color: rgba(255,255,255,0.4);
        margin-top: 0.25rem;
        font-style: italic;
      }
      .njtc-att-reasons {
        margin-top: 0.5rem;
        padding-left: 1rem;
      }
      .njtc-att-reason-item {
        font-size: 0.8rem;
        color: rgba(255,255,255,0.5);
        margin-bottom: 0.2rem;
      }

      /* ── Bar charts ── */
      .njtc-bar-chart { display: flex; flex-direction: column; gap: 0.75rem; }
      .njtc-bar-row { display: flex; flex-direction: column; gap: 0.3rem; }
      .njtc-bar-label {
        font-size: 0.85rem;
        color: rgba(255,255,255,0.8);
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      .njtc-bar-label-count {
        font-family: 'Epilogue', sans-serif;
        font-weight: 700;
        color: #fff;
        font-size: 0.9rem;
      }
      .njtc-bar-track {
        background: rgba(255,255,255,0.08);
        border-radius: 999px;
        height: 10px;
        overflow: hidden;
      }
      .njtc-bar-fill {
        height: 100%;
        border-radius: 999px;
        transition: width 0.8s ease;
      }
      .njtc-bar-pct {
        font-size: 0.72rem;
        color: rgba(255,255,255,0.4);
        text-align: right;
      }

      /* ── Scholar grid ── */
      .njtc-scholar-filter-tabs {
        display: flex;
        gap: 0.5rem;
        margin-bottom: 1.25rem;
        flex-wrap: wrap;
      }
      .njtc-tab-btn {
        padding: 0.35rem 0.85rem;
        border-radius: 999px;
        border: 1px solid rgba(255,255,255,0.2);
        background: transparent;
        color: rgba(255,255,255,0.6);
        font-family: 'Epilogue', sans-serif;
        font-size: 0.78rem;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s ease;
      }
      .njtc-tab-btn.active, .njtc-tab-btn:hover {
        background: #2563eb;
        border-color: #2563eb;
        color: #fff;
      }
      .njtc-scholar-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
        gap: 1rem;
      }
      @media (max-width: 640px) {
        .njtc-scholar-grid { grid-template-columns: 1fr; }
      }
      .njtc-scholar-card {
        background: rgba(255,255,255,0.06);
        border: 1px solid rgba(255,255,255,0.1);
        border-radius: 1rem;
        padding: 1rem;
        transition: transform 0.2s ease, box-shadow 0.2s ease;
        cursor: default;
      }
      .njtc-scholar-card:hover {
        transform: translateY(-2px);
        box-shadow: 0 8px 24px rgba(0,0,0,0.25);
      }
      .njtc-scholar-card-top {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 0.5rem;
        margin-bottom: 0.75rem;
      }
      .njtc-grade-pill {
        display: inline-block;
        padding: 0.2rem 0.55rem;
        border-radius: 999px;
        font-family: 'Epilogue', sans-serif;
        font-size: 0.7rem;
        font-weight: 700;
        color: #fff;
        white-space: nowrap;
      }
      .njtc-scholar-name {
        font-family: 'Epilogue', sans-serif;
        font-weight: 700;
        font-size: 1rem;
        color: #fff;
        margin-bottom: 0.15rem;
      }
      .njtc-scholar-school {
        font-size: 0.75rem;
        color: rgba(255,255,255,0.5);
        margin-bottom: 0.6rem;
      }
      .njtc-scholar-att-row {
        display: flex;
        align-items: center;
        gap: 0.6rem;
        margin-bottom: 0.5rem;
      }
      .njtc-scholar-att-text {
        font-size: 0.78rem;
        color: rgba(255,255,255,0.65);
      }
      .njtc-status-badge {
        display: inline-block;
        padding: 0.2rem 0.6rem;
        border-radius: 999px;
        font-size: 0.72rem;
        font-weight: 700;
        background: rgba(255,255,255,0.1);
        color: rgba(255,255,255,0.8);
        margin-bottom: 0.4rem;
      }
      .njtc-scholar-miss-reason {
        font-size: 0.72rem;
        color: rgba(255,255,255,0.4);
        font-style: italic;
      }

      /* ── Score tiles ── */
      .njtc-score-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
        gap: 1rem;
        margin-top: 1rem;
      }
      @media (max-width: 640px) {
        .njtc-score-grid { grid-template-columns: repeat(2, 1fr); }
      }
      .njtc-score-tile {
        background: rgba(255,255,255,0.06);
        border-radius: 1rem;
        padding: 1.1rem 0.9rem;
        text-align: center;
        border: 1px solid rgba(255,255,255,0.1);
      }
      .njtc-score-value {
        font-family: 'Epilogue', sans-serif;
        font-size: 2.25rem;
        font-weight: 800;
        line-height: 1;
        margin-bottom: 0.25rem;
      }
      .njtc-score-label {
        font-size: 0.78rem;
        color: rgba(255,255,255,0.6);
        margin-bottom: 0.5rem;
      }
      .njtc-score-bar-track {
        background: rgba(255,255,255,0.1);
        border-radius: 999px;
        height: 6px;
        overflow: hidden;
        margin-bottom: 0.5rem;
      }
      .njtc-score-bar-fill {
        height: 100%;
        border-radius: 999px;
        transition: width 0.8s ease;
      }
      .njtc-score-badge {
        display: inline-block;
        padding: 0.15rem 0.5rem;
        border-radius: 999px;
        font-size: 0.68rem;
        font-weight: 700;
        background: rgba(255,255,255,0.1);
        color: rgba(255,255,255,0.75);
      }

      /* ── Survey completion bar ── */
      .njtc-survey-bar-wrap {
        margin: 1rem 0;
      }
      .njtc-survey-bar-track {
        background: rgba(255,255,255,0.08);
        border-radius: 999px;
        height: 14px;
        overflow: hidden;
        margin-bottom: 0.5rem;
      }
      .njtc-survey-bar-fill {
        height: 100%;
        border-radius: 999px;
        transition: width 0.8s ease;
      }
      .njtc-survey-pct-label {
        font-family: 'Epilogue', sans-serif;
        font-size: 1.5rem;
        font-weight: 800;
        color: #fff;
      }
      .njtc-survey-sub {
        font-size: 0.85rem;
        color: rgba(255,255,255,0.55);
        margin-top: 0.25rem;
      }

      /* ── Service interruptions collapsible ── */
      .njtc-collapsible-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        cursor: pointer;
        user-select: none;
        gap: 0.5rem;
      }
      .njtc-collapsible-header:hover { opacity: 0.85; }
      .njtc-collapsible-toggle {
        background: none;
        border: none;
        color: rgba(255,255,255,0.5);
        font-size: 1rem;
        cursor: pointer;
        padding: 0.25rem;
        transition: transform 0.25s ease;
        line-height: 1;
      }
      .njtc-collapsible-toggle.open { transform: rotate(180deg); }
      .njtc-collapsible-body {
        overflow: hidden;
        transition: max-height 0.35s ease, opacity 0.3s ease;
        max-height: 0;
        opacity: 0;
      }
      .njtc-collapsible-body.open {
        max-height: 800px;
        opacity: 1;
      }
      .njtc-si-note {
        margin-bottom: 1rem;
        padding: 0.75rem 1rem;
        background: rgba(99,102,241,0.1);
        border-left: 3px solid #6366f1;
        border-radius: 0 0.5rem 0.5rem 0;
        font-size: 0.85rem;
        color: rgba(255,255,255,0.65);
      }

      /* ── Empty states ── */
      .njtc-empty-state {
        text-align: center;
        padding: 2rem 1rem;
        color: rgba(255,255,255,0.45);
        font-size: 0.9rem;
        line-height: 1.6;
      }
      .njtc-empty-icon { font-size: 2rem; margin-bottom: 0.5rem; }

      /* ── Error state ── */
      .njtc-error-state {
        text-align: center;
        padding: 2rem 1rem;
        color: rgba(252,165,165,0.9);
        font-size: 0.85rem;
      }
      .njtc-section-sub {
        font-size: 0.82rem;
        color: rgba(255,255,255,0.45);
        margin-bottom: 1rem;
        display: block;
      }
      .njtc-count-badge {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 1.6rem;
        height: 1.6rem;
        border-radius: 50%;
        background: #2563eb;
        color: #fff;
        font-family: 'Epilogue', sans-serif;
        font-size: 0.75rem;
        font-weight: 700;
        margin-left: 0.5rem;
        vertical-align: middle;
      }
      .njtc-scholars-heading {
        display: flex;
        align-items: center;
        gap: 0;
        margin-bottom: 1rem;
      }
      .njtc-section-heading-text {
        font-family: 'Epilogue', sans-serif;
        font-size: 1rem;
        font-weight: 700;
        color: #fff;
      }
    `;
    document.head.appendChild(style);
  }

  // ── Skeleton builders ────────────────────────────────────────────────────────

  function kpiSkeletonCard(label, sub) {
    return `<div class="njtc-kpi-card">
      <div class="njtc-skeleton njtc-skeleton-kpi"></div>
      <div class="njtc-kpi-label">${esc(label)}</div>
      <div class="njtc-kpi-sub">${esc(sub)}</div>
    </div>`;
  }

  function sectionSkeleton() {
    return `<div class="njtc-dash-section">
      <div class="njtc-skeleton njtc-skeleton-line" style="width:140px;margin-bottom:1.25rem;height:14px;"></div>
      <div class="njtc-skeleton njtc-skeleton-line" style="width:100%;margin-bottom:0.5rem;"></div>
      <div class="njtc-skeleton njtc-skeleton-line" style="width:80%;margin-bottom:0.5rem;"></div>
      <div class="njtc-skeleton njtc-skeleton-line" style="width:60%;"></div>
    </div>`;
  }

  // ── KPI strip builder ────────────────────────────────────────────────────────

  function buildKPIStrip() {
    const strip = document.createElement('div');
    strip.id = 'njtc-kpi-strip';
    strip.className = 'njtc-kpi-strip';
    strip.innerHTML =
      kpiSkeletonCard('My Attendance', 'Goal: 90%') +
      kpiSkeletonCard('Sessions Done', 'this school year') +
      kpiSkeletonCard('Students I Work With', 'across my sessions') +
      kpiSkeletonCard('Surveys Filed', 'keep it at 100%');
    return strip;
  }

  function fillKPIStrip(strip, data) {
    const attRate = data.myAttRate;
    const color = attColor(attRate);
    strip.innerHTML = `
      <div class="njtc-kpi-card">
        <div class="njtc-kpi-value" style="color:${color};">${attRate !== null ? attRate + '%' : '—'}</div>
        <div class="njtc-kpi-label">My Attendance</div>
        <div class="njtc-kpi-sub">Goal: 90%</div>
      </div>
      <div class="njtc-kpi-card">
        <div class="njtc-kpi-value">${data.myAttended}</div>
        <div class="njtc-kpi-label">Sessions Done</div>
        <div class="njtc-kpi-sub">this school year</div>
      </div>
      <div class="njtc-kpi-card">
        <div class="njtc-kpi-value">${data.scholars.length}</div>
        <div class="njtc-kpi-label">Students I Work With</div>
        <div class="njtc-kpi-sub">across my sessions</div>
      </div>
      <div class="njtc-kpi-card">
        <div class="njtc-kpi-value" style="color:${surveyColor(data.surveyRate || 0)};">${data.surveyRate !== null ? data.surveyRate + '%' : '—'}</div>
        <div class="njtc-kpi-label">Surveys Filed</div>
        <div class="njtc-kpi-sub">keep it at 100%</div>
      </div>`;
  }

  // ── Section 1: Attendance ────────────────────────────────────────────────────

  function buildAttendanceSection(data) {
    const el = document.createElement('div');
    el.className = 'njtc-dash-section';

    if (!data.hasData) {
      el.innerHTML = `<span class="njtc-section-title">📅 Your Attendance This Year</span>
        <div class="njtc-empty-state">
          <div class="njtc-empty-icon">📅</div>
          <p>Your attendance data will appear here once sessions start.</p>
        </div>`;
      return el;
    }

    const attRate = data.myAttRate;
    const color = attColor(attRate);
    const chart = donutChart(attRate, color, 160);

    const reasonsHtml = Object.keys(data.myMissedReasons).length
      ? `<div class="njtc-att-reasons">
          ${Object.entries(data.myMissedReasons).map(([r, c]) =>
            `<div class="njtc-att-reason-item">• ${esc(friendlyTutorReason(r))}: ${c}</div>`
          ).join('')}
        </div>`
      : '';

    el.innerHTML = `<span class="njtc-section-title">📅 Your Attendance This Year</span>
      <div class="njtc-att-layout">
        <div class="njtc-att-donut-wrap">
          ${chart}
          <div class="njtc-att-donut-sub">${data.myAttended} sessions attended</div>
        </div>
        <div class="njtc-att-table">
          <div class="njtc-att-row">
            <div class="njtc-att-row-label">✅ You showed up</div>
            <div class="njtc-att-row-count" style="color:#22c55e;">${data.myAttended}</div>
          </div>
          <div class="njtc-att-row">
            <div class="njtc-att-row-label">
              <div>Missed sessions</div>
              ${reasonsHtml}
            </div>
            <div class="njtc-att-row-count" style="color:#ef4444;">${data.myAbsent}</div>
          </div>
          <div class="njtc-att-row">
            <div class="njtc-att-row-label">
              <div style="color:rgba(255,255,255,0.5);">📅 School closings &amp; interruptions</div>
              <div class="njtc-att-si-note">These don't count against you</div>
            </div>
            <div class="njtc-att-row-count" style="color:rgba(255,255,255,0.4);">${data.mySI}</div>
          </div>
        </div>
      </div>`;

    requestAnimationFrame(() => {
      const circles = el.querySelectorAll('circle[stroke-dasharray]');
      circles.forEach(c => {
        const da = c.getAttribute('stroke-dasharray');
        c.setAttribute('stroke-dasharray', '0 9999');
        requestAnimationFrame(() => { c.setAttribute('stroke-dasharray', da); });
      });
    });

    return el;
  }

  // ── Section 2: Why You Missed ────────────────────────────────────────────────

  function buildMissedSection(data) {
    if (!data.myAbsent) return null;

    const reasons = Object.entries(data.myMissedReasons);
    if (!reasons.length) return null;

    const max = Math.max(...reasons.map(([, c]) => c));
    const el = document.createElement('div');
    el.className = 'njtc-dash-section';

    const bars = reasons.map(([r, c]) => {
      const pct = max > 0 ? Math.round((c / max) * 100) : 0;
      return `<div class="njtc-bar-row">
        <div class="njtc-bar-label">
          <span>${esc(friendlyTutorReason(r))}</span>
          <span class="njtc-bar-label-count">${c}</span>
        </div>
        <div class="njtc-bar-track">
          <div class="njtc-bar-fill" style="width:${pct}%;background:#ef4444;"></div>
        </div>
      </div>`;
    }).join('');

    el.innerHTML = `<span class="njtc-section-title">Why You Missed</span>
      <div class="njtc-bar-chart">${bars}</div>`;

    return el;
  }

  // ── Section 3: Your Students ─────────────────────────────────────────────────

  function buildScholarSection(data) {
    const el = document.createElement('div');
    el.className = 'njtc-dash-section';

    if (!data.scholars.length) {
      el.innerHTML = `<span class="njtc-section-title">👥 Your Students</span>
        <div class="njtc-empty-state">
          <div class="njtc-empty-icon">👥</div>
          <p>No student data yet — check back after your first sessions.</p>
        </div>`;
      return el;
    }

    function renderGrid(list) {
      if (!list.length) {
        return `<div class="njtc-empty-state"><p>No students in this group.</p></div>`;
      }
      return `<div class="njtc-scholar-grid">` + list.map(s => {
        const color = attColor(s.attRate);
        const gColor = gradePillColor(s.grade);
        const gradeLabel = s.grade ? 'Grade ' + s.grade : 'N/A';
        const topReason = Object.entries(s.missReasons).sort((a, b) => b[1] - a[1])[0];
        const chart = donutChart(s.attRate, color, 44);
        return `<div class="njtc-scholar-card">
          <div class="njtc-scholar-card-top">
            <span class="njtc-grade-pill" style="background:${gColor};">${esc(gradeLabel)}</span>
          </div>
          <div class="njtc-scholar-name">${esc(toInitials(s.name))}</div>
          <div class="njtc-scholar-school">${esc(shortenSchool(s.school))}</div>
          <div class="njtc-scholar-att-row">
            ${chart}
            <span class="njtc-scholar-att-text">Attended ${s.attended} of ${s.totalSessions}</span>
          </div>
          <div class="njtc-status-badge">${attLabel(s.attRate)}</div>
          ${topReason ? `<div class="njtc-scholar-miss-reason">Often: ${esc(friendlyScholarReason(topReason[0]))}</div>` : ''}
        </div>`;
      }).join('') + `</div>`;
    }

    const allHtml = renderGrid(data.scholars);
    const needsHtml = renderGrid(data.scholars.filter(s => s.attRate !== null && s.attRate < 75));
    const goodHtml = renderGrid(data.scholars.filter(s => s.attRate !== null && s.attRate >= 90));

    el.innerHTML = `
      <div class="njtc-scholars-heading">
        <span class="njtc-section-title" style="margin-bottom:0;padding-bottom:0;border-bottom:none;">👥 Your Students</span>
        <span class="njtc-count-badge">${data.scholars.length}</span>
      </div>
      <div class="njtc-scholar-filter-tabs" style="margin-top:0.75rem;">
        <button class="njtc-tab-btn active" data-tab="all">All</button>
        <button class="njtc-tab-btn" data-tab="needs">🎯 Need Attention</button>
        <button class="njtc-tab-btn" data-tab="good">✅ Good</button>
      </div>
      <div id="njtc-scholar-tab-all">${allHtml}</div>
      <div id="njtc-scholar-tab-needs" style="display:none;">${needsHtml}</div>
      <div id="njtc-scholar-tab-good" style="display:none;">${goodHtml}</div>
    `;

    el.querySelectorAll('.njtc-tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        el.querySelectorAll('.njtc-tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const tab = btn.dataset.tab;
        el.querySelector('#njtc-scholar-tab-all').style.display = tab === 'all' ? '' : 'none';
        el.querySelector('#njtc-scholar-tab-needs').style.display = tab === 'needs' ? '' : 'none';
        el.querySelector('#njtc-scholar-tab-good').style.display = tab === 'good' ? '' : 'none';
      });
    });

    requestAnimationFrame(() => {
      el.querySelectorAll('circle[stroke-dasharray]').forEach(c => {
        const da = c.getAttribute('stroke-dasharray');
        c.setAttribute('stroke-dasharray', '0 9999');
        requestAnimationFrame(() => { c.setAttribute('stroke-dasharray', da); });
      });
    });

    return el;
  }

  // ── Section 4: Why Students Miss ────────────────────────────────────────────

  function buildScholarMissedSection(data) {
    const reasons = Object.entries(data.scholarMissedReasons);
    if (!reasons.length) return null;

    const total = reasons.reduce((s, [, c]) => s + c, 0);
    const max = Math.max(...reasons.map(([, c]) => c));

    const el = document.createElement('div');
    el.className = 'njtc-dash-section';

    const bars = reasons.sort((a, b) => b[1] - a[1]).map(([r, c]) => {
      const pct = max > 0 ? Math.round((c / max) * 100) : 0;
      const pctOfTotal = total > 0 ? Math.round((c / total) * 100) : 0;
      return `<div class="njtc-bar-row">
        <div class="njtc-bar-label">
          <span>${esc(friendlyScholarReason(r))}</span>
          <span class="njtc-bar-label-count">${c}</span>
        </div>
        <div class="njtc-bar-track">
          <div class="njtc-bar-fill" style="width:${pct}%;background:#f59e0b;"></div>
        </div>
        <div class="njtc-bar-pct">${pctOfTotal}% of missed sessions</div>
      </div>`;
    }).join('');

    el.innerHTML = `<span class="njtc-section-title">💬 Why Your Students Miss Sessions</span>
      <div class="njtc-si-note">
        School closings and interruptions are shown separately and don't affect your students' attendance record.
      </div>
      <div class="njtc-bar-chart">${bars}</div>`;

    return el;
  }

  // ── Section 5: Student Scores ────────────────────────────────────────────────

  function buildScoresSection(data) {
    if (!data.stuAvgScores || data.stuAvgScores.count === 0) return null;

    const s = data.stuAvgScores;
    const tiles = [
      { key: 'confidence', label: 'Feeling Confident', color: '#3b82f6', value: s.confidence },
      { key: 'enjoyment', label: 'Enjoying Sessions', color: '#22c55e', value: s.enjoyment },
      { key: 'learning', label: 'Feeling Like They\'re Learning', color: '#8b5cf6', value: s.learning },
      { key: 'overall', label: 'Overall', color: '#f59e0b', value: s.overall }
    ];

    const tilesHtml = tiles.map(t => {
      if (t.value === null) return '';
      const pct = Math.round((t.value / 5) * 100);
      return `<div class="njtc-score-tile">
        <div class="njtc-score-value" style="color:${t.color};">${t.value}</div>
        <div class="njtc-score-label">${esc(t.label)}</div>
        <div class="njtc-score-bar-track">
          <div class="njtc-score-bar-fill" style="width:${pct}%;background:${t.color};"></div>
        </div>
        <span class="njtc-score-badge" style="color:${scoreColor(t.value)};">${scoreLabel(t.value)}</span>
      </div>`;
    }).join('');

    const el = document.createElement('div');
    el.className = 'njtc-dash-section';
    el.innerHTML = `<span class="njtc-section-title">📊 What Your Students Think</span>
      <span class="njtc-section-sub">Based on ${data.stuAvgScores.count} survey response${data.stuAvgScores.count !== 1 ? 's' : ''} from your students</span>
      <div class="njtc-score-grid">${tilesHtml}</div>`;

    return el;
  }

  // ── Section 6: Survey Completion ────────────────────────────────────────────

  function buildSurveySection(data) {
    const el = document.createElement('div');
    el.className = 'njtc-dash-section';

    const rate = data.surveyRate;
    const color = surveyColor(rate || 0);
    const pct = rate !== null ? rate : 0;
    const perfect = rate === 100;

    el.innerHTML = `<span class="njtc-section-title">💬 My Survey Completion</span>
      <div class="njtc-survey-pct-label" style="color:${color};">${rate !== null ? rate + '%' : '—'}${perfect ? ' 🎉' : ''}</div>
      <div class="njtc-survey-bar-wrap">
        <div class="njtc-survey-bar-track">
          <div class="njtc-survey-bar-fill" style="width:${pct}%;background:${color};"></div>
        </div>
      </div>
      <div class="njtc-survey-sub">You've submitted ${data.surveyCount} survey${data.surveyCount !== 1 ? 's' : ''} for ${data.myAttended} attended session${data.myAttended !== 1 ? 's' : ''}.</div>`;

    return el;
  }

  // ── Section 7: School Closings (collapsible) ─────────────────────────────────

  function buildSISection(data) {
    if (!data.serviceInterruptions) return null;

    const reasons = Object.entries(data.siReasons);
    const max = reasons.length ? Math.max(...reasons.map(([, c]) => c)) : 1;

    const bars = reasons.sort((a, b) => b[1] - a[1]).map(([r, c]) => {
      const pct = max > 0 ? Math.round((c / max) * 100) : 0;
      return `<div class="njtc-bar-row">
        <div class="njtc-bar-label">
          <span>${esc(r || 'Unknown reason')}</span>
          <span class="njtc-bar-label-count">${c}</span>
        </div>
        <div class="njtc-bar-track">
          <div class="njtc-bar-fill" style="width:${pct}%;background:#6366f1;"></div>
        </div>
      </div>`;
    }).join('');

    const el = document.createElement('div');
    el.className = 'njtc-dash-section';

    el.innerHTML = `
      <div class="njtc-collapsible-header" id="njtc-si-header">
        <span class="njtc-section-title" style="margin-bottom:0;padding-bottom:0;border-bottom:none;">
          📅 School Closings &amp; Schedule Changes
          <span style="font-size:0.8em;font-weight:400;color:rgba(255,255,255,0.45);margin-left:0.5rem;">(${data.serviceInterruptions} this year — not counted against anyone)</span>
        </span>
        <button class="njtc-collapsible-toggle" id="njtc-si-toggle" aria-expanded="false" aria-controls="njtc-si-body">▼</button>
      </div>
      <div class="njtc-collapsible-body" id="njtc-si-body">
        <div style="margin-top:1rem;">
          <div class="njtc-si-note">These are school closings, holidays, and testing days — they are NOT counted against you or your students' attendance.</div>
          ${bars ? `<div class="njtc-bar-chart">${bars}</div>` : '<div class="njtc-empty-state"><p>No breakdown available.</p></div>'}
        </div>
      </div>`;

    const header = el.querySelector('#njtc-si-header');
    const toggle = el.querySelector('#njtc-si-toggle');
    const body = el.querySelector('#njtc-si-body');

    header.addEventListener('click', () => {
      const isOpen = body.classList.toggle('open');
      toggle.classList.toggle('open', isOpen);
      toggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    });

    return el;
  }

  // ── Error section ────────────────────────────────────────────────────────────

  function buildErrorSection(msg) {
    const el = document.createElement('div');
    el.className = 'njtc-dash-section';
    el.innerHTML = `<div class="njtc-error-state">
      <div style="font-size:1.5rem;margin-bottom:0.5rem;">⚠️</div>
      <p>${esc(msg || 'Data temporarily unavailable — try refreshing.')}</p>
    </div>`;
    return el;
  }

  // ── Main build function ──────────────────────────────────────────────────────

  async function build(user) {
    if (!user || !user.pearlId) return;

    injectStyles();

    // -- KPI strip (hero area) --
    const heroContent = document.querySelector('.hero-content');
    const roleSelectorCard = document.querySelector('.role-selector-card');
    let kpiStrip = document.getElementById('njtc-kpi-strip');
    if (!kpiStrip) {
      kpiStrip = buildKPIStrip();
      if (heroContent && roleSelectorCard) {
        heroContent.insertBefore(kpiStrip, roleSelectorCard);
      } else if (heroContent) {
        heroContent.appendChild(kpiStrip);
      }
    }

    // -- Dashboard placeholder sections --
    const dashContainer = document.querySelector('#dashboard .container');
    let dashPlaceholder = document.getElementById('njtc-dash-placeholder');
    if (!dashPlaceholder && dashContainer) {
      dashPlaceholder = document.createElement('div');
      dashPlaceholder.id = 'njtc-dash-placeholder';
      const platformsSection = dashContainer.querySelector('.platforms-section');
      if (platformsSection) {
        dashContainer.insertBefore(dashPlaceholder, platformsSection);
      } else {
        dashContainer.prepend(dashPlaceholder);
      }
      // Show loading skeletons
      dashPlaceholder.innerHTML =
        sectionSkeleton() + sectionSkeleton() + sectionSkeleton();
    }

    // -- Fetch data --
    let data;
    try {
      if (!window.NJTCPearlData) throw new Error('NJTCPearlData not loaded');
      data = await window.NJTCPearlData.fetchUserData(user.pearlId);
    } catch (err) {
      if (kpiStrip) {
        kpiStrip.innerHTML = `<div class="njtc-kpi-card"><div class="njtc-kpi-label" style="color:rgba(252,165,165,0.8);">Data unavailable — try refreshing</div></div>`;
      }
      if (dashPlaceholder) {
        dashPlaceholder.innerHTML = '';
        dashPlaceholder.appendChild(buildErrorSection());
      }
      return;
    }

    // -- Fill KPI strip --
    fillKPIStrip(kpiStrip, data);

    // -- Build dashboard sections --
    if (dashPlaceholder) {
      dashPlaceholder.innerHTML = '';

      const sections = [
        buildAttendanceSection(data),
        buildMissedSection(data),
        buildScholarSection(data),
        buildScholarMissedSection(data),
        buildScoresSection(data),
        buildSurveySection(data),
        buildSISection(data)
      ].filter(Boolean);

      sections.forEach(s => dashPlaceholder.appendChild(s));

      // Trigger SVG animations after paint
      requestAnimationFrame(() => {
        dashPlaceholder.querySelectorAll('circle[stroke-dasharray]').forEach(c => {
          const da = c.getAttribute('stroke-dasharray');
          c.setAttribute('stroke-dasharray', '0 9999');
          requestAnimationFrame(() => { c.setAttribute('stroke-dasharray', da); });
        });
      });
    }
  }

  window.NJTCMyDashboard = { build };
})();
