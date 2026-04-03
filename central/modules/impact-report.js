(function() {
// ══════════════════════════════════════════════════════════════════════════
//  IMPACT REPORT BUILDER  (irb)
//  Data Department Only — reads live Pearl att rows via window.po.getAttRows()
//  No new data fetches; all aggregation is client-side.
// ══════════════════════════════════════════════════════════════════════════

// ── ATT column indices (mirrors programming.js ATT object) ────────────────
var C = { USER:0, ROLE:1, ATT_STATUS:6, MISS_REASON:7, SCHOOL:11, DISTRICT:12, USER_ID:13, WEEK:26, SESS_DATE:5 };

// ── Reason taxonomy ──────────────────────────────────────────────────────
var TAXONOMY = {
  'SI-T1': { label:'Tutor Absent', group:'si', sub:'tutor',
    raw:['absent; not covered (tutor not available)','absent; covered by sub tutor',
         'absent; covered by dual role','absent; covered by the site leader',
         'absent; covered by the instructional coach'] },
  'SI-T2': { label:'Tutor Left Early (No Sub)', group:'si', sub:'tutor',
    raw:['tutor left early (no sub)'] },
  'SI-T3': { label:'Tutor Vacancy', group:'si', sub:'tutor',
    raw:['tutor vacancy'] },
  'SI-S1': { label:'School-Administered Testing', group:'si', sub:'school',
    raw:['school-administered testing','school administered testing'] },
  'SI-S2': { label:'School Event', group:'si', sub:'school',
    raw:['school event'] },
  'SI-S3': { label:'Scheduled / Unscheduled School Drill', group:'si', sub:'school',
    raw:['scheduled/unscheduled school drill','scheduled / unscheduled school drill'] },
  'SI-S4': { label:'Half Day', group:'si', sub:'school',
    raw:['half day'] },
  'SI-S5': { label:'Holiday \u2013 Scheduled', group:'si', sub:'school',
    raw:['holiday - scheduled','holiday \u2013 scheduled'] },
  'SI-S6': { label:'Unscheduled School Closure / Delay / Dismissal', group:'si', sub:'school',
    raw:['unscheduled school closure/delay/dismissal',
         'unscheduled school closure / delay / dismissal'] },
  'SI-P1': { label:'NJTC Diagnostic Testing', group:'si', sub:'program',
    raw:['njtc diagnostic testing'] },
  'SI-P2': { label:'NJTC Scheduling Error', group:'si', sub:'program',
    raw:['njtc internal issue/error','njtc internal issue / error','njtc scheduling error'] },
  'SI-P3': { label:'Scholar Archived / Removed from Sessions', group:'si', sub:'program',
    raw:['scholar archived - removed from sessions','scholar archived / removed from sessions'] },
  'SM-1': { label:'Scholar Absent', group:'scholar', sub:null,
    raw:['absent'] },
  'SM-2': { label:'Classroom Teacher Requested to Keep Scholar in Class', group:'scholar', sub:null,
    raw:['classroom teacher requested to keep scholar in class'] },
  'SM-3': { label:'Haddon Twp \u2013 Teacher Requested Whole Group Support', group:'scholar', sub:null,
    raw:['haddon twp only -- teacher requested whole group support',
         'haddon twp only - teacher requested whole group support'] },
  'SM-4': { label:'Scholar Declined Attending', group:'scholar', sub:null,
    raw:['scholar declined attending tutoring session','scholar declined attending'] },
  'SM-5': { label:'Scholar Left Early', group:'scholar', sub:null,
    raw:['scholar left early'] }
};

// Build reverse lookup: lowercase raw string -> canonical ID
var _rawToId = {};
Object.keys(TAXONOMY).forEach(function(id) {
  TAXONOMY[id].raw.forEach(function(s) { _rawToId[s.toLowerCase()] = id; });
});

function canonicalize(rawReason) {
  if (!rawReason) return null;
  var lower = rawReason.toLowerCase().trim();
  if (_rawToId[lower]) return _rawToId[lower];
  // partial-match fallback
  var keys = Object.keys(_rawToId);
  for (var i = 0; i < keys.length; i++) {
    if (lower.includes(keys[i]) || keys[i].includes(lower)) return _rawToId[keys[i]];
  }
  return null;
}

// ── Region definitions (mirrors po.getExportData region logic) ────────────
var NE_KW_D = ['ilearn','i-learn','paterson','pcsst','hoboken','middlesex','central jersey','cjcp'];
var SW_KW_D = ['american paradigm','global leadership academy','global leadership',
               'string theory','penns grove','haddon township','haddon',
               'hamilton township','carneys point','gloucester township'];
var NE_KW_S = ['ilearn','i-learn','hoboken dual','middlesex county','cjcp','pcsst'];
var SW_KW_S = ['american paradigm','global leadership','string theory',
               'penns grove','haddon','hamilton'];

function getRegion(school, district) {
  var s = (school  || '').toLowerCase().trim();
  var d = (district|| '').toLowerCase().trim();
  if (s.startsWith('zzz')) return null;
  for (var i=0;i<NE_KW_D.length;i++) if (d.includes(NE_KW_D[i])) return 'NE';
  for (var i=0;i<SW_KW_D.length;i++) if (d.includes(SW_KW_D[i])) return 'SW';
  for (var i=0;i<NE_KW_S.length;i++) if (s.includes(NE_KW_S[i])) return 'NE';
  for (var i=0;i<SW_KW_S.length;i++) if (s.includes(SW_KW_S[i])) return 'SW';
  return null;
}

// ── Date helpers ──────────────────────────────────────────────────────────
function parseDateStr(s) {
  if (!s) return null;
  var m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return new Date(+m[3], +m[1]-1, +m[2]);
  var d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

function startOfDay(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function weekStart(d) {
  var day = d.getDay();
  var diff = day === 0 ? -6 : 1 - day;
  var m = new Date(d);
  m.setDate(d.getDate() + diff);
  return startOfDay(m);
}

function addDays(d, n) {
  var r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

var MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
var DAY_NAMES    = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

function fmtDate(d, short) {
  if (!d) return '';
  if (short) return MONTHS_SHORT[d.getMonth()] + ' ' + d.getDate();
  return MONTHS_SHORT[d.getMonth()] + ' ' + d.getDate() + ', ' + d.getFullYear();
}

function fmtMDY(d) {
  if (!d) return '';
  return (d.getMonth()+1) + '/' + d.getDate() + '/' + d.getFullYear();
}

function fmtISO(d) {
  if (!d) return '';
  var mm = String(d.getMonth()+1).padStart(2,'0');
  var dd = String(d.getDate()).padStart(2,'0');
  return d.getFullYear() + '-' + mm + '-' + dd;
}

// ── Module state ──────────────────────────────────────────────────────────
var _inited     = false;
var _weekOffset = 0;
var _rankSort   = { col: 'scholars', dir: 'desc' };
var _rankPage   = 0;
var _lastReport = null;
var _trendChart = null;
// District / school filter state (empty string = all)
var _filtDistrict = '';
var _filtSchool   = '';

var REASON_COLORS = [
  '#7b2d8b','#e63946','#f4845f','#ffd166','#06d6a0',
  '#118ab2','#073b4c','#a855f7','#3b82f6','#10b981',
  '#ef4444','#f59e0b','#6366f1','#ec4899','#14b8a6',
  '#64748b','#8b5cf6','#0ea5e9'
];
var _colorMap = {};

function getColor(reasonId) {
  if (!_colorMap[reasonId]) {
    var idx = Object.keys(_colorMap).length % REASON_COLORS.length;
    _colorMap[reasonId] = REASON_COLORS[idx];
  }
  return _colorMap[reasonId];
}

// Pre-assign stable colors in taxonomy order
Object.keys(TAXONOMY).forEach(function(id) { getColor(id); });

// ── Period / date-range calculation ───────────────────────────────────────
function getDateRange() {
  var modeEl = document.getElementById('irbPeriodMode');
  var modeV  = modeEl ? modeEl.value : 'this_week';
  var today  = new Date();
  var thisMon = weekStart(today);

  if (modeV === 'custom') {
    var fEl = document.getElementById('irbDateFrom');
    var tEl = document.getElementById('irbDateTo');
    var from = fEl && fEl.value ? new Date(fEl.value + 'T00:00:00') : startOfDay(today);
    var to   = tEl && tEl.value ? new Date(tEl.value + 'T23:59:59') : startOfDay(today);
    to = new Date(to.getFullYear(), to.getMonth(), to.getDate() + 1); // exclusive end
    return { start:from, end:to, mode:'custom', label: fmtDate(from,true)+' \u2013 '+fmtDate(addDays(to,-1),true) };
  }

  var offset = (modeV === 'last_week') ? -1 : 0;
  var mon = addDays(thisMon, (_weekOffset + offset) * 7);
  var sun = addDays(mon, 6);

  if (modeV === 'this_week' || modeV === 'last_week') {
    return { start:mon, end:addDays(sun,1), mode:'weekly',
             label:'Week of '+fmtDate(mon,true)+' \u2013 '+fmtDate(sun,true), weekMon:mon };
  }
  if (modeV === 'last_4w') {
    var start = addDays(thisMon, -27);
    var end   = addDays(thisMon, 7);
    return { start:start, end:end, mode:'multi', weeks:4,
             label: fmtDate(start,true)+' \u2013 '+fmtDate(addDays(end,-1),true) };
  }
  if (modeV === 'last_8w') {
    var start = addDays(thisMon, -55);
    var end   = addDays(thisMon, 7);
    return { start:start, end:end, mode:'multi', weeks:8,
             label: fmtDate(start,true)+' \u2013 '+fmtDate(addDays(end,-1),true) };
  }
  // default: this_week
  return { start:mon, end:addDays(sun,1), mode:'weekly',
           label:'Week of '+fmtDate(mon,true)+' \u2013 '+fmtDate(sun,true), weekMon:mon };
}

function getPriorRange(range) {
  var dur = range.end - range.start;
  return { start: new Date(range.start.getTime()-dur), end: new Date(range.end.getTime()-dur) };
}

// ── Core data processing ─────────────────────────────────────────────────
var SESSION_MINS = 45;

function processRows(attRows, selectedIds, region, dateRange, districtFilter, schoolFilter) {
  var events = [];
  attRows.forEach(function(r) {
    var school = r[C.SCHOOL] || '';
    if (school.toLowerCase().startsWith('zzz')) return;
    if (r[C.ROLE] !== 'Student') return;
    if (r[C.ATT_STATUS] !== 'Missed') return;
    var date = parseDateStr(r[C.SESS_DATE]);
    if (!date) return;
    var d = startOfDay(date);
    if (d < dateRange.start || d >= dateRange.end) return;
    var rawReason = r[C.MISS_REASON] || '';
    var canonId   = canonicalize(rawReason);
    if (!canonId) return;
    if (selectedIds.indexOf(canonId) === -1) return;
    var dist = r[C.DISTRICT] || '';
    var reg  = getRegion(school, dist);
    if (region !== 'all' && reg !== region) return;
    // District / school filters
    if (districtFilter && dist !== districtFilter) return;
    if (schoolFilter   && school !== schoolFilter)  return;
    events.push({
      date:d, dateStr:fmtMDY(d), school:school, district:dist, region:reg,
      userId: r[C.USER_ID] || r[C.USER] || '',
      userName: r[C.USER] || '',
      canonId:canonId, week: r[C.WEEK] || '', mins:SESSION_MINS
    });
  });
  return events;
}

function aggregateEvents(events) {
  var scholars = {};
  var byReason = {};
  var bySchool = {};
  var byDate   = {};

  events.forEach(function(e) {
    var uid = e.userId || e.userName;
    scholars[uid] = true;

    if (!byReason[e.canonId]) byReason[e.canonId] = { sessions:0, scholars:{}, mins:0 };
    byReason[e.canonId].sessions++;
    byReason[e.canonId].scholars[uid] = true;
    byReason[e.canonId].mins += e.mins;

    if (!bySchool[e.school]) bySchool[e.school] = { sessions:0, scholars:{}, mins:0, region:e.region, district:e.district, byReason:{} };
    bySchool[e.school].sessions++;
    bySchool[e.school].scholars[uid] = true;
    bySchool[e.school].mins += e.mins;
    bySchool[e.school].byReason[e.canonId] = (bySchool[e.school].byReason[e.canonId]||0) + 1;

    var dk = e.dateStr;
    if (!byDate[dk]) byDate[dk] = { sessions:0, scholars:{}, bySchool:{}, byReason:{}, date:e.date };
    byDate[dk].sessions++;
    byDate[dk].scholars[uid] = true;
    byDate[dk].byReason[e.canonId] = (byDate[dk].byReason[e.canonId]||0)+1;
    if (!byDate[dk].bySchool[e.school]) byDate[dk].bySchool[e.school] = { sessions:0, scholars:{}, byReason:{}, region:e.region };
    byDate[dk].bySchool[e.school].sessions++;
    byDate[dk].bySchool[e.school].scholars[uid] = true;
    byDate[dk].bySchool[e.school].byReason[e.canonId] = (byDate[dk].bySchool[e.school].byReason[e.canonId]||0)+1;
  });

  Object.keys(byReason).forEach(function(id) { byReason[id].scholarCount = Object.keys(byReason[id].scholars).length; });
  Object.keys(bySchool).forEach(function(s)  { bySchool[s].scholarCount  = Object.keys(bySchool[s].scholars).length; });
  Object.keys(byDate).forEach(function(dk) {
    byDate[dk].scholarCount = Object.keys(byDate[dk].scholars).length;
    Object.keys(byDate[dk].bySchool).forEach(function(s) {
      byDate[dk].bySchool[s].scholarCount = Object.keys(byDate[dk].bySchool[s].scholars).length;
    });
  });

  var total = events.length;
  return { scholars:Object.keys(scholars).length, sessions:total,
           mins:total*SESSION_MINS, hours:+((total*SESSION_MINS)/60).toFixed(1),
           byReason:byReason, bySchool:bySchool, byDate:byDate };
}

// ── Heat-map helper ───────────────────────────────────────────────────────
function heatClass(n) {
  if (!n || n === 0) return 'irb-heat-0';
  if (n <= 2)  return 'irb-heat-1';
  if (n <= 5)  return 'irb-heat-2';
  if (n <= 9)  return 'irb-heat-3';
  return 'irb-heat-4';
}

// ── Delta formatting ──────────────────────────────────────────────────────
function fmtDelta(curr, prior) {
  if (prior == null) return '';
  var diff = curr - prior;
  if (diff === 0)  return '<span class="irb-delta-flat">\u2194 No change vs. prior</span>';
  if (diff > 0)    return '<span class="irb-delta-up">\u2191 +'+diff+' vs. prior</span>';
  return '<span class="irb-delta-down">\u2193 '+diff+' vs. prior</span>';
}

// ── UI helpers ────────────────────────────────────────────────────────────
function getSelectedReasons() {
  var cbs = document.querySelectorAll('#irbConfigPanel .irb-cb:checked');
  return Array.prototype.map.call(cbs, function(cb) { return cb.value; });
}

function getRegionFilter() {
  var radio = document.querySelector('input[name="irbRegion"]:checked');
  return radio ? radio.value : 'all';
}

function getDistrictFilterVal() {
  var el = document.getElementById('irbDistrictFilter');
  return el ? el.value : '';
}

function getSchoolFilterVal() {
  var el = document.getElementById('irbSchoolFilter');
  return el ? el.value : '';
}

// Populate district + school dropdowns from live Pearl data
function populateDistrictSchool() {
  if (!window.po || !window.po.getAttRows) return;
  var rows = window.po.getAttRows();
  var districtSet = {};
  var schoolByDist = {};  // dist -> Set of schools

  rows.forEach(function(r) {
    var school = r[C.SCHOOL] || '';
    var dist   = r[C.DISTRICT] || '';
    if (!school || school.toLowerCase().startsWith('zzz')) return;
    if (dist) districtSet[dist] = true;
    if (!schoolByDist[dist]) schoolByDist[dist] = {};
    schoolByDist[dist][school] = true;
  });

  // Stash for later use in onDistrictChange
  _irbDistrictSchoolMap = schoolByDist;

  var distEl = document.getElementById('irbDistrictFilter');
  if (distEl) {
    var cur = distEl.value;
    distEl.innerHTML = '<option value="">All Districts</option>' +
      Object.keys(districtSet).sort().map(function(d) {
        return '<option value="'+esc(d)+'"'+(d===cur?' selected':'')+'>'+esc(d)+'</option>';
      }).join('');
  }
  // Trigger school list refresh
  onDistrictChange();
}

// Module-level map populated by populateDistrictSchool
var _irbDistrictSchoolMap = {};

function onDistrictChange() {
  var distEl   = document.getElementById('irbDistrictFilter');
  var schoolEl = document.getElementById('irbSchoolFilter');
  if (!distEl || !schoolEl) return;
  var selDist = distEl.value;
  var curSchool = schoolEl.value;

  // Build school list: if district selected, only that district's schools; else all
  var schools = {};
  if (selDist) {
    schools = _irbDistrictSchoolMap[selDist] || {};
  } else {
    Object.values(_irbDistrictSchoolMap).forEach(function(sMap) {
      Object.keys(sMap).forEach(function(s) { schools[s] = true; });
    });
  }

  schoolEl.innerHTML = '<option value="">All Schools</option>' +
    Object.keys(schools).sort().map(function(s) {
      return '<option value="'+esc(s)+'"'+(s===curSchool?' selected':'')+'>'+esc(s)+'</option>';
    }).join('');

  onFilterChange();
}

function onFilterChange() {
  updateLiveCount();
}

function updateWeekLabel() {
  var labelEl = document.getElementById('irbWeekLabel');
  if (!labelEl) return;
  var range = getDateRange();
  labelEl.textContent = range.label || '';
}

function updateLiveCount() {
  var selected = getSelectedReasons();
  var region   = getRegionFilter();
  var count    = 0;
  if (window.po && window.po.isDataLoaded && window.po.isDataLoaded()) {
    var range  = getDateRange();
    var rows   = window.po.getAttRows();
    count = processRows(rows, selected, region, range, getDistrictFilterVal(), getSchoolFilterVal()).length;
  }
  var el = document.getElementById('irbReasonCount');
  if (el) el.textContent = selected.length + ' reason(s) selected  \u2192  ' + count + ' total events in current period';
}

// ── Preset logic ─────────────────────────────────────────────────────────
var PRESET_DEFS = {
  all:     Object.keys(TAXONOMY),
  si:      Object.keys(TAXONOMY).filter(function(id) { return TAXONOMY[id].group === 'si'; }),
  scholar: Object.keys(TAXONOMY).filter(function(id) { return TAXONOMY[id].group === 'scholar'; }),
  tutor:   ['SI-T1','SI-T2','SI-T3'],
  closures:['SI-S6','SI-S5','SI-S4','SI-S2','SI-S3'],
  none:    []
};

function applyPreset(key) {
  var ids = PRESET_DEFS[key] || [];
  var cbs = document.querySelectorAll('#irbConfigPanel .irb-cb');
  cbs.forEach(function(cb) { cb.checked = ids.indexOf(cb.value) !== -1; });
  updateLiveCount();
}

// ── localStorage preset management ───────────────────────────────────────
var PRESET_KEY = 'njtc_impact_presets';

function loadPresets() {
  try { return JSON.parse(localStorage.getItem(PRESET_KEY) || '[]'); }
  catch(e) { return []; }
}

function savePresets(arr) {
  try { localStorage.setItem(PRESET_KEY, JSON.stringify(arr)); } catch(e) {}
}

function renderPresetChips() {
  var presets   = loadPresets();
  var row       = document.getElementById('irbPresetsRow');
  var container = document.getElementById('irbPresetChips');
  if (!row || !container) return;
  if (!presets.length) { row.style.display = 'none'; return; }
  row.style.display = 'flex';
  container.innerHTML = presets.map(function(p, i) {
    return '<span class="irb-preset-chip" onclick="irb._loadPreset('+i+')">' +
           esc(p.name) +
           '<span class="irb-preset-chip-x" onclick="event.stopPropagation();irb._deletePreset('+i+')">\u00d7</span>' +
           '</span>';
  }).join('');
}

function esc(s) {
  return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function savePreset() {
  var name = window.prompt('Name this quick report:');
  if (!name || !name.trim()) return;
  var presets = loadPresets();
  presets.push({
    name: name.trim(),
    reasons: getSelectedReasons(),
    region: getRegionFilter(),
    period: (document.getElementById('irbPeriodMode')||{}).value || 'this_week'
  });
  savePresets(presets);
  renderPresetChips();
}

function _loadPreset(idx) {
  var presets = loadPresets();
  var p = presets[idx];
  if (!p) return;
  // Apply reasons
  var cbs = document.querySelectorAll('#irbConfigPanel .irb-cb');
  cbs.forEach(function(cb) { cb.checked = p.reasons && p.reasons.indexOf(cb.value) !== -1; });
  // Apply region
  var radios = document.querySelectorAll('input[name="irbRegion"]');
  radios.forEach(function(r) { r.checked = r.value === (p.region || 'all'); });
  // Apply period
  var modeEl = document.getElementById('irbPeriodMode');
  if (modeEl && p.period) { modeEl.value = p.period; onPeriodModeChange(); }
  updateLiveCount();
  generate();
}

function _deletePreset(idx) {
  var presets = loadPresets();
  presets.splice(idx, 1);
  savePresets(presets);
  renderPresetChips();
}

// ── Period mode change ────────────────────────────────────────────────────
function onPeriodModeChange() {
  var modeEl = document.getElementById('irbPeriodMode');
  var modeV  = modeEl ? modeEl.value : 'this_week';
  var weekNav  = document.getElementById('irbWeekNav');
  var customDates = document.getElementById('irbCustomDates');
  var isWeekly = modeV === 'this_week' || modeV === 'last_week';
  var isCustom = modeV === 'custom';
  if (weekNav)    weekNav.style.display    = isWeekly ? 'flex' : 'none';
  if (customDates) customDates.style.display = isCustom ? 'flex' : 'none';
  _weekOffset = 0;
  updateWeekLabel();
  updateLiveCount();
}

function shiftWeek(delta) {
  _weekOffset += delta;
  updateWeekLabel();
  updateLiveCount();
}

// ── Generate report ──────────────────────────────────────────────────────
function generate() {
  var selectedIds = getSelectedReasons();
  var region      = getRegionFilter();
  var range       = getDateRange();
  var label       = (document.getElementById('irbReportLabel')||{}).value || '';

  // Loading state
  var genBtn  = document.getElementById('irbGenerateBtn');
  var genTxt  = document.getElementById('irbGenerateTxt');
  var genSpin = document.getElementById('irbGenerateSpin');
  if (genTxt)  genTxt.style.display  = 'none';
  if (genSpin) genSpin.style.display = 'inline-block';
  if (genBtn)  genBtn.disabled = true;

  // Short async to let spinner paint
  setTimeout(function() {
    try { _generateSync(selectedIds, region, range, label); }
    catch(e) { console.error('[IRB] generate error:', e); showError('An error occurred generating the report. See console for details.'); }
    if (genTxt)  genTxt.style.display  = 'inline';
    if (genSpin) genSpin.style.display = 'none';
    if (genBtn)  genBtn.disabled = false;
  }, 20);
}

function showError(msg) {
  var out = document.getElementById('irbOutput');
  if (!out) return;
  document.getElementById('irbEmptyState').style.display = 'none';
  document.getElementById('irbReportContent').style.display = 'none';
  out.innerHTML = '<div style="padding:2rem;background:#fee2e2;border:1px solid #fca5a5;border-radius:12px;color:#991b1b;font-size:.875rem">\u26a0\ufe0f ' + esc(msg) + '</div>';
}

function _generateSync(selectedIds, region, range, label) {
  // Check Pearl loaded
  if (!window.po) { showError('Pearl Operations module not available.'); return; }
  if (!window.po.isDataLoaded || !window.po.isDataLoaded()) {
    showError('Pearl data has not finished loading. Please wait a moment and try again.'); return; }
  if (!selectedIds.length) {
    showError('No reasons selected. Please check at least one missed reason.'); return; }

  var distF = getDistrictFilterVal();
  var schF  = getSchoolFilterVal();

  var rows = window.po.getAttRows();
  var events = processRows(rows, selectedIds, region, range, distF, schF);
  var agg    = aggregateEvents(events);

  // Prior period
  var priorRange  = getPriorRange(range);
  var priorEvents = processRows(rows, selectedIds, region, priorRange, distF, schF);
  var priorAgg    = aggregateEvents(priorEvents);

  // 8-week trend (always)
  var today    = new Date();
  var thisMon  = weekStart(today);
  var trend8   = [];
  for (var wi = 7; wi >= 0; wi--) {
    var wMon   = addDays(thisMon, -wi * 7);
    var wEnd   = addDays(wMon, 7);
    var wLabel = fmtDate(wMon, true);
    var wRows  = processRows(rows, selectedIds, region, {start:wMon, end:wEnd}, distF, schF);
    var wAgg   = aggregateEvents(wRows);
    trend8.push({ label:wLabel, scholars:wAgg.scholars, sessions:wAgg.sessions, wMon:wMon,
                  byReason: wAgg.byReason });
  }
  var avg8Scholars = Math.round(trend8.reduce(function(s,w){return s+w.scholars;},0) / 8);

  // Cache last report for exports
  _lastReport = { selectedIds:selectedIds, region:region, range:range, label:label,
                  districtFilter:distF, schoolFilter:schF,
                  events:events, agg:agg, priorAgg:priorAgg, trend8:trend8,
                  avg8Scholars:avg8Scholars, generatedAt: new Date() };

  // Render output
  var emptyEl   = document.getElementById('irbEmptyState');
  var contentEl = document.getElementById('irbReportContent');
  if (emptyEl)   emptyEl.style.display = 'none';
  if (contentEl) {
    contentEl.style.display = '';
    contentEl.innerHTML = buildReportHTML(_lastReport);
    // Attach sort handlers to ranking table
    attachRankingSort();
    // Render Chart.js trend chart
    renderTrendChart(_lastReport);
    // Attach tooltip handlers
    attachCalendarTooltips(_lastReport);
  }
}

// ── Build HTML ────────────────────────────────────────────────────────────
function buildReportHTML(r) {
  var html = '';
  // Report header bar
  var regionLabel = r.region === 'NE' ? 'NE Region' : r.region === 'SW' ? 'SW Region' : 'All Regions';
  var reasonsList = r.selectedIds.map(function(id) { return TAXONOMY[id] ? TAXONOMY[id].label : id; });
  var reasonsShort = reasonsList.length <= 3 ? reasonsList.join(', ')
                   : reasonsList.slice(0,3).join(', ') + ' +' + (reasonsList.length-3) + ' more';
  var ts = r.generatedAt.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'});
  var distPill  = r.districtFilter ? '<span class="irb-rh-pill">'+esc(r.districtFilter)+'</span>' : '';
  var schoolPill = r.schoolFilter  ? '<span class="irb-rh-pill">'+esc(r.schoolFilter)+'</span>'  : '';
  html += '<div class="irb-report-header">' +
    '<div class="irb-rh-title">'+(r.label ? esc(r.label) : 'Impact Report')+'</div>' +
    '<span class="irb-rh-pill">'+regionLabel+'</span>' +
    distPill + schoolPill +
    '<span class="irb-rh-pill">'+esc(r.range.label)+'</span>' +
    '<span class="irb-rh-pill" title="'+esc(reasonsList.join(', '))+'">'+esc(reasonsShort)+'</span>' +
    '<span class="irb-rh-ts">Generated '+ts+'</span>' +
    '</div>';

  // BLOCK 1: KPI Strip
  var a = r.agg, pa = r.priorAgg;
  html += '<div class="irb-kpi-strip">' +
    kpiCard('Scholars Impacted', a.scholars, fmtDelta(a.scholars, pa.scholars)) +
    kpiCard('Sessions Lost',     a.sessions, fmtDelta(a.sessions, pa.sessions)) +
    kpiCard('Minutes Lost',      a.mins,     fmtDelta(a.mins,     pa.mins)) +
    kpiCard('Hours Lost',        a.hours,    fmtDelta(a.hours,    pa.hours)) +
    '</div>';

  // Contribution bar (multi-reason)
  if (r.selectedIds.length >= 2 && a.sessions > 0) {
    html += buildContribBar(r.selectedIds, a);
  }

  // BLOCK 2: Calendar
  html += buildCalendarHTML(r);

  // BLOCK 3: Trend chart placeholder
  html += '<div class="irb-chart-wrap">' +
    '<div class="irb-chart-title">8-Week Scholar Impact Trend' +
    (r.avg8Scholars ? ' <span style="font-size:.7rem;font-weight:400;color:var(--muted)">(8-wk avg: '+r.avg8Scholars+' scholars/week)</span>' : '') +
    '</div>' +
    '<div style="position:relative;height:180px"><canvas id="irbTrendCanvas"></canvas></div>' +
    '</div>';

  // BLOCK 4: Ranking table
  html += buildRankingTable(r);

  // BLOCK 5: Export controls
  html += '<div class="irb-export-bar">' +
    '<button class="irb-export-btn" onclick="irb.exportCSV()">\u2b07 CSV \u2014 Session Detail</button>' +
    '<button class="irb-export-btn" onclick="irb.exportExecutive()">\u2b07 Executive Export</button>' +
    '<button class="irb-export-btn irb-btn-primary" onclick="irb.exportPDF()">\ud83d\udcc4 Export PDF for Leadership</button>' +
    '</div>';

  return html;
}

function kpiCard(label, val, delta) {
  return '<div class="irb-kpi-card">' +
    '<div class="irb-kpi-val">'+val.toLocaleString()+'</div>' +
    '<div class="irb-kpi-label">'+label+'</div>' +
    (delta ? '<div class="irb-kpi-delta">'+delta+'</div>' : '') +
    '</div>';
}

function buildContribBar(selectedIds, agg) {
  if (!agg.sessions) return '';
  var segs = '';
  var legend = '';
  selectedIds.forEach(function(id) {
    var rd = agg.byReason[id];
    if (!rd || !rd.sessions) return;
    var pct = Math.round(rd.sessions / agg.sessions * 100);
    var color = getColor(id);
    var lbl = TAXONOMY[id] ? TAXONOMY[id].label : id;
    var shortLbl = lbl.length > 20 ? lbl.slice(0,18)+'\u2026' : lbl;
    segs += '<div class="irb-contrib-seg" style="width:'+pct+'%;background:'+color+'" title="'+esc(lbl)+': '+pct+'%">' +
            (pct >= 8 ? shortLbl+' '+pct+'%' : '') + '</div>';
    legend += '<span class="irb-contrib-legend-item"><span class="irb-contrib-dot" style="background:'+color+'"></span>'+esc(shortLbl)+' '+pct+'%</span>';
  });
  return '<div class="irb-contrib-bar-wrap">' +
    '<div class="irb-contrib-bar-title">Sessions Lost by Reason</div>' +
    '<div class="irb-contrib-bar">'+segs+'</div>' +
    '<div class="irb-contrib-legend">'+legend+'</div>' +
    '</div>';
}

// ── Calendar ─────────────────────────────────────────────────────────────
function buildCalendarHTML(r) {
  var range = r.range;
  var agg   = r.agg;
  var region = r.region;
  var multiReason = r.selectedIds.length >= 2;

  // Collect all schools with events, sorted by region then name
  var allSchools = Object.keys(agg.bySchool).sort(function(a,b) {
    var ra = agg.bySchool[a].region || 'ZZ';
    var rb = agg.bySchool[b].region || 'ZZ';
    if (ra !== rb) return ra < rb ? -1 : 1;
    return a < b ? -1 : 1;
  });

  var html = '<div class="irb-cal-wrap">';
  html += '<div class="irb-cal-title">Calendar Impact Index</div>';

  if (range.mode === 'weekly') {
    html += buildWeekCalendar(range, allSchools, agg, multiReason);
  } else {
    html += buildMultiWeekCalendar(range, allSchools, agg, multiReason);
  }
  html += '</div>';
  return html;
}

function buildWeekCalendar(range, schools, agg, multiReason) {
  // Mon=0 … Fri=4
  var cols = [];
  for (var i = 0; i < 5; i++) {
    cols.push(addDays(range.start, i));
  }

  var html = '<div style="overflow-x:auto"><table class="irb-cal-table">';
  // Header
  html += '<thead><tr><th class="irb-school-th">School</th>';
  cols.forEach(function(d) {
    html += '<th>'+['Mon','Tue','Wed','Thu','Fri'][d.getDay()-1]+'<br><span style="font-weight:400;font-size:.65rem">'+fmtDate(d,true)+'</span></th>';
  });
  html += '<th>Week Total</th></tr></thead><tbody>';

  // Region separators + rows
  var lastRegion = null;
  schools.forEach(function(school) {
    var sc = agg.bySchool[school];
    var reg = sc.region || '\u2014';
    if (reg !== lastRegion) {
      lastRegion = reg;
      var regLabel = reg === 'NE' ? '\u2501\u2501\u2501\u2501\u2501 NE REGION \u2501\u2501\u2501\u2501\u2501'
                  : reg === 'SW' ? '\u2501\u2501\u2501\u2501\u2501 SW REGION \u2501\u2501\u2501\u2501\u2501'
                  : '\u2501\u2501\u2501\u2501\u2501 OTHER \u2501\u2501\u2501\u2501\u2501';
      html += '<tr class="irb-region-row"><td colspan="'+(cols.length+2)+'">'+regLabel+'</td></tr>';
    }
    html += '<tr>';
    html += '<td><div class="irb-school-cell" title="'+esc(school)+'">'+esc(school)+'</div></td>';
    var weekTotal = 0;
    cols.forEach(function(d) {
      var dk = fmtMDY(d);
      var dayData = agg.byDate[dk] && agg.byDate[dk].bySchool[school];
      if (!dayData || !dayData.sessions) {
        html += '<td class="irb-day-cell irb-heat-0 irb-empty">\u2014</td>';
      } else {
        var n = dayData.sessions;
        weekTotal += n;
        var hc = heatClass(n);
        var dataAttrs = ' data-school="'+esc(school)+'" data-date="'+dk+'"';
        html += '<td class="irb-day-cell '+hc+'"'+dataAttrs+'>' +
                '<div class="irb-cell-scholars">'+dayData.scholarCount+'</div>' +
                '<div class="irb-cell-sessions">'+n+' sess</div>' +
                '</td>';
      }
    });
    html += '<td class="irb-day-cell" style="font-weight:700">';
    html += weekTotal > 0 ? weekTotal : '\u2014';
    html += '</td></tr>';
  });

  // Totals row
  html += '<tr class="irb-cal-total-row"><td>TOTAL</td>';
  var grandTotal = 0;
  cols.forEach(function(d) {
    var dk   = fmtMDY(d);
    var dayD = agg.byDate[dk];
    var n    = dayD ? dayD.sessions : 0;
    grandTotal += n;
    html += '<td style="text-align:center">'+(n||'\u2014')+'</td>';
  });
  html += '<td style="text-align:center;color:#e63946">'+grandTotal+'</td></tr>';

  // Empty state
  if (!schools.length) {
    html += '<tr><td colspan="'+(cols.length+2)+'" style="text-align:center;padding:1.5rem;color:var(--muted);font-size:.875rem">No events recorded for the selected reasons and period.</td></tr>';
  }

  html += '</tbody></table></div>';
  return html;
}

function buildMultiWeekCalendar(range, schools, agg, multiReason) {
  // Month-style: 7 columns Mon-Sun, rows = weeks
  var weeks = [];
  var cur = weekStart(range.start);
  var endD = range.end;
  while (cur < endD) {
    weeks.push(cur);
    cur = addDays(cur, 7);
  }

  var html = '<div style="overflow-x:auto"><table class="irb-cal-table">';
  html += '<thead><tr>';
  ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].forEach(function(d,i) {
    var style = i >= 5 ? ' style="color:#94a3b8;font-size:.62rem"' : '';
    html += '<th'+style+'>'+d+'</th>';
  });
  html += '</tr></thead><tbody>';

  weeks.forEach(function(wMon) {
    html += '<tr>';
    for (var di = 0; di < 7; di++) {
      var d  = addDays(wMon, di);
      var dk = fmtMDY(d);
      var dayD = agg.byDate[dk];
      var isWeekend = di >= 5;
      var inRange  = d >= range.start && d < range.end;
      if (!inRange || isWeekend) {
        var style = isWeekend ? 'background:#f8fafc;color:#cbd5e1' : 'background:#f8fafc';
        html += '<td class="irb-day-cell" style="'+style+'">' +
                '<div style="font-size:.68rem;color:#cbd5e1">'+fmtDate(d,true)+'</div></td>';
      } else if (!dayD || !dayD.sessions) {
        html += '<td class="irb-day-cell irb-heat-0 irb-empty">'+
                '<div style="font-size:.68rem;color:#94a3b8">'+fmtDate(d,true)+'</div>\u2014</td>';
      } else {
        var n  = dayD.sessions;
        var hc = heatClass(n);
        html += '<td class="irb-day-cell '+hc+'" data-date="'+dk+'">' +
                '<div style="font-size:.68rem;opacity:.7">'+fmtDate(d,true)+'</div>' +
                '<div class="irb-cell-scholars">'+dayD.scholarCount+'</div>' +
                '<div class="irb-cell-sessions">'+n+' sess</div>' +
                '</td>';
      }
    }
    html += '</tr>';
  });

  if (!weeks.length) {
    html += '<tr><td colspan="7" style="text-align:center;padding:1.5rem;color:var(--muted)">No data in range.</td></tr>';
  }

  html += '</tbody></table></div>';
  return html;
}

// ── Ranking table ──────────────────────────────────────────────────────────
var ROWS_PER_PAGE = 10;

function buildRankingTable(r) {
  var agg = r.agg;
  var priorBySchool = r.priorAgg.bySchool;
  var multiReason   = r.selectedIds.length >= 2;

  var schools = Object.keys(agg.bySchool).map(function(s) {
    var sc      = agg.bySchool[s];
    var priorSc = priorBySchool[s] || { sessions:0, scholarCount:0 };
    // Top reason
    var topReason = null;
    if (multiReason) {
      var maxN = 0;
      Object.keys(sc.byReason).forEach(function(id) {
        if (sc.byReason[id] > maxN) { maxN = sc.byReason[id]; topReason = id; }
      });
    }
    return { school:s, region:sc.region||'', district:sc.district||'',
             scholars:sc.scholarCount, sessions:sc.sessions,
             hrs:+((sc.mins||0)/60).toFixed(1),
             priorScholars:priorSc.scholarCount||0,
             priorSessions:priorSc.sessions||0,
             topReason:topReason };
  });

  // Sort
  schools = sortSchools(schools);

  _rankPage = 0;
  return renderRankingHtml(schools, multiReason);
}

function sortSchools(schools) {
  var col = _rankSort.col;
  var dir = _rankSort.dir === 'asc' ? 1 : -1;
  return schools.slice().sort(function(a,b) {
    var av = a[col], bv = b[col];
    if (typeof av === 'string') av = av.toLowerCase();
    if (typeof bv === 'string') bv = bv.toLowerCase();
    if (av < bv) return -dir;
    if (av > bv) return  dir;
    return 0;
  });
}

function renderRankingHtml(schools, multiReason) {
  var start = _rankPage * ROWS_PER_PAGE;
  var page  = schools.slice(start, start + ROWS_PER_PAGE);
  var totalPages = Math.ceil(schools.length / ROWS_PER_PAGE);

  function th(label, colKey) {
    var cls = _rankSort.col === colKey ? ' irb-sort-'+_rankSort.dir : '';
    return '<th class="'+cls+'" onclick="irb._sortRanking(\''+colKey+'\')">'+label+'</th>';
  }

  var html = '<div class="irb-rank-wrap" id="irbRankWrap">' +
    '<div class="irb-rank-title">School Impact Ranking</div>' +
    '<div style="overflow-x:auto"><table class="irb-rank-table" id="irbRankTable">' +
    '<thead><tr>' +
    th('#','scholars')+ th('School','school')+ th('Region','region')+
    th('Scholars Impacted','scholars')+ th('Sessions Lost','sessions')+ th('Hrs Lost','hrs')+
    th('vs. Prior','priorScholars')+
    (multiReason ? th('Top Reason','topReason') : '') +
    '</tr></thead><tbody>';

  if (!page.length) {
    html += '<tr><td colspan="'+(multiReason?8:7)+'" style="text-align:center;padding:1.5rem;color:var(--muted);font-size:.875rem">No events recorded for the selected reasons and period.</td></tr>';
  }

  page.forEach(function(s, i) {
    var rank = start + i + 1;
    var delta = s.scholars - s.priorScholars;
    var deltaHtml = delta === 0 ? '<span style="color:#94a3b8">\u2194 \u2014</span>'
                 : delta > 0   ? '<span class="irb-delta-up">\u2191 +'+delta+'</span>'
                 :               '<span class="irb-delta-down">\u2193 '+delta+'</span>';
    var topRHtml = '';
    if (multiReason && s.topReason) {
      var lbl = TAXONOMY[s.topReason] ? TAXONOMY[s.topReason].label : s.topReason;
      var shortLbl = lbl.length > 28 ? lbl.slice(0,26)+'\u2026' : lbl;
      topRHtml = '<span style="font-size:.72rem;padding:.15rem .4rem;border-radius:4px;background:'+getColor(s.topReason)+'22;color:'+getColor(s.topReason)+';font-weight:600">'+esc(shortLbl)+'</span>';
    }
    html += '<tr>' +
      '<td style="color:var(--muted);font-size:.8rem;width:28px">'+rank+'</td>' +
      '<td style="font-weight:600;font-size:.8rem">'+esc(s.school)+'</td>' +
      '<td><span style="font-size:.7rem;background:'+(s.region==='NE'?'#dbeafe':'#fce7f3')+';color:'+(s.region==='NE'?'#1e40af':'#9d174d')+';padding:.1rem .35rem;border-radius:4px;font-weight:700">'+esc(s.region||'\u2014')+'</span></td>' +
      '<td style="font-weight:700;text-align:center">'+s.scholars+'</td>' +
      '<td style="text-align:center">'+s.sessions+'</td>' +
      '<td style="text-align:center">'+s.hrs+'</td>' +
      '<td style="text-align:center">'+deltaHtml+'</td>' +
      (multiReason ? '<td>'+topRHtml+'</td>' : '') +
      '</tr>';
  });

  html += '</tbody></table></div>';

  // Pagination
  if (totalPages > 1) {
    html += '<div class="irb-rank-pagination">';
    for (var pg = 0; pg < totalPages; pg++) {
      html += '<button class="irb-page-btn'+(pg===_rankPage?' active':'')+
              '" onclick="irb._rankPage('+pg+')">'+(pg+1)+'</button>';
    }
    html += '</div>';
  }

  html += '</div>';
  return html;
}

function attachRankingSort() {
  // Sort is handled inline via onclick in th() above; no extra binding needed
}

function _sortRanking(col) {
  if (!_lastReport) return;
  if (_rankSort.col === col) {
    _rankSort.dir = _rankSort.dir === 'asc' ? 'desc' : 'asc';
  } else {
    _rankSort.col = col;
    _rankSort.dir = 'desc';
  }
  _rankPage = 0;
  var wrap = document.getElementById('irbRankWrap');
  if (wrap) {
    var multiR = _lastReport.selectedIds.length >= 2;
    var agg    = _lastReport.agg;
    var priorBySchool = _lastReport.priorAgg.bySchool;
    var schools = Object.keys(agg.bySchool).map(function(s) {
      var sc = agg.bySchool[s];
      var priorSc = priorBySchool[s] || {};
      var topReason = null;
      if (multiR) {
        var maxN = 0;
        Object.keys(sc.byReason).forEach(function(id) {
          if (sc.byReason[id] > maxN) { maxN = sc.byReason[id]; topReason = id; }
        });
      }
      return { school:s, region:sc.region||'', district:sc.district||'',
               scholars:sc.scholarCount, sessions:sc.sessions,
               hrs:+((sc.mins||0)/60).toFixed(1),
               priorScholars:priorSc.scholarCount||0,
               priorSessions:priorSc.sessions||0,
               topReason:topReason };
    });
    wrap.outerHTML = renderRankingHtml(sortSchools(schools), multiR);
  }
}

function _rankPage(pg) {
  if (!_lastReport) return;
  _rankPage = pg;
  _sortRanking(_rankSort.col); // re-render
}

// ── Trend Chart (Chart.js 4.x) ────────────────────────────────────────────
function renderTrendChart(r) {
  var canvas = document.getElementById('irbTrendCanvas');
  if (!canvas || typeof Chart === 'undefined') return;

  if (_trendChart) { try { _trendChart.destroy(); } catch(e){} _trendChart = null; }

  var avg  = r.avg8Scholars;
  var weeks = r.trend8;
  var labels = weeks.map(function(w) { return w.label; });
  var multiR = r.selectedIds.length >= 2;

  var datasets;
  if (!multiR) {
    // Single reason — single bar series, color by relative to avg
    var barColors = weeks.map(function(w) {
      if (avg === 0) return '#94a3b8';
      if (w.scholars > avg * 1.1) return '#e63946';
      if (w.scholars >= avg * 0.9) return '#f59e0b';
      return '#059669';
    });
    datasets = [{
      label: 'Scholars Impacted',
      data: weeks.map(function(w) { return w.scholars; }),
      backgroundColor: barColors,
      borderRadius: 4,
    }];
  } else {
    // Stacked bars per reason
    datasets = r.selectedIds.map(function(id) {
      return {
        label: TAXONOMY[id] ? TAXONOMY[id].label : id,
        data: weeks.map(function(w) { return (w.byReason[id]||{sessions:0}).sessions; }),
        backgroundColor: getColor(id),
        borderRadius: 0,
        stack: 'scholars',
      };
    });
  }

  var avgLine = {
    type: 'line',
    label: '8-wk avg',
    data: weeks.map(function() { return avg; }),
    borderColor: '#64748b',
    borderDash: [4,3],
    borderWidth: 1.5,
    pointRadius: 0,
    fill: false,
    tension: 0,
  };

  try {
    _trendChart = new Chart(canvas, {
      type: 'bar',
      data: { labels: labels, datasets: datasets.concat(multiR ? [] : [avgLine]) },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        // Parent div has height:180px — chart fills it exactly
        plugins: {
          legend: { display: multiR, position: 'bottom', labels: { boxWidth: 12, font: { size: 11 } } },
          tooltip: { mode: 'index', intersect: false }
        },
        scales: {
          x: { stacked: multiR, grid: { display: false }, ticks: { font: { size: 11 } } },
          y: { stacked: multiR, beginAtZero: true, ticks: { font: { size: 11 } },
               grid: { color: '#f1f5f9' } }
        }
      }
    });
    // Avg line for stacked
    if (multiR && avg > 0) {
      var avgPlugin = {
        id: 'irbAvgLine',
        afterDraw: function(chart) {
          var ctx   = chart.ctx;
          var yScale = chart.scales.y;
          var xScale = chart.scales.x;
          var yPos  = yScale.getPixelForValue(avg);
          ctx.save();
          ctx.beginPath();
          ctx.setLineDash([4,3]);
          ctx.strokeStyle = '#64748b';
          ctx.lineWidth = 1.5;
          ctx.moveTo(xScale.left, yPos);
          ctx.lineTo(xScale.right, yPos);
          ctx.stroke();
          ctx.restore();
        }
      };
      _trendChart.options.plugins['irbAvgLine'] = avgPlugin;
    }
  } catch(e) { console.warn('[IRB] chart error', e); }
}

// ── Calendar tooltips ─────────────────────────────────────────────────────
function attachCalendarTooltips(r) {
  var multiR = r.selectedIds.length >= 2;
  var agg    = r.agg;

  // Single shared tooltip element
  var tip = document.getElementById('irbGlobalTip');
  if (!tip) {
    tip = document.createElement('div');
    tip.id = 'irbGlobalTip';
    tip.className = 'irb-tooltip';
    tip.style.display = 'none';
    document.body.appendChild(tip);
  }

  function hideTip() { tip.style.display = 'none'; }

  var contentEl = document.getElementById('irbReportContent');
  if (!contentEl) return;

  contentEl.querySelectorAll('.irb-day-cell[data-date]').forEach(function(cell) {
    cell.addEventListener('mouseenter', function(ev) {
      var dk     = cell.getAttribute('data-date');
      var school = cell.getAttribute('data-school'); // may be null for multi-week
      if (!dk) { hideTip(); return; }

      var dayD = agg.byDate[dk];
      if (!dayD || !dayD.sessions) { hideTip(); return; }

      var hdr = '';
      if (school) {
        hdr = esc(school) + ' \u00b7 ' + fmtDate(parseDateStr(dk));
      } else {
        hdr = fmtDate(parseDateStr(dk));
      }

      var sc  = school ? (dayD.bySchool[school]||{}) : dayD;
      var lines = '<div class="irb-tooltip-hdr">'+hdr+'</div>' +
        'Scholars: <strong>'+((sc.scholarCount)||0)+'</strong><br>' +
        'Sessions: <strong>'+((sc.sessions)||0)+'</strong><br>' +
        'Hrs Lost: <strong>'+(+((sc.sessions||0)*SESSION_MINS/60).toFixed(1))+'</strong>';

      if (multiR && sc.byReason) {
        lines += '<hr style="margin:.35rem 0;border-color:rgba(255,255,255,.2)">';
        lines += '<div style="font-size:.72rem;opacity:.8;margin-bottom:.2rem">By Reason:</div>';
        Object.keys(sc.byReason).forEach(function(id) {
          var lbl = TAXONOMY[id] ? TAXONOMY[id].label : id;
          lines += '<div style="font-size:.72rem">'+esc(lbl)+': <strong>'+sc.byReason[id]+'</strong></div>';
        });
      }

      tip.innerHTML = lines;
      tip.style.display = 'block';
      positionTip(ev);
    });

    cell.addEventListener('mousemove', positionTip);
    cell.addEventListener('mouseleave', hideTip);
  });

  function positionTip(ev) {
    var x = ev.clientX + 14;
    var y = ev.clientY + 14;
    if (x + 260 > window.innerWidth)  x = ev.clientX - 260;
    if (y + 180 > window.innerHeight) y = ev.clientY - 180;
    tip.style.left = x + 'px';
    tip.style.top  = y + 'px';
  }
}

// ── CSV exports ────────────────────────────────────────────────────────────
function exportCSV() {
  if (!_lastReport) return;
  var r = _lastReport;
  var labelPart  = r.label ? r.label.replace(/[^a-zA-Z0-9_\-]/g,'_') : 'Report';
  var regionPart = r.region === 'all' ? 'AllRegions' : r.region;
  var datePart   = (fmtISO(r.range.start) + '_' + fmtISO(addDays(r.range.end,-1))).replace(/-/g,'');
  var filename   = 'NJTC_ImpactReport_' + labelPart + '_' + regionPart + '_' + datePart + '.csv';

  var rows = [['Date','Day of Week','Week Label','School','Region','Reason Category','Canonical Reason',
               'Scholar Name','Sessions Lost','Minutes Lost','Hours Lost']];
  r.events.forEach(function(e) {
    var taxonomy  = TAXONOMY[e.canonId] || {};
    var group     = taxonomy.group === 'si' ? 'Service Interruption' : 'Scholar Missed';
    var weekLabel = e.week || '';
    var hrs       = +(e.mins/60).toFixed(2);
    rows.push([
      fmtDate(e.date), DAY_NAMES[e.date.getDay()], weekLabel,
      e.school, e.region||'', group, taxonomy.label||e.canonId,
      e.userName, 1, e.mins, hrs
    ]);
  });
  downloadCSV(rows, filename);
}

function exportExecutive() {
  if (!_lastReport) return;
  var r = _lastReport;
  var labelPart  = r.label ? r.label.replace(/[^a-zA-Z0-9_\-]/g,'_') : 'Report';
  var regionPart = r.region === 'all' ? 'AllRegions' : r.region;
  var datePart   = (fmtISO(r.range.start) + '_' + fmtISO(addDays(r.range.end,-1))).replace(/-/g,'');
  var filename   = 'NJTC_ImpactReport_Executive_' + labelPart + '_' + regionPart + '_' + datePart + '.csv';

  var rows = [];
  var ts   = r.generatedAt.toLocaleString();
  var reasonsList = r.selectedIds.map(function(id) { return TAXONOMY[id] ? TAXONOMY[id].label : id; }).join('; ');
  var a  = r.agg;
  var pa = r.priorAgg;

  rows.push(['=== REPORT CONFIGURATION ===']);
  rows.push(['Report Label', r.label || '(none)']);
  rows.push(['Generated',    ts]);
  rows.push(['Region',       r.region === 'all' ? 'All Regions' : r.region]);
  rows.push(['Period',       r.range.label]);
  rows.push(['Reasons Included', reasonsList]);
  rows.push([]);

  rows.push(['=== WEEKLY SUMMARY ===']);
  rows.push(['Metric','Value','vs. Prior Period']);
  rows.push(['Scholars Impacted', a.scholars, delta(a.scholars, pa.scholars)]);
  rows.push(['Sessions Lost',     a.sessions, delta(a.sessions, pa.sessions)]);
  rows.push(['Minutes Lost',      a.mins,     delta(a.mins,     pa.mins)]);
  rows.push(['Hours Lost',        a.hours,    delta(a.hours,    pa.hours)]);
  rows.push(['8-Week Avg (Scholars)', r.avg8Scholars, '\u2014']);
  rows.push([]);

  if (r.selectedIds.length >= 2) {
    rows.push(['=== REASON BREAKDOWN ===']);
    rows.push(['Reason','Scholars Impacted','Sessions Lost','Hours Lost','% of Total']);
    r.selectedIds.forEach(function(id) {
      var rd  = a.byReason[id] || { scholarCount:0, sessions:0, mins:0 };
      var pct = a.sessions > 0 ? Math.round(rd.sessions/a.sessions*100)+'%' : '0%';
      rows.push([TAXONOMY[id]?TAXONOMY[id].label:id, rd.scholarCount, rd.sessions,
                 +(rd.mins/60).toFixed(1), pct]);
    });
    rows.push([]);
  }

  rows.push(['=== SCHOOL BREAKDOWN ===']);
  rows.push(['Rank','School','Region','Scholars Impacted','Sessions Lost','Hours Lost','vs Prior','Top Reason']);
  var schools = Object.keys(a.bySchool).map(function(s) {
    var sc = a.bySchool[s];
    var topR = null, maxN = 0;
    Object.keys(sc.byReason||{}).forEach(function(id) { if(sc.byReason[id]>maxN){maxN=sc.byReason[id];topR=id;} });
    return { school:s, region:sc.region||'', sc:sc, topR:topR,
             priorSc: pa.bySchool[s]||{scholarCount:0} };
  }).sort(function(a,b) { return b.sc.scholarCount - a.sc.scholarCount; });
  schools.forEach(function(x,i) {
    rows.push([i+1, x.school, x.region, x.sc.scholarCount, x.sc.sessions,
               +((x.sc.mins||0)/60).toFixed(1),
               delta(x.sc.scholarCount, x.priorSc.scholarCount),
               x.topR ? (TAXONOMY[x.topR]?TAXONOMY[x.topR].label:x.topR) : '']);
  });
  rows.push([]);

  rows.push(['=== DAILY DISTRIBUTION ===']);
  rows.push(['Date','Day','Scholars Impacted','Sessions Lost']);
  var dates = Object.keys(a.byDate).sort(function(a,b) { return new Date(a)-new Date(b); });
  dates.forEach(function(dk) {
    var dd = a.byDate[dk];
    rows.push([dk, DAY_NAMES[(dd.date||new Date()).getDay()], dd.scholarCount, dd.sessions]);
  });

  downloadCSV(rows, filename);
}

function delta(curr, prior) {
  if (prior == null) return '\u2014';
  var d = curr - prior;
  return d === 0 ? '\u00b10' : (d > 0 ? '+' : '') + d;
}

function downloadCSV(rows, filename) {
  var csv = rows.map(function(row) {
    return row.map(function(cell) {
      var s = String(cell == null ? '' : cell);
      if (s.includes(',') || s.includes('"') || s.includes('\n')) {
        s = '"' + s.replace(/"/g,'""') + '"';
      }
      return s;
    }).join(',');
  }).join('\r\n');

  var blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  var url  = URL.createObjectURL(blob);
  var link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(function() { URL.revokeObjectURL(url); }, 2000);
}

// ── PDF Export (leadership-ready clean print) ─────────────────────────────
function exportPDF() {
  // Same as printView but triggers print immediately — user saves as PDF
  printView();
}

// ── Print / PDF View ──────────────────────────────────────────────────────
function printView() {
  if (!_lastReport) return;
  var r  = _lastReport;
  var contentEl = document.getElementById('irbReportContent');
  var inner = contentEl ? contentEl.innerHTML : '';

  // Strip export bar (don't want buttons in print)
  inner = inner.replace(/<div class="irb-export-bar">[\s\S]*?<\/div>/, '');

  var html = '<!DOCTYPE html><html><head><meta charset="utf-8">' +
    '<title>NJTC Impact Report' + (r.label ? ' — '+r.label : '') + '</title>' +
    '<link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;600;700&family=DM+Serif+Display&display=swap" rel="stylesheet">' +
    '<style>' +
    '*, *::before, *::after { box-sizing: border-box; margin:0; padding:0; }' +
    'body { font-family: "DM Sans", sans-serif; color:#0a1628; background:#fff; padding: 0.5in; font-size: 10pt; }' +
    'h1 { font-family: "DM Serif Display", serif; font-size: 18pt; margin-bottom: 4pt; }' +
    '.irb-report-header { background:#1e1040; color:#fff; border-radius:8px; padding:10pt 14pt; margin-bottom:12pt; display:flex; flex-wrap:wrap; gap:6pt; align-items:center; }' +
    '.irb-rh-title { font-size:13pt; flex:1; }' +
    '.irb-rh-pill { font-size:8pt; background:rgba(255,255,255,.18); border-radius:20px; padding:2pt 6pt; }' +
    '.irb-rh-ts { font-size:7pt; opacity:.6; }' +
    '.irb-kpi-strip { display:grid; grid-template-columns:repeat(4,1fr); gap:8pt; margin-bottom:10pt; }' +
    '.irb-kpi-card { border:1px solid #e2e8f0; border-radius:8px; padding:8pt; break-inside:avoid; }' +
    '.irb-kpi-val { font-family:"DM Serif Display",serif; font-size:18pt; }' +
    '.irb-kpi-label { font-size:7pt; font-weight:700; text-transform:uppercase; letter-spacing:.06em; color:#64748b; }' +
    '.irb-kpi-delta { font-size:8pt; margin-top:2pt; }' +
    '.irb-delta-up { color:#b91c1c; }' +
    '.irb-delta-down { color:#059669; }' +
    '.irb-delta-flat { color:#94a3b8; }' +
    '.irb-contrib-bar-wrap,.irb-cal-wrap,.irb-chart-wrap,.irb-rank-wrap { border:1px solid #e2e8f0; border-radius:8px; padding:8pt 10pt; margin-bottom:10pt; break-inside:avoid; }' +
    '.irb-contrib-bar { display:flex; height:16px; border-radius:4px; overflow:hidden; margin:4pt 0; }' +
    '.irb-contrib-seg { display:flex; align-items:center; justify-content:center; font-size:7pt; font-weight:700; color:#fff; overflow:hidden; padding:0 3px; }' +
    '.irb-contrib-legend { display:flex; flex-wrap:wrap; gap:3pt 8pt; }' +
    '.irb-contrib-dot { display:inline-block; width:8px; height:8px; border-radius:50%; margin-right:3pt; }' +
    '.irb-cal-table { width:100%; border-collapse:collapse; font-size:8pt; }' +
    '.irb-cal-table th,.irb-cal-table td { border:1px solid #e2e8f0; padding:3pt 5pt; }' +
    '.irb-cal-table th { background:#f8fafc; font-size:7pt; text-transform:uppercase; }' +
    '.irb-school-cell { font-weight:600; max-width:160px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }' +
    '.irb-heat-1 { background:#FFF3CD; }' +
    '.irb-heat-2 { background:#FFD166; }' +
    '.irb-heat-3 { background:#F4845F; color:#fff; }' +
    '.irb-heat-4 { background:#E63946; color:#fff; }' +
    '.irb-rank-table { width:100%; border-collapse:collapse; font-size:8pt; }' +
    '.irb-rank-table th { background:#1e1040; color:#fff; padding:4pt 6pt; text-align:left; font-size:7pt; text-transform:uppercase; }' +
    '.irb-rank-table td { padding:3pt 6pt; border-bottom:1px solid #e2e8f0; }' +
    '.irb-region-row td { background:#1e1040; color:#fff; font-size:7pt; padding:3pt 5pt; }' +
    '.irb-rank-pagination,.irb-export-bar { display:none; }' +
    '@media print { @page { size:letter portrait; margin:.5in; } body { padding:0; } }' +
    '</style></head><body>' +
    inner +
    '</body></html>';

  var win = window.open('', '_blank');
  if (!win) { alert('Please allow popups for this page to open the print view.'); return; }
  win.document.write(html);
  win.document.close();
  setTimeout(function() { win.focus(); win.print(); }, 400);
}

// ── Sync indicator ────────────────────────────────────────────────────────
function updateSyncStatus() {
  var dot  = document.getElementById('irbSyncDot');
  var text = document.getElementById('irbSyncText');
  if (!dot || !text) return;
  if (!window.po) {
    dot.className = 'irb-sync-indicator loading';
    text.textContent = 'Pearl module unavailable';
    return;
  }
  if (window.po.isDataLoaded && window.po.isDataLoaded()) {
    dot.className = 'irb-sync-indicator';
    var rows = window.po.getAttRows();
    text.textContent = rows.length.toLocaleString() + ' attendance records loaded';
  } else {
    dot.className = 'irb-sync-indicator loading';
    text.textContent = 'Waiting for Pearl data\u2026';
    // retry
    setTimeout(updateSyncStatus, 2000);
  }
}

// ── Init ─────────────────────────────────────────────────────────────────
function init() {
  if (_inited) return;
  _inited = true;

  // Attach checkbox/radio change listeners
  document.querySelectorAll('#irbConfigPanel .irb-cb').forEach(function(cb) {
    cb.addEventListener('change', updateLiveCount);
  });
  document.querySelectorAll('input[name="irbRegion"]').forEach(function(r) {
    r.addEventListener('change', function() { populateDistrictSchool(); });
  });
  var periodEl = document.getElementById('irbPeriodMode');
  if (periodEl) periodEl.addEventListener('change', function() { onPeriodModeChange(); });

  // Init period mode UI
  onPeriodModeChange();

  // Load saved presets
  renderPresetChips();

  // Sync status
  updateSyncStatus();

  // Initial count
  updateLiveCount();
}

function onPanelOpen() {
  if (!_inited) init();
  updateSyncStatus();
  // Populate district/school dropdowns once Pearl data is ready
  if (window.po && window.po.isDataLoaded && window.po.isDataLoaded()) {
    populateDistrictSchool();
  } else {
    setTimeout(function() {
      if (window.po && window.po.isDataLoaded && window.po.isDataLoaded()) populateDistrictSchool();
    }, 2000);
  }
  updateLiveCount();
}

// ── Public API ────────────────────────────────────────────────────────────
window.irb = {
  onPanelOpen:        onPanelOpen,
  applyPreset:        applyPreset,
  savePreset:         savePreset,
  _loadPreset:        _loadPreset,
  _deletePreset:      _deletePreset,
  generate:           generate,
  shiftWeek:          shiftWeek,
  onPeriodModeChange: onPeriodModeChange,
  onDistrictChange:   onDistrictChange,
  onFilterChange:     onFilterChange,
  exportCSV:          exportCSV,
  exportExecutive:    exportExecutive,
  printView:          printView,
  exportPDF:          exportPDF,
  _sortRanking:       _sortRanking,
  _rankPage:          _rankPage,
};

})();
