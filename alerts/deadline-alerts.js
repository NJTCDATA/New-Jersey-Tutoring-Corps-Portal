/**
 * NJTC Portal — Deadline Alert System  v1.0
 * ─────────────────────────────────────────────────────────────────
 * Reads tasks from AsanaService, detects approaching deadlines,
 * and renders toast notifications + a modal detail view.
 *
 * THRESHOLDS: 90 days (info), 60 days (caution), 30 days (urgent)
 *
 * USAGE (called automatically from the portal page):
 *   DeadlineAlerts.init();
 *
 * FUTURE MODULES:
 *   Other components can call DeadlineAlerts.showToast(config) to
 *   display a notification without going through Asana. This makes
 *   the toast system reusable for ops alerts, HR reminders, etc.
 * ─────────────────────────────────────────────────────────────────
 */

const DeadlineAlerts = (() => {

  // ── Threshold definitions (easy to add more later) ──────────────
  const THRESHOLDS = [
    { days: 30, label: 'Urgent',    color: '#dc3545', bg: 'rgba(220,53,69,0.08)',  border: 'rgba(220,53,69,0.3)',  icon: '🔴' },
    { days: 60, label: 'Caution',   color: '#f59e0b', bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.3)', icon: '🟡' },
    { days: 90, label: 'Reminder',  color: '#3b82f6', bg: 'rgba(59,130,246,0.08)', border: 'rgba(59,130,246,0.3)', icon: '🔵' },
  ];

  // localStorage key for dismissed alert IDs this session
  const DISMISSED_KEY = 'NJTC_DISMISSED_ALERTS';

  // In-memory queue of active toasts
  let _toastQueue   = [];
  let _activeToasts = [];
  let _modalTask    = null;
  let _badgeCount   = 0;

  // ── Helpers ──────────────────────────────────────────────────────

  function getDismissed() {
    try { return JSON.parse(localStorage.getItem(DISMISSED_KEY) || '[]'); } catch { return []; }
  }

  function saveDismissed(ids) {
    try { localStorage.setItem(DISMISSED_KEY, JSON.stringify(ids)); } catch {}
  }

  function dismiss(alertId) {
    const list = getDismissed();
    if (!list.includes(alertId)) { list.push(alertId); saveDismissed(list); }
  }

  function isDismissed(alertId) {
    return getDismissed().includes(alertId);
  }

  function daysUntil(dueDateStr) {
    if (!dueDateStr) return null;
    const now  = new Date(); now.setHours(0,0,0,0);
    const due  = new Date(dueDateStr + 'T00:00:00');
    return Math.round((due - now) / (1000 * 60 * 60 * 24));
  }

  function formatDate(dueDateStr) {
    if (!dueDateStr) return 'No date set';
    const d = new Date(dueDateStr + 'T00:00:00');
    return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  }

  function getThreshold(days) {
    // Returns the *most urgent* threshold the task qualifies for
    for (const t of THRESHOLDS) {
      if (days <= t.days) return t;
    }
    return null; // no threshold hit
  }

  function alertId(task, threshold) {
    // Unique ID per task + threshold combo — prevents re-firing same alert
    return `njtc-alert-${task.gid}-${threshold.days}`;
  }

  // ── Inject styles (called once on init) ─────────────────────────
  function injectStyles() {
    if (document.getElementById('njtc-alert-styles')) return;
    const style = document.createElement('style');
    style.id = 'njtc-alert-styles';
    style.textContent = `
      /* ── Alert Bell Icon ── */
      #njtc-alert-bell {
        position: fixed;
        top: 18px;
        right: 24px;
        z-index: 9000;
        background: #003366;
        color: #fff;
        border: none;
        border-radius: 50%;
        width: 44px;
        height: 44px;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        box-shadow: 0 4px 16px rgba(0,51,102,.35);
        transition: transform .2s, box-shadow .2s;
        font-size: 18px;
      }
      #njtc-alert-bell:hover { transform: scale(1.1); box-shadow: 0 6px 22px rgba(0,51,102,.45); }
      #njtc-alert-badge {
        position: absolute;
        top: -4px; right: -4px;
        background: #dc3545;
        color: #fff;
        border-radius: 50%;
        font-size: 10px;
        font-weight: 800;
        min-width: 18px; height: 18px;
        display: flex; align-items: center; justify-content: center;
        padding: 0 3px;
        display: none;
        font-family: -apple-system, sans-serif;
      }
      #njtc-alert-badge.visible { display: flex; }

      /* ── Toast Container ── */
      #njtc-toast-container {
        position: fixed;
        bottom: 24px;
        right: 24px;
        z-index: 9100;
        display: flex;
        flex-direction: column-reverse;
        gap: 12px;
        max-width: 380px;
        width: calc(100vw - 48px);
      }

      /* ── Individual Toast ── */
      .njtc-toast {
        background: #fff;
        border-radius: 14px;
        border-left: 5px solid #3b82f6;
        box-shadow: 0 8px 32px rgba(0,0,0,.14), 0 2px 8px rgba(0,0,0,.06);
        padding: 16px 16px 14px;
        animation: njtcSlideIn .35s cubic-bezier(.34,1.56,.64,1) both;
        font-family: 'Epilogue', -apple-system, sans-serif;
        position: relative;
        overflow: hidden;
      }
      .njtc-toast.removing {
        animation: njtcSlideOut .25s ease forwards;
      }
      @keyframes njtcSlideIn {
        from { opacity: 0; transform: translateX(40px) scale(.96); }
        to   { opacity: 1; transform: translateX(0) scale(1); }
      }
      @keyframes njtcSlideOut {
        to   { opacity: 0; transform: translateX(50px) scale(.94); }
      }
      .njtc-toast-urgency {
        font-size: 10px;
        font-weight: 800;
        text-transform: uppercase;
        letter-spacing: .08em;
        margin-bottom: 4px;
        display: flex;
        align-items: center;
        gap: 5px;
      }
      .njtc-toast-title {
        font-size: 13px;
        font-weight: 700;
        color: #1a1a2e;
        margin-bottom: 8px;
      }
      .njtc-toast-meta {
        font-size: 12px;
        color: #5a6475;
        line-height: 1.6;
        margin-bottom: 10px;
      }
      .njtc-toast-meta strong { color: #1a1a2e; }
      .njtc-toast-actions {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
      }
      .njtc-btn {
        font-size: 11.5px;
        font-weight: 700;
        font-family: inherit;
        padding: 5px 12px;
        border-radius: 7px;
        border: none;
        cursor: pointer;
        transition: all .15s;
      }
      .njtc-btn-primary {
        background: #003366;
        color: #fff;
      }
      .njtc-btn-primary:hover { background: #004d99; }
      .njtc-btn-secondary {
        background: #f0f4f8;
        color: #1a1a2e;
      }
      .njtc-btn-secondary:hover { background: #e2e8f0; }
      .njtc-btn-dismiss {
        background: transparent;
        color: #9aa5b4;
        padding: 5px 8px;
        margin-left: auto;
      }
      .njtc-btn-dismiss:hover { color: #dc3545; }
      .njtc-toast-close {
        position: absolute;
        top: 10px; right: 12px;
        background: none; border: none;
        font-size: 16px; color: #c4c9d4;
        cursor: pointer; line-height: 1;
      }
      .njtc-toast-close:hover { color: #5a6475; }

      /* ── Alert Panel (reopened from bell) ── */
      #njtc-alert-panel {
        position: fixed;
        top: 70px;
        right: 24px;
        z-index: 9050;
        background: #fff;
        border-radius: 16px;
        box-shadow: 0 16px 48px rgba(0,0,0,.18);
        width: 340px;
        max-width: calc(100vw - 32px);
        max-height: 70vh;
        overflow-y: auto;
        display: none;
        font-family: 'Epilogue', -apple-system, sans-serif;
      }
      #njtc-alert-panel.open { display: block; animation: njtcFadeDown .2s ease; }
      @keyframes njtcFadeDown {
        from { opacity:0; transform: translateY(-8px); }
        to   { opacity:1; transform: translateY(0); }
      }
      .njtc-panel-header {
        padding: 16px 18px 12px;
        font-size: 13px;
        font-weight: 800;
        color: #003366;
        border-bottom: 1px solid #eef1f5;
        display: flex;
        align-items: center;
        justify-content: space-between;
      }
      .njtc-panel-item {
        padding: 13px 18px;
        border-bottom: 1px solid #f0f4f8;
        cursor: pointer;
        transition: background .15s;
      }
      .njtc-panel-item:hover { background: #f8fafc; }
      .njtc-panel-item:last-child { border-bottom: none; }
      .njtc-panel-item-name {
        font-size: 12.5px;
        font-weight: 700;
        color: #1a1a2e;
        margin-bottom: 3px;
      }
      .njtc-panel-item-meta {
        font-size: 11px;
        color: #7a8494;
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .njtc-panel-dot {
        width: 8px; height: 8px;
        border-radius: 50%;
        flex-shrink: 0;
      }
      .njtc-panel-empty {
        padding: 24px 18px;
        font-size: 12.5px;
        color: #9aa5b4;
        text-align: center;
      }

      /* ── Detail Modal ── */
      #njtc-modal-overlay {
        position: fixed; inset: 0;
        background: rgba(15,20,40,.55);
        z-index: 9200;
        display: none;
        align-items: center;
        justify-content: center;
        backdrop-filter: blur(3px);
      }
      #njtc-modal-overlay.open {
        display: flex;
        animation: njtcFadeIn .2s ease;
      }
      @keyframes njtcFadeIn { from { opacity:0; } to { opacity:1; } }
      #njtc-modal {
        background: #fff;
        border-radius: 20px;
        padding: 28px;
        width: 100%;
        max-width: 460px;
        margin: 16px;
        box-shadow: 0 24px 64px rgba(0,0,0,.22);
        font-family: 'Epilogue', -apple-system, sans-serif;
        position: relative;
        animation: njtcModalUp .3s cubic-bezier(.34,1.56,.64,1);
      }
      @keyframes njtcModalUp {
        from { opacity:0; transform: translateY(20px) scale(.97); }
        to   { opacity:1; transform: translateY(0) scale(1); }
      }
      .njtc-modal-tag {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        font-size: 10.5px;
        font-weight: 800;
        text-transform: uppercase;
        letter-spacing: .08em;
        padding: 3px 9px;
        border-radius: 6px;
        margin-bottom: 12px;
      }
      .njtc-modal-title {
        font-size: 18px;
        font-weight: 800;
        color: #003366;
        margin-bottom: 16px;
        line-height: 1.3;
      }
      .njtc-modal-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 10px;
        margin-bottom: 16px;
      }
      .njtc-modal-field {
        background: #f8fafc;
        border-radius: 10px;
        padding: 10px 12px;
      }
      .njtc-modal-field-label {
        font-size: 10px;
        text-transform: uppercase;
        letter-spacing: .07em;
        color: #9aa5b4;
        font-weight: 700;
        margin-bottom: 3px;
      }
      .njtc-modal-field-value {
        font-size: 13px;
        font-weight: 700;
        color: #1a1a2e;
      }
      .njtc-modal-notes {
        background: #f8fafc;
        border-radius: 10px;
        padding: 12px 14px;
        font-size: 12.5px;
        color: #5a6475;
        line-height: 1.6;
        margin-bottom: 18px;
        max-height: 100px;
        overflow-y: auto;
      }
      .njtc-modal-actions {
        display: flex;
        gap: 10px;
      }
      .njtc-modal-close {
        position: absolute;
        top: 16px; right: 18px;
        background: #f0f4f8;
        border: none;
        border-radius: 50%;
        width: 30px; height: 30px;
        font-size: 16px;
        cursor: pointer;
        display: flex; align-items: center; justify-content: center;
        color: #5a6475;
      }
      .njtc-modal-close:hover { background: #e2e8f0; }
    `;
    document.head.appendChild(style);
  }

  // ── Build persistent DOM elements ────────────────────────────────
  function buildDOM() {
    // Bell button
    const bell = document.createElement('button');
    bell.id = 'njtc-alert-bell';
    bell.title = 'Deadline Alerts';
    bell.innerHTML = `🔔<span id="njtc-alert-badge"></span>`;
    bell.addEventListener('click', togglePanel);
    document.body.appendChild(bell);

    // Toast container
    const tc = document.createElement('div');
    tc.id = 'njtc-toast-container';
    document.body.appendChild(tc);

    // Alert panel
    const panel = document.createElement('div');
    panel.id = 'njtc-alert-panel';
    panel.innerHTML = `
      <div class="njtc-panel-header">
        <span>⏰ Upcoming Deadlines</span>
        <button class="njtc-btn njtc-btn-secondary" style="font-size:10px;padding:3px 9px" onclick="DeadlineAlerts.clearAllDismissed()">Reset</button>
      </div>
      <div id="njtc-panel-list"></div>
    `;
    document.body.appendChild(panel);

    // Modal overlay
    const overlay = document.createElement('div');
    overlay.id = 'njtc-modal-overlay';
    overlay.addEventListener('click', (e) => { if (e.target === overlay) closeModal(); });
    overlay.innerHTML = `
      <div id="njtc-modal">
        <button class="njtc-modal-close" onclick="DeadlineAlerts.closeModal()">✕</button>
        <div id="njtc-modal-content"></div>
      </div>
    `;
    document.body.appendChild(overlay);
  }

  // ── Panel toggle ─────────────────────────────────────────────────
  function togglePanel() {
    const panel = document.getElementById('njtc-alert-panel');
    panel.classList.toggle('open');
  }

  function closePanel() {
    const panel = document.getElementById('njtc-alert-panel');
    panel.classList.remove('open');
  }

  // Close panel when clicking outside
  document.addEventListener('click', (e) => {
    const bell = document.getElementById('njtc-alert-bell');
    const panel = document.getElementById('njtc-alert-panel');
    if (bell && panel && !bell.contains(e.target) && !panel.contains(e.target)) {
      closePanel();
    }
  });

  // ── Modal ────────────────────────────────────────────────────────
  function openModal(task, threshold) {
    const days     = daysUntil(task.due_on);
    const owner    = task.assignee ? task.assignee.name : 'Unassigned';
    const collabs  = task.followers
      ? task.followers.map(f => f.name).filter(n => n !== owner).join(', ') || '—'
      : '—';

    const content = document.getElementById('njtc-modal-content');
    content.innerHTML = `
      <div class="njtc-modal-tag" style="background:${threshold.bg};color:${threshold.color}">
        ${threshold.icon} ${threshold.label}
      </div>
      <div class="njtc-modal-title">${escHtml(task.name)}</div>
      <div class="njtc-modal-grid">
        <div class="njtc-modal-field">
          <div class="njtc-modal-field-label">Due Date</div>
          <div class="njtc-modal-field-value">${formatDate(task.due_on)}</div>
        </div>
        <div class="njtc-modal-field">
          <div class="njtc-modal-field-label">Days Remaining</div>
          <div class="njtc-modal-field-value" style="color:${threshold.color}">${days} days</div>
        </div>
        <div class="njtc-modal-field">
          <div class="njtc-modal-field-label">Owner</div>
          <div class="njtc-modal-field-value">${escHtml(owner)}</div>
        </div>
        <div class="njtc-modal-field">
          <div class="njtc-modal-field-label">Collaborators</div>
          <div class="njtc-modal-field-value" style="font-size:11.5px">${escHtml(collabs)}</div>
        </div>
      </div>
      ${task.notes ? `<div class="njtc-modal-notes">${escHtml(task.notes)}</div>` : ''}
      <div class="njtc-modal-actions">
        <a href="${task.permalink_url}" target="_blank" rel="noopener"
           class="njtc-btn njtc-btn-primary" style="text-decoration:none;display:inline-flex;align-items:center;gap:5px">
          ↗ Open in Asana
        </a>
        <button class="njtc-btn njtc-btn-secondary" onclick="DeadlineAlerts.closeModal()">Close</button>
      </div>
    `;
    document.getElementById('njtc-modal-overlay').classList.add('open');
  }

  function closeModal() {
    document.getElementById('njtc-modal-overlay').classList.remove('open');
  }

  // ── Badge update ─────────────────────────────────────────────────
  function updateBadge(count) {
    _badgeCount = count;
    const badge = document.getElementById('njtc-alert-badge');
    if (!badge) return;
    badge.textContent = count;
    badge.classList.toggle('visible', count > 0);
  }

  // ── Show a single toast ──────────────────────────────────────────
  function showToast(task, threshold) {
    const id    = alertId(task, threshold);
    const days  = daysUntil(task.due_on);
    const owner = task.assignee ? task.assignee.name : 'Unassigned';

    const container = document.getElementById('njtc-toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = 'njtc-toast';
    toast.dataset.alertId = id;
    toast.style.borderLeftColor = threshold.color;

    toast.innerHTML = `
      <button class="njtc-toast-close" title="Close">✕</button>
      <div class="njtc-toast-urgency" style="color:${threshold.color}">
        ${threshold.icon} Upcoming Deadline &mdash; ${threshold.label}
      </div>
      <div class="njtc-toast-title">${escHtml(task.name)}</div>
      <div class="njtc-toast-meta">
        <strong>Owner:</strong> ${escHtml(owner)}<br>
        <strong>Deadline:</strong> ${formatDate(task.due_on)}<br>
        <strong>Countdown:</strong> <span style="color:${threshold.color};font-weight:700">${days} Days Remaining</span>
      </div>
      <div class="njtc-toast-actions">
        <button class="njtc-btn njtc-btn-primary njtc-details-btn">View Details</button>
        <a href="${task.permalink_url}" target="_blank" rel="noopener"
           class="njtc-btn njtc-btn-secondary" style="text-decoration:none">Open in Asana ↗</a>
        <button class="njtc-btn njtc-btn-dismiss">Dismiss</button>
      </div>
    `;

    // Wire buttons
    toast.querySelector('.njtc-toast-close').addEventListener('click', () => removeToast(toast, id, false));
    toast.querySelector('.njtc-btn-dismiss').addEventListener('click', () => removeToast(toast, id, true));
    toast.querySelector('.njtc-details-btn').addEventListener('click', () => { openModal(task, threshold); closePanel(); });

    container.appendChild(toast);
    _activeToasts.push({ id, task, threshold });
    updateBadge(_activeToasts.length);

    // Auto-dismiss after 60 seconds (non-urgent) or 2 min (urgent)
    const autoMs = threshold.days <= 30 ? 120000 : 60000;
    setTimeout(() => {
      if (toast.parentNode) removeToast(toast, id, false);
    }, autoMs);
  }

  function removeToast(toast, id, permanentDismiss) {
    toast.classList.add('removing');
    setTimeout(() => {
      toast.remove();
      _activeToasts = _activeToasts.filter(t => t.id !== id);
      updateBadge(_activeToasts.length);
    }, 250);
    if (permanentDismiss) dismiss(id);
  }

  // ── Panel list render ────────────────────────────────────────────
  function renderPanel(alertItems) {
    const list = document.getElementById('njtc-panel-list');
    if (!list) return;
    if (!alertItems.length) {
      list.innerHTML = '<div class="njtc-panel-empty">No upcoming deadlines in the next 90 days.</div>';
      return;
    }
    list.innerHTML = alertItems.map(({ task, threshold, days }) => `
      <div class="njtc-panel-item" data-gid="${task.gid}">
        <div class="njtc-panel-item-name">${escHtml(task.name)}</div>
        <div class="njtc-panel-item-meta">
          <span class="njtc-panel-dot" style="background:${threshold.color}"></span>
          ${formatDate(task.due_on)} &bull; <span style="color:${threshold.color};font-weight:700">${days}d</span>
        </div>
      </div>
    `).join('');

    // Wire panel item clicks to modal
    list.querySelectorAll('.njtc-panel-item').forEach(item => {
      item.addEventListener('click', () => {
        const match = alertItems.find(a => a.task.gid === item.dataset.gid);
        if (match) { openModal(match.task, match.threshold); closePanel(); }
      });
    });
  }

  // ── Process tasks from Asana ─────────────────────────────────────
  function processTasks(tasks) {
    const alertItems = []; // all qualifying alerts (for panel)

    tasks.forEach(task => {
      if (task.completed) return;        // skip done tasks
      if (!task.due_on) return;          // skip tasks with no due date

      const days = daysUntil(task.due_on);
      if (days === null || days < 0) return; // past due — skip (or handle separately)

      const threshold = getThreshold(days);
      if (!threshold) return;            // outside all windows

      const id = alertId(task, threshold);
      alertItems.push({ task, threshold, days, id });

      // Show toast only if not dismissed and not already showing
      if (!isDismissed(id) && !_activeToasts.find(t => t.id === id)) {
        showToast(task, threshold);
      }
    });

    // Sort panel by days ascending (most urgent first)
    alertItems.sort((a, b) => a.days - b.days);
    renderPanel(alertItems);
  }

  // ── Utility ──────────────────────────────────────────────────────
  function escHtml(str) {
    if (!str) return '';
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  // ── Public: clear dismissed list (Reset button in panel) ─────────
  function clearAllDismissed() {
    try { localStorage.removeItem(DISMISSED_KEY); } catch {}
    alert('Dismissed alerts reset. They will reappear on next refresh.');
  }

  // ── Init ─────────────────────────────────────────────────────────
  function init() {
    injectStyles();
    buildDOM();

    // Start polling Asana and process tasks on each update
    if (typeof AsanaService !== 'undefined') {
      AsanaService.startPolling(processTasks);
    } else {
      console.warn('[NJTC Alerts] AsanaService not loaded. Check script order.');
    }
  }

  return { init, showToast, openModal, closeModal, clearAllDismissed };
})();
