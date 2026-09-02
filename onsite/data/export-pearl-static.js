/**
 * NJTC Pearl Static Data Export
 *
 * Run this script ONCE from your local machine (Node.js 18+) to download
 * the Pearl 25-26 operational data and save it as static JSON files.
 * Then commit the generated JSON files to the repo.
 *
 * Usage:
 *   node onsite/data/export-pearl-static.js
 *
 * The script writes:
 *   onsite/data/pearl-att.json    (Attendance)
 *   onsite/data/pearl-stu.json    (Student surveys)
 *   onsite/data/pearl-inst.json   (Instructor surveys)
 *   onsite/data/pearl-sess.json   (Session details)
 *   onsite/data/pearl-login.json  (Staff login / school mapping)
 *
 * Once committed, update leader-team.js to load from these local files
 * instead of the Google pub URLs (see USING STATIC FILES section below).
 */

const https = require('https');
const fs    = require('fs');
const path  = require('path');

const OUT_DIR = path.join(__dirname);

// Single source of truth — see ../data-sources.js. Update rollover values
// there, not here (it doubles as a Node module via module.exports).
const SRC       = require('../data-sources.js');
const PEARL_KEY = SRC.PEARL_2PACX;
const LOGIN_KEY = SRC.PEARL_LOGIN_2PACX;

const SOURCES = [
  { name: 'pearl-att',   url: `https://docs.google.com/spreadsheets/d/e/${PEARL_KEY}/pub?output=csv&gid=${SRC.PEARL_GIDS.att}` },
  { name: 'pearl-stu',   url: `https://docs.google.com/spreadsheets/d/e/${PEARL_KEY}/pub?output=csv&gid=${SRC.PEARL_GIDS.stu}` },
  { name: 'pearl-inst',  url: `https://docs.google.com/spreadsheets/d/e/${PEARL_KEY}/pub?output=csv&gid=${SRC.PEARL_GIDS.inst}` },
  { name: 'pearl-sess',  url: `https://docs.google.com/spreadsheets/d/e/${PEARL_KEY}/pub?output=csv&gid=${SRC.PEARL_GIDS.sess}` },
  { name: 'pearl-login', url: `https://docs.google.com/spreadsheets/d/e/${LOGIN_KEY}/pub?output=csv&gid=0` },
];

function fetchText(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetchText(res.headers.location).then(resolve, reject);
      }
      if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode}`));
      let body = '';
      res.on('data', d => body += d);
      res.on('end', () => resolve(body));
    }).on('error', reject);
  });
}

function parseCSV(text) {
  const rows = [];
  let row = [], field = '', inQuote = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i], next = text[i + 1];
    if (inQuote) {
      if (ch === '"' && next === '"') { field += '"'; i++; }
      else if (ch === '"') { inQuote = false; }
      else { field += ch; }
    } else {
      if (ch === '"') { inQuote = true; }
      else if (ch === ',') { row.push(field); field = ''; }
      else if (ch === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
      else if (ch === '\r') {}
      else { field += ch; }
    }
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  return rows;
}

function csvToObjects(text) {
  const rows = parseCSV(text);
  if (rows.length < 2) return [];
  const headers = rows[0].map(h => h.trim());
  return rows.slice(1).map(row => {
    const obj = {};
    headers.forEach((h, i) => { obj[h] = (row[i] || '').trim(); });
    return obj;
  });
}

async function run() {
  for (const src of SOURCES) {
    process.stdout.write(`Fetching ${src.name}… `);
    try {
      const text = await fetchText(src.url);
      if (text.trim().startsWith('<')) {
        console.log('FAILED — got HTML (sheet not public or URL wrong)');
        continue;
      }
      const data = csvToObjects(text);
      const outPath = path.join(OUT_DIR, src.name + '.json');
      fs.writeFileSync(outPath, JSON.stringify(data));
      console.log(`OK — ${data.length} rows → ${src.name}.json`);
    } catch (e) {
      console.log(`FAILED — ${e.message}`);
    }
  }
  console.log('\nDone. Commit the .json files and then update leader-team.js:');
  console.log('  Replace pearlUrl(GID) calls with: ./data/pearl-att.json etc.');
  console.log('  Use fetchJSON() instead of fetchCSV() for these sources.');
}

run();


/* ─────────────────────────────────────────────
   USING STATIC FILES IN leader-team.js
   (apply these changes after running this script)
─────────────────────────────────────────────

1. Add a fetchJSON helper:

   async function fetchJSON(path, cacheKey) {
     if (cacheKey) { const c = cacheGet(cacheKey); if (c) return c; }
     const res = await fetch(path);
     if (!res.ok) throw new Error('HTTP ' + res.status);
     const data = await res.json();
     if (cacheKey) cacheSet(cacheKey, data);
     return data;
   }

2. In loadCriticalData(), replace the Pearl fetchCSV calls:

   fetchCSV(pearlUrl(PEARL_ATT_GID), CACHE_KEYS.att)
   → fetchJSON('data/pearl-att.json', CACHE_KEYS.att)

   fetchCSV(pearlUrl(PEARL_STU_GID), CACHE_KEYS.stu)
   → fetchJSON('data/pearl-stu.json', CACHE_KEYS.stu)

   fetchCSV(pearlLoginUrl(), CACHE_KEYS.pearlLogin)
   → fetchJSON('data/pearl-login.json', CACHE_KEYS.pearlLogin)

3. Same for INST/SESS if used.
───────────────────────────────────────────── */
