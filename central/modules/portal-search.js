// ══════════════════════════════════════════════════════════════════════════════
//  PORTAL SEARCH — one box for pages, people and schools
//  🔍 in the top bar (or press "/") → type a name, school or page → go there.
//  Results follow the department view: only pages its sidebar shows, Talent tabs
//  it can open, and staff profiles only where profiles are part of that view.
// ══════════════════════════════════════════════════════════════════════════════
(function () {
  'use strict';

  const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
  const lens = () => window._currentDept || window.NJTC_VIEW_DEPT || (window.NJTC_SESSION || {}).dept || '';
  const visible = el => !!el && el.offsetParent !== null && getComputedStyle(el).display !== 'none';
  const links = () => window.njtcLinks || null;

  const TAB_LABEL = { profiles: 'Staff Profiles', all: 'Talent Overview', program: 'Programming', hr: 'HR', reviews: 'Site Leader Reviews',
                      log: 'Full Concern Log', hiring: 'Hiring Records', dol: 'DOL Report', definitions: 'Talent Definitions' };
  const TAB_WORDS = { profiles: 'people staff employee tutor', log: 'concerns full entry', dol: 'department of labor hires separations open positions', hiring: 'hire' };

  // ── What can be found ──────────────────────────────────────────────────────
  function pages() {
    const out = [];
    document.querySelectorAll('.ct-sidebar .sidebar-link[data-panel]').forEach(b => {
      if (!visible(b)) return;
      const label = b.textContent.replace(/\s+/g, ' ').replace(/\b\d+\b\s*$/, '').trim();
      out.push({ kind: 'Page', label, sub: '', go: () => links() ? links().go(b.dataset.panel === 'home' ? '#/' : '#/' + b.dataset.panel) : b.click(), words: '' });
    });
    const L = links();
    if (L && L.canOpenPanel('talent')) {
      ((window.TALENT_TAB_MAP || {})[lens()] || []).forEach(t => {
        const btn = document.getElementById('talentTab-' + t);
        out.push({ kind: 'Page', label: TAB_LABEL[t] || (btn ? btn.textContent.trim() : t), sub: 'Talent Analytics',
                   go: () => L.go('#/talent/' + t), words: TAB_WORDS[t] || '' });
      });
    }
    return out;
  }
  function people() {
    const L = links();
    if (!L || !L.canOpenProfiles()) return [];
    const curSY = typeof window._hrCurSY === 'function' ? window._hrCurSY() : '';
    const seen = new Set();
    return (window.HR_EMPS || []).filter(e => e && e.n && !seen.has(e.n) && seen.add(e.n)).map(e => {
      const y = (e._byYear || {})[curSY];
      const cur = !!y;
      return { kind: 'Person', label: e.n, sub: [cur ? y.r || e.r : e.r, cur ? (y.si || e.si) : e.si, cur ? (y.s || '') : 'past staff'].filter(Boolean).join(' · '),
               rank: cur && /^active$/i.test(y.s || '') ? 0 : cur ? 1 : 2, go: () => L.go('#/profile/' + encodeURIComponent(e.n)) };
    });
  }
  function schools() {
    const po = window.po;
    if (!po || typeof po.getFieldSupportInput !== 'function' || typeof po.drillSchool !== 'function') return [];
    if (!(links() && links().canOpenPanel('pearl-ops'))) return [];
    let names = [];
    try { names = po.getFieldSupportInput('ALL').schoolNames || []; } catch (e) {}
    return names.filter(n => n && !/^\s*(z{3}|njtc\s*$)/i.test(n)).map(n => ({ kind: 'School', label: n, sub: 'Pearl Operations',
      go: () => { links().go('#/pearl-ops'); setTimeout(() => { try { po.drillSchool(n); } catch (e) {} }, 400); } }));
  }

  function search(q) {
    const qn = norm(q);
    if (!qn) return [];
    const words = qn.split(' ');
    const score = it => {
      const l = norm(it.label), hay = l + ' ' + norm(it.sub) + ' ' + (it.words || '');
      if (!words.every(w => hay.includes(w))) return -1;
      let s = 0;
      if (l === qn) s += 100;
      if (l.startsWith(qn)) s += 50;
      if (words.every(w => (' ' + l).includes(' ' + w))) s += 25;   // each word starts a word in the name
      if (words.every(w => l.includes(w))) s += 10;
      return s - (it.rank || 0) * 5;
    };
    const groups = [['Page', pages()], ['Person', people()], ['School', schools()]];
    const out = [];
    groups.forEach(([kind, list]) => {
      list.map(it => ({ it, s: score(it) })).filter(x => x.s >= 0)
        .sort((a, b) => b.s - a.s || a.it.label.localeCompare(b.it.label))
        .slice(0, kind === 'Page' ? 6 : 8).forEach(x => out.push(x.it));
    });
    return out;
  }

  // ── UI ─────────────────────────────────────────────────────────────────────
  let _results = [], _sel = 0;
  function overlay() {
    let ov = document.getElementById('njtcSearch');
    if (ov) return ov;
    ov = document.createElement('div');
    ov.id = 'njtcSearch';
    ov.innerHTML = `<div class="ns-box" role="dialog" aria-label="Search the portal">
        <div class="ns-top"><span class="ns-ic">🔍</span>
          <input id="njtcSearchInput" type="search" autocomplete="off" spellcheck="false" placeholder="Search a name, school or page…" aria-label="Search">
          <button type="button" class="ns-x" aria-label="Close search">✕</button></div>
        <div class="ns-list" id="njtcSearchList"></div>
        <div class="ns-foot">Enter opens the top result · ↑ ↓ to move · Esc closes</div>
      </div>`;
    document.body.appendChild(ov);
    const inp = ov.querySelector('input');
    ov.addEventListener('click', e => { if (e.target === ov || e.target.closest('.ns-x')) close(); });
    inp.addEventListener('input', () => { _sel = 0; paint(inp.value); });
    inp.addEventListener('keydown', e => {
      if (e.key === 'ArrowDown') { e.preventDefault(); _sel = Math.min(_sel + 1, _results.length - 1); paint(inp.value, true); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); _sel = Math.max(_sel - 1, 0); paint(inp.value, true); }
      else if (e.key === 'Enter') { e.preventDefault(); choose(_sel); }
      else if (e.key === 'Escape') close();
    });
    ov.querySelector('.ns-list').addEventListener('click', e => { const r = e.target.closest('[data-ns]'); if (r) choose(+r.dataset.ns); });
    return ov;
  }
  function paint(q, keepResults) {
    const list = document.getElementById('njtcSearchList');
    if (!keepResults) _results = search(q);
    if (!norm(q)) { list.innerHTML = `<div class="ns-hint">Try a staff name, a school, or a page like “DOL Report”.</div>`; return; }
    if (!_results.length) { list.innerHTML = `<div class="ns-hint">No matches for “${esc(q)}”.</div>`; return; }
    let last = '';
    list.innerHTML = _results.map((r, i) => {
      const hdr = r.kind !== last ? `<div class="ns-grp">${r.kind === 'Page' ? 'Pages' : r.kind === 'Person' ? 'People' : 'Schools'}</div>` : '';
      last = r.kind;
      return hdr + `<button type="button" class="ns-row${i === _sel ? ' on' : ''}" data-ns="${i}">
        <span class="ns-k">${r.kind === 'Page' ? '📄' : r.kind === 'Person' ? '👤' : '🏫'}</span>
        <span class="ns-t"><b>${esc(r.label)}</b>${r.sub ? `<small>${esc(r.sub)}</small>` : ''}</span></button>`;
    }).join('');
    const on = list.querySelector('.ns-row.on'); if (on) on.scrollIntoView({ block: 'nearest' });
  }
  function choose(i) { const r = _results[i]; if (!r) return; close(); setTimeout(r.go, 0); }
  function open() {
    const ov = overlay();
    ov.classList.add('open');
    const inp = ov.querySelector('input');
    inp.value = ''; _results = []; _sel = 0; paint('');
    setTimeout(() => inp.focus(), 30);
  }
  function close() { const ov = document.getElementById('njtcSearch'); if (ov) ov.classList.remove('open'); }
  window.njtcSearch = { open, close, search };

  function addButton() {
    if (document.getElementById('njtcSearchBtn')) return;
    const right = document.querySelector('.ct-nav .nav-right');
    if (!right) return;
    const b = document.createElement('button');
    b.id = 'njtcSearchBtn'; b.type = 'button'; b.className = 'njtc-search-btn';
    b.title = 'Search the portal (press /)'; b.setAttribute('aria-label', 'Search the portal');
    b.innerHTML = '🔍<span> Search</span>';
    b.addEventListener('click', open);
    right.insertBefore(b, right.firstChild);
  }
  document.addEventListener('keydown', e => {
    if (e.key !== '/' || e.ctrlKey || e.metaKey || e.altKey) return;
    const t = e.target, tag = (t && t.tagName) || '';
    if (/INPUT|TEXTAREA|SELECT/.test(tag) || (t && t.isContentEditable)) return;
    if (!document.getElementById('njtcSearchBtn')) return;
    e.preventDefault(); open();
  });

  const css = document.createElement('style');
  css.textContent = `
    .njtc-search-btn{display:inline-flex;align-items:center;gap:.3rem;padding:.42rem .85rem;border-radius:999px;border:1px solid rgba(255,255,255,.22);background:rgba(255,255,255,.08);color:#fff;font:inherit;font-size:.8rem;font-weight:600;cursor:pointer;white-space:nowrap}
    .njtc-search-btn:hover{background:rgba(255,255,255,.16)}
    #njtcSearch{position:fixed;inset:0;z-index:20050;background:rgba(10,22,40,.5);display:none;align-items:flex-start;justify-content:center;padding:8vh 1rem 1rem}
    #njtcSearch.open{display:flex}
    .ns-box{width:min(620px,100%);background:#fff;border-radius:14px;box-shadow:0 24px 64px rgba(0,0,0,.3);overflow:hidden;display:flex;flex-direction:column;max-height:80vh}
    .ns-top{display:flex;align-items:center;gap:.5rem;padding:.75rem .9rem;border-bottom:1px solid #e2e8f0}
    .ns-ic{font-size:1.05rem}
    .ns-top input{flex:1;min-width:0;border:none;outline:none;font:inherit;font-size:16px;color:#0f172a;background:transparent}
    .ns-x{border:none;background:#f1f5f9;border-radius:8px;width:34px;height:34px;cursor:pointer;font-size:.9rem;color:#475569}
    .ns-list{overflow:auto;padding:.35rem 0}
    .ns-grp{font-size:.66rem;font-weight:800;letter-spacing:.07em;text-transform:uppercase;color:#94a3b8;padding:.55rem 1rem .2rem}
    .ns-row{display:flex;align-items:center;gap:.65rem;width:100%;text-align:left;border:none;background:none;padding:.55rem 1rem;cursor:pointer;font:inherit;color:#0f172a;min-height:44px}
    .ns-row.on,.ns-row:hover{background:#eff6ff}
    .ns-k{font-size:1rem;width:1.3rem;text-align:center}
    .ns-t{display:flex;flex-direction:column;min-width:0}
    .ns-t b{font-size:.88rem;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .ns-t small{font-size:.74rem;color:#64748b;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .ns-hint{padding:1rem;color:#64748b;font-size:.85rem}
    .ns-foot{padding:.45rem 1rem;border-top:1px solid #f1f5f9;font-size:.7rem;color:#94a3b8}
    @media (max-width:640px){ .njtc-search-btn span{display:none} .njtc-search-btn{padding:.3rem .6rem} #njtcSearch{padding:.6rem} .ns-box{max-height:88vh} .ns-foot{display:none} }
  `;
  document.head.appendChild(css);

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', addButton); else addButton();
  setTimeout(addButton, 2000);
})();
