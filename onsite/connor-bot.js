/* ============================================================================
   CONNOR — NJTC Onsite Assistant  v3.0
   Floating fox chatbot for onsite staff.
   Rule-based Q&A + live Pearl & iReady data + Ask Connor knowledge base.
   ============================================================================ */

(function () {
  'use strict';

  // ── Ask Connor knowledge base sheet ────────────────────────────────────────
  var ASK_CONNOR_2PACX = '2PACX-1vSdb5JPPXur2DPKofkB_EjGw0YD3la6kMZsM_U_PFOa0RQ2WaVmpEtDONfNWjkPRbesWSvq_7dVQ_QC';
  var ASK_CONNOR_GID   = '525529251';
  var ASK_CONNOR_URL   = 'https://docs.google.com/spreadsheets/d/e/' + ASK_CONNOR_2PACX + '/pub?output=csv&gid=' + ASK_CONNOR_GID;
  var ASK_CONNOR_CACHE = 'njtc_connor_kb_v1';

  var _sheetQA   = [];
  var _sheetLoaded = false;

  // ── Fox SVG avatar ──────────────────────────────────────────────────────────
  var CONNOR_AVATAR = `<svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:100%;">
    <circle cx="24" cy="24" r="24" fill="#001a33"/>
    <polygon points="11,21 7,5 20,15" fill="#FFB81C"/>
    <polygon points="37,21 41,5 28,15" fill="#FFB81C"/>
    <polygon points="12,20 9,8 18,15" fill="#c07a00"/>
    <polygon points="36,20 39,8 30,15" fill="#c07a00"/>
    <circle cx="24" cy="24" r="14" fill="#FFB81C"/>
    <ellipse cx="24" cy="28" rx="8" ry="7" fill="#fff9ee"/>
    <path d="M19,14 Q24,11 29,14 Q26,19 24,20 Q22,19 19,14Z" fill="#c07a00" opacity="0.6"/>
    <ellipse cx="19.5" cy="22" rx="3.2" ry="3.5" fill="#001a33"/>
    <ellipse cx="28.5" cy="22" rx="3.2" ry="3.5" fill="#001a33"/>
    <ellipse cx="19.5" cy="22.5" rx="1.8" ry="2.2" fill="#1a0f00"/>
    <ellipse cx="28.5" cy="22.5" rx="1.8" ry="2.2" fill="#1a0f00"/>
    <circle cx="21" cy="21" r="1" fill="white"/>
    <circle cx="30" cy="21" r="1" fill="white"/>
    <ellipse cx="24" cy="27" rx="2.2" ry="1.6" fill="#001a33"/>
    <path d="M21.5,29 Q24,31.5 26.5,29" stroke="#c07a00" stroke-width="1.2" fill="none" stroke-linecap="round"/>
    <ellipse cx="14.5" cy="27" rx="3.5" ry="2.2" fill="#e09800" opacity="0.35"/>
    <ellipse cx="33.5" cy="27" rx="3.5" ry="2.2" fill="#e09800" opacity="0.35"/>
    <circle cx="24" cy="37" r="2.5" fill="#FFB81C" opacity="0.7"/>
    <text x="24" y="38.2" text-anchor="middle" fill="#001a33" font-size="2.8" font-family="Arial" font-weight="bold">N</text>
  </svg>`;

  // ── CSS ─────────────────────────────────────────────────────────────────────
  var CSS = `
    #connor-fab-wrap { position:fixed; bottom:1.5rem; right:1.5rem; z-index:9000; }
    #connor-fab {
      position:relative; display:flex; align-items:center; gap:0.5rem;
      background:linear-gradient(135deg,#FFB81C 0%,#e09800 100%);
      color:#001a33; border:none; border-radius:3rem;
      padding:0.6rem 1.1rem 0.6rem 0.5rem;
      font-family:'DM Sans','Epilogue',sans-serif; font-size:0.875rem;
      font-weight:800; cursor:pointer;
      box-shadow:0 4px 24px rgba(255,184,28,0.45),0 2px 8px rgba(0,0,0,0.3);
      transition:transform 0.2s ease,box-shadow 0.2s ease; letter-spacing:0.01em;
    }
    #connor-fab:hover { transform:translateY(-3px); box-shadow:0 8px 32px rgba(255,184,28,0.6),0 4px 12px rgba(0,0,0,0.3); }
    #connor-fab.open { background:linear-gradient(135deg,#003366,#001a33); color:#FFB81C; box-shadow:0 4px 24px rgba(0,26,51,0.5); }
    #connor-fab .connor-fab-avatar { width:34px; height:34px; border-radius:50%; overflow:hidden; flex-shrink:0; }
    #connor-fab .connor-fab-dot {
      width:9px; height:9px; border-radius:50%; background:#22c55e;
      position:absolute; top:3px; right:3px; border:2px solid #FFB81C;
      animation:connorPulse 2.5s ease infinite;
    }
    #connor-fab.open .connor-fab-dot { background:rgba(255,184,28,0.6); border-color:#001a33; }
    @keyframes connorPulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.5;transform:scale(0.8)} }

    #connor-chat {
      position:fixed; bottom:5.5rem; right:1.5rem;
      width:380px; max-width:calc(100vw - 2rem);
      height:560px; max-height:calc(100vh - 7rem);
      background:linear-gradient(160deg,#001a33 0%,#002244 100%);
      border-radius:1.25rem;
      box-shadow:0 12px 48px rgba(0,0,0,0.6),0 0 0 1px rgba(255,184,28,0.3);
      z-index:8999; display:flex; flex-direction:column; overflow:hidden;
      transform:scale(0.9) translateY(20px); opacity:0; pointer-events:none;
      transition:transform 0.25s cubic-bezier(.32,.72,0,1),opacity 0.25s ease;
    }
    #connor-chat.open { transform:scale(1) translateY(0); opacity:1; pointer-events:all; }

    .connor-hdr { display:flex; align-items:center; gap:0.75rem; padding:0.875rem 1rem 0.75rem; border-bottom:1px solid rgba(255,184,28,0.2); flex-shrink:0; }
    .connor-hdr-avatar { width:44px; height:44px; border-radius:50%; overflow:hidden; flex-shrink:0; border:2px solid rgba(255,184,28,0.4); }
    .connor-hdr-info { flex:1; min-width:0; }
    .connor-hdr-name { font-family:'Epilogue','DM Sans',sans-serif; font-weight:800; font-size:0.95rem; color:#FFB81C; }
    .connor-hdr-sub { font-size:0.68rem; color:rgba(255,255,255,0.42); margin-top:0.1rem; }
    .connor-hdr-status { display:inline-flex; align-items:center; gap:0.28rem; font-size:0.64rem; color:#22c55e; font-weight:600; }
    .connor-hdr-status::before { content:''; display:inline-block; width:6px; height:6px; border-radius:50%; background:#22c55e; }
    .connor-kb-badge { font-size:0.58rem; background:rgba(255,184,28,0.15); border:1px solid rgba(255,184,28,0.3); border-radius:999px; padding:0.15rem 0.5rem; color:rgba(255,184,28,0.8); font-weight:600; white-space:nowrap; }
    .connor-close { background:rgba(255,255,255,0.07); border:none; border-radius:8px; width:30px; height:30px; display:flex; align-items:center; justify-content:center; cursor:pointer; color:rgba(255,255,255,0.45); font-size:0.95rem; flex-shrink:0; transition:background 0.15s,color 0.15s; }
    .connor-close:hover { background:rgba(255,255,255,0.14); color:#fff; }

    .connor-msgs { flex:1; overflow-y:auto; padding:0.875rem 1rem; display:flex; flex-direction:column; gap:0.75rem; scroll-behavior:smooth; }
    .connor-msgs::-webkit-scrollbar { width:3px; }
    .connor-msgs::-webkit-scrollbar-thumb { background:rgba(255,184,28,0.3); border-radius:99px; }

    .connor-msg { display:flex; gap:0.5rem; align-items:flex-end; }
    .connor-msg.user { flex-direction:row-reverse; }
    .connor-msg-avatar { width:28px; height:28px; border-radius:50%; overflow:hidden; flex-shrink:0; }
    .connor-msg-bubble { max-width:82%; padding:0.6rem 0.875rem; border-radius:1.1rem; font-size:0.8125rem; line-height:1.55; white-space:pre-wrap; word-break:break-word; }
    .connor-msg.bot .connor-msg-bubble { background:rgba(255,255,255,0.08); color:rgba(255,255,255,0.92); border-bottom-left-radius:0.25rem; }
    .connor-msg.user .connor-msg-bubble { background:linear-gradient(135deg,#FFB81C,#e09800); color:#001a33; font-weight:600; border-bottom-right-radius:0.25rem; }
    .connor-msg-bubble strong { color:#FFB81C; font-weight:700; }
    .connor-msg.user .connor-msg-bubble strong { color:#001a33; }

    /* Sheet Q&A card */
    .connor-sheet-card { background:rgba(255,184,28,0.09); border:1px solid rgba(255,184,28,0.25); border-radius:0.75rem; padding:0.65rem 0.8rem; margin-top:0.5rem; font-size:0.78rem; }
    .connor-sheet-card .sc-cat { font-size:0.6rem; text-transform:uppercase; letter-spacing:0.08em; color:#FFB81C; font-weight:700; margin-bottom:0.3rem; }
    .connor-sheet-card .sc-q { font-weight:700; color:rgba(255,255,255,0.9); margin-bottom:0.4rem; font-size:0.8rem; }
    .connor-sheet-card .sc-a { color:rgba(255,255,255,0.82); line-height:1.55; }
    .connor-sheet-card .sc-steps { margin-top:0.45rem; padding-top:0.45rem; border-top:1px solid rgba(255,184,28,0.2); color:rgba(255,255,255,0.7); }
    .connor-sheet-card .sc-steps-label { font-size:0.6rem; text-transform:uppercase; letter-spacing:0.06em; color:#FFB81C; font-weight:700; margin-bottom:0.2rem; }

    /* Data mini-table */
    .connor-data-row { display:flex; justify-content:space-between; align-items:center; padding:0.3rem 0; border-bottom:1px solid rgba(255,255,255,0.06); font-size:0.78rem; }
    .connor-data-row:last-child { border-bottom:none; }
    .connor-data-row .dr-name { color:rgba(255,255,255,0.82); flex:1; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    .connor-data-row .dr-val { font-weight:700; margin-left:0.5rem; flex-shrink:0; }
    .connor-data-table { background:rgba(255,255,255,0.05); border-radius:0.65rem; padding:0.5rem 0.65rem; margin-top:0.5rem; }

    /* Scholar profile card */
    .connor-scholar-card { background:rgba(255,184,28,0.09); border:1px solid rgba(255,184,28,0.25); border-radius:0.75rem; padding:0.7rem 0.85rem; margin-top:0.5rem; font-size:0.78rem; }
    .connor-scholar-card .sc-name { font-weight:800; font-size:0.875rem; color:#FFB81C; margin-bottom:0.35rem; }
    .connor-scholar-card .sc-meta { display:flex; flex-wrap:wrap; gap:0.3rem 0.75rem; color:rgba(255,255,255,0.65); font-size:0.72rem; margin-bottom:0.4rem; }
    .connor-scholar-card .sc-stats { display:grid; grid-template-columns:1fr 1fr; gap:0.25rem 0.5rem; }
    .connor-scholar-card .sc-stat { display:flex; flex-direction:column; }
    .connor-scholar-card .sc-stat-lbl { font-size:0.6rem; text-transform:uppercase; letter-spacing:0.06em; color:rgba(255,255,255,0.4); }
    .connor-scholar-card .sc-stat-val { font-weight:700; font-size:0.875rem; }

    .connor-typing { display:flex; align-items:center; gap:4px; padding:0.6rem 0.875rem; background:rgba(255,255,255,0.08); border-radius:1.1rem; border-bottom-left-radius:0.25rem; max-width:60px; }
    .connor-typing span { width:6px; height:6px; border-radius:50%; background:rgba(255,184,28,0.7); animation:connorDot 1.2s ease infinite; }
    .connor-typing span:nth-child(2) { animation-delay:0.2s; }
    .connor-typing span:nth-child(3) { animation-delay:0.4s; }
    @keyframes connorDot { 0%,60%,100%{transform:translateY(0);opacity:0.5} 30%{transform:translateY(-5px);opacity:1} }

    .connor-chips { padding:0 1rem 0.5rem; display:flex; flex-wrap:wrap; gap:0.35rem; flex-shrink:0; }
    .connor-chip { background:rgba(255,184,28,0.11); border:1px solid rgba(255,184,28,0.28); border-radius:999px; padding:0.28rem 0.72rem; font-size:0.71rem; color:rgba(255,255,255,0.78); cursor:pointer; font-family:'DM Sans',sans-serif; white-space:nowrap; transition:background 0.15s,color 0.15s; }
    .connor-chip:hover { background:rgba(255,184,28,0.24); color:#fff; }

    .connor-input-row { display:flex; gap:0.5rem; padding:0.7rem 1rem 0.9rem; border-top:1px solid rgba(255,255,255,0.07); flex-shrink:0; }
    .connor-input { flex:1; background:rgba(255,255,255,0.08); border:1px solid rgba(255,255,255,0.11); border-radius:0.75rem; padding:0.55rem 0.875rem; color:#fff; font-size:0.8125rem; font-family:'DM Sans',sans-serif; outline:none; resize:none; min-height:38px; max-height:80px; transition:border-color 0.15s; }
    .connor-input::placeholder { color:rgba(255,255,255,0.28); }
    .connor-input:focus { border-color:rgba(255,184,28,0.5); }
    .connor-send { background:linear-gradient(135deg,#FFB81C,#e09800); border:none; border-radius:0.75rem; width:38px; height:38px; display:flex; align-items:center; justify-content:center; cursor:pointer; color:#001a33; font-size:1rem; flex-shrink:0; transition:transform 0.15s,opacity 0.15s; }
    .connor-send:hover { transform:scale(1.08); }
    .connor-send:disabled { opacity:0.35; cursor:default; transform:none; }

    #connor-def-overlay { position:fixed; inset:0; background:rgba(0,0,0,0.6); backdrop-filter:blur(4px); z-index:9100; display:flex; align-items:flex-end; justify-content:center; opacity:0; pointer-events:none; transition:opacity 0.2s; }
    #connor-def-overlay.open { opacity:1; pointer-events:all; }
    .connor-def-sheet { background:linear-gradient(160deg,#001a33,#002244); border-radius:1.25rem 1.25rem 0 0; width:100%; max-width:480px; max-height:85vh; overflow-y:auto; padding:1.5rem 1.5rem 2rem; border-top:3px solid rgba(255,184,28,0.4); transform:translateY(100%); transition:transform 0.3s cubic-bezier(.32,.72,0,1); }
    #connor-def-overlay.open .connor-def-sheet { transform:translateY(0); }
    .connor-def-close { float:right; background:rgba(255,255,255,0.08); border:none; border-radius:8px; padding:0.35rem 0.65rem; color:rgba(255,255,255,0.6); cursor:pointer; font-size:0.875rem; }

    .njtc-def-trigger { display:inline-flex; align-items:center; justify-content:center; width:16px; height:16px; border-radius:50%; background:rgba(255,184,28,0.18); border:1px solid rgba(255,184,28,0.38); color:#FFB81C; font-size:0.6rem; font-weight:700; cursor:pointer; margin-left:0.25rem; vertical-align:middle; transition:background 0.15s; font-family:sans-serif; line-height:1; flex-shrink:0; }
    .njtc-def-trigger:hover { background:rgba(255,184,28,0.35); }
  `;

  // ── Definitions library ─────────────────────────────────────────────────────
  var DEFINITIONS = {
    'attendance_rate': { term:'Attendance Rate', category:'Attendance', short:'The % of sessions you (or your scholars) actually showed up to.', full:'Calculated as: Attended ÷ (Attended + Absent). **Service interruptions (holidays, school closures, testing days) are NOT counted against you or your scholars.** Goal is 90% or higher.' },
    'service_interruption': { term:'Service Interruption (SI)', category:'Attendance', short:'A missed session that was NOT the tutor\'s or scholar\'s fault.', full:'Examples: school closures, holidays, NJTC diagnostic testing, school events, drills. These are excluded from attendance rate calculations. You\'ll see them tracked separately on your dashboard.' },
    'not_recorded': { term:'Not Recorded', category:'Pearl', short:'A session where attendance was never entered in Pearl.', full:'When a session shows "Not recorded," no one logged attendance for that day. This is an action item — go into Pearl and mark attendance as soon as possible. Sessions that stay unrecorded affect program data quality.' },
    'unique_scholars': { term:'Unique Scholars', category:'Pearl', short:'The number of individual students you\'ve worked with this year.', full:'This counts each student only once, regardless of how many sessions they attended. It comes from Pearl operations data for the current school year only — not historical iReady data.' },
    'survey_rate': { term:'Survey Completion Rate', category:'Surveys', short:'The % of your sessions where you submitted an instructor survey.', full:'Calculated as: Surveys submitted ÷ Sessions attended. The goal is 100% — every session you attend should have a survey. Surveys help leadership understand how your sessions are going.' },
    'placement_level': { term:'iReady Placement Level', category:'iReady', short:'Where a scholar\'s reading or math skills fall relative to grade level.', full:'Levels (lowest → highest):\n• 3+ Grade Levels Below\n• 2 Grade Levels Below\n• 1 Grade Level Below\n• Early On Grade Level\n• Mid or Above Grade Level\n\nThese come from iReady diagnostic tests — not day-to-day work.' },
    'moved_up': { term:'Moved Up (iReady)', category:'iReady', short:'A scholar who improved at least one full placement level.', full:'"Moved Up" means a scholar went from one placement level to a higher one between BOY and EOY diagnostic. This is one of the clearest measures of tutor impact.' },
    'grade_level': { term:'Grade Level (iReady)', category:'iReady', short:'Performing where a student at their grade is expected to perform.', full:'"Reached Grade Level" means a scholar tested at "Early On Grade Level" or above on their most recent iReady diagnostic. The benchmark NJTC tracks as a key impact metric.' },
    'boy': { term:'BOY (Beginning of Year)', category:'iReady', short:'The first iReady diagnostic test of the school year.', full:'BOY = Beginning of Year. The baseline diagnostic that establishes where scholars start. It\'s compared to the EOY diagnostic to measure growth.' },
    'eoy': { term:'EOY (End of Year)', category:'iReady', short:'The final iReady diagnostic test of the school year.', full:'EOY = End of Year. The final diagnostic that shows scholar progress over the full year. Comparing BOY → EOY tells us how much each scholar grew.' },
    'moy': { term:'MOY (Middle of Year)', category:'iReady', short:'The mid-year iReady check-in diagnostic.', full:'MOY = Middle of Year. This diagnostic in January/February gives a midpoint snapshot. NJTC is working on integrating MOY data — it will appear in the iReady section when available.' },
    'pearl': { term:'Pearl', category:'Pearl', short:'NJTC\'s attendance and operations tracking platform.', full:'Pearl is where all tutoring session attendance, survey submissions, and scholar records live. You use it to mark attendance after each session, submit surveys, and track your scholars. Your dashboard pulls live data directly from Pearl.' },
    'pearl_id': { term:'Pearl ID', category:'Pearl', short:'Your unique identifier in the Pearl system.', full:'Your Pearl ID is the numeric ID assigned to you in Pearl. It\'s used to pull your specific attendance records, surveys, and scholar data on your dashboard.' },
    'session': { term:'Session', category:'Pearl', short:'One tutoring meeting with your scholars.', full:'A session is one scheduled tutoring block. Each session gets its own entry in Pearl where you mark attendance and submit your instructor survey. Sessions are grouped by week on your dashboard.' },
    'typical_growth': { term:'Typical Growth (iReady)', category:'iReady', short:'The expected growth for a student with NO extra tutoring support.', full:'"Growth vs Typical" shows how much a scholar grew compared to what iReady expects for an average student receiving only regular classroom instruction. 100% = met typical. Over 100% = you made the difference.' },
    'shared_scholar': { term:'Shared Scholar', category:'iReady', short:'A scholar who was tutored by more than one NJTC tutor.', full:'A "shared" scholar appears in the iReady data under multiple tutors (column B of the longitudinal sheet). This happens when a scholar switches tutors mid-year or is co-instructed. Their placement data reflects all instruction combined.' },
    'consecutive_concern': { term:'Consecutive Absence Concern', category:'Scholars', short:'A scholar who has missed many sessions in a row.', full:'Pearl automatically flags scholars who miss a significant number of consecutive sessions. On your scholar grid, these show an ⚠ badge. Action: check in with that student and their family, and notify your site leader.' },
    'instructor_survey': { term:'Instructor Survey', category:'Surveys', short:'The survey YOU submit after each tutoring session.', full:'After each session, you complete an instructor survey in Pearl rating scholar engagement, enjoyment, and learning. This data goes directly to your program manager. Your survey rate (%) shows how consistently you\'re submitting these.' },
    'student_survey': { term:'Student / Scholar Survey', category:'Surveys', short:'The survey your SCHOLARS submit about their session.', full:'Students fill out a short survey rating their confidence, enjoyment, and learning after each session. These scores appear in your scholar mini-profiles. Comments with ⚠ "Needs Support" suggest a scholar may need extra attention.' },
    'site_leader': { term:'Site Leader / Dual Role', category:'Program', short:'A tutor who also takes on additional site coordination responsibilities.', full:'Some NJTC staff serve in a "Dual Role" as both tutor and site leader. Site leaders help coordinate logistics, communicate with school staff, and support other tutors at their location.' },
    'lea': { term:'LEA (Local Education Agency)', category:'Program', short:'The school district or school system your site is part of.', full:'LEA stands for Local Education Agency — essentially the school district. For example, "iLearn Clifton MS" is within the Clifton LEA. Your school assignment in Pearl determines which scholars appear on your dashboard.' },
    'iready': { term:'iReady', category:'iReady', short:'The digital diagnostic platform NJTC uses to measure scholar reading and math levels.', full:'iReady is a curriculum and assessment platform by Curriculum Associates. NJTC uses it for diagnostic testing at the beginning and end of the school year. Diagnostics measure reading and math skills against grade-level standards and track growth over time.' }
  };

  // ── Data helpers ────────────────────────────────────────────────────────────

  function pd() { return window._connorPearlData || null; }
  function ir() { return window._connorIReadyData || []; }
  function cu() { return window._connorUser || null; }

  function userName() { var u = cu(); return u ? (u.name || '').split(' ')[0] : ''; }

  // Attendance rate color emoji
  function attEmoji(rate) {
    if (rate === null || rate === undefined) return '—';
    return rate >= 90 ? '🟢' : rate >= 75 ? '🟡' : '🔴';
  }

  // Format a rate with emoji
  function fmtRate(rate) {
    if (rate === null || rate === undefined) return '—';
    return attEmoji(rate) + ' ' + rate + '%';
  }

  // Fuzzy scholar lookup by name fragment
  function findScholar(query) {
    var d = pd();
    if (!d || !d.scholars || !d.scholars.length) return null;
    var norm = query.toLowerCase().replace(/[^a-z\s]/g, '').trim();
    if (!norm) return null;

    // Exact full name
    var found = d.scholars.find(function(s) { return s.name.toLowerCase() === norm; });
    if (found) return found;

    // First or last name exact
    found = d.scholars.find(function(s) {
      var parts = s.name.toLowerCase().split(/\s+/);
      return parts.some(function(p) { return p === norm; });
    });
    if (found) return found;

    // Contains
    found = d.scholars.find(function(s) { return s.name.toLowerCase().includes(norm); });
    if (found) return found;

    // Any word in query matches any word in name
    var words = norm.split(/\s+/).filter(function(w) { return w.length > 2; });
    found = d.scholars.find(function(s) {
      var swords = s.name.toLowerCase().split(/\s+/);
      return words.some(function(w) { return swords.some(function(sw) { return sw.startsWith(w) || w.startsWith(sw); }); });
    });
    return found || null;
  }

  // Extract a scholar name from a query like "how is Maria doing" or "tell me about John"
  function extractNameFromQuery(q) {
    var patterns = [
      /(?:how is|how's|tell me about|what about|update on|check on|look up|find|show me)\s+([a-z][a-z\s'-]{1,30}?)(?:\s+doing|\s+performing|\s*\?|$)/i,
      /([a-z][a-z\s'-]{2,30}?)'s\s+(?:attendance|data|stats|scores?|surveys?)/i,
      /^([a-z][a-z\s'-]{2,25})$/i
    ];
    for (var i = 0; i < patterns.length; i++) {
      var m = q.match(patterns[i]);
      if (m) return m[1].trim();
    }
    return null;
  }

  // iReady placement rank (mirrors my-dashboard.js plcRank)
  function irRank(plc) {
    var p = (plc || '').toLowerCase().trim();
    if (!p || p === 'n/a') return -1;
    if (p.includes('3') || p.includes('three') || p.includes('more')) return 0;
    if (p.includes('2') || p.includes('two'))    return 1;
    if (p.includes('1') || p.includes('one'))    return 2;
    if (p.includes('early'))                     return 3;
    if (p.includes('mid') || p.includes('above') || p.includes('at grade')) return 4;
    return -1;
  }

  function irLabel(plc) {
    var r = irRank(plc);
    if (r < 0) return plc || '—';
    return ['3+ Below GL','2 Below GL','1 Below GL','Early GL','At/Above GL'][r];
  }

  function irEmoji(plc) {
    var r = irRank(plc);
    if (r < 0) return '';
    return r >= 3 ? '🟢' : r === 2 ? '🟡' : '🔴';
  }

  function irMovedUp(row) {
    return irRank(row.springPLC) > irRank(row.basePLC) && irRank(row.basePLC) >= 0 && irRank(row.springPLC) >= 0;
  }

  function irAtGL(row) {
    return irRank(row.springPLC) >= 3;
  }

  // Format a scholar card HTML for use in bubble (rendered as HTML)
  function scholarCardHtml(s) {
    var attColor = s.attRate !== null ? (s.attRate >= 90 ? '#22c55e' : s.attRate >= 75 ? '#f59e0b' : '#ef4444') : '#6b7280';
    var meta = [];
    if (s.grade) meta.push('Grade ' + s.grade);
    if (s.lastSeen) meta.push('Last seen: ' + s.lastSeen);
    if (s.consecConcern) meta.push('⚠ Consecutive concern');

    var surveyHtml = '';
    if (s.surveyScores && s.surveyCount > 0) {
      var sc = s.surveyScores;
      var scoreStr = [];
      if (sc.confidence !== null) scoreStr.push('Confidence: ' + sc.confidence);
      if (sc.enjoyment  !== null) scoreStr.push('Enjoyment: '  + sc.enjoyment);
      if (sc.learning   !== null) scoreStr.push('Learning: '   + sc.learning);
      if (sc.overall    !== null) scoreStr.push('Overall: '    + sc.overall);
      if (scoreStr.length) surveyHtml = '<div style="margin-top:0.35rem;font-size:0.72rem;color:rgba(255,255,255,0.6);">Survey avg — ' + scoreStr.join(' · ') + '</div>';
    }

    return '<div class="connor-scholar-card">' +
      '<div class="sc-name">' + escHtml(s.name) + (s.consecConcern ? ' <span style="color:#f59e0b;">⚠</span>' : '') + '</div>' +
      (meta.length ? '<div class="sc-meta">' + meta.map(function(m){ return '<span>' + escHtml(m) + '</span>'; }).join('') + '</div>' : '') +
      '<div class="sc-stats">' +
        '<div class="sc-stat"><span class="sc-stat-lbl">Attendance</span><span class="sc-stat-val" style="color:' + attColor + ';">' + (s.attRate !== null ? s.attRate + '%' : '—') + '</span></div>' +
        '<div class="sc-stat"><span class="sc-stat-lbl">Sessions</span><span class="sc-stat-val">' + s.attended + ' attended</span></div>' +
        '<div class="sc-stat"><span class="sc-stat-lbl">Absences</span><span class="sc-stat-val">' + s.absent + '</span></div>' +
        '<div class="sc-stat"><span class="sc-stat-lbl">Surveys filed</span><span class="sc-stat-val">' + (s.surveyCount || 0) + '</span></div>' +
      '</div>' +
      surveyHtml +
    '</div>';
  }

  // ── Definitions helper ──────────────────────────────────────────────────────
  function connorDef(key) {
    var def = DEFINITIONS[key];
    if (!def) return null;
    return '**' + def.term + '**\n\n' + def.full;
  }

  // ── CSV parser ───────────────────────────────────────────────────────────────
  function parseCSV(text) {
    var rows = [];
    var lines = text.split(/\r?\n/);
    lines.forEach(function(line) {
      var cols = [], inQ = false, cur = '';
      for (var i = 0; i < line.length; i++) {
        var c = line[i];
        if (c === '"') { inQ = !inQ; continue; }
        if (c === ',' && !inQ) { cols.push(cur); cur = ''; continue; }
        cur += c;
      }
      cols.push(cur);
      rows.push(cols);
    });
    return rows;
  }

  // ── Fetch Ask Connor knowledge base ────────────────────────────────────────
  function fetchConnorSheet() {
    try {
      var cached = sessionStorage.getItem(ASK_CONNOR_CACHE);
      if (cached) { _sheetQA = JSON.parse(cached); _sheetLoaded = true; updateKBBadge(); return; }
    } catch(e) {}

    fetch(ASK_CONNOR_URL)
      .then(function(r) { return r.ok ? r.text() : Promise.reject(r.status); })
      .then(function(text) {
        var rows = parseCSV(text);
        var qa = [];
        for (var i = 1; i < rows.length; i++) {
          var r = rows[i];
          var cat      = (r[0] || '').trim();
          var question = (r[1] || '').trim();
          var answer   = (r[2] || '').trim();
          var more     = (r[3] || '').trim();
          var steps    = (r[4] || '').trim();
          if (question && (answer || more)) {
            qa.push({ category: cat, question: question, answer: answer + (more ? '\n\n' + more : ''), nextSteps: steps });
          }
        }
        _sheetQA = qa;
        _sheetLoaded = true;
        try { sessionStorage.setItem(ASK_CONNOR_CACHE, JSON.stringify(qa)); } catch(e) {}
        updateKBBadge();
      })
      .catch(function() { _sheetLoaded = true; });
  }

  function updateKBBadge() {
    var badge = document.getElementById('connor-kb-badge');
    if (badge && _sheetQA.length > 0) { badge.textContent = _sheetQA.length + ' resources'; badge.style.display = ''; }
  }

  // ── Sheet Q&A search ────────────────────────────────────────────────────────
  function searchSheetQA(q) {
    if (!_sheetQA.length) return null;
    var norm = q.toLowerCase().replace(/[^a-z0-9\s]/g, ' ');
    var words = norm.split(/\s+/).filter(function(w) { return w.length > 2; });
    if (!words.length) return null;
    var best = null, bestScore = 0;
    _sheetQA.forEach(function(item) {
      var hay = ((item.category + ' ' + item.question + ' ' + item.answer + ' ' + item.nextSteps) || '').toLowerCase();
      var score = 0;
      words.forEach(function(w) { if (hay.indexOf(w) !== -1) score++; });
      var qHay = item.question.toLowerCase();
      words.forEach(function(w) { if (qHay.indexOf(w) !== -1) score += 2; });
      if (score > bestScore) { bestScore = score; best = item; }
    });
    return bestScore >= 2 ? best : null;
  }

  function renderSheetResult(item) {
    return '<div class="connor-sheet-card">' +
      (item.category ? '<div class="sc-cat">' + escHtml(item.category) + '</div>' : '') +
      '<div class="sc-q">' + escHtml(item.question) + '</div>' +
      '<div class="sc-a">' + connorMarkdown(escHtml(item.answer)) + '</div>' +
      (item.nextSteps ? '<div class="sc-steps"><div class="sc-steps-label">Next Steps</div>' + connorMarkdown(escHtml(item.nextSteps)) + '</div>' : '') +
      '</div>';
  }

  // ── HTML helpers ─────────────────────────────────────────────────────────────
  function escHtml(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

  function connorMarkdown(text) {
    return text
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/_(.+?)_/g, '<em>$1</em>')
      .replace(/\n•/g, '\n<span style="color:#FFB81C">•</span>')
      .replace(/\n/g, '<br>');
  }

  function dataTable(rows) {
    return '<div class="connor-data-table">' +
      rows.map(function(r) {
        return '<div class="connor-data-row"><span class="dr-name">' + escHtml(r[0]) + '</span><span class="dr-val" style="color:' + (r[2] || '#FFB81C') + ';">' + escHtml(String(r[1])) + '</span></div>';
      }).join('') +
    '</div>';
  }

  // ── Q&A RULES ────────────────────────────────────────────────────────────────

  var RULES = [

    // ══ STAFF TENURE / CERT / ROLE TYPE (new — reads the Central Team bridge) ══
    // Answers questions about a named colleague's cycles worked, cert status,
    // or Program Track — data Connor previously had zero access to. Uses the
    // same window._njtcHrEmpsLookup that leader-team.js's Program Tenure &
    // Certification panel reads, so answers stay consistent with what's shown
    // in My Team.
    { match: /\b(cycles?|tenure|how long|certified|certification|cert status|role type|program track)\b.{0,40}\b(has|is|for)\b|\b(has|is)\b.{0,20}\b(certified|cycles?|tenure)\b/i,
      respond: function(q) {
        var lookup = window._njtcHrEmpsLookup;
        if (!lookup) return '🦊 I don\'t have staff tenure/certification data loaded yet in this session — open My Team once, then ask me again.';
        var nameFrag = extractNameFromQuery(q) || q.replace(/\b(cycles?|tenure|certified|certification|cert status|role type|program track|how long|has|is|worked|for)\b/gi, '').trim();
        if (!nameFrag || nameFrag.length < 2) return null; // no name detected — fall through to other rules
        var norm = nameFrag.toLowerCase().replace(/\(.*?\)/g, '').replace(/-/g, ' ').replace(/\s+/g, ' ').trim();
        var entry = lookup.byName && lookup.byName[norm];
        if (!entry) return null; // not found under this rule — let other rules / sheet search try
        var lines = ['Here\'s what I have on **' + nameFrag + '**:', ''];
        lines.push('📋 Cycles worked: **' + entry.cyclesWorked + '** (' + (entry.years.join(', ') || '—') + ')');
        lines.push('🎓 Certification: **' + entry.certType + '**');
        if (entry.mostRecentRole) lines.push('👤 Most recent role: ' + entry.mostRecentRole);
        return lines.join('\n');
      }
    },

    // ══ GREETINGS ══════════════════════════════════════════════════════════════
    { match: /^(hi|hey|hello|hiya|sup|yo|howdy|good morning|good afternoon|good evening)\b/i,
      respond: function() {
        var d = pd(), name = userName();
        var greet = name ? 'Hey ' + name + '! 👋' : 'Hey there! 👋';
        var extra = '';
        if (d && d.hasData) {
          var flags = [];
          var consecCount = (d.scholars || []).filter(function(s){ return s.consecConcern; }).length;
          if (consecCount > 0) flags.push('**' + consecCount + ' scholar' + (consecCount > 1 ? 's' : '') + '** with consecutive absence concerns ⚠');
          var recentNR = (d.notRecordedSessions || []).filter(function(s){ return s.recent; }).length;
          var recentMS = (d.missingSurveys || []).filter(function(s){ return s.recent; }).length;
          if (recentNR > 0) flags.push('**' + recentNR + ' session' + (recentNR > 1 ? 's' : '') + '** need attendance recorded');
          if (recentMS > 0) flags.push('**' + recentMS + ' survey' + (recentMS > 1 ? 's' : '') + '** still missing');
          var attColor = d.myAttRate >= 90 ? '🟢' : d.myAttRate >= 80 ? '🟡' : '🔴';
          extra = '\n\nYour attendance is at **' + (d.myAttRate !== null ? d.myAttRate + '%' : '—') + '** ' + attColor + ' · **' + d.uniqueScholarCount + ' scholars** this year.';
          if (flags.length) extra += '\n\n🔔 Quick heads-up:\n• ' + flags.join('\n• ');
        }
        return greet + ' I\'m **Connor**, your NJTC program fox 🦊 — here to help you understand your data, answer program questions, and dig into your scholars.' + extra;
      }
    },

    // ══ WHO AM I ═══════════════════════════════════════════════════════════════
    { match: /who are you|what are you|what can you do|help me|what do you know|capabilities/i,
      respond: function() {
        var kbNote = _sheetQA.length > 0 ? '\n• **' + _sheetQA.length + ' Ask Connor resources** — the full program knowledge base' : '';
        var irNote = ir().length > 0 ? '\n• **Your iReady data** — ' + ir().length + ' scholar diagnostic records' : '';
        return '🦊 I\'m **Connor** — your NJTC program assistant!\n\n**I can tell you about:**\n• Your live attendance, scholars, and surveys (from Pearl)\n• Individual scholar profiles — attendance, concerns, survey scores\n• Which scholars need support right now\n• Your weekly attendance trends\n• Service interruption breakdowns\n• iReady diagnostic data — who moved up, who\'s below grade level, growth vs typical\n• Definitions and program terms\n• How to use Pearl — marking attendance, submitting surveys\n• How to use this portal itself — just ask, or say _"take a tour"_' + irNote + kbNote + '\n\nJust ask naturally. Try: _"Who are my scholars with concerns?"_ or _"Which scholars moved up in iReady?"_';
      }
    },

    // ══ PORTAL TOUR (launches the visual walkthrough — see connor-tour.js) ═════
    { match: /take (a |the )?(guided |portal )?tour|show me around|walk me through( the| this)? portal|portal (walkthrough|tour)|guide me( through| around)?( the| this)? portal/i,
      respond: function() {
        if (window.NJTCConnorTour) {
          setTimeout(function() { window.NJTCConnorTour.start(); }, 900);
          return '🧭 On it — let me show you around!';
        }
        return '🧭 The guided tour isn\'t available on this page — look for the **🧭 Guide Me** button at the top.';
      }
    },

    // ══ PORTAL NAVIGATION (text overview, for anyone who'd rather read) ═══════
    { match: /how (do|can) i use (this|the) portal|what (are|is) the tabs|how does this portal work|navigate the portal|what can i do (here|on this portal)|new to (this|the) portal|orient(ing)? me|what'?s (on|in) this portal/i,
      respond: function() {
        var isLeader = !!document.getElementById('njtcTeamTab') && document.getElementById('njtcTeamTab').style.display !== 'none';
        var msg = '🧭 **Here\'s what\'s in this portal:**\n\n';
        msg += '• **My Dashboard** — your live attendance, scholars, and action items, straight from Pearl\n';
        if (isLeader) msg += '• **My Team** — your site\'s tutors, attendance, and flagged concerns in one place\n';
        msg += '• **Platforms** — quick links to Pearl, i-Ready, Knowtion, and me, each with a full guide\n';
        msg += '• **Resources** — program expectations and who to contact when something needs a real person\n\n';
        msg += 'Say **"take a tour"** for the guided walkthrough, or just ask me anything directly.';
        return msg;
      }
    },

    // ══ DASHBOARD SUMMARY ══════════════════════════════════════════════════════
    { match: /my data|my dashboard|my stats|my numbers|give me a summary|overview|catch me up/i,
      respond: function() {
        var d = pd(), u = cu();
        if (!d || !d.hasData) return 'Your Pearl data is still loading — give it a moment!';
        var name = u ? (u.name || '').split(' ')[0] : 'You';
        var msg = '📊 **' + name + '\'s Dashboard**\n\n';
        msg += attEmoji(d.myAttRate) + ' Tutor Attendance: **' + (d.myAttRate !== null ? d.myAttRate + '%' : '—') + '**\n';
        msg += attEmoji(d.scholarAttRate) + ' Scholar Attendance: **' + (d.scholarAttRate !== null ? d.scholarAttRate + '%' : '—') + '**\n';
        msg += '👥 Scholars this year: **' + d.uniqueScholarCount + '**\n';
        msg += '✅ Sessions attended: **' + d.myAttended + '**\n';
        msg += '📝 Survey rate: **' + (d.surveyRate !== null ? d.surveyRate + '%' : '—') + '**\n';
        if (d.stuSurveyAvg !== null) msg += '⭐ Scholar survey avg: **' + d.stuSurveyAvg + '/5**\n';
        if (d.tutorSchool) msg += '\n📍 Site: **' + d.tutorSchool + '**' + (d.tutorDistrict ? ' · ' + d.tutorDistrict : '');

        var flags = [];
        var consecCount = (d.scholars || []).filter(function(s){ return s.consecConcern; }).length;
        if (consecCount > 0) flags.push('⚠ ' + consecCount + ' scholar' + (consecCount > 1 ? 's' : '') + ' with consecutive concerns');
        var recentNR = (d.notRecordedSessions || []).filter(function(s){ return s.recent; }).length;
        var recentMS = (d.missingSurveys || []).filter(function(s){ return s.recent; }).length;
        if (recentNR + recentMS > 0) flags.push('📋 ' + (recentNR + recentMS) + ' action item' + (recentNR + recentMS > 1 ? 's' : '') + ' need attention');

        if (ir().length > 0) {
          var irRows = ir();
          var movedUp = irRows.filter(irMovedUp).length;
          var atGL    = irRows.filter(irAtGL).length;
          msg += '\n\n📈 **iReady** (' + irRows.length + ' diagnostic records): **' + movedUp + '** scholars moved up · **' + atGL + '** at/above grade level';
        }

        if (flags.length) msg += '\n\n' + flags.join('\n');
        return msg;
      }
    },

    // ══ MY ATTENDANCE ══════════════════════════════════════════════════════════
    { match: /my attendance|my att rate|how am i doing|am i on track|my rate/i,
      respond: function() {
        var d = pd();
        if (!d || !d.hasData) return 'Your Pearl data is still loading — give it a moment!';
        var rate = d.myAttRate;
        var status = rate >= 90 ? '🟢 Above the 90% goal — great work!' :
                     rate >= 80 ? '🟡 Close to 90% — a few more sessions and you\'ll be there.' :
                     '🔴 Below 80% — please reach out to your program manager if you\'re facing challenges.';
        var msg = '**Your attendance: ' + (rate !== null ? rate + '%' : '—') + '**\n\n' + status;
        msg += '\n\n📊 Attended: **' + d.myAttended + '** | Missed: **' + d.myAbsent + '**';
        if (d.mySI > 0) msg += ' | SIs: **' + d.mySI + '** _(not counted against you)_';
        if (d.weeklyTrend && d.weeklyTrend.length > 0) {
          var recent = d.weeklyTrend[d.weeklyTrend.length - 1];
          if (recent && recent.tutorRate !== null) msg += '\n\n📅 Most recent week (' + recent.week + '): **' + recent.tutorRate + '%**';
        }
        return msg;
      }
    },

    // ══ WEEKLY TREND ══════════════════════════════════════════════════════════
    { match: /weekly trend|this week|last week|am i improving|week by week|weekly breakdown|week\b/i,
      respond: function() {
        var d = pd();
        if (!d || !d.hasData) return 'Your Pearl data is still loading — give it a moment!';
        if (!d.weeklyTrend || !d.weeklyTrend.length) return 'No weekly trend data yet — this builds up as sessions are recorded in Pearl.';
        var rows = d.weeklyTrend.slice(-6); // last 6 weeks
        var msg = '📅 **Weekly Attendance Trend** (last ' + rows.length + ' weeks)\n\n';
        var tableRows = rows.map(function(w) {
          var tutorStr = w.tutorRate !== null ? w.tutorRate + '%' : '—';
          var scholStr = w.scholarRate !== null ? w.scholarRate + '%' : '—';
          var si = w.siCount > 0 ? ' ⚡' + w.siCount : '';
          return [w.week, 'You: ' + tutorStr + ' · Scholars: ' + scholStr + si, w.tutorRate >= 90 ? '#22c55e' : w.tutorRate >= 75 ? '#f59e0b' : '#ef4444'];
        });
        msg += dataTable(tableRows);
        // Trend direction
        if (rows.length >= 2) {
          var last  = rows[rows.length - 1].tutorRate;
          var prev  = rows[rows.length - 2].tutorRate;
          if (last !== null && prev !== null) {
            var diff = last - prev;
            if (diff > 5)       msg += '\n\n📈 Trending **up** from last week — keep it going!';
            else if (diff < -5) msg += '\n\n📉 Trending **down** from last week — try to make your next session count.';
            else                msg += '\n\n➡️ **Steady** from week to week.';
          }
        }
        return msg;
      }
    },

    // ══ MY SCHOLARS (count + overview) ════════════════════════════════════════
    { match: /my scholars|how many students|how many scholars|scholar count|who are my students|my roster/i,
      respond: function() {
        var d = pd();
        if (!d || !d.hasData) return 'Your Pearl data is still loading — give it a moment!';
        var msg = '**You\'ve worked with ' + d.uniqueScholarCount + ' unique scholars** this school year at ' + (d.tutorSchool || 'your site') + '.';
        if (d.scholarAttRate !== null) msg += '\n\n' + attEmoji(d.scholarAttRate) + ' Scholar attendance avg: **' + d.scholarAttRate + '%**';
        var consecCount = (d.scholars || []).filter(function(s){ return s.consecConcern; }).length;
        if (consecCount > 0) msg += '\n⚠ **' + consecCount + ' scholar' + (consecCount > 1 ? 's' : '') + '** ha' + (consecCount > 1 ? 've' : 's') + ' a consecutive absence concern.';
        var lowAtt = (d.scholars || []).filter(function(s){ return s.attRate !== null && s.attRate < 75; }).length;
        if (lowAtt > 0) msg += '\n🔴 **' + lowAtt + ' scholar' + (lowAtt > 1 ? 's' : '') + '** below 75% attendance.';
        msg += '\n\nAsk me: _"Who has low attendance?"_ · _"Who is flagged?"_ · _"What grades are my scholars in?"_ · _"Who needs support?"_';
        return msg;
      }
    },

    // ══ SCHOLAR NAME LOOKUP ════════════════════════════════════════════════════
    { match: /(?:how is|how's|tell me about|what about|update on|check on|look up|find scholar|show me)\s+[a-z]/i,
      respond: function(q) {
        var nameFrag = extractNameFromQuery(q);
        if (!nameFrag) return null; // fall through
        var s = findScholar(nameFrag);
        if (!s) return '🦊 I couldn\'t find a scholar matching "' + nameFrag + '" in your roster. Try a first or last name.';
        return 'Here\'s what I have on **' + s.name + '**:\n\n' + scholarCardHtml(s) +
          (Object.keys(s.missReasons || {}).length > 0 ? '\n\n**Absence reasons:** ' + Object.entries(s.missReasons).sort(function(a,b){ return b[1]-a[1]; }).map(function(e){ return e[0] + ' (' + e[1] + ')'; }).join(', ') : '');
      }
    },

    // ══ LOW ATTENDANCE SCHOLARS ════════════════════════════════════════════════
    { match: /low attendance|struggling|worst attendance|below.*(75|80|90)|red scholar|who.*missing|absent the most/i,
      respond: function() {
        var d = pd();
        if (!d || !d.hasData) return 'Your Pearl data is still loading — give it a moment!';
        var low = (d.scholars || [])
          .filter(function(s){ return s.attRate !== null && s.attRate < 90; })
          .sort(function(a,b){ return a.attRate - b.attRate; })
          .slice(0, 8);
        if (!low.length) return '🟢 All your scholars are above 90% attendance — that\'s excellent!';
        var msg = '**Scholars with attendance below 90%** (worst first):\n\n';
        msg += dataTable(low.map(function(s){
          return [s.name + (s.consecConcern ? ' ⚠' : ''), s.attRate + '%', s.attRate >= 75 ? '#f59e0b' : '#ef4444'];
        }));
        var critical = low.filter(function(s){ return s.attRate < 75; }).length;
        if (critical > 0) msg += '\n\n🔴 **' + critical + '** scholar' + (critical > 1 ? 's' : '') + ' are critically low (under 75%). These should be flagged immediately.';
        return msg;
      }
    },

    // ══ CONSECUTIVE CONCERNS ═══════════════════════════════════════════════════
    { match: /consecutive|attendance concern|flagged|who.*concern|concern.*scholar|⚠/i,
      respond: function() {
        var d = pd();
        if (!d || !d.hasData) return 'Your Pearl data is still loading — give it a moment!';
        var concerned = (d.scholars || []).filter(function(s){ return s.consecConcern; });
        if (!concerned.length) return '✅ No scholars are currently flagged with a consecutive absence concern — great!';
        var msg = '⚠ **' + concerned.length + ' scholar' + (concerned.length > 1 ? 's' : '') + ' with consecutive absence concerns:**\n\n';
        msg += dataTable(concerned.map(function(s){
          var last = s.lastSeen ? 'Last: ' + s.lastSeen : 'No recent attendance';
          return [s.name, s.attRate !== null ? s.attRate + '%' : '—', '#f59e0b'];
        }));
        msg += '\n\n**What to do:** Check in with each of these students personally. Add a note in your instructor survey\'s admin comment field. Let your site leader know.';
        return msg;
      }
    },

    // ══ TOP SCHOLARS / BEST ATTENDANCE ════════════════════════════════════════
    { match: /best attendance|top scholar|perfect attendance|100%|star scholar|doing great|who.*showing up/i,
      respond: function() {
        var d = pd();
        if (!d || !d.hasData) return 'Your Pearl data is still loading — give it a moment!';
        var top = (d.scholars || [])
          .filter(function(s){ return s.attRate !== null; })
          .sort(function(a,b){ return b.attRate - a.attRate; })
          .slice(0, 8);
        if (!top.length) return 'No scholar attendance data yet — check back once sessions are recorded.';
        var perfect = top.filter(function(s){ return s.attRate === 100; }).length;
        var msg = '🌟 **Top scholars by attendance:**\n\n';
        msg += dataTable(top.map(function(s){
          return [s.name, s.attRate + '%', s.attRate >= 90 ? '#22c55e' : '#f59e0b'];
        }));
        if (perfect > 0) msg += '\n\n🎉 **' + perfect + ' scholar' + (perfect > 1 ? 's' : '') + '** with perfect attendance — recognize them!';
        return msg;
      }
    },

    // ══ WHO NEEDS SUPPORT (combined risk signal) ═══════════════════════════════
    { match: /who needs support|at.?risk|most support|needs help|most vulnerable|highest risk|prioritize/i,
      respond: function() {
        var d = pd();
        if (!d || !d.hasData) return 'Your Pearl data is still loading — give it a moment!';

        // Score each scholar: low att=2pts, consecutive=3pts, low survey=1pt
        var scored = (d.scholars || []).map(function(s) {
          var risk = 0;
          if (s.attRate !== null && s.attRate < 75)  risk += 3;
          else if (s.attRate !== null && s.attRate < 90) risk += 1;
          if (s.consecConcern) risk += 3;
          if (s.surveyScores) {
            var ov = s.surveyScores.overall;
            if (ov !== null && ov < 3) risk += 2;
            else if (ov !== null && ov < 4) risk += 1;
          }
          return { scholar: s, risk: risk };
        }).filter(function(x){ return x.risk > 0; })
          .sort(function(a, b){ return b.risk - a.risk; })
          .slice(0, 6);

        if (!scored.length) return '✅ Your scholars look good across the board — no major risk signals right now!';

        var msg = '🎯 **Scholars who may need the most support:**\n\n';
        msg += dataTable(scored.map(function(x) {
          var s = x.scholar;
          var signals = [];
          if (s.attRate !== null && s.attRate < 75) signals.push('🔴 att ' + s.attRate + '%');
          else if (s.attRate !== null && s.attRate < 90) signals.push('🟡 att ' + s.attRate + '%');
          if (s.consecConcern) signals.push('⚠ consecutive');
          if (s.surveyScores && s.surveyScores.overall !== null && s.surveyScores.overall < 3) signals.push('📉 survey ' + s.surveyScores.overall + '/5');
          return [s.name, signals.join(' · '), '#ef4444'];
        }));
        msg += '\n\nThese scholars have the highest combination of low attendance, consecutive absences, and/or low survey scores. Prioritize personal check-ins with each of them.';
        return msg;
      }
    },

    // ══ GRADE BREAKDOWN ════════════════════════════════════════════════════════
    { match: /grade breakdown|what grades|grade level.*scholar|scholars.*grade|by grade/i,
      respond: function() {
        var d = pd();
        if (!d || !d.hasData) return 'Your Pearl data is still loading — give it a moment!';
        var grades = {};
        (d.scholars || []).forEach(function(s) {
          var g = s.grade || 'Unknown';
          grades[g] = (grades[g] || 0) + 1;
        });
        var sorted = Object.entries(grades).sort(function(a, b) {
          var na = parseInt(a[0]), nb = parseInt(b[0]);
          if (!isNaN(na) && !isNaN(nb)) return na - nb;
          return a[0].localeCompare(b[0]);
        });
        if (!sorted.length) return 'No grade data yet for your scholars.';
        var msg = '📚 **Scholars by grade:**\n\n';
        msg += dataTable(sorted.map(function(e){ return ['Grade ' + e[0], e[1] + ' scholars', '#FFB81C']; }));
        return msg;
      }
    },

    // ══ SCHOLAR COMMENTS / WHAT ARE SCHOLARS SAYING ═══════════════════════════
    { match: /what are scholars saying|scholar comments?|student comment|feedback|what.*students? say/i,
      respond: function() {
        var d = pd();
        if (!d || !d.hasData) return 'Your Pearl data is still loading — give it a moment!';
        var allComments = [];
        (d.scholars || []).forEach(function(s) {
          (s.surveyComments || []).forEach(function(c) {
            if (c.text) allComments.push({ name: s.name, text: c.text, date: c.date });
          });
        });
        if (!allComments.length) return 'No scholar survey comments on file yet for your sessions.';
        var recent = allComments.slice(-5).reverse();
        var msg = '💬 **Recent scholar comments** (from student surveys):\n\n';
        recent.forEach(function(c) {
          msg += '**' + c.name + '** ' + (c.date ? '(' + c.date + ')' : '') + ':\n_"' + c.text + '"_\n\n';
        });
        if (allComments.length > 5) msg += '_(' + (allComments.length - 5) + ' more on your dashboard)_';
        return msg;
      }
    },

    // ══ SCHOLAR SURVEY SCORES ══════════════════════════════════════════════════
    { match: /scholar survey|student rating|survey score|how do students rate|scholar score|student.*score/i,
      respond: function() {
        var d = pd();
        if (!d || !d.hasData) return 'Your Pearl data is still loading — give it a moment!';
        if (d.stuSurveyAvg === null) return 'No student survey data yet — scores appear once scholars start submitting surveys.';
        var score = d.stuSurveyAvg;
        var emoji = score >= 4 ? '🌟' : score >= 3 ? '👍' : '💛';
        var msg = emoji + ' **Scholar survey average: ' + score + '/5**\n\n';
        var sc = d.stuAvgScores;
        if (sc) {
          var rows = [];
          if (sc.confidence !== null) rows.push(['Confidence', sc.confidence + '/5', sc.confidence >= 4 ? '#22c55e' : sc.confidence >= 3 ? '#f59e0b' : '#ef4444']);
          if (sc.enjoyment  !== null) rows.push(['Enjoyment',  sc.enjoyment  + '/5', sc.enjoyment  >= 4 ? '#22c55e' : sc.enjoyment  >= 3 ? '#f59e0b' : '#ef4444']);
          if (sc.learning   !== null) rows.push(['Learning',   sc.learning   + '/5', sc.learning   >= 4 ? '#22c55e' : sc.learning   >= 3 ? '#f59e0b' : '#ef4444']);
          if (sc.overall    !== null) rows.push(['Overall',    sc.overall    + '/5', sc.overall    >= 4 ? '#22c55e' : sc.overall    >= 3 ? '#f59e0b' : '#ef4444']);
          if (rows.length) msg += dataTable(rows);
        }

        // Find lowest-scoring scholars
        var scored = (d.scholars || []).filter(function(s){ return s.surveyScores && s.surveyScores.overall !== null; })
          .sort(function(a,b){ return a.surveyScores.overall - b.surveyScores.overall; }).slice(0, 3);
        if (scored.length) {
          msg += '\n\n**Scholars with lowest survey ratings:**\n\n';
          msg += dataTable(scored.map(function(s){ return [s.name, s.surveyScores.overall + '/5', '#f59e0b']; }));
        }
        return msg;
      }
    },

    // ══ MY SURVEYS / SURVEY RATE ═══════════════════════════════════════════════
    { match: /my survey|survey rate|survey completion|did i submit|surveys? filed/i,
      respond: function() {
        var d = pd();
        if (!d || !d.hasData) return 'Your Pearl data is still loading — give it a moment!';
        var rate = d.surveyRate;
        var msg = '**Your survey completion: ' + (rate !== null ? rate + '%' : '—') + '**\n\n';
        if (rate === 100) msg += '✅ Perfect! Every attended session has a survey.';
        else if (rate >= 80) msg += '📋 Almost there — submit surveys right after each session to reach 100%.';
        else msg += '⚠ You\'re missing surveys for multiple sessions. See the Action Items section on your dashboard.';
        var recentMS = (d.missingSurveys || []).filter(function(s){ return s.recent; });
        if (recentMS.length > 0) {
          msg += '\n\n**Recent sessions missing surveys:**\n\n';
          msg += dataTable(recentMS.slice(0, 5).map(function(s){
            return [s.sessionDate || s.session || 'Session', 'Missing', '#ef4444'];
          }));
        }
        if (d.stuSurveyAvg !== null) msg += '\n\n⭐ Scholar survey avg: **' + d.stuSurveyAvg + '/5**';
        return msg;
      }
    },

    // ══ ACTION ITEMS ══════════════════════════════════════════════════════════
    { match: /action item|what do i need to do|pending|to.?do|need to record|need to submit/i,
      respond: function() {
        var d = pd();
        if (!d || !d.hasData) return 'Your Pearl data is still loading — give it a moment!';
        var items = [];
        var recentNR = (d.notRecordedSessions || []).filter(function(s){ return s.recent; });
        var recentMS = (d.missingSurveys || []).filter(function(s){ return s.recent; });
        if (recentNR.length > 0) items.push('📋 **' + recentNR.length + ' session' + (recentNR.length > 1 ? 's' : '') + '** need attendance recorded in Pearl');
        if (recentMS.length > 0) items.push('📝 **' + recentMS.length + ' session' + (recentMS.length > 1 ? 's' : '') + '** missing instructor survey');
        var consecCount = (d.scholars || []).filter(function(s){ return s.consecConcern; }).length;
        if (consecCount > 0) items.push('⚠ **' + consecCount + ' scholar' + (consecCount > 1 ? 's' : '') + '** flagged for consecutive absences — check in with them');
        if (!items.length) return '✅ **All caught up!** No urgent action items this week.';
        return '🎯 **Your action items:**\n\n• ' + items.join('\n• ') + '\n\nSee the Action Items card at the top of your dashboard for details.';
      }
    },

    // ══ ABSENCE REASONS (scholars) ════════════════════════════════════════════
    { match: /why are scholars missing|scholar.*miss reason|miss reason|absence reason|why.*absent|what reasons/i,
      respond: function() {
        var d = pd();
        if (!d || !d.hasData) return 'Your Pearl data is still loading — give it a moment!';
        var reasons = d.scholarMissedReasons || {};
        var entries = Object.entries(reasons).sort(function(a,b){ return b[1]-a[1]; });
        if (!entries.length) return 'No scholar absence reason data yet.';
        var total = entries.reduce(function(acc,e){ return acc + e[1]; }, 0);
        var msg = '📊 **Scholar absence reasons** (' + total + ' total absences):\n\n';
        msg += dataTable(entries.slice(0, 8).map(function(e){
          var pct = Math.round(e[1] / total * 100);
          return [e[0] || 'Unspecified', e[1] + ' (' + pct + '%)', '#FFB81C'];
        }));
        return msg;
      }
    },

    // ══ SERVICE INTERRUPTION BREAKDOWN ════════════════════════════════════════
    { match: /service interruption|\bsi\b.*breakdown|si breakdown|what caused.*si|si.*severity|critical si/i,
      respond: function() {
        var d = pd();
        if (!d || !d.hasData) return 'Your Pearl data is still loading — give it a moment!';
        var sib = d.siByLevel || {};
        var levels = [
          { key:'critical', label:'Critical', color:'#ef4444' },
          { key:'high',     label:'High',     color:'#f97316' },
          { key:'medium',   label:'Medium',   color:'#f59e0b' },
          { key:'low',      label:'Low',       color:'#6b7280' }
        ];
        var totalSI = d.mySI || 0;
        if (!totalSI) return 'No service interruptions recorded for your sessions yet.';
        var msg = '⚡ **Service Interruptions: ' + totalSI + ' total**\n\nBy severity:\n\n';
        var tableRows = [];
        levels.forEach(function(l) {
          var reasons = sib[l.key] || {};
          var count = Object.values(reasons).reduce(function(acc,v){ return acc+v; }, 0);
          if (count > 0) {
            var topReason = Object.entries(reasons).sort(function(a,b){ return b[1]-a[1]; })[0];
            tableRows.push([l.label + (topReason ? ': ' + topReason[0] : ''), count, l.color]);
          }
        });
        if (tableRows.length) msg += dataTable(tableRows);
        msg += '\n\nService interruptions are **not counted against your attendance rate** — they\'re tracked separately so program staff understand what disrupted sessions.';
        return msg;
      }
    },

    // ══ iREADY OVERVIEW ════════════════════════════════════════════════════════
    { match: /iready|i-ready|i ready/i,
      respond: function(q) {
        // Data queries first — check these BEFORE any definition fallbacks
        if (/who.*moved|which.*moved|moved.*up|scholar.*improve|improve.*scholar/i.test(q)) return irMovedUpAnswer();
        if (/below.*grade|grade.*level.*below|not at grade|grade.*gap|struggling.*iready|iready.*struggling/i.test(q)) return irBelowGLAnswer();
        if (/most growth|top.*growth|highest growth|exceeded.*typical|best.*iready|who.*grew/i.test(q)) return irTopGrowthAnswer();
        if (/shared.*scholar|scholar.*shared|co.?instruct|multiple tutor/i.test(q)) return irSharedAnswer();
        if (/elas?|reading/i.test(q))  return irSubjectSummary('ELA');
        if (/math/i.test(q))           return irSubjectSummary('Math');
        // Definition lookups
        if (/placement|where.*stand/i.test(q))          return connorDef('placement_level');
        if (/typical growth|100 ?%|benchmark/i.test(q)) return connorDef('typical_growth');
        if (/boy|beginning of year/i.test(q))           return connorDef('boy');
        if (/eoy|end of year/i.test(q))                 return connorDef('eoy');
        if (/moy|mid.?year/i.test(q))                   return connorDef('moy');
        if (/moved? up|level up/i.test(q))              return connorDef('moved_up');

        var rows = ir();
        if (!rows.length) return '📈 **iReady** — No diagnostic data found yet for your scholars. This appears after the end-of-year diagnostic window.\n\nI can explain iReady terms: ask me about "placement levels," "moved up," "typical growth," BOY, EOY, or MOY.';

        var up   = rows.filter(irMovedUp).length;
        var atGL = rows.filter(irAtGL).length;
        var total = rows.length;
        var elaR  = rows.filter(function(r){ return r.subject === 'ELA'; });
        var mathR = rows.filter(function(r){ return r.subject === 'Math'; });
        var pctTypicals = rows.map(function(r){ return r.pctTypical; }).filter(function(v){ return v !== null; });
        var avgGrowth = pctTypicals.length ? Math.round(pctTypicals.reduce(function(a,b){return a+b;},0)/pctTypicals.length) : null;

        var msg = '📈 **Your iReady Impact Summary** (' + total + ' diagnostic records)\n\n';
        msg += '📊 ' + Math.round(up/total*100) + '% of scholars **moved up** at least one placement level (' + up + '/' + total + ')\n';
        msg += '🎯 ' + Math.round(atGL/total*100) + '% of scholars **reached grade level** (' + atGL + '/' + total + ')\n';
        if (avgGrowth !== null) msg += '📈 Average growth vs typical: **' + avgGrowth + '%**' + (avgGrowth >= 100 ? ' 🌟' : '') + '\n';
        if (elaR.length) msg += '\n📖 ELA: ' + elaR.filter(irMovedUp).length + '/' + elaR.length + ' moved up';
        if (mathR.length) msg += '\n➕ Math: ' + mathR.filter(irMovedUp).length + '/' + mathR.length + ' moved up';

        msg += '\n\nAsk me:\n• _"Which scholars moved up in iReady?"_\n• _"Who is below grade level?"_\n• _"Who showed the most growth?"_\n• _"ELA vs Math breakdown"_';
        return msg;
      }
    },

    // ══ iREADY: MOVED UP ══════════════════════════════════════════════════════
    { match: /who.*moved up|moved up.*iready|scholars.*improve|iready.*improve|level up/i,
      respond: irMovedUpAnswer
    },

    // ══ iREADY: BELOW GRADE LEVEL ═════════════════════════════════════════════
    { match: /below grade level|not at grade|below.*iready|iready.*below|grade level gap/i,
      respond: irBelowGLAnswer
    },

    // ══ iREADY: TOP GROWTH ════════════════════════════════════════════════════
    { match: /most growth|top.*iready|highest growth|exceeded.*typical|best.*iready/i,
      respond: irTopGrowthAnswer
    },

    // ══ iREADY: ELA vs MATH ═══════════════════════════════════════════════════
    { match: /ela.*math|math.*ela|reading.*math|math.*reading|subject breakdown|ela vs|math vs/i,
      respond: function() {
        var elaMsg = irSubjectSummary('ELA');
        var mathMsg = irSubjectSummary('Math');
        if (elaMsg.includes('No diagnostic') && mathMsg.includes('No diagnostic')) return 'No iReady data yet — check back after the end-of-year diagnostic window.';
        return elaMsg + '\n\n' + mathMsg;
      }
    },

    // ══ iREADY: SHARED SCHOLARS ═══════════════════════════════════════════════
    { match: /shared scholar.*iready|iready.*shared|co.?instruct|multiple tutor/i,
      respond: irSharedAnswer
    },

    // ══ SERVICE INTERRUPTION (definition) ════════════════════════════════════
    { match: /service interruption\b.*what|what.*service interruption|\bsi\b.*mean|doesn.t count|not.*fault/i,
      respond: function() { return connorDef('service_interruption'); }
    },

    // ══ NOT RECORDED ══════════════════════════════════════════════════════════
    { match: /not recorded|unrecorded|missing attendance/i,
      respond: function() { return connorDef('not_recorded'); }
    },

    // ══ ATTENDANCE RATE DEFINITION ════════════════════════════════════════════
    { match: /what is.*(attendance rate|att rate)|how.*(calculate|compute).*attendance|90.?% goal|attendance goal/i,
      respond: function() { return connorDef('attendance_rate'); }
    },

    // ══ PLACEMENT LEVEL ═══════════════════════════════════════════════════════
    { match: /placement level|grade level below|below grade|at grade level|above grade|early on grade/i,
      respond: function() { return connorDef('placement_level'); }
    },

    // ══ CONSECUTIVE CONCERN DEFINITION ════════════════════════════════════════
    { match: /what.*consecutive|consecutive.*mean|attendance concern.*mean/i,
      respond: function() { return connorDef('consecutive_concern'); }
    },

    // ══ LEA ═══════════════════════════════════════════════════════════════════
    { match: /\blea\b|local education|my district|what is.*district/i,
      respond: function() {
        var d = pd();
        var extra = (d && d.tutorSchool) ? '\n\n📍 Your site: **' + d.tutorSchool + '**' + (d.tutorDistrict ? ' · ' + d.tutorDistrict : '') : '';
        return connorDef('lea') + extra;
      }
    },

    // ══ PEARL / LOGGING ATTENDANCE ═══════════════════════════════════════════
    { match: /pearl|mark attendance|log attendance|record attendance/i,
      respond: function(q) {
        if (/how.*(mark|log|record|enter)|where.*(mark|log|record|enter)/i.test(q)) {
          return '📋 **How to mark attendance in Pearl:**\n\n1. Log into Pearl\n2. Find your session for today\n3. Mark each student: Attended, Absent, or the appropriate missed reason\n4. Submit your instructor survey before you leave\n\nRecord attendance **the same day** — unrecorded sessions show up as action items.';
        }
        return connorDef('pearl');
      }
    },

    // ══ SURVEY SUBMISSION ═════════════════════════════════════════════════════
    { match: /how.*(submit|fill|complete).*(survey)|survey.*(how|submit|fill|complete)/i,
      respond: function() {
        return '📝 **How to submit your instructor survey:**\n\n1. Log into Pearl after your session\n2. Find your session record\n3. Click "Submit Survey"\n4. Rate scholar engagement, enjoyment, and learning\n5. Add any comments about scholars who need support\n\nDo this right after each session — it takes under 2 minutes.';
      }
    },

    // ══ GENERIC "WHAT IS X" ═══════════════════════════════════════════════════
    { match: /^(what is|what('s| is) a|define|explain|tell me about|what do(es)? .* mean)\b/i,
      respond: function(q) {
        var n = q.toLowerCase();
        if (/attendance rate|att rate/.test(n))       return connorDef('attendance_rate');
        if (/service interruption|si\b/.test(n))      return connorDef('service_interruption');
        if (/not recorded|unrecorded/.test(n))        return connorDef('not_recorded');
        if (/placement level|grade level/.test(n))    return connorDef('placement_level');
        if (/iready|i-ready|i ready/.test(n))         return connorDef('iready');
        if (/pearl\b/.test(n))                        return connorDef('pearl');
        if (/pearl id/.test(n))                       return connorDef('pearl_id');
        if (/survey rate/.test(n))                    return connorDef('survey_rate');
        if (/typical growth/.test(n))                 return connorDef('typical_growth');
        if (/\bboy\b|beginning of year/.test(n))      return connorDef('boy');
        if (/\beoy\b|end of year/.test(n))            return connorDef('eoy');
        if (/\bmoy\b|mid.?year/.test(n))              return connorDef('moy');
        if (/moved up|move up/.test(n))               return connorDef('moved_up');
        if (/grade level\b/.test(n))                  return connorDef('grade_level');
        if (/unique scholar/.test(n))                 return connorDef('unique_scholars');
        if (/consecutive|attendance concern/.test(n)) return connorDef('consecutive_concern');
        if (/shared scholar/.test(n))                 return connorDef('shared_scholar');
        if (/\bsession\b/.test(n))                    return connorDef('session');
        if (/\blea\b|local education/.test(n))        return connorDef('lea');
        if (/instructor survey/.test(n))              return connorDef('instructor_survey');
        if (/student survey|scholar survey/.test(n))  return connorDef('student_survey');
        if (/site leader|dual role/.test(n))          return connorDef('site_leader');
        return null; // fall through to sheet search
      }
    },

    // ══ GLOSSARY ══════════════════════════════════════════════════════════════
    { match: /glossary|all definitions|list.*definition|show.*terms/i,
      respond: function() {
        return '📖 **NJTC Glossary** — ask me "What is [term]?" for any of these:\n\n**Attendance:** Attendance Rate · Service Interruption · Not Recorded\n**Scholars:** Unique Scholars · Consecutive Concern · Shared Scholar\n**iReady:** Placement Level · Moved Up · Grade Level · BOY · EOY · MOY · Typical Growth\n**Pearl:** Pearl · Pearl ID · Session\n**Surveys:** Instructor Survey · Student Survey · Survey Rate\n**Program:** LEA · Site Leader / Dual Role';
      }
    },

    // ══ PROGRAM EXPECTATIONS ══════════════════════════════════════════════════
    { match: /expectation|policy|what.*expected|requirement|\bgoal\b/i,
      respond: function() {
        return '📋 **NJTC Onsite Expectations**\n\n• **Attendance:** 90%+ (yours and your scholars\')\n• **Surveys:** 100% completion — every attended session\n• **Pearl:** Record attendance same-day\n• **Scholars:** Flag concerns in survey comments; notify site leader\n• **Consecutive absences:** Reach out to student + family; notify site leader\n\nAll tracked live on your dashboard.';
      }
    },

    // ══ THANK YOU ═════════════════════════════════════════════════════════════
    { match: /thank|thanks|appreciate|helpful/i,
      respond: function() {
        return 'Happy to help! 🦊 Keep doing great work with your scholars — I\'m always here if you have questions.';
      }
    }
  ];

  // ── iReady helper functions (called by RULES above) ─────────────────────────

  function irMovedUpAnswer() {
    var rows = ir();
    if (!rows.length) return '📈 No iReady diagnostic data yet — this appears after the end-of-year diagnostic window.';
    var moved = rows.filter(irMovedUp).sort(function(a,b){
      return (irRank(b.springPLC) - irRank(b.basePLC)) - (irRank(a.springPLC) - irRank(a.basePLC));
    });
    if (!moved.length) return 'No scholars have moved up a placement level yet in the current data.';
    var msg = '📈 **' + moved.length + ' of ' + rows.length + ' scholars moved up** at least one placement level:\n\n';
    msg += dataTable(moved.slice(0, 10).map(function(r) {
      return [r.studentName + (r.shared ? ' ◇' : ''), irLabel(r.basePLC) + ' → ' + irLabel(r.springPLC) + (r.subject ? ' (' + r.subject + ')' : ''), '#22c55e'];
    }));
    if (moved.length > 10) msg += '\n_...and ' + (moved.length - 10) + ' more. See full list in the iReady section on your dashboard._';
    return msg;
  }

  function irBelowGLAnswer() {
    var rows = ir();
    if (!rows.length) return '📈 No iReady diagnostic data yet — check back after the end-of-year diagnostic window.';
    var below = rows.filter(function(r){ return irRank(r.springPLC) >= 0 && irRank(r.springPLC) < 3; })
      .sort(function(a,b){ return irRank(a.springPLC) - irRank(b.springPLC); });
    if (!below.length) return '🟢 All scholars with EOY data are at or above Early Grade Level — great impact!';
    var msg = '📊 **' + below.length + ' scholars still below grade level** at EOY:\n\n';
    msg += dataTable(below.slice(0, 10).map(function(r) {
      return [r.studentName + (r.shared ? ' ◇' : ''), irLabel(r.springPLC) + (r.subject ? ' (' + r.subject + ')' : ''), irRank(r.springPLC) === 0 ? '#ef4444' : '#f59e0b'];
    }));
    if (below.length > 10) msg += '\n_(' + (below.length - 10) + ' more on your dashboard)_';
    msg += '\n\n◇ = shared scholar (tutored by multiple NJTC instructors)';
    return msg;
  }

  function irTopGrowthAnswer() {
    var rows = ir();
    if (!rows.length) return '📈 No iReady diagnostic data yet — check back after the end-of-year diagnostic window.';
    var withGrowth = rows.filter(function(r){ return r.pctTypical !== null; })
      .sort(function(a,b){ return b.pctTypical - a.pctTypical; });
    if (!withGrowth.length) return 'No growth vs typical data available yet.';
    var exceeded = withGrowth.filter(function(r){ return r.pctTypical >= 100; }).length;
    var avg = Math.round(withGrowth.reduce(function(acc,r){ return acc + r.pctTypical; }, 0) / withGrowth.length);
    var msg = '🚀 **Growth vs Typical** — your scholars vs what\'s expected without tutoring:\n\n';
    msg += '• Average: **' + avg + '%** of typical growth\n';
    msg += '• **' + exceeded + ' of ' + withGrowth.length + '** scholars exceeded typical growth\n\n';
    msg += '**Top growers:**\n\n';
    msg += dataTable(withGrowth.slice(0, 8).map(function(r) {
      return [r.studentName + (r.subject ? ' (' + r.subject + ')' : ''), r.pctTypical + '%', r.pctTypical >= 100 ? '#22c55e' : r.pctTypical >= 50 ? '#f59e0b' : '#ef4444'];
    }));
    return msg;
  }

  function irSubjectSummary(subject) {
    var rows = ir().filter(function(r){ return r.subject === subject; });
    if (!rows.length) return 'No ' + subject + ' diagnostic data for your scholars yet.';
    var up   = rows.filter(irMovedUp).length;
    var atGL = rows.filter(irAtGL).length;
    var pcts = rows.map(function(r){ return r.pctTypical; }).filter(function(v){ return v !== null; });
    var avgG = pcts.length ? Math.round(pcts.reduce(function(a,b){return a+b;},0)/pcts.length) : null;
    var icon = subject === 'ELA' ? '📖' : '➕';
    return icon + ' **' + subject + ' (' + rows.length + ' records):**\n' +
      '• Moved up: **' + up + '** (' + Math.round(up/rows.length*100) + '%)\n' +
      '• At grade level: **' + atGL + '** (' + Math.round(atGL/rows.length*100) + '%)\n' +
      (avgG !== null ? '• Avg growth vs typical: **' + avgG + '%**' : '');
  }

  function irSharedAnswer() {
    var rows = ir();
    if (!rows.length) return '📈 No iReady data yet.';
    var shared = rows.filter(function(r){ return r.shared; });
    if (!shared.length) return 'No shared scholars in your iReady data — all scholars in this dataset were worked with exclusively by you.';
    var names = {};
    shared.forEach(function(r){ names[r.studentName] = true; });
    var uniqueNames = Object.keys(names);
    var msg = '◇ **' + uniqueNames.length + ' shared scholar' + (uniqueNames.length > 1 ? 's' : '') + '** in your iReady data:\n\n';
    msg += uniqueNames.map(function(n){ return '• ' + n; }).join('\n');
    msg += '\n\nShared scholars were tutored by more than one NJTC instructor. Their placement data reflects all instruction combined — their growth can\'t be attributed to you alone, but it\'s still your impact too.';
    return msg;
  }

  // ── Route: rules → sheet search → default ──────────────────────────────────
  function connorRoute(q) {
    var trimmed = q.trim();
    if (!trimmed) return null;

    // 1. Scholar name lookup if it looks like a name query
    if (/(?:how is|how's|tell me about|what about|check on|update on)\s+[a-z]/i.test(trimmed)) {
      var nameFrag = extractNameFromQuery(trimmed);
      if (nameFrag) {
        var s = findScholar(nameFrag);
        if (s) {
          return 'Here\'s what I have on **' + s.name + '**:\n\n' + scholarCardHtml(s);
        }
      }
    }

    // 2. Built-in rules
    for (var i = 0; i < RULES.length; i++) {
      if (RULES[i].match.test(trimmed)) {
        var ans = RULES[i].respond(trimmed);
        if (ans !== null) return ans;
      }
    }

    // 3. Sheet Q&A search
    var sheetMatch = searchSheetQA(trimmed);
    if (sheetMatch) {
      return 'From the **Ask Connor** knowledge base:\n\n' + renderSheetResult(sheetMatch);
    }

    // 4. Default
    var kbHint = _sheetQA.length > 0 ? ' I also searched the Ask Connor knowledge base but couldn\'t find a strong match.' : '';
    return '🦊 I\'m not sure about that one.' + kbHint + '\n\nTry:\n• _"Who needs support?"_ — combined risk signals\n• _"Which scholars moved up in iReady?"_\n• _"How is [scholar name] doing?"_\n• _"What are my action items?"_\n• Type **"glossary"** for all definitions';
  }

  // ── State ────────────────────────────────────────────────────────────────────
  var _open     = false;
  var _thinking = false;

  // ── Chip sets ────────────────────────────────────────────────────────────────
  var CHIP_SETS = {
    start: [
      { label: '🧭 Take a portal tour',      q: 'Take a portal tour' },
      { label: 'My dashboard summary',       q: 'Give me my dashboard summary' },
      { label: 'Who needs support?',         q: 'Who needs the most support?' },
      { label: 'Action items',               q: 'What are my action items?' },
      { label: 'iReady impact',              q: 'Tell me about my iReady data' },
    ],
    followup: [
      { label: 'Low attendance scholars',    q: 'Who has low attendance?' },
      { label: 'Consecutive concerns',       q: 'Who has a consecutive concern?' },
      { label: 'Who moved up in iReady?',    q: 'Which scholars moved up in iReady?' },
      { label: 'Absence reasons',            q: 'Why are scholars missing?' },
    ]
  };

  // ── DOM helpers ──────────────────────────────────────────────────────────────
  function $(id) { return document.getElementById(id); }

  function connorScrollBottom() {
    var msgs = $('connor-msgs');
    if (msgs) msgs.scrollTop = msgs.scrollHeight;
  }

  function connorAddMsg(role, htmlContent, isTyping) {
    var msgs = $('connor-msgs');
    if (!msgs) return;
    var wrap = document.createElement('div');
    wrap.className = 'connor-msg ' + role;
    if (isTyping) {
      wrap.id = 'connor-typing-indicator';
      wrap.innerHTML = '<div class="connor-msg-avatar">' + CONNOR_AVATAR + '</div><div class="connor-typing"><span></span><span></span><span></span></div>';
    } else if (role === 'bot') {
      wrap.innerHTML = '<div class="connor-msg-avatar">' + CONNOR_AVATAR + '</div><div class="connor-msg-bubble">' + connorMarkdown(htmlContent) + '</div>';
    } else {
      wrap.innerHTML = '<div class="connor-msg-bubble">' + escHtml(htmlContent) + '</div>';
    }
    msgs.appendChild(wrap);
    connorScrollBottom();
    return wrap;
  }

  function connorRemoveTyping() { var el = $('connor-typing-indicator'); if (el) el.remove(); }

  function connorSetChips(set) {
    var chips = $('connor-chips');
    if (!chips) return;
    chips.innerHTML = '';
    (CHIP_SETS[set] || []).forEach(function(chip) {
      var btn = document.createElement('button');
      btn.className = 'connor-chip';
      btn.textContent = chip.label;
      btn.addEventListener('click', function() { connorAsk(chip.q); });
      chips.appendChild(btn);
    });
  }

  // ── Send a message ────────────────────────────────────────────────────────────
  function connorAsk(text) {
    if (_thinking || !text.trim()) return;
    var input = $('connor-input');
    if (input) input.value = '';

    connorAddMsg('user', text);
    connorSetChips('followup');
    _thinking = true;
    var send = $('connor-send-btn');
    if (send) send.disabled = true;
    connorAddMsg('bot', '', true);

    setTimeout(function() {
      connorRemoveTyping();
      var answer = connorRoute(text) || '';

      // Check for HTML cards (scholar card, sheet card, data table) in answer
      var msgs = $('connor-msgs');
      if (msgs) {
        var wrap = document.createElement('div');
        wrap.className = 'connor-msg bot';
        var avatarDiv = document.createElement('div');
        avatarDiv.className = 'connor-msg-avatar';
        avatarDiv.innerHTML = CONNOR_AVATAR;

        var bubble = document.createElement('div');
        bubble.className = 'connor-msg-bubble';

        // Split at first HTML block boundary (scholar card, sheet card, data table)
        var htmlBlockRe = /<div class="(connor-scholar-card|connor-sheet-card|connor-data-table)/;
        var match = answer.match(htmlBlockRe);
        if (match) {
          var idx = answer.indexOf(match[0]);
          var textPart = answer.substring(0, idx);
          var htmlPart = answer.substring(idx);
          bubble.innerHTML = connorMarkdown(textPart) + htmlPart;
        } else {
          bubble.innerHTML = connorMarkdown(answer);
        }

        wrap.appendChild(avatarDiv);
        wrap.appendChild(bubble);
        msgs.appendChild(wrap);
      }

      _thinking = false;
      if (send) send.disabled = false;
      connorScrollBottom();
    }, 180 + Math.random() * 320);
  }

  // ── Toggle open/close ─────────────────────────────────────────────────────────
  function connorToggle() {
    _open = !_open;
    var chat = $('connor-chat'), fab = $('connor-fab');
    if (chat) chat.classList.toggle('open', _open);
    if (fab)  fab.classList.toggle('open', _open);

    if (_open) {
      var msgs = $('connor-msgs');
      if (msgs && msgs.children.length === 0) {
        var d = pd(), name = userName();
        var flags = [];
        if (d && d.hasData) {
          var cc = (d.scholars || []).filter(function(s){ return s.consecConcern; }).length;
          if (cc > 0) flags.push(cc + ' scholar' + (cc > 1 ? 's' : '') + ' with consecutive concerns');
          var nr = (d.notRecordedSessions || []).filter(function(s){ return s.recent; }).length;
          if (nr > 0) flags.push(nr + ' session' + (nr > 1 ? 's' : '') + ' need attendance recorded');
        }
        var greeting = name ? 'Hey ' + name + '! 🦊' : 'Hey there! 🦊';
        greeting += ' I\'m **Connor**, your NJTC program assistant.';
        if (flags.length) greeting += '\n\n🔔 Quick note: ' + flags.join(' · ') + '. Ask me about them!';
        else greeting += '\n\nAsk me about your scholars, attendance, surveys, iReady data, or any program term!';
        setTimeout(function() { connorAddMsg('bot', greeting); }, 150);
      }
      connorSetChips('start');
      setTimeout(function() { var inp = $('connor-input'); if (inp) inp.focus(); }, 300);
    }
  }

  // ── Definition panel ──────────────────────────────────────────────────────────
  function openDef(key) {
    var def = DEFINITIONS[key];
    if (!def) return;
    var overlay = $('connor-def-overlay');
    if (!overlay) return;
    var sheet = overlay.querySelector('.connor-def-sheet');
    if (!sheet) return;
    sheet.innerHTML =
      '<button class="connor-def-close" onclick="connorCloseDef()">✕ Close</button>' +
      '<div style="margin-bottom:0.5rem;"><span style="font-size:0.63rem;text-transform:uppercase;letter-spacing:0.08em;color:rgba(255,184,28,0.7);font-weight:700;">' + def.category + '</span></div>' +
      '<h2 style="color:#FFB81C;font-family:\'Epilogue\',sans-serif;font-size:1.15rem;margin:0 0 0.75rem;">' + def.term + '</h2>' +
      '<p style="color:rgba(255,255,255,0.85);font-size:0.88rem;line-height:1.65;margin:0 0 1rem;">' + connorMarkdown(def.full) + '</p>' +
      '<button onclick="connorAskAbout(\'' + key + '\')" style="background:rgba(255,184,28,0.13);border:1px solid rgba(255,184,28,0.38);border-radius:999px;padding:0.4rem 1rem;color:#FFB81C;cursor:pointer;font-size:0.8rem;font-weight:600;">🦊 Ask Connor about this</button>';
    overlay.classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  function connorCloseDef() {
    var overlay = $('connor-def-overlay');
    if (overlay) overlay.classList.remove('open');
    document.body.style.overflow = '';
  }

  function connorAskAbout(key) {
    connorCloseDef();
    if (!_open) connorToggle();
    setTimeout(function() { connorAsk('What is ' + (DEFINITIONS[key] ? DEFINITIONS[key].term : key) + '?'); }, 300);
  }

  // ── Build DOM ─────────────────────────────────────────────────────────────────
  function connorBuild() {
    var style = document.createElement('style');
    style.textContent = CSS;
    document.head.appendChild(style);

    var fabWrap = document.createElement('div');
    fabWrap.id = 'connor-fab-wrap';

    var fab = document.createElement('button');
    fab.id = 'connor-fab';
    fab.setAttribute('aria-label', 'Open Connor — NJTC Program Assistant');
    fab.innerHTML = '<div class="connor-fab-avatar">' + CONNOR_AVATAR + '</div><span>Ask Connor 🦊</span><div class="connor-fab-dot"></div>';
    fab.addEventListener('click', connorToggle);
    fabWrap.appendChild(fab);

    var chat = document.createElement('div');
    chat.id = 'connor-chat';
    chat.setAttribute('role', 'dialog');
    chat.innerHTML =
      '<div class="connor-hdr">' +
        '<div class="connor-hdr-avatar">' + CONNOR_AVATAR + '</div>' +
        '<div class="connor-hdr-info">' +
          '<div class="connor-hdr-name">Connor 🦊</div>' +
          '<div class="connor-hdr-sub">NJTC Program Assistant &nbsp;·&nbsp; <span class="connor-hdr-status">Online</span></div>' +
        '</div>' +
        '<span class="connor-kb-badge" id="connor-kb-badge" style="display:none;"></span>' +
        '<button class="connor-close" onclick="connorToggle()" aria-label="Close">✕</button>' +
      '</div>' +
      '<div class="connor-msgs" id="connor-msgs"></div>' +
      '<div class="connor-chips" id="connor-chips"></div>' +
      '<div class="connor-input-row">' +
        '<textarea class="connor-input" id="connor-input" placeholder="Ask Connor anything…" rows="1"></textarea>' +
        '<button class="connor-send" id="connor-send-btn" aria-label="Send">▶</button>' +
      '</div>';

    fabWrap.appendChild(chat);
    document.body.appendChild(fabWrap);

    var defOverlay = document.createElement('div');
    defOverlay.id = 'connor-def-overlay';
    defOverlay.innerHTML = '<div class="connor-def-sheet"></div>';
    defOverlay.addEventListener('click', function(e) { if (e.target === defOverlay) connorCloseDef(); });
    document.body.appendChild(defOverlay);

    var input = $('connor-input'), sendBtn = $('connor-send-btn');
    if (input) {
      input.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); connorAsk(input.value); }
      });
      input.addEventListener('input', function() {
        input.style.height = 'auto';
        input.style.height = Math.min(input.scrollHeight, 80) + 'px';
      });
    }
    if (sendBtn) {
      sendBtn.addEventListener('click', function() { connorAsk(($('connor-input') || {value:''}).value); });
    }

    window.connorToggle   = connorToggle;
    window.openConnorDef  = openDef;
    window.connorCloseDef = connorCloseDef;
    window.connorAskAbout = connorAskAbout;
  }

  // ── KPI definition badge injection ────────────────────────────────────────────
  function connorInjectBadges() {
    var termMap = {
      'My Attendance':      'attendance_rate',
      'Scholar Attendance': 'attendance_rate',
      'Unique Scholars':    'unique_scholars',
      'Survey Completion':  'survey_rate',
      'Scholar Survey':     'student_survey',
      'Sessions Done':      'session'
    };
    document.querySelectorAll('.njtc-kpi-label').forEach(function(el) {
      var txt = el.textContent.trim().replace(/\?/g, '').trim();
      var key = termMap[txt];
      if (key && !el.querySelector('.njtc-def-trigger')) {
        var badge = document.createElement('span');
        badge.className = 'njtc-def-trigger';
        badge.textContent = '?';
        badge.title = 'View definition';
        badge.addEventListener('click', function(e) { e.stopPropagation(); openDef(key); });
        el.appendChild(badge);
      }
    });
  }

  // ── Init ──────────────────────────────────────────────────────────────────────
  function connorInit() {
    connorBuild();
    fetchConnorSheet();
    setTimeout(connorInjectBadges, 2000);
    var dashContent = document.getElementById('njtcDashContent');
    if (dashContent) {
      new MutationObserver(function() { setTimeout(connorInjectBadges, 500); })
        .observe(dashContent, { childList: true, subtree: true });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', connorInit);
  } else {
    connorInit();
  }

})();
