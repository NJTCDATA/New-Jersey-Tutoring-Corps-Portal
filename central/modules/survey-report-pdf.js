// ─────────────────────────────────────────────────────────────────────────────
// NJTC Survey Report PDF — Scholar & Tutor Likert Dashboard
// FORMAT: 254 × 143 mm landscape (exact Google Slides 16:9 widescreen)
// Screenshot the PDF page → paste directly into Google Slides, zero crop.
// Charts rendered at 1400×860 px (≈3× density) — no blur when screenshotted.
// ─────────────────────────────────────────────────────────────────────────────
(function () {
  'use strict';

  // ── Column indexes ─────────────────────────────────────────────────────────
  const STU  = { CONFIDENCE:2, ENJOYMENT:3, LEARNING:4, OVERALL:5, SCHOOL:8,  DISTRICT:9  };
  const INST = { ENGAGEMENT:2, ENJOYMENT:3, LEARNING:4, OVERALL:5, SCHOOL:9,  DISTRICT:10 };

  // ── Palette ────────────────────────────────────────────────────────────────
  const C = {
    navy:    [10,  35,  66],
    barBlue: '#1b3a6b',
    green:   [46,  125,  50],
    gray:    [110, 110, 110],
    red:     [198,  40,  40],
    white:   [255, 255, 255],
    muted:   [107, 114, 128],
    body:    [ 45,  45,  45],
    strip:   [235, 240, 247],
    pie:     ['#3d3d3d','#757575','#b0bec5','#1565c0','#0a2342'],
  };

  // ── Data helpers ───────────────────────────────────────────────────────────
  function safeN(v) { var n = parseFloat(v); return isNaN(n) ? null : n; }

  function likertCounts(rows, col) {
    var c = {1:0,2:0,3:0,4:0,5:0};
    for (var i = 0; i < rows.length; i++) {
      var v = Math.round(safeN(rows[i][col]));
      if (v >= 1 && v <= 5) c[v]++;
    }
    return c;
  }

  function sentiment(rows, col) {
    var pos=0, neu=0, neg=0;
    for (var i = 0; i < rows.length; i++) {
      var v = safeN(rows[i][col]);
      if (v===null||v<=0) continue;
      if (v >= 4) pos++; else if (v >= 3) neu++; else neg++;
    }
    var total = pos+neu+neg;
    return {
      positive:pos, neutral:neu, negative:neg, total:total,
      posPct: total>0 ? pos/total*100 : 0,
      neuPct: total>0 ? neu/total*100 : 0,
      negPct: total>0 ? neg/total*100 : 0,
    };
  }

  // ── Chart rendering (Chart.js → canvas → PNG dataURL) ─────────────────────
  var _holder = null;
  function getHolder() {
    if (!_holder) {
      _holder = document.createElement('div');
      _holder.style.cssText = 'position:fixed;left:-99999px;top:-99999px;visibility:hidden;pointer-events:none;z-index:-1';
      document.body.appendChild(_holder);
    }
    return _holder;
  }

  function renderBarChart(counts, pxW, pxH) {
    return new Promise(function(resolve) {
      var canvas = document.createElement('canvas');
      canvas.width = pxW; canvas.height = pxH;
      getHolder().appendChild(canvas);

      var labels = ['1','2','3','4','5'];
      var data   = labels.map(function(l){ return counts[parseInt(l)]||0; });
      var maxVal = Math.max.apply(null,data)||1;

      var valPlugin = {
        id:'srpBar',
        afterDatasetsDraw: function(chart) {
          var ctx = chart.ctx;
          chart.data.datasets.forEach(function(ds,di){
            chart.getDatasetMeta(di).data.forEach(function(bar,j){
              var val = ds.data[j];
              if (val > 0) {
                ctx.save();
                ctx.fillStyle = '#1b3a6b';
                ctx.font = 'bold 28px system-ui,sans-serif';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'bottom';
                ctx.fillText(val.toLocaleString(), bar.x, bar.y - 8);
                ctx.restore();
              }
            });
          });
        }
      };

      var chart = new Chart(canvas, {
        type:'bar',
        data:{
          labels:labels,
          datasets:[{
            data:data,
            backgroundColor: C.barBlue,
            borderRadius: 8,
            borderSkipped: false,
          }]
        },
        options:{
          animation:{duration:0},
          responsive:false,
          layout:{padding:{top:50,bottom:12,left:20,right:20}},
          plugins:{ legend:{display:false}, tooltip:{enabled:false} },
          scales:{
            x:{
              grid:{display:false}, border:{display:false},
              ticks:{ color:'#374151', font:{size:24, weight:'600'} }
            },
            y:{
              display:false, beginAtZero:true,
              suggestedMax: maxVal*1.32, grid:{display:false}
            }
          }
        },
        plugins:[valPlugin]
      });

      setTimeout(function(){
        var url = canvas.toDataURL('image/png');
        chart.destroy();
        if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
        resolve(url);
      }, 120);
    });
  }

  function renderPieChart(counts, pxW, pxH) {
    return new Promise(function(resolve) {
      var canvas = document.createElement('canvas');
      canvas.width = pxW; canvas.height = pxH;
      getHolder().appendChild(canvas);

      var labels = ['1','2','3','4','5'];
      var data   = labels.map(function(l){ return counts[parseInt(l)]||0; });
      var total  = data.reduce(function(s,v){return s+v;},0)||1;

      var piePlugin = {
        id:'srpPie',
        afterDatasetsDraw: function(chart) {
          var ctx = chart.ctx;
          chart.getDatasetMeta(0).data.forEach(function(arc,i){
            var pct = data[i]/total*100;
            if (pct < 4) return;
            var mid = (arc.startAngle+arc.endAngle)/2;
            var r   = arc.outerRadius * 0.62;
            var x   = arc.x + Math.cos(mid)*r;
            var y   = arc.y + Math.sin(mid)*r;
            ctx.save();
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 24px system-ui,sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(pct.toFixed(1)+'%', x, y);
            ctx.restore();
          });
        }
      };

      var chart = new Chart(canvas, {
        type:'pie',
        data:{
          labels:labels,
          datasets:[{
            data:data,
            backgroundColor: C.pie,
            borderColor:'#ffffff',
            borderWidth:3,
          }]
        },
        options:{
          animation:{duration:0},
          responsive:false,
          layout:{padding:14},
          plugins:{
            legend:{
              display:true, position:'right',
              labels:{ color:'#374151', font:{size:22}, padding:20, usePointStyle:true, pointStyleWidth:18 }
            },
            tooltip:{enabled:false}
          }
        },
        plugins:[piePlugin]
      });

      setTimeout(function(){
        var url = canvas.toDataURL('image/png');
        chart.destroy();
        if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
        resolve(url);
      }, 120);
    });
  }

  // ── jsPDF loader ───────────────────────────────────────────────────────────
  var _libsLoaded = false;
  function loadLibs() {
    return new Promise(function(resolve, reject) {
      if (_libsLoaded && window.jspdf && window.jspdf.jsPDF) { resolve(); return; }
      var s1 = document.createElement('script');
      s1.src = 'https://unpkg.com/jspdf@2.5.1/dist/jspdf.umd.min.js';
      s1.onerror = function(){ reject(new Error('Failed to load jsPDF')); };
      s1.onload  = function(){
        var s2 = document.createElement('script');
        s2.src = 'https://unpkg.com/jspdf-autotable@3.8.2/dist/jspdf.plugin.autotable.min.js';
        s2.onerror = function(){ reject(new Error('Failed to load jsPDF-autoTable')); };
        s2.onload  = function(){ _libsLoaded = true; resolve(); };
        document.head.appendChild(s2);
      };
      document.head.appendChild(s1);
    });
  }

  function triggerDownload(doc, filename) {
    var blob = doc.output('blob');
    var url  = URL.createObjectURL(blob);
    var a    = document.createElement('a');
    a.href=url; a.download=filename;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(function(){ URL.revokeObjectURL(url); }, 2000);
  }

  function safe(s) {
    return String(s||'')
      .replace(/[—–]/g,'-')
      .replace(/['']/g,"'").replace(/[""]/g,'"')
      .replace(/[^\x20-\x7E\xA0-\xFF]/g,'').trim();
  }

  // ── Loading overlay ────────────────────────────────────────────────────────
  function showOverlay(msg) {
    var el = document.getElementById('_srpOv');
    if (!el) {
      el = document.createElement('div');
      el.id = '_srpOv';
      el.style.cssText = 'position:fixed;inset:0;z-index:99999;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1.25rem;background:rgba(10,35,66,.85);backdrop-filter:blur(5px)';
      document.body.appendChild(el);
      if (!document.getElementById('_srpKf')) {
        var st = document.createElement('style');
        st.id = '_srpKf';
        st.textContent = '@keyframes srpSpin{to{transform:rotate(360deg)}}';
        document.head.appendChild(st);
      }
    }
    el.innerHTML = '<div style="width:56px;height:56px;border:4px solid rgba(255,255,255,.25);border-top-color:#fff;border-radius:50%;animation:srpSpin .8s linear infinite"></div>'
      + '<div style="color:#fff;font:600 1rem/1.6 system-ui,sans-serif;text-align:center;max-width:360px;white-space:pre-line">' + safe(msg) + '</div>';
    el.style.display = 'flex';
  }
  function updateOverlay(msg) {
    var el = document.getElementById('_srpOv');
    if (el) { var d = el.querySelector('div:last-child'); if (d) d.textContent = safe(msg); }
  }
  function hideOverlay() {
    var el = document.getElementById('_srpOv');
    if (el) el.style.display = 'none';
  }

  // ── Stream completion poll ─────────────────────────────────────────────────
  function waitForStream(po, maxMs, onTick) {
    return new Promise(function(resolve) {
      if (!po.isSurveyDataComplete || po.isSurveyDataComplete()) { resolve(true); return; }
      var elapsed = 0, iv = 600;
      var t = setInterval(function(){
        elapsed += iv;
        var counts = po.getSurveyRowCounts ? po.getSurveyRowCounts() : null;
        if (onTick && counts) onTick(counts, elapsed);
        if (po.isSurveyDataComplete()) { clearInterval(t); resolve(true); }
        else if (elapsed >= maxMs)     { clearInterval(t); resolve(false); }
      }, iv);
    });
  }

  // ══════════════════════════════════════════════════════════════════════════
  // PDF BUILDER — 16:9 landscape (254 × 143 mm = exact Google Slides size)
  //
  // Layout math (all mm):
  //   HDR_H=15  STRIP_H=5  CTOP=22  CBOT=140  CH=118
  //   LEFT_W=82  GAP=6  RIGHT_X=96  RIGHT_W=150
  //   CHART_COL_W=72.5  CHART_LBL_H=8  CHART_IMG_H=42  CHART_CELL=53
  //   2×CHART_CELL=106  CHART_GAP=12  (no overflow)
  // ══════════════════════════════════════════════════════════════════════════
  function buildPDF(stuRows, instRows, filterState, chartImgs) {
    var jsPDF = window.jspdf.jsPDF;
    var doc = new jsPDF({ orientation:'landscape', unit:'mm', format:[254,143] });

    var PW = 254, PH = 143;
    var ML = 8,  MR = PW-8;

    // ── Header geometry ──────────────────────────────────────────────────────
    var HDR_H   = 15;
    var STRIP_H = 5;
    var CTOP    = HDR_H + STRIP_H + 2;   // 22 mm
    var CBOT    = PH - 3;                 // 140 mm
    var CH      = CBOT - CTOP;            // 118 mm

    // ── Column geometry ──────────────────────────────────────────────────────
    var LEFT_W  = 82;
    var GAP_COL = 6;
    var RIGHT_X = ML + LEFT_W + GAP_COL;  // 96 mm
    var RIGHT_W = MR - RIGHT_X;           // 150 mm

    // ── Chart grid geometry ──────────────────────────────────────────────────
    var CHART_COL_W = (RIGHT_W - 5) / 2;  // 72.5 mm each column
    var CHART_LBL_H = 8;
    var CHART_IMG_H = 42;
    var CHART_CELL  = CHART_LBL_H + CHART_IMG_H + 3; // 53 mm
    var CHART_GAP   = CH - 2 * CHART_CELL;            // 118-106 = 12 mm

    // scope label for header
    var scopeLabel = '';
    if (filterState.schools.length) {
      scopeLabel = filterState.schools.length === 1
        ? 'School: ' + filterState.schools[0]
        : filterState.schools.length + ' schools selected';
    } else if (filterState.districts.length) {
      scopeLabel = filterState.districts.length === 1
        ? 'District: ' + filterState.districts[0]
        : filterState.districts.length + ' districts selected';
    } else {
      scopeLabel = 'Network Aggregate - All Schools & Districts';
    }

    // ── Page header ──────────────────────────────────────────────────────────
    function pageHeader(title, count, surveyType) {
      doc.setFillColor.apply(doc, C.navy);
      doc.rect(0, 0, PW, HDR_H, 'F');

      doc.setFontSize(14); doc.setFont('helvetica','bold');
      doc.setTextColor.apply(doc, C.white);
      doc.text(safe(title), ML, 10.5);

      doc.setFontSize(8); doc.setFont('helvetica','normal');
      doc.text(safe(count.toLocaleString() + ' responses'), MR, 7.5, {align:'right'});
      doc.setFontSize(7.5);
      doc.text(safe(scopeLabel), MR, 13.5, {align:'right'});

      doc.setFillColor.apply(doc, C.strip);
      doc.rect(0, HDR_H, PW, STRIP_H, 'F');
      doc.setFontSize(6.5); doc.setFont('helvetica','italic');
      doc.setTextColor.apply(doc, C.muted);
      doc.text(
        safe('SY 2025-2026  \xB7  ' + surveyType + '  \xB7  Scale: 4-5 = Positive  \xB7  3 = Neutral  \xB7  1-2 = Negative'),
        ML, HDR_H + 3.5
      );
      doc.setTextColor.apply(doc, C.body); doc.setFont('helvetica','normal');
    }

    // ── Sentiment column (left side) ─────────────────────────────────────────
    function sentimentColumn(sent, infoTitle, infoBody) {
      var y = CTOP;

      // Legend chips
      var chips = [
        {label:'Positive', rgb:C.green},
        {label:'Neutral',  rgb:C.gray},
        {label:'Negative', rgb:C.red},
      ];
      var lx = ML;
      chips.forEach(function(ch){
        doc.setFillColor.apply(doc, ch.rgb);
        doc.roundedRect(lx, y+0.5, 3, 3, 0.5, 0.5, 'F');
        doc.setFontSize(6.5); doc.setTextColor.apply(doc, C.muted);
        doc.text(safe(ch.label), lx+4.5, y+3.2);
        lx += 20;
      });
      y += 7;

      // Sentiment bars
      var barX = ML + 22;
      var barW = LEFT_W - 23;
      var barH = 9;
      var barRows = [
        {label:'Positive', pct:sent.posPct, rgb:C.green},
        {label:'Neutral',  pct:sent.neuPct, rgb:C.gray},
        {label:'Negative', pct:sent.negPct, rgb:C.red},
      ];
      barRows.forEach(function(row){
        var fw = (row.pct/100)*barW;
        doc.setFillColor(228, 235, 244);
        doc.roundedRect(barX, y, barW, barH, 2, 2, 'F');
        if (fw > 0.5) {
          doc.setFillColor.apply(doc, row.rgb);
          doc.roundedRect(barX, y, fw, barH, 2, 2, 'F');
        }
        doc.setFontSize(7.5); doc.setFont('helvetica','bold');
        doc.setTextColor.apply(doc, C.body);
        doc.text(safe(row.label), ML, y+6.5);
        var pStr = row.pct.toFixed(2) + '%';
        doc.setFontSize(7); doc.setFont('helvetica','bold');
        if (fw > 16) {
          doc.setTextColor(255,255,255);
          doc.text(safe(pStr), barX+fw-2.5, y+6.5, {align:'right'});
        } else {
          doc.setTextColor.apply(doc, C.body);
          doc.text(safe(pStr), barX+Math.max(fw,0)+2, y+6.5);
        }
        doc.setTextColor.apply(doc, C.body);
        y += barH + 3;
      });

      // Info box
      y += 4;
      var boxH = CBOT - y - 2;
      if (boxH > 12) {
        doc.setFillColor(26, 58, 107);
        doc.roundedRect(ML, y, LEFT_W, boxH, 3, 3, 'F');
        doc.setFontSize(7.5); doc.setFont('helvetica','bold');
        doc.setTextColor.apply(doc, C.white);
        doc.text(safe(infoTitle), ML+4, y+7);
        doc.setFontSize(7); doc.setFont('helvetica','normal');
        var lines = doc.splitTextToSize(safe(infoBody), LEFT_W-8);
        var ly = y+13;
        lines.forEach(function(line){
          if (ly < y+boxH-4) { doc.text(line, ML+4, ly); ly+=4.5; }
        });
        doc.setTextColor.apply(doc, C.body);
      }
    }

    // ── Chart grid (right side, 2×2) ─────────────────────────────────────────
    function chartGrid(imgs, labels) {
      var y = CTOP;
      [[0,1],[2,3]].forEach(function(pair, row){
        pair.forEach(function(idx, col){
          var cx = RIGHT_X + col*(CHART_COL_W+5);

          // Card background + border
          doc.setFillColor(255,255,255);
          doc.roundedRect(cx, y, CHART_COL_W, CHART_CELL, 3, 3, 'F');
          doc.setDrawColor(218, 228, 242); doc.setLineWidth(0.25);
          doc.roundedRect(cx, y, CHART_COL_W, CHART_CELL, 3, 3, 'S');

          // Question label
          doc.setFontSize(7); doc.setFont('helvetica','bold');
          doc.setTextColor.apply(doc, C.navy);
          var wrapped = doc.splitTextToSize(safe(labels[idx]||''), CHART_COL_W-6);
          var lY = y+5;
          wrapped.slice(0,2).forEach(function(line){
            doc.text(line, cx+3, lY); lY+=3.8;
          });
          doc.setTextColor.apply(doc, C.body);

          // Chart image
          if (imgs[idx]) {
            try { doc.addImage(imgs[idx],'PNG', cx+1, y+CHART_LBL_H, CHART_COL_W-2, CHART_IMG_H); }
            catch(e){}
          }
        });
        y += CHART_CELL + Math.max(CHART_GAP, 4);
      });
    }

    // ══════════════════════════════════════════════════════════════════════════
    // PAGE 1 — SCHOLAR SURVEY DETAILS
    // ══════════════════════════════════════════════════════════════════════════
    var stuSent = sentiment(stuRows, STU.OVERALL);
    pageHeader('Scholar Survey Details', stuSent.total, 'Scholar Surveys');
    sentimentColumn(
      stuSent,
      'Scholar Enjoyment Surveys:',
      'The chart displays the % of scholar surveys rated Positive (4-5), Neutral (3), or Negative (1-2) based on the Overall session score.'
    );
    chartGrid(chartImgs.stu, [
      'How much did you enjoy this session with the tutor?',
      'Overall, how did this tutoring session go?',
      'How much do you think you learned this session?',
      'How confident are you that you understood the material?',
    ]);

    // ══════════════════════════════════════════════════════════════════════════
    // PAGE 2 — TUTOR SURVEY DETAILS
    // ══════════════════════════════════════════════════════════════════════════
    doc.addPage([254,143],'landscape');
    var instSent = sentiment(instRows, INST.OVERALL);
    pageHeader('Tutor Survey Details', instSent.total, 'Tutor Surveys');
    sentimentColumn(
      instSent,
      'Scholar Engagement Surveys:',
      'The chart displays the % of tutor surveys rated Positive (4-5), Neutral (3), or Negative (1-2) based on the tutor\'s Overall session score.'
    );
    chartGrid(chartImgs.inst, [
      'How engaged were the scholars during this session?',
      'Overall, how did this tutoring session go?',
      'How much did you enjoy the session with these scholars?',
      'How much do you think the scholars learned?',
    ]);

    return doc;
  }

  // ── Main entry point ───────────────────────────────────────────────────────
  async function generate() {
    var po = window.po;
    if (!po || typeof po.isDataLoaded !== 'function' || !po.isDataLoaded()) {
      alert('Pearl data has not loaded yet. Please wait for the sync indicator to show "Live" and try again.');
      return;
    }

    // ── Gate on scholar stream completion ────────────────────────────────────
    var isComplete = po.isSurveyDataComplete ? po.isSurveyDataComplete() : true;

    if (!isComplete) {
      var c0 = po.getSurveyRowCounts ? po.getSurveyRowCounts() : {};
      showOverlay(
        'Loading scholar survey data...\n'
        + (c0.scholar||0).toLocaleString() + ' rows loaded so far.\n'
        + 'Waiting for 100% to ensure accuracy.'
      );
      isComplete = await waitForStream(po, 45000, function(counts, ms){
        updateOverlay(
          'Loading scholar survey data...\n'
          + counts.scholar.toLocaleString() + ' rows  ('+ Math.round(ms/1000) +'s)\n'
          + 'Waiting for full sync before generating.'
        );
      });
      if (!isComplete) {
        hideOverlay();
        var c1 = po.getSurveyRowCounts ? po.getSurveyRowCounts() : {};
        var ok = window.confirm(
          'Scholar survey stream is taking longer than expected.\n\n'
          + 'Loaded so far: ' + (c1.scholar||0).toLocaleString() + ' scholar survey rows.\n\n'
          + 'OK = generate with available data (may be slightly incomplete)\n'
          + 'Cancel = close and click Refresh to re-sync, then try again.'
        );
        if (!ok) return;
      }
    }

    showOverlay('Applying filters…');

    // ── Get filtered rows ────────────────────────────────────────────────────
    var stuRows  = po.getFilteredStuRows  ? po.getFilteredStuRows()  : po.getStuRows();
    var instRows = po.getFilteredInstRows ? po.getFilteredInstRows() : po.getInstRows();
    var filterState = po.getFilterState ? po.getFilterState() : {districts:[],schools:[]};

    if (!stuRows.length && !instRows.length) {
      hideOverlay();
      alert('No survey data for the current filter. Clear filters to generate a network-wide report.');
      return;
    }

    console.log('[Survey Report PDF] scholar rows:', stuRows.length, '| tutor rows:', instRows.length,
                '| filter:', JSON.stringify(filterState));

    try {
      updateOverlay(
        'Rendering charts…\n'
        + stuRows.length.toLocaleString() + ' scholar  /  '
        + instRows.length.toLocaleString() + ' tutor responses'
      );

      var PX = {W:1400, H:860};

      var stuCols  = [STU.ENJOYMENT,  STU.OVERALL,   STU.LEARNING, STU.CONFIDENCE];
      var instCols = [INST.ENGAGEMENT, INST.OVERALL,  INST.ENJOYMENT, INST.LEARNING];

      var stuP  = stuCols.map(function(col,i){
        var counts = likertCounts(stuRows, col);
        return i===1 ? renderPieChart(counts,PX.W,PX.H) : renderBarChart(counts,PX.W,PX.H);
      });
      var instP = instCols.map(function(col,i){
        var counts = likertCounts(instRows, col);
        return i===1 ? renderPieChart(counts,PX.W,PX.H) : renderBarChart(counts,PX.W,PX.H);
      });

      var all = await Promise.all(stuP.concat(instP));
      var chartImgs = { stu: all.slice(0,4), inst: all.slice(4,8) };

      updateOverlay('Building PDF…');
      await loadLibs();

      var doc = buildPDF(stuRows, instRows, filterState, chartImgs);

      var scope = filterState.schools.length===1
        ? filterState.schools[0].replace(/[^a-z0-9]/gi,'_').slice(0,30)
        : filterState.districts.length===1
          ? filterState.districts[0].replace(/[^a-z0-9]/gi,'_').slice(0,30)
          : 'Network';
      triggerDownload(doc, 'NJTC_Survey_Report_' + scope + '_' + new Date().toISOString().slice(0,10) + '.pdf');

    } catch(err) {
      console.error('[Survey Report PDF]', err);
      alert('Error generating PDF: ' + err.message + '\n\nPlease try again.');
    } finally {
      hideOverlay();
    }
  }

  window.njtcSurveyPDF = { generate: generate };
})();
