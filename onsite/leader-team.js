(function () {
  'use strict';

  /* ─────────────────────────────────────────────
     CONSTANTS
  ───────────────────────────────────────────── */
  const PEARL_KEY  = '2PACX-1vQ1iC8NZFJt3iinGUEqftKtP32N43axi_JN_RQI36EBUdhZS0PaZRwd-1AJT3bEVe6cqHA0tCA3vb5K';
  const PEARL_ATT_GID  = '702726038';
  const PEARL_STU_GID  = '1245403832';
  const PEARL_SESS_GID = '625567780';
  // Pearl Login/ID sheet — holds staff name, email, Pearl username, school assignment, district
  const PEARL_LOGIN_KEY = '2PACX-1vS2fgss4HiKpr61wJ2_si8klythckgGZ3yOYer4FSAdThkQz-X1cdL83xbgPBnHbMpTGPHZCtnttKRv';
  const IREADY_KEY = '2PACX-1vREgf9glXO2QMKeZ8YHF-0XBtqoOyhNz3CnBpaeCY0mAC1lknvQ13JuXJpzHCZeGls4XEPkxyNO5ZBG';
  const IREADY_ELA_GID  = '0';
  const IREADY_MATH_GID = '127145553';
  // iReady 25-26 EOY Preliminary / Longitudinal Academic Data
  // EOY Preliminary is used until Longitudinal is populated; same sheet, same GIDs.
  // When longitudinal rows appear they take precedence (detected by non-empty Spring Score).
  const IR_2526_SHEET_ID  = '1mCx6eFKscXA3y5Ox_JB9cSualR5Tw9MbKxBVN078_G0';
  const IR_2526_ELA_GID   = '1640935949';
  const IR_2526_MATH_GID  = '1676366557';
  // Standards Mastery (Middlesex STEM only)
  const SM_2PACX  = '2PACX-1vTs5uDk0bg_E4rorRHadFm5i_1lerAlgj5HfSJ3NQPLMDaCbHju0VeEdbaN_mDDzA';
  const SM_GID    = '457164791';
  const SM_SCHOOLS = new Set(['middlesex stem']);
  // TAP Master Roster — served by the deployed Apps Script web app (no sheet-sharing required)
  const TAP_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwdmNCbZ4pTRBImdSNGzkeIh3dGiowT24Ms-NwwYY8RlVgbGzZvBRjIn6tPMsuvyCWd/exec';
  const TAP_URL        = TAP_SCRIPT_URL + '?tab=master_roster';

  // In-memory OJT activity selection store — survives panel DOM rebuilds
  var _ojtSelectionStore = {}; // keyed by tutor nk

  // ── Service Interruption patterns (canonical, used across all SI computations)
  // A Service Interruption = any session where tutoring service was not delivered,
  // whether caused by the tutor (absent/no coverage) or the school (closure/event/drill).
  // Holidays and planned breaks are NOT service interruptions.
  const SI_REASON_PATTERNS = [
    // Tutor-caused
    'Absent; Not Covered (Tutor not available)',
    'Absent; Not Covered',
    'Tutor Left Early (no sub)',
    'Tutor Absent',
    // School-caused (service interrupted regardless of tutor availability)
    'Unscheduled School Closure',
    'Scheduled/Unscheduled School Drill',
    'School Event',
    'Emergency School Closure',
    'School Cancelled',
    'School Closed',
  ];
  // Test whether a status/reason string matches any SI pattern
  function isSI(status, reason) {
    const s = (status || '').trim();
    const r = (reason  || '').trim();
    return SI_REASON_PATTERNS.some(p => s.includes(p) || r.includes(p));
  }


  var OJT_ACTIVITY_DATA = [
    // ── Beginning · Professionalism ──────────────────────────────────────
    { phase:'Beginning', domain:'Professionalism', code:'A',
      desc:'Join the site visit/collaboration meeting or other event established by your site and site coordinator to introduce yourself and review school partner expectations.',
      lookFor:'Was this tutor present and engaged?' },
    { phase:'Beginning', domain:'Professionalism', code:'B',
      desc:'Follow the schedule provided for daily routines, including assigned duties and meetings.',
      lookFor:'Does the tutor follow and understand the schedule?' },
    { phase:'Beginning', domain:'Professionalism', code:'C',
      desc:'Providing information to supervisors, co-workers, and subordinates by telephone, in written form, e-mail, or in person.',
      lookFor:'Does the tutor communicate regularly and understand communication protocols?' },
    { phase:'Beginning', domain:'Professionalism', code:'D',
      desc:'Review and complete the Modified Danielson Self-Assessment. Identify and share goals with your instructional coach.',
      lookFor:'Did the tutor complete the required training and the self-assessment?' },
    { phase:'Beginning', domain:'Professionalism', code:'E',
      desc:'Utilize FERPA guidelines to ensure the separation of personal and professional relationships.',
      lookFor:'Did the tutor create a Gmail account and share data securely (if applicable)?' },
    { phase:'Beginning', domain:'Professionalism', code:'F',
      desc:'Follow and demonstrate the policies and procedures as outlined in the Employee Handbook, School level handbook, and agency code of ethics if applicable.',
      lookFor:'Did the tutor sign the employee handbook and any other protocols established by their school location?' },
    { phase:'Beginning', domain:'Professionalism', code:'G',
      desc:'Follow expectations for the creation and use of the unit planning template for collaborative and personalized instruction.',
      lookFor:'Has this tutor completed lesson plans and turned them in on time, consistently?' },
    { phase:'Beginning', domain:'Professionalism', code:'H',
      desc:'Actively participate in the weekly delivery of professional learning opportunities.',
      lookFor:'Has the tutor participated in professional learning opportunities? If none are available, create some.' },
    { phase:'Beginning', domain:'Professionalism', code:'I',
      desc:'Complete iReady training and collaborate with instructional coaches on building out your unit plan.',
      lookFor:'Did this tutor complete the iReady training and collaborate with you on building lessons informed by student data?' },
    { phase:'Beginning', domain:'Professionalism', code:'K',
      desc:'Follow expectations for submissions of work time through ADP.',
      lookFor:'Did this tutor complete the training on ADP? Have they submitted timecards on time?' },
    { phase:'Beginning', domain:'Professionalism', code:'N',
      desc:'Document by entering, transcribing, recording, storing, or maintaining information in written or electronic/magnetic form.',
      lookFor:'Does this tutor consistently turn in lesson plans electronically?' },
    { phase:'Beginning', domain:'Professionalism', code:'Q',
      desc:'Performing day-to-day administrative tasks such as maintaining information files and processing paperwork.',
      lookFor:'Has this tutor completed at least 90% of Pearl surveys after each session? Have they completed attendance for their scholars?' },
    { phase:'Beginning', domain:'Professionalism', code:'R',
      desc:'Utilize your email to respond to all communication from instructional coaches, site coordinator, classroom teachers, parents and any additional colleagues.',
      lookFor:'Does the tutor communicate regularly and understand communication protocols using Gmail account?' },
    { phase:'Beginning', domain:'Professionalism', code:'S',
      desc:'Attend training sessions or professional meetings to develop or maintain professional knowledge.',
      lookFor:'Has the tutor attended 80% of team meetings and 100% of training sessions?' },
    // ── Beginning · Instruction ───────────────────────────────────────────
    { phase:'Beginning', domain:'Instruction', code:'B',
      desc:'Conduct sessions that follow the teaching and learning framework (I do, We do, You do).',
      lookFor:'Lesson plans — The gradual release model is evident in the lesson plans.' },
    { phase:'Beginning', domain:'Instruction', code:'C',
      desc:'Choose the most effective materials to support the lesson objective, engage students, and provide opportunities for student-to-student interaction and distribute accordingly.',
      lookFor:'Did the tutor use the approved list of supplementary materials? Knowtion (See Approved Supplemental Resources Folder).' },
    { phase:'Beginning', domain:'Instruction', code:'D',
      desc:'Use the framework, independently plan and teach consistently for a 10-week block.',
      lookFor:'Did the tutor complete lessons over a 10-week period of time or the duration of the program?' },
    { phase:'Beginning', domain:'Instruction', code:'I',
      desc:'Choose the most effective materials to support the lesson objective, engage students with various learning styles and provide opportunities for student-to-student interaction.',
      lookFor:'Did the tutor adapt materials and instruction based on learning needs or outcomes?' },
    { phase:'Beginning', domain:'Instruction', code:'L',
      desc:'Promote equality of opportunity and anti-discriminatory practices.',
      lookFor:'If they are a new hire, did the tutor complete Social Justice training?' },
    { phase:'Beginning', domain:'Instruction', code:'M',
      desc:'Communicate effectively, sensitively, and confidentially with colleagues of all backgrounds.',
      lookFor:'Do they approach scholars and colleagues with an asset based mindset?' },
    { phase:'Beginning', domain:'Instruction', code:'N',
      desc:'Teach skills to improve academic performance, including study strategies, note-taking skills, and test-taking strategies.',
      lookFor:'All staff complete instructional training aligned to instructional framework; measured by IC observations and lesson plans.' },
    { phase:'Beginning', domain:'Instruction', code:'O',
      desc:'Conducting practice tests to track progress, identify areas of improvement and help set goals for exam preparation.',
      lookFor:"Does this tutor's lessons have exit tickets? Did they complete goal setting with each scholar based on BOY, MOY data?" },
    { phase:'Beginning', domain:'Instruction', code:'Q',
      desc:'Administer, proctor, or score academic or diagnostic assessments.',
      lookFor:'Did the tutor oversee Diagnostics?', na:true },
    // ── Beginning · Environment ───────────────────────────────────────────
    { phase:'Beginning', domain:'Environment', code:'A',
      desc:'Support the classroom teacher in reinforcing the rules and procedures for student learning and behavior in the classroom.',
      lookFor:'Did you observe the tutor following all rules/guidelines/expectations of their school site, consistently?' },
    { phase:'Beginning', domain:'Environment', code:'B',
      desc:'Establishes and maintains a safe, caring, inclusive, and healthy learning environment.',
      lookFor:'Has the tutor consistently created a welcoming and inclusive environment? Have they adapted as necessary with feedback?' },
    { phase:'Beginning', domain:'Environment', code:'C',
      desc:'Communicate with students using positive, professional, and compassionate language and tone.',
      lookFor:'Have you observed the tutor communicating consistently in these ways?' },
    { phase:'Beginning', domain:'Environment', code:'D',
      desc:'Complete Modified Danielson framework for Domain 2 and discuss with the instructional coach for observations.',
      lookFor:'Have you met and discussed their responses on the self-assessment?' },
    { phase:'Beginning', domain:'Environment', code:'F',
      desc:'Complies with relevant federal, state, and local requirements around mandated reporting, child study, and support for children with disabilities.',
      lookFor:'Tutor completed all Praesidium training and any other relevant training.' },
    { phase:'Beginning', domain:'Environment', code:'G',
      desc:'Collaboration with classroom teachers regarding any behavioral issues that occur during tutoring or academic concerns.',
      lookFor:'Completed during Training component — Classroom Management (9 min).' },
    { phase:'Beginning', domain:'Environment', code:'I',
      desc:'Provide feedback to students, using positive reinforcement techniques to encourage, motivate, or build confidence in students.',
      lookFor:'Classroom Management Strategies — has the tutor used strategies successfully?' },
    // ── Beginning · Planning ──────────────────────────────────────────────
    { phase:'Beginning', domain:'Planning', code:'A',
      desc:'Utilize backwards design: Use iReady diagnostic data including instructional groupings, prerequisites, and scaffolding to complete Unit Planning template. Discuss with the instructional coach.',
      lookFor:'Has the tutor successfully created lessons that are data informed?' },
    { phase:'Beginning', domain:'Planning', code:'D',
      desc:'Complete surveys in Pearl for each instructional session completed. This includes comments with notes on how the session went.',
      lookFor:'Has the tutor completed 80%+ attendance and scholar surveys?' },
    { phase:'Beginning', domain:'Planning', code:'E',
      desc:'Prepare lesson materials (i.e. make copies, gather materials, set up learning stations, etc.)',
      lookFor:'Is the tutor consistently prepared for lessons with materials and any other instructional tools?' },
    // ── Middle · Professionalism ──────────────────────────────────────────
    { phase:'Middle', domain:'Professionalism', code:'J',
      desc:'Actively participate in any faculty professional learning and complete reflections.',
      lookFor:'Has the tutor participated in professional learning opportunities? If none available, create some.' },
    { phase:'Middle', domain:'Professionalism', code:'L',
      desc:'Review and complete the Use of Data indicator on the TEAM Professionalism rubric (progress report) and work with mentor teacher.',
      lookFor:'Has the tutor completed their progress reports using the NJTC Template?' },
    { phase:'Middle', domain:'Professionalism', code:'O',
      desc:'Keeping up-to-date technically and applying new knowledge to your job.',
      lookFor:"Has the tutor's lessons & instruction incorporated your feedback?" },
    { phase:'Middle', domain:'Professionalism', code:'T',
      desc:'Using computers and computer systems to program, write software, set up functions, enter data, or process information.',
      lookFor:'Does the tutor have a 90%+ attendance and survey completion?' },
    { phase:'Middle', domain:'Professionalism', code:'U',
      desc:'Review data to inform tutoring practice.',
      lookFor:'Did the tutor complete i-Ready data training? Have they completed a goal sheet with scholars post-diagnostics?' },
    { phase:'Middle', domain:'Professionalism', code:'W',
      desc:'Utilize technology software i.e. Microsoft Office, Google Meet, and Zoom.',
      lookFor:'Has your tutor contributed on Knowtion?' },
    // ── Middle · Instruction ──────────────────────────────────────────────
    { phase:'Middle', domain:'Instruction', code:'E',
      desc:'Receive feedback from the Instructional Coach throughout the unit of study and make instructional adjustments based on feedback.',
      lookFor:'Has this tutor made adjustments to instruction based on coaching or feedback?' },
    { phase:'Middle', domain:'Instruction', code:'F',
      desc:'Have scholars complete end of session surveys in Pearl and reviewed data to inform practice.',
      lookFor:"Does this tutor regularly administer Pearl surveys to scholars?" },
    { phase:'Middle', domain:'Instruction', code:'G',
      desc:'Replicate established transition routines when changing activities during the day.',
      lookFor:'Have you observed this tutor maintaining consistent systems and routines?' },
    { phase:'Middle', domain:'Instruction', code:'H',
      desc:'Demonstrates flexibility and responsiveness when delivering instruction.',
      lookFor:'Have you observed this tutor demonstrating flexibility on more than 2 occasions?' },
    { phase:'Middle', domain:'Instruction', code:'J',
      desc:'Observe lessons with district approval to inform instruction.',
      lookFor:'Has the tutor observed teachers when they are not scheduled for a session?' },
    { phase:'Middle', domain:'Instruction', code:'K',
      desc:'Create unit planning of instruction for each group of students.',
      lookFor:'Has this tutor successfully submitted lesson plans consistently? Are these lessons customized for each group?' },
    { phase:'Middle', domain:'Instruction', code:'P',
      desc:'Identify, develop, or implement intervention strategies, tutoring plans, or individualized education plans (IEPs) for students.',
      lookFor:'Has this tutor successfully submitted lesson plans consistently? Are these lessons customized for each group?' },
    { phase:'Middle', domain:'Instruction', code:'R',
      desc:'Translating or explaining what information means and how it can be used.',
      lookFor:'Does the tutor explain concepts in grade- and age-appropriate language that can be understood by scholars?' },
    { phase:'Middle', domain:'Instruction', code:'S',
      desc:'Identifying the underlying principles, reasons, or facts of information by breaking down information or data into separate parts.',
      lookFor:'Does the tutor explain concepts in grade- and age-appropriate language that can be understood by scholars?' },
    { phase:'Middle', domain:'Instruction', code:'T',
      desc:'Review class material with students by discussing text, working solutions to problems, or reviewing worksheets or other assignments.',
      lookFor:'Does the tutor explain concepts in grade- and age-appropriate language?' },
    { phase:'Middle', domain:'Instruction', code:'U',
      desc:"Assess students' progress throughout tutoring sessions.",
      lookFor:'Does the tutor use exit tickets correctly? Other formative tools?' },
    { phase:'Middle', domain:'Instruction', code:'V',
      desc:'Instruct students both in person and/or virtually.',
      lookFor:'Does this tutor keep scholars engaged during tutoring?' },
    { phase:'Middle', domain:'Instruction', code:'W',
      desc:'Work with students to help them understand key concepts, especially those learned in the classroom.',
      lookFor:'Does the tutor successfully follow lesson plans that were developed to meet individual scholar needs?' },
    { phase:'Middle', domain:'Instruction', code:'X',
      desc:'Assist students with homework, project, test preparation, papers, research, and other academic tasks.',
      lookFor:'When appropriate, does the tutor support scholars while observing whole class instruction?' },
    { phase:'Middle', domain:'Instruction', code:'Y',
      desc:'Utilize tools needed to complete tasks such as Computers, Scanners, Scientific Calculators, or a Multi-line telephone system.',
      lookFor:'Were lesson plans submitted electronically? Does the tutor use available tools appropriately?' },
    { phase:'Middle', domain:'Instruction', code:'Z',
      desc:'Identifying the educational needs of others, developing formal educational or training programs or classes, and teaching or instructing others.',
      lookFor:'Has this tutor successfully submitted lesson plans consistently?' },
    { phase:'Middle', domain:'Instruction', code:'AA',
      desc:'Identifying the developmental needs of others and coaching, mentoring, or otherwise helping others to improve their knowledge or skills.',
      lookFor:'Has this tutor successfully submitted lesson plans consistently?' },
    { phase:'Middle', domain:'Instruction', code:'AB',
      desc:'Translating or explaining what information means and how it can be used.',
      lookFor:'Does the tutor explain concepts in grade- and age-appropriate language?' },
    // ── Middle · Environment ──────────────────────────────────────────────
    { phase:'Middle', domain:'Environment', code:'E',
      desc:'Scholars report overall enjoyment working with apprentices through session surveys on Pearl.',
      lookFor:"Is this tutor's scholar rating 4.0 or higher?" },
    { phase:'Middle', domain:'Environment', code:'H',
      desc:'Developing and distributing teaching materials to supplement classroom lessons, including study guides.',
      lookFor:'Does this tutor use hands-on materials from NJTC?' },
    { phase:'Middle', domain:'Environment', code:'J',
      desc:'Collaborate with students, parents, teachers, school administrators, or counselors to determine student needs, develop tutoring plans, or assess student progress.',
      lookFor:'Has the tutor successfully completed progress reports?' },
    { phase:'Middle', domain:'Environment', code:'M',
      desc:'Serves as an informed advocate for Education.',
      lookFor:'Actively participate in Knowtion; sharing resources from Knowledge page and collaborating in discussion threads.' },
    // ── Middle · Planning ─────────────────────────────────────────────────
    { phase:'Middle', domain:'Planning', code:'B',
      desc:'Attend and bring required materials to classroom, weekly coaching sessions, and team meetings.',
      lookFor:'Is the tutor prepared for both classroom instructional responsibilities as well as meetings with team and classroom teachers?' },
    { phase:'Middle', domain:'Planning', code:'C',
      desc:'Review and make notes on unit plans prior to collaboration (i.e. unit starters, standards, lesson plans, etc.).',
      lookFor:'Have they successfully modified lessons based on updated formative or summative assessments?' },
    { phase:'Middle', domain:'Planning', code:'F',
      desc:'Collaborate with classroom teacher — share unit plan and work to connect prioritized skills from iReady to current year long scope and sequence.',
      lookFor:'Has the tutor uploaded lessons correctly? Did the tutor have the opportunity to collaborate with the classroom teacher?' },
    { phase:'Middle', domain:'Planning', code:'G',
      desc:'In discussion with the instructional coach, review additional student achievement data to update unit planning and priorities for each student.',
      lookFor:'Has the tutor uploaded lessons correctly? Have they modified lessons based on updated assessments?' },
    { phase:'Middle', domain:'Planning', code:'H',
      desc:'Working with the classroom teacher to share their data related to the goals and determine the effectiveness of the intervention.',
      lookFor:'Have they modified lessons based on updated formative or summative assessments?' },
    { phase:'Middle', domain:'Planning', code:'J',
      desc:'Develop teaching or training materials, such as handouts, study materials, or quizzes.',
      lookFor:'Are appropriate materials linked to the lesson planning document?' },
    { phase:'Middle', domain:'Planning', code:'L',
      desc:'Developing, designing, or creating new applications, ideas, relationships, systems, or products, including artistic contributions.',
      lookFor:'Has the tutor been observed to have completed any of these areas: developed relationships, created tutoring group systems?' },
    { phase:'Middle', domain:'Planning', code:'M',
      desc:'Prepare progress reports and distribute them to individuals in charge of parent communication.',
      lookFor:'Has the tutor successfully completed progress reports? Have they shared progress with the classroom teacher or site leader?' },
    { phase:'Middle', domain:'Planning', code:'N',
      desc:'Estimating quantities or determining time, resources, or materials needed to perform activity.',
      lookFor:'Is the tutor allocating sufficient time to cover concepts? Have they modified lessons based on updated assessments?' },
    { phase:'Middle', domain:'Planning', code:'R',
      desc:'Create unit planning of instruction for each group of students.',
      lookFor:'Has this tutor successfully submitted lesson plans consistently?' },
    // ── End · Planning ────────────────────────────────────────────────────
    { phase:'End', domain:'Planning', code:'K',
      desc:'Research or recommend textbooks, software, equipment, or other learning materials to complement tutoring.',
      lookFor:'Not applicable — they can meet with IC and discuss other tools to confirm they can successfully vet materials.', na:true },
    { phase:'End', domain:'Planning', code:'O',
      desc:'Designing differentiated learning goals.',
      lookFor:'Lesson plan creation/submission.' },
    { phase:'End', domain:'Planning', code:'P',
      desc:'Choose the most effective materials to support the lesson objective, engage students with various learning styles and provide opportunities for student-to-student interaction.',
      lookFor:'Did the tutor use the most appropriate or quality materials/tools for their Lesson plan creation/submission?' },
    { phase:'End', domain:'Planning', code:'Q',
      desc:'Observe lessons with district approval to inform instruction.',
      lookFor:'During a designated classroom push-in time, did the tutor observe part or all of the teacher\'s lesson?', na:true },
    { phase:'End', domain:'Planning', code:'S',
      desc:'Prepare and facilitate tutoring workshops, collaborative projects, or academic support sessions for small groups of students.',
      lookFor:'Lesson plan creation/submission & IC observation.' },
    { phase:'End', domain:'Planning', code:'T',
      desc:'Prepare lesson plans or learning modules for tutoring sessions according to students\' needs and goals.',
      lookFor:'Lesson plan creation/submission & IC observation.' },
    { phase:'End', domain:'Planning', code:'U',
      desc:'Analyzing information and evaluating results to choose the best solution and solve problems.',
      lookFor:'Lesson plan creation/submission based on formative assessment results.' },
    // ── End · Instruction ─────────────────────────────────────────────────
    { phase:'End', domain:'Instruction', code:'A',
      desc:'Conduct sessions that are engaging and rigorous based on academic needs for scholars.',
      lookFor:'Based on multiple observations/coaching sessions (minimum 4).' },
    // ── End · Environment ─────────────────────────────────────────────────
    { phase:'End', domain:'Environment', code:'O',
      desc:'Organize a tutoring environment to promote productivity and learning.',
      lookFor:'Documented in IC observations.' },
  ];


  // fetchTapCSV: the Master Roster has 4 header rows before data.
  // Row 0=title, Row 1=section labels, Row 2=column headers, Row 3=legend, Row 4+=data.
  // Standard fetchCSV uses row 0 as headers — we need row 2 (index 2).
  async function fetchTapCSV(url, cacheKey) {
    if (cacheKey) {
      const cached = cacheGet(cacheKey);
      if (cached) return cached;
    }
    let lastErr;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const res = await fetch(url, { signal: makeSignal(15000) });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const text = await res.text();
        if (text.trim().startsWith('<')) throw new Error('HTML — not public');
        // Parse CSV rows
        const rows = parseCSV(text);
        // Row 2 (index 2) contains the real column headers in the Master Roster
        const hdrRowIdx = rows.findIndex(r => r.some(c => c.trim() === 'Full Name (Display)' || c.trim() === 'Status'));
        const hdrIdx = hdrRowIdx >= 0 ? hdrRowIdx : 2;
        const headers = rows[hdrIdx].map(h => h.trim());
        // Data rows start after headers AND the legend row (hdrIdx + 2)
        const dataRows = rows.slice(hdrIdx + 2).filter(r => r.some(c => c.trim()));
        const data = dataRows.map(row => {
          const obj = {};
          headers.forEach((h, i) => { obj[h] = (row[i] || '').trim(); });
          return obj;
        }).filter(r => r['Full Name (Display)'] || r['Full Name'] || r['Status']);
        if (cacheKey) cacheSet(cacheKey, data);
        return data;
      } catch (e) {
        lastErr = e;
        if (attempt < 2) await new Promise(r => setTimeout(r, (attempt + 1) * 2000));
      }
    }
    throw lastErr;
  }
  const HR_KEY     = '2PACX-1vRc-Air9jhOtvkVelwfvOguzAyFmGIFpQ0sDtu4q8S5kFAgQz_IZo-XBeIfQgy4GB8OdSXoyonTeLT8';
  const HR_GID     = '911694457';
  const CONCERNS_SHEET_ID = '1IZSYmLgMddPtn5Ei9mehqTWJAbpcm5Tx1GL-YytLj0k';
  const CONCERNS_GID      = '274671201';
  const OJT_FORM_ID = '1MOsppwhQmagAhVSHs29Ms4o9Ky4xYOyqy8Qs4uTrwbQ';

  const LEADER_ROLES = new Set([
    'Instructional Coach', 'Certified - Instructional Coach', 'Site Coordinator',
    'Certified - Site Coordinator', 'Site Coordinator / Tutor', 'Dual Role',
    'Instructional Coach/ Site Coordinator Dual', 'Master Trainer', 'Central Team'
  ]);

  const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
  const CACHE_KEYS = {
    att:        'njtc_team_att_v2',
    stu:        'njtc_team_stu_v2',
    sess:       'njtc_team_sess_v2',
    irEla:      'njtc_team_ir_ela_v2',
    irMath:     'njtc_team_ir_math_v2',
    ir2526Ela:  'njtc_team_ir2526_ela_v2',
    ir2526Math: 'njtc_team_ir2526_math_v2',
    sm:         'njtc_team_sm_v2',
    tap:        'njtc_team_tap_v2',
    concerns:   'njtc_team_concerns_v2',
    pearlLogin: 'njtc_team_pearl_login_v2',
    hr:         'njtc_team_hr_v2',
  };

  let _stylesInjected = false;
  let _leaderProfile  = null;
  let _leaderDistricts = [];
  let _leaderInfo = null;
  let _teamData = {};
  let _phase2Loaded = false;        // true once iReady/TAP/SM/Concerns are in
  let _openDetailName = null;       // tutor name currently open in detail panel

  /* ─────────────────────────────────────────────
     UTILS
  ───────────────────────────────────────────── */
  function escHtml(str) {
    if (str == null) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function normName(str) {
    if (!str) return '';
    return String(str)
      .toLowerCase()
      .replace(/\(.*?\)/g, '')
      .replace(/-/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  // iReady sometimes stores names as "Last, First" — generate both orderings for matching
  function normNameVariants(str) {
    const n = normName(str);
    if (!n) return [];
    const variants = [n];
    if (n.includes(',')) {
      // "torres, xavier" → "xavier torres"
      const parts = n.split(',').map(s => s.trim());
      if (parts.length === 2 && parts[0] && parts[1]) variants.push(parts[1] + ' ' + parts[0]);
    } else {
      // "xavier torres" → "torres xavier"
      const parts = n.split(' ');
      if (parts.length >= 2) variants.push(parts.slice(1).join(' ') + ' ' + parts[0]);
    }
    return variants;
  }

  function nameInSet(nameStr, nameSet) {
    return normNameVariants(nameStr).some(v => v.length > 2 && nameSet.has(v));
  }

  function normDist(str) {
    if (!str) return '';
    return String(str).toLowerCase().trim();
  }

  function distMatch(a, b) {
    const na = normDist(a), nb = normDist(b);
    if (!na || !nb) return false;
    return na.includes(nb) || nb.includes(na);
  }

  function safe(val, fallback) {
    if (val == null || val === '' || String(val).toLowerCase() === 'null' || String(val).toLowerCase() === 'undefined') {
      return fallback !== undefined ? fallback : '—';
    }
    return val;
  }

  function pct(num, den) {
    if (!den || isNaN(den) || den === 0) return null;
    return Math.round((num / den) * 100);
  }

  function avatarColor(id) {
    const colors = ['#1B3A6B','#1C7C8C','#4f46e5','#7c3aed','#db2777','#0891b2','#059669','#d97706'];
    let hash = 0;
    for (let i = 0; i < String(id || '').length; i++) hash = (hash * 31 + String(id)[i].charCodeAt(0)) & 0xffffffff;
    return colors[Math.abs(hash) % colors.length];
  }

  function initials(name) {
    if (!name) return '?';
    const parts = String(name).trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    return (parts[0][0] || '?').toUpperCase();
  }

  function attColor(p) {
    if (p == null) return '#6b7280';
    if (p >= 95) return '#10b981';
    if (p >= 90) return '#34d399';
    if (p >= 80) return '#f59e0b';
    return '#ef4444';
  }

  function surveyColor(score) {
    if (score == null) return '#6b7280';
    if (score >= 4.5) return '#10b981';
    if (score >= 4.0) return '#1C7C8C';
    if (score >= 3.5) return '#f59e0b';
    return '#ef4444';
  }

  /* ─────────────────────────────────────────────
     CSV PARSER
  ───────────────────────────────────────────── */
  function parseCSV(text) {
    const rows = [];
    let row = [], field = '', inQuote = false;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i], next = text[i + 1];
      if (inQuote) {
        if (ch === '"' && next === '"') { field += '"'; i++; }
        else if (ch === '"') { inQuote = false; }
        else { field += ch; }
      } else {
        if (ch === '"') { inQuote = true; }
        else if (ch === ',') { row.push(field); field = ''; }
        else if (ch === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
        else if (ch === '\r') { /* skip */ }
        else { field += ch; }
      }
    }
    if (field || row.length) { row.push(field); rows.push(row); }
    return rows;
  }

  function csvToObjects(text) {
    const rows = parseCSV(text);
    if (rows.length < 2) return [];
    const headers = rows[0].map(h => h.trim());
    return rows.slice(1).map(row => {
      const obj = {};
      headers.forEach((h, i) => { obj[h] = (row[i] || '').trim(); });
      return obj;
    });
  }

  /* ─────────────────────────────────────────────
     SESSION CACHE
  ───────────────────────────────────────────── */
  function cacheGet(key) {
    try {
      const raw = sessionStorage.getItem(key);
      if (!raw) return null;
      const { ts, data } = JSON.parse(raw);
      if (Date.now() - ts > CACHE_TTL) { sessionStorage.removeItem(key); return null; }
      return data;
    } catch (e) { return null; }
  }

  function cacheSet(key, data) {
    try { sessionStorage.setItem(key, JSON.stringify({ ts: Date.now(), data })); } catch (e) {}
  }

  /* ─────────────────────────────────────────────
     FETCH HELPERS
  ───────────────────────────────────────────── */
  // Cross-browser abort signal with timeout (AbortSignal.timeout not in older Safari/iOS)
  function makeSignal(ms) {
    if (typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function') {
      return AbortSignal.timeout(ms);
    }
    const ctrl = new AbortController();
    setTimeout(() => ctrl.abort(), ms);
    return ctrl.signal;
  }

  async function fetchCSV(url, cacheKey, timeoutMs) {
    if (cacheKey) {
      const cached = cacheGet(cacheKey);
      if (cached) return cached;
    }
    const ms = timeoutMs || 45000;
    let lastErr;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const res = await fetch(url, { signal: makeSignal(ms) });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const text = await res.text();
        if (text.trim().startsWith('<')) throw new Error('HTML response — sheet not public');
        const data = csvToObjects(text);
        if (cacheKey) cacheSet(cacheKey, data);
        return data;
      } catch (e) {
        lastErr = e;
        if (attempt < 2) await new Promise(r => setTimeout(r, (attempt + 1) * 2000));
      }
    }
    throw lastErr;
  }

  function pearlUrl(gid) {
    return `https://docs.google.com/spreadsheets/d/e/${PEARL_KEY}/pub?output=csv&gid=${gid}`;
  }
  function pearlLoginUrl() {
    return `https://docs.google.com/spreadsheets/d/e/${PEARL_LOGIN_KEY}/pub?output=csv&gid=0`;
  }
  function ireadyUrl(gid) {
    return `https://docs.google.com/spreadsheets/d/e/${IREADY_KEY}/pub?output=csv&gid=${gid}`;
  }
  function ir2526Url(gid) {
    return `https://docs.google.com/spreadsheets/d/${IR_2526_SHEET_ID}/gviz/tq?tqx=out:csv&gid=${gid}`;
  }
  function smUrl() {
    return `https://docs.google.com/spreadsheets/d/e/${SM_2PACX}/pub?output=csv&gid=${SM_GID}`;
  }
  function hrUrl() {
    return `https://docs.google.com/spreadsheets/d/e/${HR_KEY}/pub?output=csv&gid=${HR_GID}`;
  }
  function concernsUrl() {
    return `https://docs.google.com/spreadsheets/d/${CONCERNS_SHEET_ID}/gviz/tq?tqx=out:csv&gid=${CONCERNS_GID}`;
  }

  /* ─────────────────────────────────────────────
     LEADER DETECTION
  ─────────────────────────────────────────────
     Primary: HR Master List (pub CSV, cached)
     Fallback: Pearl ATT non-Instructor rows
               (works when HR pub URL is unavailable)
  ───────────────────────────────────────────── */
  async function detectLeader(userProfile) {
    // Try HR list first (authoritative)
    try {
      const hrRows = await fetchCSV(hrUrl(), CACHE_KEYS.hr, 20000);
      const active = hrRows.filter(r =>
        r['Academic Year'] === '2025-2026' &&
        r['Active / Terminated Status'] === 'Active'
      );
      const matchRow = active.find(r =>
        normName(r['Full Name']) === normName(userProfile.name) ||
        (r['Email Address'] && r['Email Address'].toLowerCase() === (userProfile.email || '').toLowerCase())
      );
      if (matchRow) {
        const role = (matchRow['Position / Role'] || '').trim();
        if (LEADER_ROLES.has(role)) {
          const siteField = matchRow['Site / School'] || '';
          const districts = siteField.split(',').map(s => s.trim()).filter(Boolean);
          return { role, districts, siteField, source: 'hr' };
        }
      }
    } catch (e) {
      console.warn('[NJTCTeam] HR list unavailable, trying ATT fallback:', e.message);
    }

    // Fallback: detect leader role from Pearl ATT sheet
    // Non-Instructor rows belong to SCs / ICs / Dual Role staff
    try {
      const attRows = cacheGet(CACHE_KEYS.att) ||
        await fetchCSV(pearlUrl(PEARL_ATT_GID), CACHE_KEYS.att, 60000);
      const leaderNorm = normName(userProfile.name || '');
      const leaderRows = attRows.filter(r => {
        const role = (r['Role'] || '').trim();
        const u    = normName(r['User'] || '');
        return u === leaderNorm && role !== 'Instructor' && role !== 'Student';
      });
      if (leaderRows.length > 0) {
        const role = leaderRows[0]['Role'] || 'Site Coordinator';
        const schools = [...new Set(leaderRows.map(r => (r['School'] || r['Site'] || '').trim()).filter(Boolean))];
        console.log('[NJTCTeam] Leader detected via ATT fallback:', role, schools);
        return { role, districts: schools, siteField: schools.join(', '), source: 'att' };
      }
    } catch (e) {
      console.warn('[NJTCTeam] ATT fallback also failed:', e.message);
    }

    return null;
  }

  /* ─────────────────────────────────────────────
     DATA LOADING  (two-phase progressive)
  ─────────────────────────────────────────────
     Phase 1 — CRITICAL (blocks roster render):
       Pearl ATT + STU + Login (pub CSVs, same CDN, fast)
     Phase 2 — ENHANCEMENT (background, non-blocking):
       iReady 25-26 ELA/Math, legacy iReady, SM, TAP, Concerns
  ───────────────────────────────────────────── */

  // Phase 1a: ATT + Login only — these are the fastest and give us the tutor roster
  async function loadAttAndLogin() {
    const [attResult, loginResult] = await Promise.allSettled([
      fetchCSV(pearlUrl(PEARL_ATT_GID), CACHE_KEYS.att),
      fetchCSV(pearlLoginUrl(),         CACHE_KEYS.pearlLogin),
    ]);
    ['PearlATT','PearlLogin'].forEach((lbl, i) => {
      const r = [attResult, loginResult][i];
      if (r.status === 'rejected') console.warn('[NJTCTeam] Phase1 source failed:', lbl, r.reason);
    });
    return {
      att:   attResult.status   === 'fulfilled' ? attResult.value   : [],
      stu:   [], // populated in Phase 1b
      login: loginResult.status === 'fulfilled' ? loginResult.value : [],
    };
  }

  // Phase 1b: STU + SESS — load together; SESS is the authoritative tutor→scholar pairing
  async function loadStu() {
    const [stuR, sessR] = await Promise.allSettled([
      fetchCSV(pearlUrl(PEARL_STU_GID),  CACHE_KEYS.stu),
      fetchCSV(pearlUrl(PEARL_SESS_GID), CACHE_KEYS.sess),
    ]);
    if (stuR.status  === 'rejected') console.warn('[NJTCTeam] STU load failed:',  stuR.reason?.message);
    if (sessR.status === 'rejected') console.warn('[NJTCTeam] SESS load failed:', sessR.reason?.message);
    return {
      stu:  stuR.status  === 'fulfilled' ? stuR.value  : [],
      sess: sessR.status === 'fulfilled' ? sessR.value : [],
    };
  }

  async function loadEnhancementData() {
    // TAP + Concerns load first — these drive the tutor card badges and TAP block.
    // iReady and SM are optional enrichment — load concurrently but don't block.
    console.log('[NJTCTeam] Phase 2: fetching TAP + Concerns...');
    const [tapR, concernR] = await Promise.allSettled([
      fetchTapCSV(TAP_URL, CACHE_KEYS.tap),
      fetchCSV(concernsUrl(), CACHE_KEYS.concerns),
    ]);;
    if (tapR.status     === 'rejected') console.warn('[NJTCTeam] TAP load failed:', tapR.reason);
    if (concernR.status === 'rejected') console.warn('[NJTCTeam] Concerns load failed:', concernR.reason);

    // iReady + SM: load with shorter timeout — return empty if unavailable
    console.log('[NJTCTeam] Phase 2: fetching iReady + SM...');
    const [irElaR, irMathR, ir2526ElaR, ir2526MathR, smR] = await Promise.allSettled([
      fetchCSV(ireadyUrl(IREADY_ELA_GID),   CACHE_KEYS.irEla,      30000),
      fetchCSV(ireadyUrl(IREADY_MATH_GID),  CACHE_KEYS.irMath,     30000),
      fetchCSV(ir2526Url(IR_2526_ELA_GID),  CACHE_KEYS.ir2526Ela,  30000),
      fetchCSV(ir2526Url(IR_2526_MATH_GID), CACHE_KEYS.ir2526Math, 30000),
      fetchCSV(smUrl(),                     CACHE_KEYS.sm,         30000),
    ]);;
    ['iReadyELA','iReadyMath','iReady2526ELA','iReady2526Math','SM'].forEach((lbl, i) => {
      const r = [irElaR,irMathR,ir2526ElaR,ir2526MathR,smR][i];
      if (r.status === 'rejected') console.warn('[NJTCTeam] Enhancement source unavailable:', lbl, r.reason?.message || r.reason);
    });
    const v = r => r.status === 'fulfilled' ? r.value : [];
    return {
      irEla: v(irElaR), irMath: v(irMathR),
      tap: tapR.status === 'fulfilled' ? tapR.value : [],
      concerns: concernR.status === 'fulfilled' ? concernR.value : [],
      ir2526Ela: v(ir2526ElaR), ir2526Math: v(ir2526MathR),
      sm: v(smR),
    };
  }

  function filterData(rawAtt, rawStu, rawSess, rawLogin, rawEnhancement, leaderDistricts, leaderName) {
    const att    = rawAtt;
    const stu    = rawStu;
    const sess   = rawSess || [];
    const login  = rawLogin;
    const irEla     = rawEnhancement ? rawEnhancement.irEla    : [];
    const irMath    = rawEnhancement ? rawEnhancement.irMath   : [];
    const tap       = rawEnhancement ? rawEnhancement.tap      : [];
    const concerns  = rawEnhancement ? rawEnhancement.concerns : [];
    const ir2526Ela  = rawEnhancement ? rawEnhancement.ir2526Ela  : [];
    const ir2526Math = rawEnhancement ? rawEnhancement.ir2526Math : [];
    const sm         = rawEnhancement ? rawEnhancement.sm         : [];

    const leaderNorm = normName(leaderName || '');

    // ── Step 1 (PRIMARY): Pearl Login/ID sheet ────────────────────────────────
    // The login sheet maps every staff member to their school(s) and district.
    // It's the most authoritative source because it's maintained by site admins.
    // Columns vary — try common permutations for name, email, school, district.
    const loginSchools = new Set();
    if (login.length > 0) {
      login.forEach(r => {
        const rName  = normName(r['Full Name'] || r['Name'] || r['Staff Name'] || r['User'] || '');
        const rEmail = (r['Email'] || r['Email Address'] || r['email'] || '').trim().toLowerCase();
        const isMatch = rName === leaderNorm ||
          (rEmail && rEmail === (window.NJTC_USER_PROFILE && window.NJTC_USER_PROFILE.email || '').toLowerCase());
        if (!isMatch) return;
        // Collect every school field on the row (may be comma-separated or multi-column)
        ['School', 'School Name', 'Site', 'Site / School', 'Schools', 'school'].forEach(col => {
          const val = (r[col] || '').trim();
          if (!val) return;
          val.split(/[,;]/).map(s => s.trim()).filter(Boolean).forEach(s => loginSchools.add(s));
        });
      });
    }

    // ── Step 2 (SECONDARY): Pearl ATT non-Instructor rows ────────────────────
    // Captures sessions the leader supervised — authoritative when Login sheet
    // doesn't have separate rows per school for Dual Role leaders.
    const attLeaderSchools = new Set();
    att.forEach(r => {
      const role = (r['Role'] || '').trim();
      if (role === 'Instructor') return;
      const u = normName(r['User'] || '');
      if (!u || u !== leaderNorm) return;
      const school = (r['School'] || r['Site'] || '').trim();
      if (school) attLeaderSchools.add(school);
    });

    // Merge both sources
    const combinedSchools = new Set([...loginSchools, ...attLeaderSchools]);

    // ── Step 3: campus sibling expansion ─────────────────────────────────────
    // Dual Role: "iLearn Paterson MS" → also pull "iLearn Paterson ES" (same base)
    function campusBase(s) {
      return s.toLowerCase()
        .replace(/\s*[-–]\s*(ms|es|hs|middle|elementary|high|k-\d+)\s*$/i, '')
        .replace(/\s+(ms|es|hs|middle\s+school|elementary\s+school|high\s+school)\s*$/i, '')
        .trim();
    }
    const leaderBases = new Set([...combinedSchools].map(campusBase));
    const allPearlSchools = new Set(att.map(r => (r['School'] || r['Site'] || '').trim()).filter(Boolean));
    const expandedSchools = new Set(combinedSchools);
    if (leaderBases.size > 0) {
      allPearlSchools.forEach(school => {
        if (leaderBases.has(campusBase(school))) expandedSchools.add(school);
      });
    }

    // ── Step 4: site-match predicate ─────────────────────────────────────────
    // Primary: exact Pearl school name set (Login + ATT derived, Dual-Role-aware)
    // Fallback: HR site field substring matching (leader not yet in any Pearl data)
    function siteMatch(r) {
      const school = (r['School'] || r['Site'] || '').trim();
      const dist   = (r['District'] || r['district'] || '').trim();
      if (expandedSchools.size > 0) return expandedSchools.has(school);
      return leaderDistricts.some(ld => distMatch(dist, ld) || distMatch(school, ld));
    }

    // ATT: Instructor rows → tutor roster
    const filteredAtt  = att.filter(r => (r['Role'] || '').trim() === 'Instructor' && siteMatch(r));

    // ATT: Student rows → scholar attendance (Role = "Student" in Pearl ATT)
    // These rows have User = scholar name, Attendance Status, School, Session Date
    const filteredAttStudents = att.filter(r => {
      const role = (r['Role'] || '').trim();
      return (role === 'Student' || role === 'Scholar') && siteMatch(r);
    });

    // Build the set of tutor keys from the ATT-filtered roster so we can scope STU rows
    const leaderTutorKeys = new Set(filteredAtt.map(r => normName(r['User'] || r['Tutor Name'] || '')).filter(Boolean));

    // STU sheet: "Filled For" = tutor name; used for survey scores + scholar name list
    const filteredStu  = stu.filter(r  => {
      const filledFor = normName(r['Filled For'] || r['Tutor Name'] || '');
      if (leaderTutorKeys.size > 0) return filledFor && leaderTutorKeys.has(filledFor);
      return siteMatch(r);
    });

    // iReady: DO NOT pre-filter by school — iReady school names differ from Pearl
    // school names and siteMatch would return 0 rows. Pass all rows to build();
    // per-tutor scholar matching (Pearl STU bridge) handles correct scoping.
    const filteredEla    = irEla;
    const filteredMath   = irMath;
    const filtered2526Ela  = ir2526Ela;
    const filtered2526Math = ir2526Math;

    // Standards Mastery: all rows (per-tutor filter happens in build() by Class Teacher)
    const filteredSm = sm;

    const filteredTap  = tap.filter(r  => {
      const site = r['Placement (Site)'] || r['Site / School'] || r['Site'] || r['I'] || '';
      const fname = r['Full Name (Display)'] || r['Full Name'] || '';
      return fname.length > 0 && leaderDistricts.some(ld => distMatch(site, ld));
    });

    const tapLoaded = tap.length > 0;

    console.log('[NJTCTeam] Login schools:', [...loginSchools], '| ATT schools:', [...attLeaderSchools]);
    console.log('[NJTCTeam] Expanded schools:', [...expandedSchools]);
    console.log('[NJTCTeam] Filtered tutors (ATT):', filteredAtt.length, '| ATT students:', filteredAttStudents.length, '| STU:', filteredStu.length, '| TAP loaded:', tapLoaded);
    if (filteredAttStudents.length > 0) {
      const sample = filteredAttStudents[0];
      console.log('[NJTCTeam] ATT student sample keys:', Object.keys(sample), '| User:', sample['User'], '| Role:', sample['Role'], '| UserID:', sample['Pearl User ID'] || sample['User ID'] || sample['User_ID']);
    }

    // SESS: filter by school — provides authoritative tutor→scholar pairing
    // SESS col 1=Instructor, col 2=Students (comma-sep), col 11=School, col 15=Pearl Instructor ID, col 16=Pearl Student IDs
    const filteredSess = sess.filter(r => {
      const school = (r['School'] || Object.values(r)[11] || '').trim();
      return expandedSchools.size > 0 ? expandedSchools.has(school)
        : leaderDistricts.some(ld => distMatch(school, ld));
    });

    return { att: filteredAtt, attStudents: filteredAttStudents, stu: filteredStu, sess: filteredSess,
             irEla: filteredEla, irMath: filteredMath,
             ir2526Ela: filtered2526Ela, ir2526Math: filtered2526Math, sm: filteredSm,
             tap: filteredTap, concerns, tapLoaded };
  }

  /* ─────────────────────────────────────────────
     DATA AGGREGATION
  ───────────────────────────────────────────── */
  function buildTutorMap(attRows) {
    // Pearl ATT uses "User" for the person's name; only Instructor rows reach here
    const map = {};
    attRows.forEach(r => {
      const tutorName = (r['User'] || r['Tutor Name'] || r['Staff Name'] || '').trim();
      if (!tutorName) return;
      const key = normName(tutorName);
      if (!map[key]) {
        map[key] = {
          name: tutorName,
          district: r['District'] || '',
          school: r['School'] || r['Site'] || '',
          role: 'Instructor',
          id: key,
          attRows: []
        };
      }
      map[key].attRows.push(r);
    });
    return map;
  }

  function computeAttMetrics(attRows) {
    let attended = 0, absent = 0, si = 0, total = 0;
    const absenceReasons = {};
    attRows.forEach(r => {
      const vals   = Object.values(r);
      const status = (r['Attendance Status'] || r['Status'] || vals[6] || '').trim();
      const reason = (r['Attendance Missed Reason'] || r['Missed Reason'] || r['Absence Reason'] || r['Reason'] || vals[7] || '').trim();
      total++;
      // Pearl ATT exact status values (confirmed from Central portal)
      if (status === 'Attended' || status === 'Late') attended++;
      else if (status === 'Missed' || /^Absent/i.test(status) || /^Tutor Left/i.test(status)) {
        absent++;
        // Only add to absence reasons if this is NOT a service interruption
        // SIs are tracked separately so the table only shows genuine absence reasons
        if (reason && !isSI(status, reason)) {
          absenceReasons[reason] = (absenceReasons[reason] || 0) + 1;
        }
      }
      // Service interruption: any session where tutoring service was not delivered
      if (isSI(status, reason)) si++;
    });
    return { attended, absent, si, total, absenceReasons, rate: pct(attended, total) };
  }

  // attStudentRows = Pearl ATT rows where Role = "Student" scoped to this tutor's scholars
  // stuRows        = Pearl STU survey rows scoped to this tutor (used for names + survey scores only)
  function computeStuMetrics(stuRows, attStudentRows) {
    const ATT_ROWS = attStudentRows || [];
    // SI detection uses module-level isSI() function

    // Build scholar list from STU survey rows first (names + grade)
    // STU col 0 = Filled By (scholar display name), col 8 = School, col 9 = District
    const scholarMap = {};
    stuRows.forEach(r => {
      const vals = Object.values(r);
      const name = r['Filled By'] || vals[0] || r['User'] || r['Scholar Name'] || r['Student Name'] || '';
      const grade = r['Grade'] || '';
      const key = normName(name);
      if (!key) return;
      if (!scholarMap[key]) scholarMap[key] = { name, grade, attended: 0, absent: 0, si: 0, total: 0, fromAtt: false };
    });

    // Populate attendance from ATT student rows (Role = "Student") — the real source
    // Pearl ATT col indices (0-based): 0=User, 6=Attendance Status, 7=Missed Reason, 8=Grade
    ATT_ROWS.forEach(r => {
      const vals = Object.values(r);
      // Use header name first, fall back to column index (matches Central portal approach)
      const name   = (r['User'] || vals[0] || '').trim();
      const grade  = r['Grade'] || vals[8] || '';
      const status = (r['Attendance Status'] || vals[6] || '').trim();
      const reason = (r['Attendance Missed Reason'] || r['Missed Reason'] || r['Absence Reason'] || vals[7] || '').trim();
      const key = normName(name);
      if (!key) return;
      if (!scholarMap[key]) scholarMap[key] = { name, grade, attended: 0, absent: 0, si: 0, total: 0, fromAtt: true };
      if (!scholarMap[key].grade && grade) scholarMap[key].grade = grade;
      scholarMap[key].total++;
      if (status === 'Attended' || status === 'Late') scholarMap[key].attended++;
      else if (status === 'Missed' || /^Absent/i.test(status) || /^Tutor Left/i.test(status)) scholarMap[key].absent++;
      // Service Interruption: tutor absent with no sub (tracked separately from scholar absences)
      if (isSI(status, reason)) scholarMap[key].si++;
    });
    const scholars = Object.values(scholarMap);
    scholars.forEach(s => { s.rate = pct(s.attended, s.total); });
    const uniqueCount = scholars.length;
    // Survey scores — index-primary matching Central portal (STU: col2=Conf, col3=Enjoy, col4=Learn, col5=Overall)
    const parseV = v => { const n = parseFloat(v); return isNaN(n) ? null : n; };
    const surveyFields = {
      confidence: r => { const k = Object.keys(r); return parseV(r[k[2]] ?? r['Confidence'] ?? r['How confident do you feel about what you are learning?'] ?? null); },
      enjoyment:  r => { const k = Object.keys(r); return parseV(r[k[3]] ?? r['Enjoyment'] ?? r['How much did you enjoy this session with <aboutName>?'] ?? r['How much did you enjoy this session with &lt;aboutName&gt;?'] ?? null); },
      learning:   r => { const k = Object.keys(r); return parseV(r[k[4]] ?? r['Learning'] ?? r['How much did you learn in this session?'] ?? null); },
      overall:    r => { const k = Object.keys(r); return parseV(r[k[5]] ?? r['Overall'] ?? r['How would you rate this session overall?'] ?? null); },
    };
    // A row has survey data if any of the four fields parse to a number
    const surveyRows = stuRows.filter(r => {
      return surveyFields.confidence(r) !== null || surveyFields.enjoyment(r) !== null ||
             surveyFields.learning(r) !== null   || surveyFields.overall(r)  !== null;
    });
    const sConf = [], sEnj = [], sLearn = [], sOvr = [];
    surveyRows.forEach(r => {
      const c = surveyFields.confidence(r), e = surveyFields.enjoyment(r),
            l = surveyFields.learning(r),   o = surveyFields.overall(r);
      if (c !== null) sConf.push(c);
      if (e !== null) sEnj.push(e);
      if (l !== null) sLearn.push(l);
      if (o !== null) sOvr.push(o);
    });
    const avgArr = arr => arr.length ? Math.round(arr.reduce((s,v)=>s+v,0)/arr.length*10)/10 : 0;
    const surveyScores = {
      confidence: avgArr(sConf), enjoyment: avgArr(sEnj),
      learning:   avgArr(sLearn), overall:  avgArr(sOvr),
      count: Math.max(sConf.length, sEnj.length, sLearn.length, sOvr.length),
    };
    return { scholars, uniqueCount, surveyScores };
  }

  // Pair BOY + EOY rows from the multi-row-per-diagnostic EOY CSV.
  // Each student appears twice: once with Baseline Diagnostic=Y (BOY) and once with Most Recent=Y (EOY).
  // Returns one paired object per student suitable for normalizeIr2526Row.
  function pairIr2526Diagnostics(rows) {
    const students = {};
    rows.forEach(r => {
      const name  = (r['Full Name'] || r['Student Name'] || r['Name'] || '').trim();
      const sid   = (r['Student ID'] || '').trim();
      const key   = sid || normName(name);
      if (!key) return;
      if (!students[key]) students[key] = {
        name, sid,
        grade:    r['Student Grade'] || r['Grade'] || '',
        school:   r['School'] || '',
        district: r['Districts'] || r['District'] || '',
        boy: null, eoy: null
      };
      const isBoy = (r['Baseline Diagnostic (Y/N)'] || '').trim().toUpperCase() === 'Y';
      const isEoy = (r['Most Recent Diagnostic YTD (Y/N)'] || '').trim().toUpperCase() === 'Y';
      const placement = (r['Overall Relative Placement'] || '').trim();
      if (isBoy) students[key].boy = placement;
      if (isEoy) {
        students[key].eoy = placement;
        students[key].pctTypical = parseFloat(r['Percent Progress to Annual Typical Growth (%)'] || 0) || 0;
        students[key].gain = parseFloat(r['Diagnostic Gain'] || 0) || null;
      }
    });
    return Object.values(students).filter(s => s.boy || s.eoy).map(s => ({
      'Full Name': s.name,
      'Student ID': s.sid,
      'Grade': s.grade,
      'School': s.school,
      'District': s.district,
      'Base/Fall Overall Relative Placement': s.boy  || '',
      'Spring/EOY Overall Relative Placement': s.eoy || '',
      'Pct Progress Toward Typical Growth': s.pctTypical || 0,
      'SS Gain': s.gain,
    }));
  }

  // Extract iReady 25-26 EOY/Longitudinal columns (paired output from pairIr2526Diagnostics)
  function normalizeIr2526Row(r) {
    return {
      name:      r['Full Name'] || r['Student Name'] || r['Name'] || '',
      id:        r['Student ID']   || r['Student Id'] || '',
      grade:     r['Grade']        || '',
      school:    r['School']       || '',
      district:  r['District']     || r['Districts'] || '',
      basePlacement:   r['Base/Fall Overall Relative Placement']   || r['Fall Overall Relative Placement'] || r['Beginning of Year Placement'] || '',
      springPlacement: r['Spring/EOY Overall Relative Placement']  || r['Spring Overall Relative Placement'] || r['End of Year Placement'] || '',
      pctTypical:      parseFloat(r['Spring %'] || r['Pct Progress Toward Typical Growth'] || r['% Typical Growth'] || 0),
      isLongitudinal:  !!(r['Spring/EOY Overall Relative Placement'] || r['Spring Overall Relative Placement']),
      _raw: r,
    };
  }

  function placementLevel(str) {
    const s = (str || '').toLowerCase();
    if (s.includes('mid') || s.includes('on grade') || s.includes('at grade')) return 2;
    if (s.includes('early') || s.includes('below')) return 1;
    if (s.includes('above') || s.includes('advanc')) return 3;
    return 0;
  }

  function computeIReadyMetrics(irRows, is2526) {
    if (!irRows || irRows.length === 0) return { total: 0, scholars: [] };
    const rows = is2526 ? irRows.map(normalizeIr2526Row) : irRows;
    let improved = 0, maintained = 0, declined = 0;
    const growthVals = [], gainVals = [];

    rows.forEach(r => {
      if (is2526) {
        const base   = placementLevel(r.basePlacement);
        const spring = placementLevel(r.springPlacement);
        if (base && spring) {
          if (spring > base) improved++;
          else if (spring === base) maintained++;
          else declined++;
        }
        if (!isNaN(r.pctTypical) && r.pctTypical > 0) growthVals.push(r.pctTypical);
      } else {
        const mv = (r['Movement'] || r['Placement Level Change'] || '').toLowerCase();
        if (mv.includes('improv') || mv === '▲' || mv === 'up') improved++;
        else if (mv.includes('maintain') || mv === '=' || mv === 'same') maintained++;
        else if (mv.includes('declin') || mv === '▼' || mv === 'down') declined++;
        const gv = parseFloat(r['% Typical Growth'] || r['Typical Growth'] || 0);
        if (!isNaN(gv) && gv > 0) growthVals.push(gv);
        const gain = parseFloat(r['Scale Score Gain'] || r['SS Gain'] || 0);
        if (!isNaN(gain)) gainVals.push(gain);
      }
    });

    const total = irRows.length;
    const sorted = [...growthVals].sort((a,b)=>a-b);
    const medGrowth = sorted.length ? Math.round(sorted[Math.floor(sorted.length/2)]) : null;
    const avgGain   = gainVals.length ? Math.round(gainVals.reduce((a,b)=>a+b,0)/gainVals.length) : null;
    return {
      total,
      improved, maintained, declined,
      pctImproved:   pct(improved, total),
      pctMaintained: pct(maintained, total),
      pctDeclined:   pct(declined, total),
      medGrowth, avgGain,
      scholars: is2526 ? rows : irRows,
      is2526,
    };
  }

  function computeSmMetrics(smRows, tutorName) {
    const tn = normName(tutorName);
    const myRows = smRows.filter(r => {
      const teacher = normName(r['Class Teacher(s)'] || r['Class Teacher'] || r['Instructor'] || r['Teacher'] || '');
      return teacher && teacher.includes(tn);
    });
    if (!myRows.length) return null;
    const scholarMap = {};
    myRows.forEach(r => {
      const name = r['Student Name'] || r['Student'] || '';
      const key  = normName(name);
      if (!key) return;
      if (!scholarMap[key]) scholarMap[key] = { name, formA: null, formB: null, assessment: r['Assessment'] || '' };
      const form = (r['Form'] || '').toUpperCase();
      const score = parseFloat(r['Score'] || r['Percent Correct'] || 0);
      if (form === 'A' || form.includes('PRE'))  scholarMap[key].formA = score;
      if (form === 'B' || form.includes('POST')) scholarMap[key].formB = score;
    });
    const scholars = Object.values(scholarMap).map(s => ({
      ...s,
      improved: s.formA !== null && s.formB !== null ? s.formB > s.formA : null,
      gain:     s.formA !== null && s.formB !== null ? Math.round((s.formB - s.formA) * 10) / 10 : null,
    }));
    const withBoth = scholars.filter(s => s.improved !== null);
    const pctImproved = withBoth.length ? pct(withBoth.filter(s => s.improved).length, withBoth.length) : null;
    return { total: scholars.length, withBoth: withBoth.length, pctImproved, scholars };
  }

  // Service interruption sessions with date/reason detail
  function computeSIDetails(attRows) {
    return attRows.filter(r => {
      const status = (r['Attendance Status'] || r['Status'] || '').trim();
      const reason = (r['Attendance Missed Reason'] || r['Missed Reason'] || r['Absence Reason'] || r['Reason'] || '').trim();
      return isSI(status, reason);
    }).map(r => {
      const status = (r['Attendance Status'] || r['Status'] || '').trim();
      const reason = (r['Attendance Missed Reason'] || r['Missed Reason'] || r['Absence Reason'] || r['Reason'] || '').trim();
      // Categorize: tutor-caused vs school-caused
      const tutorCaused = ['Absent; Not Covered', 'Tutor Left Early', 'Tutor Absent'];
      const category = tutorCaused.some(p => status.includes(p) || reason.includes(p))
        ? 'Tutor Absence'
        : 'School Disruption';
      return {
        date:     r['Session Date'] || r['Date'] || r['Sess Date'] || '',
        status:   status,
        reason:   reason,
        school:   r['School'] || r['Site'] || '',
        category: category,
      };
    });
  }

  // Scholar survey rows that need attention (any dimension avg < 3.0 for a scholar)
  function computeSurveyAttention(stuRows) {
    const parseV = v => { const n = parseFloat(v); return isNaN(n) ? null : n; };
    const scholarSurveys = {};
    stuRows.forEach(r => {
      const scholar = r['Filled By'] || r['User'] || r['Scholar Name'] || r['Student Name'] || '';
      const key = normName(scholar);
      if (!key) return;
      if (!scholarSurveys[key]) scholarSurveys[key] = { name: scholar, scores: [] };
      const k = Object.keys(r);
      const conf  = parseV(r[k[2]] ?? r['Confidence'] ?? r['How confident do you feel about what you are learning?'] ?? null);
      const enj   = parseV(r[k[3]] ?? r['Enjoyment']  ?? r['How much did you enjoy this session with <aboutName>?']  ?? r['How much did you enjoy this session with &lt;aboutName&gt;?'] ?? null);
      const learn = parseV(r[k[4]] ?? r['Learning']   ?? r['How much did you learn in this session?'] ?? null);
      const ovr   = parseV(r[k[5]] ?? r['Overall']    ?? r['How would you rate this session overall?'] ?? null);
      const vals  = [conf, enj, learn, ovr].filter(v => v !== null);
      if (vals.length) scholarSurveys[key].scores.push(...vals);
    });
    return Object.values(scholarSurveys)
      .map(s => ({ name: s.name, avg: s.scores.length ? Math.round(s.scores.reduce((a,b)=>a+b,0)/s.scores.length*10)/10 : null, count: s.scores.length }))
      .filter(s => s.avg !== null && s.avg < 3.0)
      .sort((a,b) => a.avg - b.avg);
  }

  function getTapForTutor(tapRows, tutorName) {
    return tapRows.find(r => normName(r['Full Name (Display)'] || r['Full Name Display'] || r['Full Name'] || '') === normName(tutorName)) || null;
  }

  function getConcernsForTutor(concernRows, tutorName) {
    const nn = normName(tutorName);
    return concernRows.filter(r => {
      const cn = normName(r['Tutor Name'] || r['Staff Name'] || r['Name'] || '');
      return cn === nn;
    });
  }

  /* ─────────────────────────────────────────────
     STYLES
  ───────────────────────────────────────────── */
  function injectTeamStyles() {
    if (_stylesInjected) return;
    _stylesInjected = true;
    const css = `
      #njtcTeamContainer { font-family: 'Epilogue', sans-serif; color: #e2e8f0; min-height: 60vh; }
      .njtc-team-loading { display:flex; align-items:center; justify-content:center; height:200px; gap:12px; color:#94a3b8; font-size:1rem; }
      .njtc-spinner { width:28px; height:28px; border:3px solid rgba(255,255,255,0.1); border-top-color:#1C7C8C; border-radius:50%; animation:njtcSpin 0.7s linear infinite; }
      @keyframes njtcSpin { to { transform:rotate(360deg); } }

      /* KPI Strip */
      .njtc-kpi-strip { display:flex; flex-wrap:wrap; gap:12px; margin-bottom:28px; }
      .njtc-kpi-card { flex:1 1 130px; min-width:130px; background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.08); border-radius:12px; padding:16px 14px; }
      .njtc-kpi-label { font-size:0.72rem; color:#ffffff; font-weight:600; text-transform:uppercase; letter-spacing:0.05em; margin-bottom:6px; }
      .njtc-kpi-value { font-size:1.6rem; font-weight:700; line-height:1; }
      .njtc-kpi-sub { font-size:0.72rem; color:#e2e8f0; margin-top:4px; }

      /* Section headers */
      .njtc-section-title { font-size:1rem; font-weight:700; color:#FFB81C; text-transform:uppercase; letter-spacing:0.06em; margin:24px 0 14px; border-left:3px solid #FFB81C; padding-left:10px; }

      /* Tutor Grid */
      .njtc-tutor-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(280px,1fr)); gap:16px; }
      .njtc-tutor-card { background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.08); border-radius:14px; padding:18px 16px; cursor:pointer; transition:transform 0.15s,border-color 0.15s,box-shadow 0.15s; }
      .njtc-tutor-card:hover { transform:translateY(-3px); border-color:rgba(28,124,140,0.5); box-shadow:0 8px 24px rgba(0,0,0,0.3); }
      .njtc-tutor-card.flagged { border-color:rgba(239,68,68,0.4); }
      .njtc-tutor-card.flagged-warn { border-color:rgba(245,158,11,0.4); }

      .njtc-card-header { display:flex; align-items:center; gap:12px; margin-bottom:14px; }
      .njtc-avatar { width:44px; height:44px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:0.95rem; font-weight:700; color:#fff; flex-shrink:0; }
      .njtc-card-name { font-size:0.95rem; font-weight:600; }
      .njtc-card-role { font-size:0.75rem; color:#e2e8f0; margin-top:2px; }

      .njtc-badge { display:inline-block; font-size:0.65rem; font-weight:700; border-radius:20px; padding:2px 8px; margin-left:6px; vertical-align:middle; }
      .njtc-badge-active { background:#FFB81C22; color:#FFB81C; border:1px solid #FFB81C55; }
      .njtc-badge-prior { background:#1B3A6B33; color:#93c5fd; border:1px solid #1B3A6B55; }
      .njtc-badge-none { background:transparent; color:#6b7280; border:1px solid #374151; }

      .njtc-metrics-row { display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-bottom:12px; }
      .njtc-metric { background:rgba(0,0,0,0.2); border-radius:8px; padding:8px 10px; }
      .njtc-metric-val { font-size:1.1rem; font-weight:700; }
      .njtc-metric-label { font-size:0.65rem; color:#ffffff; font-weight:600; text-transform:uppercase; letter-spacing:0.04em; }

      .njtc-chips { display:flex; flex-wrap:wrap; gap:6px; margin-bottom:12px; }
      .njtc-chip { font-size:0.7rem; border-radius:20px; padding:3px 9px; background:rgba(255,255,255,0.07); color:#cbd5e1; }
      .njtc-chip.ela { border:1px solid #1C7C8C44; }
      .njtc-chip.math { border:1px solid #FFB81C44; }

      .njtc-flags { display:flex; gap:6px; flex-wrap:wrap; margin-bottom:10px; font-size:0.78rem; }
      .njtc-cta { font-size:0.78rem; color:#1C7C8C; font-weight:600; cursor:pointer; }
      .njtc-cta:hover { color:#34d399; }

      /* Detail Panel */
      .njtc-detail-overlay { position:fixed; inset:0; background:rgba(0,0,0,0.5); z-index:9990; opacity:0; transition:opacity 0.25s; pointer-events:none; }
      .njtc-detail-overlay.open { opacity:1; pointer-events:all; }
      .njtc-detail-panel { position:fixed; top:0; right:-640px; width:600px; max-width:100vw; height:100vh; overflow-y:auto; background:#152238; border-left:1px solid rgba(255,255,255,0.15); z-index:9991; transition:right 0.3s cubic-bezier(0.4,0,0.2,1); box-shadow:-8px 0 40px rgba(0,0,0,0.5); padding:0; }
      .njtc-detail-panel.open { right:0; }
      .njtc-detail-close { position:sticky; top:0; z-index:2; display:flex; justify-content:flex-end; padding:14px 16px 0; background:#152238; }
      .njtc-detail-close button { background:rgba(255,255,255,0.08); border:1px solid rgba(255,255,255,0.12); color:#e2e8f0; border-radius:8px; padding:6px 14px; cursor:pointer; font-size:0.85rem; }
      .njtc-detail-close button:hover { background:rgba(255,255,255,0.14); }
      .njtc-detail-body { padding:0 24px 48px; }

      .njtc-detail-header { display:flex; gap:16px; align-items:flex-start; margin-bottom:24px; padding-top:8px; }
      .njtc-detail-avatar { width:68px; height:68px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:1.4rem; font-weight:700; color:#fff; flex-shrink:0; }
      .njtc-detail-name { font-size:1.3rem; font-weight:700; }
      .njtc-detail-sub { font-size:0.82rem; color:#e2e8f0; margin-top:3px; }
      .njtc-att-big { font-size:2rem; font-weight:800; margin-top:6px; }

      /* Concerns */
      .njtc-concerns-block { background:rgba(245,158,11,0.07); border:1px solid rgba(245,158,11,0.3); border-radius:10px; padding:14px 16px; margin-bottom:20px; }
      .njtc-concerns-title { font-size:0.78rem; color:#f59e0b; font-weight:700; text-transform:uppercase; letter-spacing:0.05em; margin-bottom:10px; }
      .njtc-concern-item { font-size:0.82rem; color:#fbbf24; border-bottom:1px solid rgba(245,158,11,0.15); padding:7px 0; }
      .njtc-concern-item:last-child { border-bottom:none; } .njtc-concern-item { color:#fef08a; }
      .njtc-concern-date { font-size:0.7rem; color:#94a3b8; margin-left:8px; }

      /* TAP Section */
      .njtc-tap-block { background:rgba(255,184,28,0.06); border:1px solid rgba(255,184,28,0.2); border-radius:10px; padding:16px; margin-bottom:20px; }
      .njtc-tap-title { font-size:0.82rem; color:#FFB81C; font-weight:800; text-transform:uppercase; letter-spacing:0.06em; margin-bottom:12px; }
      .njtc-tap-meta { display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-bottom:14px; }
      .njtc-tap-field { font-size:0.8rem; }
      .njtc-tap-field span { color:#ffffff; font-weight:600; }
      .njtc-progress-row { margin-bottom:10px; }
      .njtc-progress-label { display:flex; justify-content:space-between; font-size:0.75rem; color:#e2e8f0; font-weight:600; margin-bottom:4px; }
      .njtc-progress-bar { height:8px; border-radius:4px; background:rgba(255,255,255,0.07); overflow:hidden; }
      .njtc-progress-fill { height:100%; border-radius:4px; transition:width 0.4s; }
      .njtc-progress-fill.ojt { background:#1C7C8C; }
      .njtc-progress-fill.rti { background:#FFB81C; }
      .njtc-ojt-link { display:inline-block; font-size:0.78rem; color:#1C7C8C; border:1px solid #1C7C8C44; border-radius:6px; padding:5px 12px; margin-top:8px; text-decoration:none; }
      .njtc-ojt-link:hover { background:rgba(28,124,140,0.1); }

      /* Pearl Ops Section */
      .njtc-section-block { margin-bottom:24px; }
      .njtc-section-block-title { font-size:0.82rem; font-weight:700; color:#34d399; text-transform:uppercase; letter-spacing:0.05em; margin-bottom:12px; padding-bottom:6px; border-bottom:1px solid rgba(255,255,255,0.12); }
      .njtc-kpi-mini-row { display:flex; gap:12px; flex-wrap:wrap; margin-bottom:14px; }
      .njtc-kpi-mini { background:rgba(0,0,0,0.25); border-radius:8px; padding:10px 14px; flex:1 1 80px; }
      .njtc-kpi-mini-val { font-size:1.2rem; font-weight:700; }
      .njtc-kpi-mini-label { font-size:0.65rem; color:#ffffff; font-weight:600; text-transform:uppercase; }

      .njtc-table { width:100%; border-collapse:collapse; font-size:0.78rem; }
      .njtc-table th { text-align:left; padding:7px 10px; background:rgba(28,124,140,0.3); color:#ffffff; font-size:0.68rem; font-weight:700; text-transform:uppercase; letter-spacing:0.04em; }
      .njtc-table td { padding:7px 10px; border-bottom:1px solid rgba(255,255,255,0.06); color:#e2e8f0; }
      .njtc-table tr:nth-child(even) td { background:rgba(255,255,255,0.02); }
      .njtc-table td.flag-red { color:#ef4444; }
      .njtc-table td.flag-amber { color:#f59e0b; }
      .njtc-table td.ok { color:#10b981; }

      /* Survey */
      .njtc-survey-grid { display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:10px; }
      .njtc-survey-card { background:rgba(0,0,0,0.2); border-radius:8px; padding:10px 14px; text-align:center; }
      .njtc-survey-val { font-size:1.4rem; font-weight:700; }
      .njtc-survey-label { font-size:0.68rem; color:#ffffff; font-weight:600; text-transform:uppercase; }

      /* iReady */
      .njtc-ir-meta { display:grid; grid-template-columns:repeat(3,1fr); gap:10px; margin-bottom:14px; }
      .njtc-ir-stat { background:rgba(0,0,0,0.2); border-radius:8px; padding:10px; text-align:center; }
      .njtc-ir-stat-val { font-size:1.1rem; font-weight:700; }
      .njtc-ir-stat-label { font-size:0.65rem; color:#ffffff; font-weight:600; }

      /* Divider */
      .njtc-divider { border:none; border-top:1px solid rgba(255,255,255,0.07); margin:20px 0; }

      @media (max-width: 640px) {
        .njtc-detail-panel { width:100vw; right:-100vw; }
        .njtc-tutor-grid { grid-template-columns:1fr; }
        .njtc-kpi-strip { flex-direction:column; }
        .njtc-kpi-card { min-width:unset; }
        .njtc-tap-meta { grid-template-columns:1fr; }
        .njtc-ir-meta { grid-template-columns:1fr 1fr; }
        .njtc-survey-grid { grid-template-columns:1fr 1fr; }
      }
    `;
    const style = document.createElement('style');
    style.id = 'njtc-team-styles';
    style.textContent = css;
    document.head.appendChild(style);
  }

  /* ─────────────────────────────────────────────
     RENDER HELPERS
  ───────────────────────────────────────────── */
  function renderBadge(tapData, tapLoaded) {
    if (!tapData) {
      // Only show "Not Enrolled" when TAP roster data is confirmed loaded — not when unavailable
      return tapLoaded ? `<span class="njtc-badge njtc-badge-none">Not Enrolled</span>` : '';
    }
    const status = (tapData['Status'] || tapData['Apprentice Program Status'] || tapData['B'] || '').trim();
    if (/active/i.test(status))           return `<span class="njtc-badge njtc-badge-active">TAP Active</span>`;
    if (/prior|complete|graduate/i.test(status)) return `<span class="njtc-badge njtc-badge-prior">TAP Prior</span>`;
    return tapLoaded ? `<span class="njtc-badge njtc-badge-none">Not Enrolled</span>` : '';
  }

  function renderAttColor(p) {
    return `color:${attColor(p)}`;
  }

  function renderFlags(attMetrics, stuMetrics) {
    const flags = [];
    if (attMetrics.rate != null && attMetrics.rate < 80)
      flags.push('<span title="Attendance below 80%">🔴 Low Att.</span>');
    if ((!stuMetrics.surveyScores || stuMetrics.surveyScores.count === 0))
      flags.push('<span title="No survey responses recorded">⚠️ No Surveys</span>');
    if (attMetrics.si >= 5)
      flags.push('<span title="5 or more service interruptions">🔴 High SIs</span>');
    const highAbsScholars = stuMetrics.scholars.filter(s => s.rate != null && s.rate < 60);
    if (highAbsScholars.length > 0)
      flags.push(`<span title="${highAbsScholars.length} scholar(s) with low attendance">⚠️ ${highAbsScholars.length} Scholar Abs.</span>`);
    return flags;
  }

  function tutorCardFlagClass(attMetrics, stuMetrics) {
    if ((attMetrics.rate != null && attMetrics.rate < 80) || attMetrics.si >= 5) return 'flagged';
    if (!stuMetrics.surveyScores || stuMetrics.surveyScores.count === 0) return 'flagged-warn';
    return '';
  }

  function iReadyMovementIcon(row) {
    const mv = (row['Movement'] || row['Placement Level Change'] || '').toLowerCase();
    if (mv.includes('improv') || mv === '▲' || mv === 'up') return '▲';
    if (mv.includes('declin') || mv === '▼' || mv === 'down') return '▼';
    return '=';
  }

  /* ─────────────────────────────────────────────
     RENDER SITE KPI STRIP
  ───────────────────────────────────────────── */
  function renderKPIStrip(tutors, tapRows) {
    const totalTutors = tutors.length;
    let totalSessions = 0, totalScholars = new Set(), totalSI = 0, flaggedBelow80 = 0;
    let attRates = [], surveyTotals = [], surveyCount = 0;
    let activeApprentices = 0;

    tutors.forEach(t => {
      totalSessions += t.attMetrics.total;
      totalSI += t.attMetrics.si;
      if (t.attMetrics.rate != null) attRates.push(t.attMetrics.rate);
      if (t.attMetrics.rate != null && t.attMetrics.rate < 80) flaggedBelow80++;
      t.stuMetrics.scholars.forEach(s => totalScholars.add(normName(s.name)));
      if (t.stuMetrics.surveyScores && t.stuMetrics.surveyScores.count > 0) {
        surveyTotals.push(t.stuMetrics.surveyScores.overall);
        surveyCount++;
      }
      const tap = t.tap;
      if (tap && /active/i.test(tap['Status'] || tap['Apprentice Program Status'] || '')) activeApprentices++;
    });

    const avgAtt = attRates.length ? Math.round(attRates.reduce((a,b)=>a+b,0)/attRates.length) : null;
    const avgSurvey = surveyCount ? Math.round((surveyTotals.reduce((a,b)=>a+b,0)/surveyCount)*10)/10 : null;

    const attGoal = 90;
    const attStatus = avgAtt == null ? '#6b7280' : attColor(avgAtt);

    return `
      <div class="njtc-kpi-strip">
        <div class="njtc-kpi-card">
          <div class="njtc-kpi-label">Tutors on Your Team</div>
          <div class="njtc-kpi-value" style="color:#1C7C8C">${totalTutors}</div>
        </div>
        <div class="njtc-kpi-card">
          <div class="njtc-kpi-label">Site Attendance Rate</div>
          <div class="njtc-kpi-value" style="${renderAttColor(avgAtt)}">${avgAtt != null ? avgAtt+'%' : '—'}</div>
          <div class="njtc-kpi-sub">Goal: ${attGoal}%</div>
        </div>
        <div class="njtc-kpi-card">
          <div class="njtc-kpi-label">Total Sessions</div>
          <div class="njtc-kpi-value" style="color:#e2e8f0">${totalSessions}</div>
        </div>
        <div class="njtc-kpi-card">
          <div class="njtc-kpi-label">Scholars Served</div>
          <div class="njtc-kpi-value" style="color:#e2e8f0">${totalScholars.size}</div>
        </div>
        <div class="njtc-kpi-card">
          <div class="njtc-kpi-label">Avg Survey Score</div>
          <div class="njtc-kpi-value" style="color:${surveyColor(avgSurvey)}">${avgSurvey != null ? avgSurvey : '—'}</div>
          <div class="njtc-kpi-sub">Scale: 1–5</div>
        </div>
        <div class="njtc-kpi-card">
          <div class="njtc-kpi-label">Active Apprentices</div>
          <div class="njtc-kpi-value" style="color:#FFB81C">${activeApprentices}</div>
          <div class="njtc-kpi-sub">TAP enrolled</div>
        </div>
        <div class="njtc-kpi-card">
          <div class="njtc-kpi-label">Service Interruptions</div>
          <div class="njtc-kpi-value" style="color:${totalSI > 10 ? '#ef4444' : '#e2e8f0'}">${totalSI}</div>
          <div class="njtc-kpi-sub">${flaggedBelow80} tutor(s) &lt;80%</div>
        </div>
      </div>
    `;
  }

  /* ─────────────────────────────────────────────
     RENDER TUTOR CARD
  ───────────────────────────────────────────── */
  function renderTutorCard(tutor) {
    const { name, id, role, attMetrics, stuMetrics, irElaMetrics, irMathMetrics, tap, tapLoaded } = tutor;
    const color = avatarColor(id || name);
    const ini = initials(name);
    const badge = renderBadge(tap, tapLoaded);
    const flags = renderFlags(attMetrics, stuMetrics);
    const flagClass = tutorCardFlagClass(attMetrics, stuMetrics);
    const surveyVal = stuMetrics.surveyScores && stuMetrics.surveyScores.count > 0 ? stuMetrics.surveyScores.overall : null;

    const elaChip = irElaMetrics && irElaMetrics.total > 0
      ? `<span class="njtc-chip ela">ELA: ${irElaMetrics.pctImproved != null ? irElaMetrics.pctImproved+'% improved' : '—'}</span>` : '';
    const mathChip = irMathMetrics && irMathMetrics.total > 0
      ? `<span class="njtc-chip math">Math: ${irMathMetrics.pctImproved != null ? irMathMetrics.pctImproved+'% improved' : '—'}</span>` : '';

    return `
      <div class="njtc-tutor-card ${escHtml(flagClass)}" data-tutor-name="${escHtml(name)}" onclick="window.NJTCTeam.openDetail('${escHtml(name).replace(/'/g,"\\'")}')">
        <div class="njtc-card-header">
          <div class="njtc-avatar" style="background:${color}">${escHtml(ini)}</div>
          <div>
            <div class="njtc-card-name">${escHtml(name)}${badge}</div>
            <div class="njtc-card-role">${escHtml(safe(role))}</div>
          </div>
        </div>
        <div class="njtc-metrics-row">
          <div class="njtc-metric">
            <div class="njtc-metric-val" style="${renderAttColor(attMetrics.rate)}">${attMetrics.rate != null ? attMetrics.rate+'%' : '—'}</div>
            <div class="njtc-metric-label">Attendance</div>
          </div>
          <div class="njtc-metric">
            <div class="njtc-metric-val">${stuMetrics.uniqueCount}</div>
            <div class="njtc-metric-label">Scholars</div>
          </div>
          <div class="njtc-metric">
            <div class="njtc-metric-val" style="${attMetrics.si >= 5 ? 'color:#ef4444' : ''}">${attMetrics.si}</div>
            <div class="njtc-metric-label">Serv. Int.</div>
          </div>
          <div class="njtc-metric">
            <div class="njtc-metric-val" style="color:${surveyColor(surveyVal)}">${surveyVal != null ? surveyVal : '—'}</div>
            <div class="njtc-metric-label">Survey Avg</div>
          </div>
        </div>
        ${elaChip || mathChip ? `<div class="njtc-chips">${elaChip}${mathChip}</div>` : ''}
        ${flags.length ? `<div class="njtc-flags">${flags.join('')}</div>` : ''}
        <div class="njtc-cta">View Full Profile →</div>
      </div>
    `;
  }

  /* ─────────────────────────────────────────────
     RENDER DETAIL PANEL
  ───────────────────────────────────────────── */
  function renderDetailPanel(tutor) {
    const { name, id, role, school, attMetrics, stuMetrics, irElaMetrics, irMathMetrics,
            smMetrics, siDetails, surveyAttn, tap, tapLoaded, concerns } = tutor;
    const color = avatarColor(id || name);
    const ini = initials(name);
    const badge = renderBadge(tap, tapLoaded);
    const surveyData = stuMetrics.surveyScores;
    const surveyVal = surveyData && surveyData.count > 0 ? surveyData.overall : null;

    // Concerns block
    let concernsHtml = '';
    if (concerns && concerns.length > 0) {
      const items = concerns.map(c => {
        const note = c['Note'] || c['Concern'] || c['Description'] || Object.values(c).join(' | ');
        const date = c['Date'] || c['Timestamp'] || '';
        return `<div class="njtc-concern-item">${escHtml(note)}<span class="njtc-concern-date">${escHtml(date)}</span></div>`;
      }).join('');
      concernsHtml = `
        <div class="njtc-concerns-block">
          <div class="njtc-concerns-title">⚠️ HR Concerns on Record (${concerns.length})</div>
          ${items}
        </div>
      `;
    }

    // TAP block — always show OJT log link; show full TAP details only when master roster data loaded
    const ojtFormUrl = `https://docs.google.com/forms/d/${OJT_FORM_ID}/viewform` +
      `?entry.1113592438=${encodeURIComponent(name)}` +
      (tap ? `&entry.2084410404=${encodeURIComponent(tap['Phase'] || tap['I'] || '')}` : '');

    let tapHtml = '';
    if (tap) {
      const tapStatus  = tap['Status'] || tap['Apprentice Program Status'] || '';
      const usdol      = tap['USDOL Apprentice ID'] || tap['USDOL ID'] || tap['G'] || '\u2014';
      const ojtPctRaw  = parseFloat(tap['OJT % Complete'] || tap['BA'] || 0);
      const ojtPctDisp = Math.round(ojtPctRaw * 100) + '%';
      const wage       = tap['Current Wage Rate ($)'] || tap['Current Wage'] || tap['BG'] || '\u2014';
      const milestone  = tap['Wage Milestone'] || tap['Milestone'] || tap['BH'] || '\u2014';
      const ojtHours   = parseFloat(tap['OJT Hours (Total)'] || tap['OJT Hours'] || 0);
      const rtiHours   = parseFloat(tap['RTI Hours (Total)'] || tap['RTI Hours'] || tap['AZ'] || 0);
      const yCount     = parseFloat(tap['OJT Activities Marked Y'] || tap['BB'] || 0);
      const possible   = parseFloat(tap['OJT Possible (excl N/A)'] || tap['BC'] || 78);
      const begPct     = Math.round(parseFloat(tap['Beginning % Complete'] || tap['BD'] || 0) * 100);
      const midPct     = Math.round(parseFloat(tap['Middle % Complete']    || tap['BE'] || 0) * 100);
      const endPct     = Math.round(parseFloat(tap['End % Complete']       || tap['BF'] || 0) * 100);
      const ojtTotal   = 4000, rtiTotal = 288;
      const ojtPct     = Math.min(100, Math.round(ojtHours / ojtTotal * 100));
      const rtiPct     = Math.min(100, Math.round(rtiHours / rtiTotal * 100));
      const ojtPctColor = ojtPct >= 100 ? '#34d399' : ojtPct >= 75 ? '#fbbf24' : '#f97316';

      // Pre-compute phase bars HTML (no nested backticks)
      const phaseData = [
        ['Beginning', begPct, '#059669'],
        ['Middle',    midPct, '#1B3A6B'],
        ['End',       endPct, '#7c3aed']
      ];
      let phaseBarsHtml = '';
      for (var pi = 0; pi < phaseData.length; pi++) {
        const pd = phaseData[pi];
        const pdLabel = pd[0], pdPct = Math.min(100, pd[1]), pdCol = pd[2];
        phaseBarsHtml +=
          '<div style="margin-bottom:6px">' +
            '<div style="display:flex;justify-content:space-between;font-size:.72rem;margin-bottom:3px">' +
              '<span style="color:#ffffff;font-weight:600">' + pdLabel + '</span>' +
              '<span style="color:' + pdCol + ';font-weight:700">' + pdPct + '%</span>' +
            '</div>' +
            '<div style="height:6px;background:rgba(255,255,255,.08);border-radius:3px">' +
              '<div style="height:6px;background:' + pdCol + ';border-radius:3px;width:' + pdPct + '%;transition:width .4s"></div>' +
            '</div>' +
          '</div>';
      }

      // Pre-compute monthly OJT activity count table (no nested backticks)
      const MONTH_KEYS_OJT = [
        'Mar-25 OJT','Apr-25 OJT','May-25 OJT','Jun-25 OJT','Jul-25 OJT',
        'Aug-25 OJT','Sep-25 OJT','Oct-25 OJT','Nov-25 OJT','Dec-25 OJT',
        'Jan-26 OJT','Feb-26 OJT','Mar-26 OJT','Apr-26 OJT','May-26 OJT',
        'Jun-26 OJT','Jul-26 OJT'
      ];
      const MONTH_DISP_OJT = [
        'Mar-25','Apr-25','May-25','Jun-25','Jul-25','Aug-25','Sep-25','Oct-25',
        'Nov-25','Dec-25','Jan-26','Feb-26','Mar-26','Apr-26','May-26','Jun-26','Jul-26'
      ];
      let cumActs = 0;
      let monthBodyHtml = '';
      let hasMonthData = false;
      for (var mi = 0; mi < MONTH_KEYS_OJT.length; mi++) {
        const hrs = parseFloat(tap[MONTH_KEYS_OJT[mi]] || 0);
        const cnt = hrs > 0 ? Math.round(hrs / 50) : 0;
        cumActs += cnt;
        if (cnt === 0 && cumActs === 0) continue;
        if (cnt > 0) {
          hasMonthData = true;
          const bw = Math.min(100, Math.round(cnt / 6 * 100));
          monthBodyHtml +=
            '<tr style="border-bottom:1px solid rgba(255,255,255,.05)">' +
              '<td style="padding:4px 6px;font-size:.72rem;color:#e2e8f0">' + MONTH_DISP_OJT[mi] + '</td>' +
              '<td style="padding:4px 6px;font-size:.72rem;font-weight:700;color:#34d399">' + cnt + '</td>' +
              '<td style="padding:4px 6px;font-size:.72rem;color:#94a3b8">' + hrs.toFixed(0) + ' hrs</td>' +
              '<td style="padding:4px 6px;font-size:.72rem;color:#1C7C8C;font-weight:700">' + cumActs + '</td>' +
              '<td style="padding:4px 6px;min-width:50px"><div style="height:5px;background:rgba(255,255,255,.08);border-radius:3px"><div style="height:5px;background:#1C7C8C;border-radius:3px;width:' + bw + '%"></div></div></td>' +
            '</tr>';
        }
      }

      const monthTableHtml = hasMonthData ? (
        '<div style="margin-bottom:12px">' +
          '<div style="font-size:.7rem;color:#ffffff;font-weight:700;text-transform:uppercase;letter-spacing:.05em;margin-bottom:5px">Monthly OJT Activity Count</div>' +
          '<div style="overflow-y:auto;max-height:150px">' +
            '<table style="width:100%;border-collapse:collapse">' +
              '<thead><tr style="background:rgba(28,124,140,.25)">' +
                '<th style="padding:3px 6px;font-size:.67rem;color:#ffffff;font-weight:700;text-align:left">Month</th>' +
                '<th style="padding:3px 6px;font-size:.67rem;color:#ffffff;font-weight:700;text-align:left">Y</th>' +
                '<th style="padding:3px 6px;font-size:.67rem;color:#ffffff;font-weight:700;text-align:left">Hrs</th>' +
                '<th style="padding:3px 6px;font-size:.67rem;color:#ffffff;font-weight:700;text-align:left">Cumul.</th>' +
                '<th style="padding:3px 6px;font-size:.67rem;color:#ffffff;font-weight:700"></th>' +
              '</tr></thead>' +
              '<tbody>' + monthBodyHtml + '</tbody>' +
            '</table>' +
          '</div>' +
        '</div>'
      ) : '';

      tapHtml = '<div class="njtc-tap-block">' +
        '<div class="njtc-tap-title">TAP Apprenticeship' + badge + '</div>' +

        '<div style="display:flex;align-items:center;gap:1rem;margin-bottom:12px;padding:10px 12px;background:rgba(28,124,140,.2);border-radius:8px">' +
          '<div style="text-align:center;flex-shrink:0">' +
            '<div style="font-size:2rem;font-weight:800;color:' + ojtPctColor + '">' + ojtPctDisp + '</div>' +
            '<div style="font-size:.65rem;color:#ffffff;font-weight:700;text-transform:uppercase;letter-spacing:.07em">OJT Complete</div>' +
          '</div>' +
          '<div style="flex:1;display:grid;grid-template-columns:auto 1fr;gap:3px 10px;font-size:.75rem">' +
            '<span style="color:#ffffff;font-weight:700">Activities</span><span style="color:#e2e8f0">' + yCount + ' of ' + possible + ' Y</span>' +
            '<span style="color:#ffffff;font-weight:700">OJT Hours</span><span style="color:#e2e8f0">' + ojtHours.toLocaleString() + ' / 4,000</span>' +
          '</div>' +
        '</div>' +

        '<div style="margin-bottom:12px">' + phaseBarsHtml + '</div>' +

        monthTableHtml +

        '<div class="njtc-tap-meta" style="margin-bottom:10px">' +
          '<div class="njtc-tap-field"><span>USDOL ID: </span>' + escHtml(usdol) + '</div>' +
          '<div class="njtc-tap-field"><span>Status: </span>' + escHtml(tapStatus) + '</div>' +
        '</div>' +

        '<div class="njtc-progress-row">' +
          '<div class="njtc-progress-label"><span>OJT Hours</span><span>' + ojtHours + ' / ' + ojtTotal + ' (' + ojtPct + '%)</span></div>' +
          '<div class="njtc-progress-bar"><div class="njtc-progress-fill ojt" style="width:' + ojtPct + '%"></div></div>' +
        '</div>' +
              '</div>';

    } else {

      tapHtml = '';
    }

    // Pearl Ops block
    const { attended, absent, si, total, absenceReasons } = attMetrics;
    const absReasonRows = Object.entries(absenceReasons || {}).map(([reason, count]) =>
      `<tr><td>${escHtml(reason)}</td><td>${count}</td></tr>`
    ).join('');

    const scholarRows = stuMetrics.scholars.slice(0, 50).map(s => {
      const rate = s.rate;
      const rateClass = rate == null ? '' : rate < 60 ? 'flag-red' : rate < 80 ? 'flag-amber' : 'ok';
      const status = rate == null ? '—' : rate >= 80 ? 'On Track' : rate >= 60 ? 'At Risk' : 'Critical';
      return `<tr>
        <td>${escHtml(s.name)}</td>
        <td>${escHtml(s.grade || '—')}</td>
        <td>${s.attended}</td><td>${s.absent}</td><td>${s.si}</td>
        <td class="${rateClass}">${rate != null ? rate+'%' : '—'}</td>
        <td class="${rateClass}">${status}</td>
      </tr>`;
    }).join('');

    const pearlHtml = `
      <div class="njtc-section-block">
        <div class="njtc-section-block-title">Pearl Operations</div>
        <div class="njtc-kpi-mini-row">
          <div class="njtc-kpi-mini"><div class="njtc-kpi-mini-val" style="${renderAttColor(attMetrics.rate)}">${attMetrics.rate != null ? attMetrics.rate+'%' : '—'}</div><div class="njtc-kpi-mini-label">Att. Rate</div></div>
          <div class="njtc-kpi-mini"><div class="njtc-kpi-mini-val">${attended}</div><div class="njtc-kpi-mini-label">Attended</div></div>
          <div class="njtc-kpi-mini"><div class="njtc-kpi-mini-val">${absent}</div><div class="njtc-kpi-mini-label">Absent</div></div>
          <div class="njtc-kpi-mini"><div class="njtc-kpi-mini-val" style="${si >= 5 ? 'color:#ef4444' : ''}">${si}</div><div class="njtc-kpi-mini-label">Serv. Int.</div></div>
          <div class="njtc-kpi-mini"><div class="njtc-kpi-mini-val">${total}</div><div class="njtc-kpi-mini-label">Total</div></div>
        </div>
        ${absReasonRows ? `
        <div style="margin-bottom:14px">
          <div style="font-size:0.72rem;color:#ffffff;font-weight:600;text-transform:uppercase;letter-spacing:0.04em;margin-bottom:8px">Absence Reasons (excl. Service Interruptions)</div>
          <table class="njtc-table"><thead><tr><th>Reason</th><th>Count</th></tr></thead><tbody>${absReasonRows}</tbody></table>
        </div>` : ''}
        ${scholarRows ? `
        <div>
          <div style="font-size:0.72rem;color:#ffffff;font-weight:600;text-transform:uppercase;letter-spacing:0.04em;margin-bottom:8px">Scholar Attendance</div>
          <div style="overflow-x:auto">
            <table class="njtc-table">
              <thead><tr><th>Name</th><th>Grade</th><th>Att.</th><th>Abs.</th><th>SI</th><th>Rate</th><th>Status</th></tr></thead>
              <tbody>${scholarRows}</tbody>
            </table>
          </div>
        </div>` : '<div style="color:#e2e8f0;font-size:0.82rem">No scholar data available.</div>'}
      </div>
    `;

    // Survey block
    let surveyHtml = '';
    if (surveyData && surveyData.count > 0) {
      surveyHtml = `
        <div class="njtc-section-block">
          <div class="njtc-section-block-title">Scholar Surveys (n=${surveyData.count})</div>
          <div class="njtc-survey-grid">
            <div class="njtc-survey-card">
              <div class="njtc-survey-val" style="color:${surveyColor(surveyData.confidence)}">${surveyData.confidence || '—'}</div>
              <div class="njtc-survey-label">Confidence</div>
            </div>
            <div class="njtc-survey-card">
              <div class="njtc-survey-val" style="color:${surveyColor(surveyData.enjoyment)}">${surveyData.enjoyment || '—'}</div>
              <div class="njtc-survey-label">Enjoyment</div>
            </div>
            <div class="njtc-survey-card">
              <div class="njtc-survey-val" style="color:${surveyColor(surveyData.learning)}">${surveyData.learning || '—'}</div>
              <div class="njtc-survey-label">Learning</div>
            </div>
            <div class="njtc-survey-card">
              <div class="njtc-survey-val" style="color:${surveyColor(surveyData.overall)}">${surveyData.overall || '—'}</div>
              <div class="njtc-survey-label">Overall</div>
            </div>
          </div>
        </div>
      `;
    } else {
      surveyHtml = `
        <div class="njtc-section-block">
          <div class="njtc-section-block-title">Scholar Surveys</div>
          <div style="color:#e2e8f0;font-size:0.82rem">No survey responses on record.</div>
        </div>
      `;
    }

    // iReady blocks (supports both legacy and 25-26 EOY/Longitudinal)
    function renderIReadyBlock(metrics, subject) {
      const dataLabel = metrics && metrics.is2526
        ? '25–26 EOY / Preliminary'
        : 'Academic Data';
      if (!metrics || metrics.total === 0) {
        // Show spinner if Phase 2 hasn't finished yet — data may still be loading
        if (!_phase2Loaded) {
          return `
            <div class="njtc-section-block">
              <div class="njtc-section-block-title">iReady ${subject} — Academic Data</div>
              <div style="display:flex;align-items:center;gap:8px;color:#94a3b8;font-size:0.82rem">
                <div class="njtc-spinner" style="width:14px;height:14px;border-width:2px"></div>
                Loading academic data…
              </div>
            </div>
          `;
        }
        return `
          <div class="njtc-section-block">
            <div class="njtc-section-block-title">iReady ${subject} — ${dataLabel}</div>
            <div style="color:#e2e8f0;font-size:0.82rem">No iReady data linked to this tutor's scholars.</div>
          </div>
        `;
      }
      const schRows = metrics.scholars.slice(0, 60).map(r => {
        let sName, sGrade, sBase, sSpring, sPct, mvIcon, mvColor;
        if (metrics.is2526) {
          sName   = r.name   || '—';
          sGrade  = r.grade  || '—';
          sBase   = r.basePlacement   || '—';
          sSpring = r.springPlacement || (r.isLongitudinal ? '—' : 'Preliminary');
          sPct    = r.pctTypical > 0 ? r.pctTypical + '%' : '—';
          const bl = placementLevel(r.basePlacement), sl = placementLevel(r.springPlacement);
          mvIcon  = (bl && sl) ? (sl > bl ? '▲' : sl < bl ? '▼' : '=') : '—';
          mvColor = mvIcon === '▲' ? '#10b981' : mvIcon === '▼' ? '#ef4444' : '#94a3b8';
        } else {
          sName   = r['Full Name'] || r['Student Name'] || r['Scholar Name'] || r['Name'] || '—';
          sGrade  = r['Grade'] || '—';
          sBase   = r['Beginning of Year Placement'] || r['BOY Level'] || '—';
          sSpring = r['End of Year Placement'] || r['EOY Level'] || '—';
          sPct    = r['% Typical Growth'] || r['Typical Growth'] || '—';
          mvIcon  = iReadyMovementIcon(r);
          mvColor = mvIcon === '▲' ? '#10b981' : mvIcon === '▼' ? '#ef4444' : '#94a3b8';
        }
        return `<tr>
          <td>${escHtml(sName)}</td><td>${escHtml(sGrade)}</td>
          <td>${escHtml(sBase)}</td><td>${escHtml(sSpring)}</td>
          <td style="color:${mvColor};font-weight:700">${mvIcon}</td>
          <td>${escHtml(String(sPct))}</td>
        </tr>`;
      }).join('');

      return `
        <div class="njtc-section-block">
          <div class="njtc-section-block-title">iReady ${subject} — ${dataLabel}</div>
          <div class="njtc-ir-meta">
            <div class="njtc-ir-stat"><div class="njtc-ir-stat-val" style="color:#10b981">${metrics.pctImproved != null ? metrics.pctImproved+'%' : '—'}</div><div class="njtc-ir-stat-label">Improved</div></div>
            <div class="njtc-ir-stat"><div class="njtc-ir-stat-val" style="color:#94a3b8">${metrics.pctMaintained != null ? metrics.pctMaintained+'%' : '—'}</div><div class="njtc-ir-stat-label">Maintained</div></div>
            <div class="njtc-ir-stat"><div class="njtc-ir-stat-val" style="color:#ef4444">${metrics.pctDeclined != null ? metrics.pctDeclined+'%' : '—'}</div><div class="njtc-ir-stat-label">Declined</div></div>
            <div class="njtc-ir-stat"><div class="njtc-ir-stat-val">${metrics.medGrowth != null ? metrics.medGrowth+'%' : '—'}</div><div class="njtc-ir-stat-label">Med. Growth</div></div>
            ${!metrics.is2526 && metrics.avgGain != null ? `<div class="njtc-ir-stat"><div class="njtc-ir-stat-val">${metrics.avgGain}</div><div class="njtc-ir-stat-label">Avg SS Gain</div></div>` : ''}
          </div>
          ${schRows ? `<div style="overflow-x:auto"><table class="njtc-table">
            <thead><tr><th>Scholar</th><th>Gr</th><th>Baseline</th><th>Current</th><th>Mvmt</th><th>% Growth</th></tr></thead>
            <tbody>${schRows}</tbody></table></div>` : ''}
        </div>
      `;
    }

    // Standards Mastery block (Middlesex STEM only)
    function renderSmBlock(sm) {
      if (!sm) return '';
      return `
        <div class="njtc-section-block">
          <div class="njtc-section-block-title">Standards Mastery (Middlesex STEM)</div>
          <div class="njtc-ir-meta">
            <div class="njtc-ir-stat"><div class="njtc-ir-stat-val">${sm.total}</div><div class="njtc-ir-stat-label">Scholars</div></div>
            <div class="njtc-ir-stat"><div class="njtc-ir-stat-val" style="color:#10b981">${sm.pctImproved != null ? sm.pctImproved+'%' : '—'}</div><div class="njtc-ir-stat-label">Improved</div></div>
          </div>
          <div style="overflow-x:auto"><table class="njtc-table">
            <thead><tr><th>Scholar</th><th>Assessment</th><th>Pre</th><th>Post</th><th>Gain</th></tr></thead>
            <tbody>${sm.scholars.map(s => `<tr>
              <td>${escHtml(s.name)}</td><td>${escHtml(s.assessment)}</td>
              <td>${s.formA != null ? s.formA+'%' : '—'}</td>
              <td>${s.formB != null ? s.formB+'%' : '—'}</td>
              <td style="color:${s.gain > 0 ? '#10b981' : s.gain < 0 ? '#ef4444' : '#94a3b8'}">${s.gain != null ? (s.gain > 0 ? '+' : '') + s.gain + '%' : '—'}</td>
            </tr>`).join('')}</tbody>
          </table></div>
        </div>
      `;
    }

    // Service interruption detail block
    function renderSIBlock(siList) {
      if (!siList || siList.length === 0) return '';
      // Group by category for cleaner display
      const tutorSIs  = siList.filter(s => s.category === 'Tutor Absence');
      const schoolSIs = siList.filter(s => s.category !== 'Tutor Absence');
      var rows = '';
      siList.forEach(function(s) {
        const catColor = s.category === 'Tutor Absence' ? '#f97316' : '#fbbf24';
        rows +=
          '<tr>' +
            '<td style="padding:6px 8px;font-size:.75rem;color:#e2e8f0;white-space:nowrap">' + escHtml(s.date) + '</td>' +
            '<td style="padding:6px 8px"><span style="font-size:.68rem;font-weight:700;color:' + catColor + ';background:rgba(249,115,22,.12);border-radius:3px;padding:2px 6px">' + escHtml(s.category) + '</span></td>' +
            '<td style="padding:6px 8px;font-size:.73rem;color:#cbd5e1">' + escHtml(s.reason || s.status) + '</td>' +
            '<td style="padding:6px 8px;font-size:.73rem;color:#94a3b8">' + escHtml(s.school) + '</td>' +
          '</tr>';
      });
      const summary = (tutorSIs.length ? tutorSIs.length + ' tutor' : '') +
        (tutorSIs.length && schoolSIs.length ? ', ' : '') +
        (schoolSIs.length ? schoolSIs.length + ' school' : '');
      return '<div class="njtc-section-block" style="border-color:rgba(239,68,68,.35)">' +
        '<div class="njtc-section-block-title" style="color:#ef4444">⚡ Service Interruptions (' + siList.length + ')' +
          (summary ? '<span style="font-size:.68rem;color:#94a3b8;font-weight:400;margin-left:8px">— ' + summary + '</span>' : '') +
        '</div>' +
        '<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse">' +
          '<thead><tr style="background:rgba(239,68,68,.12)">' +
            '<th style="padding:5px 8px;font-size:.67rem;color:#ffffff;font-weight:700;text-align:left">Date</th>' +
            '<th style="padding:5px 8px;font-size:.67rem;color:#ffffff;font-weight:700;text-align:left">Type</th>' +
            '<th style="padding:5px 8px;font-size:.67rem;color:#ffffff;font-weight:700;text-align:left">Reason</th>' +
            '<th style="padding:5px 8px;font-size:.67rem;color:#ffffff;font-weight:700;text-align:left">School</th>' +
          '</tr></thead>' +
          '<tbody>' + rows + '</tbody>' +
        '</table></div>' +
      '</div>';
    }

    // Survey attention block (scholars rating < 3.0)
    function renderSurveyAttnBlock(attn) {
      if (!attn || attn.length === 0) return '';
      return `
        <div class="njtc-section-block" style="border-color:#f59e0b44">
          <div class="njtc-section-block-title" style="color:#f59e0b">⚠ Scholar Feedback — Needs Attention</div>
          <div style="font-size:.75rem;color:#e2e8f0;margin-bottom:8px">Scholars averaging below 3.0/5 across survey dimensions</div>
          <div style="overflow-x:auto"><table class="njtc-table">
            <thead><tr><th>Scholar</th><th>Avg Score</th><th>Responses</th></tr></thead>
            <tbody>${attn.map(s => `<tr>
              <td>${escHtml(s.name)}</td>
              <td style="color:#ef4444;font-weight:700">${s.avg}/5</td>
              <td>${s.count}</td>
            </tr>`).join('')}</tbody>
          </table></div>
        </div>
      `;
    }

    const elaHtml  = renderIReadyBlock(irElaMetrics, 'ELA');
    const mathHtml = renderIReadyBlock(irMathMetrics, 'Math');
    const smHtml   = renderSmBlock(smMetrics);
    const siHtml   = renderSIBlock(siDetails);
    const attnHtml = renderSurveyAttnBlock(surveyAttn);

    // ── Notes block (localStorage) ──────────────────────────────────────────
    const noteKey  = 'njtc_note_' + normName(name);
    const noteVal  = (function(){ try { return localStorage.getItem(noteKey) || ''; } catch(e){ return ''; } })();
    const notesHtml = `
      <div class="njtc-section-block" id="notesBlock_${escHtml(normName(name))}">
        <div class="njtc-section-block-title" style="display:flex;justify-content:space-between;align-items:center">
          📝 Leader Notes
          <button onclick="window.NJTCTeam.editNote('${escHtml(name).replace(/'/g,"\\'")}','${noteKey}')"
            style="font-size:.72rem;background:rgba(28,124,140,.15);border:1px solid #1C7C8C44;color:#1C7C8C;padding:3px 10px;border-radius:5px;cursor:pointer">
            ${noteVal ? 'Edit' : '+ Add Note'}
          </button>
        </div>
        <div id="noteDisplay_${escHtml(normName(name))}" style="font-size:.82rem;color:${noteVal ? '#ffffff' : '#94a3b8'};white-space:pre-wrap;margin-top:4px">
          ${noteVal ? escHtml(noteVal) : 'No notes yet. Click to add.'}
        </div>
      </div>
    `;

    // ── OJT Activity Log inline form (Section 1 + Section 2 only) ───────────
    // Section 3 (RTI) is Central Team only — not shown here.
    const ojtFormId   = '1MOsppwhQmagAhVSHs29Ms4o9Ky4xYOyqy8Qs4uTrwbQ';
    const leaderName2 = (window.NJTC_USER_PROFILE && window.NJTC_USER_PROFILE.name)  || '';
    const leaderRole2 = _leaderInfo ? _leaderInfo.role : '';
    const leaderSite2 = school || (_leaderInfo && _leaderInfo.siteField) || '';
    const todayISO    = new Date().toISOString().slice(0, 10);
    const safeName    = escHtml(name).replace(/'/g,"\\'");
    const nk          = normName(name).replace(/\s+/g, '_');  // spaces invalid in HTML IDs

    const inputStyle  = 'width:100%;background:#1e3a5f;border:1px solid #4a6fa5;border-radius:5px;color:#e2e8f0;padding:5px 8px;font-size:.8rem';
    const labelStyle  = 'font-size:.7rem;color:#94a3b8;display:block;margin-bottom:2px';

    // Map leader role to exact Observer Role values in the OJT form
    function ojtObsRoleValue(r) {
      const v = (r || '').toLowerCase();
      if (v.includes('dual')) return 'Dual Role (IC + SC)';
      if (v.includes('instructional coach') || v.includes('ic')) return 'Instructional Coach (IC)';
      if (v.includes('site coord') || v.includes('sc')) return 'Site Coordinator (SC)';
      if (v.includes('regional') || v.includes('program manager')) return 'Regional Program Manager';
      return '';
    }
    // Map leader school/site to the OJT form site dropdown value
    function ojtSiteValue(s) {
      const v = (s || '').toLowerCase();
      if (v.includes('bergen') && v.includes('ms')) return 'iLearn Bergen MS';
      if (v.includes('bergen') && v.includes('hs')) return 'iLearn Bergen HS';
      if (v.includes('paterson') && v.includes('silk')) return 'iLearn Paterson Silk City';
      if (v.includes('paterson') && v.includes('ms')) return 'iLearn Paterson MS';
      if (v.includes('paterson') && v.includes('es')) return 'iLearn Paterson ES';
      if (v.includes('clifton') && v.includes('ms')) return 'iLearn Clifton MS';
      if (v.includes('clifton') && v.includes('es')) return 'iLearn Clifton ES';
      if (v.includes('clifton') && v.includes('hs')) return 'iLearn Clifton HS';
      if (v.includes('passaic') && v.includes('ms')) return 'iLearn Passaic MS';
      if (v.includes('passaic') && v.includes('es')) return 'iLearn Passaic ES';
      if (v.includes('hudson')) return 'iLearn Hudson MS';
      if (v.includes('hamilton') && v.includes('kuser')) return 'Hamilton-Kuser';
      if (v.includes('hamilton')) return 'Hamilton Township';
      if (v.includes('haddon')) return 'Haddon Township';
      if (v.includes('middlesex')) return 'Middlesex STEM';
      if (v.includes('penns grove') || v.includes('pennsgro')) return 'Penns Grove';
      if (v.includes('gloucester')) return 'Gloucester';
      if (v.includes('central jersey') || v.includes('cjcp')) return 'Central Jersey College Prep';
      if (v.includes('pcsst') || v.includes('paterson charter')) return 'PCSST - Paterson';
      return '';
    }
    const ojtObsRole = ojtObsRoleValue(leaderRole2);
    const ojtSiteDef = ojtSiteValue(leaderSite2);

    const OJT_SITES = ['iLearn Bergen MS','iLearn Bergen HS','iLearn Paterson MS','iLearn Paterson ES',
      'iLearn Paterson Silk City','iLearn Clifton MS','iLearn Clifton ES','iLearn Clifton HS',
      'iLearn Passaic MS','iLearn Passaic ES','iLearn Hudson MS','Hamilton Township','Hamilton-Kuser',
      'Haddon Township','Middlesex STEM','Penns Grove','Gloucester','Central Jersey College Prep','PCSST - Paterson'];
    const OJT_ROLES = ['Instructional Coach (IC)','Site Coordinator (SC)','Dual Role (IC + SC)','Regional Program Manager'];

    // OJT_ACTIVITY_DATA defined at IIFE scope below TAP_URL
    const OJT_ACTIVITIES = OJT_ACTIVITY_DATA.map(d => `${d.code} — ${d.desc} [${d.phase} · ${d.domain}]`);

    const selOpt = (val, cur) => `<option value="${escHtml(val)}" ${cur === val ? 'selected' : ''}>${escHtml(val)}</option>`;

    const ojtFormHtml = `
      <div class="njtc-section-block" style="border-color:#1C7C8C44">
        <div class="njtc-section-block-title" style="display:flex;justify-content:space-between;align-items:center">
          📋 Log OJT Activity
          <button onclick="window.NJTCTeam._ojtResetForm('${nk}')"
            id="ojtToggleBtn_${nk}"
            style="font-size:.72rem;background:rgba(28,124,140,.25);border:1px solid #1C7C8C;color:#34d399;font-weight:600;padding:4px 12px;border-radius:5px;cursor:pointer">
            Toggle Form
          </button>
        </div>
        <div id="ojtFormBody_${nk}" style="display:none;margin-top:12px">

          <div style="font-size:.72rem;color:#FFB81C;text-transform:uppercase;letter-spacing:.05em;margin-bottom:8px">Section 1 — Observation Info</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px">
            <div>
              <label style="${labelStyle}">Observer Name</label>
              <input id="ojt_obs_name_${nk}" value="${escHtml(leaderName2)}" style="${inputStyle}">
            </div>
            <div>
              <label style="${labelStyle}">Observer Role</label>
              <select id="ojt_obs_role_${nk}" style="${inputStyle}">
                <option value="">Select role…</option>
                ${OJT_ROLES.map(r => selOpt(r, ojtObsRole)).join('')}
              </select>
            </div>
            <div>
              <label style="${labelStyle}">Site Location</label>
              <select id="ojt_site_${nk}" style="${inputStyle}">
                <option value="">Select site…</option>
                ${OJT_SITES.map(s => selOpt(s, ojtSiteDef)).join('')}
              </select>
            </div>
            <div>
              <label style="${labelStyle}">Date of Observation</label>
              <input id="ojt_date_${nk}" type="date" value="${todayISO}" style="${inputStyle}">
            </div>
            <div style="grid-column:1/-1">
              <label style="${labelStyle}">Apprentice Full Name</label>
              <input id="ojt_name_${nk}" value="${escHtml(name)}" readonly style="${inputStyle};opacity:.7">
            </div>
          </div>

          <!-- Section 2: Multi-activity OJT checklist -->
          <div style="font-size:.72rem;color:#FFB81C;text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px">Section 2 — OJT Activities</div>
          <div style="font-size:.71rem;color:#94a3b8;margin-bottom:10px">Select phase and domain, then check all activities observed this session. One submit logs them all.</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px">
            <div>
              <label style="${labelStyle}">Program Phase <span style="color:#ef4444">*</span></label>
              <select id="ojt_phase_${nk}" style="${inputStyle}"
                onchange="window.NJTCTeam._ojtFilterActivities('${nk}')">
                <option value="">Select phase\u2026</option>
                <option value="Beginning (Months 1\u20134 \u00b7 September\u2013November)">Beginning (Months 1\u20134)</option>
                <option value="Middle (Months 5\u20138 \u00b7 November\u2013February)">Middle (Months 5\u20138)</option>
                <option value="End (Months 9\u201312 \u00b7 March\u2013May)">End (Months 9\u201312)</option>
              </select>
            </div>
            <div>
              <label style="${labelStyle}">Competency Domain <span style="color:#ef4444">*</span></label>
              <select id="ojt_domain_${nk}" style="${inputStyle}"
                onchange="window.NJTCTeam._ojtFilterActivities('${nk}')">
                <option value="">Select domain\u2026</option>
                <option value="Professionalism">Professionalism</option>
                <option value="Instruction">Instruction</option>
                <option value="Environment">Environment</option>
                <option value="Planning">Planning</option>
              </select>
            </div>
          </div>
          <div id="ojt_checklist_${nk}" style="margin-bottom:8px;max-height:200px;overflow-y:auto;border:1px solid #334155;border-radius:6px;padding:5px 7px;background:rgba(255,255,255,.07)">
            <div style="color:#64748b;font-size:.73rem;padding:6px">Select a phase and domain to see activities\u2026</div>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px">
            <div>
              <label style="${labelStyle}">Mark All Selected As</label>
              <select id="ojt_mark_${nk}" style="${inputStyle}">
                <option value="Y \u2014 Observed and completed" selected>Y \u2014 Observed and completed</option>
                <option value="N/A \u2014 Not applicable for this apprentice or site">N/A \u2014 Not applicable</option>
              </select>
            </div>
            <div style="display:flex;align-items:flex-end">
              <span id="ojt_selected_count_${nk}" style="font-size:.73rem;color:#94a3b8;font-weight:600;padding-bottom:6px">0 activities selected</span>
            </div>
          </div>
          <div style="margin-bottom:10px">
            <label style="${labelStyle}">Observation Notes (optional)</label>
            <textarea id="ojt_notes_${nk}" rows="3"
              placeholder="Describe what you observed\u2026"
              style="${inputStyle};resize:vertical"></textarea>
          </div>
          <div style="border-top:1px solid #334155;margin:10px 0 8px;padding-top:8px">
            <div style="font-size:.72rem;color:#a78bfa;text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px">RTI Hours (optional)</div>
            <div style="display:grid;grid-template-columns:1fr 2fr;gap:8px;align-items:end">
              <div>
                <label style="${labelStyle}">Hours for this observation session</label>
                <input id="ojt_session_duration_${nk}" type="number" min="0" max="8" step="0.5"
                  placeholder="e.g. 1.5" style="${inputStyle}">
              </div>
              <div style="font-size:.67rem;color:#94a3b8;padding-bottom:6px;line-height:1.5">
                Logged to the OTJ tab and added<br>cumulatively to AZ (RTI Hours Total).
              </div>
            </div>
          </div>
          <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
            <button id="ojt_submit_btn_${nk}"
              onclick="window.NJTCTeam.submitOJT('${safeName}','${ojtFormId}')"
              style="background:#1C7C8C;color:#fff;border:none;border-radius:6px;padding:7px 18px;font-size:.8rem;font-weight:600;cursor:pointer">
              Submit OJT Log
            </button>
            <span id="ojt_status_${nk}" style="font-size:.75rem;display:block"></span>
          </div>
          </div>
        </div>
      </div>
    `;

    const loadingSpinnerHtml = _phase2Loaded ? '' : '<div style="display:flex;align-items:center;gap:10px;padding:14px 0;color:#e2e8f0;font-size:0.8rem;border-top:1px solid #334155;margin-top:8px"><div class="njtc-spinner" style="width:14px;height:14px;border-width:2px;flex-shrink:0"></div>Academic data is loading in the background — this panel will update automatically when ready.</div>';
    return `
      <div class="njtc-detail-close"><button onclick="window.NJTCTeam.closeDetail()">✕ Close</button></div>
      <div class="njtc-detail-body">
        <div class="njtc-detail-header">
          <div class="njtc-detail-avatar" style="background:${color}">${escHtml(ini)}</div>
          <div>
            <div class="njtc-detail-name">${escHtml(name)}${badge}</div>
            <div class="njtc-detail-sub">${escHtml(safe(role))} &bull; ${escHtml(safe(school))}</div>
            <div class="njtc-att-big" style="${renderAttColor(attMetrics.rate)}">${attMetrics.rate != null ? attMetrics.rate+'%' : '—'}</div>
          </div>
        </div>
        <hr class="njtc-divider">
        ${notesHtml}
        ${ojtFormHtml}
        <hr class="njtc-divider">
        ${concernsHtml}
        ${tapHtml}
        ${pearlHtml}
        ${siHtml}
        <hr class="njtc-divider">
        ${surveyHtml}
        ${attnHtml}
        <hr class="njtc-divider">
        ${elaHtml}
        ${mathHtml}
        ${smHtml}
        ${loadingSpinnerHtml}
      </div>
    `;
  }

  /* ─────────────────────────────────────────────
     TUTOR OBJECT BUILDER (shared between phases)
  ───────────────────────────────────────────── */
  function buildTutors(data) {
    const tutorMap = buildTutorMap(data.att);

    // Pearl STU "Filled For" = tutor name — merge any tutors missing from ATT
    data.stu.forEach(r => {
      const tutorName = (r['Filled For'] || r['Tutor Name'] || '').trim();
      if (!tutorName) return;
      const key = normName(tutorName);
      if (!tutorMap[key]) {
        tutorMap[key] = {
          name: tutorName, district: r['District'] || '',
          school: r['School'] || r['Site'] || '',
          role: 'Instructor', id: key, attRows: [],
        };
      }
    });

    const irEla      = data.irEla     || [];
    const irMath     = data.irMath    || [];
    const ir2526Ela  = data.ir2526Ela || [];
    const ir2526Math = data.ir2526Math|| [];

    const allAttStudents = data.attStudents || [];

    return Object.values(tutorMap).map(t => {
      const tn = normName(t.name);
      const myAttRows = data.att.filter(r => {
        const vals = Object.values(r);
        return normName(r['User'] || vals[0] || '') === tn;
      });
      // Tutor's own Pearl User ID — from their ATT instructor rows (col 13)
      const tutor_pearl_id = myAttRows.length
        ? (myAttRows[0]['Pearl User ID'] || Object.values(myAttRows[0])[13] || '').trim()
        : '';
      const myStuRows = data.stu.filter(r => {
        const vals = Object.values(r);
        // STU col 1 = Filled For (tutor name) per Central portal STU_S.FILLED_FOR = 1
        return normName(r['Filled For'] || r['Tutor Name'] || vals[1] || '') === tn;
      });

      // Pearl STU bridge: col 0=Filled By (scholar name), col 1=Filled For (tutor name),
      // col 12=Filled by Pearl User ID, col 13=Filled for Pearl User ID
      const scholarPearlIds = new Set(myStuRows.map(r => {
        const vals = Object.values(r);
        // Header is exactly "Filled by Pearl User ID" per actual sheet
        return (r['Filled by Pearl User ID'] || r['Filled By ID'] || vals[12] || '').trim();
      }).filter(Boolean));
      const scholarNames = new Set();
      myStuRows.forEach(r => {
        const vals = Object.values(r);
        normNameVariants(r['Filled By'] || vals[0] || '').forEach(v => { if (v.length > 2) scholarNames.add(v); });
      });

      // SESS bridge: expand scholar sets with ALL session-linked scholars (not just survey submitters)
      // SESS col 1=Instructor, col 2=Students (comma-sep names), col 15=Pearl Instructor ID, col 16=Pearl Student IDs
      const sessRows = (data.sess || []).filter(r => {
        const vals = Object.values(r);
        const instName = (r['Instructor'] || vals[1] || '').trim();
        const instId   = (r['Pearl Instructor ID'] || vals[15] || '').trim();
        return normName(instName) === tn || (instId && instId === tutor_pearl_id);
      });
      sessRows.forEach(r => {
        const vals = Object.values(r);
        const names = (r['Students'] || vals[2] || '').split(',').map(s => s.trim()).filter(Boolean);
        names.forEach(n => { normNameVariants(n).forEach(v => { if (v.length > 2) scholarNames.add(v); }); });
        const ids = (r['Pearl Student IDs'] || vals[16] || '').split(',').map(s => s.trim()).filter(Boolean);
        ids.forEach(id => { if (id) scholarPearlIds.add(id); });
      });

      // Scholar ATT rows: match by Pearl User ID (primary) or display name (fallback)
      // ATT col 13 = Pearl User ID; STU col 12 = Filled By ID — same Pearl ID system
      const myAttStudents = allAttStudents.filter(r => {
        // Primary: Pearl User ID (header name varies — try all known variants + col index 13)
        const vals = Object.values(r);
        const attUid = (r['Pearl User ID'] || r['User ID'] || r['User_ID'] || r['UserId'] || vals[13] || '').trim();
        if (attUid && scholarPearlIds.has(attUid)) return true;
        // Fallback: normalized display name match
        const snam = normName(r['User'] || vals[0] || '');
        return snam.length > 2 && scholarNames.has(snam);
      });

      if (allAttStudents.length > 0 && scholarNames.size > 0 && myAttStudents.length === 0) {
        console.warn('[NJTCTeam] No ATT student rows matched for tutor', t.name,
          '| scholarNames sample:', [...scholarNames].slice(0,3),
          '| ATT sample user:', allAttStudents[0] && (allAttStudents[0]['User'] || ''),
          '| ATT sample UID:', allAttStudents[0] && (allAttStudents[0]['Pearl User ID'] || allAttStudents[0]['User ID'] || ''));
      }

      // iReady uses district Student IDs (not Pearl User IDs) — name matching is primary
      // nameInSet handles both "First Last" and "Last, First" formats used by iReady exports
      function matchScholar(r) {
        if (normName(r['Instructor'] || r['Teacher'] || '') === tn) return true;
        const rawName = r['Full Name'] || r['Student Name'] || r['Scholar Name'] || r['Name'] || '';
        return nameInSet(rawName, scholarNames);
      }

      const myElaRows  = irEla.filter(matchScholar);
      const myMathRows = irMath.filter(matchScholar);
      // Pair BOY+EOY rows per student (EOY CSV is multi-row-per-diagnostic format)
      const my2526Ela  = pairIr2526Diagnostics(ir2526Ela.filter(matchScholar));
      const my2526Math = pairIr2526Diagnostics(ir2526Math.filter(matchScholar));

      const tutorSchoolNorm = normName(t.school || '');
      const isSMTutor = [...SM_SCHOOLS].some(s => tutorSchoolNorm.includes(s));

      const attMetrics    = computeAttMetrics(myAttRows);
      const stuMetrics    = computeStuMetrics(myStuRows, myAttStudents);
      const irElaMetrics  = computeIReadyMetrics(my2526Ela.length  ? my2526Ela  : myElaRows,  !!my2526Ela.length);
      const irMathMetrics = computeIReadyMetrics(my2526Math.length ? my2526Math : myMathRows, !!my2526Math.length);
      const smMetrics     = isSMTutor ? computeSmMetrics(data.sm || [], t.name) : null;
      const siDetails     = computeSIDetails(myAttRows);
      const surveyAttn    = computeSurveyAttention(myStuRows);
      const tap           = getTapForTutor(data.tap || [], t.name);
      const tapLoaded     = !!(data.tapLoaded);
      const concerns      = getConcernsForTutor(data.concerns || [], t.name);

      return { ...t, attMetrics, stuMetrics, irElaMetrics, irMathMetrics, smMetrics, siDetails, surveyAttn, tap, tapLoaded, concerns };
    });
  }

  function sortAndRenderTutors(tutors, container, tapRows) {
    tutors.sort((a, b) => {
      const aFlag = (a.attMetrics.rate != null && a.attMetrics.rate < 80) || a.attMetrics.si >= 5 ? 0 : 1;
      const bFlag = (b.attMetrics.rate != null && b.attMetrics.rate < 80) || b.attMetrics.si >= 5 ? 0 : 1;
      if (aFlag !== bFlag) return aFlag - bFlag;
      return a.name.localeCompare(b.name);
    });

    window._njtcTeamTutors = tutors;

    const needsAttention = tutors.filter(t =>
      (t.attMetrics.rate != null && t.attMetrics.rate < 80) ||
      t.attMetrics.si >= 5 ||
      (!t.stuMetrics.surveyScores || t.stuMetrics.surveyScores.count === 0) ||
      t.stuMetrics.scholars.some(s => s.rate != null && s.rate < 60)
    );
    const apprentices = tutors.filter(t => t.tap && /active/i.test(t.tap['Status'] || t.tap['Apprentice Program Status'] || ''));

    let html = renderKPIStrip(tutors, tapRows || []);

    if (needsAttention.length > 0) {
      html += `<div class="njtc-section-title">⚠️ Needs Attention (${needsAttention.length})</div>`;
      html += `<div class="njtc-tutor-grid">${needsAttention.map(renderTutorCard).join('')}</div>`;
    }
    if (apprentices.length > 0) {
      html += `<div class="njtc-section-title">🎓 TAP Apprentices (${apprentices.length})</div>`;
      html += `<div class="njtc-tutor-grid">${apprentices.map(renderTutorCard).join('')}</div>`;
    }
    html += `<div class="njtc-section-title">Full Team Roster (${tutors.length})</div>`;
    html += `<div class="njtc-tutor-grid">${tutors.map(renderTutorCard).join('')}</div>`;

    container.innerHTML = html;
    ensureDetailDOM();

    // If a detail panel is open, refresh it with the updated tutor data
    // CRITICAL: Skip rebuild if the OJT form is currently open (user is entering data).
    // Rebuilding panel.innerHTML destroys checked checkboxes, losing the user's activity selections.
    // The updated data (TAP card, iReady) will appear next time they open the panel.
    if (_openDetailName) {
      const updated = tutors.find(t => normName(t.name) === normName(_openDetailName));
      if (updated) {
        const panel = document.getElementById('njtcDetailPanel');
        if (panel && panel.classList.contains('open')) {
          // Check if the OJT form body is currently visible (user is mid-entry)
          const nk = normName(_openDetailName).replace(/\s+/g, '_');
          const ojtFormBody = document.getElementById('ojtFormBody_' + nk);
          const formIsOpen = ojtFormBody && ojtFormBody.style.display !== 'none' && ojtFormBody.style.display !== '';
          if (!formIsOpen) {
            // Form is closed — safe to rebuild the panel with updated data
            panel.innerHTML = renderDetailPanel(updated);
          }
          // Form is open — do NOT rebuild; preserve the user's in-progress entry
        }
      }
    }
  }

  /* ─────────────────────────────────────────────
     MAIN BUILD FUNCTION  (progressive)
  ───────────────────────────────────────────── */
  async function build(userProfile) {
    if (!userProfile) return;
    _phase2Loaded = false;

    injectTeamStyles();

    const container = document.getElementById('njtcTeamContainer');
    if (!container) return;

    container.innerHTML = `<div class="njtc-team-loading"><div class="njtc-spinner"></div> Connecting to Pearl Operations…</div>`;

    // Detect leader role — HR list primary, Pearl ATT fallback
    let leaderInfo;
    try {
      leaderInfo = await detectLeader(userProfile);
    } catch(e) {
      leaderInfo = null;
    }
    if (!leaderInfo) {
      container.innerHTML = `<div style="color:#94a3b8;padding:32px;text-align:center">
        Unable to verify leader role. If you are a Site Coordinator or Instructional Coach,
        please contact your administrator.<br><br>
        <button onclick="window.NJTCTeam.refresh()" style="background:#1C7C8C;color:#fff;border:none;border-radius:6px;padding:8px 20px;cursor:pointer;font-size:.85rem">
          Try Again
        </button>
      </div>`;
      return;
    }

    _leaderProfile   = userProfile;
    _leaderDistricts = leaderInfo.districts;
    _leaderInfo      = leaderInfo;

    const teamTab = document.getElementById('njtcTeamTab');
    if (teamTab) teamTab.style.display = 'flex';

    container.innerHTML = `<div class="njtc-team-loading"><div class="njtc-spinner"></div> Loading attendance data…</div>`;

    // ── PHASE 1a: ATT + Login → render roster immediately ────────────────────
    let base;
    try {
      base = await loadAttAndLogin();
    } catch (e) {
      console.error('[NJTCTeam] ATT/Login load failed:', e);
      container.innerHTML = `<div style="color:#ef4444;padding:32px">
        Could not load team data. Pearl data source may be temporarily unavailable.
        <br><br>
        <button onclick="window.NJTCTeam.refresh()" style="background:#1C7C8C;color:#fff;border:none;border-radius:6px;padding:8px 20px;cursor:pointer;font-size:.85rem">
          Refresh
        </button>
      </div>`;
      return;
    }

    const p1Data = filterData(base.att, [], [], base.login, null, _leaderDistricts, userProfile.name);
    _teamData = p1Data;
    sortAndRenderTutors(buildTutors(p1Data), container, []);
    console.log('[NJTCTeam] Phase 1a rendered:', Object.keys(buildTutorMap(p1Data.att)).length, 'tutors (ATT only)');

    // ── PHASE 1b: STU + SESS → updates scholar counts, survey scores, pairing map ─
    loadStu().then(({ stu: stuRows, sess: sessRows }) => {
      const p1bData = filterData(base.att, stuRows, sessRows, base.login, null, _leaderDistricts, userProfile.name);
      _teamData = p1bData;
      sortAndRenderTutors(buildTutors(p1bData), container, []);
      console.log('[NJTCTeam] Phase 1b: STU', stuRows.length, 'rows | SESS', sessRows.length, 'rows');

      // ── PHASE 2: iReady + SM + TAP + Concerns (background) ──────────────────
      loadEnhancementData().then(enh => {
        const p2Data = filterData(base.att, stuRows, sessRows, base.login, enh, _leaderDistricts, userProfile.name);
        _teamData = p2Data;
        _phase2Loaded = true;
        sortAndRenderTutors(buildTutors(p2Data), container, enh.tap || []);
        console.log('[NJTCTeam] Phase 2: enhancement data loaded');
      }).catch(e => {
        _phase2Loaded = true; // mark done even on failure so UI stops showing spinner
        console.warn('[NJTCTeam] Enhancement data failed:', e);
      });

    });
  }

  /* ─────────────────────────────────────────────
     DETAIL OVERLAY DOM
  ───────────────────────────────────────────── */
  function ensureDetailDOM() {
    if (document.getElementById('njtcDetailOverlay')) return;

    const overlay = document.createElement('div');
    overlay.id = 'njtcDetailOverlay';
    overlay.className = 'njtc-detail-overlay';
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) window.NJTCTeam.closeDetail();
    });

    const panel = document.createElement('div');
    panel.id = 'njtcDetailPanel';
    panel.className = 'njtc-detail-panel';

    document.body.appendChild(overlay);
    document.body.appendChild(panel);
  }

  function openDetail(tutorName) {
    ensureDetailDOM();
    _openDetailName = tutorName;
    const tutors = window._njtcTeamTutors || [];
    const tutor = tutors.find(t => normName(t.name) === normName(tutorName));
    const panel = document.getElementById('njtcDetailPanel');
    const overlay = document.getElementById('njtcDetailOverlay');
    if (!panel || !overlay) return;

    panel.innerHTML = tutor
      ? renderDetailPanel(tutor)
      : `<div class="njtc-detail-close"><button onclick="window.NJTCTeam.closeDetail()">✕ Close</button></div><div style="padding:32px;color:#94a3b8">Tutor not found.</div>`;

    overlay.classList.add('open');
    panel.classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  function closeDetail() {
    _openDetailName = null;
    const panel = document.getElementById('njtcDetailPanel');
    const overlay = document.getElementById('njtcDetailOverlay');
    if (panel) panel.classList.remove('open');
    if (overlay) overlay.classList.remove('open');
    document.body.style.overflow = '';
  }

  async function refresh() {
    Object.values(CACHE_KEYS).forEach(k => { try { sessionStorage.removeItem(k); } catch (e) {} });
    if (_leaderProfile) build(_leaderProfile);
  }

  /* ─────────────────────────────────────────────
     KEYBOARD CLOSE
  ───────────────────────────────────────────── */
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') closeDetail();
  });

  /* ─────────────────────────────────────────────
     PROFILE READY LISTENER
  ───────────────────────────────────────────── */
  document.addEventListener('userProfileReady', function (e) {
    const profile = (e && e.detail) ? e.detail : window.NJTC_USER_PROFILE;
    if (profile) build(profile);
  });

  // If profile already available on load
  if (window.NJTC_USER_PROFILE) {
    build(window.NJTC_USER_PROFILE);
  }

  /* ─────────────────────────────────────────────
     PUBLIC API
  ───────────────────────────────────────────── */
  /* ─────────────────────────────────────────────
     NOTES — localStorage per tutor
  ───────────────────────────────────────────── */
  function editNote(tutorName, noteKey) {
    const displayId = 'noteDisplay_' + normName(tutorName);
    const display   = document.getElementById(displayId);
    if (!display) return;

    const current = (function(){ try { return localStorage.getItem(noteKey) || ''; } catch(e){ return ''; } })();

    const editId = 'noteEdit_' + normName(tutorName);
    if (document.getElementById(editId)) {
      document.getElementById(editId).remove();
      return;
    }

    const wrap = document.createElement('div');
    wrap.id = editId;
    wrap.style.cssText = 'margin-top:8px';
    wrap.innerHTML = `
      <textarea id="noteTA_${escHtml(normName(tutorName))}" rows="4"
        style="width:100%;background:#0f172a;border:1px solid #334155;border-radius:5px;color:#e2e8f0;padding:6px 8px;font-size:.82rem;resize:vertical"
      >${escHtml(current)}</textarea>
      <div style="display:flex;gap:8px;margin-top:6px">
        <button onclick="window.NJTCTeam.saveNote('${escHtml(tutorName).replace(/'/g,"\\'")}','${noteKey}')"
          style="background:#1C7C8C;color:#fff;border:none;border-radius:5px;padding:5px 14px;font-size:.78rem;cursor:pointer">Save</button>
        <button onclick="document.getElementById('${editId}').remove()"
          style="background:transparent;border:1px solid #334155;color:#94a3b8;border-radius:5px;padding:5px 14px;font-size:.78rem;cursor:pointer">Cancel</button>
      </div>
    `;
    display.after(wrap);
    document.getElementById('noteTA_' + normName(tutorName)).focus();
  }

  function saveNote(tutorName, noteKey) {
    const ta = document.getElementById('noteTA_' + normName(tutorName));
    if (!ta) return;
    const val = ta.value.trim();
    try { if (val) localStorage.setItem(noteKey, val); else localStorage.removeItem(noteKey); } catch(e){}
    const display = document.getElementById('noteDisplay_' + normName(tutorName));
    if (display) {
      display.style.color = val ? '#e2e8f0' : '#64748b';
      display.textContent = val || 'No notes yet. Click to add.';
    }
    const editEl = document.getElementById('noteEdit_' + normName(tutorName));
    if (editEl) editEl.remove();
    // Update button text
    const block = document.getElementById('notesBlock_' + normName(tutorName));
    if (block) {
      const btn = block.querySelector('button');
      if (btn) btn.textContent = val ? 'Edit' : '+ Add Note';
    }
  }

  /* ─────────────────────────────────────────────
     OJT FORM SUBMISSION
     Section 1: observation info
     Section 2: OJT activity + optional session duration
     RTI hours are logged separately by the Central Team portal
  ───────────────────────────────────────────── */
  async function submitOJT(tutorName, formId) {
    const k        = normName(tutorName).replace(/\s+/g, '_');
    const statusEl = document.getElementById('ojt_status_' + k);
    const btnEl    = document.getElementById('ojt_submit_btn_' + k);
    const get      = id => { const el = document.getElementById(id + '_' + k); return el ? el.value.trim() : ''; };

    const obsName        = get('ojt_obs_name');
    const obsRole        = get('ojt_obs_role');
    const site           = get('ojt_site');
    const dateVal        = get('ojt_date');
    const apprenticeName = get('ojt_name');
    const phase          = get('ojt_phase');
    const domain         = get('ojt_domain');
    const mark           = get('ojt_mark');
    const notes          = get('ojt_notes');
    const sessionDuration = get('ojt_session_duration');

    // Collect selected activity codes from in-memory store first (DOM-rebuild safe)
    // Fall back to live DOM query if store has no entry for this tutor
    const stored = _ojtSelectionStore[k];
    console.log('[NJTCTeam] submitOJT fired | k=' + k + ' | store:', stored ? stored.codes : 'EMPTY', '| phase:', phase, '| domain:', domain);
    const checklistDiv = document.getElementById('ojt_checklist_' + k);

    // Prefer store (survives phase2 panel rebuild); fall back to live DOM
    let selectedCodes = [];
    let storedPhase  = phase;
    let storedDomain = domain;

    if (stored && stored.codes && stored.codes.length > 0) {
      // Use the persisted selection — immune to DOM destruction
      selectedCodes = stored.codes;
      storedPhase   = stored.phase  || phase;
      storedDomain  = stored.domain || domain;
    } else {
      // Fall back to DOM
      if (checklistDiv && (!phase || !domain)) {
        checklistDiv.querySelectorAll('input[type=checkbox]').forEach(cb => { cb.checked = false; });
        const cs = document.getElementById('ojt_selected_count_' + k);
        if (cs) { cs.textContent = '0 activities selected'; cs.style.color = '#94a3b8'; }
      }
      const liveCBs = checklistDiv
        ? Array.from(checklistDiv.querySelectorAll('input[type=checkbox]:checked'))
        : [];
      selectedCodes = liveCBs.map(cb => cb.value).filter(Boolean);
    }

    const hasActivities = selectedCodes.length > 0;

    // Validation — require at least one activity selected
    if (!hasActivities) {
      ['ojt_phase','ojt_domain'].forEach(id => {
        const el = document.getElementById(id + '_' + k);
        if (el && !el.value) el.style.border = '2px solid #ef4444';
      });
      if (statusEl) {
        statusEl.style.cssText = 'color:#ef4444;font-weight:700;font-size:.79rem;display:block;margin-top:6px';
        statusEl.textContent = '\u2717 Select at least one activity to log.';
      }
      return;
    }

    if (statusEl) { statusEl.style.cssText = 'color:#94a3b8;font-size:.79rem;display:block;margin-top:6px'; statusEl.textContent = 'Submitting\u2026'; }
    if (btnEl)    { btnEl.disabled = true; btnEl.textContent = 'Submitting\u2026'; }

    try {
      // Build activities array from checked boxes
      const effectivePhase  = storedPhase  || phase;
      const effectiveDomain = storedDomain || domain;
      const phaseKey = effectivePhase.toLowerCase().indexOf('begin') >= 0 ? 'Beginning'
                     : effectivePhase.toLowerCase().indexOf('mid')   >= 0 ? 'Middle' : 'End';

      console.log('[NJTCTeam] Building activities | selectedCodes:', selectedCodes, '| phaseKey:', phaseKey, '| domain:', effectiveDomain);
      const activities = selectedCodes.map(code => {
        const act = OJT_ACTIVITY_DATA.find(d => d.code === code && d.phase === phaseKey && d.domain === effectiveDomain);
        const fullCode = act
          ? code + ' \u2014 ' + act.desc + ' [' + phaseKey + ' \u00b7 ' + effectiveDomain + ']'
          : code;
        return { phase: effectivePhase, domain: effectiveDomain, activityCode: fullCode, status: mark };
      });

      // Guard: if all activity codes are empty, the checklist was stale — abort
      const blankCodes = activities.filter(a => !a.activityCode || !a.activityCode.trim());
      if (blankCodes.length === activities.length && activities.length > 0 && !stored) {
        if (statusEl) {
          statusEl.style.cssText = 'color:#ef4444;font-weight:700;font-size:.79rem;display:block;margin-top:6px';
          statusEl.textContent = '\u2717 Activity codes missing — please reselect phase, domain, and activities, then submit again.';
        }
        if (btnEl) { btnEl.disabled = false; btnEl.textContent = 'Submit OJT Log'; }
        return;
      }

      // POST each activity as its own request — one row per activity in the OTJ sheet.
      // All activity fetches fire in parallel (Promise.all) so 18 activities take the
      // same wall-clock time as 1 (~2-3s) instead of 18 × sequential (~2 minutes).
      // Each request is still a flat JSON object — the proven working pattern.
      // RTI fires after all activity rows are confirmed dispatched.
      if (hasActivities) {
        const dur = sessionDuration ? parseFloat(sessionDuration) : 0;
        console.log('[NJTCTeam] POSTing', activities.length, 'activit' + (activities.length===1?'y':'ies') + ' in parallel | RTI hrs:', dur);

        const activityFetches = activities.map(act => fetch(TAP_SCRIPT_URL, {
          method: 'POST', mode: 'no-cors',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            logType:         'OJT Activity completion',
            obsDate:         dateVal,
            observerName:    obsName,
            observerRole:    obsRole,
            siteLocation:    site,
            apprenticeName:  apprenticeName,
            notes:           notes,
            phase:           act.phase,
            domain:          act.domain,
            activityCode:    act.activityCode,
            status:          act.status || mark,
            sessionDuration: dur,
          }),
        }));

        await Promise.all(activityFetches);

        // RTI POST fires after all activity rows are dispatched.
        // Apps Script writes one RTI row (col N = hours, col M = month) and
        // recalculateTotals sums all RTI rows for this apprentice → AZ cumulatively.
        if (dur > 0) {
          const obsDateObj  = dateVal ? new Date(dateVal + 'T12:00:00') : new Date();
          const monthNames  = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
          const rtiMonthLbl = monthNames[obsDateObj.getMonth()] + '-' + String(obsDateObj.getFullYear()).slice(2);
          console.log('[NJTCTeam] POSTing RTI | month:', rtiMonthLbl, '| hours:', dur);
          await fetch(TAP_SCRIPT_URL, {
            method: 'POST', mode: 'no-cors',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              logType:        'RTI Hours for a month',
              obsDate:        dateVal,
              observerName:   obsName,
              apprenticeName: apprenticeName,
              rtiMonth:       rtiMonthLbl,
              rtiHours:       dur,
              rtiTypes:       'Coaching / Professional development',
            }),
          });
        }
      }


    } catch(e) {
      console.warn('[NJTCTeam] submitOJT error:', e.message);
    }

    // Success feedback
    const actCount  = selectedCodes.length;
    const durLogged = sessionDuration ? parseFloat(sessionDuration) : 0;
    const rtiNote   = durLogged > 0 ? ' + ' + durLogged + ' RTI hrs.' : '.';
    if (statusEl) {
      statusEl.style.cssText = 'color:#34d399;font-weight:700;font-size:.79rem;display:block;margin-top:6px';
      statusEl.textContent = '\u2713 ' + actCount + ' activit' + (actCount===1?'y':'ies') + ' logged' + rtiNote + ' Updating in ~30s.';
    }
    if (btnEl) { btnEl.disabled = false; btnEl.textContent = 'Submit OJT Log'; }

    // Clear in-memory store and reset form
    delete _ojtSelectionStore[k];
    if (checklistDiv) checklistDiv.querySelectorAll('input[type=checkbox]').forEach(cb => { cb.checked = false; });
    const countSpan = document.getElementById('ojt_selected_count_' + k);
    if (countSpan) { countSpan.textContent = '0 activities selected'; countSpan.style.color = '#94a3b8'; }
    ['ojt_phase','ojt_domain','ojt_session_duration','ojt_notes'].forEach(id => {
      const el = document.getElementById(id + '_' + k);
      if (el) { el.value = ''; el.style.border = ''; }
    });
    const markEl = document.getElementById('ojt_mark_' + k);
    if (markEl) markEl.value = 'Y \u2014 Observed and completed';
    setTimeout(() => { if (statusEl) statusEl.textContent = ''; }, 9000);
  }


  function _ojtResetForm(nk) {
    var b  = document.getElementById('ojtFormBody_' + nk);
    var ph = document.getElementById('ojt_phase_'  + nk);
    var dm = document.getElementById('ojt_domain_' + nk);
    var cl = document.getElementById('ojt_checklist_' + nk);
    var cs = document.getElementById('ojt_selected_count_' + nk);
    var opening = !b || b.style.display === 'none' || b.style.display === '';
    if (b) b.style.display = opening ? 'block' : 'none';
    if (opening) {
      if (ph) ph.value = '';
      if (dm) dm.value = '';
      if (cl) {
        cl.innerHTML = '';
        var hint = document.createElement('div');
        hint.style.cssText = 'color:#64748b;font-size:.73rem;padding:6px';
        hint.textContent = 'Select a phase and domain to see activities…';
        cl.appendChild(hint);
      }
      if (cs) { cs.textContent = '0 activities selected'; cs.style.color = '#94a3b8'; }
      // Clear in-memory store when form is reset
      delete _ojtSelectionStore[nk];
    }
  }

  /* ── _ojtFilterActivities ─────────────────────────────────────────────── */
  function _ojtFilterActivities(nk) {
    var phaseSel  = document.getElementById('ojt_phase_'     + nk);
    var domainSel = document.getElementById('ojt_domain_'    + nk);
    var listDiv   = document.getElementById('ojt_checklist_' + nk);
    var countSpan = document.getElementById('ojt_selected_count_' + nk);
    if (!phaseSel || !domainSel || !listDiv) return;
    var phaseVal  = phaseSel.value;
    var domainVal = domainSel.value;
    if (!phaseVal || !domainVal) {
      listDiv.innerHTML = '<div style="color:#64748b;font-size:.73rem;padding:6px">Select a phase and domain to see activities\u2026</div>';
      if (countSpan) { countSpan.textContent = '0 activities selected'; countSpan.style.color = '#94a3b8'; }
      return;
    }
    var phKey = phaseVal.toLowerCase().indexOf('begin') >= 0 ? 'Beginning'
              : phaseVal.toLowerCase().indexOf('mid')   >= 0 ? 'Middle' : 'End';
    var matches = OJT_ACTIVITY_DATA.filter(function(d) {
      return d.phase === phKey && d.domain === domainVal;
    });
    if (!matches.length) {
      listDiv.innerHTML = '<div style="color:#64748b;font-size:.73rem;padding:6px">No activities for this combination.</div>';
      return;
    }
    var html = matches.map(function(d) {
      var cbId = 'ojt_cb_' + nk + '_' + d.code;
      return '<label style="display:flex;align-items:flex-start;gap:8px;padding:5px 4px;cursor:pointer;border-radius:4px" ' +
        'onmouseover="this.style.background=\'rgba(28,124,140,.15)\'" onmouseout="this.style.background=\'\'">' +
        '<input type="checkbox" id="' + cbId + '" value="' + d.code + '" ' +
        'style="margin-top:3px;accent-color:#1C7C8C;flex-shrink:0" ' +
        'onchange="window.NJTCTeam._ojtCountSelected(\'' + nk + '\')">' +
        '<span style="font-size:.74rem;color:#cbd5e1;line-height:1.4">' +
        '<strong style="color:#e2e8f0">' + d.code + '</strong> \u2014 ' + d.desc +
        '<span style="display:block;font-size:.67rem;color:#1C7C8C;margin-top:2px">\u2713 ' + d.lookFor + '</span>' +
        '</span></label>';
    }).join('');
    listDiv.innerHTML = html;
    if (countSpan) { countSpan.textContent = '0 of ' + matches.length + ' selected'; countSpan.style.color = '#94a3b8'; }
  }

  function _ojtCountSelected(nk) {
    var listDiv   = document.getElementById('ojt_checklist_' + nk);
    var countSpan = document.getElementById('ojt_selected_count_' + nk);
    if (!listDiv || !countSpan) return;
    var checkedBoxes = listDiv.querySelectorAll('input[type=checkbox]:checked');
    var total        = listDiv.querySelectorAll('input[type=checkbox]').length;
    countSpan.textContent = checkedBoxes.length + ' of ' + total + ' selected';
    countSpan.style.color = checkedBoxes.length > 0 ? '#34d399' : '#94a3b8';

    // Persist selections to in-memory store — survives panel DOM rebuild
    var phaseSel  = document.getElementById('ojt_phase_'  + nk);
    var domainSel = document.getElementById('ojt_domain_' + nk);
    var phase  = phaseSel  ? phaseSel.value  : '';
    var domain = domainSel ? domainSel.value : '';
    var codes = [];
    checkedBoxes.forEach(function(cb) { if (cb.value) codes.push(cb.value); });
    if (phase && domain) {
      _ojtSelectionStore[nk] = { phase: phase, domain: domain, codes: codes };
      console.log('[NJTCTeam] _ojtSelectionStore updated | nk=' + nk + ' | codes:', codes);
    } else {
      delete _ojtSelectionStore[nk];
    }
  }

  window.NJTCTeam = { build, openDetail, closeDetail, refresh, editNote, saveNote, submitOJT,
                      _ojtFilterActivities, _ojtCountSelected, _ojtResetForm };

})();
