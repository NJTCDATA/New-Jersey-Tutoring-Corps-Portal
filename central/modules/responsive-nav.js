/* ============================================================================
   NJTC Central — responsive navigation (phones & tablets)
   ≤1024px: the sidebar becomes a slide-out drawer opened from a ☰ button in
   the top nav, so content starts at the top of the screen instead of below a
   wall of links. Desktop layout (>1024px) is untouched.
   ============================================================================ */
(function () {
  'use strict';
  var MQ = window.matchMedia('(max-width: 1024px)');

  function nav()     { return document.querySelector('.ct-nav'); }
  function sidebar() { return document.querySelector('.ct-sidebar'); }

  // The drawer hangs from the nav's actual bottom edge (alert bars can sit above it)
  function setNavHeight() {
    var n = nav();
    if (n) document.documentElement.style.setProperty('--ct-nav-h', Math.max(0, Math.round(n.getBoundingClientRect().bottom)) + 'px');
  }

  function isOpen() { return document.body.classList.contains('ct-drawer-open'); }
  function open() {
    if (!MQ.matches) return;
    setNavHeight();
    document.body.classList.add('ct-drawer-open');
    var b = document.getElementById('ctMenuBtn'); if (b) b.setAttribute('aria-expanded', 'true');
    var s = sidebar(); if (s) s.scrollTop = 0;
  }
  function close() {
    document.body.classList.remove('ct-drawer-open');
    var b = document.getElementById('ctMenuBtn'); if (b) b.setAttribute('aria-expanded', 'false');
  }
  function toggle() { isOpen() ? close() : open(); }

  function init() {
    var n = nav(); if (!n || document.getElementById('ctMenuBtn')) return;
    var btn = document.createElement('button');
    btn.id = 'ctMenuBtn';
    btn.type = 'button';
    btn.className = 'ct-menu-btn';
    btn.setAttribute('aria-label', 'Open menu');
    btn.setAttribute('aria-expanded', 'false');
    btn.setAttribute('aria-controls', 'ctSidebar');
    btn.innerHTML = '<span></span><span></span><span></span>';
    btn.addEventListener('click', toggle);
    n.insertBefore(btn, n.firstChild);

    var s = sidebar(); if (s && !s.id) s.id = 'ctSidebar';
    var bd = document.createElement('div');
    bd.className = 'ct-drawer-backdrop';
    bd.addEventListener('click', close);
    document.body.appendChild(bd);

    // Choosing a destination closes the drawer
    document.addEventListener('click', function (e) {
      if (!isOpen()) return;
      var t = e.target.closest && e.target.closest('.ct-sidebar .sidebar-link, .ct-sidebar [data-panel], .ct-sidebar a[href]');
      if (t) setTimeout(close, 60);
    });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(); });
    (MQ.addEventListener ? MQ.addEventListener('change', function () { if (!MQ.matches) close(); setNavHeight(); }) : MQ.addListener(close));
    window.addEventListener('resize', setNavHeight, { passive: true });
    window.addEventListener('scroll', function () { if (isOpen()) setNavHeight(); }, { passive: true });
    if (window.ResizeObserver) new ResizeObserver(setNavHeight).observe(n);
    setNavHeight();
  }

  window.ctDrawer = { open: open, close: close, toggle: toggle };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
