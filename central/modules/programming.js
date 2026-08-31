(function() {

  function renderProgrammingReviews() {
    const total = REVIEWS.length;
    if (!total) return '<div style="padding:2rem;text-align:center;color:var(--muted)">No site leader review data available.</div>';

    // Domain stats
    const d1Meets  = REVIEWS.filter(r => r.d1  && r.d1.includes('Meets')  && !r.d1.includes('Partial')).length;
    const d23Meets = REVIEWS.filter(r => r.d23 && r.d23.includes('Meets') && !r.d23.includes('Partial')).length;
    const d4Meets  = REVIEWS.filter(r => r.d4  && r.d4.includes('Meets')  && !r.d4.includes('Partial')).length;
    const d1Part   = REVIEWS.filter(r => r.d1  && r.d1.includes('Partially')).length;
    const d23Part  = REVIEWS.filter(r => r.d23 && r.d23.includes('Partially')).length;
    const d4Part   = REVIEWS.filter(r => r.d4  && r.d4.includes('Partially')).length;
    const allMeets = REVIEWS.filter(r =>
      r.d1.includes('Meets') && !r.d1.includes('Partial') &&
      r.d23.includes('Meets') && !r.d23.includes('Partial') &&
      r.d4.includes('Meets') && !r.d4.includes('Partial')
    ).length;
    const partial  = REVIEWS.filter(r => r.d1.includes('Partially') || r.d23.includes('Partially') || r.d4.includes('Partially'));
    const uniqueSites = [...new Set(REVIEWS.map(r => r.site))].length;

    const domColor = d => d && d.includes('Partially') ? '#92400e' : d && d.includes('N/A') ? '#64748b' : '#166534';
    const domBg    = d => d && d.includes('Partially') ? '#fffbeb' : d && d.includes('N/A') ? '#f8fafc' : '#f0fdf4';
    const domShort = d => d ? d.replace('Expectations','').replace('Meets','✅ Meets').replace('Partially','⚠️ Partially').replace('N/A','—').trim() : '—';

    let html = `<div style="padding:.25rem 0">`;

    // KPI banner
    html += `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:.6rem;margin-bottom:1.25rem">
      ${[
        { label:'Reviews Completed', val: total, color:'#1d4ed8' },
        { label:'All Domains: Meets', val: allMeets, color: allMeets===total?'#059669':'#d97706' },
        { label:'Need Coaching', val: partial.length, color: partial.length>0?'#b91c1c':'#059669' },
        { label:'Sites Covered', val: uniqueSites, color:'#7c3aed' },
        { label:'D1 Planning — Meets', val: Math.round(d1Meets/total*100)+'%', color: d1Meets===total?'#059669':'#d97706' },
        { label:'D2&3 Instruction — Meets', val: Math.round(d23Meets/total*100)+'%', color: d23Part>0?'#d97706':'#059669' },
        { label:'D4 Professionalism — Meets', val: Math.round(d4Meets/total*100)+'%', color: d4Meets===total?'#059669':'#d97706' },
      ].map(s=>`<div style="background:#fff;border:1px solid #e2e8f0;border-radius:8px;padding:.6rem .75rem;text-align:center">
        <div style="font-size:1.2rem;font-weight:800;color:${s.color}">${s.val}</div>
        <div style="font-size:.68rem;color:#64748b;text-transform:uppercase;letter-spacing:.04em;margin-top:1px">${s.label}</div>
      </div>`).join('')}
    </div>`;

    // Alert strip for partial leaders
    if (partial.length) {
      html += `<div class="ta-alert-strip" style="margin-bottom:1rem"><div class="ta-alert-icon">⚠️</div><div>
        <div class="ta-alert-title">🟡 ${partial.length} site leader${partial.length>1?'s':''} rated "Partially Meets" — coaching follow-up needed</div>
        <div class="ta-alert-body">${partial.map(r=>`<strong>${r.leader}</strong> — ${r.site} (${r.month})${r.d23.includes('Partially')?' · D2&3: Instruction':''}${r.d1.includes('Partially')?' · D1: Planning':''}${r.d4.includes('Partially')?' · D4: Professionalism':''}`).join('; ')}</div>
      </div></div>`;
    } else {
      html += `<div style="padding:.6rem 1rem;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;margin-bottom:1rem;font-size:.8rem;color:#166534">
        ✅ All reviewed site leaders are meeting expectations across all domains this cycle.
      </div>`;
    }

    // Per-site breakdown cards
    const bySite = {};
    REVIEWS.forEach(r => { if (!bySite[r.site]) bySite[r.site] = []; bySite[r.site].push(r); });
    const siteCards = Object.entries(bySite).map(([site, reviews]) => {
      const latest = reviews.sort((a,b) => new Date(b.ts)-new Date(a.ts))[0];
      const hasPartial = reviews.some(r => r.d1.includes('Partially') || r.d23.includes('Partially') || r.d4.includes('Partially'));
      const border = hasPartial ? '#f59e0b' : '#10b981';
      const leaders = [...new Set(reviews.map(r=>r.leader))].join(', ');
      return `<div style="background:#fff;border:1px solid #e2e8f0;border-left:4px solid ${border};border-radius:10px;padding:.9rem 1rem;margin-bottom:.6rem">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:.4rem">
          <div>
            <div style="font-weight:700;font-size:.9rem;color:#1e293b">${site}</div>
            <div style="font-size:.75rem;color:#64748b;margin-top:1px">Leader${reviews.length>1?'(s)':''}: ${leaders} · ${reviews.length} review${reviews.length>1?'s':''}</div>
          </div>
          <div style="font-size:.72rem;color:#94a3b8">Most recent: ${latest.month}</div>
        </div>
        <div style="display:flex;gap:.4rem;flex-wrap:wrap;margin-top:.6rem">
          ${['d1','d23','d4'].map((dom,i) => {
            const label = ['D1: Planning','D2&3: Instruction','D4: Professionalism'][i];
            const val = latest[dom] || '—';
            return `<span style="padding:.15rem .5rem;border-radius:4px;font-size:.72rem;font-weight:600;background:${domBg(val)};color:${domColor(val)}">${label}: ${domShort(val)}</span>`;
          }).join('')}
        </div>
        ${latest.notes ? `<div style="font-size:.7rem;color:#64748b;margin-top:.4rem;font-style:italic">${latest.notes}</div>` : ''}
      </div>`;
    }).join('');

    html += `<div style="margin-bottom:1.25rem">
      <div style="font-weight:700;font-size:.85rem;color:#1e293b;margin-bottom:.6rem">📍 Site-by-Site Review Snapshot</div>
      ${siteCards}
    </div>`;

    // Full log table
    const sorted = REVIEWS.slice().sort((a,b) => new Date(b.ts)-new Date(a.ts));
    html += `<div class="ta-card"><div class="ta-card-title">📋 Full Site Leader Review Log</div>
      <div style="overflow-x:auto"><table class="ta-table">
        <thead><tr><th>Leader</th><th>District / Site</th><th>Reviewed By</th><th>Month</th><th>D1: Planning</th><th>D2&3: Instruction</th><th>D4: Professionalism</th></tr></thead>
        <tbody>${sorted.map(r=>`<tr>
          <td><strong>${r.leader}</strong><br><span style="font-size:.68rem;color:#94a3b8">${r.role||''}</span></td>
          <td style="font-size:.75rem">${r.site}</td>
          <td style="font-size:.75rem">${r.pm}</td>
          <td style="font-size:.75rem;white-space:nowrap">${r.month}</td>
          ${['d1','d23','d4'].map(dom=>`<td><span style="padding:.1rem .4rem;border-radius:4px;font-size:.67rem;font-weight:600;background:${domBg(r[dom])};color:${domColor(r[dom])}">${domShort(r[dom])}</span></td>`).join('')}
        </tr>`).join('')}</tbody>
      </table></div>
    </div>`;

    html += `</div>`;
    return html;
  }

  // ── Training Dept — Site Leader Reviews Tab ──────────────────────────────

  function renderProgrammingAnalytics(data) {
    if (!data.length) return `<div style="padding:3rem;text-align:center;color:var(--muted)">No records match current filters.</div>`;
    const total = data.length;
    const byDistrict = groupBy(data, 'site');

    let html = `${goalAlignmentBadges('programming')}`;

    // Partner experience risk callout
    const highRiskDistricts = Object.entries(byDistrict).filter(([d, rows]) => {
      const esc = rows.filter(r => r.hr_action && (r.hr_action.includes('Write Up')||r.hr_action==='PGP'||r.hr_action.includes('Terminat'))).length;
      return esc > 0 || rows.length >= 6;
    });

    if (highRiskDistricts.length) {
      html += `<div class="ta-alert-strip" style="margin-bottom:1.25rem">
        <div class="ta-alert-icon">⚠️</div>
        <div><div class="ta-alert-title">🔴 Partner Satisfaction Risk — ${highRiskDistricts.length} District${highRiskDistricts.length>1?'s':''} Flagged</div>
        <div class="ta-alert-body">Goal: 90% partner satisfaction, 50% site retention. Sites with 6+ concerns or escalated HR actions may indicate delivery quality or staff stability issues that could affect partner renewal decisions. Flagged: <strong>${highRiskDistricts.map(([d])=>d).join(', ')}</strong>.</div></div>
      </div>`;
    }

    // KPI cards
    const lpCount   = data.filter(r => r.concern_type === 'Lesson Plans' || (r.concern_label||'').toLowerCase().includes('lesson')).length;
    const attCount  = data.filter(r => r.concern_type === 'Attendance').length;
    const escCount  = data.filter(r => r.hr_action && (r.hr_action.includes('Write Up')||r.hr_action==='PGP'||r.hr_action.includes('Terminat'))).length;
    html += `<div class="ta-grid ta-grid-4" style="margin-bottom:1.25rem">
      <div class="ta-card ta-kpi"><div class="ta-kpi-val">${total}</div><div class="ta-kpi-sub">Total Site Concerns</div></div>
      <div class="ta-card ta-kpi ${lpCount/total>0.3?'warning':'ok'}"><div class="ta-kpi-val">${lpCount}</div><div class="ta-kpi-sub">Lesson Plan Issues (${Math.round(lpCount/total*100)}%)</div></div>
      <div class="ta-card ta-kpi ${attCount>10?'warning':'ok'}"><div class="ta-kpi-val">${attCount}</div><div class="ta-kpi-sub">Attendance Concerns</div></div>
      <div class="ta-card ta-kpi ${escCount>3?'alert':'ok'}"><div class="ta-kpi-val">${escCount}</div><div class="ta-kpi-sub">Escalated (HR Formal Action)</div></div>
    </div>`;

    // District risk cards
    html += `<div class="ta-section-label">📍 Site-by-Site Risk Assessment</div>
    <div class="ta-grid ta-grid-3" style="margin-bottom:1.25rem">`;
    countBy(data,'site').forEach(([dist, cnt]) => {
      const dRows = byDistrict[dist] || [];
      const esc    = dRows.filter(r => r.hr_action && (r.hr_action.includes('Write Up')||r.hr_action==='PGP'||r.hr_action.includes('Terminat'))).length;
      const rep    = dRows.filter(r => r.first_time === 'No').length;
      const lp     = dRows.filter(r => r.concern_type === 'Lesson Plans').length;
      const att    = dRows.filter(r => r.concern_type === 'Attendance').length;
      const risk   = esc > 0 || cnt >= 8 ? 'high' : rep > 2 || cnt >= 4 ? 'med' : 'low';
      const rLabel = risk==='high'?'⚠️ Partner Risk':risk==='med'?'👁 Monitor':'✅ Stable';
      html += `<div class="ta-card">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:.5rem">
          <div style="font-weight:700;font-size:.9375rem;color:var(--navy);flex:1">${dist}</div>
          <span class="risk-chip risk-${risk}">${rLabel}</span>
        </div>
        <div style="font-size:2rem;font-weight:800;color:var(--navy);line-height:1">${cnt}</div>
        <div style="font-size:.75rem;color:var(--muted);margin-bottom:.75rem">${Math.round(cnt/total*100)}% of all concerns</div>
        <div style="display:flex;flex-wrap:wrap;gap:.3rem;margin-bottom:.75rem">
          ${esc>0?`<span class="concern-pill concern-writeup">${esc} escalated</span>`:''}
          ${rep>0?`<span class="concern-pill concern-warn">${rep} repeat</span>`:''}
          ${lp>0?`<span class="concern-pill concern-watch">${lp} lesson plans</span>`:''}
          ${att>0?`<span class="concern-pill concern-no">${att} attendance</span>`:''}
        </div>
        ${barRows(countBy(dRows,'concern_label').slice(0,3), cnt, '#457b9d')}
      </div>`;
    });
    html += `</div>`;

    // Site leader reviews cross-reference
    const reviewCount = REVIEWS.length;
    const reviewsByDistrict = groupBy(REVIEWS, 'site');
    html += `<div class="ta-grid ta-grid-2" style="margin-bottom:1rem">
      <div class="ta-card">
        <div class="ta-card-title">📋 Concern Type Distribution</div>
        ${barRows(countBy(data,'concern_type').slice(0,6), total, '#457b9d')}
      </div>
      <div class="ta-card">
        <div class="ta-card-title">⭐ Site Leader Review Coverage</div>
        <div style="font-size:.8125rem;color:var(--muted);margin-bottom:.75rem">${reviewCount} site leader reviews completed this cycle</div>
        ${barRows(countBy(REVIEWS,'site').slice(0,6), reviewCount||1, '#2a9d8f')}
        <div style="margin-top:.75rem;padding:.75rem;background:#f0fdf4;border-radius:8px;font-size:.8125rem;color:#065f46">
          ✅ All reviewed site leaders are rated "Meets Expectations" in Domains 1 & 4.
          ${REVIEWS.filter(r=>r.d23.includes('Partially')).length > 0 ?
            `<br>⚠️ ${REVIEWS.filter(r=>r.d23.includes('Partially')).length} site leader(s) "Partially Meets" in Domain 2&3 — coaching intervention recommended.` : ''}
        </div>
      </div>
    </div>`;

    // Support type → coaching loop
    html += `<div class="ta-card">
      <div class="ta-card-title">🛠 Intervention Type Analysis — Coaching Effectiveness Loop</div>
      <div class="ta-grid ta-grid-2">
        <div>${barRows(countBy(data,'support_type').slice(0,6), total, '#e76f51')}</div>
        <div style="font-size:.8125rem;line-height:1.7;padding:.5rem 0;color:var(--text)">
          <strong>Coaching Loop Insight:</strong><br>
          Verbal warnings without follow-up escalation suggest intervention is resolving issues. Sites where the same employee appears in 3+ entries despite coaching signal the need to loop in HR for formal support.<br><br>
          <strong>Partner Satisfaction Connection:</strong><br>
          Lesson plan concerns at 6+ per district should trigger a district-level PM conversation before the next partner check-in — these directly affect the 90% satisfaction goal.
        </div>
      </div>
    </div>`;
    return html;
  }

  // ════════════════════════════════════════════════════════════════
  //  LEADERSHIP ANALYTICS — Exec view: Concerns + Site Observations
  // ════════════════════════════════════════════════════════════════

  const sya = (() => {

    // ── LIVE DATA URLS ───────────────────────────────────────────────────
    // SY 25-26: frozen snapshot — still live/readable, no longer updated.
    const SY_CSV_URL_2526 =
      'https://docs.google.com/spreadsheets/d/e/2PACX-1vQJhAQMZ8nUJ6fV03eV0-uALiqnvQ3wEZ7n03n-ZuvPSNJz9QQbjL06uVM2hnajdcLSDL3m83HfSfVM/pub?output=csv&gid=628127573';
    // SY 26-27: live — contains both Summer 2026 and School Year 26-27 rows (Cycle col).
    // Must use 2PACX published URL — sheet-ID /pub endpoint redirects to Google login.
    // 404 FIX: truncated 2PACX key (86 chars, needs 80) → gviz sheet-ID endpoint
    const TRACKER_SHEET_ID = '1x3dWZQhx9XWqB8YASInOMTr0JDjSRMqv3w7PmcruuMU';
    const SY_CSV_URL_2627  = `https://docs.google.com/spreadsheets/d/${TRACKER_SHEET_ID}/gviz/tq?tqx=out:csv&gid=1830091227`;
    // Onsite Tracker (Summer 2026 + SY 26-27 staff pipeline) — same workbook, gid=0.
    const TRACKER_CSV_URL  = `https://docs.google.com/spreadsheets/d/${TRACKER_SHEET_ID}/gviz/tq?tqx=out:csv&gid=0`;

    // Active period: 'sy2526' | 'summer2026' | 'sy2627'  (default: SY 26-27)
    let _activePeriod = 'sy2627';

    const SY_REFRESH_MS   = 5 * 60 * 1000;  // 5 min — matches KPI pattern
    const GEOCODE_RATE_MS = 1150;            // Nominatim ≤1 req/sec + buffer
    const GEOCODE_CACHE_KEY = 'njtc_sy_geocache_v4';

    // ── COLUMN INDEXES: SY 26-27 sheet (Cycle col at position 0) ─────────
    const C_2627 = {
      CYCLE:        0,  // A  — Cycle (Summer 2026 / School Year 26-27)
      FEE:          1,  // B  — ROLE GATED: finance, leadership
      STATUS:       2,  // C
      COUNTY:       3,  // D
      PM:           4,  // E
      LEAD_HIRING:  5,  // F
      DISTRICT:     6,  // G  — INCLUSION: must be non-blank
      SCHOOL:       7,  // H  — INCLUSION: must be non-blank
      ADDRESS:      8,  // I  — geocoding only; never shown as text
      CONFIRMED:    9,  // J
      EST:         10,  // K  — Estimated # Scholars
      ACT:         11,  // L  — Rostered Scholars in Pearl
      CONTENT:     12,  // M
      GRADES:      13,  // N
      TUTOR_TYPE:  14,  // O
      BLOCK:       15,  // P
      START:       16,  // Q
      MIDPOINT:    17,  // R
      ENDPOINT:    18,  // S
      DAYS:        19,  // T
      ASSESS:      20,  // U
      TUTOR_TIMES: 21,  // V  — Tutoring Times
      PROG_WEEKS:  22,  // W  — # of Weeks for Programming
      WEEKLY_WK:   23,  // X  — Weekly Work Time
      PRE_APP_POS: 24,  // Y  — Pre-Apprentice Spots (new in 26-27)
      PRE_APP_FILL:25,  // Z  — Filled Pre-App Spots (new in 26-27)
      TUTOR_POS:   26,  // AA — Tutor Positions
      TUTOR_FILL:  27,  // AB — Filled Tutor Positions
      APPRENT:     28,  // AC — Apprentice Tutors
      SC_POS:      29,  // AD — SC Positions
      SC_FILL:     30,  // AE — Filled SC
      IC_POS:      31,  // AF — IC Positions
      IC_FILL:     32,  // AG — Filled IC
      DR_POS:      33,  // AH — Dual Role Positions
      DR_FILL:     34,  // AI — Filled Dual Role
      TOTAL_STAFF: 35,  // AJ — Total staffing
      PCT_HIRED:   36,  // AK — ROLE GATED: programming, leadership, hr
      TOTAL_SL:    37,  // AL — Total site leader positions
      PARTNER_NM:  40,  // AO — Partner Contact Name
      PARTNER_EM:  41,  // AP — Partner Email
      MOU:         42,  // AQ — MOU/DSA Signed
      DS_NAME:     43,  // AR — Data Specialist Name
      DS_EMAIL:    44,  // AS — Data Specialist Email
      BA_NAME:     45,  // AT — BA/Finance Name
    };
    // ── COLUMN INDEXES: SY 25-26 sheet (legacy — no Cycle col) ───────────
    const C_2526 = {
      CYCLE:       -1,  // not present in 25-26 sheet
      FEE:          0,  STATUS: 1, COUNTY: 2, PM: 3, LEAD_HIRING: 4,
      DISTRICT:     5,  SCHOOL: 6, ADDRESS: 7, CONFIRMED: 8,
      EST:          9,  ACT: 10, CONTENT: 11, GRADES: 12, TUTOR_TYPE: 13,
      BLOCK:       14,  START: 15, MIDPOINT: 16, ENDPOINT: 17, DAYS: 18,
      ASSESS:      19,  TUTOR_TIMES: 20, PROG_WEEKS: 21,
      PRE_APP_POS: -1, PRE_APP_FILL: -1, TOTAL_SL: -1,
      TUTOR_POS:   23,  TUTOR_FILL: 24, APPRENT: 25,
      SC_POS:      26,  SC_FILL: 27, IC_POS: 28, IC_FILL: 29,
      DR_POS:      30,  DR_FILL: 31, TOTAL_STAFF: 32, PCT_HIRED: 33,
      PARTNER_NM:  37,  PARTNER_EM: 38, MOU: 39,
      DS_NAME:     40,  DS_EMAIL: 41, BA_NAME: 42,
    };
    // Active column map — switches when period changes
    let C = C_2627;

    const ROLES_FEE   = ['finance', 'leadership'];
    const ROLES_PCTHR = ['programming', 'leadership', 'hr'];

    // ── STATE ─────────────────────────────────────────────────────────────
    let _allSites     = [];
    let _filtered     = [];
    let _snapshot     = {};
    let _changes      = [];
    let _selKey       = null;
    let _inited       = false;
    let _lastFetch    = null;
    let _trackerRows  = [];
    let _trackerReady = false;

    // ── RFC-4180 CSV PARSER ───────────────────────────────────────────────
    // State-machine parser that correctly handles quoted fields containing
    // embedded newlines and commas. Required because this sheet has 170+
    // newlines inside quoted cells (spring-break dates, contact info, etc.).
    // A simple text.split('\n') would fracture those rows → wrong totals.
    function parseCSVFull(text) {
      const rows = [];
      let row = [], field = '', inQ = false;
      const src = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
      for (let i = 0; i < src.length; i++) {
        const ch = src[i];
        if (inQ) {
          if (ch === '"') {
            if (src[i + 1] === '"') { field += '"'; i++; }  // escaped ""
            else inQ = false;
          } else {
            field += ch;  // newlines inside quotes are part of the field
          }
        } else {
          if      (ch === '"')  { inQ = true; }
          else if (ch === ',')  { row.push(field.trim()); field = ''; }
          else if (ch === '\n') { row.push(field.trim()); field = ''; rows.push(row); row = []; }
          else                  { field += ch; }
        }
      }
      if (field.trim() || row.length) { row.push(field.trim()); rows.push(row); }
      return rows;
    }

    // ── PARSE SY ROWS ─────────────────────────────────────────────────────
    // Headers detected by "fee for service" in any of the first 8 rows.
    // Accepts a column map (cols) so it works for both 25-26 and 26-27 sheets.
    // Rows missing District OR School are always excluded.
    function parseSYRows(text, cols) {
      const CM    = cols || C;  // column map for this sheet version
      const rows  = parseCSVFull(text);
      let hIdx    = -1;
      for (let i = 0; i < Math.min(8, rows.length); i++) {
        if (rows[i].join(',').toLowerCase().includes('fee for service')) { hIdx = i; break; }
      }
      if (hIdx < 0) { console.warn('[SY] Header row not found'); return []; }

      const sites = [];
      for (let i = hIdx + 1; i < rows.length; i++) {
        const cols2 = rows[i];
        if (!cols2 || cols2.length < 7) continue;
        const district = (cols2[CM.DISTRICT] || '').replace(/\n/g, ' ').trim();
        const school   = (cols2[CM.SCHOOL]   || '').replace(/\n/g, ' ').trim();
        if (!district || !school) continue;  // INCLUSION RULE — non-negotiable

        const g = idx => idx >= 0 ? (cols2[idx] || '').replace(/\n/g, ' ').trim() : '';
        const n = idx => { if (idx < 0) return 0; const v = g(idx); if (!v) return 0; const f = parseFloat(v); return isNaN(f) ? 0 : f; };

        const agNum     = n(CM.TOTAL_STAFF);
        const filledSum = n(CM.TUTOR_FILL) + n(CM.SC_FILL) + n(CM.IC_FILL) + n(CM.DR_FILL);
        const address   = (cols2[CM.ADDRESS] || '').replace(/[\r\n]+/g, ' ').replace(/\s{2,}/g, ' ').trim();
        const cycleRaw  = CM.CYCLE >= 0 ? g(CM.CYCLE) : '';

        sites.push({
          key: district + ' | ' + school,
          district, school, address,
          cycle: cycleRaw,
          status: g(CM.STATUS), county: g(CM.COUNTY), pm: g(CM.PM),
          act: n(CM.ACT), est: n(CM.EST),
          content: g(CM.CONTENT), grades: g(CM.GRADES),
          tutorType: g(CM.TUTOR_TYPE), block: g(CM.BLOCK),
          startDate: g(CM.START), midpoint: g(CM.MIDPOINT), endpoint: g(CM.ENDPOINT),
          days: g(CM.DAYS), assessModel: g(CM.ASSESS),
          progWeeks: n(CM.PROG_WEEKS),
          preAppPos: n(CM.PRE_APP_POS), preAppFill: n(CM.PRE_APP_FILL),
          tutorPos: n(CM.TUTOR_POS), tutorFill: n(CM.TUTOR_FILL),
          apprentice: n(CM.APPRENT),
          scPos: n(CM.SC_POS),   scFill: n(CM.SC_FILL),
          icPos: n(CM.IC_POS),   icFill: n(CM.IC_FILL),
          drPos: n(CM.DR_POS),   drFill: n(CM.DR_FILL),
          totalStaff: agNum || filledSum,
          pctHired:    g(CM.PCT_HIRED),   // role-gated
          feePartner:  g(CM.FEE),         // role-gated
          partnerName: g(CM.PARTNER_NM), partnerEmail: g(CM.PARTNER_EM),
          mou: g(CM.MOU), dsName: g(CM.DS_NAME), dsEmail: g(CM.DS_EMAIL),
          baName: g(CM.BA_NAME),
          lat: null, lng: null, geocodeFailed: false, geocodeReason: '',
        });
      }
      return sites;
    }

    // ── ROLE HELPERS ──────────────────────────────────────────────────────
    function dept() {
      const d = typeof _currentDept !== 'undefined' ? _currentDept
              : (window.NJTC_SESSION ? window.NJTC_SESSION.dept : '');
      return (d || '').toLowerCase();
    }
    const canSeeFee = () => ROLES_FEE.includes(dept());
    const canSeePct = () => ROLES_PCTHR.includes(dept());

    // ── CHANGE DETECTION ──────────────────────────────────────────────────
    const TRACKED = [
      ['act','Actual Scholars'],['est','Est. Scholars'],['totalStaff','Total Staff'],
      ['content','Content'],['tutorType','Tutoring Type'],['startDate','Start Date'],
      ['midpoint','Midpoint'],['endpoint','End Date'],['days','Days of Week'],
      ['assessModel','Assessment Model'],['status','Status'],['pctHired','% Hired'],
    ];
    const mkSnap = sites => { const s = {}; sites.forEach(r => { s[r.key] = r; }); return s; };
    function diffSnaps(oldSnap, newSites) {
      const chg = [], ns = mkSnap(newSites);
      const ok = new Set(Object.keys(oldSnap)), nk = new Set(Object.keys(ns));
      nk.forEach(k => { if (!ok.has(k)) chg.push({ type:'added',   key:k, school:ns[k].school, district:ns[k].district }); });
      ok.forEach(k => { if (!nk.has(k)) chg.push({ type:'removed', key:k, school:oldSnap[k].school, district:oldSnap[k].district }); });
      nk.forEach(k => {
        if (!ok.has(k)) return;
        const fc = TRACKED.reduce((a,[f,lbl]) => {
          const ov = String(oldSnap[k][f]??''), nv = String(ns[k][f]??'');
          if (ov !== nv) a.push({field:lbl, from:ov||'—', to:nv||'—'});
          return a;
        }, []);
        if (fc.length) chg.push({type:'modified', key:k, school:ns[k].school, district:ns[k].district, fields:fc});
      });
      return chg;
    }

    // ── FETCH / REFRESH ───────────────────────────────────────────────────
    async function refresh(force = false) {
      const btn = document.getElementById('syRefreshBtn');
      if (btn) btn.disabled = true;

      // Period-specific URL, column map, and cache key
      const isLegacy  = _activePeriod === 'sy2526';
      const fetchURL  = isLegacy ? SY_CSV_URL_2526 : SY_CSV_URL_2627;
      const colMap    = isLegacy ? C_2526 : C_2627;
      const cacheKey  = isLegacy ? 'njtc_sya_2526_v1' : 'njtc_sya_2627_v1';
      C = colMap;  // update active column map

      // ── stale-while-revalidate: show cached data immediately ─────────
      if (!force) {
        const _sc = NJTC_CACHE.get(cacheKey);
        if (_sc && _sc.data && _sc.data.length) {
          _allSites  = _sc.data;
          _snapshot  = mkSnap(_sc.data);
          _lastFetch = new Date(Date.now() - _sc.age);
          window.NJTC_LOCATIONS = _sc.data;
          setSyncState(_sc.fresh ? 'live' : 'stale');
          populateFilters();
          applyFilters();
          updateMapMarkers();
          if (btn) btn.disabled = false;
          if (_sc.fresh) return;  // cache still fresh, skip network
          // stale: continue to background re-fetch below
        }
      }

      setSyncState('loading');
      try {
        // Cache-bust appended as query param — same pattern as KPI fetch
        const url = fetchURL + (force ? '&t=' + Date.now() : '');
        const res = await fetch(url, { signal: AbortSignal.timeout(25000) });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const csv = await res.text();
        const sites = parseSYRows(csv, colMap);
        if (!sites.length) throw new Error('Parsed 0 valid sites');
        _changes   = _allSites.length ? diffSnaps(mkSnap(_allSites), sites) : [];
        _allSites  = sites;
        _snapshot  = mkSnap(sites);
        _lastFetch = new Date();
        NJTC_CACHE.set(cacheKey, sites);
        // Expose site-level position data for DOL report (both SY 25-26 and 26-27/Summer)
        window.NJTC_LOCATIONS = sites;
        setSyncState('live');
        populateFilters();
        applyFilters();
        updateMapMarkers();
        // Also kick the tracker fetch when loading 26-27 data
        if (!isLegacy && !_trackerReady) fetchOnsiteTracker();
      } catch (e) {
        console.warn('[SY Analytics] Fetch failed:', e.message);
        setSyncState('error');
      }
      if (btn) btn.disabled = false;
    }

    function setSyncState(state) {
      const dot  = document.getElementById('sySyncDot');
      const txt  = document.getElementById('sySyncText');
      const cbtn = document.getElementById('syChangesBtn');
      const nbdg = document.getElementById('syChangesBadge');
      if (!dot) return;
      if (state === 'loading') {
        dot.className = 'sync-dot loading';
        if (txt) txt.textContent = 'Fetching live SY data…';
      } else if (state === 'stale') {
        dot.className = 'sync-dot';
        dot.style.background = '#f59e0b';
        if (txt) txt.innerHTML = 'Cached data · <em style="color:#92400e">Refreshing…</em>';
      } else if (state === 'live') {
        dot.className = 'sync-dot';
        const t = _lastFetch ? _lastFetch.toLocaleTimeString() : '—';
        const periodLabel = _activePeriod === 'sy2526' ? 'SY 25-26 (archived)' : _activePeriod === 'summer2026' ? 'Summer 2026' : 'SY 26-27';
        if (txt) txt.innerHTML = `<strong>Live · Google Sheet</strong>&nbsp;· ${periodLabel} · ${_filtered.length} sites · Updated ${t}`;
        const hc = _changes.length > 0;
        if (cbtn) { cbtn.style.display = hc ? '' : 'none'; if (hc) document.getElementById('syChangesBtnN').textContent = _changes.length; }
        if (nbdg) { nbdg.style.display = hc ? '' : 'none'; if (hc) nbdg.textContent = _changes.length; }
        // Summer badge: show on SY 26-27 view to remind users summer is active
        const badge = document.getElementById('sySummerBadge');
        if (badge) badge.style.display = _activePeriod === 'sy2627' ? 'inline' : 'none';
      } else {
        dot.className = 'sync-dot error';
        if (txt) txt.innerHTML = _lastFetch
          ? `<strong>⚠️ Sheet unreachable</strong> · Last: ${_lastFetch.toLocaleTimeString()}`
          : '<strong>⚠️ Could not load SY data</strong> · Click ↺ Refresh';
      }
    }

    // ── FILTERS ───────────────────────────────────────────────────────────
    function applyFilters() {
      const v = id => (document.getElementById(id)||{}).value||'';
      const fD=v('syFDistrict'),fC=v('syFContent'),fT=v('syFType'),
            fA=v('syFAssess'),  fW=v('syFDays'),   fS=v('syFStatus');

      // Cycle filter — 26-27 sheet has both Summer 2026 and SY 26-27 rows
      const cycleLC = _activePeriod === 'summer2026' ? 'summer 2026'
                    : _activePeriod === 'sy2627'     ? 'school year'
                    : '';  // sy2526 has no cycle col — no filter needed

      _filtered = _allSites.filter(s =>
        (!cycleLC || (s.cycle||'').toLowerCase().includes(cycleLC)) &&
        (!fD || s.district === fD) &&
        (!fC || s.content.toLowerCase().includes(fC.toLowerCase())) &&
        (!fT || s.tutorType.toLowerCase().includes(fT.toLowerCase())) &&
        (!fA || s.assessModel.toLowerCase().includes(fA.toLowerCase())) &&
        (!fW || s.days.toLowerCase().includes(fW.toLowerCase())) &&
        (!fS || s.status === fS)
      );
      const fi = document.getElementById('syFilterInfo');
      const active = !!(fD||fC||fT||fA||fW||fS);
      if (fi) fi.textContent = active ? `${_filtered.length} site${_filtered.length!==1?'s':''} matching` : '';
      if (_selKey && !_filtered.some(s => s.key === _selKey)) {
        _selKey = null;
        const card = document.getElementById('syDetailCard');
        if (card) card.innerHTML = '';
      }
      updateStats(); renderDistrictList(); renderTable(); updateMapMarkers();
    }

    function clearFilters() {
      ['syFDistrict','syFContent','syFType','syFAssess','syFDays','syFStatus']
        .forEach(id => { const el=document.getElementById(id); if(el) el.value=''; });
      applyFilters();
    }

    function filterByDistrict(dist) {
      const sel = document.getElementById('syFDistrict');
      if (!sel) return;
      sel.value = (sel.value === dist) ? '' : dist;
      applyFilters();
    }

    function populateFilters() {
      function pop(id, vals) {
        const el = document.getElementById(id); if (!el) return;
        const cur = el.value, first = el.options[0] ? el.options[0].outerHTML : '';
        el.innerHTML = first + [...vals].filter(Boolean).sort()
          .map(v => `<option value="${v}">${v}</option>`).join('');
        if ([...el.options].some(o => o.value === cur)) el.value = cur;
      }
      pop('syFDistrict', new Set(_allSites.map(s => s.district)));
      pop('syFContent',  new Set(_allSites.map(s => s.content)));
      pop('syFType',     new Set(_allSites.map(s => s.tutorType)));
      pop('syFAssess',   new Set(_allSites.map(s => s.assessModel)));
      pop('syFDays',     new Set(_allSites.map(s => s.days)));
    }

    // ── STATS ─────────────────────────────────────────────────────────────
    function updateStats() {
      const s = _filtered;
      // Summer 2026: all KPI tiles derive from tracker data (Locations sheet has no summer rows)
      if (_activePeriod === 'summer2026' && _trackerReady) {
        const sumRows   = _trackerRows.filter(r => r.isSummer);
        const empRows   = sumRows.filter(r => r.isActive && !r.isPreApp && !r.isTerminated);
        const preRows   = sumRows.filter(r => r.isActive && r.isPreApp);
        const sites     = new Set(sumRows.filter(r => r.location).map(r => r.location));
        const districts = new Set(sumRows.filter(r => r.district || r.county).map(r => r.district || r.county));
        setText('syStatSites',     sites.size);
        setText('syStatDistricts', districts.size);
        // Active/Est Scholars: pull from Pearl live data — but ONLY if Pearl's own
        // toggle is currently on Summer 2026 too (po holds one period in memory at
        // a time). If Pearl hasn't been switched to Summer yet, kick it over now
        // so the numbers populate without the user needing to visit Pearl Ops first.
        const _poStatsSummer = (window.po && typeof window.po.getStats === 'function') ? window.po.getStats() : null;
        const _poIsSummer = _poStatsSummer && _poStatsSummer.activePeriod === 'summer2026';
        if (_poIsSummer && _poStatsSummer.activeScholars != null) {
          setText('syStatActual', _poStatsSummer.activeScholars.toLocaleString());
        } else {
          setText('syStatActual', '—');
        }
        if (_poIsSummer && _poStatsSummer.rosteredScholars != null) {
          // No separate "quoted capacity" sheet exists for Summer — Pearl's rostered
          // (enrolled) scholar count is the closest available "Est. Scholars" figure.
          setText('syStatEst', _poStatsSummer.rosteredScholars.toLocaleString());
        } else {
          setText('syStatEst', '—');
        }
        if (!_poIsSummer && window.po && typeof window.po.setPeriod === 'function') {
          window.po.setPeriod('summer2026'); // triggers refresh; next updateStats() pass will have real numbers
        }
        // Staff — Summer only: sourced from Pearl instead of the onsite tracker/HR list.
        //   Total Staff  = every unique instructor who appears in Pearl for this period.
        //   Active Staff = unique instructors with at least 1 completed/attended session.
        // SY periods are untouched — they still use the tracker/HR Master List path below.
        const _staffTotal  = _poIsSummer && _poStatsSummer.activeTutors      != null ? _poStatsSummer.activeTutors      : null;
        const _staffActive = _poIsSummer && _poStatsSummer.activeInstructors != null ? _poStatsSummer.activeInstructors : null;
        setText('syStatStaff', _staffTotal != null ? _staffTotal.toLocaleString() : empRows.length.toLocaleString());
        setText('syStatStaffSub', _staffTotal != null ? 'Unique instructors · Pearl' : 'Active FT staff · Summer tracker');
        // Cache stats for Exec Dashboard period selector
        window._syaStats = window._syaStats || {};
        window._syaStats['summer2026'] = {
          sites: sites.size, districts: districts.size,
          staff:       _staffTotal  != null ? _staffTotal  : empRows.length,
          staffActive: _staffActive != null ? _staffActive : null,
          activeScholars: _poIsSummer ? _poStatsSummer.activeScholars : null,
          rosteredScholars: _poIsSummer ? _poStatsSummer.rosteredScholars : null,
        };
        // Notify exec dashboard
        try { if (typeof window._execDashRefresh === 'function') window._execDashRefresh(true); } catch(_e) {}
        return;
      }
      setText('syStatSites',     s.length);
      setText('syStatDistricts', new Set(s.map(r => r.district)).size);
      // Active scholars: pull directly from Pearl live data (unique scholars with ≥1 Attended/Late session).
      // Falls back to SY database enrollment sum if Pearl hasn't loaded, OR if Pearl's own
      // toggle is currently sitting on Summer data (po only holds one period at a time —
      // this branch is SY 25-26/26-27, so a Summer-loaded po shouldn't feed numbers here).
      const _poStats = (window.po && typeof window.po.getStats === 'function') ? window.po.getStats() : null;
      const _pearlActive = (_poStats && _poStats.activePeriod === 'sy2526' && _poStats.activeScholars != null) ? _poStats.activeScholars : null;
      setText('syStatActual',    _pearlActive != null ? _pearlActive.toLocaleString() : s.reduce((a,r) => a + r.act, 0).toLocaleString());
      setText('syStatEst',       s.reduce((a,r) => a + r.est, 0).toLocaleString());
      // Total Staff: HR Master List (authoritative) or DB sum fallback.
      const _hrStaff = (window._hrDataFetched && typeof HR_EMPS !== 'undefined' && HR_EMPS.length)
        ? HR_EMPS.filter(function(e){ return e.s === 'Active'; }).length : null;
      const stf = s.reduce((a,r) => a + r.totalStaff, 0);
      setText('syStatStaff', _hrStaff != null ? _hrStaff.toLocaleString() : (stf % 1 === 0 ? stf.toLocaleString() : stf.toFixed(1)));
      // Cache stats for Exec Dashboard period selector
      window._syaStats = window._syaStats || {};
      window._syaStats[_activePeriod] = {
        sites: s.length,
        districts: new Set(s.map(r => r.district)).size,
        staff: _hrStaff != null ? _hrStaff : stf,
      };
      // Always back-fill summer2026 stats from tracker data when available —
      // the SY Analytics default period is sy2627, so the summer branch above
      // never runs on initial load. Computing here ensures the Exec Dashboard
      // Summer 2026 tab has data without requiring a manual period switch.
      if (_trackerReady && _trackerRows.length) {
        const _sumRows   = _trackerRows.filter(r => r.isSummer);
        const _sumEmp    = _sumRows.filter(r => r.isActive && !r.isPreApp && !r.isTerminated);
        const _sumSites  = new Set(_sumRows.filter(r => r.location).map(r => r.location));
        const _sumDists  = new Set(_sumRows.filter(r => r.district || r.county).map(r => r.district || r.county));
        window._syaStats['summer2026'] = { sites: _sumSites.size, districts: _sumDists.size, staff: _sumEmp.length };
      }
      // Notify exec dashboard
      try { if (typeof window._execDashRefresh === 'function') window._execDashRefresh(true); } catch(_e) {}
    }

    // ── DISTRICT LIST ─────────────────────────────────────────────────────
    function renderDistrictList() {
      const el = document.getElementById('syDistrictList'); if (!el) return;
      const map = {};
      _filtered.forEach(s => {
        if (!map[s.district]) map[s.district] = {c:0,act:0,est:0,stf:0};
        map[s.district].c++; map[s.district].act+=s.act;
        map[s.district].est+=s.est; map[s.district].stf+=s.totalStaff;
      });
      const cur = (document.getElementById('syFDistrict')||{}).value||'';
      el.innerHTML = Object.entries(map).sort((a,b)=>b[1].act-a[1].act).map(([d,v]) => {
        const esc = d.replace(/'/g,"\\'");
        const stfStr = v.stf%1===0?v.stf.toLocaleString():v.stf.toFixed(1);
        return `<div class="sy-district-item${cur===d?' syd-active':''}" onclick="sya.filterByDistrict('${esc}')">
          <div class="sy-dist-name">${d}</div>
          <div class="sy-dist-meta">
            <span>${v.c} site${v.c!==1?'s':''}</span>
            <span>· ${v.act.toLocaleString()} scholars</span>
            <span>· ${stfStr} staff</span>
          </div>
        </div>`;
      }).join('');
    }

    // ── TABLE ─────────────────────────────────────────────────────────────
    function renderTable() {
      const tbody = document.getElementById('syTableBody');
      const cnt   = document.getElementById('syTableCount');
      if (!tbody) return;
      if (cnt) cnt.textContent = `(${_filtered.length} of ${_allSites.length})`;
      const dash = '<span style="color:var(--muted)">—</span>';
      tbody.innerHTML = _filtered.map(s => {
        const hl  = s.key === _selKey ? 'sy-row-hl' : '';
        const esc = s.key.replace(/'/g,"\\'");
        const stfStr = s.totalStaff ? (s.totalStaff%1===0?s.totalStaff:s.totalStaff.toFixed(1)) : dash;
        return `<tr class="${hl}" onclick="sya.selectSite('${esc}')">
          <td style="font-size:.75rem;color:var(--text-2);max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${s.district}">${s.district}</td>
          <td style="font-weight:600;color:var(--navy);max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${s.school}">${s.school}</td>
          <td style="text-align:center;font-family:'DM Serif Display',serif;font-size:1rem;color:var(--navy)">${s.act||dash}</td>
          <td style="text-align:center;font-family:'DM Serif Display',serif;font-size:1rem;color:var(--navy)">${s.est||dash}</td>
          <td style="text-align:center;font-family:'DM Serif Display',serif;font-size:1rem;color:var(--navy)">${stfStr}</td>
          <td style="font-size:.75rem;color:var(--text-2)">${s.content||dash}</td>
          <td style="font-size:.75rem;color:var(--text-2)">${s.tutorType||dash}</td>
          <td style="font-size:.75rem;color:var(--text-2)">${s.assessModel||dash}</td>
        </tr>`;
      }).join('');
    }

    // ── DETAIL CARD ───────────────────────────────────────────────────────
    function selectSite(key) {
      _selKey = key;
      const site = _allSites.find(s => s.key === key);
      if (!site) return;
      renderDetail(site);
      renderSVGMap();
      document.querySelectorAll('#syTableBody tr').forEach(tr => tr.classList.remove('sy-row-hl'));
      const idx = _filtered.findIndex(s => s.key === key);
      const rows = document.querySelectorAll('#syTableBody tr');
      if (idx >= 0 && rows[idx]) { rows[idx].classList.add('sy-row-hl'); rows[idx].scrollIntoView({behavior:'smooth',block:'nearest'}); }
    }

    function renderDetail(s) {
      const card = document.getElementById('syDetailCard'); if (!card) return;
      const v   = x => (x !== null && x !== undefined && String(x).trim()) ? x : null;
      const row = (lbl, val) => val !== null && val !== undefined && String(val).trim()
        ? `<div class="sy-detail-row"><span class="sy-detail-label">${lbl}</span><span class="sy-detail-val">${val}</span></div>` : '';
      const sec = lbl => `<div class="sy-detail-section">${lbl}</div>`;
      const stfStr = s.totalStaff ? (s.totalStaff%1===0?s.totalStaff:s.totalStaff.toFixed(1)) : '—';
      const staffPairs = [['Tutors',s.tutorFill,s.tutorPos],['Site Coord',s.scFill,s.scPos],['Instr. Coach',s.icFill,s.icPos],['Dual Role',s.drFill,s.drPos]].filter(([,f,p])=>f||p);
      const staffGrid = staffPairs.length ? `<div class="sy-staff-grid">
        ${staffPairs.map(([lbl,f,p])=>`<div><div class="sy-staff-cell-label">${lbl}</div><div class="sy-staff-cell-val">${f||0}/${p||0}</div></div>`).join('')}
        ${s.apprentice?`<div><div class="sy-staff-cell-label">Apprentice</div><div class="sy-staff-cell-val">${s.apprentice}</div></div>`:''}
      </div>` : '';
      const partnerBlock = (v(s.partnerName)||v(s.partnerEmail)||v(s.mou)||v(s.dsName)||v(s.baName))
        ? sec('Partner & Contacts') +
          row('LEA / Partner',    v(s.partnerName)) +
          row('Partner Email',    v(s.partnerEmail) ? `<a href="mailto:${s.partnerEmail}" style="color:var(--blue-mid)">${s.partnerEmail}</a>` : null) +
          row('MOU / DSA Signed', v(s.mou)) +
          row('Data Specialist',  v(s.dsName)) +
          row('DS Email',         v(s.dsEmail) ? `<a href="mailto:${s.dsEmail}" style="color:var(--blue-mid)">${s.dsEmail}</a>` : null) +
          row('BA / Finance',     v(s.baName)) : '';
      const feeBlock = canSeeFee() ? row('Fee for Service Partner', v(s.feePartner)||'N/A') : '';
      const pctBlock = canSeePct() ? row('Percent Hired',           v(s.pctHired)||'—')    : '';
      const gatedBlock = (feeBlock||pctBlock) ? sec('Finance / Staffing') + feeBlock + pctBlock : '';
      card.innerHTML = `
        <div class="sy-detail-school">${s.school}</div>
        <div class="sy-detail-district">${s.district}</div>
        ${sec('Scholars')}
        ${row('Actual (Pearl)', s.act||null)}${row('Estimated', s.est||null)}
        ${sec('Programming')}
        ${row('Content', v(s.content))}${row('Tutoring Type', v(s.tutorType))}
        ${row('Days of Week', v(s.days))}${row('Assessment', v(s.assessModel))}
        ${row('Start Date', v(s.startDate))}${row('Midpoint', v(s.midpoint))}
        ${row('End Date', v(s.endpoint))}${row('Grades', v(s.grades))}
        ${sec('Staffing')}${staffGrid}${row('Total Staff', stfStr)}
        ${partnerBlock}${gatedBlock}`;
    }

    // ── SVG DOT MAP ───────────────────────────────────────────────────────
    // NJ outline path scaled to viewBox 0 0 400 500
    // Pins positioned by lat/lng → pixel using linear projection for NJ bounds
    // lat: 38.85–41.36 (NJ+PA range), lng: -75.65–-73.85
    // ── SVG DOT MAP (premium redesign) ─────────────────────────────────
    // Projection: NJ+PA coverage, viewBox 500×600
    const NJ_BOUNDS = { latMin:38.9, latMax:41.4, lngMin:-75.7, lngMax:-73.8 };
    const SVG_W = 500, SVG_H = 600;

    function latLngToXY(lat, lng) {
      const x = ((lng - NJ_BOUNDS.lngMin) / (NJ_BOUNDS.lngMax - NJ_BOUNDS.lngMin)) * SVG_W;
      const y = SVG_H - ((lat - NJ_BOUNDS.latMin) / (NJ_BOUNDS.latMax - NJ_BOUNDS.latMin)) * SVG_H;
      return { x: +x.toFixed(1), y: +y.toFixed(1) };
    }

    // Accurate NJ state outline — real coordinates projected to SVG space
    // Key points traced from NJ boundary (lat/lng pairs → projected)
    const NJ_LATLNG = [
      [41.357,[-74.695]],[41.36,[-74.02]],[41.21,[-73.89]],[41.10,[-73.90]],
      [40.99,[-73.91]],[40.96,[-73.89]],[40.86,[-73.93]],[40.79,[-73.97]],
      [40.69,[-74.03]],[40.65,[-74.18]],[40.64,[-74.22]],[40.58,[-74.25]],
      [40.50,[-74.27]],[40.45,[-74.27]],[40.39,[-74.22]],[40.33,[-74.11]],
      [40.25,[-74.01]],[40.17,[-74.01]],[40.08,[-74.07]],[39.99,[-74.18]],
      [39.92,[-74.24]],[39.87,[-74.27]],[39.79,[-74.32]],[39.73,[-74.35]],
      [39.65,[-74.30]],[39.54,[-74.26]],[39.46,[-74.35]],[39.38,[-74.44]],
      [39.31,[-74.58]],[39.21,[-74.72]],[39.12,[-74.83]],[39.00,[-74.88]],
      [38.93,[-74.97]],[38.93,[-75.19]],[39.00,[-75.35]],[39.10,[-75.47]],
      [39.22,[-75.55]],[39.38,[-75.59]],[39.50,[-75.56]],[39.62,[-75.52]],
      [39.72,[-75.53]],[39.84,[-75.43]],[39.95,[-75.41]],[40.07,[-75.21]],
      [40.18,[-74.94]],[40.30,[-75.07]],[40.37,[-75.19]],[40.45,[-75.21]],
      [40.56,[-75.20]],[40.65,[-75.10]],[40.75,[-75.10]],[40.85,[-75.14]],
      [40.97,[-75.14]],[41.09,[-74.98]],[41.18,[-74.89]],[41.28,[-74.81]],
      [41.357,[-74.695]]
    ];

    function buildNJPath() {
      return NJ_LATLNG.map((pt, i) => {
        const {x, y} = latLngToXY(pt[0], pt[1][0]);
        return (i === 0 ? 'M' : 'L') + x + ',' + y;
      }).join(' ') + ' Z';
    }

    const SITE_COORDS = {"ilearn charter school- bergen es":{"lat":40.9282,"lng":-74.1312},"ilearn charter school- bergen ms":{"lat":40.9282,"lng":-74.1312},"ilearn charter school- clifton es":{"lat":40.8584,"lng":-74.1638},"ilearn charter school- clifton ms":{"lat":40.8584,"lng":-74.1638},"ilearn charter school- passaic es":{"lat":40.8568,"lng":-74.1285},"ilearn charter school- passaic ms":{"lat":40.8568,"lng":-74.1285},"ilearn charter school- paterson es":{"lat":40.9168,"lng":-74.1719},"ilearn charter school- paterson ms":{"lat":40.9168,"lng":-74.1719},"ilearn charter school- hudson ms":{"lat":40.7282,"lng":-74.0776},"hamilton township school district":{"lat":40.226,"lng":-74.7018},"hamilton township- mercerville":{"lat":40.226,"lng":-74.7018},"hamilton township- kuser":{"lat":40.2107,"lng":-74.7235},"hamilton township- hamilton":{"lat":40.226,"lng":-74.7018},"hoboken dual language charter school":{"lat":40.744,"lng":-74.0324},"hoboken charter school":{"lat":40.744,"lng":-74.0324},"hola":{"lat":40.744,"lng":-74.0324},"haddon township school district":{"lat":39.9001,"lng":-75.0652},"haddon township":{"lat":39.9001,"lng":-75.0652},"van sciver":{"lat":39.9001,"lng":-75.0652},"strawbridge":{"lat":39.9101,"lng":-75.0552},"global leadership academy":{"lat":39.9526,"lng":-75.1652},"gla- west":{"lat":39.949,"lng":-75.218},"gla west":{"lat":39.949,"lng":-75.218},"salem city school district":{"lat":39.5718,"lng":-75.4688},"salem middle school":{"lat":39.5718,"lng":-75.4688},"john fenwick":{"lat":39.5718,"lng":-75.4688},"penns grove":{"lat":39.729,"lng":-75.5135},"carneys point":{"lat":39.6679,"lng":-75.4649},"field street":{"lat":39.729,"lng":-75.5135},"penns grove middle":{"lat":39.7218,"lng":-75.519},"lawrence township":{"lat":40.2815,"lng":-74.7293},"slackwood":{"lat":40.2815,"lng":-74.7293},"gloucester township":{"lat":39.7776,"lng":-75.0316},"erial":{"lat":39.749,"lng":-75.0513},"loring flemming":{"lat":39.7776,"lng":-75.0316},"first philadelphia prep":{"lat":39.9942,"lng":-75.154},"american paradigm":{"lat":39.9942,"lng":-75.154},"central jersey college prep":{"lat":40.5018,"lng":-74.2954},"paterson charter":{"lat":40.9168,"lng":-74.1719},"pcsst":{"lat":40.9168,"lng":-74.1719},"middlesex stem":{"lat":40.5665,"lng":-74.4007},"thurgood marshall":{"lat":40.2260,"lng":-74.7018},"philadelphia charter":{"lat":39.9526,"lng":-75.1652}};

    function lookupCoords(site) {
      const name = (site.school || '').toLowerCase();
      const dist = (site.district || '').toLowerCase();
      for (const [key, coords] of Object.entries(SITE_COORDS)) {
        if (name.includes(key) || dist.includes(key)) return coords;
      }
      const firstWord = name.split(/[\s\-]/)[0];
      if (firstWord.length > 4) {
        for (const [key, coords] of Object.entries(SITE_COORDS)) {
          if (key.includes(firstWord)) return coords;
        }
      }
      return null;
    }

    function assignCoords() {
      _allSites.forEach(s => {
        if (s.lat && s.lng) return;
        const c = lookupCoords(s);
        if (c) { s.lat = c.lat; s.lng = c.lng; }
      });
    }

    function renderSVGMap() {
      const el = document.getElementById('syMap');
      if (!el) return;

      assignCoords();
      const njPath = buildNJPath();

      // Group filtered sites by grid cell (jitter prevention)
      const CELL = 18;
      const coordMap = {};
      _filtered.forEach(s => {
        if (!s.lat || !s.lng) return;
        const { x, y } = latLngToXY(s.lat, s.lng);
        const ck = `${Math.round(x/CELL)},${Math.round(y/CELL)}`;
        if (!coordMap[ck]) coordMap[ck] = { x, y, sites: [] };
        coordMap[ck].sites.push(s);
      });

      const pins = Object.values(coordMap).map(({ x, y, sites }) => {
        const isSelected = sites.some(s => s.key === _selKey);
        const isActive   = sites.some(s => (s.status||'').toLowerCase().includes('active'));
        const count      = sites.length;
        const r          = count > 1 ? 13 : 10;
        const pulse      = isSelected ? `<circle cx="${x}" cy="${y}" r="${r+8}" fill="#f0a500" opacity="0.22"><animate attributeName="r" values="${r+4};${r+14};${r+4}" dur="2s" repeatCount="indefinite"/><animate attributeName="opacity" values="0.22;0.05;0.22" dur="2s" repeatCount="indefinite"/></circle>` : '';
        const col        = isSelected ? '#f0a500' : (isActive ? '#1a56db' : '#94a3b8');
        const stroke     = isSelected ? '#fff' : '#fff';
        const keys       = sites.map(s => s.key.replace(/'/g,"&#39;")).join('|||');
        const tip        = sites.map(s => s.school).join('\n');
        return `<g style="cursor:pointer" onclick="(function(){sya.selectSite('${sites[0].key.replace(/'/g,"\\'")}')})()" >
          ${pulse}
          <circle cx="${x}" cy="${y}" r="${r+3}" fill="${col}" opacity="0.15"/>
          <circle cx="${x}" cy="${y}" r="${r}" fill="${col}" stroke="${stroke}" stroke-width="2" filter="url(#pshadow)"/>
          ${count>1?`<text x="${x}" y="${y+4}" text-anchor="middle" font-size="9.5" font-weight="700" fill="#fff" font-family="system-ui" pointer-events="none">${count}</text>`:''}
          <title>${tip}</title>
        </g>`;
      }).join('');

      // City labels for geographic context
      const cities = [
        {name:'Newark',   lat:40.7357, lng:-74.1724},
        {name:'Trenton',  lat:40.2171, lng:-74.7429},
        {name:'Camden',   lat:39.9259, lng:-75.1196},
        {name:'Atlantic\nCity', lat:39.3643, lng:-74.4229},
        {name:'Hoboken',  lat:40.7440, lng:-74.0324},
      ];
      const cityLabels = cities.map(c => {
        const {x,y} = latLngToXY(c.lat, c.lng);
        const lines = c.name.split('\n');
        return `<g opacity="0.5">
          <circle cx="${x}" cy="${y}" r="2.5" fill="#7d8fa1"/>
          ${lines.map((l,i) => `<text x="${x+6}" y="${y+3+(i*11)}" font-size="9" fill="#4a5568" font-family="system-ui,sans-serif">${l}</text>`).join('')}
        </g>`;
      }).join('');

      const unmapped = _filtered.filter(s => !s.lat || !s.lng);

      el.style.background = 'transparent';
      el.innerHTML = `
        <div style="position:relative;width:100%;height:100%;background:linear-gradient(160deg,#f0f5ff 0%,#e6eeff 100%);border-radius:0 0 var(--radius) var(--radius)">
          <svg viewBox="0 0 ${SVG_W} ${SVG_H}" style="width:100%;height:100%;display:block" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <filter id="pshadow" x="-60%" y="-60%" width="220%" height="220%">
                <feDropShadow dx="0" dy="2" stdDeviation="3" flood-color="rgba(0,0,0,0.25)"/>
              </filter>
              <filter id="state-glow">
                <feGaussianBlur stdDeviation="4" result="blur"/>
                <feComposite in="SourceGraphic" in2="blur" operator="over"/>
              </filter>
              <linearGradient id="stateFill" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stop-color="#dbeafe"/>
                <stop offset="100%" stop-color="#bfdbfe"/>
              </linearGradient>
            </defs>

            <!-- Ocean/background water -->
            <rect width="${SVG_W}" height="${SVG_H}" fill="url(#stateFill)" opacity="0.35"/>

            <!-- State shadow -->
            <path d="${njPath}" fill="rgba(30,58,95,0.08)" transform="translate(3,4)"/>

            <!-- NJ state fill -->
            <path d="${njPath}" fill="#dbeafe" stroke="#93c5fd" stroke-width="1.5" stroke-linejoin="round"/>

            <!-- County grid lines (subtle) -->
            <line x1="0" y1="${SVG_H*0.33}" x2="${SVG_W}" y2="${SVG_H*0.33}" stroke="#93c5fd" stroke-width="0.4" stroke-dasharray="4,6" opacity="0.4"/>
            <line x1="0" y1="${SVG_H*0.66}" x2="${SVG_W}" y2="${SVG_H*0.66}" stroke="#93c5fd" stroke-width="0.4" stroke-dasharray="4,6" opacity="0.4"/>

            <!-- City reference points -->
            ${cityLabels}

            <!-- Site pins -->
            ${pins}

            <!-- Legend -->
            <g transform="translate(12, ${SVG_H-52})">
              <rect width="130" height="46" rx="6" fill="white" opacity="0.88"/>
              <circle cx="16" cy="14" r="6" fill="#1a56db" stroke="#fff" stroke-width="1.5"/>
              <text x="27" y="18" font-size="9.5" fill="#374151" font-family="system-ui,sans-serif">Active site</text>
              <circle cx="16" cy="32" r="6" fill="#f0a500" stroke="#fff" stroke-width="1.5"/>
              <text x="27" y="36" font-size="9.5" fill="#374151" font-family="system-ui,sans-serif">Selected</text>
              <circle cx="80" cy="14" r="6" fill="#94a3b8" stroke="#fff" stroke-width="1.5"/>
              <text x="91" y="18" font-size="9.5" fill="#374151" font-family="system-ui,sans-serif">Inactive</text>
              <circle cx="80" cy="32" r="8" fill="#1a56db" stroke="#fff" stroke-width="1.5"/>
              <text x="80" y="36" text-anchor="middle" font-size="8" font-weight="700" fill="#fff" font-family="system-ui,sans-serif">3</text>
              <text x="91" y="36" font-size="9.5" fill="#374151" font-family="system-ui,sans-serif">Multiple</text>
            </g>
          </svg>
          ${unmapped.length ? `<div style="position:absolute;bottom:0;left:0;right:0;background:rgba(10,22,40,.78);color:#cbd5e1;font-size:.7rem;padding:.35rem 1rem;backdrop-filter:blur(6px);border-radius:0 0 var(--radius) var(--radius)">⚠️ ${unmapped.length} unmapped: ${unmapped.map(s=>s.school).join(', ')}</div>` : ''}
        </div>`;
    }

    function updateMapMarkers() { renderSVGMap(); }
    function updateUnmapped()   { renderSVGMap(); }

    // ── PERIOD SELECTOR ──────────────────────────────────────────────────
    function setPeriod(period) {
      if (_activePeriod === period) return;
      _activePeriod = period;

      // Update eyebrow label
      const eyebrow = document.getElementById('syEyebrow');
      if (eyebrow) {
        if (period === 'sy2526')     eyebrow.textContent = 'SY 2025–2026 · Archived Snapshot';
        else if (period === 'summer2026') eyebrow.textContent = '☀️ Summer 2026 · Live Data';
        else                         eyebrow.textContent = 'SY 2026–2027 · Live Data';
      }

      // Highlight active period button
      ['sy2526','summer2026','sy2627'].forEach(p => {
        const btn = document.getElementById('syPeriodBtn_' + p);
        if (btn) btn.classList.toggle('active', p === period);
      });

      // Update Summer Active badge visibility
      const badge = document.getElementById('sySummerBadge');
      if (badge) badge.style.display = period === 'summer2026' ? '' : 'none';

      // Clear state and re-fetch for the new period
      _allSites = []; _filtered = []; _snapshot = {}; _changes = [];
      _selKey = null;
      const card = document.getElementById('syDetailCard');
      if (card) card.innerHTML = `<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:260px;color:var(--muted);text-align:center"><div style="font-size:2rem;margin-bottom:.75rem">📍</div><div style="font-size:.875rem;font-weight:500">Click a map pin or table row<br>to view site details</div></div>`;
      // Summer 2026 KPI tiles (Total Staff) come from the onsite tracker.
      // Kick a tracker fetch whenever switching to summer if not already loaded —
      // previously this only fired during SY 26-27 data load, so staff was 0
      // if the user opened Summer 2026 before ever loading SY 26-27.
      if ((period === 'summer2026' || period === 'sy2627') && !_trackerReady) {
        fetchOnsiteTracker();
      }
      refresh(true);
    }

    // ── ONSITE TRACKER FETCH ─────────────────────────────────────────────
    // Parses both Summer 2026 and SY 26-27 staff rows from the tracker tab.
    // Active summer employees = cycle contains "summer" + offerAccepted = "yes".
    async function fetchOnsiteTracker(force = false) {
      const cacheKey = 'njtc_tracker_2627_v1';
      if (!force) {
        const cached = NJTC_CACHE.get(cacheKey);
        if (cached && cached.data && cached.data.length) {
          _trackerRows  = cached.data;
          _trackerReady = true;
          window.NJTC_ONSITE_TRACKER = _trackerRows;
          updateStats();
          if (cached.fresh) return;
        }
      }
      try {
        const url = TRACKER_CSV_URL; // gviz direct sheet-ID endpoint (sheet: 1x3dWZQhx9XWqB8YASInOMTr0JDjSRMqv3w7PmcruuMU)
        const res = await fetch(url, { signal: AbortSignal.timeout(20000) });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const text = await res.text();
        const rows = parseOnsiteTracker(text);
        if (rows.length) {
          _trackerRows  = rows;
          _trackerReady = true;
          window.NJTC_ONSITE_TRACKER = rows;
          NJTC_CACHE.set(cacheKey, rows);
          updateStats();
        }
      } catch(e) {
        console.warn('[Onsite Tracker] Fetch failed:', e.message);
      }
    }

    function parseOnsiteTracker(text) {
      const rows = parseCSVFull(text);
      let hIdx = -1;
      for (let i = 0; i < Math.min(5, rows.length); i++) {
        if ((rows[i][0]||'').trim().toLowerCase() === 'cycle') { hIdx = i; break; }
      }
      if (hIdx < 0) { console.warn('[Tracker] Header not found'); return []; }

      const TC = {
        CYCLE: 0, ROLE: 1, COUNTY: 2, DISTRICT: 3, LOCATION: 4, SEC_LOC: 5,
        TC_REVIEWER: 6, SOURCE: 7, FIRST_NAME: 8, LAST_NAME: 9, EMAIL: 10,
        ZELLE: 11, PHONE: 12, ADP_PROFILE: 13, IV_WEBINAR: 14,
        OFFER_SENT: 15, OFFER_ACCEPTED: 16, WELCOME_EMAIL: 17,
        PRE_APP: 18, TAP_REG: 19, RETENTION_ELIG: 20, RETENTION_EMAIL: 21,
        MID_BONUS: 22, REMAIN_BONUS: 23, I9_DOCS: 24,
        FINGERPRINT: 25, FP_REIMB: 26, BC10: 27, FULL_NAME: 28,
        TERMINATED: 29, RESIGN_TYPE: 30, RESIGN_REASON: 31, TERM_DATE: 32,
      };
      const g = (r, i) => i >= 0 && i < r.length ? (r[i]||'').replace(/\n/g,' ').trim() : '';

      return rows.slice(hIdx + 1)
        .filter(r => r.length > 8 && g(r, TC.FIRST_NAME))
        .map(r => {
          const cycle    = g(r, TC.CYCLE);
          const accepted = g(r, TC.OFFER_ACCEPTED).toLowerCase();
          return {
            cycle,
            role:          g(r, TC.ROLE),
            county:        g(r, TC.COUNTY),
            district:      g(r, TC.DISTRICT),
            location:      g(r, TC.LOCATION),
            secLoc:        g(r, TC.SEC_LOC),
            tcReviewer:    g(r, TC.TC_REVIEWER),
            source:        g(r, TC.SOURCE),
            firstName:     g(r, TC.FIRST_NAME),
            lastName:      g(r, TC.LAST_NAME),
            fullName:      g(r, TC.FULL_NAME) || (g(r, TC.FIRST_NAME) + ' ' + g(r, TC.LAST_NAME)).trim(),
            email:         g(r, TC.EMAIL),
            phone:         g(r, TC.PHONE),
            adpProfile:    g(r, TC.ADP_PROFILE),
            ivWebinar:     g(r, TC.IV_WEBINAR),
            offerSent:     g(r, TC.OFFER_SENT),
            offerAccepted: g(r, TC.OFFER_ACCEPTED),
            welcomeEmail:  g(r, TC.WELCOME_EMAIL),
            isPreApp:      g(r, TC.PRE_APP).toLowerCase() === 'yes',
            tapRegistered: g(r, TC.TAP_REG),
            retentionElig: g(r, TC.RETENTION_ELIG),
            i9Docs:        g(r, TC.I9_DOCS),
            fingerprint:   g(r, TC.FINGERPRINT),
            fpReimb:       g(r, TC.FP_REIMB),
            bc10:          g(r, TC.BC10),
            terminated:    g(r, TC.TERMINATED),
            resignType:    g(r, TC.RESIGN_TYPE),
            resignReason:  g(r, TC.RESIGN_REASON),
            termDate:      g(r, TC.TERM_DATE),
            // computed flags
            isSummer:    cycle.toLowerCase().includes('summer'),
            isSY:        cycle.toLowerCase().includes('school year'),
            isActive:    accepted === 'yes',
            isTerminated: g(r, TC.TERMINATED).toLowerCase() === 'yes',
          };
        });
    }

    // ── CHANGES MODAL ─────────────────────────────────────────────────────
    function openChangesModal() {
      let o = document.getElementById('syChangesModal');
      if (!o) { o=document.createElement('div'); o.id='syChangesModal'; o.className='sy-modal-overlay'; o.onclick=e=>{if(e.target===o)o.style.display='none';}; document.body.appendChild(o); }
      const close = `<button class="sy-modal-close" onclick="document.getElementById('syChangesModal').style.display='none'">✕</button>`;
      if (!_changes.length) {
        o.innerHTML=`<div class="sy-modal"><div class="sy-modal-hd"><span class="sy-modal-title">No Changes</span>${close}</div><div class="sy-modal-body" style="text-align:center;padding:2rem;color:var(--muted)">Data matches last refresh.</div></div>`;
      } else {
        const html=[
          ..._changes.filter(c=>c.type==='added').map(c=>`<div class="sy-chg sy-chg-added"><div class="sy-chg-label">✅ Added: ${c.school}</div><div class="sy-chg-detail">${c.district}</div></div>`),
          ..._changes.filter(c=>c.type==='removed').map(c=>`<div class="sy-chg sy-chg-removed"><div class="sy-chg-label">🗑️ Removed: ${c.school}</div><div class="sy-chg-detail">${c.district}</div></div>`),
          ..._changes.filter(c=>c.type==='modified').map(c=>`<div class="sy-chg sy-chg-mod"><div class="sy-chg-label">📝 ${c.school}</div><div class="sy-chg-detail">${c.district}</div>${c.fields.map(f=>`<div class="sy-chg-detail" style="margin-top:.2rem">• ${f.field}: <strong>${f.from}</strong> → <strong>${f.to}</strong></div>`).join('')}</div>`)
        ].join('');
        o.innerHTML=`<div class="sy-modal"><div class="sy-modal-hd"><div><div class="sy-modal-title">What Changed</div><div style="font-size:.8125rem;color:var(--muted);margin-top:.2rem">${_changes.length} change${_changes.length!==1?'s':''} · ${_lastFetch?_lastFetch.toLocaleTimeString():'—'}</div></div>${close}</div><div class="sy-modal-body">${html}</div><div style="padding:1rem 1.5rem;border-top:1px solid var(--border);text-align:right"><button class="btn btn-secondary" onclick="document.getElementById('syChangesModal').style.display='none'">Close</button></div></div>`;
      }
      o.style.display='flex';
    }

    // ── PANEL OPEN HOOK ───────────────────────────────────────────────────
    // Called by patched showPanel when the SY panel becomes visible.
    // Defers map init to ensure the container has non-zero dimensions.
    // Calls invalidateSize() to fix blank/grey tiles after panel reveal.
    function onPanelOpen() {
      if (_allSites.length) updateMapMarkers();
    }

    // ── INIT ──────────────────────────────────────────────────────────────
    function init() {
      if (_inited) return;
      _inited = true;
      refresh(true);
      setInterval(() => {
        const p = document.getElementById('panel-sy-analytics');
        if (p && p.classList.contains('active')) refresh(true);
      }, SY_REFRESH_MS);
    }

    function setText(id, v) { const el = document.getElementById(id); if (el) el.textContent = v; }

    return { init, refresh, applyFilters, clearFilters, filterByDistrict, selectSite,
             openChangesModal, onPanelOpen, setPeriod, fetchOnsiteTracker, updateStats,
             getActivePeriod: () => _activePeriod,
             getTrackerRows:  () => _trackerRows.slice(),
             getSites: () => _allSites.slice() };  // read-only live snapshot for exports
  })();

  // SY Analytics boots via patchShowPanelModules below



  // ══════════════════════════════════════════════════════════════════════════
  //  PEARL OPERATIONS INTELLIGENCE MODULE  —  NJTC Central Team Portal
  //  SY 2025–2026  |  Live from Pearl via published Google Sheet
  //
  //  DATA SOURCES (same 2PACX pub format as all other live sheets):
  //    Attendance Detail  — read cols A–AF (idx 0–31) only, stop at AF
  //    Instructor Surveys — full sheet
  //    Student Surveys    — full sheet
  //    Session Details    — full sheet
  //
  //  TAB ORDER (from screenshot, left→right):
  //    1. Attendance Detail   → gid auto-detected by header "User"
  //    2. Instructor Surveys  → gid auto-detected by header "Filled By" + col C "engaged"
  //    3. Student Surveys     → gid auto-detected by header "Filled By" + col C "confident"
  //    4. Session Details     → gid auto-detected by header "Title"
  //
  //  GID DETECTION: Tried sequentially 0,1,2,3 — identified by first header cell.
  //    Each tab linked by:
  //      • Pearl Session ID  (session ↔ both surveys)
  //      • Pearl User ID     (attendance ↔ session instructor/student IDs, comma-parsed)
  //
  //  ATTENDANCE CLASSIFICATION:
  //    ✅ ATTENDED:              Attendance Status = "Attended" OR "Late"
  //                              Missed Reason = "Tutor Left Early (no sub)" — counts in att
  //                              Missed Reason = "Scholar Left Early" — counts in att
  //                              Missed Reason = "Classroom Teacher Requested..." — counts in att
  //    ❌ ABSENT (student):      Missed Reason starts with "Absent" or = "Tutor Absent"
  //                              "Scholar declined attending tutoring session" — counts as ABSENT (impacts attendance)
  //                              AND triggers a Program Team flag for engagement/re-enrollment review.
  //                              NOT a service interruption — it is a scholar attendance event.
  //    🔴 CRITICAL INTERRUPTION: "NJTC Internal Issue/Error" → always critical severity
  //    🟠 HIGH INTERRUPTION:     "Tutor Vacancy" (HIGH — flagged for HR + Programming + Leadership, excluded from attendance metrics)
  //                              "Unscheduled School Closure/Delay/Dismissal", "Scholar Archived"
  //    NOTE: "Tutor Vacancy" is intentionally NOT in ABSENT_REASONS. It does not count against
  //          attendance rate. It is a staffing gap — surfaced as a high-severity service interruption
  //          visible to HR, Programming, and Leadership for backfill action.
  //    🟡 MEDIUM INTERRUPTION:   School events, testing, drills, holidays
  //    📊 DATA QUALITY:          Attendance Status = "Not recorded"
  //
  //  HIT COMPLIANCE FLAGS:
  //    RATIO:      > 4 students per session → flag (check MOU) — 1:4 max
  //    FREQUENCY:  Scholar attended < 2 sessions in a week → flag
  //    CONTINUITY: Scholar has 2+ different instructors → flag
  //    CONSECUTIVE:Col Y (idx 24) = "Attendance Concern" → flag
  //    VACANCY:    Col AU (idx 46) = "Current Vacancy..." → flag
  //
  //  ROLE VISIBILITY:
  //    leadership / data: everything, all analytics
  //    hr:    attendance compliance, vacancy flags, ADP flag on low attendance, individual names
  //    finance: low attendance flag (check ADP records)
  //    programming: district/school filter, drill to user, service interruptions, HIT flags
  //    training_development: survey details, comments, comment buckets, flags
  //    Others: aggregate stats only, no individual names
  // ══════════════════════════════════════════════════════════════════════════


  const po = (() => {

    // ── PUBLISHED SHEET CONFIG ────────────────────────────────────────────
    const BASE_ID = '2PACX-1vQ1iC8NZFJt3iinGUEqftKtP32N43axi_JN_RQI36EBUdhZS0PaZRwd-1AJT3bEVe6cqHA0tCA3vb5K';
    // Scholar survey is a tab on the same published workbook (same BASE_ID).
    // Edit URL gid: 1245403832 — pubhtml discovery may resolve to same or different value.
    // KNOWN_GIDS.stu holds the authoritative fallback; pubhtml probe takes priority.
    const STU_GID_FALLBACK = 1245403832;  // from edit URL — used if pubhtml probe fails
    const STU_AGG_KEY = 'njtc_pearl_stu_agg_v2';  // dedicated agg cache key — 4hr TTL
    const STU_AGG_TTL = 4 * 60 * 60 * 1000;       // 4 hours (surveys update ~daily)
    const csvUrl = gid => `https://docs.google.com/spreadsheets/d/e/${BASE_ID}/pub?output=csv&gid=${gid}`;
    // stuCsvUrl — same BASE_ID as all other tabs (one published workbook).
    // Uses the GID resolved by pubhtml discovery (GIDS.stu), falling back to edit-URL gid.
    const stuCsvUrl = () => {
      const gid = GIDS.stu || STU_GID_FALLBACK;
      return 'https://docs.google.com/spreadsheets/d/e/' + BASE_ID + '/pub?output=csv&gid=' + gid;
    };
    // GIDs for tab order: Attendance Detail(0), Instructor Surveys(1), Student Surveys(2), Session Details(3)
    // Auto-detected at load time — stored once resolved
    const GIDS = { att: null, inst: null, stu: null, sess: null };

    // ── SUMMER 2026 PUBLISHED SHEET CONFIG ──────────────────────────────────
    // Same workbook structure/gid layout as SY, different published base id.
    // "Missed Reasons" (gid 702726038) is the real per-attendee Attendance
    // Detail tab (User/Role/Session/Attendance Status/Missed Reason — same 14
    // columns as SY's ATT map, cols A-N) — parsed directly with the ATT map,
    // same as SY. "Session Details" (gid 625567780) is the separate session-
    // level tab used only for session/delivery stats (_sessRows).
    const SUMMER_BASE_ID = '2PACX-1vQ6lavExR5j-WAPd9ROXLykTQvA2j1rJjMoSWpTGOYj-ni0OJrfwMo-aQWq8zNVwbVon6pioe-8BHuA';
    const SUMMER_GIDS = { att: 702726038, sess: 625567780, inst: 1955492004, stu: 1245403832 };
    const summerCsvUrl = gid => `https://docs.google.com/spreadsheets/d/e/${SUMMER_BASE_ID}/pub?output=csv&gid=${gid}`;

    const REFRESH_MS = 5 * 60 * 1000;

    // ── COLUMN INDEXES — ATTENDANCE DETAIL (read ONLY cols 0–31 / A–AF) ──
    const ATT = {
      USER: 0,           // A  User name
      ROLE: 1,           // B  Student | Instructor
      SESSION: 2,        // C  Session title
      SESS_STATUS: 3,    // D  Session Status
      PLAN_START: 4,     // E  Planned Session Start
      SESS_DATE: 5,      // F  Session Date  (MM/DD/YYYY)
      ATT_STATUS: 6,     // G  Attendance Status
      MISS_REASON: 7,    // H  Attendance Missed Reason
      GRADE: 8,          // I  Grade
      SEX: 9,            // J  Sex
      RACE: 10,          // K  Race
      SCHOOL: 11,        // L  School
      DISTRICT: 12,      // M  District
      USER_ID: 13,       // N  Pearl User ID
      IND_ATT_RATE: 14,  // O  Individual Attendance Rate %
      SCHOLAR_ATT_PCT: 15, // P Scholar Attendance %
      AVG_ATT: 16,       // Q  Tutors+Scholars avg attendance %
      STU_AVG_ATT: 17,   // R  Student Average Attendance %
      INST_AVG: 18,      // S  Instructor Average Attendance %
      STU_ATT_CNT: 19,   // T  Student Attended Session Count
      STU_MISS_CNT: 20,  // U  Student Missed Session Count
      INST_ATT_CNT: 21,  // V  Instructor Attended Session Count
      INST_MISS_CNT: 22, // W  Instructor Missed Session Count
      MISS_TAG: 23,      // X  Missed Session Tag
      CONSEC_STATUS: 24, // Y  10 consecutive sessions missed status
      ATT_PER_SCHOLAR: 25, // Z  Attended Sessions per Scholar
      WEEK: 26,          // AA Weekly Grouping  (e.g. "Week 23")
      // AB (27) = blank
      VACANT_ID: 28,     // AC Pearl Vacant User ID
      SCHOLAR_NAME: 29,  // AD Scholar (vacancy pairing)
      VAC_START: 30,     // AE Tutor Vacancy Start Date
      // AF (31) = blank — HARD STOP
      // cols 32-39 = blank
      // col 40 = Scholar - Pearl User ID
      // col 41 = Scholar Name
      // col 42 = School
      // col 43 = Tutor Vacancy Start Date
      // col 44 = First Attended Date
      // col 45 = Last Attended Date
      VACANCY_FLAG: 46,  // AG Vacancy Flag  ("Current Vacancy...")
      // col 47 = Active Flag
    };
    const ATT_MAX_COL  = 31; // read through col AF (idx 31), ignore rest
    const STU_MAX_COL  = 22; // Scholar survey: cols 0-22 (WEEK is last needed)
    const INST_MAX_COL = 22; // Instructor survey: cols 0-22
    const SESS_MAX_COL = 35; // Session details: enough cols for all session fields

    // ── COLUMN INDEXES — SESSION DETAILS ─────────────────────────────────
    const SESS = {
      TITLE: 0,       // A  Title
      INSTRUCTOR: 1,  // B  Instructor name
      STUDENTS: 2,    // C  Student names (comma-separated)
      LOCATION: 3,    // D  Location
      STATUS: 4,      // E  Status
      ATTENDANCE: 5,  // F  Attendance summary
      START: 6,       // G  Scheduled Start (datetime)
      SCHED_DUR: 7,   // H  Scheduled Duration
      ACTUAL_DUR: 8,  // I  Actual Duration
      SUBJECT: 9,     // J  Subject
      GRADE: 10,      // K  Grade
      SCHOOL: 11,     // L  School
      DISTRICT: 12,   // M  District
      REGION: 13,     // N  Region
      SESS_ID: 14,    // O  Pearl Session ID
      INST_ID: 15,    // P  Pearl Instructor ID
      STU_IDS: 16,    // Q  Pearl Student IDs (comma-separated)
      SESS_PER_SCHOOL: 17, // R  Sessions Delivered Per School
      TOTAL_SESS: 19, // T  Total Sessions Delivered
      TOTAL_SUCCESS: 20, // U  Total Successful Sessions
      TOTAL_MISS_STU: 21, // V  Total Missed Sessions by Scholar
      TOTAL_MISS_INST: 22,// W  Total Missed Sessions by Instructor
    };

    // ── COLUMN INDEXES — STUDENT SURVEYS ─────────────────────────────────
    const STU_S = {
      FILLED_BY: 0, FILLED_FOR: 1,
      CONFIDENCE: 2, ENJOYMENT: 3, LEARNING: 4, OVERALL: 5,
      COMMENT: 6, DATE: 7, SCHOOL: 8, DISTRICT: 9, REGION: 10,
      SESS_ID: 11, FILLED_BY_ID: 12, FILLED_FOR_ID: 13,
      AVG_CONF: 14, AVG_ENJOY: 15, AVG_LEARN: 16, AVG_OVERALL: 17,
      CLUMP_CONF: 18, CLUMP_ENJOY: 19, CLUMP_LEARN: 20, CLUMP_OVERALL: 21,
      WEEK: 22,
    };

    // ── COLUMN INDEXES — INSTRUCTOR SURVEYS ──────────────────────────────
    const INST_S = {
      FILLED_BY: 0, FILLED_FOR: 1,
      ENGAGEMENT: 2, ENJOYMENT: 3, LEARNING: 4, OVERALL: 5,
      COMMENT_ADMIN: 6, COMMENT_SELF: 7,
      DATE: 8, SCHOOL: 9, DISTRICT: 10,
      SESS_ID: 11, FILLED_BY_ID: 12, FILLED_FOR_ID: 13,
      COMMENT_BANK: 14,
      AVG_ENGAGE: 15, AVG_ENJOY: 16, AVG_LEARN: 17, AVG_OVERALL: 18,
      CLUMP_ENGAGE: 19, CLUMP_ENJOY: 20, CLUMP_LEARN: 21, CLUMP_OVERALL: 22,
      WEEK: 23,
    };

    // ── SUMMER 2026 — RAW SHEET COLUMN INDEXES ───────────────────────────
    // These map the raw Pearl export columns for Summer's Session Details tab
    // (session-level: one row per session) and the two survey tabs. The
    // Missed Reasons/Attendance Detail tab is NOT mapped here — it's parsed
    // directly with SY's own ATT map (see refreshSummer()) since it's the
    // same 14-column per-attendee layout as SY. Positions verified directly
    // against "Summer 26: Pearl Attendance and Surveys" (July 2026).
    const SUM_SESS = {
      TITLE:0, INSTRUCTOR:1, STUDENTS:2, LOCATION:3, PROGRAM:4, STATUS:5,
      ATTENDANCE:6, SCHED_START:7, SCHED_DUR:8, ACTUAL_DUR:9, SUBJECT:10,
      GRADE:11, SCHOOL:12, DISTRICT:13, REGION:14, SESS_ID:15, INST_ID:16,
      STU_IDS:17,
    };
    // Student Surveys — cols 0-13 already match STU_S positions 1:1.
    const SUM_STU_SURV = {
      FILLED_BY:0, FILLED_FOR:1, CONFIDENCE:2, ENJOYMENT:3, LEARNING:4,
      OVERALL:5, COMMENT:6, DATE:7, SCHOOL:8, DISTRICT:9, REGION:10,
      SESS_ID:11, FILLED_BY_ID:12, FILLED_FOR_ID:13,
    };
    // Instructor Surveys — cols 0-13 already match INST_S positions 1:1.
    const SUM_INST_SURV = {
      FILLED_BY:0, FILLED_FOR:1, ENGAGEMENT:2, ENJOYMENT:3, LEARNING:4,
      OVERALL:5, COMMENT_ADMIN:6, COMMENT_SELF:7, DATE:8, SCHOOL:9,
      DISTRICT:10, SESS_ID:11, FILLED_BY_ID:12, FILLED_FOR_ID:13,
    };

    // ── WEEK DERIVATION ───────────────────────────────────────────────────
    // Pearl column AA (ATT.WEEK) contains "Week N" labels (e.g. "Week 23").
    // This is the SINGLE source of truth for week grouping across all data.
    //
    // For session rows (which have no week column), we derive the week label
    // from the session date using the SAME school-year week numbering that
    // Pearl uses: count from the first Monday of the school year (Aug 2025).
    // This ensures 100% alignment between attendance detail and session data.
    //
    // School year start: Monday 2025-08-25 (first Monday of SY25-26).
    // Pearl's "Week 1" = week of 2025-08-25.
    const SY_START = new Date(2025, 7, 25); // Aug 25 2025 = Week 1 Monday

    function parseDateStr(dateStr) {
      if (!dateStr) return null;
      let d = new Date(dateStr);
      if (!isNaN(d.getTime())) return d;
      // MM/DD/YYYY fallback
      const m = dateStr.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
      if (m) return new Date(+m[3], +m[1]-1, +m[2]);
      // YYYY-MM-DD fallback
      const m2 = dateStr.match(/(\d{4})-(\d{2})-(\d{2})/);
      if (m2) return new Date(+m2[1], +m2[2]-1, +m2[3]);
      return null;
    }

    function weekKeyFromDateStr(dateStr) {
      // Returns "Week N" label matching Pearl's ATT.WEEK column AA.
      const d = parseDateStr(dateStr);
      if (!d) return '';
      // Snap to Monday of this date's week
      const day = d.getDay(); // 0=Sun
      const diff = day === 0 ? -6 : 1 - day;
      const mon = new Date(d);
      mon.setDate(d.getDate() + diff);
      // Weeks since SY start Monday (SY_START is always a Monday)
      const msSince = mon.getTime() - SY_START.getTime();
      const weekNum = Math.floor(msSince / (7 * 24 * 60 * 60 * 1000)) + 1;
      if (weekNum < 1) return ''; // before school year
      return `Week ${weekNum}`;
    }

    function weekNumericSort(a, b) {
      // Sort "Week N" labels numerically
      return parseInt(a.replace('Week ','')) - parseInt(b.replace('Week ',''));
    }

    function weekDisplayFromKey(key) {
      // "Week N" is already human-readable — return as-is
      return key || '';
    }

    // Derive week for a session using its start date (aligns with Pearl col AA)
    function sessWeek(sess) {
      return weekKeyFromDateStr(sess.start) || '';
    }

    // Build a week→Monday-date map for display tooltips
    function weekMondayDate(weekLabel) {
      const n = parseInt((weekLabel||'').replace('Week ',''));
      if (!n || isNaN(n)) return null;
      const d = new Date(SY_START);
      d.setDate(SY_START.getDate() + (n - 1) * 7);
      return d;
    }

    // ── SUMMER 2026 — WEEK DERIVATION ─────────────────────────────────────
    // Summer has no fixed "school year start" to hardcode the way SY_START is
    // (Aug 25 2025). Instead, SUMMER_START is derived the first time Summer
    // session data loads: the Monday of the earliest real session date seen.
    // This mirrors SY's "Week 1 = week of school year start" convention.
    let _summerStart = null; // Date | null — resolved on first Summer refresh
    // rows: array of raw row arrays; dateIdx: column index holding the session date/start
    function _resolveSummerStart(rows, dateIdx) {
      let earliest = null;
      for (const r of rows) {
        const d = parseDateStr(r[dateIdx]);
        if (d && (!earliest || d < earliest)) earliest = d;
      }
      if (!earliest) return; // keep previous value (or null) if nothing parseable
      const day = earliest.getDay();
      const diff = day === 0 ? -6 : 1 - day;
      const mon = new Date(earliest);
      mon.setDate(earliest.getDate() + diff);
      mon.setHours(0,0,0,0);
      // Only update if this is earlier than what we already have (data can
      // arrive in any order across refreshes) so week numbers stay stable.
      if (!_summerStart || mon < _summerStart) _summerStart = mon;
    }
    function summerWeekKeyFromDateStr(dateStr) {
      if (!_summerStart) return '';
      const d = parseDateStr(dateStr);
      if (!d) return '';
      const day = d.getDay();
      const diff = day === 0 ? -6 : 1 - day;
      const mon = new Date(d);
      mon.setDate(d.getDate() + diff);
      const msSince = mon.getTime() - _summerStart.getTime();
      const weekNum = Math.floor(msSince / (7 * 24 * 60 * 60 * 1000)) + 1;
      if (weekNum < 1) return '';
      return `Week ${weekNum}`;
    }
    // Attended counts: actual Attended/Late status AND these miss reasons
    // ── ATTENDANCE CLASSIFICATION ────────────────────────────────────────
    // Scholar attendance rate = attended / (attended + SCHOLAR_MISS)
    // Only count against a scholar when it is the SCHOLAR'S fault.
    // Service interruptions (tutor absent, holidays, testing, etc.) are
    // excluded from the denominator — they don't penalise the scholar.
    //
    // Tutor attendance rate = attended / (attended + TUTOR_MISS)
    // Only count against a tutor when IT IS THE TUTOR'S fault.

    // Counts as attended (scholar showed up, even if partially)
    // NOTE: 'Scholar Left Early' removed — Pearl always marks these as Missed status,
    // they are scholar-caused absences and counted in SCHOLAR_MISS_REASONS
    const COUNTS_AS_ATTENDED = new Set([]);

    // Scholar-caused misses — counted in scholar denominator
    // Blank reason → counts as absent for attendance rate; excluded from CT% calculation only
    //
    // 'Classroom Teacher Requested to Keep Scholar in Class' and the Haddon
    // whole-group variant were briefly reclassified as Service Interruptions
    // in July 2026 (moved to SI_SEVERITY) on the reasoning that it's a staff
    // decision, not the scholar's. Reverted org-wide (Aug 2026): this was the
    // one file out of six independent classifiers that disagreed, which meant
    // Leadership/Executive/Finance/Program Data Summary/PDF exports showed a
    // different scholar attendance rate than onsite, internal chat, Data
    // Department, and the partner portal for the same underlying rows. A
    // teacher-driven pull-out is exactly the kind of thing a school can act
    // on, so it counts as an absence here like everywhere else.
    const SCHOLAR_MISS_REASONS = new Set([
      'Absent',                                     // scholar absent from school
      'Scholar declined attending tutoring session', // scholar's own choice
      'Scholar Left Early',                         // scholar left session early — counts as scholar-caused
      'Classroom Teacher Requested to Keep Scholar in Class',
      'HADDON TWP ONLY -- Teacher requested whole group support',
    ]);

    // Tutor-caused misses — counted in tutor denominator (instructor rows only)
    const TUTOR_MISS_REASONS = new Set([
      'Absent; Not Covered (Tutor not available)',  // tutor absent, no coverage
      'Absent; Covered by Sub Tutor',               // tutor absent (covered, but still absent)
      'Absent; Covered by Dual Role',
      'Absent; Covered by the Site Leader',
      'Absent; Covered by the Instructional Coach',
      'Tutor Left Early (no sub)',                  // tutor left early
    ]);

    // Legacy alias — kept for any remaining references in flag/SI logic
    const ABSENT_REASONS = new Set([
      'Absent','Scholar declined attending tutoring session','',
      // Legacy set used by flag logic. Attendance rates now use
      // SCHOLAR_MISS_REASONS / TUTOR_MISS_REASONS for precision.
    ]);
    // Declined sessions: tracked separately so we can flag patterns for Programming
    const DECLINED_REASON = 'Scholar declined attending tutoring session';
    // Everything else that's a missed session = service interruption
    const SI_SEVERITY = {
      'NJTC Internal Issue/Error':                  'critical',
      'Tutor Vacancy':                              'high',    // staffing gap — excluded from attendance; flag HR + Programming + Leadership
      'Scholar Archived - Removed from Sessions':   'high',
      'Unscheduled School Closure/Delay/Dismissal': 'high',
      'NJTC Diagnostic Testing':                    'medium',
      'School-administered Testing':                'medium',
      'School Event':                               'medium',
      'Scheduled/Unscheduled School Drill':         'medium',
      'HADDON TWP ONLY -- Program Redevelopment':   'medium',
      'Half Day':                                   'low',
      'Holiday - scheduled':                        'low',
      // 'Scholar declined attending tutoring session' intentionally removed —
      // counts as an absence (impacts attendance) and flags Program Team instead.
    };

    function classifyRecord(r) {
      const role       = r[ATT.ROLE]       || '';
      const attStat    = r[ATT.ATT_STATUS] || '';
      const missReason = r[ATT.MISS_REASON]|| '';

      // ── Attended ────────────────────────────────────────────────────────
      if (attStat === 'Attended' || attStat === 'Late') return 'attended';
      if (COUNTS_AS_ATTENDED.has(missReason))           return 'attended';
      if (attStat === 'Not recorded')                   return 'not_recorded';

      // ── Missed: classify by role ────────────────────────────────────────
      if (attStat === 'Missed') {
        if (role === 'Student') {
          // Scholar-caused miss → counted in scholar denominator
          // Blank reason → counts as absent for attendance rate (unknown = missed)
          // Blank is excluded from CT% calculation only (see ctDenominator / scholarMissed filters)
          if (SCHOLAR_MISS_REASONS.has(missReason))    return 'absent';
          if (missReason === '')                        return 'absent';
          // Everything else is a service interruption — NOT the scholar's fault
          return 'service_interruption';
        } else {
          // Instructor row: tutor-caused miss → counted in tutor denominator
          if (TUTOR_MISS_REASONS.has(missReason))      return 'absent';
          return 'service_interruption';
        }
      }

      return 'other';
    }

    function getSISeverity(reason) {
      return SI_SEVERITY[reason] || 'medium';
    }

    // ══════════════════════════════════════════════════════════════════════
    // SUMMER 2026 — session-level helpers
    // ══════════════════════════════════════════════════════════════════════
    // Attendance/service-interruption classification needs NO Summer-specific
    // logic: Summer's "Missed Reasons" tab is the real per-attendee Attendance
    // Detail export (same 14-column layout as SY — User/Role/Session/.../
    // Attendance Status/Missed Reason/.../Pearl User ID), parsed directly with
    // SY's own ATT map in refreshSummer(). classifyRecord() runs unmodified
    // against it, exactly as it does for SY.
    //
    // (An earlier version of this file inferred per-attendee outcomes from
    // session-level rollups because the Missed Reasons tab was originally
    // mis-published as a duplicate of Session Details — since corrected.)

    // Session-level rows for _sessRows (session/delivery stats) — direct field
    // mapping from the raw Summer columns into the shared SESS index positions.
    function buildSummerSessRows(sessRaw) {
      const out = [];
      for (const r of sessRaw) {
        const sessId = r[SUM_SESS.SESS_ID];
        if (!sessId) continue;
        const row = [];
        row[SESS.TITLE]      = r[SUM_SESS.TITLE];
        row[SESS.INSTRUCTOR] = r[SUM_SESS.INSTRUCTOR];
        row[SESS.STUDENTS]   = r[SUM_SESS.STUDENTS];
        row[SESS.LOCATION]   = r[SUM_SESS.LOCATION];
        row[SESS.STATUS]     = r[SUM_SESS.STATUS];
        row[SESS.ATTENDANCE] = r[SUM_SESS.ATTENDANCE];
        row[SESS.START]      = r[SUM_SESS.SCHED_START];
        row[SESS.SCHED_DUR]  = r[SUM_SESS.SCHED_DUR];
        row[SESS.ACTUAL_DUR] = r[SUM_SESS.ACTUAL_DUR];
        row[SESS.SUBJECT]    = r[SUM_SESS.SUBJECT];
        row[SESS.GRADE]      = r[SUM_SESS.GRADE];
        row[SESS.SCHOOL]     = r[SUM_SESS.SCHOOL];
        row[SESS.DISTRICT]   = r[SUM_SESS.DISTRICT];
        row[SESS.REGION]     = r[SUM_SESS.REGION];
        row[SESS.SESS_ID]    = sessId;
        row[SESS.INST_ID]    = r[SUM_SESS.INST_ID];
        row[SESS.STU_IDS]    = r[SUM_SESS.STU_IDS];
        out.push(row);
      }
      return out;
    }

    // Survey rows — Summer's raw columns already match STU_S / INST_S 0-13
    // 1:1, so this just filters blank rows and fills the derived WEEK column
    // (Summer's raw export has no week column, same as SY's session rows).
    function buildSummerStuRows(stuRaw) {
      const out = [];
      for (const r of stuRaw) {
        if (!r[SUM_STU_SURV.SESS_ID]) continue;
        const row = r.slice(0, 14);
        row[STU_S.WEEK] = summerWeekKeyFromDateStr(row[STU_S.DATE]);
        out.push(row);
      }
      return out;
    }
    function buildSummerInstRows(instRaw) {
      const out = [];
      for (const r of instRaw) {
        if (!r[SUM_INST_SURV.SESS_ID]) continue;
        const row = r.slice(0, 14);
        row[INST_S.WEEK] = summerWeekKeyFromDateStr(row[INST_S.DATE]);
        out.push(row);
      }
      return out;
    }

    // ── COMMENT CATEGORIZATION ────────────────────────────────────────────
    // STRONG concern keywords — a single match triggers follow-up immediately.
    // These represent safety, conduct, or distress that always needs action.
    const STRONG_CONCERN_KW = [
      'target','harass','assault','unsafe','bully','threaten','scared','afraid',
      'inappropriate','disrespect','not safe','hurt','crying','violence','physical',
      'not happy','not fair','feel bad','feel sad','feel uncomfortable',
      'yell','curse','hit me','push me','kick me',
      'unhappy','disgruntled','unwilling to participate','refused to participate',
    ];
    // Regular concern keywords — need 2+ (or 1 strong above) to classify as concern.
    // Deliberately excludes "problem", "hard", "issue" which are frequent false positives
    // in educational contexts ("math problems", "try harder", "Wi-Fi issue").
    const CONCERN_KW = [
      'concern','struggle','difficult','poor','confused','distract','behavior',
      'not understand','behind','worry','fail','uncomfortable','fell behind',
      'too fast','too slow','cant focus','can\'t focus','left me out',
      'ignored','mean to me','made me feel','refused to','won\'t participate',
      'didn\'t participate','acting out','off task','disruptive',
    ];
    const COMMENT_BUCKETS = {
      concern:    { label: 'Concern', css: 'concern',
                    keywords: [...STRONG_CONCERN_KW, ...CONCERN_KW] },
      positive:   { label: 'Positive Feedback', css: 'positive',
                    keywords: ['great','excellent','amazing','wonderful','good','enjoyed',
                               'love','fantastic','perfect','best','happy','engaged',
                               'excited','helpful','fun','thank','awesome','brilliant',
                               'boost','better','learned','learn a lot','understood',
                               'my favorite','the best','really good','so good'] },
      engagement: { label: 'Engagement', css: 'engagement',
                    keywords: ['engage','participat','attention','focus','interest',
                               'active','involv','motivat','enthusias','energy'] },
      logistics:  { label: 'Logistics', css: 'logistics',
                    keywords: ['late','reschedul','cancel','interrup','delay','technolog',
                               'zoom','link','access','material','room','space','tool',
                               'wi-fi','wifi','internet','computer','device','connection',
                               'lunchroom','cafeteria','library','hallway','location'] },
      curriculum: { label: 'Curriculum', css: 'curriculum',
                    keywords: ['lesson','curriculum','material','content','topic','math',
                               'reading','ela','english','skill','standard','objective',
                               'worksheet','practice','multiplication','division','fraction',
                               'algebra','vocabulary','grammar','spelling'] },
      relationship: { label: 'Relationship', css: 'relationship',
                      keywords: ['rapport','relationship','bond','trust','comfort',
                                 'familiar','personali','know','connect','feel safe',
                                 'individual'] },
    };

    // Returns true if kw appears negated in context (no X, not X, nothing X, etc.)
    function _negated(lower, kw) {
      const idx = lower.indexOf(kw);
      if (idx < 0) return false;
      const before = lower.substring(Math.max(0, idx - 25), idx);
      return /\b(no|not|nothing|never|don.?t|doesn.?t|isn.?t|wasn.?t|none|without)\s+(?:\w+\s+){0,3}$/.test(before);
    }

    // Word-boundary match for single-word keywords; phrase match for multi-word.
    // Prevents "happy" from hitting "unhappy", "fun" from hitting "function", etc.
    function _kwMatch(lower, kw) {
      if (kw.includes(' ')) return lower.includes(kw);
      return new RegExp('\\b' + kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b').test(lower);
    }

    function categorizeComment(text) {
      if (!text || !text.trim()) return null;
      const lower = text.toLowerCase();
      // STRONG concern: single match is sufficient — safety/conduct issues
      if (STRONG_CONCERN_KW.some(kw => lower.includes(kw) && !_negated(lower, kw))) return 'concern';
      // Score all buckets with word-boundary matching + negation detection
      let best = null, bestScore = 0;
      for (const [key, {keywords}] of Object.entries(COMMENT_BUCKETS)) {
        const score = keywords.filter(kw => _kwMatch(lower, kw) && !_negated(lower, kw)).length;
        if (score > bestScore) { bestScore = score; best = key; }
      }
      // Concern requires 2+ keyword hits — prevents single ambiguous words from triggering
      if (best === 'concern' && bestScore < 2) return 'other';
      return best || 'other';
    }

    // ── ROLE HELPERS ──────────────────────────────────────────────────────
    function role() {
      const d = typeof _currentDept !== 'undefined' ? _currentDept
              : (window.NJTC_SESSION ? window.NJTC_SESSION.dept : '');
      return (d || 'leadership').toLowerCase();
    }
    const isData       = () => ['data','leadership','kb'].includes(role());
    const isHR         = () => ['hr','leadership','data','kb'].includes(role());
    const isFinance    = () => ['finance','leadership','data','kb'].includes(role());
    const isProg       = () => ['programming','leadership','data','kb'].includes(role());
    const isTD         = () => ['training_development','leadership','data','kb'].includes(role());
    const canSeeNames  = () => ['leadership','data','hr','programming','training_development','kb'].includes(role());
    const canSeeIndiv  = () => ['leadership','data','hr','programming','kb'].includes(role());

    // ── Module-level region detector (used by ticket system and school cards) ─
    const _NE_KW = ['ilearn','i-learn','paterson','pcsst','paterson charter','hoboken','middlesex','central jersey'];
    const _SW_KW = ['american paradigm','first philadelphia','first philly','philadelphia charter',
                    'string theory','global leadership academy','global leadership',
                    'penns grove','carneys point','haddon township','haddon',
                    'hamilton township','gloucester township'];
    const _SW_SC = ['erial','loring flemming','field street','penns grove middle','van sciver',
                    'strawbridge','first philadelphia prep','first philly prep',
                    'the philadelphia charter','philadelphia charter school','global leadership academy'];
    function _poRegion(school, district) {
      const s = (school||'').toLowerCase(), d = (district||'').toLowerCase();
      if (_NE_KW.some(k=>d.includes(k)||s.includes(k))) return 'NE';
      if (_SW_KW.some(k=>d.includes(k))) return 'SW';
      if (_SW_SC.some(k=>s.includes(k))) return 'SW';
      return 'NE';
    }

    // ── Pearl Operations Ticket System ────────────────────────────────────────
    const TICKET_FORM_URL  = 'https://docs.google.com/forms/d/e/1FAIpQLSfBqfEOWMgR4ynfbQi5t0vGMMtZjUZ6IMqRabPF9BZqTMlgqQ/formResponse';
    const TICKET_2PACX     = '2PACX-1vQflQdmRksRjySJgjGFsueUku9ReSAqKCKHeR0w_smPb3lnxZFeFoNBtINGrFgk2HrftP2dYgcj3YrI';
    const TICKET_GID       = '1157594489';
    const TICKET_CACHE_KEY = 'njtc_pearl_tickets_v1';
    const TICKET_TTL_MS    = 5 * 60 * 1000;
    let   _ticketRows      = null;

    // ── RFC-4180 CSV PARSER ───────────────────────────────────────────────
    function parseCSV(text) {
      const rows = []; let row = [], f = '', inQ = false;
      const src = text.replace(/\r\n/g,'\n').replace(/\r/g,'\n');
      for (let i=0; i<src.length; i++) {
        const ch = src[i];
        if (inQ) {
          if (ch==='"') { if (src[i+1]==='"') {f+='"'; i++;} else inQ=false; }
          else f+=ch;
        } else {
          if (ch==='"') inQ=true;
          else if (ch===',') { row.push(f.trim()); f=''; }
          else if (ch==='\n') { row.push(f.trim()); f=''; rows.push(row); row=[]; }
          else f+=ch;
        }
      }
      if (f.trim()||row.length) { row.push(f.trim()); rows.push(row); }
      return rows;
    }

    function parseCSVLimit(text, maxCol) {
      // Same parser but trims each row to maxCol+1 columns
      const full = parseCSV(text);
      return full.map(row => row.slice(0, maxCol+1));
    }

    // ── STATE ─────────────────────────────────────────────────────────────
    let _attRows  = [];   // parsed attendance (cols A–AF only)
    let _sessRows = [];   // parsed session details
    let _stuRows  = [];   // parsed student surveys (grows during stream)
    let _instRows = [];   // parsed instructor surveys

    // Period toggle — 'sy2526' (default, existing live data) | 'summer2026'
    let _activePeriod = 'sy2526';

    // Scholar survey stream state
    // _stuAggScores: final scores from a COMPLETE stream run (or restored from cache)
    // Only updated when stream finishes — never mid-stream. This ensures all depts
    // see the same score regardless of when they open the panel.
    let _stuStreamComplete = false;  // true only after stream runs to 100% completion
    let _stuAggScores = null;        // { globalAvg, bySchool: {school:{avg,cnt}} } — final only

    // Derived indexes (built once after all tabs load)
    let _schoolMap   = {};  // school → {att, sess, stu, inst, ...}
    let _personMap   = {};  // userId → person object
    let _sessMap     = {};  // sessionId → session object
    let _gidsResolved = false;

    let _lastFetch = null;
    let _loading   = false;
    let _inited    = false;

    // View state
    let _view       = 'schools'; // 'schools' | 'school' | 'person'
    let _selSchool  = null;
    let _selPerson  = null;
    let _activeTab  = 'attendance';
    // Multi-select filter state (arrays of selected values, empty = all)
    let _filtDistrict = [];
    let _filtSchool   = [];
    let _filtWeek     = [];
    let _filtRole     = [];
    let _filtFlag     = [];
    let _poGlobalQ    = '';  // global text search (tutor / school / district)

    // ── Multi-Select Widget Builder ────────────────────────────────────────
    const _msState = {};

    function buildMultiSelect({ wrapperId, label, options, stateKey, staticOptions }) {
      const wrap = document.getElementById(wrapperId);
      if (!wrap) return;

      if (!_msState[stateKey]) _msState[stateKey] = { selected: [], search: '' };

      function render() {
        const state = _msState[stateKey];
        const sel = state.selected;
        const allOpts = staticOptions || options;
        const filtered = allOpts.filter(o =>
          !state.search || o.label.toLowerCase().includes(state.search.toLowerCase())
        );

        wrap.innerHTML = '';

        const btn = document.createElement('button');
        btn.className = 'ms-btn' + (sel.length ? ' ms-active' : '');
        btn.innerHTML = label + (sel.length ? ` <span class="ms-badge">${sel.length}</span>` : '') + ' <span class="ms-caret">▼</span>';
        btn.onclick = (e) => { e.stopPropagation(); toggleDropdown(); };
        wrap.appendChild(btn);

        function toggleDropdown() {
          const existing = document.getElementById('ms-dd-' + stateKey);
          if (existing) { existing.remove(); btn.classList.remove('ms-open'); return; }

          // Close all other dropdowns
          document.querySelectorAll('[id^="ms-dd-"]').forEach(d => d.remove());
          document.querySelectorAll('.ms-btn.ms-open').forEach(b => b.classList.remove('ms-open'));

          btn.classList.add('ms-open');
          const dd = document.createElement('div');
          dd.className = 'ms-dropdown';
          dd.id = 'ms-dd-' + stateKey;

          // Search box
          const searchWrap = document.createElement('div');
          searchWrap.className = 'ms-search';
          const searchInput = document.createElement('input');
          searchInput.placeholder = 'Search…';
          searchInput.value = state.search;
          searchInput.onclick = e => e.stopPropagation();
          searchInput.oninput = () => { state.search = searchInput.value; renderList(); };
          searchWrap.appendChild(searchInput);
          dd.appendChild(searchWrap);

          const list = document.createElement('div');
          list.className = 'ms-list';
          dd.appendChild(list);

          const footer = document.createElement('div');
          footer.className = 'ms-footer';
          const selAllBtn = document.createElement('button');
          selAllBtn.textContent = 'Select all';
          selAllBtn.onclick = (e) => {
            e.stopPropagation();
            const visOpts = getFiltered();
            visOpts.forEach(o => { if (!state.selected.includes(o.value)) state.selected.push(o.value); });
            renderList(); updateBtn(); po.applyFilters();
          };
          const clearBtn = document.createElement('button');
          clearBtn.textContent = 'Clear';
          clearBtn.onclick = (e) => {
            e.stopPropagation();
            state.selected = []; state.search = ''; renderList(); updateBtn(); po.applyFilters();
          };
          footer.appendChild(selAllBtn);
          footer.appendChild(clearBtn);
          dd.appendChild(footer);

          wrap.appendChild(dd);
          setTimeout(() => searchInput.focus(), 50);

          function getFiltered() {
            const allO = staticOptions || options;
            return state.search ? allO.filter(o => o.label.toLowerCase().includes(state.search.toLowerCase())) : allO;
          }

          function renderList() {
            list.innerHTML = '';
            const opts = getFiltered();
            if (!opts.length) { list.innerHTML = '<div class="ms-empty">No options</div>'; return; }
            opts.forEach(o => {
              const item = document.createElement('label');
              item.className = 'ms-item' + (state.selected.includes(o.value) ? ' ms-checked' : '');
              const cb = document.createElement('input');
              cb.type = 'checkbox';
              cb.checked = state.selected.includes(o.value);
              cb.onclick = e => e.stopPropagation();
              cb.onchange = () => {
                if (cb.checked) { if (!state.selected.includes(o.value)) state.selected.push(o.value); }
                else state.selected = state.selected.filter(v => v !== o.value);
                item.className = 'ms-item' + (state.selected.includes(o.value) ? ' ms-checked' : '');
                updateBtn(); po.applyFilters();
              };
              item.appendChild(cb);
              item.appendChild(document.createTextNode(o.label));
              item.onclick = e => { e.preventDefault(); cb.checked = !cb.checked; cb.onchange(); };
              list.appendChild(item);
            });
          }

          renderList();
          document.addEventListener('click', function outsideClick(e) {
            if (!dd.contains(e.target) && e.target !== btn) {
              dd.remove(); btn.classList.remove('ms-open');
              document.removeEventListener('click', outsideClick);
            }
          });
        }

        function updateBtn() {
          const sel = _msState[stateKey].selected;
          btn.className = 'ms-btn' + (sel.length ? ' ms-active' : '');
          btn.innerHTML = label + (sel.length ? ` <span class="ms-badge">${sel.length}</span>` : '') + ' <span class="ms-caret">▼</span>';
          // re-bind click
          btn.onclick = (e) => { e.stopPropagation(); toggleDropdown(); };
        }
      }

      render();
      return {
      refresh:      refresh,          // force=true triggers live re-fetch
      onPanelOpen:  function() {      // called by showPanel('pearl-ops')
        if (!_inited) {
          init();
        } else if (!_loaded) {
          refresh(false);             // not yet loaded — fetch now
        }
      },
      openFlagsModal:   function() { try { openFlagsModal(); } catch(e) {} },
      showExportModal:  function() { try { showExportModal(); } catch(e) {} },
      getTutorAttendanceMap: function() {
        var map = {};
        if (_personMap) {
          Object.keys(_personMap).forEach(function(k) {
            var p = _personMap[k];
            if (p) map[k] = p;
          });
        }
        return map;
      },
      // getStats() — for Advocacy module, returns real computed Pearl numbers
      getStats: function() {
        // Compute directly from the internal data arrays (same logic as updateStats)
        var stats = { loaded: false, scholAttPct: null, instAttPct: null, sessions: null,
                      siCount: null, surveyAvg: null, totalRows: 0, schoolCount: 0,
                      districtCount: 0, activeTutors: 0 };
        try {
          // Scholar attendance from all att rows
          var stuAttRows = _attRows.filter(function(r){ return r[ATT.ROLE]==='Student'; });
          var stuAtt  = stuAttRows.filter(function(r){ var c=classifyRecord(r); return c==='attended'; }).length;
          var stuAbs  = stuAttRows.filter(function(r){ var c=classifyRecord(r); return c==='absent'; }).length;
          var stuTotal = stuAtt + stuAbs;
          if (stuTotal > 0) stats.scholAttPct = parseFloat((stuAtt/stuTotal*100).toFixed(1));

          // Instructor attendance
          var instAttRows = _attRows.filter(function(r){ return r[ATT.ROLE]==='Instructor'; });
          var instAtt = instAttRows.filter(function(r){ var c=classifyRecord(r); return c==='attended'; }).length;
          var instAbs = instAttRows.filter(function(r){ var c=classifyRecord(r); return c==='absent'; }).length;
          var instTotal = instAtt + instAbs;
          if (instTotal > 0) stats.instAttPct = parseFloat((instAtt/instTotal*100).toFixed(1));

          // Sessions from _sessRows
          if (_sessRows && _sessRows.length) stats.sessions = _sessRows.length;

          // Service interruptions — Student role only (matches Pearl Ops panel definition)
          var siRows = _attRows.filter(function(r){ var c=classifyRecord(r); return r[ATT.ROLE]==='Student' && (c==='service_interruption'||c==='si'||c==='service-interruption'); });
          stats.siCount = siRows.length;

          // Scholar survey avg from _stuRows (complete only)
          if (_stuStreamComplete && _stuRows.length) {
            var survScores = [];
            _stuRows.forEach(function(r){
              [STU_S.CONFIDENCE, STU_S.ENJOYMENT, STU_S.LEARNING, STU_S.OVERALL].forEach(function(c){
                var v = parseFloat(r[c]); if (!isNaN(v) && v > 0) survScores.push(v);
              });
            });
            if (survScores.length) stats.surveyAvg = parseFloat((survScores.reduce(function(a,b){return a+b;},0)/survScores.length).toFixed(2));
          } else if (_stuAggScores && _stuAggScores.globalCnt > 0) {
            stats.surveyAvg = parseFloat((_stuAggScores.globalSum / _stuAggScores.globalCnt).toFixed(2));
          }

          // Schools / districts / tutors
          if (_schoolMap) {
            // Filter out empty/null keys — Pearl may create a blank-string entry from records missing a school name
            var schools = Object.keys(_schoolMap).filter(function(s){ return s && s.trim(); });
            stats.schoolCount = schools.length;
            stats.districtCount = new Set(schools.map(function(s){ return _schoolMap[s].district; }).filter(Boolean)).size;
          }
          if (_personMap) {
            stats.activeTutors = Object.keys(_personMap).filter(function(k){ return _personMap[k] && _personMap[k].role==='Instructor'; }).length;
            // Active scholars: unique students who have at least 1 attended session in Pearl
            stats.activeScholars = Object.keys(_personMap).filter(function(k){ return _personMap[k] && _personMap[k].role==='Student' && _personMap[k].attended > 0; }).length;
            // Rostered scholars: all unique students in Pearl (attended OR absent — ever appeared)
            stats.rosteredScholars = Object.keys(_personMap).filter(function(k){ return _personMap[k] && _personMap[k].role==='Student'; }).length;
          }
          stats.totalRows = _attRows.length + _sessRows.length + _instRows.length;
          stats.loaded = stats.scholAttPct !== null;
        } catch(e) { console.warn('[po.getStats] error:', e.message); }
        // Which period this snapshot reflects — callers (sya, exec dashboard)
        // must check this before trusting the numbers for a specific period,
        // since getStats() always reflects whatever is currently loaded.
        stats.activePeriod = _activePeriod;
        return stats;
      },

      // getRaceData() — race/ethnicity breakdown from ATT col 10 (scholar rows only)
      getRaceData: function() {
        try {
          var raceCounts = {};
          var total = 0;
          _attRows.forEach(function(r) {
            if (r[ATT.ROLE] !== 'Student') return;
            var race = (r[ATT.RACE] || 'Not Specified').trim() || 'Not Specified';
            raceCounts[race] = (raceCounts[race] || 0) + 1;
            total++;
          });
          // Deduplicate by USER_ID to count unique scholars per race
          var scholarRace = {};
          var seen = {};
          _attRows.forEach(function(r) {
            if (r[ATT.ROLE] !== 'Student') return;
            var uid = r[ATT.USER_ID] || r[ATT.USER];
            if (seen[uid]) return;
            seen[uid] = true;
            var race = (r[ATT.RACE] || 'Not Specified').trim() || 'Not Specified';
            scholarRace[race] = (scholarRace[race] || 0) + 1;
          });
          return { byRow: raceCounts, byScholar: scholarRace, totalRows: total, totalScholars: Object.keys(seen).length };
        } catch(e) { return null; }
      },

      // getGradeData() — grade breakdown from ATT col 8 (unique scholars)
      getGradeData: function() {
        try {
          var gradeCounts = {};
          var seen = {};
          _attRows.forEach(function(r) {
            if (r[ATT.ROLE] !== 'Student') return;
            var uid = r[ATT.USER_ID] || r[ATT.USER];
            if (seen[uid]) return;
            seen[uid] = true;
            var grade = (r[ATT.GRADE] || 'Unknown').trim() || 'Unknown';
            gradeCounts[grade] = (gradeCounts[grade] || 0) + 1;
          });
          return { byScholar: gradeCounts, totalScholars: Object.keys(seen).length };
        } catch(e) { return null; }
      },

      // getStellarSchools() — top schools by attendance and survey score
      getStellarSchools: function() {
        try {
          var schools = [];
          Object.keys(_schoolMap).forEach(function(name) {
            if (!name || !name.trim()) return; // skip blank school-name entries
            var sc = _schoolMap[name];
            if (!sc) return;
            var total = sc.stuAttended + sc.stuAbsent;
            var attRate = total > 0 ? Math.round(sc.stuAttended / total * 100) : 0;
            var sessCount = sc.sessions ? sc.sessions.length : 0;
            if (sessCount < 5) return; // skip tiny sites
            schools.push({
              school: name, district: sc.district || '',
              attRate: attRate, sessions: sessCount,
              surveyAvg: sc.stuSurveyAvg ? parseFloat(sc.stuSurveyAvg.toFixed(2)) : null,
              instSurveyAvg: sc.instSurveyAvg ? parseFloat(sc.instSurveyAvg.toFixed(2)) : null,
              siCount: sc.stuInterruptions || 0,
              flags: (sc.flags || []).length
            });
          });
          // Sort: attendance rate desc, then sessions desc
          schools.sort(function(a, b) {
            if (b.attRate !== a.attRate) return b.attRate - a.attRate;
            return b.sessions - a.sessions;
          });
          return schools;
        } catch(e) { return []; }
      },

      // getLeadershipData() — full aggregated Pearl summary for Advocacy/Leadership views
      getLeadershipData: function() {
        if (!_attRows || !_attRows.length) return null;
        try { return getLeadershipData(); } catch(e) { return null; }
      },

      // getAttRows() — raw attendance rows for Impact Report Builder (Data dept)
      // Returns a shallow copy so callers cannot mutate internal state.
      getAttRows: function() {
        return _attRows ? _attRows.slice() : [];
      },

      // isDataLoaded() — true once at least one successful fetch has completed
      isDataLoaded: function() {
        return _inited && _attRows.length > 0;
      }
    };
    }

    function getFilterSelected(stateKey) {
      return (_msState[stateKey] && _msState[stateKey].selected) ? _msState[stateKey].selected : [];
    }

    // ── GID RESOLUTION ────────────────────────────────────────────────────
    // ── GID RESOLUTION ────────────────────────────────────────────────────
    // Google assigns arbitrary large gid integers to each tab — they are NOT
    // sequential (0,1,2,3). The pubhtml page for the workbook is publicly
    // accessible and contains all real gid values in its HTML.
    //
    // Strategy:
    //   1. Fetch the pubhtml page (no auth required — same as the CSV URLs)
    //   2. Extract all gid= numbers from the HTML using a regex
    //   3. Fetch each discovered gid as CSV in parallel
    //   4. Identify each tab by its header row content
    //   5. Cache result so we never re-probe within a session
    async function resolveGids() {
      if (_gidsResolved) return true;

      // All four GIDs are confirmed from edit URLs — hardcoded, no discovery needed.
      GIDS.att  = 702726038;
      GIDS.sess = 625567780;
      GIDS.inst = 1955492004;
      GIDS.stu  = STU_GID_FALLBACK; // 1245403832

      _gidsResolved = true;
      console.log('[Pearl Ops] GIDs hardcoded — inst=' + GIDS.inst + ' stu=' + GIDS.stu);
      return true;


      // Step 1: fetch the pubhtml index to discover real gid values
      let probedGids = [];
      try {
        const pubhtmlUrl = `https://docs.google.com/spreadsheets/d/e/${BASE_ID}/pubhtml`;
        const res = await fetch(pubhtmlUrl, { signal: AbortSignal.timeout(12000) });
        if (res.ok) {
          const html = await res.text();
          // Extract all numeric gid values from href/data attributes in the HTML
          const matches = [...html.matchAll(/[?&]gid=(\d+)/g)];
          const found = [...new Set(matches.map(m => parseInt(m[1], 10)))].filter(n => !isNaN(n));
          // Always include the known scholar survey GID — pubhtml may not list it
          // if the tab is not in the sheet's published view.
          if (found.length) probedGids = [...new Set([...found, STU_GID_FALLBACK])];
          console.log('[Pearl Ops] Discovered gids from pubhtml:', found);
        }
      } catch(e) {
        console.warn('[Pearl Ops] pubhtml probe failed, will try fallback gids:', e.message);
      }

      // Step 2: if pubhtml didn't yield gids, fall back to a broad sweep of
      // common Google Sheets gid patterns. Includes known gid from edit URL.
      if (!probedGids.length) {
        probedGids = [0, 1, 2, 3,
                      1245403832,          // Student Surveys tab (confirmed from edit URL)
                      1748668439,          // known gid from edit URL provided
                      628127573, 274671201, 1372188422, 1640135663,
                      1303503567, 1649760609, 1978724299, 1784717262,
                      100, 200, 300, 400, 500, 600, 700, 800];
      }

      // Step 3: fetch each candidate gid as CSV — in parallel, ignore 400s
      const results = await Promise.all(probedGids.map(async gid => {
        try {
          const res = await fetch(csvUrl(gid) + '&t=' + Date.now(), {signal: AbortSignal.timeout(30000)});
          if (!res.ok) return null;
          const text = await res.text();
          const firstRow = text.split('\n')[0].toLowerCase().replace(/"/g, '');
          return { gid, text, firstRow };
        } catch { return null; }
      }));

      // Step 4: identify each tab by header signature — independent checks per tab
      // Log all headers to aid future debugging
      const validResults = results.filter(Boolean);
      console.log('[Pearl Ops] Raw tab headers:', validResults.map(r => ({ gid: r.gid, header: r.firstRow.slice(0, 120) })));

      for (const r of validResults) {
        const h = r.firstRow;

        // Attendance Detail: starts with "user" AND has both "role" AND "session"
        // (distinguishes from summary sheets that also start with "user")
        if (GIDS.att === null &&
            (h.startsWith('user,') || h.startsWith('"user",')) &&
            h.includes('role') && h.includes('session')) {
          GIDS.att = r.gid;
          continue;
        }

        // Session Details: starts with "title" + has "instructor" + has "session id" or "pearl"
        if (GIDS.sess === null &&
            (h.startsWith('title,') || h.startsWith('"title",')) &&
            h.includes('instructor') &&
            (h.includes('session id') || h.includes('pearl'))) {
          GIDS.sess = r.gid;
          continue;
        }

        // Survey tabs both start with "filled by" — distinguish by key question word
        if (h.includes('filled by') || h.includes('filled for')) {
          // Instructor survey: contains engagement/engaged keyword
          if (GIDS.inst === null &&
              (h.includes('engag') || h.includes('instructor') || h.includes('comment'))) {
            GIDS.inst = r.gid;
            continue;
          }
          // Student survey: contains confidence/confident keyword, or is the second filled-by tab
          if (GIDS.stu === null &&
              (h.includes('confiden') || h.includes('student') || h.includes('enjoy'))) {
            GIDS.stu = r.gid;
            continue;
          }
          // Fallback: assign whichever survey slot is still null
          if (GIDS.inst === null) { GIDS.inst = r.gid; continue; }
          if (GIDS.stu  === null) { GIDS.stu  = r.gid; continue; }
        }
      }

      // Second pass: if surveys still unresolved, use any remaining unmatched tab
      // that isn't already assigned to att or sess
      if (GIDS.inst === null || GIDS.stu === null) {
        const assignedGids = new Set(Object.values(GIDS).filter(v => v !== null));
        const unmatched = validResults.filter(r => !assignedGids.has(r.gid));
        for (const r of unmatched) {
          if (GIDS.inst === null) { GIDS.inst = r.gid; continue; }
          if (GIDS.stu  === null) { GIDS.stu  = r.gid; continue; }
        }
      }

      // Third pass: relaxed matching for att and sess using remaining unassigned tabs
      if (GIDS.att === null || GIDS.sess === null) {
        const assignedGids2 = new Set(Object.values(GIDS).filter(v => v !== null));
        const remaining = validResults.filter(r => !assignedGids2.has(r.gid));
        for (const r of remaining) {
          const h = r.firstRow;
          // Attendance: any tab whose first column is 'user' (loose match)
          if (GIDS.att === null && (h.startsWith('user,') || h.startsWith('"user",'))) {
            GIDS.att = r.gid; continue;
          }
          // Session: any tab whose first column is 'title' (loose match)
          if (GIDS.sess === null && (h.startsWith('title,') || h.startsWith('"title",'))) {
            GIDS.sess = r.gid; continue;
          }
        }
        // Last resort: assign any remaining unmatched tabs
        const assignedGids3 = new Set(Object.values(GIDS).filter(v => v !== null));
        const lastResort = validResults.filter(r => !assignedGids3.has(r.gid));
        for (const r of lastResort) {
          if (GIDS.att  === null) { GIDS.att  = r.gid; continue; }
          if (GIDS.sess === null) { GIDS.sess = r.gid; continue; }
        }
      }

      // ── Apply known-good fallbacks for any tab still unresolved ─────────
      // att + sess are already set above; inst/stu use discovery or these fallbacks.
      if (!GIDS.inst) GIDS.inst = 1955492004;
      if (!GIDS.stu)  GIDS.stu  = STU_GID_FALLBACK;  // fallback if discovery found nothing
      // Guard: stu and inst must never share the same GID — if they do, discovery
      // mis-assigned the scholar survey to the inst slot; override with known fallback.
      if (GIDS.stu === GIDS.inst) {
        console.warn('[Pearl Ops] stu/inst GID collision — overriding stu to fallback:', STU_GID_FALLBACK);
        GIDS.stu = STU_GID_FALLBACK;
      }
      // Always re-assert all GIDs to confirmed values
      GIDS.att  = 702726038;
      GIDS.sess = 625567780;
      GIDS.stu  = STU_GID_FALLBACK;

      // Persist only inst to localStorage (other GIDs are always hardcoded)
      try {
        localStorage.setItem('njtc_pearl_gids_v4', JSON.stringify({inst:GIDS.inst,stu:GIDS.stu}));
        console.log('[Pearl Ops] GIDs resolved — inst=' + GIDS.inst + ' stu=' + GIDS.stu);
      } catch(e) {}

      // Log what was resolved (helps with future debugging)
      console.log('[Pearl Ops] GIDs resolved →', JSON.stringify(GIDS));

      // If any tab still unresolved, log a clear error rather than silently failing
      for (const [tab, gid] of Object.entries(GIDS)) {
        if (gid === null) console.error(`[Pearl Ops] Could not resolve gid for tab: ${tab}`);
      }

      _gidsResolved = true;
      return Object.values(GIDS).some(v => v !== null); // at least one resolved
    }

    // ── PERIOD TOGGLE ─────────────────────────────────────────────────────
    // Mirrors the sya.setPeriod() pattern used by the SY Analytics panel:
    // flip the active period, reset UI + derived state, and force a re-fetch
    // from the correct source. classifyRecord/buildIndexes/updateStats/
    // exportData are untouched — they always just read whatever is currently
    // sitting in _attRows/_sessRows/_stuRows/_instRows.
    function setPeriod(period) {
      if (_activePeriod === period) return;
      if (period !== 'sy2526' && period !== 'summer2026') return;
      _activePeriod = period;

      ['sy2526', 'summer2026'].forEach(p => {
        const btn = document.getElementById('poPeriodBtn_' + p);
        if (btn) btn.classList.toggle('active', p === period);
      });
      const eyebrow = document.getElementById('poEyebrow');
      if (eyebrow) eyebrow.textContent = period === 'summer2026'
        ? '☀️ Summer 2026 · Live Pearl Data'
        : 'SY 2025–2026 · Live Pearl Data';

      // Reset all derived state — do NOT mix SY and Summer records together.
      _attRows = []; _sessRows = []; _stuRows = []; _instRows = [];
      _schoolMap = {}; _personMap = {}; _sessMap = {};
      _view = 'schools'; _selSchool = null; _selPerson = null;
      _stuStreamComplete = false; _stuAggScores = null;

      refresh(true);
    }

    // ── FETCH ALL TABS — DISPATCH BY PERIOD ─────────────────────────────
    async function refresh(force = false) {
      return _activePeriod === 'summer2026' ? refreshSummer(force) : refreshSY(force);
    }

    // ── FETCH ALL TABS — SY 25-26 (existing, unchanged) ───────────────────
    async function refreshSY(force = false) {
      if (_loading) return;
      _loading = true;

      // ── stale-while-revalidate: show cached data instantly ──────────
      if (!force) {
        const _pc = NJTC_CACHE.get('njtc_pearl_v1');
        if (_pc && _pc.data) {
          const d = _pc.data;
          try {
            _attRows  = d.att  || [];
            _sessRows = d.sess || [];
            _stuRows  = d.stu  || [];
            _instRows = d.inst || [];
            buildIndexes();
            _loaded = true;
            setSyncState(_pc.fresh ? 'live' : 'stale');
            render();
            const btn2 = document.getElementById('poRefreshBtn');
            if (btn2) btn2.disabled = false;
            _loading = false;
            if (_pc.fresh) return;  // cache fresh — skip network
            // stale: continue to background re-fetch below
          } catch(e) { /* fall through to network */ }
        }
      }

      setSyncState('loading');
      const btn = document.getElementById('poRefreshBtn');
      if (btn) btn.disabled = true;
      try {
        await resolveGids();
        const bust = force ? '&t=' + Date.now() : '';

        // ── Per-tab fetch with independent timeouts ──────────────────────
        // att/sess/inst fetch fast — stu (scholar survey) is a large growing file.
        // Promise.allSettled: a stu timeout does NOT kill the other tabs.
        // att, inst, sess fetch in parallel with timeouts
        // stu (scholar survey) streams independently — does NOT block rendering
        const [attResult, instResult, sessResult] = await Promise.allSettled([
          fetchTabWithRetry(GIDS.att,  bust, 30000, 'att',  3),
          fetchTabWithRetry(GIDS.inst, bust, 25000, 'inst', 3),
          fetchTabWithRetry(GIDS.sess, bust, 30000, 'sess', 3),
        ]);

        // ── Parse resolved tabs ─────────────────────────────────────────
        // Yield to main thread before each heavy synchronous parse so the
        // browser stays responsive and avoids "page not responding" dialogs.
        // att
        await new Promise(r => setTimeout(r, 0));
        if (attResult.status === 'fulfilled' && attResult.value) {
          _attRows = parseCSVLimit(attResult.value, ATT_MAX_COL).slice(1);
          for (const r of _attRows) {
            if (!r[ATT.WEEK] && r[ATT.SESS_DATE]) {
              r[ATT.WEEK] = weekKeyFromDateStr(r[ATT.SESS_DATE]);
            }
          }
        } else {
          console.warn('[Pearl Ops] att tab failed:', attResult.reason && attResult.reason.message);
        }

        // sess
        await new Promise(r => setTimeout(r, 0));
        if (sessResult.status === 'fulfilled' && sessResult.value) {
          _sessRows = parseCSVLimit(sessResult.value, SESS_MAX_COL).slice(1);
        } else {
          console.warn('[Pearl Ops] sess tab failed:', sessResult.reason && sessResult.reason.message);
        }

        // inst
        await new Promise(r => setTimeout(r, 0));
        if (instResult.status === 'fulfilled' && instResult.value) {
          _instRows = parseCSVLimit(instResult.value, INST_MAX_COL).slice(1);
        } else {
          console.warn('[Pearl Ops] inst tab failed:', instResult.reason && instResult.reason.message);
        }

        // ── Scholar survey: restore from aggregated cache first (instant), then stream ──
        // The stu CSV is 100k+ rows and grows all year. We never wait for the full download.
        // Instead: restore compact aggregated cache immediately so the card shows a real number,
        // then stream fresh data in the background and update when complete.
        _stuRows = _restoreStuAggCache();  // instant restore — empty array if no cache
        if (_stuRows.length) {
          console.log('[Pearl Ops] Scholar survey: restored', _stuRows.length, 'rows from agg cache');
        }
        // Always stream fresh stu data in background (don't block att/inst/sess)
        _streamStuInBackground(''); // 2PACX endpoint rejects &t= cache-bust params

        _lastFetch = new Date();
        buildIndexes();

        // ── Cache all successfully loaded tabs ──────────────────────────
        try {
          const _cachePayload = {
            att:  _attRows.slice(0, 15000),
            sess: _sessRows.slice(0, 15000),
            inst: _instRows,   // no cap — tutor surveys are not streamed; cache all rows
          };
          // Only cache stu if it loaded successfully (don't overwrite good cache with empty)
          if (stuLoaded) _cachePayload.stu = _stuRows.slice(0, 10000);
          NJTC_CACHE.set('njtc_pearl_v1', _cachePayload);
        } catch(e) {}

        // ── Render: even if stu failed, show what we have ──────────────
        const allTabsFailed = !_attRows.length && !_sessRows.length && !_instRows.length;
        if (allTabsFailed) {
          console.warn('[Pearl Ops] All primary tabs failed to load.');
          setSyncState('error');
        } else {
          setSyncState('live');
          populateFilters();
          renderView();
        }
      } catch(e) {
        console.warn('[Pearl Ops] Fetch failed:', e.message);
        setSyncState('error');
      }
      if (btn) btn.disabled = false;
      _loading = false;
    }

    // ── FETCH ALL TABS — SUMMER 2026 ────────────────────────────────────
    // Summer's 4 tabs are session-level + surveys (no streaming needed yet —
    // far smaller than SY's year-long scholar survey sheet). Fetched fully,
    // then run through the explode/translate layer above so every downstream
    // function (classifyRecord, buildIndexes, updateStats, exportData, …)
    // operates on the exact same row shapes it always has.
    async function fetchSummerTab(gid, bust, timeoutMs, label) {
      if (!gid) { console.warn('[Pearl Ops][Summer] GID missing for tab:', label); return ''; }
      const res = await fetch(summerCsvUrl(gid) + (bust || ''), { signal: AbortSignal.timeout(timeoutMs) });
      if (!res.ok) throw new Error('HTTP ' + res.status + ' tab=' + label);
      return res.text();
    }

    async function refreshSummer(force = false) {
      if (_loading) return;
      _loading = true;

      if (!force) {
        const _pc = NJTC_CACHE.get('njtc_pearl_summer_v1');
        if (_pc && _pc.data) {
          try {
            _attRows  = _pc.data.att  || [];
            _sessRows = _pc.data.sess || [];
            _stuRows  = _pc.data.stu  || [];
            _instRows = _pc.data.inst || [];
            buildIndexes();
            setSyncState(_pc.fresh ? 'live' : 'stale');
            populateFilters();
            renderView();
            const btn2 = document.getElementById('poRefreshBtn');
            if (btn2) btn2.disabled = false;
            _loading = false;
            if (_pc.fresh) return;
          } catch(e) { /* fall through to network */ }
        }
      }

      setSyncState('loading');
      const btn = document.getElementById('poRefreshBtn');
      if (btn) btn.disabled = true;
      try {
        const bust = force ? ('&t=' + Date.now()) : '';
        const [attResult, sessResult, instResult, stuResult] = await Promise.allSettled([
          fetchSummerTab(SUMMER_GIDS.att,  bust, 30000, 'summer-att'),
          fetchSummerTab(SUMMER_GIDS.sess, bust, 30000, 'summer-sess'),
          fetchSummerTab(SUMMER_GIDS.inst, bust, 25000, 'summer-inst'),
          fetchSummerTab(SUMMER_GIDS.stu,  bust, 30000, 'summer-stu'),
        ]);

        // "Missed Reasons" is now the real per-attendee Attendance Detail tab —
        // same 14-column layout as SY (User/Role/Session/.../Missed Reason/.../
        // Pearl User ID), so it's parsed with the exact same ATT map and CSV
        // parser SY uses. No translation layer needed for attendance data.
        const attRaw  = attResult.status  === 'fulfilled' ? parseCSVLimit(attResult.value, ATT_MAX_COL).slice(1) : [];
        const sessRaw = sessResult.status === 'fulfilled' ? parseCSV(sessResult.value).slice(1) : [];
        const instRaw = instResult.status === 'fulfilled' ? parseCSV(instResult.value).slice(1) : [];
        const stuRaw  = stuResult.status  === 'fulfilled' ? parseCSV(stuResult.value).slice(1)  : [];
        if (attResult.status  !== 'fulfilled') console.warn('[Pearl Ops][Summer] attendance/missed-reasons tab failed:', attResult.reason && attResult.reason.message);
        if (sessResult.status !== 'fulfilled') console.warn('[Pearl Ops][Summer] session tab failed:', sessResult.reason && sessResult.reason.message);
        if (instResult.status !== 'fulfilled') console.warn('[Pearl Ops][Summer] instructor survey tab failed:', instResult.reason && instResult.reason.message);
        if (stuResult.status  !== 'fulfilled') console.warn('[Pearl Ops][Summer] student survey tab failed:', stuResult.reason && stuResult.reason.message);

        // Summer's Missed Reasons tab has no WEEK column (unlike SY's, col AA) —
        // derive it from each row's own Session Date, same fallback SY uses when
        // its WEEK column is blank, just against a Summer-specific start date.
        _resolveSummerStart(attRaw, ATT.SESS_DATE);
        for (const r of attRaw) {
          if (!r[ATT.WEEK] && r[ATT.SESS_DATE]) r[ATT.WEEK] = summerWeekKeyFromDateStr(r[ATT.SESS_DATE]);
        }

        _attRows  = attRaw;
        _sessRows = buildSummerSessRows(sessRaw);
        _stuRows  = buildSummerStuRows(stuRaw);
        _instRows = buildSummerInstRows(instRaw);
        _stuStreamComplete = true; // Summer surveys aren't streamed — the fetched set is the complete set

        _lastFetch = new Date();
        buildIndexes();

        try {
          NJTC_CACHE.set('njtc_pearl_summer_v1', {
            att: _attRows, sess: _sessRows, stu: _stuRows, inst: _instRows,
          });
        } catch(e) {}

        const allTabsFailed = !_attRows.length && !_sessRows.length && !_instRows.length;
        if (allTabsFailed) {
          console.warn('[Pearl Ops][Summer] All tabs failed to load.');
          setSyncState('error');
        } else {
          setSyncState('live');
          populateFilters();
          renderView();
        }
      } catch(e) {
        console.warn('[Pearl Ops][Summer] Fetch failed:', e.message);
        setSyncState('error');
      }
      if (btn) btn.disabled = false;
      _loading = false;
    }

    // ── Scholar Survey: aggregated cache restore ────────────────────────
    // Reads the compact aggregated cache and reconstructs _stuRows as slim objects.
    // Each slim row has only the fields buildIndexes() needs — not the full 23 cols.
    // This means the cache is ~50-100x smaller than raw rows.
    function _restoreStuAggCache() {
      try {
        var raw = localStorage.getItem(STU_AGG_KEY);
        if (!raw) return [];
        var obj = JSON.parse(raw);
        if (!obj || !obj.ts || !obj.schools) return [];
        if (Date.now() - obj.ts > STU_AGG_TTL) return [];  // expired
        // Reconstruct slim _stuRows from aggregated per-school score arrays
        var rows = [];
        var schools = obj.schools;
        for (var school in schools) {
          var sc = schools[school];
          // Each entry: [conf, enjoy, learn, overall, comment, sessId, userId, district, week]
          for (var i = 0; i < sc.entries.length; i++) {
            var e = sc.entries[i];
            var r = [];
            // STU_S: FILLED_BY=0, FILLED_FOR=1, CONF=2, ENJOY=3, LEARN=4, OVERALL=5,
            //         COMMENT=6, DATE=7, SCHOOL=8, DISTRICT=9, ..., SESS_ID=11, FILLED_BY_ID=12, ..., WEEK=22
            r[0]  = e[5] || '';    // FILLED_BY (name) — not critical
            r[1]  = '';            // FILLED_FOR
            r[2]  = e[0];         // CONFIDENCE
            r[3]  = e[1];         // ENJOYMENT
            r[4]  = e[2];         // LEARNING
            r[5]  = e[3];         // OVERALL
            r[6]  = e[4] || '';   // COMMENT
            r[7]  = '';           // DATE
            r[8]  = school;       // SCHOOL
            r[9]  = sc.district || ''; // DISTRICT
            r[11] = e[6] || '';   // SESS_ID
            r[12] = e[7] || '';   // FILLED_BY_ID
            r[22] = e[8] || '';   // WEEK
            rows.push(r);
          }
        }
        // Pre-compute final agg scores from cache so survey card shows correctly
        // before any stream runs. This gives cross-dept score consistency.
        var restoredScores = { globalSum: 0, globalCnt: 0, bySchool: {} };
        for (var rs in schools) {
          var rsc = schools[rs];
          var sSum = 0, sCnt = 0;
          for (var ri = 0; ri < rsc.entries.length; ri++) {
            var re2 = rsc.entries[ri];
            [0,1,2,3].forEach(function(ci) {
              var v = parseFloat(re2[ci]);
              if (!isNaN(v) && v > 0) { sSum += v; sCnt++; restoredScores.globalSum += v; restoredScores.globalCnt++; }
            });
          }
          restoredScores.bySchool[rs] = { avg: sCnt > 0 ? sSum/sCnt : 0, cnt: sCnt };
        }
        _stuAggScores = restoredScores;
        _stuStreamComplete = true;   // cache = a previous complete run → treat as complete
        console.log('[Pearl Ops] STU agg cache restored:', rows.length, 'rows,', Object.keys(schools).length, 'schools, age:', Math.round((Date.now()-obj.ts)/60000), 'min');
        return rows;
      } catch(e) {
        console.warn('[Pearl Ops] STU agg cache restore failed:', e.message);
        return [];
      }
    }

    // ── Scholar Survey: streaming fetch + live aggregation ───────────────
    // Fetches the stu CSV tab as a stream, parsing rows as network chunks arrive.
    // After first PARTIAL_THRESHOLD rows parsed: re-renders card with partial data.
    // After full stream: saves fresh aggregated cache, final render.
    var _stuStreamRunning = false;
    async function _streamStuInBackground(bust) {
      if (_stuStreamRunning) return;
      _stuStreamRunning = true;
      _stuStreamComplete = false;  // mark incomplete until stream finishes
      _stuRows = [];               // discard cache rows — live sheet data only, no duplication
      var PARTIAL_THRESHOLD = 300;  // rows before first partial render (lowered from 800)
      var ROLLING_UPDATE_EVERY = 500; // re-render survey card every N additional rows after partial
      var url = stuCsvUrl() + (bust || '');
      console.log('[Pearl Ops] Streaming scholar survey gid=' + (GIDS.stu || STU_GID_FALLBACK) + ' url=' + url);
      try {
        // 90-second hard timeout — prevents indefinite hang on stalled network
        var res = await fetch(url, { signal: AbortSignal.timeout(90000) });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        if (!res.body) {
          // Fallback: ReadableStream not supported — load full text
          var text = await res.text();
          _processStuText(text, bust);
          return;
        }
        var reader = res.body.getReader();
        var decoder = new TextDecoder('utf-8');
        var buffer = '';
        var headerSkipped = false;
        var firstChunkLogged = false;
        var parsedRows = 0;
        var partialRendered = false;
        // Aggregation structures built during stream
        var streamAgg = {};   // school -> { district, entries:[], sum, cnt }
        var globalSum = 0, globalCnt = 0;

        while (true) {
          var chunk = await reader.read();
          if (chunk.done) break;
          // Decode chunk (stream=true: handles multi-byte chars across chunk boundaries)
          buffer += decoder.decode(chunk.value, { stream: true });
          // Log first chunk to diagnose wrong-tab or HTML-redirect issues
          if (!firstChunkLogged) {
            firstChunkLogged = true;
            var peek = buffer.slice(0, 120).replace(/\n/g, '↵');
            console.log('[Pearl Ops] STU first chunk (' + chunk.value.byteLength + 'B):', peek);
          }
          // Process complete lines from buffer
          var lines = buffer.split('\n');
          buffer = lines.pop();  // last element may be incomplete line — keep for next chunk
          for (var li = 0; li < lines.length; li++) {
            var line = lines[li].trimEnd();
            if (!line) continue;
            if (!headerSkipped) { headerSkipped = true; continue; }
            // Fast column extraction: split on comma, handle quoted fields minimally
            var cols = _fastSplitStuRow(line);
            if (!cols) continue;
            var conf    = parseFloat(cols[2]);
            var enjoy   = parseFloat(cols[3]);
            var learn   = parseFloat(cols[4]);
            var overall = parseFloat(cols[5]);
            var comment = (cols[6] || '').trim();
            var school  = (cols[8] || '').trim();
            var district= (cols[9] || '').trim();
            var sessId  = (cols[11] || '').trim();
            var userId  = (cols[12] || '').trim();
            var week    = (cols[22] || '').trim();
            // Build slim row for _stuRows (same structure _restoreStuAggCache returns)
            var r = [];
            r[2]=cols[2]; r[3]=cols[3]; r[4]=cols[4]; r[5]=cols[5];
            r[6]=comment; r[8]=school;  r[9]=district;
            r[11]=sessId; r[12]=userId; r[22]=week;
            _stuRows.push(r);
            parsedRows++;
            // Aggregate scores for cache
            var hasScore = false;
            if (!isNaN(conf)    && conf > 0)    { globalSum += conf;    globalCnt++; hasScore=true; }
            if (!isNaN(enjoy)   && enjoy > 0)   { globalSum += enjoy;   globalCnt++; hasScore=true; }
            if (!isNaN(learn)   && learn > 0)   { globalSum += learn;   globalCnt++; hasScore=true; }
            if (!isNaN(overall) && overall > 0) { globalSum += overall; globalCnt++; hasScore=true; }
            if (school) {
              if (!streamAgg[school]) streamAgg[school] = { district: district, entries: [], sum: 0, cnt: 0 };
              var scAgg = streamAgg[school];
              scAgg.entries.push([conf||'', enjoy||'', learn||'', overall||'', comment, userId, sessId, userId, week]);
              if (hasScore) { scAgg.sum += (conf||0)+(enjoy||0)+(learn||0)+(overall||0); scAgg.cnt += 4; }
            }
            // Partial render after threshold — set _stuAggScores first so survey card shows real data
            if (!partialRendered && parsedRows >= PARTIAL_THRESHOLD) {
              partialRendered = true;
              try {
                // Snapshot running totals into _stuAggScores so the survey KPI tile shows now
                var partialAgg = { globalSum: globalSum, globalCnt: globalCnt, bySchool: {} };
                for (var psk in streamAgg) {
                  var psc2 = streamAgg[psk];
                  partialAgg.bySchool[psk] = { avg: psc2.cnt > 0 ? psc2.sum / psc2.cnt : 0, cnt: psc2.cnt, district: psc2.district };
                }
                _stuAggScores = partialAgg;
                buildIndexes();
                renderView();
                setSyncState('partial');
                console.log('[Pearl Ops] STU partial render at', parsedRows, 'rows — survey avg set to', globalCnt > 0 ? (globalSum/globalCnt).toFixed(2) : '—');
              } catch(e) {}
            } else if (partialRendered && parsedRows % ROLLING_UPDATE_EVERY === 0) {
              // Rolling update: refresh survey card every 500 more rows so number converges live
              try {
                var rollingAgg = { globalSum: globalSum, globalCnt: globalCnt, bySchool: {} };
                for (var rsk in streamAgg) {
                  var rsc2 = streamAgg[rsk];
                  rollingAgg.bySchool[rsk] = { avg: rsc2.cnt > 0 ? rsc2.sum / rsc2.cnt : 0, cnt: rsc2.cnt, district: rsc2.district };
                }
                _stuAggScores = rollingAgg;
                renderView();
              } catch(e) {}
            }
          }
        }
        // Flush remaining buffer
        if (buffer.trim() && headerSkipped) {
          var cols2 = _fastSplitStuRow(buffer.trim());
          if (cols2) {
            var r2 = [];
            r2[2]=cols2[2]; r2[3]=cols2[3]; r2[4]=cols2[4]; r2[5]=cols2[5];
            r2[6]=(cols2[6]||'').trim(); r2[8]=(cols2[8]||'').trim(); r2[9]=(cols2[9]||'').trim();
            r2[11]=(cols2[11]||'').trim(); r2[12]=(cols2[12]||'').trim(); r2[22]=(cols2[22]||'').trim();
            _stuRows.push(r2);
          }
        }
        console.log('[Pearl Ops] STU stream complete:', _stuRows.length, 'rows,', Object.keys(streamAgg).length, 'schools');

        // ── 0-rows fallback: stream succeeded (HTTP 200) but no rows parsed ──
        // This happens when the resolved GID points to the wrong tab (e.g. tutor
        // survey or a non-CSV tab).  Retry once with STU_GID_FALLBACK.
        if (_stuRows.length === 0 && GIDS.stu !== STU_GID_FALLBACK) {
          console.warn('[Pearl Ops] STU 0 rows from gid=' + GIDS.stu + ' — retrying with fallback gid=' + STU_GID_FALLBACK);
          GIDS.stu = STU_GID_FALLBACK;
          try { localStorage.setItem('njtc_pearl_gids_v4', JSON.stringify({inst: GIDS.inst, stu: GIDS.stu})); } catch(e2) {}
          _stuStreamRunning = false;  // allow re-entry
          _streamStuInBackground(bust);
          return;
        }

        // Compute final agg scores from the complete stream
        var finalScores = { globalSum: globalSum, globalCnt: globalCnt, bySchool: {} };
        for (var fs in streamAgg) {
          var fsc = streamAgg[fs];
          finalScores.bySchool[fs] = { avg: fsc.cnt > 0 ? fsc.sum/fsc.cnt : 0, cnt: fsc.cnt };
        }
        _stuAggScores = finalScores;
        _stuStreamComplete = true;   // mark complete — survey card now reads final score
        // Final rebuild + render with authoritative complete-stream score
        buildIndexes();
        renderView();
        setSyncState('live');
        // Notify HR profiles to re-overlay with survey scores now available
        if (typeof _hrInvalidateOverlay === 'function') _hrInvalidateOverlay();
        _notifyLeadershipReady();
        // Save aggregated cache (compact — only entries needed for restore)
        try {
          // Trim entries per school to last 2000 (increased from 500 for accuracy)
          var cacheSchools = {};
          for (var s in streamAgg) {
            cacheSchools[s] = {
              district: streamAgg[s].district,
              entries: streamAgg[s].entries.slice(-2000),
              sum: streamAgg[s].sum,
              cnt: streamAgg[s].cnt
            };
          }
          var cacheObj = { ts: Date.now(), schools: cacheSchools, totalRows: _stuRows.length };
          // Clear older pearl cache keys to free space before saving
          try { ['njtc_od_att_v3','njtc_od_inst_v3','njtc_od_stu_v3','njtc_od_sess_v3',
                 'njtc_od_att_v4','njtc_od_inst_v4','njtc_od_stu_v4','njtc_od_sess_v4'].forEach(k => localStorage.removeItem(k)); } catch(_){}
          localStorage.setItem(STU_AGG_KEY, JSON.stringify(cacheObj));
          console.log('[Pearl Ops] STU agg cache saved:', _stuRows.length, 'rows,',
            Math.round(JSON.stringify(cacheObj).length / 1024), 'KB');
        } catch(e) {
          console.warn('[Pearl Ops] STU agg cache save failed (storage full?):', e.message);
        }
      } catch(e) {
        console.warn('[Pearl Ops] STU stream failed:', e.message);
        // If primary gid failed and we have an alternate gid, try it once
        if (!_stuRows.length && GIDS.stu !== STU_GID_FALLBACK) {
          console.log('[Pearl Ops] STU retrying with fallback gid:', STU_GID_FALLBACK);
          var altUrl = 'https://docs.google.com/spreadsheets/d/e/' + BASE_ID + '/pub?output=csv&gid=' + STU_GID_FALLBACK;
          try {
            var altRes = await fetch(altUrl);
            if (altRes.ok) {
              var altText = await altRes.text();
              if (altText.length > 500) {
                GIDS.stu = STU_GID_FALLBACK; // persist corrected gid
                _processStuText(altText, '');
                return; // _processStuText sets state
              }
            }
          } catch(e2) { console.warn('[Pearl Ops] STU fallback gid also failed:', e2.message); }
        }
        if (!_stuRows.length) setSyncState('error');
      } finally {
        _stuStreamRunning = false;
      }
    }

    // Fast CSV row splitter for stu rows — only extracts cols 0-22.
    // Handles quoted fields (Google Sheets wraps fields with commas in quotes).
    // Returns array or null if row has < 5 columns.
    function _fastSplitStuRow(line) {
      var cols = [];
      var cur = '';
      var inQ = false;
      var ci = 0;
      for (var i = 0; i < line.length; i++) {
        var ch = line[i];
        if (inQ) {
          if (ch === '"') {
            if (line[i+1] === '"') { cur += '"'; i++; }
            else inQ = false;
          } else cur += ch;
        } else {
          if (ch === '"') { inQ = true; }
          else if (ch === ',') {
            cols[ci++] = cur; cur = '';
            if (ci > 22) break;  // have all cols we need — stop parsing
          } else cur += ch;
        }
      }
      cols[ci] = cur;
      return cols.length >= 5 ? cols : null;
    }

    // Fallback: full text load (when ReadableStream not available)
    function _processStuText(text, bust) {
      try {
        _stuRows = parseCSVLimit(text, STU_MAX_COL).slice(1);
        console.log('[Pearl Ops] STU full text load:', _stuRows.length, 'rows');
        _stuStreamComplete = true;   // full text = complete data
        buildIndexes();
        renderView();
        setSyncState('live');
        // Save agg cache from parsed rows
        _saveStuAggFromRows(_stuRows);
      } catch(e) {
        console.warn('[Pearl Ops] STU text process failed:', e.message);
      } finally {
        _stuStreamRunning = false;
      }
    }

    // Build and save agg cache from already-parsed _stuRows array
    function _saveStuAggFromRows(rows) {
      try {
        var schools = {};
        var gSum = 0, gCnt = 0;
        var memScores = { globalSum: 0, globalCnt: 0, bySchool: {} };
        for (var i = 0; i < rows.length; i++) {
          var r = rows[i];
          var school = r[8] || '';
          if (!school) continue;
          if (!schools[school]) schools[school] = { district: r[9]||'', entries: [], sum: 0, cnt: 0 };
          var entry = [r[2]||'',r[3]||'',r[4]||'',r[5]||'',r[6]||'',r[0]||'',r[11]||'',r[12]||'',r[22]||''];
          schools[school].entries.push(entry);
          [0,1,2,3].forEach(function(ci) {
            var v = parseFloat(entry[ci]);
            if (!isNaN(v) && v > 0) { schools[school].sum+=v; schools[school].cnt++; gSum+=v; gCnt++; }
          });
          if (!memScores.bySchool[school]) memScores.bySchool[school] = { avg:0, cnt:0, sum:0 };
          [0,1,2,3].forEach(function(ci) {
            var v2 = parseFloat(entry[ci]);
            if (!isNaN(v2) && v2 > 0) { memScores.bySchool[school].sum+=v2; memScores.bySchool[school].cnt++; memScores.globalSum+=v2; memScores.globalCnt++; }
          });
        }
        for (var s2 in memScores.bySchool) {
          var sb = memScores.bySchool[s2];
          sb.avg = sb.cnt > 0 ? sb.sum/sb.cnt : 0;
        }
        _stuAggScores = memScores;  // update in-memory scores from this complete run
        var cacheObj = { ts: Date.now(), schools: schools, totalRows: rows.length };
        localStorage.setItem(STU_AGG_KEY, JSON.stringify(cacheObj));
        console.log('[Pearl Ops] STU agg saved from rows:', rows.length);
      } catch(e) {}
    }

    async function fetchTab(gid, bust) {
      if (gid === null) return '';
      const res = await fetch(csvUrl(gid) + bust, {signal: AbortSignal.timeout(20000)});
      if (!res.ok) throw new Error('HTTP ' + res.status + ' for tab gid=' + gid);
      return res.text();
    }

    // Per-tab fetch using ReadableStream — reads body in chunks to avoid body-download timeouts.
    // The timeout covers the entire operation (connection + full body), but streaming keeps the
    // socket alive on each chunk read so large tabs (att ~10MB+, sess ~9MB) don't abort mid-body.
    async function fetchTabTimed(gid, bust, timeoutMs, label) {
      if (gid === null) {
        console.warn('[Pearl Ops] GID null for tab:', label, '— skipping');
        return '';
      }
      const url = csvUrl(gid) + (bust || '');
      try {
        const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
        if (!res.ok) throw new Error('HTTP ' + res.status + ' tab=' + label);
        let text;
        if (res.body) {
          const reader = res.body.getReader();
          const dec = new TextDecoder('utf-8');
          const parts = [];
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            parts.push(dec.decode(value, { stream: true }));
          }
          parts.push(dec.decode());
          text = parts.join('');
        } else {
          text = await res.text();
        }
        console.log('[Pearl Ops] Tab', label, 'loaded:', Math.round(text.length/1024), 'KB');
        return text;
      } catch(e) {
        console.warn('[Pearl Ops] Tab', label, 'failed (' + timeoutMs + 'ms timeout):', e.message);
        throw e;
      }
    }

    // fetchTabWithRetry: wraps fetchTabTimed with exponential-backoff retry.
    // maxAttempts=2 → tries once, waits backoffMs, then tries again with a
    // cache-busted URL on each retry (Google CDN sometimes needs a fresh request).
    // On final failure the error is re-thrown so the caller can warn + fall through.
    async function fetchTabWithRetry(gid, bust, timeoutMs, label, maxAttempts) {
      maxAttempts = maxAttempts || 2;
      let lastErr;
      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        // Always cache-bust on retry so a stale 503 isn't served from CDN edge
        const b = attempt === 1 ? (bust || '') : ('&t=' + Date.now());
        try {
          const text = await fetchTabTimed(gid, b, timeoutMs, label);
          if (attempt > 1) console.log('[Pearl Ops] Tab', label, 'succeeded on attempt', attempt);
          return text;
        } catch(e) {
          lastErr = e;
          if (attempt < maxAttempts) {
            const delay = 2000 * attempt; // 2s, 4s, …
            console.warn('[Pearl Ops] Tab', label, 'attempt', attempt, 'failed — retrying in', delay + 'ms');
            await new Promise(res => setTimeout(res, delay));
          }
        }
      }
      console.warn('[Pearl Ops] Tab', label, 'exhausted', maxAttempts, 'attempts:', lastErr && lastErr.message);
      throw lastErr;
    }

    // ── BUILD INDEXES ─────────────────────────────────────────────────────
    function buildIndexes() {
      _schoolMap = {}; _personMap = {}; _sessMap = {};

      // ── Session index ────────────────────────────────────────────────
      // Parse duration strings ("40 minutes", "1 hour", "1 hour 30 minutes") → integer minutes
      function parseDurationMins(s) {
        if (!s) return 0;
        s = s.toLowerCase();
        let m = 0;
        const h = s.match(/(\d+)\s*hour/);   if (h) m += parseInt(h[1]) * 60;
        const mn = s.match(/(\d+)\s*min/);   if (mn) m += parseInt(mn[1]);
        return m;
      }

      for (const r of _sessRows) {
        if (!r[SESS.SESS_ID]) continue;
        const sid = r[SESS.SESS_ID];
        const stuIds = (r[SESS.STU_IDS] || '').split(',').map(s => s.trim()).filter(Boolean);
        const ratio = stuIds.length;
        const sessAtt = r[SESS.ATTENDANCE] || '';
        // Delivered = Completed status (covers both "Attended" and "Partially Attended" att values)
        const isDelivered = r[SESS.STATUS] === 'Completed';
        const isPartial   = isDelivered && sessAtt === 'Partially Attended';
        const isFullAtt   = isDelivered && sessAtt === 'Attended';
        const durMins     = parseDurationMins(r[SESS.ACTUAL_DUR] || r[SESS.SCHED_DUR]);
        _sessMap[sid] = {
          id: sid, title: r[SESS.TITLE], instructor: r[SESS.INSTRUCTOR],
          instId: r[SESS.INST_ID], studentIds: stuIds,
          students: r[SESS.STUDENTS], location: r[SESS.LOCATION],
          status: r[SESS.STATUS], attendance: sessAtt,
          isDelivered, isPartial, isFullAtt,
          start: r[SESS.START], schedDur: r[SESS.SCHED_DUR],
          actualDur: r[SESS.ACTUAL_DUR], subject: r[SESS.SUBJECT],
          grade: r[SESS.GRADE], school: r[SESS.SCHOOL], district: r[SESS.DISTRICT],
          durMins, ratio,
          ratioFlag: ratio > 4,  // HIT: must be ≤ 4:1 (flag, MOU governs)
        };
      }

      // ── Student survey index by sessionId ────────────────────────────
      const stuSurveyBySess = {};
      for (const r of _stuRows) {
        const sid = r[STU_S.SESS_ID];
        if (!stuSurveyBySess[sid]) stuSurveyBySess[sid] = [];
        stuSurveyBySess[sid].push(r);
      }

      // ── Instructor survey index by sessionId ─────────────────────────
      const instSurveyBySess = {};
      for (const r of _instRows) {
        const sid = r[INST_S.SESS_ID];
        if (!instSurveyBySess[sid]) instSurveyBySess[sid] = [];
        instSurveyBySess[sid].push(r);
      }

      // ── Person index from attendance rows ────────────────────────────
      const personWeekSessions = {}; // userId → { week → attended count }

      for (const r of _attRows) {
        if (!r[ATT.USER_ID]) continue;
        const uid = r[ATT.USER_ID];
        const school = r[ATT.SCHOOL] || '';
        const district = r[ATT.DISTRICT] || '';
        const week = r[ATT.WEEK] || '';
        const cls = classifyRecord(r);
        const missReason = r[ATT.MISS_REASON] || '';

        if (!_personMap[uid]) {
          _personMap[uid] = {
            uid, name: r[ATT.USER] || uid, role: r[ATT.ROLE],
            school, district, grade: r[ATT.GRADE],
            sex: r[ATT.SEX], race: r[ATT.RACE],
            attended: 0, absent: 0, interruptions: 0, notRecorded: 0,
            totalRows: 0, indAttRate: r[ATT.IND_ATT_RATE] || '',
            consecStatus: r[ATT.CONSEC_STATUS] || '',
            vacantId: r[ATT.VACANT_ID] || '',
            rows: [],
            instructorIds: new Set(),  // non-sub instructor IDs (flat set for quick check)
            subjectTutors: {},          // { subject: { primary:{id:name}, subs:{id:name} } }
            subjectMinutes: {},         // { subject: totalMinutesDelivered }
            flags: [],
          };
        }
        const p = _personMap[uid];
        p.totalRows++;
        p.rows.push(r);
        if (cls === 'attended')             p.attended++;
        else if (cls === 'absent')          p.absent++;
        else if (cls === 'service_interruption') p.interruptions++;
        else if (cls === 'not_recorded')    p.notRecorded++;

        // Track weeks with attended sessions for HIT frequency check (students only)
        if (cls === 'attended' && r[ATT.ROLE] === 'Student') {
          if (!personWeekSessions[uid]) personWeekSessions[uid] = {};
          personWeekSessions[uid][week] = (personWeekSessions[uid][week] || 0) + 1;
        }

        // School aggregation
        if (!_schoolMap[school]) initSchool(school, district);
        const sc = _schoolMap[school];
        sc.rows.push(r);
        if (r[ATT.ROLE] === 'Student') {
          sc.totalStudentRows++;
          if (cls === 'attended')             sc.stuAttended++;
          else if (cls === 'absent')          sc.stuAbsent++;
          else if (cls === 'service_interruption') { sc.stuInterruptions++; sc.siReasons.push(missReason); }
          else if (cls === 'not_recorded')    sc.notRecorded++;
        } else {
          sc.totalInstRows++;
          if (cls === 'attended')             sc.instAttended++;
          else if (cls === 'absent')          sc.instAbsent++;
          else if (cls === 'service_interruption') sc.instInterruptions++;
        }
      }

      // ── Pre-compute valid tutor-scholar pairs ─────────────────────────
      // A tutor is only "assigned" to a scholar if at least ONE session together
      // is NOT Cancelled. If every session is Cancelled, the tutor was never
      // actually seen by that scholar (likely assigned by mistake) — exclude them.
      // validPairs: Set of "instId|stuId" strings
      const validPairs = new Set();
      for (const sess of Object.values(_sessMap)) {
        if (sess.status === 'Cancelled') continue; // skip fully-cancelled sessions
        if (!sess.instId) continue;
        for (const stuId of sess.studentIds) {
          validPairs.add(sess.instId + '|' + stuId);
        }
      }

      // ── Link sessions to schools and instructor IDs ───────────────────
      for (const sess of Object.values(_sessMap)) {
        if (!sess.school) continue;
        if (!_schoolMap[sess.school]) initSchool(sess.school, sess.district);
        const sc = _schoolMap[sess.school];
        sc.sessions.push(sess);

        // Track per-student: which instructors taught which subject + minutes received
        // Only link tutor→scholar when the pair has at least one non-cancelled session.
        // Substitutes (name contains "SUB") tracked separately.
        const isSub = (sess.instructor || '').toUpperCase().includes('SUB');
        const subj  = sess.subject || '';
        for (const stuId of sess.studentIds) {
          const p = _personMap[stuId]; if (!p) continue;
          // Skip if this tutor-scholar pair is entirely cancelled
          if (sess.instId && !validPairs.has(sess.instId + '|' + stuId)) continue;
          if (!p.subjectTutors[subj]) p.subjectTutors[subj] = { primary: {}, subs: {} };
          if (isSub) {
            p.subjectTutors[subj].subs[sess.instId]  = sess.instructor;
          } else {
            if (!isSub) p.instructorIds.add(sess.instId);
            p.subjectTutors[subj].primary[sess.instId] = sess.instructor;
          }
          // Accumulate delivered minutes per subject (Completed sessions only)
          if (sess.isDelivered && sess.durMins > 0) {
            p.subjectMinutes[subj] = (p.subjectMinutes[subj] || 0) + sess.durMins;
          }
        }
      }

      // ── Build HIT compliance flags per person ─────────────────────────
      for (const [uid, p] of Object.entries(_personMap)) {
        if (p.role === 'Student') {
          // Flag: consecutive attendance concern (from col Y - '10 consecutive sessions missed status')
          if (p.consecStatus === 'Attendance Concern')
            p.flags.push({ type:'consecutive', severity:'high', msg:'10+ consecutive sessions missed — attendance pattern worth reviewing' });

          // Flag: tutor continuity — subject-aware logic
          // Each subject should have exactly 1 primary tutor. Subs are expected, not flagged.
          // 1 subject + 1 primary = Normal. 2 subjects + 1 each = Normal.
          // Any subject with 2+ primary tutors = Continuity Issue.
          {
            const subjects = Object.keys(p.subjectTutors).filter(s => s);
            if (subjects.length >= 3) {
              p.flags.push({ type:'continuity', severity:'medium',
                msg: subjects.length + ' subjects on record — verify scheduling is intentional' });
            } else {
              const issues = subjects.filter(subj => {
                const st = p.subjectTutors[subj];
                return st && st.primary && Object.keys(st.primary).length > 1;
              });
              if (issues.length > 0) {
                const detail = issues.map(subj => {
                  const n = Object.keys((p.subjectTutors[subj] || {}).primary || {}).length;
                  return subj + ' (' + n + ' tutors)';
                }).join(', ');
                p.flags.push({ type:'continuity', severity:'medium',
                  msg: 'Instructor continuity concern: ' + detail + ' — 1 primary tutor per subject expected' });
              }
            }
          }

          // Flag: low attendance (< 70%)
          const total = p.attended + p.absent;
          if (total > 0 && (p.attended / total) < 0.70)
            p.flags.push({ type:'low_att', severity:'high', msg:`Attendance below 70% — area of support; verify ADP records (${Math.round(p.attended/total*100)}%)` });

          // Flag: vacancy — from col AC (Pearl Vacant User ID) and col AG (Vacancy Flag)
          // NOT counted in attendance — staffing gap flag for HR + Programming + Leadership
          if (p.vacantId)
            p.flags.push({ type:'vacancy', severity:'high', msg:'Tutor vacancy active — staffing gap; coordinate with HR and Programming on backfill' });

          // Flag: scholar declined sessions — counts as absent AND flags Program Team
          // Count how many of this scholar's rows are a decline
          const declineCount = p.rows.filter(r => (r[ATT.MISS_REASON] || '') === DECLINED_REASON).length;
          if (declineCount > 0)
            p.flags.push({
              type: 'declined', severity: declineCount >= 3 ? 'high' : 'medium',
              audience: 'Programming',
              msg: `Scholar declined ${declineCount} session${declineCount > 1 ? 's' : ''} — Program Team follow-up needed (engagement/re-enrollment review)`,
            });

          // Flag: weekly frequency
          if (personWeekSessions[uid]) {
            const belowMin = Object.values(personWeekSessions[uid]).filter(c => c < 2).length;
            const totalWeeks = Object.keys(personWeekSessions[uid]).length;
            if (belowMin > 0 && totalWeeks > 0)
              p.flags.push({ type:'frequency', severity:'medium', msg:`${belowMin} of ${totalWeeks} attended weeks below 2 sessions (HIT minimum)` });
          }
        }

        if (p.role === 'Instructor') {
          const total = p.attended + p.absent;
          if (total > 0 && (p.attended / total) < 0.80)
            p.flags.push({ type:'inst_att', severity:'high', msg:`Instructor attendance below 80% — area of support; verify ADP records (${Math.round(p.attended/total*100)}%)` });
        }
      }

      // ── Link survey data to persons ───────────────────────────────────
      // Student surveys: link by filledByID (student who responded)
      const stuSurveyByUser = {};
      for (const r of _stuRows) {
        const uid = r[STU_S.FILLED_BY_ID];
        if (!stuSurveyByUser[uid]) stuSurveyByUser[uid] = [];
        stuSurveyByUser[uid].push(r);
      }
      const instSurveyByUser = {};
      for (const r of _instRows) {
        const uid = r[INST_S.FILLED_BY_ID];
        if (!instSurveyByUser[uid]) instSurveyByUser[uid] = [];
        instSurveyByUser[uid].push(r);
      }
      for (const [uid, p] of Object.entries(_personMap)) {
        p.stuSurveys  = stuSurveyByUser[uid]  || [];
        p.instSurveys = instSurveyByUser[uid] || [];
      }

      // ── Per-tutor survey completion: match by Session ID ─────────────
      // Denominator: sessions this tutor led that were delivered with ≥1 scholar present.
      // Numerator:   those sessions that have a tutor survey where INST_S.SESS_ID matches.
      // This is the authoritative join — Session ID is the bridge between Pearl session
      // data and the tutor survey form response.
      const instSurvBySessId = {};
      for (const r of _instRows) {
        const sid = (r[INST_S.SESS_ID] || '').trim();
        if (!sid) continue;
        if (!instSurvBySessId[sid]) instSurvBySessId[sid] = [];
        instSurvBySessId[sid].push(r);
      }
      for (const [uid, p] of Object.entries(_personMap)) {
        if (p.role !== 'Instructor') continue;
        const eligSess = Object.values(_sessMap).filter(s =>
          s.instId === uid && s.isDelivered && s.studentIds && s.studentIds.length > 0
        );
        const submitted = eligSess.filter(s => instSurvBySessId[s.id] && instSurvBySessId[s.id].length > 0).length;
        p.surveyEligible  = eligSess.length;
        p.surveySubmitted = submitted;
        p.surveyCompRate  = eligSess.length > 0 ? Math.round(submitted / eligSess.length * 100) : null;
        // Store IDs of eligible sessions missing a survey (for drill-down display)
        p.surveyMissingSessIds = eligSess
          .filter(s => !instSurvBySessId[s.id] || instSurvBySessId[s.id].length === 0)
          .map(s => s.id);
      }

      // ── Build school survey aggregates ────────────────────────────────
      for (const [school, sc] of Object.entries(_schoolMap)) {
        // Student surveys
        const stuRows = _stuRows.filter(r => r[STU_S.SCHOOL] === school);
        // Use agg cache for per-school avg when stream is incomplete (consistency)
        if (_stuStreamComplete) {
          sc.stuSurveyAvg = avgSurvey(stuRows, [STU_S.CONFIDENCE, STU_S.ENJOYMENT, STU_S.LEARNING, STU_S.OVERALL]);
        } else if (_stuAggScores && _stuAggScores.bySchool && _stuAggScores.bySchool[school]) {
          sc.stuSurveyAvg = _stuAggScores.bySchool[school].avg || 0;
        } else {
          sc.stuSurveyAvg = avgSurvey(stuRows, [STU_S.CONFIDENCE, STU_S.ENJOYMENT, STU_S.LEARNING, STU_S.OVERALL]);
        }
        sc.stuSurveyRows = stuRows;
        // Instructor surveys
        const instRows = _instRows.filter(r => r[INST_S.SCHOOL] === school);
        sc.instSurveyAvg = avgSurvey(instRows, [INST_S.ENGAGEMENT, INST_S.ENJOYMENT, INST_S.LEARNING, INST_S.OVERALL]);
        sc.instSurveyRows = instRows;

        // School-level tutor survey completion rate (aggregated from per-tutor)
        const schoolTutors = Object.values(_personMap).filter(p => p.role === 'Instructor' && p.school === school);
        const scElig = schoolTutors.reduce((s, p) => s + (p.surveyEligible || 0), 0);
        const scSub  = schoolTutors.reduce((s, p) => s + (p.surveySubmitted || 0), 0);
        sc.tutorSurvEligible  = scElig;
        sc.tutorSurvSubmitted = scSub;
        sc.tutorSurvCompRate  = scElig > 0 ? Math.round(scSub / scElig * 100) : null;

        // School-level HIT flags
        sc.ratioViolations = sc.sessions.filter(s => s.ratioFlag).length;
        if (sc.ratioViolations > 0)
          sc.flags.push({ type:'ratio', severity:'medium', msg:`${sc.ratioViolations} sessions exceed 1:4 ratio — check MOU` });
        const criticalSI  = sc.siReasons.filter(r => getSISeverity(r) === 'critical').length;
        const vacancySI   = sc.siReasons.filter(r => r === 'Tutor Vacancy').length;
        const otherHighSI = sc.siReasons.filter(r => getSISeverity(r) === 'high' && r !== 'Tutor Vacancy').length;
        if (criticalSI > 0)
          sc.flags.push({ type:'critical_si', severity:'critical', msg:`${criticalSI} NJTC Internal Issues flagged for review — context needed` });
        if (vacancySI > 0)
          // Vacancy is NOT counted in attendance — it is a staffing gap flag for HR, Programming, and Leadership
          sc.flags.push({ type:'vacancy_si', severity:'high', audience:'HR · Programming · Leadership', msg:`${vacancySI} sessions impacted by tutor vacancy — backfill coordination recommended` });
        if (otherHighSI > 0)
          sc.flags.push({ type:'high_si', severity:'high', msg:`${otherHighSI} high-priority interruptions (closures / archived scholars) — further context recommended` });

        // Declined sessions: count across all student rows for this school
        // Declines count as absences in attendance AND surface to Programming
        const declinedCount = sc.rows.filter(r => r[ATT.ROLE] === 'Student' && (r[ATT.MISS_REASON] || '') === DECLINED_REASON).length;
        if (declinedCount > 0)
          sc.flags.push({ type:'declined', severity: declinedCount >= 5 ? 'high' : 'medium', audience:'Programming', msg:`${declinedCount} scholar-declined session${declinedCount > 1 ? 's' : ''} — worth exploring engagement strategies with the Program Team` });

        // CT-request flag: if teacher pull-outs exceed 10% of student sessions at this school,
        // flag for partner/school-level conversation (counts against scholar attendance but
        // reflects a school-side pattern that warrants discussion)
        const CT_REASON = 'Classroom Teacher Requested to Keep Scholar in Class';
        const CT_REASON2 = 'HADDON TWP ONLY -- Teacher requested whole group support';
        // CT denominator = explicit scholar-caused reasons only (no blanks)
        // sc.stuAbsent includes blanks for attendance rate purposes, but CT% excludes them
        const ctDenominator = sc.rows.filter(r =>
          r[ATT.ROLE] === 'Student' &&
          (r[ATT.ATT_STATUS] || '') === 'Missed' &&
          SCHOLAR_MISS_REASONS.has(r[ATT.MISS_REASON] || '')
        ).length;
        const ctCount = sc.rows.filter(r => r[ATT.ROLE] === 'Student' &&
          (r[ATT.MISS_REASON] === CT_REASON || r[ATT.MISS_REASON] === CT_REASON2)).length;
        if (ctDenominator > 0 && ctCount / ctDenominator > 0.10)
          sc.flags.push({ type:'ct_pull', severity:'medium', audience:'Programming · Leadership',
            msg: `Teacher pull-outs account for ${Math.round(ctCount/ctDenominator*100)}% of scholar-caused absences (${ctCount} of ${ctDenominator}) — exceeds 10% threshold, school-level conversation recommended` });

        // Attendance rate: scholar-caused denominator only (not SI)
        // stuAbsent = scholar-caused misses; stuInterruptions = SI (excluded)
        sc.attRate = (sc.stuAttended + sc.stuAbsent) > 0
          ? Math.round(sc.stuAttended / (sc.stuAttended + sc.stuAbsent) * 100) : 0;
      }

      // Update global flags badge
      updateFlagsBadge();
      _notifyLeadershipReady();
    }

    function initSchool(school, district) {
      _schoolMap[school] = {
        school, district, rows: [],
        totalStudentRows: 0, stuAttended: 0, stuAbsent: 0, stuInterruptions: 0, notRecorded: 0,
        totalInstRows: 0, instAttended: 0, instAbsent: 0, instInterruptions: 0,
        sessions: [], siReasons: [], flags: [],
        stuSurveyAvg: 0, instSurveyAvg: 0, stuSurveyRows: [], instSurveyRows: [],
        tutorSurvCompRate: null, tutorSurvEligible: 0, tutorSurvSubmitted: 0,
        attRate: 0, ratioViolations: 0,
      };
    }

    function avgSurvey(rows, cols) {
      let sum = 0, cnt = 0;
      for (const r of rows) {
        for (const c of cols) {
          const v = parseFloat(r[c]);
          if (!isNaN(v)) { sum += v; cnt++; }
        }
      }
      return cnt > 0 ? (sum / cnt) : 0;
    }

    // ── FILTERS ───────────────────────────────────────────────────────────
    function applyFilters() {
      _filtDistrict = getFilterSelected('district');
      _filtSchool   = getFilterSelected('school');
      _filtWeek     = getFilterSelected('week');
      _filtRole     = getFilterSelected('role');
      _filtFlag     = getFilterSelected('flag');
      // Changing any filter while in a drill view resets to the list — the new filter
      // defines a different scope and the drilled school/person may no longer be relevant.
      if (_view === 'school' || _view === 'person') {
        _view = 'schools';
        _selSchool = null;
      }
      // If exactly one school selected and on schools view, drill into it
      if (_filtSchool.length === 1 && _view === 'schools') { drillSchool(_filtSchool[0]); return; }
      updateFilterInfo();
      renderView();
    }

    function updateFilterInfo() {
      const total = _attRows.length;
      const filtered = filteredAttRows().length;
      const el = document.getElementById('poFilterInfo');
      const hasFilter = _filtDistrict.length || _filtSchool.length || _filtWeek.length || _filtRole.length || _filtFlag.length || _poGlobalQ;
      if (el) el.textContent = hasFilter ? `${filtered.toLocaleString()} of ${total.toLocaleString()} records match` : '';
    }

    function _globalSearch(q) {
      _poGlobalQ = (q||'').trim();
      renderView();
    }

    function clearFilters() {
      ['district','school','week','role','flag'].forEach(k => {
        if (_msState[k]) { _msState[k].selected = []; _msState[k].search = ''; }
      });
      _filtDistrict = []; _filtSchool = []; _filtWeek = []; _filtRole = []; _filtFlag = [];
      populateFilters(); // re-render widgets
      renderView();
    }

    function populateFilters() {
      // Districts
      const districts = [...new Set(_attRows.map(r => r[ATT.DISTRICT]).filter(Boolean))].sort();
      buildMultiSelect({
        wrapperId: 'mswDistrict', label: 'Districts', stateKey: 'district',
        options: districts.map(v => ({ value: v, label: v }))
      });

      // Schools
      const schools = [...new Set(_attRows.map(r => r[ATT.SCHOOL]).filter(Boolean))].sort();
      buildMultiSelect({
        wrapperId: 'mswSchool', label: 'Schools', stateKey: 'school',
        options: schools.map(v => ({ value: v, label: v }))
      });

      // Weeks (sorted numerically)
      const weeks = [...new Set(_attRows.map(r => r[ATT.WEEK]).filter(Boolean))]
        .sort((a,b) => parseInt(a.replace('Week ','')) - parseInt(b.replace('Week ','')));
      buildMultiSelect({
        wrapperId: 'mswWeek', label: 'Weeks', stateKey: 'week',
        options: weeks.map(v => ({ value: v, label: v }))
      });

      // Roles (static)
      buildMultiSelect({
        wrapperId: 'mswRole', label: 'Roles', stateKey: 'role',
        staticOptions: [{ value: 'Student', label: 'Student' }, { value: 'Instructor', label: 'Instructor' }],
        options: []
      });

      // Flags (static)
      buildMultiSelect({
        wrapperId: 'mswFlag', label: 'Record Type', stateKey: 'flag',
        staticOptions: [
          { value: 'hit',     label: 'HIT Flags Only' },
          { value: 'si',      label: 'Service Interruptions' },
          { value: 'concern', label: 'Attendance Concern' }
        ],
        options: []
      });
    }

    // ── STATS ─────────────────────────────────────────────────────────────
    function updateStats() {
      const rows = filteredAttRows();

      // ── Scholar attendance ─────────────────────────────────────────
      // Always calculated from ALL scholar rows matching school/district/week filters
      // (not the role filter, so it shows even when Instructor is selected)
      const allScholarRows = _attRows.filter(r => {
        if (r[ATT.ROLE] !== 'Student') return false;
        if (!matchesSchoolFilter(r[ATT.SCHOOL], r[ATT.DISTRICT])) return false;
        if (_filtWeek.length && !_filtWeek.includes(r[ATT.WEEK])) return false;
        return true;
      });
      const stuAtt  = allScholarRows.filter(r => classifyRecord(r) === 'attended').length;
      const stuAbs  = allScholarRows.filter(r => classifyRecord(r) === 'absent').length;
      const stuTotal = stuAtt + stuAbs;
      const stuAttPct = stuTotal > 0 ? (stuAtt / stuTotal * 100).toFixed(1) + '%' : '—';

      // ── Tutor attendance ───────────────────────────────────────────
      // Always calculated from ALL instructor rows matching school/district/week filters
      const allInstRows = _attRows.filter(r => {
        if (r[ATT.ROLE] !== 'Instructor') return false;
        if (!matchesSchoolFilter(r[ATT.SCHOOL], r[ATT.DISTRICT])) return false;
        if (_filtWeek.length && !_filtWeek.includes(r[ATT.WEEK])) return false;
        return true;
      });
      const instAtt  = allInstRows.filter(r => classifyRecord(r) === 'attended').length;
      const instAbs  = allInstRows.filter(r => classifyRecord(r) === 'absent').length;
      const instTotal = instAtt + instAbs;
      const instAttPct = instTotal > 0 ? (instAtt / instTotal * 100).toFixed(1) + '%' : '—';

      // ── Service interruptions (student rows only for display) ──────
      const si = allScholarRows.filter(r => classifyRecord(r) === 'service_interruption').length;

      // ── Sessions ───────────────────────────────────────────────────
      const filtSess   = filteredSessions();
      const fullAtt    = filtSess.filter(s => s.isFullAtt).length;
      const partial    = filtSess.filter(s => s.isPartial).length;
      const delivered  = fullAtt + partial;   // Completed = Attended + Partially Attended
      const totalSess  = filtSess.filter(s => s.status && s.status !== '' && s.status !== 'Scheduled').length;

      // ── Scheduled-but-not-completed sessions (program watchpoint) ─
      // BUSINESS RULE: Sessions with status 'Scheduled' are future-pending or overdue.
      // These are not counted in delivered totals but are surfaced as a watchpoint.
      const scheduledIncomplete = filtSess.filter(s => s.status === 'Scheduled').length;

      // ── Scholar survey avg ──────────────────────────────────────────────
      // SOURCE PRIORITY:
      // 1. If stream is complete (_stuStreamComplete=true): compute from full _stuRows
      // 2. If stream is in progress but we have cached agg scores: use _stuAggScores
      //    (scores from the LAST complete run — guaranteed consistent across all depts)
      // 3. No data at all: show '—'
      // This prevents mid-stream partial averages from showing different scores per dept.
      let stuSurvAvg = '—';
      if (_stuStreamComplete && _stuRows.length) {
        // Full data available — compute from rows (school filter applied)
        const stuSurvRows = _stuRows.filter(r => matchesSchoolFilter(r[STU_S.SCHOOL], r[STU_S.DISTRICT]));
        const stuSurvScores = [];
        for (const r of stuSurvRows) {
          [STU_S.CONFIDENCE, STU_S.ENJOYMENT, STU_S.LEARNING, STU_S.OVERALL].forEach(c => {
            const v = parseFloat(r[c]); if (!isNaN(v) && v > 0) stuSurvScores.push(v);
          });
        }
        if (stuSurvScores.length)
          stuSurvAvg = (stuSurvScores.reduce((a,b)=>a+b,0)/stuSurvScores.length).toFixed(2);
      } else if (_stuAggScores) {
        // Stream in progress or just starting — use last complete run's scores
        // Apply school filter against the cached bySchool map
        // Pearl uses _filtSchool[] and _filtDistrict[] arrays (NOT _activeFilters)
        const _noSchoolFilter = !_filtSchool.length && !_filtDistrict.length;
        if (_noSchoolFilter) {
          // Global avg — most common case (no school/district filter active)
          const { globalSum, globalCnt } = _stuAggScores;
          if (globalCnt > 0) stuSurvAvg = (globalSum / globalCnt).toFixed(2);
        } else {
          // School-filtered: sum only matching schools from bySchool cache
          let fSum = 0, fCnt = 0;
          for (const [school, sc] of Object.entries(_stuAggScores.bySchool || {})) {
            if (matchesSchoolFilter(school, (sc && sc.district) || '')) {
              fSum += (sc.avg || 0) * (sc.cnt || 0);
              fCnt += (sc.cnt || 0);
            }
          }
          if (fCnt > 0) stuSurvAvg = (fSum / fCnt).toFixed(2);
        }
      }

      // ── Tutor survey avg (from instructor survey rows, filtered by school) ──
      // BUSINESS RULE (CRITICAL): Tutor survey only populates when at least one scholar
      // attended a session. Sessions with no scholars present (tutor-only rows) are NOT
      // eligible and must be EXCLUDED from the denominator to avoid inflating/deflating rate.
      // Eligible sessions = delivered (Completed) AND studentIds.length > 0.
      // The instSurvRows already represent submitted surveys; filtering them by school is correct.
      // We annotate here for clarity — the instSurvBySess join below enforces the scholar-presence rule.
      const instSurvRows = _instRows.filter(r => matchesSchoolFilter(r[INST_S.SCHOOL], r[INST_S.DISTRICT]));

      // Build a set of eligible session IDs (delivered + at least 1 scholar) for denominator use
      const eligibleSessIds = new Set(
        Object.values(_sessMap)
          .filter(s => s.isDelivered && s.studentIds && s.studentIds.length > 0
                    && matchesSchoolFilter(s.school, s.district))
          .map(s => s.id || s.sessId || s.sessionId)
          .filter(Boolean)
      );
      // NOTE: The instSurvRows average itself is score-based (not a completion-rate pct),
      // so it's not directly affected by the denominator issue. The denominator fix matters
      // when computing survey completion RATE (submitted/eligible). Surfaced below as instSurvCompRate.
      const instSurvEligibleCount = eligibleSessIds.size;
      const instSurvScores = [];
      for (const r of instSurvRows) {
        [INST_S.ENGAGEMENT, INST_S.ENJOYMENT, INST_S.LEARNING, INST_S.OVERALL].forEach(c => {
          const v = parseFloat(r[c]); if (!isNaN(v) && v > 0) instSurvScores.push(v);
        });
      }
      const instSurvAvg = instSurvScores.length
        ? (instSurvScores.reduce((a,b)=>a+b,0)/instSurvScores.length).toFixed(2)
        : '—';
      // Tutor survey completion rate: submitted surveys / eligible sessions (scholar-present only)
      const instSurvCompRate = instSurvEligibleCount > 0
        ? Math.round(instSurvRows.length / instSurvEligibleCount * 100) + '%'
        : '—';

      // ── HIT flags (school-filtered) ────────────────────────────────
      let hitFlags = 0;
      for (const p of Object.values(_personMap)) {
        if (matchesSchoolFilter(p.school, p.district)) hitFlags += p.flags.length;
      }

      setText('poStatAtt',           stuAttPct);
      setText('poStatInstAtt',       instAttPct);
      setText('poStatSessions',      delivered.toLocaleString());
      setText('poStatSessionsSub',   `${fullAtt.toLocaleString()} full · ${partial.toLocaleString()} partial · of ${totalSess.toLocaleString()}`);
      setText('poStatInterruptions', si.toLocaleString());
      setText('poStatSurveyScholar', stuSurvAvg === '—' ? '—' : '★ ' + stuSurvAvg);
      setText('poStatSurveyTutor',   instSurvAvg === '—' ? '—' : '★ ' + instSurvAvg);
      // Show tutor survey completion rate in the sub-label (corrected denominator: eligible sessions only)
      const _tuSurvSubEl = document.getElementById('poStatSurveyTutorSub');
      if (_tuSurvSubEl) {
        _tuSurvSubEl.textContent = instSurvCompRate !== '—'
          ? `${instSurvCompRate} completion · ${instSurvEligibleCount} eligible`
          : 'Engagement · Quality · Overall';
      }
      // Scheduled-but-not-completed sessions (program watchpoint)
      setText('poStatSchedIncomplete', scheduledIncomplete.toLocaleString());
      if (scheduledIncomplete > 0) {
        const scTile = document.getElementById('poStatSchedIncomplete');
        if (scTile) scTile.closest('.stat-tile').style.setProperty('--accent-color', scheduledIncomplete > 10 ? '#ef4444' : 'var(--gold)');
      }
      setText('poStatFlags',         hitFlags.toLocaleString());
    }

    // ── FLAG CLEARING STORAGE ─────────────────────────────────────────────
    // Cleared flag state is written to BOTH localStorage (fast sync) AND IndexedDB
    // (persistent — survives "clear history" and localStorage wipes). On every page
    // load the IDB copy is merged back into localStorage so the cleared state is
    // always available to the sync rendering path.
    const _FLAG_CLEAR_KEY  = 'njtc_cleared_flags_v2';  // v2 — now stores clearedMsg
    const _FLAG_SEEN_KEY   = 'njtc_flag_seen_v1';      // firstSeenAt timestamp per key
    const _FLAG_IDB_NAME   = 'njtc_pearl_flags';
    const _FLAG_IDB_STORE  = 'kv';
    const _FLAG_IDB_VER    = 1;

    const _FLAG_CLEAR_REASONS = [
      'N/A',
      'Discussed in Context to Data',
      'Internal discrepancy',
      'Onsite staff clarification',
      'Program Team or Data Department override',
    ];

    // ── IndexedDB helpers (persistent across localStorage wipes) ─────────
    function _flagIdbOpen() {
      return new Promise(function(res, rej) {
        try {
          const req = indexedDB.open(_FLAG_IDB_NAME, _FLAG_IDB_VER);
          req.onupgradeneeded = function(e) { e.target.result.createObjectStore(_FLAG_IDB_STORE); };
          req.onsuccess = function(e) { res(e.target.result); };
          req.onerror   = function() { rej(req.error); };
        } catch(e) { rej(e); }
      });
    }
    async function _flagIdbGet(key) {
      try {
        const db = await _flagIdbOpen();
        return await new Promise(function(res) {
          const req = db.transaction(_FLAG_IDB_STORE,'readonly').objectStore(_FLAG_IDB_STORE).get(key);
          req.onsuccess = function() { res(req.result || null); };
          req.onerror   = function() { res(null); };
        });
      } catch(e) { return null; }
    }
    async function _flagIdbPut(key, val) {
      try {
        const db = await _flagIdbOpen();
        await new Promise(function(res) {
          const tx = db.transaction(_FLAG_IDB_STORE,'readwrite');
          tx.objectStore(_FLAG_IDB_STORE).put(val, key);
          tx.oncomplete = res; tx.onerror = res;
        });
      } catch(e) {}
    }

    // ── localStorage helpers (fast synchronous reads for rendering) ───────
    function _getClearedFlags()  { try { return JSON.parse(localStorage.getItem(_FLAG_CLEAR_KEY)||'{}'); } catch(e) { return {}; } }
    function _saveToLocal(data)  { try { localStorage.setItem(_FLAG_CLEAR_KEY, JSON.stringify(data)); } catch(e) {} }

    // Primary save: writes to localStorage immediately + IDB asynchronously
    function _saveClearedFlags(data) {
      _saveToLocal(data);
      _flagIdbPut('cleared', data); // async fire-and-forget — ensures persistence
    }

    // On page load: merge any IDB state back into localStorage (handles localStorage wipes)
    async function _restoreClearedFromIdb() {
      const idbData = await _flagIdbGet('cleared');
      if (!idbData || !Object.keys(idbData).length) return;
      const merged = Object.assign({}, _getClearedFlags(), idbData); // IDB wins on conflict
      _saveToLocal(merged);
    }

    // ── "First seen" tracking — records when each flagKey was first observed ──
    function _flagGetFirstSeen() { try { return JSON.parse(localStorage.getItem(_FLAG_SEEN_KEY)||'{}'); } catch(e) { return {}; } }
    function _flagMarkFirstSeen(key) {
      const seen = _flagGetFirstSeen();
      if (seen[key]) return;
      seen[key] = Date.now();
      try { localStorage.setItem(_FLAG_SEEN_KEY, JSON.stringify(seen)); } catch(e) {}
    }
    function _flagActiveDays(key) {
      const seen = _flagGetFirstSeen();
      if (!seen[key]) return null;
      return Math.max(1, Math.round((Date.now() - seen[key]) / 86400000));
    }

    // Global helpers called from inline onclick in modal HTML
    window._poFlagToggleClear = function(i) {
      const el = document.getElementById('pfcp_' + i);
      if (el) el.style.display = el.style.display === 'none' ? '' : 'none';
    };
    window._poFlagConfirmClear = function(i, dept) {
      const el = document.getElementById('pfcp_' + i);
      if (!el) return;
      const checked = Array.from(el.querySelectorAll('input[type="checkbox"]:checked')).map(function(cb){ return cb.dataset.reason; });
      if (!checked.length) { alert('Please select at least one reason before confirming.'); return; }
      const flagKey = (window._poFlagKeys || [])[i];
      if (!flagKey) return;
      const data = _getClearedFlags();
      // Store clearedMsg so we can detect if the underlying flag data changes later
      data[flagKey] = { reasons: checked, clearedAt: Date.now(), clearedBy: dept, clearedMsg: (window._poFlagMsgs || [])[i] || '' };
      _saveClearedFlags(data);
      updateFlagsBadge();
      openFlagsModal(_lastFlagFilter || 'critical');
    };
    window._poFlagRestore = function(i) {
      const flagKey = (window._poFlagKeys || [])[i];
      if (!flagKey) return;
      const data = _getClearedFlags();
      delete data[flagKey];
      _saveClearedFlags(data);
      updateFlagsBadge();
      openFlagsModal(_lastFlagFilter || 'critical');
    };
    let _lastFlagFilter = 'critical';

    function updateFlagsBadge() {
      const cleared = _getClearedFlags();
      // Record first-seen timestamp for every active school-level flag
      for (const [school, sc] of Object.entries(_schoolMap)) {
        for (const f of sc.flags) _flagMarkFirstSeen(school + '::' + f.type);
      }
      // School-level critical flags, excluding any that have been cleared
      const schoolCritCount = Object.entries(_schoolMap)
        .flatMap(function([school, sc]){ return sc.flags.map(function(f){ return Object.assign({}, f, {school: school}); }); })
        .filter(function(f){ return f.severity === 'critical' && !cleared[f.school + '::' + f.type]; }).length;
      const personCritCount = Object.values(_personMap)
        .flatMap(function(p){ return (p.flags || []); })
        .filter(function(f){ return f.severity === 'critical'; }).length;
      const critCount = schoolCritCount + personCritCount;

      const totalFlags = Object.values(_schoolMap).flatMap(function(sc){ return sc.flags; }).length
        + Object.values(_personMap).flatMap(function(p){ return p.flags || []; }).length;

      const badge = document.getElementById('pearlFlagsBadge');
      if (badge) {
        badge.style.display = totalFlags > 0 ? '' : 'none';
        badge.textContent = totalFlags;
      }
      const critBtn = document.getElementById('poCriticalBtn');
      if (critBtn) {
        critBtn.style.display = critCount > 0 ? '' : 'none';
        setText('poCriticalN', critCount);
      }
    }

    // ── FILTERED DATA HELPERS ─────────────────────────────────────────────
    function matchesSchoolFilter(school, district) {
      if (_filtDistrict.length && !_filtDistrict.includes(district)) return false;
      if (_filtSchool.length   && !_filtSchool.includes(school))     return false;
      return true;
    }

    // ── Late survey filers helper ─────────────────────────────────────────
    // Returns per-tutor late survey stats for the current school/district filter.
    // "Late" = survey DATE is strictly after the session date (date-only comparison).
    // A tutor is "flagged" if ≥50% of their submitted surveys are late.
    // Uses Session ID as the primary link between survey row and session.
    // School/district are derived from the SESSION record, not _personMap, so the
    // alert is always attributed to the location where the sessions/surveys live.
    function computeTutorLateFilersStats() {
      const TUTR_ELIG_SET = new Set(['Attended', 'Partially Attended']);
      function _toYMD(val) {
        if (!val) return '';
        const s = String(val).trim();
        const mdy = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
        if (mdy) return mdy[3] + '-' + mdy[1].padStart(2,'0') + '-' + mdy[2].padStart(2,'0');
        const iso = s.match(/^(\d{4}-\d{2}-\d{2})/);
        return iso ? iso[1] : '';
      }
      // eligMap carries school/district from the session — the authoritative location
      const eligMap        = {};  // instId|sessId → { sessYMD, school, district }
      const submByUid      = {};
      const lateByUid      = {};
      // Track session-school votes per uid so the displayed school reflects where the
      // sessions/surveys are assigned, not where the person appeared in attendance data.
      const schoolVoteByUid = {};  // uid → { 'school|district' → { school, district, count } }

      for (const sess of Object.values(_sessMap || {})) {
        if (!(sess.isFullAtt || sess.isPartial)) continue;
        if (!TUTR_ELIG_SET.has(sess.attendance)) continue;
        if (!sess.instId || !sess.id) continue;
        if (!matchesSchoolFilter(sess.school, sess.district)) continue;
        eligMap[sess.instId + '|' + sess.id] = {
          sessYMD:  _toYMD(sess.start),
          school:   sess.school   || '',
          district: sess.district || '',
        };
      }
      for (const r of (_instRows || [])) {
        if (!matchesSchoolFilter(r[INST_S.SCHOOL], r[INST_S.DISTRICT])) continue;
        const uid    = r[INST_S.FILLED_BY_ID];
        const sessId = r[INST_S.SESS_ID];
        if (!uid || !sessId) continue;
        const slot = eligMap[uid + '|' + sessId];
        if (!slot) continue;
        submByUid[uid] = (submByUid[uid] || 0) + 1;
        // Vote for the session's school/district (not the survey row's school)
        if (!schoolVoteByUid[uid]) schoolVoteByUid[uid] = {};
        const vk = slot.school + '|' + slot.district;
        if (!schoolVoteByUid[uid][vk]) schoolVoteByUid[uid][vk] = { school: slot.school, district: slot.district, count: 0 };
        schoolVoteByUid[uid][vk].count++;
        const survYMD = _toYMD(r[INST_S.DATE]);
        if (survYMD && slot.sessYMD && survYMD > slot.sessYMD) {
          lateByUid[uid] = (lateByUid[uid] || 0) + 1;
        }
      }
      const flagged = [];
      for (const [uid, subm] of Object.entries(submByUid)) {
        const late     = lateByUid[uid] || 0;
        const lateRate = Math.round(late / subm * 100);
        if (lateRate < 50) continue;
        const p = (_personMap || {})[uid];
        if (!p || p.role !== 'Instructor') continue;
        // Resolve school/district from session-vote majority, NOT from personMap
        const votes    = Object.values(schoolVoteByUid[uid] || {}).sort((a, b) => b.count - a.count);
        const school   = votes.length ? votes[0].school   : (p.school   || '');
        const district = votes.length ? votes[0].district : (p.district || '');
        flagged.push({ uid, name: p.name || uid, school, district, submitted: subm, late, lateRate });
      }
      flagged.sort((a, b) => b.lateRate - a.lateRate);
      const totalLate = Object.values(lateByUid).reduce((a, b) => a + b, 0);
      return { flagged, totalLate, totalFlagged: flagged.length };
    }

    function filteredAttRows() {
      return _attRows.filter(r => {
        if (!matchesSchoolFilter(r[ATT.SCHOOL], r[ATT.DISTRICT])) return false;
        if (_filtWeek.length && !_filtWeek.includes(r[ATT.WEEK])) return false;
        if (_filtRole.length && !_filtRole.includes(r[ATT.ROLE])) return false;
        if (_filtFlag.length) {
          // OR logic across flag types
          let flagMatch = false;
          if (_filtFlag.includes('hit')) { const p = _personMap[r[ATT.USER_ID]]; if (p && p.flags && p.flags.length > 0) flagMatch = true; }
          if (_filtFlag.includes('si') && classifyRecord(r) === 'service_interruption') flagMatch = true;
          if (_filtFlag.includes('concern') && r[ATT.CONSEC_STATUS] === 'Attendance Concern') flagMatch = true;
          if (!flagMatch) return false;
        }
        return true;
      });
    }

    function filteredSessions() {
      return Object.values(_sessMap).filter(s =>
        matchesSchoolFilter(s.school, s.district)
      );
    }

    function filteredSchools() {
      const q = (_poGlobalQ||'').toLowerCase().trim();
      return Object.values(_schoolMap).filter(sc => {
        if (_filtDistrict.length && !_filtDistrict.includes(sc.district)) return false;
        if (_filtSchool.length   && !_filtSchool.includes(sc.school))     return false;
        if (q) {
          const hay = ((sc.school||'') + ' ' + (sc.district||'')).toLowerCase();
          // Also match if any instructor at this school has a name containing the query
          const hasTutorMatch = Object.values(_personMap).some(p =>
            p.role === 'Instructor' && p.school === sc.school &&
            (p.name||'').toLowerCase().includes(q)
          );
          if (!hay.includes(q) && !hasTutorMatch) return false;
        }
        return true;
      });
    }

    // Returns instructors whose name matches the global search query (for quick-find panel)
    function searchMatchedTutors() {
      const q = (_poGlobalQ||'').toLowerCase().trim();
      if (!q || q.length < 2) return [];
      return Object.values(_personMap).filter(p =>
        p.role === 'Instructor' && (p.name||'').toLowerCase().includes(q) &&
        (!_filtDistrict.length || _filtDistrict.includes(p.district)) &&
        (!_filtSchool.length   || _filtSchool.includes(p.school))
      ).slice(0, 12);
    }

    // ── VIEW ROUTER ───────────────────────────────────────────────────────
    function renderView() {
      updateStats();
      updateDurationPill();
      if (_view === 'schools') {
        if (role() === 'kb')              renderKBVanityView();
        else if (role() === 'leadership') renderLeadershipView();
        else if (role() === 'data')       renderDataOpsView();
        else if (role() === 'hr')         renderHRView();
        else if (role() === 'finance')    renderFinanceView();
        else                              renderSchoolGrid();
      }
      else if (_view === 'school')     renderSchoolDetail();
      else if (_view === 'person')     renderPersonDetail();
    }

    function updateDurationPill() {
      const pill = document.getElementById('poDurationPill');
      if (!pill) return;
      const sess = filteredSessions().filter(s => s.isDelivered && s.durMins > 0);
      if (!sess.length) { pill.style.display = 'none'; return; }
      const totalMins = sess.reduce((s, r) => s + r.durMins, 0);
      const hrs = Math.floor(totalMins / 60);
      const mins = totalMins % 60;
      const durStr = hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`;
      const scholars = new Set(sess.flatMap(s => (s.studentIds || []))).size;
      pill.style.display = 'block';
      pill.textContent = `⏱ ${durStr} · ${sess.length} sessions · ${scholars} scholars`;
    }

    // ── Section toggle helper — used by sg-* dashboard collapse/expand ────
    // id: the body element's id. btn: the header element that was clicked.
    // labelCollapsed / labelExpanded: text to set on btn's first <span>.
    function toggleSection(id, btn, labelCollapsed, labelExpanded) {
      const el = document.getElementById(id); if (!el) return;
      const isHidden = el.style.display === 'none';
      el.style.display = isHidden ? '' : 'none';
      if (btn) {
        const span = btn.querySelector ? btn.querySelector('span') : null;
        if (span) span.textContent = isHidden ? labelExpanded : labelCollapsed;
      }
    }

    function drillSchool(school) {
      _selSchool = school; _view = 'school'; _activeTab = 'attendance';
      const schoolObj = _schoolMap[school];
      if (schoolObj) {
        const selSchool = document.getElementById('poFSchool');
        if (selSchool) selSchool.value = school;
      }
      renderBreadcrumb();
      renderView();
    }

    function drillPerson(uid) {
      _selPerson = uid; _view = 'person'; _activeTab = 'attendance';
      renderBreadcrumb();
      renderView();
    }

    function goBack() {
      if (_view === 'person') { _view = 'school'; _selPerson = null; }
      else if (_view === 'school') { _view = 'schools'; _selSchool = null; const el = document.getElementById('poFSchool'); if(el) el.value=''; }
      renderBreadcrumb();
      renderView();
    }

    function renderBreadcrumb() {
      const el = document.getElementById('poBreadcrumb');
      if (!el) return;
      const parts = [`<a onclick="po.goBack()">All Schools</a>`];
      if (_selSchool) parts.push(`<span class="po-breadcrumb-sep">›</span> <a onclick="po.goBack()">${_selSchool}</a>`);
      if (_selPerson && _view === 'person') {
        const p = _personMap[_selPerson];
        const nm = canSeeNames() ? (p ? p.name : _selPerson) : 'Individual';
        parts.push(`<span class="po-breadcrumb-sep">›</span> <span style="color:var(--navy)">${nm}</span>`);
      }
      el.innerHTML = parts.join(' ');
      el.style.display = _view === 'schools' ? 'none' : 'flex';
    }

    // ── KB EXECUTIVE VANITY VIEW ──────────────────────────────────────────
    function renderKBVanityView() {
      const mc = document.getElementById('poMainContent'); if (!mc) return;
      const d = getLeadershipData();
      if (!d) { mc.innerHTML = '<div class="po-exec-empty">⏳ Loading program data…</div>'; return; }

      const totalScholars = d.scholarOnTrack + d.scholarAtRisk + d.scholarNeedsAction;
      const onTrackPct  = totalScholars > 0 ? Math.round(d.scholarOnTrack / totalScholars * 100) : 0;
      const momentumPct = totalScholars > 0 ? Math.round(d.scholarAtRisk / totalScholars * 100) : 0;
      const checkInPct  = totalScholars > 0 ? Math.round(d.scholarNeedsAction / totalScholars * 100) : 0;

      // Soften the banner language for KB
      const overallStrong = d.scholarRate >= 80 && d.tutorRate >= 90;
      const overallGrowing = d.scholarRate >= 75;
      const bannerClass = overallStrong ? 'green' : overallGrowing ? 'amber' : 'amber';
      const bannerIcon = overallStrong ? '🌟' : '📈';
      const bannerTitle = overallStrong ? 'Program Momentum is Strong' : 'Program is Growing — Continued Focus Ahead';
      const bannerSub = overallStrong
        ? `Scholar engagement at ${d.scholarRate}% with ${d.sessionsDelivered} sessions delivered across all sites.`
        : `Scholar engagement at ${d.scholarRate}%. A few areas are worth a closer look — details below.`;

      // Trend chart
      const trend = (d.weeklyTrend || []).slice(-12);
      const trendBars = trend.map(w => {
        const h = Math.round((w.rate / 100) * 60);
        const col = w.rate >= 80 ? '#0d6e3a' : w.rate >= 70 ? '#d97706' : '#e07a2f';
        return `<div class="po-exec-bar-wrap" title="${w.week}: ${w.rate}%">
          <div class="po-exec-tooltip">${w.week}<br>${w.rate}%</div>
          <div class="po-exec-bar" style="height:${h}px;background:${col}"></div>
          <div class="po-exec-bar-lbl">${(w.week||'').replace(/week\s*/i,'W').replace(/\s.*$/,'')}</div>
        </div>`;
      }).join('');

      // Trend direction
      const trendDir = (() => {
        if (!trend || trend.length < 2) return '';
        const diff = trend[trend.length-1].rate - trend[trend.length-2].rate;
        if (diff > 2) return '<span class="po-exec-kpi-trend up">▲ ' + diff + 'pp · Gaining Momentum</span>';
        if (diff < -2) return '<span class="po-exec-kpi-trend down" style="color:#e07a2f">▼ ' + Math.abs(diff) + 'pp · Worth Monitoring</span>';
        return '<span class="po-exec-kpi-trend flat">→ Holding Steady</span>';
      })();

      const stars = d.scholarSurvey > 0 ? '★'.repeat(Math.round(d.scholarSurvey)) + '☆'.repeat(5-Math.round(d.scholarSurvey)) : '—';

      // District rows — reframed language
      const distRows = d.districts.sort((a,b) => b.scholarRate - a.scholarRate).map(dt => {
        const lvl = dt.scholarRate >= 80 ? {label:'Strong', color:'var(--met)', icon:'🌟'} :
                    dt.scholarRate >= 70 ? {label:'Growing', color:'#d97706', icon:'📈'} :
                                           {label:'Developing', color:'#e07a2f', icon:'🤝'};
        const bar = `<div style="display:flex;align-items:center;gap:.5rem">
          <div style="flex:1;height:6px;background:var(--border-2);border-radius:3px;overflow:hidden"><div style="width:${dt.scholarRate}%;height:100%;background:${lvl.color};border-radius:3px"></div></div>
          <span style="font-weight:700;color:${lvl.color};font-size:.8rem;min-width:30px">${dt.scholarRate}%</span>
        </div>`;
        return `<tr>
          <td><div style="font-weight:700;color:var(--navy);font-size:.8125rem">${dt.name}</div><div style="font-size:.7rem;color:var(--muted)">${dt.scholars} active scholars · ${dt.schools.length} school(s)</div></td>
          <td>${bar}</td>
          <td style="text-align:center"><span style="background:${lvl.color}18;color:${lvl.color};border-radius:12px;padding:.2rem .7rem;font-size:.75rem;font-weight:600">${lvl.icon} ${lvl.label}</span></td>
          <td style="text-align:center;font-weight:600;color:var(--navy)">${dt.sessions}</td>
        </tr>`;
      }).join('');

      // Reflection points — no alarming language
      const reflections = [];
      if (d.scholarNeedsAction > 0) reflections.push({ icon:'🤝', title:`${d.scholarNeedsAction} Scholar${d.scholarNeedsAction>1?'s':''} Worth a Check-In`, body:`These scholars may benefit from additional outreach or a fresh connection. Attendance patterns suggest now is a good moment to engage.`, tone:'gentle' });
      if (d.scholarAtRisk > 0) reflections.push({ icon:'📈', title:`${d.scholarAtRisk} Scholar${d.scholarAtRisk>1?'s':''} Building Momentum`, body:`Attendance is in a good-progress range. Continued consistency from tutors and site leaders will help these scholars stay on track.`, tone:'positive' });
      if (d.absenceDrivers.controllable.total > 0) reflections.push({ icon:'🔍', title:`Some Attendance Gaps to Explore`, body:`A portion of missed sessions relate to scheduling and staffing factors — areas the program team actively monitors and supports.`, tone:'neutral' });
      const ctDists = d.districts.filter(dt => dt.ctFlag);
      if (ctDists.length) reflections.push({ icon:'📋', title:`Teacher Scheduling Overlaps in Some Sites`, body:`In ${ctDists.map(x=>x.name).join(' and ')}, some scholar sessions are occasionally rescheduled due to classroom activities. The team is staying in close communication with site leadership.`, tone:'neutral' });
      if (!reflections.length) reflections.push({ icon:'✅', title:'All Sites Tracking Well', body:'Scholar engagement and program delivery are within healthy ranges across all sites.', tone:'positive' });
      const rfHTML = reflections.map(r => {
        const bg = r.tone==='positive' ? '#e8f5e9' : r.tone==='gentle' ? '#fff8e7' : '#f0f4ff';
        const border = r.tone==='positive' ? '#4caf50' : r.tone==='gentle' ? '#f0a500' : '#5b8dee';
        return `<div style="display:flex;gap:.875rem;padding:1rem 1.25rem;border-left:3px solid ${border};background:${bg};border-radius:0 .5rem .5rem 0;margin-bottom:.75rem">
          <div style="font-size:1.5rem;flex-shrink:0">${r.icon}</div>
          <div><div style="font-weight:700;color:var(--navy);font-size:.875rem;margin-bottom:.2rem">${r.title}</div><div style="font-size:.8125rem;color:var(--text-secondary);line-height:1.5">${r.body}</div></div>
        </div>`;
      }).join('');

      mc.innerHTML = `<div class="po-exec-wrap">
        <div class="po-exec-banner ${bannerClass}">
          <div class="po-exec-banner-icon">${bannerIcon}</div>
          <div>
            <div class="po-exec-banner-label">Program Engagement Overview</div>
            <div class="po-exec-banner-title">${bannerTitle}</div>
            <div class="po-exec-banner-sub">${bannerSub}</div>
          </div>
          <div style="margin-left:auto;text-align:right;opacity:.8;font-size:.75rem">Live data · Refreshes every 5 min<br>Filtered to current view</div>
        </div>

        <div class="po-exec-kpi-row">
          <div class="po-exec-kpi" style="--kpi-color:${d.scholarRate>=80?'var(--met)':'var(--notmet)'}">
            <div class="po-exec-kpi-icon">🎓</div>
            <div class="po-exec-kpi-label">Scholar Participation</div>
            <div class="po-exec-kpi-val">${d.scholarRate}<span style="font-size:1.25rem">%</span></div>
            <div class="po-exec-kpi-sub">${totalScholars} active scholars</div>
            ${trendDir}
          </div>
          <div class="po-exec-kpi" style="--kpi-color:${d.tutorRate>=85?'var(--met)':'#d97706'}">
            <div class="po-exec-kpi-icon">👩‍🏫</div>
            <div class="po-exec-kpi-label">Tutor Consistency</div>
            <div class="po-exec-kpi-val">${d.tutorRate}<span style="font-size:1.25rem">%</span></div>
            <div class="po-exec-kpi-sub">Staff present for scholars</div>
          </div>
          <div class="po-exec-kpi" style="--kpi-color:var(--blue-mid)">
            <div class="po-exec-kpi-icon">📚</div>
            <div class="po-exec-kpi-label">Sessions Completed</div>
            <div class="po-exec-kpi-val">${d.sessionsDelivered.toLocaleString()}</div>
            <div class="po-exec-kpi-sub">Delivered tutoring sessions</div>
          </div>
          <div class="po-exec-kpi" style="--kpi-color:#f59e0b">
            <div class="po-exec-kpi-icon">⭐</div>
            <div class="po-exec-kpi-label">Scholar Experience</div>
            <div class="po-exec-kpi-val" style="font-size:1.75rem">${d.scholarSurvey > 0 ? d.scholarSurvey.toFixed(1) : '—'}<span style="font-size:1rem">/5</span></div>
            <div class="po-exec-kpi-sub" style="color:#f59e0b;font-size:.875rem">${stars}</div>
          </div>
        </div>

        <div class="po-exec-health-row">
          <div class="po-exec-tiers">
            <div class="po-exec-card-title">
              <span>📊 Scholar Engagement Tiers — ${totalScholars} Active Scholars</span>
              <span style="font-weight:400;font-size:.75rem;color:var(--muted)">≥80% Actively Engaged · 70–79% Building Momentum · &lt;70% Check In With</span>
            </div>
            <div class="po-exec-tier-bars">
              <div class="po-exec-tier-row">
                <div class="po-exec-tier-lbl" style="color:var(--met)">🌟 Actively Engaged</div>
                <div class="po-exec-tier-bar"><div class="po-exec-tier-fill" style="width:${onTrackPct}%;background:var(--met)"></div></div>
                <div class="po-exec-tier-cnt">${d.scholarOnTrack}</div>
                <div class="po-exec-tier-pct">${onTrackPct}%</div>
              </div>
              <div class="po-exec-tier-row">
                <div class="po-exec-tier-lbl" style="color:#d97706">📈 Building Momentum</div>
                <div class="po-exec-tier-bar"><div class="po-exec-tier-fill" style="width:${momentumPct}%;background:#d97706"></div></div>
                <div class="po-exec-tier-cnt">${d.scholarAtRisk}</div>
                <div class="po-exec-tier-pct">${momentumPct}%</div>
              </div>
              <div class="po-exec-tier-row">
                <div class="po-exec-tier-lbl" style="color:#e07a2f">🤝 Check In With</div>
                <div class="po-exec-tier-bar"><div class="po-exec-tier-fill" style="width:${checkInPct}%;background:#e07a2f"></div></div>
                <div class="po-exec-tier-cnt">${d.scholarNeedsAction}</div>
                <div class="po-exec-tier-pct">${checkInPct}%</div>
              </div>
            </div>
            ${trend.length ? `<div style="margin-top:1.25rem">
              <div class="po-exec-card-title" style="margin-bottom:.625rem;border:none;padding:0">📈 Weekly Participation Trend</div>
              <div class="po-exec-chart">${trendBars}</div>
            </div>` : ''}
          </div>

          <div style="display:flex;flex-direction:column;gap:.5rem">
            <div class="po-exec-card-title" style="margin-bottom:.5rem">🌱 Program Reflections</div>
            ${rfHTML}
          </div>
        </div>

        <div class="po-exec-scorecard">
          <div class="po-exec-card-title" style="padding:.75rem 1.25rem;border-bottom:1px solid var(--border);margin:0;background:var(--surface-2)">
            🗺️ Site Engagement Overview
            <span style="font-weight:400;font-size:.75rem;color:var(--muted)">${d.districts.length} districts · Participation levels across sites</span>
          </div>
          <div style="overflow-x:auto">
            <table class="po-exec-table">
              <thead><tr>
                <th>District</th>
                <th>Scholar Participation</th>
                <th style="text-align:center">Engagement Level</th>
                <th style="text-align:center">Sessions</th>
              </tr></thead>
              <tbody>${distRows || '<tr><td colspan="4" style="text-align:center;padding:1.5rem;color:var(--muted)">No district data available</td></tr>'}</tbody>
            </table>
          </div>
        </div>
      </div>`;
    }

    // ── LEADERSHIP EXECUTIVE VIEW ─────────────────────────────────────────
    function renderLeadershipView() {
      const mc = document.getElementById('poMainContent'); if (!mc) return;
      const d = getLeadershipData();
      if (!d) { mc.innerHTML = '<div class="po-exec-empty">⏳ Loading program data…</div>'; return; }

      // Status determination
      const scholarOk = d.scholarRate >= 80;
      const scholarWarn = d.scholarRate >= 75;
      const tutorOk = d.tutorRate >= 85;
      const totalScholars = d.scholarOnTrack + d.scholarAtRisk + d.scholarNeedsAction;
      const critDistricts = d.districts.filter(dt => dt.scholarRate < 75).length;
      const bannerClass = (scholarOk && tutorOk && critDistricts === 0) ? 'green' : (scholarWarn && critDistricts <= 1) ? 'amber' : 'red';
      const bannerIcon = bannerClass === 'green' ? '✅' : bannerClass === 'amber' ? '⚠️' : '🔴';
      const bannerTitle = bannerClass === 'green' ? 'Program Running Strong' : bannerClass === 'amber' ? 'Some Areas Warrant Closer Review' : 'Action Recommended — Program Team Attention Needed';
      const bannerSub = bannerClass === 'green'
        ? `Scholar attendance at ${d.scholarRate}% with ${d.sessionsDelivered} sessions delivered. No districts of concern.`
        : bannerClass === 'amber'
        ? `Scholar attendance at ${d.scholarRate}%. ${critDistricts} district(s) may benefit from additional support — review recommended.`
        : `Scholar attendance at ${d.scholarRate}% overall — ${critDistricts} district(s) below the 75% target require focused follow-up.`;

      // Trend arrow helper
      const trendArr = (wt) => {
        if (!wt || wt.length < 2) return '';
        const last = wt[wt.length - 1].rate, prev = wt[wt.length - 2].rate;
        const diff = last - prev;
        if (diff > 2) return '<span class="po-exec-kpi-trend up">▲ ' + diff + 'pp</span>';
        if (diff < -2) return '<span class="po-exec-kpi-trend down">▼ ' + Math.abs(diff) + 'pp</span>';
        return '<span class="po-exec-kpi-trend flat">→ Stable</span>';
      };

      // Scholar survey stars
      const stars = d.scholarSurvey > 0 ? '★'.repeat(Math.round(d.scholarSurvey)) + '☆'.repeat(5 - Math.round(d.scholarSurvey)) : '—';

      // Tier percentages
      const onTrackPct  = totalScholars > 0 ? Math.round(d.scholarOnTrack / totalScholars * 100) : 0;
      const atRiskPct   = totalScholars > 0 ? Math.round(d.scholarAtRisk / totalScholars * 100) : 0;
      const needActPct  = totalScholars > 0 ? Math.round(d.scholarNeedsAction / totalScholars * 100) : 0;

      // Weekly trend chart (last 12 weeks)
      const trend = (d.weeklyTrend || []).slice(-12);
      const maxRate = trend.length ? Math.max(...trend.map(w => w.rate), 1) : 100;
      const trendBars = trend.map(w => {
        const h = Math.round((w.rate / 100) * 60);
        const col = w.rate >= 95 ? '#0d6e3a' : w.rate >= 80 ? '#d97706' : '#b91c1c';
        return `<div class="po-exec-bar-wrap" title="${w.week}: ${w.rate}%">
          <div class="po-exec-tooltip">${w.week}<br>${w.rate}%</div>
          <div class="po-exec-bar" style="height:${h}px;background:${col}"></div>
          <div class="po-exec-bar-lbl">${(w.week||'').replace(/week\s*/i,'W').replace(/\s.*$/,'')}</div>
        </div>`;
      }).join('');

      // District rows
      const distRows = d.districts.sort((a,b) => b.scholarRate - a.scholarRate).map(dt => {
        const rateColor = dt.scholarRate >= 80 ? 'var(--met)' : dt.scholarRate >= 70 ? '#d97706' : 'var(--notmet)';
        const pill = `<span class="po-exec-rate-pill" style="color:${rateColor}">${dt.scholarRate}%<span class="po-exec-mini-bar" style="width:${dt.scholarRate * 0.5}px;background:${rateColor};height:6px;border-radius:3px;vertical-align:middle;display:inline-block"></span></span>`;
        const tutorColor = dt.tutorRate >= 90 ? 'var(--met)' : dt.tutorRate >= 80 ? '#d97706' : 'var(--notmet)';
        const flags = dt.ctFlag ? '<span class="po-badge po-badge-gold">⚠️ CT Pull-out</span>' : '<span class="po-badge po-badge-green">✓</span>';
        return `<tr onclick="po.drillSchool('${esc(dt.schools[0]&&dt.schools[0].name||'')}')" style="cursor:pointer">
          <td><div style="font-weight:700;color:var(--navy);font-size:.8125rem">${dt.name}</div><div style="font-size:.7rem;color:var(--muted)">${dt.scholars} active scholars · ${dt.schools.length} school(s)</div></td>
          <td style="text-align:center">${pill}</td>
          <td style="text-align:center"><span style="font-weight:700;color:${tutorColor}">${dt.tutorRate}%</span></td>
          <td style="text-align:center"><span style="font-weight:600;color:var(--navy)">${dt.sessions}</span></td>
          <td style="text-align:center">${flags}</td>
        </tr>`;
      }).join('');

      // Action items
      const actions = [];
      if (d.scholarNeedsAction > 0) actions.push({ icon:'🤝', title: `${d.scholarNeedsAction} Scholar${d.scholarNeedsAction>1?'s':''} Require Additional Support`, body: `Attendance below 70%. These scholars may benefit from closer check-ins and outreach from the program team.`, sev:'crit' });
      if (d.scholarAtRisk > 0) actions.push({ icon:'📈', title: `${d.scholarAtRisk} Scholar${d.scholarAtRisk>1?'s':''} Need Continued Encouragement`, body: `Attendance between 70–79%. Consistent engagement from tutors and site leaders can help strengthen participation.`, sev:'warn' });
      if (critDistricts > 0) actions.push({ icon:'📍', title: `${critDistricts} District${critDistricts>1?'s':''} Warrant a Closer Look`, body: `Scholar attendance below 75% — worth reviewing with site leadership. Click a district row to drill into specific schools.`, sev:'crit' });
      const ctDists = d.districts.filter(dt => dt.ctFlag);
      if (ctDists.length) actions.push({ icon:'📋', title: `High CT Pull-out Rate in ${ctDists.map(x=>x.name).join(', ')}`, body: `Classroom teacher requests are limiting scholar access to tutoring sessions. Consider follow-up with site leadership.`, sev:'warn' });
      if (d.absenceDrivers.controllable.total > 0) actions.push({ icon:'🔧', title: `${d.absenceDrivers.controllable.total} Controllable Absences This Period`, body: `Includes tutor absences, vacancies, and internal scheduling issues — factors within program control.`, sev:'warn' });
      if (!actions.length) actions.push({ icon:'✅', title: 'All Areas Looking Good', body: 'Program is operating within all healthy thresholds. Keep up the great work.', sev:'ok' });
      const actionHTML = actions.map(a => `<div class="po-exec-action-item"><div class="po-exec-action-icon">${a.icon}</div><div><div class="po-exec-action-title">${a.title}</div><div class="po-exec-action-body">${a.body}</div></div></div>`).join('');

      // Absence drivers
      const ctrl = d.absenceDrivers.controllable;
      const unctrl = d.absenceDrivers.uncontrollable;
      const maxCtrl = ctrl.reasons.length ? Math.max(...ctrl.reasons.map(r=>r.count), 1) : 1;
      const maxUnctrl = unctrl.reasons.length ? Math.max(...unctrl.reasons.map(r=>r.count), 1) : 1;
      const ctrlRows = ctrl.reasons.map(r => `<div class="po-exec-driver-row"><div class="po-exec-driver-lbl">${r.label}</div><div class="po-exec-driver-bar"><div class="po-exec-driver-fill" style="width:${Math.round(r.count/maxCtrl*100)}%;background:#b91c1c;height:6px;border-radius:3px"></div></div><div class="po-exec-driver-cnt">${r.count}</div></div>`).join('') || '<div style="font-size:.8rem;color:var(--muted)">None recorded</div>';
      const unctrlRows = unctrl.reasons.map(r => `<div class="po-exec-driver-row"><div class="po-exec-driver-lbl">${r.label}</div><div class="po-exec-driver-bar"><div class="po-exec-driver-fill" style="width:${Math.round(r.count/maxUnctrl*100)}%;background:#0050c8;height:6px;border-radius:3px"></div></div><div class="po-exec-driver-cnt">${r.count}</div></div>`).join('') || '<div style="font-size:.8rem;color:var(--muted)">None recorded</div>';

      mc.innerHTML = `<div class="po-exec-wrap">

        <!-- STATUS BANNER -->
        <div class="po-exec-banner ${bannerClass}">
          <div class="po-exec-banner-icon">${bannerIcon}</div>
          <div>
            <div class="po-exec-banner-label">Program Health Status</div>
            <div class="po-exec-banner-title">${bannerTitle}</div>
            <div class="po-exec-banner-sub">${bannerSub}</div>
          </div>
          <div style="margin-left:auto;text-align:right;opacity:.8;font-size:.75rem">Auto-refreshes every 5 min<br>Click any district to drill down</div>
        </div>

        <!-- KPI ROW -->
        <div class="po-exec-kpi-row">
          <div class="po-exec-kpi" style="--kpi-color:${d.scholarRate>=80?'var(--met)':'var(--notmet)'}">
            <div class="po-exec-kpi-icon">🎓</div>
            <div class="po-exec-kpi-label">Scholar Attendance</div>
            <div class="po-exec-kpi-val">${d.scholarRate}<span style="font-size:1.25rem">%</span></div>
            <div class="po-exec-kpi-sub">${totalScholars} active scholars</div>
            ${trendArr(d.weeklyTrend)}
          </div>
          <div class="po-exec-kpi" style="--kpi-color:${d.tutorRate>=85?'var(--met)':d.tutorRate>=75?'#d97706':'var(--notmet)'}">
            <div class="po-exec-kpi-icon">👩‍🏫</div>
            <div class="po-exec-kpi-label">Tutor Attendance</div>
            <div class="po-exec-kpi-val">${d.tutorRate}<span style="font-size:1.25rem">%</span></div>
            <div class="po-exec-kpi-sub">Staff showing up for scholars</div>
          </div>
          <div class="po-exec-kpi" style="--kpi-color:var(--blue-mid)">
            <div class="po-exec-kpi-icon">📚</div>
            <div class="po-exec-kpi-label">Sessions Delivered</div>
            <div class="po-exec-kpi-val">${d.sessionsDelivered.toLocaleString()}</div>
            <div class="po-exec-kpi-sub">Completed tutoring sessions</div>
          </div>
          <div class="po-exec-kpi" style="--kpi-color:#f59e0b">
            <div class="po-exec-kpi-icon">⭐</div>
            <div class="po-exec-kpi-label">Scholar Satisfaction</div>
            <div class="po-exec-kpi-val" style="font-size:1.75rem">${d.scholarSurvey > 0 ? d.scholarSurvey.toFixed(1) : '—'}<span style="font-size:1rem">/5</span></div>
            <div class="po-exec-kpi-sub" style="color:#f59e0b;font-size:.875rem">${stars}</div>
          </div>
        </div>

        <!-- HEALTH + ABSENCE ROW -->
        <div class="po-exec-health-row">
          <div class="po-exec-tiers">
            <div class="po-exec-card-title">
              <span>📊 Scholar Attendance Health — ${totalScholars} Active Scholars</span>
              <span style="font-weight:400;font-size:.75rem;color:var(--muted)">≥80% On Track · 70–79% Building Momentum · &lt;70% Needs Support</span>
            </div>
            <div class="po-exec-tier-bars">
              <div class="po-exec-tier-row">
                <div class="po-exec-tier-lbl" style="color:var(--met)">🟢 On Track</div>
                <div class="po-exec-tier-bar"><div class="po-exec-tier-fill" style="width:${onTrackPct}%;background:var(--met)"></div></div>
                <div class="po-exec-tier-cnt">${d.scholarOnTrack}</div>
                <div class="po-exec-tier-pct">${onTrackPct}%</div>
              </div>
              <div class="po-exec-tier-row">
                <div class="po-exec-tier-lbl" style="color:#d97706">🟡 Building Momentum</div>
                <div class="po-exec-tier-bar"><div class="po-exec-tier-fill" style="width:${atRiskPct}%;background:#d97706"></div></div>
                <div class="po-exec-tier-cnt">${d.scholarAtRisk}</div>
                <div class="po-exec-tier-pct">${atRiskPct}%</div>
              </div>
              <div class="po-exec-tier-row">
                <div class="po-exec-tier-lbl" style="color:var(--notmet)">🤝 Needs Support</div>
                <div class="po-exec-tier-bar"><div class="po-exec-tier-fill" style="width:${needActPct}%;background:var(--notmet)"></div></div>
                <div class="po-exec-tier-cnt">${d.scholarNeedsAction}</div>
                <div class="po-exec-tier-pct">${needActPct}%</div>
              </div>
            </div>
            ${trend.length ? `
            <div style="margin-top:1.25rem">
              <div class="po-exec-card-title" style="margin-bottom:.625rem;border:none;padding:0">📈 Weekly Attendance Trend</div>
              <div class="po-exec-chart">${trendBars}</div>
            </div>` : ''}
          </div>

          <div class="po-exec-absence">
            <div class="po-exec-card-title">🧩 Why Are Sessions Missed?</div>
            <div class="po-exec-driver-section">
              <div class="po-exec-driver-heading" style="color:var(--notmet)">⚡ Within Our Control (${ctrl.total})</div>
              ${ctrlRows}
            </div>
            <div class="po-exec-driver-section" style="margin-bottom:0">
              <div class="po-exec-driver-heading" style="color:var(--blue-mid)">🏫 Outside Our Control (${unctrl.total})</div>
              ${unctrlRows}
            </div>
          </div>
        </div>

        <!-- DISTRICT SCORECARD -->
        <div class="po-exec-scorecard">
          <div class="po-exec-card-title" style="padding:.75rem 1.25rem;border-bottom:1px solid var(--border);margin:0;background:var(--surface-2)">
            🗺️ District Performance Scorecard
            <span style="font-weight:400;font-size:.75rem;color:var(--muted)">${d.districts.length} districts · Click a row to see schools</span>
          </div>
          <div style="overflow-x:auto">
            <table class="po-exec-table">
              <thead><tr>
                <th>District</th>
                <th style="text-align:center">Scholar Attendance</th>
                <th style="text-align:center">Tutor Attendance</th>
                <th style="text-align:center">Sessions</th>
                <th style="text-align:center">Flags</th>
              </tr></thead>
              <tbody>${distRows || '<tr><td colspan="5" style="text-align:center;padding:1.5rem;color:var(--muted)">No district data available</td></tr>'}</tbody>
            </table>
          </div>
        </div>

        <!-- ACTION ITEMS -->
        <div class="po-exec-actions">
          <div class="po-exec-card-title" style="margin-bottom:.875rem">📋 Executive Briefing — Items Requiring Attention</div>
          ${actionHTML}
        </div>

      </div>`;
    }

    // ── DATA DEPARTMENT TRUE OPERATIONS DASHBOARD ─────────────────────────
    function renderDataOpsView() {
      const mc = document.getElementById('poMainContent'); if (!mc) return;
      const d = getLeadershipData();
      if (!d) { mc.innerHTML = '<div style="text-align:center;padding:2rem;color:var(--muted)">⏳ Loading operations data…</div>'; return; }

      const schools = filteredSchools().sort((a, b) => b.attRate - a.attRate);
      const totalScholars = d.scholarOnTrack + d.scholarAtRisk + d.scholarNeedsAction;
      const now = new Date();
      const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
      const dateStr = now.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

      // KPI strip
      const allFlags = schools.reduce((s, sc) => s + sc.flags.length, 0);
      const allSI    = schools.reduce((s, sc) => s + sc.stuInterruptions, 0);
      const critSchools = schools.filter(sc => sc.attRate < 75).length;

      const kpis = [
        { lbl:'Scholar Attendance', val: d.scholarRate + '%', sub:'YTD program-wide', col: d.scholarRate >= 80 ? '#0d6e3a' : d.scholarRate >= 70 ? '#d97706' : '#b91c1c' },
        { lbl:'Tutor Attendance',   val: d.tutorRate + '%',   sub:'Staff present rate', col: d.tutorRate >= 90 ? '#0d6e3a' : d.tutorRate >= 80 ? '#d97706' : '#b91c1c' },
        { lbl:'Sessions Delivered', val: d.sessionsDelivered.toLocaleString(), sub:'Completed this period', col: '#0050c8' },
        { lbl:'Service Interruptions', val: allSI, sub:'Non-attendance disruptions', col: allSI > 20 ? '#b91c1c' : allSI > 5 ? '#d97706' : '#0d6e3a' },
      ];
      const kpiHTML = kpis.map(k => `
        <div class="po-ops-kpi" style="--kc:${k.col}">
          <div class="po-ops-kpi-lbl">${k.lbl}</div>
          <div class="po-ops-kpi-val" style="color:${k.col}">${k.val}</div>
          <div class="po-ops-kpi-sub">${k.sub}</div>
        </div>`).join('');

      // Late survey filers
      const _lateFilerStats = computeTutorLateFilersStats();

      // Alert feed
      const alerts = [];
      if (d.scholarNeedsAction > 0) alerts.push({ cls:'crit', icon:'🤝', title:`${d.scholarNeedsAction} scholars below 70% attendance`, sub:'Recommend outreach and support' });
      if (d.scholarAtRisk > 0) alerts.push({ cls:'warn', icon:'📈', title:`${d.scholarAtRisk} scholars building momentum (70–79%)`, sub:'Continued encouragement recommended' });
      if (critSchools > 0) alerts.push({ cls:'crit', icon:'🏫', title:`${critSchools} school${critSchools>1?'s':''} below 75% attendance`, sub:'Warrants further investigation' });
      schools.filter(sc => sc.flags.some(f => f.severity === 'critical')).slice(0,3).forEach(sc => alerts.push({ cls:'crit', icon:'⚑', title:`HIT Critical Flag: ${sc.school}`, sub:`${sc.flags.filter(f=>f.severity==='critical').length} critical compliance flag(s)` }));
      schools.filter(sc => sc.stuInterruptions > 5).slice(0,3).forEach(sc => alerts.push({ cls:'warn', icon:'⚡', title:`High Service Interruptions: ${sc.school}`, sub:`${sc.stuInterruptions} disruptions this period` }));
      if (_lateFilerStats.totalFlagged > 0) alerts.push({ cls:'warn', icon:'🕐', title:`${_lateFilerStats.totalFlagged} tutor${_lateFilerStats.totalFlagged>1?'s':''} filing surveys 50%+ after session date`, sub:`${_lateFilerStats.totalLate} late submission${_lateFilerStats.totalLate>1?'s':''} total — see Late Survey Filers panel` });
      if (!alerts.length) alerts.push({ cls:'ok', icon:'✅', title:'All systems nominal', sub:'No critical alerts at this time' });
      const alertHTML = alerts.slice(0,8).map(a => `<div class="po-ops-alert ${a.cls}"><div class="po-ops-alert-icon">${a.icon}</div><div class="po-ops-alert-body"><div class="po-ops-alert-title">${a.title}</div><div class="po-ops-alert-sub">${a.sub}</div></div></div>`).join('');

      // Late survey filers panel HTML
      const lateFilerRows = _lateFilerStats.flagged.slice(0, 10).map(t => `
        <div style="display:flex;align-items:center;justify-content:space-between;padding:.4rem .5rem;border-bottom:1px solid var(--border-2);font-size:.75rem">
          <div>
            <div style="font-weight:600;color:var(--navy)">${t.name}</div>
            <div style="font-size:.68rem;color:var(--muted)">${t.school}</div>
          </div>
          <div style="text-align:right">
            <span style="font-weight:700;color:#d97706">${t.lateRate}% late</span>
            <div style="font-size:.68rem;color:var(--muted)">${t.late} of ${t.submitted} surveys</div>
          </div>
        </div>`).join('');
      const lateFilerPanelHTML = _lateFilerStats.totalFlagged > 0 ? `
        <div class="po-ops-panel" style="border-left:3px solid #d97706">
          <div class="po-ops-panel-hd" style="color:#92400e">🕐 Late Survey Filers (≥50% after session date)
            <span style="font-weight:400;font-size:.7rem">${_lateFilerStats.totalFlagged} tutor${_lateFilerStats.totalFlagged>1?'s':''} · ${_lateFilerStats.totalLate} late submissions</span>
          </div>
          <div class="po-ops-panel-body" style="padding:0">${lateFilerRows}</div>
        </div>` : '';

      // School ops table rows
      const topSchools = schools.slice(0, 20);
      const tableRows = topSchools.map(sc => {
        const attColor = sc.attRate >= 80 ? 'var(--met)' : sc.attRate >= 70 ? '#d97706' : 'var(--notmet)';
        const hasCrit = sc.flags.some(f => f.severity === 'critical');
        const hasHigh = sc.flags.some(f => f.severity === 'high');
        const flagBadge = sc.flags.length ? `<span class="po-badge ${hasCrit?'po-badge-critical':hasHigh?'po-badge-red':'po-badge-gold'}">🚩${sc.flags.length}</span>` : '<span class="po-badge po-badge-green">✓</span>';
        const siBadge = sc.stuInterruptions > 0 ? `<span class="po-badge ${sc.stuInterruptions>5?'po-badge-red':'po-badge-gold'}">⚠️${sc.stuInterruptions}</span>` : '<span class="po-badge po-badge-green">✓</span>';
        const survStr = sc.stuSurveyAvg > 0 ? sc.stuSurveyAvg.toFixed(1) : '—';
        // Mini sparkline for the school
        const miniSpark = (() => {
          const wm = {};
          for (const r of _attRows) {
            if (r[ATT.SCHOOL] !== sc.school || r[ATT.ROLE] !== 'Student') continue;
            const w = r[ATT.WEEK]; if (!w) continue;
            if (!wm[w]) wm[w] = {a:0,m:0};
            const cls = classifyRecord(r);
            if (cls==='attended') wm[w].a++; else if (cls==='absent') wm[w].m++;
          }
          const pts = Object.entries(wm).sort((a,b)=>{const na=parseInt(a[0].replace(/\D/g,'')),nb=parseInt(b[0].replace(/\D/g,'')); return na-nb;}).slice(-6).map(([,v])=>{const t=v.a+v.m; return t>0?Math.round(v.a/t*100):0;});
          if (pts.length < 2) return '';
          const mx = Math.max(...pts, 1);
          return '<div class="po-ops-sparkline">' + pts.map(p=>{const h=Math.max(2,Math.round(p/mx*24)); const c=p>=85?'#0d6e3a':p>=75?'#d97706':'#b91c1c'; return `<div class="po-ops-spark-bar" style="height:${h}px;background:${c}"></div>`;}).join('') + '</div>';
        })();
        const tcr = sc.tutorSurvCompRate;
        const tcrColor = tcr === null ? 'var(--muted)' : tcr >= 80 ? 'var(--met)' : tcr >= 60 ? '#d97706' : 'var(--notmet)';
        const tcrStr = tcr === null ? '—' : tcr + '%';
        return `<tr onclick="po.drillSchool('${esc(sc.school)}')">
          <td><div class="school-name">${sc.school}</div><div class="dist-name">${sc.district}</div></td>
          <td style="text-align:center"><span style="font-weight:700;color:${attColor}">${sc.attRate}%</span></td>
          <td style="text-align:center"><span style="font-weight:600;color:var(--navy)">${sc.sessions.length}</span></td>
          <td style="text-align:center">${siBadge}</td>
          <td style="text-align:center">${flagBadge}</td>
          <td style="text-align:center">${survStr}</td>
          <td style="text-align:center"><span style="font-weight:700;color:${tcrColor}">${tcrStr}</span>${tcr!==null?`<div style="font-size:.6rem;color:var(--muted)">${sc.tutorSurvSubmitted}/${sc.tutorSurvEligible}</div>`:''}
          </td>
          <td>${miniSpark}</td>
        </tr>`;
      }).join('');

      // Donut chart for absence split
      const ctrl = d.absenceDrivers.controllable;
      const unctrl = d.absenceDrivers.uncontrollable;
      const totalAbs = ctrl.total + unctrl.total;
      const ctrlPct = totalAbs > 0 ? Math.round(ctrl.total / totalAbs * 100) : 0;
      const radius = 32, circumference = 2 * Math.PI * radius;
      const ctrlDash = (ctrlPct / 100) * circumference;
      const donutHTML = `
        <div class="po-ops-donut-wrap">
          <div class="po-ops-donut">
            <svg width="80" height="80" viewBox="0 0 80 80">
              <circle cx="40" cy="40" r="${radius}" fill="none" stroke="#e5e7eb" stroke-width="10"/>
              <circle cx="40" cy="40" r="${radius}" fill="none" stroke="#b91c1c" stroke-width="10"
                stroke-dasharray="${ctrlDash} ${circumference}" stroke-linecap="round"/>
              <circle cx="40" cy="40" r="${radius}" fill="none" stroke="#0050c8" stroke-width="10"
                stroke-dasharray="${circumference - ctrlDash} ${circumference}" stroke-dashoffset="${-ctrlDash}" stroke-linecap="round"/>
            </svg>
            <div class="po-ops-donut-center"><div class="po-ops-donut-pct">${totalAbs}</div><div class="po-ops-donut-sub">total</div></div>
          </div>
          <div class="po-ops-donut-legend">
            <div class="po-ops-donut-leg-row"><div class="po-ops-donut-leg-dot" style="background:#b91c1c"></div><div class="po-ops-donut-leg-lbl">Controllable</div><div class="po-ops-donut-leg-cnt">${ctrl.total}</div></div>
            <div class="po-ops-donut-leg-row"><div class="po-ops-donut-leg-dot" style="background:#0050c8"></div><div class="po-ops-donut-leg-lbl">External</div><div class="po-ops-donut-leg-cnt">${unctrl.total}</div></div>
            ${ctrl.reasons.slice(0,2).map(r=>`<div class="po-ops-donut-leg-row" style="padding-left:.75rem"><div class="po-ops-donut-leg-dot" style="background:#fee2e2;border:1px solid #b91c1c"></div><div class="po-ops-donut-leg-lbl" style="font-size:.7rem">${r.label}</div><div class="po-ops-donut-leg-cnt" style="font-size:.7rem">${r.count}</div></div>`).join('')}
          </div>
        </div>`;

      // Scholar tier boxes
      const tierHTML = `
        <div class="po-ops-tier-strip">
          <div class="po-ops-tier-box" style="background:var(--met-bg)">
            <div class="val" style="color:var(--met)">${d.scholarOnTrack}</div>
            <div class="lbl" style="color:var(--met)">On Track</div>
          </div>
          <div class="po-ops-tier-box" style="background:#fef3c7">
            <div class="val" style="color:#92400e">${d.scholarAtRisk}</div>
            <div class="lbl" style="color:#92400e">At Risk</div>
          </div>
          <div class="po-ops-tier-box" style="background:var(--notm-bg)">
            <div class="val" style="color:var(--notmet)">${d.scholarNeedsAction}</div>
            <div class="lbl" style="color:var(--notmet)">Action Req.</div>
          </div>
        </div>`;

      // Weekly trend chart ops style
      const trend = (d.weeklyTrend || []).slice(-10);
      const trendOpsHTML = trend.length ? `
        <div style="margin-top:.625rem">
          <div class="po-ops-sparkline" style="height:40px;gap:3px">
            ${trend.map(w=>{const h=Math.max(2,Math.round(w.rate*0.4));const c=w.rate>=95?'#0d6e3a':w.rate>=80?'#d97706':'#b91c1c';return `<div title="${w.week}: ${w.rate}%" class="po-ops-spark-bar" style="height:${h}px;background:${c};flex:1;cursor:help"></div>`;}).join('')}
          </div>
          <div style="display:flex;justify-content:space-between;font-size:.55rem;color:var(--muted);margin-top:.25rem">
            <span>${trend[0]?.week||''}</span><span>→ Latest: ${trend[trend.length-1]?.rate||0}%</span>
          </div>
        </div>` : '<div style="font-size:.75rem;color:var(--muted);padding:.5rem 0">No weekly data yet</div>';

      mc.innerHTML = `<div class="po-ops-wrap">

        <!-- LIVE HEADER BAR -->
        <div class="po-ops-header">
          <div class="po-ops-header-left">
            <div class="po-ops-live-dot"></div>
            <div>
              <div class="po-ops-header-title">Pearl Operations Command Center</div>
              <div class="po-ops-header-sub">Live data · ${schools.length} schools · Auto-refresh every 5 min</div>
            </div>
          </div>
          <div class="po-ops-header-meta">
            <div class="po-ops-meta-item">
              <div class="po-ops-meta-lbl">Data as of</div>
              <div class="po-ops-meta-val">${dateStr} ${timeStr}</div>
            </div>
            <div class="po-ops-meta-item">
              <div class="po-ops-meta-lbl">Active Scholars</div>
              <div class="po-ops-meta-val">${totalScholars.toLocaleString()}</div>
            </div>
          </div>
        </div>

        <!-- KPI STRIP -->
        <div class="po-ops-kpi-strip">${kpiHTML}</div>

        <!-- MAIN TWO-COL -->
        <div class="po-ops-cols">

          <!-- LEFT: School Table -->
          <div class="po-ops-panel">
            <div class="po-ops-panel-hd">
              📋 School-Level Operations Monitor
              <span style="font-weight:400">${schools.length} schools · Click to drill in</span>
            </div>
            <div style="padding:.5rem .75rem .25rem;border-bottom:1px solid #f1f5f9">
              <input id="poSchoolSearch" type="text" placeholder="Search school or district…"
                style="width:100%;box-sizing:border-box;padding:.4rem .75rem;border:1.5px solid #e2e8f0;border-radius:8px;font-size:.78rem;outline:none;transition:border .15s"
                oninput="(function(v){v=v.toLowerCase();var rows=document.querySelectorAll('#poSchoolTable tbody tr');rows.forEach(function(r){r.style.display=r.textContent.toLowerCase().includes(v)?'':'none';});var vis=[].filter.call(rows,function(r){return r.style.display!=='none';}).length;var c=document.getElementById('poSchoolSearchCount');if(c)c.textContent=v?vis+' of ${schools.length} matching':'';document.getElementById('poSchoolSearch').style.borderColor=v?'#6366f1':'#e2e8f0';})(this.value)"
                onfocus="this.style.borderColor='#6366f1'" onblur="if(!this.value)this.style.borderColor='#e2e8f0'">
              <div id="poSchoolSearchCount" style="font-size:.65rem;color:#6366f1;font-weight:600;min-height:.9rem;margin-top:.2rem"></div>
            </div>
            <div style="overflow-x:auto">
              <table class="po-ops-table" id="poSchoolTable">
                <thead><tr>
                  <th>School / District</th>
                  <th style="text-align:center">Att %</th>
                  <th style="text-align:center">Sessions</th>
                  <th style="text-align:center">Interruptions</th>
                  <th style="text-align:center">HIT Flags</th>
                  <th style="text-align:center">Scholar Survey</th>
                  <th style="text-align:center" title="Tutor survey completion rate — surveys submitted vs eligible sessions (Session ID matched)">Tutor Survey %</th>
                  <th style="text-align:center">Trend</th>
                </tr></thead>
                <tbody>${tableRows || '<tr><td colspan="8" style="text-align:center;padding:1.5rem;color:var(--muted)">Loading…</td></tr>'}</tbody>
              </table>
            </div>
          </div>

          <!-- RIGHT: Alert Feed + Mini Stats -->
          <div style="display:flex;flex-direction:column;gap:.75rem">

            <!-- Alert Feed -->
            <div class="po-ops-panel">
              <div class="po-ops-panel-hd">🔔 Live Alert Feed</div>
              <div class="po-ops-panel-body">
                <div class="po-ops-alert-feed">${alertHTML}</div>
              </div>
            </div>

            <!-- Scholar Tiers -->
            <div class="po-ops-panel">
              <div class="po-ops-panel-hd">🎓 Scholar Health Tiers</div>
              <div class="po-ops-panel-body">
                ${tierHTML}
                ${trendOpsHTML}
              </div>
            </div>

            <!-- Absence Breakdown -->
            <div class="po-ops-panel">
              <div class="po-ops-panel-hd">🧩 Absence Breakdown</div>
              <div class="po-ops-panel-body">${donutHTML}</div>
            </div>

            <!-- Late Survey Filers (shown only when flagged tutors exist) -->
            ${lateFilerPanelHTML}

            <!-- Low Survey Completion Alert (prog/data lens) -->
            ${(() => {
              const LOW_THRESHOLD = 70;
              const filteredSchoolSet = new Set(schools.map(sc => sc.school));
              const lowTutors = Object.values(_personMap)
                .filter(p =>
                  p.role === 'Instructor' &&
                  filteredSchoolSet.has(p.school) &&
                  p.surveyEligible > 0 &&
                  p.surveyCompRate !== null &&
                  p.surveyCompRate < LOW_THRESHOLD
                )
                .sort((a, b) => (a.surveyCompRate||0) - (b.surveyCompRate||0))
                .slice(0, 15);
              if (!lowTutors.length) return '';
              const rows = lowTutors.map(t => {
                const crColor = t.surveyCompRate >= 50 ? '#d97706' : '#b91c1c';
                return `<div style="display:flex;align-items:center;justify-content:space-between;padding:.4rem .5rem;border-bottom:1px solid var(--border-2);font-size:.75rem">
                  <div>
                    <div style="font-weight:600;color:var(--navy)">${canSeeNames()?t.name:'Instructor'}</div>
                    <div style="font-size:.68rem;color:var(--muted)">${t.school}</div>
                  </div>
                  <div style="text-align:right">
                    <span style="font-weight:700;color:${crColor}">${t.surveyCompRate}%</span>
                    <div style="font-size:.68rem;color:var(--muted)">${t.surveySubmitted} of ${t.surveyEligible} sessions</div>
                  </div>
                </div>`;
              }).join('');
              return `<div class="po-ops-panel" style="border-left:3px solid #b91c1c">
                <div class="po-ops-panel-hd" style="color:#991b1b">📊 Low Survey Completion (&lt;${LOW_THRESHOLD}%)
                  <span style="font-weight:400;font-size:.7rem">${lowTutors.length} tutor${lowTutors.length>1?'s':''} · matched by Session ID</span>
                </div>
                <div class="po-ops-panel-body" style="padding:0">${rows}</div>
              </div>`;
            })()}

          </div>
        </div>

      </div>`;
    }

    // ── HR VIEW — Tutor attendance & payroll focus ───────────────────────
    // HR is non-analytical. Their ONE job in Pearl Ops: verify tutor attendance
    // is accurate for ADP/payroll and flag staffing gaps. No scholar analytics,
    // no sessions tab clutter — just "who needs my attention today?"
    function renderHRView() {
      const mc = document.getElementById('poMainContent'); if (!mc) return;

      // Build tutor list from _personMap (instructors only, across filtered schools)
      const filteredSchoolNames = new Set(filteredSchools().map(sc => sc.school));
      const tutors = Object.values(_personMap).filter(p =>
        p.role === 'Instructor' && filteredSchoolNames.has(p.school)
      );
      const totalTutors   = tutors.length;
      const needsReview   = tutors.filter(p => {
        const tot = p.attended + p.absent;
        return tot > 0 && (p.attended / tot * 100) < 80;
      });
      const critical      = needsReview.filter(p => {
        const tot = p.attended + p.absent;
        return tot > 0 && (p.attended / tot * 100) < 65;
      });
      // Weighted average — sum raw attended/absent (not avg of per-tutor rates)
      const totalTutAtt = tutors.reduce((s,p)=>s+p.attended,0);
      const totalTutAbs = tutors.reduce((s,p)=>s+p.absent,0);
      const avgAtt = (totalTutAtt+totalTutAbs) > 0
        ? Math.round(totalTutAtt/(totalTutAtt+totalTutAbs)*100) : 0;

      // Schools with vacancy interruptions (staffing gaps)
      const vacancySchools = filteredSchools().filter(sc =>
        sc.siReasons && sc.siReasons.some(r => r === 'Tutor Vacancy')
      ).map(sc => ({
        name: sc.school,
        district: sc.district,
        vacancyCount: sc.siReasons.filter(r => r === 'Tutor Vacancy').length
      })).sort((a,b) => b.vacancyCount - a.vacancyCount);

      const attCol  = avgAtt>=80?'#0d6e3a':avgAtt>=65?'#d97706':'#b91c1c';
      const revCol  = needsReview.length>0?'#b91c1c':'#0d6e3a';

      // ── Summary strip ────────────────────────────────────────────────────
      const summaryHTML = `
        <div class="sg-summary-strip">
          <div class="sg-stat" style="--sc:#0050c8">
            <div class="sg-stat-val" style="color:#0050c8">${totalTutors}</div>
            <div class="sg-stat-lbl">Active Tutors</div>
            <div class="sg-stat-sub">On roster this period</div>
          </div>
          <div class="sg-stat" style="--sc:${revCol}">
            <div class="sg-stat-val" style="color:${revCol}">${needsReview.length}</div>
            <div class="sg-stat-lbl">Need ADP Review</div>
            <div class="sg-stat-sub">${critical.length} below 65% · ${needsReview.length-critical.length} below 80%</div>
          </div>
          <div class="sg-stat" style="--sc:${attCol}">
            <div class="sg-stat-val" style="color:${attCol}">${avgAtt}%</div>
            <div class="sg-stat-lbl">Avg Tutor Attendance</div>
            <div class="sg-stat-sub">${avgAtt>=80?'Meeting 80% target':'Below 80% payroll threshold'}</div>
          </div>
          <div class="sg-stat" style="--sc:${vacancySchools.length>0?'#d97706':'#0d6e3a'}">
            <div class="sg-stat-val" style="color:${vacancySchools.length>0?'#d97706':'#0d6e3a'}">${vacancySchools.length}</div>
            <div class="sg-stat-lbl">Staffing Gaps</div>
            <div class="sg-stat-sub">${vacancySchools.length>0?'Sites with tutor vacancy interruptions':'All sites staffed'}</div>
          </div>
        </div>`;

      // ── ADP review list (tutors below 80%) ───────────────────────────────
      const reviewSorted = needsReview.slice().sort((a, b) => {
        const rA = (a.attended+a.absent)>0 ? a.attended/(a.attended+a.absent) : 1;
        const rB = (b.attended+b.absent)>0 ? b.attended/(b.attended+b.absent) : 1;
        return rA - rB; // worst first
      });

      let adpHTML = '';
      if (reviewSorted.length > 0) {
        const rows = reviewSorted.slice(0, 20).map(p => {
          const tot  = p.attended + p.absent;
          const rate = tot > 0 ? Math.round(p.attended / tot * 100) : 0;
          const col  = rate < 65 ? '#b91c1c' : '#d97706';
          const lvl  = rate < 65 ? 'sg-triage-crit' : 'sg-triage-high';
          const badge = rate < 65
            ? '<span class="sg-triage-badge" style="background:#fee2e2;color:#991b1b">🔴 Critical — Below 65%</span>'
            : '<span class="sg-triage-badge" style="background:#fef3c7;color:#92400e">🟡 Below 80% Threshold</span>';
          const name = canSeeNames() ? p.name : 'Instructor';
          return `<div class="sg-triage-item ${lvl}" onclick="po.drillPerson('${esc(p.uid)}')">
            <div class="sg-triage-left">
              ${badge}
              <div class="sg-triage-school">${name}</div>
              <div class="sg-triage-detail">${p.school} · ${p.district}</div>
            </div>
            <div class="sg-triage-right">
              <div style="font-size:1.25rem;font-weight:800;color:${col};font-family:system-ui,-apple-system,sans-serif;line-height:1">${rate}%</div>
              <div style="font-size:.6rem;color:var(--muted);margin:.1rem 0">${p.attended} present · ${p.absent} absent</div>
              <span style="font-size:.65rem;font-weight:700;background:#fee2e2;color:#991b1b;padding:.15rem .4rem;border-radius:4px">⚑ Verify ADP</span>
            </div>
          </div>`;
        }).join('');
        adpHTML = `
          <div class="sg-section">
            <div class="sg-section-hd sg-section-hd-warn">
              <span>⚑ Tutors Requiring ADP Attendance Review</span>
              <span style="font-weight:400;font-size:.7rem">${reviewSorted.length} tutor${reviewSorted.length!==1?'s':''} below 80% attendance threshold · click a tutor to see their full history</span>
            </div>
            <div class="sg-triage-list">${rows}</div>
          </div>`;
      } else {
        adpHTML = `
          <div class="sg-section">
            <div class="sg-section-hd" style="background:var(--met-bg);color:#065f46;border-bottom-color:#6ee7b7">
              <span>✓ All Tutors Meeting Attendance Threshold</span>
              <span style="font-weight:400;font-size:.7rem">No ADP review items at this time</span>
            </div>
          </div>`;
      }

      // ── Staffing gap list (vacancy interruptions) ────────────────────────
      let vacancyHTML = '';
      if (vacancySchools.length > 0) {
        const vRows = vacancySchools.map(v => `
          <div class="sg-triage-item sg-triage-high" onclick="po.drillSchool('${esc(v.name)}')">
            <div class="sg-triage-left">
              <span class="sg-triage-badge" style="background:#fef3c7;color:#92400e">Staffing Gap</span>
              <div class="sg-triage-school">${v.name}</div>
              <div class="sg-triage-detail">${v.district}</div>
            </div>
            <div class="sg-triage-right">
              <div style="font-size:1.25rem;font-weight:800;color:#d97706;font-family:system-ui,-apple-system,sans-serif;line-height:1">${v.vacancyCount}</div>
              <div style="font-size:.6rem;color:var(--muted);margin:.1rem 0 .4rem">vacancy sessions</div>
              <button class="sg-drill-btn">View school →</button>
            </div>
          </div>`).join('');
        vacancyHTML = `
          <div class="sg-section">
            <div class="sg-section-hd sg-section-hd-warn">
              <span>🏫 Sites with Open Staffing Gaps</span>
              <span style="font-weight:400;font-size:.7rem">Sessions flagged as Tutor Vacancy — coordinate with Programming to backfill</span>
            </div>
            <div class="sg-triage-list">${vRows}</div>
          </div>`;
      }

      // ── Terminated staff lookup for SEP badge (SY 2025-2026) ─────────────
      const _normTNhr = s => (s||'').toLowerCase().replace(/[^a-z ]/g,'').replace(/\s+/g,' ').trim().split(' ').filter(Boolean).sort().join(' ');
      const _termMapHR = {};
      try {
        (window.HR_EMPS||[]).forEach(e => {
          if (e.s === 'Active') return;
          if (!(e.y||[]).includes('2025-2026') && !(e._liveYears||[]).includes('2025-2026')) return;
          const nk = _normTNhr(e.n||'');
          if (nk) _termMapHR[nk] = true;
        });
      } catch(ignore) {}
      const _termKeysHR = Object.keys(_termMapHR);
      const _isTermHR = name => {
        const tk = _normTNhr(name);
        if (_termMapHR[tk]) return true;
        const tp = tk.split(' ');
        return _termKeysHR.some(dk => {
          const dp = dk.split(' ');
          return (tp.length >= 2 && tp.every(p => dp.includes(p))) ||
                 (dp.length >= 2 && dp.every(p => tp.includes(p)));
        });
      };
      const termTutorUidsHR = new Set(tutors.filter(p => _isTermHR(p.name)).map(p => p.uid));
      const termCountHR = termTutorUidsHR.size;

      // ── Separated staff callout strip ─────────────────────────────────────
      const separatedStaffHTML = termCountHR > 0 ? `
          <div class="sg-section" style="border-color:#bfdbfe">
            <div class="sg-section-hd" style="background:#eff6ff;color:#1e40af;border-bottom-color:#bfdbfe">
              <span>👤 ${termCountHR} Separated Staff in Pearl Data &mdash; SY 2025-2026</span>
              <span style="font-weight:400;font-size:.7rem">No longer active with NJTC &middot; their sessions still count in network totals &middot; export Pearl Ops PDF for adjusted KPIs</span>
            </div>
            <div style="padding:.75rem 1rem;font-size:.8rem;color:#1e3a8a;line-height:1.6;background:#f0f9ff;border-bottom:1px solid #bfdbfe">
              ${termCountHR} tutor${termCountHR!==1?'s':''}  tagged <strong style="background:#eff6ff;color:#1d4ed8;padding:.1rem .35rem;border-radius:3px;border:1px solid #bfdbfe;font-size:.7rem">SEP</strong> in the table below have been separated from NJTC for SY 2025-2026 but remain in Pearl data. Their attendance and survey records still contribute to all network aggregate metrics. Export the Pearl Ops PDF for a full breakdown with KPIs adjusted to exclude these staff.
            </div>
          </div>` : '';

      // ── All tutors — compact table (name, school, rate, counts) ─────────
      const allTutorRows = tutors.slice().sort((a, b) => {
        const rA = (a.attended+a.absent)>0 ? a.attended/(a.attended+a.absent) : 1;
        const rB = (b.attended+b.absent)>0 ? b.attended/(b.attended+b.absent) : 1;
        return rA - rB;
      }).map(p => {
        const tot  = p.attended + p.absent;
        const rate = tot > 0 ? Math.round(p.attended / tot * 100) : 0;
        const col  = rate>=80?'#0d6e3a':rate>=65?'#d97706':'#b91c1c';
        const name = canSeeNames() ? p.name : 'Instructor';
        const adpBadge = rate < 80
          ? '<span style="font-size:.6rem;font-weight:700;background:#fee2e2;color:#991b1b;padding:.1rem .35rem;border-radius:3px;margin-left:.375rem">⚑ ADP</span>'
          : '';
        const sepBadge = termTutorUidsHR.has(p.uid)
          ? '<span style="font-size:.6rem;font-weight:700;background:#eff6ff;color:#1d4ed8;padding:.1rem .35rem;border-radius:3px;margin-left:.375rem;border:1px solid #bfdbfe">SEP</span>'
          : '';
        return `<tr class="po-person-row" onclick="po.drillPerson('${esc(p.uid)}')">
          <td style="padding:.45rem .875rem;font-weight:600;color:var(--navy);font-size:.8125rem">${name}${adpBadge}${sepBadge}</td>
          <td style="padding:.45rem .875rem;font-size:.75rem;color:var(--muted)">${p.school}</td>
          <td style="text-align:center;padding:.45rem .875rem">
            <span style="font-size:.875rem;font-weight:800;color:${col};font-family:system-ui,-apple-system,sans-serif">${rate}%</span>
            <div class="po-sparkbar" style="margin:.2rem auto 0"><div class="po-sparkbar-fill" style="width:${rate}%;background:${col}"></div></div>
          </td>
          <td style="text-align:center;padding:.45rem .875rem;font-size:.75rem;color:var(--text)">${p.attended}</td>
          <td style="text-align:center;padding:.45rem .875rem;font-size:.75rem;color:var(--text)">${p.absent}</td>
        </tr>`;
      }).join('');

      mc.innerHTML = `
        <div class="sg-wrap">
          ${summaryHTML}
          ${adpHTML}
          ${vacancyHTML}
          ${separatedStaffHTML}
          <div class="sg-section">
            <div class="sg-section-hd" style="cursor:pointer"
                 onclick="po.toggleSection('sgHRAllTutors',this,'👥 All ${totalTutors} Tutors (collapsed) — click to expand','👥 All ${totalTutors} Tutors — click to collapse')">
              <span>👥 All ${totalTutors} Tutors (collapsed) — click to expand</span>
              <span style="font-weight:400;font-size:.7rem">sorted worst attendance first &middot; click any row to see history${termCountHR > 0 ? ' &nbsp;&middot;&nbsp; <span style="color:#1d4ed8;font-weight:600">' + termCountHR + ' SEP</span> tagged in blue' : ''}</span>
            </div>
            <div id="sgHRAllTutors" style="display:none;overflow-x:auto">
              <table style="width:100%;border-collapse:collapse">
                <thead><tr style="background:var(--surface-2)">
                  ${['Tutor','School','Attendance','Present','Absent'].map(h=>`<th style="padding:.375rem .875rem;font-size:.6rem;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:var(--muted);border-bottom:1px solid var(--border);text-align:${h==='Tutor'||h==='School'?'left':'center'};white-space:nowrap">${h}</th>`).join('')}
                </tr></thead>
                <tbody>${allTutorRows||'<tr><td colspan="5" style="text-align:center;padding:2rem;color:var(--muted)">No tutors match current filters.</td></tr>'}</tbody>
              </table>
            </div>
          </div>
        </div>`;
    }

    // ── FINANCE VIEW — Delivery hours & service completion focus ─────────
    // Finance is slightly analytical but needs plain-language context.
    // Their job in Pearl Ops: verify hours delivered match contracted scope,
    // identify billing risks, flag service gaps. Not interested in individual
    // tutor behavior — only aggregate delivery per school.
    function renderFinanceView() {
      const mc = document.getElementById('poMainContent'); if (!mc) return;

      const schools = filteredSchools();
      const allSess = filteredSessions();

      // Hours & delivery math
      const deliveredSess = allSess.filter(s => s.isDelivered && s.durMins > 0);
      const scheduledSess = allSess.filter(s => s.status === 'Scheduled');
      const totalMins     = deliveredSess.reduce((s,r) => s+r.durMins, 0);
      const totalHrs      = Math.floor(totalMins/60);
      const totalMinRem   = totalMins % 60;
      const totalSessionsAll = allSess.filter(s => s.status !== 'Cancelled').length;
      const completionPct = totalSessionsAll > 0
        ? Math.round(deliveredSess.length / totalSessionsAll * 100) : 0;
      const totalInterruptions = schools.reduce((s,sc) => s+sc.stuInterruptions, 0);

      // Estimate hours at risk from service interruptions
      // (interruption sessions not counted as delivered — rough estimate)
      const avgSessionMins = deliveredSess.length > 0
        ? Math.round(totalMins / deliveredSess.length) : 60;
      const interruptionMins = totalInterruptions * avgSessionMins;
      const interruptionHrs  = Math.round(interruptionMins / 60);

      const compCol = completionPct>=90?'#0d6e3a':completionPct>=75?'#d97706':'#b91c1c';
      const riskCol = interruptionHrs>50?'#b91c1c':interruptionHrs>10?'#d97706':'#0d6e3a';

      // ── Summary strip ────────────────────────────────────────────────────
      const summaryHTML = `
        <div class="sg-summary-strip">
          <div class="sg-stat" style="--sc:#0050c8">
            <div class="sg-stat-val" style="color:#0050c8">${totalHrs}h ${totalMinRem}m</div>
            <div class="sg-stat-lbl">Hours Delivered</div>
            <div class="sg-stat-sub">${deliveredSess.length.toLocaleString()} completed sessions</div>
          </div>
          <div class="sg-stat" style="--sc:${compCol}">
            <div class="sg-stat-val" style="color:${compCol}">${completionPct}%</div>
            <div class="sg-stat-lbl">Completion Rate</div>
            <div class="sg-stat-sub">${deliveredSess.length} of ${totalSessionsAll} non-cancelled sessions</div>
          </div>
          <div class="sg-stat" style="--sc:${riskCol}">
            <div class="sg-stat-val" style="color:${riskCol}">~${interruptionHrs}h</div>
            <div class="sg-stat-lbl">Hours at Risk</div>
            <div class="sg-stat-sub">${totalInterruptions} service interruptions · review for billing</div>
          </div>
          <div class="sg-stat" style="--sc:#6366f1">
            <div class="sg-stat-val" style="color:#6366f1">${schools.length}</div>
            <div class="sg-stat-lbl">Active Sites</div>
            <div class="sg-stat-sub">${scheduledSess.length} sessions still scheduled</div>
          </div>
        </div>`;

      // ── Schools with delivery risk (high interruption rate) ──────────────
      const riskSchools = schools.filter(sc => {
        const scSess = sc.sessions.filter(s => s.status !== 'Cancelled').length;
        return scSess > 0 && (sc.stuInterruptions / scSess) > 0.15; // >15% interruption rate
      }).sort((a,b) => b.stuInterruptions - a.stuInterruptions);

      let riskHTML = '';
      if (riskSchools.length > 0) {
        const rItems = riskSchools.slice(0,8).map(sc => {
          const scSess = sc.sessions.filter(s => s.status !== 'Cancelled').length;
          const intPct = scSess > 0 ? Math.round(sc.stuInterruptions/scSess*100) : 0;
          const estLost = Math.round(sc.stuInterruptions * avgSessionMins / 60);
          const hasCrit = sc.flags.some(f=>f.severity==='critical');
          return `<div class="sg-triage-item sg-triage-${hasCrit?'crit':'high'}" onclick="po.drillSchool('${esc(sc.school)}')">
            <div class="sg-triage-left">
              <span class="sg-triage-badge" style="background:${hasCrit?'#fee2e2':'#fef3c7'};color:${hasCrit?'#991b1b':'#92400e'}">${hasCrit?'High Interruption Risk':'Elevated Interruptions'}</span>
              <div class="sg-triage-school">${sc.school}</div>
              <div class="sg-triage-detail">${sc.district} · ${intPct}% of sessions interrupted · est. ~${estLost}h affected</div>
            </div>
            <div class="sg-triage-right">
              <div style="font-size:1.25rem;font-weight:800;color:${hasCrit?'#b91c1c':'#d97706'};font-family:system-ui,-apple-system,sans-serif;line-height:1">${sc.stuInterruptions}</div>
              <div style="font-size:.6rem;color:var(--muted);margin:.1rem 0 .4rem">interruptions</div>
              <button class="sg-drill-btn">View details →</button>
            </div>
          </div>`;
        }).join('');
        riskHTML = `
          <div class="sg-section">
            <div class="sg-section-hd sg-section-hd-warn">
              <span>⚠️ Sites with Elevated Interruption Risk</span>
              <span style="font-weight:400;font-size:.7rem">${riskSchools.length} site${riskSchools.length!==1?'s':''} with &gt;15% session interruption rate · may affect billing or contract compliance</span>
            </div>
            <div class="sg-triage-list">${rItems}</div>
          </div>`;
      }

      // ── Delivery table — pre-compute hours ONCE per school, then sort ────
      // Performance fix: sorting with inline filter+reduce = O(n log n × sessions).
      // Pre-compute into a plain array first, then sort O(n log n) on a number.
      const schoolData = schools.map(sc => {
        const scDelivered = sc.sessions.filter(s => s.isDelivered && s.durMins > 0);
        const scMins      = scDelivered.reduce((s,r)=>s+r.durMins, 0);
        const scTotal     = sc.sessions.filter(s=>s.status!=='Cancelled').length;
        return { sc, scDelivered, scMins, scTotal };
      }).sort((a,b) => b.scMins - a.scMins);

      const schoolRows = schoolData.map(({ sc, scDelivered, scMins, scTotal }) => {
        const scHrs       = Math.floor(scMins/60);
        const scMinRem    = scMins % 60;
        const scComp      = scTotal>0 ? Math.round(scDelivered.length/scTotal*100) : 0;
        const compCol     = scComp>=90?'#0d6e3a':scComp>=75?'#d97706':'#b91c1c';
        const intPct      = scTotal>0 ? Math.round(sc.stuInterruptions/scTotal*100) : 0;
        const intCol      = intPct>20?'#b91c1c':intPct>10?'#d97706':'var(--muted)';
        return `<tr class="po-school-row" onclick="po.drillSchool('${esc(sc.school)}')">
          <td style="padding:.45rem .875rem">
            <div style="font-weight:700;color:var(--navy);font-size:.8125rem">${sc.school}</div>
            <div style="font-size:.65rem;color:var(--muted)">${sc.district}</div>
          </td>
          <td style="text-align:center;padding:.45rem .875rem">
            <span style="font-size:.875rem;font-weight:800;color:#0050c8;font-family:system-ui,-apple-system,sans-serif">${scHrs}h ${scMinRem}m</span>
          </td>
          <td style="text-align:center;padding:.45rem .875rem;font-size:.8125rem;color:var(--navy)">${scDelivered.length}</td>
          <td style="text-align:center;padding:.45rem .875rem">
            <span style="font-weight:700;color:${compCol};font-size:.8125rem">${scComp}%</span>
          </td>
          <td style="text-align:center;padding:.45rem .875rem">
            <span style="font-weight:700;color:${intCol};font-size:.8125rem">${sc.stuInterruptions}</span>
            ${intPct>10?`<span style="font-size:.6rem;color:${intCol};display:block">${intPct}% of sessions</span>`:''}
          </td>
          <td style="text-align:center;padding:.45rem .875rem">
            <span style="font-size:.75rem;color:var(--blue-mid);font-weight:600">View →</span>
          </td>
        </tr>`;
      }).join('');

      mc.innerHTML = `
        <div class="sg-wrap">
          ${summaryHTML}
          ${riskHTML}
          <div class="sg-section">
            <div class="sg-section-hd" style="cursor:pointer"
                 onclick="po.toggleSection('sgFinanceTable',this,'📊 Delivery by Site (collapsed) — click to expand','📊 Delivery by Site — click to collapse')">
              <span>📊 Delivery by Site (collapsed) — click to expand</span>
              <span style="font-weight:400;font-size:.7rem">${schools.length} sites · sorted by hours delivered · click any row to drill in</span>
            </div>
            <div id="sgFinanceTable" style="display:none;overflow-x:auto">
              <table style="width:100%;border-collapse:collapse">
                <thead><tr style="background:var(--surface-2)">
                  ${['School / District','Hours Delivered','Sessions Done','Completion %','Interruptions',''].map(h=>`<th style="padding:.375rem .875rem;font-size:.6rem;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:var(--muted);border-bottom:1px solid var(--border);text-align:${h===''||h==='School / District'?'left':'center'};white-space:nowrap">${h}</th>`).join('')}
                </tr></thead>
                <tbody>${schoolRows||'<tr><td colspan="6" style="text-align:center;padding:2rem;color:var(--muted)">No data yet.</td></tr>'}</tbody>
              </table>
            </div>
          </div>
        </div>`;
    }

    // ── SCHOOL GRID — Dashboard view for programming team ────────────────
    // Card-based, status-first, plain language. System-ui font (no blur).
    // Fixed bugs vs v1:
    //   - Scholar att% is now WEIGHTED (sum raw totals) not avg-of-averages
    //   - Sessions = isDelivered only, not all sessions in _sessMap
    //   - Triage capped at 5 visible + expandable overflow (no endless scroll)
    //   - All Schools section collapsed by default (toggle to expand)
    function renderSchoolGrid() {
      const mc = document.getElementById('poMainContent'); if (!mc) return;

      // Sort: critical first → high → ok, then by attendance desc within each tier
      const schools = filteredSchools().sort((a, b) => {
        const sA = a.flags.some(f=>f.severity==='critical') ? 0 : a.flags.some(f=>f.severity==='high') ? 1 : 2;
        const sB = b.flags.some(f=>f.severity==='critical') ? 0 : b.flags.some(f=>f.severity==='high') ? 1 : 2;
        return sA !== sB ? sA - sB : b.attRate - a.attRate;
      });

      // Region helper
      const NE_KW = ['ilearn','i-learn','paterson','pcsst','paterson charter','hoboken','middlesex','central jersey'];
      const SW_KW = ['american paradigm','first philadelphia','first philly','philadelphia charter',
                     'string theory','global leadership academy','global leadership','penns grove',
                     'carneys point','haddon township','haddon','hamilton township','gloucester township'];
      const SW_SC = ['erial','loring flemming','field street','penns grove middle','van sciver',
                     'strawbridge','first philadelphia prep','first philly prep',
                     'the philadelphia charter','philadelphia charter school','global leadership academy'];
      function scRegion(sc) {
        const d = (sc.district||'').toLowerCase(), s = (sc.school||'').toLowerCase();
        if (NE_KW.some(k=>d.includes(k)||s.includes(k))) return 'NE';
        if (SW_KW.some(k=>d.includes(k))) return 'SW';
        if (SW_SC.some(k=>s.includes(k))) return 'SW';
        return 'NE';
      }

      // ── 1. Summary stats — WEIGHTED averages from raw school totals ───────
      // Bug fix: averaging sc.attRate per-school is unweighted (small schools
      // pull the number down equally as large schools). Sum raw attended/absent
      // for a true program-wide weighted rate matching the top stat bar.
      const critSchools = schools.filter(sc => sc.flags.some(f=>f.severity==='critical'));
      const highSchools = schools.filter(sc => !sc.flags.some(f=>f.severity==='critical') && sc.flags.some(f=>f.severity==='high'));
      const totalStudAtt = schools.reduce((s,sc)=>s+(sc.stuAttended||0),0);
      const totalStudAbs = schools.reduce((s,sc)=>s+(sc.stuAbsent||0),0);
      const avgAtt = (totalStudAtt+totalStudAbs) > 0
        ? Math.round(totalStudAtt/(totalStudAtt+totalStudAbs)*100) : 0;
      const allSurv = schools.map(sc=>sc.stuSurveyAvg).filter(v=>v>0);
      const avgSurv = allSurv.length ? (allSurv.reduce((a,b)=>a+b,0)/allSurv.length).toFixed(1) : '—';
      // Bug fix: count only delivered sessions (not all sessions in _sessMap)
      const totalDelivered = schools.reduce((s,sc)=>s+sc.sessions.filter(x=>x.isDelivered).length,0);
      const needsAttn = critSchools.length + highSchools.length;
      const attCol    = avgAtt>=85?'#0d6e3a':avgAtt>=75?'#d97706':'#b91c1c';
      const attnCol   = needsAttn>0?'#b91c1c':'#0d6e3a';
      const survColor = parseFloat(avgSurv)>=4.0?'#0d6e3a':parseFloat(avgSurv)>=3.5?'#d97706':'var(--muted)';

      const summaryHTML = `
        <div class="sg-summary-strip">
          <div class="sg-stat" style="--sc:${attCol}">
            <div class="sg-stat-val" style="color:${attCol}">${avgAtt}%</div>
            <div class="sg-stat-lbl">Scholar Attendance</div>
            <div class="sg-stat-sub">${avgAtt>=85?'Program on track':'Below 85% target — monitor closely'}</div>
          </div>
          <div class="sg-stat" style="--sc:${attnCol}">
            <div class="sg-stat-val" style="color:${attnCol}">${needsAttn}</div>
            <div class="sg-stat-lbl">Sites Need Attention</div>
            <div class="sg-stat-sub">${critSchools.length} critical · ${highSchools.length} watch · ${schools.length-needsAttn} on track</div>
          </div>
          <div class="sg-stat" style="--sc:#0050c8">
            <div class="sg-stat-val" style="color:#0050c8">${totalDelivered.toLocaleString()}</div>
            <div class="sg-stat-lbl">Sessions Delivered</div>
            <div class="sg-stat-sub">Completed across ${schools.length} sites</div>
          </div>
          <div class="sg-stat" style="--sc:${survColor}">
            <div class="sg-stat-val" style="color:${survColor}">${avgSurv}</div>
            <div class="sg-stat-lbl">Scholar Satisfaction</div>
            <div class="sg-stat-sub">${avgSurv!=='—'?'Average out of 5.0':'Survey data loading…'}</div>
          </div>
        </div>`;

      // ── 2. District Flags Overview ────────────────────────────────────────
      // Aggregate per-school flags up to district level — first indicator for
      // Programming: lets team see which districts have the most severe issues
      // before drilling into individual sites.
      const distFlagMap = {};
      schools.forEach(sc => {
        const d = sc.district || 'Unknown';
        if (!distFlagMap[d]) distFlagMap[d] = { name:d, sites:0, crit:0, high:0, med:0, topMsg:'', topSev:'' };
        distFlagMap[d].sites++;
        (sc.flags||[]).forEach(f => {
          if (f.severity==='critical') {
            distFlagMap[d].crit++;
            if (distFlagMap[d].topSev !== 'critical') { distFlagMap[d].topSev='critical'; distFlagMap[d].topMsg=f.msg; }
          } else if (f.severity==='high') {
            distFlagMap[d].high++;
            if (!distFlagMap[d].topSev) { distFlagMap[d].topSev='high'; distFlagMap[d].topMsg=f.msg; }
          } else { distFlagMap[d].med++; }
        });
      });
      const distFlagRows = Object.values(distFlagMap)
        .filter(d => d.crit || d.high || d.med)
        .sort((a,b) => (b.crit*100+b.high*10+b.med) - (a.crit*100+a.high*10+a.med));
      const allDistRows = Object.values(distFlagMap)
        .sort((a,b) => (b.crit*100+b.high*10+b.med) - (a.crit*100+a.high*10+a.med));
      let distFlagHTML = '';
      if (allDistRows.length > 1) { // only show when multiple districts present
        const hasCritDist = distFlagRows.some(d=>d.crit>0);
        distFlagHTML = `
          <div class="sg-section" style="border-left:3px solid ${hasCritDist?'#b91c1c':'#d97706'}">
            <div class="sg-section-hd" style="cursor:pointer;${hasCritDist?'background:#fef2f2;color:#991b1b;border-bottom-color:#fecaca':'background:#fffbeb;color:#92400e;border-bottom-color:#fde68a'}"
                 onclick="po.toggleSection('sgDistFlagBody',this,'🗺 District Flag Overview (collapsed)','🗺 District Flag Overview')">
              <span>🗺 District Flag Overview</span>
              <span style="font-weight:400;font-size:.7rem">${distFlagRows.length} of ${allDistRows.length} district${allDistRows.length!==1?'s':''} with flags · click to collapse</span>
            </div>
            <div id="sgDistFlagBody">
              <div style="overflow-x:auto">
                <table style="width:100%;border-collapse:collapse;font-size:.8rem">
                  <thead>
                    <tr style="background:#f8fafc">
                      <th style="text-align:left;padding:.4rem .75rem;font-size:.6875rem;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.04em">District</th>
                      <th style="text-align:center;padding:.4rem .5rem;font-size:.6875rem;font-weight:700;color:#64748b;text-transform:uppercase">Status</th>
                      <th style="text-align:center;padding:.4rem .5rem;font-size:.6875rem;font-weight:700;color:#dc2626;text-transform:uppercase">Critical</th>
                      <th style="text-align:center;padding:.4rem .5rem;font-size:.6875rem;font-weight:700;color:#d97706;text-transform:uppercase">High</th>
                      <th style="text-align:center;padding:.4rem .5rem;font-size:.6875rem;font-weight:700;color:#64748b;text-transform:uppercase">Sites</th>
                      <th style="text-align:left;padding:.4rem .75rem;font-size:.6875rem;font-weight:700;color:#64748b;text-transform:uppercase">Top Issue</th>
                      <th style="text-align:center;padding:.4rem .5rem;font-size:.6875rem;font-weight:700;color:#2563eb;text-transform:uppercase">Inquire</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${allDistRows.map(d => {
                      const sev   = d.crit>0?'critical':d.high>0?'high':d.med>0?'medium':'ok';
                      const stLbl = d.crit>0?'Critical':d.high>0?'Needs Attention':d.med>0?'Monitor':'On Track';
                      const stClr = d.crit>0?'#dc2626':d.high>0?'#d97706':d.med>0?'#0369a1':'#059669';
                      const stBg  = d.crit>0?'#fef2f2':d.high>0?'#fffbeb':d.med>0?'#eff6ff':'#f0fdf4';
                      const topTxt= d.topMsg ? d.topMsg.substring(0,70)+(d.topMsg.length>70?'…':'') : '—';
                      return `<tr style="border-bottom:1px solid #f1f5f9;cursor:pointer" onclick="po.filterByDistrict('${esc(d.name)}')" title="Click to filter Pearl Operations to ${esc(d.name)}">
                        <td style="padding:.45rem .75rem;font-weight:600;color:#1e293b">${d.name}</td>
                        <td style="padding:.45rem .5rem;text-align:center">
                          <span style="font-size:.6875rem;font-weight:700;padding:.15rem .5rem;border-radius:999px;color:${stClr};background:${stBg}">${stLbl}</span>
                        </td>
                        <td style="padding:.45rem .5rem;text-align:center;font-weight:700;color:${d.crit>0?'#dc2626':'#94a3b8'}">${d.crit>0?d.crit:'—'}</td>
                        <td style="padding:.45rem .5rem;text-align:center;font-weight:700;color:${d.high>0?'#d97706':'#94a3b8'}">${d.high>0?d.high:'—'}</td>
                        <td style="padding:.45rem .5rem;text-align:center;color:#64748b">${d.sites}</td>
                        <td style="padding:.45rem .75rem;color:#64748b;font-size:.72rem;max-width:260px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis" title="${esc(d.topMsg)}">${topTxt}</td>
                        <td style="padding:.45rem .5rem;text-align:center">
                          <button onclick="event.stopPropagation();po.openTicketModal({district:'${esc(d.name)}'})"
                            style="padding:.2rem .5rem;background:#eff6ff;border:1px solid #bfdbfe;color:#2563eb;border-radius:6px;font-size:.65rem;font-weight:700;cursor:pointer">📬</button>
                        </td>
                      </tr>`;
                    }).join('')}
                  </tbody>
                </table>
              </div>
            </div>
          </div>`;
      }

      // ── 4. Triage — show 5 visible, rest collapsed (no endless scroll) ───
      const triageAll = [...critSchools, ...highSchools];
      let triageHTML = '';
      if (triageAll.length > 0) {
        const TRIAGE_SHOW = 5;
        const visible  = triageAll.slice(0, TRIAGE_SHOW);
        const overflow = triageAll.slice(TRIAGE_SHOW);
        function triageItem(sc) {
          const hasCrit = sc.flags.some(f=>f.severity==='critical');
          const topFlag = sc.flags.find(f=>f.severity==='critical') || sc.flags.find(f=>f.severity==='high');
          const detail  = topFlag ? topFlag.msg
                        : sc.stuInterruptions > 0 ? `${sc.stuInterruptions} service interruptions this period`
                        : `${sc.attRate}% attendance — below target`;
          const aC = sc.attRate>=95?'#0d6e3a':sc.attRate>=80?'#d97706':'#b91c1c';
          return `<div class="sg-triage-item sg-triage-${hasCrit?'crit':'high'}" onclick="po.drillSchool('${esc(sc.school)}')">
            <div class="sg-triage-left">
              <span class="sg-triage-badge">${hasCrit?'🔴 Critical':'🟡 Watch'}</span>
              <div class="sg-triage-school">${sc.school}</div>
              <div class="sg-triage-detail">${esc(detail)}</div>
            </div>
            <div class="sg-triage-right">
              <div style="font-size:1.25rem;font-weight:800;color:${aC};font-family:system-ui,-apple-system,sans-serif;line-height:1">${sc.attRate}%</div>
              <div style="font-size:.6rem;color:var(--muted);margin:.1rem 0 .4rem">attendance</div>
              <button class="sg-drill-btn">View →</button>
            </div>
          </div>`;
        }
        const overflowBlock = overflow.length ? `
          <div id="sgTriageOverflow" style="display:none">
            ${overflow.map(triageItem).join('')}
          </div>
          <div style="text-align:center;padding:.5rem;border-top:1px solid var(--border-2)">
            <button onclick="po.toggleSection('sgTriageOverflow',this,'▼ Show ${overflow.length} more sites','▲ Show fewer')"
              style="font-size:.75rem;font-weight:700;color:var(--blue-mid);background:none;border:none;cursor:pointer;padding:.25rem .75rem">
              ▼ Show ${overflow.length} more sites
            </button>
          </div>` : '';
        triageHTML = `
          <div class="sg-section">
            <div class="sg-section-hd sg-section-hd-warn">
              <span>⚡ Sites Needing Your Attention</span>
              <span style="font-weight:400;font-size:.7rem">${triageAll.length} site${triageAll.length!==1?'s':''} · click any to see what's happening</span>
            </div>
            <div class="sg-triage-list">
              ${visible.map(triageItem).join('')}
              ${overflowBlock}
            </div>
          </div>`;
      }

      // ── 5. School cards — collapsed by default, toggle to expand ─────────
      function buildCard(sc) {
        const hasCrit  = sc.flags.some(f=>f.severity==='critical');
        const hasHigh  = sc.flags.some(f=>f.severity==='high');
        const aC       = sc.attRate>=90?'#0d6e3a':sc.attRate>=80?'#d97706':'#b91c1c';
        const region   = scRegion(sc);
        const survStr  = sc.stuSurveyAvg>0 ? `⭐ ${sc.stuSurveyAvg.toFixed(1)}` : '';
        // Bug fix: delivered sessions only
        const delivCnt = sc.sessions.filter(x=>x.isDelivered).length;
        const cardCls  = hasCrit ? 'sg-card-crit' : hasHigh ? 'sg-card-high' : 'sg-card-ok';
        const stLbl    = hasCrit ? 'CRITICAL' : hasHigh ? 'WATCH' : 'ON TRACK';
        const stCls    = hasCrit ? 'sg-status-crit' : hasHigh ? 'sg-status-high' : 'sg-status-ok';
        const details = [];
        if (sc.stuInterruptions > 0) {
          const cls = hasCrit ? 'sg-card-detail-crit' : 'sg-card-detail-warn';
          details.push(`<div class="sg-card-detail ${cls}">${hasCrit?'🚨':'⚠️'} ${sc.stuInterruptions} interruption${sc.stuInterruptions!==1?'s':''}</div>`);
        }
        if (sc.ratioViolations > 0)
          details.push(`<div class="sg-card-detail sg-card-detail-warn">⚑ ${sc.ratioViolations} over-ratio</div>`);
        if (survStr)
          details.push(`<div class="sg-card-detail">${survStr} scholar rating</div>`);
        if (isProg() || isData()) {
          const tcr = sc.tutorSurvCompRate;
          if (tcr !== null) {
            const tcrCol = tcr >= 80 ? '#0d6e3a' : tcr >= 60 ? '#d97706' : '#b91c1c';
            details.push(`<div class="sg-card-detail" style="color:${tcrCol}">📊 ${tcr}% survey completion (${sc.tutorSurvSubmitted}/${sc.tutorSurvEligible})</div>`);
          }
        }
        return `<div class="sg-card ${cardCls}" onclick="po.drillSchool('${esc(sc.school)}')">
          <div class="sg-card-top">
            <div style="flex:1;min-width:0">
              <div class="sg-card-name">${sc.school}</div>
              <div class="sg-card-dist">${sc.district}</div>
            </div>
            <span class="sg-region-pill">${region}</span>
          </div>
          <div class="sg-card-att">
            <span class="sg-card-att-val" style="color:${aC}">${sc.attRate}%</span>
            <div class="sg-att-bar"><div class="sg-att-bar-fill" style="width:${sc.attRate}%;background:${aC}"></div></div>
          </div>
          <div class="sg-card-meta"><span>${delivCnt} sessions</span></div>
          <div class="sg-card-details">${details.join('')||'<div class="sg-card-detail sg-card-detail-ok">✓ No issues</div>'}</div>
          <div class="sg-card-footer">
            <span class="sg-status-badge ${stCls}">${stLbl}</span>
            <span style="display:flex;gap:.4rem;align-items:center">
              <span onclick="event.stopPropagation();po.openTicketModal({region:'${region}',district:'${esc(sc.district)}',school:'${esc(sc.school)}'})"
                style="font-size:.63rem;color:#2563eb;font-weight:700;cursor:pointer;background:#eff6ff;border:1px solid #bfdbfe;border-radius:5px;padding:.18rem .4rem"
                title="Submit a data request or question about this school">📬</span>
              <span style="font-size:.7rem;color:var(--blue-mid);font-weight:600">View →</span>
            </span>
          </div>
        </div>`;
      }
      const cards = schools.map(buildCard).join('');

      // ── 6. Tutor quick-find panel (shown when search query matches tutor names) ──
      const matchedTutors = searchMatchedTutors();
      const tutorSearchHTML = matchedTutors.length > 0 ? `
        <div class="sg-section" style="border-left:3px solid #6366f1">
          <div class="sg-section-hd" style="color:#3730a3;background:#eef2ff;border-bottom-color:#c7d2fe">
            <span>🔍 Tutors Matching "${esc(_poGlobalQ)}"</span>
            <span style="font-weight:400;font-size:.7rem">${matchedTutors.length} result${matchedTutors.length!==1?'s':''} · click to open tutor profile</span>
          </div>
          <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:.5rem;padding:.75rem 1rem">
            ${matchedTutors.map(p => {
              const cr = p.surveyCompRate;
              const crColor = cr===null?'var(--muted)':cr>=80?'#0d6e3a':cr>=60?'#d97706':'#b91c1c';
              const crStr   = cr===null ? '—' : cr+'%';
              const attTotal = p.attended + p.absent;
              const attRate  = attTotal > 0 ? Math.round(p.attended/attTotal*100) : 0;
              const attColor = attRate>=80?'#0d6e3a':attRate>=65?'#d97706':'#b91c1c';
              return `<div onclick="po.drillPerson('${esc(p.uid)}')"
                style="background:#fff;border:1px solid #c7d2fe;border-radius:10px;padding:.625rem .875rem;cursor:pointer;
                       transition:box-shadow .15s" onmouseenter="this.style.boxShadow='0 0 0 2px #6366f1'"
                onmouseleave="this.style.boxShadow=''">
                <div style="font-weight:700;font-size:.875rem;color:#1e1b4b;margin-bottom:.2rem">${canSeeNames()?p.name:'Instructor'}</div>
                <div style="font-size:.7rem;color:var(--muted);margin-bottom:.375rem">${p.school}</div>
                <div style="display:flex;gap:.75rem;font-size:.75rem">
                  <span>📋 Att: <strong style="color:${attColor}">${attRate}%</strong></span>
                  <span>📊 Survey: <strong style="color:${crColor}">${crStr}</strong>
                    ${cr!==null?`<span style="color:var(--muted);font-size:.68rem">(${p.surveySubmitted}/${p.surveyEligible})</span>`:''}
                  </span>
                </div>
              </div>`;
            }).join('')}
          </div>
        </div>` : '';

      // ── 7. Late survey filers ────────────────────────────────────────────
      const lf = computeTutorLateFilersStats();
      const lateFilerHTML = lf.totalFlagged ? `
        <div class="sg-section" style="border-left:3px solid #d97706">
          <div class="sg-section-hd" style="color:#92400e;background:#fef3c7;border-bottom-color:#fde68a;cursor:pointer"
               onclick="po.toggleSection('sgLateBody',this,'🕐 Tutors Submitting Surveys Late (${lf.totalFlagged})','🕐 Tutors Submitting Surveys Late (${lf.totalFlagged})')">
            <span>🕐 Tutors Submitting Surveys Late (${lf.totalFlagged})</span>
            <span style="font-weight:400;font-size:.7rem">surveys filed 50%+ after session date · click to ${lf.totalFlagged>3?'expand':'collapse'}</span>
          </div>
          <div id="sgLateBody" style="${lf.totalFlagged>3?'display:none':''}">
            <div style="display:flex;flex-wrap:wrap;gap:.5rem;padding:.75rem 1rem">
              ${lf.flagged.slice(0,12).map(t=>`<div class="sg-late-chip">
                <span style="font-weight:700;color:var(--navy)">${t.name}</span>
                <span style="color:#d97706;font-weight:700">${t.lateRate}% late</span>
                <span style="color:var(--muted);font-size:.65rem">${t.school}</span>
              </div>`).join('')}
            </div>
          </div>
        </div>` : '';

      mc.innerHTML = `
        <div class="sg-wrap">
          ${summaryHTML}
          ${tutorSearchHTML}
          ${distFlagHTML}
          ${triageHTML}
          <div class="sg-section">
            <div class="sg-section-hd" style="cursor:pointer" onclick="po.toggleSection('sgAllSchoolsBody',this,'📋 All ${schools.length} Sites (collapsed) — click to expand','📋 All ${schools.length} Sites — click to collapse')">
              <span>📋 All ${schools.length} Sites (collapsed) — click to expand</span>
              <span style="font-weight:400;font-size:.7rem">critical first · click any card to drill in</span>
            </div>
            <div id="sgAllSchoolsBody" style="display:none">
              <div class="sg-card-grid">${cards||'<div style="padding:2rem;text-align:center;color:var(--muted)">No schools match.</div>'}</div>
            </div>
          </div>
          ${lateFilerHTML}
        </div>`;
    }

    // ── SCHOOL DETAIL VIEW ────────────────────────────────────────────────
    function renderSchoolDetail() {
      const mc = document.getElementById('poMainContent'); if (!mc) return;
      const sc = _schoolMap[_selSchool]; if (!sc) {
        if (role()==='hr') renderHRView();
        else if (role()==='finance') renderFinanceView();
        else renderSchoolGrid();
        return;
      }
      const tabs = buildSchoolTabs();
      mc.innerHTML = `
        <div class="po-detail-card">
          <div class="po-section-hd">
            <div>
              <span style="font-size:.875rem;font-weight:700;color:var(--navy)">${sc.school}</span>
              <span style="font-size:.75rem;color:var(--muted);margin-left:.75rem">${sc.district}</span>
            </div>
            <div style="display:flex;gap:.5rem;flex-wrap:wrap;align-items:center">
              ${sc.flags.map(f => `<span class="po-severity-${f.severity}" title="${f.msg}">${f.msg.substring(0,40)}…</span>`).join('')}
              <button onclick="po.openTicketModal({region:'${_poRegion(sc.school,sc.district)}',district:'${esc(sc.district)}',school:'${esc(sc.school)}'})"
                style="padding:.25rem .65rem;background:#eff6ff;border:1px solid #bfdbfe;color:#2563eb;border-radius:7px;font-size:.72rem;font-weight:700;cursor:pointer;display:inline-flex;align-items:center;gap:.3rem">
                📬 Inquire
              </button>
            </div>
          </div>
          <div class="po-tabs-bar" id="poSchoolTabsBar">
            ${tabs.map(t=>`<button class="po-tab${_activeTab===t.id?' po-tab-active':''}" onclick="po.switchTab('${t.id}')">${t.label}</button>`).join('')}
          </div>
          <div id="poSchoolTabContent"></div>
        </div>`;
      renderSchoolTab(_activeTab);
    }

    function buildSchoolTabs() {
      const tabs = [{ id:'attendance', label:'📋 Attendance' }];
      if (isProg() || isHR() || isData()) tabs.push({ id:'sessions', label:'📅 Sessions' });
      tabs.push({ id:'interruptions', label:'⚠️ Interruptions' });
      if (isTD() || isData()) tabs.push({ id:'surveys', label:'⭐ Surveys' });
      if (isData()) tabs.push({ id:'hit', label:'🚩 HIT Compliance' });
      return tabs;
    }

    function switchTab(tabId) {
      _activeTab = tabId;
      // Update active tab button
      document.querySelectorAll('#poSchoolTabsBar .po-tab').forEach(btn => {
        btn.classList.toggle('po-tab-active', btn.textContent.includes(tabId) || btn.getAttribute('onclick').includes(`'${tabId}'`));
      });
      renderSchoolTab(tabId);
    }

    function renderSchoolTab(tab) {
      const el = document.getElementById('poSchoolTabContent'); if (!el) return;
      const sc = _schoolMap[_selSchool]; if (!sc) return;

      if (tab === 'attendance')     el.innerHTML = renderAttendanceTab(sc);
      else if (tab === 'sessions')  el.innerHTML = renderSessionsTab(sc);
      else if (tab === 'interruptions') el.innerHTML = renderInterruptionsTab(sc);
      else if (tab === 'surveys')   el.innerHTML = renderSurveysTab(sc);
      else if (tab === 'hit')       el.innerHTML = renderHITTab(sc);
    }


    // ── DEMOGRAPHICS ATTENDANCE BREAKDOWN ────────────────────────────────
    // Computes attendance rate grouped by a demographic field (race or sex).
    // Only active scholars (attended >= 1) are included.
    // Returns sorted array: { label, attended, absent, rate, pct }
    function buildDemographicsBreakdown(scholars, field) {
      const map = {};
      for (const p of scholars) {
        if (p.role !== 'Student') continue;
        const key = (p[field] || '').trim() || 'Not Reported';
        if (!map[key]) map[key] = { attended: 0, absent: 0 };
        map[key].attended += p.attended;
        map[key].absent   += p.absent;
      }
      const total = Object.values(map).reduce((s, v) => s + v.attended + v.absent, 0);
      return Object.entries(map)
        .map(([label, v]) => {
          const sessions = v.attended + v.absent;
          return {
            label,
            attended: v.attended,
            absent:   v.absent,
            rate:     sessions > 0 ? Math.round(v.attended / sessions * 100) : 0,
            pct:      total > 0    ? Math.round((v.attended + v.absent) / total * 100) : 0,
          };
        })
        .sort((a, b) => b.attended + b.absent - (a.attended + a.absent)); // sort by volume desc
    }

    // ── RENDER DEMOGRAPHICS SECTION ──────────────────────────────────────
    function renderDemographicsSection(scholars) {
      // Only show for roles that include students
      const activeScholars = scholars.filter(p => p.role === 'Student' && p.attended > 0);
      if (activeScholars.length === 0) return '';

      function buildTable(breakdown, heading) {
        const rows = breakdown.map(r => {
          const barW = Math.max(2, r.rate);
          const col  = r.rate >= 90 ? 'var(--met)' : r.rate >= 75 ? '#d97706' : 'var(--notmet)';
          return `<tr style="font-size:.8rem;border-bottom:1px solid var(--border-2)">
            <td style="padding:.4rem .75rem;color:var(--text);font-weight:500;min-width:140px">${r.label}</td>
            <td style="padding:.4rem .75rem;text-align:center;font-weight:700;color:${col}">${r.rate}%</td>
            <td style="padding:.4rem .75rem;text-align:center;color:var(--text-2)">${r.attended}</td>
            <td style="padding:.4rem .75rem;text-align:center;color:var(--text-2)">${r.absent}</td>
            <td style="padding:.4rem 1rem;min-width:100px">
              <div style="background:var(--border-2);border-radius:4px;height:6px;overflow:hidden">
                <div style="width:${barW}%;height:100%;background:${col};border-radius:4px"></div>
              </div>
            </td>
          </tr>`;
        }).join('');
        const thS = 'padding:.35rem .75rem;text-align:left;font-size:.6rem;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:var(--muted);white-space:nowrap';
        return `
          <div>
            <div style="font-size:.7rem;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:var(--muted);margin-bottom:.5rem">${heading}</div>
            <div style="overflow-x:auto;border:1px solid var(--border-2);border-radius:var(--radius)">
              <table style="width:100%;border-collapse:collapse">
                <thead>
                  <tr style="background:var(--surface-2)">
                    <th style="${thS}">Category</th>
                    <th style="${thS};text-align:center">Att. Rate</th>
                    <th style="${thS};text-align:center">Attended</th>
                    <th style="${thS};text-align:center">Absent</th>
                    <th style="${thS}">Rate Bar</th>
                  </tr>
                </thead>
                <tbody>${rows}</tbody>
              </table>
            </div>
          </div>`;
      }

      const raceBreakdown = buildDemographicsBreakdown(activeScholars, 'race');
      const sexBreakdown  = buildDemographicsBreakdown(activeScholars, 'sex');

      return `
        <div style="margin-bottom:1.25rem">
          <div style="font-size:.75rem;font-weight:700;color:var(--navy);margin-bottom:.75rem">
            📊 Attendance by Demographics
            <span style="font-size:.65rem;font-weight:400;color:var(--muted);margin-left:.5rem">Active scholars only · session-level counts</span>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem">
            ${buildTable(raceBreakdown, 'By Race / Ethnicity')}
            ${buildTable(sexBreakdown,  'By Sex')}
          </div>
        </div>`;
    }

    function renderAttendanceTab(sc) {
      // Respect the global role filter
      const roleFilter = _filtRole; // array of selected roles

      const persons = Object.values(_personMap)
        .filter(p => p.school === sc.school && (!roleFilter.length || roleFilter.includes(p.role)))
        .sort((a, b) => {
          const aRate = a.attended / Math.max(1, a.attended + a.absent);
          const bRate = b.attended / Math.max(1, b.attended + b.absent);
          return aRate - bRate;
        });

      const students    = (roleFilter.length && !roleFilter.includes('Student'))    ? [] : persons.filter(p => p.role === 'Student');
      const instructors = (roleFilter.length && !roleFilter.includes('Instructor')) ? [] : persons.filter(p => p.role === 'Instructor');

      const thStyle = 'padding:.4rem .875rem;text-align:left;font-size:.6rem;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--muted);border-bottom:1px solid var(--border)';

      // ── Scholar row ─────────────────────────────────────────────────
      const renderScholarRow = (p) => {
        const total = p.attended + p.absent;
        const rate  = total > 0 ? Math.round(p.attended / total * 100) : 0;
        const color = rate >= 90 ? 'var(--met)' : rate >= 75 ? 'var(--gold)' : 'var(--notmet)';
        const flagCount = p.flags.length;
        const name = canSeeNames() ? p.name : 'Scholar';
        const adpFlag = isHR() || isFinance() ? (rate < 70 ? '<span class="po-badge po-badge-red" title="Low attendance">\u2691 Check ADP</span>' : '') : '';

        // Tutor assignment + minutes per subject
        let tutorCell = '<td style="color:var(--muted);font-size:.75rem;padding:.5rem .875rem">\u2014</td>';
        if (p.subjectTutors) {
          const subjects = Object.keys(p.subjectTutors).filter(s => s).sort();
          if (subjects.length) {
            const parts = subjects.map(subj => {
              const st = p.subjectTutors[subj] || {};
              const primary = Object.values(st.primary || {});
              const numSubs = Object.keys(st.subs || {}).length;
              const mins = (p.subjectMinutes && p.subjectMinutes[subj]) || 0;
              const minsStr = mins > 0 ? (' <span style="color:var(--muted);font-size:.7rem">(' + (mins >= 60 ? Math.floor(mins/60) + 'h ' + (mins%60 > 0 ? mins%60 + 'm' : '') : mins + 'm') + ')</span>') : '';
              const hasIssue = primary.length > 1;
              const firstName = n => n.split(' ').slice(0,2).join(' ');
              if (!primary.length) return '<span style="color:var(--muted)">' + subj + ': \u2014</span>';
              if (hasIssue) return '<span style="color:#92400e" title="' + primary.join(', ') + '">' + subj + ': ' + primary.map(firstName).join(', ') + ' <span class="po-badge po-badge-gold" style="font-size:.6rem;padding:.1rem .3rem">\u26a0 ' + primary.length + '</span></span>' + minsStr;
              const subNote = numSubs > 0 ? ' <span style="color:var(--muted);font-size:.7rem">(+' + numSubs + ' sub)</span>' : '';
              return '<span title="' + primary[0] + '">' + subj + ': ' + firstName(primary[0]) + subNote + '</span>' + minsStr;
            });
            tutorCell = '<td style="font-size:.75rem;color:var(--navy);line-height:1.7;padding:.5rem .875rem">' + parts.join('<br>') + '</td>';
          }
        }

        const consecBadge = p.consecStatus === 'Attendance Concern'
          ? '<span class="po-badge po-badge-critical">Concern</span>'
          : '<span class="po-badge po-badge-green">Good</span>';
        return '<tr class="po-person-row" onclick="po.drillPerson(\'' + esc(p.uid) + '\')">'
          + '<td style="font-weight:600;color:var(--navy);padding:.5rem .875rem">' + name + '</td>'
          + '<td style="color:var(--muted);padding:.5rem .875rem">' + (p.grade || '\u2014') + '</td>'
          + '<td style="text-align:center;padding:.5rem .875rem">'
          +   '<span style="font-weight:600;color:' + color + '">' + rate + '%</span>'
          +   '<div class="po-sparkbar" style="margin:.2rem auto 0"><div class="po-sparkbar-fill" style="width:' + rate + '%;background:' + color + '"></div></div>'
          + '</td>'
          + '<td style="text-align:center;color:var(--text);font-size:.8125rem;padding:.5rem .875rem">' + p.attended + '</td>'
          + '<td style="text-align:center;color:var(--text);font-size:.8125rem;padding:.5rem .875rem">' + p.absent + '</td>'
          + '<td style="text-align:center;padding:.5rem .875rem">' + (p.interruptions > 0 ? '<span class="po-badge po-badge-gold">' + p.interruptions + '</span>' : '<span style="color:var(--muted)">0</span>') + '</td>'
          + '<td style="padding:.5rem .875rem">' + consecBadge + '</td>'
          + '<td style="padding:.5rem .875rem">' + (flagCount > 0 ? '<span class="po-badge po-badge-red">\ud83d\udea9 ' + flagCount + ' flag' + (flagCount>1?'s':'') + '</span>' : '<span class="po-badge po-badge-green">\u2713 OK</span>') + adpFlag + '</td>'
          + tutorCell
          + '</tr>';
      };

      // ── Instructor row ───────────────────────────────────────────────
      const renderInstructorRow = (p) => {
        const total = p.attended + p.absent;
        const rate  = total > 0 ? Math.round(p.attended / total * 100) : 0;
        const color = rate >= 80 ? 'var(--met)' : rate >= 65 ? 'var(--gold)' : 'var(--notmet)';
        const flagCount = p.flags.length;
        const name = canSeeNames() ? p.name : 'Instructor';
        const adpFlag = isHR() || isFinance() ? (rate < 80 ? '<span class="po-badge po-badge-red" title="Below 80% — verify ADP">\u2691 Check ADP</span>' : '') : '';

        // Subjects this instructor teaches at this school (from sessions)
        const subjSet = new Set();
        Object.values(_sessMap).forEach(sess => {
          if (sess.school === sc.school && sess.instId === p.uid) subjSet.add(sess.subject || '');
        });
        const subjList = Array.from(subjSet).filter(s => s).join(', ') || '\u2014';

        // Scholars assigned to this instructor
        const scholarIds = new Set();
        Object.values(_sessMap).forEach(sess => {
          if (sess.school === sc.school && sess.instId === p.uid && sess.isDelivered) {
            sess.studentIds.forEach(id => scholarIds.add(id));
          }
        });
        const scholarCount = scholarIds.size;

        // Survey completion cell (prog/data only)
        const crCell = (isProg() || isData()) ? (() => {
          const cr = p.surveyCompRate;
          if (cr === null) return '<td style="text-align:center;color:var(--muted);padding:.5rem .875rem;font-size:.75rem">\u2014</td>';
          const crCol = cr >= 80 ? 'var(--met)' : cr >= 60 ? '#d97706' : 'var(--notmet)';
          return '<td style="text-align:center;padding:.5rem .875rem">'
            + '<span style="font-weight:700;color:' + crCol + '">' + cr + '%</span>'
            + '<div style="font-size:.65rem;color:var(--muted)">' + p.surveySubmitted + '/' + p.surveyEligible + '</div>'
            + '</td>';
        })() : '';

        return '<tr class="po-person-row" onclick="po.drillPerson(\'' + esc(p.uid) + '\')">'
          + '<td style="font-weight:600;color:var(--navy);padding:.5rem .875rem">' + name + '</td>'
          + '<td style="color:var(--muted);padding:.5rem .875rem;font-size:.75rem">' + subjList + '</td>'
          + '<td style="text-align:center;padding:.5rem .875rem">'
          +   '<span style="font-weight:600;color:' + color + '">' + rate + '%</span>'
          +   '<div class="po-sparkbar" style="margin:.2rem auto 0"><div class="po-sparkbar-fill" style="width:' + rate + '%;background:' + color + '"></div></div>'
          + '</td>'
          + '<td style="text-align:center;color:var(--text);font-size:.8125rem;padding:.5rem .875rem">' + p.attended + '</td>'
          + '<td style="text-align:center;color:var(--text);font-size:.8125rem;padding:.5rem .875rem">' + p.absent + '</td>'
          + '<td style="text-align:center;color:var(--muted);padding:.5rem .875rem">' + scholarCount + '</td>'
          + crCell
          + '<td style="padding:.5rem .875rem">' + (flagCount > 0 ? '<span class="po-badge po-badge-red">\ud83d\udea9 ' + flagCount + '</span>' : '<span class="po-badge po-badge-green">\u2713 OK</span>') + adpFlag + '</td>'
          + '</tr>';
      };

      // ── School-level mini stats ───────────────────────────────────────
      const stuTheads = '<tr style="background:var(--surface-2)">'
        + '<th style="' + thStyle + '">Scholar</th>'
        + '<th style="' + thStyle + '">Grade</th>'
        + '<th style="' + thStyle + ';text-align:center">Att. Rate</th>'
        + '<th style="' + thStyle + ';text-align:center">Attended</th>'
        + '<th style="' + thStyle + ';text-align:center">Absent</th>'
        + '<th style="' + thStyle + ';text-align:center">Interrupts</th>'
        + '<th style="' + thStyle + '">Consec.</th>'
        + '<th style="' + thStyle + '">Flags</th>'
        + '<th style="' + thStyle + '">Tutor(s) · Minutes</th>'
        + '</tr>';

      const instTheads = '<tr style="background:var(--surface-2)">'
        + '<th style="' + thStyle + '">Tutor</th>'
        + '<th style="' + thStyle + '">Subject(s)</th>'
        + '<th style="' + thStyle + ';text-align:center">Att. Rate</th>'
        + '<th style="' + thStyle + ';text-align:center">Attended</th>'
        + '<th style="' + thStyle + ';text-align:center">Absent</th>'
        + '<th style="' + thStyle + ';text-align:center">Scholars</th>'
        + ((isProg() || isData()) ? '<th style="' + thStyle + ';text-align:center" title="Survey Completion Rate — surveys submitted vs eligible delivered sessions">Survey %</th>' : '')
        + '<th style="' + thStyle + '">Flags</th>'
        + '</tr>';

      const miniStats = (!roleFilter.length || roleFilter.includes('Student')) ? `
        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:.875rem;margin-bottom:1.25rem">
          ${[
            ['Scholar Attendance', sc.attRate+'%', sc.attRate>=90?'var(--met)':sc.attRate>=75?'var(--gold)':'var(--notmet)'],
            ['Attended Sessions',  sc.stuAttended.toLocaleString(), 'var(--met)'],
            ['Student Absences',   sc.stuAbsent.toLocaleString(), 'var(--notmet)'],
            ['Service Interruptions', sc.stuInterruptions.toLocaleString(), 'var(--partial)'],
          ].map(([lbl,val,col]) => `<div style="background:var(--surface-2);padding:.875rem;border-radius:var(--radius);border:1px solid var(--border)">
            <div style="font-size:.625rem;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:var(--muted)">${lbl}</div>
            <div style="font-family:'DM Serif Display',serif;font-size:1.5rem;font-weight:700;color:${col};margin-top:.2rem">${val}</div>
          </div>`).join('')}
        </div>` : `
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:.875rem;margin-bottom:1.25rem">
          ${[
            ['Tutors on Site', instructors.length, 'var(--blue-mid)'],
            ['Avg Tutor Att.', instructors.length ? Math.round(instructors.reduce((s,p) => s + p.attended/Math.max(1,p.attended+p.absent)*100, 0)/instructors.length) + '%' : '—', 'var(--met)'],
            ['Total Scholar Caseload', (() => { const ids = new Set(); instructors.forEach(p => { Object.values(_sessMap).forEach(sess => { if(sess.school===sc.school&&sess.instId===p.uid&&sess.isDelivered) sess.studentIds.forEach(id=>ids.add(id)); }); }); return ids.size; })(), 'var(--navy)'],
          ].map(([lbl,val,col]) => `<div style="background:var(--surface-2);padding:.875rem;border-radius:var(--radius);border:1px solid var(--border)">
            <div style="font-size:.625rem;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:var(--muted)">${lbl}</div>
            <div style="font-family:'DM Serif Display',serif;font-size:1.5rem;font-weight:700;color:${col};margin-top:.2rem">${val}</div>
          </div>`).join('')}
        </div>`;

      return `
        <div style="padding:1.25rem 1.5rem 0">
          ${miniStats}
          ${(!roleFilter.length || roleFilter.includes('Student')) ? renderDemographicsSection(persons) : ''}
        </div>
        <div style="padding:0 1.5rem 1.5rem">
          ${students.length > 0 ? `
          <div style="font-size:.75rem;font-weight:700;color:var(--navy);margin-bottom:.5rem">Active Scholars (${students.filter(p => p.attended > 0).length} of ${students.length})</div>
          <div style="overflow-x:auto;margin-bottom:1.5rem">
            <table style="width:100%;border-collapse:collapse;font-size:.8125rem">
              <thead>${stuTheads}</thead>
              <tbody>${students.map(renderScholarRow).join('') || '<tr><td colspan="9" style="text-align:center;padding:1.5rem;color:var(--muted)">No scholars found</td></tr>'}</tbody>
            </table>
          </div>` : ''}
          ${instructors.length > 0 ? `
          <div style="font-size:.75rem;font-weight:700;color:var(--navy);margin-bottom:.5rem">Tutors (${instructors.length})</div>
          <div style="overflow-x:auto">
            <table style="width:100%;border-collapse:collapse;font-size:.8125rem">
              <thead>${instTheads}</thead>
              <tbody>${instructors.map(renderInstructorRow).join('')}</tbody>
            </table>
          </div>` : ''}
          ${students.length === 0 && instructors.length === 0 ? '<div style="text-align:center;padding:2rem;color:var(--muted)">No records found for selected filters</div>' : ''}
        </div>`;
    }
    function renderSessionsTab(sc) {
      const sessions = sc.sessions.sort((a,b) => new Date(b.start) - new Date(a.start)).slice(0, 100);
      const rows = sessions.map(s => {
        const statusColor = s.status === 'Completed' ? 'var(--met)' : s.status === 'Missed' ? 'var(--notmet)' : 'var(--partial)';
        const ratioFlag = s.ratioFlag ? `<span class="po-badge po-badge-red" title="Exceeds 1:4 ratio — check MOU">⚑ ${s.ratio}:1</span>` : `<span class="po-badge po-badge-green">✓ ${s.ratio}:1</span>`;
        return `<tr style="font-size:.8125rem">
          <td style="padding:.5rem .875rem;border-bottom:1px solid var(--border-2)">${s.start||'—'}</td>
          <td style="padding:.5rem .875rem;border-bottom:1px solid var(--border-2);font-weight:600;color:var(--navy);max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${s.title}">${s.title}</td>
          <td style="padding:.5rem .875rem;border-bottom:1px solid var(--border-2)">${s.instructor||'—'}</td>
          <td style="padding:.5rem .875rem;border-bottom:1px solid var(--border-2)"><span style="font-weight:600;color:${statusColor}">${s.status}</span></td>
          <td style="padding:.5rem .875rem;border-bottom:1px solid var(--border-2);text-align:center">${ratioFlag}</td>
          <td style="padding:.5rem .875rem;border-bottom:1px solid var(--border-2)">${s.subject||'—'}</td>
          <td style="padding:.5rem .875rem;border-bottom:1px solid var(--border-2)">${s.schedDur||'—'}</td>
        </tr>`;
      }).join('');
      return `<div style="padding:1.5rem"><div style="font-size:.75rem;color:var(--muted);margin-bottom:.75rem">Most recent ${Math.min(100,sessions.length)} of ${sc.sessions.length} sessions · Ratio flag = exceeds 1:4 (check MOU per school contract)</div>
        <div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse">
          <thead><tr style="background:var(--surface-2)">${['Date','Session Title','Instructor','Status','Scholar Ratio','Subject','Duration'].map(h=>`<th style="padding:.4rem .875rem;text-align:left;font-size:.625rem;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--muted);border-bottom:1px solid var(--border);white-space:nowrap">${h}</th>`).join('')}</tr></thead>
          <tbody>${rows || '<tr><td colspan="7" style="text-align:center;padding:2rem;color:var(--muted)">No sessions found</td></tr>'}</tbody>
        </table></div></div>`;
    }

    function renderInterruptionsTab(sc) {
      const siRows = sc.rows.filter(r => classifyRecord(r) === 'service_interruption' && r[ATT.ROLE] === 'Student');
      const grouped = {};
      for (const r of siRows) {
        const reason = r[ATT.MISS_REASON] || 'Unknown';
        if (!grouped[reason]) grouped[reason] = [];
        grouped[reason].push(r);
      }
      const sorted = Object.entries(grouped).sort((a,b) => {
        const order = {critical:0, high:1, medium:2, low:3};
        return (order[getSISeverity(a[0])]||2) - (order[getSISeverity(b[0])]||2);
      });

      const groupRows = sorted.map(([reason, recs]) => {
        const sev        = getSISeverity(reason);
        const isVacancy  = reason === 'Tutor Vacancy';
        const isCritical = sev === 'critical';
        const sevLabel   = `<span class="po-severity-${sev}">${sev.toUpperCase()}</span>`;
        const rowBg      = isCritical ? 'background:#fef2f2' : isVacancy ? 'background:#fffbeb' : '';
        const icon       = isCritical ? '🚨' : isVacancy ? '👤' : sev === 'high' ? '🔴' : sev === 'medium' ? '🟡' : '🟢';
        const note       = isCritical
          ? '<div style="margin-top:.4rem;font-size:.75rem;color:#991b1b;font-weight:600">⚠️ Requires immediate review, check-in, and cleanup</div>'
          : isVacancy
            ? '<div style="margin-top:.4rem;font-size:.75rem;color:#92400e;font-weight:600">👥 Staffing gap — <strong>not counted in attendance</strong>. Escalate to HR &amp; Programming for backfill. Visible to: HR · Programming · Leadership.</div>'
            : '';
        const weeks = [...new Set(recs.map(r => r[ATT.WEEK]))].filter(Boolean).sort((a,b)=>{ const na=parseInt(a.replace('Week ','')),nb=parseInt(b.replace('Week ','')); return na-nb; }).join(', ');
        return `<div class="po-flag-row" style="${rowBg}">
          <div class="po-flag-icon">${icon}</div>
          <div class="po-flag-text">
            <div class="po-flag-label">${reason}</div>
            <div class="po-flag-sub">Affected weeks: ${weeks}</div>
            ${note}
          </div>
          <div style="display:flex;flex-direction:column;align-items:flex-end;gap:.3rem">
            ${sevLabel}
            <span class="po-flag-count">${recs.length} records</span>
          </div>
        </div>`;
      }).join('');

      const notRecorded = sc.rows.filter(r => r[ATT.ATT_STATUS] === 'Not recorded').length;
      return `<div>
        <div style="padding:1rem 1.5rem .5rem;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between">
          <span style="font-size:.8125rem;color:var(--muted)">${siRows.length} service interruption records · Sorted by severity</span>
          ${notRecorded > 0 ? `<span class="po-badge po-badge-gold">⚠️ ${notRecorded} not recorded — data quality flag</span>` : ''}
        </div>
        ${groupRows || '<div style="text-align:center;padding:2rem;color:var(--muted)">No service interruptions found</div>'}
      </div>`;
    }

    function renderSurveysTab(sc) {
      const stuAvg = sc.stuSurveyAvg;
      const instAvg = sc.instSurveyAvg;

      // Comments with bucketing
      const stuComments = sc.stuSurveyRows
        .filter(r => r[STU_S.COMMENT] && r[STU_S.COMMENT].trim())
        .slice(0, 40);
      const instComments = sc.instSurveyRows
        .filter(r => (r[INST_S.COMMENT_ADMIN] || r[INST_S.COMMENT_SELF]))
        .slice(0, 40);

      const renderCommentCard = (text, bucketKey) => {
        const bucket = COMMENT_BUCKETS[bucketKey] || { label: 'Other', css: 'other' };
        const clampCss = 'font-size:.8125rem;color:var(--text);line-height:1.5';
        const cardCss  = bucketKey === 'concern' ? 'concern' : bucketKey === 'positive' ? 'positive' : 'neutral';
        return `<div class="po-comment-card cc-${cardCss}">
          <div class="po-comment-bucket po-bucket-${bucket.css}">${bucket.label}</div>
          <div style="${clampCss}">"${text}"</div>
        </div>`;
      };

      const stuRatingBars = [
        ['Confidence', STU_S.CONFIDENCE],
        ['Enjoyment', STU_S.ENJOYMENT],
        ['Learning', STU_S.LEARNING],
        ['Overall', STU_S.OVERALL],
      ].map(([lbl, col]) => {
        const scores = sc.stuSurveyRows.map(r => parseFloat(r[col])).filter(v => !isNaN(v));
        const avg = scores.length ? scores.reduce((a,b)=>a+b,0)/scores.length : 0;
        const pct = avg / 5 * 100;
        const col2 = avg >= 4 ? 'var(--met)' : avg >= 3 ? 'var(--gold)' : 'var(--notmet)';
        return `<div style="margin-bottom:.625rem">
          <div style="display:flex;justify-content:space-between;font-size:.75rem;color:var(--muted);margin-bottom:.25rem"><span>${lbl}</span><span style="font-weight:700;color:var(--navy)">${avg.toFixed(2)}/5</span></div>
          <div class="po-survey-bar"><div class="po-survey-bar-fill" style="width:${pct}%;background:${col2}"></div></div>
        </div>`;
      }).join('');

      const instRatingBars = [
        ['Scholar Engagement', INST_S.ENGAGEMENT],
        ['Enjoyment', INST_S.ENJOYMENT],
        ['Scholar Learning', INST_S.LEARNING],
        ['Overall', INST_S.OVERALL],
      ].map(([lbl, col]) => {
        const scores = sc.instSurveyRows.map(r => parseFloat(r[col])).filter(v => !isNaN(v));
        const avg = scores.length ? scores.reduce((a,b)=>a+b,0)/scores.length : 0;
        const pct = avg / 5 * 100;
        const col2 = avg >= 4 ? 'var(--met)' : avg >= 3 ? 'var(--gold)' : 'var(--notmet)';
        return `<div style="margin-bottom:.625rem">
          <div style="display:flex;justify-content:space-between;font-size:.75rem;color:var(--muted);margin-bottom:.25rem"><span>${lbl}</span><span style="font-weight:700;color:var(--navy)">${avg.toFixed(2)}/5</span></div>
          <div class="po-survey-bar"><div class="po-survey-bar-fill" style="width:${pct}%;background:${col2}"></div></div>
        </div>`;
      }).join('');

      const stuCommentHTML = stuComments.map(r => {
        const text = r[STU_S.COMMENT];
        const bucket = categorizeComment(text);
        return renderCommentCard(text, bucket);
      }).join('');

      const instCommentHTML = instComments.map(r => {
        const admin = r[INST_S.COMMENT_ADMIN], self = r[INST_S.COMMENT_SELF];
        const text = [admin, self].filter(Boolean).join(' | ');
        const bucket = categorizeComment(text);
        return renderCommentCard(text, bucket);
      }).join('');

      return `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:1.25rem;padding:1.25rem 1.5rem">
          <div>
            <div style="font-size:.6875rem;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:var(--muted);margin-bottom:.75rem">Scholar Survey Ratings <span style="font-weight:400">(${sc.stuSurveyRows.length} responses)</span></div>
            ${stuRatingBars || '<p style="color:var(--muted);font-size:.8125rem">No scholar survey data</p>'}
          </div>
          <div>
            <div style="font-size:.6875rem;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:var(--muted);margin-bottom:.75rem">Instructor Survey Ratings <span style="font-weight:400">(${sc.instSurveyRows.length} responses)</span></div>
            ${instRatingBars || '<p style="color:var(--muted);font-size:.8125rem">No instructor survey data</p>'}
          </div>
        </div>
        ${stuComments.length > 0 || instComments.length > 0 ? `
        <div style="padding:0 1.5rem 1.5rem">
          <div style="font-size:.75rem;font-weight:700;color:var(--navy);margin-bottom:.5rem">Scholar Comments — Auto-Categorized (${stuComments.length} shown)</div>
          <div style="margin-bottom:1.25rem">${stuCommentHTML || '<p style="color:var(--muted);font-size:.8125rem">No comments</p>'}</div>
          <div style="font-size:.75rem;font-weight:700;color:var(--navy);margin-bottom:.5rem">Instructor Comments — Auto-Categorized (${instComments.length} shown)</div>
          ${instCommentHTML || '<p style="color:var(--muted);font-size:.8125rem">No instructor comments</p>'}
        </div>` : ''}`;
    }

    function renderHITTab(sc) {
      const students = Object.values(_personMap).filter(p => p.school === sc.school && p.role === 'Student');
      const flaggedStudents = students.filter(p => p.flags.length > 0)
        .sort((a,b) => b.flags.length - a.flags.length);

      const ratioRows = sc.sessions.filter(s => s.ratioFlag)
        .sort((a,b) => b.ratio - a.ratio)
        .slice(0, 30);

      const personFlagRows = flaggedStudents.map(p => {
        const name = canSeeNames() ? p.name : '—';
        return `<div style="padding:.75rem 1.5rem;border-bottom:1px solid var(--border-2)">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:.4rem">
            <span style="font-weight:700;color:var(--navy);font-size:.875rem;cursor:pointer" onclick="po.drillPerson('${esc(p.uid)}')">${name}</span>
            <span class="po-badge ${p.flags.length>2?'po-badge-critical':'po-badge-red'}">🚩 ${p.flags.length} flag${p.flags.length>1?'s':''}</span>
          </div>
          ${p.flags.map(f=>`<div style="font-size:.75rem;color:var(--muted);margin:.2rem 0;display:flex;align-items:center;gap:.4rem"><span class="po-severity-${f.severity}">${f.severity}</span> ${f.msg}</div>`).join('')}
        </div>`;
      }).join('');

      const ratioRowsHTML = ratioRows.map(s => `
        <tr style="font-size:.8125rem">
          <td style="padding:.45rem .875rem;border-bottom:1px solid var(--border-2)">${s.start||'—'}</td>
          <td style="padding:.45rem .875rem;border-bottom:1px solid var(--border-2);font-weight:600;color:var(--navy)">${s.title}</td>
          <td style="padding:.45rem .875rem;border-bottom:1px solid var(--border-2)">${s.instructor}</td>
          <td style="padding:.45rem .875rem;border-bottom:1px solid var(--border-2);text-align:center"><span class="po-badge po-badge-red">⚑ ${s.ratio}:1</span></td>
          <td style="padding:.45rem .875rem;border-bottom:1px solid var(--border-2);font-size:.75rem;color:var(--muted)">Exceeds 1:4 HIT ratio — MOU governs actual limit</td>
        </tr>`).join('');

      return `
        <div>
          <div style="padding:1rem 1.5rem;border-bottom:1px solid var(--border);background:var(--surface-2)">
            <div style="font-size:.75rem;color:var(--muted);line-height:1.6">
              <strong>HIT Compliance Standards:</strong> &nbsp;≤4 scholars per session (1:4 ratio) &nbsp;·&nbsp; ≥2 sessions per week &nbsp;·&nbsp; Same instructor for continuity/rapport &nbsp;·&nbsp; No 10+ consecutive misses<br>
              <em>Note: Ratio flag does not equal a violation — some schools have approved higher ratios per MOU. Flag = review required.</em>
            </div>
          </div>
          ${flaggedStudents.length > 0 ? `
          <div style="padding:1rem 1.5rem .5rem">
            <div style="font-size:.75rem;font-weight:700;color:var(--navy)">Scholars With Active HIT Flags (${flaggedStudents.length})</div>
          </div>
          ${personFlagRows}` : '<div style="padding:2rem;text-align:center;color:var(--muted)">No HIT flags for scholars at this school</div>'}
          ${ratioRows.length > 0 ? `
          <div style="padding:1rem 1.5rem .5rem;border-top:1px solid var(--border)">
            <div style="font-size:.75rem;font-weight:700;color:var(--navy)">Sessions With Ratio Flags (${ratioRows.length} of ${sc.ratioViolations})</div>
          </div>
          <div style="overflow-x:auto;padding:0 1.5rem 1.5rem">
            <table style="width:100%;border-collapse:collapse">
              <thead><tr style="background:var(--surface-2)">${['Date','Session','Instructor','Ratio','Note'].map(h=>`<th style="padding:.4rem .875rem;text-align:left;font-size:.625rem;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--muted);border-bottom:1px solid var(--border)">${h}</th>`).join('')}</tr></thead>
              <tbody>${ratioRowsHTML}</tbody>
            </table>
          </div>` : ''}
        </div>`;
    }

    // ── PERSON DETAIL VIEW ────────────────────────────────────────────────
    function renderPersonDetail() {
      const mc = document.getElementById('poMainContent'); if (!mc) return;
      const p = _personMap[_selPerson]; if (!p) { _view = 'school'; renderView(); return; }
      const isStudent = p.role === 'Student';
      const name = canSeeNames() ? p.name : (isStudent ? 'Scholar' : 'Instructor');
      const total = p.attended + p.absent;
      const rate  = total > 0 ? Math.round(p.attended / total * 100) : 0;
      const attColor = rate >= 90 ? 'var(--met)' : rate >= 75 ? 'var(--gold)' : 'var(--notmet)';

      const tabs = [{ id:'attendance', label:'📋 History' }];
      if (isTD() || isData() || isProg()) tabs.push({ id:'surveys', label:'⭐ Surveys' });
      if (isData() || isHR() || isProg()) tabs.push({ id:'flags', label:`🚩 Flags (${p.flags.length})` });

      mc.innerHTML = `
        <div class="po-detail-card">
          <div class="po-section-hd">
            <div>
              <div style="font-family:'DM Serif Display',serif;font-size:1.1rem;color:var(--navy)">${name}</div>
              <div style="font-size:.75rem;color:var(--muted)">${p.role} · ${p.school} · ${p.district}${p.grade ? ' · ' + p.grade : ''}</div>
            </div>
            <div style="display:flex;flex-direction:column;align-items:flex-end;gap:.375rem">
              <span style="font-family:'DM Serif Display',serif;font-size:1.5rem;font-weight:700;color:${attColor}">${rate}%</span>
              <span style="font-size:.75rem;color:var(--muted)">${p.attended} attended · ${p.absent} absent · ${p.interruptions} interrupted</span>
              ${!isStudent && (isProg() || isData()) && p.surveyCompRate !== null && p.surveyCompRate !== undefined ? (() => {
                const cr = p.surveyCompRate;
                const crColor = cr >= 80 ? 'var(--met)' : cr >= 60 ? '#d97706' : 'var(--notmet)';
                return `<span style="font-size:.75rem;font-weight:700;color:${crColor}">📊 ${cr}% survey completion &nbsp;<span style="font-weight:400;color:var(--muted)">${p.surveySubmitted} of ${p.surveyEligible} eligible sessions</span></span>`;
              })() : ''}
              ${(isHR() || isFinance()) && rate < 70 ? '<span class="po-badge po-badge-critical">⚑ Review Attendance Context</span>' : ''}
              ${p.consecStatus === 'Attendance Concern' ? '<span class="po-badge po-badge-critical">10+ Consecutive Misses</span>' : ''}
              ${p.vacantId ? '<span class="po-badge po-badge-red">Tutor Vacancy Active</span>' : ''}
            </div>
          </div>
          ${isStudent && p.subjectTutors && Object.keys(p.subjectTutors).filter(s=>s).length > 0 ? (() => {
            const subjects = Object.keys(p.subjectTutors).filter(s => s).sort();
            const rows = subjects.map(subj => {
              const st = p.subjectTutors[subj] || {};
              const primary = Object.values(st.primary || {});
              const numSubs = Object.keys(st.subs || {}).length;
              const hasIssue = primary.length > 1;
              const badge = hasIssue
                ? '<span class="po-badge po-badge-gold" style="font-size:.6875rem">⚠️ ' + primary.length + ' tutors</span>'
                : '<span class="po-badge po-badge-green" style="font-size:.6875rem">✓ 1 tutor</span>';
              const names = primary.length
                ? primary.map(n => '<span style="color:var(--navy)">' + n + '</span>').join('<span style="color:var(--muted);margin:0 .3rem">/</span>')
                : '<span style="color:var(--muted)">None on record</span>';
              const subNote = numSubs > 0 ? ' <span style="color:var(--muted);font-size:.75rem">(+ ' + numSubs + ' sub)</span>' : '';
              const mins = (p.subjectMinutes && p.subjectMinutes[subj]) || 0;
              const minsStr = mins > 0
                ? '<span style="margin-left:.5rem;font-size:.75rem;color:var(--muted);background:var(--surface-2);padding:.1rem .4rem;border-radius:4px;border:1px solid var(--border)">' + (mins >= 60 ? Math.floor(mins/60) + 'h ' + (mins%60>0?mins%60+'m':'') : mins + 'm') + ' received</span>'
                : '';
              return '<div style="display:flex;align-items:center;gap:.625rem;padding:.375rem 0;border-bottom:1px solid var(--border-2)">'
                + '<div style="min-width:100px;font-size:.6875rem;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--muted)">' + subj + '</div>'
                + '<div style="flex:1;font-size:.8125rem">' + names + subNote + minsStr + '</div>'
                + badge
                + '</div>';
            }).join('');
            const expectedTutors = subjects.length;
            const totalPrimary = subjects.reduce((s, sub) => s + Object.keys((p.subjectTutors[sub]||{}).primary||{}).length, 0);
            const overallBadge = totalPrimary <= expectedTutors
              ? '<span class="po-badge po-badge-green">' + expectedTutors + ' subject' + (expectedTutors>1?'s':'') + ' · ' + totalPrimary + ' primary tutor' + (totalPrimary>1?'s':'') + '</span>'
              : '<span class="po-badge po-badge-gold">' + expectedTutors + ' subject' + (expectedTutors>1?'s':'') + ' · ' + totalPrimary + ' primary tutor' + (totalPrimary>1?'s':'') + ' — continuity review</span>';
            return '<div style="padding:.625rem 1.25rem;border-bottom:1px solid var(--border);background:var(--surface-2)">'
              + '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:.375rem">'
              + '<span style="font-size:.625rem;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:var(--muted)">Assigned Tutors by Subject</span>'
              + overallBadge
              + '</div>'
              + rows
              + '</div>';
          })() : ''}
          <div class="po-tabs-bar" id="poPersonTabsBar">
            ${tabs.map(t=>`<button class="po-tab${_activeTab===t.id?' po-tab-active':''}" onclick="po.switchPersonTab('${t.id}')">${t.label}</button>`).join('')}
          </div>
          <div id="poPersonTabContent"></div>
        </div>`;
      renderPersonTab(_activeTab, p);
    }

    function switchPersonTab(tabId) {
      _activeTab = tabId;
      document.querySelectorAll('#poPersonTabsBar .po-tab').forEach(btn => {
        btn.classList.toggle('po-tab-active', btn.getAttribute('onclick').includes(`'${tabId}'`));
      });
      const p = _personMap[_selPerson]; if (!p) return;
      renderPersonTab(tabId, p);
    }

    function renderPersonTab(tab, p) {
      const el = document.getElementById('poPersonTabContent'); if (!el) return;
      if (tab === 'attendance') el.innerHTML = renderPersonAttHistory(p);
      else if (tab === 'surveys') el.innerHTML = renderPersonSurveys(p);
      else if (tab === 'flags')   el.innerHTML = renderPersonFlags(p);
    }

    function renderPersonAttHistory(p) {
      const rows = p.rows.sort((a,b) => new Date(b[ATT.SESS_DATE]) - new Date(a[ATT.SESS_DATE]));
      const histRows = rows.map(r => {
        const cls = classifyRecord(r);
        const clsColor = cls==='attended'?'var(--met)':cls==='absent'?'var(--notmet)':cls==='service_interruption'?'var(--partial)':'var(--muted)';
        const clsLabel = cls==='attended'?'Attended':cls==='absent'?'Absent':cls==='service_interruption'?'Interrupted':'—';
        const siFlag = cls === 'service_interruption' ? `<span class="po-severity-${getSISeverity(r[ATT.MISS_REASON])} " style="margin-left:.4rem">${getSISeverity(r[ATT.MISS_REASON])}</span>` : '';
        return `<div class="po-hist-row">
          <span style="color:var(--muted)">${r[ATT.SESS_DATE]||'—'}</span>
          <span style="color:var(--navy)">${r[ATT.SESSION]||'—'}</span>
          <span style="font-weight:700;color:${clsColor}">${clsLabel}${siFlag}</span>
          <span style="color:var(--muted);font-size:.75rem">${r[ATT.WEEK]||'—'}</span>
        </div>`;
      }).join('');
      return `<div>
        <div style="display:grid;grid-template-columns:100px 1fr 90px 80px;gap:.5rem;padding:.5rem 1.5rem;border-bottom:1px solid var(--border);font-size:.625rem;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--muted)"><span>Date</span><span>Session</span><span>Status</span><span>Week</span></div>
        ${histRows || '<div style="text-align:center;padding:2rem;color:var(--muted)">No session history</div>'}
      </div>`;
    }

    function renderPersonSurveys(p) {
      const isInst = p.role === 'Instructor';
      const surveys = isInst ? p.instSurveys : p.stuSurveys;

      // ── For instructors: show completion rate summary + missing sessions ──
      let completionBannerHTML = '';
      if (isInst && (isProg() || isData())) {
        const cr = p.surveyCompRate;
        const elig = p.surveyEligible || 0;
        const sub  = p.surveySubmitted || 0;
        const missing = p.surveyMissingSessIds || [];
        if (elig > 0) {
          const crColor = cr >= 80 ? '#0d6e3a' : cr >= 60 ? '#d97706' : '#b91c1c';
          const crBg    = cr >= 80 ? '#f0fdf4' : cr >= 60 ? '#fffbeb' : '#fef2f2';
          const crBdr   = cr >= 80 ? '#86efac' : cr >= 60 ? '#fde68a' : '#fecaca';
          const missingRows = missing.slice(0, 8).map(sid => {
            const sess = _sessMap[sid];
            if (!sess) return '';
            const dateStr = sess.start ? new Date(sess.start).toLocaleDateString('en-US',{month:'short',day:'numeric'}) : '';
            return `<div style="display:flex;align-items:center;gap:.625rem;padding:.3rem 0;border-bottom:1px solid var(--border-2);font-size:.75rem">
              <span style="color:var(--muted);font-family:monospace;font-size:.7rem">${sid}</span>
              <span style="color:var(--navy)">${sess.title||'Session'}</span>
              <span style="color:var(--muted)">${dateStr}</span>
              <span style="margin-left:auto;color:#b91c1c;font-weight:600">No survey</span>
            </div>`;
          }).join('');
          completionBannerHTML = `
            <div style="margin:.75rem 1.25rem 1rem;padding:.875rem 1.125rem;background:${crBg};border:1.5px solid ${crBdr};border-radius:12px">
              <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:.375rem">
                <span style="font-size:.6875rem;font-weight:800;text-transform:uppercase;letter-spacing:.1em;color:${crColor}">Survey Completion Rate</span>
                <span style="font-family:'DM Serif Display',serif;font-size:1.5rem;font-weight:700;color:${crColor}">${cr}%</span>
              </div>
              <div style="font-size:.75rem;color:var(--muted);margin-bottom:${missing.length?'.75rem':'0'}">${sub} survey${sub!==1?'s':''} submitted of ${elig} eligible session${elig!==1?'s':''} (delivered with scholars present)</div>
              ${missing.length ? `
                <div style="font-size:.6875rem;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#b91c1c;margin-bottom:.35rem">⚠ ${missing.length} Sessions Missing Survey${missing.length>8?' (showing 8)':''}</div>
                ${missingRows}
              ` : '<div style="font-size:.75rem;color:#0d6e3a;font-weight:600">✓ All eligible sessions have a survey on file</div>'}
            </div>`;
        }
      }

      if (!surveys.length) return completionBannerHTML + '<div style="text-align:center;padding:2rem;color:var(--muted)">No survey responses found</div>';

      const ratingCols = isInst
        ? [[INST_S.ENGAGEMENT,'Engagement'],[INST_S.ENJOYMENT,'Enjoyment'],[INST_S.LEARNING,'Scholar Learning'],[INST_S.OVERALL,'Overall']]
        : [[STU_S.CONFIDENCE,'Confidence'],[STU_S.ENJOYMENT,'Enjoyment'],[STU_S.LEARNING,'Learning'],[STU_S.OVERALL,'Overall']];

      const avgs = ratingCols.map(([col, lbl]) => {
        const scores = surveys.map(r => parseFloat(r[col])).filter(v => !isNaN(v));
        const avg = scores.length ? scores.reduce((a,b)=>a+b,0)/scores.length : 0;
        const pct = avg/5*100;
        const color = avg>=4?'var(--met)':avg>=3?'var(--gold)':'var(--notmet)';
        return `<div style="margin-bottom:.625rem">
          <div style="display:flex;justify-content:space-between;font-size:.75rem;color:var(--muted);margin-bottom:.25rem"><span>${lbl}</span><span style="font-weight:700;color:var(--navy)">${avg.toFixed(2)}/5 (${scores.length} responses)</span></div>
          <div class="po-survey-bar"><div class="po-survey-bar-fill" style="width:${pct}%;background:${color}"></div></div>
        </div>`;
      }).join('');

      const commentCol1 = isInst ? INST_S.COMMENT_ADMIN : STU_S.COMMENT;
      const commentCol2 = isInst ? INST_S.COMMENT_SELF  : null;
      const comments = surveys.filter(r => r[commentCol1] || (commentCol2 && r[commentCol2])).slice(0, 20);
      const commentHTML = comments.map(r => {
        const text = [r[commentCol1], commentCol2 ? r[commentCol2] : null].filter(Boolean).join(' | ');
        const bucket = categorizeComment(text);
        const b = COMMENT_BUCKETS[bucket] || { label:'Other', css:'other' };
        const week = isInst ? r[INST_S.WEEK] : r[STU_S.WEEK];
        return `<div class="po-comment-card cc-${bucket==='concern'?'concern':bucket==='positive'?'positive':'neutral'}">
          <div style="display:flex;align-items:center;gap:.5rem;margin-bottom:.3rem">
            <span class="po-comment-bucket po-bucket-${b.css}">${b.label}</span>
            <span style="font-size:.7rem;color:var(--muted)">${week||''}</span>
          </div>
          <div style="font-size:.8125rem;color:var(--text);line-height:1.5">"${text}"</div>
        </div>`;
      }).join('');

      return completionBannerHTML + `<div style="padding:1.25rem 1.5rem">
        <div style="margin-bottom:1.25rem">${avgs}</div>
        ${comments.length > 0 ? `
          <div style="font-size:.75rem;font-weight:700;color:var(--navy);margin-bottom:.5rem">Comments (${comments.length})</div>
          ${commentHTML}` : ''}
      </div>`;
    }

    function renderPersonFlags(p) {
      if (!p.flags.length) return '<div style="text-align:center;padding:2rem;color:var(--muted)">✓ No HIT compliance flags for this individual</div>';
      return `<div>${p.flags.map(f => `
        <div class="po-flag-row" style="${f.severity==='critical'||f.severity==='high'?'background:#fff8f8':''}">
          <div class="po-flag-icon">${f.severity==='critical'?'🚨':f.severity==='high'?'🔴':f.severity==='medium'?'🟡':'🔵'}</div>
          <div class="po-flag-text">
            <div class="po-flag-label">${flagTypeLabel(f.type)}</div>
            <div class="po-flag-sub">${f.msg}</div>
          </div>
          <span class="po-severity-${f.severity}">${f.severity.toUpperCase()}</span>
        </div>`).join('')}
      </div>`;
    }

    function flagTypeLabel(type) {
      const labels = {
        consecutive: '10+ Consecutive Sessions Missed',
        continuity:  'Tutor Continuity Concern',
        low_att:     'Low Attendance — ADP Review Needed',
        vacancy:     'Active Tutor Vacancy',
        declined:    'Scholar Declined Sessions — Program Team Follow-Up',
        frequency:   'Weekly Session Frequency Below HIT Minimum',
        inst_att:    'Instructor Attendance — ADP Review Needed',
        ratio:       'Session Ratio Exceeds 1:4 — Check MOU',
        critical_si: 'Service Interruption — Needs Investigation (NJTC Internal)',
        high_si:     'High Severity Service Interruptions',
      };
      return labels[type] || type;
    }

    // ── FLAGS MODAL ───────────────────────────────────────────────────────
    function openFlagsModal(filter) {
      _lastFlagFilter = filter || 'critical';
      let overlay = document.getElementById('poFlagsModal');
      if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'poFlagsModal';
        overlay.className = 'po-modal-overlay';
        overlay.onclick = e => { if (e.target === overlay) overlay.style.display = 'none'; };
        document.body.appendChild(overlay);
      }

      const dept = (window.NJTC_SESSION || {}).dept || '';
      const canClear = dept === 'data' || dept === 'programming';
      const cleared = _getClearedFlags();

      const allFlags = [];
      for (const [school, sc] of Object.entries(_schoolMap)) {
        for (const f of sc.flags) allFlags.push(Object.assign({}, f, {school, entity: school, isSchool: true}));
      }
      const close = `<button class="po-modal-close" onclick="document.getElementById('poFlagsModal').style.display='none'">✕</button>`;
      const sevOrder = {critical:0,high:1,medium:2,low:3};
      const filtered = filter === 'critical' ? allFlags.filter(f => f.severity === 'critical') : allFlags;
      filtered.sort((a,b) => (sevOrder[a.severity]||2) - (sevOrder[b.severity]||2));

      // Track flag keys + messages for global clear/restore handlers
      window._poFlagKeys = filtered.map(f => f.school + '::' + f.type);
      window._poFlagMsgs = filtered.map(f => f.msg);

      const clearedCount = filtered.filter(f => cleared[f.school + '::' + f.type]).length;
      const activeCount  = filtered.length - clearedCount;

      const rows = filtered.map((f, i) => {
        const flagKey   = f.school + '::' + f.type;
        const isCleared = !!cleared[flagKey];
        const clearedInfo = cleared[flagKey];
        const rowBg = isCleared ? 'background:#f0fdf4' : (f.severity==='critical'?'background:#fef2f2':f.severity==='high'?'background:#fff8f8':'');

        // Age tracking
        _flagMarkFirstSeen(flagKey);
        const days    = _flagActiveDays(flagKey);
        const ageStr  = days !== null ? ` · Active ${days === 1 ? '1 day' : days + ' days'}` : '';

        // Detect if data has changed since the flag was cleared
        const msgChanged = isCleared && clearedInfo.clearedMsg && clearedInfo.clearedMsg !== f.msg;

        const reasonChecks = _FLAG_CLEAR_REASONS.map(r =>
          `<label style="display:flex;align-items:center;gap:.4rem;font-size:.72rem;color:#374151;cursor:pointer;padding:.15rem 0">
            <input type="checkbox" data-reason="${esc(r)}" style="cursor:pointer"> ${esc(r)}
          </label>`
        ).join('');

        const clearPanel = canClear && !isCleared ? `
          <div id="pfcp_${i}" style="display:none;background:#eff6ff;border:1px solid #bfdbfe;border-radius:6px;padding:.625rem .75rem;margin-top:.5rem">
            <div style="font-size:.7rem;font-weight:700;color:#1e40af;margin-bottom:.4rem">Select reason(s) for clearing this flag:</div>
            ${reasonChecks}
            <div style="display:flex;gap:.5rem;margin-top:.5rem">
              <button onclick="window._poFlagConfirmClear(${i},'${esc(dept)}')" style="padding:.3rem .7rem;font-size:.72rem;background:#1e40af;color:#fff;border:none;border-radius:5px;cursor:pointer;font-weight:600">Confirm Clear</button>
              <button onclick="window._poFlagToggleClear(${i})" style="padding:.3rem .7rem;font-size:.72rem;background:#e2e8f0;color:#374151;border:none;border-radius:5px;cursor:pointer">Cancel</button>
            </div>
          </div>` : '';

        const clearedAtStr = clearedInfo && clearedInfo.clearedAt
          ? new Date(clearedInfo.clearedAt).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})
          : '';
        const clearedBadge = isCleared ? `
          <div style="margin-top:.35rem;padding:.35rem .6rem;background:#dcfce7;border-radius:5px;border:1px solid #86efac">
            <div style="display:flex;align-items:center;gap:.6rem;flex-wrap:wrap">
              <span style="font-size:.72rem;font-weight:700;color:#16a34a">✓ Cleared</span>
              ${clearedAtStr ? `<span style="font-size:.68rem;color:#6b7280">${clearedAtStr}</span>` : ''}
              <span style="font-size:.7rem;color:#374151">${(clearedInfo.reasons||[]).map(r=>`<em>${esc(r)}</em>`).join(', ')}</span>
              ${clearedInfo.clearedBy ? `<span style="font-size:.68rem;color:#6b7280">by ${esc(clearedInfo.clearedBy)}</span>` : ''}
              ${canClear ? `<button onclick="window._poFlagRestore(${i})" style="margin-left:auto;padding:.2rem .55rem;font-size:.68rem;background:#fff;color:#dc2626;border:1px solid #fca5a5;border-radius:4px;cursor:pointer;font-weight:600">Restore</button>` : ''}
            </div>
            ${msgChanged ? `<div style="margin-top:.3rem;font-size:.68rem;color:#b45309;background:#fef3c7;border-radius:3px;padding:.2rem .45rem;border:1px solid #fde68a">⚠️ Underlying data has changed since this was cleared — review if needed</div>` : ''}
          </div>` : '';

        const clearBtn = canClear && !isCleared ? `
          <button onclick="window._poFlagToggleClear(${i})" style="padding:.25rem .6rem;font-size:.7rem;background:#fff;color:#6b7280;border:1px solid #d1d5db;border-radius:5px;cursor:pointer;white-space:nowrap;font-weight:500;margin-left:.5rem" title="Clear this flag with a reason">Clear Flag</button>` : '';

        return `
        <div class="po-flag-row" style="${rowBg}${isCleared?';opacity:.75':''}">
          <div class="po-flag-icon">${isCleared?'✅':f.severity==='critical'?'🚨':f.severity==='high'?'🔴':'🟡'}</div>
          <div class="po-flag-text" style="flex:1">
            <div style="display:flex;align-items:center;gap:.25rem;flex-wrap:wrap">
              <span class="po-flag-label" style="cursor:pointer;color:var(--blue-mid)" onclick="po.drillSchool('${esc(f.school)}');document.getElementById('poFlagsModal').style.display='none'">${esc(f.school)}</span>
              ${clearBtn}
            </div>
            <div class="po-flag-sub">${esc(f.msg)}${ageStr ? `<span style="font-size:.65rem;color:#94a3b8;margin-left:.4rem">${ageStr}</span>` : ''}</div>
            ${clearedBadge}
            ${clearPanel}
          </div>
          ${!isCleared ? `<span class="po-severity-${f.severity}">${f.severity.toUpperCase()}</span>` : ''}
        </div>`;
      }).join('');

      const metaSuffix = clearedCount > 0 ? ` · <span style="color:#16a34a;font-weight:600">${clearedCount} cleared</span>` : '';

      overlay.innerHTML = `<div class="po-modal">
        <div class="po-modal-hd">
          <div>
            <div class="po-modal-name">${filter==='critical'?'🚨 Critical Flags':'All HIT &amp; Service Interruption Flags'}</div>
            <div class="po-modal-meta">${activeCount} active${metaSuffix} · Click a school name to drill down</div>
          </div>${close}
        </div>
        <div class="po-modal-body">${rows || '<div style="text-align:center;padding:2rem;color:var(--muted)">No flags found</div>'}</div>
        <div style="padding:1rem 1.5rem;border-top:1px solid var(--border);display:flex;align-items:center;justify-content:space-between">
          ${canClear && clearedCount > 0 ? `<span style="font-size:.72rem;color:#6b7280">${clearedCount} flag${clearedCount>1?'s':''} cleared by ${dept} — scroll up to review</span>` : '<span></span>'}
          <button class="btn btn-secondary" onclick="document.getElementById('poFlagsModal').style.display='none'">Close</button>
        </div>
      </div>`;
      overlay.style.display = 'flex';
    }

    // ── SYNC STATE ────────────────────────────────────────────────────────
    function setSyncState(state) {
      const dot = document.getElementById('poSyncDot');
      const txt = document.getElementById('poSyncText');
      if (!dot) return;
      if (state === 'loading') {
        dot.className = 'sync-dot loading';
        if (txt) txt.textContent = 'Loading Pearl data…';
      } else if (state === 'live') {
        dot.className = 'sync-dot';
        const t = _lastFetch ? _lastFetch.toLocaleTimeString() : '—';
        // Exclude _stuRows from count while stream is in progress — avoids
        // showing different record counts across depts mid-stream.
        const _stuCount = _stuStreamComplete ? _stuRows.length : 0;
        const totalRec = _attRows.length + _sessRows.length + _stuCount + _instRows.length;
        if (txt) txt.innerHTML = `<strong>Live · Pearl</strong> · ${totalRec.toLocaleString()} records · Updated ${t}`;
      } else if (state === 'partial') {
        dot.className = 'sync-dot';
        dot.style.background = '#f59e0b';
        const t = _lastFetch ? _lastFetch.toLocaleTimeString() : '—';
        const totalRec = _attRows.length + _sessRows.length + _stuRows.length + _instRows.length;
        if (txt) txt.innerHTML = `<strong>Live · Pearl</strong> · ${totalRec.toLocaleString()} records · Survey fetching… · ${t}`;
      } else if (state === 'stale') {
        dot.className = 'sync-dot';
        dot.style.background = '#f59e0b';
        const totalRec = _attRows.length + _sessRows.length + _stuRows.length + _instRows.length;
        if (txt) txt.innerHTML = `<strong>Cached · Pearl</strong> · ${totalRec.toLocaleString()} records · <em style="color:#92400e">Refreshing…</em>`;
      } else {
        dot.className = 'sync-dot error';
        if (txt) txt.innerHTML = _lastFetch
          ? `<strong>⚠️ Unreachable</strong> · Last: ${_lastFetch.toLocaleTimeString()}`
          : '<strong>⚠️ Could not load Pearl data</strong> · Click ↺ Refresh';
      }
    }

    // ── PANEL OPEN ────────────────────────────────────────────────────────
    function onPanelOpen() {
      if (!_inited) init();
    }

    // Called after buildIndexes completes — refresh talent panel if leadership is viewing it
    function _notifyLeadershipReady() {
      try {
        // Leadership dept: full rebuild
        if (typeof _currentDept !== 'undefined' && _currentDept === 'leadership') {
          if (typeof buildTalentContent === 'function') buildTalentContent();
        }
        // HR / Data dept on profiles tab: invalidate overlay so Pearl att data refreshes cards
        if (typeof _currentDept !== 'undefined' && ['hr','data'].includes(_currentDept)) {
          if (typeof _hrInvalidateOverlay === 'function') _hrInvalidateOverlay();
          const profilesTab = document.getElementById('talentTab-profiles');
          const talentEl    = document.getElementById('talentContent');
          if (profilesTab && profilesTab.classList.contains('active') && talentEl) {
            try {
              const dept = (window.NJTC_SESSION||{}).dept || _currentDept || 'hr';
              const _nv = (typeof _hrOverlayVersion !== 'undefined') ? String(_hrOverlayVersion) : '0';
              talentEl.innerHTML = '<div id="hrProfilesRoot" data-overlay-version="'+_nv+'">' +
                (typeof _hrBuildProfiles === 'function' ? _hrBuildProfiles(dept) : '') + '</div>';
            } catch(e) { /* ignore — don't blank screen */ }
          }
        }
      } catch(e) { /* ignore */ }
      // Refresh Advocacy banner if panel is open
      try {
        var advPanel = document.getElementById('panel-advocacy');
        if (advPanel && advPanel.classList.contains('active')) {
          if (typeof window.advRefreshBanner === 'function') window.advRefreshBanner();
        }
      } catch(e2) { /* ignore */ }
      // Pearl data just (re)loaded — SY Analytics' Active/Est Scholars tiles and the
      // Executive Command Center both read Pearl live data cross-module. Refresh them
      // so a Summer 2026 fetch triggered from those screens shows up without the user
      // needing to separately open Pearl Operations.
      try { if (window.sya && typeof window.sya.updateStats === 'function') window.sya.updateStats(); } catch(e3) {}
      try { if (typeof window._execDashRefresh === 'function') window._execDashRefresh(true); } catch(e4) {}
    }

    // ── INIT ──────────────────────────────────────────────────────────────
    function init() {
      if (_inited) return; _inited = true;
      // Restore any cleared flags persisted in IndexedDB (survives localStorage wipes)
      // then refresh the badge so the count is accurate from the first render.
      _restoreClearedFromIdb().then(function() { updateFlagsBadge(); }).catch(function() {});
      refresh(true);
      setInterval(() => {
        const p = document.getElementById('panel-pearl-ops');
        if (p && p.classList.contains('active')) refresh(false);
      }, REFRESH_MS);
    }

    // ── UTILS ─────────────────────────────────────────────────────────────
    function setText(id, v) { const el = document.getElementById(id); if (el) el.textContent = v; }
    function esc(s) { return (s||'').replace(/'/g, "\\'"); }

    // ── Leadership summary data (for cross-module leadership view) ────────
    function getLeadershipData() {
      if (!_attRows.length) return null;

      // Apply active filters to all calculations
      const filteredRows = _attRows.filter(r => {
        if (!matchesSchoolFilter(r[ATT.SCHOOL], r[ATT.DISTRICT])) return false;
        if (_filtWeek.length && !_filtWeek.includes(r[ATT.WEEK])) return false;
        return true;
      });

      // ── Scholar & tutor attendance (via classifyRecord for consistency) ──
      let stuAtt = 0, stuMiss = 0, instAtt = 0, instMiss = 0;
      for (const r of filteredRows) {
        const cls = classifyRecord(r);
        if (r[ATT.ROLE] === 'Student') {
          if (cls === 'attended') stuAtt++;
          else if (cls === 'absent') stuMiss++;
        } else if (r[ATT.ROLE] === 'Instructor') {
          if (cls === 'attended') instAtt++;
          else if (cls === 'absent') instMiss++;
        }
      }

      const scholarRate = (stuAtt + stuMiss) > 0 ? Math.round(stuAtt / (stuAtt + stuMiss) * 100) : 0;
      const tutorRate   = (instAtt + instMiss) > 0 ? Math.round(instAtt / (instAtt + instMiss) * 100) : 0;

      // ── Sessions delivered ──
      const sessionsDelivered = filteredSessions().filter(s => s.isDelivered).length;

      // ── Scholar survey avg ──
      let surveyTotal = 0, surveyCount = 0;
      const surveyCols = [STU_S.CONFIDENCE, STU_S.ENJOYMENT, STU_S.LEARNING, STU_S.OVERALL];
      const filteredStuRows = _stuRows.filter(r => matchesSchoolFilter(r[STU_S.SCHOOL], r[STU_S.DISTRICT]));
      for (const r of filteredStuRows) {
        for (const col of surveyCols) {
          const v = parseFloat(r[col]);
          if (!isNaN(v) && v > 0) { surveyTotal += v; surveyCount++; }
        }
      }
      const scholarSurvey = surveyCount > 0 ? Math.round(surveyTotal / surveyCount * 10) / 10 : null;

      // ── Scholar performance tiers — ACTIVE SCHOLARS ONLY ──────────────
      // Active = attended at least 1 session (attended or late).
      // Scholars with zero attended sessions are excluded from counts.
      const scholarAtt = {};
      for (const r of _attRows) {
        if (r[ATT.ROLE] !== 'Student') continue;
        if (!matchesSchoolFilter(r[ATT.SCHOOL], r[ATT.DISTRICT])) continue;
        const id = r[ATT.USER_ID]; if (!id) continue;
        if (!scholarAtt[id]) scholarAtt[id] = { att: 0, miss: 0 };
        const cls = classifyRecord(r);
        if (cls === 'attended') scholarAtt[id].att++;
        else if (cls === 'absent') scholarAtt[id].miss++;
      }
      let onTrack = 0, atRisk = 0, needsAction = 0;
      for (const { att, miss } of Object.values(scholarAtt)) {
        if (att === 0) continue; // exclude scholars who never attended
        const total = att + miss; if (!total) continue;
        const rate = att / total * 100;
        if (rate >= 80) onTrack++;
        else if (rate >= 70) atRisk++;
        else needsAction++;
      }

      // ── Districts ──
      const distMap = {};
      for (const r of _attRows) {
        const role = r[ATT.ROLE];
        if (role !== 'Student' && role !== 'Instructor') continue;
        const dist = r[ATT.DISTRICT]; const school = r[ATT.SCHOOL]; if (!dist) continue;
        if (!distMap[dist]) distMap[dist] = { name: dist, schools: {}, stuAtt: 0, stuMiss: 0, instAtt: 0, instMiss: 0, scholars: new Set(), sessions: 0 };
        const cls = classifyRecord(r);
        if (role === 'Student') {
          // Only count scholar as active if they attended (attended or late)
          if (cls === 'attended') distMap[dist].scholars.add(r[ATT.USER_ID]);
          if (!distMap[dist].schools[school]) distMap[dist].schools[school] = { name: school, att: 0, miss: 0 };
          if (cls === 'attended') { distMap[dist].stuAtt++; distMap[dist].schools[school].att++; }
          else if (cls === 'absent') { distMap[dist].stuMiss++; distMap[dist].schools[school].miss++; }
        } else {
          if (cls === 'attended') distMap[dist].instAtt++;
          else if (cls === 'absent') distMap[dist].instMiss++;
        }
      }
      for (const sess of Object.values(_sessMap)) {
        if (sess.isDelivered && sess.district && distMap[sess.district]) distMap[sess.district].sessions++;
      }
      const CT_REASON    = 'Classroom Teacher Requested to Keep Scholar in Class';
      const CT_REASON_H  = 'HADDON TWP ONLY -- Teacher requested whole group support';
      const districts = Object.values(distMap).map(d => {
        const sTotal = d.stuAtt + d.stuMiss;
        const tTotal = d.instAtt + d.instMiss;
        // CT pull-out rate: CT rows / scholar-caused missed only (excludes SIs like holidays, testing, closures)
        const allStuRows      = _attRows.filter(r => r[ATT.ROLE] === 'Student' && r[ATT.DISTRICT] === d.name);
        const scholarMissed   = allStuRows.filter(r => (r[ATT.ATT_STATUS] || '') === 'Missed' && SCHOLAR_MISS_REASONS.has(r[ATT.MISS_REASON] || ''));
        const ctRows          = scholarMissed.filter(r => r[ATT.MISS_REASON] === CT_REASON || r[ATT.MISS_REASON] === CT_REASON_H);
        const ctPct           = scholarMissed.length > 0 ? Math.round(ctRows.length / scholarMissed.length * 100) : 0;
        return {
          name: d.name,
          scholars: d.scholars.size,
          scholarRate: sTotal > 0 ? Math.round(d.stuAtt / sTotal * 100) : 0,
          tutorRate:   tTotal > 0 ? Math.round(d.instAtt / tTotal * 100) : 0,
          sessions: d.sessions,
          ctPct,
          ctFlag: ctPct > 10,
          schools: Object.values(d.schools).map(s => {
            const t = s.att + s.miss;
            return { name: s.name, rate: t > 0 ? Math.round(s.att / t * 100) : 0 };
          }),
        };
      });

      // ── Absence drivers ──
      const CONTROLLABLE = {
        'Tutor Absent':                         'Tutor absent',
        'Tutor Vacancy':                        'Tutor vacancy (unfilled)',
        'Tutor Left Early (no sub)':            'Tutor left early',
        'Absent; Not Covered (Tutor not available)': 'No coverage available',
        'NJTC Internal Issue/Error':            'Internal scheduling issue',
      };
      const UNCONTROLLABLE = {
        'Classroom Teacher Requested to Keep Scholar in Class': 'Teacher kept scholar in class',
        'School-administered Testing':          'School testing day',
        'School Event':                         'School event',
        'Holiday - scheduled':                  'Holiday',
        'Unscheduled School Closure/Delay/Dismissal': 'School closure / delay',
        'HADDON TWP ONLY -- Teacher requested whole group support': 'Teacher group request',
      };
      const ctrlCounts = {}, unctrlCounts = {};
      for (const r of _attRows) {
        if (r[ATT.ROLE] !== 'Student' || r[ATT.ATT_STATUS] !== 'Missed') continue;
        const reason = r[ATT.MISS_REASON];
        if (CONTROLLABLE[reason])   ctrlCounts[reason]   = (ctrlCounts[reason]   || 0) + 1;
        if (UNCONTROLLABLE[reason]) unctrlCounts[reason] = (unctrlCounts[reason] || 0) + 1;
      }
      const toReasons = (map, labels) => Object.entries(map)
        .sort((a,b) => b[1]-a[1]).slice(0, 4)
        .map(([k,v]) => ({ label: labels[k] || k, count: v }));
      const ctrlTotal   = Object.values(ctrlCounts).reduce((s,v)=>s+v,0);
      const unctrlTotal = Object.values(unctrlCounts).reduce((s,v)=>s+v,0);

      // ── Weekly trend (correct formula) ──
      const weekMap = {};
      for (const r of _attRows) {
        if (r[ATT.ROLE] !== 'Student') continue;
        const w = r[ATT.WEEK]; if (!w) continue;
        if (!weekMap[w]) weekMap[w] = { att: 0, miss: 0 };
        const cls = classifyRecord(r);
        if (cls === 'attended') weekMap[w].att++;
        else if (cls === 'absent') weekMap[w].miss++;
      }
      const weeklyTrend = Object.entries(weekMap)
        .sort((a,b) => { const na = parseInt(a[0].replace(/\D/g,'')); const nb = parseInt(b[0].replace(/\D/g,'')); return na-nb; })
        .map(([week, v]) => {
          const t = v.att + v.miss;
          return { week, rate: t > 0 ? Math.round(v.att/t*100) : 0, total: t };
        });

      // Unique scholars served: scholars with at least 1 attended session — consistent with Pearl Operations view
      const scholarsServed = onTrack + atRisk + needsAction;

      return {
        scholarRate, tutorRate, sessionsDelivered, scholarSurvey,
        scholarsServed,
        scholarOnTrack: onTrack, scholarAtRisk: atRisk, scholarNeedsAction: needsAction,
        districts,
        absenceDrivers: {
          controllable:   { total: ctrlTotal,   reasons: toReasons(ctrlCounts,   CONTROLLABLE)   },
          uncontrollable: { total: unctrlTotal,  reasons: toReasons(unctrlCounts, UNCONTROLLABLE) },
        },
        weeklyTrend,
      };
    }


    // ── FIELD STAFF REPORT ────────────────────────────────────────────────
    // Generates a print-ready summary of the 3 things programming asks about
    // most: (1) incomplete sessions, (2) survey capture rate, (3) low ratings.
    // Opens a print window (File → Print → Save as PDF) — no extra library needed.
    // Filterable by region, tutor name search, school, district.

    function showFieldReportModal() {
      // Build filter options from live data
      const allSchools   = [...new Set(Object.values(_schoolMap).map(sc=>sc.school))].sort();
      const allDistricts = [...new Set(Object.values(_schoolMap).map(sc=>sc.district))].sort();

      let modal = document.getElementById('poFieldReportModal');
      if (!modal) {
        modal = document.createElement('div');
        modal.id = 'poFieldReportModal';
        modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:10001;display:flex;align-items:center;justify-content:center;';
        document.body.appendChild(modal);
      }

      modal.innerHTML = `
        <div style="background:var(--surface);border-radius:16px;box-shadow:0 24px 64px rgba(0,0,0,.3);width:560px;max-width:96vw;max-height:90vh;overflow-y:auto;">
          <div style="background:linear-gradient(135deg,#1a3a5c,#2563eb);padding:1.25rem 1.5rem;display:flex;justify-content:space-between;align-items:center;border-radius:16px 16px 0 0;">
            <div>
              <div style="color:#fff;font-weight:700;font-size:1.05rem;">📋 Onsite Staff Report</div>
              <div style="color:rgba(255,255,255,.75);font-size:.78rem;margin-top:.2rem;">Incompletes · Survey Capture · Low Ratings</div>
            </div>
            <button onclick="document.getElementById('poFieldReportModal').style.display='none'"
              style="background:rgba(255,255,255,.15);border:none;color:#fff;border-radius:8px;width:32px;height:32px;cursor:pointer;font-size:1rem;line-height:1;">✕</button>
          </div>

          <div style="padding:1.375rem 1.5rem;">
            <div style="font-size:.8rem;color:var(--muted);margin-bottom:1.125rem;line-height:1.5;">
              This report is what programming asks about most. Filter it, then open a print-ready summary you can share with onsite staff or save as a PDF.
            </div>

            <!-- Region toggle -->
            <div style="margin-bottom:.875rem;">
              <div style="font-size:.7rem;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:var(--muted);margin-bottom:.4rem;">Region</div>
              <div style="display:flex;gap:.4rem;">
                ${['ALL','NE','SW'].map(r=>`<button id="frRegion${r}" onclick="po._frSetRegion('${r}')"
                  style="padding:.35rem .875rem;font-size:.8125rem;font-weight:600;border-radius:8px;cursor:pointer;border:1.5px solid ${r==='ALL'?'var(--blue-mid)':'var(--border)'};background:${r==='ALL'?'var(--blue-mid)':'var(--surface)'};color:${r==='ALL'?'#fff':'var(--text)'};">${r==='ALL'?'All Regions':r+' Region'}</button>`).join('')}
              </div>
            </div>

            <!-- Tutor name search -->
            <div style="margin-bottom:.875rem;">
              <div style="font-size:.7rem;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:var(--muted);margin-bottom:.4rem;">Tutor Name (optional)</div>
              <input id="frTutorSearch" type="text" placeholder="Search by name…"
                style="width:100%;padding:.5rem .75rem;border:1.5px solid var(--border);border-radius:8px;font-size:.875rem;font-family:inherit;background:var(--bg);color:var(--text);box-sizing:border-box;outline:none;">
            </div>

            <!-- School filter -->
            <div style="margin-bottom:.875rem;">
              <div style="font-size:.7rem;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:var(--muted);margin-bottom:.4rem;">School (optional)</div>
              <select id="frSchool" style="width:100%;padding:.5rem .75rem;border:1.5px solid var(--border);border-radius:8px;font-size:.8125rem;font-family:inherit;background:var(--bg);color:var(--text);box-sizing:border-box;">
                <option value="">All Schools</option>
                ${allSchools.map(s=>`<option value="${s.replace(/"/g,'&quot;')}">${s}</option>`).join('')}
              </select>
            </div>

            <!-- District filter -->
            <div style="margin-bottom:1.25rem;">
              <div style="font-size:.7rem;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:var(--muted);margin-bottom:.4rem;">District (optional)</div>
              <select id="frDistrict" style="width:100%;padding:.5rem .75rem;border:1.5px solid var(--border);border-radius:8px;font-size:.8125rem;font-family:inherit;background:var(--bg);color:var(--text);box-sizing:border-box;">
                <option value="">All Districts</option>
                ${allDistricts.map(d=>`<option value="${d.replace(/"/g,'&quot;')}">${d}</option>`).join('')}
              </select>
            </div>

            <!-- What's included -->
            <div style="background:rgba(0,80,200,.05);border:1px solid rgba(0,80,200,.15);border-radius:10px;padding:.875rem;margin-bottom:1.25rem;font-size:.8rem;line-height:1.6;">
              <div style="font-weight:700;color:var(--blue-mid);margin-bottom:.4rem;">Report includes:</div>
              <div>⚠️ <strong>Incomplete Sessions</strong> — Scheduled sessions with no attendance logged, with Session ID for cleanup</div>
              <div>📊 <strong>Survey Capture Rate</strong> — % of completed sessions where the tutor submitted their survey (deploys when ≥1 scholar attends)</div>
              <div>⭐ <strong>Low Scholar Ratings</strong> — tutors where scholar satisfaction avg is below 3.5 / 5.0</div>
              <div>🚩 <strong>Flagged Comments</strong> — scholar &amp; tutor comments with concern-category keywords requiring follow-up</div>
              <div>✨ <strong>Spotlight Comments</strong> — positive comments that are shoutout candidates for team meetings</div>
            </div>

            <button onclick="po._generateFieldReport()"
              style="width:100%;padding:.75rem;background:linear-gradient(135deg,#1a3a5c,#2563eb);color:#fff;border:none;border-radius:10px;font-size:.9375rem;font-weight:700;cursor:pointer;letter-spacing:.01em;">
              📄 Open Onsite Staff Report (Print / Save PDF)
            </button>
          </div>
        </div>`;

      modal.style.display = 'flex';
    }

    // Active region filter for field report modal
    let _frRegion = 'ALL';
    function _frSetRegion(r) {
      _frRegion = r;
      ['ALL','NE','SW'].forEach(x => {
        const btn = document.getElementById('frRegion'+x);
        if (!btn) return;
        const active = x === r;
        btn.style.borderColor  = active ? 'var(--blue-mid)' : 'var(--border)';
        btn.style.background   = active ? 'var(--blue-mid)' : 'var(--surface)';
        btn.style.color        = active ? '#fff' : 'var(--text)';
      });
    }

    function _generateFieldReport() {
      // Gather filter values from modal
      const regionF  = _frRegion || 'ALL';
      const tutorQ   = (document.getElementById('frTutorSearch')?.value||'').toLowerCase().trim();
      const schoolF  = (document.getElementById('frSchool')?.value||'').trim();
      const districtF= (document.getElementById('frDistrict')?.value||'').trim();

      // Region keywords (same as in school grid and talent analytics)
      const NE_KW = ['ilearn','i-learn','paterson','pcsst','paterson charter','hoboken','middlesex','central jersey'];
      const SW_KW = ['american paradigm','first philadelphia','first philly','philadelphia charter',
                     'string theory','global leadership academy','global leadership','penns grove',
                     'carneys point','haddon township','haddon','hamilton township','gloucester township'];
      const SW_SC = ['erial','loring flemming','field street','penns grove middle','van sciver',
                     'strawbridge','first philadelphia prep','first philly prep',
                     'the philadelphia charter','philadelphia charter school','global leadership academy'];
      function scRegion(school, district) {
        const d = (district||'').toLowerCase(), s = (school||'').toLowerCase();
        if (NE_KW.some(k=>d.includes(k)||s.includes(k))) return 'NE';
        if (SW_KW.some(k=>d.includes(k))) return 'SW';
        if (SW_SC.some(k=>s.includes(k))) return 'SW';
        return 'NE';
      }
      function matchesFR(school, district) {
        if (regionF !== 'ALL' && scRegion(school, district) !== regionF) return false;
        if (schoolF   && school   !== schoolF)   return false;
        if (districtF && district !== districtF) return false;
        return true;
      }
      function matchesTutor(name) {
        if (!tutorQ) return true;
        return (name||'').toLowerCase().includes(tutorQ);
      }

      const now = new Date();
      const dateStr = now.toLocaleDateString('en-US', { weekday:'long', year:'numeric', month:'long', day:'numeric' });
      const scopeStr = [
        regionF !== 'ALL' ? regionF + ' Region' : 'All Regions',
        schoolF   || '',
        districtF || '',
        tutorQ    ? `Tutor: "${tutorQ}"` : '',
      ].filter(Boolean).join(' · ');

      // ── Section 1: Incomplete Sessions ─────────────────────────────────────
      // Definition: status === 'Scheduled' with no attendance detail logged.
      // These are sessions that exist in Pearl but have not been completed or
      // officially cancelled — staff need to locate them by Session ID and resolve.
      const incompleteByTutor = {};
      for (const sess of Object.values(_sessMap || {})) {
        if (!matchesFR(sess.school, sess.district)) continue;
        if (sess.status !== 'Scheduled') continue;  // only Scheduled = not yet completed
        const tname = (sess.instructor || '').trim(); if (!tname) continue;
        if (!matchesTutor(tname)) continue;
        if (!incompleteByTutor[tname]) incompleteByTutor[tname] = { name: tname, school: sess.school, district: sess.district, sessions: [] };
        incompleteByTutor[tname].sessions.push(sess);
      }
      const incompleteTutors = Object.values(incompleteByTutor).sort((a,b)=>b.sessions.length-a.sessions.length);

      // ── Section 2: Survey Capture Rate ────────────────────────────────────
      // Tutor survey deploys when ≥1 scholar attends a delivered session.
      // "Total Submitted"  = all _instRows rows for this tutor (what Pearl shows you).
      // "Validated"        = submitted surveys whose Session ID matches a delivered session.
      // "Capture Rate"     = validated / delivered sessions × 100.
      // The gap (Total − Validated) = surveys submitted but not tied to a known delivered session.

      // Step 1: count all tutor surveys submitted (directly from _instRows, no session join)
      const tutorSurveyRaw = {};
      for (const r of (_instRows || [])) {
        const tname    = (r[INST_S.FILLED_BY] || '').trim(); if (!tname) continue;
        const school   = (r[INST_S.SCHOOL]    || '').trim();
        const district = (r[INST_S.DISTRICT]  || '').trim();
        if (!matchesFR(school, district)) continue;
        if (!matchesTutor(tname)) continue;
        if (!tutorSurveyRaw[tname]) tutorSurveyRaw[tname] = { name: tname, school, district, totalSubmitted: 0, validatedSessIds: new Set() };
        tutorSurveyRaw[tname].totalSubmitted++;
        const sessId = r[INST_S.SESS_ID];
        if (sessId && _sessMap && _sessMap[sessId] && _sessMap[sessId].isDelivered) {
          tutorSurveyRaw[tname].validatedSessIds.add(sessId); // unique delivered sessions with a survey
        }
      }

      // Step 2: count delivered sessions per tutor from _sessMap
      const deliveredByTutor = {};
      for (const sess of Object.values(_sessMap || {})) {
        if (!sess.isDelivered) continue;
        if (!matchesFR(sess.school, sess.district)) continue;
        const tname = (sess.instructor || '').trim(); if (!tname) continue;
        if (!matchesTutor(tname)) continue;
        if (!deliveredByTutor[tname]) deliveredByTutor[tname] = { name: tname, school: sess.school, district: sess.district, delivered: 0 };
        deliveredByTutor[tname].delivered++;
      }

      // Step 3: merge — every tutor with delivered sessions appears, even if 0 surveys
      const survCapture = Object.values(deliveredByTutor).map(t => {
        const raw       = tutorSurveyRaw[t.name] || { totalSubmitted: 0, validatedSessIds: new Set() };
        const validated = raw.validatedSessIds.size;  // unique delivered sessions covered
        const rate      = t.delivered > 0 ? Math.round(validated / t.delivered * 100) : 0;
        return { name: t.name, school: t.school, district: t.district,
                 totalSubmitted: raw.totalSubmitted, validated, delivered: t.delivered, rate };
      }).sort((a,b) => a.rate - b.rate); // worst capture first

      // ── Section 3: Low Scholar Ratings ────────────────────────────────────
      // Per tutor: average scholar survey rating across all their sessions.
      // Uses FILLED_FOR (tutor name) and SCHOOL/DISTRICT directly from survey rows —
      // no sessMap join required, which avoids misses from session-ID mismatches.
      const ratingsByTutor = {};
      for (const r of (_stuRows || [])) {
        const tname   = (r[STU_S.FILLED_FOR] || '').trim(); if (!tname) continue;
        const school   = (r[STU_S.SCHOOL]    || '').trim();
        const district = (r[STU_S.DISTRICT]  || '').trim();
        if (!matchesFR(school, district)) continue;
        if (!matchesTutor(tname)) continue;
        const scores = [parseFloat(r[STU_S.CONFIDENCE]), parseFloat(r[STU_S.ENJOYMENT]),
                        parseFloat(r[STU_S.LEARNING]),  parseFloat(r[STU_S.OVERALL])]
                       .filter(v => !isNaN(v) && v > 0);
        if (!scores.length) continue;
        const avg = scores.reduce((a,b)=>a+b,0) / scores.length;
        if (!ratingsByTutor[tname]) ratingsByTutor[tname] = { name: tname, school, district, scores: [], responses: 0 };
        ratingsByTutor[tname].scores.push(avg);
        ratingsByTutor[tname].responses++;
      }
      const lowRatings = Object.values(ratingsByTutor).map(t => ({
        ...t,
        avg: t.scores.length ? parseFloat((t.scores.reduce((a,b)=>a+b,0)/t.scores.length).toFixed(2)) : null
      })).filter(t => t.avg !== null && t.avg < 3.5).sort((a,b)=>a.avg-b.avg);

      // ── Build print HTML ───────────────────────────────────────────────────
      function statusDot(val, good, warn) {
        // good = green threshold, warn = yellow threshold
        const c = val >= good ? '#16a34a' : val >= warn ? '#d97706' : '#dc2626';
        return `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${c};margin-right:5px;vertical-align:middle;"></span>`;
      }

      // ── Terminated tutor lookup for [SEP] badges (field report scope) ────
      const _frNorm = s => (s||'').toLowerCase().replace(/[^a-z ]/g,'').replace(/\s+/g,' ').trim().split(' ').filter(Boolean).sort().join(' ');
      const _frTermMap = {};
      try {
        (window.HR_EMPS||[]).forEach(e => {
          if (e.s === 'Active') return;
          if (!(e.y||[]).includes('2025-2026') && !(e._liveYears||[]).includes('2025-2026')) return;
          const nk = _frNorm(e.n||'');
          if (nk) _frTermMap[nk] = true;
        });
      } catch(_frE) {}
      const _frTermKeys = Object.keys(_frTermMap);
      const _frIsTermHR = name => {
        if (!name) return false;
        const tk = _frNorm(name);
        if (_frTermMap[tk]) return true;
        const tp = tk.split(' ');
        return _frTermKeys.some(dk => {
          const dp = dk.split(' ');
          return (tp.length >= 2 && tp.every(p => dp.includes(p))) ||
                 (dp.length >= 2 && dp.every(p => tp.includes(p)));
        });
      };
      const _sepBadge = name => _frIsTermHR(name)
        ? '<span style="font-size:.6rem;font-weight:700;background:#eff6ff;color:#1d4ed8;padding:.1rem .35rem;border-radius:3px;margin-left:.375rem;border:1px solid #bfdbfe">SEP</span>'
        : '';

      // Flatten incomplete sessions to individual rows for the Session ID table
      const incompleteRows_flat = [];
      for (const t of incompleteTutors) {
        for (const sess of t.sessions) {
          incompleteRows_flat.push({ tutor: t.name, school: t.school, district: t.district, sessId: sess.id || '—', start: sess.start || '', title: sess.title || '' });
        }
      }

      const incomplete_rows = incompleteRows_flat.length ? incompleteRows_flat.map(r => `
        <tr>
          <td style="padding:6px 10px;font-weight:600;color:#1e3a5f">${r.tutor}${_sepBadge(r.tutor)}</td>
          <td style="padding:6px 10px;color:#4b5563;font-size:.85em">${r.school}</td>
          <td style="padding:6px 10px;color:#4b5563;font-size:.85em">${r.district}</td>
          <td style="padding:6px 10px;font-family:monospace;font-size:.8em;color:#7c3aed">${r.sessId}</td>
          <td style="padding:6px 10px;color:#6b7280;font-size:.8em;white-space:nowrap">${r.start ? new Date(r.start).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}) : '—'}</td>
        </tr>`).join('') : `<tr><td colspan="5" style="padding:14px;text-align:center;color:#6b7280;font-style:italic">✓ No incomplete sessions found for this filter</td></tr>`;

      const survey_rows = survCapture.length ? survCapture.map(t => {
        const col  = t.rate >= 80 ? '#16a34a' : t.rate >= 50 ? '#d97706' : '#dc2626';
        const gap  = t.totalSubmitted - t.validated;
        const gapNote = gap > 0
          ? `<div style="font-size:.72em;color:#92400e;margin-top:2px">+${gap} unmatched</div>` : '';
        return `<tr>
          <td style="padding:6px 10px;font-weight:600;color:#1e3a5f">${t.name}${_sepBadge(t.name)}</td>
          <td style="padding:6px 10px;color:#4b5563;font-size:.85em">${t.school}</td>
          <td style="padding:6px 10px;text-align:center;font-weight:700;color:#1e3a5f">${t.totalSubmitted}${gapNote}</td>
          <td style="padding:6px 10px;text-align:center;color:#4b5563">${t.validated} / ${t.delivered}</td>
          <td style="padding:6px 10px;text-align:center;font-weight:700;color:${col}">${statusDot(t.rate,80,50)}${t.rate}%</td>
        </tr>`;
      }).join('') : `<tr><td colspan="5" style="padding:14px;text-align:center;color:#6b7280;font-style:italic">No session data available for this filter</td></tr>`;

      const rating_rows = lowRatings.length ? lowRatings.map(t => {
        const col = t.avg >= 4.0 ? '#16a34a' : t.avg >= 3.5 ? '#d97706' : '#dc2626';
        return `<tr>
          <td style="padding:6px 10px;font-weight:600;color:#1e3a5f">${t.name}${_sepBadge(t.name)}</td>
          <td style="padding:6px 10px;color:#4b5563;font-size:.85em">${t.school}</td>
          <td style="padding:6px 10px;text-align:center;color:#4b5563">${t.responses} response${t.responses!==1?'s':''}</td>
          <td style="padding:6px 10px;text-align:center;font-weight:700;color:${col}">${statusDot(t.avg,4.0,3.5)}${t.avg}</td>
        </tr>`;
      }).join('') : `<tr><td colspan="4" style="padding:14px;text-align:center;color:#6b7280;font-style:italic">✓ No tutors below 3.5 rating threshold for this filter</td></tr>`;

      // ── Effective week helpers — same method as Pearl Operations ──────────
      // Priority: (1) explicit WEEK column, (2) session start date via Session ID
      // + Pearl User ID match, (3) Date Responded column as last resort.
      // Scholar surveys: verify Filled For ID is in session.studentIds.
      // Instructor surveys: tutors rate the entire session — Session ID only.
      const _sessWeekById = sessId => {
        const sess = sessId && _sessMap ? _sessMap[sessId] : null;
        return sess ? (weekKeyFromDateStr(sess.start) || '') : '';
      };
      const _effWeekStu = r => {
        if (r[STU_S.WEEK]) return r[STU_S.WEEK];
        const sessId = r[STU_S.SESS_ID] || '';
        const sess   = sessId && _sessMap ? _sessMap[sessId] : null;
        if (sess) {
          const filledForId = (r[STU_S.FILLED_FOR_ID] || '').trim();
          // Accept if no user ID or user ID matches a student in this session
          if (!filledForId || !sess.studentIds || sess.studentIds.includes(filledForId)) {
            return weekKeyFromDateStr(sess.start) || '';
          }
        }
        return weekKeyFromDateStr(r[STU_S.DATE] || ''); // Date Responded fallback
      };
      const _effWeekInst = r => {
        if (r[INST_S.WEEK]) return r[INST_S.WEEK];
        const sessId = r[INST_S.SESS_ID] || '';
        const sess   = sessId && _sessMap ? _sessMap[sessId] : null;
        if (sess) {
          const filledById = (r[INST_S.FILLED_BY_ID] || '').trim();
          // Tutors rate the whole session — verify instructor ID if present
          if (!filledById || sess.instId === filledById) {
            return weekKeyFromDateStr(sess.start) || '';
          }
        }
        return weekKeyFromDateStr(r[INST_S.DATE] || ''); // Date Responded fallback
      };

      // ── Collect all comments for a category, then pick the most recent week ──
      // Separated staff are excluded from concern flags; their sessions remain in metrics.
      // Deduplication: identical (sessId + normalized text) pairs shown only once.
      function _gatherComments(category) {
        const pool = [];
        const _seen = new Set(); // deduplicate by sessId+text
        const _dedup = (sessId, text) => {
          const key = (sessId || '') + '||' + text.toLowerCase().replace(/\s+/g,' ').trim().slice(0,60);
          if (_seen.has(key)) return false;
          _seen.add(key); return true;
        };
        for (const r of (_stuRows || [])) {
          const text = (r[STU_S.COMMENT] || '').trim();
          if (!text || categorizeComment(text) !== category) continue;
          const school   = (r[STU_S.SCHOOL]   || '').trim();
          const district = (r[STU_S.DISTRICT] || '').trim();
          const sessId   = r[STU_S.SESS_ID] || '';
          const tutor    = (_sessMap && _sessMap[sessId]) ? (_sessMap[sessId].instructor || '') : '';
          if (!matchesFR(school, district)) continue;
          if (!matchesTutor(tutor)) continue;
          if (category === 'concern' && _frIsTermHR(tutor)) continue;
          if (!_dedup(sessId, text)) continue;
          const week = _effWeekStu(r);
          pool.push({ source: 'Scholar', text, tutor, school, district, sessId, week });
        }
        for (const r of (_instRows || [])) {
          const tutor    = (r[INST_S.FILLED_BY] || '').trim();
          const sessId   = r[INST_S.SESS_ID] || '';
          const school   = (r[INST_S.SCHOOL]   || '').trim();
          const district = (r[INST_S.DISTRICT] || '').trim();
          if (!matchesFR(school, district)) continue;
          if (!matchesTutor(tutor)) continue;
          if (category === 'concern' && _frIsTermHR(tutor)) continue;
          const week = _effWeekInst(r);
          for (const raw of [r[INST_S.COMMENT_ADMIN], r[INST_S.COMMENT_SELF]]) {
            const text = (raw||'').trim();
            if (!text || categorizeComment(text) !== category) continue;
            if (!_dedup(sessId, text)) continue;
            pool.push({ source: 'Tutor', text, tutor, school, district, sessId, week });
          }
        }
        // Sort pool by week descending; filter to most recent week
        pool.sort((a,b) => parseInt((b.week||'Week 0').replace('Week ','')) - parseInt((a.week||'Week 0').replace('Week ','')));
        const topWeek = pool.length ? pool[0].week : '';
        const weekPool = pool.filter(c => c.week === topWeek);

        if (category !== 'positive') return weekPool.slice(0, 5);

        // ── Spotlight quality filter + tutor diversity ─────────────────────
        // Reject spam (keyboard mashing), too-short, and off-topic comments.
        const TUTOR_CTX = ['tutor','session','class','learn','taught','teach','lesson',
          'help','explain','understand','today','practice','mrs','mr','ms',
          'teacher','coach','showed','showed me','showed us','my tutor','the tutor'];
        const _qualOk = txt => {
          if (!txt || txt.length < 20) return false;            // too short
          if (/(.)\1{4,}/i.test(txt)) return false;             // keyboard spam
          const lo = txt.toLowerCase();
          // Must reference tutoring context OR have 2+ positive keyword hits
          const posHits = COMMENT_BUCKETS.positive.keywords.filter(kw => _kwMatch(lo, kw)).length;
          const hasCtx  = TUTOR_CTX.some(w => lo.includes(w));
          return hasCtx || posHits >= 2;
        };
        // Score by quality (length + keyword richness) for ranking
        const scored = weekPool
          .filter(c => _qualOk(c.text))
          .map(c => {
            const lo = c.text.toLowerCase();
            const hits = COMMENT_BUCKETS.positive.keywords.filter(kw => _kwMatch(lo, kw)).length;
            return { ...c, _q: c.text.length + hits * 15 };
          })
          .sort((a,b) => b._q - a._q);
        // Select top 5 ensuring at most 2 per tutor (prefer variety across tutors)
        const tutorCnt = {};
        const selected = [];
        for (const c of scored) {
          const k = c.tutor || '—';
          if ((tutorCnt[k] || 0) >= 2) continue;
          tutorCnt[k] = (tutorCnt[k] || 0) + 1;
          selected.push(c);
          if (selected.length >= 5) break;
        }
        return selected;
      }

      // ── Section 4: Comments Requiring Follow-Up (concern bucket, top 5) ──
      const flaggedComments = _gatherComments('concern');

      // ── Section 5: Spotlight Comments (positive bucket, top 5) ─────────
      const spotlightComments = _gatherComments('positive');

      const flaggedCommentRows = flaggedComments.length ? flaggedComments.map(c => `
        <tr>
          <td style="padding:6px 10px;font-weight:600;color:#1e3a5f">${c.tutor || '—'}</td>
          <td style="padding:6px 10px;color:#4b5563;font-size:.85em">${c.school}</td>
          <td style="padding:6px 10px;font-family:monospace;font-size:.75em;color:#7c3aed">${c.sessId || '—'}</td>
          <td style="padding:6px 10px;font-size:.75em;color:#6b7280">${c.source} · ${c.week}</td>
          <td style="padding:6px 10px;font-size:.85em;color:#991b1b">${c.text.replace(/</g,'&lt;').replace(/>/g,'&gt;')}</td>
        </tr>`).join('') : `<tr><td colspan="5" style="padding:14px;text-align:center;color:#6b7280;font-style:italic">✓ No concern-flagged comments found for this filter</td></tr>`;

      const spotlightRows = spotlightComments.length ? spotlightComments.map(c => `
        <tr>
          <td style="padding:6px 10px;font-weight:600;color:#1e3a5f">${c.tutor || '—'}${_sepBadge(c.tutor)}</td>
          <td style="padding:6px 10px;color:#4b5563;font-size:.85em">${c.school}</td>
          <td style="padding:6px 10px;font-size:.75em;color:#6b7280">${c.source} · ${c.week}</td>
          <td style="padding:6px 10px;font-size:.85em;color:#166534">${c.text.replace(/</g,'&lt;').replace(/>/g,'&gt;')}</td>
        </tr>`).join('') : `<tr><td colspan="4" style="padding:14px;text-align:center;color:#6b7280;font-style:italic">No spotlight comments found for this filter</td></tr>`;

      const sectionStyle = 'margin-bottom:28px;border-radius:10px;overflow:hidden;border:1px solid #e5e7eb;';
      const hdStyle = 'padding:10px 14px;font-size:.8rem;font-weight:700;text-transform:uppercase;letter-spacing:.06em;display:flex;justify-content:space-between;align-items:center;';
      const thStyle = 'padding:7px 10px;font-size:.72rem;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:#6b7280;border-bottom:2px solid #e5e7eb;background:#f9fafb;text-align:center;';
      // Use the week from the actual returned comments (most recent week with data)
      const _flagWeekLabel  = flaggedComments.length  ? (flaggedComments[0].week  || '') : weekKeyFromDateStr(new Date());
      const _spotWeekLabel  = spotlightComments.length ? (spotlightComments[0].week || '') : weekKeyFromDateStr(new Date());

      const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
        <title>NJTC Onsite Staff Report — ${dateStr}</title>
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { font-family: system-ui, -apple-system, sans-serif; color: #111827; background: #fff; padding: 32px; font-size: 13px; }
          table { width: 100%; border-collapse: collapse; table-layout: fixed; }
          td, th { word-wrap: break-word; overflow-wrap: break-word; }
          tr:nth-child(even) td { background: #f9fafb; }
          tr:hover td { background: #f0f9ff; }
          .def-box { background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:12px 16px; margin-bottom:24px; }
          .def-box h3 { font-size:.75rem; font-weight:700; text-transform:uppercase; letter-spacing:.06em; color:#64748b; margin-bottom:8px; }
          .def-item { display:flex; gap:8px; margin-bottom:5px; font-size:.8rem; line-height:1.4; }
          .def-label { font-weight:700; color:#1e3a5f; min-width:120px; flex-shrink:0; }
          .def-text { color:#4b5563; }
          @media print {
            * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
            body { padding: 16px; }
            button { display: none !important; }
            tr:hover td { background: inherit; }
            .no-break { page-break-inside: avoid; }
          }
        </style>
      </head><body>

        <!-- Header -->
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:20px;padding-bottom:16px;border-bottom:3px solid #1e3a5f;">
          <div>
            <div style="font-size:1.5rem;font-weight:800;color:#1e3a5f;">NJTC Onsite Staff Report</div>
            <div style="color:#6b7280;font-size:.9rem;margin-top:4px;">${dateStr}</div>
            ${scopeStr ? `<div style="color:#2563eb;font-size:.85rem;font-weight:600;margin-top:4px;">Filters: ${scopeStr}</div>` : ''}
          </div>
          <button onclick="window.print()" style="padding:8px 20px;background:#1e3a5f;color:#fff;border:none;border-radius:8px;font-size:.875rem;font-weight:700;cursor:pointer;">🖨 Print / Save PDF</button>
        </div>

        <!-- How to read this report -->
        <div class="def-box">
          <h3>📖 How to Read This Report — Metric Definitions</h3>
          <div class="def-item">
            <span class="def-label">Incomplete Session</span>
            <span class="def-text">A session in Pearl with status <strong>Scheduled</strong> and no attendance detail logged. The tutor has not yet marked the session as completed or cancelled. Use the Session ID column to locate these in Pearl and follow up directly with the tutor.</span>
          </div>
          <div class="def-item">
            <span class="def-label">Survey Capture Rate</span>
            <span class="def-text">% of <strong>delivered sessions</strong> (status = Completed) where the <strong>tutor submitted their survey</strong>. The tutor survey deploys once at least one scholar is in attendance — so any completed session with a scholar present requires a tutor survey response. A rate below 80% means most sessions are running without tutor voice data. Target: ≥80%.</span>
          </div>
          <div class="def-item">
            <span class="def-label">Scholar Rating (Avg)</span>
            <span class="def-text">The average of four scholar survey questions — Confidence, Enjoyment, Learning, and Overall — each scored 1–5 by the scholar. Averaged across all submitted surveys linked to the tutor's sessions. Threshold for follow-up: below 3.5.</span>
          </div>
          <div class="def-item">
            <span class="def-label">Flagged Comment</span>
            <span class="def-text">A free-text survey comment (scholar or tutor) that matched concern-category keywords (e.g., struggling, behavior, confusion, difficult). These are auto-categorized and surfaced for team review — not a formal HR action, but a signal to follow up.</span>
          </div>
          <div class="def-item">
            <span class="def-label">Spotlight Comment</span>
            <span class="def-text">A free-text comment matching positive-category keywords (e.g., amazing, love, great, excited, engaged). Surfaced as candidates for shoutouts or recognition during team meetings.</span>
          </div>
        </div>

        <!-- Summary pills -->
        <div style="display:flex;gap:12px;margin-bottom:24px;flex-wrap:wrap;">
          <div style="background:#fee2e2;border-radius:8px;padding:8px 16px;">
            <span style="font-size:1.3rem;font-weight:800;color:#dc2626;">${incompleteRows_flat.length}</span>
            <span style="font-size:.8rem;color:#991b1b;font-weight:600;margin-left:6px;">Incomplete Sessions</span>
          </div>
          <div style="background:#fef3c7;border-radius:8px;padding:8px 16px;">
            <span style="font-size:1.3rem;font-weight:800;color:#d97706;">${survCapture.filter(t=>t.rate<80).length}</span>
            <span style="font-size:.8rem;color:#92400e;font-weight:600;margin-left:6px;">Tutors Below 80% Capture</span>
          </div>
          <div style="background:#fee2e2;border-radius:8px;padding:8px 16px;">
            <span style="font-size:1.3rem;font-weight:800;color:#dc2626;">${lowRatings.length}</span>
            <span style="font-size:.8rem;color:#991b1b;font-weight:600;margin-left:6px;">Tutors Low Ratings</span>
          </div>
          <div style="background:#fff7ed;border-radius:8px;padding:8px 16px;">
            <span style="font-size:1.3rem;font-weight:800;color:#c2410c;">${flaggedComments.length}</span>
            <span style="font-size:.8rem;color:#9a3412;font-weight:600;margin-left:6px;">Flagged Comments</span>
          </div>
          <div style="background:#f0fdf4;border-radius:8px;padding:8px 16px;">
            <span style="font-size:1.3rem;font-weight:800;color:#15803d;">${spotlightComments.length}</span>
            <span style="font-size:.8rem;color:#14532d;font-weight:600;margin-left:6px;">Spotlight Comments</span>
          </div>
        </div>

        <!-- Section 1: Incompletes -->
        <div style="${sectionStyle}">
          <div style="${hdStyle}background:#fef2f2;border-bottom:1px solid #fecaca;">
            <span style="color:#991b1b;">⚠️ Section 1 — Incomplete Sessions (Scheduled · No Attendance Logged)</span>
            <span style="color:#dc2626;font-weight:800;font-size:1rem;">${incompleteRows_flat.length} session${incompleteRows_flat.length!==1?'s':''}</span>
          </div>
          <table>
            <thead><tr>
              <th style="${thStyle}text-align:left;">Tutor</th>
              <th style="${thStyle}text-align:left;">School</th>
              <th style="${thStyle}text-align:left;">District</th>
              <th style="${thStyle}text-align:left;">Session ID</th>
              <th style="${thStyle}">Scheduled Date</th>
            </tr></thead>
            <tbody>${incomplete_rows}</tbody>
          </table>
        </div>

        <!-- Section 2: Survey Capture -->
        <div style="${sectionStyle}">
          <div style="${hdStyle}background:#eff6ff;border-bottom:1px solid #bfdbfe;">
            <span style="color:#1d4ed8;">📊 Section 2 — Survey Capture Rate</span>
            <span style="color:#1d4ed8;font-weight:800;font-size:1rem;">${survCapture.length} tutors</span>
          </div>
          <table>
            <thead><tr>
              <th style="${thStyle}text-align:left;">Tutor</th>
              <th style="${thStyle}text-align:left;">School</th>
              <th style="${thStyle}">Total Submitted</th>
              <th style="${thStyle}">Validated / Delivered Sessions</th>
              <th style="${thStyle}">Capture Rate</th>
            </tr></thead>
            <tbody>${survey_rows}</tbody>
          </table>
          <div style="padding:8px 14px;background:#fefce8;border-top:1px solid #fef08a;font-size:.75rem;color:#713f12;">
            <strong>Total Submitted</strong> = all tutor surveys in Pearl for this tutor (matches what you see in Pearl directly).
            <strong>Validated</strong> = surveys whose Session ID maps to a known delivered session.
            <strong>Unmatched</strong> = submitted surveys with no matching session — investigate in Pearl.
          </div>
        </div>

        <!-- Section 3: Low Ratings -->
        <div style="${sectionStyle}">
          <div style="${hdStyle}background:#fef2f2;border-bottom:1px solid #fecaca;">
            <span style="color:#991b1b;">⭐ Section 3 — Low Scholar Ratings (Avg Below 3.5 / 5.0)</span>
            <span style="color:#dc2626;font-weight:800;font-size:1rem;">${lowRatings.length} tutor${lowRatings.length!==1?'s':''}</span>
          </div>
          <table>
            <thead><tr>
              <th style="${thStyle}text-align:left;">Tutor</th>
              <th style="${thStyle}text-align:left;">School</th>
              <th style="${thStyle}">Responses</th>
              <th style="${thStyle}">Avg Rating</th>
            </tr></thead>
            <tbody>${rating_rows}</tbody>
          </table>
        </div>

        <!-- Section 4: Flagged Comments -->
        <div style="${sectionStyle}">
          <div style="${hdStyle}background:#fff7ed;border-bottom:1px solid #fed7aa;">
            <span style="color:#9a3412;">🚩 Section 4 — Comments Requiring Follow-Up${_flagWeekLabel ? ' · ' + _flagWeekLabel : ''} (Top 5 · Concern Keywords)</span>
            <span style="color:#c2410c;font-weight:800;font-size:1rem;">${flaggedComments.length} comment${flaggedComments.length!==1?'s':''}</span>
          </div>
          <table>
            <thead><tr>
              <th style="${thStyle}text-align:left;">Tutor</th>
              <th style="${thStyle}text-align:left;">School</th>
              <th style="${thStyle}text-align:left;">Session ID</th>
              <th style="${thStyle}text-align:left;">Source · Week</th>
              <th style="${thStyle}text-align:left;">Comment</th>
            </tr></thead>
            <tbody>${flaggedCommentRows}</tbody>
          </table>
        </div>

        <!-- Section 5: Spotlight Comments -->
        <div style="${sectionStyle}">
          <div style="${hdStyle}background:#f0fdf4;border-bottom:1px solid #bbf7d0;">
            <span style="color:#14532d;">⭐ Section 5 — Spotlight Comments${_spotWeekLabel ? ' · ' + _spotWeekLabel : ''} (Top 5 · Shoutout Candidates)</span>
            <span style="color:#15803d;font-weight:800;font-size:1rem;">${spotlightComments.length} comment${spotlightComments.length!==1?'s':''}</span>
          </div>
          <table>
            <thead><tr>
              <th style="${thStyle}text-align:left;">Tutor</th>
              <th style="${thStyle}text-align:left;">School</th>
              <th style="${thStyle}text-align:left;">Source · Week</th>
              <th style="${thStyle}text-align:left;">Comment</th>
            </tr></thead>
            <tbody>${spotlightRows}</tbody>
          </table>
        </div>

        <div style="margin-top:24px;padding-top:16px;border-top:1px solid #e5e7eb;font-size:.75rem;color:#9ca3af;text-align:center;">
          Generated by NJTC Central Portal · Pearl Operations · ${dateStr}
          ${scopeStr ? ' · ' + scopeStr : ''}
        </div>
      </body></html>`;

      // Open in new window for print/save
      const win = window.open('', '_blank', 'width=900,height=700');
      if (!win) { alert('Pop-up blocked. Please allow pop-ups and try again.'); return; }
      win.document.open();
      win.document.write(html);
      win.document.close();
      // Close modal
      const modal = document.getElementById('poFieldReportModal');
      if (modal) modal.style.display = 'none';
    }

    // ── COMMENT ACCESSOR — for PIE and external callers ───────────────────
    // Returns array of { source, bucket, text, tutor, school, district, sessId, week }
    // category: 'concern' | 'positive' | 'engagement' | 'logistics' | 'curriculum' | 'relationship' | null (all)
    // opts: { region:'NE'|'SW'|'ALL', school, district, tutor, max, week:'current'|'Week N'|null }
    //       week defaults to 'current' (this week only); pass null/'' to get all weeks
    function getCommentsByCategory(category, opts) {
      opts = opts || {};
      const regionF   = (opts.region   || 'ALL').toUpperCase();
      const schoolF   = (opts.school   || '').trim();
      const districtF = (opts.district || '').trim();
      const tutorQ    = (opts.tutor    || '').toLowerCase().trim();
      const maxRows   = opts.max || 20;
      // Default to current week; pass opts.week=null to see all weeks
      const weekF     = opts.week === null || opts.week === '' ? null
                      : (opts.week === 'current' || opts.week === undefined)
                        ? weekKeyFromDateStr(new Date())
                        : opts.week;

      const NE_KW = ['ilearn','i-learn','paterson','pcsst','paterson charter','hoboken','middlesex','central jersey'];
      const SW_KW = ['american paradigm','first philadelphia','first philly','philadelphia charter','string theory','global leadership academy','global leadership','penns grove','carneys point','haddon township','haddon','hamilton township','gloucester township'];
      const SW_SC = ['erial','loring flemming','field street','penns grove middle','van sciver','strawbridge','first philadelphia prep','first philly prep','the philadelphia charter','philadelphia charter school','global leadership academy'];
      function scReg(school, district) {
        const d=(district||'').toLowerCase(), s=(school||'').toLowerCase();
        if (NE_KW.some(k=>d.includes(k)||s.includes(k))) return 'NE';
        if (SW_KW.some(k=>d.includes(k))) return 'SW';
        if (SW_SC.some(k=>s.includes(k))) return 'SW';
        return 'NE';
      }
      function matchReg(school, district) {
        if (regionF !== 'ALL' && scReg(school, district) !== regionF) return false;
        if (schoolF   && school   !== schoolF)   return false;
        if (districtF && district !== districtF) return false;
        return true;
      }

      // ── Week derivation (same method as _generateFieldReport) ────────────
      // (1) explicit WEEK column, (2) session start via Session ID + User ID,
      // (3) Date Responded column as last resort.
      const _gcWeekStu = r => {
        if (r[STU_S.WEEK]) return r[STU_S.WEEK];
        const sid  = r[STU_S.SESS_ID] || '';
        const sess = sid && _sessMap ? _sessMap[sid] : null;
        if (sess) {
          const ffi = (r[STU_S.FILLED_FOR_ID] || '').trim();
          if (!ffi || !sess.studentIds || sess.studentIds.includes(ffi))
            return weekKeyFromDateStr(sess.start) || '';
        }
        return weekKeyFromDateStr(r[STU_S.DATE] || '');
      };
      const _gcWeekInst = r => {
        if (r[INST_S.WEEK]) return r[INST_S.WEEK];
        const sid  = r[INST_S.SESS_ID] || '';
        const sess = sid && _sessMap ? _sessMap[sid] : null;
        if (sess) {
          const fbi = (r[INST_S.FILLED_BY_ID] || '').trim();
          if (!fbi || sess.instId === fbi)
            return weekKeyFromDateStr(sess.start) || '';
        }
        return weekKeyFromDateStr(r[INST_S.DATE] || '');
      };

      const results = [];
      // Scholar comments
      for (const r of (_stuRows || [])) {
        if (results.length >= maxRows) break;
        const week = _gcWeekStu(r);
        if (weekF && week && week !== weekF) continue; // week filter
        const text = (r[STU_S.COMMENT] || '').trim(); if (!text) continue;
        const bucket = categorizeComment(text);
        if (category && bucket !== category) continue;
        const sessId   = r[STU_S.SESS_ID] || '';
        const school   = (r[STU_S.SCHOOL]   || '').trim();
        const district = (r[STU_S.DISTRICT] || '').trim();
        const tutor    = (_sessMap && _sessMap[sessId]) ? (_sessMap[sessId].instructor || '') : '';
        if (!matchReg(school, district)) continue;
        if (tutorQ && !tutor.toLowerCase().includes(tutorQ)) continue;
        results.push({ source: 'scholar', bucket, text, tutor, school, district, sessId, week });
      }
      // Instructor comments
      for (const r of (_instRows || [])) {
        if (results.length >= maxRows) break;
        const week     = _gcWeekInst(r);
        if (weekF && week && week !== weekF) continue;
        const tutor    = (r[INST_S.FILLED_BY] || '').trim();
        const sessId   = r[INST_S.SESS_ID] || '';
        const school   = (r[INST_S.SCHOOL]   || '').trim();
        const district = (r[INST_S.DISTRICT] || '').trim();
        if (!matchReg(school, district)) continue;
        if (tutorQ && !tutor.toLowerCase().includes(tutorQ)) continue;
        for (const text of [r[INST_S.COMMENT_ADMIN], r[INST_S.COMMENT_SELF]].map(t=>(t||'').trim()).filter(Boolean)) {
          if (results.length >= maxRows) break;
          const bucket = categorizeComment(text);
          if (category && bucket !== category) continue;
          results.push({ source: 'instructor', bucket, text, tutor, school, district, sessId, week });
        }
      }
      return results;
    }

    // ── EXPORT ENGINE ─────────────────────────────────────────────────────
    function exportData(format) {
      // Build the export using current filter state
      const isFiltered = _filtDistrict.length || _filtSchool.length || _filtWeek.length || _filtRole.length || _filtFlag.length;

      // ── Helper: safe numeric average ──────────────────────────────────
      function safeAvg(arr) {
        const nums = arr.map(v => parseFloat(v)).filter(v => !isNaN(v));
        return nums.length ? (nums.reduce((a,b) => a+b, 0) / nums.length).toFixed(2) : '';
      }
      function safeNum(v) { const n = parseFloat(v); return isNaN(n) ? '' : n.toFixed(2); }

      // ── 1. SCHOLAR DETAIL ROWS ─────────────────────────────────────────
      // One row per scholar, aggregated across all their sessions
      const scholarRows = [];
      for (const [uid, p] of Object.entries(_personMap)) {
        if (p.role !== 'Student') continue;
        if (!matchesSchoolFilter(p.school, p.district)) continue;

        // Filter att rows for this person
        const personAttRows = p.rows.filter(r => {
          if (_filtWeek.length && !_filtWeek.includes(r[ATT.WEEK])) return false;
          return true;
        });
        if (!personAttRows.length) continue;
        // Active scholars only — must have attended at least 1 session
        const hasAttended = personAttRows.some(r => classifyRecord(r) === 'attended');
        if (!hasAttended) continue;

        const attended = personAttRows.filter(r => classifyRecord(r) === 'attended').length;
        const absent   = personAttRows.filter(r => classifyRecord(r) === 'absent').length;
        const si       = personAttRows.filter(r => classifyRecord(r) === 'service_interruption').length;
        const total    = attended + absent;
        const attPct   = total > 0 ? (attended / total * 100).toFixed(1) : '';

        // Survey scores for this scholar — use pre-linked stuSurveys from buildIndexes
        const survFiltered = (p.stuSurveys || []).filter(r => {
          if (_filtWeek.length && !_filtWeek.includes(r[STU_S.WEEK])) return false;
          if (!matchesSchoolFilter(r[STU_S.SCHOOL], r[STU_S.DISTRICT])) return false;
          return true;
        });

        // Session IDs this scholar appeared in
        const sessIds = [...new Set(personAttRows.map(r => r[ATT.SESSION]).filter(Boolean))];

        // Tutor associations — find sessions this scholar attended, get instructors
        const tutorNames = new Set();
        for (const [sid, sess] of Object.entries(_sessMap)) {
          if (sess.school && !matchesSchoolFilter(sess.school, sess.district)) continue;
          if (sess.studentIds && sess.studentIds.includes(uid)) {
            if (sess.instructor) tutorNames.add(sess.instructor);
          }
        }

        // Duration — sum actual durations from sessions this scholar was in
        let totalMins = 0;
        for (const [sid, sess] of Object.entries(_sessMap)) {
          if (!matchesSchoolFilter(sess.school, sess.district)) continue;
          if (sess.studentIds && sess.studentIds.includes(uid)) {
            totalMins += sess.durMins || 0;
          }
        }

        // Per-subject breakdown (from sessions)
        const bySubject = {};
        for (const [sid, sess] of Object.entries(_sessMap)) {
          if (!matchesSchoolFilter(sess.school, sess.district)) continue;
          if (sess.studentIds && sess.studentIds.includes(uid)) {
            const subj = sess.subject || 'Unknown';
            if (!bySubject[subj]) bySubject[subj] = { mins: 0, sessions: 0 };
            bySubject[subj].mins += sess.durMins || 0;
            bySubject[subj].sessions++;
          }
        }

        scholarRows.push({
          'Scholar Name':        p.name,
          'Scholar Pearl ID':    uid,
          'Role':                'Student',
          'Grade':               p.grade || '',
          'Sex':                 p.sex || '',
          'Race/Ethnicity':      p.race || '',
          'School':              p.school,
          'District':            p.district,
          'Week(s)':             _filtWeek.length ? _filtWeek.join('; ') : 'All',
          'Sessions Attended':   attended,
          'Sessions Absent':     absent,
          'Service Interruptions': si,
          'Attendance Rate (%)': attPct,
          'Consecutive Status':  p.consecStatus || '',
          'Total Duration (min)': totalMins || '',
          'Linked Session Titles': sessIds.slice(0,5).join('; '),
          'Associated Tutor(s)': [...tutorNames].join('; '),
          'Survey Count':        survFiltered.length,
          'Survey Avg Confidence': safeAvg(survFiltered.map(r => r[STU_S.CONFIDENCE])),
          'Survey Avg Enjoyment':  safeAvg(survFiltered.map(r => r[STU_S.ENJOYMENT])),
          'Survey Avg Learning':   safeAvg(survFiltered.map(r => r[STU_S.LEARNING])),
          'Survey Avg Overall':    safeAvg(survFiltered.map(r => r[STU_S.OVERALL])),
          'Subjects (session count)': Object.entries(bySubject).map(([s,v]) => `${s}: ${v.sessions} sess`).join('; '),
          'Subjects (minutes)':       Object.entries(bySubject).map(([s,v]) => `${s}: ${v.mins}min`).join('; '),
        });
      }

      // ── 2. TUTOR DETAIL ROWS ──────────────────────────────────────────
      const tutorRows = [];
      for (const [uid, p] of Object.entries(_personMap)) {
        if (p.role !== 'Instructor') continue;
        if (!matchesSchoolFilter(p.school, p.district)) continue;

        const personAttRows = p.rows.filter(r => {
          if (_filtWeek.length && !_filtWeek.includes(r[ATT.WEEK])) return false;
          return true;
        });
        if (!personAttRows.length) continue;

        const attended = personAttRows.filter(r => classifyRecord(r) === 'attended').length;
        const absent   = personAttRows.filter(r => classifyRecord(r) === 'absent').length;
        const si       = personAttRows.filter(r => classifyRecord(r) === 'service_interruption').length;
        const total    = attended + absent;
        const attPct   = total > 0 ? (attended / total * 100).toFixed(1) : '';

        // Sessions this tutor led
        const ledSessions = Object.values(_sessMap).filter(s =>
          s.instId === uid && matchesSchoolFilter(s.school, s.district)
        );
        const totalMins = ledSessions.reduce((a, s) => a + (s.durMins || 0), 0);
        const uniqueStudents = new Set(ledSessions.flatMap(s => s.studentIds || []));

        // Per-subject
        const bySubject = {};
        for (const sess of ledSessions) {
          const subj = sess.subject || 'Unknown';
          if (!bySubject[subj]) bySubject[subj] = { mins: 0, sessions: 0 };
          bySubject[subj].mins += sess.durMins || 0;
          bySubject[subj].sessions++;
        }

        // Tutor surveys — use pre-linked instSurveys from buildIndexes
        const survFiltered = (p.instSurveys || []).filter(r => {
          if (_filtWeek.length && !_filtWeek.includes(r[INST_S.WEEK])) return false;
          if (!matchesSchoolFilter(r[INST_S.SCHOOL], r[INST_S.DISTRICT])) return false;
          return true;
        });

        tutorRows.push({
          'Tutor Name':          p.name,
          'Tutor Pearl ID':      uid,
          'Role':                'Instructor',
          'School':              p.school,
          'District':            p.district,
          'Week(s)':             _filtWeek.length ? _filtWeek.join('; ') : 'All',
          'Sessions Led':        ledSessions.length,
          'Sessions Attended':   attended,
          'Sessions Absent':     absent,
          'Service Interruptions': si,
          'Attendance Rate (%)': attPct,
          'Total Duration (min)': totalMins || '',
          'Active Scholars Served': uniqueStudents.size,
          'HIT Flags':           p.flags ? p.flags.length : 0,
          'Survey Eligible Sessions': p.surveyEligible || 0,
          'Surveys Submitted':   p.surveySubmitted || 0,
          'Survey Completion Rate (%)': p.surveyCompRate !== null && p.surveyCompRate !== undefined ? p.surveyCompRate : '',
          'Survey Count':        survFiltered.length,
          'Survey Avg Engagement': safeAvg(survFiltered.map(r => r[INST_S.ENGAGEMENT])),
          'Survey Avg Enjoyment':  safeAvg(survFiltered.map(r => r[INST_S.ENJOYMENT])),
          'Survey Avg Learning':   safeAvg(survFiltered.map(r => r[INST_S.LEARNING])),
          'Survey Avg Overall':    safeAvg(survFiltered.map(r => r[INST_S.OVERALL])),
          'Subjects (session count)': Object.entries(bySubject).map(([s,v]) => `${s}: ${v.sessions} sess`).join('; '),
          'Subjects (minutes)':       Object.entries(bySubject).map(([s,v]) => `${s}: ${v.mins}min`).join('; '),
        });
      }

      // ── 3. SESSION DETAIL ROWS ────────────────────────────────────────
      const sessionRows = [];
      for (const [sid, sess] of Object.entries(_sessMap)) {
        if (!matchesSchoolFilter(sess.school, sess.district)) continue;
        if (_filtWeek.length) {
          // derive week from session start date using same Pearl-aligned logic
          const sw = sessWeek(sess);
          if (!sw || !_filtWeek.includes(sw)) continue;
        }

        sessionRows.push({
          'Session ID':          sid,
          'Week':                sessWeek(sess),
          'Session Title':       sess.title || '',
          'Instructor Name':     sess.instructor || '',
          'Instructor Pearl ID': sess.instId || '',
          'Student Names':       sess.students || '',
          'Student Pearl IDs':   (sess.studentIds || []).join('; '),
          'School':              sess.school || '',
          'District':            sess.district || '',
          'Subject':             sess.subject || '',
          'Grade':               sess.grade || '',
          'Location':            sess.location || '',
          'Status':              sess.status || '',
          'Scheduled Start':     sess.start || '',
          'Scheduled Duration':  sess.schedDur || '',
          'Actual Duration':     sess.actualDur || '',
          'Duration (min)':      sess.durMins || '',
          'Attendance Summary':  sess.attendance || '',
          'Is Delivered':        sess.isDelivered ? 'Yes' : 'No',
          'Is Full Attendance':  sess.isFullAtt ? 'Yes' : 'No',
          'Is Partial Attendance': sess.isPartial ? 'Yes' : 'No',
          'Scholar Count':       (sess.studentIds || []).length,
          'Ratio Flag':          sess.ratioFlag ? 'Yes' : 'No',
        });
      }

      // ── 4. SCHOOL SUMMARY ROWS ────────────────────────────────────────
      const schoolRows = [];
      for (const [school, sc] of Object.entries(_schoolMap)) {
        if (!matchesSchoolFilter(school, sc.district)) continue;
        schoolRows.push({
          'School':                  school,
          'District':                sc.district,
          'Scholar Attendance Rate (%)': sc.attRate,
          'Scholars Attended':       sc.stuAttended,
          'Scholars Absent':         sc.stuAbsent,
          'Service Interruptions':   sc.stuInterruptions,
          'Tutor Sessions':          sc.totalInstRows,
          'Sessions Delivered':      sc.sessions.filter(s => s.isDelivered).length,
          'Total Duration (min)':    sc.sessions.reduce((a,s) => a + (s.durMins||0), 0),
          'Scholar Survey Avg':      safeNum(sc.stuSurveyAvg),
          'Tutor Survey Avg':        safeNum(sc.instSurveyAvg),
          'Scholar Survey Count':    sc.stuSurveyRows.length,
          'Tutor Survey Count':      sc.instSurveyRows.length,
          'HIT Flags':               sc.flags.length,
          'Ratio Violations':        sc.ratioViolations,
        });
      }

      // ── Build workbook sheets ─────────────────────────────────────────
      const sheets = [
        { name: 'Scholar Detail',  rows: scholarRows },
        { name: 'Tutor Detail',    rows: tutorRows },
        { name: 'Session Detail',  rows: sessionRows },
        { name: 'School Summary',  rows: schoolRows },
      ];

      const filterDesc = [
        _filtDistrict.length ? `Districts: ${_filtDistrict.join(', ')}` : '',
        _filtSchool.length   ? `Schools: ${_filtSchool.join(', ')}` : '',
        _filtWeek.length     ? `Weeks: ${_filtWeek.join(', ')}` : '',
        _filtRole.length     ? `Roles: ${_filtRole.join(', ')}` : '',
        _filtFlag.length     ? `Flags: ${_filtFlag.join(', ')}` : '',
      ].filter(Boolean).join(' | ') || 'No filters — full dataset';

      const ts = new Date().toISOString().replace(/[:.]/g,'-').slice(0,16);
      const periodTag = _activePeriod === 'summer2026' ? 'Summer2026_' : 'SY2526_';
      const filename = `NJTC_Pearl_Export_${periodTag}${isFiltered ? 'Filtered_' : ''}${ts}`;

      if (format === 'csv') {
        const NL = '\n';
        let csvContent = 'NJTC Pearl Operations Export' + NL
          + 'Period: ' + (_activePeriod === 'summer2026' ? 'Summer 2026' : 'SY 25-26') + NL
          + 'Generated: ' + new Date().toLocaleString() + NL
          + 'Filters: ' + filterDesc + NL + NL;
        for (const sheet of sheets) {
          if (!sheet.rows.length) continue;
          csvContent += '=== ' + sheet.name + ' ===' + NL;
          const cols = Object.keys(sheet.rows[0]);
          csvContent += cols.map(c => '"' + c + '"').join(',') + NL;
          for (const row of sheet.rows) {
            csvContent += cols.map(c => {
              const v = row[c] == null ? '' : String(row[c]);
              return '"' + v.replace(/"/g, '""') + '"';
            }).join(',') + NL;
          }
          csvContent += NL;
        }
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = filename + '.csv';
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        // Delay revoke — Windows AV scans the blob before releasing the handle
        setTimeout(() => URL.revokeObjectURL(url), 2000);

      } else {
        // Excel — use SheetJS via CDN
        if (typeof XLSX === 'undefined') {
          const script = document.createElement('script');
          script.src = 'https://unpkg.com/xlsx@0.18.5/dist/xlsx.full.min.js';
          script.onload = () => _doExcelExport(sheets, filename, filterDesc);
          document.head.appendChild(script);
        } else {
          _doExcelExport(sheets, filename, filterDesc);
        }
      }
    }

    function _doExcelExport(sheets, filename, filterDesc) {
      const wb = XLSX.utils.book_new();

      // Cover / Meta sheet
      const metaData = [
        ['NJTC Pearl Operations — Data Export'],
        ['Period', _activePeriod === 'summer2026' ? 'Summer 2026' : 'SY 25-26'],
        ['Generated', new Date().toLocaleString()],
        ['Filters Applied', filterDesc],
        [''],
        ['Sheets Included', 'Scholar Detail · Tutor Detail · Session Detail · School Summary'],
        [''],
        ['Notes'],
        ['• Attendance Rate excludes Service Interruptions from denominator (NJTC standard)'],
        ['• Duration figures are in minutes from Actual Duration; Scheduled used as fallback'],
        ['• Survey scores are per-question averages on a 1–5 scale'],
        ['• Session IDs are Pearl-assigned unique identifiers'],
      ];
      const metaWS = XLSX.utils.aoa_to_sheet(metaData);
      metaWS['!cols'] = [{ wch: 30 }, { wch: 70 }];
      XLSX.utils.book_append_sheet(wb, metaWS, 'About This Export');

      // Style helpers — apply header row formatting
      function sheetFromRows(rows) {
        if (!rows.length) return XLSX.utils.aoa_to_sheet([['No data for current filters']]);
        const ws = XLSX.utils.json_to_sheet(rows);
        // Auto column widths
        const cols = Object.keys(rows[0]);
        ws['!cols'] = cols.map(c => {
          const maxLen = Math.max(c.length, ...rows.slice(0,50).map(r => String(r[c]||'').length));
          return { wch: Math.min(Math.max(maxLen + 2, 10), 60) };
        });
        // Freeze header row
        ws['!freeze'] = { xSplit: 0, ySplit: 1 };
        return ws;
      }

      for (const sheet of sheets) {
        XLSX.utils.book_append_sheet(wb, sheetFromRows(sheet.rows), sheet.name);
      }

      // Defer to next tick so the browser can paint the "Downloading…" state
      setTimeout(() => XLSX.writeFile(wb, filename + '.xlsx'), 100);
    }

    function showExportModal() {
      const isFiltered = _filtDistrict.length || _filtSchool.length || _filtWeek.length || _filtRole.length || _filtFlag.length;

      // Count records for preview
      const scholarCount = Object.values(_personMap).filter(p => p.role === 'Student' && p.attended > 0 && matchesSchoolFilter(p.school, p.district)).length;
      const tutorCount   = Object.values(_personMap).filter(p => p.role === 'Instructor' && matchesSchoolFilter(p.school, p.district)).length;
      const sessCount    = Object.values(_sessMap).filter(s => matchesSchoolFilter(s.school, s.district)).length;
      const schoolCount  = Object.values(_schoolMap).filter(s => matchesSchoolFilter(s.school, s.district)).length;

      const filterDesc = [
        _filtDistrict.length ? `<strong>Districts:</strong> ${_filtDistrict.join(', ')}` : '',
        _filtSchool.length   ? `<strong>Schools:</strong> ${_filtSchool.join(', ')}` : '',
        _filtWeek.length     ? `<strong>Weeks:</strong> ${_filtWeek.join(', ')}` : '',
        _filtRole.length     ? `<strong>Roles:</strong> ${_filtRole.join(', ')}` : '',
        _filtFlag.length     ? `<strong>Record Types:</strong> ${_filtFlag.join(', ')}` : '',
      ].filter(Boolean).join('<br>') || 'Full dataset (no filters active)';

      let modal = document.getElementById('poExportModal');
      if (!modal) {
        modal = document.createElement('div');
        modal.id = 'poExportModal';
        modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:10000;display:flex;align-items:center;justify-content:center;';
        document.body.appendChild(modal);
      }

      modal.innerHTML = `
        <div style="background:var(--surface);border-radius:16px;box-shadow:0 20px 60px rgba(0,0,0,.25);width:520px;max-width:95vw;overflow:hidden;">
          <div style="background:linear-gradient(135deg,#1e3a5f,#2a5298);padding:1.25rem 1.5rem;display:flex;justify-content:space-between;align-items:center;">
            <div>
              <div style="color:#fff;font-weight:700;font-size:1.1rem;">📥 Export Pearl Data — ${_activePeriod === 'summer2026' ? '☀️ Summer 2026' : 'SY 25-26'}</div>
              <div style="color:rgba(255,255,255,.7);font-size:.8125rem;margin-top:.2rem;">${isFiltered ? 'Filtered export' : 'Full dataset export'}</div>
            </div>
            <button onclick="document.getElementById('poExportModal').style.display='none'" style="background:rgba(255,255,255,.15);border:none;color:#fff;border-radius:8px;width:32px;height:32px;cursor:pointer;font-size:1.1rem;">✕</button>
          </div>

          <div style="padding:1.5rem;">
            <div style="background:rgba(0,80,200,.06);border:1px solid rgba(0,80,200,.15);border-radius:10px;padding:1rem;margin-bottom:1.25rem;">
              <div style="font-weight:600;font-size:.8125rem;color:var(--blue-mid);margin-bottom:.5rem;text-transform:uppercase;letter-spacing:.04em;">Active Filters</div>
              <div style="font-size:.875rem;line-height:1.6;">${filterDesc}</div>
            </div>

            <div style="font-weight:600;font-size:.875rem;margin-bottom:.75rem;">What's included in this export:</div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:.5rem;margin-bottom:1.25rem;">
              <div style="background:var(--bg);border:1px solid var(--border);border-radius:8px;padding:.75rem;">
                <div style="font-size:1.3rem;font-weight:700;color:var(--blue-mid);">${scholarCount.toLocaleString()}</div>
                <div style="font-size:.75rem;color:var(--muted);">Scholars</div>
                <div style="font-size:.7rem;color:var(--muted);margin-top:.2rem;">Att rate · survey scores · tutor links · duration</div>
              </div>
              <div style="background:var(--bg);border:1px solid var(--border);border-radius:8px;padding:.75rem;">
                <div style="font-size:1.3rem;font-weight:700;color:#7c3aed;">${tutorCount.toLocaleString()}</div>
                <div style="font-size:.75rem;color:var(--muted);">Tutors</div>
                <div style="font-size:.7rem;color:var(--muted);margin-top:.2rem;">Sessions led · att rate · survey scores · subjects</div>
              </div>
              <div style="background:var(--bg);border:1px solid var(--border);border-radius:8px;padding:.75rem;">
                <div style="font-size:1.3rem;font-weight:700;color:#0d9488;">${sessCount.toLocaleString()}</div>
                <div style="font-size:.75rem;color:var(--muted);">Sessions</div>
                <div style="font-size:.7rem;color:var(--muted);margin-top:.2rem;">IDs · duration · subject · attendance · ratio</div>
              </div>
              <div style="background:var(--bg);border:1px solid var(--border);border-radius:8px;padding:.75rem;">
                <div style="font-size:1.3rem;font-weight:700;color:#b45309;">${schoolCount.toLocaleString()}</div>
                <div style="font-size:.75rem;color:var(--muted);">Schools</div>
                <div style="font-size:.7rem;color:var(--muted);margin-top:.2rem;">Summary KPIs · flags · survey aggs</div>
              </div>
            </div>

            <div style="font-size:.8125rem;color:var(--muted);margin-bottom:1rem;">
              Excel exports as 5 tabs (About · Scholar · Tutor · Session · School).<br>
              CSV exports all sheets concatenated in one file.
            </div>

            <div style="display:flex;gap:.75rem;">
              <button onclick="po.exportData('xlsx'); document.getElementById('poExportModal').style.display='none';"
                style="flex:1;padding:.75rem;background:linear-gradient(135deg,#1e3a5f,#2a5298);color:#fff;border:none;border-radius:10px;font-weight:600;font-size:.9375rem;cursor:pointer;">
                ⬇ Download Excel (.xlsx)
              </button>
              <button onclick="po.exportData('csv'); document.getElementById('poExportModal').style.display='none';"
                style="flex:1;padding:.75rem;background:var(--bg);color:var(--text);border:1.5px solid var(--border);border-radius:10px;font-weight:600;font-size:.9375rem;cursor:pointer;">
                ⬇ Download CSV
              </button>
            </div>
          </div>
        </div>`;

      modal.style.display = 'flex';
      modal.onclick = (e) => { if (e.target === modal) modal.style.display = 'none'; };
    }

    // ── Per-tutor attendance map for HR profiles overlay ──────────────
    function getTutorAttendanceMap() {
      // Normalize Pearl instructor names the same way _hn() does
      // so that cross-module matching is consistent
      function _normPearlName(name) {
        return (name || '')
          .replace(/\s*-\s*sub\b/gi, '')
          .replace(/\s*-\s*sub$/gi, '')
          .replace(/\([^)]*\)/g, '')
          .replace(/\s*-\s*(sub|pilot only)\b/gi,'')
          .toLowerCase()
          .replace(/-/g, ' ')                // treat hyphens as word separators (mirrors _hn())
          .replace(/[^a-z ]/g, '')
          .split(' ').filter(w=>w.length>1).sort().join(' ');
      }
      const map = {};
      for (const [uid, p] of Object.entries(_personMap)) {
        if (p.role !== 'Instructor') continue;
        const total = p.attended + p.absent;
        if (total === 0) continue;
        const attRate = Math.round(p.attended / total * 100);
        const nameKey = _normPearlName(p.name);
        // Keep record with most sessions (highest confidence)
        if (!map[nameKey] || map[nameKey].total < total) {
          map[nameKey] = {
            name:     p.name,
            attRate:  attRate,
            attended: p.attended,
            absent:   p.absent,
            total:    total,
            school:   p.school || '',
            district: p.district || '',
          };
        }
      }
      return map;
    }

    // ── Ticket System: CSV parser ─────────────────────────────────────────────
    function _splitTicketRow(line) {
      const cols = []; let cur = '', inQ = false;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"' && !inQ)             { inQ = true; continue; }
        if (ch === '"' && inQ)              { if (line[i+1]==='"'){cur+='"';i++;}else inQ=false; continue; }
        if (ch === ',' && !inQ)             { cols.push(cur); cur=''; continue; }
        cur += ch;
      }
      cols.push(cur);
      return cols;
    }

    function _parseTicketCSV(text) {
      const lines = text.split(/\r?\n/).filter(l => l.trim());
      if (lines.length < 2) return [];
      const rows = [];
      for (let i = 1; i < lines.length; i++) {
        const c = _splitTicketRow(lines[i]);
        if (!c || c.length < 4) continue;
        rows.push({
          timestamp: (c[0]||'').trim(),
          submitter: (c[1]||'').trim(),
          date:      (c[2]||'').trim(),
          region:    (c[3]||'').trim(),
          district:  (c[4]||'').trim(),
          school:    (c[5]||'').trim(),
          request:   (c[6]||'').trim(),
          escalate:  (c[7]||'').trim(),
          urgency:   (c[8]||'').trim(),
          type:      (c[9]||'').trim(),
          response:  (c[10]||'').trim(),
        });
      }
      return rows.filter(r => r.submitter || r.request);
    }

    async function _fetchTickets(force) {
      if (!force) {
        try {
          const c = JSON.parse(localStorage.getItem(TICKET_CACHE_KEY)||'null');
          if (c && c.ts && (Date.now()-c.ts) < TICKET_TTL_MS && c.rows) { _ticketRows = c.rows; return c.rows; }
        } catch(e) {}
      }
      const url = `https://docs.google.com/spreadsheets/d/e/${TICKET_2PACX}/pub?output=csv&gid=${TICKET_GID}`;
      try {
        const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
        if (!res.ok) throw new Error('HTTP '+res.status);
        const rows = _parseTicketCSV(await res.text());
        _ticketRows = rows;
        try { localStorage.setItem(TICKET_CACHE_KEY, JSON.stringify({ts:Date.now(),rows})); } catch(e) {}
        return rows;
      } catch(e) {
        console.warn('[Pearl Tickets] Fetch failed:', e.message);
        return _ticketRows || [];
      }
    }

    // ── Ticket System: form builder ───────────────────────────────────────────
    function _buildTicketFormHTML(ctx) {
      ctx = ctx || {};
      const today = new Date();
      const urgencyOpts = ['Low','Moderate','High','Critical'];
      const typeOpts    = ['Data Question','Meeting Request','Clarification','Concern','Other'];
      const sessionName = (window.NJTC_SESSION && window.NJTC_SESSION.name) ? window.NJTC_SESSION.name : '';
      const escV = v => (v||'').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
      return `
        <form id="poTicketForm" style="display:grid;gap:1.125rem">
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem">
            <div>
              <label style="font-size:.75rem;font-weight:700;color:#475569;display:block;margin-bottom:.35rem">Your Name *</label>
              <input id="ptName" type="text" value="${escV(sessionName)}" required placeholder="Full name"
                style="width:100%;padding:.5rem .75rem;border:1.5px solid #e2e8f0;border-radius:8px;font-size:.875rem;box-sizing:border-box">
            </div>
            <div>
              <label style="font-size:.75rem;font-weight:700;color:#475569;display:block;margin-bottom:.35rem">Region *</label>
              <select id="ptRegion" style="width:100%;padding:.5rem .75rem;border:1.5px solid #e2e8f0;border-radius:8px;font-size:.875rem;box-sizing:border-box">
                <option value="">Select region…</option>
                <option value="NE" ${ctx.region==='NE'?'selected':''}>NE — North/East</option>
                <option value="SW" ${ctx.region==='SW'?'selected':''}>SW — South/West</option>
                <option value="Both">Both Regions</option>
              </select>
            </div>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem">
            <div>
              <label style="font-size:.75rem;font-weight:700;color:#475569;display:block;margin-bottom:.35rem">School District</label>
              <input id="ptDistrict" type="text" value="${escV(ctx.district||'')}" placeholder="District name"
                style="width:100%;padding:.5rem .75rem;border:1.5px solid #e2e8f0;border-radius:8px;font-size:.875rem;box-sizing:border-box">
            </div>
            <div>
              <label style="font-size:.75rem;font-weight:700;color:#475569;display:block;margin-bottom:.35rem">School</label>
              <input id="ptSchool" type="text" value="${escV(ctx.school||'')}" placeholder="School name"
                style="width:100%;padding:.5rem .75rem;border:1.5px solid #e2e8f0;border-radius:8px;font-size:.875rem;box-sizing:border-box">
            </div>
          </div>
          <div>
            <label style="font-size:.75rem;font-weight:700;color:#475569;display:block;margin-bottom:.35rem">Describe Your Request / Question *</label>
            <textarea id="ptRequest" rows="4" required
              placeholder="Provide context — what data are you seeing, what's the question, what do you need from Data &amp; Evaluation?"
              style="width:100%;padding:.5rem .75rem;border:1.5px solid #e2e8f0;border-radius:8px;font-size:.875rem;resize:vertical;box-sizing:border-box"></textarea>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:1rem">
            <div>
              <label style="font-size:.75rem;font-weight:700;color:#475569;display:block;margin-bottom:.35rem">Type</label>
              <select id="ptType" style="width:100%;padding:.5rem .75rem;border:1.5px solid #e2e8f0;border-radius:8px;font-size:.875rem;box-sizing:border-box">
                ${typeOpts.map(o=>`<option value="${o}" ${o===(ctx.type||'Data Question')?'selected':''}>${o}</option>`).join('')}
              </select>
            </div>
            <div>
              <label style="font-size:.75rem;font-weight:700;color:#475569;display:block;margin-bottom:.35rem">Urgency</label>
              <select id="ptUrgency" style="width:100%;padding:.5rem .75rem;border:1.5px solid #e2e8f0;border-radius:8px;font-size:.875rem;box-sizing:border-box">
                ${urgencyOpts.map(o=>`<option value="${o}" ${o===(ctx.urgency||'Moderate')?'selected':''}>${o}</option>`).join('')}
              </select>
            </div>
            <div>
              <label style="font-size:.75rem;font-weight:700;color:#475569;display:block;margin-bottom:.35rem">Needs Escalation?</label>
              <select id="ptEscalate" style="width:100%;padding:.5rem .75rem;border:1.5px solid #e2e8f0;border-radius:8px;font-size:.875rem;box-sizing:border-box">
                <option value="No">No — standard queue</option>
                <option value="Yes">Yes — needs attention</option>
              </select>
            </div>
          </div>
          <div style="display:flex;gap:.75rem;align-items:center;padding-top:.25rem">
            <button type="button" onclick="po.submitTicket()"
              style="padding:.6rem 1.5rem;background:linear-gradient(135deg,#1e3a5f,#2a5298);color:#fff;border:none;border-radius:8px;font-size:.875rem;font-weight:700;cursor:pointer">
              📬 Submit Ticket
            </button>
            <span id="ptStatus" style="font-size:.8rem;color:var(--muted)"></span>
          </div>
        </form>`;
    }

    // ── Ticket System: list builder ───────────────────────────────────────────
    function _buildTicketsListHTML(rows) {
      if (!rows || !rows.length) return `
        <div style="padding:2.5rem;text-align:center;color:var(--muted)">
          <div style="font-size:2rem;margin-bottom:.5rem">📭</div>
          <div style="font-weight:600">No tickets yet</div>
          <div style="font-size:.8rem;margin-top:.25rem">Use "Submit New Request" to send your first data question or escalation.</div>
        </div>`;
      const urgColor = u => u==='Critical'?'#dc2626':u==='High'?'#d97706':u==='Moderate'?'#2563eb':'#059669';
      const urgBg    = u => u==='Critical'?'#fef2f2':u==='High'?'#fffbeb':u==='Moderate'?'#eff6ff':'#f0fdf4';
      const esc      = v => (v||'').replace(/</g,'&lt;').replace(/>/g,'&gt;');
      const rowsHTML = rows.slice().reverse().map(r => {
        const hasResp   = !!r.response;
        const statusClr = hasResp ? '#059669' : '#d97706';
        const statusBg  = hasResp ? '#f0fdf4'  : '#fffbeb';
        const statusLbl = hasResp ? '✓ Responded' : '⏳ Pending';
        const dateStr   = r.timestamp ? r.timestamp.substring(0,10) : r.date || '—';
        const reqShort  = esc(r.request||'—').substring(0,90) + ((r.request||'').length>90?'…':'');
        return `<tr style="border-bottom:1px solid #f1f5f9">
          <td style="padding:.6rem .75rem;font-size:.72rem;color:#64748b;white-space:nowrap">${dateStr}</td>
          <td style="padding:.6rem .75rem;font-weight:600;color:#1e293b;font-size:.8rem;white-space:nowrap">${esc(r.submitter||'—')}</td>
          <td style="padding:.6rem .75rem;font-size:.72rem;color:#64748b">${esc(r.region||'—')}</td>
          <td style="padding:.6rem .75rem;font-size:.72rem;color:#64748b;max-width:110px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${esc(r.district)}">${esc(r.district||'—')}</td>
          <td style="padding:.6rem .75rem;font-size:.72rem;color:#64748b;max-width:110px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${esc(r.school)}">${esc(r.school||'—')}</td>
          <td style="padding:.6rem .5rem;text-align:center">
            <span style="font-size:.6rem;font-weight:700;padding:.15rem .45rem;border-radius:999px;color:${urgColor(r.urgency)};background:${urgBg(r.urgency)};white-space:nowrap">${esc(r.urgency||'—')}</span>
          </td>
          <td style="padding:.6rem .75rem;font-size:.75rem;color:#334155;min-width:160px">
            <div style="max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${esc(r.request)}">${reqShort}</div>
            ${r.type?`<div style="font-size:.65rem;color:#94a3b8;margin-top:.1rem">${esc(r.type)}</div>`:''}
          </td>
          <td style="padding:.6rem .5rem;text-align:center">
            <span style="font-size:.6rem;font-weight:700;padding:.15rem .45rem;border-radius:999px;color:${statusClr};background:${statusBg};white-space:nowrap">${statusLbl}</span>
          </td>
          <td style="padding:.6rem .75rem;font-size:.75rem;color:#1e293b;min-width:180px">
            ${hasResp
              ? `<div style="background:#f8fafc;border-left:3px solid #059669;padding:.4rem .6rem;border-radius:0 4px 4px 0;font-style:italic;max-width:240px;overflow:hidden;text-overflow:ellipsis;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical" title="${esc(r.response)}">${esc(r.response)}</div>`
              : '<span style="color:#94a3b8;font-style:italic">Awaiting response…</span>'}
          </td>
        </tr>`;
      }).join('');
      return `<div style="overflow-x:auto">
        <table style="width:100%;border-collapse:collapse;font-size:.8rem">
          <thead>
            <tr style="background:#f8fafc;border-bottom:2px solid #e2e8f0">
              <th style="padding:.5rem .75rem;text-align:left;font-size:.63rem;font-weight:700;color:#64748b;text-transform:uppercase;white-space:nowrap">Date</th>
              <th style="padding:.5rem .75rem;text-align:left;font-size:.63rem;font-weight:700;color:#64748b;text-transform:uppercase">Submitter</th>
              <th style="padding:.5rem .75rem;text-align:left;font-size:.63rem;font-weight:700;color:#64748b;text-transform:uppercase">Region</th>
              <th style="padding:.5rem .75rem;text-align:left;font-size:.63rem;font-weight:700;color:#64748b;text-transform:uppercase">District</th>
              <th style="padding:.5rem .75rem;text-align:left;font-size:.63rem;font-weight:700;color:#64748b;text-transform:uppercase">School</th>
              <th style="padding:.5rem .5rem;text-align:center;font-size:.63rem;font-weight:700;color:#64748b;text-transform:uppercase">Urgency</th>
              <th style="padding:.5rem .75rem;text-align:left;font-size:.63rem;font-weight:700;color:#64748b;text-transform:uppercase">Request</th>
              <th style="padding:.5rem .5rem;text-align:center;font-size:.63rem;font-weight:700;color:#64748b;text-transform:uppercase">Status</th>
              <th style="padding:.5rem .75rem;text-align:left;font-size:.63rem;font-weight:700;color:#64748b;text-transform:uppercase">Response</th>
            </tr>
          </thead>
          <tbody>${rowsHTML}</tbody>
        </table>
      </div>`;
    }

    // ── Ticket System: open form modal ────────────────────────────────────────
    function openTicketModal(ctx) {
      let ov = document.getElementById('poTicketOverlay');
      if (!ov) {
        ov = document.createElement('div');
        ov.id = 'poTicketOverlay';
        ov.style.cssText = 'display:none;position:fixed;inset:0;z-index:9000;background:rgba(10,22,40,.85);overflow-y:auto;padding:2rem;backdrop-filter:blur(4px)';
        document.body.appendChild(ov);
      }
      ov.innerHTML = `
        <div style="max-width:680px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,.4)">
          <div style="background:linear-gradient(135deg,#1e3a5f,#2a5298);color:#fff;padding:1.25rem 1.5rem;display:flex;justify-content:space-between;align-items:flex-start">
            <div>
              <div style="font-size:1.0625rem;font-weight:800;letter-spacing:-.01em">📬 Submit a Data Request</div>
              <div style="font-size:.75rem;opacity:.8;margin-top:.15rem">Pearl Operations · Data &amp; Evaluation Team</div>
            </div>
            <button onclick="document.getElementById('poTicketOverlay').style.display='none'"
              style="background:rgba(255,255,255,.15);border:none;color:#fff;width:2rem;height:2rem;border-radius:50%;cursor:pointer;font-size:1.125rem;line-height:1;flex-shrink:0">×</button>
          </div>
          <div style="padding:1.5rem">${_buildTicketFormHTML(ctx)}</div>
        </div>`;
      ov.style.display = 'block';
      ov.onclick = e => { if (e.target === ov) ov.style.display = 'none'; };
    }

    // ── Ticket System: view all tickets overlay ───────────────────────────────
    function openTicketsView() {
      let ov = document.getElementById('poTicketsViewOverlay');
      if (!ov) {
        ov = document.createElement('div');
        ov.id = 'poTicketsViewOverlay';
        ov.style.cssText = 'display:none;position:fixed;inset:0;z-index:9000;background:rgba(10,22,40,.85);overflow-y:auto;padding:2rem;backdrop-filter:blur(4px)';
        document.body.appendChild(ov);
      }
      const headerHTML = `
        <div style="background:linear-gradient(135deg,#1e3a5f,#2a5298);color:#fff;padding:1.25rem 1.5rem;display:flex;justify-content:space-between;align-items:center">
          <div>
            <div style="font-size:1.0625rem;font-weight:800;letter-spacing:-.01em">📬 Pearl Operations Tickets</div>
            <div style="font-size:.75rem;opacity:.8;margin-top:.15rem">Data requests, escalations &amp; context meetings · Responses from Data &amp; Evaluation</div>
          </div>
          <div style="display:flex;gap:.5rem;align-items:center;flex-shrink:0">
            <button onclick="po.openTicketModal()" style="padding:.4rem 1rem;background:rgba(255,255,255,.2);color:#fff;border:1px solid rgba(255,255,255,.4);border-radius:8px;cursor:pointer;font-size:.8rem;font-weight:600">+ New Request</button>
            <button onclick="document.getElementById('poTicketsViewOverlay').style.display='none'"
              style="background:rgba(255,255,255,.15);border:none;color:#fff;width:2rem;height:2rem;border-radius:50%;cursor:pointer;font-size:1.125rem;line-height:1">×</button>
          </div>
        </div>`;
      ov.innerHTML = `<div style="max-width:1100px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,.4)">${headerHTML}<div id="poTicketsBody" style="padding:1.5rem"><div style="text-align:center;padding:2rem;color:var(--muted)">⏳ Loading tickets…</div></div></div>`;
      ov.style.display = 'block';
      ov.onclick = e => { if (e.target === ov) ov.style.display = 'none'; };
      _fetchTickets(false).then(rows => {
        const body = document.getElementById('poTicketsBody');
        if (!body) return;
        const responded = rows.filter(r=>r.response).length;
        const pending   = rows.length - responded;
        body.innerHTML = `
          <div style="display:flex;gap:.75rem;align-items:center;margin-bottom:1.25rem;flex-wrap:wrap">
            <div style="display:flex;gap:.6rem">
              <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:.5rem 1rem;text-align:center;min-width:56px">
                <div style="font-size:1.375rem;font-weight:800;color:#1e293b">${rows.length}</div>
                <div style="font-size:.63rem;color:#64748b;font-weight:700;text-transform:uppercase">Total</div>
              </div>
              <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:.5rem 1rem;text-align:center;min-width:56px">
                <div style="font-size:1.375rem;font-weight:800;color:#059669">${responded}</div>
                <div style="font-size:.63rem;color:#059669;font-weight:700;text-transform:uppercase">Responded</div>
              </div>
              <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:.5rem 1rem;text-align:center;min-width:56px">
                <div style="font-size:1.375rem;font-weight:800;color:#d97706">${pending}</div>
                <div style="font-size:.63rem;color:#d97706;font-weight:700;text-transform:uppercase">Pending</div>
              </div>
            </div>
            <div style="display:flex;gap:.5rem;margin-left:auto">
              <button onclick="po.openTicketModal()" style="padding:.45rem 1.1rem;background:linear-gradient(135deg,#1e3a5f,#2a5298);color:#fff;border:none;border-radius:8px;cursor:pointer;font-size:.8125rem;font-weight:700">📬 New Request</button>
              <button onclick="po.refreshTickets()" style="padding:.45rem .9rem;background:#f8fafc;border:1.5px solid #e2e8f0;color:#475569;border-radius:8px;cursor:pointer;font-size:.8125rem;font-weight:600">↺ Refresh</button>
            </div>
          </div>
          ${_buildTicketsListHTML(rows)}`;
      });
    }

    // ── Ticket System: submit form ────────────────────────────────────────────
    async function submitTicket() {
      const g  = id => (document.getElementById(id)||{}).value || '';
      const name     = g('ptName').trim();
      const region   = g('ptRegion');
      const district = g('ptDistrict').trim();
      const school   = g('ptSchool').trim();
      const request  = g('ptRequest').trim();
      const type     = g('ptType');
      const urgency  = g('ptUrgency');
      const escalate = g('ptEscalate');
      const st = document.getElementById('ptStatus');
      if (!name || !request) {
        if (st) st.innerHTML = '<span style="color:#dc2626">⚠ Name and request description are required.</span>';
        return;
      }
      const today = new Date();
      const params = new URLSearchParams({
        'entry.491781665': name,
        'entry.939632120_year':  today.getFullYear(),
        'entry.939632120_month': today.getMonth() + 1,
        'entry.939632120_day':   today.getDate(),
        'entry.2143428895': region,
        'entry.1942615159': district,
        'entry.269372707':  school,
        'entry.2017090049': request,
        'entry.1978739295': escalate,
        'entry.778195494':  urgency,
        'entry.834835718':  type,
      });
      if (st) st.innerHTML = '<span style="color:#2563eb">Submitting…</span>';
      try {
        await fetch(TICKET_FORM_URL, { method:'POST', mode:'no-cors', body: params });
        try { localStorage.removeItem(TICKET_CACHE_KEY); } catch(e) {}
        _ticketRows = null;
        if (st) st.innerHTML = '<span style="color:#059669">✓ Submitted! Check Tickets view for a response from the Data &amp; Evaluation team.</span>';
        setTimeout(() => {
          const ov = document.getElementById('poTicketOverlay');
          if (ov) ov.style.display = 'none';
        }, 2800);
      } catch(e) {
        if (st) st.innerHTML = '<span style="color:#dc2626">⚠ Submission failed. Please try again.</span>';
      }
    }

    // ── Ticket System: refresh tickets list in-place ──────────────────────────
    async function refreshTickets() {
      const rows = await _fetchTickets(true);
      const body = document.getElementById('poTicketsBody');
      if (!body) return;
      const tableDiv = body.querySelector('[style*="overflow-x:auto"]');
      if (tableDiv) tableDiv.outerHTML = _buildTicketsListHTML(rows);
      else body.insertAdjacentHTML('beforeend', _buildTicketsListHTML(rows));
    }

    return {
      init, refresh, setPeriod, applyFilters, clearFilters, _globalSearch,
      drillSchool, drillPerson, goBack,
      switchTab, switchPersonTab,
      openFlagsModal, onPanelOpen,
      getLeadershipData,
      getTutorAttendanceMap,
      toggleSection,
      showFieldReportModal,
      _frSetRegion, _generateFieldReport,
      getCommentsByCategory,
      exportData, showExportModal,
      openTicketModal, openTicketsView, submitTicket, refreshTickets,

      // ── PDF export data accessor ─────────────────────────────────────────
      // regionFilter: 'NE' | 'SW' | 'ALL'
      // Returns a live-data snapshot scoped to the requested region.
      getExportData: function(regionFilter) {
        regionFilter = (regionFilter || 'ALL').toUpperCase();

        // ── Region helpers ─────────────────────────────────────────────────
        const NE_DISTRICTS = [
          'ilearn', 'i-learn', 'paterson', 'pcsst', 'paterson charter',
          'hoboken', 'middlesex', 'central jersey',
        ];
        const SW_DISTRICTS = [
          'american paradigm', 'first philadelphia', 'first philly',
          'philadelphia charter', 'string theory',
          'global leadership academy', 'global leadership',
          'penns grove', 'carneys point',
          'haddon township', 'haddon',
          'hamilton township', 'gloucester township',
        ];
        const SW_SCHOOLS = [
          'erial', 'loring flemming', 'field street', 'penns grove middle',
          'van sciver', 'strawbridge',
          'first philadelphia prep', 'first philly prep',
          'the philadelphia charter', 'philadelphia charter school',
          'global leadership academy',
        ];

        function isExcluded(school) {
          return !!school && school.toLowerCase().startsWith('zzz');
        }
        function schoolRegion(school, district) {
          const s = (school  || '').toLowerCase().trim();
          const d = (district|| '').toLowerCase().trim();
          if (isExcluded(s)) return null;
          for (const kw of NE_DISTRICTS) { if (d.includes(kw)) return 'NE'; }
          for (const kw of SW_DISTRICTS) { if (d.includes(kw)) return 'SW'; }
          for (const kw of SW_SCHOOLS)   { if (s.includes(kw)) return 'SW'; }
          if (s.includes('ilearn') || s.includes('i-learn')) return 'NE';
          if (s.includes('hoboken'))   return 'NE';
          if (s.includes('middlesex')) return 'NE';
          return null;
        }
        function inRegion(school, district) {
          if (regionFilter === 'ALL') return !isExcluded(school);
          return schoolRegion(school, district) === regionFilter;
        }

        // ── Debug checkpoint ───────────────────────────────────────────────
        console.log('[NJTC PDF] getExportData', {
          region: regionFilter,
          attRows: (_attRows||[]).length, sessMapKeys: Object.keys(_sessMap||{}).length,
          schoolMapKeys: Object.keys(_schoolMap||{}).length,
          stuRows: (_stuRows||[]).length, instRows: (_instRows||[]).length,
          personMapKeys: Object.keys(_personMap||{}).length,
        });

        // ── Tutor hours from _sessMap (subjectMinutes = students only) ─────
        // Use isFullAtt||isPartial to match dashboard "Sessions Delivered" calculation
        const tutorMinsByUid = {};
        Object.values(_sessMap || {}).forEach(sess => {
          if (!sess.instId || !(sess.isFullAtt || sess.isPartial) || !sess.durMins) return;
          if (!inRegion(sess.school, sess.district)) return;
          tutorMinsByUid[sess.instId] = (tutorMinsByUid[sess.instId] || 0) + sess.durMins;
        });

        // ── Delivered sessions in region ───────────────────────────────────
        // Dashboard: delivered = isFullAtt + isPartial (line 2667-2669 in programming.js)
        // Must use same logic here to match dashboard "Sessions Delivered" display
        const sessions = Object.values(_sessMap || {}).filter(s =>
          (s.isFullAtt || s.isPartial) && inRegion(s.school, s.district)
        );
        const totalSessions   = sessions.length;
        const hitSessions     = sessions.filter(s => !s.ratioFlag).length;
        const hitRate         = totalSessions > 0 ? Math.round(hitSessions / totalSessions * 100) : 0;
        const ratioViolations = totalSessions - hitSessions;
        let maxRatio = 0;
        sessions.forEach(s => { if (s.ratio > maxRatio) maxRatio = s.ratio; });

        // ── Attendance rows ────────────────────────────────────────────────
        const attRows = (_attRows || []).filter(r => inRegion(r[ATT.SCHOOL], r[ATT.DISTRICT]));
        const stuRows  = attRows.filter(r => r[ATT.ROLE] === 'Student');
        const instRows = attRows.filter(r => r[ATT.ROLE] === 'Instructor');

        const stuAtt   = stuRows.filter(r => classifyRecord(r) === 'attended').length;
        const stuAbs   = stuRows.filter(r => classifyRecord(r) === 'absent').length;
        const stuSI    = stuRows.filter(r => classifyRecord(r) === 'service_interruption').length;
        const stuTotal = stuAtt + stuAbs;
        const scholarAttRate = stuTotal > 0 ? parseFloat((stuAtt / stuTotal * 100).toFixed(1)) : 0;

        const instAtt   = instRows.filter(r => classifyRecord(r) === 'attended').length;
        const instAbs   = instRows.filter(r => classifyRecord(r) === 'absent').length;
        const instTotal = instAtt + instAbs;
        const tutorAttRate = instTotal > 0 ? parseFloat((instAtt / instTotal * 100).toFixed(1)) : 0;

        // ── Missed reasons (pre-scoped to region via stuRows) ──────────────
        const missedReasonCounts = {};
        stuRows
          .filter(r => classifyRecord(r) === 'absent' || classifyRecord(r) === 'service_interruption')
          .forEach(r => {
            const reason = r[ATT.MISS_REASON] || 'Unknown';
            missedReasonCounts[reason] = (missedReasonCounts[reason] || 0) + 1;
          });

        // ── Survey capture rate — Session-ID validated ─────────────────────
        // Primary key: SESS_ID from survey row matched to sess.id from session details.
        // Scholar eligible: 1 survey per (studentId, sessId) across delivered sessions.
        // Scholar submitted: survey where FILLED_BY_ID + SESS_ID match a delivered session.
        // Tutor eligible: 1 survey per delivered session where attendance ∈ TUTR_ELIG.
        // Tutor submitted: survey where FILLED_BY_ID + SESS_ID match a delivered session.
        // Late (tutor): submitted survey whose DATE is strictly after the session date.
        //   A tutor is flagged if ≥50% of their submitted surveys are late.
        // Mismatch: survey SESS_ID has no matching delivered session for that user.
        const TUTR_ELIG = new Set(['Attended', 'Partially Attended']);

        // Normalize any date to 'YYYY-MM-DD' string (handles MM/DD/YYYY, ISO, YYYY-MM-DD)
        function toYMD(val) {
          if (!val) return '';
          const s = String(val).trim();
          const mdy = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
          if (mdy) return mdy[3] + '-' + mdy[1].padStart(2, '0') + '-' + mdy[2].padStart(2, '0');
          const iso = s.match(/^(\d{4}-\d{2}-\d{2})/);
          return iso ? iso[1] : '';
        }

        // ── Scholar capture ────────────────────────────────────────────────
        // Primary key: studentId|sessId — Session ID is the authoritative link.
        // Count: 1 eligible per (student, session) pair.
        const scholEligBySchool = {};
        const scholEligMap      = {};   // key: stuId|sessId → { school, sessYMD }
        sessions.forEach(sess => {
          if (!sess.id) return;
          const sessYMD = toYMD(sess.start);
          const sch = sess.school || '__unknown__';
          (sess.studentIds || []).forEach(stuId => {
            if (!stuId) return;
            scholEligBySchool[sch] = (scholEligBySchool[sch] || 0) + 1;
            const k = stuId + '|' + sess.id;
            if (!scholEligMap[k]) scholEligMap[k] = { school: sch, sessYMD: sessYMD || '' };
          });
        });

        // Match student surveys: FILLED_BY_ID + SESS_ID must match a delivered session.
        // Session ID is the primary validation key (date no longer gates the count).
        const scholMatchedBySchool  = {};   // session-ID-matched surveys per school
        const scholMismatchBySchool = {};   // surveys with no matching session ID
        (_stuRows || [])
          .filter(r => inRegion(r[STU_S.SCHOOL], r[STU_S.DISTRICT]))
          .forEach(r => {
            const stuId  = r[STU_S.FILLED_BY_ID];
            const sessId = r[STU_S.SESS_ID];
            if (!stuId || !sessId) return;
            const k    = stuId + '|' + sessId;
            const slot = scholEligMap[k];
            if (slot) {
              scholMatchedBySchool[slot.school] = (scholMatchedBySchool[slot.school] || 0) + 1;
            } else {
              const sch = r[STU_S.SCHOOL] || '__unknown__';
              scholMismatchBySchool[sch] = (scholMismatchBySchool[sch] || 0) + 1;
            }
          });
        const scholSubmBySchool = scholMatchedBySchool;

        // ── Tutor capture ──────────────────────────────────────────────────
        // Primary key: instId|sessId — Session ID is the authoritative link.
        // A survey counts as submitted if session ID + instructor ID match a delivered session.
        // Late flag: survey DATE is strictly after the session date (date-only comparison).
        // school/district stored in eligMap from session so display always reflects the
        // location the session was assigned to, not where the person appeared in attendance.
        const tutorEligByUid    = {};
        const tutorEligMap      = {};   // key: instId|sessId → { sessYMD, school, district }
        const tutorSchoolByUid  = {};  // uid → { 'school|district' → { school, district, count } }
        sessions.filter(s => TUTR_ELIG.has(s.attendance)).forEach(sess => {
          if (!sess.instId || !sess.id) return;
          const sessYMD = toYMD(sess.start);
          tutorEligByUid[sess.instId] = (tutorEligByUid[sess.instId] || 0) + 1;
          const k = sess.instId + '|' + sess.id;
          tutorEligMap[k] = { sessYMD: sessYMD || '', school: sess.school || '', district: sess.district || '' };
        });

        const tutorMatchedByUid  = {};
        const tutorMismatchByUid = {};
        const tutorLateByUid     = {};  // surveys submitted after the session date
        (_instRows || [])
          .forEach(r => {
            const uid    = r[INST_S.FILLED_BY_ID];
            const sessId = r[INST_S.SESS_ID];
            if (!uid || !sessId) return;
            const k    = uid + '|' + sessId;
            const slot = tutorEligMap[k];
            if (slot) {
              tutorMatchedByUid[uid] = (tutorMatchedByUid[uid] || 0) + 1;
              // Vote for session school so tutorCaptureList uses the correct location
              if (!tutorSchoolByUid[uid]) tutorSchoolByUid[uid] = {};
              const vk = slot.school + '|' + slot.district;
              if (!tutorSchoolByUid[uid][vk]) tutorSchoolByUid[uid][vk] = { school: slot.school, district: slot.district, count: 0 };
              tutorSchoolByUid[uid][vk].count++;
              // Late: survey date is strictly after the session date (discard time)
              const survYMD = toYMD(r[INST_S.DATE]);
              if (survYMD && slot.sessYMD && survYMD > slot.sessYMD) {
                tutorLateByUid[uid] = (tutorLateByUid[uid] || 0) + 1;
              }
            } else {
              tutorMismatchByUid[uid] = (tutorMismatchByUid[uid] || 0) + 1;
            }
          });
        const tutorSubmByUid = tutorMatchedByUid;

        const totalScholElig     = Object.values(scholEligBySchool).reduce((a,b)=>a+b, 0);
        const totalScholSubm     = Object.values(scholMatchedBySchool).reduce((a,b)=>a+b, 0);
        const totalScholMismatch = Object.values(scholMismatchBySchool).reduce((a,b)=>a+b, 0);
        const scholCaptureRate   = totalScholElig > 0 ? Math.min(100, Math.round(totalScholSubm / totalScholElig * 100)) : 0;
        const scholMismatchRate  = (totalScholSubm + totalScholMismatch) > 0
          ? Math.round(totalScholMismatch / (totalScholSubm + totalScholMismatch) * 100) : 0;

        const totalTutorElig  = Object.values(tutorEligByUid).reduce((a,b)=>a+b, 0);
        const totalTutorSubm  = Object.values(tutorMatchedByUid).reduce((a,b)=>a+b, 0);
        const tutorCaptureRate = totalTutorElig > 0 ? Math.round(totalTutorSubm / totalTutorElig * 100) : 0;

        // ── Per-school stats ───────────────────────────────────────────────
        // ratioViolations computed from delivered sessions only (consistent with hitRate).
        const schools = [];
        for (const [name, sc] of Object.entries(_schoolMap || {})) {
          if (!name || !name.trim()) continue;
          if (!inRegion(name, sc.district)) continue;
          const scSess       = (sc.sessions || []).filter(s => s.isFullAtt || s.isPartial);
          const scTotal      = scSess.length;
          const scViolations = scSess.filter(s => s.ratioFlag).length;
          const scHit        = scTotal - scViolations;
          const scElig       = scholEligBySchool[name] || 0;
          const scSubm       = Math.min(scholMatchedBySchool[name] || 0, scElig);
          const scMismatch   = scholMismatchBySchool[name] || 0;
          const scTotalSurv  = scSubm + scMismatch;
          schools.push({
            name:             sc.school || name,
            district:         sc.district || '',
            region:           schoolRegion(name, sc.district) || regionFilter,
            attRate:          sc.attRate || 0,
            sessions:         scTotal,
            hitRate:          scTotal > 0 ? Math.round(scHit / scTotal * 100) : 0,
            ratioViolations:  scViolations,
            stuSurveyAvg:     parseFloat((sc.stuSurveyAvg  || 0).toFixed(2)),
            instSurveyAvg:    parseFloat((sc.instSurveyAvg || 0).toFixed(2)),
            stuAttended:      sc.stuAttended      || 0,
            stuAbsent:        sc.stuAbsent        || 0,
            siCount:          sc.stuInterruptions || 0,
            scholCaptureElig: scElig,
            scholCaptureSubm: scSubm,
            scholCaptureRate: scElig >= 5 ? Math.min(100, Math.round(scSubm / scElig * 100)) : null,
            scholMismatchCnt: scMismatch,
            // % of submitted surveys that had a mismatched date (only shown when meaningful)
            scholMismatchRate: scTotalSurv >= 5 ? Math.round(scMismatch / scTotalSurv * 100) : 0,
          });
        }
        schools.sort((a, b) => b.sessions - a.sessions);

        // Scholar capture top/bottom (min 5 eligible events)
        const scholWithCap = schools.filter(s => s.scholCaptureRate !== null);
        const scholCaptureTopN    = [...scholWithCap].sort((a,b) => b.scholCaptureRate - a.scholCaptureRate).slice(0, 3);
        const scholCaptureBottomN = [...scholWithCap].sort((a,b) => a.scholCaptureRate - b.scholCaptureRate).slice(0, 5);

        // ── Terminated staff lookup — SY 2025-2026 from HR Master List ────────
        // Normalise: lowercase, strip non-alpha, sort tokens (same algo as _hrOverlayPearl).
        // Snapshot-safe: works identically against live HR_EMPS or a future frozen snapshot.
        const _normTN = s => (s||'').toLowerCase().replace(/[^a-z ]/g,'').replace(/\s+/g,' ').trim().split(' ').filter(Boolean).sort().join(' ');
        const _termNameMap = {};
        try {
          (window.HR_EMPS||[]).forEach(e => {
            if (e.s === 'Active') return;
            if (!(e.y||[]).includes('2025-2026') && !(e._liveYears||[]).includes('2025-2026')) return;
            const nk = _normTN(e.n||'');
            if (nk) _termNameMap[nk] = { date: e._termDate||'', reason: e._termReason||'' };
          });
        } catch(ignore) {}
        const _termKeys = Object.keys(_termNameMap);
        // Returns the termination record for a tutor name, or null if not terminated
        const _termEntry = name => {
          const tk = _normTN(name);
          if (_termNameMap[tk]) return _termNameMap[tk];
          const tp = tk.split(' ');
          const dk = _termKeys.find(k => {
            const dp = k.split(' ');
            return (tp.length >= 2 && tp.every(p => dp.includes(p))) ||
                   (dp.length >= 2 && dp.every(p => tp.includes(p)));
          });
          return dk ? _termNameMap[dk] : null;
        };

        // Tutor capture per instructor.
        // School/district resolved from session-school vote majority so the entry
        // reflects the location the sessions are assigned to, not where the tutor
        // appeared in attendance rows (a tutor can appear in multiple schools there).
        // Guard: elig > 0 already implies at least one in-region session exists — we
        // do NOT re-check inRegion(p.school) which would drop tutors whose attendance
        // row school differs from their session school (e.g. Global Leadership vs String Theory).
        const tutorCaptureList = [];
        for (const [uid, p] of Object.entries(_personMap || {})) {
          if (p.role !== 'Instructor') continue;
          const elig = tutorEligByUid[uid] || 0;
          if (elig === 0) continue;  // no in-region eligible sessions → skip
          const subm     = tutorMatchedByUid[uid] || 0;
          const late     = tutorLateByUid[uid]    || 0;
          const mismatch = tutorMismatchByUid[uid] || 0;
          const lateRate = subm > 0 ? Math.round(late / subm * 100) : 0;
          // Resolve display school from the sessions (majority vote across matched surveys)
          const votes    = Object.values(tutorSchoolByUid[uid] || {}).sort((a, b) => b.count - a.count);
          const school   = votes.length ? votes[0].school   : (p.school   || '');
          const district = votes.length ? votes[0].district : (p.district || '');
          const _tcEntry = _termEntry(p.name || uid);
          tutorCaptureList.push({
            name: p.name || uid, school, district,
            eligible: elig, submitted: subm, late, lateRate, mismatch,
            captureRate:   Math.round(subm / elig * 100),
            mismatchRate:  (subm + mismatch) > 0 ? Math.round(mismatch / (subm + mismatch) * 100) : 0,
            lateFlagged:   lateRate >= 50,
            terminated: !!_tcEntry, _termDate: _tcEntry ? _tcEntry.date : '',
          });
        }
        const tutorCaptureTop      = [...tutorCaptureList].sort((a,b) => b.captureRate - a.captureRate).slice(0, 3);
        const tutorCaptureBottom   = [...tutorCaptureList].sort((a,b) => a.captureRate - b.captureRate).slice(0, 5);
        const tutorLateSurveyList  = [...tutorCaptureList].filter(t => t.lateFlagged).sort((a,b) => b.lateRate - a.lateRate);
        const totalTutorLate       = Object.values(tutorLateByUid).reduce((a,b) => a + b, 0);

        // ── Per-district rollup ────────────────────────────────────────────
        // Weighted by actual scholar attendance/absence counts, not a plain
        // mean of each school's rate — an unweighted mean gives a 10-scholar
        // school the same pull on the district number as a 400-scholar one.
        // Also no longer silently drops a genuine 0% school from the average
        // (that used to look identical to "no data"; it isn't).
        const districtMap = {};
        schools.forEach(sc => {
          const d = sc.district || 'Unknown';
          if (!districtMap[d]) districtMap[d] = { name: d, schools: [], sessions: 0, stuAttSum: 0, stuAbsSum: 0, siCount: 0 };
          districtMap[d].schools.push(sc.name);
          districtMap[d].sessions += sc.sessions;
          districtMap[d].siCount  += sc.siCount;
          districtMap[d].stuAttSum += sc.stuAttended || 0;
          districtMap[d].stuAbsSum += sc.stuAbsent || 0;
        });
        const districts = Object.values(districtMap).map(d => {
          const denom = d.stuAttSum + d.stuAbsSum;
          return { ...d, attRate: denom > 0 ? parseFloat((d.stuAttSum / denom * 100).toFixed(1)) : 0 };
        }).sort((a, b) => b.sessions - a.sessions);

        // ── Survey scores ──────────────────────────────────────────────────
        function avgArr(arr) { return arr.length ? parseFloat((arr.reduce((a,b)=>a+b,0)/arr.length).toFixed(2)) : 0; }

        const stuSurveyRows = (_stuRows || []).filter(r => inRegion(r[STU_S.SCHOOL], r[STU_S.DISTRICT]));
        const ssc = { confidence: [], enjoyment: [], learning: [], overall: [] };
        stuSurveyRows.forEach(r => {
          const c = parseFloat(r[STU_S.CONFIDENCE]); if (!isNaN(c) && c > 0) ssc.confidence.push(c);
          const e = parseFloat(r[STU_S.ENJOYMENT]);  if (!isNaN(e) && e > 0) ssc.enjoyment.push(e);
          const l = parseFloat(r[STU_S.LEARNING]);   if (!isNaN(l) && l > 0) ssc.learning.push(l);
          const o = parseFloat(r[STU_S.OVERALL]);    if (!isNaN(o) && o > 0) ssc.overall.push(o);
        });
        const stuSurveyAvg = {
          confidence: avgArr(ssc.confidence), enjoyment: avgArr(ssc.enjoyment),
          learning:   avgArr(ssc.learning),   overall:   avgArr(ssc.overall),
          count: stuSurveyRows.length, eligible: totalScholElig, captureRate: scholCaptureRate,
        };

        const instSurveyRows = (_instRows || []).filter(r => inRegion(r[INST_S.SCHOOL], r[INST_S.DISTRICT]));
        const isc = { engagement: [], enjoyment: [], learning: [], overall: [] };
        instSurveyRows.forEach(r => {
          const eg = parseFloat(r[INST_S.ENGAGEMENT]); if (!isNaN(eg) && eg > 0) isc.engagement.push(eg);
          const ej = parseFloat(r[INST_S.ENJOYMENT]);  if (!isNaN(ej) && ej > 0) isc.enjoyment.push(ej);
          const l  = parseFloat(r[INST_S.LEARNING]);   if (!isNaN(l)  && l  > 0) isc.learning.push(l);
          const o  = parseFloat(r[INST_S.OVERALL]);    if (!isNaN(o)  && o  > 0) isc.overall.push(o);
        });
        const instSurveyAvg = {
          engagement: avgArr(isc.engagement), enjoyment: avgArr(isc.enjoyment),
          learning:   avgArr(isc.learning),   overall:   avgArr(isc.overall),
          count: instSurveyRows.length, eligible: totalTutorElig, captureRate: tutorCaptureRate,
        };

        const commentCounts = {};
        instSurveyRows.forEach(r => {
          [r[INST_S.COMMENT_ADMIN], r[INST_S.COMMENT_SELF]].forEach(text => {
            if (!text || !text.trim()) return;
            const bucket = categorizeComment(text) || 'other';
            commentCounts[bucket] = (commentCounts[bucket] || 0) + 1;
          });
        });

        // ── Tutor list with hours from _sessMap ────────────────────────────
        const tutorList = [];
        for (const [uid, p] of Object.entries(_personMap || {})) {
          if (p.role !== 'Instructor') continue;
          if (!inRegion(p.school, p.district)) continue;
          const totalMins   = tutorMinsByUid[uid] || 0;
          const captureElig = tutorEligByUid[uid]  || 0;
          const captureSubm = tutorSubmByUid[uid]   || 0;
          const _tlEntry = _termEntry(p.name || uid);
          tutorList.push({
            uid,
            name:        p.name || uid,
            school:      p.school   || '',
            district:    p.district || '',
            attended:    p.attended || 0,
            absent:      p.absent   || 0,
            attRate:     (p.attended + p.absent) > 0
              ? parseFloat((p.attended / (p.attended + p.absent) * 100).toFixed(1)) : 0,
            hours:       parseFloat((totalMins / 60).toFixed(1)),
            captureElig, captureSubm,
            captureRate: captureElig > 0 ? Math.round(captureSubm / captureElig * 100) : null,
            terminated: !!_tlEntry, _termDate: _tlEntry ? _tlEntry.date : '',
          });
        }
        tutorList.sort((a, b) => b.hours - a.hours);

        // ── Ex-terminated aggregate metrics ───────────────────────────────────
        // Splits tutorList into separated (SEP) vs still-active staff so the PDF
        // can show side-by-side KPIs: "As Reported" vs "Excluding Separated Staff".
        // Future-proof: works identically against live or snapshot HR_EMPS data.
        const termTutors      = tutorList.filter(t => t.terminated);
        const exTermTutorList = tutorList.filter(t => !t.terminated);
        const _exTA = exTermTutorList.reduce((s,t) => s + t.attended, 0);
        const _exTB = exTermTutorList.reduce((s,t) => s + t.absent,   0);
        const exTermTutorAttRate = (_exTA + _exTB) > 0
          ? parseFloat((_exTA / (_exTA + _exTB) * 100).toFixed(1)) : null;
        const _exCE = exTermTutorList.reduce((s,t) => s + (t.captureElig||0), 0);
        const _exCS = exTermTutorList.reduce((s,t) => s + (t.captureSubm||0), 0);
        const exTermTutorCaptureRate = _exCE > 0 ? Math.round(_exCS / _exCE * 100) : null;
        const exTermTotalHours   = parseFloat(exTermTutorList.reduce((s,t) => s + (t.hours||0), 0).toFixed(1));
        const termMissingSurveys = termTutors.reduce((s,t) => s + Math.max(0,(t.captureElig||0)-(t.captureSubm||0)), 0);
        const termSurveyElig     = termTutors.reduce((s,t) => s + (t.captureElig||0), 0);

        // ── Active scholars: unique student IDs from delivered sessions ────
        // Matches the dashboard filter pill approach: unique studentIds across
        // (isFullAtt || isPartial) sessions in region — same denominator as totalSessions
        const activeScholarIds = new Set();
        sessions.forEach(sess => {
          if (sess.durMins > 0 && sess.studentIds) {
            sess.studentIds.forEach(id => { if (id) activeScholarIds.add(id); });
          }
        });

        console.log('[NJTC PDF] Export computed', {
          region: regionFilter, totalSessions, hitRate, ratioViolations,
          scholarAttRate, tutorAttRate, scholCaptureRate, tutorCaptureRate,
          schools: schools.length, tutors: tutorList.length,
          totalScholElig, totalScholSubm, totalTutorElig, totalTutorSubm,
        });

        return {
          region: regionFilter, generatedAt: new Date().toISOString(),
          totalSessions, hitRate, hitSessions, ratioViolations, maxRatio,
          scholarAttRate, tutorAttRate,
          stuAttended: stuAtt, stuAbsent: stuAbs, stuSI,
          instAttended: instAtt, instAbsent: instAbs,
          uniqueSchools: schools.length, uniqueDistricts: districts.length,
          activeScholars: activeScholarIds.size, activeTutors: tutorList.length,
          scholCaptureRate, tutorCaptureRate, scholMismatchRate, totalScholMismatch,
          totalScholElig, totalScholSubm, totalTutorElig, totalTutorSubm,
          totalTutorLate,
          scholCaptureTopN, scholCaptureBottomN,
          tutorCaptureTop, tutorCaptureBottom, tutorLateSurveyList,
          schools, districts, missedReasonCounts,
          stuSurveyAvg, instSurveyAvg, commentCounts,
          topTutors: tutorList.slice(0, 20),
          // Terminated staff tagging (SY 2025-2026 only, from HR Master List)
          termTutors,                                    // full array of SEP tutors in Pearl data
          exTermTutorAttRate, exTermTutorCaptureRate,    // KPIs with SEP staff removed
          exTermActiveTutors: exTermTutorList.length,    // non-SEP tutor count
          exTermTotalHours,                              // hours from non-SEP tutors
          termMissingSurveys, termSurveyElig,            // survey gap attributable to SEP staff
        };
      },

      getStats: function() {
        // Compute directly from the internal data arrays
        var stats = { loaded: false, scholAttPct: null, instAttPct: null, sessions: null,
                      siCount: null, surveyAvg: null, totalRows: 0, schoolCount: 0,
                      districtCount: 0, activeTutors: 0 };
        try {
          var stuAttRows = _attRows.filter(function(r){ return r[ATT.ROLE]==='Student'; });
          var stuAtt  = stuAttRows.filter(function(r){ var c=classifyRecord(r); return c==='attended'; }).length;
          var stuAbs  = stuAttRows.filter(function(r){ var c=classifyRecord(r); return c==='absent'; }).length;
          var stuTotal = stuAtt + stuAbs;
          if (stuTotal > 0) stats.scholAttPct = parseFloat((stuAtt/stuTotal*100).toFixed(1));
          var instAttRows = _attRows.filter(function(r){ return r[ATT.ROLE]==='Instructor'; });
          var instAtt = instAttRows.filter(function(r){ var c=classifyRecord(r); return c==='attended'; }).length;
          var instAbs = instAttRows.filter(function(r){ var c=classifyRecord(r); return c==='absent'; }).length;
          var instTotal = instAtt + instAbs;
          if (instTotal > 0) stats.instAttPct = parseFloat((instAtt/instTotal*100).toFixed(1));
          if (_sessRows && _sessRows.length) stats.sessions = _sessRows.length;
          var siRows = _attRows.filter(function(r){ var c=classifyRecord(r); return r[ATT.ROLE]==='Student' && (c==='service_interruption'||c==='si'||c==='service-interruption'); });
          stats.siCount = siRows.length;
          if (_stuStreamComplete && _stuRows.length) {
            var survScores = [];
            _stuRows.forEach(function(r){
              [STU_S.CONFIDENCE, STU_S.ENJOYMENT, STU_S.LEARNING, STU_S.OVERALL].forEach(function(c){
                var v = parseFloat(r[c]); if (!isNaN(v) && v > 0) survScores.push(v);
              });
            });
            if (survScores.length) stats.surveyAvg = parseFloat((survScores.reduce(function(a,b){return a+b;},0)/survScores.length).toFixed(2));
          } else if (_stuAggScores && _stuAggScores.globalCnt > 0) {
            stats.surveyAvg = parseFloat((_stuAggScores.globalSum / _stuAggScores.globalCnt).toFixed(2));
          }
          if (_schoolMap) {
            // Filter out empty/null keys — Pearl may create a blank-string entry from records missing a school name
            var schools = Object.keys(_schoolMap).filter(function(s){ return s && s.trim(); });
            stats.schoolCount = schools.length;
            stats.districtCount = new Set(schools.map(function(s){ return _schoolMap[s] && _schoolMap[s].district; }).filter(Boolean)).size;
          }
          if (_personMap) {
            // activeTutors here = every unique instructor appearing in Pearl for this
            // period (i.e. "Total Staff" from Pearl's perspective — rostered, not
            // necessarily having delivered a session). Kept as-is for SY compatibility.
            stats.activeTutors = Object.keys(_personMap).filter(function(k){ return _personMap[k] && _personMap[k].role==='Instructor'; }).length;
            // Active scholars: unique students who have at least 1 attended session in Pearl
            stats.activeScholars = Object.keys(_personMap).filter(function(k){ return _personMap[k] && _personMap[k].role==='Student' && _personMap[k].attended > 0; }).length;
            // Active instructors: unique instructors with at least 1 completed/attended
            // session (used for Summer's "Active Staff" figure — distinct from the
            // rostered activeTutors count above).
            stats.activeInstructors = Object.keys(_personMap).filter(function(k){ return _personMap[k] && _personMap[k].role==='Instructor' && _personMap[k].attended > 0; }).length;
          }
          // Rostered scholars: unique student IDs from Pearl Attendance tab (_attRows).
          // Uses the same source as getRaceData() — captures all enrolled scholars whether
          // their sessions were delivered, cancelled, or they were marked absent. A scholar
          // enrolled in Pearl but only in cancelled sessions is still a rostered scholar.
          try {
            var _rosSet = {};
            _attRows.forEach(function(r) {
              if (r[ATT.ROLE] !== 'Student') return;
              var uid = r[ATT.USER_ID] || r[ATT.USER];
              if (uid) _rosSet[uid] = true;
            });
            stats.rosteredScholars = Object.keys(_rosSet).length;
          } catch(e) {
            stats.rosteredScholars = Object.keys(_personMap||{}).filter(function(k){ return _personMap[k] && _personMap[k].role==='Student'; }).length;
          }
          stats.totalRows = _attRows.length + (_sessRows ? _sessRows.length : 0) + (_instRows ? _instRows.length : 0);
          // Total instructional minutes from delivered sessions
          try {
            var _tm = 0;
            Object.values(_sessMap).forEach(function(sess){ if(sess&&sess.isDelivered&&sess.durMins>0) _tm+=sess.durMins; });
            if (_tm > 0) stats.totalMins = _tm;
          } catch(e){}
          // Total scholar tutored minutes: aggregate of each scholar's individual session minutes.
          // Each session's duration is multiplied by the number of scholars in that session, so
          // this counts total instructional contact-minutes — distinct from totalMins (once per session).
          try {
            var _tsm = 0;
            if (_sessMap) {
              Object.values(_sessMap).forEach(function(sess){
                if (sess && sess.isDelivered && sess.durMins > 0 && sess.studentIds && sess.studentIds.length > 0) {
                  _tsm += sess.durMins * sess.studentIds.length;
                }
              });
            }
            if (_tsm > 0) stats.totalScholarMins = _tsm;
          } catch(e){}
          stats.loaded = stats.scholAttPct !== null;
        } catch(e) { console.warn('[po.getStats] error:', e.message); }
        // Which period this snapshot reflects — callers (sya, exec dashboard)
        // must check this before trusting the numbers for a specific period,
        // since getStats() always reflects whatever is currently loaded.
        stats.activePeriod = _activePeriod;
        return stats;
      },
      getStellarSchools: function() {
        try {
          var schools = [];
          Object.keys(_schoolMap).forEach(function(name) {
            if (!name || !name.trim()) return; // skip blank school-name entries
            var sc = _schoolMap[name];
            if (!sc) return;
            var total = sc.stuAttended + sc.stuAbsent;
            if (total === 0) return; // skip schools with zero attendance records
            var attRate = Math.round(sc.stuAttended / total * 100);
            var sessCount = sc.sessions ? sc.sessions.length : 0;
            schools.push({
              school: name, district: sc.district || '',
              attRate: attRate, sessions: sessCount,
              // Raw counts alongside the rounded rate so a consumer rolling
              // several schools together can weight by actual scholar
              // volume instead of averaging percentages (a 10-scholar site
              // and a 400-scholar site shouldn't pull a combined rate
              // equally).
              stuAttended: sc.stuAttended || 0, stuAbsent: sc.stuAbsent || 0,
              surveyAvg:    sc.stuSurveyAvg  ? parseFloat(sc.stuSurveyAvg.toFixed(2))  : null,
              instSurveyAvg:sc.instSurveyAvg ? parseFloat(sc.instSurveyAvg.toFixed(2)) : null,
              surveyCount:  sc.stuSurveyRows  ? sc.stuSurveyRows.length  : 0,
              siCount:      sc.stuInterruptions || 0,
              flags:        (sc.flags || []).map(function(f) {
                var SHORT = {
                  ratio:       'Ratio >1:4',      critical_si: 'Critical SI',
                  vacancy_si:  'Vacancy Gap',      high_si:     'High SI',
                  declined:    'Scholar Declined', ct_pull:     'CT Pull-Out',
                };
                return typeof f === 'string' ? f : (SHORT[f.type] || f.type || f.msg || '');
              }).filter(Boolean),
              flagDetails:  (sc.flags || []).map(function(f) {
                return typeof f === 'string' ? f : (f.msg || '');
              }).filter(Boolean),
            });
          });
          schools.sort(function(a, b) {
            if (b.attRate !== a.attRate) return b.attRate - a.attRate;
            return b.sessions - a.sessions;
          });
          return schools;
        } catch(e) { return []; }
      },
      getRaceData: function() {
        try {
          var scholarRace = {}; var seen = {};
          _attRows.forEach(function(r) {
            if (r[ATT.ROLE] !== 'Student') return;
            var uid = r[ATT.USER_ID] || r[ATT.USER];
            if (seen[uid]) return; seen[uid] = true;
            var race = (r[ATT.RACE] || 'Not Specified').trim() || 'Not Specified';
            scholarRace[race] = (scholarRace[race] || 0) + 1;
          });
          return { byScholar: scholarRace, totalScholars: Object.keys(seen).length };
        } catch(e) { return null; }
      },

      // getDiagnosticTestingData() — returns per-school summary of weeks where
      // NJTC Diagnostic Testing or School-administered Testing was the missed reason.
      // Used by iReady Analysis Lab to contextualize how many program weeks were
      // consumed by diagnostic windows, helping teams interpret springWeeks data.
      getDiagnosticTestingData: function() {
        try {
          var NJTC_REASON   = 'NJTC Diagnostic Testing';
          var SCHOOL_REASON = 'School-administered Testing';
          // A week counts as a testing window only if ≥3 distinct scholars were affected
          // (filters out lone make-up sessions).
          var WEEK_SCHOLAR_MIN = 3;
          var _sortWeek = function(a, b) {
            return (parseInt(a.replace(/\D+/,''))||0) - (parseInt(b.replace(/\D+/,''))||0);
          };
          var bySchool = {};
          _attRows.forEach(function(r) {
            if (r[ATT.ROLE] !== 'Student') return;
            var reason = r[ATT.MISS_REASON] || '';
            var isNJTC   = reason === NJTC_REASON;
            var isSchool = reason === SCHOOL_REASON;
            if (!isNJTC && !isSchool) return;
            var school   = r[ATT.SCHOOL]   || 'Unknown';
            var district = r[ATT.DISTRICT] || '';
            var week     = r[ATT.WEEK]     || '';
            var uid      = r[ATT.USER_ID]  || '';
            if (!bySchool[school]) bySchool[school] = {
              district: district,
              njtcWeekScholars:   {},   // week → Set<uid>  for NJTC Diagnostic Testing
              schoolWeekScholars: {},   // week → Set<uid>  for School-administered Testing
              scholars: new Set(),
            };
            var bucket = isNJTC ? bySchool[school].njtcWeekScholars : bySchool[school].schoolWeekScholars;
            if (week && uid) {
              if (!bucket[week]) bucket[week] = new Set();
              bucket[week].add(uid);
            }
            if (uid) bySchool[school].scholars.add(uid);
          });

          var _summariseReason = function(weekScholars) {
            var allKeys  = Object.keys(weekScholars).sort(_sortWeek);
            var concKeys = allKeys.filter(function(w){ return weekScholars[w].size >= WEEK_SCHOLAR_MIN; });
            return {
              weeks:       concKeys.length,
              allWeeks:    allKeys.length,
              makeupWeeks: allKeys.length - concKeys.length,
              weekLabels:  concKeys,
            };
          };

          return Object.entries(bySchool)
            .map(function(entry) {
              var school = entry[0], d = entry[1];
              var njtc   = _summariseReason(d.njtcWeekScholars);
              var school_ = _summariseReason(d.schoolWeekScholars);
              return {
                school:          school,
                district:        d.district,
                scholars:        d.scholars.size,
                // NJTC Diagnostic Testing (primary concern)
                njtcWeeks:       njtc.weeks,
                njtcAllWeeks:    njtc.allWeeks,
                njtcMakeup:      njtc.makeupWeeks,
                njtcWeekLabels:  njtc.weekLabels,
                // School-administered Testing (secondary)
                schoolWeeks:     school_.weeks,
                schoolAllWeeks:  school_.allWeeks,
                schoolMakeup:    school_.makeupWeeks,
                schoolWeekLabels: school_.weekLabels,
                // Combined total for sorting (NJTC is primary sort key)
                diagnosticWeeks: njtc.weeks,
              };
            })
            .filter(function(s) { return s.njtcAllWeeks > 0 || s.schoolAllWeeks > 0; })
            .sort(function(a, b) { return b.njtcWeeks - a.njtcWeeks || b.schoolWeeks - a.schoolWeeks; });
        } catch(e) { return []; }
      },

      // getAttRows() — raw attendance rows for Impact Report Builder (Data dept)
      // Returns a shallow copy so callers cannot mutate internal state.
      getAttRows: function() {
        return _attRows ? _attRows.slice() : [];
      },

      // isDataLoaded() — true once at least one successful fetch has completed
      isDataLoaded: function() {
        return _inited && _attRows && _attRows.length > 0;
      },

      // getSessRows() — raw session rows for session-joined CSV export (Impact Report Builder)
      // Returns a shallow copy so callers cannot mutate internal state.
      getSessRows: function() {
        return _sessRows ? _sessRows.slice() : [];
      },

      // getStuRows() — raw scholar survey rows for per-tutor median score computation
      // Returns a shallow copy so callers cannot mutate internal state.
      getStuRows: function() {
        return _stuRows ? _stuRows.slice() : [];
      },

      // getInstRows() — raw instructor survey rows for per-tutor satisfaction aggregation
      // Used by MOY tutor impact join to attach tutor survey averages.
      // Returns a shallow copy so callers cannot mutate internal state.
      getInstRows: function() {
        return _instRows ? _instRows.slice() : [];
      },

      // isSurveyDataComplete() — true when BOTH tutor and scholar survey data are fully loaded
      // Scholar surveys stream progressively; this is false until the stream finishes.
      // Use this to block PDF generation until data is authoritative.
      isSurveyDataComplete: function() {
        return _stuStreamComplete && _instRows.length > 0;
      },

      // getSurveyRowCounts() — live counts for status display
      getSurveyRowCounts: function() {
        return {
          scholar: _stuRows  ? _stuRows.length  : 0,
          tutor:   _instRows ? _instRows.length : 0,
          scholarComplete: _stuStreamComplete,
        };
      },

      // getFilterState() — current school/district filter arrays for external use (e.g. Survey Report PDF)
      getFilterState: function() {
        return { districts: _filtDistrict.slice(), schools: _filtSchool.slice() };
      },

      // getFilteredStuRows() — scholar survey rows scoped to current district/school filter
      // Returns all rows when no filter is active (aggregate mode)
      getFilteredStuRows: function() {
        if (!_stuRows || !_stuRows.length) return [];
        if (!_filtDistrict.length && !_filtSchool.length) return _stuRows.slice();
        return _stuRows.filter(function(r) {
          var school   = (r[8]  || '').trim();
          var district = (r[9]  || '').trim();
          if (_filtDistrict.length && !_filtDistrict.includes(district)) return false;
          if (_filtSchool.length   && !_filtSchool.includes(school))     return false;
          return true;
        });
      },

      // getFilteredInstRows() — tutor survey rows scoped to current district/school filter
      getFilteredInstRows: function() {
        if (!_instRows || !_instRows.length) return [];
        if (!_filtDistrict.length && !_filtSchool.length) return _instRows.slice();
        return _instRows.filter(function(r) {
          var school   = (r[9]  || '').trim();
          var district = (r[10] || '').trim();
          if (_filtDistrict.length && !_filtDistrict.includes(district)) return false;
          if (_filtSchool.length   && !_filtSchool.includes(school))     return false;
          return true;
        });
      },

      // getTutorSurveyScores() — per-tutor aggregated survey scores, joined through _sessMap
      // The streaming/cache paths don't store FILLED_FOR (tutor name) in raw rows.
      // This method resolves tutor names via _sessMap[sessId].instructor so it works
      // regardless of how survey data was loaded.
      // Returns array of { name, school, district, confidence, enjoyment, learning, overall, count }
      // sorted by overall score desc. Pass tutorName to filter to one person.
      getTutorSurveyScores: function(tutorName) {
        try {
          var byTutor = {};
          (_stuRows || []).forEach(function(r) {
            var sessId = r[11];
            var sess   = sessId && _sessMap ? _sessMap[sessId] : null;
            var tname  = (sess && sess.instructor) ? sess.instructor.trim() : (r[1] || '').trim();
            if (!tname) return;
            // Optional filter
            if (tutorName) {
              var normT = tname.toLowerCase().replace(/[^a-z ]/g,'');
              var normQ = tutorName.toLowerCase().replace(/[^a-z ]/g,'');
              // Must share last name token
              var tLast = normT.split(' ').slice(-1)[0];
              var qLast = normQ.split(' ').slice(-1)[0];
              if (tLast !== qLast && normT.indexOf(normQ) < 0 && normQ.indexOf(normT) < 0) return;
            }
            if (!byTutor[tname]) byTutor[tname] = {
              name: tname,
              school:   (sess && sess.school)   || '',
              district: (sess && sess.district) || '',
              conf: [], enjoy: [], learn: [], ovr: []
            };
            var c=parseFloat(r[2]),e=parseFloat(r[3]),l=parseFloat(r[4]),o=parseFloat(r[5]);
            if (!isNaN(c)&&c>0) byTutor[tname].conf.push(c);
            if (!isNaN(e)&&e>0) byTutor[tname].enjoy.push(e);
            if (!isNaN(l)&&l>0) byTutor[tname].learn.push(l);
            if (!isNaN(o)&&o>0) byTutor[tname].ovr.push(o);
          });
          function avg(arr) { return arr.length ? parseFloat((arr.reduce(function(a,b){return a+b;},0)/arr.length).toFixed(2)) : null; }
          return Object.values(byTutor).map(function(t) {
            return {
              name: t.name, school: t.school, district: t.district,
              confidence: avg(t.conf), enjoyment: avg(t.enjoy),
              learning:   avg(t.learn), overall:   avg(t.ovr),
              count: Math.max(t.conf.length, t.enjoy.length, t.learn.length, t.ovr.length)
            };
          }).sort(function(a,b){ return (b.overall||0)-(a.overall||0); });
        } catch(e) { return []; }
      },

      // getTutorSessionStats(tutorName?) — per-session counts for each tutor, name-joined via _sessMap.
      // Returns array of { name, total, completed, incomplete, withSurveys, survComp }
      // survComp = % of sessions with ≥1 scholar survey (0-100). Pass tutorName to filter to one person.
      getTutorSessionStats: function(tutorName) {
        try {
          function normQ(s) { return (s||'').toLowerCase().replace(/[^a-z ]/g,''); }
          var qNorm = tutorName ? normQ(tutorName) : null;
          var qLast = qNorm ? qNorm.split(' ').filter(function(t){return t.length>0;}).slice(-1)[0] : null;

          // Step 1: collect session IDs with at least one scholar survey
          var sessWithSurvey = {};
          (_stuRows || []).forEach(function(r) {
            var sid = r[11]; if (sid) sessWithSurvey[sid] = true;
          });

          // Step 2: group sessions by instructor name via _sessMap (avoids instId mismatch)
          var byTutor = {};
          Object.values(_sessMap || {}).forEach(function(sess) {
            var tname = (sess.instructor || '').trim();
            if (!tname) return;
            if (qNorm) {
              var tNorm = normQ(tname);
              var tLast = tNorm.split(' ').filter(function(t){return t.length>0;}).slice(-1)[0];
              if (tLast !== qLast && tNorm.indexOf(qNorm) < 0 && qNorm.indexOf(tNorm) < 0) return;
            }
            if (!byTutor[tname]) byTutor[tname] = { name: tname, total: 0, completed: 0, incomplete: 0, withSurveys: 0, scholars: new Set(), schools: new Set() };
            var t = byTutor[tname];
            t.total++;
            var st = (sess.status || '').toLowerCase();
            if (st === 'completed' || st === 'complete') { t.completed++; } else { t.incomplete++; }
            if (sess.id && sessWithSurvey[sess.id]) t.withSurveys++;
            // Track unique scholars and schools
            (sess.studentIds || []).forEach(function(sid) { if (sid) t.scholars.add(sid); });
            if (sess.school) t.schools.add(sess.school);
          });

          // Step 3: compute survComp % and return
          return Object.values(byTutor).map(function(t) {
            return {
              name:          t.name,
              total:         t.total,
              completed:     t.completed,
              incomplete:    t.incomplete,
              withSurveys:   t.withSurveys,
              survComp:      t.total > 0 ? Math.round(t.withSurveys / t.total * 100) : null,
              scholarCount:  t.scholars.size,
              schools:       [...t.schools]
            };
          });
        } catch(e) { return []; }
      },

      // getLateFilerStats() — tutors with ≥50% late survey submission rate
      // Exposed for PIE anomaly detection. Recomputes on each call (lightweight).
      getLateFilerStats: function() {
        try { return computeTutorLateFilersStats(); } catch(e) { return { flagged:[], totalLate:0, totalFlagged:0 }; }
      },

      // getSchoolFlags() — per-school HIT compliance flags for PIE anomaly surfacing
      // Returns array of { school, district, siCount, flags[], attRate, surveyAvg }
      getSchoolFlags: function() {
        if (!_schoolMap) return [];
        var results = [];
        Object.entries(_schoolMap).forEach(function(entry) {
          var name = entry[0], sc = entry[1];
          if (!name || !name.trim()) return;
          if ((sc.flags||[]).length === 0) return;
          var total = sc.stuAttended + sc.stuAbsent;
          results.push({
            school:   name,
            district: sc.district || '',
            attRate:  total > 0 ? Math.round(sc.stuAttended/total*100) : null,
            siCount:  sc.stuInterruptions || 0,
            surveyAvg: sc.stuSurveyAvg ? parseFloat(sc.stuSurveyAvg.toFixed(2)) : null,
            flags:    (sc.flags || []).map(function(f){ return { type:f.type, severity:f.severity, msg:f.msg }; }),
          });
        });
        return results.sort(function(a,b){
          var sa = (a.flags.some(function(f){return f.severity==='critical';})?2:a.flags.some(function(f){return f.severity==='high';})?1:0);
          var sb = (b.flags.some(function(f){return f.severity==='critical';})?2:b.flags.some(function(f){return f.severity==='high';})?1:0);
          return sb - sa;
        });
      },

      // getProgramSummaryData() — comprehensive data package for Program Pulse summary
      // Powers the Program Data Summary overlay in Programming + Data departments.
      // Reads from in-memory data only — no additional API calls, no timeouts possible.
      getProgramSummaryData: function() {
        var out = {
          loaded: false, currentWeek: null, allWeeks: [], weeklyTrend: [],
          regional: { NE: null, SW: null }, discrepancies: [], onsiteComments: [],
          positiveCallouts: [], areasToReview: [], stellarSites: [],
          academic: null,
        };
        try {
          if (!_attRows || !_attRows.length) return out;
          out.loaded = true;

          // ── Derive weeks and current week ──────────────────────────────────
          var weekNums = {};
          _attRows.forEach(function(r) {
            var w = r[ATT.WEEK]; if (!w) return;
            var n = parseInt(w.replace(/\D/g,''), 10); if (isNaN(n)) return;
            weekNums[w] = n;
          });
          var sortedWeeks = Object.keys(weekNums).sort(function(a,b){ return weekNums[a]-weekNums[b]; });
          out.allWeeks = sortedWeeks;
          var curWeekLabel = sortedWeeks[sortedWeeks.length - 1] || null;

          // ── Helper: compute att stats for a set of rows ───────────────────
          function attStats(rows, role) {
            var filtered = role ? rows.filter(function(r){ return r[ATT.ROLE]===role; }) : rows;
            var att=0, abs=0, si=0, nr=0;
            var siReasons={}, missReasons={};
            filtered.forEach(function(r) {
              var cls = classifyRecord(r);
              if (cls==='attended')             att++;
              else if (cls==='absent') {
                abs++;
                var reason = r[ATT.MISS_REASON]||'Unknown';
                missReasons[reason] = (missReasons[reason]||0) + 1;
              }
              else if (cls==='service_interruption') {
                si++;
                var reason = r[ATT.MISS_REASON]||'Unknown';
                siReasons[reason] = (siReasons[reason]||0) + 1;
              }
              else if (cls==='not_recorded') nr++;
            });
            var total = att+abs;
            return { att, abs, si, nr, total, rate: total>0?Math.round(att/total*100):null, siReasons, missReasons };
          }

          // ── Helper: region for a school/district ─────────────────────────
          var NE_KW = ['ilearn','i-learn','paterson','pcsst','hoboken','middlesex','central jersey','cjcp'];
          var SW_KW = ['american paradigm','first philadelphia','first philly','global leadership','penns grove','carneys point','haddon','hamilton township','gloucester'];
          function getRegion(school, district) {
            var s=(school||'').toLowerCase(), d=(district||'').toLowerCase();
            for (var i=0;i<NE_KW.length;i++){ if(d.includes(NE_KW[i])||s.includes(NE_KW[i])) return 'NE'; }
            for (var i=0;i<SW_KW.length;i++){ if(d.includes(SW_KW[i])||s.includes(SW_KW[i])) return 'SW'; }
            return 'NE'; // default
          }

          // ── Current week analysis ─────────────────────────────────────────
          if (curWeekLabel) {
            var cwRows = _attRows.filter(function(r){ return r[ATT.WEEK]===curWeekLabel; });
            var stuStats  = attStats(cwRows, 'Student');
            var instStats = attStats(cwRows, 'Instructor');

            // Incomplete sessions this week (Scheduled status)
            var cwSessIncomplete = Object.values(_sessMap).filter(function(s){
              if (s.status !== 'Scheduled') return false;
              var sessWeek = weekKeyFromDateStr(s.startDate || s.date || '');
              return sessWeek === curWeekLabel;
            }).length;
            // Fallback: all scheduled sessions if week derivation yields 0
            if (cwSessIncomplete === 0) {
              cwSessIncomplete = Object.values(_sessMap).filter(function(s){ return s.status==='Scheduled'; }).length;
            }

            // Missed reason breakdown (scholar rows, current week)
            var missBreakdown = [];
            Object.entries(stuStats.missReasons).sort(function(a,b){return b[1]-a[1];}).forEach(function(e){
              missBreakdown.push({ reason: e[0], count: e[1] });
            });

            // SI breakdown by severity
            var siByLevel = { critical:[], high:[], medium:[], low:[] };
            Object.entries(stuStats.siReasons).forEach(function(e){
              var sev = SI_SEVERITY[e[0]] || 'medium';
              siByLevel[sev].push({ reason: e[0], count: e[1] });
            });

            // Survey scores this week — match by session ID (same approach as late survey detection).
            // Build the set of session IDs that belong to the current week, then pull any survey
            // that references one of those IDs. Falls back to Date Responded week only when a
            // survey has no session ID attached.
            var cwSessIds = new Set();
            Object.values(_sessMap).forEach(function(s) {
              if (weekKeyFromDateStr(s.start) === curWeekLabel) cwSessIds.add(s.id);
            });
            var cwStuSurvRows = _stuRows.filter(function(r) {
              var sid = r[STU_S.SESS_ID] || '';
              if (sid) return cwSessIds.has(sid);
              // No session ID — fall back to Date Responded
              var wk = weekKeyFromDateStr(r[STU_S.DATE]) || (r[STU_S.WEEK]||'');
              return wk === curWeekLabel;
            });
            var cwInstSurvRows = _instRows.filter(function(r) {
              var sid = r[INST_S.SESS_ID] || '';
              if (sid) return cwSessIds.has(sid);
              // No session ID — fall back to Date Responded
              var wk = weekKeyFromDateStr(r[INST_S.DATE]) || (r[INST_S.WEEK]||'');
              return wk === curWeekLabel;
            });
            function survAvg(rows, cols) {
              var sum=0, cnt=0;
              rows.forEach(function(r){ cols.forEach(function(c){ var v=parseFloat(r[c]); if(!isNaN(v)&&v>0){sum+=v;cnt++;} }); });
              return cnt>0 ? Math.round(sum/cnt*10)/10 : null;
            }
            var cwScholarSurvey = survAvg(cwStuSurvRows, [STU_S.CONFIDENCE,STU_S.ENJOYMENT,STU_S.LEARNING,STU_S.OVERALL]);
            var cwTutorSurvey   = survAvg(cwInstSurvRows, [INST_S.ENGAGEMENT,INST_S.ENJOYMENT,INST_S.LEARNING,INST_S.OVERALL]);

            // Low-rating sites this week (school avg survey < 3.5)
            var cwSchoolSurvMap = {};
            cwStuSurvRows.forEach(function(r){
              var sch = r[STU_S.SCHOOL]||'Unknown';
              if (!cwSchoolSurvMap[sch]) cwSchoolSurvMap[sch] = { sum:0, cnt:0, district: r[STU_S.DISTRICT]||'' };
              [STU_S.CONFIDENCE,STU_S.ENJOYMENT,STU_S.LEARNING,STU_S.OVERALL].forEach(function(c){
                var v=parseFloat(r[c]); if(!isNaN(v)&&v>0){cwSchoolSurvMap[sch].sum+=v;cwSchoolSurvMap[sch].cnt++;}
              });
            });
            var lowRatingSites = [];
            Object.entries(cwSchoolSurvMap).forEach(function(e){
              var avg = e[1].cnt>0 ? Math.round(e[1].sum/e[1].cnt*10)/10 : null;
              if (avg !== null && avg < 3.5) lowRatingSites.push({ school: e[0], district: e[1].district, avg: avg });
            });
            lowRatingSites.sort(function(a,b){return a.avg-b.avg;});

            // Positive callouts: schools with high attendance + survey this week
            var cwSchoolAttMap = {};
            cwRows.filter(function(r){return r[ATT.ROLE]==='Student';}).forEach(function(r){
              var sch = r[ATT.SCHOOL]||'Unknown', d = r[ATT.DISTRICT]||'';
              if (!cwSchoolAttMap[sch]) cwSchoolAttMap[sch] = { att:0, abs:0, district:d };
              var cls = classifyRecord(r);
              if (cls==='attended') cwSchoolAttMap[sch].att++;
              else if (cls==='absent') cwSchoolAttMap[sch].abs++;
            });
            var positiveCallouts = [];
            Object.entries(cwSchoolAttMap).forEach(function(e){
              var t = e[1].att+e[1].abs;
              var rate = t>0?Math.round(e[1].att/t*100):0;
              var surv = cwSchoolSurvMap[e[0]];
              var survAvgVal = surv&&surv.cnt>0 ? Math.round(surv.sum/surv.cnt*10)/10 : null;
              if (rate>=95 && t>=10) positiveCallouts.push({ school:e[0], district:e[1].district, attRate:rate, surveyAvg:survAvgVal });
            });
            positiveCallouts.sort(function(a,b){return b.attRate-a.attRate;}).splice(5);

            out.currentWeek = {
              label: curWeekLabel,
              scholarAtt: stuStats,
              tutorAtt: instStats,
              incompletes: cwSessIncomplete,
              missedReasons: missBreakdown,
              serviceInterruptions: siByLevel,
              siTotal: stuStats.si,
              scholarSurvey: cwScholarSurvey,
              tutorSurvey: cwTutorSurvey,
              surveyLoading: !_stuStreamComplete,
              lowRatingSites: lowRatingSites,
              positiveCallouts: positiveCallouts,
            };
          }

          // ── Weekly trend (last 16 weeks) ──────────────────────────────────
          var trendMap = {};
          _attRows.forEach(function(r) {
            var w = r[ATT.WEEK]; if (!w) return;
            if (!trendMap[w]) trendMap[w] = { stuAtt:0, stuAbs:0, instAtt:0, instAbs:0, si:0 };
            var cls = classifyRecord(r);
            if (r[ATT.ROLE]==='Student') {
              if (cls==='attended') trendMap[w].stuAtt++;
              else if (cls==='absent') trendMap[w].stuAbs++;
              else if (cls==='service_interruption') trendMap[w].si++;
            } else if (r[ATT.ROLE]==='Instructor') {
              if (cls==='attended') trendMap[w].instAtt++;
              else if (cls==='absent') trendMap[w].instAbs++;
            }
          });
          // Survey by week — resolve week from session ID (same approach as "This Week" tab).
          // Build sessId→week lookup once, then bucket each survey into the right week.
          var sessIdWeekMap = {};
          Object.values(_sessMap).forEach(function(s) {
            var wk = weekKeyFromDateStr(s.start);
            if (wk) sessIdWeekMap[s.id] = wk;
          });
          function addSurveyToTrend(sessId, dateStr, weekCol, cols, row) {
            // Prefer session ID → week; fall back to Date Responded; then WEEK column
            var w = (sessId && sessIdWeekMap[sessId]) || weekKeyFromDateStr(dateStr) || weekCol || '';
            if (!w || !trendMap[w]) return;
            if (!trendMap[w].survSum) { trendMap[w].survSum = 0; trendMap[w].survCnt = 0; }
            cols.forEach(function(c) {
              var v = parseFloat(row[c]); if (!isNaN(v) && v > 0) { trendMap[w].survSum += v; trendMap[w].survCnt++; }
            });
          }
          _stuRows.forEach(function(r) {
            addSurveyToTrend(r[STU_S.SESS_ID]||'', r[STU_S.DATE]||'', r[STU_S.WEEK]||'',
              [STU_S.CONFIDENCE,STU_S.ENJOYMENT,STU_S.LEARNING,STU_S.OVERALL], r);
          });
          _instRows.forEach(function(r) {
            addSurveyToTrend(r[INST_S.SESS_ID]||'', r[INST_S.DATE]||'', r[INST_S.WEEK]||'',
              [INST_S.ENGAGEMENT,INST_S.ENJOYMENT,INST_S.LEARNING,INST_S.OVERALL], r);
          });
          out.weeklyTrend = sortedWeeks.slice(-16).map(function(w) {
            var d = trendMap[w]||{};
            var st=d.stuAtt+d.stuAbs, it=d.instAtt+d.instAbs;
            return {
              week: w,
              scholarRate: st>0?Math.round(d.stuAtt/st*100):null,
              tutorRate:   it>0?Math.round(d.instAtt/it*100):null,
              siCount: d.si||0,
              surveyAvg: d.survCnt>0?Math.round(d.survSum/d.survCnt*10)/10:null,
            };
          });

          // ── Regional breakdown (all-time) ─────────────────────────────────
          var regMap = { NE:{stuAtt:0,stuAbs:0,instAtt:0,instAbs:0,si:0,survSum:0,survCnt:0,schools:new Set()},
                         SW:{stuAtt:0,stuAbs:0,instAtt:0,instAbs:0,si:0,survSum:0,survCnt:0,schools:new Set()} };
          _attRows.forEach(function(r){
            var reg = getRegion(r[ATT.SCHOOL],r[ATT.DISTRICT]);
            var rm = regMap[reg]; if(!rm) return;
            if (r[ATT.SCHOOL]) rm.schools.add(r[ATT.SCHOOL]);
            var cls = classifyRecord(r);
            if (r[ATT.ROLE]==='Student') {
              if (cls==='attended') rm.stuAtt++;
              else if (cls==='absent') rm.stuAbs++;
              else if (cls==='service_interruption') rm.si++;
            } else if (r[ATT.ROLE]==='Instructor') {
              if (cls==='attended') rm.instAtt++;
              else if (cls==='absent') rm.instAbs++;
            }
          });
          _stuRows.forEach(function(r){
            var reg = getRegion(r[STU_S.SCHOOL],r[STU_S.DISTRICT]);
            var rm = regMap[reg]; if(!rm) return;
            [STU_S.CONFIDENCE,STU_S.ENJOYMENT,STU_S.LEARNING,STU_S.OVERALL].forEach(function(c){
              var v=parseFloat(r[c]); if(!isNaN(v)&&v>0){rm.survSum+=v;rm.survCnt++;}
            });
          });
          ['NE','SW'].forEach(function(reg){
            var rm = regMap[reg];
            var st=rm.stuAtt+rm.stuAbs, it=rm.instAtt+rm.instAbs;
            out.regional[reg] = {
              scholarRate: st>0?Math.round(rm.stuAtt/st*100):null,
              tutorRate:   it>0?Math.round(rm.instAtt/it*100):null,
              siCount:     rm.si,
              surveyAvg:   rm.survCnt>0?Math.round(rm.survSum/rm.survCnt*10)/10:null,
              schools:     rm.schools.size,
            };
          });

          // ── Pearl discrepancies ───────────────────────────────────────────
          var discrepancies = [];
          // 1. Scholar archived but also has non-archived sessions
          var scholarStatuses = {}; // uid -> { hasArchived: bool, hasActive: bool, name: '', school: '' }
          _attRows.forEach(function(r){
            if (r[ATT.ROLE]!=='Student') return;
            var uid=r[ATT.USER_ID]; if(!uid) return;
            if (!scholarStatuses[uid]) scholarStatuses[uid]={hasArchived:false,hasActive:false,name:r[ATT.USER]||'',school:r[ATT.SCHOOL]||'',district:r[ATT.DISTRICT]||''};
            if ((r[ATT.MISS_REASON]||'').includes('Archived')) scholarStatuses[uid].hasArchived=true;
            else scholarStatuses[uid].hasActive=true;
          });
          var archivedConflicts = [];
          Object.entries(scholarStatuses).forEach(function(e){
            if (e[1].hasArchived && e[1].hasActive) archivedConflicts.push({ uid:e[0], name:e[1].name, school:e[1].school, district:e[1].district, type:'archived_active_conflict' });
          });
          if (archivedConflicts.length) discrepancies.push({ type:'archived_conflict', label:'Scholars Archived but Still in Active Sessions', items:archivedConflicts.slice(0,10), total:archivedConflicts.length });

          // 2. Sessions missing subject
          var missingSubject = [];
          Object.values(_sessMap).forEach(function(s){
            if (!s.subject && s.isDelivered) missingSubject.push({ school:s.school||'', district:s.district||'', title:s.title||'' });
          });
          if (missingSubject.length) discrepancies.push({ type:'missing_subject', label:'Delivered Sessions Missing Subject', items:missingSubject.slice(0,10), total:missingSubject.length });

          // 3. Scholars with 3+ consecutive absences (CONSEC_STATUS flag)
          var consecAbsent = [];
          var seenConsec = {};
          _attRows.forEach(function(r){
            if (r[ATT.ROLE]!=='Student') return;
            if ((r[ATT.CONSEC_STATUS]||'').includes('Concern')) {
              var uid=r[ATT.USER_ID]||r[ATT.USER]; if(seenConsec[uid]) return; seenConsec[uid]=true;
              consecAbsent.push({ name:r[ATT.USER]||'Unknown', school:r[ATT.SCHOOL]||'', district:r[ATT.DISTRICT]||'' });
            }
          });
          if (consecAbsent.length) discrepancies.push({ type:'consecutive_absent', label:'Scholars with Attendance Concern Flag', items:consecAbsent.slice(0,10), total:consecAbsent.length });

          out.discrepancies = discrepancies;

          // ── Onsite comments (flagged + positive, last 2 weeks) ────────────
          var recentWeeks = sortedWeeks.slice(-2);
          var onsiteComments = [];
          _instRows.forEach(function(r){
            var w = r[INST_S.WEEK]||'';
            if (!recentWeeks.includes(w)) return;
            var txt = (r[INST_S.COMMENT_ADMIN]||'').trim();
            if (!txt || txt.length < 10) return;
            // Keyword classification
            var lower = txt.toLowerCase();
            var isConcern = ['behavior','unsafe','bully','concern','struggle','uncomfortable','refusing','not participat','disrupt'].some(function(kw){return lower.includes(kw);});
            var isPositive = ['great','excellent','amazing','good session','wonderful','love','fantastic','best','happy','engaged','excited','helpful','fun','awesome'].some(function(kw){return lower.includes(kw);});
            if (isConcern || isPositive) {
              onsiteComments.push({ text:txt, school:r[INST_S.SCHOOL]||'', district:r[INST_S.DISTRICT]||'', week:w, type: isConcern?'concern':'positive' });
            }
          });
          _stuRows.forEach(function(r){
            var w = r[STU_S.WEEK]||'';
            if (!recentWeeks.includes(w)) return;
            var txt = (r[STU_S.COMMENT]||'').trim();
            if (!txt || txt.length < 10) return;
            var lower = txt.toLowerCase();
            var isConcern = ['behavior','unsafe','bully','concern','struggle','uncomfortable','refusing','not participat','disrupt','scared','hurt'].some(function(kw){return lower.includes(kw);});
            var isPositive = ['great','excellent','amazing','good','love','fantastic','best','happy','fun','awesome','learned','enjoyed'].some(function(kw){return lower.includes(kw);});
            if (isConcern || isPositive) {
              onsiteComments.push({ text:txt, school:r[STU_S.SCHOOL]||'', district:r[STU_S.DISTRICT]||'', week:w, type: isConcern?'concern':'positive' });
            }
          });
          // Sort: concerns first, then positive
          onsiteComments.sort(function(a,b){ return a.type==='concern'&&b.type!=='concern'?-1:b.type==='concern'&&a.type!=='concern'?1:0; });
          out.onsiteComments = onsiteComments.slice(0, 20);

          // ── Stellar sites (top 5 by attendance + survey) ─────────────────
          var stellar = [];
          Object.entries(_schoolMap).forEach(function(e){
            var name=e[0], sc=e[1]; if(!name||!name.trim()) return;
            var t = sc.stuAttended+sc.stuAbsent;
            if (t < 10) return;
            var rate = Math.round(sc.stuAttended/t*100);
            if (rate >= 90) stellar.push({ school:name, district:sc.district||'', attRate:rate, surveyAvg: sc.stuSurveyAvg?parseFloat(sc.stuSurveyAvg.toFixed(1)):null, sessions: sc.sessions?sc.sessions.length:0 });
          });
          stellar.sort(function(a,b){ return b.attRate-a.attRate || (b.surveyAvg||0)-(a.surveyAvg||0); });
          out.stellarSites = stellar.slice(0, 5);

          // ── Areas to review: schools below 80% attendance ─────────────────
          var areasToReview = [];
          Object.entries(_schoolMap).forEach(function(e){
            var name=e[0], sc=e[1]; if(!name||!name.trim()) return;
            var t = sc.stuAttended+sc.stuAbsent;
            if (t < 10) return;
            var rate = Math.round(sc.stuAttended/t*100);
            if (rate < 80) areasToReview.push({ school:name, district:sc.district||'', attRate:rate, siCount:sc.stuInterruptions||0, sessions:sc.sessions?sc.sessions.length:0 });
          });
          areasToReview.sort(function(a,b){ return a.attRate-b.attRate; });
          out.areasToReview = areasToReview.slice(0, 8);

        } catch(e) { console.warn('[getProgramSummaryData] error:', e.message, e.stack); }
        return out;
      },
    };
  })();





    // ══════════════════════════════════════════════════════════════════════════
  //  i-READY ANALYSIS LAB v3  (irlab)
  //  DATA SOURCE: Embedded-only. No live Google Sheets fetch.
  //  Data Dept can update via CSV upload → stored in localStorage → all views.
  //  EOY data displayed by default. Snapshots via Quick CSV (session-only).
  // ══════════════════════════════════════════════════════════════════════════

  // ── Expose to global scope ───────────────────────────────────────────────
  window.renderProgrammingReviews   = renderProgrammingReviews;
  window.renderProgrammingAnalytics = renderProgrammingAnalytics;
  window.sya                        = sya;
  window.po                         = po;

})();
