/* =============================================================
   NJTC Training & Development Analytics Module — SY 2025-26
   Live CSV-driven dashboard with 6 sub-tabs.
   Requires: Chart.js 4.x (global), parseCSVLine (global, shared-utils)
   ============================================================= */
(function () {
  'use strict';

  // ── DATA SOURCES ─────────────────────────────────────────────────────────
  var PD_URL = 'https://docs.google.com/spreadsheets/d/18LyHoN0c8BTD-ZVC0D4BpwD-rhq9ZBjgvFIXrsOKYM8/export?format=csv&gid=471085177';
  var INTAKE_URL = 'https://docs.google.com/spreadsheets/d/11OH4pBpKhJ80miKDnbKhQ2fB1ZHuRoQPn3i3oLmdruk/export?format=csv&gid=1298105082';
  var APPRENT_2PACX = '2PACX-1vT9gdaAh2P3wunk3s3drqByMKsiViTGiT7MON_7K8MKyGkdg2jqDGCgOoFwpSPZ8g';
  var APPRENT_PUBHTML = 'https://docs.google.com/spreadsheets/d/e/' + APPRENT_2PACX + '/pubhtml';
  var APPRENT_CSV_BASE = 'https://docs.google.com/spreadsheets/d/e/' + APPRENT_2PACX + '/pub?output=csv';
  var APPRENT_TAB_NAMES = {
    tutorObs: 'Tutor Observations',
    slObs: 'Site Leader Obs',
    otj: 'OTJ Checklist Template'
  };

  // ── STATE ────────────────────────────────────────────────────────────────
  var _state = { pd: null, intake: null, tutorObs: null, slObs: null, otj: null };
  var _loaded = { pd: false, intake: false, tutorObs: false, slObs: false, otj: false };
  var _gids = null;
  var _gidPromise = null;
  var _activeTab = 'pd';
  var _charts = {};
  var _tdBuilt = false;

  // ── CHART REGISTRY ───────────────────────────────────────────────────────
  function destroyChart(id) {
    if (_charts[id]) { try { _charts[id].destroy(); } catch (e) {} delete _charts[id]; }
  }
  function makeChart(id, config) {
    destroyChart(id);
    var canvas = document.getElementById(id);
    if (!canvas) return null;
    try { var ch = new Chart(canvas.getContext('2d'), config); _charts[id] = ch; return ch; } catch (e) { return null; }
  }

  // ── CSV PARSER ───────────────────────────────────────────────────────────
  function parseCSVFull(text) {
    var rows = [], row = [], cur = '', inQ = false;
    var s = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    for (var i = 0; i < s.length; i++) {
      var c = s[i];
      if (inQ) {
        if (c === '"') { if (s[i + 1] === '"') { cur += '"'; i++; } else inQ = false; }
        else cur += c;
      } else {
        if (c === '"') inQ = true;
        else if (c === ',') { row.push(cur.trim()); cur = ''; }
        else if (c === '\n') { row.push(cur.trim()); rows.push(row); row = []; cur = ''; }
        else cur += c;
      }
    }
    if (cur || row.length) { row.push(cur.trim()); rows.push(row); }
    return rows;
  }

  function rowsToObjects(rows, headerIdx) {
    var hi = (typeof headerIdx === 'number') ? headerIdx : 0;
    var headers = rows[hi] || [];
    var result = [];
    for (var i = hi + 1; i < rows.length; i++) {
      var r = rows[i];
      if (!r || !r.some(function (c) { return c && c.trim(); })) continue;
      var obj = {};
      for (var j = 0; j < headers.length; j++) {
        obj[headers[j]] = (r[j] || '').trim();
      }
      result.push(obj);
    }
    return result;
  }

  // ── FETCH CSV ────────────────────────────────────────────────────────────
  async function fetchCSV(url, headerRowIndex) {
    var resp = await fetch(url, { signal: AbortSignal.timeout(20000) });
    if (!resp.ok) throw new Error('HTTP ' + resp.status);
    var text = await resp.text();
    var rows = parseCSVFull(text);
    var hi = (typeof headerRowIndex === 'number') ? headerRowIndex : 0;
    return { rows: rows, objects: rowsToObjects(rows, hi) };
  }

  // ── SEASON UTILITIES ─────────────────────────────────────────────────────
  function dateToSeason(dateStr) {
    if (!dateStr) return null;
    var d = new Date(dateStr);
    if (isNaN(d)) return null;
    var m = d.getMonth() + 1;
    if (m >= 9 && m <= 11) return 'Fall';
    if (m === 12 || m <= 2) return 'Winter';
    if (m >= 3 && m <= 5) return 'Spring';
    return 'Summer';
  }
  function formatDateWithSeason(dateStr) {
    var season = dateToSeason(dateStr);
    if (!season) return dateStr || '';
    var d = new Date(dateStr);
    var label = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    return season + ' · ' + label;
  }
  function seasonBadge(dateOrSeason) {
    var season = dateOrSeason && dateOrSeason.length < 8 ? dateOrSeason : dateToSeason(dateOrSeason);
    if (!season) return '';
    var icons = { Fall: '🍂', Winter: '❄️', Spring: '🌸', Summer: '☀️' };
    return '<span class="badge-' + season.toLowerCase() + '">' + (icons[season] || '') + ' ' + season + '</span>';
  }

  // ── LOADING / ERROR STATES ───────────────────────────────────────────────
  function showLoading(el, msg) {
    el.innerHTML = '<div class="td-loading"><div class="td-spinner"></div>' + (msg || 'Loading live data…') + '</div>';
  }
  function showError(el, msg, retryFn) {
    var btnId = 'tdRetry_' + Date.now();
    el.innerHTML = '<div class="td-error"><div style="font-size:1.5rem;margin-bottom:.5rem">⚠️</div>' +
      '<strong>' + (msg || 'Could not load data') + '</strong>' +
      (retryFn ? '<br><button class="btn btn-secondary btn-sm" style="margin-top:.75rem" id="' + btnId + '">↺ Retry</button>' : '') +
      '</div>';
    if (retryFn) {
      var btn = document.getElementById(btnId);
      if (btn) btn.onclick = retryFn;
    }
  }

  // ── AVG HELPER ───────────────────────────────────────────────────────────
  function avg(arr, key) {
    var vals = arr.map(function (r) { return parseFloat(r[key]); }).filter(function (v) { return !isNaN(v); });
    if (!vals.length) return null;
    return vals.reduce(function (a, b) { return a + b; }, 0) / vals.length;
  }
  function avgArr(arr) {
    var vals = arr.filter(function (v) { return !isNaN(parseFloat(v)); }).map(parseFloat);
    if (!vals.length) return null;
    return vals.reduce(function (a, b) { return a + b; }, 0) / vals.length;
  }
  function countBy(arr, key) {
    var map = {};
    arr.forEach(function (r) { var v = r[key] || 'Unknown'; map[v] = (map[v] || 0) + 1; });
    return Object.entries(map).sort(function (a, b) { return b[1] - a[1]; });
  }
  function isObserved(cell) {
    return cell && cell.trim() !== '' && cell.trim().toUpperCase() !== 'N/A';
  }

  // ── GID DISCOVERY (Apprenticeship DB) ────────────────────────────────────
  async function discoverGIDs() {
    if (_gids) return _gids;
    if (_gidPromise) return _gidPromise;
    _gidPromise = (async function () {
      try {
        var resp = await fetch(APPRENT_PUBHTML, { signal: AbortSignal.timeout(15000) });
        if (!resp.ok) throw new Error('pubhtml ' + resp.status);
        var html = await resp.text();
        // Extract tab links — look for sheet-tab links with name attributes
        var gids = {};
        var tabMatches = [...html.matchAll(/data-sheet-index="(\d+)"[^>]*?title="([^"]+)"/g)];
        if (!tabMatches.length) {
          // Fallback: look for gid= params alongside tab names in any form
          tabMatches = [...html.matchAll(/gid=(\d+)[^"]*"[^>]*>([^<]+)</g)];
        }
        // Also try li elements with onclick containing gid
        var gidMatches = [...html.matchAll(/[?&]gid=(\d+)/g)];
        var tabNameMatches = [...html.matchAll(/class="[^"]*tab[^"]*"[^>]*id="[^"]*"[^>]*>([^<]+)</gi)];
        // Try structured approach: find tab names near gid numbers
        var allGidRefs = [...html.matchAll(/gid%3D(\d+)|gid=(\d+)/g)];
        var uniqueGids = [...new Set(allGidRefs.map(function (m) { return parseInt(m[1] || m[2], 10); }))].filter(function (n) { return !isNaN(n); });

        // Probe each GID and identify by header content
        var results = await Promise.all(uniqueGids.slice(0, 10).map(async function (gid) {
          try {
            var r = await fetch(APPRENT_CSV_BASE + '&gid=' + gid, { signal: AbortSignal.timeout(10000) });
            if (!r.ok) return null;
            var t = await r.text();
            var rows = parseCSVFull(t);
            // Check rows 0 and 1 for header keywords
            var hdrs = (rows[0] || []).concat(rows[1] || []).join('|').toLowerCase();
            return { gid: gid, hdrs: hdrs, rows: rows };
          } catch (e) { return null; }
        }));

        for (var res of results.filter(Boolean)) {
          var h = res.hdrs;
          if (h.includes('tutor name') && h.includes('active status')) gids.tutorObs = res.gid;
          else if (h.includes('site leader') && h.includes('observation month') && !h.includes('tutor name')) gids.slObs = res.gid;
          else if (h.includes('competency code') || h.includes('activity / task') || h.includes('mark y')) gids.otj = res.gid;
        }

        _gids = gids;
        _gidPromise = null;
        return gids;
      } catch (e) {
        _gidPromise = null;
        console.warn('[TD] GID discovery failed:', e.message);
        return {};
      }
    })();
    return _gidPromise;
  }

  // ── TAB CONTROLLER ───────────────────────────────────────────────────────
  function tdShowTab(tab, btn) {
    _activeTab = tab;
    document.querySelectorAll('.td-tab-content').forEach(function (el) { el.style.display = 'none'; });
    document.querySelectorAll('#tdTabNav .pst-tab').forEach(function (b) { b.classList.remove('active'); });
    var panel = document.getElementById('td-content-' + tab);
    if (panel) panel.style.display = '';
    if (btn) btn.classList.add('active');
    else {
      var b = document.getElementById('tdTab-' + tab);
      if (b) b.classList.add('active');
    }
    if (!_loaded[tab]) loadTab(tab);
  }

  function loadTab(tab) {
    if (tab === 'pd') loadPD();
    else if (tab === 'intake') loadIntake();
    else if (tab === 'tutor-obs') loadTutorObs();
    else if (tab === 'sl-obs') loadSLObs();
    else if (tab === 'otj') loadOTJ();
    else if (tab === 'mgmt') loadMgmt();
  }

  function tdRefresh() {
    _loaded = { pd: false, intake: false, 'tutor-obs': false, 'sl-obs': false, otj: false, mgmt: false };
    _state = { pd: null, intake: null, tutorObs: null, slObs: null, otj: null };
    _gids = null;
    Object.keys(_charts).forEach(destroyChart);
    loadTab(_activeTab);
  }


  // ═══════════════════════════════════════════════════════════════════════
  //  SUB-TAB 1 · PD SESSIONS OVERVIEW
  // ═══════════════════════════════════════════════════════════════════════
  var PD_RATING_FIELDS = [
    'The PD objectives were clearly communicated.',
    'The content was directly relevant to my site responsibilities.',
    'The facilitator\u2019s provided clear, actionable strategies I can use immediately.',
    'The session allowed for meaningful discussion and participation.',
    'Overall satisfaction with this PD session'
  ];
  var PD_RATING_SHORT = ['Objectives Clear', 'Relevant Content', 'Actionable Strategies', 'Participation', 'Overall Satisfaction'];

  async function loadPD() {
    var el = document.getElementById('td-content-pd');
    if (!el) return;
    showLoading(el, 'Loading PD Session data…');
    try {
      var result = await fetchCSV(PD_URL, 0);
      _state.pd = result.objects;
      _loaded.pd = true;
      renderPD(el, _state.pd);
    } catch (e) {
      showError(el, 'Could not load PD Session data: ' + e.message, loadPD);
    }
  }

  function renderPD(el, data) {
    if (!data || !data.length) { el.innerHTML = '<div class="td-error">No PD session data found.</div>'; return; }

    // Group by session
    var sessions = {};
    data.forEach(function (r) {
      var key = (r['PD Session Number'] || '').trim() + '||' + (r['Date of PD Session'] || '').trim();
      if (!sessions[key]) sessions[key] = [];
      sessions[key].push(r);
    });
    var sessionList = Object.entries(sessions).map(function (e) {
      var rows = e[1];
      var dateStr = rows[0]['Date of PD Session'] || '';
      return { key: e[0], rows: rows, date: new Date(dateStr), dateStr: dateStr,
        name: rows[0]['PD Session Number'] || 'Session', facilitators: [...new Set(rows.map(function(r){return r['Facilitator(s)']||'';}).filter(Boolean))].join(', ') };
    }).sort(function (a, b) { return b.date - a.date; });

    // KPIs
    var totalResp = data.length;
    var ratingField = 'Overall satisfaction with this PD session';
    var allRatings = data.map(function (r) { return parseFloat(r[ratingField]); }).filter(function (v) { return !isNaN(v); });
    var avgSat = allRatings.length ? (allRatings.reduce(function (a, b) { return a + b; }, 0) / allRatings.length) : null;
    var recYes = data.filter(function (r) { return (r['Would you recommend this PD session to other sites?'] || '').toLowerCase().includes('yes'); }).length;
    var recPct = data.filter(function (r) { return r['Would you recommend this PD session to other sites?']; }).length;
    var recPctVal = recPct ? Math.round(recYes / recPct * 100) : null;
    var latestSession = sessionList[0];
    var latestAvg = latestSession ? avgArr(latestSession.rows.map(function (r) { return r[ratingField]; })) : null;

    // Focus areas (multi-select)
    var focusMap = {};
    data.forEach(function (r) {
      var raw = r['What focus areas need additional support?'] || '';
      raw.split(',').forEach(function (f) {
        var tag = f.trim();
        if (tag) focusMap[tag] = (focusMap[tag] || 0) + 1;
      });
    });
    var focusEntries = Object.entries(focusMap).sort(function (a, b) { return b[1] - a[1]; });

    var html = '<div class="ta-grid ta-grid-4" style="margin-bottom:1.5rem">' +
      kpiTile('📋', sessionList.length, 'PD Sessions', '#003087') +
      kpiTile('📝', totalResp, 'Total Responses', '#e76f51') +
      kpiTile('⭐', avgSat !== null ? avgSat.toFixed(1) + '/5' : '—', 'Avg Satisfaction', avgSat !== null && avgSat >= 4 ? '#059669' : '#d97706') +
      kpiTile('👍', recPctVal !== null ? recPctVal + '%' : '—', 'Would Recommend', recPctVal !== null && recPctVal >= 80 ? '#059669' : '#d97706') +
      '</div>';

    // Session cards
    html += '<div style="margin-bottom:1.5rem">';
    html += '<div class="ta-card-title" style="font-size:.9rem;font-weight:700;color:var(--navy);margin-bottom:.875rem">📋 PD Session Summaries</div>';
    html += '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(380px,1fr));gap:1rem">';
    sessionList.forEach(function (sess) {
      var rows = sess.rows;
      var sAvg = {};
      PD_RATING_FIELDS.forEach(function (f, i) {
        sAvg[i] = avgArr(rows.map(function (r) { return r[f]; }));
      });
      var sessRecYes = rows.filter(function (r) { return (r['Would you recommend this PD session to other sites?'] || '').toLowerCase().includes('yes'); }).length;
      var sessRecPct = rows.filter(function (r) { return r['Would you recommend this PD session to other sites?']; }).length;
      var sessRecPctVal = sessRecPct ? Math.round(sessRecYes / sessRecPct * 100) : null;
      var sessFocus = {};
      rows.forEach(function (r) {
        (r['What focus areas need additional support?'] || '').split(',').forEach(function (f) {
          var tag = f.trim(); if (tag) sessFocus[tag] = (sessFocus[tag] || 0) + 1;
        });
      });
      var topFocus = Object.entries(sessFocus).sort(function (a, b) { return b[1] - a[1]; }).slice(0, 3);

      html += '<div class="ta-card" style="border-left:4px solid var(--training)">';
      html += '<div style="display:flex;align-items:center;justify-content:space-between;gap:.5rem;margin-bottom:.75rem">';
      html += '<div><span style="font-weight:800;font-size:1rem;color:var(--navy)">' + esc(sess.name) + '</span>';
      html += '&nbsp;' + seasonBadge(sess.dateStr) + '</div>';
      html += '<span style="font-size:.75rem;color:var(--muted)">' + rows.length + ' responses</span></div>';
      if (sess.facilitators) html += '<div style="font-size:.8rem;color:var(--text-2);margin-bottom:.625rem">Facilitated by: <strong>' + esc(sess.facilitators) + '</strong></div>';
      // Rating mini-bars
      html += '<div style="margin-bottom:.625rem">';
      PD_RATING_SHORT.forEach(function (label, i) {
        var v = sAvg[i];
        var pct = v !== null ? Math.round(v / 5 * 100) : 0;
        var color = v >= 4 ? '#059669' : v >= 3 ? '#d97706' : '#b91c1c';
        html += '<div style="display:flex;align-items:center;gap:.5rem;margin-bottom:.25rem;font-size:.75rem">';
        html += '<div style="width:130px;flex-shrink:0;color:var(--text-2);overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="' + esc(label) + '">' + esc(label) + '</div>';
        html += '<div style="flex:1;height:6px;background:#e2e8f0;border-radius:3px;overflow:hidden"><div style="width:' + pct + '%;height:100%;background:' + color + ';border-radius:3px"></div></div>';
        html += '<span style="font-weight:700;color:' + color + ';min-width:28px;text-align:right">' + (v !== null ? v.toFixed(1) : '—') + '</span>';
        html += '</div>';
      });
      html += '</div>';
      if (topFocus.length) {
        html += '<div style="font-size:.75rem;color:var(--muted);margin-bottom:.25rem">Top support needs:</div>';
        html += '<div style="display:flex;flex-wrap:wrap;gap:.3rem">';
        topFocus.forEach(function (f) {
          html += '<span style="background:#fff0e0;color:#92400e;padding:.15rem .45rem;border-radius:12px;font-size:.7rem;font-weight:600">' + esc(f[0]) + ' (' + f[1] + ')</span>';
        });
        html += '</div>';
      }
      html += '<div style="margin-top:.625rem;font-size:.75rem;color:var(--muted)">Would recommend: <strong style="color:' + (sessRecPctVal >= 80 ? '#059669' : '#d97706') + '">' + (sessRecPctVal !== null ? sessRecPctVal + '%' : '—') + '</strong></div>';
      html += '</div>';
    });
    html += '</div></div>';

    // Charts row
    html += '<div class="ta-grid ta-grid-2" style="margin-bottom:1.5rem">';
    // Focus areas bar
    html += '<div class="ta-card"><div class="ta-card-title">🎯 Focus Areas Needing Support (All Sessions)</div>';
    if (focusEntries.length) {
      var maxFocus = focusEntries[0][1];
      html += focusEntries.map(function (e) {
        return '<div class="ta-bar-row"><div class="ta-bar-label" title="' + esc(e[0]) + '">' + esc(e[0].length > 40 ? e[0].slice(0, 38) + '…' : e[0]) + '</div>' +
          '<div class="ta-bar-track"><div class="ta-bar-fill" style="width:' + Math.round(e[1] / maxFocus * 100) + '%;background:#e76f51"></div></div>' +
          '<div class="ta-bar-count">' + e[1] + '</div></div>';
      }).join('');
    } else { html += '<div style="color:var(--muted);font-size:.875rem">No focus area data.</div>'; }
    html += '</div>';

    // Role breakdown donut
    html += '<div class="ta-card"><div class="ta-card-title">👥 Respondent Role Breakdown</div>';
    html += '<div class="td-chart-wrap-sm"><canvas id="tdPDRoleChart"></canvas></div></div>';
    html += '</div>';

    // Rating trends chart
    if (sessionList.length >= 2) {
      html += '<div class="ta-card" style="margin-bottom:1.5rem">';
      html += '<div class="ta-card-title">📈 Rating Trends by PD Session (Goal Line: 4.0)</div>';
      html += '<div class="td-chart-wrap"><canvas id="tdPDTrendChart"></canvas></div>';
      html += '</div>';
    }

    // Open responses
    html += '<div class="ta-card" style="margin-bottom:1.5rem">';
    html += '<div class="ta-card-title">💬 Open Responses — Key Takeaways</div>';
    var takeaways = data.filter(function (r) { return r['What is one key takeaway or strategy you plan to apply at your site?']; })
      .map(function (r) { return { text: r['What is one key takeaway or strategy you plan to apply at your site?'], role: r['Role'] || '', session: r['PD Session Number'] || '' }; });
    if (takeaways.length) {
      html += '<div style="display:flex;flex-direction:column;gap:.5rem;max-height:400px;overflow-y:auto">';
      takeaways.slice(0, 30).forEach(function (t) {
        html += '<div style="padding:.625rem .875rem;background:var(--surface-2);border-radius:8px;border-left:3px solid var(--training)">';
        html += '<div style="font-size:.875rem;color:var(--text)">' + esc(t.text) + '</div>';
        html += '<div style="font-size:.72rem;color:var(--muted);margin-top:.25rem">' + esc(t.role) + (t.session ? ' · ' + esc(t.session) : '') + '</div>';
        html += '</div>';
      });
      html += '</div>';
      if (takeaways.length > 30) html += '<div style="text-align:center;padding:.5rem;font-size:.8rem;color:var(--muted)">Showing 30 of ' + takeaways.length + ' responses</div>';
    } else { html += '<div style="color:var(--muted)">No open responses found.</div>'; }
    html += '</div>';

    el.innerHTML = html;

    // Render role donut
    var roleCounts = countBy(data, 'Role');
    var roleLabels = roleCounts.map(function (e) { return e[0]; });
    var roleData = roleCounts.map(function (e) { return e[1]; });
    makeChart('tdPDRoleChart', {
      type: 'doughnut',
      data: { labels: roleLabels, datasets: [{ data: roleData, backgroundColor: ['#003087','#e76f51','#2a9d8f','#7b2d8b','#f0a500','#457b9d'], borderWidth: 2 }] },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { font: { size: 11 } } }, tooltip: { enabled: true } } }
    });

    // Rating trends chart
    if (sessionList.length >= 2) {
      var labels = sessionList.slice().reverse().map(function (s) { return s.name; });
      var colors = ['#003087','#e76f51','#2a9d8f','#7b2d8b','#f0a500'];
      var datasets = PD_RATING_SHORT.map(function (label, i) {
        var field = PD_RATING_FIELDS[i];
        return {
          label: label,
          data: sessionList.slice().reverse().map(function (s) { var v = avgArr(s.rows.map(function(r){return r[field];})); return v !== null ? +v.toFixed(2) : null; }),
          borderColor: colors[i], backgroundColor: colors[i] + '30',
          tension: 0.3, borderWidth: 2, pointRadius: 5, spanGaps: true
        };
      });
      datasets.push({ label: 'Goal (4.0)', data: labels.map(function () { return 4.0; }), borderColor: '#94a3b8', borderDash: [5, 5], borderWidth: 1.5, pointRadius: 0, fill: false });
      makeChart('tdPDTrendChart', {
        type: 'line',
        data: { labels: labels, datasets: datasets },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { font: { size: 11 } } }, tooltip: { enabled: true } }, scales: { y: { min: 1, max: 5, title: { display: true, text: 'Avg Rating' } } } }
      });
    }
  }


  // ═══════════════════════════════════════════════════════════════════════
  //  SUB-TAB 2 · NEW HIRE TRAINING INTAKE
  // ═══════════════════════════════════════════════════════════════════════
  async function loadIntake() {
    var el = document.getElementById('td-content-intake');
    if (!el) return;
    showLoading(el, 'Loading Training Intake data…');
    try {
      var result = await fetchCSV(INTAKE_URL, 1); // row 1 blank, row 2 (index 1) is header
      _state.intake = result.objects;
      _loaded.intake = true;
      renderIntake(el, _state.intake);
    } catch (e) {
      showError(el, 'Could not load Training Intake data: ' + e.message, loadIntake);
    }
  }

  function renderIntake(el, data) {
    if (!data || !data.length) { el.innerHTML = '<div class="td-error">No training intake data found.</div>'; return; }
    var roleKey = 'What is your role within NJTC? (Select one)';
    var certKey = 'What is your current certification status? (Select one)';
    var hireKey = 'Are you a new or returning hire? (Select one)';
    var effKey = 'Overall, how would you rate the effectiveness of the training? (1 = Did not meet expectations, 5 = Exceeded expectations)';
    var prepKey = 'After completing training, how prepared do you feel to begin working with scholars? (1 = Very unprepared, 5 = Extremely prepared)';
    var assetKey = 'Did the training help you understand and apply an asset-based mindset when working with scholars?';
    var moreAssetKey = 'Would you like additional training on implementing an asset-based mindset in training?';
    var districtKey = 'What District are you assigned to?';
    var schoolKey = 'What School Location are you assigned to?';
    var gradeKey = 'Which grade level(s) do you work with? (Select all that apply)';
    var gcAccessKey = 'How easy was it to access and navigate Google Classroom?';
    var gcOrgKey = 'How well-organized were the training modules, assessments, and resources in Google Classroom?';
    var gcLayoutKey = 'To what extent did the Google Classroom layout support your understanding of the training material?';
    var gcUpdateKey = 'How effective was Google Classroom in providing timely updates, announcements, or reminders regarding course work?';
    var gcTechKey = 'Were there any technical issues you experienced while using Google Classroom?';
    var gcUnderstandKey = 'Did you clearly understand how to use Google Classroom for all required tasks (e.g., submitting assignments, watching videos, completing assessments)?';
    var gcUseKey = 'What did you primarily use Google Classroom for?';
    var reflectKey = 'Please share 1-3 reflections from training, including strengths and areas for improvement.';
    var finalKey = 'Any final comments or feedback regarding your training experience?';

    var total = data.length;
    var newHires = data.filter(function (r) { return (r[hireKey] || '').toLowerCase().includes('new'); }).length;
    var certified = data.filter(function (r) { return (r[certKey] || '').toLowerCase().includes('certified') && !(r[certKey] || '').toLowerCase().includes('non'); }).length;
    var avgEff = avg(data, effKey);
    var avgPrep = avg(data, prepKey);
    var wantMoreAsset = data.filter(function (r) { return (r[moreAssetKey] || '').toLowerCase().includes('yes'); }).length;
    var assetTotal = data.filter(function (r) { return r[moreAssetKey]; }).length;

    var html = '<div class="ta-grid ta-grid-4" style="margin-bottom:1.5rem">' +
      kpiTile('📝', total, 'Total Responses', '#003087') +
      kpiTile('🆕', Math.round(newHires / total * 100) + '%', 'New Hires', '#e76f51') +
      kpiTile('🎓', Math.round(certified / total * 100) + '%', 'Certified', '#2a9d8f') +
      kpiTile('⭐', avgEff !== null ? avgEff.toFixed(1) + '/5' : '—', 'Avg Effectiveness', avgEff >= 4 ? '#059669' : '#d97706') +
      '</div>';

    html += '<div class="ta-grid ta-grid-3" style="margin-bottom:1.5rem">' +
      kpiTile('📚', avgPrep !== null ? avgPrep.toFixed(1) + '/5' : '—', 'Avg Preparedness', avgPrep >= 4 ? '#059669' : '#d97706') +
      kpiTile('💡', assetTotal ? Math.round(wantMoreAsset / assetTotal * 100) + '%' : '—', 'Want More Asset-Based Mindset Training', '#7b2d8b') +
      kpiTile('🏫', [...new Set(data.map(function (r) { return r[districtKey]; }).filter(Boolean))].length, 'Districts', '#457b9d') +
      '</div>';

    // Ratings panel
    var ratingItems = [
      { label: 'Training Effectiveness', key: effKey },
      { label: 'Structure & Itinerary Clarity', key: 'The training itinerary/setup was clear and well-structured. (1 = Strongly disagree, 5 = Strongly agree)' },
      { label: 'Materials Usefulness', key: 'The training materials (slides and videos) were useful in preparing me for my role. (1 = Strongly disagree, 5 = Strongly agree)' },
      { label: 'Trainer Knowledge', key: 'The trainers were knowledgeable and responsive to questions. (1 = Strongly disagree, 5 = Strongly agree)' },
      { label: 'Scholar Preparedness', key: prepKey },
      { label: 'Async Video Experience', key: 'The asynchronous videos allowed for a more individualized training experience. (1 = Strongly disagree, 5 = Strongly agree)' },
      { label: 'GC Ease of Access', key: gcAccessKey },
      { label: 'GC Organization', key: gcOrgKey },
      { label: 'GC Layout Support', key: gcLayoutKey },
      { label: 'GC Timely Updates', key: gcUpdateKey }
    ];

    html += '<div class="ta-card" style="margin-bottom:1.5rem">';
    html += '<div class="ta-card-title">📊 Training Ratings Summary</div>';
    ratingItems.forEach(function (item) {
      var v = avg(data, item.key);
      if (v === null) return;
      var pct = Math.round(v / 5 * 100);
      var color = v >= 4 ? '#059669' : v >= 3 ? '#d97706' : '#b91c1c';
      html += '<div style="display:flex;align-items:center;gap:.75rem;margin-bottom:.5rem;font-size:.8125rem">';
      html += '<div style="width:185px;flex-shrink:0;color:var(--text-2)">' + esc(item.label) + '</div>';
      html += '<div style="flex:1;height:8px;background:#e2e8f0;border-radius:4px;overflow:hidden"><div style="width:' + pct + '%;height:100%;background:' + color + ';border-radius:4px"></div></div>';
      html += '<span style="font-weight:700;color:' + color + ';min-width:36px;text-align:right">' + v.toFixed(1) + '/5</span>';
      html += '</div>';
    });
    html += '</div>';

    // Role + Hire Type donuts
    html += '<div class="ta-grid ta-grid-2" style="margin-bottom:1.5rem">';
    html += '<div class="ta-card"><div class="ta-card-title">👥 Role Distribution</div><div class="td-chart-wrap-sm"><canvas id="tdIntakeRoleChart"></canvas></div></div>';
    html += '<div class="ta-card"><div class="ta-card-title">🆕 Hire Type Distribution</div><div class="td-chart-wrap-sm"><canvas id="tdIntakeHireChart"></canvas></div></div>';
    html += '</div>';

    // District/School distribution
    var distMap = {};
    data.forEach(function (r) {
      var d = r[districtKey] || 'Unknown'; var s = r[schoolKey] || 'Unknown';
      if (!distMap[d]) distMap[d] = {};
      distMap[d][s] = (distMap[d][s] || 0) + 1;
    });
    html += '<div class="ta-card" style="margin-bottom:1.5rem">';
    html += '<div class="ta-card-title">🏫 District & School Distribution</div>';
    html += '<div style="overflow-x:auto"><table class="ta-table"><thead><tr><th>District</th><th>School</th><th>Respondents</th></tr></thead><tbody>';
    Object.entries(distMap).sort(function (a, b) { var sa = Object.values(a[1]).reduce(function (x, y) { return x + y; }, 0); var sb = Object.values(b[1]).reduce(function (x, y) { return x + y; }, 0); return sb - sa; }).forEach(function (de) {
      var dist = de[0]; var schools = de[1];
      Object.entries(schools).sort(function (a, b) { return b[1] - a[1]; }).forEach(function (se, si) {
        html += '<tr><td>' + (si === 0 ? esc(dist) : '') + '</td><td>' + esc(se[0]) + '</td><td><strong>' + se[1] + '</strong></td></tr>';
      });
    });
    html += '</tbody></table></div></div>';

    // Grade levels
    var gradeMap = {};
    data.forEach(function (r) {
      (r[gradeKey] || '').split(',').forEach(function (g) {
        var tag = g.trim(); if (tag) gradeMap[tag] = (gradeMap[tag] || 0) + 1;
      });
    });
    var gradeEntries = Object.entries(gradeMap).sort(function (a, b) { return b[1] - a[1]; });
    html += '<div class="ta-card" style="margin-bottom:1.5rem">';
    html += '<div class="ta-card-title">📚 Grade Levels Served</div>';
    if (gradeEntries.length) {
      var maxG = gradeEntries[0][1];
      html += gradeEntries.map(function (e) {
        return '<div class="ta-bar-row"><div class="ta-bar-label">' + esc(e[0]) + '</div><div class="ta-bar-track"><div class="ta-bar-fill" style="width:' + Math.round(e[1] / maxG * 100) + '%;background:#457b9d"></div></div><div class="ta-bar-count">' + e[1] + '</div></div>';
      }).join('');
    } else { html += '<div style="color:var(--muted)">No grade data.</div>'; }
    html += '</div>';

    // Google Classroom panel
    var gcTechYes = data.filter(function (r) { var v = (r[gcTechKey] || '').toLowerCase(); return v.includes('yes') || v.includes('issue') || (v.length > 5 && !v.includes('no') && !v.includes('none')); }).length;
    var gcUnderstandYes = data.filter(function (r) { return (r[gcUnderstandKey] || '').toLowerCase().includes('yes'); }).length;
    var gcUnderstandTotal = data.filter(function (r) { return r[gcUnderstandKey]; }).length;
    var gcUseMap = {};
    data.forEach(function (r) {
      (r[gcUseKey] || '').split(',').forEach(function (v) {
        var tag = v.trim(); if (tag) gcUseMap[tag] = (gcUseMap[tag] || 0) + 1;
      });
    });
    html += '<div class="ta-card" style="margin-bottom:1.5rem">';
    html += '<div class="ta-card-title">🖥️ Google Classroom Experience</div>';
    html += '<div class="ta-grid ta-grid-3" style="margin-bottom:1rem">' +
      kpiTile('🔧', data.length ? Math.round(gcTechYes / data.length * 100) + '%' : '—', 'Had Tech Issues', gcTechYes > 0 ? '#d97706' : '#059669') +
      kpiTile('✅', gcUnderstandTotal ? Math.round(gcUnderstandYes / gcUnderstandTotal * 100) + '%' : '—', 'Understood How to Use GC', '#059669') +
      kpiTile('📊', avg(data, gcAccessKey) !== null ? avg(data, gcAccessKey).toFixed(1) + '/5' : '—', 'Avg GC Access Ease', '#7b2d8b') +
      '</div>';
    if (Object.keys(gcUseMap).length) {
      html += '<div style="font-size:.8rem;color:var(--muted);margin-bottom:.5rem">Primary uses of GC:</div>';
      var maxGCU = Math.max(...Object.values(gcUseMap));
      html += Object.entries(gcUseMap).sort(function (a, b) { return b[1] - a[1]; }).slice(0, 8).map(function (e) {
        return '<div class="ta-bar-row"><div class="ta-bar-label">' + esc(e[0].length > 35 ? e[0].slice(0, 33) + '…' : e[0]) + '</div><div class="ta-bar-track"><div class="ta-bar-fill" style="width:' + Math.round(e[1] / maxGCU * 100) + '%;background:#7b2d8b"></div></div><div class="ta-bar-count">' + e[1] + '</div></div>';
      }).join('');
    }
    html += '</div>';

    // Open feedback
    var reflections = data.filter(function (r) { return r[reflectKey] && r[reflectKey].length > 10; });
    html += '<div class="ta-card">';
    html += '<div class="ta-card-title">💬 Training Reflections</div>';
    html += '<div style="display:flex;flex-direction:column;gap:.5rem;max-height:400px;overflow-y:auto">';
    reflections.slice(0, 20).forEach(function (r) {
      html += '<div style="padding:.625rem .875rem;background:var(--surface-2);border-radius:8px;border-left:3px solid #2a9d8f">';
      html += '<div style="font-size:.875rem">' + esc(r[reflectKey]) + '</div>';
      html += '<div style="font-size:.72rem;color:var(--muted);margin-top:.25rem">' + esc(r[roleKey] || '') + (r[hireKey] ? ' · ' + esc(r[hireKey]) : '') + '</div>';
      html += '</div>';
    });
    if (!reflections.length) html += '<div style="color:var(--muted)">No reflection data found.</div>';
    html += '</div></div>';

    el.innerHTML = html;

    var roleCounts = countBy(data, roleKey);
    makeChart('tdIntakeRoleChart', { type: 'doughnut', data: { labels: roleCounts.map(function (e) { return e[0]; }), datasets: [{ data: roleCounts.map(function (e) { return e[1]; }), backgroundColor: ['#003087','#e76f51','#2a9d8f','#7b2d8b','#f0a500'], borderWidth: 2 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { font: { size: 11 } } }, tooltip: { enabled: true } } } });
    var hireCounts = countBy(data, hireKey);
    makeChart('tdIntakeHireChart', { type: 'doughnut', data: { labels: hireCounts.map(function (e) { return e[0]; }), datasets: [{ data: hireCounts.map(function (e) { return e[1]; }), backgroundColor: ['#003087','#e76f51','#2a9d8f'], borderWidth: 2 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { font: { size: 11 } } }, tooltip: { enabled: true } } } });
  }


  // ═══════════════════════════════════════════════════════════════════════
  //  SUB-TAB 3 · TUTOR OBSERVATIONS
  // ═══════════════════════════════════════════════════════════════════════
  var OBS_MONTHS = ['Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr'];

  async function loadTutorObs() {
    var el = document.getElementById('td-content-tutor-obs');
    if (!el) return;
    showLoading(el, 'Discovering Apprenticeship database tabs…');
    try {
      var gids = await discoverGIDs();
      if (!gids.tutorObs && gids.tutorObs !== 0) {
        // Try default gid=0
        gids.tutorObs = 0;
      }
      var url = APPRENT_CSV_BASE + '&gid=' + gids.tutorObs;
      var result = await fetchCSV(url, 1); // row 0 = title, row 1 = header
      _state.tutorObs = result.objects;
      _loaded['tutor-obs'] = true;
      renderTutorObs(el, _state.tutorObs);
    } catch (e) {
      showError(el, 'Could not load Tutor Observations: ' + e.message, loadTutorObs);
    }
  }

  function renderTutorObs(el, data) {
    if (!data || !data.length) { el.innerHTML = '<div class="td-error">No tutor observation data found. The Apprenticeship Database tab may not be published yet.</div>'; return; }

    var active = data.filter(function (r) { return (r['Active Status'] || '').toLowerCase() === 'active'; });
    var terminated = data.filter(function (r) { return (r['Active Status'] || '').toLowerCase().includes('terminat'); });

    // Observation counts per active tutor
    var activeWithObs = active.filter(function (r) { return OBS_MONTHS.some(function (m) { return isObserved(r[m]); }); });
    var activeWith3Plus = active.filter(function (r) { return OBS_MONTHS.filter(function (m) { return isObserved(r[m]); }).length >= 3; });
    var totalObsEvents = 0;
    active.forEach(function (r) { OBS_MONTHS.forEach(function (m) { if (isObserved(r[m])) totalObsEvents++; }); });

    var html = '<div class="ta-grid ta-grid-4" style="margin-bottom:1.5rem">' +
      kpiTile('✅', active.length, 'Active Tutors', '#003087') +
      kpiTile('🔴', terminated.length, 'Terminated', '#b91c1c') +
      kpiTile('👁️', active.length ? Math.round(activeWithObs.length / active.length * 100) + '%' : '—', '≥1 Obs This Year', activeWithObs.length / Math.max(active.length, 1) >= 0.8 ? '#059669' : '#d97706') +
      kpiTile('📊', active.length ? Math.round(activeWith3Plus.length / active.length * 100) + '%' : '—', '3+ Months Observed', '#7b2d8b') +
      '</div>';

    html += '<div class="ta-grid ta-grid-2" style="margin-bottom:1.5rem">';

    // Coverage by month bar chart
    html += '<div class="ta-card"><div class="ta-card-title">📅 Observation Coverage by Month (Active Tutors)</div>';
    html += '<div class="td-chart-wrap"><canvas id="tdTutorMonthChart"></canvas></div></div>';

    // Obs rate by district
    var districtMap = {};
    active.forEach(function (r) {
      var d = r['District'] || 'Unknown';
      if (!districtMap[d]) districtMap[d] = { total: 0, observed: 0 };
      districtMap[d].total++;
      if (OBS_MONTHS.some(function (m) { return isObserved(r[m]); })) districtMap[d].observed++;
    });
    var districtEntries = Object.entries(districtMap).sort(function (a, b) { return b[1].total - a[1].total; });

    html += '<div class="ta-card"><div class="ta-card-title">🏫 Observation Rate by District (Benchmark: 80%)</div>';
    html += '<div style="max-height:320px;overflow-y:auto">';
    districtEntries.forEach(function (e) {
      var d = e[0]; var v = e[1];
      var pct = v.total ? Math.round(v.observed / v.total * 100) : 0;
      var color = pct >= 80 ? '#059669' : pct >= 50 ? '#d97706' : '#b91c1c';
      html += '<div style="display:flex;align-items:center;gap:.5rem;margin-bottom:.4rem;font-size:.8rem">';
      html += '<div style="width:140px;flex-shrink:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--text-2)" title="' + esc(d) + '">' + esc(d.length > 22 ? d.slice(0, 20) + '…' : d) + '</div>';
      html += '<div style="flex:1;height:8px;background:#e2e8f0;border-radius:4px;overflow:hidden;position:relative">';
      html += '<div style="width:' + pct + '%;height:100%;background:' + color + ';border-radius:4px"></div>';
      html += '<div style="position:absolute;top:0;left:80%;width:1px;height:100%;background:#94a3b8"></div>';
      html += '</div><span style="font-weight:700;color:' + color + ';min-width:36px;text-align:right">' + pct + '%</span>';
      html += '<span style="font-size:.7rem;color:var(--muted);min-width:50px">(' + v.observed + '/' + v.total + ')</span>';
      html += '</div>';
    });
    html += '</div></div></div>';

    // Filters
    var regions = [...new Set(data.map(function (r) { return r['Region'] || ''; }).filter(Boolean))].sort();
    var districts = [...new Set(data.map(function (r) { return r['District'] || ''; }).filter(Boolean))].sort();
    var roles = [...new Set(data.map(function (r) { return r['Role'] || ''; }).filter(Boolean))].sort();

    html += '<div class="ta-card" style="margin-bottom:1.5rem">';
    html += '<div class="ta-card-title">📋 Tutor Observation Status</div>';
    html += '<div style="display:flex;gap:.625rem;flex-wrap:wrap;margin-bottom:1rem;align-items:center">';
    html += '<select class="filter-select" id="tdTOFilterRegion" onchange="tdTOFilter()"><option value="">All Regions</option>' + regions.map(function (r) { return '<option>' + esc(r) + '</option>'; }).join('') + '</select>';
    html += '<select class="filter-select" id="tdTOFilterDistrict" onchange="tdTOFilter()"><option value="">All Districts</option>' + districts.map(function (d) { return '<option>' + esc(d) + '</option>'; }).join('') + '</select>';
    html += '<select class="filter-select" id="tdTOFilterRole" onchange="tdTOFilter()"><option value="">All Roles</option>' + roles.map(function (r) { return '<option>' + esc(r) + '</option>'; }).join('') + '</select>';
    html += '<select class="filter-select" id="tdTOFilterStatus" onchange="tdTOFilter()"><option value="">All Statuses</option><option>Active</option><option>Terminated</option></select>';
    html += '<span id="tdTOCount" style="font-size:.75rem;color:var(--muted)"></span>';
    html += '</div>';
    html += '<div id="tdTOTableWrap" style="overflow-x:auto"></div>';
    html += '</div>';

    // Termination tracker
    if (terminated.length) {
      html += '<div class="ta-card">';
      html += '<div class="ta-card-title">🔴 Termination Tracker (' + terminated.length + ' tutors)</div>';
      html += '<div style="overflow-x:auto"><table class="ta-table"><thead><tr><th>Tutor Name</th><th>Role</th><th>District</th><th>School</th></tr></thead><tbody>';
      terminated.forEach(function (r) {
        html += '<tr><td><strong>' + esc(r['Tutor Name'] || r['Master List Name'] || '—') + '</strong></td><td style="font-size:.75rem">' + esc(r['Role'] || '—') + '</td><td style="font-size:.75rem">' + esc(r['District'] || '—') + '</td><td style="font-size:.75rem">' + esc(r['School'] || '—') + '</td></tr>';
      });
      html += '</tbody></table></div></div>';
    }

    el.innerHTML = html;
    window._tdTutorData = data;

    // Month chart
    var monthCounts = OBS_MONTHS.map(function (m) { return active.filter(function (r) { return isObserved(r[m]); }).length; });
    makeChart('tdTutorMonthChart', {
      type: 'bar',
      data: { labels: OBS_MONTHS, datasets: [{ label: 'Tutors Observed', data: monthCounts, backgroundColor: '#003087cc', borderRadius: 6, borderSkipped: false }] },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { enabled: true } }, scales: { y: { beginAtZero: true, title: { display: true, text: 'Tutors Observed' } } } }
    });

    tdTOFilter();
  }

  window.tdTOFilter = function () {
    var data = window._tdTutorData || [];
    var region = (document.getElementById('tdTOFilterRegion') || {}).value || '';
    var district = (document.getElementById('tdTOFilterDistrict') || {}).value || '';
    var role = (document.getElementById('tdTOFilterRole') || {}).value || '';
    var status = (document.getElementById('tdTOFilterStatus') || {}).value || '';
    var filtered = data.filter(function (r) {
      return (!region || r['Region'] === region) && (!district || r['District'] === district) && (!role || r['Role'] === role) && (!status || (r['Active Status'] || '').toLowerCase().includes(status.toLowerCase()));
    });
    var wrap = document.getElementById('tdTOTableWrap');
    var count = document.getElementById('tdTOCount');
    if (count) count.textContent = filtered.length + ' tutors';
    if (!wrap) return;
    var html = '<table class="ta-table"><thead><tr><th>Tutor Name</th><th>Role</th><th>District</th><th>School</th><th>Site Leader</th><th>Status</th>' + OBS_MONTHS.map(function (m) { return '<th>' + m + '</th>'; }).join('') + '<th>Total Obs</th></tr></thead><tbody>';
    filtered.slice(0, 200).forEach(function (r) {
      var total = OBS_MONTHS.filter(function (m) { return isObserved(r[m]); }).length;
      var isActive = (r['Active Status'] || '').toLowerCase() === 'active';
      html += '<tr>';
      html += '<td><strong>' + esc(r['Tutor Name'] || r['Master List Name'] || '—') + '</strong></td>';
      html += '<td style="font-size:.75rem">' + esc(r['Role'] || '—') + '</td>';
      html += '<td style="font-size:.75rem">' + esc(r['District'] || '—') + '</td>';
      html += '<td style="font-size:.75rem">' + esc(r['School'] || '—') + '</td>';
      html += '<td style="font-size:.75rem">' + esc(r['Site Leader'] || '—') + '</td>';
      html += '<td><span style="padding:.15rem .4rem;border-radius:4px;font-size:.7rem;font-weight:700;background:' + (isActive ? '#dcfce7' : '#fee2e2') + ';color:' + (isActive ? '#166534' : '#b91c1c') + '">' + esc(r['Active Status'] || '—') + '</span></td>';
      OBS_MONTHS.forEach(function (m) {
        var v = r[m] || '';
        var obs = isObserved(v);
        var isNA = v.trim().toUpperCase() === 'N/A';
        var bg = obs ? '#dcfce7' : isNA ? '#f3f4f6' : '';
        var color = obs ? '#166534' : isNA ? '#9ca3af' : '#b91c1c';
        html += '<td style="text-align:center;background:' + bg + ';font-size:.75rem;color:' + color + ';font-weight:' + (obs ? '700' : '400') + '">' + (obs ? '✓' : isNA ? 'N/A' : '—') + '</td>';
      });
      html += '<td style="text-align:center;font-weight:800;color:' + (total >= 3 ? '#059669' : total > 0 ? '#d97706' : '#b91c1c') + '">' + total + '</td>';
      html += '</tr>';
    });
    html += '</tbody></table>';
    if (filtered.length > 200) html += '<div style="padding:.5rem;text-align:center;font-size:.8rem;color:var(--muted)">Showing 200 of ' + filtered.length + ' tutors. Use filters to narrow.</div>';
    wrap.innerHTML = html;
  };


  // ═══════════════════════════════════════════════════════════════════════
  //  SUB-TAB 4 · SITE LEADER OBSERVATIONS
  // ═══════════════════════════════════════════════════════════════════════
  async function loadSLObs() {
    var el = document.getElementById('td-content-sl-obs');
    if (!el) return;
    showLoading(el, 'Loading Site Leader Observation data…');
    try {
      var gids = await discoverGIDs();
      if (!gids.slObs && gids.slObs !== 0) gids.slObs = 1;
      var url = APPRENT_CSV_BASE + '&gid=' + gids.slObs;
      var result = await fetchCSV(url, 1);
      _state.slObs = result.objects;
      _loaded['sl-obs'] = true;
      renderSLObs(el, _state.slObs);
    } catch (e) {
      showError(el, 'Could not load Site Leader Observations: ' + e.message, loadSLObs);
    }
  }

  function renderSLObs(el, data) {
    if (!data || !data.length) { el.innerHTML = '<div class="td-error">No site leader observation data found.</div>'; return; }

    var monthKey = 'Observation Month';
    var hasDone = function (r) { var m = r[monthKey] || ''; return m && m !== 'N/A' && m.trim() !== ''; };
    var totalSLs = [...new Set(data.map(function (r) { return r['Site Leader'] || ''; }).filter(Boolean))].length;
    var completed = data.filter(hasDone).length;
    var total = data.filter(function (r) { return r[monthKey] !== undefined; }).length;
    var pctComplete = total ? Math.round(completed / total * 100) : 0;

    var monthCounts = {};
    data.filter(hasDone).forEach(function (r) {
      var m = r[monthKey] || 'Unknown';
      monthCounts[m] = (monthCounts[m] || 0) + 1;
    });
    var bestMonth = Object.entries(monthCounts).sort(function (a, b) { return b[1] - a[1]; })[0];
    var worstMonth = Object.entries(monthCounts).sort(function (a, b) { return a[1] - b[1]; })[0];

    var html = '<div class="ta-grid ta-grid-4" style="margin-bottom:1.5rem">' +
      kpiTile('👤', totalSLs, 'Site Leaders Tracked', '#003087') +
      kpiTile('✅', completed, 'Obs Completed', '#059669') +
      kpiTile('📊', pctComplete + '%', 'Completion Rate', pctComplete >= 80 ? '#059669' : pctComplete >= 50 ? '#d97706' : '#b91c1c') +
      kpiTile('🏆', bestMonth ? bestMonth[0] : '—', 'Highest Month', '#7b2d8b') +
      '</div>';

    // Log table
    var districts = [...new Set(data.map(function (r) { return r['District'] || ''; }).filter(Boolean))].sort();
    var sls = [...new Set(data.map(function (r) { return r['Site Leader'] || ''; }).filter(Boolean))].sort();
    var months = [...new Set(data.map(function (r) { return r[monthKey] || ''; }).filter(function (m) { return m && m !== 'N/A'; }))].sort();

    html += '<div class="ta-card" style="margin-bottom:1.5rem">';
    html += '<div class="ta-card-title">📋 Site Leader Observation Log</div>';
    html += '<div style="display:flex;gap:.625rem;flex-wrap:wrap;margin-bottom:1rem;align-items:center">';
    html += '<select class="filter-select" id="tdSLFilterDistrict" onchange="tdSLFilter()"><option value="">All Districts</option>' + districts.map(function (d) { return '<option>' + esc(d) + '</option>'; }).join('') + '</select>';
    html += '<select class="filter-select" id="tdSLFilterSL" onchange="tdSLFilter()"><option value="">All Site Leaders</option>' + sls.map(function (s) { return '<option>' + esc(s) + '</option>'; }).join('') + '</select>';
    html += '<select class="filter-select" id="tdSLFilterMonth" onchange="tdSLFilter()"><option value="">All Months</option>' + months.map(function (m) { return '<option>' + esc(m) + '</option>'; }).join('') + '</select>';
    html += '<span id="tdSLCount" style="font-size:.75rem;color:var(--muted)"></span>';
    html += '</div>';
    html += '<div id="tdSLTableWrap" style="overflow-x:auto"></div>';
    html += '</div>';

    // Timeline: rows = site leaders, cols = months
    var timelineMonths = ['October', 'November', 'January', 'February'];
    var slTimeline = {};
    data.forEach(function (r) {
      var sl = r['Site Leader'] || '';
      if (!sl) return;
      var m = r[monthKey] || '';
      if (!slTimeline[sl]) slTimeline[sl] = {};
      var status = m === 'N/A' ? 'na' : (m && m.trim() !== '' ? 'yes' : 'no');
      // Check if month matches one of the timeline months
      timelineMonths.forEach(function (tm) {
        if (m.toLowerCase().includes(tm.toLowerCase().slice(0, 3))) slTimeline[sl][tm] = status;
      });
    });

    html += '<div class="ta-card" style="margin-bottom:1.5rem">';
    html += '<div class="ta-card-title">📅 Observation Timeline by Site Leader</div>';
    html += '<div style="overflow-x:auto"><table class="ta-table"><thead><tr><th>Site Leader</th><th>District</th>' + timelineMonths.map(function (m) { return '<th style="text-align:center">' + m.slice(0, 3) + '</th>'; }).join('') + '</tr></thead><tbody>';
    // Get district per SL
    var slDistrictMap = {};
    data.forEach(function (r) { if (r['Site Leader']) slDistrictMap[r['Site Leader']] = r['District'] || ''; });
    Object.entries(slTimeline).sort(function (a, b) { return a[0].localeCompare(b[0]); }).slice(0, 40).forEach(function (e) {
      var sl = e[0]; var obs = e[1];
      html += '<tr><td><strong>' + esc(sl) + '</strong></td><td style="font-size:.75rem">' + esc(slDistrictMap[sl] || '—') + '</td>';
      timelineMonths.forEach(function (m) {
        var status = obs[m] || 'no';
        var bg = status === 'yes' ? '#dcfce7' : status === 'na' ? '#f3f4f6' : '';
        var color = status === 'yes' ? '#166534' : status === 'na' ? '#9ca3af' : '#b91c1c';
        var sym = status === 'yes' ? '✓' : status === 'na' ? '~' : '—';
        html += '<td style="text-align:center;background:' + bg + ';color:' + color + ';font-weight:' + (status === 'yes' ? '700' : '400') + '">' + sym + '</td>';
      });
      html += '</tr>';
    });
    html += '</tbody></table></div></div>';

    // Notes feed
    var notes = data.filter(function (r) { return r['Notes'] && r['Notes'].trim().length > 5; });
    if (notes.length) {
      html += '<div class="ta-card">';
      html += '<div class="ta-card-title">📝 Notes Feed</div>';
      html += '<div style="display:flex;flex-direction:column;gap:.5rem;max-height:360px;overflow-y:auto">';
      notes.forEach(function (r) {
        html += '<div style="padding:.625rem .875rem;background:var(--surface-2);border-radius:8px;border-left:3px solid #f0a500">';
        html += '<div style="font-size:.875rem">' + esc(r['Notes']) + '</div>';
        html += '<div style="font-size:.72rem;color:var(--muted);margin-top:.25rem">' + esc(r['Site Leader'] || '') + (r['Observation Month'] ? ' · ' + esc(r['Observation Month']) : '') + (r['District'] ? ' · ' + esc(r['District']) : '') + '</div>';
        html += '</div>';
      });
      html += '</div></div>';
    }

    el.innerHTML = html;
    window._tdSLData = data;
    tdSLFilter();
  }

  window.tdSLFilter = function () {
    var data = window._tdSLData || [];
    var dist = (document.getElementById('tdSLFilterDistrict') || {}).value || '';
    var sl = (document.getElementById('tdSLFilterSL') || {}).value || '';
    var month = (document.getElementById('tdSLFilterMonth') || {}).value || '';
    var filtered = data.filter(function (r) {
      return (!dist || r['District'] === dist) && (!sl || r['Site Leader'] === sl) && (!month || r['Observation Month'] === month);
    });
    var wrap = document.getElementById('tdSLTableWrap');
    var count = document.getElementById('tdSLCount');
    if (count) count.textContent = filtered.length + ' records';
    if (!wrap) return;
    var html = '<table class="ta-table"><thead><tr><th>District</th><th>School</th><th>Site Leader</th><th>Observation Month</th><th>Added to Folder</th><th>Notes</th></tr></thead><tbody>';
    filtered.forEach(function (r) {
      var m = r['Observation Month'] || '';
      var done = m && m !== 'N/A' && m.trim();
      var badge = done ? seasonBadge(m.slice(0, 3) === 'Oct' || m.slice(0, 3) === 'Nov' ? 'Fall' : m.slice(0, 3) === 'Dec' || m.slice(0, 3) === 'Jan' || m.slice(0, 3) === 'Feb' ? 'Winter' : m.slice(0, 3) === 'Mar' || m.slice(0, 3) === 'Apr' || m.slice(0, 3) === 'May' ? 'Spring' : 'Summer') : '';
      html += '<tr><td style="font-size:.75rem">' + esc(r['District'] || '—') + '</td>';
      html += '<td style="font-size:.75rem">' + esc(r['School'] || '—') + '</td>';
      html += '<td><strong>' + esc(r['Site Leader'] || '—') + '</strong></td>';
      html += '<td>' + (done ? '<span style="color:#166534;font-weight:600">' + esc(m) + '</span> ' + badge : m === 'N/A' ? '<span style="color:#9ca3af">N/A</span>' : '<span style="color:#b91c1c">Not scheduled</span>') + '</td>';
      html += '<td style="font-size:.75rem">' + esc(r['Added to Shared Folder'] || '—') + '</td>';
      html += '<td style="font-size:.75rem;max-width:200px">' + esc((r['Notes'] || '').slice(0, 80) + (r['Notes'] && r['Notes'].length > 80 ? '…' : '')) + '</td>';
      html += '</tr>';
    });
    html += '</tbody></table>';
    wrap.innerHTML = html;
  };


  // ═══════════════════════════════════════════════════════════════════════
  //  SUB-TAB 5 · OTJ CHECKLIST & SKILL GAP ANALYSIS
  // ═══════════════════════════════════════════════════════════════════════
  async function loadOTJ() {
    var el = document.getElementById('td-content-otj');
    if (!el) return;
    showLoading(el, 'Loading OTJ Checklist & Skill Gap data…');
    try {
      var gids = await discoverGIDs();
      if (!gids.otj && gids.otj !== 0) gids.otj = 2;
      var url = APPRENT_CSV_BASE + '&gid=' + gids.otj;
      // OTJ: rows 0+1 = title/instruction, row 2 = header → headerRowIndex = 2
      var result = await fetchCSV(url, 2);
      _state.otj = result.objects;
      _loaded.otj = true;
      renderOTJ(el, _state.otj);
    } catch (e) {
      showError(el, 'Could not load OTJ Checklist: ' + e.message, loadOTJ);
    }
  }

  function renderOTJ(el, data) {
    var dept = (window.NJTC_SESSION || {}).dept || '';
    if (!data || !data.length) {
      el.innerHTML = '<div class="td-error">No OTJ Checklist data found. The Apprenticeship Database tab may not be published yet.</div>';
      return;
    }

    var phases = ['Beginning of Program (Months 1\u20134)', 'Middle of Program (Months 5\u20138)', 'End of Program (Months 9\u201312)'];
    var phaseShort = { 'Beginning of Program (Months 1\u20134)': 'Beginning', 'Middle of Program (Months 5\u20138)': 'Middle', 'End of Program (Months 9\u201312)': 'End' };
    var phaseClass = { 'Beginning of Program (Months 1\u20134)': 'td-phase-beginning', 'Middle of Program (Months 5\u20138)': 'td-phase-middle', 'End of Program (Months 9\u201312)': 'td-phase-end' };
    var domains = ['Professionalism', 'Instruction', 'Environment', 'Planning'];
    var domainColors = { Professionalism: '#003087', Instruction: '#e76f51', Environment: '#2a9d8f', Planning: '#7b2d8b' };

    // Group items
    var grouped = {};
    data.forEach(function (r) {
      var p = (r['Phase'] || '').trim();
      var d = (r['Competency Code'] ? detectDomain(r['Competency Code']) : (r['Domain'] || 'Other'));
      if (!grouped[p]) grouped[p] = {};
      if (!grouped[p][d]) grouped[p][d] = [];
      grouped[p][d].push(r);
    });

    // Progress
    var totalItems = data.length;
    var completedItems = data.filter(function (r) { return (r['Mark Y'] || '').toUpperCase() === 'Y'; }).length;
    var hasCompletionData = completedItems > 0;

    var html = '<div class="ta-grid ta-grid-3" style="margin-bottom:1.5rem">';
    if (hasCompletionData) {
      html += kpiTile('📋', totalItems, 'Total Items', '#003087');
      html += kpiTile('✅', completedItems, 'Completed', '#059669');
      html += kpiTile('📊', Math.round(completedItems / totalItems * 100) + '%', 'Overall Completion', completedItems / totalItems >= 0.8 ? '#059669' : '#d97706');
    } else {
      html += kpiTile('📋', totalItems, 'Total Checklist Items', '#003087');
      html += kpiTile('🏁', phases.length, 'Program Phases', '#e76f51');
      html += kpiTile('🎯', domains.length, 'Competency Domains', '#2a9d8f');
    }
    html += '</div>';

    // Print button (training dept only)
    if (dept === 'training') {
      html += '<div style="margin-bottom:1rem">';
      html += '<button class="btn btn-secondary" onclick="tdPrintChecklist()" style="font-size:.8125rem">🖨️ Print Checklist (Training Dept)</button>';
      html += '</div>';
    }

    // Filters
    html += '<div style="display:flex;gap:.625rem;flex-wrap:wrap;margin-bottom:1rem;align-items:center">';
    html += '<select class="filter-select" id="tdOTJFilterPhase" onchange="tdOTJFilter()"><option value="">All Phases</option>' + phases.map(function (p) { return '<option value="' + esc(p) + '">' + esc(phaseShort[p] || p) + '</option>'; }).join('') + '</select>';
    html += '<select class="filter-select" id="tdOTJFilterDomain" onchange="tdOTJFilter()"><option value="">All Domains</option>' + domains.map(function (d) { return '<option>' + esc(d) + '</option>'; }).join('') + '</select>';
    html += '<span id="tdOTJCount" style="font-size:.75rem;color:var(--muted)"></span>';
    html += '</div>';
    html += '<div id="tdOTJTableWrap"></div>';

    // Skill Gap Analysis Panel
    html += buildSkillGapPanel();

    // Asset-Based Mindset Tracker
    html += buildAssetBasedPanel();

    el.innerHTML = html;
    window._tdOTJData = data;
    window._tdOTJGrouped = grouped;
    window._tdOTJPhaseShort = phaseShort;
    window._tdOTJPhaseClass = phaseClass;
    window._tdOTJDomainColors = domainColors;
    tdOTJFilter();
  }

  function detectDomain(code) {
    if (!code) return 'Other';
    var c = code.toUpperCase();
    // Professionalism: A-H, Q-T typically; Instruction: I-N; Environment: O-P; Planning: D-F (overlap handled by position)
    // Use common NJTC OTJ domain assignments
    if (/^[A-H]/.test(c) || /^[Q-T]/.test(c)) return 'Professionalism';
    if (/^[I-N]/.test(c)) return 'Instruction';
    if (/^[O-P]/.test(c)) return 'Environment';
    if (/^[U-Z]/.test(c)) return 'Planning';
    return 'Other';
  }

  window.tdOTJFilter = function () {
    var data = window._tdOTJData || [];
    var phaseFilter = (document.getElementById('tdOTJFilterPhase') || {}).value || '';
    var domainFilter = (document.getElementById('tdOTJFilterDomain') || {}).value || '';
    var filtered = data.filter(function (r) {
      var p = (r['Phase'] || '').trim();
      var d = detectDomain(r['Competency Code'] || '');
      return (!phaseFilter || p === phaseFilter) && (!domainFilter || d === domainFilter);
    });
    var count = document.getElementById('tdOTJCount');
    if (count) count.textContent = filtered.length + ' items';
    var wrap = document.getElementById('tdOTJTableWrap');
    if (!wrap) return;
    var phaseShort = window._tdOTJPhaseShort || {};
    var phaseClass = window._tdOTJPhaseClass || {};
    var domainColors = window._tdOTJDomainColors || {};

    // Group filtered
    var grouped = {};
    filtered.forEach(function (r) {
      var p = (r['Phase'] || '').trim() || 'Other';
      var d = detectDomain(r['Competency Code'] || '');
      if (!grouped[p]) grouped[p] = {};
      if (!grouped[p][d]) grouped[p][d] = [];
      grouped[p][d].push(r);
    });

    var html = '';
    Object.keys(grouped).forEach(function (phase) {
      var pc = phaseClass[phase] || 'td-phase-beginning';
      html += '<div class="td-phase-hdr ' + pc + '">' + esc(phaseShort[phase] || phase) + ' of Program</div>';
      Object.keys(grouped[phase]).forEach(function (domain) {
        var items = grouped[phase][domain];
        var color = domainColors[domain] || '#003087';
        html += '<div style="background:#fff;border:1.5px solid var(--border);border-radius:8px;margin-bottom:.75rem;overflow:hidden">';
        html += '<div style="background:' + color + '15;border-bottom:1.5px solid ' + color + '30;padding:.5rem .875rem;font-size:.75rem;font-weight:700;color:' + color + ';text-transform:uppercase;letter-spacing:.06em">' + esc(domain) + ' · ' + items.length + ' items</div>';
        html += '<div style="overflow-x:auto"><table class="ta-table" style="font-size:.8rem">';
        html += '<thead><tr><th style="width:70px">Code</th><th>Activity / Task</th><th>Look For / Evidence</th><th style="width:60px;text-align:center">Done</th><th style="width:120px">Date</th><th>Notes</th></tr></thead><tbody>';
        items.forEach(function (r) {
          var done = (r['Mark Y'] || '').toUpperCase() === 'Y';
          var dateDisp = r['Date Completed'] ? formatDateWithSeason(r['Date Completed']) : '—';
          html += '<tr>';
          html += '<td><code style="background:#f3f4f6;padding:.15rem .35rem;border-radius:4px;font-size:.75rem">' + esc(r['Competency Code'] || '—') + '</code></td>';
          html += '<td style="max-width:220px">' + esc(r['Activity / Task'] || '—') + '</td>';
          html += '<td style="max-width:220px;color:var(--text-2)">' + esc(r['Look For / Evidence'] || '—') + '</td>';
          html += '<td style="text-align:center">' + (done ? '<span style="color:#059669;font-weight:700;font-size:1rem">✓</span>' : '<span style="color:#e2e8f0">○</span>') + '</td>';
          html += '<td style="font-size:.75rem">' + esc(dateDisp) + '</td>';
          html += '<td style="font-size:.75rem;color:var(--muted)">' + esc((r['PM / SL Notes'] || '').slice(0, 60) + (r['PM / SL Notes'] && r['PM / SL Notes'].length > 60 ? '…' : '')) + '</td>';
          html += '</tr>';
        });
        html += '</tbody></table></div></div>';
      });
    });
    wrap.innerHTML = html || '<div style="color:var(--muted);padding:2rem;text-align:center">No items match current filters.</div>';
  };

  function buildSkillGapPanel() {
    // PD focus area → OTJ domain mapping
    var pdGaps = (window._tdPDFocusCache) ? window._tdPDFocusCache : {};
    // Try to get PD data if loaded
    if (_state.pd) {
      _state.pd.forEach(function (r) {
        (r['What focus areas need additional support?'] || '').split(',').forEach(function (f) {
          var tag = f.trim(); if (tag) pdGaps[tag] = (pdGaps[tag] || 0) + 1;
        });
      });
      window._tdPDFocusCache = pdGaps;
    }

    var domainMap = [
      { pdTag: 'Instruction (Scaffolding', domain: 'Instruction', codes: ['I','J','K','L','M','N'], status: null },
      { pdTag: 'Instruction (i-Ready', domain: 'Instruction + Planning', codes: ['I','J','K','U','V'], status: null },
      { pdTag: 'Operations (Reporting', domain: 'Professionalism + Planning', codes: ['Q','R','S','T','U'], status: null },
      { pdTag: 'Policies and Procedures', domain: 'Professionalism', codes: ['F','S'], status: null }
    ];

    var html = '<div class="ta-card" style="margin-top:1.5rem;margin-bottom:1.5rem">';
    html += '<div class="ta-card-title">🎯 Skill Gap Analysis — PD Focus Areas → OTJ Domain Mapping</div>';
    html += '<div style="font-size:.8125rem;color:var(--text-2);margin-bottom:1rem">Cross-reference of PD feedback areas most frequently flagged against OTJ competency domains.</div>';
    html += '<div class="ta-grid ta-grid-2">';

    domainMap.forEach(function (item) {
      var count = 0;
      Object.keys(pdGaps).forEach(function (tag) {
        if (tag.toLowerCase().includes(item.pdTag.toLowerCase().slice(0, 15))) count += pdGaps[tag];
      });
      var pct = _state.pd && _state.pd.length ? Math.round(count / _state.pd.length * 100) : null;
      var statusColor = count > 5 ? '#b91c1c' : count > 2 ? '#d97706' : '#059669';
      var statusLabel = count > 5 ? '🔥 Hot — High Priority' : count > 2 ? '⚠️ Needs Attention' : '✅ On Track';
      html += '<div style="background:var(--surface-2);border:1.5px solid var(--border);border-radius:10px;padding:1rem">';
      html += '<div style="font-size:.875rem;font-weight:700;color:var(--navy);margin-bottom:.375rem">' + esc(item.domain) + '</div>';
      html += '<div style="font-size:.75rem;color:var(--muted);margin-bottom:.5rem">PD responses flagging this area: <strong style="color:' + statusColor + '">' + (count || (_state.pd ? 0 : '—')) + '</strong>' + (pct !== null ? ' (' + pct + '%)' : '') + '</div>';
      html += '<div style="font-size:.75rem;margin-bottom:.375rem">OTJ Codes: ' + item.codes.map(function (c) { return '<code style="background:#e2e8f0;padding:.1rem .3rem;border-radius:3px;font-size:.72rem;margin-right:.2rem">' + c + '</code>'; }).join('') + '</div>';
      html += '<div style="font-size:.75rem;font-weight:600;color:' + statusColor + '">' + statusLabel + '</div>';
      html += '</div>';
    });

    html += '</div></div>';
    if (!_state.pd) {
      html += '<div style="background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:.75rem 1rem;font-size:.8rem;color:#92400e;margin-top:.5rem">💡 Load the PD Sessions tab first to see frequency counts in the Skill Gap panel.</div>';
    }
    return html;
  }

  function buildAssetBasedPanel() {
    var assetKey = 'Did the training help you understand and apply an asset-based mindset when working with scholars?';
    var moreKey = 'Would you like additional training on implementing an asset-based mindset in training?';
    var assetHelped = 0, assetTotal = 0, moreWanted = 0, moreTotal = 0;
    if (_state.intake) {
      _state.intake.forEach(function (r) {
        if (r[assetKey]) { assetTotal++; if ((r[assetKey] || '').toLowerCase().includes('yes')) assetHelped++; }
        if (r[moreKey]) { moreTotal++; if ((r[moreKey] || '').toLowerCase().includes('yes')) moreWanted++; }
      });
    }
    var html = '<div class="ta-card" style="margin-bottom:1.5rem">';
    html += '<div class="ta-card-title">💚 Asset-Based Mindset Tracker</div>';
    html += '<div class="ta-grid ta-grid-3" style="margin-bottom:.875rem">';
    html += kpiTile('💡', assetTotal ? Math.round(assetHelped / assetTotal * 100) + '%' : '—', 'Training Helped With Asset-Based Mindset', '#059669');
    html += kpiTile('📚', moreTotal ? Math.round(moreWanted / moreTotal * 100) + '%' : '—', 'Want Additional Asset-Based Training', '#7b2d8b');
    html += '<div class="ta-card" style="border:none;background:#f0fdf4;padding:.875rem">';
    html += '<div style="font-size:.75rem;font-weight:700;color:#166534;margin-bottom:.375rem">OTJ Reference — Instruction Domain</div>';
    html += '<div style="font-size:.75rem;color:#166534"><code style="background:#bbf7d0;padding:.1rem .3rem;border-radius:3px">M</code> Uses asset-based approach with scholars<br><code style="background:#bbf7d0;padding:.1rem .3rem;border-radius:3px;margin-top:.25rem;display:inline-block">L</code> Anti-discriminatory practice</div>';
    html += '</div>';
    html += '</div>';
    if (!_state.intake) html += '<div style="font-size:.8rem;color:#92400e;background:#fffbeb;border-radius:6px;padding:.5rem .75rem">💡 Load the Training Intake tab first to populate asset-based mindset metrics.</div>';
    html += '</div>';
    return html;
  }

  window.tdPrintChecklist = function () {
    var data = window._tdOTJData || [];
    if (!data.length) { alert('No OTJ Checklist data loaded.'); return; }
    var printWin = window.open('', '_blank', 'width=900,height=700');
    if (!printWin) { alert('Please allow popups to print the checklist.'); return; }
    var phaseShort = window._tdOTJPhaseShort || {};
    var grouped = {};
    data.forEach(function (r) {
      var p = (r['Phase'] || '').trim() || 'Other';
      var d = detectDomain(r['Competency Code'] || '');
      if (!grouped[p]) grouped[p] = {};
      if (!grouped[p][d]) grouped[p][d] = [];
      grouped[p][d].push(r);
    });
    var body = '<h1 style="font-size:18pt;margin-bottom:4pt">NJTC Apprenticeship OTJ Competency Checklist</h1>';
    body += '<table style="width:100%;margin-bottom:12pt;font-size:10pt"><tr>';
    body += '<td>Tutor Name: <span style="border-bottom:1px solid #000;display:inline-block;min-width:180px">&nbsp;</span></td>';
    body += '<td>Site Leader: <span style="border-bottom:1px solid #000;display:inline-block;min-width:150px">&nbsp;</span></td>';
    body += '<td>School: <span style="border-bottom:1px solid #000;display:inline-block;min-width:150px">&nbsp;</span></td>';
    body += '<td>Date Range: <span style="border-bottom:1px solid #000;display:inline-block;min-width:120px">&nbsp;</span></td>';
    body += '</tr></table>';
    Object.keys(grouped).forEach(function (phase) {
      body += '<h2 style="background:#e2e8f0;padding:4pt 8pt;font-size:11pt;margin:8pt 0 4pt">' + esc(phaseShort[phase] || phase) + ' of Program</h2>';
      Object.keys(grouped[phase]).forEach(function (domain) {
        var items = grouped[phase][domain];
        body += '<h3 style="font-size:10pt;color:#444;margin:4pt 0 2pt;text-transform:uppercase;letter-spacing:.05em">' + esc(domain) + '</h3>';
        body += '<table style="width:100%;border-collapse:collapse;font-size:9pt;margin-bottom:8pt">';
        body += '<thead><tr style="background:#f8f9fa"><th style="border:1px solid #ccc;padding:3pt 5pt;width:50pt">Code</th><th style="border:1px solid #ccc;padding:3pt 5pt">Activity / Task</th><th style="border:1px solid #ccc;padding:3pt 5pt">Look For / Evidence</th><th style="border:1px solid #ccc;padding:3pt 5pt;width:40pt">Y</th><th style="border:1px solid #ccc;padding:3pt 5pt;width:70pt">Date</th><th style="border:1px solid #ccc;padding:3pt 5pt">Notes</th></tr></thead><tbody>';
        items.forEach(function (r) {
          body += '<tr><td style="border:1px solid #ccc;padding:3pt 5pt">' + esc(r['Competency Code'] || '') + '</td>';
          body += '<td style="border:1px solid #ccc;padding:3pt 5pt">' + esc(r['Activity / Task'] || '') + '</td>';
          body += '<td style="border:1px solid #ccc;padding:3pt 5pt;color:#555">' + esc(r['Look For / Evidence'] || '') + '</td>';
          body += '<td style="border:1px solid #ccc;padding:3pt 5pt;text-align:center">□</td>';
          body += '<td style="border:1px solid #ccc;padding:3pt 5pt"></td>';
          body += '<td style="border:1px solid #ccc;padding:3pt 5pt"></td></tr>';
        });
        body += '</tbody></table>';
      });
    });
    printWin.document.write('<!DOCTYPE html><html><head><meta charset="UTF-8"><title>NJTC OTJ Checklist</title><style>body{font-family:Arial,sans-serif;margin:0.75in;font-size:10pt;color:#111} @page{margin:.75in} h1,h2,h3{page-break-after:avoid} table{page-break-inside:avoid}</style></head><body>' + body + '</body></html>');
    printWin.document.close();
    printWin.focus();
    setTimeout(function () { printWin.print(); }, 500);
  };


  // ═══════════════════════════════════════════════════════════════════════
  //  SUB-TAB 6 · CHECKLIST MANAGEMENT (Training Dept Workflow Tool)
  // ═══════════════════════════════════════════════════════════════════════
  var MGMT_KEY = 'njtc_otj_checklist_state';

  function loadMgmt() {
    var el = document.getElementById('td-content-mgmt');
    if (!el) return;
    if (_state.otj) {
      renderMgmt(el, _state.otj);
      _loaded.mgmt = true;
    } else {
      showLoading(el, 'Loading OTJ Checklist for management…');
      discoverGIDs().then(function (gids) {
        var g = (gids.otj !== undefined) ? gids.otj : 2;
        return fetchCSV(APPRENT_CSV_BASE + '&gid=' + g, 2);
      }).then(function (result) {
        _state.otj = result.objects;
        _loaded.mgmt = true;
        renderMgmt(el, _state.otj);
      }).catch(function (e) {
        showError(el, 'Could not load checklist: ' + e.message, loadMgmt);
      });
    }
  }

  function renderMgmt(el, data) {
    if (!data || !data.length) { el.innerHTML = '<div class="td-error">No OTJ data available for checklist management.</div>'; return; }

    var state = loadMgmtState();
    var phases = [...new Set(data.map(function (r) { return (r['Phase'] || '').trim(); }).filter(Boolean))];
    var phaseShort = { 'Beginning of Program (Months 1\u20134)': 'Beginning', 'Middle of Program (Months 5\u20138)': 'Middle', 'End of Program (Months 9\u201312)': 'End' };
    var phaseClass = { 'Beginning of Program (Months 1\u20134)': 'td-phase-beginning', 'Middle of Program (Months 5\u20138)': 'td-phase-middle', 'End of Program (Months 9\u201312)': 'td-phase-end' };

    // Overall completion
    var totalItems = data.length;
    var doneItems = data.filter(function (r) { var id = r['Competency Code'] || r['Activity / Task']; return state[id] && state[id].done; }).length;
    var overallPct = totalItems ? Math.round(doneItems / totalItems * 100) : 0;

    // Current month for phase timing
    var now = new Date();
    var currentMonth = now.getMonth() + 1; // 1-12
    var programMonth = currentMonth >= 9 ? (currentMonth - 8) : (currentMonth + 4); // Sept = month 1
    var currentPhase = programMonth <= 4 ? 'beginning' : programMonth <= 8 ? 'middle' : 'end';

    var html = '<div style="background:var(--navy);border-radius:12px;padding:1.5rem;margin-bottom:1.5rem;color:#fff;text-align:center">';
    html += '<div style="font-size:.7rem;text-transform:uppercase;letter-spacing:.12em;color:rgba(255,255,255,.5);margin-bottom:.25rem">Overall Completion</div>';
    html += '<div style="font-size:3.5rem;font-weight:800;line-height:1;color:' + (overallPct >= 80 ? '#34d399' : overallPct >= 50 ? '#fbbf24' : '#f87171') + '">' + overallPct + '%</div>';
    html += '<div style="font-size:.875rem;color:rgba(255,255,255,.6);margin-top:.25rem">' + doneItems + ' of ' + totalItems + ' items completed</div>';
    html += '<div class="td-progress-bar" style="margin:.75rem auto 0;max-width:300px"><div class="td-progress-fill" style="width:' + overallPct + '%;background:' + (overallPct >= 80 ? '#34d399' : overallPct >= 50 ? '#fbbf24' : '#f87171') + '"></div></div>';
    html += '</div>';

    // Print button
    html += '<div style="display:flex;gap:.625rem;align-items:center;flex-wrap:wrap;margin-bottom:1.5rem">';
    html += '<button class="btn btn-primary" onclick="tdPrintChecklist()">🖨️ Print PDF Checklist</button>';
    html += '<button class="btn btn-secondary btn-sm" onclick="tdMgmtReset()" style="color:#b91c1c;border-color:#fca5a5">↺ Reset All Checks</button>';
    html += '</div>';

    // Per-phase sections
    phases.forEach(function (phase) {
      var phaseItems = data.filter(function (r) { return (r['Phase'] || '').trim() === phase; });
      var phaseDone = phaseItems.filter(function (r) { var id = r['Competency Code'] || r['Activity / Task']; return state[id] && state[id].done; }).length;
      var phasePct = phaseItems.length ? Math.round(phaseDone / phaseItems.length * 100) : 0;
      var pc = phaseClass[phase] || 'td-phase-beginning';
      var ps = phaseShort[phase] || phase;

      // Check if phase is due/overdue
      var phaseKey = ps.toLowerCase();
      var isOverdue = false;
      var overdueBanner = '';
      if ((phaseKey === 'beginning' && currentPhase !== 'beginning' && phasePct < 50) ||
          (phaseKey === 'middle' && ['end'].includes(currentPhase) && phasePct < 50)) {
        isOverdue = true;
        var undone = phaseItems.length - phaseDone;
        overdueBanner = '<div style="background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:.625rem 1rem;margin-bottom:.75rem;font-size:.8125rem;color:#92400e">⚠️ ' + ps + ' of Program items are past due — <strong>' + undone + ' items incomplete</strong></div>';
      }

      html += overdueBanner;
      html += '<div class="td-phase-hdr ' + pc + '" style="display:flex;align-items:center;justify-content:space-between">';
      html += '<span>' + esc(ps) + ' of Program</span>';
      html += '<span style="font-size:.875rem">' + phaseDone + '/' + phaseItems.length + ' — ' + phasePct + '%</span>';
      html += '</div>';
      html += '<div class="td-progress-bar" style="margin-bottom:.875rem"><div class="td-progress-fill" style="width:' + phasePct + '%;background:' + (phasePct >= 80 ? '#059669' : phasePct >= 50 ? '#d97706' : '#b91c1c') + '"></div></div>';

      // Group by domain
      var domGroups = {};
      phaseItems.forEach(function (r) {
        var d = detectDomain(r['Competency Code'] || '');
        if (!domGroups[d]) domGroups[d] = [];
        domGroups[d].push(r);
      });
      var domColors = { Professionalism: '#003087', Instruction: '#e76f51', Environment: '#2a9d8f', Planning: '#7b2d8b', Other: '#6b7280' };

      Object.keys(domGroups).forEach(function (domain) {
        var items = domGroups[domain];
        var color = domColors[domain] || '#6b7280';
        html += '<div style="margin-bottom:.875rem;background:#fff;border:1.5px solid var(--border);border-radius:8px;overflow:hidden">';
        html += '<div style="background:' + color + '12;padding:.5rem .875rem;border-bottom:1.5px solid ' + color + '25;font-size:.72rem;font-weight:700;color:' + color + ';text-transform:uppercase;letter-spacing:.06em">' + esc(domain) + '</div>';
        items.forEach(function (r) {
          var id = r['Competency Code'] || r['Activity / Task'];
          var itemState = state[id] || {};
          var done = itemState.done || false;
          var checkId = 'tdMgmtCheck_' + encodeURIComponent(id);
          html += '<div class="td-check-row">';
          html += '<input type="checkbox" id="' + checkId + '" ' + (done ? 'checked' : '') + ' onchange="tdMgmtToggle(' + JSON.stringify(id) + ', this.checked)">';
          html += '<div style="flex:1">';
          html += '<div class="' + (done ? 'td-check-done' : '') + '" style="font-size:.8125rem">';
          html += '<code style="background:#f3f4f6;padding:.1rem .3rem;border-radius:3px;font-size:.72rem;margin-right:.375rem">' + esc(r['Competency Code'] || '—') + '</code>';
          html += esc(r['Activity / Task'] || '—') + '</div>';
          if (r['Look For / Evidence']) html += '<div style="font-size:.75rem;color:var(--muted);margin-top:.2rem">' + esc(r['Look For / Evidence']) + '</div>';
          html += '</div>';
          html += '</div>';
        });
        html += '</div>';
      });
    });

    el.innerHTML = html;
  }

  function loadMgmtState() {
    try { return JSON.parse(localStorage.getItem(MGMT_KEY) || '{}'); } catch (e) { return {}; }
  }
  function saveMgmtState(state) {
    try { localStorage.setItem(MGMT_KEY, JSON.stringify(state)); } catch (e) {}
  }

  window.tdMgmtToggle = function (id, checked) {
    var state = loadMgmtState();
    if (!state[id]) state[id] = {};
    state[id].done = checked;
    if (checked) state[id].doneAt = new Date().toISOString();
    saveMgmtState(state);
    // Update overall % without full re-render
    var data = _state.otj || [];
    var total = data.length;
    var done = data.filter(function (r) { var rid = r['Competency Code'] || r['Activity / Task']; return state[rid] && state[rid].done; }).length;
    var pct = total ? Math.round(done / total * 100) : 0;
    // Quick visual update on progress bar
    var el = document.getElementById('td-content-mgmt');
    if (!el) return;
    var bars = el.querySelectorAll('.td-progress-fill');
    if (bars[0]) {
      bars[0].style.width = pct + '%';
      var heroVal = el.querySelector('div[style*="3.5rem"]');
      if (heroVal) heroVal.textContent = pct + '%';
    }
  };

  window.tdMgmtReset = function () {
    if (!confirm('Reset all checklist completions? This cannot be undone.')) return;
    saveMgmtState({});
    _loaded.mgmt = false;
    loadMgmt();
  };


  // ═══════════════════════════════════════════════════════════════════════
  //  EXECUTIVE PDF (Data Dept Only)
  // ═══════════════════════════════════════════════════════════════════════
  function tdGenerateExecPDF() {
    var printWin = window.open('', '_blank', 'width=1000,height=750');
    if (!printWin) { alert('Please allow popups to generate the Executive Summary PDF.'); return; }

    var now = new Date();
    var dateStr = now.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

    // Gather metrics from loaded state
    var pdData = _state.pd || [];
    var intakeData = _state.intake || [];
    var tutorData = _state.tutorObs || [];
    var slData = _state.slObs || [];

    var pdSessions = []; var pdSessionMap = {};
    pdData.forEach(function (r) {
      var k = (r['PD Session Number'] || '') + '||' + (r['Date of PD Session'] || '');
      if (!pdSessionMap[k]) { pdSessionMap[k] = []; pdSessions.push(k); }
      pdSessionMap[k].push(r);
    });

    var avgSat = avgArr(pdData.map(function (r) { return r['Overall satisfaction with this PD session']; }));
    var recYes = pdData.filter(function (r) { return (r['Would you recommend this PD session to other sites?'] || '').toLowerCase().includes('yes'); }).length;
    var recPct = pdData.filter(function (r) { return r['Would you recommend this PD session to other sites?']; }).length;
    var recPctVal = recPct ? Math.round(recYes / recPct * 100) : null;
    var newHires = intakeData.filter(function (r) { return (r['Are you a new or returning hire? (Select one)'] || '').toLowerCase().includes('new'); }).length;
    var avgEff = avg(intakeData, 'Overall, how would you rate the effectiveness of the training? (1 = Did not meet expectations, 5 = Exceeded expectations)');
    var avgPrep = avg(intakeData, 'After completing training, how prepared do you feel to begin working with scholars? (1 = Very unprepared, 5 = Extremely prepared)');
    var activeT = tutorData.filter(function (r) { return (r['Active Status'] || '').toLowerCase() === 'active'; });
    var obsT = activeT.filter(function (r) { return OBS_MONTHS.some(function (m) { return isObserved(r[m]); }); });
    var obsPct = activeT.length ? Math.round(obsT.length / activeT.length * 100) : null;
    var totalSLs = [...new Set(slData.map(function (r) { return r['Site Leader'] || ''; }).filter(Boolean))].length;
    var slDone = slData.filter(function (r) { var m = r['Observation Month'] || ''; return m && m !== 'N/A' && m.trim(); }).length;

    // Focus areas
    var focusMap = {};
    pdData.forEach(function (r) {
      (r['What focus areas need additional support?'] || '').split(',').forEach(function (f) {
        var tag = f.trim(); if (tag) focusMap[tag] = (focusMap[tag] || 0) + 1;
      });
    });
    var topFocus = Object.entries(focusMap).sort(function (a, b) { return b[1] - a[1]; }).slice(0, 6);

    // Auto-generated insight bullets
    var insights = [];
    if (avgSat !== null) {
      if (avgSat < 3.5) insights.push('⚠️ Avg PD satisfaction is <strong>' + avgSat.toFixed(1) + '/5</strong> — below the 3.5 threshold; review session design and facilitator approach.');
      else insights.push('✅ Avg PD satisfaction: <strong>' + avgSat.toFixed(1) + '/5</strong> across all sessions.');
    }
    if (recPctVal !== null) insights.push((recPctVal >= 80 ? '✅' : '⚠️') + ' <strong>' + recPctVal + '%</strong> of respondents would recommend PD to other sites.');
    if (obsPct !== null) {
      if (obsPct < 60) insights.push('🔴 Tutor observation coverage: <strong>' + obsPct + '%</strong> — below 60% threshold; observation frequency needs attention.');
      else insights.push('✅ Tutor observation coverage: <strong>' + obsPct + '%</strong> of active tutors observed at least once.');
    }
    if (intakeData.length) insights.push('📋 Training intake: <strong>' + intakeData.length + ' responses</strong>, ' + (intakeData.length ? Math.round(newHires / intakeData.length * 100) : '—') + '% new hires.');
    if (avgPrep !== null) insights.push((avgPrep >= 4 ? '✅' : '⚠️') + ' Scholar preparedness avg: <strong>' + avgPrep.toFixed(1) + '/5</strong>.');
    if (totalSLs) insights.push('👤 Site leader observations: <strong>' + slDone + '</strong> completed of tracked records across <strong>' + totalSLs + '</strong> site leaders.');
    if (topFocus.length) insights.push('🎯 Top PD support need: <strong>' + esc(topFocus[0][0]) + '</strong> (' + topFocus[0][1] + ' responses).');
    while (insights.length < 6) insights.push('ℹ️ Pending: additional data needed for full analysis.');
    insights = insights.slice(0, 10);

    var kpiCards = function (items) {
      return '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8pt">' +
        items.map(function (item) {
          return '<div style="border:1pt solid #dde3ec;border-radius:6pt;padding:10pt;text-align:center">' +
            '<div style="font-size:20pt;font-weight:800;color:#0a1628;margin-bottom:3pt">' + item.val + '</div>' +
            '<div style="font-size:8pt;color:#6b7280;text-transform:uppercase;letter-spacing:.08em">' + item.label + '</div>' +
            '</div>';
        }).join('') + '</div>';
    };

    var body = '';
    // Page 1: Cover
    body += '<div class="page"><div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;text-align:center">';
    body += '<div style="width:80pt;height:80pt;background:linear-gradient(135deg,#003087,#0050c8);border-radius:16pt;display:flex;align-items:center;justify-content:center;color:#fff;font-size:22pt;font-weight:800;margin:0 auto 24pt">NJTC</div>';
    body += '<h1 style="font-size:24pt;color:#0a1628;margin-bottom:8pt">Training &amp; Development<br>Executive Data Summary</h1>';
    body += '<p style="font-size:12pt;color:#6b7280;margin-bottom:4pt">' + esc(dateStr) + '</p>';
    body += '<p style="font-size:11pt;color:#6b7280">School Year 2025–2026</p>';
    body += '<p style="font-size:9pt;color:#94a3b8;margin-top:24pt">For internal use by Data &amp; Evaluation and Training &amp; Development leadership only.</p>';
    body += '</div></div>';

    // Page 2: At-a-Glance KPIs
    body += '<div class="page"><h2>At-a-Glance KPIs</h2>';
    body += '<h3>PD Sessions</h3>';
    body += kpiCards([
      { val: pdSessions.length || '—', label: 'Sessions Delivered' },
      { val: pdData.length || '—', label: 'PD Responses' },
      { val: avgSat !== null ? avgSat.toFixed(1) + '/5' : '—', label: 'Avg PD Satisfaction' },
      { val: recPctVal !== null ? recPctVal + '%' : '—', label: '% Would Recommend' },
      { val: intakeData.length || '—', label: 'Intake Responses' },
      { val: avgEff !== null ? avgEff.toFixed(1) + '/5' : '—', label: 'Avg Training Effectiveness' }
    ]);
    body += '<h3 style="margin-top:16pt">Apprenticeship Observations</h3>';
    body += kpiCards([
      { val: activeT.length || '—', label: 'Active Tutors' },
      { val: obsPct !== null ? obsPct + '%' : '—', label: '% Tutors Observed' },
      { val: OBS_MONTHS.map(function (m) { return activeT.filter(function (r) { return isObserved(r[m]); }).length; }).join(' / '), label: 'Obs by Month (Oct→Apr)' },
      { val: totalSLs || '—', label: 'Site Leaders Tracked' },
      { val: slDone || '—', label: 'SL Obs Completed' },
      { val: avgPrep !== null ? avgPrep.toFixed(1) + '/5' : '—', label: 'Scholar Preparedness' }
    ]);
    body += '</div>';

    // Page 3: Focus Areas Needing Support
    body += '<div class="page"><h2>PD Focus Areas Needing Support</h2>';
    if (topFocus.length) {
      var maxF = topFocus[0][1];
      body += '<table style="width:100%;border-collapse:collapse;font-size:10pt">';
      body += '<thead><tr style="background:#f3f4f6"><th style="padding:6pt;text-align:left;border-bottom:1pt solid #dde3ec">Focus Area</th><th style="padding:6pt;text-align:center;border-bottom:1pt solid #dde3ec;width:60pt">Count</th><th style="padding:6pt;border-bottom:1pt solid #dde3ec">Frequency</th></tr></thead><tbody>';
      topFocus.forEach(function (e) {
        var pct = Math.round(e[1] / maxF * 100);
        body += '<tr><td style="padding:6pt;border-bottom:1pt solid #eef1f6">' + esc(e[0]) + '</td>';
        body += '<td style="padding:6pt;text-align:center;border-bottom:1pt solid #eef1f6;font-weight:700">' + e[1] + '</td>';
        body += '<td style="padding:6pt;border-bottom:1pt solid #eef1f6"><div style="background:#e2e8f0;border-radius:3pt;height:10pt;overflow:hidden"><div style="background:#e76f51;height:100%;width:' + pct + '%"></div></div></td></tr>';
      });
      body += '</tbody></table>';
    } else { body += '<p style="color:#6b7280">No PD session data loaded.</p>'; }
    body += '</div>';

    // Page 4: Insight Bullets
    body += '<div class="page"><h2>Executive Insight Bullets</h2>';
    body += '<div style="background:#f8fafc;border-radius:8pt;padding:16pt">';
    body += '<ul style="font-size:11pt;line-height:1.8;color:#0d1b2a">';
    insights.forEach(function (b) { body += '<li style="margin-bottom:6pt">' + b + '</li>'; });
    body += '</ul></div>';
    body += '<p style="font-size:8pt;color:#94a3b8;margin-top:20pt">Note: These are data observations only. Interpretation and recommendations are the responsibility of the Training &amp; Development leadership team.</p>';
    body += '</div>';

    var html = '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>NJTC T&D Executive Summary ' + now.getFullYear() + '</title><style>';
    html += 'body{font-family:Arial,sans-serif;margin:0;padding:0;color:#0d1b2a;font-size:11pt}';
    html += '.page{width:8.5in;min-height:11in;padding:.75in;box-sizing:border-box;page-break-after:always}';
    html += 'h1{font-size:20pt;margin-bottom:16pt;color:#0a1628}';
    html += 'h2{font-size:14pt;margin-bottom:12pt;color:#0a1628;border-bottom:2pt solid #003087;padding-bottom:6pt}';
    html += 'h3{font-size:11pt;margin-bottom:8pt;color:#3d5166}';
    html += '@media print{.page{min-height:auto}}';
    html += '</style></head><body>' + body + '</body></html>';

    printWin.document.write(html);
    printWin.document.close();
    printWin.focus();
    setTimeout(function () { printWin.print(); }, 600);
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  SHARED HELPER: KPI TILE
  // ═══════════════════════════════════════════════════════════════════════
  function kpiTile(icon, val, label, color) {
    return '<div class="ta-card ta-kpi" style="--accent-color:' + (color || 'var(--blue-mid)') + '">' +
      '<div class="st-icon">' + icon + '</div>' +
      '<div class="ta-kpi-val" style="color:' + (color || 'var(--navy)') + '">' + esc(String(val)) + '</div>' +
      '<div class="ta-kpi-sub">' + esc(label) + '</div>' +
      '</div>';
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  HTML ESCAPE
  // ═══════════════════════════════════════════════════════════════════════
  function esc(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  ENTRY POINT — called by showPanel patch
  // ═══════════════════════════════════════════════════════════════════════
  function buildTrainingAnalytics() {
    if (_tdBuilt) return;
    _tdBuilt = true;

    var dept = (window.NJTC_SESSION || {}).dept || '';

    // Show/hide Checklist Mgmt tab
    var mgmtTab = document.getElementById('tdTab-mgmt');
    if (mgmtTab) mgmtTab.style.display = (dept === 'training') ? '' : 'none';

    // Show/hide exec PDF button
    var pdfBtn = document.getElementById('tdExecPDFBtn');
    if (pdfBtn) pdfBtn.style.display = (dept === 'data') ? '' : 'none';

    // Load default active tab
    tdShowTab('pd', document.getElementById('tdTab-pd'));
  }

  // ── Backward-compat stubs for old talent-panel callers ───────────────
  function renderTrainingReviews() { return ''; }
  function renderTrainingAnalytics() { buildTrainingAnalytics(); return ''; }

  // ── Expose globals ───────────────────────────────────────────────────
  window.buildTrainingAnalytics  = buildTrainingAnalytics;
  window.renderTrainingAnalytics = renderTrainingAnalytics;
  window.renderTrainingReviews   = renderTrainingReviews;
  window.tdShowTab               = tdShowTab;
  window.tdRefresh               = tdRefresh;
  window.tdGenerateExecPDF       = tdGenerateExecPDF;
  window.tdPrintChecklist        = window.tdPrintChecklist || function () {};

})();
