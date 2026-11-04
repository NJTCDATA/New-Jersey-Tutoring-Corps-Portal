#!/usr/bin/env node
/**
 * Consistency + logic checks for the Pearl missed-session categories and the
 * tutor-coverage helpers. No network. Run: node scripts/test-pearl-categories.js
 *
 *  1. shared/pearl-categories.js ABSENCE == every attendance classifier's
 *     scholar-miss set (display categories must never disagree with the math).
 *  2. partner/partner-report.js school-driven reasons == shared SCHOOL_DRIVEN.
 *  3. central/modules/pearl-coverage.js date parsing, name matching and
 *     covered-absence outcomes.
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

const ROOT = path.join(__dirname, '..');
const CAT = require(path.join(ROOT, 'shared', 'pearl-categories.js'));
const COV = require(path.join(ROOT, 'central', 'modules', 'pearl-coverage.js'));
const norm = CAT.norm;
const sameSet = (a, b, msg) => assert.deepStrictEqual([...new Set(a.map(norm))].sort(), [...new Set(b.map(norm))].sort(), msg);

// ── 1. ABSENCE matches each classifier ──────────────────────────────────────
function setLiteral(file, name) {
  const src = fs.readFileSync(path.join(ROOT, file), 'utf8');
  const m = src.match(new RegExp(name + '\\s*=\\s*new Set\\(\\[([\\s\\S]*?)\\]\\)'));
  assert(m, `${name} not found in ${file}`);
  return [...m[1].replace(/\/\/[^\n]*/g, '').matchAll(/'([^']*)'/g)].map(x => x[1]);
}
for (const f of ['central/modules/programming.js', 'onsite/pearl-data.js', 'partner/partner-report.js']) {
  sameSet(CAT.LISTS.ABSENCE, setLiteral(f, 'SCHOLAR_MISS_REASONS'), `ABSENCE differs from SCHOLAR_MISS_REASONS in ${f}`);
}

// ── 2. Partner school-driven list mirrors the shared one ────────────────────
const sb = { window: {}, document: { currentScript: null }, console };
vm.createContext(sb);
vm.runInContext(fs.readFileSync(path.join(ROOT, 'partner', 'partner-report.js'), 'utf8'), sb);
const R = sb.window.NJTCPartnerReport;
const partnerReasons = [].concat(...Object.values(R.SCHOOL_DRIVEN_LABELS));
sameSet(CAT.LISTS.SCHOOL_DRIVEN, partnerReasons, 'partner SCHOOL_DRIVEN_LABELS differs from shared SCHOOL_DRIVEN');
CAT.LISTS.SCHOOL_DRIVEN.forEach(r => assert(['cancellation', 'school_missed'].includes(CAT.categoryOf(r)), r + ' should be a cancellation or school-testing reason'));
// School testing is a missed reason (not counted, not a cancellation) — Programming, Nov 2026
assert.strictEqual(CAT.categoryOf('School-administered Testing'), 'school_missed');
assert.strictEqual(CAT.categoryOf('school administered testing'), 'school_missed');

// Every list maps to its own category; nothing is in two lists.
const seen = {};
[['UNDELIVERED', 'undelivered'], ['INTERNAL', 'internal'], ['ABSENCE', 'absence'], ['CANCELLATION', 'cancellation'], ['SCHOOL_MISSED', 'school_missed']].forEach(([k, c]) => {
  CAT.LISTS[k].forEach(r => {
    assert(!seen[norm(r)], `${r} is in ${seen[norm(r)]} and ${k}`); seen[norm(r)] = k;
    assert.strictEqual(CAT.categoryOf(r), c, r);
  });
});
assert.strictEqual(CAT.categoryOf(''), 'absence');
assert.strictEqual(CAT.categoryOf('School Schedule changed'), 'cancellation'); // Pearl's cancellation spelling
assert.strictEqual(CAT.categoryOf('Something new'), 'other');
assert(!CAT.isOfferedStatus('Cancelled') && !CAT.isOfferedStatus('Rescheduled') && CAT.isOfferedStatus('Completed') && CAT.isOfferedStatus('Missed'));

// ── 3. Coverage helpers ──────────────────────────────────────────────────────
const dates = {
  '10/3 & 10/5': ['2026-10-03', '2026-10-05'],
  '10/13-10/15': ['2026-10-13', '2026-10-14', '2026-10-15'],
  '10/16 - 10/19': ['2026-10-16', '2026-10-19'],            // weekend skipped
  '10/14/2026': ['2026-10-14'], '2026-10-14': ['2026-10-14'],
  '1/5 and 1/7': ['2027-01-05', '2027-01-07'],              // spring → SY end year
  '10/3, 10/5; 10/7': ['2026-10-03', '2026-10-05', '2026-10-07'],
  'next week': [], '10/32': [], '2/30': [], '': [],
};
Object.entries(dates).forEach(([k, v]) => assert.deepStrictEqual(COV.parseTrackerDates(k, 2026).dates, v, k));
assert(COV.sameName('Lilia Quintero - SUB', 'lilia  quintero'));
assert(COV.sameName('Jessica Miller (SUB)', 'Jessica Miller'));
assert(COV.sameName('Lilia M. Quintero', 'Lilia Quintero'));
assert(!COV.sameName('Nick H.', 'Nicholas Hoover'));

const H = ['Original Instructor Name', 'Original Instructor Email/Username', 'Original Instructor Custom ID', 'Original Instructor Pearl ID',
  'Substitute Instructor Name', 'Substitute Instructor Email/Username', 'Substitute Instructor Custom ID', 'Substitute Instructor Pearl ID',
  'Substituted Date', 'Substituted By ', 'Session Start Date', 'Subject', 'Program', 'Grade', 'School', 'District', 'Region', 'Students', 'Session Pearl ID'];
const NAMES = { S1: 'Lilia Quintero', S2: 'Jessica Miller', Y: 'Yolanda Price' };
const row = (oid, sid, on, date, sess) => ['O' + oid, '', '', oid, NAMES[sid] + ' - SUB', '', '', sid, on, 'SL', date, 'Math', '', '', 'Sch', 'Dist', 'Reg', '', sess];
const subs = COV.parseSubstitutions([H,
  row('A', 'S1', '10/2/2026', '10/3/2026 9:15:00', 's1'),          // covered; sub attended
  row('K', 'S1', '10/12/2026', '10/13/2026', 's2'),                // re-sub chain K → S1 → S2
  row('S1', 'S2', '10/13/2026', '10/13/2026', 's2'),
  row('X1', 'Y', '10/1/2026', '10/9/2026', 's3'),                  // cancelled session
  row('X2', 'Y', '10/1/2026', '10/30/2026', 's4'),                 // future
  row('X3', 'Y', '10/1/2026', '10/9/2026', 's5'),                  // original already marked absent
  row('X4', 'Y', '10/1/2026', '10/9/2026', 's6'),                  // original ALSO marked attended
  row('X5', 'Y', '10/1/2026', '10/9/2026', 's7'),                  // session not in Session Details
]);
const sess = { s1: { status: 'Completed', title: 'T1', start: '10/3/2026 9:15:00' }, s2: { status: 'Completed', title: 'T2', start: '10/13/2026' },
  s3: { status: 'Cancelled', title: 'T3', start: '10/9/2026' }, s5: { status: 'Missed', title: 'T5', start: '10/9/2026' },
  s6: { status: 'Completed', title: 'T6', start: '10/9/2026' } };
const own = { 'S1|T1|2026-10-03': 'attended', 'S2|T2|2026-10-13': 'attended', 'X3|T5|2026-10-09': 'absent', 'X4|T6|2026-10-09': 'attended' };
const out = COV.coveredAbsences(subs, sess, (u, t, d) => own[u + '|' + t + '|' + d] || null, '2026-10-18', CAT.isOfferedStatus);
const by = Object.fromEntries(out.map(o => [o.sessId, o]));
assert.strictEqual(out.length, 7, 'one result per session');
assert.strictEqual(by.s1.outcome, 'covered'); assert.strictEqual(by.s1.subRowAttended, true);
assert.strictEqual(by.s2.origId, 'K'); assert.strictEqual(by.s2.deliveredById, 'S2'); assert.strictEqual(by.s2.outcome, 'covered');
assert.strictEqual(by.s3.outcome, 'not_offered');
assert.strictEqual(by.s4.outcome, 'upcoming');
assert.strictEqual(by.s5.outcome, 'already_recorded');
assert.strictEqual(by.s6.outcome, 'tutor_attended');
assert.strictEqual(by.s7.outcome, 'no_session');

const tracker = COV.parseTracker([
  ['Sub', 'Tutor Covering', 'Grades', 'Subjects', 'Date', 'Hours', 'Site Covering', 'Pay Period', 'Site Coordinator Name', 'Date You Called/ Emailed', 'Responsive within 24 hours? (Yes/No)'],
  ['Lilia Quintero', 'A', '3', 'Math', '10/3 & 10/5', '', 'Site', '', 'C', '9/26/2026', 'Y'],
  ['Nobody', 'Vacant Tutor', '3', 'Math', '10/14/2026', '', 'Site', '', 'C', '', 'Y'],
  ['Lilia Quintero', 'A', '3', 'Math', '10/30', '', 'Site', '', 'C', '', 'Y'],
  ['Lilia Quintero', 'A', '3', 'Math', 'soon', '', 'Site', '', 'C', '', 'Y'],
], 'SW', 2026);
assert.strictEqual(tracker[0].sub, 'Lilia Quintero');          // "sub" column, not "subjects"
assert.strictEqual(tracker[0].dateRaw, '10/3 & 10/5'); // "date" column, not "date you called"
assert(tracker[1].isVacancy);
const rec = COV.reconcileTracker(tracker, subs, '2026-10-18', new Set(['s3']));
assert.deepStrictEqual(rec.rows.map(r => r.status), ['partial', 'not_in_pearl', 'upcoming', 'unclear']);
assert(!rec.notOnTracker.some(s => s.sessId === 's3'), 'cancelled-session subs never reported as missing from the tracker');

// ── 3b. Instructor Substitutions — Nov 2026 action-log layout ───────────────
// One Dropped / Picked Up row per session, no Session ID (cases taken from the
// real SY 26-27 export).
{
  const LH = ['Action Date', 'Action By', 'Action', 'Instructor', 'Scheduled Start Date', 'School', 'District', 'Region'];
  const L = (ad, by, act, who, d, sch) => [ad, by, act, who, d, sch, 'Dist', 'Reg'];
  const ev = COV.parseSubstitutions([LH,
    // real covered absence: tutor-managed swap, 2 sessions
    L('10/27/2026', 'Vincent Duong', 'Picked Up', 'Vincent Duong', '10/27/2026', 'GLA'),
    L('10/27/2026', 'Vincent Duong', 'Picked Up', 'Vincent Duong', '10/27/2026', 'GLA'),
    L('10/27/2026', 'Vincent Duong', 'Dropped', 'Leila Einhorn', '10/27/2026', 'GLA'),
    L('10/27/2026', 'Vincent Duong', 'Dropped', 'Leila Einhorn', '10/27/2026', 'GLA'),
    // same person dropped + picked up → no change
    L('10/20/2026', 'SL', 'Dropped', 'Tohrn Taylor', '10/20/2026', 'FS'),
    L('10/20/2026', 'SL', 'Picked Up', 'Tohrn Taylor', '10/20/2026', 'FS'),
    // placeholder seat (no Pearl sessions of its own) → vacancy
    L('10/23/2026', 'SL', 'Dropped', 'Justina Davis', '10/27/2026', 'FS'),
    L('10/23/2026', 'SL', 'Picked Up', 'Jessica Miller', '10/27/2026', 'FS'),
    // nobody picked up → unpaired
    L('10/21/2026', 'SL', 'Dropped', 'Tohrn Taylor', '10/22/2026', 'FS'),
    // later cancelled
    L('10/27/2026', 'SL', 'Dropped', 'Amy Ross', '10/28/2026', 'PG'),
    L('10/27/2026', 'SL', 'Picked Up', 'Sophia Petronglo', '10/28/2026', 'PG'),
  ].concat(['10/21/2026', '10/26/2026', '11/16/2026', '12/7/2026', '1/4/2027'].flatMap(d => [
    // same swap across 3+ months → reassignment
    L('10/19/2026', 'SL', 'Dropped', 'Miranda Marshall', d, 'PG'),
    L('10/19/2026', 'SL', 'Picked Up', 'Sophia Petronglo', d, 'PG')])));
  assert(COV.isActionLog(ev), 'action-log layout detected');
  assert.strictEqual(ev.length, 21);
  const S = (id, inst, instId, sch, start, title, status) => ({ id, instructor: inst, instId, school: sch, start, title, status: status || 'Completed' });
  const sessions = [
    S('v1', 'Vincent Duong', 'V', 'GLA', '10/27/2026 16:45', '4:45-5:15'), S('v2', 'Vincent Duong', 'V', 'GLA', '10/27/2026 16:15', '4:15-4:45 Leila'),
    S('l0', 'Leila Einhorn', 'LE', 'GLA', '10/20/2026 16:15', '4:15-4:45 Leila'),
    S('t1', 'Tohrn Taylor', 'T', 'FS', '10/20/2026 9:00', 'A'), S('j1', 'Jessica Miller', 'J', 'FS', '10/27/2026 9:00', 'B'),
    S('a0', 'Amy Ross', 'A', 'PG', '10/20/2026 9:00', 'C'), S('p1', 'Sophia Petronglo', 'P', 'PG', '10/28/2026 9:00', 'D', 'Cancelled'),
    S('m0', 'Miranda Marshall', 'M', 'PG', '10/20/2026 9:00', 'E'),
  ];
  const ownL = { 'V|4:45-5:15|2026-10-27': 'attended', 'V|4:15-4:45 Leila|2026-10-27': 'attended' };
  const r = COV.coveredAbsences(ev, {}, (u, t, d) => ownL[u + '|' + t + '|' + d] || null, '2026-11-04', CAT.isOfferedStatus, { sessions, tracker: [] });
  const cnt = {}; r.forEach(x => { cnt[x.outcome] = (cnt[x.outcome] || 0) + 1; });
  assert.deepStrictEqual(cnt, { covered: 2, no_change: 1, vacancy: 1, unpaired: 1, not_offered: 1, reassignment: 5 });
  const cov = r.filter(x => x.outcome === 'covered');
  assert(cov.every(x => x.origId === 'LE' && x.deliveredById === 'V' && x.subRowAttended && x.tutorManaged));
  assert.deepStrictEqual(cov.map(x => x.sessId).sort(), ['v1', 'v2'], 'each drop matched to a distinct substitute session');
  // Sub Tracker naming the tutor absent overrides the reassignment rule for that day
  const trk = COV.parseTracker([['Sub', 'Tutor Covering', 'Grades', 'Subjects', 'Date', 'Hours', 'Site Covering'],
    ['Sophia Petronglo', 'Miranda Marshall', '6', 'Math', '10/26/2026', '', 'PG']], 'SW', 2026);
  const sessions2 = sessions.concat([S('p2', 'Sophia Petronglo', 'P', 'PG', '10/26/2026 9:00', 'D')]);
  const r2 = COV.coveredAbsences(ev, {}, () => null, '2026-11-04', CAT.isOfferedStatus, { sessions: sessions2, tracker: trk });
  const m26 = r2.find(x => x.origName === 'Miranda Marshall' && x.date === '2026-10-26');
  assert.strictEqual(m26.outcome, 'covered'); assert(m26.confirmed);
  const nc = COV.parseTracker([['Sub', 'Tutor Covering', 'Grades', 'Subjects', 'Date', 'Hours', 'Site Covering'],
    ['Laura Guzzo', 'No Coverage ', '1-3', 'Math', '10/26/2026', '', 'Stoy']], 'SW', 2026);
  assert.strictEqual(COV.reconcileTracker(nc, [], '2026-11-04', new Set()).rows[0].status, 'no_coverage');
  // the session layout still parses as before
  assert(!COV.isActionLog(subs));
}

// ── 4. Free-text Sub Tracker → Pearl roster ─────────────────────────────────
assert.strictEqual(COV.gradesText('3/5/2026'), '3-5');            // Sheets turned "3-5" into a date
assert.strictEqual(COV.gradesText('2026-01-03'), '1-3');
assert.strictEqual(COV.gradesText('4'), '4');
assert.strictEqual(COV.gradesText('K-2'), 'K-2');
assert(COV.looseName('Nick H.', 'Nicholas Hoover'));
assert(COV.looseName('Katie Rose', 'Katie Rose Davis'));          // two-part first name
assert(COV.looseName('Mike Jones', 'Michael Jones'));
assert(!COV.looseName('Nick H.', 'Nicholas Smith'));
assert(!COV.looseName('Rose', 'Katie Rose Davis'));
const people = [{ id: 1, name: 'Nicholas Hoover', school: 'A' }, { id: 2, name: 'Nicole Harris', school: 'B' }];
assert.strictEqual(COV.matchPerson('Nick H.', people, 'A').id, 1);   // site narrows it down
assert.strictEqual(COV.matchPerson('Nick H.', people, null), null);  // ambiguous → no guess
assert.strictEqual(COV.matchPerson('Vacant Tutor', people, 'A'), null);
const schools = ['Pemberton Township-Denbo-Crichton School', 'Field Street Elementary School', 'Elm Street School'];
assert.strictEqual(COV.matchSchool('Denbo', schools), schools[0]);
assert.strictEqual(COV.matchSchool('Field Street', schools), schools[1]);
assert.strictEqual(COV.matchSchool('Street', schools), null);        // ambiguous
// A date range only expects coverage on days the site had sessions
const tr2 = COV.parseTracker([
  ['Sub', 'Tutor Covering', 'Grades', 'Subjects', 'Date', 'Site Covering'],
  ['Lilia Quintero', 'Nick H.', '3/5/2026', 'ELA', '10/13-10/16', 'Denbo'],
  ['Lilia Quintero', 'Nick H.', '3/5/2026', 'ELA', '10/13-10/16', 'Nowhere'],
], 'SW', 2026);
const roster = { schools, people: [{ id: 'A', name: 'Nicholas Hoover', school: schools[0] }],
  sessionDays: sc => sc === schools[0] ? new Set(['2026-10-13', '2026-10-15']) : null };
const rec2 = COV.reconcileTracker(tr2, [], '2026-10-18', new Set(), roster);
assert.strictEqual(rec2.rows[0].due, 2); assert(rec2.rows[0].rangeChecked);
assert.strictEqual(rec2.rows[0].tutorMatch.name, 'Nicholas Hoover'); assert.strictEqual(rec2.rows[0].grades, '3-5');
assert.strictEqual(rec2.rows[1].due, 4); assert(!rec2.rows[1].rangeChecked);   // site not matched → every weekday

console.log('pearl categories + coverage: all checks passed');
