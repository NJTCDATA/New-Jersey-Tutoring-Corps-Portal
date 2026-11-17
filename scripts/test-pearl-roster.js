/**
 * shared/pearl-roster.js — a scholar's grade comes from the roster
 * (Pearl "Student Attendance" tab), never from the session's grade.
 *   node scripts/test-pearl-roster.js
 */
const assert = require('assert');
const R = require('../shared/pearl-roster.js');

// Roster: header found by name, blank rows/grades ignored
const map = R.rosterGradeMap([
  ['User', 'Grade', 'School', 'Pearl Student ID'],
  ['Adrian Campoverde', '6th Grade', 'LEA - iLearn Bergen MS', '10qsyK'],
  ['No Grade', '', 'X', 'nogr01'],
  [],
]);
assert.deepStrictEqual(map, { '10qsyK': '6th Grade' });
assert.deepStrictEqual(R.rosterGradeMap([['Something', 'Else']]), {}, 'wrong tab → empty map, no throw');

// Attendance rows (ATT layout: ROLE 1, GRADE 8, USER_ID 13)
const row = (role, grade, id) => { const r = new Array(14).fill(''); r[1] = role; r[8] = grade; r[13] = id; return r; };
const att = [
  row('Role', 'Grade', 'Pearl User ID'),           // header row — untouched
  row('Student', '7th Grade', '10qsyK'),           // session says 7th → roster 6th
  row('Student', '6th Grade', '10qsyK'),           // already right
  row('Student', '4th Grade', 'notOnRoster'),      // not on roster → keeps its value
  row('Instructor', '7th Grade', '10qsyK'),        // instructors never changed
];
assert.strictEqual(R.applyRosterGrades(att, map), 1);
assert.deepStrictEqual(att.map(r => r[8]), ['Grade', '6th Grade', '6th Grade', '4th Grade', '7th Grade']);
assert.strictEqual(R.applyRosterGrades(att, null), 0);

// Read by tab name; gid export first when one is given
const urls = R.rosterUrls('SHEET', 123);
assert(urls[0].endsWith('/export?format=csv&gid=123'));
assert(urls[urls.length - 1].endsWith('sheet=Student%20Attendance'));

console.log('pearl roster grades: all checks passed');
