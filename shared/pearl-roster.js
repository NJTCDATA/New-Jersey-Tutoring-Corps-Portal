/* ============================================================================
   NJTC PEARL — SCHOLAR ROSTER GRADE (single rule for every portal)
   ============================================================================
   A scholar's grade level comes from the ROSTER — Pearl's "Student Attendance"
   tab, one row per scholar (Pearl Student ID + Grade) — never from a session.

   Why: the Grade column on the per-attendee attendance tab ("Missed Reasons",
   column I) and on Session Details is the SESSION's grade, which staff set by
   hand with the session title. Checked on the 11/16/2026 export: in the 602
   attendance rows where a session's grade differs from the scholar's roster
   grade, column I matches the session 529 times (e.g. three 6th graders in a
   "7A ELA" group show as 7th on every row). 105 scholars were affected.

   applyRosterGrades() overwrites ATT.GRADE on every Student row with that
   scholar's roster grade. A scholar missing from the roster tab keeps the
   value already on the row, so nothing goes blank if the tab can't load.

   Loaded by: central/index.html (Pearl Ops), onsite/index.html (pearl-data.js),
   scripts/build-partner-data.js (partner portal bundles, via require).
   ============================================================================ */
(function (root) {
  'use strict';

  // Tab name in "Automate: SY 26 - 27 Pearl Attendance and Surveys". Read by
  // NAME through the gviz endpoint (the CSV export endpoint needs a gid).
  // If ROSTER_GID is set, the export endpoint is tried first.
  const ROSTER_TAB = 'Student Attendance';
  const ROSTER_GID = null;

  function rosterUrls(sheetId, gid) {
    const base = 'https://docs.google.com/spreadsheets/d/' + sheetId;
    const g = gid || ROSTER_GID;
    const urls = [];
    if (g) urls.push(base + '/export?format=csv&gid=' + g);
    urls.push(base + '/gviz/tq?tqx=out:csv&sheet=' + encodeURIComponent(ROSTER_TAB));
    return urls;
  }

  const norm = v => String(v == null ? '' : v).replace(/\s+/g, ' ').trim();

  // rows: parsed CSV of the Student Attendance tab, header row first.
  // → { pearlStudentId: '6th Grade', … }  (empty object if the header is not found)
  function rosterGradeMap(rows) {
    const map = {};
    if (!rows || !rows.length) return map;
    const h = rows[0].map(x => norm(x).toLowerCase());
    const idI = h.indexOf('pearl student id'), gI = h.indexOf('grade');
    if (idI < 0 || gI < 0) return map;
    for (let i = 1; i < rows.length; i++) {
      const r = rows[i] || [];
      const id = norm(r[idI]), g = norm(r[gI]);
      if (id && g) map[id] = g;
    }
    return map;
  }

  // Overwrite the grade on Student rows. Returns how many rows changed.
  // gradeIdx / roleIdx / idIdx default to the ATT layout used everywhere
  // (ROLE 1, GRADE 8, USER_ID 13).
  function applyRosterGrades(attRows, map, idx) {
    idx = idx || {};
    const roleI = idx.role != null ? idx.role : 1, gradeI = idx.grade != null ? idx.grade : 8, idI = idx.id != null ? idx.id : 13;
    let changed = 0;
    if (!map || !attRows) return 0;
    for (const r of attRows) {
      if (!r || norm(r[roleI]) !== 'Student') continue;
      const g = map[norm(r[idI])];
      if (g && norm(r[gradeI]) !== g) { r[gradeI] = g; changed++; }
    }
    return changed;
  }

  const API = { ROSTER_TAB, ROSTER_GID, rosterUrls, rosterGradeMap, applyRosterGrades };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  else root.NJTC_PEARL_ROSTER = API;
})(typeof window !== 'undefined' ? window : this);
