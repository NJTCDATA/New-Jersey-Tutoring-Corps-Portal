/* ============================================================================
   NJTC ONSITE PORTAL — DATA SOURCES (single source of truth)
   ============================================================================
   Every Google Sheet ID/GID the onsite portal fetches from live, in one
   place, instead of duplicated as local consts in each consumer file. Before
   this file existed, PEARL_2PACX alone was copy-pasted identically into
   pearl-data.js, leader-team.js, and data/export-pearl-static.js — a rollover
   or key change meant hunting down every copy, with no error if one was
   missed (just quietly stale data on that one dashboard).

   Consumers: pearl-data.js, leader-team.js, my-dashboard.js, user-login.js,
   data/export-pearl-static.js (Node — see the module.exports branch below).
   Load this script BEFORE any of them.

   ── SCHOOL YEAR ROLLOVER ────────────────────────────────────────────────
   When SY26-27's Pearl/iReady workbooks exist, update ONLY the two blocks
   marked "SWAP AT SY ROLLOVER" below. Everything else (HR roster, Pearl
   Login/ID roster, Standards Mastery) is an evergreen org-level sheet that
   persists across school years and should NOT change at rollover.
   ============================================================================ */
(function (root) {
  'use strict';

  var NJTC_SOURCES = {

    // ── Pearl: attendance, surveys, sessions ── SWAP AT SY ROLLOVER ─────────
    PEARL_2PACX: '2PACX-1vQ1iC8NZFJt3iinGUEqftKtP32N43axi_JN_RQI36EBUdhZS0PaZRwd-1AJT3bEVe6cqHA0tCA3vb5K',
    PEARL_GIDS: {
      att:  '702726038',
      inst: '1955492004',
      stu:  '1245403832',
      sess: '625567780'
    },

    // ── iReady current-year (EOY Preliminary / Longitudinal) ── SWAP AT SY ROLLOVER ─
    IREADY_CURRENT_SHEET_ID: '1mCx6eFKscXA3y5Ox_JB9cSualR5Tw9MbKxBVN078_G0',
    IREADY_CURRENT_ELA_GID:  '1640935949',
    IREADY_CURRENT_MATH_GID: '1676366557',

    // ── Pearl Login/ID roster — staff name, email, Pearl username, school/district (evergreen) ──
    PEARL_LOGIN_2PACX: '2PACX-1vS2fgss4HiKpr61wJ2_si8klythckgGZ3yOYer4FSAdThkQz-X1cdL83xbgPBnHbMpTGPHZCtnttKRv',

    // ── HR roster — same sheet the central portal reads (evergreen) ────────
    HR_2PACX: '2PACX-1vRc-Air9jhOtvkVelwfvOguzAyFmGIFpQ0sDtu4q8S5kFAgQz_IZo-XBeIfQgy4GB8OdSXoyonTeLT8',
    HR_GID: '911694457',

    // ── Standards Mastery — Middlesex STEM + SM schools (evergreen) ────────
    SM_SHEET_ID: '1__l9A4hyX_-4veVUP606sN9rYg9Fa0hE',
    SM_GID: '457164791'
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = NJTC_SOURCES; // Node — data/export-pearl-static.js
  } else {
    root.NJTC_SOURCES = NJTC_SOURCES; // browser
  }
})(typeof window !== 'undefined' ? window : this);
