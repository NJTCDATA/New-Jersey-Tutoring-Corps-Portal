/* ============================================================================
   NJTC Pulse Weekly — week-by-week Pearl metrics + year-over-year comparison.
   ONE implementation shared by the browser (current SY, live Pearl rows) and
   scripts/build-pulse-archive.js (frozen prior SY -> central/data/*.json), so
   both years are always computed identically.

   Rows use the Pearl "Missed Reasons" (Attendance Detail) layout:
     User, Role, Session, Session Status, Planned Session Start, Session Date,
     Attendance Status, Attendance Missed Reason, Grade, Sex, Race, School,
     District, Pearl User ID
   Output is aggregate-only (counts by week and by reason) — no names or IDs.
   ============================================================================ */
(function (root) {
  'use strict';

  var WEEK_MS = 7 * 24 * 60 * 60 * 1000;
  var DEFAULT_IDX = { USER: 0, ROLE: 1, SESSION: 2, PLAN_START: 4, SESS_DATE: 5,
                      MISS_REASON: 7, SCHOOL: 11, DISTRICT: 12, USER_ID: 13 };

  function parseDate(v) {
    v = String(v || '').trim();
    if (!v) return null;
    var m = v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (m) return new Date(+m[3], +m[1] - 1, +m[2]);
    m = v.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return new Date(+m[1], +m[2] - 1, +m[3]);
    var d = new Date(v);
    return isNaN(d.getTime()) ? null : new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }

  // Program week number: Week 1 = the SY's first Monday (anchor). 0 = before SY.
  function weekNum(dateStr, anchor) {
    var d = parseDate(dateStr);
    if (!d) return 0;
    var day = d.getDay();
    var mon = new Date(d.getFullYear(), d.getMonth(), d.getDate() + (day === 0 ? -6 : 1 - day));
    // Math.round absorbs the 1h DST shift between anchor and date.
    var n = Math.round((mon.getTime() - anchor.getTime()) / WEEK_MS) + 1;
    return n >= 1 ? n : 0;
  }

  function isArchived(s) { return /^\s*zzz/i.test(String(s || '')); }

  /**
   * compute(rows, { classify(row) -> 'attended'|'absent'|'service_interruption'|...,
   *                 anchor: Date (Week 1 Monday), upTo?: Date, idx?: column map })
   * -> [{ week, stuAtt, stuAbs, stuSI, instAtt, instAbs, instSI, sessions, scholars,
   *       miss: {reason: n}, si: {reason: n} }]   (sorted by week)
   */
  function compute(rows, opts) {
    var I = Object.assign({}, DEFAULT_IDX, opts.idx || {});
    var anchor = opts.anchor, classify = opts.classify;
    var upTo = opts.upTo ? new Date(opts.upTo) : null;
    if (upTo) upTo.setHours(23, 59, 59, 999);
    var W = {};
    for (var i = 0; i < rows.length; i++) {
      var r = rows[i];
      if (isArchived(r[I.SCHOOL]) || isArchived(r[I.DISTRICT])) continue;
      var dateStr = r[I.SESS_DATE];
      if (upTo) { var d = parseDate(dateStr); if (d && d > upTo) continue; }
      var wk = weekNum(dateStr, anchor);
      if (!wk) continue;
      var w = W[wk] || (W[wk] = { week: wk, stuAtt: 0, stuAbs: 0, stuSI: 0, instAtt: 0, instAbs: 0, instSI: 0,
                                  _sess: {}, _sch: {}, _schools: {}, miss: {}, si: {} });
      if (r[I.SCHOOL]) w._schools[r[I.SCHOOL]] = 1;
      var role = r[I.ROLE], cls = classify(r), reason = String(r[I.MISS_REASON] || '').trim() || 'Unknown';
      var sKey = [r[I.SESSION], r[I.SCHOOL], dateStr, r[I.PLAN_START]].join('|');
      if (role === 'Student') {
        if (cls === 'attended') { w.stuAtt++; w._sess[sKey] = 1; var id = r[I.USER_ID] || r[I.USER]; if (id) w._sch[id] = 1; }
        else if (cls === 'absent') { w.stuAbs++; w.miss[reason] = (w.miss[reason] || 0) + 1; }
        else if (cls === 'service_interruption') { w.stuSI++; w.si[reason] = (w.si[reason] || 0) + 1; }
      } else if (role === 'Instructor') {
        if (cls === 'attended') { w.instAtt++; w._sess[sKey] = 1; }
        else if (cls === 'absent') w.instAbs++;
        else if (cls === 'service_interruption') w.instSI++;
      }
    }
    return Object.keys(W).map(Number).sort(function (a, b) { return a - b; }).map(function (k) {
      var w = W[k];
      w.sessions = Object.keys(w._sess).length;
      w.scholars = Object.keys(w._sch).length;
      w.schools = Object.keys(w._schools).length;
      delete w._sess; delete w._sch; delete w._schools;
      return w;
    });
  }

  function rate(a, b) { return (a + b) > 0 ? Math.round(a / (a + b) * 1000) / 10 : null; }

  // sumWeeks(weeks, from, to) or sumWeeks(weeks, [week numbers])
  function sumWeeks(weeks, from, to) {
    var t = { stuAtt: 0, stuAbs: 0, stuSI: 0, instAtt: 0, instAbs: 0, instSI: 0, sessions: 0, miss: {}, si: {}, n: 0 };
    var only = Array.isArray(from) ? from : null;
    weeks.forEach(function (w) {
      if (only ? only.indexOf(w.week) < 0 : (w.week < from || w.week > to)) return;
      t.n++;
      ['stuAtt', 'stuAbs', 'stuSI', 'instAtt', 'instAbs', 'instSI', 'sessions'].forEach(function (f) { t[f] += w[f] || 0; });
      ['miss', 'si'].forEach(function (f) { Object.keys(w[f] || {}).forEach(function (k) { t[f][k] = (t[f][k] || 0) + w[f][k]; }); });
    });
    t.scholarRate = rate(t.stuAtt, t.stuAbs);
    t.tutorRate = rate(t.instAtt, t.instAbs);
    var recs = t.stuAtt + t.stuAbs + t.stuSI;
    t.scholarRecords = recs;
    t.siPer100 = recs ? Math.round(t.stuSI / recs * 1000) / 10 : null;
    return t;
  }

  function per100(n, recs) { return recs ? n / recs * 100 : 0; }

  // Reason-level pattern: is this a known seasonal issue (seen at the same point
  // last year) or new this year? Rates are per 100 scholar records so program
  // size differences between years don't distort the comparison.
  function patterns(cur, prior, kind) {
    var keys = {};
    Object.keys(cur[kind]).forEach(function (k) { keys[k] = 1; });
    Object.keys(prior[kind]).forEach(function (k) { keys[k] = 1; });
    return Object.keys(keys).map(function (k) {
      var c = cur[kind][k] || 0, p = prior[kind][k] || 0;
      var cr = per100(c, cur.scholarRecords), pr = per100(p, prior.scholarRecords);
      var status;
      if (c === 0) status = p >= 5 ? 'not-yet' : null;       // last year had it by now; not seen yet
      else if (pr < 0.25 || p < 3) status = 'new';
      else if (cr >= pr * 1.5) status = 'growing';
      else if (cr <= pr * 0.67) status = 'easing';
      else status = 'recurring';
      return { reason: k, kind: kind, cur: c, prior: p, curPer100: Math.round(cr * 10) / 10, priorPer100: Math.round(pr * 10) / 10, status: status };
    }).filter(function (x) { return x.status && (x.cur >= 3 || x.prior >= 5); })
      .sort(function (a, b) { return (b.cur + b.prior) - (a.cur + a.prior); });
  }

  // Calendar alignment: this SY's week k is compared with the same calendar
  // week last year (52 weeks earlier, same weekday), so school testing windows,
  // holidays and events line up even when the two SYs started on different dates.
  // Returns the offset to add to a current week number to get the prior-SY week.
  function calendarOffset(curAnchor, priorAnchor) {
    var back = new Date(curAnchor.getFullYear(), curAnchor.getMonth(), curAnchor.getDate() - 364);
    var mon = new Date(back.getFullYear(), back.getMonth(), back.getDate());
    return Math.round((mon.getTime() - priorAnchor.getTime()) / WEEK_MS);
  }

  function mondayOf(anchor, week) {
    return new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate() + (week - 1) * 7);
  }

  /**
   * compare(curWeeks, priorWeeks, { curAnchor, priorAnchor, throughWeek? })
   * Aligns weeks by calendar (see calendarOffset) and summarises what is
   * recurring vs new, plus last year's next four weeks (planning horizon).
   */
  function compare(curWeeks, priorWeeks, opts) {
    opts = opts || {};
    var N = opts.throughWeek || (curWeeks.length ? curWeeks[curWeeks.length - 1].week : 0);
    var off = (opts.curAnchor && opts.priorAnchor) ? calendarOffset(opts.curAnchor, opts.priorAnchor) : 0;
    var byP = {}; priorWeeks.forEach(function (w) { byP[w.week] = w; });
    var byC = {}; curWeeks.forEach(function (w) { byC[w.week] = w; });
    // Like-for-like guard: a week only feeds the headline comparison and the
    // recurring-vs-new analysis when both years ran at comparable volume
    // (>=100 scholar records each, neither under 25% of the other) — e.g. a
    // one-school soft-launch week last year is shown but not compared.
    var MIN_RECS = 100, MIN_RATIO = 0.25;
    function recs(w) { return w ? (w.stuAtt + w.stuAbs + w.stuSI) : 0; }
    var rows = [], curComparable = [], priorComparable = [];
    for (var k = 1; k <= N; k++) {
      var c = byC[k], p = byP[k + off];
      var rc = recs(c), rp = recs(p);
      var comparable = rc >= MIN_RECS && rp >= MIN_RECS && rp >= rc * MIN_RATIO && rc >= rp * MIN_RATIO;
      var why = comparable ? '' : !rc ? 'no sessions this year' : !rp ? 'no sessions last year'
              : (rp < MIN_RECS || rp < rc * MIN_RATIO) ? 'last year partial (' + rp + ' scholar records' + (p.schools ? ', ' + p.schools + ' school' + (p.schools === 1 ? '' : 's') : '') + ')'
              : 'this year partial (' + rc + ' scholar records)';
      if (comparable) { curComparable.push(k); priorComparable.push(k + off); }
      rows.push({
        comparable: comparable, notComparableWhy: why,
        curRecords: rc, priorRecords: rp, priorSchools: p ? p.schools : 0, curSchools: c ? c.schools : 0,
        week: k, priorWeek: k + off,
        curMonday: opts.curAnchor ? mondayOf(opts.curAnchor, k) : null,
        priorMonday: opts.priorAnchor ? mondayOf(opts.priorAnchor, k + off) : null,
        cur: c ? { scholarRate: rate(c.stuAtt, c.stuAbs), tutorRate: rate(c.instAtt, c.instAbs), si: c.stuSI, sessions: c.sessions } : null,
        prior: p ? { scholarRate: rate(p.stuAtt, p.stuAbs), tutorRate: rate(p.instAtt, p.instAbs), si: p.stuSI, sessions: p.sessions } : null,
      });
    }
    var cur = sumWeeks(curWeeks, curComparable), prior = sumWeeks(priorWeeks, priorComparable);
    // Planning baseline: last year's comparable weeks, or (if none yet) last
    // year's first full-volume weeks so the "rose in those weeks" signal is fair.
    var ahead = sumWeeks(priorWeeks, N + off + 1, N + off + 4);
    var aheadRows = priorWeeks.filter(function (w) { return w.week > N + off && w.week <= N + off + 4; }).map(function (w) {
      var top = Object.keys(w.si).sort(function (a, b) { return w.si[b] - w.si[a]; })[0] || null;
      return { week: w.week - off, priorWeek: w.week, priorMonday: opts.priorAnchor ? mondayOf(opts.priorAnchor, w.week) : null, scholarRate: rate(w.stuAtt, w.stuAbs), tutorRate: rate(w.instAtt, w.instAbs), si: w.stuSI, topSI: top, topSICount: top ? w.si[top] : 0 };
    });
    // Reasons that rise in the planning window vs last year's weeks 1..N
    var base = prior.scholarRecords ? prior : sumWeeks(priorWeeks, 1, N + off);
    var aheadRising = (base.scholarRecords >= MIN_RECS ? patterns(ahead, base, 'si').concat(patterns(ahead, base, 'miss')) : [])
      .filter(function (x) { return x.cur >= 5 && (x.status === 'new' || x.status === 'growing'); })
      .slice(0, 5);
    return {
      throughWeek: N, offset: off, rows: rows, comparableWeeks: curComparable.length, cur: cur, prior: prior, ahead: ahead, aheadRows: aheadRows,
      patterns: curComparable.length ? patterns(cur, prior, 'si').concat(patterns(cur, prior, 'miss')) : [],
      aheadRising: aheadRising,
    };
  }

  var api = { compute: compute, compare: compare, calendarOffset: calendarOffset, mondayOf: mondayOf, weekNum: weekNum, parseDate: parseDate, sumWeeks: sumWeeks, rate: rate };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.NJTC_PULSE_WEEKLY = api;
})(typeof window !== 'undefined' ? window : this);
