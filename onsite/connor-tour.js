/* ============================================================================
   NJTC ONSITE PORTAL — GUIDED TOUR
   A Connor-narrated walkthrough of the onsite portal, replayable anytime via
   the "🧭 Guide Me" header button or by asking Connor for a tour. Offered
   automatically once per browser after a staff member's first login, never
   forced again. Mirrors partner/tour.js's pattern.
   ============================================================================ */
(function () {
  'use strict';

  const STORAGE_KEY = 'njtc_onsite_tour_seen_v1';

  const STEPS = [
    { tab: 'dashboard', target: '.njtc-ph-identity', title: "Welcome to the NJTC Portal", text: "I'm Connor — I'll walk you through what's here in a few quick steps. You can skip anytime, and I'm always available afterward if you have questions." },
    { tab: 'dashboard', target: '#njtcDashContent', title: 'Your Dashboard', text: "This is your live data — attendance, sessions, and scholars — pulled straight from Pearl. Scholars flagged with a ⚠ have a consecutive absence concern worth a check-in." },
    { tab: 'dashboard', target: '#connor-fab-wrap', title: "I'm always one click away", text: "Ask me about any scholar, your attendance trend, iReady growth, or what a term means — day or night. Try \"Who needs support?\" or \"What is a consecutive concern?\"" },
    { tab: 'platforms', target: '.platforms-grid', title: 'Your Platforms', text: 'Quick links to everything you use day-to-day — Pearl for attendance and surveys, i-Ready for diagnostics, Knowtion for your team, and me. Each card has an ℹ️ button with a full how-to guide.' },
    { tab: 'team', target: '#njtcTeamContainer', title: 'My Team', text: "As a site leader, this is your team view — tutor profiles, attendance, and any flagged concerns across your site, all in one place.", condition: leaderTabVisible },
    { tab: 'resources', target: '.support-section', title: 'Know who to contact', text: "This portal is meant to answer most questions on its own — check here or ask me first. When something needs a real person, your Onsite Leader is your first stop, then your Program Manager." }
  ];

  const CONNOR_AVATAR = `<svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:100%;">
    <circle cx="24" cy="24" r="24" fill="#001a33"/>
    <polygon points="11,21 7,5 20,15" fill="#FFB81C"/>
    <polygon points="37,21 41,5 28,15" fill="#FFB81C"/>
    <circle cx="24" cy="24" r="14" fill="#FFB81C"/>
    <ellipse cx="24" cy="28" rx="8" ry="7" fill="#fff9ee"/>
    <ellipse cx="19.5" cy="22" rx="3.2" ry="3.5" fill="#001a33"/>
    <ellipse cx="28.5" cy="22" rx="3.2" ry="3.5" fill="#001a33"/>
    <ellipse cx="24" cy="27" rx="2.2" ry="1.6" fill="#001a33"/>
  </svg>`;

  let idx = 0;
  let active = false;

  function leaderTabVisible() {
    const tab = document.getElementById('njtcTeamTab');
    return !!tab && tab.style.display !== 'none';
  }

  function position(target) {
    const backdrop = document.getElementById('tourBackdrop');
    const spotlight = document.getElementById('tourSpotlight');
    const card = document.getElementById('tourCard');
    const el = document.querySelector(target);
    if (!backdrop || !spotlight || !card || !el) return false;

    el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    setTimeout(() => {
      // #tourBackdrop (the containing block for these two, since it's the
      // nearest positioned ancestor) is itself position:fixed and pinned to
      // the viewport — so getBoundingClientRect()'s viewport-relative
      // coordinates ARE the correct left/top already. Adding window.scrollX/
      // scrollY here double-counts scroll and pushes the spotlight/card off
      // whatever the current viewport is — invisible below the fold the
      // moment an earlier step's scrollIntoView() has scrolled the page at
      // all (reliably reproduced: after step 2 scrolls ~790px to center a
      // tall dashboard, step 3's card computed to top:1328px against an
      // 800px-tall viewport — exactly the "stuck, nothing happens" bug).
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

  function render() {
    const step = STEPS[idx];
    if (!step) { end(); return; }
    if (typeof step.condition === 'function' && !step.condition()) { idx++; render(); return; }
    if (typeof switchTab === 'function') switchTab(step.tab);
    setTimeout(() => {
      if (!position(step.target)) { idx++; render(); return; }
      const card = document.getElementById('tourCard');
      card.innerHTML = `
        <div id="tourCard-head"><span class="connor-tour-avatar">${CONNOR_AVATAR}</span><b>Connor</b></div>
        <div id="tourCard-title">${step.title}</div>
        <div id="tourCard-text">${step.text}</div>
        <div id="tourCard-foot">
          <span id="tourCard-progress">${idx + 1} of ${STEPS.length}</span>
          <span id="tourCard-btns">
            <button class="njtc-tour-btn njtc-tour-skip" id="tourSkip">Skip</button>
            <button class="njtc-tour-btn njtc-tour-next" id="tourNext">${idx === STEPS.length - 1 ? 'Done' : 'Next'}</button>
          </span>
        </div>`;
      document.getElementById('tourSkip').addEventListener('click', end);
      document.getElementById('tourNext').addEventListener('click', () => { idx++; render(); });
    }, 60);
  }

  function start() {
    if (active) return;
    // A chat panel open behind the spotlight is confusing — close it first.
    if (window.connorToggle && document.getElementById('connor-chat') &&
        document.getElementById('connor-chat').classList.contains('open')) {
      window.connorToggle();
    }
    active = true;
    idx = 0;
    document.getElementById('tourBackdrop').classList.add('open');
    render();
  }

  function end() {
    active = false;
    const backdrop = document.getElementById('tourBackdrop');
    if (backdrop) backdrop.classList.remove('open');
    try { localStorage.setItem(STORAGE_KEY, '1'); } catch (e) {}
  }

  window.NJTCConnorTour = { start };

  const tourBtn = document.getElementById('tourBtn');
  if (tourBtn) tourBtn.addEventListener('click', start);

  // Clicking the dimmed backdrop (not the card, not the spotlight cutout —
  // spotlight has pointer-events:none so clicks there land on the backdrop
  // too) ends the tour, so a user who navigates away mid-tour without
  // hitting Skip/Done doesn't leave `active` stuck true and Guide Me dead.
  const backdropEl = document.getElementById('tourBackdrop');
  if (backdropEl) backdropEl.addEventListener('click', (e) => { if (e.target === backdropEl) end(); });

  // ── Auto-offer once per browser, after login — but never behind the daily
  // acknowledgement gate, which blocks interaction until it's resolved.
  function waitForAckGateThenOffer() {
    let seen = null;
    try { seen = localStorage.getItem(STORAGE_KEY); } catch (e) {}
    if (seen) return;

    let waited = 0;
    const poll = setInterval(() => {
      waited += 500;
      const ackOpen = document.getElementById('njtc-ack-modal') || document.getElementById('njtc-locked-modal');
      if (ackOpen && waited < 30000) return; // still gated — keep waiting
      clearInterval(poll);
      if (document.getElementById('njtc-locked-modal')) return; // access locked today — don't pile on
      setTimeout(start, 700);
    }, 500);
  }

  document.addEventListener('userProfileReady', () => setTimeout(waitForAckGateThenOffer, 800));
})();
