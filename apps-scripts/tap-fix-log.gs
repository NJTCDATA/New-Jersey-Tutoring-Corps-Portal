/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║  NJTC TAP — WEEKLY OJT FIX LOG + DATA AUDIT                              ║
 * ║  Add-on file for the TAP Tracker 26-27 Apps Script project.             ║
 * ╠══════════════════════════════════════════════════════════════════════════╣
 * ║  Every Monday (~8am, after the weekly digest) this emails ONE simplified ║
 * ║  table of what needs fixing in the OJT workbooks — the same layout T&D   ║
 * ║  saw in the 11/3 email — plus proof that the data was audited:          ║
 * ║                                                                          ║
 * ║   1. FIX LOG (from the nightly sync's "SY 26-27 Import — Needs Review"   ║
 * ║      and "SY 26-27 Workbook Progress" tabs):                             ║
 * ║        • dates that can't be read — quoting the cell exactly as typed    ║
 * ║        • checkmarks with no date                                         ║
 * ║        • missing workbook links / people not on the Master Roster        ║
 * ║      grouped Apprentices → Pre-apprentices → Completed Program → not     ║
 * ║      in TAP, with each person's site leader. Each item is marked NEW,    ║
 * ║      STILL OPEN (since …) — and items fixed since the last report are    ║
 * ║      listed as FIXED.                                                    ║
 * ║   2. AUDIT CHECKS (re-computed independently every run):                 ║
 * ║        • every active person's OJT hours = 50 × unique Y activities in   ║
 * ║          the OTJ log (same rule as recalculateTotals)                    ║
 * ║        • Apprentice wage-milestone labels match their hours              ║
 * ║        • nightly workbook + Knowtion syncs ran in the last 36 hours      ║
 * ║        • Knowtion data was refreshed since last week (manual export)     ║
 * ║        • milestone email test mode on/off                                ║
 * ║                                                                          ║
 * ║  Every run is written to the "OJT Fix Log" tab (history) and to the      ║
 * ║  Notifications Log (type OJT_FIX_LOG) — the record that an audit ran.    ║
 * ║                                                                          ║
 * ║  RECIPIENTS: Script Property FIX_LOG_TO (comma-separated); default       ║
 * ║  ADMIN_EMAIL. While milestone TEST MODE is on it goes only to the test   ║
 * ║  address, subject starting [TEST].                                       ║
 * ║                                                                          ║
 * ║  Menu lines (main script onOpen, before .addToUi()):                     ║
 * ║    .addItem('Fix Log: Send now',            'autoWeeklyFixLog')          ║
 * ║    .addItem('Fix Log: Set recipients…',     'menuSetFixLogRecipients')   ║
 * ║  The Monday schedule is installed by "Automation: Install ALL Scheduled  ║
 * ║  Jobs" (tap-automation.gs).                                              ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 */

var FIX_LOG = {
  SHEET: 'OJT Fix Log',
  STATE_PROP: 'FIX_LOG_OPEN',          // JSON { key: {first: ISO, text, name} } of last run's open items
  KN_PROP: 'FIX_LOG_KN_ITEMS',         // Knowtion items completed at last run
  HEADERS: ['Run', 'Person', 'Role', 'Site Leader', 'What to fix', 'Status', 'Open Since'],
  TIERS: [1100, 2200, 3300, 3800, 4000],
};

// ── Menu ──────────────────────────────────────────────────────────────────────
function menuSetFixLogRecipients() {
  var ui = SpreadsheetApp.getUi(), props = PropertiesService.getScriptProperties();
  var cur = props.getProperty('FIX_LOG_TO') || '(not set — goes to ADMIN_EMAIL)';
  var r = ui.prompt('Fix Log recipients', 'Current: ' + cur + '\n\nEnter email addresses separated by commas:', ui.ButtonSet.OK_CANCEL);
  if (r.getSelectedButton() !== ui.Button.OK) return;
  var list = _autoRecipients(r.getResponseText(), []);
  if (!list) { ui.alert('No valid email addresses entered — nothing changed.'); return; }
  props.setProperty('FIX_LOG_TO', list);
  ui.alert('Fix Log recipients saved:\n' + list.split(',').join('\n'));
}

// ── Build the fix list ─────────────────────────────────────────────────────────
function _fixLogSheetObjects(sh) {
  if (!sh || sh.getLastRow() < 2) return [];
  var v = sh.getDataRange().getValues(), h = v[0].map(function(x) { return String(x).trim(); });
  return v.slice(1).filter(function(r) { return String(r[0] || '').trim(); }).map(function(r) {
    var o = {}; h.forEach(function(k, i) { o[k] = r[i]; }); return o;
  });
}
function _fixLogPlural(n, w) { return n + ' ' + w + (n === 1 ? '' : 's'); }
function _fixLogSection(role) {
  var r = String(role || '').toLowerCase();
  if (/^pre-?apprentice/.test(r)) return 'Pre-apprentices';
  if (/^apprentice/.test(r)) return 'Apprentices';
  if (/^completed/.test(r)) return 'Completed Program';
  return 'Not in TAP (on the SY 26-27 OJT list)';
}
/** "…: cell says "Oct 6" (read as …)" segments → { 'Oct 6': 5, … } (the review text lists up to 6). */
function _fixLogRawCells(issue) {
  var out = {}, re = /cell says "([^"]*)"/g, m;
  while ((m = re.exec(String(issue || ''))) !== null) out[m[1]] = (out[m[1]] || 0) + 1;
  return out;
}

function _fixLogItems(ss) {
  var prog = _fixLogSheetObjects(ss.getSheetByName(SY2627.PROGRESS_SHEET));
  var review = _fixLogSheetObjects(ss.getSheetByName(SY2627.REVIEW_SHEET));
  var byName = {}, items = [];
  prog.forEach(function(p) { byName[String(p['Directory Name']).trim()] = p; });
  function add(name, role, sl, type, text) {
    items.push({ key: _normName(name) + '|' + type, name: name, role: role, section: _fixLogSection(role), sl: sl || '—', type: type, text: text });
  }
  // Review rows: roster / link / workbook problems, and the exact unreadable date cells.
  var invalidRaw = {};
  review.forEach(function(r) {
    var name = String(r['Directory Name']).trim(), role = String(r['Role'] || '').trim(), issue = String(r['Issue'] || '');
    var p = byName[name] || {}, sl = String(p['Site Leader'] || '').trim();
    if (/impossible date/i.test(issue)) { invalidRaw[name] = _fixLogRawCells(issue); return; }
    if (/not on the master roster/i.test(issue))
      add(name, role, sl, 'roster', 'Not on the Master Roster, so their workbook isn\'t being read. Check their name and email on Staffing SY 2026-2027 (or add them).');
    else if (/no ojt workbook link/i.test(issue))
      add(name, role, sl, 'link', 'No OJT workbook link on the SY 26-27 OJT tab. Add a working link.');
    else if (/could not open|no ojt checklist tab|cannot open/i.test(issue))
      add(name, role, sl, 'open', issue.split('|')[0].trim() + ' ' + String(r['Action Needed'] || '').trim());
    else if (/could not confidently match/i.test(issue))
      add(name, role, sl, 'match-' + _normName(issue).slice(0, 40), issue + ' ' + String(r['Action Needed'] || '').trim());
  });
  // Progress rows: date counts (exact totals — the review text is capped at 6 examples).
  prog.forEach(function(p) {
    var name = String(p['Directory Name']).trim(), role = String(p['Role (directory)'] || '').trim(), sl = String(p['Site Leader'] || '').trim();
    var bad = Number(p['Y With Invalid Date (counted, no month)']) || 0, none = Number(p['Y With No Date (counted, no month)']) || 0;
    if (bad > 0) {
      var raw = invalidRaw[name] || {}, ex = Object.keys(raw).map(function(k) { return '"' + k + '"' + (raw[k] > 1 ? ' (' + raw[k] + ')' : ''); });
      add(name, role, sl, 'dates', _fixLogPlural(bad, 'date cell') + ' can\'t be read' + (ex.length ? ' — the cell' + (ex.length > 1 || bad > 1 ? 's say ' : ' says ') + ex.join(', ') + (bad > Object.keys(raw).reduce(function(a, k) { return a + raw[k]; }, 0) ? ', …' : '') : '') +
        '. Enter one full date (month/day/year) per cell.');
    }
    if (none > 0) add(name, role, sl, 'nodate', _fixLogPlural(none, 'checkmark') + ' with no date. Add the date.');
  });
  var order = { 'Apprentices': 0, 'Pre-apprentices': 1, 'Completed Program': 2, 'Not in TAP (on the SY 26-27 OJT list)': 3 };
  items.sort(function(a, b) { return order[a.section] - order[b.section] || a.name.localeCompare(b.name) || a.type.localeCompare(b.type); });
  return items;
}

// ── Independent audit checks ──────────────────────────────────────────────────
function _fixLogAudit(ss, props) {
  var checks = [], tz = Session.getScriptTimeZone();
  var rSheet = _getSheetByGID(ss, GID_MASTER_ROSTER), ojt = _getSheetByGID(ss, GID_OJT_LOG);
  // 1. OJT hours = 50 × unique Y activities (latest entry per activity wins, as in recalculateTotals).
  var acts = {}, data = ojt.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    var r = data[i]; if (/rti/i.test(String(r[OJT_LOG_TYPE] || ''))) continue;
    var ph = String(r[OJT_PHASE] || '').trim(), dom = String(r[OJT_DOMAIN] || '').trim(), act = String(r[OJT_ACTIVITY] || '').trim(), st = String(r[OJT_STATUS] || '').trim();
    if (!r[OJT_APPRENTICE] || !ph || !dom || !act || !st) continue;
    var code = act.split(/\s*[—\-]\s*/)[0].trim().toUpperCase(); if (!code) continue;
    var p = ph.toLowerCase(), pk = p.indexOf('begin') >= 0 ? 'beginning' : p.indexOf('mid') >= 0 ? 'middle' : p.indexOf('end') >= 0 ? 'end' : p;
    var nk = _normName(r[OJT_APPRENTICE]), k = pk + '|' + dom.toLowerCase() + '|' + code;
    var ts = r[OJT_TIMESTAMP] instanceof Date ? r[OJT_TIMESTAMP].getTime() : i;
    acts[nk] = acts[nk] || {};
    if (!acts[nk][k] || ts > acts[nk][k].ts) acts[nk][k] = { ts: ts, y: st.charAt(0).toUpperCase() === 'Y' };
  }
  var rd = rSheet.getDataRange().getValues(), mism = [], lag = [], active = 0;
  for (var j = 4; j < rd.length; j++) {
    var name = String(rd[j][MR_FULL_NAME] || '').trim(); if (!name) continue;
    if (!/^(active|reinstated)$/i.test(String(rd[j][MR_STATUS] || '').trim())) continue;
    active++;
    var a = acts[_normName(name)] || {}, y = Object.keys(a).filter(function(x) { return a[x].y; }).length;
    var hrs = Number(rd[j][MR_OJT_HOURS_TOTAL]) || 0;
    if (Math.abs(hrs - y * 50) > 0.01) mism.push(name + ' (roster ' + hrs + ', log ' + (y * 50) + ')');
    var track = String(rd[j][99] || '').trim();
    if (!track || /^apprentice/i.test(track)) {
      var reached = 0; FIX_LOG.TIERS.forEach(function(t) { if (hrs >= t) reached = t; });
      var label = parseInt(String(rd[j][59] || '').replace(/[^0-9]/g, ''), 10) || 0;
      if (reached !== label) lag.push(name + ' (' + hrs.toLocaleString() + ' hrs, label ' + (label ? label.toLocaleString() : 'Base') + ')');
    }
  }
  checks.push({ ok: !mism.length, label: 'OJT hours match the OTJ log', detail: mism.length ? mism.join('; ') : active + ' active people checked — all match' });
  var test = props.MILESTONE_TEST_MODE === 'ON';
  checks.push({ ok: !lag.length, label: 'Wage milestone labels match hours (Apprentices)', detail: lag.length ? lag.join('; ') + (test ? ' — held because milestone TEST MODE is on' : ' — sent on the next sync/resync') : 'All match' });
  // 2. Scheduled syncs ran recently.
  var now = Date.now();
  [['syncSY2627', 'Nightly OJT workbook sync'], ['rtiKnowtion', 'Nightly Knowtion sync']].forEach(function(s) {
    var iso = props[(AUTO && AUTO.LAST_RUN_PREFIX || 'AUTO_LAST_RUN_') + s[0]], d = iso ? new Date(iso) : null;
    var ok = d && (now - d.getTime()) < 36 * 3600000;
    checks.push({ ok: !!ok, label: s[1] + ' ran in the last 36 hours', detail: d ? 'Last run ' + Utilities.formatDate(d, tz, 'EEE M/d h:mm a') : 'Never recorded' });
  });
  // 3. Knowtion is changing week to week.
  var kn = _fixLogSheetObjects(ss.getSheetByName('RTI — Knowtion'));
  var items = kn.reduce(function(s, r) { return s + (Number(r['Items Completed']) || 0); }, 0);
  var prev = props[FIX_LOG.KN_PROP] ? Number(props[FIX_LOG.KN_PROP]) : null;
  // The Knowtion source sheet is refreshed by hand (export from Knowtion, paste
  // into the Knowtion workbook), so "unchanged" usually means it's due.
  checks.push({ ok: prev === null || items !== prev, label: 'Knowtion data refreshed since the last report',
    detail: kn.length + ' learners · ' + items.toLocaleString() + ' items' + (prev === null ? ' (first report — compared from next week)' : items === prev ? ' — unchanged since last week. The Knowtion workbook is updated manually: paste the latest Knowtion export, then run Sync now ▸ Knowtion training hours (RTI).' : ' (was ' + prev.toLocaleString() + ')') });
  checks.push({ ok: !test, label: 'Milestone emails are live', detail: test ? 'TEST MODE is on — milestone emails go only to ' + _milestoneTestAddress() : 'Live — finance is emailed automatically' });
  return { checks: checks, knItems: items };
}

// ── Main ──────────────────────────────────────────────────────────────────────
function autoWeeklyFixLog() {
  try {
    var ss = _getSpreadsheet(), props = PropertiesService.getScriptProperties().getProperties(), tz = Session.getScriptTimeZone();
    var runAt = new Date();
    var items = _fixLogItems(ss);
    var audit = _fixLogAudit(ss, props);

    // Week-over-week status
    var prevOpen = {}; try { prevOpen = JSON.parse(props[FIX_LOG.STATE_PROP] || '{}'); } catch (e) {}
    var firstReport = !props[FIX_LOG.STATE_PROP];
    var nowOpen = {};
    items.forEach(function(it) {
      var p = prevOpen[it.key];
      it.since = p ? new Date(p.first) : runAt;
      it.status = firstReport ? 'Open' : p ? 'Still open' : 'New';
      nowOpen[it.key] = { first: it.since.toISOString(), name: it.name, text: it.text, role: it.role, sl: it.sl };
    });
    var fixed = Object.keys(prevOpen).filter(function(k) { return !nowOpen[k]; }).map(function(k) { return prevOpen[k]; });

    // History tab
    var sh = ss.getSheetByName(FIX_LOG.SHEET);
    if (!sh) { sh = ss.insertSheet(FIX_LOG.SHEET); sh.getRange(1, 1, 1, FIX_LOG.HEADERS.length).setValues([FIX_LOG.HEADERS]).setFontWeight('bold').setBackground('#0a1628').setFontColor('#ffffff'); sh.setFrozenRows(1); }
    var hist = items.map(function(it) { return [runAt, it.name, it.role, it.sl, it.text, it.status, it.since]; })
      .concat(fixed.map(function(f) { return [runAt, f.name, f.role || '', f.sl || '', f.text, 'Fixed', new Date(f.first)]; }));
    if (hist.length) sh.getRange(sh.getLastRow() + 1, 1, hist.length, FIX_LOG.HEADERS.length).setValues(hist);

    // Email
    var html = _fixLogHtml(items, fixed, audit.checks, runAt, tz, firstReport);
    var test = props.MILESTONE_TEST_MODE === 'ON';
    var to = test ? _milestoneTestAddress() : _autoRecipients(props.FIX_LOG_TO, [props.ADMIN_EMAIL || 'amir@njtutoringcorps.org']);
    var people = Object.keys(items.reduce(function(m, it) { m[it.name] = 1; return m; }, {})).length;
    var subject = (test ? '[TEST] ' : '') + 'NJTC TAP — Weekly OJT Fix Log (' + Utilities.formatDate(runAt, tz, 'M/d/yyyy') + '): ' +
      _fixLogPlural(items.length, 'open item') + ', ' + fixed.length + ' fixed';
    GmailApp.sendEmail(to, subject, 'This email needs HTML. Open it in Gmail.', { htmlBody: html });

    PropertiesService.getScriptProperties().setProperty(FIX_LOG.STATE_PROP, JSON.stringify(nowOpen));
    PropertiesService.getScriptProperties().setProperty(FIX_LOG.KN_PROP, String(audit.knItems));
    _autoMarkRun('fixLog');
    var failed = audit.checks.filter(function(c) { return !c.ok; }).length;
    _logNotification('OJT_FIX_LOG', '', items.length + ' open items for ' + people + ' people · ' + fixed.length + ' fixed since last report · audit: ' +
      (audit.checks.length - failed) + '/' + audit.checks.length + ' checks passed', to, 'autoWeeklyFixLog');
    return { items: items.length, fixed: fixed.length, failed: failed };
  } catch (err) {
    _handleError('autoWeeklyFixLog', err);
    return null;
  }
}

function _fixLogHtml(items, fixed, checks, runAt, tz, firstReport) {
  var esc = function(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); };
  var td = 'padding:6px 8px;border-bottom:1px solid #e5e7eb;vertical-align:top';
  var th = 'text-align:left;padding:7px 8px';
  var tag = function(s) {
    var c = s === 'New' ? '#b45309' : s === 'Still open' ? '#b91c1c' : '#374151';
    return '<span style="font-size:11px;font-weight:bold;color:' + c + '">' + esc(s) + '</span>';
  };
  var h = '<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#1f2937;line-height:1.5;max-width:900px">';
  h += '<p><strong>Weekly OJT Fix Log — ' + esc(Utilities.formatDate(runAt, tz, 'EEEE, MMMM d, yyyy')) + '</strong><br>' +
       'What needs fixing in the OJT workbooks, from last night\'s sync of every workbook on the SY 26-27 OJT list. ' +
       'Fixes are made in the person\'s OJT workbook (or the staffing list) and show up after the next nightly sync. ' +
       'Items are named by what the cell says, because item letters differ between checklists.</p>';
  var people = Object.keys(items.reduce(function(m, it) { m[it.name] = 1; return m; }, {})).length;
  h += '<p style="background:#f7f9fc;border:1px solid #e5e7eb;border-radius:8px;padding:8px 12px"><strong>' + _fixLogPlural(items.length, 'open item') + '</strong> for ' + _fixLogPlural(people, 'person').replace('persons', 'people') +
       (firstReport ? ' · first report — next week will show what was fixed' : ' · <strong>' + fixed.length + ' fixed</strong> since the last report · ' + items.filter(function(i) { return i.status === 'New'; }).length + ' new') + '</p>';

  if (fixed.length) {
    h += '<p style="margin:14px 0 4px"><strong>Fixed since the last report ✓</strong></p><ul style="margin:0 0 10px 18px;padding:0">' +
      fixed.map(function(f) { return '<li>' + esc(f.name) + ' — ' + esc(f.text) + '</li>'; }).join('') + '</ul>';
  }
  if (items.length) {
    h += '<table style="border-collapse:collapse;width:100%;font-size:13px;margin-top:8px"><thead><tr style="background:#0a1628;color:#ffffff">' +
      '<th style="' + th + '">Person</th><th style="' + th + '">Site leader</th><th style="' + th + '">What to fix</th><th style="' + th + '">Status</th></tr></thead><tbody>';
    var sec = '';
    items.forEach(function(it, i) {
      if (it.section !== sec) { sec = it.section; h += '<tr><td colspan="4" style="background:' + (/^Not in TAP/.test(sec) ? '#e5e7eb' : '#f0a500') + ';color:#0a1628;font-weight:bold;padding:5px 8px">' + esc(sec) + '</td></tr>'; }
      h += '<tr' + (i % 2 ? ' style="background:#f7f9fc"' : '') + '><td style="' + td + '"><strong>' + esc(it.name) + '</strong></td><td style="' + td + '">' + esc(it.sl) + '</td><td style="' + td + '">' + esc(it.text) + '</td><td style="' + td + ';white-space:nowrap">' +
        tag(it.status) + (it.status === 'Still open' ? '<br><span style="font-size:11px;color:#6b7280">since ' + esc(Utilities.formatDate(it.since, tz, 'M/d')) + '</span>' : '') + '</td></tr>';
    });
    h += '</tbody></table>';
  } else {
    h += '<p style="color:#047857;font-weight:bold">✓ Nothing to fix — every workbook read cleanly.</p>';
  }
  h += '<p style="margin:18px 0 4px"><strong>Data audit (checked automatically this run)</strong></p><table style="border-collapse:collapse;width:100%;font-size:12px">' +
    checks.map(function(c) { return '<tr><td style="' + td + ';width:22px">' + (c.ok ? '✅' : '⚠️') + '</td><td style="' + td + '"><strong>' + esc(c.label) + '</strong><br><span style="color:#6b7280">' + esc(c.detail) + '</span></td></tr>'; }).join('') + '</table>';
  h += '<p style="font-size:12px;color:#6b7280;margin-top:14px">Source: TAP Tracker 26-27 — "SY 26-27 Import — Needs Review" and "SY 26-27 Workbook Progress" tabs (refreshed nightly). History of every report: the "OJT Fix Log" tab. ' +
       'Apprentice and Completed Program items also show in the portal under TAP · Apprentices → Follow-Up.</p></div>';
  return h;
}
