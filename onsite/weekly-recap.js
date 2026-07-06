/* ============================================================================
   WEEKLY RECAP — NJTC Onsite Portal
   ============================================================================
   ADDITIVE ONLY. This file does not modify, rename, or call into any existing
   file's functions/variables. It is a self-contained IIFE that:
     1. Injects a floating "Weekly Recap" button (top-right)
     2. Injects a modal (New Recap tab + My Recaps history tab)
     3. Submits directly to the existing "Weekly Check-In: NJ Tutoring Corps"
        Google Form (no new backend, no new database/table)
     4. Reads the connected Google Sheet back (CSV export) so a submitter can
        see their own past recaps for reflection / historical tracking

   It only READS window.NJTC_USER_PROFILE (set by user-login.js) for optional
   auto-fill context — it never writes to it, and never touches auth/session
   logic, existing tabs, or any other portal feature.

   WHERE TO UPDATE THINGS LATER (all in one place, top of file):
     - RECAP_FORM_ID / RECAP_SUBMIT_URL   → if the Google Form URL changes
     - ENTRY{...}                          → if the form's fields/IDs change
     - RECAP_SHEET_ID / RECAP_SHEET_GID    → if the response Sheet changes
   ============================================================================ */

(function () {
  'use strict';

  // ══════════════════════════════════════════════════════════════════════
  // ██  CONFIG — the only section you should need to touch later
  // ══════════════════════════════════════════════════════════════════════

  // Submission endpoint. Google Forms' public POST endpoint is always the
  // viewform URL with the last segment swapped for "formResponse" — this is
  // the standard (undocumented but very stable) technique for posting to a
  // Google Form from outside code, no Apps Script deployment required.
  var RECAP_FORM_ID    = '1FAIpQLScVLl0D4_-nka_dpH2vQ557MwIXHCwjnQs0ajEJpR-hbhpdfQ';
  var RECAP_SUBMIT_URL = 'https://docs.google.com/forms/d/e/' + RECAP_FORM_ID + '/formResponse';

  // Response Sheet — used ONLY to read back "My Recaps" history.
  // REQUIRES: this Sheet's sharing set to "Anyone with the link — Viewer".
  // (Same requirement as the Pearl/iReady sources this portal already reads
  // this way — see pearlUrl()-style fetches in leader-team.js for precedent.)
  var RECAP_SHEET_ID  = '1y9d9cLn6-EBLSiCuCrf_6iKd0qq9xAzogCaCVUD0mpY';
  var RECAP_SHEET_GID = '540898531';
  var RECAP_HISTORY_URL = 'https://docs.google.com/spreadsheets/d/' + RECAP_SHEET_ID +
    '/export?format=csv&gid=' + RECAP_SHEET_GID;

  // Google Form entry IDs (from the hidden <input> fields you provided).
  // If the form is ever edited and fields are added/reordered, ONLY this
  // object needs to change — nothing else in this file references entry IDs.
  var ENTRY = {
    email:           'entry.681250975',
    group:           'entry.2063739653',
    morale:          'entry.1448998487',   // 1–5, "Challenging week" → "Excellent week"
    discuss:         'entry.2055516822',
    roadblocks:      'entry.419711255',    // labeled "Escalations / Concerns" in this UI
    accomplishments: 'entry.1538290603',
    assistance:      'entry.1263111019',
    support:         'entry.198126569',    // 1–5, level of Central Team support felt
    shoutouts:       'entry.2100411678',
  };

  // The real form is answered PER GROUP (one submission = one group), not
  // three simultaneous recap fields. This picker maps to entry.2063739653.
  var GROUP_OPTIONS = ['Onsite Staff', 'Administration', 'Teachers / Instructional Coaches'];

  var HISTORY_CACHE_KEY = 'njtc_recap_history_v1';
  var HISTORY_CACHE_TTL = 2 * 60 * 1000; // 2 min — keep "my recaps" feeling fresh after submit

  // In-memory draft — preserved across an error so typed content is never lost,
  // and even across an accidental close (cleared only after a real success).
  var _draft = { group: '', morale: '3', discuss: '', roadblocks: '', accomplishments: '',
                 assistance: '', support: '3', shoutouts: '', email: '' };
  var _submitting = false;
  var _historyCache = null; // { ts, rows }

  // ══════════════════════════════════════════════════════════════════════
  // ██  STYLES — mirrors the existing portal's design language (navy/gold,
  // ██  Epilogue font, glassmorphic panels, pill buttons) — see the
  // ██  "Ask Connor" FAB/panel in connor-bot.js, which this is styled to sit
  // ██  alongside without visually competing.
  // ══════════════════════════════════════════════════════════════════════
  var CSS = `
    #wr-fab-wrap { position:fixed; top:4.75rem; right:1.5rem; z-index:9050; }
    #wr-fab {
      position:relative; display:flex; align-items:center; gap:0.5rem;
      background:linear-gradient(135deg,#FFB81C 0%,#e09800 100%);
      color:#001a33; border:none; border-radius:3rem;
      padding:0.55rem 1.1rem 0.55rem 0.7rem;
      font-family:'Epilogue',system-ui,sans-serif; font-size:0.82rem;
      font-weight:800; cursor:pointer; letter-spacing:0.01em;
      box-shadow:0 4px 20px rgba(255,184,28,0.4),0 2px 8px rgba(0,0,0,0.25);
      transition:transform 0.2s ease, box-shadow 0.2s ease;
    }
    #wr-fab:hover, #wr-fab:focus-visible {
      transform:translateY(-2px);
      box-shadow:0 8px 28px rgba(255,184,28,0.55),0 4px 12px rgba(0,0,0,0.28);
      outline:none;
    }
    #wr-fab .wr-fab-icon { font-size:1.05rem; line-height:1; }

    #wr-overlay {
      position:fixed; inset:0; background:rgba(0,10,23,0.65); backdrop-filter:blur(6px);
      z-index:9500; display:flex; align-items:center; justify-content:center;
      padding:1.25rem; opacity:0; pointer-events:none; transition:opacity 0.22s ease;
    }
    #wr-overlay.open { opacity:1; pointer-events:all; }

    #wr-modal {
      width:100%; max-width:640px; max-height:88vh; overflow-y:auto;
      background:linear-gradient(160deg,#001a33 0%,#002244 100%);
      border-radius:1.25rem; box-shadow:0 20px 60px rgba(0,0,0,0.55),0 0 0 1px rgba(255,184,28,0.28);
      transform:scale(0.94) translateY(16px); opacity:0;
      transition:transform 0.26s cubic-bezier(.32,.72,0,1), opacity 0.22s ease;
    }
    #wr-overlay.open #wr-modal { transform:scale(1) translateY(0); opacity:1; }
    #wr-modal::-webkit-scrollbar { width:6px; }
    #wr-modal::-webkit-scrollbar-thumb { background:rgba(255,184,28,0.3); border-radius:99px; }

    .wr-hdr { position:sticky; top:0; z-index:2; background:linear-gradient(160deg,#001a33,#002244);
      padding:1.25rem 1.5rem 0.9rem; border-bottom:1px solid rgba(255,184,28,0.18); }
    .wr-hdr-row { display:flex; align-items:flex-start; justify-content:space-between; gap:1rem; }
    .wr-title { font-family:'Epilogue',sans-serif; font-weight:800; font-size:1.2rem; color:#fff; margin:0; }
    .wr-subtitle { font-size:0.8rem; color:rgba(255,255,255,0.5); margin:0.3rem 0 0; line-height:1.5; max-width:46ch; }
    .wr-close { flex-shrink:0; background:rgba(255,255,255,0.08); border:none; border-radius:8px;
      width:32px; height:32px; display:flex; align-items:center; justify-content:center;
      cursor:pointer; color:rgba(255,255,255,0.55); font-size:1rem; transition:background 0.15s,color 0.15s; }
    .wr-close:hover, .wr-close:focus-visible { background:rgba(255,255,255,0.16); color:#fff; outline:none; }

    .wr-tabs { display:flex; gap:0.4rem; margin-top:1rem; }
    .wr-tab-btn { font-family:'Epilogue',sans-serif; font-size:0.78rem; font-weight:700;
      padding:0.45rem 0.9rem; border-radius:0.6rem; border:1px solid transparent;
      background:transparent; color:rgba(255,255,255,0.5); cursor:pointer; transition:all 0.15s ease; }
    .wr-tab-btn:hover { background:rgba(255,255,255,0.07); color:rgba(255,255,255,0.85); }
    .wr-tab-btn.active { background:rgba(255,184,28,0.15); border-color:rgba(255,184,28,0.4); color:#FFB81C; }

    .wr-body { padding:1.25rem 1.5rem 1.5rem; }
    .wr-pane { display:none; }
    .wr-pane.active { display:block; }

    .wr-field { margin-bottom:1.05rem; }
    .wr-label { display:block; font-family:'Epilogue',sans-serif; font-size:0.8rem; font-weight:700;
      color:rgba(255,255,255,0.88); margin-bottom:0.4rem; }
    .wr-label .wr-req { color:#FFB81C; margin-left:0.2rem; }
    .wr-hint { font-size:0.7rem; color:rgba(255,255,255,0.4); margin:0.25rem 0 0; }

    .wr-input, .wr-select, .wr-textarea {
      width:100%; box-sizing:border-box; background:rgba(255,255,255,0.06);
      border:1px solid rgba(255,255,255,0.14); border-radius:0.65rem;
      padding:0.65rem 0.8rem; color:#fff; font-size:0.85rem;
      font-family:'DM Sans','Epilogue',system-ui,sans-serif; outline:none;
      transition:border-color 0.15s, background 0.15s;
    }
    .wr-input::placeholder, .wr-textarea::placeholder { color:rgba(255,255,255,0.28); }
    .wr-input:focus, .wr-select:focus, .wr-textarea:focus { border-color:rgba(255,184,28,0.55); background:rgba(255,255,255,0.09); }
    .wr-textarea { resize:vertical; min-height:78px; line-height:1.5; }
    .wr-select option { background:#001a33; color:#fff; }

    .wr-stars { display:flex; gap:0.35rem; }
    .wr-star { width:34px; height:34px; border-radius:0.55rem; border:1px solid rgba(255,255,255,0.14);
      background:rgba(255,255,255,0.05); color:rgba(255,255,255,0.35); font-size:1rem;
      display:flex; align-items:center; justify-content:center; cursor:pointer; transition:all 0.15s ease; }
    .wr-star:hover { border-color:rgba(255,184,28,0.4); }
    .wr-star.sel { background:rgba(255,184,28,0.18); border-color:rgba(255,184,28,0.5); color:#FFB81C; }
    .wr-scale-labels { display:flex; justify-content:space-between; font-size:0.65rem; color:rgba(255,255,255,0.35); margin-top:0.3rem; }

    .wr-actions { display:flex; gap:0.65rem; margin-top:1.4rem; }
    .wr-btn { font-family:'Epilogue',sans-serif; font-size:0.82rem; font-weight:700;
      padding:0.65rem 1.3rem; border-radius:0.7rem; border:none; cursor:pointer;
      transition:transform 0.15s ease, opacity 0.15s ease; }
    .wr-btn-primary { background:linear-gradient(135deg,#FFB81C,#e09800); color:#001a33; flex:1; }
    .wr-btn-primary:hover:not(:disabled) { transform:translateY(-1px); }
    .wr-btn-primary:disabled { opacity:0.5; cursor:default; transform:none; }
    .wr-btn-secondary { background:rgba(255,255,255,0.08); color:rgba(255,255,255,0.75); border:1px solid rgba(255,255,255,0.14); }
    .wr-btn-secondary:hover { background:rgba(255,255,255,0.14); color:#fff; }

    .wr-status { margin-top:0.9rem; padding:0.7rem 0.9rem; border-radius:0.65rem; font-size:0.8rem; display:none; }
    .wr-status.show { display:block; }
    .wr-status.success { background:rgba(34,197,94,0.12); border:1px solid rgba(34,197,94,0.35); color:#86efac; }
    .wr-status.error { background:rgba(239,68,68,0.12); border:1px solid rgba(239,68,68,0.35); color:#fca5a5; }

    .wr-hist-item { background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.09);
      border-radius:0.8rem; padding:0.9rem 1rem; margin-bottom:0.75rem; }
    .wr-hist-top { display:flex; justify-content:space-between; align-items:center; gap:0.5rem; margin-bottom:0.5rem; flex-wrap:wrap; }
    .wr-hist-date { font-family:'Epilogue',sans-serif; font-weight:700; font-size:0.82rem; color:#FFB81C; }
    .wr-hist-group { font-size:0.68rem; background:rgba(255,255,255,0.08); border-radius:999px; padding:0.2rem 0.6rem; color:rgba(255,255,255,0.65); }
    .wr-hist-ratings { font-size:0.68rem; color:rgba(255,255,255,0.45); display:flex; gap:0.75rem; }
    .wr-hist-field { font-size:0.78rem; color:rgba(255,255,255,0.75); line-height:1.5; margin-bottom:0.4rem; }
    .wr-hist-field b { color:rgba(255,255,255,0.92); font-weight:700; }
    .wr-hist-empty, .wr-hist-loading, .wr-hist-error { text-align:center; padding:2rem 1rem; color:rgba(255,255,255,0.4); font-size:0.85rem; }
    .wr-hist-refresh { background:none; border:none; color:#FFB81C; font-size:0.72rem; font-weight:700; cursor:pointer; padding:0; }
    .wr-hist-refresh:hover { text-decoration:underline; }

    @media (max-width: 480px) {
      #wr-fab-wrap { top:auto; bottom:1.5rem; right:1rem; }
      #wr-fab span.wr-fab-label { display:none; }
      #wr-fab { padding:0.6rem; border-radius:50%; }
      .wr-body { padding:1rem; }
    }
  `;

  function injectStyles() {
    if (document.getElementById('wr-styles')) return;
    var tag = document.createElement('style');
    tag.id = 'wr-styles';
    tag.textContent = CSS;
    document.head.appendChild(tag);
  }

  // ══════════════════════════════════════════════════════════════════════
  // ██  USER CONTEXT — read-only use of window.NJTC_USER_PROFILE
  // ══════════════════════════════════════════════════════════════════════
  function getUserContext() {
    var p = window.NJTC_USER_PROFILE || {};
    var site = (p.assignments && p.assignments.length && p.assignments[0].schools && p.assignments[0].schools.length)
      ? p.assignments[0].schools[0] : '';
    return {
      name:  p.name || p.firstName || '',
      email: p.email || '', // users.json doesn't guarantee an email — user confirms/edits in the field
      site:  site,
      role:  p.role || '',
    };
  }

  function weekOfLabel() {
    var d = new Date();
    return (d.getMonth() + 1) + '/' + d.getDate() + '/' + d.getFullYear();
  }

  // ══════════════════════════════════════════════════════════════════════
  // ██  CSV PARSING — small self-contained parser (mirrors the pattern used
  // ██  elsewhere in this portal for reading published Sheets; kept local so
  // ██  this file has zero dependency on other scripts' internals).
  // ══════════════════════════════════════════════════════════════════════
  function parseCsv(text) {
    var rows = [], row = [], field = '', inQ = false;
    for (var i = 0; i < text.length; i++) {
      var c = text[i], n = text[i + 1];
      if (inQ) {
        if (c === '"' && n === '"') { field += '"'; i++; }
        else if (c === '"') { inQ = false; }
        else field += c;
      } else {
        if (c === '"') inQ = true;
        else if (c === ',') { row.push(field); field = ''; }
        else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
        else if (c !== '\r') field += c;
      }
    }
    if (field || row.length) { row.push(field); rows.push(row); }
    return rows;
  }
  function csvToObjects(text) {
    var rows = parseCsv(text);
    if (rows.length < 2) return [];
    var headers = rows[0].map(function (h) { return h.trim(); });
    return rows.slice(1).map(function (r) {
      var o = {};
      headers.forEach(function (h, i) { o[h] = (r[i] || '').trim(); });
      return o;
    });
  }

  // ══════════════════════════════════════════════════════════════════════
  // ██  DOM BUILD
  // ══════════════════════════════════════════════════════════════════════
  function buildFab() {
    if (document.getElementById('wr-fab-wrap')) return;
    var wrap = document.createElement('div');
    wrap.id = 'wr-fab-wrap';
    wrap.innerHTML =
      '<button id="wr-fab" type="button" aria-haspopup="dialog" aria-controls="wr-modal" aria-label="Open Weekly Recap">' +
        '<span class="wr-fab-icon" aria-hidden="true">📋</span>' +
        '<span class="wr-fab-label">Weekly Recap</span>' +
      '</button>';
    document.body.appendChild(wrap);
    document.getElementById('wr-fab').addEventListener('click', openModal);
  }

  function starRow(name, current) {
    var html = '<div class="wr-stars" role="radiogroup" aria-label="' + name + ' rating">';
    for (var i = 1; i <= 5; i++) {
      html += '<button type="button" class="wr-star' + (String(i) === String(current) ? ' sel' : '') +
        '" data-star-group="' + name + '" data-val="' + i + '" role="radio" aria-checked="' +
        (String(i) === String(current)) + '" aria-label="' + i + ' of 5">' + i + '</button>';
    }
    html += '</div>';
    return html;
  }

  function buildModal() {
    if (document.getElementById('wr-overlay')) return;
    var ctx = getUserContext();
    if (!_draft.email && ctx.email) _draft.email = ctx.email;

    var overlay = document.createElement('div');
    overlay.id = 'wr-overlay';
    overlay.setAttribute('role', 'presentation');
    overlay.innerHTML =
      '<div id="wr-modal" role="dialog" aria-modal="true" aria-labelledby="wr-title-text">' +
        '<div class="wr-hdr">' +
          '<div class="wr-hdr-row">' +
            '<div>' +
              '<h2 class="wr-title" id="wr-title-text">Weekly Site Recap</h2>' +
              '<p class="wr-subtitle">A quick check-in so the Central Team can support your site — what went well, what\'s hard, and what you need. Week of ' + weekOfLabel() + '.</p>' +
            '</div>' +
            '<button class="wr-close" type="button" aria-label="Close">✕</button>' +
          '</div>' +
          '<div class="wr-tabs">' +
            '<button class="wr-tab-btn active" data-wr-tab="new" type="button">📝 New Recap</button>' +
            '<button class="wr-tab-btn" data-wr-tab="history" type="button">🕘 My Recaps</button>' +
          '</div>' +
        '</div>' +
        '<div class="wr-body">' +
          buildNewPane(ctx) +
          buildHistoryPane() +
        '</div>' +
      '</div>';
    document.body.appendChild(overlay);

    // ── Wire up events (scoped to this modal only) ──────────────────────
    overlay.addEventListener('click', function (e) { if (e.target === overlay) closeModal(); });
    overlay.querySelector('.wr-close').addEventListener('click', closeModal);
    overlay.querySelectorAll('[data-wr-tab]').forEach(function (btn) {
      btn.addEventListener('click', function () { switchTab(btn.dataset.wrTab); });
    });
    overlay.querySelectorAll('[data-star-group]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var group = btn.dataset.starGroup, val = btn.dataset.val;
        _draft[group] = val;
        overlay.querySelectorAll('[data-star-group="' + group + '"]').forEach(function (b) {
          var sel = b.dataset.val === val;
          b.classList.toggle('sel', sel);
          b.setAttribute('aria-checked', sel);
        });
      });
    });
    ['group', 'email', 'discuss', 'roadblocks', 'accomplishments', 'assistance', 'shoutouts'].forEach(function (key) {
      var el = overlay.querySelector('[data-wr-field="' + key + '"]');
      if (el) el.addEventListener('input', function () { _draft[key] = el.value; });
    });
    overlay.querySelector('#wr-submit-btn').addEventListener('click', submitRecap);
    overlay.querySelector('#wr-cancel-btn').addEventListener('click', closeModal);
    overlay.querySelector('.wr-hist-refresh-btn').addEventListener('click', function () { loadHistory(true); });
  }

  function buildNewPane(ctx) {
    return (
      '<div class="wr-pane active" data-wr-pane="new">' +
        '<div class="wr-field">' +
          '<label class="wr-label" for="wr-email">Your Email<span class="wr-req">*</span></label>' +
          '<input class="wr-input" type="email" id="wr-email" data-wr-field="email" required ' +
            'placeholder="you@njtutoringcorps.org" value="' + escHtml(_draft.email) + '">' +
          (ctx.name ? '<p class="wr-hint">Reporting as ' + escHtml(ctx.name) + (ctx.site ? ' · ' + escHtml(ctx.site) : '') + '</p>' : '') +
        '</div>' +
        '<div class="wr-field">' +
          '<label class="wr-label" for="wr-group">Which group are you reporting on?<span class="wr-req">*</span></label>' +
          '<select class="wr-select" id="wr-group" data-wr-field="group" required>' +
            '<option value="" disabled' + (!_draft.group ? ' selected' : '') + '>Select a group…</option>' +
            GROUP_OPTIONS.map(function (g) {
              return '<option value="' + g + '"' + (_draft.group === g ? ' selected' : '') + '>' + g + '</option>';
            }).join('') +
          '</select>' +
        '</div>' +
        '<div class="wr-field">' +
          '<label class="wr-label">Team Morale This Week</label>' +
          starRow('morale', _draft.morale) +
          '<div class="wr-scale-labels"><span>Challenging week</span><span>Excellent week</span></div>' +
        '</div>' +
        '<div class="wr-field">' +
          '<label class="wr-label" for="wr-discuss">What did you discuss this week with this group?<span class="wr-req">*</span></label>' +
          '<textarea class="wr-textarea" id="wr-discuss" data-wr-field="discuss" required placeholder="Key topics, decisions, updates…">' + escHtml(_draft.discuss) + '</textarea>' +
        '</div>' +
        '<div class="wr-field">' +
          '<label class="wr-label" for="wr-roadblocks">Escalations / Concerns<span class="wr-req">*</span></label>' +
          '<p class="wr-hint" style="margin-top:-0.15rem;margin-bottom:0.4rem">What roadblocks did you encounter this week?</p>' +
          '<textarea class="wr-textarea" id="wr-roadblocks" data-wr-field="roadblocks" required placeholder="Anything blocking progress or needing attention…">' + escHtml(_draft.roadblocks) + '</textarea>' +
        '</div>' +
        '<div class="wr-field">' +
          '<label class="wr-label" for="wr-accomplishments">What accomplishments did your onsite staff achieve this week?<span class="wr-req">*</span></label>' +
          '<textarea class="wr-textarea" id="wr-accomplishments" data-wr-field="accomplishments" required placeholder="Wins worth celebrating…">' + escHtml(_draft.accomplishments) + '</textarea>' +
        '</div>' +
        '<div class="wr-field">' +
          '<label class="wr-label" for="wr-assistance">What assistance do you need from the Central Team?<span class="wr-req">*</span></label>' +
          '<textarea class="wr-textarea" id="wr-assistance" data-wr-field="assistance" required placeholder="Support, resources, decisions you need from Central…">' + escHtml(_draft.assistance) + '</textarea>' +
        '</div>' +
        '<div class="wr-field">' +
          '<label class="wr-label">Support Felt From Central Team This Week</label>' +
          starRow('support', _draft.support) +
          '<div class="wr-scale-labels"><span>1</span><span>5</span></div>' +
        '</div>' +
        '<div class="wr-field">' +
          '<label class="wr-label" for="wr-shoutouts">Shoutouts <span style="font-weight:400;color:rgba(255,255,255,.4)">(optional)</span></label>' +
          '<textarea class="wr-textarea" id="wr-shoutouts" data-wr-field="shoutouts" placeholder="Give a team member a shoutout…">' + escHtml(_draft.shoutouts) + '</textarea>' +
        '</div>' +
        '<div class="wr-status" id="wr-status"></div>' +
        '<div class="wr-actions">' +
          '<button class="wr-btn wr-btn-secondary" id="wr-cancel-btn" type="button">Cancel</button>' +
          '<button class="wr-btn wr-btn-primary" id="wr-submit-btn" type="button">Submit Recap</button>' +
        '</div>' +
      '</div>'
    );
  }

  function buildHistoryPane() {
    return (
      '<div class="wr-pane" data-wr-pane="history">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.9rem">' +
          '<p class="wr-hint" style="margin:0">Past recaps submitted with your email, most recent first.</p>' +
          '<button class="wr-hist-refresh-btn wr-hist-refresh" type="button">↻ Refresh</button>' +
        '</div>' +
        '<div id="wr-hist-list"><div class="wr-hist-loading">Loading your recap history…</div></div>' +
      '</div>'
    );
  }

  function escHtml(s) {
    return String(s || '').replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  // ══════════════════════════════════════════════════════════════════════
  // ██  OPEN / CLOSE / TABS
  // ══════════════════════════════════════════════════════════════════════
  function openModal() {
    buildModal();
    var overlay = document.getElementById('wr-overlay');
    overlay.classList.add('open');
    document.addEventListener('keydown', onKeydown);
    // Refresh the email field each open in case profile context resolved late
    var ctx = getUserContext();
    if (!_draft.email && ctx.email) {
      _draft.email = ctx.email;
      var emailEl = document.getElementById('wr-email');
      if (emailEl) emailEl.value = ctx.email;
    }
  }
  function closeModal() {
    var overlay = document.getElementById('wr-overlay');
    if (!overlay) return;
    overlay.classList.remove('open');
    document.removeEventListener('keydown', onKeydown);
  }
  function onKeydown(e) {
    if (e.key === 'Escape') closeModal();
  }
  function switchTab(tab) {
    document.querySelectorAll('[data-wr-tab]').forEach(function (b) { b.classList.toggle('active', b.dataset.wrTab === tab); });
    document.querySelectorAll('[data-wr-pane]').forEach(function (p) { p.classList.toggle('active', p.dataset.wrPane === tab); });
    if (tab === 'history') loadHistory(false);
  }

  // ══════════════════════════════════════════════════════════════════════
  // ██  SUBMIT — POST directly to the Google Form (no-cors, form-urlencoded)
  // ══════════════════════════════════════════════════════════════════════
  function setStatus(type, msg) {
    var el = document.getElementById('wr-status');
    if (!el) return;
    el.className = 'wr-status show ' + type;
    el.textContent = msg;
  }
  function clearStatus() {
    var el = document.getElementById('wr-status');
    if (!el) return;
    el.className = 'wr-status';
    el.textContent = '';
  }

  function validateDraft() {
    var required = ['email', 'group', 'discuss', 'roadblocks', 'accomplishments', 'assistance'];
    var missing = required.filter(function (k) { return !String(_draft[k] || '').trim(); });
    if (missing.length) return 'Please fill in all required fields before submitting.';
    if (_draft.email.indexOf('@') < 0) return 'Please enter a valid email address.';
    return null;
  }

  function submitRecap() {
    if (_submitting) return;
    clearStatus();
    var err = validateDraft();
    if (err) { setStatus('error', err); return; }

    _submitting = true;
    var btn = document.getElementById('wr-submit-btn');
    btn.disabled = true;
    btn.textContent = 'Submitting…';

    // Auto-context: the form has no dedicated "name/site/week" fields, so we
    // prepend a short identifying line to the first narrative field. This is
    // the least intrusive way to satisfy "capture user context automatically"
    // without inventing new Google Form entry IDs (per requirements).
    var ctx = getUserContext();
    var contextLine = ctx.name
      ? '[Portal: ' + ctx.name + (ctx.site ? ' · ' + ctx.site : '') + ' · Week of ' + weekOfLabel() + ']\n\n'
      : '';

    var body = new URLSearchParams();
    body.set(ENTRY.email, _draft.email.trim());
    body.set(ENTRY.group, _draft.group);
    body.set(ENTRY.morale, _draft.morale || '3');
    body.set(ENTRY.discuss, contextLine + _draft.discuss.trim());
    body.set(ENTRY.roadblocks, _draft.roadblocks.trim());
    body.set(ENTRY.accomplishments, _draft.accomplishments.trim());
    body.set(ENTRY.assistance, _draft.assistance.trim());
    body.set(ENTRY.support, _draft.support || '3');
    body.set(ENTRY.shoutouts, (_draft.shoutouts || '').trim());

    // mode:'no-cors' is required to POST cross-origin to Google Forms from the
    // browser — the tradeoff (same one already used elsewhere in this portal
    // for its own Apps Script endpoints) is that we cannot read the response
    // status. A resolved fetch = the request reached Google; a thrown error
    // (network failure) is the only failure case we can reliably detect.
    fetch(RECAP_SUBMIT_URL, { method: 'POST', mode: 'no-cors', body: body })
      .then(function () {
        _submitting = false;
        btn.disabled = false;
        btn.textContent = 'Submit Recap';
        setStatus('success', '✓ Recap submitted — thank you! This will close automatically.');
        // Clear the draft only on confirmed success.
        _draft = { group: '', morale: '3', discuss: '', roadblocks: '', accomplishments: '',
                   assistance: '', support: '3', shoutouts: '', email: _draft.email };
        _historyCache = null; // force a fresh fetch next time history is viewed
        setTimeout(closeModal, 1800);
      })
      .catch(function (fetchErr) {
        _submitting = false;
        btn.disabled = false;
        btn.textContent = 'Submit Recap';
        console.error('[WeeklyRecap] submit failed:', fetchErr);
        setStatus('error', 'Could not submit — check your connection and try again. Your answers have been kept.');
        // Draft is intentionally left untouched here — nothing is cleared.
      });
  }

  // ══════════════════════════════════════════════════════════════════════
  // ██  HISTORY — read back the submitter's own past recaps from the Sheet
  // ══════════════════════════════════════════════════════════════════════
  function loadHistory(forceRefresh) {
    var listEl = document.getElementById('wr-hist-list');
    if (!listEl) return;
    var email = (document.getElementById('wr-email') || {}).value || _draft.email || '';
    email = email.trim().toLowerCase();

    if (!email) {
      listEl.innerHTML = '<div class="wr-hist-empty">Enter your email in the "New Recap" tab first, then come back here.</div>';
      return;
    }

    var now = Date.now();
    if (!forceRefresh && _historyCache && (now - _historyCache.ts) < HISTORY_CACHE_TTL) {
      renderHistory(listEl, _historyCache.rows, email);
      return;
    }

    listEl.innerHTML = '<div class="wr-hist-loading">Loading your recap history…</div>';
    fetch(RECAP_HISTORY_URL)
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.text();
      })
      .then(function (text) {
        var rows = csvToObjects(text);
        _historyCache = { ts: Date.now(), rows: rows };
        renderHistory(listEl, rows, email);
      })
      .catch(function (histErr) {
        console.error('[WeeklyRecap] history fetch failed:', histErr);
        listEl.innerHTML = '<div class="wr-hist-error">Could not load your history right now. ' +
          '(If this persists, the response Sheet may need its sharing set to "Anyone with the link — Viewer".)</div>';
      });
  }

  function findCol(row, candidates) {
    var keys = Object.keys(row);
    for (var i = 0; i < keys.length; i++) {
      var k = keys[i], kl = k.toLowerCase();
      for (var j = 0; j < candidates.length; j++) {
        if (kl.indexOf(candidates[j]) >= 0) return row[k];
      }
    }
    return '';
  }

  function renderHistory(listEl, rows, email) {
    var mine = rows.filter(function (r) {
      var rowEmail = findCol(r, ['email']).trim().toLowerCase();
      return rowEmail === email;
    });

    if (!mine.length) {
      listEl.innerHTML = '<div class="wr-hist-empty">No past recaps found yet for this email. Once you submit one, it\'ll show up here.</div>';
      return;
    }

    mine.sort(function (a, b) {
      var ta = new Date(findCol(a, ['timestamp'])).getTime() || 0;
      var tb = new Date(findCol(b, ['timestamp'])).getTime() || 0;
      return tb - ta;
    });

    listEl.innerHTML = mine.map(function (r) {
      var ts = findCol(r, ['timestamp']);
      var d = new Date(ts);
      var dateStr = isNaN(d.getTime()) ? ts : (d.getMonth() + 1) + '/' + d.getDate() + '/' + d.getFullYear();
      var group = findCol(r, ['which group']);
      var morale = findCol(r, ['morale', 'overall']);
      var support = findCol(r, ['support']);
      var discuss = findCol(r, ['discuss']);
      var roadblocks = findCol(r, ['roadblock']);
      var accomplishments = findCol(r, ['accomplishment']);
      var assistance = findCol(r, ['assistance']);
      var shoutouts = findCol(r, ['shoutout']);

      return (
        '<div class="wr-hist-item">' +
          '<div class="wr-hist-top">' +
            '<span class="wr-hist-date">' + escHtml(dateStr) + '</span>' +
            (group ? '<span class="wr-hist-group">' + escHtml(group) + '</span>' : '') +
            '<span class="wr-hist-ratings">' +
              (morale ? '😊 Morale ' + escHtml(morale) + '/5' : '') +
              (support ? ' · 🤝 Support ' + escHtml(support) + '/5' : '') +
            '</span>' +
          '</div>' +
          (discuss ? '<div class="wr-hist-field"><b>Discussed:</b> ' + escHtml(discuss) + '</div>' : '') +
          (roadblocks ? '<div class="wr-hist-field"><b>Roadblocks:</b> ' + escHtml(roadblocks) + '</div>' : '') +
          (accomplishments ? '<div class="wr-hist-field"><b>Accomplishments:</b> ' + escHtml(accomplishments) + '</div>' : '') +
          (assistance ? '<div class="wr-hist-field"><b>Needed from Central:</b> ' + escHtml(assistance) + '</div>' : '') +
          (shoutouts ? '<div class="wr-hist-field"><b>Shoutouts:</b> ' + escHtml(shoutouts) + '</div>' : '') +
        '</div>'
      );
    }).join('');
  }

  // ══════════════════════════════════════════════════════════════════════
  // ██  INIT — wait for the portal shell to exist, then inject. Safe to run
  // ██  multiple times (all builders are idempotent / check-before-create).
  // ══════════════════════════════════════════════════════════════════════
  function init() {
    injectStyles();
    buildFab();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
