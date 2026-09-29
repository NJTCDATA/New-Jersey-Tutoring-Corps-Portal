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
   At each rollover update ONLY the blocks marked "SWAP AT SY ROLLOVER"
   below (Pearl rolled to SY 26-27 on 2026-09-29; iReady stays on the 25-26
   workbook until SY 26-27 diagnostics exist). Everything else (HR roster, Pearl
   Login/ID roster, Standards Mastery) is an evergreen org-level sheet that
   persists across school years and should NOT change at rollover.
   ============================================================================ */
(function (root) {
  'use strict';

  var NJTC_SOURCES = {

    // ── Pearl: attendance, surveys, sessions ── SWAP AT SY ROLLOVER ─────────
    // SY 26-27 (live): "Automate: SY 26 - 27 Pearl Attendance and Surveys".
    // Read by sheet ID via the CSV export endpoint (sheet is link-shared), so
    // there is no published 2PACX key this year. PEARL_KEY identifies the
    // active workbook everywhere (static-snapshot manifest check included).
    PEARL_SHEET_ID: '1y_g5cl4qT2qeUmuO0aeBhURAbXsuGIusgqLiBWOUDLM',
    PEARL_KEY:      '1y_g5cl4qT2qeUmuO0aeBhURAbXsuGIusgqLiBWOUDLM',
    PEARL_2PACX:    null,
    PEARL_GIDS: {
      att:  '702726038',  // Missed Reasons (per-attendee attendance detail, 14 cols)
      inst: '1955492004', // Instructor Surveys
      stu:  '1245403832', // Student Surveys
      sess: '625567780'   // Session Details
    },
    // Pearl "Week 1" Monday for the active SY (first delivered session week).
    // The SY 26-27 attendance tab has no Weekly Grouping column, so week labels
    // are derived from Session Date against this anchor.
    PEARL_WEEK1: '2026-09-14',

    // SY 25-26 Pearl workbook — archived (central team only; not read by onsite)
    PEARL_2526_2PACX: '2PACX-1vQ1iC8NZFJt3iinGUEqftKtP32N43axi_JN_RQI36EBUdhZS0PaZRwd-1AJT3bEVe6cqHA0tCA3vb5K',

    // ── iReady current-year (EOY Preliminary / Longitudinal) ── SWAP AT SY ROLLOVER ─
    IREADY_CURRENT_SHEET_ID: '1mCx6eFKscXA3y5Ox_JB9cSualR5Tw9MbKxBVN078_G0',
    IREADY_CURRENT_ELA_GID:  '1640935949',
    IREADY_CURRENT_MATH_GID: '1676366557',

    // ── Pearl Login/ID roster — staff name, email, Pearl username, school/district (evergreen) ──
    PEARL_LOGIN_2PACX: '2PACX-1vS2fgss4HiKpr61wJ2_si8klythckgGZ3yOYer4FSAdThkQz-X1cdL83xbgPBnHbMpTGPHZCtnttKRv',

    // ── HR roster — same sheet the central portal reads (evergreen) ────────
    HR_2PACX: '2PACX-1vRc-Air9jhOtvkVelwfvOguzAyFmGIFpQ0sDtu4q8S5kFAgQz_IZo-XBeIfQgy4GB8OdSXoyonTeLT8',
    HR_GID: '911694457',

    // ── SY 26-27 Onsite Tracker — authoritative current-year roster & role ─
    // (Cycle | Role | County | District | Locations | …). Used to recognize
    // SY 26-27 site leaders before the HR Master List carries 2026-2027 rows.
    ONSITE_TRACKER_SHEET_ID: '1x3dWZQhx9XWqB8YASInOMTr0JDjSRMqv3w7PmcruuMU',
    ONSITE_TRACKER_GID: '0',

    // ── Standards Mastery — Middlesex STEM + SM schools (evergreen) ────────
    SM_SHEET_ID: '1__l9A4hyX_-4veVUP606sN9rYg9Fa0hE',
    SM_GID: '457164791'
  };

  // Live CSV URL(s) for a Pearl tab — primary sheet-ID export, then gviz as a
  // fallback (gviz can blank mixed-type cells, so it's never the primary).
  // With a published 2PACX key instead, the /pub CSV URL is used.
  NJTC_SOURCES.pearlCsvUrls = function (gid) {
    if (NJTC_SOURCES.PEARL_SHEET_ID) {
      var base = 'https://docs.google.com/spreadsheets/d/' + NJTC_SOURCES.PEARL_SHEET_ID;
      return [base + '/export?format=csv&gid=' + gid, base + '/gviz/tq?tqx=out:csv&gid=' + gid];
    }
    return ['https://docs.google.com/spreadsheets/d/e/' + NJTC_SOURCES.PEARL_2PACX + '/pub?output=csv&gid=' + gid];
  };
  NJTC_SOURCES.pearlCsvUrl = function (gid) { return NJTC_SOURCES.pearlCsvUrls(gid)[0]; };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = NJTC_SOURCES; // Node — data/export-pearl-static.js
  } else {
    root.NJTC_SOURCES = NJTC_SOURCES; // browser
  }
})(typeof window !== 'undefined' ? window : this);
