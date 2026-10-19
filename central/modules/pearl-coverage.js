/* ============================================================================
   NJTC PEARL — TUTOR COVERAGE (substitutions + regional Sub Trackers)
   ============================================================================
   Pure functions (no DOM, no fetch) used by Pearl Operations
   (central/modules/programming.js). Node-testable via module.exports.

   Two sources, two jobs:
   • Pearl "Instructor Substitutions" — the system record, created only when a
     Site Leader Drops the absent tutor's session and Edits in the substitute.
     After that swap the session (and its instructor attendance row) belongs to
     the SUBSTITUTE, so the original tutor's absence is otherwise invisible.
     → covered tutor absences.
   • NE / SW "Sub Tracker" tabs — planned coverage logged by hand by Site
     Leaders (pay + 24h response). Free-text names and dates.
     → reconciled against Pearl: logged on the tracker but not done in Pearl
       (the Drop/Edit was skipped), and the reverse.

   Tutor attendance stays exactly as recorded (official KPI). The "including
   covered absences" rate re-attributes each covered session: the original
   tutor's absence instead of the substitute's attendance.
   ============================================================================ */
(function (root) {
  'use strict';

  function str(v) { return v == null ? '' : String(v).trim(); }
  function normHeader(h) { return str(h).replace(/\s+/g, ' ').toLowerCase(); }

  // ISO yyyy-mm-dd from "10/16/2026", "10/16/2026 14:23:00", "2026-10-16…".
  function toISODate(v) {
    const t = str(v);
    if (!t) return '';
    let m = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (m) return m[1] + '-' + m[2].padStart(2, '0') + '-' + m[3].padStart(2, '0');
    m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
    if (m) { const y = m[3].length === 2 ? '20' + m[3] : m[3]; return y + '-' + m[1].padStart(2, '0') + '-' + m[2].padStart(2, '0'); }
    return '';
  }

  // Rows (header row first) → objects keyed by the normalized header text.
  // Returns [] when the first row is not a header containing `mustHave`.
  function rowsToObjects(rows, mustHave) {
    if (!rows || !rows.length) return [];
    const h = rows[0].map(normHeader);
    if (mustHave && h.indexOf(mustHave) < 0) return [];
    const out = [];
    for (let i = 1; i < rows.length; i++) {
      const r = rows[i];
      if (!r || !r.some(c => str(c))) continue;
      const o = {};
      h.forEach((k, j) => { if (k && !(k in o)) o[k] = str(r[j]); });
      out.push(o);
    }
    return out;
  }

  // Person names: "Lilia Quintero - SUB" / "lilia  quintero" → "lilia quintero".
  function normName(n) {
    return str(n).toLowerCase()
      .replace(/[-\u2013\u2014(]\s*sub\s*\)?\s*$/i, '')
      .replace(/[^a-z\s]/g, ' ')
      .replace(/\s+/g, ' ').trim();
  }
  function sameName(a, b) {
    const x = normName(a), y = normName(b);
    if (!x || !y) return false;
    if (x === y) return true;
    const xs = x.split(' '), ys = y.split(' ');
    return xs.length > 1 && ys.length > 1 && xs[0] === ys[0] && xs[xs.length - 1] === ys[ys.length - 1];
  }

  // ── Pearl Instructor Substitutions ─────────────────────────────────────
  function parseSubstitutions(rows) {
    return rowsToObjects(rows, 'session pearl id').map(o => ({
      origName:      o['original instructor name'] || '',
      origId:        o['original instructor pearl id'] || '',
      subName:       o['substitute instructor name'] || '',
      subId:         o['substitute instructor pearl id'] || '',
      substitutedOn: toISODate(o['substituted date']),
      substitutedBy: o['substituted by'] || '',
      date:          toISODate(o['session start date']),
      subject:       o['subject'] || '',
      school:        o['school'] || '',
      district:      o['district'] || '',
      region:        o['region'] || '',
      sessId:        o['session pearl id'] || ''
    })).filter(s => s.sessId && (s.origId || s.origName));
  }

  // One covered absence per Pearl session, charged to the ROOT original
  // tutor: if a session was re-subbed (A→B, then B→C) only A was absent.
  //
  // input:
  //   subs      parseSubstitutions() output
  //   sessById  { sessId: { status, title, start, school, district } }  (Session Details)
  //   instRow   (uid, title, isoDate) → 'attended' | 'absent' | 'other' | null
  //             — that person's own instructor attendance row for the session
  //   todayISO  sessions after today are planned coverage, not yet absences
  //   isOffered (status) → false for Cancelled / Rescheduled
  //
  // Each result: { ...sub, title, outcome, subRowAttended }
  //   outcome 'covered'          → counts as a covered absence
  //           'already_recorded' → original tutor already has an absent row (counted in recorded %)
  //           'tutor_attended'   → original tutor ALSO marked attended — conflict to review
  //           'not_offered'      → session cancelled / rescheduled — no absence
  //           'upcoming'         → session is in the future
  //           'undated'          → no session date to place it — listed, not counted
  //           'no_session'       → session not in Session Details (deleted / archived site) — not counted
  function coveredAbsences(subs, sessById, instRow, todayISO, isOffered) {
    const bySess = {};
    subs.forEach(s => { (bySess[s.sessId] = bySess[s.sessId] || []).push(s); });
    const out = [];
    Object.keys(bySess).forEach(sid => {
      const chain = bySess[sid];
      const subIds = new Set(chain.map(s => s.subId).filter(Boolean));
      const roots = chain.filter(s => !s.origId || !subIds.has(s.origId));
      const root = (roots.length ? roots : chain)
        .slice().sort((a, b) => (a.substitutedOn || '').localeCompare(b.substitutedOn || ''))[0];
      // Who delivered: the last substitute in the chain.
      const last = chain.slice().sort((a, b) => (a.substitutedOn || '').localeCompare(b.substitutedOn || '')).pop();
      const sess = sessById[sid] || null;
      const date = (sess && toISODate(sess.start)) || root.date;
      const title = sess ? str(sess.title) : '';
      const rec = Object.assign({}, root, {
        date, title,
        school: root.school || (sess && sess.school) || '',
        district: root.district || (sess && sess.district) || '',
        deliveredById: last.subId, deliveredByName: last.subName,
        outcome: 'covered', subRowAttended: false
      });
      if (sess && !isOffered(sess.status)) rec.outcome = 'not_offered';
      else if (!date) rec.outcome = 'undated';
      else if (todayISO && date > todayISO) rec.outcome = 'upcoming';
      else if (!sess) rec.outcome = 'no_session';
      else if (title && root.origId) {
        const own = instRow(root.origId, title, date);
        if (own === 'absent') rec.outcome = 'already_recorded';
        else if (own === 'attended') rec.outcome = 'tutor_attended';
      }
      if (rec.outcome === 'covered' && title && last.subId) {
        rec.subRowAttended = instRow(last.subId, title, date) === 'attended';
      }
      out.push(rec);
    });
    return out;
  }

  // ── Regional Sub Trackers ──────────────────────────────────────────────
  // Year for a month/day with no year: SY runs Jul–Jun.
  function syYear(month, syStartYear) { return month >= 7 ? syStartYear : syStartYear + 1; }
  function isoFromMDY(m, d, y, syStartYear) {
    const mm = +m, dd = +d;
    if (!(mm >= 1 && mm <= 12 && dd >= 1 && dd <= 31)) return '';
    let yy = y ? +y : syYear(mm, syStartYear);
    if (yy < 100) yy += 2000;
    const dt = new Date(Date.UTC(yy, mm - 1, dd));
    if (dt.getUTCMonth() !== mm - 1) return '';
    return yy + '-' + String(mm).padStart(2, '0') + '-' + String(dd).padStart(2, '0');
  }
  // "10/3 & 10/5", "10/13-10/15", "10/14/2026", "2026-10-14", "10/3, 10/5"
  // → { dates: [iso…], range: bool }. Ranges expand to weekdays (max 31 days).
  function parseTrackerDates(v, syStartYear) {
    const t = str(v);
    if (!t) return { dates: [], range: false };
    const iso = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T].*)?$/);
    if (iso) { const d = isoFromMDY(iso[2], iso[3], iso[1], syStartYear); return { dates: d ? [d] : [], range: false }; }
    const MD = '(\\d{1,2})\\/(\\d{1,2})(?:\\/(\\d{2,4}))?';
    const rng = t.match(new RegExp('^' + MD + '\\s*[-\u2013\u2014]\\s*' + MD + '$'));
    if (rng) {
      const a = isoFromMDY(rng[1], rng[2], rng[3], syStartYear), b = isoFromMDY(rng[4], rng[5], rng[6], syStartYear);
      if (!a || !b || b < a) return { dates: [], range: true };
      const out = []; const d = new Date(a + 'T00:00:00Z'); const end = new Date(b + 'T00:00:00Z');
      for (let i = 0; d <= end && i < 32; i++) {
        const wd = d.getUTCDay();
        if (wd !== 0 && wd !== 6) out.push(d.toISOString().slice(0, 10));
        d.setUTCDate(d.getUTCDate() + 1);
      }
      return { dates: (end - new Date(a + 'T00:00:00Z')) / 864e5 > 31 ? [] : out, range: true };
    }
    const parts = t.split(/\s*(?:&|,|;|\band\b)\s*/i).filter(Boolean);
    const dates = [];
    for (const p of parts) {
      const m = p.match(new RegExp('^' + MD + '$'));
      if (!m) return { dates: [], range: false };       // any unreadable piece → unclear
      const d = isoFromMDY(m[1], m[2], m[3], syStartYear);
      if (!d) return { dates: [], range: false };
      dates.push(d);
    }
    return { dates: Array.from(new Set(dates)).sort(), range: false };
  }

  // Exact header first ("sub" must not resolve to "subjects", "date" not to
  // "date you called/ emailed"), then the first header starting with it.
  function findCol(o, prefix) {
    if (prefix in o) return o[prefix];
    const k = Object.keys(o).find(x => x.indexOf(prefix) === 0);
    return k ? o[k] : '';
  }
  // Google Sheets auto-converts a Grades entry like "3-5" into the date
  // 3/5/2026. A real date never belongs in Grades, so turn it back.
  function gradesText(v) {
    const t = str(v);
    let m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s.*)?$/);
    if (m && +m[3] >= 2000 && +m[3] < 2100) return (+m[1]) + '-' + (+m[2]);
    m = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T].*)?$/);
    if (m && +m[1] >= 2000 && +m[1] < 2100) return (+m[2]) + '-' + (+m[3]);
    return t;
  }

  // ── Free-text names / sites → Pearl roster ─────────────────────────────
  // Common nicknames; any first name that is a prefix of the other
  // (Nick/Nicholas, Sam/Samantha) also matches.
  const NICK = {
    nick: ['nicholas', 'nicolas', 'nicole'], katie: ['katherine', 'kathryn', 'kathleen', 'catherine', 'caitlin', 'kaitlyn'],
    kate: ['katherine', 'kathryn', 'kathleen', 'catherine'], kathy: ['katherine', 'kathryn', 'kathleen'], cathy: ['catherine'],
    chris: ['christopher', 'christina', 'christine'], tina: ['christina', 'martina'], mike: ['michael'], liz: ['elizabeth'],
    beth: ['elizabeth', 'bethany'], betty: ['elizabeth'], jen: ['jennifer'], jenny: ['jennifer'], matt: ['matthew'],
    tom: ['thomas'], bill: ['william'], will: ['william'], bob: ['robert'], rob: ['robert'], jim: ['james'], jimmy: ['james'],
    joe: ['joseph'], dan: ['daniel', 'danielle'], dave: ['david'], steve: ['stephen', 'steven'], tony: ['anthony'],
    jess: ['jessica'], becky: ['rebecca'], mandy: ['amanda'], abby: ['abigail'], pat: ['patricia', 'patrick'],
    sue: ['susan', 'suzanne'], ben: ['benjamin'], andy: ['andrew'], drew: ['andrew'], vicky: ['victoria'], tori: ['victoria'],
    meg: ['margaret', 'megan'], maggie: ['margaret'], peggy: ['margaret'], deb: ['deborah', 'debra'], debbie: ['deborah', 'debra'],
    cindy: ['cynthia'], kim: ['kimberly'], tim: ['timothy'], greg: ['gregory'], jon: ['jonathan'], john: ['jonathan'],
    ed: ['edward'], eddie: ['edward'], rick: ['richard'], rich: ['richard'], ron: ['ronald'], don: ['donald'],
    alex: ['alexander', 'alexandra', 'alexis'], sam: ['samuel', 'samantha'], val: ['valerie'], gabby: ['gabriella', 'gabrielle'],
    lexi: ['alexis', 'alexandra'], manny: ['manuel'], tash: ['natasha'], nate: ['nathan', 'nathaniel'], zach: ['zachary'],
  };
  function sameFirst(a, b) {
    if (!a || !b) return false;
    if (a === b) return true;
    const [s, l] = a.length <= b.length ? [a, b] : [b, a];
    if (s.length >= 3 && l.indexOf(s) === 0) return true;
    return (NICK[a] || []).indexOf(b) >= 0 || (NICK[b] || []).indexOf(a) >= 0;
  }
  // "Nick H." ~ "Nicholas Hoover"; "Katie Rose" ~ "Katherine Rose"; exact
  // names via sameName. The last name may be a single initial.
  function looseName(a, b) {
    if (sameName(a, b)) return true;
    const x = normName(a).split(' '), y = normName(b).split(' ');
    if (x.length < 2 || y.length < 2) return false;
    // "Katie Rose" ~ "Katie Rose Davis" (two-part first name, last name left off)
    const [sh, lo] = x.length <= y.length ? [x, y] : [y, x];
    if (sh.length < lo.length && sh.every((w, i) => w === lo[i])) return true;
    const lx = x[x.length - 1], ly = y[y.length - 1];
    const lastOk = lx === ly || (lx.length === 1 && ly[0] === lx) || (ly.length === 1 && lx[0] === ly);
    return lastOk && sameFirst(x[0], y[0]);
  }
  // The one roster person a free-text name refers to — searched within the
  // site's school first. null when there is no match or more than one.
  function matchPerson(text, people, school) {
    if (!str(text) || /vacan/i.test(text)) return null;
    const pick = list => { const hit = list.filter(p => looseName(text, p.name)); return hit.length === 1 ? hit[0] : null; };
    if (school) { const h = pick(people.filter(p => p.school === school)); if (h) return h; }
    return pick(people);
  }
  const SITE_STOP = new Set(['school', 'schools', 'elementary', 'es', 'ms', 'hs', 'middle', 'high', 'the', 'of', 'and', 'lea',
    'township', 'twp', 'regional', 'district', 'campus', 'upper', 'lower', 'primary', 'intermediate']);
  function siteTokens(v) {
    return str(v).toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(t => t && !SITE_STOP.has(t));
  }
  // Free-text "Site Covering" (e.g. "Denbo", "Field Street") → the one Pearl
  // school whose name contains every word of it. null if none or ambiguous.
  function matchSchool(site, schools) {
    const t = siteTokens(site);
    if (!t.length) return null;
    const hit = schools.filter(sc => { const st = siteTokens(sc); return t.every(w => st.indexOf(w) >= 0); });
    return hit.length === 1 ? hit[0] : null;
  }

  function parseTracker(rows, region, syStartYear) {
    return rowsToObjects(rows, 'sub').map(o => {
      const dateRaw = findCol(o, 'date');
      const pd = parseTrackerDates(dateRaw, syStartYear);
      const covering = findCol(o, 'tutor covering') || findCol(o, 'absent tutor');
      return {
        region,
        sub: findCol(o, 'sub'),
        absentTutor: covering,
        isVacancy: /vacan/i.test(covering),
        subjects: findCol(o, 'subjects'),
        grades: gradesText(findCol(o, 'grades')),
        dateRaw, dates: pd.dates, isRange: pd.range,
        hours: findCol(o, 'hours'),
        site: findCol(o, 'site covering'),
        payPeriod: findCol(o, 'pay period'),
        coordinator: findCol(o, 'site coordinator'),
        contacted: findCol(o, 'date you called'),
        responsive: findCol(o, 'responsive')
      };
    }).filter(e => e.sub || e.absentTutor || e.dateRaw);
  }

  // status: 'in_pearl' | 'partial' | 'not_in_pearl' | 'upcoming' | 'unclear'
  // skipSessIds: Pearl sessions to leave out of "not on tracker" (cancelled /
  // rescheduled sessions — nothing was covered).
  // roster (optional): { schools: [name], people: [{id, name, school}],
  //   sessionDays: school → Set(iso) of days that school had sessions }.
  //   With it, each entry gets its Pearl school / absent tutor, and a DATE
  //   RANGE only expects coverage on days the site actually had sessions.
  function reconcileTracker(entries, subs, todayISO, skipSessIds, roster) {
    const used = new Set();
    const rows = entries.map(e => {
      const school = roster ? matchSchool(e.site, roster.schools || []) : null;
      const tutor = roster ? matchPerson(e.absentTutor, roster.people || [], school) : null;
      const base = Object.assign({}, e, { school, tutorMatch: tutor });
      if (!e.dates.length) return Object.assign(base, { status: 'unclear', due: 0, found: 0, matches: [] });
      let dates = e.dates;
      let rangeChecked = false;
      if (e.isRange && school && roster.sessionDays) {
        const days = roster.sessionDays(school);
        if (days) { dates = dates.filter(d => days.has(d) || (todayISO && d > todayISO)); rangeChecked = true; }
      }
      const due = dates.filter(d => !todayISO || d <= todayISO);
      if (!due.length) return Object.assign(base, { status: dates.length ? 'upcoming' : (rangeChecked ? 'no_sessions' : 'upcoming'), due: 0, found: 0, matches: [], rangeChecked });
      const matches = [];
      let found = 0;
      due.forEach(d => {
        const hit = subs.filter(s => s.date === d && looseName(s.subName, e.sub));
        if (hit.length) { found++; hit.forEach(s => { used.add(s); matches.push(s); }); }
      });
      const status = found === due.length ? 'in_pearl' : found ? 'partial' : 'not_in_pearl';
      return Object.assign(base, { status, due: due.length, found, matches, rangeChecked });
    });
    // Pearl substitutions (already happened) with no tracker line for that sub + date.
    const notOnTracker = subs.filter(s => !used.has(s) && s.date && (!todayISO || s.date <= todayISO) &&
      !(skipSessIds && skipSessIds.has(s.sessId)) &&
      !entries.some(e => e.dates.indexOf(s.date) >= 0 && looseName(e.sub, s.subName)));
    return { rows, notOnTracker };
  }

  const API = { toISODate, rowsToObjects, normName, sameName, looseName, matchPerson, matchSchool, gradesText,
                parseSubstitutions, coveredAbsences, parseTrackerDates, parseTracker, reconcileTracker };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  else root.NJTC_PEARL_COVERAGE = API;
})(typeof window !== 'undefined' ? window : this);
