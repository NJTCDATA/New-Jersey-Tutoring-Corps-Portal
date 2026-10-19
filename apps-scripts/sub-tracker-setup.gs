/**
 * ╔══════════════════════════════════════════════════════════════════════════════╗
 * ║  NJTC — Sub Tracker setup (NE / SW regional substitute logs)               ║
 * ║  Google Apps Script — bound to the Sub Tracker spreadsheet                 ║
 * ╠══════════════════════════════════════════════════════════════════════════════╣
 * ║  INSTALL: open the Sub Tracker spreadsheet → Extensions → Apps Script →    ║
 * ║  paste this file → Save → reload the spreadsheet. A "NJTC Sub Tracker"     ║
 * ║  menu appears. Run "Set up / repair tracker tabs" once (and again any      ║
 * ║  time rows are added past the formatted range or the roster changes).      ║
 * ╠══════════════════════════════════════════════════════════════════════════════╣
 * ║  WHAT IT DOES (every tab whose row 1 has "Sub" and "Tutor Covering"):      ║
 * ║   • Grades → plain text, so "3-5" stays "3-5" (Sheets was turning it into  ║
 * ║     the date 3/5/2026). Grades already converted are put back to "3-5".   ║
 * ║   • Sub / Tutor Covering → dropdowns of current staff from the SY Onsite   ║
 * ║     Tracker, plus "Vacant Tutor". A name not on the list can still be      ║
 * ║     typed (it shows a warning, it is not rejected).                        ║
 * ║   • Site Covering → dropdown of the Onsite Tracker locations (warning only)║
 * ║   • Date → a warning unless it is one date ("10/14"), a range              ║
 * ║     ("10/13-10/15") or dates joined with "&" ("10/3 & 10/5").              ║
 * ║  It never adds, removes, renames or reorders columns, so the NE / SW Sub   ║
 * ║  Tracker tabs mirrored into the Pearl workbook keep working.               ║
 * ╚══════════════════════════════════════════════════════════════════════════════╝
 */

// ─── CONFIG ──────────────────────────────────────────────────────────────────
// SY Onsite Tracker — same sheet the onsite portal reads for the current-year
// roster (onsite/data-sources.js ONSITE_TRACKER_SHEET_ID / ONSITE_TRACKER_GID).
// Swap at school-year rollover.
var ST_ROSTER_SHEET_ID = '1x3dWZQhx9XWqB8YASInOMTr0JDjSRMqv3w7PmcruuMU';
var ST_ROSTER_GID      = 0;
var ST_LISTS_TAB       = 'Lists (do not edit)';   // hidden helper tab the dropdowns read from
var ST_FORMAT_ROWS     = 1000;                    // rows below the header to format / validate
var ST_VACANT          = 'Vacant Tutor';

// ─── MENU ────────────────────────────────────────────────────────────────────
function onOpen() {
  try {
    SpreadsheetApp.getUi()
      .createMenu('NJTC Sub Tracker')
      .addItem('Set up / repair tracker tabs', 'stSetupAll')
      .addItem('Refresh staff & site dropdowns only', 'stRefreshLists')
      .addToUi();
  } catch (e) {
    Logger.log('onOpen menu error: ' + e);
  }
}

// ─── ENTRY POINTS ────────────────────────────────────────────────────────────
function stSetupAll() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var lists = stRefreshLists_(ss);
  var done = [];
  ss.getSheets().forEach(function (sh) {
    if (sh.getName() === ST_LISTS_TAB) return;
    var cols = stHeaderCols_(sh);
    if (!cols) return;
    var fixed = stFixGrades_(sh, cols);
    stApplyFormats_(sh, cols, lists);
    done.push(sh.getName() + (fixed ? ' (' + fixed + ' grade cell' + (fixed === 1 ? '' : 's') + ' restored)' : ''));
  });
  SpreadsheetApp.getUi().alert(done.length
    ? 'Sub Tracker set up on: ' + done.join(', ') + '.\n\nStaff list: ' + lists.staffCount + ' names · Sites: ' + lists.siteCount + '.'
    : 'No tab has "Sub" and "Tutor Covering" in row 1 — nothing was changed.');
}

function stRefreshLists() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var lists = stRefreshLists_(ss);
  SpreadsheetApp.getUi().alert('Dropdown lists refreshed: ' + lists.staffCount + ' staff names, ' + lists.siteCount + ' sites.');
}

// ─── HELPERS ─────────────────────────────────────────────────────────────────
// Row-1 header positions (1-based). null when this is not a tracker tab.
function stHeaderCols_(sh) {
  var lastCol = sh.getLastColumn();
  if (lastCol < 2) return null;
  var h = sh.getRange(1, 1, 1, lastCol).getValues()[0].map(function (v) {
    return String(v || '').replace(/\s+/g, ' ').trim().toLowerCase();
  });
  var find = function (name) {
    var i = h.indexOf(name);
    if (i < 0) for (var j = 0; j < h.length; j++) if (h[j].indexOf(name) === 0) { i = j; break; }
    return i < 0 ? null : i + 1;
  };
  var cols = {
    sub:     h.indexOf('sub') >= 0 ? h.indexOf('sub') + 1 : null,   // exact — "subjects" must not match
    tutor:   find('tutor covering') || find('absent tutor'),
    grades:  find('grades'),
    date:    h.indexOf('date') >= 0 ? h.indexOf('date') + 1 : null, // exact — not "date you called"
    site:    find('site covering')
  };
  return (cols.sub && cols.tutor) ? cols : null;
}

// Grades cells Sheets turned into dates → "m-d" text. Returns how many.
function stFixGrades_(sh, cols) {
  if (!cols.grades) return 0;
  var n = Math.max(sh.getLastRow() - 1, 0);
  if (!n) return 0;
  var rng = sh.getRange(2, cols.grades, n, 1);
  var vals = rng.getValues();
  var fixed = 0;
  var out = vals.map(function (r) {
    var v = r[0];
    if (v instanceof Date && !isNaN(v.getTime())) { fixed++; return [(v.getMonth() + 1) + '-' + v.getDate()]; }
    return [v];
  });
  rng.setNumberFormat('@');           // text first, so the restored "3-5" is not re-parsed
  if (fixed) rng.setValues(out);
  return fixed;
}

function stApplyFormats_(sh, cols, lists) {
  var rows = Math.max(ST_FORMAT_ROWS, sh.getMaxRows() - 1);
  if (sh.getMaxRows() < rows + 1) sh.insertRowsAfter(sh.getMaxRows(), rows + 1 - sh.getMaxRows());
  var lt = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(ST_LISTS_TAB);

  if (cols.grades) sh.getRange(2, cols.grades, rows, 1).setNumberFormat('@');

  if (lt && lists.staffCount) {
    var staffRange = lt.getRange(2, 1, lists.staffCount + 1, 1);   // + "Vacant Tutor"
    var staffRule = SpreadsheetApp.newDataValidation()
      .requireValueInRange(staffRange, true).setAllowInvalid(true)
      .setHelpText('Pick the staff member from the list (full name as in Pearl). Not listed? Type the full name — it is allowed but flagged.')
      .build();
    sh.getRange(2, cols.sub, rows, 1).setDataValidation(staffRule);
    sh.getRange(2, cols.tutor, rows, 1).setDataValidation(staffRule);
  }
  if (lt && cols.site && lists.siteCount) {
    var siteRule = SpreadsheetApp.newDataValidation()
      .requireValueInRange(lt.getRange(2, 2, lists.siteCount, 1), true).setAllowInvalid(true)
      .setHelpText('Pick the site from the list.')
      .build();
    sh.getRange(2, cols.site, rows, 1).setDataValidation(siteRule);
  }
  if (cols.date) {
    var a1 = sh.getRange(2, cols.date).getA1Notation().replace(/\d+$/, '') + '2';   // e.g. "E2" (relative)
    var MD = '\\d{1,2}/\\d{1,2}(/\\d{2,4})?';
    var pattern = '^(' + MD + ')(\\s*-\\s*' + MD + '|(\\s*&\\s*' + MD + ')*)$';
    var dateRule = SpreadsheetApp.newDataValidation()
      .requireFormulaSatisfied('=OR(ISBLANK(' + a1 + '),ISDATE(' + a1 + '),REGEXMATCH(TO_TEXT(' + a1 + '),"' + pattern + '"))')
      .setAllowInvalid(true)
      .setHelpText('One date (10/14), one range (10/13-10/15), or dates joined with & (10/3 & 10/5). One substitute assignment per row.')
      .build();
    sh.getRange(2, cols.date, rows, 1).setDataValidation(dateRule);
  }
}

// Rebuilds the hidden Lists tab from the SY Onsite Tracker:
//   column A = active staff full names (+ "Vacant Tutor"), column B = sites.
function stRefreshLists_(ss) {
  var staff = {}, sites = {};
  var src = SpreadsheetApp.openById(ST_ROSTER_SHEET_ID);
  var sheet = null;
  src.getSheets().forEach(function (s) { if (s.getSheetId() === ST_ROSTER_GID) sheet = s; });
  if (!sheet) throw new Error('Onsite Tracker tab (gid ' + ST_ROSTER_GID + ') not found — check ST_ROSTER_SHEET_ID / ST_ROSTER_GID.');
  var data = sheet.getDataRange().getValues();
  var hIdx = -1;
  for (var i = 0; i < Math.min(data.length, 20); i++) {
    if (String(data[i][0] || '').trim().toLowerCase() === 'cycle') { hIdx = i; break; }
  }
  if (hIdx < 0) throw new Error('Onsite Tracker header row (starting "Cycle") not found.');
  var H = data[hIdx].map(function (h) { return String(h || '').replace(/\s+/g, ' ').trim().toLowerCase(); });
  var cF = H.indexOf('first name'), cL = H.indexOf('last name'), cLoc = H.indexOf('locations'), cT = H.indexOf('terminated?');
  if (cF < 0 || cL < 0) throw new Error('Onsite Tracker is missing "First Name" / "Last Name" columns.');
  for (var r = hIdx + 1; r < data.length; r++) {
    var row = data[r];
    if (cT >= 0 && String(row[cT] || '').trim().toLowerCase() === 'yes') continue;
    var name = (String(row[cF] || '').trim() + ' ' + String(row[cL] || '').trim()).trim();
    if (name) staff[name] = true;
    if (cLoc >= 0) String(row[cLoc] || '').split(/[,;\n]/).forEach(function (loc) {
      loc = loc.trim();
      if (loc && !/^all\b/i.test(loc)) sites[loc] = true;
    });
  }
  var staffList = Object.keys(staff).sort();
  var siteList = Object.keys(sites).sort();

  var lt = ss.getSheetByName(ST_LISTS_TAB) || ss.insertSheet(ST_LISTS_TAB);
  lt.clear();
  var height = Math.max(staffList.length + 2, siteList.length + 1, 2);
  var grid = [];
  for (var k = 0; k < height; k++) grid.push(['', '']);
  grid[0] = ['Staff (Sub / Tutor Covering)', 'Sites'];
  staffList.forEach(function (n, j) { grid[j + 1][0] = n; });
  grid[staffList.length + 1][0] = ST_VACANT;
  siteList.forEach(function (s, j) { grid[j + 1][1] = s; });
  lt.getRange(1, 1, height, 2).setNumberFormat('@').setValues(grid);
  // A newly inserted tab becomes the active one — move off it before hiding.
  var firstOther = ss.getSheets().filter(function (s) { return s.getName() !== ST_LISTS_TAB; })[0];
  if (firstOther) ss.setActiveSheet(firstOther);
  if (!lt.isSheetHidden()) lt.hideSheet();
  return { staffCount: staffList.length, siteCount: siteList.length };
}
