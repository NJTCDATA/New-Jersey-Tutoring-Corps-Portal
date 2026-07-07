/* ══════════════════════════════════════════════════════════════════════
   NJTC Annual Impact & Satisfaction Report — ar-* namespace
   Combines: Quarterly Goals (window.KPI_Q_DATA) + Partner Satisfaction
   (Quarterly + EOY) + Onsite Staff Feedback + Scholar Feedback.
   All normalize/calc logic below is copied faithfully from the production
   modules it mirrors (survey-feedback.js / scholar-feedback.js /
   onsite-feedback.js) so results match those modules exactly.
   Fetches live on every generation — never stale, on-demand cadence.
══════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';



  var PARTNER_CSV_URL = 'https://docs.google.com/spreadsheets/d/1wp50xdBU7dRcJBzh4-sr5BJ7wn6lrOyFiHUUIG8XNrY/export?format=csv&gid=616402823';
  var PARTNER_EOY_CSV_URL = 'https://docs.google.com/spreadsheets/d/1wZj1cfqr73jgnEZBhJ44C6ekOtGMhOIUAr-yqsDEsKY/export?format=csv&gid=1455158458';
  var SCHOLAR_CSV_URL = 'https://docs.google.com/spreadsheets/d/19Ox5UtW9BgJoMYSXH7ybDCSwS0vmOKGUmxkozm7rk9A/export?format=csv&gid=1733049715';
  var ONSITE_CSV_URL = 'https://docs.google.com/spreadsheets/d/1C6LmYxJZOF-iCV9KPpbHOY76GFvmLlbqDtMhynVbKYI/export?format=csv&gid=1560652927';

  // ── Shared CSV parsers (identical to source modules) ────────────────────
  function parseCSVKeyed(text) {
    var rows = [];
    var row = [], cell = '', inQ = false;
    var src = text.charCodeAt(0) === 0xFEFF ? text.slice(1) : text;
    for (var i = 0; i < src.length; i++) {
      var ch = src[i];
      if (ch === '"') {
        if (inQ && src[i + 1] === '"') { cell += '"'; i++; }
        else { inQ = !inQ; }
      } else if (ch === ',' && !inQ) {
        row.push(cell); cell = '';
      } else if (!inQ && (ch === '\n' || ch === '\r')) {
        row.push(cell); cell = '';
        if (row.some(function(c){ return c.trim(); })) rows.push(row);
        row = [];
        if (ch === '\r' && src[i + 1] === '\n') i++;
      } else {
        cell += ch;
      }
    }
    if (cell || row.length) { row.push(cell); if (row.some(function(c){ return c.trim(); })) rows.push(row); }
    if (!rows.length) return [];
    var headers = rows[0].map(function(h){ return h.trim(); });
    return rows.slice(1).map(function(vals) {
      var obj = {};
      headers.forEach(function(h, idx) { obj[h] = (vals[idx] !== undefined ? vals[idx].trim() : ''); });
      return obj;
    });
  }
  function parseCSVPositional(text) {
    var rows = [];
    var row = [], cell = '', inQ = false;
    var src = text.charCodeAt(0) === 0xFEFF ? text.slice(1) : text;
    for (var i = 0; i < src.length; i++) {
      var ch = src[i];
      if (ch === '"') {
        if (inQ && src[i + 1] === '"') { cell += '"'; i++; }
        else { inQ = !inQ; }
      } else if (ch === ',' && !inQ) {
        row.push(cell); cell = '';
      } else if (!inQ && (ch === '\n' || ch === '\r')) {
        row.push(cell); cell = '';
        if (row.some(function(c){ return c.trim(); })) rows.push(row);
        row = [];
        if (ch === '\r' && src[i + 1] === '\n') i++;
      } else {
        cell += ch;
      }
    }
    if (cell || row.length) { row.push(cell); if (row.some(function(c){ return c.trim(); })) rows.push(row); }
    if (!rows.length) return { headers: [], rows: [] };
    var headers = rows[0].map(function(h){ return h.trim(); });
    var dataRows = rows.slice(1).map(function(vals){ return headers.map(function(h, idx){ return (vals[idx] !== undefined ? vals[idx].trim() : ''); }); });
    return { headers: headers, rows: dataRows };
  }

  function pickField(raw, exactNames, partialRe) {
    for (var i=0;i<exactNames.length;i++) {
      var v = (raw[exactNames[i]] || '').trim();
      if (v) return v;
    }
    if (partialRe) {
      var keys = Object.keys(raw);
      for (var j=0;j<keys.length;j++) {
        if (partialRe.test(keys[j])) {
          var v2 = (raw[keys[j]] || '').trim();
          if (v2) return v2;
        }
      }
    }
    return '';
  }
  function pickFieldPos(headers, valsRow, exactNames, partialRe) {
    for (var i=0;i<exactNames.length;i++) {
      var idx = headers.indexOf(exactNames[i]);
      if (idx >= 0 && (valsRow[idx]||'').trim()) return valsRow[idx].trim();
    }
    if (partialRe) {
      for (var j=0;j<headers.length;j++) {
        if (partialRe.test(headers[j]) && (valsRow[j]||'').trim()) return valsRow[j].trim();
      }
    }
    return '';
  }

  // ══════════════════════════════════════════════════════════════════════
  //  PARTNER SATISFACTION — Quarterly (mirrors survey-feedback.js)
  // ══════════════════════════════════════════════════════════════════════
  var PARTNER_DISTRICT_MAP = {
    'Bergen / iLearn Schools': 'iLearn CMO', 'Bergen Arts and Science Charter': 'iLearn CMO',
    'Bergen Arts & Science Charter': 'iLearn CMO', 'Hudson Arts & Science Charter School': 'iLearn CMO',
    'Hudson Arts and Science Charter School': 'iLearn CMO', 'Paterson Arts and Science(iLearn)': 'iLearn CMO',
    'Paterson Arts and Science Charter School': 'iLearn CMO', 'Paterson Arts & Science Charter School': 'iLearn CMO',
    'Passaic Arts And Science Charter School': 'iLearn CMO', 'Passaic Arts and Science Charter School': 'iLearn CMO',
    'Passaic Clifton Arts and Science Charter School': 'iLearn CMO', 'Passaic Arts & Science Charter School': 'iLearn CMO',
    'Haddon Township ': 'Haddon Township',
  };
  function normalizePartnerDistrict(d) { var t=d.trim(); return PARTNER_DISTRICT_MAP[d] || PARTNER_DISTRICT_MAP[t] || t; }
  var SAT_LEVELS = ['Very Satisfied','Satisfied','Neutral','Dissatisfied','Very Dissatisfied'];
  var SAT_LEVEL_SET = {}; SAT_LEVELS.forEach(function(s){ SAT_LEVEL_SET[s]=true; });
  function normalizeSatLevel(val) {
    if (!val) return '';
    var t = val.trim();
    if (SAT_LEVEL_SET[t]) return t;
    var lower = t.toLowerCase();
    if (lower==='very satisfied'||lower==='highly satisfied'||lower==='extremely satisfied') return 'Very Satisfied';
    if (lower==='satisfied') return 'Satisfied';
    if (lower==='neutral'||lower==='neither satisfied nor dissatisfied') return 'Neutral';
    if (lower==='dissatisfied') return 'Dissatisfied';
    if (lower==='very dissatisfied'||lower==='highly dissatisfied'||lower==='extremely dissatisfied') return 'Very Dissatisfied';
    return t;
  }
  function pickPartnerQuarter(raw) {
    var names = ['Quarter Status','Quarter Status:','quarter status','Quarter','Quarter:','Q Status','Q Status:','Survey Quarter','Survey Quarter:','Survey Q'];
    for (var i=0;i<names.length;i++) { var v=(raw[names[i]]||'').trim(); if (v) return v; }
    var keys = Object.keys(raw);
    for (var j=0;j<keys.length;j++) { if (/quarter/i.test(keys[j])) { var v2=(raw[keys[j]]||'').trim(); if (v2) return v2; } }
    if (keys.length >= 14) { var v3=(raw[keys[13]]||'').trim(); if (v3) return v3; }
    var qp = /^(q\s*[1-4]|quarter\s*[0-9one two three four]+|[0-9]+\s*q|fall|spring|winter|summer)/i;
    for (var k=0;k<keys.length;k++) { var v4=(raw[keys[k]]||'').trim(); if (qp.test(v4)) return v4; }
    return '';
  }
  function normalizePartnerRow(raw) {
    var district = normalizePartnerDistrict(pickField(raw, ['District Name:','District Name','District','district'], /district/i));
    var satisfactionLevel = normalizeSatLevel(pickField(raw,
      ['Reflecting on all NJTC/PATC experiences to date...','Reflecting on all NJTC/PATC experiences to date\u2026',
       'How would you rate your overall satisfaction?','Overall Satisfaction','Satisfaction Level','Satisfaction'],
      /experiences to date|overall satisfaction|satisfaction level/i));
    var npsRaw = pickField(raw,
      ['Would you recommend NJTC to a friend or a colleague?','Would you recommend NJTC to a friend or colleague?',
       'Likelihood to Recommend','NPS','NPS Score','How likely are you to recommend NJTC?'],
      /recommend.*njtc|likelihood.*recommend|nps/i);
    var dissatRaw = pickField(raw,
      ['If dissatisfied or very dissatisfied, please select the potential reason...',
       'If dissatisfied or very dissatisfied, please select the potential reason\u2026',
       'Dissatisfaction Reasons','Reason for Dissatisfaction'],
      /dissatisfi.*reason|reason.*dissatisfi/i);
    var highlightComment = pickField(raw,
      ["If you're satisfied... / If Neutral...", "If you\u2019re satisfied... / If Neutral...",
       "If you're satisfied\u2026 / If Neutral\u2026", 'Highlight Comment','Positive Comment','Comments'],
      /if you.?re satisfied|highlight comment|positive comment/i);
    var school = (raw['School Name:'] || raw['School Name'] || pickField(raw, [], /school name/i) || '').trim();
    var role = (raw['Role:'] || raw['Role'] || pickField(raw, [], /^role$/i) || '').trim();
    return {
      timestamp: raw['Timestamp']||raw['timestamp']||'',
      email: raw['Email Address']||raw['email']||'',
      district: district, school: school, role: role,
      npsScore: parseInt(npsRaw)||0,
      satisfactionLevel: satisfactionLevel,
      highlightComment: highlightComment,
      dissatisfactionReasons: dissatRaw.split(',').map(function(s){return s.trim();}).filter(Boolean),
      improvementComment: pickField(raw,
        ['How can we offer more support...','How can we offer more support\u2026','Improvement Suggestions'],
        /more support|improvement/i),
      quarter: pickPartnerQuarter(raw),
    };
  }
  function calcNPS(rows) {
    var valid = rows.filter(function(r){ return r.npsScore>=1 && r.npsScore<=5; });
    var promoters = valid.filter(function(r){ return r.npsScore>=4; }).length;
    var detractors = valid.filter(function(r){ return r.npsScore<=2; }).length;
    var passives = valid.filter(function(r){ return r.npsScore===3; }).length;
    var total = valid.length;
    var nps = total===0 ? null : Math.round(((promoters-detractors)/total)*1000)/10;
    return { promoters:promoters, detractors:detractors, passives:passives, total:total, nps:nps,
      promoterPct: total?+(promoters/total*100).toFixed(1):0,
      detractorPct: total?+(detractors/total*100).toFixed(1):0 };
  }

  // ══════════════════════════════════════════════════════════════════════
  //  PARTNER SATISFACTION — EOY (mirrors survey-feedback.js EOY logic)
  // ══════════════════════════════════════════════════════════════════════
  var EOY_DOMAIN_MAP = {
    'passaiccharter.org': ['iLearn CMO','NE'], 'hudsoncharter.org': ['iLearn CMO','NE'],
    'bergencharter.org': ['iLearn CMO','NE'], 'patersoncharter.org': ['iLearn CMO','NE'],
  };
  function eoyClassifyDistrict(site, email) {
    if (email && email.indexOf('@')>=0) {
      var dom = email.split('@')[1].toLowerCase();
      if (EOY_DOMAIN_MAP[dom]) return EOY_DOMAIN_MAP[dom][0];
    }
    return (site||'Unknown').trim();
  }
  function eoyParseRole(nameRole) {
    var t=(nameRole||'').trim();
    if (!t) return { name:'', role:'Unknown' };
    var parts = t.split(' - ');
    if (parts.length>=2) return { name: parts[0].trim(), role: parts.slice(1).join(' - ').trim() };
    var KNOWN = /^(teacher|principal|ada|ado|program director|instructional coach|curriculum director|site coordinator)$/i;
    if (KNOWN.test(t)) return { name:'', role:t };
    return { name:t, role:'Unknown' };
  }
  function normalizeEoyRow(raw) {
    var nameRole = pickField(raw, ['Provide your Name and Role:','Provide your Name and Role'], /provide your name and role/i);
    var parsed = eoyParseRole(nameRole);
    var site = pickField(raw, ['Provide your site location:','Provide your site location'], /provide your site location/i);
    var email = raw['Email Address']||'';
    var district = eoyClassifyDistrict(site, email);
    var npsRaw = pickField(raw, [], /recommend new jersey tutoring corps|likely.*recommend.*njtc/i);
    var needsMet = pickField(raw, [], /overall.{0,10}how well has njtc met your needs/i);
    return {
      timestamp: raw['Timestamp']||'', email: email, name: parsed.name, role: parsed.role,
      district: normalizePartnerDistrict(district), site: site,
      npsScore: parseInt(npsRaw)||0,
      needsMet: (needsMet||'').trim(),
      goodAt: pickField(raw, [], /what is njtc good at/i),
      couldImprove: pickField(raw, [], /what could njtc do better/i),
    };
  }

  // ══════════════════════════════════════════════════════════════════════
  //  SCHOLAR FEEDBACK (mirrors scholar-feedback.js)
  // ══════════════════════════════════════════════════════════════════════
  var SITE_REGION = {
    'iLearn Charter School Paterson ES':'NE','iLearn Charter School Paterson MS':'NE',
    'iLearn Charter School Paterson Silk City Campus [K-3]':'NE','iLearn Charter School Bergen ES':'NE',
    'iLearn Charter School Bergen MS':'NE','iLearn Charter School Clifton ES':'NE','iLearn Charter School Clifton MS':'NE',
    'iLearn Charter School Clifton HS':'NE','iLearn Charter School Hudson ES':'NE','iLearn Charter School Hudson MS':'NE',
    'iLearn Charter School Passaic ES':'NE','iLearn Charter School Passaic MS':'NE','Central Jersey College Prep':'NE',
    'Middlesex STEM':'NE','Paterson Charter (PCSST) - Paterson Charter School Science & Tech (MS 4-7) - Wabash':'NE',
    'AMERICAN PARADIGM SCHOOLS - First Philadelphia Preparatory Charter School':'NE',
    'Global Leadership Academy':'SW','Gloucester Twp - Loring-Flemming':'SW',
    'Haddon Township - Clyde S Jennings Elementary School':'SW','Haddon Township - Stoy Elementary School':'SW',
    'Haddon Township - Strawbridge Elementary School':'SW','Haddon Township - Thomas Edison Elementary School':'SW',
    'Haddon Township - Van Sciver Elementary School':'SW',
    'Hamilton Township School District  Albert E. Grice Middle School':'SW',
    'Hamilton Township School District  Crockett Middle School':'SW',
    'Hamilton Township School District  Greenwood  Elementary School':'SW',
    'Hamilton Township School District  Klockner  Elementary School':'SW',
    'Hamilton Township School District  Kuser Elementary School':'SW',
    'Hamilton Township School District  Wilson Elementary School':'SW',
    'Penns Grove - Field Street Elementary':'SW','Penns Grove - P.W. Carleton Elementary':'SW',
    'Penns Grove Penns Grove - MS':'SW',
    'STRING THEORY SCHOOLS - The Philadelphia Charter School For Arts & Sciences':'SW',
  };
  function scholarSiteRegion(site) {
    var s=(site||'').trim();
    if (SITE_REGION[s]) return SITE_REGION[s];
    var ls = s.toLowerCase();
    if (ls.indexOf('ilearn')>=0||ls.indexOf('paterson')>=0||ls.indexOf('central jersey')>=0||ls.indexOf('middlesex')>=0||ls.indexOf('american paradigm')>=0||ls.indexOf('first philadelphia')>=0) return 'NE';
    if (ls.indexOf('haddon')>=0||ls.indexOf('hamilton')>=0||ls.indexOf('penns grove')>=0||ls.indexOf('gloucester')>=0||ls.indexOf('global leadership')>=0||ls.indexOf('string theory')>=0) return 'SW';
    return 'Unknown';
  }
  function isYes(v) { return (v||'').trim().toLowerCase()==='yes'; }
  function normalizeScholarRow(raw) {
    var site = pickField(raw, ['Select your site location from the list below:','Select your site location from the list below','Site'], /site location/i);
    var mathParticipated = pickField(raw, ["Did you participate in Math tutoring this school year?"], /participate in math/i);
    var mathConfidence = parseInt(pickField(raw, ['Do you feel stronger doing math now compared to how you felt when tutoring started?'], /stronger doing math/i)) || null;
    var mathEnjoyTutor = pickField(raw, ['Did you enjoy working with your tutor?'], /enjoy working with your tutor\?$/i);
    var mathLikedProgram = pickField(raw, ['Did you like participating in the program? '], /like participating in the program/i);
    var litParticipated = pickField(raw, ['Did you participate in literacy tutoring? '], /participate in literacy/i);
    var litConfidence = parseInt(pickField(raw, ['Do you feel stronger in reading and writing now compared to how you felt when tutoring started?'], /stronger in reading and writing/i)) || null;
    var litEnjoyTutor = pickField(raw, ['Did you enjoy working with your tutor? 2'], /enjoy working with your tutor.*2/i);
    var litLikedProgram = pickField(raw, ['Did you like participating in the program?  2'], /like participating in the program.*2/i);
    return {
      timestamp: raw['Timestamp']||'', site: site, region: scholarSiteRegion(site),
      mathParticipated: isYes(mathParticipated), mathConfidence: mathConfidence,
      mathEnjoyTutor: isYes(mathEnjoyTutor), mathLikedProgram: isYes(mathLikedProgram),
      litParticipated: isYes(litParticipated), litConfidence: litConfidence,
      litEnjoyTutor: isYes(litEnjoyTutor), litLikedProgram: isYes(litLikedProgram),
    };
  }
  function calcConfNPS(rows, scoreKey) {
    var valid = rows.filter(function(r){ return r[scoreKey]>=1 && r[scoreKey]<=5; });
    var promoters = valid.filter(function(r){ return r[scoreKey]>=4; }).length;
    var detractors = valid.filter(function(r){ return r[scoreKey]<=2; }).length;
    var total = valid.length;
    var avg = total ? valid.reduce(function(s,r){ return s+r[scoreKey]; },0)/total : null;
    var nps = total===0 ? null : Math.round(((promoters-detractors)/total)*100);
    return { promoters:promoters, detractors:detractors, total:total, avg:avg, nps:nps };
  }

  // ══════════════════════════════════════════════════════════════════════
  //  ONSITE FEEDBACK (mirrors onsite-feedback.js — positional)
  // ══════════════════════════════════════════════════════════════════════
  var ROLE_ANCHORS = {
    'Site Coordinator': /satisfaction with your role as a Site Coordinator/i,
    'Coach': /satisfaction with your role as a Coach\b/i,
    'SC/IC Dual Role': /satisfaction with your role as a\s+Dual Role SC\/IC/i,
    'Tutor': /satisfaction with your role as a Tutor/i,
  };
  var FOLLOWUP_OFFSETS = { managingExpected:1, supportingRewarding:2, siteStaffEasy:3, madeDifference:4, commConsistent:5, grewProfessionally:6 };
  function findColByRegex(headers, re) { for (var i=0;i<headers.length;i++) { if (re.test(headers[i])) return i; } return -1; }
  function isAgree(v) { return /^(strongly agree|agree)$/i.test((v||'').trim()); }
  function normalizeOnsiteRegion(region) {
    var t = (region||'').replace(/\s*Region\s*$/i,'').trim();
    var low = t.toLowerCase().replace(/[\s-]+/g,'');
    if (low === 'northeast') return 'NE';
    if (low === 'southwest') return 'SW';
    return t || region;
  }
  function isAnswered(v) { var t=(v||'').trim(); return !!t && t.toLowerCase()!=='n/a'; }
  function normalizeOnsiteRow(headers, valsRow) {
    var name = pickFieldPos(headers, valsRow, ['Please write your name'], /write your name/i);
    var site = pickFieldPos(headers, valsRow, ['Please identify the site(s) you have supported this year'], /site\(s\) you have supported/i);
    var role = pickFieldPos(headers, valsRow, ['Select your role'], /^select your role$/i);
    var region = pickFieldPos(headers, valsRow, ['Region Assigned: ','Region Assigned:','Region Assigned'], /region assigned/i);
    var wouldWorkAgain = pickFieldPos(headers, valsRow, ['Would you be interested in working with us again? ','Would you be interested in working with us again?'], /interested in working with us again/i);
    var emailIdx = headers.indexOf('Email Address');
    var email = emailIdx>=0 ? (valsRow[emailIdx]||'') : '';

    var anchorRe = ROLE_ANCHORS[role];
    var satisfaction=null, madeDifference='', grewProfessionally='';
    if (anchorRe) {
      var anchorIdx = findColByRegex(headers, anchorRe);
      if (anchorIdx>=0) {
        satisfaction = parseInt(valsRow[anchorIdx]) || null;
        var at = function(offset){ var v=valsRow[anchorIdx+offset]; return v!==undefined?v:''; };
        madeDifference = at(FOLLOWUP_OFFSETS.madeDifference);
        grewProfessionally = at(FOLLOWUP_OFFSETS.grewProfessionally);
      }
    }
    return {
      timestamp: emailIdx>=0?(valsRow[headers.indexOf('Timestamp')]||''):'',
      email: email, name: name, site: site, role: role,
      region: normalizeOnsiteRegion(region),
      wouldWorkAgain: wouldWorkAgain,
      satisfaction: satisfaction,
      grewProfessionally: grewProfessionally, grewProfessionallyAgree: isAgree(grewProfessionally), grewProfessionallyAnswered: isAnswered(grewProfessionally),
      madeDifference: madeDifference, madeDifferenceAgree: isAgree(madeDifference), madeDifferenceAnswered: isAnswered(madeDifference),
    };
  }
  function calcOnsiteNPS(rows) {
    var valid = rows.filter(function(r){ return r.satisfaction>=1 && r.satisfaction<=5; });
    var promoters = valid.filter(function(r){ return r.satisfaction>=4; }).length;
    var detractors = valid.filter(function(r){ return r.satisfaction<=2; }).length;
    var total = valid.length;
    var avg = total ? valid.reduce(function(s,r){ return s+r.satisfaction; },0)/total : null;
    var nps = total===0 ? null : Math.round(((promoters-detractors)/total)*100);
    return { total: total, avg: avg, nps: nps };
  }
  function pct1(num, den) { return den ? +(num/den*100).toFixed(1) : null; }

  // Expose for both browser (window) and Node (module.exports) test harness
  
function topBy(counterObj, n) {
    return Object.entries(counterObj).sort(function(a,b){ return b[1]-a[1]; }).slice(0, n);
  }
  // When there are too few qualifying segments, "best" and "worst" can end up
  // showing the same items. Given a sorted-best and sorted-worst list, drop any
  // worst-list item that's already in the best list — a "top / bottom" framing
  // is misleading when there are only 2-3 segments total to compare.
  function dedupeWorst(bestList, worstList) {
    var bestNames = {};
    bestList.forEach(function(b){ bestNames[b.name] = true; });
    return worstList.filter(function(w){ return !bestNames[w.name]; });
  }
  function groupCount(rows, key) {
    var c = {};
    rows.forEach(function(r){ var k=r[key]; if (!k) return; c[k]=(c[k]||0)+1; });
    return c;
  }

  // ── Partner Satisfaction section ────────────────────────────────────────
  function buildPartnerSection(partnerRows, eoyRows) {
    var overall = calcNPS(partnerRows);
    var byDistrict = {};
    groupCount(partnerRows, 'district');
    var districts = Object.keys(groupCount(partnerRows, 'district'));
    districts.forEach(function(d) {
      var rows = partnerRows.filter(function(r){ return r.district===d; });
      byDistrict[d] = Object.assign({ n: rows.length }, calcNPS(rows));
    });
    var byRole = {};
    Object.keys(groupCount(partnerRows, 'role')).forEach(function(rl) {
      var rows = partnerRows.filter(function(r){ return r.role===rl; });
      byRole[rl] = Object.assign({ n: rows.length }, calcNPS(rows));
    });
    var biggestContributors = topBy(groupCount(partnerRows, 'district'), 5)
      .map(function(pair){ return { name: pair[0], n: pair[1], nps: byDistrict[pair[0]].nps }; });

    // Positives: districts with n>=3 AND an actually-good NPS (>=40, promoter-heavy) —
    // rank order alone previously let a strongly negative NPS get labeled "top
    // performing" whenever nothing else qualified. A district only appears here if
    // its score is genuinely good, not merely "the best of a bad set."
    var districtsWithN = Object.entries(byDistrict).filter(function(e){ return e[1].n >= 3; });
    var bestDistricts = districtsWithN.filter(function(e){ return e[1].nps !== null && e[1].nps >= 40; })
      .sort(function(a,b){ return b[1].nps-a[1].nps; }).slice(0,3)
      .map(function(e){ return { name: e[0], nps: e[1].nps, n: e[1].n }; });
    var highlightComments = partnerRows.filter(function(r){ return r.highlightComment && r.highlightComment.length > 15; })
      .slice(0, 6).map(function(r){ return { text: r.highlightComment, district: r.district }; });

    // Negatives: districts with n>=3 AND a genuinely concerning NPS (<20).
    var worstDistricts = districtsWithN.filter(function(e){ return e[1].nps !== null && e[1].nps < 20; })
      .sort(function(a,b){ return a[1].nps-b[1].nps; }).slice(0,3)
      .map(function(e){ return { name: e[0], nps: e[1].nps, n: e[1].n }; });
    var dissatFreq = {};
    partnerRows.forEach(function(r){ r.dissatisfactionReasons.forEach(function(reason){ if (reason) dissatFreq[reason]=(dissatFreq[reason]||0)+1; }); });
    var topDissatReasons = topBy(dissatFreq, 5).map(function(p){ return { reason: p[0], count: p[1] }; });

    var eoyOverall = eoyRows.length ? calcNPS(eoyRows) : null;
    // Top-2-box "needs met" — Extremely Well + Very Well combined (distinct from the
    // recommend-a-friend NPS question; this is a separate satisfaction question).
    var needsMetAnswered = eoyRows.filter(function(r){ return r.needsMet; });
    var needsMetTop2 = needsMetAnswered.filter(function(r){ return /^extremely well$|^very well$/i.test(r.needsMet); }).length;
    var eoyNeedsMetPct = needsMetAnswered.length ? +(needsMetTop2/needsMetAnswered.length*100).toFixed(1) : null;

    return {
      n: partnerRows.length, eoyN: eoyRows.length,
      overall: overall, eoyOverall: eoyOverall,
      eoyNeedsMetPct: eoyNeedsMetPct, eoyNeedsMetN: needsMetAnswered.length,
      byDistrict: byDistrict, byRole: byRole,
      biggestContributors: biggestContributors,
      positives: { bestDistricts: bestDistricts, highlightComments: highlightComments },
      negatives: { worstDistricts: worstDistricts, topDissatReasons: topDissatReasons },
    };
  }

  // ── Onsite Feedback section ─────────────────────────────────────────────
  function buildOnsiteSection(onsiteRows) {
    var overall = calcOnsiteNPS(onsiteRows);
    var grew = onsiteRows.filter(function(r){ return r.grewProfessionallyAnswered; });
    var grewYes = grew.filter(function(r){ return r.grewProfessionallyAgree; }).length;
    var diff = onsiteRows.filter(function(r){ return r.madeDifferenceAnswered; });
    var diffYes = diff.filter(function(r){ return r.madeDifferenceAgree; }).length;

    var byRole = {};
    Object.keys(groupCount(onsiteRows, 'role')).forEach(function(rl) {
      var rows = onsiteRows.filter(function(r){ return r.role===rl; });
      var g = rows.filter(function(r){ return r.grewProfessionallyAnswered; });
      var gY = g.filter(function(r){ return r.grewProfessionallyAgree; }).length;
      var d = rows.filter(function(r){ return r.madeDifferenceAnswered; });
      var dY = d.filter(function(r){ return r.madeDifferenceAgree; }).length;
      byRole[rl] = Object.assign({ n: rows.length }, calcOnsiteNPS(rows), { grewPct: pct1(gY, g.length), diffPct: pct1(dY, d.length) });
    });
    var byRegion = {};
    Object.keys(groupCount(onsiteRows, 'region')).forEach(function(rg) {
      var rows = onsiteRows.filter(function(r){ return r.region===rg; });
      byRegion[rg] = Object.assign({ n: rows.length }, calcOnsiteNPS(rows));
    });
    var biggestContributors = topBy(groupCount(onsiteRows, 'role'), 5).map(function(p){ return { name: p[0], n: p[1], nps: byRole[p[0]].nps }; });

    var roleEntries = Object.entries(byRole).filter(function(e){ return e[1].n>=3; });
    var bestRoles = roleEntries.filter(function(e){ return e[1].nps !== null && e[1].nps >= 40; })
      .sort(function(a,b){ return b[1].nps-a[1].nps; }).slice(0,2).map(function(e){ return {name:e[0], nps:e[1].nps, n:e[1].n}; });
    var worstRoles = roleEntries.filter(function(e){ return e[1].nps !== null && e[1].nps < 20; })
      .sort(function(a,b){ return a[1].nps-b[1].nps; }).slice(0,2).map(function(e){ return {name:e[0], nps:e[1].nps, n:e[1].n}; });

    return {
      n: onsiteRows.length, overall: overall,
      grewProfessionallyPct: pct1(grewYes, grew.length), grewProfessionallyN: grew.length,
      madeDifferencePct: pct1(diffYes, diff.length), madeDifferenceN: diff.length,
      byRole: byRole, byRegion: byRegion,
      biggestContributors: biggestContributors,
      positives: { bestRoles: bestRoles },
      negatives: { worstRoles: worstRoles },
    };
  }

  // ── Scholar Feedback section ────────────────────────────────────────────
  function buildScholarSection(scholarRows) {
    var mathRows = scholarRows.filter(function(r){ return r.mathParticipated; });
    var litRows = scholarRows.filter(function(r){ return r.litParticipated; });
    var mathNPS = calcConfNPS(mathRows, 'mathConfidence');
    var litNPS = calcConfNPS(litRows, 'litConfidence');

    var bySite = {};
    Object.keys(groupCount(scholarRows, 'site')).forEach(function(s) {
      var mRows = mathRows.filter(function(r){ return r.site===s; });
      var lRows = litRows.filter(function(r){ return r.site===s; });
      bySite[s] = {
        n: scholarRows.filter(function(r){ return r.site===s; }).length,
        mathNPS: calcConfNPS(mRows, 'mathConfidence').nps, mathN: mRows.length,
        litNPS: calcConfNPS(lRows, 'litConfidence').nps, litN: lRows.length,
      };
    });
    var byRegion = {};
    ['NE','SW'].forEach(function(rg) {
      var rows = scholarRows.filter(function(r){ return r.region===rg; });
      var mR = rows.filter(function(r){ return r.mathParticipated; });
      var lR = rows.filter(function(r){ return r.litParticipated; });
      byRegion[rg] = { n: rows.length, mathNPS: calcConfNPS(mR,'mathConfidence').nps, litNPS: calcConfNPS(lR,'litConfidence').nps };
    });

    var biggestContributors = topBy(groupCount(scholarRows, 'site'), 5).map(function(p){ return { name: p[0], n: p[1] }; });

    var siteEntries = Object.entries(bySite).filter(function(e){ return e[1].mathN>=3 && e[1].litN>=3; });
    function avgSiteNPS(e) { return ((e[1].mathNPS||0)+(e[1].litNPS||0))/2; }
    var bestSites = siteEntries.filter(function(e){ return avgSiteNPS(e) >= 40; })
      .sort(function(a,b){ return avgSiteNPS(b)-avgSiteNPS(a); }).slice(0,3).map(function(e){ return {name:e[0], mathNPS:e[1].mathNPS, litNPS:e[1].litNPS, n:e[1].n}; });
    var worstSites = siteEntries.filter(function(e){ return avgSiteNPS(e) < 20; })
      .sort(function(a,b){ return avgSiteNPS(a)-avgSiteNPS(b); }).slice(0,3).map(function(e){ return {name:e[0], mathNPS:e[1].mathNPS, litNPS:e[1].litNPS, n:e[1].n}; });

    var mathEnjoyPct = pct1(mathRows.filter(function(r){return r.mathEnjoyTutor;}).length, mathRows.length);
    var litEnjoyPct = pct1(litRows.filter(function(r){return r.litEnjoyTutor;}).length, litRows.length);

    return {
      n: scholarRows.length, mathN: mathRows.length, litN: litRows.length,
      mathNPS: mathNPS, litNPS: litNPS, byRegion: byRegion, bySite: bySite,
      biggestContributors: biggestContributors,
      mathEnjoyPct: mathEnjoyPct, litEnjoyPct: litEnjoyPct,
      positives: { bestSites: bestSites },
      negatives: { worstSites: worstSites },
    };
  }

  // ── Cross-cutting synthesis ─────────────────────────────────────────────
  function npsVerdict(nps) {
    if (nps === null) return { label: 'no data', flag: 'muted' };
    if (nps >= 70) return { label: 'exceptionally strong', flag: 'good' };
    if (nps >= 50) return { label: 'strong', flag: 'good' };
    if (nps >= 20) return { label: 'solid, with room to grow', flag: 'watch' };
    if (nps >= 0) return { label: 'mixed \u2014 promoters and detractors are roughly balanced', flag: 'watch' };
    return { label: 'a genuine concern \u2014 detractors currently outnumber promoters', flag: 'concern' };
  }
  function pctVsGoalVerdict(pct, goal) {
    if (pct === null) return { label: 'no data', flag: 'muted' };
    if (pct >= goal) return { label: 'meeting or exceeding the ' + goal + '% target', flag: 'good' };
    if (pct >= goal - 10) return { label: 'just under the ' + goal + '% target', flag: 'watch' };
    return { label: 'well short of the ' + goal + '% target \u2014 warrants a closer look', flag: 'concern' };
  }
  function buildSynthesis(goalsNarrative, partner, onsite, scholar) {
    var domains = [];

    if (goalsNarrative) {
      var gs = goalsNarrative.latestSC;
      var goalFlag = gs.score>=85?'good':gs.score>=65?'watch':'concern';
      domains.push({
        label: 'Annual Goal Progress', metric: gs.score + '% (' + gs.health.label + ')', flag: goalFlag,
        text: gs.counts.met + ' of ' + gs.counts.total + ' organizational targets are fully Met' + (gs.counts.notmet ? ', while ' + gs.counts.notmet + ' remain Not Met and need continued attention' : ', with no targets currently Not Met') + '.'
      });
    }

    var qv = npsVerdict(partner.overall.nps);
    var eoyv = partner.eoyOverall ? npsVerdict(partner.eoyOverall.nps) : null;
    domains.push({
      label: 'Partner Satisfaction', metric: (partner.overall.nps===null?'N/A':(partner.overall.nps>0?'+':'')+partner.overall.nps) + ' NPS (Q)' + (partner.eoyOverall ? ' / ' + (partner.eoyOverall.nps>0?'+':'')+partner.eoyOverall.nps + ' (EOY)' : ''),
      flag: qv.flag,
      text: 'District and school partners rate NJTC ' + qv.label + ' this cycle (n=' + partner.n + ' quarterly' + (partner.eoyN ? ', n=' + partner.eoyN + ' EOY' : '') + ').' +
        (partner.negatives.worstDistricts.length ? ' ' + partner.negatives.worstDistricts.map(function(d){return d.name;}).join(' and ') + ' scored notably lower and should be reviewed directly.' : '')
    });

    var grewV = pctVsGoalVerdict(onsite.grewProfessionallyPct, 80);
    var diffV = pctVsGoalVerdict(onsite.madeDifferencePct, 80);
    domains.push({
      label: 'Onsite Staff Experience', metric: (onsite.grewProfessionallyPct===null?'N/A':onsite.grewProfessionallyPct+'%') + ' grew professionally / ' + (onsite.madeDifferencePct===null?'N/A':onsite.madeDifferencePct+'%') + ' made a difference',
      flag: (grewV.flag==='concern'||diffV.flag==='concern') ? 'concern' : (grewV.flag==='watch'||diffV.flag==='watch') ? 'watch' : 'good',
      text: 'Staff professional growth is ' + grewV.label + ', and sense of impact is ' + diffV.label + ' (n=' + onsite.n + ').' +
        (onsite.negatives.worstRoles.length ? ' ' + onsite.negatives.worstRoles.map(function(r){return r.name;}).join(' and ') + ' report lower satisfaction and may need direct check-ins.' : '')
    });

    var mv = npsVerdict(scholar.mathNPS.nps), lv = npsVerdict(scholar.litNPS.nps);
    domains.push({
      label: 'Scholar Confidence', metric: (scholar.mathNPS.nps===null?'N/A':(scholar.mathNPS.nps>0?'+':'')+scholar.mathNPS.nps) + ' Math / ' + (scholar.litNPS.nps===null?'N/A':(scholar.litNPS.nps>0?'+':'')+scholar.litNPS.nps) + ' Literacy',
      flag: (mv.flag==='concern'||lv.flag==='concern') ? 'concern' : (mv.flag==='watch'||lv.flag==='watch') ? 'watch' : 'good',
      text: 'Scholars self-report ' + mv.label + ' confidence gains in Math (n=' + scholar.mathN + ') and ' + lv.label + ' gains in Literacy (n=' + scholar.litN + ').' +
        (scholar.negatives.worstSites.length ? ' ' + scholar.negatives.worstSites.map(function(s){return s.name;}).join(', ') + ' show comparatively lower confidence gains.' : '')
    });

    var concernCount = domains.filter(function(d){ return d.flag==='concern'; }).length;
    var watchCount = domains.filter(function(d){ return d.flag==='watch'; }).length;
    var overallFlag = concernCount ? 'concern' : watchCount ? 'watch' : 'good';
    var headline = concernCount
      ? 'Overall, this was a mixed cycle: most measures are healthy, but ' + concernCount + ' area' + (concernCount>1?'s need':' needs') + ' direct leadership attention before next cycle.'
      : watchCount
      ? 'Overall, this was a solid cycle across the board, with ' + watchCount + ' area' + (watchCount>1?'s':'') + ' worth watching but nothing urgent.'
      : 'Overall, this was a strong cycle across every measure we track \u2014 goals, partners, staff, and scholars all trending well.';

    // Back-compat flat lines (still used by a couple of simple render paths)
    var lines = domains.map(function(d){ return d.label + ': ' + d.metric + '. ' + d.text; });

    return { headline: headline, overallFlag: overallFlag, domains: domains, lines: lines };
  }

  // Next steps with a clear owner attached to each — so a CEO/COS/EDP/EDO
  // reading this without anyone in the room knows who should act, not just
  // what happened.
  function buildNextSteps(partnerSec, onsiteSec, scholarSec) {
    var steps = [];
    if (partnerSec.negatives.worstDistricts.length) {
      steps.push({ owner: 'Partner Relations', text: 'Schedule a direct check-in with ' + partnerSec.negatives.worstDistricts.map(function(d){return d.name + ' (NPS ' + (d.nps>0?'+':'')+d.nps + ')';}).join(', ') + ' \u2014 lowest partner satisfaction this cycle.' });
    }
    if (partnerSec.negatives.topDissatReasons.length) {
      steps.push({ owner: 'Program Leadership', text: 'Address the top dissatisfaction driver across partner feedback: \u201C' + partnerSec.negatives.topDissatReasons[0].reason + '\u201D (' + partnerSec.negatives.topDissatReasons[0].count + ' mentions this cycle).' });
    }
    if (onsiteSec.negatives.worstRoles.length) {
      steps.push({ owner: 'People & Talent', text: 'Follow up directly with ' + onsiteSec.negatives.worstRoles.map(function(r){return r.name;}).join(', ') + ' \u2014 the lowest onsite satisfaction-NPS roles this cycle.' });
    }
    if (onsiteSec.grewProfessionallyPct !== null && onsiteSec.grewProfessionallyPct < 80) {
      steps.push({ owner: 'People & Talent', text: 'Professional growth satisfaction (' + onsiteSec.grewProfessionallyPct + '%) is below the 80% goal \u2014 review what development support onsite staff say they\u2019re missing.' });
    }
    if (scholarSec.negatives.worstSites.length) {
      steps.push({ owner: 'Program Evaluation', text: 'Review confidence outcomes at ' + scholarSec.negatives.worstSites.map(function(s){return s.name;}).join(', ') + ' with the assigned tutors/coaches \u2014 lowest scholar confidence gains this cycle.' });
    }
    steps.push({ owner: 'Data & Evaluation', text: 'Document and share what\u2019s driving the strongest districts, roles, and sites this cycle so those practices can be repeated elsewhere before the next review.' });
    return steps;
  }

  
  var _AR_ICONS = {
    grad_gold: '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',
    chartline_white: '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',
    check_gold: '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',
    bullseye_white: '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',
    trophy_white: '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',
    check_green: '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',
    warning_white: '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',
    flag_navy: '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',
    clipboard_navy: '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',
    users_white: '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',
    handshake_navy: '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'
  };
  // ══════════════════════════════════════════════════════════════════════
  //  FETCH ORCHESTRATOR — pulls all 4 live sources fresh every time
  // ══════════════════════════════════════════════════════════════════════
  function fetchText(url) {
    return fetch(url, { signal: AbortSignal.timeout(20000) }).then(function(r){
      if (!r.ok) throw new Error('HTTP ' + r.status + ' for ' + url);
      return r.text();
    }).then(function(text) {
      // Google's "publish to web" CSV endpoints occasionally serve an HTML
      // error/redirect page instead of CSV (stale publish, auth hiccup, etc).
      // Catch that here instead of silently parsing it into 0 useful rows.
      var trimmed = text.trim();
      if (trimmed.slice(0, 15).toLowerCase().indexOf('<!doctype') === 0 || trimmed.slice(0, 6).toLowerCase() === '<html>' || trimmed.slice(0,5) === '<html') {
        throw new Error('Non-CSV response from ' + url + ' (got HTML instead — the published sheet link may need to be re-published or is temporarily unavailable)');
      }
      return text;
    });
  }
  function buildAnnualReportData(cb, errCb) {
    Promise.all([
      fetchText(PARTNER_CSV_URL),
      fetchText(PARTNER_EOY_CSV_URL),
      fetchText(SCHOLAR_CSV_URL),
      fetchText(ONSITE_CSV_URL),
    ]).then(function(results) {
      var partnerRaw = parseCSVKeyed(results[0]);
      var eoyRaw = parseCSVKeyed(results[1]);
      var scholarRaw = parseCSVKeyed(results[2]);
      var onsiteParsed = parseCSVPositional(results[3]);

      var partner = partnerRaw.map(normalizePartnerRow).filter(function(r){ return (r.npsScore>=1&&r.npsScore<=5) || SAT_LEVEL_SET[r.satisfactionLevel]; });
      var eoyByEmail = {};
      eoyRaw.map(normalizeEoyRow).forEach(function(r) {
        if (!r.email) { eoyByEmail['__noemail_' + Math.random()] = r; return; }
        var existing = eoyByEmail[r.email];
        if (!existing || new Date(r.timestamp) >= new Date(existing.timestamp)) eoyByEmail[r.email] = r;
      });
      var eoy = Object.keys(eoyByEmail).map(function(k){ return eoyByEmail[k]; }).filter(function(r){ return r.npsScore>=1 && r.npsScore<=5; });
      var scholar = scholarRaw.map(normalizeScholarRow).filter(function(r){ return r.site; });
      var onsite = onsiteParsed.rows.map(function(v){ return normalizeOnsiteRow(onsiteParsed.headers, v); }).filter(function(r){ return r.role; });

      // Diagnostics: raw parsed rows vs. rows that survived filtering, per
      // source. If raw is non-zero but filtered is 0, the sheet fetched fine
      // but nothing matched the expected columns — a header/mapping problem,
      // not a "no data yet" situation. Logged to console and carried on the
      // data object so the report can flag it instead of quietly showing N/A.
      var diagnostics = {
        partnerQuarterly: { rawRows: partnerRaw.length, usableRows: partner.length, headers: partnerRaw.length ? Object.keys(partnerRaw[0]) : [] },
        partnerEoy: { rawRows: eoyRaw.length, usableRows: eoy.length, headers: eoyRaw.length ? Object.keys(eoyRaw[0]) : [] },
        scholar: { rawRows: scholarRaw.length, usableRows: scholar.length },
        onsite: { rawRows: onsiteParsed.rows.length, usableRows: onsite.length },
      };
      console.log('[AnnualReport] Source diagnostics:', diagnostics);
      Object.keys(diagnostics).forEach(function(key) {
        var d = diagnostics[key];
        if (d.rawRows > 0 && d.usableRows === 0) {
          console.warn('[AnnualReport] ' + key + ': fetched ' + d.rawRows + ' raw rows but 0 passed filtering — likely a header/column mismatch, not an empty sheet.' + (d.headers ? ' Headers seen: ' + JSON.stringify(d.headers) : ''));
        } else if (d.rawRows === 0) {
          console.warn('[AnnualReport] ' + key + ': fetch returned 0 raw rows. Sheet may be genuinely empty, or the publish link needs attention.');
        }
      });

      var partnerSec = buildPartnerSection(partner, eoy);
      var onsiteSec = buildOnsiteSection(onsite);
      var scholarSec = buildScholarSection(scholar);

      var qd = window.KPI_Q_DATA;
      var goalsNarrative = (qd && qd.activeQs && qd.activeQs.length && typeof window._buildQuarterlyNarrative === 'function')
        ? window._buildQuarterlyNarrative(qd) : null;

      var synthesis = buildSynthesis(goalsNarrative, partnerSec, onsiteSec, scholarSec);
      var nextSteps = buildNextSteps(partnerSec, onsiteSec, scholarSec);

      cb({
        generatedAt: Date.now(),
        goalsNarrative: goalsNarrative,
        partner: partnerSec, onsite: onsiteSec, scholar: scholarSec,
        synthesis: synthesis, nextSteps: nextSteps,
        diagnostics: diagnostics,
      });
    }).catch(function(err) {
      console.error('[AnnualReport] fetch failed:', err);
      if (errCb) errCb(err);
    });
  }

  function npsColorHex(nps) {
    if (nps===null||nps===undefined) return '6B7280';
    if (nps>=50) return '16A34A'; if (nps>=20) return 'D97706'; return 'DC2626';
  }
  function npsColorArr(nps) {
    if (nps===null||nps===undefined) return [107,114,128];
    if (nps>=50) return [22,163,74]; if (nps>=20) return [217,119,6]; return [220,38,38];
  }

  // ══════════════════════════════════════════════════════════════════════
  //  PDF EXPORT — 13-page report (Cover, Where We Stand, Partner x3,
  //  Onsite x2, Scholar x2, Synthesis+NextSteps, Appendix x3)
  // ══════════════════════════════════════════════════════════════════════
  function exportAnnualReportPDF() {
    function _loadJsPDF(cb) {
      if (window.jspdf && window.jspdf.jsPDF) { cb(); return; }
      var s1 = document.createElement('script');
      s1.src = 'https://unpkg.com/jspdf@2.5.1/dist/jspdf.umd.min.js';
      s1.onload = function() {
        var s2 = document.createElement('script');
        s2.src = 'https://unpkg.com/jspdf-autotable@3.8.2/dist/jspdf.plugin.autotable.min.js';
        s2.onload = cb;
        document.head.appendChild(s2);
      };
      document.head.appendChild(s1);
    }
    function _safe(s) {
      return String(s||'').replace(/\u2014/g,'-').replace(/\u2013/g,'-').replace(/\u2019/g,"'")
        .replace(/\u201C/g,'"').replace(/\u201D/g,'"').replace(/[^\x20-\x7E\xA0-\xFF]/g,'').replace(/\s+/g,' ').trim();
    }

    buildAnnualReportData(function(data) {
      _loadJsPDF(function() {
        var jsPDF = window.jspdf.jsPDF;
        var doc = new jsPDF({ orientation:'portrait', unit:'pt', format:'letter' });
        var W = doc.internal.pageSize.getWidth(), H = doc.internal.pageSize.getHeight();
        var M = 46;
        var NAVY=[27,42,74], NAVY_D=[19,32,58], GOLD=[232,168,56], WHITE=[255,255,255];
        var ICEBLUE=[238,242,249], INK=[30,41,59], MUTED=[100,116,139];
        var GREEN=[22,163,74], GREEN_BG=[234,247,238], RED=[220,38,38], RED_BG=[252,234,234];
        var AMBER=[217,119,6], AMBER_BG=[253,243,227], LINEGRID=[231,234,240];

        function fillRect(x,y,w,h,color,r){ doc.setFillColor.apply(doc,color); if(r){doc.roundedRect(x,y,w,h,r,r,'F');} else {doc.rect(x,y,w,h,'F');} }
        function circle(cx,cy,r,color){ doc.setFillColor.apply(doc,color); doc.circle(cx,cy,r,'F'); }
        function icon(name, x, y, w, h) { doc.addImage('data:image/png;base64,'+_AR_ICONS[name], 'PNG', x, y, w, h, 'aricon_'+name, 'FAST'); }
        function iconInCircle(cx,cy,d,circColor,iconName,iconScale){
          circle(cx,cy,d/2,circColor);
          var isz = d*(iconScale||0.52);
          icon(iconName, cx-isz/2, cy-isz/2, isz, isz);
        }
        function text(str,x,y,opts){
          opts=opts||{};
          doc.setFont('helvetica', opts.bold?'bold':(opts.italic?'italic':'normal'));
          doc.setFontSize(opts.size||10);
          doc.setTextColor.apply(doc, opts.color||INK);
          var o = {}; if (opts.align) o.align = opts.align;
          doc.setCharSpace(opts.charSpace||0);
          doc.text(_safe(str), x, y, o);
          doc.setCharSpace(0);
        }
        function paragraph(str,x,y,maxW,opts){
          opts=opts||{};
          doc.setFont('helvetica', opts.bold?'bold':'normal');
          doc.setFontSize(opts.size||10);
          doc.setTextColor.apply(doc, opts.color||INK);
          var lines = doc.splitTextToSize(_safe(str), maxW);
          doc.text(lines, x, y, {lineHeightFactor: opts.lineHeightFactor||1.35});
          return y + lines.length * (opts.size||10) * (opts.lineHeightFactor||1.35);
        }
        function drawArc(cx, cy, r, startDeg, endDeg, color, lineWidth) {
          var steps = Math.max(2, Math.ceil(Math.abs(endDeg-startDeg)/3));
          doc.setDrawColor.apply(doc, color); doc.setLineWidth(lineWidth);
          try { doc.setLineCap(1); } catch(e){}
          for (var i=0;i<steps;i++){
            var a1 = (startDeg + (endDeg-startDeg)*i/steps - 90) * Math.PI/180;
            var a2 = (startDeg + (endDeg-startDeg)*(i+1)/steps - 90) * Math.PI/180;
            doc.line(cx+r*Math.cos(a1), cy+r*Math.sin(a1), cx+r*Math.cos(a2), cy+r*Math.sin(a2));
          }
        }
        function pctGaugeRing(cx, cy, r, pct, color, trackColor, lw){
          drawArc(cx,cy,r,0,360,trackColor,lw);
          if (pct>0) drawArc(cx,cy,r,0,Math.min(360,pct*3.6),color,lw);
        }
        function pageHeader(title, subtitle, iconName, circColor) {
          iconInCircle(M+22, 56, 44, circColor, iconName);
          text(title, M+56, 52, {size:19, bold:true, color:NAVY});
          if (subtitle) text(subtitle, M+56, 68, {size:9.5, color:MUTED});
        }

        var partnerSec = data.partner, onsiteSec = data.onsite, scholarSec = data.scholar;
        var goalsNarrative = data.goalsNarrative, synthesis = data.synthesis;
        var tsStr = new Date(data.generatedAt).toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'});
        var y;

        // PAGE 1 — COVER
        fillRect(0,0,W,H,NAVY);
        circle(W+40, -60, 210, NAVY_D); circle(W+10, 20, 150, [31,49,89]);
        icon('grad_gold', M, 44, 26, 26);
        text('NEW JERSEY TUTORING CORPS', M+34, 63, {size:11.5, bold:true, color:GOLD, charSpace:1.6});
        text('Annual Impact &', M, 148, {size:28, bold:true, color:WHITE});
        text('Satisfaction Report', M, 182, {size:28, bold:true, color:WHITE});
        text('Goals \u00B7 Partner Satisfaction \u00B7 Onsite Staff \u00B7 Scholar Feedback', M, 208, {size:13, color:GOLD});
        text('Generated ' + tsStr + '   \u00B7   Confidential \u2014 Internal Use Only', M, 228, {size:9.5, color:[170,180,200]});
        var covStats = [
          {label:'Goal Health', val:(goalsNarrative?goalsNarrative.latestSC.score+'%':'N/A'), icon:'chartline_white'},
          {label:'Partner NPS', val:(partnerSec.overall.nps===null?'N/A':(partnerSec.overall.nps>0?'+':'')+partnerSec.overall.nps), icon:'handshake_navy'},
          {label:'Onsite Staff n', val:String(onsiteSec.n), icon:'users_white'},
          {label:'Scholar Voices n', val:String(scholarSec.n), icon:'grad_white'},
        ];
        covStats.forEach(function(t,i){
          var col=i%2, row=Math.floor(i/2), tx=M+col*185, ty=280+row*70;
          fillRect(tx, ty, 165, 56, [31,49,89], 8);
          text(t.val, tx+14, ty+34, {size:22, bold:true, color:WHITE});
          text(t.label.toUpperCase(), tx+14, ty+48, {size:7.5, color:[170,180,200], charSpace:0.6});
        });
        text('Prepared by the Data & Evaluation Department', M, H-40, {size:9, italic:true, color:[130,142,168]});

        // PAGE 2 — WHERE WE STAND
        doc.addPage(); fillRect(0,0,W,H,WHITE);
        pageHeader('Where We Stand', 'Executive summary \u2014 what the data means, not just what it says', 'chartline_white', NAVY);
        y = 96;
        var verdictColor = synthesis.overallFlag==='good'?GREEN:synthesis.overallFlag==='watch'?AMBER:RED;
        var verdictBg = synthesis.overallFlag==='good'?GREEN_BG:synthesis.overallFlag==='watch'?AMBER_BG:RED_BG;
        fillRect(M, y, W-2*M, 46, verdictBg, 8);
        paragraph(synthesis.headline, M+16, y+18, W-2*M-32, {size:10, bold:true, color:verdictColor, lineHeightFactor:1.3});
        y += 60;

        synthesis.domains.forEach(function(d) {
          var dColor = d.flag==='good'?GREEN:d.flag==='watch'?AMBER:d.flag==='concern'?RED:MUTED;
          var rowH = doc.splitTextToSize(_safe(d.text), W-2*M-190).length * 8.5 * 1.3 + 26;
          fillRect(M, y, 5, rowH, dColor);
          fillRect(M+5, y, W-2*M-5, rowH, [251,252,253]);
          text(d.label, M+16, y+16, {size:9.5, bold:true, color:NAVY});
          doc.setFont('helvetica','bold'); doc.setFontSize(9.5); doc.setTextColor.apply(doc,dColor);
          doc.text(d.metric, W-M-12, y+16, {align:'right'});
          paragraph(d.text, M+16, y+29, W-2*M-28, {size:8.25, color:INK, lineHeightFactor:1.3});
          y += rowH + 8;
        });

        y += 6;
        text('Annual Goal Progress', M, y, {size:11.5, bold:true, color:NAVY}); y += 6;
        text('Full detail lives in the standalone Quarterly Goal Summary report.', M, y+10, {size:8, italic:true, color:MUTED});
        y += 20;
        if (goalsNarrative) {
          var goalTiles = [
            {label:'Health Score', val: goalsNarrative.latestSC.score+'%', color: npsColorArr(goalsNarrative.latestSC.score>=65?50:goalsNarrative.latestSC.score>=40?10:-10)},
            {label:'Targets Met', val: String(goalsNarrative.latestSC.counts.met), color: GREEN},
            {label:'Not Met', val: String(goalsNarrative.latestSC.counts.notmet), color: RED},
          ];
          goalTiles.forEach(function(t,i){
            var tx = M + i*170;
            fillRect(tx, y, 155, 48, [247,249,252], 6);
            text(t.val, tx+14, y+30, {size:19, bold:true, color:t.color});
            text(t.label, tx+14, y+42, {size:8, color:MUTED});
          });
          y += 60;
        } else {
          text('Quarterly goal data not loaded in this session.', M, y, {size:9, italic:true, color:MUTED}); y += 24;
        }

        // PAGE 3 — PARTNER OVERVIEW
        doc.addPage(); fillRect(0,0,W,H,WHITE);
        pageHeader('Partner Satisfaction', 'District & school partner voice \u2014 Quarterly + End-of-Year surveys', 'handshake_navy', NAVY);
        y = 96;
        if (data.diagnostics && data.diagnostics.partnerQuarterly.rawRows === 0) {
          fillRect(M, y, W-2*M, 44, [253,230,138], 5);
          paragraph('\u26A0 Live fetch for the Quarterly Partner Survey returned 0 rows this generation \u2014 this section is likely incomplete. Re-run the report, and check the browser console for details if it persists.', M+10, y+16, W-2*M-20, {size:8, bold:true, color:[120,53,15], lineHeightFactor:1.3});
          y += 56;
        }
        fillRect(M, y, 170, 130, ICEBLUE, 8);
        text('n = ' + partnerSec.n, M+16, y+28, {size:16, bold:true, color:NAVY});
        text('Quarterly Respondents', M+16, y+44, {size:8.5, color:MUTED});
        text('n = ' + partnerSec.eoyN, M+16, y+72, {size:16, bold:true, color:NAVY});
        text('EOY Respondents', M+16, y+88, {size:8.5, color:MUTED});
        var gx = M+260, gy = y+65, gr=55;
        pctGaugeRing(gx, gy, gr, Math.max(0,((partnerSec.overall.nps||0)+100)/2), npsColorArr(partnerSec.overall.nps), [232,236,242], 12);
        doc.setFont('helvetica','bold'); doc.setFontSize(18); doc.setTextColor.apply(doc,npsColorArr(partnerSec.overall.nps));
        doc.text((partnerSec.overall.nps===null?'N/A':(partnerSec.overall.nps>0?'+':'')+partnerSec.overall.nps), gx, gy+6, {align:'center'});
        doc.setFont('helvetica','normal'); doc.setFontSize(7.5); doc.setTextColor.apply(doc,MUTED);
        doc.text('QUARTERLY NPS', gx, gy+20, {align:'center'});
        if (partnerSec.eoyOverall) {
          var gx2 = M+420;
          pctGaugeRing(gx2, gy, gr, Math.max(0,(partnerSec.eoyOverall.nps+100)/2), npsColorArr(partnerSec.eoyOverall.nps), [232,236,242], 12);
          doc.setFont('helvetica','bold'); doc.setFontSize(18); doc.setTextColor.apply(doc,npsColorArr(partnerSec.eoyOverall.nps));
          doc.text((partnerSec.eoyOverall.nps>0?'+':'')+partnerSec.eoyOverall.nps, gx2, gy+6, {align:'center'});
          doc.setFont('helvetica','normal'); doc.setFontSize(7.5); doc.setTextColor.apply(doc,MUTED);
          doc.text('EOY NPS', gx2, gy+20, {align:'center'});
        }
        y += 150;
        text('Biggest Contributors \u2014 Respondents by District', M, y, {size:12, bold:true, color:NAVY}); y += 16;
        if (partnerSec.biggestContributors.length) {
          var maxN = Math.max.apply(null, partnerSec.biggestContributors.map(function(c){return c.n;}));
          var barTrackW1 = W-2*M-190-120;
          partnerSec.biggestContributors.forEach(function(c){
            paragraph(c.name, M, y+11, 170, {size:8.75, color:INK, lineHeightFactor:1.1});
            var barW = barTrackW1 * (c.n/maxN);
            fillRect(M+190, y, barTrackW1, 16, [240,242,246], 3);
            fillRect(M+190, y, barW, 16, NAVY, 3);
            text(String(c.n), M+190+barTrackW1+6, y+12, {size:8.5, bold:true, color:INK});
            doc.setFont('helvetica','bold'); doc.setFontSize(8.5); doc.setTextColor.apply(doc,npsColorArr(c.nps));
            doc.text('NPS ' + (c.nps===null?'N/A':(c.nps>0?'+':'')+c.nps), W-M, y+12, {align:'right'});
            y += 24;
          });
        }

        // PAGE 4 — PARTNER POSITIVES
        doc.addPage(); fillRect(0,0,W,H,WHITE);
        pageHeader('Partner Satisfaction \u2014 What\u2019s Working', 'Highest-performing districts and direct partner feedback', 'check_green', GREEN);
        y = 96;
        text('Top-Performing Districts (3+ respondents)', M, y, {size:11.5, bold:true, color:NAVY}); y += 16;
        partnerSec.positives.bestDistricts.forEach(function(d){
          fillRect(M, y, W-2*M, 34, GREEN_BG, 6);
          text(d.name + '   (n=' + d.n + ')', M+14, y+21, {size:10, bold:true, color:INK});
          doc.setFont('helvetica','bold'); doc.setFontSize(11); doc.setTextColor.apply(doc,GREEN);
          doc.text('NPS ' + (d.nps>0?'+':'')+d.nps, W-M-14, y+21, {align:'right'});
          y += 42;
        });
        y += 12;
        text('Direct Feedback \u2014 Partner Comments', M, y, {size:11.5, bold:true, color:NAVY}); y += 6;
        text('Verbatim highlight comments submitted this cycle (unedited):', M, y+10, {size:8.5, italic:true, color:MUTED}); y += 24;
        partnerSec.positives.highlightComments.slice(0,5).forEach(function(c){
          var textH = doc.splitTextToSize(_safe('\u201C'+c.text+'\u201D'), W-2*M-28).length * 9 * 1.3 + 16;
          fillRect(M, y, W-2*M, textH, [252,253,254], 5);
          var ny2 = paragraph('\u201C'+c.text+'\u201D', M+14, y+16, W-2*M-28, {size:9, italic:true, color:INK, lineHeightFactor:1.3});
          text('\u2014 ' + c.district, M+14, ny2+2, {size:7.5, color:MUTED});
          y += textH + 10;
        });

        // PAGE 5 — PARTNER NEGATIVES
        doc.addPage(); fillRect(0,0,W,H,WHITE);
        pageHeader('Partner Satisfaction \u2014 Needs Attention', 'Lowest-performing districts and dissatisfaction themes', 'warning_white', RED);
        y = 96;
        text('Lowest-Performing Districts (3+ respondents)', M, y, {size:11.5, bold:true, color:NAVY}); y += 16;
        if (partnerSec.negatives.worstDistricts.length) {
          partnerSec.negatives.worstDistricts.forEach(function(d){
            fillRect(M, y, W-2*M, 34, RED_BG, 6);
            text(d.name + '   (n=' + d.n + ')', M+14, y+21, {size:10, bold:true, color:INK});
            doc.setFont('helvetica','bold'); doc.setFontSize(11); doc.setTextColor.apply(doc, d.nps<20?RED:AMBER);
            doc.text('NPS ' + (d.nps>0?'+':'')+d.nps, W-M-14, y+21, {align:'right'});
            y += 42;
          });
        } else {
          text('No district fell below the concern threshold this cycle \u2014 full breakdown below.', M, y, {size:9, italic:true, color:MUTED}); y += 18;
          Object.keys(partnerSec.byDistrict).filter(function(k){ return partnerSec.byDistrict[k].n>=3; })
            .sort(function(a,b){ var na=partnerSec.byDistrict[a].nps, nb=partnerSec.byDistrict[b].nps; return (na===null?999:na)-(nb===null?999:nb); })
            .forEach(function(k){
              var d = partnerSec.byDistrict[k];
              fillRect(M, y, W-2*M, 26, [252,253,254]);
              doc.setDrawColor.apply(doc,LINEGRID); doc.setLineWidth(0.5); doc.line(M,y+26,W-M,y+26);
              text(k + '  (n=' + d.n + ')', M+8, y+17, {size:9, color:INK});
              doc.setFont('helvetica','bold'); doc.setFontSize(9.5); doc.setTextColor.apply(doc,npsColorArr(d.nps));
              doc.text('NPS ' + (d.nps>0?'+':'')+d.nps, W-M-8, y+17, {align:'right'});
              y += 26;
            });
          y += 8;
        }
        y += 12;
        if (partnerSec.negatives.topDissatReasons.length) {
          text('Dissatisfaction Reasons \u2014 Frequency', M, y, {size:11.5, bold:true, color:NAVY}); y += 18;
          var maxD = Math.max.apply(null, partnerSec.negatives.topDissatReasons.map(function(r){return r.count;}));
          partnerSec.negatives.topDissatReasons.forEach(function(r){
            paragraph(r.reason, M, y+11, 200, {size:8.75, color:INK});
            var barW = (W-2*M-220) * (r.count/maxD);
            fillRect(M+220, y, barW, 16, RED, 3);
            text(String(r.count), M+220+barW+6, y+12, {size:8.5, bold:true, color:INK});
            y += 24;
          });
        } else {
          text('No dissatisfaction reasons recorded this cycle.', M, y, {size:9.5, color:MUTED, italic:true});
        }

        
        // PAGE 6 — ONSITE OVERVIEW
        doc.addPage(); fillRect(0,0,W,H,WHITE);
        pageHeader('Onsite Staff Feedback', 'Site Coordinators, Coaches, Dual-Role staff, and Tutors', 'users_white', NAVY);
        y = 96;
        fillRect(M, y, 170, 90, ICEBLUE, 8);
        text('n = ' + onsiteSec.n, M+16, y+30, {size:18, bold:true, color:NAVY});
        text('Onsite Staff Respondents', M+16, y+48, {size:8.5, color:MUTED});
        var goalCards = [
          {label:'% Grew Professionally', pct: onsiteSec.grewProfessionallyPct, n: onsiteSec.grewProfessionallyN, target: 80},
          {label:'% Made a Difference', pct: onsiteSec.madeDifferencePct, n: onsiteSec.madeDifferenceN, target: 80},
        ];
        goalCards.forEach(function(g,i){
          var gx3 = M + 200 + i*185;
          var met = g.pct!==null && g.pct>=g.target;
          fillRect(gx3, y, 170, 90, met?GREEN_BG:AMBER_BG, 8);
          doc.setFont('helvetica','bold'); doc.setFontSize(22); doc.setTextColor.apply(doc, met?GREEN:AMBER);
          doc.text((g.pct===null?'N/A':g.pct+'%'), gx3+14, y+38);
          paragraph(g.label, gx3+14, y+54, 145, {size:8, color:INK});
          text('n=' + g.n + '  ·  Goal: ' + g.target + '%' + (met?'  ✓':''), gx3+14, y+80, {size:7.5, color:MUTED});
        });
        y += 112;
        text('Biggest Contributors — Respondents by Role', M, y, {size:12, bold:true, color:NAVY}); y += 16;
        if (onsiteSec.biggestContributors.length) {
          var maxNRole = Math.max.apply(null, onsiteSec.biggestContributors.map(function(c){return c.n;}));
          var barTrackW2 = W-2*M-170-130;
          onsiteSec.biggestContributors.forEach(function(c){
            paragraph(c.name, M, y+11, 150, {size:8.75, color:INK});
            var barW = barTrackW2 * (c.n/maxNRole);
            fillRect(M+170, y, barTrackW2, 16, [240,242,246], 3);
            fillRect(M+170, y, barW, 16, NAVY, 3);
            text(String(c.n), M+170+barTrackW2+6, y+12, {size:8.5, bold:true, color:INK});
            doc.setFont('helvetica','bold'); doc.setFontSize(8.5); doc.setTextColor.apply(doc,npsColorArr(c.nps));
            doc.text('Sat-NPS ' + (c.nps===null?'N/A':(c.nps>0?'+':'')+c.nps), W-M, y+12, {align:'right'});
            y += 24;
          });
        }
        y += 12;
        text('By Region', M, y, {size:11.5, bold:true, color:NAVY}); y += 14;
        Object.keys(onsiteSec.byRegion).forEach(function(region){
          var d = onsiteSec.byRegion[region];
          fillRect(M, y, W-2*M, 24, [252,253,254]);
          doc.setDrawColor.apply(doc,LINEGRID); doc.setLineWidth(0.5); doc.line(M,y+24,W-M,y+24);
          text(region + ' Region', M+8, y+16, {size:9, color:INK});
          text('n=' + d.n, M+280, y+16, {size:8.5, color:MUTED});
          doc.setFont('helvetica','bold'); doc.setFontSize(9.5); doc.setTextColor.apply(doc,npsColorArr(d.nps));
          doc.text('Sat-NPS ' + (d.nps===null?'N/A':(d.nps>0?'+':'')+d.nps), W-M-8, y+16, {align:'right'});
          y += 24;
        });

        // PAGE 7 — ONSITE POSITIVES/NEGATIVES
        doc.addPage(); fillRect(0,0,W,H,WHITE);
        pageHeader('Onsite Staff Feedback — By Role', 'Highest and lowest satisfaction-NPS roles', 'users_white', NAVY);
        y = 96;
        text('Strongest Roles', M, y, {size:11.5, bold:true, color:GREEN}); y += 16;
        onsiteSec.positives.bestRoles.forEach(function(r){
          fillRect(M, y, W-2*M, 34, GREEN_BG, 6);
          text(r.name + '   (n=' + r.n + ')', M+14, y+21, {size:10, bold:true, color:INK});
          doc.setFont('helvetica','bold'); doc.setFontSize(11); doc.setTextColor.apply(doc,GREEN);
          doc.text('Sat-NPS ' + (r.nps>0?'+':'')+r.nps, W-M-14, y+21, {align:'right'});
          y += 42;
        });
        y += 16;
        text('Roles Needing Support', M, y, {size:11.5, bold:true, color:RED}); y += 16;
        if (onsiteSec.negatives.worstRoles.length) {
          onsiteSec.negatives.worstRoles.forEach(function(r){
            fillRect(M, y, W-2*M, 34, r.nps<20?RED_BG:AMBER_BG, 6);
            text(r.name + '   (n=' + r.n + ')', M+14, y+21, {size:10, bold:true, color:INK});
            doc.setFont('helvetica','bold'); doc.setFontSize(11); doc.setTextColor.apply(doc, r.nps<20?RED:AMBER);
            doc.text('Sat-NPS ' + (r.nps>0?'+':'')+r.nps, W-M-14, y+21, {align:'right'});
            y += 42;
          });
        } else {
          text('No role fell below the concern threshold this cycle \u2014 full breakdown below.', M, y, {size:9, italic:true, color:MUTED}); y += 18;
          Object.keys(onsiteSec.byRole).filter(function(k){ return onsiteSec.byRole[k].n>=3; })
            .sort(function(a,b){ var na=onsiteSec.byRole[a].nps, nb=onsiteSec.byRole[b].nps; return (na===null?999:na)-(nb===null?999:nb); })
            .forEach(function(k){
              var r = onsiteSec.byRole[k];
              fillRect(M, y, W-2*M, 26, [252,253,254]);
              doc.setDrawColor.apply(doc,LINEGRID); doc.setLineWidth(0.5); doc.line(M,y+26,W-M,y+26);
              text(k + '  (n=' + r.n + ')', M+8, y+17, {size:9, color:INK});
              doc.setFont('helvetica','bold'); doc.setFontSize(9.5); doc.setTextColor.apply(doc,npsColorArr(r.nps));
              doc.text('Sat-NPS ' + (r.nps>0?'+':'')+r.nps, W-M-8, y+17, {align:'right'});
              y += 26;
            });
        }

        // PAGE 8 — SCHOLAR OVERVIEW
        doc.addPage(); fillRect(0,0,W,H,WHITE);
        pageHeader('Scholar Feedback', 'Self-reported confidence — Math & Literacy', 'grad_gold', GOLD);
        y = 96;
        fillRect(M, y, 140, 90, ICEBLUE, 8);
        text('n = ' + scholarSec.n, M+14, y+30, {size:16, bold:true, color:NAVY});
        text('Total Respondents', M+14, y+48, {size:8, color:MUTED});
        var sgx = M+200, sgy = y+60, sgr=50;
        pctGaugeRing(sgx, sgy, sgr, Math.max(0,((scholarSec.mathNPS.nps||0)+100)/2), npsColorArr(scholarSec.mathNPS.nps), [232,236,242], 11);
        doc.setFont('helvetica','bold'); doc.setFontSize(16); doc.setTextColor.apply(doc,npsColorArr(scholarSec.mathNPS.nps));
        doc.text((scholarSec.mathNPS.nps===null?'N/A':(scholarSec.mathNPS.nps>0?'+':'')+scholarSec.mathNPS.nps), sgx, sgy+5, {align:'center'});
        doc.setFont('helvetica','normal'); doc.setFontSize(7); doc.setTextColor.apply(doc,MUTED);
        doc.text('MATH n='+scholarSec.mathN, sgx, sgy+19, {align:'center'});
        var sgx2 = M+360;
        pctGaugeRing(sgx2, sgy, sgr, Math.max(0,((scholarSec.litNPS.nps||0)+100)/2), npsColorArr(scholarSec.litNPS.nps), [232,236,242], 11);
        doc.setFont('helvetica','bold'); doc.setFontSize(16); doc.setTextColor.apply(doc,npsColorArr(scholarSec.litNPS.nps));
        doc.text((scholarSec.litNPS.nps===null?'N/A':(scholarSec.litNPS.nps>0?'+':'')+scholarSec.litNPS.nps), sgx2, sgy+5, {align:'center'});
        doc.setFont('helvetica','normal'); doc.setFontSize(7); doc.setTextColor.apply(doc,MUTED);
        doc.text('LITERACY n='+scholarSec.litN, sgx2, sgy+19, {align:'center'});
        y += 140;
        text('Biggest Contributors — Respondents by Site', M, y, {size:12, bold:true, color:NAVY}); y+=16;
        if (scholarSec.biggestContributors.length) {
          var maxNSite = Math.max.apply(null, scholarSec.biggestContributors.map(function(c){return c.n;}));
          var barTrackW3 = W-2*M-260-50;
          scholarSec.biggestContributors.forEach(function(c){
            paragraph(c.name, M, y+11, 240, {size:8.25, color:INK, lineHeightFactor:1.1});
            var barW = barTrackW3 * (c.n/maxNSite);
            fillRect(M+260, y, barTrackW3, 16, [240,242,246], 3);
            fillRect(M+260, y, barW, 16, GOLD, 3);
            text(String(c.n), M+260+barTrackW3+6, y+12, {size:8.5, bold:true, color:INK});
            y += 24;
          });
        }
        y += 12;
        text('By Region', M, y, {size:11.5, bold:true, color:NAVY}); y+=14;
        Object.keys(scholarSec.byRegion).forEach(function(region){
          var d = scholarSec.byRegion[region];
          fillRect(M, y, W-2*M, 24, [252,253,254]);
          doc.setDrawColor.apply(doc,LINEGRID); doc.setLineWidth(0.5); doc.line(M,y+24,W-M,y+24);
          text(region+' Region', M+8, y+16, {size:9, color:INK});
          text('n='+d.n, M+200, y+16, {size:8.5, color:MUTED});
          doc.setFont('helvetica','bold'); doc.setFontSize(9); doc.setTextColor.apply(doc,npsColorArr(d.mathNPS));
          doc.text('Math '+(d.mathNPS===null?'N/A':(d.mathNPS>0?'+':'')+d.mathNPS), M+320, y+16);
          doc.setTextColor.apply(doc,npsColorArr(d.litNPS));
          doc.text('Lit '+(d.litNPS===null?'N/A':(d.litNPS>0?'+':'')+d.litNPS), W-M-8, y+16, {align:'right'});
          y += 24;
        });

        // PAGE 9 — SCHOLAR POSITIVES/NEGATIVES
        doc.addPage(); fillRect(0,0,W,H,WHITE);
        pageHeader('Scholar Feedback — By Site', 'Highest and lowest confidence sites (3+ respondents, both subjects)', 'grad_gold', GOLD);
        y = 96;
        text('Strongest Sites', M, y, {size:11.5, bold:true, color:GREEN}); y+=16;
        scholarSec.positives.bestSites.forEach(function(s){
          fillRect(M, y, W-2*M, 34, GREEN_BG, 6);
          paragraph(s.name + '  (n=' + s.n + ')', M+14, y+15, 300, {size:9, bold:true, color:INK, lineHeightFactor:1.1});
          doc.setFont('helvetica','bold'); doc.setFontSize(9.5); doc.setTextColor.apply(doc,GREEN);
          doc.text('Math '+(s.mathNPS>0?'+':'')+s.mathNPS+'  ·  Lit '+(s.litNPS>0?'+':'')+s.litNPS, W-M-14, y+21, {align:'right'});
          y += 42;
        });
        y += 16;
        text('Sites Needing Support', M, y, {size:11.5, bold:true, color:RED}); y+=16;
        if (scholarSec.negatives.worstSites.length) {
          scholarSec.negatives.worstSites.forEach(function(s){
            fillRect(M, y, W-2*M, 34, AMBER_BG, 6);
            paragraph(s.name + '  (n=' + s.n + ')', M+14, y+15, 300, {size:9, bold:true, color:INK, lineHeightFactor:1.1});
            doc.setFont('helvetica','bold'); doc.setFontSize(9.5); doc.setTextColor.apply(doc,AMBER);
            doc.text('Math '+(s.mathNPS>0?'+':'')+s.mathNPS+'  \u00B7  Lit '+(s.litNPS>0?'+':'')+s.litNPS, W-M-14, y+21, {align:'right'});
            y += 42;
          });
        } else {
          text('No site fell below the concern threshold this cycle \u2014 full breakdown below (top 10 by combined score).', M, y, {size:9, italic:true, color:MUTED}); y += 18;
          var scholarSiteKeys = Object.keys(scholarSec.bySite).filter(function(k){ var d=scholarSec.bySite[k]; return d.mathN>=3 && d.litN>=3; });
          scholarSiteKeys.sort(function(a,b){
            var da=scholarSec.bySite[a], db=scholarSec.bySite[b];
            var avgA=((da.mathNPS||0)+(da.litNPS||0))/2, avgB=((db.mathNPS||0)+(db.litNPS||0))/2;
            return avgA-avgB;
          });
          scholarSiteKeys.slice(0,10).forEach(function(k){
            var d = scholarSec.bySite[k];
            fillRect(M, y, W-2*M, 26, [252,253,254]);
            doc.setDrawColor.apply(doc,LINEGRID); doc.setLineWidth(0.5); doc.line(M,y+26,W-M,y+26);
            paragraph(k + '  (n=' + d.n + ')', M+8, y+17, 340, {size:8.5, color:INK});
            doc.setFont('helvetica','bold'); doc.setFontSize(9); doc.setTextColor.apply(doc,NAVY);
            doc.text('Math '+(d.mathNPS===null?'N/A':(d.mathNPS>0?'+':'')+d.mathNPS)+'  \u00B7  Lit '+(d.litNPS===null?'N/A':(d.litNPS>0?'+':'')+d.litNPS), W-M-8, y+17, {align:'right'});
            y += 26;
          });
          if (scholarSiteKeys.length > 10) { text('+ ' + (scholarSiteKeys.length-10) + ' more \u2014 see Appendix C for the full list.', M, y+10, {size:8, italic:true, color:MUTED}); y += 20; }
        }

        // PAGE 10 — SYNTHESIS + NEXT STEPS (dark closing)
        doc.addPage(); fillRect(0,0,W,H,NAVY);
        circle(-40, H-90, 170, NAVY_D);
        iconInCircle(M+22, 56, 44, GOLD, 'flag_navy');
        text('What the Data Is Telling Us', M+56, 52, {size:19, bold:true, color:WHITE});
        text('Cross-cutting synthesis across goals and all three surveys', M+56, 68, {size:9.5, color:[170,180,200]});
        y = 104;
        synthesis.domains.forEach(function(d, i){
          circle(M+13, y+13, 13, GOLD);
          doc.setFont('helvetica','bold'); doc.setFontSize(12); doc.setTextColor.apply(doc,NAVY);
          doc.text(String(i+1), M+13, y+17, {align:'center'});
          y = paragraph(d.label + ' \u2014 ' + d.text, M+40, y+8, W-2*M-40, {size:10, color:WHITE, lineHeightFactor:1.3}) + 12;
        });
        y += 10;
        text('Recommended Next Steps', M, y, {size:14, bold:true, color:GOLD}); y += 22;
        data.nextSteps.forEach(function(step, i){
          doc.setFillColor.apply(doc, [232,168,56]); doc.roundedRect(M, y-11, 88, 16, 3, 3, 'F');
          doc.setFont('helvetica','bold'); doc.setFontSize(7); doc.setTextColor.apply(doc, NAVY);
          doc.text(step.owner.toUpperCase(), M+44, y, {align:'center'});
          y = paragraph(step.text, M+98, y-4, W-2*M-98, {size:9.5, color:WHITE, lineHeightFactor:1.3}) + 14;
        });

        // APPENDIX A/B/C
        doc.addPage(); fillRect(0,0,W,42,NAVY);
        text('Appendix A — Partner Satisfaction by District', M, 27, {size:12, bold:true, color:WHITE});
        var apRows1 = Object.keys(partnerSec.byDistrict).map(function(k){ return [k, partnerSec.byDistrict[k]]; }).sort(function(a,b){return b[1].n-a[1].n;}).map(function(e){
          return [e[0], String(e[1].n), (e[1].nps===null?'N/A':(e[1].nps>0?'+':'')+e[1].nps), e[1].promoterPct+'%', e[1].detractorPct+'%'];
        });
        doc.autoTable({ startY:58, head:[['District','n','NPS','% Promoters','% Detractors']], body:apRows1, theme:'grid',
          headStyles:{fillColor:NAVY,textColor:WHITE,fontSize:8,fontStyle:'bold'}, bodyStyles:{fontSize:7.5,textColor:INK}, margin:{left:M,right:M} });

        doc.addPage(); fillRect(0,0,W,42,NAVY);
        text('Appendix B — Onsite Staff by Role', M, 27, {size:12, bold:true, color:WHITE});
        var apRows2 = Object.keys(onsiteSec.byRole).map(function(k){ return [k, onsiteSec.byRole[k]]; }).sort(function(a,b){return b[1].n-a[1].n;}).map(function(e){
          return [e[0], String(e[1].n), (e[1].nps===null?'N/A':(e[1].nps>0?'+':'')+e[1].nps), (e[1].grewPct===null?'N/A':e[1].grewPct+'%'), (e[1].diffPct===null?'N/A':e[1].diffPct+'%')];
        });
        doc.autoTable({ startY:58, head:[['Role','n','Sat-NPS','% Grew Professionally','% Made a Difference']], body:apRows2, theme:'grid',
          headStyles:{fillColor:NAVY,textColor:WHITE,fontSize:8,fontStyle:'bold'}, bodyStyles:{fontSize:7.5,textColor:INK}, margin:{left:M,right:M} });

        doc.addPage(); fillRect(0,0,W,42,NAVY);
        text('Appendix C — Scholar Feedback by Site', M, 27, {size:12, bold:true, color:WHITE});
        var apRows3 = Object.keys(scholarSec.bySite).map(function(k){ return [k, scholarSec.bySite[k]]; }).sort(function(a,b){return b[1].n-a[1].n;}).map(function(e){
          return [e[0].slice(0,60), String(e[1].n), (e[1].mathNPS===null?'N/A':(e[1].mathNPS>0?'+':'')+e[1].mathNPS), (e[1].litNPS===null?'N/A':(e[1].litNPS>0?'+':'')+e[1].litNPS)];
        });
        doc.autoTable({ startY:58, head:[['Site','n','Math Confidence NPS','Literacy Confidence NPS']], body:apRows3, theme:'grid',
          headStyles:{fillColor:NAVY,textColor:WHITE,fontSize:8,fontStyle:'bold'}, bodyStyles:{fontSize:7,textColor:INK}, margin:{left:M,right:M} });

        footer_annualPdf();

        function footer_annualPdf() {
          var pageCount = doc.internal.getNumberOfPages();
          for (var pg=1; pg<=pageCount; pg++){
            doc.setPage(pg);
            fillRect(0,H-26,W,26,NAVY);
            text('New Jersey Tutoring Corps  \u00B7  Annual Impact & Satisfaction Report  \u00B7  Confidential', M, H-10, {size:7, color:WHITE});
            doc.setFont('helvetica','normal'); doc.setFontSize(7); doc.setTextColor.apply(doc,WHITE);
            doc.text('Page '+pg+' of '+pageCount, W-M, H-10, {align:'right'});
          }
        }

        var blob = doc.output('blob');
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url; a.download = 'NJTC_Annual_Impact_Satisfaction_Report.pdf';
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        setTimeout(function(){ URL.revokeObjectURL(url); }, 2000);
      });
    }, function(err) {
      alert('Failed to load survey data for the Annual Report. ' + err.message);
    });
  }

  // ══════════════════════════════════════════════════════════════════════
  //  PPTX EXPORT — mirrors the PDF story arc with native charts
  // ══════════════════════════════════════════════════════════════════════
  function exportAnnualReportPPTX() {
    function _loadPptxGen(cb) {
      if (window.PptxGenJS) { cb(); return; }
      var s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/pptxgenjs@3.12.0/dist/pptxgen.bundle.js';
      s.onload = cb; s.onerror = function(){ alert('Could not load PPTX library.'); };
      document.head.appendChild(s);
    }
    function _safe(s){ return String(s||'').replace(/[^\x20-\x7E]/g,'').replace(/\s+/g,' ').trim(); }

    buildAnnualReportData(function(data) {
      _loadPptxGen(function() {
        var pptx = new window.PptxGenJS();
        pptx.layout = 'LAYOUT_WIDE'; pptx.author='New Jersey Tutoring Corps';
        pptx.subject='Annual Impact & Satisfaction Report'; pptx.company='NJTC';
        pptx.title = 'NJTC Annual Impact & Satisfaction Report';

        var NAVY='1B2A4A', NAVY_D='13203A', GOLD='E8A838', WHITE='FFFFFF', ICEBLUE='EEF2F9';
        var GREEN='16A34A', GREEN_BG='EAF7EE', RED='DC2626', RED_BG='FCEAEA', AMBER='D97706', AMBER_BG='FDF3E3';

        var partnerSec=data.partner, onsiteSec=data.onsite, scholarSec=data.scholar;
        var goalsNarrative=data.goalsNarrative, synthesis=data.synthesis;
        var tsStr = new Date(data.generatedAt).toLocaleDateString('en-US',{month:'long',year:'numeric'});

        function icon(name){ return { data:'image/png;base64,'+_AR_ICONS[name] }; }
        function iconCircle(slide, iconName, cx, cy, d, circleColor){
          slide.addShape(pptx.shapes.OVAL,{x:cx-d/2,y:cy-d/2,w:d,h:d,fill:{color:circleColor}});
          var isz=d*0.52; slide.addImage(Object.assign(icon(iconName),{x:cx-isz/2,y:cy-isz/2,w:isz,h:isz}));
        }
        function slideHeader(slide, title, subtitle, iconName, circleColor){
          iconCircle(slide, iconName, 0.85, 0.85, 0.62, circleColor);
          slide.addText(title,{x:1.35,y:0.5,w:10,h:0.5,fontSize:24,bold:true,color:NAVY,fontFace:'Cambria',margin:0});
          if (subtitle) slide.addText(subtitle,{x:1.35,y:0.95,w:10.5,h:0.35,fontSize:10.5,color:'64748B',fontFace:'Calibri',margin:0});
        }
        function npsHex(nps){ if(nps===null||nps===undefined) return '6B7280'; if(nps>=50) return GREEN; if(nps>=20) return AMBER; return RED; }

        // SLIDE 1 — COVER
        var s1 = pptx.addSlide(); s1.background={color:NAVY};
        s1.addShape(pptx.shapes.OVAL,{x:9.6,y:-2.2,w:7,h:7,fill:{color:NAVY_D},line:{type:'none'}});
        s1.addImage(Object.assign(icon('grad_gold'),{x:0.7,y:0.55,w:0.5,h:0.5}));
        s1.addText('NEW JERSEY TUTORING CORPS',{x:1.25,y:0.55,w:8,h:0.5,fontSize:13,bold:true,color:GOLD,charSpacing:2,fontFace:'Calibri',valign:'middle'});
        s1.addText('Annual Impact & Satisfaction Report',{x:0.7,y:2.0,w:11,h:1.0,fontSize:34,bold:true,color:WHITE,fontFace:'Cambria'});
        s1.addText('Goals \u00B7 Partner Satisfaction \u00B7 Onsite Staff \u00B7 Scholar Feedback',{x:0.7,y:2.85,w:10,h:0.5,fontSize:15,color:GOLD,fontFace:'Calibri'});
        s1.addText('Generated '+tsStr+'   \u00B7   Confidential \u2014 Internal Use Only',{x:0.7,y:3.3,w:10,h:0.35,fontSize:10,color:'A9B4C9',fontFace:'Calibri'});
        var covStats=[
          {label:'Goal Health', val:(goalsNarrative?goalsNarrative.latestSC.score+'%':'N/A')},
          {label:'Partner NPS', val:(partnerSec.overall.nps===null?'N/A':(partnerSec.overall.nps>0?'+':'')+partnerSec.overall.nps)},
          {label:'Onsite Staff n', val:String(onsiteSec.n)},
          {label:'Scholar Voices n', val:String(scholarSec.n)},
        ];
        covStats.forEach(function(t,i){
          var cx=0.7+i*3.0;
          s1.addShape(pptx.shapes.ROUNDED_RECTANGLE,{x:cx,y:4.0,w:2.7,h:1.1,fill:{color:'1F3159'},rectRadius:0.08});
          s1.addText(t.val,{x:cx+0.15,y:4.12,w:2.4,h:0.55,fontSize:22,bold:true,color:WHITE,fontFace:'Cambria',margin:0});
          s1.addText(t.label.toUpperCase(),{x:cx+0.15,y:4.62,w:2.4,h:0.3,fontSize:8,color:'A9B4C9',charSpacing:0.6,fontFace:'Calibri',margin:0});
        });

        // SLIDE 2 — WHERE WE STAND
        var s2 = pptx.addSlide(); s2.background={color:WHITE};
        slideHeader(s2,'Where We Stand','Executive summary \u2014 what the data means, not just what it says','chartline_white',NAVY);
        var verdictHex = synthesis.overallFlag==='good'?GREEN:synthesis.overallFlag==='watch'?AMBER:RED;
        var verdictBgHex = synthesis.overallFlag==='good'?GREEN_BG:synthesis.overallFlag==='watch'?AMBER_BG:RED_BG;
        s2.addShape(pptx.shapes.ROUNDED_RECTANGLE,{x:0.6,y:1.45,w:12.1,h:0.55,fill:{color:verdictBgHex},rectRadius:0.06});
        s2.addText(synthesis.headline,{x:0.8,y:1.45,w:11.7,h:0.55,fontSize:11,bold:true,color:verdictHex,fontFace:'Calibri',valign:'middle',margin:0});
        var domY = 2.15;
        synthesis.domains.forEach(function(d){
          var dHex = d.flag==='good'?GREEN:d.flag==='watch'?AMBER:d.flag==='concern'?RED:'6B7280';
          s2.addShape(pptx.shapes.RECTANGLE,{x:0.6,y:domY,w:0.05,h:0.62,fill:{color:dHex}});
          s2.addText([{text:d.label+'  ',options:{bold:true,color:NAVY,fontSize:9.5}},{text:d.metric,options:{bold:true,color:dHex,fontSize:9.5}}],{x:0.72,y:domY,w:11.9,h:0.22,fontFace:'Calibri',valign:'top',margin:0});
          s2.addText(d.text,{x:0.72,y:domY+0.22,w:11.9,h:0.4,fontSize:8,color:'475569',fontFace:'Calibri',valign:'top',margin:0,lineSpacingMultiple:1.1});
          domY += 0.72;
        });

        // SLIDE 3 — PARTNER SATISFACTION
        var s3 = pptx.addSlide(); s3.background={color:WHITE};
        slideHeader(s3,'Partner Satisfaction','Quarterly n='+partnerSec.n+' \u00B7 EOY n='+partnerSec.eoyN,'handshake_navy',NAVY);
        var contribRows=[['District','n','NPS']];
        partnerSec.biggestContributors.forEach(function(c){ contribRows.push([c.name, String(c.n), (c.nps===null?'N/A':(c.nps>0?'+':'')+c.nps)]); });
        s3.addText('Biggest Contributors',{x:0.6,y:1.5,w:6,h:0.35,fontSize:13,bold:true,color:NAVY,fontFace:'Calibri'});
        s3.addTable(contribRows,{x:0.6,y:1.9,w:6,colW:[3.8,1,1.2],border:{type:'solid',color:'E2E8F0',pt:0.5},
          headFontSize:9,headBold:true,headFill:{color:NAVY},headColor:WHITE,bodyFontSize:9,bodyColor:'1E293B',bodyFill:{color:'F7F9FC'}});
        s3.addText('What\u2019s Working',{x:7,y:1.5,w:6,h:0.35,fontSize:13,bold:true,color:GREEN,fontFace:'Calibri'});
        var py=1.9;
        partnerSec.positives.bestDistricts.forEach(function(d){
          s3.addShape(pptx.shapes.ROUNDED_RECTANGLE,{x:7,y:py,w:5.7,h:0.55,fill:{color:GREEN_BG},rectRadius:0.05});
          s3.addText(d.name+'  \u2014  NPS '+(d.nps>0?'+':'')+d.nps+' (n='+d.n+')',{x:7.15,y:py,w:5.4,h:0.55,fontSize:9.5,color:'1E293B',fontFace:'Calibri',valign:'middle',margin:0});
          py+=0.65;
        });
        s3.addText('Needs Attention',{x:7,y:py+0.15,w:6,h:0.35,fontSize:13,bold:true,color:RED,fontFace:'Calibri'});
        py+=0.55;
        partnerSec.negatives.worstDistricts.forEach(function(d){
          s3.addShape(pptx.shapes.ROUNDED_RECTANGLE,{x:7,y:py,w:5.7,h:0.55,fill:{color:RED_BG},rectRadius:0.05});
          s3.addText(d.name+'  \u2014  NPS '+(d.nps===null?'N/A':(d.nps>0?'+':'')+d.nps)+' (n='+d.n+')',{x:7.15,y:py,w:5.4,h:0.55,fontSize:9.5,color:'1E293B',fontFace:'Calibri',valign:'middle',margin:0});
          py+=0.65;
        });

        // SLIDE 4 — ONSITE STAFF
        var s4 = pptx.addSlide(); s4.background={color:WHITE};
        slideHeader(s4,'Onsite Staff Feedback','n='+onsiteSec.n,'users_white',NAVY);
        var oRows=[['Role','n','Sat-NPS','% Grew Prof.','% Made Diff.']];
        Object.keys(onsiteSec.byRole).sort(function(a,b){return onsiteSec.byRole[b].n-onsiteSec.byRole[a].n;}).forEach(function(rl){
          var d=onsiteSec.byRole[rl];
          oRows.push([rl,String(d.n),(d.nps===null?'N/A':(d.nps>0?'+':'')+d.nps),(d.grewPct===null?'N/A':d.grewPct+'%'),(d.diffPct===null?'N/A':d.diffPct+'%')]);
        });
        s4.addTable(oRows,{x:0.6,y:1.5,w:12.1,colW:[3.5,1.5,2,2.5,2.6],border:{type:'solid',color:'E2E8F0',pt:0.5},
          headFontSize:10,headBold:true,headFill:{color:NAVY},headColor:WHITE,bodyFontSize:9.5,bodyColor:'1E293B',bodyFill:{color:'F7F9FC'}});

        // SLIDE 5 — SCHOLAR FEEDBACK
        var s5 = pptx.addSlide(); s5.background={color:WHITE};
        slideHeader(s5,'Scholar Feedback','n='+scholarSec.n+' \u00B7 Math n='+scholarSec.mathN+' \u00B7 Literacy n='+scholarSec.litN,'grad_gold',GOLD);
        var scRows=[['Site','n','Math NPS','Literacy NPS']];
        scholarSec.biggestContributors.forEach(function(c){
          var d = scholarSec.bySite[c.name];
          scRows.push([c.name.slice(0,50),String(c.n),(d.mathNPS===null?'N/A':(d.mathNPS>0?'+':'')+d.mathNPS),(d.litNPS===null?'N/A':(d.litNPS>0?'+':'')+d.litNPS)]);
        });
        s5.addTable(scRows,{x:0.6,y:1.5,w:12.1,colW:[6,1.5,2.3,2.3],border:{type:'solid',color:'E2E8F0',pt:0.5},
          headFontSize:10,headBold:true,headFill:{color:NAVY},headColor:WHITE,bodyFontSize:9.5,bodyColor:'1E293B',bodyFill:{color:'F7F9FC'}});

        // SLIDE 6 — NEXT STEPS (dark)
        var s6 = pptx.addSlide(); s6.background={color:NAVY};
        iconCircle(s6,'flag_navy',0.85,0.85,0.62,GOLD);
        s6.addText('Recommended Next Steps',{x:1.35,y:0.5,w:9,h:0.5,fontSize:24,bold:true,color:WHITE,fontFace:'Cambria',margin:0});
        var ny=1.7;
        data.nextSteps.forEach(function(step,i){
          s6.addShape(pptx.shapes.ROUNDED_RECTANGLE,{x:0.7,y:ny,w:1.5,h:0.32,fill:{color:GOLD},rectRadius:0.05});
          s6.addText(step.owner.toUpperCase(),{x:0.7,y:ny,w:1.5,h:0.32,fontSize:7.5,bold:true,color:NAVY,align:'center',valign:'middle',fontFace:'Calibri',margin:0});
          s6.addText(step.text,{x:2.35,y:ny-0.1,w:10.1,h:0.75,fontSize:11.5,color:WHITE,fontFace:'Calibri',valign:'middle',lineSpacingMultiple:1.15});
          ny+=0.92;
        });

        pptx.writeFile({fileName:'NJTC_Annual_Impact_Satisfaction_Report.pptx'})
          .catch(function(e){ console.error(e); alert('PPTX generation failed.'); });
      });
    }, function(err){ alert('Failed to load survey data. ' + err.message); });
  }

  // ══════════════════════════════════════════════════════════════════════
  //  LIVE PRESENTATION — self-contained HTML, fresh every open
  // ══════════════════════════════════════════════════════════════════════
  function openAnnualReportLivePresentation() {
    buildAnnualReportData(function(data) {
      var esc = function(s){ var d=document.createElement('div'); d.textContent=String(s==null?'':s); return d.innerHTML; };
      var partnerSec=data.partner, onsiteSec=data.onsite, scholarSec=data.scholar;
      var goalsNarrative=data.goalsNarrative, synthesis=data.synthesis, nextSteps=data.nextSteps;
      var tsStr = new Date(data.generatedAt).toLocaleString('en-US',{month:'long',day:'numeric',year:'numeric',hour:'numeric',minute:'2-digit'});

      function npsClass(nps){ if(nps===null||nps===undefined) return 'muted'; if(nps>=50) return 'green'; if(nps>=20) return 'amber'; return 'red'; }
      function flagHex(flag){ return flag==='good'?'#16A34A':flag==='watch'?'#D97706':flag==='concern'?'#DC2626':'#64748B'; }
      function fmtNPS(nps){ return nps===null?'N/A':(nps>0?'+':'')+nps; }

      // ── Inline SVG chart builders (self-contained, no external deps) ──
      function svgGauge(pct, hex, trackHex, size, labelTop, labelBottom) {
        size = size || 190;
        var r = size/2 - 15, c = size/2, circ = 2*Math.PI*r;
        var clamped = Math.max(0, Math.min(100, pct));
        var dash = circ * clamped/100;
        return '<div class="gauge-wrap" style="width:'+size+'px;height:'+size+'px">'
          + '<svg width="'+size+'" height="'+size+'" viewBox="0 0 '+size+' '+size+'">'
          + '<circle cx="'+c+'" cy="'+c+'" r="'+r+'" fill="none" stroke="'+(trackHex||'#E5E9F0')+'" stroke-width="14"/>'
          + '<circle cx="'+c+'" cy="'+c+'" r="'+r+'" fill="none" stroke="'+hex+'" stroke-width="14" '
          + 'stroke-dasharray="'+dash.toFixed(1)+' '+circ.toFixed(1)+'" stroke-linecap="round" transform="rotate(-90 '+c+' '+c+')"/></svg>'
          + '<div class="gauge-label"><div class="gauge-val" style="color:'+hex+'">'+labelTop+'</div><div class="gauge-sub">'+labelBottom+'</div></div></div>';
      }
      function svgDonut(segments, size) {
        size = size || 190;
        var r = size/2 - 20, c = size/2, circ = 2*Math.PI*r, cum = 0;
        var total = segments.reduce(function(a,s){ return a+s.val; }, 0) || 1;
        var arcs = segments.filter(function(s){ return s.val>0; }).map(function(s){
          var dash = circ*s.val/total, offset = -circ*cum/total; cum += s.val;
          return '<circle cx="'+c+'" cy="'+c+'" r="'+r+'" fill="none" stroke="'+s.color+'" stroke-width="22" stroke-dasharray="'+dash.toFixed(1)+' '+circ.toFixed(1)+'" stroke-dashoffset="'+offset.toFixed(1)+'" transform="rotate(-90 '+c+' '+c+')"/>';
        }).join('');
        return '<svg width="'+size+'" height="'+size+'" viewBox="0 0 '+size+' '+size+'">'+arcs+'</svg>';
      }
      function barRow(name, n, nps, maxN, barHex) {
        var pct = maxN ? Math.round(n/maxN*100) : 0;
        return '<div class="bar-row"><div class="bar-label">' + esc(name) + '</div><div class="bar-track"><div class="bar-fill" style="width:' + pct + '%;background:' + (barHex||'#1B2A4A') + '"></div></div>'
          + '<div class="bar-n">' + n + '</div>' + (nps!==undefined ? '<div class="bar-nps ' + npsClass(nps) + '">' + fmtNPS(nps) + '</div>' : '') + '</div>';
      }
      function card(name, n, scoreLabel, cls) {
        return '<div class="mini-card ' + cls + '"><span>' + esc(name) + ' <i>(n=' + n + ')</i></span><b>' + esc(scoreLabel) + '</b></div>';
      }
      function ownerPill(owner) {
        return '<span class="owner-pill">' + esc(owner.toUpperCase()) + '</span>';
      }

      var slides = [];

      // ══════════════════════════ 1 — COVER ══════════════════════════
      slides.push('<section class="slide cover"><div class="ring-bg"></div><div class="brand">\uD83C\uDF93 NEW JERSEY TUTORING CORPS</div>'
        + '<h1>Annual Impact &amp; Satisfaction Report</h1><div class="sub">Goals \u00B7 Partner Satisfaction \u00B7 Onsite Staff \u00B7 Scholar Feedback</div>'
        + '<div class="meta">Live as of ' + esc(tsStr) + '</div>'
        + '<div class="cover-tiles">'
        + '<div class="tile"><div class="tv">' + (goalsNarrative?goalsNarrative.latestSC.score+'%':'N/A') + '</div><div class="tl">GOAL HEALTH</div></div>'
        + '<div class="tile"><div class="tv">' + fmtNPS(partnerSec.overall.nps) + '</div><div class="tl">PARTNER NPS (Q)</div></div>'
        + '<div class="tile"><div class="tv">' + onsiteSec.n + '</div><div class="tl">ONSITE STAFF N</div></div>'
        + '<div class="tile"><div class="tv">' + scholarSec.n + '</div><div class="tl">SCHOLAR VOICES N</div></div>'
        + '</div></section>');

      // ══════════════════════════ 2 — WHERE WE STAND ══════════════════════════
      var verdictHex = flagHex(synthesis.overallFlag);
      slides.push('<section class="slide light"><div class="head"><div class="hicon navy">\uD83D\uDCC8</div><div><h2>Where We Stand</h2><div class="hsub">Executive summary \u2014 what the data means, not just what it says</div></div></div>'
        + '<div class="verdict-banner" style="background:' + verdictHex + '1A;color:' + verdictHex + '">' + esc(synthesis.headline) + '</div>'
        + '<div class="domain-list">' + synthesis.domains.map(function(d){
            var dHex = flagHex(d.flag);
            return '<div class="domain-card" style="border-left-color:' + dHex + '"><div class="domain-top"><span class="domain-label">' + esc(d.label) + '</span><span class="domain-metric" style="color:' + dHex + '">' + esc(d.metric) + '</span></div><div class="domain-text">' + esc(d.text) + '</div></div>';
          }).join('') + '</div></section>');

      // ══════════════════════════ 3 — PARTNER OVERVIEW ══════════════════════════
      var maxDistN = Math.max.apply(null, partnerSec.biggestContributors.map(function(c){return c.n;}).concat([1]));
      slides.push('<section class="slide light"><div class="head"><div class="hicon navy">\uD83E\uDD1D</div><div><h2>Partner Satisfaction</h2><div class="hsub">District &amp; school partner voice \u2014 Quarterly + End-of-Year surveys</div></div></div>'
        + '<div class="gauge-row">'
        + '<div class="gauge-block">' + svgGauge(Math.max(0,((partnerSec.overall.nps||0)+100)/2), npsClass(partnerSec.overall.nps)==='green'?'#16A34A':npsClass(partnerSec.overall.nps)==='amber'?'#D97706':'#DC2626', '#E5E9F0', 160, fmtNPS(partnerSec.overall.nps), 'QUARTERLY NPS \u00B7 n='+partnerSec.n) + '</div>'
        + (partnerSec.eoyOverall ? '<div class="gauge-block">' + svgGauge(Math.max(0,(partnerSec.eoyOverall.nps+100)/2), npsClass(partnerSec.eoyOverall.nps)==='green'?'#16A34A':npsClass(partnerSec.eoyOverall.nps)==='amber'?'#D97706':'#DC2626', '#E5E9F0', 160, fmtNPS(partnerSec.eoyOverall.nps), 'EOY NPS \u00B7 n='+partnerSec.eoyN) + '</div>' : '')
        + '<div class="gauge-side-text"><h3 class="sub-h">Biggest Contributors</h3><div class="bar-chart">' + partnerSec.biggestContributors.map(function(c){ return barRow(c.name, c.n, c.nps, maxDistN); }).join('') + '</div></div>'
        + '</div></section>');

      // ══════════════════════════ 4 — PARTNER WHAT'S WORKING ══════════════════════════
      slides.push('<section class="slide light"><div class="head"><div class="hicon green">\u2705</div><div><h2>Partner Satisfaction \u2014 What\u2019s Working</h2><div class="hsub">Highest-performing districts and direct partner feedback</div></div></div>'
        + '<div class="two-col-even"><div>'
        + '<h3 class="sub-h green">Top-Performing Districts</h3>'
        + (partnerSec.positives.bestDistricts.length ? partnerSec.positives.bestDistricts.map(function(d){ return card(d.name, d.n, 'NPS ' + fmtNPS(d.nps), 'green'); }).join('') : '<div class="empty-note">No districts cleared the positive-NPS threshold this cycle.</div>')
        + '</div><div>'
        + '<h3 class="sub-h">Direct Feedback</h3><div class="quote-list">' + partnerSec.positives.highlightComments.slice(0,4).map(function(c){ return '<div class="quote">\u201C' + esc(c.text.length>140?c.text.slice(0,140)+'\u2026':c.text) + '\u201D<span>\u2014 ' + esc(c.district) + '</span></div>'; }).join('') + '</div>'
        + '</div></div></section>');

      // ══════════════════════════ 5 — PARTNER NEEDS ATTENTION ══════════════════════════
      slides.push('<section class="slide light"><div class="head"><div class="hicon red">\u26A0\uFE0F</div><div><h2>Partner Satisfaction \u2014 Needs Attention</h2><div class="hsub">Lowest-performing districts and dissatisfaction themes</div></div></div>'
        + '<div class="two-col-even"><div>'
        + '<h3 class="sub-h red">Lowest-Performing Districts</h3>'
        + (partnerSec.negatives.worstDistricts.length ? partnerSec.negatives.worstDistricts.map(function(d){ return card(d.name, d.n, 'NPS ' + fmtNPS(d.nps), 'red'); }).join('') : '<div class="empty-note">No districts fell below the concern threshold this cycle.</div>')
        + '</div><div>'
        + '<h3 class="sub-h">Dissatisfaction Reasons</h3>'
        + (partnerSec.negatives.topDissatReasons.length ? '<div class="bar-chart">' + (function(){ var maxD=Math.max.apply(null, partnerSec.negatives.topDissatReasons.map(function(r){return r.count;})); return partnerSec.negatives.topDissatReasons.map(function(r){ return '<div class="bar-row"><div class="bar-label">'+esc(r.reason)+'</div><div class="bar-track"><div class="bar-fill" style="width:'+Math.round(r.count/maxD*100)+'%;background:#DC2626"></div></div><div class="bar-n">'+r.count+'</div></div>'; }).join(''); })() + '</div>' : '<div class="empty-note">No dissatisfaction reasons recorded this cycle.</div>')
        + '</div></div></section>');

      // ══════════════════════════ 6 — ONSITE OVERVIEW ══════════════════════════
      var maxRoleN = Math.max.apply(null, onsiteSec.biggestContributors.map(function(c){return c.n;}).concat([1]));
      slides.push('<section class="slide light"><div class="head"><div class="hicon navy">\uD83D\uDC65</div><div><h2>Onsite Staff Feedback</h2><div class="hsub">Site Coordinators, Coaches, Dual-Role staff, and Tutors \u2014 n=' + onsiteSec.n + '</div></div></div>'
        + '<div class="gauge-row">'
        + '<div class="gauge-block">' + svgGauge(onsiteSec.grewProfessionallyPct||0, (onsiteSec.grewProfessionallyPct>=80?'#16A34A':'#D97706'), '#E5E9F0', 160, (onsiteSec.grewProfessionallyPct===null?'N/A':onsiteSec.grewProfessionallyPct+'%'), 'GREW PROFESSIONALLY \u00B7 goal 80%') + '</div>'
        + '<div class="gauge-block">' + svgGauge(onsiteSec.madeDifferencePct||0, (onsiteSec.madeDifferencePct>=80?'#16A34A':'#D97706'), '#E5E9F0', 160, (onsiteSec.madeDifferencePct===null?'N/A':onsiteSec.madeDifferencePct+'%'), 'MADE A DIFFERENCE \u00B7 goal 80%') + '</div>'
        + '<div class="gauge-side-text"><h3 class="sub-h">Biggest Contributors \u2014 by Role</h3><div class="bar-chart">' + onsiteSec.biggestContributors.map(function(c){ return barRow(c.name, c.n, c.nps, maxRoleN); }).join('') + '</div></div>'
        + '</div></section>');

      // ══════════════════════════ 7 — ONSITE BY ROLE ══════════════════════════
      slides.push('<section class="slide light"><div class="head"><div class="hicon navy">\uD83D\uDC65</div><div><h2>Onsite Staff \u2014 By Role &amp; Region</h2><div class="hsub">Highest and lowest satisfaction-NPS roles</div></div></div>'
        + '<div class="two-col-even"><div>'
        + '<h3 class="sub-h green">Strongest Roles</h3>'
        + (onsiteSec.positives.bestRoles.length ? onsiteSec.positives.bestRoles.map(function(r){ return card(r.name, r.n, 'Sat-NPS ' + fmtNPS(r.nps), 'green'); }).join('') : '<div class="empty-note">No roles cleared the positive threshold this cycle.</div>')
        + '<h3 class="sub-h red" style="margin-top:16px">Roles Needing Support</h3>'
        + (onsiteSec.negatives.worstRoles.length ? onsiteSec.negatives.worstRoles.map(function(r){ return card(r.name, r.n, 'Sat-NPS ' + fmtNPS(r.nps), 'red'); }).join('') : '<div class="empty-note">No roles fell below the concern threshold this cycle.</div>')
        + '</div><div>'
        + '<h3 class="sub-h">By Region</h3>' + Object.keys(onsiteSec.byRegion).map(function(rg){ var d=onsiteSec.byRegion[rg]; return card(rg + ' Region', d.n, 'Sat-NPS ' + fmtNPS(d.nps), npsClass(d.nps)==='green'?'green':'amber'); }).join('')
        + '</div></div></section>');

      // ══════════════════════════ 8 — SCHOLAR OVERVIEW ══════════════════════════
      var maxSiteN = Math.max.apply(null, scholarSec.biggestContributors.map(function(c){return c.n;}).concat([1]));
      slides.push('<section class="slide light"><div class="head"><div class="hicon gold">\uD83C\uDF93</div><div><h2>Scholar Feedback</h2><div class="hsub">Self-reported confidence \u2014 Math &amp; Literacy \u2014 n=' + scholarSec.n + '</div></div></div>'
        + '<div class="gauge-row">'
        + '<div class="gauge-block">' + svgGauge(Math.max(0,((scholarSec.mathNPS.nps||0)+100)/2), npsClass(scholarSec.mathNPS.nps)==='green'?'#16A34A':'#D97706', '#E5E9F0', 160, fmtNPS(scholarSec.mathNPS.nps), 'MATH \u00B7 n='+scholarSec.mathN) + '</div>'
        + '<div class="gauge-block">' + svgGauge(Math.max(0,((scholarSec.litNPS.nps||0)+100)/2), npsClass(scholarSec.litNPS.nps)==='green'?'#16A34A':'#D97706', '#E5E9F0', 160, fmtNPS(scholarSec.litNPS.nps), 'LITERACY \u00B7 n='+scholarSec.litN) + '</div>'
        + '<div class="gauge-side-text"><h3 class="sub-h">Biggest Contributors \u2014 by Site</h3><div class="bar-chart">' + scholarSec.biggestContributors.map(function(c){ return '<div class="bar-row"><div class="bar-label">'+esc(c.name)+'</div><div class="bar-track"><div class="bar-fill" style="width:'+Math.round(c.n/maxSiteN*100)+'%;background:#E8A838"></div></div><div class="bar-n">'+c.n+'</div></div>'; }).join('') + '</div></div>'
        + '</div></section>');

      // ══════════════════════════ 9 — SCHOLAR BY SITE ══════════════════════════
      slides.push('<section class="slide light"><div class="head"><div class="hicon gold">\uD83C\uDF93</div><div><h2>Scholar Feedback \u2014 By Site &amp; Region</h2><div class="hsub">Highest and lowest confidence sites (3+ respondents, both subjects)</div></div></div>'
        + '<div class="two-col-even"><div>'
        + '<h3 class="sub-h green">Strongest Sites</h3>'
        + (scholarSec.positives.bestSites.length ? scholarSec.positives.bestSites.map(function(s){ return card(s.name, s.n, 'Math '+fmtNPS(s.mathNPS)+' \u00B7 Lit '+fmtNPS(s.litNPS), 'green'); }).join('') : '<div class="empty-note">No sites cleared the positive threshold this cycle.</div>')
        + '<h3 class="sub-h red" style="margin-top:16px">Sites Needing Support</h3>'
        + (scholarSec.negatives.worstSites.length ? scholarSec.negatives.worstSites.map(function(s){ return card(s.name, s.n, 'Math '+fmtNPS(s.mathNPS)+' \u00B7 Lit '+fmtNPS(s.litNPS), 'red'); }).join('') : '<div class="empty-note">No sites fell below the concern threshold this cycle.</div>')
        + '</div><div>'
        + '<h3 class="sub-h">By Region</h3>' + Object.keys(scholarSec.byRegion).map(function(rg){ var d=scholarSec.byRegion[rg]; return '<div class="mini-card muted"><span>' + esc(rg) + ' Region <i>(n=' + d.n + ')</i></span><b>Math ' + fmtNPS(d.mathNPS) + ' \u00B7 Lit ' + fmtNPS(d.litNPS) + '</b></div>'; }).join('')
        + '</div></div></section>');

      // ══════════════════════════ 10 — SYNTHESIS + NEXT STEPS ══════════════════════════
      slides.push('<section class="slide cover dark-alt"><div class="head light-head"><div class="hicon gold">\uD83D\uDEA9</div><div><h2 class="white">What the Data Is Telling Us</h2><div class="hsub light">Cross-cutting synthesis &amp; recommended next steps</div></div></div>'
        + '<div class="synth-grid">' + synthesis.domains.map(function(d){ return '<div class="synth-item"><span class="synth-label">' + esc(d.label) + '</span> \u2014 ' + esc(d.text) + '</div>'; }).join('') + '</div>'
        + '<h3 class="sub-h gold" style="margin-top:16px">Recommended Next Steps</h3>'
        + '<div class="steps-owner-list">' + nextSteps.map(function(s){ return '<div class="step-owner-row">' + ownerPill(s.owner) + '<span>' + esc(s.text) + '</span></div>'; }).join('') + '</div></section>');

      var html = '<!DOCTYPE html><html><head><meta charset="utf-8"><title>NJTC Annual Impact & Satisfaction Report</title><style>'
        + ':root{--navy:#1B2A4A;--gold:#E8A838;--ink:#1E293B;--muted:#64748B;--green:#16A34A;--red:#DC2626;--amber:#D97706;}'
        + '*{box-sizing:border-box;margin:0;padding:0;} html,body{width:100%;height:100%;} body{font-family:Calibri,Arial,sans-serif;background:#0a1220;overflow:hidden;}'
        + '.deck{width:100vw;height:100vh;position:relative;}'
        + '.slide{position:absolute;inset:0;display:none;flex-direction:column;padding:4.5vh 4.5vw 9vh 4.5vw;background:#fff;overflow-y:auto;}'
        + '.slide.active{display:flex;} .slide.cover{background:linear-gradient(135deg,#0f1c38,#1B2A4A);color:#fff;justify-content:center;}'
        + '.ring-bg{position:absolute;top:-160px;right:-120px;width:480px;height:480px;border-radius:50%;background:#13203A;pointer-events:none;}'
        + '.brand{font-weight:700;letter-spacing:2px;color:var(--gold);font-size:14px;margin-bottom:24px;}'
        + '.slide.cover h1{font-family:Cambria,Georgia,serif;font-size:clamp(28px,4vw,44px);font-weight:700;margin-bottom:14px;max-width:900px;}'
        + '.slide.cover .sub{font-size:18px;color:var(--gold);margin-bottom:10px;} .slide.cover .meta{font-size:12px;color:#A9B4C9;margin-bottom:32px;}'
        + '.cover-tiles{display:flex;gap:20px;flex-wrap:wrap;} .tile{background:#1F3159;border-radius:10px;padding:18px 26px;min-width:160px;flex:1 1 160px;}'
        + '.tile .tv{font-family:Cambria,Georgia,serif;font-size:30px;font-weight:700;} .tile .tl{font-size:10px;color:#A9B4C9;letter-spacing:1px;margin-top:4px;}'
        + '.head{display:flex;align-items:center;gap:18px;margin-bottom:20px;flex-shrink:0;}'
        + '.hicon{width:52px;height:52px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:22px;flex-shrink:0;background:var(--navy);color:#fff;}'
        + '.hicon.green{background:var(--green);} .hicon.red{background:var(--red);} .hicon.gold{background:var(--gold);}'
        + 'h2{font-family:Cambria,Georgia,serif;font-size:clamp(22px,2.6vw,30px);color:var(--navy);} h2.white{color:#fff;}'
        + '.hsub{font-size:13px;color:var(--muted);margin-top:2px;} .hsub.light{color:#A9B4C9;}'
        // Where We Stand
        + '.verdict-banner{border-radius:10px;padding:16px 20px;font-size:14px;font-weight:700;margin-bottom:18px;flex-shrink:0;}'
        + '.domain-list{display:flex;flex-direction:column;gap:12px;overflow-y:auto;}'
        + '.domain-card{border-left:5px solid; background:#FAFBFC;border-radius:0 8px 8px 0;padding:12px 18px;}'
        + '.domain-top{display:flex;justify-content:space-between;align-items:baseline;margin-bottom:5px;flex-wrap:wrap;gap:6px;}'
        + '.domain-label{font-size:13px;font-weight:700;color:var(--navy);}'
        + '.domain-metric{font-size:13px;font-weight:700;}'
        + '.domain-text{font-size:11.5px;color:#334155;line-height:1.5;}'
        // gauges
        + '.gauge-row{display:flex;align-items:center;gap:32px;flex-wrap:wrap;}'
        + '.gauge-block{flex-shrink:0;}'
        + '.gauge-wrap{position:relative;} .gauge-label{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;}'
        + '.gauge-val{font-family:Cambria,Georgia,serif;font-size:26px;font-weight:700;}'
        + '.gauge-sub{font-size:8.5px;color:var(--muted);letter-spacing:.5px;margin-top:4px;text-align:center;max-width:120px;}'
        + '.gauge-side-text{flex:1;min-width:280px;}'
        // bar chart
        + '.sub-h{font-size:14px;color:var(--navy);margin-bottom:12px;font-weight:700;} .sub-h.green{color:var(--green);} .sub-h.red{color:var(--red);} .sub-h.gold{color:var(--gold);}'
        + '.bar-chart{display:flex;flex-direction:column;gap:9px;}'
        + '.bar-row{display:flex;align-items:center;gap:10px;font-size:11.5px;}'
        + '.bar-label{width:min(40%,220px);flex-shrink:0;color:var(--ink);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}'
        + '.bar-track{flex:1;height:14px;background:#F0F2F6;border-radius:4px;overflow:hidden;min-width:50px;}'
        + '.bar-fill{height:100%;border-radius:4px;}'
        + '.bar-n{width:28px;text-align:right;font-weight:700;color:var(--ink);flex-shrink:0;}'
        + '.bar-nps{width:56px;text-align:right;font-weight:700;flex-shrink:0;font-size:10.5px;}'
        + '.bar-nps.green{color:var(--green);} .bar-nps.amber{color:var(--amber);} .bar-nps.red{color:var(--red);} .bar-nps.muted{color:var(--muted);}'
        // cards
        + '.two-col-even{display:flex;gap:28px;flex:1;min-height:0;} .two-col-even>div{flex:1;overflow-y:auto;}'
        + '.mini-card{border-radius:8px;padding:12px 16px;margin-bottom:10px;font-size:12.5px;display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;}'
        + '.mini-card span i{color:var(--muted);font-style:normal;font-size:11px;}'
        + '.mini-card b{white-space:nowrap;}'
        + '.mini-card.green{background:#EAF7EE;} .mini-card.green b{color:var(--green);}'
        + '.mini-card.red{background:#FCEAEA;} .mini-card.red b{color:var(--red);}'
        + '.mini-card.muted{background:#F1F5F9;} .mini-card.muted b{color:var(--navy);}'
        + '.empty-note{font-size:11.5px;color:var(--muted);font-style:italic;padding:8px 0;}'
        + '.quote-list{display:flex;flex-direction:column;gap:9px;}'
        + '.quote{background:#FAFBFC;border-radius:8px;padding:11px 15px;font-size:11.5px;font-style:italic;color:var(--ink);line-height:1.45;border:1px solid #EEF1F5;}'
        + '.quote span{display:block;margin-top:5px;font-size:10px;font-style:normal;color:var(--muted);}'
        // synthesis / next steps (dark)
        + '.synth-grid{display:flex;flex-direction:column;gap:10px;}'
        + '.synth-item{font-size:13px;color:#fff;line-height:1.5;background:rgba(255,255,255,.06);border-radius:8px;padding:10px 16px;}'
        + '.synth-label{font-weight:700;color:var(--gold);}'
        + '.steps-owner-list{display:flex;flex-direction:column;gap:10px;}'
        + '.step-owner-row{display:flex;align-items:center;gap:14px;font-size:13px;color:#fff;line-height:1.4;}'
        + '.owner-pill{background:var(--gold);color:var(--navy);font-size:9px;font-weight:700;letter-spacing:.5px;padding:5px 10px;border-radius:12px;flex-shrink:0;min-width:110px;text-align:center;}'
        + '.light-head{color:#fff;}'
        + '.navbar{position:fixed;bottom:0;left:0;right:0;height:52px;background:rgba(10,18,32,.92);display:flex;align-items:center;justify-content:center;gap:18px;z-index:10;}'
        + '.navbar button{background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.25);color:#fff;padding:8px 16px;border-radius:6px;cursor:pointer;font-size:13px;font-weight:700;}'
        + '.navbar .count{color:#A9B4C9;font-size:12px;min-width:60px;text-align:center;}'
        + '</style></head><body>'
        + '<div class="deck">' + slides.map(function(s,i){ return s.replace('<section class="slide', '<section id="s'+i+'" class="slide'+(i===0?' active':'')); }).join('') + '</div>'
        + '<div class="navbar"><button onclick="nav(-1)">\u2190 Prev</button><span class="count" id="cnt"></span><button onclick="nav(1)">Next \u2192</button><button onclick="document.documentElement.requestFullscreen&&document.documentElement.requestFullscreen()">\u26F6 Fullscreen</button></div>'
        + '<script>var cur=0; var total=' + slides.length + ';'
        + 'function show(i){ cur=Math.max(0,Math.min(total-1,i)); for(var j=0;j<total;j++){ var el=document.getElementById("s"+j); if(el) el.classList.toggle("active", j===cur); } document.getElementById("cnt").textContent=(cur+1)+" / "+total; }'
        + 'function nav(d){ show(cur+d); }'
        + 'document.addEventListener("keydown", function(e){ if(e.key==="ArrowRight"||e.key===" ") nav(1); if(e.key==="ArrowLeft") nav(-1); });'
        + 'show(0);</script></body></html>';

      var blob = new Blob([html], {type:'text/html'});
      var url = URL.createObjectURL(blob);
      window.open(url, '_blank');
      setTimeout(function(){ URL.revokeObjectURL(url); }, 30000);
    }, function(err){ alert('Failed to load survey data. ' + err.message); });
  }

  // ══════════════════════════════════════════════════════════════════════
  //  MINIMAL LAUNCH PANEL — lives at #panel-annual-report
  // ══════════════════════════════════════════════════════════════════════
  function renderAnnualReportPanel() {
    var el = document.getElementById('annualReportRoot');
    if (!el) return;
    var isDataDept = (window.NJTC_SESSION||{}).dept === 'data';
    el.innerHTML = '<div style="max-width:640px;margin:2rem auto;text-align:center;padding:2rem;border:1px solid var(--border);border-radius:14px;background:var(--surface-2)">'
      + '<div style="font-size:2rem;margin-bottom:.75rem">\uD83D\uDCD8</div>'
      + '<div style="font-size:1.1rem;font-weight:800;color:var(--navy);margin-bottom:.5rem">Annual Impact & Satisfaction Report</div>'
      + '<div style="font-size:.85rem;color:var(--muted);margin-bottom:1.5rem;line-height:1.6">Combines Annual Goal Progress with Partner Satisfaction, Onsite Staff, and Scholar Feedback \u2014 generated fresh from live data every time.</div>'
      + '<div style="display:flex;gap:.75rem;justify-content:center;flex-wrap:wrap">'
      + '<button onclick="exportAnnualReportPDF()" class="btn btn-secondary">\uD83D\uDCC4 Download PDF Report</button>'
      + '<button onclick="exportAnnualReportPPTX()" class="btn btn-secondary">\uD83D\uDCCA Download PPTX Slides</button>'
      + '<button onclick="openAnnualReportLivePresentation()" class="btn btn-secondary">\uD83C\uDFA5 Open Live Presentation</button>'
      + '</div>'
      + (isDataDept ? ('<div style="margin-top:1.25rem;font-size:.75rem;color:var(--muted)">Source workbooks (Data dept only): '
      + '<a href="https://docs.google.com/spreadsheets/d/1wp50xdBU7dRcJBzh4-sr5BJ7wn6lrOyFiHUUIG8XNrY/edit#gid=616402823" target="_blank">Partner (Q)</a> \u00B7 '
      + '<a href="https://docs.google.com/spreadsheets/d/1wZj1cfqr73jgnEZBhJ44C6ekOtGMhOIUAr-yqsDEsKY/edit#gid=1455158458" target="_blank">Partner (EOY)</a> \u00B7 '
      + '<a href="https://docs.google.com/spreadsheets/d/1C6LmYxJZOF-iCV9KPpbHOY76GFvmLlbqDtMhynVbKYI/edit#gid=1560652927" target="_blank">Onsite</a> \u00B7 '
      + '<a href="https://docs.google.com/spreadsheets/d/19Ox5UtW9BgJoMYSXH7ybDCSwS0vmOKGUmxkozm7rk9A/edit#gid=1733049715" target="_blank">Scholar</a>'
      + '</div>') : '')
      + '</div>';
  }

  window.exportAnnualReportPDF = exportAnnualReportPDF;
  window.exportAnnualReportPPTX = exportAnnualReportPPTX;
  window.openAnnualReportLivePresentation = openAnnualReportLivePresentation;
  window.renderAnnualReportPanel = renderAnnualReportPanel;
  window.buildAnnualReportData = buildAnnualReportData;

  var _origShowPanel = window.showPanel;
  window.showPanel = function(id, btn) {
    if (_origShowPanel) _origShowPanel(id, btn);
    if (id === 'annual-report') renderAnnualReportPanel();
  };
})();
