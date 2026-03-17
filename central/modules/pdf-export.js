// ─────────────────────────────────────────────────────────────────────────────
// NJTC Pearl Ops — PDF Export  (v2)
// 9-page downloadable reports: NE Region | SW Region | Network Aggregate
// jsPDF 2.5.1 + jsPDF-AutoTable 3.8.2 loaded on demand from unpkg.com (no Cloudflare)
// PC/Mac download safe: revokeObjectURL delayed 2 s to avoid Windows AV freeze.
// ─────────────────────────────────────────────────────────────────────────────
(function () {
  'use strict';

  // ── Brand palette (RGB arrays for jsPDF) ──────────────────────────────────
  const C = {
    navy:    [26,  46,  74],
    teal:    [42, 157, 143],
    amber:   [233,196, 106],
    red:     [231,111,  81],
    green:   [ 82,183,136],
    white:   [255,255,255],
    light:   [247,249,252],
    mid:     [180,190,200],
    body:    [ 45, 45, 45],
    muted:   [107,114,128],
  };

  // ── Benchmarks ────────────────────────────────────────────────────────────
  const BM = { scholAtt: 85, tutorAtt: 90, hit: 95, survey: 80, capture: 80 };

  // ── Status color helper ───────────────────────────────────────────────────
  function statusColor(rate, benchmark) {
    if (rate == null || isNaN(rate)) return C.mid;
    if (rate >= benchmark)           return C.green;
    if (rate >= benchmark - 5)       return C.amber;
    return C.red;
  }

  // ── Format helpers ────────────────────────────────────────────────────────
  function fmt(n, d) {
    if (n == null || isNaN(n)) return '—';
    return parseFloat(n).toFixed(d === undefined ? 0 : d);
  }
  function pct(n, d) { return (n == null || isNaN(n)) ? '—' : fmt(n, d === undefined ? 1 : d) + '%'; }
  function num(n)    { return (n == null)              ? '—' : Number(n).toLocaleString(); }
  function hrs(n)    { return (n == null || isNaN(n))  ? '—' : parseFloat(n).toFixed(1) + 'h'; }

  // ── jsPDF library loader ──────────────────────────────────────────────────
  let _libsLoaded = false;
  function loadLibs() {
    return new Promise((resolve, reject) => {
      if (_libsLoaded && window.jspdf && window.jspdf.jsPDF) { resolve(); return; }
      const s1 = document.createElement('script');
      s1.src = 'https://unpkg.com/jspdf@2.5.1/dist/jspdf.umd.min.js';
      s1.onerror = () => reject(new Error('Failed to load jsPDF from unpkg.com'));
      s1.onload  = () => {
        const s2 = document.createElement('script');
        s2.src = 'https://unpkg.com/jspdf-autotable@3.8.2/dist/jspdf.plugin.autotable.min.js';
        s2.onerror = () => reject(new Error('Failed to load jsPDF-autoTable from unpkg.com'));
        s2.onload  = () => { _libsLoaded = true; resolve(); };
        document.head.appendChild(s2);
      };
      document.head.appendChild(s1);
    });
  }

  // ── PC-safe download ──────────────────────────────────────────────────────
  function triggerDownload(doc, filename) {
    const blob = doc.output('blob');
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    // Windows AV scans the blob before releasing — delay revoke to avoid freeze
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PDF BUILDER
  // ─────────────────────────────────────────────────────────────────────────
  function buildPDF(data) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' });

    const PW = 215.9, PH = 279.4;   // US Letter
    const ML = 14;                   // left margin
    const MR = PW - 14;             // right margin x
    const CW = MR - ML;             // content width ≈ 188 mm
    const SAFE = 182;               // max table/chart width
    const FOOTER_H = 10;
    const TOP_START = 16;           // y after top margin

    const regionLabel = data.region === 'NE' ? 'NE Region'
                      : data.region === 'SW' ? 'SW Region'
                      : 'Network Aggregate';
    const generated = new Date(data.generatedAt).toLocaleDateString('en-US',
      { month: 'long', day: 'numeric', year: 'numeric' });

    // ── Doc-level helpers ──────────────────────────────────────────────────

    // Two-pass footer: built after doc is complete using getNumberOfPages()
    function stampFooters() {
      const total = doc.getNumberOfPages();
      for (let i = 1; i <= total; i++) {
        doc.setPage(i);
        doc.setFillColor(...C.navy);
        doc.rect(0, PH - FOOTER_H, PW, FOOTER_H, 'F');
        doc.setFontSize(7);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...C.white);
        doc.text(
          'New Jersey Tutoring Corps  ·  Pearl Operations Report  ·  Confidential',
          ML, PH - 3.5
        );
        doc.text(`Page ${i} of ${total}`, MR, PH - 3.5, { align: 'right' });
      }
      doc.setTextColor(...C.body);
    }

    // ── Drawing primitives ─────────────────────────────────────────────────

    /** Navy full-width section header bar. Returns y after header. */
    function secHeader(y, title) {
      // Guard: if less than 40 mm to footer, add a page
      if (y > PH - FOOTER_H - 40) { doc.addPage(); y = TOP_START; }
      doc.setFillColor(...C.navy);
      doc.rect(ML, y, SAFE, 9, 'F');
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...C.white);
      doc.text(title.toUpperCase(), ML + 3, y + 6.2);
      doc.setTextColor(...C.body);
      doc.setFont('helvetica', 'normal');
      return y + 11;
    }

    /** Definition box with teal 2 mm left border. Returns y after box. */
    function defBox(y, lines, title) {
      const padding = 3;
      const lineH   = 4.5;
      const totalH  = (title ? lineH + 2 : 0) + lines.length * lineH + padding * 2;
      doc.setFillColor(232, 245, 243);
      doc.roundedRect(ML, y, SAFE, totalH, 2, 2, 'F');
      doc.setFillColor(...C.teal);
      doc.rect(ML, y, 2, totalH, 'F');
      let ty = y + padding + (title ? lineH : 0);
      if (title) {
        doc.setFontSize(8);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...C.navy);
        doc.text(title, ML + 5, y + padding + 3.5);
        ty = y + padding + lineH + 1;
      }
      doc.setFontSize(7.5);
      doc.setFont('helvetica', 'italic');
      doc.setTextColor(...C.muted);
      lines.forEach(line => {
        doc.text(line, ML + 5, ty + 3.2);
        ty += lineH;
      });
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...C.body);
      return y + totalH + 4;
    }

    /** KPI card with teal left border. */
    function kpiCard(x, y, w, h, value, label, color) {
      doc.setFillColor(...C.white);
      doc.roundedRect(x, y, w, h, 2, 2, 'F');
      doc.setDrawColor(...C.mid);
      doc.setLineWidth(0.3);
      doc.roundedRect(x, y, w, h, 2, 2, 'S');
      // Teal left accent
      doc.setFillColor(...C.teal);
      doc.rect(x, y, 2.5, h, 'F');
      // Value
      doc.setFontSize(20);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...(color || C.navy));
      doc.text(String(value), x + w / 2, y + h / 2 + 2, { align: 'center' });
      // Label
      doc.setFontSize(7);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...C.muted);
      doc.text(label, x + w / 2, y + h - 3.5, { align: 'center' });
      doc.setTextColor(...C.body);
    }

    /** Mini 4-across stat pills. Returns y after pills. */
    function statPills(y, pills) {
      const pillW = (SAFE - 9) / 4;
      const pillH = 20;
      pills.forEach((p, i) => {
        const px = ML + i * (pillW + 3);
        doc.setFillColor(...C.light);
        doc.roundedRect(px, y, pillW, pillH, 2, 2, 'F');
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...(p.color || C.navy));
        doc.text(String(p.value), px + pillW / 2, y + 11, { align: 'center' });
        doc.setFontSize(6.5);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...C.muted);
        doc.text(p.label, px + pillW / 2, y + pillH - 3.5, { align: 'center' });
      });
      doc.setTextColor(...C.body);
      return y + pillH + 5;
    }

    /**
     * Horizontal bar chart.
     * items = [{label, value, maxValue?, color?}]
     * Returns y after chart.
     */
    function hBarChart(y, items, opts) {
      if (!items || !items.length) return y;
      opts = opts || {};
      const barAreaW = opts.barAreaW || SAFE * 0.52;
      const labelW   = opts.labelW   || SAFE * 0.38;
      const rowH     = opts.rowH     || 7;
      const gap      = opts.gap      || 2;
      const maxVal   = opts.maxVal   || Math.max(...items.map(it => it.value || 0), 1);

      items.forEach((item, i) => {
        const ry = y + i * (rowH + gap);
        // Label
        doc.setFontSize(7.5);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...C.body);
        const truncLabel = item.label.length > 42 ? item.label.slice(0, 39) + '…' : item.label;
        doc.text(truncLabel, ML, ry + rowH - 2.2);
        // Background track
        const bx = ML + labelW;
        doc.setFillColor(...C.light);
        doc.rect(bx, ry, barAreaW, rowH - 1, 'F');
        // Bar fill
        const fillW = maxVal > 0 ? barAreaW * Math.min(item.value / maxVal, 1) : 0;
        const clr   = item.color || C.teal;
        doc.setFillColor(...clr);
        doc.rect(bx, ry, Math.max(fillW, 0.5), rowH - 1, 'F');
        // Value label
        doc.setFontSize(7);
        doc.setTextColor(...C.muted);
        const valStr = item.suffix ? fmt(item.value, item.dp || 1) + item.suffix : num(item.value);
        doc.text(valStr, bx + barAreaW + 2, ry + rowH - 2.2);
      });
      doc.setTextColor(...C.body);
      return y + items.length * (rowH + gap) + 4;
    }

    /** autoTable wrapper with NJTC defaults. */
    function table(startY, head, body, colStyles, hooks) {
      if (!body || !body.length) body = [Array(head[0].length).fill('—')];
      doc.autoTable({
        startY,
        head,
        body,
        margin: { left: ML, right: PW - MR },
        tableWidth: SAFE,
        styles: {
          fontSize: 8, cellPadding: 3, textColor: C.body,
          overflow: 'linebreak', font: 'helvetica',
        },
        headStyles: {
          fillColor: C.navy, textColor: C.white,
          fontStyle: 'bold', fontSize: 8.5,
        },
        alternateRowStyles: { fillColor: C.light },
        rowPageBreak: 'avoid',
        showHead: 'everyPage',
        columnStyles: colStyles || {},
        didParseCell: hooks && hooks.didParseCell,
        didDrawCell:  hooks && hooks.didDrawCell,
        theme: 'plain',
      });
      return doc.lastAutoTable.finalY + 5;
    }

    // ── Build pages ────────────────────────────────────────────────────────

    // ───────────────────────────────────────────────────────────────────────
    // PAGE 1 — COVER
    // ───────────────────────────────────────────────────────────────────────
    // Navy header
    doc.setFillColor(...C.navy);
    doc.rect(0, 0, PW, 68, 'F');

    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...C.teal);
    doc.text('NEW JERSEY TUTORING CORPS', PW / 2, 18, { align: 'center' });

    doc.setFontSize(24);
    doc.setTextColor(...C.white);
    doc.text('Pearl Operations', PW / 2, 33, { align: 'center' });

    // Region pill
    const pillW = 62, pillH = 9, pillX = PW / 2 - pillW / 2, pillY = 38;
    doc.setFillColor(...C.teal);
    doc.roundedRect(pillX, pillY, pillW, pillH, 4, 4, 'F');
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...C.white);
    doc.text(regionLabel + ' Report', PW / 2, pillY + 6.2, { align: 'center' });

    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(180, 195, 210);
    doc.text(`Generated ${generated}  ·  SY 2025–2026`, PW / 2, 58, { align: 'center' });
    doc.setTextColor(...C.body);

    // KPI cards (2 rows × 4 cols)
    const cardW = (SAFE - 9) / 4, cardH = 26, cardGap = 3;
    const row1Y = 75, row2Y = row1Y + cardH + cardGap;

    const kpiRow1 = [
      { v: pct(data.scholarAttRate), l: 'Scholar Att. Rate',  c: statusColor(data.scholarAttRate, BM.scholAtt) },
      { v: pct(data.tutorAttRate),   l: 'Tutor Att. Rate',    c: statusColor(data.tutorAttRate,   BM.tutorAtt) },
      { v: pct(data.hitRate),        l: 'HIT Compliance',     c: statusColor(data.hitRate,        BM.hit) },
      { v: num(data.totalSessions),  l: 'Sessions Delivered', c: C.navy },
    ];
    const kpiRow2 = [
      { v: num(data.activeScholars),  l: 'Active Scholars',   c: C.navy },
      { v: num(data.activeTutors),    l: 'Active Tutors',     c: C.navy },
      { v: num(data.uniqueSchools),   l: 'Schools Served',    c: C.navy },
      { v: num(data.uniqueDistricts), l: 'Districts',         c: C.navy },
    ];
    [kpiRow1, kpiRow2].forEach((row, ri) => {
      row.forEach((kpi, ci) => {
        kpiCard(ML + ci * (cardW + cardGap), ri === 0 ? row1Y : row2Y, cardW, cardH, kpi.v, kpi.l, kpi.c);
      });
    });

    // Capture rate note
    const noteY = row2Y + cardH + 8;
    doc.setFillColor(...C.light);
    doc.roundedRect(ML, noteY, SAFE, 14, 2, 2, 'F');
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...C.navy);
    doc.text('Survey Capture Rates', ML + 4, noteY + 5.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...C.muted);
    doc.text(
      `Scholar surveys: ${pct(data.scholCaptureRate, 0)} capture (${num(data.totalScholSubm)} of ${num(data.totalScholElig)} eligible sessions)  ·  ` +
      `Tutor surveys: ${pct(data.tutorCaptureRate, 0)} capture (${num(data.totalTutorSubm)} of ${num(data.totalTutorElig)} eligible sessions)`,
      ML + 4, noteY + 10.5
    );
    doc.setTextColor(...C.body);

    // Table of contents
    const tocY = noteY + 22;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...C.navy);
    doc.text('Report Contents', ML, tocY);
    doc.setDrawColor(...C.teal);
    doc.setLineWidth(0.5);
    doc.line(ML, tocY + 2, MR, tocY + 2);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    const toc = [
      ['2', 'Scholar Attendance',          'Rates, absences, SI events, school-level bar chart'],
      ['3', 'Tutor Attendance',            'Rates, session hours, per-tutor breakdown'],
      ['4', 'Session Summary',             'District rollup and school-level session counts'],
      ['5', 'HIT Compliance',              '4:1 ratio requirement, violations, school status'],
      ['6', 'Service Interruptions',       'Reason codes, frequency chart, regional scope'],
      ['7', 'Survey Scores & Capture',     'Scholar and tutor scores, top/bottom capture rates'],
      ['8', 'Top Tutors by Hours',         'Ranked by instructional hours from live session data'],
      ['9', 'Instructor Comment Themes',   'Categorized feedback from tutor survey comments'],
    ];
    toc.forEach((row, i) => {
      const ry = tocY + 7 + i * 6.5;
      doc.setTextColor(...C.teal);
      doc.text(`P.${row[0]}`, ML, ry);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...C.navy);
      doc.text(row[1], ML + 12, ry);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...C.muted);
      doc.text(row[2], ML + 70, ry);
    });

    // Mission strip
    doc.setFillColor(...C.navy);
    doc.rect(0, PH - FOOTER_H - 16, PW, 14, 'F');
    doc.setFontSize(8);
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(...C.white);
    doc.text(
      'Accelerating student achievement through high-impact, data-driven tutoring.',
      PW / 2, PH - FOOTER_H - 9, { align: 'center' }
    );
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...C.body);

    // ───────────────────────────────────────────────────────────────────────
    // PAGE 2 — SCHOLAR ATTENDANCE
    // ───────────────────────────────────────────────────────────────────────
    doc.addPage();
    let y = secHeader(TOP_START, `Scholar Attendance — ${regionLabel}`);

    y = defBox(y, [
      'Scholar Attendance Rate = Sessions Attended (Attended + Late) ÷ (Attended + Absent) × 100.',
      'Benchmark: ≥ 85%. Service Interruptions (SI) are school/program-caused absences and excluded from the rate denominator.',
      'Partially Attended sessions count as eligible for scholar surveys but not as full attendance.',
    ], 'Definition');

    y = statPills(y, [
      { value: pct(data.scholarAttRate),  label: 'Scholar Att. Rate',   color: statusColor(data.scholarAttRate, BM.scholAtt) },
      { value: num(data.stuAttended),      label: 'Sessions Attended',   color: C.teal },
      { value: num(data.stuAbsent),        label: 'Sessions Missed',     color: data.stuAbsent > 50 ? C.red : C.amber },
      { value: num(data.stuSI),            label: 'Service Interruptions',color: C.navy },
    ]);

    // School table with color-coded att rate
    y = secHeader(y, 'Attendance by School');
    const scholRows = data.schools.map(sc => [
      sc.name, sc.district || '—',
      pct(sc.attRate, 1), num(sc.stuAttended), num(sc.stuAbsent), num(sc.siCount),
    ]);
    y = table(y, [['School', 'District', 'Att. Rate', 'Attended', 'Absent', 'SI']], scholRows,
      { 0: { cellWidth: 68 }, 1: { cellWidth: 52 }, 2: { cellWidth: 22, halign: 'center' },
        3: { cellWidth: 16, halign: 'center' }, 4: { cellWidth: 15, halign: 'center' }, 5: { cellWidth: 9, halign: 'center' } },
      {
        didParseCell: function(d) {
          if (d.section === 'body' && d.column.index === 2) {
            const v = parseFloat(d.cell.raw);
            if (!isNaN(v)) { d.cell.styles.textColor = statusColor(v, BM.scholAtt); d.cell.styles.fontStyle = 'bold'; }
          }
        },
      }
    );

    // Bar chart — top 15 schools by attendance rate
    if (data.schools.length > 0) {
      if (y > PH - FOOTER_H - 60) { doc.addPage(); y = TOP_START; }
      y = secHeader(y, 'Attendance Rate by School (Top 15)');
      const chartItems = [...data.schools]
        .filter(s => s.sessions > 0)
        .sort((a, b) => b.attRate - a.attRate)
        .slice(0, 15)
        .map(s => ({
          label: s.name,
          value: s.attRate,
          color: statusColor(s.attRate, BM.scholAtt),
          suffix: '%', dp: 1,
        }));
      y = hBarChart(y, chartItems, { maxVal: 100, barAreaW: SAFE * 0.4, labelW: SAFE * 0.5 });
    }

    // ───────────────────────────────────────────────────────────────────────
    // PAGE 3 — TUTOR ATTENDANCE
    // ───────────────────────────────────────────────────────────────────────
    doc.addPage();
    y = secHeader(TOP_START, `Tutor Attendance — ${regionLabel}`);

    y = defBox(y, [
      'Tutor Attendance Rate = Sessions Attended ÷ (Attended + Missed) × 100. Benchmark: ≥ 90%.',
      'Instructional Hours = sum of actual session durations (minutes ÷ 60) for all delivered sessions led by each tutor.',
      'Hours are drawn from live Pearl session data — not estimates or scheduled durations.',
    ], 'Definition');

    y = statPills(y, [
      { value: pct(data.tutorAttRate),   label: 'Tutor Att. Rate',    color: statusColor(data.tutorAttRate, BM.tutorAtt) },
      { value: num(data.instAttended),    label: 'Sessions Attended',  color: C.teal },
      { value: num(data.instAbsent),      label: 'Sessions Missed',    color: data.instAbsent > 20 ? C.red : C.amber },
      { value: num(data.activeTutors),    label: 'Active Tutors',      color: C.navy },
    ]);

    y = secHeader(y, 'Tutor Detail (Top 20 by Instructional Hours)');
    const tutorRows = data.topTutors.map((t, i) => [
      i + 1, t.name, t.school || '—', t.district || '—',
      pct(t.attRate, 1), num(t.attended), num(t.absent), hrs(t.hours),
    ]);
    y = table(
      y,
      [['#', 'Tutor', 'School', 'District', 'Att. Rate', 'Attended', 'Missed', 'Hours']],
      tutorRows,
      { 0: { cellWidth: 7, halign: 'center' }, 1: { cellWidth: 46 }, 2: { cellWidth: 42 },
        3: { cellWidth: 36 }, 4: { cellWidth: 18, halign: 'center' },
        5: { cellWidth: 14, halign: 'center' }, 6: { cellWidth: 13, halign: 'center' },
        7: { cellWidth: 16, halign: 'center' } },
      {
        didParseCell: function(d) {
          if (d.section === 'body' && d.column.index === 4) {
            const v = parseFloat(d.cell.raw);
            if (!isNaN(v)) { d.cell.styles.textColor = statusColor(v, BM.tutorAtt); d.cell.styles.fontStyle = 'bold'; }
          }
        },
      }
    );

    // ───────────────────────────────────────────────────────────────────────
    // PAGE 4 — SESSION SUMMARY
    // ───────────────────────────────────────────────────────────────────────
    doc.addPage();
    y = secHeader(TOP_START, `Session Summary — ${regionLabel}`);

    y = statPills(y, [
      { value: num(data.totalSessions),  label: 'Total Delivered',    color: C.navy },
      { value: num(data.uniqueSchools),  label: 'Schools Served',     color: C.teal },
      { value: num(data.uniqueDistricts),label: 'Districts',          color: C.teal },
      { value: data.uniqueSchools > 0 ? fmt(data.totalSessions / data.uniqueSchools, 1) : '—',
        label: 'Avg Sessions / School',  color: C.navy },
    ]);

    y = secHeader(y, 'Sessions by District');
    const distRows = data.districts.map(d => [
      d.name, num(d.schools.length), num(d.sessions), pct(d.attRate, 1), num(d.siCount),
    ]);
    y = table(
      y,
      [['District', 'Schools', 'Sessions', 'Att. Rate', 'SI Events']],
      distRows,
      { 0: { cellWidth: 88 }, 1: { cellWidth: 20, halign: 'center' },
        2: { cellWidth: 28, halign: 'center' }, 3: { cellWidth: 26, halign: 'center' },
        4: { cellWidth: 20, halign: 'center' } }
    );

    if (y < PH - FOOTER_H - 55) {
      y = secHeader(y, 'Sessions by School');
      const schoolSessRows = data.schools.map(sc => [sc.name, sc.district || '—', num(sc.sessions), pct(sc.attRate, 1)]);
      y = table(
        y,
        [['School', 'District', 'Sessions', 'Att. Rate']],
        schoolSessRows,
        { 0: { cellWidth: 88 }, 1: { cellWidth: 56 }, 2: { cellWidth: 22, halign: 'center' }, 3: { cellWidth: 16, halign: 'center' } }
      );
    }

    // ───────────────────────────────────────────────────────────────────────
    // PAGE 5 — HIT COMPLIANCE
    // ───────────────────────────────────────────────────────────────────────
    doc.addPage();
    y = secHeader(TOP_START, `HIT Compliance — ${regionLabel}`);

    y = defBox(y, [
      'HIT (High-Impact Tutoring) requires a scholar-to-tutor ratio of ≤ 4:1 per session.',
      'HIT Rate = Sessions without a ratio violation ÷ Total delivered sessions × 100.  Benchmark: ≥ 95%.',
      'A "violation" is any delivered session where the ratio exceeded 4:1. Compliance is calculated from delivered sessions only.',
      'The ratio is the count of enrolled students per session as recorded in Pearl session data.',
    ], 'Definition — HIT Compliance');

    y = statPills(y, [
      { value: pct(data.hitRate),         label: 'HIT Compliance Rate',  color: statusColor(data.hitRate, BM.hit) },
      { value: num(data.hitSessions),     label: 'Compliant Sessions',   color: C.green },
      { value: num(data.ratioViolations), label: 'Ratio Violations',     color: data.ratioViolations > 0 ? C.red : C.green },
      { value: data.maxRatio > 0 ? data.maxRatio + ':1' : '—',
        label: 'Highest Ratio Recorded',  color: data.maxRatio > 4 ? C.red : C.green },
    ]);

    y = secHeader(y, 'HIT Compliance by School');
    const hitRows = data.schools.map(sc => {
      const statusStr = sc.ratioViolations > 0
        ? `⚠ ${sc.ratioViolations} violation${sc.ratioViolations !== 1 ? 's' : ''}`
        : '✓ Compliant';
      return [sc.name, sc.district || '—', num(sc.sessions), pct(sc.hitRate, 1), num(sc.ratioViolations), statusStr];
    });
    y = table(
      y,
      [['School', 'District', 'Sessions', 'HIT Rate', 'Violations', 'Status']],
      hitRows,
      { 0: { cellWidth: 66 }, 1: { cellWidth: 48 }, 2: { cellWidth: 18, halign: 'center' },
        3: { cellWidth: 18, halign: 'center' }, 4: { cellWidth: 18, halign: 'center' },
        5: { cellWidth: 14, halign: 'center' } },
      {
        didParseCell: function(d) {
          if (d.section !== 'body') return;
          if (d.column.index === 3) {
            const v = parseFloat(d.cell.raw);
            if (!isNaN(v)) { d.cell.styles.textColor = statusColor(v, BM.hit); d.cell.styles.fontStyle = 'bold'; }
          }
          if (d.column.index === 5) {
            if (String(d.cell.raw).startsWith('⚠')) {
              d.cell.styles.textColor = C.amber; d.cell.styles.fontStyle = 'bold';
            } else {
              d.cell.styles.textColor = C.green;
            }
          }
        },
      }
    );

    // ───────────────────────────────────────────────────────────────────────
    // PAGE 6 — SERVICE INTERRUPTIONS
    // ───────────────────────────────────────────────────────────────────────
    doc.addPage();
    y = secHeader(TOP_START, `Service Interruptions — ${regionLabel}`);

    y = defBox(y, [
      'A Service Interruption (SI) is a session missed due to a school/program-caused event, not a scholar\'s own absence.',
      'Common SI causes: school closure, teacher schedule conflict, program rescheduling, technology failure.',
      'SI events are excluded from the scholar attendance rate denominator. Data is scoped to this region only.',
    ], 'Definition');

    const totalMissed = data.stuAbsent + data.stuSI;
    y = statPills(y, [
      { value: num(data.stuSI),        label: 'SI Events',              color: C.red },
      { value: num(data.stuAbsent),    label: 'Scholar Absences',       color: C.amber },
      { value: totalMissed > 0 ? pct(data.stuSI / totalMissed * 100, 1) : '—',
        label: '% of Missed (SI)',     color: C.navy },
      { value: num(Object.keys(data.missedReasonCounts).length),
        label: 'Distinct Reasons',     color: C.navy },
    ]);

    // Sorted reasons
    const sortedReasons = Object.entries(data.missedReasonCounts).sort((a,b) => b[1] - a[1]);
    const totalReasonCt = sortedReasons.reduce((s, [,c]) => s + c, 0);

    // Bar chart — top 8
    if (sortedReasons.length > 0) {
      y = secHeader(y, 'Top Missed Reasons (Bar Chart)');
      const barItems = sortedReasons.slice(0, 8).map(([ reason, cnt ], idx) => ({
        label: reason,
        value: cnt,
        color: idx === 0 ? C.teal : C.navy,
      }));
      y = hBarChart(y, barItems, { barAreaW: SAFE * 0.38, labelW: SAFE * 0.53 });
    }

    // Full table
    y = secHeader(y, 'All Missed Reasons');
    const reasonRows = sortedReasons.map(([reason, count]) => [
      reason || 'Unknown', num(count),
      totalReasonCt > 0 ? pct(count / totalReasonCt * 100, 1) : '—',
    ]);
    if (!reasonRows.length) reasonRows.push(['No missed sessions recorded', '—', '—']);
    y = table(
      y,
      [['Miss Reason', 'Count', '% of Total']],
      reasonRows,
      { 0: { cellWidth: 138 }, 1: { cellWidth: 22, halign: 'center' }, 2: { cellWidth: 22, halign: 'center' } }
    );

    // ───────────────────────────────────────────────────────────────────────
    // PAGE 7 — SURVEY SCORES & CAPTURE RATES
    // ───────────────────────────────────────────────────────────────────────
    doc.addPage();
    y = secHeader(TOP_START, `Survey Scores & Capture Rates — ${regionLabel}`);

    y = defBox(y, [
      'Surveys use a 1–5 scale (5 = Excellent). Scholar surveys measure Confidence, Enjoyment, Learning, Overall.',
      'Instructor surveys measure Engagement, Enjoyment, Learning, Overall.',
      'Capture Rate benchmark: ≥ 80%. Scholar eligible = sessions where scholar Attended/Late/Partially Attended.',
      'Tutor eligible = delivered sessions where ≥ 1 scholar attended (Attended or Partially Attended).',
    ], 'Definition — Surveys');

    // Scholar survey cards
    y = secHeader(y, `Scholar Surveys  (n = ${num(data.stuSurveyAvg.count)}  ·  Capture: ${pct(data.stuSurveyAvg.captureRate, 0)})`);
    const sCardW = (SAFE - 9) / 4, sCardH = 22, sCardGap = 3;
    [
      { v: fmt(data.stuSurveyAvg.confidence, 2), l: 'Confidence' },
      { v: fmt(data.stuSurveyAvg.enjoyment,  2), l: 'Enjoyment'  },
      { v: fmt(data.stuSurveyAvg.learning,   2), l: 'Learning'   },
      { v: fmt(data.stuSurveyAvg.overall,    2), l: 'Overall',   c: statusColor(data.stuSurveyAvg.overall * 20, BM.scholAtt) },
    ].forEach((card, i) => {
      kpiCard(ML + i * (sCardW + sCardGap), y, sCardW, sCardH, card.v, card.l, card.c || C.teal);
    });
    y += sCardH + 5;

    // Instructor survey cards
    y = secHeader(y, `Instructor Surveys  (n = ${num(data.instSurveyAvg.count)}  ·  Capture: ${pct(data.instSurveyAvg.captureRate, 0)})`);
    [
      { v: fmt(data.instSurveyAvg.engagement, 2), l: 'Engagement' },
      { v: fmt(data.instSurveyAvg.enjoyment,  2), l: 'Enjoyment'  },
      { v: fmt(data.instSurveyAvg.learning,   2), l: 'Learning'   },
      { v: fmt(data.instSurveyAvg.overall,    2), l: 'Overall',   c: statusColor(data.instSurveyAvg.overall * 20, BM.scholAtt) },
    ].forEach((card, i) => {
      kpiCard(ML + i * (sCardW + sCardGap), y, sCardW, sCardH, card.v, card.l, card.c || C.navy);
    });
    y += sCardH + 6;

    // Capture rate tables (side by side: scholar left, tutor right)
    const halfW = (SAFE - 6) / 2;

    y = secHeader(y, 'Scholar Survey Capture — Top 3 Highest / Bottom 5 Lowest');
    if (data.scholCaptureTopN.length || data.scholCaptureBottomN.length) {
      const topRows    = data.scholCaptureTopN.map((s, i) => [`#${i+1}`, s.name, pct(s.scholCaptureRate, 0), `${s.scholCaptureSubm}/${s.scholCaptureElig}`]);
      const bottomRows = data.scholCaptureBottomN.map((s, i) => [`#${i+1}`, s.name, pct(s.scholCaptureRate, 0), `${s.scholCaptureSubm}/${s.scholCaptureElig}`]);
      const capHead = [['#', 'School', 'Rate', 'Submitted/Eligible']];
      const capCols = { 0: { cellWidth: 8, halign: 'center' }, 1: { cellWidth: 50 }, 2: { cellWidth: 18, halign: 'center' }, 3: { cellWidth: 16, halign: 'center' } };
      if (topRows.length) {
        doc.setFontSize(7.5); doc.setFont('helvetica', 'bold'); doc.setTextColor(...C.green);
        doc.text('▲ Top 3 Highest', ML, y + 3); doc.setTextColor(...C.body); doc.setFont('helvetica', 'normal');
        y = table(y + 5, capHead, topRows, capCols, {
          didParseCell: function(d) { if (d.section === 'body' && d.column.index === 2) { d.cell.styles.textColor = C.green; d.cell.styles.fontStyle = 'bold'; } },
        });
      }
      if (bottomRows.length) {
        doc.setFontSize(7.5); doc.setFont('helvetica', 'bold'); doc.setTextColor(...C.red);
        doc.text('▼ Bottom 5 Lowest', ML, y + 3); doc.setTextColor(...C.body); doc.setFont('helvetica', 'normal');
        y = table(y + 5, capHead, bottomRows, capCols, {
          didParseCell: function(d) { if (d.section === 'body' && d.column.index === 2) { d.cell.styles.textColor = C.red; d.cell.styles.fontStyle = 'bold'; } },
        });
      }
    } else {
      doc.setFontSize(8); doc.setTextColor(...C.muted);
      doc.text('Insufficient data for capture rate rankings (minimum 5 eligible events per school required).', ML, y + 6);
      doc.setTextColor(...C.body); y += 12;
    }

    y = secHeader(y, 'Tutor Survey Capture — Top 3 Highest / Bottom 5 Lowest');
    if (data.tutorCaptureTop.length || data.tutorCaptureBottom.length) {
      const tCapHead = [['#', 'Tutor', 'Rate', 'Sub/Elig']];
      const tCapCols = { 0: { cellWidth: 8, halign: 'center' }, 1: { cellWidth: 56 }, 2: { cellWidth: 18, halign: 'center' }, 3: { cellWidth: 14, halign: 'center' } };
      if (data.tutorCaptureTop.length) {
        doc.setFontSize(7.5); doc.setFont('helvetica', 'bold'); doc.setTextColor(...C.green);
        doc.text('▲ Top 3 Highest', ML, y + 3); doc.setTextColor(...C.body); doc.setFont('helvetica', 'normal');
        y = table(y + 5, tCapHead,
          data.tutorCaptureTop.map((t, i) => [`#${i+1}`, t.name, pct(t.captureRate, 0), `${t.submitted}/${t.eligible}`]),
          tCapCols,
          { didParseCell: function(d) { if (d.section === 'body' && d.column.index === 2) { d.cell.styles.textColor = C.green; d.cell.styles.fontStyle = 'bold'; } } }
        );
      }
      if (data.tutorCaptureBottom.length) {
        doc.setFontSize(7.5); doc.setFont('helvetica', 'bold'); doc.setTextColor(...C.red);
        doc.text('▼ Bottom 5 Lowest', ML, y + 3); doc.setTextColor(...C.body); doc.setFont('helvetica', 'normal');
        y = table(y + 5, tCapHead,
          data.tutorCaptureBottom.map((t, i) => [`#${i+1}`, t.name, pct(t.captureRate, 0), `${t.submitted}/${t.eligible}`]),
          tCapCols,
          { didParseCell: function(d) { if (d.section === 'body' && d.column.index === 2) { d.cell.styles.textColor = C.red; d.cell.styles.fontStyle = 'bold'; } } }
        );
      }
    } else {
      doc.setFontSize(8); doc.setTextColor(...C.muted);
      doc.text('No tutor survey capture data available for this region.', ML, y + 6);
      doc.setTextColor(...C.body); y += 12;
    }

    // School survey averages table
    if (y < PH - FOOTER_H - 55) {
      y = secHeader(y, 'Survey Averages by School');
      const schoolSurvRows = data.schools.map(sc => [
        sc.name, sc.district || '—', fmt(sc.stuSurveyAvg, 2), fmt(sc.instSurveyAvg, 2),
      ]);
      y = table(
        y,
        [['School', 'District', 'Scholar Survey Avg (1–5)', 'Tutor Survey Avg (1–5)']],
        schoolSurvRows,
        { 0: { cellWidth: 80 }, 1: { cellWidth: 56 }, 2: { cellWidth: 24, halign: 'center' }, 3: { cellWidth: 22, halign: 'center' } }
      );
    }

    // ───────────────────────────────────────────────────────────────────────
    // PAGE 8 — TOP TUTORS BY HOURS
    // ───────────────────────────────────────────────────────────────────────
    doc.addPage();
    y = secHeader(TOP_START, `Top Tutors by Instructional Hours — ${regionLabel}`);

    y = defBox(y, [
      'Instructional Hours = total actual session duration (in hours) for all delivered sessions led by each tutor.',
      'Source: Pearl Session Details sheet — Actual Duration field (falls back to Scheduled Duration if not set).',
      'Sorted by hours descending. Attendance Rate colored by benchmark (≥ 90% = green, within 5% = amber, below = red).',
    ], 'Notes');

    const topTutorRows = data.topTutors.map((t, i) => [
      i + 1, t.name, t.school || '—', t.district || '—',
      hrs(t.hours), pct(t.attRate, 1), num(t.attended), num(t.absent),
    ]);
    y = table(
      y,
      [['#', 'Tutor', 'School', 'District', 'Hours', 'Att. Rate', 'Attended', 'Missed']],
      topTutorRows.length ? topTutorRows : [['—', 'No tutor data available', '', '', '', '', '', '']],
      { 0: { cellWidth: 7, halign: 'center' }, 1: { cellWidth: 46 }, 2: { cellWidth: 40 },
        3: { cellWidth: 36 }, 4: { cellWidth: 16, halign: 'center' },
        5: { cellWidth: 18, halign: 'center' }, 6: { cellWidth: 12, halign: 'center' }, 7: { cellWidth: 7, halign: 'center' } },
      {
        didParseCell: function(d) {
          if (d.section === 'body' && d.column.index === 5) {
            const v = parseFloat(d.cell.raw);
            if (!isNaN(v)) { d.cell.styles.textColor = statusColor(v, BM.tutorAtt); d.cell.styles.fontStyle = 'bold'; }
          }
          if (d.section === 'body' && d.column.index === 4) {
            d.cell.styles.fontStyle = 'bold'; d.cell.styles.textColor = C.teal;
          }
        },
      }
    );

    // ───────────────────────────────────────────────────────────────────────
    // PAGE 9 — INSTRUCTOR COMMENT CATEGORIES
    // ───────────────────────────────────────────────────────────────────────
    doc.addPage();
    y = secHeader(TOP_START, `Instructor Comment Categories — ${regionLabel}`);

    y = defBox(y, [
      'Comment categories are auto-generated by matching instructor survey comments against keyword sets.',
      'Each comment may match one category (highest keyword-match score wins). Unmatched → "Other".',
      'Categories: Concern, Positive Feedback, Engagement, Logistics, Curriculum, Relationship Building, Other.',
      'Volume reflects comments from instructor survey responses for this region.',
    ], 'Definition');

    const BUCKET_LABELS = {
      concern:      'Concern / Challenges',
      positive:     'Positive Feedback',
      engagement:   'Scholar Engagement',
      logistics:    'Logistics / Scheduling',
      curriculum:   'Curriculum & Content',
      relationship: 'Relationship Building',
      other:        'Other / Uncategorized',
    };
    const BUCKET_COLORS = [C.red, C.green, C.teal, C.amber, C.navy, [130,100,180], C.mid];

    const totalComments = Object.values(data.commentCounts).reduce((s,c)=>s+c, 0);
    const commentEntries = Object.entries(BUCKET_LABELS).map(([key, label]) => ({
      key, label,
      count: data.commentCounts[key] || 0,
      pctVal: totalComments > 0 ? (data.commentCounts[key] || 0) / totalComments : 0,
    })).filter(e => e.count > 0).sort((a,b) => b.count - a.count);

    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...C.muted);
    doc.text(
      `${num(totalComments)} comment${totalComments !== 1 ? 's' : ''} analyzed across ${num(data.instSurveyAvg.count)} instructor survey responses.`,
      ML, y
    );
    y += 7;

    // Proportional segmented bar (single row, divided into colored segments)
    if (commentEntries.length > 0 && totalComments > 0) {
      const segH = 12, segY = y;
      let segX = ML;
      commentEntries.forEach((e, i) => {
        const segW = SAFE * e.pctVal;
        doc.setFillColor(...(BUCKET_COLORS[i % BUCKET_COLORS.length]));
        doc.rect(segX, segY, segW, segH, 'F');
        segX += segW;
      });
      // Legend below bar
      y += segH + 3;
      let legX = ML;
      commentEntries.forEach((e, i) => {
        doc.setFillColor(...(BUCKET_COLORS[i % BUCKET_COLORS.length]));
        doc.rect(legX, y, 4, 4, 'F');
        doc.setFontSize(6.5);
        doc.setTextColor(...C.body);
        doc.text(`${e.label} ${pct(e.pctVal * 100, 0)}`, legX + 5.5, y + 3.2);
        legX += doc.getTextWidth(`${e.label} ${pct(e.pctVal * 100, 0)}`) + 12;
        if (legX > MR - 30) { legX = ML; y += 6; }
      });
      y += 8;
    }

    // Summary table
    y = secHeader(y, 'Comment Category Summary');
    const commentRows = commentEntries.length > 0
      ? commentEntries.map(e => [e.label, num(e.count), pct(e.pctVal * 100, 1)])
      : [['No comment data available', '—', '—']];
    commentRows.push(['TOTAL', num(totalComments), '100.0%']);
    y = table(
      y,
      [['Category', 'Comments', '% of Total']],
      commentRows,
      { 0: { cellWidth: 110 }, 1: { cellWidth: 36, halign: 'center' }, 2: { cellWidth: 36, halign: 'center' } },
      {
        didParseCell: function(d) {
          if (d.section === 'body' && d.row.index === commentRows.length - 1) {
            d.cell.styles.fontStyle = 'bold'; d.cell.styles.fillColor = C.light;
          }
        },
      }
    );

    // ── Two-pass footer stamp ──────────────────────────────────────────────
    stampFooters();

    return doc;
  }

  // ── Public API ────────────────────────────────────────────────────────────
  window.njtcPDFExport = {
    generate: async function (regionFilter) {
      if (!window.po || typeof window.po.getExportData !== 'function') {
        alert('Pearl Ops data not ready. Wait for the dashboard to finish loading, then try again.');
        return;
      }

      const btn = document.querySelector(`[data-pdf-region="${regionFilter}"]`);
      const origText = btn ? btn.textContent : '';
      if (btn) { btn.textContent = 'Generating…'; btn.disabled = true; }

      // Yield UI thread before heavy computation so browser can repaint button state
      await new Promise(r => setTimeout(r, 60));

      try {
        await loadLibs();
        const data = window.po.getExportData(regionFilter);

        if (!data || data.totalSessions === 0) {
          const label = regionFilter === 'ALL' ? 'the network'
                      : regionFilter + ' Region';
          alert(`No delivered session data found for ${label}.\n\nEnsure Pearl has finished loading (wait for the sync indicator to stop spinning).`);
          return;
        }

        const doc = buildPDF(data);
        const regionSlug = regionFilter === 'NE' ? 'NE-Region'
                         : regionFilter === 'SW' ? 'SW-Region' : 'Network';
        const dateStr = new Date().toISOString().slice(0, 10);
        triggerDownload(doc, `NJTC-Pearl-${regionSlug}-${dateStr}.pdf`);
      } catch (err) {
        console.error('[NJTC PDF]', err);
        alert('PDF generation failed:\n\n' + err.message +
          '\n\nEnsure you have an internet connection — jsPDF is loaded from unpkg.com.');
      } finally {
        if (btn) { btn.textContent = origText; btn.disabled = false; }
      }
    },
  };
})();
