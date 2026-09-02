/* ============================================================================
   NJTC PEARL DATA MODULE
   Fetches and filters Pearl data for a specific Pearl User ID
   ============================================================================ */

(function () {
  'use strict';

  // Pearl workbook identifiers — see data-sources.js (loaded before this file)
  // for the single source of truth; update rollover values there, not here.
  const SRC = (typeof NJTC_SOURCES !== 'undefined') ? NJTC_SOURCES : {};
  const PEARL_2PACX = SRC.PEARL_2PACX;
  const PEARL_GIDS  = SRC.PEARL_GIDS || {};

  const CACHE_TTL = 5 * 60 * 1000;
  const CACHE_KEYS = {
    att:  'njtc_od_att_v8',
    inst: 'njtc_od_inst_v8',
    stu:  'njtc_od_stu_v8',
    sess: 'njtc_od_sess_v8'
  };

  // ATT column indexes
  const ATT = {
    USER: 0, ROLE: 1, SESSION: 2, SESS_STATUS: 3, PLAN_START: 4,
    SESS_DATE: 5, ATT_STATUS: 6, MISS_REASON: 7, GRADE: 8,
    SEX: 9, RACE: 10, SCHOOL: 11, DISTRICT: 12, USER_ID: 13,
    IND_ATT_RATE: 14, SCHOLAR_ATT_PCT: 15, AVG_ATT: 16,
    STU_AVG_ATT: 17, INST_AVG: 18, STU_ATT_CNT: 19, STU_MISS_CNT: 20,
    INST_ATT_CNT: 21, INST_MISS_CNT: 22, MISS_TAG: 23, CONSEC_STATUS: 24, WEEK: 26
  };

  // Instructor Survey column indexes
  const INST = {
    FILLED_BY: 0, FILLED_FOR: 1, ENGAGEMENT: 2, ENJOYMENT: 3,
    LEARNING: 4, OVERALL: 5, COMMENT_ADMIN: 6, COMMENT_SELF: 7,
    DATE: 8, SCHOOL: 9, DISTRICT: 10, SESS_ID: 11,
    FILLED_BY_ID: 12, FILLED_FOR_ID: 13
  };

  // Student Survey column indexes
  const STU = {
    FILLED_BY: 0, FILLED_FOR: 1, CONFIDENCE: 2, ENJOYMENT: 3,
    LEARNING: 4, OVERALL: 5, COMMENT: 6, DATE: 7, SCHOOL: 8,
    DISTRICT: 9, REGION: 10, SESS_ID: 11, FILLED_BY_ID: 12, FILLED_FOR_ID: 13
  };

  const SCHOLAR_MISS_REASONS = new Set([
    'Absent',
    'Scholar declined attending tutoring session',
    'Classroom Teacher Requested to Keep Scholar in Class',
    'HADDON TWP ONLY -- Teacher requested whole group support',
    'Scholar Left Early'
  ]);

  const TUTOR_MISS_REASONS = new Set([
    'Absent; Not Covered (Tutor not available)',
    'Absent; Covered by Sub Tutor',
    'Absent; Covered by Dual Role',
    'Absent; Covered by the Site Leader',
    'Absent; Covered by the Instructional Coach',
    'Tutor Left Early (no sub)'
  ]);

  const SI_SEVERITY = {
    'NJTC Internal Issue/Error':                  'critical',
    'Tutor Vacancy':                              'high',
    'Scholar Archived - Removed from Sessions':   'high',
    'Unscheduled School Closure/Delay/Dismissal': 'high',
    'NJTC Diagnostic Testing':                    'medium',
    'School-administered Testing':                'medium',
    'School Event':                               'medium',
    'Scheduled/Unscheduled School Drill':         'medium',
    'HADDON TWP ONLY -- Program Redevelopment':   'medium',
    'Half Day':                                   'low',
    'Holiday - scheduled':                        'low',
  };

  function parseCSV(text) {
    const rows = [];
    const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    let row = [];
    let cur = '';
    let inQ = false;

    for (let i = 0; i < normalized.length; i++) {
      const ch = normalized[i];
      if (inQ) {
        if (ch === '"') {
          if (normalized[i + 1] === '"') {
            cur += '"';
            i++;
          } else {
            inQ = false;
          }
        } else {
          cur += ch;
        }
      } else {
        if (ch === '"') {
          inQ = true;
        } else if (ch === ',') {
          row.push(cur);
          cur = '';
        } else if (ch === '\n') {
          row.push(cur);
          cur = '';
          if (row.some(c => c.trim() !== '')) {
            rows.push(row);
          }
          row = [];
        } else {
          cur += ch;
        }
      }
    }
    if (cur !== '' || row.length > 0) {
      row.push(cur);
      if (row.some(c => c.trim() !== '')) rows.push(row);
    }

    return rows;
  }

  function getCached(key) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || !parsed.ts || !parsed.data) return null;
      if (Date.now() - parsed.ts > CACHE_TTL) return null;
      return parsed.data;
    } catch (e) {
      return null;
    }
  }

  function setCache(key, data) {
    try {
      localStorage.setItem(key, JSON.stringify({ ts: Date.now(), data }));
    } catch (e) {}
  }

  async function fetchSheet(gidName) {
    const cacheKey = CACHE_KEYS[gidName];
    if (cacheKey) {
      const cached = getCached(cacheKey);
      if (cached) return cached;
    }

    const gid = PEARL_GIDS[gidName];

    // Primary URL: Published-to-web 2PACX key. Retry up to 3 times with
    // backoff — Google's publish CDN occasionally returns a transient 404
    // that resolves on a subsequent request.
    const pubUrl = `https://docs.google.com/spreadsheets/d/e/${PEARL_2PACX}/pub?output=csv&gid=${gid}`;

    async function tryUrl(url) {
      // Use AbortController + setTimeout — AbortSignal.timeout() has Safari/iOS bugs
      // where concurrent fetches share abort state and cancel each other.
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 30000);
      let res;
      try {
        res = await fetch(url, { signal: ctrl.signal });
      } finally {
        clearTimeout(timer);
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const ct = res.headers.get('content-type') || '';
      if (ct.includes('text/html')) throw new Error('HTML response — sheet not public');
      const text = await res.text();
      if (text.trim().startsWith('<')) throw new Error('HTML body — sheet not public');
      const rows = parseCSV(text);
      if (rows.length < 2) throw new Error('Empty or header-only response');
      return rows;
    }

    let lastErr;
    // 3 attempts with 1s / 2s backoff — handles transient CDN 404s without
    // blocking the dashboard for more than ~11s in the absolute worst case.
    const delays = [1000, 2000];
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const rows = await tryUrl(pubUrl);
        if (cacheKey) setCache(cacheKey, rows);
        return rows;
      } catch (e) {
        lastErr = e;
        if (attempt < 2) await new Promise(r => setTimeout(r, delays[attempt]));
      }
    }

    throw lastErr || new Error(`Pearl data unavailable after retries`);
  }

  function safeNum(val) {
    const n = parseFloat(val);
    return isNaN(n) ? null : n;
  }

  function avg(arr) {
    if (!arr.length) return null;
    return arr.reduce((s, v) => s + v, 0) / arr.length;
  }

  function classifyRow(row, isInstructor) {
    const status = (row[ATT.ATT_STATUS] || '').trim();
    const reason = (row[ATT.MISS_REASON] || '').trim();

    if (status === 'Attended' || status === 'Late') return 'attended';
    if (status === 'Not recorded') return 'not_recorded';
    if (status === 'Missed') {
      if (isInstructor) {
        return TUTOR_MISS_REASONS.has(reason) ? 'absent' : 'service_interruption';
      } else {
        if (SCHOLAR_MISS_REASONS.has(reason) || reason === '') return 'absent';
        return 'service_interruption';
      }
    }
    return 'other';
  }

  async function fetchUserData(pearlUserId) {
    // All four GIDs confirmed published: att, inst, stu, sess.
    // Run in parallel — each has 3-attempt retry with 30s timeout per attempt.
    const [attRes, instRes, stuRes, sessRes] = await Promise.allSettled([
      fetchSheet('att'),
      fetchSheet('inst'),
      fetchSheet('stu'),
      fetchSheet('sess')
    ]);

    if (attRes.status === 'rejected') throw attRes.reason;

    const attRows  = attRes.value;
    const instRows = instRes.status === 'fulfilled' ? instRes.value : [];
    const stuRows  = stuRes.status  === 'fulfilled' ? stuRes.value  : [];
    const sessRows = sessRes.status === 'fulfilled' ? sessRes.value : [];

    // Filter my instructor attendance rows
    const myInstRows = attRows.filter(r =>
      (r[ATT.ROLE] || '').trim() === 'Instructor' &&
      (r[ATT.USER_ID] || '').trim() === pearlUserId
    );

    if (!myInstRows.length) {
      return {
        myAttended: 0, myAbsent: 0, mySI: 0, myTotal: 0,
        myAttRate: null, myMissedReasons: {}, scholars: [],
        scholarMissedReasons: {}, serviceInterruptions: 0,
        siReasons: {}, surveyCount: 0, surveyRate: null,
        stuAvgScores: { confidence: null, enjoyment: null, learning: null, overall: null, count: 0 },
        schoolsCovered: [], weeklyAtt: {},
        tutorSchool: null, tutorDistrict: null,
        scholarAttRate: null, siByLevel: { critical: {}, high: {}, medium: {}, low: {} },
        weeklyTrend: [], consecConcernIds: [], stuSurveyAvg: null,
        hasData: false
      };
    }

    // All sessions the tutor has a record for (used for weekly tracking)
    const mySessions = new Set(myInstRows.map(r => (r[ATT.SESSION] || '').trim()).filter(Boolean));

    // Detect tutor's subject using SESS tab (structured session details) as primary source.
    // The SESS tab has a header row; we scan it for subject/program/cert columns and match
    // session names from the tutor's ATT rows.  Falls back to keyword-scanning ATT session
    // name strings if SESS provides no signal.
    let elaCount = 0, mathCount = 0;
    (function detectSubject() {
      // Build a session-name → subject map from the SESS tab
      const sessSubjectMap = {};
      if (sessRows && sessRows.length > 1) {
        const hdr = sessRows[0].map(function(h) { return (h || '').toLowerCase().trim(); });
        // Look for a column that holds the subject/program label
        const subjectColIdx = (function() {
          const keywords = ['subject', 'program type', 'cert type', 'cert', 'program'];
          for (let ki = 0; ki < keywords.length; ki++) {
            const idx = hdr.findIndex(function(h) { return h.includes(keywords[ki]); });
            if (idx >= 0) return idx;
          }
          return -1;
        })();
        // Look for the session name column
        const nameColIdx = (function() {
          const candidates = ['session name', 'name', 'session'];
          for (let ki = 0; ki < candidates.length; ki++) {
            const idx = hdr.findIndex(function(h) { return h === candidates[ki]; });
            if (idx >= 0) return idx;
          }
          return hdr.findIndex(function(h) { return h.includes('session') || h.includes('name'); });
        })();

        for (let ri = 1; ri < sessRows.length; ri++) {
          const row = sessRows[ri];
          const sessName = nameColIdx >= 0 ? (row[nameColIdx] || '').trim() : '';
          if (!sessName) continue;
          let subj = null;
          if (subjectColIdx >= 0) {
            const val = (row[subjectColIdx] || '').trim();
            if (/\bela\b|reading|literacy|\benglish/i.test(val)) subj = 'ELA';
            else if (/\bmath\b|mathemat/i.test(val)) subj = 'Math';
          }
          // Also scan the session name itself for subject keywords
          if (!subj) {
            if (/\bela\b|reading|literacy|\benglish/i.test(sessName)) subj = 'ELA';
            else if (/\bmath\b|mathemat/i.test(sessName)) subj = 'Math';
          }
          if (subj) sessSubjectMap[sessName] = subj;
        }
      }

      // Tally subjects for each session this tutor is assigned to
      mySessions.forEach(function(sessName) {
        if (sessSubjectMap[sessName]) {
          if (sessSubjectMap[sessName] === 'ELA') elaCount++;
          else mathCount++;
          return;
        }
        // Fallback: keyword-scan the raw ATT session name string
        if (/\bela\b|reading|literacy|\benglish/i.test(sessName)) elaCount++;
        else if (/\bmath\b|mathemat/i.test(sessName)) mathCount++;
      });
    })();

    const tutorSubject = elaCount > 0 && mathCount === 0 ? 'ELA'
                       : mathCount > 0 && elaCount === 0 ? 'Math'
                       : null;

    // Sessions where the tutor actually attended — scholar count uses this
    // so we only count scholars the tutor was physically present with
    const myAttendedSessions = new Set();

    // My attendance stats
    let myAttended = 0, myAbsent = 0, mySI = 0;
    const myMissedReasons = {};
    const siReasons = {};
    const weeklyAtt = {};

    for (const r of myInstRows) {
      const cls = classifyRow(r, true);
      const week = (r[ATT.WEEK] || '').trim() || 'Unknown';
      if (!weeklyAtt[week]) weeklyAtt[week] = { attended: 0, absent: 0, si: 0 };

      if (cls === 'attended') {
        myAttended++;
        weeklyAtt[week].attended++;
        const sessId = (r[ATT.SESSION] || '').trim();
        if (sessId) myAttendedSessions.add(sessId);
      } else if (cls === 'absent') {
        myAbsent++;
        weeklyAtt[week].absent++;
        const reason = (r[ATT.MISS_REASON] || '').trim();
        myMissedReasons[reason] = (myMissedReasons[reason] || 0) + 1;
      } else if (cls === 'service_interruption') {
        mySI++;
        weeklyAtt[week].si++;
        const reason = (r[ATT.MISS_REASON] || '').trim();
        siReasons[reason] = (siReasons[reason] || 0) + 1;
      }
    }

    const myTotal = myAttended + myAbsent;
    const myAttRate = myTotal > 0 ? Math.round((myAttended / myTotal) * 100) : null;

    const siByLevel = { critical: {}, high: {}, medium: {}, low: {} };
    for (const [reason, count] of Object.entries(siReasons)) {
      const level = SI_SEVERITY[reason] || 'medium';
      siByLevel[level][reason] = (siByLevel[level][reason] || 0) + count;
    }

    // Determine the tutor's own school — most frequent school across their attended rows.
    // Used to fence scholar visibility: a tutor only sees students at their site (privacy).
    const schoolFreq = {};
    for (const r of myInstRows) {
      if (classifyRow(r, true) !== 'attended') continue;
      const sc = (r[ATT.SCHOOL] || '').trim();
      if (sc) schoolFreq[sc] = (schoolFreq[sc] || 0) + 1;
    }
    const tutorSchool = Object.entries(schoolFreq).sort((a, b) => b[1] - a[1])[0]?.[0] || null;

    const distFreq = {};
    for (const r of myInstRows) {
      if (classifyRow(r, true) !== 'attended') continue;
      const d = (r[ATT.DISTRICT] || '').trim();
      if (d) distFreq[d] = (distFreq[d] || 0) + 1;
    }
    const tutorDistrict = Object.entries(distFreq).sort((a,b) => b[1]-a[1])[0]?.[0] || null;

    // Scholar rows — only sessions the tutor attended AND only students at the tutor's school.
    // Filtering by school prevents cross-site data leakage when multiple tutors share a session
    // block that spans several school sites in the same Pearl session ID.
    const scholarRows = attRows.filter(r => {
      if ((r[ATT.ROLE] || '').trim() !== 'Student') return false;
      if (!myAttendedSessions.has((r[ATT.SESSION] || '').trim())) return false;
      if (tutorSchool) {
        const sc = (r[ATT.SCHOOL] || '').trim();
        if (sc && sc !== tutorSchool) return false;
      }
      return true;
    });

    // Build scholar map
    const scholarMap = {};
    for (const r of scholarRows) {
      const id = (r[ATT.USER_ID] || '').trim();
      if (!id) continue;

      if (!scholarMap[id]) {
        scholarMap[id] = {
          id,
          name: (r[ATT.USER] || '').trim(),
          grade: (r[ATT.GRADE] || '').trim(),
          school: (r[ATT.SCHOOL] || '').trim(),
          attended: 0, absent: 0, si: 0, totalSessions: 0,
          missReasons: {}, lastSeen: null
        };
      }

      const s = scholarMap[id];
      const cls = classifyRow(r, false);

      if (cls === 'attended') {
        s.attended++;
        const d = (r[ATT.SESS_DATE] || '').trim();
        if (d && (!s.lastSeen || d > s.lastSeen)) s.lastSeen = d;
      } else if (cls === 'absent') {
        s.absent++;
        const reason = (r[ATT.MISS_REASON] || '').trim();
        s.missReasons[reason] = (s.missReasons[reason] || 0) + 1;
      } else if (cls === 'service_interruption') {
        s.si++;
      }
    }

    // Build per-week scholar attendance (for weeklyTrend)
    const scholarWeekly = {};
    for (const r of scholarRows) {
      const week = (r[ATT.WEEK] || '').trim() || 'Unknown';
      if (!scholarWeekly[week]) scholarWeekly[week] = { attended: 0, absent: 0, si: 0 };
      const cls = classifyRow(r, false);
      if (cls === 'attended') scholarWeekly[week].attended++;
      else if (cls === 'absent') scholarWeekly[week].absent++;
      else if (cls === 'service_interruption') scholarWeekly[week].si++;
    }

    // uniqueScholarIds is no longer used — scholar count comes from scholarMap.size
    // after school-based filtering above. Session Details col Q counted ALL students
    // in a shared session block (across all tutors at the site), causing overcounting.

    // Student surveys about my sessions (filled_for_id = my ID)
    const myStuSurveys = stuRows.filter(r =>
      (r[STU.FILLED_FOR_ID] || '').trim() === pearlUserId
    );

    // Map student surveys to individual scholars by FILLED_BY_ID
    const stuSurveyByScholar = {};
    for (const r of myStuSurveys) {
      const sid = (r[STU.FILLED_BY_ID] || '').trim();
      if (!sid) continue;
      if (!stuSurveyByScholar[sid]) stuSurveyByScholar[sid] = [];
      stuSurveyByScholar[sid].push({
        confidence: safeNum(r[STU.CONFIDENCE]),
        enjoyment:  safeNum(r[STU.ENJOYMENT]),
        learning:   safeNum(r[STU.LEARNING]),
        overall:    safeNum(r[STU.OVERALL]),
        comment:    (r[STU.COMMENT] || '').trim(),
        date:       (r[STU.DATE]    || '').trim()
      });
    }

    const consecConcernIds = new Set(
      scholarRows
        .filter(r => (r[ATT.CONSEC_STATUS] || '').trim() === 'Attendance Concern')
        .map(r => (r[ATT.USER_ID] || '').trim())
    );

    const scholars = Object.values(scholarMap)
      .map(s => {
        const total = s.attended + s.absent;
        const svList = stuSurveyByScholar[s.id] || [];
        const svScores = { confidence: [], enjoyment: [], learning: [], overall: [] };
        const svComments = [];
        for (const sv of svList) {
          if (sv.confidence !== null) svScores.confidence.push(sv.confidence);
          if (sv.enjoyment  !== null) svScores.enjoyment.push(sv.enjoyment);
          if (sv.learning   !== null) svScores.learning.push(sv.learning);
          if (sv.overall    !== null) svScores.overall.push(sv.overall);
          if (sv.comment) svComments.push({ text: sv.comment, date: sv.date });
        }
        const svAvg = arr => arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length * 10) / 10 : null;
        return {
          ...s,
          totalSessions: total,
          attRate: total > 0 ? Math.round((s.attended / total) * 100) : null,
          consecConcern: consecConcernIds.has(s.id),
          surveyCount: svList.length,
          surveyScores: {
            confidence: svAvg(svScores.confidence),
            enjoyment:  svAvg(svScores.enjoyment),
            learning:   svAvg(svScores.learning),
            overall:    svAvg(svScores.overall)
          },
          surveyComments: svComments
        };
      });

    // SESS fallback: when ATT-based scholar detection finds 0 scholars
    // (e.g. site coordinators whose Pearl sessions have no student rows),
    // use the SESS sheet instructor→student mapping to build the scholar list.
    // This allows iReady academic data to match by scholar name for these users.
    if (scholars.length === 0 && sessRows && sessRows.length > 1) {
      const myNormName = myInstRows.length
        ? (myInstRows[0][ATT.USER] || '').trim().toLowerCase().replace(/\s+/g, ' ')
        : '';
      const SESS_INST_NAME = 1;  // col B: Instructor display name
      const SESS_STU_NAMES = 2;  // col C: Student names, comma-separated
      const SESS_INST_ID   = 15; // col P: Pearl Instructor User ID
      const SESS_STU_IDS   = 16; // col Q: Pearl Student User IDs, comma-separated
      const sessScholarMap = {};
      for (let ri = 1; ri < sessRows.length; ri++) {
        const row      = sessRows[ri];
        const instId   = (row[SESS_INST_ID]   || '').trim();
        const instName = (row[SESS_INST_NAME] || '').trim().toLowerCase().replace(/\s+/g, ' ');
        if (instId !== pearlUserId && instName !== myNormName) continue;
        const stuNames = (row[SESS_STU_NAMES] || '').split(',').map(s => s.trim()).filter(Boolean);
        const stuIds   = SESS_STU_IDS < row.length
          ? (row[SESS_STU_IDS] || '').split(',').map(s => s.trim()).filter(Boolean) : [];
        stuNames.forEach((name, i) => {
          if (!name) return;
          const sid = stuIds[i] || '';
          const key = sid || name.toLowerCase().replace(/\s+/g, ' ');
          if (!sessScholarMap[key]) {
            sessScholarMap[key] = {
              id: sid, name,
              grade: '', school: tutorSchool || '',
              attended: 0, absent: 0, si: 0, totalSessions: 0,
              missReasons: {}, lastSeen: null,
              attRate: null, consecConcern: false,
              surveyCount: 0,
              surveyScores: { confidence: null, enjoyment: null, learning: null, overall: null },
              surveyComments: []
            };
          }
        });
      }
      const sessScholars = Object.values(sessScholarMap);
      if (sessScholars.length > 0) scholars.push(...sessScholars);
    }

    // Unique scholar count = distinct scholars at this tutor's school across attended sessions
    const uniqueScholarCount = scholars.length;

    let schTotalAtt = 0, schTotalAbs = 0;
    for (const s of scholars) { schTotalAtt += s.attended; schTotalAbs += s.absent; }
    const scholarAttRate = (schTotalAtt + schTotalAbs) > 0
      ? Math.round(schTotalAtt / (schTotalAtt + schTotalAbs) * 100) : null;

    // Aggregated scholar missed reasons
    const scholarMissedReasons = {};
    for (const s of scholars) {
      for (const [reason, cnt] of Object.entries(s.missReasons)) {
        scholarMissedReasons[reason] = (scholarMissedReasons[reason] || 0) + cnt;
      }
    }

    // Schools covered
    const schoolSet = new Set();
    for (const r of myInstRows) {
      const sc = (r[ATT.SCHOOL] || '').trim();
      if (sc) schoolSet.add(sc);
    }
    const schoolsCovered = [...schoolSet];

    // Instructor surveys I submitted
    const myInstSurveys = instRows.filter(r =>
      (r[INST.FILLED_BY_ID] || '').trim() === pearlUserId
    );
    const surveyCount = myInstSurveys.length;
    const surveyRate = myAttended > 0 ? Math.round((surveyCount / myAttended) * 100) : null;

    // Action items: not-recorded sessions + attended sessions missing a survey
    // "Recent" = the 2 most recent weeks by session date
    const sortedByDate = myInstRows.slice().sort((a, b) => {
      const da = (a[ATT.SESS_DATE] || '').trim();
      const db = (b[ATT.SESS_DATE] || '').trim();
      return da < db ? -1 : da > db ? 1 : 0;
    });
    const mostRecentWeek = sortedByDate.length
      ? (sortedByDate[sortedByDate.length - 1][ATT.WEEK] || '').trim() : null;
    let prevWeek = null;
    for (let i = sortedByDate.length - 1; i >= 0; i--) {
      const w = (sortedByDate[i][ATT.WEEK] || '').trim();
      if (w && w !== mostRecentWeek) { prevWeek = w; break; }
    }
    const recentWeeks = new Set([mostRecentWeek, prevWeek].filter(Boolean));

    const notRecordedSessions = myInstRows
      .filter(r => classifyRow(r, true) === 'not_recorded')
      .map(r => ({
        date:   (r[ATT.SESS_DATE] || '').trim(),
        school: (r[ATT.SCHOOL]   || '').trim(),
        week:   (r[ATT.WEEK]     || '').trim(),
        recent: recentWeeks.has((r[ATT.WEEK] || '').trim())
      }));

    const surveyedSessionIds = new Set(
      myInstSurveys.map(r => (r[INST.SESS_ID] || '').trim()).filter(Boolean)
    );
    const missingSurveys = myInstRows
      .filter(r => {
        if (classifyRow(r, true) !== 'attended') return false;
        const sid = (r[ATT.SESSION] || '').trim();
        return sid && !surveyedSessionIds.has(sid);
      })
      .map(r => ({
        date:   (r[ATT.SESS_DATE] || '').trim(),
        school: (r[ATT.SCHOOL]   || '').trim(),
        week:   (r[ATT.WEEK]     || '').trim(),
        recent: recentWeeks.has((r[ATT.WEEK] || '').trim())
      }));

    // Data range: first and last session dates across all instructor rows
    const allDates = myInstRows
      .map(r => (r[ATT.SESS_DATE] || '').trim()).filter(Boolean).sort();
    const dataRange = {
      first: allDates[0] || null,
      last:  allDates[allDates.length - 1] || null
    };

    const stuScores = {
      confidence: [], enjoyment: [], learning: [], overall: []
    };
    for (const r of myStuSurveys) {
      const c = safeNum(r[STU.CONFIDENCE]);
      const e = safeNum(r[STU.ENJOYMENT]);
      const l = safeNum(r[STU.LEARNING]);
      const o = safeNum(r[STU.OVERALL]);
      if (c !== null) stuScores.confidence.push(c);
      if (e !== null) stuScores.enjoyment.push(e);
      if (l !== null) stuScores.learning.push(l);
      if (o !== null) stuScores.overall.push(o);
    }

    const toFixed1 = v => v !== null ? Math.round(v * 10) / 10 : null;

    // Build weeklyTrend array combining tutor and scholar weekly data
    const allWeeks = [...new Set([...Object.keys(weeklyAtt), ...Object.keys(scholarWeekly)])]
      .filter(w => w !== 'Unknown')
      .sort((a, b) => {
        const na = parseInt(a.replace(/\D/g, '')) || 0;
        const nb = parseInt(b.replace(/\D/g, '')) || 0;
        return na - nb;
      });
    const weeklyTrend = allWeeks.map(w => {
      const t = weeklyAtt[w] || { attended: 0, absent: 0, si: 0 };
      const s = scholarWeekly[w] || { attended: 0, absent: 0, si: 0 };
      const tutorTotal = t.attended + t.absent;
      const schTotal   = s.attended + s.absent;
      return {
        week: w,
        tutorRate:   tutorTotal  > 0 ? Math.round(t.attended / tutorTotal  * 100) : null,
        scholarRate: schTotal    > 0 ? Math.round(s.attended / schTotal    * 100) : null,
        siCount: s.si || 0
      };
    });

    // Compute a single X.X/5 student survey average for the KPI strip
    const stuSurveyAvg = (() => {
      const vals = [];
      for (const r of myStuSurveys) {
        [STU.CONFIDENCE, STU.ENJOYMENT, STU.LEARNING, STU.OVERALL].forEach(col => {
          const v = parseFloat(r[col]);
          if (!isNaN(v) && v > 0) vals.push(v);
        });
      }
      return vals.length ? Math.round(vals.reduce((a,b)=>a+b,0)/vals.length*10)/10 : null;
    })();

    return {
      myAttended, myAbsent, mySI,
      myTotal, myAttRate, myMissedReasons,
      scholars, uniqueScholarCount, scholarMissedReasons,
      serviceInterruptions: mySI, siReasons,
      surveyCount, surveyRate,
      notRecordedSessions, missingSurveys, dataRange, mostRecentWeek,
      stuAvgScores: {
        confidence: toFixed1(avg(stuScores.confidence)),
        enjoyment:  toFixed1(avg(stuScores.enjoyment)),
        learning:   toFixed1(avg(stuScores.learning)),
        overall:    toFixed1(avg(stuScores.overall)),
        count: myStuSurveys.length
      },
      schoolsCovered, weeklyAtt,
      tutorSchool, tutorDistrict,
      scholarAttRate, siByLevel,
      weeklyTrend, consecConcernIds: [...consecConcernIds],
      stuSurveyAvg, tutorSubject,
      hasData: true
    };
  }

  function clearCache() {
    Object.values(CACHE_KEYS).forEach(k => {
      try { localStorage.removeItem(k); } catch(e) {}
    });
  }

  window.NJTCPearlData = { fetchUserData, clearCache };
})();
