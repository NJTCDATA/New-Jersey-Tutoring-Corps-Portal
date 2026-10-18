/* ============================================================================
   NJTC PEARL — MISSED-SESSION CATEGORIES (single source of truth)
   ============================================================================
   How every Pearl missed / cancellation reason is GROUPED for display across
   the central, onsite and partner portals and the reports built from them.
   Agreed with Programming (Oct 2026):

     1. Undelivered Sessions   — tutoring could not happen on NJTC's side
                                 (tutor absent, tutor vacancy). Replaces the
                                 term "Service Interruption". A talking point
                                 for partner conversations, not a to-do.
     2. Internal Tracking      — NJTC-internal (diagnostic testing, archived
                                 scholars). Central team only.
     3. Scholar Absences       — the misses that count toward Scholar
                                 Attendance %.
     4. Session Cancellations  — the session should not have run (school or
                                 NJTC-driven last-minute change). Taken out of
                                 sessions offered.

   THIS FILE DOES NOT CHANGE ATTENDANCE MATH. The attendance-rate classifiers
   (programming.js, pearl-data.js, leader-team.js, partner-report.js,
   build-pulse-archive.js) keep their own reason sets; ABSENCE below must
   always equal their scholar-miss set (+ blank). "Classroom Teacher
   Requested to Keep Scholar in Class" stays a scholar absence (counts
   against scholar attendance) — the Aug 2026 org-wide rule — pending
   Programming's review.

   Loaded as a plain <script> (window.NJTC_PEARL_CATEGORIES) or required from
   Node (module.exports), like onsite/data-sources.js.
   ============================================================================ */
(function (root) {
  'use strict';

  function norm(s) { return String(s == null ? '' : s).replace(/\s+/g, ' ').trim().toLowerCase(); }

  var CATEGORY = {
    UNDELIVERED:  'undelivered',
    INTERNAL:     'internal',
    ABSENCE:      'absence',
    CANCELLATION: 'cancellation',
    OTHER:        'other'          // a reason this file does not know yet — never silently re-filed
  };

  var LABELS = {
    undelivered:  'Undelivered Sessions',
    internal:     'Internal Tracking',
    absence:      'Scholar Absences',
    cancellation: 'Session Cancellations',
    other:        'Other (unmapped reason)'
  };

  var DESCRIPTIONS = {
    undelivered:  'Tutoring could not happen on NJTC’s side (tutor absent or vacancy). Not counted against scholar attendance.',
    internal:     'NJTC-internal tracking (diagnostic testing, archived scholars). Not counted against attendance.',
    absence:      'Counts toward Scholar Attendance %.',
    cancellation: 'The session should not have run (school or NJTC-driven change). Removed from sessions offered.',
    other:        'Reason not yet mapped to a category — tell the Data team.'
  };

  // ── Attendance missed reasons (Missed Reasons tab), by category ──────────
  var UNDELIVERED = [
    'Tutor Absent',                                // scholar row: their tutor was out
    'Tutor Vacancy',                               // no tutor hired for the seat (not a cancellation)
    'Absent; Not Covered (Tutor not available)',   // tutor row: absent, nobody covered
    'Tutor Left Early (no sub)'
  ];
  var INTERNAL = [
    'NJTC Diagnostic Testing',
    'Scholar Archived - Removed from Sessions'
  ];
  var ABSENCE = [
    'Absent',
    'Scholar declined attending tutoring session',
    'Scholar Left Early',
    'Classroom Teacher Requested to Keep Scholar in Class',
    'HADDON TWP ONLY -- Teacher requested whole group support'
  ];
  // Reasons that belong to a cancellation. Logged as a scholar missed reason
  // they are still grouped here (and flagged: the session should have been
  // cancelled in Pearl instead). Also the Canceled Reason values themselves.
  var CANCELLATION = [
    'NJTC Internal Issue/Error',
    'School Schedule Changed',
    'School Event',
    'School Event/Assembly',
    'Weather Closure',
    'School-administered Testing',
    'School Administered Testing',
    'Unscheduled School Closure/Delay/Dismissal',
    'Scheduled/Unscheduled School Drill',
    'Half Day',
    'Holiday - scheduled',
    'HADDON TWP ONLY -- Program Redevelopment'
  ];
  // Covered tutor absences (SY 25-26 style reasons). The tutor was out but the
  // session was delivered, so they are tutor absences, not undelivered sessions.
  var TUTOR_COVERED = [
    'Absent; Covered by Sub Tutor',
    'Absent; Covered by Dual Role',
    'Absent; Covered by the Site Leader',
    'Absent; Covered by the Instructional Coach'
  ];
  // Cancellation / missed reasons driven by the SCHOOL (vs. NJTC). The partner
  // portal shows only these as "sessions not delivered".
  var SCHOOL_DRIVEN = [
    'School Schedule Changed',
    'School Event',
    'School Event/Assembly',
    'Weather Closure',
    'School-administered Testing',
    'School Administered Testing',
    'Unscheduled School Closure/Delay/Dismissal',
    'Scheduled/Unscheduled School Drill',
    'Half Day',
    'Holiday - scheduled'
  ];

  var BY_REASON = {};
  function add(list, cat) { list.forEach(function (r) { BY_REASON[norm(r)] = cat; }); }
  add(UNDELIVERED, CATEGORY.UNDELIVERED);
  add(INTERNAL, CATEGORY.INTERNAL);
  add(ABSENCE, CATEGORY.ABSENCE);
  add(CANCELLATION, CATEGORY.CANCELLATION);
  var COVERED_SET = {}; TUTOR_COVERED.forEach(function (r) { COVERED_SET[norm(r)] = true; });
  var SCHOOL_SET = {};  SCHOOL_DRIVEN.forEach(function (r) { SCHOOL_SET[norm(r)] = true; });

  // Category of one MISSED scholar attendance row's reason. A blank reason is
  // a scholar absence (unknown = missed — same as every attendance classifier).
  // Covered-tutor reasons only appear on tutor rows and are not categorized
  // here (see isCoveredTutorReason).
  function categoryOf(reason) {
    var k = norm(reason);
    if (!k) return CATEGORY.ABSENCE;
    return BY_REASON[k] || CATEGORY.OTHER;
  }
  // Matching is case/space-insensitive: Pearl spells some reasons differently
  // between the attendance and cancellation dropdowns ("School Schedule
  // changed" vs "School Schedule Changed", "School Event" vs "…/Assembly").
  function isSchoolDriven(reason) { return !!SCHOOL_SET[norm(reason)]; }
  function isCoveredTutorReason(reason) { return !!COVERED_SET[norm(reason)]; }

  // Session status (Session Details "Status") → offered or not. Cancelled and
  // Rescheduled sessions were never going to be delivered as scheduled, so
  // they are not part of "sessions offered".
  function isOfferedStatus(status) {
    var s = norm(status);
    return s !== 'cancelled' && s !== 'canceled' && s !== 'rescheduled';
  }

  var API = {
    CATEGORY: CATEGORY,
    LABELS: LABELS,
    DESCRIPTIONS: DESCRIPTIONS,
    ORDER: [CATEGORY.UNDELIVERED, CATEGORY.CANCELLATION, CATEGORY.INTERNAL, CATEGORY.ABSENCE, CATEGORY.OTHER],
    LISTS: { UNDELIVERED: UNDELIVERED, INTERNAL: INTERNAL, ABSENCE: ABSENCE, CANCELLATION: CANCELLATION, TUTOR_COVERED: TUTOR_COVERED, SCHOOL_DRIVEN: SCHOOL_DRIVEN },
    categoryOf: categoryOf,
    isSchoolDriven: isSchoolDriven,
    isCoveredTutorReason: isCoveredTutorReason,
    isOfferedStatus: isOfferedStatus,
    norm: norm
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  else root.NJTC_PEARL_CATEGORIES = API;
})(typeof window !== 'undefined' ? window : this);
