/**
 * NJTC HR Email Notification Script — v5
 * CHANGES FROM v4:
 *   doGet() now supports ?tab=resolutions → Concern Resolutions sheet tab.
 *   doPost() added — receives HR resolution payloads from the portal and
 *   appends them to the "Concern Resolutions" tab (creates tab if needed).
 *   This powers the Support Log index resolution workflow.
 */

// ── Spreadsheet config ────────────────────────────────────────────────────────
const SPREADSHEET_ID    = '1IZSYmLgMddPtn5Ei9mehqTWJAbpcm5Tx1GL-YytLj0k';
const CONCERN_SHEET_GID = 274671201;   // "Performance Concern Form" tab
const REVIEWS_SHEET_GID = 63958401;   // "Monthly Site Leader Reviews" tab

// ── Core HR Recipient ────────────────────────────────────────────────────────
const HR_EMAIL = 'dalitza@njtutoringcorps.org';

// ── Management Recipients ─────────────────────────────────────────────────────
const MANAGEMENT_EMAILS = [
  'mariely@njtutoringcorps.org',
  'pettya@njtutoringcorps.org',
];

// ── Regional Program Manager Pairs ───────────────────────────────────────────
const REGIONS = {
  NE: ['taneisha@njtutoringcorps.org', 'jenny@njtutoringcorps.org'],
  SW: ['tierney@njtutoringcorps.org',  'andrea@njtutoringcorps.org'],
};

// ── Site → Region Mapping ─────────────────────────────────────────────────────
const SITE_REGION_MAP = [
  { match: 'ilearn',         region: 'NE' },
  { match: 'paterson',       region: 'NE' },
  { match: 'pcsst',          region: 'NE' },
  { match: 'hoboken',        region: 'NE' },
  { match: 'hola',           region: 'NE' },
  { match: 'middlesex',      region: 'NE' },
  { match: 'stem',           region: 'NE' },
  { match: 'central jersey', region: 'NE' },
  { match: 'penns grove',        region: 'SW' },
  { match: 'p.w. carleton',      region: 'SW' },
  { match: 'field street',       region: 'SW' },
  { match: 'carleton',           region: 'SW' },
  { match: 'gloucester',         region: 'SW' },
  { match: 'global leadership',  region: 'SW' },
  { match: 'glaw',               region: 'SW' },
  { match: 'string theory',      region: 'SW' },
  { match: 'american paradigm',  region: 'SW' },
  { match: 'first philadelphia', region: 'SW' },
  { match: 'hamilton',           region: 'SW' },
  { match: 'haddon',             region: 'SW' },
  { match: 'waterford',          region: 'SW' },
  { match: 'atco',               region: 'SW' },
  { match: 'monmouth',           region: 'SW' },
  { match: 'pemberton',          region: 'SW' },
  { match: 'riverton',           region: 'SW' },
  { match: 'lawrence',           region: 'SW' },
  { match: 'salem',              region: 'SW' },
  { match: 'clinton',            region: 'SW' },
];

// ── Web App: CSV endpoint ─────────────────────────────────────────────────────
// Serves sheet tabs as CSV, bypassing Google Workspace pub?output=csv restrictions.
// Deploy as: Execute as Me / Who has access: Anyone (even anonymous)
//
// Usage:
//   ?tab=concerns    → Performance Concern Form tab (gid 274671201)  [default]
//   ?tab=reviews     → Monthly Site Leader Reviews tab (gid 63958401)
//   ?tab=resolutions → Concern Resolutions tab (created by doPost on first resolve)
function doGet(e) {
  try {
    var tab = (e && e.parameter && e.parameter.tab) || 'concerns';
    var ss  = SpreadsheetApp.openById(SPREADSHEET_ID);
    var sheet;

    if (tab === 'resolutions') {
      sheet = ss.getSheetByName('Concern Resolutions');
      if (!sheet) {
        // Return empty CSV with headers if the tab doesn't exist yet
        return ContentService.createTextOutput('concern_ts,resolved_by,resolved_by_email,reason,resolved_at')
          .setMimeType(ContentService.MimeType.CSV);
      }
    } else if (tab === 'reviews') {
      sheet = ss.getSheets().filter(function(s) { return s.getSheetId() === REVIEWS_SHEET_GID; })[0];
    } else {
      sheet = ss.getSheets().filter(function(s) { return s.getSheetId() === CONCERN_SHEET_GID; })[0];
    }

    if (!sheet) {
      return ContentService.createTextOutput('Sheet not found: ' + tab)
        .setMimeType(ContentService.MimeType.TEXT);
    }

    var tz   = Session.getScriptTimeZone();
    var data = sheet.getDataRange().getValues();

    var csv = data.map(function(row) {
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

    return ContentService.createTextOutput(csv)
      .setMimeType(ContentService.MimeType.CSV);

  } catch (err) {
    return ContentService.createTextOutput('Error: ' + err.toString())
      .setMimeType(ContentService.MimeType.TEXT);
  }
}

// ── Web App: Resolution POST endpoint ────────────────────────────────────────
// Receives HR resolution payloads from the portal Support Log index.
// Body: JSON string with { concern_ts, resolved_by, resolved_by_email, reason, resolved_at }
// Portal uses mode:'no-cors' so response is opaque — portal updates UI optimistically.
function doPost(e) {
  try {
    var payload = JSON.parse(e.postData.contents);
    var ss      = SpreadsheetApp.openById(SPREADSHEET_ID);
    var sheet   = ss.getSheetByName('Concern Resolutions');

    if (!sheet) {
      sheet = ss.insertSheet('Concern Resolutions');
      sheet.appendRow(['concern_ts', 'resolved_by', 'resolved_by_email', 'reason', 'resolved_at']);
      sheet.setFrozenRows(1);
    }

    sheet.appendRow([
      payload.concern_ts        || '',
      payload.resolved_by       || '',
      payload.resolved_by_email || '',
      payload.reason            || '',
      payload.resolved_at       || new Date().toISOString()
    ]);

    return ContentService.createTextOutput(JSON.stringify({ ok: true }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    Logger.log('doPost error: ' + err.toString());
    return ContentService.createTextOutput(JSON.stringify({ ok: false, error: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function detectRegion(site) {
  if (!site) return null;
  var lower = site.toLowerCase();
  for (var i = 0; i < SITE_REGION_MAP.length; i++) {
    if (lower.indexOf(SITE_REGION_MAP[i].match) !== -1) return SITE_REGION_MAP[i].region;
  }
  return null;
}

function normalizeEmail(e) {
  return (e || '').trim().toLowerCase();
}

function isKnownPM(email) {
  var e = normalizeEmail(email);
  return REGIONS.NE.map(normalizeEmail).indexOf(e) !== -1 ||
         REGIONS.SW.map(normalizeEmail).indexOf(e) !== -1;
}

function getRegionForPM(email) {
  var e = normalizeEmail(email);
  if (REGIONS.NE.map(normalizeEmail).indexOf(e) !== -1) return 'NE';
  if (REGIONS.SW.map(normalizeEmail).indexOf(e) !== -1) return 'SW';
  return null;
}

function getPartner(submitterEmail) {
  var e = normalizeEmail(submitterEmail);
  var keys = Object.keys(REGIONS);
  for (var i = 0; i < keys.length; i++) {
    var pair = REGIONS[keys[i]];
    var lc   = pair.map(normalizeEmail);
    if (lc.indexOf(e) !== -1) return pair.filter(function(p) { return normalizeEmail(p) !== e; })[0];
  }
  return null;
}

// ── Trigger Install ───────────────────────────────────────────────────────────
function installTrigger() {
  ScriptApp.getProjectTriggers().forEach(function(t) { ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('onFormSubmit')
    .forSpreadsheet(SpreadsheetApp.getActiveSpreadsheet())
    .onFormSubmit()
    .create();
  Logger.log('Trigger installed successfully.');
}

// ── Main Form Submit Handler ──────────────────────────────────────────────────
function onFormSubmit(e) {
  try {
    var nv   = e.namedValues;
    var vals = e.values;   // positional fallback — same order as sheet columns

    // Read by question title for fields whose titles are stable and confirmed working
    function v(title) {
      return (nv[title] && nv[title][0]) ? nv[title][0].trim() : '';
    }

    var submittedAt = vals[0] || 'N/A';

    // These three read by column index — question titles have minor mismatches
    // that cause v() to return empty. Indices confirmed from portal CSV parser:
    //   col C (2) = submitter name, col F (5) = employee name, col Q (16) = history
    var submitterName   = (vals[2]  || '').trim() || 'N/A';
    var empName         = (vals[5]  || '').trim() || '[Name Not Provided]';
    var history         = (vals[16] || '').trim() || 'N/A';

    // Submitter email: col U (20) — manual "Please provide your email" field
    var submitterEmail  = (vals[20] || '').trim();
    if (!submitterEmail) {
      try { submitterEmail = e.response.getRespondentEmail() || ''; } catch (_) {}
    }

    var onBehalf        = v('Are you completing this form on behalf of someone else?') || 'No';
    var onBehalfOf      = v('Please provide the name (and role) of the person you are completing this form on behalf of.') || '';

    var empRole         = v('Employee Role')           || 'N/A';
    var empSite         = v('Employee Site/Location')  || 'N/A';
    var todayDate       = v("Today's Date")            || 'N/A';
    var convDate        = v('Date Conversation Occurred') || 'N/A';
    var firstOccurrence = v('Is this the first time you have documented an occurrence for this employee?') || 'N/A';

    var supportType  = v('What type of support are you documenting?') || 'N/A';
    var supportOther = v('If you chose "other", please describe:')    || '';
    var delivery     = v('How was this conversation delivered?')      || 'N/A';
    var concernType  = v('Please indicate the type of concern that led you to have this conversation.') || 'N/A';
    var concernOther = v('Explain context of concern if "Other" was chosen above') || '';

    var hrNextSteps   = v('Next Steps Requested From HR')         || 'N/A';
    var nextStepsDesc = v('Please describe any relevant next steps') || '';

    var concernLabel = concernType;
    if (concernOther) concernLabel = concernType + ' — ' + concernOther;

    var supportLabel = supportType;
    if (supportOther) supportLabel = supportType + ' — ' + supportOther;

    var region = getRegionForPM(submitterEmail);
    if (!region) region = detectRegion(empSite);

    // ── HR notification ───────────────────────────────────────────────────────
    var subject = '[NJTC HR] New Performance Concern — ' + empName + ' (' + hrNextSteps + ')';

    var body = 'A new performance concern has been submitted via the NJTC Staff Portal.\n\n'
      + '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n'
      + 'SUBMISSION DETAILS\n'
      + '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n'
      + 'Submitted:        ' + submittedAt + '\n'
      + 'Submitted By:     ' + submitterName + '\n'
      + 'Submitter Email:  ' + (submitterEmail || 'N/A') + '\n'
      + (onBehalf === 'Yes' ? 'On Behalf Of:     ' + onBehalfOf + '\n' : '')
      + '\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n'
      + 'EMPLOYEE INFORMATION\n'
      + '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n'
      + 'Employee Name:      ' + empName + '\n'
      + 'Role:               ' + empRole + '\n'
      + 'Site:               ' + empSite + '\n'
      + 'Today\'s Date:       ' + todayDate + '\n'
      + 'Conversation Date:  ' + convDate + '\n'
      + 'First Occurrence:   ' + firstOccurrence + '\n'
      + '\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n'
      + 'CONCERN DETAILS\n'
      + '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n'
      + 'Support Type:   ' + supportLabel + '\n'
      + 'Delivered Via:  ' + delivery + '\n'
      + 'Concern Type:   ' + concernLabel + '\n\n'
      + 'Historical Details:\n' + history + '\n'
      + '\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n'
      + 'REQUESTED NEXT STEPS\n'
      + '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n'
      + 'HR Next Steps: ' + hrNextSteps + '\n'
      + (nextStepsDesc ? 'Additional Notes:\n' + nextStepsDesc + '\n' : '')
      + '\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n'
      + 'View all submissions in the Google Sheet linked to this form.';

    GmailApp.sendEmail(HR_EMAIL, subject, body);

    if (region && REGIONS[region]) {
      REGIONS[region].forEach(function(recipient) {
        if (normalizeEmail(recipient) !== normalizeEmail(submitterEmail) && recipient.indexOf('@') !== -1) {
          GmailApp.sendEmail(recipient, subject, body);
        }
      });
    } else {
      Logger.log('Region unknown for site: ' + empSite + '. Sending to all PMs.');
      [].concat(REGIONS.NE, REGIONS.SW).forEach(function(recipient) {
        if (normalizeEmail(recipient) !== normalizeEmail(submitterEmail) && recipient.indexOf('@') !== -1) {
          GmailApp.sendEmail(recipient, subject, body);
        }
      });
    }

    // ── Submitter receipt ─────────────────────────────────────────────────────
    var sEmail = submitterEmail.trim();
    if (sEmail && sEmail.indexOf('@') !== -1) {
      var partnerEmail = isKnownPM(sEmail) ? getPartner(sEmail) : null;

      var confirmSubject = '[NJTC] Your concern submission has been received';
      var confirmBody = 'Hi ' + submitterName + ',\n\n'
        + 'Your performance concern form has been successfully submitted and HR has been notified.\n\n'
        + 'Summary of your submission:\n'
        + '• Employee:                   ' + empName + ' (' + empRole + ') at ' + empSite + '\n'
        + '• Date Conversation Occurred: ' + convDate + '\n'
        + '• First Documented Occurrence:' + firstOccurrence + '\n'
        + '• Support Type:               ' + supportLabel + '\n'
        + '• Delivery Method:            ' + delivery + '\n'
        + '• Concern Type:               ' + concernLabel + '\n'
        + '• Relevant Details:           ' + history + '\n'
        + '• HR Next Steps Requested:    ' + hrNextSteps + '\n'
        + (nextStepsDesc ? '• Additional Context for HR:  ' + nextStepsDesc + '\n' : '')
        + (onBehalf === 'Yes' ? '• Submitted on behalf of:     ' + onBehalfOf + '\n' : '')
        + '• Submitted: ' + submittedAt + '\n\n'
        + 'HR will follow up with you regarding next steps. If this concern requires immediate '
        + 'attention or escalation, please contact the Executive Director of Programming (EDP) directly.\n\n'
        + 'Thank you,\nNJTC Program Administration';

      GmailApp.sendEmail(sEmail, confirmSubject, confirmBody);

      if (partnerEmail && partnerEmail.indexOf('@') !== -1) {
        GmailApp.sendEmail(partnerEmail, confirmSubject, confirmBody);
      }
    }

    Logger.log('Notifications sent — Employee: ' + empName + ' | Region: ' + (region || 'UNKNOWN') + ' | Next Steps: ' + hrNextSteps);

  } catch(err) {
    Logger.log('Error in onFormSubmit: ' + err.toString());
    GmailApp.sendEmail(
      HR_EMAIL,
      '[NJTC] Form submission notification error',
      'A form was submitted but the notification script encountered an error:\n\n' +
      err.toString() +
      '\n\nPlease check the Google Sheet directly.'
    );
  }
}
