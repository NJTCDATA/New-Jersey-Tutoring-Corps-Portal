// ─────────────────────────────────────────────────────────────────────────────
// NJTC Central Team Portal — Growth Tree  (v1)
// Lives inside KPI Analytics as the "🌳 Growth Tree" tab.
//
// WHAT THIS READS (all live, all already in the codebase — nothing here is
// hardcoded target data, so year-over-year goal/target changes just flow
// through automatically):
//   window.GOAL_DEPT_MAP     — dept -> annual goal names it owns   (shared-utils.js)
//   window.DEPT_CONNECTIONS  — dept -> peer depts it works with, + why (shared-utils.js)
//   window.DEPT_CONFIG       — labels/colors/taglines per dept        (shared-utils.js)
//   window.calcKPI()         — live goal-level score/status, same engine
//                              the KPI Analytics tab itself uses      (shared-charts.js)
//
// THE ONE THING THAT *IS* HARDCODED HERE, ON PURPOSE:
//   PILLAR_GOAL_MAP below — which of the ~10 named annual goals rolls up under
//   which of the 3 strategic pillars (Grow Impact / Financial Stability /
//   Strengthen Infrastructure). That grouping comes from the 3-year strategic
//   plan (2025-2028), not the year's targets, so it should only change if the
//   strategic plan itself is revised — update this map by hand if that happens.
// ─────────────────────────────────────────────────────────────────────────────
(function () {
  'use strict';

  const PILLAR_GOAL_MAP = {
    impact: {
      label: 'Grow Impact',
      blurb: 'Reaching more scholars, more sites, and growing tomorrow\u2019s educators.',
      goals: [
        "Increase Impact on Scholars",
        "Support Growth of New Jersey's Educator Pipeline",
      ],
    },
    stability: {
      label: 'Financial Stability',
      blurb: 'The funding and resources that keep our work possible year after year.',
      goals: [
        "Increase the number of fee-for-service partnerships",
        "Continue to pursue large and multi-year sources of funding",
        "Maintain cash position",
        "Further Diversify board and leverage its support",
      ],
    },
    infrastructure: {
      label: 'Strengthen Infrastructure',
      blurb: 'The systems, culture, and reputation that hold everything else up.',
      goals: [
        "Upgrade systems to support growth",
        "Maintain consistent partner experience",
        "Maintain and continue to build on strong culture",
        "Grow the NJTC brand",
      ],
    },
  };
  // Bottom-to-top order on the trunk (foundation first)
  const PILLAR_ORDER = ['infrastructure', 'stability', 'impact'];
  const PILLAR_COLOR = { infrastructure: '#0a1628', stability: '#0050c8', impact: '#f0a500' };
  const PILLAR_ICON  = { infrastructure: '🧱', stability: '💰', impact: '🌱' };

  function pillarOfGoal(goalName) {
    for (const k of PILLAR_ORDER) if (PILLAR_GOAL_MAP[k].goals.includes(goalName)) return k;
    return null;
  }

  // ── Module state (which node is focused, whether peer links show) ───────
  let _gt = { focusType: null, focusKey: null, showPeers: false, presenting: false };

  function viewingDept() {
    return window.NJTC_VIEW_DEPT || (window.NJTC_SESSION || {}).dept || 'leadership';
  }
  function isExecView(d) { return d === 'leadership' || d === 'kb' || !d; }

  // ── Live data engine — recomputed fresh every render ─────────────────────
  function computeTreeData() {
    const kpi        = (typeof window.calcKPI === 'function') ? window.calcKPI() : null;
    const goalMap     = window.GOAL_DEPT_MAP || {};
    const deptConn    = window.DEPT_CONNECTIONS || {};
    const deptConfig  = window.DEPT_CONFIG || {};
    const deptColors  = window.DEPT_COLORS || {};
    const deptIcons   = window.DEPT_ICONS || {};
    const deptLabels  = window.DEPT_LABELS || {};

    // Root departments = whoever has a peer-connection entry. This means the
    // tree grows/shrinks on its own if DEPT_CONNECTIONS ever gains or loses a
    // department — no edit needed here.
    const deptKeys = Object.keys(deptConn).length ? Object.keys(deptConn) : Object.keys(goalMap).filter(d => d !== 'kb');

    // Pillar-level live health = average of its goals' live scores (same
    // scoring engine as KPI Analytics: Met=1, Partial=.5, In Progress=.25,
    // Pipeline=.1, Not Met=0 — see calcKPI() in shared-charts.js).
    const pillars = {};
    PILLAR_ORDER.forEach(pKey => {
      const def = PILLAR_GOAL_MAP[pKey];
      const goalScores = def.goals.map(g => (kpi && kpi.goals[g]) ? kpi.goals[g] : null).filter(Boolean);
      const score = goalScores.length ? goalScores.reduce((a, g) => a + g.score, 0) / goalScores.length : null;
      pillars[pKey] = {
        key: pKey, label: def.label, goals: def.goals, score,
        risk: (score != null && typeof window.riskBucket === 'function') ? window.riskBucket(score) : null,
      };
    });

    // dept -> pillar -> { direct:[goal], indirect:[{goal, via, how, why}] }
    const rel = {};
    deptKeys.forEach(d => {
      rel[d] = {};
      PILLAR_ORDER.forEach(p => { rel[d][p] = { direct: [], indirect: [] }; });
    });
    // Direct: dept literally owns the goal per GOAL_DEPT_MAP
    deptKeys.forEach(d => {
      (goalMap[d] || []).forEach(g => {
        const p = pillarOfGoal(g);
        if (p) rel[d][p].direct.push(g);
      });
    });
    // Indirect: dept doesn't own the goal, but is connected (DEPT_CONNECTIONS)
    // to a peer dept that does — the peer's own "how/why" becomes the
    // explanation of the indirect path. This is derived entirely from data
    // that already exists in the codebase; nothing here is hand-authored.
    deptKeys.forEach(d => {
      const peers = deptConn[d] || [];
      PILLAR_ORDER.forEach(p => {
        PILLAR_GOAL_MAP[p].goals.forEach(g => {
          if (rel[d][p].direct.includes(g)) return;
          const bridge = peers.find(pr => (goalMap[pr.with] || []).includes(g));
          if (bridge && !rel[d][p].indirect.some(x => x.goal === g)) {
            rel[d][p].indirect.push({ goal: g, via: bridge.with, how: bridge.how, why: bridge.why });
          }
        });
      });
    });

    return { kpi, pillars, rel, deptKeys, deptConn, deptConfig, deptColors, deptIcons, deptLabels };
  }

  function goalStatusPill(kpi, goalName) {
    const g = kpi && kpi.goals[goalName];
    if (!g) return '';
    const r = (typeof window.riskBucket === 'function') ? window.riskBucket(g.score) : null;
    if (!r) return '';
    return `<span style="display:inline-flex;align-items:center;gap:.25rem;font-size:.7rem;font-weight:700;padding:.15rem .5rem;border-radius:20px;background:${r.bg};color:${r.color};white-space:nowrap">${r.icon} ${Math.round(g.score)}%</span>`;
  }

  // ══════════════════════════════════════════════════════════════════════
  //  SVG GEOMETRY
  // ══════════════════════════════════════════════════════════════════════
  function buildSVG(data) {
    const { deptKeys, deptColors, deptIcons, deptLabels } = data;
    const N = deptKeys.length;
    const W = 1400, H = 900;
    const groundY = 540, trunkX = 700;
    const bandY   = { infrastructure: [540, 440], stability: [440, 355], impact: [355, 280] };
    const bandHalfW = { 540: 72, 440: 56, 355: 46, 280: 36 };
    const bandMidY = { infrastructure: 490, stability: 397, impact: 317 };

    const rootY = 738;
    const xMin = 120, xMax = W - 120;
    const xs = deptKeys.map((d, i) => N > 1 ? xMin + i * (xMax - xMin) / (N - 1) : (xMin + xMax) / 2);

    // trunk bands (trapezoids)
    let trunk = '';
    PILLAR_ORDER.forEach(p => {
      const [y0, y1] = bandY[p];
      const w0 = bandHalfW[y0], w1 = bandHalfW[y1];
      trunk += `<polygon class="gt-band" data-pillar="${p}" onclick="gtSelectPillar('${p}')"
        points="${trunkX - w0},${y0} ${trunkX + w0},${y0} ${trunkX + w1},${y1} ${trunkX - w1},${y1}"
        fill="${PILLAR_COLOR[p]}" opacity="0.16"/>`;
    });

    // canopy
    const canopy = `
      <g class="gt-canopy">
        <ellipse cx="700" cy="150" rx="168" ry="108" fill="#0d6e3a" opacity="0.9"/>
        <ellipse cx="548" cy="203" rx="122" ry="82" fill="#0d6e3a" opacity="0.82"/>
        <ellipse cx="852" cy="203" rx="122" ry="82" fill="#0d6e3a" opacity="0.82"/>
        <ellipse cx="700" cy="92"  rx="132" ry="82" fill="#12864a" opacity="0.9"/>
      </g>
      <text x="700" y="145" text-anchor="middle" font-family="'DM Serif Display',serif" font-size="17" fill="#fff">Scholars &amp; Sites</text>`;

    // root base curves (always visible)
    let rootBase = '';
    xs.forEach(x => { rootBase += `<path class="gt-root-base" d="M ${trunkX} ${groundY} C ${(trunkX + x) / 2 + (x > trunkX ? 40 : -40)} ${groundY + 90}, ${x} ${rootY - 90}, ${x} ${rootY - 4}"/>`; });

    // goal connector overlays (dept -> pillar), 3 per dept max
    let connectors = '';
    deptKeys.forEach((d, i) => {
      const x = xs[i];
      PILLAR_ORDER.forEach(p => {
        const my = bandMidY[p];
        const midX = trunkX + (x - trunkX) * 0.14;
        const d1 = `M ${x} ${rootY - 6} C ${x} ${my + 90}, ${midX} ${my + 50}, ${trunkX} ${my}`;
        connectors += `<path class="gt-conn" id="gt-conn-${d}-${p}" data-dept="${d}" data-pillar="${p}" d="${d1}" stroke="${PILLAR_COLOR[p]}"/>`;
      });
    });

    // peer links (deduped pairs), gentle arcs beneath the roots.
    // Anchored at rootY+62 — just below the capsule's bottom edge (capsule
    // height is 56, starting at rootY) — so links visibly drop down and out
    // from under each node instead of appearing to start inside it.
    const peerY = rootY + 62;
    const seen = new Set();
    let peers = '';
    deptKeys.forEach((d, i) => {
      (data.deptConn[d] || []).forEach(edge => {
        const j = deptKeys.indexOf(edge.with);
        if (j < 0) return;
        const key = [d, edge.with].sort().join('|');
        if (seen.has(key)) return;
        seen.add(key);
        const x1 = xs[i], x2 = xs[j];
        const midX = (x1 + x2) / 2, sway = Math.min(60, Math.abs(x2 - x1) * 0.18);
        peers += `<path class="gt-peer" id="gt-peer-${key.replace('|', '_')}" data-a="${d}" data-b="${edge.with}"
          d="M ${x1} ${peerY} Q ${midX} ${peerY + sway}, ${x2} ${peerY}" stroke="#7c5a3d"/>`;
      });
    });

    // root nodes
    let nodes = '';
    deptKeys.forEach((d, i) => {
      const x = xs[i];
      const color = deptColors[d] || '#7d8fa1';
      const label = data.deptLabels[d] || d;
      const icon = data.deptIcons[d] || '📍';
      nodes += `
        <g class="gt-node" data-dept="${d}" onclick="gtSelectDept('${d}')" tabindex="0">
          <rect class="gt-capsule" x="${x - 92}" y="${rootY}" width="184" height="56" rx="28" stroke="${color}"/>
          <text class="gt-node-label" x="${x}" y="${rootY + 24}" text-anchor="middle" fill="${color}">${icon} ${label}</text>
          <text class="gt-node-sub" x="${x}" y="${rootY + 41}" text-anchor="middle">click to explore</text>
        </g>`;
    });

    return `<svg id="gtTreeSvg" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="NJTC Growth Tree">
      <line x1="60" y1="${rootY - 6}" x2="${W - 60}" y2="${rootY - 6}" class="gt-ground"/>
      ${canopy}
      ${trunk}
      ${rootBase}
      <g id="gtConnectors">${connectors}</g>
      <g id="gtPeers">${peers}</g>
      ${nodes}
    </svg>`;
  }

  // ══════════════════════════════════════════════════════════════════════
  //  EXPORT SVG — print/PDF version. Same layout as the interactive tree,
  //  but: (1) every style is an inline attribute, not a CSS class, so it
  //  survives conversion through svg2pdf without a stylesheet; (2) it's
  //  always the whole-tree view — every department, every connection, all
  //  visible at once, since a printed page can't be clicked into; (3) NO
  //  scores or status colors — this is a map of what we're working toward,
  //  not a scorecard. Plain-language pillar blurbs replace the numbers.
  // ══════════════════════════════════════════════════════════════════════
  function buildStaticSVG(data) {
    const { deptKeys, deptColors, deptIcons, deptLabels } = data;
    const N = deptKeys.length;
    const W = 1400, H = 940;
    const groundY = 540, trunkX = 700;
    const bandY   = { infrastructure: [540, 440], stability: [440, 355], impact: [355, 280] };
    const bandHalfW = { 540: 72, 440: 56, 355: 46, 280: 36 };
    const bandMidY = { infrastructure: 490, stability: 397, impact: 317 };
    const rootY = 738;
    const xMin = 120, xMax = W - 120;
    const xs = deptKeys.map((d, i) => N > 1 ? xMin + i * (xMax - xMin) / (N - 1) : (xMin + xMax) / 2);

    let trunk = '';
    PILLAR_ORDER.forEach(p => {
      const [y0, y1] = bandY[p];
      const w0 = bandHalfW[y0], w1 = bandHalfW[y1];
      trunk += `<polygon points="${trunkX - w0},${y0} ${trunkX + w0},${y0} ${trunkX + w1},${y1} ${trunkX - w1},${y1}"
        fill="${PILLAR_COLOR[p]}" fill-opacity="0.18" stroke="#0a1628" stroke-opacity="0.25" stroke-width="1"/>`;
      const my = bandMidY[p];
      trunk += `<text x="${trunkX + w1 + 14}" y="${my - 6}" font-family="'DM Serif Display',serif" font-size="16" font-weight="700" fill="${PILLAR_COLOR[p]}">${PILLAR_GOAL_MAP[p].label}</text>`;
      trunk += `<text x="${trunkX + w1 + 14}" y="${my + 12}" font-family="'DM Sans',sans-serif" font-size="10.5" fill="#3d5166">${escXml(PILLAR_GOAL_MAP[p].blurb)}</text>`;
    });

    const canopy = `
      <g>
        <ellipse cx="700" cy="150" rx="168" ry="108" fill="#0d6e3a" fill-opacity="0.9"/>
        <ellipse cx="548" cy="203" rx="122" ry="82" fill="#0d6e3a" fill-opacity="0.82"/>
        <ellipse cx="852" cy="203" rx="122" ry="82" fill="#0d6e3a" fill-opacity="0.82"/>
        <ellipse cx="700" cy="92"  rx="132" ry="82" fill="#12864a" fill-opacity="0.9"/>
      </g>
      <text x="700" y="145" text-anchor="middle" font-family="'DM Serif Display',serif" font-size="18" font-weight="700" fill="#ffffff">Scholars &amp; Sites</text>`;

    let rootBase = '';
    xs.forEach(x => { rootBase += `<path d="M ${trunkX} ${groundY} C ${(trunkX + x) / 2 + (x > trunkX ? 40 : -40)} ${groundY + 90}, ${x} ${rootY - 90}, ${x} ${rootY - 4}" fill="none" stroke="#7c5a3d" stroke-width="2.25" stroke-opacity="0.4"/>`; });

    let connectors = '';
    deptKeys.forEach((d, i) => {
      const x = xs[i];
      PILLAR_ORDER.forEach(p => {
        const my = bandMidY[p];
        const midX = trunkX + (x - trunkX) * 0.14;
        const r = data.rel[d][p];
        if (!r.direct.length && !r.indirect.length) return;
        const isDirect = r.direct.length > 0;
        const d1 = `M ${x} ${rootY - 6} C ${x} ${my + 90}, ${midX} ${my + 50}, ${trunkX} ${my}`;
        connectors += `<path d="${d1}" fill="none" stroke="${PILLAR_COLOR[p]}" stroke-width="${isDirect ? 3 : 2.2}"
          stroke-opacity="${isDirect ? 0.9 : 0.5}" ${isDirect ? '' : 'stroke-dasharray="1 7" stroke-linecap="round"'}/>`;
      });
    });

    let nodes = '';
    deptKeys.forEach((d, i) => {
      const x = xs[i];
      const color = deptColors[d] || '#7d8fa1';
      const label = escXml(deptLabels[d] || d);
      nodes += `
        <g>
          <rect x="${x - 92}" y="${rootY}" width="184" height="44" rx="22" fill="#ffffff" stroke="${color}" stroke-width="1.6"/>
          <text x="${x}" y="${rootY + 27}" text-anchor="middle" font-family="'DM Sans',sans-serif" font-weight="700" font-size="15" fill="${color}">${label}</text>
        </g>`;
    });

    return `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
      <line x1="60" y1="${rootY - 6}" x2="${W - 60}" y2="${rootY - 6}" stroke="#7c5a3d" stroke-width="1" stroke-dasharray="1 6" stroke-opacity="0.35"/>
      ${canopy}
      ${trunk}
      ${rootBase}
      ${connectors}
      ${nodes}
    </svg>`;
  }

  function escXml(s) {
    return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  // ══════════════════════════════════════════════════════════════════════
  //  STATE → SVG CLASS APPLICATION  (no re-render needed for focus changes)
  // ══════════════════════════════════════════════════════════════════════
  function applyState(data) {
    const svg = document.getElementById('gtTreeSvg');
    if (!svg) return;
    const { focusType, focusKey, showPeers } = _gt;

    svg.querySelectorAll('.gt-node').forEach(n => n.classList.toggle('selected', focusType === 'dept' && n.dataset.dept === focusKey));
    svg.querySelectorAll('.gt-band').forEach(n => n.classList.toggle('selected', focusType === 'pillar' && n.dataset.pillar === focusKey));

    svg.querySelectorAll('.gt-conn').forEach(p => {
      let active = false;
      if (focusType === null) active = true;
      else if (focusType === 'dept') active = p.dataset.dept === focusKey;
      else if (focusType === 'pillar') active = p.dataset.pillar === focusKey;
      const rel = data.rel[p.dataset.dept][p.dataset.pillar];
      const isDirect = rel.direct.length > 0;
      p.classList.toggle('active', active);
      p.classList.toggle('direct', isDirect);
      p.classList.toggle('indirect', !isDirect && rel.indirect.length > 0);
      p.classList.toggle('empty', !isDirect && rel.indirect.length === 0);
    });

    svg.querySelectorAll('.gt-peer').forEach(p => {
      let active = showPeers;
      if (focusType === 'dept') active = showPeers && (p.dataset.a === focusKey || p.dataset.b === focusKey);
      if (focusType === 'pillar') active = false;
      p.classList.toggle('active', active);
    });
  }

  // ══════════════════════════════════════════════════════════════════════
  //  SIDE PANEL
  // ══════════════════════════════════════════════════════════════════════
  function panelHTML(data) {
    const { focusType, focusKey } = _gt;
    const kpi = data.kpi;

    if (focusType === 'dept') {
      const d = focusKey;
      const cfg = data.deptConfig[d] || {};
      const color = data.deptColors[d] || '#7d8fa1';
      const icon = data.deptIcons[d] || '📍';
      let html = `<div class="gt-eyebrow">Department</div>
        <h3 class="gt-h" style="color:${color}">${icon} ${data.deptLabels[d] || d}</h3>
        <p class="gt-sub">${cfg.tagline || ''}</p>`;

      PILLAR_ORDER.forEach(p => {
        const r = data.rel[d][p];
        if (!r.direct.length && !r.indirect.length) return;
        const pillar = data.pillars[p];
        html += `<div class="gt-rel-block">
          <div class="gt-rel-head">${PILLAR_ICON[p]} ${pillar.label} ${pillar.risk ? `<span style="margin-left:.4rem">${pillar.risk.icon} ${Math.round(pillar.score)}%</span>` : ''}</div>`;
        if (r.direct.length) {
          html += `<div class="gt-rel-kind direct">● Direct</div><ul class="gt-ul">`;
          r.direct.forEach(g => { html += `<li>${g} ${goalStatusPill(kpi, g)}</li>`; });
          html += `</ul>`;
        }
        if (r.indirect.length) {
          html += `<div class="gt-rel-kind indirect">◌ Indirect</div>`;
          const byVia = {};
          r.indirect.forEach(x => { (byVia[x.via] = byVia[x.via] || []).push(x); });
          Object.entries(byVia).forEach(([via, items]) => {
            html += `<div class="gt-via-group">
              <div class="gt-via-label">via <span style="color:${data.deptColors[via] || '#7d8fa1'}">${data.deptIcons[via] || ''} ${data.deptLabels[via] || via}</span> — ${items[0].how}</div>
              <ul class="gt-ul">${items.map(x => `<li>${x.goal} ${goalStatusPill(kpi, x.goal)}</li>`).join('')}</ul>
              <div class="gt-why">${items[0].why || ''}</div>
            </div>`;
          });
        }
        html += `</div>`;
      });

      const peers = data.deptConn[d] || [];
      if (peers.length) {
        html += `<div class="gt-rel-block"><div class="gt-rel-head">🕸️ Works closely with</div><ul class="gt-ul peer">`;
        peers.forEach(pr => {
          const pc = data.deptColors[pr.with] || '#7d8fa1';
          html += `<li><span style="color:${pc};font-weight:700">${data.deptIcons[pr.with] || ''} ${data.deptLabels[pr.with] || pr.with}</span> — <b>${pr.how}</b><div class="gt-why">${pr.why}</div></li>`;
        });
        html += `</ul></div>`;
      }
      return html;
    }

    if (focusType === 'pillar') {
      const p = focusKey;
      const pillar = data.pillars[p];
      let html = `<div class="gt-eyebrow">Strategic Pillar</div>
        <h3 class="gt-h" style="color:${PILLAR_COLOR[p]}">${PILLAR_ICON[p]} ${pillar.label}</h3>
        ${pillar.risk ? `<div class="gt-score-badge" style="background:${pillar.risk.bg};color:${pillar.risk.color}">${pillar.risk.icon} ${Math.round(pillar.score)}% ${pillar.risk.label}</div>` : ''}
        <div class="gt-rel-block"><div class="gt-rel-head">🎯 Goals in this pillar</div><ul class="gt-ul">`;
      pillar.goals.forEach(g => { html += `<li>${g} ${goalStatusPill(kpi, g)}</li>`; });
      html += `</ul></div>`;

      const direct = [], indirect = [];
      data.deptKeys.forEach(d => {
        const r = data.rel[d][p];
        if (r.direct.length) direct.push(d);
        else if (r.indirect.length) indirect.push(d);
      });
      html += `<div class="gt-rel-block"><div class="gt-rel-kind direct">● Drives this directly</div><ul class="gt-ul">`;
      direct.forEach(d => { html += `<li><span style="color:${data.deptColors[d]};font-weight:700">${data.deptIcons[d]} ${data.deptLabels[d]}</span></li>`; });
      html += `</ul>${indirect.length ? `<div class="gt-rel-kind indirect">◌ Drives this indirectly</div><ul class="gt-ul">` + indirect.map(d => `<li><span style="color:${data.deptColors[d]};font-weight:700">${data.deptIcons[d]} ${data.deptLabels[d]}</span></li>`).join('') + `</ul>` : ''}</div>`;
      return html;
    }

    // default — whole-tree overview
    const dept = viewingDept();
    return `<div class="gt-eyebrow">${isExecView(dept) ? 'Full Organization' : 'Start here'}</div>
      <h3 class="gt-h">Every root feeds every ring.</h3>
      <p class="gt-sub">Click any team below the ground, or any ring in the trunk, to trace the connection. Toggle "department-to-department links" to see how teams support each other directly.</p>
      <p class="gt-sub">All departments touch all three strategic pillars — some directly, some by influencing the team that acts. Dashed lines mean the second kind.</p>
      <div class="gt-legend-mini">
        ${PILLAR_ORDER.map(p => `<div class="gt-legend-row"><span class="gt-dot" style="background:${PILLAR_COLOR[p]}"></span><div><div>${data.pillars[p].label} ${data.pillars[p].risk ? `<span style="margin-left:.4rem;opacity:.7">${data.pillars[p].risk.icon} ${Math.round(data.pillars[p].score)}%</span>` : ''}</div><div style="font-size:.7rem;color:rgba(242,239,226,.55);margin-top:.1rem">${PILLAR_GOAL_MAP[p].blurb}</div></div></div>`).join('')}
      </div>`;
  }

  function rerenderPanelAndState() {
    const data = computeTreeData();
    const panel = document.getElementById('gtPanel');
    if (panel) panel.innerHTML = panelHTML(data);
    applyState(data);
    const label = document.getElementById('gtViewSelect');
    if (label) label.value = _gt.focusType === 'dept' ? 'dept:' + _gt.focusKey : _gt.focusType === 'pillar' ? 'pillar:' + _gt.focusKey : 'all';
    const peerToggle = document.getElementById('gtPeerToggle');
    if (peerToggle) peerToggle.checked = _gt.showPeers;
  }

  // ══════════════════════════════════════════════════════════════════════
  //  PUBLIC INTERACTIONS
  // ══════════════════════════════════════════════════════════════════════
  window.gtSelectDept = function (key) {
    _gt.focusType = (_gt.focusType === 'dept' && _gt.focusKey === key) ? null : 'dept';
    _gt.focusKey  = _gt.focusType ? key : null;
    if (_gt.focusType === 'dept') _gt.showPeers = true;
    rerenderPanelAndState();
  };
  window.gtSelectPillar = function (key) {
    _gt.focusType = (_gt.focusType === 'pillar' && _gt.focusKey === key) ? null : 'pillar';
    _gt.focusKey  = _gt.focusType ? key : null;
    rerenderPanelAndState();
  };
  window.gtResetFocus = function () { _gt.focusType = null; _gt.focusKey = null; rerenderPanelAndState(); };
  window.gtTogglePeers = function (el) { _gt.showPeers = !!(el ? el.checked : !_gt.showPeers); rerenderPanelAndState(); };
  window.gtViewSelectChange = function (val) {
    if (val === 'all') { _gt.focusType = null; _gt.focusKey = null; }
    else { const [t, k] = val.split(':'); _gt.focusType = t; _gt.focusKey = k; if (t === 'dept') _gt.showPeers = true; }
    rerenderPanelAndState();
  };

  window.gtPresent = function () {
    _gt.presenting = true;
    // Empty the tab's own copy first so there's only ever one element with
    // each id (gtPanel, gtViewSelect, gtTreeSvg...) in the document at a time.
    const tabBody = document.getElementById('gtTabBody');
    if (tabBody) tabBody.innerHTML = `<div style="padding:3rem;text-align:center;color:var(--muted)">Presenting full-screen — <a href="#" onclick="gtClosePresent();return false;">return here</a></div>`;

    const overlay = document.createElement('div');
    overlay.id = 'gtPresentOverlay';
    overlay.className = 'gt-present-overlay open';
    overlay.innerHTML = `<div class="gt-present-box">
      <button class="gt-present-close" onclick="gtClosePresent()">✕ Close</button>
      <div id="gtPresentMount"></div>
    </div>`;
    document.body.appendChild(overlay);
    document.getElementById('gtPresentMount').innerHTML = treeBodyHTML(true);
    rerenderPanelAndState();
  };
  window.gtClosePresent = function () {
    _gt.presenting = false;
    const el = document.getElementById('gtPresentOverlay');
    if (el) el.remove();
    refreshTabBody();
    rerenderPanelAndState();
  };

  window.gtDownloadPDF = function () {
    if (typeof window.buildGrowthTreePDF === 'function') {
      window.buildGrowthTreePDF();
    } else {
      alert('PDF module not loaded — make sure modules/growth-tree-pdf.js is included.');
    }
  };

  // ══════════════════════════════════════════════════════════════════════
  //  STYLES (injected once — keeps this module fully self-contained)
  // ══════════════════════════════════════════════════════════════════════
  function injectStyles() {
    if (document.getElementById('gtStyles')) return;
    const css = `
      .gt-wrap{display:flex;gap:1.25rem;flex-wrap:wrap;align-items:stretch}
      .gt-card{flex:1 1 62%;min-width:320px;background:#fff;border:1px solid var(--border);border-radius:var(--radius);overflow:hidden;position:relative}
      .gt-svg-scroll{overflow-x:auto}
      #gtTreeSvg{display:block;width:100%;min-width:760px;height:auto}
      .gt-node{cursor:pointer}
      .gt-capsule{fill:#fff;stroke-width:1.6;transition:filter .15s ease}
      .gt-node:hover .gt-capsule{filter:drop-shadow(0 3px 8px rgba(10,22,40,.18))}
      .gt-node.selected .gt-capsule{fill:currentColor}
      .gt-node-label{font-family:'DM Sans',sans-serif;font-weight:700;font-size:15px}
      .gt-node.selected .gt-node-label{fill:#fff !important}
      .gt-node-sub{font-family:'JetBrains Mono',monospace;font-size:9.5px;fill:var(--muted)}
      .gt-node.selected .gt-node-sub{fill:rgba(255,255,255,.75)}
      .gt-root-base{fill:none;stroke:#7c5a3d;stroke-width:2.25;opacity:.4}
      .gt-ground{stroke:#7c5a3d;stroke-width:1;stroke-dasharray:1 6;opacity:.35}
      .gt-band{cursor:pointer;stroke:rgba(10,22,40,.25);stroke-width:1;transition:opacity .15s ease}
      .gt-band:hover{opacity:.28}
      .gt-band.selected{opacity:.34;stroke-width:2}
      .gt-conn{fill:none;stroke-width:3;opacity:0;transition:opacity .25s ease;pointer-events:none}
      .gt-conn.active.direct{opacity:.9}
      .gt-conn.active.indirect{opacity:.55;stroke-dasharray:1 7;stroke-linecap:round;stroke-width:2.4}
      .gt-conn.active.empty{opacity:0}
      .gt-peer{fill:none;stroke-width:2;stroke-dasharray:3 4;opacity:0;transition:opacity .25s ease;pointer-events:none}
      .gt-peer.active{opacity:.55}
      .gt-panel{flex:1 1 34%;min-width:280px;background:var(--navy);color:#f2efe2;border-radius:var(--radius);padding:1.5rem 1.5rem 1.25rem;display:flex;flex-direction:column;max-height:640px;overflow-y:auto}
      .gt-eyebrow{font-family:'JetBrains Mono',monospace;font-size:.65rem;letter-spacing:.12em;text-transform:uppercase;color:var(--gold-lite);margin-bottom:.5rem}
      .gt-h{font-family:'DM Serif Display',serif;font-size:1.375rem;margin:0 0 .3rem;color:#fff}
      .gt-sub{font-size:.8125rem;line-height:1.55;color:rgba(242,239,226,.82);margin-bottom:.875rem}
      .gt-score-badge{display:inline-block;font-size:.75rem;font-weight:700;padding:.3rem .7rem;border-radius:20px;margin-bottom:.875rem}
      .gt-rel-block{margin-bottom:1rem;padding-bottom:.875rem;border-bottom:1px solid rgba(242,239,226,.12)}
      .gt-rel-head{font-size:.875rem;font-weight:700;color:#fff;margin-bottom:.5rem}
      .gt-rel-kind{font-size:.7rem;font-weight:700;text-transform:uppercase;letter-spacing:.06em;margin:.5rem 0 .3rem}
      .gt-rel-kind.direct{color:#8fd1a6}
      .gt-rel-kind.indirect{color:#e3c77c}
      .gt-via-group{margin-bottom:.625rem}
      .gt-via-label{font-size:.75rem;font-weight:700;color:rgba(242,239,226,.9);margin-bottom:.3rem}
      .gt-ul{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:.5rem}
      .gt-ul li{font-size:.8125rem;line-height:1.5;color:rgba(242,239,226,.92)}
      .gt-ul.peer li{padding-bottom:.5rem}
      .gt-why{font-size:.75rem;color:rgba(242,239,226,.62);margin-top:.15rem;line-height:1.45}
      .gt-legend-mini{margin-top:auto;padding-top:1rem;border-top:1px solid rgba(242,239,226,.14);display:flex;flex-direction:column;gap:.5rem;font-size:.8125rem}
      .gt-legend-row{display:flex;align-items:center;gap:.5rem}
      .gt-dot{width:11px;height:11px;border-radius:50%;flex:none}
      .gt-controls{display:flex;gap:.625rem;flex-wrap:wrap;align-items:center;padding:.875rem 1rem;border-bottom:1px solid var(--border);background:var(--surface-2)}
      .gt-controls select{font-family:'DM Sans',sans-serif;font-size:.8125rem;padding:.4rem .6rem;border-radius:8px;border:1px solid var(--border);background:#fff}
      .gt-controls label{display:flex;align-items:center;gap:.4rem;font-size:.8125rem;color:var(--text-2)}
      .gt-legend-strip{display:flex;gap:1.25rem;flex-wrap:wrap;align-items:center;padding:.75rem 1rem;font-size:.75rem;color:var(--muted);border-top:1px solid var(--border)}
      .gt-legend-strip .item{display:flex;align-items:center;gap:.4rem}
      .gt-present-overlay{position:fixed;inset:0;z-index:700;background:rgba(10,22,40,.9);display:flex;align-items:center;justify-content:center;padding:1.5rem}
      .gt-present-box{background:#fff;border-radius:16px;width:100%;max-width:1500px;max-height:95vh;overflow-y:auto;padding:1.5rem;position:relative}
      .gt-present-close{position:absolute;top:1rem;right:1rem;z-index:2;background:var(--navy);color:#fff;border:none;border-radius:20px;padding:.5rem 1rem;font-size:.8125rem;font-weight:600;cursor:pointer}
      @media (max-width:900px){ .gt-wrap{flex-direction:column} .gt-panel{max-height:none} }
    `;
    const style = document.createElement('style');
    style.id = 'gtStyles';
    style.textContent = css;
    document.head.appendChild(style);
  }

  // ══════════════════════════════════════════════════════════════════════
  //  BODY (svg card + controls + panel) — reused by both the tab and the
  //  full-screen presentation overlay
  // ══════════════════════════════════════════════════════════════════════
  function viewSelectOptions(data) {
    let opts = `<option value="all">🔭 Whole tree</option><optgroup label="Departments">`;
    data.deptKeys.forEach(d => { opts += `<option value="dept:${d}">${data.deptIcons[d] || ''} ${data.deptLabels[d] || d}</option>`; });
    opts += `</optgroup><optgroup label="Strategic Pillars">`;
    PILLAR_ORDER.forEach(p => { opts += `<option value="pillar:${p}">${PILLAR_ICON[p]} ${PILLAR_GOAL_MAP[p].label}</option>`; });
    opts += `</optgroup>`;
    return opts;
  }

  function treeBodyHTML(big) {
    const data = computeTreeData();
    const dept = viewingDept();

    // set sensible initial focus once per fresh mount
    if (_gt.focusType === undefined) _gt.focusType = null;
    if (!big && !_gt._initialized) {
      _gt._initialized = true;
      if (!isExecView(dept)) { _gt.focusType = 'dept'; _gt.focusKey = dept; _gt.showPeers = true; }
    }

    return `
      <div class="gt-controls">
        <label>View:
          <select id="gtViewSelect" onchange="gtViewSelectChange(this.value)">${viewSelectOptions(data)}</select>
        </label>
        <label><input type="checkbox" id="gtPeerToggle" onchange="gtTogglePeers(this)" ${_gt.showPeers ? 'checked' : ''}> 🕸️ Show department-to-department links</label>
        <button class="btn btn-secondary" onclick="gtResetFocus()">↺ Reset</button>
        ${!big ? `<button class="btn btn-secondary" onclick="gtPresent()">🖥️ Present Full-Screen</button>` : ''}
        <button class="btn btn-secondary" onclick="gtDownloadPDF()">📄 Download PDF</button>
      </div>
      <div class="gt-svg-scroll">${buildSVG(data)}</div>
      <div class="gt-legend-strip">
        <div class="item"><svg width="24" height="6"><line x1="0" y1="3" x2="24" y2="3" stroke="#0a1628" stroke-width="3"/></svg> Direct impact</div>
        <div class="item"><svg width="24" height="6"><line x1="0" y1="3" x2="24" y2="3" stroke="#0a1628" stroke-width="2.5" stroke-dasharray="1 5"/></svg> Indirect — through another team</div>
        <div class="item"><svg width="24" height="6"><line x1="0" y1="3" x2="24" y2="3" stroke="#7c5a3d" stroke-width="2" stroke-dasharray="3 4"/></svg> Department-to-department link</div>
      </div>
      <div id="gtPanel" class="gt-panel" style="margin:1rem;margin-top:0"></div>
    `;
  }

  window.renderGrowthTreeTab = function () {
    injectStyles();
    _gt._initialized = false; // recompute default focus for whoever is viewing right now
    const html = `<div class="kpia-card" style="padding:0;overflow:hidden">
      <div style="padding:1.125rem 1.25rem .5rem">
        <div class="kpia-card-title">🌳 The Growth Engine — how every team drives our FY goals</div>
        <div class="kpia-card-meta">Live from KPI Targets · goal health updates automatically, nothing here is hand-typed</div>
      </div>
      <div id="gtTabBody">${treeBodyHTML(false)}</div>
    </div>`;
    setTimeout(rerenderPanelAndState, 0);
    return html;
  };

  // Re-render the body (svg regenerated) — used when the presentation overlay
  // needs its own independent copy of the same live tree.
  function refreshTabBody() {
    const mount = document.getElementById('gtTabBody');
    if (mount) mount.innerHTML = treeBodyHTML(false);
  }
  window.gtRefresh = function () { refreshTabBody(); rerenderPanelAndState(); };

  // ── Exposed for growth-tree-pdf.js — keeps one source of truth for the
  //    pillar structure, the data engine, and the tree's visual design.
  window.gtComputeTreeData = computeTreeData;
  window.gtBuildStaticSVG  = buildStaticSVG;
  window.GT_PILLARS = { order: PILLAR_ORDER, map: PILLAR_GOAL_MAP, color: PILLAR_COLOR, icon: PILLAR_ICON };

})();
