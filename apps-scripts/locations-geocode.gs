/**
 * ╔══════════════════════════════════════════════════════════════════════════════╗
 * ║  NJTC — Locations geocoder (SY Analytics map pins)                         ║
 * ║  Google Apps Script — bound to the Onsite Tracker workbook                 ║
 * ║  ("Automated: Onsite 26-27 Tracker", tab "Locations")                      ║
 * ╠══════════════════════════════════════════════════════════════════════════════╣
 * ║  INSTALL: open the Onsite Tracker → Extensions → Apps Script → paste this  ║
 * ║  file → Save → reload. Use the "NJTC Locations" menu:                      ║
 * ║    • Geocode new / changed addresses  (run after adding or editing sites)  ║
 * ║    • Re-geocode every address                                             ║
 * ╠══════════════════════════════════════════════════════════════════════════════╣
 * ║  Writes four columns AFTER the last existing column (nothing moves):       ║
 * ║    Latitude · Longitude · Geocoded Address · Geocode Status                ║
 * ║  The portal pins a site from Latitude/Longitude only while "Geocoded       ║
 * ║  Address" still equals the row's Address — re-sorted rows or edited        ║
 * ║  addresses never show a stale pin; just run the menu again.                ║
 * ║  Uses Apps Script's built-in Google geocoder (no API key).                 ║
 * ║  If "Locations" is itself an IMPORTRANGE/QUERY result, run this on the     ║
 * ║  SOURCE sheet's Locations tab instead (an import would overwrite or        ║
 * ║  collide with the new columns).                                            ║
 * ╚══════════════════════════════════════════════════════════════════════════════╝
 */

var LG_TAB_GID   = 1830091227;   // "Locations" tab (same gid the portal reads)
var LG_TAB_NAME  = 'Locations';  // fallback when the gid differs (e.g. a copy)
var LG_NEW_COLS  = ['Latitude', 'Longitude', 'Geocoded Address', 'Geocode Status'];
// Program footprint (NJ + Philadelphia). A result outside this box is not written.
var LG_BOUNDS    = { latMin: 38.8, latMax: 41.4, lngMin: -75.8, lngMax: -73.8 };

function onOpen() {
  try {
    SpreadsheetApp.getUi()
      .createMenu('NJTC Locations')
      .addItem('Geocode new / changed addresses', 'lgGeocodeChanged')
      .addItem('Re-geocode every address', 'lgGeocodeAll')
      .addToUi();
  } catch (e) {
    Logger.log('onOpen menu error: ' + e);
  }
}

function lgGeocodeChanged() { lgRun_(false); }
function lgGeocodeAll()     { lgRun_(true); }

function lgSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var byGid = ss.getSheets().filter(function (s) { return s.getSheetId() === LG_TAB_GID; })[0];
  var sh = byGid || ss.getSheetByName(LG_TAB_NAME);
  if (!sh) throw new Error('Locations tab not found (gid ' + LG_TAB_GID + ' / name "' + LG_TAB_NAME + '").');
  return sh;
}

// Same normalization the portal uses to compare addresses.
function lgNorm_(v) { return String(v == null ? '' : v).replace(/[\r\n]+/g, ' ').replace(/\s{2,}/g, ' ').trim().toLowerCase(); }

// Address text → geocoder query: drop phone numbers and P.O. boxes, flatten lines.
function lgQuery_(addr) {
  return String(addr || '')
    .replace(/\(?\d{3}\)?[\s.\-]?\d{3}[\s.\-]\d{4}/g, ' ')
    .replace(/p\.?\s*o\.?\s*box\s*\d+/ig, ' ')
    .replace(/[\r\n;]+/g, ', ')
    .replace(/\s*,\s*(,\s*)+/g, ', ')
    .replace(/\s{2,}/g, ' ')
    .replace(/^[\s,]+|[\s,]+$/g, '');
}

function lgRun_(all) {
  var sh = lgSheet_();
  var lastRow = sh.getLastRow(), lastCol = sh.getLastColumn();
  var data = sh.getRange(1, 1, lastRow, lastCol).getValues();

  // Header row = the one whose column A says "Cycle" (row 3 today)
  var hIdx = -1;
  for (var i = 0; i < Math.min(10, data.length); i++) {
    if (String(data[i][0] || '').trim().toLowerCase() === 'cycle') { hIdx = i; break; }
  }
  if (hIdx < 0) throw new Error('Header row (column A = "Cycle") not found in the first 10 rows.');
  var H = data[hIdx].map(function (h) { return String(h || '').replace(/\s+/g, ' ').trim().toLowerCase(); });
  var cAddr = H.indexOf('address'), cSchool = H.indexOf('school name');
  if (cAddr < 0) throw new Error('No "Address" column in the header row.');

  // Find or create the four output columns (after the last header cell)
  var lastHeader = 0;
  H.forEach(function (h, j) { if (h) lastHeader = j + 1; });
  var cols = {};
  LG_NEW_COLS.forEach(function (name) {
    var j = H.indexOf(name.toLowerCase());
    if (j < 0) {
      lastHeader++;
      if (lastHeader > sh.getMaxColumns()) sh.insertColumnsAfter(sh.getMaxColumns(), lastHeader - sh.getMaxColumns());
      sh.getRange(hIdx + 1, lastHeader).setValue(name).setFontWeight('bold');
      j = lastHeader - 1;
    }
    cols[name] = j + 1;   // 1-based
  });
  if (sh.getLastColumn() > lastCol) data = sh.getRange(1, 1, lastRow, sh.getLastColumn()).getValues();

  var geocoder = Maps.newGeocoder().setRegion('us');
  var done = 0, skipped = 0, problems = [];
  for (var r = hIdx + 1; r < data.length; r++) {
    var row = data[r];
    var addr = row[cAddr];
    var school = cSchool >= 0 ? String(row[cSchool] || '').trim() : '';
    if (!lgNorm_(addr)) continue;
    var have = row[cols['Latitude'] - 1] !== '' && row[cols['Longitude'] - 1] !== '';
    var same = lgNorm_(row[cols['Geocoded Address'] - 1]) === lgNorm_(addr);
    if (!all && have && same) { skipped++; continue; }

    var q = lgQuery_(addr), lat = '', lng = '', status;
    try {
      var res = geocoder.geocode(q);
      if (res.status !== 'OK' || !res.results || !res.results.length) {
        status = 'Not found (' + res.status + ') — check the address';
      } else {
        var top = res.results[0], loc = top.geometry.location;
        if (loc.lat < LG_BOUNDS.latMin || loc.lat > LG_BOUNDS.latMax || loc.lng < LG_BOUNDS.lngMin || loc.lng > LG_BOUNDS.lngMax) {
          status = 'Outside NJ/PA — check the address (' + top.formatted_address + ')';
        } else {
          lat = Math.round(loc.lat * 1e6) / 1e6;
          lng = Math.round(loc.lng * 1e6) / 1e6;
          var approx = top.partial_match || top.geometry.location_type === 'APPROXIMATE';
          status = (approx ? 'Approximate — please check: ' : 'OK: ') + top.formatted_address;
        }
      }
    } catch (e) {
      status = 'Error: ' + e.message;
    }
    if (!lat || status.indexOf('OK:') !== 0) problems.push((school || 'Row ' + (r + 1)) + ' — ' + status);
    sh.getRange(r + 1, cols['Latitude'], 1, 4).setValues([[lat, lng, lat ? addr : '', status]]);
    done++;
    Utilities.sleep(250);
  }
  SpreadsheetApp.getUi().alert('Geocoded ' + done + ' address' + (done === 1 ? '' : 'es') +
    (skipped ? ' (' + skipped + ' unchanged, skipped)' : '') + '.' +
    (problems.length ? '\n\nNeeds a look:\n• ' + problems.join('\n• ') : '\n\nAll addresses placed.'));
}
