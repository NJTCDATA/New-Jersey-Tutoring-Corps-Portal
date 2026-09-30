#!/usr/bin/env node
/* Build the frozen prior-year Program Pulse weekly archive.
 *
 *   node scripts/build-pulse-archive.js <attendance.csv> <season> <week1-monday YYYY-MM-DD>
 *   e.g. node scripts/build-pulse-archive.js p2526_702726038.csv 2025-26 2025-08-25
 *
 * Input: Pearl "Missed Reasons" / Attendance Detail CSV export for that SY.
 * Output: central/data/pulse-weekly-<season>.json — aggregate counts only
 * (by program week and by missed/SI reason); no names or IDs.
 *
 * Attendance classification is read from central/modules/programming.js
 * (SCHOLAR_MISS_REASONS / TUTOR_MISS_REASONS / COUNTS_AS_ATTENDED) and applied
 * with the same rules as po.classifyRecord, and weeks are computed by the same
 * central/modules/pulse-weekly.js the browser uses — so the archived year and
 * the live year are measured identically.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const PW = require('../central/modules/pulse-weekly.js');

const [csvPath, season, anchorStr] = process.argv.slice(2);
if (!csvPath || !season || !/^\d{4}-\d{2}-\d{2}$/.test(anchorStr || '')) {
  console.error('usage: build-pulse-archive.js <attendance.csv> <season e.g. 2025-26> <week1 monday YYYY-MM-DD>');
  process.exit(1);
}

function parseCSV(text) {
  const rows = []; let row = [], f = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; }
    else if (c === '"') q = true;
    else if (c === ',') { row.push(f); f = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(f); rows.push(row); row = []; f = ''; }
    else f += c;
  }
  if (f || row.length) { row.push(f); rows.push(row); }
  return rows;
}

function setFromSource(src, name) {
  const m = src.match(new RegExp('const ' + name + '\\s*=\\s*new Set\\(\\[([\\s\\S]*?)\\]\\)'));
  if (!m) throw new Error('could not find ' + name + ' in programming.js');
  // Strip line comments first — they contain apostrophes ("scholar's own choice")
  // that would otherwise be read as string delimiters.
  const body = m[1].split('\n').map(l => l.replace(/\/\/.*$/, '')).join('\n');
  return new Set([...body.matchAll(/'((?:[^'\\]|\\.)*)'/g)].map(x => x[1]));
}

const src = fs.readFileSync(path.join(__dirname, '../central/modules/programming.js'), 'utf8');
const SCHOLAR_MISS = setFromSource(src, 'SCHOLAR_MISS_REASONS');
const TUTOR_MISS = setFromSource(src, 'TUTOR_MISS_REASONS');
const COUNTS_AS_ATT = setFromSource(src, 'COUNTS_AS_ATTENDED');
if (SCHOLAR_MISS.size < 3 || TUTOR_MISS.size < 3) throw new Error('attendance rule sets look incomplete');
console.log('scholar-caused reasons:', [...SCHOLAR_MISS].join(' | '));
console.log('tutor-caused reasons:  ', [...TUTOR_MISS].join(' | '));

// Mirrors po.classifyRecord (central/modules/programming.js).
function classify(r) {
  const role = r[1] || '', st = r[6] || '', why = r[7] || '';
  if (st === 'Attended' || st === 'Late') return 'attended';
  if (COUNTS_AS_ATT.has(why)) return 'attended';
  if (st === 'Not recorded') return 'not_recorded';
  if (st === 'Missed') {
    if (role === 'Student') return (SCHOLAR_MISS.has(why) || why === '') ? 'absent' : 'service_interruption';
    return TUTOR_MISS.has(why) ? 'absent' : 'service_interruption';
  }
  return 'other';
}

const rows = parseCSV(fs.readFileSync(csvPath, 'utf8'));
const header = rows.shift().map(h => h.trim());
const expect = ['User', 'Role', 'Session', 'Session Status', 'Planned Session Start', 'Session Date',
  'Attendance Status', 'Attendance Missed Reason'];
expect.forEach((h, i) => { if (header[i] !== h) throw new Error(`column ${i} is "${header[i]}", expected "${h}"`); });

const [y, mo, d] = anchorStr.split('-').map(Number);
const anchor = new Date(y, mo - 1, d);
if (anchor.getDay() !== 1) throw new Error('week-1 anchor must be a Monday');
const weeks = PW.compute(rows.filter(r => r.length >= 14), { classify, anchor });

const out = { season, week1Monday: anchorStr, generatedAt: new Date().toISOString(),
  source: 'Pearl Attendance Detail export (aggregate only)', weeks };
const dest = path.join(__dirname, '../central/data/pulse-weekly-' + season + '.json');
fs.mkdirSync(path.dirname(dest), { recursive: true });
fs.writeFileSync(dest, JSON.stringify(out));
const tot = PW.sumWeeks(weeks, 1, 999);
console.log(`wrote ${path.relative(process.cwd(), dest)}: ${weeks.length} weeks, scholar ${tot.scholarRate}% · tutor ${tot.tutorRate}% · SI ${tot.stuSI}`);
