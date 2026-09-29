#!/usr/bin/env node
/**
 * Builds onsite/data/archive-<season>.json — a small, high-level recap of a
 * concluded school year for each onsite staff member (by Pearl User ID), so
 * returning staff can look back without the portal downloading last year's
 * full Pearl workbook in their browser.
 *
 * Privacy: aggregates only. No scholar names, IDs, or per-scholar rows are
 * written — returning staff see their own totals, never scholar-level detail
 * from a prior year.
 *
 * Methodology: runs onsite/pearl-data.js's own fetchUserData() (loaded with
 * Node's vm) for every instructor, so every figure is computed exactly the
 * way the live onsite dashboard computes it.
 *
 * Usage:
 *   node scripts/build-onsite-archive.js                       # SY 2025-26 from its published Pearl sheet
 *   node scripts/build-onsite-archive.js --from-bundle <file>  # from a full-scope partner bundle (same rows)
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const SEASON = '2025-26';
const PUB_2PACX = '2PACX-1vQ1iC8NZFJt3iinGUEqftKtP32N43axi_JN_RQI36EBUdhZS0PaZRwd-1AJT3bEVe6cqHA0tCA3vb5K';
const GIDS = { att: '702726038', inst: '1955492004', stu: '1245403832', sess: '625567780' };
const OUT = path.join(ROOT, 'onsite', 'data', `archive-${SEASON}.json`);

const HEADERS = {
  att:  ['User', 'Role', 'Session', 'Session Status', 'Planned Session Start', 'Session Date', 'Attendance Status', 'Attendance Missed Reason', 'Grade', 'Sex', 'Race', 'School', 'District', 'Pearl User ID'],
  inst: ['Filled By', 'Filled For', 'Engagement', 'Enjoyment', 'Learning', 'Overall', 'Comment for admin', 'Comment for self', 'Date Responded', 'School', 'District', 'Pearl Session ID', 'Filled By ID', 'Filled For ID'],
  stu:  ['Filled By', 'Filled For', 'Confidence', 'Enjoyment', 'Learning', 'Overall', 'Comments', 'Date Responded', 'School', 'District', 'Region', 'Pearl Session ID', 'Filled By ID', 'Filled For ID'],
  sess: ['Title', 'Instructor', 'Students', 'Location', 'Status', 'Attendance', 'Scheduled Start', 'Scheduled Duration', 'Actual Duration', 'Subject', 'Grade', 'School', 'District', 'Region', 'Pearl Session ID', 'Pearl Instructor ID', 'Pearl Student IDs'],
};
const q = v => { const s = v == null ? '' : String(v); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
const toCsv = (hdr, rows) => [hdr, ...rows.map(r => hdr.map((_, i) => r[i]))].map(r => r.map(q).join(',')).join('\n');

async function loadTabs() {
  const i = process.argv.indexOf('--from-bundle');
  if (i > 0) {
    const b = JSON.parse(fs.readFileSync(process.argv[i + 1], 'utf8'));
    if (b.season !== SEASON) throw new Error(`bundle season ${b.season} ≠ ${SEASON}`);
    if (!(b.identity && b.identity.level === 'Admin')) throw new Error('need a full-scope (Admin) bundle');
    return { att: toCsv(HEADERS.att, b.attendance), inst: toCsv(HEADERS.inst, b.tutorSurveys),
             stu: toCsv(HEADERS.stu, b.scholarSurveys), sess: toCsv(HEADERS.sess, b.sessions || []) };
  }
  const get = async gid => { const r = await fetch(`https://docs.google.com/spreadsheets/d/e/${PUB_2PACX}/pub?output=csv&gid=${gid}`); if (!r.ok) throw new Error('HTTP ' + r.status); return r.text(); };
  const out = {};
  for (const k of Object.keys(GIDS)) out[k] = await get(GIDS[k]);
  return out;
}

async function main() {
  const tabs = await loadTabs();
  const byGid = { [GIDS.att]: tabs.att, [GIDS.inst]: tabs.inst, [GIDS.stu]: tabs.stu, [GIDS.sess]: tabs.sess };
  const store = new Map();
  const sandbox = {
    console, setTimeout, clearTimeout, AbortController,
    localStorage: { getItem: k => store.has(k) ? store.get(k) : null, setItem: (k, v) => store.set(k, String(v)), removeItem: k => store.delete(k) },
    fetch: async url => { const g = (url.match(/gid=(\d+)/) || [])[1]; const text = byGid[g];
      return { ok: text != null, status: text != null ? 200 : 404, headers: { get: () => 'text/csv' }, text: async () => text || '' }; },
  };
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'onsite', 'data-sources.js'), 'utf8'), sandbox);
  // Point the engine at this archived season's workbook
  sandbox.NJTC_SOURCES.PEARL_SHEET_ID = null; sandbox.NJTC_SOURCES.PEARL_2PACX = PUB_2PACX; sandbox.NJTC_SOURCES.PEARL_GIDS = GIDS;
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'onsite', 'pearl-data.js'), 'utf8'), sandbox);
  const P = sandbox.window.NJTCPearlData;

  // Every instructor ID that appears in the attendance tab
  const attLines = tabs.att.split('\n');
  const ids = new Map();
  const rows = sandbox.NJTC_SOURCES && null; void rows;
  // Parse once via the engine's own cache path: fetch → parseCSV happens inside
  await P.fetchUserData('__warmup__').catch(() => {});
  const attParsed = JSON.parse(store.get([...store.keys()].find(k => k.startsWith('njtc_od_att'))) || '{}').data || [];
  attParsed.slice(1).forEach(r => { if ((r[1] || '').trim() === 'Instructor' && (r[13] || '').trim()) ids.set(r[13].trim(), (r[0] || '').trim()); });
  void attLines;

  const tutors = {};
  for (const [id, name] of ids) {
    const d = await P.fetchUserData(id);
    if (!d || !d.hasData) continue;
    tutors[id] = {
      name,
      sessionsAttended: d.myAttended, tutorAttendanceRate: d.myAttRate, serviceInterruptions: d.mySI,
      scholarsServed: d.uniqueScholarCount, scholarAttendanceRate: d.scholarAttRate,
      surveysSubmitted: d.surveyCount, scholarSurveyAvg: d.stuSurveyAvg,
      school: d.tutorSchool, schools: d.schoolsCovered,
      firstSession: d.dataRange && d.dataRange.first, lastSession: d.dataRange && d.dataRange.last,
    };
  }
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify({ season: SEASON, note: 'High-level per-staff recap. No scholar-level data.', tutors }, null, 0));
  console.log(`Wrote ${Object.keys(tutors).length} staff recaps -> ${path.relative(ROOT, OUT)} (${fs.statSync(OUT).size} bytes)`);
}
main().catch(e => { console.error(e); process.exit(1); });
