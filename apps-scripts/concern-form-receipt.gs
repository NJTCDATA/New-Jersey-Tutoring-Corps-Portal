/**
 * NJTC HR Email Notification Script — v4
 * CHANGES FROM v3:
 *   Added doGet() Web App endpoint that serves the Performance Concern Form
 *   sheet as CSV. This bypasses Google Workspace org-level restrictions that
 *   block the standard "Publish to the web" pub?output=csv endpoint (403).
 *
 *   HOW TO DEPLOY THE WEB APP (required for portal CSV access):
 *   1. In Apps Script: click Deploy → New deployment
 *   2. Type: Web app
 *   3. Execute as: Me
 *   4. Who has access: Anyone (even anonymous)
 *   5. Click Deploy → copy the Web App URL
 *   6. Give that URL to your developer to update TALENT_CSV_URL in the portal
 *
 *   HOW TO INSTALL THE FORM TRIGGER (for email receipts):
 *   Save this file, then Run → installTrigger (authorize when prompted).
 *
 *   GOOGLE FORM SETTING REQUIRED:
 *   Form Settings → Responses → Collect email addresses → "Responder input"
 *   (NOT "Verified" — Verified mode blocks portal no-cors submissions)
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
//   ?tab=concerns  → Performance Concern Form tab (gid 274671201)  [default]
//   ?tab=reviews   → Monthly Site Leader Reviews tab (gid 63958401)
function doGet(e) {
  try {
    var tab   = (e && e.parameter && e.parameter.tab) || 'concerns';
    var gid   = (tab === 'reviews') ? REVIEWS_SHEET_GID : CONCERN_SHEET_GID;
    var ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
    var sheet = ss.getSheets().filter(function(s) {
      return s.getSheetId() === gid;
    })[0];

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
    var nv = e.namedValues;

    function v(title) {
      return (nv[title] && nv[title][0]) ? nv[title][0].trim() : '';
    }

    var submittedAt = e.values[0] || 'N/A';

    var submitterEmail = '';
    try { submitterEmail = e.response.getRespondentEmail() || ''; } catch (_) {}
    if (!submitterEmail) submitterEmail = v('Email Address');

    var submitterName   = v('NJTC Employee Completing Form (Name/Title)')    || 'N/A';
    var onBehalf        = v('Are you completing this form on behalf of someone else?') || 'No';
    var onBehalfOf      = v('Please provide the name (and role) of the person you are completing this form on behalf of.') || '';

    var empName         = v('Employee Name')          || '[Name Not Provided]';
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
    var history      = v('Please provide any relevant historical details regarding the context for this conversation, important details from the conversation and/or support offered.') || 'N/A';

    var hrNextSteps   = v('Next Steps Requested From HR')         || 'N/A';
    var nextStepsDesc = v('Please describe any relevant next steps') || '';

    var concernLabel = concernType;
    if (concernOther) concernLabel = concernType + ' — ' + concernOther;

    var supportLabel = supportType;
    if (supportType === 'Other' && supportOther) supportLabel = 'Other — ' + supportOther;

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
