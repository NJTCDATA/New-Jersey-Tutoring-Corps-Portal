/**
 * NJTC Comment Follow-Up — tracker + daily escalation email (v1)
 *
 * WHAT IT DOES
 *   1. Stores follow-up status for flagged survey comments. The Central
 *      portal's "Comment Follow-Up" queue reads updates with doGet and saves
 *      them with doPost (same pattern as concern-form-receipt.gs).
 *   2. Every morning, emails each region's Regional Directors the new
 *      ESCALATE comments (scholar wellbeing / safety) from Pearl, so nothing a
 *      tutor raises waits for the weekly WAP. Each comment is emailed once.
 *
 * Which comments are flagged is decided by shared/comment-flags.js — the
 * same rules the portal and the Support Report workbook use. That file is
 * pasted below between the BEGIN/END markers; run
 *   node scripts/sync-comment-flags-gs.js
 * after changing the rules, then paste this file into Apps Script again.
 *
 * ONE-TIME SETUP (about 10 minutes)
 *   1. Create a Google Sheet named "NJTC Comment Follow-Up".
 *   2. Extensions → Apps Script. Paste this whole file. Save.
 *   3. Run setup() once and approve the permissions (Sheets, Gmail, triggers).
 *      It creates the "Updates" and "Escalations Sent" tabs and a daily 7 AM
 *      trigger for sendDailyEscalations().
 *   4. Deploy → New deployment → Web app. Execute as: Me. Who has access:
 *      Anyone. Copy the /exec URL.
 *   5. Paste that URL into FOLLOWUP_URL in central/modules/comment-followup.js
 *      (or send it to the Data team).
 *   Test: run sendDailyEscalations() once by hand; with DRY_RUN = true it only
 *   logs who would be emailed.
 *   Keep the spreadsheet private: no "Publish to the web". The portal only
 *   needs the web-app /exec URL from step 4. In portal notes, describe what
 *   was done without scholar names (e.g. "SL told counselor 11/3").
 */

// ── Config ──────────────────────────────────────────────────────────────────
const PEARL_SHEET_ID = '1y_g5cl4qT2qeUmuO0aeBhURAbXsuGIusgqLiBWOUDLM';   // SY 26-27 Pearl export
const PEARL_GIDS     = { inst: 1955492004, stu: 1245403832, sess: 625567780 };
const PORTAL_URL     = 'https://njtcdata.github.io/New-Jersey-Tutoring-Corps-Portal/central/index.html#pearl-ops';
const LOOKBACK_DAYS  = 4;        // covers weekends and a missed run
const DRY_RUN        = false;    // true = log instead of sending email

// Escalations go to the Regional Directors.
const REGION_DIRECTORS = {
  NE: ['taneisha@njtutoringcorps.org', 'jenny@njtutoringcorps.org'],
  SW: ['andrea@njtutoringcorps.org', 'tierney@njtutoringcorps.org'],
};
const DATA_TEAM_CC = ['amir@njtutoringcorps.org'];

// Same split as the Pearl Operations portal (central/modules/programming.js).
const NE_KEYWORDS = ['ilearn', 'i-learn', 'paterson', 'pcsst', 'hoboken', 'middlesex', 'central jersey', 'lyndhurst', 'vernon', 'asbury park'];
function regionOf(school, district) {
  const s = ((school || '') + ' ' + (district || '')).toLowerCase();
  return NE_KEYWORDS.some(k => s.indexOf(k) >= 0) ? 'NE' : 'SW';
}

const UPDATE_COLS = ['timestamp', 'comment_id', 'status', 'owner', 'note', 'updated_by', 'region'];
const SENT_COLS   = ['comment_id', 'sent_at', 'region', 'date', 'school', 'tutor', 'category', 'comment'];

// ── Web app ─────────────────────────────────────────────────────────────────
// Serves only the Updates tab (comment ids, statuses, owners, notes). The
// "Escalations Sent" tab holds comment text and is never served — keep this
// spreadsheet private (do NOT use File → Share → Publish to the web).
function doGet(e) {
  const sheet = sheetFor_('Updates', UPDATE_COLS);
  const tz = Session.getScriptTimeZone();
  const csv = sheet.getDataRange().getValues().map(row => row.map(cell => {
    const s = cell instanceof Date ? Utilities.formatDate(cell, tz, "yyyy-MM-dd'T'HH:mm:ss") : String(cell);
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }).join(',')).join('\n');
  return ContentService.createTextOutput(csv).setMimeType(ContentService.MimeType.CSV);
}

function doPost(e) {
  try {
    const p = JSON.parse(e.postData.contents);
    if (!p.comment_id || !p.status) throw new Error('comment_id and status are required');
    sheetFor_('Updates', UPDATE_COLS).appendRow([
      new Date(), p.comment_id, p.status, p.owner || '', p.note || '', p.updated_by || '', p.region || '',
    ]);
    return ContentService.createTextOutput(JSON.stringify({ ok: true })).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ ok: false, error: String(err) })).setMimeType(ContentService.MimeType.JSON);
  }
}

// ── Setup ───────────────────────────────────────────────────────────────────
function setup() {
  sheetFor_('Updates', UPDATE_COLS);
  sheetFor_('Escalations Sent', SENT_COLS);
  ScriptApp.getProjectTriggers()
    .filter(t => t.getHandlerFunction() === 'sendDailyEscalations')
    .forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('sendDailyEscalations').timeBased().everyDays(1).atHour(7).create();
  Logger.log('Setup done: tabs ready, daily 7 AM trigger installed.');
}

// ── Daily escalation email ──────────────────────────────────────────────────
function sendDailyEscalations() {
  const pearl = SpreadsheetApp.openById(PEARL_SHEET_ID);
  const tab = gid => {
    const sh = pearl.getSheets().filter(s => s.getSheetId() === gid)[0];
    return sh ? sh.getDataRange().getDisplayValues() : [[]];
  };
  const inst = tab(PEARL_GIDS.inst), stu = tab(PEARL_GIDS.stu), sess = tab(PEARL_GIDS.sess);
  const col = (hdr, name) => hdr.map(h => String(h).replace(/\s+/g, ' ').trim().toLowerCase()).indexOf(name);

  // Session id → title / tutor, read by header name (Pearl inserts columns)
  const sh = sess[0] || [];
  const S = { id: col(sh, 'pearl session id'), title: col(sh, 'title'), tutor: col(sh, 'instructor'), start: col(sh, 'scheduled start') };
  const sessById = {};
  sess.slice(1).forEach(r => { if (r[S.id]) sessById[r[S.id]] = { title: r[S.title], instructor: r[S.tutor], start: r[S.start] }; });

  const since = new Date(); since.setDate(since.getDate() - LOOKBACK_DAYS);
  const sinceYmd = Utilities.formatDate(since, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  const toYMD = v => {
    const t = String(v || '').trim();
    let m = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (m) return m[1] + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[3]).slice(-2);
    m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
    if (m) return (m[3].length === 2 ? '20' + m[3] : m[3]) + '-' + ('0' + m[1]).slice(-2) + '-' + ('0' + m[2]).slice(-2);
    return '';
  };
  const archived = v => /^\s*(z{3}|njtc\s*$)/i.test(v || '');

  const flagged = NJTC_COMMENT_FLAGS.collect({
    instRows: inst.slice(1), stuRows: stu.slice(1),
    INST_S: { FILLED_BY: 0, OVERALL: 5, COMMENT_ADMIN: 6, COMMENT_SELF: 7, DATE: 8, SCHOOL: 9, DISTRICT: 10, SESS_ID: 11 },
    STU_S: { FILLED_BY: 0, OVERALL: 5, COMMENT: 6, DATE: 7, SCHOOL: 8, DISTRICT: 9, SESS_ID: 11, FILLED_BY_ID: 12 },
    sessById: sessById, toYMD: toYMD,
    inScope: (school, district) => !!school && !archived(school) && !archived(district),
    inDates: ymd => !!ymd && ymd >= sinceYmd,
  }).filter(c => c.tier === 'escalate');

  // Skip anything already emailed or already closed in the portal
  const sentSheet = sheetFor_('Escalations Sent', SENT_COLS);
  const sent = {};
  sentSheet.getDataRange().getValues().slice(1).forEach(r => { sent[r[0]] = 1; });
  const closed = {};
  sheetFor_('Updates', UPDATE_COLS).getDataRange().getValues().slice(1).forEach(r => {
    closed[r[1]] = /^(resolved|no action needed)$/i.test(String(r[2]));
  });
  const fresh = flagged.filter(c => !sent[c.id] && !closed[c.id]);
  if (!fresh.length) { Logger.log('No new escalations.'); return; }

  const byRegion = { NE: [], SW: [] };
  fresh.forEach(c => byRegion[regionOf(c.school, c.district)].push(c));

  Object.keys(byRegion).forEach(region => {
    const items = byRegion[region];
    if (!items.length) return;
    const subject = 'NJTC ' + region + ': ' + items.length + ' comment' + (items.length > 1 ? 's' : '') + ' to check within 24 hours';
    const esc = s => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const rows = items.map(c => '<tr>' +
      '<td style="padding:6px;border:1px solid #ddd">' + esc(c.date) + '</td>' +
      '<td style="padding:6px;border:1px solid #ddd">' + esc(c.school.replace(/^LEA - iLearn /, 'iLearn ')) + '</td>' +
      '<td style="padding:6px;border:1px solid #ddd">' + esc(c.tutor) + (c.session ? ' · ' + esc(c.session) : '') + '<br><small>' + (c.from === 'scholar' ? 'Scholar survey' : 'Tutor comment') + '</small></td>' +
      '<td style="padding:6px;border:1px solid #ddd"><b>' + esc(c.category) + '</b><br>' + esc(c.text) + '</td>' +
      '<td style="padding:6px;border:1px solid #ddd">' + esc(c.step) + '</td></tr>').join('');
    const html = '<p>Hi,</p><p>Tutors or scholars raised the following in Pearl surveys. Please make sure someone checks in within 24 hours, ' +
      'then mark each one in the <a href="' + PORTAL_URL + '">Comment Follow-Up queue</a> (Pearl Operations → 🚩 Comment Follow-Up).</p>' +
      '<table style="border-collapse:collapse;font-family:Arial,sans-serif;font-size:13px">' +
      '<tr style="background:#1b2a4a;color:#fff"><th style="padding:6px">Date</th><th style="padding:6px">School</th><th style="padding:6px">From</th>' +
      '<th style="padding:6px">What was said</th><th style="padding:6px">Suggested step</th></tr>' + rows + '</table>' +
      '<p style="color:#666;font-size:12px">These are signals to check in, not HR actions. Flagged automatically by the NJTC portal rules; sent once per comment.</p>';
    if (DRY_RUN) {
      Logger.log('[DRY RUN] ' + subject + ' → ' + REGION_DIRECTORS[region].join(', '));
    } else {
      MailApp.sendEmail({ to: REGION_DIRECTORS[region].join(','), cc: DATA_TEAM_CC.join(','), subject: subject, htmlBody: html });
      const now = new Date();
      items.forEach(c => sentSheet.appendRow([c.id, now, region, c.date, c.school, c.tutor, c.category, c.text]));
    }
  });
}

// ── Helpers ─────────────────────────────────────────────────────────────────
function sheetFor_(name, cols) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(name);
  if (!sh) { sh = ss.insertSheet(name); sh.appendRow(cols); sh.setFrozenRows(1); }
  return sh;
}

// ==== BEGIN shared/comment-flags.js (generated — edit the shared file, then run node scripts/sync-comment-flags-gs.js) ====
/* ============================================================================
   NJTC PEARL — COMMENT FOLLOW-UP FLAGS (single source of truth)
   ============================================================================
   Decides which tutor and scholar survey comments need someone to follow up,
   how urgently, and why. Used by the Support Report workbook ("Flagged
   Comments" tab), the Onsite Staff Report and the Comment Follow-Up queue.

   Tiers
     escalate — scholar wellbeing or safety (distress, grief, peer harm,
                injury, feeling unsafe). Check in within 24 hours.
     followup — the tutor needs support or something needs fixing: behaviour
                that stops learning, the room, schedule / Pearl problems,
                roster or group size, a very low session rating, or a tutor
                saying they already raised it with the school. This week.
     null     — a normal session note; nothing to do.

   Why rules, not keywords + top 5: tutors write in "Leave a comment for
   admin" because they want someone to read it. The Oct 2026 review found the
   old keyword buckets caught 3 of ~20 NE items that needed follow-up (missed:
   grief, "being mean to me", "did not learn anything", Pearl schedule
   problems, a 5th scholar in a group). These rules are tuned on that real
   data (scripts/test-comment-flags.js) and are a signal for a person to
   read, never an HR action.

   Loaded as a plain <script> (window.NJTC_COMMENT_FLAGS) or required from
   Node (module.exports), like shared/pearl-categories.js.
   ============================================================================ */
(function (root) {
  'use strict';

  var TIER = { ESCALATE: 'escalate', FOLLOWUP: 'followup' };
  var TIER_LABEL = { escalate: 'Escalate (24 hrs)', followup: 'Follow up (this week)' };

  // Each rule: category, tier, regex (run on lower-cased text), suggested step.
  // Order matters only for which category is reported first; every matching
  // rule is listed in `categories`.
  var RULES = [
    // ── Escalate: scholar wellbeing and safety ───────────────────────────
    { cat: 'Possible harm or abuse', tier: 'escalate',
      re: /\b(suicid\w*|kill (my|him|her)self|hurt(ing)? (my|him|her)self|self[- ]harm\w*|abus(e|ed|ing)|touched me|hits? me|punch(ed)? me|kick(ed)? me|push(ed)? me|threat(en)?\w*|weapon|knife|(a|his|her|their|with) gun)\b/,
      step: 'Tell the Site Leader and the school today; follow the school\'s safeguarding process.' },
    { cat: 'Peer conflict / bullying', tier: 'escalate',
      re: /\b(bull(y|ied|ying)|(being |is |are |was )?mean to me|picking on|pick(s|ed)? on me|made fun of|making fun of|harass\w*|left me out|calls? me names)\b/,
      step: 'Site Leader checks in with the tutor and classroom teacher today; watch for a pattern.' },
    { cat: 'Scholar distress', tier: 'escalate',
      re: /\b(sad|anxious|anxiety|depress\w*|crying|cried|scared|afraid|unsafe|not safe|hopeless|overwhelmed|home alone|hungry|no food)\b/,
      step: 'Site Leader lets the classroom teacher or counselor know today.' },
    { cat: 'Grief or family loss', tier: 'escalate',
      re: /\b(passed away|died|death in|funeral|grie(f|ving)|lost (his|her|their|my) (grand\w*|mom|mother|dad|father|brother|sister|parent|uncle|aunt|cousin))\b/,
      step: 'Let the classroom teacher or counselor know; tutor checks in gently.' },
    { cat: 'Injury or medical', tier: 'escalate',
      re: /\b(broke (his|her|their|my) \w+|broken (arm|leg|foot|wrist|ankle|hand)|injur(y|ed|ies)|hospital\w*|ambulance|concussion|seizure|allergic reaction|bleeding)\b/,
      step: 'Confirm the school knows; check whether the session needs to move or pause.' },

    // ── Follow up: tutor support and fixes ───────────────────────────────
    { cat: 'Behaviour stopping learning', tier: 'followup',
      re: /\b(disrespect\w*|mock(ed|ing|s)?|aggressive\w*|tantrum|defian\w*|curs(e|ed|ing)|swear\w*|fight\w*|argu(e|es|ed|ing)|conflict|disruptive|disruption|discipline|immature|rude|behaviou?ral (issue|problem|concern)s?|behaviou?r (issue|problem|concern)s?|did not learn anything|didn.?t learn anything|wasted half|impossible to finish|could not get through|not able to get through|removed from the (tutoring )?group|do not get along|don.?t get along|attitude problem|strong attitudes)\b/,
      step: 'Program Manager or Site Leader checks in with the tutor; agree regrouping or a behaviour plan with the school.' },
    { cat: 'Learning environment', tier: 'followup',
      re: /\b(extremely loud|so loud|very loud|too loud|noise level|noisy|rowdy|pull[- ]out room|no (quiet )?space|no room to|substitute teacher|teacher kept yelling)\b/,
      step: 'Ask the school for a quieter space or a different time.' },
    { cat: 'Schedule or Pearl problem', tier: 'followup',
      re: /\b(disappeared from (my )?pearl|not (showing |appearing )?(in|on) (my )?pearl|missing from (my )?(pearl|schedule)|appears in pearl at|wrong time in pearl|pearl (issue|error|problem)|pulled out of (pe|gym|lunch|recess|specials|art|music)|tracking down (students|scholars)|could not find (my )?(students|scholars)|couldn.?t find (my )?(students|scholars))\b/,
      step: 'Fix the session in Pearl or review the tutoring block with the site.' },
    { cat: 'Roster or group size', tier: 'followup',
      re: /\b((5th|fifth|6th|sixth) (student|scholar)|too many (students|scholars)|(an )?extra (student|scholar)|iep\b|504 plan|(asked|ask) to be taken off|taken off (the|my) (group|roster)|moved to (special|sped)|should not be paired)/,
      step: 'Update the roster or group in Pearl; keep groups at 4:1 or smaller.' },
    { cat: 'Raised with the school', tier: 'followup',
      re: /\b((had to |have |already |will )?(inform|notif|told|tell|let)\w* (the )?(admin\w*|principal|homeroom teacher|site leader|assistant principal|ap\b|counselor)|address with (the )?admin\w*)/,
      step: 'Confirm the school responded and the tutor has what they need.' },
    { cat: 'Site safety (FYI)', tier: 'followup',
      re: /\b(evacuat\w*|gas (smell|leak)|lockdown|shelter in place)\b/,
      step: 'Confirm with the site that the building is clear; no tutor action.' },
  ];

  // Scholar-only signals (short survey comments): strong dislike with a low rating.
  var SCHOLAR_DISLIKE = /\b(hate\w*|boring|not fun|don.?t like|didn.?t like|not well at all)\b/;
  // A low rating explained only by a routine disruption is not a follow-up.
  var ROUTINE_ONLY = /^[^.]*\b(fire drill|half day|shortened|early dismissal|assembly|delayed opening)\b[^.]*\.?$/;
  var NEGATION = /\b(no|not|never|without|nothing|none)\s+(\w+\s+){0,2}$/;

  function norm(s) { return String(s == null ? '' : s).replace(/\s+/g, ' ').trim(); }

  function matches(rule, lower) {
    var m, re = new RegExp(rule.re.source, 'g');
    while ((m = re.exec(lower))) {
      var before = lower.slice(Math.max(0, m.index - 30), m.index);
      if (!NEGATION.test(before)) return true;
      if (m.index === re.lastIndex) re.lastIndex++;
    }
    return false;
  }

  /**
   * triage({ text, from: 'tutor'|'scholar', rating }) →
   *   null (nothing to do) or { tier, tierLabel, category, categories[], step }
   * rating: the "Overall, how did this session go?" score (1–5) when known.
   */
  function triage(input) {
    var text = norm(input && input.text);
    if (!text || text.length < 3) return null;
    var lower = text.toLowerCase();
    var from = (input.from || 'tutor').toLowerCase();
    var rating = parseFloat(input.rating);
    var hits = RULES.filter(function (r) { return matches(r, lower); });
    if (from === 'scholar') {
      // Scholars write short, playful comments: only wellbeing, peer harm,
      // the room, and strong dislike on a low-rated session count.
      hits = hits.filter(function (r) { return r.tier === 'escalate' || r.cat === 'Learning environment'; });
      if (!hits.length && !isNaN(rating) && rating <= 2 && SCHOLAR_DISLIKE.test(lower)) {
        hits = [{ cat: 'Scholar unhappy with session', tier: 'followup', step: 'Tutor or Site Leader asks the scholar what would help.' }];
      }
    } else if (!hits.length && !isNaN(rating) && rating <= 2 && text.length >= 15 && !ROUTINE_ONLY.test(lower)) {
      hits = [{ cat: 'Very low session rating', tier: 'followup', step: 'Site Leader asks the tutor what happened and what would help.' }];
    }
    if (!hits.length) return null;
    var esc = hits.filter(function (r) { return r.tier === 'escalate'; });
    var top = (esc[0] || hits[0]);
    return {
      tier: top.tier, tierLabel: TIER_LABEL[top.tier], category: top.cat,
      categories: hits.map(function (r) { return r.cat; }), step: top.step,
    };
  }

  // Stable id for a comment, so follow-up status can be stored against it.
  // FNV-1a over session id + who + text (no crypto needed in the browser).
  function commentId(sessionId, who, text) {
    var s = String(sessionId || '') + '|' + String(who || '').toLowerCase() + '|' + norm(text).toLowerCase().slice(0, 120);
    var h = 0x811c9dc5;
    for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0; }
    return 'C' + ('0000000' + h.toString(16)).slice(-8);
  }

  /**
   * Collect every flagged comment from Pearl survey rows.
   * opts: { instRows, stuRows, INST_S, STU_S, sessById: {id → {title, instructor, start}},
   *         inScope(school, district) → bool, inDates(ymd) → bool, toYMD(v) → 'YYYY-MM-DD' }
   * Returns rows sorted escalate first, then newest first.
   */
  function collect(opts) {
    var out = [], seen = {};
    var I = opts.INST_S, S = opts.STU_S, sess = opts.sessById || {};
    var ok = function (school, district, ymd) {
      return (!opts.inScope || opts.inScope(school, district)) && (!opts.inDates || opts.inDates(ymd));
    };
    var push = function (base, text, from, field, rating) {
      var t = triage({ text: text, from: from, rating: rating });
      if (!t) return;
      var id = commentId(base.sessionId, from === 'tutor' ? base.tutor : base.scholarId || base.scholar, text);
      if (seen[id]) return; seen[id] = 1;
      out.push(Object.assign({}, base, { id: id, from: from, field: field, text: norm(text), rating: isNaN(rating) ? '' : rating }, t));
    };
    (opts.instRows || []).forEach(function (r) {
      var school = norm(r[I.SCHOOL]), district = norm(r[I.DISTRICT]), ymd = opts.toYMD(r[I.DATE]);
      if (!ok(school, district, ymd)) return;
      var s = sess[r[I.SESS_ID]] || {};
      var base = { date: ymd, school: school, district: district, tutor: norm(r[I.FILLED_BY]), session: s.title || '', sessionId: r[I.SESS_ID] || '', scholar: '', scholarId: '' };
      var rating = parseFloat(r[I.OVERALL]);
      push(base, r[I.COMMENT_ADMIN], 'tutor', 'Comment for admin', rating);
      push(base, r[I.COMMENT_SELF], 'tutor', 'Comment for self', rating);
    });
    (opts.stuRows || []).forEach(function (r) {
      var school = norm(r[S.SCHOOL]), district = norm(r[S.DISTRICT]), ymd = opts.toYMD(r[S.DATE]);
      if (!ok(school, district, ymd)) return;
      var s = sess[r[S.SESS_ID]] || {};
      var base = { date: ymd, school: school, district: district, tutor: s.instructor || '', session: s.title || '', sessionId: r[S.SESS_ID] || '',
        scholar: norm(r[S.FILLED_BY]), scholarId: r[S.FILLED_BY_ID] || '' };
      push(base, r[S.COMMENT], 'scholar', 'Scholar comment', parseFloat(r[S.OVERALL]));
    });
    var rank = { escalate: 0, followup: 1 };
    out.sort(function (a, b) { return rank[a.tier] - rank[b.tier] || String(b.date).localeCompare(String(a.date)) || a.school.localeCompare(b.school); });
    return out;
  }

  var API = { TIER: TIER, TIER_LABEL: TIER_LABEL, RULES: RULES, triage: triage, collect: collect, commentId: commentId };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  else root.NJTC_COMMENT_FLAGS = API;
})(typeof window !== 'undefined' ? window : this);
// ==== END shared/comment-flags.js ====
