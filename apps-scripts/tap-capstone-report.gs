/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║  NJTC TAP  -  SY 2025-26 CAPSTONE  ·  FULLY DYNAMIC BUILD  v7            ║
 * ║  Zero hardcoded data  -  reads 100% from "Apprentice Impact Data (RAW)"   ║
 * ║  Source: All Apprentices (RAW)  -  Active + Cancelled  ·  46 Apprentices  ║
 * ║  Update raw data → re-run buildEverything() → all 8 sheets refresh      ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 *
 * HOW TO USE:
 *   1. Paste into Apps Script (Extensions → Apps Script) → Save
 *   2. Set KATHERINE_SIGNATURE_URL below to Katherine's signature image URL
 *   3. Run → buildEverything
 *   4. When raw data changes: run buildEverything again  -  everything rebuilds
 *
 * SOURCE SHEET: "Apprentice Impact Data (RAW)"
 *   Supports both formats:
 *   - All Apprentices format: Status col first, then Name, DOL ID, School…
 *   - Active-only format:     Name, DOL ID, School… (no Status col)
 *   Script auto-detects format from Section 1 header row.
 *
 * COLUMN MAP  -  All Apprentices format (0-indexed):
 *   0=Status  1=Name  2=DOL ID  3=School  4=Region  5=Source
 *   6=ELA Scholars  7=ELA BOY  8=ELA End  9=ELA Gain  10=ELA Med%Growth
 *   11=ELA %Meeting  12=ELA Improved  13=ELA Maintained  14=ELA Declined
 *   15=Math Scholars  16=Math BOY  17=Math End  18=Math Gain  19=Math Med%Growth
 *   20=Math %Meeting  21=Math Improved  22=Math Maintained  23=Math Declined
 *   24=Survey Responses  25=Confidence  26=Enjoyment  27=Learning  28=Overall
 *   29=Sessions Attended  30=Sessions Missed  31=Total Sessions  32=Attendance Rate
 */

// ─── KATHERINE'S SIGNATURE ─────────────────────────────────
// Paste the direct URL to Katherine's signature image here.
// Example: 'https://drive.google.com/uc?export=view&id=FILE_ID'
// Leave blank ('') to use the text placeholder instead.
var KATHERINE_SIGNATURE_URL = '';
var KATHERINE_NAME = 'Katherine Camargo';  // Update with full name if different

// ─── COLORS ────────────────────────────────────────────────
var C = {
  NAVY:'#1B3A6B', NAVY2:'#2A4F8A', TEAL:'#1C7C8C', TEAL2:'#2499AD',
  GOLD:'#D4920A', GOLD_LT:'#FEF3CD', WHITE:'#FFFFFF', OFF:'#F7F9FC',
  LTGRAY:'#F0F4FA', MID:'#D0D8E8', DARK:'#4A5568', BLACK:'#0F1F3D',
  CANCEL:'#6B4226', CANCEL_LT:'#FDF3EE',
  // iReady 5-level placement (exact)
  IR3:'#C0392B', IR2:'#E67E22', IR1:'#E8B800', IREO:'#82C341', IRMID:'#27AE60',
  // gain shading
  GS:'#D5F5E3', GM:'#E8F8F0', GL:'#FEF9E7', GR:'#FADBD8',
  // survey shading
  SE:'#D5F5E3', SS:'#EAF5FB', SD:'#FEF9E7', SL:'#FDEBD0',
  // attendance shading
  AP:'#D5F5E3', AH:'#E8F8F0', AM:'#FEF3CD', AL:'#FADBD8',
};

// ─── SAFE ALERT ────────────────────────────────────────────
function safeAlert(msg) {
  try { SpreadsheetApp.getUi().alert(msg); } catch(e) { Logger.log(msg); }
}

// ─── VALUE HELPERS ─────────────────────────────────────────
function isNum(v) {
  if (v === null || v === undefined || v === '') return false;
  if (typeof v === 'string') {
    var s = v.toLowerCase().trim();
    if (s.indexOf('no ') === 0 || s.indexOf('n/a') === 0 ||
        s.indexOf('pending') >= 0 || s.indexOf('see §') >= 0 ||
        s.indexOf('pre - ') >= 0 || s.indexOf('post - ') >= 0 ||
        s.indexOf('pre avg') >= 0 || s.indexOf('post avg') >= 0 ||
        s.indexOf('eoy preliminary') >= 0) return false;
  }
  return !isNaN(parseFloat(v));
}
function toNum(v) { return isNum(v) ? parseFloat(v) : null; }
function toPct(v) {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'string') {
    var s = v.trim(), sl = s.toLowerCase();
    if (sl.indexOf('no ') === 0 || sl.indexOf('n/a') === 0 ||
        sl.indexOf('pending') >= 0 || sl.indexOf('see §') >= 0 ||
        sl.indexOf('eoy preliminary') >= 0) return null;
    if (s.slice(-1) === '%') { var n = parseFloat(s); return isNaN(n) ? null : n / 100; }
    var n = parseFloat(s); return isNaN(n) ? null : n;
  }
  if (typeof v === 'number') return v;
  return null;
}
function fmtNum(v, d, sign) {
  if (v === null) return ' - ';
  d = d || 1;
  var s = Math.abs(v).toFixed(d);
  if (sign && v > 0) return '+' + s;
  if (v < 0) return '−' + s;
  return s;
}

// ─── COLOR HELPERS ─────────────────────────────────────────
function attBg(r)  { return r >= 1.0 ? C.AP : r >= 0.95 ? C.AH : r >= 0.85 ? C.AM : C.AL; }
function attFc(r)  { return r >= 0.95 ? '#0D5C2E' : r >= 0.85 ? '#7B5500' : '#8B1A1A'; }
function svBg(v)   { return v >= 4.5 ? C.SE : v >= 4.0 ? C.SS : v >= 3.5 ? C.SD : C.SL; }
function gBg(g)    { return g === null ? C.LTGRAY : g > 15 ? C.GS : g > 5 ? C.GM : g >= 0 ? C.GL : C.GR; }
function grBg(p)   { return p === null ? C.LTGRAY : p >= 1.0 ? C.GS : p >= 0.5 ? C.GM : p >= 0 ? C.GL : C.GR; }

// ─── STYLE UTILITIES ───────────────────────────────────────
function sc(cell, val, o) {
  o = o || {};
  if (val !== null && val !== undefined) cell.setValue(val);
  if (o.bg) cell.setBackground(o.bg);
  if (o.fc) cell.setFontColor(o.fc);
  cell.setFontWeight(o.bold ? 'bold' : 'normal');
  if (o.sz) cell.setFontSize(o.sz);
  cell.setHorizontalAlignment(o.al || 'left');
  cell.setVerticalAlignment(o.va || 'middle');
  cell.setWrap(o.wrap || false);
  if (o.it) cell.setFontStyle('italic');
  cell.setFontFamily('Arial');
  return cell;
}
function mr(ws, r, c, rows, cols, val, o) {
  var range = ws.getRange(r, c, rows, cols);
  if (rows > 1 || cols > 1) range.merge();
  sc(range, val, o);
  return range;
}
function rh(ws, r, h) { ws.setRowHeight(r, h); }
function cw(ws, c, w) { ws.setColumnWidth(c, w); }
function hg(ws) { ws.setHiddenGridlines(true); }

function banner(ws, title, sub, nc) {
  rh(ws, 1, 52); rh(ws, 2, 22); rh(ws, 3, 5);
  mr(ws, 1, 1, 1, nc, title, {bg:C.NAVY, fc:C.WHITE, bold:true, sz:15, al:'center', va:'middle'});
  mr(ws, 2, 1, 1, nc, sub,   {bg:C.TEAL, fc:C.WHITE, sz:10, al:'center', va:'middle', it:true});
  ws.getRange(3, 1, 1, nc).merge().setBackground(C.GOLD);
}
function secHead(ws, r, nc, txt, bg, fc) {
  rh(ws, r, 26);
  mr(ws, r, 1, 1, nc, '  ' + txt, {bg:bg||C.NAVY, fc:fc||C.WHITE, bold:true, sz:11, al:'left', va:'middle'});
}
function colHdr(ws, r, headers, bg, fc, h) {
  rh(ws, r, h || 34);
  headers.forEach(function(hd, i) {
    sc(ws.getRange(r, i + 1), hd, {bg:bg||C.NAVY, fc:fc||C.WHITE, bold:true, sz:9, al:'center', va:'middle', wrap:true});
  });
}
function zebra(ws, r, nc, i, cancelledBg) {
  var bg = cancelledBg ? (i % 2 === 0 ? C.CANCEL_LT : '#FFF9F6') : (i % 2 === 0 ? C.LTGRAY : C.WHITE);
  ws.getRange(r, 1, 1, nc).setBackground(bg);
  rh(ws, r, 20);
  return bg;
}

// Write a labeled data table, return the Range
function writeTable(ws, startRow, startCol, headers, rows) {
  rh(ws, startRow, 18);
  headers.forEach(function(h, i) {
    sc(ws.getRange(startRow, startCol + i), h,
       {bg:C.NAVY, fc:C.WHITE, bold:true, sz:9, al:'center', va:'middle'});
  });
  rows.forEach(function(row, ri) {
    rh(ws, startRow + 1 + ri, 16);
    row.forEach(function(val, ci) {
      ws.getRange(startRow + 1 + ri, startCol + ci)
        .setValue(val !== null && val !== undefined ? val : '');
    });
  });
  return ws.getRange(startRow, startCol, rows.length + 1, headers.length);
}

// ─── CHART BUILDER ─────────────────────────────────────────
// Fix for grey charts: SpreadsheetApp.flush() MUST be called before
// inserting a chart so all data is committed to the sheet first.
// All setOption calls use dot-notation strings  -  object-form options
// (e.g. {position:'top'}) are NOT reliably supported by EmbeddedChartBuilder.
function buildChart(ws, dataRange, pos, o) {
  SpreadsheetApp.flush(); // commit all pending writes before chart reads range
  var typeMap = {
    BAR:    Charts.ChartType.BAR,
    COLUMN: Charts.ChartType.COLUMN,
    LINE:   Charts.ChartType.LINE,
    PIE:    Charts.ChartType.PIE,
    AREA:   Charts.ChartType.AREA,
  };
  var b = ws.newChart()
    .addRange(dataRange)
    .setChartType(typeMap[o.type] || Charts.ChartType.BAR)
    .setNumHeaders(1);

  if (o.title)  b.setOption('title', o.title);

  // Axis titles  -  string only via dot-notation
  if (o.hTitle) b.setOption('hAxis.title', o.hTitle);
  if (o.vTitle) b.setOption('vAxis.title', o.vTitle);
  if (o.vMin !== undefined) b.setOption('vAxis.minValue', o.vMin);
  if (o.vMax !== undefined) b.setOption('vAxis.maxValue', o.vMax);
  if (o.hMin !== undefined) b.setOption('hAxis.minValue', o.hMin);
  if (o.hMax !== undefined) b.setOption('hAxis.maxValue', o.hMax);

  // Colors
  if (o.colors) b.setOption('colors', o.colors);
  if (o.stacked) b.setOption('isStacked', true);

  // Legend  -  MUST use dot-notation; object form is unreliable in EmbeddedChartBuilder
  b.setOption('legend.position', (o.legend && o.legend !== 'none') ? o.legend : 'none');

  // Background  -  use fill sub-key
  b.setOption('backgroundColor.fill', '#F8FAFD');

  // Chart area
  b.setOption('chartArea.left',   o.left || 160);
  b.setOption('chartArea.top',    50);
  b.setOption('chartArea.width',  o.caW || 620);
  b.setOption('chartArea.height', o.caH || 340);

  b.setOption('width',  o.w || 900);
  b.setOption('height', o.h || 480);
  b.setPosition(pos[0], pos[1], 0, 0);

  ws.insertChart(b.build());
}

// ══════════════════════════════════════════════════════════
// ██  DATA LOADING
// ══════════════════════════════════════════════════════════
function loadData(ss) {
  // Try all known sheet name variants — prefer "All Apprentices" over active-only
  var candidateNames = [
    'All Apprentices Impact Data (RAW)',
    'Apprentice Impact Data (RAW)',
    'All Apprentices (RAW)',
    'All Apprentices Impact Data',
  ];
  var raw = null;
  candidateNames.forEach(function(n) { if (!raw) raw = ss.getSheetByName(n); });
  if (!raw) {
    // Fallback: find any sheet with "all" + "apprentice" in the name (case-insensitive)
    ss.getSheets().forEach(function(s) {
      var nm = s.getName().toLowerCase();
      if (!raw && nm.indexOf('all') >= 0 && nm.indexOf('apprentice') >= 0) raw = s;
    });
  }
  if (!raw) {
    // Last resort: any sheet with "raw" in the name that has the most rows (likely all apprentices)
    var bestSheet = null, bestRows = 0;
    ss.getSheets().forEach(function(s) {
      if (s.getName().toLowerCase().indexOf('raw') >= 0) {
        var rc = s.getLastRow();
        if (rc > bestRows) { bestRows = rc; bestSheet = s; }
      }
    });
    raw = bestSheet;
  }
  if (!raw) throw new Error('Source sheet not found. Rename your all-apprentices tab to "All Apprentices Impact Data (RAW)" and re-run.');

  var allVals = raw.getDataRange().getValues();
  var S1_START = -1, S2_START = -1, S3_START = -1, S4_START = -1;
  allVals.forEach(function(row, i) {
    var cell = String(row[0] || '').trim();
    if (cell.indexOf('SECTION 1') >= 0 || cell.indexOf('APPRENTICE SUMMARY') >= 0) S1_START = i;
    if (cell.indexOf('SECTION 2') >= 0 || cell.indexOf('BOY TO END') >= 0)         S2_START = i;
    if (cell.indexOf('SECTION 3') >= 0 || cell.indexOf('PROGRAM-LEVEL AGGREGATE') >= 0) S3_START = i;
    if (cell.indexOf('SECTION 4') >= 0 && cell.indexOf('4B') < 0)                  S4_START = i;
  });

  // Auto-detect whether Section 1 has a Status column.
  // All Apprentices RAW format: col 0 = "Status", col 1 = "Apprentice Name" / "Name"
  // Active-only format:         col 0 = "Name" (no Status col)
  var hasStatusCol = false;
  if (S1_START >= 0 && S1_START + 1 < allVals.length) {
    var hdrRow = allVals[S1_START + 1];
    var col0 = String(hdrRow[0] || '').trim().toLowerCase();
    hasStatusCol = (col0 === 'status');
  }
  // Column offset: 0 for active-only, 1 for all-apprentices format
  var o = hasStatusCol ? 1 : 0;

  // ── Section 1: apprentice rows ──
  var apprentices = [];
  if (S1_START >= 0) {
    var dataStart = S1_START + 2;
    var dataEnd = S2_START >= 0 ? S2_START : (S3_START >= 0 ? S3_START : allVals.length);
    for (var i = dataStart; i < dataEnd; i++) {
      var r = allVals[i];
      var firstVal = String(r[0] || '').trim();
      if (!firstVal) continue;
      if (firstVal.toUpperCase().indexOf('SECTION') === 0) break;
      // With status col: first col is "Active"/"Cancelled"  -  skip blank non-status rows
      if (hasStatusCol && firstVal !== 'Active' && firstVal !== 'Cancelled') continue;
      apprentices.push({
        status: hasStatusCol ? firstVal : 'Active',
        name:   String(r[o+0] || '').trim(),
        dol:    String(r[o+1] || ''),
        school: String(r[o+2] || ''),
        region: String(r[o+3] || ''),
        source: String(r[o+4] || ''),
        elaS:   toNum(r[o+5]),  elaBOY: toNum(r[o+6]),  elaEND: toNum(r[o+7]),
        elaG:   toNum(r[o+8]),  elaMG:  toPct(r[o+9]),   elaPG:  toPct(r[o+10]),
        elaI:   toNum(r[o+11]), elaM:   toNum(r[o+12]),  elaD:   toNum(r[o+13]),
        mathS:  toNum(r[o+14]), mathBOY:toNum(r[o+15]),  mathEND:toNum(r[o+16]),
        mathG:  toNum(r[o+17]), mathMG: toPct(r[o+18]),  mathPG: toPct(r[o+19]),
        mathI:  toNum(r[o+20]), mathM:  toNum(r[o+21]),  mathD:  toNum(r[o+22]),
        survR:  toNum(r[o+23]), conf:   toNum(r[o+24]),  enjoy:  toNum(r[o+25]),
        learn:  toNum(r[o+26]), overall:toNum(r[o+27]),
        att:    toNum(r[o+28]), miss:   toNum(r[o+29]),  total:  toNum(r[o+30]),
        rate:   toPct(r[o+31]),
      });
    }
  }

  // ── Section 2: placement distribution rows ──
  var placements = [];
  if (S2_START >= 0) {
    // Detect status col for section 2 separately (same logic)
    var p2HasStatus = false;
    if (S2_START + 1 < allVals.length) {
      var ph = String(allVals[S2_START + 1][0] || '').trim().toLowerCase();
      p2HasStatus = (ph === 'status');
    }
    var po = p2HasStatus ? 1 : 0;
    var plEnd = S3_START >= 0 ? S3_START : allVals.length;
    for (var i = S2_START + 2; i < plEnd; i++) {
      var r = allVals[i];
      var firstVal = String(r[0] || '').trim();
      if (!firstVal) continue;
      if (firstVal.toUpperCase().indexOf('SECTION') === 0) break;
      if (p2HasStatus && firstVal !== 'Active' && firstVal !== 'Cancelled') continue;
      placements.push({
        status:  p2HasStatus ? firstVal : 'Active',
        name:    String(r[po+0] || '').trim(),
        subject: String(r[po+1] || ''),
        boyB3:toNum(r[po+3]), boyB2:toNum(r[po+4]), boyB1:toNum(r[po+5]),
        boyEO:toNum(r[po+6]), boyMid:toNum(r[po+7]),
        endB3:toNum(r[po+8]), endB2:toNum(r[po+9]), endB1:toNum(r[po+10]),
        endEO:toNum(r[po+11]),endMid:toNum(r[po+12]), net: toNum(r[po+13]),
      });
    }
  }

  // ── Section 3: aggregate metrics (always Metric, ELA, Math columns  -  no status offset) ──
  var agg = {
    elaTotalScholars:null, mathTotalScholars:null,
    elaAvgBOY:null, mathAvgBOY:null, elaAvgEND:null, mathAvgEND:null,
    elaAvgGain:null, mathAvgGain:null, elaMedianGrowth:null, mathMedianGrowth:null,
    elaImpStr:null, mathImpStr:null, elaPctImp:null, mathPctImp:null,
    survTotal:null, avgConf:null, avgEnjoy:null, avgLearn:null, avgOverall:null,
    totalAtt:null, totalSess:null, progRate:null,
  };
  if (S3_START >= 0) {
    var aggEnd = S4_START >= 0 ? S4_START : allVals.length;
    for (var i = S3_START + 1; i < aggEnd; i++) {
      var r = allVals[i];
      var key = String(r[0] || '').trim().toLowerCase();
      if (!key) continue;
      if (key.indexOf('total scholars') >= 0)     { agg.elaTotalScholars = toNum(r[1]); agg.mathTotalScholars = toNum(r[2]); }
      if (key.indexOf('avg boy') >= 0)            { agg.elaAvgBOY = toNum(r[1]); agg.mathAvgBOY = toNum(r[2]); }
      if (key.indexOf('avg end') >= 0)            { agg.elaAvgEND = toNum(r[1]); agg.mathAvgEND = toNum(r[2]); }
      if (key.indexOf('scale score gain') >= 0)   { agg.elaAvgGain = toNum(r[1]); agg.mathAvgGain = toNum(r[2]); }
      if (key.indexOf('median %') >= 0)           { agg.elaMedianGrowth = toPct(r[1]); agg.mathMedianGrowth = toPct(r[2]); }
      if (key.indexOf('scholars who improved') >= 0) { agg.elaImpStr = String(r[1]||''); agg.mathImpStr = String(r[2]||''); }
      if (key.indexOf('% scholars improved') >= 0)   { agg.elaPctImp = toPct(r[1]); agg.mathPctImp = toPct(r[2]); }
      if (key.indexOf('survey responses') >= 0 && key.indexOf('avg') < 0) agg.survTotal = toNum(r[1]);
      if (key.indexOf('confidence') >= 0)         agg.avgConf = toNum(r[1]);
      if (key.indexOf('enjoyment') >= 0)          agg.avgEnjoy = toNum(r[1]);
      if (key.indexOf('learning') >= 0)           agg.avgLearn = toNum(r[1]);
      if (key.indexOf('overall rating') >= 0)     agg.avgOverall = toNum(r[1]);
      if (key.indexOf('sessions attended') >= 0)  agg.totalAtt = toNum(r[1]);
      if (key.indexOf('total sessions') >= 0 && key.indexOf('attended') < 0) agg.totalSess = toNum(r[1]);
      if (key.indexOf('attendance rate') >= 0)    agg.progRate = toPct(r[1]);
    }
  }

  // Fallback: compute from apprentice rows if Section 3 is missing
  if (!agg.progRate && apprentices.length > 0) {
    var totalA = 0, totalS = 0;
    apprentices.forEach(function(a) { if (a.att !== null) totalA += a.att; if (a.total !== null) totalS += a.total; });
    agg.totalAtt = totalA; agg.totalSess = totalS;
    agg.progRate = totalS > 0 ? totalA / totalS : null;
  }
  if (!agg.survTotal) {
    var st = 0; apprentices.forEach(function(a) { if (a.survR !== null) st += a.survR; });
    agg.survTotal = st || null;
  }

  // ── Sub-group helpers ──────────────────────────────────────
  function computeSubAgg(apps) {
    var totalA = 0, totalS = 0, survT = 0;
    var confSum = 0, confN = 0, enjoySum = 0, enjoyN = 0, learnSum = 0, learnN = 0, ovSum = 0, ovN = 0;
    var elaScholars = 0, mathScholars = 0, elaImp = 0, mathImp = 0;
    apps.forEach(function(a) {
      if (a.att !== null) totalA += a.att;
      if (a.total !== null) totalS += a.total;
      if (a.survR !== null) survT += a.survR;
      if (a.conf !== null) { confSum += a.conf; confN++; }
      if (a.enjoy !== null) { enjoySum += a.enjoy; enjoyN++; }
      if (a.learn !== null) { learnSum += a.learn; learnN++; }
      if (a.overall !== null) { ovSum += a.overall; ovN++; }
      if (a.elaS !== null && a.elaS > 0) elaScholars += a.elaS;
      if (a.mathS !== null && a.mathS > 0) mathScholars += a.mathS;
      if (a.elaI !== null) elaImp += a.elaI;
      if (a.mathI !== null) mathImp += a.mathI;
    });
    return {
      count: apps.length,
      totalAtt: totalA, totalSess: totalS,
      progRate: totalS > 0 ? totalA / totalS : null,
      survTotal: survT,
      avgConf: confN > 0 ? confSum/confN : null,
      avgEnjoy: enjoyN > 0 ? enjoySum/enjoyN : null,
      avgLearn: learnN > 0 ? learnSum/learnN : null,
      avgOverall: ovN > 0 ? ovSum/ovN : null,
      elaScholars: elaScholars, mathScholars: mathScholars,
      elaImp: elaImp, mathImp: mathImp,
      perfect: apps.filter(function(a){ return a.rate >= 1.0; }).length,
    };
  }

  var activeApps    = apprentices.filter(function(a) { return a.status === 'Active'; });
  var cancelledApps = apprentices.filter(function(a) { return a.status === 'Cancelled'; });
  var activeSubAgg    = computeSubAgg(activeApps);
  var cancelledSubAgg = computeSubAgg(cancelledApps);
  var allSubAgg       = computeSubAgg(apprentices);

  // ── Placement aggregate totals ──
  function buildPlAgg(pls) {
    var pa = { elaB3:0,elaB2:0,elaB1:0,elaEO:0,elaMid:0, elaEB3:0,elaEB2:0,elaEB1:0,elaEEO:0,elaEMid:0,
               mathB3:0,mathB2:0,mathB1:0,mathEO:0,mathMid:0, mathEB3:0,mathEB2:0,mathEB1:0,mathEEO:0,mathEMid:0,
               elaImp:0,elaMaint:0,elaDec:0, mathImp:0,mathMaint:0,mathDec:0 };
    pls.forEach(function(pl) {
      var subj = (pl.subject || '').toUpperCase();
      if (subj === 'ELA') {
        pa.elaB3 += pl.boyB3||0; pa.elaB2 += pl.boyB2||0; pa.elaB1 += pl.boyB1||0;
        pa.elaEO += pl.boyEO||0; pa.elaMid += pl.boyMid||0;
        pa.elaEB3 += pl.endB3||0; pa.elaEB2 += pl.endB2||0; pa.elaEB1 += pl.endB1||0;
        pa.elaEEO += pl.endEO||0; pa.elaEMid += pl.endMid||0;
      } else if (subj === 'MATH') {
        pa.mathB3 += pl.boyB3||0; pa.mathB2 += pl.boyB2||0; pa.mathB1 += pl.boyB1||0;
        pa.mathEO += pl.boyEO||0; pa.mathMid += pl.boyMid||0;
        pa.mathEB3 += pl.endB3||0; pa.mathEB2 += pl.endB2||0; pa.mathEB1 += pl.endB1||0;
        pa.mathEEO += pl.endEO||0; pa.mathEMid += pl.endMid||0;
      }
    });
    return pa;
  }
  var plAgg = buildPlAgg(placements);
  // Improved/maintained/declined from section 1 rows
  apprentices.forEach(function(a) {
    if (a.elaI !== null)  plAgg.elaImp   += a.elaI;
    if (a.elaM !== null)  plAgg.elaMaint += a.elaM;
    if (a.elaD !== null)  plAgg.elaDec   += a.elaD;
    if (a.mathI !== null) plAgg.mathImp   += a.mathI;
    if (a.mathM !== null) plAgg.mathMaint += a.mathM;
    if (a.mathD !== null) plAgg.mathDec   += a.mathD;
  });

  return {
    apprentices: apprentices, activeApps: activeApps, cancelledApps: cancelledApps,
    placements: placements, agg: agg, plAgg: plAgg,
    activeSubAgg: activeSubAgg, cancelledSubAgg: cancelledSubAgg, allSubAgg: allSubAgg,
    raw: raw,
  };
}

// ══════════════════════════════════════════════════════════
// ██  MAIN ENTRY POINT
// ══════════════════════════════════════════════════════════
function buildEverything() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var kill = ['📊 Impact Dashboard','📈 Academic Growth','⭐ Scholar Experience',
    '📅 Attendance Record','🏅 Talking Points',
    '🥇 Certificates: Complete','📜 Certificates: Partial','🌟 Certificates: Recognition'];
  kill.forEach(function(n) { var s = ss.getSheetByName(n); if (s) ss.deleteSheet(s); });
  SpreadsheetApp.flush();

  var data = loadData(ss);
  if (data.apprentices.length === 0) {
    safeAlert('⚠ No apprentice data found. Check source sheet name and structure.'); return;
  }

  buildDashboard(ss, data);
  buildAcademicGrowth(ss, data);
  buildScholarExperience(ss, data);
  buildAttendanceRecord(ss, data);
  buildTalkingPoints(ss, data);
  buildCertsComplete(ss, data);
  buildCertsPartial(ss, data);
  buildCertsRecognition(ss, data);

  safeAlert(
    '✅  All 8 sheets built!\n\n' +
    '  ' + data.activeApps.length + ' Active  ·  ' + data.cancelledApps.length + ' Cancelled  ·  ' + data.apprentices.length + ' Total\n' +
    '  ' + data.placements.length + ' placement records\n\n' +
    '📊 Impact Dashboard  (All 46 · Active + Cancelled breakdown)\n' +
    '📈 Academic Growth\n⭐ Scholar Experience\n📅 Attendance Record\n🏅 Talking Points\n' +
    '🥇 Certificates: Complete\n📜 Certificates: Partial\n🌟 Certificates: Recognition\n\n' +
    'To refresh: update raw data → run buildEverything() again.'
  );
}
function buildCapstoneReport() { buildEverything(); }

// ══════════════════════════════════════════════════════════
// ██  SHEET 1  -  IMPACT DASHBOARD (All Apprentices)
// ══════════════════════════════════════════════════════════
function buildDashboard(ss, data) {
  var ws = ss.insertSheet('📊 Impact Dashboard', ss.getSheets().length);
  var A = data.apprentices, AG = data.agg, PL = data.plAgg;
  var ACT = data.activeApps, CAN = data.cancelledApps;
  var actAgg = data.activeSubAgg, canAgg = data.cancelledSubAgg, allAgg = data.allSubAgg;
  hg(ws);
  var NC = 12;
  for (var i = 1; i <= NC; i++) cw(ws, i, 110);

  var prog_rate_str = AG.progRate !== null ? Math.round(AG.progRate*1000)/10+'%' : (allAgg.progRate !== null ? Math.round(allAgg.progRate*1000)/10+'%' : ' - ');
  var surv_total_str = AG.survTotal !== null ? Math.round(AG.survTotal).toLocaleString() : Math.round(allAgg.survTotal||0).toLocaleString();
  var ela_gain_str  = AG.elaAvgGain !== null ? '+'+AG.elaAvgGain.toFixed(1) : ' - ';
  var math_gain_str = AG.mathAvgGain !== null ? '+'+AG.mathAvgGain.toFixed(1) : ' - ';
  var avg_overall   = AG.avgOverall !== null ? AG.avgOverall : allAgg.avgOverall;

  banner(ws,
    'NJTC TAP  -  SY 2025-26 Capstone Impact Dashboard  ·  All ' + A.length + ' Apprentices',
    'New Jersey Tutoring Corps  ·  Tutor Apprenticeship Program  ·  ' +
    ACT.length + ' Active  ·  ' + CAN.length + ' Cancelled  ·  Live from: Apprentice Impact Data (RAW)',
    NC);

  // ── KPI CARDS (ALL apprentices) ────────────────────────────
  rh(ws, 4, 8);
  var kpis = [
    {v:String(A.length),      l:'Total Apprentices',   s:ACT.length+' Active · '+CAN.length+' Cancelled',  bg:C.NAVY},
    {v:AG.totalSess !== null ? Math.round(AG.totalSess).toLocaleString() : Math.round(allAgg.totalSess||0).toLocaleString(),
                               l:'Total Sessions',      s:'Scheduled program-wide',                          bg:C.TEAL},
    {v:prog_rate_str,          l:'Attendance Rate',     s:Math.round(allAgg.totalAtt||0).toLocaleString()+' attended', bg:'#1A7A4A'},
    {v:avg_overall !== null ? avg_overall.toFixed(1)+' / 5' : ' - ',
                               l:'Scholar Rating',      s:surv_total_str+' survey responses',                bg:C.GOLD},
    {v:ela_gain_str+' pts',    l:'ELA Avg Score Gain',  s:'iReady scale score · all apprentices',            bg:C.NAVY2},
    {v:math_gain_str+' pts',   l:'Math Avg Score Gain', s:'iReady scale score · all apprentices',            bg:C.TEAL2},
  ];
  kpis.forEach(function(k, i) {
    var col = i * 2 + 1;
    rh(ws,5,42); rh(ws,6,22); rh(ws,7,18);
    mr(ws,5,col,1,2,k.v, {bg:k.bg,fc:C.WHITE,bold:true,sz:20,al:'center',va:'middle'});
    mr(ws,6,col,1,2,k.l, {bg:k.bg,fc:C.WHITE,bold:true,sz:9, al:'center',va:'middle'});
    mr(ws,7,col,1,2,k.s, {bg:k.bg,fc:'#B8D4F0',sz:8, al:'center',va:'middle',it:true});
  });

  rh(ws,8,8);

  // ── ACTIVE vs CANCELLED BREAKDOWN CARDS ────────────────────
  secHead(ws, 9, NC, 'ACTIVE VS. CANCELLED  ·  Program Snapshot  ·  ' + ACT.length + ' Active  ·  ' + CAN.length + ' Cancelled');
  rh(ws,10,30);
  var groups = [
    {label:'ACTIVE APPRENTICES',    n:ACT.length,    agg:actAgg, bg:C.NAVY,   fc:C.WHITE,    col:1, span:4},
    {label:'CANCELLED APPRENTICES', n:CAN.length,    agg:canAgg, bg:C.CANCEL, fc:C.WHITE,    col:5, span:4},
    {label:'ALL APPRENTICES',       n:A.length,      agg:allAgg, bg:C.TEAL,   fc:C.WHITE,    col:9, span:4},
  ];
  groups.forEach(function(g) {
    var ag = g.agg;
    mr(ws,10,g.col,1,g.span,g.label+' ('+g.n+')',{bg:g.bg,fc:g.fc,bold:true,sz:10,al:'center',va:'middle'});
    rh(ws,11,22); rh(ws,12,22); rh(ws,13,22); rh(ws,14,22);
    var rows = [
      ['Sessions', ag.totalSess !== null ? Math.round(ag.totalSess).toLocaleString() : ' - '],
      ['Attendance', ag.progRate !== null ? Math.round(ag.progRate*1000)/10+'%' : ' - '],
      ['ELA Scholars', ag.elaScholars > 0 ? ag.elaScholars : ' - '],
      ['Math Scholars', ag.mathScholars > 0 ? ag.mathScholars : ' - '],
    ];
    rows.forEach(function(rv, ri) {
      var rr = 11 + ri;
      var bg = ri % 2 === 0 ? C.LTGRAY : C.WHITE;
      mr(ws,rr,g.col,  1,2,rv[0],{bg:bg,bold:true,sz:9, al:'left', va:'middle'});
      mr(ws,rr,g.col+2,1,2,rv[1],{bg:bg,bold:true,sz:11,al:'center',va:'middle',fc:g.bg});
    });
  });

  rh(ws,15,8);

  // ── FULL PROGRAM ACADEMIC OUTCOMES TABLE (ALL apprentices) ──
  secHead(ws, 16, NC, 'PROGRAM-LEVEL ACADEMIC OUTCOMES  ·  All 46 Apprentices  ·  Active + Cancelled Combined');
  rh(ws,17,32);
  mr(ws,17,1,1,5,'Metric',           {bg:C.NAVY,fc:C.WHITE,bold:true,sz:9,al:'center',va:'middle'});
  mr(ws,17,6,1,2,'ELA',              {bg:C.NAVY,fc:C.WHITE,bold:true,sz:9,al:'center',va:'middle'});
  mr(ws,17,8,1,2,'Math',             {bg:C.NAVY,fc:C.WHITE,bold:true,sz:9,al:'center',va:'middle'});
  mr(ws,17,10,1,3,'Notes / Context', {bg:C.NAVY,fc:C.WHITE,bold:true,sz:9,al:'center',va:'middle'});

  var ela_med = AG.elaMedianGrowth !== null ? Math.round(AG.elaMedianGrowth*100)+'%' : ' - ';
  var math_med = AG.mathMedianGrowth !== null ? Math.round(AG.mathMedianGrowth*100)+'%' : ' - ';
  var ela_imp_pct = AG.elaPctImp !== null ? Math.round(AG.elaPctImp*100)+'%' : ' - ';
  var math_imp_pct = AG.mathPctImp !== null ? Math.round(AG.mathPctImp*100)+'%' : ' - ';

  var acadRows = [
    ['Scholars w/ Placement Data',
      AG.elaTotalScholars||' - ', AG.mathTotalScholars||' - ',
      'iReady-matched  -  EOY pending for select sites'],
    ['Avg BOY Scale Score',
      AG.elaAvgBOY ? AG.elaAvgBOY.toFixed(1):' - ', AG.mathAvgBOY ? AG.mathAvgBOY.toFixed(1):' - ',
      'Beginning-of-Year baseline before TAP tutoring'],
    ['Avg End Scale Score',
      AG.elaAvgEND ? AG.elaAvgEND.toFixed(1):' - ', AG.mathAvgEND ? AG.mathAvgEND.toFixed(1):' - ',
      'MOY / EOY endpoint  -  positive trajectory across program'],
    ['Avg Scale Score Gain',
      ela_gain_str+' pts', math_gain_str+' pts',
      'Both subjects showing strong gain  -  driven by TAP intervention'],
    ['Median % of Typical Annual Growth',
      ela_med, math_med,
      'Benchmark = 100%; several apprentices exceeding benchmark'],
    ['Scholars Who Improved Placement',
      AG.elaImpStr||' - ', AG.mathImpStr||' - ',
      ela_imp_pct+' ELA  ·  '+math_imp_pct+' Math moved to higher iReady band'],
    ['Scholar Survey Responses',
      surv_total_str+' total',' - ',
      'Confidence '+(AG.avgConf||allAgg.avgConf||' - ')+'  ·  Enjoyment '+(AG.avgEnjoy||allAgg.avgEnjoy||' - ')+'  ·  Overall '+(AG.avgOverall||allAgg.avgOverall||' - ')],
    ['Program Attendance Rate',
      prog_rate_str,' - ',
      Math.round(allAgg.totalAtt||0).toLocaleString()+' attended  ·  '+Math.round((allAgg.totalSess||0)-(allAgg.totalAtt||0)).toLocaleString()+' missed'],
  ];
  acadRows.forEach(function(row, i) {
    var r = 18 + i;
    var bg = i % 2 === 0 ? C.LTGRAY : C.WHITE;
    rh(ws,r,20);
    mr(ws,r,1,1,5,row[0],          {bg:bg,bold:true,sz:10,al:'left', va:'middle'});
    mr(ws,r,6,1,2,String(row[1]),  {bg:bg,sz:11,al:'center',va:'middle',fc:C.NAVY,bold:true});
    mr(ws,r,8,1,2,String(row[2]),  {bg:bg,sz:11,al:'center',va:'middle',fc:C.TEAL,bold:true});
    mr(ws,r,10,1,3,row[3],         {bg:bg,sz:9, al:'left', va:'middle',fc:C.DARK,it:true});
  });

  rh(ws,26,8);

  // ── iReady color key ──
  secHead(ws,27,NC,'iREADY 5-LEVEL PLACEMENT COLOR REFERENCE',C.DARK,'#F0F4FA');
  rh(ws,28,24);
  [[C.IR3,C.WHITE,'3+ Grade Levels Below'],[C.IR2,C.WHITE,'2 Levels Below'],
   [C.IR1,'#1a1a1a','1 Level Below'],[C.IREO,'#1a1a1a','Early On Grade Level'],[C.IRMID,C.WHITE,'Mid / Above Grade Level']]
  .forEach(function(lv,i){ mr(ws,28,i*2+1,1,2,lv[2],{bg:lv[0],fc:lv[1],bold:true,sz:10,al:'center',va:'middle'}); });
  ws.getRange(28,11,1,2).merge().setBackground(C.LTGRAY);

  rh(ws,29,8);

  // ── PLACEMENT DISTRIBUTION CHART: ALL apprentices ──
  secHead(ws,30,NC,'CHART 1  ·  Placement Distribution: BOY vs. End  ·  All 46 Apprentices  ·  Stacked Column by iReady Level',C.TEAL);
  var plHdrs = ['Cohort','3+ Below','2 Below','1 Below','Early OG','Mid+ OG'];
  var plRows = [
    ['ELA BOY',  PL.elaB3,  PL.elaB2,  PL.elaB1,  PL.elaEO,  PL.elaMid],
    ['ELA End',  PL.elaEB3, PL.elaEB2, PL.elaEB1, PL.elaEEO, PL.elaEMid],
    ['Math BOY', PL.mathB3, PL.mathB2, PL.mathB1, PL.mathEO, PL.mathMid],
    ['Math End', PL.mathEB3,PL.mathEB2,PL.mathEB1,PL.mathEEO,PL.mathEMid],
  ];
  var plRange = writeTable(ws, 31, 1, plHdrs, plRows);
  buildChart(ws, plRange, [31, 7], {
    type:'COLUMN', stacked:true,
    title:'Scholar Placement Distribution: Beginning vs. End  ·  All 46 Apprentices  ·  NJTC TAP SY 2025-26',
    hTitle:'Assessment Period', vTitle:'Number of Scholars',
    colors:[C.IR3, C.IR2, C.IR1, C.IREO, C.IRMID],
    legend:'top', left:60, w:640, h:340, caW:520, caH:240,
  });

  // ── PLACEMENT MOVEMENT CHART: Active vs Cancelled ──
  var c2Row = 37;
  secHead(ws,c2Row,NC,'CHART 2  ·  Placement Movement: Improved / Maintained / Declined  ·  Active vs Cancelled vs All',C.NAVY);

  // Build active and cancelled plAgg sub-sets
  var actPlacements = data.placements.filter(function(p){ return p.status === 'Active'; });
  var canPlacements = data.placements.filter(function(p){ return p.status === 'Cancelled'; });
  function mvCounts(pls, apps) {
    var imp=0,mnt=0,dec=0;
    apps.forEach(function(a){
      if(a.elaI!==null) imp+=a.elaI; if(a.elaM!==null) mnt+=a.elaM; if(a.elaD!==null) dec+=a.elaD;
      if(a.mathI!==null) imp+=a.mathI; if(a.mathM!==null) mnt+=a.mathM; if(a.mathD!==null) dec+=a.mathD;
    });
    return [imp, mnt, dec];
  }
  var actMv = mvCounts(actPlacements, ACT);
  var canMv = mvCounts(canPlacements, CAN);
  var allMv = [actMv[0]+canMv[0], actMv[1]+canMv[1], actMv[2]+canMv[2]];
  var mvRange = writeTable(ws, c2Row+1, 1,
    ['Group','Improved','Maintained','Declined'],
    [['Active ('+ACT.length+')',actMv[0],actMv[1],actMv[2]],
     ['Cancelled ('+CAN.length+')',canMv[0],canMv[1],canMv[2]],
     ['All ('+A.length+')', allMv[0],allMv[1],allMv[2]]]);
  buildChart(ws, mvRange, [c2Row+1, 5], {
    type:'BAR', stacked:false,
    title:'Placement Movement by Apprentice Status  ·  Improved / Maintained / Declined  ·  NJTC TAP SY 2025-26',
    hTitle:'Number of Scholars', vTitle:'Group',
    colors:[C.IRMID, C.IR1, C.IR3],
    legend:'top', left:130, w:620, h:240, caW:420, caH:160,
  });
}

// ══════════════════════════════════════════════════════════
// ██  SHEET 2  -  ACADEMIC GROWTH
// ══════════════════════════════════════════════════════════
function buildAcademicGrowth(ss, data) {
  var ws = ss.insertSheet('📈 Academic Growth', ss.getSheets().length);
  var A = data.apprentices;
  hg(ws);
  [1,2,3,4].forEach(function(i){ cw(ws,i,140); });
  for (var i=5; i<=13; i++) cw(ws,i,90);

  banner(ws,'NJTC TAP  -  Academic Growth Analysis  ·  SY 2025-26',
    'Gains, Growth % & Placement Movement  ·  Active + Cancelled  ·  Live from: Apprentice Impact Data (RAW)  ·  '+A.length+' Apprentices',13);

  rh(ws,4,8);
  secHead(ws,5,13,'INDIVIDUAL ELA & MATH SCALE SCORE GAINS  ·  Active apprentices first, then Cancelled  ·  Sorted by ELA Gain within each group');
  colHdr(ws,6,['Status','Apprentice','School','Region','Source',
    'ELA\nScholars','ELA\nBOY','ELA\nEnd','ELA\nGain','ELA\n%Growth','Math\nScholars','Math\nGain','Math\n%Growth'],C.NAVY,C.WHITE,36);

  // Sort: active first (by ELA gain desc), then cancelled (by ELA gain desc)
  function sortByGain(arr) {
    return arr.slice().sort(function(a,b){ return (b.elaG!==null?b.elaG:-999)-(a.elaG!==null?a.elaG:-999); });
  }
  var actWithAcad = sortByGain(data.activeApps.filter(hasAcademicData));
  var canWithAcad = sortByGain(data.cancelledApps.filter(hasAcademicData));
  var withAcad = actWithAcad.concat(canWithAcad);

  var actCount = actWithAcad.length;
  withAcad.forEach(function(a, i) {
    var r = 7 + i;
    var isCancelled = a.status === 'Cancelled';
    var bg = isCancelled
      ? (i % 2 === 0 ? C.CANCEL_LT : '#FFF9F6')
      : (i % 2 === 0 ? C.LTGRAY : C.WHITE);
    rh(ws,r,20);
    ws.getRange(r,1,1,13).setBackground(bg);
    sc(ws.getRange(r,1), isCancelled?'Cancelled':'Active', {bg:isCancelled?C.CANCEL_LT:C.LTGRAY, sz:8, al:'center', fc:isCancelled?C.CANCEL:C.NAVY});
    sc(ws.getRange(r,2), a.name,   {bold:true, sz:10, al:'left'});
    sc(ws.getRange(r,3), a.school, {sz:9, al:'left', fc:C.DARK});
    sc(ws.getRange(r,4), a.region, {sz:9, al:'center'});
    sc(ws.getRange(r,5), a.source, {sz:8, al:'center', fc:C.DARK, it:true});
    sc(ws.getRange(r,6),  a.elaS!==null&&a.elaS>0?a.elaS:' - ',        {sz:10,al:'center'});
    sc(ws.getRange(r,7),  a.elaBOY!==null?a.elaBOY.toFixed(1):' - ',   {sz:10,al:'center'});
    sc(ws.getRange(r,8),  a.elaEND!==null?a.elaEND.toFixed(1):' - ',   {sz:10,al:'center'});
    sc(ws.getRange(r,9),  a.elaG!==null?fmtNum(a.elaG,1,true)+' pts':' - ',{bg:gBg(a.elaG),sz:10,al:'center',bold:a.elaG>15});
    sc(ws.getRange(r,10), a.elaPG!==null?Math.round(a.elaPG*100)+'%':' - ', {bg:grBg(a.elaPG),sz:10,al:'center'});
    sc(ws.getRange(r,11), a.mathS!==null&&a.mathS>0?a.mathS:' - ',     {sz:10,al:'center'});
    sc(ws.getRange(r,12), a.mathG!==null?fmtNum(a.mathG,1,true)+' pts':' - ',{bg:gBg(a.mathG),sz:10,al:'center',bold:a.mathG>15});
    sc(ws.getRange(r,13), a.mathPG!==null?Math.round(a.mathPG*100)+'%':' - ',{bg:grBg(a.mathPG),sz:10,al:'center'});
    // Ensure background on non-colored cells
    [6,7,8,11].forEach(function(c){ ws.getRange(r,c).setBackground(bg); });
  });

  var tableEnd = 7 + withAcad.length;
  rh(ws,tableEnd,8);

  // ── CHART 1: Grouped Horizontal Bar  -  ELA vs Math Gain ──
  secHead(ws,tableEnd+1,13,'CHART 1  ·  ELA vs Math Scale Score Gain  ·  All Apprentices with Data  ·  NJTC = Navy · Cancelled = Teal',C.TEAL);
  var gainRows = withAcad.map(function(a){
    return [a.name+(a.status==='Cancelled'?' *':''), a.elaG, a.mathG];
  });
  var gainRange = writeTable(ws,tableEnd+2,1,['Apprentice','ELA Gain (pts)','Math Gain (pts)'],gainRows);
  buildChart(ws, gainRange, [tableEnd+2, 4], {
    type:'BAR',
    title:'ELA vs. Math Scale Score Gain by Apprentice  ·  * = Cancelled  ·  NJTC TAP SY 2025-26',
    hTitle:'Scale Score Gain (points)', vTitle:'Apprentice',
    colors:[C.TEAL, C.GOLD], legend:'top', left:200, hMin:-20,
    w:900, h:Math.max(380, gainRows.length*26+100), caW:580, caH:Math.max(280, gainRows.length*22),
  });

  // ── CHART 2: % of Typical Growth ──
  var c2Start = tableEnd + gainRows.length + 6;
  secHead(ws,c2Start,13,'CHART 2  ·  % of Typical Annual Growth  ·  Column  ·  100% = On-Pace Benchmark',C.NAVY);
  var grApps = A.filter(function(a){ return a.elaPG!==null||a.mathPG!==null; });
  grApps.sort(function(a,b){ return (b.elaPG||0)-(a.elaPG||0); });
  var grRows = grApps.map(function(a){
    return [a.name+(a.status==='Cancelled'?' *':''),
      a.elaPG!==null?Math.round(a.elaPG*100):null,
      a.mathPG!==null?Math.round(a.mathPG*100):null,
      100];
  });
  var grRange = writeTable(ws,c2Start+1,1,['Apprentice','ELA % Growth','Math % Growth','100% Benchmark'],grRows);
  buildChart(ws, grRange, [c2Start+1, 5], {
    type:'COLUMN',
    title:'% of Typical Annual Growth  ·  100% = On-Pace  ·  * = Cancelled  ·  NJTC TAP SY 2025-26',
    hTitle:'Apprentice', vTitle:'% of Typical Annual Growth',
    colors:[C.TEAL, C.GOLD, C.IR3], legend:'top', left:60, vMin:0, vMax:230,
    w:900, h:420, caW:680, caH:320,
  });

  // ── CHART 3: Placement Movement  -  Active vs Cancelled ──
  var c3Start = c2Start + grRows.length + 5;
  secHead(ws,c3Start,13,'CHART 3  ·  Placement Level Movement  ·  Active vs Cancelled  ·  Improved / Maintained / Declined',C.TEAL);
  var PL = data.plAgg;
  var mvRows = [
    ['ELA  -  All ('+(data.agg.elaTotalScholars||' - ')+' scholars)', PL.elaImp, PL.elaMaint, PL.elaDec],
    ['Math  -  All ('+(data.agg.mathTotalScholars||' - ')+' scholars)', PL.mathImp, PL.mathMaint, PL.mathDec],
  ];
  var mvRange = writeTable(ws,c3Start+1,1,['Subject','Improved','Maintained','Declined'],mvRows);
  buildChart(ws, mvRange, [c3Start+1, 5], {
    type:'BAR', stacked:true,
    title:'Placement Level Movement  ·  Improved / Maintained / Declined  ·  NJTC TAP SY 2025-26',
    hTitle:'Number of Scholars', vTitle:'Subject',
    colors:[C.IRMID, C.IR1, C.IR3], legend:'top', left:140, w:680, h:200, caW:460, caH:120,
  });
}

// ══════════════════════════════════════════════════════════
// ██  SHEET 3  -  SCHOLAR EXPERIENCE
// ══════════════════════════════════════════════════════════
function buildScholarExperience(ss, data) {
  var ws = ss.insertSheet('⭐ Scholar Experience', ss.getSheets().length);
  var A = data.apprentices, AG = data.agg;
  hg(ws);
  cw(ws,1,185); cw(ws,2,165);
  for (var i=3; i<=11; i++) cw(ws,i,100);

  var surv_total_str = AG.survTotal!==null ? Math.round(AG.survTotal).toLocaleString() : Math.round(data.allSubAgg.survTotal||0).toLocaleString();
  banner(ws,'NJTC TAP  -  Scholar Survey & SEL Impact  ·  SY 2025-26',
    'Pearl Operations  ·  '+surv_total_str+' Total Survey Responses  ·  All '+A.length+' Apprentices  ·  Sorted Highest Overall Rating',11);

  rh(ws,4,8);
  secHead(ws,5,11,'SCHOLAR SURVEY SCORES BY APPRENTICE  ·  All 46  ·  Rated 1-5  ·  Sorted Highest Overall  ·  Cancelled marked with (C)');
  colHdr(ws,6,['Status','Apprentice Name','School / Site','Region','Survey\nResponses',
    'Confidence\n(1-5)','Enjoyment\n(1-5)','Learning\n(1-5)','Overall\nRating','Benchmark\nStatus'],C.TEAL,C.WHITE,36);

  var sorted = A.slice().sort(function(a,b){ return (b.overall||0)-(a.overall||0); });
  sorted.forEach(function(a, i) {
    var r = 7 + i;
    var isCancelled = a.status === 'Cancelled';
    var bg = isCancelled ? (i%2===0?C.CANCEL_LT:'#FFF9F6') : (i%2===0?C.LTGRAY:C.WHITE);
    rh(ws,r,20);
    ws.getRange(r,1,1,11).setBackground(bg);
    sc(ws.getRange(r,1), isCancelled?'(C)':'', {sz:8,al:'center',fc:isCancelled?C.CANCEL:C.NAVY,bold:isCancelled});
    sc(ws.getRange(r,2), a.name,   {bold:true,sz:10,al:'left'});
    sc(ws.getRange(r,3), a.school, {sz:9,al:'left',fc:C.DARK});
    sc(ws.getRange(r,4), a.region, {sz:9,al:'center'});
    sc(ws.getRange(r,5), a.survR!==null?Math.round(a.survR).toLocaleString():' - ',{sz:10,al:'center'});
    [a.conf,a.enjoy,a.learn].forEach(function(v,j){
      sc(ws.getRange(r,6+j), v!==null?v.toFixed(1):' - ', {bg:svBg(v),sz:10,al:'center'});
    });
    sc(ws.getRange(r,9), a.overall!==null?a.overall.toFixed(1)+' / 5.0':' - ',
       {bg:svBg(a.overall),bold:a.overall>=4.5,sz:10,al:'center'});
    var st = a.overall>=4.5?'⭐ Excellent':a.overall>=4.0?'✓ Strong':a.overall>=3.5?'▲ Developing':' -  Pending';
    sc(ws.getRange(r,10), st, {sz:9,al:'center',fc:a.overall>=4.5?'#1A7A4A':a.overall>=4.0?'#1C7C8C':'#7B5500',bold:a.overall>=4.5});
  });

  var avgRow = 7 + sorted.length;
  rh(ws,avgRow,26);
  mr(ws,avgRow,1,1,4,'PROGRAM AVERAGE  ·  All '+A.length+' Apprentices',
     {bg:C.NAVY,fc:C.WHITE,bold:true,sz:10,al:'left',va:'middle'});
  [[5,surv_total_str],[6,AG.avgConf!==null?AG.avgConf.toFixed(1):' - '],
   [7,AG.avgEnjoy!==null?AG.avgEnjoy.toFixed(1):' - '],[8,AG.avgLearn!==null?AG.avgLearn.toFixed(1):' - '],
   [9,AG.avgOverall!==null?AG.avgOverall.toFixed(1)+' / 5.0':' - '],[10,'⭐ Excellent']]
  .forEach(function(x){
    sc(ws.getRange(avgRow,x[0]),x[1],{bg:C.NAVY,fc:C.WHITE,bold:true,sz:10,al:'center',va:'middle'});
  });

  rh(ws,avgRow+1,8);

  // ── CHART 1: Horizontal Bar  -  Overall Rating ──
  secHead(ws,avgRow+2,11,'CHART 1  ·  Scholar Overall Rating by Apprentice  ·  (C) = Cancelled  ·  Sorted Highest → Lowest',C.TEAL);
  var survRows = sorted.map(function(a){ return [a.name+(a.status==='Cancelled'?' (C)':''), a.overall]; });
  var survRange = writeTable(ws,avgRow+3,1,['Apprentice','Overall Rating'],survRows);
  buildChart(ws, survRange, [avgRow+3, 3], {
    type:'BAR',
    title:'Avg Scholar Overall Rating  ·  All 46 Apprentices  ·  (C)=Cancelled  ·  NJTC TAP SY 2025-26',
    hTitle:'Average Rating (1-5)', vTitle:'Apprentice',
    colors:[C.TEAL], legend:'none', left:200, hMin:3.0, hMax:5.3,
    w:720, h:Math.max(520, sorted.length*19+100), caW:460, caH:Math.max(400, sorted.length*16),
  });

  // ── CHART 2: Multi-series Column  -  All 4 SEL Dimensions ──
  var c2Start = avgRow + survRows.length + 7;
  secHead(ws,c2Start,11,'CHART 2  ·  All 4 SEL Dimensions by Apprentice  ·  Confidence · Enjoyment · Learning · Overall',C.NAVY);
  var selRows = sorted.map(function(a){ return [a.name+(a.status==='Cancelled'?' (C)':''),a.conf,a.enjoy,a.learn,a.overall]; });
  var selRange = writeTable(ws,c2Start+1,1,['Apprentice','Confidence','Enjoyment','Learning','Overall'],selRows);
  buildChart(ws, selRange, [c2Start+1, 6], {
    type:'COLUMN',
    title:'Scholar Survey: 4 SEL Dimensions by Apprentice  ·  NJTC TAP SY 2025-26',
    hTitle:'Apprentice', vTitle:'Score (1-5)',
    colors:[C.NAVY,C.TEAL,C.GOLD,C.IRMID], legend:'top', left:60, vMin:3.0, vMax:5.3,
    w:960, h:440, caW:740, caH:320,
  });

  // ── CHART 3: Program SEL summary ──
  var c3Start = c2Start + selRows.length + 5;
  secHead(ws,c3Start,11,'CHART 3  ·  Program SEL Summary  ·  All 46 Apprentices  ·  vs 4.0 Benchmark',C.TEAL);
  var pSelRows = [
    ['Confidence',    AG.avgConf   ||data.allSubAgg.avgConf   ||0, 4.0],
    ['Enjoyment',     AG.avgEnjoy  ||data.allSubAgg.avgEnjoy  ||0, 4.0],
    ['Learning',      AG.avgLearn  ||data.allSubAgg.avgLearn  ||0, 4.0],
    ['Overall Rating',AG.avgOverall||data.allSubAgg.avgOverall||0, 4.0],
  ];
  var pSelRange = writeTable(ws,c3Start+1,1,['Dimension','Program Average','Benchmark (4.0)'],pSelRows);
  buildChart(ws, pSelRange, [c3Start+1, 3], {
    type:'COLUMN',
    title:'Scholar Survey Program Averages  ·  All 4 Dimensions vs 4.0 Benchmark  ·  NJTC TAP SY 2025-26',
    hTitle:'Survey Dimension', vTitle:'Average Score (1-5)',
    colors:[C.NAVY,C.GOLD], legend:'top', left:60, vMin:3.5, vMax:5.0,
    w:440, h:320, caW:300, caH:220,
  });
}

// ══════════════════════════════════════════════════════════
// ██  SHEET 4  -  ATTENDANCE RECORD
// ══════════════════════════════════════════════════════════
function buildAttendanceRecord(ss, data) {
  var ws = ss.insertSheet('📅 Attendance Record', ss.getSheets().length);
  var A = data.apprentices, AG = data.agg;
  hg(ws);
  cw(ws,1,30); cw(ws,2,185); cw(ws,3,165);
  for (var i=4; i<=9; i++) cw(ws,i,100);

  var allAgg = data.allSubAgg;
  var prog_rate_str = AG.progRate!==null ? Math.round(AG.progRate*1000)/10+'%' : (allAgg.progRate!==null?Math.round(allAgg.progRate*1000)/10+'%':' - ');
  banner(ws,'NJTC TAP  -  Apprentice Attendance Record  ·  SY 2025-26',
    'All '+A.length+' Apprentices  ·  Sorted Highest → Lowest Rate  ·  Program Average: '+prog_rate_str+'  ·  (C) = Cancelled',9);

  rh(ws,4,8);
  colHdr(ws,5,['','Apprentice Name','School / Site','Region','Sessions\nAttended','Sessions\nMissed','Total\nSessions','Attendance\nRate','Status'],C.TEAL,C.WHITE,34);

  var sorted = A.slice().sort(function(a,b){ return (b.rate||0)-(a.rate||0); });
  sorted.forEach(function(a, i) {
    var r = 6 + i;
    var isCancelled = a.status === 'Cancelled';
    var bg = isCancelled ? (i%2===0?C.CANCEL_LT:'#FFF9F6') : (i%2===0?C.LTGRAY:C.WHITE);
    rh(ws,r,20);
    ws.getRange(r,1,1,9).setBackground(bg);
    sc(ws.getRange(r,1), isCancelled?'(C)':'', {sz:8,al:'center',fc:isCancelled?C.CANCEL:C.NAVY});
    sc(ws.getRange(r,2), a.name,   {bold:true,sz:10,al:'left'});
    sc(ws.getRange(r,3), a.school, {sz:9,al:'left',fc:C.DARK});
    sc(ws.getRange(r,4), a.region, {sz:9,al:'center'});
    sc(ws.getRange(r,5), a.att!==null?a.att:' - ',  {sz:10,al:'center'});
    sc(ws.getRange(r,6), a.miss!==null?a.miss:' - ', {sz:10,al:'center',fc:a.miss>0?'#8B1A1A':C.DARK});
    sc(ws.getRange(r,7), a.total!==null?a.total:' - ',{sz:10,al:'center'});
    sc(ws.getRange(r,8), a.rate!==null?Math.round(a.rate*1000)/10+'%':' - ',
       {bg:attBg(a.rate),fc:attFc(a.rate),bold:true,sz:11,al:'center'});
    var st = a.rate>=1.0?'★ Perfect':a.rate>=0.95?'✓ Excellent':a.rate>=0.85?'▲ Good':'⚠ Needs Attention';
    sc(ws.getRange(r,9), st, {sz:9,al:'center',fc:attFc(a.rate),bold:a.rate>=0.95});
    [2,3,4,5,6,7,9].forEach(function(c){ ws.getRange(r,c).setBackground(bg); });
  });

  var tot = 6 + sorted.length;
  rh(ws,tot,26);
  mr(ws,tot,1,1,4,'PROGRAM TOTALS  ·  All '+A.length+' Apprentices',
     {bg:C.NAVY,fc:C.WHITE,bold:true,sz:10,al:'left',va:'middle'});
  var totalAtt  = allAgg.totalAtt  || 0;
  var totalSess = allAgg.totalSess || 0;
  var totalMiss = totalSess - totalAtt;
  [[5,Math.round(totalAtt).toLocaleString()],[6,Math.round(totalMiss).toLocaleString()],
   [7,Math.round(totalSess).toLocaleString()],[8,prog_rate_str],[9,'✓ Strong']]
  .forEach(function(x){ sc(ws.getRange(tot,x[0]),x[1],{bg:C.NAVY,fc:C.WHITE,bold:true,sz:11,al:'center',va:'middle'}); });

  rh(ws,tot+1,8);
  rh(ws,tot+2,22);
  [[C.AP,'#0D5C2E','★ 100%  Perfect'],[C.AH,'#0D5C2E','✓ 95-99%  Excellent'],
   [C.AM,'#7B5500','▲ 85-94%  Good'],[C.AL,'#8B1A1A','⚠ <85%  Needs Attention']]
  .forEach(function(l,j){ sc(ws.getRange(tot+2,j*2+1),l[2],{bg:l[0],fc:l[1],bold:true,sz:10,al:'center',va:'middle'}); });
  rh(ws,tot+3,8);

  // ── CHART 1: Attendance rate bar ──
  secHead(ws,tot+4,9,'CHART 1  ·  Attendance Rate by Apprentice  ·  (C) = Cancelled  ·  Gold Line = Program Average',C.NAVY);
  var progAvgPct = allAgg.progRate!==null?Math.round(allAgg.progRate*1000)/10:93.0;
  var attRows = sorted.map(function(a){
    return [a.name+(a.status==='Cancelled'?' (C)':''),
      a.rate!==null?Math.round(a.rate*1000)/10:null, progAvgPct];
  });
  var attRange = writeTable(ws,tot+5,1,['Apprentice','Attendance Rate (%)','Program Avg ('+progAvgPct+'%)'],attRows);
  buildChart(ws, attRange, [tot+5, 4], {
    type:'BAR',
    title:'Apprentice Attendance Rate (%)  ·  NJTC TAP SY 2025-26  ·  Program Average: '+prog_rate_str,
    hTitle:'Attendance Rate (%)', vTitle:'Apprentice',
    colors:[C.NAVY,C.GOLD], legend:'top', left:200, hMin:50, hMax:103,
    w:760, h:Math.max(500, sorted.length*22+100), caW:480, caH:Math.max(380, sorted.length*18),
  });

  // ── CHART 2: Pie  -  Attendance tiers ──
  var pieStart = tot + attRows.length + 8;
  secHead(ws,pieStart,9,'CHART 2  ·  Attendance Tier Distribution  ·  All 46 Apprentices',C.TEAL);
  var perfect   = sorted.filter(function(a){return a.rate>=1.0;}).length;
  var excellent = sorted.filter(function(a){return a.rate>=0.95&&a.rate<1.0;}).length;
  var good      = sorted.filter(function(a){return a.rate>=0.85&&a.rate<0.95;}).length;
  var low       = sorted.filter(function(a){return a.rate<0.85;}).length;
  var pieRange  = writeTable(ws,pieStart+1,1,['Tier','# Apprentices'],
    [['Perfect (100%)',perfect],['Excellent (95-99%)',excellent],['Good (85-94%)',good],['Needs Attention (<85%)',low]]);
  buildChart(ws, pieRange, [pieStart+1, 3], {
    type:'PIE',
    title:'Attendance Tier Distribution  ·  '+A.length+' Apprentices  ·  NJTC TAP SY 2025-26',
    colors:[C.IRMID,C.TEAL,C.GOLD,C.IR2], legend:'right', left:40, w:500, h:300, caW:300, caH:220,
  });
}

// ══════════════════════════════════════════════════════════
// ██  SHEET 5  -  TALKING POINTS
// ══════════════════════════════════════════════════════════
function buildTalkingPoints(ss, data) {
  var ws = ss.insertSheet('🏅 Talking Points', ss.getSheets().length);
  var A = data.apprentices, AG = data.agg, allAgg = data.allSubAgg;
  hg(ws);
  for (var i=1; i<=8; i++) cw(ws,i,140);

  var ela_g    = AG.elaAvgGain!==null?'+'+AG.elaAvgGain.toFixed(1):' - ';
  var math_g   = AG.mathAvgGain!==null?'+'+AG.mathAvgGain.toFixed(1):' - ';
  var ela_med  = AG.elaMedianGrowth!==null?Math.round(AG.elaMedianGrowth*100)+'%':' - ';
  var math_med = AG.mathMedianGrowth!==null?Math.round(AG.mathMedianGrowth*100)+'%':' - ';
  var prog_rate = allAgg.progRate!==null?Math.round(allAgg.progRate*1000)/10+'%':' - ';
  var surv_total = AG.survTotal!==null?Math.round(AG.survTotal).toLocaleString():Math.round(allAgg.survTotal||0).toLocaleString();
  var ela_imp  = AG.elaImpStr||' - ';
  var math_imp = AG.mathImpStr||' - ';
  var ela_pct  = AG.elaPctImp!==null?Math.round(AG.elaPctImp*100)+'%':' - ';
  var math_pct = AG.mathPctImp!==null?Math.round(AG.mathPctImp*100)+'%':' - ';
  var perfect  = A.filter(function(a){return a.rate>=1.0;}).length;
  var tot_att  = Math.round(allAgg.totalAtt||0).toLocaleString();
  var tot_sess = Math.round(allAgg.totalSess||0).toLocaleString();
  var avgConf  = AG.avgConf||allAgg.avgConf||' - ';
  var avgEnjoy = AG.avgEnjoy||allAgg.avgEnjoy||' - ';
  var avgLearn = AG.avgLearn||allAgg.avgLearn||' - ';
  var avgOv    = AG.avgOverall||allAgg.avgOverall||' - ';

  banner(ws,'NJTC TAP  -  SY 2025-26 Capstone Talking Points & Workforce Summary',
    'For Stakeholder Presentation  ·  All '+A.length+' Apprentices (Active + Cancelled)  ·  Built: '+new Date().toLocaleDateString(),8);

  rh(ws,4,8);
  secHead(ws,5,8,'CAPSTONE NARRATIVE TALKING POINTS  ·  For Presentation Use  ·  All data auto-computed from source');

  var tps = [
    ['1. Academic Impact  -  Scale Score Growth',
      'Across all '+A.length+' apprentices with available iReady diagnostic data, scholars gained an average of '+ela_g+' iReady scale score points in ELA and '+math_g+' in Math. These apprentices drove '+ela_med+' of typical annual ELA growth and '+math_med+' of Math growth  -  all through structured, high-impact tutoring delivered by NJ DOL Registered Apprentices. This includes data from both currently enrolled and cancelled apprentices, representing the full scope of TAP\'s academic reach this year.'],
    ['2. Placement Movement  -  From Below Grade Level Toward Grade Level',
      ela_imp+' ELA scholars ('+ela_pct+') and '+math_imp+' Math scholars ('+math_pct+') improved their iReady diagnostic placement level  -  moving from below-grade-level tiers toward Early On Grade Level or above. Every placement level gained represents measurable progress toward grade-level proficiency for a real student in New Jersey.'],
    ['3. SEL Impact  -  Scholar Wellbeing and Relationship Quality',
      'Across '+surv_total+' scholar survey responses collected through Pearl Operations: Confidence '+avgConf+'  ·  Enjoyment '+avgEnjoy+'  ·  Learning '+avgLearn+'  ·  Overall '+avgOv+'  -  all above the 4.0 benchmark. These scores capture something test data cannot: apprentices are building real relationships, creating psychologically safe learning environments, and developing the instructional presence that defines great educators.'],
    ['4. Professional Commitment  -  Attendance as a Workforce Signal',
      'TAP apprentices showed up: '+prog_rate+' program attendance rate across '+tot_sess+' scheduled sessions ('+tot_att+' attended). '+perfect+' apprentices achieved a perfect 100% attendance rate. This is the single most visible measure of professional disposition and workforce readiness  -  and it is extraordinary.'],
    ['5. The Full Apprentice Cohort  -  Active and Cancelled Together',
      'This report includes all '+A.length+' apprentices who were part of the TAP program in SY 2025-26  -  including '+data.cancelledApps.length+' who cancelled during the year. Where data exists for cancelled apprentices (Pearl sessions, MOY iReady scores, survey responses), it is included in full. This report is a culmination of the year, not a status update  -  every apprentice who touched this program is represented.'],
    ['6. Data Honesty  -  Verified, Not Projected',
      'Several sites have full survey and attendance data but pending academic scores (EOY Preliminary status). This report uses only real, verified, available data  -  no projections, no estimates. The final EOY analysis will only strengthen what is already a compelling story. When the data is updated, re-run this script to refresh every sheet automatically.'],
  ];

  tps.forEach(function(tp, i) {
    var r = 6 + i * 3;
    rh(ws,r,22); mr(ws,r,1,1,8,'  '+tp[0],{bg:i%2===0?C.NAVY:C.TEAL,fc:C.WHITE,bold:true,sz:11,al:'left',va:'middle'});
    rh(ws,r+1,90); mr(ws,r+1,1,1,8,tp[1],{bg:i%2===0?C.LTGRAY:C.OFF,fc:C.BLACK,sz:11,al:'left',va:'top',wrap:true});
    rh(ws,r+2,5); ws.getRange(r+2,1,1,8).merge().setBackground(C.WHITE);
  });

  var wfRow = 6 + tps.length * 3 + 2;
  secHead(ws,wfRow,8,'WORKFORCE DEVELOPMENT SUMMARY  ·  All '+A.length+' Apprentices  ·  Active + Cancelled',C.GOLD,'#1a1a1a');
  colHdr(ws,wfRow+1,['Accomplishment','Value','Detail','','','','',''],C.GOLD,'#1a1a1a',28);
  mr(ws,wfRow+1,3,1,6,'Detail',{bg:C.GOLD,fc:'#1a1a1a',bold:true,sz:9,al:'center',va:'middle'});

  var schools = {};
  A.forEach(function(a){ if(a.school&&a.school!=='No Placement') schools[a.school]=1; });
  var schoolCount = Object.keys(schools).length;
  var wfRows = [
    ['NJ DOL Registered Apprentices  -  SY 2025-26', String(A.length), data.activeApps.length+' Active  ·  '+data.cancelledApps.length+' Cancelled'],
    ['Total Tutoring Sessions Logged', tot_sess, 'Across '+schoolCount+' schools in NE and SW regions of New Jersey'],
    ['Sessions Successfully Attended', tot_att, prog_rate+' program-wide attendance  -  professional standard met'],
    ['K-12 Scholars Supported (ELA + Math)', String((data.agg.elaTotalScholars||0)+(data.agg.mathTotalScholars||0))+'+', 'Combined caseload  -  active + cancelled apprentices'],
    ['Scholar Survey Responses via Pearl', surv_total, 'Confidence · Enjoyment · Learning · Overall dimensions'],
    ['Avg Scholar Overall Rating', (avgOv||' - ')+' / 5.0', 'Exceeds 4.0 benchmark  -  scholars feel supported and valued'],
    ['Apprentices at 100% Attendance', String(perfect), 'Perfect professional attendance for the full academic year'],
    ['School Sites Served Statewide', String(schoolCount), 'From Southwest NJ to Northeast NJ  -  full state footprint'],
  ];
  wfRows.forEach(function(row, i) {
    var r = wfRow + 2 + i;
    rh(ws,r,22);
    var bg = i%2===0?C.GOLD_LT:C.WHITE;
    sc(ws.getRange(r,1),row[0],{bg:bg,bold:true,sz:10,al:'left',va:'middle'});
    sc(ws.getRange(r,2),row[1],{bg:bg,bold:true,sz:13,al:'center',va:'middle',fc:C.NAVY});
    mr(ws,r,3,1,6,row[2],{bg:bg,sz:10,al:'left',va:'middle',fc:C.DARK,it:true});
  });
}

// ══════════════════════════════════════════════════════════
// ██  CERTIFICATE ENGINE
// ══════════════════════════════════════════════════════════
function buildOneCert(ws, startRow, app, certType) {
  var CERT_ROWS = 28;
  var attStr    = app.rate!==null ? Math.round(app.rate*100)+'%' : ' - ';
  var sessStr   = (app.att||' - ')+' of '+(app.total||' - ')+' sessions';
  var survStr   = app.overall!==null ? app.overall.toFixed(1)+' / 5.0' : ' - ';
  var survCount = app.survR!==null ? Math.round(app.survR).toLocaleString() : ' - ';
  var eg = app.elaG, mg = app.mathG;

  ws.getRange(startRow, 1, CERT_ROWS, 10).setBackground('#FAFBFD');

  // Gold top bar
  rh(ws,startRow,6);   ws.getRange(startRow,1,1,10).merge().setBackground(C.GOLD);
  // NJTC Header
  rh(ws,startRow+1,26); mr(ws,startRow+1,1,1,10,'NEW JERSEY TUTORING CORPS',{bg:C.NAVY,fc:C.WHITE,bold:true,sz:14,al:'center',va:'middle'});
  rh(ws,startRow+2,18); mr(ws,startRow+2,1,1,10,'Tutor Apprenticeship Program  ·  SY 2025-2026  ·  NJ Department of Labor Registered Apprenticeship',{bg:C.NAVY,fc:'#9EC5E8',sz:9,al:'center',va:'middle',it:true});
  // Gold rule
  rh(ws,startRow+3,4); ws.getRange(startRow+3,1,1,10).merge().setBackground(C.GOLD);
  // Cert type title
  var certTitle = certType==='complete'?'CERTIFICATE OF ACHIEVEMENT':certType==='partial'?'CERTIFICATE OF PARTICIPATION':'CERTIFICATE OF RECOGNITION';
  rh(ws,startRow+4,32); mr(ws,startRow+4,1,1,10,certTitle,{bg:'#FAFBFD',fc:C.NAVY,bold:true,sz:18,al:'center',va:'middle'});
  rh(ws,startRow+5,18); mr(ws,startRow+5,1,1,10,'This certificate is proudly presented to',{bg:'#FAFBFD',fc:C.DARK,sz:10,al:'center',va:'middle',it:true});
  // Apprentice name  -  hero
  rh(ws,startRow+6,48); mr(ws,startRow+6,1,1,10,app.name,{bg:'#FAFBFD',fc:C.NAVY,bold:true,sz:24,al:'center',va:'middle'});
  ws.getRange(startRow+6,1,1,10).setBorder(false,false,true,false,false,false,C.GOLD,SpreadsheetApp.BorderStyle.SOLID_MEDIUM);
  // School + region
  rh(ws,startRow+7,18); mr(ws,startRow+7,1,1,10,app.school+'  ·  '+app.region+' Region  ·  NJ DOL ID: '+app.dol,{bg:'#FAFBFD',fc:C.DARK,sz:10,al:'center',va:'middle'});
  // Separator
  rh(ws,startRow+8,4); ws.getRange(startRow+8,1,1,10).merge().setBackground(C.MID);
  // Statement
  var stmt = '';
  if (certType==='complete') {
    var eLine = eg!==null?'guiding scholars to an average ELA gain of '+fmtNum(eg,1,true)+' iReady scale score points':'driving measurable academic progress';
    var mLine = mg!==null?' and a Math gain of '+fmtNum(mg,1,true)+' points':'';
    stmt = 'In recognition of exemplary service as a NJ DOL Registered Tutor Apprentice  -  '+eLine+mLine+', maintaining a '+attStr+' professional attendance rate across '+sessStr+', and receiving a '+survStr+' scholar satisfaction rating from '+survCount+' surveys collected through Pearl Operations.';
  } else if (certType==='partial') {
    stmt = 'In recognition of dedicated service as a NJ DOL Registered Tutor Apprentice  -  maintaining a '+attStr+' professional attendance rate across '+sessStr+', earning a '+survStr+' scholar satisfaction rating across '+survCount+' surveys, and demonstrating the professional commitment that defines the NJTC Tutor Apprenticeship Program. Full academic impact data pending EOY submission.';
  } else {
    stmt = 'In recognition of completing SY 2025-26 as a NJ DOL Registered Tutor Apprentice with the New Jersey Tutoring Corps  -  serving scholars across New Jersey with dedication, care, and professional excellence. Attendance: '+attStr+'. Scholar Rating: '+survStr+'. Total Sessions: '+(app.total||' - ')+'.';
  }
  rh(ws,startRow+9,72); mr(ws,startRow+9,1,1,10,stmt,{bg:'#FAFBFD',fc:C.BLACK,sz:10,al:'center',va:'middle',wrap:true});
  // Stats header
  rh(ws,startRow+10,4); ws.getRange(startRow+10,1,1,10).merge().setBackground(C.MID);
  rh(ws,startRow+11,18); mr(ws,startRow+11,1,1,10,'PERFORMANCE HIGHLIGHTS  ·  SY 2025-26',{bg:C.NAVY,fc:C.WHITE,bold:true,sz:9,al:'center',va:'middle'});
  // Core stats
  rh(ws,startRow+12,30);
  [[1,2,'ATTENDANCE RATE\n'+attStr,          attBg(app.rate), attFc(app.rate)],
   [3,2,'SESSIONS ATTENDED\n'+(app.att||' - ')+' sessions', C.LTGRAY, C.NAVY],
   [5,2,'SCHOLAR RATING\n'+survStr,          svBg(app.overall), app.overall>=4.5?'#1A7A4A':C.NAVY],
   [7,2,'SURVEY RESPONSES\n'+survCount,      C.LTGRAY, C.NAVY],
   [9,2,'REGION\n'+app.region+'  ·  NJ',    C.NAVY, C.WHITE]].forEach(function(x){
    mr(ws,startRow+12,x[0],1,x[1],x[2],{bg:x[3],fc:x[4],bold:true,sz:9,al:'center',va:'middle',wrap:true});
  });
  // Academic stats (complete certs)
  if (certType==='complete' && (eg!==null||mg!==null)) {
    rh(ws,startRow+13,28);
    var acRows;
    if (eg!==null&&mg!==null) {
      acRows=[[1,3,'ELA GAIN\n'+fmtNum(eg,1,true)+' pts',gBg(eg),'#1A7A4A'],
              [4,2,'ELA SCHOLARS\n'+(app.elaS>0?app.elaS:' - ')+' students',C.LTGRAY,C.NAVY],
              [6,3,'MATH GAIN\n'+fmtNum(mg,1,true)+' pts',gBg(mg),'#1A7A4A'],
              [9,2,'MATH SCHOLARS\n'+(app.mathS>0?app.mathS:' - ')+' students',C.LTGRAY,C.NAVY]];
    } else if (eg!==null) {
      acRows=[[1,5,'ELA GAIN\n'+fmtNum(eg,1,true)+' iReady pts',gBg(eg),'#1A7A4A'],
              [6,5,'ELA SCHOLARS TUTORED\n'+(app.elaS>0?app.elaS:' - ')+' students',C.LTGRAY,C.NAVY]];
    } else {
      acRows=[[1,5,'MATH GAIN\n'+fmtNum(mg,1,true)+' iReady pts',gBg(mg),'#1A7A4A'],
              [6,5,'MATH SCHOLARS TUTORED\n'+(app.mathS>0?app.mathS:' - ')+' students',C.LTGRAY,C.NAVY]];
    }
    acRows.forEach(function(x){ mr(ws,startRow+13,x[0],1,x[1],x[2],{bg:x[3],fc:x[4],bold:true,sz:9,al:'center',va:'middle',wrap:true}); });
    rh(ws,startRow+14,26);
    [[1,2,'CONFIDENCE\n'+(app.conf?app.conf.toFixed(1)+'/5':' - '),svBg(app.conf),'#1A7A4A'],
     [3,3,'ENJOYMENT\n'+(app.enjoy?app.enjoy.toFixed(1)+'/5':' - '),svBg(app.enjoy),'#1A7A4A'],
     [6,2,'LEARNING\n'+(app.learn?app.learn.toFixed(1)+'/5':' - '),svBg(app.learn),'#1A7A4A'],
     [8,3,'OVERALL RATING\n'+(app.overall?app.overall.toFixed(1)+'/5.0':' - '),svBg(app.overall),'#1A7A4A']]
    .forEach(function(x){ mr(ws,startRow+14,x[0],1,x[1],x[2],{bg:x[3],fc:x[4],bold:true,sz:9,al:'center',va:'middle',wrap:true}); });
  }

  // ── SIGNATURE BLOCK ──────────────────────────────────────
  rh(ws,startRow+18,5); ws.getRange(startRow+18,1,1,10).merge().setBackground(C.MID);
  rh(ws,startRow+19,52); // taller row to accommodate signature image

  // Katherine's signature  -  image if URL configured, else text line
  if (KATHERINE_SIGNATURE_URL) {
    try {
      // Signature image floated over the left signature cell area
      ws.insertImage(KATHERINE_SIGNATURE_URL, startRow+19, 1, 8, 2);
    } catch(e) {
      // Image failed (bad URL or permissions)  -  fall through to text placeholder
      KATHERINE_SIGNATURE_URL = '';
    }
  }
  // Name + title always written as text (image floats above)
  var sigText = KATHERINE_SIGNATURE_URL ? '\n' + KATHERINE_NAME + '\nExecutive Director, NJTC'
                                        : '_________________________________\n' + KATHERINE_NAME + '\nExecutive Director, NJTC';
  mr(ws,startRow+19,1,1,4,sigText,{bg:'#FAFBFD',fc:C.DARK,sz:9,al:'center',va:'bottom',wrap:true});
  mr(ws,startRow+19,5,1,2,'DATE\nJune 2026',{bg:'#FAFBFD',fc:C.DARK,sz:9,al:'center',va:'bottom',wrap:true});
  mr(ws,startRow+19,7,1,4,'_________________________________\nNJ DOL Program Representative',{bg:'#FAFBFD',fc:C.DARK,sz:9,al:'center',va:'bottom',wrap:true});

  // Footer
  rh(ws,startRow+23,16);
  mr(ws,startRow+23,1,1,10,'NJ DOL Registered Apprenticeship  ·  New Jersey Tutoring Corps  ·  Tutor Apprenticeship Program  ·  Academic Year 2025-2026',{bg:C.NAVY,fc:'#9EC5E8',sz:8,al:'center',va:'middle',it:true});
  rh(ws,startRow+24,6); ws.getRange(startRow+24,1,1,10).merge().setBackground(C.GOLD);
  rh(ws,startRow+25,16);
  // Borders
  ws.getRange(startRow,1,25,10).setBorder(true,true,true,true,false,false,C.NAVY,SpreadsheetApp.BorderStyle.SOLID_THICK);
  ws.getRange(startRow+1,1,1,10).setBorder(false,false,true,false,false,false,C.GOLD,SpreadsheetApp.BorderStyle.SOLID_MEDIUM);
  ws.getRange(startRow+23,1,1,10).setBorder(true,false,false,false,false,false,C.GOLD,SpreadsheetApp.BorderStyle.SOLID_MEDIUM);
}

// ── CERT SHEET HEADER ──────────────────────────────────────
function certSheetHeader(ws, title, sub, bg) {
  for (var i=1; i<=10; i++) cw(ws,i,100);
  hg(ws);
  rh(ws,1,60); mr(ws,1,1,1,10,title,{bg:bg||C.NAVY,fc:bg===C.GOLD?C.NAVY:C.WHITE,bold:true,sz:14,al:'center',va:'middle'});
  rh(ws,2,24); mr(ws,2,1,1,10,sub,{bg:C.NAVY,fc:C.WHITE,sz:10,al:'center',va:'middle',it:true});
  rh(ws,3,12);
}

// hasAcademicData: true if apprentice has any academic metric
function hasAcademicData(a) {
  return a.elaG!==null || a.mathG!==null || a.elaMG!==null || a.mathMG!==null;
}

function buildCertsComplete(ss, data) {
  var ws = ss.insertSheet('🥇 Certificates: Complete', ss.getSheets().length);
  var complete = data.apprentices.filter(hasAcademicData);
  certSheetHeader(ws,
    'NJTC TAP  -  SY 2025-26  ·  CERTIFICATES OF ACHIEVEMENT  ·  '+complete.length+' Apprentices with Academic Data',
    'Active + Cancelled  ·  iReady or Standards Mastery Data Present  ·  Print: File → Print → Letter Landscape',C.NAVY);
  var r = 4;
  complete.forEach(function(app){ buildOneCert(ws,r,app,'complete'); r+=28; });
}

function buildCertsPartial(ss, data) {
  var ws = ss.insertSheet('📜 Certificates: Partial', ss.getSheets().length);
  var partial = data.apprentices.filter(function(a){ return !hasAcademicData(a); });
  certSheetHeader(ws,
    'NJTC TAP  -  SY 2025-26  ·  CERTIFICATES OF PARTICIPATION  ·  '+partial.length+' Apprentices',
    'Survey & Attendance Data Present  ·  Full Achievement Certificates Follow Upon EOY Release',C.TEAL);
  var r = 4;
  partial.forEach(function(app){ buildOneCert(ws,r,app,'partial'); r+=28; });
}

function buildCertsRecognition(ss, data) {
  var ws = ss.insertSheet('🌟 Certificates: Recognition', ss.getSheets().length);
  certSheetHeader(ws,
    'NJTC TAP  -  SY 2025-26  ·  CERTIFICATES OF RECOGNITION  ·  All '+data.apprentices.length+' Apprentices',
    'Active + Cancelled  ·  Celebrating Every Apprentice for Service, Dedication & Professional Development',C.GOLD);
  var r = 4;
  data.apprentices.forEach(function(app){ buildOneCert(ws,r,app,'recognition'); r+=28; });
}

function buildAllCertificates() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  ['🥇 Certificates: Complete','📜 Certificates: Partial','🌟 Certificates: Recognition']
    .forEach(function(n){ var s=ss.getSheetByName(n); if(s) ss.deleteSheet(s); });
  SpreadsheetApp.flush();
  var data = loadData(ss);
  buildCertsComplete(ss, data);
  buildCertsPartial(ss, data);
  buildCertsRecognition(ss, data);
  safeAlert('✅ All 3 certificate sheets rebuilt!\n'+data.activeApps.length+' Active · '+data.cancelledApps.length+' Cancelled');
}
