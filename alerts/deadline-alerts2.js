/**
 * deadline-alerts2.js
 * NJTC Portal — Project 2 Asana Banner (Green)
 * Only renders for leadership, data, and kb (exec) departments.
 * Always visible for those depts — shows "all clear" when no tasks are urgent.
 * Stacks directly below the existing #njtc-alert-root banner.
 * Depends on: asana-service2.js (NJTCAsana2)
 */

(async () => {
  if (document.readyState === 'loading') {
    await new Promise(r => document.addEventListener('DOMContentLoaded', r));
  }

  // ── Wait for session (dept gating) ────────────────────────────────────────
  await new Promise(resolve => {
    if (window.NJTC_SESSION) { resolve(); return; }
    const t = setInterval(() => {
      if (window.NJTC_SESSION) { clearInterval(t); resolve(); }
    }, 50);
    setTimeout(() => { clearInterval(t); resolve(); }, 3000);
  });

  const dept = (window.NJTC_SESSION || {}).dept || '';
  if (!['leadership', 'data', 'kb'].includes(dept)) return;

  // ── Load tasks ─────────────────────────────────────────────────────────────
  await NJTCAsana2.load();

  const allTasks = NJTCAsana2.getTasks();
  const overdue  = NJTCAsana2.getOverdue();
  const upcoming = NJTCAsana2.getUpcoming(7).filter(t => !overdue.find(o => o.gid === t.gid));
  const allAlerts = [
    ...overdue.map(t => ({ ...t, _type: 'overdue' })),
    ...upcoming.map(t => ({ ...t, _type: 'upcoming' })),
  ];

  const hasAlerts   = allAlerts.length > 0;
  const bannerColor = overdue.length > 0 ? '#166534' : '#166534'; // always green; first banner owns red/amber

  // ── Styles ─────────────────────────────────────────────────────────────────
  const style = document.createElement('style');
  style.textContent = `
    #njtc-alert2-root {
      position: fixed;
      left: 0; right: 0;
      z-index: 9998;
      font-family: 'Epilogue', -apple-system, sans-serif;
    }

    #njtc-alert2-banner {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: .5rem 1.25rem;
      background: #166534;
      color: #fff;
      font-size: .8125rem;
      font-weight: 600;
      cursor: ${hasAlerts ? 'pointer' : 'default'};
      user-select: none;
      gap: 1rem;
      transition: background .15s;
    }
    #njtc-alert2-banner:hover { background: ${hasAlerts ? '#14532d' : '#166534'}; }

    #njtc-alert2-banner-left {
      display: flex;
      align-items: center;
      gap: .625rem;
      flex: 1;
      min-width: 0;
    }

    #njtc-alert2-badge {
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

    #njtc-alert2-summary {
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      opacity: .9;
    }

    #njtc-alert2-banner-right {
      display: flex;
      align-items: center;
      gap: .75rem;
      flex-shrink: 0;
    }

    #njtc-alert2-toggle {
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

    #njtc-alert2-chevron {
      display: inline-block;
      transition: transform .2s ease;
      font-style: normal;
      font-size: .7rem;
    }
    #njtc-alert2-root.open #njtc-alert2-chevron { transform: rotate(180deg); }

    #njtc-alert2-dismiss {
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
    #njtc-alert2-dismiss:hover { opacity: 1; }

    #njtc-alert2-panel {
      background: #fff;
      border-bottom: 3px solid #166534;
      box-shadow: 0 8px 24px rgba(0,0,0,.12);
      max-height: 0;
      overflow: hidden;
      transition: max-height .25s ease;
    }
    #njtc-alert2-root.open #njtc-alert2-panel { max-height: 420px; }

    #njtc-alert2-panel-inner { padding: .875rem 1.25rem 1rem; }

    #njtc-alert2-panel h4 {
      font-size: .6875rem;
      font-weight: 800;
      letter-spacing: .08em;
      text-transform: uppercase;
      color: #166534;
      margin: 0 0 .625rem;
    }

    .njtc-task2-row {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 1rem;
      padding: .5rem .625rem;
      border-radius: 8px;
      transition: background .12s;
    }
    .njtc-task2-row:hover { background: #f0fdf4; }
    .njtc-task2-row + .njtc-task2-row { border-top: 1px solid #f0f0f0; }

    .njtc-task2-info { flex: 1; min-width: 0; }

    .njtc-task2-name {
      font-size: .8125rem;
      font-weight: 600;
      color: #1a1a2e;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .njtc-task2-due {
      font-size: .6875rem;
      font-weight: 600;
      margin-top: .15rem;
      color: #15803d;
    }
    .njtc-task2-due.overdue { color: #dc2626; }

    .njtc-task2-link {
      display: inline-flex;
      align-items: center;
      gap: .3rem;
      font-size: .6875rem;
      font-weight: 700;
      color: #166534;
      text-decoration: none;
      white-space: nowrap;
      padding: .25rem .625rem;
      border: 1.5px solid #166534;
      border-radius: 6px;
      transition: all .15s;
      flex-shrink: 0;
    }
    .njtc-task2-link:hover { background: #166534; color: #fff; }

    #njtc-alert2-allclear {
      display: flex;
      align-items: center;
      gap: .625rem;
      padding: .625rem .5rem;
      color: #166534;
      font-size: .8125rem;
      font-weight: 600;
    }

    #njtc-alert2-panel-footer {
      margin-top: .75rem;
      padding-top: .625rem;
      border-top: 1px solid #eee;
      display: flex;
      justify-content: flex-end;
    }

    #njtc-open-asana2 {
      display: inline-flex;
      align-items: center;
      gap: .375rem;
      font-size: .75rem;
      font-weight: 700;
      color: #fff;
      background: #166534;
      border: none;
      border-radius: 8px;
      padding: .4375rem .875rem;
      cursor: pointer;
      text-decoration: none;
      transition: background .15s;
    }
    #njtc-open-asana2:hover { background: #14532d; }
  `;
  document.head.appendChild(style);

  // ── Build HTML ─────────────────────────────────────────────────────────────
  function formatDue(due_on, type) {
    const d = new Date(due_on + 'T00:00:00');
    const label = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    return type === 'overdue'
      ? `<span class="njtc-task2-due overdue">⚠ Overdue · Was due ${label}</span>`
      : `<span class="njtc-task2-due">Due ${label}</span>`;
  }

  const taskRows = allAlerts.map(t => `
    <div class="njtc-task2-row">
      <div class="njtc-task2-info">
        <div class="njtc-task2-name" title="${t.name.trim()}">${t.name.trim()}</div>
        ${formatDue(t.due_on, t._type)}
      </div>
      <a class="njtc-task2-link" href="${t.permalink_url}" target="_blank" rel="noopener">
        View in Asana ↗
      </a>
    </div>
  `).join('');

  // Banner summary text
  const badgeIcon    = hasAlerts ? (overdue.length > 0 ? '⚠️' : '📋') : '✅';
  const badgeCount   = hasAlerts ? allAlerts.length : allTasks.length;
  const summaryText  = hasAlerts
    ? [
        overdue.length  > 0 ? `${overdue.length} overdue task${overdue.length  > 1 ? 's' : ''}` : '',
        upcoming.length > 0 ? `${upcoming.length} due within 7 days`                             : '',
      ].filter(Boolean).join(' · ')
    : `All tasks on track · ${allTasks.length} open item${allTasks.length !== 1 ? 's' : ''}`;

  // Panel body: task list when alerts exist, "all clear" when quiet
  const panelBody = hasAlerts
    ? `<h4>${overdue.length > 0 ? 'Overdue & Upcoming Tasks' : 'Upcoming Tasks'}</h4>${taskRows}`
    : `<div id="njtc-alert2-allclear">
        ✅ No tasks overdue or due within the next 7 days.
        ${allTasks.length > 0 ? `<span style="font-weight:400;color:#64748b">${allTasks.length} open task${allTasks.length !== 1 ? 's' : ''} tracked in this project.</span>` : ''}
      </div>`;

  const root = document.createElement('div');
  root.id = 'njtc-alert2-root';
  root.innerHTML = `
    <div id="njtc-alert2-banner">
      <div id="njtc-alert2-banner-left">
        <span id="njtc-alert2-badge">${badgeIcon} ${badgeCount}</span>
        <span id="njtc-alert2-summary">${summaryText}</span>
      </div>
      <div id="njtc-alert2-banner-right">
        ${hasAlerts ? '<span id="njtc-alert2-toggle">See details <i id="njtc-alert2-chevron">▾</i></span>' : ''}
        <a style="font-size:.75rem;font-weight:700;color:rgba(255,255,255,.85);text-decoration:underline;text-underline-offset:2px;white-space:nowrap"
           href="https://app.asana.com/1/1202967547815613/project/1213346212277384/list/1213346212277403"
           target="_blank" rel="noopener">Open in Asana ↗</a>
        <button id="njtc-alert2-dismiss" title="Dismiss">✕</button>
      </div>
    </div>
    <div id="njtc-alert2-panel">
      <div id="njtc-alert2-panel-inner">
        ${panelBody}
        <div id="njtc-alert2-panel-footer">
          <a id="njtc-open-asana2"
             href="https://app.asana.com/1/1202967547815613/project/1213346212277384/list/1213346212277403"
             target="_blank" rel="noopener">
            Open Full Project in Asana ↗
          </a>
        </div>
      </div>
    </div>
  `;

  document.body.prepend(root);

  // ── Positioning: stack below the first banner ──────────────────────────────
  function reposition() {
    const first  = document.getElementById('njtc-alert-root');
    const firstH = first ? first.offsetHeight : 0;
    root.style.top = firstH + 'px';
    document.body.style.paddingTop = (firstH + root.offsetHeight) + 'px';
  }

  reposition();

  const firstRoot = document.getElementById('njtc-alert-root');
  if (firstRoot) {
    firstRoot.addEventListener('click', () => setTimeout(reposition, 270));
    new MutationObserver(() => reposition()).observe(document.body, { childList: true });
  }

  // ── Interactions ───────────────────────────────────────────────────────────
  const banner  = root.querySelector('#njtc-alert2-banner');
  const dismiss = root.querySelector('#njtc-alert2-dismiss');

  if (hasAlerts) {
    banner.addEventListener('click', (e) => {
      if (e.target === dismiss || dismiss.contains(e.target)) return;
      if (e.target.tagName === 'A' || e.target.closest('a')) return;
      root.classList.toggle('open');
      setTimeout(reposition, 270);
    });
  }

  dismiss.addEventListener('click', (e) => {
    e.stopPropagation();
    root.remove();
    const first = document.getElementById('njtc-alert-root');
    document.body.style.paddingTop = first ? first.offsetHeight + 'px' : '0';
  });

})();
