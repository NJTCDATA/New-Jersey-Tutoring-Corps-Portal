/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║  NJTC TAP — OJT AUDIT: OTJ log vs. each person's OJT workbook(s)         ║
 * ║  Add-on file for the TAP Tracker 26-27 Apps Script project.             ║
 * ╠══════════════════════════════════════════════════════════════════════════╣
 * ║  Why: the original Summer 2026 import (before the v11 matcher fix, and  ║
 * ║  for some people with a missing/ambiguous summer link) wrote activities ║
 * ║  that are not checked anywhere in the person's workbook. Example (TAP   ║
 * ║  Tracker export #60): Tohrn Taylor has 20 activities in the OTJ log     ║
 * ║  (1,000 hrs) but only 13 are checked across his Summer 2026 and SY      ║
 * ║  26-27 checklist tabs (650 hrs).                                         ║
 * ║                                                                          ║
 * ║  STEP 1  runOJTAudit()        READ-ONLY. Opens every workbook linked on  ║
 * ║          the Onsite DB "SY 26-27 OJT" and "Summer 26 OJT" tabs, reads    ║
 * ║          EVERY checklist tab, matches each Y to the 80-activity schema   ║
 * ║          by text (same matcher as the sync), and compares with the OTJ   ║
 * ║          log. Writes one row per person to the "OJT Audit" tab.          ║
 * ║  STEP 2  Review the "OJT Audit" tab. Untick "Apply?" for anyone you do   ║
 * ║          not want changed.                                               ║
 * ║  STEP 3  applyOJTAuditFixes() for the ticked rows:                       ║
 * ║           • REMOVES imported rows (Summer Import / SY 26-27 Import) for  ║
 * ║             activities that are not checked on ANY checklist tab of the  ║
 * ║             person's workbook(s). Every removed row is copied first to   ║
 * ║             "OJT Audit — Removed Rows" (nothing is lost).                ║
 * ║           • ADDS activities checked AND dated June 2026 or later that    ║
 * ║             are missing from the log (v2). Undated or earlier marks are  ║
 * ║             listed, never added — workbooks also hold SY 25-26 work.     ║
 * ║             Never for Completed Program people.                          ║
 * ║           • Never touches portal-logged rows or RTI rows.                ║
 * ║           • Recalculates each changed person.                            ║
 * ║                                                                          ║
 * ║  Menu lines (add to onOpen in the main script, before .addToUi()):       ║
 * ║    .addSeparator()                                                       ║
 * ║    .addItem('OJT Audit: 1) Check log vs workbooks', 'runOJTAudit')       ║
 * ║    .addItem('OJT Audit: 2) Apply ticked fixes',     'applyOJTAuditFixes')║
 * ║    .addItem('OJT Audit: Undo prior-year/undated adds', 'undoOJTAuditPriorYearAdds')
 * ║    .addItem('OJT Audit: Restore SY 25-26 continuation', 'restoreContinuationAdds')
 * ╚══════════════════════════════════════════════════════════════════════════╝
 */

var OJT_AUDIT = {
  SHEET: 'OJT Audit',
  REMOVED_SHEET: 'OJT Audit — Removed Rows',
  CURSOR_PROP: 'OJT_AUDIT_CURSOR',
  HANDLER: 'continueOJTAudit',
  TIME_BUDGET_MS: 270 * 1000,
  MAX_AGE_HOURS: 24,
  LOG_TYPE_ADD: 'OJT Activity completion (Audit Import)',
  // v2: additions only for checkmarks dated in the Summer 2026 / SY 26-27
  // window. Workbooks also hold SY 25-26 work (tabs like "SY 25-26/Summer 2026"
  // or a single unlabeled checklist), so undated or earlier checkmarks are
  // never added — they are listed in Notes instead.
  ADD_FROM: new Date(2026, 5, 1),
  // v3 (NJTC decision 11/3/2026): TAP is a continuation. For people still in
  // the program (Apprentice / Pre-apprentice track — not Completed Program,
  // not Tutors) dated checkmarks from SY 25-26 count too, back to the first
  // tracked month (Mar-25). Undated checkmarks are still never added.
  CONTINUATION_FROM: new Date(2025, 2, 1),
  STATUS_ADD: 'Y — Observed and completed (Audit Import)',
};
var OJT_AUDIT_HEADERS = [
  'Apply?', 'Master Roster Name', 'Role', 'Workbook tabs read',
  'Activities in log', 'Activities supported', 'Hours now', 'Hours after fix', 'Change (hrs)',
  'REMOVE — imported, not checked in any workbook tab',
  'ADD — checked and dated (apprentices: Mar-25 on; others: June 2026 on), missing from log',
  'Kept — logged in the portal (not in workbook)',
  'Notes', 'Audited'
];

// ── Menu entry points ─────────────────────────────────────────────────────────
function runOJTAudit() {
  PropertiesService.getScriptProperties().deleteProperty(OJT_AUDIT.CURSOR_PROP);
  _sy2627DeleteTriggers(OJT_AUDIT.HANDLER);
  var res = _ojtAuditRun(0);
  if (res && res.done) _safeAlert(_ojtAuditSummary());
  else if (res) _safeAlert('OJT Audit is large, so it saved its place after ' + res.at + ' people and will continue automatically in about a minute. Open the "OJT Audit" tab when it finishes.');
}
function continueOJTAudit() {
  _sy2627DeleteTriggers(OJT_AUDIT.HANDLER);
  var cur = parseInt(PropertiesService.getScriptProperties().getProperty(OJT_AUDIT.CURSOR_PROP) || '0', 10);
  _ojtAuditRun(cur);
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function _ojtAuditPhaseKey(ph) {
  var p = String(ph || '').toLowerCase();
  return p.indexOf('begin') >= 0 ? 'beginning' : p.indexOf('mid') >= 0 ? 'middle' : p.indexOf('end') >= 0 ? 'end' : p;
}
function _ojtAuditKey(phase, domain, code) {
  return _ojtAuditPhaseKey(phase) + '|' + String(domain || '').trim().toLowerCase() + '|' +
         String(code || '').split(/\s*[—\-]\s*/)[0].trim().toUpperCase();
}
function _ojtAuditLabel(phase, domain, code) {
  var p = _ojtAuditPhaseKey(phase);
  return (p.charAt(0).toUpperCase() + p.slice(1)) + '|' + String(domain || '').trim() + '|' + String(code || '').split(/\s*[—\-]\s*/)[0].trim().toUpperCase();
}
function _ojtAuditIsImport(logType) { return /import/i.test(String(logType || '')); }
function _ojtAuditTabYear(name) {
  var n = String(name || '');
  if (/26\s*[-\/]\s*27|2026\s*[-\/]\s*2027|\bsy\s*26/i.test(n)) return 'SY 26-27';
  if (/summer/i.test(n)) return 'Summer 2026';
  return '';
}
function _ojtAuditChecklistTabs(wb) {
  return wb.getSheets().filter(function(s) {
    var n = s.getName().toLowerCase();
    return (n.indexOf('job training checklist') >= 0 || /\bojt\b/.test(n) || n.indexOf('checklist') >= 0) &&
           !/narrative|crosswalk|resource|career/.test(n);
  });
}
/** Every Y on one checklist tab → { key: {label, date, tab} }. Same row rules as the SY 26-27 sync. */
function _ojtAuditReadTab(sheet, schemaIndex, out, unmatched) {
  var data = sheet.getDataRange().getValues();
  var phase = '', dom = '';
  for (var i = 0; i < data.length; i++) {
    var b = String(data[i][1] || '').trim(), c = String(data[i][2] || '').trim(), e = String(data[i][4] || '').trim();
    if (/beginning of (the )?program/i.test(b)) phase = 'Beginning';
    else if (/middle of (the )?program/i.test(b)) phase = 'Middle';
    else if (/end of (the )?program/i.test(b)) phase = 'End';
    if (i < 10) continue;
    if (b && !c) { dom = b; continue; }
    if (!c || !/^y/i.test(e)) continue;
    var m = _matchActivityByText(schemaIndex, phase, dom, c);
    if (!m) { unmatched.push(sheet.getName() + ': "' + c.substring(0, 50) + '"'); continue; }
    var key = _ojtAuditKey(m.phase, m.domain, m.code);
    var d = _sy2627ParseDate(data[i][5]);
    var ok = d && d >= new Date(2025, 2, 1) && d <= new Date(Date.now() + 31 * 86400000);
    if (!out[key] || (ok && (!out[key].date || d < out[key].date))) {
      out[key] = { label: _ojtAuditLabel(m.phase, m.domain, m.code), date: ok ? d : (out[key] ? out[key].date : null), tab: sheet.getName() };
    }
  }
}

/** Roster name → [{id, source}] from the SY 26-27 Workbook Progress tab and the Summer 26 OJT tab. */
function _ojtAuditWorkbookIndex(ss, onsiteDb, roster) {
  var idx = {}, roles = {};
  function add(name, id, source, role) {
    if (!name || !id) return;
    var k = _normName(name);
    idx[k] = idx[k] || [];
    if (!idx[k].some(function(x) { return x.id === id; })) idx[k].push({ id: id, source: source });
    if (role && !roles[k]) roles[k] = role;
  }
  // SY 26-27: exact Master Roster name + workbook link written by the sync.
  var prog = ss.getSheetByName(SY2627.PROGRESS_SHEET);
  if (prog && prog.getLastRow() > 1) {
    var rng = prog.getRange(1, 1, prog.getLastRow(), prog.getLastColumn());
    var v = rng.getValues(), f = rng.getFormulas(), h = v[0].map(String);
    var cName = h.indexOf('Master Roster Name'), cLink = h.indexOf('OJT Workbook'), cRole = h.indexOf('Role (directory)');
    for (var i = 1; i < v.length; i++) {
      var m = String(f[i][cLink] || '').match(/HYPERLINK\("([^"]+)"/i);
      add(String(v[i][cName] || '').trim(), m ? _sy2627IdFromUrl(m[1]) : '', 'SY 26-27 OJT', String(v[i][cRole] || '').trim());
    }
  }
  // Summer 2026: links from the Onsite DB export (handles Drive file chips); names matched to the roster.
  var st = onsiteDb.getSheetByName(SUMMER_OJT_TAB_NAME);
  if (st && st.getLastRow() >= 4) {
    var last = st.getLastRow();
    var vals = st.getRange(4, 1, last - 3, 2).getValues();
    var links = _sy2627ExportLinks(onsiteDb.getId(), SUMMER_OJT_TAB_NAME, 3, 4, last);
    if (!links.filter(Boolean).length) links = _sy2627ApiLinks(onsiteDb.getId(), SUMMER_OJT_TAB_NAME, 3, 4, last);
    for (var j = 0; j < vals.length; j++) {
      var nm = String(vals[j][0] || '').trim(); if (!nm) continue;
      var rr = _demoFuzzyMatch(_sy2627StripAccents(nm), roster);
      if (rr) add(rr.name, _sy2627IdFromUrl(links[j]), 'Summer 26 OJT', String(vals[j][1] || '').trim());
    }
  }
  return { idx: idx, roles: roles };
}

/** OTJ log → person → { key: {label, rows:[{row, import, logType}]} } (Y rows only, RTI excluded). */
function _ojtAuditLogIndex(ojtSheet) {
  var data = ojtSheet.getDataRange().getValues(), out = {};
  for (var i = 1; i < data.length; i++) {
    var r = data[i];
    if (/rti/i.test(String(r[OJT_LOG_TYPE] || ''))) continue;
    if (!/^y/i.test(String(r[OJT_STATUS] || '').trim())) continue;
    var name = String(r[OJT_APPRENTICE] || '').trim(); if (!name) continue;
    if (!r[OJT_PHASE] || !r[OJT_DOMAIN] || !r[OJT_ACTIVITY]) continue;
    var k = _normName(name), key = _ojtAuditKey(r[OJT_PHASE], r[OJT_DOMAIN], r[OJT_ACTIVITY]);
    out[k] = out[k] || { name: name, keys: {} };
    var e = out[k].keys[key] = out[k].keys[key] || { label: _ojtAuditLabel(r[OJT_PHASE], r[OJT_DOMAIN], r[OJT_ACTIVITY]), rows: [] };
    e.rows.push({ row: i + 1, import: _ojtAuditIsImport(r[OJT_LOG_TYPE]) });
  }
  return out;
}

function _ojtAuditRun(cursor) {
  var t0 = Date.now(), props = PropertiesService.getScriptProperties();
  try {
    var ss = _getSpreadsheet();
    var rSheet = _getSheetByGID(ss, GID_MASTER_ROSTER), ojtSheet = _getSheetByGID(ss, GID_OJT_LOG);
    var onsiteDb = SpreadsheetApp.openById(ONSITE_DB_SHEET_ID);
    var roster = _sy2627ReadRosterIndex(rSheet);
    var wbIndex = _ojtAuditWorkbookIndex(ss, onsiteDb, roster);
    var logIndex = _ojtAuditLogIndex(ojtSheet);
    var schemaIndex = _buildSchemaTextIndex();
    // Roster role (Program Track, column 100) — Completed Program never gets additions.
    var rData = rSheet.getDataRange().getValues(), trackOf = {};
    for (var ri = 4; ri < rData.length; ri++) trackOf[_normName(rData[ri][MR_FULL_NAME])] = String(rData[ri][99] || '').trim();

    // People = everyone with a Y in the OTJ log or a linked workbook, sorted by name.
    var people = {};
    Object.keys(logIndex).forEach(function(k) { people[k] = logIndex[k].name; });
    roster.forEach(function(r) { var k = _normName(r.name); if (wbIndex.idx[k]) people[k] = r.name; });
    var keys = Object.keys(people).sort(function(a, b) { return people[a].localeCompare(people[b]); });

    var sh = ss.getSheetByName(OJT_AUDIT.SHEET);
    if (cursor === 0) {
      if (!sh) sh = ss.insertSheet(OJT_AUDIT.SHEET); else sh.clear();
      sh.getRange(1, 1, 1, OJT_AUDIT_HEADERS.length).setValues([OJT_AUDIT_HEADERS]).setFontWeight('bold').setBackground('#0a1628').setFontColor('#ffffff');
      sh.setFrozenRows(1);
    }

    var rows = [];
    for (var p = cursor; p < keys.length; p++) {
      if (Date.now() - t0 > OJT_AUDIT.TIME_BUDGET_MS) {
        _ojtAuditWrite(sh, rows);
        props.setProperty(OJT_AUDIT.CURSOR_PROP, String(p));
        ScriptApp.newTrigger(OJT_AUDIT.HANDLER).timeBased().after(60 * 1000).create();
        return { done: false, at: p };
      }
      rows.push(_ojtAuditPerson(people[keys[p]], logIndex[keys[p]], wbIndex.idx[keys[p]] || [], trackOf[keys[p]] || wbIndex.roles[keys[p]] || '', schemaIndex));
    }
    _ojtAuditWrite(sh, rows);
    props.deleteProperty(OJT_AUDIT.CURSOR_PROP);
    _logNotification('OJT_AUDIT', '', 'OJT Audit complete — ' + keys.length + ' people checked', '', 'runOJTAudit');
    return { done: true };
  } catch (err) {
    _handleError('_ojtAuditRun', err);
    return null;
  }
}

function _ojtAuditPerson(name, logEntry, workbooks, track, schemaIndex) {
  var notes = [], tabsRead = [], wbAll = {}, wbLabeled = {}, unmatched = [], blocked = false;
  var completed = /^completed/i.test(track);
  var continuing = /^(apprentice|pre-?apprentice)/i.test(track);
  var addFrom = continuing ? OJT_AUDIT.CONTINUATION_FROM : OJT_AUDIT.ADD_FROM;
  if (!workbooks.length) { notes.push('No workbook link found on SY 26-27 OJT or Summer 26 OJT — cannot verify'); blocked = true; }
  workbooks.forEach(function(w) {
    var wb;
    try { wb = SpreadsheetApp.openById(w.id); } catch (e) { notes.push('Cannot open workbook from ' + w.source); blocked = true; return; }
    var tabs = _ojtAuditChecklistTabs(wb);
    if (!tabs.length) { notes.push('No checklist tab in workbook from ' + w.source); return; }
    tabs.forEach(function(t) {
      var yr = _ojtAuditTabYear(t.getName());
      var one = {};
      _ojtAuditReadTab(t, schemaIndex, one, unmatched);
      tabsRead.push('"' + t.getName() + '" (' + Object.keys(one).length + ' Y' + (yr ? ', ' + yr : '') + ')');
      Object.keys(one).forEach(function(k) {
        if (!wbAll[k] || (one[k].date && (!wbAll[k].date || one[k].date < wbAll[k].date))) wbAll[k] = one[k];
        if (yr || tabs.length === 1) { if (!wbLabeled[k] || (one[k].date && (!wbLabeled[k].date || one[k].date < wbLabeled[k].date))) wbLabeled[k] = one[k]; }
      });
    });
  });
  if (unmatched.length) { notes.push(unmatched.length + ' checked item(s) could not be matched: ' + unmatched.slice(0, 3).join('; ')); blocked = true; }

  var logKeys = logEntry ? logEntry.keys : {};
  var remove = [], kept = [], add = [];
  Object.keys(logKeys).forEach(function(k) {
    if (wbAll[k]) return;
    var e = logKeys[k];
    if (e.rows.some(function(r) { return !r.import; })) kept.push(e.label);
    else remove.push(e.label);
  });
  if (!completed) {
    var skippedAdd = 0;
    Object.keys(wbAll).forEach(function(k) {
      if (logKeys[k]) return;
      var d = wbAll[k].date;
      if (!d || d < addFrom) { skippedAdd++; return; }
      add.push(wbAll[k].label + '@' + Utilities.formatDate(d, Session.getScriptTimeZone(), 'M/d/yyyy'));
    });
    if (skippedAdd) notes.push(skippedAdd + ' checked item(s) not in the log were NOT added — ' + (continuing ? 'undated' : 'undated or dated before June 2026 (not on the Apprentice / Pre-apprentice track)'));
  } else {
    var missing = Object.keys(wbLabeled).filter(function(k) { return !logKeys[k]; }).length;
    if (missing) notes.push('Completed Program — ' + missing + ' workbook item(s) not in log were NOT added (workbook may hold earlier years)');
  }
  var nowN = Object.keys(logKeys).length, afterN = nowN - remove.length + add.length;
  if (blocked && (remove.length || add.length)) notes.push('Not applied automatically — check this person by hand');
  return [
    !blocked && (remove.length > 0 || add.length > 0),
    name, track, tabsRead.join('; '),
    nowN, nowN - remove.length, nowN * 50, afterN * 50, (afterN - nowN) * 50,
    remove.sort().join('; '), add.sort().join('; '), kept.sort().join('; '),
    notes.join(' | '), new Date()
  ];
}

function _ojtAuditWrite(sh, rows) {
  if (!rows.length) return;
  var start = sh.getLastRow() + 1;
  sh.getRange(start, 1, rows.length, OJT_AUDIT_HEADERS.length).setValues(rows);
  sh.getRange(start, 1, rows.length, 1).insertCheckboxes();
  rows.forEach(function(r, i) { sh.getRange(start + i, 1).setValue(r[0] === true); });
}

function _ojtAuditSummary() {
  var sh = _getSpreadsheet().getSheetByName(OJT_AUDIT.SHEET);
  if (!sh || sh.getLastRow() < 2) return 'OJT Audit: nothing to report.';
  var v = sh.getRange(2, 1, sh.getLastRow() - 1, OJT_AUDIT_HEADERS.length).getValues();
  var changed = v.filter(function(r) { return r[9] || r[10]; });
  var down = v.filter(function(r) { return r[8] < 0; }), up = v.filter(function(r) { return r[8] > 0; });
  var blocked = v.filter(function(r) { return /check this person by hand|cannot verify|Cannot open/i.test(r[12]); });
  return 'OJT Audit complete — ' + v.length + ' people checked.\n\n' +
    changed.length + ' with differences (' + down.length + ' would go DOWN, ' + up.length + ' would go UP).\n' +
    blocked.length + ' need a manual check (no link / cannot open / unmatched items).\n\n' +
    'Review the "OJT Audit" tab. Untick "Apply?" for anyone you do not want changed, then run "OJT Audit: 2) Apply ticked fixes".';
}

// ── STEP 3: apply ────────────────────────────────────────────────────────────
function applyOJTAuditFixes() {
  var ss = _getSpreadsheet(), sh = ss.getSheetByName(OJT_AUDIT.SHEET);
  if (!sh || sh.getLastRow() < 2) { _safeAlert('Run "OJT Audit: 1) Check log vs workbooks" first.'); return; }
  if (PropertiesService.getScriptProperties().getProperty(OJT_AUDIT.CURSOR_PROP)) { _safeAlert('The audit is still running. Wait for it to finish.'); return; }
  var v = sh.getRange(2, 1, sh.getLastRow() - 1, OJT_AUDIT_HEADERS.length).getValues();
  var oldest = v.reduce(function(m, r) { return r[13] instanceof Date && (!m || r[13] < m) ? r[13] : m; }, null);
  if (!oldest || (Date.now() - oldest.getTime()) > OJT_AUDIT.MAX_AGE_HOURS * 3600000) { _safeAlert('The audit is more than ' + OJT_AUDIT.MAX_AGE_HOURS + ' hours old. Run step 1 again so the fixes match the workbooks today.'); return; }
  var ticked = v.map(function(r, i) { return { r: r, i: i }; }).filter(function(x) { return x.r[0] === true && (x.r[9] || x.r[10]); });
  if (!ticked.length) { _safeAlert('No ticked rows with changes.'); return; }
  try {
    var ui = SpreadsheetApp.getUi();
    var ans = ui.alert('Apply OJT Audit fixes', ticked.length + ' people will be updated. Removed rows are copied to "' + OJT_AUDIT.REMOVED_SHEET + '" first. Continue?', ui.ButtonSet.YES_NO);
    if (ans !== ui.Button.YES) return;
  } catch (e) { /* no UI (trigger) — proceed */ }

  var ojtSheet = _getSheetByGID(ss, GID_OJT_LOG);
  var data = ojtSheet.getDataRange().getValues();
  var removeSet = {}, addRows = [], people = {};
  ticked.forEach(function(x) {
    var name = x.r[1], nk = _normName(name);
    people[name] = true;
    String(x.r[9] || '').split(';').map(function(s) { return s.trim(); }).filter(Boolean).forEach(function(lbl) {
      var p = lbl.split('|'); removeSet[nk + '#' + _ojtAuditKey(p[0], p[1], p[2])] = true;
    });
    String(x.r[10] || '').split(';').map(function(s) { return s.trim(); }).filter(Boolean).forEach(function(item) {
      var parts = item.split('@'), p = parts[0].split('|');
      var d = parts[1] && parts[1] !== 'no date' ? new Date(parts[1]) : '';
      var r = new Array(16).fill('');
      r[OJT_TIMESTAMP] = new Date(); r[OJT_LOG_TYPE] = OJT_AUDIT.LOG_TYPE_ADD; r[OJT_OBS_DATE] = d;
      r[OJT_OBS_ROLE] = 'Site Leader'; r[OJT_APPRENTICE] = name;
      r[OJT_PHASE] = p[0]; r[OJT_DOMAIN] = p[1]; r[OJT_ACTIVITY] = p[2];
      r[OJT_STATUS] = OJT_AUDIT.STATUS_ADD; r[OJT_NOTES] = 'Added by OJT Audit — checked in the OJT workbook, missing from the log';
      addRows.push(r);
    });
  });

  // Rows to remove: imported Y rows for the listed person + activity only.
  var toRemove = [];
  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    if (!_ojtAuditIsImport(row[OJT_LOG_TYPE])) continue;
    if (!/^y/i.test(String(row[OJT_STATUS] || '').trim())) continue;
    var k = _normName(row[OJT_APPRENTICE]) + '#' + _ojtAuditKey(row[OJT_PHASE], row[OJT_DOMAIN], row[OJT_ACTIVITY]);
    if (removeSet[k]) toRemove.push(i + 1);
  }

  // Back up, then delete bottom-up.
  if (toRemove.length) {
    var bk = ss.getSheetByName(OJT_AUDIT.REMOVED_SHEET);
    if (!bk) { bk = ss.insertSheet(OJT_AUDIT.REMOVED_SHEET); bk.getRange(1, 1, 1, data[0].length + 2).setValues([['Removed On', 'Original Row'].concat(data[0])]).setFontWeight('bold'); }
    var stamp = new Date();
    var backup = toRemove.map(function(rn) { return [stamp, rn].concat(data[rn - 1]); });
    bk.getRange(bk.getLastRow() + 1, 1, backup.length, backup[0].length).setValues(backup);
    toRemove.sort(function(a, b) { return b - a; }).forEach(function(rn) { ojtSheet.deleteRow(rn); });
  }
  if (addRows.length) _sy2627AppendOJTRows(ojtSheet, addRows);

  _DEFER_COMPLETION_SUMMARY = true;
  Object.keys(people).forEach(function(n) { recalculateTotals(n); });
  _DEFER_COMPLETION_SUMMARY = false;
  try { rebuildCompletionSummary(); } catch (e) {}

  ticked.forEach(function(x) {
    sh.getRange(x.i + 2, 1).setValue(false);
    sh.getRange(x.i + 2, 13).setValue(('Applied ' + new Date().toLocaleString() + (x.r[12] ? ' | ' + x.r[12] : '')));
  });
  _logNotification('OJT_AUDIT_APPLY', '', ticked.length + ' people updated · ' + toRemove.length + ' rows removed (backed up) · ' + addRows.length + ' rows added', '', 'applyOJTAuditFixes');
  _safeAlert('Done. ' + ticked.length + ' people updated.\nRows removed: ' + toRemove.length + ' (copied to "' + OJT_AUDIT.REMOVED_SHEET + '")\nRows added: ' + addRows.length);
}


// ── One-time correction (v2) ──────────────────────────────────────────────────
// The first version of the audit (applied 11/3/2026) also added checkmarks that
// were undated or dated before June 2026 — SY 25-26 work on tabs such as
// "SY 25-26/Summer 2026" or a single unlabeled checklist (e.g. Caitlin
// Evgeniadis, Jaejin Lee). This removes ONLY those "Audit Import" rows
// (backed up first) and recalculates. Summer-dated additions stay.
function undoOJTAuditPriorYearAdds() {
  var ss = _getSpreadsheet(), ojtSheet = _getSheetByGID(ss, GID_OJT_LOG);
  var data = ojtSheet.getDataRange().getValues(), rows = [], people = {};
  for (var i = 1; i < data.length; i++) {
    var r = data[i];
    if (String(r[OJT_LOG_TYPE] || '') !== OJT_AUDIT.LOG_TYPE_ADD) continue;
    var d = r[OJT_OBS_DATE];
    if (d instanceof Date && d >= OJT_AUDIT.ADD_FROM) continue;
    rows.push(i + 1); people[String(r[OJT_APPRENTICE] || '').trim()] = (people[String(r[OJT_APPRENTICE] || '').trim()] || 0) + 1;
  }
  if (!rows.length) { _safeAlert('Nothing to undo — no undated or pre-June-2026 Audit Import rows.'); return; }
  try {
    var ui = SpreadsheetApp.getUi();
    var list = Object.keys(people).sort().map(function(n) { return n + ': ' + people[n]; }).join('\n');
    if (ui.alert('Undo prior-year / undated audit additions', rows.length + ' rows will be removed (backed up first):\n\n' + list, ui.ButtonSet.YES_NO) !== ui.Button.YES) return;
  } catch (e) {}
  var bk = ss.getSheetByName(OJT_AUDIT.REMOVED_SHEET);
  if (!bk) { bk = ss.insertSheet(OJT_AUDIT.REMOVED_SHEET); bk.getRange(1, 1, 1, data[0].length + 2).setValues([['Removed On', 'Original Row'].concat(data[0])]).setFontWeight('bold'); }
  var stamp = new Date();
  var backup = rows.map(function(rn) { return [stamp, rn].concat(data[rn - 1]); });
  bk.getRange(bk.getLastRow() + 1, 1, backup.length, backup[0].length).setValues(backup);
  rows.sort(function(a, b) { return b - a; }).forEach(function(rn) { ojtSheet.deleteRow(rn); });
  _DEFER_COMPLETION_SUMMARY = true;
  Object.keys(people).forEach(function(n) { recalculateTotals(n); });
  _DEFER_COMPLETION_SUMMARY = false;
  try { rebuildCompletionSummary(); } catch (e) {}
  _logNotification('OJT_AUDIT_UNDO', '', rows.length + ' undated/pre-June-2026 Audit Import rows removed (backed up) for ' + Object.keys(people).length + ' people', '', 'undoOJTAuditPriorYearAdds');
  _safeAlert('Done. ' + rows.length + ' rows removed (copied to "' + OJT_AUDIT.REMOVED_SHEET + '") for:\n\n' + Object.keys(people).sort().map(function(n) { return n + ': ' + people[n]; }).join('\n'));
}


// ── v3: put back SY 25-26 continuation checkmarks removed by the undo ────────
// Restores, from "OJT Audit — Removed Rows", the Audit Import rows that the
// undo removed for being dated before June 2026 — ONLY for people now on the
// Apprentice / Pre-apprentice track, ONLY dated Mar-25 → May-26, and only if
// that activity is not already in the log. Undated rows stay out.
function restoreContinuationAdds() {
  var ss = _getSpreadsheet(), ojtSheet = _getSheetByGID(ss, GID_OJT_LOG), rSheet = _getSheetByGID(ss, GID_MASTER_ROSTER);
  var bk = ss.getSheetByName(OJT_AUDIT.REMOVED_SHEET);
  if (!bk || bk.getLastRow() < 2) { _safeAlert('Nothing to restore — "' + OJT_AUDIT.REMOVED_SHEET + '" is empty.'); return; }
  var rData = rSheet.getDataRange().getValues(), trackOf = {};
  for (var ri = 4; ri < rData.length; ri++) trackOf[_normName(rData[ri][MR_FULL_NAME])] = String(rData[ri][99] || '').trim();
  var existing = {};
  ojtSheet.getDataRange().getValues().slice(1).forEach(function(r) {
    if (/rti/i.test(String(r[OJT_LOG_TYPE] || '')) || !/^y/i.test(String(r[OJT_STATUS] || '').trim())) return;
    existing[_normName(r[OJT_APPRENTICE]) + '#' + _ojtAuditKey(r[OJT_PHASE], r[OJT_DOMAIN], r[OJT_ACTIVITY])] = true;
  });
  var rows = [], people = {};
  bk.getDataRange().getValues().slice(1).forEach(function(b) {
    var r = b.slice(2, 18);                                   // original OTJ row (after "Removed On", "Original Row")
    if (String(r[OJT_LOG_TYPE] || '') !== OJT_AUDIT.LOG_TYPE_ADD) return;
    var d = r[OJT_OBS_DATE];
    if (!(d instanceof Date) || d < OJT_AUDIT.CONTINUATION_FROM || d >= OJT_AUDIT.ADD_FROM) return;
    var nk = _normName(r[OJT_APPRENTICE]);
    if (!/^(apprentice|pre-?apprentice)/i.test(trackOf[nk] || '')) return;
    var k = nk + '#' + _ojtAuditKey(r[OJT_PHASE], r[OJT_DOMAIN], r[OJT_ACTIVITY]);
    if (existing[k]) return;
    existing[k] = true;
    r[OJT_TIMESTAMP] = new Date();
    r[OJT_NOTES] = 'Restored by OJT Audit v3 — SY 25-26 checkmark counted as TAP continuation';
    rows.push(r);
    var n = String(r[OJT_APPRENTICE] || '').trim(); people[n] = (people[n] || 0) + 1;
  });
  if (!rows.length) { _safeAlert('Nothing to restore.'); return; }
  try {
    var ui = SpreadsheetApp.getUi();
    var list = Object.keys(people).sort().map(function(n) { return n + ': ' + people[n]; }).join('\n');
    if (ui.alert('Restore SY 25-26 continuation checkmarks', rows.length + ' rows will be added back:\n\n' + list, ui.ButtonSet.YES_NO) !== ui.Button.YES) return;
  } catch (e) {}
  _sy2627AppendOJTRows(ojtSheet, rows);
  _DEFER_COMPLETION_SUMMARY = true;
  Object.keys(people).forEach(function(n) { recalculateTotals(n); });
  _DEFER_COMPLETION_SUMMARY = false;
  try { rebuildCompletionSummary(); } catch (e) {}
  _logNotification('OJT_AUDIT_RESTORE', '', rows.length + ' SY 25-26 continuation rows restored for ' + Object.keys(people).join(', '), '', 'restoreContinuationAdds');
  _safeAlert('Done. ' + rows.length + ' rows restored:\n\n' + Object.keys(people).sort().map(function(n) { return n + ': ' + people[n]; }).join('\n'));
}
