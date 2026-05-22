// ─────────────────────────────────────────────────────────────────────────────
// NJTC Survey Report PDF — Scholar & Tutor Likert Dashboard
// Replicates the Data Studio visual layout: sentiment bar + bar/pie charts
// Pulls live filtered data from window.po (Pearl Operations module)
// ─────────────────────────────────────────────────────────────────────────────
(function () {
  'use strict';

  // ── Column indexes (mirror programming.js STU_S / INST_S) ─────────────────
  const STU  = { CONFIDENCE:2, ENJOYMENT:3, LEARNING:4, OVERALL:5, SCHOOL:8, DISTRICT:9 };
  const INST = { ENGAGEMENT:2, ENJOYMENT:3, LEARNING:4, OVERALL:5, SCHOOL:9, DISTRICT:10 };

  // ── Brand palette ──────────────────────────────────────────────────────────
  const COLOR = {
    navy:       '#0a2342',
    navyRGB:    [10, 35, 66],
    barBlue:    '#1b3a6b',
    green:      '#2e7d32',
    greenRGB:   [46, 125, 50],
    neutral:    '#9e9e9e',
    neutralRGB: [158, 158, 158],
    red:        '#c62828',
    redRGB:     [198, 40, 40],
    white:      '#ffffff',
    whiteRGB:   [255, 255, 255],
    lightBg:    '#f7f9fc',
    lightBgRGB: [247, 249, 252],
    muted:      '#6b7280',
    mutedRGB:   [107, 114, 128],
    body:       '#2d2d2d',
    bodyRGB:    [45, 45, 45],
    infoBlue:   '#1a3a6b',
    infoBlueBg: '#e8eef6',
    // Pie colors indexed by Likert score (1-5)
    pie: ['#424242','#757575','#bdbdbd','#1565c0','#0a2342'],
  };

  // ── Data helpers ───────────────────────────────────────────────────────────
  function safeFloat(v) { var n = parseFloat(v); return isNaN(n) ? null : n; }

  function likertCounts(rows, col) {
    var c = { 1:0, 2:0, 3:0, 4:0, 5:0 };
    for (var i = 0; i < rows.length; i++) {
      var v = Math.round(safeFloat(rows[i][col]));
      if (v >= 1 && v <= 5) c[v]++;
    }
    return c;
  }

  function sentimentPct(rows, col) {
    var pos = 0, neu = 0, neg = 0;
    for (var i = 0; i < rows.length; i++) {
      var v = safeFloat(rows[i][col]);
      if (v === null || v <= 0) continue;
      if (v >= 4)      pos++;
      else if (v >= 3) neu++;
      else             neg++;
    }
    var total = pos + neu + neg;
    return {
      positive: pos, neutral: neu, negative: neg, total: total,
      posPct: total > 0 ? pos / total * 100 : 0,
      neuPct: total > 0 ? neu / total * 100 : 0,
      negPct: total > 0 ? neg / total * 100 : 0,
    };
  }

  // ── Chart.js rendering ─────────────────────────────────────────────────────
  // Renders an offscreen canvas using Chart.js (already loaded in the portal).
  // Returns a Promise<string> (PNG dataURL).

  var _chartCanvasHolder = null;
  function _getHolder() {
    if (!_chartCanvasHolder) {
      _chartCanvasHolder = document.createElement('div');
      _chartCanvasHolder.style.cssText = 'position:fixed;left:-9999px;top:-9999px;visibility:hidden;pointer-events:none';
      document.body.appendChild(_chartCanvasHolder);
    }
    return _chartCanvasHolder;
  }

  function renderBarChart(counts, question, pxW, pxH) {
    return new Promise(function(resolve) {
      var holder = _getHolder();
      var canvas = document.createElement('canvas');
      canvas.width  = pxW;
      canvas.height = pxH;
      holder.appendChild(canvas);

      var labels = ['1','2','3','4','5'];
      var data   = labels.map(function(l){ return counts[parseInt(l)] || 0; });
      var maxVal = Math.max.apply(null, data) || 1;

      // Inline plugin: draw value labels above each bar
      var valueLabelPlugin = {
        id: 'srpValueLabels',
        afterDatasetsDraw: function(chart) {
          var ctx = chart.ctx;
          chart.data.datasets.forEach(function(ds, di) {
            chart.getDatasetMeta(di).data.forEach(function(bar, j) {
              var val = ds.data[j];
              if (val > 0) {
                ctx.save();
                ctx.fillStyle = '#1b3a6b';
                ctx.font = 'bold 14px Inter, system-ui, sans-serif';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'bottom';
                ctx.fillText(val, bar.x, bar.y - 4);
                ctx.restore();
              }
            });
          });
        }
      };

      var chart = new Chart(canvas, {
        type: 'bar',
        data: {
          labels: labels,
          datasets: [{
            data: data,
            backgroundColor: COLOR.barBlue,
            borderRadius: 4,
            borderSkipped: false,
          }]
        },
        options: {
          animation: { duration: 0 },
          responsive: false,
          layout: { padding: { top: 24, bottom: 4, left: 8, right: 8 } },
          plugins: {
            legend: { display: false },
            tooltip: { enabled: false },
          },
          scales: {
            x: {
              grid: { display: false },
              border: { display: false },
              ticks: {
                color: '#374151',
                font: { size: 14, weight: '500' },
              }
            },
            y: {
              display: false,
              beginAtZero: true,
              suggestedMax: maxVal * 1.25,
              grid: { display: false },
            }
          }
        },
        plugins: [valueLabelPlugin]
      });

      // Small delay to ensure afterDatasetsDraw has fired
      setTimeout(function() {
        var url = canvas.toDataURL('image/png');
        chart.destroy();
        if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
        resolve(url);
      }, 80);
    });
  }

  function renderPieChart(counts, pxW, pxH) {
    return new Promise(function(resolve) {
      var holder = _getHolder();
      var canvas = document.createElement('canvas');
      canvas.width  = pxW;
      canvas.height = pxH;
      holder.appendChild(canvas);

      var labels = ['1','2','3','4','5'];
      var data   = labels.map(function(l){ return counts[parseInt(l)] || 0; });
      var total  = data.reduce(function(s,v){ return s+v; }, 0) || 1;

      var chart = new Chart(canvas, {
        type: 'pie',
        data: {
          labels: labels,
          datasets: [{
            data: data,
            backgroundColor: COLOR.pie,
            borderColor: '#ffffff',
            borderWidth: 2,
          }]
        },
        options: {
          animation: { duration: 0 },
          responsive: false,
          layout: { padding: 8 },
          plugins: {
            legend: {
              display: true,
              position: 'right',
              labels: {
                color: '#374151',
                font: { size: 13 },
                padding: 10,
                usePointStyle: true,
                pointStyleWidth: 10,
              }
            },
            tooltip: { enabled: false },
          }
        },
        // Inline plugin: draw % labels inside large slices
        plugins: [{
          id: 'srpPieLabels',
          afterDatasetsDraw: function(chart) {
            var ctx = chart.ctx;
            var meta = chart.getDatasetMeta(0);
            meta.data.forEach(function(arc, i) {
              var val = data[i];
              var pct = val / total * 100;
              if (pct < 5) return; // skip tiny slices
              var mid = (arc.startAngle + arc.endAngle) / 2;
              var r   = (arc.innerRadius + arc.outerRadius) / 2;
              var x   = arc.x + Math.cos(mid) * r;
              var y   = arc.y + Math.sin(mid) * r;
              ctx.save();
              ctx.fillStyle = i >= 3 ? '#ffffff' : '#ffffff';
              ctx.font = 'bold 13px Inter, system-ui, sans-serif';
              ctx.textAlign = 'center';
              ctx.textBaseline = 'middle';
              ctx.fillText(pct.toFixed(1) + '%', x, y);
              ctx.restore();
            });
          }
        }]
      });

      setTimeout(function() {
        var url = canvas.toDataURL('image/png');
        chart.destroy();
        if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
        resolve(url);
      }, 80);
    });
  }

  // ── jsPDF loader (reuses existing portal pattern) ──────────────────────────
  var _libsLoaded = false;
  function loadLibs() {
    return new Promise(function(resolve, reject) {
      if (_libsLoaded && window.jspdf && window.jspdf.jsPDF) { resolve(); return; }
      var s1 = document.createElement('script');
      s1.src = 'https://unpkg.com/jspdf@2.5.1/dist/jspdf.umd.min.js';
      s1.onerror = function() { reject(new Error('Failed to load jsPDF')); };
      s1.onload  = function() {
        var s2 = document.createElement('script');
        s2.src = 'https://unpkg.com/jspdf-autotable@3.8.2/dist/jspdf.plugin.autotable.min.js';
        s2.onerror = function() { reject(new Error('Failed to load jsPDF-autoTable')); };
        s2.onload  = function() { _libsLoaded = true; resolve(); };
        document.head.appendChild(s2);
      };
      document.head.appendChild(s1);
    });
  }

  function triggerDownload(doc, filename) {
    var blob = doc.output('blob');
    var url  = URL.createObjectURL(blob);
    var a    = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function() { URL.revokeObjectURL(url); }, 2000);
  }

  // ── Safe ASCII string for jsPDF Helvetica ─────────────────────────────────
  function safe(s) {
    return String(s || '')
      .replace(/—/g,'-').replace(/–/g,'-')
      .replace(/’/g,"'").replace(/“/g,'"').replace(/”/g,'"')
      .replace(/[^\x20-\x7E\xA0-\xFF]/g,'').trim();
  }

  // ── PDF builder ────────────────────────────────────────────────────────────
  function buildPDF(stuRows, instRows, filterState, chartImages) {
    var jsPDF = window.jspdf.jsPDF;
    var doc   = new jsPDF({ orientation:'portrait', unit:'mm', format:'letter' });

    var PW = 215.9, PH = 279.4;
    var ML = 14, MR = PW - 14, SAFE = MR - ML;
    var FOOTER_H = 9;
    var generated = new Date().toLocaleDateString('en-US', { month:'long', day:'numeric', year:'numeric' });

    // Build filter label
    var filterLabel = '';
    if (filterState.schools.length) {
      filterLabel = filterState.schools.length === 1
        ? 'School: ' + filterState.schools[0]
        : filterState.schools.length + ' schools selected';
    } else if (filterState.districts.length) {
      filterLabel = filterState.districts.length === 1
        ? 'District: ' + filterState.districts[0]
        : filterState.districts.length + ' districts selected';
    } else {
      filterLabel = 'Network Aggregate — All Schools & Districts';
    }

    // ── Footer stamp ────────────────────────────────────────────────────────
    function stampFooters() {
      var total = doc.getNumberOfPages();
      for (var i = 1; i <= total; i++) {
        doc.setPage(i);
        doc.setFillColor.apply(doc, COLOR.navyRGB);
        doc.rect(0, PH - FOOTER_H, PW, FOOTER_H, 'F');
        doc.setFontSize(7);
        doc.setFont('helvetica','normal');
        doc.setTextColor.apply(doc, COLOR.whiteRGB);
        doc.text('New Jersey Tutoring Corps  ·  PEARL Operations Survey Report  ·  Confidential', ML, PH - 3);
        doc.text('Page ' + i + ' of ' + total + '  ·  ' + generated, MR, PH - 3, { align:'right' });
        doc.setTextColor.apply(doc, COLOR.bodyRGB);
      }
    }

    // ── Page header ─────────────────────────────────────────────────────────
    function pageHeader(title, count, subType) {
      // Full-bleed navy banner
      doc.setFillColor.apply(doc, COLOR.navyRGB);
      doc.rect(0, 0, PW, 22, 'F');

      // Title
      doc.setFontSize(16);
      doc.setFont('helvetica','bold');
      doc.setTextColor.apply(doc, COLOR.whiteRGB);
      doc.text(safe(title), ML, 14);

      // Count badge on right
      var countStr = count.toLocaleString() + ' responses';
      doc.setFontSize(8.5);
      doc.setFont('helvetica','normal');
      doc.text(safe(countStr), MR, 9, { align:'right' });

      // Filter context
      doc.setFontSize(8);
      doc.text(safe(filterLabel), MR, 15, { align:'right' });

      // Sub-header strip
      doc.setFillColor(237, 242, 247);
      doc.rect(0, 22, PW, 8, 'F');
      doc.setFontSize(7.5);
      doc.setFont('helvetica','italic');
      doc.setTextColor.apply(doc, COLOR.mutedRGB);
      doc.text(safe('SY 2025–2026  ·  ' + subType + '  ·  Likert Scale: 4–5 = Positive, 3 = Neutral, 1–2 = Negative'), ML, 27.5);
      doc.setTextColor.apply(doc, COLOR.bodyRGB);
      doc.setFont('helvetica','normal');
    }

    // ── Sentiment horizontal bar section ────────────────────────────────────
    // y = top of section, returns y after section
    function sentimentSection(y, sentiment, showNegative) {
      var sectionH = showNegative ? 52 : 42;
      // Section background
      doc.setFillColor(255,255,255);
      doc.roundedRect(ML, y, SAFE, sectionH, 3, 3, 'F');
      doc.setDrawColor(220, 228, 240);
      doc.setLineWidth(0.4);
      doc.roundedRect(ML, y, SAFE, sectionH, 3, 3, 'S');

      var barAreaW = SAFE * 0.60;  // left 60% for bars
      var infoW    = SAFE * 0.36;
      var infoX    = ML + SAFE * 0.63;
      var pad      = 4;
      var barX     = ML + pad + 28; // label takes ~28mm
      var barW     = barAreaW - 32;
      var barH     = 9;
      var yOff     = y + 9;

      // Draw info box (right side)
      doc.setFillColor(26, 58, 107);
      doc.roundedRect(infoX, y + 3, infoW, sectionH - 6, 3, 3, 'F');
      doc.setFontSize(9);
      doc.setFont('helvetica','bold');
      doc.setTextColor.apply(doc, COLOR.whiteRGB);
      var infoTitle = showNegative ? 'Scholar Enjoyment Surveys:' : 'Scholar Engagement Surveys:';
      doc.text(safe(infoTitle), infoX + 4, y + 10);
      doc.setFontSize(7.5);
      doc.setFont('helvetica','normal');
      var infoLines = doc.splitTextToSize(
        showNegative
          ? 'The chart displays the % of scholar surveys rated Positive (4-5), Neutral (3), or Negative (1-2) based on the Overall session score.'
          : 'The chart displays the % of tutor surveys rated Positive (4-5) or Neutral (3) based on the Overall session score.',
        infoW - 8
      );
      var infoY = y + 17;
      infoLines.forEach(function(line) {
        doc.text(safe(line), infoX + 4, infoY);
        infoY += 5;
      });
      doc.setTextColor.apply(doc, COLOR.bodyRGB);

      // Color legend chips
      var legendItems = showNegative
        ? [['Positive', COLOR.greenRGB], ['Neutral', COLOR.neutralRGB], ['Negative', COLOR.redRGB]]
        : [['Positive', COLOR.greenRGB], ['Neutral', COLOR.neutralRGB]];
      var lx = ML + pad;
      legendItems.forEach(function(item) {
        doc.setFillColor.apply(doc, item[1]);
        doc.roundedRect(lx, y + 2, 3, 3, 0.5, 0.5, 'F');
        doc.setFontSize(7);
        doc.setFont('helvetica','normal');
        doc.setTextColor.apply(doc, COLOR.mutedRGB);
        doc.text(safe(item[0]), lx + 4.5, y + 4.8);
        lx += 20;
      });
      doc.setTextColor.apply(doc, COLOR.bodyRGB);

      // Draw bars
      var rows_config = showNegative
        ? [
            { label:'Positive', pct: sentiment.posPct, clr: COLOR.greenRGB },
            { label:'Neutral',  pct: sentiment.neuPct, clr: COLOR.neutralRGB },
            { label:'Negative', pct: sentiment.negPct, clr: COLOR.redRGB },
          ]
        : [
            { label:'Positive', pct: sentiment.posPct, clr: COLOR.greenRGB },
            { label:'Neutral',  pct: sentiment.neuPct, clr: COLOR.neutralRGB },
          ];

      rows_config.forEach(function(row) {
        var fillW = (row.pct / 100) * barW;
        // Track background
        doc.setFillColor(235, 240, 245);
        doc.roundedRect(barX, yOff, barW, barH, 2, 2, 'F');
        // Colored fill
        if (fillW > 0) {
          doc.setFillColor.apply(doc, row.clr);
          doc.roundedRect(barX, yOff, Math.max(fillW, 0.1), barH, 2, 2, 'F');
        }
        // Label left
        doc.setFontSize(8);
        doc.setFont('helvetica','bold');
        doc.setTextColor.apply(doc, COLOR.bodyRGB);
        doc.text(safe(row.label), ML + pad, yOff + 6.2);
        // Percentage inside/after bar
        var pctStr = row.pct.toFixed(2) + '%';
        doc.setFontSize(8);
        doc.setFont('helvetica','bold');
        doc.setTextColor(255,255,255);
        if (fillW > 14) {
          doc.text(safe(pctStr), barX + fillW - 2, yOff + 6.2, { align:'right' });
        } else {
          doc.setTextColor.apply(doc, COLOR.bodyRGB);
          doc.text(safe(pctStr), barX + fillW + 2, yOff + 6.2);
        }
        doc.setTextColor.apply(doc, COLOR.bodyRGB);
        yOff += barH + 4;
      });

      return y + sectionH + 6;
    }

    // ── 2×2 chart grid ───────────────────────────────────────────────────────
    // imgs = [topLeft, topRight, bottomLeft, bottomRight]
    // labels = matching question strings
    function chartGrid(y, imgs, labels) {
      var colW  = (SAFE - 5) / 2;
      var imgH  = 52;
      var titleH = 8;
      var cellH  = titleH + imgH + 4;
      var rowGap = 5;
      var BOTTOM_LIMIT = PH - FOOTER_H - 10;

      [[0,1],[2,3]].forEach(function(pair, row) {
        if (y + cellH > BOTTOM_LIMIT) { doc.addPage(); y = 16; }
        pair.forEach(function(idx, col) {
          var cx = ML + col * (colW + 5);

          // Card background
          doc.setFillColor(255,255,255);
          doc.roundedRect(cx, y, colW, cellH, 3, 3, 'F');
          doc.setDrawColor(220, 228, 240);
          doc.setLineWidth(0.35);
          doc.roundedRect(cx, y, colW, cellH, 3, 3, 'S');

          // Question label
          doc.setFontSize(7.5);
          doc.setFont('helvetica','bold');
          doc.setTextColor.apply(doc, COLOR.navyRGB);
          var wrapped = doc.splitTextToSize(safe(labels[idx] || ''), colW - 6);
          var labelY = y + 5.5;
          wrapped.slice(0,2).forEach(function(line) {
            doc.text(line, cx + 3, labelY);
            labelY += 4;
          });
          doc.setTextColor.apply(doc, COLOR.bodyRGB);

          // Chart image
          if (imgs[idx]) {
            try {
              doc.addImage(imgs[idx], 'PNG', cx + 1, y + titleH, colW - 2, imgH);
            } catch(e) { /* skip if image fails */ }
          }
        });
        y += cellH + rowGap;
      });
      return y;
    }

    // ══════════════════════════════════════════════════════════════════════════
    // PAGE 1 — SCHOLAR SURVEY DETAILS
    // ══════════════════════════════════════════════════════════════════════════
    var stuSentiment = sentimentPct(stuRows, STU.OVERALL);
    pageHeader('Scholar Survey Details', stuSentiment.total, 'Scholar Surveys');

    var y = 33;
    y = sentimentSection(y, stuSentiment, true);

    // Chart images (passed in)
    var stuLabels = [
      'How much did you enjoy this session with the tutor?',
      'Overall, how did this tutoring session go?',
      'How much do you think you learned this session?',
      'How confident are you that you understood the material?',
    ];
    chartGrid(y, chartImages.stu, stuLabels);

    // ══════════════════════════════════════════════════════════════════════════
    // PAGE 2 — TUTOR SURVEY DETAILS
    // ══════════════════════════════════════════════════════════════════════════
    doc.addPage();
    var instSentiment = sentimentPct(instRows, INST.OVERALL);
    pageHeader('Tutor Survey Details', instSentiment.total, 'Tutor Surveys');

    y = 33;
    y = sentimentSection(y, instSentiment, false);

    var instLabels = [
      'How engaged were the scholars during this session?',
      'Overall, how did this tutoring session go?',
      'How much did you enjoy the session with these scholars?',
      'How much do you think the scholars learned during this session?',
    ];
    chartGrid(y, chartImages.inst, instLabels);

    stampFooters();
    return doc;
  }

  // ── Main generate function ─────────────────────────────────────────────────
  async function generate() {
    // Validate Pearl data is loaded
    if (!window.po || typeof window.po.isDataLoaded !== 'function' || !window.po.isDataLoaded()) {
      alert('Pearl data is still loading. Please wait for the sync to complete and try again.');
      return;
    }

    // Resolve filtered rows from live Pearl data
    var stuRows  = window.po.getFilteredStuRows  ? window.po.getFilteredStuRows()  : window.po.getStuRows();
    var instRows = window.po.getFilteredInstRows ? window.po.getFilteredInstRows() : window.po.getInstRows();
    var filterState = window.po.getFilterState ? window.po.getFilterState() : { districts:[], schools:[] };

    if (!stuRows.length && !instRows.length) {
      alert('No survey data available for the current filter selection. Try selecting different schools or clearing all filters.');
      return;
    }

    // Show loading state on the button
    var btn = document.getElementById('btnSurveyReportPDF');
    var origText = '';
    if (btn) { origText = btn.innerHTML; btn.innerHTML = '⏳ Generating…'; btn.disabled = true; }

    try {
      // Compute distributions for all questions
      var STU_CHART_COLS  = [STU.ENJOYMENT,  STU.OVERALL,  STU.LEARNING,  STU.CONFIDENCE];
      var INST_CHART_COLS = [INST.ENGAGEMENT, INST.OVERALL, INST.ENJOYMENT, INST.LEARNING];

      var PX_W = 480, PX_H = 300;

      // Render all 8 charts concurrently
      var stuChartPromises  = STU_CHART_COLS.map(function(col, i) {
        var counts = likertCounts(stuRows, col);
        return i === 1 ? renderPieChart(counts, PX_W, PX_H) : renderBarChart(counts, null, PX_W, PX_H);
      });
      var instChartPromises = INST_CHART_COLS.map(function(col, i) {
        var counts = likertCounts(instRows, col);
        return i === 1 ? renderPieChart(counts, PX_W, PX_H) : renderBarChart(counts, null, PX_W, PX_H);
      });

      var allCharts  = await Promise.all([...stuChartPromises, ...instChartPromises]);
      var chartImages = {
        stu:  allCharts.slice(0, 4),
        inst: allCharts.slice(4, 8),
      };

      await loadLibs();

      var doc = buildPDF(stuRows, instRows, filterState, chartImages);

      // Generate filename with filter context
      var scope = filterState.schools.length === 1
        ? filterState.schools[0].replace(/[^a-z0-9]/gi,'_').slice(0,30)
        : filterState.districts.length === 1
          ? filterState.districts[0].replace(/[^a-z0-9]/gi,'_').slice(0,30)
          : 'Network';
      var dateStr = new Date().toISOString().slice(0,10);
      triggerDownload(doc, 'NJTC_Survey_Report_' + scope + '_' + dateStr + '.pdf');

    } catch (err) {
      console.error('[Survey Report PDF]', err);
      alert('Error generating PDF: ' + err.message + '\n\nPlease try again.');
    } finally {
      if (btn) { btn.innerHTML = origText; btn.disabled = false; }
    }
  }

  window.njtcSurveyPDF = { generate: generate };
})();
