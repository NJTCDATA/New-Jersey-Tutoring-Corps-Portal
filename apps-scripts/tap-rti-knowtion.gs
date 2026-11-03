/**
 * ╔══════════════════════════════════════════════════════════════════════════════╗
 * ║  NJTC TAP — RTI / TRAINING HOURS FROM KNOWTION (SY 26-27)                   ║
 * ║  Add-on file for the TAP Tracker 26-27 Apps Script project.                ║
 * ╠══════════════════════════════════════════════════════════════════════════════╣
 * ║  Reads the "Knowtion - Onsite Training SY 26-27" workbook every night and  ║
 * ║  writes one row per learner to the "RTI — Knowtion" tab:                   ║
 * ║    • Estimated hours  (Knowtion's planned time per item)                   ║
 * ║    • Time spent hours (time Knowtion logged on the item's page — live      ║
 * ║      workshops, site visits and outside trainings show ~0 here)            ║
 * ║    • Course 3 (RTI) only — estimated and time spent ("(Master)" copies     ║
 * ║      are staff test runs and are NOT in this figure)                       ║
 * ║    • the same two numbers for EVERY program, and for every SY month        ║
 * ║  Tutors are linked to their Master Roster name; site leaders are listed    ║
 * ║  by their Knowtion name. The portal reads this tab via                     ║
 * ║  doGet?tab=rti_knowtion and shows both numbers side by side.               ║
 * ║                                                                            ║
 * ║  THE OFFICIAL RTI TOTAL (Master Roster "RTI Hours - LMS (Total)") AND THE  ║
 * ║  288-HOUR COMPLETION CHECK ARE NOT CHANGED — NJTC has not decided which    ║
 * ║  number counts yet.                                                        ║
 * ║                                                                            ║
 * ║  ACCURACY RULES                                                            ║
 * ║    • Each learner + program + assignment counts once (latest completion). ║
 * ║    • "<1 min" = 0 minutes. Blank estimate = 0 and counted in              ║
 * ║      "Items Missing Estimate".                                             ║
 * ║    • Names: "RTI Name Map" tab first, then exact name, then a strict      ║
 * ║      first+last match. Anything unsure is left unlinked and listed on     ║
 * ║      "RTI — Needs Name Match" — never guessed.                             ║
 * ║                                                                            ║
 * ║  DEPENDS ON (main script / other add-ons in this project):                ║
 * ║   _getSpreadsheet, _getSheetByGID, GID_MASTER_ROSTER, MR_*, MONTH_LABELS, ║
 * ║   _normName, _normNameFuzzy, _demoFuzzyMatch, _ensureColumnCount,          ║
 * ║   _logNotification, _safeAlert, _handleError, _sy2627StripAccents          ║
 * ╚══════════════════════════════════════════════════════════════════════════════╝
 */

var RTI_KN = {
  SHEET_ID: '1a4FTtODGfvO1FsQUp_MpQbePAjTF3Ire6uAHhL-EXFI',
  // Source tabs, found by GID first (names can change); name prefix is the fallback.
  SOURCES: [
    { gid: 267261099, namePrefix: 'Tutor',                      audience: 'Tutor' },
    { gid: 172053344, namePrefix: 'Site Leader Training',       audience: 'Site Leader' },
    { gid: 713859468, namePrefix: 'Site Leaders Preparation',   audience: 'Site Leader' },
  ],
  OUT_TAB:    'RTI — Knowtion',
  REVIEW_TAB: 'RTI — Needs Name Match',
  MAP_TAB:    'RTI Name Map',
  COURSE3_RE: /^\s*course\s*3\b/i,
  MASTER_RE:  /\(master\)/i,
};


// ══════════════════════════════════════════════════════════════════════════════
// ██  ENTRY POINTS
// ══════════════════════════════════════════════════════════════════════════════

/** Nightly trigger target + menu action. Rebuilds the RTI — Knowtion tab. */
function syncKnowtionRTI() {
  try {
    var res = _rtiKnowtionBuild();
    _logNotification('RTI_KNOWTION_SYNC', '',
      res.learners + ' learners (' + res.linked + ' linked to the roster, ' + res.siteLeaders + ' site leaders) | ' +
      res.items + ' items | ' + res.dupes + ' duplicate rows ignored | ' + res.needsMatch + ' need a name match',
      '', 'syncKnowtionRTI');
    try { PropertiesService.getScriptProperties().setProperty('AUTO_LAST_RUN_rtiKnowtion', new Date().toISOString()); } catch (e) {}
    return res;
  } catch (err) {
    _handleError('syncKnowtionRTI', err);
    return null;
  }
}

function menuSyncKnowtionRTI() {
  var res = syncKnowtionRTI();
  if (!res) { _safeAlert('RTI sync failed — see Notifications Log (SCRIPT_ERROR).'); return; }
  _safeAlert('RTI — Knowtion hours updated.\n\n' +
    'Learners: ' + res.learners + ' (tutors linked to the Master Roster: ' + res.linked + ', site leaders: ' + res.siteLeaders + ')\n' +
    'Completed items counted: ' + res.items + (res.dupes ? ' (' + res.dupes + ' duplicate rows ignored)' : '') + '\n' +
    'Items with no estimate: ' + res.missingEst + '\n' +
    'Tutors needing a name match: ' + res.needsMatch + (res.needsMatch ? ' — see "' + RTI_KN.REVIEW_TAB + '", then add them to "' + RTI_KN.MAP_TAB + '"' : '') + '\n\n' +
    'The official RTI total on the Master Roster was NOT changed.');
}

function viewKnowtionRTI() {
  var ss = _getSpreadsheet();
  var sh = ss.getSheetByName(RTI_KN.OUT_TAB);
  if (!sh) { _safeAlert('Run "RTI: Sync Knowtion Hours Now" first.'); return; }
  ss.setActiveSheet(sh);
}


// ══════════════════════════════════════════════════════════════════════════════
// ██  BUILD
// ══════════════════════════════════════════════════════════════════════════════

function _rtiKnowtionBuild() {
  var src = SpreadsheetApp.openById(RTI_KN.SHEET_ID);
  var ss  = _getSpreadsheet();
  var tz  = Session.getScriptTimeZone();

  // ── 1. Read every source tab (header-driven) ────────────────────────────
  var rowsByKey = {}, dupes = 0, sourcesRead = [];
  RTI_KN.SOURCES.forEach(function(s) {
    var sheet = _getSheetByGID(src, s.gid);
    if (!sheet) {
      sheet = src.getSheets().filter(function(sh) { return sh.getName().indexOf(s.namePrefix) === 0; })[0] || null;
    }
    if (!sheet) { Logger.log('RTI: source tab not found (gid ' + s.gid + ')'); return; }
    sourcesRead.push(sheet.getName());
    var data = sheet.getDataRange().getValues();
    var hdr = -1;
    for (var h = 0; h < Math.min(5, data.length); h++) {
      var l = data[h].map(function(c) { return String(c || '').trim().toLowerCase(); });
      if (l.indexOf('learner') >= 0 && l.indexOf('estimated') >= 0) { hdr = h; break; }
    }
    if (hdr < 0) { Logger.log('RTI: no Learner/Estimated header on "' + sheet.getName() + '"'); return; }
    var H = data[hdr].map(function(c) { return String(c || '').trim().toLowerCase(); });
    var c = {
      at: H.indexOf('completed at'), learner: H.indexOf('learner'), program: H.indexOf('program'),
      assignment: H.indexOf('assignment'), completed: H.indexOf('completed'),
      est: H.indexOf('estimated'), spent: H.indexOf('time spent'), status: H.indexOf('status'),
    };
    for (var i = hdr + 1; i < data.length; i++) {
      var r = data[i];
      var learner = String(r[c.learner] || '').replace(/\s+/g, ' ').trim();
      if (!learner) continue;
      var program = String(r[c.program] || '').replace(/\s+/g, ' ').trim();
      var assignment = String(r[c.assignment] || '').replace(/\s+/g, ' ').trim();
      var when = _rtiDate(c.at >= 0 ? r[c.at] : null) || _rtiDate(c.completed >= 0 ? r[c.completed] : null);
      var estRaw = c.est >= 0 ? r[c.est] : '', spentRaw = c.spent >= 0 ? r[c.spent] : '';
      var item = {
        learner: learner, audience: s.audience, program: program, assignment: assignment, when: when,
        est: _rtiMinutes(estRaw), spent: _rtiMinutes(spentRaw),
      };
      var key = _rtiKey(learner) + '|' + program.toLowerCase() + '|' + assignment.toLowerCase();
      var prev = rowsByKey[key];
      if (prev) {
        dupes++;
        if ((item.when ? item.when.getTime() : 0) < (prev.when ? prev.when.getTime() : 0)) continue;
      }
      rowsByKey[key] = item;
    }
  });
  if (!sourcesRead.length) throw new Error('No Knowtion source tabs could be read from ' + RTI_KN.SHEET_ID);

  // ── 2. Roster + name map ────────────────────────────────────────────────
  var mapTab = _rtiEnsureMapTab(ss);
  var nameMap = {};
  mapTab.getDataRange().getValues().slice(1).forEach(function(r) {
    var k = String(r[0] || '').trim(), v = String(r[1] || '').trim();
    if (k && v) nameMap[_rtiKey(k)] = v;
  });
  var rSheet = _getSheetByGID(ss, GID_MASTER_ROSTER);
  var rData  = rSheet.getDataRange().getValues();
  var roster = [], rosterByName = {};
  for (var ri = 4; ri < rData.length; ri++) {
    var full = String(rData[ri][MR_FULL_NAME] || '').trim();
    if (!full) continue;
    var entry = { n: _sy2627StripAccents(full), name: full, track: String(rData[ri][MR_PROGRAM_TRACK] || '').trim(), status: String(rData[ri][MR_STATUS] || '').trim() };
    roster.push(entry);
    rosterByName[_normName(full)] = entry;
  }

  // ── 3. Aggregate per learner ────────────────────────────────────────────
  var sySeen = {};
  var syMonths = MONTH_LABELS.slice(MONTH_LABELS.indexOf('Sep-26') >= 0 ? MONTH_LABELS.indexOf('Sep-26') : 0);
  syMonths.forEach(function(m) { sySeen[m] = true; });
  var people = {}, programs = {};
  Object.keys(rowsByKey).forEach(function(k) {
    var it = rowsByKey[k];
    var pk = _rtiKey(it.learner);
    var p = people[pk];
    if (!p) {
      p = people[pk] = { learner: it.learner, isSL: false, isTutorTab: false, items: 0, est: 0, spent: 0,
        c3est: 0, c3spent: 0, missingEst: 0, last: null, byProg: {}, byMonth: {}, outside: { est: 0, spent: 0 } };
    }
    if (it.audience === 'Site Leader') p.isSL = true; else p.isTutorTab = true;
    p.items++;
    var e = it.est == null ? 0 : it.est, s = it.spent == null ? 0 : it.spent;
    if (it.est == null) p.missingEst++;
    p.est += e; p.spent += s;
    if (RTI_KN.COURSE3_RE.test(it.program) && !RTI_KN.MASTER_RE.test(it.program)) { p.c3est += e; p.c3spent += s; }
    programs[it.program] = true;
    if (!p.byProg[it.program]) p.byProg[it.program] = { est: 0, spent: 0 };
    p.byProg[it.program].est += e; p.byProg[it.program].spent += s;
    var mLabel = it.when ? Utilities.formatDate(it.when, tz, 'MMM-yy') : '';
    if (mLabel && sySeen[mLabel]) {
      if (!p.byMonth[mLabel]) p.byMonth[mLabel] = { est: 0, spent: 0 };
      p.byMonth[mLabel].est += e; p.byMonth[mLabel].spent += s;
    } else { p.outside.est += e; p.outside.spent += s; }
    if (it.when && (!p.last || it.when > p.last)) p.last = it.when;
  });

  // ── 4. Link to the roster (never guessed) ───────────────────────────────
  var review = [], linked = 0, siteLeaders = 0, missingEstTotal = 0;
  Object.keys(people).forEach(function(pk) {
    var p = people[pk];
    missingEstTotal += p.missingEst;
    if (p.isSL) siteLeaders++;
    var match = null, how = '';
    var mapped = nameMap[pk];
    if (mapped) {
      match = rosterByName[_normName(mapped)] || null;
      how = match ? 'Name Map' : 'Name Map (roster name not found: "' + mapped + '")';
    }
    if (!match && !mapped) {
      match = rosterByName[_normName(p.learner)] || null;
      if (match) how = 'Exact';
    }
    if (!match && !mapped) {
      // strict: drop middle initials / periods, then first+last (prefix) must agree and be unique
      var cleaned = _rtiStripMiddle(_sy2627StripAccents(p.learner));
      match = _demoFuzzyMatch(cleaned, roster);
      if (match) how = 'First + last name';
    }
    p.rosterName = match ? match.name : '';
    p.track = match ? match.track : '';
    p.matchHow = how;
    if (match) linked++;
    else if (!p.isSL) {
      var hint = _rtiSuggest(p.learner, roster);
      review.push([p.learner, 'Tutor', hint, how || 'No confident roster match',
        'If this is a TAP tutor, type the learner name and their exact Master Roster name on "' + RTI_KN.MAP_TAB + '". If not on TAP, leave it — their hours still show in the portal by Knowtion name.']);
    }
  });

  // ── 5. Write the RTI — Knowtion tab ─────────────────────────────────────
  var progList = Object.keys(programs).sort(function(a, b) {
    var ac = RTI_KN.COURSE3_RE.test(a) ? 0 : 1, bc = RTI_KN.COURSE3_RE.test(b) ? 0 : 1;
    return ac - bc || a.localeCompare(b);
  });
  var headers = ['Learner (Knowtion)', 'Roster Name', 'Match', 'Role', 'Program Track',
    'Items Completed', 'Estimated Hours', 'Time Spent Hours', 'Time Spent % of Estimated',
    'Course 3 (RTI) Estimated Hours', 'Course 3 (RTI) Time Spent Hours',
    'Items Missing Estimate', 'Last Completed', 'Match Key'];
  progList.forEach(function(pg) { headers.push(pg + ' — Est Hrs', pg + ' — Spent Hrs'); });
  syMonths.forEach(function(m) { headers.push(m + ' Est Hrs', m + ' Spent Hrs'); });
  headers.push('Outside SY Months — Est Hrs', 'Outside SY Months — Spent Hrs', 'Last Synced');

  var now = new Date();
  var out = Object.keys(people).sort(function(a, b) {
    var pa = people[a], pb = people[b];
    return (pa.isSL === pb.isSL ? 0 : pa.isSL ? 1 : -1) || pa.learner.localeCompare(pb.learner);
  }).map(function(pk) {
    var p = people[pk];
    var row = [p.learner, p.rosterName, p.matchHow, p.isSL ? (p.isTutorTab ? 'Site Leader (also takes tutor courses)' : 'Site Leader') : 'Tutor',
      p.track, p.items, _rtiH(p.est), _rtiH(p.spent), p.est > 0 ? p.spent / p.est : '',
      _rtiH(p.c3est), _rtiH(p.c3spent), p.missingEst, p.last || '', _rtiKey(p.rosterName || p.learner)];
    progList.forEach(function(pg) { var v = p.byProg[pg] || { est: 0, spent: 0 }; row.push(_rtiH(v.est), _rtiH(v.spent)); });
    syMonths.forEach(function(m) { var v = p.byMonth[m] || { est: 0, spent: 0 }; row.push(_rtiH(v.est), _rtiH(v.spent)); });
    row.push(_rtiH(p.outside.est), _rtiH(p.outside.spent), now);
    return row;
  });

  var outTab = ss.getSheetByName(RTI_KN.OUT_TAB) || ss.insertSheet(RTI_KN.OUT_TAB);
  outTab.clear();
  _ensureColumnCount(outTab, headers.length);
  if (outTab.getMaxRows() < out.length + 2) outTab.insertRowsAfter(outTab.getMaxRows(), out.length + 2 - outTab.getMaxRows());
  outTab.getRange(1, 1, 1, headers.length).setValues([headers])
    .setFontWeight('bold').setBackground('#1B2A4A').setFontColor('#FFFFFF').setWrap(true);
  if (out.length) {
    outTab.getRange(2, 1, out.length, headers.length).setValues(out);
    outTab.getRange(2, 9, out.length, 1).setNumberFormat('0%');
    outTab.getRange(2, 13, out.length, 1).setNumberFormat('M/d/yyyy');
    outTab.getRange(2, headers.length, out.length, 1).setNumberFormat('M/d/yyyy h:mm');
  }
  outTab.setFrozenRows(1); outTab.setFrozenColumns(2);

  // ── 6. Needs-match tab (rewritten each run) ─────────────────────────────
  var rv = ss.getSheetByName(RTI_KN.REVIEW_TAB) || ss.insertSheet(RTI_KN.REVIEW_TAB);
  rv.clear();
  var rvHdr = ['Knowtion Learner', 'Role', 'Possible Roster Name (check — not applied)', 'Why', 'What to do'];
  _ensureColumnCount(rv, rvHdr.length);
  rv.getRange(1, 1, 1, rvHdr.length).setValues([rvHdr]).setFontWeight('bold').setBackground('#1B2A4A').setFontColor('#FFFFFF');
  if (review.length) rv.getRange(2, 1, review.length, rvHdr.length).setValues(review);
  rv.setFrozenRows(1);

  SpreadsheetApp.flush();
  return { learners: out.length, linked: linked, siteLeaders: siteLeaders, items: Object.keys(rowsByKey).length,
           dupes: dupes, missingEst: missingEstTotal, needsMatch: review.length, sources: sourcesRead };
}


// ══════════════════════════════════════════════════════════════════════════════
// ██  HELPERS
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Minutes from Knowtion time text: "20 min", "<1 min" (=0), "1 hr 5 min",
 * "2m 26s", "1h", "45s". A plain number is read as minutes. Returns null
 * for blank/unreadable (counted as 0 and reported as a missing estimate).
 */
function _rtiMinutes(v) {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'number') return v;
  var s = String(v).trim().toLowerCase();
  if (!s) return null;
  if (s.charAt(0) === '<') return 0;
  var total = 0, found = false, m;
  if ((m = s.match(/(\d+(?:\.\d+)?)\s*(?:hours?|hrs?|h)\b/)))      { total += parseFloat(m[1]) * 60; found = true; }
  if ((m = s.match(/(\d+(?:\.\d+)?)\s*(?:minutes?|mins?|m)\b/)))   { total += parseFloat(m[1]);      found = true; }
  if ((m = s.match(/(\d+(?:\.\d+)?)\s*(?:seconds?|secs?|s)\b/)))   { total += parseFloat(m[1]) / 60; found = true; }
  if (found) return total;
  if (/^\d+(\.\d+)?$/.test(s)) return parseFloat(s);
  return null;
}

/** Hours, rounded to 2 decimals (sums are done in minutes first, so no drift). */
function _rtiH(minutes) { return Math.round((minutes || 0) / 60 * 100) / 100; }

function _rtiDate(v) {
  if (v instanceof Date && !isNaN(v.getTime())) return v;
  var s = String(v || '').replace(/^completed late\s*-\s*/i, '').replace(/\s+at\s+/i, ' ').trim();
  if (!s) return null;
  var d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

/** Comparison key: accents/punctuation/extra spaces removed, lower case. */
function _rtiKey(name) {
  return _normNameFuzzy(_sy2627StripAccents(String(name || '')));
}

/** "KIMBERLY I WHITE" → "KIMBERLY WHITE", "Shirley F. McDougald" → "Shirley McDougald". */
function _rtiStripMiddle(name) {
  var parts = String(name || '').replace(/\./g, ' ').trim().split(/\s+/);
  return parts.filter(function(p, i) { return i === 0 || i === parts.length - 1 || p.length > 1; }).join(' ');
}

/** A hint only (shown on the review tab, never applied): roster names sharing the last name. */
function _rtiSuggest(learner, roster) {
  var parts = _rtiKey(learner).split(' ').filter(Boolean);
  if (!parts.length) return '';
  var last = parts[parts.length - 1];
  var hits = roster.filter(function(r) { var p = _rtiKey(r.name).split(' '); return p[p.length - 1] === last || _rtiKey(r.name).indexOf(parts[0]) === 0; })
    .map(function(r) { return r.name; });
  return hits.slice(0, 3).join(' / ');
}

function _rtiEnsureMapTab(ss) {
  var t = ss.getSheetByName(RTI_KN.MAP_TAB);
  if (t) return t;
  t = ss.insertSheet(RTI_KN.MAP_TAB);
  var hdr = ['Knowtion Learner Name (exactly as in Knowtion)', 'Master Roster Full Name (exactly)', 'Notes'];
  t.getRange(1, 1, 1, 3).setValues([hdr]).setFontWeight('bold').setBackground('#1B2A4A').setFontColor('#FFFFFF');
  t.setFrozenRows(1);
  t.setColumnWidth(1, 300); t.setColumnWidth(2, 300); t.setColumnWidth(3, 300);
  return t;
}

/** CSV of the RTI — Knowtion tab for the portal (doGet?tab=rti_knowtion). */
function _rtiKnowtionCSV() {
  var sh = _getSpreadsheet().getSheetByName(RTI_KN.OUT_TAB);
  if (!sh) return '';
  return _sheetToCSV(sh);
}
