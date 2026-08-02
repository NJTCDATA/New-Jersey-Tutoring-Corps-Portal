// ─────────────────────────────────────────────────────────────────────────────
// NJTC Central Team Portal — Growth Tree PDF Export  (v2)
// jsPDF 2.5.1 + jsPDF-AutoTable 3.8.2 + svg2pdf.js 2.2.1, loaded on demand.
//
// v2 rewrite, in response to real feedback on v1:
//  1. The tree is now the ACTUAL tree — embedded via svg2pdf.js as real vector
//     graphics from window.gtBuildStaticSVG(), not a rectangle approximation.
//  2. No scores, no "Needs Focus" / "Watch" status language anywhere. This
//     document orients people to what we're working toward — it is not a
//     scorecard. (The live-scored version of this data already lives in the
//     KPI Analytics tab for people who want it.)
//  3. Page 2 lists the actual organizational targets (e.g. "By 2026, serve
//     2000 scholars annually") under each annual goal, under each of the 3
//     pillars — grounded, concrete, no KPI fluency required to read it.
// ─────────────────────────────────────────────────────────────────────────────
(function () {
  'use strict';

  const C = {
    navy:  [10, 22, 40],
    white: [255, 255, 255],
    body:  [13, 27, 42],
    muted: [125, 143, 161],
    light: [246, 248, 252],
    border:[221, 227, 236],
  };

  function hexToRgb(hex) {
    if (!hex) return C.muted;
    const h = hex.replace('#', '');
    const n = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }

  function safeStr(s) {
    return String(s || '')
      .replace(/\u2014/g, '-').replace(/\u2013/g, '-')
      .replace(/\u2265/g, '>=').replace(/\u2264/g, '<=')
      .replace(/\u2019/g, "'").replace(/\u201C/g, '"').replace(/\u201D/g, '"')
      .replace(/[^\x20-\x7E\xA0-\xFF]/g, '')
      .replace(/\s+/g, ' ').trim();
  }

  // ── Library loader — jsPDF, then autoTable + svg2pdf (both depend on jsPDF
  //    already existing on window.jspdf.jsPDF) ─────────────────────────────
  let _libsLoaded = false;
  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src;
      s.onload = resolve;
      s.onerror = () => reject(new Error('Failed to load ' + src));
      document.head.appendChild(s);
    });
  }
  function loadLibs() {
    if (_libsLoaded && window.jspdf && window.jspdf.jsPDF) return Promise.resolve();
    return loadScript('https://unpkg.com/jspdf@2.5.1/dist/jspdf.umd.min.js')
      .then(() => Promise.all([
        loadScript('https://unpkg.com/jspdf-autotable@3.8.2/dist/jspdf.plugin.autotable.min.js'),
        loadScript('https://unpkg.com/svg2pdf.js@2.2.1/dist/svg2pdf.umd.min.js'),
      ]))
      .then(() => { _libsLoaded = true; });
  }

  // ── Target curation ────────────────────────────────────────────────────
  // Picks the most concrete, countable targets for a plain-language reader —
  // "serve 2,000 scholars annually" over "data governance is documented" —
  // rather than dumping every line item from the Sheet. This re-scores live
  // on every export, so it adapts automatically if targets change; nothing
  // here is a hardcoded pick of specific target text.
  const PROCESS_HINTS  = /document|governance|framework|template|retreat|process (is |was )?complete|system(s)? (is |are )?(in place|operational)|policy|policies/i;
  function scoreTarget(t) {
    let s = 0;
    const nums = (t.match(/[\d,]+/g) || []).map(n => parseInt(n.replace(/,/g, ''), 10)).filter(n => !isNaN(n));
    const maxNum = nums.length ? Math.max(...nums) : 0;
    if (/\$/.test(t)) s += 2;
    if (/%/.test(t)) s += 1;
    if (maxNum >= 500) s += 4;       // e.g. "2,000 scholars", "$850,000"
    else if (maxNum >= 20) s += 2;   // e.g. "35 sites", "75%"
    else if (maxNum >= 1) s += 1;    // e.g. "3 pilot customers"
    if (PROCESS_HINTS.test(t)) s -= 4;
    if (t.length > 120) s -= 1;
    return s;
  }
  function pickTopTargets(targets, n) {
    return targets
      .map((t, i) => ({ t, i, score: scoreTarget(t) }))
      .sort((a, b) => b.score - a.score || a.i - b.i)
      .slice(0, n)
      .sort((a, b) => a.i - b.i) // restore original Sheet order for readability
      .map(x => x.t);
  }

  function triggerDownload(doc, filename) {
    const blob = doc.output('blob');
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  // Turn the tree's SVG markup string into a live, measured DOM element that
  // svg2pdf can read (it needs real layout, so we mount it off-screen rather
  // than leave it detached).
  function mountSvg(svgString) {
    const holder = document.createElement('div');
    holder.style.cssText = 'position:fixed;left:-99999px;top:0;width:1400px;height:940px;';
    holder.innerHTML = svgString;
    const svg = holder.querySelector('svg');
    svg.setAttribute('width', '1400');
    svg.setAttribute('height', '940');
    document.body.appendChild(holder);
    return { svg, holder };
  }

  function buildPDF() {
    if (typeof window.gtComputeTreeData !== 'function' || typeof window.gtBuildStaticSVG !== 'function') {
      throw new Error('growth-tree.js must be loaded before growth-tree-pdf.js can export.');
    }
    const data = window.gtComputeTreeData();
    const { order: PILLAR_ORDER, map: PILLAR_GOAL_MAP, color: PILLAR_COLOR } = window.GT_PILLARS;

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'letter' });
    const PW = 279.4, PH = 215.9, ML = 16, MR = PW - 16, FOOTER_H = 9, TOP_START = 16, BOTTOM_LIMIT = PH - FOOTER_H - 6;
    const generated = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

    function header(title, sub) {
      doc.setFillColor(...C.navy);
      doc.rect(0, 0, PW, 20, 'F');
      doc.setFontSize(15); doc.setFont('helvetica', 'bold'); doc.setTextColor(...C.white);
      doc.text(safeStr(title), ML, 12);
      doc.setFontSize(8); doc.setFont('helvetica', 'normal'); doc.setTextColor(220, 225, 235);
      doc.text(safeStr(sub), ML, 17);
      doc.setFontSize(8); doc.text('Generated ' + generated, MR, 12, { align: 'right' });
      doc.setTextColor(...C.body);
      return 26;
    }
    function footers() {
      const total = doc.getNumberOfPages();
      for (let i = 1; i <= total; i++) {
        doc.setPage(i);
        doc.setFillColor(...C.navy);
        doc.rect(0, PH - FOOTER_H, PW, FOOTER_H, 'F');
        doc.setFontSize(7); doc.setFont('helvetica', 'normal'); doc.setTextColor(...C.white);
        doc.text('New Jersey Tutoring Corps  -  How We Grow  -  Internal', ML, PH - 3);
        doc.text('Page ' + i + ' of ' + total, MR, PH - 3, { align: 'right' });
      }
      doc.setTextColor(...C.body);
    }

    // ═══ PAGE 1 — The tree itself ═══
    let y = header('How We Grow', 'A map of NJTC\u2019s FY strategic goals and how every team contributes to them');

    const svgString = window.gtBuildStaticSVG(data);
    const { svg, holder } = mountSvg(svgString);

    const treeW = 225, treeH = treeW * (940 / 1400);
    const treeX = ML + ((MR - ML) - treeW) / 2;

    return doc.svg(svg, { x: treeX, y, width: treeW, height: treeH }).then(() => {
      document.body.removeChild(holder);
      let cy = y + treeH + 6;
      doc.setFontSize(8.5); doc.setFont('helvetica', 'normal'); doc.setTextColor(...C.muted);
      const caption = 'Every department connects to every strategic pillar \u2014 some directly, some by supporting the team that does. This is a map of how our work fits together, not a performance scorecard.';
      const lines = doc.splitTextToSize(safeStr(caption), (MR - ML) * 0.72);
      doc.text(lines, ML + (MR - ML) / 2, cy, { align: 'center' });
      cy += lines.length * 3.6 + 4;

      // legend, centered
      const legendY = cy;
      doc.setDrawColor(...C.body); doc.setLineWidth(0.6);
      const lx = ML + (MR - ML) / 2 - 55;
      doc.line(lx, legendY, lx + 8, legendY);
      doc.setFontSize(7.5); doc.setTextColor(...C.body);
      doc.text('Direct impact', lx + 10, legendY + 1);
      doc.setLineDashPattern([0.6, 1], 0);
      doc.line(lx + 55, legendY, lx + 63, legendY);
      doc.setLineDashPattern([], 0);
      doc.text('Indirect \u2014 through another team', lx + 65, legendY + 1);

      // ═══ PAGE 2 — The 3 strategic goals + their curated targets ═══
      // One page, one column per pillar. Rather than listing every target
      // (accurate but exhausting — that's what v2 got wrong), each goal shows
      // its 2-3 most concrete targets, picked live by scoreTarget() below.
      // The complete list always still lives in the KPI Targets tab — this
      // page's job is to be read in one sitting, not to be comprehensive.
      doc.addPage();
      y = header('Our Three Strategic Goals', 'What each pillar means, and what we\u2019re working toward \u2014 FY25\u201326');

      const GUTTER = 8, colW = ((MR - ML) - GUTTER * 2) / 3;
      PILLAR_ORDER.forEach((pKey, ci) => {
        const colX = ML + ci * (colW + GUTTER);
        let cy = y;

        const blurbLines = doc.splitTextToSize(safeStr(PILLAR_GOAL_MAP[pKey].blurb), colW - 6);
        const barH = 6 + 5 + blurbLines.length * 3.3 + 3;
        doc.setFillColor(...hexToRgb(PILLAR_COLOR[pKey]));
        doc.rect(colX, cy, colW, barH, 'F');
        doc.setFontSize(10.5); doc.setFont('helvetica', 'bold'); doc.setTextColor(...C.white);
        doc.text(safeStr(PILLAR_GOAL_MAP[pKey].label), colX + 3, cy + 6);
        doc.setFontSize(7.5); doc.setFont('helvetica', 'italic');
        doc.text(blurbLines, colX + 3, cy + 10.5);
        doc.setFont('helvetica', 'normal'); doc.setTextColor(...C.body);
        cy += barH + 5;

        PILLAR_GOAL_MAP[pKey].goals.forEach(goalName => {
          const goalData = data.kpi && data.kpi.goals[goalName];
          const allTargets = goalData ? goalData.items.map(it => it.target).filter(Boolean) : [];
          const targets = pickTopTargets(allTargets, 3);

          doc.setFontSize(8.5); doc.setFont('helvetica', 'bold'); doc.setTextColor(...C.body);
          const goalLines = doc.splitTextToSize(safeStr(goalName), colW - 2);
          doc.text(goalLines, colX, cy);
          cy += goalLines.length * 3.6 + 1.5;

          doc.setFont('helvetica', 'normal'); doc.setFontSize(7.6); doc.setTextColor(...C.muted);
          targets.forEach(t => {
            const lines2 = doc.splitTextToSize('\u2022 ' + safeStr(t), colW - 4);
            doc.text(lines2, colX + 2, cy);
            cy += lines2.length * 3.3 + 0.8;
          });
          cy += 3.5;
        });
      });

      // ═══ PAGE 3 — Department ownership ═══
      doc.addPage();
      y = header('Which Team Owns What', 'Direct ownership and supporting (indirect) roles, by department and pillar');

      const rows = data.deptKeys.map(d => {
        const label = safeStr(data.deptLabels[d] || d);
        const cellFor = p => {
          const r = data.rel[d][p];
          const parts = [];
          if (r.direct.length) parts.push('OWNS: ' + r.direct.map(safeStr).join('; '));
          if (r.indirect.length) parts.push('SUPPORTS: ' + [...new Set(r.indirect.map(x => safeStr(x.goal)))].join('; '));
          return parts.join('\n') || '-';
        };
        return [label, cellFor('impact'), cellFor('stability'), cellFor('infrastructure')];
      });
      doc.autoTable({
        startY: y,
        margin: { left: ML, right: PW - MR },
        head: [['Department', 'Grow Impact', 'Financial Stability', 'Strengthen Infrastructure']],
        body: rows,
        styles: { fontSize: 7, cellPadding: 2.2, valign: 'top', textColor: C.body, lineColor: C.border },
        headStyles: { fillColor: C.navy, textColor: C.white, fontStyle: 'bold', fontSize: 7.5 },
        alternateRowStyles: { fillColor: C.light },
        columnStyles: { 0: { fontStyle: 'bold', cellWidth: 32 } },
      });

      // ═══ PAGE 4 — Department-to-department connections ═══
      doc.addPage();
      y = header('How Teams Work Together', 'Day-to-day collaboration between departments');

      const connRows = [];
      const seen = new Set();
      data.deptKeys.forEach(d => {
        (data.deptConn[d] || []).forEach(edge => {
          const key = [d, edge.with].sort().join('|');
          if (seen.has(key)) return;
          seen.add(key);
          connRows.push([safeStr(data.deptLabels[d] || d), safeStr(data.deptLabels[edge.with] || edge.with), safeStr(edge.how), safeStr(edge.why)]);
        });
      });
      doc.autoTable({
        startY: y,
        margin: { left: ML, right: PW - MR },
        head: [['Team', 'Works With', 'How', 'Why It Matters']],
        body: connRows,
        styles: { fontSize: 7, cellPadding: 2.2, valign: 'top', textColor: C.body, lineColor: C.border },
        headStyles: { fillColor: C.navy, textColor: C.white, fontStyle: 'bold', fontSize: 7.5 },
        alternateRowStyles: { fillColor: C.light },
        columnStyles: { 0: { fontStyle: 'bold', cellWidth: 28 }, 1: { fontStyle: 'bold', cellWidth: 28 }, 2: { cellWidth: 45 } },
      });

      footers();
      triggerDownload(doc, `NJTC_How_We_Grow_${new Date().toISOString().slice(0, 10)}.pdf`);
    });
  }

  window.buildGrowthTreePDF = function () {
    loadLibs().then(() => buildPDF())
      .catch(err => alert('Could not build the PDF: ' + err.message + '\n\nEnsure you have an internet connection \u2014 jsPDF, autoTable, and svg2pdf.js are loaded from unpkg.com.'));
  };

})();
