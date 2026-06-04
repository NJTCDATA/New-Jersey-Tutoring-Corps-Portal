(function () {
  'use strict';

  // ── Period definitions ──────────────────────────────────────────────────────
  // Each period has a label, cycle key (matches Cycle col in tracker), and
  // a date range for filtering. Month buckets within each period are derived
  // from offer-accepted / termination dates in that range.
  // NOTE: Use new Date(y, m, d) (local time) NOT ISO strings — ISO parses as UTC
  // which shifts the date back one day in US Eastern time.
  const PERIODS = [
    {
      id: 'sy2526',
      label: 'SY 25-26',
      start: new Date(2025, 6, 1),   // Jul 1, 2025 — captures early offer acceptances
      end:   new Date(2026, 5, 30),  // Jun 30, 2026
      // SY 25-26 uses HR_EMPS array (embedded + overlay); no tracker
      source: 'hr_emps',
      cycleKey: 'school year 25-26',
    },
    {
      id: 'summer2026',
      label: 'Summer 2026',
      start: new Date(2026, 4, 1),   // May 1, 2026 — captures May offer acceptances
      end:   new Date(2026, 7, 31),  // Aug 31, 2026
      source: 'tracker',
      cycleKey: 'summer 2026',
    },
    {
      id: 'sy2627',
      label: 'SY 26-27',
      start: new Date(2026, 8, 1),   // Sep 1, 2026
      end:   new Date(2027, 5, 30),  // Jun 30, 2027
      source: 'tracker',
      cycleKey: 'school year 26-27',
    },
  ];

  // ── SY 25-26 termination date overrides ────────────────────────────────────
  // Authoritative termination dates from School Year Database 2025-2026 Terminations sheet.
  // Used to fill missing or malformed _termDate values in HR_EMPS for SY 25-26 employees.
  // Keyed by lowercase "firstname lastname" (spaces normalized).
  const SY2526_TERM_DATES = {
    'evan white':                          '8/19/2025',
    'manuel algarin':                      '8/28/2025',
    'clifford evan':                       '9/5/2025',
    'janelle lee':                         '9/23/2025',
    'michael d\'alessio':                  '9/24/2025',
    'aleah mcwilliams':                    '9/25/2025',
    'takiyah jackson':                     '9/25/2025',
    'dhrupalben naseet':                   '10/3/2025',
    'ciara cosby':                         '10/9/2025',
    'shanice thomas':                      '10/9/2025',
    'joann maybury':                       '10/14/2025',
    'ka\'deasia washington':               '10/17/2025',
    'kadeasia washington':                 '10/17/2025',
    'laila modzelewski':                   '10/27/2025',
    'yohanny rosario':                     '10/31/2025',
    'claudia tumelus':                     '10/31/2025',
    'hind hamoda':                         '10/31/2025',
    'hendrix garcia':                      '11/3/2025',
    'ashley garcia':                       '11/3/2025',
    'genesis rosich':                      '11/4/2025',
    'pankajbharathi sowmianarayanan':      '11/11/2025',
    'gunjan pandya':                       '11/15/2025',
    'michelle kim':                        '11/17/2025',
    'nicole cill':                         '11/24/2025',
    'colin camp':                          '12/3/2025',
    'daniel diquinzio':                    '12/3/2025',
    'lesley waszen':                       '12/3/2025',
    'zakaria imessaoudene':                '12/8/2025',
    'davide berardi':                      '12/18/2025',
    'edwin montesdeoca':                   '12/18/2025',
    'kimara ramsey':                       '12/18/2025',
    'tanya israel-sainthilaire':           '12/18/2025',
    'tanya israel sainthilaire':           '12/18/2025',
    'jodi bianchi':                        '1/2/2026',
    'laura gallucci':                      '1/2/2026',
    'disan singleton':                     '1/7/2026',
    'kamiah shelton':                      '1/7/2026',
    'sharlene rahim':                      '1/21/2026',
    'lemuer perez de jesus':               '1/22/2026',
    'lemuer pérez de jesus':               '1/22/2026',
    'everene williams':                    '1/22/2026',
    'chandler talty':                      '1/28/2026',
    'henrika hill-joseph':                 '1/28/2026',
    'henrika hill joseph':                 '1/28/2026',
    'angelica werts':                      '1/30/2026',
    'kathryn hennigan':                    '2/1/2026',
    'katie hennigan':                      '2/1/2026',
    'jeily insuasti-torres':               '2/6/2026',
    'jeily insuasti torres':               '2/6/2026',
    'glenn harris':                        '2/6/2026',
    'victoria nachimson':                  '2/17/2026',
    'amro abdelrazek':                     '2/25/2026',
    'maureen farrell':                     '2/25/2026',
    'carolyn butler':                      '2/26/2026',
    'susan dominquez':                     '2/27/2026',
    'jenny seligman':                      '2/27/2026',
    'janice reaves':                       '3/6/2026',
    'alyssa deangelis':                    '3/9/2026',
    'colleen elam':                        '3/9/2026',
    'maria zia':                           '3/11/2026',
    'shayla hibbert':                      '3/11/2026',
    'lataiva balmer':                      '3/16/2026',
    'pia walden':                          '3/17/2026',
    'jacob leebron':                       '3/19/2026',
    'sara gonzalez':                       '3/19/2026',
    'monica brown':                        '3/23/2026',
    'brittany douglas':                    '3/23/2026',
    'daivon devard':                       '3/26/2026',
    'shakirah miller':                     '3/26/2026',
    'rebeka lange':                        '3/27/2026',
    'nicole coleman-odigie':               '3/27/2026',
    'nicole coleman odigie':               '3/27/2026',
    'jaejin lee':                          '4/8/2026',
    'abdallah abada':                      '4/13/2026',
    'apollo monroy-polanco':               '4/13/2026',
    'apollo monroy polanco':               '4/13/2026',
    'jessica flores':                      '4/17/2026',
    'monifa thomas-kelsey':                '4/21/2026',
    'monifa thomas kelsey':                '4/21/2026',
    'olga berkin':                         '4/23/2026',
    'linda fenty':                         '4/27/2026',
    'shannon spillane':                    '4/30/2026',
  };

  // ── SY 25-26 hardcoded new hire counts by month ─────────────────────────────
  // Derived from School Year Database 2025-2026 offer-accepted dates.
  // Keyed as YYYY-MM → count of new hires accepted that month.
  const SY2526_NEW_HIRE_COUNTS = {
    '2025-07':  1,
    '2025-08': 16,
    '2025-09': 12,
    '2025-10': 10,
    '2025-11':  4,
    '2025-12': 23,
    '2026-01':  5,
    '2026-02': 11,
    '2026-03':  6,
  };

  // Role categories for open-position display
  const ROLE_BUCKETS = ['Tutor', 'Site Coordinator', 'Instructional Coach', 'Dual Role'];

  // ── Date helpers ─────────────────────────────────────────────────────────────
  // All dates parsed into LOCAL time to ensure month comparisons work correctly.
  // Using new Date(str) is unreliable: ISO strings (YYYY-MM-DD) parse as UTC
  // (shifting the date in US time zones), and M/D/YYYY support varies by browser.
  function parseDate(str) {
    if (!str) return null;
    const s = str.trim();
    if (!s) return null;
    // M/D/YY, M/D/YYYY, MM/DD/YY, MM/DD/YYYY
    const mdy = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
    if (mdy) {
      let yr = parseInt(mdy[3], 10);
      if (yr < 100) yr += 2000;
      const d = new Date(yr, parseInt(mdy[1], 10) - 1, parseInt(mdy[2], 10));
      return isNaN(d.getTime()) ? null : d;
    }
    // YYYY-MM-DD — parse as local to avoid UTC offset shift
    const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (iso) {
      const d = new Date(parseInt(iso[1], 10), parseInt(iso[2], 10) - 1, parseInt(iso[3], 10));
      return isNaN(d.getTime()) ? null : d;
    }
    return null;
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
        startDate = parseDate(row.offerSent) || periodStart || new Date(2026, 5, 1);
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
    const normName = n => (n || '').toLowerCase().replace(/\s+/g, ' ').trim();
    return arr
      .filter(e => e && e.n && e.y && e.y.includes('2025-2026'))
      .map(e => {
        // Parse termDate from HR_EMPS; fall back to authoritative lookup when missing or malformed
        let termDate = (e._termDate && e._termDate.trim()) ? parseDate(e._termDate.trim()) : null;
        if (!termDate) {
          const override = SY2526_TERM_DATES[normName(e.n)];
          if (override) termDate = parseDate(override);
        }
        // Start date set to beginning of period — precise dates are overridden via SY2526_NEW_HIRE_COUNTS
        return {
          name:       e.n,
          role:       e.r || '',
          startDate:  new Date(2025, 8, 1),   // Sep 1, 2025 local
          termDate,
          terminated: e.s === 'Terminated' || !!termDate,
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
  // newHireOverride: optional map of YYYY-MM → count, used to inject hardcoded new hire data
  function computeMonthStats(employees, mk, newHireOverride) {
    const [yr, mo] = mk.split('-').map(Number);
    const firstDay = new Date(yr, mo - 1, 1);
    const lastDay  = new Date(yr, mo, 0);

    const active = employees.filter(e => {
      if (e.startDate > lastDay) return false;
      if (e.termDate && e.termDate < firstDay) return false;
      return true;
    });

    const newHiresCount = (newHireOverride && newHireOverride[mk] != null)
      ? newHireOverride[mk]
      : employees.filter(e => {
          const s = e.startDate;
          return s >= firstDay && s <= lastDay;
        }).length;

    const termsThisMonth = employees.filter(e => {
      if (!e.termDate) return false;
      if (!e.terminated) return false;   // only count rows flagged as terminated
      return e.termDate >= firstDay && e.termDate <= lastDay;
    });

    const voluntary   = termsThisMonth.filter(e => e.resignType.includes('volunt'));
    const involuntary = termsThisMonth.filter(e => !e.resignType.includes('volunt'));

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
      newHires:    newHiresCount,
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
    const cycleMatch = period.cycleKey.toLowerCase();

    if (locRows && locRows.length) {
      // Filter to this period's cycle — for SY 25-26 there's no cycle col so all rows match
      const filtered = locRows.filter(r => {
        const cy = (r.cycle || '').toLowerCase();
        return !cy || cy.includes(cycleMatch);
      });
      if (filtered.length) {
        const buckets = {};
        ROLE_BUCKETS.forEach(r => { buckets[r] = { filled: 0, total: 0 }; });
        const num = v => { const n = parseFloat((v || '').toString().replace(/[^0-9.]/g, '')); return isNaN(n) ? 0 : Math.round(n); };
        // _allSites field names: tutorPos/tutorFill, scPos/scFill, icPos/icFill, drPos/drFill
        filtered.forEach(r => {
          buckets['Tutor'].total            += num(r.tutorPos);
          buckets['Tutor'].filled           += num(r.tutorFill);
          buckets['Site Coordinator'].total  += num(r.scPos);
          buckets['Site Coordinator'].filled += num(r.scFill);
          buckets['Instructional Coach'].total  += num(r.icPos);
          buckets['Instructional Coach'].filled += num(r.icFill);
          buckets['Dual Role'].total  += num(r.drPos);
          buckets['Dual Role'].filled += num(r.drFill);
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
      const cycleMatch = period.cycleKey.toLowerCase();
      return tracker
        .filter(r => (r.cycle || '').toLowerCase().includes(cycleMatch))
        .map(r => normalizeTrackerRow(r, period.start))
        .filter(Boolean);
    }

    function render() {
      const period    = PERIODS.find(p => p.id === _activePeriodId);
      const employees = getEmployees(period);
      const months    = monthsInRange(period.start, period.end);
      const newHireOverride = period.id === 'sy2526' ? SY2526_NEW_HIRE_COUNTS : null;
      const stats     = months.map(mk => computeMonthStats(employees, mk, newHireOverride));
      // Always compute openings — NJTC_LOCATIONS is set for both SY 25-26 and 26-27/Summer
      const openings  = computeOpenings(period);

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
