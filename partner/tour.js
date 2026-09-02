/* ============================================================================
   NJTC PARTNER DASHBOARD — GUIDED TOUR
   A PIE-narrated walkthrough of the dashboard, replayable anytime via the
   "Guide Me" nav button (or PIE's "Show me around" quick question). Offered
   automatically once per browser on first visit, never forced again.
   ============================================================================ */
(function () {
  'use strict';

  const STORAGE_KEY = 'njtc_partner_tour_seen_v1';

  const STEPS = [
    { tab: 'summary', target: '.pt-hero', title: 'Welcome to your dashboard', text: "This is your school's own view of NJTC tutoring data — attendance and survey results, scoped to your program only. Let's take a quick look around." },
    { tab: 'summary', target: '#tourKpis', title: 'The four numbers that matter most', text: "Scholar Attendance Rate excludes excused time (school events, testing, staffing gaps) so it's never unfairly pulled down. \"Scholars to Check In With\" flags real patterns worth a conversation." },
    { tab: 'summary', target: '#tourHighlights', title: 'Session Highlights', text: 'A curated set of positive comments from scholars and tutors — a highlight reel, not a full transcript.' },
    { tab: 'attendance', target: '#tourCheckin', title: 'Who might need a check-in', text: 'Click any name here to see exactly which sessions were missed and why — always something on the school side, never an NJTC staffing issue.' },
    { tab: 'attendance', target: '.pt-tabs', title: 'Survey details, one tab over', text: 'Scholar Survey Details and Tutor Survey Details break down how sessions actually felt, question by question.' },
    { tab: 'summary', target: '#glossaryBtn', title: "Not sure what a term means?", text: 'The Glossary explains every metric in plain language, including how it\'s calculated. I can explain any of it too — just ask.' }
  ];

  let idx = 0;
  let active = false;

  function $(sel) { return document.querySelector(sel); }

  function switchTab(tabName) {
    const tab = document.querySelector(`.pt-tab[data-view="${tabName}"]`);
    if (tab && !tab.classList.contains('active')) tab.click();
  }

  function position(target) {
    const backdrop = document.getElementById('tourBackdrop');
    const spotlight = document.getElementById('tourSpotlight');
    const card = document.getElementById('tourCard');
    const el = document.querySelector(target);
    if (!el) return false;

    el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    // Give scroll a beat to settle before measuring.
    setTimeout(() => {
      // #tourBackdrop (the containing block for these two, as the nearest
      // positioned ancestor) is itself position:fixed and pinned to the
      // viewport — so getBoundingClientRect()'s viewport-relative coordinates
      // ARE the correct left/top already. Adding window.scrollX/scrollY here
      // double-counts scroll and pushes the spotlight/card off whatever the
      // current viewport is — invisible below the fold — the moment an
      // earlier step's scrollIntoView() has scrolled the page at all.
      const r = el.getBoundingClientRect();
      const pad = 8;
      spotlight.style.left = (r.left - pad) + 'px';
      spotlight.style.top = (r.top - pad) + 'px';
      spotlight.style.width = (r.width + pad * 2) + 'px';
      spotlight.style.height = (r.height + pad * 2) + 'px';

      const cardW = 320;
      let cardLeft = r.left;
      if (cardLeft + cardW > document.documentElement.clientWidth - 16) {
        cardLeft = document.documentElement.clientWidth - cardW - 16;
      }
      let cardTop = r.bottom + 14;
      if (cardTop + 180 > window.innerHeight) cardTop = r.top - 190;
      card.style.left = Math.max(16, cardLeft) + 'px';
      card.style.top = Math.max(16, cardTop) + 'px';
    }, 260);
    return true;
  }

  const PIE_AVATAR = `<svg viewBox="0 0 48 48" style="width:100%;height:100%"><circle cx="24" cy="24" r="24" fill="#0a1628"/>
    <path d="M24 6a18 18 0 0 1 18 18H24Z" fill="#f0a500"/>
    <path d="M24 24 6 24a18 18 0 0 1 9-15.6Z" fill="#ffd166"/>
    <path d="M24 24 6 24a18 18 0 0 0 27 15.6Z" fill="#1a7aff"/>
    <circle cx="24" cy="24" r="4" fill="#fff"/></svg>`;

  function render() {
    const step = STEPS[idx];
    if (!step) { end(); return; }
    switchTab(step.tab);
    // Let the tab switch paint before we measure the target.
    setTimeout(() => {
      if (!position(step.target)) { idx++; render(); return; }
      const card = document.getElementById('tourCard');
      card.innerHTML = `
        <div id="tourCard-head"><span class="pie-avatar">${PIE_AVATAR}</span><b>PIE</b></div>
        <div id="tourCard-title">${step.title}</div>
        <div id="tourCard-text">${step.text}</div>
        <div id="tourCard-foot">
          <span id="tourCard-progress">${idx + 1} of ${STEPS.length}</span>
          <span id="tourCard-btns">
            <button class="pt-tour-btn pt-tour-skip" id="tourSkip">Skip</button>
            <button class="pt-tour-btn pt-tour-next" id="tourNext">${idx === STEPS.length - 1 ? 'Done' : 'Next'}</button>
          </span>
        </div>`;
      document.getElementById('tourSkip').addEventListener('click', end);
      document.getElementById('tourNext').addEventListener('click', () => { idx++; render(); });
    }, 60);
  }

  function start() {
    if (active) return;
    active = true;
    idx = 0;
    document.getElementById('tourBackdrop').classList.add('open');
    render();
  }

  function end() {
    active = false;
    document.getElementById('tourBackdrop').classList.remove('open');
    try { localStorage.setItem(STORAGE_KEY, '1'); } catch (e) {}
  }

  window.NJTCTour = { start };

  document.addEventListener('partnerBundleReady', () => {
    let seen = null;
    try { seen = localStorage.getItem(STORAGE_KEY); } catch (e) {}
    if (!seen) setTimeout(start, 900); // let the dashboard finish painting first
  });
})();
