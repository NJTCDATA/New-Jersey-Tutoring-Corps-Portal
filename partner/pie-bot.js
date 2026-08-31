/* ============================================================================
   PIE — NJTC Partner Dashboard Assistant
   Rule-based helper (no external API, no per-message cost) that explains the
   dashboard and answers questions using the partner's own already-loaded
   bundle (window.NJTC_BUNDLE). Modeled on onsite/connor-bot.js.
   ============================================================================ */
(function () {
  'use strict';

  const ATT  = { ROLE:1, ATT_STATUS:6, MISS_REASON:7, USER:0, SESSION:2, USER_ID:13, CONSEC_STATUS:24 };
  const STU  = { OVERALL:5, COMMENT:6 };
  const INST = { OVERALL:5, COMMENT_SELF:7 };

  const SCHOLAR_MISS_REASONS = new Set([
    'Absent', 'Scholar declined attending tutoring session',
    'Classroom Teacher Requested to Keep Scholar in Class',
    'HADDON TWP ONLY -- Teacher requested whole group support', 'Scholar Left Early'
  ]);
  const TUTOR_MISS_REASONS = new Set([
    'Absent; Not Covered (Tutor not available)', 'Absent; Covered by Sub Tutor',
    'Absent; Covered by Dual Role', 'Absent; Covered by the Site Leader',
    'Absent; Covered by the Instructional Coach', 'Tutor Left Early (no sub)'
  ]);

  const CSS = `
    #pie-fab-wrap{position:fixed;bottom:1.5rem;right:1.5rem;z-index:9000}
    #pie-fab{display:flex;align-items:center;gap:.5rem;background:linear-gradient(135deg,#f0a500,#c07a00);color:#0a1628;border:none;border-radius:3rem;padding:.6rem 1.1rem .6rem .5rem;font-family:'DM Sans',sans-serif;font-size:.875rem;font-weight:800;cursor:pointer;box-shadow:0 4px 24px rgba(240,165,0,.45),0 2px 8px rgba(0,0,0,.25);transition:transform .2s,box-shadow .2s}
    #pie-fab:hover{transform:translateY(-3px);box-shadow:0 8px 32px rgba(240,165,0,.6)}
    #pie-fab.open{background:linear-gradient(135deg,#0a1628,#003087);color:#f0a500}
    #pie-fab .pie-avatar{width:32px;height:32px;flex-shrink:0}
    #pie-panel{position:fixed;bottom:5.2rem;right:1.5rem;width:360px;max-width:calc(100vw - 2rem);height:min(520px,70vh);background:#fff;border-radius:1.25rem;box-shadow:0 24px 64px rgba(10,22,40,.28);display:none;flex-direction:column;overflow:hidden;z-index:9001;border:1px solid #dde3ec}
    #pie-panel.open{display:flex}
    #pie-head{background:linear-gradient(135deg,#0a1628,#003087);color:#fff;padding:.9rem 1.1rem;display:flex;align-items:center;gap:.6rem}
    #pie-head .pie-avatar{width:30px;height:30px}
    #pie-head-text b{font-size:.85rem;display:block}
    #pie-head-text span{font-size:.68rem;color:rgba(255,255,255,.6)}
    #pie-body{flex:1;overflow-y:auto;padding:.9rem;background:#f6f8fc;display:flex;flex-direction:column;gap:.6rem}
    .pie-msg{max-width:85%;padding:.6rem .8rem;border-radius:.8rem;font-size:.82rem;line-height:1.45}
    .pie-msg.bot{background:#fff;border:1px solid #eef1f6;align-self:flex-start;color:#0d1b2a}
    .pie-msg.user{background:#003087;color:#fff;align-self:flex-end}
    .pie-chips{display:flex;flex-wrap:wrap;gap:.4rem;padding:0 .9rem .7rem}
    .pie-chip{background:#fff;border:1px solid #dde3ec;border-radius:999px;padding:.35rem .7rem;font-size:.72rem;font-weight:600;color:#003087;cursor:pointer}
    .pie-chip:hover{background:#eef1f6}
    #pie-input-row{display:flex;gap:.5rem;padding:.7rem;border-top:1px solid #eef1f6;background:#fff}
    #pie-input{flex:1;border:1px solid #dde3ec;border-radius:.7rem;padding:.55rem .7rem;font-size:.82rem;font-family:inherit;outline:none}
    #pie-input:focus{border-color:#0050c8}
    #pie-send{background:#0050c8;color:#fff;border:none;border-radius:.7rem;padding:0 1rem;font-weight:700;cursor:pointer;font-size:.85rem}
  `;

  const AVATAR = `<svg viewBox="0 0 48 48" style="width:100%;height:100%"><circle cx="24" cy="24" r="24" fill="#0a1628"/>
    <path d="M24 6a18 18 0 0 1 18 18H24Z" fill="#f0a500"/>
    <path d="M24 24 6 24a18 18 0 0 1 9-15.6Z" fill="#ffd166"/>
    <path d="M24 24 6 24a18 18 0 0 0 27 15.6Z" fill="#1a7aff"/>
    <circle cx="24" cy="24" r="4" fill="#fff"/></svg>`;

  function injectStyles() { const s = document.createElement('style'); s.textContent = CSS; document.head.appendChild(s); }

  // Matches partner/app.js exactly — Late counts as Attended, Service
  // Interruptions are excluded from both the numerator and denominator, and
  // only scholar rows count (tutor staffing is an NJTC-internal concern,
  // never partner-facing). PIE must never quote a different number than the
  // dashboard it's sitting on top of.
  function classifyAtt(row) {
    const status = (row[ATT.ATT_STATUS] || '').trim();
    const reason = (row[ATT.MISS_REASON] || '').trim();
    const isInstructor = (row[ATT.ROLE] || '').trim() === 'Instructor';
    if (status === 'Attended' || status === 'Late') return 'attended';
    if (status === 'Missed') {
      if (isInstructor) return TUTOR_MISS_REASONS.has(reason) ? 'absent' : 'si';
      return (SCHOLAR_MISS_REASONS.has(reason) || reason === '') ? 'absent' : 'si';
    }
    return 'other';
  }

  function stats() {
    const b = window.NJTC_BUNDLE;
    if (!b) return null;
    const scholarRows = (b.attendance || []).filter(r => (r[ATT.ROLE] || '').trim() !== 'Instructor');
    let attended = 0, absent = 0;
    const flagged = new Set();
    scholarRows.forEach(r => {
      const c = classifyAtt(r);
      if (c === 'attended') attended++;
      else if (c === 'absent') absent++;
      if ((r[ATT.CONSEC_STATUS] || '').trim() === 'Attendance Concern') {
        const uid = (r[ATT.USER_ID] || '').trim();
        if (uid) flagged.add(uid);
      }
    });
    const total = attended + absent;
    const rate = total ? Math.round((attended / total) * 1000) / 10 : null;
    const sessions = new Set((b.attendance || []).map(r => r[ATT.SESSION]).filter(Boolean)).size;

    function sentiment(rows, col) {
      let pos = 0, neu = 0, neg = 0;
      rows.forEach(r => { const v = parseFloat(r[col]); if (isNaN(v)) return; if (v >= 4) pos++; else if (v === 3) neu++; else if (v >= 1) neg++; });
      const n = pos + neu + neg;
      return { pos, neu, neg, n, posPct: n ? Math.round(pos / n * 1000) / 10 : null, negPct: n ? Math.round(neg / n * 1000) / 10 : null };
    }

    return {
      identity: b.identity, rate, sessions, attended, absent, total, checkInCount: flagged.size,
      scholarSent: sentiment(b.scholarSurveys || [], STU.OVERALL),
      tutorSent: sentiment(b.tutorSurveys || [], INST.OVERALL),
      hasData: total > 0 || (b.scholarSurveys || []).length > 0 || (b.tutorSurveys || []).length > 0
    };
  }

  const QUICK_CHIPS = [
    "What's my attendance rate?",
    'How do I read the survey sentiment chart?',
    'What should I look at first?',
    "Who do I contact with questions?"
  ];

  function answer(question) {
    const s = stats();
    const q = (question || '').toLowerCase();

    if (!s || !s.hasData) {
      return "I don't see any Pearl attendance or survey data loaded for your school yet — either your program hasn't launched this year, or data is still syncing. Reach out to your NJTC Program Manager if you think this is wrong.";
    }

    if (/attendance rate|how am i doing|missed|absent|check.?in/.test(q)) {
      return `Your scholar attendance rate is currently <b>${s.rate == null ? 'not yet calculable' : s.rate + '%'}</b>, from ${s.total.toLocaleString()} logged scholar sessions across ${s.sessions.toLocaleString()} total sessions (${s.attended.toLocaleString()} attended, ${s.absent.toLocaleString()} missed). Excused time — school events, testing days, holidays — isn't counted against this. ${s.checkInCount ? `Right now <b>${s.checkInCount}</b> scholar${s.checkInCount === 1 ? '' : 's'} could use a check-in — see the "Scholars to Check In With" list on the Attendance Tracking tab.` : `No scholars are currently flagged for a check-in — nice.`}`;
    }
    if (/sentiment|positive|negative|survey|feel|enjoy/.test(q)) {
      const sc = s.scholarSent, tu = s.tutorSent;
      return `On scholar surveys, <b>${sc.posPct ?? '—'}%</b> of responses were Positive (rated 4–5), from ${sc.n} responses. On tutor surveys, ${tu.posPct ?? '—'}% Positive from ${tu.n} responses. "Positive/Neutral/Negative" is always based on the "Overall, how did this session go?" question — the smaller charts below it break down specific sub-questions (confidence, enjoyment, learning).`;
    }
    if (/first|start|where.*look|overview/.test(q)) {
      return `I'd start on <b>Summary</b> for the big picture (scholar attendance rate + how sessions are going), then <b>Attendance Tracking</b> if you want to see who might need a check-in or what week attendance dipped. The two Survey tabs are best read as a trend over time, not a single number.`;
    }
    if (/contact|help|support|program manager|who/.test(q)) {
      return `For anything specific to your school's tutoring program, your NJTC Program Manager is your best contact. For portal access issues (a login not working, wrong school showing), reach out to the NJTC Data Department.`;
    }
    if (/what.*mean|explain|definition/.test(q)) {
      return `Quick glossary: <b>Attended</b> = the session happened as planned. <b>Missed</b> = the scholar wasn't there for a scheduled session. <b>Positive/Neutral/Negative</b> = how the "Overall" survey question was rated (4–5 / 3 / 1–2). Everything on this dashboard is scoped to ${s.identity.district || 'your district'}${s.identity.schools && s.identity.schools[0] !== 'ALL' ? ' — ' + s.identity.schools.join(', ') : ''} only.`;
    }
    return `I can help with attendance rate, survey sentiment, where to start, or portal contacts — try one of the quick questions below, or ask me directly about a number you're seeing.`;
  }

  function buildUI() {
    const wrap = document.createElement('div');
    wrap.id = 'pie-fab-wrap';
    wrap.innerHTML = `<button id="pie-fab"><span class="pie-avatar">${AVATAR}</span>Ask PIE</button>`;
    document.body.appendChild(wrap);

    const panel = document.createElement('div');
    panel.id = 'pie-panel';
    panel.innerHTML = `
      <div id="pie-head"><span class="pie-avatar">${AVATAR}</span>
        <div id="pie-head-text"><b>PIE</b><span>Your NJTC data assistant</span></div>
      </div>
      <div id="pie-body"></div>
      <div class="pie-chips" id="pie-chips"></div>
      <div id="pie-input-row">
        <input id="pie-input" type="text" placeholder="Ask about your data…" autocomplete="off"/>
        <button id="pie-send">Send</button>
      </div>`;
    document.body.appendChild(panel);

    const fab = document.getElementById('pie-fab');
    const body = document.getElementById('pie-body');
    const chips = document.getElementById('pie-chips');
    const input = document.getElementById('pie-input');

    function addMsg(text, who) {
      const d = document.createElement('div');
      d.className = 'pie-msg ' + who;
      d.innerHTML = text;
      body.appendChild(d);
      body.scrollTop = body.scrollHeight;
    }

    function renderChips() {
      chips.innerHTML = '';
      QUICK_CHIPS.forEach(q => {
        const c = document.createElement('div');
        c.className = 'pie-chip';
        c.textContent = q;
        c.addEventListener('click', () => ask(q));
        chips.appendChild(c);
      });
    }

    function ask(q) {
      addMsg(q.replace(/</g, '&lt;'), 'user');
      setTimeout(() => addMsg(answer(q), 'bot'), 250);
    }

    let opened = false;
    fab.addEventListener('click', () => {
      opened = !opened;
      panel.classList.toggle('open', opened);
      fab.classList.toggle('open', opened);
      if (opened && !body.dataset.greeted) {
        body.dataset.greeted = '1';
        const s = stats();
        addMsg(s && s.hasData
          ? `Hi${s.identity && s.identity.name ? ', ' + s.identity.name.split(' ')[0] : ''}! I'm PIE. Ask me anything about the attendance or survey numbers on this dashboard.`
          : `Hi! I'm PIE. It looks like there's no Pearl data loaded for your school yet — once your program launches and data starts syncing, I can help you make sense of it.`, 'bot');
        renderChips();
      }
    });

    document.getElementById('pie-send').addEventListener('click', () => { const v = input.value.trim(); if (v) { input.value = ''; ask(v); } });
    input.addEventListener('keydown', e => { if (e.key === 'Enter') document.getElementById('pie-send').click(); });
  }

  function init() {
    injectStyles();
    buildUI();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
