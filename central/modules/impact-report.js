(function() {
// ══════════════════════════════════════════════════════════════════════════
//  IMPACT REPORT BUILDER  (irb)
//  Data Department Only — reads live Pearl att rows via window.po.getAttRows()
//  No new data fetches; all aggregation is client-side.
// ══════════════════════════════════════════════════════════════════════════

// ── ATT column indices (mirrors programming.js ATT object) ────────────────
var C = { USER:0, ROLE:1, SESSION:2, ATT_STATUS:6, MISS_REASON:7, SCHOOL:11, DISTRICT:12, USER_ID:13, WEEK:26, SESS_DATE:5, GRADE:8 };

// ── SESS column indices (mirrors programming.js SESS object) ─────────────
var S = { TITLE:0, INSTRUCTOR:1, LOCATION:3, STATUS:4, START:6, SCHED_DUR:7, ACTUAL_DUR:8, SUBJECT:9, SESS_ID:14, INST_ID:15, STU_IDS:16 };

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

// ── Region definitions — exact mirror of programming.js schoolRegion() ────
// District-level keywords
var NE_KW_D = ['ilearn','i-learn','paterson','pcsst','paterson charter','hoboken','middlesex','central jersey'];
var SW_KW_D = ['american paradigm','first philadelphia','first philly','philadelphia charter',
               'string theory','global leadership academy','global leadership',
               'penns grove','carneys point','haddon township','haddon',
               'hamilton township','gloucester township'];
// School-level: SW explicit list (mirrors programming.js SW_SCHOOLS)
var SW_SCHOOLS_LIST = ['erial','loring flemming','field street','penns grove middle',
                       'van sciver','strawbridge','first philadelphia prep','first philly prep',
                       'the philadelphia charter','philadelphia charter school',
                       'global leadership academy'];

function getRegion(school, district) {
  var s = (school  || '').toLowerCase().trim();
  var d = (district|| '').toLowerCase().trim();
  if (s.startsWith('zzz')) return null;
  // District match (highest priority)
  for (var i=0;i<NE_KW_D.length;i++) if (d.includes(NE_KW_D[i])) return 'NE';
  for (var i=0;i<SW_KW_D.length;i++) if (d.includes(SW_KW_D[i])) return 'SW';
  // School match
  for (var i=0;i<SW_SCHOOLS_LIST.length;i++) if (s.includes(SW_SCHOOLS_LIST[i])) return 'SW';
  // NE school fallbacks
  if (s.includes('ilearn') || s.includes('i-learn')) return 'NE';
  if (s.includes('hoboken'))   return 'NE';
  if (s.includes('middlesex')) return 'NE';
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

// ── Session join helpers ──────────────────────────────────────────────────
// Normalize "MM/DD/YYYY" or "M/D/YYYY" or "3/14/2026 9:00:00 AM" → "3/14/2026"
function normDateStr(s) {
  if (!s) return '';
  var parts = String(s).split(' ')[0];
  var m = parts.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return parts;
  return parseInt(m[1]) + '/' + parseInt(m[2]) + '/' + m[3];
}

// Build a lookup: "userId|dateStr" → [sessRow, ...]
// Called once per export to avoid re-scanning all sess rows
function buildSessIndex(sessRows) {
  var idx = {};
  (sessRows || []).forEach(function(r) {
    var dateStr = normDateStr(r[S.START] || '');
    if (!dateStr) return;
    var stuIds = (r[S.STU_IDS] || '').split(',').map(function(x) { return x.trim(); }).filter(Boolean);
    stuIds.forEach(function(uid) {
      var key = uid + '|' + dateStr;
      if (!idx[key]) idx[key] = [];
      idx[key].push(r);
    });
  });
  return idx;
}

// Find the best session match for an att event
function findSess(sessIdx, userId, dateStr, sessTitle) {
  var key = userId + '|' + normDateStr(dateStr);
  var matches = sessIdx[key];
  if (!matches || !matches.length) return null;
  if (matches.length === 1) return matches[0];
  // Disambiguate by session title (ATT col 2 = session name)
  var exact = matches.filter(function(r) { return (r[S.TITLE]||'') === sessTitle; });
  return exact.length ? exact[0] : matches[0];
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

function processRows(attRows, selectedIds, region, dateRange, districtFilter, schoolFilter, sessIdx) {
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
    var uid = r[C.USER_ID] || r[C.USER] || '';
    var sessTitle = r[C.SESSION] || '';
    var mins = SESSION_MINS;
    if (sessIdx) {
      var sess = findSess(sessIdx, uid, fmtMDY(d), sessTitle);
      if (sess) {
        var actualDur = parseFloat(sess[S.ACTUAL_DUR]);
        var schedDur  = parseFloat(sess[S.SCHED_DUR]);
        mins = (actualDur > 0 ? actualDur : (schedDur > 0 ? schedDur : SESSION_MINS));
      }
    }
    events.push({
      date:d, dateStr:fmtMDY(d), school:school, district:dist, region:reg,
      userId:    uid,
      userName:  r[C.USER] || '',
      sessTitle: sessTitle,
      grade:     r[C.GRADE]   || '',
      rawReason: rawReason,
      canonId:canonId, week: r[C.WEEK] || '', mins:mins,
      // Composite key that identifies a distinct tutoring session event.
      // Using school + date + sessTitle because that's what ATT rows carry —
      // a single session ID for the whole group, mapped from attendance detail.
      sessKey: school + '|' + fmtMDY(d) + '|' + sessTitle
    });
  });
  return events;
}

function aggregateEvents(events) {
  var scholars    = {};
  var sessEvents  = {}; // distinct session events (school|date|title)
  var byReason    = {};
  var bySchool    = {};
  var byDate      = {};

  events.forEach(function(e) {
    var uid = e.userId || e.userName;
    scholars[uid] = true;
    if (e.sessKey) sessEvents[e.sessKey] = true;

    if (!byReason[e.canonId]) byReason[e.canonId] = { sessions:0, scholars:{}, mins:0, sessEvents:{} };
    byReason[e.canonId].sessions++;
    byReason[e.canonId].scholars[uid] = true;
    byReason[e.canonId].mins += e.mins;
    if (e.sessKey) byReason[e.canonId].sessEvents[e.sessKey] = true;

    if (!bySchool[e.school]) bySchool[e.school] = { sessions:0, scholars:{}, mins:0, region:e.region, district:e.district, byReason:{}, sessEvents:{} };
    bySchool[e.school].sessions++;
    bySchool[e.school].scholars[uid] = true;
    bySchool[e.school].mins += e.mins;
    bySchool[e.school].byReason[e.canonId] = (bySchool[e.school].byReason[e.canonId]||0) + 1;
    if (e.sessKey) bySchool[e.school].sessEvents[e.sessKey] = true;

    var dk = e.dateStr;
    if (!byDate[dk]) byDate[dk] = { sessions:0, scholars:{}, mins:0, bySchool:{}, byReason:{}, sessEvents:{}, date:e.date };
    byDate[dk].sessions++;
    byDate[dk].scholars[uid] = true;
    byDate[dk].mins += e.mins;
    byDate[dk].byReason[e.canonId] = (byDate[dk].byReason[e.canonId]||0)+1;
    if (e.sessKey) byDate[dk].sessEvents[e.sessKey] = true;
    if (!byDate[dk].bySchool[e.school]) byDate[dk].bySchool[e.school] = { sessions:0, scholars:{}, mins:0, byReason:{}, sessEvents:{}, region:e.region };
    byDate[dk].bySchool[e.school].sessions++;
    byDate[dk].bySchool[e.school].scholars[uid] = true;
    byDate[dk].bySchool[e.school].mins += e.mins;
    byDate[dk].bySchool[e.school].byReason[e.canonId] = (byDate[dk].bySchool[e.school].byReason[e.canonId]||0)+1;
    if (e.sessKey) byDate[dk].bySchool[e.school].sessEvents[e.sessKey] = true;
  });

  Object.keys(byReason).forEach(function(id) {
    byReason[id].scholarCount     = Object.keys(byReason[id].scholars).length;
    byReason[id].sessionsDisrupted = Object.keys(byReason[id].sessEvents).length;
  });
  Object.keys(bySchool).forEach(function(s) {
    bySchool[s].scholarCount      = Object.keys(bySchool[s].scholars).length;
    bySchool[s].sessionsDisrupted = Object.keys(bySchool[s].sessEvents).length;
  });
  Object.keys(byDate).forEach(function(dk) {
    byDate[dk].scholarCount       = Object.keys(byDate[dk].scholars).length;
    byDate[dk].sessionsDisrupted  = Object.keys(byDate[dk].sessEvents).length;
    Object.keys(byDate[dk].bySchool).forEach(function(s) {
      byDate[dk].bySchool[s].scholarCount      = Object.keys(byDate[dk].bySchool[s].scholars).length;
      byDate[dk].bySchool[s].sessionsDisrupted = Object.keys(byDate[dk].bySchool[s].sessEvents).length;
    });
  });

  var total      = events.length;
  var totalMins  = events.reduce(function(s, e) { return s + e.mins; }, 0);
  var totalDisr  = Object.keys(sessEvents).length;
  var avgPullRate = totalDisr > 0 ? +(total / totalDisr).toFixed(1) : 0;
  return { scholars:Object.keys(scholars).length, sessions:total,
           mins:totalMins, hours:+(totalMins/60).toFixed(1),
           sessionsDisrupted: totalDisr,
           avgPullRate: avgPullRate,
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

  var rows     = window.po.getAttRows();
  var sessRows = (window.po.getSessRows) ? window.po.getSessRows() : [];
  var sessIdx  = buildSessIndex(sessRows);
  var events = processRows(rows, selectedIds, region, range, distF, schF, sessIdx);
  var agg    = aggregateEvents(events);

  // Prior period
  var priorRange  = getPriorRange(range);
  var priorEvents = processRows(rows, selectedIds, region, priorRange, distF, schF, sessIdx);
  var priorAgg    = aggregateEvents(priorEvents);

  // 8-week trend (always)
  var today    = new Date();
  var thisMon  = weekStart(today);
  var trend8   = [];
  for (var wi = 7; wi >= 0; wi--) {
    var wMon   = addDays(thisMon, -wi * 7);
    var wEnd   = addDays(wMon, 7);
    var wLabel = fmtDate(wMon, true);
    var wRows  = processRows(rows, selectedIds, region, {start:wMon, end:wEnd}, distF, schF, sessIdx);
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
    kpiCard('Scholars Impacted',   a.scholars,           fmtDelta(a.scholars, pa.scholars),           'unique scholars') +
    kpiCard('Scholar-Sess Records',a.sessions,           fmtDelta(a.sessions, pa.sessions),           'scholar × session records') +
    kpiCard('Sessions Disrupted',  a.sessionsDisrupted,  null,                                        'distinct session events') +
    kpiCard('Avg Pull Rate',       a.avgPullRate,        null,                                        'records ÷ events') +
    kpiCard('Hours Lost',          a.hours,              fmtDelta(a.hours,    pa.hours),              'actual session minutes ÷ 60') +
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

  // BLOCK 5: Export controls — 4 distinct outputs
  html += '<div class="irb-export-bar">' +
    '<div class="irb-export-group">' +
      '<div class="irb-export-group-label">Data Export</div>' +
      '<button class="irb-export-btn irb-export-csv" onclick="irb.exportCSV()" title="26-column session-joined CSV with Pearl Session IDs — opens in Google Sheets">' +
        '<span class="irb-export-icon">&#8659;</span> Session Detail CSV' +
        '<span class="irb-export-sub">Pearl IDs · Google Sheets ready</span>' +
      '</button>' +
    '</div>' +
    '<div class="irb-export-group">' +
      '<div class="irb-export-group-label">PDF Reports</div>' +
      '<button class="irb-export-btn irb-export-exec" onclick="irb.exportPDF()" title="Clean executive summary — scholars, trends, top schools">' +
        '<span class="irb-export-icon">&#128196;</span> Executive Summary' +
        '<span class="irb-export-sub">Leadership &amp; Board</span>' +
      '</button>' +
      '<button class="irb-export-btn irb-export-school" onclick="irb.exportPDFSchool()" title="School-by-school breakdown with impacted dates and reasons">' +
        '<span class="irb-export-icon">&#127981;</span> School Partner Report' +
        '<span class="irb-export-sub">Principals &amp; Site Coordinators</span>' +
      '</button>' +
      '<button class="irb-export-btn irb-export-program" onclick="irb.exportPDFProgram()" title="Full operational detail — all schools, reasons, daily log">' +
        '<span class="irb-export-icon">&#9881;</span> Program Team Report' +
        '<span class="irb-export-sub">Operational Drill-Down</span>' +
      '</button>' +
    '</div>' +
    '</div>';

  return html;
}

function kpiCard(label, val, delta, formula) {
  return '<div class="irb-kpi-card">' +
    '<div class="irb-kpi-val">'+val.toLocaleString()+'</div>' +
    '<div class="irb-kpi-label">'+label+'</div>' +
    (formula ? '<div class="irb-kpi-formula">'+formula+'</div>' : '') +
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
    var sessDisr = sc.sessionsDisrupted || 0;
    return { school:s, region:sc.region||'', district:sc.district||'',
             scholars:sc.scholarCount, sessions:sc.sessions,
             hrs:+((sc.mins||0)/60).toFixed(1),
             sessDisr:sessDisr,
             avgPull: sessDisr > 0 ? +((sc.sessions||0)/sessDisr).toFixed(1) : 0,
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
    '<div class="irb-rank-title">School Impact Ranking' +
    '<span style="font-size:.7rem;font-weight:400;color:var(--muted);margin-left:.75rem">Scholar Impact · Session Impact</span>' +
    '</div>' +
    '<div style="overflow-x:auto"><table class="irb-rank-table" id="irbRankTable">' +
    '<thead><tr>' +
    th('#','scholars')+ th('School','school')+ th('Region','region')+
    th('Scholars','scholars')+ th('Records','sessions')+ th('Sess Disrupted','sessDisr')+ th('Avg Pull','avgPull')+
    th('Hrs Lost','hrs')+ th('vs. Prior','priorScholars')+
    (multiReason ? th('Top Reason','topReason') : '') +
    '</tr></thead><tbody>';

  if (!page.length) {
    html += '<tr><td colspan="'+(multiReason?10:9)+'" style="text-align:center;padding:1.5rem;color:var(--muted);font-size:.875rem">No events recorded for the selected reasons and period.</td></tr>';
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
      '<td style="font-weight:700;text-align:center" title="Unique scholars impacted">'+s.scholars+'</td>' +
      '<td style="text-align:center;color:var(--muted)" title="Scholar \xd7 session records">'+s.sessions+'</td>' +
      '<td style="text-align:center;font-weight:600" title="Distinct session events disrupted">'+s.sessDisr+'</td>' +
      '<td style="text-align:center;color:var(--muted)" title="Avg scholars pulled per disrupted session">'+s.avgPull+'</td>' +
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
      var sessDisr2 = sc.sessionsDisrupted || 0;
      return { school:s, region:sc.region||'', district:sc.district||'',
               scholars:sc.scholarCount, sessions:sc.sessions,
               hrs:+((sc.mins||0)/60).toFixed(1),
               sessDisr:sessDisr2,
               avgPull: sessDisr2 > 0 ? +((sc.sessions||0)/sessDisr2).toFixed(1) : 0,
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
      var scDisr = sc.sessionsDisrupted || 0;
      var lines = '<div class="irb-tooltip-hdr">'+hdr+'</div>' +
        'Scholars pulled: <strong>'+((sc.scholarCount)||0)+'</strong><br>' +
        'Scholar-sess records: <strong>'+((sc.sessions)||0)+'</strong><br>' +
        'Sessions disrupted: <strong>'+scDisr+'</strong>' +
        (scDisr > 0 ? ' <span style="font-size:.7em;opacity:.7">(others may have attended)</span>' : '') + '<br>' +
        'Hrs Lost: <strong>'+(+((sc.mins != null ? sc.mins : (sc.sessions||0)*SESSION_MINS)/60).toFixed(1))+'</strong>';

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

  // Build session index from live sess rows for join
  var sessRows = (window.po && window.po.getSessRows) ? window.po.getSessRows() : [];
  var sessIdx  = buildSessIndex(sessRows);

  var labelPart  = r.label ? r.label.replace(/[^a-zA-Z0-9_\-]/g,'_') : 'Report';
  var regionPart = r.region === 'all' ? 'AllRegions' : r.region;
  var datePart   = (fmtISO(r.range.start) + '_' + fmtISO(addDays(r.range.end,-1))).replace(/-/g,'');
  var filename   = 'NJTC_SessionDetail_' + labelPart + '_' + regionPart + '_' + datePart + '.csv';

  // 26-column header — designed for direct Google Sheets import
  var rows = [[
    'Pearl Session ID',
    'Session Title',
    'Date',
    'Day of Week',
    'Week Label',
    'School',
    'District',
    'Region',
    'Subject',
    'Location',
    'Scheduled Start',
    'Scheduled Duration (min)',
    'Actual Duration (min)',
    'Session Status',
    'Instructor Name',
    'Instructor Pearl ID',
    'Scholar Name',
    'Scholar Pearl ID',
    'Scholar Grade',
    'Attendance Status',
    'Raw Missed Reason',
    'Reason Category',
    'Reason ID',
    'Canonical Reason',
    'Minutes Lost',
    'Hours Lost'
  ]];

  r.events.forEach(function(e) {
    var taxonomy = TAXONOMY[e.canonId] || {};
    var group    = taxonomy.group === 'si' ? 'Service Interruption' : 'Scholar Missed';
    var sess     = findSess(sessIdx, e.userId, e.dateStr, e.sessTitle);

    rows.push([
      sess ? (sess[S.SESS_ID]    || '') : '',
      sess ? (sess[S.TITLE]      || '') : (e.sessTitle || ''),
      fmtDate(e.date),
      DAY_NAMES[e.date.getDay()],
      e.week || '',
      e.school,
      e.district || '',
      e.region   || '',
      sess ? (sess[S.SUBJECT]    || '') : '',
      sess ? (sess[S.LOCATION]   || '') : '',
      sess ? (sess[S.START]      || '') : '',
      sess ? (sess[S.SCHED_DUR]  || '') : '',
      sess ? (sess[S.ACTUAL_DUR] || '') : '',
      sess ? (sess[S.STATUS]     || '') : '',
      sess ? (sess[S.INSTRUCTOR] || '') : '',
      sess ? (sess[S.INST_ID]    || '') : '',
      e.userName,
      e.userId   || '',
      e.grade    || '',
      'Missed',
      e.rawReason || '',
      group,
      e.canonId,
      taxonomy.label || e.canonId,
      e.mins,
      +(e.mins / 60).toFixed(2)
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

// ── PDF helpers ────────────────────────────────────────────────────────────
function _openPrintWindow(html, title) {
  var win = window.open('', '_blank');
  if (!win) { alert('Please allow popups for PDF export.'); return; }
  var blob    = new Blob([html], { type: 'text/html;charset=utf-8' });
  var blobUrl = URL.createObjectURL(blob);
  win.location.href = blobUrl;
  var check = setInterval(function() {
    try {
      if (win.document && win.document.readyState === 'complete') {
        clearInterval(check);
        setTimeout(function() {
          win.focus(); win.print();
          setTimeout(function() { try { URL.revokeObjectURL(blobUrl); } catch(e) {} }, 60000);
        }, 400);
      }
    } catch(e) {}
  }, 100);
  setTimeout(function() { clearInterval(check); try { win.focus(); win.print(); } catch(e) {} }, 3500);
}

var PDF_GOOGLE_FONT = '<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Playfair+Display:wght@700;800&display=swap" rel="stylesheet">';

// Shared base reset
var PDF_BASE_CSS = [
  '*, *::before, *::after { box-sizing:border-box; margin:0; padding:0; }',
  'body { font-family:"Inter",system-ui,sans-serif; color:#0f172a; background:#fff; font-size:9.5pt; line-height:1.45; }',
  '.page-break { page-break-before:always; }',
  '@media print { @page { size:letter portrait; margin:.45in .5in; } body { padding:0; } * { -webkit-print-color-adjust:exact !important; print-color-adjust:exact !important; } }',
].join('\n');

// Build ranked school list from agg
function _schoolRank(agg, priorAgg) {
  return Object.keys(agg.bySchool).map(function(s) {
    var sc = agg.bySchool[s];
    var psc = (priorAgg.bySchool[s]) || { scholarCount:0 };
    var topR = null; var maxN = 0;
    Object.keys(sc.byReason||{}).forEach(function(id) { if(sc.byReason[id]>maxN){maxN=sc.byReason[id];topR=id;} });
    var sessDisr = sc.sessionsDisrupted || 0;
    return { school:s, region:sc.region||'', district:sc.district||'',
             scholars:sc.scholarCount, sessions:sc.sessions,
             hrs:+((sc.mins||0)/60).toFixed(1),
             sessDisr:sessDisr,
             avgPull: sessDisr > 0 ? +((sc.sessions||0)/sessDisr).toFixed(1) : 0,
             delta: sc.scholarCount - psc.scholarCount, topR:topR };
  }).sort(function(a,b) { return b.scholars - a.scholars; });
}

// ── Lens 1: Executive Summary ─────────────────────────────────────────────
// Audience: NJTC leadership, board, funders
// Design: Clean, data-forward, white space, no clutter
function exportPDF() {
  if (!_lastReport) return;
  var r  = _lastReport;
  var a  = r.agg, pa = r.priorAgg;
  var ts = r.generatedAt.toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'});
  var regionLabel = r.region === 'NE' ? 'NE Region' : r.region === 'SW' ? 'SW Region' : 'All Regions';
  var rankedSchools = _schoolRank(a, pa);

  function kpi(val, lbl, up, prior) {
    var diff = prior != null ? val - prior : null;
    var arrow = diff === null ? '' : diff === 0 ? '<span style="color:#94a3b8">&#8596; No change</span>'
              : diff > 0 ? '<span style="color:#dc2626">&#8593; +'+diff+' vs prior</span>'
              : '<span style="color:#16a34a">&#8595; '+diff+' vs prior</span>';
    return '<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:14pt 12pt;text-align:center">' +
      '<div style="font-family:Playfair Display,serif;font-size:28pt;font-weight:800;color:#0f172a;line-height:1">'+val.toLocaleString()+'</div>' +
      '<div style="font-size:7pt;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#64748b;margin-top:4pt">'+lbl+'</div>' +
      (arrow ? '<div style="font-size:7.5pt;margin-top:5pt">'+arrow+'</div>' : '') +
      '</div>';
  }

  // Top 8 schools
  var top8 = rankedSchools.slice(0,8);
  var topSchoolRows = top8.map(function(s,i) {
    var barPct = rankedSchools[0].scholars > 0 ? Math.round(s.scholars/rankedSchools[0].scholars*100) : 0;
    var regBg  = s.region==='NE' ? '#dbeafe' : s.region==='SW' ? '#fce7f3' : '#f1f5f9';
    var regClr = s.region==='NE' ? '#1e40af' : s.region==='SW' ? '#9d174d' : '#64748b';
    return '<tr style="border-bottom:1px solid #f1f5f9">' +
      '<td style="padding:5pt 8pt;font-size:8pt;color:#94a3b8;width:22pt;font-weight:700">'+(i+1)+'</td>' +
      '<td style="padding:5pt 8pt;font-weight:600;font-size:8.5pt">' +
        esc(s.school) +
        '<div style="margin-top:2pt;background:#f1f5f9;border-radius:3px;height:4px;width:100%;overflow:hidden">' +
        '<div style="background:#e63946;height:4px;width:'+barPct+'%"></div></div>' +
      '</td>' +
      '<td style="padding:5pt 4pt;text-align:center"><span style="font-size:7pt;background:'+regBg+';color:'+regClr+';padding:1pt 5pt;border-radius:20px;font-weight:700">'+esc(s.region||'—')+'</span></td>' +
      '<td style="padding:5pt 8pt;text-align:center;font-weight:700;font-size:9.5pt">'+s.scholars+'</td>' +
      '<td style="padding:5pt 8pt;text-align:center;color:#64748b;font-size:8pt">'+s.sessions+'</td>' +
      '<td style="padding:5pt 8pt;text-align:center;font-size:8pt">' +
        (s.delta===0?'<span style="color:#94a3b8">—</span>' : s.delta>0 ? '<span style="color:#dc2626">&#8593;+'+s.delta+'</span>' : '<span style="color:#16a34a">&#8595;'+s.delta+'</span>') +
      '</td>' +
      '</tr>';
  }).join('');

  // Reason breakdown bars
  var reasonBars = '';
  if (r.selectedIds.length >= 2 && a.sessions > 0) {
    reasonBars = '<div style="margin-top:10pt">' +
      r.selectedIds.filter(function(id){return a.byReason[id]&&a.byReason[id].sessions>0;})
       .sort(function(a2,b2){return (a.byReason[b2]||{sessions:0}).sessions-(a.byReason[a2]||{sessions:0}).sessions;})
       .map(function(id) {
         var rd  = a.byReason[id] || { sessions:0, scholarCount:0 };
         var pct = Math.round(rd.sessions/a.sessions*100);
         var clr = getColor(id);
         return '<div style="margin-bottom:7pt">' +
           '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:2pt">' +
           '<span style="font-size:8pt;font-weight:600">'+esc(TAXONOMY[id]?TAXONOMY[id].label:id)+'</span>' +
           '<span style="font-size:8pt;color:#64748b">'+rd.sessions+' sess · '+rd.scholarCount+' scholars · '+pct+'%</span>' +
           '</div>' +
           '<div style="background:#f1f5f9;border-radius:4px;height:8px;overflow:hidden">' +
           '<div style="background:'+clr+';height:8px;width:'+pct+'%;border-radius:4px"></div>' +
           '</div></div>';
       }).join('') + '</div>';
  }

  var html = '<!DOCTYPE html><html><head><meta charset="utf-8"><meta http-equiv="X-UA-Compatible" content="IE=edge"><title>NJTC Executive Impact Report</title>' +
    PDF_GOOGLE_FONT + '<style>' + PDF_BASE_CSS + '</style></head><body>' +

    // Cover bar
    '<div style="background:linear-gradient(135deg,#0f172a 0%,#1e1b4b 60%,#312e81 100%);color:#fff;padding:22pt 26pt 16pt;border-radius:0 0 14px 14px;margin-bottom:18pt">' +
      '<div style="display:flex;align-items:flex-start;justify-content:space-between">' +
        '<div>' +
          '<div style="font-size:8pt;font-weight:700;text-transform:uppercase;letter-spacing:.14em;color:rgba(255,255,255,.55);margin-bottom:4pt">New Jersey Tutoring Corps</div>' +
          '<div style="font-family:Playfair Display,serif;font-size:20pt;font-weight:800;line-height:1.1">'+(r.label||'Executive Impact Report')+'</div>' +
          '<div style="font-size:9pt;margin-top:6pt;color:rgba(255,255,255,.75)">'+esc(r.range.label)+' &nbsp;·&nbsp; '+esc(regionLabel)+'</div>' +
        '</div>' +
        '<div style="text-align:right;color:rgba(255,255,255,.5);font-size:7.5pt;line-height:1.7">' +
          'Generated '+ts+'<br>Confidential — NJTC Internal' +
        '</div>' +
      '</div>' +
    '</div>' +

    // KPI grid
    '<div style="display:grid;grid-template-columns:repeat(5,1fr);gap:7pt;margin-bottom:16pt">' +
      kpi(a.scholars,'Scholars Impacted',a.scholars>pa.scholars,pa.scholars) +
      kpi(a.sessions,'Scholar-Sess Records',a.sessions>pa.sessions,pa.sessions) +
      kpi(a.sessionsDisrupted,'Sessions Disrupted',false,null) +
      kpi(a.avgPullRate,'Avg Pull Rate',false,null) +
      kpi(a.hours,'Hours Lost',a.hours>pa.hours,pa.hours) +
    '</div>' +

    // 8-week context strip
    (r.avg8Scholars ? '<div style="background:#fafafa;border:1px solid #e2e8f0;border-radius:8px;padding:10pt 14pt;margin-bottom:16pt;font-size:8.5pt;color:#475569">' +
      '8-week average: <strong style="color:#0f172a">'+r.avg8Scholars+' scholars impacted per week</strong>. ' +
      (a.scholars > r.avg8Scholars*1.1 ? '<span style="color:#dc2626;font-weight:600">This week is above average — attention required.</span>'
      : a.scholars < r.avg8Scholars*0.9 ? '<span style="color:#16a34a;font-weight:600">This week is below average — positive trend.</span>'
      : '<span style="color:#d97706;font-weight:600">This week is near the rolling average.</span>') +
    '</div>' : '') +

    // Reason breakdown
    (r.selectedIds.length >= 2 && a.sessions > 0 ?
    '<div style="border:1px solid #e2e8f0;border-radius:10px;padding:12pt 14pt;margin-bottom:16pt;break-inside:avoid">' +
      '<div style="font-size:8pt;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:#64748b;margin-bottom:8pt">Sessions Lost by Reason</div>' +
      reasonBars +
    '</div>' : '') +

    // School ranking table
    '<div style="border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;margin-bottom:16pt;break-inside:avoid">' +
      '<div style="background:#0f172a;color:#fff;padding:9pt 14pt;font-size:8pt;font-weight:700;text-transform:uppercase;letter-spacing:.1em">Top Schools by Scholar Impact</div>' +
      '<table style="width:100%;border-collapse:collapse">' +
        '<thead><tr style="background:#f8fafc">' +
          '<th style="padding:6pt 8pt;text-align:left;font-size:7pt;text-transform:uppercase;color:#64748b;font-weight:700">#</th>' +
          '<th style="padding:6pt 8pt;text-align:left;font-size:7pt;text-transform:uppercase;color:#64748b;font-weight:700">School</th>' +
          '<th style="padding:6pt 4pt;text-align:center;font-size:7pt;text-transform:uppercase;color:#64748b;font-weight:700">Region</th>' +
          '<th style="padding:6pt 8pt;text-align:center;font-size:7pt;text-transform:uppercase;color:#64748b;font-weight:700">Scholars</th>' +
          '<th style="padding:6pt 8pt;text-align:center;font-size:7pt;text-transform:uppercase;color:#64748b;font-weight:700">Sessions</th>' +
          '<th style="padding:6pt 8pt;text-align:center;font-size:7pt;text-transform:uppercase;color:#64748b;font-weight:700">vs. Prior</th>' +
        '</tr></thead>' +
        '<tbody>'+topSchoolRows+'</tbody>' +
      '</table>' +
    '</div>' +

    // Methodology footnote
    '<div style="border:1px solid #e2e8f0;border-radius:8px;padding:9pt 12pt;margin-bottom:12pt;font-size:7pt;color:#64748b;line-height:1.6">' +
      '<strong style="color:#0f172a;font-size:7.5pt">Methodology &amp; Definitions</strong> &nbsp;&mdash;&nbsp; ' +
      '<strong>Scholars Impacted:</strong> count of distinct scholars with \u22651 missed-session record in the period. &nbsp;' +
      '<strong>Scholar-Session Records:</strong> total rows where a scholar missed a session (one scholar missing two sessions = 2 records). &nbsp;' +
      '<strong>Sessions Disrupted:</strong> count of distinct session events (school + date + session title) that had \u22651 scholar pulled from them. &nbsp;' +
      '<strong>Avg Pull Rate:</strong> scholar-session records \xf7 sessions disrupted — average number of scholars pulled per disrupted session. &nbsp;' +
      '<strong>Hours Lost:</strong> sum of actual session minutes (per Pearl session data) \xf7 60.' +
    '</div>' +

    // Footer
    '<div style="border-top:1px solid #e2e8f0;padding-top:8pt;display:flex;justify-content:space-between;align-items:center;font-size:7pt;color:#94a3b8">' +
      '<span>New Jersey Tutoring Corps &nbsp;·&nbsp; Pearl Operations Live Data</span>' +
      '<span>Confidential — For Internal Use Only</span>' +
    '</div>' +

    '</body></html>';

  _openPrintWindow(html, 'NJTC Executive Impact Report');
}

// ── Lens 2: School Partner Report ─────────────────────────────────────────
// Audience: Principals, site coordinators, school partners
// Design: Warm, school-centric, collaborative tone, focused on their data
function exportPDFSchool() {
  if (!_lastReport) return;
  var r  = _lastReport;
  var a  = r.agg, pa = r.priorAgg;
  var ts = r.generatedAt.toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'});
  var regionLabel = r.region === 'NE' ? 'NE Region' : r.region === 'SW' ? 'SW Region' : 'All Regions';
  var rankedSchools = _schoolRank(a, pa);
  var focusSchool = r.schoolFilter || null;

  // Build school detail cards
  var schoolCards = rankedSchools.map(function(s) {
    var sc = a.bySchool[s.school];
    var regBg = s.region==='NE' ? '#eff6ff' : s.region==='SW' ? '#fdf2f8' : '#f8fafc';
    var regAccent = s.region==='NE' ? '#1e40af' : s.region==='SW' ? '#9d174d' : '#475569';
    var regLabel  = s.region==='NE' ? 'NE Region' : s.region==='SW' ? 'SW Region' : (s.region||'');

    // Dates with impact (sorted)
    var dates = Object.keys(a.byDate).filter(function(dk) {
      return a.byDate[dk].bySchool && a.byDate[dk].bySchool[s.school];
    }).sort(function(a2,b2){return new Date(a2)-new Date(b2);});

    var dateList = dates.map(function(dk) {
      var dd = a.byDate[dk].bySchool[s.school];
      var scholarsN = dd.scholarCount;
      var recordsN  = dd.sessions;
      var disrN     = dd.sessionsDisrupted || 0;
      // Clarify whether scholars were spread across multiple sessions or all from the same one
      var sessContext = disrN === 0 ? ''
        : disrN === 1
          ? '<span style="font-size:6.5pt;color:#7c3aed;font-weight:600"> · 1 session disrupted</span>'
          : '<span style="font-size:6.5pt;color:#7c3aed;font-weight:600"> · '+disrN+' sessions disrupted</span>';
      // If scholars === records, it means each scholar missed exactly 1 session
      var recNote = recordsN !== scholarsN
        ? '<span style="font-size:6.5pt;color:#f59e0b;font-weight:600"> ('+recordsN+' records)</span>'
        : '';
      return '<div style="padding:4pt 10pt;border-bottom:1px solid #f1f5f9;font-size:8pt">' +
        '<div style="display:flex;justify-content:space-between;align-items:center">' +
          '<span style="font-weight:500">'+esc(dk)+' ('+DAY_NAMES[(new Date(dk)).getDay()]+')</span>' +
          '<span style="color:#475569;font-weight:600">'+scholarsN+' scholar'+(scholarsN!==1?'s':'')+' pulled'+recNote+sessContext+'</span>' +
        '</div>' +
        (disrN > 0 ? '<div style="font-size:6pt;color:#94a3b8;margin-top:1pt;padding-left:2pt">'+
          (disrN === 1 && scholarsN === recordsN
            ? 'All '+scholarsN+' pulled from the same session — others in that session may have attended.'
            : 'Pulled across '+disrN+' distinct session event'+(disrN!==1?'s':'')+' — other scholars in those sessions may have attended.') +
        '</div>' : '') +
        '</div>';
    }).join('');

    // Reason breakdown for this school
    var scReasons = Object.keys(sc.byReason||{})
      .sort(function(a2,b2){return sc.byReason[b2]-sc.byReason[a2];})
      .map(function(id) {
        var cnt = sc.byReason[id];
        var lbl = TAXONOMY[id]?TAXONOMY[id].label:id;
        var clr = getColor(id);
        return '<div style="display:flex;align-items:center;gap:6pt;margin-bottom:4pt;font-size:8pt">' +
          '<div style="width:10px;height:10px;border-radius:50%;background:'+clr+';flex-shrink:0"></div>' +
          '<span style="flex:1">'+esc(lbl)+'</span>' +
          '<span style="font-weight:700;color:#0f172a">'+cnt+'</span>' +
          '</div>';
      }).join('');

    return '<div style="border:1.5px solid '+regAccent+'33;border-radius:10px;overflow:hidden;margin-bottom:14pt;break-inside:avoid">' +
      // School header
      '<div style="background:'+regBg+';border-bottom:1.5px solid '+regAccent+'22;padding:10pt 14pt;display:flex;justify-content:space-between;align-items:center">' +
        '<div>' +
          '<div style="font-size:11pt;font-weight:700;color:#0f172a">'+esc(s.school)+'</div>' +
          '<div style="font-size:7.5pt;color:#475569;margin-top:2pt">'+esc(s.district||'')+'</div>' +
        '</div>' +
        '<div style="text-align:right">' +
          '<span style="background:'+regAccent+';color:#fff;font-size:7pt;font-weight:700;padding:2pt 8pt;border-radius:20px">'+esc(regLabel)+'</span>' +
        '</div>' +
      '</div>' +
      // Stats row — Scholar Impact lens + Session Impact lens
      '<div style="display:grid;grid-template-columns:repeat(5,1fr);gap:0">' +
        '<div style="padding:8pt;text-align:center;border-right:1px solid #f1f5f9">' +
          '<div style="font-family:Playfair Display,serif;font-size:18pt;font-weight:700;color:#e63946">'+s.scholars+'</div>' +
          '<div style="font-size:6.5pt;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#64748b">Scholars</div>' +
          '<div style="font-size:6pt;color:#94a3b8;font-style:italic">unique</div>' +
        '</div>' +
        '<div style="padding:8pt;text-align:center;border-right:1px solid #f1f5f9">' +
          '<div style="font-family:Playfair Display,serif;font-size:18pt;font-weight:700;color:#f59e0b">'+s.sessions+'</div>' +
          '<div style="font-size:6.5pt;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#64748b">Records</div>' +
          '<div style="font-size:6pt;color:#94a3b8;font-style:italic">scholar \xd7 sess</div>' +
        '</div>' +
        '<div style="padding:8pt;text-align:center;border-right:1px solid #f1f5f9">' +
          '<div style="font-family:Playfair Display,serif;font-size:18pt;font-weight:700;color:#7c3aed">'+s.sessDisr+'</div>' +
          '<div style="font-size:6.5pt;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#64748b">Sess Disrupted</div>' +
          '<div style="font-size:6pt;color:#94a3b8;font-style:italic">distinct events</div>' +
        '</div>' +
        '<div style="padding:8pt;text-align:center;border-right:1px solid #f1f5f9">' +
          '<div style="font-family:Playfair Display,serif;font-size:18pt;font-weight:700;color:#0ea5e9">'+s.avgPull+'</div>' +
          '<div style="font-size:6.5pt;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#64748b">Avg Pull Rate</div>' +
          '<div style="font-size:6pt;color:#94a3b8;font-style:italic">records \xf7 events</div>' +
        '</div>' +
        '<div style="padding:8pt;text-align:center">' +
          '<div style="font-family:Playfair Display,serif;font-size:18pt;font-weight:700;color:#475569">'+s.hrs+'</div>' +
          '<div style="font-size:6.5pt;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#64748b">Hours Lost</div>' +
          '<div style="font-size:6pt;color:#94a3b8;font-style:italic">rec \xd7 45 \xf7 60</div>' +
        '</div>' +
      '</div>' +
      // Two-column: dates + reasons
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:0;border-top:1px solid #f1f5f9">' +
        '<div style="padding:10pt;border-right:1px solid #f1f5f9">' +
          '<div style="display:flex;align-items:baseline;gap:6pt;margin-bottom:5pt">' +
            '<div style="font-size:7.5pt;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#64748b">Impacted Dates</div>' +
            '<div style="font-size:6pt;color:#94a3b8;font-style:italic">scholars pulled ≠ sessions cancelled</div>' +
          '</div>' +
          (dateList||'<div style="font-size:8pt;color:#94a3b8;font-style:italic">No dates in range</div>') +
        '</div>' +
        '<div style="padding:10pt">' +
          '<div style="font-size:7.5pt;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#64748b;margin-bottom:6pt">By Missed Reason</div>' +
          (scReasons||'<div style="font-size:8pt;color:#94a3b8;font-style:italic">—</div>') +
        '</div>' +
      '</div>' +
    '</div>';
  }).join('');

  var html = '<!DOCTYPE html><html><head><meta charset="utf-8"><meta http-equiv="X-UA-Compatible" content="IE=edge"><title>NJTC School Partner Report</title>' +
    PDF_GOOGLE_FONT + '<style>' + PDF_BASE_CSS + '</style></head><body>' +

    // Header
    '<div style="border-bottom:3px solid #10b981;padding-bottom:14pt;margin-bottom:18pt;display:flex;justify-content:space-between;align-items:flex-end">' +
      '<div>' +
        '<div style="font-size:7.5pt;font-weight:700;text-transform:uppercase;letter-spacing:.14em;color:#10b981;margin-bottom:3pt">New Jersey Tutoring Corps</div>' +
        '<div style="font-family:Playfair Display,serif;font-size:18pt;font-weight:800;color:#0f172a">' +
          'School Partner Impact Report' +
        '</div>' +
        '<div style="font-size:9pt;color:#475569;margin-top:4pt">'+esc(r.range.label)+' &nbsp;·&nbsp; '+esc(regionLabel)+'</div>' +
      '</div>' +
      '<div style="text-align:right;font-size:7.5pt;color:#94a3b8;line-height:1.7">' +
        'Prepared '+ts+'<br>'+esc(r.label||'Impact Analysis') +
      '</div>' +
    '</div>' +

    // Intro note
    '<div style="background:#ecfdf5;border-left:4px solid #10b981;padding:9pt 12pt;border-radius:0 8px 8px 0;margin-bottom:16pt;font-size:8.5pt;color:#064e3b">' +
      'This report summarizes tutoring session impact for each school site during the reporting period. ' +
      'Each card shows scholars affected, sessions missed, and the primary reasons — to support coordination and follow-up.' +
    '</div>' +

    // Summary strip
    '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8pt;margin-bottom:18pt">' +
      '<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:10pt;text-align:center">' +
        '<div style="font-family:Playfair Display,serif;font-size:22pt;font-weight:700;color:#0f172a">'+rankedSchools.length+'</div>' +
        '<div style="font-size:7pt;font-weight:700;text-transform:uppercase;color:#64748b;margin-top:3pt">Schools Affected</div>' +
      '</div>' +
      '<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:10pt;text-align:center">' +
        '<div style="font-family:Playfair Display,serif;font-size:22pt;font-weight:700;color:#e63946">'+a.scholars+'</div>' +
        '<div style="font-size:7pt;font-weight:700;text-transform:uppercase;color:#64748b;margin-top:3pt">Scholars Impacted</div>' +
      '</div>' +
      '<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:10pt;text-align:center">' +
        '<div style="font-family:Playfair Display,serif;font-size:22pt;font-weight:700;color:#7c3aed">'+a.sessionsDisrupted+'</div>' +
        '<div style="font-size:7pt;font-weight:700;text-transform:uppercase;color:#64748b;margin-top:3pt">Sessions Disrupted</div>' +
      '</div>' +
      '<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:10pt;text-align:center">' +
        '<div style="font-family:Playfair Display,serif;font-size:22pt;font-weight:700;color:#f59e0b">'+a.hours+'</div>' +
        '<div style="font-size:7pt;font-weight:700;text-transform:uppercase;color:#64748b;margin-top:3pt">Hours Lost</div>' +
      '</div>' +
    '</div>' +

    schoolCards +

    // Methodology footnote
    '<div style="border:1px solid #e2e8f0;border-radius:8px;padding:9pt 12pt;margin-bottom:12pt;font-size:7pt;color:#64748b;line-height:1.6">' +
      '<strong style="color:#0f172a;font-size:7.5pt">Methodology &amp; Definitions</strong> &nbsp;&mdash;&nbsp; ' +
      '<strong>Scholars:</strong> unique scholars with \u22651 missed-session record. &nbsp;' +
      '<strong>Records:</strong> total scholar \xd7 session pairs missed. &nbsp;' +
      '<strong>Sess Disrupted:</strong> distinct session events (school + date + title) with \u22651 scholar pulled. &nbsp;' +
      '<strong>Avg Pull Rate:</strong> records \xf7 disrupted events. &nbsp;' +
      '<strong>Hours Lost:</strong> sum of actual session minutes (per Pearl session data) \xf7 60.' +
    '</div>' +

    // Footer
    '<div style="border-top:1px solid #e2e8f0;padding-top:8pt;display:flex;justify-content:space-between;font-size:7pt;color:#94a3b8">' +
      '<span>NJTC &nbsp;·&nbsp; Pearl Operations Live Data &nbsp;·&nbsp; '+ts+'</span>' +
      '<span>Prepared by NJTC Data Team</span>' +
    '</div>' +

    '</body></html>';

  _openPrintWindow(html, 'NJTC School Partner Impact Report');
}

// ── Lens 3: Program Team Operational Report ────────────────────────────────
// Audience: NJTC program staff who need to diagnose and fix issues
// Design: Dense, operational, full detail — action-oriented, tabular
function exportPDFProgram() {
  if (!_lastReport) return;
  var r  = _lastReport;
  var a  = r.agg, pa = r.priorAgg;
  var ts = r.generatedAt.toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'});
  var regionLabel = r.region === 'NE' ? 'NE Region' : r.region === 'SW' ? 'SW Region' : 'All Regions';
  var rankedSchools = _schoolRank(a, pa);

  // Full school ranking table rows
  var schoolRows = rankedSchools.map(function(s,i) {
    var regBg  = s.region==='NE'?'#dbeafe':s.region==='SW'?'#fce7f3':'#f1f5f9';
    var regClr = s.region==='NE'?'#1e40af':s.region==='SW'?'#9d174d':'#475569';
    var topLbl = s.topR ? (TAXONOMY[s.topR]?TAXONOMY[s.topR].label:s.topR) : '—';
    var topClr = s.topR ? getColor(s.topR) : '#94a3b8';
    var dStr   = s.delta===0?'<span style="color:#94a3b8">&#8596;&nbsp;0</span>'
               : s.delta>0?'<span style="color:#dc2626">&#8593; +'+s.delta+'</span>'
               : '<span style="color:#16a34a">&#8595; '+s.delta+'</span>';
    return '<tr style="border-bottom:1px solid #f1f5f9;'+(i%2===0?'background:#fff':'background:#fafafa')+'">' +
      '<td style="padding:4pt 6pt;font-size:7.5pt;color:#94a3b8;text-align:center;font-weight:700">'+(i+1)+'</td>' +
      '<td style="padding:4pt 8pt;font-weight:600;font-size:8pt">'+esc(s.school)+'<div style="font-size:7pt;color:#94a3b8;font-weight:400">'+esc(s.district)+'</div></td>' +
      '<td style="padding:4pt 4pt;text-align:center"><span style="background:'+regBg+';color:'+regClr+';font-size:7pt;font-weight:700;padding:1pt 5pt;border-radius:20px">'+esc(s.region||'—')+'</span></td>' +
      '<td style="padding:4pt 8pt;text-align:center;font-weight:800;font-size:10pt;color:#e63946">'+s.scholars+'</td>' +
      '<td style="padding:4pt 8pt;text-align:center;font-size:8.5pt;font-weight:600">'+s.sessions+'</td>' +
      '<td style="padding:4pt 8pt;text-align:center;font-size:8.5pt">'+s.hrs+'h</td>' +
      '<td style="padding:4pt 8pt;text-align:center;font-size:8pt">'+dStr+'</td>' +
      '<td style="padding:4pt 8pt;font-size:7.5pt"><span style="background:'+topClr+'22;color:'+topClr+';padding:1pt 5pt;border-radius:4px;font-weight:600">'+esc(topLbl.length>30?topLbl.slice(0,28)+'…':topLbl)+'</span></td>' +
      '</tr>';
  }).join('');

  // Reason breakdown table
  var reasonRows = r.selectedIds
    .filter(function(id){return a.byReason[id]&&a.byReason[id].sessions>0;})
    .sort(function(a2,b2){return (a.byReason[b2]||{sessions:0}).sessions-(a.byReason[a2]||{sessions:0}).sessions;})
    .map(function(id,i) {
      var rd  = a.byReason[id] || { sessions:0, scholarCount:0, mins:0 };
      var prd = pa.byReason    && pa.byReason[id] ? pa.byReason[id] : { sessions:0, scholarCount:0 };
      var pct = a.sessions>0 ? Math.round(rd.sessions/a.sessions*100) : 0;
      var clr = getColor(id);
      var grp = TAXONOMY[id] ? (TAXONOMY[id].group==='si'?'Service Interruption':'Scholar Missed') : '';
      var dStr = rd.sessions===prd.sessions ? '<span style="color:#94a3b8">&#8596;&nbsp;0</span>'
               : rd.sessions>prd.sessions ? '<span style="color:#dc2626">&#8593; +'+(rd.sessions-prd.sessions)+'</span>'
               : '<span style="color:#16a34a">&#8595; '+(rd.sessions-prd.sessions)+'</span>';
      return '<tr style="border-bottom:1px solid #f1f5f9;'+(i%2===0?'background:#fff':'background:#fafafa')+'">' +
        '<td style="padding:4pt 8pt"><span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:'+clr+';vertical-align:middle;margin-right:6pt"></span>' +
        '<span style="font-size:8.5pt;font-weight:600">'+esc(TAXONOMY[id]?TAXONOMY[id].label:id)+'</span></td>' +
        '<td style="padding:4pt 8pt;font-size:7.5pt;color:#64748b">'+esc(grp)+'</td>' +
        '<td style="padding:4pt 8pt;text-align:center;font-weight:700;font-size:9pt">'+rd.scholarCount+'</td>' +
        '<td style="padding:4pt 8pt;text-align:center;font-size:8.5pt;font-weight:600">'+rd.sessions+'</td>' +
        '<td style="padding:4pt 8pt;text-align:center;font-size:8pt">'+(+(rd.mins/60).toFixed(1))+'h</td>' +
        '<td style="padding:4pt 8pt;text-align:center;font-size:8pt">'+pct+'%</td>' +
        '<td style="padding:4pt 8pt;text-align:center;font-size:8pt">'+dStr+'</td>' +
        '</tr>';
    }).join('');

  // Daily log
  var dailyRows = Object.keys(a.byDate)
    .sort(function(a2,b2){return new Date(a2)-new Date(b2);})
    .map(function(dk,i) {
      var dd = a.byDate[dk];
      var schoolList = Object.keys(dd.bySchool||{}).map(function(s){
        return esc(s)+' ('+(dd.bySchool[s].scholarCount||0)+')';
      }).join(', ');
      return '<tr style="border-bottom:1px solid #f1f5f9;'+(i%2===0?'background:#fff':'background:#fafafa')+'">' +
        '<td style="padding:4pt 8pt;font-size:8pt;font-weight:600">'+esc(dk)+'</td>' +
        '<td style="padding:4pt 8pt;font-size:8pt;color:#64748b">'+DAY_NAMES[(dd.date||new Date()).getDay()]+'</td>' +
        '<td style="padding:4pt 8pt;text-align:center;font-weight:700;font-size:9pt;color:#e63946">'+dd.scholarCount+'</td>' +
        '<td style="padding:4pt 8pt;text-align:center;font-size:8.5pt;font-weight:600">'+dd.sessions+'</td>' +
        '<td style="padding:4pt 8pt;font-size:7.5pt;color:#64748b">'+schoolList+'</td>' +
        '</tr>';
    }).join('');

  function sectionHeader(title, sub) {
    return '<div style="background:#0f172a;color:#fff;padding:8pt 14pt;display:flex;justify-content:space-between;align-items:center">' +
      '<span style="font-size:8pt;font-weight:700;text-transform:uppercase;letter-spacing:.1em">'+title+'</span>' +
      (sub?'<span style="font-size:7.5pt;color:rgba(255,255,255,.55)">'+sub+'</span>':'') +
    '</div>';
  }

  var html = '<!DOCTYPE html><html><head><meta charset="utf-8"><meta http-equiv="X-UA-Compatible" content="IE=edge"><title>NJTC Program Team Report</title>' +
    PDF_GOOGLE_FONT + '<style>' + PDF_BASE_CSS +
    'table { width:100%;border-collapse:collapse; }' +
    'th { background:#f8fafc;font-size:7pt;text-transform:uppercase;letter-spacing:.06em;color:#64748b;font-weight:700;padding:5pt 8pt;text-align:left;border-bottom:2px solid #e2e8f0; }' +
    '</style></head><body>' +

    // Header
    '<div style="display:flex;justify-content:space-between;align-items:flex-end;border-bottom:3px solid #e63946;padding-bottom:12pt;margin-bottom:16pt">' +
      '<div>' +
        '<div style="font-size:7.5pt;font-weight:700;text-transform:uppercase;letter-spacing:.14em;color:#e63946;margin-bottom:3pt">New Jersey Tutoring Corps &nbsp;·&nbsp; Program Team</div>' +
        '<div style="font-family:Playfair Display,serif;font-size:18pt;font-weight:800;color:#0f172a">Operational Impact Report</div>' +
        '<div style="font-size:8.5pt;color:#475569;margin-top:4pt">'+esc(r.range.label)+' &nbsp;·&nbsp; '+esc(regionLabel)+(r.districtFilter?' &nbsp;·&nbsp; '+esc(r.districtFilter):'')+(r.schoolFilter?' &nbsp;·&nbsp; '+esc(r.schoolFilter):'')+'</div>' +
      '</div>' +
      '<div style="text-align:right;font-size:7.5pt;color:#94a3b8;line-height:1.7">' +
        'Generated '+ts+'<br>'+(r.label||'Full Operational Detail') +
      '</div>' +
    '</div>' +

    // KPI row
    '<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:5pt;margin-bottom:14pt">' +
      ['Scholars Impacted|'+a.scholars+'|vs prior: '+delta(a.scholars,pa.scholars),
       'Scholar-Sess Records|'+a.sessions+'|vs prior: '+delta(a.sessions,pa.sessions),
       'Sessions Disrupted|'+a.sessionsDisrupted+'|distinct events',
       'Avg Pull Rate|'+a.avgPullRate+'|records \xf7 events',
       'Hours Lost|'+a.hours+'|vs prior: '+delta(a.hours,pa.hours),
       'Schools Affected|'+rankedSchools.length+'|',
       '8-wk Avg|'+r.avg8Scholars+' scholars|per week'].map(function(s) {
         var p=s.split('|');
         return '<div style="border:1px solid #e2e8f0;border-radius:6px;padding:7pt 10pt;text-align:center">' +
           '<div style="font-family:Playfair Display,serif;font-size:17pt;font-weight:700;color:#0f172a">'+p[1]+'</div>' +
           '<div style="font-size:6.5pt;font-weight:700;text-transform:uppercase;color:#64748b;margin-top:2pt">'+p[0]+'</div>' +
           (p[2]?'<div style="font-size:7pt;color:#94a3b8;margin-top:2pt">'+p[2]+'</div>':'') +
         '</div>';
       }).join('') +
    '</div>' +

    // Section 1: Reason breakdown
    '<div style="border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;margin-bottom:12pt;break-inside:avoid">' +
      sectionHeader('Session Loss by Missed Reason', r.selectedIds.length+' reasons analyzed') +
      '<table><thead><tr>' +
        '<th>Reason</th><th>Category</th>' +
        '<th style="text-align:center">Scholars</th><th style="text-align:center">Sessions</th>' +
        '<th style="text-align:center">Hrs Lost</th><th style="text-align:center">% Total</th>' +
        '<th style="text-align:center">vs Prior</th>' +
      '</tr></thead><tbody>'+reasonRows+'</tbody></table>' +
    '</div>' +

    // Section 2: School ranking
    '<div style="border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;margin-bottom:12pt">' +
      sectionHeader('School Impact Ranking', rankedSchools.length+' schools · sorted by scholar impact') +
      '<table><thead><tr>' +
        '<th style="text-align:center">#</th><th>School / District</th><th style="text-align:center">Region</th>' +
        '<th style="text-align:center">Scholars</th><th style="text-align:center">Sessions</th>' +
        '<th style="text-align:center">Hrs</th><th style="text-align:center">vs Prior</th>' +
        '<th>Top Reason</th>' +
      '</tr></thead><tbody>'+schoolRows+'</tbody></table>' +
    '</div>' +

    // Section 3: Daily log
    '<div style="border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;margin-bottom:12pt;break-inside:avoid" class="page-break">' +
      sectionHeader('Daily Impact Log', 'All impact dates in reporting period') +
      '<table><thead><tr>' +
        '<th>Date</th><th>Day</th>' +
        '<th style="text-align:center">Scholars</th><th style="text-align:center">Sessions</th>' +
        '<th>Schools (scholars)</th>' +
      '</tr></thead><tbody>'+dailyRows+'</tbody></table>' +
    '</div>' +

    // Methodology footnote
    '<div style="border:1px solid #e2e8f0;border-radius:8px;padding:9pt 12pt;margin-bottom:12pt;font-size:7pt;color:#64748b;line-height:1.6">' +
      '<strong style="color:#0f172a;font-size:7.5pt">Methodology &amp; Definitions</strong> &nbsp;&mdash;&nbsp; ' +
      '<strong>Scholars Impacted:</strong> unique scholars with \u22651 missed-session record. &nbsp;' +
      '<strong>Scholar-Session Records:</strong> total scholar \xd7 session pairs (1 scholar missing 2 sessions = 2 records). &nbsp;' +
      '<strong>Sessions Disrupted:</strong> distinct session events (school + date + session title) that had \u22651 scholar pulled. &nbsp;' +
      '<strong>Avg Pull Rate:</strong> records \xf7 sessions disrupted. &nbsp;' +
      '<strong>Hours Lost:</strong> sum of actual session minutes (per Pearl session data) \xf7 60. &nbsp;' +
      'Data sourced live from Pearl Operations attendance sheet.' +
    '</div>' +

    // Footer
    '<div style="border-top:1px solid #e2e8f0;padding-top:8pt;display:flex;justify-content:space-between;font-size:7pt;color:#94a3b8">' +
      '<span>NJTC Program Team &nbsp;·&nbsp; Pearl Operations Live Data &nbsp;·&nbsp; '+ts+'</span>' +
      '<span>For Internal Use — Data Dept</span>' +
    '</div>' +

    '</body></html>';

  _openPrintWindow(html, 'NJTC Program Team Operational Report');
}

// Legacy alias
function printView() { exportPDF(); }

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
  exportPDFSchool:    exportPDFSchool,
  exportPDFProgram:   exportPDFProgram,
  _sortRanking:       _sortRanking,
  _rankPage:          _rankPage,
};

})();
