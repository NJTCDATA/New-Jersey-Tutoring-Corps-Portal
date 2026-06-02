(function () {
  'use strict';

  // ── Period definitions ──────────────────────────────────────────────────────
  // Each period has a label, cycle key (matches Cycle col in tracker), and
  // a date range for filtering. Month buckets within each period are derived
  // from offer-accepted / termination dates in that range.
  const PERIODS = [
    {
      id: 'sy2526',
      label: 'SY 25-26',
      start: new Date('2025-09-01'),
      end:   new Date('2026-06-30'),
      // SY 25-26 uses HR_EMPS array (embedded + overlay); no tracker
      source: 'hr_emps',
      cycleKey: 'school year 25-26',
    },
    {
      id: 'summer2026',
      label: 'Summer 2026',
      start: new Date('2026-06-01'),
      end:   new Date('2026-08-31'),
      source: 'tracker',
      cycleKey: 'summer 2026',
    },
    {
      id: 'sy2627',
      label: 'SY 26-27',
      start: new Date('2026-09-01'),
      end:   new Date('2027-06-30'),
      source: 'tracker',
      cycleKey: 'school year 26-27',
    },
  ];

  // Role categories for open-position display
  const ROLE_BUCKETS = ['Tutor', 'Site Coordinator', 'Instructional Coach', 'Dual Role'];

  // ── Date helpers ─────────────────────────────────────────────────────────────
  function parseDate(str) {
    if (!str) return null;
    // Accepts M/D/YYYY, MM/DD/YYYY, YYYY-MM-DD
    const s = str.trim();
    if (!s) return null;
    const d = new Date(s);
    return isNaN(d.getTime()) ? null : d;
  }

  function monthKey(date) {
    if (!date) return null;
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  }

  function monthLabel(key) {
    if (!key) return '';
    const [yr, mo] = key.split('-');
    const names = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return `${names[parseInt(mo, 10) - 1]} ${yr}`;
  }

  // Enumerate all months in [start, end]
  function monthsInRange(start, end) {
    const months = [];
    const cur = new Date(start.getFullYear(), start.getMonth(), 1);
    const last = new Date(end.getFullYear(), end.getMonth(), 1);
    while (cur <= last) {
      months.push(monthKey(cur));
      cur.setMonth(cur.getMonth() + 1);
    }
    return months;
  }

  // ── Employee normalization ────────────────────────────────────────────────────
  // Returns a unified employee object from tracker row or HR_EMPS entry.
  // periodStart is the cycle start date, used as fallback when offerAccepted is "yes" (no date recorded).
  function normalizeTrackerRow(row, periodStart) {
    // Pre-apprentices are NOT employees for DOL purposes
    if (row.isPreApp) return null;
    const acceptedStr = (row.offerAccepted || '').trim().toLowerCase();
    // Must have some acceptance indication
    if (!acceptedStr || acceptedStr === 'no' || acceptedStr === 'n/a') return null;
    // If it's a parseable date, use it; "yes" means accepted but date not recorded → use offerSent or period start
    let startDate = parseDate(row.offerAccepted);
    if (!startDate) {
      if (acceptedStr === 'yes') {
        startDate = parseDate(row.offerSent) || periodStart || new Date('2026-06-01');
      } else {
        return null;
      }
    }
    return {
      name:        row.fullName || `${row.firstName} ${row.lastName}`.trim(),
      role:        row.role || '',
      startDate,
      termDate:    parseDate(row.termDate) || null,
      terminated:  row.isTerminated,
      resignType:  (row.resignType || '').toLowerCase(),
      cycle:       (row.cycle || '').toLowerCase(),
      isSummer:    row.isSummer,
      isSY:        row.isSY,
    };
  }

  function normalizeHREmps() {
    // HR_EMPS field map: n=name, r=role, s=status, y=years[], py=primaryYear,
    // _termDate, _termType (Voluntary/Involuntary), _termReason, si=site, di=district
    const arr = (typeof HR_EMPS !== 'undefined') ? HR_EMPS : [];
    return arr
      .filter(e => e && e.n && e.y && e.y.includes('2025-2026'))
      .map(e => {
        const termDate = (e._termDate && e._termDate.trim()) ? parseDate(e._termDate.trim()) : null;
        // Approximate start as Sep 1 2025 — precise offer-accepted dates not in HR_EMPS
        return {
          name:       e.n,
          role:       e.r || '',
          startDate:  new Date('2025-09-01'),
          termDate,
          terminated: e.s === 'Terminated',
          resignType: (e._termType || '').toLowerCase(),
          cycle:      'school year 25-26',
          isSummer:   false,
          isSY:       true,
        };
      });
  }

  // ── Stats computation for a given month (YYYY-MM) ────────────────────────────
  // DOL definitions:
  //   totalEmployees = employees who were active at any point during the month
  //                   (start <= last day of month AND (no term OR termDate >= 1st of month))
  //   newHires       = employees whose startDate falls in this month
  //   voluntaryTerms = employees whose termDate falls in this month AND resignType includes 'volunt'
  //   involuntaryTerms = employees terminated this month AND NOT voluntary
  //   openPositions  = total authorized positions - filled (from Locations sheet, approximate)
  function computeMonthStats(employees, mk) {
    const [yr, mo] = mk.split('-').map(Number);
    const firstDay = new Date(yr, mo - 1, 1);
    const lastDay  = new Date(yr, mo, 0);

    const active = employees.filter(e => {
      if (e.startDate > lastDay) return false;
      if (e.termDate && e.termDate < firstDay) return false;
      return true;
    });

    const newHires = employees.filter(e => {
      const s = e.startDate;
      return s >= firstDay && s <= lastDay;
    });

    const termsThisMonth = employees.filter(e => {
      if (!e.termDate) return false;
      return e.termDate >= firstDay && e.termDate <= lastDay;
    });

    const voluntary   = termsThisMonth.filter(e => e.resignType.includes('volunt') || e.resignType === 'voluntary');
    const involuntary = termsThisMonth.filter(e => !e.resignType.includes('volunt') || e.resignType === 'involuntary');

    // Role breakdown of active employees
    const byRole = {};
    ROLE_BUCKETS.forEach(r => { byRole[r] = 0; });
    active.forEach(e => {
      const key = ROLE_BUCKETS.find(r => e.role.toLowerCase().includes(r.toLowerCase())) || 'Other';
      byRole[key] = (byRole[key] || 0) + 1;
    });

    return {
      mk,
      label:       monthLabel(mk),
      total:       active.length,
      newHires:    newHires.length,
      voluntary:   voluntary.length,
      involuntary: involuntary.length,
      termTotal:   termsThisMonth.length,
      byRole,
    };
  }

  // ── Open positions (from SY Locations data or fallback) ───────────────────────
  // Positions table: reads authorized positions + filled counts from the Locations sheet
  // data embedded in NJTC_LOCATIONS (if available) or falls back to the staff tracker.
  // Locations sheet columns (0-indexed from col 24):
  //   24=PreApp Spots, 25=Filled PreApp, 26=Tutor Positions, 27=Filled Tutor,
  //   28=# Apprentice Tutors, 29=SC Positions, 30=Filled SC, 31=IC Positions,
  //   32=Filled IC, 33=Dual Role Positions, 34=Filled Dual Role,
  //   35=Total staffing, 36=percent hired
  function computeOpenings(period) {
    // Prefer NJTC_LOCATIONS (parsed Locations tab) when available
    const locRows = window.NJTC_LOCATIONS;
    const cycleKey = period.cycleKey;
    const cycleMatch = cycleKey.split(' ').slice(0, 2).join(' ').toLowerCase();

    if (locRows && locRows.length) {
      const filtered = locRows.filter(r =>
        (r.cycle || '').toLowerCase().includes(cycleMatch)
      );
      if (filtered.length) {
        const buckets = {};
        ROLE_BUCKETS.forEach(r => { buckets[r] = { filled: 0, total: 0 }; });
        const num = v => { const n = parseInt((v || '').toString().replace(/[^0-9.]/g, ''), 10); return isNaN(n) ? 0 : n; };
        filtered.forEach(r => {
          buckets['Tutor'].total           += num(r.tutorPositions);
          buckets['Tutor'].filled          += num(r.filledTutorPositions);
          buckets['Site Coordinator'].total  += num(r.scPositions);
          buckets['Site Coordinator'].filled += num(r.filledScPositions);
          buckets['Instructional Coach'].total  += num(r.icPositions);
          buckets['Instructional Coach'].filled += num(r.filledIcPositions);
          buckets['Dual Role'].total  += num(r.dualRolePositions);
          buckets['Dual Role'].filled += num(r.filledDualRolePositions);
        });
        return buckets;
      }
    }

    // Fallback: use staff tracker rows (each active row = 1 filled position)
    const tracker = window.NJTC_ONSITE_TRACKER;
    if (!tracker || !tracker.length) return null;
    const rows = tracker.filter(r =>
      (r.cycle || '').toLowerCase().includes(cycleMatch)
    );
    if (!rows.length) return null;

    const buckets = {};
    ROLE_BUCKETS.forEach(r => { buckets[r] = { filled: 0, total: 0 }; });
    rows.forEach(r => {
      if (r.isPreApp) return;
      const roleKey = ROLE_BUCKETS.find(b => (r.role || '').toLowerCase().includes(b.toLowerCase()));
      if (!roleKey) return;
      // In fallback mode, every row is a total position; active = filled
      buckets[roleKey].total++;
      if (r.isActive && !r.isTerminated) buckets[roleKey].filled++;
    });
    return buckets;
  }

  // ── Render helpers ────────────────────────────────────────────────────────────
  function statCard(label, value, sub, color) {
    color = color || 'var(--navy)';
    return `
      <div style="background:var(--surface);border:1.5px solid var(--border);border-radius:10px;padding:1.25rem 1rem;text-align:center;min-width:130px;flex:1">
        <div style="font-size:2rem;font-weight:800;color:${color};line-height:1">${value}</div>
        <div style="font-size:.75rem;font-weight:700;color:var(--navy);margin-top:.35rem;text-transform:uppercase;letter-spacing:.05em">${label}</div>
        ${sub ? `<div style="font-size:.7rem;color:var(--muted);margin-top:.2rem">${sub}</div>` : ''}
      </div>`;
  }

  function renderMonthCard(stat, isSelected) {
    const border = isSelected ? '2px solid var(--accent)' : '1.5px solid var(--border)';
    const bg     = isSelected ? 'rgba(37,99,235,.06)' : 'var(--surface)';
    return `
      <div style="background:${bg};border:${border};border-radius:10px;padding:1.125rem 1rem;margin-bottom:.75rem">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:.875rem">
          <span style="font-size:.9rem;font-weight:800;color:var(--navy)">${stat.label}</span>
          ${stat.newHires > 0 ? `<span style="font-size:.7rem;font-weight:700;padding:.2rem .6rem;background:rgba(16,185,129,.12);color:#065f46;border-radius:20px">+${stat.newHires} new hire${stat.newHires > 1 ? 's' : ''}</span>` : ''}
        </div>
        <div style="display:flex;gap:.75rem;flex-wrap:wrap">
          ${statCard('Total Employees', stat.total, 'prev. month', 'var(--navy)')}
          ${statCard('New Hires', stat.newHires, 'this month', '#059669')}
          ${statCard('Voluntary Terms', stat.voluntary, '', '#d97706')}
          ${statCard('Involuntary Terms', stat.involuntary, '', '#dc2626')}
        </div>
      </div>`;
  }

  function renderOpeningsTable(openings) {
    if (!openings) return '<p style="color:var(--muted);font-size:.85rem">Open position data requires Tracker data to be loaded.</p>';
    const rows = ROLE_BUCKETS.map(r => {
      const d = openings[r] || { filled: 0, total: 0 };
      const open = Math.max(0, d.total - d.filled);
      return `<tr>
        <td style="padding:.5rem .75rem;font-weight:600;color:var(--navy)">${r}</td>
        <td style="padding:.5rem .75rem;text-align:center">${d.total}</td>
        <td style="padding:.5rem .75rem;text-align:center;color:#059669">${d.filled}</td>
        <td style="padding:.5rem .75rem;text-align:center;color:${open > 0 ? '#dc2626' : '#059669'};font-weight:700">${open}</td>
      </tr>`;
    }).join('');
    return `
      <table style="width:100%;border-collapse:collapse;font-size:.85rem">
        <thead>
          <tr style="border-bottom:2px solid var(--border)">
            <th style="padding:.5rem .75rem;text-align:left;color:var(--muted);font-size:.72rem;text-transform:uppercase;letter-spacing:.06em">Role</th>
            <th style="padding:.5rem .75rem;text-align:center;color:var(--muted);font-size:.72rem;text-transform:uppercase;letter-spacing:.06em">Positions</th>
            <th style="padding:.5rem .75rem;text-align:center;color:var(--muted);font-size:.72rem;text-transform:uppercase;letter-spacing:.06em">Filled</th>
            <th style="padding:.5rem .75rem;text-align:center;color:var(--muted);font-size:.72rem;text-transform:uppercase;letter-spacing:.06em">Vacancies</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>`;
  }

  // ── CSV export ────────────────────────────────────────────────────────────────
  function exportCSV(stats, periodLabel) {
    const rows = [
      ['Period', 'Month', 'Total Employees', 'New Hires', 'Voluntary Terminations', 'Involuntary Terminations', 'Total Terminations'],
      ...stats.map(s => [periodLabel, s.label, s.total, s.newHires, s.voluntary, s.involuntary, s.termTotal]),
    ];
    const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `NJTC_DOL_Report_${periodLabel.replace(/\s+/g,'_')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // ── PDF export ────────────────────────────────────────────────────────────────
  function exportPDF(stats, periodLabel, openings) {
    const rows = stats.map(s => `
      <tr>
        <td>${s.label}</td>
        <td style="text-align:center">${s.total}</td>
        <td style="text-align:center;color:#059669">${s.newHires}</td>
        <td style="text-align:center;color:#d97706">${s.voluntary}</td>
        <td style="text-align:center;color:#dc2626">${s.involuntary}</td>
        <td style="text-align:center">${s.termTotal}</td>
      </tr>`).join('');

    const openRows = openings ? ROLE_BUCKETS.map(r => {
      const d = openings[r] || { filled: 0, total: 0 };
      const open = Math.max(0, d.total - d.filled);
      return `<tr><td>${r}</td><td style="text-align:center">${d.total}</td><td style="text-align:center">${d.filled}</td><td style="text-align:center;color:${open>0?'#dc2626':'#059669'}">${open}</td></tr>`;
    }).join('') : '';

    const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>NJTC DOL Monthly Employment Report — ${periodLabel}</title>
<style>
  body { font-family: 'Helvetica Neue', Arial, sans-serif; color: #1e293b; margin: 0; padding: 2rem; font-size: 12px; }
  .header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 2rem; padding-bottom: 1rem; border-bottom: 3px solid #1e3a5f; }
  .logo { font-size: 1.25rem; font-weight: 800; color: #1e3a5f; letter-spacing: -.02em; }
  .subtitle { font-size: .75rem; color: #64748b; }
  h2 { font-size: 1rem; font-weight: 700; color: #1e3a5f; margin: 1.5rem 0 .75rem; text-transform: uppercase; letter-spacing: .06em; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 2rem; }
  th { background: #1e3a5f; color: #fff; padding: .5rem .75rem; text-align: left; font-size: .7rem; text-transform: uppercase; letter-spacing: .06em; }
  td { padding: .45rem .75rem; border-bottom: 1px solid #e2e8f0; }
  tr:nth-child(even) td { background: #f8fafc; }
  .footer { margin-top: 2rem; padding-top: 1rem; border-top: 1px solid #e2e8f0; font-size: .7rem; color: #94a3b8; }
  .note { background: #f0f9ff; border-left: 3px solid #0ea5e9; padding: .5rem .75rem; font-size: .72rem; color: #0369a1; margin-bottom: 1.5rem; }
</style>
</head>
<body>
  <div class="header">
    <div>
      <div class="logo">New Jersey Tutoring Corps</div>
      <div class="subtitle">DOL Monthly Employment Report &mdash; ${periodLabel}</div>
    </div>
    <div class="subtitle">Generated: ${new Date().toLocaleDateString('en-US', {year:'numeric',month:'long',day:'numeric'})}</div>
  </div>
  <div class="note">Pre-apprentices are not counted as employees. Tutor Apprentices are employees. Total employees = previous month snapshot (not cycle-to-date cumulative).</div>
  <h2>Monthly Employment Summary</h2>
  <table>
    <thead>
      <tr>
        <th>Month</th>
        <th>Total Employees</th>
        <th>New Hires</th>
        <th>Voluntary Terms</th>
        <th>Involuntary Terms</th>
        <th>Total Terminations</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
  ${openings ? `<h2>Positions by Role</h2>
  <table>
    <thead><tr><th>Role</th><th>Positions</th><th>Filled</th><th>Vacancies</th></tr></thead>
    <tbody>${openRows}</tbody>
  </table>` : ''}
  <div class="footer">
    NJTC Central Team Portal &bull; Confidential — For internal DOL reporting use only
  </div>
</body>
</html>`;

    const win = window.open('', '_blank');
    if (!win) { alert('Pop-up blocked. Please allow pop-ups for this site and try again.'); return; }
    win.document.write(html);
    win.document.close();
    setTimeout(() => { win.print(); }, 600);
  }

  // ── Main render ───────────────────────────────────────────────────────────────
  window.renderDOLReport = function renderDOLReport(container) {
    if (!container) return;

    let _activePeriodId = PERIODS.find(p => p.id === 'summer2026') ? 'summer2026' : 'sy2627';
    // default to current period based on today's date
    const today = new Date();
    for (const p of PERIODS) {
      if (today >= p.start && today <= p.end) { _activePeriodId = p.id; break; }
    }

    function getEmployees(period) {
      if (period.source === 'hr_emps') {
        return normalizeHREmps();
      }
      const tracker = window.NJTC_ONSITE_TRACKER;
      if (!tracker || !tracker.length) return [];
      const ck = period.cycleKey;
      const cycleMatch = ck.split(' ').slice(0, 2).join(' ');
      return tracker
        .filter(r => (r.cycle || '').toLowerCase().includes(cycleMatch))
        .map(r => normalizeTrackerRow(r, period.start))
        .filter(Boolean);
    }

    function render() {
      const period    = PERIODS.find(p => p.id === _activePeriodId);
      const employees = getEmployees(period);
      const months    = monthsInRange(period.start, period.end);
      const stats     = months.map(mk => computeMonthStats(employees, mk));
      const openings  = period.source === 'tracker' ? computeOpenings(period) : null;

      // Period buttons
      const periodBtns = PERIODS.map(p =>
        `<button class="pst-tab${p.id === _activePeriodId ? ' active' : ''}" onclick="window.__dolSetPeriod('${p.id}')" style="font-size:.8rem">${p.label}</button>`
      ).join('');

      // Month rows
      const monthRows = stats.map(s => renderMonthCard(s, false)).join('');

      container.innerHTML = `
        <div style="padding:.5rem 0 1.5rem">
          <!-- Header -->
          <div style="display:flex;align-items:flex-start;justify-content:space-between;flex-wrap:wrap;gap:.75rem;margin-bottom:1.25rem">
            <div>
              <div style="font-size:1.05rem;font-weight:800;color:var(--navy);margin-bottom:.25rem">📊 DOL Monthly Employment Report</div>
              <div style="font-size:.78rem;color:var(--muted)">Monthly snapshot for U.S. Department of Labor data collection. Pre-apprentices excluded.</div>
            </div>
            <div style="display:flex;gap:.5rem;flex-wrap:wrap">
              <button onclick="window.__dolExportCSV()" style="font-size:.78rem;padding:.45rem .9rem;background:var(--surface);border:1.5px solid var(--border);border-radius:8px;cursor:pointer;font-weight:600;color:var(--navy)">⬇ CSV</button>
              <button onclick="window.__dolExportPDF()" style="font-size:.78rem;padding:.45rem .9rem;background:var(--accent);color:#fff;border:none;border-radius:8px;cursor:pointer;font-weight:700">🖨 PDF Report</button>
            </div>
          </div>

          <!-- Period selector -->
          <div style="display:flex;gap:.5rem;align-items:center;margin-bottom:1.5rem;flex-wrap:wrap">
            <span style="font-size:.72rem;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.07em">Period</span>
            ${periodBtns}
          </div>

          <!-- Summary strip -->
          <div style="display:flex;gap:.75rem;flex-wrap:wrap;margin-bottom:1.5rem">
            ${statCard('Total Positions', employees.length, period.label, 'var(--navy)')}
            ${statCard('Total New Hires', stats.reduce((a,s)=>a+s.newHires,0), 'across period', '#059669')}
            ${statCard('Total Voluntary', stats.reduce((a,s)=>a+s.voluntary,0), 'resignations', '#d97706')}
            ${statCard('Total Involuntary', stats.reduce((a,s)=>a+s.involuntary,0), 'terminations', '#dc2626')}
          </div>

          <!-- Month-by-month -->
          <div style="margin-bottom:1.75rem">
            <div style="font-size:.78rem;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.07em;margin-bottom:.75rem">Month-by-Month Breakdown</div>
            ${monthRows || '<p style="color:var(--muted);font-size:.85rem">No data available for this period.</p>'}
          </div>

          <!-- Open positions -->
          <div>
            <div style="font-size:.78rem;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.07em;margin-bottom:.75rem">Open Positions by Role</div>
            <div style="background:var(--surface);border:1.5px solid var(--border);border-radius:10px;padding:1rem">
              ${renderOpeningsTable(openings)}
            </div>
            ${period.source === 'tracker' && !window.NJTC_ONSITE_TRACKER ? '<p style="color:#d97706;font-size:.78rem;margin-top:.5rem">⚠ Tracker not loaded — switch to SY 26-27 in Site Analytics to load it, then return here.</p>' : ''}
          </div>
        </div>`;

      // Wire up callbacks with current closure state
      window.__dolSetPeriod = function(id) {
        _activePeriodId = id;
        render();
      };
      window.__dolExportCSV = function() {
        const p2 = PERIODS.find(p => p.id === _activePeriodId);
        exportCSV(stats, p2.label);
      };
      window.__dolExportPDF = function() {
        const p2 = PERIODS.find(p => p.id === _activePeriodId);
        exportPDF(stats, p2.label, openings);
      };
    }

    render();
  };
})();
