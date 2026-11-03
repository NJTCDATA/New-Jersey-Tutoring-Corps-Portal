/**
 * ╔══════════════════════════════════════════════════════════════════════════════╗
 * ║  NJTC TAP — SY 26-27 OJT WORKBOOK SYNC                                      ║
 * ║  Add-on file for the TAP Tracker 26-27 Apps Script project.                ║
 * ╠══════════════════════════════════════════════════════════════════════════════╣
 * ║  WHAT IT DOES (the school-year version of the Summer Import):              ║
 * ║   1. Reads the "SY 26-27 OJT" directory tab in the Onsite Database        ║
 * ║      (Name / Role / OJT Link / Site Leader / Supervisor / Notes).          ║
 * ║   2. Matches each person to the "Onsite Tracker" tab (SY 26-27 staff,     ║
 * ║      IMPORTRANGE'd from Staffing SY 2026-2027) for email/phone/site.      ║
 * ║   3. Finds or creates their Master Roster row. Existing rows are found    ║
 * ║      by email first, then by a strict name match, so summer people are    ║
 * ║      NOT duplicated and their existing name is kept (renaming would       ║
 * ║      detach their summer OTJ rows).                                        ║
 * ║   4. Opens each person's own OJT workbook, reads the checklist tab,       ║
 * ║      matches every "Y" activity to the canonical 80-activity schema by    ║
 * ║      activity TEXT (same matcher the summer import used), and appends     ║
 * ║      ONLY activities not already in the OTJ log for that person.           ║
 * ║   5. Runs recalculateTotals() → Master Roster OJT hours / % / Beg-Mid-End ║
 * ║      % / wage tier / Completion Summary all update as before.             ║
 * ║   6. Writes a per-person snapshot to "SY 26-27 Workbook Progress":         ║
 * ║      the % straight from each workbook + the Master Roster totals.        ║
 * ║                                                                            ║
 * ║  v11 (11/2026): Sheets-API link reading (file chips), 80/80 matcher,      ║
 * ║  date validation. Milestone emails: automatic, once each (main ledger).   ║
 * ║  SAFE TO RE-RUN DAILY — idempotent (never writes the same activity twice) ║
 * ║  and self-continuing (if it nears Apps Script's 6-minute limit it saves   ║
 * ║  its place and resumes 1 minute later).                                   ║
 * ║                                                                            ║
 * ║  DEPENDS ON (already in the main TAP script, same project):               ║
 * ║   ONSITE_DB_SHEET_ID, _getSpreadsheet, _getSheetByGID, _ensureColumnCount, ║
 * ║   _appendBlankRosterRow, _extractSpreadsheetIdFromCell, _normNameFuzzy,   ║
 * ║   _fuzzyFindOnboardingRow, _demoFuzzyMatch, _roleToProgramTrack,          ║
 * ║   _buildSchemaTextIndex, _matchActivityByText, _parseSummerMonthYear,     ║
 * ║   _lookupPriorYearUSDOLId, recalculateTotals, _normName, _formatMonYY,     ║
 * ║   _logNotification, _safeAlert, _handleError, all MR_* / OJT_* indices.   ║
 * ║                                                                            ║
 * ║  MENU — add these lines inside onOpen() in the main script:               ║
 * ║    .addSeparator()                                                         ║
 * ║    .addItem('SY 26-27: Sync OJT Workbooks Now',   'menuSyncSY2627OJT')     ║
 * ║    .addItem('SY 26-27: Sync ONE Person',          'debugSY2627OnePerson')  ║
 * ║    .addItem('SY 26-27: View Workbook Progress',   'viewSY2627Progress')    ║
 * ║    .addItem('SY 26-27: Install Daily Auto-Sync',  'installSY2627DailySync')║
 * ║                                                                            ║
 * ║  NOTE: installTriggers() in the main script deletes EVERY project trigger.║
 * ║  If you ever re-run it, re-run "SY 26-27: Install Daily Auto-Sync" after. ║
 * ╚══════════════════════════════════════════════════════════════════════════════╝
 */

var SY2627 = {
  DIRECTORY_TAB:    'SY 26-27 OJT',
  // Source workbook = "Automated: Onsite 26-27 Tracker" (ONSITE_DB_SHEET_ID,
  // 1x3dWZQhx9XWqB8YASInOMTr0JDjSRMqv3w7PmcruuMU). Its "Onsite Tracker" tab
  // IMPORTRANGEs "Staffing SY 2026-2027" from the HR staffing workbook, so it
  // holds the SY 26-27 staff list. The other two names are fallbacks only —
  // any tab that doesn't exist is skipped. First tab wins on duplicates.
  STAFFING_TABS:    ['Onsite Tracker', 'Staffing SY 2026-2027', 'Summer 2026'],
  LOG_TYPE:         'OJT Activity completion (SY 26-27 Import)',
  STATUS_TEXT:      'Y — Observed and completed (SY 26-27 Import)',
  PROGRESS_SHEET:   'SY 26-27 Workbook Progress',
  REVIEW_SHEET:     'SY 26-27 Import — Needs Review',
  SY_VALUE:         '2026-2027',
  TRACK_TAG:        'SY 26-27',
  TIME_BUDGET_MS:   240000,               // stop at ~4 min (leaves room for one more person + summary), resume via trigger
  CURSOR_PROP:      'SY2627_SYNC_CURSOR',
  STATS_PROP:       'SY2627_SYNC_STATS',
  CONTINUE_HANDLER: 'continueSY2627Sync',
  DAILY_HANDLER:    'syncSY2627OJT',
  DAILY_HOUR:       3,                    // after the 2am checklist rebuild
};

var SY2627_PROGRESS_HEADERS = [
  'Directory Name', 'Master Roster Name', 'Role (directory)', 'Program Track',
  'Site Leader', 'Supervisor of SL', 'OJT Workbook', 'Checklist Tab Read',
  'Beg Y (of 33)', 'Mid Y (of 38)', 'End Y (of 9)', 'Total Y in Workbook',
  'N/A in Workbook', 'Possible', 'Workbook %', 'Latest Observation',
  'New Activities Imported (this run)', 'Master Roster OJT Hours', 'Master Roster OJT %',
  'Issues', 'Last Synced', 'Y With No Date (counted, no month)', 'Y With Invalid Date (counted, no month)'
];
var SY2627_REVIEW_HEADERS = ['Directory Name', 'Role', 'Issue', 'Action Needed', 'Logged'];


// ══════════════════════════════════════════════════════════════════════════════
// ██  ENTRY POINTS
// ══════════════════════════════════════════════════════════════════════════════

/** Daily trigger target. Always starts a fresh pass from person #1. */
function syncSY2627OJT() {
  _sy2627DeleteTriggers(SY2627.CONTINUE_HANDLER);
  PropertiesService.getScriptProperties().deleteProperty(SY2627.CURSOR_PROP);
  PropertiesService.getScriptProperties().deleteProperty(SY2627.STATS_PROP);
  return _sy2627Run(0);
}

/** Menu: run now and show a summary. */
function menuSyncSY2627OJT() {
  var res = syncSY2627OJT();
  if (!res) return;
  if (!res.done) {
    _safeAlert('SY 26-27 sync is large, so it saved its place after ' + res.stats.processed +
      ' people and will keep going automatically in the background (about 1 minute between batches).\n\n' +
      'Check "' + SY2627.PROGRESS_SHEET + '" as it fills in.');
    return;
  }
  _safeAlert(_sy2627SummaryText(res.stats));
}

/** Time-trigger target used to resume a run that hit the time budget. */
function continueSY2627Sync() {
  _sy2627DeleteTriggers(SY2627.CONTINUE_HANDLER);
  var cursor = parseInt(PropertiesService.getScriptProperties().getProperty(SY2627.CURSOR_PROP) || '0', 10) || 0;
  _sy2627Run(cursor);
}

/** Installs (or re-installs) the nightly auto-sync. Leaves every other trigger alone. */
function installSY2627DailySync() {
  _sy2627DeleteTriggers(SY2627.DAILY_HANDLER);
  ScriptApp.newTrigger(SY2627.DAILY_HANDLER).timeBased().everyDays(1).atHour(SY2627.DAILY_HOUR).create();
  _safeAlert('Daily SY 26-27 OJT sync installed — runs every night around ' + SY2627.DAILY_HOUR + 'am.\n\n' +
    'Each run reads every apprentice workbook listed on "' + SY2627.DIRECTORY_TAB + '", imports any new "Y" activities, ' +
    'recalculates Master Roster totals, and refreshes "' + SY2627.PROGRESS_SHEET + '".\n\n' +
    'Reminder: if you ever run "Install Triggers" from the menu, run this again afterward (that one removes all triggers).');
}

function viewSY2627Progress() {
  var ss = _getSpreadsheet();
  var sh = ss.getSheetByName(SY2627.PROGRESS_SHEET);
  if (!sh) { _safeAlert('No progress sheet yet — run "SY 26-27: Sync OJT Workbooks Now" first.'); return; }
  ss.setActiveSheet(sh);
}

/** Runs the full pipeline for ONE directory person and reports what happened. */
function debugSY2627OnePerson() {
  var ui = SpreadsheetApp.getUi();
  var resp = ui.prompt('SY 26-27 — Sync ONE Person',
    'Enter the name as it appears on the "' + SY2627.DIRECTORY_TAB + '" tab:', ui.ButtonSet.OK_CANCEL);
  if (resp.getSelectedButton() !== ui.Button.OK) return;
  var search = _sy2627Norm(resp.getResponseText());
  if (!search) return;

  var ctx = _sy2627BuildContext(false);
  var person = ctx.directory.filter(function(p) { return _sy2627Norm(p.name) === search; })[0] ||
               ctx.directory.filter(function(p) { var n = _sy2627Norm(p.name); return n.indexOf(search) >= 0 || search.indexOf(n) >= 0; })[0];
  if (!person) { _safeAlert('"' + resp.getResponseText() + '" not found on "' + SY2627.DIRECTORY_TAB + '".'); return; }

  var out = _sy2627ProcessPerson(ctx, person);
  _sy2627WriteProgressRow(ctx, out);
  _sy2627FlushReview(ctx);
  _safeAlert([
    'Directory: ' + person.name + ' (' + person.role + ')',
    'Master Roster: ' + (out.rosterName || '— not linked') + (out.created ? '  [NEW ROW CREATED]' : ''),
    'Program Track: ' + (out.track || ''),
    'Checklist tab: ' + (out.tabName || '—'),
    'Workbook: Beg ' + out.begY + ' · Mid ' + out.midY + ' · End ' + out.endY + ' · Total Y ' + out.totalY +
      ' · N/A ' + out.na + ' → ' + Math.round(out.pct * 100) + '%',
    'New activities imported: ' + out.newRows + (out.unmatched ? ' (' + out.unmatched + ' could not be matched — see review sheet)' : ''),
    'Master Roster now: ' + out.mrHours + ' OJT hrs · ' + Math.round((out.mrPct || 0) * 100) + '%',
    out.issues.length ? '\nIssues:\n  ' + out.issues.join('\n  ') : ''
  ].join('\n'));
}


// ══════════════════════════════════════════════════════════════════════════════
// ██  CORE RUN (chunked)
// ══════════════════════════════════════════════════════════════════════════════

function _sy2627Run(cursor) {
  var t0 = Date.now();
  var props = PropertiesService.getScriptProperties();
  _DEFER_COMPLETION_SUMMARY = true; // rebuilt once below, not per person
  try {
    if (!ONSITE_DB_SHEET_ID) throw new Error('ONSITE_DB_SHEET_ID is not set in the main script.');
    var fresh = cursor === 0;
    var ctx = _sy2627BuildContext(fresh);
    var stats = fresh ? null : JSON.parse(props.getProperty(SY2627.STATS_PROP) || 'null');
    stats = stats || { total: ctx.directory.length, processed: 0, created: 0, linked: 0,
                       newRows: 0, noLink: 0, noRoster: 0, unmatched: 0, startedAt: new Date().toISOString() };

    for (var i = cursor; i < ctx.directory.length; i++) {
      if (Date.now() - t0 > SY2627.TIME_BUDGET_MS) {
        _sy2627FlushReview(ctx);
        _DEFER_COMPLETION_SUMMARY = false;
        try { rebuildCompletionSummary(); } catch (e) {}
        props.setProperty(SY2627.CURSOR_PROP, String(i));
        props.setProperty(SY2627.STATS_PROP, JSON.stringify(stats));
        ScriptApp.newTrigger(SY2627.CONTINUE_HANDLER).timeBased().after(60 * 1000).create();
        Logger.log('SY2627 sync: paused at ' + i + '/' + ctx.directory.length + ' — continuation scheduled');
        return { done: false, stats: stats };
      }
      var out = _sy2627ProcessPerson(ctx, ctx.directory[i]);
      _sy2627WriteProgressRow(ctx, out);
      stats.processed++;
      if (out.created) stats.created++;
      if (out.rosterName) stats.linked++; else stats.noRoster++;
      if (!out.workbookId) stats.noLink++;
      stats.newRows += out.newRows;
      stats.unmatched += out.unmatched;
    }

    _sy2627FlushReview(ctx);
    _DEFER_COMPLETION_SUMMARY = false;
    try { rebuildCompletionSummary(); } catch (e) {}
    props.deleteProperty(SY2627.CURSOR_PROP);
    props.deleteProperty(SY2627.STATS_PROP);
    SpreadsheetApp.flush();
    _logNotification('SY2627_OJT_SYNC', '', _sy2627SummaryText(stats).replace(/\n+/g, ' | '), '', 'syncSY2627OJT');
    PropertiesService.getScriptProperties().setProperty('AUTO_LAST_RUN_syncSY2627', new Date().toISOString());
    return { done: true, stats: stats };
  } catch (err) {
    _DEFER_COMPLETION_SUMMARY = false;
    _handleError('_sy2627Run', err);
    return null;
  }
}

function _sy2627SummaryText(s) {
  return 'SY 26-27 OJT workbook sync complete.\n\n' +
    'People on "' + SY2627.DIRECTORY_TAB + '": ' + s.total + '\n' +
    'Linked to a Master Roster row: ' + s.linked + ' (new rows created: ' + s.created + ')\n' +
    'Not linked (see review sheet): ' + s.noRoster + '\n' +
    'No OJT workbook link: ' + s.noLink + '\n' +
    'New "Y" activities imported: ' + s.newRows + '\n' +
    'Activities that could not be matched (not guessed): ' + s.unmatched + '\n\n' +
    'Per-person workbook % → "' + SY2627.PROGRESS_SHEET + '"\n' +
    'Anything needing a human → "' + SY2627.REVIEW_SHEET + '"';
}

function _sy2627BuildContext(resetSheets) {
  var onsiteDb = SpreadsheetApp.openById(ONSITE_DB_SHEET_ID);
  var ss       = _getSpreadsheet();
  var rSheet   = _getSheetByGID(ss, GID_MASTER_ROSTER);
  var ojtSheet = _getSheetByGID(ss, GID_OJT_LOG);
  if (!rSheet || !ojtSheet) throw new Error('Master Roster or OTJ tab not found');
  _ensureColumnCount(rSheet, 100); // Program Track lives in column 100

  var progress = _sy2627EnsureSheet(ss, SY2627.PROGRESS_SHEET, SY2627_PROGRESS_HEADERS, resetSheets);
  if (resetSheets) progress.getRange(2, 15, Math.max(progress.getMaxRows() - 1, 1), 1).setNumberFormat('0%');
  if (resetSheets) progress.getRange(2, 19, Math.max(progress.getMaxRows() - 1, 1), 1).setNumberFormat('0%');
  var review = _sy2627EnsureSheet(ss, SY2627.REVIEW_SHEET, SY2627_REVIEW_HEADERS, resetSheets);

  return {
    ss: ss, rSheet: rSheet, ojtSheet: ojtSheet, progress: progress, review: review,
    directory: _sy2627ReadDirectory(onsiteDb),
    staffing: _sy2627ReadStaffingRows(onsiteDb),
    roster: _sy2627ReadRosterIndex(rSheet),
    existingKeys: _sy2627ExistingOJTKeys(ojtSheet),
    schemaIndex: _buildSchemaTextIndex(),
    seenRosterRows: {},
    reviewRows: [],
  };
}


// ══════════════════════════════════════════════════════════════════════════════
// ██  ONE PERSON
// ══════════════════════════════════════════════════════════════════════════════

function _sy2627ProcessPerson(ctx, person) {
  var out = {
    person: person, rosterName: '', rowIndex: 0, created: false, track: '',
    workbookId: person.ojtSpreadsheetId, tabName: '',
    begY: 0, midY: 0, endY: 0, totalY: 0, na: 0, possible: MAX_ACTIVITIES, pct: 0,
    lastObs: null, newRows: 0, unmatched: 0, mrHours: '', mrPct: '', issues: [],
    undated: 0, badDates: []
  };
  function flag(issue, action) {
    out.issues.push(issue);
    ctx.reviewRows.push([person.name, person.role, issue, action, new Date()]);
  }

  try {
    out.track = _sy2627RoleToTrack(person.role);
    var match = _fuzzyFindOnboardingRow(_sy2627StripAccents(person.name), ctx.staffing);

    // ── 1. Find (or create) the Master Roster row ─────────────────────────
    var rr = null;
    if (match && match.email) {
      var em = match.email.toLowerCase();
      rr = ctx.roster.filter(function(r) { return r.email && r.email === em; })[0] || null;
    }
    if (!rr) rr = _demoFuzzyMatch(_sy2627StripAccents(person.name), ctx.roster);
    if (!rr && match) rr = _demoFuzzyMatch(_sy2627StripAccents(match.firstName + ' ' + match.lastName), ctx.roster);

    if (!rr) {
      if (!match || !match.email) {
        flag('Not on the Master Roster and no confident match (with email) in ' + SY2627.STAFFING_TABS.join(' / '),
             'Fix the name/email on the staffing tab (or add them to the Master Roster by hand), then re-sync.');
        return out;
      }
      rr = _sy2627CreateRosterRow(ctx, match, out.track);
      out.created = true;
    }
    out.rowIndex = rr.rowIndex;
    out.rosterName = rr.name;

    if (ctx.seenRosterRows[rr.rowIndex]) {
      flag('Same Master Roster row as directory entry "' + ctx.seenRosterRows[rr.rowIndex] + '" — possible duplicate on "' + SY2627.DIRECTORY_TAB + '"',
           'Remove the duplicate line from the directory if it is the same person.');
    }
    ctx.seenRosterRows[rr.rowIndex] = person.name;

    if (!out.created) _sy2627UpdateRosterRow(ctx, rr, match, out.track, flag);

    // ── 2. Read the person's OJT workbook ─────────────────────────────────
    if (!person.ojtSpreadsheetId) {
      flag(person.ojtLinkAmbiguous
            ? 'OJT Link cell has no link and Drive search found ' + person.ojtLinkAmbiguousCount + ' possible files'
            : 'No OJT workbook link on "' + SY2627.DIRECTORY_TAB + '"',
           'Put a real hyperlink to their OJT workbook in the OJT Link cell, then re-sync.');
      _sy2627ReadRosterTotals(ctx, out);
      return out;
    }

    var wb;
    try { wb = SpreadsheetApp.openById(person.ojtSpreadsheetId); }
    catch (openErr) {
      flag('Could not open OJT workbook: ' + openErr, 'Share the workbook with the account that owns this script, then re-sync.');
      _sy2627ReadRosterTotals(ctx, out);
      return out;
    }
    var pick = _sy2627PickChecklistTab(wb, out.track);
    if (!pick.sheet) {
      flag('No OJT checklist tab found. Tabs: ' + pick.allNames.join(', '), 'Check the workbook — the checklist tab may have been renamed.');
      _sy2627ReadRosterTotals(ctx, out);
      return out;
    }
    out.tabName = pick.sheet.getName() + (pick.note ? ' (' + pick.note + ')' : '');
    if (pick.ambiguous) {
      flag('Several checklist tabs (' + pick.allNames.join(', ') + ') — read "' + pick.sheet.getName() + '"',
           'Confirm that is the SY 26-27 tab. Renaming it to include "26-27" makes the choice explicit.');
    }

    // ── 3. Parse Y / N/A marks and build new OTJ rows ─────────────────────
    var data = pick.sheet.getDataRange().getValues();
    var normRoster = _normName(rr.name);
    var currentDomain = '';
    var currentPhase = '';
    var rowsToWrite = [];
    var timestamp = new Date();
    var minDate = new Date(2025, 2, 1), maxDate = new Date(Date.now() + 31 * 86400000);

    for (var i = 0; i < data.length; i++) {
      var row = data[i];
      var domainCell = String(row[1] || '').trim();
      var activityCell = String(row[2] || '').trim();
      var markCell = String(row[4] || '').trim();
      if (/beginning of (the )?program/i.test(domainCell)) currentPhase = 'Beginning';
      else if (/middle of (the )?program/i.test(domainCell)) currentPhase = 'Middle';
      else if (/end of (the )?program/i.test(domainCell)) currentPhase = 'End';
      if (i < 10) continue; // title/directions block — activity rows start at row 11
      if (domainCell && !activityCell) { currentDomain = domainCell; continue; }
      if (!activityCell) continue;
      if (/^n\s*\/?\s*a$/i.test(markCell)) { out.na++; continue; }
      if (!/^y/i.test(markCell)) continue;

      out.totalY++;
      var m = _matchActivityByText(ctx.schemaIndex, currentPhase, currentDomain, activityCell);
      if (!m) {
        out.unmatched++;
        flag('Could not confidently match activity: "' + activityCell.substring(0, 80) + '"',
             'Log this activity for ' + rr.name + ' through the portal instead.');
        continue;
      }
      if (m.phase === 'Beginning') out.begY++; else if (m.phase === 'Middle') out.midY++; else if (m.phase === 'End') out.endY++;

      // v13.5: name the item the way the WORKBOOK shows it (its own letter and
      // wording, plus the cell text), not only the 80-activity schema code —
      // the SY 26-27 checklists use different letters (e.g. workbook "N. Attend
      // training sessions…" = schema Beginning/Professionalism/S).
      var wbItem = m.phase + ' ' + currentDomain + ' "' + activityCell.substring(0, 45) + (activityCell.length > 45 ? '…' : '') + '" (schema ' + m.code + ')';
      var obsDate = _sy2627ParseDate(row[5]);
      if (!obsDate) {
        if (String(row[5] || '').trim() && !/^n\/?a$/i.test(String(row[5]).trim())) out.badDates.push(wbItem + ': cell says "' + String(row[5]).trim() + '"');
        else out.undated++;
      } else if (obsDate < minDate || obsDate > maxDate) {
        out.badDates.push(wbItem + ': cell says "' + String(row[5] instanceof Date ? Utilities.formatDate(row[5], Session.getScriptTimeZone(), 'M/d/yyyy') : row[5]).trim() + '" (read as ' + Utilities.formatDate(obsDate, Session.getScriptTimeZone(), 'M/d/yyyy') + ')');
        obsDate = null; // counted toward totals, but never placed in a month
      }
      if (obsDate && (!out.lastObs || obsDate > out.lastObs)) out.lastObs = obsDate;

      var key = normRoster + '|' + m.phase.toLowerCase() + '|' + m.domain.toLowerCase() + '|' + String(m.code).toUpperCase();
      if (ctx.existingKeys[key]) continue; // already in the OTJ log (summer import, portal, or an earlier sync)
      ctx.existingKeys[key] = true;

      var r = new Array(16).fill('');
      r[OJT_TIMESTAMP]  = timestamp;
      r[OJT_LOG_TYPE]   = SY2627.LOG_TYPE;
      r[OJT_OBS_DATE]   = obsDate || '';
      r[OJT_OBSERVER]   = person.siteLeader || '';
      r[OJT_OBS_ROLE]   = 'Site Leader';
      r[OJT_SITE]       = (match && match.site) || '';
      r[OJT_APPRENTICE] = rr.name;
      r[OJT_PHASE]      = m.phase;
      r[OJT_DOMAIN]     = m.domain;
      r[OJT_ACTIVITY]   = m.code;
      r[OJT_STATUS]     = SY2627.STATUS_TEXT;
      r[OJT_NOTES]      = 'Imported from SY 26-27 OJT workbook tab "' + pick.sheet.getName() + '"' +
                          (m.domain.toLowerCase() !== currentDomain.toLowerCase() ? ' (domain corrected from "' + currentDomain + '")' : '');
      rowsToWrite.push(r);
    }

    if (out.badDates.length) {
      flag(out.badDates.length + ' Y mark(s) with an impossible date: ' + out.badDates.slice(0, 6).join('; ') + (out.badDates.length > 6 ? '; …' : ''),
           'Fix the date in their workbook (counted toward totals now; month columns/wage report pick it up once fixed).');
    }
    out.possible = Math.max(MAX_ACTIVITIES - out.na, 0);
    out.pct = out.possible > 0 ? Math.min(out.totalY / out.possible, 1) : 0;

    if (rowsToWrite.length) {
      _sy2627AppendOJTRows(ctx.ojtSheet, rowsToWrite);
      out.newRows = rowsToWrite.length;
    }

    // ── 4. Recalculate Master Roster totals (only when something changed) ─
    var mrHoursNow = ctx.rSheet.getRange(rr.rowIndex, MR_OJT_HOURS_TOTAL + 1).getValue();
    var firstLoad = out.created || mrHoursNow === '' || mrHoursNow === null;
    if (out.newRows > 0 || firstLoad) {
      // Milestone emails go out automatically from recalculateTotals(); the
      // main script's milestone ledger guarantees each milestone is emailed once.
      recalculateTotals(rr.name);
    }
    _sy2627ReadRosterTotals(ctx, out);
    return out;

  } catch (err) {
    flag('Script error: ' + err, 'See Executions log.');
    Logger.log('_sy2627ProcessPerson(' + person.name + '): ' + err + '\n' + (err.stack || ''));
    return out;
  }
}

function _sy2627ReadRosterTotals(ctx, out) {
  if (!out.rowIndex) return;
  var v = ctx.rSheet.getRange(out.rowIndex, MR_OJT_HOURS_TOTAL + 1, 1, 3).getValues()[0]; // hours, RTI, pct
  out.mrHours = v[0];
  out.mrPct = v[2];
}

function _sy2627AppendOJTRows(ojtSheet, rows) {
  var lock = LockService.getScriptLock();
  var locked = false;
  try {
    locked = lock.tryLock(30000); // short hold — doPost uses the same lock
    SpreadsheetApp.flush();
    var start = ojtSheet.getLastRow() + 1;
    ojtSheet.getRange(start, 1, rows.length, 16).setValues(rows);
    SpreadsheetApp.flush();
  } finally {
    if (locked) lock.releaseLock();
  }
}


// ══════════════════════════════════════════════════════════════════════════════
// ██  MASTER ROSTER WRITES
// ══════════════════════════════════════════════════════════════════════════════

function _sy2627CreateRosterRow(ctx, match, track) {
  var rSheet = ctx.rSheet;
  var row = _appendBlankRosterRow(rSheet, 100);
  var fullName = (match.firstName + ' ' + match.lastName).trim();
  var vals = {};
  vals[MR_DATE_REGISTERED] = _formatMonYY(new Date());
  vals[MR_STATUS]          = 'Active';
  vals[MR_FIRST_NAME]      = match.firstName;
  vals[MR_LAST_NAME]       = match.lastName;
  vals[MR_FULL_NAME]       = fullName;
  vals[MR_SY]              = SY2627.SY_VALUE;
  vals[MR_SITE]            = match.site;
  vals[MR_EMAIL]           = match.email;
  vals[MR_PHONE]           = match.phone;
  vals[MR_COUNTY]          = match.county;
  vals[MR_PROGRAM_TRACK]   = track + ' — ' + SY2627.TRACK_TAG + ' Start';
  var priorId = _lookupPriorYearUSDOLId(fullName);
  if (priorId) vals[MR_DOL_ID] = priorId;
  Object.keys(vals).forEach(function(c) {
    if (vals[c] !== '' && vals[c] !== undefined && vals[c] !== null) rSheet.getRange(row, Number(c) + 1).setValue(vals[c]);
  });
  SpreadsheetApp.flush();
  var entry = { n: _sy2627StripAccents(fullName), name: fullName, rowIndex: row, email: String(match.email || '').toLowerCase() };
  ctx.roster.push(entry);
  _logNotification('SY2627_ROSTER_ADDED', fullName, 'New Master Roster row from "' + SY2627.DIRECTORY_TAB + '" (' + track + ')' +
    (priorId ? ' | USDOL carried forward: ' + priorId : ''), '', 'syncSY2627OJT');
  return entry;
}

function _sy2627UpdateRosterRow(ctx, rr, match, track, flag) {
  var rSheet = ctx.rSheet;
  var cur = rSheet.getRange(rr.rowIndex, 1, 1, 100).getValues()[0];
  function setIfBlank(col, val) { if (val && !String(cur[col] || '').trim()) rSheet.getRange(rr.rowIndex, col + 1).setValue(val); }

  if (String(cur[MR_SY] || '').trim() !== SY2627.SY_VALUE) rSheet.getRange(rr.rowIndex, MR_SY + 1).setValue(SY2627.SY_VALUE);
  if (match) {
    setIfBlank(MR_EMAIL, match.email);
    setIfBlank(MR_PHONE, match.phone);
    setIfBlank(MR_COUNTY, match.county);
    var site = String(match.site || '').trim();
    if (site && site !== String(cur[MR_SITE] || '').trim()) rSheet.getRange(rr.rowIndex, MR_SITE + 1).setValue(site); // SY placement wins over summer site
  }
  if (!String(cur[MR_DOL_ID] || '').trim()) {
    var priorId = _lookupPriorYearUSDOLId(rr.name);
    if (priorId) {
      rSheet.getRange(rr.rowIndex, MR_DOL_ID + 1).setValue(priorId);
      flag('USDOL ID carried forward from prior year: ' + priorId, 'Confirm — no action needed otherwise.');
    }
  }

  // Program Track: keep the "Summer 2026 Start" history, add the SY tag, update the class.
  var oldTrack = String(cur[MR_PROGRAM_TRACK] || '').trim();
  var oldClass = oldTrack.split('—')[0].trim();
  var newTrack = /summer 2026/i.test(oldTrack)
    ? track + ' — Summer 2026 Start, ' + SY2627.TRACK_TAG
    : track + ' — ' + SY2627.TRACK_TAG + ' Start';
  if (oldTrack !== newTrack) {
    rSheet.getRange(rr.rowIndex, MR_PROGRAM_TRACK + 1).setValue(newTrack);
    if (oldClass && oldClass.toLowerCase() !== track.toLowerCase()) {
      var hrs = parseFloat(cur[MR_OJT_HOURS_TOTAL]) || 0;
      flag('Program Track changed "' + oldClass + '" → "' + track + '"' +
           (/^apprentice/i.test(track) && hrs >= 1100 ? ' with ' + hrs + ' OJT hrs already logged' : ''),
           /^apprentice/i.test(track)
             ? 'Now eligible for wage-tier emails going forward. Tiers already passed do NOT re-trigger — verify Current Wage manually.'
             : 'No longer gets wage-tier emails. Confirm this is correct.');
    }
  }
}


// ══════════════════════════════════════════════════════════════════════════════
// ██  READERS
// ══════════════════════════════════════════════════════════════════════════════

/** Reads the "SY 26-27 OJT" directory. Header row is detected; stops at the Site Leaders section. */
function _sy2627ReadDirectory(onsiteDb) {
  var sheet = onsiteDb.getSheetByName(SY2627.DIRECTORY_TAB);
  if (!sheet) throw new Error('"' + SY2627.DIRECTORY_TAB + '" tab not found in Onsite Database');
  var lastRow = sheet.getLastRow(), lastCol = Math.max(sheet.getLastColumn(), 6);
  var top = sheet.getRange(1, 1, Math.min(10, lastRow), lastCol).getValues();
  var hdr = -1;
  for (var h = 0; h < top.length; h++) {
    var lower = top[h].map(function(c) { return String(c || '').trim().toLowerCase(); });
    if (lower[0] === 'name' && lower.some(function(c) { return c.indexOf('ojt link') >= 0; })) { hdr = h; break; }
  }
  if (hdr < 0) throw new Error('Could not find the Name / OJT Link header row on "' + SY2627.DIRECTORY_TAB + '"');
  var headers = top[hdr].map(function(c) { return String(c || '').trim().toLowerCase(); });
  var cRole = _sy2627Col(headers, ['role'], []);
  var cLink = _sy2627Col(headers, [], ['ojt link']);
  var cSL   = _sy2627Col(headers, ['site leader'], []);
  var cSup  = _sy2627Col(headers, [], ['supervisor']);
  var cNote = _sy2627Col(headers, ['notes'], ['note']);

  var firstData = hdr + 2; // 1-based
  if (lastRow < firstData) return [];
  var range = sheet.getRange(firstData, 1, lastRow - firstData + 1, lastCol);
  var values = range.getValues(), rich = range.getRichTextValues(), formulas = range.getFormulas();
  // v11: Apps Script's RichTextValue cannot see links stored as Google Drive
  // file chips, which is why 41 of 78 workbooks were read as "no link" on
  // 11/2/26. The Sheets API returns hyperlinks, link runs AND chip links.
  // v13.3: primary source = the workbook's own Excel export, which contains a
  // hyperlink for EVERY row (including Drive file chips). Sheets API is the
  // backup; the quick in-cell check is the last resort.
  var xlsxLinks = cLink >= 0 ? _sy2627ExportLinks(onsiteDb.getId(), sheet.getName(), cLink + 1, firstData, lastRow) : [];
  var apiLinks = [];
  if (cLink >= 0 && xlsxLinks.filter(Boolean).length === 0) apiLinks = _sy2627ApiLinks(onsiteDb.getId(), SY2627.DIRECTORY_TAB, cLink + 1, firstData, lastRow);
  var out = [];
  for (var i = 0; i < values.length; i++) {
    var name = String(values[i][0] || '').trim();
    var role = cRole >= 0 ? String(values[i][cRole] || '').trim() : '';
    if (/site leader/i.test(name) || /observation/i.test(role)) break; // Site Leader section starts here
    if (!name) continue;
    // v13.2: NO Google Drive title searches here — they ran before the time
    // check and could use up the whole 6-minute limit on their own. The
    // Sheets API covers chips/links; the quick in-cell checks cover the rest.
    var ex = { id: _sy2627IdFromUrl(xlsxLinks[i]) || _sy2627IdFromUrl(apiLinks[i]) };
    if (!ex.id && cLink >= 0) {
      ex = { id: _sy2627QuickCellLink(rich[i][cLink], values[i][cLink], formulas[i][cLink]) };
    }
    out.push({
      name: name, role: role,
      ojtLinkText: cLink >= 0 ? String(values[i][cLink] || '').trim() : '',
      ojtSpreadsheetId: ex.id || '',
      ojtLinkAmbiguous: !!ex.ambiguous, ojtLinkAmbiguousCount: ex.ambiguousCount || 0,
      siteLeader: cSL >= 0 ? String(values[i][cSL] || '').trim() : '',
      supervisorOfSL: cSup >= 0 ? String(values[i][cSup] || '').trim() : '',
      notes: cNote >= 0 ? String(values[i][cNote] || '').trim() : '',
    });
  }
  return out;
}

/** Header-driven reader for the staffing tabs; returns rows shaped like _readOnboardingRows(). */
function _sy2627ReadStaffingRows(onsiteDb) {
  var rows = [], seen = {};
  SY2627.STAFFING_TABS.forEach(function(tabName) {
    var sheet = onsiteDb.getSheetByName(tabName);
    if (!sheet) { Logger.log('SY2627: staffing tab "' + tabName + '" not found — skipped'); return; }
    var data = sheet.getDataRange().getValues();
    var hdr = -1;
    for (var h = 0; h < Math.min(6, data.length); h++) {
      var l = data[h].map(function(c) { return String(c || '').trim().toLowerCase(); });
      if (l.indexOf('first name') >= 0 && l.indexOf('last name') >= 0) { hdr = h; break; }
    }
    if (hdr < 0) { Logger.log('SY2627: no First/Last Name header on "' + tabName + '" — skipped'); return; }
    var H = data[hdr].map(function(c) { return String(c || '').trim().toLowerCase(); });
    var c = {
      cycle: _sy2627Col(H, ['cycle'], []),           role:  _sy2627Col(H, ['role'], []),
      county: _sy2627Col(H, ['county'], []),         district: _sy2627Col(H, ['district'], []),
      site: _sy2627Col(H, ['locations', 'location'], []), siteLeader: _sy2627Col(H, ['site leader'], []),
      first: _sy2627Col(H, ['first name'], []),      last: _sy2627Col(H, ['last name'], []),
      email: _sy2627Col(H, ['email address', 'email'], ['email address']),
      phone: _sy2627Col(H, ['phone', 'phone number'], []),
    };
    function v(row, idx) { return idx >= 0 ? String(row[idx] || '').trim() : ''; }
    for (var i = hdr + 1; i < data.length; i++) {
      var first = v(data[i], c.first), last = v(data[i], c.last);
      if (!first && !last) continue;
      var email = v(data[i], c.email);
      var dedupKey = email ? email.toLowerCase() : _sy2627Norm(first + ' ' + last);
      if (seen[dedupKey]) continue; // same person on both tabs — keep the SY staffing version
      seen[dedupKey] = true;
      var nf = _sy2627StripAccents(first), nl = _sy2627StripAccents(last);
      rows.push({
        source: tabName, cycle: v(data[i], c.cycle), role: v(data[i], c.role),
        county: v(data[i], c.county), district: v(data[i], c.district), site: v(data[i], c.site),
        siteLeader: v(data[i], c.siteLeader), firstName: first, lastName: last,
        email: email, phone: v(data[i], c.phone),
        _normFull: _normNameFuzzy(nf + ' ' + nl), _normFirst: _normNameFuzzy(nf), _normLast: _normNameFuzzy(nl),
      });
    }
  });
  return rows;
}

/** [{ n, rowIndex, email }] for every named Master Roster row. */
function _sy2627ReadRosterIndex(rSheet) {
  var data = rSheet.getDataRange().getValues();
  var out = [];
  for (var i = 4; i < data.length; i++) {
    var n = String(data[i][MR_FULL_NAME] || '').trim();
    if (!n) continue;
    out.push({ n: n, rowIndex: i + 1, email: String(data[i][MR_EMAIL] || '').trim().toLowerCase() });
  }
  // _demoFuzzyMatch normalizes r.n with _normNameFuzzy, which drops accented letters
  // ("María" → "mar a"), so n is an accent-stripped copy used ONLY for matching;
  // name is the real roster name used for every write and recalculateTotals().
  return out.map(function(r) {
    return { n: _sy2627StripAccents(r.n), name: r.n, rowIndex: r.rowIndex, email: r.email };
  });
}

/** Keys (normName|phase|domain|CODE) for every "Y" activity already in the OTJ log. */
function _sy2627ExistingOJTKeys(ojtSheet) {
  var data = ojtSheet.getDataRange().getValues();
  var keys = {};
  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    if (String(row[OJT_LOG_TYPE] || '').toLowerCase().indexOf('rti') >= 0) continue;
    if (!/^y/i.test(String(row[OJT_STATUS] || '').trim())) continue;
    var ph = String(row[OJT_PHASE] || '').toLowerCase();
    var phKey = ph.indexOf('begin') >= 0 ? 'beginning' : ph.indexOf('mid') >= 0 ? 'middle' : ph.indexOf('end') >= 0 ? 'end' : ph;
    var code = String(row[OJT_ACTIVITY] || '').split(/\s*[—\-]\s*/)[0].trim().toUpperCase();
    keys[_normName(row[OJT_APPRENTICE]) + '|' + phKey + '|' + String(row[OJT_DOMAIN] || '').trim().toLowerCase() + '|' + code] = true;
  }
  return keys;
}

/**
 * Picks the checklist tab. Completers get a DUPLICATED checklist tab for SY 26-27,
 * so when several exist: prefer a tab named with 26-27 / 2026-2027, then a copy
 * ("Copy of…", "(2)", trailing number), then the right-most one (duplicates land
 * to the right of the original).
 */
function _sy2627PickChecklistTab(wb, track) {
  var sheets = wb.getSheets();
  var all = sheets.map(function(s) { return s.getName(); });
  var cands = sheets.filter(function(s) {
    var n = s.getName().toLowerCase();
    return (n.indexOf('job training checklist') >= 0 || /\bojt\b/.test(n) || n.indexOf('checklist') >= 0) &&
           !/narrative|crosswalk|resource|career/.test(n);
  });
  if (!cands.length) return { sheet: null, allNames: all };
  if (cands.length === 1) return { sheet: cands[0], allNames: all };
  var names = cands.map(function(s) { return s.getName(); });
  var bySY = cands.filter(function(s) { return /26\s*[-\/]\s*27|2026\s*[-\/]\s*2027|\bsy\s*26/i.test(s.getName()); });
  if (bySY.length === 1) return { sheet: bySY[0], allNames: names, note: 'named for SY 26-27' };
  var copies = cands.filter(function(s) { return /copy of|\(\d+\)|\s\d+$/i.test(s.getName()); });
  var pick = copies.length ? copies[copies.length - 1] : cands[cands.length - 1];
  return { sheet: pick, allNames: names, ambiguous: true, note: copies.length ? 'duplicated tab' : 'right-most tab' };
}


// ══════════════════════════════════════════════════════════════════════════════
// ██  OUTPUT SHEETS
// ══════════════════════════════════════════════════════════════════════════════

function _sy2627EnsureSheet(ss, name, headers, reset) {
  var sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);
  if (reset || sh.getLastRow() === 0) {
    sh.clear();
    _ensureColumnCount(sh, headers.length);
    sh.getRange(1, 1, 1, headers.length).setValues([headers])
      .setFontWeight('bold').setBackground('#1B2A4A').setFontColor('#FFFFFF').setWrap(true);
    sh.setFrozenRows(1);
  }
  return sh;
}

function _sy2627WriteProgressRow(ctx, out) {
  var p = out.person;
  var link = p.ojtSpreadsheetId
    ? '=HYPERLINK("https://docs.google.com/spreadsheets/d/' + p.ojtSpreadsheetId + '/edit","Open workbook")'
    : '';
  var row = [
    p.name, out.rosterName, p.role, out.track, p.siteLeader, p.supervisorOfSL, link, out.tabName,
    out.begY, out.midY, out.endY, out.totalY, out.na, out.possible, out.pct,
    out.lastObs || '', out.newRows, out.mrHours, out.mrPct,
    out.issues.join(' | ') + (p.notes ? (out.issues.length ? ' | ' : '') + 'Directory note: ' + p.notes : ''),
    new Date(), out.undated, out.badDates.length
  ];
  var r = ctx.progress.getLastRow() + 1;
  ctx.progress.getRange(r, 1, 1, row.length).setValues([row]);
  ctx.progress.getRange(r, 15).setNumberFormat('0%');
  ctx.progress.getRange(r, 19).setNumberFormat('0%');
  if (out.lastObs) ctx.progress.getRange(r, 16).setNumberFormat('M/d/yyyy');
}

function _sy2627FlushReview(ctx) {
  if (!ctx.reviewRows.length) return;
  var r = ctx.review.getLastRow() + 1;
  ctx.review.getRange(r, 1, ctx.reviewRows.length, SY2627_REVIEW_HEADERS.length).setValues(ctx.reviewRows);
  ctx.reviewRows = [];
}


// ══════════════════════════════════════════════════════════════════════════════
// ██  SMALL HELPERS
// ══════════════════════════════════════════════════════════════════════════════

/** "Apprentice" / "Pre-apprentice" / "Tutor" / "Completed Program". Only "Apprentice…" gets wage-tier emails. */
function _sy2627RoleToTrack(role) {
  if (/completed/i.test(String(role || ''))) return 'Completed Program';
  return _roleToProgramTrack(role);
}

/** Exact header match first (so "Phone" beats "…(email or phone)"), then contains. */
function _sy2627Col(headers, exacts, contains) {
  for (var e = 0; e < exacts.length; e++) {
    var i = headers.indexOf(exacts[e]);
    if (i >= 0) return i;
  }
  for (var c = 0; c < contains.length; c++) {
    for (var j = 0; j < headers.length; j++) if (headers[j].indexOf(contains[c]) >= 0) return j;
  }
  return -1;
}

function _sy2627StripAccents(s) {
  return String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function _sy2627Norm(s) {
  return _normNameFuzzy(_sy2627StripAccents(s));
}

/** Real Date cells, "June 26" / "Oct 2026" text, or any parseable date string. */
function _sy2627ParseDate(v) {
  if (v instanceof Date && !isNaN(v.getTime())) return v;
  var s = String(v || '').trim();
  if (!s || /^n\/?a$/i.test(s)) return null;
  var my = _parseSummerMonthYear(s);
  if (my) return my;
  var d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

/**
 * Portal feed (doGet?tab=sy2627_progress): the Workbook Progress tab as CSV,
 * plus a "Workbook URL" column taken from the Open-workbook formula (the
 * plain cell value only says "Open workbook").
 */
function _sy2627ProgressCSV() {
  var sh = _getSpreadsheet().getSheetByName(SY2627.PROGRESS_SHEET);
  if (!sh || sh.getLastRow() < 1) return '';
  var rng = sh.getRange(1, 1, sh.getLastRow(), sh.getLastColumn());
  var vals = rng.getValues(), forms = rng.getFormulas();
  var linkCol = vals[0].map(String).indexOf('OJT Workbook');
  var tz = Session.getScriptTimeZone();
  return vals.map(function(row, i) {
    var url = '';
    if (i === 0) url = 'Workbook URL';
    else if (linkCol >= 0) { var m = String(forms[i][linkCol] || '').match(/HYPERLINK\("([^"]+)"/i); url = m ? m[1] : ''; }
    return row.concat([url]).map(function(c) {
      var s = c instanceof Date ? Utilities.formatDate(c, tz, 'M/d/yyyy') : String(c === null || c === undefined ? '' : c);
      return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    }).join(',');
  }).join('\n');
}

/** Portal feed (doGet?tab=sy2627_review): the Needs Review tab as CSV. */
function _sy2627ReviewCSV() {
  var sh = _getSpreadsheet().getSheetByName(SY2627.REVIEW_SHEET);
  return sh ? _sheetToCSV(sh) : '';
}

/** Fast in-cell link check (rich-text link, =HYPERLINK, or a pasted URL). No Drive search. */
function _sy2627QuickCellLink(rich, plain, formula) {
  var url = '';
  try {
    url = (rich && rich.getLinkUrl && rich.getLinkUrl()) || '';
    if (!url && rich && rich.getRuns) rich.getRuns().forEach(function(run) { if (!url && run.getLinkUrl()) url = run.getLinkUrl(); });
  } catch (e) {}
  if (!url && formula) { var m = String(formula).match(/HYPERLINK\(\s*"([^"]+)"/i); if (m) url = m[1]; }
  if (!url && plain) { var b = String(plain).match(/https?:\/\/docs\.google\.com\/spreadsheets\/d\/[a-zA-Z0-9_-]+/); if (b) url = b[0]; }
  return _sy2627IdFromUrl(url);
}

/**
 * Reads hyperlinks for one column straight out of the spreadsheet's Excel
 * (.xlsx) export — the export writes every link, including Drive file chips
 * that Apps Script's RichTextValue can't see. Returns one URL (or '') per row
 * from firstRow..lastRow. Never throws; logs the reason if it can't read.
 */
function _sy2627ExportLinks(spreadsheetId, tabName, col1, firstRow, lastRow) {
  var out = [];
  for (var k = firstRow; k <= lastRow; k++) out.push('');
  try {
    var resp = UrlFetchApp.fetch('https://docs.google.com/spreadsheets/d/' + spreadsheetId + '/export?format=xlsx',
      { headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() }, muteHttpExceptions: true });
    if (resp.getResponseCode() !== 200) {
      _logNotification('LINK_READ_WARNING', '', 'Excel export of the Onsite tracker failed (HTTP ' + resp.getResponseCode() + ')', '', '_sy2627ExportLinks');
      return out;
    }
    var files = {};
    Utilities.unzip(resp.getBlob().setContentType('application/zip')).forEach(function(b) { files[b.getName()] = b; });
    var text = function(n) { return files[n] ? files[n].getDataAsString() : ''; };
    var unesc = function(v) { return String(v).replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'"); };
    var attr = function(tag, name) { var m = tag.match(new RegExp('\\s' + name + '="([^"]*)"')); return m ? unesc(m[1]) : ''; };
    // tab name -> sheet file
    var relId = '';
    (text('xl/workbook.xml').match(/<sheet\b[^>]*>/g) || []).forEach(function(t) { if (attr(t, 'name') === tabName) relId = attr(t, 'r:id'); });
    if (!relId) { _logNotification('LINK_READ_WARNING', '', 'Tab "' + tabName + '" not found in the Excel export', '', '_sy2627ExportLinks'); return out; }
    var target = '';
    (text('xl/_rels/workbook.xml.rels').match(/<Relationship\b[^>]*>/g) || []).forEach(function(t) { if (attr(t, 'Id') === relId) target = attr(t, 'Target'); });
    var sheetPath = target.charAt(0) === '/' ? target.slice(1) : 'xl/' + target.replace(/^\.\//, '');
    var relsPath = sheetPath.replace(/([^\/]+)$/, '_rels/$1.rels');
    var rels = {};
    (text(relsPath).match(/<Relationship\b[^>]*>/g) || []).forEach(function(t) { rels[attr(t, 'Id')] = attr(t, 'Target'); });
    var colA = _colLetter(col1);
    (text(sheetPath).match(/<hyperlink\b[^>]*>/g) || []).forEach(function(t) {
      var ref = attr(t, 'ref').split(':')[0];
      var m = ref.match(/^([A-Z]+)(\d+)$/);
      if (!m || m[1] !== colA) return;
      var row = parseInt(m[2], 10);
      var url = rels[attr(t, 'r:id')] || '';
      if (row >= firstRow && row <= lastRow && url) out[row - firstRow] = url;
    });
  } catch (e) {
    _logNotification('LINK_READ_WARNING', '', 'Could not read links from the Excel export: ' + e, '', '_sy2627ExportLinks');
  }
  return out;
}

/** Spreadsheet ID from a Google Sheets URL (or '' if none). */
function _sy2627IdFromUrl(url) {
  var m = String(url || '').match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
  return m ? m[1] : '';
}

/**
 * Reads one column of link cells through the Sheets API and returns one URL
 * (or '') per row from firstRow..lastRow. Covers whole-cell hyperlinks,
 * links on part of the text, and Google Drive file chips. Never throws.
 */
function _sy2627ApiLinks(spreadsheetId, tabName, col1, firstRow, lastRow) {
  var out = [];
  for (var k = firstRow; k <= lastRow; k++) out.push('');
  var colA = _colLetter(col1);
  var range = "'" + String(tabName).replace(/'/g, "''") + "'!" + colA + firstRow + ':' + colA + lastRow;
  var fieldSets = [
    'sheets(data(rowData(values(hyperlink,textFormatRuns(format(link(uri))),chipRuns(chip(richLinkProperties(uri)))))))',
    'sheets(data(rowData(values(hyperlink,textFormatRuns(format(link(uri)))))))'
  ];
  for (var f = 0; f < fieldSets.length; f++) {
    try {
      var url = 'https://sheets.googleapis.com/v4/spreadsheets/' + spreadsheetId +
        '?includeGridData=true&ranges=' + encodeURIComponent(range) + '&fields=' + encodeURIComponent(fieldSets[f]);
      var resp = UrlFetchApp.fetch(url, { headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() }, muteHttpExceptions: true });
      if (resp.getResponseCode() !== 200) { Logger.log('_sy2627ApiLinks HTTP ' + resp.getResponseCode() + ': ' + resp.getContentText().slice(0, 300)); continue; }
      var json = JSON.parse(resp.getContentText());
      var rows = (((json.sheets || [])[0] || {}).data || [])[0];
      rows = (rows && rows.rowData) || [];
      for (var r = 0; r < rows.length && r < out.length; r++) {
        var v = ((rows[r] || {}).values || [])[0] || {};
        var link = v.hyperlink || '';
        if (!link && v.chipRuns) v.chipRuns.forEach(function(cr) {
          var u = cr && cr.chip && cr.chip.richLinkProperties && cr.chip.richLinkProperties.uri;
          if (!link && u) link = u;
        });
        if (!link && v.textFormatRuns) v.textFormatRuns.forEach(function(tr) {
          var u = tr && tr.format && tr.format.link && tr.format.link.uri;
          if (!link && u) link = u;
        });
        out[r] = link;
      }
      return out;
    } catch (e) {
      Logger.log('_sy2627ApiLinks: ' + e);
    }
  }
  return out;
}

/**
 * ONE-TIME (safe to re-run): re-reads every SUMMER 2026 workbook on the
 * "Summer 26 OJT" tab and adds only the activities the old matcher missed
 * (Beginning/Professionalism/H and Middle/Instruction/AB) or anything else
 * not yet in the OTJ log. Does NOT change any Master Roster details — only
 * adds missing activities for people already on the roster, then recalculates.
 */
function topUpSummerWorkbooks() {
  var t0 = Date.now();
  _DEFER_COMPLETION_SUMMARY = true;
  var onsiteDb = SpreadsheetApp.openById(ONSITE_DB_SHEET_ID);
  var ss = _getSpreadsheet();
  var rSheet = _getSheetByGID(ss, GID_MASTER_ROSTER);
  var ojtSheet = _getSheetByGID(ss, GID_OJT_LOG);
  var summerTab = onsiteDb.getSheetByName(SUMMER_OJT_TAB_NAME);
  var directory = _readSummerOJTDirectory(onsiteDb);
  if (summerTab) {
    var api = _sy2627ExportLinks(onsiteDb.getId(), SUMMER_OJT_TAB_NAME, 3, 4, summerTab.getLastRow());
    if (!api.filter(Boolean).length) api = _sy2627ApiLinks(onsiteDb.getId(), SUMMER_OJT_TAB_NAME, 3, 4, summerTab.getLastRow());
    var nonBlank = [];
    summerTab.getRange(4, 1, Math.max(summerTab.getLastRow() - 3, 1), 1).getValues().forEach(function(r, i) {
      if (String(r[0] || '').trim()) nonBlank.push(api[i] || '');
    });
    directory.forEach(function(p, i) { if (!p.ojtSpreadsheetId) p.ojtSpreadsheetId = _sy2627IdFromUrl(nonBlank[i]); });
  }
  var roster = _sy2627ReadRosterIndex(rSheet);
  var keys = _sy2627ExistingOJTKeys(ojtSheet);
  var schemaIndex = _buildSchemaTextIndex();
  var added = 0, people = 0, skipped = [];
  for (var d = 0; d < directory.length; d++) {
    if (Date.now() - t0 > SY2627.TIME_BUDGET_MS) { skipped.push('…stopped for time — run again to finish (safe)'); break; }
    var person = directory[d];
    var rr = _demoFuzzyMatch(_sy2627StripAccents(person.name), roster);
    if (!rr || !person.ojtSpreadsheetId) { skipped.push(person.name + (rr ? ' (no link)' : ' (not on roster)')); continue; }
    var wb;
    try { wb = SpreadsheetApp.openById(person.ojtSpreadsheetId); } catch (e) { skipped.push(person.name + ' (cannot open)'); continue; }
    var tab = wb.getSheetByName('On The Job Training Checklist') || wb.getSheetByName(' On The Job Training Checklist');
    if (!tab) { skipped.push(person.name + ' (no summer checklist tab)'); continue; }
    var data = tab.getDataRange().getValues();
    var dom = '', phase = '', rows = [], ts = new Date();
    for (var i = 0; i < data.length; i++) {
      var b = String(data[i][1] || '').trim(), c = String(data[i][2] || '').trim(), e = String(data[i][4] || '').trim();
      if (/beginning of (the )?program/i.test(b)) phase = 'Beginning';
      else if (/middle of (the )?program/i.test(b)) phase = 'Middle';
      else if (/end of (the )?program/i.test(b)) phase = 'End';
      if (i < 10) continue;
      if (b && !c) { dom = b; continue; }
      if (!c || !/^y/i.test(e)) continue;
      var m = _matchActivityByText(schemaIndex, phase, dom, c);
      if (!m) continue;
      var key = _normName(rr.name) + '|' + m.phase.toLowerCase() + '|' + m.domain.toLowerCase() + '|' + String(m.code).toUpperCase();
      if (keys[key]) continue;
      keys[key] = true;
      var r = new Array(16).fill('');
      r[OJT_TIMESTAMP] = ts; r[OJT_LOG_TYPE] = 'OJT Activity completion (Summer Import)';
      r[OJT_OBS_DATE] = _parseSummerMonthYear(data[i][5]) || ''; r[OJT_OBSERVER] = person.siteLeader || '';
      r[OJT_APPRENTICE] = rr.name; r[OJT_PHASE] = m.phase; r[OJT_DOMAIN] = m.domain; r[OJT_ACTIVITY] = m.code;
      r[OJT_STATUS] = 'Y — Observed and completed (Summer Import)';
      r[OJT_NOTES] = 'Summer top-up (v11 matcher fix) from tab "' + tab.getName() + '"';
      rows.push(r);
    }
    if (rows.length) {
      _sy2627AppendOJTRows(ojtSheet, rows);
      added += rows.length;
      recalculateTotals(rr.name);
    }
    people++;
  }
  _DEFER_COMPLETION_SUMMARY = false;
  try { rebuildCompletionSummary(); } catch (e) {}
  _logNotification('SUMMER_TOPUP', '', people + ' summer workbooks re-read, ' + added + ' missed activities added', '', 'topUpSummerWorkbooks');
  _safeAlert('Summer top-up complete.\n\nWorkbooks re-read: ' + people + '\nMissed activities added: ' + added +
    (skipped.length ? '\n\nSkipped:\n  ' + skipped.join('\n  ') : ''));
}

function _sy2627DeleteTriggers(handler) {
  ScriptApp.getProjectTriggers().forEach(function(t) {
    if (t.getHandlerFunction() === handler) ScriptApp.deleteTrigger(t);
  });
}
