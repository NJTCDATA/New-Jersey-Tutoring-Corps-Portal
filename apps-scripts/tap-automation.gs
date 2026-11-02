/**
 * ╔══════════════════════════════════════════════════════════════════════════════╗
 * ║  NJTC TAP — WORKBOOK AUTOMATION (months, resync, reports, schedule)         ║
 * ║  Add-on file for the TAP Tracker 26-27 Apps Script project.                ║
 * ╠══════════════════════════════════════════════════════════════════════════════╣
 * ║  1. MONTHS NEVER RUN OUT                                                   ║
 * ║     MONTH_LABELS (main script) is now generated: Mar-25 → Aug of the       ║
 * ║     current school year, and rolls forward every Sep 1 by itself.         ║
 * ║     The original 18 month columns (BL:CC OJT, CD:CU RTI) stay where they  ║
 * ║     are. Every month after Aug-26 is added AT THE END of Master Roster,   ║
 * ║     after "Role Type" (col CV), as a pair: "Sep-26 OJT", "Sep-26 RTI",    ║
 * ║     "Oct-26 OJT", "Oct-26 RTI", … Columns + headers are created           ║
 * ║     automatically the first time they're needed. Nothing that already     ║
 * ║     exists moves, so the portal (which reads columns by header name)      ║
 * ║     and every MR_* index keep working.                                    ║
 * ║                                                                            ║
 * ║  2. SCHEDULE (one click: "Automation: Install ALL Scheduled Jobs")        ║
 * ║     Nightly ~3am   SY 26-27 OJT workbook sync (tap-sy2627-ojt-sync.gs)    ║
 * ║     Sunday ~4am    Full resync of every Active apprentice (chunked)       ║
 * ║     1st ~1am       Full resync (so last month is complete)                ║
 * ║     1st ~7am       Last month's OJT Wage Report + Wage Summary/Projection ║
 * ║                    rebuilt, PDF emailed for review                        ║
 * ║     Monday ~7am    Weekly TAP status digest emailed                       ║
 * ║     The portal reads the sheet live through the web app (doGet), so every ║
 * ║     refresh above shows up in the portal on its next load.                ║
 * ║                                                                            ║
 * ║  3. RECIPIENTS (Script Properties — optional overrides)                   ║
 * ║     WAGE_REPORT_TO  default: ADMIN_EMAIL + FINANCE_EMAIL_1                ║
 * ║     DIGEST_TO       default: ADMIN_EMAIL                                  ║
 * ║     (comma-separated lists)                                               ║
 * ╚══════════════════════════════════════════════════════════════════════════════╝
 */

var AUTO = {
  BASE_MONTHS:        18,      // Mar-25 … Aug-26 live in the original column blocks
  EXT_START_IDX:      100,     // 0-based index of column 101 (CW) — first column after "Role Type"
  HEADER_ROW:         3,       // Master Roster header row (1-based)
  TIME_BUDGET_MS:     270000,
  RESYNC_CURSOR_PROP: 'AUTO_RESYNC_CURSOR',
  RESYNC_NEXT_PROP:   'AUTO_RESYNC_THEN',   // job to run after a resync finishes
  LAST_RUN_PREFIX:    'AUTO_LAST_RUN_',
  HANDLERS: {
    syncSY2627OJT:              { label: 'Nightly SY 26-27 OJT workbook sync', make: function(b) { return b.everyDays(1).atHour(3); } },
    autoWeeklyFullResync:       { label: 'Weekly full resync (Sunday)',       make: function(b) { return b.onWeekDay(ScriptApp.WeekDay.SUNDAY).atHour(4); } },
    autoMonthStartResync:       { label: 'Month-start full resync (1st)',     make: function(b) { return b.onMonthDay(1).atHour(1); } },
    autoMonthlyWageReport:      { label: 'Monthly wage report + email (1st)', make: function(b) { return b.onMonthDay(1).atHour(7); } },
    autoWeeklyDigest:           { label: 'Weekly status digest (Monday)',     make: function(b) { return b.onWeekDay(ScriptApp.WeekDay.MONDAY).atHour(7); } },
  },
};


// ══════════════════════════════════════════════════════════════════════════════
// ██  MONTH COLUMNS
// ══════════════════════════════════════════════════════════════════════════════

/** 0-based Master Roster column for month index i (index into MONTH_LABELS). */
function _mrOJTMonthCol(i) {
  return i < AUTO.BASE_MONTHS ? MR_OJT_MONTHLY_START + i : AUTO.EXT_START_IDX + 2 * (i - AUTO.BASE_MONTHS);
}
function _mrRTIMonthCol(i) {
  return i < AUTO.BASE_MONTHS ? MR_RTI_MONTHLY_START + i : AUTO.EXT_START_IDX + 2 * (i - AUTO.BASE_MONTHS) + 1;
}

/** Reads a month's value from a full Master Roster row array. kind = 'OJT' | 'RTI'. */
function _mrMonthValue(rowData, kind, i) {
  if (i < 0) return 0;
  var col = kind === 'RTI' ? _mrRTIMonthCol(i) : _mrOJTMonthCol(i);
  return parseFloat(rowData[col]) || 0;
}

var _AUTO_MONTH_COLS_READY = false;

/** Grows Master Roster and writes "Sep-26 OJT" / "Sep-26 RTI" … headers for every month past Aug-26. */
function _ensureMonthColumns(rSheet) {
  if (_AUTO_MONTH_COLS_READY) return;
  var extMonths = Math.max(0, MONTH_LABELS.length - AUTO.BASE_MONTHS);
  if (extMonths > 0) {
    var width = 2 * extMonths;
    _ensureColumnCount(rSheet, AUTO.EXT_START_IDX + width);
    var hdrRange = rSheet.getRange(AUTO.HEADER_ROW, AUTO.EXT_START_IDX + 1, 1, width);
    var hdr = hdrRange.getValues()[0];
    var changed = false;
    for (var m = 0; m < extMonths; m++) {
      var label = MONTH_LABELS[AUTO.BASE_MONTHS + m];
      if (!String(hdr[2 * m] || '').trim())     { hdr[2 * m]     = label + ' OJT'; changed = true; }
      if (!String(hdr[2 * m + 1] || '').trim()) { hdr[2 * m + 1] = label + ' RTI'; changed = true; }
    }
    if (changed) {
      hdrRange.setValues([hdr]).setFontWeight('bold').setWrap(true);
      Logger.log('_ensureMonthColumns: Master Roster month columns now run through ' + MONTH_LABELS[MONTH_LABELS.length - 1]);
    }
  }
  _AUTO_MONTH_COLS_READY = true;
}

/**
 * Called by recalculateTotals() in place of its two monthly setValues lines.
 * monthlyOJT / monthlyRTI are { 'Sep-26': hours, … } maps.
 */
function _writeMonthlyColumns(rSheet, rowIndex, monthlyOJT, monthlyRTI) {
  _ensureMonthColumns(rSheet);
  var base = Math.min(AUTO.BASE_MONTHS, MONTH_LABELS.length);
  var baseLabels = MONTH_LABELS.slice(0, base);
  rSheet.getRange(rowIndex, MR_OJT_MONTHLY_START + 1, 1, base)
    .setValues([baseLabels.map(function(l) { return monthlyOJT[l] || 0; })]);
  rSheet.getRange(rowIndex, MR_RTI_MONTHLY_START + 1, 1, base)
    .setValues([baseLabels.map(function(l) { return monthlyRTI[l] || 0; })]);

  var ext = MONTH_LABELS.slice(AUTO.BASE_MONTHS);
  if (ext.length) {
    var pairs = [];
    ext.forEach(function(l) { pairs.push(monthlyOJT[l] || 0, monthlyRTI[l] || 0); });
    rSheet.getRange(rowIndex, AUTO.EXT_START_IDX + 1, 1, pairs.length).setValues([pairs]);
  }
}


// ══════════════════════════════════════════════════════════════════════════════
// ██  FULL RESYNC (chunked, safe for triggers)
// ══════════════════════════════════════════════════════════════════════════════

function autoWeeklyFullResync() { _autoStartResync(''); }
function autoMonthStartResync() { _autoStartResync(''); }

/** Menu: recompute every Active apprentice now (also backfills the new month columns). */
function menuAutomationFullResync() {
  var done = _autoStartResync('');
  _safeAlert(done
    ? 'Full resync complete — every Active apprentice recalculated, month columns through ' + MONTH_LABELS[MONTH_LABELS.length - 1] + ' filled.'
    : 'Full resync started. It is large, so it saves its place and keeps going in the background about a minute apart. Check the Notifications Log for "AUTO_RESYNC_DONE".');
}

function _autoStartResync(thenJob) {
  _autoDeleteTriggers('continueAutomationResync');
  var p = PropertiesService.getScriptProperties();
  p.deleteProperty(AUTO.RESYNC_CURSOR_PROP);
  if (thenJob) p.setProperty(AUTO.RESYNC_NEXT_PROP, thenJob); else p.deleteProperty(AUTO.RESYNC_NEXT_PROP);
  return _autoResyncRun(0);
}

function continueAutomationResync() {
  _autoDeleteTriggers('continueAutomationResync');
  var cursor = parseInt(PropertiesService.getScriptProperties().getProperty(AUTO.RESYNC_CURSOR_PROP) || '0', 10) || 0;
  _autoResyncRun(cursor);
}

function _autoResyncRun(cursor) {
  var t0 = Date.now();
  var p = PropertiesService.getScriptProperties();
  try {
    var ss = _getSpreadsheet();
    var rSheet = _getSheetByGID(ss, GID_MASTER_ROSTER);
    _ensureMonthColumns(rSheet);
    var data = rSheet.getDataRange().getValues();
    var names = [];
    for (var i = 4; i < data.length; i++) {
      var st = String(data[i][MR_STATUS] || '').trim();
      var nm = String(data[i][MR_FULL_NAME] || '').trim();
      if (nm && (st === 'Active' || st === 'Reinstated')) names.push(nm);
    }
    for (var k = cursor; k < names.length; k++) {
      if (Date.now() - t0 > AUTO.TIME_BUDGET_MS) {
        p.setProperty(AUTO.RESYNC_CURSOR_PROP, String(k));
        ScriptApp.newTrigger('continueAutomationResync').timeBased().after(60 * 1000).create();
        Logger.log('Auto resync paused at ' + k + '/' + names.length);
        return false;
      }
      recalculateTotals(names[k]);
    }
    p.deleteProperty(AUTO.RESYNC_CURSOR_PROP);
    rebuildCompletionSummary();
    _autoMarkRun('resync');
    _logNotification('AUTO_RESYNC_DONE', '', names.length + ' apprentices recalculated; months through ' + MONTH_LABELS[MONTH_LABELS.length - 1], '', 'autoResync');

    var next = p.getProperty(AUTO.RESYNC_NEXT_PROP);
    p.deleteProperty(AUTO.RESYNC_NEXT_PROP);
    if (next === 'wageReport') _autoRunWageReport();
    return true;
  } catch (err) {
    _handleError('_autoResyncRun', err);
    return false;
  }
}


// ══════════════════════════════════════════════════════════════════════════════
// ██  MONTHLY WAGE REPORT (auto, emailed)
// ══════════════════════════════════════════════════════════════════════════════

/** Trigger (1st of month): builds LAST month's report, rebuilds Summary/Projection, emails PDF. */
function autoMonthlyWageReport() {
  // If the month-start resync is still running, chain the report after it instead of racing it.
  var p = PropertiesService.getScriptProperties();
  if (p.getProperty(AUTO.RESYNC_CURSOR_PROP)) {
    p.setProperty(AUTO.RESYNC_NEXT_PROP, 'wageReport');
    Logger.log('autoMonthlyWageReport: resync still running — report will run when it finishes');
    return;
  }
  _autoRunWageReport();
}

/** Menu: pick a month (defaults to last month), generate, and email. */
function menuGenerateWageReportForMonth() {
  var ui = SpreadsheetApp.getUi();
  var def = _autoPrevMonthLabel();
  var resp = ui.prompt('OJT Wage Report', 'Month to generate (e.g. ' + def + '). Leave blank for ' + def + ':', ui.ButtonSet.OK_CANCEL);
  if (resp.getSelectedButton() !== ui.Button.OK) return;
  var label = _normMonthLabel((resp.getResponseText() || '').trim() || def);
  if (MONTH_LABELS.indexOf(label) < 0) { _safeAlert('"' + label + '" is not a tracked month (' + MONTH_LABELS[0] + ' – ' + MONTH_LABELS[MONTH_LABELS.length - 1] + ').'); return; }
  var res = _autoRunWageReport(label);
  _safeAlert(res ? 'Built "' + res.sheetName + '" (' + res.rows + ' apprentices) and emailed it to ' + res.to + '.' : 'Wage report failed — see Notifications Log.');
}

function _autoPrevMonthLabel() {
  var d = new Date();
  d.setDate(1); d.setMonth(d.getMonth() - 1);
  return Utilities.formatDate(d, Session.getScriptTimeZone(), 'MMM-yy');
}

function _autoRunWageReport(label) {
  try {
    label = label || _autoPrevMonthLabel();
    var props = PropertiesService.getScriptProperties().getProperties();
    var ss = _getSpreadsheet();
    var sheetName = generateMonthlyWageReport(label);
    try { rebuildWageSummaryAndProjection(); } catch (e) { Logger.log('wage summary rebuild: ' + e); }
    var sheet = ss.getSheetByName(sheetName);
    var rows = sheet ? Math.max(0, sheet.getLastRow() - 7) : 0;

    var to = _autoRecipients(props.WAGE_REPORT_TO, [props.ADMIN_EMAIL || 'amir@njtutoringcorps.org', props.FINANCE_EMAIL_1]);
    var sheetUrl = 'https://docs.google.com/spreadsheets/d/' + (props.SHEET_ID || _HARDCODED_SHEET_ID) + '/edit#gid=' + sheet.getSheetId();
    var attachments = [];
    try {
      var pdfUrl = 'https://docs.google.com/spreadsheets/d/' + (props.SHEET_ID || _HARDCODED_SHEET_ID) +
        '/export?format=pdf&gid=' + sheet.getSheetId() + '&size=letter&portrait=false&fitw=true&gridlines=false';
      var resp = UrlFetchApp.fetch(pdfUrl, { headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() }, muteHttpExceptions: true });
      if (resp.getResponseCode() === 200) attachments.push(resp.getBlob().setName(sheetName + '.pdf'));
    } catch (pdfErr) { Logger.log('wage report PDF: ' + pdfErr); }

    if (to) {
      GmailApp.sendEmail(to, 'NJTC TAP — ' + sheetName + ' (auto-generated, please review)',
        'The ' + sheetName + ' was generated automatically from live TAP data.\n\n' +
        'Apprentices on report: ' + rows + '\n' +
        'Hours = Master Roster monthly OJT hours for ' + label + '; Hourly Rate = current wage tier.\n\n' +
        'Please review against payroll before submitting. Comments and any match-% overrides you type in the sheet are kept if the report is regenerated.\n\n' +
        'Open the sheet: ' + sheetUrl + '\n' +
        'Wage Summary and Wage Projection tabs were rebuilt at the same time.\n\n' +
        'NJTC TAP — Automated Report', attachments.length ? { attachments: attachments } : {});
    }
    _autoMarkRun('wageReport');
    _logNotification('AUTO_WAGE_REPORT', '', sheetName + ' | ' + rows + ' rows | emailed: ' + (to || 'nobody'), to, 'autoMonthlyWageReport');
    return { sheetName: sheetName, rows: rows, to: to };
  } catch (err) {
    _handleError('_autoRunWageReport', err);
    return null;
  }
}


// ══════════════════════════════════════════════════════════════════════════════
// ██  WEEKLY STATUS DIGEST
// ══════════════════════════════════════════════════════════════════════════════

function autoWeeklyDigest() {
  try {
    var props = PropertiesService.getScriptProperties().getProperties();
    var ss = _getSpreadsheet();
    var tz = Session.getScriptTimeZone();
    var weekAgo = new Date(Date.now() - 7 * 86400000);
    var monthAgo = new Date(Date.now() - 30 * 86400000);
    var lines = [];

    // Master Roster
    var rSheet = _getSheetByGID(ss, GID_MASTER_ROSTER);
    var rd = rSheet.getDataRange().getValues();
    var active = 0, apprentices = 0, complete = 0, sumPct = 0;
    for (var i = 4; i < rd.length; i++) {
      var st = String(rd[i][MR_STATUS] || '').trim();
      if (!rd[i][MR_FULL_NAME] || (st !== 'Active' && st !== 'Reinstated')) continue;
      active++;
      sumPct += parseFloat(rd[i][MR_OJT_PCT]) || 0;
      if (/^apprentice/i.test(String(rd[i][MR_PROGRAM_TRACK] || ''))) apprentices++;
      if (String(rd[i][MR_PROGRAM_COMPLETE] || '').toUpperCase() === 'YES') complete++;
    }
    lines.push('MASTER ROSTER');
    lines.push('  Active: ' + active + '  (Apprentice track: ' + apprentices + ')');
    lines.push('  Average OJT completion: ' + Math.round(active ? sumPct / active * 100 : 0) + '%');
    lines.push('  Program complete: ' + complete);

    // OTJ activity in the last 7 days
    var ojt = _getSheetByGID(ss, GID_OJT_LOG).getDataRange().getValues();
    var byType = {}, people = {};
    for (var j = 1; j < ojt.length; j++) {
      var ts = ojt[j][OJT_TIMESTAMP];
      if (!(ts instanceof Date) || ts < weekAgo) continue;
      var t = String(ojt[j][OJT_LOG_TYPE] || 'Other');
      byType[t] = (byType[t] || 0) + 1;
      people[_normName(ojt[j][OJT_APPRENTICE])] = true;
    }
    lines.push('');
    lines.push('LAST 7 DAYS — OTJ LOG');
    var types = Object.keys(byType);
    if (!types.length) lines.push('  No new entries.');
    types.forEach(function(t) { lines.push('  ' + t + ': ' + byType[t]); });
    lines.push('  Apprentices with new entries: ' + Object.keys(people).length);

    // SY 26-27 workbook progress
    var prog = ss.getSheetByName('SY 26-27 Workbook Progress');
    if (prog && prog.getLastRow() > 1) {
      var pv = prog.getDataRange().getValues();
      var h = pv[0].map(String);
      var cName = h.indexOf('Directory Name'), cTrack = h.indexOf('Program Track'), cPct = h.indexOf('Workbook %'),
          cLast = h.indexOf('Latest Observation'), cIss = h.indexOf('Issues'), cSync = h.indexOf('Last Synced');
      var stale = [], withIssues = 0, wbSum = 0, wbN = 0, lastSync = null;
      for (var r = 1; r < pv.length; r++) {
        var nm = pv[r][cName]; if (!nm) continue;
        wbSum += parseFloat(pv[r][cPct]) || 0; wbN++;
        if (String(pv[r][cIss] || '').trim()) withIssues++;
        var lo = pv[r][cLast];
        if (/apprentice/i.test(String(pv[r][cTrack] || '')) && (!(lo instanceof Date) || lo < monthAgo)) stale.push(nm);
        if (pv[r][cSync] instanceof Date && (!lastSync || pv[r][cSync] > lastSync)) lastSync = pv[r][cSync];
      }
      lines.push('');
      lines.push('SY 26-27 OJT WORKBOOKS');
      lines.push('  Workbooks tracked: ' + wbN + '   Average workbook %: ' + Math.round(wbN ? wbSum / wbN * 100 : 0) + '%');
      lines.push('  Last synced: ' + (lastSync ? Utilities.formatDate(lastSync, tz, 'EEE M/d h:mm a') : 'never'));
      lines.push('  Rows with issues: ' + withIssues);
      lines.push('  Apprentice/Pre-apprentice with NO observation in 30+ days (' + stale.length + '):');
      stale.slice(0, 30).forEach(function(n) { lines.push('    • ' + n); });
      if (stale.length > 30) lines.push('    … and ' + (stale.length - 30) + ' more');
    }

    var review = ss.getSheetByName('SY 26-27 Import — Needs Review');
    if (review) lines.push('  Needs Review items: ' + Math.max(0, review.getLastRow() - 1));

    // Notifications in last 7 days
    var log = ss.getSheetByName('Notifications Log');
    if (log) {
      var lv = log.getDataRange().getValues(), counts = {};
      for (var q = 1; q < lv.length; q++) {
        if (!(lv[q][0] instanceof Date) || lv[q][0] < weekAgo) continue;
        var ty = String(lv[q][1] || '');
        if (/WAGE_ALERT|PROGRAM_COMPLETE|SCRIPT_ERROR|AUTO_ACTIVATED|SY2627_ROSTER_ADDED/.test(ty)) counts[ty] = (counts[ty] || 0) + 1;
      }
      lines.push('');
      lines.push('LAST 7 DAYS — ALERTS');
      var ck = Object.keys(counts);
      if (!ck.length) lines.push('  None.');
      ck.forEach(function(k) { lines.push('  ' + k + ': ' + counts[k]); });
    }

    lines.push('');
    lines.push('SCHEDULED JOBS — last successful run');
    ['syncSY2627', 'resync', 'wageReport', 'digest'].forEach(function(k) {
      var v = PropertiesService.getScriptProperties().getProperty(AUTO.LAST_RUN_PREFIX + k);
      lines.push('  ' + k + ': ' + (v ? Utilities.formatDate(new Date(v), tz, 'EEE M/d h:mm a') : 'not yet'));
    });
    lines.push('');
    lines.push('Workbook: https://docs.google.com/spreadsheets/d/' + (props.SHEET_ID || _HARDCODED_SHEET_ID) + '/edit');

    var to = _autoRecipients(props.DIGEST_TO, [props.ADMIN_EMAIL || 'amir@njtutoringcorps.org']);
    GmailApp.sendEmail(to, 'NJTC TAP — Weekly Status (' + Utilities.formatDate(new Date(), tz, 'M/d/yyyy') + ')', lines.join('\n'));
    _autoMarkRun('digest');
    _logNotification('AUTO_WEEKLY_DIGEST', '', 'Digest emailed', to, 'autoWeeklyDigest');
  } catch (err) {
    _handleError('autoWeeklyDigest', err);
  }
}


// ══════════════════════════════════════════════════════════════════════════════
// ██  INSTALL / STATUS
// ══════════════════════════════════════════════════════════════════════════════

/** One click: installs every scheduled job. Touches ONLY these jobs' triggers. */
function installAllAutomation() {
  var installed = [];
  Object.keys(AUTO.HANDLERS).forEach(function(fn) {
    _autoDeleteTriggers(fn);
    AUTO.HANDLERS[fn].make(ScriptApp.newTrigger(fn).timeBased()).create();
    installed.push('✓ ' + AUTO.HANDLERS[fn].label);
  });
  _ensureMonthColumns(_getSheetByGID(_getSpreadsheet(), GID_MASTER_ROSTER));
  _safeAlert('Automation installed:\n\n' + installed.join('\n') +
    '\n\nMaster Roster month columns run through ' + MONTH_LABELS[MONTH_LABELS.length - 1] + ' and roll forward every September automatically.' +
    '\n\nRun "Automation: Full Resync Now" once to backfill the new month columns for everyone.');
}

function automationStatus() {
  var tz = Session.getScriptTimeZone();
  var have = {};
  ScriptApp.getProjectTriggers().forEach(function(t) { have[t.getHandlerFunction()] = (have[t.getHandlerFunction()] || 0) + 1; });
  var p = PropertiesService.getScriptProperties();
  var lines = Object.keys(AUTO.HANDLERS).map(function(fn) {
    return (have[fn] ? '✓ ' : '✗ MISSING  ') + AUTO.HANDLERS[fn].label;
  });
  lines.push('');
  ['syncSY2627', 'resync', 'wageReport', 'digest'].forEach(function(k) {
    var v = p.getProperty(AUTO.LAST_RUN_PREFIX + k);
    lines.push('Last ' + k + ': ' + (v ? Utilities.formatDate(new Date(v), tz, 'EEE M/d/yyyy h:mm a') : 'not yet'));
  });
  lines.push('');
  lines.push('Tracked months: ' + MONTH_LABELS[0] + ' – ' + MONTH_LABELS[MONTH_LABELS.length - 1]);
  _safeAlert(lines.join('\n'));
}

function _autoMarkRun(key) {
  PropertiesService.getScriptProperties().setProperty(AUTO.LAST_RUN_PREFIX + key, new Date().toISOString());
}

function _autoDeleteTriggers(handler) {
  ScriptApp.getProjectTriggers().forEach(function(t) {
    if (t.getHandlerFunction() === handler) ScriptApp.deleteTrigger(t);
  });
}

function _autoRecipients(override, defaults) {
  var list = override ? String(override).split(',') : defaults;
  return list.map(function(s) { return String(s || '').trim(); })
    .filter(function(s) { return s.indexOf('@') > 0; })
    .filter(function(s, i, a) { return a.indexOf(s) === i; })
    .join(',');
}
