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
  };
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
      if (!school || /^\s*z{3}/i.test(school) || /^\s*z{3}/i.test(district || '')) return false;
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
    const tutors = {}, schools = {};

    const tutorRec = (s) => {
      const k = (s.instId || s.instructor || 'Unassigned') + '|' + (s.school || '');
      if (!tutors[k]) tutors[k] = { tutor: s.instructor || 'Unassigned', tutorId: s.instId || '', school: s.school || '', district: s.district || '',
        region: input.regionOf(s.school, s.district) || '', delivered: 0, tutorSurvElig: 0, tutorSurvDone: 0,
        scholSurvElig: 0, scholSurvDone: 0, tutAtt: 0, tutAbs: 0, issues: {} };
      return tutors[k];
    };
    const schoolRec = (s) => {
      const k = s.school || '';
      if (!schools[k]) schools[k] = { school: k, district: s.district || '', region: input.regionOf(s.school, s.district) || '',
        delivered: 0, stuAtt: 0, stuAbs: 0, tutAtt: 0, tutAbs: 0, tutorSurvElig: 0, tutorSurvDone: 0,
        scholSurvElig: 0, scholSurvDone: 0, ctPulls: 0, ctDenom: 0, issues: {} };
      return schools[k];
    };
    const sessBase = s => ({ date: toYMD(s.start), school: s.school || '', tutor: s.instructor || '', session: s.title || '', sessionId: s.id || '',
      status: s.status || '', sessionAttendance: s.attendance || '' });
    const addIssue = (s, key, extra) => {
      issues.push(Object.assign(sessBase(s), { issue: ISSUE[key], issueKey: key, owner: TUTOR_FIX.has(key) ? 'Tutor' : (key === 'archived' ? 'Site / Data' : 'Review') }, extra || {}));
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
      const tutorTrulyAbsent = [...tutorReasons].some(x => TUTOR_MISS.has(x));

      // Row-level checks (scholar rows)
      stuRows.forEach(r => {
        const st = r[ATT.ATT_STATUS] || '', reason = r[ATT.MISS_REASON] || '';
        const who = { scholar: r[ATT.USER] || '', scholarId: r[ATT.USER_ID] || '', reasonEntered: reason };
        if (st === 'Not recorded') addIssue(s, 'notRecorded', who);
        if (st !== 'Missed') return;
        if (!reason) addIssue(s, 'blankScholar', who);
        if (reason === ARCHIVED_REASON) addIssue(s, 'archived', who);
        if (reason === 'Tutor Absent' && tutorAttended && !tutorMissedRows.length) addIssue(s, 'wrongTutorAbs', who);
        if (tutorTrulyAbsent && reason && reason !== 'Tutor Absent' && classify(r) === 'absent') addIssue(s, 'wrongScholar', who);
        if (CT_REASONS.has(reason)) {
          const wholeGroup = status === 'Missed' && att === 'Missed' && [...tutorReasons].some(x => CT_REASONS.has(x));
          pullouts.push(Object.assign(sessBase(s), who, { wholeGroup: wholeGroup ? 'Yes' : 'No' }));
          c.ctPulls++;
        }
        if (classify(r) === 'absent' && reason) c.ctDenom++;
      });
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
      if (s.instId && tutorSurv.has(s.instId + '|' + s.id)) { t.tutorSurvDone++; c.tutorSurvDone++; }
      else missingTutor.push(sessBase(s));
      // Scholar survey: only scholars who attended can take it. If no
      // attendance rows matched, fall back to the full roster.
      const attendedIds = stuRows.length
        ? stuCls.filter(x => x.c === 'attended').map(x => x.r[ATT.USER_ID])
        : [...roster];
      const nameOf = {}; stuRows.forEach(r => { nameOf[r[ATT.USER_ID]] = r[ATT.USER] || ''; });
      attendedIds.forEach(uid => {
        t.scholSurvElig++; c.scholSurvElig++;
        if (scholSurv.has(uid + '|' + s.id)) { t.scholSurvDone++; c.scholSurvDone++; }
        else missingScholar.push(Object.assign(sessBase(s), { scholar: nameOf[uid] || '', scholarId: uid }));
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
        missingTutorSurveys: missingT,
        tutorSurveyCapture: pct(t.tutorSurvDone, t.tutorSurvElig),
        missingScholarSurveys: missingS,
        scholarSurveyCapture: pct(t.scholSurvDone, t.scholSurvElig),
        blankReasons: (t.issues.blankScholar || 0) + (t.issues.blankTutor || 0),
        notRecorded: t.issues.notRecorded || 0,
        statusMismatch: ['attWithMissed', 'partialAllAtt', 'mbsWithAtt', 'mbsTutorNotAtt', 'tutorMissedAtt', 'tutorRowMissed'].reduce((a, k) => a + (t.issues[k] || 0), 0),
        wrongCategory: (t.issues.wrongTutorAbs || 0) + (t.issues.wrongScholar || 0),
        wholeGroupReview: t.issues.wholeGroupCT || 0,
        tutorAttendance: pct(t.tutAtt, t.tutAtt + t.tutAbs),
        totalFixes: sumFix(t.issues) + missingT,
      };
    }).filter(t => t.totalFixes > 0 || t.wholeGroupReview > 0 || (t.tutorAttendance !== null && t.tutorAttendance < TARGET.tutorAtt))
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
        missingTutorSurveys: c.tutorSurvElig - c.tutorSurvDone,
        missingScholarSurveys: c.scholSurvElig - c.scholSurvDone,
        blankReasons: (c.issues.blankScholar || 0) + (c.issues.blankTutor || 0),
        dataFixes, teacherPullouts: c.ctPulls, teacherPulloutShare: ctShare,
        wholeGroupReview: c.issues.wholeGroupCT || 0,
        archivedOnRoster: c.issues.archived || 0,
      };
    }).sort((a, b) => ({ High: 0, Medium: 1, Low: 2 })[a.support] - ({ High: 0, Medium: 1, Low: 2 })[b.support] || b.dataFixes - a.dataFixes);

    const byDate = (a, b) => (b.date || '').localeCompare(a.date || '') || a.school.localeCompare(b.school);
    issues.sort(byDate); missingTutor.sort(byDate); missingScholar.sort(byDate); pullouts.sort(byDate); incompletes.sort(byDate);

    // Scholars pulled out 3+ times (dosage watch)
    const ctByScholar = {};
    pullouts.forEach(p => {
      const k = p.scholarId || p.scholar;
      if (!ctByScholar[k]) ctByScholar[k] = { scholar: p.scholar, scholarId: p.scholarId, school: p.school, pullouts: 0, lastDate: '' };
      ctByScholar[k].pullouts++;
      if (p.date > ctByScholar[k].lastDate) ctByScholar[k].lastDate = p.date;
    });
    const scholarPullouts = Object.values(ctByScholar).sort((a, b) => b.pullouts - a.pullouts);

    const totals = {
      schools: schoolList.length, tutors: tutorList.length,
      incomplete: incompletes.length, missingTutorSurveys: missingTutor.length, missingScholarSurveys: missingScholar.length,
      dataFixes: issues.filter(i => i.owner === 'Tutor' && i.issueKey !== 'incomplete').length,
      blankReasons: issues.filter(i => i.issueKey === 'blankScholar' || i.issueKey === 'blankTutor').length,
      statusMismatch: issues.filter(i => ['attWithMissed', 'partialAllAtt', 'mbsWithAtt', 'mbsTutorNotAtt', 'tutorMissedAtt', 'tutorRowMissed'].includes(i.issueKey)).length,
      wrongCategory: issues.filter(i => i.issueKey === 'wrongTutorAbs' || i.issueKey === 'wrongScholar').length,
      notRecorded: issues.filter(i => i.issueKey === 'notRecorded').length,
      wholeGroupReview: issues.filter(i => i.issueKey === 'wholeGroupCT').length,
      archived: issues.filter(i => i.issueKey === 'archived').length,
      teacherPullouts: pullouts.length, scholarsPulled3: scholarPullouts.filter(x => x.pullouts >= 3).length,
    };
    return { region, school: schoolF, from, to, generatedAt: now.toISOString(), totals,
      schools: schoolList, tutors: tutorList, issues, incompletes, missingTutor, missingScholar, pullouts, scholarPullouts };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // XLSX — plain data tabs. Headers only, no narrative text.
  // ─────────────────────────────────────────────────────────────────────────
  const fmtPct = v => v === null || v === undefined ? '' : v;
  function sheetSpecs(R) {
    return [
      ['Campus Summary', ['Region', 'District', 'School', 'Support Level', 'Sessions Delivered', 'Scholar Attendance %', 'Tutor Attendance %',
        'Tutor Survey Capture %', 'Scholar Survey Capture %', 'Incomplete Sessions', 'Missing Tutor Surveys', 'Missing Scholar Surveys',
        'Missed Reason Blank', 'Attendance Fixes', 'Teacher Pull-outs', 'Teacher Pull-outs % of Scholar Absences', 'Whole-Group Pull-outs to Review', 'Archived Scholars on Roster'],
        R.schools.map(c => [c.region, c.district, c.school, c.support, c.delivered, fmtPct(c.scholarAttendance), fmtPct(c.tutorAttendance),
          fmtPct(c.tutorSurveyCapture), fmtPct(c.scholarSurveyCapture), c.incomplete, c.missingTutorSurveys, c.missingScholarSurveys,
          c.blankReasons, c.dataFixes, c.teacherPullouts, c.teacherPulloutShare, c.wholeGroupReview, c.archivedOnRoster])],
      ['Tutor Actions', ['Region', 'School', 'Tutor', 'Pearl Tutor ID', 'Sessions Delivered', 'Incomplete Sessions', 'Missing Tutor Surveys',
        'Tutor Survey Capture %', 'Missing Scholar Surveys', 'Scholar Survey Capture %', 'Missed Reason Blank', 'Attendance Not Recorded',
        'Session Status Mismatch', 'Wrong Missed Reason', 'Whole-Group Pull-outs to Review', 'Tutor Attendance %', 'Total Fixes'],
        R.tutors.map(t => [t.region, t.school, t.tutor, t.tutorId, t.delivered, t.incomplete, t.missingTutorSurveys, fmtPct(t.tutorSurveyCapture),
          t.missingScholarSurveys, fmtPct(t.scholarSurveyCapture), t.blankReasons, t.notRecorded, t.statusMismatch, t.wrongCategory,
          t.wholeGroupReview, fmtPct(t.tutorAttendance), t.totalFixes])],
      ['Attendance Fixes', ['Date', 'School', 'Tutor', 'Session', 'Session ID', 'Session Status', 'Session Attendance', 'Scholar', 'Scholar ID', 'Reason Entered', 'Issue', 'Owner'],
        R.issues.filter(i => i.issueKey !== 'incomplete').map(i => [i.date, i.school, i.tutor, i.session, i.sessionId, i.status, i.sessionAttendance,
          i.scholar || '', i.scholarId || '', i.reasonEntered || '', i.issue, i.owner])],
      ['Incomplete Sessions', ['Date', 'School', 'Tutor', 'Session', 'Session ID'],
        R.incompletes.map(i => [i.date, i.school, i.tutor, i.session, i.sessionId])],
      ['Missing Tutor Surveys', ['Date', 'School', 'Tutor', 'Session', 'Session ID'],
        R.missingTutor.map(i => [i.date, i.school, i.tutor, i.session, i.sessionId])],
      ['Missing Scholar Surveys', ['Date', 'School', 'Tutor', 'Session', 'Session ID', 'Scholar', 'Scholar ID'],
        R.missingScholar.map(i => [i.date, i.school, i.tutor, i.session, i.sessionId, i.scholar, i.scholarId])],
      ['Teacher Pull-outs', ['Date', 'School', 'Tutor', 'Session', 'Session ID', 'Scholar', 'Scholar ID', 'Whole Group'],
        R.pullouts.map(i => [i.date, i.school, i.tutor, i.session, i.sessionId, i.scholar, i.scholarId, i.wholeGroup])],
      ['Pull-outs by Scholar', ['School', 'Scholar', 'Scholar ID', 'Teacher Pull-outs', 'Most Recent'],
        R.scholarPullouts.map(x => [x.school, x.scholar, x.scholarId, x.pullouts, x.lastDate])],
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
  // UI — modal in Pearl Ops (Programming + Data)
  // ─────────────────────────────────────────────────────────────────────────
  let _region = 'ALL';
  function open(region) {
    if (region === 'NE' || region === 'SW' || region === 'ALL') _region = region;
    if (!window.po || typeof window.po.getFieldSupportInput !== 'function') { alert('Pearl Ops data not ready yet - try again in a moment.'); return; }
    const schools = window.po.getFieldSupportInput('ALL').schoolNames || [];
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
      <div style="background:var(--surface);border-radius:16px;width:520px;max-width:96vw;max-height:90vh;overflow:auto;box-shadow:0 24px 64px rgba(0,0,0,.3)">
        <div style="background:linear-gradient(135deg,#7c2d12,#c2410c);padding:1.1rem 1.4rem;border-radius:16px 16px 0 0;display:flex;justify-content:space-between;align-items:center">
          <div><div style="color:#fff;font-weight:700">${_region === 'ALL' ? 'Support Report' : _region + ' Region Support Report'}</div>
          <div style="color:rgba(255,255,255,.8);font-size:.78rem;margin-top:.15rem">Who needs support and what to fix - campus and tutor</div></div>
          <button onclick="document.getElementById('fsModal').style.display='none'" style="background:rgba(255,255,255,.15);border:none;color:#fff;border-radius:8px;width:32px;height:32px;cursor:pointer">✕</button>
        </div>
        <div style="padding:1.25rem 1.4rem">
          <div style="margin-bottom:.85rem"><div style="${lbl}">Region</div><div style="display:flex;gap:.4rem">
            ${['ALL', 'NE', 'SW'].map(r => `<button data-fs-region="${r}" style="padding:.35rem .85rem;font-size:.8rem;font-weight:600;border-radius:8px;cursor:pointer;border:1.5px solid var(--border);background:var(--surface);color:var(--text)">${r === 'ALL' ? 'All Regions' : r + ' Region'}</button>`).join('')}
          </div></div>
          <div style="margin-bottom:.85rem"><div style="${lbl}">School (optional)</div>
            <select id="fsSchool" style="${inp}"><option value="">All Schools</option>${schools.map(s => `<option value="${s.replace(/"/g, '&quot;')}">${s}</option>`).join('')}</select></div>
          <div style="display:flex;gap:.6rem;margin-bottom:1.1rem">
            <div style="flex:1"><div style="${lbl}">From (optional)</div><input id="fsFrom" type="date" style="${inp}"></div>
            <div style="flex:1"><div style="${lbl}">To (optional)</div><input id="fsTo" type="date" style="${inp}"></div>
          </div>
          <div style="display:flex;gap:.6rem">
            <button onclick="njtcFieldSupport.download('pdf')" style="flex:1;padding:.7rem;border:none;border-radius:10px;background:#1e3a5f;color:#fff;font-weight:700;cursor:pointer">Download PDF</button>
            <button onclick="njtcFieldSupport.download('xlsx')" style="flex:1;padding:.7rem;border:none;border-radius:10px;background:#166534;color:#fff;font-weight:700;cursor:pointer">Download Excel</button>
          </div>
          <div id="fsStatus" style="font-size:.78rem;color:var(--muted);margin-top:.7rem;min-height:1em"></div>
        </div>
      </div>`;
    const paint = () => m.querySelectorAll('[data-fs-region]').forEach(b => {
      const on = b.dataset.fsRegion === _region;
      b.style.background = on ? 'var(--blue-mid)' : 'var(--surface)'; b.style.color = on ? '#fff' : 'var(--text)';
      b.style.borderColor = on ? 'var(--blue-mid)' : 'var(--border)';
    });
    m.querySelectorAll('[data-fs-region]').forEach(b => b.addEventListener('click', () => { _region = b.dataset.fsRegion; paint(); }));
    paint();
    m.style.display = 'flex';
  }

  function currentReport() {
    const input = window.po.getFieldSupportInput(_region);
    input.region = _region;
    input.school = (document.getElementById('fsSchool') || {}).value || '';
    input.from = (document.getElementById('fsFrom') || {}).value || '';
    input.to = (document.getElementById('fsTo') || {}).value || '';
    return computeFieldSupport(input);
  }
  function scopeText(R) {
    return [R.school || (R.region === 'ALL' ? 'All Regions' : R.region + ' Region')].join('');
  }
  function fileStem(R) {
    const s = (R.school || (R.region === 'ALL' ? 'All' : R.region + '-Region')).replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '');
    return 'NJTC-Support-Report-' + s + '-' + new Date().toISOString().slice(0, 10);
  }

  async function download(kind) {
    const st = document.getElementById('fsStatus');
    try {
      if (st) st.textContent = 'Building…';
      const R = currentReport();
      if (kind === 'xlsx') {
        if (!window.XLSX) throw new Error('Excel library not loaded - check your connection and refresh.');
        window.XLSX.writeFile(buildWorkbook(window.XLSX, R), fileStem(R) + '.xlsx');
      } else {
        if (window.njtcPDFExport && window.njtcPDFExport.loadLibs) await window.njtcPDFExport.loadLibs();
        const doc = buildPDF(window.jspdf.jsPDF, R, scopeText(R));
        doc.save(fileStem(R) + '.pdf');
      }
      if (st) st.textContent = 'Downloaded.';
    } catch (e) {
      console.error('[Support Report]', e);
      if (st) st.textContent = 'Could not build the report: ' + e.message;
    }
  }

  const api = { open, download, computeFieldSupport, buildWorkbook, buildPDF, sheetSpecs };
  if (typeof window !== 'undefined') window.njtcFieldSupport = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})();
