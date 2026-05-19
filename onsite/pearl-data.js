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
    stu:  'njtc_od_stu'
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
    const [attRows, instRows, stuRows] = await Promise.all([
      fetchSheet('att'),
      fetchSheet('inst'),
      fetchSheet('stu')
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

    const scholars = Object.values(scholarMap).map(s => {
      const total = s.attended + s.absent;
      return {
        ...s,
        totalSessions: total,
        attRate: total > 0 ? Math.round((s.attended / total) * 100) : null
      };
    });

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

    // Student surveys about my sessions (filled_for_id = my ID)
    const myStuSurveys = stuRows.filter(r =>
      (r[STU.FILLED_FOR_ID] || '').trim() === pearlUserId
    );

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
      scholars, scholarMissedReasons,
      serviceInterruptions: mySI, siReasons,
      surveyCount, surveyRate,
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
