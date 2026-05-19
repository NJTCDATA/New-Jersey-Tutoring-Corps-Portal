/* ============================================================================
   NJTC PEARL DATA MODULE
   Fetches and filters Pearl data for a specific Pearl User ID
   ============================================================================ */

(function () {
  'use strict';

  const PEARL_BASE_ID = '2PACX-1vQ1iC8NZFJt3iinGUEqftKtP32N43axi_JN_RQI36EBUdhZS0PaZRwd-1AJT3bEVe6cqHA0tCA3vb5K';
  const PEARL_GIDS = {
    att:  702726038,
    inst: 1955492004,
    stu:  1245403832,
    sess: 625567780
  };

  const CACHE_TTL = 5 * 60 * 1000;
  const CACHE_KEYS = {
    att:  'njtc_od_att',
    inst: 'njtc_od_inst',
    stu:  'njtc_od_stu',
    sess: 'njtc_od_sess'
  };

  // ATT column indexes
  const ATT = {
    USER: 0, ROLE: 1, SESSION: 2, SESS_STATUS: 3, PLAN_START: 4,
    SESS_DATE: 5, ATT_STATUS: 6, MISS_REASON: 7, GRADE: 8,
    SEX: 9, RACE: 10, SCHOOL: 11, DISTRICT: 12, USER_ID: 13,
    IND_ATT_RATE: 14, SCHOLAR_ATT_PCT: 15, AVG_ATT: 16,
    STU_AVG_ATT: 17, INST_AVG: 18, STU_ATT_CNT: 19, STU_MISS_CNT: 20,
    INST_ATT_CNT: 21, INST_MISS_CNT: 22, MISS_TAG: 23, WEEK: 26
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
    const url = `https://docs.google.com/spreadsheets/d/e/${PEARL_BASE_ID}/pub?output=csv&gid=${gid}`;

    const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
    if (!res.ok) throw new Error(`HTTP ${res.status} for sheet ${gidName}`);

    const text = await res.text();
    const rows = parseCSV(text);

    if (cacheKey) setCache(cacheKey, rows);
    return rows;
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
    const [attRows, instRows, stuRows, sessRows] = await Promise.all([
      fetchSheet('att'),
      fetchSheet('inst'),
      fetchSheet('stu'),
      fetchSheet('sess')
    ]);

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
        schoolsCovered: [], weeklyAtt: {}, hasData: false
      };
    }

    // All sessions the tutor has a record for (used for weekly tracking)
    const mySessions = new Set(myInstRows.map(r => (r[ATT.SESSION] || '').trim()).filter(Boolean));

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

    // Scholar rows — only sessions the tutor attended, not missed/absent ones
    const scholarRows = attRows.filter(r =>
      (r[ATT.ROLE] || '').trim() === 'Student' &&
      myAttendedSessions.has((r[ATT.SESSION] || '').trim())
    );

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

    // Derive unique scholar count from Session Details tab (column Q = index 16)
    // Column Q has comma-separated scholar IDs — this is the authoritative source
    const SESS_SCHOLAR_COL = 16;
    const uniqueScholarIds = new Set();
    if (sessRows.length > 1) {
      const sessH = sessRows[0].map(c => (c || '').trim().toLowerCase());
      // Find session ID column: try header keywords first, then data-match against myAttendedSessions
      let sessIdCol = sessH.findIndex(h => h.includes('session') && h.includes('id'));
      if (sessIdCol < 0) sessIdCol = sessH.findIndex(h => h === 'session');
      if (sessIdCol < 0) {
        // Probe columns 0–5: whichever has values that overlap myAttendedSessions is the ID column
        for (let c = 0; c <= 5; c++) {
          const hasMatch = sessRows.slice(1, 30).some(row => myAttendedSessions.has((row[c] || '').trim()));
          if (hasMatch) { sessIdCol = c; break; }
        }
      }
      if (sessIdCol < 0) sessIdCol = 0; // last-resort fallback
      for (const row of sessRows.slice(1)) {
        const sId = (row[sessIdCol] || '').trim();
        if (myAttendedSessions.has(sId)) {
          const cell = (row[SESS_SCHOLAR_COL] || '').trim();
          if (cell) {
            cell.split(',').forEach(rawId => {
              const t = rawId.trim();
              if (t) uniqueScholarIds.add(t);
            });
          }
        }
      }
    }

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

    const scholars = Object.values(scholarMap)
      .filter(s => uniqueScholarIds.size === 0 || uniqueScholarIds.has(s.id))
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

    // Unique count: sess-tab is authoritative; fall back to scholarMap size
    const uniqueScholarCount = uniqueScholarIds.size > 0 ? uniqueScholarIds.size : scholars.length;

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
      hasData: true
    };
  }

  window.NJTCPearlData = { fetchUserData };
})();
