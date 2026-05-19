/* ============================================================================
   CONNOR — NJTC Onsite Assistant  v2.0
   Floating fox chatbot for onsite staff.
   Rule-based Q&A + live Ask Connor sheet + live Pearl data. Zero AI calls.
   ============================================================================ */

(function () {
  'use strict';

  // ── Ask Connor knowledge base sheet ────────────────────────────────────────
  var ASK_CONNOR_2PACX = '2PACX-1vSdb5JPPXur2DPKofkB_EjGw0YD3la6kMZsM_U_PFOa0RQ2WaVmpEtDONfNWjkPRbesWSvq_7dVQ_QC';
  var ASK_CONNOR_GID   = '525529251';
  var ASK_CONNOR_URL   = 'https://docs.google.com/spreadsheets/d/e/' + ASK_CONNOR_2PACX + '/pub?output=csv&gid=' + ASK_CONNOR_GID;
  var ASK_CONNOR_CACHE = 'njtc_connor_kb_v1';

  // in-memory Q&A loaded from sheet: [{category, question, answer, nextSteps}]
  var _sheetQA = [];
  var _sheetLoaded = false;

  // ── Character config ────────────────────────────────────────────────────────
  var CONNOR_NAME = 'Connor';

  // Cool geometric flat-design fox in NJTC navy & gold
  var CONNOR_AVATAR = `<svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:100%;">
    <circle cx="24" cy="24" r="24" fill="#001a33"/>
    <!-- Ear left -->
    <polygon points="11,21 7,5 20,15" fill="#FFB81C"/>
    <polygon points="12,20 9,8 18,15" fill="#c07a00"/>
    <!-- Ear right -->
    <polygon points="37,21 41,5 28,15" fill="#FFB81C"/>
    <polygon points="36,20 39,8 30,15" fill="#c07a00"/>
    <!-- Head -->
    <circle cx="24" cy="24" r="14" fill="#FFB81C"/>
    <!-- White muzzle -->
    <ellipse cx="24" cy="28" rx="8" ry="7" fill="#fff9ee"/>
    <!-- Forehead stripe -->
    <path d="M19,14 Q24,11 29,14 Q26,19 24,20 Q22,19 19,14Z" fill="#c07a00" opacity="0.6"/>
    <!-- Eyes -->
    <ellipse cx="19.5" cy="22" rx="3.2" ry="3.5" fill="#001a33"/>
    <ellipse cx="28.5" cy="22" rx="3.2" ry="3.5" fill="#001a33"/>
    <!-- Pupils -->
    <ellipse cx="19.5" cy="22.5" rx="1.8" ry="2.2" fill="#1a0f00"/>
    <ellipse cx="28.5" cy="22.5" rx="1.8" ry="2.2" fill="#1a0f00"/>
    <!-- Eye shine -->
    <circle cx="21" cy="21" r="1" fill="white"/>
    <circle cx="30" cy="21" r="1" fill="white"/>
    <!-- Nose -->
    <ellipse cx="24" cy="27" rx="2.2" ry="1.6" fill="#001a33"/>
    <!-- Mouth -->
    <path d="M21.5,29 Q24,31.5 26.5,29" stroke="#c07a00" stroke-width="1.2" fill="none" stroke-linecap="round"/>
    <!-- Cheek blush -->
    <ellipse cx="14.5" cy="27" rx="3.5" ry="2.2" fill="#e09800" opacity="0.35"/>
    <ellipse cx="33.5" cy="27" rx="3.5" ry="2.2" fill="#e09800" opacity="0.35"/>
    <!-- Tiny gold collar dot -->
    <circle cx="24" cy="37" r="2.5" fill="#FFB81C" opacity="0.7"/>
    <text x="24" y="38.2" text-anchor="middle" fill="#001a33" font-size="2.8" font-family="Arial" font-weight="bold">N</text>
  </svg>`;

  // ── CSS ─────────────────────────────────────────────────────────────────────
  var CSS = `
    #connor-fab-wrap { position:fixed; bottom:1.5rem; right:1.5rem; z-index:9000; }
    #connor-fab {
      position: relative;
      display: flex;
      align-items: center;
      gap: 0.5rem;
      background: linear-gradient(135deg, #FFB81C 0%, #e09800 100%);
      color: #001a33;
      border: none;
      border-radius: 3rem;
      padding: 0.6rem 1.1rem 0.6rem 0.5rem;
      font-family: 'DM Sans','Epilogue',sans-serif;
      font-size: 0.875rem;
      font-weight: 800;
      cursor: pointer;
      box-shadow: 0 4px 24px rgba(255,184,28,0.45), 0 2px 8px rgba(0,0,0,0.3);
      transition: transform 0.2s ease, box-shadow 0.2s ease;
      letter-spacing: 0.01em;
    }
    #connor-fab:hover { transform:translateY(-3px); box-shadow:0 8px 32px rgba(255,184,28,0.6),0 4px 12px rgba(0,0,0,0.3); }
    #connor-fab.open { background:linear-gradient(135deg,#003366,#001a33); color:#FFB81C; box-shadow:0 4px 24px rgba(0,26,51,0.5); }
    #connor-fab .connor-fab-avatar { width:34px; height:34px; border-radius:50%; overflow:hidden; flex-shrink:0; }
    #connor-fab .connor-fab-dot {
      width:9px; height:9px; border-radius:50%; background:#22c55e;
      position:absolute; top:3px; right:3px;
      border:2px solid #FFB81C;
      animation:connorPulse 2.5s ease infinite;
    }
    #connor-fab.open .connor-fab-dot { background:rgba(255,184,28,0.6); border-color:#001a33; }
    @keyframes connorPulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.5;transform:scale(0.8)} }

    #connor-chat {
      position:fixed; bottom:5.5rem; right:1.5rem;
      width:370px; max-width:calc(100vw - 2rem);
      height:530px; max-height:calc(100vh - 7rem);
      background:linear-gradient(160deg,#001a33 0%,#002244 100%);
      border-radius:1.25rem;
      box-shadow:0 12px 48px rgba(0,0,0,0.6),0 0 0 1px rgba(255,184,28,0.3);
      z-index:8999;
      display:flex; flex-direction:column; overflow:hidden;
      transform:scale(0.9) translateY(20px);
      opacity:0; pointer-events:none;
      transition:transform 0.25s cubic-bezier(.32,.72,0,1),opacity 0.25s ease;
    }
    #connor-chat.open { transform:scale(1) translateY(0); opacity:1; pointer-events:all; }

    .connor-hdr {
      display:flex; align-items:center; gap:0.75rem;
      padding:0.875rem 1rem 0.75rem;
      border-bottom:1px solid rgba(255,184,28,0.2);
      flex-shrink:0;
    }
    .connor-hdr-avatar { width:44px; height:44px; border-radius:50%; overflow:hidden; flex-shrink:0; border:2px solid rgba(255,184,28,0.4); }
    .connor-hdr-info { flex:1; min-width:0; }
    .connor-hdr-name { font-family:'Epilogue','DM Sans',sans-serif; font-weight:800; font-size:0.95rem; color:#FFB81C; }
    .connor-hdr-sub { font-size:0.68rem; color:rgba(255,255,255,0.42); margin-top:0.1rem; }
    .connor-hdr-status { display:inline-flex; align-items:center; gap:0.28rem; font-size:0.64rem; color:#22c55e; font-weight:600; }
    .connor-hdr-status::before { content:''; display:inline-block; width:6px; height:6px; border-radius:50%; background:#22c55e; }
    .connor-kb-badge {
      font-size:0.58rem; background:rgba(255,184,28,0.15); border:1px solid rgba(255,184,28,0.3);
      border-radius:999px; padding:0.15rem 0.5rem; color:rgba(255,184,28,0.8); font-weight:600;
      white-space:nowrap;
    }
    .connor-close {
      background:rgba(255,255,255,0.07); border:none; border-radius:8px;
      width:30px; height:30px; display:flex; align-items:center; justify-content:center;
      cursor:pointer; color:rgba(255,255,255,0.45); font-size:0.95rem; flex-shrink:0;
      transition:background 0.15s,color 0.15s;
    }
    .connor-close:hover { background:rgba(255,255,255,0.14); color:#fff; }

    .connor-msgs {
      flex:1; overflow-y:auto; padding:0.875rem 1rem; display:flex;
      flex-direction:column; gap:0.75rem; scroll-behavior:smooth;
    }
    .connor-msgs::-webkit-scrollbar { width:3px; }
    .connor-msgs::-webkit-scrollbar-thumb { background:rgba(255,184,28,0.3); border-radius:99px; }

    .connor-msg { display:flex; gap:0.5rem; align-items:flex-end; }
    .connor-msg.user { flex-direction:row-reverse; }
    .connor-msg-avatar { width:28px; height:28px; border-radius:50%; overflow:hidden; flex-shrink:0; }
    .connor-msg-bubble {
      max-width:82%; padding:0.6rem 0.875rem;
      border-radius:1.1rem; font-size:0.8125rem; line-height:1.55;
      white-space:pre-wrap; word-break:break-word;
    }
    .connor-msg.bot .connor-msg-bubble { background:rgba(255,255,255,0.08); color:rgba(255,255,255,0.92); border-bottom-left-radius:0.25rem; }
    .connor-msg.user .connor-msg-bubble { background:linear-gradient(135deg,#FFB81C,#e09800); color:#001a33; font-weight:600; border-bottom-right-radius:0.25rem; }
    .connor-msg-bubble strong { color:#FFB81C; font-weight:700; }
    .connor-msg.user .connor-msg-bubble strong { color:#001a33; }

    /* sheet Q&A answer card */
    .connor-sheet-card {
      background:rgba(255,184,28,0.09); border:1px solid rgba(255,184,28,0.25);
      border-radius:0.75rem; padding:0.65rem 0.8rem; margin-top:0.5rem; font-size:0.78rem;
    }
    .connor-sheet-card .sc-cat { font-size:0.6rem; text-transform:uppercase; letter-spacing:0.08em; color:#FFB81C; font-weight:700; margin-bottom:0.3rem; }
    .connor-sheet-card .sc-q { font-weight:700; color:rgba(255,255,255,0.9); margin-bottom:0.4rem; font-size:0.8rem; }
    .connor-sheet-card .sc-a { color:rgba(255,255,255,0.82); line-height:1.55; }
    .connor-sheet-card .sc-steps { margin-top:0.45rem; padding-top:0.45rem; border-top:1px solid rgba(255,184,28,0.2); color:rgba(255,255,255,0.7); }
    .connor-sheet-card .sc-steps-label { font-size:0.6rem; text-transform:uppercase; letter-spacing:0.06em; color:#FFB81C; font-weight:700; margin-bottom:0.2rem; }

    .connor-typing {
      display:flex; align-items:center; gap:4px; padding:0.6rem 0.875rem;
      background:rgba(255,255,255,0.08); border-radius:1.1rem;
      border-bottom-left-radius:0.25rem; max-width:60px;
    }
    .connor-typing span { width:6px; height:6px; border-radius:50%; background:rgba(255,184,28,0.7); animation:connorDot 1.2s ease infinite; }
    .connor-typing span:nth-child(2) { animation-delay:0.2s; }
    .connor-typing span:nth-child(3) { animation-delay:0.4s; }
    @keyframes connorDot { 0%,60%,100%{transform:translateY(0);opacity:0.5} 30%{transform:translateY(-5px);opacity:1} }

    .connor-chips { padding:0 1rem 0.5rem; display:flex; flex-wrap:wrap; gap:0.35rem; flex-shrink:0; }
    .connor-chip {
      background:rgba(255,184,28,0.11); border:1px solid rgba(255,184,28,0.28);
      border-radius:999px; padding:0.28rem 0.72rem; font-size:0.71rem;
      color:rgba(255,255,255,0.78); cursor:pointer; font-family:'DM Sans',sans-serif;
      white-space:nowrap; transition:background 0.15s,color 0.15s;
    }
    .connor-chip:hover { background:rgba(255,184,28,0.24); color:#fff; }

    .connor-input-row { display:flex; gap:0.5rem; padding:0.7rem 1rem 0.9rem; border-top:1px solid rgba(255,255,255,0.07); flex-shrink:0; }
    .connor-input {
      flex:1; background:rgba(255,255,255,0.08); border:1px solid rgba(255,255,255,0.11);
      border-radius:0.75rem; padding:0.55rem 0.875rem; color:#fff;
      font-size:0.8125rem; font-family:'DM Sans',sans-serif; outline:none;
      resize:none; min-height:38px; max-height:80px; transition:border-color 0.15s;
    }
    .connor-input::placeholder { color:rgba(255,255,255,0.28); }
    .connor-input:focus { border-color:rgba(255,184,28,0.5); }
    .connor-send {
      background:linear-gradient(135deg,#FFB81C,#e09800); border:none; border-radius:0.75rem;
      width:38px; height:38px; display:flex; align-items:center; justify-content:center;
      cursor:pointer; color:#001a33; font-size:1rem; flex-shrink:0;
      transition:transform 0.15s,opacity 0.15s;
    }
    .connor-send:hover { transform:scale(1.08); }
    .connor-send:disabled { opacity:0.35; cursor:default; transform:none; }

    #connor-def-overlay {
      position:fixed; inset:0; background:rgba(0,0,0,0.6); backdrop-filter:blur(4px);
      z-index:9100; display:flex; align-items:flex-end; justify-content:center;
      opacity:0; pointer-events:none; transition:opacity 0.2s;
    }
    #connor-def-overlay.open { opacity:1; pointer-events:all; }
    .connor-def-sheet {
      background:linear-gradient(160deg,#001a33,#002244);
      border-radius:1.25rem 1.25rem 0 0; width:100%; max-width:480px;
      max-height:85vh; overflow-y:auto; padding:1.5rem 1.5rem 2rem;
      border-top:3px solid rgba(255,184,28,0.4);
      transform:translateY(100%); transition:transform 0.3s cubic-bezier(.32,.72,0,1);
    }
    #connor-def-overlay.open .connor-def-sheet { transform:translateY(0); }
    .connor-def-close {
      float:right; background:rgba(255,255,255,0.08); border:none; border-radius:8px;
      padding:0.35rem 0.65rem; color:rgba(255,255,255,0.6); cursor:pointer; font-size:0.875rem;
    }

    .njtc-def-trigger {
      display:inline-flex; align-items:center; justify-content:center;
      width:16px; height:16px; border-radius:50%;
      background:rgba(255,184,28,0.18); border:1px solid rgba(255,184,28,0.38);
      color:#FFB81C; font-size:0.6rem; font-weight:700; cursor:pointer;
      margin-left:0.25rem; vertical-align:middle;
      transition:background 0.15s; font-family:sans-serif; line-height:1; flex-shrink:0;
    }
    .njtc-def-trigger:hover { background:rgba(255,184,28,0.35); }
  `;

  // ── Definitions library ─────────────────────────────────────────────────────
  var DEFINITIONS = {
    'attendance_rate': {
      term: 'Attendance Rate', category: 'Attendance',
      short: 'The % of sessions you (or your scholars) actually showed up to.',
      full: 'Calculated as: Attended ÷ (Attended + Absent). **Service interruptions (holidays, school closures, testing days) are NOT counted against you or your scholars.** Goal is 90% or higher.'
    },
    'service_interruption': {
      term: 'Service Interruption (SI)', category: 'Attendance',
      short: 'A missed session that was NOT the tutor\'s or scholar\'s fault.',
      full: 'Examples: school closures, holidays, NJTC diagnostic testing, school events, drills. These are excluded from attendance rate calculations — they don\'t count against anyone. You\'ll see them tracked separately on your dashboard.'
    },
    'not_recorded': {
      term: 'Not Recorded', category: 'Pearl',
      short: 'A session where attendance was never entered in Pearl.',
      full: 'When a session shows "Not recorded," no one logged attendance for that day. This is an action item — go into Pearl and mark attendance as soon as possible. Sessions that stay unrecorded affect program data quality.'
    },
    'unique_scholars': {
      term: 'Unique Scholars', category: 'Pearl',
      short: 'The number of individual students you\'ve worked with this year.',
      full: 'This counts each student only once, regardless of how many sessions they attended. It comes from Pearl operations data for the current school year only — not historical iReady data. It reflects everyone enrolled in your tutoring sessions at your school.'
    },
    'survey_rate': {
      term: 'Survey Completion Rate', category: 'Surveys',
      short: 'The % of your sessions where you submitted an instructor survey.',
      full: 'Calculated as: Surveys submitted ÷ Sessions attended. The goal is 100% — every session you attend should have a survey. Surveys tell leadership how your sessions are going and help identify scholars who need support.'
    },
    'placement_level': {
      term: 'iReady Placement Level', category: 'iReady',
      short: 'Where a scholar\'s reading or math skills fall relative to grade level.',
      full: 'Levels (lowest → highest):\n• 3+ Grade Levels Below\n• 2 Grade Levels Below\n• 1 Grade Level Below\n• Early On Grade Level\n• Mid or Above Grade Level\n\nThese come from iReady diagnostic tests — not day-to-day work.'
    },
    'moved_up': {
      term: 'Moved Up (iReady)', category: 'iReady',
      short: 'A scholar who improved at least one full placement level.',
      full: '"Moved Up" means a scholar went from one placement level to a higher one between the BOY and EOY diagnostic. This is one of the clearest measures of tutor impact.'
    },
    'grade_level': {
      term: 'Grade Level (iReady)', category: 'iReady',
      short: 'Performing where a student at their grade is expected to perform.',
      full: '"Reached Grade Level" means a scholar tested at "Early On Grade Level" or above on their most recent iReady diagnostic. This is the benchmark NJTC tracks as a key impact metric.'
    },
    'boy': {
      term: 'BOY (Beginning of Year)', category: 'iReady',
      short: 'The first iReady diagnostic test of the school year.',
      full: 'BOY = Beginning of Year. This is the baseline diagnostic given to students at the start of the year. It establishes where scholars begin and is compared to the EOY diagnostic to measure growth.'
    },
    'eoy': {
      term: 'EOY (End of Year)', category: 'iReady',
      short: 'The final iReady diagnostic test of the school year.',
      full: 'EOY = End of Year. The final diagnostic that shows scholar progress over the full year. Comparing BOY to EOY tells us how much each scholar grew and whether they moved up placement levels.'
    },
    'moy': {
      term: 'MOY (Middle of Year)', category: 'iReady',
      short: 'The mid-year iReady check-in diagnostic.',
      full: 'MOY = Middle of Year. This diagnostic in January/February gives a midpoint snapshot of scholar progress. NJTC is working on integrating MOY data — it will appear in the iReady section when available.'
    },
    'pearl': {
      term: 'Pearl', category: 'Pearl',
      short: 'NJTC\'s attendance and operations tracking platform.',
      full: 'Pearl is where all tutoring session attendance, survey submissions, and scholar records live. You use it to mark attendance after each session, submit surveys, and track your scholars. Your onsite dashboard pulls live data directly from Pearl.'
    },
    'pearl_id': {
      term: 'Pearl ID', category: 'Pearl',
      short: 'Your unique identifier in the Pearl system.',
      full: 'Your Pearl ID is the numeric ID assigned to you in Pearl. It\'s used to pull your specific attendance records, surveys, and scholar data on your dashboard. You entered it when logging into the onsite portal.'
    },
    'session': {
      term: 'Session', category: 'Pearl',
      short: 'One tutoring meeting with your scholars.',
      full: 'A session is one scheduled tutoring block. Each session gets its own entry in Pearl where you mark attendance (Attended, Absent, etc.) and submit your instructor survey. Sessions are grouped by week on your dashboard.'
    },
    'typical_growth': {
      term: 'Typical Growth (iReady)', category: 'iReady',
      short: 'The expected growth for a student with NO extra tutoring support.',
      full: '"Growth vs Typical" shows how much a scholar grew compared to what iReady expects for an average student with only regular classroom instruction. 100% means they met typical growth. Over 100% means they exceeded it — that\'s your impact.'
    },
    'shared_scholar': {
      term: 'Shared Scholar', category: 'iReady',
      short: 'A scholar who was tutored by more than one NJTC tutor.',
      full: 'A "shared" scholar appears in the iReady data under multiple tutors (column B of the longitudinal sheet lists all instructors). This happens when a scholar switches tutors mid-year or is co-instructed. Their placement data reflects all instruction combined.'
    },
    'consecutive_concern': {
      term: 'Consecutive Absence Concern', category: 'Scholars',
      short: 'A scholar who has missed many sessions in a row.',
      full: 'Pearl automatically flags scholars who miss a significant number of consecutive sessions as an "Attendance Concern." On your scholar grid, these show an ⚠ badge. This is a signal to check in with that student and their family and notify your site leader.'
    },
    'instructor_survey': {
      term: 'Instructor Survey', category: 'Surveys',
      short: 'The survey YOU submit after each tutoring session.',
      full: 'After each session, you complete an instructor survey in Pearl that rates scholar engagement, enjoyment, and learning. This data goes directly to your program manager. Your survey rate (%) shows how consistently you\'re submitting these.'
    },
    'student_survey': {
      term: 'Student / Scholar Survey', category: 'Surveys',
      short: 'The survey your SCHOLARS submit about their session.',
      full: 'Students fill out a short survey rating their confidence, enjoyment, and learning after each session. These scores appear in your scholar mini-profiles. Comments flagged with ⚠ "Needs Support" contain keywords suggesting a scholar may need extra attention.'
    },
    'site_leader': {
      term: 'Site Leader / Dual Role', category: 'Program',
      short: 'A tutor who also takes on additional site coordination responsibilities.',
      full: 'Some NJTC staff serve in a "Dual Role" as both tutor and site leader. Site leaders help coordinate logistics, communicate with school staff, and support other tutors at their location. This role is reflected in Pearl attendance records.'
    },
    'lea': {
      term: 'LEA (Local Education Agency)', category: 'Program',
      short: 'The school district or school system your site is part of.',
      full: 'LEA stands for Local Education Agency — essentially the school district. For example, "iLearn Clifton MS" is within the Clifton LEA. Your school assignment in Pearl determines which scholars appear on your dashboard.'
    },
    'iready': {
      term: 'iReady', category: 'iReady',
      short: 'The digital diagnostic platform NJTC uses to measure scholar reading and math levels.',
      full: 'iReady is a curriculum and assessment platform by Curriculum Associates. NJTC uses it for diagnostic testing at the beginning and end of the school year. Diagnostics measure scholar reading and math skills against grade-level standards and track growth over time.'
    }
  };

  // ── Helper: format a definition response ───────────────────────────────────
  function connorDef(key) {
    var def = DEFINITIONS[key];
    if (!def) return null;
    return '**' + def.term + '**\n\n' + def.full;
  }

  // ── Parse CSV text into rows ────────────────────────────────────────────────
  function parseCSV(text) {
    var rows = [];
    var lines = text.split(/\r?\n/);
    lines.forEach(function(line) {
      var cols = [];
      var inQ = false;
      var cur = '';
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
    // Try cache first
    try {
      var cached = sessionStorage.getItem(ASK_CONNOR_CACHE);
      if (cached) {
        _sheetQA = JSON.parse(cached);
        _sheetLoaded = true;
        updateKBBadge();
        return;
      }
    } catch(e) {}

    fetch(ASK_CONNOR_URL)
      .then(function(r) { return r.ok ? r.text() : Promise.reject(r.status); })
      .then(function(text) {
        var rows = parseCSV(text);
        var qa = [];
        // Row 0 = header; columns: A=Category, B=Question, C=Answer, D=MoreInfo, E=NextSteps
        for (var i = 1; i < rows.length; i++) {
          var r = rows[i];
          var cat      = (r[0] || '').trim();
          var question = (r[1] || '').trim();
          var answer   = (r[2] || '').trim();
          var more     = (r[3] || '').trim();
          var steps    = (r[4] || '').trim();
          if (question && (answer || more)) {
            qa.push({
              category: cat,
              question: question,
              answer: answer + (more ? '\n\n' + more : ''),
              nextSteps: steps
            });
          }
        }
        _sheetQA = qa;
        _sheetLoaded = true;
        try { sessionStorage.setItem(ASK_CONNOR_CACHE, JSON.stringify(qa)); } catch(e) {}
        updateKBBadge();
      })
      .catch(function() { _sheetLoaded = true; /* silently continue without sheet */ });
  }

  function updateKBBadge() {
    var badge = document.getElementById('connor-kb-badge');
    if (badge && _sheetQA.length > 0) {
      badge.textContent = _sheetQA.length + ' resources';
      badge.style.display = '';
    }
  }

  // ── Search sheet Q&A by keyword similarity ─────────────────────────────────
  function searchSheetQA(q) {
    if (!_sheetQA.length) return null;

    var norm = q.toLowerCase().replace(/[^a-z0-9\s]/g, ' ');
    var words = norm.split(/\s+/).filter(function(w) { return w.length > 2; });
    if (!words.length) return null;

    var best = null;
    var bestScore = 0;

    _sheetQA.forEach(function(item) {
      var haystack = ((item.category + ' ' + item.question + ' ' + item.answer + ' ' + item.nextSteps) || '').toLowerCase();
      var score = 0;
      words.forEach(function(w) { if (haystack.indexOf(w) !== -1) score++; });
      // Boost if word appears in question itself
      var qHay = item.question.toLowerCase();
      words.forEach(function(w) { if (qHay.indexOf(w) !== -1) score += 2; });
      if (score > bestScore) { bestScore = score; best = item; }
    });

    // Only return if reasonably confident (at least 2 matching words, or 1 strong question match)
    if (bestScore >= 2) return best;
    return null;
  }

  function renderSheetResult(item) {
    return '<div class="connor-sheet-card">' +
      (item.category ? '<div class="sc-cat">' + escapeHtml(item.category) + '</div>' : '') +
      '<div class="sc-q">' + escapeHtml(item.question) + '</div>' +
      '<div class="sc-a">' + connorMarkdown(escapeHtml(item.answer)) + '</div>' +
      (item.nextSteps ? '<div class="sc-steps"><div class="sc-steps-label">Next Steps</div>' + connorMarkdown(escapeHtml(item.nextSteps)) + '</div>' : '') +
      '</div>';
  }

  // ── Q&A rule engine ─────────────────────────────────────────────────────────
  var RULES = [

    // ── Greetings ──────────────────────────────────────────────────────────────
    { match: /^(hi|hey|hello|hiya|sup|yo|howdy|good morning|good afternoon|good evening)\b/i,
      respond: function() {
        var d = window._connorPearlData;
        var u = window._connorUser;
        var name = u ? (u.name || '').split(' ')[0] : '';
        var greet = name ? 'Hey ' + name + '! 👋' : 'Hey there! 👋';
        var extra = '';
        if (d && d.hasData) {
          var attColor = d.myAttRate >= 90 ? '🟢' : d.myAttRate >= 80 ? '🟡' : '🔴';
          extra = '\n\nQuick look at your data — attendance is at **' + (d.myAttRate !== null ? d.myAttRate + '%' : '—') + '** ' + attColor + ' and you\'ve worked with **' + d.uniqueScholarCount + ' scholars** this year. Ask me anything!';
        }
        return greet + ' I\'m **Connor**, your NJTC program fox 🦊 — here to help you make sense of your dashboard, Pearl data, and program info.' + extra;
      }
    },

    // ── Who are you ────────────────────────────────────────────────────────────
    { match: /who are you|what are you|what can you do|help me|what do you know/i,
      respond: function() {
        var kbNote = _sheetQA.length > 0 ? '\n• **' + _sheetQA.length + ' Ask Connor resources** — I\'ve loaded the full program knowledge base!' : '';
        return '🦊 I\'m **Connor** — your NJTC program assistant!\n\nI can help with:\n• **Your live dashboard data** — attendance, scholars, surveys\n• **Definitions** — what terms like "service interruption" or "placement level" mean\n• **iReady** — diagnostics, growth metrics, BOY/EOY\n• **Pearl** — attendance marking, surveys, sessions\n• **Program expectations & policies**' + kbNote + '\n\nJust ask naturally — I\'ll dig up an answer!';
      }
    },

    // ── My attendance ──────────────────────────────────────────────────────────
    { match: /my attendance|my att rate|how am i doing|my rate|am i on track/i,
      respond: function() {
        var d = window._connorPearlData;
        if (!d || !d.hasData) return 'Your Pearl data is still loading — give it a moment and try again!';
        var rate = d.myAttRate;
        var status = rate >= 90 ? '🟢 You\'re above the 90% goal — great job!' :
                     rate >= 80 ? '🟡 You\'re close to the 90% goal. A few more sessions and you\'ll be there!' :
                     '🔴 Below 80% — reach out to your program manager if you\'re facing challenges.';
        var msg = '**Your attendance rate: ' + (rate !== null ? rate + '%' : '—') + '**\n\n' + status;
        msg += '\n\n📊 Sessions attended: **' + d.myAttended + '** | Missed: **' + d.myAbsent + '**';
        if (d.mySI > 0) msg += '\n⚡ Service interruptions: **' + d.mySI + '** _(not counted against you)_';
        return msg;
      }
    },

    // ── My scholars ────────────────────────────────────────────────────────────
    { match: /my scholars|how many students|how many scholars|scholar count|who are my students/i,
      respond: function() {
        var d = window._connorPearlData;
        if (!d || !d.hasData) return 'Your Pearl data is still loading — give it a moment!';
        var msg = '**You\'ve worked with ' + d.uniqueScholarCount + ' unique scholars** this school year at ' + (d.tutorSchool || 'your site') + '.';
        if (d.scholarAttRate !== null) msg += '\n\n📊 Scholar attendance avg: **' + d.scholarAttRate + '%**';
        if (d.scholars && d.scholars.length > 0) {
          var consecCount = d.scholars.filter(function(s){ return s.consecConcern; }).length;
          if (consecCount > 0) msg += '\n\n⚠ **' + consecCount + ' scholar' + (consecCount > 1 ? 's' : '') + '** ha' + (consecCount > 1 ? 've' : 's') + ' a consecutive absence concern — check their cards on your dashboard.';
        }
        return msg;
      }
    },

    // ── My surveys ─────────────────────────────────────────────────────────────
    { match: /my survey|survey rate|did i submit|survey completion|surveys? filed/i,
      respond: function() {
        var d = window._connorPearlData;
        if (!d || !d.hasData) return 'Your Pearl data is still loading — give it a moment!';
        var rate = d.surveyRate;
        var msg = '**Your survey completion: ' + (rate !== null ? rate + '%' : '—') + '**\n\n';
        if (rate === 100) msg += '✅ Perfect! You\'ve submitted a survey for every session you attended.';
        else if (rate >= 80) msg += '📋 Almost there — submit surveys right after each session to hit 100%.';
        else msg += '⚠ You\'re missing surveys for some sessions. See the Action Items section on your dashboard.';
        if (d.stuSurveyAvg !== null) msg += '\n\n⭐ Your scholars rated their sessions **' + d.stuSurveyAvg + '/5** on average.';
        return msg;
      }
    },

    // ── Scholar survey scores ───────────────────────────────────────────────────
    { match: /scholar survey|student rating|how do students rate|student survey score|survey score/i,
      respond: function() {
        var d = window._connorPearlData;
        if (!d || !d.hasData) return 'Your Pearl data is still loading — give it a moment!';
        if (d.stuSurveyAvg === null) return 'No student survey data yet — scores will appear here once scholars start submitting surveys.';
        var score = d.stuSurveyAvg;
        var emoji = score >= 4 ? '🌟' : score >= 3 ? '👍' : '💛';
        var msg = emoji + ' **Scholar survey average: ' + score + '/5**\n\n';
        var sc = d.stuAvgScores;
        if (sc) {
          if (sc.confidence !== null) msg += '• Confidence: **' + sc.confidence + '/5**\n';
          if (sc.enjoyment  !== null) msg += '• Enjoyment: **'  + sc.enjoyment  + '/5**\n';
          if (sc.learning   !== null) msg += '• Learning: **'   + sc.learning   + '/5**\n';
          if (sc.overall    !== null) msg += '• Overall: **'    + sc.overall    + '/5**';
        }
        msg += '\n\n_Tap any scholar card on your dashboard to see their individual comments._';
        return msg;
      }
    },

    // ── Action items ───────────────────────────────────────────────────────────
    { match: /action item|what do i need to do|pending|to.?do|need to record|need to submit/i,
      respond: function() {
        var d = window._connorPearlData;
        if (!d || !d.hasData) return 'Your Pearl data is still loading — give it a moment!';
        var items = [];
        var recentNR = (d.notRecordedSessions || []).filter(function(s){ return s.recent; });
        var recentMS = (d.missingSurveys || []).filter(function(s){ return s.recent; });
        if (recentNR.length > 0) items.push('📋 **' + recentNR.length + ' session' + (recentNR.length > 1 ? 's' : '') + '** need attendance recorded in Pearl');
        if (recentMS.length > 0) items.push('📝 **' + recentMS.length + ' session' + (recentMS.length > 1 ? 's' : '') + '** are missing an instructor survey');
        if (!items.length) return '✅ **All caught up!** No urgent action items this week. Keep logging attendance and surveys after every session.';
        return '🎯 **Your action items:**\n\n' + items.join('\n') + '\n\nSee the Action Items card at the top of your dashboard for specific sessions.';
      }
    },

    // ── iReady questions ───────────────────────────────────────────────────────
    { match: /iready|i-ready|i ready/i,
      respond: function(q) {
        if (/placement|level|where|stand/i.test(q))       return connorDef('placement_level');
        if (/moved? up|improve|growth|progress/i.test(q)) return connorDef('moved_up');
        if (/typical growth|100 ?%|benchmark/i.test(q))   return connorDef('typical_growth');
        if (/boy|beginning of year/i.test(q))             return connorDef('boy');
        if (/eoy|end of year/i.test(q))                   return connorDef('eoy');
        if (/moy|mid.?year/i.test(q))                     return connorDef('moy');
        return '📊 **iReady** is the diagnostic platform NJTC uses to measure scholar reading and math growth.\n\nYour iReady section shows:\n• BOY → EOY placement level changes per scholar\n• % who moved up at least one level\n• % who reached grade level\n• Growth vs typical (expected without tutoring)\n\nData is grouped by school year — most recent first. Ask me about "placement levels," "moved up," "typical growth," BOY, EOY, or MOY.';
      }
    },

    // ── Pearl / logging attendance ─────────────────────────────────────────────
    { match: /pearl|mark attendance|log attendance|record attendance/i,
      respond: function(q) {
        if (/how.*(mark|log|record|enter)|where.*(mark|log|record|enter)/i.test(q)) {
          return '📋 **How to mark attendance in Pearl:**\n\n1. Log into Pearl\n2. Find your session for today\n3. Mark each student: Attended, Absent, or the appropriate missed reason\n4. Submit your instructor survey before you leave\n\nRecord attendance **the same day** — unrecorded sessions show up as action items on your dashboard.';
        }
        return connorDef('pearl');
      }
    },

    // ── Survey submission ──────────────────────────────────────────────────────
    { match: /how.*(submit|fill|complete).*(survey)|survey.*(how|submit|fill|complete)/i,
      respond: function() {
        return '📝 **How to submit your instructor survey:**\n\n1. Log into Pearl after your session\n2. Navigate to your session record\n3. Click "Submit Survey"\n4. Rate scholar engagement, enjoyment, and learning\n5. Add any comments about scholar support needs\n\nSubmit right after each session — it takes under 2 minutes and directly helps your program manager support you.';
      }
    },

    // ── Service interruption ───────────────────────────────────────────────────
    { match: /service interruption|\bsi\b|school closure|holiday|testing day|not.*fault|doesn.t count/i,
      respond: function() { return connorDef('service_interruption'); }
    },

    // ── Not recorded ───────────────────────────────────────────────────────────
    { match: /not recorded|unrecorded|missing attendance/i,
      respond: function() { return connorDef('not_recorded'); }
    },

    // ── Attendance rate definition ─────────────────────────────────────────────
    { match: /what is.*(attendance rate|att rate)|how.*(calculate|compute).*attendance|90.?% goal|attendance goal/i,
      respond: function() { return connorDef('attendance_rate'); }
    },

    // ── Placement level ────────────────────────────────────────────────────────
    { match: /placement level|grade level below|below grade|at grade level|above grade|early on grade/i,
      respond: function() { return connorDef('placement_level'); }
    },

    // ── Consecutive concern ────────────────────────────────────────────────────
    { match: /consecutive|attendance concern|missed many|warning flag|scholar flag/i,
      respond: function() { return connorDef('consecutive_concern'); }
    },

    // ── Shared scholar ─────────────────────────────────────────────────────────
    { match: /shared scholar|shared badge|multiple tutor|co.?instruct/i,
      respond: function() { return connorDef('shared_scholar'); }
    },

    // ── LEA ───────────────────────────────────────────────────────────────────
    { match: /\blea\b|local education|my district|what is.*district/i,
      respond: function() {
        var d = window._connorPearlData;
        var extra = (d && d.tutorSchool) ? '\n\n📍 Your site: **' + d.tutorSchool + '**' + (d.tutorDistrict ? ' · ' + d.tutorDistrict : '') : '';
        return connorDef('lea') + extra;
      }
    },

    // ── Generic "what is X" / define X ────────────────────────────────────────
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

    // ── Glossary list ──────────────────────────────────────────────────────────
    { match: /glossary|all definitions|list.*definition|definition.*list|show.*terms/i,
      respond: function() {
        return '📖 **NJTC Dashboard Glossary**\n\nAsk me "What is [term]?" for any of these:\n\n**Attendance:** Attendance Rate · Service Interruption · Not Recorded\n**Scholars:** Unique Scholars · Consecutive Concern · Shared Scholar\n**iReady:** Placement Level · Moved Up · Grade Level · BOY · EOY · MOY · Typical Growth\n**Pearl:** Pearl · Pearl ID · Session\n**Surveys:** Instructor Survey · Student Survey · Survey Rate\n**Program:** LEA · Site Leader / Dual Role';
      }
    },

    // ── Dashboard summary ──────────────────────────────────────────────────────
    { match: /my data|my dashboard|my stats|my numbers|give me a summary|overview/i,
      respond: function() {
        var d = window._connorPearlData;
        var u = window._connorUser;
        if (!d || !d.hasData) return 'Your Pearl data is still loading — give it a moment and try again.';
        var name = u ? (u.name || '').split(' ')[0] : 'You';
        var msg = '📊 **' + name + '\'s Dashboard Summary**\n\n';
        msg += (d.myAttRate !== null ? (d.myAttRate >= 90 ? '🟢' : d.myAttRate >= 80 ? '🟡' : '🔴') : '—') + ' Tutor Attendance: **' + (d.myAttRate !== null ? d.myAttRate + '%' : '—') + '**\n';
        msg += (d.scholarAttRate !== null ? (d.scholarAttRate >= 90 ? '🟢' : d.scholarAttRate >= 80 ? '🟡' : '🔴') : '—') + ' Scholar Attendance: **' + (d.scholarAttRate !== null ? d.scholarAttRate + '%' : '—') + '**\n';
        msg += '👥 Unique Scholars: **' + d.uniqueScholarCount + '**\n';
        msg += '✅ Sessions Done: **' + d.myAttended + '**\n';
        msg += '📝 Survey Rate: **' + (d.surveyRate !== null ? d.surveyRate + '%' : '—') + '**\n';
        if (d.stuSurveyAvg !== null) msg += '⭐ Scholar Survey Avg: **' + d.stuSurveyAvg + '/5**\n';
        if (d.tutorSchool) msg += '\n📍 Site: **' + d.tutorSchool + '**' + (d.tutorDistrict ? ' · ' + d.tutorDistrict : '');
        var recentNR = (d.notRecordedSessions || []).filter(function(s){ return s.recent; }).length;
        var recentMS = (d.missingSurveys || []).filter(function(s){ return s.recent; }).length;
        if (recentNR + recentMS > 0) msg += '\n\n⚠ **' + (recentNR + recentMS) + ' action item' + (recentNR + recentMS > 1 ? 's' : '') + '** need your attention.';
        return msg;
      }
    },

    // ── Expectations / policies ────────────────────────────────────────────────
    { match: /expectation|policy|what.*expected|what.*required|requirement|\bgoal\b/i,
      respond: function() {
        return '📋 **NJTC Onsite Expectations**\n\n• **Attendance:** 90%+ (yours and your scholars\')\n• **Surveys:** 100% — submit an instructor survey after every session\n• **Pearl:** Record attendance the same day as your session\n• **Scholars:** Engage every scholar, flag concerns in survey comments\n• **Communication:** Notify your site leader of any issues\n\nYour dashboard shows all of these metrics in real time.';
      }
    },

    // ── Thank you ──────────────────────────────────────────────────────────────
    { match: /thank|thanks|appreciate|helpful/i,
      respond: function() {
        return 'Happy to help! 🦊 I\'m always here if you have more questions. Keep up the great work with your scholars!';
      }
    }
  ];

  // ── Route query: rules first, then sheet search, then default ──────────────
  function connorRoute(q) {
    var trimmed = q.trim();
    if (!trimmed) return null;

    // 1. Try built-in rules
    for (var i = 0; i < RULES.length; i++) {
      if (RULES[i].match.test(trimmed)) {
        var ans = RULES[i].respond(trimmed);
        if (ans !== null) return ans;
      }
    }

    // 2. Try sheet Q&A search
    var sheetMatch = searchSheetQA(trimmed);
    if (sheetMatch) {
      return 'From the **Ask Connor** knowledge base:\n\n' + renderSheetResult(sheetMatch);
    }

    // 3. Default fallback
    var kbHint = _sheetQA.length > 0 ? ' I also searched the Ask Connor knowledge base (' + _sheetQA.length + ' resources) but couldn\'t find a strong match.' : '';
    return '🦊 Hmm, I\'m not sure about that one!' + kbHint + '\n\nTry asking me about:\n• **Your attendance, scholars, or surveys**\n• **iReady** — placement levels, growth, BOY/EOY\n• **Pearl** — recording attendance, submitting surveys\n• **Definitions** — "What is a service interruption?"\n\nOr type **"glossary"** to see all terms.';
  }

  // ── Markdown → HTML ─────────────────────────────────────────────────────────
  function connorMarkdown(text) {
    return text
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/_(.+?)_/g, '<em>$1</em>')
      .replace(/\n•/g, '\n<span style="color:#FFB81C">•</span>')
      .replace(/\n/g, '<br>');
  }

  function escapeHtml(s) {
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  // ── State ───────────────────────────────────────────────────────────────────
  var _open = false;
  var _thinking = false;

  // ── Quick chips ─────────────────────────────────────────────────────────────
  var CHIP_SETS = {
    start: [
      { label: 'My dashboard summary',   q: 'Give me my dashboard summary' },
      { label: 'My action items',        q: 'What are my action items?' },
      { label: 'What is iReady?',        q: 'Tell me about iReady' },
      { label: 'Attendance rate',        q: 'What is attendance rate?' },
    ],
    followup: [
      { label: 'My scholars',            q: 'How many scholars do I have?' },
      { label: 'Survey rate',            q: 'What is my survey rate?' },
      { label: 'Service interruptions',  q: 'What is a service interruption?' },
      { label: 'Glossary',               q: 'Show me the glossary' },
    ]
  };

  // ── DOM helpers ─────────────────────────────────────────────────────────────
  function $(id) { return document.getElementById(id); }

  function connorScrollBottom() {
    var msgs = $('connor-msgs');
    if (msgs) msgs.scrollTop = msgs.scrollHeight;
  }

  function connorAddMsg(role, html, isTyping) {
    var msgs = $('connor-msgs');
    if (!msgs) return;
    var wrap = document.createElement('div');
    wrap.className = 'connor-msg ' + role;
    if (isTyping) {
      wrap.id = 'connor-typing-indicator';
      wrap.innerHTML = '<div class="connor-msg-avatar">' + CONNOR_AVATAR + '</div>' +
        '<div class="connor-typing"><span></span><span></span><span></span></div>';
    } else if (role === 'bot') {
      wrap.innerHTML = '<div class="connor-msg-avatar">' + CONNOR_AVATAR + '</div>' +
        '<div class="connor-msg-bubble">' + connorMarkdown(html) + '</div>';
    } else {
      wrap.innerHTML = '<div class="connor-msg-bubble">' + escapeHtml(html) + '</div>';
    }
    msgs.appendChild(wrap);
    connorScrollBottom();
    return wrap;
  }

  function connorRemoveTyping() {
    var el = $('connor-typing-indicator');
    if (el) el.remove();
  }

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

  // ── Send a message ──────────────────────────────────────────────────────────
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

    var delay = 150 + Math.random() * 300;
    setTimeout(function() {
      connorRemoveTyping();
      var answer = connorRoute(text);
      // answer might contain raw HTML from sheet card — handle both cases
      var msgs = $('connor-msgs');
      if (msgs) {
        var wrap = document.createElement('div');
        wrap.className = 'connor-msg bot';
        var bubble = document.createElement('div');
        bubble.className = 'connor-msg-bubble';
        if (answer && answer.indexOf('<div class="connor-sheet-card">') !== -1) {
          // Contains rendered HTML — split plain text prefix from card HTML
          var cardIdx = answer.indexOf('<div class="connor-sheet-card">');
          var prefix = answer.substring(0, cardIdx);
          bubble.innerHTML = connorMarkdown(prefix) + answer.substring(cardIdx);
        } else {
          bubble.innerHTML = connorMarkdown(answer || '');
        }
        wrap.innerHTML = '<div class="connor-msg-avatar">' + CONNOR_AVATAR + '</div>';
        wrap.appendChild(bubble);
        msgs.appendChild(wrap);
      }
      _thinking = false;
      if (send) send.disabled = false;
      connorScrollBottom();
    }, delay);
  }

  // ── Toggle ───────────────────────────────────────────────────────────────────
  function connorToggle() {
    _open = !_open;
    var chat = $('connor-chat');
    var fab  = $('connor-fab');
    if (chat) chat.classList.toggle('open', _open);
    if (fab)  fab.classList.toggle('open', _open);
    if (_open) {
      var msgs = $('connor-msgs');
      if (msgs && msgs.children.length === 0) {
        var u = window._connorUser;
        var name = u ? (u.name || '').split(' ')[0] : '';
        var greeting = name
          ? 'Hey ' + name + '! 🦊 I\'m **Connor**, your NJTC program assistant.\n\nAsk me about your dashboard data, program definitions, Pearl, iReady, or anything else!'
          : 'Hey there! 🦊 I\'m **Connor** — your NJTC program assistant.\n\nAsk me about your attendance, scholars, surveys, iReady, or any program terms!';
        setTimeout(function() { connorAddMsg('bot', greeting); }, 150);
      }
      connorSetChips('start');
      setTimeout(function() {
        var input = $('connor-input');
        if (input) input.focus();
      }, 300);
    }
  }

  // ── Definition panel ────────────────────────────────────────────────────────
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

  // ── Build DOM ───────────────────────────────────────────────────────────────
  function connorBuild() {
    var style = document.createElement('style');
    style.textContent = CSS;
    document.head.appendChild(style);

    var fabWrap = document.createElement('div');
    fabWrap.id = 'connor-fab-wrap';

    var fab = document.createElement('button');
    fab.id = 'connor-fab';
    fab.setAttribute('aria-label', 'Open Connor — NJTC Program Assistant');
    fab.innerHTML =
      '<div class="connor-fab-avatar">' + CONNOR_AVATAR + '</div>' +
      '<span>Ask Connor 🦊</span>' +
      '<div class="connor-fab-dot"></div>';
    fab.addEventListener('click', connorToggle);
    fabWrap.appendChild(fab);

    var chat = document.createElement('div');
    chat.id = 'connor-chat';
    chat.setAttribute('role', 'dialog');
    chat.setAttribute('aria-label', 'Connor — NJTC Program Assistant');
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

    var input = $('connor-input');
    var sendBtn = $('connor-send-btn');
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

  // ── Definition badges on KPI tiles ─────────────────────────────────────────
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
      var txt = el.textContent.trim();
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

  // ── Init ────────────────────────────────────────────────────────────────────
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
