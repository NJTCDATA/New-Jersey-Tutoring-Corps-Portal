// ─────────────────────────────────────────────────────────────────────────────
// NJTC Pearl Ops — PDF Export Module
// Generates 9-page downloadable reports for NE Region, SW Region, or Network.
// Loads jsPDF + autoTable on demand from unpkg.com (no Cloudflare / cdnjs).
// ─────────────────────────────────────────────────────────────────────────────

(function () {
  'use strict';

  // ── Brand palette ──────────────────────────────────────────────────────────
  const COLOR = {
    navy:   [26,  46,  74],   // #1a2e4a
    teal:   [42, 157, 143],   // #2a9d8f
    amber:  [233,196, 106],   // #e9c46a
    red:    [231,111,  81],   // #e76f51
    green:  [ 82,183,136],   // #52b788
    white:  [255,255,255],
    light:  [245,247,250],
    mid:    [180,190,200],
    text:   [ 30, 46, 74],
    muted:  [100,115,135],
  };

  // ── jsPDF loader ───────────────────────────────────────────────────────────
  let _jspdfLoaded = false;
  function loadJsPDF() {
    return new Promise((resolve, reject) => {
      if (_jspdfLoaded && window.jspdf && window.jspdf.jsPDF) { resolve(); return; }
      // Load jsPDF
      const s1 = document.createElement('script');
      s1.src = 'https://unpkg.com/jspdf@2.5.1/dist/jspdf.umd.min.js';
      s1.onload = () => {
        // Then load autoTable plugin
        const s2 = document.createElement('script');
        s2.src = 'https://unpkg.com/jspdf-autotable@3.8.2/dist/jspdf.plugin.autotable.min.js';
        s2.onload = () => { _jspdfLoaded = true; resolve(); };
        s2.onerror = () => reject(new Error('Failed to load jsPDF-autoTable from unpkg.com'));
        document.head.appendChild(s2);
      };
      s1.onerror = () => reject(new Error('Failed to load jsPDF from unpkg.com'));
      document.head.appendChild(s1);
    });
  }

  // ── Trigger download ───────────────────────────────────────────────────────
  function triggerDownload(doc, filename) {
    const blob = doc.output('blob');
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    // Delay revoke — Windows AV scans the blob before releasing it
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  }

  // ── Helpers ────────────────────────────────────────────────────────────────
  function fmt(n, decimals) {
    if (n === null || n === undefined || isNaN(n)) return '—';
    return parseFloat(n).toFixed(decimals === undefined ? 0 : decimals);
  }
  function pct(n) { return n === null || isNaN(n) ? '—' : fmt(n, 1) + '%'; }
  function num(n) { return (n === null || n === undefined) ? '—' : n.toLocaleString(); }

  // ── PDF builder ────────────────────────────────────────────────────────────
  function buildPDF(data) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' });
    const PW = 215.9, PH = 279.4;   // letter in mm
    const ML = 14, MR = PW - 14;
    const CW = MR - ML;
    let pageNum = 0;

    const regionLabel = data.region === 'NE' ? 'NE Region'
                      : data.region === 'SW' ? 'SW Region'
                      : 'Network Aggregate';
    const generated = new Date(data.generatedAt).toLocaleDateString('en-US', {
      month: 'long', day: 'numeric', year: 'numeric',
    });

    // ── Page footer helper ─────────────────────────────────────────────────
    function drawFooter() {
      doc.setFillColor(...COLOR.navy);
      doc.rect(0, PH - 10, PW, 10, 'F');
      doc.setFontSize(7);
      doc.setTextColor(...COLOR.white);
      doc.text('New Jersey Tutoring Corps  ·  Pearl Operations Report  ·  Confidential', ML, PH - 3.5);
      doc.text(`Page ${pageNum}`, MR, PH - 3.5, { align: 'right' });
      doc.setTextColor(...COLOR.text);
    }

    // ── Navy section header ────────────────────────────────────────────────
    function sectionHeader(y, title) {
      doc.setFillColor(...COLOR.navy);
      doc.rect(ML, y, CW, 8, 'F');
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...COLOR.white);
      doc.text(title.toUpperCase(), ML + 3, y + 5.5);
      doc.setTextColor(...COLOR.text);
      doc.setFont('helvetica', 'normal');
      return y + 10;
    }

    // ── Teal stat box ──────────────────────────────────────────────────────
    function statBox(x, y, w, h, label, value, color) {
      const c = color || COLOR.teal;
      doc.setFillColor(...c);
      doc.roundedRect(x, y, w, h, 2, 2, 'F');
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...COLOR.white);
      doc.text(String(value), x + w / 2, y + h / 2 + 1, { align: 'center' });
      doc.setFontSize(7);
      doc.setFont('helvetica', 'normal');
      doc.text(label, x + w / 2, y + h - 3, { align: 'center' });
      doc.setTextColor(...COLOR.text);
    }

    // ── addPage wrapper ────────────────────────────────────────────────────
    function newPage() {
      if (pageNum > 0) doc.addPage();
      pageNum++;
      drawFooter();
    }

    // ─────────────────────────────────────────────────────────────────────
    // PAGE 1 — COVER
    // ─────────────────────────────────────────────────────────────────────
    newPage();

    // Background header block
    doc.setFillColor(...COLOR.navy);
    doc.rect(0, 0, PW, 70, 'F');

    // NJTC wordmark area
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...COLOR.teal);
    doc.text('NEW JERSEY TUTORING CORPS', PW / 2, 22, { align: 'center' });

    doc.setFontSize(22);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...COLOR.white);
    doc.text('Pearl Operations', PW / 2, 36, { align: 'center' });

    doc.setFontSize(16);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...COLOR.amber);
    doc.text(`${regionLabel} Report`, PW / 2, 47, { align: 'center' });

    doc.setFontSize(9);
    doc.setTextColor(...COLOR.mid);
    doc.text(`Generated ${generated}  ·  SY 2025–2026`, PW / 2, 57, { align: 'center' });

    doc.setTextColor(...COLOR.text);
    doc.setFont('helvetica', 'normal');

    // Teal divider
    doc.setFillColor(...COLOR.teal);
    doc.rect(ML, 74, CW, 1, 'F');

    // Key stats grid (2 rows × 4 cols)
    const boxW = 43, boxH = 28, boxGap = 3;
    const row1Y = 80;
    const statCols = [ML, ML + boxW + boxGap, ML + (boxW + boxGap)*2, ML + (boxW + boxGap)*3];

    statBox(statCols[0], row1Y, boxW, boxH, 'Scholar Att. Rate',  pct(data.scholarAttRate),  COLOR.teal);
    statBox(statCols[1], row1Y, boxW, boxH, 'Tutor Att. Rate',    pct(data.tutorAttRate),    COLOR.teal);
    statBox(statCols[2], row1Y, boxW, boxH, 'HIT Compliance',     pct(data.hitRate),         data.hitRate >= 90 ? COLOR.green : COLOR.amber);
    statBox(statCols[3], row1Y, boxW, boxH, 'Sessions Delivered', num(data.totalSessions),   COLOR.navy);

    const row2Y = row1Y + boxH + boxGap;
    statBox(statCols[0], row2Y, boxW, boxH, 'Active Scholars',  num(data.activeScholars),  COLOR.navy);
    statBox(statCols[1], row2Y, boxW, boxH, 'Active Tutors',    num(data.activeTutors),    COLOR.navy);
    statBox(statCols[2], row2Y, boxW, boxH, 'Schools Served',   num(data.uniqueSchools),   COLOR.navy);
    statBox(statCols[3], row2Y, boxW, boxH, 'Districts',        num(data.uniqueDistricts), COLOR.navy);

    // Ratio violations note
    const noteY = row2Y + boxH + 10;
    doc.setFillColor(...COLOR.light);
    doc.roundedRect(ML, noteY, CW, 12, 2, 2, 'F');
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...COLOR.navy);
    doc.text('HIT Compliance Definition', ML + 4, noteY + 5);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(...COLOR.muted);
    doc.text('Sessions with no ratio violation (≤ 4:1 scholar:tutor) ÷ total delivered sessions × 100', ML + 4, noteY + 9.5);
    doc.text(`Ratio violations this period: ${num(data.ratioViolations)}  ·  Highest recorded ratio: ${data.maxRatio > 0 ? data.maxRatio + ':1' : '—'}`, MR - 4, noteY + 9.5, { align: 'right' });

    doc.setTextColor(...COLOR.text);
    doc.setFont('helvetica', 'normal');

    // Table of contents
    const tocY = noteY + 20;
    let y = sectionHeader(tocY, 'Report Contents');
    const pages = [
      ['1', 'Cover & Network Summary',        'This page'],
      ['2', 'Scholar Attendance Analysis',     'Attendance rates, absences, and service interruptions'],
      ['3', 'Tutor Attendance Analysis',       'Tutor-level attendance and absence breakdown'],
      ['4', 'Session Summary by School',       'Delivered sessions per school and district'],
      ['5', 'HIT Compliance Detail',           'Ratio compliance by school with violation counts'],
      ['6', 'Service Interruption Breakdown',  'Reason codes and frequency'],
      ['7', 'Survey Scores',                   'Scholar and instructor satisfaction averages'],
      ['8', 'Top Tutors by Session Hours',     'Ranked tutor engagement and attendance'],
      ['9', 'Instructor Comment Categories',   'Aggregated feedback themes from survey comments'],
    ];
    doc.autoTable({
      startY: y,
      head: [['Page', 'Section', 'Contents']],
      body: pages,
      margin: { left: ML, right: 14 },
      styles: { fontSize: 8, cellPadding: 2.5, textColor: COLOR.text },
      headStyles: { fillColor: COLOR.light, textColor: COLOR.navy, fontStyle: 'bold', fontSize: 8 },
      columnStyles: { 0: { cellWidth: 12 }, 1: { cellWidth: 65, fontStyle: 'bold' } },
      theme: 'plain',
    });

    // ─────────────────────────────────────────────────────────────────────
    // PAGE 2 — SCHOLAR ATTENDANCE
    // ─────────────────────────────────────────────────────────────────────
    newPage();
    y = sectionHeader(15, `Scholar Attendance — ${regionLabel}`);

    // Top stat row
    const a2cols = [ML, ML + 46, ML + 92, ML + 138];
    const a2boxW = 43, a2boxH = 22;
    statBox(a2cols[0], y + 2, a2boxW, a2boxH, 'Attendance Rate',   pct(data.scholarAttRate), data.scholarAttRate >= 80 ? COLOR.green : COLOR.amber);
    statBox(a2cols[1], y + 2, a2boxW, a2boxH, 'Sessions Attended', num(data.stuAttended),    COLOR.teal);
    statBox(a2cols[2], y + 2, a2boxW, a2boxH, 'Sessions Missed',   num(data.stuAbsent),      data.stuAbsent > 50 ? COLOR.red : COLOR.amber);
    statBox(a2cols[3], y + 2, a2boxW, a2boxH, 'Service Interruptions', num(data.stuSI),     COLOR.navy);
    y += a2boxH + 8;

    y = sectionHeader(y, 'Attendance by School');
    const schoolAttRows = data.schools.map(sc => [
      sc.name,
      sc.district || '—',
      pct(sc.attRate),
      num(sc.stuAttended),
      num(sc.stuAbsent),
      num(sc.siCount),
    ]);
    if (schoolAttRows.length === 0) schoolAttRows.push(['No data available', '', '', '', '', '']);
    doc.autoTable({
      startY: y,
      head: [['School', 'District', 'Att. Rate', 'Attended', 'Absent', 'SI']],
      body: schoolAttRows,
      margin: { left: ML, right: 14 },
      styles: { fontSize: 7.5, cellPadding: 2, textColor: COLOR.text },
      headStyles: { fillColor: COLOR.navy, textColor: COLOR.white, fontStyle: 'bold', fontSize: 7.5 },
      alternateRowStyles: { fillColor: COLOR.light },
      columnStyles: {
        0: { cellWidth: 70 }, 1: { cellWidth: 45 },
        2: { cellWidth: 20, halign: 'center' }, 3: { cellWidth: 20, halign: 'center' },
        4: { cellWidth: 20, halign: 'center' }, 5: { cellWidth: 18, halign: 'center' },
      },
      theme: 'plain',
    });

    // ─────────────────────────────────────────────────────────────────────
    // PAGE 3 — TUTOR ATTENDANCE
    // ─────────────────────────────────────────────────────────────────────
    newPage();
    y = sectionHeader(15, `Tutor Attendance — ${regionLabel}`);

    statBox(a2cols[0], y + 2, a2boxW, a2boxH, 'Tutor Att. Rate',   pct(data.tutorAttRate),  data.tutorAttRate >= 80 ? COLOR.green : COLOR.amber);
    statBox(a2cols[1], y + 2, a2boxW, a2boxH, 'Sessions Attended', num(data.instAttended),  COLOR.teal);
    statBox(a2cols[2], y + 2, a2boxW, a2boxH, 'Sessions Missed',   num(data.instAbsent),    data.instAbsent > 20 ? COLOR.red : COLOR.amber);
    statBox(a2cols[3], y + 2, a2boxW, a2boxH, 'Active Tutors',     num(data.activeTutors),  COLOR.navy);
    y += a2boxH + 8;

    y = sectionHeader(y, 'Top 20 Tutors by Attendance');
    const tutorTableRows = data.topTutors.slice(0, 20).map(t => [
      t.name,
      t.school  || '—',
      t.district || '—',
      pct(t.attRate),
      num(t.attended),
      num(t.absent),
      fmt(t.hours, 1) + 'h',
    ]);
    if (tutorTableRows.length === 0) tutorTableRows.push(['No tutor data available', '', '', '', '', '', '']);
    doc.autoTable({
      startY: y,
      head: [['Tutor', 'School', 'District', 'Att. Rate', 'Attended', 'Missed', 'Hours']],
      body: tutorTableRows,
      margin: { left: ML, right: 14 },
      styles: { fontSize: 7.5, cellPadding: 2, textColor: COLOR.text },
      headStyles: { fillColor: COLOR.navy, textColor: COLOR.white, fontStyle: 'bold', fontSize: 7.5 },
      alternateRowStyles: { fillColor: COLOR.light },
      columnStyles: {
        0: { cellWidth: 50 }, 1: { cellWidth: 45 }, 2: { cellWidth: 40 },
        3: { cellWidth: 20, halign: 'center' }, 4: { cellWidth: 16, halign: 'center' },
        5: { cellWidth: 15, halign: 'center' }, 6: { cellWidth: 18, halign: 'center' },
      },
      theme: 'plain',
    });

    // ─────────────────────────────────────────────────────────────────────
    // PAGE 4 — SESSION SUMMARY BY SCHOOL
    // ─────────────────────────────────────────────────────────────────────
    newPage();
    y = sectionHeader(15, `Session Summary — ${regionLabel}`);

    statBox(a2cols[0], y + 2, a2boxW, a2boxH, 'Total Sessions',  num(data.totalSessions),  COLOR.navy);
    statBox(a2cols[1], y + 2, a2boxW, a2boxH, 'Schools Served',  num(data.uniqueSchools),  COLOR.teal);
    statBox(a2cols[2], y + 2, a2boxW, a2boxH, 'Districts',       num(data.uniqueDistricts),COLOR.teal);
    statBox(a2cols[3], y + 2, a2boxW, a2boxH, 'Avg / School',    data.uniqueSchools > 0 ? fmt(data.totalSessions / data.uniqueSchools, 1) : '—', COLOR.navy);
    y += a2boxH + 8;

    // District rollup table
    y = sectionHeader(y, 'Sessions by District');
    const distRows = data.districts.map(d => [
      d.name,
      num(d.schools.length),
      num(d.sessions),
      pct(d.attRate),
      num(d.siCount),
    ]);
    if (distRows.length === 0) distRows.push(['No data', '', '', '', '']);
    doc.autoTable({
      startY: y,
      head: [['District', 'Schools', 'Sessions', 'Att. Rate', 'SI Events']],
      body: distRows,
      margin: { left: ML, right: 14 },
      styles: { fontSize: 8, cellPadding: 2.5, textColor: COLOR.text },
      headStyles: { fillColor: COLOR.navy, textColor: COLOR.white, fontStyle: 'bold', fontSize: 8 },
      alternateRowStyles: { fillColor: COLOR.light },
      columnStyles: {
        0: { cellWidth: 80 }, 1: { cellWidth: 22, halign: 'center' },
        2: { cellWidth: 30, halign: 'center' }, 3: { cellWidth: 28, halign: 'center' },
        4: { cellWidth: 28, halign: 'center' },
      },
      theme: 'plain',
    });

    const afterDistY = doc.lastAutoTable.finalY + 6;
    if (afterDistY < PH - 60) {
      y = sectionHeader(afterDistY, 'Sessions by School');
      const schoolSessRows = data.schools.map(sc => [sc.name, sc.district || '—', num(sc.sessions), pct(sc.attRate)]);
      if (schoolSessRows.length === 0) schoolSessRows.push(['No data', '', '', '']);
      doc.autoTable({
        startY: y,
        head: [['School', 'District', 'Sessions', 'Att. Rate']],
        body: schoolSessRows,
        margin: { left: ML, right: 14 },
        styles: { fontSize: 7.5, cellPadding: 2, textColor: COLOR.text },
        headStyles: { fillColor: COLOR.teal, textColor: COLOR.white, fontStyle: 'bold', fontSize: 7.5 },
        alternateRowStyles: { fillColor: COLOR.light },
        columnStyles: {
          0: { cellWidth: 85 }, 1: { cellWidth: 60 },
          2: { cellWidth: 22, halign: 'center' }, 3: { cellWidth: 22, halign: 'center' },
        },
        theme: 'plain',
      });
    }

    // ─────────────────────────────────────────────────────────────────────
    // PAGE 5 — HIT COMPLIANCE
    // ─────────────────────────────────────────────────────────────────────
    newPage();
    y = sectionHeader(15, `HIT Compliance — ${regionLabel}`);

    statBox(a2cols[0], y + 2, a2boxW, a2boxH, 'HIT Rate',           pct(data.hitRate),         data.hitRate >= 90 ? COLOR.green : COLOR.red);
    statBox(a2cols[1], y + 2, a2boxW, a2boxH, 'Compliant Sessions', num(data.hitSessions),      COLOR.green);
    statBox(a2cols[2], y + 2, a2boxW, a2boxH, 'Ratio Violations',   num(data.ratioViolations),  data.ratioViolations > 0 ? COLOR.red : COLOR.green);
    statBox(a2cols[3], y + 2, a2boxW, a2boxH, 'Max Ratio Recorded', data.maxRatio > 0 ? data.maxRatio + ':1' : '—', data.maxRatio > 4 ? COLOR.red : COLOR.green);
    y += a2boxH + 8;

    doc.setFillColor(...COLOR.light);
    doc.roundedRect(ML, y, CW, 12, 2, 2, 'F');
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...COLOR.navy);
    doc.text('What is HIT Compliance?', ML + 4, y + 5);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(...COLOR.muted);
    doc.text('HIT (High-Intensity Tutoring) requires a ≤ 4:1 scholar-to-tutor ratio. Compliance = sessions without a ratio violation ÷ total delivered sessions × 100.', ML + 4, y + 9.5);
    doc.setTextColor(...COLOR.text);
    y += 18;

    y = sectionHeader(y, 'HIT Compliance by School');
    const hitRows = data.schools.map(sc => {
      const flag = sc.ratioViolations > 0 ? `${sc.ratioViolations} violation${sc.ratioViolations !== 1 ? 's' : ''}` : 'Compliant';
      return [sc.name, sc.district || '—', num(sc.sessions), pct(sc.hitRate), flag];
    });
    if (hitRows.length === 0) hitRows.push(['No data', '', '', '', '']);
    doc.autoTable({
      startY: y,
      head: [['School', 'District', 'Sessions', 'HIT Rate', 'Status']],
      body: hitRows,
      margin: { left: ML, right: 14 },
      styles: { fontSize: 7.5, cellPadding: 2, textColor: COLOR.text },
      headStyles: { fillColor: COLOR.navy, textColor: COLOR.white, fontStyle: 'bold', fontSize: 7.5 },
      alternateRowStyles: { fillColor: COLOR.light },
      columnStyles: {
        0: { cellWidth: 75 }, 1: { cellWidth: 48 },
        2: { cellWidth: 20, halign: 'center' }, 3: { cellWidth: 22, halign: 'center' },
        4: { cellWidth: 28, halign: 'center' },
      },
      didParseCell: function (hookData) {
        if (hookData.section === 'body' && hookData.column.index === 4) {
          if (hookData.cell.raw.includes('violation')) {
            hookData.cell.styles.textColor = COLOR.red;
            hookData.cell.styles.fontStyle = 'bold';
          } else {
            hookData.cell.styles.textColor = COLOR.green;
          }
        }
      },
      theme: 'plain',
    });

    // ─────────────────────────────────────────────────────────────────────
    // PAGE 6 — SERVICE INTERRUPTIONS
    // ─────────────────────────────────────────────────────────────────────
    newPage();
    y = sectionHeader(15, `Service Interruptions — ${regionLabel}`);

    const totalSI = data.stuSI || 0;
    statBox(a2cols[0], y + 2, a2boxW, a2boxH, 'Total SI Events',  num(totalSI),                COLOR.red);
    statBox(a2cols[1], y + 2, a2boxW, a2boxH, 'Scholar Absences', num(data.stuAbsent),         COLOR.amber);
    statBox(a2cols[2], y + 2, a2boxW, a2boxH, '% of Total Missed',
      (data.stuAbsent + totalSI) > 0 ? pct(totalSI / (data.stuAbsent + totalSI) * 100) : '—',
      COLOR.navy);
    statBox(a2cols[3], y + 2, a2boxW, a2boxH, 'Distinct Reasons', num(Object.keys(data.missedReasonCounts).length), COLOR.navy);
    y += a2boxH + 8;

    y = sectionHeader(y, 'Missed Reason Breakdown');
    const sortedReasons = Object.entries(data.missedReasonCounts).sort((a, b) => b[1] - a[1]);
    const totalMissed   = sortedReasons.reduce((s, [, c]) => s + c, 0);
    const reasonRows    = sortedReasons.map(([reason, count]) => [
      reason || 'Unknown',
      num(count),
      totalMissed > 0 ? pct(count / totalMissed * 100) : '—',
    ]);
    if (reasonRows.length === 0) reasonRows.push(['No missed sessions recorded', '—', '—']);
    doc.autoTable({
      startY: y,
      head: [['Miss Reason', 'Count', '% of Total Missed']],
      body: reasonRows,
      margin: { left: ML, right: 14 },
      styles: { fontSize: 8, cellPadding: 2.5, textColor: COLOR.text },
      headStyles: { fillColor: COLOR.navy, textColor: COLOR.white, fontStyle: 'bold', fontSize: 8 },
      alternateRowStyles: { fillColor: COLOR.light },
      columnStyles: {
        0: { cellWidth: 130 }, 1: { cellWidth: 25, halign: 'center' }, 2: { cellWidth: 34, halign: 'center' },
      },
      theme: 'plain',
    });

    // SI by school (top 10)
    const afterSIY = doc.lastAutoTable.finalY + 8;
    if (afterSIY < PH - 60) {
      y = sectionHeader(afterSIY, 'Schools with Most Service Interruptions (Top 10)');
      const siSchoolRows = [...data.schools]
        .sort((a, b) => b.siCount - a.siCount)
        .slice(0, 10)
        .map(sc => [sc.name, sc.district || '—', num(sc.siCount), num(sc.sessions),
          sc.sessions > 0 ? pct(sc.siCount / sc.sessions * 100) : '—']);
      if (siSchoolRows.length === 0) siSchoolRows.push(['No data', '', '', '', '']);
      doc.autoTable({
        startY: y,
        head: [['School', 'District', 'SI Count', 'Sessions', 'SI Rate']],
        body: siSchoolRows,
        margin: { left: ML, right: 14 },
        styles: { fontSize: 7.5, cellPadding: 2, textColor: COLOR.text },
        headStyles: { fillColor: COLOR.teal, textColor: COLOR.white, fontStyle: 'bold', fontSize: 7.5 },
        alternateRowStyles: { fillColor: COLOR.light },
        columnStyles: {
          0: { cellWidth: 75 }, 1: { cellWidth: 50 },
          2: { cellWidth: 22, halign: 'center' }, 3: { cellWidth: 22, halign: 'center' },
          4: { cellWidth: 20, halign: 'center' },
        },
        theme: 'plain',
      });
    }

    // ─────────────────────────────────────────────────────────────────────
    // PAGE 7 — SURVEY SCORES
    // ─────────────────────────────────────────────────────────────────────
    newPage();
    y = sectionHeader(15, `Survey Scores — ${regionLabel}`);

    // Scholar survey summary
    y = sectionHeader(y + 2, `Scholar Surveys (n = ${data.stuSurveyAvg.count})`);
    const stuSurveyCols = [ML, ML + 46, ML + 92, ML + 138];
    const survBoxW = 43, survBoxH = 22;
    statBox(stuSurveyCols[0], y + 2, survBoxW, survBoxH, 'Confidence',  fmt(data.stuSurveyAvg.confidence, 2), COLOR.teal);
    statBox(stuSurveyCols[1], y + 2, survBoxW, survBoxH, 'Enjoyment',   fmt(data.stuSurveyAvg.enjoyment,  2), COLOR.teal);
    statBox(stuSurveyCols[2], y + 2, survBoxW, survBoxH, 'Learning',    fmt(data.stuSurveyAvg.learning,   2), COLOR.teal);
    statBox(stuSurveyCols[3], y + 2, survBoxW, survBoxH, 'Overall',     fmt(data.stuSurveyAvg.overall,    2), data.stuSurveyAvg.overall >= 4 ? COLOR.green : COLOR.amber);
    y += survBoxH + 10;

    // Instructor survey summary
    y = sectionHeader(y, `Instructor Surveys (n = ${data.instSurveyAvg.count})`);
    statBox(stuSurveyCols[0], y + 2, survBoxW, survBoxH, 'Engagement',  fmt(data.instSurveyAvg.engagement, 2), COLOR.navy);
    statBox(stuSurveyCols[1], y + 2, survBoxW, survBoxH, 'Enjoyment',   fmt(data.instSurveyAvg.enjoyment,  2), COLOR.navy);
    statBox(stuSurveyCols[2], y + 2, survBoxW, survBoxH, 'Learning',    fmt(data.instSurveyAvg.learning,   2), COLOR.navy);
    statBox(stuSurveyCols[3], y + 2, survBoxW, survBoxH, 'Overall',     fmt(data.instSurveyAvg.overall,    2), data.instSurveyAvg.overall >= 4 ? COLOR.green : COLOR.amber);
    y += survBoxH + 10;

    // Survey scores by school
    y = sectionHeader(y, 'Survey Averages by School');
    const schoolSurvRows = data.schools.map(sc => [
      sc.name,
      sc.district || '—',
      fmt(sc.stuSurveyAvg,  2),
      fmt(sc.instSurveyAvg, 2),
    ]);
    if (schoolSurvRows.length === 0) schoolSurvRows.push(['No survey data', '', '', '']);
    doc.autoTable({
      startY: y,
      head: [['School', 'District', 'Scholar Survey Avg', 'Tutor Survey Avg']],
      body: schoolSurvRows,
      margin: { left: ML, right: 14 },
      styles: { fontSize: 7.5, cellPadding: 2, textColor: COLOR.text },
      headStyles: { fillColor: COLOR.navy, textColor: COLOR.white, fontStyle: 'bold', fontSize: 7.5 },
      alternateRowStyles: { fillColor: COLOR.light },
      columnStyles: {
        0: { cellWidth: 80 }, 1: { cellWidth: 60 },
        2: { cellWidth: 35, halign: 'center' }, 3: { cellWidth: 14, halign: 'center' },
      },
      theme: 'plain',
    });

    // ─────────────────────────────────────────────────────────────────────
    // PAGE 8 — TOP TUTORS BY HOURS
    // ─────────────────────────────────────────────────────────────────────
    newPage();
    y = sectionHeader(15, `Top Tutors by Session Hours — ${regionLabel}`);

    const topTutorRows = data.topTutors.map((t, i) => [
      i + 1,
      t.name,
      t.school   || '—',
      t.district || '—',
      fmt(t.hours, 1) + 'h',
      pct(t.attRate),
      num(t.attended),
      num(t.absent),
    ]);
    if (topTutorRows.length === 0) topTutorRows.push(['—', 'No tutor data available', '', '', '', '', '', '']);
    doc.autoTable({
      startY: y + 4,
      head: [['#', 'Tutor', 'School', 'District', 'Hours', 'Att. Rate', 'Attended', 'Missed']],
      body: topTutorRows,
      margin: { left: ML, right: 14 },
      styles: { fontSize: 7.5, cellPadding: 2, textColor: COLOR.text },
      headStyles: { fillColor: COLOR.navy, textColor: COLOR.white, fontStyle: 'bold', fontSize: 7.5 },
      alternateRowStyles: { fillColor: COLOR.light },
      columnStyles: {
        0: { cellWidth: 8,  halign: 'center' },
        1: { cellWidth: 48 }, 2: { cellWidth: 45 }, 3: { cellWidth: 40 },
        4: { cellWidth: 18, halign: 'center' }, 5: { cellWidth: 18, halign: 'center' },
        6: { cellWidth: 16, halign: 'center' }, 7: { cellWidth: 16, halign: 'center' },
      },
      theme: 'plain',
    });

    // ─────────────────────────────────────────────────────────────────────
    // PAGE 9 — INSTRUCTOR COMMENT CATEGORIES
    // ─────────────────────────────────────────────────────────────────────
    newPage();
    y = sectionHeader(15, `Instructor Comment Categories — ${regionLabel}`);

    const BUCKET_LABELS = {
      concern:      'Concern / Challenges',
      positive:     'Positive Feedback',
      engagement:   'Scholar Engagement',
      logistics:    'Logistics / Scheduling',
      curriculum:   'Curriculum / Content',
      relationship: 'Relationship Building',
      other:        'Other / Uncategorized',
    };

    const totalComments  = Object.values(data.commentCounts).reduce((s, c) => s + c, 0);
    const commentEntries = Object.entries(BUCKET_LABELS).map(([key, label]) => {
      const count = data.commentCounts[key] || 0;
      return { key, label, count, pct: totalComments > 0 ? count / totalComments : 0 };
    }).filter(e => e.count > 0).sort((a, b) => b.count - a.count);

    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...COLOR.muted);
    doc.text(
      `${num(totalComments)} instructor survey comments categorized by theme using keyword matching.`,
      ML, y + 6
    );
    doc.setTextColor(...COLOR.text);
    y += 14;

    // Bar chart (manual, using filled rects)
    const barMaxW = CW * 0.55;
    const barH    = 9;
    const barGap  = 4;
    const labelW  = 60;
    const maxCnt  = commentEntries.length > 0 ? commentEntries[0].count : 1;

    const barColors = [COLOR.teal, COLOR.navy, COLOR.green, COLOR.amber, COLOR.red, COLOR.teal, COLOR.mid];

    commentEntries.forEach((e, i) => {
      const rowY   = y + i * (barH + barGap);
      const barW   = maxCnt > 0 ? barMaxW * (e.count / maxCnt) : 0;
      const clr    = barColors[i % barColors.length];

      // Category label
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...COLOR.text);
      doc.text(e.label, ML, rowY + barH - 2.5);

      // Bar
      doc.setFillColor(...clr);
      doc.roundedRect(ML + labelW, rowY, Math.max(barW, 2), barH, 1, 1, 'F');

      // Count + pct
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...COLOR.muted);
      doc.setFontSize(7.5);
      doc.text(`${e.count}  (${pct(e.pct * 100)})`, ML + labelW + barMaxW + 4, rowY + barH - 2.5);
    });

    if (commentEntries.length === 0) {
      doc.setFontSize(9);
      doc.setTextColor(...COLOR.muted);
      doc.text('No instructor survey comments available for this region.', ML, y + 10);
    }

    y += (commentEntries.length || 1) * (barH + barGap) + 16;

    // Summary table
    y = sectionHeader(y, 'Comment Category Summary Table');
    const commentTableRows = commentEntries.length > 0
      ? commentEntries.map(e => [e.label, num(e.count), pct(e.pct * 100)])
      : [['No comment data available', '—', '—']];
    commentTableRows.push(['TOTAL', num(totalComments), '100%']);

    doc.autoTable({
      startY: y,
      head: [['Category', 'Comments', '% of Total']],
      body: commentTableRows,
      margin: { left: ML, right: 14 },
      styles: { fontSize: 8.5, cellPadding: 3, textColor: COLOR.text },
      headStyles: { fillColor: COLOR.navy, textColor: COLOR.white, fontStyle: 'bold', fontSize: 8.5 },
      alternateRowStyles: { fillColor: COLOR.light },
      columnStyles: {
        0: { cellWidth: 100 }, 1: { cellWidth: 40, halign: 'center' }, 2: { cellWidth: 40, halign: 'center' },
      },
      didParseCell: function (hookData) {
        // Bold the TOTAL row
        if (hookData.section === 'body' && hookData.row.index === commentTableRows.length - 1) {
          hookData.cell.styles.fontStyle = 'bold';
          hookData.cell.styles.fillColor = COLOR.light;
        }
      },
      theme: 'plain',
    });

    return doc;
  }

  // ── Public export function ─────────────────────────────────────────────────
  window.njtcPDFExport = {
    generate: async function (regionFilter) {
      // Validate Pearl data is loaded
      if (!window.po || typeof window.po.getExportData !== 'function') {
        alert('Pearl Ops data is not loaded yet. Please wait for the dashboard to finish loading, then try again.');
        return;
      }

      const btn = document.querySelector(`[data-pdf-region="${regionFilter}"]`);
      const originalText = btn ? btn.textContent : '';
      if (btn) { btn.textContent = 'Generating…'; btn.disabled = true; }

      try {
        await loadJsPDF();

        const data = window.po.getExportData(regionFilter);

        if (!data || data.totalSessions === 0) {
          alert(`No session data found for ${regionFilter === 'ALL' ? 'the network' : regionFilter + ' Region'}. Ensure Pearl data has finished loading.`);
          if (btn) { btn.textContent = originalText; btn.disabled = false; }
          return;
        }

        const doc = buildPDF(data);

        const regionSlug = regionFilter === 'NE' ? 'NE-Region'
                        : regionFilter === 'SW' ? 'SW-Region'
                        : 'Network';
        const dateStr    = new Date().toISOString().slice(0, 10);
        const filename   = `NJTC-Pearl-${regionSlug}-${dateStr}.pdf`;

        triggerDownload(doc, filename);
      } catch (err) {
        console.error('[NJTC PDF]', err);
        alert('PDF generation failed: ' + err.message + '\n\nEnsure you have an internet connection (unpkg.com is required to load the PDF library).');
      } finally {
        if (btn) { btn.textContent = originalText; btn.disabled = false; }
      }
    },
  };
})();
