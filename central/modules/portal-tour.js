// ─────────────────────────────────────────────────────────────────────────────
// NJTC Central Team Portal — PIE Tutorial
//
// A glowing "Tutorial" button in the top bar opens PIE's tutorial menu:
//   • Full tour of every section THIS department (lens) sees, in the order
//     that department works
//   • "Tour this page" for whatever page is open
//   • Any single section on its own
//
// Accuracy rules (why this stays correct as the portal changes):
//   • Chapters are built from the sidebar links that are actually visible
//     for the current lens (window._currentDept) — never a hard-coded list.
//   • Every chapter starts on its real sidebar link (the jump path), then
//     opens the page with the portal's own showPanel(), exactly like a click.
//   • Each step names one or more selectors; the first one that is on screen
//     is highlighted. If none is (e.g. data still loading), the step points at
//     the page title instead — never at empty space.
// ─────────────────────────────────────────────────────────────────────────────
(function () {
  'use strict';

  const SEEN_KEY = 'njtc_ct_tour_seen_v1';
  const DONE_KEY = 'njtc_ct_tour_done_v1';

  // ── Department lenses: chapter order (anything visible but unlisted is
  //    appended at the end, so a new section is never left out) ───────────
  const ORDER = {
    hr:          ['home', 'talent', 'concern', 'perf', 'tap-standalone', 'training-analytics', 'pearl-ops', 'sy-analytics', 'kpi', 'kpi-analytics', 'policies', 'iready-lab', 'knowtion'],
    programming: ['home', 'pearl-ops', 'sy-analytics', 'concern', 'perf', 'talent', 'onsite-feedback', 'scholar-feedback', 'survey-feedback', 'annual-report', 'tap-standalone', 'training-analytics', 'kpi', 'kpi-analytics', 'iready-lab', 'policies', 'knowtion'],
    finance:     ['home', 'finance-analytics', 'kpi', 'kpi-analytics', 'tap-standalone', 'pearl-ops', 'sy-analytics', 'training-analytics', 'iready-lab', 'policies', 'knowtion'],
    data:        ['home', 'pearl-ops', 'data-cabinet', 'upload', 'impact-report', 'apprentice-impact', 'iready-lab', 'sy-analytics', 'talent', 'concern', 'perf', 'tap-standalone', 'training-analytics', 'kpi', 'kpi-analytics', 'annual-report', 'survey-feedback', 'onsite-feedback', 'scholar-feedback', 'policies', 'knowtion'],
    training:    ['home', 'training-analytics', 'tap-standalone', 'pearl-ops', 'sy-analytics', 'kpi', 'kpi-analytics', 'iready-lab', 'policies', 'knowtion'],
    leadership:  ['home', 'kpi', 'kpi-analytics', 'advocacy', 'annual-report', 'pearl-ops', 'sy-analytics', 'talent', 'perf', 'tap-standalone', 'training-analytics', 'iready-lab', 'survey-feedback', 'onsite-feedback', 'scholar-feedback', 'upload', 'policies', 'knowtion'],
    kb:          ['home', 'kpi', 'kpi-analytics', 'advocacy', 'annual-report', 'pearl-ops', 'sy-analytics', 'talent', 'perf', 'tap-standalone', 'training-analytics', 'iready-lab', 'survey-feedback', 'onsite-feedback', 'scholar-feedback', 'upload', 'policies', 'knowtion'],
  };

  const EXEC = ['leadership', 'data', 'kb'];
  const isExec = d => EXEC.indexOf(d) >= 0;

  // ── Chapters. text may be a string or (dept) => string. `only` limits a
  //    step to certain departments. ─────────────────────────────────────────
  const CH = {
    home: {
      why: 'Your starting point every day.',
      steps: [
        { t: ['#homeTitle'], title: 'Your department home', text: d => isExec(d)
            ? 'This is your home base. Everything here is live, and it refreshes on its own.'
            : 'This is your home base: your department\'s goals, shortcuts and next meeting, all in one place.' },
        { t: ['#lbMeetingPill'], title: 'Next team meeting', text: 'The next biweekly team meeting is always shown here, so you never have to look it up.' },
        { t: ['#execDashboard'], only: EXEC, title: 'Executive Command Center', text: 'The whole program at a glance. Use the school-year buttons to compare SY 25-26, Summer 2026 and SY 26-27, and ↺ Refresh to pull the latest data.' },
        { t: ['#homeDeptWidget'], only: ['hr', 'leadership', 'data', 'kb'], title: 'Staff attrition & onboarding', text: 'HR & Data termination analytics and the onsite onboarding tracker: who has left, why, and how new staff are moving through onboarding.' },
        { t: ['#homeStatsStrip'], title: 'Goal progress', text: 'How many of your KPI goals are Met, In Progress or Partially Met. Open KPI Targets for the detail behind each number.' },
        { t: ['#homeQuickLinks'], title: 'Quick links', text: 'One-click shortcuts to the places your department uses most. Click "Go →" to jump straight there.' },
        { t: ['#homeFinanceLinks'], only: ['finance', 'leadership', 'kb'], title: 'Financial workbooks', text: 'Your finance workbooks and outreach tracker open from here in a new tab.' },
        { t: ['#progCabinet'], only: ['programming'], title: 'Programming file cabinet', text: 'Every Programming resource, by topic. Click a heading to open it; links open in a new tab.' },
        { t: ['#njtcGuideBarBtn'], title: 'Definitions on every page', text: 'Each page has this Section Guide bar. Click "View Definitions" for plain-language explanations of every number on that page.' },
      ],
    },
    'pearl-ops': {
      why: 'Live tutoring operations from Pearl: attendance, sessions, surveys and interruptions.',
      steps: [
        { t: ['#panel-pearl-ops .ph-title'], title: 'Pearl Operations', text: 'Live data from Pearl for every site. It refreshes every 5 minutes; ↺ Refresh pulls it right away.' },
        { t: ['#poPeriodBtn_sy2627', '#poPeriodBtn_sy2526'], title: 'Pick the school year', text: 'SY 26-27 is live. SY 25-26 and Summer 2026 are archived snapshots for comparison.' },
        { t: ['#poStatsStrip'], title: 'The numbers that matter', text: 'Scholar attendance (goal 80%), tutor attendance (goal 90%), sessions delivered, service interruptions, survey averages and incomplete sessions. Service interruptions never count against attendance.' },
        { t: ['#poFilterStrip', '#poGlobalSearch'], title: 'Filter and search', text: 'Narrow everything by district, school or week, or search for a tutor or scholar by name. ✕ Clear resets it.' },
        { t: ['#poMainContent'], title: 'Drill from site to person', text: 'Click a school to open its full view, then a tutor or scholar for their sessions, surveys and missed reasons. The breadcrumb takes you back.' },
        { t: ['[data-tour="po-support-ne"]'], only: ['programming', 'data'], title: 'Regional support reports', text: 'NE Support Report and SW Support Report list exactly who needs follow-up: incomplete sessions, missing tutor and scholar surveys, blank or mismatched missed reasons, and teacher pull-outs, by campus and by tutor. Download a PDF for field staff or Excel for the full lists with Session IDs.' },
        { t: ['#poCriticalBtn'], title: 'Needs Review', text: 'Items Pearl Ops flagged for attention. The count updates with the data.' },
        { t: ['button.po-pdf-data-only[data-pdf-region="NE"]'], only: ['data'], title: 'Regional PDFs', text: 'Two-page NE, SW and Network memos: key numbers, executive summary and red flags to watch.' },
        { t: ['button.po-pdf-data-only[onclick*="showFieldReportModal"]'], only: ['data'], title: 'Onsite Staff Report', text: 'Survey follow-up and comments for onsite staff, filtered by region, school or tutor.' },
        { t: ['button.po-partner-pdf-btn'], title: 'Partner PDF', text: 'The exact Weekly Operations Report a partner downloads from their dashboard. Use it before a partner meeting.' },
      ],
    },
    'sy-analytics': {
      why: 'Every site on a map with its school-year details.',
      steps: [
        { t: ['#panel-sy-analytics .ph-title'], title: 'Site Analytics', text: 'Every NJTC site for the school year: where it is, who staffs it and what it offers.' },
        { t: ['#syPeriodBtn_sy2627', '#syPeriodBtn_sy2526'], title: 'Pick the period', text: 'Switch between SY 26-27, Summer 2026 and the SY 25-26 archive.' },
        { t: ['#syStatSites'], title: 'Totals', text: 'Sites, districts, actual and estimated scholars, and staffing for the period you picked.' },
        { t: ['#syFDistrict'], title: 'Filters', text: 'Filter by district, content, tutoring type, assessment, days or status. ✕ Clear resets them.' },
        { t: ['#syMainLayout', '#syMap'], title: 'Map and site card', text: 'Click a map pin or a table row to see that site\'s details.' },
      ],
    },
    concern: {
      why: 'Documented support conversations with staff.',
      steps: [
        { t: ['#panel-concern .ph-title'], title: 'Support Log', text: 'Every documented support conversation, coaching note and HR step, newest first.' },
        { t: ['#slLogBtnWrap'], title: 'Log a new concern', text: '"+ Log New Concern" opens the form. Each entry builds the record that formal next steps rely on.' },
        { t: ['#slIndex'], title: 'Open, resolved and this week', text: 'Totals at the top, then each entry by week. Repeat concerns for the same person show in red.' },
      ],
    },
    perf: {
      why: 'Formal performance concerns, step by step.',
      steps: [
        { t: ['#panel-perf .ph-title'], title: 'Performance Concerns', text: 'Document a formal performance concern in four short steps.' },
        { t: ['#sp1'], title: 'Four steps', text: 'Submitter → Employee → Concern → Next Steps. Your progress shows here as you go.' },
        { t: ['#concernForm', '#formContainer'], title: 'Be specific', text: 'Describe what happened, when, and what is expected. Specific, observable facts make the next step clear and fair.' },
      ],
    },
    talent: {
      why: 'Staff profiles, retention, hiring and DOL reporting.',
      steps: [
        { t: ['#panel-talent .ph-title'], title: 'Talent Analytics', text: 'Your staff picture: profiles, attrition, hiring and apprenticeship, live from the HR Master List. ADP status is the source of truth.' },
        { t: ['#ap-prog-panel'], title: 'Tutor Apprenticeship at a glance', text: 'TAP enrollment and OTJ flags by network. "Breakdown" expands the detail.' },
        { t: ['#ap-hr-filter-bar'], title: 'Filter by apprentice status', text: 'Show all staff, or only Enrolled, Eligible or Not Eligible apprentices.' },
        { t: ['#talentTab-profiles'], title: 'Profiles', text: 'Search any staff member to see attendance, Pearl performance tier, support history and apprenticeship status.' },
        { t: ['#talentTab-dol'], title: 'DOL Report', text: 'Monthly headcount, new hires and separations by type, ready for Department of Labor reporting.' },
        { t: ['#talentTab-definitions'], title: 'Definitions', text: 'How every Talent number is calculated, in plain language.' },
      ],
    },
    'training-analytics': {
      why: 'PD sessions, training intake and apprentice progress.',
      steps: [
        { t: ['#panel-training-analytics .ph-title'], title: 'Training & Development', text: 'Professional development, training intake and apprenticeship progress in one place.' },
        { t: ['#tdTabNav'], title: 'Four views', text: 'PD Sessions (attendance and ratings), Training Intake, T&D Analytics (apprentice progress) and Field Intel (what staff report from the field).' },
        { t: ['#tdExecPDFBtn'], title: 'T&D Report PDF', text: 'A ready-to-share PDF summary of training and development.' },
      ],
    },
    'tap-standalone': {
      why: 'How we track apprentice tutors: roster, OJT, wages and compliance.',
      steps: [
        { t: ['#panel-tap-standalone .ph-title'], title: 'TAP Apprenticeship Dashboard', text: 'Everyone on the Master Roster (Apprentices, Pre-apprentices and Tutors) with live progress toward DOL requirements.' },
        { t: ['#tapTab-overview'], title: 'Program Overview', text: 'Enrollment against the DOL target and overall OJT/RTI hour progress.' },
        { t: ['#tapTab-roster'], title: 'Active Roster', text: 'Each apprentice with their site, status and hours.' },
        { t: ['#tapTab-ojt'], title: 'OJT Progress', text: 'On-the-job training checklist completion by phase. Items needing follow-up show in red.' },
        { t: ['#tapTab-milestones'], title: 'Wage Milestones', text: 'Who has reached, or is close to, their next wage step.' },
        { t: ['#tapTab-compliance'], title: 'GAINS Compliance', text: 'DOL registration and paperwork status, so nothing lapses.' },
        { t: ['#tapTab-ojt-log'], title: 'Log OJT Activity', text: 'Record an observation or OJT activity. It updates the apprentice\'s progress.' },
      ],
    },
    'iready-lab': {
      why: 'Academic growth from i-Ready diagnostics.',
      steps: [
        { t: ['#irlabContainer'], title: 'i-Ready Analysis Lab', text: 'Scholar growth from i-Ready diagnostics: typical growth, placement levels and who moved up, across school years.' },
        { t: ['div.irlab-dept-tabs'], title: 'Views for every team', text: 'Pick the view built for your work: Leadership, Programming, Data & Eval, HR, Finance or Training & Dev.' },
        { t: ['#irlabApplyBtn', '#irlabSlot_math'], title: 'Load diagnostic files', text: 'Data & Eval loads the Math and ELA longitudinal files here; "Apply & Refresh All Views" updates every chart.' },
        { t: ['table.irlab-rank-table'], title: 'Rankings', text: 'Rank schools, grades or districts by growth. Click a column to compare.' },
      ],
    },
    kpi: {
      why: 'Our organizational goals and where each one stands.',
      steps: [
        { t: ['#panel-kpi .ph-title'], title: 'KPI Targets', text: 'Every organizational goal for the year, who owns it, and its Mid-Year and End-of-Year status.' },
        { t: ['#kpiSummary'], title: 'Status at a glance', text: 'How many targets are Met, In Progress, Partially Met, in the pipeline or not met.' },
        { t: ['#kpiGoalFilter'], title: 'Filter the list', text: 'Filter by goal area, Mid-Year or End-of-Year cycle, or status, or search for a target.' },
        { t: ['#kpiBody'], title: 'Target detail', text: 'Each row shows the target, its status, and the owner and data source behind it.' },
      ],
    },
    'kpi-analytics': {
      why: 'Trends behind the goals.',
      steps: [
        { t: ['#panel-kpi-analytics .ph-title'], title: 'KPI Analytics', text: 'Where we started, where we are now, and which goal areas need focus.' },
        { t: ['button.kpia-inquire-trigger'], title: 'Ask about a KPI', text: '"Submit KPI Inquiry" sends a question about a target straight to the Data team.' },
        { t: ['#ap-data-section'], title: 'Apprentice vs non-apprentice', text: 'A live comparison of apprentice and non-apprentice outcomes.' },
      ],
    },
    'finance-analytics': {
      why: 'Partnership and workforce risk.',
      steps: [
        { t: ['#panel-finance-analytics .ph-title'], title: 'Partnership & Workforce Risk', text: 'Where partnerships and staffing carry risk: HR concerns, HR actions and attendance by district and partner.' },
        { t: ['button.pst-tab'], title: 'Pick the year', text: 'Compare all years, or one school year at a time.' },
        { t: ['table.ta-table'], title: 'Risk tables', text: 'Staff-level and partner-level tables. Sort by any column to find the biggest risks first.' },
      ],
    },
    'impact-report': {
      why: 'Build an impact or interruption report in minutes.',
      steps: [
        { t: ['#panel-impact-report .ph-title'], title: 'Impact Report Builder', text: 'Build a report for any reasons, schools and dates, straight from Pearl.' },
        { t: ['#irbConfigPanel'], title: 'Choose reasons', text: 'Quick buttons pick all service interruptions, scholar reasons, tutor-related reasons or school closures.' },
        { t: ['#irbDistrictFilter'], title: 'Where and when', text: 'Pick a district, school and period (this week, last 4 weeks, or custom dates).' },
        { t: ['#irbGenerateBtn'], title: 'Generate', text: 'Generate the report, then save it as a Quick Report to reuse next time.' },
      ],
    },
    'apprentice-impact': {
      why: 'The TAP Apprentice Impact Report.',
      steps: [
        { t: ['#panel-apprentice-impact .ph-title'], title: 'Apprentice Impact Report', text: 'Combines Pearl, survey and TAP data for every apprentice.' },
        { t: ['#apirGenBtn'], title: 'Generate', text: 'Click Generate to build the report from the latest data.' },
      ],
    },
    'data-cabinet': {
      why: 'Where every number comes from.',
      steps: [
        { t: ['#panel-data-cabinet .ph-title'], title: 'Data Sources', text: 'Every live source that powers the portal, with links. Check here first when a number looks off.' },
      ],
    },
    upload: {
      why: 'Shared department files.',
      steps: [
        { t: ['#panel-upload .ph-title'], title: 'Drive Center', text: 'Upload, find and open shared department documents.' },
      ],
    },
    'annual-report': {
      why: 'The Annual Impact & Satisfaction Report.',
      steps: [
        { t: ['#panel-annual-report .ph-title'], title: 'Annual Impact & Satisfaction Report', text: 'Goals, partner satisfaction and impact combined into one report.' },
        { t: ['#annualReportRoot'], title: 'Three formats', text: 'Download a PDF, PPTX slides, or open the live presentation for a meeting.' },
      ],
    },
    'survey-feedback': {
      why: 'What partners told us, quarterly and end of year.',
      steps: [{ t: ['#sfContainer'], title: 'Partner Satisfaction', text: 'Quarterly and end-of-year partner survey results by district and role.' }],
    },
    'onsite-feedback': {
      why: 'What onsite staff told us.',
      steps: [{ t: ['#osfContainer'], title: 'Onsite Feedback', text: 'Survey results from tutors, site coordinators and instructional coaches.' }],
    },
    'scholar-feedback': {
      why: 'What scholars told us.',
      steps: [{ t: ['#schfContainer'], title: 'Scholar Feedback', text: 'Scholars\' self-reported confidence and satisfaction with tutoring.' }],
    },
    advocacy: {
      why: 'Talking points and one-pagers for every audience.',
      steps: [
        { t: ['button.adv-audience-chip'], title: 'Choose your audience', text: 'Governor\'s Office, Legislature, Philanthropic Donors or District Partners. The content adjusts to each.' },
        { t: ['div.adv-tabs'], title: 'Five tools', text: 'Talking Points, Impact Snapshot, ROI Calculator, KPI Brief, and Highlights & Media, all built on live data.' },
        { t: ['button.adv-btn-print'], title: 'One-pager', text: 'Print or export a one-page PDF for your meeting.' },
      ],
    },
    policies: {
      why: 'Policies and procedures, searchable.',
      steps: [
        { t: ['#panel-policies .ph-title'], title: 'Policies Library', text: 'NJTC policies, procedures and the operations manual.' },
        { t: ['#policySearch'], title: 'Find a policy fast', text: 'Search, filter by department, or sort by date. "Read Policy" opens the full document.' },
      ],
    },
    knowtion: {
      why: 'Our team community.',
      steps: [{ t: ['#kntionContainer'], title: 'Knowtion Community', text: 'Where the team shares wins, resources and updates.' }],
    },
  };

  // ── Helpers ────────────────────────────────────────────────────────────
  const curDept = () => window._currentDept || (window.NJTC_SESSION || {}).dept || 'programming';
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} },
  };
  function visible(el) {
    if (!el) return false;
    const r = el.getBoundingClientRect();
    if (r.width < 4 || r.height < 4) return false;
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || cs.display === 'none') return false;
    return el.offsetParent !== null || cs.position === 'fixed';
  }
  function firstVisible(sels) {
    for (const s of sels) {
      let list = [];
      try { list = document.querySelectorAll(s); } catch (e) { continue; }
      for (const el of list) if (visible(el)) return el;
    }
    return null;
  }
  function navLinks() {
    return [...document.querySelectorAll('.sidebar-link[data-panel]')].filter(visible);
  }
  function linkFor(panel) { return navLinks().find(a => a.dataset.panel === panel) || null; }
  function linkLabel(a) {
    if (!a) return '';
    const c = a.cloneNode(true);
    c.querySelectorAll('.sl-badge, [class*="badge"]').forEach(x => x.remove()); // drop live counts
    return c.textContent.replace(/\s+/g, ' ').trim();
  }
  function groupOf(a) {
    const g = a && a.closest('.sidebar-group');
    const l = g && g.querySelector('.sidebar-group-label');
    return l ? l.textContent.trim() : '';
  }
  function chaptersFor(dept) {
    const seen = new Set(), list = [];
    navLinks().forEach(a => seen.add(a.dataset.panel));
    (ORDER[dept] || ORDER.programming).forEach(p => { if (seen.has(p) && CH[p] && !list.includes(p)) list.push(p); });
    seen.forEach(p => { if (CH[p] && !list.includes(p)) list.push(p); });
    return list;
  }
  function stepsFor(panel, dept) {
    return (CH[panel].steps || []).filter(s => !s.only || s.only.indexOf(dept) >= 0);
  }
  const txt = (v, d) => typeof v === 'function' ? v(d) : v;

  // ── UI ─────────────────────────────────────────────────────────────────
  const PIE_SVG = '<svg viewBox="0 0 48 48" style="width:100%;height:100%"><circle cx="24" cy="24" r="24" fill="#0a1628"/><path d="M24 6a18 18 0 0 1 18 18H24Z" fill="#f0a500"/><path d="M24 24 6 24a18 18 0 0 1 9-15.6Z" fill="#ffd166"/><path d="M24 24 6 24a18 18 0 0 0 27 15.6Z" fill="#1a7aff"/><circle cx="24" cy="24" r="4" fill="#fff"/></svg>';
  function injectCSS() {
    if (document.getElementById('ctTourCss')) return;
    const s = document.createElement('style'); s.id = 'ctTourCss';
    s.textContent = `
      .ct-tour-btn{display:inline-flex;align-items:center;gap:.4rem;padding:.42rem .9rem;border-radius:999px;border:1px solid rgba(255,209,102,.7);
        background:linear-gradient(135deg,#f0a500,#ffd166);color:#0a1628;font:inherit;font-size:.78rem;font-weight:800;letter-spacing:.02em;cursor:pointer;
        box-shadow:0 0 0 0 rgba(240,165,0,.55);animation:ctTourGlow 2.4s ease-in-out infinite;margin-right:.5rem}
      .ct-tour-btn:hover{filter:brightness(1.06);transform:translateY(-1px)}
      .ct-tour-btn.new{animation:ctTourGlowStrong 1.6s ease-in-out infinite}
      @keyframes ctTourGlow{0%,100%{box-shadow:0 0 0 0 rgba(240,165,0,.35)}50%{box-shadow:0 0 14px 3px rgba(240,165,0,.45)}}
      @keyframes ctTourGlowStrong{0%,100%{box-shadow:0 0 0 0 rgba(240,165,0,.6)}50%{box-shadow:0 0 22px 7px rgba(240,165,0,.7)}}
      @media (prefers-reduced-motion:reduce){.ct-tour-btn,.ct-tour-btn.new{animation:none;box-shadow:0 0 10px 2px rgba(240,165,0,.45)}}
      #ctTourMenu{position:fixed;inset:0;z-index:12000;background:rgba(10,22,40,.55);backdrop-filter:blur(3px);display:none;align-items:flex-start;justify-content:center;padding:5vh 1rem;overflow:auto}
      #ctTourMenu.open{display:flex}
      .ctm-box{background:#fff;border-radius:18px;width:640px;max-width:100%;box-shadow:0 30px 80px rgba(10,22,40,.35);overflow:hidden;font-family:inherit}
      .ctm-head{background:linear-gradient(135deg,#0a1628,#003087);color:#fff;padding:1.1rem 1.3rem;display:flex;gap:.85rem;align-items:center}
      .ctm-pie{width:44px;height:44px;flex-shrink:0}
      .ctm-head h3{margin:0;font-size:1.05rem}.ctm-head p{margin:.15rem 0 0;font-size:.8rem;color:rgba(255,255,255,.75)}
      .ctm-x{margin-left:auto;background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.2);color:#fff;border-radius:8px;width:32px;height:32px;cursor:pointer;font-size:1rem}
      .ctm-body{padding:1.1rem 1.3rem 1.3rem}
      .ctm-cta{display:flex;gap:.6rem;flex-wrap:wrap;margin-bottom:1rem}
      .ctm-cta button{flex:1;min-width:200px;padding:.75rem .9rem;border-radius:12px;border:none;font:inherit;font-weight:800;font-size:.86rem;cursor:pointer;text-align:left}
      .ctm-full{background:linear-gradient(135deg,#f0a500,#ffd166);color:#0a1628}
      .ctm-here{background:#eef4ff;color:#003087;border:1.5px solid #c7d8f5!important}
      .ctm-cta small{display:block;font-weight:600;font-size:.72rem;opacity:.8;margin-top:.15rem}
      .ctm-label{font-size:.68rem;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:#64748b;margin:.2rem 0 .5rem}
      .ctm-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:.5rem}
      .ctm-ch{display:flex;flex-direction:column;gap:.15rem;text-align:left;padding:.6rem .7rem;border-radius:10px;border:1px solid #e2e8f0;background:#fff;cursor:pointer;font:inherit}
      .ctm-ch:hover{border-color:#0050c8;background:#f8fbff}
      .ctm-ch b{font-size:.82rem;color:#0a1628}.ctm-ch span{font-size:.7rem;color:#64748b}
      .ctm-ch.done b::after{content:' ✓';color:#0d6e3a}
      #ctTourSpot{position:fixed;z-index:12001;border-radius:12px;pointer-events:none;box-shadow:0 0 0 9999px rgba(10,22,40,.58),0 0 0 3px #f0a500;transition:all .28s ease;display:none}
      #ctTourCard{position:fixed;z-index:12002;width:340px;max-width:calc(100vw - 24px);background:#fff;border-radius:14px;box-shadow:0 20px 60px rgba(10,22,40,.35);padding:.95rem 1rem .85rem;display:none;font-family:inherit}
      .ctc-top{display:flex;align-items:center;gap:.55rem;margin-bottom:.45rem}.ctc-pie{width:28px;height:28px;flex-shrink:0}
      .ctc-ch{font-size:.68rem;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:#0050c8}
      .ctc-title{font-size:.98rem;font-weight:800;color:#0a1628;margin:0 0 .3rem}
      .ctc-text{font-size:.84rem;line-height:1.5;color:#334155;margin:0}
      .ctc-path{margin-top:.5rem;font-size:.74rem;color:#64748b}.ctc-path b{color:#0a1628}
      .ctc-bar{height:4px;background:#e2e8f0;border-radius:4px;margin:.75rem 0 .6rem;overflow:hidden}.ctc-bar i{display:block;height:100%;background:linear-gradient(90deg,#f0a500,#0050c8)}
      .ctc-nav{display:flex;align-items:center;gap:.4rem}.ctc-nav .sp{flex:1;font-size:.72rem;color:#94a3b8}
      .ctc-nav button{font:inherit;font-size:.78rem;font-weight:700;padding:.4rem .75rem;border-radius:8px;cursor:pointer;border:1.5px solid #dbe3ee;background:#fff;color:#0a1628}
      .ctc-nav .nx{background:#003087;border-color:#003087;color:#fff}
    `;
    document.head.appendChild(s);
  }

  function ensureButton() {
    if (document.getElementById('ctTourBtn')) return;
    const right = document.querySelector('.ct-nav .nav-right');
    if (!right) return;
    const b = document.createElement('button');
    b.id = 'ctTourBtn'; b.type = 'button'; b.className = 'ct-tour-btn' + (store.get(SEEN_KEY, false) ? '' : ' new');
    b.title = 'Tutorial: PIE walks you through the portal';
    b.innerHTML = '🎓 Tutorial';
    b.addEventListener('click', openMenu);
    right.insertBefore(b, right.firstChild);
  }

  function ensureNodes() {
    if (!document.getElementById('ctTourMenu')) {
      const m = document.createElement('div'); m.id = 'ctTourMenu';
      m.addEventListener('click', e => { if (e.target === m) closeMenu(); });
      document.body.appendChild(m);
    }
    if (!document.getElementById('ctTourSpot')) { const s = document.createElement('div'); s.id = 'ctTourSpot'; document.body.appendChild(s); }
    if (!document.getElementById('ctTourCard')) { const c = document.createElement('div'); c.id = 'ctTourCard'; document.body.appendChild(c); }
  }

  const DEPT_NAMES = { hr: 'HR', finance: 'Finance', programming: 'Programming', data: 'Data & Evaluation', training: 'Training & Development', leadership: 'Leadership', kb: 'Knowledge Base' };

  function openMenu() {
    injectCSS(); ensureNodes();
    store.set(SEEN_KEY, true);
    const btn = document.getElementById('ctTourBtn'); if (btn) btn.classList.remove('new');
    const dept = curDept();
    const chs = chaptersFor(dept);
    const done = store.get(DONE_KEY, {});
    const active = (document.querySelector('.panel.active') || {}).id || '';
    const here = active.replace(/^panel-/, '');
    const hereLink = linkFor(here);
    const steps = chs.reduce((n, p) => n + stepsFor(p, dept).length + 1, 0);
    const m = document.getElementById('ctTourMenu');
    m.innerHTML = `<div class="ctm-box" role="dialog" aria-label="Portal tutorial">
      <div class="ctm-head"><span class="ctm-pie">${PIE_SVG}</span>
        <div><h3>Hi, I'm PIE. Let me show you around.</h3><p>Tours built for the ${DEPT_NAMES[dept] || dept} view: only the sections you see.</p></div>
        <button class="ctm-x" aria-label="Close">✕</button></div>
      <div class="ctm-body">
        <div class="ctm-cta">
          <button class="ctm-full" data-go="full">▶ Full tour<small>${chs.length} sections · about ${Math.max(2, Math.round(steps * 0.12))} minutes</small></button>
          ${CH[here] && hereLink ? `<button class="ctm-here" data-go="${here}">📍 Tour this page<small>${linkLabel(hereLink)}</small></button>` : ''}
        </div>
        <div class="ctm-label">Or pick a section</div>
        <div class="ctm-grid">${chs.map(p => {
          const a = linkFor(p);
          return `<button class="ctm-ch${done[dept + ':' + p] ? ' done' : ''}" data-go="${p}"><b>${linkLabel(a)}</b><span>${CH[p].why}</span></button>`;
        }).join('')}</div>
      </div></div>`;
    m.querySelector('.ctm-x').addEventListener('click', closeMenu);
    m.querySelectorAll('[data-go]').forEach(b => b.addEventListener('click', () => {
      const go = b.dataset.go; closeMenu();
      start(go === 'full' ? chs : [go]);
    }));
    m.classList.add('open');
  }
  function closeMenu() { const m = document.getElementById('ctTourMenu'); if (m) m.classList.remove('open'); }

  // ── Tour runtime ───────────────────────────────────────────────────────
  let Q = [], i = 0, running = false, dept = '';
  function build(chs) {
    const q = [];
    chs.forEach((p, ci) => {
      const a = linkFor(p); if (!a) return;
      const ch = { panel: p, label: linkLabel(a), group: groupOf(a), idx: ci + 1, total: chs.length };
      q.push({ ch, nav: true });
      stepsFor(p, dept).forEach(s => q.push({ ch, s }));
    });
    if (chs.length > 1) q.push({ ch: { panel: null, label: 'Finish', idx: chs.length, total: chs.length }, final: true });
    return q;
  }
  function start(chs) {
    injectCSS(); ensureNodes();
    dept = curDept();
    Q = build(chs); i = 0; running = true;
    document.addEventListener('keydown', onKey);
    window.addEventListener('resize', reposition);
    show();
  }
  function end() {
    running = false;
    document.removeEventListener('keydown', onKey);
    window.removeEventListener('resize', reposition);
    document.getElementById('ctTourSpot').style.display = 'none';
    document.getElementById('ctTourCard').style.display = 'none';
  }
  function onKey(e) {
    if (!running) return;
    if (e.key === 'Escape') end();
    else if (e.key === 'ArrowRight') next();
    else if (e.key === 'ArrowLeft') back();
  }
  function markDone(panel) {
    if (!panel) return;
    const d = store.get(DONE_KEY, {}); d[dept + ':' + panel] = true; store.set(DONE_KEY, d);
  }
  let _dir = 1;
  function next() {
    _dir = 1;
    const cur = Q[i];
    const nx = Q[i + 1];
    if (cur && (!nx || nx.ch.panel !== cur.ch.panel)) markDone(cur.ch.panel);
    if (i >= Q.length - 1) { end(); return; }
    i++; show();
  }
  function back() { _dir = -1; if (i > 0) { i--; show(); } }

  let _target = null;
  function show() {
    const item = Q[i]; if (!item) { end(); return; }
    let target = null, title, text, path = '';
    if (item.final) {
      target = document.getElementById('pieTrigger') || document.getElementById('ctTourBtn');
      title = 'You\'re all set';
      text = 'Ask PIE any question about your data, any time, from the gold button. Come back to 🎓 Tutorial whenever you want a refresher on any section.';
    } else if (item.nav) {
      const a = linkFor(item.ch.panel);
      target = a;
      title = item.ch.label;
      text = CH[item.ch.panel].why + ' Find it in the sidebar' + (item.ch.group ? ' under ' + item.ch.group : '') + '. I\'ll open it for you.';
      path = (item.ch.group ? '<b>' + item.ch.group + '</b> › ' : '') + '<b>' + item.ch.label + '</b>';
    } else {
      // Open the chapter's page exactly like a sidebar click (once per chapter)
      const activeId = (document.querySelector('.panel.active') || {}).id;
      if (activeId !== 'panel-' + item.ch.panel && typeof window.showPanel === 'function') {
        window.showPanel(item.ch.panel, linkFor(item.ch.panel));
      }
      title = item.s.title;
      text = txt(item.s.text, dept);
    }
    const render = () => {
      document.getElementById('ctTourCard').dataset.fallback = '';
      if (!item.final && !item.nav) {
        const primary = firstVisible(item.s.t);
        const firstOfPage = Q[i - 1] && Q[i - 1].nav;
        if (!primary && !firstOfPage) {
          // This control isn't on this person's screen (another department's
          // button, or nothing to show yet) — skip the step rather than
          // describe something they can't see.
          if (_dir < 0) { if (i > 0) { i--; show(); } else end(); }
          else if (i < Q.length - 1) { i++; show(); } else end();
          return;
        }
        target = primary || firstVisible(['#panel-' + item.ch.panel + ' .ph-title', '#panel-' + item.ch.panel + ' #njtcGuideBar', '#panel-' + item.ch.panel]);
        document.getElementById('ctTourCard').dataset.fallback = primary ? '' : '1'; // for QA
      }
      _target = target;
      paint(item, title, text, path);
    };
    // Give a freshly opened page a moment to render before measuring
    const needsWait = !item.final && !item.nav && Q[i - 1] && Q[i - 1].nav;
    setTimeout(render, needsWait ? 450 : 30);
  }

  function paint(item, title, text, path) {
    const spot = document.getElementById('ctTourSpot');
    const card = document.getElementById('ctTourCard');
    const pos = i + 1, total = Q.length;
    card.innerHTML = `
      <div class="ctc-top"><span class="ctc-pie">${PIE_SVG}</span><span class="ctc-ch">${item.final ? 'Tutorial complete' : item.ch.label + (item.ch.total > 1 ? ' · section ' + item.ch.idx + ' of ' + item.ch.total : '')}</span></div>
      <p class="ctc-title">${title}</p>
      <p class="ctc-text">${text}</p>
      ${path ? `<div class="ctc-path">Sidebar: ${path}</div>` : ''}
      <div class="ctc-bar"><i style="width:${Math.round(pos / total * 100)}%"></i></div>
      <div class="ctc-nav">
        <button class="bk"${i === 0 ? ' disabled style="opacity:.4"' : ''}>Back</button>
        <span class="sp">Esc to exit · ← → keys</span>
        <button class="ex">End</button>
        <button class="nx">${i === Q.length - 1 ? 'Done' : item.nav ? 'Open it →' : 'Next →'}</button>
      </div>`;
    card.querySelector('.bk').onclick = back;
    card.querySelector('.ex').onclick = end;
    card.querySelector('.nx').onclick = next;
    card.style.display = 'block';
    spot.style.display = 'block';
    if (_target) { try { _target.scrollIntoView({ block: 'center', behavior: 'smooth' }); } catch (e) {} }
    setTimeout(reposition, 320);
    setTimeout(reposition, 750); // again once smooth scrolling has settled
  }

  function reposition() {
    if (!running) return;
    const spot = document.getElementById('ctTourSpot');
    const card = document.getElementById('ctTourCard');
    const vw = document.documentElement.clientWidth, vh = window.innerHeight;
    if (!_target || !visible(_target)) {
      spot.style.left = (vw / 2) + 'px'; spot.style.top = (vh / 2) + 'px'; spot.style.width = '0px'; spot.style.height = '0px';
      card.style.left = Math.max(12, vw / 2 - 170) + 'px'; card.style.top = Math.max(12, vh / 2 - 120) + 'px';
      return;
    }
    const r = _target.getBoundingClientRect(), pad = 6;
    const top = Math.max(4, r.top - pad), left = Math.max(4, r.left - pad);
    const h = Math.min(r.height + pad * 2, vh - top - 4), w = Math.min(r.width + pad * 2, vw - left - 4);
    Object.assign(spot.style, { left: left + 'px', top: top + 'px', width: w + 'px', height: h + 'px' });
    const cw = card.offsetWidth || 340, chh = card.offsetHeight || 200;
    let cx, cy;
    if (r.right + 16 + cw < vw) { cx = r.right + 16; cy = Math.min(Math.max(12, r.top), vh - chh - 12); }       // right of target
    else if (r.bottom + 14 + chh < vh) { cx = Math.min(Math.max(12, r.left), vw - cw - 12); cy = r.bottom + 14; } // below
    else if (r.top - 14 - chh > 0) { cx = Math.min(Math.max(12, r.left), vw - cw - 12); cy = r.top - 14 - chh; } // above
    else { cx = vw - cw - 16; cy = vh - chh - 16; }                                                              // corner
    cx = Math.min(Math.max(12, cx), vw - cw - 12);
    cy = Math.min(Math.max(12, cy), vh - chh - 12);
    card.style.left = cx + 'px'; card.style.top = cy + 'px';
  }

  function init() {
    injectCSS();
    // The nav renders before login completes; wait for it, then add the button.
    let tries = 0;
    const t = setInterval(() => { ensureButton(); if (document.getElementById('ctTourBtn') || ++tries > 60) clearInterval(t); }, 250);
  }

  window.njtcPortalTour = { open: openMenu, start: (panels) => start(panels || chaptersFor(curDept())), chaptersFor: () => chaptersFor(curDept()), _CH: CH, _ORDER: ORDER };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
