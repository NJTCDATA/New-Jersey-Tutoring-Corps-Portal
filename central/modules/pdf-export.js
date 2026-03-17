// ─────────────────────────────────────────────────────────────────────────────
// NJTC Pearl Ops — PDF Export  (v3)
// 4-section executive report: Cover/Aggregates → Positives → Growing Pains → Summary
// jsPDF 2.5.1 + jsPDF-AutoTable 3.8.2 loaded on demand from unpkg.com
// PC/Mac safe: revokeObjectURL delayed 2 s to avoid Windows AV freeze
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
    amberBg: [255,251,235],
  };

  // ── Benchmarks ────────────────────────────────────────────────────────────
  const BM = { scholAtt: 85, tutorAtt: 90, hit: 95, survey: 4.0, capture: 80 };

  function statusColor(rate, benchmark) {
    if (rate == null || isNaN(rate)) return C.mid;
    if (rate >= benchmark)           return C.green;
    if (rate >= benchmark - 5)       return C.amber;
    return C.red;
  }

  // ── Format helpers ─────────────────────────────────────────────────────────
  function fmt(n, d) {
    if (n == null || isNaN(n)) return '--';
    return parseFloat(n).toFixed(d === undefined ? 0 : d);
  }
  function pct(n, d) {
    if (n == null || isNaN(n)) return '--';
    return fmt(n, d === undefined ? 1 : d) + '%';
  }
  function num(n) {
    if (n == null) return '--';
    return Number(n).toLocaleString('en-US');
  }
  function hrs(n) {
    if (n == null || isNaN(n)) return '--';
    return parseFloat(n).toFixed(1) + 'h';
  }
  function trunc(s, max) {
    s = String(s || '');
    return s.length > max ? s.slice(0, max - 2) + '..' : s;
  }

  // ── Library loader ─────────────────────────────────────────────────────────
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

  // ── PC-safe download ───────────────────────────────────────────────────────
  function triggerDownload(doc, filename) {
    const blob = doc.output('blob');
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PDF BUILDER
  // ─────────────────────────────────────────────────────────────────────────
  function buildPDF(data) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' });

    const PW = 215.9, PH = 279.4;
    const ML = 14;
    const MR = PW - 14;
    const SAFE = MR - ML;          // ~188 mm
    const FOOTER_H = 10;
    const TOP_START = 16;
    const BOTTOM_LIMIT = PH - FOOTER_H - 8;

    const regionLabel = data.region === 'NE' ? 'NE Region'
                      : data.region === 'SW' ? 'SW Region'
                      : 'Network Aggregate';
    const generated = new Date(data.generatedAt).toLocaleDateString('en-US',
      { month: 'long', day: 'numeric', year: 'numeric' });

    // ── Two-pass footer ────────────────────────────────────────────────────
    function stampFooters() {
      const total = doc.getNumberOfPages();
      for (let i = 1; i <= total; i++) {
        doc.setPage(i);
        doc.setFillColor(...C.navy);
        doc.rect(0, PH - FOOTER_H, PW, FOOTER_H, 'F');
        doc.setFontSize(7);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...C.white);
        doc.text('New Jersey Tutoring Corps  -  Pearl Operations Report  -  Confidential', ML, PH - 3.5);
        doc.text('Page ' + i + ' of ' + total, MR, PH - 3.5, { align: 'right' });
      }
      doc.setTextColor(...C.body);
    }

    // ── Drawing helpers ────────────────────────────────────────────────────

    /** Full-width navy section header. Returns y after. */
    function secHeader(y, title, accent) {
      if (y > BOTTOM_LIMIT - 30) { doc.addPage(); y = TOP_START; }
      const bg = accent || C.navy;
      doc.setFillColor(...bg);
      doc.rect(ML, y, SAFE, 9, 'F');
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...C.white);
      doc.text(title, ML + 4, y + 6.2);
      doc.setTextColor(...C.body);
      doc.setFont('helvetica', 'normal');
      return y + 11;
    }

    /** KPI card. */
    function kpiCard(x, y, w, h, value, label, color) {
      doc.setFillColor(...C.white);
      doc.roundedRect(x, y, w, h, 2, 2, 'F');
      doc.setDrawColor(...C.mid);
      doc.setLineWidth(0.3);
      doc.roundedRect(x, y, w, h, 2, 2, 'S');
      doc.setFillColor(...C.teal);
      doc.rect(x, y, 2.5, h, 'F');
      doc.setFontSize(18);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...(color || C.navy));
      doc.text(String(value), x + w / 2, y + h / 2 + 2, { align: 'center' });
      doc.setFontSize(7);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...C.muted);
      doc.text(label, x + w / 2, y + h - 3, { align: 'center' });
      doc.setTextColor(...C.body);
    }

    /**
     * Two-column panel row.
     * leftItems/rightItems = [{label, value, valueColor?, bold?}] or null
     * subtitle = small text below panel header
     * Returns y after both panels.
     */
    function twoColPanels(y, leftTitle, leftLines, rightTitle, rightLines) {
      if (y > BOTTOM_LIMIT - 35) { doc.addPage(); y = TOP_START; }

      const colW = (SAFE - 6) / 2;   // ~91 mm
      const col2X = ML + colW + 6;
      const ITEM_H = 5.8;
      const PAD = 3;
      const headerH = 8;

      // ── Panel headers ──────────────────────────────────────────────────
      [ML, col2X].forEach(px => {
        doc.setFillColor(...C.navy);
        doc.roundedRect(px, y, colW, headerH, 2, 2, 'F');
      });
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...C.white);
      doc.text(leftTitle,  ML    + colW / 2, y + 5.3, { align: 'center' });
      doc.text(rightTitle, col2X + colW / 2, y + 5.3, { align: 'center' });
      doc.setTextColor(...C.body);
      doc.setFont('helvetica', 'normal');

      // ── Draw lines in each column ──────────────────────────────────────
      function drawLines(px, lines) {
        let cy = y + headerH + PAD;
        (lines || []).forEach(line => {
          const itemW = colW - PAD * 2;
          if (line.type === 'divider') {
            doc.setDrawColor(...C.mid);
            doc.setLineWidth(0.3);
            doc.line(px + PAD, cy, px + colW - PAD, cy);
            cy += 3;
            return;
          }
          if (line.type === 'subtitle') {
            doc.setFontSize(7);
            doc.setFont('helvetica', 'italic');
            doc.setTextColor(...C.muted);
            doc.text(trunc(line.text, 52), px + PAD, cy + 3.5);
            doc.setFont('helvetica', 'normal');
            cy += ITEM_H;
            return;
          }
          // Standard item: label left, value right
          const label = trunc(line.label || '', 42);
          const value = String(line.value || '');
          doc.setFontSize(7.5);
          doc.setFont('helvetica', line.bold ? 'bold' : 'normal');
          doc.setTextColor(...C.muted);
          doc.text(label, px + PAD, cy + 3.5);
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(...(line.valueColor || C.navy));
          doc.text(value, px + colW - PAD, cy + 3.5, { align: 'right' });
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(...C.body);
          cy += ITEM_H;
        });
        return cy + PAD;
      }

      const leftEndY  = drawLines(ML,    leftLines);
      const rightEndY = drawLines(col2X, rightLines);
      const endY = Math.max(leftEndY, rightEndY);

      // ── Panel bottom borders ───────────────────────────────────────────
      [ML, col2X].forEach(px => {
        doc.setDrawColor(...C.light);
        doc.setLineWidth(0.5);
        doc.roundedRect(px, y, colW, endY - y, 2, 2, 'S');
      });

      return endY + 5;
    }

    // ── Pre-compute highlights ─────────────────────────────────────────────

    // Schools with at least 5 sessions
    const activeSch = data.schools.filter(s => s.sessions >= 5);

    // Attendance leaders (top 3 by att rate, min 5 sessions)
    const attLeaders  = [...activeSch].sort((a,b) => b.attRate - a.attRate).slice(0, 3);
    const attConcerns = [...activeSch].filter(s => s.attRate < BM.scholAtt).sort((a,b) => a.attRate - b.attRate).slice(0, 5);
    const aboveBMCount = activeSch.filter(s => s.attRate >= BM.scholAtt).length;

    // HIT
    const hitSchools  = activeSch.filter(s => s.ratioViolations > 0).sort((a,b) => b.ratioViolations - a.ratioViolations);
    const hitCompliant = activeSch.filter(s => s.ratioViolations === 0);

    // Top tutors
    const topTutors5 = data.topTutors.slice(0, 5);
    const totalHrs   = data.topTutors.reduce((s, t) => s + (t.hours || 0), 0);

    // Survey capture leaders/laggards (min 5 eligible)
    const scholCapList  = data.schools.filter(s => s.scholCaptureRate !== null);
    const capLeaders    = [...scholCapList].sort((a,b) => b.scholCaptureRate - a.scholCaptureRate).slice(0, 3);
    const capConcerns   = [...scholCapList].sort((a,b) => a.scholCaptureRate - b.scholCaptureRate).slice(0, 5);

    // Service interruptions
    const siReasons = Object.entries(data.missedReasonCounts || {})
      .sort((a,b) => b[1] - a[1]).slice(0, 5);
    const totalSI = data.stuSI || 0;

    // ─────────────────────────────────────────────────────────────────────
    // PAGE 1 — COVER + AGGREGATES
    // ─────────────────────────────────────────────────────────────────────
    doc.setFillColor(...C.navy);
    doc.rect(0, 0, PW, 64, 'F');

    // Org name
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...C.teal);
    doc.text('NEW JERSEY TUTORING CORPS', PW / 2, 17, { align: 'center' });

    // Report title
    doc.setFontSize(26);
    doc.setTextColor(...C.white);
    doc.text('Pearl Operations', PW / 2, 33, { align: 'center' });

    // Region pill
    const pW = 66, pH = 9, pX = PW / 2 - pW / 2, pY = 38;
    doc.setFillColor(...C.teal);
    doc.roundedRect(pX, pY, pW, pH, 4, 4, 'F');
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...C.white);
    doc.text(regionLabel + ' Report', PW / 2, pY + 6.2, { align: 'center' });

    // Generated date
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(180, 195, 210);
    doc.text('Generated ' + generated + '  -  SY 2025-2026', PW / 2, 57, { align: 'center' });
    doc.setTextColor(...C.body);

    // ── KPI cards — Row 1 ─────────────────────────────────────────────────
    const cardW = (SAFE - 9) / 4, cardH = 25, cardGap = 3;
    const row1Y = 70, row2Y = row1Y + cardH + cardGap;

    const kpiRow1 = [
      { v: pct(data.scholarAttRate, 1), l: 'Scholar Att. Rate',  c: statusColor(data.scholarAttRate, BM.scholAtt) },
      { v: pct(data.tutorAttRate, 1),   l: 'Tutor Att. Rate',    c: statusColor(data.tutorAttRate,   BM.tutorAtt) },
      { v: pct(data.hitRate, 0),        l: 'HIT Compliance',     c: statusColor(data.hitRate,        BM.hit)      },
      { v: num(data.totalSessions),     l: 'Sessions Delivered', c: C.navy },
    ];
    const kpiRow2 = [
      { v: num(data.activeScholars),   l: 'Active Scholars',  c: C.navy },
      { v: num(data.activeTutors),     l: 'Active Tutors',    c: C.navy },
      { v: num(data.uniqueSchools),    l: 'Schools Served',   c: C.navy },
      { v: num(data.uniqueDistricts),  l: 'Districts',        c: C.navy },
    ];
    [kpiRow1, kpiRow2].forEach((row, ri) => {
      row.forEach((kpi, ci) => {
        kpiCard(ML + ci * (cardW + cardGap), ri === 0 ? row1Y : row2Y, cardW, cardH, kpi.v, kpi.l, kpi.c);
      });
    });

    // ── Survey capture summary bar ─────────────────────────────────────────
    const capY = row2Y + cardH + 6;
    doc.setFillColor(...C.light);
    doc.roundedRect(ML, capY, SAFE, 16, 2, 2, 'F');
    doc.setFillColor(...C.teal);
    doc.rect(ML, capY, 3, 16, 'F');

    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...C.navy);
    doc.text('Survey Capture Rates', ML + 6, capY + 5.5);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(...C.muted);
    doc.text(
      'Scholar: ' + pct(data.scholCaptureRate, 0) + ' capture  (' + num(data.totalScholSubm) + ' of ' + num(data.totalScholElig) + ' eligible)' +
      '     Tutor: ' + pct(data.tutorCaptureRate, 0) + ' capture  (' + num(data.totalTutorSubm) + ' of ' + num(data.totalTutorElig) + ' eligible)',
      ML + 6, capY + 12
    );
    doc.setTextColor(...C.body);

    // ── Section map ────────────────────────────────────────────────────────
    const smY = capY + 24;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...C.navy);
    doc.text('Report Sections', ML, smY);
    doc.setDrawColor(...C.teal);
    doc.setLineWidth(0.6);
    doc.line(ML, smY + 2, MR, smY + 2);

    const sections = [
      ['P.1', 'Cover + Aggregates',           '8 key metrics at-a-glance across the ' + regionLabel],
      ['P.2', 'Positives — What\'s Working',  'Attendance leaders, top tutors, HIT champions, survey excellence'],
      ['P.3', 'Growing Pains',                'Attendance concerns, HIT violations, capture gaps, SI hotspots'],
      ['P.4', 'Executive Summary',            'Narrative overview with specific examples and recommended actions'],
    ];
    doc.setFontSize(8);
    sections.forEach((row, i) => {
      const ry = smY + 8 + i * 7.5;
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...C.teal);
      doc.text(row[0], ML, ry);
      doc.setTextColor(...C.navy);
      doc.text(row[1], ML + 12, ry);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...C.muted);
      doc.text(row[2], ML + 68, ry);
    });
    doc.setTextColor(...C.body);

    // ── Mission strip ──────────────────────────────────────────────────────
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

    // ─────────────────────────────────────────────────────────────────────
    // PAGE 2 — POSITIVES: WHAT'S WORKING WELL
    // ─────────────────────────────────────────────────────────────────────
    doc.addPage();
    let y = secHeader(TOP_START, 'POSITIVES  -  WHAT\'S WORKING WELL', C.teal);

    // ── Panel Row 1: Attendance Leaders + HIT Champions ───────────────────
    const attLeaderLines = [];
    attLeaderLines.push({ type: 'subtitle', text: aboveBMCount + ' of ' + activeSch.length + ' schools at or above 85% benchmark' });
    attLeaderLines.push({ type: 'divider' });
    if (attLeaders.length > 0) {
      attLeaders.forEach((sc, i) => {
        attLeaderLines.push({
          label: (i + 1) + '. ' + trunc(sc.name, 36),
          value: pct(sc.attRate, 1),
          valueColor: statusColor(sc.attRate, BM.scholAtt),
        });
      });
    } else {
      attLeaderLines.push({ label: 'No school data available', value: '--' });
    }
    attLeaderLines.push({ type: 'divider' });
    attLeaderLines.push({
      label: 'Network scholar att. rate',
      value: pct(data.scholarAttRate, 1),
      valueColor: statusColor(data.scholarAttRate, BM.scholAtt),
    });
    attLeaderLines.push({
      label: 'Total attended / missed',
      value: num(data.stuAttended) + ' / ' + num(data.stuAbsent),
      valueColor: C.navy,
    });

    const hitChampLines = [];
    if (data.hitRate >= BM.hit) {
      hitChampLines.push({ type: 'subtitle', text: 'Meeting HIT benchmark of 95% - sessions at 4:1 ratio or better' });
    } else {
      hitChampLines.push({ type: 'subtitle', text: pct(data.hitRate, 0) + ' HIT compliance (' + num(data.hitSessions) + ' of ' + num(data.totalSessions) + ' sessions)' });
    }
    hitChampLines.push({ type: 'divider' });
    if (hitCompliant.length > 0) {
      const showHit = hitCompliant.slice(0, 5);
      showHit.forEach((sc, i) => {
        hitChampLines.push({
          label: (i + 1) + '. ' + trunc(sc.name, 36),
          value: '100%',
          valueColor: C.green,
        });
      });
      if (hitCompliant.length > 5) {
        hitChampLines.push({ type: 'subtitle', text: '+ ' + (hitCompliant.length - 5) + ' more fully compliant schools' });
      }
    } else {
      hitChampLines.push({ label: 'No fully compliant schools recorded', value: '--' });
    }
    hitChampLines.push({ type: 'divider' });
    hitChampLines.push({
      label: 'Network HIT rate',
      value: pct(data.hitRate, 0),
      valueColor: statusColor(data.hitRate, BM.hit),
    });
    hitChampLines.push({
      label: 'Ratio violations',
      value: num(data.ratioViolations),
      valueColor: data.ratioViolations > 0 ? C.red : C.green,
    });

    y = twoColPanels(y, 'Scholar Attendance Leaders', attLeaderLines, 'HIT Compliance Champions', hitChampLines);

    // ── Panel Row 2: Top Tutors + Survey Excellence ───────────────────────
    const tutorLines = [];
    const totalTutorHrs = parseFloat(totalHrs.toFixed(1));
    tutorLines.push({ type: 'subtitle', text: num(data.activeTutors) + ' active tutors  -  ' + hrs(totalTutorHrs) + ' delivered network-wide' });
    tutorLines.push({ type: 'divider' });
    if (topTutors5.length > 0) {
      topTutors5.forEach((t, i) => {
        tutorLines.push({
          label: (i + 1) + '. ' + trunc(t.name, 30) + '  (' + trunc(t.school, 14) + ')',
          value: hrs(t.hours),
          valueColor: C.teal,
        });
      });
    } else {
      tutorLines.push({ label: 'No tutor hour data available', value: '--' });
    }
    tutorLines.push({ type: 'divider' });
    tutorLines.push({
      label: 'Tutor attendance rate',
      value: pct(data.tutorAttRate, 1),
      valueColor: statusColor(data.tutorAttRate, BM.tutorAtt),
    });

    const surveyLines = [];
    const scholOverall = data.stuSurveyAvg && data.stuSurveyAvg.overall;
    const instOverall  = data.instSurveyAvg && data.instSurveyAvg.overall;
    surveyLines.push({ type: 'subtitle', text: 'Survey scores on 1-5 scale. Capture: scholars ' + pct(data.scholCaptureRate, 0) + ', tutors ' + pct(data.tutorCaptureRate, 0) });
    surveyLines.push({ type: 'divider' });
    surveyLines.push({ label: 'Scholar overall avg (n=' + num((data.stuSurveyAvg || {}).count) + ')', value: fmt(scholOverall, 2) + ' / 5.0', valueColor: scholOverall >= 4.0 ? C.green : scholOverall >= 3.5 ? C.amber : C.red });
    surveyLines.push({ label: '  Confidence', value: fmt((data.stuSurveyAvg || {}).confidence, 2), valueColor: C.teal });
    surveyLines.push({ label: '  Enjoyment',  value: fmt((data.stuSurveyAvg || {}).enjoyment, 2),  valueColor: C.teal });
    surveyLines.push({ label: '  Learning',   value: fmt((data.stuSurveyAvg || {}).learning, 2),   valueColor: C.teal });
    surveyLines.push({ type: 'divider' });
    surveyLines.push({ label: 'Tutor overall avg (n=' + num((data.instSurveyAvg || {}).count) + ')', value: fmt(instOverall, 2) + ' / 5.0', valueColor: instOverall >= 4.0 ? C.green : instOverall >= 3.5 ? C.amber : C.red });
    if (capLeaders.length > 0) {
      surveyLines.push({ type: 'divider' });
      surveyLines.push({ type: 'subtitle', text: 'Top scholar survey capture:' });
      capLeaders.forEach((sc, i) => {
        surveyLines.push({
          label: (i + 1) + '. ' + trunc(sc.name, 34),
          value: pct(sc.scholCaptureRate, 0),
          valueColor: C.green,
        });
      });
    }

    y = twoColPanels(y, 'Top Tutors by Instructional Hours', tutorLines, 'Survey Scores & Capture', surveyLines);

    // ─────────────────────────────────────────────────────────────────────
    // PAGE 3 — GROWING PAINS: AREAS NEEDING ATTENTION
    // ─────────────────────────────────────────────────────────────────────
    doc.addPage();
    y = secHeader(TOP_START, 'GROWING PAINS  -  AREAS NEEDING ATTENTION', C.red);

    // ── Panel Row 1: Attendance Concerns + HIT Violations ────────────────
    const attConcernLines = [];
    if (attConcerns.length > 0) {
      attConcernLines.push({ type: 'subtitle', text: attConcerns.length + ' school(s) below the 85% attendance benchmark' });
      attConcernLines.push({ type: 'divider' });
      attConcerns.forEach((sc, i) => {
        const gap = (BM.scholAtt - sc.attRate).toFixed(1);
        attConcernLines.push({
          label: (i + 1) + '. ' + trunc(sc.name, 30) + '  (-' + gap + '% below)',
          value: pct(sc.attRate, 1),
          valueColor: C.red,
        });
      });
    } else {
      attConcernLines.push({ type: 'subtitle', text: 'All schools meeting the 85% attendance benchmark' });
      attConcernLines.push({ type: 'divider' });
      attConcernLines.push({ label: 'No attendance concerns identified', value: '--', valueColor: C.green });
    }
    attConcernLines.push({ type: 'divider' });
    attConcernLines.push({ label: 'Total scholar absences', value: num(data.stuAbsent), valueColor: data.stuAbsent > 50 ? C.red : C.amber });
    attConcernLines.push({ label: 'Service interruptions', value: num(data.stuSI), valueColor: C.amber });

    const hitViolLines = [];
    if (hitSchools.length > 0) {
      hitViolLines.push({ type: 'subtitle', text: hitSchools.length + ' school(s) recorded HIT ratio violations (>4:1)' });
      hitViolLines.push({ type: 'divider' });
      hitSchools.slice(0, 5).forEach((sc, i) => {
        hitViolLines.push({
          label: (i + 1) + '. ' + trunc(sc.name, 30) + '  (' + num(sc.sessions) + ' sess)',
          value: num(sc.ratioViolations) + ' viol.',
          valueColor: C.red,
        });
      });
    } else {
      hitViolLines.push({ type: 'subtitle', text: 'No HIT ratio violations recorded - fully compliant' });
      hitViolLines.push({ type: 'divider' });
      hitViolLines.push({ label: 'All sessions at 4:1 ratio or better', value: '--', valueColor: C.green });
    }
    hitViolLines.push({ type: 'divider' });
    hitViolLines.push({ label: 'Network HIT rate', value: pct(data.hitRate, 0), valueColor: statusColor(data.hitRate, BM.hit) });
    hitViolLines.push({ label: 'Highest ratio recorded', value: (data.maxRatio > 0 ? data.maxRatio + ':1' : '--'), valueColor: data.maxRatio > 4 ? C.red : C.green });

    y = twoColPanels(y, 'Attendance Concerns', attConcernLines, 'HIT Compliance Violations', hitViolLines);

    // ── Panel Row 2: Survey Capture Gaps + Service Interruptions ─────────
    const capGapLines = [];
    if (capConcerns.length > 0) {
      const belowBM = capConcerns.filter(s => s.scholCaptureRate < BM.capture).length;
      capGapLines.push({ type: 'subtitle', text: belowBM + ' of ' + scholCapList.length + ' schools below 80% scholar capture target' });
      capGapLines.push({ type: 'divider' });
      capConcerns.forEach((sc, i) => {
        capGapLines.push({
          label: (i + 1) + '. ' + trunc(sc.name, 26) + '  (' + sc.scholCaptureSubm + '/' + sc.scholCaptureElig + ')',
          value: pct(sc.scholCaptureRate, 0),
          valueColor: statusColor(sc.scholCaptureRate, BM.capture),
        });
      });
    } else {
      capGapLines.push({ type: 'subtitle', text: 'Insufficient data for capture rate rankings' });
      capGapLines.push({ label: 'Minimum 5 eligible events per school required', value: '--' });
    }
    capGapLines.push({ type: 'divider' });
    capGapLines.push({ label: 'Network scholar capture', value: pct(data.scholCaptureRate, 0), valueColor: statusColor(data.scholCaptureRate, BM.capture) });
    capGapLines.push({ label: 'Network tutor capture',   value: pct(data.tutorCaptureRate, 0),  valueColor: statusColor(data.tutorCaptureRate, BM.capture) });

    const siLines = [];
    siLines.push({ type: 'subtitle', text: num(totalSI) + ' SI events  -  ' + num(Object.keys(data.missedReasonCounts || {}).length) + ' distinct reasons recorded' });
    siLines.push({ type: 'divider' });
    if (siReasons.length > 0) {
      const totalReasonCt = siReasons.reduce((s, [, c]) => s + c, 0);
      siReasons.forEach(([reason, count], i) => {
        const share = totalReasonCt > 0 ? Math.round(count / totalReasonCt * 100) : 0;
        siLines.push({
          label: (i + 1) + '. ' + trunc(reason || 'Unknown', 34),
          value: num(count) + ' (' + share + '%)',
          valueColor: i === 0 ? C.red : C.amber,
        });
      });
    } else {
      siLines.push({ label: 'No service interruption data recorded', value: '--', valueColor: C.green });
    }
    siLines.push({ type: 'divider' });
    siLines.push({
      label: 'SI as % of all missed events',
      value: (data.stuAbsent + totalSI) > 0 ? pct(totalSI / (data.stuAbsent + totalSI) * 100, 1) : '--',
      valueColor: C.amber,
    });

    y = twoColPanels(y, 'Survey Capture Gaps', capGapLines, 'Service Interruption Hotspots', siLines);

    // ── Bottom tutors by capture rate ─────────────────────────────────────
    if (data.tutorCaptureBottom && data.tutorCaptureBottom.length > 0) {
      y = secHeader(y, 'Tutors Needing Survey Capture Support (Bottom 5)', C.amber);
      data.tutorCaptureBottom.forEach((t, i) => {
        doc.setFontSize(7.5);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...C.muted);
        doc.text((i + 1) + '. ' + trunc(t.name, 40) + '  ' + trunc(t.school, 24), ML + 3, y + 4.5);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...statusColor(t.captureRate, BM.capture));
        doc.text(pct(t.captureRate, 0) + '  (' + t.submitted + '/' + t.eligible + ')', MR - 3, y + 4.5, { align: 'right' });
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...C.body);
        y += 6.5;
      });
      y += 4;
    }

    // ─────────────────────────────────────────────────────────────────────
    // PAGE 4 — EXECUTIVE SUMMARY
    // ─────────────────────────────────────────────────────────────────────
    doc.addPage();
    y = secHeader(TOP_START, 'EXECUTIVE SUMMARY  -  ' + regionLabel.toUpperCase());

    // ── Helper to write wrapped paragraph text ────────────────────────────
    function para(text, startY, opts) {
      opts = opts || {};
      doc.setFontSize(opts.size || 8.5);
      doc.setFont('helvetica', opts.bold ? 'bold' : 'normal');
      doc.setTextColor(...(opts.color || C.body));
      const lines = doc.splitTextToSize(text, SAFE - 4);
      lines.forEach(line => {
        if (startY > BOTTOM_LIMIT - 6) { doc.addPage(); startY = TOP_START; }
        doc.text(line, ML + 2, startY);
        startY += opts.lineH || 5.5;
      });
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...C.body);
      return startY + (opts.gap || 4);
    }

    function paraLabel(label, startY) {
      doc.setFontSize(8.5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...C.navy);
      doc.text(label, ML + 2, startY);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...C.body);
      return startY + 6;
    }

    // ── Build narrative ───────────────────────────────────────────────────

    // Overall performance
    y = paraLabel('Overall Performance', y);
    const overallText =
      'During the reporting period, ' + regionLabel + ' delivered ' + num(data.totalSessions) +
      ' sessions across ' + num(data.uniqueSchools) + ' school(s) in ' + num(data.uniqueDistricts) +
      ' district(s), serving ' + num(data.activeScholars) + ' active scholars with ' +
      num(data.activeTutors) + ' active tutors. Scholar attendance stands at ' +
      pct(data.scholarAttRate, 1) + ' (benchmark: 85%) and tutor attendance at ' +
      pct(data.tutorAttRate, 1) + ' (benchmark: 90%). HIT compliance — the requirement that each ' +
      'session maintain a 4:1 or better scholar-to-tutor ratio — is at ' + pct(data.hitRate, 0) +
      ' (' + num(data.hitSessions) + ' of ' + num(data.totalSessions) + ' sessions compliant; benchmark: 95%).';
    y = para(overallText, y);

    // What's working
    y = paraLabel('What\'s Working', y);
    let positiveText = '';
    if (attLeaders.length > 0) {
      positiveText += 'Scholar attendance leaders include ' +
        attLeaders.map((sc, i) => trunc(sc.name, 28) + ' at ' + pct(sc.attRate, 1)).join(', ') +
        ' — ' + aboveBMCount + ' of ' + activeSch.length + ' schools are at or above the 85% benchmark. ';
    }
    if (topTutors5.length > 0) {
      positiveText += 'On the instructional side, ' + trunc(topTutors5[0].name, 24) + ' leads with ' + hrs(topTutors5[0].hours) +
        ' delivered';
      if (topTutors5[1]) positiveText += ', followed by ' + trunc(topTutors5[1].name, 24) + ' (' + hrs(topTutors5[1].hours) + ')';
      positiveText += '. ';
    }
    if (hitCompliant.length > 0) {
      positiveText += hitCompliant.length + ' school(s) recorded zero HIT violations this period. ';
    }
    if (data.scholCaptureRate >= BM.capture) {
      positiveText += 'Scholar survey capture of ' + pct(data.scholCaptureRate, 0) + ' is meeting the 80% target. ';
    }
    if (!positiveText.trim()) positiveText = 'Insufficient data to identify specific positives this period.';
    y = para(positiveText, y);

    // Growing pains
    y = paraLabel('Areas Needing Attention', y);
    let growingText = '';
    if (attConcerns.length > 0) {
      growingText += attConcerns.length + ' school(s) are below the 85% attendance benchmark: ' +
        attConcerns.slice(0, 3).map(sc => trunc(sc.name, 24) + ' (' + pct(sc.attRate, 1) + ')').join(', ') +
        '. Targeted outreach and attendance recovery plans are recommended for these sites. ';
    }
    if (hitSchools.length > 0) {
      growingText += 'HIT compliance requires attention: ' +
        hitSchools.slice(0, 3).map(sc => trunc(sc.name, 24) + ' (' + num(sc.ratioViolations) + ' violation' + (sc.ratioViolations !== 1 ? 's' : '') + ')').join(', ') +
        '. Staff scheduling adjustments are needed to maintain the required 4:1 ratio. ';
    }
    if (data.scholCaptureRate < BM.capture) {
      growingText += 'Scholar survey capture (' + pct(data.scholCaptureRate, 0) + ') is below the 80% target — ' +
        num(data.totalScholElig - data.totalScholSubm) + ' eligible survey responses are missing. ';
    }
    if (data.tutorCaptureRate < BM.capture) {
      growingText += 'Tutor survey capture (' + pct(data.tutorCaptureRate, 0) + ') also needs improvement. ';
    }
    if (totalSI > 0 && siReasons.length > 0) {
      growingText += 'Service interruptions (' + num(totalSI) + ' events) are most frequently caused by: ' +
        siReasons.slice(0, 3).map(([r, c]) => '"' + trunc(r, 20) + '" (' + num(c) + ')').join(', ') + '. ';
    }
    if (!growingText.trim()) growingText = 'No critical areas of concern identified this period.';
    y = para(growingText, y);

    // Recommended actions
    y = paraLabel('Recommended Actions', y);
    const actions = [];
    if (attConcerns.length > 0) actions.push('Schedule attendance recovery meetings with site leaders at: ' + attConcerns.slice(0, 2).map(sc => trunc(sc.name, 24)).join(', ') + '.');
    if (hitSchools.length > 0) actions.push('Review staffing plans at schools with HIT violations to ensure 4:1 ratios are maintained before each session.');
    if (data.scholCaptureRate < BM.capture) actions.push('Implement scholar survey reminders at session end; target ' + (BM.capture - data.scholCaptureRate) + '+ percentage point improvement in capture rate.');
    if (data.tutorCaptureRate < BM.capture) actions.push('Send tutor survey completion nudges to instructors below 80% capture. See bottom-5 list on Growing Pains page.');
    if (totalSI > 5) actions.push('Investigate top SI causes (' + (siReasons[0] || ['Unknown'])[0] + ') with district coordinators to reduce preventable interruptions.');
    if (actions.length === 0) actions.push('Continue current practices — all key benchmarks are being met.');

    actions.forEach((action, i) => {
      if (y > BOTTOM_LIMIT - 8) { doc.addPage(); y = TOP_START; }
      doc.setFontSize(8.5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...C.body);
      const lines = doc.splitTextToSize((i + 1) + '. ' + action, SAFE - 10);
      lines.forEach(line => {
        doc.text(line, ML + 4, y);
        y += 5.5;
      });
      y += 2;
    });

    y += 6;

    // ── Summary metrics box ───────────────────────────────────────────────
    if (y > BOTTOM_LIMIT - 30) { doc.addPage(); y = TOP_START; }
    const boxH = 28;
    doc.setFillColor(...C.light);
    doc.roundedRect(ML, y, SAFE, boxH, 2, 2, 'F');
    doc.setFillColor(...C.navy);
    doc.rect(ML, y, 3, boxH, 'F');

    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...C.navy);
    doc.text('Key Metrics at a Glance  -  ' + regionLabel + '  -  ' + generated, ML + 6, y + 6);

    const summCols = [
      ['Scholar Att.', pct(data.scholarAttRate, 1), statusColor(data.scholarAttRate, BM.scholAtt)],
      ['Tutor Att.',   pct(data.tutorAttRate, 1),   statusColor(data.tutorAttRate, BM.tutorAtt)],
      ['HIT Rate',     pct(data.hitRate, 0),         statusColor(data.hitRate, BM.hit)],
      ['Sessions',     num(data.totalSessions),      C.navy],
      ['Scholars',     num(data.activeScholars),     C.navy],
      ['Tutors',       num(data.activeTutors),       C.navy],
    ];
    const colSW = (SAFE - 6) / summCols.length;
    summCols.forEach((col, i) => {
      const cx = ML + 6 + i * colSW;
      doc.setFontSize(13);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...col[2]);
      doc.text(col[1], cx, y + 18);
      doc.setFontSize(6.5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...C.muted);
      doc.text(col[0], cx, y + 24);
    });
    doc.setTextColor(...C.body);

    // ── Two-pass footer stamp ──────────────────────────────────────────────
    stampFooters();

    return doc;
  }

  // ── Public API ─────────────────────────────────────────────────────────────
  window.njtcPDFExport = {
    generate: async function (regionFilter) {
      if (!window.po || typeof window.po.getExportData !== 'function') {
        alert('Pearl Ops data not ready. Wait for the dashboard to finish loading, then try again.');
        return;
      }

      const btn = document.querySelector('[data-pdf-region="' + regionFilter + '"]');
      const origText = btn ? btn.textContent : '';
      if (btn) { btn.textContent = 'Generating...'; btn.disabled = true; }

      await new Promise(r => setTimeout(r, 60));

      try {
        await loadLibs();
        const data = window.po.getExportData(regionFilter);

        if (!data || data.totalSessions === 0) {
          const label = regionFilter === 'ALL' ? 'the network' : regionFilter + ' Region';
          alert('No delivered session data found for ' + label + '.\n\nEnsure Pearl has finished loading (wait for the sync indicator to stop spinning).');
          return;
        }

        const doc = buildPDF(data);
        const regionSlug = regionFilter === 'NE' ? 'NE-Region'
                         : regionFilter === 'SW' ? 'SW-Region' : 'Network';
        const dateStr = new Date().toISOString().slice(0, 10);
        triggerDownload(doc, 'NJTC-Pearl-' + regionSlug + '-' + dateStr + '.pdf');
      } catch (err) {
        console.error('[NJTC PDF]', err);
        alert('PDF generation failed:\n\n' + err.message +
          '\n\nEnsure you have an internet connection -- jsPDF is loaded from unpkg.com.');
      } finally {
        if (btn) { btn.textContent = origText; btn.disabled = false; }
      }
    },
  };
})();
