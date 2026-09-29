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
 * School years: defined once in partner/partner-report.js (SEASONS) — loaded
 * here with Node's vm so the dashboard, Central's partner PDF and this build
 * share one normalization + methodology. Output per directory entry:
 *   partner/data/<token>.json            current (live) season + `trend` summary
 *   partner/data/<token>.<season>.json   each archived season — fetched by the
 *                                        dashboard only when a user toggles to it
 * Archived-season files carry no timestamp, so re-running over a frozen sheet
 * produces byte-identical files (no nightly git churn).
 *
 * Usage:
 *   PARTNER_HMAC_KEY=... PARTNER_EMAIL_MAP_JSON='{...}' [PARTNER_PIN_MAP_JSON='{...}'] \
 *     node scripts/build-partner-data.js
 */
const https = require('https');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const DIRECTORY_PATH = path.join(ROOT, 'partner', 'directory.json');
const DATA_OUT_DIR = path.join(ROOT, 'partner', 'data');
const CODES_OUT_PATH = path.join(ROOT, 'auth', 'partner-codes.json');

// ── Shared core (partner/partner-report.js) ────────────────────────────────
const sandbox = { window: {}, document: { currentScript: null }, console };
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(ROOT, 'partner', 'partner-report.js'), 'utf8'), sandbox);
const R = sandbox.window.NJTCPartnerReport;
const { ATT, INST, STU, SESS, SEASONS, SEASON_ORDER, CURRENT_SEASON } = R;
const COLUMNS = { att: ATT, inst: INST, stu: STU, sess: SESS };

// Attendance columns the partner app never reads (session status, grade,
// sex, race) are blanked: smaller bundles, and no demographic detail in a
// partner's browser. Row positions are unchanged.
const ATT_BLANK = [ATT.SESS_STATUS, ATT.GRADE, ATT.SEX, ATT.RACE];
function slimAtt(r) { const o = r.slice(0, ATT.USER_ID + 1); ATT_BLANK.forEach(i => { o[i] = ''; }); return o; }

// Legacy env overrides — the season label/start now live in SEASONS.
if (process.env.PARTNER_SY_LABEL && process.env.PARTNER_SY_LABEL !== CURRENT_SEASON) {
  console.warn(`! PARTNER_SY_LABEL=${process.env.PARTNER_SY_LABEL} ignored — current season is ${CURRENT_SEASON} (partner/partner-report.js SEASONS).`);
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

async function fetchTab(season, gid) {
  const urls = R.seasonUrls(season, gid);
  let lastErr;
  for (let attempt = 0; attempt < 3; attempt++) {
    for (const url of urls) {
      try {
        const text = await fetchText(url);
        if (text.trim().startsWith('<')) throw new Error('HTML response — sheet not shared');
        const rows = R.parseCSV(text);
        if (rows.length < 2) throw new Error('Empty or header-only response');
        return rows;
      } catch (e) { lastErr = e; }
    }
    if (attempt < 2) await new Promise(r => setTimeout(r, 1500 * (attempt + 1)));
  }
  throw lastErr;
}

async function loadSeason(season) {
  const g = SEASONS[season].gids;
  const [att, inst, stu] = await Promise.all([fetchTab(season, g.att), fetchTab(season, g.inst), fetchTab(season, g.stu)]);
  // Session Details (durations) fail soft — tutored minutes just won't show.
  let sess = [[]];
  try { sess = await fetchTab(season, g.sess); }
  catch (e) { console.warn(`  ! [${season}] sessions tab fetch failed (${e.message}) — tutored-minutes omitted.`); }
  const n = R.normalizeSeason(season, { att, inst, stu, sess });
  console.log(`  [${season}] attendance ${n.att.length} | tutor surveys ${n.inst.length} | scholar surveys ${n.stu.length} | sessions ${n.sess.length} (zzz-archived rows excluded)`);
  return Object.assign(n, { season });
}

function sha256(s) { return crypto.createHash('sha256').update(s).digest('hex'); }
function hmacToken(s, key) { return crypto.createHmac('sha256', key).update(s).digest('hex').slice(0, 24); }

function scopedBundle(pearl, entry) {
  const b = R.bundleForEntry(pearl, entry);
  b.attendance = b.attendance.map(slimAtt);
  return b;
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

  console.log(`Current season ${CURRENT_SEASON}; seasons: ${SEASON_ORDER.join(', ')}`);
  console.log('Fetching Pearl exports...');
  const pearl = {};
  for (const season of SEASON_ORDER) {
    try { pearl[season] = await loadSeason(season); }
    catch (e) {
      if (season === CURRENT_SEASON) throw e;           // live year must load
      console.warn(`  ! [${season}] archive fetch failed (${e.message}) — keeping existing archive files.`);
    }
  }

  fs.mkdirSync(DATA_OUT_DIR, { recursive: true });
  // Remove stale bundles; keep archive files for seasons that failed to load.
  for (const f of fs.readdirSync(DATA_OUT_DIR)) {
    if (!f.endsWith('.json')) continue;
    const m = f.match(/^[0-9a-f]{24}\.(\d{4}-\d{2})\.json$/);
    if (m && !pearl[m[1]] && SEASONS[m[1]]) continue;
    fs.unlinkSync(path.join(DATA_OUT_DIR, f));
  }

  const codes = [];
  let withRows = 0, empty = 0, skipped = 0;

  for (const entry of directory) {
    const email = emailMap[entry.id];
    if (!email) { console.warn(`  ! no email for ${entry.id} (${entry.name}) — skipped`); skipped++; continue; }
    const token = hmacToken(entry.id, hmacKey);

    const trend = [];
    const archives = {};
    for (const season of SEASON_ORDER) {
      const archFile = `${token}.${season}.json`;
      if (!pearl[season]) {
        if (season !== CURRENT_SEASON && fs.existsSync(path.join(DATA_OUT_DIR, archFile))) {
          archives[season] = archFile;
          try { trend.push(JSON.parse(fs.readFileSync(path.join(DATA_OUT_DIR, archFile), 'utf8')).summary); } catch (e) {}
        }
        continue;
      }
      const b = scopedBundle(pearl[season], entry);
      b.summary = R.seasonSummary(b);
      const hasRows = b.attendance.length || b.scholarSurveys.length || b.tutorSurveys.length;
      if (season === CURRENT_SEASON) {
        hasRows ? withRows++ : empty++;
      } else if (hasRows) {
        // Archived season — deterministic content (no timestamp)
        fs.writeFileSync(path.join(DATA_OUT_DIR, archFile), JSON.stringify({
          season, archived: true,
          identity: { name: entry.name, title: entry.title, level: entry.level, district: entry.district, schools: entry.schools, region: entry.region },
          columns: COLUMNS, summary: b.summary,
          attendance: b.attendance, tutorSurveys: b.tutorSurveys, scholarSurveys: b.scholarSurveys, sessions: b.sessions
        }));
        archives[season] = archFile;
      }
      if (hasRows) trend.push(b.summary);
      if (season === CURRENT_SEASON) pearl._current = b;
    }

    const cur = pearl._current;
    fs.writeFileSync(path.join(DATA_OUT_DIR, `${token}.json`), JSON.stringify({
      generatedAt: new Date().toISOString(),
      season: CURRENT_SEASON,
      seasons: [CURRENT_SEASON, ...Object.keys(archives)],
      archives,
      trend,
      identity: { name: entry.name, title: entry.title, level: entry.level, district: entry.district, schools: entry.schools, region: entry.region },
      columns: COLUMNS,
      attendance: cur.attendance, tutorSurveys: cur.tutorSurveys, scholarSurveys: cur.scholarSurveys, sessions: cur.sessions
    }));
    delete pearl._current;

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

  console.log(`Wrote ${withRows + empty} current-season bundles -> partner/data/ (${withRows} with rows, ${empty} empty/pending, ${skipped} skipped)`);
}

if (require.main === module) main().catch(e => { console.error(e); process.exit(1); });
module.exports = { R, scopedBundle, slimAtt, main };
