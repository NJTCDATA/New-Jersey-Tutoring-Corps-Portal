/**
 * deadline-alerts.js
 * NJTC Portal — Deadline Alert Banner with Expandable Task Detail Panel
 * Depends on: asana-service.js (NJTCAsana)
 */

(async () => {
  if (document.readyState === 'loading') {
    await new Promise(r => document.addEventListener('DOMContentLoaded', r));
  }

  await NJTCAsana.load();

  const overdue  = NJTCAsana.getOverdue();
  const upcoming = NJTCAsana.getUpcoming(7).filter(t => !overdue.find(o => o.gid === t.gid));

  if (overdue.length === 0 && upcoming.length === 0) return;

  const isRed = overdue.length > 0;

  // ── Inject styles ──────────────────────────────────────────────────────────
  const style = document.createElement('style');
  style.textContent = `
    #njtc-alert-root {
      position: fixed;
      top: 0; left: 0; right: 0;
      z-index: 9999;
      font-family: 'Epilogue', -apple-system, sans-serif;
    }

    #njtc-alert-banner {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: .5rem 1.25rem;
      background: ${isRed ? '#991b1b' : '#92400e'};
      color: #fff;
      font-size: .8125rem;
      font-weight: 600;
      cursor: pointer;
      user-select: none;
      gap: 1rem;
      transition: background .15s;
    }
    #njtc-alert-banner:hover {
      background: ${isRed ? '#7f1d1d' : '#78350f'};
    }

    #njtc-alert-banner-left {
      display: flex;
      align-items: center;
      gap: .625rem;
      flex: 1;
      min-width: 0;
    }

    #njtc-alert-badge {
      display: inline-flex;
      align-items: center;
      gap: .375rem;
      background: rgba(255,255,255,.15);
      border-radius: 20px;
      padding: .2rem .625rem;
      font-size: .75rem;
      font-weight: 700;
      white-space: nowrap;
      flex-shrink: 0;
    }

    #njtc-alert-summary {
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      opacity: .9;
    }

    #njtc-alert-banner-right {
      display: flex;
      align-items: center;
      gap: .75rem;
      flex-shrink: 0;
    }

    #njtc-alert-toggle {
      display: flex;
      align-items: center;
      gap: .3rem;
      font-size: .75rem;
      font-weight: 700;
      opacity: .85;
      white-space: nowrap;
      text-decoration: underline;
      text-underline-offset: 2px;
    }

    #njtc-alert-chevron {
      display: inline-block;
      transition: transform .2s ease;
      font-style: normal;
      font-size: .7rem;
    }
    #njtc-alert-root.open #njtc-alert-chevron {
      transform: rotate(180deg);
    }

    #njtc-alert-dismiss {
      background: none;
      border: none;
      color: #fff;
      font-size: 1rem;
      font-weight: 700;
      cursor: pointer;
      padding: 0;
      opacity: .7;
      line-height: 1;
      transition: opacity .15s;
    }
    #njtc-alert-dismiss:hover { opacity: 1; }

    /* ── Detail panel ── */
    #njtc-alert-panel {
      background: #fff;
      border-bottom: 3px solid ${isRed ? '#991b1b' : '#92400e'};
      box-shadow: 0 8px 24px rgba(0,0,0,.12);
      max-height: 0;
      overflow: hidden;
      transition: max-height .25s ease;
    }
    #njtc-alert-root.open #njtc-alert-panel {
      max-height: 400px;
    }

    #njtc-alert-panel-inner {
      padding: .875rem 1.25rem 1rem;
    }

    #njtc-alert-panel h4 {
      font-size: .6875rem;
      font-weight: 800;
      letter-spacing: .08em;
      text-transform: uppercase;
      color: ${isRed ? '#991b1b' : '#92400e'};
      margin: 0 0 .625rem;
    }

    .njtc-task-row {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 1rem;
      padding: .5rem .625rem;
      border-radius: 8px;
      transition: background .12s;
    }
    .njtc-task-row:hover {
      background: #f8f9fa;
    }
    .njtc-task-row + .njtc-task-row {
      border-top: 1px solid #f0f0f0;
    }

    .njtc-task-info {
      flex: 1;
      min-width: 0;
    }

    .njtc-task-name {
      font-size: .8125rem;
      font-weight: 600;
      color: #1a1a2e;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .njtc-task-due {
      font-size: .6875rem;
      font-weight: 600;
      margin-top: .15rem;
      color: ${isRed ? '#dc2626' : '#d97706'};
    }

    .njtc-task-link {
      display: inline-flex;
      align-items: center;
      gap: .3rem;
      font-size: .6875rem;
      font-weight: 700;
      color: #003366;
      text-decoration: none;
      white-space: nowrap;
      padding: .25rem .625rem;
      border: 1.5px solid #003366;
      border-radius: 6px;
      transition: all .15s;
      flex-shrink: 0;
    }
    .njtc-task-link:hover {
      background: #003366;
      color: #fff;
    }

    #njtc-alert-panel-footer {
      margin-top: .75rem;
      padding-top: .625rem;
      border-top: 1px solid #eee;
      display: flex;
      justify-content: flex-end;
    }

    #njtc-open-asana {
      display: inline-flex;
      align-items: center;
      gap: .375rem;
      font-size: .75rem;
      font-weight: 700;
      color: #fff;
      background: #003366;
      border: none;
      border-radius: 8px;
      padding: .4375rem .875rem;
      cursor: pointer;
      text-decoration: none;
      transition: background .15s;
    }
    #njtc-open-asana:hover {
      background: #004d99;
    }
  `;
  document.head.appendChild(style);

  // ── Build HTML ─────────────────────────────────────────────────────────────
  const parts = [];
  if (overdue.length > 0)  parts.push(`${overdue.length} overdue task${overdue.length > 1 ? 's' : ''}`);
  if (upcoming.length > 0) parts.push(`${upcoming.length} due within 7 days`);
  const summaryText = parts.join(' · ');

  const allAlerts = [
    ...overdue.map(t => ({ ...t, _type: 'overdue' })),
    ...upcoming.map(t => ({ ...t, _type: 'upcoming' }))
  ];

  function formatDue(due_on, type) {
    const d = new Date(due_on + 'T00:00:00');
    const label = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    return type === 'overdue' ? `⚠ Overdue · Was due ${label}` : `Due ${label}`;
  }

  const taskRows = allAlerts.map(t => `
    <div class="njtc-task-row">
      <div class="njtc-task-info">
        <div class="njtc-task-name" title="${t.name.trim()}">${t.name.trim()}</div>
        <div class="njtc-task-due">${formatDue(t.due_on, t._type)}</div>
      </div>
      <a class="njtc-task-link" href="${t.permalink_url}" target="_blank" rel="noopener">
        View in Asana ↗
      </a>
    </div>
  `).join('');

  const root = document.createElement('div');
  root.id = 'njtc-alert-root';
  root.innerHTML = `
    <div id="njtc-alert-banner">
      <div id="njtc-alert-banner-left">
        <span id="njtc-alert-badge">
          ${isRed ? '🔴' : '⚠️'} ${allAlerts.length}
        </span>
        <span id="njtc-alert-summary">${summaryText}</span>
      </div>
      <div id="njtc-alert-banner-right">
        <span id="njtc-alert-toggle">See details <i id="njtc-alert-chevron">▾</i></span>
        <button id="njtc-alert-dismiss" title="Dismiss">✕</button>
      </div>
    </div>
    <div id="njtc-alert-panel">
      <div id="njtc-alert-panel-inner">
        <h4>${isRed ? 'Overdue & Upcoming Tasks' : 'Upcoming Tasks'}</h4>
        ${taskRows}
        <div id="njtc-alert-panel-footer">
          <a id="njtc-open-asana" href="https://app.asana.com/0/1211431518555737/list" target="_blank" rel="noopener">
            Open Full Project in Asana ↗
          </a>
        </div>
      </div>
    </div>
  `;

  document.body.prepend(root);
  document.body.style.paddingTop = '36px';

  // ── Interactions ───────────────────────────────────────────────────────────
  const banner  = root.querySelector('#njtc-alert-banner');
  const dismiss = root.querySelector('#njtc-alert-dismiss');
  const toggle  = root.querySelector('#njtc-alert-toggle');

  banner.addEventListener('click', (e) => {
    if (e.target === dismiss || dismiss.contains(e.target)) return;
    root.classList.toggle('open');
    toggle.querySelector('span') && null;
    // Update padding when panel opens/closes
    setTimeout(() => {
      document.body.style.paddingTop = root.offsetHeight + 'px';
    }, 260);
  });

  dismiss.addEventListener('click', (e) => {
    e.stopPropagation();
    root.remove();
    document.body.style.paddingTop = '0';
  });

  console.log(`[NJTC Alerts] Banner rendered — ${overdue.length} overdue, ${upcoming.length} upcoming`);
})();
