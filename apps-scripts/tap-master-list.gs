/**
 * ╔══════════════════════════════════════════════════════════════════════════════╗
 * ║  NJTC TAP — Apprenticeship Tracking Master List                            ║
 * ║  Google Apps Script — Full Production Build                                ║
 * ║  Build Brief v3 FINAL + HR Final Patch                                     ║
 * ╠══════════════════════════════════════════════════════════════════════════════╣
 * ║  Workbook ID:    14UiE5ple1NYVQl5s9U085pFp50vKjnnwNQmsGS0AKJU             ║
 * ║  Intake Form:    1zr-mZmQmcOELg9P9IQAaO7ehBks7EBtEPfXHXug_HOw            ║
 * ║  OJT Log Form:   1MOsppwhQmagAhVSHs29Ms4o9Ky4xYOyqy8Qs4uTrwbQ            ║
 * ╠══════════════════════════════════════════════════════════════════════════════╣
 * ║  TRIGGERS (install via installTriggers()):                                 ║
 * ║    onIntakeFormSubmit  → fires on new intake application                   ║
 * ║    onOJTFormSubmit     → fires on new OJT log entry                        ║
 * ║                                                                            ║
 * ║  ENDPOINTS:                                                                ║
 * ║    doGet(?tab=ojt_log|master_roster|intake) → CSV for portal JS            ║
 * ║    doPost()  → receives OJT completion payloads from portal                ║
 * ║                                                                            ║
 * ║  PUBLIC FUNCTIONS:                                                         ║
 * ║    exportOJTReport()   → generates PDF of OJT progress for all apprentices ║
 * ║    runMilestoneCheck() → manual trigger to scan all apprentices for milestones ║
 * ║    installTriggers()   → sets up all form submit triggers                  ║
 * ╚══════════════════════════════════════════════════════════════════════════════╝
 *
 * SCRIPT PROPERTIES (set via Project Settings → Script Properties):
 *
 *   SHEET_ID              14UiE5ple1NYVQl5s9U085pFp50vKjnnwNQmsGS0AKJU
 *   PEARL_LOGIN_CSV       https://docs.google.com/spreadsheets/d/e/2PACX-...pub?output=csv
 *   PEARL_LOGIN_SHEET_ID  1qUVxSKArAevzOrNxxqdkoxgU3Bn2rqZUFYIJjEP4eto
 *   INTAKE_FORM_ID        1zr-mZmQmcOELg9P9IQAaO7ehBks7EBtEPfXHXug_HOw
 *   OJT_FORM_ID           1MOsppwhQmagAhVSHs29Ms4o9Ky4xYOyqy8Qs4uTrwbQ
 *   ADMIN_EMAIL           amir@njtutoringcorps.org
 *   FINANCE_EMAIL_1       bertin@njtutoringcorps.org
 *   FINANCE_EMAIL_2       ashley@njtutoringcorps.org
 *   FINANCE_EMAIL_3       mysti@njtutoringcorps.org
 *   TD_EMAIL_1            jlc@njtutoringcorps.org
 *   TD_EMAIL_2            anne@njtutoringcorps.org
 *   CERT_BONUS            5.00
 *   OJT_COMPLETION_HOURS  4000
 *   RTI_COMPLETION_HOURS  288
 *   ACADEMIC_YEAR         2025-2026
 *   HR_MASTER_CSV_URL     [published CSV URL for HR Master List tab]
 *   COMPLETION_SUMMARY_CSV  https://docs.google.com/.../gviz/tq?tqx=out:csv&gid=45498361
 *   OJT_LOG_CSV             https://docs.google.com/.../gviz/tq?tqx=out:csv&gid=85054416
 *
 * MASTER ROSTER TAB COLUMN MAP (GID 45498361) — update if sheet columns change:
 *   A = Full Name       B = USDOL ID        C = Site            D = Region
 *   E = Pearl User ID   F = Current Wage    G = OJT Hours       H = RTI Hours
 *   I = Phase           J = Milestone       K = Apprentice Program Status
 *   L = Start Date      M = Last OJT Entry  N = Program Complete (Y/N)
 *   O = Notes
 */

// ─── SHEET GIDs ───────────────────────────────────────────────────────────────
var GID_MASTER_ROSTER = 45498361;
var GID_OJT_LOG       = 85054416;
var GID_INTAKE        = 2115451937;

// ─── MASTER ROSTER COLUMN INDICES (0-based) ──────────────────────────────────
// Update these if the Master Roster tab column order ever changes.
var MR = {
  NAME:       0,   // Full Name
  DOL_ID:     1,   // USDOL ID
  SITE:       2,   // Site / School
  REGION:     3,   // Region (Northeast / Southwest)
  PEARL_ID:   4,   // Pearl User ID
  WAGE:       5,   // Current Hourly Wage
  OJT_HOURS:  6,   // Cumulative OJT Hours
  RTI_HOURS:  7,   // Cumulative RTI Hours
  PHASE:      8,   // Current Phase (1-4)
  MILESTONE:  9,   // Last Wage Milestone Triggered
  AP_STATUS:  10,  // Apprentice Program Status (Active / Inactive - Prior Apprentice)
  START_DATE: 11,  // Program Start Date
  LAST_OJT:   12,  // Last OJT Log Entry Date
  COMPLETE:   13,  // Program Complete? (Y / blank)
  NOTES:      14,  // Notes
};

// ─── OJT LOG COLUMN INDICES (0-based, GID 85054416) ──────────────────────────
var OJT = {
  TIMESTAMP:   0,   // Timestamp (auto)
  APPRENTICE:  1,   // Apprentice Full Name   (entry.1113592438)
  PHASE:       2,   // Phase                  (entry.2084410404)
  DOMAIN:      3,   // Domain                 (entry.1916953177)
  ACTIVITY:    4,   // Full Activity String   (entry.1818518596)
  COMPLETED:   5,   // OJT Activity Completed (entry.338482221)
  HOURS:       6,   // Hours Logged
  OBSERVER:    7,   // Observer Full Name
  OBS_EMAIL:   8,   // Observer Email Address
  NOTES:       9,   // Additional Notes
};

// ─── WAGE MILESTONE THRESHOLDS ────────────────────────────────────────────────
// OJT hours at which a wage increase notification is triggered.
// Adjust percentages to match the apprenticeship agreement.
// CERT_BONUS ($5/hr) fires at full program completion (4000 OJT + 288 RTI hours).
var WAGE_MILESTONES = [
  { label: 'Milestone 1 — 25% OJT',  hours: 1000, pctIncrease: 0.05 },
  { label: 'Milestone 2 — 50% OJT',  hours: 2000, pctIncrease: 0.05 },
  { label: 'Milestone 3 — 75% OJT',  hours: 3000, pctIncrease: 0.05 },
];
// Program completion uses CERT_BONUS flat-rate increase (from Script Properties).


// ══════════════════════════════════════════════════════════════════════════════
// ██  TRIGGER HANDLERS
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Fires when a new Intake Form application is submitted.
 * Sends notification to ADMIN_EMAIL.
 * Install via installTriggers() — do NOT rename this function.
 */
function onIntakeFormSubmit(e) {
  try {
    var props  = PropertiesService.getScriptProperties().getProperties();
    var vals   = e.values || [];
    var nv     = e.namedValues || {};

    function fv(title) {
      return (nv[title] && nv[title][0]) ? nv[title][0].trim() : '';
    }

    var submittedAt  = vals[0] || new Date().toLocaleString();
    var applicantName = fv('Full Name') || fv('Name') || (vals[1] || '').trim() || '[Name Not Provided]';
    var applicantEmail= fv('Email') || fv('Email Address') || (vals[2] || '').trim() || '';
    var applicantSite = fv('Site') || fv('School') || fv('Site / School') || '';
    var applicantRole = fv('Current Role') || fv('Role') || fv('Position') || '';

    var subject = 'NJTC TAP — New Application: ' + applicantName;
    var body    = _buildIntakeEmailBody(applicantName, applicantEmail, applicantSite, applicantRole, submittedAt, nv, vals);

    GmailApp.sendEmail(props.ADMIN_EMAIL, subject, body);
    Logger.log('Intake notification sent — Applicant: ' + applicantName);

  } catch (err) {
    _sendErrorEmail('onIntakeFormSubmit', err);
  }
}

/**
 * Fires when a new OJT Log Form entry is submitted.
 * Validates observer email, logs entry, updates Master Roster hours,
 * and checks for wage milestones or program completion.
 * Install via installTriggers() — do NOT rename this function.
 */
function onOJTFormSubmit(e) {
  try {
    var vals = e.values || [];
    var nv   = e.namedValues || {};

    function fv(title) {
      return (nv[title] && nv[title][0]) ? nv[title][0].trim() : '';
    }

    var timestamp     = vals[OJT.TIMESTAMP]  || new Date().toISOString();
    var apprenticeName= (vals[OJT.APPRENTICE] || fv('Apprentice Full Name') || '').trim();
    var phase         = (vals[OJT.PHASE]      || fv('Phase') || '').trim();
    var domain        = (vals[OJT.DOMAIN]     || fv('Domain') || '').trim();
    var activity      = (vals[OJT.ACTIVITY]   || fv('Activity') || '').trim();
    var hoursRaw      = vals[OJT.HOURS]       || fv('Hours') || '0';
    var observerName  = (vals[OJT.OBSERVER]   || fv('Observer Name') || '').trim();
    var observerEmail = (vals[OJT.OBS_EMAIL]  || fv('Observer Email') || '').trim().toLowerCase();

    if (!apprenticeName) {
      Logger.log('OJT submission missing apprentice name — skipping.');
      return;
    }

    // ── 1. Validate observer against HR Master List ──
    var validObserver = _validateObserverEmail(observerEmail);
    if (!validObserver) {
      _sendErrorEmail(
        'onOJTFormSubmit — Observer Validation',
        new Error(
          'OJT log submitted by unrecognized observer email: ' + observerEmail +
          '\nApprenticeName: ' + apprenticeName +
          '\nActivity: ' + activity +
          '\nThis entry has been logged but the observer email is not on record as an Active leader in the HR Master List for the current academic year.'
        )
      );
      // Still log the entry — do not delete the form response.
      // Admin is notified to review. We continue to update hours.
    }

    // ── 2. Update Master Roster — add hours, update last entry date ──
    var hoursLogged = parseFloat(hoursRaw) || 0;
    var rosterRow   = _findRosterRow(apprenticeName);

    if (!rosterRow) {
      _sendErrorEmail(
        'onOJTFormSubmit — Roster Lookup',
        new Error(
          'OJT hours logged for "' + apprenticeName + '" but this name was not found in the Master Roster tab.\n' +
          'Hours: ' + hoursLogged + '  |  Phase: ' + phase + '  |  Domain: ' + domain + '\n\n' +
          'Check the Master Roster for a name mismatch (see Build Brief Section 2 for known discrepancies).'
        )
      );
      return;
    }

    var ss       = _getSpreadsheet();
    var rSheet   = _getSheetByGID(ss, GID_MASTER_ROSTER);
    var rowIndex = rosterRow.rowIndex; // 1-based row number in sheet (includes header)
    var row      = rosterRow.data;

    var prevOJTHours = parseFloat(row[MR.OJT_HOURS]) || 0;
    var newOJTHours  = prevOJTHours + hoursLogged;
    var rtiHours     = parseFloat(row[MR.RTI_HOURS]) || 0;
    var prevMilestone= String(row[MR.MILESTONE] || '').trim();

    rSheet.getRange(rowIndex, MR.OJT_HOURS + 1).setValue(newOJTHours);
    rSheet.getRange(rowIndex, MR.LAST_OJT + 1).setValue(new Date());

    // ── 3. Check wage milestones ──
    var props = PropertiesService.getScriptProperties().getProperties();
    var ojtMax = parseFloat(props.OJT_COMPLETION_HOURS) || 4000;
    var rtiMax = parseFloat(props.RTI_COMPLETION_HOURS) || 288;

    var triggeredMilestone = null;
    for (var i = 0; i < WAGE_MILESTONES.length; i++) {
      var m = WAGE_MILESTONES[i];
      if (prevOJTHours < m.hours && newOJTHours >= m.hours) {
        triggeredMilestone = m;
        break;
      }
    }

    if (triggeredMilestone) {
      var prevWage   = parseFloat(row[MR.WAGE]) || 0;
      var newWage    = Math.round((prevWage * (1 + triggeredMilestone.pctIncrease)) * 100) / 100;
      rSheet.getRange(rowIndex, MR.WAGE + 1).setValue(newWage);
      rSheet.getRange(rowIndex, MR.MILESTONE + 1).setValue(triggeredMilestone.label);

      _sendWageMilestoneEmail({
        name:          apprenticeName,
        dolId:         String(row[MR.DOL_ID] || ''),
        site:          String(row[MR.SITE]   || ''),
        region:        String(row[MR.REGION] || ''),
        prevWage:      prevWage,
        newWage:       newWage,
        milestone:     triggeredMilestone.label,
        ojtHours:      newOJTHours,
        rtiHours:      rtiHours,
        effectiveDate: Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'MMMM d, yyyy'),
      });
    }

    // ── 4. Check program completion ──
    var alreadyComplete = String(row[MR.COMPLETE] || '').trim().toUpperCase() === 'Y';
    if (!alreadyComplete && newOJTHours >= ojtMax && rtiHours >= rtiMax) {
      var certBonus = parseFloat(props.CERT_BONUS) || 5.00;
      var prevWage2 = parseFloat(rSheet.getRange(rowIndex, MR.WAGE + 1).getValue()) || 0;
      var newWage2  = Math.round((prevWage2 + certBonus) * 100) / 100;

      rSheet.getRange(rowIndex, MR.WAGE + 1).setValue(newWage2);
      rSheet.getRange(rowIndex, MR.MILESTONE + 1).setValue('Program Completion — Certification Bonus');
      rSheet.getRange(rowIndex, MR.COMPLETE + 1).setValue('Y');
      rSheet.getRange(rowIndex, MR.AP_STATUS + 1).setValue('Inactive - Prior Apprentice');

      _sendCompletionEmail({
        name:          apprenticeName,
        dolId:         String(row[MR.DOL_ID] || ''),
        site:          String(row[MR.SITE]   || ''),
        region:        String(row[MR.REGION] || ''),
        prevWage:      prevWage2,
        newWage:       newWage2,
        milestone:     'Program Completion',
        ojtHours:      newOJTHours,
        rtiHours:      rtiHours,
        effectiveDate: Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'MMMM d, yyyy'),
      });
    }

    Logger.log(
      'OJT entry processed — ' + apprenticeName +
      ' | Hours: +' + hoursLogged + ' (total: ' + newOJTHours + ')' +
      ' | Observer: ' + observerEmail + ' (' + (validObserver ? 'VALID' : 'UNRECOGNIZED') + ')'
    );

  } catch (err) {
    _sendErrorEmail('onOJTFormSubmit', err);
  }
}


// ══════════════════════════════════════════════════════════════════════════════
// ██  WEB APP — CSV ENDPOINT FOR PORTAL JS
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Serves sheet tabs as CSV for portal JS consumption.
 * Deploy as: Execute as Me / Access: Anyone (even anonymous).
 *
 * Query params:
 *   ?tab=master_roster  → Master Roster tab (GID 45498361)
 *   ?tab=ojt_log        → OJT Log tab (GID 85054416)
 *   ?tab=intake         → Intake Responses tab (GID 2115451937)
 */
function doGet(e) {
  try {
    var tab = (e && e.parameter && e.parameter.tab) || 'master_roster';
    var ss  = _getSpreadsheet();
    var sheet;

    if (tab === 'ojt_log') {
      sheet = _getSheetByGID(ss, GID_OJT_LOG);
    } else if (tab === 'intake') {
      sheet = _getSheetByGID(ss, GID_INTAKE);
    } else {
      sheet = _getSheetByGID(ss, GID_MASTER_ROSTER);
    }

    if (!sheet) {
      return ContentService.createTextOutput('Sheet not found: ' + tab)
        .setMimeType(ContentService.MimeType.TEXT);
    }

    return ContentService.createTextOutput(_sheetToCSV(sheet))
      .setMimeType(ContentService.MimeType.CSV);

  } catch (err) {
    Logger.log('doGet error: ' + err.toString());
    return ContentService.createTextOutput('Error: ' + err.toString())
      .setMimeType(ContentService.MimeType.TEXT);
  }
}

/**
 * Receives OJT completion updates from the portal (future use).
 * Body: JSON { apprenticeName, phase, domain, activity, hoursLogged, observerEmail }
 */
function doPost(e) {
  try {
    var payload = JSON.parse(e.postData.contents);

    // Validate required fields
    if (!payload.apprenticeName || !payload.hoursLogged) {
      return ContentService.createTextOutput(JSON.stringify({ ok: false, error: 'Missing required fields' }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    var rosterRow = _findRosterRow(payload.apprenticeName);
    if (!rosterRow) {
      return ContentService.createTextOutput(JSON.stringify({ ok: false, error: 'Apprentice not found: ' + payload.apprenticeName }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // Append to OJT Log tab
    var ss       = _getSpreadsheet();
    var ojtSheet = _getSheetByGID(ss, GID_OJT_LOG);
    ojtSheet.appendRow([
      new Date().toISOString(),
      payload.apprenticeName   || '',
      payload.phase            || '',
      payload.domain           || '',
      payload.activity         || '',
      payload.completed        || '',
      payload.hoursLogged      || 0,
      payload.observerName     || '',
      payload.observerEmail    || '',
      payload.notes            || '',
    ]);

    return ContentService.createTextOutput(JSON.stringify({ ok: true }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    Logger.log('doPost error: ' + err.toString());
    return ContentService.createTextOutput(JSON.stringify({ ok: false, error: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}


// ══════════════════════════════════════════════════════════════════════════════
// ██  PDF EXPORT
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Exports a formatted PDF report of all apprentice OJT progress.
 * Output is emailed to ADMIN_EMAIL and saved to the root of this spreadsheet's Drive folder.
 * Run manually from Apps Script editor → Run → exportOJTReport.
 */
function exportOJTReport() {
  try {
    var props    = PropertiesService.getScriptProperties().getProperties();
    var ss       = _getSpreadsheet();
    var rSheet   = _getSheetByGID(ss, GID_MASTER_ROSTER);
    var ojtSheet = _getSheetByGID(ss, GID_OJT_LOG);

    if (!rSheet || !ojtSheet) {
      throw new Error('Could not find Master Roster or OJT Log tabs.');
    }

    var rData   = rSheet.getDataRange().getValues();
    var ojtData = ojtSheet.getDataRange().getValues();

    // Build a lookup: apprentice name → array of OJT log entries
    var ojtByName = {};
    for (var i = 1; i < ojtData.length; i++) {
      var r    = ojtData[i];
      var name = String(r[OJT.APPRENTICE] || '').trim();
      if (!name) continue;
      if (!ojtByName[name]) ojtByName[name] = [];
      ojtByName[name].push(r);
    }

    // Build the report sheet (create or clear a "OJT Export" tab)
    var exportSheetName = 'OJT Export';
    var exportSheet = ss.getSheetByName(exportSheetName);
    if (exportSheet) {
      exportSheet.clearContents();
      exportSheet.clearFormats();
    } else {
      exportSheet = ss.insertSheet(exportSheetName);
    }

    var C_NAVY  = '#1B3A6B';
    var C_TEAL  = '#1C7C8C';
    var C_GOLD  = '#D4920A';
    var C_WHITE = '#FFFFFF';
    var C_LT    = '#F0F4FA';

    var row = 1;

    // Title
    exportSheet.setRowHeight(row, 48);
    var titleRange = exportSheet.getRange(row, 1, 1, 8);
    titleRange.merge()
      .setValue('NJTC TAP — OJT Progress Report  ·  SY 2025–2026')
      .setBackground(C_NAVY).setFontColor(C_WHITE)
      .setFontWeight('bold').setFontSize(14)
      .setHorizontalAlignment('center').setVerticalAlignment('middle')
      .setFontFamily('Arial');
    row++;

    var subRange = exportSheet.getRange(row, 1, 1, 8);
    subRange.merge()
      .setValue('Generated: ' + new Date().toLocaleString() + '  ·  ' +
                'OJT Target: ' + (props.OJT_COMPLETION_HOURS || 4000) + ' hrs  ·  ' +
                'RTI Target: ' + (props.RTI_COMPLETION_HOURS || 288) + ' hrs')
      .setBackground(C_TEAL).setFontColor(C_WHITE).setFontSize(9)
      .setHorizontalAlignment('center').setVerticalAlignment('middle')
      .setFontFamily('Arial');
    row++;

    exportSheet.setRowHeight(row, 5);
    exportSheet.getRange(row, 1, 1, 8).merge().setBackground(C_GOLD);
    row++;

    // Summary header
    var hdrRow = row;
    exportSheet.setRowHeight(hdrRow, 28);
    var headers = ['Full Name', 'USDOL ID', 'Site', 'Region', 'OJT Hours', 'RTI Hours', 'Phase', 'Status'];
    headers.forEach(function(h, i) {
      exportSheet.getRange(hdrRow, i + 1)
        .setValue(h)
        .setBackground(C_NAVY).setFontColor(C_WHITE)
        .setFontWeight('bold').setFontSize(9)
        .setHorizontalAlignment('center').setVerticalAlignment('middle')
        .setFontFamily('Arial');
    });
    row++;

    // Apprentice summary rows (skip header row in master roster)
    var ojtMax = parseFloat(props.OJT_COMPLETION_HOURS) || 4000;
    var rtiMax = parseFloat(props.RTI_COMPLETION_HOURS) || 288;

    for (var ri = 1; ri < rData.length; ri++) {
      var rd = rData[ri];
      if (!rd[MR.NAME] || String(rd[MR.NAME]).trim() === '') continue;

      var name     = String(rd[MR.NAME]).trim();
      var ojtHours = parseFloat(rd[MR.OJT_HOURS]) || 0;
      var rtiH     = parseFloat(rd[MR.RTI_HOURS])  || 0;
      var complete = String(rd[MR.COMPLETE] || '').trim().toUpperCase() === 'Y';
      var statusStr= complete ? 'Complete' : (ojtHours >= ojtMax * 0.75 ? '75%+' : ojtHours >= ojtMax * 0.5 ? '50%+' : ojtHours >= ojtMax * 0.25 ? '25%+' : 'In Progress');
      var bg       = ri % 2 === 0 ? C_LT : C_WHITE;

      exportSheet.setRowHeight(row, 18);
      var rowData = [
        name,
        String(rd[MR.DOL_ID] || ''),
        String(rd[MR.SITE]   || ''),
        String(rd[MR.REGION] || ''),
        ojtHours + ' / ' + ojtMax,
        rtiH     + ' / ' + rtiMax,
        String(rd[MR.PHASE]  || ''),
        statusStr,
      ];
      rowData.forEach(function(val, ci) {
        var cell = exportSheet.getRange(row, ci + 1);
        cell.setValue(val).setBackground(bg).setFontSize(9)
          .setFontFamily('Arial').setVerticalAlignment('middle');
        if (ci === 0) cell.setFontWeight('bold');
        if (ci === 4 || ci === 5) cell.setHorizontalAlignment('center');
      });

      if (complete) {
        exportSheet.getRange(row, 8).setBackground('#D5F5E3').setFontColor('#1A7A4A').setFontWeight('bold');
      }

      row++;

      // Per-apprentice OJT log entries (collapsible detail section)
      var entries = ojtByName[name] || [];
      if (entries.length > 0) {
        exportSheet.setRowHeight(row, 18);
        var detailHdr = exportSheet.getRange(row, 1, 1, 8);
        detailHdr.merge()
          .setValue('    OJT Log Entries (' + entries.length + ' submissions):')
          .setBackground(C_LT).setFontColor(C_TEAL)
          .setFontSize(8).setFontStyle('italic').setFontFamily('Arial')
          .setVerticalAlignment('middle');
        row++;

        entries.forEach(function(entry) {
          exportSheet.setRowHeight(row, 16);
          var ts      = entry[OJT.TIMESTAMP] ? String(entry[OJT.TIMESTAMP]).substring(0, 10) : '';
          var entryBg = '#FAFBFD';
          var detailData = [
            '        ' + ts,
            String(entry[OJT.PHASE]    || ''),
            String(entry[OJT.DOMAIN]   || ''),
            String(entry[OJT.ACTIVITY] || '').substring(0, 60),
            (entry[OJT.HOURS] || 0) + ' hrs',
            String(entry[OJT.OBSERVER] || ''),
            String(entry[OJT.OBS_EMAIL]|| ''),
            String(entry[OJT.COMPLETED]|| ''),
          ];
          detailData.forEach(function(val, ci) {
            exportSheet.getRange(row, ci + 1)
              .setValue(val).setBackground(entryBg)
              .setFontSize(8).setFontFamily('Arial')
              .setFontColor('#666666').setVerticalAlignment('middle');
          });
          row++;
        });

        // Spacer
        exportSheet.setRowHeight(row, 6);
        exportSheet.getRange(row, 1, 1, 8).merge().setBackground(C_WHITE);
        row++;
      }
    }

    // Footer
    exportSheet.setRowHeight(row, 5);
    exportSheet.getRange(row, 1, 1, 8).merge().setBackground(C_GOLD);
    row++;
    exportSheet.setRowHeight(row, 18);
    exportSheet.getRange(row, 1, 1, 8).merge()
      .setValue('NJTC Impact Solutions Group  ·  TAP Portal  ·  SY 2025–2026  ·  Confidential')
      .setBackground(C_NAVY).setFontColor('#9EC5E8')
      .setFontSize(8).setHorizontalAlignment('center')
      .setFontStyle('italic').setFontFamily('Arial');

    // Fit columns
    for (var c = 1; c <= 8; c++) exportSheet.autoResizeColumn(c);

    SpreadsheetApp.flush();

    // ── Export as PDF ──
    var ssId      = props.SHEET_ID;
    var exportGid = exportSheet.getSheetId();
    var pdfUrl    = 'https://docs.google.com/spreadsheets/d/' + ssId +
                    '/export?format=pdf' +
                    '&gid=' + exportGid +
                    '&size=letter&portrait=false&fitw=true' +
                    '&gridlines=false&printtitle=false&sheetnames=false';

    var token    = ScriptApp.getOAuthToken();
    var response = UrlFetchApp.fetch(pdfUrl, {
      headers: { Authorization: 'Bearer ' + token },
      muteHttpExceptions: true,
    });

    if (response.getResponseCode() !== 200) {
      throw new Error('PDF export failed — HTTP ' + response.getResponseCode());
    }

    var pdfBlob = response.getBlob().setName(
      'NJTC TAP OJT Report ' + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd') + '.pdf'
    );

    // Save to Drive alongside the spreadsheet
    var file = DriveApp.createFile(pdfBlob);
    Logger.log('PDF saved: ' + file.getUrl());

    // Email to admin
    GmailApp.sendEmail(
      props.ADMIN_EMAIL,
      'NJTC TAP — OJT Progress Report ' + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'MMMM d, yyyy'),
      'OJT Progress Report attached.\n\nGenerated: ' + new Date().toLocaleString() +
      '\nDrive link: ' + file.getUrl() +
      '\n\nNJTC Impact Solutions Group · TAP Portal',
      { attachments: [pdfBlob] }
    );

    _safeAlert('✅ OJT Report exported!\n\nPDF saved to Drive and emailed to ' + props.ADMIN_EMAIL + '\n\nDrive: ' + file.getUrl());

  } catch (err) {
    _sendErrorEmail('exportOJTReport', err);
    _safeAlert('❌ Export failed: ' + err.toString());
  }
}


// ══════════════════════════════════════════════════════════════════════════════
// ██  MANUAL MILESTONE SCAN
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Manually scans all Active apprentices in the Master Roster for any
 * uncrossed wage milestones or program completion.
 * Run from Apps Script editor when needed (e.g., after a bulk hours import).
 */
function runMilestoneCheck() {
  try {
    var props  = PropertiesService.getScriptProperties().getProperties();
    var ss     = _getSpreadsheet();
    var rSheet = _getSheetByGID(ss, GID_MASTER_ROSTER);
    if (!rSheet) throw new Error('Master Roster tab not found.');

    var data   = rSheet.getDataRange().getValues();
    var ojtMax = parseFloat(props.OJT_COMPLETION_HOURS) || 4000;
    var rtiMax = parseFloat(props.RTI_COMPLETION_HOURS) || 288;
    var certBonus = parseFloat(props.CERT_BONUS) || 5.00;
    var triggered = 0;

    for (var i = 1; i < data.length; i++) {
      var row      = data[i];
      var name     = String(row[MR.NAME] || '').trim();
      var apStatus = String(row[MR.AP_STATUS] || '').trim();
      if (!name || apStatus !== 'Active') continue;

      var ojtHours     = parseFloat(row[MR.OJT_HOURS]) || 0;
      var rtiHours     = parseFloat(row[MR.RTI_HOURS]) || 0;
      var lastMilestone= String(row[MR.MILESTONE] || '').trim();
      var currentWage  = parseFloat(row[MR.WAGE]) || 0;
      var complete     = String(row[MR.COMPLETE] || '').trim().toUpperCase() === 'Y';
      var rowIndex     = i + 1; // 1-based

      // Check each wage milestone
      for (var m = 0; m < WAGE_MILESTONES.length; m++) {
        var milestone = WAGE_MILESTONES[m];
        if (ojtHours >= milestone.hours && lastMilestone !== milestone.label &&
            lastMilestone.indexOf('Milestone ' + (m + 1)) < 0) {
          var prevWage = currentWage;
          var newWage  = Math.round((prevWage * (1 + milestone.pctIncrease)) * 100) / 100;
          rSheet.getRange(rowIndex, MR.WAGE + 1).setValue(newWage);
          rSheet.getRange(rowIndex, MR.MILESTONE + 1).setValue(milestone.label);
          currentWage = newWage;

          _sendWageMilestoneEmail({
            name:          name,
            dolId:         String(row[MR.DOL_ID] || ''),
            site:          String(row[MR.SITE]   || ''),
            region:        String(row[MR.REGION] || ''),
            prevWage:      prevWage,
            newWage:       newWage,
            milestone:     milestone.label,
            ojtHours:      ojtHours,
            rtiHours:      rtiHours,
            effectiveDate: Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'MMMM d, yyyy'),
          });
          triggered++;
          break; // only trigger one milestone per scan per apprentice
        }
      }

      // Check program completion
      if (!complete && ojtHours >= ojtMax && rtiHours >= rtiMax) {
        var prevWage3 = parseFloat(rSheet.getRange(rowIndex, MR.WAGE + 1).getValue()) || currentWage;
        var newWage3  = Math.round((prevWage3 + certBonus) * 100) / 100;
        rSheet.getRange(rowIndex, MR.WAGE + 1).setValue(newWage3);
        rSheet.getRange(rowIndex, MR.MILESTONE + 1).setValue('Program Completion — Certification Bonus');
        rSheet.getRange(rowIndex, MR.COMPLETE + 1).setValue('Y');
        rSheet.getRange(rowIndex, MR.AP_STATUS + 1).setValue('Inactive - Prior Apprentice');

        _sendCompletionEmail({
          name:          name,
          dolId:         String(row[MR.DOL_ID] || ''),
          site:          String(row[MR.SITE]   || ''),
          region:        String(row[MR.REGION] || ''),
          prevWage:      prevWage3,
          newWage:       newWage3,
          milestone:     'Program Completion',
          ojtHours:      ojtHours,
          rtiHours:      rtiHours,
          effectiveDate: Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'MMMM d, yyyy'),
        });
        triggered++;
      }
    }

    SpreadsheetApp.flush();
    _safeAlert('✅ Milestone check complete.\n' + triggered + ' milestone(s) triggered and emailed.');
    Logger.log('runMilestoneCheck complete — ' + triggered + ' milestones triggered.');

  } catch (err) {
    _sendErrorEmail('runMilestoneCheck', err);
  }
}


// ══════════════════════════════════════════════════════════════════════════════
// ██  EMAIL SENDERS
// ══════════════════════════════════════════════════════════════════════════════

function _sendWageMilestoneEmail(d) {
  var props = PropertiesService.getScriptProperties().getProperties();

  var subject = 'NJTC TAP — Wage Increase Required: ' + d.name;
  var body    = [
    'A TAP apprentice has crossed a wage milestone and is due a wage increase.',
    '',
    '━━━━━━━━━━━━━━━━━━━━',
    'APPRENTICE DETAILS',
    '━━━━━━━━━━━━━━━━━━━━',
    'Full Name:       ' + d.name,
    'USDOL ID:        ' + d.dolId,
    'Site:            ' + d.site,
    'Region:          ' + d.region,
    '',
    '━━━━━━━━━━━━━━━━━━━━',
    'WAGE CHANGE',
    '━━━━━━━━━━━━━━━━━━━━',
    'Previous Wage:   $' + d.prevWage.toFixed(2) + '/hr',
    'New Wage:        $' + d.newWage.toFixed(2) + '/hr',
    'Milestone:       ' + d.milestone,
    'Effective Date:  ' + d.effectiveDate,
    '',
    '━━━━━━━━━━━━━━━━━━━━',
    'PROGRAM PROGRESS',
    '━━━━━━━━━━━━━━━━━━━━',
    'OJT Hours:       ' + d.ojtHours + ' hrs (target: ' + (props.OJT_COMPLETION_HOURS || 4000) + ')',
    'RTI Hours:       ' + d.rtiHours + ' hrs (target: ' + (props.RTI_COMPLETION_HOURS || 288) + ')',
    '',
    'Action Required: Please process this wage adjustment in payroll by the effective date.',
    '',
    'NJTC Impact Solutions Group · TAP Portal · Automated Notification',
  ].join('\n');

  var toList = [
    props.FINANCE_EMAIL_1,
    props.FINANCE_EMAIL_2,
    props.FINANCE_EMAIL_3,
  ].filter(function(e) { return e && e.indexOf('@') !== -1; }).join(',');

  var ccList = [
    props.TD_EMAIL_1,
    props.TD_EMAIL_2,
  ].filter(function(e) { return e && e.indexOf('@') !== -1; }).join(',');

  if (toList) {
    GmailApp.sendEmail(toList, subject, body, {
      cc:  ccList || undefined,
      bcc: props.ADMIN_EMAIL || undefined,
    });
  }

  Logger.log('Wage milestone email sent — ' + d.name + ' | ' + d.milestone + ' | $' + d.prevWage + ' → $' + d.newWage);
}

function _sendCompletionEmail(d) {
  var props = PropertiesService.getScriptProperties().getProperties();

  var subject = 'NJTC TAP — Program Completion: ' + d.name;
  var body    = [
    'A TAP apprentice has completed the full program requirements and is eligible for the certification wage bonus.',
    '',
    '━━━━━━━━━━━━━━━━━━━━',
    'APPRENTICE DETAILS',
    '━━━━━━━━━━━━━━━━━━━━',
    'Full Name:       ' + d.name,
    'USDOL ID:        ' + d.dolId,
    'Site:            ' + d.site,
    'Region:          ' + d.region,
    '',
    '━━━━━━━━━━━━━━━━━━━━',
    'PROGRAM COMPLETION — WAGE CHANGE',
    '━━━━━━━━━━━━━━━━━━━━',
    'Previous Wage:   $' + d.prevWage.toFixed(2) + '/hr',
    'New Wage:        $' + d.newWage.toFixed(2) + '/hr  (+$' + parseFloat(props.CERT_BONUS || 5).toFixed(2) + ' certification bonus)',
    'Milestone:       ' + d.milestone,
    'Effective Date:  ' + d.effectiveDate,
    '',
    '━━━━━━━━━━━━━━━━━━━━',
    'COMPLETION SUMMARY',
    '━━━━━━━━━━━━━━━━━━━━',
    'OJT Hours:       ' + d.ojtHours + ' hrs ✔  (target: ' + (props.OJT_COMPLETION_HOURS || 4000) + ')',
    'RTI Hours:       ' + d.rtiHours + ' hrs ✔  (target: ' + (props.RTI_COMPLETION_HOURS || 288) + ')',
    '',
    'This apprentice has fulfilled all NJ DOL Registered Apprenticeship requirements.',
    'Action Required: Process certification wage bonus in payroll by the effective date.',
    'Note: Apprentice status has been updated to "Inactive - Prior Apprentice" in the Master Roster.',
    '',
    'NJTC Impact Solutions Group · TAP Portal · Automated Notification',
  ].join('\n');

  var toList = [
    props.FINANCE_EMAIL_1,
    props.FINANCE_EMAIL_2,
    props.FINANCE_EMAIL_3,
  ].filter(function(e) { return e && e.indexOf('@') !== -1; }).join(',');

  var ccList = [
    props.TD_EMAIL_1,
    props.TD_EMAIL_2,
  ].filter(function(e) { return e && e.indexOf('@') !== -1; }).join(',');

  if (toList) {
    GmailApp.sendEmail(toList, subject, body, {
      cc:  ccList || undefined,
      bcc: props.ADMIN_EMAIL || undefined,
    });
  }

  Logger.log('Program completion email sent — ' + d.name);
}

function _sendErrorEmail(fnName, err) {
  try {
    var props   = PropertiesService.getScriptProperties().getProperties();
    var adminEmail = props.ADMIN_EMAIL || 'amir@njtutoringcorps.org';
    GmailApp.sendEmail(
      adminEmail,
      'NJTC TAP Script Error: ' + fnName,
      'An error occurred in the TAP Apps Script.\n\n' +
      'Function: ' + fnName + '\n' +
      'Error:    ' + err.toString() + '\n\n' +
      'Stack:\n' + (err.stack || 'Not available') + '\n\n' +
      'Time: ' + new Date().toISOString() + '\n\n' +
      'Review the script execution log for more detail:\n' +
      'Extensions → Apps Script → Executions'
    );
  } catch (emailErr) {
    Logger.log('CRITICAL: Could not send error email. Original error: ' + err.toString() + ' | Email error: ' + emailErr.toString());
  }
  Logger.log('Error in ' + fnName + ': ' + err.toString());
}


// ══════════════════════════════════════════════════════════════════════════════
// ██  VALIDATION HELPERS
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Validates that an observer email belongs to an Active leader
 * in the HR Master List for the current academic year.
 * Returns true if valid, false if not found or not a leader.
 */
function _validateObserverEmail(observerEmail) {
  if (!observerEmail || observerEmail.indexOf('@') < 0) return false;

  try {
    var props         = PropertiesService.getScriptProperties().getProperties();
    var hrCsvUrl      = props.HR_MASTER_CSV_URL;
    var academicYear  = props.ACADEMIC_YEAR || '2025-2026';

    if (!hrCsvUrl) {
      Logger.log('HR_MASTER_CSV_URL not set — skipping observer validation.');
      return true; // fail open until URL is configured
    }

    var hrData = _fetchCSV(hrCsvUrl);
    if (!hrData || hrData.length < 2) {
      Logger.log('HR Master List CSV empty or unreachable.');
      return true; // fail open
    }

    // Parse header row to find column indices
    var header     = hrData[0].map(function(h) { return String(h).trim(); });
    var colYear    = header.indexOf('Academic Year');
    var colEmail   = header.indexOf('Email Address');
    var colStatus  = header.indexOf('Active / Terminated Status');
    var colRole    = header.indexOf('Position / Role');

    if (colEmail < 0 || colStatus < 0) {
      Logger.log('HR Master List missing required columns — skipping validation.');
      return true; // fail open
    }

    var normalEmail = observerEmail.trim().toLowerCase();

    for (var i = 1; i < hrData.length; i++) {
      var row = hrData[i];
      if (colYear >= 0 && String(row[colYear] || '').trim() !== academicYear) continue;
      if (String(row[colStatus] || '').trim() !== 'Active') continue;
      var rowEmail = String(row[colEmail] || '').trim().toLowerCase();
      if (rowEmail !== normalEmail) continue;

      // Email matched — check role
      var role = String(row[colRole] || '').trim();
      if (_isLeaderRole(role)) return true;

      Logger.log('Observer email matched but role "' + role + '" is not a leader role.');
      return false;
    }

    Logger.log('Observer email not found in HR Master List: ' + observerEmail);
    return false;

  } catch (err) {
    Logger.log('_validateObserverEmail error: ' + err.toString() + ' — failing open.');
    return true; // fail open on network/parse errors
  }
}

/**
 * Returns true if the given Position / Role string maps to LEADER VIEW.
 * Must match exactly per HR Final Patch Section 2.
 */
function _isLeaderRole(role) {
  var leaderRoles = [
    'Instructional Coach',
    'Certified - Instructional Coach',
    'Site Coordinator',
    'Certified - Site Coordinator',
    'Site Coordinator / Tutor',
    'Dual Role',
    'Instructional Coach/ Site Coordinator Dual',
    'Master Trainer',
    'Central Team',
  ];
  return leaderRoles.indexOf(role) !== -1;
}

/**
 * Finds the matching row in the Master Roster by apprentice name.
 * Returns { rowIndex (1-based), data } or null if not found.
 * Case-insensitive, trimmed match.
 */
function _findRosterRow(apprenticeName) {
  var ss     = _getSpreadsheet();
  var rSheet = _getSheetByGID(ss, GID_MASTER_ROSTER);
  if (!rSheet) return null;

  var data       = rSheet.getDataRange().getValues();
  var nameLower  = apprenticeName.trim().toLowerCase();

  for (var i = 1; i < data.length; i++) {
    var rowName = String(data[i][MR.NAME] || '').trim().toLowerCase();
    if (rowName === nameLower) {
      return { rowIndex: i + 1, data: data[i] };
    }
  }
  return null;
}


// ══════════════════════════════════════════════════════════════════════════════
// ██  UTILITY HELPERS
// ══════════════════════════════════════════════════════════════════════════════

function _getSpreadsheet() {
  var props = PropertiesService.getScriptProperties().getProperties();
  var id    = props.SHEET_ID;
  return id ? SpreadsheetApp.openById(id) : SpreadsheetApp.getActiveSpreadsheet();
}

function _getSheetByGID(ss, gid) {
  var sheets = ss.getSheets();
  for (var i = 0; i < sheets.length; i++) {
    if (sheets[i].getSheetId() === gid) return sheets[i];
  }
  return null;
}

/**
 * Fetches a published CSV URL and parses it into a 2D array.
 */
function _fetchCSV(url) {
  var response = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
  if (response.getResponseCode() !== 200) return null;
  var text = response.getContentText();
  return Utilities.parseCsv(text);
}

/**
 * Converts a sheet to CSV text, safely quoting cells with commas, quotes, or newlines.
 */
function _sheetToCSV(sheet) {
  var tz   = Session.getScriptTimeZone();
  var data = sheet.getDataRange().getValues();
  return data.map(function(row) {
    return row.map(function(cell) {
      var str = cell instanceof Date
        ? Utilities.formatDate(cell, tz, 'M/d/yyyy HH:mm:ss')
        : String(cell);
      if (str.indexOf(',') !== -1 || str.indexOf('"') !== -1 || str.indexOf('\n') !== -1) {
        return '"' + str.replace(/"/g, '""') + '"';
      }
      return str;
    }).join(',');
  }).join('\n');
}

function _buildIntakeEmailBody(name, email, site, role, submittedAt, nv, vals) {
  var lines = [
    'A new TAP apprenticeship application has been submitted.',
    '',
    '━━━━━━━━━━━━━━━━━━━━',
    'APPLICANT',
    '━━━━━━━━━━━━━━━━━━━━',
    'Name:            ' + name,
    'Email:           ' + (email || 'Not provided'),
    'Site / School:   ' + (site  || 'Not provided'),
    'Current Role:    ' + (role  || 'Not provided'),
    'Submitted:       ' + submittedAt,
  ];

  // Append all named values for full context
  lines.push('');
  lines.push('━━━━━━━━━━━━━━━━━━━━');
  lines.push('FULL APPLICATION RESPONSES');
  lines.push('━━━━━━━━━━━━━━━━━━━━');
  Object.keys(nv).forEach(function(key) {
    var val = (nv[key] && nv[key][0]) ? nv[key][0].trim() : '';
    if (val) lines.push(key + ':\n  ' + val);
  });

  lines.push('');
  lines.push('View full responses in the Intake Responses tab of the Master Workbook.');
  lines.push('NJTC Impact Solutions Group · TAP Portal · Automated Notification');

  return lines.join('\n');
}

function _safeAlert(msg) {
  try { SpreadsheetApp.getUi().alert(msg); } catch (e) { Logger.log(msg); }
}


// ══════════════════════════════════════════════════════════════════════════════
// ██  TRIGGER INSTALLATION
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Installs all required form submit triggers.
 * Run once after deploying this script to the Master Workbook.
 *
 * Steps:
 *   1. Open Extensions → Apps Script in the Master Workbook
 *   2. Paste this script
 *   3. Set all Script Properties (Project Settings → Script Properties)
 *   4. Run → installTriggers
 *   5. Authorize the required permissions
 *   6. Deploy as Web App (Execute as Me / Access: Anyone) for the doGet/doPost endpoints
 */
function installTriggers() {
  // Remove all existing triggers to avoid duplicates
  ScriptApp.getProjectTriggers().forEach(function(t) {
    ScriptApp.deleteTrigger(t);
  });

  var props         = PropertiesService.getScriptProperties().getProperties();
  var intakeFormId  = props.INTAKE_FORM_ID;
  var ojtFormId     = props.OJT_FORM_ID;

  if (!intakeFormId || !ojtFormId) {
    _safeAlert(
      '⚠️ Missing Script Properties!\n\n' +
      'Please set INTAKE_FORM_ID and OJT_FORM_ID in Script Properties before installing triggers.\n\n' +
      'Project Settings → Script Properties'
    );
    return;
  }

  // Intake form trigger
  ScriptApp.newTrigger('onIntakeFormSubmit')
    .forForm(intakeFormId)
    .onFormSubmit()
    .create();

  // OJT Log form trigger
  ScriptApp.newTrigger('onOJTFormSubmit')
    .forForm(ojtFormId)
    .onFormSubmit()
    .create();

  Logger.log('Triggers installed: onIntakeFormSubmit + onOJTFormSubmit');
  _safeAlert(
    '✅ Triggers installed!\n\n' +
    'onIntakeFormSubmit → Intake Form (' + intakeFormId + ')\n' +
    'onOJTFormSubmit    → OJT Log Form (' + ojtFormId + ')\n\n' +
    'Next step: Deploy as Web App for the CSV endpoint.\n' +
    'Deploy → New Deployment → Web App\n' +
    'Execute as: Me | Access: Anyone (even anonymous)'
  );
}


// ══════════════════════════════════════════════════════════════════════════════
// ██  OJT PRE-FILL URL GENERATOR
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Generates a pre-filled OJT Log Google Form URL for a given apprentice, phase, domain, and activity.
 * Call this from portal JS or use as a utility to build links for leaders.
 *
 * Form entry IDs (from Build Brief v3 FINAL):
 *   entry.338482221  = OJT Activity completion
 *   entry.1113592438 = Apprentice Full Name
 *   entry.2084410404 = Phase string
 *   entry.1916953177 = Domain
 *   entry.1818518596 = Full activity string
 */
function buildOJTFormURL(apprenticeName, phase, domain, activity, completed) {
  var base = 'https://docs.google.com/forms/d/1MOsppwhQmagAhVSHs29Ms4o9Ky4xYOyqy8Qs4uTrwbQ/viewform';
  var params = [
    'entry.1113592438=' + encodeURIComponent(apprenticeName || ''),
    'entry.2084410404=' + encodeURIComponent(phase          || ''),
    'entry.1916953177=' + encodeURIComponent(domain         || ''),
    'entry.1818518596=' + encodeURIComponent(activity       || ''),
    'entry.338482221='  + encodeURIComponent(completed      || ''),
  ];
  return base + '?' + params.join('&');
}

/**
 * Quick test — run from the editor to verify URL generation.
 */
function testBuildOJTFormURL() {
  var url = buildOJTFormURL('Aliviyah Goodson', 'Phase 1', 'Instructional Delivery', 'Delivered a structured lesson using iReady materials', 'Yes');
  Logger.log('Pre-fill URL: ' + url);
}
