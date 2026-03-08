/**
 * deadline-alerts.js
 * NJTC Portal — Deadline Alert Banner
 * Depends on: asana-service.js (NJTCAsana)
 * Injects an alert banner at the top of the page when tasks are due soon or overdue.
 */

(async () => {
  // Wait for DOM
  if (document.readyState === 'loading') {
    await new Promise(r => document.addEventListener('DOMContentLoaded', r));
  }

  // Load tasks
  await NJTCAsana.load();

  const overdue  = NJTCAsana.getOverdue();
  const upcoming = NJTCAsana.getUpcoming(7).filter(t => !overdue.includes(t));

  if (overdue.length === 0 && upcoming.length === 0) return;

  // Build banner
  const banner = document.createElement('div');
  banner.id = 'njtc-deadline-banner';
  banner.style.cssText = `
    position: fixed;
    top: 0; left: 0; right: 0;
    z-index: 9999;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    padding: .625rem 1.25rem;
    font-family: 'Epilogue', -apple-system, sans-serif;
    font-size: .875rem;
    font-weight: 600;
    color: #fff;
    background: ${overdue.length > 0 ? '#b91c1c' : '#b45309'};
    box-shadow: 0 2px 8px rgba(0,0,0,.2);
    cursor: pointer;
  `;

  // Message
  const parts = [];
  if (overdue.length > 0)  parts.push(`🔴 ${overdue.length} overdue task${overdue.length > 1 ? 's' : ''}`);
  if (upcoming.length > 0) parts.push(`⚠️ ${upcoming.length} task${upcoming.length > 1 ? 's' : ''} due within 7 days`);

  const msg = document.createElement('span');
  msg.textContent = parts.join('   ·   ') + '  — Click to view in Asana';

  // Dismiss button
  const close = document.createElement('button');
  close.textContent = '✕';
  close.style.cssText = `
    background: none; border: none; color: #fff;
    font-size: 1rem; font-weight: 700;
    cursor: pointer; padding: 0 .25rem; line-height: 1;
    opacity: .8;
  `;
  close.addEventListener('click', e => {
    e.stopPropagation();
    banner.remove();
  });

  banner.appendChild(msg);
  banner.appendChild(close);

  // Click opens Asana project
  banner.addEventListener('click', () => {
    window.open('https://app.asana.com/0/1211431518555737/list', '_blank');
  });

  // Offset page content so banner doesn't overlap
  banner.addEventListener('transitionend', () => {
    document.body.style.paddingTop = banner.offsetHeight + 'px';
  });
  document.body.style.paddingTop = '40px';

  document.body.prepend(banner);
  console.log(`[NJTC Alerts] Banner rendered — ${overdue.length} overdue, ${upcoming.length} upcoming`);
})();
