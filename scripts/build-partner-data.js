#!/usr/bin/env node
/**
 * Builds the partner portal's per-scope data bundles and (optionally) its
 * login codes, from the live Pearl export.
 *
 * This is the piece that stands in for row-level security on a static site:
 * it runs server-side (GitHub Actions, or a maintainer's machine), never in
 * a partner's browser, so a partner's browser only ever downloads the one
 * scoped bundle it was handed a token for — never the full multi-district
 * dataset.
 *
 * Required env vars (never written to any file this script touches):
 *   PARTNER_HMAC_KEY      - long random secret. token = HMAC-SHA256(entry.id, key).
 *                            Keep this stable across runs so data-bundle filenames
 *                            stay in sync with already-issued partner-codes.json
 *                            entries; only rotate it deliberately (kills every
 *                            existing bearer URL at once).
 *   PARTNER_EMAIL_MAP_JSON - JSON string { "<directory id>": "<email>", ... }
 *                            for every entry in partner/directory.json.
 * Optional:
 *   PARTNER_PIN_MAP_JSON   - JSON string { "<directory id>": "<4-digit pin>", ... }.
 *                            Only needed when (re)issuing logins — e.g. onboarding
 *                            a new partner or rotating a PIN. Omit it for a plain
 *                            data refresh (Pearl export updated) and
 *                            auth/partner-codes.json is left untouched.
 *   PARTNER_PEARL_2PACX    - Override the published-sheet key below. Set this (and
 *                            PARTNER_PEARL_GIDS) when SY26-27's Pearl workbook goes
 *                            live — the column layout/framework is the same every
 *                            year per NJTC, only the sheet itself is new, so this is
 *                            meant to be a one-secret swap, not a code change.
 *   PARTNER_PEARL_GIDS     - Override the four tab GIDs below, as JSON:
 *                            '{"att":123,"inst":456,"stu":789,"sess":321}'.
 *
 * Usage:
 *   PARTNER_HMAC_KEY=... PARTNER_EMAIL_MAP_JSON='{...}' [PARTNER_PIN_MAP_JSON='{...}'] \
 *     node scripts/build-partner-data.js
 */
const https = require('https');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..');
const DIRECTORY_PATH = path.join(ROOT, 'partner', 'directory.json');
const DATA_OUT_DIR = path.join(ROOT, 'partner', 'data');
const CODES_OUT_PATH = path.join(ROOT, 'auth', 'partner-codes.json');

// SY25-26 Pearl workbook — the internal/onsite portals read from the same
// one. Override via PARTNER_PEARL_2PACX / PARTNER_PEARL_GIDS (see header
// above) once SY26-27's sheet is live; no code change needed for that swap.
const PEARL_2PACX = process.env.PARTNER_PEARL_2PACX || '2PACX-1vQ1iC8NZFJt3iinGUEqftKtP32N43axi_JN_RQI36EBUdhZS0PaZRwd-1AJT3bEVe6cqHA0tCA3vb5K';
// "sess" (Session Details — the tab durations live on) shares the same gid
// across NJTC's SY and Summer Pearl workbooks (confirmed against
// central/modules/programming.js's own hardcoded GIDS.sess), so the same
// default carries over here without needing a probe step.
const PEARL_GIDS = process.env.PARTNER_PEARL_GIDS ? JSON.parse(process.env.PARTNER_PEARL_GIDS) : { att: 702726038, inst: 1955492004, stu: 1245403832, sess: 625567780 };

// Column layouts mirror onsite/pearl-data.js exactly — keep these two files in sync
// if the Pearl export ever adds/reorders columns.
const ATT = {
  USER: 0, ROLE: 1, SESSION: 2, SESS_STATUS: 3, PLAN_START: 4, SESS_DATE: 5, ATT_STATUS: 6,
  MISS_REASON: 7, GRADE: 8, SEX: 9, RACE: 10, SCHOOL: 11, DISTRICT: 12, USER_ID: 13,
  IND_ATT_RATE: 14, SCHOLAR_ATT_PCT: 15, AVG_ATT: 16, STU_AVG_ATT: 17, INST_AVG: 18,
  STU_ATT_CNT: 19, STU_MISS_CNT: 20, INST_ATT_CNT: 21, INST_MISS_CNT: 22, MISS_TAG: 23,
  CONSEC_STATUS: 24, WEEK: 26
};
const INST = {
  FILLED_BY: 0, FILLED_FOR: 1, ENGAGEMENT: 2, ENJOYMENT: 3, LEARNING: 4, OVERALL: 5,
  COMMENT_ADMIN: 6, COMMENT_SELF: 7, DATE: 8, SCHOOL: 9, DISTRICT: 10, SESS_ID: 11,
  FILLED_BY_ID: 12, FILLED_FOR_ID: 13
};
const STU = {
  FILLED_BY: 0, FILLED_FOR: 1, CONFIDENCE: 2, ENJOYMENT: 3, LEARNING: 4, OVERALL: 5,
  COMMENT: 6, DATE: 7, SCHOOL: 8, DISTRICT: 9, REGION: 10, SESS_ID: 11,
  FILLED_BY_ID: 12, FILLED_FOR_ID: 13
};
// Session Details — mirrors central/modules/programming.js's SESS map exactly.
// DUR_MINS (17) isn't a real Pearl column: it's computed here at build time
// (from ACTUAL_DUR, falling back to SCHED_DUR) and appended to each row so
// the browser never has to parse duration strings itself.
const SESS = {
  TITLE: 0, INSTRUCTOR: 1, STUDENTS: 2, LOCATION: 3, STATUS: 4, ATTENDANCE: 5,
  START: 6, SCHED_DUR: 7, ACTUAL_DUR: 8, SUBJECT: 9, GRADE: 10, SCHOOL: 11,
  DISTRICT: 12, REGION: 13, SESS_ID: 14, INST_ID: 15, STU_IDS: 16, DUR_MINS: 17
};

// Parses duration strings ("40 minutes", "1 hour", "1 hour 30 minutes") into
// integer minutes — same logic as central/modules/programming.js so tutored-
// minutes figures never drift between the internal and partner sides.
function parseDurationMins(s) {
  if (!s) return 0;
  s = String(s).toLowerCase();
  let m = 0;
  const h = s.match(/(\d+)\s*hour/); if (h) m += parseInt(h[1], 10) * 60;
  const mn = s.match(/(\d+)\s*min/); if (mn) m += parseInt(mn[1], 10);
  return m;
}

// Districts with no partner contact yet in partner/directory.json still need a
// region so Admin/Regional accounts see them. Confirmed by Amir 2026-08-31.
const REGION_DISTRICTS = {
  'North-East': [
    'iLearn CMO', 'Hoboken Dual Language Charter Schools', 'Paterson',
    'Central Jersey College Prep', 'Middlesex County STEM Charter School'
  ],
  'South-West': [
    'Lawrence Township Schools', 'LEAP Academy Charter School', 'Pemberton Twp Schools',
    'Penns Grove - Carneys Point Regional School District', 'Hamilton Township',
    'String Theory Schools', 'Gloucester Township School District',
    'Global Leadership Academy Charter Schools', 'Berlin Community School', 'Haddon Township',
    'American Paradigm Schools'
  ]
};

// SY boundary — PARTNER SIDE ONLY. Internal Data Department views (central/modules/*)
// are untouched by this script and keep full multi-year history/year-over-year
// comparisons. Every attendance/survey row is checked against this cutoff before
// it's allowed into any partner bundle, regardless of what scope it matches, so a
// prior year's rows can never reach a partner dashboard even if Pearl's export
// ever starts accumulating multiple years in one sheet.
//
// When a new school year starts: bump PARTNER_SY_LABEL and PARTNER_SY_START via
// the workflow_dispatch inputs on "Refresh Partner Portal Data" (or these env
// vars locally) and re-run with "Update logins too? = no" — that alone rolls
// every partner dashboard forward and drops last year's data, no code change
// needed.
const CURRENT_SY_LABEL = process.env.PARTNER_SY_LABEL || '2025-26';
const CURRENT_SY_START = process.env.PARTNER_SY_START || '2025-07-01';

function parseDate(s) {
  if (!s) return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}
const syCutoff = parseDate(CURRENT_SY_START);

function inCurrentSY(dateStr) {
  if (!syCutoff) return true; // misconfigured cutoff — fail open rather than blank every dashboard
  const d = parseDate(dateStr);
  return d ? d >= syCutoff : true; // unparseable/blank date — keep rather than silently drop
}

function fetchText(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetchText(res.headers.location).then(resolve, reject);
      }
      if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode} for ${url}`));
      let body = '';
      res.on('data', d => body += d);
      res.on('end', () => resolve(body));
    }).on('error', reject);
  });
}

function parseCSV(text) {
  const rows = [];
  const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  let row = [], cur = '', inQ = false;
  for (let i = 0; i < normalized.length; i++) {
    const ch = normalized[i];
    if (inQ) {
      if (ch === '"') { if (normalized[i + 1] === '"') { cur += '"'; i++; } else inQ = false; }
      else cur += ch;
    } else if (ch === '"') inQ = true;
    else if (ch === ',') { row.push(cur); cur = ''; }
    else if (ch === '\n') { row.push(cur); cur = ''; if (row.some(c => c.trim() !== '')) rows.push(row); row = []; }
    else cur += ch;
  }
  if (cur !== '' || row.length) { row.push(cur); if (row.some(c => c.trim() !== '')) rows.push(row); }
  return rows;
}

async function fetchSheet(gidName) {
  const gid = PEARL_GIDS[gidName];
  const url = `https://docs.google.com/spreadsheets/d/e/${PEARL_2PACX}/pub?output=csv&gid=${gid}`;
  let lastErr;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const text = await fetchText(url);
      if (text.trim().startsWith('<')) throw new Error('HTML response — sheet not public');
      const rows = parseCSV(text);
      if (rows.length < 2) throw new Error('Empty or header-only response');
      return rows;
    } catch (e) {
      lastErr = e;
      if (attempt < 2) await new Promise(r => setTimeout(r, 1500 * (attempt + 1)));
    }
  }
  throw lastErr;
}

function sha256(s) { return crypto.createHash('sha256').update(s).digest('hex'); }
function hmacToken(s, key) { return crypto.createHmac('sha256', key).update(s).digest('hex').slice(0, 24); }

function scopeMatches(entry, district, school) {
  if (entry.scopeType === 'all') return true;
  if (entry.scopeType === 'region') return (REGION_DISTRICTS[entry.region] || []).includes(district);
  if (entry.scopeType === 'district') return district === entry.district;
  if (entry.scopeType === 'school') return district === entry.district && entry.schools.includes(school);
  return false;
}

async function main() {
  const directory = JSON.parse(fs.readFileSync(DIRECTORY_PATH, 'utf8')).entries;

  const hmacKey = process.env.PARTNER_HMAC_KEY;
  const emailMapRaw = process.env.PARTNER_EMAIL_MAP_JSON;
  if (!hmacKey) throw new Error('PARTNER_HMAC_KEY env var is required.');
  if (!emailMapRaw) throw new Error('PARTNER_EMAIL_MAP_JSON env var is required (id -> email JSON).');
  const emailMap = JSON.parse(emailMapRaw);
  const pinMapRaw = process.env.PARTNER_PIN_MAP_JSON;
  const pinMap = pinMapRaw ? JSON.parse(pinMapRaw) : null;

  console.log(`Partner-side SY filter: ${CURRENT_SY_LABEL}, sessions on/after ${CURRENT_SY_START} only.`);
  console.log('Fetching Pearl exports...');
  const [attRows, instRows, stuRows] = await Promise.all([fetchSheet('att'), fetchSheet('inst'), fetchSheet('stu')]);
  console.log(`  attendance: ${attRows.length - 1} rows | tutor surveys: ${instRows.length - 1} rows | scholar surveys: ${stuRows.length - 1} rows`);

  // Session Details (durations) — fetched separately and failed soft: a bad
  // gid or a temporarily-unpublished tab here must never take down the
  // attendance/survey refresh every partner depends on. Tutored-minutes
  // figures just won't appear in this run's bundles if this fails.
  let sessRows = null;
  try {
    sessRows = await fetchSheet('sess');
    console.log(`  sessions: ${sessRows.length - 1} rows`);
  } catch (e) {
    console.warn(`  ! sessions tab fetch failed (${e.message}) — tutored-minutes figures omitted from this run.`);
  }

  fs.mkdirSync(DATA_OUT_DIR, { recursive: true });
  for (const f of fs.readdirSync(DATA_OUT_DIR)) {
    if (f.endsWith('.json') && f !== '.gitkeep') fs.unlinkSync(path.join(DATA_OUT_DIR, f));
  }

  const codes = [];
  let withRows = 0, empty = 0, skipped = 0;

  for (const entry of directory) {
    const email = emailMap[entry.id];
    if (!email) { console.warn(`  ! no email for ${entry.id} (${entry.name}) — skipped`); skipped++; continue; }

    const token = hmacToken(entry.id, hmacKey);
    const att = attRows.slice(1).filter(r =>
      scopeMatches(entry, (r[ATT.DISTRICT] || '').trim(), (r[ATT.SCHOOL] || '').trim()) && inCurrentSY(r[ATT.SESS_DATE]));
    const inst = instRows.slice(1).filter(r =>
      scopeMatches(entry, (r[INST.DISTRICT] || '').trim(), (r[INST.SCHOOL] || '').trim()) && inCurrentSY(r[INST.DATE]));
    const stu = stuRows.slice(1).filter(r =>
      scopeMatches(entry, (r[STU.DISTRICT] || '').trim(), (r[STU.SCHOOL] || '').trim()) && inCurrentSY(r[STU.DATE]));
    const sess = sessRows ? sessRows.slice(1)
      .filter(r => scopeMatches(entry, (r[SESS.DISTRICT] || '').trim(), (r[SESS.SCHOOL] || '').trim()) && inCurrentSY(r[SESS.START]))
      .map(r => {
        const row = r.slice();
        row[SESS.DUR_MINS] = String(parseDurationMins(r[SESS.ACTUAL_DUR] || r[SESS.SCHED_DUR]));
        return row;
      }) : [];
    (att.length || inst.length || stu.length) ? withRows++ : empty++;

    fs.writeFileSync(path.join(DATA_OUT_DIR, `${token}.json`), JSON.stringify({
      generatedAt: new Date().toISOString(),
      season: CURRENT_SY_LABEL,
      identity: { name: entry.name, title: entry.title, level: entry.level, district: entry.district, schools: entry.schools, region: entry.region },
      columns: { att: ATT, inst: INST, stu: STU, sess: SESS },
      attendance: att, tutorSurveys: inst, scholarSurveys: stu, sessions: sess
    }));

    if (pinMap && pinMap[entry.id]) {
      codes.push({ h: sha256(`${email.trim().toLowerCase()}-${pinMap[entry.id]}`), pid: token });
    }
  }

  if (codes.length) {
    fs.writeFileSync(CODES_OUT_PATH, JSON.stringify({
      _comment: "SHA-256 hashes of '<email>-<4digitPIN>' only. Plaintext never stored here. Regenerated by .github/workflows/build-partner-data.yml",
      codes
    }, null, 2));
    console.log(`Wrote ${codes.length} login codes -> auth/partner-codes.json`);
  } else {
    console.log('PARTNER_PIN_MAP_JSON not provided — auth/partner-codes.json left untouched.');
  }

  console.log(`Wrote ${withRows + empty} data bundles -> partner/data/ (${withRows} with rows, ${empty} empty/pending, ${skipped} skipped)`);
}

main().catch(e => { console.error(e); process.exit(1); });
