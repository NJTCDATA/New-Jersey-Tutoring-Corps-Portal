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

// Same published Pearl workbook the internal/onsite portals already read from.
const PEARL_2PACX = '2PACX-1vQ1iC8NZFJt3iinGUEqftKtP32N43axi_JN_RQI36EBUdhZS0PaZRwd-1AJT3bEVe6cqHA0tCA3vb5K';
const PEARL_GIDS = { att: 702726038, inst: 1955492004, stu: 1245403832 };

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

// Districts with no partner contact yet in partner/directory.json still need a
// region so Admin/Regional accounts see them. This is a geographic BEST GUESS,
// not confirmed by NJTC — check with Amir before relying on Regional scoping
// for these five: Hoboken, Paterson, American Paradigm, Central Jersey College
// Prep, Middlesex County STEM.
const REGION_DISTRICTS = {
  'North-East': ['iLearn CMO', 'Hoboken Dual Language Charter Schools', 'Paterson'],
  'South-West': [
    'Lawrence Township Schools', 'LEAP Academy Charter School', 'Pemberton Twp Schools',
    'Penns Grove - Carneys Point Regional School District', 'Hamilton Township',
    'String Theory Schools', 'Gloucester Township School District',
    'Global Leadership Academy Charter Schools', 'Berlin Community School', 'Haddon Township',
    'American Paradigm Schools', 'Central Jersey College Prep', 'Middlesex County STEM Charter School'
  ]
};

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

  console.log('Fetching Pearl exports...');
  const [attRows, instRows, stuRows] = await Promise.all([fetchSheet('att'), fetchSheet('inst'), fetchSheet('stu')]);
  console.log(`  attendance: ${attRows.length - 1} rows | tutor surveys: ${instRows.length - 1} rows | scholar surveys: ${stuRows.length - 1} rows`);

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
    const att = attRows.slice(1).filter(r => scopeMatches(entry, (r[ATT.DISTRICT] || '').trim(), (r[ATT.SCHOOL] || '').trim()));
    const inst = instRows.slice(1).filter(r => scopeMatches(entry, (r[INST.DISTRICT] || '').trim(), (r[INST.SCHOOL] || '').trim()));
    const stu = stuRows.slice(1).filter(r => scopeMatches(entry, (r[STU.DISTRICT] || '').trim(), (r[STU.SCHOOL] || '').trim()));
    (att.length || inst.length || stu.length) ? withRows++ : empty++;

    fs.writeFileSync(path.join(DATA_OUT_DIR, `${token}.json`), JSON.stringify({
      generatedAt: new Date().toISOString(),
      identity: { name: entry.name, title: entry.title, level: entry.level, district: entry.district, schools: entry.schools, region: entry.region },
      columns: { att: ATT, inst: INST, stu: STU },
      attendance: att, tutorSurveys: inst, scholarSurveys: stu
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
