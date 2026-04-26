(function() {
'use strict';

// ══════════════════════════════════════════════════════════════════════════
//  PROGRAM DATA SUMMARY  —  "Program Pulse"
//  Visible to: programming, data departments
//  Reads from: po.getProgramSummaryData(), irlab.getInsightMetrics()
//  No direct API calls — all data is already in memory.
// ══════════════════════════════════════════════════════════════════════════

// ── CSS ───────────────────────────────────────────────────────────────────
(function injectStyles() {
  const css = `
  /* ── Trigger button (floating pill) ─────────────────────────── */
  #pdsPulseBtn {
    position: fixed; bottom: 1.5rem; left: 50%;
    transform: translateX(-50%);
    z-index: 440;
    display: none;
    align-items: center; gap: .55rem;
    background: linear-gradient(135deg, #1a3a5c 0%, #1d5fa8 100%);
    color: #fff;
    border: none; border-radius: 30px;
    padding: .55rem 1.35rem .55rem 1rem;
    font-size: .8125rem; font-weight: 700;
    font-family: 'DM Sans', sans-serif;
    letter-spacing: .01em;
    cursor: pointer;
    box-shadow: 0 4px 20px rgba(26,58,92,.40), 0 1px 4px rgba(0,0,0,.15);
    transition: transform .18s ease, box-shadow .18s ease;
    white-space: nowrap;
  }
  #pdsPulseBtn.visible { display: flex; }
  #pdsPulseBtn:hover {
    transform: translateX(-50%) translateY(-2px);
    box-shadow: 0 8px 28px rgba(26,58,92,.50);
  }
  #pdsPulseBtn .pds-btn-dot {
    width: 8px; height: 8px; border-radius: 50%;
    background: #4ade80;
    animation: pdsBlink 2.2s ease infinite;
    flex-shrink: 0;
  }
  @keyframes pdsBlink { 0%,100%{opacity:1} 50%{opacity:.35} }

  /* ── Full-screen overlay ─────────────────────────────────────── */
  #pdsOverlay {
    display: none; position: fixed; inset: 0;
    background: rgba(10,22,40,.55);
    backdrop-filter: blur(3px);
    z-index: 8800;
  }
  #pdsOverlay.open { display: block; }

  /* ── Sheet panel (slides up from bottom) ────────────────────── */
  #pdsSheet {
    position: fixed; left: 0; right: 0; bottom: 0;
    height: 88vh;
    background: var(--surface);
    border-radius: 20px 20px 0 0;
    box-shadow: 0 -8px 48px rgba(10,22,40,.20);
    z-index: 8801;
    display: flex; flex-direction: column;
    transform: translateY(100%);
    transition: transform .36s cubic-bezier(.32,.72,0,1);
    overflow: hidden;
  }
  #pdsSheet.open { transform: translateY(0); }

  /* ── Sheet header ─────────────────────────────────────────────── */
  .pds-header {
    display: flex; align-items: center; gap: 1rem;
    padding: 1.125rem 1.5rem 0;
    flex-shrink: 0;
  }
  .pds-header-left { flex: 1; min-width: 0; }
  .pds-eyebrow {
    font-size: .6875rem; font-weight: 700; text-transform: uppercase;
    letter-spacing: .09em; color: var(--muted); margin-bottom: .2rem;
  }
  .pds-title {
    font-family: 'DM Serif Display', serif;
    font-size: 1.3rem; color: var(--navy); line-height: 1.2;
  }
  .pds-subtitle { font-size: .8rem; color: var(--muted); margin-top: .2rem; }
  .pds-close-btn {
    background: var(--surface-2); border: 1.5px solid var(--border);
    border-radius: 10px; width: 36px; height: 36px;
    display: flex; align-items: center; justify-content: center;
    font-size: 1.1rem; cursor: pointer; color: var(--muted);
    transition: background .15s, color .15s; flex-shrink: 0;
  }
  .pds-close-btn:hover { background: var(--border); color: var(--navy); }

  /* ── Tabs ────────────────────────────────────────────────────── */
  .pds-tab-bar {
    display: flex; gap: .3rem; padding: .875rem 1.5rem .5rem;
    border-bottom: 1.5px solid var(--border); flex-shrink: 0;
    overflow-x: auto; scrollbar-width: none;
  }
  .pds-tab-bar::-webkit-scrollbar { display: none; }
  .pds-tab {
    padding: .4rem 1rem; border-radius: 20px;
    font-size: .8125rem; font-weight: 600;
    background: transparent; border: 1.5px solid transparent;
    color: var(--muted); cursor: pointer;
    font-family: 'DM Sans', sans-serif; white-space: nowrap;
    transition: background .15s, color .15s, border-color .15s;
  }
  .pds-tab:hover { background: var(--surface-2); color: var(--navy); }
  .pds-tab.active {
    background: var(--navy); color: #fff;
    border-color: var(--navy);
  }

  /* ── Scrollable body ─────────────────────────────────────────── */
  .pds-body {
    flex: 1; overflow-y: auto; padding: 1.25rem 1.5rem 2rem;
    scrollbar-width: thin; scrollbar-color: var(--border) transparent;
  }
  .pds-body::-webkit-scrollbar { width: 4px; }
  .pds-body::-webkit-scrollbar-thumb { background: var(--border); border-radius: 4px; }

  /* ── Refresh bar ─────────────────────────────────────────────── */
  .pds-sync-bar {
    display: flex; align-items: center; gap: .5rem;
    padding: .5rem 1.5rem; background: var(--surface-2);
    border-bottom: 1px solid var(--border);
    font-size: .75rem; color: var(--muted); flex-shrink: 0;
  }

  /* ── Health banner ───────────────────────────────────────────── */
  .pds-banner {
    border-radius: 12px; padding: 1rem 1.25rem;
    display: flex; align-items: flex-start; gap: .875rem;
    margin-bottom: 1.25rem;
  }
  .pds-banner.green { background: #f0fdf4; border: 1.5px solid #86efac; }
  .pds-banner.amber { background: #fffbeb; border: 1.5px solid #fcd34d; }
  .pds-banner.red   { background: #fff1f2; border: 1.5px solid #fca5a5; }
  .pds-banner-icon { font-size: 1.75rem; flex-shrink: 0; line-height: 1; }
  .pds-banner-title { font-weight: 700; font-size: .9375rem; color: var(--navy); margin-bottom: .2rem; }
  .pds-banner-body  { font-size: .8125rem; color: var(--text-2); line-height: 1.55; }

  /* ── Stat grid ───────────────────────────────────────────────── */
  .pds-stat-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
    gap: .625rem; margin-bottom: 1.25rem;
  }
  .pds-stat {
    background: var(--surface); border: 1.5px solid var(--border);
    border-radius: 10px; padding: .75rem .875rem; text-align: center;
  }
  .pds-stat-val {
    font-size: 1.6rem; font-weight: 800; line-height: 1;
    font-family: 'DM Serif Display', serif;
  }
  .pds-stat-label {
    font-size: .6875rem; color: var(--muted);
    text-transform: uppercase; letter-spacing: .05em;
    margin-top: .3rem; line-height: 1.3;
  }

  /* ── Section card ────────────────────────────────────────────── */
  .pds-card {
    background: var(--surface); border: 1.5px solid var(--border);
    border-radius: 12px; padding: 1rem 1.125rem; margin-bottom: .875rem;
  }
  .pds-card-title {
    font-weight: 700; font-size: .875rem; color: var(--navy);
    margin-bottom: .625rem;
  }
  .pds-card-body { font-size: .8125rem; color: var(--text-2); line-height: 1.6; }

  /* ── Action callout box ──────────────────────────────────────── */
  .pds-action-box {
    background: #eff6ff; border: 1.5px solid #bfdbfe;
    border-left: 4px solid #2563eb;
    border-radius: 0 10px 10px 0;
    padding: .875rem 1rem; margin-bottom: 1.25rem;
    font-size: .8125rem; line-height: 1.65;
  }
  .pds-action-label {
    font-size: .6875rem; font-weight: 700; text-transform: uppercase;
    letter-spacing: .07em; color: #1d4ed8; margin-bottom: .35rem;
  }

  /* ── Alert row ───────────────────────────────────────────────── */
  .pds-alert-row {
    display: flex; align-items: flex-start; gap: .625rem;
    padding: .625rem .75rem; border-radius: 8px;
    margin-bottom: .4rem; font-size: .8125rem;
  }
  .pds-alert-row.critical { background: #fff1f2; border: 1px solid #fca5a5; }
  .pds-alert-row.high     { background: #fff7ed; border: 1px solid #fed7aa; }
  .pds-alert-row.medium   { background: #fffbeb; border: 1px solid #fde68a; }
  .pds-alert-row.ok       { background: #f0fdf4; border: 1px solid #86efac; }
  .pds-alert-row.neutral  { background: var(--surface-2); border: 1px solid var(--border); }

  /* ── Bar row (reason breakdown) ─────────────────────────────── */
  .pds-bar-row {
    display: flex; align-items: center; gap: .5rem;
    margin-bottom: .35rem; font-size: .8rem;
  }
  .pds-bar-label { min-width: 0; flex: 1; color: var(--text-2); truncate: ellipsis; overflow: hidden; white-space: nowrap; }
  .pds-bar-track { width: 90px; height: 6px; background: var(--border-2); border-radius: 3px; flex-shrink: 0; overflow: hidden; }
  .pds-bar-fill  { height: 100%; border-radius: 3px; background: var(--blue-mid); }
  .pds-bar-count { font-weight: 700; color: var(--navy); min-width: 22px; text-align: right; flex-shrink: 0; }

  /* ── Trend bar chart ─────────────────────────────────────────── */
  .pds-trend-chart {
    display: flex; align-items: flex-end; gap: 3px;
    height: 72px; margin-bottom: .5rem;
  }
  .pds-trend-col { display: flex; flex-direction: column; align-items: center; flex: 1; position: relative; }
  .pds-trend-bar { width: 100%; border-radius: 3px 3px 0 0; min-height: 3px; cursor: default; }
  .pds-trend-lbl { font-size: .55rem; color: var(--muted); margin-top: 2px; text-align: center; white-space: nowrap; overflow: hidden; }

  /* ── Regional comparison ────────────────────────────────────── */
  .pds-region-grid { display: grid; grid-template-columns: 1fr 1fr; gap: .875rem; margin-bottom: 1.25rem; }
  .pds-region-card { background: var(--surface); border: 1.5px solid var(--border); border-radius: 12px; padding: 1rem; }
  .pds-region-label { font-size: .6875rem; font-weight: 700; text-transform: uppercase; letter-spacing: .08em; color: var(--muted); margin-bottom: .375rem; }
  .pds-region-name  { font-size: 1.125rem; font-weight: 800; color: var(--navy); margin-bottom: .625rem; }

  /* ── Comment card ────────────────────────────────────────────── */
  .pds-comment { padding: .625rem .75rem; border-radius: 8px; margin-bottom: .4rem; font-size: .8125rem; line-height: 1.5; }
  .pds-comment.concern  { background: #fff7ed; border-left: 3px solid #f59e0b; }
  .pds-comment.positive { background: #f0fdf4; border-left: 3px solid #22c55e; }
  .pds-comment-meta { font-size: .7rem; color: var(--muted); margin-top: .25rem; }

  /* ── Discrepancy flag ────────────────────────────────────────── */
  .pds-flag { background: #fff7ed; border: 1px solid #fed7aa; border-left: 3px solid #f59e0b; border-radius: 0 8px 8px 0; padding: .625rem .875rem; margin-bottom: .5rem; font-size: .8125rem; }
  .pds-flag-title { font-weight: 700; color: #92400e; margin-bottom: .2rem; }
  .pds-flag-body  { color: var(--text-2); line-height: 1.5; }

  /* ── Empty state ─────────────────────────────────────────────── */
  .pds-empty { text-align: center; padding: 3rem 1.5rem; color: var(--muted); font-size: .875rem; }
  .pds-empty-icon { font-size: 2.5rem; margin-bottom: .75rem; }

  /* ── Loading spinner ─────────────────────────────────────────── */
  .pds-loading { text-align: center; padding: 3rem; color: var(--muted); font-size: .875rem; }

  /* ── Academic section ────────────────────────────────────────── */
  .pds-acad-tier { display: flex; align-items: center; gap: .75rem; padding: .5rem 0; border-bottom: 1px solid var(--border-2); }
  .pds-acad-tier:last-child { border-bottom: none; }
  .pds-acad-tier-dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }

  @media (max-width: 640px) {
    #pdsSheet { height: 94vh; }
    .pds-region-grid { grid-template-columns: 1fr; }
    .pds-stat-grid { grid-template-columns: repeat(2, 1fr); }
    .pds-body { padding: 1rem 1rem 2rem; }
    .pds-header, .pds-tab-bar, .pds-sync-bar { padding-left: 1rem; padding-right: 1rem; }
  }
  `;
  const el = document.createElement('style');
  el.textContent = css;
  document.head.appendChild(el);
})();
