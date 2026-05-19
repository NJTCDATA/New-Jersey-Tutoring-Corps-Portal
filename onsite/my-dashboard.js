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
    if (score === null || score === undefined) return 'rgba(255,255,255,0.4)';
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
        border-bottom: 2px solid #FFB81C;
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
        background: #FFB81C;
        border-color: #FFB81C;
        color: #001a33;
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

      /* ── Logout / Switch User buttons ── */
      .njtc-logout-strip {
        display: flex;
        gap: 0.75rem;
        justify-content: center;
        flex-wrap: wrap;
        margin: 1rem 0 0;
      }
      .njtc-switch-btn {
        display: inline-flex;
        align-items: center;
        gap: 0.45rem;
        padding: 0.5rem 1.1rem;
        border-radius: 999px;
        border: 1px solid rgba(255,255,255,0.25);
        background: rgba(255,255,255,0.08);
        color: rgba(255,255,255,0.8);
        font-family: 'Epilogue', sans-serif;
        font-size: 0.8rem;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s ease;
        backdrop-filter: blur(8px);
        text-decoration: none;
      }
      .njtc-switch-btn:hover {
        background: rgba(255,255,255,0.16);
        color: #fff;
        border-color: rgba(255,255,255,0.45);
      }
      .njtc-signout-btn {
        border-color: rgba(239,68,68,0.35);
        color: rgba(252,165,165,0.85);
      }
      .njtc-signout-btn:hover {
        background: rgba(239,68,68,0.18);
        border-color: rgba(239,68,68,0.6);
        color: #fca5a5;
      }
      .njtc-floating-logout {
        position: fixed;
        bottom: 1.5rem;
        right: 1.5rem;
        z-index: 8888;
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
        align-items: flex-end;
      }
      @media (max-width: 640px) {
        .njtc-floating-logout { bottom: 1rem; right: 1rem; }
      }
      .njtc-header-switch-btn {
        display: inline-flex;
        align-items: center;
        gap: 0.4rem;
        padding: 0.45rem 0.9rem;
        border-radius: 999px;
        border: 1px solid rgba(255,255,255,0.2);
        background: rgba(255,255,255,0.08);
        color: rgba(255,255,255,0.75);
        font-family: 'Epilogue', sans-serif;
        font-size: 0.78rem;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s ease;
      }
      .njtc-header-switch-btn:hover {
        background: rgba(255,255,255,0.15);
        color: #fff;
      }

      /* ── iReady Moving the Needle ── */
      .njtc-ir-kpi-row {
        display: flex;
        gap: 0.75rem;
        flex-wrap: wrap;
        margin-bottom: 1.25rem;
      }
      .njtc-ir-kpi {
        flex: 1 1 100px;
        background: rgba(255,255,255,0.06);
        border: 1px solid rgba(255,255,255,0.1);
        border-radius: 0.875rem;
        padding: 0.85rem 1rem;
        text-align: center;
        min-width: 90px;
      }
      .njtc-ir-kpi-val {
        font-family: 'Epilogue', sans-serif;
        font-size: 1.75rem;
        font-weight: 800;
        line-height: 1;
        margin-bottom: 0.2rem;
      }
      .njtc-ir-kpi-lbl {
        font-size: 0.72rem;
        font-weight: 600;
        color: rgba(255,255,255,0.55);
        text-transform: uppercase;
        letter-spacing: 0.05em;
      }
      .njtc-ir-filter-row {
        display: flex;
        gap: 0.5rem;
        flex-wrap: wrap;
        margin-bottom: 1rem;
        align-items: center;
      }
      .njtc-ir-filter-label {
        font-size: 0.75rem;
        color: rgba(255,255,255,0.4);
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        margin-right: 0.25rem;
      }
      .njtc-ir-table {
        width: 100%;
        border-collapse: collapse;
        font-size: 0.85rem;
      }
      .njtc-ir-table th {
        text-align: left;
        font-size: 0.7rem;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.06em;
        color: rgba(255,255,255,0.4);
        padding: 0.4rem 0.6rem;
        border-bottom: 1px solid rgba(255,255,255,0.08);
      }
      .njtc-ir-table td {
        padding: 0.55rem 0.6rem;
        border-bottom: 1px solid rgba(255,255,255,0.05);
        vertical-align: middle;
        color: rgba(255,255,255,0.85);
      }
      .njtc-ir-table tr:last-child td { border-bottom: none; }
      .njtc-plc-badge {
        display: inline-block;
        padding: 0.18rem 0.55rem;
        border-radius: 999px;
        font-size: 0.7rem;
        font-weight: 700;
        color: #fff;
        white-space: nowrap;
      }
      .njtc-plc-arrow {
        font-size: 1rem;
        font-weight: 800;
        vertical-align: middle;
        margin: 0 0.35rem;
      }
      .njtc-ir-growth-bar {
        display: flex;
        align-items: center;
        gap: 0.5rem;
      }
      .njtc-ir-growth-track {
        flex: 1;
        background: rgba(255,255,255,0.08);
        border-radius: 999px;
        height: 8px;
        overflow: hidden;
        min-width: 40px;
      }
      .njtc-ir-growth-fill {
        height: 100%;
        border-radius: 999px;
        transition: width 0.8s ease;
      }
      .njtc-ir-growth-pct {
        font-size: 0.75rem;
        font-weight: 700;
        color: rgba(255,255,255,0.7);
        white-space: nowrap;
        min-width: 3.5rem;
        text-align: right;
      }
      .njtc-ir-school-group {
        margin-bottom: 1.5rem;
      }
      .njtc-ir-school-label {
        font-size: 0.75rem;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.06em;
        color: rgba(255,255,255,0.4);
        margin-bottom: 0.5rem;
        padding-left: 0.25rem;
      }
      .njtc-ir-explainer {
        padding: 0.75rem 1rem;
        background: rgba(13,148,136,0.08);
        border-left: 3px solid #0d9488;
        border-radius: 0 0.5rem 0.5rem 0;
        font-size: 0.8rem;
        color: rgba(255,255,255,0.6);
        margin-bottom: 1.25rem;
        line-height: 1.55;
      }
      .njtc-plc-legend {
        display: flex;
        flex-wrap: wrap;
        gap: 0.5rem;
        margin-bottom: 1rem;
      }
      .njtc-plc-legend-item {
        display: flex;
        align-items: center;
        gap: 0.3rem;
        font-size: 0.72rem;
        color: rgba(255,255,255,0.55);
      }
      .njtc-plc-legend-dot {
        width: 10px;
        height: 10px;
        border-radius: 50%;
        flex-shrink: 0;
      }

      /* ── iReady Impact Headline ── */
      .njtc-ir-headline {
        background: linear-gradient(135deg, rgba(34,197,94,0.10) 0%, rgba(255,184,28,0.08) 100%);
        border: 1px solid rgba(34,197,94,0.25);
        border-radius: 1rem;
        padding: 1.25rem 1.5rem;
        margin-bottom: 1.25rem;
        text-align: center;
      }
      .njtc-ir-headline-inner {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 1.5rem;
        flex-wrap: wrap;
        margin-bottom: 0.4rem;
      }
      .njtc-ir-headline-stat {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 0.2rem;
      }
      .njtc-ir-headline-label {
        font-size: 0.7rem;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.06em;
        color: rgba(255,255,255,0.45);
      }
      .njtc-ir-headline-val {
        font-family: 'Epilogue', sans-serif;
        font-size: 2rem;
        font-weight: 900;
        line-height: 1;
      }
      .njtc-ir-headline-arrow {
        font-size: 1.5rem;
        color: rgba(255,255,255,0.25);
        flex-shrink: 0;
      }
      .njtc-ir-headline-sub {
        font-size: 0.72rem;
        color: rgba(255,255,255,0.35);
        margin-top: 0.15rem;
      }
      .njtc-ir-kpi-featured {
        border-color: rgba(34,197,94,0.35) !important;
        background: rgba(34,197,94,0.08) !important;
      }

      /* ── Scholar Profile Modal ── */
      .njtc-sp-overlay {
        position: fixed; inset: 0;
        background: rgba(0,8,20,0.88);
        backdrop-filter: blur(6px);
        -webkit-backdrop-filter: blur(6px);
        z-index: 10000;
        display: flex; align-items: center; justify-content: center;
        padding: 1rem;
        opacity: 0; pointer-events: none;
        transition: opacity 0.18s ease;
      }
      .njtc-sp-overlay.open { opacity: 1; pointer-events: all; }
      .njtc-sp-modal {
        background: linear-gradient(160deg, #0d1f35 0%, #132040 100%);
        border: 1px solid rgba(255,255,255,0.12);
        border-radius: 1.25rem;
        width: 100%; max-width: 680px;
        max-height: 88vh; overflow-y: auto;
        padding: 1.5rem 1.75rem;
        box-shadow: 0 24px 64px rgba(0,0,0,0.6);
      }
      .njtc-sp-modal::-webkit-scrollbar { width: 4px; }
      .njtc-sp-modal::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.15); border-radius: 2px; }
      .njtc-sp-header {
        display: flex; align-items: flex-start; justify-content: space-between;
        margin-bottom: 1.25rem;
      }
      .njtc-sp-header-left { display: flex; align-items: center; gap: 1rem; }
      .njtc-sp-avatar {
        width: 52px; height: 52px; border-radius: 50%;
        display: flex; align-items: center; justify-content: center;
        font-family: 'Epilogue', sans-serif;
        font-size: 1.1rem; font-weight: 800; color: #fff; flex-shrink: 0;
      }
      .njtc-sp-name {
        font-family: 'Epilogue', sans-serif;
        font-size: 1.5rem; font-weight: 800; color: #fff; line-height: 1;
        margin-bottom: 0.3rem;
      }
      .njtc-sp-meta { font-size: 0.8rem; color: rgba(255,255,255,0.5); }
      .njtc-sp-close {
        background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.12);
        border-radius: 50%; width: 34px; height: 34px; cursor: pointer;
        color: rgba(255,255,255,0.6); font-size: 1rem; flex-shrink: 0;
        display: flex; align-items: center; justify-content: center;
        transition: background 0.15s;
      }
      .njtc-sp-close:hover { background: rgba(255,255,255,0.15); color: #fff; }
      .njtc-sp-kpi-row {
        display: flex; gap: 0.75rem; flex-wrap: wrap; margin-bottom: 1.25rem;
      }
      .njtc-sp-kpi {
        flex: 1 1 120px; min-width: 100px;
        background: rgba(255,255,255,0.05);
        border: 1px solid rgba(255,255,255,0.09);
        border-radius: 0.875rem; padding: 0.75rem 1rem; text-align: center;
      }
      .njtc-sp-kpi-val {
        font-family: 'Epilogue', sans-serif;
        font-size: 1.6rem; font-weight: 900; line-height: 1; margin-bottom: 0.2rem;
      }
      .njtc-sp-kpi-lbl {
        font-size: 0.68rem; font-weight: 600;
        color: rgba(255,255,255,0.45); text-transform: uppercase; letter-spacing: 0.05em;
      }
      .njtc-sp-divider {
        border: none; border-top: 1px solid rgba(255,255,255,0.07);
        margin: 1rem 0;
      }
      .njtc-sp-section-lbl {
        font-size: 0.7rem; font-weight: 800; text-transform: uppercase;
        letter-spacing: 0.08em; color: rgba(255,255,255,0.35); margin-bottom: 0.6rem;
      }
      .njtc-sp-att-row {
        display: flex; gap: 1rem; flex-wrap: wrap; margin-bottom: 0.5rem;
      }
      .njtc-sp-att-chip {
        display: flex; align-items: center; gap: 0.35rem;
        font-size: 0.85rem; color: rgba(255,255,255,0.8);
      }
      .njtc-sp-miss-item {
        display: flex; justify-content: space-between;
        font-size: 0.82rem; color: rgba(255,255,255,0.65);
        padding: 0.25rem 0; border-bottom: 1px solid rgba(255,255,255,0.05);
      }
      .njtc-sp-miss-item:last-child { border-bottom: none; }
      .njtc-sp-score-row {
        display: flex; gap: 0.6rem; flex-wrap: wrap; margin-bottom: 0.25rem;
      }
      .njtc-sp-score-chip {
        display: flex; flex-direction: column; align-items: center;
        background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1);
        border-radius: 0.75rem; padding: 0.5rem 0.75rem; min-width: 72px;
      }
      .njtc-sp-score-val {
        font-family: 'Epilogue', sans-serif;
        font-size: 1.1rem; font-weight: 800; line-height: 1; margin-bottom: 0.15rem;
      }
      .njtc-sp-score-lbl {
        font-size: 0.6rem; font-weight: 600; text-transform: uppercase;
        letter-spacing: 0.04em; color: rgba(255,255,255,0.4);
      }
      .njtc-sp-comment {
        background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08);
        border-radius: 0.75rem; padding: 0.75rem 1rem; margin-bottom: 0.5rem;
        font-size: 0.83rem; color: rgba(255,255,255,0.75); line-height: 1.5;
      }
      .njtc-sp-comment.support {
        border-color: rgba(251,191,36,0.3);
        background: rgba(251,191,36,0.06);
      }
      .njtc-sp-comment-meta {
        font-size: 0.68rem; color: rgba(255,255,255,0.35); margin-top: 0.35rem;
      }
      .njtc-sp-support-flag {
        display: inline-block; font-size: 0.65rem; font-weight: 700;
        color: #fbbf24; background: rgba(251,191,36,0.15);
        border: 1px solid rgba(251,191,36,0.3);
        border-radius: 999px; padding: 0.1rem 0.45rem; margin-right: 0.3rem;
      }
      .njtc-scholar-card-clickable {
        cursor: pointer; transition: transform 0.12s, box-shadow 0.12s;
      }
      .njtc-scholar-card-clickable:hover {
        transform: translateY(-2px);
        box-shadow: 0 6px 24px rgba(0,0,0,0.35);
      }
      .njtc-scholar-tap-hint {
        font-size: 0.65rem; color: rgba(255,255,255,0.25);
        text-align: center; margin-top: 0.4rem; letter-spacing: 0.03em;
      }

      /* ── Action Items ── */
      .njtc-action-section {
        background: linear-gradient(135deg, rgba(251,191,36,0.07) 0%, rgba(245,158,11,0.04) 100%);
        border: 1px solid rgba(251,191,36,0.28) !important;
      }
      .njtc-action-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 0.9rem;
      }
      .njtc-action-title {
        font-family: 'Epilogue', sans-serif;
        font-size: 0.78rem;
        font-weight: 800;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        color: #fbbf24;
      }
      .njtc-action-badge {
        background: rgba(251,191,36,0.15);
        color: #fbbf24;
        font-size: 0.72rem;
        font-weight: 700;
        padding: 0.15rem 0.55rem;
        border-radius: 999px;
        border: 1px solid rgba(251,191,36,0.3);
      }
      .njtc-action-group { margin-bottom: 0.75rem; }
      .njtc-action-group-lbl {
        font-size: 0.72rem;
        font-weight: 700;
        color: rgba(255,255,255,0.5);
        text-transform: uppercase;
        letter-spacing: 0.05em;
        margin-bottom: 0.3rem;
      }
      .njtc-action-item {
        display: flex;
        align-items: center;
        gap: 0.45rem;
        font-size: 0.82rem;
        color: rgba(255,255,255,0.7);
        padding: 0.28rem 0;
        border-bottom: 1px solid rgba(255,255,255,0.04);
      }
      .njtc-action-item:last-child { border-bottom: none; }
      .njtc-action-item-sep { color: rgba(255,255,255,0.25); }
      .njtc-action-footer {
        font-size: 0.7rem;
        color: rgba(255,255,255,0.3);
        margin-top: 0.75rem;
        padding-top: 0.6rem;
        border-top: 1px solid rgba(255,255,255,0.06);
        line-height: 1.5;
      }
      .njtc-data-context-pill {
        display: inline-flex;
        align-items: center;
        gap: 0.25rem;
        font-size: 0.67rem;
        color: rgba(255,255,255,0.3);
        background: rgba(255,255,255,0.04);
        border: 1px solid rgba(255,255,255,0.07);
        border-radius: 999px;
        padding: 0.18rem 0.55rem;
        margin-top: 0.6rem;
      }
      .njtc-eoy-pill {
        display: inline-flex;
        align-items: center;
        gap: 0.25rem;
        font-size: 0.67rem;
        font-weight: 700;
        color: rgba(255,184,28,0.75);
        background: rgba(255,184,28,0.08);
        border: 1px solid rgba(255,184,28,0.2);
        border-radius: 999px;
        padding: 0.2rem 0.6rem;
        margin-left: 0.5rem;
        vertical-align: middle;
        letter-spacing: 0.04em;
        text-transform: uppercase;
      }

      /* ── Scrollable section bodies ── */
      .njtc-scroll-body {
        max-height: 520px;
        overflow-y: auto;
        padding-right: 4px;
      }
      .njtc-scroll-body::-webkit-scrollbar { width: 4px; }
      .njtc-scroll-body::-webkit-scrollbar-track { background: rgba(255,255,255,0.04); border-radius: 2px; }
      .njtc-scroll-body::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.15); border-radius: 2px; }
      .njtc-ir-scroll { max-height: 460px; overflow-y: auto; padding-right: 4px; }
      .njtc-ir-scroll::-webkit-scrollbar { width: 4px; }
      .njtc-ir-scroll::-webkit-scrollbar-track { background: rgba(255,255,255,0.04); border-radius: 2px; }
      .njtc-ir-scroll::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.15); border-radius: 2px; }
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
        <div class="njtc-kpi-value">${data.uniqueScholarCount != null ? data.uniqueScholarCount : data.scholars.length}</div>
        <div class="njtc-kpi-label">Students I Work With</div>
        <div class="njtc-kpi-sub">across my sessions</div>
      </div>
      <div class="njtc-kpi-card">
        <div class="njtc-kpi-value" style="color:${surveyColor(data.surveyRate || 0)};">${data.surveyRate !== null ? data.surveyRate + '%' : '—'}</div>
        <div class="njtc-kpi-label">Surveys Filed</div>
        <div class="njtc-kpi-sub">keep it at 100%</div>
      </div>`;
  }

  // ── Date formatter ───────────────────────────────────────────────────────────

  function fmtDate(d) {
    if (!d) return '';
    try {
      const dt = new Date(d + (d.includes('T') ? '' : 'T00:00:00'));
      if (isNaN(dt.getTime())) return d;
      return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    } catch (e) { return d; }
  }

  function fmtDateLong(d) {
    if (!d) return '';
    try {
      const dt = new Date(d + (d.includes('T') ? '' : 'T00:00:00'));
      if (isNaN(dt.getTime())) return d;
      return dt.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    } catch (e) { return d; }
  }

  // ── Scholar profile modal ────────────────────────────────────────────────────

  const SUPPORT_KW = ['struggling', 'difficult', 'hard time', 'need help', 'behind',
    'extra support', 'concern', 'attention', 'challenge', 'having trouble', 'extra help',
    'not understanding', 'confused', "doesn't understand", 'worried', 'frustrat',
    'needs more', 'needs additional', 'additional support', 'falling behind'];

  function needsSupportFlag(text) {
    const t = (text || '').toLowerCase();
    return SUPPORT_KW.some(kw => t.includes(kw));
  }

  let _scholarProfileMap = {};

  function openScholarModal(scholar) {
    let overlay = document.getElementById('njtc-sp-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'njtc-sp-overlay';
      overlay.className = 'njtc-sp-overlay';
      overlay.innerHTML = '<div class="njtc-sp-modal" id="njtc-sp-modal-inner"></div>';
      document.body.appendChild(overlay);
      overlay.addEventListener('click', e => {
        if (e.target === overlay) closeScholarModal();
      });
      document.addEventListener('keydown', e => {
        if (e.key === 'Escape') closeScholarModal();
      });
    }

    const inner = overlay.querySelector('#njtc-sp-modal-inner');
    inner.innerHTML = renderScholarProfile(scholar);
    inner.querySelector('.njtc-sp-close').addEventListener('click', closeScholarModal);

    overlay.classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  function closeScholarModal() {
    const overlay = document.getElementById('njtc-sp-overlay');
    if (overlay) overlay.classList.remove('open');
    document.body.style.overflow = '';
  }

  function renderScholarProfile(s) {
    const color = attColor(s.attRate);
    const initials = toInitials(s.name);
    const gColor = gradePillColor(s.grade);

    // KPI row
    const kpiHtml = `<div class="njtc-sp-kpi-row">
      <div class="njtc-sp-kpi">
        <div class="njtc-sp-kpi-val" style="color:${color};">${s.attRate !== null ? s.attRate + '%' : '—'}</div>
        <div class="njtc-sp-kpi-lbl">Attendance</div>
      </div>
      <div class="njtc-sp-kpi">
        <div class="njtc-sp-kpi-val">${s.attended}</div>
        <div class="njtc-sp-kpi-lbl">Sessions Attended</div>
      </div>
      <div class="njtc-sp-kpi">
        <div class="njtc-sp-kpi-val">${s.absent}</div>
        <div class="njtc-sp-kpi-lbl">Sessions Missed</div>
      </div>
      <div class="njtc-sp-kpi">
        <div class="njtc-sp-kpi-val">${s.surveyCount || 0}</div>
        <div class="njtc-sp-kpi-lbl">Surveys Filed</div>
      </div>
    </div>`;

    // Attendance detail
    const attHtml = `<div class="njtc-sp-section-lbl">Attendance Breakdown</div>
    <div class="njtc-sp-att-row">
      <div class="njtc-sp-att-chip"><span style="color:#22c55e;">✅</span> ${s.attended} attended</div>
      <div class="njtc-sp-att-chip"><span style="color:#ef4444;">❌</span> ${s.absent} missed</div>
      ${s.si ? `<div class="njtc-sp-att-chip"><span style="color:rgba(255,255,255,0.4);">📅</span> ${s.si} school interruptions</div>` : ''}
    </div>`;

    // Miss reasons
    const reasons = Object.entries(s.missReasons || {}).sort((a, b) => b[1] - a[1]);
    const reasonsHtml = reasons.length ? `<hr class="njtc-sp-divider">
    <div class="njtc-sp-section-lbl">Why They Missed</div>
    ${reasons.map(([r, c]) => `<div class="njtc-sp-miss-item"><span>${esc(friendlyScholarReason(r))}</span><span style="color:rgba(255,255,255,0.4);">${c}×</span></div>`).join('')}` : '';

    // Survey scores
    const sv = s.surveyScores || {};
    const hasSv = sv.confidence !== null || sv.enjoyment !== null || sv.learning !== null || sv.overall !== null;
    const scoresHtml = hasSv ? `<hr class="njtc-sp-divider">
    <div class="njtc-sp-section-lbl">Student Survey Scores (avg of ${s.surveyCount})</div>
    <div class="njtc-sp-score-row">
      ${sv.confidence !== null ? `<div class="njtc-sp-score-chip"><div class="njtc-sp-score-val" style="color:${scoreColor(sv.confidence)};">${sv.confidence}</div><div class="njtc-sp-score-lbl">Confidence</div></div>` : ''}
      ${sv.enjoyment  !== null ? `<div class="njtc-sp-score-chip"><div class="njtc-sp-score-val" style="color:${scoreColor(sv.enjoyment)};">${sv.enjoyment}</div><div class="njtc-sp-score-lbl">Enjoyment</div></div>` : ''}
      ${sv.learning   !== null ? `<div class="njtc-sp-score-chip"><div class="njtc-sp-score-val" style="color:${scoreColor(sv.learning)};">${sv.learning}</div><div class="njtc-sp-score-lbl">Learning</div></div>` : ''}
      ${sv.overall    !== null ? `<div class="njtc-sp-score-chip"><div class="njtc-sp-score-val" style="color:${scoreColor(sv.overall)};">${sv.overall}</div><div class="njtc-sp-score-lbl">Overall</div></div>` : ''}
    </div>` : '';

    // Survey comments
    const comments = s.surveyComments || [];
    const commentsHtml = comments.length ? `<hr class="njtc-sp-divider">
    <div class="njtc-sp-section-lbl">Survey Comments${comments.some(c => needsSupportFlag(c.text)) ? ' · <span style="color:#fbbf24;">⚠ Support flags noted</span>' : ''}</div>
    ${comments.map(c => {
      const flag = needsSupportFlag(c.text);
      return `<div class="njtc-sp-comment${flag ? ' support' : ''}">
        ${flag ? '<span class="njtc-sp-support-flag">⚠ Needs Support</span>' : ''}${esc(c.text)}
        ${c.date ? `<div class="njtc-sp-comment-meta">${esc(fmtDate(c.date))}</div>` : ''}
      </div>`;
    }).join('')}` : '';

    return `
      <div class="njtc-sp-header">
        <div class="njtc-sp-header-left">
          <div class="njtc-sp-avatar" style="background:${gColor};">${esc(initials)}</div>
          <div>
            <div class="njtc-sp-name">${esc(initials)}</div>
            <div class="njtc-sp-meta">
              ${s.grade ? `Grade ${esc(s.grade)}` : ''} · ${esc(s.school || '—')}
              <span style="margin-left:0.5rem;">${attLabel(s.attRate)}</span>
            </div>
          </div>
        </div>
        <button class="njtc-sp-close" aria-label="Close">✕</button>
      </div>
      ${kpiHtml}
      <hr class="njtc-sp-divider">
      ${attHtml}
      ${reasonsHtml}
      ${scoresHtml}
      ${commentsHtml}
    `;
  }

  // ── Section 0: Action Items ──────────────────────────────────────────────────

  function buildActionSection(data) {
    const notRecorded    = (data.notRecordedSessions || []).filter(r => r.recent);
    const missingSurveys = (data.missingSurveys      || []).filter(r => r.recent);
    if (!notRecorded.length && !missingSurveys.length) return null;

    const total = notRecorded.length + missingSurveys.length;

    function itemList(items, max) {
      const shown = items.slice(0, max);
      const more  = items.length - shown.length;
      return shown.map(item =>
        `<div class="njtc-action-item">
          <span style="min-width:52px;color:rgba(255,255,255,0.5);">${esc(fmtDate(item.date))}</span>
          <span class="njtc-action-item-sep">—</span>
          <span>${esc(item.school || 'Unknown school')}</span>
        </div>`
      ).join('') +
      (more > 0
        ? `<div class="njtc-action-item" style="color:rgba(255,255,255,0.35);font-style:italic;">+${more} more</div>`
        : '');
    }

    const rangeNote = data.dataRange && data.dataRange.last
      ? `Your PEARL data covers sessions from ${esc(fmtDateLong(data.dataRange.first))} through ${esc(fmtDateLong(data.dataRange.last))}.`
      : '';

    const el = document.createElement('div');
    el.className = 'njtc-dash-section njtc-action-section';
    el.innerHTML = `
      <div class="njtc-action-header">
        <div class="njtc-action-title">⚡ Action Needed — This Week</div>
        <span class="njtc-action-badge">${total} item${total !== 1 ? 's' : ''}</span>
      </div>
      ${notRecorded.length ? `
        <div class="njtc-action-group">
          <div class="njtc-action-group-lbl">📋 Attendance not recorded (${notRecorded.length})</div>
          ${itemList(notRecorded, 6)}
        </div>` : ''}
      ${missingSurveys.length ? `
        <div class="njtc-action-group">
          <div class="njtc-action-group-lbl">📝 Session surveys not filed (${missingSurveys.length})</div>
          ${itemList(missingSurveys, 6)}
        </div>` : ''}
      <div class="njtc-action-footer">
        Data reflects sessions through the previous week — log into PEARL to complete these items.
        ${rangeNote}
      </div>
    `;
    return el;
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

    // Data context pill: show full program date range
    if (data.dataRange && data.dataRange.first && data.dataRange.last) {
      const pill = document.createElement('div');
      pill.className = 'njtc-data-context-pill';
      pill.innerHTML = `📅 Showing your full program history · ${esc(fmtDateLong(data.dataRange.first))} – ${esc(fmtDateLong(data.dataRange.last))} · Data reflects the previous week`;
      el.appendChild(pill);
    }

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
        _scholarProfileMap[s.id] = s;
        return `<div class="njtc-scholar-card njtc-scholar-card-clickable" data-sid="${esc(s.id)}" tabindex="0" role="button" aria-label="View ${esc(toInitials(s.name))}'s profile">
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
          <div class="njtc-scholar-tap-hint">View Profile →</div>
        </div>`;
      }).join('') + `</div>`;
    }

    const allHtml = renderGrid(data.scholars);
    const needsHtml = renderGrid(data.scholars.filter(s => s.attRate !== null && s.attRate < 75));
    const goodHtml = renderGrid(data.scholars.filter(s => s.attRate !== null && s.attRate >= 90));

    el.innerHTML = `
      <div class="njtc-scholars-heading">
        <span class="njtc-section-title" style="margin-bottom:0;padding-bottom:0;border-bottom:none;">👥 Your Students</span>
        <span class="njtc-count-badge">${data.uniqueScholarCount != null ? data.uniqueScholarCount : data.scholars.length}</span>
      </div>
      <div class="njtc-scholar-filter-tabs" style="margin-top:0.75rem;">
        <button class="njtc-tab-btn active" data-tab="all">All</button>
        <button class="njtc-tab-btn" data-tab="needs">🎯 Need Attention</button>
        <button class="njtc-tab-btn" data-tab="good">✅ Good</button>
      </div>
      <div class="njtc-scroll-body">
        <div id="njtc-scholar-tab-all">${allHtml}</div>
        <div id="njtc-scholar-tab-needs" style="display:none;">${needsHtml}</div>
        <div id="njtc-scholar-tab-good" style="display:none;">${goodHtml}</div>
      </div>
    `;

    // Wire scholar card click → profile modal
    el.querySelectorAll('.njtc-scholar-card-clickable').forEach(card => {
      card.addEventListener('click', () => {
        const s = _scholarProfileMap[card.dataset.sid];
        if (s) openScholarModal(s);
      });
      card.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); card.click(); }
      });
    });

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

  // ── Logout / Switch User buttons ─────────────────────────────────────────────

  function switchUser() {
    if (window.NJTCUserAuth) window.NJTCUserAuth.logout();
    location.reload();
  }
  // Expose globally so onclick="switchUser()" works from injected HTML
  window.njtcSwitchUser = switchUser;

  function injectLogoutButtons() {
    // ── Hero area: below the assignment card ──────────────────────────────────
    if (!document.getElementById('njtc-hero-logout-strip')) {
      const strip = document.createElement('div');
      strip.id = 'njtc-hero-logout-strip';
      strip.className = 'njtc-logout-strip';
      strip.innerHTML = `
        <button class="njtc-switch-btn" onclick="njtcSwitchUser()">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
            <circle cx="9" cy="7" r="4"/>
          </svg>
          Switch User
        </button>
        <button class="njtc-switch-btn njtc-signout-btn" onclick="NJTCAuth && NJTCAuth.logout()">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
            <polyline points="16 17 21 12 16 7"/>
            <line x1="21" y1="12" x2="9" y2="12"/>
          </svg>
          Sign Out
        </button>`;

      const heroContent = document.querySelector('.hero-content');
      const roleSelectorCard = document.querySelector('.role-selector-card');
      if (heroContent && roleSelectorCard) {
        heroContent.insertBefore(strip, roleSelectorCard);
      } else if (heroContent) {
        heroContent.appendChild(strip);
      }
    }

    // ── Dashboard header: add Switch User next to Change Role ─────────────────
    if (!document.getElementById('njtc-header-switch-btn')) {
      const headerActions = document.querySelector('.header-actions');
      if (headerActions) {
        const btn = document.createElement('button');
        btn.id = 'njtc-header-switch-btn';
        btn.className = 'njtc-header-switch-btn';
        btn.setAttribute('onclick', 'njtcSwitchUser()');
        btn.innerHTML = `
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
            <circle cx="9" cy="7" r="4"/>
          </svg>
          Switch User`;
        const changeRoleBtn = headerActions.querySelector('.change-role-btn');
        if (changeRoleBtn) {
          headerActions.insertBefore(btn, changeRoleBtn.nextSibling);
        } else {
          headerActions.prepend(btn);
        }
      }
    }

    // ── Floating bottom-right ─────────────────────────────────────────────────
    if (!document.getElementById('njtc-floating-logout')) {
      const floater = document.createElement('div');
      floater.id = 'njtc-floating-logout';
      floater.className = 'njtc-floating-logout';
      floater.innerHTML = `
        <button class="njtc-switch-btn njtc-signout-btn" onclick="NJTCAuth && NJTCAuth.logout()" title="Sign out of portal completely">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
            <polyline points="16 17 21 12 16 7"/>
            <line x1="21" y1="12" x2="9" y2="12"/>
          </svg>
          Sign Out
        </button>
        <button class="njtc-switch-btn" onclick="njtcSwitchUser()" title="Switch to a different staff account">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
            <circle cx="9" cy="7" r="4"/>
          </svg>
          Switch User
        </button>`;
      document.body.appendChild(floater);
    }
  }

  // ── iReady: constants ─────────────────────────────────────────────────────────

  // Longitudinal data (iReady Dashboard 22-25): published via "Publish to web" CSV key
  // Same key used by Central Team Portal (data-department.js IRLAB_LIVE_2PACX)
  const IR_LONG_2PACX    = '2PACX-1vREgf9glXO2QMKeZ8YHF-0XBtqoOyhNz3CnBpaeCY0mAC1lknvQ13JuXJpzHCZeGls4XEPkxyNO5ZBG';
  const IR_LONG_ELA_GID  = 0;           // ELA tab (default)
  const IR_LONG_MATH_GID = 127145553;   // Math tab
  // 25-26 preliminary data: matched via Pearl scholar IDs, not tutor name
  const IR_2526_ID       = '1mCx6eFKscXA3y5Ox_JB9cSualR5Tw9MbKxBVN078_G0';
  const IR_2526_ELA_GID  = 1640935949;
  const IR_2526_MATH_GID = 1676366557;
  const IR_CACHE_KEY     = 'njtc_od_iready_v7';
  const IR_CACHE_TTL     = 2 * 60 * 60 * 1000;

  // ── iReady: CSV parser (standalone for this module) ──────────────────────────

  function parseIRCSV(text) {
    const rows = [];
    const src = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    let row = [], cur = '', inQ = false;
    for (let i = 0; i <= src.length; i++) {
      const ch = i < src.length ? src[i] : '\n';
      if (inQ) {
        if (ch === '"') {
          if (src[i + 1] === '"') { cur += '"'; i++; }
          else inQ = false;
        } else cur += ch;
      } else {
        if      (ch === '"')  { inQ = true; }
        else if (ch === ',')  { row.push(cur); cur = ''; }
        else if (ch === '\n') {
          row.push(cur); cur = '';
          if (row.some(c => c.trim())) rows.push(row);
          row = [];
        } else cur += ch;
      }
    }
    return rows;
  }

  // ── iReady: name normalization ────────────────────────────────────────────────

  function normIRName(n) {
    return (n || '').toLowerCase()
      .replace(/\(.*?\)/g, '')
      .replace(/[-']/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  // ── iReady: placement helpers ─────────────────────────────────────────────────

  function plcColor(placement) {
    const p = (placement || '').toLowerCase();
    if (p.includes('3 or more') || p.includes('3+')) return '#dc2626';
    if (p.includes('2 grade') || p.includes('2 level')) return '#f97316';
    if (p.includes('1 grade') || p.includes('1 level')) return '#eab308';
    if (p.includes('early on') || p.includes('early grade')) return '#0d9488';
    if (p.includes('mid') || p.includes('above') || p.includes('on grade')) return '#0d6e3a';
    return '#6b7280';
  }

  function plcShort(placement) {
    const p = (placement || '').toLowerCase();
    if (p.includes('3 or more') || p.includes('3+')) return '3+ Below GL';
    if (p.includes('2 grade') || p.includes('2 level')) return '2 Below GL';
    if (p.includes('1 grade') || p.includes('1 level')) return '1 Below GL';
    if (p.includes('early on') || p.includes('early grade')) return 'Early GL';
    if (p.includes('mid') || p.includes('above') || p.includes('on grade')) return 'At/Above GL';
    return placement || '—';
  }

  function plcRank(placement) {
    const p = (placement || '').toLowerCase();
    if (p.includes('3 or more') || p.includes('3+')) return 0;
    if (p.includes('2 grade') || p.includes('2 level')) return 1;
    if (p.includes('1 grade') || p.includes('1 level')) return 2;
    if (p.includes('early on') || p.includes('early grade')) return 3;
    if (p.includes('mid') || p.includes('above') || p.includes('on grade')) return 4;
    return -1;
  }

  // Returns numeric grade levels below grade level (used for "1¾ behind" averages)
  function plcLevelsBehind(placement) {
    const p = (placement || '').toLowerCase();
    if (p.includes('3 or more') || p.includes('3+')) return 3.5;
    if (p.includes('2 grade') || p.includes('2 level')) return 2;
    if (p.includes('1 grade') || p.includes('1 level')) return 1;
    if (p.includes('early on') || p.includes('early grade')) return 0.5;
    if (p.includes('mid') || p.includes('above') || p.includes('on grade')) return 0;
    return null;
  }

  // Format a numeric levels-behind value as a readable fraction string
  function fmtBehind(num) {
    if (num === null || num === undefined) return '—';
    const rounded = Math.round(num * 4) / 4; // nearest quarter
    const whole = Math.floor(rounded);
    const frac = Math.round((rounded - whole) * 4);
    const fracStr = ['', '¼', '½', '¾'][frac] || '';
    if (whole === 0 && frac === 0) return 'At Grade Level';
    if (whole === 0) return fracStr + ' below GL';
    return whole + fracStr + ' below GL';
  }

  // ── iReady: parse one CSV sheet into normalized row objects ──────────────────

  function normalizeIRSheet(rows, defaultSubject) {
    if (rows.length < 2) return [];
    const header = rows[0].map(h => h.trim().toLowerCase());

    function col(keywords) {
      return header.findIndex(h => keywords.every(k => h.includes(k)));
    }

    // Instructor: column B (index 1) per longitudinal sheet spec; also try header keywords
    let tutorCol = col(['instructor']) >= 0 ? col(['instructor']) : col(['tutor']);
    if (tutorCol < 0) tutorCol = 1; // Column B fallback per iReady Longitudinal Dashboard spec

    // Student name: "First and Last Name" (col C, index 2) or similar
    let stuCol = col(['first and last']) >= 0 ? col(['first and last']) : col(['student', 'name']);
    if (stuCol < 0) stuCol = 2; // Column C fallback

    // BOY placement: may be labeled Base, Fall, BOY, or Beginning
    const baseCol =
      col(['base', 'overall', 'relative', 'placement']) >= 0 ? col(['base', 'overall', 'relative', 'placement']) :
      col(['fall', 'overall', 'relative', 'placement']) >= 0 ? col(['fall', 'overall', 'relative', 'placement']) :
      col(['boy',  'overall', 'relative', 'placement']) >= 0 ? col(['boy',  'overall', 'relative', 'placement']) :
      col(['beginning', 'overall', 'relative', 'placement']);

    // Spring / EOY placement
    const sprCol =
      col(['spring', 'overall', 'relative', 'placement']) >= 0 ? col(['spring', 'overall', 'relative', 'placement']) :
      col(['eoy',    'overall', 'relative', 'placement']) >= 0 ? col(['eoy',    'overall', 'relative', 'placement']) :
      col(['end',    'overall', 'relative', 'placement']);

    const growthCol = col(['spring', 'pct']) >= 0 ? col(['spring', 'pct']) : col(['typical growth']);
    const gradeCol  = col(['student grade']) >= 0 ? col(['student grade']) : col(['student', 'grade']) >= 0 ? col(['student', 'grade']) : col(['grade']);
    const schoolCol = col(['school']);
    const syCol     = col(['academic year']) >= 0 ? col(['academic year']) : col(['school year']);
    // Subject embedded in data (column H in longitudinal sheet); fall back to defaultSubject param
    const subjectCol = col(['subject']) >= 0 ? col(['subject']) : col(['program area']);

    if (tutorCol < 0 || stuCol < 0 || baseCol < 0) return [];

    return rows.slice(1).filter(r => (r[tutorCol] || '').trim() && (r[stuCol] || '').trim() && (r[baseCol] || '').trim()).map(r => {
      let pct = parseFloat(r[growthCol]);
      if (isNaN(pct)) pct = null;
      else if (pct > 0 && pct <= 15) pct = Math.round(pct * 100); // ratio → integer %
      else pct = Math.round(pct);
      return {
        tutorName:   (r[tutorCol] || '').trim(),
        studentName: (r[stuCol]   || '').trim(),
        basePLC:     (r[baseCol]  || '').trim(),
        springPLC:   sprCol >= 0 ? (r[sprCol] || '').trim() : '',
        pctTypical:  pct,
        grade:       (r[gradeCol]  || '').trim(),
        school:      (r[schoolCol] || '').trim(),
        sy:          (r[syCol]     || '').trim(),
        subject: subjectCol >= 0 ? ((r[subjectCol] || '').trim() || defaultSubject) : defaultSubject
      };
    });
  }

  // ── iReady: 25-26 sheet — match by Pearl scholar ID or name (not tutor name) ────

  function normalizeIRSheet2526(rows, subject, scholarIds, scholarNames) {
    if (rows.length < 2) return [];
    if ((!scholarIds || scholarIds.size === 0) && (!scholarNames || scholarNames.size === 0)) return [];

    const header = rows[0].map(h => h.trim().toLowerCase());
    function col(keywords) {
      return header.findIndex(h => keywords.every(k => h.includes(k)));
    }

    // Try to find a student ID column (Pearl USER_ID may equal district student ID)
    const stuIdCol = col(['student', 'id']) >= 0 ? col(['student', 'id']) : col(['id']);
    const stuCol   = col(['first and last']) >= 0 ? col(['first and last']) : col(['student', 'name']);
    const baseCol  = col(['base', 'overall', 'relative', 'placement']);
    if (stuCol < 0 || baseCol < 0) return [];

    const sprCol    = col(['spring', 'overall', 'relative', 'placement']);
    const growthCol = col(['spring', 'pct']) >= 0 ? col(['spring', 'pct']) : col(['typical growth']);
    const gradeCol  = col(['student grade']) >= 0 ? col(['student grade']) : col(['grade']);
    const schoolCol = col(['school']);
    const syCol     = col(['academic year']) >= 0 ? col(['academic year']) : col(['school year']);
    const tutorCol  = col(['instructor']) >= 0 ? col(['instructor']) : col(['tutor']);

    return rows.slice(1).filter(r => {
      if (!(r[stuCol] || '').trim() || !(r[baseCol] || '').trim()) return false;
      // Primary: match by Pearl student ID = iReady student ID
      if (stuIdCol >= 0 && scholarIds && scholarIds.size > 0) {
        const sid = (r[stuIdCol] || '').trim();
        if (sid && scholarIds.has(sid)) return true;
      }
      // Fallback: match by normalized student name
      if (scholarNames && scholarNames.size > 0) {
        const sName = normIRName(r[stuCol] || '');
        if (sName.length > 2 && scholarNames.has(sName)) return true;
      }
      return false;
    }).map(r => {
      let pct = parseFloat(r[growthCol]);
      if (isNaN(pct)) pct = null;
      else if (pct > 0 && pct <= 15) pct = Math.round(pct * 100);
      else pct = Math.round(pct);
      return {
        tutorName:   tutorCol >= 0 ? (r[tutorCol] || '').trim() : 'pearl-matched',
        studentName: (r[stuCol]   || '').trim(),
        basePLC:     (r[baseCol]  || '').trim(),
        springPLC:   sprCol >= 0 ? (r[sprCol] || '').trim() : '',
        pctTypical:  pct,
        grade:       (r[gradeCol]  || '').trim(),
        school:      (r[schoolCol] || '').trim(),
        sy:          (r[syCol]     || '').trim() || '2025-2026',
        subject
      };
    });
  }

  // ── iReady: fetch all data for this tutor ─────────────────────────────────────

  async function fetchIReadyData(userName, scholarIds, scholarNames) {
    // Cache check — keyed by name; scholar IDs change how 25-26 is matched but not longtudinal
    try {
      const cached = JSON.parse(localStorage.getItem(IR_CACHE_KEY) || 'null');
      if (cached && cached.ts && (Date.now() - cached.ts) < IR_CACHE_TTL && cached.rows && cached.name === userName) {
        return cached.rows;
      }
    } catch (e) {}

    const needle = normIRName(userName);
    const needleWords = needle.split(' ').filter(w => w.length >= 3);

    // LONGITUDINAL name match — column B may list multiple instructors comma-separated.
    // Split by comma and test each segment individually; never match the blob as one name
    // (blob match caused "Yohanny Rosario, Jane Smith" to match any tutor named Yohanny).
    function matchesTutor(rawName) {
      const segments = rawName.split(',').map(s => normIRName(s.trim())).filter(Boolean);
      return segments.some(seg => {
        if (seg === needle) return true;
        if (needleWords.length >= 2 && needleWords.every(w => seg.includes(w))) return true;
        return false;
      });
    }
    function isShared(rawName) {
      return rawName.split(',').filter(s => s.trim()).length > 1;
    }

    async function fetchCSV(url) {
      try {
        const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
        if (!res.ok) return [];
        return parseIRCSV(await res.text());
      } catch (e) { return []; }
    }

    const longBase = `https://docs.google.com/spreadsheets/d/e/${IR_LONG_2PACX}/pub?output=csv&gid=`;
    const snap2526 = `https://docs.google.com/spreadsheets/d/${IR_2526_ID}/gviz/tq?tqx=out:csv&gid=`;

    const [longMath, longELA, snapMath, snapELA] = await Promise.all([
      fetchCSV(longBase + IR_LONG_MATH_GID),
      fetchCSV(longBase + IR_LONG_ELA_GID),
      fetchCSV(snap2526 + IR_2526_MATH_GID),
      fetchCSV(snap2526 + IR_2526_ELA_GID)
    ]);

    // LONGITUDINAL rows: iReady Dashboard 22-25, matched by tutor full name (col B)
    // Subject is embedded in column H of the data itself
    const longitudinalRows = [
      ...normalizeIRSheet(longMath, 'Math'),
      ...normalizeIRSheet(longELA, 'ELA')
    ].filter(r => matchesTutor(r.tutorName))
     .map(r => ({ ...r, shared: isShared(r.tutorName) }));

    // 25-26 PRELIMINARY rows: match by Pearl scholar IDs/names — not tutor name —
    // because 25-26 data is linked via Pearl student records, not tutor attribution
    const rows2526 = [
      ...normalizeIRSheet2526(snapMath, 'Math', scholarIds, scholarNames),
      ...normalizeIRSheet2526(snapELA, 'ELA', scholarIds, scholarNames)
    ];

    // Combine: longitudinal first, 25-26 supplements any missing records
    const allRows = [...longitudinalRows, ...rows2526];

    // Deduplicate: same student + subject + school year
    const seen = new Set();
    const deduped = allRows.filter(r => {
      const key = normIRName(r.studentName) + '|' + r.subject + '|' + r.sy;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    try { localStorage.setItem(IR_CACHE_KEY, JSON.stringify({ ts: Date.now(), name: userName, rows: deduped })); } catch (e) {}
    return deduped;
  }

  // ── iReady: build the section ─────────────────────────────────────────────────

  function buildIReadySection(allRows) {
    const el = document.createElement('div');
    el.className = 'njtc-dash-section';

    if (!allRows || !allRows.length) {
      el.innerHTML = `<span class="njtc-section-title">📈 Are Your Students Moving Forward?</span>
        <div class="njtc-empty-state">
          <div class="njtc-empty-icon">📈</div>
          <p>No i-Ready placement data found for your name yet.<br>Check back after the spring diagnostic window.</p>
        </div>`;
      return el;
    }

    // Collect school years and subjects
    const sySet = new Set(allRows.map(r => r.sy).filter(Boolean));
    const syList = [...sySet].sort().reverse();
    const subjectSet = new Set(allRows.map(r => r.subject));

    let activeSY  = syList[0] || '';
    let activeSub = 'All';

    function getFiltered() {
      return allRows.filter(r =>
        (!activeSY || r.sy === activeSY) &&
        (activeSub === 'All' || r.subject === activeSub)
      );
    }

    function computeKPIs(rows) {
      let up = 0, same = 0, down = 0, growthSum = 0, growthCount = 0, movedToGL = 0;
      const boyLevels = [], sprLevels = [];
      for (const r of rows) {
        const bRank = plcRank(r.basePLC);
        const sRank = plcRank(r.springPLC);
        if (bRank >= 0 && sRank >= 0) {
          if (sRank > bRank)       up++;
          else if (sRank === bRank) same++;
          else                      down++;
          // On-grade-level = Early GL (rank 3) or At/Above GL (rank 4)
          if (bRank < 3 && sRank >= 3) movedToGL++;
        }
        if (r.pctTypical !== null) { growthSum += r.pctTypical; growthCount++; }
        const bLvl = plcLevelsBehind(r.basePLC);
        const sLvl = plcLevelsBehind(r.springPLC);
        if (bLvl !== null) boyLevels.push(bLvl);
        if (sLvl !== null) sprLevels.push(sLvl);
      }
      const total = up + same + down;
      const avgBOY = boyLevels.length ? boyLevels.reduce((a, b) => a + b, 0) / boyLevels.length : null;
      const avgSpr = sprLevels.length ? sprLevels.reduce((a, b) => a + b, 0) / sprLevels.length : null;
      return {
        up, same, down, total,
        pctImproved: total > 0 ? Math.round((up / total) * 100) : null,
        medianGrowth: growthCount > 0 ? Math.round(growthSum / growthCount) : null,
        movedToGL,
        pctMovedToGL: total > 0 ? Math.round((movedToGL / total) * 100) : null,
        avgBOYBehind: avgBOY,
        avgSprBehind: avgSpr
      };
    }

    function growthColor(pct) {
      if (pct === null) return '#6b7280';
      if (pct >= 100) return '#22c55e';
      if (pct >= 50)  return '#f59e0b';
      return '#ef4444';
    }

    function arrowHtml(basePLC, springPLC) {
      const b = plcRank(basePLC), s = plcRank(springPLC);
      if (b < 0 || s < 0) return '<span class="njtc-plc-arrow" style="color:rgba(255,255,255,0.3);">→</span>';
      if (s > b) return '<span class="njtc-plc-arrow" style="color:#22c55e;">↑</span>';
      if (s < b) return '<span class="njtc-plc-arrow" style="color:#ef4444;">↓</span>';
      return '<span class="njtc-plc-arrow" style="color:rgba(255,255,255,0.4);">→</span>';
    }

    function renderContent() {
      const filtered = getFiltered();
      const kpis = computeKPIs(filtered);

      // Impact headline — BOY average → Spring average grade levels behind
      let headlineHtml = '';
      if (kpis.avgBOYBehind !== null && kpis.avgSprBehind !== null) {
        const boyStr = fmtBehind(kpis.avgBOYBehind);
        const sprStr = fmtBehind(kpis.avgSprBehind);
        headlineHtml = `<div class="njtc-ir-headline">
          <div class="njtc-ir-headline-inner">
            <div class="njtc-ir-headline-stat">
              <div class="njtc-ir-headline-label">Start of Year Average</div>
              <div class="njtc-ir-headline-val" style="color:#f97316;">${esc(boyStr)}</div>
            </div>
            <div class="njtc-ir-headline-arrow">→</div>
            <div class="njtc-ir-headline-stat">
              <div class="njtc-ir-headline-label">End of Year Average</div>
              <div class="njtc-ir-headline-val" style="color:#22c55e;">${esc(sprStr)}</div>
            </div>
          </div>
          <div class="njtc-ir-headline-sub">Average grade-level placement across all your scholars</div>
        </div>`;
      }

      // KPI row
      const kpiHtml = `<div class="njtc-ir-kpi-row">
        <div class="njtc-ir-kpi njtc-ir-kpi-featured">
          <div class="njtc-ir-kpi-val" style="color:#22c55e;">${kpis.pctImproved !== null ? kpis.pctImproved + '%' : '—'}</div>
          <div class="njtc-ir-kpi-lbl">Moved Up ≥1 Level</div>
        </div>
        <div class="njtc-ir-kpi njtc-ir-kpi-featured">
          <div class="njtc-ir-kpi-val" style="color:#22c55e;">${kpis.pctMovedToGL !== null ? kpis.pctMovedToGL + '%' : '—'}</div>
          <div class="njtc-ir-kpi-lbl">Reached Grade Level</div>
        </div>
        <div class="njtc-ir-kpi">
          <div class="njtc-ir-kpi-val" style="color:#22c55e;">${kpis.up}</div>
          <div class="njtc-ir-kpi-lbl">Moved Up</div>
        </div>
        <div class="njtc-ir-kpi">
          <div class="njtc-ir-kpi-val" style="color:rgba(255,255,255,0.5);">${kpis.same}</div>
          <div class="njtc-ir-kpi-lbl">Stayed Same</div>
        </div>
        <div class="njtc-ir-kpi">
          <div class="njtc-ir-kpi-val" style="color:#ef4444;">${kpis.down}</div>
          <div class="njtc-ir-kpi-lbl">Moved Down</div>
        </div>
        <div class="njtc-ir-kpi">
          <div class="njtc-ir-kpi-val" style="color:${growthColor(kpis.medianGrowth)};">${kpis.medianGrowth !== null ? kpis.medianGrowth + '%' : '—'}</div>
          <div class="njtc-ir-kpi-lbl">Avg Growth vs Typical</div>
        </div>
      </div>`;

      if (!filtered.length) {
        return headlineHtml + kpiHtml + `<div class="njtc-empty-state"><p>No data for this filter combination.</p></div>`;
      }

      // Group by school year (most recent first) so tutor sees their history year-by-year
      const yearGroups = {};
      for (const r of filtered) {
        const yr = r.sy || 'Unknown Year';
        if (!yearGroups[yr]) yearGroups[yr] = [];
        yearGroups[yr].push(r);
      }

      const schoolHtml = Object.entries(yearGroups)
        .sort((a, b) => b[0].localeCompare(a[0]))   // newest year first
        .map(([yr, rows]) => {
        const rowsHtml = rows.map(r => {
          const bColor = plcColor(r.basePLC);
          const sColor = plcColor(r.springPLC);
          const growPct = r.pctTypical !== null ? Math.min(Math.max(r.pctTypical, 0), 200) : null;
          const barFill = growPct !== null ? Math.min(growPct / 200 * 100, 100) : 0;
          const subjectTag = activeSub === 'All' ? `<span style="font-size:0.7rem;color:rgba(255,255,255,0.35);margin-left:0.25rem;">${esc(r.subject)}</span>` : '';
          const sharedTag = r.shared ? `<span style="font-size:0.65rem;background:rgba(255,184,28,0.2);color:#FFB81C;border-radius:999px;padding:0.1rem 0.4rem;margin-left:0.3rem;vertical-align:middle;" title="Shared scholar — multiple instructors listed">shared</span>` : '';
          const hasSpring = r.springPLC && r.springPLC.trim();
          const placementHtml = hasSpring
            ? `<span class="njtc-plc-badge" style="background:${bColor};">${esc(plcShort(r.basePLC))}</span>
               ${arrowHtml(r.basePLC, r.springPLC)}
               <span class="njtc-plc-badge" style="background:${sColor};">${esc(plcShort(r.springPLC))}</span>`
            : `<span class="njtc-plc-badge" style="background:${bColor};">${esc(plcShort(r.basePLC))}</span>
               <span style="font-size:0.7rem;color:rgba(255,255,255,0.3);margin-left:0.35rem;">spring pending</span>`;
          const schoolMeta = r.school ? `<div style="font-size:0.68rem;color:rgba(255,255,255,0.35);margin-top:0.1rem;">${esc(shortenSchool(r.school))}</div>` : '';
          return `<tr>
            <td>${esc(toInitials(r.studentName))}${subjectTag}${sharedTag}${schoolMeta}</td>
            <td><span style="font-size:0.75rem;color:rgba(255,255,255,0.5);">Gr ${esc(r.grade || '?')}</span></td>
            <td>${placementHtml}</td>
            <td>
              <div class="njtc-ir-growth-bar">
                <div class="njtc-ir-growth-track">
                  <div class="njtc-ir-growth-fill" style="width:${barFill}%;background:${growthColor(r.pctTypical)};"></div>
                </div>
                <span class="njtc-ir-growth-pct">${r.pctTypical !== null ? r.pctTypical + '%' : '—'}</span>
              </div>
            </td>
          </tr>`;
        }).join('');

        return `<div class="njtc-ir-school-group">
          <div class="njtc-ir-school-label">${esc(yr)}</div>
          <div class="njtc-ir-scroll" style="overflow-x:auto;">
            <table class="njtc-ir-table">
              <thead><tr>
                <th>Student</th>
                <th>Grade</th>
                <th>Placement Change</th>
                <th>Growth vs Typical</th>
              </tr></thead>
              <tbody>${rowsHtml}</tbody>
            </table>
          </div>
        </div>`;
      }).join('');

      return headlineHtml + kpiHtml + schoolHtml;
    }

    function rebuildContent() {
      const body = el.querySelector('#njtc-ir-body');
      if (body) body.innerHTML = renderContent();
    }

    const syTabsHtml = syList.map((sy, i) =>
      `<button class="njtc-tab-btn${i === 0 ? ' active' : ''}" data-sy="${esc(sy)}">${esc(sy || 'All Years')}</button>`
    ).join('');

    const subjectTabsHtml = ['All', ...subjectSet].map((sub, i) =>
      `<button class="njtc-tab-btn${i === 0 ? ' active' : ''}" data-sub="${esc(sub)}">${esc(sub)}</button>`
    ).join('');

    el.innerHTML = `
      <span class="njtc-section-title">📈 Are Your Students Moving Forward?
        <span class="njtc-eoy-pill">EOY Data</span>
      </span>
      <div class="njtc-ir-explainer">
        Showing End-of-Year (EOY) diagnostic placements across all years your students have been tested.
        "Moved Up" means they jumped to a higher placement level — that's your direct impact.
        Growth vs Typical shows progress as a % of expected growth with no tutoring (100% = on track).
        <em style="color:rgba(255,255,255,0.35);display:block;margin-top:0.3rem;">Mid-Year (MOY) data will be integrated when available.</em>
      </div>
      <div class="njtc-plc-legend">
        <span class="njtc-plc-legend-item"><span class="njtc-plc-legend-dot" style="background:#dc2626;"></span>3+ Below GL</span>
        <span class="njtc-plc-legend-item"><span class="njtc-plc-legend-dot" style="background:#f97316;"></span>2 Below GL</span>
        <span class="njtc-plc-legend-item"><span class="njtc-plc-legend-dot" style="background:#eab308;"></span>1 Below GL</span>
        <span class="njtc-plc-legend-item"><span class="njtc-plc-legend-dot" style="background:#0d9488;"></span>Early GL</span>
        <span class="njtc-plc-legend-item"><span class="njtc-plc-legend-dot" style="background:#0d6e3a;"></span>At/Above GL</span>
      </div>
      <div class="njtc-ir-filter-row">
        <span class="njtc-ir-filter-label">Year:</span>
        <div id="njtc-ir-sy-tabs">${syTabsHtml}</div>
      </div>
      ${subjectSet.size > 1 ? `<div class="njtc-ir-filter-row">
        <span class="njtc-ir-filter-label">Subject:</span>
        <div id="njtc-ir-sub-tabs">${subjectTabsHtml}</div>
      </div>` : ''}
      <div id="njtc-ir-body">${renderContent()}</div>
    `;

    // Wire SY tabs
    el.querySelectorAll('#njtc-ir-sy-tabs .njtc-tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        el.querySelectorAll('#njtc-ir-sy-tabs .njtc-tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        activeSY = btn.dataset.sy;
        rebuildContent();
      });
    });

    // Wire subject tabs
    el.querySelectorAll('#njtc-ir-sub-tabs .njtc-tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        el.querySelectorAll('#njtc-ir-sub-tabs .njtc-tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        activeSub = btn.dataset.sub;
        rebuildContent();
      });
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
    if (!user) return;
    const pearlId = user.pearlId || user.id;
    if (!pearlId) return;

    injectStyles();

    // -- KPI strip → #njtcDashTop --
    const dashTop = document.getElementById('njtcDashTop');
    let kpiStrip = document.getElementById('njtc-kpi-strip');
    if (!kpiStrip && dashTop) {
      kpiStrip = buildKPIStrip();
      dashTop.appendChild(kpiStrip);
    }

    // -- Section placeholder → #njtcDashContent --
    const dashContent = document.getElementById('njtcDashContent');
    let dashPlaceholder = document.getElementById('njtc-dash-placeholder');
    if (!dashPlaceholder && dashContent) {
      dashPlaceholder = document.createElement('div');
      dashPlaceholder.id = 'njtc-dash-placeholder';
      dashContent.appendChild(dashPlaceholder);
      // Show loading skeletons
      dashPlaceholder.innerHTML =
        sectionSkeleton() + sectionSkeleton() + sectionSkeleton();
    }

    // -- Fetch Pearl first, then iReady using scholar IDs for 25-26 matching --
    let data, irRows;
    try {
      if (!window.NJTCPearlData) throw new Error('NJTCPearlData not loaded');
      data = await window.NJTCPearlData.fetchUserData(pearlId);
      // Build scholar lookup sets so 25-26 iReady snapshot can match by student ID/name
      const scholarIds   = new Set(data.scholars.map(s => s.id).filter(Boolean));
      const scholarNames = new Set(data.scholars.map(s => normIRName(s.name)).filter(n => n.length > 2));
      irRows = await fetchIReadyData(user.name, scholarIds, scholarNames).catch(() => []);
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
        buildActionSection(data),           // pending items this week — only shown if there are any
        buildAttendanceSection(data),
        buildIReadySection(irRows || []),
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
