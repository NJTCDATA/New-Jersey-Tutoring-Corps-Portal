// ─────────────────────────────────────────────────────────────────────────────
// NJTC Pearl Ops — Regional Support Report  (Programming NE / SW buttons; Data)
//
// Answers "who or which campus needs support, and what do they fix" so
// program managers can hand their field staff a list instead of digging
// through Pearl. Two outputs from the same numbers:
//   • PDF  — 1–2 page campus + tutor summary for field staff
//   • XLSX — plain data tabs (no narrative) for staff to filter and act on
//
// Session ↔ attendance matching (Pearl attendance rows carry no Session ID):
// rows are matched to a session on session title + session date AND by
// person — scholar rows must be on the session's student roster (Pearl
// Student IDs), the tutor row must be the session's Pearl Instructor ID.
// Title + date alone is NOT unique (different tutors/schools reuse period
// titles like "10:02-10:42 (5th)" on the same day).
//
// Session status meaning (Pearl Session Details):
//   Completed + Attended            → every scholar attended
//   Completed + Partially Attended  → some scholars attended, some missed
//   Missed + Missed By Students     → all scholars missed, tutor present
//   Missed + Missed                 → the tutor row is marked missed. Either
//       a real tutor absence (tutor reason = "Absent; …"), or the whole group
//       could not meet (teacher kept the class, closure, NJTC issue) — the
//       tutor row then carries that same reason and never counts against
//       the tutor. Whole-group teacher pull-outs are reported as such AND
//       listed for review so the team can confirm how they were logged.
//   Scheduled + Incomplete          → never completed by the tutor
// ─────────────────────────────────────────────────────────────────────────────
(function () {
  'use strict';

  const CT_REASONS = new Set([
    'Classroom Teacher Requested to Keep Scholar in Class',
    'HADDON TWP ONLY -- Teacher requested whole group support',
  ]);
  const ARCHIVED_REASON = 'Scholar Archived - Removed from Sessions';
  // The "don't know why" reason. Tutors choose it instead of guessing; the
  // Site Leader follows up only when the same scholar repeats it.
  const UNAVAILABLE_REASON = 'Scholar Unavailable; Out of the Classroom';
  const REPEAT_UNAVAILABLE = 2;   // 2+ unavailable/blank in the report window → SL follow-up
  // Reason-mix check: a tutor who uses one missed reason far more than the
  // other tutors at the same school is probably picking it by default.
  const REASON_MIX = { minTutorMisses: 5, minSiteMisses: 5, minShare: 70, minGap: 30 };
  // Comment follow-up rules (shared/comment-flags.js) — browser global or Node require
  const FLAGS = (typeof window !== 'undefined' && window.NJTC_COMMENT_FLAGS) ||
    (typeof require === 'function' ? (function () { try { return require('../../shared/comment-flags.js'); } catch (e) { return null; } })() : null);
  const TARGET = { scholAtt: 80, tutorAtt: 90, capture: 80 };

  // Issue labels — short, plain, used verbatim in both PDF and XLSX
  const ISSUE = {
    incomplete:     'Incomplete session (still Scheduled)',
    blankScholar:   'Scholar missed - no reason entered',
    blankTutor:     'Tutor missed - no reason entered',
    notRecorded:    'Attendance not recorded',
    attWithMissed:  'Session marked Attended but a scholar is marked Missed',
    partialAllAtt:  'Session marked Partially Attended but all scholars attended',
    mbsWithAtt:     'Session marked Missed By Students but a scholar is marked Attended',
    mbsTutorNotAtt: 'Session marked Missed By Students but tutor not marked Attended',
    tutorMissedAtt: 'Session marked Missed (tutor) but tutor marked Attended',
    tutorRowMissed: 'Tutor marked Missed in a completed session',
    wrongTutorAbs:  'Scholar marked Tutor Absent but tutor was present',
    wrongScholar:   'Tutor absent but scholar given a scholar reason',
    wholeGroupCT:   'Review: whole-group teacher pull-out logged as tutor Missed',
    archived:       'Archived scholar still on session roster',
    cancelNoReason: 'FYI only: session cancelled with no Canceled Reason (cannot be changed after cancelling; pick a reason next time)',
    shouldCancel:   'Whole group missed with a cancellation reason (cancel the session in Pearl instead)',
  };
  // Cancellations are done by Site Leaders (tutors cannot cancel in Pearl)
  const SITE_LEADER_FIX = new Set(['shouldCancel']);
  // Informational only: Pearl locks the Canceled Reason once a session is
  // cancelled, so there is nothing to fix. Listed so Site Leaders know to
  // choose a reason next time; never counted as a fix.
  const FYI_ONLY = new Set(['cancelNoReason']);
  // Surveys can be added/edited in Pearl for 7 days after the session date.
  const SURVEY_EDIT_DAYS = 7;
  // Which issues are counted as tutor data-entry fixes (the rest are review/site items)
  const TUTOR_FIX = new Set(['incomplete', 'blankScholar', 'blankTutor', 'notRecorded', 'attWithMissed',
    'partialAllAtt', 'mbsWithAtt', 'mbsTutorNotAtt', 'tutorMissedAtt', 'tutorRowMissed', 'wrongTutorAbs', 'wrongScholar']);

  function toYMD(val) {
    if (!val) return '';
    if (val instanceof Date) return isNaN(val) ? '' : val.getFullYear() + '-' + String(val.getMonth() + 1).padStart(2, '0') + '-' + String(val.getDate()).padStart(2, '0');
    const s = String(val).trim();
    const mdy = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (mdy) return mdy[3] + '-' + mdy[1].padStart(2, '0') + '-' + mdy[2].padStart(2, '0');
    const iso = s.match(/^(\d{4}-\d{2}-\d{2})/);
    return iso ? iso[1] : '';
  }
  // Clock time → minutes after midnight ("09:20", "9:20 AM", "10/02/2026 2:23 PM")
  function timeMins(val) {
    if (!val) return null;
    if (val instanceof Date) return isNaN(val) ? null : val.getHours() * 60 + val.getMinutes();
    const s = String(val).replace(/^\s*\d{1,4}[\/-]\d{1,2}[\/-]\d{1,4}[T\s]*/, '');
    const m = s.match(/(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)?/i);
    if (!m) return null;
    let h = parseInt(m[1], 10) % 24;
    if (m[3]) { h = h % 12; if (/pm/i.test(m[3])) h += 12; }
    return h * 60 + parseInt(m[2], 10);
  }
  const pct = (n, d) => d > 0 ? Math.round(n / d * 1000) / 10 : null;

  // ─────────────────────────────────────────────────────────────────────────
  // CORE — pure function over Pearl rows (unit-testable outside the browser)
  //   input: { attRows, sessions, instRows, stuRows, ATT, INST_S, STU_S,
  //            classify(row) → 'attended'|'absent'|'service_interruption'|'not_recorded'|'other',
  //            tutorMissReasons:Set, regionOf(school,district) → 'NE'|'SW'|null,
  //            region:'ALL'|'NE'|'SW', school:'', from:'YYYY-MM-DD', to:'YYYY-MM-DD', now:Date }
  // ─────────────────────────────────────────────────────────────────────────
  function computeFieldSupport(input) {
    const { ATT, INST_S, STU_S, classify } = input;
    const TUTOR_MISS = input.tutorMissReasons || new Set();
    const now = input.now || new Date();
    const region = (input.region || 'ALL').toUpperCase();
    const schoolF = input.school || '';
    const from = input.from || '', to = input.to || '';

    const inScope = (school, district) => {
      if (!school || /^\s*(z{3}|njtc\s*$)/i.test(school) || /^\s*(z{3}|njtc\s*$)/i.test(district || '')) return false;
      if (schoolF && school !== schoolF) return false;
      if (region !== 'ALL' && input.regionOf(school, district) !== region) return false;
      return true;
    };
    const inDates = ymd => (!from || (ymd && ymd >= from)) && (!to || (ymd && ymd <= to));

    // Attendance rows by title|date
    const attByKey = new Map();
    (input.attRows || []).forEach(r => {
      const k = (r[ATT.SESSION] || '') + '|' + toYMD(r[ATT.SESS_DATE]);
      if (!attByKey.has(k)) attByKey.set(k, []);
      attByKey.get(k).push(r);
    });

    // Survey lookups (submitted by person + session)
    const tutorSurv = new Set(), scholSurv = new Set();
    (input.instRows || []).forEach(r => { if (r[INST_S.FILLED_BY_ID] && r[INST_S.SESS_ID]) tutorSurv.add(r[INST_S.FILLED_BY_ID] + '|' + r[INST_S.SESS_ID]); });
    (input.stuRows  || []).forEach(r => { if (r[STU_S.FILLED_BY_ID] && r[STU_S.SESS_ID]) scholSurv.add(r[STU_S.FILLED_BY_ID] + '|' + r[STU_S.SESS_ID]); });

    const issues = [];        // row-level data-quality items
    const missingTutor = [];  // delivered sessions without a tutor survey
    const missingScholar = [];// attended scholars without a scholar survey
    const pullouts = [];      // classroom-teacher pull-out rows
    const incompletes = [];   // never-completed sessions
    const unknownMiss = {};   // scholar → misses logged Unavailable or blank (reason unknown)
    const reasonMix = {};     // school → tutor → reason → count (scholar Missed rows with a reason)
    const tutors = {}, schools = {};

    const tutorRec = (s) => {
      const k = (s.instId || s.instructor || 'Unassigned') + '|' + (s.school || '');
      if (!tutors[k]) tutors[k] = { tutor: s.instructor || 'Unassigned', tutorId: s.instId || '', school: s.school || '', district: s.district || '',
        region: input.regionOf(s.school, s.district) || '', delivered: 0, tutorSurvElig: 0, tutorSurvDone: 0,
        scholSurvElig: 0, scholSurvDone: 0, tutorSurvOpen: 0, scholSurvOpen: 0, tutAtt: 0, tutAbs: 0, issues: {} };
      return tutors[k];
    };
    const schoolRec = (s) => {
      const k = s.school || '';
      if (!schools[k]) schools[k] = { school: k, district: s.district || '', region: input.regionOf(s.school, s.district) || '',
        delivered: 0, stuAtt: 0, stuAbs: 0, tutAtt: 0, tutAbs: 0, tutorSurvElig: 0, tutorSurvDone: 0,
        scholSurvElig: 0, scholSurvDone: 0, tutorSurvOpen: 0, scholSurvOpen: 0, ctPulls: 0, ctDenom: 0, issues: {} };
      return schools[k];
    };
    const sessBase = s => ({ date: toYMD(s.start), school: s.school || '', tutor: s.instructor || '', session: s.title || '', sessionId: s.id || '',
      status: s.status || '', sessionAttendance: s.attendance || '' });
    // Survey edit window: open through session date + 7 days (local dates)
    const todayYMD = toYMD(now);
    const addDays = (ymd, n) => { const d = new Date(ymd + 'T12:00:00'); d.setDate(d.getDate() + n); return toYMD(d); };
    const surveyWindow = ymd => {
      if (!ymd) return { editableUntil: '', surveyStatus: '', expired: false };
      const until = addDays(ymd, SURVEY_EDIT_DAYS), expired = todayYMD > until;
      return { editableUntil: until, expired, surveyStatus: expired ? 'Expired - can no longer be submitted' : 'Open - submit by ' + until };
    };
    const addIssue = (s, key, extra) => {
      issues.push(Object.assign(sessBase(s), { issue: ISSUE[key], issueKey: key, owner: TUTOR_FIX.has(key) ? 'Tutor' : SITE_LEADER_FIX.has(key) ? 'Site Leader' : FYI_ONLY.has(key) ? 'FYI - no action' : (key === 'archived' ? 'Site / Data' : 'Review') }, extra || {}));
      const t = tutorRec(s), c = schoolRec(s);
      t.issues[key] = (t.issues[key] || 0) + 1;
      c.issues[key] = (c.issues[key] || 0) + 1;
    };

    (input.sessions || []).forEach(s => {
      if (!s || !s.id || !inScope(s.school, s.district)) return;
      const ymd = toYMD(s.start);
      if (!inDates(ymd)) return;
      const startD = s.start ? new Date(s.start) : null;
      if (startD && !isNaN(startD) && startD > now) return; // future session — nothing to check yet

      const status = s.status || '', att = s.attendance || '';
      const roster = new Set(s.studentIds || []);
      // Same tutor + group + title can run twice in a day (e.g. 8:45 and
      // 9:20) — when the planned start time is readable on both sides, use it.
      let rows = attByKey.get((s.title || '') + '|' + ymd) || [];
      const sMin = timeMins(s.start);
      if (sMin !== null && rows.some(r => timeMins(r[ATT.PLAN_START]) !== null)) {
        const timed = rows.filter(r => timeMins(r[ATT.PLAN_START]) === sMin);
        if (timed.length) rows = timed;
      }
      const stuRows = rows.filter(r => r[ATT.ROLE] === 'Student' && roster.has(r[ATT.USER_ID]));
      const tutRows = rows.filter(r => r[ATT.ROLE] === 'Instructor' && s.instId && r[ATT.USER_ID] === s.instId);
      const t = tutorRec(s), c = schoolRec(s);

      if (status === 'Scheduled') {
        incompletes.push(sessBase(s));
        addIssue(s, 'incomplete');
        return;
      }
      // Cancelled with no reason (only where Pearl exports Canceled Reason — SY 26-27+)
      if (status === 'Cancelled' && input.hasCancelReasons && !String(s.canceledReason || '').trim()) {
        addIssue(s, 'cancelNoReason', { reasonEntered: s.canceledBy ? 'Canceled by ' + s.canceledBy : '' });
        return;
      }
      if (status !== 'Completed' && status !== 'Missed') return; // Cancelled / Rescheduled

      // Attendance tallies (person-matched)
      const stuCls = stuRows.map(r => ({ r, c: classify(r) }));
      const nStuAtt = stuCls.filter(x => x.c === 'attended').length;
      const nStuMiss = stuRows.filter(r => (r[ATT.ATT_STATUS] || '') === 'Missed').length;
      stuCls.forEach(x => { if (x.c === 'attended') c.stuAtt++; else if (x.c === 'absent') c.stuAbs++; });
      tutRows.forEach(r => { const k = classify(r); if (k === 'attended') { t.tutAtt++; c.tutAtt++; } else if (k === 'absent') { t.tutAbs++; c.tutAbs++; } });
      const tutorAttended = tutRows.some(r => ['Attended', 'Late'].includes(r[ATT.ATT_STATUS]));
      const tutorMissedRows = tutRows.filter(r => (r[ATT.ATT_STATUS] || '') === 'Missed');
      const tutorReasons = new Set(tutorMissedRows.map(r => r[ATT.MISS_REASON] || ''));
      // Absent with nobody covering — a covered absence means the session ran with a
      // sub, so a scholar reason (e.g. Absent) on the scholar's row is legitimate.
      const tutorTrulyAbsent = [...tutorReasons].some(x => TUTOR_MISS.has(x) && !/covered by/i.test(x) && !/left early/i.test(x));

      // Row-level checks (scholar rows)
      const cancelTypeReasons = new Set();
      stuRows.forEach(r => {
        const st = r[ATT.ATT_STATUS] || '', reason = r[ATT.MISS_REASON] || '';
        const who = { scholar: r[ATT.USER] || '', scholarId: r[ATT.USER_ID] || '', reasonEntered: reason };
        if (st === 'Not recorded') addIssue(s, 'notRecorded', who);
        if (st !== 'Missed') return;
        if (!reason) addIssue(s, 'blankScholar', who);
        if (!reason || reason === UNAVAILABLE_REASON) {
          const k = (s.school || '') + '|' + (r[ATT.USER_ID] || r[ATT.USER] || '');
          if (!unknownMiss[k]) unknownMiss[k] = { school: s.school || '', scholar: r[ATT.USER] || '', scholarId: r[ATT.USER_ID] || '',
            tutors: new Set(), dates: [], unavailable: 0, blank: 0 };
          const u = unknownMiss[k];
          u.tutors.add(s.instructor || ''); u.dates.push(ymd);
          if (reason) u.unavailable++; else u.blank++;
        }
        if (reason && reason !== ARCHIVED_REASON) {
          const sk = s.school || '', tk = s.instructor || 'Unassigned';
          reasonMix[sk] = reasonMix[sk] || {};
          reasonMix[sk][tk] = reasonMix[sk][tk] || {};
          reasonMix[sk][tk][reason] = (reasonMix[sk][tk][reason] || 0) + 1;
        }
        if (reason === ARCHIVED_REASON) addIssue(s, 'archived', who);
        if (input.categoryOf && classify(r) === 'service_interruption' && input.categoryOf(reason) === 'cancellation') cancelTypeReasons.add(reason);
        if (reason === 'Tutor Absent' && tutorAttended && !tutorMissedRows.length) addIssue(s, 'wrongTutorAbs', who);
        if (tutorTrulyAbsent && reason && reason !== 'Tutor Absent' && classify(r) === 'absent') addIssue(s, 'wrongScholar', who);
        if (CT_REASONS.has(reason)) {
          const wholeGroup = status === 'Missed' && att === 'Missed' && [...tutorReasons].some(x => CT_REASONS.has(x));
          pullouts.push(Object.assign(sessBase(s), who, { wholeGroup: wholeGroup ? 'Yes' : 'No' }));
          c.ctPulls++;
        }
        if (classify(r) === 'absent' && reason) c.ctDenom++;
      });
      // Only when nobody attended: part of a session cannot be cancelled, so a
      // cancellation-type reason on some scholars of a delivered session is fine.
      if (cancelTypeReasons.size && nStuAtt === 0) addIssue(s, 'shouldCancel', { reasonEntered: [...cancelTypeReasons].join('; ') }); // once per session
      tutRows.forEach(r => {
        if ((r[ATT.ATT_STATUS] || '') === 'Not recorded') addIssue(s, 'notRecorded', { scholar: '(tutor)', reasonEntered: '' });
        if ((r[ATT.ATT_STATUS] || '') === 'Missed' && !(r[ATT.MISS_REASON] || '')) addIssue(s, 'blankTutor', { reasonEntered: '' });
      });

      // Session-status consistency (only when attendance rows were found)
      if (stuRows.length) {
        if (status === 'Completed' && att === 'Attended' && nStuMiss > 0) addIssue(s, 'attWithMissed', { detail: nStuMiss + ' missed' });
        if (status === 'Completed' && att === 'Partially Attended' && nStuMiss === 0 && nStuAtt > 0) addIssue(s, 'partialAllAtt');
        if (status === 'Missed' && att === 'Missed By Students' && nStuAtt > 0) addIssue(s, 'mbsWithAtt', { detail: nStuAtt + ' attended' });
      }
      if (tutRows.length) {
        if (status === 'Missed' && att === 'Missed By Students' && !tutorAttended &&
            !tutRows.some(r => (r[ATT.ATT_STATUS] || '') === 'Not recorded')) addIssue(s, 'mbsTutorNotAtt'); // not-recorded already listed
        if (status === 'Missed' && att === 'Missed' && tutorAttended && !tutorMissedRows.length) addIssue(s, 'tutorMissedAtt');
        if (status === 'Completed' && tutorMissedRows.length) addIssue(s, 'tutorRowMissed', { reasonEntered: [...tutorReasons].join('; ') });
        if (status === 'Missed' && att === 'Missed' && [...tutorReasons].some(x => CT_REASONS.has(x)))
          addIssue(s, 'wholeGroupCT', { reasonEntered: [...tutorReasons].join('; ') });
      }

      // Delivered sessions → survey follow-up
      const delivered = status === 'Completed' && (att === 'Attended' || att === 'Partially Attended');
      if (!delivered) return;
      t.delivered++; c.delivered++;
      t.tutorSurvElig++; c.tutorSurvElig++;
      const win = surveyWindow(ymd);
      if (s.instId && tutorSurv.has(s.instId + '|' + s.id)) { t.tutorSurvDone++; c.tutorSurvDone++; }
      else { missingTutor.push(Object.assign(sessBase(s), win)); if (!win.expired) { t.tutorSurvOpen++; c.tutorSurvOpen++; } }
      // Scholar survey: only scholars who attended can take it. If no
      // attendance rows matched, fall back to the full roster.
      const attendedIds = stuRows.length
        ? stuCls.filter(x => x.c === 'attended').map(x => x.r[ATT.USER_ID])
        : [...roster];
      const nameOf = {}; stuRows.forEach(r => { nameOf[r[ATT.USER_ID]] = r[ATT.USER] || ''; });
      attendedIds.forEach(uid => {
        t.scholSurvElig++; c.scholSurvElig++;
        if (scholSurv.has(uid + '|' + s.id)) { t.scholSurvDone++; c.scholSurvDone++; }
        else { missingScholar.push(Object.assign(sessBase(s), { scholar: nameOf[uid] || '', scholarId: uid }, win)); if (!win.expired) { t.scholSurvOpen++; c.scholSurvOpen++; } }
      });
    });

    // ── Roll-ups ───────────────────────────────────────────────────────────
    const sumFix = obj => Object.entries(obj).reduce((a, [k, n]) => a + (TUTOR_FIX.has(k) ? n : 0), 0);
    const tutorList = Object.values(tutors).map(t => {
      const missingT = t.tutorSurvElig - t.tutorSurvDone, missingS = t.scholSurvElig - t.scholSurvDone;
      return {
        tutor: t.tutor, tutorId: t.tutorId, school: t.school, district: t.district, region: t.region,
        delivered: t.delivered,
        incomplete: t.issues.incomplete || 0,
        missingTutorSurveys: missingT, missingTutorSurveysOpen: t.tutorSurvOpen,
        tutorSurveyCapture: pct(t.tutorSurvDone, t.tutorSurvElig),
        missingScholarSurveys: missingS, missingScholarSurveysOpen: t.scholSurvOpen,
        scholarSurveyCapture: pct(t.scholSurvDone, t.scholSurvElig),
        blankReasons: (t.issues.blankScholar || 0) + (t.issues.blankTutor || 0),
        notRecorded: t.issues.notRecorded || 0,
        statusMismatch: ['attWithMissed', 'partialAllAtt', 'mbsWithAtt', 'mbsTutorNotAtt', 'tutorMissedAtt', 'tutorRowMissed'].reduce((a, k) => a + (t.issues[k] || 0), 0),
        wrongCategory: (t.issues.wrongTutorAbs || 0) + (t.issues.wrongScholar || 0),
        wholeGroupReview: t.issues.wholeGroupCT || 0,
        tutorAttendance: pct(t.tutAtt, t.tutAtt + t.tutAbs),
        tutorSessions: t.tutAtt + t.tutAbs, tutorAbsences: t.tutAbs,
        totalFixes: sumFix(t.issues) + t.tutorSurvOpen, // expired surveys can no longer be fixed
      };
    }).filter(t => t.totalFixes > 0 || t.missingTutorSurveys > 0 || t.wholeGroupReview > 0 || (t.tutorAttendance !== null && t.tutorAttendance < TARGET.tutorAtt))
      .sort((a, b) => b.totalFixes - a.totalFixes || a.tutor.localeCompare(b.tutor));

    const schoolList = Object.values(schools).filter(c => c.delivered > 0 || Object.keys(c.issues).length).map(c => {
      const scholAtt = pct(c.stuAtt, c.stuAtt + c.stuAbs);
      const tutAtt = pct(c.tutAtt, c.tutAtt + c.tutAbs);
      const tCap = pct(c.tutorSurvDone, c.tutorSurvElig), sCap = pct(c.scholSurvDone, c.scholSurvElig);
      const ctShare = c.ctDenom > 0 ? Math.round(c.ctPulls / c.ctDenom * 100) : 0;
      const dataFixes = sumFix(c.issues);
      const missed = [scholAtt !== null && scholAtt < TARGET.scholAtt, tutAtt !== null && tutAtt < TARGET.tutorAtt,
        tCap !== null && tCap < TARGET.capture, sCap !== null && sCap < TARGET.capture, ctShare > 10].filter(Boolean).length;
      const support = (missed >= 2 || dataFixes >= 10) ? 'High' : (missed >= 1 || dataFixes >= 3) ? 'Medium' : 'Low';
      return {
        school: c.school, district: c.district, region: c.region, support,
        delivered: c.delivered, scholarAttendance: scholAtt, tutorAttendance: tutAtt,
        tutorSurveyCapture: tCap, scholarSurveyCapture: sCap,
        incomplete: c.issues.incomplete || 0,
        missingTutorSurveys: c.tutorSurvElig - c.tutorSurvDone, missingTutorSurveysOpen: c.tutorSurvOpen,
        missingScholarSurveys: c.scholSurvElig - c.scholSurvDone, missingScholarSurveysOpen: c.scholSurvOpen,
        blankReasons: (c.issues.blankScholar || 0) + (c.issues.blankTutor || 0),
        dataFixes, teacherPullouts: c.ctPulls, teacherPulloutShare: ctShare,
        wholeGroupReview: c.issues.wholeGroupCT || 0,
        archivedOnRoster: c.issues.archived || 0,
      };
    }).sort((a, b) => ({ High: 0, Medium: 1, Low: 2 })[a.support] - ({ High: 0, Medium: 1, Low: 2 })[b.support] || b.dataFixes - a.dataFixes);

    const byDate = (a, b) => (b.date || '').localeCompare(a.date || '') || a.school.localeCompare(b.school);
    const openFirst = (a, b) => (a.expired - b.expired) || byDate(a, b); // still-fixable surveys on top
    issues.sort(byDate); missingTutor.sort(openFirst); missingScholar.sort(openFirst); pullouts.sort(byDate); incompletes.sort(byDate);

    // Scholars pulled out 3+ times (dosage watch)
    const ctByScholar = {};
    pullouts.forEach(p => {
      const k = p.scholarId || p.scholar;
      if (!ctByScholar[k]) ctByScholar[k] = { scholar: p.scholar, scholarId: p.scholarId, school: p.school, pullouts: 0, lastDate: '' };
      ctByScholar[k].pullouts++;
      if (p.date > ctByScholar[k].lastDate) ctByScholar[k].lastDate = p.date;
    });
    const scholarPullouts = Object.values(ctByScholar).sort((a, b) => b.pullouts - a.pullouts);

    // Scholars whose misses keep being logged "unavailable" / blank — the
    // Site Leader checks school attendance or asks the teacher at a break.
    const unavailableRepeat = Object.values(unknownMiss).filter(u => u.dates.length >= REPEAT_UNAVAILABLE).map(u => {
      const dates = [...new Set(u.dates)].sort();
      return { school: u.school, scholar: u.scholar, scholarId: u.scholarId, tutors: [...u.tutors].filter(Boolean).join('; '),
        times: u.dates.length, unavailable: u.unavailable, blank: u.blank, dates: dates.join(', '), lastDate: dates[dates.length - 1] || '' };
    }).sort((a, b) => b.times - a.times || a.school.localeCompare(b.school) || a.scholar.localeCompare(b.scholar));

    // Reason-mix outliers: compare each tutor's most-used reason with the
    // share of that reason among the OTHER tutors at the same school.
    const reasonOutliers = [];
    Object.entries(reasonMix).forEach(([school, byTutor]) => {
      Object.entries(byTutor).forEach(([tutor, counts]) => {
        const n = Object.values(counts).reduce((a, b) => a + b, 0);
        if (n < REASON_MIX.minTutorMisses) return;
        const [top, topN] = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
        const share = Math.round(topN / n * 100);
        let siteN = 0, siteTop = 0;
        Object.entries(byTutor).forEach(([t2, c2]) => {
          if (t2 === tutor) return;
          Object.entries(c2).forEach(([rsn, k]) => { siteN += k; if (rsn === top) siteTop += k; });
        });
        if (siteN < REASON_MIX.minSiteMisses) return;
        const siteShare = Math.round(siteTop / siteN * 100);
        if (share >= REASON_MIX.minShare && share - siteShare >= REASON_MIX.minGap)
          reasonOutliers.push({ school, tutor, misses: n, topReason: top, tutorShare: share, siteShare, siteMisses: siteN });
      });
    });
    reasonOutliers.sort((a, b) => (b.tutorShare - b.siteShare) - (a.tutorShare - a.siteShare) || a.school.localeCompare(b.school));

    // One list of everything a Site Leader (not the tutor) follows up on,
    // so each SL can filter to their own schools.
    const slFollowUp = [];
    unavailableRepeat.forEach(u => slFollowUp.push({ school: u.school, item: 'Scholar unavailable / no reason ' + u.times + ' times',
      who: u.scholar, tutor: u.tutors, dates: u.dates, step: 'Check school attendance or ask the teacher at a natural break; update the reason in Pearl if known.' }));
    issues.filter(i => i.issueKey === 'shouldCancel').forEach(i => slFollowUp.push({ school: i.school, item: 'Whole group missed - should be a cancellation',
      who: i.session, tutor: i.tutor, dates: i.date, step: 'Cancel the session in Pearl with the reason (' + (i.reasonEntered || '') + ').' }));
    issues.filter(i => i.issueKey === 'cancelNoReason').forEach(i => slFollowUp.push({ school: i.school, item: 'Cancelled with no reason (FYI)',
      who: i.session, tutor: i.tutor, dates: i.date, step: 'Cannot be changed now. Remind whoever cancelled to choose a reason next time.' }));
    reasonOutliers.forEach(o => slFollowUp.push({ school: o.school, item: 'Reason-mix check: "' + o.topReason + '" on ' + o.tutorShare + '% of misses (school: ' + o.siteShare + '%)',
      who: o.tutor, tutor: o.tutor, dates: '', step: 'Review the reason guide with the tutor in the next huddle.' }));
    slFollowUp.sort((a, b) => a.school.localeCompare(b.school));

    // Tutor and scholar comments that need someone to follow up (escalate first)
    const sessById = {};
    (input.sessions || []).forEach(s => { if (s && s.id) sessById[s.id] = s; });
    const flaggedComments = FLAGS ? FLAGS.collect({
      instRows: input.instRows, stuRows: input.stuRows, INST_S, STU_S, sessById, toYMD,
      inScope, inDates,
    }).map(c => Object.assign(c, { region: input.regionOf(c.school, c.district) || '' })) : [];

    const totals = {
      schools: schoolList.length, tutors: tutorList.length,
      incomplete: incompletes.length, missingTutorSurveys: missingTutor.length, missingScholarSurveys: missingScholar.length,
      missingTutorSurveysOpen: missingTutor.filter(x => !x.expired).length, missingScholarSurveysOpen: missingScholar.filter(x => !x.expired).length,
      cancelNoReasonFYI: issues.filter(i => i.issueKey === 'cancelNoReason').length,
      dataFixes: issues.filter(i => i.owner === 'Tutor' && i.issueKey !== 'incomplete').length,
      blankReasons: issues.filter(i => i.issueKey === 'blankScholar' || i.issueKey === 'blankTutor').length,
      statusMismatch: issues.filter(i => ['attWithMissed', 'partialAllAtt', 'mbsWithAtt', 'mbsTutorNotAtt', 'tutorMissedAtt', 'tutorRowMissed'].includes(i.issueKey)).length,
      wrongCategory: issues.filter(i => i.issueKey === 'wrongTutorAbs' || i.issueKey === 'wrongScholar').length,
      notRecorded: issues.filter(i => i.issueKey === 'notRecorded').length,
      wholeGroupReview: issues.filter(i => i.issueKey === 'wholeGroupCT').length,
      archived: issues.filter(i => i.issueKey === 'archived').length,
      cancelFixes: issues.filter(i => SITE_LEADER_FIX.has(i.issueKey)).length,
      teacherPullouts: pullouts.length, scholarsPulled3: scholarPullouts.filter(x => x.pullouts >= 3).length,
      scholarsUnavailableRepeat: unavailableRepeat.length, reasonOutliers: reasonOutliers.length,
      slFollowUp: slFollowUp.length,
      commentsEscalate: flaggedComments.filter(c => c.tier === 'escalate').length,
      commentsFollowUp: flaggedComments.filter(c => c.tier === 'followup').length,
    };
    return { region, school: schoolF, from, to, generatedAt: now.toISOString(), totals,
      schools: schoolList, tutors: tutorList, issues, incompletes, missingTutor, missingScholar, pullouts, scholarPullouts, flaggedComments,
      unavailableRepeat, reasonOutliers, slFollowUp };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // XLSX — plain data tabs. Headers only, no narrative text.
  // ─────────────────────────────────────────────────────────────────────────
  const fmtPct = v => v === null || v === undefined ? '' : v;
  function sheetSpecs(R) {
    return [
      ['Campus Summary', ['Region', 'District', 'School', 'Support Level', 'Sessions Delivered', 'Scholar Attendance %', 'Tutor Attendance %',
        'Tutor Survey Capture %', 'Scholar Survey Capture %', 'Incomplete Sessions', 'Missing Tutor Surveys', 'Missing Tutor Surveys - Still Open',
        'Missing Scholar Surveys', 'Missing Scholar Surveys - Still Open', 'Missed Reason Blank', 'Attendance Fixes', 'Teacher Pull-outs', 'Teacher Pull-outs % of Scholar Absences', 'Whole-Group Pull-outs to Review', 'Archived Scholars on Roster'],
        R.schools.map(c => [c.region, c.district, c.school, c.support, c.delivered, fmtPct(c.scholarAttendance), fmtPct(c.tutorAttendance),
          fmtPct(c.tutorSurveyCapture), fmtPct(c.scholarSurveyCapture), c.incomplete, c.missingTutorSurveys, c.missingTutorSurveysOpen,
          c.missingScholarSurveys, c.missingScholarSurveysOpen, c.blankReasons, c.dataFixes, c.teacherPullouts, c.teacherPulloutShare, c.wholeGroupReview, c.archivedOnRoster])],
      ['Tutor Actions', ['Region', 'School', 'Tutor', 'Pearl Tutor ID', 'Sessions Delivered', 'Incomplete Sessions', 'Missing Tutor Surveys',
        'Missing Tutor Surveys - Still Open', 'Tutor Survey Capture %', 'Missing Scholar Surveys', 'Missing Scholar Surveys - Still Open', 'Scholar Survey Capture %', 'Missed Reason Blank', 'Attendance Not Recorded',
        'Session Status Mismatch', 'Wrong Missed Reason', 'Whole-Group Pull-outs to Review', 'Tutor Attendance %', 'Total Fixes'],
        R.tutors.map(t => [t.region, t.school, t.tutor, t.tutorId, t.delivered, t.incomplete, t.missingTutorSurveys, t.missingTutorSurveysOpen, fmtPct(t.tutorSurveyCapture),
          t.missingScholarSurveys, t.missingScholarSurveysOpen, fmtPct(t.scholarSurveyCapture), t.blankReasons, t.notRecorded, t.statusMismatch, t.wrongCategory,
          t.wholeGroupReview, fmtPct(t.tutorAttendance), t.totalFixes])],
      ['Attendance Fixes', ['Date', 'School', 'Tutor', 'Session', 'Session ID', 'Session Status', 'Session Attendance', 'Scholar', 'Scholar ID', 'Reason Entered', 'Issue', 'Owner'],
        R.issues.filter(i => i.issueKey !== 'incomplete').map(i => [i.date, i.school, i.tutor, i.session, i.sessionId, i.status, i.sessionAttendance,
          i.scholar || '', i.scholarId || '', i.reasonEntered || '', i.issue, i.owner])],
      ['Incomplete Sessions', ['Date', 'School', 'Tutor', 'Session', 'Session ID'],
        R.incompletes.map(i => [i.date, i.school, i.tutor, i.session, i.sessionId])],
      ['Missing Tutor Surveys', ['Date', 'School', 'Tutor', 'Session', 'Session ID', 'Survey Window (7 days)', 'Editable Until'],
        R.missingTutor.map(i => [i.date, i.school, i.tutor, i.session, i.sessionId, i.surveyStatus, i.editableUntil])],
      ['Missing Scholar Surveys', ['Date', 'School', 'Tutor', 'Session', 'Session ID', 'Scholar', 'Scholar ID', 'Survey Window (7 days)', 'Editable Until'],
        R.missingScholar.map(i => [i.date, i.school, i.tutor, i.session, i.sessionId, i.scholar, i.scholarId, i.surveyStatus, i.editableUntil])],
      ['Teacher Pull-outs', ['Date', 'School', 'Tutor', 'Session', 'Session ID', 'Scholar', 'Scholar ID', 'Whole Group'],
        R.pullouts.map(i => [i.date, i.school, i.tutor, i.session, i.sessionId, i.scholar, i.scholarId, i.wholeGroup])],
      ['Pull-outs by Scholar', ['School', 'Scholar', 'Scholar ID', 'Teacher Pull-outs', 'Most Recent'],
        R.scholarPullouts.map(x => [x.school, x.scholar, x.scholarId, x.pullouts, x.lastDate])],
      // SL-owned follow-ups. Status / Notes are left blank for the SL to fill in.
      ['Site Leader Follow-up', ['School', 'Item', 'Scholar / Session / Tutor', 'Tutor', 'Date(s)', 'Next Step', 'Status', 'Notes'],
        (R.slFollowUp || []).map(x => [x.school, x.item, x.who, x.tutor, x.dates, x.step, '', ''])],
      ['Repeat Unavailable', ['School', 'Scholar', 'Scholar ID', 'Tutor(s)', 'Times', 'Logged Unavailable', 'Reason Blank', 'Dates', 'Most Recent'],
        (R.unavailableRepeat || []).map(x => [x.school, x.scholar, x.scholarId, x.tutors, x.times, x.unavailable, x.blank, x.dates, x.lastDate])],
      ['Reason Mix Check', ['School', 'Tutor', 'Missed Rows With a Reason', 'Most-Used Reason', 'Tutor Share %', 'Other Tutors at School Share %', 'Other Tutors Missed Rows'],
        (R.reasonOutliers || []).map(x => [x.school, x.tutor, x.misses, x.topReason, x.tutorShare, x.siteShare, x.siteMisses])],
      // Status / Owner / Follow-up Notes are left blank for the team to fill in.
      ['Flagged Comments', ['Priority', 'Category', 'Date', 'School', 'Tutor', 'Session', 'Session ID', 'From', 'Scholar', 'Overall Rating',
        'Comment', 'Suggested Follow-up', 'Status', 'Owner', 'Follow-up Notes', 'Comment ID'],
        (R.flaggedComments || []).map(c => [c.tierLabel, c.categories.join('; '), c.date, c.school, c.tutor, c.session, c.sessionId,
          c.from === 'tutor' ? 'Tutor (' + c.field.toLowerCase() + ')' : 'Scholar survey', c.from === 'scholar' ? c.scholar : '', c.rating,
          c.text, c.step, '', '', '', c.id])],
    ];
  }

  function buildWorkbook(XLSX, R) {
    const wb = XLSX.utils.book_new();
    sheetSpecs(R).forEach(([name, head, rows]) => {
      const ws = XLSX.utils.aoa_to_sheet([head].concat(rows));
      ws['!cols'] = head.map((h, i) => ({ wch: Math.min(48, Math.max(h.length, ...rows.slice(0, 300).map(r => String(r[i] == null ? '' : r[i]).length)) + 2) }));
      ws['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: Math.max(rows.length, 1), c: head.length - 1 } }) };
      ws['!freeze'] = { xSplit: 0, ySplit: 1 };
      XLSX.utils.book_append_sheet(wb, ws, name);
    });
    return wb;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PDF — 1–2 pages: totals, campus table, tutor action list
  // ─────────────────────────────────────────────────────────────────────────
  function buildPDF(jsPDF, R, scopeLabel) {
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'letter' });
    const PW = 279.4, PH = 215.9, ML = 12, MR = PW - 12, W = MR - ML;
    const NAVY = [27, 42, 74], RED = [192, 57, 43], AMBER = [217, 119, 6], GREEN = [22, 128, 61], MUTED = [107, 114, 128];
    const ascii = s => String(s == null ? '' : s).replace(/[–—]/g, '-').replace(/[^\x20-\x7E\xA0-\xFF]/g, '');
    const P = v => v === null || v === undefined ? '--' : v + '%';
    const gen = new Date(R.generatedAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

    doc.setFillColor(...NAVY); doc.rect(0, 0, PW, 20, 'F');
    doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold'); doc.setFontSize(15);
    doc.text('Support Report  -  ' + ascii(scopeLabel), ML, 10);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8);
    doc.text('Generated ' + gen + (R.from || R.to ? '  -  Sessions ' + (R.from || 'start') + ' to ' + (R.to || 'today') : '') + '  -  Full detail in the Excel download', ML, 16);

    // Totals strip
    const T = R.totals;
    const tiles = [
      [T.incomplete, 'Incomplete Sessions'], [T.missingTutorSurveys, 'Missing Tutor Surveys'], [T.missingScholarSurveys, 'Missing Scholar Surveys'],
      [T.blankReasons, 'Missed Reason Blank'], [T.statusMismatch + T.wrongCategory + T.notRecorded, 'Other Attendance Fixes'],
      [T.teacherPullouts, 'Teacher Pull-outs'], [T.wholeGroupReview, 'Whole-Group Pull-outs to Review'],
      [T.cancelFixes || 0, 'Cancellation Fixes'],
    ];
    const tw = (W - 2 * (tiles.length - 1)) / tiles.length;
    tiles.forEach(([v, l], i) => {
      const x = ML + i * (tw + 2);
      doc.setDrawColor(210, 215, 222); doc.setFillColor(255, 255, 255); doc.roundedRect(x, 24, tw, 15, 1.5, 1.5, 'FD');
      doc.setFont('helvetica', 'bold'); doc.setFontSize(13); doc.setTextColor(...(v > 0 ? RED : GREEN));
      doc.text(String(v), x + tw / 2, 31.5, { align: 'center' });
      doc.setFont('helvetica', 'normal'); doc.setFontSize(6.3); doc.setTextColor(...MUTED);
      doc.text(l, x + tw / 2, 36.5, { align: 'center' });
    });

    const supColor = v => v === 'High' ? RED : v === 'Medium' ? AMBER : GREEN;
    const tgtColor = (v, t) => v === null || v === undefined ? null : v >= t ? GREEN : RED;
    doc.setFont('helvetica', 'bold'); doc.setFontSize(9.5); doc.setTextColor(...NAVY);
    doc.text('Campus Support', ML, 46);
    doc.autoTable({
      startY: 48, margin: { left: ML, right: PW - MR }, theme: 'plain',
      head: [['School', 'Support', 'Sessions', 'Scholar Att.', 'Tutor Att.', 'Tutor Survey', 'Scholar Survey', 'Incomplete', 'Missing Tutor Surveys', 'Reason Blank', 'Attendance Fixes', 'Teacher Pull-outs']],
      body: R.schools.map(c => [ascii(c.school), c.support, c.delivered, P(c.scholarAttendance), P(c.tutorAttendance), P(c.tutorSurveyCapture),
        P(c.scholarSurveyCapture), c.incomplete, c.missingTutorSurveys, c.blankReasons, c.dataFixes, c.teacherPullouts + (c.teacherPulloutShare ? ' (' + c.teacherPulloutShare + '%)' : '')]),
      styles: { fontSize: 7, cellPadding: 1.2, font: 'helvetica', textColor: [45, 45, 45] },
      headStyles: { fillColor: NAVY, textColor: [255, 255, 255], fontStyle: 'bold', halign: 'center', fontSize: 6.8 },
      alternateRowStyles: { fillColor: [247, 249, 252] },
      columnStyles: { 0: { cellWidth: 52 }, 1: { halign: 'center' }, 2: { halign: 'center' }, 3: { halign: 'center' }, 4: { halign: 'center' }, 5: { halign: 'center' },
        6: { halign: 'center' }, 7: { halign: 'center' }, 8: { halign: 'center' }, 9: { halign: 'center' }, 10: { halign: 'center' }, 11: { halign: 'center' } },
      didParseCell: d => {
        if (d.section !== 'body') return;
        const c = R.schools[d.row.index]; let col = null;
        if (d.column.index === 1) col = supColor(c.support);
        if (d.column.index === 3) col = tgtColor(c.scholarAttendance, TARGET.scholAtt);
        if (d.column.index === 4) col = tgtColor(c.tutorAttendance, TARGET.tutorAtt);
        if (d.column.index === 5) col = tgtColor(c.tutorSurveyCapture, TARGET.capture);
        if (d.column.index === 6) col = tgtColor(c.scholarSurveyCapture, TARGET.capture);
        if ([7, 8, 9, 10].includes(d.column.index) && Number(d.cell.raw) > 0) col = RED;
        if (d.column.index === 11 && c.teacherPulloutShare > 10) col = RED;
        if (col) { d.cell.styles.textColor = col; d.cell.styles.fontStyle = 'bold'; }
      },
    });

    let y = doc.lastAutoTable.finalY + 7;
    if (y > PH - 40) { doc.addPage(); y = 14; }
    doc.setFont('helvetica', 'bold'); doc.setFontSize(9.5); doc.setTextColor(...NAVY);
    doc.text('Tutor Action List (' + R.tutors.length + ')', ML, y);
    doc.autoTable({
      startY: y + 2, margin: { left: ML, right: PW - MR }, theme: 'plain',
      head: [['Tutor', 'School', 'Incomplete', 'Missing Tutor Surveys', 'Missing Scholar Surveys', 'Reason Blank', 'Not Recorded', 'Status Mismatch', 'Wrong Reason', 'Whole-Group Review', 'Tutor Att.', 'Total Fixes']],
      body: R.tutors.map(t => [ascii(t.tutor), ascii(t.school), t.incomplete, t.missingTutorSurveys, t.missingScholarSurveys, t.blankReasons, t.notRecorded,
        t.statusMismatch, t.wrongCategory, t.wholeGroupReview, P(t.tutorAttendance), t.totalFixes]),
      styles: { fontSize: 7, cellPadding: 1.1, font: 'helvetica', textColor: [45, 45, 45] },
      headStyles: { fillColor: NAVY, textColor: [255, 255, 255], fontStyle: 'bold', halign: 'center', fontSize: 6.8 },
      alternateRowStyles: { fillColor: [247, 249, 252] },
      columnStyles: { 0: { cellWidth: 40 }, 1: { cellWidth: 48 }, 2: { halign: 'center' }, 3: { halign: 'center' }, 4: { halign: 'center' }, 5: { halign: 'center' },
        6: { halign: 'center' }, 7: { halign: 'center' }, 8: { halign: 'center' }, 9: { halign: 'center' }, 10: { halign: 'center' }, 11: { halign: 'center', fontStyle: 'bold' } },
      didParseCell: d => {
        if (d.section !== 'body') return;
        const t = R.tutors[d.row.index];
        if (d.column.index >= 2 && d.column.index <= 8 && Number(d.cell.raw) > 0) { d.cell.styles.textColor = RED; d.cell.styles.fontStyle = 'bold'; }
        if (d.column.index === 9 && Number(d.cell.raw) > 0) { d.cell.styles.textColor = AMBER; d.cell.styles.fontStyle = 'bold'; }
        if (d.column.index === 10 && t.tutorAttendance !== null && t.tutorAttendance < TARGET.tutorAtt) { d.cell.styles.textColor = RED; d.cell.styles.fontStyle = 'bold'; }
      },
    });

    const n = doc.getNumberOfPages();
    for (let i = 1; i <= n; i++) {
      doc.setPage(i); doc.setFontSize(6.5); doc.setTextColor(...MUTED); doc.setFont('helvetica', 'normal');
      doc.text('Targets: scholar attendance 80%, tutor attendance 90%, survey capture 80%, teacher pull-outs 10% of scholar absences.  Whole-group pull-outs are not counted against the tutor.', ML, PH - 6);
      doc.text('NJTC Pearl Operations  -  Page ' + i + ' of ' + n, MR, PH - 6, { align: 'right' });
    }
    return doc;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // TUTORS TO CHECK IN WITH — the tutor-side twin of "Scholars to check in
  // with" on the partner report: a real pattern, not a single slip.
  //   • tutor attendance under 90% across 3+ recorded sessions, or
  //   • 3+ open Pearl items the tutor fixes (incomplete sessions, missing
  //     tutor surveys, blank missed reasons, attendance not recorded, status
  //     mismatches, wrong missed reason).
  // Lowest tutor attendance first, then most open items.
  // ─────────────────────────────────────────────────────────────────────────
  const TUTOR_CHECKIN = { minSessions: 3, minFixes: 3 };
  const TUTOR_RULE = 'Tutors with a real pattern in the last two weeks: tutor attendance under 90% across 3+ sessions, or 3+ open Pearl items to fix ' +
    '(incomplete sessions, tutor surveys still inside the 7-day window, blank missed reasons, attendance not recorded or mismatched). A quick check-in from the Site Leader or PM usually clears this up.';
  function tutorsToCheckIn(R) {
    const plural = (n, w) => n + ' ' + w + (n === 1 ? '' : 's');
    return R.tutors.map(t => {
      const lowAtt = t.tutorAttendance !== null && t.tutorSessions >= TUTOR_CHECKIN.minSessions && t.tutorAttendance < TARGET.tutorAtt;
      const fixes = t.totalFixes;
      if (!lowAtt && fixes < TUTOR_CHECKIN.minFixes) return null;
      const why = [];
      if (lowAtt) why.push('Attendance ' + t.tutorAttendance + '% (' + plural(t.tutorAbsences, 'absence') + ' in ' + t.tutorSessions + ')');
      if (t.missingTutorSurveys) why.push(plural(t.missingTutorSurveys, 'missing tutor survey') + ' (' + t.missingTutorSurveysOpen + ' still open)');
      if (t.incomplete) why.push(plural(t.incomplete, 'incomplete session'));
      if (t.blankReasons) why.push(plural(t.blankReasons, 'blank missed reason'));
      const other = t.notRecorded + t.statusMismatch + t.wrongCategory;
      if (other) why.push(plural(other, 'attendance fix'));
      return Object.assign({}, t, { lowAtt, why: why.join('; ') });
    }).filter(Boolean).sort((a, b) => (b.lowAtt - a.lowAtt) || ((a.lowAtt ? a.tutorAttendance - b.tutorAttendance : 0)) || b.totalFixes - a.totalFixes || a.tutor.localeCompare(b.tutor));
  }

  // ─────────────────────────────────────────────────────────────────────────
  // UI — modal in Pearl Ops (Programming + Data)
  //   PDF   → Region Weekly Report: the Partner Weekly Report layout
  //           (partner/partner-report.js) for a region, with "Tutors to check
  //           in with" and a per-school tutor view for the Central Team.
  //   Excel → the Support Report detail tabs for a rolling two-week window
  //           ending with the chosen week (recent enough for tutors to
  //           remember and fix). "Full school year to date" keeps the YTD
  //           view for program-level reporting.
  // ─────────────────────────────────────────────────────────────────────────
  const REGION_NAME = { NE: 'North-East', SW: 'South-West' };
  let _region = 'ALL';
  let _bundle = null; // full current-SY Pearl bundle (all districts)
  const escA = v => String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');

  let _wantWeek = '';
  function open(region, opts) {
    _wantWeek = (opts && opts.weekOf) || '';
    if (region === 'NE' || region === 'SW' || region === 'ALL') _region = region;
    if (!window.po || typeof window.po.getFieldSupportInput !== 'function') { alert('Pearl Ops data not ready yet - try again in a moment.'); return; }
    let m = document.getElementById('fsModal');
    if (!m) {
      m = document.createElement('div'); m.id = 'fsModal';
      m.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:10001;display:flex;align-items:center;justify-content:center;padding:1rem';
      m.addEventListener('click', e => { if (e.target === m) m.style.display = 'none'; });
      document.body.appendChild(m);
    }
    const lbl = 'font-size:.7rem;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:var(--muted);margin-bottom:.35rem';
    const inp = 'width:100%;padding:.5rem .65rem;border:1.5px solid var(--border);border-radius:8px;font:inherit;font-size:.85rem;background:var(--bg);color:var(--text);box-sizing:border-box';
    m.innerHTML = `
      <div role="dialog" aria-modal="true" aria-labelledby="fsTitle" style="background:var(--surface);border-radius:16px;width:520px;max-width:96vw;max-height:90vh;overflow:auto;box-shadow:0 24px 64px rgba(0,0,0,.3)">
        <div style="background:#0a1628;border-bottom:3px solid #f0a500;padding:1.1rem 1.4rem;border-radius:16px 16px 0 0;display:flex;justify-content:space-between;align-items:center">
          <div><div id="fsTitle" style="color:#fff;font-weight:700">Region Weekly Report</div>
          <div style="color:rgba(255,255,255,.75);font-size:.78rem;margin-top:.15rem">The Partner Weekly Report layout for a region, with tutors to check in with</div></div>
          <button type="button" aria-label="Close" onclick="document.getElementById('fsModal').style.display='none'" style="background:rgba(255,255,255,.15);border:none;color:#fff;border-radius:8px;width:32px;height:32px;cursor:pointer">✕</button>
        </div>
        <div style="padding:1.25rem 1.4rem">
          <div style="margin-bottom:.85rem"><div style="${lbl}">Region</div><div style="display:flex;gap:.4rem;flex-wrap:wrap">
            ${['ALL', 'NE', 'SW'].map(r => `<button type="button" data-fs-region="${r}" style="padding:.35rem .85rem;font-size:.8rem;font-weight:600;border-radius:8px;cursor:pointer;border:1.5px solid var(--border);background:var(--surface);color:var(--text)">${r === 'ALL' ? 'All Regions' : r + ' Region'}</button>`).join('')}
          </div></div>
          <div style="margin-bottom:.85rem"><label for="fsSchool" style="${lbl};display:block">School (optional)</label>
            <select id="fsSchool" style="${inp}"><option value="">All schools in the region</option></select></div>
          <div style="margin-bottom:1.1rem"><label for="fsWeek" style="${lbl};display:block">Week (Support Report covers this week and the week before)</label>
            <select id="fsWeek" style="${inp}" disabled><option value="">Loading Pearl weeks…</option></select></div>
          <div style="display:flex;gap:.6rem">
            <button type="button" id="fsPdfBtn" onclick="njtcFieldSupport.download('pdf')" style="flex:1;padding:.7rem;border:none;border-radius:10px;background:linear-gradient(135deg,#1e3a5f,#2a5298);color:#fff;font-weight:700;cursor:pointer">⬇ Weekly Report (PDF)</button>
            <button type="button" onclick="njtcFieldSupport.download('xlsx')" style="flex:1;padding:.7rem;border:none;border-radius:10px;background:#166534;color:#fff;font-weight:700;cursor:pointer">⬇ Support Detail (Excel)</button>
          </div>
          <div style="font-size:.72rem;color:var(--muted);margin-top:.55rem">Internal - for the Central Team, not for partners. Partners get their own version from the Partner PDF button. The Excel's <b>Site Leader Follow-up</b> tab lists what each SL owns (repeat unavailable scholars, cancellations, reason-mix checks) - filter it by school.</div>
          <div id="fsStatus" role="status" aria-live="polite" style="font-size:.78rem;color:var(--muted);margin-top:.5rem;min-height:1em"></div>
        </div>
      </div>`;
    const paint = () => m.querySelectorAll('[data-fs-region]').forEach(b => {
      const on = b.dataset.fsRegion === _region;
      b.style.background = on ? 'var(--blue-mid)' : 'var(--surface)'; b.style.color = on ? '#fff' : 'var(--text)';
      b.style.borderColor = on ? 'var(--blue-mid)' : 'var(--border)';
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    m.querySelectorAll('[data-fs-region]').forEach(b => b.addEventListener('click', () => { _region = b.dataset.fsRegion; paint(); fillSchools(); fillWeeks(); }));
    document.getElementById('fsSchool').addEventListener('change', fillWeeks);
    paint();
    fillSchools();
    m.style.display = 'flex';
    loadBundle().then(fillWeeks).catch(e => { console.error('[Region Report]', e); status('Could not load Pearl data - the Excel still works; try the PDF again in a moment.', true); });
  }

  function status(msg, isErr) { const st = document.getElementById('fsStatus'); if (st) { st.textContent = msg || ''; st.style.color = isErr ? '#b91c1c' : ''; } }

  function fillSchools() {
    const sel = document.getElementById('fsSchool'); if (!sel) return;
    const input = window.po.getFieldSupportInput(_region);
    const names = (input.schoolNames || []).filter(n => _region === 'ALL' || Object.values(input.sessions || {}).some(s => s.school === n && input.regionOf(s.school, s.district) === _region));
    const prev = sel.value;
    sel.innerHTML = '<option value="">All schools' + (_region === 'ALL' ? '' : ' in the region') + '</option>' + names.map(n => `<option value="${escA(n)}">${escA(n)}</option>`).join('');
    if (names.includes(prev)) sel.value = prev;
  }

  async function loadBundle() {
    const PR = window.NJTCPartnerReport;
    if (!PR) throw new Error('Report module not loaded - refresh the page.');
    if (_bundle) return _bundle;
    status('Loading Pearl data (first load can take ~20 seconds)…');
    const pearl = await PR.loadPearl();
    _bundle = PR.bundleForEntry(pearl, { name: 'NJTC Central Team', level: 'Admin', scopeType: 'all' });
    status('');
    return _bundle;
  }

  // The bundle for the chosen region (and school) — same scope rules as a
  // Regional partner account, so the numbers match that partner view.
  function regionBundle() {
    const PR = window.NJTCPartnerReport;
    const reg = REGION_NAME[_region];
    const entry = reg ? { scopeType: 'region', region: reg } : { scopeType: 'all' };
    const keep = (rows, dIdx, sIdx) => rows.filter(r => !PR.isArchivedName(r[sIdx]) && !PR.isArchivedName(r[dIdx]) && PR.scopeMatches(entry, (r[dIdx] || '').trim(), (r[sIdx] || '').trim()));
    return {
      generatedAt: _bundle.generatedAt, season: _bundle.season,
      identity: { name: 'NJTC Central Team', level: reg ? 'Regional' : 'Admin', region: reg || 'ALL', district: 'ALL', schools: ['ALL'] },
      attendance: keep(_bundle.attendance, PR.ATT.DISTRICT, PR.ATT.SCHOOL),
      tutorSurveys: keep(_bundle.tutorSurveys, PR.INST.DISTRICT, PR.INST.SCHOOL),
      scholarSurveys: keep(_bundle.scholarSurveys, PR.STU.DISTRICT, PR.STU.SCHOOL),
      sessions: keep(_bundle.sessions, PR.SESS.DISTRICT, PR.SESS.SCHOOL),
    };
  }

  function fillWeeks() {
    const sel = document.getElementById('fsWeek'); if (!sel || !_bundle) return;
    const PR = window.NJTCPartnerReport;
    const school = (document.getElementById('fsSchool') || {}).value || '';
    let b = regionBundle();
    if (school) b = Object.assign({}, b, { attendance: PR.scoped(b.attendance, PR.ATT.DISTRICT, PR.ATT.SCHOOL, null, { school }) });
    const prev = sel.value;
    const weeks = PR.allWeeks(b).reverse();
    const want = _wantWeek && PR.weekBucket(_wantWeek.replace(/^(\d{4})-(\d{2})-(\d{2})$/, '$2/$3/$1'));
    // Opened from Home / PIE / Site Leader Flags on a week this scope has no
    // attendance rows for yet (e.g. Monday morning): still offer that week so
    // the report covers exactly the window the caller showed.
    if (want && !weeks.some(w => w.key === want.key)) { weeks.push(want); weeks.sort((x, y) => y.key.localeCompare(x.key)); }
    sel.innerHTML = weeks.map(w => `<option value="${w.key}">Week of ${escA(PR.weekRangeLabel(w.key))}</option>`).join('') + '<option value="ALL">Full school year to date</option>';
    if (want && weeks.some(w => w.key === want.key)) { sel.value = want.key; _wantWeek = ''; }
    else sel.value = weeks.some(w => w.key === prev) || prev === 'ALL' ? prev : (weeks.length ? weeks[0].key : 'ALL');
    sel.disabled = false;
  }

  const ymdOf = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  function weekEnd(key) {
    if (!key || key === 'ALL') return '';
    const d = new Date(key + 'T12:00:00'); d.setDate(d.getDate() + 6);
    return ymdOf(d);
  }
  // Rolling window: the chosen week plus the week before it (14 days).
  const WINDOW_WEEKS = 2;
  function windowStart(key) {
    if (!key || key === 'ALL') return '';
    const d = new Date(key + 'T12:00:00'); d.setDate(d.getDate() - 7 * (WINDOW_WEEKS - 1));
    return ymdOf(d);
  }

  // Support Report numbers: rolling two weeks ending with the chosen week,
  // or the full school year when "Full school year to date" is chosen.
  function currentReport() {
    const input = window.po.getFieldSupportInput(_region);
    const week = (document.getElementById('fsWeek') || {}).value || 'ALL';
    input.region = _region;
    input.school = (document.getElementById('fsSchool') || {}).value || '';
    input.from = windowStart(week);
    input.to = weekEnd(week);
    return computeFieldSupport(input);
  }
  function windowText(R) {
    return R.from ? 'last two weeks, ' + R.from + ' to ' + R.to : 'school year to date';
  }

  // ─────────────────────────────────────────────────────────────────────────
  // DEFAULT WINDOW — shared by Home, PIE and Site Leader Flags so every place
  // shows the same numbers as the Support Report opened on the same week:
  // the Monday–Sunday week of the latest session that has already started,
  // plus the week before it.
  // ─────────────────────────────────────────────────────────────────────────
  function mondayKey(ymd) {
    const d = new Date(ymd + 'T12:00:00'); if (isNaN(d)) return '';
    const day = d.getDay(); d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day));
    return ymdOf(d);
  }
  function latestWeekKey(input) {
    const now = (input && input.now) || new Date(), today = ymdOf(now);
    let last = '';
    ((input && input.sessions) || []).forEach(s => {
      const y = s && toYMD(s.start);
      if (y && y <= today && y > last) { const d = new Date(s.start); if (isNaN(d) || d <= now) last = y; }
    });
    return mondayKey(last || today);
  }
  function defaultWindow(input) {
    const key = latestWeekKey(input);
    return { weekKey: key, from: windowStart(key), to: weekEnd(key) };
  }
  // The Support Report for a scope. opts.ytd → full school year; otherwise
  // the default two-week window.
  function reportFor(input, opts) {
    opts = opts || {};
    const w = opts.ytd ? { weekKey: '', from: '', to: '' } : defaultWindow(input);
    const R = computeFieldSupport(Object.assign({}, input, { region: opts.region || 'ALL', school: opts.school || '', from: w.from, to: w.to }));
    R.weekKey = w.weekKey;
    return R;
  }
  const shortDate = ymd => { const d = new Date(ymd + 'T12:00:00'); return isNaN(d) ? ymd : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }); };
  function windowLabel(R) {
    return R.from ? shortDate(R.from) + ' – ' + shortDate(R.to) + ', ' + R.to.slice(0, 4) : 'school year to date';
  }

  // ─────────────────────────────────────────────────────────────────────────
  // SITE LEADER FLAGS — glowing button in Pearl Operations (Programming +
  // Data). Same list as the Excel "Site Leader Follow-up" tab, default window.
  // ─────────────────────────────────────────────────────────────────────────
  const FLAG_KINDS = [
    { key: 'unavail', label: 'Scholar unavailable / no reason 2+ times', test: x => /^Scholar unavailable/.test(x.item) },
    { key: 'cancel',  label: 'Whole group missed - should be a cancellation', test: x => /^Whole group missed/.test(x.item) },
    { key: 'noreas',  label: 'Cancelled with no reason (FYI)', test: x => /^Cancelled with no reason/.test(x.item) },
    { key: 'mix',     label: 'Reason-mix check', test: x => /^Reason-mix check/.test(x.item) },
  ];
  let _flagsRegion = 'ALL', _btnSig = '';
  function flagsInput() {
    if (typeof window === 'undefined' || !window.po || typeof window.po.getFieldSupportInput !== 'function') return null;
    const input = window.po.getFieldSupportInput('ALL');
    return input && input.sessions && input.sessions.length ? input : null;
  }
  function refreshFlagsButton() {
    try {
      const btn = document.getElementById('poSlFlagsBtn'); if (!btn) return;
      const input = flagsInput(); if (!input) return;
      const sig = (input.attRows || []).length + '|' + input.sessions.length + '|' + ymdOf(input.now || new Date()) + '|' + (input.hasCancelReasons ? 1 : 0);
      if (sig === _btnSig) return;
      _btnSig = sig;
      const R = reportFor(input, { region: 'ALL' });
      const n = R.slFollowUp.length;
      const nEl = document.getElementById('poSlFlagsN'); if (nEl) nEl.textContent = n;
      btn.classList.toggle('fs-flags-glow', n > 0);
      btn.classList.toggle('fs-flags-clear', n === 0);
      btn.title = n > 0
        ? n + ' Site Leader follow-up' + (n === 1 ? '' : 's') + ' for ' + windowLabel(R) + ' - click to see them by school'
        : 'No Site Leader follow-ups for ' + windowLabel(R);
    } catch (e) { console.warn('[SL Flags]', e); }
  }
  function openFlags(region) {
    if (region === 'NE' || region === 'SW' || region === 'ALL') _flagsRegion = region;
    const input = flagsInput();
    if (!input) { alert('Pearl Ops data not ready yet - try again in a moment.'); return; }
    const R = reportFor(input, { region: _flagsRegion });
    let m = document.getElementById('fsFlagsModal');
    if (!m) {
      m = document.createElement('div'); m.id = 'fsFlagsModal';
      m.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:10001;display:flex;align-items:center;justify-content:center;padding:1rem';
      m.addEventListener('click', e => { if (e.target === m) m.style.display = 'none'; });
      document.body.appendChild(m);
    }
    const counts = FLAG_KINDS.map(k => ({ k, n: R.slFollowUp.filter(k.test).length }));
    const bySchool = {};
    R.slFollowUp.forEach(x => { (bySchool[x.school] = bySchool[x.school] || []).push(x); });
    const th = 'text-align:left;padding:.4rem .5rem;font-size:.7rem;text-transform:uppercase;letter-spacing:.05em;color:var(--muted);border-bottom:1px solid var(--border)';
    const td = 'padding:.45rem .5rem;font-size:.8rem;vertical-align:top;border-bottom:1px solid var(--border)';
    const body = Object.keys(bySchool).sort().map(sc => `
      <div style="margin-top:1rem"><div style="font-weight:700;font-size:.9rem;color:var(--text);margin-bottom:.3rem">${escA(sc)} <span style="font-weight:500;color:var(--muted);font-size:.78rem">· ${bySchool[sc].length}</span></div>
      <div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse"><thead><tr><th style="${th}">Item</th><th style="${th}">Scholar / Session / Tutor</th><th style="${th}">Tutor</th><th style="${th}">Date(s)</th><th style="${th}">Next step</th></tr></thead><tbody>
      ${bySchool[sc].map(x => `<tr><td style="${td};font-weight:600">${escA(x.item)}</td><td style="${td}">${escA(x.who)}</td><td style="${td}">${escA(x.tutor)}</td><td style="${td};white-space:nowrap">${escA(x.dates)}</td><td style="${td}">${escA(x.step)}</td></tr>`).join('')}
      </tbody></table></div></div>`).join('');
    m.innerHTML = `
      <div role="dialog" aria-modal="true" aria-labelledby="fsFlagsTitle" style="background:var(--surface);border-radius:16px;width:980px;max-width:96vw;max-height:90vh;overflow:auto;box-shadow:0 24px 64px rgba(0,0,0,.3)">
        <div style="background:#0a1628;border-bottom:3px solid #f0a500;padding:1.1rem 1.4rem;border-radius:16px 16px 0 0;display:flex;justify-content:space-between;align-items:center;gap:1rem">
          <div><div id="fsFlagsTitle" style="color:#fff;font-weight:700">🚩 Site Leader Flags</div>
          <div style="color:rgba(255,255,255,.75);font-size:.78rem;margin-top:.15rem">What Site Leaders follow up on (not tutor data entry) · ${escA(windowLabel(R))} · same list as the Excel "Site Leader Follow-up" tab</div></div>
          <button type="button" aria-label="Close" onclick="document.getElementById('fsFlagsModal').style.display='none'" style="background:rgba(255,255,255,.15);border:none;color:#fff;border-radius:8px;width:32px;height:32px;cursor:pointer;flex-shrink:0">✕</button>
        </div>
        <div style="padding:1.1rem 1.4rem">
          <div style="display:flex;gap:.4rem;flex-wrap:wrap;align-items:center;margin-bottom:.8rem">
            ${['ALL', 'NE', 'SW'].map(r => `<button type="button" aria-pressed="${r === _flagsRegion}" onclick="njtcFieldSupport.openFlags('${r}')" style="padding:.35rem .85rem;font-size:.8rem;font-weight:600;border-radius:8px;cursor:pointer;border:1.5px solid ${r === _flagsRegion ? 'var(--blue-mid)' : 'var(--border)'};background:${r === _flagsRegion ? 'var(--blue-mid)' : 'var(--surface)'};color:${r === _flagsRegion ? '#fff' : 'var(--text)'}">${r === 'ALL' ? 'All Regions' : r + ' Region'}</button>`).join('')}
            <span style="flex:1"></span>
            <button type="button" onclick="njtcFieldSupport.flagsExcel()" style="padding:.45rem .9rem;border:none;border-radius:8px;background:#166534;color:#fff;font-weight:700;cursor:pointer;font-size:.8rem">⬇ Support Detail (Excel)</button>
          </div>
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:.5rem">
            ${counts.map(c => `<div style="border:1px solid var(--border);border-radius:10px;padding:.55rem .7rem"><div style="font-size:1.25rem;font-weight:800;color:${c.n ? '#b91c1c' : '#15803d'}">${c.n}</div><div style="font-size:.74rem;color:var(--muted)">${escA(c.k.label)}</div></div>`).join('')}
          </div>
          ${R.slFollowUp.length ? body : '<div style="padding:1.5rem 0;text-align:center;color:var(--muted)">✅ Nothing for Site Leaders to follow up on in this window.</div>'}
          <div style="font-size:.72rem;color:var(--muted);margin-top:1rem;line-height:1.5">
            <b>Repeat unavailable:</b> a scholar logged "Scholar Unavailable; Out of the Classroom" or with no reason ${REPEAT_UNAVAILABLE}+ times in the window. Tutors choose Unavailable instead of guessing; the SL checks school attendance or asks the teacher at a natural break, then updates the reason in Pearl if known.
            <b>Should be a cancellation:</b> no scholar attended and a school/NJTC reason was logged as a missed reason; the SL cancels the session in Pearl with that reason.
            <b>Cancelled with no reason:</b> FYI only - Pearl locks the Canceled Reason once a session is cancelled, so remind whoever cancelled to choose one next time${input.hasCancelReasons ? '' : ' (Canceled Reason is only in the SY 26-27 Pearl data)'}.
            <b>Reason-mix check:</b> a tutor with ${REASON_MIX.minTutorMisses}+ missed rows who uses one reason on ${REASON_MIX.minShare}%+ of them, ${REASON_MIX.minGap}+ points more than the other tutors at the school (${REASON_MIX.minSiteMisses}+ rows). A prompt to review the reason guide, not proof the reason was wrong.
          </div>
        </div>
      </div>`;
    m.style.display = 'flex';
  }
  function flagsExcel() {
    const input = flagsInput();
    if (!input || !window.XLSX) { alert('Excel library or Pearl data not loaded - refresh and try again.'); return; }
    const R = reportFor(input, { region: _flagsRegion });
    window.XLSX.writeFile(buildWorkbook(window.XLSX, R), fileStem(R) + '.xlsx');
  }
  function scopeText(R) {
    return R.school || (R.region === 'ALL' ? 'All Regions' : R.region + ' Region');
  }
  function fileStem(R) {
    const s = (R.school || (R.region === 'ALL' ? 'All' : R.region + '-Region')).replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '');
    return 'NJTC-Support-Report-' + s + '-' + (R.to || new Date().toISOString().slice(0, 10));
  }

  async function download(kind) {
    try {
      status('Building…');
      const R = currentReport();
      if (kind === 'xlsx') {
        if (!window.XLSX) throw new Error('Excel library not loaded - check your connection and refresh.');
        window.XLSX.writeFile(buildWorkbook(window.XLSX, R), fileStem(R) + '.xlsx');
        status('Downloaded ' + fileStem(R) + '.xlsx');
        return;
      }
      await loadBundle();
      const school = (document.getElementById('fsSchool') || {}).value || '';
      const week = (document.getElementById('fsWeek') || {}).value || 'ALL';
      const schoolExtra = {};
      R.schools.forEach(c => { schoolExtra[c.school] = { tutorAttendance: c.tutorAttendance, support: c.support }; });
      const out = await window.NJTCPartnerReport.generatePDF(regionBundle(), { district: 'ALL', school: school || 'ALL', week }, {
        internal: { preparedFor: 'NJTC Central Team (internal)', tutors: tutorsToCheckIn(R), schoolExtra, supportWindow: windowText(R),
          tutorRule: R.from ? TUTOR_RULE : TUTOR_RULE.replace('in the last two weeks', 'year to date') },
      });
      status('Downloaded ' + out.name);
    } catch (e) {
      console.error('[Region Report]', e);
      status('Could not build the report: ' + e.message, true);
    }
  }

  const api = { open, download, computeFieldSupport, buildWorkbook, buildPDF, sheetSpecs, tutorsToCheckIn, TUTOR_RULE,
    defaultWindow, latestWeekKey, reportFor, windowLabel, openFlags, flagsExcel, refreshFlagsButton,
    REPEAT_UNAVAILABLE, REASON_MIX, UNAVAILABLE_REASON };
  if (typeof window !== 'undefined') window.njtcFieldSupport = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})();
