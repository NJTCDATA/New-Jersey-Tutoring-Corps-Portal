// ─────────────────────────────────────────────────────────────────────────────
// NJTC Pearl Ops — PDF Export  (v6)
// 2-page program memo: P.1 Key metrics + Executive Summary
//                      P.2 Region metrics (scholar / tutor) + Flags to Watch (red)
//                          + non-absence service interruptions + school snapshot
// jsPDF 2.5.1 + jsPDF-AutoTable 3.8.2 loaded on demand from unpkg.com
// PC/Mac safe: revokeObjectURL delayed 2 s to avoid Windows AV freeze
// ─────────────────────────────────────────────────────────────────────────────
(function () {
  'use strict';

  // ── Brand palette (RGB arrays for jsPDF) ──────────────────────────────────
  const C = {
    navy:    [27,  42,  74],   // #1B2A4A
    teal:    [42, 157, 143],   // #2A9D8F
    amber:   [232,168,  56],   // #E8A838
    red:     [192,  57,  43],  // #C0392B
    green:   [ 82, 183, 136],
    white:   [255, 255, 255],
    light:   [247, 249, 252],
    mid:     [180, 190, 200],
    body:    [ 45,  45,  45],
    muted:   [107, 114, 128],
    amberBg: [255, 251, 235],
    rowAlt:  [250, 251, 253],  // subtle alternating row tint
  };

  // ── Benchmarks ────────────────────────────────────────────────────────────
  // HIT compliance is intentionally not in this report — the Data team reviews
  // HIT (ratio champions / violations) in the portal, not in program memos.
  const BM = { scholAtt: 80, tutorAtt: 90, survey: 4.0, capture: 80 };

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
  // Strip characters outside the Windows-1252 / Latin-1 range that jsPDF's
  // built-in Helvetica cannot encode. An unencodable character triggers a silent
  // fallback to Courier for the entire text node — that is what causes the
  // monospace sections visible in the rendered output.
  // Also normalise common Unicode punctuation to ASCII equivalents.
  function safeStr(s) {
    return String(s || '')
      .replace(/\u2014/g, '-')    // em dash  →  hyphen
      .replace(/\u2013/g, '-')    // en dash  →  hyphen
      .replace(/\u2265/g, '>=')   // ≥        →  >=
      .replace(/\u2264/g, '<=')   // ≤        →  <=
      .replace(/\u2019/g, "'")    // right single quote
      .replace(/\u201C/g, '"')    // left double quote
      .replace(/\u201D/g, '"')    // right double quote
      .replace(/[^\x20-\x7E\xA0-\xFF]/g, '') // strip everything else
      .replace(/\s+/g, ' ')
      .trim();
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
    const ML = 19;                 // 0.75-inch left margin
    const MR = PW - 19;           // 0.75-inch right margin
    const SAFE = MR - ML;         // ~178 mm usable width
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

    /** Full-bleed section header bar. Returns y after. */
    function secHeader(y, title, accent) {
      if (y > BOTTOM_LIMIT - 30) { doc.addPage(); y = TOP_START; }
      const bg = accent || C.navy;
      doc.setFillColor(...bg);
      doc.rect(0, y, PW, 10, 'F');
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...C.white);
      doc.text(safeStr(title), ML + 4, y + 7);
      doc.setTextColor(...C.body);
      doc.setFont('helvetica', 'normal');
      return y + 13;
    }

    /** Compact KPI card: big value, label, optional sub-line. */
    function kpiCard(x, y, w, h, value, label, color, sub) {
      doc.setFillColor(...C.white);
      doc.roundedRect(x, y, w, h, 2, 2, 'F');
      doc.setDrawColor(...C.mid);
      doc.setLineWidth(0.3);
      doc.roundedRect(x, y, w, h, 2, 2, 'S');
      doc.setFillColor(...(color === C.navy ? C.teal : color));
      doc.rect(x, y, w, 1.8, 'F');
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...(color || C.navy));
      doc.text(String(value), x + w / 2, y + 10, { align: 'center' });
      doc.setFontSize(6.5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...C.muted);
      doc.text(label, x + w / 2, y + 14.5, { align: 'center' });
      if (sub) {
        doc.setFontSize(5.8);
        doc.text(sub, x + w / 2, y + 18, { align: 'center' });
      }
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

    /** Wrapped paragraph. Returns y after. */
    function para(text, startY, opts) {
      opts = opts || {};
      doc.setFontSize(opts.size || 9.5);
      doc.setFont('helvetica', opts.bold ? 'bold' : 'normal');
      doc.setTextColor(...(opts.color || C.body));
      const lines = doc.splitTextToSize(safeStr(text), SAFE - 4);
      lines.forEach(line => {
        if (startY > BOTTOM_LIMIT - 6) { doc.addPage(); startY = TOP_START; }
        doc.text(line, ML + 2, startY);
        startY += opts.lineH || 4.8;
      });
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...C.body);
      return startY + (opts.gap === undefined ? 3 : opts.gap);
    }

    /** Sub-heading strip inside the Executive Summary. Returns y after. */
    function paraLabel(label, startY) {
      if (startY > BOTTOM_LIMIT - 16) { doc.addPage(); startY = TOP_START; }
      const bgH = 7;
      doc.setFillColor(237, 241, 248);
      doc.rect(ML, startY - 1, SAFE, bgH, 'F');
      doc.setFillColor(...C.navy);
      doc.rect(ML, startY - 1, 2.5, bgH, 'F');
      doc.setFontSize(9.5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...C.navy);
      doc.text(safeStr(label), ML + 5, startY + 4);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...C.body);
      return startY + bgH + 4;
    }

    /** One flag row: red bullet + label (left), red stat (right), optional muted detail. */
    function flagRow(y, f, isAlt) {
      const detailLines = f.detail ? doc.splitTextToSize(safeStr(f.detail), SAFE - 14) : [];
      const rowH = 6.5 + detailLines.length * 3.8;
      if (y + rowH > BOTTOM_LIMIT) { doc.addPage(); y = TOP_START; }
      if (isAlt) { doc.setFillColor(255, 245, 245); doc.rect(ML, y, SAFE, rowH, 'F'); }
      doc.setFillColor(...C.red);
      doc.circle(ML + 3.5, y + 3.6, 1.1, 'F');
      doc.setFontSize(8.5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...C.red);
      doc.text(safeStr(f.label), ML + 7, y + 4.6);
      if (f.stat) doc.text(safeStr(f.stat), MR - 3, y + 4.6, { align: 'right' });
      if (detailLines.length) {
        doc.setFontSize(7.5);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...C.muted);
        detailLines.forEach((ln, i) => doc.text(ln, ML + 7, y + 8.4 + i * 3.8));
      }
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...C.body);
      return y + rowH;
    }

    const capTag = (subm, elig) => '(' + num(subm) + ' of ' + num(elig) + ')';
    const listNames = (arr, max, fmtFn) => {
      const shown = arr.slice(0, max).map(fmtFn).join('; ');
      return shown + (arr.length > max ? '; +' + (arr.length - max) + ' more' : '');
    };
    const scoreColor = v => !(v > 0) ? C.mid : v >= BM.survey ? C.green : v >= 3.5 ? C.amber : C.red;

    // ── Pre-compute ────────────────────────────────────────────────────────
    const schoolsWithAtt = data.schools.filter(s => (s.stuAttended + s.stuAbsent) > 0);
    const attLeaders     = schoolsWithAtt.filter(s => s.attRate >= BM.scholAtt).sort((a,b) => b.attRate - a.attRate);
    const attConcerns    = schoolsWithAtt.filter(s => s.attRate <  BM.scholAtt).sort((a,b) => a.attRate - b.attRate);
    const capConcerns    = data.schools.filter(s => s.scholCaptureRate !== null && s.scholCaptureRate < BM.capture)
                                       .sort((a,b) => a.scholCaptureRate - b.scholCaptureRate);
    const lowSurveySch   = data.schools.filter(s => s.stuSurveyAvg > 0 && s.stuSurveyAvg < 3.5)
                                       .sort((a,b) => a.stuSurveyAvg - b.stuSurveyAvg);
    // Only tutors actually below the 80% target (previously a fixed "bottom 5"
    // that listed tutors at 100% when the region had no capture gaps).
    const tutorCapBelow  = (data.tutorCaptureAll || data.tutorCaptureBottom || [])
      .filter(t => t.captureRate < BM.capture).sort((a, b) => a.captureRate - b.captureRate);
    const tutorAttBelow  = (data.allTutors || data.topTutors)
      .filter(t => t.attRate < BM.tutorAtt && (t.attended + t.absent) >= 3)
      .sort((a, b) => a.attRate - b.attRate);
    const lateFilers     = data.tutorLateSurveyList || [];
    const noDelivered    = data.tutorsNoDelivered || [];
    const deliveringTutors = Math.max(0, (data.activeTutors || 0) - noDelivered.length);
    const termT          = data.termTutors || [];
    const totalIncomplete = data.totalIncomplete || 0;

    // Service interruptions — SI only (scholar absences are excluded upstream)
    const siReasons = Object.entries(data.siReasonCounts || {}).sort((a,b) => b[1] - a[1]);
    const totalSI   = data.stuSI || 0;

    const stu = data.stuSurveyAvg  || {};
    const ins = data.instSurveyAvg || {};
    const scholOverall = stu.overall || 0;
    const instOverall  = ins.overall || 0;

    // ── Flags to watch (rendered in red on page 2) ─────────────────────────
    // Each flag: label (what), stat (how much), topic (short phrase for the
    // Executive Summary), detail (who / where). Labels name the count that
    // tripped the flag, so a region that meets target overall is never shown
    // as "below target".
    const flags = [];
    const nOf = (n, w) => n + ' ' + w + (n !== 1 ? 's' : '');
    const regionStat = (v, bm, f) => 'Region ' + f + (v >= bm ? ' (meets target)' : '');
    if (attConcerns.length) flags.push({
      topic: 'scholar attendance at ' + nOf(attConcerns.length, 'school'),
      label: 'Scholar attendance below ' + BM.scholAtt + '% at ' + nOf(attConcerns.length, 'school'),
      stat: regionStat(data.scholarAttRate, BM.scholAtt, pct(data.scholarAttRate, 1)),
      detail: listNames(attConcerns, 6, s => trunc(s.name, 40) + ' ' + pct(s.attRate, 1)),
    });
    if (data.scholCaptureRate < BM.capture || capConcerns.length) flags.push({
      topic: 'scholar survey capture' + (capConcerns.length ? ' at ' + nOf(capConcerns.length, 'school') : ''),
      label: 'Scholar survey capture below ' + BM.capture + '%' + (capConcerns.length ? ' at ' + nOf(capConcerns.length, 'school') : ''),
      stat: regionStat(data.scholCaptureRate, BM.capture, pct(data.scholCaptureRate, 0)),
      detail: capConcerns.length ? listNames(capConcerns, 6, s => trunc(s.name, 40) + ' ' + pct(s.scholCaptureRate, 0)) : '',
    });
    if (scholOverall > 0 && scholOverall < BM.survey) flags.push({
      topic: 'scholar survey average',
      label: 'Scholar survey average below ' + fmt(BM.survey, 1) + ' target',
      stat: fmt(scholOverall, 2) + ' / 5',
    });
    if (lowSurveySch.length) flags.push({
      topic: 'low scholar ratings at ' + nOf(lowSurveySch.length, 'school'),
      label: 'Schools with scholar survey average below 3.5',
      stat: lowSurveySch.length + ' school' + (lowSurveySch.length !== 1 ? 's' : ''),
      detail: listNames(lowSurveySch, 6, s => trunc(s.name, 40) + ' ' + fmt(s.stuSurveyAvg, 2)),
    });
    if (data.tutorAttRate < BM.tutorAtt || tutorAttBelow.length) flags.push({
      topic: 'tutor attendance' + (tutorAttBelow.length ? ' (' + nOf(tutorAttBelow.length, 'tutor') + ')' : ''),
      label: (tutorAttBelow.length ? nOf(tutorAttBelow.length, 'tutor') + ' below ' : 'Tutor attendance below ') + BM.tutorAtt + '% attendance',
      stat: regionStat(data.tutorAttRate, BM.tutorAtt, pct(data.tutorAttRate, 1)),
      detail: tutorAttBelow.length ? listNames(tutorAttBelow, 6, t => trunc(t.name, 30) + (t.terminated ? ' [SEP]' : '') + ' ' + pct(t.attRate, 0)) : '',
    });
    if (data.tutorCaptureRate < BM.capture || tutorCapBelow.length) flags.push({
      topic: 'tutor survey capture' + (tutorCapBelow.length ? ' (' + nOf(tutorCapBelow.length, 'tutor') + ')' : ''),
      label: (tutorCapBelow.length ? nOf(tutorCapBelow.length, 'tutor') + ' below ' : 'Tutor survey capture below ') + BM.capture + '% survey capture',
      stat: regionStat(data.tutorCaptureRate, BM.capture, pct(data.tutorCaptureRate, 0)),
      detail: tutorCapBelow.length ? listNames(tutorCapBelow, 6, t => trunc(t.name, 30) + (t.terminated ? ' [SEP]' : '') + ' ' + t.captureRate + '% (' + t.submitted + '/' + t.eligible + ')') : '',
    });
    if (instOverall > 0 && instOverall < BM.survey) flags.push({
      topic: 'tutor survey average',
      label: 'Tutor survey average below ' + fmt(BM.survey, 1) + ' target',
      stat: fmt(instOverall, 2) + ' / 5',
    });
    const ctSchools = data.schools.filter(s => s.ctShare > 10).sort((a, b) => b.ctPulls - a.ctPulls);
    const ctScholars = data.ctScholars || [];
    if (ctSchools.length || ctScholars.length) flags.push({
      topic: 'classroom teacher pull-outs' + (ctSchools.length ? ' at ' + nOf(ctSchools.length, 'school') : ''),
      label: 'Classroom teacher pull-outs (counted as absences - dosage watch)',
      stat: num(data.totalCtPulls || 0) + ' pull-outs',
      detail: (ctSchools.length ? 'Above 10% of scholar absences: ' + listNames(ctSchools, 4, s => trunc(s.name, 32) + ' ' + s.ctPulls + ' (' + s.ctShare + '%)') : '') +
        (ctScholars.length ? (ctSchools.length ? '.  ' : '') + nOf(ctScholars.length, 'scholar') + ' pulled 3+ times' : ''),
    });
    if (totalIncomplete > 0) flags.push({
      topic: nOf(totalIncomplete, 'incomplete session'),
      label: 'Incomplete sessions (Scheduled, no attendance logged)',
      stat: num(totalIncomplete) + ' session' + (totalIncomplete !== 1 ? 's' : ''),
      detail: listNames(data.incompleteTutors || [], 6, t => trunc(t.name, 30) + ' (' + t.count + ')'),
    });
    if (noDelivered.length) flags.push({
      topic: nOf(noDelivered.length, 'rostered tutor') + ' with no delivered sessions',
      label: 'Rostered tutors with no delivered sessions',
      stat: noDelivered.length + ' of ' + num(data.activeTutors),
      detail: listNames(noDelivered, 6, t => trunc(t.name, 30) + (t.terminated ? ' [SEP]' : '')),
    });
    if (lateFilers.length) flags.push({
      topic: 'late tutor surveys',
      label: 'Tutors filing 50%+ of surveys after the session date',
      stat: lateFilers.length + ' tutor' + (lateFilers.length !== 1 ? 's' : ''),
      detail: listNames(lateFilers, 6, t => trunc(t.name, 30) + ' ' + t.lateRate + '%'),
    });
    if (termT.length) flags.push({
      topic: 'separated staff in Pearl data',
      label: 'Separated staff still counted in Pearl data',
      stat: termT.length + ' tutor' + (termT.length !== 1 ? 's' : ''),
      detail: listNames(termT, 6, t => trunc(t.name, 30)) +
        ((data.termMissingSurveys || 0) > 0 ? '  -  ' + num(data.termMissingSurveys) + ' missing tutor surveys' : ''),
    });

    // ─────────────────────────────────────────────────────────────────────
    // PAGE 1 — HEADER + KEY METRICS + EXECUTIVE SUMMARY
    // ─────────────────────────────────────────────────────────────────────
    doc.setFillColor(...C.navy);
    doc.rect(0, 0, PW, 30, 'F');
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...C.teal);
    doc.text('NEW JERSEY TUTORING CORPS', ML, 10);
    doc.setFontSize(17);
    doc.setTextColor(...C.white);
    doc.text('Pearl Operations  -  ' + regionLabel, ML, 19);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(180, 195, 210);
    doc.text('Generated ' + generated + '  -  ' + (data.periodLabel || 'SY 2026-2027'), ML, 25.5);
    doc.setTextColor(...C.body);

    // ── KPI strip (6 cards) ───────────────────────────────────────────────
    const kpis = [
      { v: pct(data.scholarAttRate, 1), l: 'Scholar Attendance', c: statusColor(data.scholarAttRate, BM.scholAtt), s: 'Target ' + BM.scholAtt + '%' },
      { v: pct(data.tutorAttRate, 1),   l: 'Tutor Attendance',   c: statusColor(data.tutorAttRate, BM.tutorAtt),   s: 'Target ' + BM.tutorAtt + '%' },
      { v: num(data.totalSessions),     l: 'Sessions Delivered', c: C.navy, s: num(data.activeScholars) + ' scholars served' },
      { v: num(totalIncomplete),        l: 'Incomplete Sessions', c: totalIncomplete > 0 ? C.red : C.green, s: 'Scheduled, not logged' },
      { v: scholOverall > 0 ? fmt(scholOverall, 2) : '--', l: 'Scholar Survey Avg', c: scoreColor(scholOverall), s: 'Capture ' + pct(data.scholCaptureRate, 0) },
      { v: instOverall  > 0 ? fmt(instOverall, 2)  : '--', l: 'Tutor Survey Avg',   c: scoreColor(instOverall),  s: 'Capture ' + pct(data.tutorCaptureRate, 0) },
    ];
    const kGap = 2.5, kW = (SAFE - kGap * (kpis.length - 1)) / kpis.length, kH = 21, kY = 35;
    kpis.forEach((k, i) => kpiCard(ML + i * (kW + kGap), kY, kW, kH, k.v, k.l, k.c, k.s));

    let y = secHeader(kY + kH + 5, 'EXECUTIVE SUMMARY  -  ' + regionLabel.toUpperCase());

    // Overall performance
    y = paraLabel('Overall Performance', y);
    y = para(
      'During the reporting period, ' + regionLabel + ' delivered ' + num(data.totalSessions) +
      ' sessions across ' + num(data.uniqueSchools) + ' school' + (data.uniqueSchools !== 1 ? 's' : '') +
      ' in ' + num(data.uniqueDistricts) + ' district' + (data.uniqueDistricts !== 1 ? 's' : '') +
      ', serving ' + num(data.activeScholars) + ' scholars with ' + num(deliveringTutors) + ' tutor' + (deliveringTutors !== 1 ? 's' : '') +
      ' delivering sessions (' + num(data.activeTutors) + ' on the roster). Scholar attendance stands at ' +
      pct(data.scholarAttRate, 1) + ' (' + num(data.stuAttended) + ' attended, ' + num(data.stuAbsent) + ' absent; target ' + BM.scholAtt + '%)' +
      ' and tutor attendance at ' + pct(data.tutorAttRate, 1) + ' (target ' + BM.tutorAtt + '%). ' +
      'Scholar surveys average ' + (scholOverall > 0 ? fmt(scholOverall, 2) + ' / 5' : '--') + ' with ' + pct(data.scholCaptureRate, 0) +
      ' capture ' + capTag(data.totalScholSubm, data.totalScholElig) + '; tutor surveys average ' +
      (instOverall > 0 ? fmt(instOverall, 2) + ' / 5' : '--') + ' with ' + pct(data.tutorCaptureRate, 0) + ' capture ' +
      capTag(data.totalTutorSubm, data.totalTutorElig) + '. ' +
      num(totalIncomplete) + ' scheduled session' + (totalIncomplete !== 1 ? 's are' : ' is') + ' still incomplete in Pearl.',
      y);

    // What's working — only metrics that actually meet their target
    y = paraLabel('What\'s Working', y);
    const wins = [];
    if (attLeaders.length) wins.push(attLeaders.length + ' of ' + schoolsWithAtt.length + ' school' + (schoolsWithAtt.length !== 1 ? 's are' : ' is') +
      ' at or above the ' + BM.scholAtt + '% scholar attendance target: ' +
      attLeaders.slice(0, 4).map(s => trunc(s.name, 36) + ' (' + pct(s.attRate, 1) + ')').join(', ') + (attLeaders.length > 4 ? ', and others' : '') + '.');
    if (data.tutorAttRate >= BM.tutorAtt) wins.push('Tutor attendance (' + pct(data.tutorAttRate, 1) + ') is meeting the ' + BM.tutorAtt + '% target.');
    if (data.scholCaptureRate >= BM.capture) wins.push('Scholar survey capture (' + pct(data.scholCaptureRate, 0) + ') is meeting the ' + BM.capture + '% target.');
    if (data.tutorCaptureRate >= BM.capture) wins.push('Tutor survey capture (' + pct(data.tutorCaptureRate, 0) + ') is meeting the ' + BM.capture + '% target.');
    if (scholOverall >= BM.survey) wins.push('Scholars rate their sessions ' + fmt(scholOverall, 2) + ' / 5 overall (confidence ' +
      fmt(stu.confidence, 2) + ', enjoyment ' + fmt(stu.enjoyment, 2) + ', learning ' + fmt(stu.learning, 2) + ').');
    y = para(wins.length ? wins.join(' ') : 'No metrics are meeting target this period.', y);

    // Areas needing attention — mirrors the red flags on page 2
    y = paraLabel('Areas Needing Attention', y);
    y = para(flags.length
      ? nOf(flags.length, 'flag') + ' to watch this period (details in red on page 2): ' +
        flags.map(f => f.topic).join('; ') + '.'
      : 'No flags this period - all monitored metrics are meeting target.', y);

    // Recommended actions
    y = paraLabel('Recommended Actions', y);
    const actions = [];
    if (attConcerns.length) actions.push('Hold attendance recovery conversations with site leaders at ' + attConcerns.slice(0, 3).map(s => trunc(s.name, 48)).join(', ') + '.');
    if (ctSchools.length) actions.push('Talk with site leaders at ' + ctSchools.slice(0, 3).map(s => trunc(s.name, 36)).join(', ') + ' about classroom teachers keeping scholars in class during tutoring, so scholars receive their full dosage.');
    if (totalIncomplete > 0) actions.push('Have onsite staff close out the ' + num(totalIncomplete) + ' incomplete session' + (totalIncomplete !== 1 ? 's' : '') +
      ' in Pearl (mark completed or cancelled)' + ((data.incompleteTutors || []).length ? ', starting with ' + data.incompleteTutors.slice(0, 2).map(t => trunc(t.name, 28)).join(' and ') : '') + '.');
    if (data.scholCaptureRate < BM.capture || capConcerns.length) actions.push('Reinforce end-of-session scholar survey completion' + (capConcerns.length ? ' at ' + capConcerns.slice(0, 3).map(s => trunc(s.name, 36)).join(', ') : '') + '.');
    if (tutorCapBelow.length) actions.push('Send survey completion nudges to the ' + tutorCapBelow.length + ' tutor' + (tutorCapBelow.length !== 1 ? 's' : '') + ' below ' + BM.capture + '% capture.');
    if (tutorAttBelow.length) actions.push('Check in with the ' + tutorAttBelow.length + ' tutor' + (tutorAttBelow.length !== 1 ? 's' : '') + ' below ' + BM.tutorAtt + '% attendance.');
    if (noDelivered.length) actions.push('Confirm schedules for the ' + noDelivered.length + ' rostered tutor' + (noDelivered.length !== 1 ? 's' : '') + ' with no delivered sessions.');
    if (lateFilers.length) actions.push('Encourage same-day survey completion for tutors filing late.');
    if (!actions.length) actions.push('Continue current practices - all key benchmarks are being met.');
    actions.forEach((a, i) => { y = para((i + 1) + '. ' + a, y, { gap: 1 }); });

    // ─────────────────────────────────────────────────────────────────────
    // PAGE 2 — REGION METRICS + FLAGS TO WATCH
    // ─────────────────────────────────────────────────────────────────────
    doc.addPage();
    y = secHeader(TOP_START, 'REGION METRICS  -  ' + regionLabel.toUpperCase());

    const scholarLines = [
      { label: 'Attendance rate', value: pct(data.scholarAttRate, 1), valueColor: statusColor(data.scholarAttRate, BM.scholAtt), bold: true },
      { label: 'Attended / absent', value: num(data.stuAttended) + ' / ' + num(data.stuAbsent) },
      { label: 'Schools at or above ' + BM.scholAtt + '%', value: attLeaders.length + ' of ' + schoolsWithAtt.length,
        valueColor: attConcerns.length ? C.red : C.green },
      { type: 'divider' },
      { label: 'Survey avg overall (n=' + num(stu.count) + ')', value: scholOverall > 0 ? fmt(scholOverall, 2) + ' / 5' : '--', valueColor: scoreColor(scholOverall), bold: true },
      { label: '  Confidence / Enjoyment / Learning', value: fmt(stu.confidence, 2) + ' / ' + fmt(stu.enjoyment, 2) + ' / ' + fmt(stu.learning, 2) },
      { label: 'Survey capture ' + capTag(data.totalScholSubm, data.totalScholElig), value: pct(data.scholCaptureRate, 0), valueColor: statusColor(data.scholCaptureRate, BM.capture) },
    ];
    const tutorLines = [
      { label: 'Attendance rate', value: pct(data.tutorAttRate, 1), valueColor: statusColor(data.tutorAttRate, BM.tutorAtt), bold: true },
      { label: 'Attended / absent', value: num(data.instAttended) + ' / ' + num(data.instAbsent) },
      { label: 'Tutors delivering / rostered', value: num(deliveringTutors) + ' / ' + num(data.activeTutors),
        valueColor: noDelivered.length ? C.red : C.green },
      { type: 'divider' },
      { label: 'Survey avg overall (n=' + num(ins.count) + ')', value: instOverall > 0 ? fmt(instOverall, 2) + ' / 5' : '--', valueColor: scoreColor(instOverall), bold: true },
      { label: 'Survey capture ' + capTag(data.totalTutorSubm, data.totalTutorElig), value: pct(data.tutorCaptureRate, 0), valueColor: statusColor(data.tutorCaptureRate, BM.capture) },
      { label: 'Incomplete sessions', value: num(totalIncomplete), valueColor: totalIncomplete > 0 ? C.red : C.green },
    ];
    y = twoColPanels(y, 'Scholars  -  Attendance & Surveys', scholarLines, 'Tutors  -  Attendance & Surveys', tutorLines);

    // ── Flags to watch ─────────────────────────────────────────────────────
    y = secHeader(y, 'FLAGS TO WATCH  (' + flags.length + ')', C.red);
    if (flags.length) {
      flags.forEach((f, i) => { y = flagRow(y, f, i % 2 === 1); });
    } else {
      doc.setFontSize(9); doc.setFont('helvetica', 'bold'); doc.setTextColor(...C.green);
      doc.text('No flags this period - all monitored metrics are meeting target.', ML + 3, y + 4);
      doc.setFont('helvetica', 'normal'); doc.setTextColor(...C.body);
      y += 8;
    }
    y += 4;

    // ── Service interruptions (non-absence only) ───────────────────────────
    if (y > BOTTOM_LIMIT - 20) { doc.addPage(); y = TOP_START; }
    doc.setFontSize(8.5); doc.setFont('helvetica', 'bold'); doc.setTextColor(...C.navy);
    doc.text('Service Interruptions (non-absence): ' + num(totalSI) + ' scholar-session' + (totalSI !== 1 ? 's' : ''), ML, y + 3);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(...C.muted);
    const siTxt = siReasons.length
      ? 'Top reasons: ' + siReasons.slice(0, 4).map(([r, c]) => safeStr(trunc(r || 'Unknown', 40)) + ' ' + num(c) + ' (' + Math.round(c / totalSI * 100) + '%)').join('  |  ') +
        '.  Scholar absences are excluded here and counted in attendance.'
      : 'No service interruptions recorded. Scholar absences are counted in attendance, not here.';
    doc.splitTextToSize(siTxt, SAFE).forEach((ln, i) => doc.text(ln, ML, y + 7.5 + i * 3.8));
    y += 7.5 + doc.splitTextToSize(siTxt, SAFE).length * 3.8 + 3;
    doc.setTextColor(...C.body);

    // ── School snapshot ────────────────────────────────────────────────────
    const opSchools = data.schools.filter(s => s.sessions > 0 || s.incomplete > 0)
      .sort((a,b) => b.sessions - a.sessions).slice(0, 15);
    if (opSchools.length > 0) {
      if (y > BOTTOM_LIMIT - 30) { doc.addPage(); y = TOP_START; }
      doc.autoTable({
        startY: y,
        head: [['School', 'Scholar Att.', 'Sessions', 'Incomplete', 'Teacher Pull-outs', 'SI', 'Scholar Survey', 'Survey Capture']],
        body: opSchools.map(sc => [
          safeStr(trunc(sc.name, 40)),
          (sc.stuAttended + sc.stuAbsent) > 0 ? pct(sc.attRate, 1) : '--',
          num(sc.sessions),
          num(sc.incomplete || 0),
          num(sc.ctPulls || 0),
          num(sc.siCount),
          sc.stuSurveyAvg > 0 ? fmt(sc.stuSurveyAvg, 2) : '--',
          sc.scholCaptureRate !== null ? pct(sc.scholCaptureRate, 0) : '--',
        ]),
        margin: { left: ML, right: PW - MR },
        tableWidth: SAFE,
        styles: { fontSize: 7.2, cellPadding: 1.0, textColor: C.body, font: 'helvetica', overflow: 'linebreak' },
        headStyles: { fillColor: C.navy, textColor: C.white, fontStyle: 'bold', fontSize: 7.5, halign: 'center' },
        alternateRowStyles: { fillColor: C.light },
        columnStyles: { 0: { cellWidth: 54, halign: 'left' }, 1: { halign: 'center' }, 2: { halign: 'center' }, 3: { halign: 'center' },
                        4: { halign: 'center' }, 5: { halign: 'center' }, 6: { halign: 'center' }, 7: { halign: 'center' } },
        theme: 'plain',
        rowPageBreak: 'avoid',
        didParseCell: function (d) {
          if (d.section !== 'body') return;
          const v = parseFloat(d.cell.raw);
          let c = null;
          if (d.column.index === 1 && !isNaN(v)) c = statusColor(v, BM.scholAtt);
          if (d.column.index === 3 && v > 0)     c = C.red;
          if (d.column.index === 4 && opSchools[d.row.index] && opSchools[d.row.index].ctShare > 10) c = C.red;
          if (d.column.index === 6 && !isNaN(v)) c = scoreColor(v);
          if (d.column.index === 7 && !isNaN(v)) c = statusColor(v, BM.capture);
          if (c) { d.cell.styles.textColor = c; d.cell.styles.fontStyle = 'bold'; }
        },
      });
      y = doc.lastAutoTable.finalY + 4;
    }

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
