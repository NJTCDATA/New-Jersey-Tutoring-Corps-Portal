/**
 * ╔══════════════════════════════════════════════════════════════════════════════╗
 * ║  NJTC TAP — Apprenticeship Tracking Master List                            ║
 * ║  Google Apps Script — Full Production Build v4                             ║
 * ╠══════════════════════════════════════════════════════════════════════════════╣
 * ║  Workbook ID:    14UiE5ple1NYVQl5s9U085pFp50vKjnnwNQmsGS0AKJU             ║
 * ║  Intake Form:    1zr-mZmQmcOELg9P9IQAaO7ehBks7EBtEPfXHXug_HOw            ║
 * ║  OJT Log Form:   1MOsppwhQmagAhVSHs29Ms4o9Ky4xYOyqy8Qs4uTrwbQ            ║
 * ╠══════════════════════════════════════════════════════════════════════════════╣
 * ║  TRIGGERS (install via installTriggers()):                                 ║
 * ║    onFormSubmit      → fires on new Intake Form application                ║
 * ║    onOJTLogSubmit    → fires on new OJT Log entry                          ║
 * ╠══════════════════════════════════════════════════════════════════════════════╣
 * ║  SCRIPT PROPERTIES (set via Project Settings → Script Properties):        ║
 * ║    SHEET_ID, PEARL_LOGIN_CSV, INTAKE_FORM_ID, OJT_FORM_ID                 ║
 * ║    ADMIN_EMAIL, FINANCE_EMAIL_1/2/3, TD_EMAIL_1/2                         ║
 * ║    CERT_BONUS, OJT_COMPLETION_HOURS, RTI_COMPLETION_HOURS                 ║
 * ║    ACADEMIC_YEAR, HR_MASTER_CSV_URL                                        ║
 * ║    COMPLETION_SUMMARY_CSV, OJT_LOG_CSV                                     ║
 * ╚══════════════════════════════════════════════════════════════════════════════╝
 */

// ─── SHEET GIDs ───────────────────────────────────────────────────────────────
var GID_INTAKE        = 2115451937;
var GID_OJT_LOG       = 85054416;
var GID_MASTER_ROSTER = 45498361;

// ─── MASTER ROSTER COLUMN INDICES (0-based) ──────────────────────────────────
// Section A — Admin Metadata
var MR_DATE_REGISTERED   = 0;   // A: Date Registered (Mon-YY)
var MR_STATUS            = 1;   // B: Status (Active/Cancelled/Reinstated/Pending)
var MR_FIRST_NAME        = 2;   // C: First Name
var MR_LAST_NAME         = 3;   // D: Last Name
var MR_COHORT_SEAT       = 4;   // E: Cohort Seat #
var MR_FULL_NAME         = 5;   // F: Full Name Display
var MR_DOL_ID            = 6;   // G: USDOL Apprentice ID
var MR_SY                = 7;   // H: SY
var MR_SITE              = 8;   // I: Placement (Site)
var MR_REGION            = 9;   // J: Region
var MR_DATE_ADP          = 10;  // K: Date Added to ADP
var MR_DATE_GAINS        = 11;  // L: Date Added to GAINS
var MR_DATE_KNOWTION     = 12;  // M: Date Added to Knowtion
var MR_DRIVE_LINK        = 13;  // N: Link to Drive Folder

// Section B — Form auto-populated (Intake Form)
var MR_EMAIL             = 14;  // O: Email Address
var MR_PHONE             = 15;  // P: Best Phone Number
var MR_UG_DEGREE         = 16;  // Q: Has UG Degree?
var MR_NJ_CERT           = 17;  // R: NJ Teacher Cert
var MR_PRIOR_LOC         = 18;  // S: Prior NJTC Location
var MR_COUNTY            = 19;  // T: County
var MR_ADDRESS           = 20;  // U: Mailing Address
var MR_BIRTHDAY          = 21;  // V: Birthday
var MR_GENDER            = 22;  // W: Gender
var MR_ETHNICITY         = 23;  // X: Ethnicity
var MR_RACE              = 24;  // Y: Race
var MR_VETERAN           = 25;  // Z: Veteran Status
var MR_DISABILITY        = 26;  // AA: Disability Status

// Section C — Credentialing (manual)
var MR_TAN               = 27;  // AB: TAN
var MR_CERT_TYPE         = 28;  // AC: Cert Type
var MR_EXAM_NAME         = 29;  // AD: Name of Exam
var MR_CERT_TITLE        = 30;  // AE: Certification Type Title
var MR_CERT_HOURS        = 31;  // AF: Number of Hours for Cert Training
var MR_CERT_DATE         = 32;  // AG: Date of Certification
var MR_COLLEGE_NAME      = 33;  // AH: Name of College
var MR_COLLEGE_COURSE    = 34;  // AI: College Course Title
var MR_COLLEGE_CREDITS   = 35;  // AJ: Number of College Credits
var MR_COLLEGE_DATE      = 36;  // AK: Date of College Credit Award

// Section D — GAINS/RAPIDs Flags
var MR_DISLOCATED_WORKER = 37;  // AL: Dislocated Worker (manual)
var MR_POSTSEC_STUDENT   = 38;  // AM: Post-secondary Student (manual)
var MR_EX_OFFENDER       = 39;  // AN: Ex-Offender (manual)
var MR_SINGLE_PARENT     = 40;  // AO: Single Parent (manual)
var MR_DISP_HOMEMAKER    = 41;  // AP: Displaced Homemaker (manual)
var MR_HOMELESS          = 42;  // AQ: Homeless Individual (manual)
var MR_LT_UNEMPLOYED     = 43;  // AR: LT Unemployment (manual)
var MR_UNEMPLOYED        = 44;  // AS: Unemployed (manual)
var MR_WOMAN_FLAG        = 45;  // AT: Woman (auto)
var MR_VETERAN_FLAG      = 46;  // AU: Veteran (auto)
var MR_MINORITY_FLAG     = 47;  // AV: Minority (auto)
var MR_DISABILITY_FLAG   = 48;  // AW: Ind. w/ Disabilities (auto)

// Section E — OJT/RTI Totals (auto-calculated)
var MR_OJT_HOURS_TOTAL   = 49;  // AX: OJT Hours Total (Y_count × 50)
var MR_RTI_HOURS_TOTAL   = 50;  // AY: RTI Hours Total (SUM of monthly RTI cols)
var MR_OJT_PCT           = 51;  // AZ: OJT % Complete
var MR_OJT_Y_COUNT       = 52;  // BA: OJT Activities Marked Y
var MR_OJT_POSSIBLE      = 53;  // BB: OJT Possible excluding N/A
var MR_BEG_PCT           = 54;  // BC: Beginning % Complete
var MR_MID_PCT           = 55;  // BD: Middle % Complete
var MR_END_PCT           = 56;  // BE: End % Complete
var MR_CURRENT_WAGE      = 57;  // BF: Current Wage Rate
var MR_MILESTONE_LABEL   = 58;  // BG: Wage Milestone
var MR_MILESTONE_DATE    = 59;  // BH: Milestone Date
var MR_WAGE_INCREASE_TO  = 60;  // BI: Wage Increase To
var MR_HOURS_COMPLETION  = 61;  // BJ: Hours for Completion (static)
var MR_PROGRAM_COMPLETE  = 62;  // BK: Program Complete?
var MR_COMPLETION_DATE   = 63;  // BL: Completion Date
var MR_CANCEL_DATE       = 64;  // BM: Cancellation Date (manual)
var MR_PERF_STATUS       = 65;  // BN: Performance Status (manual)

// Section F — OJT Monthly Hours (17 months, cols BO(66)–CE(82))
var MR_OJT_MONTHLY_START = 66;  // BO: Mar-25 OJT
// Mar-25=66, Apr-25=67, May-25=68, Jun-25=69, Jul-25=70, Aug-25=71,
// Sep-25=72, Oct-25=73, Nov-25=74, Dec-25=75, Jan-26=76, Feb-26=77,
// Mar-26=78, Apr-26=79, May-26=80, Jun-26=81, Jul-26=82

// Section G — RTI Monthly Hours (17 months, cols CF(83)–CV(99)) + 4 type cols
var MR_RTI_MONTHLY_START = 83;  // CF: Mar-25 RTI
// Mar-25=83, Apr-25=84, May-25=85, Jun-25=86, Jul-25=87, Aug-25=88,
// Sep-25=89, Oct-25=90, Nov-25=91, Dec-25=92, Jan-26=93, Feb-26=94,
// Mar-26=95, Apr-26=96, May-26=97, Jun-26=98, Jul-26=99
var MR_RTI_UG            = 100; // CW: UG/Graduate Coursework hours
var MR_RTI_COACHING      = 101; // CX: Coaching/PD hours
var MR_RTI_PRAXIS        = 102; // CY: Praxis Exam Prep hours
var MR_RTI_INDIVIDUAL    = 103; // CZ: Individual RTI Sessions hours

// ─── OJT LOG COLUMN INDICES (0-based) ────────────────────────────────────────
var OJT_TIMESTAMP   = 0;   // A: Timestamp
var OJT_LOG_TYPE    = 1;   // B: Log Type
var OJT_OBS_DATE    = 2;   // C: Date of observation
var OJT_OBSERVER    = 3;   // D: Observer Name         entry.1339815889
var OJT_OBS_ROLE    = 4;   // E: Observer Role         entry.1644446216
var OJT_SITE        = 5;   // F: Site Location         entry.1868799856
var OJT_APPRENTICE  = 6;   // G: Apprentice Name       entry.1113592438
var OJT_PHASE       = 7;   // H: Program Phase         entry.2084410404
var OJT_DOMAIN      = 8;   // I: Competency Domain     entry.1916953177
var OJT_ACTIVITY    = 9;   // J: Activity Code+Desc    entry.1818518596
var OJT_STATUS      = 10;  // K: Completion Status     entry.272707685  (Y / N/A)
var OJT_NOTES       = 11;  // L: Observation Notes     entry.1617504322
var OJT_RTI_MONTH   = 12;  // M: RTI Month             entry.815300787
var OJT_RTI_HOURS   = 13;  // N: RTI Hours             entry.636478943
var OJT_RTI_TYPES   = 14;  // O: RTI Type(s)           entry.190993235

// ─── RTI MONTH LABELS (order maps to MR_RTI_MONTHLY_START offset) ────────────
var RTI_MONTH_LABELS = [
  'Mar-25','Apr-25','May-25','Jun-25','Jul-25','Aug-25',
  'Sep-25','Oct-25','Nov-25','Dec-25','Jan-26','Feb-26',
  'Mar-26','Apr-26','May-26','Jun-26','Jul-26'
];

// ─── OJT MONTH LABELS (same order, maps to MR_OJT_MONTHLY_START offset) ─────
var OJT_MONTH_LABELS = [
  'Mar-25','Apr-25','May-25','Jun-25','Jul-25','Aug-25',
  'Sep-25','Oct-25','Nov-25','Dec-25','Jan-26','Feb-26',
  'Mar-26','Apr-26','May-26','Jun-26','Jul-26'
];

// ─── WAGE TIERS (OJT hours thresholds → flat hourly wage) ────────────────────
var WAGE_TIERS = [
  { threshold: 4000, wage: 35.00, label: '4000 hrs — Program Complete' },
  { threshold: 3800, wage: 33.99, label: '3800 hrs' },
  { threshold: 3300, wage: 32.99, label: '3300 hrs' },
  { threshold: 2200, wage: 31.99, label: '2200 hrs' },
  { threshold: 1100, wage: 30.98, label: '1100 hrs' },
  { threshold: 0,    wage: 30.00, label: 'Base' },
];

// ─── HR MASTER LIST COLUMN HEADERS ───────────────────────────────────────────
var HR_COL_YEAR   = 'Academic Year';
var HR_COL_NAME   = 'Full Name';
var HR_COL_EMAIL  = 'Email Address';
var HR_COL_ROLE   = 'Position / Role';
var HR_COL_SITE   = 'Site / School';
var HR_COL_DIST   = 'District';
var HR_COL_STATUS = 'Active / Terminated Status';
var HR_COL_AP     = 'Apprentice Program';

var LEADER_ROLES = [
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

// ─── ROSTER DROPDOWN NAMES (corrected) ───────────────────────────────────────
// Used for any hardcoded name arrays or dropdown validation lists.
// Micaela Wilkerson → Caela Wilkerson
// Sharon Kessel     → Sharon K Kessel
// Leslie Seale Black → Leslie Black


// ══════════════════════════════════════════════════════════════════════════════
// ██  MENU
// ══════════════════════════════════════════════════════════════════════════════

function onOpen() {
  try {
    SpreadsheetApp.getUi()
      .createMenu('NJTC TAP')
      .addItem('Full Resync',              'fullResync')
      .addItem('Export OJT Report (PDF)',  'exportOJTReport')
      .addItem('View Notifications Log',   'viewNotificationsLog')
      .addItem('Rebuild Completion Summary', 'rebuildCompletionSummary')
      .addToUi();
  } catch (e) {
    Logger.log('onOpen menu error: ' + e.toString());
  }
}


// ══════════════════════════════════════════════════════════════════════════════
// ██  FUNCTION 1 — onFormSubmit (Intake Form)
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Fires when a new Intake Form application is submitted.
 * Bound to Intake Form via installTriggers().
 */
function onFormSubmit(e) {
  if (!e || !e.namedValues) {
    Logger.log('onFormSubmit called without namedValues — manual test run, skipping.');
    return;
  }
  try {
    var props = PropertiesService.getScriptProperties().getProperties();
    var nv    = e.namedValues;

    function fv(key) {
      return (nv[key] && nv[key][0]) ? String(nv[key][0]).trim() : '';
    }

    // Read fields using entry IDs as keys (question titles in namedValues)
    var firstName = fv('entry.93480344')    || fv('First Name')  || '';
    var lastName  = fv('entry.2027935946')  || fv('Last Name')   || '';
    var email     = fv('entry.1259170575')  || fv('Email Address') || fv('Email') || '';
    var phone     = fv('entry.192764778')   || fv('Best Phone Number') || '';
    var ugDegree  = fv('entry.303227402')   || fv('Has UG Degree?') || '';
    var njCert    = fv('entry.1905146259')  || fv('NJ Teacher Cert') || '';
    var priorLoc  = fv('entry.445004455')   || fv('Prior NJTC Location') || '';
    var county    = fv('entry.911464048')   || fv('County') || '';
    var address   = fv('entry.1105123835')  || fv('Mailing Address') || '';
    var birthday  = fv('entry.1111190033')  || fv('Birthday') || '';
    var gender    = fv('entry.1497434479')  || fv('Gender') || '';
    var ethnicity = fv('entry.606321682')   || fv('Ethnicity') || '';
    var race      = fv('entry.228392366')   || fv('Race') || '';
    var veteran   = fv('entry.2016450571')  || fv('Veteran Status') || '';
    var disability= fv('entry.1260217181')  || fv('Disability Status') || '';

    var fullName  = (firstName + ' ' + lastName).trim() || '[Name Not Provided]';
    var today     = _formatMonYY(new Date());

    // Auto-derive GAINS flags
    var womanFlag    = (gender.toLowerCase().indexOf('female') >= 0 || gender.toLowerCase().indexOf('non-binary') >= 0) ? 'Y' : '';
    var veteranFlag  = (veteran.toLowerCase().indexOf('yes') >= 0) ? 'Y' : '';
    var minorityFlag = (race && race.toLowerCase().indexOf('white') < 0 && race.trim() !== '') ? 'Y' : '';
    var disabilityFlag = (disability.toLowerCase().indexOf('yes') >= 0) ? 'Y' : '';

    var ss      = _getSpreadsheet();
    var rSheet  = _getSheetByGID(ss, GID_MASTER_ROSTER);
    if (!rSheet) throw new Error('Master Roster tab not found (GID ' + GID_MASTER_ROSTER + ')');

    var data       = rSheet.getDataRange().getValues();
    var targetRow  = -1;
    var normalEmail= email.toLowerCase();

    // Check for duplicate email in col O (MR_EMAIL = 14, index 14)
    for (var i = 1; i < data.length; i++) {
      var rowEmail = String(data[i][MR_EMAIL] || '').trim().toLowerCase();
      if (rowEmail && rowEmail === normalEmail) {
        targetRow = i + 1; // 1-based
        break;
      }
    }

    if (targetRow < 0) {
      // Append new row
      rSheet.appendRow(new Array(104).fill(''));
      targetRow = rSheet.getLastRow();
    }

    // Write values
    var r = rSheet.getRange(targetRow, 1, 1, 104).getValues()[0];

    // Section A — Admin Metadata (only set if blank on new row)
    if (!r[MR_DATE_REGISTERED])  rSheet.getRange(targetRow, MR_DATE_REGISTERED + 1).setValue(today);
    if (!r[MR_STATUS])           rSheet.getRange(targetRow, MR_STATUS + 1).setValue('Pending');
    rSheet.getRange(targetRow, MR_FIRST_NAME + 1).setValue(firstName);
    rSheet.getRange(targetRow, MR_LAST_NAME  + 1).setValue(lastName);
    rSheet.getRange(targetRow, MR_FULL_NAME  + 1).setValue(fullName);

    // Section B — Form auto-populated
    rSheet.getRange(targetRow, MR_EMAIL      + 1).setValue(email);
    rSheet.getRange(targetRow, MR_PHONE      + 1).setValue(phone);
    rSheet.getRange(targetRow, MR_UG_DEGREE  + 1).setValue(ugDegree);
    rSheet.getRange(targetRow, MR_NJ_CERT    + 1).setValue(njCert);
    rSheet.getRange(targetRow, MR_PRIOR_LOC  + 1).setValue(priorLoc);
    rSheet.getRange(targetRow, MR_COUNTY     + 1).setValue(county);
    rSheet.getRange(targetRow, MR_ADDRESS    + 1).setValue(address);
    rSheet.getRange(targetRow, MR_BIRTHDAY   + 1).setValue(birthday);
    rSheet.getRange(targetRow, MR_GENDER     + 1).setValue(gender);
    rSheet.getRange(targetRow, MR_ETHNICITY  + 1).setValue(ethnicity);
    rSheet.getRange(targetRow, MR_RACE       + 1).setValue(race);
    rSheet.getRange(targetRow, MR_VETERAN    + 1).setValue(veteran);
    rSheet.getRange(targetRow, MR_DISABILITY + 1).setValue(disability);

    // Section D — GAINS auto flags
    rSheet.getRange(targetRow, MR_WOMAN_FLAG    + 1).setValue(womanFlag);
    rSheet.getRange(targetRow, MR_VETERAN_FLAG  + 1).setValue(veteranFlag);
    rSheet.getRange(targetRow, MR_MINORITY_FLAG + 1).setValue(minorityFlag);
    rSheet.getRange(targetRow, MR_DISABILITY_FLAG + 1).setValue(disabilityFlag);

    // Drive folder hyperlink formula (col N)
    var driveFormula = '=HYPERLINK("https://drive.google.com/drive/search?q=' +
      encodeURIComponent(fullName) + '","Drive Folder")';
    rSheet.getRange(targetRow, MR_DRIVE_LINK + 1).setFormula(driveFormula);

    SpreadsheetApp.flush();

    // Send admin notification email
    var subject = 'NJTC TAP — New Application: ' + fullName;
    var body    = _buildIntakeEmailBody(fullName, email, nv);
    GmailApp.sendEmail(props.ADMIN_EMAIL, subject, body);

    _logNotification('INTAKE_SUBMIT', fullName, 'New application received', props.ADMIN_EMAIL, 'onFormSubmit');
    Logger.log('Intake form processed — ' + fullName + ' | ' + email);

  } catch (err) {
    _handleError('onFormSubmit', err);
  }
}


// ══════════════════════════════════════════════════════════════════════════════
// ██  FUNCTION 2 — onOJTLogSubmit (OJT Log Form)
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Fires when a new OJT Log Form entry is submitted.
 * Bound to OJT Log Form via installTriggers().
 */
function onOJTLogSubmit(e) {
  if (!e || !e.namedValues) {
    Logger.log('onOJTLogSubmit called without namedValues — manual test run, skipping.');
    return;
  }
  try {
    var props = PropertiesService.getScriptProperties().getProperties();
    var nv    = e.namedValues;
    var vals  = e.values || [];

    function fv(key, fallbackIdx) {
      if (nv[key] && nv[key][0]) return String(nv[key][0]).trim();
      if (fallbackIdx !== undefined && vals[fallbackIdx] !== undefined) return String(vals[fallbackIdx]).trim();
      return '';
    }

    var logType       = fv('entry.338482221', OJT_LOG_TYPE)  || fv('Log Type', OJT_LOG_TYPE)     || '';
    var obsDate       = fv('entry.1328224034', OJT_OBS_DATE) || fv('Date of observation')        || '';
    var observerName  = fv('entry.1339815889', OJT_OBSERVER) || fv('Observer Name')               || '';
    var obsRole       = fv('entry.1644446216', OJT_OBS_ROLE) || fv('Observer Role')               || '';
    var siteLoc       = fv('entry.1868799856', OJT_SITE)     || fv('Site Location')               || '';
    var apprentice    = fv('entry.1113592438', OJT_APPRENTICE)|| fv('Apprentice Name')            || '';
    var phase         = fv('entry.2084410404', OJT_PHASE)    || fv('Program Phase')               || '';
    var domain        = fv('entry.1916953177', OJT_DOMAIN)   || fv('Competency Domain')           || '';
    var activity      = fv('entry.1818518596', OJT_ACTIVITY) || fv('Activity Code+Desc')          || '';
    var status        = fv('entry.272707685',  OJT_STATUS)   || fv('Completion Status')           || '';
    var notes         = fv('entry.1617504322', OJT_NOTES)    || fv('Observation Notes')           || '';
    var rtiMonth      = fv('entry.815300787',  OJT_RTI_MONTH)|| fv('RTI Month')                   || '';
    var rtiHoursRaw   = fv('entry.636478943',  OJT_RTI_HOURS)|| fv('RTI Hours')                   || '0';
    var rtiTypes      = fv('entry.190993235',  OJT_RTI_TYPES)|| fv('RTI Type(s)')                 || '';

    if (!apprentice) {
      Logger.log('onOJTLogSubmit: missing apprentice name — skipping.');
      return;
    }

    // ── Validate observer against HR Master List ──────────────────────────────
    var hrUrl = props.HR_MASTER_CSV_URL || '';
    if (!hrUrl) {
      Logger.log('HR_MASTER_CSV_URL not set in Script Properties — skipping observer validation.');
    } else {
      var validObserver = _validateObserver(observerName, '', hrUrl, props.ACADEMIC_YEAR || '2025-2026');
      if (!validObserver) {
        var errMsg = 'OJT log submitted by unrecognized observer: "' + observerName + '" (' + obsRole + ')' +
                     '\nApprenticeName: ' + apprentice +
                     '\nActivity: ' + activity + '\nSite: ' + siteLoc +
                     '\nThis entry was NOT processed. Observer not found as Active leader in HR Master List.';
        _logNotification('OBSERVER_INVALID', apprentice, errMsg, props.ADMIN_EMAIL, 'onOJTLogSubmit');
        GmailApp.sendEmail(props.ADMIN_EMAIL, 'NJTC TAP Script Error: onOJTLogSubmit — Observer Validation', errMsg);
        return; // do not process
      }
    }

    // ── Find apprentice in Master Roster ─────────────────────────────────────
    var ss      = _getSpreadsheet();
    var rSheet  = _getSheetByGID(ss, GID_MASTER_ROSTER);
    if (!rSheet) throw new Error('Master Roster tab not found');

    var rosterRow = _findRosterRow(rSheet, apprentice);
    if (!rosterRow) {
      var notFoundMsg = 'OJT log for "' + apprentice + '" — name not found in Master Roster.' +
                        '\nObserver: ' + observerName + ' | Site: ' + siteLoc;
      _logNotification('ROSTER_NOT_FOUND', apprentice, notFoundMsg, props.ADMIN_EMAIL, 'onOJTLogSubmit');
      GmailApp.sendEmail(props.ADMIN_EMAIL, 'NJTC TAP Script Error: onOJTLogSubmit — Roster Lookup', notFoundMsg);
      return;
    }

    var logTypeLower = logType.toLowerCase();

    // ── Handle RTI submission ─────────────────────────────────────────────────
    if (logTypeLower.indexOf('rti') >= 0) {
      var rtiHours = parseFloat(rtiHoursRaw) || 0;
      if (rtiHours > 0 && rtiMonth) {
        // Write to monthly RTI column
        var rtiMonthIdx = RTI_MONTH_LABELS.indexOf(rtiMonth.trim());
        if (rtiMonthIdx >= 0) {
          var rtiColIdx = MR_RTI_MONTHLY_START + rtiMonthIdx; // 0-based
          var curRTI    = parseFloat(rSheet.getRange(rosterRow.rowIndex, rtiColIdx + 1).getValue()) || 0;
          rSheet.getRange(rosterRow.rowIndex, rtiColIdx + 1).setValue(curRTI + rtiHours);
        }
        // Write to RTI type breakdown (CW:CZ)
        _addRTITypeHours(rSheet, rosterRow.rowIndex, rtiTypes, rtiHours);
      }
      recalculateTotals(apprentice);
      return;
    }

    // ── Handle OJT Activity submission ────────────────────────────────────────
    if (logTypeLower.indexOf('ojt') >= 0 || logTypeLower === '') {
      recalculateTotals(apprentice);
    }

  } catch (err) {
    _handleError('onOJTLogSubmit', err);
  }
}

/**
 * Writes RTI hours into the type-breakdown columns (CW:CZ) based on RTI type checkboxes.
 */
function _addRTITypeHours(rSheet, rowIndex, rtiTypes, hours) {
  var typesLower = rtiTypes.toLowerCase();
  var hoursEach  = hours; // full hours go to each checked type
  if (typesLower.indexOf('ug') >= 0 || typesLower.indexOf('graduate') >= 0 || typesLower.indexOf('coursework') >= 0) {
    var cur = parseFloat(rSheet.getRange(rowIndex, MR_RTI_UG + 1).getValue()) || 0;
    rSheet.getRange(rowIndex, MR_RTI_UG + 1).setValue(cur + hoursEach);
  }
  if (typesLower.indexOf('coaching') >= 0 || typesLower.indexOf('pd') >= 0 || typesLower.indexOf('professional') >= 0) {
    var cur2 = parseFloat(rSheet.getRange(rowIndex, MR_RTI_COACHING + 1).getValue()) || 0;
    rSheet.getRange(rowIndex, MR_RTI_COACHING + 1).setValue(cur2 + hoursEach);
  }
  if (typesLower.indexOf('praxis') >= 0) {
    var cur3 = parseFloat(rSheet.getRange(rowIndex, MR_RTI_PRAXIS + 1).getValue()) || 0;
    rSheet.getRange(rowIndex, MR_RTI_PRAXIS + 1).setValue(cur3 + hoursEach);
  }
  if (typesLower.indexOf('individual') >= 0) {
    var cur4 = parseFloat(rSheet.getRange(rowIndex, MR_RTI_INDIVIDUAL + 1).getValue()) || 0;
    rSheet.getRange(rowIndex, MR_RTI_INDIVIDUAL + 1).setValue(cur4 + hoursEach);
  }
}


// ══════════════════════════════════════════════════════════════════════════════
// ██  FUNCTION 3 — recalculateTotals(apprenticeName)
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Re-reads all OJT Log rows for the given apprentice and recomputes all totals.
 * Writes results back to Master Roster cols AX:BE (indices 49–56) plus wage/milestone cols.
 * Also updates Completion Summary tab.
 */
function recalculateTotals(apprenticeName) {
  try {
    var props   = PropertiesService.getScriptProperties().getProperties();
    var ss      = _getSpreadsheet();
    var rSheet  = _getSheetByGID(ss, GID_MASTER_ROSTER);
    var ojtSheet= _getSheetByGID(ss, GID_OJT_LOG);
    if (!rSheet || !ojtSheet) return;

    var rosterRow = _findRosterRow(rSheet, apprenticeName);
    if (!rosterRow) {
      Logger.log('recalculateTotals: "' + apprenticeName + '" not in Master Roster.');
      return;
    }

    var rowIndex = rosterRow.rowIndex;

    // ── Read all OJT Log rows for this apprentice ─────────────────────────────
    var ojtData  = ojtSheet.getDataRange().getValues();
    // Build a map: phase+domain+activity → most recent non-blank status
    var activityMap = {}; // key → { status, timestamp }
    var MAX_ACTIVITIES = 80;
    var BEG_TOTAL = 33, MID_TOTAL = 38, END_TOTAL = 9; // per OJT Activity Schema

    for (var i = 1; i < ojtData.length; i++) {
      var row    = ojtData[i];
      var apName = String(row[OJT_APPRENTICE] || '').trim();
      if (_normName(apName) !== _normName(apprenticeName)) continue;

      var logTypeLow = String(row[OJT_LOG_TYPE] || '').toLowerCase();
      if (logTypeLow.indexOf('rti') >= 0) continue; // skip RTI rows for OJT activity calcs

      var ph   = String(row[OJT_PHASE]    || '').trim();
      var dom  = String(row[OJT_DOMAIN]   || '').trim();
      var act  = String(row[OJT_ACTIVITY] || '').trim();
      var stat = String(row[OJT_STATUS]   || '').trim();
      var ts   = row[OJT_TIMESTAMP] ? new Date(row[OJT_TIMESTAMP]).getTime() : 0;

      if (!ph && !dom && !act) continue;
      if (!stat) continue; // blank status — ignore

      var key = (ph + '|' + dom + '|' + act).toLowerCase();
      if (!activityMap[key] || ts > activityMap[key].ts) {
        activityMap[key] = { status: stat, ts: ts, phase: ph };
      }
    }

    // ── Compute activity stats ────────────────────────────────────────────────
    var yCount  = 0, naCount = 0;
    var begY = 0, begNA = 0, midY = 0, midNA = 0, endY = 0, endNA = 0;

    Object.keys(activityMap).forEach(function(key) {
      var entry   = activityMap[key];
      var st      = entry.status.toUpperCase();
      var ph      = (entry.phase || '').toLowerCase();
      var isBeg   = ph.indexOf('begin') >= 0;
      var isMid   = ph.indexOf('mid') >= 0;
      var isEnd   = ph.indexOf('end') >= 0;

      if (st === 'Y') {
        yCount++;
        if (isBeg) begY++;
        else if (isMid) midY++;
        else if (isEnd) endY++;
      } else if (st.indexOf('N/A') >= 0 || st === 'NA') {
        naCount++;
        if (isBeg) begNA++;
        else if (isMid) midNA++;
        else if (isEnd) endNA++;
      }
    });

    var possible   = MAX_ACTIVITIES - naCount;
    var ojtHours   = yCount * 50;
    var ojtPct     = (possible > 0) ? (yCount / possible) : 0;

    var begPossible = BEG_TOTAL - begNA;
    var midPossible = MID_TOTAL - midNA;
    var endPossible = END_TOTAL - endNA;

    var begPct = (begPossible > 0) ? (begY / begPossible) : 0;
    var midPct = (midPossible > 0) ? (midY / midPossible) : 0;
    var endPct = (endPossible > 0) ? (endY / endPossible) : 0;

    // ── RTI Hours Total: SUM monthly RTI cols (CF:CV = indices 83–99) ─────────
    var rosterData  = rSheet.getRange(rowIndex, 1, 1, 104).getValues()[0];
    var rtiTotal    = 0;
    for (var m = 0; m < 17; m++) {
      rtiTotal += parseFloat(rosterData[MR_RTI_MONTHLY_START + m]) || 0;
    }

    // ── Program completion check ──────────────────────────────────────────────
    var ojtTarget   = parseFloat(props.OJT_COMPLETION_HOURS) || 4000;
    var rtiTarget   = parseFloat(props.RTI_COMPLETION_HOURS) || 288;
    var progComplete= (ojtHours >= ojtTarget && rtiTotal >= rtiTarget);

    // ── Capture prev OJT hours before writing ────────────────────────────────
    var prevOJTHours = parseFloat(rosterData[MR_OJT_HOURS_TOTAL]) || 0;

    // ── Write Section E totals ────────────────────────────────────────────────
    rSheet.getRange(rowIndex, MR_OJT_HOURS_TOTAL + 1).setValue(ojtHours);
    rSheet.getRange(rowIndex, MR_RTI_HOURS_TOTAL + 1).setValue(rtiTotal);
    rSheet.getRange(rowIndex, MR_OJT_PCT         + 1).setValue(ojtPct);
    rSheet.getRange(rowIndex, MR_OJT_Y_COUNT     + 1).setValue(yCount);
    rSheet.getRange(rowIndex, MR_OJT_POSSIBLE    + 1).setValue(possible);
    rSheet.getRange(rowIndex, MR_BEG_PCT         + 1).setValue(begPct);
    rSheet.getRange(rowIndex, MR_MID_PCT         + 1).setValue(midPct);
    rSheet.getRange(rowIndex, MR_END_PCT         + 1).setValue(endPct);

    // Static completion hours label
    rSheet.getRange(rowIndex, MR_HOURS_COMPLETION + 1).setValue('4000 OJT + 288 RTI');

    // ── Milestone & alert ─────────────────────────────────────────────────────
    checkMilestoneAndAlert(apprenticeName, prevOJTHours, ojtHours);

    // ── Stamp completion date if newly complete ───────────────────────────────
    var prevComplete = String(rosterData[MR_PROGRAM_COMPLETE] || '').trim().toUpperCase();
    rSheet.getRange(rowIndex, MR_PROGRAM_COMPLETE + 1).setValue(progComplete ? 'YES' : '');
    if (progComplete && !prevComplete) {
      var completeDateVal = String(rosterData[MR_COMPLETION_DATE] || '').trim();
      if (!completeDateVal) {
        rSheet.getRange(rowIndex, MR_COMPLETION_DATE + 1).setValue(new Date());
      }
    }

    SpreadsheetApp.flush();

    // ── Update Completion Summary ─────────────────────────────────────────────
    _updateCompletionSummaryRow(apprenticeName);

  } catch (err) {
    _handleError('recalculateTotals', err);
  }
}


// ══════════════════════════════════════════════════════════════════════════════
// ██  FUNCTION 4 — checkMilestoneAndAlert
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Compares prevHours and newHours against wage tiers.
 * If a threshold was crossed, writes milestone data to Master Roster
 * and sends wage increase email to Finance/TD/Admin.
 */
function checkMilestoneAndAlert(apprenticeName, prevHours, newHours) {
  try {
    if (newHours <= prevHours && newHours < 1100) return; // no change worth checking

    var props  = PropertiesService.getScriptProperties().getProperties();
    var ss     = _getSpreadsheet();
    var rSheet = _getSheetByGID(ss, GID_MASTER_ROSTER);
    if (!rSheet) return;

    var rosterRow = _findRosterRow(rSheet, apprenticeName);
    if (!rosterRow) return;

    var rowIndex   = rosterRow.rowIndex;
    var rosterData = rSheet.getRange(rowIndex, 1, 1, 104).getValues()[0];

    // Determine new wage tier
    var newTier  = _wageTierForHours(newHours);
    var prevTier = _wageTierForHours(prevHours);

    if (!newTier || newTier.threshold === prevTier.threshold) return; // no tier change

    var certBonus     = parseFloat(props.CERT_BONUS) || 5.00;
    var certType      = String(rosterData[MR_CERT_TYPE] || '').trim();
    var certEligible  = ['Standard', 'CEAS', 'CE'].indexOf(certType) >= 0;
    var baseWage      = newTier.wage;
    var newWage       = (newTier.threshold >= 4000 && certEligible) ? baseWage + certBonus : baseWage;
    var prevWage      = parseFloat(rosterData[MR_CURRENT_WAGE] || prevTier.wage) || prevTier.wage;
    var increaseAmt   = newWage - prevWage;

    var milestoneLabel= newTier.label;
    var isCompletion  = newTier.threshold >= 4000;
    var today         = new Date();
    var todayStr      = Utilities.formatDate(today, Session.getScriptTimeZone(), 'MMMM d, yyyy');

    // Write to Master Roster
    rSheet.getRange(rowIndex, MR_CURRENT_WAGE    + 1).setValue(newWage);
    rSheet.getRange(rowIndex, MR_MILESTONE_LABEL + 1).setValue(milestoneLabel);
    rSheet.getRange(rowIndex, MR_MILESTONE_DATE  + 1).setValue(today);
    rSheet.getRange(rowIndex, MR_WAGE_INCREASE_TO+ 1).setValue(newWage);

    // Gather context for email
    var dolId      = String(rosterData[MR_DOL_ID] || '');
    var site       = String(rosterData[MR_SITE]   || '');
    var region     = String(rosterData[MR_REGION] || '');
    var rtiHours   = parseFloat(rosterData[MR_RTI_HOURS_TOTAL] || 0);

    var subject = isCompletion
      ? 'NJTC TAP — Program Completion: ' + apprenticeName
      : 'NJTC TAP — Wage Increase Required: ' + apprenticeName;

    var body = [
      isCompletion
        ? 'A TAP apprentice has completed the full program requirements.'
        : 'A TAP apprentice has crossed a wage milestone and is due a wage increase.',
      '',
      '━━━━━━━━━━━━━━━━━━━━',
      'APPRENTICE DETAILS',
      '━━━━━━━━━━━━━━━━━━━━',
      'Full Name:       ' + apprenticeName,
      'USDOL ID:        ' + dolId,
      'Site:            ' + site,
      'Region:          ' + region,
      '',
      '━━━━━━━━━━━━━━━━━━━━',
      isCompletion ? 'PROGRAM COMPLETION — WAGE CHANGE' : 'WAGE CHANGE',
      '━━━━━━━━━━━━━━━━━━━━',
      'Previous Wage:   $' + prevWage.toFixed(2) + '/hr',
      'New Wage:        $' + newWage.toFixed(2) + '/hr' + (certEligible && isCompletion ? ' (incl. $' + certBonus.toFixed(2) + ' cert bonus)' : ''),
      'Increase Amount: $' + increaseAmt.toFixed(2) + '/hr',
      'Milestone:       ' + milestoneLabel,
      'Effective Date:  ' + todayStr,
      '',
      '━━━━━━━━━━━━━━━━━━━━',
      'PROGRAM PROGRESS',
      '━━━━━━━━━━━━━━━━━━━━',
      'OJT Hours:       ' + newHours + ' hrs (target: ' + (props.OJT_COMPLETION_HOURS || 4000) + ')',
      'RTI Hours:       ' + rtiHours + ' hrs (target: ' + (props.RTI_COMPLETION_HOURS || 288) + ')',
      '',
      'Action Required: Please process this wage adjustment in payroll by the effective date.',
      '',
      'NJTC Impact Solutions Group · TAP Portal · Automated Notification',
    ].join('\n');

    var toList = [props.FINANCE_EMAIL_1, props.FINANCE_EMAIL_2, props.FINANCE_EMAIL_3]
      .filter(function(addr) { return addr && addr.indexOf('@') >= 0; }).join(',');
    var ccList = [props.TD_EMAIL_1, props.TD_EMAIL_2]
      .filter(function(addr) { return addr && addr.indexOf('@') >= 0; }).join(',');

    if (toList) {
      GmailApp.sendEmail(toList, subject, body, {
        cc:  ccList   || undefined,
        bcc: props.ADMIN_EMAIL || undefined,
      });
    }

    var notifType = isCompletion ? 'PROGRAM_COMPLETE' : 'WAGE_ALERT';
    var emailsSent = [toList, ccList, props.ADMIN_EMAIL].filter(Boolean).join(', ');
    _logNotification(notifType, apprenticeName, milestoneLabel + ' | $' + prevWage.toFixed(2) + ' → $' + newWage.toFixed(2), emailsSent, 'checkMilestoneAndAlert');

    Logger.log('Milestone triggered — ' + apprenticeName + ' | ' + milestoneLabel + ' | $' + prevWage.toFixed(2) + ' → $' + newWage.toFixed(2));

  } catch (err) {
    _handleError('checkMilestoneAndAlert', err);
  }
}

/**
 * Returns the wage tier object for a given OJT hours count.
 */
function _wageTierForHours(hours) {
  for (var i = 0; i < WAGE_TIERS.length; i++) {
    if (hours >= WAGE_TIERS[i].threshold) return WAGE_TIERS[i];
  }
  return WAGE_TIERS[WAGE_TIERS.length - 1]; // base
}


// ══════════════════════════════════════════════════════════════════════════════
// ██  FUNCTION 5 — fullResync
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Loops all Active rows in Master Roster, calls recalculateTotals for each,
 * then rebuilds the Completion Summary tab from scratch.
 */
function fullResync() {
  try {
    var ss     = _getSpreadsheet();
    var rSheet = _getSheetByGID(ss, GID_MASTER_ROSTER);
    if (!rSheet) throw new Error('Master Roster tab not found');

    var data  = rSheet.getDataRange().getValues();
    var count = 0;

    for (var i = 1; i < data.length; i++) {
      var status   = String(data[i][MR_STATUS]     || '').trim();
      var fullName = String(data[i][MR_FULL_NAME]  || '').trim();
      if (!fullName) continue;
      if (status !== 'Active' && status !== 'Reinstated') continue;

      recalculateTotals(fullName);
      count++;
    }

    rebuildCompletionSummary();

    var props = PropertiesService.getScriptProperties().getProperties();
    _logNotification('FULL_RESYNC', '', 'Processed ' + count + ' active apprentices', '', 'fullResync');
    SpreadsheetApp.getActive().toast('Full Resync complete — ' + count + ' apprentices processed.', 'NJTC TAP', 8);
    Logger.log('fullResync complete — ' + count + ' apprentices processed.');

  } catch (err) {
    _handleError('fullResync', err);
  }
}


// ══════════════════════════════════════════════════════════════════════════════
// ██  COMPLETION SUMMARY TAB
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Rebuilds the Completion Summary tab from scratch using current Master Roster data.
 * Columns: A=Full Name, B=USDOL ID, C=Status, D=Site, E=OJT Hours, F=OJT %,
 *          G=Y / Possible, H=Beg %, I=Mid %, J=End %, K=RTI Hours, L=RTI on Pace?,
 *          M=RTI Needed, N=Current Wage, O=Next Milestone, P=Program Complete?
 */
function rebuildCompletionSummary() {
  try {
    var props  = PropertiesService.getScriptProperties().getProperties();
    var ss     = _getSpreadsheet();
    var rSheet = _getSheetByGID(ss, GID_MASTER_ROSTER);
    if (!rSheet) throw new Error('Master Roster tab not found');

    var csName  = 'Completion Summary';
    var csSheet = ss.getSheetByName(csName);
    if (!csSheet) {
      csSheet = ss.insertSheet(csName);
    } else {
      csSheet.clearContents();
    }

    var headers = [
      'Apprentice Full Name', 'USDOL ID', 'Status', 'Site',
      'OJT Hours', 'OJT %', 'Y / Possible', 'Beg %', 'Mid %', 'End %',
      'RTI Hours', 'RTI on Pace?', 'RTI Needed', 'Current Wage',
      'Next Milestone', 'Program Complete?'
    ];
    csSheet.appendRow(headers);

    var data    = rSheet.getDataRange().getValues();
    var ojtMax  = parseFloat(props.OJT_COMPLETION_HOURS) || 4000;
    var rtiMax  = parseFloat(props.RTI_COMPLETION_HOURS) || 288;
    var rows    = [];

    for (var i = 1; i < data.length; i++) {
      var d        = data[i];
      var fullName = String(d[MR_FULL_NAME] || '').trim();
      if (!fullName) continue;

      var ojtHours   = parseFloat(d[MR_OJT_HOURS_TOTAL]) || 0;
      var rtiHours   = parseFloat(d[MR_RTI_HOURS_TOTAL]) || 0;
      var ojtPct     = parseFloat(d[MR_OJT_PCT])         || 0;
      var yCount     = parseFloat(d[MR_OJT_Y_COUNT])     || 0;
      var possible   = parseFloat(d[MR_OJT_POSSIBLE])    || 0;
      var begPct     = parseFloat(d[MR_BEG_PCT])         || 0;
      var midPct     = parseFloat(d[MR_MID_PCT])         || 0;
      var endPct     = parseFloat(d[MR_END_PCT])         || 0;
      var wage       = parseFloat(d[MR_CURRENT_WAGE])    || 0;
      var complete   = String(d[MR_PROGRAM_COMPLETE]     || '').trim().toUpperCase();

      var rtiNeeded  = Math.max(0, rtiMax - rtiHours);
      var rtiOnPace  = rtiHours >= rtiMax ? 'Yes' : 'No';

      // Next milestone
      var nextMs = '';
      for (var t = WAGE_TIERS.length - 1; t >= 0; t--) {
        if (ojtHours < WAGE_TIERS[t].threshold) {
          nextMs = WAGE_TIERS[t].label + ' ($' + WAGE_TIERS[t].wage.toFixed(2) + ')';
        }
      }
      if (!nextMs && ojtHours >= ojtMax) nextMs = 'Complete';

      rows.push([
        fullName,
        String(d[MR_DOL_ID] || ''),
        String(d[MR_STATUS]  || ''),
        String(d[MR_SITE]    || ''),
        ojtHours,
        _pctStr(ojtPct),
        yCount + ' / ' + possible,
        _pctStr(begPct),
        _pctStr(midPct),
        _pctStr(endPct),
        rtiHours,
        rtiOnPace,
        rtiNeeded,
        wage > 0 ? '$' + wage.toFixed(2) : '',
        nextMs,
        complete === 'YES' ? 'YES' : '',
      ]);
    }

    if (rows.length > 0) {
      csSheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
    }

    SpreadsheetApp.flush();
    Logger.log('Completion Summary rebuilt — ' + rows.length + ' rows.');

  } catch (err) {
    _handleError('rebuildCompletionSummary', err);
  }
}

/**
 * Updates a single apprentice row in the Completion Summary tab.
 * If the row doesn't exist, appends it.
 */
function _updateCompletionSummaryRow(apprenticeName) {
  // For simplicity and correctness, do a full rebuild.
  // Can be optimised to single-row writes if performance is an issue.
  rebuildCompletionSummary();
}


// ══════════════════════════════════════════════════════════════════════════════
// ██  NOTIFICATIONS LOG
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Appends a row to the Notifications Log tab.
 * Columns: A=Timestamp, B=Type, C=Apprentice Name, D=Detail, E=Emails Sent To, F=Triggered By
 */
function _logNotification(type, apprenticeName, detail, emailsSentTo, triggeredBy) {
  try {
    var ss        = _getSpreadsheet();
    var logName   = 'Notifications Log';
    var logSheet  = ss.getSheetByName(logName);
    if (!logSheet) {
      logSheet = ss.insertSheet(logName);
      logSheet.appendRow(['Timestamp', 'Type', 'Apprentice Name', 'Detail', 'Emails Sent To', 'Triggered By']);
    }
    logSheet.appendRow([new Date(), type, apprenticeName || '', detail || '', emailsSentTo || '', triggeredBy || '']);
  } catch (e) {
    Logger.log('_logNotification error: ' + e.toString());
  }
}

/**
 * Opens / scrolls to the Notifications Log tab.
 */
function viewNotificationsLog() {
  try {
    var ss       = _getSpreadsheet();
    var logSheet = ss.getSheetByName('Notifications Log');
    if (!logSheet) {
      _safeAlert('No Notifications Log tab found yet. It will be created on the next script event.');
      return;
    }
    ss.setActiveSheet(logSheet);
  } catch (e) {
    Logger.log('viewNotificationsLog error: ' + e.toString());
  }
}


// ══════════════════════════════════════════════════════════════════════════════
// ██  PDF EXPORT
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Exports a formatted PDF report of all apprentice OJT progress.
 * Emails the PDF to ADMIN_EMAIL and saves to Drive.
 */
function exportOJTReport() {
  try {
    var props    = PropertiesService.getScriptProperties().getProperties();
    var ss       = _getSpreadsheet();
    var rSheet   = _getSheetByGID(ss, GID_MASTER_ROSTER);
    var ojtSheet = _getSheetByGID(ss, GID_OJT_LOG);
    if (!rSheet || !ojtSheet) throw new Error('Could not find Master Roster or OJT Log tabs.');

    var rData   = rSheet.getDataRange().getValues();
    var ojtData = ojtSheet.getDataRange().getValues();

    // Build lookup: apprentice name → OJT log entries
    var ojtByName = {};
    for (var i = 1; i < ojtData.length; i++) {
      var r    = ojtData[i];
      var name = String(r[OJT_APPRENTICE] || '').trim();
      if (!name) continue;
      if (!ojtByName[name]) ojtByName[name] = [];
      ojtByName[name].push(r);
    }

    // Build export sheet
    var exportSheetName = 'OJT Export';
    var exportSheet = ss.getSheetByName(exportSheetName);
    if (exportSheet) { exportSheet.clearContents(); exportSheet.clearFormats(); }
    else             { exportSheet = ss.insertSheet(exportSheetName); }

    var C_NAVY  = '#1B3A6B', C_TEAL = '#1C7C8C', C_GOLD = '#D4920A';
    var C_WHITE = '#FFFFFF', C_LT   = '#F0F4FA';
    var row = 1;

    exportSheet.setRowHeight(row, 48);
    exportSheet.getRange(row, 1, 1, 8).merge()
      .setValue('NJTC TAP — OJT Progress Report  ·  SY 2025–2026')
      .setBackground(C_NAVY).setFontColor(C_WHITE).setFontWeight('bold').setFontSize(14)
      .setHorizontalAlignment('center').setVerticalAlignment('middle').setFontFamily('Arial');
    row++;

    exportSheet.getRange(row, 1, 1, 8).merge()
      .setValue('Generated: ' + new Date().toLocaleString() +
                '  ·  OJT Target: ' + (props.OJT_COMPLETION_HOURS || 4000) +
                ' hrs  ·  RTI Target: ' + (props.RTI_COMPLETION_HOURS || 288) + ' hrs')
      .setBackground(C_TEAL).setFontColor(C_WHITE).setFontSize(9)
      .setHorizontalAlignment('center').setVerticalAlignment('middle').setFontFamily('Arial');
    row++;

    exportSheet.setRowHeight(row, 5);
    exportSheet.getRange(row, 1, 1, 8).merge().setBackground(C_GOLD);
    row++;

    var hdrRow = row;
    exportSheet.setRowHeight(hdrRow, 28);
    ['Full Name','USDOL ID','Site','Region','OJT Hours','RTI Hours','OJT %','Status'].forEach(function(h, ci) {
      exportSheet.getRange(hdrRow, ci + 1)
        .setValue(h).setBackground(C_NAVY).setFontColor(C_WHITE)
        .setFontWeight('bold').setFontSize(9).setHorizontalAlignment('center')
        .setVerticalAlignment('middle').setFontFamily('Arial');
    });
    row++;

    var ojtMax = parseFloat(props.OJT_COMPLETION_HOURS) || 4000;

    for (var ri = 1; ri < rData.length; ri++) {
      var rd   = rData[ri];
      var fn   = String(rd[MR_FULL_NAME] || '').trim();
      if (!fn) continue;

      var ojtH    = parseFloat(rd[MR_OJT_HOURS_TOTAL]) || 0;
      var rtiH    = parseFloat(rd[MR_RTI_HOURS_TOTAL]) || 0;
      var ojtPct  = parseFloat(rd[MR_OJT_PCT]) || 0;
      var cmplt   = String(rd[MR_PROGRAM_COMPLETE] || '').trim().toUpperCase() === 'YES';
      var statusStr = cmplt ? 'Complete' : _pctStr(ojtPct);
      var bg      = ri % 2 === 0 ? C_LT : C_WHITE;

      exportSheet.setRowHeight(row, 18);
      [fn, String(rd[MR_DOL_ID] || ''), String(rd[MR_SITE] || ''), String(rd[MR_REGION] || ''),
       ojtH + ' / ' + ojtMax, rtiH, _pctStr(ojtPct), statusStr].forEach(function(val, ci) {
        var cell = exportSheet.getRange(row, ci + 1);
        cell.setValue(val).setBackground(bg).setFontSize(9).setFontFamily('Arial').setVerticalAlignment('middle');
        if (ci === 0) cell.setFontWeight('bold');
      });
      if (cmplt) exportSheet.getRange(row, 8).setBackground('#D5F5E3').setFontColor('#1A7A4A').setFontWeight('bold');
      row++;
    }

    exportSheet.setRowHeight(row, 5);
    exportSheet.getRange(row, 1, 1, 8).merge().setBackground(C_GOLD);
    row++;
    exportSheet.setRowHeight(row, 18);
    exportSheet.getRange(row, 1, 1, 8).merge()
      .setValue('NJTC Impact Solutions Group  ·  TAP Portal  ·  SY 2025–2026  ·  Confidential')
      .setBackground(C_NAVY).setFontColor('#9EC5E8').setFontSize(8)
      .setHorizontalAlignment('center').setFontStyle('italic').setFontFamily('Arial');

    for (var c = 1; c <= 8; c++) exportSheet.autoResizeColumn(c);
    SpreadsheetApp.flush();

    // Export as PDF
    var ssId    = props.SHEET_ID;
    var expGid  = exportSheet.getSheetId();
    var pdfUrl  = 'https://docs.google.com/spreadsheets/d/' + ssId +
                  '/export?format=pdf&gid=' + expGid +
                  '&size=letter&portrait=false&fitw=true&gridlines=false&printtitle=false&sheetnames=false';
    var token   = ScriptApp.getOAuthToken();
    var resp    = UrlFetchApp.fetch(pdfUrl, { headers: { Authorization: 'Bearer ' + token }, muteHttpExceptions: true });
    if (resp.getResponseCode() !== 200) throw new Error('PDF export failed — HTTP ' + resp.getResponseCode());

    var pdfBlob = resp.getBlob().setName(
      'NJTC TAP OJT Report ' + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd') + '.pdf'
    );
    var file = DriveApp.createFile(pdfBlob);

    GmailApp.sendEmail(
      props.ADMIN_EMAIL,
      'NJTC TAP — OJT Progress Report ' + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'MMMM d, yyyy'),
      'OJT Progress Report attached.\n\nGenerated: ' + new Date().toLocaleString() +
      '\nDrive link: ' + file.getUrl() + '\n\nNJTC Impact Solutions Group · TAP Portal',
      { attachments: [pdfBlob] }
    );

    _safeAlert('OJT Report exported!\n\nPDF saved to Drive and emailed to ' + props.ADMIN_EMAIL + '\nDrive: ' + file.getUrl());

  } catch (err) {
    _handleError('exportOJTReport', err);
    _safeAlert('Export failed: ' + err.toString());
  }
}


// ══════════════════════════════════════════════════════════════════════════════
// ██  TRIGGER INSTALLATION
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Installs form submit triggers for both forms.
 * Run once after deploying this script. Deletes duplicate triggers first.
 */
function installTriggers() {
  // Delete all existing triggers to avoid duplicates
  ScriptApp.getProjectTriggers().forEach(function(t) {
    ScriptApp.deleteTrigger(t);
  });

  var props       = PropertiesService.getScriptProperties().getProperties();
  var intakeFormId= props.INTAKE_FORM_ID;
  var ojtFormId   = props.OJT_FORM_ID;

  if (!intakeFormId || !ojtFormId) {
    _safeAlert('Missing Script Properties!\n\nPlease set INTAKE_FORM_ID and OJT_FORM_ID in Script Properties before installing triggers.\n\nProject Settings → Script Properties');
    return;
  }

  ScriptApp.newTrigger('onFormSubmit')
    .forForm(intakeFormId)
    .onFormSubmit()
    .create();

  ScriptApp.newTrigger('onOJTLogSubmit')
    .forForm(ojtFormId)
    .onFormSubmit()
    .create();

  Logger.log('Triggers installed: onFormSubmit (Intake) + onOJTLogSubmit (OJT Log)');
  _safeAlert(
    'Triggers installed!\n\n' +
    'onFormSubmit   → Intake Form (' + intakeFormId + ')\n' +
    'onOJTLogSubmit → OJT Log Form (' + ojtFormId + ')\n\n' +
    'Next: Deploy as Web App if needed.\nDeploy → New Deployment → Web App\nExecute as: Me | Access: Anyone'
  );
}


// ══════════════════════════════════════════════════════════════════════════════
// ██  WEB APP — CSV ENDPOINT FOR PORTAL JS
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Serves sheet tabs as CSV.
 * ?tab=master_roster | ojt_log | intake
 */
function doGet(e) {
  try {
    var tab = (e && e.parameter && e.parameter.tab) || 'master_roster';
    var ss  = _getSpreadsheet();
    var sheet;
    if      (tab === 'ojt_log') sheet = _getSheetByGID(ss, GID_OJT_LOG);
    else if (tab === 'intake')  sheet = _getSheetByGID(ss, GID_INTAKE);
    else                        sheet = _getSheetByGID(ss, GID_MASTER_ROSTER);

    if (!sheet) return ContentService.createTextOutput('Sheet not found: ' + tab).setMimeType(ContentService.MimeType.TEXT);
    return ContentService.createTextOutput(_sheetToCSV(sheet)).setMimeType(ContentService.MimeType.CSV);

  } catch (err) {
    Logger.log('doGet error: ' + err.toString());
    return ContentService.createTextOutput('Error: ' + err.toString()).setMimeType(ContentService.MimeType.TEXT);
  }
}


// ══════════════════════════════════════════════════════════════════════════════
// ██  VALIDATION HELPERS
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Validates an observer by Full Name and/or Email against the HR Master List CSV.
 * Returns true if valid Active leader, false if not. Fails open if HR CSV unreachable.
 */
function _validateObserver(observerName, observerEmail, hrUrl, academicYear) {
  try {
    var hrData = _fetchCSV(hrUrl);
    if (!hrData || hrData.length < 2) {
      Logger.log('HR Master List CSV empty or unreachable — failing open.');
      return true;
    }

    // Find header row
    var hIdx = -1;
    for (var r = 0; r < Math.min(5, hrData.length); r++) {
      if (hrData[r].indexOf(HR_COL_NAME) >= 0 || hrData[r].indexOf(HR_COL_EMAIL) >= 0) {
        hIdx = r; break;
      }
    }
    if (hIdx < 0) { Logger.log('HR header row not found — failing open.'); return true; }

    var header    = hrData[hIdx].map(function(h) { return String(h).trim(); });
    var colYear   = header.indexOf(HR_COL_YEAR);
    var colName   = header.indexOf(HR_COL_NAME);
    var colEmail  = header.indexOf(HR_COL_EMAIL);
    var colStatus = header.indexOf(HR_COL_STATUS);
    var colRole   = header.indexOf(HR_COL_ROLE);

    if (colName < 0 || colStatus < 0 || colRole < 0) {
      Logger.log('HR Master List missing required columns — failing open.');
      return true;
    }

    var normObsName  = observerName  ? observerName.trim().toLowerCase()  : '';
    var normObsEmail = observerEmail ? observerEmail.trim().toLowerCase() : '';

    for (var i = hIdx + 1; i < hrData.length; i++) {
      var row = hrData[i];
      if (!row || row.length <= colName) continue;
      if (colYear >= 0 && String(row[colYear] || '').trim() !== academicYear) continue;
      if (String(row[colStatus] || '').trim() !== 'Active') continue;

      var rowName  = String(row[colName]  || '').trim().toLowerCase();
      var rowEmail = colEmail >= 0 ? String(row[colEmail] || '').trim().toLowerCase() : '';

      var nameMatch  = normObsName  && rowName  === normObsName;
      var emailMatch = normObsEmail && rowEmail === normObsEmail;

      if (nameMatch || emailMatch) {
        var role = String(row[colRole] || '').trim();
        if (_isLeaderRole(role)) return true;
        Logger.log('Observer "' + observerName + '" matched HR but role "' + role + '" is not a leader role.');
        return false;
      }
    }

    Logger.log('Observer not found as Active leader in HR Master List: ' + observerName);
    return false;

  } catch (err) {
    Logger.log('_validateObserver error: ' + err.toString() + ' — failing open.');
    return true;
  }
}

function _isLeaderRole(role) {
  return LEADER_ROLES.indexOf(role) !== -1;
}

/**
 * Finds the matching row in the Master Roster by full name (col F = MR_FULL_NAME).
 * Falls back to First+Last concatenation. Case-insensitive, trimmed.
 * Returns { rowIndex (1-based), data } or null.
 */
function _findRosterRow(rSheet, apprenticeName) {
  var data    = rSheet.getDataRange().getValues();
  var normLookup = _normName(apprenticeName);

  for (var i = 1; i < data.length; i++) {
    var fn = String(data[i][MR_FULL_NAME] || '').trim();
    if (_normName(fn) === normLookup) return { rowIndex: i + 1, data: data[i] };

    // Fallback: First + Last
    var fl = (String(data[i][MR_FIRST_NAME] || '') + ' ' + String(data[i][MR_LAST_NAME] || '')).trim();
    if (_normName(fl) === normLookup) return { rowIndex: i + 1, data: data[i] };
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

function _fetchCSV(url) {
  var resp = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
  if (resp.getResponseCode() !== 200) return null;
  return Utilities.parseCsv(resp.getContentText());
}

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

function _normName(name) {
  return String(name || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function _pctStr(ratio) {
  return Math.round((ratio || 0) * 100) + '%';
}

function _formatMonYY(date) {
  return Utilities.formatDate(date, Session.getScriptTimeZone(), 'MMM-yy');
}

function _buildIntakeEmailBody(fullName, email, nv) {
  var lines = [
    'A new TAP apprenticeship application has been submitted.',
    '',
    '━━━━━━━━━━━━━━━━━━━━',
    'APPLICANT',
    '━━━━━━━━━━━━━━━━━━━━',
    'Name:    ' + fullName,
    'Email:   ' + (email || 'Not provided'),
    'Submitted: ' + new Date().toLocaleString(),
    '',
    '━━━━━━━━━━━━━━━━━━━━',
    'FULL APPLICATION RESPONSES',
    '━━━━━━━━━━━━━━━━━━━━',
  ];
  Object.keys(nv).forEach(function(key) {
    var val = (nv[key] && nv[key][0]) ? String(nv[key][0]).trim() : '';
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

/**
 * Central error handler — logs to Notifications Log and emails ADMIN_EMAIL.
 */
function _handleError(fnName, err) {
  var detail = 'Function: ' + fnName + '\nError: ' + err.toString() + '\nStack: ' + (err.stack || 'N/A') + '\nTime: ' + new Date().toISOString();
  Logger.log('Error in ' + fnName + ': ' + err.toString());
  try {
    _logNotification('SCRIPT_ERROR', '', detail, '', fnName);
  } catch (le) {
    Logger.log('Could not log to Notifications Log: ' + le.toString());
  }
  try {
    var props = PropertiesService.getScriptProperties().getProperties();
    var admin = props.ADMIN_EMAIL || 'amir@njtutoringcorps.org';
    GmailApp.sendEmail(
      admin,
      'NJTC TAP Script Error: ' + fnName,
      'An error occurred in the TAP Apps Script.\n\n' + detail +
      '\n\nReview the script execution log:\nExtensions → Apps Script → Executions'
    );
  } catch (emailErr) {
    Logger.log('CRITICAL: Could not send error email. Original: ' + err.toString() + ' | Email error: ' + emailErr.toString());
  }
}


// ══════════════════════════════════════════════════════════════════════════════
// ██  OJT PRE-FILL URL GENERATOR
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Generates a pre-filled OJT Log Google Form URL.
 */
function buildOJTFormURL(apprenticeName, phase, domain, activity, completed) {
  var base = 'https://docs.google.com/forms/d/1MOsppwhQmagAhVSHs29Ms4o9Ky4xYOyqy8Qs4uTrwbQ/viewform';
  var params = [
    'entry.1113592438=' + encodeURIComponent(apprenticeName || ''),
    'entry.2084410404=' + encodeURIComponent(phase          || ''),
    'entry.1916953177=' + encodeURIComponent(domain         || ''),
    'entry.1818518596=' + encodeURIComponent(activity       || ''),
    'entry.272707685='  + encodeURIComponent(completed      || ''),
  ];
  return base + '?' + params.join('&');
}

function testBuildOJTFormURL() {
  var url = buildOJTFormURL('Caela Wilkerson', 'Phase 1', 'Instructional Delivery', 'Delivered a structured lesson using iReady materials', 'Y');
  Logger.log('Pre-fill URL: ' + url);
}
