/* ============================================================================
   NJTC PARTNER REPORT CORE — shared by the Partner Dashboard (partner/app.js)
   and the Central Team Portal (central/modules/partner-report-pdf.js).

   One source of truth for:
   - partner attendance methodology (Late = Attended; Service Interruptions
     excluded from numerator and denominator; scholar-side reasons only),
   - curated "Session Highlights" (scholar comments first, weekly, filtered,
     plus the NJTC-controlled exclusion list in highlight-exclusions.json),
   - the Weekly Operations Report PDF.

   Because both portals call the same functions on the same bundle shape
   (see scripts/build-partner-data.js), the PDF a partner downloads and the
   PDF Central downloads for that partner are identical.
   ============================================================================ */
(function () {
  'use strict';

  // ── Column layouts — mirror scripts/build-partner-data.js ────────────────
  const ATT  = { USER:0, ROLE:1, SESSION:2, SESS_STATUS:3, PLAN_START:4, SESS_DATE:5, ATT_STATUS:6, MISS_REASON:7, GRADE:8, SEX:9, RACE:10, SCHOOL:11, DISTRICT:12, USER_ID:13, WEEK:26 };
  const INST = { FILLED_BY:0, FILLED_FOR:1, ENGAGEMENT:2, ENJOYMENT:3, LEARNING:4, OVERALL:5, COMMENT_ADMIN:6, COMMENT_SELF:7, DATE:8, SCHOOL:9, DISTRICT:10 };
  const STU  = { FILLED_BY:0, FILLED_FOR:1, CONFIDENCE:2, ENJOYMENT:3, LEARNING:4, OVERALL:5, COMMENT:6, DATE:7, SCHOOL:8, DISTRICT:9, REGION:10 };
  const SESS = { TITLE:0, INSTRUCTOR:1, STUDENTS:2, LOCATION:3, STATUS:4, ATTENDANCE:5, START:6, SCHED_DUR:7, ACTUAL_DUR:8, SUBJECT:9, GRADE:10, SCHOOL:11, DISTRICT:12, REGION:13, SESS_ID:14, INST_ID:15, STU_IDS:16, DUR_MINS:17 };

  // Mirrors scripts/build-partner-data.js — used by Central to build the same
  // scoped bundle a partner's nightly bundle contains.
  const REGION_DISTRICTS = {
    'North-East': [
      'iLearn CMO', 'Hoboken Dual Language Charter Schools', 'Paterson',
      'Central Jersey College Prep', 'Middlesex County STEM Charter School'
    ],
    'South-West': [
      'Lawrence Township Schools', 'LEAP Academy Charter School', 'Pemberton Twp Schools',
      'Penns Grove - Carneys Point Regional School District', 'Hamilton Township',
      'String Theory Schools', 'Gloucester Township School District',
      'Global Leadership Academy Charter Schools', 'Berlin Community School', 'Haddon Township',
      'American Paradigm Schools'
    ]
  };
  // Same defaults as the "Refresh Partner Portal Data" workflow inputs.
  const SY_LABEL = '2025-26';
  const SY_START = '2025-07-01';
  const PEARL_2PACX = '2PACX-1vQ1iC8NZFJt3iinGUEqftKtP32N43axi_JN_RQI36EBUdhZS0PaZRwd-1AJT3bEVe6cqHA0tCA3vb5K';
  const PEARL_GIDS = { att: 702726038, inst: 1955492004, stu: 1245403832, sess: 625567780 };

  const SCHOLAR_MISS_REASONS = new Set([
    'Absent', 'Scholar declined attending tutoring session',
    'Classroom Teacher Requested to Keep Scholar in Class',
    'HADDON TWP ONLY -- Teacher requested whole group support', 'Scholar Left Early'
  ]);
  const TUTOR_MISS_REASONS = new Set([
    'Absent; Not Covered (Tutor not available)', 'Absent; Covered by Sub Tutor',
    'Absent; Covered by Dual Role', 'Absent; Covered by the Site Leader',
    'Absent; Covered by the Instructional Coach', 'Tutor Left Early (no sub)'
  ]);

  // ── Small helpers ─────────────────────────────────────────────────────────
  function parseDate(s) {
    if (!s) return null;
    const d = new Date(s);
    return isNaN(d.getTime()) ? null : d;
  }
  // Monday of the session's calendar week — key sorts chronologically.
  // Cached by calendar date (the part before any time-of-day): a partner
  // bundle has tens of thousands of rows but only a few hundred distinct
  // dates, and Date parsing + locale formatting per row is the slow part.
  const WEEK_CACHE = new Map();
  function weekBucket(dateStr) {
    if (!dateStr) return null;
    const raw = String(dateStr).trim();
    const sp = raw.indexOf(' ');
    const dayKey = sp === -1 ? raw : raw.slice(0, sp);
    if (WEEK_CACHE.has(dayKey)) return WEEK_CACHE.get(dayKey);
    const d = parseDate(dayKey) || parseDate(raw);
    let out = null;
    if (d) {
      const day = d.getDay(); // 0=Sun..6=Sat
      const monday = new Date(d);
      monday.setDate(d.getDate() + (day === 0 ? -6 : 1 - day));
      const key = monday.getFullYear() + '-' + String(monday.getMonth() + 1).padStart(2, '0') + '-' + String(monday.getDate()).padStart(2, '0');
      out = { key, label: monday.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) };
    }
    WEEK_CACHE.set(dayKey, out);
    return out;
  }
  function weekRangeLabel(key) {
    const start = new Date(key + 'T12:00:00');
    if (isNaN(start)) return key;
    const end = new Date(start); end.setDate(start.getDate() + 4);
    const f = d => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    return `${f(start)} – ${f(end)}, ${end.getFullYear()}`;
  }
  function pct(n, d) { return d > 0 ? Math.round((n / d) * 1000) / 10 : null; }

  // ── Scope filter (district / school / week) — same rules as partner/app.js
  function scoped(rows, distIdx, schIdx, dateIdx, scope) {
    scope = scope || {};
    const district = scope.district || 'ALL', school = scope.school || 'ALL', week = scope.week || 'ALL';
    return (rows || []).filter(r => {
      if (district !== 'ALL' && (r[distIdx] || '').trim() !== district) return false;
      if (school !== 'ALL' && (r[schIdx] || '').trim() !== school) return false;
      if (week !== 'ALL' && dateIdx != null) {
        const wk = weekBucket(r[dateIdx]);
        if (!wk || wk.key !== week) return false;
      }
      return true;
    });
  }
  // Rows on or before the end of a given week (for year-to-date figures).
  function throughWeek(rows, dateIdx, weekKey) {
    if (!weekKey || weekKey === 'ALL') return rows;
    return rows.filter(r => { const wk = weekBucket(r[dateIdx]); return !wk || wk.key <= weekKey; });
  }

  // ── Attendance methodology — mirrors onsite/pearl-data.js ─────────────────
  function isScholarRow(r) { return (r[ATT.ROLE] || '').trim() !== 'Instructor'; }

  function classifyAtt(row) {
    const status = (row[ATT.ATT_STATUS] || '').trim();
    const reason = (row[ATT.MISS_REASON] || '').trim();
    const isInstructor = (row[ATT.ROLE] || '').trim() === 'Instructor';
    if (status === 'Attended' || status === 'Late') return 'attended';
    if (status === 'Missed') {
      if (isInstructor) return TUTOR_MISS_REASONS.has(reason) ? 'absent' : 'si';
      return (SCHOLAR_MISS_REASONS.has(reason) || reason === '') ? 'absent' : 'si';
    }
    return 'other';
  }

  function scholarStats(attRows) {
    const rows = attRows.filter(isScholarRow);
    let attended = 0, absent = 0, excused = 0;
    rows.forEach(r => {
      const c = classifyAtt(r);
      if (c === 'attended') attended++;
      else if (c === 'absent') absent++;
      else if (c === 'si') excused++;
    });
    const total = attended + absent;
    return { rows, attended, absent, excused, total, rate: pct(attended, total) };
  }

  function scholarWeekly(scholarRows) {
    const byWeek = {};
    scholarRows.forEach(r => {
      const wk = weekBucket(r[ATT.SESS_DATE]);
      if (!wk) return;
      const c = classifyAtt(r);
      if (c !== 'attended' && c !== 'absent') return;
      if (!byWeek[wk.key]) byWeek[wk.key] = { key: wk.key, label: wk.label, attended: 0, absent: 0 };
      byWeek[wk.key][c]++;
    });
    return Object.keys(byWeek).sort().map(k => ({ ...byWeek[k], rate: pct(byWeek[k].attended, byWeek[k].attended + byWeek[k].absent) }));
  }

  function scholarMissedReasons(scholarRows) {
    const counts = {};
    scholarRows.forEach(r => {
      if (classifyAtt(r) !== 'absent') return;
      const reason = (r[ATT.MISS_REASON] || '').trim() || 'Not specified';
      counts[reason] = (counts[reason] || 0) + 1;
    });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }

  function scholarsToCheckIn(scholarRows) {
    const byScholar = {};
    scholarRows.forEach(r => {
      const uid = (r[ATT.USER_ID] || '').trim();
      if (!uid) return;
      if (!byScholar[uid]) byScholar[uid] = { uid, name: (r[ATT.USER] || '').trim() || 'Unknown', attended: 0, absences: 0, lastAttended: null, lastAttendedSort: null, missed: [] };
      const s = byScholar[uid];
      const c = classifyAtt(r);
      if (c === 'attended') {
        s.attended++;
        const raw = (r[ATT.SESS_DATE] || '').trim();
        const parsed = parseDate(raw);
        if (raw && parsed && (!s.lastAttendedSort || parsed > s.lastAttendedSort)) {
          s.lastAttended = raw;
          s.lastAttendedSort = parsed;
        }
      } else if (c === 'absent') {
        s.absences++;
        s.missed.push({
          date: (r[ATT.SESS_DATE] || '').trim() || 'Date not recorded',
          reason: (r[ATT.MISS_REASON] || '').trim() || 'Not specified'
        });
      }
    });
    return Object.values(byScholar)
      .map(s => ({ ...s, total: s.attended + s.absences, rate: pct(s.attended, s.attended + s.absences) }))
      .filter(s => s.absences > 0 && (s.attended === 0 || (s.total >= 3 && s.rate < 80)))
      .sort((a, b) => (a.rate ?? 0) - (b.rate ?? 0) || b.absences - a.absences);
  }

  // ══════════════════════════════════════════════════════════════════════
  //  SESSION HIGHLIGHTS — curated, weekly, scholar comments first
  //
  //  - Only comments attached to a 4–5 "Overall" rating.
  //  - Must read as clearly positive, contain no negative/sensitive language,
  //    no profanity, no contact info, and never name a scholar or tutor
  //    (checked against every name on this partner's own roster).
  //  - Scholar-field comments that were clearly typed by an adult (third-
  //    person notes, multi-paragraph write-ups) are dropped.
  //  - Anything listed in partner/highlight-exclusions.json is never shown.
  //  - Scholar comments fill the list first; tutor comments only top it up.
  //  - Rotates weekly: the selected week, or the most recent week that has
  //    an eligible comment.
  // ══════════════════════════════════════════════════════════════════════
  const HIGHLIGHT_MAX = 8;

  const POSITIVE_SIGNALS = /\b(fun|funny|enjoy\w*|lik(e|ed|es)|lov(e|ed|es|ing)|good|great|best|awesome|amazing|cool|nice|happy|help(ed|ful|s|ing)?|learn\w*|understand\w*|understood|excit\w*|proud|thank\w*|favorite|favourite|excellent|wonderful|fantastic|progress\w*|improv\w*|confiden\w*|engag\w*|kind|patient|easy|easier|smart|success\w*|grow\w*|interesting|super|glad|awesome|well)\b/i;

  // Lukewarm, critical or classroom-management language — none of it belongs
  // in a public "highlight", even under a 4–5 rating.
  const NEGATIVE_SIGNALS = /\b(not|n't|no|never|nothing|struggl\w*|withdraw\w*|difficult|hard|harder|challeng\w*|concern\w*|problem\w*|issue\w*|refus\w*|distract\w*|bor(ed|ing)|hate\w*|dislike\w*|worst|bad|upset|frustrat\w*|absent|missed|late|left|leave|disrupt\w*|behavior\w*|behaviour\w*|complain\w*|needs?|should|must|work on|redirect\w*|focus\w*|off[- ]task|talk(ing|ative)|moving|reserved|shy|quiet|tired|sleep\w*|cry\w*|sad|angry|mad|mean|rude|fight\w*|yell\w*|annoy\w*|confus\w*|stress\w*|scar(ed|y)|push[- ]?in|but|however|although|though|only|yet|still|little|bit|somewhat|okay|ok|fine|meh)\b/i;

  // Sensitive topics that should never be quoted to a partner.
  const SENSITIVE_SIGNALS = /\b(iep|504|diagnos\w*|disab\w*|medic\w*|medicine|nurse|counsel\w*|therap\w*|police|hospital|sick|ill|hurt\w*|injur\w*|bleed\w*|die|died|dead|death|kill\w*|gun\w*|weapon\w*|knife|drug\w*|alcohol|sex\w*|abuse\w*|bully\w*|suicid\w*|self[- ]harm|parent\w*|mom|dad|mother|father|guardian|home|custody|foster|evict\w*|homeless\w*|pregnan\w*|arrest\w*|suspen\w*|detention|referral|screenshot|paperwork)\b/i;

  const PROFANITY = /(f+[\W_]*u+[\W_]*c+[\W_]*k+|sh[i1!]+t|b[i1!]+tch|\ba+ss+(hole)?\b|\bd[a@]mn|\bcrap\b|\bh[e3]ll\b|\bd[i1!]ck|\bp[i1!]ss|bastard|\bstupid\b|\bdumb\b|\bidiot|\bsucks?\b|\bsexy\b|\bwtf\b|\bstfu\b|\bomfg\b|\bslut|\bwhore|\bn[i1!]gg|\bretard|\bpenis|\bvagina|\bboob|\bbutt\b|\bpoop|\bfart)/i;

  const CONTACT_INFO = /(@|https?:|www\.|\.com\b|\b\d{3}[\s.-]?\d{3}[\s.-]?\d{4}\b)/i;

  // Adult-written notes typed into the scholar comment field.
  const ADULT_VOICE = /\b(she|he|her|him|his|hers|they|them|their|scholar|scholars|student|students|survey|session survey|this is \w+|i believe|i think we|we began|teacher'?s)\b/i;

  // Common words that also happen to be first names — never treated as a
  // name match (a false match only drops a comment, but these would drop
  // too many ordinary sentences).
  const NAME_STOPWORDS = new Set(('the and for you are was were was she her his him they them this that with have had has not but can will may june april august march summer autumn winter spring ' +
    'grace hope joy faith love star sky sunny rose lily daisy iris ivy dawn eve honey angel baby king prince princess queen major ' +
    'best good great fun funny nice cool happy smart kind sweet brave bright wise young long little white brown black green gray grey gold silver ' +
    'bell hall hill lee day way art mark bill will pat sue don ray guy rich chase lane max miles hunter reed wood stone ' +
    'math reading today class session sessions tutor tutoring teacher learn learned learning thank thanks work working help helped').split(/\s+/));

  function normWord(w) { return w.toLowerCase().replace(/[^a-z]/g, ''); }

  function rosterNameSet(attRows) {
    const names = new Set();
    (attRows || []).forEach(r => {
      String(r[ATT.USER] || '').split(/[\s,.\-']+/).forEach(part => {
        const w = normWord(part);
        if (w.length >= 3 && !NAME_STOPWORDS.has(w)) names.add(w);
      });
    });
    return names;
  }

  function mentionsRosterName(text, names) {
    // "Mr. Smith" / "Ms. Hind" style references to a teacher or tutor by
    // title are allowed; bare first/last names are not.
    const stripped = text.replace(/\b(mr|mrs|ms|miss|dr|mx)\.?\s+[A-Za-z][\w'-]*/gi, ' ');
    return stripped.split(/[^A-Za-z']+/).some(w => { const n = normWord(w); return n.length >= 3 && names.has(n); });
  }

  function normalizeForDedupe(text) { return text.toLowerCase().replace(/[^a-z0-9 ]+/g, '').replace(/(.)\1{2,}/g, '$1$1').replace(/\s+/g, ' ').trim(); }

  function isExcluded(text, exclusions) {
    if (!exclusions || !exclusions.length) return false;
    const n = normalizeForDedupe(text);
    return exclusions.some(ex => { const e = normalizeForDedupe(ex); return e && n.includes(e); });
  }

  function isHighlightWorthy(text, who, names, exclusions) {
    if (!text) return false;
    const t = text.trim();
    if (t.length < 12 || t.length > 240) return false;
    if (/\n\s*\n/.test(t)) return false; // multi-paragraph write-up
    if (t.split(/\s+/).length < 3) return false;
    if (!/[a-z]/i.test(t)) return false;
    if (!POSITIVE_SIGNALS.test(t)) return false;
    if (NEGATIVE_SIGNALS.test(t) || SENSITIVE_SIGNALS.test(t) || PROFANITY.test(t) || CONTACT_INFO.test(t)) return false;
    if (who === 'Scholar' && ADULT_VOICE.test(t)) return false;
    if (mentionsRosterName(t, names)) return false;
    if (isExcluded(t, exclusions)) return false;
    return true;
  }

  // Runs of emoji ("🩷🥰💞🩷🥰…") collapse to at most two.
  const EMOJI_RUN = /((?:\p{Extended_Pictographic}|\uFE0F|\u200D|\p{Emoji_Modifier})+)/gu;
  function tidyQuote(text) {
    let t = text.replace(EMOJI_RUN, run => Array.from(run.replace(/[\uFE0F\u200D]|\p{Emoji_Modifier}/gu, '')).slice(0, 2).join(''));
    t = t.trim().replace(/\s+/g, ' ').replace(/([!?.])\1{2,}/g, '$1$1').replace(/(\w)\1{3,}/g, '$1$1$1');
    if (t === t.toUpperCase()) t = t.charAt(0) + t.slice(1).toLowerCase(); // ALL CAPS → sentence case
    return t.charAt(0).toUpperCase() + t.slice(1);
  }

  /**
   * @param data  { scholarSurveys, tutorSurveys, attendance } — already
   *              scoped to district/school (NOT to a week; week is picked here).
   * @param opts  { week: 'ALL' | 'YYYY-MM-DD', exclusions: string[], max }
   * @returns     { weekKey, weekLabel, items: [{ text, who, date }] }
   */
  function curateHighlights(data, opts) {
    opts = opts || {};
    const max = opts.max || HIGHLIGHT_MAX;
    const names = rosterNameSet(data.attendance);
    const exclusions = opts.exclusions || [];

    const candidates = [];
    (data.scholarSurveys || []).forEach(r => {
      if (parseFloat(r[STU.OVERALL]) < 4 || isNaN(parseFloat(r[STU.OVERALL]))) return;
      const text = (r[STU.COMMENT] || '').trim();
      if (!isHighlightWorthy(text, 'Scholar', names, exclusions)) return;
      const wk = weekBucket(r[STU.DATE]);
      if (wk) candidates.push({ text: tidyQuote(text), who: 'Scholar', date: parseDate(r[STU.DATE]), week: wk });
    });
    (data.tutorSurveys || []).forEach(r => {
      if (parseFloat(r[INST.OVERALL]) < 4 || isNaN(parseFloat(r[INST.OVERALL]))) return;
      const text = (r[INST.COMMENT_SELF] || '').trim();
      if (!isHighlightWorthy(text, 'Tutor', names, exclusions)) return;
      const wk = weekBucket(r[INST.DATE]);
      if (wk) candidates.push({ text: tidyQuote(text), who: 'Tutor', date: parseDate(r[INST.DATE]), week: wk });
    });

    // The selected week (or, for "All Weeks", the latest week). If that week
    // has nothing eligible, step back to the most recent earlier week that
    // does — preferring a week with scholar comments — so the section is
    // never blank just because one week was quiet.
    const upTo = opts.week && opts.week !== 'ALL' ? opts.week : '9999-99-99';
    const latest = list => list.filter(k => k <= upTo).sort().pop() || null;
    const scholarWeeks = candidates.filter(c => c.who === 'Scholar').map(c => c.week.key);
    const anyWeeks = candidates.map(c => c.week.key);
    let weekKey = upTo !== '9999-99-99' && anyWeeks.includes(upTo) ? upTo : (latest(scholarWeeks) || latest(anyWeeks));
    if (!weekKey) return { weekKey: null, weekLabel: null, items: [] };

    const inWeek = candidates.filter(c => c.week.key === weekKey).sort((a, b) => (b.date || 0) - (a.date || 0));
    const seen = new Set();
    const pick = who => inWeek.filter(c => c.who === who).filter(c => {
      const k = normalizeForDedupe(c.text);
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
    const scholars = pick('Scholar');
    const tutors = pick('Tutor');
    const items = scholars.slice(0, max);
    if (items.length < max) items.push(...tutors.slice(0, max - items.length));
    return {
      weekKey,
      weekLabel: weekRangeLabel(weekKey),
      items: items.map(c => ({ text: c.text, who: c.who, date: c.date }))
    };
  }

  // Exclusion list — NJTC staff add any comment (or a distinctive phrase from
  // it) to partner/highlight-exclusions.json and it disappears from every
  // partner dashboard and PDF on next page load. No rebuild needed.
  const SCRIPT_URL = (document.currentScript && document.currentScript.src) || '';
  let exclusionsPromise = null;
  function loadExclusions() {
    if (!exclusionsPromise) {
      const url = SCRIPT_URL ? new URL('highlight-exclusions.json', SCRIPT_URL).href : '/New-Jersey-Tutoring-Corps-Portal/partner/highlight-exclusions.json';
      exclusionsPromise = fetch(url + '?v=' + Date.now())
        .then(r => r.ok ? r.json() : { exclude: [] })
        .then(j => (j.exclude || []).map(e => typeof e === 'string' ? e : (e && e.text) || '').filter(Boolean))
        .catch(() => []);
    }
    return exclusionsPromise;
  }

  // ── Survey summaries ──────────────────────────────────────────────────────
  function sentiment(rows, overallIdx) {
    let pos = 0, neu = 0, neg = 0;
    rows.forEach(r => {
      const v = parseFloat(r[overallIdx]);
      if (isNaN(v)) return;
      if (v >= 4) pos++; else if (v === 3) neu++; else if (v >= 1) neg++;
    });
    return { pos, neu, neg, scored: pos + neu + neg };
  }
  function questionSummary(rows, idx) {
    let sum = 0, n = 0, top = 0;
    rows.forEach(r => {
      const v = Math.round(parseFloat(r[idx]));
      if (!(v >= 1 && v <= 5)) return;
      sum += v; n++; if (v >= 4) top++;
    });
    return { avg: n ? Math.round(sum / n * 10) / 10 : null, topPct: pct(top, n), n };
  }

  // ══════════════════════════════════════════════════════════════════════
  //  REPORT MODEL — everything the PDF shows, computed from one bundle
  // ══════════════════════════════════════════════════════════════════════
  // Weeks with at least one recorded scholar attendance (attended or a real
  // miss) — a week of only "Not recorded" rows has nothing to report yet.
  function allWeeks(bundle) {
    const map = new Map();
    (bundle.attendance || []).forEach(r => {
      if (!isScholarRow(r)) return;
      const c = classifyAtt(r);
      if (c !== 'attended' && c !== 'absent') return;
      const wk = weekBucket(r[ATT.SESS_DATE]);
      if (wk) map.set(wk.key, wk.label);
    });
    return [...map.keys()].sort().map(k => ({ key: k, label: map.get(k) }));
  }

  function buildReportModel(bundle, scope, exclusions) {
    scope = { district: 'ALL', school: 'ALL', week: 'ALL', ...(scope || {}) };
    const place = { district: scope.district, school: scope.school, week: 'ALL' };
    const attPlace = scoped(bundle.attendance, ATT.DISTRICT, ATT.SCHOOL, ATT.SESS_DATE, place);
    const stuPlace = scoped(bundle.scholarSurveys, STU.DISTRICT, STU.SCHOOL, STU.DATE, place);
    const instPlace = scoped(bundle.tutorSurveys, INST.DISTRICT, INST.SCHOOL, INST.DATE, place);
    const sessPlace = scoped(bundle.sessions, SESS.DISTRICT, SESS.SCHOOL, SESS.START, place);

    const weekly = scope.week !== 'ALL';
    const inWeek = (rows, idx) => weekly ? scoped(rows, null, null, idx, { week: scope.week }) : rows;
    const att = inWeek(attPlace, ATT.SESS_DATE);
    const stu = inWeek(stuPlace, STU.DATE);
    const inst = inWeek(instPlace, INST.DATE);
    const sess = inWeek(sessPlace, SESS.START);

    const stats = scholarStats(att);
    const ytd = scholarStats(throughWeek(attPlace, ATT.SESS_DATE, scope.week));
    const trendAll = scholarWeekly(scholarStats(attPlace).rows);
    let trendEnd = trendAll.length - 1;
    if (weekly) { trendEnd = -1; trendAll.forEach((w, i) => { if (w.key <= scope.week) trendEnd = i; }); }
    const trend = trendAll.slice(Math.max(0, trendEnd - 9), trendEnd + 1);

    let sessionMinutes = null;
    if ((bundle.sessions || []).length) {
      const seen = new Set();
      sessionMinutes = 0;
      sess.forEach(r => {
        if ((r[SESS.STATUS] || '').trim() !== 'Completed') return;
        const sid = (r[SESS.SESS_ID] || '').trim();
        const mins = parseInt(r[SESS.DUR_MINS], 10) || 0;
        if (sid && mins > 0 && !seen.has(sid)) { seen.add(sid); sessionMinutes += mins; }
      });
    }

    const stuSent = sentiment(stu, STU.OVERALL);
    const instSent = sentiment(inst, INST.OVERALL);
    const highlights = curateHighlights({ scholarSurveys: stuPlace, tutorSurveys: instPlace, attendance: attPlace }, { week: scope.week, exclusions });

    return {
      identity: bundle.identity || {},
      season: bundle.season || SY_LABEL,
      generatedAt: bundle.generatedAt || null,
      scope,
      weekly,
      weekLabel: weekly ? weekRangeLabel(scope.week) : null,
      stats,
      ytd,
      trend,
      uniqueScholars: new Set(stats.rows.filter(r => classifyAtt(r) === 'attended').map(r => (r[ATT.USER_ID] || '').trim()).filter(Boolean)).size,
      sessions: new Set(att.map(r => r[ATT.SESSION]).filter(Boolean)).size,
      sessionMinutes,
      reasons: scholarMissedReasons(stats.rows).slice(0, 6),
      checkIns: scholarsToCheckIn(throughWeek(attPlace, ATT.SESS_DATE, scope.week).filter(isScholarRow)),
      scholarSurvey: {
        n: stu.length, sent: stuSent,
        questions: [
          ['Confidence understanding the material', questionSummary(stu, STU.CONFIDENCE)],
          ['Enjoyed the session', questionSummary(stu, STU.ENJOYMENT)],
          ['Felt they learned', questionSummary(stu, STU.LEARNING)],
          ['Overall, how the session went', questionSummary(stu, STU.OVERALL)]
        ]
      },
      tutorSurvey: {
        n: inst.length, sent: instSent,
        questions: [
          ['Scholar engagement', questionSummary(inst, INST.ENGAGEMENT)],
          ['Tutor enjoyed the session', questionSummary(inst, INST.ENJOYMENT)],
          ['Scholars learned', questionSummary(inst, INST.LEARNING)],
          ['Overall, how the session went', questionSummary(inst, INST.OVERALL)]
        ]
      },
      highlights
    };
  }

  function scopeLabel(id, scope) {
    if (scope && scope.school && scope.school !== 'ALL') return scope.school;
    if (scope && scope.district && scope.district !== 'ALL') return scope.district;
    if (!id) return '';
    if (id.level === 'Admin') return 'All Districts · All Schools';
    if (id.level === 'Regional') return `${id.region} Region`;
    if (id.schools && id.schools[0] === 'ALL') return id.district + ' · All Schools';
    return (id.schools || []).join(', ') || id.district || '';
  }

  // ══════════════════════════════════════════════════════════════════════
  //  PDF
  // ══════════════════════════════════════════════════════════════════════
  let libsPromise = null;
  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src;
      s.onload = resolve;
      s.onerror = () => reject(new Error('Could not load ' + src));
      document.head.appendChild(s);
    });
  }
  function loadLibs() {
    if (window.jspdf && window.jspdf.jsPDF && window.jspdf.jsPDF.API && window.jspdf.jsPDF.API.autoTable) return Promise.resolve();
    if (!libsPromise) {
      libsPromise = (window.jspdf && window.jspdf.jsPDF ? Promise.resolve() : loadScript('https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js'))
        .then(() => (window.jspdf.jsPDF.API.autoTable ? null : loadScript('https://cdn.jsdelivr.net/npm/jspdf-autotable@3.8.2/dist/jspdf.plugin.autotable.min.js')))
        .catch(e => { libsPromise = null; throw e; });
    }
    return libsPromise;
  }

  // jsPDF's built-in fonts are WinAnsi only — swap characters it can't draw.
  function pdfText(s) {
    return String(s == null ? '' : s)
      .replace(/[‘’‛]/g, "'").replace(/[“”‟]/g, '"')
      .replace(/[–—]/g, '-').replace(/…/g, '...').replace(/\s*·\s*/g, ' - ')
      .replace(/[^\x09\x0A\x0D\x20-\x7E -ÿ]/g, '');
  }

  const C = {
    navy: [10, 22, 40], blue: [0, 48, 135], blueMid: [0, 80, 200], gold: [240, 165, 0],
    pos: [13, 110, 58], neu: [125, 143, 161], neg: [185, 28, 28],
    text: [13, 27, 42], text2: [61, 81, 102], muted: [125, 143, 161],
    line: [221, 227, 236], soft: [246, 248, 252], track: [238, 241, 247], white: [255, 255, 255]
  };

  async function generatePDF(bundle, scope, opts) {
    opts = opts || {};
    await loadLibs();
    const exclusions = opts.exclusions || await loadExclusions();
    const m = buildReportModel(bundle, scope, exclusions);
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: 'pt', format: 'letter' });
    const W = doc.internal.pageSize.getWidth(), H = doc.internal.pageSize.getHeight();
    const M = 40, CW = W - M * 2;
    let y = 0;

    const setFill = c => doc.setFillColor(c[0], c[1], c[2]);
    const setText = c => doc.setTextColor(c[0], c[1], c[2]);
    const setDraw = c => doc.setDrawColor(c[0], c[1], c[2]);
    const font = (style, size) => { doc.setFont('helvetica', style); doc.setFontSize(size); };
    const ensure = need => { if (y + need > H - 50) { doc.addPage(); y = M; } };
    const section = title => {
      ensure(40);
      font('bold', 10); setText(C.blue);
      doc.text(pdfText(title.toUpperCase()), M, y);
      setDraw(C.gold); doc.setLineWidth(1.5); doc.line(M, y + 5, M + 36, y + 5);
      y += 20;
    };

    // ── Header band ──
    const place = scopeLabel(m.identity, m.scope);
    setFill(C.navy); doc.rect(0, 0, W, 92, 'F');
    setFill(C.gold); doc.rect(0, 92, W, 3, 'F');
    setFill(C.blueMid); doc.roundedRect(M, 24, 44, 44, 8, 8, 'F');
    font('bold', 12); setText(C.white); doc.text('NJTC', M + 22, 50, { align: 'center' });
    font('bold', 17); doc.text(m.weekly ? 'Weekly Operations Report' : 'Year-to-Date Operations Report', M + 58, 42);
    font('normal', 10); doc.setTextColor(200, 210, 225);
    doc.text(pdfText(place || 'New Jersey Tutoring Corps'), M + 58, 58, { maxWidth: CW - 200 });
    doc.text(pdfText(m.weekly ? 'Week of ' + m.weekLabel : 'SY ' + m.season + ' to date'), M + 58, 72);
    font('normal', 8.5); doc.setTextColor(170, 185, 205);
    doc.text(pdfText('Prepared for ' + (m.identity.name || 'Partner')), W - M, 42, { align: 'right' });
    doc.text(pdfText('SY ' + m.season), W - M, 55, { align: 'right' });
    doc.text(pdfText('Generated ' + new Date().toLocaleDateString('en-US', { dateStyle: 'medium' })), W - M, 68, { align: 'right' });
    y = 122;

    if (!m.stats.rows.length && !m.scholarSurvey.n && !m.tutorSurvey.n) {
      font('normal', 11); setText(C.text2);
      doc.text(pdfText('No Pearl sessions or surveys were recorded for this ' + (m.weekly ? 'week' : 'period') + ' yet.'), M, y);
      return finish();
    }

    // ── KPI tiles ──
    const kpis = [
      [m.stats.rate == null ? '-' : m.stats.rate + '%', 'Attendance rate', m.weekly && m.ytd.rate != null ? 'Year to date: ' + m.ytd.rate + '%' : 'Late counts as attended'],
      [m.uniqueScholars.toLocaleString(), 'Scholars served', 'Attended 1+ session'],
      [m.sessions.toLocaleString(), 'Sessions delivered', m.sessionMinutes != null ? (m.sessionMinutes / 60).toFixed(1) + ' tutoring hours' : ''],
      [m.scholarSurvey.sent.scored ? pct(m.scholarSurvey.sent.pos, m.scholarSurvey.sent.scored) + '%' : '-', 'Loved their session', m.scholarSurvey.sent.scored.toLocaleString() + ' scholar surveys'],
      [m.checkIns.length.toLocaleString(), 'Check-ins suggested', 'Year to date']
    ];
    const gap = 8, tw = (CW - gap * (kpis.length - 1)) / kpis.length, th = 64;
    kpis.forEach(([val, label, sub], i) => {
      const x = M + i * (tw + gap);
      setFill(C.soft); setDraw(C.line); doc.setLineWidth(.6); doc.roundedRect(x, y, tw, th, 6, 6, 'FD');
      font('bold', 18); setText(C.blue); doc.text(pdfText(val), x + 10, y + 26);
      font('bold', 8); setText(C.text); doc.text(doc.splitTextToSize(pdfText(label), tw - 16)[0], x + 10, y + 42);
      font('normal', 7); setText(C.muted); doc.text(doc.splitTextToSize(pdfText(sub), tw - 16)[0] || '', x + 10, y + 54);
    });
    y += th + 26;

    // ── Attendance ──
    section('Scholar attendance');
    const barRow = (label, n, total, color, xx, ww) => {
      const p = total ? n / total : 0;
      font('bold', 8.5); setText(C.text2); doc.text(pdfText(label), xx, y + 9);
      const bx = xx + 62, bw = ww - 62 - 70;
      setFill(C.track); doc.roundedRect(bx, y, bw, 12, 3, 3, 'F');
      if (p > 0) { setFill(color); doc.roundedRect(bx, y, Math.max(6, bw * p), 12, 3, 3, 'F'); }
      font('normal', 8.5); setText(C.text); doc.text(pdfText(n.toLocaleString() + (total ? '  (' + pct(n, total) + '%)' : '')), xx + ww, y + 9, { align: 'right' });
      y += 19;
    };
    const colW = CW * 0.46;
    const yAttStart = y;
    barRow('Attended', m.stats.attended, m.stats.total, C.pos, M, colW);
    barRow('Missed', m.stats.absent, m.stats.total, C.neg, M, colW);
    font('normal', 7.5); setText(C.muted);
    doc.text(pdfText(m.stats.excused.toLocaleString() + ' excused sessions (school events, testing days, holidays) are not counted against the rate.'), M, y + 6, { maxWidth: colW });
    const yAfterBars = y + 30;

    // Trend mini-chart (last up to 10 weeks)
    const cx = M + colW + 24, cw = CW - colW - 24, ch = 86;
    y = yAttStart;
    font('bold', 8); setText(C.text2); doc.text('Weekly attendance rate', cx, y + 2);
    const chartTop = y + 14;
    setDraw(C.line); doc.setLineWidth(.5);
    [0, 50, 100].forEach(v => { const yy = chartTop + ch - ch * v / 100; doc.line(cx + 22, yy, cx + cw, yy); font('normal', 6.5); setText(C.muted); doc.text(v + '%', cx + 18, yy + 2, { align: 'right' }); });
    if (m.trend.length) {
      const slot = (cw - 26) / m.trend.length, bw = Math.min(26, slot * 0.62);
      m.trend.forEach((w, i) => {
        const bx = cx + 26 + i * slot + (slot - bw) / 2;
        const hh = ch * (w.rate || 0) / 100;
        const isSel = m.weekly && w.key === m.scope.week;
        setFill(isSel ? C.gold : C.blueMid); doc.rect(bx, chartTop + ch - hh, bw, hh, 'F');
        font('bold', 6.5); setText(C.text); doc.text(w.rate == null ? '-' : Math.round(w.rate) + '%', bx + bw / 2, chartTop + ch - hh - 3, { align: 'center' });
        font('normal', 6.5); setText(C.muted); doc.text(pdfText(w.label), bx + bw / 2, chartTop + ch + 10, { align: 'center' });
      });
    }
    y = Math.max(yAfterBars, chartTop + ch + 24);

    // Missed reasons
    if (m.reasons.length) {
      const rTotal = m.reasons.reduce((s, [, n]) => s + n, 0);
      ensure(30 + m.reasons.length * 18);
      font('bold', 9); setText(C.text); doc.text('Why scholars missed a session', M, y); y += 8;
      doc.autoTable({
        startY: y, margin: { left: M, right: M },
        head: [['Reason', 'Sessions', 'Share']],
        body: m.reasons.map(([r, n]) => [pdfText(r), n.toLocaleString(), pct(n, rTotal) + '%']),
        styles: { font: 'helvetica', fontSize: 8, cellPadding: 4, textColor: C.text, lineColor: C.line, lineWidth: .4 },
        headStyles: { fillColor: C.blue, textColor: C.white, fontStyle: 'bold' },
        alternateRowStyles: { fillColor: C.soft },
        columnStyles: { 1: { halign: 'right', cellWidth: 70 }, 2: { halign: 'right', cellWidth: 60 } }
      });
      y = doc.lastAutoTable.finalY + 22;
    }

    // Check-ins
    section('Scholars to check in with');
    font('normal', 8); setText(C.text2);
    doc.text(pdfText('Scholars with a real pattern of missed sessions (never attended, or under 80% across 3+ sessions), year to date' + (m.weekly ? ' through this week' : '') + '. Only scholar-side reasons count. A quick check-in with the scholar, a teacher, or family often turns this around.'), M, y, { maxWidth: CW });
    y += 26;
    if (m.checkIns.length) {
      const shown = m.checkIns.slice(0, 15);
      doc.autoTable({
        startY: y, margin: { left: M, right: M },
        head: [['Pearl ID', 'Scholar', 'Attended', 'Missed', 'Last attended']],
        body: shown.map(s => [s.uid, pdfText(s.name), (s.rate == null ? 0 : s.rate) + '%', String(s.absences), pdfText(s.lastAttended || 'Never')]),
        styles: { font: 'helvetica', fontSize: 8, cellPadding: 4, textColor: C.text, lineColor: C.line, lineWidth: .4 },
        headStyles: { fillColor: C.blue, textColor: C.white, fontStyle: 'bold' },
        alternateRowStyles: { fillColor: C.soft },
        columnStyles: { 0: { font: 'courier', cellWidth: 70 }, 2: { halign: 'right', cellWidth: 60 }, 3: { halign: 'right', cellWidth: 50 }, 4: { cellWidth: 90 } }
      });
      y = doc.lastAutoTable.finalY + 8;
      if (m.checkIns.length > shown.length) {
        font('italic', 7.5); setText(C.muted);
        doc.text(pdfText(`+ ${m.checkIns.length - shown.length} more - see Attendance Tracking in the Partner Dashboard for the full list and each scholar's missed dates.`), M, y + 6);
        y += 12;
      }
      y += 16;
    } else {
      font('normal', 8.5); setText(C.pos); doc.text('No scholars are currently flagged for a check-in.', M, y); y += 22;
    }

    // ── Surveys ──
    const surveyBlock = (title, s) => {
      section(title);
      if (!s.n) { font('normal', 8.5); setText(C.muted); doc.text('No surveys recorded for this period.', M, y); y += 22; return; }
      const sc = s.sent.scored;
      barRow('Positive', s.sent.pos, sc, C.pos, M, colW);
      barRow('Neutral', s.sent.neu, sc, C.neu, M, colW);
      barRow('Negative', s.sent.neg, sc, C.neg, M, colW);
      font('normal', 7.5); setText(C.muted);
      doc.text(pdfText(`Positive = rated 4-5, Neutral = 3, Negative = 1-2 on "Overall, how did this session go?" (${sc.toLocaleString()} responses).`), M, y + 4, { maxWidth: CW });
      y += 14;
      doc.autoTable({
        startY: y, margin: { left: M, right: M },
        head: [['Question', 'Average (1-5)', 'Rated 4-5', 'Responses']],
        body: s.questions.map(([q, v]) => [pdfText(q), v.avg == null ? '-' : v.avg.toFixed(1), v.topPct == null ? '-' : v.topPct + '%', v.n.toLocaleString()]),
        styles: { font: 'helvetica', fontSize: 8, cellPadding: 4, textColor: C.text, lineColor: C.line, lineWidth: .4 },
        headStyles: { fillColor: C.blue, textColor: C.white, fontStyle: 'bold' },
        alternateRowStyles: { fillColor: C.soft },
        columnStyles: { 1: { halign: 'right', cellWidth: 80 }, 2: { halign: 'right', cellWidth: 70 }, 3: { halign: 'right', cellWidth: 70 } }
      });
      y = doc.lastAutoTable.finalY + 24;
    };
    ensure(170); surveyBlock('Scholar survey', m.scholarSurvey);
    ensure(170); surveyBlock('Tutor survey', m.tutorSurvey);

    // ── Highlights ──
    section('Session highlights' + (m.highlights.weekLabel ? ' - week of ' + m.highlights.weekLabel : ''));
    if (!m.highlights.items.length) {
      font('normal', 8.5); setText(C.muted); doc.text('No highlighted comments yet for this period.', M, y); y += 20;
    } else {
      m.highlights.items.forEach(h => {
        font('italic', 9);
        const lines = doc.splitTextToSize(pdfText('"' + h.text + '"'), CW - 24);
        const bh = lines.length * 11 + 22;
        ensure(bh + 6);
        setFill(C.soft); doc.rect(M, y, CW, bh, 'F');
        setFill(C.gold); doc.rect(M, y, 2.5, bh, 'F');
        setText(C.text2); doc.text(lines, M + 12, y + 14);
        font('bold', 7); setText(C.muted); doc.text('- ' + h.who, M + 12, y + bh - 7);
        y += bh + 6;
      });
      font('normal', 7); setText(C.muted);
      doc.text('Scholar comments are shown first; tutor comments fill in when there are fewer scholar comments that week. Highlights are a curated selection, not a representative sample.', M, y + 6, { maxWidth: CW });
      y += 22;
    }

    return finish();

    function finish() {
      const pages = doc.internal.getNumberOfPages();
      const asOf = m.generatedAt ? 'Data as of ' + new Date(m.generatedAt).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' }) : '';
      for (let p = 1; p <= pages; p++) {
        doc.setPage(p);
        setDraw(C.line); doc.setLineWidth(.5); doc.line(M, H - 32, W - M, H - 32);
        font('normal', 7); setText(C.muted);
        doc.text(pdfText('New Jersey Tutoring Corps | Partner Operations Report' + (asOf ? ' | ' + asOf : '')), M, H - 20);
        doc.text(`Page ${p} of ${pages}`, W - M, H - 20, { align: 'right' });
      }
      const slug = s => String(s || '').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50);
      const name = `NJTC-${m.weekly ? 'Weekly' : 'YTD'}-Report-${slug(place) || 'Partner'}${m.weekly ? '-' + m.scope.week : ''}.pdf`;
      if (opts.returnDoc) return { doc, name, model: m };
      doc.save(name);
      return { name, model: m };
    }
  }

  // ══════════════════════════════════════════════════════════════════════
  //  CENTRAL: build a partner's bundle client-side, exactly as the nightly
  //  build does (same sheet, same scope rules, same SY cutoff).
  // ══════════════════════════════════════════════════════════════════════
  function parseCSV(text) {
    const rows = [];
    const s = text.replace(/\r\n?/g, '\n');
    let row = [], cur = '', inQ = false;
    for (let i = 0; i < s.length; i++) {
      const ch = s[i];
      if (inQ) {
        if (ch === '"') { if (s[i + 1] === '"') { cur += '"'; i++; } else inQ = false; }
        else cur += ch;
      } else if (ch === '"') inQ = true;
      else if (ch === ',') { row.push(cur); cur = ''; }
      else if (ch === '\n') { row.push(cur); cur = ''; if (row.some(c => c.trim() !== '')) rows.push(row); row = []; }
      else cur += ch;
    }
    if (cur !== '' || row.length) { row.push(cur); if (row.some(c => c.trim() !== '')) rows.push(row); }
    return rows;
  }

  let pearlPromise = null;
  function loadPearl(force) {
    if (!pearlPromise || force) {
      const url = gid => `https://docs.google.com/spreadsheets/d/e/${PEARL_2PACX}/pub?output=csv&gid=${gid}`;
      const get = (gid, soft) => fetch(url(gid)).then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.text(); })
        .then(t => { if (t.trim().startsWith('<')) throw new Error('Pearl sheet not public'); return parseCSV(t).slice(1); })
        .catch(e => { if (soft) return []; throw e; });
      pearlPromise = Promise.all([get(PEARL_GIDS.att), get(PEARL_GIDS.inst), get(PEARL_GIDS.stu), get(PEARL_GIDS.sess, true)])
        .then(([att, inst, stu, sess]) => ({ att, inst, stu, sess, fetchedAt: new Date().toISOString() }))
        .catch(e => { pearlPromise = null; throw e; });
    }
    return pearlPromise;
  }

  function scopeMatches(entry, district, school) {
    if (entry.scopeType === 'all') return true;
    if (entry.scopeType === 'region') return (REGION_DISTRICTS[entry.region] || []).includes(district);
    if (entry.scopeType === 'district') return district === entry.district;
    if (entry.scopeType === 'school') return district === entry.district && (entry.schools || []).includes(school);
    return false;
  }
  const syCutoff = parseDate(SY_START);
  function inCurrentSY(dateStr) {
    if (!syCutoff) return true;
    const d = parseDate(dateStr);
    return d ? d >= syCutoff : true;
  }
  function parseDurationMins(s) {
    if (!s) return 0;
    s = String(s).toLowerCase();
    let mins = 0;
    const h = s.match(/(\d+)\s*hour/); if (h) mins += parseInt(h[1], 10) * 60;
    const mn = s.match(/(\d+)\s*min/); if (mn) mins += parseInt(mn[1], 10);
    return mins;
  }

  function bundleForEntry(pearl, entry) {
    const f = (rows, dIdx, sIdx, dateIdx) => rows.filter(r => scopeMatches(entry, (r[dIdx] || '').trim(), (r[sIdx] || '').trim()) && inCurrentSY(r[dateIdx]));
    return {
      generatedAt: pearl.fetchedAt,
      season: SY_LABEL,
      identity: { name: entry.name, title: entry.title, level: entry.level, district: entry.district, schools: entry.schools, region: entry.region },
      attendance: f(pearl.att, ATT.DISTRICT, ATT.SCHOOL, ATT.SESS_DATE),
      tutorSurveys: f(pearl.inst, INST.DISTRICT, INST.SCHOOL, INST.DATE),
      scholarSurveys: f(pearl.stu, STU.DISTRICT, STU.SCHOOL, STU.DATE),
      sessions: f(pearl.sess, SESS.DISTRICT, SESS.SCHOOL, SESS.START).map(r => { const row = r.slice(); row[SESS.DUR_MINS] = String(parseDurationMins(r[SESS.ACTUAL_DUR] || r[SESS.SCHED_DUR])); return row; })
    };
  }

  window.NJTCPartnerReport = {
    ATT, INST, STU, SESS, SCHOLAR_MISS_REASONS, TUTOR_MISS_REASONS,
    parseDate, weekBucket, weekRangeLabel, pct, scoped,
    isScholarRow, classifyAtt, scholarStats, scholarWeekly, scholarMissedReasons, scholarsToCheckIn,
    curateHighlights, loadExclusions, allWeeks, buildReportModel, scopeLabel,
    generatePDF, loadPearl, bundleForEntry, scopeMatches
  };
})();
