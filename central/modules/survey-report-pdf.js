// ─────────────────────────────────────────────────────────────────────────────
// NJTC Survey Report PDF — Scholar & Tutor Likert Dashboard
// Replicates the Data Studio visual layout: sentiment bars + bar/pie charts
// Pulls COMPLETE live data from window.po — blocks generation until the
// scholar survey stream finishes (_stuStreamComplete = true).
// ─────────────────────────────────────────────────────────────────────────────
(function () {
  'use strict';

  // ── Column indexes (mirror programming.js STU_S / INST_S) ─────────────────
  const STU  = { CONFIDENCE:2, ENJOYMENT:3, LEARNING:4, OVERALL:5, SCHOOL:8, DISTRICT:9 };
  const INST = { ENGAGEMENT:2, ENJOYMENT:3, LEARNING:4, OVERALL:5, SCHOOL:9, DISTRICT:10 };

  // ── Brand palette ──────────────────────────────────────────────────────────
  const C = {
    navyRGB:    [10,  35,  66],
    barBlue:    '#1b3a6b',
    greenRGB:   [46,  125,  50],
    grayRGB:    [120, 120, 120],
    redRGB:     [198,  40,  40],
    whiteRGB:   [255, 255, 255],
    mutedRGB:   [107, 114, 128],
    bodyRGB:    [ 45,  45,  45],
    // Pie chart: colors for scores 1–5 (dark→light grey then blue shades)
    pie: ['#3d3d3d', '#757575', '#b0bec5', '#1565c0', '#0a2342'],
  };

  // ── Data helpers ───────────────────────────────────────────────────────────
  function safeN(v) { var n = parseFloat(v); return isNaN(n) ? null : n; }

  function likertCounts(rows, col) {
    var c = { 1:0, 2:0, 3:0, 4:0, 5:0 };
    for (var i = 0; i < rows.length; i++) {
      var v = Math.round(safeN(rows[i][col]));
      if (v >= 1 && v <= 5) c[v]++;
    }
    return c;
  }

  // Classify OVERALL score per row: 4-5 = positive, 3 = neutral, 1-2 = negative
  function sentiment(rows, col) {
    var pos = 0, neu = 0, neg = 0;
    for (var i = 0; i < rows.length; i++) {
      var v = safeN(rows[i][col]);
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

  // ── Chart.js canvas rendering ──────────────────────────────────────────────
  var _holder = null;
  function getHolder() {
    if (!_holder) {
      _holder = document.createElement('div');
      _holder.style.cssText = 'position:fixed;left:-9999px;top:-9999px;visibility:hidden;pointer-events:none;z-index:-1';
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
      var data   = labels.map(function(l) { return counts[parseInt(l)] || 0; });
      var maxVal = Math.max.apply(null, data) || 1;

      var labelPlugin = {
        id: 'srpBarLabels',
        afterDatasetsDraw: function(chart) {
          var ctx = chart.ctx;
          chart.data.datasets.forEach(function(ds, di) {
            chart.getDatasetMeta(di).data.forEach(function(bar, j) {
              var val = ds.data[j];
              if (val > 0) {
                ctx.save();
                ctx.fillStyle = C.barBlue;
                ctx.font = 'bold 14px system-ui, sans-serif';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'bottom';
                ctx.fillText(val.toLocaleString(), bar.x, bar.y - 4);
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
            backgroundColor: C.barBlue,
            borderRadius: 4,
            borderSkipped: false,
          }]
        },
        options: {
          animation: { duration: 0 },
          responsive: false,
          layout: { padding: { top: 26, bottom: 4, left: 10, right: 10 } },
          plugins: { legend: { display: false }, tooltip: { enabled: false } },
          scales: {
            x: {
              grid: { display: false },
              border: { display: false },
              ticks: { color: '#374151', font: { size: 14, weight: '500' } }
            },
            y: {
              display: false,
              beginAtZero: true,
              suggestedMax: maxVal * 1.28,
              grid: { display: false },
            }
          }
        },
        plugins: [labelPlugin]
      });

      setTimeout(function() {
        var url = canvas.toDataURL('image/png');
        chart.destroy();
        if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
        resolve(url);
      }, 100);
    });
  }

  function renderPieChart(counts, pxW, pxH) {
    return new Promise(function(resolve) {
      var canvas = document.createElement('canvas');
      canvas.width = pxW; canvas.height = pxH;
      getHolder().appendChild(canvas);

      var labels = ['1','2','3','4','5'];
      var data   = labels.map(function(l) { return counts[parseInt(l)] || 0; });
      var total  = data.reduce(function(s, v) { return s + v; }, 0) || 1;

      var piePlugin = {
        id: 'srpPieLabels',
        afterDatasetsDraw: function(chart) {
          var ctx = chart.ctx;
          chart.getDatasetMeta(0).data.forEach(function(arc, i) {
            var pct = data[i] / total * 100;
            if (pct < 4) return;
            var mid = (arc.startAngle + arc.endAngle) / 2;
            var r   = (arc.outerRadius) * 0.62;
            var x   = arc.x + Math.cos(mid) * r;
            var y   = arc.y + Math.sin(mid) * r;
            ctx.save();
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 13px system-ui, sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(pct.toFixed(1) + '%', x, y);
            ctx.restore();
          });
        }
      };

      var chart = new Chart(canvas, {
        type: 'pie',
        data: {
          labels: labels,
          datasets: [{
            data: data,
            backgroundColor: C.pie,
            borderColor: '#ffffff',
            borderWidth: 2,
          }]
        },
        options: {
          animation: { duration: 0 },
          responsive: false,
          layout: { padding: 6 },
          plugins: {
            legend: {
              display: true, position: 'right',
              labels: {
                color: '#374151', font: { size: 13 }, padding: 10,
                usePointStyle: true, pointStyleWidth: 10,
              }
            },
            tooltip: { enabled: false },
          }
        },
        plugins: [piePlugin]
      });

      setTimeout(function() {
        var url = canvas.toDataURL('image/png');
        chart.destroy();
        if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
        resolve(url);
      }, 100);
    });
  }

  // ── jsPDF loader ───────────────────────────────────────────────────────────
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
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(function() { URL.revokeObjectURL(url); }, 2000);
  }

  function safe(s) {
    return String(s || '')
      .replace(/—/g,'-').replace(/–/g,'-')
      .replace(/’/g,"'").replace(/“/g,'"').replace(/”/g,'"')
      .replace(/[^\x20-\x7E\xA0-\xFF]/g,'').trim();
  }

  // ── Loading overlay ────────────────────────────────────────────────────────
  function showOverlay(msg) {
    var el = document.getElementById('_srpOverlay');
    if (!el) {
      el = document.createElement('div');
      el.id = '_srpOverlay';
      el.style.cssText = [
        'position:fixed;inset:0;z-index:99999;display:flex;flex-direction:column',
        'align-items:center;justify-content:center;gap:1rem',
        'background:rgba(10,35,66,.82);backdrop-filter:blur(4px)',
      ].join(';');
      document.body.appendChild(el);
    }
    el.innerHTML = [
      '<div style="width:52px;height:52px;border:4px solid rgba(255,255,255,.25);',
      'border-top-color:#fff;border-radius:50%;animation:srpSpin .8s linear infinite"></div>',
      '<div style="color:#fff;font-family:system-ui,sans-serif;font-size:1rem;font-weight:600;text-align:center;max-width:340px;line-height:1.5">',
      safe(msg), '</div>',
    ].join('');
    if (!document.getElementById('_srpKeyframes')) {
      var st = document.createElement('style');
      st.id = '_srpKeyframes';
      st.textContent = '@keyframes srpSpin{to{transform:rotate(360deg)}}';
      document.head.appendChild(st);
    }
    el.style.display = 'flex';
  }

  function updateOverlay(msg) {
    var el = document.getElementById('_srpOverlay');
    if (el) {
      var txt = el.querySelector('div:last-child');
      if (txt) txt.textContent = safe(msg);
    }
  }

  function hideOverlay() {
    var el = document.getElementById('_srpOverlay');
    if (el) el.style.display = 'none';
  }

  // ── Wait for scholar stream to complete (polls _stuStreamComplete) ──────────
  // maxWaitMs: how long to wait before letting user proceed anyway
  function waitForStream(po, maxWaitMs, onTick) {
    return new Promise(function(resolve) {
      if (!po.isSurveyDataComplete || po.isSurveyDataComplete()) { resolve(true); return; }

      var elapsed = 0;
      var interval = 600;

      var t = setInterval(function() {
        elapsed += interval;
        var counts = po.getSurveyRowCounts ? po.getSurveyRowCounts() : null;
        if (onTick && counts) onTick(counts, elapsed);

        if (po.isSurveyDataComplete()) {
          clearInterval(t);
          resolve(true);
          return;
        }
        if (elapsed >= maxWaitMs) {
          clearInterval(t);
          resolve(false);  // timed out — caller decides whether to proceed
        }
      }, interval);
    });
  }

  // ── PDF builder ────────────────────────────────────────────────────────────
  function buildPDF(stuRows, instRows, filterState, chartImgs) {
    var jsPDF  = window.jspdf.jsPDF;
    var doc    = new jsPDF({ orientation:'portrait', unit:'mm', format:'letter' });
    var PW = 215.9, PH = 279.4;
    var ML = 14, MR = PW - 14, SW = MR - ML;  // SW = safe width
    var FOOT = 9;
    var generated = new Date().toLocaleDateString('en-US', { month:'long', day:'numeric', year:'numeric' });

    // Filter scope label
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
      scopeLabel = 'Network Aggregate — All Schools & Districts';
    }

    // ── Footer (two-pass) ───────────────────────────────────────────────────
    function stampFooters() {
      var n = doc.getNumberOfPages();
      for (var i = 1; i <= n; i++) {
        doc.setPage(i);
        doc.setFillColor.apply(doc, C.navyRGB);
        doc.rect(0, PH - FOOT, PW, FOOT, 'F');
        doc.setFontSize(7); doc.setFont('helvetica','normal');
        doc.setTextColor.apply(doc, C.whiteRGB);
        doc.text('New Jersey Tutoring Corps  ·  PEARL Operations Survey Report  ·  Confidential', ML, PH - 3);
        doc.text('Page ' + i + ' of ' + n + '  ·  ' + generated, MR, PH - 3, { align:'right' });
        doc.setTextColor.apply(doc, C.bodyRGB);
      }
    }

    // ── Page header ─────────────────────────────────────────────────────────
    function pageHeader(title, responseCount, surveyType) {
      doc.setFillColor.apply(doc, C.navyRGB);
      doc.rect(0, 0, PW, 23, 'F');

      doc.setFontSize(16); doc.setFont('helvetica','bold');
      doc.setTextColor.apply(doc, C.whiteRGB);
      doc.text(safe(title), ML, 15);

      doc.setFontSize(8.5); doc.setFont('helvetica','normal');
      doc.text(safe(responseCount.toLocaleString() + ' responses'), MR, 9.5, { align:'right' });
      doc.setFontSize(8);
      doc.text(safe(scopeLabel), MR, 16, { align:'right' });

      // Sub-strip
      doc.setFillColor(237, 242, 247);
      doc.rect(0, 23, PW, 8, 'F');
      doc.setFontSize(7.5); doc.setFont('helvetica','italic');
      doc.setTextColor.apply(doc, C.mutedRGB);
      doc.text(safe('SY 2025-2026  ·  ' + surveyType + '  ·  Likert Scale: 4-5 = Positive, 3 = Neutral, 1-2 = Negative'), ML, 28);
      doc.setTextColor.apply(doc, C.bodyRGB); doc.setFont('helvetica','normal');
    }

    // ── Sentiment bars section ──────────────────────────────────────────────
    // Always draws all 3 bars (Positive / Neutral / Negative) for both survey types.
    // infoTitle / infoBody: right-side description box content
    function sentimentSection(y, sent, infoTitle, infoBody) {
      var sH = 57;
      doc.setFillColor(255,255,255);
      doc.roundedRect(ML, y, SW, sH, 3, 3, 'F');
      doc.setDrawColor(220, 228, 240); doc.setLineWidth(0.4);
      doc.roundedRect(ML, y, SW, sH, 3, 3, 'S');

      var bAreaW = SW * 0.60;
      var infoW  = SW * 0.36;
      var infoX  = ML + SW * 0.63;
      var pad    = 4;
      var barX   = ML + pad + 26;
      var barW   = bAreaW - 30;
      var barH   = 9.5;
      var yy     = y + 8;

      // Info box
      doc.setFillColor(26, 58, 107);
      doc.roundedRect(infoX, y + 3, infoW, sH - 6, 3, 3, 'F');
      doc.setFontSize(8.5); doc.setFont('helvetica','bold');
      doc.setTextColor.apply(doc, C.whiteRGB);
      doc.text(safe(infoTitle), infoX + 4, y + 10.5);
      doc.setFontSize(7.5); doc.setFont('helvetica','normal');
      var lines = doc.splitTextToSize(safe(infoBody), infoW - 8);
      var ly = y + 17;
      lines.forEach(function(l) { doc.text(l, infoX + 4, ly); ly += 4.8; });
      doc.setTextColor.apply(doc, C.bodyRGB);

      // Legend chips
      var chips = [
        { label:'Positive', rgb: C.greenRGB },
        { label:'Neutral',  rgb: C.grayRGB  },
        { label:'Negative', rgb: C.redRGB   },
      ];
      var lx = ML + pad;
      chips.forEach(function(ch) {
        doc.setFillColor.apply(doc, ch.rgb);
        doc.roundedRect(lx, y + 1.5, 3, 3, 0.5, 0.5, 'F');
        doc.setFontSize(6.5); doc.setFont('helvetica','normal');
        doc.setTextColor.apply(doc, C.mutedRGB);
        doc.text(safe(ch.label), lx + 4.5, y + 4.3);
        lx += 20;
      });
      doc.setTextColor.apply(doc, C.bodyRGB);

      // 3 bars — always rendered for both pages
      var bars = [
        { label:'Positive', pct: sent.posPct, rgb: C.greenRGB },
        { label:'Neutral',  pct: sent.neuPct, rgb: C.grayRGB  },
        { label:'Negative', pct: sent.negPct, rgb: C.redRGB   },
      ];
      bars.forEach(function(b) {
        var fw = (b.pct / 100) * barW;
        // Track
        doc.setFillColor(232, 238, 245);
        doc.roundedRect(barX, yy, barW, barH, 2, 2, 'F');
        // Fill
        if (fw > 0.5) {
          doc.setFillColor.apply(doc, b.rgb);
          doc.roundedRect(barX, yy, fw, barH, 2, 2, 'F');
        }
        // Row label
        doc.setFontSize(8); doc.setFont('helvetica','bold');
        doc.setTextColor.apply(doc, C.bodyRGB);
        doc.text(safe(b.label), ML + pad, yy + 6.7);
        // Pct label — inside bar if wide enough, outside if narrow
        var pStr = b.pct.toFixed(2) + '%';
        doc.setFontSize(7.5); doc.setFont('helvetica','bold');
        if (fw > 16) {
          doc.setTextColor(255,255,255);
          doc.text(safe(pStr), barX + fw - 2.5, yy + 6.7, { align:'right' });
        } else {
          doc.setTextColor.apply(doc, C.bodyRGB);
          doc.text(safe(pStr), barX + Math.max(fw, 0) + 2, yy + 6.7);
        }
        doc.setTextColor.apply(doc, C.bodyRGB);
        yy += barH + 4;
      });

      return y + sH + 6;
    }

    // ── 2×2 chart grid ───────────────────────────────────────────────────────
    function chartGrid(startY, imgs, labels) {
      var colW  = (SW - 5) / 2;
      var imgH  = 54;
      var lblH  = 9;
      var cellH = lblH + imgH + 3;
      var BLIM  = PH - FOOT - 10;

      var y = startY;
      [[0,1],[2,3]].forEach(function(pair) {
        if (y + cellH > BLIM) { doc.addPage(); y = 16; }
        pair.forEach(function(idx, col) {
          var cx = ML + col * (colW + 5);
          doc.setFillColor(255,255,255);
          doc.roundedRect(cx, y, colW, cellH, 3, 3, 'F');
          doc.setDrawColor(220, 228, 240); doc.setLineWidth(0.35);
          doc.roundedRect(cx, y, colW, cellH, 3, 3, 'S');

          // Question label
          doc.setFontSize(7.5); doc.setFont('helvetica','bold');
          doc.setTextColor.apply(doc, C.navyRGB);
          var wrapped = doc.splitTextToSize(safe(labels[idx] || ''), colW - 6);
          var lY = y + 5.5;
          wrapped.slice(0,2).forEach(function(line) { doc.text(line, cx + 3, lY); lY += 4; });
          doc.setTextColor.apply(doc, C.bodyRGB);

          if (imgs[idx]) {
            try { doc.addImage(imgs[idx], 'PNG', cx + 1, y + lblH, colW - 2, imgH); }
            catch(e) { /* image failed — leave blank */ }
          }
        });
        y += cellH + 5;
      });
    }

    // ══════════════════════════════════════════════════════════════════════════
    // PAGE 1 — SCHOLAR SURVEY DETAILS
    // ══════════════════════════════════════════════════════════════════════════
    var stuSent = sentiment(stuRows, STU.OVERALL);
    pageHeader('Scholar Survey Details', stuSent.total, 'Scholar Surveys');

    var y = 34;
    y = sentimentSection(
      y, stuSent,
      'Scholar Enjoyment Surveys:',
      'The chart displays the % of scholar surveys rated Positive (4-5), Neutral (3), or Negative (1-2) based on the Overall session score.'
    );

    chartGrid(y, chartImgs.stu, [
      'How much did you enjoy this session with the tutor?',
      'Overall, how did this tutoring session go?',
      'How much do you think you learned this session?',
      'How confident are you that you understood the material?',
    ]);

    // ══════════════════════════════════════════════════════════════════════════
    // PAGE 2 — TUTOR SURVEY DETAILS
    // ══════════════════════════════════════════════════════════════════════════
    doc.addPage();
    var instSent = sentiment(instRows, INST.OVERALL);
    pageHeader('Tutor Survey Details', instSent.total, 'Tutor Surveys');

    y = 34;
    y = sentimentSection(
      y, instSent,
      'Scholar Engagement Surveys:',
      'The chart displays the % of tutor surveys rated Positive (4-5), Neutral (3), or Negative (1-2) based on the tutor\'s Overall session score.'
    );

    chartGrid(y, chartImgs.inst, [
      'How engaged were the scholars during this session?',
      'Overall, how did this tutoring session go?',
      'How much did you enjoy the session with these scholars?',
      'How much do you think the scholars learned during this session?',
    ]);

    stampFooters();
    return doc;
  }

  // ── Main entry point ───────────────────────────────────────────────────────
  async function generate() {
    var po = window.po;
    if (!po || typeof po.isDataLoaded !== 'function' || !po.isDataLoaded()) {
      alert('Pearl data has not loaded yet. Please wait for the sync to complete (check the status indicator at the top of the Pearl Operations panel).');
      return;
    }

    // ── Step 1: Wait for complete scholar survey stream ──────────────────────
    // Scholar surveys stream progressively from a large CSV. We must wait for
    // _stuStreamComplete = true before generating to avoid partial data.
    var isComplete = po.isSurveyDataComplete ? po.isSurveyDataComplete() : true;

    if (!isComplete) {
      var counts0 = po.getSurveyRowCounts ? po.getSurveyRowCounts() : {};
      showOverlay(
        'Completing scholar survey data load...\n' +
        (counts0.scholar || 0).toLocaleString() + ' scholar survey rows loaded so far.\n' +
        'This ensures 100% data accuracy.'
      );

      isComplete = await waitForStream(po, 45000, function(counts, ms) {
        updateOverlay(
          'Completing scholar survey data load...\n' +
          counts.scholar.toLocaleString() + ' scholar survey rows (' + Math.round(ms/1000) + 's).\n' +
          'Ensuring 100% accuracy before generating.'
        );
      });

      if (!isComplete) {
        // Stream timed out — ask user whether to proceed with available data
        hideOverlay();
        var counts1 = po.getSurveyRowCounts ? po.getSurveyRowCounts() : {};
        var ok = window.confirm(
          'The scholar survey stream is taking longer than expected.\n\n' +
          'Currently loaded: ' + (counts1.scholar || 0).toLocaleString() + ' scholar survey rows.\n\n' +
          'You can:\n' +
          '  • Click OK to generate with available data (may be incomplete)\n' +
          '  • Click Cancel, then use the "Refresh" button to re-sync data, then try again\n\n' +
          'For full accuracy, cancel and try after the sync indicator shows "Live".'
        );
        if (!ok) return;
      }
    }

    updateOverlay('Applying filters and computing distributions…');
    showOverlay('Applying filters and computing distributions…');

    // ── Step 2: Get filtered rows ────────────────────────────────────────────
    var stuRows  = po.getFilteredStuRows  ? po.getFilteredStuRows()  : po.getStuRows();
    var instRows = po.getFilteredInstRows ? po.getFilteredInstRows() : po.getInstRows();
    var filterState = po.getFilterState ? po.getFilterState() : { districts:[], schools:[] };

    if (!stuRows.length && !instRows.length) {
      hideOverlay();
      alert('No survey data found for the current filter. Clear the filters to generate a network-wide report, or select different schools/districts.');
      return;
    }

    // Log counts for transparency
    console.log('[Survey Report PDF] Rows used — scholar:', stuRows.length, 'tutor:', instRows.length,
      '| Filter:', JSON.stringify(filterState));

    try {
      // ── Step 3: Render charts ──────────────────────────────────────────────
      updateOverlay('Rendering charts from ' + stuRows.length.toLocaleString() + ' scholar and ' + instRows.length.toLocaleString() + ' tutor responses…');

      var PX = { W: 500, H: 310 };

      var STU_COLS  = [STU.ENJOYMENT, STU.OVERALL, STU.LEARNING, STU.CONFIDENCE];
      var INST_COLS = [INST.ENGAGEMENT, INST.OVERALL, INST.ENJOYMENT, INST.LEARNING];

      var stuPromises  = STU_COLS.map(function(col, i) {
        return i === 1
          ? renderPieChart(likertCounts(stuRows, col), PX.W, PX.H)
          : renderBarChart(likertCounts(stuRows, col), PX.W, PX.H);
      });
      var instPromises = INST_COLS.map(function(col, i) {
        return i === 1
          ? renderPieChart(likertCounts(instRows, col), PX.W, PX.H)
          : renderBarChart(likertCounts(instRows, col), PX.W, PX.H);
      });

      var all = await Promise.all(stuPromises.concat(instPromises));
      var chartImgs = { stu: all.slice(0,4), inst: all.slice(4,8) };

      // ── Step 4: Build PDF ──────────────────────────────────────────────────
      updateOverlay('Assembling PDF…');
      await loadLibs();

      var doc = buildPDF(stuRows, instRows, filterState, chartImgs);

      // Filename
      var scope = filterState.schools.length === 1
        ? filterState.schools[0].replace(/[^a-z0-9]/gi,'_').slice(0,30)
        : filterState.districts.length === 1
          ? filterState.districts[0].replace(/[^a-z0-9]/gi,'_').slice(0,30)
          : 'Network';
      triggerDownload(doc, 'NJTC_Survey_Report_' + scope + '_' + new Date().toISOString().slice(0,10) + '.pdf');

    } catch(err) {
      console.error('[Survey Report PDF]', err);
      alert('Error generating the survey report: ' + err.message + '\n\nPlease try again.');
    } finally {
      hideOverlay();
    }
  }

  window.njtcSurveyPDF = { generate: generate };
})();
