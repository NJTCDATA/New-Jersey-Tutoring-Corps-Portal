/* ============================================================================
   NJTC PARTNER DASHBOARD — GUIDED TOUR
   A PIE-narrated walkthrough of the dashboard, replayable anytime via the
   "Guide Me" nav button (or PIE's "Show me around" quick question). Offered
   automatically once per browser on first visit, never forced again.
   ============================================================================ */
(function () {
  'use strict';

  const STORAGE_KEY = 'njtc_partner_tour_seen_v2'; // v2: new district/school tour

  // Two lenses: district partners (several schools) and school partners.
  const DISTRICT_STEPS = [
    { tab: 'summary', target: '.pt-hero', title: 'Welcome to your district view', text: 'This page shows NJTC tutoring across all of your schools. Your NJTC contacts are on the right; click a name to email them.' },
    { tab: 'summary', target: '#tourAttention', title: 'Start here', text: 'The few things worth your attention right now: schools below the 80% attendance goal, scholars kept in class during tutoring, and scholars to check in with.' },
    { tab: 'summary', target: '#tourSchools', title: 'Every school at a glance', text: 'One box per school. Click a school to open its full view, then a scholar for their detail. Use "All schools" to come back.' },
    { tab: 'summary', target: '#tourKpis', title: 'District totals', text: 'Scholar Attendance Rate leaves out excused time (school events, testing, NJTC staffing gaps), so it is never unfairly pulled down.' },
    { tab: 'summary', target: '#pdfBtn', title: 'Weekly PDF', text: 'Download a printable weekly report for the district or for any one school.' },
    { tab: 'summary', target: '#glossaryBtn', title: 'Not sure what a term means?', text: 'The Glossary explains every number in plain language. You can also ask me any time.' }
  ];
  const SCHOOL_STEPS = [
    { tab: 'summary', target: '.pt-hero', title: 'Welcome to your school view', text: "This is your school's NJTC tutoring data. Your NJTC contacts are on the right; click a name to email them." },
    { tab: 'summary', target: '#tourAttention', title: 'Start here', text: 'The few things worth your attention right now, with a link straight to the detail.' },
    { tab: 'summary', target: '#tourKpis', title: 'The four numbers that matter most', text: 'Scholar Attendance Rate leaves out excused time (school events, testing, NJTC staffing gaps), so it is never unfairly pulled down.' },
    { tab: 'attendance', target: '#tourCheckin', title: 'Who might need a check-in', text: 'Lowest attendance first, 10 at a time. Click a name to see which sessions were missed and why.' },
    { tab: 'attendance', target: '#tourKept', title: 'Kept in class during tutoring', text: 'Scholars a classroom teacher kept in class during tutoring. Each one is a missed tutoring session.' },
    { tab: 'summary', target: '#glossaryBtn', title: 'Not sure what a term means?', text: 'The Glossary explains every number in plain language. You can also ask me any time.' }
  ];
  let STEPS = SCHOOL_STEPS;


  let idx = 0;
  let active = false;

  function $(sel) { return document.querySelector(sel); }

  function switchTab(tabName) {
    const tab = document.querySelector(`.pt-tab[data-view="${tabName}"]`);
    if (tab && !tab.classList.contains('active')) tab.click();
  }

  // Measure + place the spotlight and card. #tourBackdrop is position:fixed,
  // so getBoundingClientRect() coordinates are already correct as-is.
  function place(el) {
    const spotlight = document.getElementById('tourSpotlight');
    const card = document.getElementById('tourCard');
    const W = document.documentElement.clientWidth, H = window.innerHeight;
    const r = el.getBoundingClientRect();
    const pad = 8;
    const top = Math.max(4, r.top - pad), bottom = Math.min(H - 4, r.bottom + pad);
    spotlight.style.left = (r.left - pad) + 'px';
    spotlight.style.top = top + 'px';
    spotlight.style.width = (r.width + pad * 2) + 'px';
    spotlight.style.height = Math.max(0, bottom - top) + 'px';

    const cw = card.offsetWidth || 320, ch = card.offsetHeight || 190;
    let left = Math.min(r.left, W - cw - 16);
    let cardTop;
    if (bottom + 14 + ch <= H - 8) cardTop = bottom + 14;          // below
    else if (top - 14 - ch >= 8) cardTop = top - 14 - ch;          // above
    else {                                                         // tall target: dock to the corner with the most room
      cardTop = H - ch - 16;
      left = (r.left > W - r.right) ? 16 : W - cw - 16;
    }
    card.style.left = Math.max(16, left) + 'px';
    card.style.top = Math.max(16, Math.min(cardTop, H - ch - 16)) + 'px';
  }

  let placeTimers = [];
  function position(target) {
    const el = document.querySelector(target);
    if (!el || !el.getClientRects().length) return false;
    // Instant scroll so we never measure mid-animation. Tall blocks align to
    // the top so their heading stays in view; everything else centers.
    const tall = el.getBoundingClientRect().height > window.innerHeight * 0.6;
    el.scrollIntoView({ block: tall ? 'start' : 'center', behavior: 'auto' });
    if (tall) {
      // Clear the sticky nav, tabs and drill-down bar so the heading shows.
      let stick = 0;
      document.querySelectorAll('.pt-nav, .pt-tabs, .pt-scope-bar').forEach(n => {
        const b = n.getBoundingClientRect();
        if (b.height && b.top < 200) stick = Math.max(stick, b.bottom);
      });
      window.scrollBy(0, -(stick + 12));
    }
    placeTimers.forEach(clearTimeout);
    placeTimers = [0, 120, 450].map(ms => setTimeout(() => { if (active) place(el); }, ms));
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
      const el = document.querySelector(step.target);
      if (!el || !el.getClientRects().length) { idx++; render(); return; }
      const card = document.getElementById('tourCard');
      const last = idx === STEPS.length - 1;
      card.innerHTML = `
        <div id="tourCard-head"><span class="pie-avatar">${PIE_AVATAR}</span><b>PIE</b></div>
        <div id="tourCard-title">${step.title}</div>
        <div id="tourCard-text">${step.text}</div>
        <div id="tourCard-foot">
          <span id="tourCard-progress">${idx + 1} of ${STEPS.length}</span>
          <span id="tourCard-btns">
            ${idx > 0 ? '<button class="pt-tour-btn pt-tour-skip" id="tourBack">Back</button>' : '<button class="pt-tour-btn pt-tour-skip" id="tourSkip">Skip</button>'}
            <button class="pt-tour-btn pt-tour-next" id="tourNext">${last ? 'Done' : 'Next'}</button>
          </span>
        </div>`;
      const skip = document.getElementById('tourSkip'), back = document.getElementById('tourBack');
      if (skip) skip.addEventListener('click', end);
      if (back) back.addEventListener('click', prev);
      document.getElementById('tourNext').addEventListener('click', next);
      position(step.target);
    }, 60);
  }
  function next() { idx++; render(); }
  function prev() { if (idx > 0) { idx--; render(); } }

  function start() {
    if (active) return;
    const all = (window.NJTCPartnerNav && window.NJTCPartnerNav.isDistrictLens()) ? DISTRICT_STEPS : SCHOOL_STEPS;
    // Only number the steps this partner can actually see (e.g. a school with
    // no kept-in-class scholars has no #tourKept panel).
    STEPS = all.filter(st => document.querySelector(st.target));
    if (!STEPS.length) return;
    active = true;
    idx = 0;
    document.getElementById('tourBackdrop').classList.add('open');
    render();
  }

  function end() {
    active = false;
    placeTimers.forEach(clearTimeout);
    document.getElementById('tourBackdrop').classList.remove('open');
    switchTab('summary');
    try { localStorage.setItem(STORAGE_KEY, '1'); } catch (e) {}
  }

  document.addEventListener('keydown', e => {
    if (!active) return;
    if (e.key === 'Escape') end();
    else if (e.key === 'ArrowRight') next();
    else if (e.key === 'ArrowLeft') prev();
  });
  window.addEventListener('resize', () => {
    if (!active || !STEPS[idx]) return;
    const el = document.querySelector(STEPS[idx].target);
    if (el) place(el);
  });

  window.NJTCTour = { start };

  document.addEventListener('partnerBundleReady', () => {
    let seen = null;
    try { seen = localStorage.getItem(STORAGE_KEY); } catch (e) {}
    if (!seen) setTimeout(start, 900); // let the dashboard finish painting first
  });
})();
