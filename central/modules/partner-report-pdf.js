// ─────────────────────────────────────────────────────────────────────────────
// NJTC Pearl Ops — Partner Weekly Report PDF (Central side)
//
// Downloads the exact Weekly Operations Report a partner downloads from their
// own Partner Dashboard. Both sides call NJTCPartnerReport.generatePDF()
// (partner/partner-report.js) on a bundle built with the same scope rules and
// SY cutoff as scripts/build-partner-data.js, so the numbers, check-in list
// and curated Session Highlights match what that partner sees.
//
// Visible to Programming, Data, Leadership (and KB) — see shared-filters.js.
// ─────────────────────────────────────────────────────────────────────────────
(function () {
  'use strict';

  const DIRECTORY_URL = '../partner/directory.json';
  const LEVEL_ORDER = ['Network', 'Partner Contact', 'ADA', 'ADO', 'Regional', 'Admin'];
  const LEVEL_LABEL = { Network: 'Network leaders', 'Partner Contact': 'District partner contacts', ADA: 'School ADAs', ADO: 'School ADOs', Regional: 'NJTC Regional (internal)', Admin: 'NJTC Admin (internal)' };

  let directory = null;
  let current = null; // { entry, bundle }

  const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const $ = id => document.getElementById(id);

  function scopeText(e) {
    if (e.scopeType === 'all') return 'All districts';
    if (e.scopeType === 'region') return e.region + ' region';
    if (e.scopeType === 'district') return e.district;
    return (e.schools || []).join(', ') + (e.district ? ' (' + e.district + ')' : '');
  }

  function ensureModal() {
    if ($('prpModal')) return;
    const wrap = document.createElement('div');
    wrap.id = 'prpModal';
    wrap.style.cssText = 'position:fixed;inset:0;background:rgba(15,23,42,.55);z-index:10000;display:none;align-items:center;justify-content:center;padding:1rem';
    const lbl = 'display:block;font-size:.72rem;font-weight:700;color:#475569;text-transform:uppercase;letter-spacing:.04em;margin:.9rem 0 .3rem';
    const sel = 'width:100%;padding:.55rem .7rem;border:1.5px solid #e2e8f0;border-radius:8px;font-size:.85rem;font-family:inherit;background:#fff;color:#0f172a';
    wrap.innerHTML = `
      <div role="dialog" aria-modal="true" aria-labelledby="prpTitle" style="background:#fff;border-radius:14px;max-width:520px;width:100%;max-height:90vh;overflow:auto;box-shadow:0 30px 80px rgba(15,23,42,.35)">
        <div style="padding:1.1rem 1.4rem;border-bottom:1px solid #eef1f6;display:flex;align-items:center;justify-content:space-between;gap:1rem">
          <div>
            <div id="prpTitle" style="font-size:1.05rem;font-weight:700;color:#0f172a">Partner Weekly Report (PDF)</div>
            <div style="font-size:.78rem;color:#64748b;margin-top:.15rem">The same PDF this partner downloads from their Partner Dashboard.</div>
          </div>
          <button type="button" id="prpClose" aria-label="Close" style="background:none;border:none;font-size:1.4rem;color:#64748b;cursor:pointer;line-height:1">&times;</button>
        </div>
        <div style="padding:.3rem 1.4rem 1.3rem">
          <label for="prpPartner" style="${lbl}">Partner</label>
          <select id="prpPartner" style="${sel}"><option value="">Loading partner list…</option></select>
          <label for="prpSchool" style="${lbl}">School</label>
          <select id="prpSchool" style="${sel}" disabled><option value="ALL">All of this partner's schools</option></select>
          <label for="prpWeek" style="${lbl}">Week</label>
          <select id="prpWeek" style="${sel}" disabled><option value="">Choose a partner first</option></select>
          <button type="button" id="prpGo" disabled style="margin-top:1.1rem;width:100%;padding:.7rem;border:none;border-radius:9px;background:linear-gradient(135deg,#1e3a5f,#2a5298);color:#fff;font-weight:700;font-size:.9rem;cursor:pointer;font-family:inherit">⬇ Download Partner PDF</button>
          <div id="prpStatus" role="status" aria-live="polite" style="font-size:.8rem;color:#64748b;margin-top:.6rem;min-height:1.1em"></div>
        </div>
      </div>`;
    document.body.appendChild(wrap);
    wrap.addEventListener('click', e => { if (e.target === wrap) close(); });
    $('prpClose').addEventListener('click', close);
    $('prpPartner').addEventListener('change', onPartnerChange);
    $('prpSchool').addEventListener('change', fillWeeks);
    $('prpGo').addEventListener('click', generate);
  }

  function close() { const m = $('prpModal'); if (m) m.style.display = 'none'; }
  function status(msg, isErr) { const s = $('prpStatus'); s.textContent = msg || ''; s.style.color = isErr ? '#b91c1c' : '#64748b'; }

  async function open() {
    ensureModal();
    $('prpModal').style.display = 'flex';
    if (!window.NJTCPartnerReport) { status('Partner report module failed to load — refresh the page.', true); return; }
    if (!directory) {
      try {
        const res = await fetch(DIRECTORY_URL + '?v=' + Date.now());
        directory = (await res.json()).entries || [];
      } catch (e) {
        status('Could not load the partner directory.', true);
        return;
      }
      const groups = {};
      directory.forEach(e => { (groups[e.level] = groups[e.level] || []).push(e); });
      const levels = Object.keys(groups).sort((a, b) => (LEVEL_ORDER.indexOf(a) + 1 || 99) - (LEVEL_ORDER.indexOf(b) + 1 || 99));
      $('prpPartner').innerHTML = '<option value="">Select a partner…</option>' + levels.map(l =>
        `<optgroup label="${esc(LEVEL_LABEL[l] || l)}">` +
        groups[l].sort((a, b) => a.name.localeCompare(b.name)).map(e =>
          `<option value="${esc(e.id)}">${esc(e.name)} — ${esc(scopeText(e))}${e.pearlStatus === 'pending' ? ' (pending)' : ''}</option>`).join('') +
        '</optgroup>').join('');
    }
    status('');
  }

  async function onPartnerChange() {
    const id = $('prpPartner').value;
    const schoolSel = $('prpSchool'), weekSel = $('prpWeek'), go = $('prpGo');
    current = null;
    schoolSel.disabled = weekSel.disabled = go.disabled = true;
    if (!id) return;
    const entry = directory.find(e => e.id === id);
    status('Loading Pearl data (first load can take ~20 seconds)…');
    let pearl;
    try { pearl = await window.NJTCPartnerReport.loadPearl(); }
    catch (e) { console.error(e); status('Could not load Pearl data — check your connection and try again.', true); return; }
    if ($('prpPartner').value !== id) return; // user switched partner while loading
    const bundle = window.NJTCPartnerReport.bundleForEntry(pearl, entry);
    current = { entry, bundle };

    const R = window.NJTCPartnerReport;
    const schools = [...new Set(bundle.attendance.map(r => (r[R.ATT.SCHOOL] || '').trim()).filter(Boolean))].sort();
    schoolSel.innerHTML = `<option value="ALL">All of this partner's schools${schools.length > 1 ? ' (' + schools.length + ')' : ''}</option>` +
      (schools.length > 1 ? schools.map(s => `<option value="${esc(s)}">${esc(s)}</option>`).join('') : '');
    schoolSel.disabled = schools.length <= 1;
    fillWeeks();
  }

  function fillWeeks() {
    const weekSel = $('prpWeek'), go = $('prpGo');
    if (!current) return;
    const R = window.NJTCPartnerReport;
    const school = $('prpSchool').value;
    const b = current.bundle;
    const scopedBundle = school === 'ALL' ? b : { ...b, attendance: R.scoped(b.attendance, R.ATT.DISTRICT, R.ATT.SCHOOL, null, { school }) };
    const weeks = R.allWeeks(scopedBundle).reverse();
    weekSel.innerHTML = weeks.map(w => `<option value="${w.key}">Week of ${esc(R.weekRangeLabel(w.key))}</option>`).join('') +
      '<option value="ALL">Full school year to date</option>';
    weekSel.value = weeks.length ? weeks[0].key : 'ALL';
    weekSel.disabled = false;
    go.disabled = false;
    status(weeks.length ? '' : 'No recorded sessions for this partner yet this school year — the PDF will say so.');
  }

  async function generate() {
    if (!current) return;
    const go = $('prpGo');
    go.disabled = true;
    status('Building PDF…');
    try {
      const school = $('prpSchool').value;
      const r = await window.NJTCPartnerReport.generatePDF(current.bundle, { district: 'ALL', school, week: $('prpWeek').value });
      status('Downloaded ' + r.name);
    } catch (e) {
      console.error(e);
      status("Couldn't build the PDF — check your connection and try again.", true);
    } finally {
      go.disabled = false;
    }
  }

  window.njtcPartnerPDF = { open };
})();
