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

  function donutChart(pct, color, size, strokeWidth) {
    size = size || 80;
    strokeWidth = strokeWidth || Math.round(size * 0.25);
    const r    = (size / 2) - (strokeWidth / 2) - 2;
    const circ = 2 * Math.PI * r;
    // At 100%, use a tiny gap (0.01) so the stroke visually closes completely
    // without floating-point artifacts leaving a sliver of background visible
    const fill = pct != null ? Math.min((pct / 100) * circ, circ - 0.01) : 0;
    const gap  = pct != null && pct >= 100 ? 0 : circ;
    return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" role="img" aria-label="${pct != null ? pct + '%' : 'No data'}">
      <circle cx="${size/2}" cy="${size/2}" r="${r}" fill="none" stroke="rgba(255,255,255,0.12)" stroke-width="${strokeWidth}"/>
      <circle cx="${size/2}" cy="${size/2}" r="${r}" fill="none" stroke="${color}" stroke-width="${strokeWidth}"
        stroke-dasharray="${fill} ${gap}" stroke-dashoffset="${circ/4}"
        stroke-linecap="round"/>
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
    return school
      .replace(/^LEA\s*[-–]\s*/i, '')       // strip "LEA - " prefix
      .replace(/\belementary\b/gi, 'Elem.')
      .replace(/\bmiddle school\b/gi, 'MS')
      .replace(/\bhigh school\b/gi, 'HS')
      .replace(/\bcharter school\b/gi, 'Charter')
      .replace(/\bschool\b/gi, 'Sch.')
      .trim();
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

      /* ── Portal Tab Nav (My Dashboard / My Progress) ── */
      .njtc-portal-tab-nav {
        display: flex; gap: 0.375rem; margin: 0 0 1.5rem;
        border-bottom: 2px solid rgba(255,255,255,0.1); padding-bottom: 0;
      }
      .njtc-portal-tab-btn {
        padding: 0.625rem 1.25rem; font-size: 0.875rem; font-weight: 700;
        font-family: 'Epilogue', sans-serif; border: none; background: none;
        cursor: pointer; color: rgba(255,255,255,0.45);
        border-bottom: 3px solid transparent; margin-bottom: -2px;
        transition: color 0.15s, border-color 0.15s; border-radius: 6px 6px 0 0;
      }
      .njtc-portal-tab-btn:hover:not(.active) { color: rgba(255,255,255,0.75); background: rgba(255,255,255,0.04); }
      .njtc-portal-tab-btn.active { color: #FFB81C; border-bottom-color: #FFB81C; }
      .njtc-portal-tab-pane { display: none; }
      .njtc-portal-tab-pane.active { display: block; }

      /* ── My Progress panel ── */
      .mp-stat-row { display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 1rem; margin-bottom: 1.5rem; }
      .mp-stat { background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; padding: 1.125rem 1.25rem; text-align: center; }
      .mp-stat-val { font-size: 1.75rem; font-weight: 800; font-family: 'Epilogue', sans-serif; line-height: 1; }
      .mp-stat-lbl { font-size: 0.72rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em; color: rgba(255,255,255,0.5); margin-top: 0.375rem; }
      .mp-stat-sub { font-size: 0.68rem; color: rgba(255,255,255,0.3); margin-top: 0.2rem; }
      .mp-progress-bar { height: 8px; background: rgba(255,255,255,0.08); border-radius: 4px; overflow: hidden; margin-top: 0.5rem; }
      .mp-progress-fill { height: 100%; border-radius: 4px; transition: width 0.6s ease; }
      .mp-phase-row { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; margin-bottom: 1.5rem; }
      .mp-phase { background: rgba(255,255,255,0.04); border: 1.5px solid rgba(255,255,255,0.08); border-radius: 12px; padding: 1rem; text-align: center; }
      .mp-phase-name { font-size: 0.72rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.07em; color: rgba(255,255,255,0.5); margin-bottom: 0.5rem; }
      .mp-phase-pct { font-size: 1.25rem; font-weight: 800; font-family: 'Epilogue', sans-serif; }
      .mp-phase-sub { font-size: 0.68rem; color: rgba(255,255,255,0.35); margin-top: 0.2rem; }
      .mp-section-hdr { font-size: 0.75rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: rgba(255,255,255,0.4); margin: 1.25rem 0 0.625rem; padding-bottom: 0.375rem; border-bottom: 1px solid rgba(255,255,255,0.08); }
      .mp-activity-list { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 0.5rem; }
      .mp-act { display: flex; align-items: flex-start; gap: 0.625rem; padding: 0.625rem 0.75rem; border-radius: 8px; border: 1px solid rgba(255,255,255,0.07); background: rgba(255,255,255,0.03); font-size: 0.8rem; }
      .mp-act.done { background: rgba(5,150,105,0.08); border-color: rgba(5,150,105,0.22); }
      .mp-act.na   { opacity: 0.6; }
      .mp-act-badge { flex-shrink: 0; width: 22px; height: 22px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 0.7rem; font-weight: 800; }
      .mp-act-badge.done { background: rgba(5,150,105,0.2); color: #34d399; }
      .mp-act-badge.na   { background: rgba(234,179,8,0.15); color: #fbbf24; }
      .mp-act-badge.open { background: rgba(255,255,255,0.07); color: rgba(255,255,255,0.3); }
      .mp-act-meta { font-size: 0.68rem; color: rgba(255,255,255,0.35); margin-top: 0.15rem; }
      .mp-domain-hdr { grid-column: 1 / -1; font-size: 0.7rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.07em; color: #1C7C8C; margin-top: 0.625rem; margin-bottom: 0.25rem; padding-bottom: 0.25rem; border-bottom: 1px solid rgba(28,124,140,0.25); }
      .mp-notes-block { background: rgba(255,184,28,0.06); border: 1px solid rgba(255,184,28,0.2); border-radius: 10px; padding: 1rem 1.125rem; margin-bottom: 0.75rem; }
      .mp-notes-meta { font-size: 0.7rem; color: rgba(255,255,255,0.4); margin-bottom: 0.375rem; }
      .mp-notes-text { font-size: 0.82rem; color: rgba(255,255,255,0.75); line-height: 1.5; white-space: pre-wrap; }

      /* ── Tutor Reflection styles ── */
      .mp-reflection-card { background: rgba(28,124,140,0.07); border: 1.5px solid rgba(28,124,140,0.2); border-radius: 12px; padding: 1.25rem 1.375rem; margin-bottom: 1rem; }
      .mp-reflection-phase { font-size: 0.7rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #1C7C8C; margin-bottom: 0.75rem; display: flex; align-items: center; gap: 0.5rem; }
      .mp-reflection-phase .mp-refl-badge { background: rgba(28,124,140,0.15); border: 1px solid rgba(28,124,140,0.3); border-radius: 12px; padding: 0.2rem 0.625rem; font-size: 0.68rem; }
      .mp-reflection-phase .mp-refl-saved { background: rgba(5,150,105,0.15); border-color: rgba(5,150,105,0.3); color: #34d399; }
      .mp-narr-leader-block { margin-bottom: 1rem; }
      .mp-narr-leader-label { font-size: 0.68rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.07em; color: rgba(255,255,255,0.35); margin-bottom: 0.375rem; }
      .mp-narr-leader-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem; }
      .mp-narr-field-box { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.07); border-radius: 8px; padding: 0.625rem 0.75rem; }
      .mp-narr-field-label { font-size: 0.65rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: rgba(255,255,255,0.35); margin-bottom: 0.3rem; }
      .mp-narr-field-text { font-size: 0.8rem; color: rgba(255,255,255,0.7); line-height: 1.5; white-space: pre-wrap; }
      .mp-narr-assessment { display: inline-flex; align-items: center; padding: 0.25rem 0.75rem; border-radius: 20px; font-size: 0.72rem; font-weight: 700; background: rgba(255,184,28,0.12); border: 1px solid rgba(255,184,28,0.25); color: #FFB81C; margin-bottom: 0.875rem; }
      .mp-refl-divider { border: none; border-top: 1px dashed rgba(255,255,255,0.1); margin: 1rem 0; }
      .mp-refl-textarea { width: 100%; min-height: 90px; padding: 0.625rem 0.875rem; font-size: 0.875rem; border: 1.5px solid rgba(28,124,140,0.3); border-radius: 8px; font-family: inherit; color: #e2e8f0; background: rgba(28,124,140,0.06); box-sizing: border-box; transition: border-color 0.15s, box-shadow 0.15s; resize: vertical; }
      .mp-refl-textarea:focus { outline: none; border-color: #1C7C8C; box-shadow: 0 0 0 3px rgba(28,124,140,0.15); }
      .mp-refl-save-btn { background: #1C7C8C; color: #fff; border: none; border-radius: 8px; padding: 0.55rem 1.375rem; font-size: 0.8375rem; font-weight: 700; cursor: pointer; font-family: inherit; transition: background 0.2s; margin-top: 0.5rem; }
      .mp-refl-save-btn:hover:not(:disabled) { background: #155e6b; }
      .mp-refl-save-btn:disabled { opacity: 0.5; cursor: not-allowed; }
      .mp-refl-status { font-size: 0.775rem; font-weight: 600; margin-left: 0.75rem; }
      .mp-refl-status.ok { color: #34d399; } .mp-refl-status.err { color: #f87171; }
      .mp-no-narr { font-size: 0.82rem; color: rgba(255,255,255,0.3); padding: 1rem 0; text-align: center; }
      @media (max-width: 640px) { .mp-narr-leader-grid { grid-template-columns: 1fr; } }
      .mp-empty { text-align: center; padding: 2.5rem 1rem; color: rgba(255,255,255,0.3); font-size: 0.875rem; }

      /* ── Career Progression form ── */
      .cp-intro { font-size: 0.82rem; color: rgba(255,255,255,0.5); margin-bottom: 1.5rem; line-height: 1.6; }
      .cp-saved-badge { display: inline-flex; align-items: center; gap: 0.4rem; background: rgba(5,150,105,0.15); border: 1px solid rgba(5,150,105,0.35); color: #34d399; font-size: 0.72rem; font-weight: 700; padding: 0.25rem 0.7rem; border-radius: 20px; margin-left: 0.75rem; vertical-align: middle; }
      .cp-section-label { font-size: 0.72rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #FFB81C; margin: 1.5rem 0 0.875rem; padding: 0.4rem 0.875rem; background: rgba(255,184,28,0.07); border-left: 3px solid #FFB81C; border-radius: 0 6px 6px 0; }
      .cp-field { margin-bottom: 1rem; }
      .cp-label { display: block; font-size: 0.8rem; font-weight: 600; color: rgba(255,255,255,0.7); margin-bottom: 0.35rem; }
      .cp-input, .cp-select, .cp-textarea {
        width: 100%; padding: 0.6rem 0.875rem; font-size: 0.875rem;
        border: 1.5px solid rgba(255,255,255,0.12); border-radius: 8px;
        font-family: inherit; color: #e2e8f0; background: rgba(255,255,255,0.06);
        box-sizing: border-box; transition: border-color 0.15s, box-shadow 0.15s;
      }
      .cp-input:focus, .cp-select:focus, .cp-textarea:focus { outline: none; border-color: #1C7C8C; box-shadow: 0 0 0 3px rgba(28,124,140,0.15); }
      .cp-select option { background: #1a2a3a; color: #e2e8f0; }
      .cp-textarea { min-height: 85px; resize: vertical; }
      .cp-grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
      .cp-grid-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 1rem; }
      .cp-radio-group { display: flex; gap: 0.5rem; flex-wrap: wrap; }
      .cp-radio-btn { padding: 0.375rem 0.875rem; border: 1.5px solid rgba(255,255,255,0.15); border-radius: 8px; cursor: pointer; font-size: 0.8rem; font-weight: 600; color: rgba(255,255,255,0.5); background: rgba(255,255,255,0.04); transition: all 0.15s; user-select: none; font-family: inherit; }
      .cp-radio-btn.selected { border-color: #1C7C8C; background: rgba(28,124,140,0.15); color: #34d399; }
      .cp-course-row { display: grid; grid-template-columns: 1fr 90px auto; gap: 0.5rem; align-items: center; margin-bottom: 0.375rem; }
      .cp-course-row input { padding: 0.45rem 0.75rem; font-size: 0.8rem; border: 1.5px solid rgba(255,255,255,0.12); border-radius: 6px; color: #e2e8f0; background: rgba(255,255,255,0.06); font-family: inherit; box-sizing: border-box; width: 100%; }
      .cp-course-row input:focus { outline: none; border-color: #1C7C8C; }
      .cp-add-btn { background: rgba(28,124,140,0.2); border: 1px solid #1C7C8C; color: #34d399; border-radius: 6px; padding: 0.35rem 0.75rem; font-size: 0.78rem; font-weight: 600; cursor: pointer; font-family: inherit; white-space: nowrap; }
      .cp-remove-btn { background: rgba(239,68,68,0.1); border: 1px solid rgba(239,68,68,0.25); color: #f87171; border-radius: 6px; padding: 0.3rem 0.6rem; font-size: 0.75rem; cursor: pointer; font-family: inherit; line-height: 1; }
      .cp-save-btn { width: 100%; padding: 0.8rem; background: #1C7C8C; color: #fff; border: none; border-radius: 10px; font-size: 0.9375rem; font-weight: 700; cursor: pointer; font-family: inherit; transition: background 0.2s, transform 0.15s, box-shadow 0.15s; margin-top: 0.5rem; }
      .cp-save-btn:hover:not(:disabled) { background: #155e6b; transform: translateY(-1px); box-shadow: 0 4px 14px rgba(28,124,140,0.4); }
      .cp-save-btn:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }
      .cp-status { font-size: 0.8rem; font-weight: 600; text-align: center; margin-top: 0.75rem; min-height: 1.25rem; }
      .cp-status.ok  { color: #34d399; } .cp-status.err { color: #f87171; }
      .cp-last-saved { font-size: 0.7rem; color: rgba(255,255,255,0.3); text-align: center; margin-top: 0.25rem; }
      @media (max-width: 640px) { .mp-phase-row { grid-template-columns: 1fr; } .cp-grid-2, .cp-grid-3 { grid-template-columns: 1fr; } }

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

      /* ── Site info line ── */
      .njtc-site-info {
        font-size: 0.8rem;
        color: rgba(255,255,255,0.5);
        margin-bottom: 1rem;
        font-weight: 500;
      }

      /* ── Weekly trend chart ── */
      .njtc-trend-chart { display:flex; align-items:flex-end; gap:3px; height:80px; padding-bottom:1.5rem; margin-top:0.75rem; overflow-x:auto; }
      .njtc-trend-col { display:flex; flex-direction:column; align-items:center; flex-shrink:0; width:28px; position:relative; }
      .njtc-trend-bar-wrap { position:relative; width:100%; display:flex; flex-direction:column; justify-content:flex-end; height:60px; }
      .njtc-trend-bar-sch { width:100%; border-radius:3px 3px 0 0; min-height:2px; transition:height 0.4s; }
      .njtc-trend-dot-tut { position:absolute; left:50%; transform:translateX(-50%); width:6px; height:6px; border-radius:50%; background:#FFB81C; border:1.5px solid rgba(0,0,0,0.3); }
      .njtc-trend-lbl { font-size:0.55rem; color:rgba(255,255,255,0.4); margin-top:0.25rem; white-space:nowrap; }

      /* ── Scholar missed reasons bar (horizontal inline) ── */
      .njtc-miss-bar-row { display:flex; align-items:center; gap:0.5rem; margin-bottom:0.5rem; }
      .njtc-miss-bar-label { font-size:0.75rem; flex:1; color:rgba(255,255,255,0.8); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; min-width:0; }
      .njtc-miss-bar-track { width:80px; height:6px; background:rgba(255,255,255,0.1); border-radius:999px; flex-shrink:0; }
      .njtc-miss-bar-fill { height:100%; border-radius:999px; background:#457b9d; }
      .njtc-miss-bar-count { font-size:0.75rem; font-weight:700; color:rgba(255,255,255,0.7); flex-shrink:0; width:2rem; text-align:right; }
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
      kpiSkeletonCard('Scholar Attendance', 'your students') +
      kpiSkeletonCard('Sessions Done', 'this school year') +
      kpiSkeletonCard('Unique Scholars', 'this year · Pearl ops') +
      kpiSkeletonCard('Survey Completion', 'goal: 100%') +
      kpiSkeletonCard('Scholar Survey', 'student avg');
    return strip;
  }

  function fillKPIStrip(strip, data) {
    const attRate = data.myAttRate;
    const color = attColor(attRate);
    const schColor = attColor(data.scholarAttRate);
    const schSurveyAvg = data.stuSurveyAvg;
    const schSurveyColor = schSurveyAvg === null ? '#6b7280'
      : schSurveyAvg >= 3.5 ? '#a855f7'
      : '#ef4444';
    strip.innerHTML = `
      <div class="njtc-kpi-card">
        <div class="njtc-kpi-value" style="color:${color};">${attRate !== null ? attRate + '%' : '—'}</div>
        <div class="njtc-kpi-label">My Attendance</div>
        <div class="njtc-kpi-sub">Goal: 90%</div>
      </div>
      <div class="njtc-kpi-card">
        <div class="njtc-kpi-value" style="color:${schColor};">${data.scholarAttRate !== null ? data.scholarAttRate + '%' : '—'}</div>
        <div class="njtc-kpi-label">Scholar Attendance</div>
        <div class="njtc-kpi-sub">your students</div>
      </div>
      <div class="njtc-kpi-card">
        <div class="njtc-kpi-value">${data.myAttended}</div>
        <div class="njtc-kpi-label">Sessions Done</div>
        <div class="njtc-kpi-sub">this school year</div>
      </div>
      <div class="njtc-kpi-card">
        <div class="njtc-kpi-value">${data.uniqueScholarCount != null ? data.uniqueScholarCount : data.scholars.length}</div>
        <div class="njtc-kpi-label">Unique Scholars</div>
        <div class="njtc-kpi-sub">this year · Pearl ops</div>
      </div>
      <div class="njtc-kpi-card">
        <div class="njtc-kpi-value" style="color:${surveyColor(data.surveyRate || 0)};">${data.surveyRate !== null ? data.surveyRate + '%' : '—'}</div>
        <div class="njtc-kpi-label">Survey Completion</div>
        <div class="njtc-kpi-sub">goal: 100%</div>
      </div>
      <div class="njtc-kpi-card">
        <div class="njtc-kpi-value" style="color:${schSurveyColor};">${schSurveyAvg !== null ? schSurveyAvg + '/5' : '—'}</div>
        <div class="njtc-kpi-label">Scholar Survey</div>
        <div class="njtc-kpi-sub">student avg</div>
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

    const siteInfoHtml = (data.tutorSchool || data.tutorDistrict)
      ? `<div class="njtc-site-info">📍 ${esc(data.tutorSchool || '')}${data.tutorSchool && data.tutorDistrict ? ' · ' : ''}${esc(data.tutorDistrict || '')}</div>`
      : '';

    // Weekly trend chart — last 16 weeks
    let trendHtml = '';
    if (data.weeklyTrend && data.weeklyTrend.length) {
      const recent = data.weeklyTrend.slice(-16);
      const bars = recent.map(w => {
        const schRate = w.scholarRate;
        const tutRate = w.tutorRate;
        const h = schRate !== null ? Math.round((schRate / 100) * 60) : 2;
        const tutH = tutRate !== null ? Math.round((tutRate / 100) * 60) : null;
        const barColor = schRate === null ? 'rgba(255,255,255,0.1)'
          : schRate >= 90 ? '#22c55e'
          : schRate >= 80 ? '#f97316'
          : '#ef4444';
        const label = w.week.replace(/[^0-9]/g, '') ? 'W' + w.week.replace(/[^0-9]/g, '') : w.week;
        const title = `${esc(w.week)}: Scholar ${schRate !== null ? schRate + '%' : '—'} · Tutor ${tutRate !== null ? tutRate + '%' : '—'}`;
        const dotHtml = tutH !== null
          ? `<div class="njtc-trend-dot-tut" style="bottom:${tutH}px;"></div>`
          : '';
        return `<div class="njtc-trend-col" title="${title}">
          <div class="njtc-trend-bar-wrap">
            <div class="njtc-trend-bar-sch" style="height:${h}px;background:${barColor};"></div>
            ${dotHtml}
          </div>
          <div class="njtc-trend-lbl">${esc(label)}</div>
        </div>`;
      }).join('');
      trendHtml = `<div class="njtc-trend-chart">${bars}</div>`;
    }

    el.innerHTML = `<span class="njtc-section-title">📅 Your Attendance This Year</span>
      ${siteInfoHtml}
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
      </div>
      ${trendHtml ? `<div style="margin-top:0.75rem;"><div style="font-size:0.72rem;color:rgba(255,255,255,0.4);margin-bottom:0.25rem;text-transform:uppercase;letter-spacing:0.05em;">Weekly Trend — Scholar vs Tutor Rate</div>${trendHtml}</div>` : ''}`;

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
            ${s.consecConcern ? `<span title="Consecutive absence concern" style="display:inline-flex;align-items:center;justify-content:center;width:1.4rem;height:1.4rem;border-radius:50%;background:rgba(251,191,36,0.18);border:1.5px solid rgba(251,191,36,0.5);font-size:0.72rem;flex-shrink:0;">⚠️</span>` : ''}
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
      return `<div class="njtc-miss-bar-row">
        <div class="njtc-miss-bar-label">${esc(friendlyScholarReason(r))}</div>
        <div class="njtc-miss-bar-track"><div class="njtc-miss-bar-fill" style="width:${pct}%;"></div></div>
        <div class="njtc-miss-bar-count">${c}</div>
      </div>`;
    }).join('');

    el.innerHTML = `<span class="njtc-section-title">💬 Why Your Students Miss Sessions</span>
      <div class="njtc-si-note">
        School closings and interruptions are shown separately and don't affect your students' attendance record.
      </div>
      <div>${bars}</div>`;

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

    // Build severity-coded rows from siByLevel
    const SI_LEVEL_CONFIG = {
      critical: { label: 'Critical', bg: 'rgba(239,68,68,0.12)', border: '#ef4444', badge: '#ef4444', badgeTxt: '#fff' },
      high:     { label: 'High',     bg: 'rgba(249,115,22,0.10)', border: '#f97316', badge: '#f97316', badgeTxt: '#fff' },
      medium:   { label: 'Medium',   bg: 'rgba(234,179,8,0.10)',  border: '#eab308', badge: '#eab308', badgeTxt: '#001a33' },
      low:      { label: 'Low',      bg: 'rgba(107,114,128,0.10)', border: '#6b7280', badge: '#6b7280', badgeTxt: '#fff' }
    };

    let siLevelHtml = '';
    const siByLevel = data.siByLevel || {};
    for (const level of ['critical', 'high', 'medium', 'low']) {
      const entries = Object.entries(siByLevel[level] || {}).sort((a, b) => b[1] - a[1]);
      if (!entries.length) continue;
      const cfg = SI_LEVEL_CONFIG[level];
      const rows = entries.map(([r, c]) =>
        `<div style="display:flex;align-items:center;gap:0.5rem;padding:0.3rem 0;border-bottom:1px solid rgba(255,255,255,0.04);">
          <span style="display:inline-block;padding:0.1rem 0.45rem;border-radius:999px;font-size:0.68rem;font-weight:700;background:${cfg.badge};color:${cfg.badgeTxt};flex-shrink:0;">${esc(cfg.label)}</span>
          <span style="flex:1;font-size:0.82rem;color:rgba(255,255,255,0.75);">${esc(r || 'Unknown')}</span>
          <span style="font-size:0.82rem;font-weight:700;color:rgba(255,255,255,0.6);flex-shrink:0;">${c}</span>
        </div>`
      ).join('');
      siLevelHtml += `<div style="margin-bottom:0.5rem;padding:0.6rem 0.75rem;background:${cfg.bg};border-left:3px solid ${cfg.border};border-radius:0 0.5rem 0.5rem 0;">${rows}</div>`;
    }

    const bars = siLevelHtml || '<div class="njtc-empty-state"><p>No breakdown available.</p></div>';

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
          ${bars}
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

  // iReady 22-25 longitudinal data (IR_LONG_2PACX) removed — that published key has
  // expired and caused console 404s on every dashboard load without providing value.
  // Current-year data is served via snap2526 (gviz) and MOY endpoints below.
  // 25-26 preliminary data: matched via Pearl scholar IDs, not tutor name
  // Sheet identifiers below — see data-sources.js (loaded before this file)
  // for the single source of truth; update rollover values there, not here.
  const SRC = (typeof NJTC_SOURCES !== 'undefined') ? NJTC_SOURCES : {};
  const IR_2526_ID       = SRC.IREADY_CURRENT_SHEET_ID;
  const IR_2526_ELA_GID  = SRC.IREADY_CURRENT_ELA_GID;
  const IR_2526_MATH_GID = SRC.IREADY_CURRENT_MATH_GID;
  // MOY (Winter 2026) — wide-format sheet, same source used by Apprentice Impact Report
  const IR_MOY_SHEET_ID  = '1AIMqvTRrZ-XBf_-ePzVnGaPExFU3DfdPg_1sPj33RnI';
  const IR_MOY_ELA_GID   = '912997533';
  const IR_MOY_MATH_GID  = '186448147';
  const IR_MOY_URL       = gid => `https://docs.google.com/spreadsheets/d/${IR_MOY_SHEET_ID}/gviz/tq?tqx=out:csv&gid=${gid}`;
  // Standards Mastery — per-scholar pre/post assessment scores (Middlesex STEM + SM schools)
  // 404 FIX: truncated published key replaced with the direct sheet-ID gviz
  // endpoint (same access path the Central portal uses for this sheet).
  const SM_SHEET_ID      = SRC.SM_SHEET_ID;
  const SM_ALL_GID       = SRC.SM_GID;
  const SM_URL           = `https://docs.google.com/spreadsheets/d/${SM_SHEET_ID}/gviz/tq?tqx=out:csv&gid=${SM_ALL_GID}`;
  const SM_SCHOOLS       = new Set(['middlesex stem']);
  const IR_CACHE_KEY     = 'njtc_od_iready_v11'; // bumped: SESS-fallback scholar matching for site leaders
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
    const syCol     = col(['academic', 'year']) >= 0 ? col(['academic', 'year']) : col(['school', 'year']);
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
    const syCol     = col(['academic', 'year']) >= 0 ? col(['academic', 'year']) : col(['school', 'year']);
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
        pearlId:     stuIdCol >= 0 ? (r[stuIdCol] || '').trim() : '', // Pearl student USER_ID for MOY join
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

  // ── iReady: EOY multi-row-per-diagnostic normalization ────────────────────────
  // The 25-26 EOY Preliminary CSV has one row per diagnostic per student
  // (BOY row: Baseline Diagnostic=Y, EOY row: Most Recent Diagnostic YTD=Y).
  // Pairs them per student and returns the same shape as normalizeIRSheet2526.
  function normalizeIrEoyRows(rawRows, subject, scholarIds, scholarNames) {
    if (!rawRows || rawRows.length < 2) return [];
    const header = rawRows[0].map(h => (h || '').trim().toLowerCase());
    // Only handle EOY format (has "baseline diagnostic" flag column)
    if (!header.some(h => h.includes('baseline diagnostic'))) return [];

    function hIdx(keywords) {
      return header.findIndex(h => keywords.every(k => h.includes(k)));
    }
    const nameCol    = hIdx(['full', 'name'])    >= 0 ? hIdx(['full', 'name'])    :
                       hIdx(['student', 'name']) >= 0 ? hIdx(['student', 'name']) : 0;
    const idCol      = hIdx(['student', 'id'])   >= 0 ? hIdx(['student', 'id'])   : 3;
    const gradeCol   = hIdx(['student', 'grade'])>= 0 ? hIdx(['student', 'grade']): hIdx(['grade']) >= 0 ? hIdx(['grade']) : 4;
    const schoolCol  = hIdx(['school'])          >= 0 ? hIdx(['school'])          : 6;
    const syCol      = hIdx(['academic', 'year'])>= 0 ? hIdx(['academic', 'year']): 5;
    const plcCol     = hIdx(['overall', 'relative', 'placement']);
    const boyFlagCol = hIdx(['baseline', 'diagnostic']);
    const eoyFlagCol = hIdx(['most', 'recent', 'diagnostic']);
    const pctCol     = hIdx(['percent', 'progress', 'typical']) >= 0 ? hIdx(['percent', 'progress', 'typical'])
                     : hIdx(['typical growth']);
    if (plcCol < 0 || boyFlagCol < 0) return [];

    const students = {};
    rawRows.slice(1).forEach(r => {
      const name = (r[nameCol] || '').trim();
      const sid  = idCol >= 0 ? (r[idCol] || '').trim() : '';
      if (!name) return;
      // Match scholar
      let matched = false;
      if (sid && scholarIds && scholarIds.has(sid)) matched = true;
      if (!matched && scholarNames) {
        const nn = normIRName(name);
        if (nn.length > 2 && scholarNames.has(nn)) matched = true;
      }
      if (!matched) return;
      const key = sid || name.toLowerCase().replace(/\s+/g, ' ');
      if (!students[key]) students[key] = { name, sid,
        grade: (r[gradeCol] || '').trim(), school: (r[schoolCol] || '').trim(),
        sy: (r[syCol] || '').trim(), boy: null, eoy: null, pctTypical: null };
      const isBoy = (r[boyFlagCol] || '').trim().toUpperCase() === 'Y';
      const isEoy = eoyFlagCol >= 0 && (r[eoyFlagCol] || '').trim().toUpperCase() === 'Y';
      const plc   = (r[plcCol] || '').trim();
      if (isBoy) students[key].boy = plc;
      if (isEoy) {
        students[key].eoy = plc;
        if (pctCol >= 0) {
          let pct = parseFloat(r[pctCol] || '');
          if (!isNaN(pct)) {
            if (pct > 0 && pct <= 15) pct = Math.round(pct * 100);
            else pct = Math.round(pct);
            students[key].pctTypical = pct;
          }
        }
      }
    });
    return Object.values(students).filter(s => s.boy || s.eoy).map(s => ({
      tutorName:   'pearl-matched',
      studentName: s.name,
      basePLC:     s.boy  || '',
      springPLC:   s.eoy  || '',
      pctTypical:  s.pctTypical,
      grade:       s.grade,
      school:      s.school,
      sy:          s.sy || '2025-2026',
      subject
    }));
  }

  // ── iReady: MOY sheet normalization (wide-format: base_ + winter_ on same row) ──
  // Primary join: _pearlId (user_name column) = Pearl scholar USER_ID — exact match.
  // Fallback: scholarId (local_student_id) or normalized student name + school.
  function normalizeMOYSheet(rows, subject, scholarIds, scholarNames) {
    if (rows.length < 2) return [];
    if ((!scholarIds || !scholarIds.size) && (!scholarNames || !scholarNames.size)) return [];

    const rawHdr = rows[0];
    const hIdx = {};
    rawHdr.forEach((h, i) => {
      const k = (h || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
      if (k) hIdx[k] = i;
    });

    function gRow(r) {
      return function() {
        for (let i = 0; i < arguments.length; i++) {
          const idx = hIdx[arguments[i]];
          if (idx !== undefined && idx >= 0 && r[idx] && (r[idx] + '').trim()) return (r[idx] + '').trim();
        }
        return '';
      };
    }

    function normPLC(raw) {
      if (!raw) return '';
      const m = {
        '3+ grade levels below': '3 or More Grade Levels Below',
        '3 or more grade levels below': '3 or More Grade Levels Below',
        '2 grade levels below': '2 Grade Levels Below',
        '1 grade level below': '1 Grade Level Below',
        'early on grade level': 'Early On Grade Level',
        'mid or above grade level': 'Mid or Above Grade Level',
        'on or above grade level': 'Mid or Above Grade Level',
        'at or above grade level': 'Mid or Above Grade Level',
      };
      return m[raw.trim().toLowerCase()] || raw.trim();
    }

    return rows.slice(1).filter(r => {
      const g = gRow(r);
      const pId = g('user_name', 'username', 'student_username', 'user_id');
      const sId = g('student_id', 'local_student_id', 'id');
      const nm  = g('student_name', 'first_and_last_name', 'name', 'full_name');
      if (pId && scholarIds && scholarIds.has(pId)) return true;
      if (sId && scholarIds && scholarIds.has(sId))  return true;
      if (nm  && scholarNames) { const nn = normIRName(nm); if (nn.length > 2 && scholarNames.has(nn)) return true; }
      return false;
    }).map(r => {
      const g = gRow(r);
      const rawPct = g('winter_pct_progress_typical_growth', 'winter_pct_toward_typical_growth',
                       'winter_pct_typical', 'pct_progress_typical_growth', 'mid_pct_progress_typical_growth');
      let pct = parseFloat(rawPct);
      if (isNaN(pct)) pct = null;
      else if ((rawPct + '').trim().endsWith('%')) pct = Math.round(pct);
      else if (pct > 0 && pct <= 1) pct = Math.round(pct * 100);
      else pct = Math.round(pct);

      const moyScoreRaw = parseFloat(g('winter_overall_scale_score', 'mid_overall_scale_score', 'moy_overall_scale_score'));
      return {
        studentName: g('student_name', 'first_and_last_name', 'name', 'full_name'),
        pearlId:     g('user_name', 'username', 'student_username', 'user_id'),
        stuId:       g('student_id', 'local_student_id', 'id'),
        school:      g('school', 'school_name', 'site_name'),
        grade:       g('student_grade', 'grade'),
        basePLC:     normPLC(g('base_overall_relative_placement', 'fall_overall_relative_placement', 'boy_overall_relative_placement')),
        moyPLC:      normPLC(g('winter_overall_relative_placement', 'mid_overall_relative_placement', 'moy_overall_relative_placement')),
        moyScore:    isNaN(moyScoreRaw) ? null : moyScoreRaw,
        pctTypical:  pct,
        subject,
        sy: '2025-2026',
      };
    });
  }

  // ── Standards Mastery: normalize per-scholar pre/post assessment rows ─────────
  // Matches tutors via Class(es) or Class Teacher(s); scholars via Student ID or name.
  function normalizeSmRows(csvText, tutorNormName, scholarIds, scholarNames) {
    const lines = csvText.replace(/\r\n?/g, '\n').split('\n').filter(l => l.trim());
    if (lines.length < 2) return [];
    // Simple CSV split (assume no embedded commas in SM sheet)
    const split = line => {
      const r = []; let cur = '', inQ = false;
      for (let i = 0; i <= line.length; i++) {
        const ch = i < line.length ? line[i] : ',';
        if (inQ) { if (ch === '"') inQ = false; else cur += ch; }
        else if (ch === '"') inQ = true;
        else if (ch === ',') { r.push(cur.trim()); cur = ''; }
        else cur += ch;
      }
      return r;
    };
    const headers = split(lines[0]).map(h => h.trim());
    const col = name => headers.findIndex(h => h.toLowerCase().includes(name.toLowerCase()));
    const idxStuId   = col('student id');
    const idxFirst   = col('first name');
    const idxLast    = col('last name');
    const idxGrade   = col('grade');
    const idxSubject = col('subject');
    const idxAsm     = col('assessment name');
    const idxScore   = col('score (%)') >= 0 ? col('score (%)') : col('assessment score');
    const idxPLC     = col('relative placement');
    const idxPrePost = col('pre to post');
    const idxClass   = col('class(es)');
    const idxTeacher = col('class teacher');
    if (idxStuId < 0 && idxFirst < 0) return [];

    const normTeacher = s => (s || '').toLowerCase().replace(/[-'\s]+/g, ' ').trim();
    const matchesTutor = row => {
      const classStr = (row[idxClass] || '') + ';' + (row[idxTeacher] || '');
      return classStr.split(/[;,]/).some(seg => {
        const part = seg.includes(' - ') ? seg.slice(0, seg.indexOf(' - ')).trim() : seg.trim();
        return normTeacher(part) === tutorNormName;
      });
    };
    const matchesScholar = row => {
      const sId = (row[idxStuId] || '').trim();
      if (sId && scholarIds && scholarIds.has(sId)) return true;
      const name = ((row[idxFirst] || '') + ' ' + (row[idxLast] || '')).trim();
      if (name && scholarNames) { const nn = normIRName(name); if (nn.length > 2 && scholarNames.has(nn)) return true; }
      return false;
    };

    return lines.slice(1).map(split).filter(row => row.length > 3 && matchesTutor(row) && matchesScholar(row)).map(row => ({
      stuId:       (row[idxStuId]   || '').trim(),
      studentName: ((row[idxFirst] || '') + ' ' + (row[idxLast] || '')).trim(),
      grade:       (row[idxGrade]   || '').trim(),
      subject:     (row[idxSubject] || '').trim(),
      asmName:     (row[idxAsm]     || '').trim(),
      score:       parseFloat(row[idxScore])   || 0,
      placement:   (row[idxPLC]     || '').trim(),
      preToPost:   (row[idxPrePost] || '').trim(),
      isFormA:     /form a/i.test(row[idxAsm] || ''),
      isFormB:     /form b/i.test(row[idxAsm] || ''),
    }));
  }

  // ── iReady: fetch all data for this tutor ─────────────────────────────────────

  async function fetchIReadyData(userName, scholarIds, scholarNames, tutorSubject) {
    // Cache check — keyed by name + subject; clear old caches automatically via version bump
    try {
      const cached = JSON.parse(localStorage.getItem(IR_CACHE_KEY) || 'null');
      if (cached && cached.ts && (Date.now() - cached.ts) < IR_CACHE_TTL && cached.rows &&
          cached.name === userName && cached.subject === (tutorSubject || null)) {
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

    const snap2526 = `https://docs.google.com/spreadsheets/d/${IR_2526_ID}/gviz/tq?tqx=out:csv&gid=`;

    // Gate fetches to only the subject sheets this tutor is assigned to.
    // tutorSubject='ELA' → skip Math sheets entirely; 'Math' → skip ELA; null → fetch all.
    const fetchELA  = !tutorSubject || tutorSubject === 'ELA';
    const fetchMath = !tutorSubject || tutorSubject === 'Math';
    const EMPTY = Promise.resolve([]);

    // Note: IR_LONG_2PACX (22-25 longitudinal) is no longer fetched — the published key
    // for that sheet has expired, causing console 404s on every dashboard load.
    // The 25-26 snapshot (snap2526) and MOY data below cover current-year views.
    const [snapMath, snapELA, moyMath, moyELA] = await Promise.all([
      fetchMath ? fetchCSV(snap2526 + IR_2526_MATH_GID)      : EMPTY,
      fetchELA  ? fetchCSV(snap2526 + IR_2526_ELA_GID)       : EMPTY,
      fetchMath ? fetchCSV(IR_MOY_URL(IR_MOY_MATH_GID))      : EMPTY,
      fetchELA  ? fetchCSV(IR_MOY_URL(IR_MOY_ELA_GID))       : EMPTY,
    ]);

    // Longitudinal 22-25 rows no longer fetched (key expired); current-year data below
    const filteredLongRows = [];

    // 25-26 EOY PRELIMINARY rows: normalizeIrEoyRows handles multi-row-per-diagnostic
    // format (EOY export); normalizeIRSheet2526 handles longitudinal/wide format.
    function ir2526(rows, subj) {
      const eoy = normalizeIrEoyRows(rows, subj, scholarIds, scholarNames);
      return eoy.length > 0 ? eoy : normalizeIRSheet2526(rows, subj, scholarIds, scholarNames);
    }
    const rows2526 = [
      ...ir2526(snapMath, 'Math'),
      ...ir2526(snapELA,  'ELA'),
    ];

    // MOY (Winter 2026) rows: matched by Pearl USER_ID (user_name column = Tier 0 exact join),
    // or by student ID / normalized name as fallbacks. Only applies to 2025-2026 scholars.
    const moyRows = [
      ...normalizeMOYSheet(moyMath, 'Math', scholarIds, scholarNames),
      ...normalizeMOYSheet(moyELA,  'ELA',  scholarIds, scholarNames),
    ];
    // Build MOY lookup: (pearlId or normName)|subject → moyPLC, moyScore
    const moyLookup = {};
    moyRows.forEach(m => {
      const subj = m.subject;
      if (m.pearlId)  moyLookup[m.pearlId  + '|' + subj] = m;
      if (m.stuId)    moyLookup[m.stuId    + '|' + subj] = m;
      const nn = normIRName(m.studentName);
      if (nn.length > 2) moyLookup[nn + '|' + subj] = m;
    });
    // Merge MOY into 25-26 rows: use pearlId first, then normalized name
    const rows2526WithMOY = rows2526.map(r => {
      const nn  = normIRName(r.studentName);
      const moy = moyLookup[(r.pearlId || '') + '|' + r.subject]
               || moyLookup[nn + '|' + r.subject];
      return moy ? { ...r, moyPLC: moy.moyPLC, moyScore: moy.moyScore } : r;
    });

    // Combine: longitudinal first (22-25), then 25-26 (EOY prelim + MOY)
    const allRows = [...filteredLongRows, ...rows2526WithMOY];

    // Deduplicate: same student + subject + school year
    const seen = new Set();
    const deduped = allRows.filter(r => {
      const key = normIRName(r.studentName) + '|' + r.subject + '|' + r.sy;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    try { localStorage.setItem(IR_CACHE_KEY, JSON.stringify({ ts: Date.now(), name: userName, subject: tutorSubject || null, rows: deduped })); } catch (e) {}
    return deduped;
  }

  // ── Standards Mastery: fetch and return rows for this tutor's scholars ────────
  async function fetchSmData(userName, scholarIds, scholarNames) {
    try {
      const res = await fetch(SM_URL, { signal: AbortSignal.timeout(15000) });
      if (!res.ok) return [];
      const text = await res.text();
      const normTutor = (userName || '').toLowerCase().replace(/[-'\s]+/g, ' ').trim();
      return normalizeSmRows(text, normTutor, scholarIds, scholarNames);
    } catch (e) { return []; }
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

    let activeSY  = '';   // default = all years; individual tabs let user drill down
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
          const hasSpring = !!(r.springPLC && r.springPLC.trim());
          const hasMOY    = !!(r.moyPLC    && r.moyPLC.trim());
          const mColor    = plcColor(r.moyPLC || '');
          let placementHtml;
          if (hasSpring && hasMOY) {
            // Full timeline: BOY → MOY → EOY
            placementHtml =
              `<span class="njtc-plc-badge" style="background:${bColor}" title="BOY">${esc(plcShort(r.basePLC))}</span>` +
              arrowHtml(r.basePLC, r.moyPLC) +
              `<span class="njtc-plc-badge" style="background:${mColor};opacity:.85" title="MOY">❄ ${esc(plcShort(r.moyPLC))}</span>` +
              arrowHtml(r.moyPLC, r.springPLC) +
              `<span class="njtc-plc-badge" style="background:${sColor}" title="EOY">${esc(plcShort(r.springPLC))}</span>`;
          } else if (hasSpring) {
            // BOY → EOY (no MOY data for this scholar)
            placementHtml =
              `<span class="njtc-plc-badge" style="background:${bColor}" title="BOY">${esc(plcShort(r.basePLC))}</span>` +
              arrowHtml(r.basePLC, r.springPLC) +
              `<span class="njtc-plc-badge" style="background:${sColor}" title="EOY">${esc(plcShort(r.springPLC))}</span>`;
          } else if (hasMOY) {
            // BOY → MOY (EOY not yet available)
            placementHtml =
              `<span class="njtc-plc-badge" style="background:${bColor}" title="BOY">${esc(plcShort(r.basePLC))}</span>` +
              arrowHtml(r.basePLC, r.moyPLC) +
              `<span class="njtc-plc-badge" style="background:${mColor};opacity:.85" title="MOY – Winter checkpoint">❄ ${esc(plcShort(r.moyPLC))}</span>` +
              `<span style="font-size:.68rem;color:rgba(255,255,255,.3);margin-left:.35rem">EOY pending</span>`;
          } else {
            // BOY only
            placementHtml =
              `<span class="njtc-plc-badge" style="background:${bColor}" title="BOY">${esc(plcShort(r.basePLC))}</span>` +
              `<span style="font-size:.7rem;color:rgba(255,255,255,.3);margin-left:.35rem">spring pending</span>`;
          }
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
                <th>Gr</th>
                <th>Placement · BOY → MOY → EOY</th>
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

    const syTabsHtml = [
      `<button class="njtc-tab-btn active" data-sy="">All Years</button>`,
      ...syList.map(sy => `<button class="njtc-tab-btn" data-sy="${esc(sy)}">${esc(sy)}</button>`)
    ].join('');

    const subjectTabsHtml = ['All', ...subjectSet].map((sub, i) =>
      `<button class="njtc-tab-btn${i === 0 ? ' active' : ''}" data-sub="${esc(sub)}">${esc(sub)}</button>`
    ).join('');

    el.innerHTML = `
      <span class="njtc-section-title">📈 Academic Impact — iReady Diagnostics
        <span class="njtc-eoy-pill">BOY · MOY · EOY</span>
      </span>
      <div class="njtc-ir-explainer">
        This section shows <strong>iReady diagnostic data</strong> for scholars you've worked with — sourced directly from your Pearl scholar records. Your 2025-2026 data uses Pearl scholar IDs for exact matching; historical years (2022–2025) are matched by your name on the iReady Dashboard.
        <br><br>
        <strong>BOY</strong> = Beginning of Year baseline · <strong>MOY</strong> = Mid-Year Winter diagnostic (when available) · <strong>EOY</strong> = End-of-Year final result.
        "Moved Up" = a scholar jumped at least one placement level — that's your direct impact.
        Growth vs Typical = progress as a % of expected annual growth (100% = full typical growth).
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
      <p>${esc(msg || 'Pearl data is currently unavailable. The data source needs to be re-published. Please contact your administrator or try again later.')}</p>
    </div>`;
    return el;
  }

  // ── Standards Mastery section ────────────────────────────────────────────────
  function buildSmSection(smRows) {
    if (!smRows || !smRows.length) return null;
    const el = document.createElement('div');
    el.className = 'njtc-dash-section';

    // Group by student name + assessment base name; collect Form A (pre) and Form B (post)
    const map = {};
    smRows.forEach(r => {
      const base = r.asmName.replace(/\s*Form [AB]\s*/i, '').replace(/:\s*Grade \d+\s*/i, '').trim();
      const key  = normIRName(r.studentName) + '|' + base;
      if (!map[key]) map[key] = { name: r.studentName, grade: r.grade, subject: r.subject, base, formA: null, formB: null };
      if (r.isFormA) map[key].formA = r;
      if (r.isFormB) map[key].formB = r;
    });

    const pairs = Object.values(map).sort((a, b) => a.name.localeCompare(b.name));
    const rowsHtml = pairs.map(p => {
      const pre  = p.formA ? p.formA.score : null;
      const post = p.formB ? p.formB.score : null;
      const dir  = (p.formA || p.formB || {}).preToPost || '';
      const improved = post !== null && pre !== null ? post > pre : null;
      const postColor = improved === true ? '#22c55e' : improved === false ? '#ef4444' : '#94a3b8';
      return `<tr>
        <td>${esc(toInitials(p.name))}<div style="font-size:.68rem;color:rgba(255,255,255,.35)">${esc(p.base)}</div></td>
        <td><span style="font-size:.75rem;color:rgba(255,255,255,.5)">Gr ${esc(p.grade || '?')}</span></td>
        <td style="text-align:center">${pre !== null ? pre + '%' : '—'}</td>
        <td style="text-align:center;font-weight:700;color:${postColor}">${post !== null ? post + '%' : '—'}</td>
        <td style="text-align:center;font-size:.75rem;color:${postColor}">${esc(dir) || (improved === true ? '↑ Improved' : improved === false ? '↓ Declined' : '—')}</td>
      </tr>`;
    }).join('');

    el.innerHTML = `
      <span class="njtc-section-title">📋 Standards Mastery
        <span class="njtc-eoy-pill">SY 25-26</span>
      </span>
      <div class="njtc-ir-explainer">
        Pre-assessment (Form A) and post-assessment (Form B) scores for your scholars.
        Matched via Pearl scholar IDs. Progress = improvement from Form A to Form B.
      </div>
      <div class="njtc-ir-scroll" style="overflow-x:auto">
        <table class="njtc-ir-table">
          <thead><tr>
            <th>Scholar</th><th>Gr</th>
            <th style="text-align:center">Pre (Form A)</th>
            <th style="text-align:center">Post (Form B)</th>
            <th style="text-align:center">Change</th>
          </tr></thead>
          <tbody>${rowsHtml}</tbody>
        </table>
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
      // Expose Pearl data globally so Connor chatbot can read it
      window._connorPearlData = data;
      window._connorUser = user;
      // Build scholar lookup sets so 25-26 iReady snapshot and MOY can match by student ID/name
      const scholarIds   = new Set(data.scholars.map(s => s.id).filter(Boolean));
      const scholarNames = new Set(data.scholars.map(s => normIRName(s.name)).filter(n => n.length > 2));
      irRows = await fetchIReadyData(user.name, scholarIds, scholarNames, data.tutorSubject || null).catch(() => []);
      window._connorIReadyData = irRows || [];
      // Fetch Standards Mastery data for tutors at SM schools (e.g. Middlesex STEM)
      const tutorSchools = (user.assignments || []).flatMap(a => a.schools || []);
      const isSmTutor = tutorSchools.some(s => SM_SCHOOLS.has((s || '').toLowerCase().trim()));
      window._connorSmData = isSmTutor
        ? await fetchSmData(user.name, scholarIds, scholarNames).catch(() => [])
        : [];
    } catch (err) {
      // pearl-data.js already retried up to 5× with backoff. If still failing,
      // schedule one final auto-retry after 10 seconds before showing hard error.
      const alreadyRetried = user._dashRetried;
      if (!alreadyRetried) {
        user._dashRetried = true;
        if (kpiStrip) kpiStrip.innerHTML = `<div class="njtc-kpi-card"><div class="njtc-kpi-label" style="color:#94a3b8">Connecting to Pearl… retrying in 10s</div></div>`;
        if (dashPlaceholder) dashPlaceholder.innerHTML = `<div style="padding:32px;text-align:center;color:#94a3b8;font-size:.9rem">Establishing connection to Pearl Operations data…</div>`;
        if (window.NJTCPearlData && window.NJTCPearlData.clearCache) window.NJTCPearlData.clearCache();
        setTimeout(() => build(user), 10000);
        return;
      }
      // Hard failure after second attempt — show actionable error
      if (kpiStrip) {
        kpiStrip.innerHTML = `<div class="njtc-kpi-card"><div class="njtc-kpi-label" style="color:rgba(252,165,165,0.8);">Pearl data unavailable — try refreshing the page</div></div>`;
      }
      if (dashPlaceholder) {
        dashPlaceholder.innerHTML = '';
        dashPlaceholder.appendChild(buildErrorSection('Pearl data is temporarily unavailable. Please refresh the page or try again in a moment.'));
      }
      return;
    }

    // -- Fill KPI strip --
    fillKPIStrip(kpiStrip, data);

    // -- Inject portal tab nav (My Dashboard | My Progress) --
    _injectPortalTabNav();

    // -- Build dashboard sections --
    if (dashPlaceholder) {
      dashPlaceholder.innerHTML = '';

      const smRows = window._connorSmData || [];
      const sections = [
        buildActionSection(data),
        buildAttendanceSection(data),
        buildIReadySection(irRows || []),
        smRows.length ? buildSmSection(smRows) : null,
        buildMissedSection(data),
        buildScholarSection(data),
        buildScholarMissedSection(data),
        buildScoresSection(data),
        buildSurveySection(data),
        buildSISection(data)
      ].filter(Boolean);

      sections.forEach(s => dashPlaceholder.appendChild(s));

      // Trigger SVG fill animations
      requestAnimationFrame(() => {
        dashPlaceholder.querySelectorAll('circle[stroke-dasharray]').forEach(c => {
          const da = c.getAttribute('stroke-dasharray');
          c.style.transition = 'none';
          c.setAttribute('stroke-dasharray', '0 9999');
          void c.getBoundingClientRect();
          c.style.transition = 'stroke-dasharray 1s ease';
          c.setAttribute('stroke-dasharray', da);
        });
      });
    }

    // -- Load My Progress pane async (non-blocking, runs after dashboard renders) --
    // Skip entirely for leader roles — their sub-tab is hidden and Team
    // Progress (My Team tab) is their priority view instead.
    if (!window.NJTC_IS_LEADER_ROLE) {
      buildMyProgressPane(user).catch(() => {
        const pane = document.getElementById('njtc-ptab-progress');
        if (pane) pane.innerHTML = `<div class="mp-empty">Could not load progress data — please refresh the page.</div>`;
      });
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // ██  MY PROGRESS TAB — OJT Activity Details, Hours, Leader Notes,
  //     and Career Progression form.
  //     Data: live OTJ sheet + Career_Progress tab via TAP GAS endpoint.
  //     Available to ALL tutors — not TAP-specific naming.
  // ══════════════════════════════════════════════════════════════════════════

  const _TAP_GAS_URL = 'https://script.google.com/macros/s/AKfycbxxdY3SnRA3mEQPUOcOH9J47uXh9hfc8w-7VlTY2ZrR3jSJJuFBJuDJcyB15Oz_32yc/exec';
  const _OJT_CSV_URL = _TAP_GAS_URL + '?tab=ojt_log';
  const _MR_CSV_URL  = _TAP_GAS_URL + '?tab=master_roster';

  function _normN(s) { return String(s||'').trim().toLowerCase().replace(/\s+/g,' '); }

  function _parseCsv(text) {
    const rows=[]; let row=[],field='',inQ=false;
    for(let i=0;i<text.length;i++){const c=text[i],n=text[i+1];if(inQ){if(c==='"'&&n==='"'){field+='"';i++;}else if(c==='"'){inQ=false;}else field+=c;}else{if(c==='"'){inQ=true;}else if(c===','){row.push(field);field='';}else if(c==='\n'){row.push(field);rows.push(row);row=[];field='';}else if(c!=='\r')field+=c;}}
    if(field||row.length){row.push(field);rows.push(row);}
    return rows;
  }
  function _csvObjs(text) {
    const rows=_parseCsv(text); if(rows.length<2) return [];
    const hdrs=rows[0].map(h=>h.trim());
    return rows.slice(1).map(row=>{const o={};hdrs.forEach((h,i)=>{o[h]=(row[i]||'').trim();});return o;});
  }

  // ── Inject tab nav between #njtcDashTop and #njtcDashContent ─────────────
  function _injectPortalTabNav() {
    if (document.getElementById('njtc-portal-tab-nav')) return;
    const dashTop     = document.getElementById('njtcDashTop');
    const dashContent = document.getElementById('njtcDashContent');
    if (!dashTop || !dashContent) return;

    // Dual Role / Site Leader staff get Team Progress as their priority
    // view (set by leader-team.js). For them, skip the My Progress sub-tab —
    // their personal My Dashboard tab is still available, just without this
    // sub-tab. Pure tutors (no leader flag) are unaffected.
    const _hideMyProgress = !!window.NJTC_IS_LEADER_ROLE;

    const nav = document.createElement('div');
    nav.id = 'njtc-portal-tab-nav';
    nav.className = 'njtc-portal-tab-nav';
    nav.innerHTML = `
      <button class="njtc-portal-tab-btn active" data-ptab="dashboard" onclick="window._ptSwitch('dashboard',this)">📊 My Dashboard</button>
      ${_hideMyProgress ? '' : '<button class="njtc-portal-tab-btn" data-ptab="progress" onclick="window._ptSwitch(\'progress\',this)">📋 My Progress</button>'}
    `;

    // Wrap existing dashContent into a pane
    const dashPane = document.createElement('div');
    dashPane.id = 'njtc-ptab-dashboard';
    dashPane.className = 'njtc-portal-tab-pane active';
    // Move all children of dashContent into the pane
    while (dashContent.firstChild) dashPane.appendChild(dashContent.firstChild);
    dashContent.appendChild(dashPane);

    // Create My Progress pane
    const progressPane = document.createElement('div');
    progressPane.id = 'njtc-ptab-progress';
    progressPane.className = 'njtc-portal-tab-pane';
    progressPane.innerHTML = `<div class="mp-empty"><div style="font-size:1.5rem;margin-bottom:.5rem">📋</div>Loading your progress data…</div>`;
    dashContent.appendChild(progressPane);

    // Insert nav between dashTop and dashContent
    dashContent.parentNode.insertBefore(nav, dashContent);
  }

  window._ptSwitch = function(tabId, btn) {
    document.querySelectorAll('.njtc-portal-tab-btn').forEach(b => b.classList.toggle('active', b.dataset.ptab === tabId));
    document.querySelectorAll('.njtc-portal-tab-pane').forEach(p => p.classList.toggle('active', p.id === 'njtc-ptab-' + tabId));
  };

  // ── Build My Progress pane ────────────────────────────────────────────────
  async function buildMyProgressPane(user) {
    const pane = document.getElementById('njtc-ptab-progress');
    if (!pane) return;

    pane.innerHTML = `<div class="mp-empty"><div class="njtc-skeleton" style="width:60px;height:60px;border-radius:50%;margin:0 auto 1rem"></div>Loading your on-the-job details…</div>`;

    const myNorm = _normN(user.name);

    // Fetch OJT log + Master Roster + career + narratives in parallel
    let ojtRows = [], mrRow = null, savedCareer = {}, savedNarratives = {};
    try {
      const [ojtRes, mrRes, careerRes, narrRes] = await Promise.allSettled([
        fetch(_OJT_CSV_URL + '&_=' + Date.now(), { signal: AbortSignal.timeout(20000) }).then(r => r.text()),
        fetch(_MR_CSV_URL  + '&_=' + Date.now(), { signal: AbortSignal.timeout(20000) }).then(r => r.text()),
        fetch(_TAP_GAS_URL + '?tab=career_latest&_=' + Date.now(), { signal: AbortSignal.timeout(12000) }).then(r => r.json()),
        fetch(_TAP_GAS_URL + '?tab=narrative_latest&_=' + Date.now(), { signal: AbortSignal.timeout(12000) }).then(r => r.json()),
      ]);

      if (ojtRes.status === 'fulfilled') {
        const text = ojtRes.value.trim();
        if (!text.startsWith('<')) {
          // Parse by column INDEX matching GAS OTJ constants — header names are unreliable
          // Col: 0=Timestamp, 1=LogType, 2=ObsDate, 3=Observer, 4=ObsRole, 5=Site
          //      6=Apprentice, 7=Phase, 8=Domain, 9=Activity, 10=Status, 11=Notes
          //      12=RTI_Month, 13=RTI_Hours, 14=RTI_Types, 15=SessionDur
          const rawRows = _parseCsv(text);
          ojtRows = rawRows.slice(1).filter(r => _normN(r[6] || '') === myNorm);
        }
      }
      if (mrRes.status === 'fulfilled') {
        const text = mrRes.value.trim();
        if (!text.startsWith('<')) {
          mrRow = _csvObjs(text).find(r =>
            _normN(r['Full Name (Display)'] || r['Full Name'] || '') === myNorm
          ) || null;
        }
      }
      if (careerRes.status === 'fulfilled' && careerRes.value?.rows) {
        savedCareer = careerRes.value.rows.find(r => _normN(r.apprentice) === myNorm) || {};
      }
      if (narrRes.status === 'fulfilled' && narrRes.value?.rows) {
        // Build map: phase → narrative row (leader's entry for this tutor)
        (narrRes.value.rows || [])
          .filter(r => _normN(r.apprentice) === myNorm)
          .forEach(r => { savedNarratives[r.phase] = r; });
      }
    } catch(e) {}

    // ── OJT analytics ────────────────────────────────────────────────────────
    const actMap = {};   // 'Phase|Domain|Code' → {status, date, observer, notes, ts}
    const notesList = [];

    ojtRows.forEach(r => {
      // r is a raw array — indices match GAS OTJ column constants
      // 1=LogType, 2=ObsDate, 3=Observer, 7=Phase, 8=Domain, 9=Activity, 10=Status, 11=Notes, 0=Timestamp
      const lt = (r[1] || '').toLowerCase();
      if (lt.includes('rti')) return;

      const ph  = (r[7]  || '').trim();
      const dm  = (r[8]  || '').trim();
      const act = (r[9]  || '').trim();
      const st  = (r[10] || '').trim();
      const obs = (r[3]  || '').trim();
      const nts = (r[11] || '').trim();
      const dt  = (r[2]  || '').trim();

      if (nts) notesList.push({ observer: obs, date: dt, note: nts, phase: ph });

      if (!ph || !dm || !act || !st) return;
      const code = act.split(/\s*[—\-]\s*/)[0].trim().toUpperCase();
      const phK  = ph.toLowerCase().includes('begin') ? 'Beginning' : ph.toLowerCase().includes('mid') ? 'Middle' : 'End';
      const key  = phK + '|' + dm + '|' + code;
      const ts   = new Date(r[0] || 0).getTime();
      if (!actMap[key] || ts > actMap[key].ts) {
        actMap[key] = { status: st, date: dt, observer: obs, notes: nts, ts };
      }
    });

    const yCount  = Object.values(actMap).filter(e => e.status.charAt(0).toUpperCase() === 'Y').length;
    const naCount = Object.values(actMap).filter(e => /N\/A/i.test(e.status)).length;
    const possible = 80 - naCount;
    const ojtPct   = possible > 0 ? Math.round(yCount / possible * 100) : 0;
    const ojtHours = mrRow ? parseFloat(mrRow['OJT Hours (Total)'] || mrRow['OJT Hours'] || 0) || yCount * 50 : yCount * 50;
    const rtiHours = mrRow ? parseFloat(mrRow['RTI Hours (Total)'] || mrRow['RTI Hours'] || mrRow['LMS Hours'] || 0) || 0 : 0;

    const PHASE_TOTALS = { Beginning: 33, Middle: 38, End: 9 };
    const phaseStats = {};
    ['Beginning','Middle','End'].forEach(ph => {
      const phY  = Object.entries(actMap).filter(([k,v]) => k.startsWith(ph+'|') && v.status.charAt(0).toUpperCase() === 'Y').length;
      const phNA = Object.entries(actMap).filter(([k,v]) => k.startsWith(ph+'|') && /N\/A/i.test(v.status)).length;
      const phPoss = PHASE_TOTALS[ph] - phNA;
      phaseStats[ph] = { y: phY, possible: phPoss, pct: phPoss > 0 ? Math.round(phY / phPoss * 100) : 0 };
    });

    const ojtColor   = ojtPct >= 100 ? '#34d399' : ojtPct >= 60 ? '#FFB81C' : '#f87171';
    const hoursColor = ojtHours >= 3000 ? '#34d399' : ojtHours >= 1500 ? '#FFB81C' : '#94a3b8';
    const phColor    = p => phaseStats[p].pct >= 100 ? '#34d399' : phaseStats[p].pct >= 60 ? '#FFB81C' : '#1C7C8C';

    const DOMAINS = ['Professionalism','Instruction','Environment','Planning'];

    // ── Build activity detail HTML ────────────────────────────────────────────
    let actDetailHtml = '';
    ['Beginning','Middle','End'].forEach(ph => {
      const phActs = Object.entries(actMap).filter(([k]) => k.startsWith(ph + '|'));
      if (!phActs.length) return;

      actDetailHtml += `<div class="njtc-dash-section" style="margin-bottom:1rem">
        <span class="njtc-section-title">${ph} of Program</span>`;

      DOMAINS.forEach(dm => {
        const dmActs = phActs.filter(([k]) => k.split('|')[1] === dm);
        if (!dmActs.length) return;
        actDetailHtml += `<div class="mp-activity-list" style="margin-bottom:.75rem">
          <div class="mp-domain-hdr">${esc(dm)}</div>`;
        dmActs.sort((a,b) => a[0].split('|')[2].localeCompare(b[0].split('|')[2])).forEach(([key, v]) => {
          const code  = key.split('|')[2];
          const isY   = v.status.charAt(0).toUpperCase() === 'Y';
          const isNA  = /N\/A/i.test(v.status);
          actDetailHtml += `<div class="mp-act${isY?' done':isNA?' na':''}">
            <div class="mp-act-badge ${isY?'done':isNA?'na':'open'}">${isY?'✓':isNA?'—':esc(code)}</div>
            <div>
              <div style="font-weight:${isY?700:400};color:${isY?'#e2e8f0':'rgba(255,255,255,.5)'}">
                ${esc(ph + ' · ' + dm + ' · ' + code)}
              </div>
              ${isY ? `<div class="mp-act-meta">${v.date ? esc(v.date) + ' · ' : ''}${v.observer ? 'Observed by ' + esc(v.observer) : 'Observed'}</div>` : ''}
              ${isNA ? `<div class="mp-act-meta">N/A — not applicable at this site</div>` : ''}
            </div>
          </div>`;
        });
        actDetailHtml += '</div>';
      });
      actDetailHtml += '</div>';
    });

    if (!Object.keys(actMap).length) {
      actDetailHtml = `<div class="mp-empty">No OJT activities have been logged yet. Your site leader records activities as you complete them during observations.</div>`;
    }

    // ── Notes from site leader ────────────────────────────────────────────────
    const uniqueNotes = notesList.filter((n,i,a) => n.note && a.findIndex(x => x.note === n.note) === i).slice(0, 10);
    const notesHtml = uniqueNotes.length
      ? uniqueNotes.map(n => `<div class="mp-notes-block">
          <div class="mp-notes-meta">${n.observer ? esc(n.observer) + ' · ' : ''}${n.date ? esc(n.date) + ' · ' : ''}${n.phase ? esc(n.phase) : ''}</div>
          <div class="mp-notes-text">${esc(n.note)}</div>
        </div>`).join('')
      : `<div class="mp-empty" style="padding:1rem 0">No observation notes have been logged yet.</div>`;

    // ── Tutor Reflection section (one card per phase with saved leader narratives) ──
    const NARR_PHASES = ['Beginning', 'Middle', 'End'];
    const reflectionHtml = (() => {
      const hasAny = NARR_PHASES.some(ph => savedNarratives[ph]);
      if (!hasAny) return `<div class="mp-no-narr">No observation narratives have been submitted by your site leader yet. This section will populate once your leader completes an observation.</div>`;

      return NARR_PHASES.filter(ph => savedNarratives[ph]).map(ph => {
        const n = savedNarratives[ph];
        const hasSavedRefl = !!(n.reflection && n.reflection.trim());
        const fields = [
          { label: 'Professionalism', val: n.prof },
          { label: 'Environment',     val: n.env  },
          { label: 'Planning',        val: n.plan },
          { label: 'Instruction',     val: n.instr },
        ].filter(f => f.val && f.val.trim());

        const fieldHtml = fields.length
          ? `<div class="mp-narr-leader-grid">${fields.map(f =>
              `<div class="mp-narr-field-box">
                <div class="mp-narr-field-label">${esc(f.label)}</div>
                <div class="mp-narr-field-text">${esc(f.val)}</div>
              </div>`
            ).join('')}</div>`
          : `<div style="font-size:.8rem;color:rgba(255,255,255,.35);font-style:italic">No narrative text recorded yet.</div>`;

        return `<div class="mp-reflection-card">
          <div class="mp-reflection-phase">
            <span class="mp-refl-badge">${esc(ph)}</span>
            ${n.observer ? `<span style="color:rgba(255,255,255,.45);font-weight:400;text-transform:none;letter-spacing:0;font-size:.7rem">by ${esc(n.observer)}</span>` : ''}
            ${n.obsDate ? `<span style="color:rgba(255,255,255,.3);font-weight:400;text-transform:none;letter-spacing:0;font-size:.7rem">· ${esc(n.obsDate)}</span>` : ''}
            ${hasSavedRefl ? `<span class="mp-refl-badge mp-refl-saved">✓ Reflection saved</span>` : ''}
          </div>

          ${n.assessment ? `<div class="mp-narr-assessment">Overall: ${esc(n.assessment)}</div>` : ''}

          <div class="mp-narr-leader-block">
            <div class="mp-narr-leader-label">📋 Leader Observation Notes</div>
            ${fieldHtml}
          </div>

          <hr class="mp-refl-divider">

          <div class="mp-narr-leader-label" style="margin-bottom:.5rem">✍️ Your Reflection</div>
          <div style="font-size:.78rem;color:rgba(255,255,255,.4);margin-bottom:.625rem;line-height:1.5">
            Review what your site leader observed above, then write your reflection. What did you notice? What will you work on?
          </div>
          <textarea class="mp-refl-textarea" id="mp-refl-${ph.toLowerCase()}"
            placeholder="Add your reflection on this observation period…">${esc(hasSavedRefl ? n.reflection : '')}</textarea>
          <div style="display:flex;align-items:center;flex-wrap:wrap;gap:.5rem;margin-top:.25rem">
            <button class="mp-refl-save-btn" id="mp-refl-btn-${ph.toLowerCase()}"
              onclick="window._mpSaveReflection('${esc(user.name)}','${esc(ph)}')">
              💾 Save ${esc(ph)} Reflection
            </button>
            <span class="mp-refl-status" id="mp-refl-status-${ph.toLowerCase()}"></span>
          </div>
        </div>`;
      }).join('');
    })();

    // ── Career Progression form ───────────────────────────────────────────────
    const sv  = f => esc(savedCareer[f] || '');
    const savedTs = savedCareer.ts ? new Date(savedCareer.ts).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}) : null;

    function radioGroup(field, options, savedVal) {
      return `<div class="cp-radio-group" id="cp-rg-${field}">
        ${options.map(o => `<button type="button" class="cp-radio-btn${savedVal===o?' selected':''}" data-field="${field}" data-value="${esc(o)}" onclick="window._cpRadio(this)">${esc(o)}</button>`).join('')}
      </div><input type="hidden" id="cp-${field}" value="${esc(savedVal||'')}">`;
    }

    let savedCourses = [];
    try {
      if (savedCareer.coursesCompleted) {
        savedCourses = savedCareer.coursesCompleted.split('|').map(c => { const p=c.split('::'); return {title:p[0]||'',credits:p[1]||''}; }).filter(c=>c.title);
      }
    } catch(e) {}
    if (!savedCourses.length) savedCourses = [{title:'',credits:''}];

    const courseRowsHtml = savedCourses.map((c,i) =>
      `<div class="cp-course-row" id="cp-course-row-${i}">
        <input type="text" class="cp-course-title" placeholder="Course title" value="${esc(c.title)}">
        <input type="text" class="cp-course-credits" placeholder="Credits" value="${esc(c.credits)}">
        <button type="button" class="cp-remove-btn" onclick="window._cpRemoveCourse(${i})">✕</button>
      </div>`
    ).join('');

    function chkBox(key, label, saved) {
      const checked = saved === 'Yes' ? 'checked' : '';
      return `<label style="display:flex;align-items:center;gap:.5rem;cursor:pointer;font-size:.82rem;color:rgba(255,255,255,.65);margin-bottom:.375rem">
        <input type="checkbox" id="cp-${key}" ${checked} style="accent-color:#1C7C8C;width:15px;height:15px;flex-shrink:0">&nbsp;${esc(label)}
      </label>`;
    }

    // ── Assemble full My Progress pane ────────────────────────────────────────
    pane.innerHTML = `

      <!-- ── STATS ── -->
      <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:.75rem;margin-bottom:1.25rem">
        <div style="font-size:.7rem;color:rgba(255,255,255,.35)">Live data from your TAP record · updates after each observation</div>
        <button onclick="window._mpExportWorkbook('${esc(user.name)}')" style="background:rgba(28,124,140,0.15);border:1.5px solid #1C7C8C;color:#34d399;border-radius:8px;padding:.45rem 1rem;font-size:.8rem;font-weight:700;cursor:pointer;font-family:inherit;transition:.15s" onmouseover="this.style.background='rgba(28,124,140,0.3)'" onmouseout="this.style.background='rgba(28,124,140,0.15)'">
          ⬇️ Download My OJT Workbook
        </button>
      </div>
      <div id="mp-export-status" style="font-size:.78rem;text-align:right;min-height:1.25rem;margin-bottom:.5rem"></div>

      <div class="mp-stat-row">
        <div class="mp-stat">
          <div class="mp-stat-val" style="color:${hoursColor}">${ojtHours.toLocaleString()}</div>
          <div class="mp-stat-lbl">OJT Hours</div>
          <div class="mp-stat-sub">of 4,000 required</div>
          <div class="mp-progress-bar"><div class="mp-progress-fill" style="width:${Math.min(100,Math.round(ojtHours/40))}%;background:${hoursColor}"></div></div>
        </div>
        <div class="mp-stat">
          <div class="mp-stat-val" style="color:${rtiHours>=288?'#34d399':rtiHours>=100?'#FFB81C':'#94a3b8'}">${rtiHours}</div>
          <div class="mp-stat-lbl">LMS Hours</div>
          <div class="mp-stat-sub">of 288 required</div>
          <div class="mp-progress-bar"><div class="mp-progress-fill" style="width:${Math.min(100,Math.round(rtiHours/2.88))}%;background:#7c3aed"></div></div>
        </div>
        <div class="mp-stat">
          <div class="mp-stat-val" style="color:${ojtColor}">${yCount} <span style="font-size:1rem;font-weight:600;color:rgba(255,255,255,.35)">/ ${possible}</span></div>
          <div class="mp-stat-lbl">Activities Observed</div>
          <div class="mp-stat-sub">${ojtPct}% complete</div>
        </div>
        ${mrRow && parseFloat(mrRow['Current Wage']||0) > 0 ? `
        <div class="mp-stat">
          <div class="mp-stat-val" style="color:#34d399">$${parseFloat(mrRow['Current Wage']).toFixed(2)}</div>
          <div class="mp-stat-lbl">Current Wage</div>
          <div class="mp-stat-sub">${esc(mrRow['Milestone Label']||mrRow['Wage Milestone']||'Base')}</div>
        </div>` : ''}
      </div>

      <!-- ── PHASE RINGS ── -->
      <div class="mp-phase-row">
        ${['Beginning','Middle','End'].map(ph => `
          <div class="mp-phase" style="border-color:${phColor(ph)}33">
            <div class="mp-phase-name">${ph}</div>
            <div class="mp-phase-pct" style="color:${phColor(ph)}">${phaseStats[ph].pct}%</div>
            <div class="mp-phase-sub">${phaseStats[ph].y} of ${phaseStats[ph].possible} activities</div>
            <div class="mp-progress-bar" style="margin-top:.625rem"><div class="mp-progress-fill" style="width:${phaseStats[ph].pct}%;background:${phColor(ph)}"></div></div>
          </div>
        `).join('')}
      </div>

      <!-- ── SITE LEADER NOTES ── -->
      <div class="njtc-dash-section" style="margin-bottom:1rem">
        <span class="njtc-section-title">📝 Site Leader Observation Notes</span>
        ${notesHtml}
      </div>

      <!-- ── TUTOR REFLECTIONS ── -->
      <div class="njtc-dash-section" style="margin-bottom:1rem">
        <span class="njtc-section-title">✍️ My Reflections</span>
        <p style="font-size:.8rem;color:rgba(255,255,255,.4);margin-bottom:1.25rem;line-height:1.6">
          Your site leader's observations appear below. Read each section, then write your own reflection. Saved reflections become part of your official OJT record.
        </p>
        ${reflectionHtml}
      </div>

      <!-- ── ACTIVITY DETAIL ── -->
      <div style="margin-bottom:1rem">
        <div class="mp-section-hdr">Activity Detail — All Logged Observations</div>
        ${actDetailHtml}
      </div>

      <!-- ── CAREER PROGRESSION FORM ── -->
      <div class="njtc-dash-section">
        <span class="njtc-section-title">🎓 Career Progression &amp; Support${savedTs ? `<span class="cp-saved-badge">✓ Saved ${esc(savedTs)}</span>` : ''}</span>

        <p class="cp-intro">Complete the sections below before your first 1:1 coaching call. Your coach uses this alongside your OJT progress to support your path toward certification. Responses are saved to your TAP record — the Central Team can download your complete workbook at any time.</p>

        <div class="cp-section-label">Section A — Career Goals</div>
        <div class="cp-grid-2">
          <div class="cp-field">
            <label class="cp-label">Do you want support completing your bachelor's degree?</label>
            ${radioGroup('wantsDegreeSupport', ['Yes','No'], savedCareer.wantsDegreeSupport||'')}
          </div>
          <div class="cp-field">
            <label class="cp-label">Do you want to pursue a certification in teaching?</label>
            ${radioGroup('wantsCertification', ['Yes','No'], savedCareer.wantsCertification||'')}
          </div>
        </div>
        <div class="cp-field">
          <label class="cp-label">What do you hope to gain from the Tutor Apprenticeship Experience?</label>
          <textarea class="cp-textarea" id="cp-apprenticeshipGoal" placeholder="Share your goals and aspirations…">${sv('apprenticeshipGoal')}</textarea>
        </div>

        <div class="cp-section-label">Section B — Education Background</div>
        <div class="cp-grid-2">
          <div class="cp-field">
            <label class="cp-label">Do you have your bachelor's degree?</label>
            ${radioGroup('hasBachelors', ['Yes','No','In Progress'], savedCareer.hasBachelors||'')}
          </div>
          <div class="cp-field">
            <label class="cp-label">What was your major?</label>
            <input class="cp-input" type="text" id="cp-major" placeholder="e.g. Education, Biology…" value="${sv('major')}">
          </div>
        </div>
        <div class="cp-grid-2">
          <div class="cp-field">
            <label class="cp-label">Did you ever enroll in post-secondary classes or programs?</label>
            ${radioGroup('postSecondaryEnrolled', ['Yes','No'], savedCareer.postSecondaryEnrolled||'')}
          </div>
          <div class="cp-field">
            <label class="cp-label">What was your GPA?</label>
            <input class="cp-input" type="text" id="cp-gpa" placeholder="e.g. 3.5" value="${sv('gpa')}">
          </div>
        </div>
        <div class="cp-grid-2">
          <div class="cp-field">
            <label class="cp-label">Did you complete your degree in the US or internationally?</label>
            ${radioGroup('degreeUSorIntl', ['US','Internationally','N/A'], savedCareer.degreeUSorIntl||'')}
          </div>
          <div class="cp-field">
            <label class="cp-label">Link your transcripts (Google Drive URL)</label>
            <input class="cp-input" type="url" id="cp-transcriptLink" placeholder="https://drive.google.com/…" value="${sv('transcriptLink')}">
          </div>
        </div>
        <div class="cp-field">
          <label class="cp-label">Any other details about your post-secondary education</label>
          <textarea class="cp-textarea" id="cp-educationNotes" placeholder="Optional…">${sv('educationNotes')}</textarea>
        </div>

        <div class="cp-section-label">Section C — Certification Questions</div>
        <div class="cp-grid-2">
          <div class="cp-field">
            <label class="cp-label">What age of students do you prefer to work with?</label>
            <select class="cp-select" id="cp-agePreference">
              <option value="">Select…</option>
              ${['Elementary (K–5)','Middle School (6–8)','High School (9–12)','No preference'].map(o =>
                `<option value="${esc(o)}" ${savedCareer.agePreference===o?'selected':''}>${esc(o)}</option>`
              ).join('')}
            </select>
          </div>
          <div class="cp-field">
            <label class="cp-label">Did you complete any teacher preparation coursework?</label>
            ${radioGroup('teacherPrepCoursework', ['Yes','No'], savedCareer.teacherPrepCoursework||'')}
          </div>
        </div>
        <div class="cp-grid-2">
          <div class="cp-field">
            <label class="cp-label">Teaching certificate from another state or country?</label>
            ${radioGroup('certOtherState', ['Yes','No'], savedCareer.certOtherState||'')}
          </div>
          <div class="cp-field">
            <label class="cp-label">Have you created your ETS account?</label>
            ${radioGroup('etsAccountCreated', ['Yes','No'], savedCareer.etsAccountCreated||'')}
          </div>
        </div>

        <div class="cp-section-label">Section D — Progress</div>
        <div class="cp-grid-3" style="margin-bottom:1rem">
          <div style="background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.09);border-radius:10px;padding:.875rem">
            <div style="font-size:.7rem;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:rgba(255,255,255,.4);margin-bottom:.625rem">Content Exam (Praxis)</div>
            ${chkBox('praxisScheduled','Praxis scheduled',savedCareer.praxisScheduled)}
            ${chkBox('praxisPassed','Praxis passed',savedCareer.praxisPassed)}
            ${chkBox('needRetake','Need to retake',savedCareer.needRetake)}
          </div>
          <div style="background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.09);border-radius:10px;padding:.875rem">
            <div style="font-size:.7rem;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:rgba(255,255,255,.4);margin-bottom:.625rem">Certificate of Eligibility</div>
            ${chkBox('appliedCE','Applied for CE',savedCareer.appliedCE)}
            ${chkBox('receivedCE','Received CE',savedCareer.receivedCE)}
          </div>
          <div style="background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.09);border-radius:10px;padding:.875rem">
            <div style="font-size:.7rem;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:rgba(255,255,255,.4);margin-bottom:.625rem">Alt Route Program</div>
            ${chkBox('enrolledAltRoute','Enrolled in Alt Route',savedCareer.enrolledAltRoute)}
            <select class="cp-select" id="cp-altRouteProgram" style="font-size:.8rem;padding:.4rem .65rem;margin-top:.5rem">
              <option value="">Select program…</option>
              ${['Rutgers NB','iTeach','Other','N/A'].map(o =>
                `<option value="${esc(o)}" ${savedCareer.altRouteProgram===o?'selected':''}>${esc(o)}</option>`
              ).join('')}
            </select>
          </div>
        </div>

        <div class="cp-field">
          <label class="cp-label">Completed Courses <span style="font-weight:400;color:rgba(255,255,255,.35)">— title and credits</span></label>
          <div id="cp-courses-list">${courseRowsHtml}</div>
          <button type="button" class="cp-add-btn" onclick="window._cpAddCourse()" style="margin-top:.375rem">+ Add Course</button>
        </div>

        <button class="cp-save-btn" id="cp-save-btn" onclick="window._cpSave('${esc(user.name)}')">
          💾 Save Career Progression
        </button>
        <div class="cp-status" id="cp-status"></div>
        <div class="cp-last-saved" id="cp-last-saved">${savedTs ? `✓ Previously saved on ${esc(savedTs)} — saving again will update your record.` : ''}</div>
      </div>
    `;
  }

  // ── Global helpers for Career Progression form ────────────────────────────

  window._cpRadio = function(btn) {
    const field = btn.dataset.field, val = btn.dataset.value;
    const grp   = document.getElementById('cp-rg-' + field);
    if (grp) grp.querySelectorAll('.cp-radio-btn').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
    const hidden = document.getElementById('cp-' + field);
    if (hidden) hidden.value = val;
  };

  window._cpAddCourse = function() {
    const list = document.getElementById('cp-courses-list'); if (!list) return;
    const idx  = list.querySelectorAll('.cp-course-row').length;
    const row  = document.createElement('div');
    row.className = 'cp-course-row'; row.id = 'cp-course-row-' + idx;
    row.innerHTML = `<input type="text" class="cp-course-title" placeholder="Course title"><input type="text" class="cp-course-credits" placeholder="Credits"><button type="button" class="cp-remove-btn" onclick="window._cpRemoveCourse(${idx})">✕</button>`;
    list.appendChild(row);
  };

  window._cpRemoveCourse = function(idx) {
    const row = document.getElementById('cp-course-row-' + idx); if (row) row.remove();
  };

  window._cpSave = async function(apprenticeName) {
    const btn = document.getElementById('cp-save-btn'), status = document.getElementById('cp-status'), lastSv = document.getElementById('cp-last-saved');
    if (btn) { btn.disabled = true; btn.textContent = 'Saving…'; }
    if (status) { status.textContent = ''; status.className = 'cp-status'; }
    const gv = id => { const el = document.getElementById(id); return el ? el.value.trim() : ''; };
    const gc = id => { const el = document.getElementById(id); return el ? el.checked : false; };
    const courses = [];
    document.querySelectorAll('#cp-courses-list .cp-course-row').forEach(row => {
      const t = (row.querySelector('.cp-course-title')?.value||'').trim();
      const c = (row.querySelector('.cp-course-credits')?.value||'').trim();
      if (t) courses.push(t + '::' + c);
    });
    const payload = {
      logType:               'CareerProgression',
      apprenticeName:        apprenticeName,
      wantsDegreeSupport:    gv('cp-wantsDegreeSupport'),
      wantsCertification:    gv('cp-wantsCertification'),
      apprenticeshipGoal:    gv('cp-apprenticeshipGoal'),
      hasBachelors:          gv('cp-hasBachelors'),
      major:                 gv('cp-major'),
      postSecondaryEnrolled: gv('cp-postSecondaryEnrolled'),
      gpa:                   gv('cp-gpa'),
      degreeUSorIntl:        gv('cp-degreeUSorIntl'),
      educationNotes:        gv('cp-educationNotes'),
      transcriptLink:        gv('cp-transcriptLink'),
      agePreference:         gv('cp-agePreference'),
      teacherPrepCoursework: gv('cp-teacherPrepCoursework'),
      certOtherState:        gv('cp-certOtherState'),
      etsAccountCreated:     gv('cp-etsAccountCreated'),
      praxisScheduled:       gc('cp-praxisScheduled') ? 'Yes' : 'No',
      praxisPassed:          gc('cp-praxisPassed')    ? 'Yes' : 'No',
      needRetake:            gc('cp-needRetake')       ? 'Yes' : 'No',
      appliedCE:             gc('cp-appliedCE')        ? 'Yes' : 'No',
      receivedCE:            gc('cp-receivedCE')       ? 'Yes' : 'No',
      enrolledAltRoute:      gc('cp-enrolledAltRoute') ? 'Yes' : 'No',
      altRouteProgram:       gv('cp-altRouteProgram'),
      coursesCompleted:      courses.join('|'),
      additionalNotes:       '',
    };
    try {
      // Use URLSearchParams so the body is application/x-www-form-urlencoded —
      // no-cors strips Content-Type:application/json, causing GAS JSON.parse to fail.
      // Form-encoded body is always readable by GAS via e.parameter without any header.
      const form = new URLSearchParams(payload);
      await fetch(_TAP_GAS_URL, {
        method:  'POST',
        mode:    'no-cors',
        body:    form,
      });
      if (status) { status.textContent = '✓ Saved! Your career progression has been recorded.'; status.className = 'cp-status ok'; }
      const ts = new Date().toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'});
      if (lastSv) lastSv.textContent = '✓ Last saved: ' + ts;
      if (btn) { btn.textContent = '✓ Saved'; setTimeout(()=>{ btn.textContent='💾 Save Career Progression'; btn.disabled=false; }, 3000); }
      setTimeout(()=>{ if(status) status.textContent=''; }, 6000);
    } catch(err) {
      if (status) { status.textContent = 'Save failed — please try again.'; status.className = 'cp-status err'; }
      if (btn) { btn.disabled=false; btn.textContent='💾 Save Career Progression'; }
    }
  };

  // ── Export full OJT workbook for this tutor ──────────────────────────────
  window._mpExportWorkbook = async function(apprenticeName) {
    const btn    = document.querySelector('[onclick*="_mpExportWorkbook"]');
    const status = document.getElementById('mp-export-status');
    if (btn) { btn.disabled = true; btn.textContent = '⏳ Building workbook…'; }
    if (status) { status.textContent = ''; status.style.color = 'rgba(255,255,255,.4)'; }
    try {
      const res  = await fetch(
        _TAP_GAS_URL + '?action=exportWorkbook&apprentice=' + encodeURIComponent(apprenticeName) + '&_=' + Date.now(),
        { signal: AbortSignal.timeout(60000) }
      );
      const json = await res.json();
      if (json.success && json.url) {
        window.open(json.url, '_blank');
        if (status) { status.textContent = '✓ Workbook ready — opened in new tab'; status.style.color = '#34d399'; }
      } else {
        if (status) { status.textContent = 'Export failed: ' + (json.error || 'unknown error'); status.style.color = '#f87171'; }
      }
    } catch(err) {
      if (status) { status.textContent = 'Export failed — please try again.'; status.style.color = '#f87171'; }
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = '⬇️ Download My OJT Workbook'; }
      setTimeout(() => { if (status) status.textContent = ''; }, 8000);
    }
  };

  // ── Tutor Reflection save ─────────────────────────────────────────────────
  window._mpSaveReflection = async function(apprenticeName, phase) {
    const phL   = phase.toLowerCase();
    const btn   = document.getElementById('mp-refl-btn-'    + phL);
    const stat  = document.getElementById('mp-refl-status-' + phL);
    const ta    = document.getElementById('mp-refl-'        + phL);
    const text  = ta ? ta.value.trim() : '';

    if (!text) {
      if (stat) { stat.textContent = 'Please write your reflection first.'; stat.className = 'mp-refl-status err'; }
      setTimeout(() => { if (stat) stat.textContent = ''; }, 3000);
      return;
    }
    if (btn) { btn.disabled = true; btn.textContent = 'Saving…'; }
    if (stat) { stat.textContent = ''; stat.className = 'mp-refl-status'; }

    const form = new URLSearchParams({
      logType:        'NarrativeReflection',
      apprenticeName: apprenticeName,
      phase:          phase,
      tutorReflection:text,
    });
    try {
      await fetch(_TAP_GAS_URL, { method: 'POST', mode: 'no-cors', body: form });
      if (stat) { stat.textContent = '✓ Saved'; stat.className = 'mp-refl-status ok'; }
      // Update the badge in the card to show saved
      const card = document.getElementById('mp-refl-btn-' + phL)?.closest('.mp-reflection-card');
      if (card) {
        const phaseDiv = card.querySelector('.mp-reflection-phase');
        if (phaseDiv && !phaseDiv.querySelector('.mp-refl-saved')) {
          const badge = document.createElement('span');
          badge.className = 'mp-refl-badge mp-refl-saved';
          badge.textContent = '✓ Reflection saved';
          phaseDiv.appendChild(badge);
        }
      }
      setTimeout(() => { if (stat) stat.textContent = ''; }, 5000);
    } catch(err) {
      if (stat) { stat.textContent = 'Save failed — try again.'; stat.className = 'mp-refl-status err'; }
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = `💾 Save ${phase} Reflection`; }
    }
  };

  window.NJTCMyDashboard = { build };
})();
