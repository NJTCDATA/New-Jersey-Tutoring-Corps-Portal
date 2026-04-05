(function() {


  // ══════════════════════════════════════════════════════════
  //  NJTC_CACHE — shared stale-while-revalidate localStorage utility
  //  All modules use this for 30-min TTL data caching
  // ══════════════════════════════════════════════════════════
  const NJTC_CACHE = {
    TTL: 30 * 60 * 1000,  // 30 minutes
    get(key) {
      try {
        const raw = localStorage.getItem(key);
        if (!raw) return null;
        const obj = JSON.parse(raw);
        if (!obj || !obj.ts || !obj.d) return null;
        return { data: obj.d, age: Date.now() - obj.ts, fresh: (Date.now() - obj.ts) < this.TTL };
      } catch(e) { return null; }
    },
    set(key, data) {
      try { localStorage.setItem(key, JSON.stringify({ ts: Date.now(), d: data })); } catch(e) {}
    },
    bust(key) {
      try { localStorage.removeItem(key); } catch(e) {}
    },
    bustAll() {
      const keys = ['njtc_kpi_v2','njtc_sya_v1','njtc_talent_v1','njtc_pearl_v1','njtc_ops_v2','njtc_pearl_gids_v1','njtc_pearl_stu_agg_v2'];
      keys.forEach(k => this.bust(k));
    }
  };

  // ══════════════════════════════════════════════════════════
  //  DEPARTMENT CONFIGURATION
  // ══════════════════════════════════════════════════════════
  const DEPT_CONFIG = {
    hr: {
      label: 'Human Resources', emoji: '👔', color: '#e63946',
      tagline: 'Protecting our people and the organization.',
      goalPct: '78%',
      connections: ['programming','data','training','leadership'],
      quickLinks: [
        { icon: '📝', label: 'Support Log', bg: '#fff7e0', desc: 'Document a support conversation or context note', panel: 'concern' },
        { icon: '📊', label: 'KPI Targets', bg: '#e6efff', desc: 'Culture & retention goals', panel: 'kpi' },
        { icon: '📚', label: 'HR Policies', bg: '#f3e8ff', desc: 'Access all HR documentation', panel: 'policies' },
        { icon: '👥', label: 'Performance', bg: '#fff0e0', desc: 'Review concern submissions', panel: 'perf' },
      ]
    },
    finance: {
      label: 'Finance', emoji: '💰', color: '#2a9d8f',
      tagline: 'Maintaining fiscal health and accountability.',
      goalPct: '85%',
      connections: ['leadership','data','programming'],
      quickLinks: [
        { icon: '📊', label: 'KPI Targets', bg: '#e6efff', desc: 'Funding & financial goals', panel: 'kpi' },
        { icon: '📚', label: 'Finance Policies', bg: '#e6f5ed', desc: 'Budget & financial guidelines', panel: 'policies' },
        { icon: '☁️', label: 'Upload Reports', bg: '#f6f8fc', desc: 'Submit financial documents', panel: 'upload' },
        { icon: '📝', label: 'Support Log', bg: '#fff7e0', desc: 'Log a support conversation or context note', panel: 'concern' },
      ]
    },
    programming: {
      label: 'Programming', emoji: '🎯', color: '#457b9d',
      tagline: 'Delivering high-quality instructional programs.',
      goalPct: '71%',
      connections: ['hr','data','training','finance'],
      quickLinks: [
        { icon: '📝', label: 'Support Log', bg: '#fff7e0', desc: 'Log site-level support conversations', panel: 'concern' },
        { icon: '📊', label: 'KPI Targets', bg: '#e6efff', desc: 'Scholar impact goals', panel: 'kpi' },
        { icon: '📚', label: 'Site Policies', bg: '#e0f0ff', desc: 'Program procedures', panel: 'policies' },
        { icon: '☁️', label: 'Upload Docs', bg: '#f6f8fc', desc: 'Submit program materials', panel: 'upload' },
      ]
    },
    data: {
      label: 'Data & Evaluation', emoji: '📈', color: '#7b2d8b',
      tagline: 'Driving decisions through rigorous measurement.',
      goalPct: '90%',
      connections: ['programming','hr','leadership','training'],
      quickLinks: [
        { icon: '📊', label: 'Full KPI Dashboard', bg: '#f3e8ff', desc: 'All organizational targets', panel: 'kpi' },
        { icon: '🔍', label: 'KPI Analytics', bg: '#ede9fe', desc: 'Visual goal performance analytics', panel: 'kpi-analytics' },
        { icon: '☁️', label: 'Upload Reports', bg: '#f6f8fc', desc: 'Submit evaluation data', panel: 'upload' },
        { icon: '📚', label: 'Data Governance', bg: '#f3e8ff', desc: 'Data policies & frameworks', panel: 'policies' },
        { icon: '📝', label: 'Support Log', bg: '#fff7e0', desc: 'Log a support conversation or context note', panel: 'concern' },
      ]
    },
    training: {
      label: 'Training & Development', emoji: '🎓', color: '#e76f51',
      tagline: 'Building staff capacity and educator pipelines.',
      goalPct: '68%',
      connections: ['hr','programming','data'],
      quickLinks: [
        { icon: '📚', label: 'Training Materials', bg: '#fff0e0', desc: 'PD policies & procedures', panel: 'policies' },
        { icon: '📊', label: 'KPI Targets', bg: '#e6efff', desc: 'Pipeline & apprenticeship goals', panel: 'kpi' },
        { icon: '☁️', label: 'Upload PD Docs', bg: '#f6f8fc', desc: 'Submit training materials', panel: 'upload' },
        { icon: '📝', label: 'Support Log', bg: '#fff7e0', desc: 'Log training support conversations', panel: 'concern' },
      ]
    },
    leadership: {
      label: 'Leadership', emoji: '⭐', color: '#f0a500',
      tagline: 'Organizational oversight and strategic direction.',
      goalPct: '82%',
      connections: ['hr','finance','data','programming','training'],
      quickLinks: [
        { icon: '📊', label: 'KPI Targets', bg: '#fff7e0', desc: 'Full organizational overview', panel: 'kpi' },
        { icon: '🔍', label: 'KPI Analytics', bg: '#fef3c7', desc: 'Goal health & performance breakdown', panel: 'kpi-analytics' },
        { icon: '📚', label: 'All Policies', bg: '#f6f8fc', desc: 'Organization-wide library', panel: 'policies' },
        { icon: '📝', label: 'Support Log', bg: '#fff7e0', desc: 'All support context submissions', panel: 'concern' },
        { icon: '☁️', label: 'Drive Center', bg: '#f6f8fc', desc: 'Document management', panel: 'upload' },
      ]
    },
    kb: {
      label: 'Executive Overview', emoji: '🌟', color: '#5b8dee',
      tagline: 'Program momentum and organizational stewardship.',
      goalPct: '82%',
      connections: ['hr','data','programming','training'],
      quickLinks: [
        { icon: '📊', label: 'Program Overview', bg: '#eef4ff', desc: 'Scholar engagement and program health', panel: 'kpi' },
        { icon: '🌱', label: 'Growth Insights', bg: '#e8f5e9', desc: 'Trends and momentum indicators', panel: 'kpi-analytics' },
        { icon: '📚', label: 'Policy Library', bg: '#f6f8fc', desc: 'Organization-wide documentation', panel: 'policies' },
        { icon: '☁️', label: 'Drive Center', bg: '#f6f8fc', desc: 'Document management', panel: 'upload' },
      ]
    }
  };

  // Dept connection details — HOW and WHY departments connect
  const DEPT_CONNECTIONS = {
    hr: [
      { with: 'programming', how: 'Performance pipeline support', why: 'HR processes concern submissions from Program Managers and coordinates corrective actions, directly impacting tutor retention and site consistency.', goals: ['Culture','Educator Pipeline'] },
      { with: 'data', how: 'Staff retention analytics', why: 'Data & Evaluation provides HR with retention trend analysis, helping identify patterns before they escalate to formal concerns.', goals: ['Culture','Systems & Infrastructure'] },
      { with: 'training', how: 'PGP design & PD alignment', why: 'When an employee enters a Performance Growth Plan, HR coordinates with T&D to ensure targeted professional development is available.', goals: ['Culture','Educator Pipeline'] },
      { with: 'leadership', how: 'Strategic workforce decisions', why: 'Leadership depends on HR for termination reviews, succession planning, and workforce composition data to make board-level decisions.', goals: ['Culture','Board Development'] },
    ],
    finance: [
      { with: 'leadership', how: 'Budget authorization & reporting', why: 'Finance provides monthly budget-to-actual reports to Leadership, which informs strategic deployment decisions and board presentations.', goals: ['Financial Health','Funding'] },
      { with: 'data', how: 'Cost-per-scholar analysis', why: 'D&E and Finance collaborate to calculate cost-per-scholar metrics used in philanthropic pitches and fee-for-service contract negotiations.', goals: ['Fee-for-Service Growth','Funding'] },
      { with: 'programming', how: 'Site staffing cost modeling', why: 'Finance models staffing costs for new sites before contract signing, ensuring financial viability of each programming deployment.', goals: ['Fee-for-Service Growth','Financial Health'] },
    ],
    programming: [
      { with: 'hr', how: 'Staff performance & site compliance', why: 'Program Managers are the primary source of performance concern submissions. Their documentation drives HR corrective action process.', goals: ['Culture','Educator Pipeline'] },
      { with: 'data', how: 'Scholar outcome measurement', why: 'D&E designs assessments and collects outcome data from sites, which Programming uses to adjust instructional models mid-year.', goals: ['Increase Impact on Scholars','Partner Experience'] },
      { with: 'training', how: 'Tutor skill development', why: 'When PM observations identify skill gaps, T&D receives that feedback to design targeted professional development sessions.', goals: ['Educator Pipeline','Increase Impact on Scholars'] },
      { with: 'finance', how: 'Contract & site viability', why: 'Finance and Programming co-review site contracts to ensure pricing aligns with staffing and operational requirements.', goals: ['Fee-for-Service Growth'] },
    ],
    data: [
      { with: 'programming', how: 'Real-time outcome feedback loops', why: 'D&E provides mid-year placement data to Programming, enabling instructional pivots before the end-of-year assessment window closes.', goals: ['Increase Impact on Scholars','Systems & Infrastructure'] },
      { with: 'hr', how: 'Workforce analytics & trend reporting', why: 'D&E tracks staff retention rates, turnover patterns, and engagement signals that HR uses for proactive workforce planning.', goals: ['Culture','Systems & Infrastructure'] },
      { with: 'leadership', how: 'Board KPI dashboards', why: 'D&E builds and maintains the organizational KPI infrastructure that Leadership presents to the board and uses for strategic decisions.', goals: ['Systems & Infrastructure','Board Development'] },
      { with: 'training', how: 'Instructional quality measurement', why: 'D&E observation data informs T&D about which instructional competencies require the most PD investment across the tutor workforce.', goals: ['Educator Pipeline','Increase Impact on Scholars'] },
    ],
    training: [
      { with: 'hr', how: 'Performance recovery programs', why: 'T&D designs and facilitates PGP learning plans that HR assigns to employees in corrective action, creating a bridge from discipline to growth.', goals: ['Culture','Educator Pipeline'] },
      { with: 'programming', how: 'Skill-gap response & PD design', why: 'PM observation reports feed directly into T&D curriculum planning — site-specific skill gaps become targeted PD sessions within the quarter.', goals: ['Educator Pipeline','Increase Impact on Scholars'] },
      { with: 'data', how: 'Training effectiveness measurement', why: 'D&E measures PD impact by correlating training completion with scholar outcome changes, giving T&D evidence to improve program design.', goals: ['Educator Pipeline','Systems & Infrastructure'] },
    ],
    leadership: [
      { with: 'hr', how: 'Workforce & culture oversight', why: 'Leadership reviews aggregate HR metrics — retention, open concerns, PGP active count — to gauge organizational health at board meetings.', goals: ['Culture','Board Development'] },
      { with: 'finance', how: 'Strategic financial stewardship', why: 'Monthly finance reviews with Leadership ensure reserve targets, budget variances, and funder commitments stay aligned with strategic goals.', goals: ['Financial Health','Funding','Fee-for-Service Growth'] },
      { with: 'data', how: 'Impact evidence for stakeholders', why: 'D&E provides Leadership with the impact evidence used in funder pitches, board presentations, and public communications.', goals: ['Funding','Brand Growth','Board Development'] },
      { with: 'programming', how: 'Site growth & partner strategy', why: 'Leadership sets site expansion targets; Programming validates operational feasibility and quality standards before new contracts are signed.', goals: ['Fee-for-Service Growth','Partner Experience'] },
      { with: 'training', how: 'Pipeline investment strategy', why: 'Leadership directs investment in the educator apprenticeship program based on T&D pipeline data and labor market positioning.', goals: ['Educator Pipeline'] },
    ],
  };

  const DEPT_COLORS = {
    hr: '#e63946', finance: '#2a9d8f', programming: '#457b9d',
    data: '#7b2d8b', training: '#e76f51', leadership: '#f0a500', __drive__: '#0969da'
  };
  const DEPT_ICONS = {
    hr: '👔', finance: '💰', programming: '🎯',
    data: '📈', training: '🎓', leadership: '⭐', __drive__: '☁️'
  };
  const DEPT_LABELS = {
    hr: 'HR', finance: 'Finance', programming: 'Programming',
    data: 'Data & Eval', training: 'Training', leadership: 'Leadership', __drive__: 'Google Drive Additions'
  };

  // ══════════════════════════════════════════════════════════
  //  KPI DATA
  // ══════════════════════════════════════════════════════════
  // ── Live Google Sheet CSV URL (auto-refreshes from published sheet) ──
  const SHEET_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSiWNF9u43aDBr7MOuyiPHd1umWZSvPcQZir6r_6Qnd8lh9Ku1uveMoMIsto3VmrwKJUyHOu14tfiHd/pub?output=csv';
  var KPI_META_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSiWNF9u43aDBr7MOuyiPHd1umWZSvPcQZir6r_6Qnd8lh9Ku1uveMoMIsto3VmrwKJUyHOu14tfiHd/pub?output=csv&gid=1313501732';
  var KPI_META_CACHE_KEY = 'njtc_kpi_meta_v1';
  var KPI_META_TTL = 24 * 60 * 60 * 1000;

  // Fallback static data (exact from official KPI spreadsheet, SY 2025-26)
  const KPI_DATA_STATIC = [
    { goal: "Increase Impact on Scholars", target: "By 2026, serve 2000 scholars annually", midStatus: "Partially Met", endStatus: "" },
    { goal: "Increase Impact on Scholars", target: "By 2026 serve 35 sites annually", midStatus: "Met", endStatus: "" },
    { goal: "Increase Impact on Scholars", target: "Placement Level Change: 80% of all scholars advancing a level in math or ela", midStatus: "In Progress", endStatus: "" },
    { goal: "Increase Impact on Scholars", target: "Progress Towards Proficiency: Math 20% increase of scholars that reach grade-level proficiency; ELA 20% increase of scholars that reach grade-level below", midStatus: "In Progress", endStatus: "" },
    { goal: "Increase Impact on Scholars", target: "Gap Closing: 35% decrease in scholar 2+ grade levels below", midStatus: "In Progress", endStatus: "" },
    { goal: "Increase Impact on Scholars", target: "80% scholars self-report that they increased confidence post session in ELA", midStatus: "In Progress", endStatus: "" },
    { goal: "Increase Impact on Scholars", target: "80% scholars self-report that they increased confidence post-session in Math", midStatus: "In Progress", endStatus: "" },
    { goal: "Increase Impact on Scholars", target: "92% of onsite staff observe scholar growth", midStatus: "In Progress", endStatus: "" },
    { goal: "Support Growth of New Jersey's Educator Pipeline", target: "40 tutor apprentices for SY 25-26", midStatus: "In Progress", endStatus: "" },
    { goal: "Support Growth of New Jersey's Educator Pipeline", target: "Secure 1 DOL grant to expand apprenticeship program", midStatus: "Met", endStatus: "" },
    { goal: "Support Growth of New Jersey's Educator Pipeline", target: "4 NJTC apprentices join Teacher Apprenticeship Network (TAN) in 2026", midStatus: "Coming Down the Pipeline", endStatus: "" },
    { goal: "Increase the number of fee-for-service partnerships", target: "35 SY sites - all of which are fee-for-service sites (does not include low-cost pilot)", midStatus: "Met", endStatus: "" },
    { goal: "Increase the number of fee-for-service partnerships", target: "Secure 3 new low-cost pilot customers using new grant funds", midStatus: "In Progress", endStatus: "" },
    { goal: "Increase the number of fee-for-service partnerships", target: "75% of sites cover full fee-for-service (does not include low-cost pilot)", midStatus: "Met", endStatus: "" },
    { goal: "Increase the number of fee-for-service partnerships", target: "Add 1 additional out-of-state customer", midStatus: "Met", endStatus: "" },
    { goal: "Increase the number of fee-for-service partnerships", target: "Apply to a least 10 local/regional RFPs annually", midStatus: "Partially Met", endStatus: "" },
    { goal: "Continue to pursue large and multi-year sources of funding", target: "Identify and apply to 2 new multi-year or $500K+ funding opportunities", midStatus: "Met", endStatus: "" },
    { goal: "Continue to pursue large and multi-year sources of funding", target: "Secure $850,000 in philanthropic funds", midStatus: "Met", endStatus: "" },
    { goal: "Continue to pursue large and multi-year sources of funding", target: "Secure new philanthropic partners totaling $200k", midStatus: "Has Not Met", endStatus: "" },
    { goal: "Continue to pursue large and multi-year sources of funding", target: "Secure support from FY 27 State budget", midStatus: "Coming Down the Pipeline", endStatus: "" },
    { goal: "Maintain cash position", target: "Maintain $500K in Moneymarket portion of investment accounts by the end of 2025", midStatus: "Met", endStatus: "" },
    { goal: "Further Diversify board and leverage its support", target: "Increase the number of introductions by board members to school district partners & potential donors (At least 1 intro per board member; total of 15)", midStatus: "In Progress", endStatus: "" },
    { goal: "Further Diversify board and leverage its support", target: "Maintain 100% board giving; Increase total board giving by 10%", midStatus: "Met", endStatus: "" },
    { goal: "Upgrade systems to support growth", target: "Revised performance evaluation system in place by November 2025", midStatus: "Met", endStatus: "" },
    { goal: "Upgrade systems to support growth", target: "KPI Dashboard is 100% operational by October 2025", midStatus: "Met", endStatus: "" },
    { goal: "Upgrade systems to support growth", target: "2025-2026 Program Evaluation completed by August of 2026", midStatus: "Coming Down the Pipeline", endStatus: "" },
    { goal: "Upgrade systems to support growth", target: "NJTC Annual Report sent to Stakeholders by December 2025", midStatus: "Partially Met", endStatus: "" },
    { goal: "Upgrade systems to support growth", target: "Data Governance is documented for all internal reporting by December of 2025", midStatus: "Met", endStatus: "" },
    { goal: "Upgrade systems to support growth", target: "Annual Budgeting process completed by August 1, 2026", midStatus: "Coming Down the Pipeline", endStatus: "" },
    { goal: "Upgrade systems to support growth", target: "Leadership completes a Mid-Year and End of year retreat", midStatus: "Coming Down the Pipeline", endStatus: "" },
    { goal: "Maintain consistent partner experience", target: "90% customer satisfaction reported at the end of the school year 25/26", midStatus: "In Progress", endStatus: "" },
    { goal: "Maintain consistent partner experience", target: "Receive 3 referrals from partners", midStatus: "Met", endStatus: "" },
    { goal: "Maintain consistent partner experience", target: "50% retention rate for school partners", midStatus: "Coming Down the Pipeline", endStatus: "" },
    { goal: "Maintain and continue to build on strong culture", target: "80% annual core staff retention", midStatus: "Met", endStatus: "" },
    { goal: "Maintain and continue to build on strong culture", target: "60% annual on-site staff retention", midStatus: "Has Not Met", endStatus: "" },
    { goal: "Maintain and continue to build on strong culture", target: "Increase diversity of tutors to mirror student diversity", midStatus: "Met", endStatus: "" },
    { goal: "Maintain and continue to build on strong culture", target: "Host 2 in person events for central team (Winter and Summer)", midStatus: "Partially Met", endStatus: "" },
    { goal: "Grow the NJTC brand", target: "10 local media hits per year", midStatus: "Met", endStatus: "" },
    { goal: "Grow the NJTC brand", target: "Attend 5 local education and/or non-profit conferences and webinars - these could include having a booth at a local conference; speaking engagements at 2", midStatus: "Met", endStatus: "" },
    { goal: "Grow the NJTC brand", target: "Participate in 3 national conferences or webinars with presentations at 2", midStatus: "Met", endStatus: "" },
    { goal: "Grow the NJTC brand", target: "Increase followers by 20% on social media platforms (in the aggregate)", midStatus: "Coming Down the Pipeline", endStatus: "" },
    { goal: "Grow the NJTC brand", target: "Meet with at least 7 education organizations across New Jersey", midStatus: "In Progress", endStatus: "" },
    { goal: "Grow the NJTC brand", target: "Attend 5 South Jersey Chamber events", midStatus: "Partially Met", endStatus: "" },
  ];

  // Live data holder — populated from Sheet or falls back to static
  let KPI_DATA = KPI_DATA_STATIC.map(k => ({ ...k, status: k.midStatus || 'In Progress' }));
  let _kpiLastFetched = null;
  let _kpiFromSheet = false;

  // ══════════════════════════════════════════════════════════
  //  POLICIES DATA (inline — Drive manifest overrides this)
  // ══════════════════════════════════════════════════════════
  const DRIVE_MANIFEST_ID = '1e6fXGG0BNCdVO2SJxi4I8JgbDiXNrAcL';
  // ── Paste your deployed Apps Script Web App URL below after setup ──
  // Once set, Drive documents appear automatically when uploaded — no GitHub updates needed.
  // Format: 'https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec'
  const DRIVE_APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwA9HIQmEdxpANA2WENEwvRSV6jQ1CUDRHdpLwVXK4-H1NcaJ8dpSsP5nC3WfS5MiL6/exec';

  // ── Operations Manual Drive File ID ─────────────────────────────
  // Paste the Google Drive File ID of your Operations Manual below.
  // Get it from the share URL: drive.google.com/file/d/FILE_ID_HERE/view
  // Once set, every policy card will link directly to the correct section.
  const OPS_MANUAL_FILE_ID = 'PASTE_YOUR_OPERATIONS_MANUAL_FILE_ID_HERE';
  const OPS_MANUAL_URL = OPS_MANUAL_FILE_ID.startsWith('PASTE')
    ? 'https://drive.google.com/drive/folders/1AflTMfemn1NuRK95PnBJk5a1b6QTPeiG'
    : `https://drive.google.com/file/d/${OPS_MANUAL_FILE_ID}/view`;

  // ── Live Google Doc URL (published, auto-updates every 5 min) ─────
  const OPS_MANUAL_PUB_URL = 'https://docs.google.com/document/d/e/2PACX-1vRgaFYbkwq41rzOeLBw-T1RLB8UP5b0Dof81X5Vfdv__ABMDEtEk0JGctXXTbNVmYEGvsTbxb4BCZHM/pub';

  // ── Parsed doc cache ─────────────────────────────────────────────
  let _docCache = null;        // { fetchedAt, sections: [{id, heading, level, html, keyPoints}] }
  let _docFetchPromise = null; // deduplicate concurrent fetches

  // ── Map policy cards to doc sections ────────────────────────────
  // keys = policy titles from POLICIES_INLINE, values = section heading keywords
  const POLICY_SECTION_MAP = {
    "Employee Handbook":                  ["HR", "Recruitment", "Hiring", "Performance Management", "Benefits", "Termination"],
    "Performance Evaluation System":      ["Performance Management", "Central Team Grievance", "Sexual Harassment"],
    "HR Concern & Documentation Protocol":["Performance Concern Reporting", "Performance Management", "Removal", "Termination"],
    "Budget & Financial Controls":        ["Finances", "Expenditure", "Reimbursement", "Cash Flow"],
    "Grant Reporting Requirements":       ["Invoicing", "District Procurement", "Quotes", "Late payments"],
    "Program Concern Escalation Protocol":["Performance Concern Reporting", "Communication Chain"],
    "Site Operations Handbook":           ["Programming", "On Site Staff", "Required Training", "Loaner Devices", "Materials"],
    "Data Governance Framework":          ["Data & Reporting", "Data Governance", "Pearl Rostering"],
    "Assessment & Progress Monitoring Guide":["Pearl Reporting", "iReady", "Performance Presentations"],
    "Training & PD Calendar SY25-26":     ["Required Training", "Training", "ADP Learning"],
    "Apprenticeship Program Guide":       ["Recruitment", "Hiring", "Onsite Employee"],
    "NJTC Organizational Chart SY25-26":  ["GENERAL Business Operations", "Partnerships", "Communication"],
    "Communications & Brand Standards":   ["Glassdoor", "LinkedIn", "Facebook", "Job Fairs", "Messaging"],
  };

  // ── Fetch and parse the published Google Doc ─────────────────────
  async function fetchOpsManual(forceRefresh) {
    // Return cache if fresh (< 5 min)
    if (!forceRefresh && _docCache && (Date.now() - _docCache.fetchedAt) < 5 * 60 * 1000) {
      return _docCache;
    }
    // Deduplicate concurrent fetches
    if (_docFetchPromise && !forceRefresh) return _docFetchPromise;

    // ── Check localStorage cache before fetching ───────────────────
    const _oc = NJTC_CACHE.get('njtc_ops_v2');
    if (_oc && _oc.data && !forceRefresh) {
      _docCache = _oc.data;
      _docFetchPromise = null;
      if (_oc.fresh) return _docCache;  // fresh: no network needed
      // stale: fall through to background re-fetch (return cache immediately too)
    }

    _docFetchPromise = (async () => {
      try {
        const resp = await fetch(OPS_MANUAL_PUB_URL + '?cachebust=' + Math.floor(Date.now() / 60000), {
          signal: AbortSignal.timeout(5000)
        });
        if (!resp.ok) throw new Error('fetch failed');
        const html = await resp.text();
        const sections = parseDocHTML(html);
        _docCache = { fetchedAt: Date.now(), sections, raw: html };
        NJTC_CACHE.set('njtc_ops_v2', _docCache);
        _docFetchPromise = null;
        return _docCache;
      } catch(e) {
        _docFetchPromise = null;
        return null;
      }
    })();
    return _docFetchPromise;
  }

  // ── Parse published Google Doc HTML into sections ─────────────────
  // Google Docs /pub HTML wraps content in <div id="contents"> nested
  // inside body — direct body.childNodes misses all headings. We use
  // a TreeWalker to traverse every element in DOM order regardless of
  // nesting depth, then group by heading level into sections.
  function parseDocHTML(rawHTML) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(rawHTML, 'text/html');
    // Remove nav/header/footer noise
    doc.querySelectorAll('header,footer,nav,.kix-appview-editor,.docs-title-input').forEach(el => el.remove());

    // Find the best content root — Google Docs uses #contents; fall back to body
    const body = doc.querySelector('#contents') || doc.querySelector('.doc-content') || doc.querySelector('body');
    if (!body) return [];

    const sections = [];
    let currentSection = null;
    let sectionBuffer = [];

    const flushSection = () => {
      if (currentSection) {
        // Build HTML from buffer
        const wrapper = doc.createElement('div');
        sectionBuffer.forEach(el => wrapper.appendChild(el.cloneNode(true)));
        // Clean up Google Docs cruft
        const html = cleanDocHTML(wrapper.innerHTML);
        const keyPoints = extractKeyPoints(wrapper);
        sections.push({ ...currentSection, html, keyPoints });
      }
      sectionBuffer = [];
    };

    // Walk every element in DOM order — handles Google's nested div structure
    const HEADING_TAGS = new Set(['H1','H2','H3','H4']);
    const CONTENT_TAGS = new Set(['P','UL','OL','TABLE','BLOCKQUOTE','PRE','DL']);
    const walker = doc.createTreeWalker(body, NodeFilter.SHOW_ELEMENT, null);
    let node;
    while ((node = walker.nextNode())) {
      const tag = node.tagName;
      const text = node.textContent.trim();
      if (!text) continue;

      if (HEADING_TAGS.has(tag)) {
        flushSection();
        const level = parseInt(tag[1], 10);
        currentSection = { id: slugify(text), heading: text, level };
      } else if (CONTENT_TAGS.has(tag)) {
        // Skip if this element is a descendant of an already-buffered element
        const alreadyBuffered = sectionBuffer.some(b => b.contains && b.contains(node));
        if (alreadyBuffered) continue;
        if (!currentSection) {
          currentSection = { id: 'overview', heading: 'Overview', level: 1 };
        }
        sectionBuffer.push(node);
      }
    }
    flushSection();
    return sections;
  }

  function cleanDocHTML(html) {
    // Remove Google Docs inline styles, IDs, anchors that clutter
    return html
      .replace(/style="[^"]*"/g, '')
      .replace(/class="[^"]*"/g, '')
      .replace(/id="[^"]*"/g, '')
      .replace(/<span>/g, '')
      .replace(/<\/span>/g, '')
      .replace(/<a [^>]*href="https?:\/\/www\.google\.com\/url\?q=([^&"]+)[^"]*"[^>]*>/g, (m, url) => `<a href="${decodeURIComponent(url)}" target="_blank" rel="noopener">`)
      .replace(/\s+/g, ' ')
      .trim();
  }

  function extractKeyPoints(wrapper) {
    const points = [];
    // Extract numbered list items as key points
    const listItems = wrapper.querySelectorAll('li');
    listItems.forEach((li, i) => {
      if (i < 5 && li.textContent.trim().length > 20) {
        points.push(li.textContent.trim().substring(0, 150));
      }
    });
    // If no list items, grab first sentences from paragraphs
    if (points.length === 0) {
      const paras = wrapper.querySelectorAll('p');
      paras.forEach((p, i) => {
        if (i < 3 && p.textContent.trim().length > 30) {
          const text = p.textContent.trim().substring(0, 180);
          if (text) points.push(text);
        }
      });
    }
    return points.slice(0, 5);
  }

  function slugify(text) {
    return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').substring(0, 40);
  }

  // ── Get sections relevant to a policy card ─────────────────────
  function getSectionsForPolicy(policyTitle) {
    const keywords = POLICY_SECTION_MAP[policyTitle] || [policyTitle];
    if (!_docCache) return [];
    return _docCache.sections.filter(sec =>
      keywords.some(kw => sec.heading.toLowerCase().includes(kw.toLowerCase()))
    );
  }

  // ── Open policy detail modal ──────────────────────────────────────
  async function openPolicyModal(policyTitle, dept, tag, effectiveDate, modifiedDate, driveUrl) {
    const modal = document.getElementById('policyDetailModal');
    const titleEl = document.getElementById('policyModalTitle');
    const deptEl = document.getElementById('policyModalDept');
    const metaEl = document.getElementById('policyModalMeta');
    const bodyEl = document.getElementById('policyModalBody');
    const tabsEl = document.getElementById('policyModalTabs');
    const syncDot = document.getElementById('policyModalSyncDot');
    const syncText = document.getElementById('policyModalSyncText');
    const openBtn = document.getElementById('policyModalOpenBtn');
    const footer = document.getElementById('policyModalFooter');

    // Set header
    titleEl.textContent = policyTitle;
    deptEl.textContent = tag || dept;
    metaEl.innerHTML = `Effective: <strong>${effectiveDate || 'N/A'}</strong>${modifiedDate ? ` &nbsp;·&nbsp; Updated: <strong>${modifiedDate}</strong>` : ''} &nbsp;·&nbsp; <span class="live-badge">LIVE</span>`;
    openBtn.href = driveUrl || OPS_MANUAL_URL;
    tabsEl.innerHTML = '';
    footer.style.display = 'none';

    // Show loading
    bodyEl.innerHTML = '<div class="policy-loading-state"><div class="policy-loading-spinner"></div><div>Fetching latest content from Operations Manual…</div></div>';
    syncDot.className = 'sync-dot loading';
    syncText.textContent = 'Loading live content from Operations Manual…';

    // Open modal
    modal.classList.add('open');
    document.body.style.overflow = 'hidden';

    // Fetch doc
    const cache = await fetchOpsManual(false);

    if (!cache) {
      syncDot.className = 'sync-dot error';
      syncText.textContent = 'Could not load live content — check network or doc permissions.';
      bodyEl.innerHTML = `<div style="text-align:center;padding:2.5rem;color:var(--muted)">
        <div style="font-size:2rem;margin-bottom:.75rem">📄</div>
        <div style="font-weight:700;color:var(--navy);margin-bottom:.5rem">Content Unavailable</div>
        <div style="margin-bottom:1.25rem;font-size:.9rem">The Operations Manual could not be loaded right now.</div>
        <a href="${driveUrl || OPS_MANUAL_URL}" target="_blank" rel="noopener" class="btn btn-gold" style="text-decoration:none">Open in Google Drive ↗</a>
      </div>`;
      return;
    }

    // Get relevant sections
    const sections = getSectionsForPolicy(policyTitle);
    const lastFetched = new Date(cache.fetchedAt);

    syncDot.className = 'sync-dot';
    syncText.innerHTML = `<strong>Live from Operations Manual</strong> · ${_docCache.sections.length} sections loaded · Last synced ${lastFetched.toLocaleTimeString()}`;

    if (sections.length === 0) {
      // Show full overview with search hint
      bodyEl.innerHTML = `<div class="policy-section-content">
        <div class="psc-title">📋 ${policyTitle}</div>
        <div class="psc-body">
          <p>This policy is documented in the NJTC Operations Manual. Use the button above to open the full document in Google Docs where you can search for specific sections.</p>
          <div style="margin-top:1.5rem;padding:1rem 1.25rem;background:var(--surface);border-radius:10px;border:1px solid var(--border)">
            <div style="font-weight:700;color:var(--navy);margin-bottom:.5rem">📖 Operations Manual Sections Available:</div>
            ${_docCache.sections.slice(0,8).map(s => `<div style="padding:.3rem 0;font-size:.875rem;color:var(--text)">· ${s.heading}</div>`).join('')}
            ${_docCache.sections.length > 8 ? `<div style="font-size:.8125rem;color:var(--muted);margin-top:.375rem">+${_docCache.sections.length - 8} more sections</div>` : ''}
          </div>
        </div>
      </div>`;
      return;
    }

    // Build section tabs
    tabsEl.innerHTML = sections.map((sec, i) =>
      `<button class="pst-tab ${i===0?'active':''}" onclick="showPolicySection(${i})" data-sec="${i}">${sec.heading}</button>`
    ).join('');

    // Store sections for tab switching
    modal._sections = sections;

    // Show first section
    renderPolicySection(0, bodyEl, footer, sections);
  }

  function showPolicySection(idx) {
    const modal = document.getElementById('policyDetailModal');
    const bodyEl = document.getElementById('policyModalBody');
    const footer = document.getElementById('policyModalFooter');
    // Update tabs
    document.querySelectorAll('.pst-tab').forEach((t, i) => t.classList.toggle('active', i === idx));
    renderPolicySection(idx, bodyEl, footer, modal._sections);
  }

  function renderPolicySection(idx, bodyEl, footer, sections) {
    const sec = sections[idx];
    if (!sec) return;

    const levelIcon = sec.level === 1 ? '📂' : sec.level === 2 ? '📋' : '📌';

    bodyEl.innerHTML = `<div class="policy-section-content">
      <div class="psc-title">${levelIcon} ${sec.heading}</div>
      <div class="psc-body">${sec.html || '<p><em>No content available for this section.</em></p>'}</div>
    </div>`;

    // Key points footer
    if (sec.keyPoints && sec.keyPoints.length > 0) {
      footer.style.display = 'block';
      const highlights = document.getElementById('policyModalHighlights');
      highlights.innerHTML = sec.keyPoints.map(pt =>
        `<div class="key-highlight-card">
          <div class="khc-icon">✦</div>
          <div class="khc-text">${pt}</div>
        </div>`
      ).join('');
    } else {
      footer.style.display = 'none';
    }

    bodyEl.scrollTop = 0;
  }

  function closePolicyModal() {
    document.getElementById('policyDetailModal').classList.remove('open');
    document.body.style.overflow = '';
  }

  let POLICIES_REGISTRY = []; // populated by renderPolicies
  // Inline policies — all sourced from the NJTC Operations Manual
  // Add fileId to each entry once you have individual document IDs in Drive
  const POLICIES_INLINE = [
    // HR
    { title: "Employee Handbook", dept: "hr", tag: "Human Resources", effectiveDate: "Aug 2025", modifiedDate: "Jan 2026", sectionsModified: ["Section 4 - Leave Policy", "Section 7 - Remote Work"], desc: "Full NJTC employee handbook covering policies, procedures, expectations, and code of conduct for all staff.", driveUrl: OPS_MANUAL_URL, annualGoals: ["Maintain and continue to build on strong culture"] },
    { title: "Performance Evaluation System", dept: "hr", tag: "Human Resources", effectiveDate: "Nov 2025", modifiedDate: null, sectionsModified: [], desc: "Revised performance evaluation rubrics, observation forms, and process documentation for all staff roles.", driveUrl: OPS_MANUAL_URL, annualGoals: ["Maintain and continue to build on strong culture", "Support Growth of New Jersey's Educator Pipeline"] },
    { title: "HR Concern & Documentation Protocol", dept: "hr", tag: "Human Resources", effectiveDate: "Sep 2025", modifiedDate: null, sectionsModified: [], desc: "Step-by-step guidance for documenting performance concerns, progressive discipline, and PGP administration.", driveUrl: OPS_MANUAL_URL, annualGoals: ["Maintain and continue to build on strong culture"] },
    // Finance
    { title: "Budget & Financial Controls", dept: "finance", tag: "Finance", effectiveDate: "Aug 2025", modifiedDate: null, sectionsModified: [], desc: "Budget procedures, reimbursement policy, financial accountability guidelines, and approval workflows.", driveUrl: OPS_MANUAL_URL, annualGoals: ["Maintain cash position", "Continue to pursue large and multi-year sources of funding"] },
    { title: "Grant Reporting Requirements", dept: "finance", tag: "Finance", effectiveDate: "Oct 2025", modifiedDate: null, sectionsModified: [], desc: "Compliance requirements and timelines for all active grants including DOL, philanthropic, and fee-for-service.", driveUrl: OPS_MANUAL_URL, annualGoals: ["Continue to pursue large and multi-year sources of funding", "Increase the number of fee-for-service partnerships"] },
    // Programming
    { title: "Program Concern Escalation Protocol", dept: "programming", tag: "Programming", effectiveDate: "Sep 2025", modifiedDate: "Dec 2025", sectionsModified: ["Section 2 - Escalation Triggers"], desc: "Step-by-step guide for when and how to escalate site-level program concerns through the correct channels.", driveUrl: OPS_MANUAL_URL, annualGoals: ["Maintain consistent partner experience", "Increase Impact on Scholars"] },
    { title: "Site Operations Handbook", dept: "programming", tag: "Programming", effectiveDate: "Aug 2025", modifiedDate: null, sectionsModified: [], desc: "Onsite operational standards, session delivery protocols, and tutor supervisory guidelines for all sites.", driveUrl: OPS_MANUAL_URL, annualGoals: ["Increase Impact on Scholars"] },
    // Data & Evaluation
    { title: "Data Governance Framework", dept: "data", tag: "Data & Evaluation", effectiveDate: "Dec 2025", modifiedDate: null, sectionsModified: [], desc: "Internal reporting standards, data ownership definitions, access controls, and governance workflows for all data assets.", driveUrl: OPS_MANUAL_URL, annualGoals: ["Upgrade systems to support growth"] },
    { title: "Assessment & Progress Monitoring Guide", dept: "data", tag: "Data & Evaluation", effectiveDate: "Sep 2025", modifiedDate: null, sectionsModified: [], desc: "Protocols for benchmark assessment administration, score entry, and progress monitoring dashboard usage.", driveUrl: OPS_MANUAL_URL, annualGoals: ["Increase Impact on Scholars", "Upgrade systems to support growth"] },
    // Training & Development
    { title: "Training & PD Calendar SY25-26", dept: "training", tag: "Training & Development", effectiveDate: "Sep 2025", modifiedDate: "Jan 2026", sectionsModified: ["Q3 Schedule Updates"], desc: "Required professional development schedule, compliance tracking, and optional enrichment opportunities for all staff.", driveUrl: OPS_MANUAL_URL, annualGoals: ["Support Growth of New Jersey's Educator Pipeline"] },
    { title: "Apprenticeship Program Guide", dept: "training", tag: "Training & Development", effectiveDate: "Oct 2025", modifiedDate: null, sectionsModified: [], desc: "DOL-registered apprenticeship program structure, participant requirements, and TAN integration pathway.", driveUrl: OPS_MANUAL_URL, annualGoals: ["Support Growth of New Jersey's Educator Pipeline"] },
    // Organization-Wide
    { title: "NJTC Organizational Chart SY25-26", dept: "shared", tag: "Organization-Wide", effectiveDate: "Aug 2025", modifiedDate: null, sectionsModified: [], desc: "Current organizational structure, reporting lines, and department contacts for the 2025-2026 school year.", driveUrl: OPS_MANUAL_URL, annualGoals: ["Upgrade systems to support growth"] },
    { title: "Communications & Brand Standards", dept: "shared", tag: "Organization-Wide", effectiveDate: "Aug 2025", modifiedDate: null, sectionsModified: [], desc: "NJTC brand voice guidelines, external communications standards, social media policy, and media relations protocol.", driveUrl: OPS_MANUAL_URL, annualGoals: ["Grow the NJTC brand"] },
  ];

  // ══════════════════════════════════════════════════════════
  //  GOOGLE FORM
  // ══════════════════════════════════════════════════════════
  const FORM_ACTION = 'https://docs.google.com/forms/d/e/1FAIpQLSfBqQmfn4ZHyJ1-tv-ehKDyr-zD4RkBr5AfZ2QeJMpJFbFxHg/formResponse';

  const ENTRY = {
    email:           'entry.1457676306',
    submitterName:   'entry.580089576',
    onBehalf:        'entry.1590438580',
    onBehalfOf:      'entry.1245652844',
    empName:         'entry.629932880',
    empRole:         'entry.2044182643',
    empRoleOther:    'entry.1645253994',
    todayYear:       'entry.701375141_year',
    todayMonth:      'entry.701375141_month',
    todayDay:        'entry.701375141_day',
    convYear:        'entry.651108769_year',
    convMonth:       'entry.651108769_month',
    convDay:         'entry.651108769_day',
    firstOccurrence: 'entry.1911489470',
    supportType:     'entry.1990325444',
    supportOther:    'entry.59727443',
    delivery:        'entry.232659604',
    empSite:         'entry.2070944320',
    concernType:     'entry.2109849030',
    concernOther:    'entry.TODO_Q15',
    history:         'entry.TODO_Q16',
    hrNextSteps:     'entry.1704854495',
    nextStepsDesc:   'entry.TODO_Q18',
  };

  // ══════════════════════════════════════════════════════════
  //  PANEL SWITCHING
  // ══════════════════════════════════════════════════════════
  function showPanel(id, btn) {
    // Remove active only from the single currently-active panel/link (not all elements)
    const prevPanel = document.querySelector('.panel.active');
    if (prevPanel) prevPanel.classList.remove('active');
    const prevLink = document.querySelector('.sidebar-link.active');
    if (prevLink) prevLink.classList.remove('active');

    // Pre-warm the Operations Manual cache when policies panel is opened
    if (id === "policies" && typeof fetchOpsManual === "function") fetchOpsManual(false);
    if (id === "policies") {
      // Always reset all filters when opening the policies panel
      // so no stale dept/search/sort state persists from previous visits
      const deptF = document.getElementById('policyDeptFilter');
      const searchF = document.getElementById('policySearch');
      if (deptF) deptF.value = '';
      if (searchF) searchF.value = '';
    }
    if (id === "talent") {
      buildTalentDashboard(false);
      if (!window._talentLoaded) setTimeout(() => initTalentFilters(), 800);
      // Ensure profiles tab renders for relevant depts
      const _spDept = (window.NJTC_SESSION||{}).dept||'hr';
      if (['hr','data','leadership','kb','finance'].includes(_spDept)) {
        setTimeout(() => {
          if (typeof setTalentTab === 'function') setTalentTab('profiles');
        }, 300);
      }
    }
    if (id === "iready-lab") {
      setTimeout(() => { if (window.irlab) irlab.onPanelOpen(); }, 50);
    }
    if (id === "impact-report") {
      setTimeout(() => { if (window.irb) irb.onPanelOpen(); }, 50);
    }
    // Note: Knowtion render is handled exclusively by the IIFE override below (no double-render)
    const panel = document.getElementById('panel-' + id);
    if (panel) panel.classList.add('active');
    // Find the sidebar button if not passed
    const linkEl = btn || document.querySelector(`[data-panel="${id}"]`);
    if (linkEl) linkEl.classList.add('active');
    window.scrollTo({ top: 0, behavior: 'instant' });
  }
  window.showPanel = showPanel; // expose before patch IIFE captures _base

  // ══════════════════════════════════════════════════════════
  //  STATUS HELPERS
  // ══════════════════════════════════════════════════════════
  function statusClass(s) {
    return { 'Met':'s-met','In Progress':'s-progress','Partially Met':'s-partial','Coming Down the Pipeline':'s-pipeline','Has Not Met':'s-notmet' }[s] || 's-progress';
  }
  function statusEmoji(s) {
    return { 'Met':'✅','In Progress':'🔵','Partially Met':'🟠','Coming Down the Pipeline':'🟣','Has Not Met':'🔴' }[s] || '⚪';
  }

  // ══════════════════════════════════════════════════════════
  //  HOME PAGE
  // ══════════════════════════════════════════════════════════
  function buildHome(dept) {
    const cfg = DEPT_CONFIG[dept] || DEPT_CONFIG.programming;

    // Update header
    document.getElementById('homeEyebrow').textContent = cfg.label;

    // ── Dept-specific hero messaging ──────────────────────────────────────
    const heroMessages = {
      hr:          { headline: `${cfg.emoji} People Operations`,       sub: 'Workforce health, retention pipeline, and HR actions — all in one place.' },
      finance:     { headline: `${cfg.emoji} Financial Intelligence`,  sub: 'Funding status, fee-for-service health, and cash position at a glance.' },
      programming: { headline: `${cfg.emoji} Program Command Center`,  sub: 'Scholar impact, site health, and tutor performance — driving outcomes daily.' },
      data:        { headline: `${cfg.emoji} Data & Evaluation`,       sub: 'Full analytical access across all NJTC data systems. You own the numbers.' },
      training:    { headline: `${cfg.emoji} Training & Development`,  sub: 'Building the educator pipeline. PD design, apprenticeships, and skill gaps.' },
      leadership:  { headline: `${cfg.emoji} Leadership Overview`,     sub: 'Org health, strategic goal tracking, and board-ready reporting.' },
      kb:          { headline: `${cfg.emoji} Executive Dashboard`,     sub: 'Top-line organizational performance. What you need. When you need it.' },
    };
    const hm = heroMessages[dept] || heroMessages.leadership;
    const homeTitleEl = document.getElementById('homeTitle');
    const homeSubEl   = document.getElementById('homeSubtitle');
    if (homeTitleEl) {
      homeTitleEl.textContent = hm.headline;
      homeTitleEl.style.fontFamily = "'Syne', sans-serif";
      homeTitleEl.style.fontWeight = '800';
      homeTitleEl.style.fontSize   = '1.75rem';
      homeTitleEl.style.letterSpacing = '-.02em';
    }
    if (homeSubEl) homeSubEl.textContent = hm.sub;

    // ── Exec dashboard (leadership / data / kb only) ──
    const execDepts = ['leadership','data','kb'];
    const execEl = document.getElementById('execDashboard');
    if (execDepts.includes(dept) && execEl) {
      execEl.style.display = '';
      const poReady = window.po && typeof window.po.getStats === 'function';
      if (poReady) {
        buildExecDashboard(dept);
      } else {
        // Pearl not ready yet — show skeleton; polling boot will fill in shortly
        execEl.innerHTML = `<div style="padding:1.5rem 0;color:#94a3b8;font-size:.75rem;text-align:center">
          ⏳ Loading operational data… dashboard will appear shortly.
        </div>`;
      }
      document.getElementById('homeStatsStrip').style.display = 'none';
    } else if (execEl) {
      execEl.style.display = 'none';
      document.getElementById('homeStatsStrip').style.display = '';
    }

    // Stats strip — use midStatus as primary (falls back to status for legacy data)
    const getS = k => k.midStatus || k.status || '';
    const met = KPI_DATA.filter(k=>getS(k)==='Met').length;
    const prog = KPI_DATA.filter(k=>getS(k)==='In Progress').length;
    const partial = KPI_DATA.filter(k=>getS(k)==='Partially Met').length;
    const notmet = KPI_DATA.filter(k=>getS(k)==='Has Not Met').length;
    const pipe = KPI_DATA.filter(k=>getS(k)==='Coming Down the Pipeline').length;
    // iReady Academic Insight KPI tiles
    const _irlKpiIM = (window.irlab && typeof window.irlab.getInsightMetrics === 'function') ? window.irlab.getInsightMetrics('') : null;
    const _irlKpiGain = _irlKpiIM && _irlKpiIM.hasData && _irlKpiIM.medianScaleGain != null ? (_irlKpiIM.medianScaleGain > 0 ? '+' : '') + _irlKpiIM.medianScaleGain + ' pts' : '—';
    const _irlKpiPct  = _irlKpiIM && _irlKpiIM.hasData && _irlKpiIM.medianPctExpected != null ? Math.round(_irlKpiIM.medianPctExpected) + '%' : '—';
    document.getElementById('homeStatsStrip').innerHTML = `
      <div class="stat-tile" style="--accent-color:var(--met)" onclick="showPanel('kpi',document.querySelector('[data-panel=kpi]'));setTimeout(()=>setKpiFilter('Met'),100)">
        <div class="st-icon">✅</div>
        <div class="st-value">${met}</div>
        <div class="st-label">Goals Met</div>
        <div class="st-sub">SY 2025–26</div>
      </div>
      <div class="stat-tile" style="--accent-color:var(--progress)" onclick="showPanel('kpi',document.querySelector('[data-panel=kpi]'));setTimeout(()=>setKpiFilter('In Progress'),100)">
        <div class="st-icon">🔵</div>
        <div class="st-value">${prog}</div>
        <div class="st-label">In Progress</div>
        <div class="st-sub">Active tracking</div>
      </div>
      <div class="stat-tile" style="--accent-color:var(--partial)" onclick="showPanel('kpi',document.querySelector('[data-panel=kpi]'))">
        <div class="st-icon">🟠</div>
        <div class="st-value">${partial}</div>
        <div class="st-label">Partially Met</div>
        <div class="st-sub">In development</div>
      </div>
      <div class="stat-tile" style="--accent-color:var(--pipeline)">
        <div class="st-icon">🟣</div>
        <div class="st-value">${pipe}</div>
        <div class="st-label">Pipeline</div>
        <div class="st-sub">In development</div>
      </div>
      <div class="stat-tile" style="--accent-color:var(--notmet)" onclick="showPanel('kpi',document.querySelector('[data-panel=kpi]'));setTimeout(()=>setKpiFilter('Has Not Met'),100)">
        <div class="st-icon">🔴</div>
        <div class="st-value">${notmet}</div>
        <div class="st-label">Not Met</div>
        <div class="st-sub">Area of focus</div>
      </div>
      <div class="stat-tile" style="--accent-color:#0891b2" onclick="showPanel('iready-lab',document.querySelector('[data-panel=iready-lab]'))">
        <div class="st-icon">📈</div>
        <div class="st-value" style="font-size:1.5rem">${_irlKpiGain}</div>
        <div class="st-label">iReady Scale Gain</div>
        <div class="st-sub">Median · all scholars</div>
      </div>
      <div class="stat-tile" style="--accent-color:#7c3aed" onclick="showPanel('iready-lab',document.querySelector('[data-panel=iready-lab]'))">
        <div class="st-icon">🎯</div>
        <div class="st-value" style="font-size:1.5rem">${_irlKpiPct}</div>
        <div class="st-label">Growth vs Target</div>
        <div class="st-sub">% of typical norms · iReady Lab</div>
      </div>
    `;

    // metBadge in sidebar
    const metBadgeEl = document.getElementById('metBadge');
    if (metBadgeEl) metBadgeEl.textContent = met;

    // Quick links
    document.getElementById('homeQuickLinks').innerHTML = cfg.quickLinks.map(ql => `
      <div class="ql-card" onclick="showPanel('${ql.panel}',document.querySelector('[data-panel=${ql.panel}]'))">
        <div class="ql-icon-wrap" style="background:${ql.bg}">${ql.icon}</div>
        <div class="ql-title">${ql.label}</div>
        <div class="ql-desc">${ql.desc}</div>
        <div class="ql-arrow">Go → </div>
      </div>
    `).join('');

    // Department-specific widget (HR & Data: Termination Analytics; Programming: Retention Rate)
    const _deptWidget = document.getElementById('homeDeptWidget');
    if (_deptWidget) {
      if (['hr','data'].includes(dept) && typeof window._buildTermAnalyticsWidget === 'function') {
        _deptWidget.innerHTML = window._buildTermAnalyticsWidget();
      } else if (dept === 'programming' && typeof window._buildRetentionWidget === 'function') {
        _deptWidget.innerHTML = window._buildRetentionWidget();
      } else {
        _deptWidget.innerHTML = '';
      }
    }
  }

  // ── Executive Analytics Dashboard ─────────────────────────────────────────
  function buildExecDashboard(dept) {
    const execEl = document.getElementById('execDashboard');
    if (!execEl) return;
    const kpi   = window.KPI_DATA || [];
    const getS  = k => k.midStatus || k.status || '';
    const SCORE_PTS = {'Met':1,'Partially Met':.5,'In Progress':.25,'Coming Down the Pipeline':.1,'Has Not Met':0};
    const met   = kpi.filter(k=>getS(k)==='Met').length;
    const total = kpi.length || 1;
    const score = Math.round((kpi.reduce((a,k)=>a+(SCORE_PTS[getS(k)]||0),0)/total)*100);
    const risk  = score>=85?{l:'Healthy',c:'#166534',bg:'#dcfce7'}:score>=65?{l:'Watch',c:'#92400e',bg:'#fef3c7'}:score>=40?{l:'Needs Focus',c:'#9a3412',bg:'#ffedd5'}:{l:'Area of Support',c:'#991b1b',bg:'#fee2e2'};
    execEl.innerHTML = `
      <div style="background:linear-gradient(135deg,var(--navy-deep,#050d1a),#0d2847);border-radius:16px;padding:1.75rem;margin-bottom:1.5rem;display:flex;align-items:center;gap:2rem;flex-wrap:wrap">
        <div style="text-align:center;flex-shrink:0">
          <div style="font-family:'DM Serif Display',serif;font-size:3.5rem;color:${risk.c};line-height:1;letter-spacing:-.04em">${score}%</div>
          <div style="background:${risk.bg};color:${risk.c};font-size:.75rem;font-weight:700;padding:.25rem .75rem;border-radius:20px;margin-top:.5rem;display:inline-block">${risk.l}</div>
          <div style="font-size:.7rem;color:rgba(255,255,255,.4);margin-top:.375rem">Weighted Score · SY 25-26</div>
        </div>
        <div style="flex:1;min-width:220px">
          <div style="font-family:'Syne',sans-serif;font-size:1.125rem;font-weight:700;color:#fff;margin-bottom:.5rem">Organizational Health</div>
          <div style="font-size:.875rem;color:rgba(255,255,255,.6);line-height:1.6">${met} of ${total} targets fully achieved this cycle. ${score<65?'Several goal areas need attention before year-end.':'Progress is solid — keep driving forward.'}</div>
          <button onclick="showPanel('kpi-analytics',document.querySelector('[data-panel=kpi-analytics]'))" style="margin-top:.875rem;background:rgba(240,165,0,.15);border:1px solid rgba(240,165,0,.3);color:#f0a500;padding:.4rem 1rem;border-radius:8px;font-size:.8125rem;font-weight:700;cursor:pointer;font-family:inherit">View Full Analytics →</button>
        </div>
      </div>`;
  }

  // ══════════════════════════════════════════════════════════
  //  SIDEBAR DEPT CARD + CONNECTIONS
  // ══════════════════════════════════════════════════════════
  function buildSidebarDept(dept) {
    const cfg = DEPT_CONFIG[dept] || {};
    document.getElementById('sdcDept').textContent = `${cfg.emoji || ''} ${cfg.label || dept}`;
    document.getElementById('sdcTagline').textContent = cfg.tagline || '';
    document.getElementById('sdcBar').style.setProperty('--pct', cfg.goalPct || '0%');

    // Connections in sidebar (show 3 max)
    const connections = cfg.connections || [];
    const connList = document.getElementById('deptConnectionsList');
    const deptConns = DEPT_CONNECTIONS[dept] || [];
    connList.innerHTML = deptConns.slice(0,3).map(c => `
      <div class="dc-item" onclick="openConnectionsModal('${dept}')">
        <div class="dc-dot" style="background:${DEPT_COLORS[c.with]}"></div>
        <div class="dc-text"><strong>${DEPT_LABELS[c.with]}</strong> · ${c.how}</div>
      </div>
    `).join('') + (deptConns.length === 0 ? '<div class="dc-text" style="color:rgba(255,255,255,.3)">No connections configured</div>' : '');
  }

  // ══════════════════════════════════════════════════════════
  //  CONNECTIONS MODAL
  // ══════════════════════════════════════════════════════════
  window._currentDept = null; // shared with shared-charts.js (cross-module state)
  function openConnectionsModal(dept) {
    dept = dept || _currentDept;
    const cfg = DEPT_CONFIG[dept] || {};
    const conns = DEPT_CONNECTIONS[dept] || [];
    document.getElementById('modalTitle').textContent = `${cfg.emoji || ''} ${cfg.label} Connections`;
    document.getElementById('modalSub').textContent = `How ${cfg.label} connects with other departments to achieve annual goals`;
    document.getElementById('modalBody').innerHTML = conns.map(c => `
      <div class="connection-card">
        <div class="cc-dot" style="background:${DEPT_COLORS[c.with]}20">
          <span style="font-size:1.25rem">${DEPT_ICONS[c.with]}</span>
        </div>
        <div style="flex:1">
          <div class="cc-dept">${DEPT_LABELS[c.with]}</div>
          <div class="cc-how">${c.how}</div>
          <div class="cc-why">${c.why}</div>
          <div class="cc-goals">${c.goals.map(g=>`<span class="cc-goal-tag">📊 ${g}</span>`).join('')}</div>
        </div>
      </div>
    `).join('');
    document.getElementById('connectionsModal').classList.add('open');
  }
  function closeConnectionsModal() {
    document.getElementById('connectionsModal').classList.remove('open');
  }

  // ══════════════════════════════════════════════════════════
  //  KPI TABLE
  // ══════════════════════════════════════════════════════════
  // ── Parse CSV text into KPI row objects ──────────────────────────
  function parseSheetCSV(csvText) {
    const rows = [];
    // Split into lines, handle 

    const lines = csvText.replace(/\r/g, '').split('\n');
    // Find header row — contains "Goal" in col A
    let headerIdx = -1;
    for (let i = 0; i < lines.length; i++) {
      const cols = parseCSVLine(lines[i]);
      if (cols[0] && cols[0].trim() === 'Goal') { headerIdx = i; break; }
    }
    if (headerIdx === -1) return null; // could not parse
    // Data rows start immediately after header
    for (let i = headerIdx + 1; i < lines.length; i++) {
      const cols = parseCSVLine(lines[i]);
      const goal = (cols[0] || '').trim();
      const target = (cols[1] || '').trim();
      const mid = (cols[3] || '').trim();
      const end = (cols[4] || '').trim();
      if (!goal || !target || goal.startsWith('MID') || goal.startsWith('Color')) continue;
      // Validate statuses — warn in console if an unrecognized value enters from the sheet
      const VALID_STATUSES = ['Met', 'In Progress', 'Partially Met', 'Coming Down the Pipeline', 'Has Not Met', ''];
      if (mid && !VALID_STATUSES.includes(mid)) console.warn(`[KPI AUDIT] Unrecognized mid status "${mid}" for: ${target}`);
      if (end && !VALID_STATUSES.includes(end)) console.warn(`[KPI AUDIT] Unrecognized end status "${end}" for: ${target}`);
      rows.push({ goal, target, midStatus: mid, endStatus: end });
    }
    return rows;
  }

  // ── Minimal CSV line parser (handles quoted fields) ───────────────
  

  // ── Fetch live data from published Google Sheet ───────────────────
  async function fetchAndRebuildKPI(forceRefresh) {
    const dot = document.getElementById('kpiSyncDot');
    const txt = document.getElementById('kpiSyncText');
    const btn = document.getElementById('kpiRefreshBtn');
    if (dot) { dot.className = 'sync-dot loading'; }
    if (txt) txt.textContent = 'Fetching live data from Google Sheet…';
    if (btn) btn.disabled = true;

    // ── NJTC_CACHE stale-while-revalidate (30-min TTL) ──────────────────
    if (!forceRefresh) {
      const _kc = NJTC_CACHE.get('njtc_kpi_v2');
      if (_kc && _kc.data && _kc.data.length) {
        KPI_DATA = _kc.data;
        window.KPI_DATA = KPI_DATA;
        _kpiFromSheet = true;
        _kpiLastFetched = new Date(Date.now() - _kc.age);
        if (dot) { dot.className = 'sync-dot'; }
        if (txt) txt.innerHTML = `<strong>${_kc.fresh ? 'Cached' : 'Stale cache'}</strong> · ${KPI_DATA.length} targets · ${_kpiLastFetched.toLocaleTimeString()}`;
        if (btn) btn.disabled = false;
        const _sess = window.NJTC_SESSION;
        if (_sess) buildHome(_sess.dept);
        if (_kc.fresh) return;  // still fresh — skip network fetch
        // stale: fall through to re-fetch silently in background
      }
    }

    let parsed = null;
    try {
      const url = SHEET_CSV_URL + (forceRefresh ? '&t=' + Date.now() : '');
      const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
      if (res.ok) {
        const csv = await res.text();
        parsed = parseSheetCSV(csv);
      }
    } catch(e) { /* fall through to static */ }

    // ── STALE WARNING BANNER helper ──────────────────────────────────
    function showStaleWarning(msg) {
      let banner = document.getElementById('kpiStaleBanner');
      if (!banner) {
        banner = document.createElement('div');
        banner.id = 'kpiStaleBanner';
        banner.style.cssText = 'background:#fef3c7;border:1px solid #f59e0b;border-radius:8px;padding:.625rem 1rem;font-size:.8125rem;color:#92400e;margin-bottom:1rem;display:flex;align-items:center;gap:.5rem;';
        const container = document.getElementById('kpiSummary');
        if (container && container.parentNode) container.parentNode.insertBefore(banner, container);
      }
      banner.innerHTML = `⚠️ <strong>Data Warning:</strong> ${msg}`;
      banner.style.display = 'flex';
    }
    function clearStaleWarning() {
      const banner = document.getElementById('kpiStaleBanner');
      if (banner) banner.style.display = 'none';
    }

    if (parsed && parsed.length > 0) {
      // Live data successfully fetched — update everything
      KPI_DATA = parsed;
      window.KPI_DATA = KPI_DATA;
      NJTC_CACHE.set('njtc_kpi_v2', parsed);
      _kpiFromSheet = true;
      _kpiLastFetched = new Date();
      if (dot) { dot.className = 'sync-dot'; }
      if (txt) txt.innerHTML = `<strong>Live from Google Sheet</strong> · ${parsed.length} targets · Last synced ${_kpiLastFetched.toLocaleTimeString()}`;
      clearStaleWarning();
    } else {
      // Fetch failed — PRESERVE last good live data if we have it.
      // Only fall back to static if KPI_DATA has never been populated from the sheet.
      _kpiFromSheet = false;
      if (dot) { dot.className = 'sync-dot error'; }
      if (_kpiLastFetched) {
        // We have previously-fetched live data — keep it, warn the user
        if (txt) txt.innerHTML = `<strong>⚠️ Sheet unreachable</strong> · Showing last synced data from ${_kpiLastFetched.toLocaleTimeString()} · Recent changes may not be reflected`;
        showStaleWarning(`Could not reach Google Sheet. Counts below reflect last successful sync at ${_kpiLastFetched.toLocaleTimeString()}. Recent status changes may not be visible yet.`);
      } else {
        // First load ever failed — use static as absolute last resort
        KPI_DATA = KPI_DATA_STATIC;
        window.KPI_DATA = KPI_DATA;
        if (txt) txt.innerHTML = '<strong>Using built-in data</strong> · Could not reach Google Sheet on first load · Refresh to retry';
        showStaleWarning('Live data unavailable. Displaying built-in baseline data — this may not reflect recent status changes. Click ↺ Refresh to retry.');
      }
    }
    if (btn) btn.disabled = false;

    buildKPISummary();
    buildKPI();
    // Always rebuild home stats after every data refresh — data is now guaranteed accurate
    const session = window.NJTC_SESSION;
    if (session) buildHome(session.dept);
    fetchKPIMetadata(false);
  }

  function buildKPISummary() {
    // Invalidate export cache so next open reflects fresh KPI data
    if (typeof expInvalidate === 'function') expInvalidate();
    // Use midStatus for summary counts (primary cycle view)
    const cycle = (document.getElementById('kpiCycleFilter') || {value:'mid'}).value || 'mid';
    const getStatus = k => cycle === 'end' ? (k.endStatus || k.midStatus || '') : (k.midStatus || k.status || '');
    const counts = { Met:0, 'In Progress':0, 'Partially Met':0, 'Coming Down the Pipeline':0, 'Has Not Met':0 };
    KPI_DATA.forEach(k => { const s = getStatus(k); if(counts[s] !== undefined) counts[s]++; });
    const configs = [
      { status:'Met', emoji:'✅', color:'var(--met)' },
      { status:'In Progress', emoji:'🔵', color:'var(--progress)' },
      { status:'Partially Met', emoji:'🟠', color:'var(--partial)' },
      { status:'Coming Down the Pipeline', emoji:'🟣', color:'var(--pipeline)' },
      { status:'Has Not Met', emoji:'🔴', color:'var(--notmet)' },
    ];
    const el = document.getElementById('kpiSummary');
    if (el) el.innerHTML = configs.map(c => `
      <div class="kss-tile" onclick="setKpiFilter('${c.status}')" style="border-top:3px solid ${c.color}">
        <div class="kss-num" style="color:${c.color}">${counts[c.status]}</div>
        <div class="kss-label">${c.status}</div>
      </div>
    `).join('');

    // Populate goal filter (only once)
    const sel = document.getElementById('kpiGoalFilter');
    if (sel && sel.options.length === 1) {
      const goals = [...new Set(KPI_DATA.map(k=>k.goal))];
      goals.forEach(g => { const o = document.createElement('option'); o.value = g; o.textContent = g; sel.appendChild(o); });
    }
  }

  function setKpiFilter(status) {
    document.getElementById('kpiStatusFilter').value = status;
    filterKPI();
  }

  function buildKPI() { filterKPI(); }

  function filterKPI() {
    var goalF   = document.getElementById('kpiGoalFilter').value;
    var statusF = document.getElementById('kpiStatusFilter').value;
    var searchF = document.getElementById('kpiSearch').value.toLowerCase();
    var cycle   = (document.getElementById('kpiCycleFilter') || {value:'mid'}).value || 'mid';
    var midH = document.getElementById('midCycleHeader');
    var endH = document.getElementById('endCycleHeader');
    if (midH) midH.style.opacity = cycle === 'mid' ? '1' : '.45';
    if (endH) endH.style.opacity = cycle === 'end' ? '1' : '.45';

    var getStatus = function(k) { return cycle==='end' ? (k.endStatus||k.midStatus||'') : (k.midStatus||k.status||''); };
    var filtered = KPI_DATA.filter(function(k) {
      var s = getStatus(k);
      return (!goalF || k.goal===goalF) && (!statusF || s===statusF) &&
             (!searchF || k.target.toLowerCase().includes(searchF) || k.goal.toLowerCase().includes(searchF));
    });
    var groups = {};
    var goalOrder = KPI_DATA.reduce(function(acc,k){ if(acc.indexOf(k.goal)<0) acc.push(k.goal); return acc; },[]);
    filtered.forEach(function(k){ if(!groups[k.goal]) groups[k.goal]=[]; groups[k.goal].push(k); });

    function ownerCell(k) {
      if (!k.owner) return '<span style="color:var(--muted);font-size:.75rem">&#8212;</span>';
      return '<div class="kpi-owner-line"><span class="kpi-chip">' + k.owner + '</span></div>';
    }

    var html = '';
    goalOrder.forEach(function(goal) {
      if (!groups[goal]) return;
      html += '<tr class="goal-group-header"><td colspan="5">' + goal + '</td></tr>';
      groups[goal].forEach(function(k) {
        var mid = k.midStatus || ''; var end = k.endStatus || '';
        var midS = mid.replace(/'/g, '&#39;'); var endS = end.replace(/'/g, '&#39;');
        html += '<tr>' +
          '<td></td>' +
          '<td style="font-size:.875rem;color:var(--text);line-height:1.5">' + k.target + '</td>' +
          '<td>' + (mid ? '<span class="kpi-status ' + statusClass(mid) + '" style="cursor:pointer" onclick="setKpiFilter(\'' + midS + '\')" title="Click to filter">' + statusEmoji(mid) + ' ' + mid + '</span>' : '<span style="color:var(--muted);font-size:.8125rem">&#8212;</span>') + '</td>' +
          '<td>' + (end ? '<span class="kpi-status ' + statusClass(end) + '" style="cursor:pointer" onclick="setKpiFilter(\'' + endS + '\')" title="Click to filter">' + statusEmoji(end) + ' ' + end + '</span>' : '<span style="color:var(--muted);font-size:.8125rem;font-style:italic">Pending</span>') + '</td>' +
          '<td style="vertical-align:top;padding-top:.5rem">' + ownerCell(k) + '</td>' +
          '</tr>';
      });
    });
    var tbody = document.getElementById('kpiBody');
    if (tbody) tbody.innerHTML = html || '<tr><td colspan="5" style="text-align:center;padding:2rem;color:var(--muted)">No matching targets found</td></tr>';
  }

  // ══════════════════════════════════════════════════════════
  //  POLICIES LIBRARY
  // ══════════════════════════════════════════════════════════
  let _allPolicies = POLICIES_INLINE;

  async function buildPolicies(forceRefresh) {
    const syncDot = document.getElementById('syncDot');
    const syncText = document.getElementById('syncText');
    syncDot.className = 'sync-dot loading';
    syncText.innerHTML = 'Fetching latest documents from Google Drive…';

    // ── If live doc sync is disabled, use inline + any PDF uploads only ──
    if (typeof _liveDocEnabled !== 'undefined' && !_liveDocEnabled) {
      const pdfDocs = (typeof _pdfPolicies !== 'undefined' ? _pdfPolicies : []).map(p => ({
        title: p.name, dept: p.dept || 'shared', tag: 'PDF Upload',
        effectiveDate: new Date(p.uploadedAt).toLocaleDateString('en-US',{month:'short',year:'numeric'}),
        modifiedDate: null, sectionsModified: [], annualGoals: [],
        desc: `Uploaded PDF · ${p.filename} · By: ${p.uploadedBy}`,
        driveUrl: p.dataUrl, _isPdf: true, _isDriveUpload: true,
        _uploadedBy: p.uploadedBy, _uploadedAt: p.uploadedAt, _filename: p.filename,
      }));
      _allPolicies = [...POLICIES_INLINE, ...pdfDocs];
      syncDot.className = 'sync-dot error';
      syncText.innerHTML = '<strong>Live sync OFF</strong> · Showing built-in documents + uploaded PDFs · <em>Toggle Live Doc to re-enable</em>';
      renderPolicies();
      return;
    }

    let docs = POLICIES_INLINE;
    let fromDrive = false;
    if (forceRefresh && typeof logChange !== 'undefined') {
      logChange('edit', 'Policies library manually refreshed', typeof getDeptLabel !== 'undefined' ? getDeptLabel() : 'User', 'Policies & Procedures');
    }

    if (!DRIVE_MANIFEST_ID.startsWith('REPLACE')) {
      // Try multiple fetch strategies to work around CORS restrictions on Drive direct URLs.
      // Strategy 1: GitHub raw (preferred — no CORS, fastest, use if manifest.json is in the repo)
      // Strategy 2: Google Drive export with no-cors (limited but sometimes works)
      // Strategy 3: CORS proxy fallback
      // APPS_SCRIPT_URL: paste your deployed Web App URL here after setup
      // This is the primary source — reads your Drive folder live, zero CORS issues
      // ── INLINE MANIFEST (eliminates GitHub raw fetch + CORS errors) ──────
      const INLINE_MANIFEST = [
  {
    "title": "Document Title Here",
    "dept": "hr",
    "tag": "Human Resources",
    "effectiveDate": "Feb 2026",
    "modifiedDate": null,
    "sectionsModified": [],
    "desc": "Brief description of what this document covers.",
    "driveUrl": null,
    "annualGoals": [
      "Maintain and continue to build on strong culture"
    ]
  },
  {
    "title": "Document Title Here",
    "dept": "finance",
    "tag": "Finance",
    "effectiveDate": "Feb 2026",
    "modifiedDate": null,
    "sectionsModified": [],
    "desc": "Brief description of what this document covers.",
    "driveUrl": null,
    "annualGoals": [
      "Maintain cash position"
    ]
  },
  {
    "title": "Document Title Here",
    "dept": "data",
    "tag": "Data & Eval",
    "effectiveDate": "Feb 2026",
    "modifiedDate": null,
    "sectionsModified": [],
    "desc": "Brief description of what this document covers.",
    "driveUrl": null,
    "annualGoals": [
      "Upgrade systems to support growth"
    ]
  },
  {
    "title": "Document Title Here",
    "dept": "training",
    "tag": "Training & Development",
    "effectiveDate": "Feb 2026",
    "modifiedDate": null,
    "sectionsModified": [],
    "desc": "Brief description of what this document covers.",
    "driveUrl": null,
    "annualGoals": [
      "Support Growth of New Jersey's Educator Pipeline"
    ]
  },
  {
    "title": "Document Title Here",
    "dept": "programming",
    "tag": "Programming",
    "effectiveDate": "Feb 2026",
    "modifiedDate": null,
    "sectionsModified": [],
    "desc": "Brief description of what this document covers.",
    "driveUrl": null,
    "annualGoals": [
      "Increase Impact on Scholars"
    ]
  },
  {
    "title": "Document Title Here",
    "dept": "leadership",
    "tag": "Leadership",
    "effectiveDate": "Feb 2026",
    "modifiedDate": null,
    "sectionsModified": [],
    "desc": "Brief description of what this document covers.",
    "driveUrl": null,
    "annualGoals": [
      "Further Diversify board and leverage its support"
    ]
  }
];
      // Use inline manifest as primary source — no network request needed
      docs = INLINE_MANIFEST.map(d => ({
        ...d,
        dept: d.dept || 'shared',
        sectionsModified: d.sectionsModified || [],
        annualGoals: d.annualGoals || [],
        _isDriveUpload: true,
        _driveManifest: true,
      }));
      fromDrive = true;
      console.log('[Manifest] Loaded inline:', docs.length, 'documents');
      // ── END INLINE MANIFEST ──────────────────────────────────────────────
      const APPS_SCRIPT_URL = typeof DRIVE_APPS_SCRIPT_URL !== 'undefined' ? DRIVE_APPS_SCRIPT_URL : '';
      const GITHUB_MANIFEST_URL = 'https://raw.githubusercontent.com/njtcdata/New-Jersey-Tutoring-Corps-Portal/main/central/manifest.json';
      const DRIVE_DIRECT_URL = `https://drive.google.com/uc?export=download&id=${DRIVE_MANIFEST_ID}`;
      const CORS_PROXY_URL = `https://api.allorigins.win/raw?url=${encodeURIComponent(DRIVE_DIRECT_URL)}`;

      const tryFetch = async (url) => {
        const res = await fetch(url + (forceRefresh ? (url.includes('?') ? '&' : '?') + 't=' + Date.now() : ''), {
          signal: AbortSignal.timeout(8000)
        });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const raw = await res.text();
        return JSON.parse(raw);
      };

      // Apps Script removed from strategy chain — causes CORS errors on GitHub Pages.
      // GitHub raw is the primary source; CORS proxy is fallback.
      // Network fetch skipped — inline manifest already loaded above
      const strategies = [];
    }

    // Merge in any locally-uploaded PDF additions
    const pdfAdditions = (typeof _pdfPolicies !== 'undefined' ? _pdfPolicies : []).map(p => ({
      title: p.name, dept: p.dept || 'shared', tag: 'PDF Upload',
      effectiveDate: new Date(p.uploadedAt).toLocaleDateString('en-US',{month:'short',year:'numeric'}),
      modifiedDate: null, sectionsModified: [], annualGoals: [],
      desc: `Uploaded PDF · ${p.filename} · By: ${p.uploadedBy}`,
      driveUrl: p.dataUrl, _isPdf: true, _isDriveUpload: true,
      _uploadedBy: p.uploadedBy, _uploadedAt: p.uploadedAt, _filename: p.filename,
    }));
    // ALWAYS keep POLICIES_INLINE as the base.
    // Drive manifest entries are ADDITIONS on top — they never replace built-in policies.
    const driveAdditions = fromDrive ? docs : [];
    _allPolicies = [...POLICIES_INLINE, ...driveAdditions, ...pdfAdditions];

    const totalCount = POLICIES_INLINE.length + driveAdditions.length + pdfAdditions.length;
    if (fromDrive) {
      syncDot.className = 'sync-dot';
      syncText.innerHTML = `<strong>Live from Google Drive</strong> · ${POLICIES_INLINE.length} core policies + ${driveAdditions.length} Drive additions${pdfAdditions.length ? ' + ' + pdfAdditions.length + ' uploads' : ''} · Last refreshed ${new Date().toLocaleTimeString()}`;
    } else {
      syncDot.className = 'sync-dot error';
      syncText.innerHTML = DRIVE_MANIFEST_ID.startsWith('REPLACE')
        ? `<strong>${POLICIES_INLINE.length} built-in policies</strong> · Connect Google Drive to add supplemental documents automatically`
        : `<strong>${POLICIES_INLINE.length} built-in policies</strong> · Drive unreachable — supplemental documents unavailable · <em>Click ↺ Refresh to retry</em>`;
    }
    renderPolicies();
  }

  function renderPolicies() {
    const deptF  = document.getElementById('policyDeptFilter').value;
    const search = document.getElementById('policySearch').value.toLowerCase();
    const sort   = document.getElementById('policySort').value;

    // Build registry from ALL policies (preserves stable pid across filter changes)
    POLICIES_REGISTRY = _allPolicies;

    // Tag each policy with its stable pid before filtering
    const allWithPid = _allPolicies.map((d, i) => ({ ...d, _pid: i }));
    let docs = allWithPid.filter(d => {
      // Special filter: "Google Drive Additions" shows only _isDriveUpload docs
      if (deptF === '__drive__') return !!d._isDriveUpload;
      return (!deptF  || d.dept === deptF) &&
        (!search || d.title.toLowerCase().includes(search) || (d.desc||'').toLowerCase().includes(search) || (d.tag||'').toLowerCase().includes(search));
    });

    if (sort === 'alpha')    docs = [...docs].sort((a,b) => a.title.localeCompare(b.title));
    if (sort === 'modified') docs = [...docs].sort((a,b) => (b.modifiedDate||'') > (a.modifiedDate||'') ? 1 : -1);
    if (sort === 'date')     docs = [...docs].sort((a,b) => (b.effectiveDate||'') > (a.effectiveDate||'') ? 1 : -1);

    if (!docs.length) {
      document.getElementById('policyContent').innerHTML = '<div class="alert alert-info"><span>ℹ️</span><div>No documents match your filter.</div></div>';
      return;
    }

    let html = '';
    if (sort === 'dept' && !deptF) {
      // Group by dept
      const DEPT_ORDER = ['shared','hr','finance','programming','data','training','__drive__'];
      const groups = {};
      docs.forEach(d => { const dk = d._isDriveUpload ? '__drive__' : (d.dept||'shared'); if(!groups[dk]) groups[dk]=[]; groups[dk].push(d); });
      DEPT_ORDER.forEach(dk => {
        if (!groups[dk]) return;
        const color = DEPT_COLORS[dk] || '#888';
        const icon = DEPT_ICONS[dk] || '📄';
        const label = DEPT_LABELS[dk] || dk;
        const isDriveGroup = dk === '__drive__';
        const headerStyle = isDriveGroup
          ? `background:linear-gradient(90deg,#e8f4fd,#f0f7ff);border:1.5px solid #b6d9f7;border-radius:10px;padding:.75rem 1rem;display:flex;align-items:center;gap:.75rem;margin-bottom:.75rem`
          : ``;
        const titleStyle = isDriveGroup ? `color:#0969da;font-weight:700` : ``;
        const driveNote = isDriveGroup
          ? `<span style="font-size:.7rem;font-weight:400;color:#0969da;margin-left:.5rem;opacity:.8">— Separate from the Policies &amp; Procedures Manual</span>`
          : ``;
        html += isDriveGroup
          ? `<div style="${headerStyle}">
              <div class="dsh-icon" style="background:#0969da18;font-size:1.25rem">☁️</div>
              <div style="flex:1">
                <div class="dsh-title" style="${titleStyle}">Google Drive Additions ${driveNote}</div>
                <div style="font-size:.75rem;color:#0969da;margin-top:.125rem">${groups[dk].length} document${groups[dk].length>1?'s':''} uploaded directly to Google Drive</div>
              </div>
              <span style="font-size:.625rem;font-weight:700;letter-spacing:.07em;text-transform:uppercase;background:#0969da;color:#fff;padding:.2rem .6rem;border-radius:20px">Drive Addition</span>
            </div>
            <div class="policy-grid" style="margin-bottom:2rem">
              ${groups[dk].map(d => policyCardHTML(d, d._pid)).join('')}
            </div>`
          : `<div class="dept-section-header">
              <div class="dsh-icon" style="background:${color}18">${icon}</div>
              <div class="dsh-title">${label}</div>
              <div class="dsh-count">${groups[dk].length} document${groups[dk].length>1?'s':''}</div>
            </div>
            <div class="policy-grid" style="margin-bottom:1.5rem">
              ${groups[dk].map(d => policyCardHTML(d, d._pid)).join('')}
            </div>`;
      });
    } else {
      html = `<div class="policy-grid">${docs.map(d => policyCardHTML(d, d._pid)).join('')}</div>`;
    }
    document.getElementById('policyContent').innerHTML = html;
  }

  function policyCardHTML(d, pid) {
    const color = DEPT_COLORS[d.dept] || '#888';
    const url = d.driveUrl && !d.driveUrl.includes('PASTE_YOUR') && !d.driveUrl.includes('REPLACE') && !d.driveUrl.includes('TODO')
      ? d.driveUrl
      : (d.fileId && !d.fileId.startsWith('REPLACE') && !d.fileId.startsWith('TODO') && !d.fileId.startsWith('PASTE')
        ? `https://drive.google.com/file/d/${d.fileId}/view`
        : null);
    const modified = d.modifiedDate && d.sectionsModified && d.sectionsModified.length > 0;
    const modTooltip = modified
      ? `<div class="has-tooltip" style="display:inline-block">
          <span class="policy-changes-badge">📝 Updated ${d.modifiedDate}
            <div class="tooltip-box">
              <strong>Sections Modified:</strong><br>${(d.sectionsModified||[]).map(s=>`• ${s}`).join('<br>')}
            </div>
          </span>
        </div>`
      : '';
    const goalTags = (d.annualGoals||[]).map(g =>
      `<span class="has-tooltip" style="display:inline-block">
        <span style="font-size:.6rem;font-weight:600;background:rgba(0,80,200,.07);color:var(--blue-mid);padding:.15rem .45rem;border-radius:4px;cursor:default">📊 ${g}</span>
        <div class="tooltip-box" style="width:220px">Aligns with organizational goal: <strong>${g}</strong></div>
      </span>`
    ).join('');
    const safeId = pid !== undefined ? pid : 0;

    // ── Drive Addition rendering ──────────────────────────────────────
    const isDrive = !!d._isDriveUpload;
    const driveTag = isDrive
      ? `<span class="drive-addition-tag" title="This document was uploaded directly to Google Drive — it is separate from the Policies &amp; Procedures Manual">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h16M12 4v12M8 8l4-4 4 4"/></svg>
          Google Drive Addition
        </span>`
      : '';
    const driveUploadMeta = isDrive && d._uploadedBy
      ? `<div class="drive-upload-meta">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          Uploaded by ${d._uploadedBy}${d._uploadedAt ? ' · ' + new Date(d._uploadedAt).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}) : ''}
          ${d._filename ? ` · <em>${d._filename}</em>` : ''}
        </div>`
      : '';
    const cardClass = isDrive ? 'policy-card drive-addition' : 'policy-card';
    const openDocLink = url ? `<a class="policy-link" href="${url}" target="_blank" rel="noopener" onclick="event.stopPropagation()">${isDrive ? '☁️ Open in Drive ↗' : 'Open Doc ↗'}</a>` : '';
    const readBtn = isDrive
      ? `<button class="policy-open-btn" style="border-color:#0969da;color:#0969da" onclick="event.stopPropagation();openPolicyByIdx(${safeId})">☁️ View Document</button>`
      : `<button class="policy-open-btn" onclick="event.stopPropagation();openPolicyByIdx(${safeId})">📖 Read Policy</button>`;

    return `
      <div class="${cardClass}" data-pid="${safeId}" onclick="openPolicyByIdx(${safeId})" title="${isDrive ? 'Google Drive Addition — click to open' : 'Click to read policy'}">
        <div class="policy-card-top">
          <div class="policy-tag-group">
            <div class="policy-dept-dot" style="background:${color}"></div>
            <span class="policy-tag" style="background:${color}18;color:${color}">${d.tag || d.dept}</span>
            ${driveTag}
            ${modTooltip}
          </div>
          <span class="policy-modified">📅 ${d.effectiveDate||'—'}</span>
        </div>
        <div class="policy-title">${d.title}</div>
        <div class="policy-desc">${d.desc||''}</div>
        ${driveUploadMeta}
        ${goalTags ? `<div style="display:flex;flex-wrap:wrap;gap:.375rem;margin-top:.625rem">${goalTags}</div>` : ''}
        <div class="policy-footer" style="display:flex;justify-content:space-between;align-items:center;gap:.5rem;flex-wrap:wrap">
          <span class="policy-date">${isDrive ? 'Added ' : 'Effective '}${d.effectiveDate||'—'}</span>
          <div style="display:flex;gap:.5rem;align-items:center">
            ${readBtn}
            ${openDocLink}
          </div>
        </div>
      </div>`;
  }

  function openPolicyByIdx(pid) {
    const d = POLICIES_REGISTRY[pid];
    if (!d) { console.warn('openPolicyByIdx: no policy at index', pid); return; }

    // Drive Additions (uploaded files) open directly in Drive — no section reader modal
    if (d._isDriveUpload) {
      const rawUrl = d.driveUrl || OPS_MANUAL_URL;
      const url = (rawUrl && !rawUrl.includes('PASTE_YOUR') && !rawUrl.includes('REPLACE') && !rawUrl.includes('TODO'))
        ? rawUrl : null;
      // PDF uploads have a dataUrl — open in a new tab via blob
      if (d._isPdf && url && url.startsWith('data:')) {
        const win = window.open('', '_blank');
        win.document.write('<iframe src="' + url + '" style="width:100%;height:100vh;border:none"></iframe>');
        return;
      }
      if (url) { window.open(url, '_blank', 'noopener'); return; }
      // No valid URL — show friendly message instead of opening a broken link
      alert('No document URL has been configured for this entry yet. Please update the manifest with a valid Google Drive link.');
      return;
    }

    // Built-in policies → open the rich section reader modal
    const url = d.driveUrl || (d.fileId && !d.fileId.startsWith('REPLACE')
      ? 'https://drive.google.com/file/d/' + d.fileId + '/view'
      : OPS_MANUAL_URL);
    openPolicyModal(d.title, d.dept, d.tag || d.dept, d.effectiveDate || '', d.modifiedDate || '', url || OPS_MANUAL_URL);
  }

  function filterPolicies() { renderPolicies(); }

  // ══════════════════════════════════════════════════════════
  //  CONCERN FORM
  // ══════════════════════════════════════════════════════════
  let _step = 1;

  function goStep(n) {
    if (n > _step && !validateStep(_step)) return;
    document.getElementById(`fs${_step}`).classList.remove('active');
    document.getElementById(`fs${n}`).classList.add('active');
    ['sp1','sp2','sp3','sp4'].forEach((id,i) => {
      const el = document.getElementById(id);
      el.classList.remove('active','completed');
      if (i+1 === n) el.classList.add('active');
      else if (i+1 < n) el.classList.add('completed');
    });
    _step = n;
    document.querySelector('.form-wrapper').scrollIntoView({ behavior:'smooth', block:'start' });
  }

  function validateStep(n) {
    const errs = [];
    if (n===1) {
      if (!document.getElementById('f_email').value.trim()) errs.push('Email is required.');
      if (!document.getElementById('f_submitter').value.trim()) errs.push('Your name and title are required.');
    }
    if (n===2) {
      if (!document.getElementById('f_empName').value.trim()) errs.push('Employee name is required.');
      if (!document.getElementById('f_empRole').value) errs.push('Employee role is required.');
      if (!document.getElementById('f_empSite').value) errs.push('Employee site is required.');
      if (!document.getElementById('f_todayDate').value) errs.push("Today's date is required.");
      if (!document.getElementById('f_convDate').value) errs.push('Date conversation occurred is required.');
      if (!document.querySelector('input[name="firstOccurrence"]:checked')) errs.push('Please indicate if this is the first documented occurrence.');
    }
    if (n===3) {
      if (!document.querySelector('input[name="supportType"]:checked')) errs.push('Support type is required.');
      if (!document.querySelector('input[name="delivery"]:checked')) errs.push('Delivery method is required.');
      if (!document.querySelector('input[name="concernType"]:checked')) errs.push('Concern type is required.');
      if (!document.getElementById('f_history').value.trim()) errs.push('Historical details are required.');
    }
    if (errs.length) { alert(errs.join('\n')); return false; }
    return true;
  }

  function toggleOnBehalf(val) {
    document.getElementById('onBehalfField').style.display = val==='Yes' ? 'block' : 'none';
  }
  function toggleSupportOther(val) {
    document.getElementById('supportOtherWrap').style.display = val==='Other' ? 'block' : 'none';
  }
  function toggleConcernOther(val) {
    document.getElementById('concernOtherWrap').style.display = val==='Other' ? 'block' : 'none';
  }

  function _parseDate(s) {
    const [y,m,d] = (s||'').split('-');
    return { year:y||'', month:m?String(parseInt(m)):'', day:d?String(parseInt(d)):'' };
  }

  async function submitConcernForm() {
    if (!validateStep(4)) return;
    if (!document.querySelector('input[name="hrNextSteps"]:checked')) {
      const errEl = document.getElementById('submitError');
      errEl.textContent = 'Please select the next steps requested from HR.';
      errEl.style.display = 'block';
      return;
    }
    document.getElementById('submitError').style.display = 'none';
    const btn = document.getElementById('submitBtn');
    btn.disabled = true;
    document.getElementById('submitBtnTxt').textContent = 'Submitting…';
    document.getElementById('submitSpinner').style.display = 'inline-block';

    const td = _parseDate(document.getElementById('f_todayDate').value);
    const cd = _parseDate(document.getElementById('f_convDate').value);
    const params = new URLSearchParams();
    const g = (id) => document.getElementById(id)?.value?.trim() || '';
    const r = (name) => document.querySelector(`input[name="${name}"]:checked`)?.value || '';

    params.append(ENTRY.email,           g('f_email'));
    params.append(ENTRY.submitterName,   g('f_submitter'));
    params.append(ENTRY.onBehalf,        r('onBehalf') || 'No');
    params.append(ENTRY.onBehalfOf,      g('f_onBehalfOf'));
    params.append(ENTRY.empName,         g('f_empName'));
    params.append(ENTRY.empRole,         document.getElementById('f_empRole').value);
    params.append(ENTRY.empRoleOther,    document.getElementById('f_empRole').value === 'Other' ? '' : '');
    params.append(ENTRY.todayYear,       td.year);
    params.append(ENTRY.todayMonth,      td.month);
    params.append(ENTRY.todayDay,        td.day);
    params.append(ENTRY.convYear,        cd.year);
    params.append(ENTRY.convMonth,       cd.month);
    params.append(ENTRY.convDay,         cd.day);
    params.append(ENTRY.firstOccurrence, r('firstOccurrence'));
    params.append(ENTRY.supportType,     r('supportType'));
    params.append(ENTRY.supportOther,    g('f_supportOther'));
    params.append(ENTRY.delivery,        r('delivery'));
    params.append(ENTRY.empSite,         document.getElementById('f_empSite').value);
    params.append(ENTRY.concernType,     r('concernType'));
    params.append(ENTRY.concernOther,    g('f_concernOther'));
    params.append(ENTRY.history,         g('f_history'));
    params.append(ENTRY.hrNextSteps,     r('hrNextSteps'));
    params.append(ENTRY.nextStepsDesc,   g('f_nextStepsDesc'));

    try {
      await fetch(FORM_ACTION, { method:'POST', mode:'no-cors', headers:{'Content-Type':'application/x-www-form-urlencoded'}, body:params.toString() });
      document.getElementById('formContainer').style.display = 'none';
      document.getElementById('formSuccess').style.display = 'block';
    } catch(e) {
      const errEl = document.getElementById('submitError');
      errEl.textContent = 'Submission failed. Please try again or contact your Program Manager.';
      errEl.style.display = 'block';
      btn.disabled = false;
      document.getElementById('submitBtnTxt').textContent = 'Submit to HR';
      document.getElementById('submitSpinner').style.display = 'none';
    }
  }

  function resetConcernForm() {
    document.getElementById('concernForm').reset();
    ['onBehalfField','supportOtherWrap','concernOtherWrap'].forEach(id => {
      document.getElementById(id).style.display = 'none';
    });
    document.getElementById('formContainer').style.display = 'block';
    document.getElementById('formSuccess').style.display = 'none';
    document.getElementById('submitBtn').disabled = false;
    document.getElementById('submitBtnTxt').textContent = 'Submit to HR';
    document.getElementById('submitSpinner').style.display = 'none';
    document.getElementById('submitError').style.display = 'none';
    _step = 1;
    goStep(1);
  }

  // ══════════════════════════════════════════════════════════
  //  SESSION TIMER + NAV DATE
  // ══════════════════════════════════════════════════════════
  function startSessionTimer(exp) {
    function update() {
      const left = exp - Date.now();
      if (left <= 0) { NJTCAuth.logout(); return; }
      const h = Math.floor(left/3600000);
      const m = Math.floor((left%3600000)/60000);
      document.getElementById('sessionTimer').textContent = `Session: ${h}h ${m}m`;
    }
    update();
    setInterval(update, 60000);
  }

  function updateNavDate() {
    const d = new Date();
    document.getElementById('navDate').textContent = d.toLocaleDateString('en-US',{ weekday:'short', month:'short', day:'numeric', year:'numeric' });
  }

  function setupPerfSection() { /* no legacy elements */ }

  // ══════════════════════════════════════════════════════════
  //  INIT
  // ══════════════════════════════════════════════════════════
  async function init() {
    updateNavDate();

    await new Promise(resolve => {
      if (window.NJTC_SESSION) { resolve(); return; }
      const t = setInterval(() => {
        if (window.NJTC_SESSION) { clearInterval(t); resolve(); }
      }, 50);
      setTimeout(() => { clearInterval(t); resolve(); }, 3000);
    });

    const session = window.NJTC_SESSION;
    if (!session) return;

    const dept = session.dept;
    _currentDept = dept;
    const cfg = DEPT_CONFIG[dept] || {};

    // ── Apply dept identity to CSS custom properties ──────────────────────
    const deptAccents = {
      hr: '#e63946', finance: '#2a9d8f', programming: '#457b9d',
      data: '#7b2d8b', training: '#e76f51', leadership: '#f0a500', kb: '#5b8dee'
    };
    const deptGlows = {
      hr: 'rgba(230,57,70,.18)', finance: 'rgba(42,157,143,.18)',
      programming: 'rgba(69,123,157,.18)', data: 'rgba(123,45,139,.18)',
      training: 'rgba(231,111,81,.18)', leadership: 'rgba(240,165,0,.18)', kb: 'rgba(91,141,238,.18)'
    };
    const _r = document.documentElement;
    _r.style.setProperty('--dept-accent', deptAccents[dept] || '#f0a500');
    _r.style.setProperty('--dept-glow',   deptGlows[dept]   || 'rgba(240,165,0,.18)');

    // Nav badge
    document.getElementById('deptBadge').textContent = cfg.label || dept.toUpperCase();

    // Session timer
    startSessionTimer(session.exp);

    // Build content
    // buildHome is called from INSIDE fetchAndRebuildKPI after KPI_DATA is populated from the live sheet.
    // Calling it here first would render stale static counts then visibly jump — race condition eliminated.
    buildSidebarDept(dept);
    if (typeof pieInit === 'function') pieInit(dept);
    buildPolicies(false);
    // ── Parallel background prefetch — all data sources fired simultaneously ──
    // By the time the user opens any panel, data is either served from
    // this prefetch or from the localStorage cache loaded above.
    setTimeout(() => {
      // Fire all 4 fetches in parallel — none block the UI
      fetchAndRebuildKPI(false).catch(() => {});
      if (window.sya && window.sya.refresh) {
        try { window.sya.refresh(false); } catch(e) {}
      }
      // Talent: trigger via buildTalentDashboard but non-blocking
      // (it guards with _talentLoaded flag so safe to call early)
      // Pearl: only prefetch if user has pearl panel access
      const dept = window.NJTC_SESSION && window.NJTC_SESSION.dept;
      if (dept && ['leadership','data','programming','kb'].includes(dept)) {
        if (window.po && window.po.onPanelOpen) {
          try { window.po.onPanelOpen(); } catch(e) {}
        }
      }
      // irlab: no prefetch needed — embedded data, loads instantly on panel open
    }, 100);
    // Init dept-aware nav (show/hide sidebar items) + policy admin bar
    // Guard: shared-filters.js may not be available in all environments
    if (typeof window.initDeptNav === 'function') {
      window.initDeptNav(dept);
    } else {
      // Retry once after a brief delay in case of script-load timing edge case
      setTimeout(() => { if (typeof window.initDeptNav === 'function') window.initDeptNav(dept); }, 300);
    }
    setTimeout(() => initPolicyAdmin(), 500);

    // Auto-fill today's date
    const today = new Date().toISOString().split('T')[0];
    const todayField = document.getElementById('f_todayDate');
    if (todayField) todayField.value = today;

    // Show UI
    document.getElementById('loadingScreen').style.display = 'none';
    document.getElementById('ctLayout').style.display = 'grid';
  }

  init();

  // Auto-refresh KPI data from Google Sheet every 5 minutes
  // forceRefresh=true appends cache-bust timestamp — guarantees fresh data, never stale CDN cache
  setInterval(() => {
    if (document.getElementById('panel-kpi') && document.getElementById('panel-kpi').classList.contains('active')) {
      fetchAndRebuildKPI(true);
    }
  }, 5 * 60 * 1000);

  // Cycle filter toggle also rebuilds summary counts
  const cycleFilter = document.getElementById('kpiCycleFilter');
  if (cycleFilter) cycleFilter.addEventListener('change', () => {
    buildKPISummary();
    filterKPI();
  });


  // ══════════════════════════════════════════════════════════════════
  //  CHANGE LOG + NOTIFICATION SYSTEM
  // ══════════════════════════════════════════════════════════════════
  let _changeLog = JSON.parse(localStorage.getItem('njtc_change_log') || '[]');
  let _pdfPolicies = JSON.parse(localStorage.getItem('njtc_pdf_policies') || '[]');
  let _liveDocEnabled = localStorage.getItem('njtc_live_doc') !== 'false';

  function logChange(type, action, who, detail) {
    const entry = { type, action, who: who || getDeptLabel(), detail, time: new Date().toISOString() };
    _changeLog.unshift(entry);
    if (_changeLog.length > 200) _changeLog = _changeLog.slice(0, 200);
    try { localStorage.setItem('njtc_change_log', JSON.stringify(_changeLog)); } catch(e) {}
    showChangeNotif(entry);
    broadcastChange(entry);
  }

  function getDeptLabel() {
    const cfg = (typeof DEPT_CONFIG !== 'undefined' && _currentDept) ? DEPT_CONFIG[_currentDept] : null;
    return cfg ? cfg.label : (_currentDept || 'System');
  }

  function showChangeNotif(entry) {
    const el = document.getElementById('changeNotifContainer');
    if (!el) return;
    const icons = { add:'➕', edit:'✏️', upload:'📎', toggle:'🔄', delete:'🗑️', csv:'📊' };
    const div = document.createElement('div');
    div.className = 'change-notif';
    div.innerHTML = `
      <div class="cn-icon">${icons[entry.type]||'🔔'}</div>
      <div class="cn-body">
        <div class="cn-title">${entry.action}</div>
        <div class="cn-sub"><strong>${entry.who}</strong> · ${entry.detail||''} · ${new Date(entry.time).toLocaleTimeString()}</div>
      </div>
      <button class="cn-close" onclick="this.closest('.change-notif').remove()">✕</button>`;
    el.appendChild(div);
    setTimeout(() => { if (div.parentNode) div.remove(); }, 7000);
  }

  function broadcastChange(entry) {
    try {
      const bc = new BroadcastChannel('njtc_portal_changes');
      bc.postMessage(entry);
      bc.close();
    } catch(e) {}
  }

  // Listen for changes from other tabs
  try {
    const bc = new BroadcastChannel('njtc_portal_changes');
    bc.onmessage = (e) => { showChangeNotif({ ...e.data, action: '📡 ' + e.data.action + ' (other tab)' }); };
  } catch(e) {}

  // ── Change Log Modal ────────────────────────────────────────────
  function showChangeLog() {
    const existing = document.getElementById('changeLogModal');
    if (existing) { existing.remove(); return; }
    const modal = document.createElement('div');
    modal.id = 'changeLogModal';
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:9000;display:flex;align-items:center;justify-content:center;padding:1rem';
    const entries = _changeLog.slice(0, 50);
    const rows = entries.length ? entries.map(e => {
      const dotClass = {add:'cl-add',edit:'cl-edit',upload:'cl-upload',toggle:'cl-toggle',delete:'cl-delete',csv:'cl-add'}[e.type]||'';
      return `<div class="change-log-item">
        <div class="cl-dot ${dotClass}"></div>
        <div class="cl-body">
          <span class="cl-who">${e.who}</span>
          <span class="cl-action"> — ${e.action}</span>
          ${e.detail ? `<span class="cl-badge">${e.detail.substring(0,60)}</span>` : ''}
          <div class="cl-time">${new Date(e.time).toLocaleString()}</div>
        </div>
      </div>`;
    }).join('') : '<div style="padding:2rem;text-align:center;color:var(--muted)">No changes recorded yet.</div>';
    modal.innerHTML = `<div style="background:#fff;border-radius:14px;max-width:600px;width:100%;max-height:80vh;overflow:hidden;display:flex;flex-direction:column">
      <div style="padding:1.25rem 1.5rem;background:var(--navy);color:#fff;display:flex;align-items:center;gap:.75rem;border-radius:14px 14px 0 0">
        <span style="font-size:1.25rem">📋</span>
        <div style="flex:1"><div style="font-weight:700;font-size:1rem">Change Log</div><div style="font-size:.75rem;opacity:.7">All policy and data updates across the portal</div></div>
        <button onclick="document.getElementById('changeLogModal').remove()" style="background:none;border:none;color:#fff;font-size:1.25rem;cursor:pointer">✕</button>
      </div>
      <div style="padding:1.25rem 1.5rem;overflow-y:auto;flex:1">${rows}</div>
      <div style="padding:.875rem 1.5rem;border-top:1px solid var(--border);display:flex;gap:.5rem">
        <button class="btn btn-secondary btn-sm" onclick="if(confirm('Clear all change history?')){_changeLog=[];localStorage.removeItem('njtc_change_log');document.getElementById('changeLogModal').remove();}">🗑 Clear Log</button>
        <span style="flex:1"></span>
        <button class="btn btn-secondary btn-sm" onclick="document.getElementById('changeLogModal').remove()">Close</button>
      </div>
    </div>`;
    document.body.appendChild(modal);
    modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
  }

  // ══════════════════════════════════════════════════════════════════
  //  PDF UPLOAD SYSTEM (Leadership + Data depts only)

  // ══════════════════════════════════════════════════════════════════
  //  TALENT DATA — Seeded + Live fetch from Google Sheets CSV
  // ══════════════════════════════════════════════════════════════════
  let CONCERNS = [{"ts":"3/6/2025 15:23:31","month":"Mar 2025","yr":2025,"mo":3,"submitter":"Jenny Irwin, Asst. Program Manager","emp":"Genesis Troya","role":"Dual Role","support_type":"Observation","delivery":"Email","site":"iLearn Charter School- Clifton ES","concern_type":"Other (please explain below)","concern_label":"Lack of Tutor Observations","hr_action":"Yes","first_time":""},{"ts":"3/6/2025 15:26:44","month":"Mar 2025","yr":2025,"mo":3,"submitter":"Jenny Irwin, Asst. Program Manager","emp":"Genesis Troya","role":"Dual Role","support_type":"Observation","delivery":"Email","site":"iLearn Charter School- Clifton ES","concern_type":"Other (please explain below)","concern_label":"Tutor Observations","hr_action":"Yes","first_time":""},{"ts":"3/6/2025 15:29:04","month":"Mar 2025","yr":2025,"mo":3,"submitter":"Jenny Irwin, Asst. Program Manager","emp":"Genesis Troya","role":"Dual Role","support_type":"Coaching Support or feedback","delivery":"Email","site":"iLearn Charter School- Clifton ES","concern_type":"Lesson Plans","concern_label":"Lesson Plans","hr_action":"Yes","first_time":""},{"ts":"3/6/2025 15:32:27","month":"Mar 2025","yr":2025,"mo":3,"submitter":"Jenny Irwin, Asst. Program Manager","emp":"Genesis Troya","role":"Dual Role","support_type":"Coaching Support or feedback","delivery":"Email","site":"iLearn Charter School- Clifton ES","concern_type":"Lesson Plans","concern_label":"Lesson Plans","hr_action":"Yes","first_time":""},{"ts":"3/6/2025 15:35:30","month":"Mar 2025","yr":2025,"mo":3,"submitter":"Jenny Irwin, Asst. Program Manager","emp":"Genesis Troya","role":"Dual Role","support_type":"Reminder/Verbal Warning","delivery":"Email","site":"iLearn Charter School- Clifton ES","concern_type":"Other (please explain below)","concern_label":"Overage of hours on timecards in two back-to-back pay periods","hr_action":"Yes","first_time":""},{"ts":"3/6/2025 15:50:11","month":"Mar 2025","yr":2025,"mo":3,"submitter":"Jenny Irwin, Asst. Program Manager","emp":"Timothy Winn","role":"Dual Role","support_type":"Reminder/Verbal Warning","delivery":"Email","site":"iLearn Charter School- Bergen ES","concern_type":"Other (please explain below)","concern_label":"Keeping up with Tutors' Pearl Attendance","hr_action":"Yes","first_time":""},{"ts":"3/6/2025 16:48:30","month":"Mar 2025","yr":2025,"mo":3,"submitter":"Jenny Irwin, Asst. Program Manager","emp":"Timothy Winn","role":"Dual Role","support_type":"Coaching Support or feedback","delivery":"Email","site":"iLearn Charter School- Bergen ES","concern_type":"Lesson Plans","concern_label":"Lesson Plans","hr_action":"Yes","first_time":""},{"ts":"3/6/2025 16:53:24","month":"Mar 2025","yr":2025,"mo":3,"submitter":"Jenny Irwin, Asst. Program Manager","emp":"Timothy Winn","role":"Dual Role","support_type":"Other (please describe below)","delivery":"Email","site":"iLearn Charter School- Bergen ES","concern_type":"Other (please explain below)","concern_label":"Various: Pearl attendance & reminders, Lesson Plan Review","hr_action":"Yes","first_time":""},{"ts":"3/11/2025 13:54:32","month":"Mar 2025","yr":2025,"mo":3,"submitter":"Dr. Clemons- Program Manager","emp":"Huda Deweat","role":"Tutor","support_type":"Other (please describe below)","delivery":"Email","site":"iLearn Charter School- Bergen MS","concern_type":"Attendance","concern_label":"Attendance","hr_action":"No","first_time":"No"},{"ts":"3/11/2025 14:07:31","month":"Mar 2025","yr":2025,"mo":3,"submitter":"Dr. Clemons-Program Manager","emp":"Timothy Winn","role":"Dual Role","support_type":"Reminder/Verbal Warning","delivery":"Text Message","site":"iLearn Charter School- Bergen MS","concern_type":"Other (please explain below)","concern_label":"There has been many conversations regarding coverage being a priority- Tim was aware that he had two tutors out and one tutor leaving at noon. Instead of going to the middle school, he went to the elementary school instead of helping cover any sessions.","hr_action":"Yes","first_time":"No"},{"ts":"3/13/2025 0:52:04","month":"Mar 2025","yr":2025,"mo":3,"submitter":"Dr. Clemons- Program Manager","emp":"Nicole Cill","role":"Tutor","support_type":"Warning/Write Up to Follow","delivery":"Email","site":"iLearn Charter School- Clifton MS","concern_type":"Lesson Plans","concern_label":"Lesson Plans","hr_action":"No","first_time":"Yes"},{"ts":"3/13/2025 0:52:38","month":"Mar 2025","yr":2025,"mo":3,"submitter":"Dr. Clemons","emp":"Huda Deweat","role":"Tutor","support_type":"Warning/Write Up to Follow","delivery":"Email","site":"iLearn Charter School- Bergen MS","concern_type":"Attendance","concern_label":"Attendance","hr_action":"Yes","first_time":"No"},{"ts":"3/14/2025 10:57:22","month":"Mar 2025","yr":2025,"mo":3,"submitter":"Briana Nurse","emp":"Dylan Aiken","role":"Tutor","support_type":"Coaching Support or feedback","delivery":"In Person","site":"iLearn Charter School- Paterson ES","concern_type":"Overall Lesson Delivery","concern_label":"Overall Lesson Delivery","hr_action":"No","first_time":"Yes"},{"ts":"3/18/2025 16:10:38","month":"Mar 2025","yr":2025,"mo":3,"submitter":"Jenny Irwin, Asst. Program Mgr","emp":"Sara Gonzalez","role":"Tutor","support_type":"Reminder/Verbal Warning","delivery":"Email","site":"iLearn Charter School- Clifton ES","concern_type":"Lesson Plans","concern_label":"Lesson Plans","hr_action":"No","first_time":"Yes"},{"ts":"3/18/2025 16:17:21","month":"Mar 2025","yr":2025,"mo":3,"submitter":"Jenny Irwin, APM","emp":"Zahnick Underdue","role":"Tutor","support_type":"Reminder/Verbal Warning","delivery":"Email","site":"iLearn Charter School- Clifton MS","concern_type":"Lesson Plans","concern_label":"Lesson Plans","hr_action":"No","first_time":"Yes"},{"ts":"3/18/2025 16:35:32","month":"Mar 2025","yr":2025,"mo":3,"submitter":"Jenny Irwin, APM","emp":"Trushti Shah","role":"Tutor","support_type":"Other (please describe below)","delivery":"Email","site":"iLearn Charter School- Passaic ES","concern_type":"Lesson Plans","concern_label":"Lesson Plans","hr_action":"No","first_time":"Yes"},{"ts":"3/18/2025 16:38:39","month":"Mar 2025","yr":2025,"mo":3,"submitter":"Jenny Irwin, APM","emp":"Evan White","role":"Tutor","support_type":"Other (please describe below)","delivery":"Email","site":"iLearn Charter School- Passaic MS","concern_type":"Lesson Plans","concern_label":"Lesson Plans","hr_action":"No","first_time":"Yes"},{"ts":"3/18/2025 16:48:16","month":"Mar 2025","yr":2025,"mo":3,"submitter":"Jenny Irwin, APM","emp":"Coleen Piontkowskie","role":"Tutor","support_type":"Other (please describe below)","delivery":"Email","site":"iLearn Charter School- Paterson ES","concern_type":"Lesson Plans","concern_label":"Lesson Plans","hr_action":"No","first_time":"Yes"},{"ts":"3/18/2025 16:50:56","month":"Mar 2025","yr":2025,"mo":3,"submitter":"Jenny Irwin, APM","emp":"Carlos Jacho","role":"Tutor","support_type":"Reminder/Verbal Warning","delivery":"Email","site":"iLearn Charter School- Paterson ES","concern_type":"Lesson Plans","concern_label":"Lesson Plans","hr_action":"No","first_time":"Yes"},{"ts":"3/18/2025 16:52:41","month":"Mar 2025","yr":2025,"mo":3,"submitter":"Jenny Irwin, APM","emp":"Norelis Ramirez","role":"Tutor","support_type":"Reminder/Verbal Warning","delivery":"Email","site":"iLearn Charter School- Paterson ES","concern_type":"Lesson Plans","concern_label":"Lesson Plans","hr_action":"No","first_time":"Yes"},{"ts":"3/18/2025 16:54:10","month":"Mar 2025","yr":2025,"mo":3,"submitter":"Jenny Irwin, APM","emp":"Disan Singleton","role":"Tutor","support_type":"Warning/Write Up to Follow","delivery":"Email","site":"iLearn Charter School- Paterson MS","concern_type":"Lesson Plans","concern_label":"Lesson Plans","hr_action":"No","first_time":"No"},{"ts":"3/18/2025 16:56:01","month":"Mar 2025","yr":2025,"mo":3,"submitter":"Jenny Irwin, APM","emp":"Dylan Aiken","role":"Tutor","support_type":"Reminder/Verbal Warning","delivery":"Email","site":"iLearn Charter School- Paterson MS","concern_type":"Lesson Plans","concern_label":"Lesson Plans","hr_action":"No","first_time":"No"},{"ts":"3/18/2025 16:57:10","month":"Mar 2025","yr":2025,"mo":3,"submitter":"Jenny Irwin, APM","emp":"Shanice Jackman","role":"Tutor","support_type":"Reminder/Verbal Warning","delivery":"Email","site":"iLearn Charter School- Paterson MS","concern_type":"Lesson Plans","concern_label":"Lesson Plans","hr_action":"No","first_time":"Yes"},{"ts":"3/18/2025 17:56:01","month":"Mar 2025","yr":2025,"mo":3,"submitter":"Dr. Clemons- Program Manager","emp":"James DeJesus","role":"Tutor","support_type":"Warning/Write Up to Follow","delivery":"Email","site":"iLearn Charter School- Hudson MS","concern_type":"Lesson Plans","concern_label":"Lesson Plans","hr_action":"Yes","first_time":"Yes"},{"ts":"3/20/2025 21:25:41","month":"Mar 2025","yr":2025,"mo":3,"submitter":"Jenny Irwin, APM","emp":"Eliza Kabashi","role":"Tutor","support_type":"Reminder/Verbal Warning","delivery":"Email","site":"iLearn Charter School- Hudson MS","concern_type":"Lesson Plans","concern_label":"Lesson Plans","hr_action":"No","first_time":"Yes"},{"ts":"3/21/2025 9:51:54","month":"Mar 2025","yr":2025,"mo":3,"submitter":"Rene Lintz Program Assistant","emp":"Durel Freeman","role":"Tutor","support_type":"Other (please describe below)","delivery":"Email","site":"iLearn Charter School- Bergen ES","concern_type":"Other (please explain below)","concern_label":"Regarding the technology, the tablets were deemed unusable, which unfortunately resulted in a lower trade-in value than expected.","hr_action":"Yes","first_time":"Yes"},{"ts":"3/27/2025 13:59:35","month":"Mar 2025","yr":2025,"mo":3,"submitter":"Dr. Clemons","emp":"Huda Deweat","role":"Tutor","support_type":"Warning/Write Up to Follow","delivery":"Email","site":"iLearn Charter School- Bergen MS","concern_type":"Attendance","concern_label":"Attendance","hr_action":"Yes","first_time":"No"},{"ts":"4/21/2025 9:37:39","month":"Apr 2025","yr":2025,"mo":4,"submitter":"Dr. Clemons","emp":"Zahnik Underdue","role":"Tutor","support_type":"Warning/Write Up to Follow","delivery":"Text Message","site":"iLearn Charter School- Clifton MS","concern_type":"Attendance","concern_label":"Attendance","hr_action":"Yes","first_time":"Yes"},{"ts":"4/21/2025 10:09:47","month":"Apr 2025","yr":2025,"mo":4,"submitter":"Dr. Clemons","emp":"Brandon (Bergen Middle Tutor)","role":"Tutor","support_type":"Warning/Write Up to Follow","delivery":"Email","site":"iLearn Charter School- Bergen MS","concern_type":"Other (please explain below)","concern_label":"Incident on Site","hr_action":"Yes","first_time":"Yes"},{"ts":"4/25/2025 11:21:11","month":"Apr 2025","yr":2025,"mo":4,"submitter":"Tierney Tittermary/APM","emp":"Robert Whitman","role":"Dual Role","support_type":"Reminder/Verbal Warning","delivery":"Email","site":"Gloucester Township School District- Erial Elementary School","concern_type":"Other (please explain below)","concern_label":"Incomplete progress reports. Despite four reminders\u2014including emails, text messages, and in-person conversations\u2014one tutor still had not submitted a completed progress report prior to Gloucester's program ending on 4/24","hr_action":"Yes","first_time":"Yes"},{"ts":"4/28/2025 11:00:07","month":"Apr 2025","yr":2025,"mo":4,"submitter":"Andrea Brooks/PM","emp":"Robert Whitman","role":"Dual Role","support_type":"Warning/Write Up to Follow","delivery":"Email","site":"Gloucester Township School District- Erial Elementary School","concern_type":"Other (please explain below)","concern_label":"Communication with the Program Management Team","hr_action":"Yes","first_time":"Yes"},{"ts":"4/30/2025 12:53:12","month":"Apr 2025","yr":2025,"mo":4,"submitter":"JLC","emp":"Robert Whitman","role":"Dual Role","support_type":"Coaching Support or feedback","delivery":"Email","site":"Gloucester Township School District- Erial Elementary School","concern_type":"Other (please explain below)","concern_label":"Rob was contacted about not adding comments to plans, and while it was done for a while, it was an area of weakness for Rob this school year.","hr_action":"Yes","first_time":"Yes"},{"ts":"4/30/2025 21:42:53","month":"Apr 2025","yr":2025,"mo":4,"submitter":"Tierney Tittermary","emp":"Robert Whitman","role":"Dual Role","support_type":"Observation","delivery":"Email","site":"Gloucester Township School District- Erial Elementary School","concern_type":"Other (please explain below)","concern_label":"Other (please explain below)","hr_action":"Yes","first_time":"No"},{"ts":"5/16/2025 14:55:35","month":"May 2025","yr":2025,"mo":5,"submitter":"Bertin Lefkovic","emp":"Claudia Barbieri","role":"Dual Role","support_type":"Other (please describe below)","delivery":"Phone","site":"Gloucester Township School District- Loring Flemming Elementary School","concern_type":"Timecard incident","concern_label":"Timecard incident","hr_action":"Yes","first_time":"Yes"},{"ts":"5/20/2025 10:44:30","month":"May 2025","yr":2025,"mo":5,"submitter":"Tierney Tittermary/APM","emp":"Dylan Sepulveda","role":"Tutor","support_type":"Other (please describe below)","delivery":"Email","site":"Hamilton Township School District- Mercerville Elementary School","concern_type":"Attendance","concern_label":"Attendance","hr_action":"No","first_time":"Yes"},{"ts":"6/6/2025 12:16:14","month":"Jun 2025","yr":2025,"mo":6,"submitter":"Andrea Brooks- Program Manager","emp":"Erica Mela","role":"Tutor","support_type":"Other (please describe below)","delivery":"Email","site":"Salem City School District- Salem Middle School (3-5)","concern_type":"Attendance","concern_label":"Attendance","hr_action":"Yes","first_time":"Yes"},{"ts":"6/27/2025 10:38:10","month":"Jun 2025","yr":2025,"mo":6,"submitter":"Tierney Tittermary/APM","emp":"Tabitha Parris","role":"Dual Role","support_type":"Other (please describe below)","delivery":"In Person","site":"Salem City School District- Salem - John Fenwick Academy (K-2)","concern_type":"Other (please explain below)","concern_label":"I only became aware that additional Hand2Mind pre-assessments focused on letter recognition, sounds, and phonics were being administered to Kindergarten and first-grade scholars when I came onsite to drop off materials and check on pre-assessment progress.","hr_action":"No","first_time":"Yes"},{"ts":"6/27/2025 10:53:26","month":"Jun 2025","yr":2025,"mo":6,"submitter":"Tierney Tittermary/APM","emp":"Katie Hennigan","role":"Dual Role","support_type":"Other (please describe below)","delivery":"Email","site":"Salem City School District- Salem Middle School (3-5)","concern_type":"Other (please explain below)","concern_label":"We only became aware of the change Katie made to the oral fluency assessment after I followed up with her on May 13th, requesting that she send scanned copies or photos of the paper-based Grade 3 oral fluency assessments for data collection purposes. In response, she replied with the email mentioned above, stating that she had forgotten to inform us that she had used a different assessment for Grade 3 oral fluency.","hr_action":"No","first_time":"Yes"},{"ts":"7/10/2025 11:59:31","month":"Jul 2025","yr":2025,"mo":7,"submitter":"Katharine Samberg-Lawrence","emp":"Queen Beaute","role":"Tutor","support_type":"Other (please describe below)","delivery":"In Person","site":"Global Leadership Academy - GLA- West","concern_type":"Other (please explain below)","concern_label":"We had a tutor who had a migraine and was struggling. She has one student. Another tutor had all scholars absent, and I requested she support the tutor with the migraine. The sick tutor soon after requested to go home and I gave her permission. Queen, the tutor who's students were absent, then sent a text stating she had agreed to support, not provide coverage and she did not want to cover the afternoon session. I messaged my supervisors about it for their feedback on how to best address it.   I originally made arrangements for the scholar to work with a tutoring group, so that Queen would not have to cover, then was informed by my supervisor that they were notifying Queen that if she had no scholars and was unwilling to cover the other tutor, she was expected to clock out and go home. My supervisor (Andrea) called Queen to inform her of this, then notified me the conversation did not go well.   Queen then came to request the lesson plans of the absent tutor. I provided her the plans, apologized that I had not been clear that the support could turn into coverage, but also reminder her that at previous meetings I have told all the tutors that if your scholars are absent, come speak to me so I can assign you to support or cover elsewhere as needed. Queen was clearly agitated and mentioned she did not appreciate how the call with Andrea went. I told her that Andrea was at another site assisting with assessments so patience would be greatly appreciated. She then left and pulled the scholar to tutor them without incident.","hr_action":"Yes","first_time":"Yes"},{"ts":"7/11/2025 12:34:21","month":"Jul 2025","yr":2025,"mo":7,"submitter":"Andrea Brooks, PM","emp":"Queen Beaute","role":"Tutor","support_type":"Reminder/Verbal Warning","delivery":"Phone","site":"Global Leadership Academy - GLA- West","concern_type":"Other (please explain below)","concern_label":"Queen's unwillingness to cover when a colleague was ill. Overall attitude and unprofessionalism.","hr_action":"Yes","first_time":"Yes"},{"ts":"7/14/2025 8:15:18","month":"Jul 2025","yr":2025,"mo":7,"submitter":"Tierney Tittermary/ APM","emp":"Mattelyn Bullock","role":"Tutor","support_type":"Other (please describe below)","delivery":"Email","site":"Global Leadership Academy - GLA- West","concern_type":"Attendance","concern_label":"Attendance","hr_action":"No","first_time":"Yes"},{"ts":"7/16/2025 11:42:45","month":"Jul 2025","yr":2025,"mo":7,"submitter":"Katharine Samberg-Lawrence","emp":"Katharine Samberg-Lawrence","role":"Dual Role","support_type":"Other (please describe below)","delivery":"Text Message","site":"Global Leadership Academy - GLA- West","concern_type":"Other (please explain below)","concern_label":"This involved an issue between two tutors who share the same tutoring space, Queen (tutor #1) and Mattie (Tutor #2). Today we starting the final assessments for our program. At 9:58 AM Queen sent a text in the group chat which includes all GLAW tutors asking whether or not it was appropriate for tutors to help their scholars with the assessment. She then sent a private message stating that Mattie had with the first assessment, and with the second assessment, was helping her student and it did not seem right.   I responded in the group chat that we could troubleshoot, encourage, and remind students how to start the steps, but we would not assist them in completing any problems. I then responded to Queen thank you for letting me know, and that she did not need to worry about the assessments being compared to see which tutor saw the most improvement as many factors are considered. Queen reiterated that she was worried the scholar would get a higher score than they deserved and this was essentially a lie. I informed her I would talk to Mattie about it to clarify.   I then both texted directly and spoke to Mattie stating that I wanted to make sure she knew she what she could and could not do during the assessments. Mattie was clearly upset, and stated she did not understand why Queen was watching her this way and that it felt like Queen was deliberately looking for things to report. I reiterated not to worry, that I trusted her to know the line between setting her scholar up for a successful completion and assisting them too much, and that Queen may not be aware of the way we use the assessments, so Mattie should not let her opinion bother her. I also offered to move Mattie into the room across the hall for the remainder of the day so she would not feel like she was being observed and reported on. Mattie initially turned me down and returned to her room.   As short period later, Queen texted that she heard Mattie saying over her headphones that she would \"get back at her\" and was about to become \"unprofessional.\" Queen was surprised at her annoyance as she had not said anything directly to Mattie (though I reminded Queen she texted her question to the entire group). The GLAW staff was not in the room, nor was I, so I cannot confirm what Mattie did or did not say. I requested they give each other space as much as possible and focus on their own scholars and assessments. Queen then texted that she could not give Mattie space in the same room especially as she had \"all but threatened her.\" I asked if Mattie said something directly too her or it was just what she previous overheard (just that), and I offered that Queen could move into the room across the hall. Queen responded that Mattie should have to move because she issued the threat and only had one scholar. I responded stating I would contact my supervisor and then come to rearrange them in different rooms.   I contacted Andrea, informed her of the developments. Andrea encouraged me to have Queen move as she was the one taking issue, but I requested to move Mattie because I believed she would move without incident and would remain professional. I then texted Mattie requesting she move and informed her it was by no means a punishment, and that I had made it clear to my supervisors that she was being professional throughout the exchange from all the behavior I had seen, and her handling of the assessment itself.","hr_action":"Yes","first_time":"No"},{"ts":"8/7/2025 12:40:44","month":"Aug 2025","yr":2025,"mo":8,"submitter":"Tierney Tittermary/APM","emp":"Queen Beaute","role":"Tutor","support_type":"Other (please describe below)","delivery":"Email","site":"Lawrence Township- Slackwood Elementary","concern_type":"Attendance","concern_label":"Attendance","hr_action":"Yes","first_time":"No"},{"ts":"9/18/2025 12:53:33","month":"Sep 2025","yr":2025,"mo":9,"submitter":"Taneisha Clemons","emp":"Takiyah Jackson","role":"Dual Role","support_type":"Warning/Write Up to Follow","delivery":"Text Message","site":"iLearn Charter School- Passaic ES","concern_type":"Other (please explain below)","concern_label":"In addition to missing training this is to document an email thread.","hr_action":"Yes","first_time":"Yes"},{"ts":"9/18/2025 13:42:26","month":"Sep 2025","yr":2025,"mo":9,"submitter":"Anne Lee","emp":"Takiyah Jackson","role":"Dual Role","support_type":"Other (please describe below)","delivery":"Email","site":"iLearn Charter School- Passaic MS","concern_type":"Other (please explain below)","concern_label":"The responses that Takiyah to every single one of my emails seemed confrontational. She has alluded that I held some biases against her and her work ethics. She felt that I gave information about a question that she did not ask and felt that was unnecessary on my part and felt offended and attacked with my response. I responded with an apology for any misunderstandings on my end and explained my responses to her. She emailed back with more accusations and assumptions about my character and her past experiences with dealing with a workforce that has biases. The thread continued to grow and the emails seemed to get more intensive that Taneisha stepped in to mitigate and de-escalate the situation. Takiyah continued to respond in the thread with more emails concerning how needs and her feelings about what transpired in this thread and about her past work history, where she has felt similarly.","hr_action":"No","first_time":"Yes"},{"ts":"10/17/2025 9:30:30","month":"Oct 2025","yr":2025,"mo":10,"submitter":"T. Clemons-Program Manager","emp":"James DeJesus","role":"Tutor","support_type":"Warning/Write Up to Follow","delivery":"Email","site":"iLearn Charter School- Hudson MS","concern_type":"Lesson Plans","concern_label":"Lesson Plans","hr_action":"No","first_time":"Yes"},{"ts":"10/17/2025 9:40:26","month":"Oct 2025","yr":2025,"mo":10,"submitter":"T.Clemons","emp":"Disan Singleton","role":"Tutor","support_type":"Reminder/Verbal Warning","delivery":"Email","site":"iLearn Charter School- Passaic MS","concern_type":"Other (please explain below)","concern_label":"Ending Session Early, Completing Student Survey on his own (when advised not) incomplete attendance","hr_action":"Yes","first_time":"No"},{"ts":"10/17/2025 9:51:04","month":"Oct 2025","yr":2025,"mo":10,"submitter":"T.Clemons","emp":"Disan Singleton","role":"Tutor","support_type":"Warning/Write Up to Follow","delivery":"Email","site":"iLearn Charter School- Paterson MS","concern_type":"Lesson Plans","concern_label":"Lesson Plans","hr_action":"No","first_time":"No"},{"ts":"10/20/2025 12:12:20","month":"Oct 2025","yr":2025,"mo":10,"submitter":"Lakeeda Sessoms (Site Leader/Instructional Coach)","emp":"Disan Singleton","role":"Tutor","support_type":"Warning/Write Up to Follow","delivery":"In Person","site":"iLearn Charter School- Passaic MS","concern_type":"Other (please explain below)","concern_label":"Timeliness of Deliverables","hr_action":"No","first_time":"No"},{"ts":"10/20/2025 12:18:13","month":"Oct 2025","yr":2025,"mo":10,"submitter":"Lakeeda Sessoms (Site Leader/Instructional Coach)","emp":"Disan Singleton","role":"Tutor","support_type":"Warning/Write Up to Follow","delivery":"Email","site":"iLearn Charter School- Passaic MS","concern_type":"Other (please explain below)","concern_label":"Lack of Communication/ Didn't Prep as outlined in our first conversation that took place on October 3, 2025","hr_action":"No","first_time":"No"},{"ts":"10/20/2025 12:25:58","month":"Oct 2025","yr":2025,"mo":10,"submitter":"Lakeeda Sessoms (Site Leader/ Instructional Coach)","emp":"Disan Singleton","role":"Tutor","support_type":"Other (please describe below)","delivery":"Email","site":"iLearn Charter School- Passaic MS","concern_type":"Other (please explain below)","concern_label":"Tone Concerns","hr_action":"No","first_time":"No"},{"ts":"10/21/2025 19:34:32","month":"Oct 2025","yr":2025,"mo":10,"submitter":"Dr. T. Clemons / Program Manager","emp":"Disan Singleton","role":"Tutor","support_type":"Reminder/Verbal Warning","delivery":"Email","site":"iLearn Charter School- Paterson MS","concern_type":"Other (please explain below)","concern_label":"Late Procedures","hr_action":"Yes","first_time":"No"},{"ts":"10/23/2025 9:26:34","month":"Oct 2025","yr":2025,"mo":10,"submitter":"T. Clemons/Program Manager","emp":"James DeJesus","role":"Tutor","support_type":"Warning/Write Up to Follow","delivery":"Email","site":"iLearn Charter School- Hudson MS","concern_type":"Lesson Plans","concern_label":"Lesson Plans","hr_action":"No","first_time":"No"},{"ts":"10/23/2025 12:17:52","month":"Oct 2025","yr":2025,"mo":10,"submitter":"T Clemons Program Manager","emp":"Michelle Kim","role":"Tutor","support_type":"Reminder/Verbal Warning","delivery":"Email","site":"iLearn Charter School- Hudson MS","concern_type":"Other (please explain below)","concern_label":"Email sent to Admin","hr_action":"Yes","first_time":"Yes"},{"ts":"10/23/2025 16:50:35","month":"Oct 2025","yr":2025,"mo":10,"submitter":"Lakeeda Sessoms (Site Leader/Instructional Coach)","emp":"Sharon Kessel","role":"Tutor","support_type":"Reminder/Verbal Warning","delivery":"In Person","site":"iLearn Charter School- Paterson ES","concern_type":"Other (please explain below)","concern_label":"During my meeting with Silk City\u2019s Leadership Team, they expressed concerns regarding Mrs. Kessel\u2019s professionalism. The team shared that they received a parent complaint in which the parent\u2019s child stated that Mrs. Kessel allegedly said, \u201cShe has more authority over him than his parents because he is in their care,\u201d and also told the student to \u201cact his age and stay in a child\u2019s place.\u201d The parent was reportedly upset by this interaction, and the leadership team was surprised by the comment.  Additionally, Mrs. Parisi mentioned that after granting Mrs. Kessel permission to lead her small group in another class, Mrs. Kessel made a remark saying, \u201cOh, now you trust me.\u201d Mrs. Parisi noted that this comment \"rubbed her the wrong way.\"  Overall, the leadership team expressed concerns about Mrs. Kessel\u2019s professionalism.","hr_action":"No","first_time":"Yes"},{"ts":"11/11/2025 15:23:40","month":"Nov 2025","yr":2025,"mo":11,"submitter":"Tierney Tittermary/ APM","emp":"Micaela Wilkerson","role":"Tutor","support_type":"Coaching Support or feedback","delivery":"In Person","site":"Haddon Township School District-Van Sciver Elementary School","concern_type":"Lesson Plans","concern_label":"Lesson Plans","hr_action":"No","first_time":"Yes"},{"ts":"11/11/2025 16:05:34","month":"Nov 2025","yr":2025,"mo":11,"submitter":"Tierney Tittermary/ APM","emp":"Micaela Wilkerson","role":"Tutor","support_type":"Other (please describe below)","delivery":"Phone","site":"Haddon Township School District-Van Sciver Elementary School","concern_type":"Attendance","concern_label":"Attendance","hr_action":"No","first_time":"No"},{"ts":"11/11/2025 16:18:21","month":"Nov 2025","yr":2025,"mo":11,"submitter":"Tierney Tittermary/ APM","emp":"Micaela Wilkerson","role":"Tutor","support_type":"Other (please describe below)","delivery":"Text Message","site":"Haddon Township School District-Van Sciver Elementary School","concern_type":"Attendance","concern_label":"On 9/22, we held a scheduled virtual meet-and-greet session via Zoom for all Haddon Township tutors to attend prior to our site visits. This meeting had been communicated several weeks in advance. Caela did not attend the session and did not notify anyone beforehand that she would be absent. While the meeting was in progress, Tierney texted Caela to check on her whereabouts. Caela responded that she had completely forgotten about the meeting and was on her way to her Mom-Mom\u2019s house in Ventnor.  The second situation occurred on Thursday evening, 10/17, when Caela called out of work for her scheduled tutoring sessions the next day, stating that she had forgotten about a doctor\u2019s appointment the following morning that required travel and could not be rescheduled because she needed to obtain a prescription in person. Tierney asked if she would still be able to attend any of her tutoring sessions that day, and Caela said no. Tierney then instructed her to email all of her teachers, principals, Andrea, and Tierney to ensure everyone was informed of her absence.  By 7:30 a.m. the following morning, Caela still had not sent any communication. Tierney texted her again to remind her to reach out to her teachers and principals before her scheduled sessions. Caela eventually sent the emails after 8:00 a.m.","hr_action":"Yes","first_time":"No"},{"ts":"11/12/2025 18:48:21","month":"Nov 2025","yr":2025,"mo":11,"submitter":"Taneisha Clemons- Program Manager","emp":"Michelle Kim","role":"Tutor","support_type":"Reminder/Verbal Warning","delivery":"Email","site":"iLearn Charter School- Hudson MS","concern_type":"Other (please explain below)","concern_label":"Irate email communication to school admin","hr_action":"No","first_time":"Yes"},{"ts":"11/12/2025 18:57:23","month":"Nov 2025","yr":2025,"mo":11,"submitter":"Taneisha Clemons- Program Manager","emp":"Michelle Kim","role":"Tutor","support_type":"Warning/Write Up to Follow","delivery":"In Person","site":"iLearn Charter School- Hudson MS","concern_type":"Other (please explain below)","concern_label":"Email Commuication","hr_action":"Yes","first_time":"No"},{"ts":"11/20/2025 15:45:09","month":"Nov 2025","yr":2025,"mo":11,"submitter":"Sharlene Rahim","emp":"Sharlene Rahim","role":"Tutor","support_type":"Reminder/Verbal Warning","delivery":"In Person","site":"iLearn Charter School- Passaic MS","concern_type":"Other (please explain below)","concern_label":"Lesson Plans and Behavioral Concerns","hr_action":"No","first_time":"Yes"},{"ts":"11/26/2025 10:17:18","month":"Nov 2025","yr":2025,"mo":11,"submitter":"Ms. Sessoms (Site Leader/Instructional Coach)","emp":"Disan Singleton","role":"Tutor","support_type":"Warning/Write Up to Follow","delivery":"In Person","site":"iLearn Charter School- Paterson MS","concern_type":"Other (please explain below)","concern_label":"Please advise how this incident should be classified.","hr_action":"No","first_time":"No"},{"ts":"11/26/2025 11:39:28","month":"Nov 2025","yr":2025,"mo":11,"submitter":"Ms. Sessoms (Site Leader/Instructional Coach)","emp":"Sharon Kessle","role":"Tutor","support_type":"Other (please describe below)","delivery":"Email","site":"iLearn Charter School- Paterson ES","concern_type":"Other (please explain below)","concern_label":"Professionalism Concern","hr_action":"No","first_time":"No"},{"ts":"12/3/2025 1:00:53","month":"Dec 2025","yr":2025,"mo":12,"submitter":"Dr. Taneisha Clemons- Program Manager","emp":"Bryanna Matos","role":"Tutor","support_type":"Warning/Write Up to Follow","delivery":"Email","site":"iLearn Charter School- Clifton MS","concern_type":"Attendance","concern_label":"Attendance","hr_action":"No","first_time":"Yes"},{"ts":"12/3/2025 10:29:57","month":"Dec 2025","yr":2025,"mo":12,"submitter":"Tierney Tittermary/ APM","emp":"Laura Gallucci","role":"Tutor","support_type":"Other (please describe below)","delivery":"Email","site":"Global Leadership Academy - GLA- West","concern_type":"Lesson Plans","concern_label":"Laura did not complete her lesson plans for 12/2, which was the only tutoring day for GLAW this week before they begin their winter intersession break for over a month. When I checked lesson plans on 12/2, I reached out to her site leader, Danielle Hallahan, so she could follow up with Laura before tutoring began at 4:00 pm. Danielle did email her.  When I checked again today (12/3), the lesson plans were still not completed, so I followed up with Danielle to see if Laura had responded to her email or spoken with her in person about the missing plans. I'm currently waiting to hear back from Danielle, and then I will reach out to Laura directly to reiterate that her lesson plans need to be added to the lesson plan template, especially since she has scheduled prep time to complete them.","hr_action":"No","first_time":"Yes"},{"ts":"12/4/2025 0:08:16","month":"Dec 2025","yr":2025,"mo":12,"submitter":"Taneisha Clemons","emp":"Kimara Ramsey","role":"Dual Role","support_type":"Coaching Support or feedback","delivery":"Email","site":"iLearn Charter School- Hudson MS","concern_type":"Other (please explain below)","concern_label":"Other (please explain below)","hr_action":"No","first_time":"Yes"},{"ts":"12/4/2025 0:17:27","month":"Dec 2025","yr":2025,"mo":12,"submitter":"Taneisha Clemons","emp":"Kimara Ramsey","role":"Dual Role","support_type":"Warning/Write Up to Follow","delivery":"Email","site":"iLearn Charter School- Hudson MS","concern_type":"Other (please explain below)","concern_label":"Other (please explain below)","hr_action":"No","first_time":"No"},{"ts":"12/4/2025 18:50:20","month":"Dec 2025","yr":2025,"mo":12,"submitter":"Colleen Elam","emp":"Shabnam Mustari","role":"Tutor","support_type":"Reminder/Verbal Warning","delivery":"In Person","site":"Central Jersey College Prep","concern_type":"Attendance","concern_label":"Attendance","hr_action":"First Write Up - Employee Progress Report","first_time":"Yes"},{"ts":"12/9/2025 14:47:41","month":"Dec 2025","yr":2025,"mo":12,"submitter":"Andrea Brooks","emp":"Fasiha Shaikh","role":"Tutor","support_type":"Reminder/Verbal Warning","delivery":"Phone","site":"Hamilton Township School District- Kuser Elementary School","concern_type":"Other (please explain below)","concern_label":"Sra Peake, the principal at Kuser, informed me Fasiha has complained to her and the vice principal several times upon receiving her schedule that she does not have enough time in between each tutoring session.  Fasiha has also asked the principal to switch schedules with the other tutor.  Upon hearing this, I spoke with Fasiha on the phone, reminding her she should speak to Marta her site leader with any questions or concerns, and that Marta is her first line of defense.  If she is unsatisfied with Marta's response then the program management team would be her second line of defense. At no point should she be discussing scheduling concerns with the principal.","hr_action":"On Watch","first_time":"Yes"},{"ts":"12/10/2025 9:28:09","month":"Dec 2025","yr":2025,"mo":12,"submitter":"Tierney Tittermary/ APM","emp":"Fasiha Shaikh","role":"Tutor","support_type":"Additional Coaching Support","delivery":"Email","site":"Hamilton Township School District- Kuser Elementary School","concern_type":"Lesson Plans","concern_label":"Lesson Plans","hr_action":"On Watch","first_time":"Yes"},{"ts":"12/15/2025 9:11:51","month":"Dec 2025","yr":2025,"mo":12,"submitter":"Tanya Israel-Sainthilaire","emp":"Sharlene Rahim","role":"Tutor","support_type":"Reminder/Verbal Warning","delivery":"Email","site":"iLearn Charter School- Passaic MS","concern_type":"Other (please explain below)","concern_label":"Other (please explain below)","hr_action":"First Write Up - Employee Progress Report","first_time":"No"},{"ts":"12/17/2025 16:24:49","month":"Dec 2025","yr":2025,"mo":12,"submitter":"Marta Reyes-IC/SC","emp":"Fasiha Shaikh","role":"Tutor","support_type":"Other (please describe below)","delivery":"In Person","site":"Hamilton Township School District- Kuser Elementary School","concern_type":"Timecard incident","concern_label":"Tutor wanted to address her timecard grievance with Ms. Brooks' supervisor.","hr_action":"On Watch","first_time":"Yes"},{"ts":"12/18/2025 17:33:03","month":"Dec 2025","yr":2025,"mo":12,"submitter":"Andrea Brooks- PM","emp":"Fasiha Shaikh","role":"Tutor","support_type":"Other (please describe below)","delivery":"Phone","site":"Hamilton Township School District- Kuser Elementary School","concern_type":"Other (please explain below)","concern_label":"Fasiha is very unhappy about her schedule and being asked to accurately reflect her work time on her timecard. She began speaking to Lilia in the teacher's lounge with district employees present negatively about Andrea her PM and NJTC. She encouraged Lilia to call and email complaints to Andrea and Jess. She continued to speak loudly and in earshot of district employees despite Lilia asking her to stop talking to her about it.","hr_action":"Recommended Termination","first_time":"Yes"},{"ts":"12/18/2025 20:02:30","month":"Dec 2025","yr":2025,"mo":12,"submitter":"Tierney Tittermary","emp":"Fasiha Shaikh","role":"Tutor","support_type":"Reminder/Verbal Warning","delivery":"In Person","site":"Hamilton Township School District- Kuser Elementary School","concern_type":"Timecard incident","concern_label":"Timecard incident","hr_action":"On Watch","first_time":"No"},{"ts":"1/5/2026 10:55:53","month":"Jan 2026","yr":2026,"mo":1,"submitter":"Marta Reyes SC/IC","emp":"Fasiha Shaikh","role":"Tutor","support_type":"Reminder/Verbal Warning","delivery":"Text Message","site":"Hamilton Township School District- Kuser Elementary School","concern_type":"Other (please explain below)","concern_label":"Call out protocols","hr_action":"On Watch","first_time":"No"},{"ts":"1/6/2026 10:12:08","month":"Jan 2026","yr":2026,"mo":1,"submitter":"Marta Reyes, IC/SC","emp":"Fasiha Shaikh","role":"Tutor","support_type":"Reminder/Verbal Warning","delivery":"Text Message","site":"Hamilton Township School District- Kuser Elementary School","concern_type":"Other (please explain below)","concern_label":"Failure to follow call-out protocols","hr_action":"On Watch","first_time":"No"},{"ts":"1/12/2026 16:12:19","month":"Jan 2026","yr":2026,"mo":1,"submitter":"Taneisha Clemons- Program Manager","emp":"Sharlene Rahim","role":"Tutor","support_type":"Other (please describe below)","delivery":"In Person","site":"iLearn Charter School- Passaic MS","concern_type":"Other (please explain below)","concern_label":"Other (please explain below)","hr_action":"PGP","first_time":"No"},{"ts":"1/14/2026 21:45:13","month":"Jan 2026","yr":2026,"mo":1,"submitter":"Tierney Tittermary (Assistant Program Manager)","emp":"Angelica Werts","role":"Tutor","support_type":"Other (please describe below)","delivery":"In Person","site":"First Philadelphia Prep Charter School (American Paradigm)","concern_type":"Other (please explain below)","concern_label":"- Communication: She was very difficult to engage, barely responded to questions, and spent much of the time sitting in a corner, not speaking.  - Punctuality and Introduction: She arrived over an hour late and was unwilling to provide her name until Tierney repeatedly asked. Despite this, she made an effort to welcome her and express our appreciation for her help.  - Unprofessional Behavior: She was wearing a jacket with the tags still attached and disappeared twice during the day\u2014once for 15 minutes and once for nearly 30 minutes.  - Incident During Tour: She disappeared while the principal was giving us a tour. Nic (another tutor) eventually found her, but she did not respond when Tierney mentioned we were looking for her. She then began holding her side as if she were injured, though she claimed to be fine when asked. The principal noticed the behavior and professionally offered the use of the elevator.  -Lack of Engagement with Scholars: She also did not engage with scholars at all during the time we were testing them and continued to sit in the corner while everyone else walked around to assist and check in on progress.  -Disengaged in Mid-Discussion: While Tierney was discussing lesson planning and reviewing data, Angelica gathered her belongings and began to leave. This was not abrupt, but it was unexpected, as I was addressing both her and Nic (the other tutor) during the conversation. I stopped her and asked her not to head out yet since we were discussing lesson planning. She appeared confused and said, \u201cOh, I need to stay?\u201d I confirmed that she did, explaining that lesson plans are an important part of her role and something she needs to know how to complete as a tutor.","hr_action":"On Watch","first_time":"Yes"},{"ts":"1/15/2026 13:00:53","month":"Jan 2026","yr":2026,"mo":1,"submitter":"Jessica Kelly, Exec Dir Programs","emp":"Angelica Werts","role":"Tutor","support_type":"Additional Coaching Support","delivery":"Email","site":"First Philadelphia Prep Charter School (American Paradigm)","concern_type":"Other (please explain below)","concern_label":"In-person interaction on day two of diagnostics","hr_action":"On Watch","first_time":"Yes"},{"ts":"1/20/2026 12:07:18","month":"Jan 2026","yr":2026,"mo":1,"submitter":"Colleen Elam","emp":"Pooja Tyagi","role":"Tutor","support_type":"Reminder/Verbal Warning","delivery":"In Person","site":"Central Jersey College Prep","concern_type":"Lesson Plans","concern_label":"Lesson Plans","hr_action":"On Watch","first_time":"Yes"},{"ts":"1/20/2026 12:09:13","month":"Jan 2026","yr":2026,"mo":1,"submitter":"Colleen Elam (Instructional Coach/Site Leader)","emp":"Naima Boutria","role":"Tutor","support_type":"Reminder/Verbal Warning","delivery":"In Person","site":"Central Jersey College Prep","concern_type":"Lesson Plans","concern_label":"Lesson Plans","hr_action":"On Watch","first_time":"Yes"},{"ts":"1/22/2026 13:29:54","month":"Jan 2026","yr":2026,"mo":1,"submitter":"Lakeeda Sessoms","emp":"Jeff Wilder","role":"Tutor","support_type":"Other (please describe below)","delivery":"In Person","site":"Paterson Charter School Science & Tech.- PCSST 4-7 Campus","concern_type":"Lesson Plans","concern_label":"Mr. Wilder shared that he feels the workload is too much and that he feels like he was thrown into lesson planning. This is despite the fact that I have met with him at least three times to review i-Ready, how to link lesson plans to the template, and after I created an example lesson plan showing exactly what is expected during a one to one check in. I also provided him with feedback on lesson plans.  He said he doesn't like deadlines and feels they will not work for him. He also said that he does not feel supported. He also went on today if he knew the workload would've been like this, he could've just became a teacher instead. Based on how much help he needs and the quality of the work he has submitted, it seems that he has not written lesson plans before. He also shared that he was unhappy with mixed messages about notifying staff if make-up days can happen on Fridays, stating that he received two different messages from Ms. Petty and during training. He also said that he does not think this job is the right fit for him. This conversation happened after we discussed that his lesson plans were not uploaded by the 5:00 p.m. deadline, and I told him I would go over how to create lesson plans with him again today at 9:40 a.m. However, Mr. Wilder stated he was overwhelmed and preferred not to meet at that time. Instead he wanted to prepare for the upcoming lesson. Unfortunately, that was the only time to meet with Mr. Wilder to provide more lesson plan support. As of now, his day 2 plans are not uploaded.   Additionally, the ADA mentioned that a parent called the ADO to report that her student stated that Mr. Wilder smelled of cigarette smoke and the aroma is so strong.The mom requested that her scholar be pulled from the his tutoring group. This conversation was not had with him yet.","hr_action":"On Watch","first_time":"Yes"},{"ts":"1/26/2026 15:26:04","month":"Jan 2026","yr":2026,"mo":1,"submitter":"Jenny Irwin, APM","emp":"Ted Mills","role":"Sub Tutor","support_type":"Other (please describe below)","delivery":"Email","site":"Hoboken Dual Language Charter School (HOLA) - ES","concern_type":"Other (please explain below)","concern_label":"This was emailed on 1/22/26 from the HoLa ES Principal: \"I would like to share a concern that occurred at the end of the day with the second group at the elementary school. Mr Mills appeared at my office after I had picked up the students and walked them and him to the classroom where he was going to tutor. He asked me if I could redirect him back to the classroom.  I quickly asked him where the students were and he said he left them in the classroom [unsupervised] because he had to step out to get copy paper-the laptops were not used.   We quickly returned to the classroom, and I explained students are never to be left unsupervised.  Thankfully there was no incident and students were patiently waiting for the tutor to return.  He mentioned he was still getting used to things.  I ask that this substitute not be sent back to HoLa Elementary.\"","hr_action":"On Watch","first_time":"Yes"},{"ts":"1/26/2026 15:53:52","month":"Jan 2026","yr":2026,"mo":1,"submitter":"Tierney Tittermary/ APM","emp":"Alexandra Cristescu","role":"Tutor","support_type":"Reminder/Verbal Warning","delivery":"Email","site":"Penns Grove - Field Street Elementary","concern_type":"Other (please explain below)","concern_label":"Alex has been repeatedly reaching out to me via text and email when she does not receive answers as quickly as she expects. This concerns lesson plans, i-Ready scholar names, and the Pearl schedule. For instance, on Friday, 1/23, at 4:19 PM, she sent a very lengthy text while I was out of the office. I did not respond at that time due to being away. On Sunday, 1/25, she sent me another lengthy text message at 2:38 PM and simultaneously sent the exact same message via email. Additionally, she is not following proper protocol by copying her site leader or Andrea on her communications and continues to reach out outside of working hours to obtain a response. I replied to her email on Monday, 1/26, during business hours and reminded her of my designated working hours","hr_action":"On Watch","first_time":"Yes"},{"ts":"1/29/2026 9:02:05","month":"Jan 2026","yr":2026,"mo":1,"submitter":"Colleen Elam (Instructional Coach/Site Leader)","emp":"Pooja Tyagi","role":"Tutor","support_type":"Other (please describe below)","delivery":"In Person","site":"Central Jersey College Prep","concern_type":"Other (please explain below)","concern_label":"On 1/15/2026 Pooja left the site and went home. When I spoke with her over the phone, she explained that she was very upset after getting into an argument with another tutor over a tissue. She explained that Naima yelled at her, and she felt very disrespected. She explained that she was not able to teach, and she had to leave immediately due to her being upset.","hr_action":"On Watch","first_time":"No"},{"ts":"1/30/2026 14:25:36","month":"Jan 2026","yr":2026,"mo":1,"submitter":"Tierney Tittermary/ APM","emp":"Nicholas Antoine","role":"Tutor","support_type":"Reminder/Verbal Warning","delivery":"Email","site":"First Philadelphia Prep Charter School (American Paradigm)","concern_type":"Lesson Plans","concern_label":"Lesson Plans","hr_action":"On Watch","first_time":"Yes"},{"ts":"2/2/2026 11:00:40","month":"Feb 2026","yr":2026,"mo":2,"submitter":"Andrea Brooks/PM","emp":"Sharmina Ellis","role":"Dual Role","support_type":"Observation by PM Team","delivery":"Email","site":"Penns Grove - Carneys Point Regional School District- Penns Grove Middle School","concern_type":"Attendance","concern_label":"Attendance","hr_action":"On Watch","first_time":"Yes"},{"ts":"2/3/2026 22:08:05","month":"Feb 2026","yr":2026,"mo":2,"submitter":"Tierney Tittermary/ APM","emp":"Nicholas Antoine","role":"Tutor","support_type":"Reminder/Verbal Warning","delivery":"In Person","site":"First Philadelphia Prep Charter School (American Paradigm)","concern_type":"Other (please explain below)","concern_label":"Communication: Nic appears to be struggling with timely communication regarding updates, changes, and email correspondence. When I was on site today at First Philly to support our two new tutors and new site leader, Nic arrived half an hour late. We had reached out to him via email to check on his whereabouts, as he knew both Andrea and I would be on site with new staff. We had discussed this visit with him the day before over Zoom. Knowing Nic uses public transportation, Andrea also mentioned this in her email asking for an update. Nic did not respond via email but informed us in person upon arrival that public transportation had been running extremely late. We reiterated the importance of communicating delays in advance\u2014via phone, text, or email\u2014so we are aware and can ensure everyone\u2019s safety. Andrea also reminded him that she had sent him an email.  Later that same day, Nic informed us that he had been pulling scholars out of the classroom for tutoring into the office space. This was the first we were hearing of this change, and we reminded Nic that the expectation is for scholars to receive tutoring within the classroom, as this is a push-in model. We then confirmed with the principal whether this approach was acceptable given the limited space, and she approved it while offering additional options for the other two tutors to manage space constraints.  We emphasized to Nic that, as a tutor, he must communicate any changes like this with us beforehand. Decisions affecting tutoring structure or scholar placement cannot be made independently without prior discussion.","hr_action":"On Watch","first_time":"No"},{"ts":"2/4/2026 10:48:48","month":"Feb 2026","yr":2026,"mo":2,"submitter":"Lakeeda Sessoms (Site Leader/Instructional Coach)","emp":"Maryann Ficker","role":"Tutor","support_type":"Observation by PM Team","delivery":"In Person","site":"iLearn Charter School- Paterson ES","concern_type":"Lesson Plans","concern_label":"Lesson Plans","hr_action":"On Watch","first_time":"Yes"},{"ts":"2/4/2026 15:10:59","month":"Feb 2026","yr":2026,"mo":2,"submitter":"Chelsea Ostrowski","emp":"Susan Dominguez","role":"Tutor","support_type":"Other (please describe below)","delivery":"Phone","site":"Penns Grove - Field Street Elementary","concern_type":"Other (please explain below)","concern_label":"It was a passing incidence but after today's meeting and pondering it; it definitely caused pause and much thought from me. We were having a conversation regarding lesson plans and how overall as a team we need to get them in on time. She questioned if NJTC has ever fired someone for not turning them in on time. I was caught off guard a bit but did state that I do not personally have access to that information and I'm unaware what occurs in other programs. She further asked if it had ever occurred in the programs I was in; I stated that to my knowledge turning in lesson plans on time was not an issue I was made aware of and I only was aware of what I did as a tutor.","hr_action":"On Watch","first_time":"Yes"},{"ts":"2/6/2026 0:50:03","month":"Feb 2026","yr":2026,"mo":2,"submitter":"Tierney Tittermary/APM","emp":"Victoria Nachimson","role":"Tutor","support_type":"Observation by PM Team","delivery":"In Person","site":"Penns Grove - Carneys Point Regional School District- Penns Grove Middle School","concern_type":"Other (please explain below)","concern_label":"Vicky is struggling with following directions and completing tasks as requested. She frequently questions instructions and sometimes provides responses that contradict earlier statements. In conversations, she can come across as tense and may not fully consider the perspective of others.","hr_action":"On Watch","first_time":"Yes"},{"ts":"2/12/2026 16:50:53","month":"Feb 2026","yr":2026,"mo":2,"submitter":"Sharmina Ellis-SC/IC","emp":"Victoria Nachimson","role":"Tutor","support_type":"Other (please describe below)","delivery":"In Person","site":"Penns Grove - Carneys Point Regional School District- Penns Grove Middle School","concern_type":"Other (please explain below)","concern_label":"Victoria has been navigating a season of ebbs and flows since stepping into the Penns Grove Middle School environment, and it is clear that the transition has brought a level of culture shock. While V shows moments of genuine care for scholars and a desire to be helpful, the adjustment to the building\u2019s routines, expectations, and communication norms has been more challenging than anticipated.","hr_action":"On Watch","first_time":"Yes"},{"ts":"2/12/2026 17:18:08","month":"Feb 2026","yr":2026,"mo":2,"submitter":"Sharmina Ellis-SC/IC","emp":"Victoria Nachimson","role":"Tutor","support_type":"Other (please describe below)","delivery":"In Person","site":"Penns Grove - Carneys Point Regional School District- Penns Grove Middle School","concern_type":"Overall Lesson Delivery","concern_label":"Vicky has directly shared that they \u201cdo not have a filter,\u201d and this has shown up through repeated instances of discussing 1:1 administrative matter in spaces and with audiences that are not appropriate for those topics. Specifically, Victora has engaged fellow tutors, PGMS faculty about her concerns and disagreement with policies, procedures, and at times individuals in open areas where school personnel and scholars are present, in conversations that should remain private and routed through proper supervisory channels.  PGMS is a newer partner and because schools operate on trust, confidentiality, and clear communication protocols, this pattern has the potential to create misunderstandings, compromise privacy, and unintentionally impact team cohesion and the overall climate of the program. Even when the intent is not harmful, the impact can be significant, particularly when administrative or personnel related topics are shared publicly or casually.","hr_action":"On Watch","first_time":"No"},{"ts":"2/12/2026 17:37:58","month":"Feb 2026","yr":2026,"mo":2,"submitter":"Sharmina Ellis-SC/IC","emp":"Victoria Nachimson","role":"Tutor","support_type":"Additional Coaching Support","delivery":"In Person","site":"Penns Grove - Carneys Point Regional School District- Penns Grove Middle School","concern_type":"Other (please explain below)","concern_label":"Vicky shared that, in order to maintain instructional flow and ensure the lesson is delivered, she will at times \u201cfilter out\u201d scholars whose behavior becomes problematic during a tutoring session. She further indicated that, in some cases, she uses the last five to ten minutes of the session to briefly relay the lesson content to the student who was removed or disengaged due to behavior. Vicky stated that the scholar is still marked as having attended the full 30 minute tutoring session, even when the student did not participate for the majority of that instructional time.","hr_action":"On Watch","first_time":"No"},{"ts":"2/18/2026 18:13:37","month":"Feb 2026","yr":2026,"mo":2,"submitter":"Tierney Tittermary","emp":"Jenny Seligman","role":"Tutor","support_type":"Additional Coaching Support","delivery":"Email","site":"First Philadelphia Prep Charter School (American Paradigm)","concern_type":"Lesson Plans","concern_label":"Lesson Plans","hr_action":"On Watch","first_time":"Yes"},{"ts":"2/18/2026 18:25:41","month":"Feb 2026","yr":2026,"mo":2,"submitter":"Tierney Tittermary","emp":"Nicholas Antoine","role":"Tutor","support_type":"Observation by PM Team","delivery":"Email","site":"First Philadelphia Prep Charter School (American Paradigm)","concern_type":"Other (please explain below)","concern_label":"Scholars have never logged into Pearl individually using their own scholar accounts.","hr_action":"On Watch","first_time":"No"},{"ts":"2/20/2026 15:20:20","month":"Feb 2026","yr":2026,"mo":2,"submitter":"Faye Lewis Instructional Coach/Site Coordinator","emp":"Micaela Wilkerson","role":"Tutor","support_type":"Other (please describe below)","delivery":"Phone","site":"Haddon Township School District-Strawbridge Elementary School","concern_type":"Attendance","concern_label":"On Tuesday, February 17, principal Caroline Lunsford informed me that one of her teachers had reported to her that Caela Wilkerson had missed tutoring sessions the previous week.","hr_action":"On Watch","first_time":"Yes"},{"ts":"2/26/2026 20:21:51","month":"Feb 2026","yr":2026,"mo":2,"submitter":"Tierney Tittermary","emp":"Nicholas Antoine","role":"Tutor","support_type":"Observation by PM Team","delivery":"In Person","site":"Global Leadership Academy - GLA- West","concern_type":"Other (please explain below)","concern_label":"While I was on site at GLAW conducting a site leader observation for Danielle, Nic came in from the other room, where tutoring sessions were taking place, to ask Danielle a question about the testing scheduled for that day. When he noticed me, he immediately paused and appeared surprised or confused about my presence.   He said hello and asked how I was doing and then quickly shifted the conversation to ask about Jenny\u2014where she was and whether she was okay. As he spoke, his tone was noticeably fast-paced, and he appeared anxious. He did not consistently make direct eye contact as he typically does. He commented that it was a shame she was no longer there and repeatedly asked what had happened. I informed him that Jenny was no longer tutoring with us for her own reasons. He responded that he was aware something had occurred with Jenny because Jaejin (the other tutor) told Nic that he (Jaijin) and Jenny had been walking to their tutoring sessions together the previous week when she suddenly felt sick and had to leave the school.  Nic continued speaking rapidly and suggested that he would be willing to take on Jenny\u2019s sessions and incorporate some of her scholars into his existing groups. I explained that we already have someone onboarding to take over Jenny\u2019s position and thanked him for the offer. I also clarified that expanding his groups in that way would not align with our high-impact tutoring model (i.e., exceeding four scholars per group and pulling students from additional classrooms).  He then pivoted the conversation and stated that there had been \u201cno fires to put out\u201d at First Philly recently and that everything was going well. He emphasized that he had been ensuring everything was managed, that students were happy, and that even students not currently enrolled in tutoring were expressing interest in joining. He also specifically noted that space was not an issue for tutoring. This was notable, as space has been an ongoing concern since the start of the program. We previously asked the site leader, Monfia, to create a rotating schedule due to space limitations, and the principal had confirmed constraints regarding available tutoring locations. Nic stated that he and Jaejin had been sharing the conference room when the library was unavailable, or occasionally using the office space.  Overall, the interaction felt prolonged, uncomfortable, and very unusual given that Nic initiated the conversation immediately upon seeing me and appeared eager to address multiple topics at once.","hr_action":"Recommended Termination","first_time":"No"},{"ts":"2/26/2026 20:42:25","month":"Feb 2026","yr":2026,"mo":2,"submitter":"Tierney Tittermary","emp":"Nicholas Antoine","role":"Tutor","support_type":"Observation by PM Team","delivery":"In Person","site":"Global Leadership Academy - GLA- West","concern_type":"Other (please explain below)","concern_label":"After my previously documented conversation with Nic concluded, I followed up with him regarding his scholars using their own Pearl credentials to log in independently on their devices. I explained that I had reviewed an updated report showing that his scholars had still not logged into Pearl. I also clarified that the report included specific dates, times, and individual scholar names, so I was able to see exactly what had and had not occurred.  Nic immediately became defensive and responded, \u201cThis isn\u2019t anything new \u2014 we\u2019ve had previous conversations about this.\u201d I acknowledged that we had, and explained that this was exactly why I was following up \u2014 to better understand why the scholars still had not logged in independently using their own usernames and passwords.  At that point, Nic began showing visible frustration, and his tone shifted noticeably. He stated that teachers had to log scholars into their Chromebooks. I expressed confusion, as that did not align with what I personally observed during diagnostic testing. During that visit, students logged in independently using their Gmail credentials. The only issues observed were related to dead Chromebooks or students not knowing their login information.  Nic responded by saying that was not true. I then asked him to help me better understand what was currently happening. When I asked whether scholars did not know their Gmail logins, he appeared flustered and struggled to provide a clear explanation. He stated that the teacher would not allow students to log in themselves or was the only one permitted to do so. I reiterated that this differed from what I had directly observed during testing and told him that if this was an ongoing issue, he should have communicated that with us. He defensively said that he told Monifa (site leader) and Jaejin (tutor). I reminded him that we had previous conversations about communicating this information to program managers and that given all of our past conversations, he should have told Andrea and I.  I also informed Nic that we had an upcoming check-in meeting with the principal on Monday and that I could seek clarification at that time. At this point, Nic\u2019s tone became louder and more firm. He stated, \u201cDo you need me to re-explain the situation to you so you can remember what happened when you were here\u201d  His tone and phrasing were, at that point, rude, unprofessional, and disrespectful. I then informed him that it was time for him to return to tutoring and that we could revisit the conversation after tutoring had concluded.","hr_action":"Recommended Termination","first_time":"No"},{"ts":"2/26/2026 21:05:35","month":"Feb 2026","yr":2026,"mo":2,"submitter":"Tierney Tittermary","emp":"Breaunna Braxton","role":"Tutor","support_type":"Observation by PM Team","delivery":"In Person","site":"Global Leadership Academy - GLA- West","concern_type":"Attendance","concern_label":"Attendance","hr_action":"On Watch","first_time":"Yes"},{"ts":"2/27/2026 18:00:22","month":"Feb 2026","yr":2026,"mo":2,"submitter":"Danielle Hallahan","emp":"Juanita Brown-Lyons","role":"Tutor","support_type":"Additional Coaching Support","delivery":"In Person","site":"Global Leadership Academy - GLA- West","concern_type":"Lesson Plans","concern_label":"Lesson Plans","hr_action":"On Watch","first_time":"Yes"},{"ts":"2/27/2026 18:13:12","month":"Feb 2026","yr":2026,"mo":2,"submitter":"Danielle Hallahan","emp":"Marissa Onesi","role":"Tutor","support_type":"Additional Coaching Support","delivery":"In Person","site":"Global Leadership Academy - GLA- West","concern_type":"Lesson Plans","concern_label":"Lesson Plans","hr_action":"First Write Up - Employee Progress Report","first_time":"Yes"}];
  let REVIEWS  = [{"ts": "7/17/2025 14:57:14", "month": "July 2025", "pm": "Andrea Brooks", "leader": "Katharine Samberg-Laurence", "site": "Global Leadership Academy", "role": "Dual Role SC/IC", "d1": "Meets Expectations", "d23": "Meets Expectations", "d4": "Meets Expectations", "notes": ""}, {"ts": "2/5/2026 15:44:14", "month": "January 2026", "pm": "Andrea Brooks", "leader": "Katharine Samberg-Lawrence", "site": "Hamilton Township SD", "role": "Dual Role SC/IC", "d1": "Meets Expectations", "d23": "Meets Expectations", "d4": "Meets Expectations", "notes": ""}, {"ts": "2/5/2026 10:42:36", "month": "January 2026", "pm": "Andrea Brooks", "leader": "Marta Reyes", "site": "Hamilton Township SD", "role": "Dual Role SC/IC", "d1": "Meets Expectations", "d23": "Meets Expectations", "d4": "Meets Expectations", "notes": ""}, {"ts": "2/2/2026 16:19:54", "month": "January 2026", "pm": "Dr. Taneisha Clemons", "leader": "Lakeeda Sessoms", "site": "iLearn Charter Schools", "role": "Dual Role SC/IC", "d1": "Meets Expectations", "d23": "Partially Meets Expectations", "d4": "Meets Expectations", "notes": ""}, {"ts": "8/18/2025 13:42:49", "month": "July 2025", "pm": "Dr. Taneisha Clemons", "leader": "Dr. Ema", "site": "Belleville Public Schools", "role": "Dual Role SC/IC", "d1": "Meets Expectations", "d23": "Meets Expectations", "d4": "Meets Expectations", "notes": ""}, {"ts": "8/18/2025 14:19:11", "month": "July 2025", "pm": "Dr. Taneisha Clemons", "leader": "Maria Zia", "site": "Boys & Girls Club", "role": "Dual Role SC/IC", "d1": "Meets Expectations", "d23": "Meets Expectations", "d4": "Meets Expectations", "notes": ""}, {"ts": "2/2/2026 16:17:18", "month": "November 2025", "pm": "Dr. Taneisha Clemons", "leader": "Nicole O.", "site": "iLearn Charter Schools", "role": "Dual Role SC/IC", "d1": "Meets Expectations", "d23": "Meets Expectations", "d4": "Meets Expectations", "notes": ""}, {"ts": "12/17/2025 13:12:06", "month": "November 2025", "pm": "Dr. Taneisha Clemons", "leader": "Jodi Bianchi", "site": "iLearn Charter Schools", "role": "Dual Role SC/IC", "d1": "Meets Expectations", "d23": "Meets Expectations", "d4": "Meets Expectations", "notes": ""}, {"ts": "8/22/2025 16:16:02", "month": "July 2025", "pm": "Jenny Irwin", "leader": "Alyssa DeAngelis", "site": "Boys & Girls Club", "role": "Dual Role SC/IC", "d1": "Meets Expectations", "d23": "Meets Expectations", "d4": "Meets Expectations", "notes": ""}, {"ts": "8/22/2025 16:19:44", "month": "July 2025", "pm": "Jenny Irwin", "leader": "Cara DeBonis", "site": "Boys & Girls Club", "role": "Dual Role SC/IC", "d1": "Meets Expectations", "d23": "Meets Expectations", "d4": "Meets Expectations", "notes": ""}, {"ts": "11/21/2025 17:32:03", "month": "November 2025", "pm": "Jenny Irwin", "leader": "Colleen Elam", "site": "Central Jersey College Prep", "role": "Dual Role SC/IC", "d1": "Meets Expectations", "d23": "Meets Expectations", "d4": "Meets Expectations", "notes": ""}, {"ts": "2/9/2026 17:03:23", "month": "January 2026", "pm": "Jenny Irwin", "leader": "Colleen Elam", "site": "Central Jersey College Prep", "role": "Dual Role SC/IC", "d1": "Meets Expectations", "d23": "Meets Expectations", "d4": "Meets Expectations", "notes": ""}, {"ts": "11/3/2025 11:27:56", "month": "October 2025", "pm": "Jenny Irwin", "leader": "Jodi Bianchi", "site": "iLearn Charter Schools", "role": "Dual Role SC/IC", "d1": "Meets Expectations", "d23": "Meets Expectations", "d4": "Meets Expectations", "notes": ""}, {"ts": "11/3/2025 11:25:30", "month": "October 2025", "pm": "Jenny Irwin", "leader": "Lakeeda Sessoms", "site": "iLearn Charter Schools", "role": "Dual Role SC/IC", "d1": "Meets Expectations", "d23": "Meets Expectations", "d4": "Meets Expectations", "notes": ""}, {"ts": "11/24/2025 13:33:09", "month": "November 2025", "pm": "Jenny Irwin", "leader": "Lakeeda Sessoms", "site": "iLearn Charter Schools", "role": "Dual Role SC/IC", "d1": "Meets Expectations", "d23": "Meets Expectations", "d4": "Meets Expectations", "notes": ""}, {"ts": "11/3/2025 11:18:34", "month": "October 2025", "pm": "Jenny Irwin", "leader": "Leslie Black", "site": "iLearn Charter Schools", "role": "Site Coordinator", "d1": "N/A", "d23": "N/A", "d4": "N/A", "notes": ""}, {"ts": "8/22/2025 16:13:41", "month": "July 2025", "pm": "Jenny Irwin", "leader": "Mike Ettore", "site": "Boys & Girls Club", "role": "Dual Role SC/IC", "d1": "Meets Expectations", "d23": "Meets Expectations", "d4": "Meets Expectations", "notes": ""}, {"ts": "11/3/2025 11:22:01", "month": "October 2025", "pm": "Jenny Irwin", "leader": "Nicole Odigie", "site": "iLearn Charter Schools", "role": "Dual Role SC/IC", "d1": "Meets Expectations", "d23": "Meets Expectations", "d4": "Meets Expectations", "notes": ""}, {"ts": "2/6/2026 12:25:34", "month": "January 2026", "pm": "Jenny Irwin", "leader": "Nicole Odigie", "site": "iLearn Charter Schools", "role": "Dual Role SC/IC", "d1": "Meets Expectations", "d23": "Meets Expectations", "d4": "Meets Expectations", "notes": ""}, {"ts": "2/6/2026 0:26:04", "month": "February 2026", "pm": "Tierney Tittermary", "leader": "Chelsea Ostrowski", "site": "Boys & Girls Club", "role": "Dual Role SC/IC", "d1": "Meets Expectations", "d23": "Meets Expectations", "d4": "Meets Expectations", "notes": ""}, {"ts": "10/14/2025 20:10:03", "month": "October 2025", "pm": "Tierney Tittermary", "leader": "Danielle Hallahan", "site": "Global Leadership Academy", "role": "Dual Role SC/IC", "d1": "Meets Expectations", "d23": "Meets Expectations", "d4": "Meets Expectations", "notes": ""}, {"ts": "7/24/2025 17:04:05", "month": "July 2025", "pm": "Tierney Tittermary", "leader": "Kaleigh Mizner", "site": "Boys & Girls Club", "role": "Dual Role SC/IC", "d1": "Meets Expectations", "d23": "Meets Expectations", "d4": "Meets Expectations", "notes": ""}, {"ts": "11/20/2025 9:31:02", "month": "November 2025", "pm": "Tierney Tittermary", "leader": "Katie Hennigan", "site": "Haddon Township SD", "role": "Dual Role SC/IC", "d1": "Meets Expectations", "d23": "Meets Expectations", "d4": "Meets Expectations", "notes": ""}, {"ts": "7/24/2025 17:01:23", "month": "July 2025", "pm": "Tierney Tittermary", "leader": "Robert Whitman", "site": "Boys & Girls Club", "role": "Dual Role SC/IC", "d1": "Meets Expectations", "d23": "Meets Expectations", "d4": "Meets Expectations", "notes": ""}, {"ts": "8/4/2025 15:21:14", "month": "August 2025", "pm": "Tierney Tittermary", "leader": "Robert Whitman", "site": "Boys & Girls Club", "role": "Dual Role SC/IC", "d1": "Meets Expectations", "d23": "Meets Expectations", "d4": "Meets Expectations", "notes": ""}, {"ts": "2/6/2026 0:29:23", "month": "February 2026", "pm": "Tierney Tittermary", "leader": "Sharmina Ellis", "site": "Boys & Girls Club", "role": "Dual Role SC/IC", "d1": "Meets Expectations", "d23": "Meets Expectations", "d4": "Meets Expectations", "notes": ""}, {"ts": "2/6/2026 0:28:26", "month": "February 2026", "pm": "Tierney Tittermary", "leader": "Tabitha Parris", "site": "Boys & Girls Club", "role": "Dual Role SC/IC", "d1": "Meets Expectations", "d23": "Meets Expectations", "d4": "Meets Expectations", "notes": ""}, {"ts": "7/30/2025 13:54:52", "month": "July 2025", "pm": "Tierney Tittermary", "leader": "Danielle Hallahan", "site": "Boys & Girls Club", "role": "Dual Role SC/IC", "d1": "Meets Expectations", "d23": "Meets Expectations", "d4": "Meets Expectations", "notes": ""}];

  window._talentLoaded = false; // shared with shared-charts.js (cross-module state)
  let _talentTab     = 'all';
  let _talentYear_selected = 'all';
  let _filteredConcerns = CONCERNS; window._filteredConcerns = CONCERNS; // shared with hr-department.js
  let _talentFilters = {};

  function parseCSVLine(line) {
    const result = []; let cur = ''; let inQ = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') { inQ = !inQ; }
      else if (c === ',' && !inQ) { result.push(cur.trim()); cur = ''; }
      else cur += c;
    }
    result.push(cur.trim()); return result;
  }
  function normDistrict(raw) {
    if (!raw) return 'Unknown';
    const l = raw.toLowerCase().trim();
    if (l.includes('ilearn')) return 'iLearn Charter Schools';
    if (l.startsWith('bgc') || l.includes('boys & girls')) return 'Boys & Girls Club';
    if (l.includes('hamilton')) return 'Hamilton Township SD';
    if (l.includes('gloucester')) return 'Gloucester Township SD';
    if (l.includes('penns grove')) return 'Penns Grove-Carneys Point SD';
    if (l.includes('haddon')) return 'Haddon Township SD';
    if (l.includes('salem')) return 'Salem City SD';
    if (l.includes('central jersey')) return 'Central Jersey College Prep';
    if (l.includes('global leadership') || (l.includes('gla') && l.length < 20)) return 'Global Leadership Academy';
    if (l.includes('hoboken') || l.includes('hola')) return 'HOLA Hoboken Charter';
    if (l.includes('first philadelphia')) return 'First Philadelphia Prep';
    if (l.includes('lawrence')) return 'Lawrence Township SD';
    if (l.includes('paterson charter') || l.includes('pcsst')) return 'Paterson Charter Sci & Tech';
    if (l.includes('belleville')) return 'Belleville Public Schools';
    return raw.trim();
  }
  // ── Talent live-data status ─────────────────────────────────────────────────
  let _talentLiveStatus = 'pending'; // 'live' | 'fallback' | 'pending'

  // Published CSV URL — must use pub?output=csv (not /export which requires login)
  // Base URL targets Form Responses tab via gid=274671201
  // ── HR Profiles: embedded snapshot SY 2022-2025 (static, previous years) ─
  const HR_EMPS = [{"n":"Alyssa DeAngelis","a":[],"e":"alyssald920@gmail.com","y":["2023-2024","2022-2023"],"c":2,"r":"Certified Tutor","rs":["Site Coordinator","Certified Tutor"],"si":"N/A","sis":[],"di":"N/A","dis":[],"s":"Terminated","t":"incomplete","mp":null,"py":"2023-2024","am":"#VALUE!","em":"Yes","lm":"Yes","acm":"No","pi":null,"pr":null,"p2":null,"att":null,"je":null,"jl":null,"rh":"Unknown - atleast 1 metric missing","re":"Unknown (Not Listed)","co":0,"ct":"","cd":"","hn":"","tr":null,"ty":null},{"n":"Angel Blue","a":[],"e":"anblue2019@gmail.com","y":["2024-2025","2023-2024","2022-2023"],"c":3,"r":"Certified Tutor","rs":["Tutor","Certified Tutor"],"si":"Boys and Girls Club","sis":["Boys and Girls Club"],"di":"BGC Asbury Park","dis":["BGC Asbury Park"],"s":"Terminated","t":"developing","mp":2.0,"py":"2023-2024","am":"No","em":"Yes","lm":"Yes","acm":"No","pi":0.0,"pr":0.0,"p2":0.0,"att":76.2,"je":4.6,"jl":4.6,"rh":"Maybe","re":"Unknown (Not Listed)","co":0,"ct":"","cd":"","hn":"","tr":null,"ty":null},{"n":"Arelis Rodriguez","a":[],"e":"arelisrod8601@gmail.com","y":["2025-2026","2024-2025","2023-2024","2022-2023"],"c":4,"r":"Non-cert Tutor","rs":["Tutor","Site Coordinator","Non-cert Tutor"],"si":"iLearn Science & Arts Charter Middle School-B","sis":["iLearn CMO","iLearn Science & Arts Charter Middle School-Bergen"],"di":"LEA - iLearn Bergen MS","dis":["LEA - iLearn Paterson MS","LEA - iLearn Bergen MS"],"s":"Active","t":"developing","mp":2.0,"py":"2023-2024","am":"No","em":"Yes","lm":"Yes","acm":"No","pi":37.9,"pr":5.2,"p2":6.9,"att":75.2,"je":4.6,"jl":4.5,"rh":"Maybe","re":"Unknown (Not Listed)","co":0,"ct":"","cd":"","hn":"","tr":null,"ty":null},{"n":"Chandler Talty","a":[],"e":"chandlertalty@gmail.com","y":["2025-2026","2022-2023"],"c":2,"r":"Certified Tutor","rs":["Certified Tutor"],"si":"Hoboken Dual Language Charter School","sis":["Boys and Girls Club","Hoboken Dual Language Charter School"],"di":"","dis":["BGC - Mercer - Lawrenceville Spruce Street"],"s":"Terminated","t":"incomplete","mp":null,"py":"","am":null,"em":null,"lm":null,"acm":null,"pi":null,"pr":null,"p2":null,"att":null,"je":null,"jl":null,"rh":null,"re":null,"co":0,"ct":null,"cd":null,"hn":null,"tr":null,"ty":null},{"n":"Cynthia Tyrrell","a":[],"e":"tyrrellcynthia@gmail.com","y":["2023-2024","2022-2023"],"c":2,"r":"Instructional Coach","rs":["Tutor","Instructional Coach"],"si":"N/A","sis":[],"di":"N/A","dis":[],"s":"Terminated","t":"incomplete","mp":null,"py":"2023-2024","am":"#VALUE!","em":"Yes","lm":"Yes","acm":"No","pi":null,"pr":null,"p2":null,"att":null,"je":null,"jl":null,"rh":"Unknown - atleast 1 metric missing","re":"Unknown (Not Listed)","co":0,"ct":"","cd":"","hn":"","tr":null,"ty":null},{"n":"Dawn Browning","a":[],"e":"dawnebrowning@gmail.com","y":["2024-2025","2023-2024","2022-2023"],"c":3,"r":"Non-cert Tutor","rs":["Tutor","Non-cert Tutor"],"si":"Boys and Girls Club","sis":["Boys and Girls Club"],"di":"BGC Asbury Park","dis":["BGC Asbury Park"],"s":"Terminated","t":"needs_support","mp":1.0,"py":"2023-2024","am":"Yes","em":"No","lm":"No","acm":"No","pi":0.0,"pr":0.0,"p2":0.0,"att":100.0,"je":3.8,"jl":3.8,"rh":"No","re":"Unknown (Not Listed)","co":0,"ct":"","cd":"","hn":"","tr":null,"ty":null},{"n":"Emily Cooper","a":[],"e":"emilyf28@aol.com","y":["2023-2024","2022-2023"],"c":2,"r":"Certified Tutor","rs":["Tutor","Certified Tutor"],"si":"Gloucester Township School District","sis":["Gloucester Township School District"],"di":"Union Valley Elementary School","dis":["Union Valley Elementary School"],"s":"Terminated","t":"stellar","mp":4.0,"py":"2023-2024","am":"Yes","em":"Yes","lm":"Yes","acm":"Yes","pi":58.3,"pr":0.0,"p2":16.7,"att":92.5,"je":5.0,"jl":5.0,"rh":"Yes","re":"Unknown (Not Listed)","co":0,"ct":"","cd":"","hn":"","tr":null,"ty":null},{"n":"Evan White","a":[],"e":"evanwhite2019@gmail.com","y":["2025-2026","2024-2025","2023-2024","2022-2023"],"c":4,"r":"Dual Role","rs":["Tutor","Certified Tutor","Dual Role"],"si":"iLearn CMO","sis":["iLearn CMO"],"di":"LEA - iLearn Passaic MS","dis":["LEA - iLearn Passaic MS"],"s":"Terminated","t":"developing","mp":2.0,"py":"2024-2025","am":"No","em":"Yes","lm":"Yes","acm":"No","pi":16.7,"pr":9.5,"p2":23.1,"att":85.1,"je":4.6,"jl":4.5,"rh":"Maybe","re":"SY 25-26 Decision TBD","co":1,"ct":"Other (please describe below)","cd":"3/18/2025","hn":"No","tr":null,"ty":null},{"n":"Jennifer Snyder","a":[],"e":"snyderm.jennifer@gmail.com","y":["2023-2024","2022-2023"],"c":2,"r":"Tutor","rs":["Tutor"],"si":"iLearn CMO","sis":["iLearn CMO, YMCA","iLearn CMO"],"di":"LEA- Hamilton","dis":["LEA- Hunterdon- Clinton Twp, YMCA - Hamilton, YMCA -Mercer - Hamilton Sawmill","LEA- Hamilton"],"s":"Terminated","t":"incomplete","mp":null,"py":"","am":null,"em":null,"lm":null,"acm":null,"pi":null,"pr":null,"p2":null,"att":null,"je":null,"jl":null,"rh":null,"re":null,"co":0,"ct":null,"cd":null,"hn":null,"tr":null,"ty":"2023-2024"},{"n":"Laura Gallucci","a":[],"e":"blugirl27@gmail.com","y":["2025-2026","2024-2025","2022-2023"],"c":3,"r":"Non-cert Tutor","rs":["Tutor","Non-cert Tutor"],"si":"Global Leadership Academy Charter Schools","sis":["Global Leadership Academy Charter Schools"],"di":"Global Leadership Academy","dis":["Global Leadership Academy"],"s":"Active","t":"needs_support","mp":1.0,"py":"2024-2025","am":"No","em":"No","lm":"Yes","acm":"No","pi":null,"pr":null,"p2":null,"att":47.7,"je":3.6,"jl":4.4,"rh":"No","re":"SY 25-26 Decision TBD","co":0,"ct":"Other (please describe below)","cd":"12/3/2025","hn":"No","tr":null,"ty":null},{"n":"Lisa Cannon","a":[],"e":"lcannon@trenton.k12.nj.us","y":["2023-2024","2022-2023"],"c":2,"r":"Dual Role","rs":["Tutor","Dual Role"],"si":"N/A","sis":[],"di":"N/A","dis":[],"s":"Terminated","t":"incomplete","mp":null,"py":"2023-2024","am":"#VALUE!","em":"Yes","lm":"Yes","acm":"No","pi":null,"pr":null,"p2":null,"att":null,"je":null,"jl":null,"rh":"Unknown - atleast 1 metric missing","re":"Unknown (Not Listed)","co":0,"ct":"","cd":"","hn":"","tr":null,"ty":null},{"n":"Lyndsey Cannon","a":[],"e":"lyndseycannon02@gmail.com","y":["2023-2024","2022-2023"],"c":2,"r":"Certified Tutor","rs":["Certified Tutor"],"si":"Lawrence Township","sis":["Lawrence Township"],"di":"LEA- Lawrence Twp","dis":["LEA- Lawrence Twp"],"s":"Terminated","t":"strong","mp":3.0,"py":"2023-2024","am":"No","em":"Yes","lm":"Yes","acm":"Yes","pi":85.7,"pr":0.0,"p2":14.3,"att":71.1,"je":4.8,"jl":4.9,"rh":"Yes","re":"Unknown (Not Listed)","co":0,"ct":"","cd":"","hn":"","tr":null,"ty":null},{"n":"Maria Zia","a":[],"e":"mariazia1229@gmail.com","y":["2023-2024","2022-2023"],"c":2,"r":"Site Coordinator","rs":["Certified - Site Coordinator","Site Coordinator"],"si":"N/A","sis":[],"di":"N/A","dis":[],"s":"Terminated","t":"incomplete","mp":null,"py":"2023-2024","am":"#VALUE!","em":"Yes","lm":"Yes","acm":"No","pi":null,"pr":null,"p2":null,"att":null,"je":null,"jl":null,"rh":"Unknown - atleast 1 metric missing","re":"Unknown (Not Listed)","co":0,"ct":"","cd":"","hn":"","tr":null,"ty":null},{"n":"Marina Farag","a":[],"e":"marinafarag1517@gmail.com","y":["2023-2024","2022-2023"],"c":2,"r":"Tutor","rs":["Tutor"],"si":"iLearn CMO","sis":["Missing, Boys and Girls Club","iLearn CMO"],"di":"LEA- Hamilton","dis":["site location missing, BGC - Mercer - Lawrenceville Spruce Street","LEA- Hamilton"],"s":"Terminated","t":"incomplete","mp":null,"py":"","am":null,"em":null,"lm":null,"acm":null,"pi":null,"pr":null,"p2":null,"att":null,"je":null,"jl":null,"rh":null,"re":null,"co":0,"ct":null,"cd":null,"hn":null,"tr":null,"ty":"2023-2024"},{"n":"Michael Ettore","a":[],"e":"meettore@gmail.com","y":["2024-2025","2023-2024","2022-2023"],"c":3,"r":"Dual Role","rs":["Dual Role","Instructional Coach"],"si":"N/A","sis":[],"di":"N/A","dis":[],"s":"Terminated","t":"incomplete","mp":null,"py":"2023-2024","am":"#VALUE!","em":"Yes","lm":"Yes","acm":"No","pi":null,"pr":null,"p2":null,"att":null,"je":null,"jl":null,"rh":"Unknown - atleast 1 metric missing","re":"Unknown (Not Listed)","co":0,"ct":"","cd":"","hn":"","tr":null,"ty":null},{"n":"Muhammad Khan","a":[],"e":"muhammadkhan1066@gmail.com","y":["2023-2024","2022-2023"],"c":2,"r":"Tutor","rs":["Tutor"],"si":"iLearn CMO","sis":["iLearn CMO, Boys and Girls Club","iLearn CMO"],"di":"LEA - iLearn Hudson MS","dis":["LEA- Essex- Roseville Charter School, BGC - Hudson- Jersey City","LEA - iLearn Hudson MS"],"s":"Terminated","t":"incomplete","mp":null,"py":"","am":null,"em":null,"lm":null,"acm":null,"pi":null,"pr":null,"p2":null,"att":null,"je":null,"jl":null,"rh":null,"re":null,"co":0,"ct":null,"cd":null,"hn":null,"tr":null,"ty":"2023-2024"},{"n":"Muntaha Chaudhry","a":[],"e":"muntaha1435@gmail.com","y":["2023-2024","2022-2023"],"c":2,"r":"Sub Tutor","rs":["Certified - Site Coordinator","Sub Tutor"],"si":"Multi Districts","sis":["YMCA, Boys and Girls Club","Multi Districts"],"di":"Locations","dis":["YMCA - Broad Street, BGC - Passaic Hudson Street , BGC - Passaic- Paterson 21st ave","Locations"],"s":"Terminated","t":"incomplete","mp":null,"py":"","am":null,"em":null,"lm":null,"acm":null,"pi":null,"pr":null,"p2":null,"att":null,"je":null,"jl":null,"rh":null,"re":null,"co":0,"ct":null,"cd":null,"hn":null,"tr":null,"ty":"2023-2024"},{"n":"Saadia Zia","a":[],"e":"saadiazia61@gmail.com","y":["2023-2024","2022-2023"],"c":2,"r":"Sub Tutor","rs":["Tutor","Sub Tutor"],"si":"Multi Districts","sis":["iLearn CMO, Boys and Girls Club","Multi Districts"],"di":"Locations","dis":["LEA- Essex- Roseville Charter School, Essex - BGC- Newark Avon, BGC - Hudson- Jersey City","Locations"],"s":"Terminated","t":"incomplete","mp":null,"py":"","am":null,"em":null,"lm":null,"acm":null,"pi":null,"pr":null,"p2":null,"att":null,"je":null,"jl":null,"rh":null,"re":null,"co":0,"ct":null,"cd":null,"hn":null,"tr":null,"ty":"2023-2024"},{"n":"Samantha Belle","a":[],"e":"sbelle318@gmail.com","y":["2023-2024","2022-2023"],"c":2,"r":"Tutor","rs":["Certified Tutor","Tutor"],"si":"Boys and Girls Club","sis":["Boys and Girls Club"],"di":"BGC Asbury Park","dis":["BGC Asbury Park"],"s":"Terminated","t":"strong","mp":3.0,"py":"2023-2024","am":"Yes","em":"No","lm":"Yes","acm":"Yes","pi":75.0,"pr":25.0,"p2":0.0,"att":91.0,"je":4.2,"jl":4.2,"rh":"Yes","re":"Unknown (Not Listed)","co":0,"ct":"","cd":"","hn":"","tr":null,"ty":null},{"n":"Sharon K Kessel","a":[],"e":"sharonkessel64@gmail.com","y":["2025-2026","2024-2025","2023-2024","2022-2023"],"c":4,"r":"Non-cert Tutor","rs":["Tutor","Non-cert Tutor"],"si":"Roseville Community Charter School","sis":["Roseville Community Charter School"],"di":"LEA- Roseville CS","dis":["LEA- Roseville CS"],"s":"Active","t":"stellar","mp":4.0,"py":"2023-2024","am":"Yes","em":"Yes","lm":"Yes","acm":"Yes","pi":45.7,"pr":8.6,"p2":17.6,"att":94.6,"je":4.7,"jl":4.6,"rh":"Yes","re":"Unknown (Not Listed)","co":0,"ct":"","cd":"","hn":"","tr":null,"ty":null},{"n":"Yohanny Rosario","a":[],"e":"rosariy2@tcnj.edu","y":["2025-2026","2024-2025","2023-2024","2022-2023"],"c":4,"r":"Certified Tutor","rs":["Certified Tutor"],"si":"iLearn CMO","sis":["iLearn CMO"],"di":"LEA - iLearn Clifton MS","dis":["LEA - iLearn Clifton MS"],"s":"Active","t":"stellar","mp":4.0,"py":"2024-2025","am":"Yes","em":"Yes","lm":"Yes","acm":"Yes","pi":66.7,"pr":2.1,"p2":29.6,"att":91.6,"je":4.9,"jl":4.9,"rh":"Yes","re":"SY 25-26 Decision TBD","co":0,"ct":"","cd":"","hn":"","tr":"Left NJTC for another employment opportunity","ty":"2025-2026"},{"n":"Vicki Toffler","a":[],"e":"tofflervet@gmail.com","y":["2025-2026","2024-2025","2023-2024"],"c":3,"r":"Certified Sub- Tutor","rs":["Certified Sub- Tutor"],"si":"N/A","sis":[],"di":"N/A","dis":[],"s":"Active","t":"incomplete","mp":null,"py":"2025-2026","am":"","em":"","lm":"","acm":"","pi":null,"pr":null,"p2":null,"att":null,"je":null,"jl":null,"rh":"","re":"SY 25-26 Decision TBD","co":0,"ct":"","cd":"","hn":"","tr":null,"ty":null},{"n":"Alana Catania","a":[],"e":"acatania@wtsd.org","y":["2024-2025","2023-2024"],"c":2,"r":"Certified Tutor","rs":["Certified Sub- Tutor","Certified Tutor"],"si":"Waterford Township","sis":["Waterford Township"],"di":"Waterford Elementary","dis":["Waterford Elementary"],"s":"Terminated","t":"strong","mp":3.0,"py":"2024-2025","am":"Yes","em":"Yes","lm":"Yes","acm":"No","pi":28.6,"pr":7.1,"p2":0.0,"att":95.6,"je":4.9,"jl":4.8,"rh":"Yes","re":"SY 25-26 Decision TBD","co":0,"ct":"","cd":"","hn":"","tr":null,"ty":null},{"n":"Clifford Evan","a":[],"e":"cliffordevan@gmail.com","y":["2025-2026","2023-2024"],"c":2,"r":"Dual Role","rs":["Certified Sub- Tutor","Dual Role"],"si":"N/A","sis":[],"di":"N/A","dis":[],"s":"Terminated","t":"incomplete","mp":null,"py":"2023-2024","am":"#VALUE!","em":"Yes","lm":"Yes","acm":"No","pi":null,"pr":null,"p2":null,"att":null,"je":null,"jl":null,"rh":"Unknown - atleast 1 metric missing","re":"Unknown (Not Listed)","co":0,"ct":"","cd":"","hn":"","tr":null,"ty":null},{"n":"Susan Sheerin","a":[],"e":"susansheerin13@gmail.com","y":["2025-2026","2024-2025","2023-2024"],"c":3,"r":"Certified Sub- Tutor","rs":["Certified Sub- Tutor"],"si":"N/A","sis":[],"di":"N/A","dis":[],"s":"Active","t":"developing","mp":2.0,"py":"2024-2025","am":"Yes","em":"No","lm":"No","acm":"Yes","pi":41.2,"pr":5.9,"p2":null,"att":100.0,"je":4.1,"jl":3.8,"rh":"Maybe","re":"SY 25-26 Decision TBD","co":0,"ct":"","cd":"","hn":"","tr":null,"ty":null},{"n":"Megan Smith","a":[],"e":"megan.3150@gmail.com","y":["2024-2025","2023-2024"],"c":2,"r":"Certified Sub- Tutor","rs":["Certified Sub- Tutor"],"si":"N/A","sis":[],"di":"N/A","dis":[],"s":"Terminated","t":"needs_support","mp":0.0,"py":"2024-2025","am":"No","em":"No","lm":"No","acm":"No","pi":null,"pr":null,"p2":null,"att":75.2,"je":3.8,"jl":3.9,"rh":"No","re":"SY 25-26 Decision TBD","co":0,"ct":"","cd":"","hn":"","tr":null,"ty":null},{"n":"Danielle Hur","a":[],"e":"danielle.hur25@gmail.com","y":["2024-2025","2023-2024"],"c":2,"r":"Certified Tutor","rs":["Certified Tutor"],"si":"iLearn CMO","sis":["iLearn CMO"],"di":"LEA - iLearn Bergen MS","dis":["LEA - iLearn Bergen MS"],"s":"Terminated","t":"needs_support","mp":1.0,"py":"2023-2024","am":"Yes","em":"No","lm":"No","acm":"No","pi":30.2,"pr":14.3,"p2":8.9,"att":94.2,"je":4.1,"jl":4.0,"rh":"No","re":"Unknown (Not Listed)","co":0,"ct":"","cd":"","hn":"","tr":"Full-Time Position","ty":"2024-2025"},{"n":"Elizabeth McCafferty","a":[],"e":"betsylanard@mac.com","y":["2025-2026","2024-2025","2023-2024"],"c":3,"r":"Certified Tutor","rs":["Certified Tutor"],"si":"Penns Grove - Carneys Point Regional School D","sis":["Hamilton Township","Penns Grove - Carneys Point Regional School District"],"di":"","dis":["Loring Flemming Elementary School"],"s":"Active","t":"incomplete","mp":null,"py":"2025-2026","am":"","em":"","lm":"","acm":"","pi":null,"pr":null,"p2":null,"att":null,"je":null,"jl":null,"rh":"","re":"SY 25-26 Decision TBD","co":0,"ct":"","cd":"","hn":"","tr":null,"ty":null},{"n":"Cristina Novoa","a":[],"e":"mrsnovoa9117@gmail.com","y":["2023-2024"],"c":1,"r":"Certified Tutor","rs":["Certified Tutor"],"si":"Maple Shade","sis":["Maple Shade"],"di":"Maude Wilkins Elementary","dis":["Maude Wilkins Elementary"],"s":"Terminated","t":"stellar","mp":4.0,"py":"2023-2024","am":"Yes","em":"Yes","lm":"Yes","acm":"Yes","pi":47.6,"pr":4.8,"p2":5.6,"att":95.6,"je":4.8,"jl":4.2,"rh":"Yes","re":"Unknown (Not Listed)","co":0,"ct":"","cd":"","hn":"","tr":null,"ty":null},{"n":"Marissa Onesi","a":[],"e":"marissaonesi@gmail.com","y":["2025-2026","2024-2025","2023-2024"],"c":3,"r":"Non-cert Tutor","rs":["Certified Tutor","Non-cert Tutor"],"si":"Maple Shade","sis":["Maple Shade"],"di":"Maude Wilkins Elementary","dis":["Maude Wilkins Elementary"],"s":"Active","t":"developing","mp":2.0,"py":"2024-2025","am":"No","em":"Yes","lm":"Yes","acm":"No","pi":null,"pr":null,"p2":null,"att":72.7,"je":4.4,"jl":4.2,"rh":"Maybe","re":"SY 25-26 Decision TBD","co":0,"ct":"","cd":"","hn":"","tr":null,"ty":null},{"n":"Jeannine Puliti","a":[],"e":"jeanninepuliti@gmail.com","y":["2023-2024"],"c":1,"r":"Certified Tutor","rs":["Certified Tutor"],"si":"Pemberton Township","sis":["Pemberton Township"],"di":"FT DIX SCHOOL","dis":["FT DIX SCHOOL"],"s":"Terminated","t":"developing","mp":2.0,"py":"2023-2024","am":"Yes","em":"No","lm":"Yes","acm":"No","pi":41.7,"pr":16.7,"p2":25.0,"att":94.5,"je":4.2,"jl":4.2,"rh":"Maybe","re":"Unknown (Not Listed)","co":0,"ct":"","cd":"","hn":"","tr":null,"ty":null},{"n":"Joanne Sherman","a":[],"e":"snowyegret44@gmail.com","y":["2024-2025","2023-2024"],"c":2,"r":"Certified Tutor","rs":["Certified Tutor"],"si":"Pemberton Township","sis":["Pemberton Township"],"di":"BUSANSKY SCHOOL","dis":["BUSANSKY SCHOOL"],"s":"Terminated","t":"developing","mp":2.0,"py":"2024-2025","am":"Yes","em":"No","lm":"Yes","acm":"No","pi":41.7,"pr":25.0,"p2":0.0,"att":91.2,"je":4.2,"jl":4.2,"rh":"Maybe","re":"SY 25-26 Decision TBD","co":0,"ct":"","cd":"","hn":"","tr":null,"ty":null},{"n":"San Aye","a":[],"e":"saye7060@gmail.com","y":["2024-2025","2023-2024"],"c":2,"r":"Certified Sub- Tutor","rs":["Certified Tutor","Certified Sub- Tutor"],"si":"Pemberton Township","sis":["Pemberton Township"],"di":"DENBO-CRICHTON SCHOOL","dis":["DENBO-CRICHTON SCHOOL"],"s":"Terminated","t":"developing","mp":2.0,"py":"2024-2025","am":"No","em":"Yes","lm":"Yes","acm":"No","pi":21.4,"pr":21.4,"p2":null,"att":72.0,"je":4.3,"jl":4.3,"rh":"Maybe","re":"SY 25-26 Decision TBD","co":0,"ct":"","cd":"","hn":"","tr":null,"ty":null},{"n":"Darlene Jacobus","a":[],"e":"eslteacher1862@gmail.com","y":["2024-2025","2023-2024"],"c":2,"r":"Certified Tutor","rs":["Certified Tutor"],"si":"Pemberton Township","sis":["Pemberton Township"],"di":"DENBO-CRICHTON SCHOOL","dis":["DENBO-CRICHTON SCHOOL"],"s":"Terminated","t":"needs_support","mp":1.0,"py":"2024-2025","am":"Yes","em":"No","lm":"No","acm":"No","pi":33.3,"pr":0.0,"p2":28.6,"att":91.7,"je":3.8,"jl":3.9,"rh":"No","re":"SY 25-26 Decision TBD","co":0,"ct":"","cd":"","hn":"","tr":null,"ty":null},{"n":"Tracey Norfo","a":[],"e":"traceynorfo@comcast.net","y":["2023-2024"],"c":1,"r":"Certified Tutor","rs":["Certified Tutor"],"si":"Riverton","sis":["Riverton"],"di":"Riverton School","dis":["Riverton School"],"s":"Terminated","t":"developing","mp":2.0,"py":"2023-2024","am":"Yes","em":"No","lm":"No","acm":"Yes","pi":62.5,"pr":0.0,"p2":25.0,"att":100.0,"je":4.2,"jl":3.6,"rh":"Maybe","re":"Unknown (Not Listed)","co":0,"ct":"","cd":"","hn":"","tr":null,"ty":null},{"n":"Nathan Boyle","a":[],"e":"boylenate@gmail.com","y":["2023-2024"],"c":1,"r":"Certified Tutor","rs":["Certified Tutor"],"si":"Riverton","sis":["Riverton"],"di":"Riverton School","dis":["Riverton School"],"s":"Terminated","t":"needs_support","mp":1.0,"py":"2023-2024","am":"No","em":"No","lm":"Yes","acm":"No","pi":0.0,"pr":0.0,"p2":0.0,"att":72.7,"je":4.0,"jl":4.0,"rh":"No","re":"Unknown (Not Listed)","co":0,"ct":"","cd":"","hn":"","tr":null,"ty":null},{"n":"Maria Gallagher","a":[],"e":"balletlover2071@gmail.com","y":["2023-2024"],"c":1,"r":"Certified Tutor","rs":["Certified Tutor"],"si":"Edgewater Park","sis":["Edgewater Park"],"di":"Mildred Magowan Elementary School","dis":["Mildred Magowan Elementary School"],"s":"Terminated","t":"strong","mp":3.0,"py":"2023-2024","am":"Yes","em":"No","lm":"Yes","acm":"Yes","pi":50.0,"pr":0.0,"p2":0.0,"att":100.0,"je":4.0,"jl":4.0,"rh":"Yes","re":"Unknown (Not Listed)","co":0,"ct":"","cd":"","hn":"","tr":null,"ty":null},{"n":"Tawanda Chancey","a":[],"e":"tchancey05@gmail.com","y":["2023-2024"],"c":1,"r":"Certified Tutor","rs":["Certified Tutor"],"si":"Edgewater Park","sis":["Edgewater Park"],"di":"Mildred Magowan Elementary School","dis":["Mildred Magowan Elementary School"],"s":"Terminated","t":"needs_support","mp":1.0,"py":"2023-2024","am":"Yes","em":"No","lm":"No","acm":"No","pi":0.0,"pr":14.3,"p2":0.0,"att":92.9,"je":3.4,"jl":3.2,"rh":"No","re":"Unknown (Not Listed)","co":0,"ct":"","cd":"","hn":"","tr":null,"ty":null},{"n":"Vikki Scott","a":[],"e":"sscottvikki@aol.com","y":["2024-2025","2023-2024"],"c":2,"r":"Certified Tutor","rs":["Certified Tutor"],"si":"Gloucester Township School District","sis":["Gloucester Township School District"],"di":"Blackwood Elementary School","dis":["Blackwood Elementary School"],"s":"Terminated","t":"developing","mp":2.0,"py":"2024-2025","am":"Yes","em":"No","lm":"Yes","acm":"No","pi":21.4,"pr":21.4,"p2":null,"att":90.3,"je":4.2,"jl":4.2,"rh":"Maybe","re":"SY 25-26 Decision TBD","co":0,"ct":"","cd":"","hn":"","tr":null,"ty":null},{"n":"Anne Forline","a":[],"e":"anne.forline@gmail.com","y":["2024-2025","2023-2024"],"c":2,"r":"Certified Tutor","rs":["Certified Tutor"],"si":"Gloucester Township School District","sis":["Gloucester Township School District"],"di":"Glendora Elementary School","dis":["Glendora Elementary School"],"s":"Terminated","t":"strong","mp":3.0,"py":"2023-2024","am":"Yes","em":"Yes","lm":"Yes","acm":"No","pi":25.0,"pr":0.0,"p2":0.0,"att":100.0,"je":4.9,"jl":4.7,"rh":"Yes","re":"Unknown (Not Listed)","co":0,"ct":"","cd":"","hn":"","tr":null,"ty":null},{"n":"Lisa Fisher","a":[],"e":"lfisher472@gmail.com","y":["2024-2025","2023-2024"],"c":2,"r":"Certified Tutor","rs":["Certified Tutor"],"si":"Gloucester Township School District","sis":["Gloucester Township School District"],"di":"Blackwood Elementary School","dis":["Blackwood Elementary School"],"s":"Terminated","t":"stellar","mp":4.0,"py":"2023-2024","am":"Yes","em":"Yes","lm":"Yes","acm":"Yes","pi":50.0,"pr":12.5,"p2":18.8,"att":92.9,"je":4.6,"jl":4.6,"rh":"Yes","re":"Unknown (Not Listed)","co":0,"ct":"","cd":"","hn":"","tr":null,"ty":null},{"n":"Kristina Zingler","a":[],"e":"kristinazingler@gmail.com","y":["2023-2024"],"c":1,"r":"Certified Tutor","rs":["Certified Tutor"],"si":"Gloucester Township School District","sis":["Gloucester Township School District"],"di":"Blackwood Elementary School","dis":["Blackwood Elementary School"],"s":"Terminated","t":"strong","mp":3.0,"py":"2023-2024","am":"Yes","em":"Yes","lm":"Yes","acm":"No","pi":36.4,"pr":45.5,"p2":0.0,"att":98.1,"je":4.4,"jl":4.5,"rh":"Yes","re":"Unknown (Not Listed)","co":0,"ct":"","cd":"","hn":"","tr":null,"ty":null},{"n":"Mary Edwards-Andrews","a":[],"e":"andretta2@msn.com","y":["2024-2025","2023-2024"],"c":2,"r":"Certified Tutor","rs":["Certified Tutor"],"si":"N/A","sis":[],"di":"N/A","dis":[],"s":"Terminated","t":"incomplete","mp":null,"py":"2023-2024","am":"#VALUE!","em":"Yes","lm":"Yes","acm":"No","pi":null,"pr":null,"p2":null,"att":null,"je":null,"jl":null,"rh":"Unknown - atleast 1 metric missing","re":"Unknown (Not Listed)","co":0,"ct":"","cd":"","hn":"","tr":null,"ty":null},{"n":"Barbara Conover","a":[],"e":"barb.conover@gmail.com","y":["2023-2024"],"c":1,"r":"Certified Tutor","rs":["Certified Tutor"],"si":"Gloucester Township School District","sis":["Gloucester Township School District"],"di":"Erial Elementary School","dis":["Erial Elementary School"],"s":"Terminated","t":"needs_support","mp":1.0,"py":"2023-2024","am":"Yes","em":"No","lm":"No","acm":"No","pi":41.7,"pr":25.0,"p2":0.0,"att":96.6,"je":3.9,"jl":3.6,"rh":"No","re":"Unknown (Not Listed)","co":0,"ct":"","cd":"","hn":"","tr":null,"ty":null},{"n":"Colin Camp","a":[],"e":"colincamp10@gmail.com","y":["2025-2026","2023-2024"],"c":2,"r":"Certified Tutor","rs":["Certified Tutor"],"si":"Hamilton Township School District","sis":["Gloucester Township School District","Hamilton Township School District"],"di":"LEA - Hamiton Twp","dis":["Erial Elementary School","LEA - Hamiton Twp"],"s":"Active","t":"stellar","mp":4.0,"py":"2023-2024","am":"Yes","em":"Yes","lm":"Yes","acm":"Yes","pi":50.0,"pr":7.1,"p2":21.4,"att":98.9,"je":4.8,"jl":4.7,"rh":"Yes","re":"Unknown (Not Listed)","co":0,"ct":"","cd":"","hn":"","tr":"Resigned without giving proper notice; found another employment","ty":"2025-2026"},{"n":"Victoria Nachimson","a":[],"e":"vanachimson@gmail.com","y":["2025-2026","2024-2025","2023-2024"],"c":3,"r":"Certified Tutor","rs":["Certified Tutor"],"si":"Penns Grove - Carneys Point Regional School D","sis":["Gloucester Township School District","Penns Grove - Carneys Point Regional School District"],"di":"","dis":["Union Valley Elementary School"],"s":"Active","t":"developing","mp":2.0,"py":"2023-2024","am":"Yes","em":"No","lm":"No","acm":"Yes","pi":83.3,"pr":0.0,"p2":20.0,"att":98.2,"je":3.9,"jl":2.8,"rh":"Maybe","re":"Unknown (Not Listed)","co":0,"ct":"Observation by PM Team, Other (please describe below), Other (please describe be","cd":"2/5/2026, 2/12/2026,","hn":"On Watch, On Watch, On Watch, On Watch","tr":null,"ty":null},{"n":"Heather Sherrill","a":[],"e":"heathersherrill@gmail.com","y":["2023-2024"],"c":1,"r":"Certified Tutor","rs":["Certified Tutor"],"si":"Gloucester Township School District","sis":["Gloucester Township School District"],"di":"Glendora Elementary School","dis":["Glendora Elementary School"],"s":"Terminated","t":"stellar","mp":4.0,"py":"2023-2024","am":"Yes","em":"Yes","lm":"Yes","acm":"Yes","pi":58.3,"pr":16.7,"p2":33.3,"att":98.8,"je":4.6,"jl":4.2,"rh":"Yes","re":"Unknown (Not Listed)","co":0,"ct":"","cd":"","hn":"","tr":null,"ty":null},{"n":"Leslie Daniels","a":[],"e":"lymdaniels@outlook.com","y":["2023-2024"],"c":1,"r":"Certified Tutor","rs":["Certified Tutor"],"si":"Lindenwold","sis":["Lindenwold"],"di":"Lindenwold Middle School","dis":["Lindenwold Middle School"],"s":"Terminated","t":"strong","mp":3.0,"py":"2023-2024","am":"Yes","em":"Yes","lm":"Yes","acm":"No","pi":0.0,"pr":0.0,"p2":0.0,"att":100.0,"je":4.3,"jl":4.4,"rh":"Yes","re":"Unknown (Not Listed)","co":0,"ct":"","cd":"","hn":"","tr":null,"ty":null},{"n":"Michelle Polillo","a":[],"e":"meesh615@aol.com","y":["2023-2024"],"c":1,"r":"Certified Tutor","rs":["Certified Tutor"],"si":"Lindenwold","sis":["Lindenwold"],"di":"Lindenwold School 5","dis":["Lindenwold School 5"],"s":"Terminated","t":"stellar","mp":4.0,"py":"2023-2024","am":"Yes","em":"Yes","lm":"Yes","acm":"Yes","pi":50.0,"pr":0.0,"p2":8.3,"att":100.0,"je":4.8,"jl":4.2,"rh":"Yes","re":"Unknown (Not Listed)","co":0,"ct":"","cd":"","hn":"","tr":null,"ty":null},{"n":"Glenn Harris","a":[],"e":"welshtenor29@gmail.com","y":["2025-2026","2024-2025","2023-2024"],"c":3,"r":"Certified Tutor","rs":["Certified Tutor"],"si":"Penns Grove - Carneys Point Regional School D","sis":["Lindenwold","Penns Grove - Carneys Point Regional School District"],"di":"","dis":["Lindenwold School 5"],"s":"Active","t":"developing","mp":2.0,"py":"2023-2024","am":"Yes","em":"No","lm":"Yes","acm":"No","pi":27.3,"pr":9.1,"p2":0.0,"att":100.0,"je":4.2,"jl":4.0,"rh":"Maybe","re":"Unknown (Not Listed)","co":0,"ct":"","cd":"","hn":"","tr":null,"ty":null},{"n":"JACLYN MCGOVERN","a":[],"e":"jmcgovern@wtsd.org","y":["2024-2025","2023-2024"],"c":2,"r":"Certified Tutor","rs":["Certified Tutor"],"si":"Waterford Township","sis":["Waterford Township"],"di":"Atco Elementary","dis":["Atco Elementary"],"s":"Terminated","t":"strong","mp":3.0,"py":"2024-2025","am":"Yes","em":"No","lm":"Yes","acm":"Yes","pi":63.6,"pr":0.0,"p2":null,"att":95.2,"je":3.9,"jl":4.0,"rh":"Yes","re":"SY 25-26 Decision TBD","co":0,"ct":"","cd":"","hn":"","tr":null,"ty":null},{"n":"Madeline Crone","a":[],"e":"mcrone@wtsd.org","y":["2024-2025","2023-2024"],"c":2,"r":"Certified Tutor","rs":["Certified Tutor"],"si":"Waterford Township","sis":["Waterford Township"],"di":"Atco Elementary","dis":["Atco Elementary"],"s":"Terminated","t":"strong","mp":3.0,"py":"2024-2025","am":"Yes","em":"No","lm":"Yes","acm":"Yes","pi":57.1,"pr":14.3,"p2":null,"att":95.0,"je":4.1,"jl":4.1,"rh":"Yes","re":"SY 25-26 Decision TBD","co":0,"ct":"","cd":"","hn":"","tr":null,"ty":null},{"n":"Casey Bromley","a":[],"e":"caseyannbromley@gmail.com","y":["2024-2025","2023-2024"],"c":2,"r":"Certified Tutor","rs":["Certified Tutor"],"si":"Waterford Township","sis":["Waterford Township"],"di":"Atco Elementary","dis":["Atco Elementary"],"s":"Terminated","t":"developing","mp":2.0,"py":"2024-2025","am":"Yes","em":"No","lm":"Yes","acm":"No","pi":28.6,"pr":0.0,"p2":null,"att":96.7,"je":4.2,"jl":4.1,"rh":"Maybe","re":"SY 25-26 Decision TBD","co":0,"ct":"","cd":"","hn":"","tr":null,"ty":null},{"n":"Andrea Bowman","a":[],"e":"abowman@wtsd.org","y":["2024-2025","2023-2024"],"c":2,"r":"Certified Tutor","rs":["Certified Tutor"],"si":"Waterford Township","sis":["Waterford Township"],"di":"Waterford Elementary","dis":["Waterford Elementary"],"s":"Terminated","t":"stellar","mp":4.0,"py":"2024-2025","am":"Yes","em":"Yes","lm":"Yes","acm":"Yes","pi":53.3,"pr":0.0,"p2":null,"att":95.0,"je":4.8,"jl":4.6,"rh":"Yes","re":"SY 25-26 Decision TBD","co":0,"ct":"","cd":"","hn":"","tr":null,"ty":null},{"n":"Candice Michelini","a":[],"e":"cmichelini@wtsd.org","y":["2024-2025","2023-2024"],"c":2,"r":"Instructional Coach","rs":["Certified Tutor","Instructional Coach"],"si":"Waterford Township","sis":["Waterford Township"],"di":"Waterford Elementary","dis":["Waterford Elementary"],"s":"Terminated","t":"strong","mp":3.0,"py":"2024-2025","am":"Yes","em":"Yes","lm":"Yes","acm":"No","pi":40.9,"pr":13.6,"p2":null,"att":100.0,"je":4.3,"jl":4.3,"rh":"Yes","re":"SY 25-26 Decision TBD","co":0,"ct":"","cd":"","hn":"","tr":null,"ty":null},{"n":"Nichole Landicini","a":[],"e":"nicholelandicini@gmail.com","y":["2023-2024"],"c":1,"r":"Certified Tutor","rs":["Certified Tutor"],"si":"Waterford Township","sis":["Waterford Township"],"di":"Waterford Elementary","dis":["Waterford Elementary"],"s":"Terminated","t":"strong","mp":3.0,"py":"2023-2024","am":"Yes","em":"Yes","lm":"No","acm":"Yes","pi":75.0,"pr":0.0,"p2":50.0,"att":98.3,"je":4.4,"jl":3.6,"rh":"Yes","re":"Unknown (Not Listed)","co":0,"ct":"","cd":"","hn":"","tr":null,"ty":null},{"n":"Chrisanthi Finn","a":[],"e":"chrisanthi.finn@gmail.com","y":["2023-2024"],"c":1,"r":"Certified Tutor","rs":["Certified Tutor"],"si":"Waterford Township","sis":["Waterford Township"],"di":"Waterford Elementary","dis":["Waterford Elementary"],"s":"Terminated","t":"strong","mp":3.0,"py":"2023-2024","am":"Yes","em":"Yes","lm":"Yes","acm":"No","pi":28.6,"pr":14.3,"p2":0.0,"att":91.4,"je":4.9,"jl":4.9,"rh":"Yes","re":"Unknown (Not Listed)","co":0,"ct":"","cd":"","hn":"","tr":null,"ty":null},{"n":"Diana Senatore","a":[],"e":"senatore.diana@gmail.com","y":["2023-2024"],"c":1,"r":"Certified Tutor","rs":["Certified Tutor"],"si":"Waterford Township","sis":["Waterford Township"],"di":"Waterford Elementary","dis":["Waterford Elementary"],"s":"Terminated","t":"stellar","mp":4.0,"py":"2023-2024","am":"Yes","em":"Yes","lm":"Yes","acm":"Yes","pi":100.0,"pr":0.0,"p2":25.0,"att":100.0,"je":4.6,"jl":4.5,"rh":"Yes","re":"Unknown (Not Listed)","co":0,"ct":"","cd":"","hn":"","tr":null,"ty":null},{"n":"Durel Freeman","a":[],"e":"rell_07@comcast.net","y":["2023-2024"],"c":1,"r":"Certified Tutor","rs":["Certified Tutor"],"si":"Camden City School District","sis":["Camden City School District"],"di":"VETS","dis":["VETS"],"s":"Terminated","t":"strong","mp":3.0,"py":"2023-2024","am":"Yes","em":"Yes","lm":"Yes","acm":"No","pi":28.6,"pr":14.3,"p2":28.6,"att":88.8,"je":4.4,"jl":4.4,"rh":"Yes","re":"Unknown (Not Listed)","co":0,"ct":"Other (please describe below)","cd":"3/21/2025","hn":"Yes","tr":null,"ty":null},{"n":"Ciarra Martin","a":[],"e":"ciarramartin.2014@gmail.com","y":["2023-2024"],"c":1,"r":"Certified Tutor","rs":["Certified Tutor"],"si":"Maple Shade","sis":["Maple Shade"],"di":"Maude Wilkins Elementary,KIPP - Camden (Lanni","dis":["Maude Wilkins Elementary,KIPP - Camden (Lanning Square Primary)"],"s":"Terminated","t":"strong","mp":3.0,"py":"2023-2024","am":"Yes","em":"Yes","lm":"Yes","acm":"No","pi":33.3,"pr":0.0,"p2":10.0,"att":100.0,"je":4.6,"jl":4.0,"rh":"Yes","re":"Unknown (Not Listed)","co":0,"ct":"","cd":"","hn":"","tr":null,"ty":null},{"n":"Natalia Hoyt","a":[],"e":"nhoyt@rosevillecharter.org","y":["2023-2024"],"c":1,"r":"Certified Tutor","rs":["Certified Tutor"],"si":"Roseville Community Charter School","sis":["Roseville Community Charter School"],"di":"LEA- Roseville CS","dis":["LEA- Roseville CS"],"s":"Terminated","t":"stellar","mp":4.0,"py":"2023-2024","am":"Yes","em":"Yes","lm":"Yes","acm":"Yes","pi":50.0,"pr":0.0,"p2":19.2,"att":89.3,"je":4.6,"jl":4.5,"rh":"Yes","re":"Unknown (Not Listed)","co":0,"ct":"","cd":"","hn":"","tr":null,"ty":null},{"n":"Adjele Afenutsu-Tetteh","a":[],"e":"atetteh@rosevillecharter.org","y":["2023-2024"],"c":1,"r":"Certified Tutor","rs":["Certified Tutor"],"si":"Roseville Community Charter School","sis":["Roseville Community Charter School"],"di":"LEA- Roseville CS","dis":["LEA- Roseville CS"],"s":"Terminated","t":"stellar","mp":4.0,"py":"2023-2024","am":"Yes","em":"Yes","lm":"Yes","acm":"Yes","pi":65.4,"pr":7.7,"p2":26.9,"att":99.3,"je":4.6,"jl":4.5,"rh":"Yes","re":"Unknown (Not Listed)","co":0,"ct":"","cd":"","hn":"","tr":null,"ty":null},{"n":"Maryann Ficker","a":[],"e":"fickermaryann@gmail.com","y":["2025-2026","2024-2025","2023-2024"],"c":3,"r":"Certified Tutor","rs":["Certified Tutor"],"si":"iLearn Science & Arts Charter Elementary Scho","sis":["KIPP NJ/TEAM schools","iLearn Science & Arts Charter Elementary School- Paterson"],"di":"LEA - iLearn Paterson ES","dis":["LEA - KIPP Newark- KURA","LEA - iLearn Paterson ES"],"s":"Active","t":"strong","mp":3.0,"py":"2024-2025","am":"Yes","em":"No","lm":"Yes","acm":"Yes","pi":45.5,"pr":9.1,"p2":0.0,"att":100.0,"je":4.2,"jl":4.4,"rh":"Yes","re":"SY 25-26 Decision TBD","co":0,"ct":"Observation by PM Team","cd":"2/4/2026","hn":"On Watch","tr":null,"ty":null},{"n":"Alesia Alexander","a":[],"e":"alesia.n.alexander@gmail.com","y":["2024-2025","2023-2024"],"c":2,"r":"Dual Role","rs":["Certified Tutor","Dual Role"],"si":"KIPP NJ/TEAM schools","sis":["KIPP NJ/TEAM schools"],"di":"LEA - KIPP Newark- KURA","dis":["LEA - KIPP Newark- KURA"],"s":"Terminated","t":"developing","mp":2.0,"py":"2024-2025","am":"No","em":"No","lm":"Yes","acm":"Yes","pi":65.0,"pr":0.0,"p2":null,"att":35.7,"je":4.0,"jl":4.0,"rh":"Maybe","re":"SY 25-26 Decision TBD","co":0,"ct":"","cd":"","hn":"","tr":null,"ty":null},{"n":"Stephen Graff","a":[],"e":"sgraffwriter@gmail.com","y":["2023-2024"],"c":1,"r":"Certified Tutor","rs":["Certified Tutor"],"si":"East Greenwich","sis":["East Greenwich"],"di":"East Greenwich","dis":["East Greenwich"],"s":"Terminated","t":"strong","mp":3.0,"py":"2023-2024","am":"Yes","em":"Yes","lm":"Yes","acm":"No","pi":null,"pr":null,"p2":null,"att":98.0,"je":null,"jl":null,"rh":"Yes","re":"Unknown (Not Listed)","co":0,"ct":"","cd":"","hn":"","tr":null,"ty":null},{"n":"Kathryn Hennigan","a":[],"e":"khennigan23@gmail.com","y":["2025-2026","2023-2024"],"c":2,"r":"Dual Role","rs":["Certified Tutor","Dual Role"],"si":"Haddon Township","sis":["East Greenwich","Haddon Township"],"di":"Haddon Twp","dis":["East Greenwich","Haddon Twp"],"s":"Active","t":"developing","mp":2.0,"py":"2023-2024","am":"Yes","em":"No","lm":"Yes","acm":"No","pi":0.0,"pr":0.0,"p2":0.0,"att":93.7,"je":4.0,"jl":4.0,"rh":"Maybe","re":"Unknown (Not Listed)","co":0,"ct":"","cd":"","hn":"","tr":null,"ty":null},{"n":"Erica Mela","a":[],"e":"emela618@gmail.com","y":["2024-2025","2023-2024"],"c":2,"r":"Certified Tutor","rs":["Certified Tutor"],"si":"East Greenwich","sis":["East Greenwich"],"di":"East Greenwich","dis":["East Greenwich"],"s":"Terminated","t":"developing","mp":2.0,"py":"2024-2025","am":"No","em":"Yes","lm":"Yes","acm":"No","pi":20.0,"pr":20.0,"p2":7.1,"att":79.5,"je":4.7,"jl":4.6,"rh":"Maybe","re":"SY 25-26 Decision TBD","co":1,"ct":"Other (please describe below)","cd":"5/29/2025","hn":"Yes","tr":null,"ty":null},{"n":"David Yoon","a":[],"e":"david.yoon8710@gmail.com","y":["2024-2025","2023-2024"],"c":2,"r":"Certified Tutor","rs":["Certified Tutor"],"si":"Lawrence Township","sis":["Lawrence Township"],"di":"LEA- Lawrence Twp","dis":["LEA- Lawrence Twp"],"s":"Terminated","t":"strong","mp":3.0,"py":"2024-2025","am":"Yes","em":"No","lm":"Yes","acm":"Yes","pi":88.9,"pr":0.0,"p2":55.6,"att":91.5,"je":3.8,"jl":4.0,"rh":"Yes","re":"SY 25-26 Decision TBD","co":0,"ct":"","cd":"","hn":"","tr":null,"ty":null},{"n":"Dylan Sepulveda","a":[],"e":"dylansepulveda@yahoo.com","y":["2024-2025","2023-2024"],"c":2,"r":"Certified Tutor","rs":["Certified Tutor"],"si":"N/A","sis":[],"di":"N/A","dis":[],"s":"Terminated","t":"needs_support","mp":0.0,"py":"2024-2025","am":"No","em":"No","lm":"No","acm":"No","pi":null,"pr":null,"p2":null,"att":82.4,"je":4.1,"jl":3.8,"rh":"No","re":"SY 25-26 Decision TBD","co":1,"ct":"Other (please describe below)","cd":"5/20/2025","hn":"No","tr":null,"ty":null},{"n":"Jessica West","a":[],"e":"jrwest28@gmail.com","y":["2025-2026","2023-2024"],"c":2,"r":"Certified Tutor","rs":["Certified Tutor"],"si":"Hamilton Township School District","sis":["Hamilton Township School District"],"di":"LEA - Hamiton Twp","dis":["LEA - Hamiton Twp"],"s":"Active","t":"incomplete","mp":null,"py":"2025-2026","am":"","em":"","lm":"","acm":"","pi":null,"pr":null,"p2":null,"att":97.1,"je":4.8,"jl":4.6,"rh":"","re":"SY 25-26 Decision TBD","co":0,"ct":"","cd":"","hn":"","tr":null,"ty":null},{"n":"Lynn Hickey","a":[],"e":"lynnh724@yahoo.com","y":["2023-2024"],"c":1,"r":"Certified Tutor","rs":["Certified Tutor"],"si":"Boys and Girls Club","sis":["Boys and Girls Club"],"di":"BGC Asbury Park","dis":["BGC Asbury Park"],"s":"Terminated","t":"stellar","mp":4.0,"py":"2023-2024","am":"Yes","em":"Yes","lm":"Yes","acm":"Yes","pi":71.4,"pr":0.0,"p2":28.6,"att":97.9,"je":4.5,"jl":4.4,"rh":"Yes","re":"Unknown (Not Listed)","co":0,"ct":"","cd":"","hn":"","tr":null,"ty":null},{"n":"Brianna Storz","a":[],"e":"bstorz1155@msn.com","y":["2024-2025","2023-2024"],"c":2,"r":"Certified Tutor","rs":["Certified Tutor"],"si":"Boys and Girls Club","sis":["Boys and Girls Club"],"di":"Thurgood Marshall","dis":["Thurgood Marshall"],"s":"Terminated","t":"developing","mp":2.0,"py":"2024-2025","am":"Yes","em":"No","lm":"Yes","acm":"No","pi":null,"pr":null,"p2":null,"att":97.3,"je":4.1,"jl":4.2,"rh":"Maybe","re":"SY 25-26 Decision TBD","co":0,"ct":"","cd":"","hn":"","tr":null,"ty":null},{"n":"Michele Faber","a":[],"e":"dmakfaber@icloud.com","y":["2023-2024"],"c":1,"r":"Certified Tutor","rs":["Certified Tutor"],"si":"Boys and Girls Club","sis":["Boys and Girls Club"],"di":"Bradley Elementary","dis":["Bradley Elementary"],"s":"Terminated","t":"strong","mp":3.0,"py":"2023-2024","am":"Yes","em":"Yes","lm":"Yes","acm":"No","pi":null,"pr":null,"p2":null,"att":100.0,"je":null,"jl":null,"rh":"Yes","re":"Unknown (Not Listed)","co":0,"ct":"","cd":"","hn":"","tr":"Resigned after being rude to member on program's team","ty":"2024-2025"},{"n":"Sydney Crawford","a":[],"e":"sydneyncrawford@gmail.com","y":["2024-2025","2023-2024"],"c":2,"r":"Certified Tutor","rs":["Certified Tutor"],"si":"Boys and Girls Club","sis":["Boys and Girls Club"],"di":"Bradley Elementary","dis":["Bradley Elementary"],"s":"Terminated","t":"developing","mp":2.0,"py":"2024-2025","am":"No","em":"Yes","lm":"Yes","acm":"No","pi":null,"pr":null,"p2":null,"att":83.3,"je":5.0,"jl":4.0,"rh":"Maybe","re":"SY 25-26 Decision TBD","co":0,"ct":"","cd":"","hn":"","tr":null,"ty":null},{"n":"Tanzeela Qazi","a":[],"e":"tanzeela.o.qazi@gmail.com","y":["2025-2026","2024-2025","2023-2024"],"c":3,"r":"Non-cert Sub Tutor","rs":["Certified Tutor","Non-cert Sub Tutor"],"si":"Hamilton Township School District","sis":["Hamilton Township School District"],"di":"","dis":[],"s":"Active","t":"strong","mp":3.0,"py":"2024-2025","am":"Yes","em":"Yes","lm":"Yes","acm":"No","pi":22.2,"pr":0.0,"p2":0.0,"att":88.3,"je":4.7,"jl":4.4,"rh":"Yes","re":"SY 25-26 Decision TBD","co":0,"ct":"","cd":"","hn":"","tr":null,"ty":null},{"n":"Joseph Stahl","a":[],"e":"joe.jam.geo@gmail.com","y":["2023-2024"],"c":1,"r":"Instructional Coach","rs":["Instructional Coach"],"si":"Pemberton Township","sis":["Pemberton Township"],"di":"DENBO-CRICHTON SCHOOL","dis":["DENBO-CRICHTON SCHOOL"],"s":"Terminated","t":"strong","mp":3.0,"py":"2023-2024","am":"Yes","em":"Yes","lm":"Yes","acm":"No","pi":33.3,"pr":11.1,"p2":0.0,"att":100.0,"je":4.9,"jl":4.8,"rh":"Yes","re":"Unknown (Not Listed)","co":0,"ct":"","cd":"","hn":"","tr":null,"ty":null},{"n":"Danielle Hallahan","a":[],"e":"daniellem1980@gmail.com","y":["2025-2026","2024-2025","2023-2024"],"c":3,"r":"Dual Role","rs":["Instructional Coach","Dual Role"],"si":"Lindenwold","sis":["Lindenwold"],"di":"Lindenwold School 5","dis":["Lindenwold School 5"],"s":"Active","t":"strong","mp":3.0,"py":"2023-2024","am":"Yes","em":"Yes","lm":"Yes","acm":"No","pi":42.9,"pr":14.3,"p2":0.0,"att":100.0,"je":4.4,"jl":4.4,"rh":"Yes","re":"Unknown (Not Listed)","co":0,"ct":"","cd":"","hn":"","tr":null,"ty":null},{"n":"Tracey Bober","a":[],"e":"tbober@wtsd.org","y":["2023-2024"],"c":1,"r":"Instructional Coach","rs":["Instructional Coach"],"si":"Waterford Township","sis":["Waterford Township"],"di":"Atco Elementary","dis":["Atco Elementary"],"s":"Terminated","t":"developing","mp":2.0,"py":"2023-2024","am":"Yes","em":"No","lm":"Yes","acm":"No","pi":null,"pr":null,"p2":null,"att":100.0,"je":4.0,"jl":4.0,"rh":"Maybe","re":"Unknown (Not Listed)","co":0,"ct":"","cd":"","hn":"","tr":"Resigned due to personal issues","ty":"2024-2025"},{"n":"Christina Kennevan","a":[],"e":"ckennevan@wtsd.org","y":["2024-2025","2023-2024"],"c":2,"r":"Site Coordinator","rs":["Instructional Coach","Site Coordinator"],"si":"N/A","sis":[],"di":"N/A","dis":[],"s":"Terminated","t":"needs_support","mp":1.0,"py":"2024-2025","am":"Yes","em":"No","lm":"No","acm":"No","pi":41.7,"pr":12.5,"p2":null,"att":100.0,"je":3.9,"jl":3.9,"rh":"No","re":"SY 25-26 Decision TBD","co":0,"ct":"","cd":"","hn":"","tr":null,"ty":null},{"n":"Fred Aiken","a":[],"e":"phred327@gmail.com","y":["2024-2025","2023-2024"],"c":2,"r":"Dual Role","rs":["Instructional Coach","Dual Role"],"si":"N/A","sis":[],"di":"N/A","dis":[],"s":"Terminated","t":"strong","mp":3.0,"py":"2024-2025","am":"Yes","em":"Yes","lm":"Yes","acm":"No","pi":38.5,"pr":15.4,"p2":null,"att":100.0,"je":4.8,"jl":4.7,"rh":"Yes","re":"SY 25-26 Decision TBD","co":0,"ct":"","cd":"","hn":"","tr":null,"ty":null},{"n":"Claudia  Barbieri","a":[],"e":"ariani820@gmail.com","y":["2024-2025","2023-2024"],"c":2,"r":"Dual Role","rs":["Instructional Coach","Dual Role"],"si":"Hamilton Township","sis":["Hamilton Township"],"di":"Loring Flemming Elementary School","dis":["Loring Flemming Elementary School"],"s":"Terminated","t":"incomplete","mp":null,"py":"2025-2026","am":"#VALUE!","em":"Yes","lm":"Yes","acm":"No","pi":null,"pr":null,"p2":null,"att":null,"je":null,"jl":null,"rh":"Unknown - atleast 1 metric missing","re":"SY 25-26 Decision TBD","co":1,"ct":"Other (please describe below)","cd":"5/16/2025","hn":"Yes","tr":null,"ty":null},{"n":"Ermy Peralta Williamson","a":[],"e":"ermyperaltaw@gmail.com","y":["2023-2024"],"c":1,"r":"Instructional Coach","rs":["Instructional Coach"],"si":"iLearn CMO","sis":["iLearn CMO"],"di":"LEA - iLearn Passaic MS","dis":["LEA - iLearn Passaic MS"],"s":"Terminated","t":"needs_support","mp":0.0,"py":"2023-2024","am":"No","em":"No","lm":"No","acm":"No","pi":51.8,"pr":3.6,"p2":17.8,"att":41.3,"je":4.1,"jl":4.1,"rh":"No","re":"Unknown (Not Listed)","co":0,"ct":"","cd":"","hn":"","tr":null,"ty":null},{"n":"Janine L'Etoile","a":[],"e":"janine.pietrangelo@gmail.com","y":["2023-2024"],"c":1,"r":"Dual Role","rs":["Dual Role"],"si":"Maple Shade","sis":["Maple Shade"],"di":"Maude Wilkins Elementary","dis":["Maude Wilkins Elementary"],"s":"Terminated","t":"stellar","mp":4.0,"py":"2023-2024","am":"Yes","em":"Yes","lm":"Yes","acm":"Yes","pi":50.0,"pr":25.0,"p2":null,"att":100.0,"je":4.9,"jl":4.5,"rh":"Yes","re":"Unknown (Not Listed)","co":0,"ct":"","cd":"","hn":"","tr":null,"ty":null},{"n":"Karen Rockhill","a":[],"e":"karenrockhill@comcast.net","y":["2024-2025","2023-2024"],"c":2,"r":"Dual Role","rs":["Dual Role"],"si":"Gloucester Township School District, Gloucest","sis":["Gloucester Township School District, Gloucester Township School District"],"di":"Blackwood Elementary School, Blackwood Elemen","dis":["Blackwood Elementary School, Blackwood Elementary School"],"s":"Terminated","t":"strong","mp":3.0,"py":"2024-2025","am":"Yes","em":"Yes","lm":"Yes","acm":"No","pi":34.0,"pr":12.8,"p2":null,"att":100.0,"je":4.6,"jl":4.4,"rh":"Yes","re":"SY 25-26 Decision TBD","co":0,"ct":"","cd":"","hn":"","tr":null,"ty":null},{"n":"Renee Bannister","a":[],"e":"rbannister526@gmail.com","y":["2023-2024"],"c":1,"r":"Dual Role","rs":["Dual Role"],"si":"Gloucester Township School District","sis":["Gloucester Township School District"],"di":"Chews Elementary School","dis":["Chews Elementary School"],"s":"Terminated","t":"developing","mp":2.0,"py":"2023-2024","am":"Yes","em":"Yes","lm":"No","acm":"No","pi":42.9,"pr":28.6,"p2":null,"att":98.6,"je":4.6,"jl":3.9,"rh":"Maybe","re":"Unknown (Not Listed)","co":0,"ct":"","cd":"","hn":"","tr":null,"ty":null},{"n":"Donald Whitman","a":[],"e":"drwedleadership@gmail.com","y":["2023-2024"],"c":1,"r":"Dual Role","rs":["Dual Role"],"si":"Gloucester Township School District","sis":["Gloucester Township School District"],"di":"Erial Elementary School","dis":["Erial Elementary School"],"s":"Terminated","t":"strong","mp":3.0,"py":"2023-2024","am":"Yes","em":"Yes","lm":"Yes","acm":"No","pi":null,"pr":null,"p2":null,"att":100.0,"je":null,"jl":null,"rh":"Yes","re":"Unknown (Not Listed)","co":0,"ct":"","cd":"","hn":"","tr":null,"ty":null},{"n":"Teriann Jensen","a":[],"e":"tajensen77@gmail.com","y":["2023-2024"],"c":1,"r":"Dual Role","rs":["Dual Role"],"si":"Gloucester Township School District","sis":["Gloucester Township School District"],"di":"Gloucester Twp Elementary School","dis":["Gloucester Twp Elementary School"],"s":"Terminated","t":"developing","mp":2.0,"py":"2023-2024","am":"Yes","em":"No","lm":"Yes","acm":"No","pi":null,"pr":null,"p2":null,"att":100.0,"je":4.0,"jl":4.3,"rh":"Maybe","re":"Unknown (Not Listed)","co":0,"ct":"","cd":"","hn":"","tr":null,"ty":null},{"n":"Gwen Goolsby Tillery","a":[],"e":"successarizeinfo@gmail.com","y":["2023-2024"],"c":1,"r":"Dual Role","rs":["Dual Role"],"si":"Clementon","sis":["Clementon"],"di":"Clementon Elementary School","dis":["Clementon Elementary School"],"s":"Terminated","t":"developing","mp":2.0,"py":"2023-2024","am":"Yes","em":"No","lm":"Yes","acm":"No","pi":null,"pr":null,"p2":null,"att":100.0,"je":4.0,"jl":4.5,"rh":"Maybe","re":"Unknown (Not Listed)","co":0,"ct":"","cd":"","hn":"","tr":null,"ty":null},{"n":"Tabitha Parris","a":[],"e":"tabitha.njtc@gmail.com","y":["2025-2026","2024-2025","2023-2024"],"c":3,"r":"Dual Role","rs":["Dual Role"],"si":"Penns Grove - Carneys Point Regional School D","sis":["Salem City","Penns Grove - Carneys Point Regional School District"],"di":"","dis":["Salem Middle School"],"s":"Active","t":"needs_support","mp":1.0,"py":"2023-2024","am":"Yes","em":"No","lm":"No","acm":"No","pi":33.3,"pr":0.0,"p2":null,"att":100.0,"je":3.4,"jl":3.6,"rh":"No","re":"Unknown (Not Listed)","co":0,"ct":"Other (please describe below)","cd":"6/27/2025","hn":"No","tr":null,"ty":null},{"n":"Faye Lewis","a":[],"e":"fayelewis2@gmail.com","y":["2025-2026","2024-2025","2023-2024"],"c":3,"r":"Dual Role","rs":["Dual Role"],"si":"Haddon Township","sis":["Haddon Township"],"di":"","dis":[],"s":"Active","t":"incomplete","mp":null,"py":"2025-2026","am":"","em":"","lm":"","acm":"","pi":null,"pr":null,"p2":null,"att":null,"je":null,"jl":null,"rh":"","re":"SY 25-26 Decision TBD","co":0,"ct":"","cd":"","hn":"","tr":"WIll be having surgery","ty":"2024-2025"},{"n":"Lauren Eckles","a":[],"e":"spence2435@aol.com","y":["2025-2026","2023-2024"],"c":2,"r":"Instructional Coach/ Site Coordinator Dual","rs":["Dual Role","Instructional Coach/ Site Coordinator Dual"],"si":"Hamilton Township School District","sis":["Hamilton Township School District"],"di":"LEA - Hamiton Twp","dis":["LEA - Hamiton Twp"],"s":"Active","t":"incomplete","mp":null,"py":"2025-2026","am":"","em":"","lm":"","acm":"","pi":null,"pr":null,"p2":null,"att":null,"je":null,"jl":null,"rh":"","re":"SY 25-26 Decision TBD","co":0,"ct":"","cd":"","hn":"","tr":null,"ty":null},{"n":"Jill Ilagan","a":[],"e":"gjbkilagan@aol.com","y":["2025-2026","2024-2025","2023-2024"],"c":3,"r":"Dual Role","rs":["Site Coordinator","Dual Role"],"si":"Gloucester Township","sis":["Pemberton Township","Gloucester Township"],"di":"","dis":["DENBO-CRICHTON SCHOOL"],"s":"Active","t":"developing","mp":2.0,"py":"2024-2025","am":"No","em":"Yes","lm":"Yes","acm":"No","pi":37.5,"pr":37.5,"p2":null,"att":66.7,"je":4.6,"jl":4.6,"rh":"Maybe","re":"SY 25-26 Decision TBD","co":0,"ct":"","cd":"","hn":"","tr":null,"ty":null},{"n":"Tysheema Burrell","a":[],"e":"dr.burrell2020@gmail.com","y":["2023-2024"],"c":1,"r":"Site Coordinator","rs":["Site Coordinator"],"si":"Lindenwold","sis":["Lindenwold"],"di":"Lindenwold School 4","dis":["Lindenwold School 4"],"s":"Terminated","t":"developing","mp":2.0,"py":"2023-2024","am":"No","em":"Yes","lm":"Yes","acm":"No","pi":null,"pr":null,"p2":null,"att":80.0,"je":5.0,"jl":4.8,"rh":"Maybe","re":"Unknown (Not Listed)","co":0,"ct":"","cd":"","hn":"","tr":null,"ty":null},{"n":"Lisa DiRenzo","a":[],"e":"ldirenzo@wtsd.org","y":["2024-2025","2023-2024"],"c":2,"r":"Site Coordinator","rs":["Site Coordinator"],"si":"N/A","sis":[],"di":"N/A","dis":[],"s":"Terminated","t":"incomplete","mp":null,"py":"2023-2024","am":"#VALUE!","em":"Yes","lm":"Yes","acm":"No","pi":null,"pr":null,"p2":null,"att":null,"je":null,"jl":null,"rh":"Unknown - atleast 1 metric missing","re":"Unknown (Not Listed)","co":0,"ct":"","cd":"","hn":"","tr":null,"ty":null},{"n":"Lisa Hart","a":[],"e":"dtaba@mail.com","y":["2023-2024"],"c":1,"r":"Sub Tutor","rs":["Sub Tutor"],"si":"Lindenwold","sis":["Lindenwold"],"di":"Lindenwold School 4","dis":["Lindenwold School 4"],"s":"Terminated","t":"needs_support","mp":1.0,"py":"2023-2024","am":"Yes","em":"No","lm":"No","acm":"No","pi":22.2,"pr":11.1,"p2":0.0,"att":85.1,"je":3.8,"jl":3.7,"rh":"No","re":"Unknown (Not Listed)","co":0,"ct":"","cd":"","hn":"","tr":null,"ty":null},{"n":"Esperant Kazzembe","a":[],"e":"esperant.kazzembe@gmail.com","y":["2023-2024"],"c":1,"r":"Tutor","rs":["Tutor"],"si":"iLearn CMO","sis":["iLearn CMO"],"di":"LEA - iLearn Bergen ES","dis":["LEA - iLearn Bergen ES"],"s":"Terminated","t":"strong","mp":3.0,"py":"2023-2024","am":"Yes","em":"Yes","lm":"Yes","acm":"No","pi":53.9,"pr":7.9,"p2":11.5,"att":92.5,"je":5.0,"jl":5.0,"rh":"Yes","re":"Unknown (Not Listed)","co":0,"ct":"","cd":"","hn":"","tr":null,"ty":null},{"n":"Justyna Nagorska","a":[],"e":"justyna231996@gmail.com","y":["2023-2024"],"c":1,"r":"Tutor","rs":["Tutor"],"si":"iLearn CMO","sis":["iLearn CMO"],"di":"LEA - iLearn Bergen MS","dis":["LEA - iLearn Bergen MS"],"s":"Terminated","t":"strong","mp":3.0,"py":"2023-2024","am":"Yes","em":"Yes","lm":"Yes","acm":"No","pi":46.1,"pr":17.3,"p2":7.1,"att":93.3,"je":4.9,"jl":4.9,"rh":"Yes","re":"Unknown (Not Listed)","co":0,"ct":"","cd":"","hn":"","tr":null,"ty":null},{"n":"Michael Manners","a":[],"e":"michaelrmanners@outlook.com","y":["2024-2025","2023-2024"],"c":2,"r":"Non-cert Tutor","rs":["Tutor","Non-cert Tutor"],"si":"N/A","sis":[],"di":"N/A","dis":[],"s":"Terminated","t":"incomplete","mp":null,"py":"2023-2024","am":"#VALUE!","em":"Yes","lm":"Yes","acm":"No","pi":null,"pr":null,"p2":null,"att":null,"je":null,"jl":null,"rh":"Unknown - atleast 1 metric missing","re":"Unknown (Not Listed)","co":0,"ct":"","cd":"","hn":"","tr":"Reason Not Applied","ty":"2024-2025"},{"n":"John Hammill","a":[],"e":"john.hammill99@gmail.com","y":["2023-2024"],"c":1,"r":"Tutor","rs":["Tutor"],"si":"Maple Shade","sis":["Maple Shade"],"di":"Maude Wilkins Elementary","dis":["Maude Wilkins Elementary"],"s":"Terminated","t":"developing","mp":2.0,"py":"2023-2024","am":"Yes","em":"Yes","lm":"No","acm":"No","pi":16.7,"pr":0.0,"p2":null,"att":97.5,"je":4.3,"jl":3.8,"rh":"Maybe","re":"Unknown (Not Listed)","co":0,"ct":"","cd":"","hn":"","tr":null,"ty":null},{"n":"Jessica Leung","a":[],"e":"jessicaleung12@gmail.com","y":["2023-2024"],"c":1,"r":"Tutor","rs":["Tutor"],"si":"Maple Shade","sis":["Maple Shade"],"di":"Maude Wilkins Elementary","dis":["Maude Wilkins Elementary"],"s":"Terminated","t":"developing","mp":2.0,"py":"2023-2024","am":"Yes","em":"Yes","lm":"No","acm":"No","pi":22.2,"pr":11.1,"p2":0.0,"att":97.7,"je":4.7,"jl":3.6,"rh":"Maybe","re":"Unknown (Not Listed)","co":0,"ct":"","cd":"","hn":"","tr":null,"ty":null},{"n":"David Angilella","a":[],"e":"yourtutordave@gmail.com","y":["2023-2024"],"c":1,"r":"Tutor","rs":["Tutor"],"si":"Maple Shade","sis":["Maple Shade"],"di":"Maude Wilkins Elementary","dis":["Maude Wilkins Elementary"],"s":"Terminated","t":"strong","mp":3.0,"py":"2023-2024","am":"Yes","em":"Yes","lm":"Yes","acm":"No","pi":35.3,"pr":17.6,"p2":10.0,"att":97.6,"je":4.7,"jl":4.5,"rh":"Yes","re":"Unknown (Not Listed)","co":0,"ct":"","cd":"","hn":"","tr":null,"ty":null},{"n":"Jordanna Conn","a":[],"e":"connjordanna1@gmail.com","y":["2023-2024"],"c":1,"r":"Tutor","rs":["Tutor"],"si":"Maple Shade","sis":["Maple Shade"],"di":"Maude Wilkins Elementary","dis":["Maude Wilkins Elementary"],"s":"Terminated","t":"developing","mp":2.0,"py":"2023-2024","am":"Yes","em":"Yes","lm":"No","acm":"No","pi":0.0,"pr":0.0,"p2":null,"att":100.0,"je":4.9,"jl":3.6,"rh":"Maybe","re":"Unknown (Not Listed)","co":0,"ct":"","cd":"","hn":"","tr":null,"ty":null},{"n":"Isaiah Quinones","a":[],"e":"isaiahq21@gmail.com","y":["2023-2024"],"c":1,"r":"Tutor","rs":["Tutor"],"si":"Maple Shade","sis":["Maple Shade"],"di":"Maude Wilkins Elementary","dis":["Maude Wilkins Elementary"],"s":"Terminated","t":"needs_support","mp":1.0,"py":"2023-2024","am":"Yes","em":"No","lm":"No","acm":"No","pi":37.5,"pr":0.0,"p2":0.0,"att":100.0,"je":4.2,"jl":3.8,"rh":"No","re":"Unknown (Not Listed)","co":0,"ct":"","cd":"","hn":"","tr":null,"ty":null},{"n":"Bernice Smallwood","a":[],"e":"beealexander1220@gmail.com","y":["2023-2024"],"c":1,"r":"Tutor","rs":["Tutor"],"si":"Mount Holly","sis":["Mount Holly"],"di":"Gertrude C. Folwell ES","dis":["Gertrude C. Folwell ES"],"s":"Terminated","t":"strong","mp":3.0,"py":"2023-2024","am":"No","em":"Yes","lm":"Yes","acm":"Yes","pi":74.3,"pr":2.9,"p2":18.8,"att":81.3,"je":4.5,"jl":4.6,"rh":"Yes","re":"Unknown (Not Listed)","co":0,"ct":"","cd":"","hn":"","tr":null,"ty":null},{"n":"Jayda Collazo","a":[],"e":"jarmani1161@gmail.com","y":["2023-2024"],"c":1,"r":"Tutor","rs":["Tutor"],"si":"Mount Holly","sis":["Mount Holly"],"di":"Gertrude C. Folwell ES","dis":["Gertrude C. Folwell ES"],"s":"Terminated","t":"needs_support","mp":1.0,"py":"2023-2024","am":"No","em":"No","lm":"No","acm":"Yes","pi":77.4,"pr":3.2,"p2":24.0,"att":74.2,"je":4.1,"jl":3.8,"rh":"No","re":"Unknown (Not Listed)","co":0,"ct":"","cd":"","hn":"","tr":null,"ty":null},{"n":"Cinder Deni","a":[],"e":"cinderdeni@gmail.com","y":["2023-2024"],"c":1,"r":"Tutor","rs":["Tutor"],"si":"Mount Holly","sis":["Mount Holly"],"di":"Gertrude C. Folwell ES","dis":["Gertrude C. Folwell ES"],"s":"Terminated","t":"strong","mp":3.0,"py":"2023-2024","am":"No","em":"Yes","lm":"Yes","acm":"Yes","pi":64.3,"pr":7.1,"p2":11.1,"att":68.4,"je":4.7,"jl":4.0,"rh":"Yes","re":"Unknown (Not Listed)","co":0,"ct":"","cd":"","hn":"","tr":null,"ty":null},{"n":"Jessica Renard","a":[],"e":"jessicalrenard@gmail.com","y":["2023-2024"],"c":1,"r":"Tutor","rs":["Tutor"],"si":"Pemberton Township","sis":["Pemberton Township"],"di":"DENBO-CRICHTON SCHOOL","dis":["DENBO-CRICHTON SCHOOL"],"s":"Terminated","t":"strong","mp":3.0,"py":"2023-2024","am":"Yes","em":"Yes","lm":"Yes","acm":"No","pi":39.2,"pr":13.7,"p2":9.5,"att":94.8,"je":4.3,"jl":4.1,"rh":"Yes","re":"Unknown (Not Listed)","co":0,"ct":"","cd":"","hn":"","tr":null,"ty":null},{"n":"Michel Bougazelli","a":[],"e":"mbougazelli@gmail.com","y":["2023-2024"],"c":1,"r":"Tutor","rs":["Tutor"],"si":"Pemberton Township","sis":["Pemberton Township"],"di":"BUSANSKY SCHOOL","dis":["BUSANSKY SCHOOL"],"s":"Terminated","t":"needs_support","mp":0.0,"py":"2023-2024","am":"No","em":"No","lm":"No","acm":"No","pi":30.6,"pr":11.1,"p2":2.8,"att":76.5,"je":4.2,"jl":3.8,"rh":"No","re":"Unknown (Not Listed)","co":0,"ct":"","cd":"","hn":"","tr":null,"ty":null},{"n":"Nicoletta Pantelyat","a":[],"e":"npantelyat@gmail.com","y":["2024-2025","2023-2024"],"c":2,"r":"Non-cert Tutor","rs":["Tutor","Non-cert Tutor"],"si":"Pemberton Township","sis":["Pemberton Township"],"di":"BUSANSKY SCHOOL","dis":["BUSANSKY SCHOOL"],"s":"Terminated","t":"strong","mp":3.0,"py":"2024-2025","am":"Yes","em":"Yes","lm":"Yes","acm":"No","pi":33.3,"pr":6.7,"p2":25.0,"att":86.4,"je":4.6,"jl":4.6,"rh":"Yes","re":"SY 25-26 Decision TBD","co":0,"ct":"","cd":"","hn":"","tr":null,"ty":null},{"n":"Patrina Currie","a":[],"e":"pcurrie1208@gmail.com","y":["2023-2024"],"c":1,"r":"Tutor","rs":["Tutor"],"si":"Pemberton Township","sis":["Pemberton Township"],"di":"DENBO-CRICHTON SCHOOL","dis":["DENBO-CRICHTON SCHOOL"],"s":"Terminated","t":"strong","mp":3.0,"py":"2023-2024","am":"No","em":"Yes","lm":"Yes","acm":"Yes","pi":46.7,"pr":6.7,"p2":13.3,"att":76.7,"je":4.5,"jl":4.3,"rh":"Yes","re":"Unknown (Not Listed)","co":0,"ct":"","cd":"","hn":"","tr":null,"ty":null},{"n":"Candace Barr","a":[],"e":"candace.l.barr@gmail.com","y":["2023-2024"],"c":1,"r":"Tutor","rs":["Tutor"],"si":"Pemberton Township","sis":["Pemberton Township"],"di":"DENBO-CRICHTON SCHOOL","dis":["DENBO-CRICHTON SCHOOL"],"s":"Terminated","t":"strong","mp":3.0,"py":"2023-2024","am":"Yes","em":"Yes","lm":"Yes","acm":"No","pi":11.8,"pr":23.5,"p2":0.0,"att":87.2,"je":4.6,"jl":4.4,"rh":"Yes","re":"Unknown (Not Listed)","co":0,"ct":"","cd":"","hn":"","tr":null,"ty":null},{"n":"Dalian Williams","a":[],"e":"dalianwilliams91@gmail.com","y":["2024-2025","2023-2024"],"c":2,"r":"Certified Tutor","rs":["Tutor","Certified Tutor"],"si":"Gloucester Township School District","sis":["Gloucester Township School District"],"di":"Gloucester Twp Elementary School","dis":["Gloucester Twp Elementary School"],"s":"Terminated","t":"strong","mp":3.0,"py":"2024-2025","am":"Yes","em":"Yes","lm":"Yes","acm":"No","pi":38.5,"pr":15.4,"p2":null,"att":92.5,"je":4.7,"jl":4.7,"rh":"Yes","re":"SY 25-26 Decision TBD","co":0,"ct":"","cd":"","hn":"","tr":null,"ty":null},{"n":"Katrina Valentin","a":[],"e":"kvalentin2185@gmail.com","y":["2025-2026","2024-2025","2023-2024"],"c":3,"r":"Non-cert Tutor","rs":["Tutor","Non-cert Tutor"],"si":"Gloucester Township","sis":["Gloucester Township School District","Gloucester Township"],"di":"","dis":["JW Lilley Elementary School"],"s":"Active","t":"strong","mp":3.0,"py":"2024-2025","am":"Yes","em":"Yes","lm":"Yes","acm":"No","pi":21.4,"pr":0.0,"p2":7.1,"att":90.0,"je":4.7,"jl":4.4,"rh":"Yes","re":"SY 25-26 Decision TBD","co":0,"ct":"","cd":"","hn":"","tr":null,"ty":null},{"n":"Lori Panza","a":[],"e":"loriapanza@gmail.com","y":["2023-2024"],"c":1,"r":"Tutor","rs":["Tutor"],"si":"Gloucester Township School District","sis":["Gloucester Township School District"],"di":"Loring Flemming Elementary School","dis":["Loring Flemming Elementary School"],"s":"Terminated","t":"stellar","mp":4.0,"py":"2023-2024","am":"Yes","em":"Yes","lm":"Yes","acm":"Yes","pi":50.0,"pr":8.3,"p2":8.3,"att":100.0,"je":4.4,"jl":4.0,"rh":"Yes","re":"Unknown (Not Listed)","co":0,"ct":"","cd":"","hn":"","tr":null,"ty":null},{"n":"Amanda Dawson","a":[],"e":"adawson04@hotmail.com","y":["2025-2026","2024-2025","2023-2024"],"c":3,"r":"Non-cert Tutor","rs":["Tutor","Non-cert Tutor"],"si":"Gloucester Township","sis":["Gloucester Township School District","Gloucester Township"],"di":"","dis":["Gloucester Twp Elementary School"],"s":"Active","t":"developing","mp":2.0,"py":"2024-2025","am":"No","em":"Yes","lm":"Yes","acm":"No","pi":36.4,"pr":9.1,"p2":9.1,"att":81.9,"je":4.6,"jl":4.2,"rh":"Maybe","re":"SY 25-26 Decision TBD","co":0,"ct":"","cd":"","hn":"","tr":null,"ty":null},{"n":"Ashley Upton","a":[],"e":"ashleylynnupton48@icloud.com","y":["2023-2024"],"c":1,"r":"Tutor","rs":["Tutor"],"si":"Gloucester Township School District","sis":["Gloucester Township School District"],"di":"Union Valley Elementary School","dis":["Union Valley Elementary School"],"s":"Terminated","t":"stellar","mp":4.0,"py":"2023-2024","am":"Yes","em":"Yes","lm":"Yes","acm":"Yes","pi":61.5,"pr":0.0,"p2":25.0,"att":89.1,"je":5.0,"jl":5.0,"rh":"Yes","re":"Unknown (Not Listed)","co":0,"ct":"","cd":"","hn":"","tr":null,"ty":null},{"n":"Mikiah Clark","a":[],"e":"cassidy2414@gmail.com","y":["2023-2024"],"c":1,"r":"Tutor","rs":["Tutor"],"si":"Gloucester Township School District","sis":["Gloucester Township School District"],"di":"Loring Flemming Elementary School","dis":["Loring Flemming Elementary School"],"s":"Terminated","t":"stellar","mp":4.0,"py":"2023-2024","am":"Yes","em":"Yes","lm":"Yes","acm":"Yes","pi":45.5,"pr":9.1,"p2":18.2,"att":100.0,"je":4.5,"jl":4.4,"rh":"Yes","re":"Unknown (Not Listed)","co":0,"ct":"","cd":"","hn":"","tr":null,"ty":null},{"n":"Ella Van Twuyver","a":[],"e":"ellavantwuyver@gmail.com","y":["2023-2024"],"c":1,"r":"Tutor","rs":["Tutor"],"si":"Gloucester Township School District","sis":["Gloucester Township School District"],"di":"Chews Elementary School","dis":["Chews Elementary School"],"s":"Terminated","t":"stellar","mp":4.0,"py":"2023-2024","am":"Yes","em":"Yes","lm":"Yes","acm":"Yes","pi":60.0,"pr":20.0,"p2":0.0,"att":96.0,"je":4.4,"jl":4.0,"rh":"Yes","re":"Unknown (Not Listed)","co":0,"ct":"","cd":"","hn":"","tr":null,"ty":null},{"n":"Cassandra Goeke","a":[],"e":"cassandra.goeke@gmail.com","y":["2023-2024"],"c":1,"r":"Tutor","rs":["Tutor"],"si":"Gloucester Township School District","sis":["Gloucester Township School District"],"di":"Loring Flemming Elementary School","dis":["Loring Flemming Elementary School"],"s":"Terminated","t":"needs_support","mp":1.0,"py":"2023-2024","am":"Yes","em":"No","lm":"No","acm":"No","pi":38.5,"pr":15.4,"p2":15.4,"att":100.0,"je":3.9,"jl":3.9,"rh":"No","re":"Unknown (Not Listed)","co":0,"ct":"","cd":"","hn":"","tr":null,"ty":null},{"n":"Crysten Wood","a":[],"e":"wood.crysten@gmail.com","y":["2025-2026","2024-2025","2023-2024"],"c":3,"r":"Non-cert Tutor","rs":["Tutor","Non-cert Tutor"],"si":"Gloucester Township","sis":["Gloucester Township"],"di":"","dis":[],"s":"Active","t":"stellar","mp":4.0,"py":"2024-2025","am":"Yes","em":"Yes","lm":"Yes","acm":"Yes","pi":45.5,"pr":0.0,"p2":0.0,"att":89.7,"je":4.8,"jl":4.3,"rh":"Yes","re":"SY 25-26 Decision TBD","co":0,"ct":"","cd":"","hn":"","tr":null,"ty":null},{"n":"Alyssa Knittel","a":[],"e":"alyssaknittel1@gmail.com","y":["2023-2024"],"c":1,"r":"Tutor","rs":["Tutor"],"si":"Gloucester Township School District","sis":["Gloucester Township School District"],"di":"Chews Elementary School","dis":["Chews Elementary School"],"s":"Terminated","t":"developing","mp":2.0,"py":"2023-2024","am":"No","em":"Yes","lm":"No","acm":"Yes","pi":45.5,"pr":9.1,"p2":10.5,"att":82.5,"je":4.3,"jl":3.9,"rh":"Maybe","re":"Unknown (Not Listed)","co":0,"ct":"","cd":"","hn":"","tr":null,"ty":null},{"n":"Elsa Ackerman","a":[],"e":"elsackerman17@gmail.com","y":["2023-2024"],"c":1,"r":"Tutor","rs":["Tutor"],"si":"Gloucester Township School District","sis":["Gloucester Township School District"],"di":"Chews Elementary School","dis":["Chews Elementary School"],"s":"Terminated","t":"strong","mp":3.0,"py":"2023-2024","am":"No","em":"Yes","lm":"Yes","acm":"Yes","pi":57.1,"pr":14.3,"p2":0.0,"att":81.1,"je":4.7,"jl":4.0,"rh":"Yes","re":"Unknown (Not Listed)","co":0,"ct":"","cd":"","hn":"","tr":null,"ty":null},{"n":"Zane Sebasovich","a":[],"e":"zaneseb@gmail.com","y":["2023-2024"],"c":1,"r":"Tutor","rs":["Tutor"],"si":"Gloucester Township School District","sis":["Gloucester Township School District"],"di":"Erial Elementary School","dis":["Erial Elementary School"],"s":"Terminated","t":"stellar","mp":4.0,"py":"2023-2024","am":"Yes","em":"Yes","lm":"Yes","acm":"Yes","pi":57.1,"pr":7.1,"p2":7.1,"att":92.9,"je":4.8,"jl":4.4,"rh":"Yes","re":"Unknown (Not Listed)","co":0,"ct":"","cd":"","hn":"","tr":null,"ty":null},{"n":"Jacob Leebron","a":[],"e":"jacobleebron@gmail.com","y":["2025-2026","2024-2025","2023-2024"],"c":3,"r":"Non-cert Tutor","rs":["Tutor","Non-cert Tutor"],"si":"Gloucester Township School District","sis":["Gloucester Township School District"],"di":"Blackwood Elementary School","dis":["Blackwood Elementary School"],"s":"Active","t":"strong","mp":3.0,"py":"2023-2024","am":"Yes","em":"Yes","lm":"Yes","acm":"No","pi":30.0,"pr":0.0,"p2":10.0,"att":96.7,"je":5.0,"jl":5.0,"rh":"Yes","re":"Unknown (Not Listed)","co":0,"ct":"","cd":"","hn":"","tr":null,"ty":null},{"n":"Micaela Wilkerson","a":[],"e":"caelawilkerson28@gmail.com","y":["2025-2026","2024-2025","2023-2024"],"c":3,"r":"Non-cert Tutor","rs":["Tutor","Non-cert Tutor"],"si":"Haddon Township","sis":["Gloucester Township School District","Haddon Township"],"di":"Haddon Twp","dis":["JW Liley Elementary School","Haddon Twp"],"s":"Active","t":"incomplete","mp":null,"py":"2025-2026","am":"","em":"","lm":"","acm":"","pi":null,"pr":null,"p2":null,"att":90.9,"je":4.8,"jl":4.6,"rh":"","re":"SY 25-26 Decision TBD","co":0,"ct":"Coaching Support or feedback, Other (please describe below), Other (please descr","cd":"11/11/2025, 11/11/20","hn":"No, No, Yes, On Watch","tr":null,"ty":null},{"n":"Donna Stires","a":[],"e":"stirdn@aol.com","y":["2023-2024"],"c":1,"r":"Tutor","rs":["Tutor"],"si":"Lindenwold","sis":["Lindenwold"],"di":"Lindenwold Middle School","dis":["Lindenwold Middle School"],"s":"Terminated","t":"strong","mp":3.0,"py":"2023-2024","am":"Yes","em":"Yes","lm":"Yes","acm":"No","pi":0.0,"pr":0.0,"p2":0.0,"att":100.0,"je":4.6,"jl":4.3,"rh":"Yes","re":"Unknown (Not Listed)","co":0,"ct":"","cd":"","hn":"","tr":null,"ty":null},{"n":"Kiersten Stetser","a":[],"e":"ki.stetser@gmail.com","y":["2023-2024"],"c":1,"r":"Tutor","rs":["Tutor"],"si":"Clementon","sis":["Clementon"],"di":"Clementon Elementary School","dis":["Clementon Elementary School"],"s":"Terminated","t":"strong","mp":3.0,"py":"2023-2024","am":"Yes","em":"Yes","lm":"Yes","acm":"No","pi":null,"pr":null,"p2":null,"att":96.0,"je":4.7,"jl":4.6,"rh":"Yes","re":"Unknown (Not Listed)","co":0,"ct":"","cd":"","hn":"","tr":null,"ty":null},{"n":"Elizabeth Seth","a":[],"e":"eas1966@aol.com","y":["2024-2025","2023-2024"],"c":2,"r":"Non-cert Tutor","rs":["Tutor","Non-cert Tutor"],"si":"Waterford Township","sis":["Waterford Township"],"di":"Waterford Elementary","dis":["Waterford Elementary"],"s":"Terminated","t":"strong","mp":3.0,"py":"2024-2025","am":"Yes","em":"Yes","lm":"Yes","acm":"No","pi":40.0,"pr":0.0,"p2":0.0,"att":95.5,"je":4.9,"jl":4.6,"rh":"Yes","re":"SY 25-26 Decision TBD","co":0,"ct":"","cd":"","hn":"","tr":null,"ty":null},{"n":"Shirley McDougald","a":[],"e":"shirleymcdoug@gmail.com","y":["2025-2026","2023-2024"],"c":2,"r":"Non-cert Tutor","rs":["Tutor","Non-cert Tutor"],"si":"Gloucester Township","sis":["Camden City School District","Gloucester Township"],"di":"","dis":["VETS"],"s":"Active","t":"strong","mp":3.0,"py":"2023-2024","am":"Yes","em":"Yes","lm":"Yes","acm":"No","pi":40.0,"pr":0.0,"p2":30.0,"att":100.0,"je":4.3,"jl":4.4,"rh":"Yes","re":"Unknown (Not Listed)","co":0,"ct":"","cd":"","hn":"","tr":null,"ty":null},{"n":"KIMMION SMITH","a":[],"e":"kimmiondavis@yahoo.com","y":["2023-2024"],"c":1,"r":"Tutor","rs":["Tutor"],"si":"Camden City School District","sis":["Camden City School District"],"di":"VETS","dis":["VETS"],"s":"Terminated","t":"developing","mp":2.0,"py":"2023-2024","am":"Yes","em":"Yes","lm":"No","acm":"No","pi":null,"pr":null,"p2":null,"att":100.0,"je":4.4,"jl":3.9,"rh":"Maybe","re":"Unknown (Not Listed)","co":0,"ct":"","cd":"","hn":"","tr":null,"ty":null},{"n":"Joelene Joinvil","a":[],"e":"j.joinvil@gmail.com","y":["2023-2024"],"c":1,"r":"Tutor","rs":["Tutor"],"si":"Camden City School District","sis":["Camden City School District"],"di":"VETS","dis":["VETS"],"s":"Terminated","t":"developing","mp":2.0,"py":"2023-2024","am":"Yes","em":"No","lm":"No","acm":"Yes","pi":66.7,"pr":0.0,"p2":41.2,"att":90.6,"je":3.7,"jl":3.6,"rh":"Maybe","re":"Unknown (Not Listed)","co":0,"ct":"","cd":"","hn":"","tr":null,"ty":null},{"n":"Veronica Jennings","a":[],"e":"jenningsveronica35@gmail.com","y":["2023-2024"],"c":1,"r":"Tutor","rs":["Tutor"],"si":"Camden City School District","sis":["Camden City School District"],"di":"VETS","dis":["VETS"],"s":"Terminated","t":"developing","mp":2.0,"py":"2023-2024","am":"No","em":"Yes","lm":"No","acm":"Yes","pi":100.0,"pr":0.0,"p2":null,"att":76.7,"je":5.0,"jl":3.0,"rh":"Maybe","re":"Unknown (Not Listed)","co":0,"ct":"","cd":"","hn":"","tr":null,"ty":null},{"n":"Tyrea Barnes","a":[],"e":"tyreabarnes_@hotmail.com","y":["2023-2024"],"c":1,"r":"Tutor","rs":["Tutor"],"si":"Camden City School District","sis":["Camden City School District"],"di":"VETS","dis":["VETS"],"s":"Terminated","t":"stellar","mp":4.0,"py":"2023-2024","am":"Yes","em":"Yes","lm":"Yes","acm":"Yes","pi":63.6,"pr":0.0,"p2":20.0,"att":100.0,"je":4.5,"jl":4.3,"rh":"Yes","re":"Unknown (Not Listed)","co":0,"ct":"","cd":"","hn":"","tr":null,"ty":null},{"n":"Rose Parks","a":[],"e":"rparks09@gmail.com","y":["2023-2024"],"c":1,"r":"Tutor","rs":["Tutor"],"si":"","sis":[],"di":"","dis":[],"s":"Terminated","t":"developing","mp":2.0,"py":"2023-2024","am":"Yes","em":"No","lm":"No","acm":"Yes","pi":80.0,"pr":10.0,"p2":55.6,"att":100.0,"je":3.9,"jl":3.2,"rh":"Maybe","re":"Unknown (Not Listed)","co":0,"ct":"","cd":"","hn":"","tr":null,"ty":null},{"n":"Lesley Waszen","a":[],"e":"waszenlesley@gmail.com","y":["2025-2026","2023-2024"],"c":2,"r":"Non-cert Tutor","rs":["Tutor","Non-cert Tutor"],"si":"Camden City School District","sis":["Camden City School District"],"di":"VETS","dis":["VETS"],"s":"Active","t":"strong","mp":3.0,"py":"2023-2024","am":"Yes","em":"Yes","lm":"Yes","acm":"No","pi":null,"pr":null,"p2":null,"att":100.0,"je":null,"jl":null,"rh":"Yes","re":"Unknown (Not Listed)","co":0,"ct":"","cd":"","hn":"","tr":"She wanted more pay to offset the double taxes since she live in Philadelphia","ty":"2025-2026"},{"n":"Karla Acevedo","a":[],"e":"karla2019acevedo@gmail.com","y":["2023-2024"],"c":1,"r":"Tutor","rs":["Tutor"],"si":"Camden City School District","sis":["Camden City School District"],"di":"VETS","dis":["VETS"],"s":"Terminated","t":"strong","mp":3.0,"py":"2023-2024","am":"Yes","em":"Yes","lm":"Yes","acm":"No","pi":null,"pr":null,"p2":null,"att":100.0,"je":4.6,"jl":4.6,"rh":"Yes","re":"Unknown (Not Listed)","co":0,"ct":"","cd":"","hn":"","tr":null,"ty":null},{"n":"Ashley Acevedo","a":[],"e":"ashleyacevedo31@gmail.com","y":["2023-2024"],"c":1,"r":"Tutor","rs":["Tutor"],"si":"Camden City School District","sis":["Camden City School District"],"di":"VETS","dis":["VETS"],"s":"Terminated","t":"strong","mp":3.0,"py":"2023-2024","am":"Yes","em":"Yes","lm":"No","acm":"Yes","pi":60.0,"pr":10.0,"p2":40.0,"att":100.0,"je":4.4,"jl":3.9,"rh":"Yes","re":"Unknown (Not Listed)","co":0,"ct":"","cd":"","hn":"","tr":null,"ty":null},{"n":"Sofia Adams","a":[],"e":"sofiae@aol.com","y":["2023-2024"],"c":1,"r":"Tutor","rs":["Tutor"],"si":"KIPP NJ/TEAM schools","sis":["KIPP NJ/TEAM schools"],"di":"KIPP - Camden (Lanning Square Primary)","dis":["KIPP - Camden (Lanning Square Primary)"],"s":"Terminated","t":"stellar","mp":4.0,"py":"2023-2024","am":"Yes","em":"Yes","lm":"Yes","acm":"Yes","pi":77.8,"pr":0.0,"p2":33.3,"att":100.0,"je":4.8,"jl":4.5,"rh":"Yes","re":"Unknown (Not Listed)","co":0,"ct":"","cd":"","hn":"","tr":null,"ty":null},{"n":"David Stith","a":[],"e":"stith.david@gmail.com","y":["2023-2024"],"c":1,"r":"Tutor","rs":["Tutor"],"si":"Roseville Community Charter School","sis":["Roseville Community Charter School"],"di":"LEA- Roseville CS","dis":["LEA- Roseville CS"],"s":"Terminated","t":"developing","mp":2.0,"py":"2023-2024","am":"Yes","em":"No","lm":"Yes","acm":"No","pi":36.7,"pr":6.7,"p2":8.0,"att":99.0,"je":4.2,"jl":4.4,"rh":"Maybe","re":"Unknown (Not Listed)","co":0,"ct":"","cd":"","hn":"","tr":null,"ty":null},{"n":"Carlos Jacho","a":[],"e":"carlos.jacho@gmail.com","y":["2025-2026","2024-2025","2023-2024"],"c":3,"r":"Non-cert Tutor","rs":["Tutor","Non-cert Tutor"],"si":"KIPP NJ/TEAM schools","sis":["KIPP NJ/TEAM schools"],"di":"LEA - KIPP Newark- SEEK","dis":["LEA - KIPP Newark- SEEK"],"s":"Active","t":"stellar","mp":4.0,"py":"2024-2025","am":"Yes","em":"Yes","lm":"Yes","acm":"Yes","pi":68.8,"pr":3.1,"p2":12.5,"att":96.8,"je":4.8,"jl":4.8,"rh":"Yes","re":"SY 25-26 Decision TBD","co":1,"ct":"Reminder/Verbal Warning","cd":"3/18/2025","hn":"No","tr":null,"ty":null},{"n":"Priya Saha","a":[],"e":"priya.saha9622@gmail.com","y":["2023-2024"],"c":1,"r":"Tutor","rs":["Tutor"],"si":"KIPP NJ/TEAM schools","sis":["KIPP NJ/TEAM schools"],"di":"LEA - KIPP Newark- SPARK","dis":["LEA - KIPP Newark- SPARK"],"s":"Terminated","t":"stellar","mp":4.0,"py":"2023-2024","am":"Yes","em":"Yes","lm":"Yes","acm":"Yes","pi":66.7,"pr":0.0,"p2":25.0,"att":100.0,"je":4.6,"jl":4.4,"rh":"Yes","re":"Unknown (Not Listed)","co":0,"ct":"","cd":"","hn":"","tr":null,"ty":null},{"n":"Heba Samhouri","a":[],"e":"hebasamhouri1@gmail.com","y":["2024-2025","2023-2024"],"c":2,"r":"Non-cert Tutor","rs":["Tutor","Non-cert Tutor"],"si":"KIPP NJ/TEAM schools","sis":["KIPP NJ/TEAM schools"],"di":"LEA - KIPP Newark- SEEK","dis":["LEA - KIPP Newark- SEEK"],"s":"Terminated","t":"strong","mp":3.0,"py":"2023-2024","am":"No","em":"Yes","lm":"Yes","acm":"Yes","pi":73.1,"pr":7.7,"p2":30.8,"att":63.2,"je":4.9,"jl":4.9,"rh":"Yes","re":"Unknown (Not Listed)","co":0,"ct":"","cd":"","hn":"","tr":null,"ty":null},{"n":"Dejaneh Super","a":[],"e":"dejasuper@icloud.com","y":["2023-2024"],"c":1,"r":"Tutor","rs":["Tutor"],"si":"Roseville Community Charter School","sis":["Roseville Community Charter School"],"di":"LEA- Roseville CS","dis":["LEA- Roseville CS"],"s":"Terminated","t":"stellar","mp":4.0,"py":"2023-2024","am":"Yes","em":"Yes","lm":"Yes","acm":"Yes","pi":59.0,"pr":3.3,"p2":28.3,"att":99.0,"je":4.8,"jl":4.6,"rh":"Yes","re":"Unknown (Not Listed)","co":0,"ct":"","cd":"","hn":"","tr":null,"ty":null},{"n":"Lavern Maison","a":[],"e":"lavern.maison@gmail.com","y":["2025-2026","2024-2025","2023-2024"],"c":3,"r":"Non-cert Tutor","rs":["Tutor","Sub Tutor","Non-cert Tutor"],"si":"PCSST","sis":["KIPP NJ/TEAM schools","iLearn CMO","PCSST"],"di":"","dis":["LEA -KIPP Newark- Thrive","Hudson MS"],"s":"Terminated","t":"needs_support","mp":1.0,"py":"2024-2025","am":"No","em":"No","lm":"No","acm":"Yes","pi":57.4,"pr":5.8,"p2":0.0,"att":80.5,"je":3.8,"jl":3.8,"rh":"No","re":"SY 25-26 Decision TBD","co":0,"ct":"","cd":"","hn":"","tr":"No","ty":"2025-2026"},{"n":"Tabitha Destinoble","a":[],"e":"tabithadestinoble@gmail.com","y":["2024-2025","2023-2024"],"c":2,"r":"Non-cert Tutor","rs":["Tutor","Non-cert Tutor"],"si":"KIPP NJ/TEAM schools","sis":["KIPP NJ/TEAM schools"],"di":"LEA - KIPP Newark- LIFE","dis":["LEA - KIPP Newark- LIFE"],"s":"Terminated","t":"strong","mp":3.0,"py":"2023-2024","am":"Yes","em":"Yes","lm":"Yes","acm":"No","pi":30.0,"pr":10.0,"p2":10.0,"att":100.0,"je":4.3,"jl":4.3,"rh":"Yes","re":"Unknown (Not Listed)","co":0,"ct":"","cd":"","hn":"","tr":"Didn't want to continue with Spring programming","ty":"2024-2025"},{"n":"Essence Stevenson","a":[],"e":"essencestevenson123@gmail.com","y":["2024-2025","2023-2024"],"c":2,"r":"Non-cert Tutor","rs":["Tutor","Non-cert Tutor"],"si":"N/A","sis":[],"di":"N/A","dis":[],"s":"Terminated","t":"incomplete","mp":null,"py":"2023-2024","am":"#VALUE!","em":"Yes","lm":"Yes","acm":"No","pi":null,"pr":null,"p2":null,"att":null,"je":null,"jl":null,"rh":"Unknown - atleast 1 metric missing","re":"Unknown (Not Listed)","co":0,"ct":"","cd":"","hn":"","tr":"ineligible for rehire, attendance and tardy issues","ty":"2024-2025"},{"n":"Nabanita Pal","a":[],"e":"pal.itsnabanita@gmail.com","y":["2023-2024"],"c":1,"r":"Tutor","rs":["Tutor"],"si":"KIPP NJ/TEAM schools","sis":["KIPP NJ/TEAM schools"],"di":"LEA - KIPP Newark- SPARK","dis":["LEA - KIPP Newark- SPARK"],"s":"Terminated","t":"stellar","mp":4.0,"py":"2023-2024","am":"Yes","em":"Yes","lm":"Yes","acm":"Yes","pi":64.7,"pr":2.9,"p2":25.0,"att":100.0,"je":4.8,"jl":4.6,"rh":"Yes","re":"Unknown (Not Listed)","co":0,"ct":"","cd":"","hn":"","tr":null,"ty":null},{"n":"Abbe Morris","a":[],"e":"ivytwines@comcast.net","y":["2023-2024"],"c":1,"r":"Tutor","rs":["Tutor"],"si":"East Greenwich","sis":["East Greenwich"],"di":"East Greenwich","dis":["East Greenwich"],"s":"Terminated","t":"strong","mp":3.0,"py":"2023-2024","am":"Yes","em":"Yes","lm":"Yes","acm":"No","pi":null,"pr":null,"p2":null,"att":100.0,"je":null,"jl":null,"rh":"Yes","re":"Unknown (Not Listed)","co":0,"ct":"","cd":"","hn":"","tr":null,"ty":null},{"n":"Alexandra Cristescu","a":[],"e":"arc444love@gmail.com","y":["2025-2026","2023-2024"],"c":2,"r":"Non-cert Tutor","rs":["Tutor","Non-cert Tutor"],"si":"Penns Grove - Carneys Point Regional School D","sis":["East Greenwich","Penns Grove - Carneys Point Regional School District"],"di":"","dis":["East Greenwich"],"s":"Active","t":"strong","mp":3.0,"py":"2023-2024","am":"Yes","em":"Yes","lm":"Yes","acm":"No","pi":30.8,"pr":7.7,"p2":0.0,"att":100.0,"je":4.7,"jl":4.3,"rh":"Yes","re":"Unknown (Not Listed)","co":0,"ct":"Reminder/Verbal Warning","cd":"1/26/2026","hn":"On Watch","tr":"Resigned due to death in the family","ty":"2024-2025"},{"n":"Anna Keefe","a":[],"e":"annakeefe31@gmail.com","y":["2023-2024"],"c":1,"r":"Tutor","rs":["Tutor"],"si":"iLearn CMO","sis":["iLearn CMO"],"di":"LEA - iLearn Hudson ES","dis":["LEA - iLearn Hudson ES"],"s":"Terminated","t":"strong","mp":3.0,"py":"2023-2024","am":"Yes","em":"Yes","lm":"Yes","acm":"No","pi":59.3,"pr":3.7,"p2":14.8,"att":97.4,"je":4.8,"jl":4.2,"rh":"Yes","re":"Unknown (Not Listed)","co":0,"ct":"","cd":"","hn":"","tr":null,"ty":null},{"n":"Karina Muniz","a":[],"e":"karinammuniz99@gmail.com","y":["2023-2024"],"c":1,"r":"Tutor","rs":["Tutor"],"si":"iLearn CMO","sis":["iLearn CMO"],"di":"LEA - iLearn Hudson MS","dis":["LEA - iLearn Hudson MS"],"s":"Terminated","t":"strong","mp":3.0,"py":"2023-2024","am":"Yes","em":"Yes","lm":"Yes","acm":"No","pi":45.7,"pr":2.9,"p2":19.1,"att":95.8,"je":4.9,"jl":4.9,"rh":"Yes","re":"Unknown (Not Listed)","co":0,"ct":"","cd":"","hn":"","tr":null,"ty":null},{"n":"Abdallah Abada","a":[],"e":"abdaba03@gmail.com","y":["2024-2025","2023-2024"],"c":2,"r":"Non-cert Tutor","rs":["Tutor","Non-cert Tutor"],"si":"iLearn CMO","sis":["iLearn CMO"],"di":"LEA - iLearn Hudson MS","dis":["LEA - iLearn Hudson MS"],"s":"Terminated","t":"strong","mp":3.0,"py":"2023-2024","am":"Yes","em":"Yes","lm":"Yes","acm":"No","pi":43.4,"pr":3.8,"p2":5.1,"att":96.4,"je":4.9,"jl":4.8,"rh":"Yes","re":"Unknown (Not Listed)","co":0,"ct":"","cd":"","hn":"","tr":"Reason Not Applied","ty":"2024-2025"},{"n":"Sheimaa Abada","a":[],"e":"sheimaa.abada@gmail.com","y":["2025-2026","2024-2025","2023-2024"],"c":3,"r":"Non-cert Tutor","rs":["Tutor","Non-cert Tutor"],"si":"iLearn CMO","sis":["iLearn CMO"],"di":"LEA - iLearn Hudson MS","dis":["LEA - iLearn Hudson MS"],"s":"Active","t":"needs_support","mp":0.0,"py":"2024-2025","am":"No","em":"No","lm":"No","acm":"No","pi":40.4,"pr":10.5,"p2":12.0,"att":84.6,"je":3.9,"jl":4.0,"rh":"No","re":"SY 25-26 Decision TBD","co":0,"ct":"","cd":"","hn":"","tr":null,"ty":null},{"n":"Samy Dob","a":[],"e":"dobsamy@gmail.com","y":["2023-2024"],"c":1,"r":"Tutor","rs":["Tutor"],"si":"iLearn CMO","sis":["iLearn CMO"],"di":"LEA - iLearn Hudson MS","dis":["LEA - iLearn Hudson MS"],"s":"Terminated","t":"strong","mp":3.0,"py":"2023-2024","am":"Yes","em":"Yes","lm":"Yes","acm":"No","pi":16.7,"pr":0.0,"p2":null,"att":100.0,"je":5.0,"jl":4.9,"rh":"Yes","re":"Unknown (Not Listed)","co":0,"ct":"","cd":"","hn":"","tr":null,"ty":null},{"n":"Kelly Weiswasser","a":[],"e":"motherkaw1972@gmail.com","y":["2023-2024"],"c":1,"r":"Tutor","rs":["Tutor"],"si":"Clinton Township","sis":["Clinton Township"],"di":"Round Valley School","dis":["Round Valley School"],"s":"Terminated","t":"developing","mp":2.0,"py":"2023-2024","am":"Yes","em":"No","lm":"No","acm":"Yes","pi":70.0,"pr":0.0,"p2":5.0,"att":100.0,"je":4.2,"jl":3.6,"rh":"Maybe","re":"Unknown (Not Listed)","co":0,"ct":"","cd":"","hn":"","tr":null,"ty":null},{"n":"Rebecca Armagast","a":[],"e":"rebeccataylor27@gmail.com","y":["2024-2025","2023-2024"],"c":2,"r":"Non-cert Tutor","rs":["Tutor","Non-cert Tutor"],"si":"N/A","sis":[],"di":"N/A","dis":[],"s":"Terminated","t":"stellar","mp":4.0,"py":"2024-2025","am":"Yes","em":"Yes","lm":"Yes","acm":"Yes","pi":66.7,"pr":0.0,"p2":20.0,"att":90.0,"je":4.8,"jl":4.7,"rh":"Yes","re":"SY 25-26 Decision TBD","co":0,"ct":"","cd":"","hn":"","tr":null,"ty":null},{"n":"Kriza Caliolio","a":[],"e":"krizadcaliolio@gmail.com","y":["2023-2024"],"c":1,"r":"Tutor","rs":["Tutor"],"si":"Boys and Girls Club","sis":["Boys and Girls Club"],"di":"Bradley Elementary","dis":["Bradley Elementary"],"s":"Terminated","t":"strong","mp":3.0,"py":"2023-2024","am":"Yes","em":"Yes","lm":"Yes","acm":"No","pi":null,"pr":null,"p2":null,"att":100.0,"je":null,"jl":null,"rh":"Yes","re":"Unknown (Not Listed)","co":0,"ct":"","cd":"","hn":"","tr":"Resigned because she felt there were too many obstacles for her and unanswered questions","ty":"2024-2025"},{"n":"Grace Lyons","a":[],"e":"19glyons@gmail.com","y":["2023-2024"],"c":1,"r":"Tutor","rs":["Tutor"],"si":"Waterford Township","sis":["Waterford Township"],"di":"Waterford Elementary","dis":["Waterford Elementary"],"s":"Terminated","t":"strong","mp":3.0,"py":"2023-2024","am":"Yes","em":"Yes","lm":"Yes","acm":"No","pi":33.3,"pr":16.7,"p2":0.0,"att":97.3,"je":4.7,"jl":4.5,"rh":"Yes","re":"Unknown (Not Listed)","co":0,"ct":"","cd":"","hn":"","tr":null,"ty":null},{"n":"Rebeka Lange","a":[],"e":"rebekalange0@gmail.com","y":["2025-2026","2023-2024"],"c":2,"r":"Non-cert Tutor","rs":["Tutor","Non-cert Tutor"],"si":"Hamilton Township School District","sis":["Hamilton Township School District"],"di":"LEA - Hamiton Twp","dis":["LEA - Hamiton Twp"],"s":"Active","t":"incomplete","mp":null,"py":"2025-2026","am":"","em":"","lm":"","acm":"","pi":null,"pr":null,"p2":null,"att":86.8,"je":4.3,"jl":4.1,"rh":"","re":"SY 25-26 Decision TBD","co":0,"ct":"","cd":"","hn":"","tr":null,"ty":null},{"n":"Gregory Tomaini","a":[],"e":"grtomaini@gmail.com","y":["2023-2024"],"c":1,"r":"Tutor","rs":["Tutor"],"si":"Boys and Girls Club","sis":["Boys and Girls Club"],"di":"Thurgood Marshall","dis":["Thurgood Marshall"],"s":"Terminated","t":"strong","mp":3.0,"py":"2023-2024","am":"Yes","em":"Yes","lm":"Yes","acm":"No","pi":null,"pr":null,"p2":null,"att":100.0,"je":null,"jl":null,"rh":"Yes","re":"No","co":0,"ct":"","cd":"","hn":"","tr":null,"ty":null},{"n":"Malac Moraktan","a":[],"e":"pvmalac77@gmail.com","y":["2023-2024"],"c":1,"r":"Tutor","rs":["Tutor"],"si":"iLearn CMO","sis":["iLearn CMO"],"di":"LEA - iLearn Clifton ES","dis":["LEA - iLearn Clifton ES"],"s":"Terminated","t":"developing","mp":2.0,"py":"2023-2024","am":"Yes","em":"No","lm":"Yes","acm":"No","pi":58.1,"pr":3.2,"p2":6.2,"att":93.9,"je":4.3,"jl":4.2,"rh":"Maybe","re":"No","co":0,"ct":"","cd":"","hn":"","tr":null,"ty":null},{"n":"Gina Esposito","a":[],"e":"nvesposito@verizon.net","y":["2023-2024"],"c":1,"r":"Tutor","rs":["Tutor"],"si":"iLearn CMO","sis":["iLearn CMO"],"di":"LEA - iLearn Clifton ES","dis":["LEA - iLearn Clifton ES"],"s":"Terminated","t":"developing","mp":2.0,"py":"2023-2024","am":"No","em":"Yes","lm":"Yes","acm":"No","pi":53.1,"pr":2.0,"p2":20.6,"att":87.4,"je":4.9,"jl":4.9,"rh":"Maybe","re":"Unknown (Not Listed)","co":0,"ct":"","cd":"","hn":"","tr":null,"ty":null},{"n":"Nicole Cill","a":[],"e":"cilln264@gmail.com","y":["2025-2026","2024-2025","2023-2024"],"c":3,"r":"Non-cert Tutor","rs":["Tutor","Non-cert Tutor"],"si":"iLearn CMO","sis":["iLearn CMO"],"di":"LEA - iLearn Clifton MS","dis":["LEA - iLearn Clifton MS"],"s":"Terminated","t":"strong","mp":3.0,"py":"2024-2025","am":"Yes","em":"Yes","lm":"Yes","acm":"No","pi":58.8,"pr":2.0,"p2":20.0,"att":90.1,"je":4.8,"jl":4.8,"rh":"Yes","re":"SY 25-26 Decision TBD","co":1,"ct":"Warning/Write Up to Follow","cd":"3/7/2025","hn":"No","tr":"Resigned for new employment opportunity","ty":"2025-2026"},{"n":"Claudia Tumelus","a":[],"e":"claudiatumelus@gmail.com","y":["2025-2026","2024-2025","2023-2024"],"c":3,"r":"Non-cert Tutor","rs":["Tutor","Non-cert Tutor"],"si":"iLearn CMO","sis":["iLearn CMO"],"di":"LEA - iLearn Clifton MS","dis":["LEA - iLearn Clifton MS"],"s":"Active","t":"developing","mp":2.0,"py":"2024-2025","am":"No","em":"Yes","lm":"Yes","acm":"No","pi":41.1,"pr":7.1,"p2":5.0,"att":82.8,"je":4.5,"jl":4.4,"rh":"Maybe","re":"SY 25-26 Decision TBD","co":0,"ct":"","cd":"","hn":"","tr":"Working FT at iLearn","ty":"2025-2026"},{"n":"Disan Singleton","a":[],"e":"nasidnotelgnis@gmail.com","y":["2025-2026","2024-2025","2023-2024"],"c":3,"r":"Non-cert Tutor","rs":["Tutor","Non-cert Tutor"],"si":"iLearn CMO","sis":["iLearn CMO"],"di":"LEA - iLearn Clifton MS","dis":["LEA - iLearn Clifton MS"],"s":"Active","t":"developing","mp":2.0,"py":"2024-2025","am":"No","em":"Yes","lm":"Yes","acm":"No","pi":16.3,"pr":7.0,"p2":4.5,"att":83.6,"je":4.7,"jl":4.7,"rh":"Maybe","re":"SY 25-26 Decision TBD","co":1,"ct":"Warning/Write Up to Follow, Reminder/Verbal Warning, Warning/Write Up to Follow,","cd":"3/18/2025, 10/17/202","hn":"No, Yes, No, No, No, No, No","tr":"resignation","ty":"2025-2026"},{"n":"Loribelle Lapaix","a":[],"e":"lorilapaix@gmail.com","y":["2023-2024"],"c":1,"r":"Tutor","rs":["Tutor"],"si":"iLearn CMO","sis":["iLearn CMO"],"di":"LEA - iLearn Passaic ES","dis":["LEA - iLearn Passaic ES"],"s":"Terminated","t":"strong","mp":3.0,"py":"2023-2024","am":"Yes","em":"Yes","lm":"Yes","acm":"No","pi":40.0,"pr":16.0,"p2":7.1,"att":95.8,"je":4.7,"jl":4.3,"rh":"Yes","re":"Unknown (Not Listed)","co":0,"ct":"","cd":"","hn":"","tr":null,"ty":null},{"n":"Trushti Shah","a":[],"e":"trushtishah@gmail.com","y":["2024-2025","2023-2024"],"c":2,"r":"Non-cert Tutor","rs":["Tutor","Non-cert Tutor"],"si":"iLearn CMO","sis":["iLearn CMO"],"di":"LEA - iLearn Passaic ES","dis":["LEA - iLearn Passaic ES"],"s":"Terminated","t":"stellar","mp":4.0,"py":"2024-2025","am":"Yes","em":"Yes","lm":"Yes","acm":"Yes","pi":88.0,"pr":0.0,"p2":40.0,"att":91.7,"je":5.0,"jl":4.8,"rh":"Yes","re":"SY 25-26 Decision TBD","co":1,"ct":"Other (please describe below)","cd":"3/18/2025","hn":"No","tr":null,"ty":null},{"n":"Jennymarie Idrobo","a":[],"e":"jenny.idrobo1@gmail.com","y":["2024-2025","2023-2024"],"c":2,"r":"Non-cert Tutor","rs":["Tutor","Non-cert Tutor"],"si":"iLearn CMO","sis":["iLearn CMO"],"di":"LEA - iLearn Passaic MS","dis":["LEA - iLearn Passaic MS"],"s":"Terminated","t":"needs_support","mp":0.0,"py":"2024-2025","am":"No","em":"No","lm":"No","acm":"No","pi":53.5,"pr":4.7,"p2":100.0,"att":78.1,"je":4.0,"jl":4.1,"rh":"No","re":"SY 25-26 Decision TBD","co":0,"ct":"","cd":"","hn":"","tr":null,"ty":null},{"n":"Jessica Flores","a":[],"e":"jessicaflor9911@gmail.com","y":["2025-2026","2024-2025","2023-2024"],"c":3,"r":"Non-cert Tutor","rs":["Tutor","Non-cert Tutor"],"si":"iLearn CMO","sis":["iLearn CMO"],"di":"LEA - iLearn Passaic MS","dis":["LEA - iLearn Passaic MS"],"s":"Active","t":"needs_support","mp":0.0,"py":"2024-2025","am":"No","em":"No","lm":"No","acm":"No","pi":27.3,"pr":5.5,"p2":22.2,"att":78.8,"je":4.1,"jl":4.0,"rh":"No","re":"SY 25-26 Decision TBD","co":0,"ct":"","cd":"","hn":"","tr":null,"ty":null},{"n":"Benae Johnson","a":[],"e":"benaejohnson@gmail.com","y":["2024-2025","2023-2024"],"c":2,"r":"Non-cert Tutor","rs":["Tutor","Non-cert Tutor"],"si":"iLearn CMO","sis":["iLearn CMO"],"di":"LEA - iLearn Paterson ES","dis":["LEA - iLearn Paterson ES"],"s":"Terminated","t":"developing","mp":2.0,"py":"2023-2024","am":"No","em":"Yes","lm":"Yes","acm":"No","pi":30.8,"pr":9.2,"p2":4.1,"att":74.8,"je":4.7,"jl":4.6,"rh":"Maybe","re":"Unknown (Not Listed)","co":0,"ct":"","cd":"","hn":"","tr":"She is reloacting","ty":"2024-2025"},{"n":"Coleen Piontkowskie","a":[],"e":"coleenp221@gmail.com","y":["2024-2025","2023-2024"],"c":2,"r":"Non-cert Tutor","rs":["Tutor","Non-cert Tutor"],"si":"iLearn CMO","sis":["iLearn CMO"],"di":"LEA - iLearn Paterson ES","dis":["LEA - iLearn Paterson ES"],"s":"Terminated","t":"developing","mp":2.0,"py":"2024-2025","am":"No","em":"No","lm":"Yes","acm":"Yes","pi":67.2,"pr":3.5,"p2":10.0,"att":86.7,"je":4.2,"jl":4.2,"rh":"Maybe","re":"SY 25-26 Decision TBD","co":1,"ct":"Other (please describe below)","cd":"3/18/2025","hn":"No","tr":null,"ty":null},{"n":"Wilhelmina DiFilippo","a":[],"e":"mina.diflip@gmail.com","y":["2023-2024"],"c":1,"r":"Tutor","rs":["Tutor"],"si":"iLearn CMO","sis":["iLearn CMO"],"di":"LEA - iLearn Paterson MS","dis":["LEA - iLearn Paterson MS"],"s":"Terminated","t":"needs_support","mp":1.0,"py":"2023-2024","am":"No","em":"No","lm":"Yes","acm":"No","pi":21.7,"pr":4.3,"p2":null,"att":71.0,"je":4.4,"jl":4.4,"rh":"No","re":"Unknown (Not Listed)","co":0,"ct":"","cd":"","hn":"","tr":null,"ty":null},{"n":"Ethan Timberman","a":[],"e":"etimberman36@gmail.com","y":["2023-2024"],"c":1,"r":"Tutor","rs":["Tutor"],"si":"Salem City","sis":["Salem City"],"di":"Salem Middle School","dis":["Salem Middle School"],"s":"Terminated","t":"stellar","mp":4.0,"py":"2023-2024","am":"Yes","em":"Yes","lm":"Yes","acm":"Yes","pi":62.5,"pr":0.0,"p2":25.0,"att":100.0,"je":4.9,"jl":4.9,"rh":"Yes","re":"Unknown (Not Listed)","co":0,"ct":"","cd":"","hn":"","tr":null,"ty":null},{"n":"Nadeem Shahzad","a":[],"e":"nadeem@shahzad.co","y":["2023-2024"],"c":1,"r":"Tutor","rs":["Tutor"],"si":"Salem City","sis":["Salem City"],"di":"Salem Middle School","dis":["Salem Middle School"],"s":"Terminated","t":"stellar","mp":4.0,"py":"2023-2024","am":"Yes","em":"Yes","lm":"Yes","acm":"Yes","pi":50.0,"pr":0.0,"p2":null,"att":100.0,"je":4.3,"jl":4.3,"rh":"Yes","re":"Unknown (Not Listed)","co":0,"ct":"","cd":"","hn":"","tr":null,"ty":null},{"n":"Janelle Lee","a":[],"e":"janellelee0@gmail.com","y":["2025-2026","2023-2024"],"c":2,"r":"Non-cert Tutor","rs":["Tutor","Non-cert Tutor"],"si":"Salem City","sis":["Salem City"],"di":"Salem Middle School","dis":["Salem Middle School"],"s":"Active","t":"strong","mp":3.0,"py":"2023-2024","am":"Yes","em":"Yes","lm":"Yes","acm":"No","pi":20.0,"pr":20.0,"p2":null,"att":100.0,"je":4.7,"jl":4.7,"rh":"Yes","re":"Unknown (Not Listed)","co":0,"ct":"","cd":"","hn":"","tr":null,"ty":"2025-2026"},{"n":"Danielle McAllister","a":[],"e":"daniellemcallister112@gmail.com","y":["2023-2024"],"c":1,"r":"Tutor","rs":["Tutor"],"si":"Salem City","sis":["Salem City"],"di":"John Fenwick Academy","dis":["John Fenwick Academy"],"s":"Terminated","t":"stellar","mp":4.0,"py":"2023-2024","am":"Yes","em":"Yes","lm":"Yes","acm":"Yes","pi":52.9,"pr":0.0,"p2":5.9,"att":95.5,"je":4.7,"jl":4.7,"rh":"Yes","re":"Unknown (Not Listed)","co":0,"ct":"","cd":"","hn":"","tr":null,"ty":null},{"n":"Avery Frieze-Dunfee","a":[],"e":"friezedunfeeavery@gmail.com","y":["2024-2025","2023-2024"],"c":2,"r":"Sub Tutor","rs":["Tutor","Sub Tutor"],"si":"Salem City","sis":["Salem City"],"di":"John Fenwick Academy","dis":["John Fenwick Academy"],"s":"Terminated","t":"stellar","mp":4.0,"py":"2024-2025","am":"Yes","em":"Yes","lm":"Yes","acm":"Yes","pi":42.3,"pr":15.4,"p2":null,"att":100.0,"je":4.7,"jl":4.6,"rh":"Yes","re":"SY 25-26 Decision TBD","co":0,"ct":"","cd":"","hn":"","tr":null,"ty":null},{"n":"Chelsea Ostrowski","a":[],"e":"chelseamostrowski@gmail.com","y":["2025-2026","2024-2025","2023-2024"],"c":3,"r":"Dual Role","rs":["Tutor","Non-cert Tutor","Dual Role"],"si":"Penns Grove - Carneys Point Regional School D","sis":["Salem City, iLearn CMO","Penns Grove - Carneys Point Regional School District"],"di":"","dis":["John Fenwick Academy, LEA - CAPS Central"],"s":"Active","t":"needs_support","mp":1.0,"py":"2023-2024","am":"Yes","em":"No","lm":"No","acm":"No","pi":48.5,"pr":9.1,"p2":12.9,"att":97.0,"je":4.2,"jl":4.1,"rh":"No","re":"Unknown (Not Listed)","co":0,"ct":"","cd":"","hn":"","tr":null,"ty":null},{"n":"Katie Rose Davis","a":[],"e":"katheriner.davis7@gmail.com","y":["2025-2026","2024-2025","2023-2024"],"c":3,"r":"Non-cert Tutor","rs":["Tutor","Non-cert Tutor"],"si":"Hamilton Township School District","sis":["Hamilton Township","Hamilton Township School District"],"di":"LEA - Hamiton Twp","dis":["Albert E. Grice Middle School","LEA - Hamiton Twp"],"s":"Active","t":"incomplete","mp":null,"py":"2025-2026","am":"","em":"","lm":"","acm":"","pi":null,"pr":null,"p2":null,"att":92.3,"je":4.1,"jl":4.0,"rh":"","re":"SY 25-26 Decision TBD","co":0,"ct":"","cd":"","hn":"","tr":null,"ty":null},{"n":"Fasiha Shaikh","a":[],"e":"fasisha1012@gmail.com","y":["2025-2026","2024-2025","2023-2024"],"c":3,"r":"Non-cert Tutor","rs":["Tutor","Non-cert Tutor"],"si":"Hamilton Township School District","sis":["Hamilton Township School District"],"di":"LEA - Hamiton Twp","dis":["LEA - Hamiton Twp"],"s":"Active","t":"developing","mp":2.0,"py":"2024-2025","am":"Yes","em":"No","lm":"Yes","acm":"No","pi":25.0,"pr":0.0,"p2":0.0,"att":85.8,"je":4.2,"jl":4.4,"rh":"Maybe","re":"SY 25-26 Decision TBD","co":0,"ct":"Reminder/Verbal Warning, Additional Coaching Support, Other (please describe bel","cd":"12/9/2025, 12/10/202","hn":"On Watch, On Watch, Recommended Termination, On Watch, On Watch, On Watch","tr":null,"ty":null},{"n":"Dhrupalben Naseet","a":[],"e":"dhrupal.kothiya@gmail.com","y":["2025-2026","2024-2025","2023-2024"],"c":3,"r":"Non-cert Tutor","rs":["Tutor","Certified Tutor","Non-cert Tutor"],"si":"N/A","sis":[],"di":"N/A","dis":[],"s":"Terminated","t":"strong","mp":3.0,"py":"2024-2025","am":"Yes","em":"Yes","lm":"Yes","acm":"No","pi":37.9,"pr":3.5,"p2":6.9,"att":91.5,"je":4.3,"jl":4.6,"rh":"Yes","re":"SY 25-26 Decision TBD","co":0,"ct":"","cd":"","hn":"","tr":"Full-Time Position","ty":"2025-2026"},{"n":"Naima Boutira","a":[],"e":"nk.boutira@gmail.com","y":["2025-2026","2024-2025","2023-2024"],"c":3,"r":"Non-cert Tutor","rs":["Tutor","Non-cert Tutor"],"si":"N/A","sis":[],"di":"N/A","dis":[],"s":"Active","t":"developing","mp":2.0,"py":"2024-2025","am":"Yes","em":"No","lm":"Yes","acm":"No","pi":null,"pr":null,"p2":null,"att":93.8,"je":4.1,"jl":4.5,"rh":"Maybe","re":"SY 25-26 Decision TBD","co":0,"ct":"","cd":"","hn":"","tr":null,"ty":null},{"n":"Alexander Stourton","a":[],"e":"alexstourton@gmail.com","y":["2023-2024"],"c":1,"r":"Tutor","rs":["Tutor"],"si":"iLearn CMO","sis":["iLearn CMO"],"di":"LEA - CAPS Central","dis":["LEA - CAPS Central"],"s":"Terminated","t":"strong","mp":3.0,"py":"2023-2024","am":"Yes","em":"Yes","lm":"Yes","acm":"No","pi":36.4,"pr":0.0,"p2":18.2,"att":100.0,"je":4.8,"jl":4.6,"rh":"Yes","re":"Unknown (Not Listed)","co":0,"ct":"","cd":"","hn":"","tr":null,"ty":null},{"n":"Brendan Smith","a":[],"e":"brendansmithjagal@outlook.com","y":["2023-2024"],"c":1,"r":"Tutor","rs":["Tutor"],"si":"iLearn CMO","sis":["iLearn CMO"],"di":"LEA- Queen City","dis":["LEA- Queen City"],"s":"Terminated","t":"needs_support","mp":1.0,"py":"2023-2024","am":"Yes","em":"No","lm":"No","acm":"No","pi":null,"pr":null,"p2":null,"att":100.0,"je":3.6,"jl":3.6,"rh":"No","re":"Unknown (Not Listed)","co":0,"ct":"","cd":"","hn":"","tr":null,"ty":null},{"n":"Dakarai Grimsley","a":[],"e":"dakarai.grimsley@gmail.com","y":["2023-2024"],"c":1,"r":"Tutor","rs":["Tutor"],"si":"iLearn CMO","sis":["iLearn CMO"],"di":"LEA - Vernon Township","dis":["LEA - Vernon Township"],"s":"Terminated","t":"needs_support","mp":0.0,"py":"2023-2024","am":"No","em":"No","lm":"No","acm":"No","pi":60.9,"pr":0.0,"p2":22.7,"att":85.3,"je":3.7,"jl":3.8,"rh":"No","re":"Unknown (Not Listed)","co":0,"ct":"","cd":"","hn":"","tr":null,"ty":null},{"n":"Danielle Evers","a":[],"e":"danielletevers@gmail.com","y":["2023-2024"],"c":1,"r":"Tutor","rs":["Tutor"],"si":"iLearn CMO","sis":["iLearn CMO"],"di":"LEA - Vernon Township","dis":["LEA - Vernon Township"],"s":"Terminated","t":"strong","mp":3.0,"py":"2023-2024","am":"Yes","em":"Yes","lm":"Yes","acm":"No","pi":36.4,"pr":9.1,"p2":18.2,"att":100.0,"je":4.6,"jl":4.4,"rh":"Yes","re":"Unknown (Not Listed)","co":0,"ct":"","cd":"","hn":"","tr":null,"ty":null},{"n":"Heather Clements","a":[],"e":"heatherclements83@gmail.com","y":["2023-2024"],"c":1,"r":"Tutor","rs":["Tutor"],"si":"iLearn CMO","sis":["iLearn CMO"],"di":"LEA - Vernon Township","dis":["LEA - Vernon Township"],"s":"Terminated","t":"strong","mp":3.0,"py":"2023-2024","am":"Yes","em":"Yes","lm":"Yes","acm":"No","pi":50.0,"pr":10.0,"p2":6.2,"att":100.0,"je":5.0,"jl":4.9,"rh":"Yes","re":"Unknown (Not Listed)","co":0,"ct":"","cd":"","hn":"","tr":null,"ty":null},{"n":"Kelly Hayden","a":[],"e":"kellyh221001@gmail.com","y":["2023-2024"],"c":1,"r":"Certified Tutor","rs":["Certified Tutor"],"si":"iLearn CMO","sis":["iLearn CMO"],"di":"LEA - Vernon Township","dis":["LEA - Vernon Township"],"s":"Terminated","t":"strong","mp":3.0,"py":"2023-2024","am":"Yes","em":"Yes","lm":"Yes","acm":"No","pi":50.0,"pr":12.5,"p2":12.5,"att":98.8,"je":4.8,"jl":4.5,"rh":"Yes","re":"Unknown (Not Listed)","co":0,"ct":"","cd":"","hn":"","tr":null,"ty":null},{"n":"Paulin Vital","a":[],"e":"pvital877@hotmail.com","y":["2023-2024"],"c":1,"r":"Tutor","rs":["Tutor"],"si":"iLearn CMO","sis":["iLearn CMO"],"di":"LEA - CAPS Central","dis":["LEA - CAPS Central"],"s":"Terminated","t":"needs_support","mp":1.0,"py":"2023-2024","am":"Yes","em":"No","lm":"No","acm":"No","pi":43.5,"pr":4.3,"p2":9.1,"att":100.0,"je":3.8,"jl":3.7,"rh":"No","re":"Unknown (Not Listed)","co":0,"ct":"","cd":"","hn":"","tr":null,"ty":null},{"n":"Qiu Burns","a":[],"e":"qiuburns@gmail.com","y":["2023-2024"],"c":1,"r":"Tutor","rs":["Tutor"],"si":"iLearn CMO","sis":["iLearn CMO"],"di":"LEA - CAPS Central","dis":["LEA - CAPS Central"],"s":"Terminated","t":"stellar","mp":4.0,"py":"2023-2024","am":"Yes","em":"Yes","lm":"Yes","acm":"Yes","pi":76.5,"pr":0.0,"p2":53.3,"att":95.2,"je":4.8,"jl":4.8,"rh":"Yes","re":"Unknown (Not Listed)","co":0,"ct":"","cd":"","hn":"","tr":null,"ty":null},{"n":"Rahul Sankaralingam","a":[],"e":"rsm4597@gmail.com","y":["2023-2024"],"c":1,"r":"Tutor","rs":["Tutor"],"si":"iLearn CMO","sis":["iLearn CMO"],"di":"LEA- Queen City","dis":["LEA- Queen City"],"s":"Terminated","t":"strong","mp":3.0,"py":"2023-2024","am":"Yes","em":"Yes","lm":"Yes","acm":"No","pi":null,"pr":null,"p2":null,"att":100.0,"je":4.6,"jl":4.6,"rh":"Yes","re":"Unknown (Not Listed)","co":0,"ct":"","cd":"","hn":"","tr":null,"ty":null},{"n":"Sharon Hazell","a":[],"e":"sfhazell@gmail.com","y":["2023-2024"],"c":1,"r":"Certified Tutor","rs":["Certified Tutor"],"si":"iLearn CMO","sis":["iLearn CMO"],"di":"LEA - Vernon Township","dis":["LEA - Vernon Township"],"s":"Terminated","t":"strong","mp":3.0,"py":"2023-2024","am":"Yes","em":"Yes","lm":"Yes","acm":"No","pi":55.0,"pr":10.0,"p2":10.0,"att":99.5,"je":4.7,"jl":4.6,"rh":"Yes","re":"Unknown (Not Listed)","co":0,"ct":"","cd":"","hn":"","tr":null,"ty":null},{"n":"Trevor Hazell","a":[],"e":"trevorkhazell@gmail.com","y":["2023-2024"],"c":1,"r":"Tutor","rs":["Tutor"],"si":"iLearn CMO","sis":["iLearn CMO"],"di":"LEA - Vernon Township","dis":["LEA - Vernon Township"],"s":"Terminated","t":"strong","mp":3.0,"py":"2023-2024","am":"Yes","em":"Yes","lm":"Yes","acm":"No","pi":50.0,"pr":10.0,"p2":20.0,"att":100.0,"je":4.8,"jl":4.4,"rh":"Yes","re":"Unknown (Not Listed)","co":0,"ct":"","cd":"","hn":"","tr":null,"ty":null},{"n":"Vaishnavi Pandiyan Vanniyaraj Ramaraj","a":[],"e":"vaav4vr@yahoo.com","y":["2023-2024"],"c":1,"r":"Tutor","rs":["Tutor"],"si":"iLearn CMO","sis":["iLearn CMO"],"di":"LEA - CAPS Central","dis":["LEA - CAPS Central"],"s":"Terminated","t":"stellar","mp":4.0,"py":"2023-2024","am":"Yes","em":"Yes","lm":"Yes","acm":"Yes","pi":87.5,"pr":0.0,"p2":37.5,"att":100.0,"je":4.9,"jl":4.7,"rh":"Yes","re":"Unknown (Not Listed)","co":0,"ct":"","cd":"","hn":"","tr":null,"ty":null},{"n":"Vannessa Cavaleiro","a":[],"e":"vcavaleiro@aol.com","y":["2023-2024"],"c":1,"r":"Tutor","rs":["Tutor"],"si":"iLearn CMO","sis":["iLearn CMO"],"di":"LEA - CAPS Central","dis":["LEA - CAPS Central"],"s":"Terminated","t":"stellar","mp":4.0,"py":"2023-2024","am":"Yes","em":"Yes","lm":"Yes","acm":"Yes","pi":100.0,"pr":0.0,"p2":25.0,"att":96.0,"je":4.9,"jl":4.8,"rh":"Yes","re":"Unknown (Not Listed)","co":0,"ct":"","cd":"","hn":"","tr":null,"ty":null},{"n":"Jessica Borbon","a":[],"e":"jessieborbontutoring@gmail.com","y":["2023-2024"],"c":1,"r":"Tutor","rs":["Tutor"],"si":"iLearn CMO","sis":["iLearn CMO"],"di":"LEA - Vernon Township","dis":["LEA - Vernon Township"],"s":"Terminated","t":"developing","mp":2.0,"py":"2023-2024","am":"Yes","em":"Yes","lm":"No","acm":"No","pi":45.5,"pr":9.1,"p2":9.1,"att":96.4,"je":4.6,"jl":4.1,"rh":"Maybe","re":"Unknown (Not Listed)","co":0,"ct":"","cd":"","hn":"","tr":null,"ty":null},{"n":"Kimara Ramsey","a":[],"e":"kimaraskorner@gmail.com","y":["2025-2026","2023-2024"],"c":2,"r":"Dual Role","rs":["Dual Role"],"si":"iLearn Science & Arts Charter Elementary- Hud","sis":["iLearn CMO","iLearn Science & Arts Charter Elementary- Hudson"],"di":"LEA - iLearn Hudson ES","dis":["LEA - Franklin Twp","LEA - iLearn Hudson ES"],"s":"Terminated","t":"incomplete","mp":null,"py":"","am":null,"em":null,"lm":null,"acm":null,"pi":null,"pr":null,"p2":null,"att":null,"je":null,"jl":null,"rh":null,"re":null,"co":0,"ct":null,"cd":null,"hn":null,"tr":"couldn't handle job responsibilities","ty":"2025-2026"},{"n":"Hendrix Garcia","a":[],"e":"hendrixelise7@gmail.com","y":["2025-2026","2023-2024"],"c":2,"r":"Certified Tutor","rs":["Tutor","Certified Tutor"],"si":"iLearn Science & Arts Charter Elementary Scho","sis":["iLearn CMO","iLearn Science & Arts Charter Elementary School-Passaic"],"di":"LEA - iLearn Passaic ES","dis":["LEA - iLearn Paterson MS","LEA - iLearn Passaic ES"],"s":"Terminated","t":"incomplete","mp":null,"py":"","am":null,"em":null,"lm":null,"acm":null,"pi":null,"pr":null,"p2":null,"att":null,"je":null,"jl":null,"rh":null,"re":null,"co":0,"ct":null,"cd":null,"hn":null,"tr":null,"ty":"2023-2024"},{"n":"Marie Kanu","a":[],"e":"m_kanu2022@yahoo.com","y":["2024-2025","2023-2024"],"c":2,"r":"Certified Tutor","rs":["Certified Tutor"],"si":"Lawrence Township","sis":["Lawrence Township"],"di":"Slackwood Elementary","dis":["Slackwood Elementary"],"s":"Terminated","t":"developing","mp":2.0,"py":"2024-2025","am":"No","em":"No","lm":"Yes","acm":"Yes","pi":87.5,"pr":0.0,"p2":0.0,"att":80.8,"je":3.9,"jl":4.0,"rh":"Maybe","re":"No","co":0,"ct":"","cd":"","hn":"","tr":null,"ty":"2023-2024"},{"n":"Shahzeeb Ahmad","a":[],"e":"shahzaebatiq@gmail.com","y":["2025-2026","2024-2025"],"c":2,"r":"Non-cert Tutor","rs":["Non-cert Tutor"],"si":"iLearn CMO","sis":["iLearn CMO"],"di":"LEA - iLearn Bergen ES","dis":["LEA - iLearn Bergen ES"],"s":"Active","t":"strong","mp":3.0,"py":"2024-2025","am":"Yes","em":"Yes","lm":"Yes","acm":"No","pi":64.7,"pr":1.5,"p2":null,"att":90.5,"je":4.8,"jl":4.7,"rh":"Yes","re":"SY 25-26 Decision TBD","co":0,"ct":"","cd":"","hn":"","tr":null,"ty":null},{"n":"Dylan Aiken","a":[],"e":"dylanaiken224@gmail.com","y":["2024-2025"],"c":1,"r":"Non-cert Tutor","rs":["Non-cert Tutor"],"si":"iLearn CMO","sis":["iLearn CMO"],"di":"LEA - iLearn Paterson MS","dis":["LEA - iLearn Paterson MS"],"s":"Terminated","t":"developing","mp":2.0,"py":"2024-2025","am":"No","em":"Yes","lm":"Yes","acm":"No","pi":21.4,"pr":4.8,"p2":19.1,"att":89.7,"je":4.8,"jl":4.8,"rh":"Maybe","re":"SY 25-26 Decision TBD","co":1,"ct":"Coaching Support or feedback, Reminder/Verbal Warning","cd":"3/14/2025, 3/18/2025","hn":"No, No","tr":null,"ty":null},{"n":"Brandon Burbank","a":[],"e":"brandonburbank514@gmail.com","y":["2024-2025"],"c":1,"r":"Non-cert Tutor","rs":["Non-cert Tutor"],"si":"iLearn CMO","sis":["iLearn CMO"],"di":"LEA - iLearn Bergen MS","dis":["LEA - iLearn Bergen MS"],"s":"Terminated","t":"strong","mp":3.0,"py":"2024-2025","am":"Yes","em":"Yes","lm":"Yes","acm":"No","pi":40.9,"pr":4.5,"p2":36.8,"att":92.5,"je":4.6,"jl":4.6,"rh":"Yes","re":"SY 25-26 Decision TBD","co":0,"ct":"","cd":"","hn":"","tr":null,"ty":null},{"n":"Mary Campanella","a":[],"e":"mcampanella@wtsd.org","y":["2024-2025"],"c":1,"r":"Certified Tutor","rs":["Certified Tutor"],"si":"Waterford Township","sis":["Waterford Township"],"di":"Atco Elementary","dis":["Atco Elementary"],"s":"Terminated","t":"stellar","mp":4.0,"py":"2024-2025","am":"Yes","em":"Yes","lm":"Yes","acm":"Yes","pi":66.7,"pr":0.0,"p2":null,"att":95.2,"je":4.9,"jl":4.9,"rh":"Yes","re":"SY 25-26 Decision TBD","co":0,"ct":"","cd":"","hn":"","tr":null,"ty":null},{"n":"Lauren Campbell","a":[],"e":"laurenhcampbell@gmail.com","y":["2025-2026","2024-2025"],"c":2,"r":"Certified Tutor","rs":["Certified Tutor"],"si":"Penns Grove - Carneys Point Regional School D","sis":["Salem City, Gloucester Township School District","Penns Grove - Carneys Point Regional School District"],"di":"","dis":["Salem Middle School, Erial Elementary School"],"s":"Active","t":"strong","mp":3.0,"py":"2024-2025","am":"Yes","em":"Yes","lm":"Yes","acm":"No","pi":27.3,"pr":0.0,"p2":0.0,"att":85.5,"je":4.4,"jl":4.1,"rh":"Yes","re":"SY 25-26 Decision TBD","co":0,"ct":"","cd":"","hn":"","tr":null,"ty":null},{"n":"Harry Daguizan","a":[],"e":"harryd1850@yahoo.com","y":["2024-2025"],"c":1,"r":"Certified Tutor","rs":["Certified Tutor"],"si":"Lawrence Township","sis":["Lawrence Township"],"di":"Eldridge Park School","dis":["Eldridge Park School"],"s":"Terminated","t":"stellar","mp":4.0,"py":"2024-2025","am":"Yes","em":"Yes","lm":"Yes","acm":"Yes","pi":50.0,"pr":0.0,"p2":16.7,"att":87.8,"je":4.6,"jl":4.5,"rh":"Yes","re":"SY 25-26 Decision TBD","co":0,"ct":"","cd":"","hn":"","tr":null,"ty":null},{"n":"James DeJesus","a":[],"e":"dejesusmarketingllc@gmail.com","y":["2025-2026","2024-2025"],"c":2,"r":"Non-cert Tutor","rs":["Non-cert Tutor"],"si":"iLearn CMO","sis":["iLearn CMO"],"di":"LEA - iLearn Hudson MS","dis":["LEA - iLearn Hudson MS"],"s":"Active","t":"needs_support","mp":0.0,"py":"2024-2025","am":"No","em":"No","lm":"No","acm":"No","pi":43.6,"pr":2.6,"p2":12.0,"att":84.5,"je":4.1,"jl":4.1,"rh":"No","re":"SY 25-26 Decision TBD","co":1,"ct":"Warning/Write Up to Follow, Warning/Write Up to Follow, Warning/Write Up to Foll","cd":"3/18/2025, 10/17/202","hn":"Yes, No, No","tr":null,"ty":null},{"n":"Huda Dwekat","a":[],"e":"hudadwekat0121@gmail.com","y":["2024-2025"],"c":1,"r":"Non-cert Tutor","rs":["Non-cert Tutor"],"si":"iLearn CMO","sis":["iLearn CMO"],"di":"LEA - iLearn Bergen MS","dis":["LEA - iLearn Bergen MS"],"s":"Terminated","t":"developing","mp":2.0,"py":"2024-2025","am":"No","em":"Yes","lm":"Yes","acm":"No","pi":39.4,"pr":16.7,"p2":20.0,"att":81.9,"je":4.9,"jl":4.7,"rh":"Maybe","re":"No","co":0,"ct":"","cd":"","hn":"","tr":null,"ty":null},{"n":"Mary Edwards","a":[],"e":"","y":["2024-2025"],"c":1,"r":"Certified Tutor","rs":["Certified Tutor"],"si":"Gloucester Township School District","sis":["Gloucester Township School District"],"di":"Blackwood Elementary School","dis":["Blackwood Elementary School"],"s":"Terminated","t":"strong","mp":3.0,"py":"2024-2025","am":"Yes","em":"Yes","lm":"Yes","acm":"No","pi":38.5,"pr":0.0,"p2":null,"att":91.6,"je":4.5,"jl":4.4,"rh":"Yes","re":"SY 25-26 Decision TBD","co":0,"ct":"","cd":"","hn":"","tr":null,"ty":null},{"n":"Ruby Espinosa","a":[],"e":"rubyespinosa24.99@outlook.com","y":["2024-2025"],"c":1,"r":"Sub Tutor","rs":["Sub Tutor"],"si":"iLearn CMO","sis":["iLearn CMO"],"di":"LEA - iLearn Bergen ES","dis":["LEA - iLearn Bergen ES"],"s":"Terminated","t":"stellar","mp":4.0,"py":"2024-2025","am":"Yes","em":"Yes","lm":"Yes","acm":"Yes","pi":68.7,"pr":3.0,"p2":50.0,"att":90.1,"je":4.7,"jl":4.7,"rh":"Yes","re":"SY 25-26 Decision TBD","co":0,"ct":"","cd":"","hn":"","tr":null,"ty":null},{"n":"SARA GONZALEZ","a":[],"e":"gonzalezsar330@gmail.com","y":["2025-2026","2024-2025"],"c":2,"r":"Certified Tutor","rs":["Certified Tutor"],"si":"iLearn CMO","sis":["iLearn CMO"],"di":"LEA - iLearn Clifton ES","dis":["LEA - iLearn Clifton ES"],"s":"Active","t":"stellar","mp":4.0,"py":"2024-2025","am":"Yes","em":"Yes","lm":"Yes","acm":"Yes","pi":70.8,"pr":1.5,"p2":null,"att":97.1,"je":4.9,"jl":4.8,"rh":"Yes","re":"SY 25-26 Decision TBD","co":1,"ct":"Reminder/Verbal Warning","cd":"3/18/2025","hn":"No","tr":null,"ty":null},{"n":"Aliviyah Goodson","a":[],"e":"galiviyah@gmail.com","y":["2025-2026","2024-2025"],"c":2,"r":"Non-cert Tutor","rs":["Non-cert Tutor"],"si":"iLearn CMO","sis":["iLearn CMO"],"di":"LEA - iLearn Bergen MS","dis":["LEA - iLearn Bergen MS"],"s":"Active","t":"needs_support","mp":1.0,"py":"2024-2025","am":"No","em":"No","lm":"Yes","acm":"No","pi":32.2,"pr":6.8,"p2":0.0,"att":73.0,"je":4.4,"jl":4.3,"rh":"No","re":"SY 25-26 Decision TBD","co":0,"ct":"","cd":"","hn":"","tr":null,"ty":null},{"n":"Lauren Gray","a":[],"e":"lgray@wtsd.org","y":["2024-2025"],"c":1,"r":"Sub Tutor","rs":["Sub Tutor"],"si":"Waterford Township","sis":["Waterford Township"],"di":"Waterford Elementary","dis":["Waterford Elementary"],"s":"Terminated","t":"stellar","mp":4.0,"py":"2024-2025","am":"Yes","em":"Yes","lm":"Yes","acm":"Yes","pi":43.6,"pr":7.7,"p2":null,"att":100.0,"je":4.9,"jl":4.9,"rh":"Yes","re":"SY 25-26 Decision TBD","co":0,"ct":"","cd":"","hn":"","tr":null,"ty":null},{"n":"Hind Hamoda","a":[],"e":"hindhamoda526@gmail.com","y":["2025-2026","2024-2025"],"c":2,"r":"Non-cert Tutor","rs":["Non-cert Tutor"],"si":"iLearn CMO","sis":["iLearn CMO"],"di":"LEA - iLearn Clifton ES","dis":["LEA - iLearn Clifton ES"],"s":"Active","t":"stellar","mp":4.0,"py":"2024-2025","am":"Yes","em":"Yes","lm":"Yes","acm":"Yes","pi":72.7,"pr":0.0,"p2":21.4,"att":100.0,"je":4.7,"jl":4.7,"rh":"Yes","re":"SY 25-26 Decision TBD","co":0,"ct":"","cd":"","hn":"","tr":"Working FT at iLearn","ty":"2025-2026"},{"n":"Katie Hennigan","a":[],"e":"","y":["2024-2025"],"c":1,"r":"Dual Role","rs":["Dual Role"],"si":"Penns Grove - Carneys Point Regional School D","sis":["Penns Grove - Carneys Point Regional School District, Salem City"],"di":"Penns Grove Middle School, Salem Middle Schoo","dis":["Penns Grove Middle School, Salem Middle School"],"s":"Terminated","t":"strong","mp":3.0,"py":"2024-2025","am":"Yes","em":"Yes","lm":"Yes","acm":"No","pi":11.8,"pr":29.4,"p2":0.0,"att":90.2,"je":4.4,"jl":4.3,"rh":"Yes","re":"SY 25-26 Decision TBD","co":1,"ct":"Other (please describe below)","cd":"6/27/2025","hn":"No","tr":null,"ty":null},{"n":"Franchesca Hernandez","a":[],"e":"fhernandez2218@gmail.com","y":["2024-2025"],"c":1,"r":"Non-cert Tutor","rs":["Non-cert Tutor"],"si":"iLearn CMO","sis":["iLearn CMO"],"di":"LEA - iLearn Passaic MS","dis":["LEA - iLearn Passaic MS"],"s":"Terminated","t":"strong","mp":3.0,"py":"2024-2025","am":"Yes","em":"Yes","lm":"Yes","acm":"No","pi":50.9,"pr":5.7,"p2":0.0,"att":91.5,"je":4.7,"jl":4.7,"rh":"Yes","re":"SY 25-26 Decision TBD","co":0,"ct":"","cd":"","hn":"","tr":null,"ty":null},{"n":"SHANICE JACKMAN","a":[],"e":"sjackman949@gmail.com","y":["2024-2025"],"c":1,"r":"Certified Tutor","rs":["Certified Tutor"],"si":"iLearn CMO","sis":["iLearn CMO"],"di":"LEA - iLearn Paterson MS","dis":["LEA - iLearn Paterson MS"],"s":"Terminated","t":"developing","mp":2.0,"py":"2024-2025","am":"No","em":"Yes","lm":"Yes","acm":"No","pi":38.7,"pr":9.7,"p2":0.0,"att":86.7,"je":4.8,"jl":4.6,"rh":"Maybe","re":"SY 25-26 Decision TBD","co":1,"ct":"Reminder/Verbal Warning","cd":"3/18/2025","hn":"No","tr":null,"ty":null},{"n":"Eliza Kabashi","a":[],"e":"elizakabashi0@gmail.com","y":["2024-2025"],"c":1,"r":"Non-cert Tutor","rs":["Non-cert Tutor"],"si":"iLearn CMO","sis":["iLearn CMO"],"di":"LEA - iLearn Hudson MS","dis":["LEA - iLearn Hudson MS"],"s":"Terminated","t":"needs_support","mp":0.0,"py":"2024-2025","am":"No","em":"No","lm":"No","acm":"No","pi":61.7,"pr":5.0,"p2":0.0,"att":78.1,"je":3.9,"jl":4.0,"rh":"No","re":"SY 25-26 Decision TBD","co":1,"ct":"Reminder/Verbal Warning","cd":"3/18/2025","hn":"No","tr":null,"ty":null},{"n":"Yugene Kim","a":[],"e":"yugenek@gmail.com","y":["2024-2025"],"c":1,"r":"Non-cert Tutor","rs":["Non-cert Tutor"],"si":"iLearn CMO","sis":["iLearn CMO"],"di":"LEA - iLearn Bergen ES","dis":["LEA - iLearn Bergen ES"],"s":"Terminated","t":"stellar","mp":4.0,"py":"2024-2025","am":"Yes","em":"Yes","lm":"Yes","acm":"Yes","pi":67.2,"pr":3.0,"p2":null,"att":91.9,"je":4.7,"jl":4.7,"rh":"Yes","re":"SY 25-26 Decision TBD","co":0,"ct":"","cd":"","hn":"","tr":null,"ty":null},{"n":"Kyeisah Livingston","a":[],"e":"kyeisahl@gmail.com","y":["2025-2026","2024-2025"],"c":2,"r":"Non-cert Tutor","rs":["Non-cert Tutor"],"si":"iLearn Science & Arts Charter Elementary Scho","sis":["iLearn CMO","iLearn Science & Arts Charter Elementary School- Bergen"],"di":"LEA - iLearn Bergen ES","dis":["LEA - iLearn Bergen ES"],"s":"Active","t":"incomplete","mp":null,"py":"2025-2026","am":"","em":"","lm":"","acm":"","pi":null,"pr":null,"p2":null,"att":100.0,"je":4.6,"jl":4.7,"rh":"","re":"SY 25-26 Decision TBD","co":0,"ct":"","cd":"","hn":"","tr":"No longer has a car; can't commute","ty":"2024-2025"},{"n":"Melissa Mazza","a":[],"e":"melissadmazza@gmail.com","y":["2025-2026","2024-2025"],"c":2,"r":"Non-cert Tutor","rs":["Non-cert Tutor"],"si":"iLearn CMO","sis":["iLearn CMO"],"di":"LEA - iLearn Bergen MS","dis":["LEA - iLearn Bergen MS"],"s":"Active","t":"developing","mp":2.0,"py":"2024-2025","am":"No","em":"Yes","lm":"Yes","acm":"No","pi":30.2,"pr":20.6,"p2":null,"att":77.9,"je":4.7,"jl":4.7,"rh":"Maybe","re":"SY 25-26 Decision TBD","co":0,"ct":"","cd":"","hn":"","tr":null,"ty":null},{"n":"Eva Meneses","a":[],"e":"evmflori@gmail.com","y":["2025-2026","2024-2025"],"c":2,"r":"Non-cert Tutor","rs":["Non-cert Tutor"],"si":"iLearn CMO","sis":["iLearn CMO"],"di":"LEA - iLearn Hudson MS","dis":["LEA - iLearn Hudson MS"],"s":"Active","t":"needs_support","mp":1.0,"py":"2024-2025","am":"No","em":"No","lm":"Yes","acm":"No","pi":43.6,"pr":16.4,"p2":0.0,"att":89.9,"je":4.2,"jl":4.2,"rh":"No","re":"SY 25-26 Decision TBD","co":0,"ct":"","cd":"","hn":"","tr":null,"ty":null},{"n":"Brianna Monzo","a":[],"e":"briannagmonzo@icloud.com","y":["2024-2025"],"c":1,"r":"Non-cert Tutor","rs":["Non-cert Tutor"],"si":"Gloucester Township School District","sis":["Gloucester Township School District"],"di":"JW Lilley Elementary School","dis":["JW Lilley Elementary School"],"s":"Terminated","t":"developing","mp":2.0,"py":"2024-2025","am":"No","em":"Yes","lm":"Yes","acm":"No","pi":40.0,"pr":0.0,"p2":0.0,"att":81.4,"je":4.7,"jl":4.6,"rh":"Maybe","re":"SY 25-26 Decision TBD","co":0,"ct":"","cd":"","hn":"","tr":null,"ty":null},{"n":"Debra Mulville","a":[],"e":"dmulville114@comcast.net","y":["2024-2025"],"c":1,"r":"Non-cert Tutor","rs":["Non-cert Tutor"],"si":"Riverton","sis":["Riverton"],"di":"Riverton School","dis":["Riverton School"],"s":"Terminated","t":"stellar","mp":4.0,"py":"2024-2025","am":"Yes","em":"Yes","lm":"Yes","acm":"Yes","pi":61.5,"pr":7.7,"p2":15.4,"att":92.5,"je":4.6,"jl":4.4,"rh":"Yes","re":"SY 25-26 Decision TBD","co":0,"ct":"","cd":"","hn":"","tr":null,"ty":null},{"n":"BRIANA NURSE","a":[],"e":"bnurse67@gmail.com","y":["2024-2025"],"c":1,"r":"Dual Role","rs":["Dual Role"],"si":"iLearn CMO","sis":["iLearn CMO"],"di":"LEA - iLearn Paterson MS","dis":["LEA - iLearn Paterson MS"],"s":"Terminated","t":"needs_support","mp":1.0,"py":"2024-2025","am":"No","em":"No","lm":"Yes","acm":"No","pi":41.7,"pr":8.3,"p2":null,"att":58.3,"je":4.2,"jl":4.2,"rh":"No","re":"SY 25-26 Decision TBD","co":0,"ct":"","cd":"","hn":"","tr":null,"ty":null},{"n":"Shanique Nembhard","a":[],"e":"shaniahw@gmail.com","y":["2025-2026","2024-2025"],"c":2,"r":"Dual Role","rs":["Dual Role"],"si":"Lawrence/Eldridge Park ES","sis":["Lawrence Township","Lawrence/Eldridge Park ES"],"di":"","dis":["Eldridge Park School"],"s":"Active","t":"stellar","mp":4.0,"py":"2024-2025","am":"Yes","em":"Yes","lm":"Yes","acm":"Yes","pi":57.1,"pr":0.0,"p2":null,"att":100.0,"je":4.7,"jl":4.6,"rh":"Yes","re":"SY 25-26 Decision TBD","co":0,"ct":"","cd":"","hn":"","tr":null,"ty":null},{"n":"Anita Pecorelli","a":[],"e":"apecorelli52@yahoo.com","y":["2024-2025"],"c":1,"r":"Certified Tutor","rs":["Certified Tutor"],"si":"Boys and Girls Club","sis":["Boys and Girls Club"],"di":"Asbury-Bradley Elementary","dis":["Asbury-Bradley Elementary"],"s":"Terminated","t":"strong","mp":3.0,"py":"2024-2025","am":"Yes","em":"Yes","lm":"Yes","acm":"No","pi":null,"pr":null,"p2":null,"att":94.4,"je":4.5,"jl":4.5,"rh":"Yes","re":"SY 25-26 Decision TBD","co":0,"ct":"","cd":"","hn":"","tr":null,"ty":null},{"n":"MARTA REYES","a":[],"e":"reyestcb0870@gmail.com","y":["2025-2026","2024-2025"],"c":2,"r":"Dual Role","rs":["Dual Role"],"si":"Hamilton Township School District","sis":["Hamilton Township, Lawrence Township, Penns Grove - Carneys Point Regional School District","Hamilton Township School District"],"di":"LEA - Hamiton Twp","dis":["Kuser, Slackwood Elementary, Penns Grove Middle School","LEA - Hamiton Twp"],"s":"Active","t":"stellar","mp":4.0,"py":"2024-2025","am":"Yes","em":"Yes","lm":"Yes","acm":"Yes","pi":85.7,"pr":0.0,"p2":null,"att":100.0,"je":4.5,"jl":4.5,"rh":"Yes","re":"SY 25-26 Decision TBD","co":0,"ct":"","cd":"","hn":"","tr":null,"ty":null},{"n":"KEVIN RUFF","a":[],"e":"kevru3909@gmail.com","y":["2024-2025"],"c":1,"r":"Sub Tutor","rs":["Sub Tutor"],"si":"Global Leadership Academy Charter Schools","sis":["Global Leadership Academy Charter Schools"],"di":"Global Leadership Academy","dis":["Global Leadership Academy"],"s":"Terminated","t":"developing","mp":2.0,"py":"2024-2025","am":"No","em":"Yes","lm":"Yes","acm":"No","pi":null,"pr":null,"p2":null,"att":83.3,"je":null,"jl":null,"rh":"Maybe","re":"SY 25-26 Decision TBD","co":0,"ct":"","cd":"","hn":"","tr":null,"ty":null},{"n":"Eyad Ramadan","a":[],"e":"eyad.ramadan5@gmail.com","y":["2024-2025"],"c":1,"r":"Certified Tutor","rs":["Certified Tutor"],"si":"iLearn CMO","sis":["iLearn CMO"],"di":"LEA - iLearn Passaic ES","dis":["LEA - iLearn Passaic ES"],"s":"Terminated","t":"stellar","mp":4.0,"py":"2024-2025","am":"Yes","em":"Yes","lm":"Yes","acm":"Yes","pi":86.3,"pr":0.0,"p2":33.3,"att":91.1,"je":5.0,"jl":5.0,"rh":"Yes","re":"SY 25-26 Decision TBD","co":0,"ct":"","cd":"","hn":"","tr":null,"ty":null},{"n":"Norelis Ramirez","a":[],"e":"norelisram@gmail.com","y":["2025-2026","2024-2025"],"c":2,"r":"Non-cert Tutor","rs":["Non-cert Tutor"],"si":"iLearn CMO","sis":["iLearn CMO"],"di":"LEA - iLearn Paterson ES","dis":["LEA - iLearn Paterson ES"],"s":"Active","t":"developing","mp":2.0,"py":"2024-2025","am":"No","em":"Yes","lm":"Yes","acm":"No","pi":62.3,"pr":7.2,"p2":9.5,"att":89.4,"je":4.7,"jl":4.6,"rh":"Maybe","re":"SY 25-26 Decision TBD","co":1,"ct":"Reminder/Verbal Warning","cd":"3/18/2025","hn":"No","tr":null,"ty":null},{"n":"Allison Schafer","a":[],"e":"aschafer@wtsd.org","y":["2024-2025"],"c":1,"r":"Instructional Coach","rs":["Instructional Coach"],"si":"Waterford Township","sis":["Waterford Township"],"di":"Atco Elementary","dis":["Atco Elementary"],"s":"Terminated","t":"stellar","mp":4.0,"py":"2024-2025","am":"Yes","em":"Yes","lm":"Yes","acm":"Yes","pi":45.5,"pr":4.5,"p2":null,"att":100.0,"je":4.3,"jl":4.1,"rh":"Yes","re":"SY 25-26 Decision TBD","co":0,"ct":"","cd":"","hn":"","tr":null,"ty":null},{"n":"Leslie Black","a":[],"e":"lesliesblack3@gmail.com","y":["2025-2026","2024-2025"],"c":2,"r":"Site Coordinator","rs":["Non-cert Tutor","Site Coordinator"],"si":"iLearn CMO","sis":["iLearn CMO"],"di":"LEA - iLearn Passaic MS","dis":["LEA - iLearn Passaic MS"],"s":"Active","t":"strong","mp":3.0,"py":"2024-2025","am":"Yes","em":"Yes","lm":"Yes","acm":"No","pi":54.0,"pr":4.0,"p2":16.7,"att":94.0,"je":4.5,"jl":4.4,"rh":"Yes","re":"SY 25-26 Decision TBD","co":0,"ct":"","cd":"","hn":"","tr":null,"ty":null},{"n":"Jamie Stephan","a":[],"e":"rjstephan00@gmail.com","y":["2024-2025"],"c":1,"r":"Certified Sub- Tutor","rs":["Certified Sub- Tutor"],"si":"Waterford Township","sis":["Waterford Township"],"di":"Atco Elementary","dis":["Atco Elementary"],"s":"Terminated","t":"stellar","mp":4.0,"py":"2024-2025","am":"Yes","em":"Yes","lm":"Yes","acm":"Yes","pi":43.9,"pr":8.8,"p2":null,"att":100.0,"je":4.7,"jl":4.7,"rh":"Yes","re":"SY 25-26 Decision TBD","co":0,"ct":"","cd":"","hn":"","tr":null,"ty":null},{"n":"Ariana Stubbs","a":[],"e":"arianastubbs83@gmail.com","y":["2025-2026","2024-2025"],"c":2,"r":"Non-cert Sub Tutor","rs":["Sub Tutor","Non-cert Sub Tutor"],"si":"All Locations","sis":["Lawrence Township","All Locations"],"di":"","dis":["Eldridge Park School"],"s":"Active","t":"strong","mp":3.0,"py":"2024-2025","am":"No","em":"Yes","lm":"Yes","acm":"Yes","pi":62.5,"pr":0.0,"p2":0.0,"att":81.1,"je":4.5,"jl":4.5,"rh":"Yes","re":"SY 25-26 Decision TBD","co":0,"ct":"","cd":"","hn":"","tr":null,"ty":null},{"n":"Colin Tonry","a":[],"e":"ctonry20@gmail.com","y":["2024-2025"],"c":1,"r":"Non-cert Tutor","rs":["Non-cert Tutor"],"si":"Hamilton Township","sis":["Hamilton Township"],"di":"Crockett Middle School","dis":["Crockett Middle School"],"s":"Terminated","t":"needs_support","mp":1.0,"py":"2024-2025","am":"Yes","em":"No","lm":"No","acm":"No","pi":null,"pr":null,"p2":null,"att":91.7,"je":3.9,"jl":3.9,"rh":"No","re":"SY 25-26 Decision TBD","co":0,"ct":"","cd":"","hn":"","tr":null,"ty":null},{"n":"Pooja Tyagi","a":[],"e":"poojatyagijob2023@gmail.com","y":["2025-2026","2024-2025"],"c":2,"r":"Non-cert Tutor","rs":["Non-cert Tutor"],"si":"Clinton Township, Hamilton Township","sis":["Clinton Township, Hamilton Township"],"di":"Round Valley School , Crockett Middle School","dis":["Round Valley School , Crockett Middle School"],"s":"Active","t":"needs_support","mp":1.0,"py":"2024-2025","am":"No","em":"No","lm":"Yes","acm":"No","pi":0.0,"pr":0.0,"p2":null,"att":80.6,"je":4.1,"jl":4.3,"rh":"No","re":"SY 25-26 Decision TBD","co":0,"ct":"Reminder/Verbal Warning, Other (please describe below)","cd":"1/20/2026, 1/20/2026","hn":"On Watch, On Watch","tr":null,"ty":null},{"n":"Zahnik Underdue","a":[],"e":"zahnikhill@gmail.com","y":["2024-2025"],"c":1,"r":"Non-cert Tutor","rs":["Non-cert Tutor"],"si":"iLearn CMO","sis":["iLearn CMO"],"di":"LEA - iLearn Clifton MS","dis":["LEA - iLearn Clifton MS"],"s":"Terminated","t":"needs_support","mp":1.0,"py":"2024-2025","am":"No","em":"No","lm":"Yes","acm":"No","pi":32.7,"pr":7.3,"p2":0.0,"att":83.0,"je":4.4,"jl":4.4,"rh":"No","re":"SY 25-26 Decision TBD","co":1,"ct":"Warning/Write Up to Follow","cd":"4/21/2025","hn":"Yes","tr":null,"ty":null},{"n":"Everene Wilson","a":[],"e":"","y":["2024-2025"],"c":1,"r":"Non-cert Tutor","rs":["Non-cert Tutor"],"si":"Global Leadership Academy Charter Schools","sis":["Global Leadership Academy Charter Schools"],"di":"Global Leadership Academy Charter Schools","dis":["Global Leadership Academy Charter Schools"],"s":"Terminated","t":"needs_support","mp":0.0,"py":"2024-2025","am":"No","em":"No","lm":"No","acm":"No","pi":null,"pr":null,"p2":null,"att":73.3,"je":3.8,"jl":3.8,"rh":"No","re":"SY 25-26 Decision TBD","co":0,"ct":"","cd":"","hn":"","tr":null,"ty":null},{"n":"Timothy Winn","a":[],"e":"tim.r.winn@gmail.com","y":["2024-2025"],"c":1,"r":"Dual Role","rs":["Dual Role"],"si":"iLearn CMO","sis":["iLearn CMO"],"di":"LEA - iLearn Bergen MS","dis":["LEA - iLearn Bergen MS"],"s":"Terminated","t":"developing","mp":2.0,"py":"2024-2025","am":"Yes","em":"No","lm":"Yes","acm":"No","pi":36.4,"pr":19.5,"p2":null,"att":97.0,"je":4.3,"jl":4.3,"rh":"Maybe","re":"SY 25-26 Decision TBD","co":1,"ct":"Reminder/Verbal Warning, Coaching Support or feedback, Other (please describe be","cd":"3/6/2025, 3/6/2025, ","hn":"Yes, Yes, Yes, Yes","tr":null,"ty":null},{"n":"Jasmine Ramsey","a":[],"e":"bearandbunny97@gmail.com","y":["2025-2026","2024-2025"],"c":2,"r":"Certified Tutor","rs":["Non-cert Tutor","Certified Tutor"],"si":"iLearn Science & Arts Charter Elementary Scho","sis":["iLearn CMO","iLearn Science & Arts Charter Elementary School-Passaic"],"di":"LEA - iLearn Passaic ES","dis":["LEA - iLearn Passaic MS","LEA - iLearn Passaic ES"],"s":"Active","t":"incomplete","mp":null,"py":"2025-2026","am":"","em":"","lm":"","acm":"","pi":null,"pr":null,"p2":null,"att":90.2,"je":4.2,"jl":4.1,"rh":"","re":"SY 25-26 Decision TBD","co":0,"ct":"","cd":"","hn":"","tr":null,"ty":null},{"n":"Katharine Samberg-Lawrence","a":[],"e":"kt.samberg@gmail.com","y":["2025-2026","2024-2025"],"c":2,"r":"Non-cert Tutor","rs":["Dual Role","Non-cert Tutor"],"si":"Pemberton Township","sis":["Pemberton Township"],"di":"FT DIX SCHOOL","dis":["FT DIX SCHOOL"],"s":"Active","t":"developing","mp":2.0,"py":"2023-2024","am":"No","em":"Yes","lm":"Yes","acm":"No","pi":20.0,"pr":40.0,"p2":0.0,"att":54.6,"je":4.8,"jl":4.6,"rh":"Maybe","re":"Unknown (Not Listed)","co":0,"ct":"Other (please describe below)","cd":"7/16/2025","hn":"Yes","tr":null,"ty":null},{"n":"Joann Maybury","a":[],"e":"walkinginwellness1010@gmail.com","y":["2025-2026","2024-2025"],"c":2,"r":"Non-cert Tutor","rs":["Certified Tutor","Non-cert Tutor"],"si":"Haddon Township","sis":["Haddon Township"],"di":"Stoy","dis":["Stoy"],"s":"Active","t":"incomplete","mp":null,"py":"","am":null,"em":null,"lm":null,"acm":null,"pi":null,"pr":null,"p2":null,"att":null,"je":null,"jl":null,"rh":null,"re":null,"co":0,"ct":null,"cd":null,"hn":null,"tr":"resigned while on bereavement for a better job opportunity.","ty":"2025-2026"},{"n":"Everene Williams","a":[],"e":"everenewilliams@gmail.com","y":["2025-2026","2024-2025"],"c":2,"r":"Non-cert Tutor","rs":["Non-cert Tutor"],"si":"Global Leadership Academy- West","sis":["Global Leadership Academy Charter Schools","Global Leadership Academy- West"],"di":"","dis":["Global Leadership Academy"],"s":"Terminated","t":"incomplete","mp":null,"py":"2025-2026","am":"","em":"","lm":"","acm":"","pi":null,"pr":null,"p2":null,"att":68.2,"je":4.5,"jl":4.2,"rh":"","re":"SY 25-26 Decision TBD","co":0,"ct":"","cd":"","hn":"","tr":"another job opportunity","ty":"2025-2026"},{"n":"Michael Mun","a":[],"e":"mmun1107@gmail.com","y":["2025-2026","2024-2025"],"c":2,"r":"Non-cert Tutor","rs":["Non-cert Tutor"],"si":"iLearn CMO","sis":["iLearn CMO"],"di":"LEA - iLearn Paterson MS","dis":["LEA - iLearn Paterson MS"],"s":"Active","t":"incomplete","mp":null,"py":"2025-2026","am":"","em":"","lm":"","acm":"","pi":null,"pr":null,"p2":null,"att":86.0,"je":4.3,"jl":4.3,"rh":"","re":"SY 25-26 Decision TBD","co":0,"ct":"","cd":"","hn":"","tr":null,"ty":null},{"n":"Manuel Algarin","a":[],"e":"algarin0@gmail.com","y":["2025-2026","2024-2025"],"c":2,"r":"Instructional Coach","rs":["Dual Role","Instructional Coach"],"si":"iLearn CMO","sis":["iLearn CMO"],"di":"LEA - iLearn Bergen MS","dis":["LEA - iLearn Bergen MS"],"s":"Terminated","t":"incomplete","mp":null,"py":"","am":null,"em":null,"lm":null,"acm":null,"pi":null,"pr":null,"p2":null,"att":null,"je":null,"jl":null,"rh":null,"re":null,"co":0,"ct":null,"cd":null,"hn":null,"tr":null,"ty":null},{"n":"Ian Anderson","a":[],"e":"iannoel94@gmail.com","y":["2025-2026"],"c":1,"r":"Non-cert Tutor","rs":["Non-cert Tutor"],"si":"iLearn CMO","sis":["iLearn CMO"],"di":"LEA - iLearn Hudson MS","dis":["LEA - iLearn Hudson MS"],"s":"Active","t":"incomplete","mp":null,"py":"2025-2026","am":"","em":"","lm":"","acm":"","pi":null,"pr":null,"p2":null,"att":81.3,"je":4.4,"jl":4.4,"rh":"","re":"SY 25-26 Decision TBD","co":0,"ct":"","cd":"","hn":"","tr":null,"ty":null},{"n":"Nicholas Antoine","a":[],"e":"eniotnacin@gmail.com","y":["2025-2026"],"c":1,"r":"Non-cert Tutor","rs":["Non-cert Tutor"],"si":"Global Leadership Academy Charter Schools","sis":["Global Leadership Academy Charter Schools"],"di":"Global Leadership Academy","dis":["Global Leadership Academy"],"s":"Active","t":"incomplete","mp":null,"py":"2025-2026","am":"","em":"","lm":"","acm":"","pi":null,"pr":null,"p2":null,"att":89.6,"je":4.5,"jl":4.2,"rh":"","re":"SY 25-26 Decision TBD","co":0,"ct":"Reminder/Verbal Warning, Reminder/Verbal Warning, Observation by PM Team","cd":"1/30/2026, 2/3/2026,","hn":"On Watch, On Watch, On Watch","tr":null,"ty":null},{"n":"Davide Berardi","a":[],"e":"berardida@gmail.com","y":["2025-2026"],"c":1,"r":"Certified Tutor","rs":["Certified Tutor"],"si":"iLearn CMO","sis":["iLearn CMO"],"di":"LEA - iLearn Bergen ES","dis":["LEA - iLearn Bergen ES"],"s":"Active","t":"incomplete","mp":null,"py":"","am":null,"em":null,"lm":null,"acm":null,"pi":null,"pr":null,"p2":null,"att":null,"je":null,"jl":null,"rh":null,"re":null,"co":0,"ct":null,"cd":null,"hn":null,"tr":"another job opportunity","ty":"2025-2026"},{"n":"Jodi Bianchi","a":[],"e":"jodibianchi2@gmail.com","y":["2025-2026"],"c":1,"r":"Dual Role","rs":["Dual Role"],"si":"iLearn CMO","sis":["iLearn CMO"],"di":"LEA - iLearn Bergen ES","dis":["LEA - iLearn Bergen ES"],"s":"Active","t":"incomplete","mp":null,"py":"2025-2026","am":"","em":"","lm":"","acm":"","pi":null,"pr":null,"p2":null,"att":100.0,"je":4.7,"jl":4.3,"rh":"","re":"SY 25-26 Decision TBD","co":0,"ct":"","cd":"","hn":"","tr":null,"ty":null},{"n":"Daniel DiQuinzio","a":[],"e":"diquinziodaniel31@gmail.com","y":["2025-2026"],"c":1,"r":"Non-cert Tutor","rs":["Non-cert Tutor"],"si":"iLearn CMO","sis":["iLearn CMO"],"di":"LEA - iLearn Hudson ES","dis":["LEA - iLearn Hudson ES"],"s":"Active","t":"incomplete","mp":null,"py":"","am":null,"em":null,"lm":null,"acm":null,"pi":null,"pr":null,"p2":null,"att":null,"je":null,"jl":null,"rh":null,"re":null,"co":0,"ct":null,"cd":null,"hn":null,"tr":"Not performing job duties","ty":"2025-2026"},{"n":"Zakaria Imessaoudene","a":[],"e":"znimessaoudene@gmail.com","y":["2025-2026"],"c":1,"r":"Non-cert Tutor","rs":["Non-cert Tutor"],"si":"iLearn CMO","sis":["iLearn CMO"],"di":"LEA - iLearn Clifton ES","dis":["LEA - iLearn Clifton ES"],"s":"Active","t":"incomplete","mp":null,"py":"","am":null,"em":null,"lm":null,"acm":null,"pi":null,"pr":null,"p2":null,"att":null,"je":null,"jl":null,"rh":null,"re":null,"co":0,"ct":null,"cd":null,"hn":null,"tr":"No","ty":"2025-2026"},{"n":"Youngsoo Kim","a":[],"e":"","y":["2025-2026"],"c":1,"r":"Non-cert Tutor","rs":["Non-cert Tutor"],"si":"iLearn CMO","sis":["iLearn CMO"],"di":"LEA - iLearn Hudson MS","dis":["LEA - iLearn Hudson MS"],"s":"Active","t":"incomplete","mp":null,"py":"2025-2026","am":"","em":"","lm":"","acm":"","pi":null,"pr":null,"p2":null,"att":null,"je":null,"jl":null,"rh":"","re":"SY 25-26 Decision TBD","co":0,"ct":"","cd":"","hn":"","tr":null,"ty":null},{"n":"Bryanna Matos","a":[],"e":"brysaint14@gmail.com","y":["2025-2026"],"c":1,"r":"Non-cert Tutor","rs":["Non-cert Tutor"],"si":"iLearn CMO","sis":["iLearn CMO"],"di":"LEA - iLearn Clifton MS","dis":["LEA - iLearn Clifton MS"],"s":"Active","t":"incomplete","mp":null,"py":"2025-2026","am":"","em":"","lm":"","acm":"","pi":null,"pr":null,"p2":null,"att":81.0,"je":3.9,"jl":4.0,"rh":"","re":"SY 25-26 Decision TBD","co":0,"ct":"Warning/Write Up to Follow","cd":"12/2/2025","hn":"No","tr":null,"ty":null},{"n":"Theodore Mills","a":[],"e":"millslearninglink@gmail.com","y":["2025-2026"],"c":1,"r":"Non-cert Tutor","rs":["Non-cert Tutor"],"si":"Middlesex Charter","sis":["Middlesex Charter"],"di":"Middlesex County STEM Charter School","dis":["Middlesex County STEM Charter School"],"s":"Active","t":"incomplete","mp":null,"py":"2025-2026","am":"","em":"","lm":"","acm":"","pi":null,"pr":null,"p2":null,"att":100.0,"je":3.7,"jl":4.2,"rh":"","re":"SY 25-26 Decision TBD","co":0,"ct":"","cd":"","hn":"","tr":null,"ty":null},{"n":"Laila Modzelewski","a":[],"e":"laila.mod18@gmail.com","y":["2025-2026"],"c":1,"r":"Dual Role","rs":["Dual Role"],"si":"Middlesex Charter","sis":["Middlesex Charter"],"di":"Middlesex County STEM Charter School","dis":["Middlesex County STEM Charter School"],"s":"Active","t":"incomplete","mp":null,"py":"","am":null,"em":null,"lm":null,"acm":null,"pi":null,"pr":null,"p2":null,"att":null,"je":null,"jl":null,"rh":null,"re":null,"co":0,"ct":null,"cd":null,"hn":null,"tr":"Resigned because she did not want to step in as a tutor for a long period of time; wasn't confident in tutoring math","ty":"2025-2026"},{"n":"Edwin Montesdeoca","a":[],"e":"emontesdeoca143@gmail.com","y":["2025-2026"],"c":1,"r":"Non-cert Tutor","rs":["Non-cert Tutor"],"si":"iLearn CMO","sis":["iLearn CMO"],"di":"LEA - iLearn Bergen MS","dis":["LEA - iLearn Bergen MS"],"s":"Active","t":"incomplete","mp":null,"py":"2025-2026","am":"","em":"","lm":"","acm":"","pi":null,"pr":null,"p2":null,"att":67.9,"je":4.5,"jl":4.2,"rh":"","re":"SY 25-26 Decision TBD","co":0,"ct":"","cd":"","hn":"","tr":null,"ty":null},{"n":"Shabnam Mustari","a":[],"e":"shabnam.m1209@gmail.com","y":["2025-2026"],"c":1,"r":"Non-cert Tutor","rs":["Non-cert Tutor"],"si":"Somerset County","sis":["Somerset County"],"di":"Central Jersey College Prep","dis":["Central Jersey College Prep"],"s":"Active","t":"incomplete","mp":null,"py":"2025-2026","am":"","em":"","lm":"","acm":"","pi":null,"pr":null,"p2":null,"att":96.4,"je":3.7,"jl":4.0,"rh":"","re":"SY 25-26 Decision TBD","co":0,"ct":"Reminder/Verbal Warning","cd":"12/4/2025","hn":"First Write Up - Employee Progress Report","tr":null,"ty":null},{"n":"Nicole Odigie","a":[],"e":"","y":["2025-2026"],"c":1,"r":"Dual Role","rs":["Dual Role"],"si":"iLearn CMO","sis":["iLearn CMO"],"di":"LEA - iLearn Clifton ES","dis":["LEA - iLearn Clifton ES"],"s":"Active","t":"incomplete","mp":null,"py":"2025-2026","am":"","em":"","lm":"","acm":"","pi":null,"pr":null,"p2":null,"att":null,"je":null,"jl":null,"rh":"","re":"SY 25-26 Decision TBD","co":0,"ct":"","cd":"","hn":"","tr":null,"ty":null},{"n":"Lakeeda Sessoms","a":[],"e":"lakeedasessoms@gmail.com","y":["2025-2026"],"c":1,"r":"Dual Role","rs":["Dual Role"],"si":"iLearn CMO","sis":["iLearn CMO"],"di":"LEA - iLearn Paterson ES","dis":["LEA - iLearn Paterson ES"],"s":"Active","t":"incomplete","mp":null,"py":"2025-2026","am":"","em":"","lm":"","acm":"","pi":null,"pr":null,"p2":null,"att":100.0,"je":4.6,"jl":4.7,"rh":"","re":"SY 25-26 Decision TBD","co":0,"ct":"","cd":"","hn":"","tr":null,"ty":null},{"n":"Kadeasia Washington","a":[],"e":"klwashington94@gmail.com","y":["2025-2026"],"c":1,"r":"Non-cert Tutor","rs":["Non-cert Tutor"],"si":"Middlesex Charter","sis":["Middlesex Charter"],"di":"Middlesex County STEM Charter School","dis":["Middlesex County STEM Charter School"],"s":"Active","t":"incomplete","mp":null,"py":"","am":null,"em":null,"lm":null,"acm":null,"pi":null,"pr":null,"p2":null,"att":null,"je":null,"jl":null,"rh":null,"re":null,"co":0,"ct":null,"cd":null,"hn":null,"tr":"We sent her a termination letter because she failed to obtain her fingerprins, and incomplete training","ty":"2025-2026"},{"n":"Tamia Williams","a":[],"e":"williams.tamia.10@gmail.com","y":["2025-2026"],"c":1,"r":"Non-cert Tutor","rs":["Non-cert Tutor"],"si":"iLearn CMO","sis":["iLearn CMO"],"di":"LEA - iLearn Passaic ES","dis":["LEA - iLearn Passaic ES"],"s":"Active","t":"incomplete","mp":null,"py":"2025-2026","am":"","em":"","lm":"","acm":"","pi":null,"pr":null,"p2":null,"att":96.8,"je":4.8,"jl":4.7,"rh":"","re":"SY 25-26 Decision TBD","co":0,"ct":"","cd":"","hn":"","tr":null,"ty":null},{"n":"Pandya Gunjan","a":[],"e":"tinipandya@gmail.com","y":["2025-2026"],"c":1,"r":"Non-cert Sub Tutor","rs":["Non-cert Sub Tutor"],"si":"Middlesex County STEM Charter School","sis":["Middlesex County STEM Charter School"],"di":"Middlesex County STEM Charter School","dis":["Middlesex County STEM Charter School"],"s":"Active","t":"incomplete","mp":null,"py":"2025-2026","am":"","em":"","lm":"","acm":"","pi":null,"pr":null,"p2":null,"att":null,"je":null,"jl":null,"rh":"","re":"SY 25-26 Decision TBD","co":0,"ct":"","cd":"","hn":"","tr":null,"ty":null},{"n":"Nicholas Hoover","a":[],"e":"nhoover190@gmail.com","y":["2025-2026"],"c":1,"r":"Non-cert Tutor","rs":["Non-cert Tutor"],"si":"Haddon Township","sis":["Haddon Township"],"di":"Haddon Twp","dis":["Haddon Twp"],"s":"Active","t":"incomplete","mp":null,"py":"2025-2026","am":"","em":"","lm":"","acm":"","pi":null,"pr":null,"p2":null,"att":94.3,"je":4.4,"jl":4.1,"rh":"","re":"SY 25-26 Decision TBD","co":0,"ct":"","cd":"","hn":"","tr":null,"ty":null},{"n":"Ashley Garcia","a":[],"e":"hendrixelise7@gmail.com","y":["2025-2026"],"c":1,"r":"Certified Tutor","rs":["Certified Tutor"],"si":"iLearn Science & Arts Charter Elementary Scho","sis":["iLearn Science & Arts Charter Elementary School-Passaic"],"di":"LEA - iLearn Passaic ES","dis":["LEA - iLearn Passaic ES"],"s":"Active","t":"incomplete","mp":null,"py":"","am":null,"em":null,"lm":null,"acm":null,"pi":null,"pr":null,"p2":null,"att":null,"je":null,"jl":null,"rh":null,"re":null,"co":0,"ct":null,"cd":null,"hn":null,"tr":null,"ty":null},{"n":"Monica Brown","a":[],"e":"esseyamonica@gmail.com","y":["2025-2026"],"c":1,"r":"Non-cert Sub Tutor","rs":["Non-cert Sub Tutor"],"si":"iLearn Science & Art Charter Elementary -Clif","sis":["iLearn Science & Art Charter Elementary -Clifton"],"di":"LEA - iLearn Clifton ES","dis":["LEA - iLearn Clifton ES"],"s":"Active","t":"incomplete","mp":null,"py":"2025-2026","am":"","em":"","lm":"","acm":"","pi":null,"pr":null,"p2":null,"att":87.8,"je":4.7,"jl":4.7,"rh":"","re":"SY 25-26 Decision TBD","co":0,"ct":"","cd":"","hn":"","tr":null,"ty":null},{"n":"Colleen Elam","a":[],"e":"colleen.norwood@gmail.com","y":["2025-2026"],"c":1,"r":"Dual Role","rs":["Dual Role"],"si":"Somerset","sis":["Somerset"],"di":"Somerset","dis":["Somerset"],"s":"Active","t":"incomplete","mp":null,"py":"2025-2026","am":"","em":"","lm":"","acm":"","pi":null,"pr":null,"p2":null,"att":100.0,"je":4.4,"jl":4.4,"rh":"","re":"SY 25-26 Decision TBD","co":0,"ct":"","cd":"","hn":"","tr":null,"ty":null},{"n":"Caitlin Evgeniadis","a":[],"e":"caitlinevgeniadis@gmail.com","y":["2025-2026"],"c":1,"r":"Non-cert Tutor","rs":["Non-cert Tutor"],"si":"Hamilton Township School District","sis":["Hamilton Township School District"],"di":"Hamilton Twp","dis":["Hamilton Twp"],"s":"Active","t":"incomplete","mp":null,"py":"2025-2026","am":"","em":"","lm":"","acm":"","pi":null,"pr":null,"p2":null,"att":96.9,"je":4.5,"jl":4.4,"rh":"","re":"SY 25-26 Decision TBD","co":0,"ct":"","cd":"","hn":"","tr":null,"ty":null},{"n":"Carolyn Butler","a":[],"e":"giordanoc44@gmail.com","y":["2025-2026"],"c":1,"r":"CertifiedTutor","rs":["CertifiedTutor"],"si":"Hamilton Township School District","sis":["Hamilton Township School District"],"di":"Hamilton Twp","dis":["Hamilton Twp"],"s":"Active","t":"incomplete","mp":null,"py":"2025-2026","am":"","em":"","lm":"","acm":"","pi":null,"pr":null,"p2":null,"att":96.1,"je":4.6,"jl":4.5,"rh":"","re":"SY 25-26 Decision TBD","co":0,"ct":"","cd":"","hn":"","tr":null,"ty":null},{"n":"Tanya Israel-Sainthilaire","a":[],"e":"ms.israel70@gmail.com","y":["2025-2026"],"c":1,"r":"Dual Role","rs":["Dual Role"],"si":"iLearn Science & Arts Charter Elementary Scho","sis":["iLearn Science & Arts Charter Elementary School-Passaic"],"di":"LEA - iLearn Passaic ES","dis":["LEA - iLearn Passaic ES"],"s":"Active","t":"incomplete","mp":null,"py":"2025-2026","am":"","em":"","lm":"","acm":"","pi":null,"pr":null,"p2":null,"att":null,"je":null,"jl":null,"rh":"","re":"SY 25-26 Decision TBD","co":0,"ct":"","cd":"","hn":"","tr":null,"ty":null},{"n":"Eric Zeidman","a":[],"e":"ericztutor@gmail.com","y":["2025-2026"],"c":1,"r":"Certified Sub Tutor","rs":["Certified Sub Tutor"],"si":"Hamilton Township School District","sis":["Hamilton Township School District"],"di":"Hamilton Twp","dis":["Hamilton Twp"],"s":"Active","t":"incomplete","mp":null,"py":"2025-2026","am":"","em":"","lm":"","acm":"","pi":null,"pr":null,"p2":null,"att":97.5,"je":4.1,"jl":4.1,"rh":"","re":"SY 25-26 Decision TBD","co":0,"ct":"","cd":"","hn":"","tr":null,"ty":null},{"n":"Apollo Monroy-Polanco","a":[],"e":"amonroypolanco@gmail.com","y":["2025-2026"],"c":1,"r":"Non-cert Sub Tutor","rs":["Non-cert Sub Tutor"],"si":"Somerset","sis":["Somerset"],"di":"Somerset","dis":["Somerset"],"s":"Active","t":"incomplete","mp":null,"py":"2025-2026","am":"","em":"","lm":"","acm":"","pi":null,"pr":null,"p2":null,"att":100.0,"je":null,"jl":null,"rh":"","re":"SY 25-26 Decision TBD","co":0,"ct":"","cd":"","hn":"","tr":null,"ty":null},{"n":"Juanita Brown-Lyons","a":[],"e":"juanitabrownlyons25@gmail.com","y":["2025-2026"],"c":1,"r":"Non-cert Tutor","rs":["Non-cert Tutor"],"si":"Global Leadership Academy- West","sis":["Global Leadership Academy- West"],"di":"Global Leadership Academy","dis":["Global Leadership Academy"],"s":"Active","t":"incomplete","mp":null,"py":"2025-2026","am":"","em":"","lm":"","acm":"","pi":null,"pr":null,"p2":null,"att":82.6,"je":4.2,"jl":4.1,"rh":"","re":"SY 25-26 Decision TBD","co":0,"ct":"","cd":"","hn":"","tr":null,"ty":null},{"n":"La Shanee Davis","a":[],"e":"leonasangels2021@gmail.com","y":["2025-2026"],"c":1,"r":"Non-cert Tutor","rs":["Non-cert Tutor"],"si":"iLearn Science & Arts Charter Middle-Clifton","sis":["iLearn Science & Arts Charter Middle-Clifton"],"di":"LEA - iLearn Clifton MS","dis":["LEA - iLearn Clifton MS"],"s":"Active","t":"incomplete","mp":null,"py":"2025-2026","am":"","em":"","lm":"","acm":"","pi":null,"pr":null,"p2":null,"att":null,"je":null,"jl":null,"rh":"","re":"SY 25-26 Decision TBD","co":0,"ct":"","cd":"","hn":"","tr":null,"ty":null},{"n":"Carla Borbon","a":[],"e":"carlaborbon28@gmail.com","y":["2025-2026"],"c":1,"r":"Non-cert Tutor","rs":["Non-cert Tutor"],"si":"Middlesex County STEM Charter School","sis":["Middlesex County STEM Charter School"],"di":"Middlesex County STEM Charter School","dis":["Middlesex County STEM Charter School"],"s":"Active","t":"incomplete","mp":null,"py":"2025-2026","am":"","em":"","lm":"","acm":"","pi":null,"pr":null,"p2":null,"att":null,"je":null,"jl":null,"rh":"","re":"SY 25-26 Decision TBD","co":0,"ct":"","cd":"","hn":"","tr":null,"ty":null},{"n":"Jeanne Burns","a":[],"e":"jeanneburns13@gmail.com","y":["2025-2026"],"c":1,"r":"Non-cert Tutor","rs":["Non-cert Tutor"],"si":"iLearn Science & Arts Charter Elementary Scho","sis":["iLearn Science & Arts Charter Elementary School- Bergen"],"di":"LEA - iLearn Bergen ES","dis":["LEA - iLearn Bergen ES"],"s":"Active","t":"incomplete","mp":null,"py":"2025-2026","am":"","em":"","lm":"","acm":"","pi":null,"pr":null,"p2":null,"att":90.8,"je":4.5,"jl":4.4,"rh":"","re":"SY 25-26 Decision TBD","co":0,"ct":"","cd":"","hn":"","tr":null,"ty":null},{"n":"Susan Dominguez","a":[],"e":"domsue02@gmail.com","y":["2025-2026"],"c":1,"r":"Non-cert Tutor","rs":["Non-cert Tutor"],"si":"Penns Grove - Carneys Point Regional School D","sis":["Penns Grove - Carneys Point Regional School District"],"di":"Field Street Elementary School","dis":["Field Street Elementary School"],"s":"Active","t":"incomplete","mp":null,"py":"2025-2026","am":"","em":"","lm":"","acm":"","pi":null,"pr":null,"p2":null,"att":null,"je":null,"jl":null,"rh":"","re":"SY 25-26 Decision TBD","co":0,"ct":"Other (please describe below)","cd":"2/4/2026","hn":"On Watch","tr":null,"ty":null},{"n":"Mushana Dunham","a":[],"e":"mushdunn@gmail.com","y":["2025-2026"],"c":1,"r":"Non-cert Tutor","rs":["Non-cert Tutor"],"si":"iLearn Science & Arts Charter Middle-Clifton","sis":["iLearn Science & Arts Charter Middle-Clifton"],"di":"LEA - iLearn Clifton MS","dis":["LEA - iLearn Clifton MS"],"s":"Active","t":"incomplete","mp":null,"py":"2025-2026","am":"","em":"","lm":"","acm":"","pi":null,"pr":null,"p2":null,"att":63.5,"je":4.2,"jl":4.1,"rh":"","re":"SY 25-26 Decision TBD","co":0,"ct":"","cd":"","hn":"","tr":null,"ty":null},{"n":"Roselyn Gohagan","a":[],"e":"rozgohagan.uu@gmail.com","y":["2025-2026"],"c":1,"r":"Non-cert Tutor","rs":["Non-cert Tutor"],"si":"iLearn Science & Arts Charter Middle School- ","sis":["iLearn Science & Arts Charter Middle School- Paterson"],"di":"LEA - iLearn Paterson MS","dis":["LEA - iLearn Paterson MS"],"s":"Active","t":"incomplete","mp":null,"py":"2025-2026","am":"","em":"","lm":"","acm":"","pi":null,"pr":null,"p2":null,"att":67.9,"je":4.6,"jl":4.5,"rh":"","re":"SY 25-26 Decision TBD","co":0,"ct":"","cd":"","hn":"","tr":null,"ty":null},{"n":"Maria Gutierrez","a":[],"e":"marycarmengutierrezcolin@gmail.com","y":["2025-2026"],"c":1,"r":"Non-cert Tutor","rs":["Non-cert Tutor"],"si":"iLearn Science & Arts Charter Elementary Scho","sis":["iLearn Science & Arts Charter Elementary School-Passaic"],"di":"LEA - iLearn Passaic ES","dis":["LEA - iLearn Passaic ES"],"s":"Active","t":"incomplete","mp":null,"py":"2025-2026","am":"","em":"","lm":"","acm":"","pi":null,"pr":null,"p2":null,"att":95.1,"je":4.4,"jl":4.4,"rh":"","re":"SY 25-26 Decision TBD","co":0,"ct":"","cd":"","hn":"","tr":null,"ty":null},{"n":"Laura Guzzo","a":[],"e":"guzzolaura616@gmail.com","y":["2025-2026"],"c":1,"r":"Non-cert Tutor","rs":["Non-cert Tutor"],"si":"Penns Grove - Carneys Point Regional School D","sis":["Penns Grove - Carneys Point Regional School District"],"di":"Field Street Elementary School","dis":["Field Street Elementary School"],"s":"Active","t":"incomplete","mp":null,"py":"2025-2026","am":"","em":"","lm":"","acm":"","pi":null,"pr":null,"p2":null,"att":89.6,"je":4.9,"jl":4.7,"rh":"","re":"SY 25-26 Decision TBD","co":0,"ct":"","cd":"","hn":"","tr":null,"ty":null},{"n":"Henrika Hill-Joseph","a":[],"e":"adrianna.henrika2018@gmail.com","y":["2025-2026"],"c":1,"r":"Non-cert Tutor","rs":["Non-cert Tutor"],"si":"Hoboken Dual Language Charter School","sis":["Hoboken Dual Language Charter School"],"di":"","dis":[],"s":"Active","t":"incomplete","mp":null,"py":"","am":null,"em":null,"lm":null,"acm":null,"pi":null,"pr":null,"p2":null,"att":null,"je":null,"jl":null,"rh":null,"re":null,"co":0,"ct":null,"cd":null,"hn":null,"tr":null,"ty":null},{"n":"Miranda Marshall","a":[],"e":"agenttwilight321@gmail.com","y":["2025-2026"],"c":1,"r":"Non-cert Tutor","rs":["Non-cert Tutor"],"si":"Penns Grove - Carneys Point Regional School D","sis":["Penns Grove - Carneys Point Regional School District"],"di":"Field Street Elementary School","dis":["Field Street Elementary School"],"s":"Active","t":"incomplete","mp":null,"py":"2025-2026","am":"","em":"","lm":"","acm":"","pi":null,"pr":null,"p2":null,"att":87.3,"je":3.5,"jl":3.3,"rh":"","re":"SY 25-26 Decision TBD","co":0,"ct":"","cd":"","hn":"","tr":null,"ty":null},{"n":"Subul Sadiq","a":[],"e":"subulsadiq@gmail.com","y":["2025-2026"],"c":1,"r":"Non-cert Tutor","rs":["Non-cert Tutor"],"si":"iLearn Science & Arts Charter Elementary- Hud","sis":["iLearn Science & Arts Charter Elementary- Hudson"],"di":"LEA - iLearn Hudson ES","dis":["LEA - iLearn Hudson ES"],"s":"Active","t":"incomplete","mp":null,"py":"2025-2026","am":"","em":"","lm":"","acm":"","pi":null,"pr":null,"p2":null,"att":88.7,"je":5.0,"jl":5.0,"rh":"","re":"SY 25-26 Decision TBD","co":0,"ct":"","cd":"","hn":"","tr":null,"ty":null},{"n":"Shannon Spillane","a":[],"e":"skwerlrebellion@gmail.com","y":["2025-2026"],"c":1,"r":"Non-cert Sub Tutor","rs":["Non-cert Sub Tutor"],"si":"Hamilton Township School District","sis":["Hamilton Township School District"],"di":"","dis":[],"s":"Active","t":"incomplete","mp":null,"py":"2025-2026","am":"","em":"","lm":"","acm":"","pi":null,"pr":null,"p2":null,"att":100.0,"je":3.9,"jl":3.8,"rh":"","re":"SY 25-26 Decision TBD","co":0,"ct":"","cd":"","hn":"","tr":null,"ty":null},{"n":"TOHRN TAYLOR","a":[],"e":"tohrn.taylor@gmail.com","y":["2025-2026"],"c":1,"r":"Non-cert Tutor","rs":["Non-cert Tutor"],"si":"Penns Grove - Carneys Point Regional School D","sis":["Penns Grove - Carneys Point Regional School District"],"di":"Field Street Elementary School","dis":["Field Street Elementary School"],"s":"Active","t":"incomplete","mp":null,"py":"2025-2026","am":"","em":"","lm":"","acm":"","pi":null,"pr":null,"p2":null,"att":92.2,"je":4.4,"jl":4.2,"rh":"","re":"SY 25-26 Decision TBD","co":0,"ct":"","cd":"","hn":"","tr":null,"ty":null},{"n":"Jeffrey Wilder","a":[],"e":"charactervsrep@gmail.com","y":["2025-2026"],"c":1,"r":"Non-cert Tutor","rs":["Non-cert Tutor"],"si":"iLearn Science & Arts Charter Middle School- ","sis":["iLearn Science & Arts Charter Middle School- Paterson"],"di":"LEA - iLearn Paterson MS","dis":["LEA - iLearn Paterson MS"],"s":"Active","t":"incomplete","mp":null,"py":"2025-2026","am":"","em":"","lm":"","acm":"","pi":null,"pr":null,"p2":null,"att":55.8,"je":4.6,"jl":4.7,"rh":"","re":"SY 25-26 Decision TBD","co":0,"ct":"","cd":"","hn":"","tr":null,"ty":null},{"n":"Amro Abdelrazek","a":[],"e":"","y":["2025-2026"],"c":1,"r":"Non-cert Tutor","rs":["Non-cert Tutor"],"si":"Hoboken Dual Language Charter School","sis":["Hoboken Dual Language Charter School"],"di":"","dis":[],"s":"Active","t":"incomplete","mp":null,"py":"2025-2026","am":"","em":"","lm":"","acm":"","pi":null,"pr":null,"p2":null,"att":100.0,"je":4.2,"jl":3.7,"rh":"","re":"SY 25-26 Decision TBD","co":0,"ct":"","cd":"","hn":"","tr":null,"ty":null},{"n":"Breaunna Braxton","a":[],"e":"","y":["2025-2026"],"c":1,"r":"Non-cert Tutor","rs":["Non-cert Tutor"],"si":"Global Leadership Academy- West","sis":["Global Leadership Academy- West"],"di":"","dis":[],"s":"Active","t":"incomplete","mp":null,"py":"2025-2026","am":"","em":"","lm":"","acm":"","pi":null,"pr":null,"p2":null,"att":62.5,"je":5.0,"jl":5.0,"rh":"","re":"SY 25-26 Decision TBD","co":0,"ct":"","cd":"","hn":"","tr":null,"ty":null},{"n":"Brittany Douglas","a":[],"e":"","y":["2025-2026"],"c":1,"r":"Dual Role","rs":["Dual Role"],"si":"iLearn Science & Arts Charter Elementary Scho","sis":["iLearn Science & Arts Charter Elementary School-Hudson"],"di":"","dis":[],"s":"Active","t":"incomplete","mp":null,"py":"2025-2026","am":"","em":"","lm":"","acm":"","pi":null,"pr":null,"p2":null,"att":null,"je":null,"jl":null,"rh":"","re":"SY 25-26 Decision TBD","co":0,"ct":"","cd":"","hn":"","tr":null,"ty":null},{"n":"Daivon Devard","a":[],"e":"","y":["2025-2026"],"c":1,"r":"Non-cert Tutor","rs":["Non-cert Tutor"],"si":"Global Leadership Academy- West","sis":["Global Leadership Academy- West"],"di":"","dis":[],"s":"Active","t":"incomplete","mp":null,"py":"2025-2026","am":"","em":"","lm":"","acm":"","pi":null,"pr":null,"p2":null,"att":71.4,"je":null,"jl":null,"rh":"","re":"SY 25-26 Decision TBD","co":0,"ct":"","cd":"","hn":"","tr":null,"ty":null},{"n":"Jaejin Lee","a":[],"e":"","y":["2025-2026"],"c":1,"r":"Non-cert Tutor","rs":["Non-cert Tutor"],"si":"The Philadelphia Charter School For Arts & Sc","sis":["The Philadelphia Charter School For Arts & Sciences"],"di":"","dis":[],"s":"Active","t":"incomplete","mp":null,"py":"2025-2026","am":"","em":"","lm":"","acm":"","pi":null,"pr":null,"p2":null,"att":100.0,"je":3.2,"jl":3.0,"rh":"","re":"SY 25-26 Decision TBD","co":0,"ct":"","cd":"","hn":"","tr":null,"ty":null},{"n":"Jenny Seligman","a":[],"e":"","y":["2025-2026"],"c":1,"r":"Non-cert Tutor","rs":["Non-cert Tutor"],"si":"American Paradigm","sis":["American Paradigm"],"di":"","dis":[],"s":"Active","t":"incomplete","mp":null,"py":"2025-2026","am":"","em":"","lm":"","acm":"","pi":null,"pr":null,"p2":null,"att":77.8,"je":4.4,"jl":3.8,"rh":"","re":"SY 25-26 Decision TBD","co":0,"ct":"Additional Coaching Support","cd":"2/18/2026","hn":"On Watch","tr":null,"ty":null},{"n":"Lataiva Balmer","a":[],"e":"","y":["2025-2026"],"c":1,"r":"Non-cert Tutor","rs":["Non-cert Tutor"],"si":"iLearn Science & Arts Charter Elementary Scho","sis":["iLearn Science & Arts Charter Elementary School-Passaic"],"di":"LEA - iLearn Passaic ES","dis":["LEA - iLearn Passaic ES"],"s":"Active","t":"incomplete","mp":null,"py":"2025-2026","am":"","em":"","lm":"","acm":"","pi":null,"pr":null,"p2":null,"att":100.0,"je":5.0,"jl":4.9,"rh":"","re":"SY 25-26 Decision TBD","co":0,"ct":"","cd":"","hn":"","tr":null,"ty":null},{"n":"Lemuer Pérez De Jesus","a":[],"e":"","y":["2025-2026"],"c":1,"r":"Dual Role","rs":["Dual Role"],"si":"iLearn Science & Arts Charter Elementary Scho","sis":["iLearn Science & Arts Charter Elementary School-Passaic"],"di":"","dis":[],"s":"Active","t":"incomplete","mp":null,"py":"","am":null,"em":null,"lm":null,"acm":null,"pi":null,"pr":null,"p2":null,"att":null,"je":null,"jl":null,"rh":null,"re":null,"co":0,"ct":null,"cd":null,"hn":null,"tr":"No","ty":"2025-2026"},{"n":"SHARMINA ELLIS","a":[],"e":"","y":["2025-2026"],"c":1,"r":"Dual Role","rs":["Dual Role"],"si":"Penns Grove - Carneys Point Regional School D","sis":["Penns Grove - Carneys Point Regional School District"],"di":"Penns Grove School District","dis":["Penns Grove School District"],"s":"Active","t":"incomplete","mp":null,"py":"2025-2026","am":"","em":"","lm":"","acm":"","pi":null,"pr":null,"p2":null,"att":null,"je":null,"jl":null,"rh":"","re":"SY 25-26 Decision TBD","co":0,"ct":"Observation by PM Team","cd":"2/2/2026","hn":"On Watch","tr":null,"ty":null},{"n":"Jazmin Garcia","a":[],"e":"","y":["2025-2026"],"c":1,"r":"Non-cert Tutor","rs":["Non-cert Tutor"],"si":"iLearn Science & Arts Charter Elementary Scho","sis":["iLearn Science & Arts Charter Elementary School- Bergen"],"di":"LEA - iLearn Bergen ES","dis":["LEA - iLearn Bergen ES"],"s":"Active","t":"incomplete","mp":null,"py":"2025-2026","am":"","em":"","lm":"","acm":"","pi":null,"pr":null,"p2":null,"att":null,"je":null,"jl":null,"rh":"","re":"SY 25-26 Decision TBD","co":0,"ct":"","cd":"","hn":"","tr":null,"ty":null},{"n":"Benjamin Apell","a":[],"e":"","y":["2025-2026"],"c":1,"r":"Non-cert Tutor","rs":["Non-cert Tutor"],"si":"The Philadelphia Charter School For Arts & Sc","sis":["The Philadelphia Charter School For Arts & Sciences"],"di":"","dis":[],"s":"Active","t":"incomplete","mp":null,"py":"2025-2026","am":"","em":"","lm":"","acm":"","pi":null,"pr":null,"p2":null,"att":null,"je":null,"jl":null,"rh":"","re":"SY 25-26 Decision TBD","co":0,"ct":"","cd":"","hn":"","tr":null,"ty":null},{"n":"Sophia Petronglo","a":[],"e":"","y":["2025-2026"],"c":1,"r":"Non-cert Sub Tutor","rs":["Non-cert Sub Tutor"],"si":"All Locations","sis":["All Locations"],"di":"","dis":[],"s":"Active","t":"incomplete","mp":null,"py":"2025-2026","am":"","em":"","lm":"","acm":"","pi":null,"pr":null,"p2":null,"att":95.8,"je":4.4,"jl":3.8,"rh":"","re":"SY 25-26 Decision TBD","co":0,"ct":"","cd":"","hn":"","tr":null,"ty":null},{"n":"Shayla Hibbert","a":[],"e":"","y":["2025-2026"],"c":1,"r":"Non-cert Tutor","rs":["Non-cert Tutor"],"si":"Hoboken Dual Language Charter School","sis":["Hoboken Dual Language Charter School"],"di":"","dis":[],"s":"Active","t":"incomplete","mp":null,"py":"2025-2026","am":"","em":"","lm":"","acm":"","pi":null,"pr":null,"p2":null,"att":null,"je":null,"jl":null,"rh":"","re":"SY 25-26 Decision TBD","co":0,"ct":"","cd":"","hn":"","tr":null,"ty":null},{"n":"Adetomiwa Abayomi Opeolu","a":[],"e":"","y":["2025-2026"],"c":1,"r":"Non-cert Sub Tutor","rs":["Non-cert Sub Tutor"],"si":"All Locations","sis":["All Locations"],"di":"","dis":[],"s":"Active","t":"incomplete","mp":null,"py":"2025-2026","am":"","em":"","lm":"","acm":"","pi":null,"pr":null,"p2":null,"att":null,"je":null,"jl":null,"rh":"","re":"SY 25-26 Decision TBD","co":0,"ct":"","cd":"","hn":"","tr":null,"ty":null},{"n":"Monifa Thomas-Kelsey","a":[],"e":"","y":["2025-2026"],"c":1,"r":"Dual Role","rs":["Dual Role"],"si":"The Philadelphia Charter School For Arts & Sc","sis":["The Philadelphia Charter School For Arts & Sciences"],"di":"","dis":[],"s":"Active","t":"incomplete","mp":null,"py":"2025-2026","am":"","em":"","lm":"","acm":"","pi":null,"pr":null,"p2":null,"att":null,"je":null,"jl":null,"rh":"","re":"SY 25-26 Decision TBD","co":0,"ct":"","cd":"","hn":"","tr":null,"ty":null},{"n":"Loan Nguyen","a":[],"e":"","y":["2025-2026"],"c":1,"r":"Non-cert Sub Tutor","rs":["Non-cert Sub Tutor"],"si":"All Locations","sis":["All Locations"],"di":"","dis":[],"s":"Active","t":"incomplete","mp":null,"py":"2025-2026","am":"","em":"","lm":"","acm":"","pi":null,"pr":null,"p2":null,"att":null,"je":null,"jl":null,"rh":"","re":"SY 25-26 Decision TBD","co":0,"ct":"","cd":"","hn":"","tr":null,"ty":null},{"n":"Leila Einhorn","a":[],"e":"","y":["2025-2026"],"c":1,"r":"Non-cert Tutor","rs":["Non-cert Tutor"],"si":"The Philadelphia Charter School For Arts & Sc","sis":["The Philadelphia Charter School For Arts & Sciences"],"di":"","dis":[],"s":"Active","t":"incomplete","mp":null,"py":"2025-2026","am":"","em":"","lm":"","acm":"","pi":null,"pr":null,"p2":null,"att":null,"je":null,"jl":null,"rh":"","re":"SY 25-26 Decision TBD","co":0,"ct":"","cd":"","hn":"","tr":null,"ty":null},{"n":"Linda Fenty","a":[],"e":"","y":["2025-2026"],"c":1,"r":"Non-cert Tutor","rs":["Non-cert Tutor"],"si":"iLearn Science & Arts Charter Elementary Scho","sis":["iLearn Science & Arts Charter Elementary School-Paterson"],"di":"LEA - iLearn Paterson ES","dis":["LEA - iLearn Paterson ES"],"s":"Active","t":"incomplete","mp":null,"py":"2025-2026","am":"","em":"","lm":"","acm":"","pi":null,"pr":null,"p2":null,"att":null,"je":null,"jl":null,"rh":"","re":"SY 25-26 Decision TBD","co":0,"ct":"","cd":"","hn":"","tr":null,"ty":null},{"n":"Janice Reaves","a":[],"e":"","y":["2025-2026"],"c":1,"r":"Non-cert Tutor","rs":["Non-cert Tutor"],"si":"PCSST","sis":["PCSST"],"di":"","dis":[],"s":"Active","t":"incomplete","mp":null,"py":"2025-2026","am":"","em":"","lm":"","acm":"","pi":null,"pr":null,"p2":null,"att":null,"je":null,"jl":null,"rh":"","re":"SY 25-26 Decision TBD","co":0,"ct":"","cd":"","hn":"","tr":null,"ty":null},{"n":"Whitney Davis","a":[],"e":"","y":["2025-2026"],"c":1,"r":"Non-cert Tutor","rs":["Non-cert Tutor"],"si":"PCSST","sis":["PCSST"],"di":"","dis":[],"s":"Active","t":"incomplete","mp":null,"py":"2025-2026","am":"","em":"","lm":"","acm":"","pi":null,"pr":null,"p2":null,"att":null,"je":null,"jl":null,"rh":"","re":"SY 25-26 Decision TBD","co":0,"ct":"","cd":"","hn":"","tr":null,"ty":null},{"n":"Rabia Nawaz","a":[],"e":"","y":["2025-2026"],"c":1,"r":"Instructional Coach/ Site Coordinator Dual","rs":["Instructional Coach/ Site Coordinator Dual"],"si":"Middlesex County STEM Charter School","sis":["Middlesex County STEM Charter School"],"di":"","dis":[],"s":"Active","t":"incomplete","mp":null,"py":"2025-2026","am":"","em":"","lm":"","acm":"","pi":null,"pr":null,"p2":null,"att":null,"je":null,"jl":null,"rh":"","re":"SY 25-26 Decision TBD","co":0,"ct":"","cd":"","hn":"","tr":null,"ty":null},{"n":"MAUREEN Farrell","a":[],"e":"","y":["2025-2026"],"c":1,"r":"Instructional Coach/ Site Coordinator Dual","rs":["Instructional Coach/ Site Coordinator Dual"],"si":"Hoboken Dual Language Charter School","sis":["Hoboken Dual Language Charter School"],"di":"","dis":[],"s":"Active","t":"incomplete","mp":null,"py":"2025-2026","am":"","em":"","lm":"","acm":"","pi":null,"pr":null,"p2":null,"att":null,"je":null,"jl":null,"rh":"","re":"SY 25-26 Decision TBD","co":0,"ct":"","cd":"","hn":"","tr":null,"ty":null},{"n":"Karen Schiavi","a":[],"e":"","y":["2025-2026"],"c":1,"r":"Non-cert Sub Tutor","rs":["Non-cert Sub Tutor"],"si":"All Locations","sis":["All Locations"],"di":"All Locations","dis":["All Locations"],"s":"Active","t":"incomplete","mp":null,"py":"2025-2026","am":"","em":"","lm":"","acm":"","pi":null,"pr":null,"p2":null,"att":null,"je":null,"jl":null,"rh":"","re":"SY 25-26 Decision TBD","co":0,"ct":"","cd":"","hn":"","tr":null,"ty":null},{"n":"Vincent Duong","a":[],"e":"","y":["2025-2026"],"c":1,"r":"Non-cert Tutor","rs":["Non-cert Tutor"],"si":"Penns Grove School District","sis":["Penns Grove School District"],"di":"Field Street Elementary School","dis":["Field Street Elementary School"],"s":"Active","t":"incomplete","mp":null,"py":"2025-2026","am":"","em":"","lm":"","acm":"","pi":null,"pr":null,"p2":null,"att":null,"je":null,"jl":null,"rh":"","re":"SY 25-26 Decision TBD","co":0,"ct":"","cd":"","hn":"","tr":null,"ty":null},{"n":"Rene Lintz","a":[],"e":"","y":["2025-2026"],"c":1,"r":"Program Assistant","rs":["Program Assistant"],"si":"Central Team","sis":["Central Team"],"di":"NJTC Central","dis":["NJTC Central"],"s":"Active","t":"incomplete","mp":null,"py":"2025-2026","am":null,"em":null,"lm":null,"acm":null,"pi":null,"pr":null,"p2":null,"att":null,"je":null,"jl":null,"rh":"N/A","re":"Central Team Staff","co":0,"ct":"","cd":"","hn":"","tr":null,"ty":null,"_race":"","_ethnicity":""},{"n":"Ashley Petty","a":[],"e":"","y":["2025-2026"],"c":1,"r":"Central Team Staff","rs":["Central Team Staff"],"si":"Central Team","sis":["Central Team"],"di":"NJTC Central","dis":["NJTC Central"],"s":"Active","t":"incomplete","mp":null,"py":"2025-2026","am":null,"em":null,"lm":null,"acm":null,"pi":null,"pr":null,"p2":null,"att":null,"je":null,"jl":null,"rh":"N/A","re":"Central Team Staff","co":0,"ct":"","cd":"","hn":"","tr":null,"ty":null,"_race":"","_ethnicity":""},{"n":"Tierney Tittermary","a":[],"e":"","y":["2025-2026"],"c":1,"r":"Assistant Program Manager","rs":["Assistant Program Manager"],"si":"Central Team","sis":["Central Team"],"di":"NJTC Central","dis":["NJTC Central"],"s":"Active","t":"incomplete","mp":null,"py":"2025-2026","am":null,"em":null,"lm":null,"acm":null,"pi":null,"pr":null,"p2":null,"att":null,"je":null,"jl":null,"rh":"N/A","re":"Central Team Staff","co":0,"ct":"","cd":"","hn":"","tr":null,"ty":null,"_race":"","_ethnicity":""},{"n":"Jessica Kelly","a":[],"e":"","y":["2025-2026"],"c":1,"r":"Executive Director / Programs","rs":["Executive Director / Programs"],"si":"Central Team","sis":["Central Team"],"di":"NJTC Central","dis":["NJTC Central"],"s":"Terminated","t":"incomplete","mp":null,"py":"2025-2026","am":null,"em":null,"lm":null,"acm":null,"pi":null,"pr":null,"p2":null,"att":null,"je":null,"jl":null,"rh":"N/A","re":"Central Team Staff \u2014 Retired March 5, 2026","co":0,"ct":"Retired","cd":"March 5, 2026","hn":"Retired end of SY 25-26","tr":null,"ty":null,"_race":"","_ethnicity":""},{"n":"Scott Oswald","a":[],"e":"","y":["2025-2026"],"c":1,"r":"Executive Director / Programs","rs":["Executive Director / Programs"],"si":"Central Team","sis":["Central Team"],"di":"NJTC Central","dis":["NJTC Central"],"s":"Active","t":"incomplete","mp":null,"py":"2025-2026","am":null,"em":null,"lm":null,"acm":null,"pi":null,"pr":null,"p2":null,"att":null,"je":null,"jl":null,"rh":"N/A","re":"Central Team Staff","co":0,"ct":"","cd":"","hn":"","tr":null,"ty":null,"_race":"","_ethnicity":""}];
  // Snapshot length — used to restore HR_EMPS to clean base before each overlay pass
  const _HR_BASE_LEN = HR_EMPS.length;

  const TALENT_CSV_GIDS = ['274671201'];
  const TALENT_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQvtHFBuZ4GqbRooDaRlxIIq1mqzYyvTGyMaJkRd3eCMniaSY8EZh3p1-g1av2Mi-R0zp8BdFmc_ZMy/pub?output=csv';

  // Parse a full CSV text that may contain quoted multiline fields.
  // Returns an array of string-arrays (rows → columns).
  function _parseCSVFull(text) {
    const rows = [];
    let row = [], cur = '', inQ = false;
    // Normalize line endings
    const s = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    for (let i = 0; i < s.length; i++) {
      const c = s[i];
      if (inQ) {
        if (c === '"') {
          if (s[i+1] === '"') { cur += '"'; i++; } // escaped quote
          else inQ = false;
        } else {
          cur += c; // include newlines inside quotes — this is the key fix
        }
      } else {
        if (c === '"') { inQ = true; }
        else if (c === ',') { row.push(cur); cur = ''; }
        else if (c === '\n') { row.push(cur); rows.push(row); row = []; cur = ''; }
        else { cur += c; }
      }
    }
    if (cur || row.length) { row.push(cur); rows.push(row); }
    return rows;
  }

  function _parseConcernsCSV(text) {
    const rows = _parseCSVFull(text);
    // Find header row (contains 'Timestamp') — skip any metadata rows at top
    let hRow = -1;
    for (let i = 0; i < Math.min(5, rows.length); i++) {
      if ((rows[i][0]||'').toLowerCase().includes('timestamp')) { hRow = i; break; }
    }
    if (hRow < 0) return [];

    const fresh = [];
    const TS_RE = /^\d{1,2}\/\d{1,2}\/\d{4}\s+\d{1,2}:\d{2}:\d{2}$/;
    for (let i = hRow + 1; i < rows.length; i++) {
      const cols = rows[i];
      const tsRaw = (cols[0]||'').trim().replace(/"/g,'');
      // Strict timestamp validation — must match M/D/YYYY H:MM:SS exactly
      if (!TS_RE.test(tsRaw)) continue;
      const dt = new Date(tsRaw);
      if (isNaN(dt.getTime()) || dt.getFullYear() < 2020) continue;
      const emp = (cols[5]||'').trim();
      if (!emp) continue; // every real row has an employee name
      const cType  = (cols[13]||'').trim();
      const cOther = (cols[14]||'').trim();
      fresh.push({
        ts:           tsRaw,
        month:        dt.toLocaleString('en-US',{month:'short',year:'numeric'}),
        yr:           dt.getFullYear(),
        mo:           dt.getMonth()+1,
        submitter:    (cols[2] ||'').trim(),
        emp:          emp,
        role:         (cols[6] ||'').trim(),
        support_type: (cols[9] ||'').trim(),
        delivery:     (cols[11]||'').trim(),
        site:         normDistrict(cols[12]),
        concern_type: cType,
        concern_label:(cType==='Other (please explain below)'&&cOther) ? cOther : cType,
        concern_detail:(cols[16]||'').trim(),
        hr_action:    (()=>{ let hr_action = (cols[17]||'').trim(); if (hr_action === 'Yes') hr_action = 'On Watch'; if (hr_action === 'No') hr_action = 'No Action'; return hr_action; })(),
        first_time:   (cols[19]||'').trim(),
      });
    }
    return fresh;
  }

  async function fetchLiveConcerns() {
    // ── stale-while-revalidate: show cached data instantly ────────────
    const _forceRefresh = typeof _talentForceRefresh !== 'undefined' && _talentForceRefresh;
    if (!_forceRefresh) {
      const _tc = NJTC_CACHE.get('njtc_talent_v1');
      if (_tc && _tc.data && _tc.data.length) {
        CONCERNS = _tc.data; window.CONCERNS = CONCERNS;
        _talentLiveStatus = 'live';
        if (_tc.fresh) return;  // cache fresh — skip network
        // stale: fall through to background re-fetch
      }
    }
    const cacheBust = _forceRefresh ? '&t=' + Date.now() : '';
    const url = TALENT_CSV_URL + '&gid=' + TALENT_CSV_GIDS[0] + cacheBust;
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
      if (res.ok) {
        const text = await res.text();
        const fresh = _parseConcernsCSV(text);
        if (fresh.length > 0) {
          CONCERNS = fresh; window.CONCERNS = CONCERNS;
          _talentLiveStatus = 'live';
          NJTC_CACHE.set('njtc_talent_v1', fresh);
          console.log('[Talent] Live data loaded: ' + fresh.length + ' records');
          if (typeof _hrInvalidateOverlay === 'function') _hrInvalidateOverlay();
          return;
        }
      }
    } catch(e) {
      console.warn('[Talent] Fetch failed:', e.message);
    }
    _talentLiveStatus = 'fallback';
    console.warn('[Talent] Using built-in seed data: ' + CONCERNS.length + ' records');
  }

  function countBy(arr, key) {
    const map = {};
    arr.forEach(r => { const v=r[key]||'Unknown'; map[v]=(map[v]||0)+1; });
    return Object.entries(map).sort((a,b)=>b[1]-a[1]);
  }
  function groupBy(arr, key) {
    const map = {};
    arr.forEach(r => { const v=r[key]||'Unknown'; if(!map[v]) map[v]=[]; map[v].push(r); });
    return map;
  }
  function barRows(entries, maxVal, color) {
    return (entries||[]).map(([label,cnt]) =>
      `<div class="ta-bar-row">
        <div class="ta-bar-label" title="${label}">${label.length>32?label.slice(0,30)+'…':label}</div>
        <div class="ta-bar-track"><div class="ta-bar-fill" style="width:${Math.round(cnt/(maxVal||1)*100)}%;background:${color}"></div></div>
        <div class="ta-bar-count">${cnt}</div>
      </div>`).join('');
  }
  function hrActionClass(action) {
    if (!action) return 'concern-no';
    const a = action.toLowerCase();
    if (a.includes('terminat')) return 'concern-term';
    if (a==='pgp') return 'concern-pgp';
    if (a.includes('write up')||a.includes('progress')) return 'concern-writeup';
    if (a==='on watch') return 'concern-watch';
    if (a==='yes') return 'concern-warn';
    return 'concern-no';
  }
  function computeWarnings(data) {
    const total=data.length; if (!total) return [];
    const w=[];
    const iL=data.filter(r=>r.site==='iLearn Charter Schools').length;
    if (iL/total>0.45) w.push({icon:'🏢',level:'high',title:`iLearn Concentration Risk: ${iL}/${total} (${Math.round(iL/total*100)}%)`,body:'If this partnership is impacted, retention and partner satisfaction KPIs will be significantly affected.'});
    const ec={};data.forEach(r=>{if(r.emp)ec[r.emp]=(ec[r.emp]||0)+1;});
    const r3=Object.entries(ec).filter(([e,c])=>c>=3);
    if (r3.length) w.push({icon:'👤',level:'medium',title:`${r3.length} employee${r3.length>1?'s':''} with 3+ concerns`,body:r3.sort((a,b)=>b[1]-a[1]).slice(0,3).map(([e,c])=>e+' ('+c+')').join(', ')});
    const esc=data.filter(r=>r.hr_action&&(r.hr_action.includes('Write Up')||r.hr_action==='PGP'||r.hr_action.includes('Terminat'))).length;
    if (esc>2) w.push({icon:'⚠️',level:'high',title:`${esc} formal HR actions active`,body:'Each write-up or PGP requires documented HR file and follow-up per policy.'});
    const lp=data.filter(r=>r.concern_type==='Lesson Plans').length;
    if (lp/total>0.25) w.push({icon:'📋',level:'medium',title:`Lesson plan compliance: ${lp} concerns (${Math.round(lp/total*100)}%)`,body:'Systemic pattern. Consider T&D refresher or streamlined submission process.'});
    return w;
  }
  function setTalentYear(yr, btn) {
    document.querySelectorAll('#talentYearBar .pst-tab').forEach(b=>b.classList.remove('active'));
    if (btn) btn.classList.add('active');
    _talentYear_selected = yr;
    const countEl=document.getElementById('tyrCount');
    if (countEl) countEl.textContent = yr!=='all' ? CONCERNS.filter(c=>c.yr===Number(yr)).length+' records' : '';
    applyTalentFilters();
  }
  function setTalentTab(tab) {
    document.querySelectorAll('[id^="talentTab-"]').forEach(b=>b.classList.remove('active'));
    const _btn=document.getElementById('talentTab-'+tab);
    if (_btn) _btn.classList.add('active');
    const _fb=document.getElementById('talentFilterBar');
    const _yb=document.getElementById('talentYearBar');
    if (_fb) _fb.style.display = tab!=='profiles' ? '' : 'none';
    if (_yb) _yb.style.display = tab!=='profiles' ? '' : 'none';
    if (tab==='profiles') {
      _talentTab = 'profiles';  // ← lock state so buildTalentContent() won't overwrite
      const _el=document.getElementById('talentContent');
      const _dp=(window.NJTC_SESSION||{}).dept||'hr';
      if (_el) {
        // Skip DOM rebuild if already rendered at current overlay version (prevents double-render)
        const _root = document.getElementById('hrProfilesRoot');
        const _renderedVer = _root && _root.dataset.overlayVersion;
        const _curVer = (typeof _hrOverlayVersion !== 'undefined') ? String(_hrOverlayVersion) : '0';
        if (_root && _renderedVer === _curVer) {
          return;  // Already current — no work needed
        }
        try {
          const _html = window._hrBuildProfiles(_dp);
          _el.innerHTML = '<div id="hrProfilesRoot" data-overlay-version="' + _curVer + '">' + _html + '</div>';
        } catch(_err) {
          console.error('[HR Profiles] Render error:', _err);
          _el.innerHTML = '<div style="padding:2rem;color:#b91c1c">Profile render error: '+_err.message+'</div>';
        }
      }
      return;
    }
    _talentTab=tab; buildTalentContent();
  }
  // ── Programming Dept — Site Leader Reviews Tab ───────────────────────────

  function initTalentFilters() {
    // Populate dropdowns from real CONCERNS data
    const dSel = document.getElementById('tf_district');
    if (dSel && dSel.options.length <= 1) {
      ["Central Jersey College Prep", "First Philadelphia Prep", "Global Leadership Academy", "Gloucester Township SD", "Haddon Township SD", "Hamilton Township SD", "Hoboken / HOLA Charter", "Lawrence Township SD", "Paterson Charter Sci & Tech", "Penns Grove - Carneys Point SD", "Salem City SD", "iLearn Charter Schools"].forEach(d => {
        const o = document.createElement('option'); o.value = o.textContent = d; dSel.appendChild(o);
      });
    }
    const mSel = document.getElementById('tf_month');
    if (mSel && mSel.options.length <= 1) {
      ["Mar 2025", "Apr 2025", "May 2025", "Jun 2025", "Jul 2025", "Aug 2025", "Sep 2025", "Oct 2025", "Nov 2025", "Dec 2025", "Jan 2026", "Feb 2026"].forEach(m => {
        const o = document.createElement('option'); o.value = o.textContent = m; mSel.appendChild(o);
      });
    }
    const sSel = document.getElementById('tf_submitter');
    if (sSel && sSel.options.length <= 1) {
      ["Andrea Brooks", "Andrea Brooks, PM", "Andrea Brooks- PM", "Andrea Brooks- Program Manager", "Andrea Brooks/PM", "Anne Lee", "Bertin Lefkovic", "Briana Nurse", "Chelsea Ostrowski", "Colleen Elam", "Colleen Elam (Instructional Coach/Site Leader)", "Danielle Hallahan", "Dr. Clemons", "Dr. Clemons- Program Manager", "Dr. Clemons-Program Manager", "Dr. T. Clemons / Program Manager", "Dr. Taneisha Clemons- Program Manager", "Faye Lewis Instructional Coach/Site Coordinator", "JLC", "Jenny Irwin, APM", "Jenny Irwin, Asst. Program Manager", "Jenny Irwin, Asst. Program Mgr", "Jessica Kelly, Exec Dir Programs", "Katharine Samberg-Lawrence", "Lakeeda Sessoms", "Lakeeda Sessoms (Site Leader/ Instructional Coach)", "Lakeeda Sessoms (Site Leader/Instructional Coach)", "Marta Reyes SC/IC", "Marta Reyes, IC/SC", "Marta Reyes-IC/SC", "Ms. Sessoms (Site Leader/Instructional Coach)", "Rene Lintz", "Rene Lintz, Program Assistant", "Rene Lintz Program Assistant", "Scott Oswald", "Sharlene Rahim", "Sharmina Ellis-SC/IC", "T Clemons Program Manager", "T. Clemons-Program Manager", "T. Clemons/Program Manager", "T.Clemons", "Taneisha Clemons", "Taneisha Clemons- Program Manager", "Tanya Israel-Sainthilaire", "Tierney Tittermary", "Tierney Tittermary (Assistant Program Manager)", "Tierney Tittermary/ APM", "Tierney Tittermary/APM"].forEach(s => {
        const o = document.createElement('option'); o.value = o.textContent = s; sSel.appendChild(o);
      });
    }
    // Employee filter — add dynamically if not present
    const fb = document.getElementById('talentFilterBar');
    if (fb && !document.getElementById('tf_employee')) {
      const empSel = document.createElement('select');
      empSel.id = 'tf_employee'; empSel.className = 'filter-select';
      empSel.style.cssText = 'flex:1;min-width:140px';
      empSel.onchange = applyTalentFilters;
      const allOpt = document.createElement('option'); allOpt.value = ''; allOpt.textContent = 'All Employees';
      empSel.appendChild(allOpt);
      ["Alexandra Cristescu", "Angelica Werts", "Brandon (Bergen Middle Tutor)", "Breaunna Braxton", "Bryanna Matos", "Carlos Jacho", "Claudia Barbieri", "Coleen Piontkowskie", "Disan Singleton", "Durel Freeman", "Dylan Aiken", "Dylan Sepulveda", "Eliza Kabashi", "Erica Mela", "Evan White", "Fasiha Shaikh", "Genesis Troya", "Huda Deweat", "James DeJesus", "Jeff Wilder", "Jenny Seligman", "Juanita Brown-Lyons", "Katharine Samberg-Lawrence", "Katie Hennigan", "Kimara Ramsey", "Laura Gallucci", "Marissa Onesi", "Maryann Ficker", "Mattelyn Bullock", "Micaela Wilkerson", "Michelle Kim", "Naima Boutria", "Nicholas Antoine", "Nicole Cill", "Norelis Ramirez", "Pooja Tyagi", "Queen Beaute", "Robert Whitman", "Sara Gonzalez", "Shabnam Mustari", "Shanice Jackman", "Sharlene Rahim", "Sharmina Ellis", "Sharon Kessel", "Sharon Kessle", "Susan Dominguez", "Tabitha Parris", "Takiyah Jackson", "Ted Mills", "Timothy Winn", "Trushti Shah", "Victoria Nachimson", "Zahnick Underdue", "Zahnik Underdue"].forEach(e => {
        const o = document.createElement('option'); o.value = o.textContent = e; empSel.appendChild(o);
      });
      const cb = fb.querySelector('button'); if (cb) fb.insertBefore(empSel, cb);
    }
    applyTalentFilters();
  }
    // District → site lookup for group-based filtering
  const _DISTRICT_GROUPS = {"Central Jersey College Prep": ["Central Jersey College Prep"], "First Philadelphia Prep": ["First Philadelphia Prep Charter School (American Paradigm)"], "Global Leadership Academy": ["Global Leadership Academy - GLA- West"], "Gloucester Township SD": ["Gloucester Township School District- Erial Elementary School", "Gloucester Township School District- Loring Flemming Elementary School"], "Haddon Township SD": ["Haddon Township School District-Strawbridge Elementary School", "Haddon Township School District-Van Sciver Elementary School"], "Hamilton Township SD": ["Hamilton Township School District- Kuser Elementary School", "Hamilton Township School District- Mercerville Elementary School"], "Hoboken / HOLA Charter": ["Hoboken Dual Language Charter School (HOLA) - ES"], "Lawrence Township SD": ["Lawrence Township- Slackwood Elementary"], "Paterson Charter Sci & Tech": ["Paterson Charter School Science & Tech.- PCSST 4-7 Campus"], "Penns Grove - Carneys Point SD": ["Penns Grove - Carneys Point Regional School District- Penns Grove Middle School", "Penns Grove - Field Street Elementary"], "Salem City SD": ["Salem City School District- Salem - John Fenwick Academy (K-2)", "Salem City School District- Salem Middle School (3-5)"], "iLearn Charter Schools": ["iLearn Charter School- Bergen ES", "iLearn Charter School- Bergen MS", "iLearn Charter School- Clifton ES", "iLearn Charter School- Clifton MS", "iLearn Charter School- Hudson MS", "iLearn Charter School- Passaic ES", "iLearn Charter School- Passaic MS", "iLearn Charter School- Paterson ES", "iLearn Charter School- Paterson MS"]};

  function applyTalentFilters() {
    const g = id => document.getElementById(id)?.value || '';
    const district  = g('tf_district');
    const role      = g('tf_role');
    const concern   = g('tf_concern');
    const month     = g('tf_month');
    const hr        = g('tf_hr');
    const submitter = g('tf_submitter');
    const employee  = g('tf_employee');
    const yr        = _talentYear_selected;

    // District group → array of exact site names
    const distSites = district ? (_DISTRICT_GROUPS[district] || []) : null;

    _filteredConcerns = CONCERNS.filter(c =>
      (!distSites   || distSites.includes(c.site)) &&
      (!role        || c.role === role) &&
      (!concern     || c.concern_type === concern) &&
      (!month       || c.month === month) &&
      (!hr          || c.hr_action === hr) &&
      (!submitter   || c.submitter === submitter) &&
      (!employee    || c.emp === employee) &&
      (yr === 'all' || yr === null || c.yr === Number(yr))
    );
    window._filteredConcerns = _filteredConcerns; // keep window ref in sync for hr-department.js

    const hasF = !![district, role, concern, month, hr, submitter, employee].find(v => v) || (yr !== 'all' && yr !== null);
    const countEl = document.getElementById('tf_count');
    if (countEl) {
      countEl.textContent = hasF
        ? `${_filteredConcerns.length} of ${CONCERNS.length} records`
        : `${CONCERNS.length} records`;
      countEl.style.color = hasF && _filteredConcerns.length < CONCERNS.length ? '#e76f51' : 'var(--muted)';
    }
    buildTalentContent();
  }
  
  function clearTalentFilters() {
    ['tf_district','tf_role','tf_concern','tf_month','tf_hr','tf_submitter','tf_employee'].forEach(id => {
      const el = document.getElementById(id); if (el) el.value = '';
    });
    _talentYear_selected = 'all';
    document.querySelectorAll('#talentYearBar .pst-tab').forEach(b => b.classList.remove('active'));
    const ab = document.getElementById('tyrBtn-all'); if (ab) ab.classList.add('active');
    applyTalentFilters();
  }

  // ══════════════════════════════════════════════════════════════════
  const ADMIN_DEPTS = ['leadership', 'data', 'kb'];

  function initPolicyAdmin() {
    const bar = document.getElementById('policyAdminBar');
    if (!bar) return;
    const isAdmin = ADMIN_DEPTS.includes(_currentDept) || _currentDept === 'leadership' || _currentDept === 'data';
    if (isAdmin) {
      bar.style.display = 'flex';
      document.getElementById('liveDocToggle').checked = _liveDocEnabled;
      document.getElementById('liveDocLabel').textContent = _liveDocEnabled ? 'ON' : 'OFF';
      document.getElementById('liveDocLabel').style.color = _liveDocEnabled ? '#f0a500' : '#6b7280';
      renderPdfUploadList();
    }
  }

  function toggleLiveDoc(enabled) {
    _liveDocEnabled = enabled;
    localStorage.setItem('njtc_live_doc', enabled ? 'true' : 'false');
    document.getElementById('liveDocLabel').textContent = enabled ? 'ON' : 'OFF';
    document.getElementById('liveDocLabel').style.color = enabled ? '#f0a500' : '#6b7280';
    logChange('toggle', enabled ? 'Live document sync ENABLED' : 'Live document sync DISABLED', getDeptLabel(), 'Policies library');
    buildPolicies(true);
  }

  function handlePdfUpload(files) {
    if (!files || !files.length) return;
    Array.from(files).forEach(file => {
      if (!file.name.endsWith('.pdf')) return;
      const reader = new FileReader();
      reader.onload = (e) => {
        const entry = {
          id: 'pdf_' + Date.now() + '_' + Math.random().toString(36).slice(2),
          name: file.name.replace('.pdf',''),
          filename: file.name,
          dept: _currentDept || 'shared',
          size: file.size,
          dataUrl: e.target.result,
          uploadedBy: getDeptLabel(),
          uploadedAt: new Date().toISOString(),
        };
        _pdfPolicies.push(entry);
        try { localStorage.setItem('njtc_pdf_policies', JSON.stringify(_pdfPolicies.map(p => ({...p, dataUrl: p.dataUrl.substring(0,100)})))); } catch(ex) {}
        logChange('upload', `PDF uploaded: ${entry.name}`, entry.uploadedBy, entry.filename);
        renderPdfUploadList();
        mergePdfPolicies();
      };
      reader.readAsDataURL(file);
    });
  }

  function removePdfPolicy(id) {
    const entry = _pdfPolicies.find(p => p.id === id);
    if (!entry) return;
    if (!confirm('Remove "' + entry.name + '" from the policies library?')) return;
    _pdfPolicies = _pdfPolicies.filter(p => p.id !== id);
    logChange('delete', `PDF removed: ${entry.name}`, getDeptLabel(), entry.filename);
    renderPdfUploadList();
    mergePdfPolicies();
  }

  function renderPdfUploadList() {
    const el = document.getElementById('pdfUploadList');
    if (!el) return;
    if (!_pdfPolicies.length) { el.innerHTML = ''; return; }
    el.innerHTML = _pdfPolicies.map(p => `
      <div class="pdf-upload-item">
        <span style="font-size:1rem">📄</span>
        <span class="pui-name">{p.name}</span>
        <span class="pui-dept">{p.dept.toUpperCase()} · Uploaded by {p.uploadedBy} · {new Date(p.uploadedAt).toLocaleDateString()}</span>
        <button class="pui-del" onclick="removePdfPolicy('{p.id}')" title="Remove">✕</button>
      </div>
    `.replace(/{p\.name}/g, p.name).replace(/{p\.dept\.toUpperCase\(\)}/g, p.dept.toUpperCase())
     .replace(/{p\.uploadedBy}/g, p.uploadedBy).replace(/{new Date\(p\.uploadedAt\)\.toLocaleDateString\(\)}/g, new Date(p.uploadedAt).toLocaleDateString())
     .replace(/{p\.id}/g, p.id)).join('');
  }

  function mergePdfPolicies() {
    // Re-run buildPolicies so PDF additions are merged through the unified pipeline
    // (handles live-doc toggle, Drive manifest docs, and PDF uploads all in one place)
    buildPolicies(false);
  }

  // buildPolicies override removed — live-doc toggle logic merged into main buildPolicies function above

// ══════════════════════════════════════════════════════════════════
  //  DEPARTMENT-AWARE ANALYTICS ENGINE v3
  //  Rules: hr + programming + leadership + data → full talent panel
  //         finance → partnership/workforce cost risk (aggregated)
  //         training → skills gap / PD needs (aggregated, no names)
  //  Year filter available to all analytics views
  // ══════════════════════════════════════════════════════════════════

  // Dept access rules
  const TALENT_FULL_DEPTS  = ['hr','programming','leadership','data','kb'];
  const TALENT_FINANCE_DEPT = ['finance'];
  const TALENT_TRAINING_DEPT = ['training'];

  // Annual goal → department mapping for contextual callouts
  const GOAL_DEPT_MAP = {
    hr:          ['Maintain and continue to build on strong culture'],
    programming: ['Increase Impact on Scholars','Maintain consistent partner experience','Support Growth of New Jersey\'s Educator Pipeline'],
    leadership:  ['Increase the number of fee-for-service partnerships','Continue to pursue large and multi-year sources of funding','Further Diversify board and leverage its support','Maintain cash position','Upgrade systems to support growth','Grow the NJTC brand'],
    kb:          ['Increase the number of fee-for-service partnerships','Continue to pursue large and multi-year sources of funding','Further Diversify board and leverage its support','Maintain cash position','Upgrade systems to support growth','Grow the NJTC brand'],
    finance:     ['Increase the number of fee-for-service partnerships','Continue to pursue large and multi-year sources of funding','Maintain cash position'],
    data:        ['Upgrade systems to support growth','Increase Impact on Scholars'],
    training:    ['Support Growth of New Jersey\'s Educator Pipeline','Maintain and continue to build on strong culture'],
  };

  // ── Department nav initialization ────────────────────────────────

  function buildTalentContent() {
    const el = document.getElementById('talentContent');
    if (!el) return;
    // Guard: if profiles tab is active, don't overwrite it with concerns content
    if (_talentTab === 'profiles') return;
    try {
      const dept = _currentDept || 'hr';
      if (_talentTab === 'all') {
        // Route "All Insights" to dept-specific lens
        if (dept === 'hr')         el.innerHTML = renderHRAnalytics(_filteredConcerns);
        else if (dept === 'programming') el.innerHTML = renderProgrammingAnalytics(_filteredConcerns);
        else if (dept === 'leadership')  el.innerHTML = renderLeadershipAnalytics(_filteredConcerns);
        else if (dept === 'data')        el.innerHTML = renderDataAnalytics(_filteredConcerns);
        else if (dept === 'kb')          el.innerHTML = renderLeadershipAnalytics(_filteredConcerns);
        else el.innerHTML = renderLeadershipAnalytics(_filteredConcerns); // fallback
      } else if (_talentTab === 'program') el.innerHTML = renderProgrammingAnalytics(_filteredConcerns);
      else if (_talentTab === 'hr')      el.innerHTML = renderHRAnalytics(_filteredConcerns);
      else if (_talentTab === 'reviews') {
        if (dept === 'programming') el.innerHTML = renderProgrammingReviews();
        else if (dept === 'training') el.innerHTML = renderTrainingReviews();
        else el.innerHTML = renderTalentReviews();
      }
      else if (_talentTab === 'log')     el.innerHTML = renderTalentLog();
    } catch(e) {
      document.getElementById('talentContent').innerHTML = `<div style="padding:2rem;color:var(--muted);text-align:center">Render error: ${e.message}</div>`;
      console.error('Talent dashboard error:', e);
    }
  }

  // Update tab labels and layout based on dept
  function initTalentTabsForDept(dept) {
    // Full tab list: profiles, all (concerns), program, hr, reviews, log
    const TAB_IDS = ['profiles','all','program','hr','reviews','log'];
    // Dept → which tabs are visible (strict isolation — only leadership/data see cross-dept tabs)
    const TAB_MAP = {
      kb:          ['profiles'],                                        // KB: exec summary only
      leadership:  ['profiles','all','program','hr','reviews','log'],   // leadership: full access
      data:        ['profiles','all','program','hr','reviews','log'],   // data: full access
      hr:          ['profiles','all','reviews','log'],                  // HR: profiles + concerns + site leader reviews + log
      programming: ['profiles','all','reviews'],                        // Programming: profiles + site overview + site leader reviews
      finance:     ['profiles','all'],                                  // Finance: their view
      training:    ['profiles','all','reviews'],                        // Training: profiles + concerns + site leader reviews
    };
    const allowed = new Set(TAB_MAP[dept] || ['all']);

    // Label override for the "all" tab per dept
    const labels = {
      hr:          '👔 HR Overview',
      programming: '🎯 Site Overview',
      leadership:  '⭐ Exec Summary',
      data:        '📈 Full Analytics',
      kb:          '🌟 Exec Summary',
      finance:     '💰 Finance View',
      training:    '📚 Training View',
    };
    const allTab = document.getElementById('talentTab-all');
    if (allTab) allTab.textContent = labels[dept] || '📊 Overview';

    // Show/hide each tab strictly
    for (const id of TAB_IDS) {
      const el = document.getElementById('talentTab-' + id);
      if (!el) continue;
      el.style.display = allowed.has(id) ? '' : 'none';
    }

    // Also intercept onclick on ALL tab buttons to block cross-dept toggling
    // Only leadership and data can click tabs outside their dept-allowed set
    document.querySelectorAll('[id^="talentTab-"]').forEach(btn => {
      const tabId = btn.id.replace('talentTab-','');
      if (!allowed.has(tabId)) {
        btn.onclick = null; // already hidden, double-lock
      }
    });
  }

  // ── Finance analytics panel ────────────────────────────────────

  // ── Override showPanel to trigger dept analytics panels ─────────
  (function() {
    const _base = window.showPanel;
    window.showPanel = function(id, btn) {
      if (_base) _base(id, btn);
      else {
        document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
        document.querySelectorAll('.sidebar-link').forEach(l => l.classList.remove('active'));
        if (id === 'policies' && typeof fetchOpsManual === 'function') fetchOpsManual(false);
        const panelEl = document.getElementById('panel-' + id);
        if (panelEl) panelEl.classList.add('active');
        const linkEl = btn || document.querySelector('[data-panel="' + id + '"]');
        if (linkEl) linkEl.classList.add('active');
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
      if (id === 'advocacy') {
        if (typeof advOnPanelOpen === 'function') advOnPanelOpen();
      }
      if (id === 'talent') {
        buildTalentDashboard(false);
        if (!window._talentLoaded) setTimeout(() => initTalentFilters(), 800);
        // Ensure profiles tab renders for relevant depts
        const _sp2Dept = (window.NJTC_SESSION||{}).dept||'hr';
        if (['hr','data','leadership','kb','finance'].includes(_sp2Dept)) {
          setTimeout(() => {
            if (typeof setTalentTab === 'function') setTalentTab('profiles');
          }, 300);
        }
      }
      if (id === 'finance-analytics') buildFinanceAnalytics();
      if (id === 'training-analytics') buildTrainingAnalytics();
      if (id === 'kpi-analytics') buildKPIAnalytics();
      if (id === 'sy-analytics')  { if (window.sya) window.sya.onPanelOpen(); }
      if (id === 'pearl-ops')     { if (window.po)  window.po.onPanelOpen();  }
      if (id === 'iready-lab')    { if (window.irlab) window.irlab.onPanelOpen(); }
      if (id === 'knowtion')      { if (window.kn) window.kn.build((window.NJTC_SESSION||{}).dept || 'all'); }
    };
  })();

  // ════════════════════════════════════════════════════════════════


  // ── Global data bootstrap — preloads all data sources on page load ─────────
  // Ensures leadership numbers appear on first load without visiting sub-pages.
  (function bootstrapData() {
    function _doBootstrap() {
      // 1. Pearl operations — starts GID discovery + data fetch
      try { if (window.po && typeof window.po.onPanelOpen === 'function') window.po.onPanelOpen(); } catch(e) {}
      // 2. iReady — loads embedded data + starts live fetch (GID discovery + CSV)
      try { if (window.irlab && typeof window.irlab.onPanelOpen === 'function') window.irlab.onPanelOpen(); } catch(e) {}
      // 3. HR profiles — fetch live HR data without requiring the panel to open
      try { if (typeof fetchLiveHRData === 'function') fetchLiveHRData(false).catch(function(){}); } catch(e) {}
      // 4. Survey / concerns data
      try { if (typeof fetchLiveConcerns === 'function') fetchLiveConcerns().catch(function(){}); } catch(e) {}
    }
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', function() { setTimeout(_doBootstrap, 300); });
    } else {
      setTimeout(_doBootstrap, 300);
    }
  })();

  // ── Exec Dashboard: robust multi-signal render engine ─────────────────────
  // Works on any network speed. Fires on: poll, Pearl re-render, iReady load,
  // panel activation. Tracks data fingerprint — only re-paints when data changes.
  (function() {
    var _lastFP = '';
    var _pollCount = 0;
    var _pollDone = false;
    var _stableHits = 0;
    var _INTERVALS = [400,600,800,1000,1200,1500,2000,2500,3000];

    function _isDept(dept) { return ['leadership','data','kb'].includes(dept||''); }

    function _fingerprint() {
      try {
        var st  = (window.po    && typeof window.po.getStats==='function')    ? window.po.getStats()    : null;
        var irl = (window.irlab && typeof window.irlab.getSummary==='function') ? window.irlab.getSummary() : null;
        return [
          st  ? (st.scholAttPct||'')  : '',
          st  ? (st.schoolCount||'')  : '',
          st  ? (st.sessions||'')     : '',
          st  ? (st.activeTutors||'') : '',
          irl ? (irl.mathRows||'')    : '',
          irl ? (irl.elaRows||'')     : '',
          irl ? (irl.mathMedianPctAllYears||'') : '',
          irl ? (irl.elaMedianPctAllYears||'')  : ''
        ].join('|');
      } catch(e) { return ''; }
    }

    function _hasData() {
      try {
        if (window.po && typeof window.po.getStats==='function') {
          var s=window.po.getStats();
          if (s && (s.scholAttPct!==null || s.schoolCount>0 || s.sessions>0)) return true;
        }
        if (window.irlab && typeof window.irlab.getSummary==='function') {
          var i=window.irlab.getSummary();
          if (i && (i.mathRows>0 || i.elaRows>0)) return true;
        }
      } catch(e) {}
      return false;
    }

    function _render(force) {
      var dept = (window.NJTC_SESSION||{}).dept||'';
      if (!_isDept(dept)) return;
      var hp = document.getElementById('panel-home');
      if (!hp || !hp.classList.contains('active')) return;
      var fp = _fingerprint();
      if (!force && fp && fp===_lastFP) return;
      _lastFP = fp;
      try { buildExecDashboard(dept); } catch(e) { console.warn('[ExecDash] render err:',e.message); }
    }

    // Polling loop — escalating delays, min 5 polls, stops after 2 stable data-confirmed rounds
    function _poll() {
      if (_pollDone) return;
      _render(false);
      var hasData = _hasData();
      if (hasData) _stableHits++; else _stableHits = 0;
      if (_stableHits >= 2 && _pollCount >= 5) { _pollDone = true; return; }
      var delay = _INTERVALS[Math.min(_pollCount, _INTERVALS.length-1)];
      _pollCount++;
      if (_pollCount <= 75) setTimeout(_poll, delay); // ~2 min max on slow network
    }
    setTimeout(_poll, 400);

    // Re-render on panel-home activation
    var _origSP_exec = window.showPanel;
    window.showPanel = function(id, btn) {
      if (typeof _origSP_exec==='function') _origSP_exec(id, btn);
      if (id==='home') setTimeout(function(){ _render(true); }, 80);
    };

    // Expose for external trigger (Pearl MutationObserver already wired above)
    window._execDashRefresh = function(force) { _render(force===true); };

    // MutationObserver on Pearl panel — fire re-render when Pearl re-draws
    (function _watchPearl() {
      var panel = document.getElementById('poMainContent') || document.getElementById('panel-pearl-ops');
      if (!panel) { setTimeout(_watchPearl, 500); return; }
      new MutationObserver(function() {
        var hp = document.getElementById('panel-home');
        if (hp && hp.classList.contains('active')) {
          var dept=(window.NJTC_SESSION||{}).dept||'';
          if (_isDept(dept)) setTimeout(function(){ _render(false); }, 200);
        }
      }).observe(panel, { childList:true, subtree:true });
    })();

    // Patch irlab: watch for data arrival on slow network
    (function _watchIrlab() {
      if (!window.irlab) { setTimeout(_watchIrlab, 600); return; }
      if (window.irlab._execWatched) return;
      window.irlab._execWatched = true;
      var _ic = 0;
      (function _chk() {
        try {
          var irl = window.irlab.getSummary();
          if (irl && (irl.mathRows>0 || irl.elaRows>0)) { _render(false); return; }
        } catch(e) {}
        if (_ic++ < 60) setTimeout(_chk, 1500);
      })();
    })();

  })();

  // ── showPanel KPI hook: show/hide QR section ───────────────
  (function() {
    var _origSP2 = window.showPanel;
    window.showPanel = function(id, btn) {
      _origSP2(id, btn);
      if (id === 'kpi') {
        var dept = (window.NJTC_SESSION||{}).dept||'';
        var qrs = document.getElementById('kpiQRSection');
        if (qrs) {
          if (dept === 'data') {
            qrs.style.display = 'block';
          } else {
            qrs.style.display = 'none';
            kqrRestoreSnapshot();
          }
        }
      }
    };
  })();

  // ══════════════════════════════════════════════════════════════════
  //  DATA COMPASS — GOVERNANCE SYSTEM
  // ══════════════════════════════════════════════════════════════════

  var GOV_DATA = {

    /* ══════════════════════════════════════════════════════
       KPI TARGETS — panel-kpi
    ══════════════════════════════════════════════════════ */
    'panel-kpi': {
      what: {
        title: 'KPI Targets',
        icon: '🎯',
        desc: 'Every organizational target for SY 2025–2026 across all 10 annual goal areas. Status, ownership, and source data pulled live from the NJTC KPI Dashboard Google Sheet. The Data & Evaluation department owns this view.',
        alert: '⚠️ Any change to the KPI Dashboard spreadsheet structure, column order, or tab names must be communicated to PEI before implementation. The portal auto-syncs — silent schema changes will break the live feed.',
        sources: [
          { icon: '📊', label: 'KPI Dashboard', color: '#dbeafe', text: '#1e40af' },
          { icon: '📋', label: 'Summary Tab', color: '#dcfce7', text: '#15803d' },
          { icon: '📅', label: 'Quarterly Tab (gid:1313501732)', color: '#f3e8ff', text: '#7e22ce' },
        ],
        items: [
          { icon: '🏷️', label: 'Goal Area', desc: 'One of 10 annual strategic goal categories from the NJTC strategic plan.', live: false },
          { icon: '📌', label: 'Organizational Target', desc: 'The specific, measurable commitment for SY 2025–2026. Targets are set annually during strategic planning.', live: false },
          { icon: '🟡', label: 'Mid-Year Status', desc: 'Formal review status as of January. Populated by goal owners in the KPI Dashboard spreadsheet.', live: true },
          { icon: '🏁', label: 'End of Year Status', desc: 'Final cycle assessment. Completed at end-of-year review (May–June). This is the definitive measure of target achievement.', live: true },
          { icon: '👤', label: 'Owner', desc: 'The primary metric owner responsible for capturing and reporting data. Pulled live from the Quarterly Goal Tracking tab.', live: true },
        ],
        mission: 'Our KPIs are the heartbeat of the NJTC mission — measuring our promise to deliver transformational impact for scholars, sustain the organization financially, and build the infrastructure required to serve students across New Jersey at scale. Every department owns a portion of organizational health.'
      },
      read: {
        title: 'KPI Status Guide',
        intro: 'Status bands are standardized across all goal areas. Teams report both quantitative progress (% of target achieved) and qualitative context. Context always matters — a 75% rate may be on-track given external factors, or concerning if foundational barriers exist.',
        items: [
          { icon: '✅', label: 'Met (81–100%)', desc: 'Target fully achieved this cycle. Goal owner has validated the captured metric against the stated target.', badge: '81–100%' },
          { icon: '🟠', label: 'Partially Met (51–80.9%)', desc: 'Meaningful progress made but the target was not fully achieved. A narrative context note is required from the goal owner.', badge: '51–80%' },
          { icon: '🔵', label: 'In Progress', desc: 'Active work underway. Insufficient data to determine Met/Unmet — typically used mid-cycle when data is still being collected.', badge: 'Active' },
          { icon: '🟣', label: 'Coming Down the Pipeline', desc: 'Not yet initiated but planned. Expected to move to In Progress in a future quarter.', badge: 'Planned' },
          { icon: '🔴', label: 'Has Not Met (0–50.9%)', desc: 'Target was not achieved. Leadership review and action planning are required. This triggers an automatic flag in the Analytics dashboard.', badge: '0–50%' },
        ]
      },
      cadence: {
        items: [
          { icon: '📆', label: 'Reporting Cadence', desc: 'Quarterly informal pulse checks (Q1:Oct, Q2:Jan, Q3:Mar, Q4:Jun). Mid-Year and EOY are formal board reporting cycles.', badge: 'Quarterly' },
          { icon: '👤', label: 'Primary Data Owner', desc: 'Director of Program Evaluation & Impact (PEI). Each goal owner updates their targets directly in the KPI Dashboard Google Sheet.', badge: 'PEI' },
          { icon: '🔄', label: 'Portal Sync', desc: 'Summary tab syncs every 30 minutes automatically. Quarterly Goal Tracking tab (owner/source metadata) syncs every 24 hours. Click ↺ Refresh to force an immediate re-sync.', badge: '30 min' },
          { icon: '📊', label: 'Data Source', desc: 'KPI Dashboard — Summary tab (Mid/EOY statuses) + Quarterly Goal Tracking tab (Q1–Q4 detail, owners, validation sources). Google Sheet ID: 1woHFd7OzO_IS5yD8HOGifVCu0hW3qAStyja63hcxvWg', badge: 'Live Sheet' },
        ],
        timeline: [
          { label: 'October: Q1 Pulse Check', desc: 'Informal progress check. Goal owners update status in the KPI Dashboard.' },
          { label: 'January: Mid-Year Review', desc: 'Formal review. All statuses finalized by goal owners. Shared with leadership and board.' },
          { label: 'March: Q3 Pulse Check', desc: 'Informal check-in to identify targets at risk before EOY.' },
          { label: 'May–June: End-of-Year Assessment', desc: 'Final EOY statuses captured. Comprehensive review of all 43 targets against annual commitments.' },
        ],
        notify: '📣 PEI Notification Required: Any structural changes to the KPI Dashboard spreadsheet (new columns, renamed tabs, reordered rows) must be communicated to the Director of PEI before changes are made. The portal live feed will break silently if the schema changes without coordination.'
      },
      access: {
        rows: [
          { role: 'Director of PEI', scope: 'Full administration', lvl: 'full', label: 'Full Admin' },
          { role: 'Goal Owners (All Depts)', scope: 'Own KPI rows only', lvl: 'view', label: 'Edit + View' },
          { role: 'Executive Leadership', scope: 'View + approve policy', lvl: 'full', label: 'Full View' },
          { role: 'Central Team (All Depts)', scope: 'Portal read-only', lvl: 'view', label: 'View Only' },
          { role: 'External Partners', scope: 'No access', lvl: 'none', label: 'No Access' },
        ],
        notes: [
          { icon: '🔑', label: 'Sheet Access', desc: 'The KPI Dashboard Google Sheet is accessible to goal owners for direct status updates. View-only access is granted to all central team members via Google Workspace.' },
          { icon: '📅', label: 'Quarterly Report Upload', desc: 'Data department staff can upload the Quarterly Goal Tracking CSV directly in this portal to generate an executive snapshot visible to all departments.' },
        ],
        pii: '⚠️ No scholar PII or employee personal data is present in the KPI Dashboard. All targets are organizational-level aggregates. Access restrictions are applied as a matter of data governance best practice.'
      }
    },

    /* ══════════════════════════════════════════════════════
       KPI ANALYTICS — panel-kpi-analytics
    ══════════════════════════════════════════════════════ */
    'panel-kpi-analytics': {
      what: {
        title: 'KPI Analytics Dashboard',
        icon: '📊',
        desc: 'An analytical lens on organizational KPI performance — aggregated health scores, goal area breakdowns, targets needing leadership attention, and the full scorecard. Powered by the same live KPI Dashboard data.',
        sources: [
          { icon: '📊', label: 'KPI Dashboard', color: '#dbeafe', text: '#1e40af' },
          { icon: '🔢', label: 'Weighted Score Model', color: '#f3e8ff', text: '#7e22ce' },
        ],
        items: [
          { icon: '🏠', label: 'At a Glance', desc: 'High-level overview — status distribution, weighted organizational health score, and goal area health grid.', live: false },
          { icon: '📊', label: 'By Goal Area', desc: 'Deep dive into each of the 10 annual goals — individual targets, statuses, and health calculations.', live: false },
          { icon: '⚠️', label: 'Needs Attention', desc: 'Surfaces all Partially Met and Has Not Met targets — the areas requiring immediate leadership focus and action planning.', live: false },
          { icon: '🔮', label: 'Coming Up', desc: 'Targets currently in the pipeline — planned but not yet initiated. Visibility into the forward work queue.', live: false },
          { icon: '🏆', label: 'Full Scorecard', desc: 'Complete view of all 43 targets with status, weighted score contribution, and owner.', live: false },
        ]
      },
      read: {
        title: 'Health Score Methodology',
        intro: 'The organizational health score uses a weighted model calibrated to the NJTC KPI framework. Each status maps to a point value, and the score is the average across all targets within a goal area — or across all 43 targets for the overall score.',
        items: [
          { icon: '✅', label: 'Met = 100 pts', desc: 'Full point value awarded. Target fully achieved.' },
          { icon: '🟠', label: 'Partially Met = 50 pts', desc: 'Half credit. Meaningful progress but target not fully achieved.' },
          { icon: '🔵', label: 'In Progress = 25 pts', desc: 'Quarter credit. Active work underway, insufficient data for final determination.' },
          { icon: '🟣', label: 'Coming Down the Pipeline = 10 pts', desc: 'Minimal credit. Planned but not yet initiated.' },
          { icon: '🔴', label: 'Has Not Met = 0 pts', desc: 'No credit. Target was not achieved this cycle.' },
        ],
        title2: 'Health Bands',
        items2: [
          { icon: '🟢', label: 'Healthy (≥85%)', desc: 'Goal area on track. Majority of targets met or actively progressing. No immediate intervention needed.' },
          { icon: '🟡', label: 'Watch (65–84%)', desc: 'Reasonable overall progress but some targets require closer monitoring. Leadership awareness recommended.' },
          { icon: '🟠', label: 'Needs Focus (40–64%)', desc: 'Multiple targets behind expectations. Team-level action planning and intervention recommended.' },
          { icon: '🔴', label: 'Area of Support (<40%)', desc: 'Significant performance gaps. Immediate executive discussion and structured support plan required.' },
        ]
      },
      cadence: {
        items: [
          { icon: '📆', label: 'Review Points', desc: 'Q1 (Oct), Q2 (Jan / Mid-Year formal), Q3 (Mar), Q4 (Jun / EOY formal). Health scores update automatically as statuses are entered.', badge: 'Quarterly' },
          { icon: '👤', label: 'Analytical Owner', desc: 'Data & Evaluation Department owns this dashboard. Goal area leads own the interpretation and narrative behind their health scores.', badge: 'PEI' },
          { icon: '🔄', label: 'Sync Source', desc: 'Pulls from the same KPI Dashboard Google Sheet as the KPI Targets view. Status changes made by goal owners are reflected within 30 minutes.', badge: '30 min' },
        ]
      },
      access: {
        rows: [
          { role: 'Director of PEI', scope: 'Full dashboard access', lvl: 'full', label: 'Full Admin' },
          { role: 'Executive Leadership', scope: 'Full view + board reporting', lvl: 'full', label: 'Full View' },
          { role: 'All Central Team Depts', scope: 'Portal read-only', lvl: 'view', label: 'View Only' },
          { role: 'External Partners', scope: 'No access', lvl: 'none', label: 'No Access' },
        ],
        notes: [
          { icon: '📋', label: 'Board Reporting', desc: 'The Mid-Year and EOY analytics snapshots are used in board reporting packages. The Director of PEI is responsible for narrative context accompanying health scores.' },
        ]
      }
    },

    /* ══════════════════════════════════════════════════════
       SY SITE ANALYTICS — panel-sy-analytics
    ══════════════════════════════════════════════════════ */
    'panel-sy-analytics': {
      what: {
        title: 'SY Site Analytics',
        icon: '🏫',
        desc: 'School-year site performance across all active NJTC program locations for SY 2025–2026. Enrollment, session counts, scholar engagement, and site health indicators. Pulls from the SY Database Google Sheet.',
        sources: [
          { icon: '🗄️', label: 'SY Database', color: '#dbeafe', text: '#1e40af' },
          { icon: '💠', label: 'PEARL', color: '#f0fdf4', text: '#15803d' },
          { icon: '📐', label: 'iReady', color: '#fefce8', text: '#713f12' },
        ],
        items: [
          { icon: '📍', label: 'Site List', desc: 'All fee-for-service and pilot sites for SY 2025–2026. Pulled from the SY Database master list.', live: true },
          { icon: '📊', label: 'Scholar Enrollment', desc: 'Count of scholars enrolled per site. Updated from the SY Database as sites onboard scholars.', live: true },
          { icon: '📈', label: 'Session Progress', desc: 'Sessions delivered vs. committed per site. Pulled from PEARL.', live: true },
          { icon: '🗺️', label: 'District View', desc: 'Site-level breakdown by district and region across New Jersey.', live: false },
        ],
        mission: 'By 2026, NJTC\'s target is to serve 2,000 scholars across 35+ sites annually. Site Analytics tracks our progress toward this core impact goal in real-time.'
      },
      read: {
        title: 'Site Status Indicators',
        intro: 'Site health is determined by session delivery rate, scholar attendance, and enrollment completion. Indicators update weekly as PEARL and SY Database data are refreshed.',
        items: [
          { icon: '🟢', label: 'On Track', desc: 'Site is meeting session delivery targets (≥80%) and scholar attendance thresholds. No coordinator action needed.' },
          { icon: '🟡', label: 'Monitor', desc: 'One or more metrics are below target but not critical. Site coordinator follow-up recommended within the week.' },
          { icon: '🔴', label: 'Needs Support', desc: 'Multiple indicators below threshold. Regional director escalation required. Action plan to be documented.' },
          { icon: '🔵', label: 'New / Setup', desc: 'Site recently onboarded. Baseline data still being established.' },
        ]
      },
      cadence: {
        items: [
          { icon: '📆', label: 'SY Database Updates', desc: 'Owned by the Programming team. Updated as site enrollments change, new sites onboard, and program changes occur throughout the year.', badge: 'Ongoing' },
          { icon: '💠', label: 'PEARL Sync', desc: 'Session data syncs from PEARL daily. Portal cache refreshes every 2 hours. Pearl GIDs are auto-discovered once per session.', badge: 'Daily' },
          { icon: '👤', label: 'Data Owner', desc: 'Data & Evaluation owns SY Analytics reporting. Programming provides ground-truth site data and context.', badge: 'PEI + Prog' },
        ],
        timeline: [
          { label: 'September–October: Site Onboarding', desc: 'Sites activated in SY Database. Baseline enrollment and staffing data entered. Pearl sessions begin.' },
          { label: 'January: Mid-Year Site Review', desc: 'MOY snapshot captured. Session counts, scholar enrollment, and site health reviewed against KPI targets.' },
          { label: 'May–June: End-of-Year Wrap', desc: 'Final session counts, scholar totals, and site closure data entered. EOY site analytics finalized.' },
        ],
        notify: '📣 PEI Notification Required: If the SY Database schema changes (new columns, renamed districts, restructured site records) the SY Analytics module must be updated. Contact the Director of PEI before making structural changes.'
      },
      access: {
        rows: [
          { role: 'Director of PEI', scope: 'Full admin + reporting', lvl: 'full', label: 'Full Admin' },
          { role: 'Executive Director of Programs', scope: 'All sites, view + edit SY DB', lvl: 'full', label: 'Full Access' },
          { role: 'Regional Program Team', scope: 'Assigned region only', lvl: 'view', label: 'View Only' },
          { role: 'Site Coordinators', scope: 'Assigned site only', lvl: 'limit', label: 'Site View' },
          { role: 'Finance Department', scope: 'Enrollment + billing data', lvl: 'view', label: 'View Only' },
          { role: 'External Partners (Districts)', scope: 'Own district only', lvl: 'limit', label: 'Limited' },
        ],
        notes: [
          { icon: '🔗', label: 'Data Source Link', desc: 'SY Database is a Google Sheet owned by the Programming team. Director of PEI has view access. Any structural changes require PEI coordination.' },
          { icon: '📊', label: 'KPI Connection', desc: 'Site count and scholar totals feed directly into KPI targets: "By 2026, serve 35 sites" and "serve 2,000 scholars annually." Data must remain consistent across both sources.' },
        ],
        pii: '⚠️ Scholar names and identifying information in the SY Database are protected under FERPA. The portal displays aggregate site-level data only. Do not share site-level individual records externally without coordinator approval.'
      }
    },

    /* ══════════════════════════════════════════════════════
       PEARL OPERATIONS — panel-pearl-ops
    ══════════════════════════════════════════════════════ */
    'panel-pearl-ops': {
      what: {
        title: 'Pearl Operations',
        icon: '💠',
        desc: 'Live operational data from the Pearl platform — session attendance by instructor, program delivery metrics, student session counts, and HIT compliance indicators. Pearl is the source of truth for all session-level program operations.',
        alert: '⚠️ Pearl is the authoritative source for session-level data. Any discrepancy between Pearl and other reports must be resolved at the Pearl level first. Contact the Programming team to correct Pearl records before updating any downstream report.',
        sources: [
          { icon: '💠', label: 'PEARL Platform', color: '#f0fdf4', text: '#15803d' },
          { icon: '📋', label: 'Instructor Attendance', color: '#dbeafe', text: '#1e40af' },
          { icon: '🎓', label: 'Scholar Sessions', color: '#fef9c3', text: '#713f12' },
        ],
        items: [
          { icon: '📋', label: 'Instructor Attendance Rate', desc: 'Session attendance rate per instructor across all active sites. Calculated as (sessions attended / sessions scheduled). Session-weighted across ALL Pearl instructors including termed staff.', live: true },
          { icon: '👩‍🏫', label: 'Instructor Session Count', desc: 'Total sessions delivered per instructor for the current SY. Pulled from the Pearl Instructor Attendance tab.', live: true },
          { icon: '🎓', label: 'Scholar Session Engagement', desc: 'Student-level session counts pulled from the Pearl Student Sessions tab. Tracks dosage per scholar.', live: true },
          { icon: '🚩', label: 'HIT Compliance Flags', desc: 'High-Impact Tutoring threshold monitoring. Flags scholars or sites not meeting minimum session dosage requirements.', live: true },
        ],
        mission: 'High-dosage tutoring effectiveness depends on session consistency. Pearl Operations gives the Programming and PEI teams real-time visibility into whether we are delivering on our dosage commitments to partner schools and scholars.'
      },
      read: {
        title: 'Attendance Rate Thresholds',
        intro: 'Two attendance rate measures are displayed in this portal. Tutor Session Rate (Pearl Ops) is session-weighted across all Pearl instructors including termed staff. Average Attendance Rate (Talent) is the mean of per-person rates for Active HR staff with Pearl name matches only. Both are labeled explicitly.',
        items: [
          { icon: '🟢', label: 'Green (≥80%)', desc: 'Instructor meeting or exceeding program attendance expectations. No immediate action needed.' },
          { icon: '🟡', label: 'Yellow (60–79%)', desc: 'Attendance below target. Site coordinator should follow up and document any contextual factors (illness, school events, etc.).' },
          { icon: '🔴', label: 'Red (<60%)', desc: 'Significant attendance concern. Regional director escalation required. Documentation of intervention plan needed within 48 hours.' },
        ],
        title2: 'HIT Compliance Flags',
        items2: [
          { icon: '✅', label: 'Compliant', desc: 'Scholar meeting or exceeding minimum session dosage for High-Impact Tutoring designation.' },
          { icon: '⚠️', label: 'At Risk', desc: 'Scholar approaching minimum threshold. Site coordinator alert issued.' },
          { icon: '🚩', label: 'Non-Compliant', desc: 'Scholar below HIT minimum. Partner school notification may be required per contract terms.' },
        ]
      },
      cadence: {
        items: [
          { icon: '📆', label: 'Pearl Sync', desc: 'Pearl data refreshes on panel open with a 2-hour cache. GIDs (tab IDs) are auto-discovered using a 3-pass resolution system and cached for the session. Force refresh via ↺.', badge: '2hr Cache' },
          { icon: '👤', label: 'Data Entry Owner', desc: 'Programming Department owns all Pearl data entry (session records, instructor assignments, student rostering). PEI owns the reporting, flagging, and analytics layer.', badge: 'Programming' },
          { icon: '🚩', label: 'Flag Reports', desc: 'HIT compliance and attendance flag reports are generated and sent to regional teams every Monday by EOD. Onsite teams receive site-specific summaries.', badge: 'Monday EOD' },
          { icon: '🔄', label: 'Data Quality', desc: 'Inactive instructor records in Pearl must be archived to prevent data skew. PEI conducts monthly Pearl audits against the HR Master List to flag mismatches.', badge: 'Monthly' },
        ],
        timeline: [
          { label: 'Weekly: Monday EOD', desc: 'Flag reports sent to regional program teams. Session attendance updated in portal.' },
          { label: 'Monthly: Pearl Audit', desc: 'PEI cross-references Pearl instructor list against HR Master List. Unmatched or termed records are flagged for Programming to archive.' },
          { label: 'January (MOY): Mid-Year Pearl Review', desc: 'Session totals reviewed against KPI targets. Site dosage compliance formally assessed.' },
          { label: 'May–June (EOY): Final Session Counts', desc: 'All sessions finalized in Pearl. EOY dosage data used for ADP Suite academic overlay and annual impact report.' },
        ],
        notify: '📣 PEI Notification Required: If Pearl\'s tab structure (GIDs), column headers, or instructor name formatting changes, the portal\'s auto-discovery may fail. Contact PEI immediately if Pearl data stops loading correctly in the portal.'
      },
      access: {
        rows: [
          { role: 'Director of PEI', scope: 'Full admin + reporting', lvl: 'full', label: 'Full Admin' },
          { role: 'Programming / Exec Dir', scope: 'All sites, data entry', lvl: 'full', label: 'Full Access' },
          { role: 'Regional Program Leads', scope: 'Assigned region', lvl: 'view', label: 'View Only' },
          { role: 'Site Coordinators', scope: 'Assigned site', lvl: 'limit', label: 'Site View' },
          { role: 'HR Department', scope: 'Attendance overlay only', lvl: 'view', label: 'View Only' },
          { role: 'External Partners', scope: 'No direct access', lvl: 'none', label: 'No Access' },
        ],
        notes: [
          { icon: '🔐', label: 'Pearl Platform Access', desc: 'Pearl platform credentials are managed by the Programming team. The portal connects to Pearl via published Google Sheet (2PACX link) — no Pearl login is required for portal users.' },
          { icon: '📊', label: 'ADP Suite Integration', desc: 'Pearl attendance data feeds directly into the ADP Suite Employee Profile Dashboard for rehire decision scoring. Data quality in Pearl directly impacts automated rehire recommendations.' },
        ],
        pii: '⚠️ Pearl contains scholar names and session records protected under FERPA. The portal displays aggregated instructor-level and site-level data only. Individual scholar records are never surfaced in the Central Team Portal. Access to raw Pearl export data is restricted to PEI and Programming leadership.'
      }
    },

    /* ══════════════════════════════════════════════════════
       TALENT ANALYTICS — panel-talent
    ══════════════════════════════════════════════════════ */
    'panel-talent': {
      what: {
        title: 'Talent Analytics',
        icon: '👥',
        desc: 'Comprehensive HR and talent intelligence for all NJTC staff — central team and onsite. Integrates ADP Workforce Now data, Pearl attendance overlays, iReady academic performance context, and program concern records. Powered by the ADP Suite: Employee Profile Dashboard methodology.',
        alert: '⚠️ The ADP Suite Employee Profile Dashboard is the system of record for rehire decisions. Any changes to ADP benchmark thresholds (Scholar Learning Gained, Rapport scores, attendance floors, academic placement standards) require Program Team approval for moderate changes or Executive approval for major methodology changes. Contact the Director of PEI.',
        sources: [
          { icon: '⚙️', label: 'ADP Workforce Now', color: '#dbeafe', text: '#1e40af' },
          { icon: '💠', label: 'PEARL', color: '#f0fdf4', text: '#15803d' },
          { icon: '📐', label: 'iReady', color: '#fefce8', text: '#713f12' },
          { icon: '📋', label: 'Program Concerns', color: '#fce7f3', text: '#be185d' },
        ],
        items: [
          { icon: '👤', label: 'Staff Profiles', desc: 'HR records from ADP Workforce Now via the Master List Google Sheet. Enriched with live Pearl attendance overlays and iReady academic impact data.', live: true },
          { icon: '⚠️', label: 'Performance Concerns', desc: 'Program Concern Form (PGP) records by staff member. Critical thresholds: 1 PGP = documented concern; 3 PGPs = enhanced monitoring; 6+ PGPs = critical intervention.', live: true },
          { icon: '📊', label: 'Talent Analytics', desc: 'Aggregate HR metrics — retention rates, tier distribution, site staffing, role breakdown, and hire/term trends.', live: true },
          { icon: '🔄', label: 'Rehire Decision Layer', desc: 'ADP Suite automated rehire recommendation (YES / MAYBE / NO / UNKNOWN / PENDING) based on 4-benchmark evaluation: Scholar Learning, Rapport, Attendance, Academic Placement.', live: true },
        ],
        mission: 'The ADP Suite removes subjectivity from rehiring decisions through objective, measurable benchmarks. Every decision can be traced to specific performance data — Scholar Learning Gained, Tutor-Scholar Rapport, Attendance Rate, and Academic Placement Progress.'
      },
      read: {
        title: 'Staff Tier System',
        intro: 'Staff tiers are calculated by PEI using a composite score across attendance (Pearl), academic impact (iReady), and concern record (Program Concerns). Tiers update automatically as live overlays refresh. The live tier (_liveT) takes precedence over the static embedded tier.',
        items: [
          { icon: '🥇', label: 'Tier 1 — Elite', desc: 'Top performers. High Pearl attendance (≥90%) + strong academic growth outcomes (≥65% scholars advancing 1+ grade level) + zero-minimal concerns.' },
          { icon: '🥈', label: 'Tier 2 — Strong', desc: 'Solid performance. Meeting expectations across key indicators. ≥80% attendance + positive scholar learning outcomes.' },
          { icon: '🥉', label: 'Tier 3 — Developing', desc: 'Growth areas identified. Attendance or academic outcomes below target. Active coaching or support plan in place.' },
          { icon: '⬜', label: 'Tier 4 — Needs Support', desc: 'Multiple performance concerns. Below-threshold on 2+ benchmarks. Active intervention required. ADP Suite rehire status typically MAYBE or NO.' },
        ],
        title2: 'ADP Suite Rehire Status Guide',
        items2: [
          { icon: '✅', label: 'YES — Recommended', desc: 'All 4 ADP benchmarks met. Scholar Learning ≥4.2 (full year), Rapport ≥4.5, Attendance ≥90%, Academic Placement Progress ≥65%.' },
          { icon: '⚠️', label: 'MAYBE — Leadership Review', desc: 'Mixed performance. At least one benchmark below threshold but contextual factors may warrant rehire. Case-by-case with documented rationale required.' },
          { icon: '❌', label: 'NO — Not Recommended', desc: 'Multiple benchmark failures, severe concerns (4+ PGPs), HR-escalated termination, or critical attendance (<80%).' },
          { icon: '📊', label: 'UNKNOWN — Data Missing', desc: 'At least one required metric not yet available. Cannot make a complete determination. Pending data collection.' },
          { icon: '⏳', label: 'PENDING — Awaiting Academic Data', desc: 'Profile complete but academic data (iReady/PEARL surveys) not yet available for the current cycle.' },
        ]
      },
      cadence: {
        items: [
          { icon: '⚙️', label: 'ADP / HR Master List', desc: 'Director of PEI is primary data steward. HR Master List Google Sheet is the portal\'s live HR source (GID: 911694457). Updates within 1 hour of sheet changes. New SY 2025-2026 staff added to sheet → auto-appears in portal.', badge: '1hr Sync' },
          { icon: '💠', label: 'Pearl Overlay', desc: 'Attendance data merged by tutor name from Pearl at panel open. Uses normalized name matching (strips -SUB suffixes and parentheticals). Refreshes each session.', badge: 'Per Session' },
          { icon: '📐', label: 'iReady Overlay', desc: 'Academic impact data synced from the NJTC iReady Dashboard Sheet every 2 hours. GIDs auto-discovered on first load. Tutor attribution handles multi-tutor assignments.', badge: '2hr Cache' },
          { icon: '📋', label: 'Concern Records', desc: 'Program Concern Forms (PGPs) are entered in the Talent Concerns sheet by program coordinators. Syncs to Talent panel on load.', badge: 'Weekly' },
        ],
        timeline: [
          { label: 'September–October: Baseline Onboarding', desc: 'New staff added to HR Master List. Initial ADP profiles created. Pearl assignments configured.' },
          { label: 'January (MOY): Mid-Year ADP Assessment', desc: 'Academic data collected. PEARL surveys administered. Preliminary rehire decisions generated by ADP Suite.' },
          { label: 'May–June (EOY): Final ADP Decisions', desc: 'Final academic data, PEARL surveys, and concern records reviewed. Final rehire decisions documented.' },
          { label: 'July–August: Rehire Communications', desc: 'Offers extended to YES/MAYBE staff. Feedback provided to NO decisions. Recruitment begins for vacancies.' },
        ],
        notify: '📣 PEI Notification Required: If ADP Workforce Now\'s Census Report format changes, or if the HR Master List Google Sheet structure is modified (new columns, renamed fields), the Talent module\'s live overlay will break. Contact the Director of PEI before making structural changes to either system.'
      },
      access: {
        rows: [
          { role: 'Director of PEI', scope: 'Full admin, data steward', lvl: 'full', label: 'Full Admin' },
          { role: 'Executive Leadership', scope: 'All staff, all decisions', lvl: 'full', label: 'Full Access' },
          { role: 'Human Resources', scope: 'All staff, edit ADP data', lvl: 'full', label: 'Full Access' },
          { role: 'Program Coordinators', scope: 'Assigned site only', lvl: 'limit', label: 'Site View' },
          { role: 'Central Team (Data Dept)', scope: 'Full portal view', lvl: 'view', label: 'View Only' },
          { role: 'Onsite Staff', scope: 'Own profile only', lvl: 'limit', label: 'Personal' },
        ],
        notes: [
          { icon: '🔐', label: 'ADP Suite Access Policy', desc: 'Policy changes require tiered approval: minor changes (visual, corrections) → Director of PEI authority; moderate (benchmark ±0.2, new features) → Program Team approval; major (methodology, decision logic) → Executive approval.' },
          { icon: '📊', label: 'Annual System Review', desc: 'Each summer, the Director of PEI conducts a comprehensive review of benchmark effectiveness, decision accuracy, equity analysis, and data quality. Results shared with Executive Leadership.' },
        ],
        pii: '⚠️ Talent Analytics contains protected employee personal data under FERPA and employment law. Performance records are confidential employment documents. Scholar survey data has identifying information removed. Medical/accommodation information is maintained separately by HR. Unauthorized access or sharing may result in disciplinary action up to termination.'
      }
    },

    /* ══════════════════════════════════════════════════════
       i-READY ANALYSIS LAB — panel-iready-lab
    ══════════════════════════════════════════════════════ */
    'panel-iready-lab': {
      what: {
        title: 'i-Ready Analysis Lab',
        icon: '🧪',
        desc: 'Academic performance analysis using iReady diagnostic data. Scholar placement levels, on-grade-level rates, grade level movement, scale score growth, and tutor-level academic impact. The authoritative source for proving NJTC\'s academic impact to stakeholders and partners.',
        alert: '⚠️ iReady data is provided by partner districts. Any BOY/MOY/EOY assessment windows that change, new districts added, or changes to the iReady Google Sheet structure require PEI notification. Data quality in this module directly impacts the ADP Suite rehire decisions and all external partner presentations.',
        sources: [
          { icon: '📐', label: 'iReady Platform', color: '#fefce8', text: '#713f12' },
          { icon: '🗄️', label: 'NJTC iReady Dashboard Sheet', color: '#dbeafe', text: '#1e40af' },
          { icon: '📊', label: 'Longitudinal (SY22–Present)', color: '#f3e8ff', text: '#7e22ce' },
        ],
        items: [
          { icon: '📊', label: 'Placement Levels (5-Tier)', desc: 'iReady diagnostic placement: Mid/Above Grade Level, Early On Grade, 1 Level Below, 2 Levels Below, 3+ Levels Below. Available for Math and ELA by site, grade, and tutor.', live: true },
          { icon: '📈', label: 'Progress to Grade Level Proficiency', desc: 'Overall relative placement movement for scholars beginning at least 1 grade level below. Primary impact metric.', live: true },
          { icon: '⬆️', label: 'Progress ≥1 Grade Level', desc: 'Percentage of scholars who advanced at least one placement level from baseline to spring. Key external reporting metric.', live: true },
          { icon: '📉', label: 'Regression Rate', desc: 'Percent of scholars who regressed from baseline placement level. Target: ≤7% for full-cycle tutors per ADP Suite benchmarks.', live: true },
          { icon: '🎯', label: 'Median % to Typical Growth', desc: 'iReady\'s alignment metric — in 30 weeks, scholars should reach 100% typical growth. NJTC tracks and reports this to partners.', live: true },
          { icon: '🔁', label: 'Repeat Scholar Metrics', desc: 'Multi-year scholars tracked longitudinally. Repeat cohorts demonstrate long-term effectiveness of NJTC\'s high-dosage model.', live: true },
        ],
        mission: 'We rigorously collect and analyze academic data to demonstrate the tangible impact of high-impact tutoring — particularly for scholars performing 2+ grade levels below. This data provides concrete FACTS of scholar progress for stakeholders, funders, and partners.'
      },
      read: {
        title: 'iReady 5-Level Placement System',
        intro: 'The 5-Level Placements provide greater insight into student performance using the same five placements that calculate student growth in the iReady growth model. These are available at both overall and domain level with demographic filters. NJTC\'s primary focus population: scholars at 2+ grade levels below.',
        items: [
          { icon: '🟢', label: 'Mid or Above Grade Level', desc: 'Met or surpassed minimum college- and career-ready standards. Benefits from late on-grade or above-grade instruction. NJTC scholars at this level typically do not need intensive intervention.' },
          { icon: '🟢', label: 'Early On Grade Level', desc: 'Partially met grade-level expectations. Benefits from on-grade instruction. Likely does not need specialized intervention.' },
          { icon: '🟡', label: 'One Grade Level Below', desc: 'Approaching grade-level. BOY: performing consistently with students just starting the year. Mid/EOY: may need intensive intervention.' },
          { icon: '🟠', label: 'Two Grade Levels Below', desc: 'NJTC primary target population. Likely needs additional support with key skills below chronological grade level. Intensive intervention recommended.' },
          { icon: '🔴', label: 'Three or More Levels Below', desc: 'NJTC priority scholars. Intensive foundational intervention required. ADP Suite academic placement benchmark focuses on this group\'s movement.' },
        ],
        title2: 'Tier Identification Framework',
        items2: [
          { icon: '🟢', label: 'Tier 1 (No Intensive Intervention)', desc: 'BOY: Emerging or above. MOY: Early On Grade or Mid/Above. EOY: On or Above Grade Level.' },
          { icon: '🟡', label: 'Tier 2 (Targeted Support)', desc: 'BOY: Two Levels Below. MOY: One Level Below. EOY: One Level Below or Early On Grade.' },
          { icon: '🔴', label: 'Tier 3 (Intensive Intervention)', desc: 'BOY: Three+ Levels Below. MOY: Two or Three+ Levels Below. EOY: Two or Three+ Levels Below.' },
        ]
      },
      cadence: {
        items: [
          { icon: '📆', label: 'Assessment Windows', desc: 'Fall/BOY: September–October. Winter/MOY: January–February. Spring/EOY: April–May. Data available in the portal after each window closes and partner districts export to the iReady Dashboard Sheet.', badge: '3x/Year' },
          { icon: '👤', label: 'Data Owner', desc: 'Director of PEI — primary data owner, collection oversight, dashboard creation, quality assurance. Districts provide iReady exports. PEI cleans, validates, and publishes data.', badge: 'PEI' },
          { icon: '🔄', label: 'Portal Sync', desc: 'Live iReady Dashboard Sheet syncs on panel open. GIDs auto-discovered using tab header signature matching. 2-hour cache. After merge: HR profiles automatically re-rendered with academic overlays.', badge: '2hr Cache' },
          { icon: '📋', label: 'Reporting Cadence', desc: 'Report-outs done at MOY and EOY. External partner presentations use NJTC-framed language (% improvement toward typical growth, grade level spotlights) per the Academic Data Governance Manual.', badge: 'MOY + EOY' },
        ],
        timeline: [
          { label: 'Sep–Oct (BOY): Baseline Assessment', desc: 'Pre-program diagnostics administered by partner districts. BOY data uploaded to iReady Dashboard Sheet. Baseline established for all scholars.' },
          { label: 'Jan–Feb (MOY): Mid-Year Assessment', desc: 'MOY diagnostics. Preliminary academic impact data available. Used for ADP Suite mid-year rehire decisions and partner mid-year presentations.' },
          { label: 'Apr–May (EOY): Final Assessment', desc: 'Post-program diagnostics. Full academic impact calculated. ADP Suite final rehire decisions triggered. External evaluation partner receives data.' },
          { label: 'Jun–Aug: Evaluation Reporting', desc: 'External evaluation underway (complemented by internal evaluation for data validation). Program wrap-up report completed by end of July.' },
        ],
        notify: '📣 PEI Notification Required: iReady connects via published Google Sheet (2PACX link). If the NJTC iReady Dashboard Sheet is restructured, columns reordered, or new tabs added, the portal GID auto-discovery may fail silently. Contact PEI before any structural changes. Missing BOY/EOY assessment pairs are flagged by the Missing Data % indicator — resolve in the source sheet.'
      },
      access: {
        rows: [
          { role: 'Director of PEI', scope: 'Full admin, data owner', lvl: 'full', label: 'Full Admin' },
          { role: 'Executive Director of Operations', scope: 'Full view', lvl: 'full', label: 'Full View' },
          { role: 'Leadership', scope: 'Dashboard view + reporting', lvl: 'view', label: 'View Only' },
          { role: 'Program Team', scope: 'Partner presentations + context', lvl: 'view', label: 'View Only' },
          { role: 'External Partners (Districts)', scope: 'District-level view only', lvl: 'limit', label: 'Limited' },
          { role: 'External Evaluator', scope: 'Full access for evaluation', lvl: 'full', label: 'Full Access' },
        ],
        notes: [
          { icon: '🔐', label: 'iReady Platform Access', desc: 'iReady Connect login: njtc@njtutoring.org | State: New Jersey. Managed by Director of PEI. District credentials are maintained separately per district contract.' },
          { icon: '📊', label: 'ADP Suite Integration', desc: 'iReady academic placement data feeds directly into ADP Suite rehire scoring (Academic Placement Progress benchmark: ≥65% for full-cycle tutors). Data must be finalized before ADP Suite runs EOY decisions.' },
          { icon: '🤝', label: 'External Partner Framing', desc: 'Per NJTC Academic Data Governance: partner-facing presentations use specific approved language regardless of academic outcomes — framing growth emotionally and academically to ensure partner impact. See the Academic Data Governance Manual for approved language.' },
        ],
        pii: '⚠️ iReady data contains scholar diagnostic results protected under FERPA. All iReady data in the portal is aggregated at the tutor, grade, or site level — no individual scholar records are surfaced. Raw iReady exports are restricted to the Director of PEI. District partners access only their own district\'s aggregated data. External evaluator access is governed by a separate data sharing agreement.'
      }
    }

  };

    var _govCurrentPanel = 'panel-kpi';
  var _govCurrentTab   = 'what';

  var BEACON_PANELS = new Set(['panel-kpi','panel-kpi-analytics','panel-sy-analytics','panel-pearl-ops','panel-talent','panel-iready-lab','panel-knowtion']);

  function govOpen() {
    var content = GOV_DATA[_govCurrentPanel];
    if (!content) return;
    govRenderBody(_govCurrentTab);
    document.getElementById('govSheet').classList.add('open');
    document.getElementById('govOverlay').classList.add('open');
    document.body.style.overflow='hidden';
  }
  function govClose() {
    document.getElementById('govSheet').classList.remove('open');
    document.getElementById('govOverlay').classList.remove('open');
    document.body.style.overflow='';
  }
  function govTab(btn, tabId) {
    document.querySelectorAll('.gov-tab').forEach(function(b){ b.classList.remove('active'); });
    btn.classList.add('active');
    _govCurrentTab = tabId;
    govRenderBody(tabId);
  }
  function govRenderBody(tab) {
    var panelData = GOV_DATA[_govCurrentPanel];
    if (!panelData) return;
    var body = document.getElementById('govBody');
    if (!body) return;
    var d = panelData[tab];
    if (!d) return;
    var html = '';

    if (tab === 'what') {
      // Panel identity header
      html += '<div class="gov-panel-hero">';
      html += '<span class="gov-hero-icon">'+panelData.what.icon+'</span>';
      html += '<div>';
      html += '<div class="gov-hero-title">'+panelData.what.title+'</div>';
      html += '<div class="gov-hero-desc">'+panelData.what.desc+'</div>';
      if (panelData.what.alert) {
        html += '<div class="gov-alert">'+panelData.what.alert+'</div>';
      }
      html += '</div>';
      html += '</div>';
      // Data source pills
      if (panelData.what.sources && panelData.what.sources.length) {
        html += '<div class="gov-source-row">';
        for (var si=0; si<panelData.what.sources.length; si++) {
          var src = panelData.what.sources[si];
          html += '<span class="gov-source-pill" style="background:'+src.color+';color:'+src.text+'">';
          html += src.icon+' '+src.label;
          html += '</span>';
        }
        html += '</div>';
      }
      html += '<div class="gov-section-title">Data Elements in This View</div>';
      for (var i=0; i<d.items.length; i++) {
        var item = d.items[i];
        html += '<div class="gov-row">';
        html += '<span class="gov-row-icon">'+item.icon+'</span>';
        html += '<div class="gov-row-body"><div class="gov-row-label">'+item.label+'</div><div class="gov-row-desc">'+item.desc+'</div></div>';
        if (item.live) html += '<span class="gov-badge live">Live</span>';
        html += '</div>';
      }
      // Mission note
      if (panelData.what.mission) {
        html += '<div class="gov-mission-note"><div class="gov-mission-title">Mission Context</div><div class="gov-mission-body">'+panelData.what.mission+'</div></div>';
      }
    } else if (tab === 'read') {
      if (d.intro) html += '<div class="gov-intro-text">'+d.intro+'</div>';
      html += '<div class="gov-section-title">'+((d.title)||'Status Guide')+'</div>';
      for (var i=0; i<d.items.length; i++) {
        var item = d.items[i];
        html += '<div class="gov-row">';
        html += '<span class="gov-row-icon">'+item.icon+'</span>';
        html += '<div class="gov-row-body"><div class="gov-row-label">'+item.label+'</div><div class="gov-row-desc">'+item.desc+'</div></div>';
        if (item.badge) html += '<span class="gov-badge">'+item.badge+'</span>';
        html += '</div>';
      }
      if (d.items2 && d.items2.length) {
        html += '<div class="gov-section-title" style="margin-top:1rem">'+d.title2+'</div>';
        for (var j=0; j<d.items2.length; j++) {
          var item2 = d.items2[j];
          html += '<div class="gov-row"><span class="gov-row-icon">'+item2.icon+'</span><div class="gov-row-body"><div class="gov-row-label">'+item2.label+'</div><div class="gov-row-desc">'+item2.desc+'</div></div></div>';
        }
      }
    } else if (tab === 'cadence') {
      html += '<div class="gov-section-title">Update Schedule & Data Ownership</div>';
      for (var i=0; i<d.items.length; i++) {
        var item = d.items[i];
        html += '<div class="gov-row"><span class="gov-row-icon">'+item.icon+'</span><div class="gov-row-body"><div class="gov-row-label">'+item.label+'</div><div class="gov-row-desc">'+item.desc+'</div></div>'+(item.badge?'<span class="gov-badge cadence">'+item.badge+'</span>':'')+'</div>';
      }
      if (d.timeline && d.timeline.length) {
        html += '<div class="gov-section-title" style="margin-top:1rem">Annual Timeline</div>';
        for (var ti=0; ti<d.timeline.length; ti++) {
          var tl = d.timeline[ti];
          html += '<div class="gov-timeline-row"><div class="gov-tl-dot"></div><div class="gov-tl-body"><div class="gov-tl-label">'+tl.label+'</div><div class="gov-tl-desc">'+tl.desc+'</div></div></div>';
        }
      }
      if (d.notify) {
        html += '<div class="gov-alert notify">'+d.notify+'</div>';
      }
    } else if (tab === 'access') {
      html += '<div class="gov-section-title">Security Levels & Access Control</div>';
      if (d.rows && d.rows.length) {
        html += '<div class="gov-access-table">';
        html += '<div class="gov-access-head"><span>Role / Department</span><span>Scope</span><span>Level</span></div>';
        for (var ai=0; ai<d.rows.length; ai++) {
          var ar = d.rows[ai];
          html += '<div class="gov-access-row"><span class="gov-access-role">'+ar.role+'</span><span class="gov-access-scope">'+ar.scope+'</span><span class="gov-access-level gov-al-'+ar.lvl+'">'+ar.label+'</span></div>';
        }
        html += '</div>';
      }
      if (d.notes && d.notes.length) {
        html += '<div class="gov-section-title" style="margin-top:1rem">Policy Notes</div>';
        for (var ni=0; ni<d.notes.length; ni++) {
          var note = d.notes[ni];
          html += '<div class="gov-row"><span class="gov-row-icon">'+note.icon+'</span><div class="gov-row-body"><div class="gov-row-label">'+note.label+'</div><div class="gov-row-desc">'+note.desc+'</div></div></div>';
        }
      }
      if (d.pii) {
        html += '<div class="gov-alert pii">'+d.pii+'</div>';
      }
    }
    body.innerHTML = html;
  }

  function govUpdateBeacon(panelId) {
    _govCurrentPanel = panelId;
    _govCurrentTab   = 'what';
    var beacon = document.getElementById('govBeacon');
    if (!beacon) return;
    if (BEACON_PANELS.has(panelId)) {
      beacon.classList.add('visible');
    } else {
      beacon.classList.remove('visible');
    }
    // Reset gov sheet tabs to "what"
    document.querySelectorAll('.gov-tab').forEach(function(b){ b.classList.remove('active'); });
    var wtab = document.getElementById('govTab-what');
    if (wtab) wtab.classList.add('active');
  }

  // Patch showPanel to update beacon
  var _origShowPanel = window.showPanel;
  if (typeof _origShowPanel === 'function') {
    window.showPanel = function(id, opts) {
      govUpdateBeacon(id);
      return _origShowPanel(id, opts);
    };
  }

  document.addEventListener('keydown', function(e){ if(e.key==='Escape') govClose(); });

  // Show beacon immediately on page load based on active panel
  document.addEventListener('DOMContentLoaded', function() {
    // Small delay to let portal initialize
    setTimeout(function() {
      var activePanel = document.querySelector('.panel.active');
      if (activePanel) {
        govUpdateBeacon(activePanel.id);
      }
      // Also watch for panel changes via MutationObserver as backup
      var panels = document.querySelectorAll('.panel');
      if (panels.length) {
        var obs = new MutationObserver(function(mutations) {
          mutations.forEach(function(m) {
            if (m.type === 'attributes' && m.attributeName === 'class') {
              var el = m.target;
              if (el.classList.contains('active') && el.id) {
                govUpdateBeacon(el.id);
              }
            }
          });
        });
        panels.forEach(function(p) {
          obs.observe(p, { attributes: true, attributeFilter: ['class'] });
        });
      }
    }, 800);
  });

  window.govOpen   = govOpen;
  window.govClose  = govClose;
  window.govTab    = govTab;

  // renderKPIAnalytics / renderKPIAnalyticsTab exposed by shared-charts.js




  // ══════════════════════════════════════════════════════════
  //  WINDOW EXPOSURES — make shared state accessible globally
  // ══════════════════════════════════════════════════════════
  window.NJTC_CACHE           = NJTC_CACHE;
  window.DEPT_CONFIG          = DEPT_CONFIG;
  window.DEPT_CONNECTIONS     = DEPT_CONNECTIONS;
  window.DEPT_COLORS          = DEPT_COLORS;
  window.DEPT_ICONS           = DEPT_ICONS;
  window.DEPT_LABELS          = DEPT_LABELS;
  window.KPI_DATA_STATIC      = KPI_DATA_STATIC;
  window.KPI_DATA             = KPI_DATA;
  window.SHEET_CSV_URL        = SHEET_CSV_URL;
  window.KPI_META_URL         = KPI_META_URL;
  window.KPI_META_CACHE_KEY   = KPI_META_CACHE_KEY;
  window.KPI_META_TTL         = KPI_META_TTL;
  window.OPS_MANUAL_PUB_URL   = OPS_MANUAL_PUB_URL;
  window.POLICY_SECTION_MAP   = POLICY_SECTION_MAP;
  window.DRIVE_MANIFEST_ID    = DRIVE_MANIFEST_ID;
  window.DRIVE_APPS_SCRIPT_URL = DRIVE_APPS_SCRIPT_URL;
  window.TALENT_FULL_DEPTS    = TALENT_FULL_DEPTS;
  window.TALENT_FINANCE_DEPT  = TALENT_FINANCE_DEPT;
  window.TALENT_TRAINING_DEPT = TALENT_TRAINING_DEPT;
  window.HR_EMPS              = HR_EMPS;
  window.CONCERNS             = CONCERNS;
  window.REVIEWS              = REVIEWS;
  window.showPanel            = showPanel;
  window.statusClass          = statusClass;
  window.statusEmoji          = statusEmoji;
  window.groupBy              = groupBy;
  window.countBy              = countBy;
  window.buildHome            = buildHome;
  window.buildSidebarDept     = buildSidebarDept;
  window.buildKPISummary      = buildKPISummary;
  window.buildKPI             = buildKPI;
  window.filterKPI            = filterKPI;
  window.setKpiFilter         = setKpiFilter;
  window.openConnectionsModal  = openConnectionsModal;
  window.closeConnectionsModal = closeConnectionsModal;
  window.fetchOpsManual        = fetchOpsManual;
  window.openPolicyByIdx       = openPolicyByIdx;
  window.showPolicySection     = showPolicySection;
  window.removePdfPolicy       = removePdfPolicy;
  window.parseDocHTML          = parseDocHTML;
  window.initPolicyAdmin       = initPolicyAdmin;
  window.toggleLiveDoc         = toggleLiveDoc;
  window.handlePdfUpload       = handlePdfUpload;
  window.renderPdfUploadList   = renderPdfUploadList;
  window.initTalentFilters     = initTalentFilters;
  window.applyTalentFilters    = applyTalentFilters;
  window.clearTalentFilters    = clearTalentFilters;
  window.setTalentTab          = setTalentTab;
  window.setTalentYear         = setTalentYear;
  window.buildTalentContent    = buildTalentContent;
  window.initTalentTabsForDept = initTalentTabsForDept;
  window.resetConcernForm      = resetConcernForm;
  window.submitConcernForm     = submitConcernForm;
  window.showChangeLog         = showChangeLog;
  window.fetchLiveConcerns     = fetchLiveConcerns;
  window.fetchAndRebuildKPI    = fetchAndRebuildKPI;
  window.govOpen               = govOpen;
  window.govClose              = govClose;
  window.govTab                = govTab;
  window.govRenderBody         = govRenderBody;
  window.parseSheetCSV         = parseSheetCSV;
  window.normDistrict          = normDistrict;
  window.parseCSVLine          = parseCSVLine;
  window.GOAL_DEPT_MAP         = GOAL_DEPT_MAP;
  window.barRows               = barRows;
  window.hrActionClass         = hrActionClass;
  window.buildPolicies         = buildPolicies;
  window.closePolicyModal      = closePolicyModal;
  window.goStep                = goStep;
  window._HR_BASE_LEN          = _HR_BASE_LEN;

  // Allow KPI_DATA reassignment to propagate to window
  // (fetchSheetKPI reassigns KPI_DATA via var; modules reading window.KPI_DATA
  //  will always get the latest value since we update window.KPI_DATA after each fetch)

  // ══════════════════════════════════════════════════════════════════════════
  //  DATA GOVERNANCE LOCK SYSTEM
  //  Amir's control layer. Works while he is away.
  //  Only data dept can control locks. All depts see notices if active.
  // ══════════════════════════════════════════════════════════════════════════
  const GOV_LOCK_KEY = 'njtc_gov_lock_v1';
  const GOV_LOCK_PANELS = [
    { id:'kpi',            label:'KPI Targets' },
    { id:'kpi-analytics',  label:'KPI Analytics' },
    { id:'pearl-ops',      label:'Pearl Operations' },
    { id:'sy-analytics',   label:'SY Site Analytics' },
    { id:'talent',         label:'Talent Analytics' },
    { id:'iready-lab',     label:'iReady Lab' },
    { id:'impact-report',  label:'Impact Report Builder' },
  ];

  function govLockGetState() {
    try {
      return JSON.parse(localStorage.getItem(GOV_LOCK_KEY)||'null') ||
             { enabled:false, message:'', lockedPanels:[], lockedAt:'', lockedBy:'' };
    } catch(e) { return { enabled:false, message:'', lockedPanels:[] }; }
  }

  window.govLockOpen = function() {
    const state = govLockGetState();
    const msgEl = document.getElementById('govLockMessage');
    if (msgEl) msgEl.value = state.message || '';
    const togglesEl = document.getElementById('govLockPanelToggles');
    if (togglesEl) {
      togglesEl.innerHTML = GOV_LOCK_PANELS.map(p => `
        <button class="gov-lock-panel-chip ${(state.lockedPanels||[]).includes(p.id)?'locked':''}"
          onclick="govLockTogglePanel('${p.id}',this)" data-id="${p.id}">
          ${(state.lockedPanels||[]).includes(p.id)?'🔒 ':'🔓 '}${p.label}
        </button>`).join('');
    }
    const modal = document.getElementById('govLockModal');
    if (modal) modal.style.display = 'flex';
  };

  window.govLockClose = function() {
    const modal = document.getElementById('govLockModal');
    if (modal) modal.style.display = 'none';
  };

  window.govLockTogglePanel = function(id, btn) {
    btn.classList.toggle('locked');
    const isLocked = btn.classList.contains('locked');
    btn.textContent = (isLocked ? '🔒 ' : '🔓 ') + GOV_LOCK_PANELS.find(p=>p.id===id)?.label;
  };

  window.govLockSave = function() {
    const message = (document.getElementById('govLockMessage')||{}).value || '';
    const locked  = [...document.querySelectorAll('.gov-lock-panel-chip.locked')].map(b => b.dataset.id);
    const state   = {
      enabled: message.trim() !== '' || locked.length > 0,
      message, lockedPanels: locked,
      lockedAt: new Date().toLocaleString('en-US', { month:'short', day:'numeric', year:'numeric', hour:'numeric', minute:'2-digit' }),
      lockedBy: 'Data & Evaluation'
    };
    localStorage.setItem(GOV_LOCK_KEY, JSON.stringify(state));
    govLockClose();
    govLockApplyState();
  };

  window.govLockClear = function() {
    localStorage.removeItem(GOV_LOCK_KEY);
    govLockClose();
    govLockApplyState();
  };

  function govLockApplyState() {
    const state = govLockGetState();
    if (!state.enabled) {
      document.querySelectorAll('.gov-lock-notice').forEach(el => el.remove());
      return;
    }
    state.lockedPanels.forEach(panelId => {
      const panel = document.getElementById('panel-'+panelId);
      if (!panel) return;
      let existing = panel.querySelector('.gov-lock-notice');
      if (!existing) {
        existing = document.createElement('div');
        existing.className = 'gov-lock-notice';
        panel.insertBefore(existing, panel.firstChild);
      }
      existing.innerHTML = `
        <div style="background:linear-gradient(135deg,#fff8e7,#fef3c7);border:1px solid #f59e0b;border-radius:12px;padding:1rem 1.25rem;margin-bottom:1.25rem;display:flex;gap:.875rem;align-items:flex-start">
          <span style="font-size:1.25rem;flex-shrink:0">🔒</span>
          <div style="flex:1">
            <div style="font-weight:700;color:#92400e;font-size:.9375rem;margin-bottom:.25rem">Data Governance Notice</div>
            <div style="font-size:.8125rem;color:#78350f;line-height:1.5">${state.message || 'This section is currently under data governance review.'}</div>
            <div style="font-size:.7rem;color:#92400e;margin-top:.375rem;opacity:.7">Locked by ${state.lockedBy} · ${state.lockedAt}</div>
          </div>
        </div>`;
    });
    const dept = (window.NJTC_SESSION||{}).dept||'';
    if (dept !== 'data') {
      state.lockedPanels.forEach(panelId => {
        const panel = document.getElementById('panel-'+panelId);
        if (panel) panel.querySelectorAll('[data-gov-lockable]').forEach(el => {
          el.style.filter = 'blur(2px)';
          el.style.pointerEvents = 'none';
        });
      });
    }
  }

  // Wire governance lock into showPanel
  (function(){
    const _origGovLock = window.showPanel;
    window.showPanel = function(id, btn) {
      if (typeof _origGovLock === 'function') _origGovLock(id, btn);
      govLockApplyState();
    };
  })();

  // Apply on boot
  setTimeout(govLockApplyState, 800);

  window.govLockOpen        = window.govLockOpen;
  window.govLockClose       = window.govLockClose;
  window.govLockSave        = window.govLockSave;
  window.govLockClear       = window.govLockClear;
  window.govLockTogglePanel = window.govLockTogglePanel;

  // ══════════════════════════════════════════════════════════════════════════
  //  PIE — Portal Intelligence Engine
  //  Contextual data assistant. Knows NJTC live data. Built for non-analysts.
  //  Available in every panel. Powered by Anthropic claude-sonnet-4-20250514.
  // ══════════════════════════════════════════════════════════════════════════
  (function() {
    let _pieOpen    = false;
    let _pieHistory = [];
    let _piePanel   = 'home';

    const PIE_SUGGESTIONS = {
      home:            ['What are our biggest goals this year?', 'Where are we falling short?', 'What should I know today?'],
      'kpi':           ['What does "Partially Met" mean?', 'Which goals are most at risk?', 'Who owns this target?'],
      'kpi-analytics': ['What is our overall score?', 'Which department needs the most help?', 'What does the weighted score mean?'],
      'pearl-ops':     ['What is Pearl?', 'What does a service interruption mean?', 'How do I read attendance data?'],
      'sy-analytics':  ['How many scholars are we serving?', 'What is a fee-for-service site?', 'Which sites need attention?'],
      'talent':        ['What is a PGP?', 'What does On Watch mean?', 'How are concerns tracked?'],
      'concern':       ['What happens after I submit a concern?', 'What is the difference between On Watch and a Write-Up?'],
      'iready-lab':    ['What is a scale score?', 'What does typical growth mean?', 'How do I read placement levels?'],
      'training-analytics': ['What is the TAP program?', 'How do I view apprentice progress?'],
      'policies':      ['Where is the HR handbook?', 'What are the data governance rules?'],
    };

    function _buildContext() {
      const dept   = (window.NJTC_SESSION||{}).dept || 'unknown';
      const cfg    = (window.DEPT_CONFIG||{})[dept] || {};
      const kpi    = window.KPI_DATA || [];
      const getS   = k => k.midStatus || k.status || '';
      const met    = kpi.filter(k=>getS(k)==='Met').length;
      const prog   = kpi.filter(k=>getS(k)==='In Progress').length;
      const partial= kpi.filter(k=>getS(k)==='Partially Met').length;
      const notmet = kpi.filter(k=>getS(k)==='Has Not Met').length;
      const pipe   = kpi.filter(k=>getS(k)==='Coming Down the Pipeline').length;
      const total  = kpi.length || 1;
      const score  = Math.round((met*1 + partial*.5 + prog*.25 + pipe*.1) / total * 100);
      const concerns  = (window.CONCERNS||[]).length;
      const onWatch   = (window.CONCERNS||[]).filter(r=>r.hr_action==='On Watch').length;
      const pgp       = (window.CONCERNS||[]).filter(r=>r.hr_action==='PGP').length;
      const term      = (window.CONCERNS||[]).filter(r=>r.hr_action&&r.hr_action.includes('Terminat')).length;
      let scholarCount = '—', siteCount = '—', siCount = '—';
      try {
        if (window.po && window.po.getStats) {
          const ps = window.po.getStats();
          scholarCount = ps.scholars || '—';
          siteCount    = ps.sites    || '—';
          siCount      = ps.si       || '—';
        }
      } catch(e) {}
      return `You are PIE — the Portal Intelligence Engine for New Jersey Tutoring Corps (NJTC).
You are embedded inside the NJTC Central Team Portal. You are a concise, knowledgeable,
friendly assistant who helps non-analytical staff understand what they are looking at.
You never make up numbers. You always cite the source of data when it matters.
You speak like a trusted colleague, not a chatbot. Short answers are usually better.

CURRENT SESSION:
- Department: ${dept} (${cfg.label || dept})
- Active panel: ${_piePanel}
- Today: April 2026 | SY 2025-2026

LIVE KPI SNAPSHOT (from Google Sheets KPI Dashboard):
- Total targets: ${total}
- Met: ${met} | In Progress: ${prog} | Partially Met: ${partial} | Not Met: ${notmet} | Pipeline: ${pipe}
- Weighted score: ${score}% (scoring: Met=1pt, Partial=.5pt, InProgress=.25pt, Pipeline=.1pt, NotMet=0)
- Health: ${score>=85?'Healthy (85%+)':score>=65?'Watch (65-84%)':score>=40?'Needs Focus (40-64%)':'Area of Support (<40%)'}

LIVE OPERATIONAL SNAPSHOT (Pearl / Program data):
- Scholars served: ${scholarCount}
- Active sites: ${siteCount}
- Service interruptions: ${siCount}

HR / WORKFORCE SNAPSHOT:
- Total documented concerns: ${concerns}
- On Watch: ${onWatch} | PGP: ${pgp} | Termination recommended: ${term}

ORGANIZATION:
NJTC is a New Jersey nonprofit that provides high-impact tutoring (HIT) across NJ school districts.
Staff includes central team (program managers, HR, finance, data, training), site leaders,
and tutors (certified and non-certified). Pearl is the operational platform for session tracking.
iReady is the academic diagnostic tool for scholar growth measurement.

RULES:
1. Never hallucinate data. If you don't know, say so and point them to the right panel.
2. Always be plain-English and brief. This person is not an analyst.
3. If they ask about a specific metric, explain what it means, then give the current number.
4. You are NOT a general AI assistant. Redirect off-topic questions back to NJTC work.
5. If they ask a question you can't answer from portal data, say: "That's a great question
   for Amir — submit a KPI Inquiry using the Ask a Question button in KPI Analytics."`;
    }

    window.pieInit = function(dept) {
      const container = document.getElementById('pieContainer');
      if (container) container.style.display = 'block';
      const deptLabel = document.getElementById('pieDeptLabel');
      const cfg = (window.DEPT_CONFIG||{})[dept] || {};
      if (deptLabel) deptLabel.textContent = cfg.label || dept;
      const welcomes = {
        kb:          `Hi — I'm PIE, your portal assistant. I have access to live NJTC data including KPI scores, program stats, and workforce numbers. What would you like to know?`,
        leadership:  `Good to see you. I'm PIE — I can explain what you're looking at anywhere in the portal, pull context from live data, or help you find information quickly.`,
        hr:          `Hey — I'm PIE. I know the HR data, concern pipeline, retention numbers, and what everything in this portal means. What do you need?`,
        programming: `I'm PIE, your portal guide. I can explain Pearl data, site metrics, tutor concerns — anything you're looking at. What's on your mind?`,
        training:    `I'm PIE. I know the T&D analytics, apprenticeship data, and what our training metrics mean. Ask me anything.`,
        data:        `PIE is live. You have full portal access — I'm here for quick context or to explain things for teammates. What do you need?`,
        finance:     `I'm PIE. I can help interpret funding goals, fee-for-service status, and financial KPIs. What are you looking at?`,
      };
      _pieAddMessage('pie', welcomes[dept] || welcomes.leadership);
      _pieSetSuggestions(_piePanel);
    };

    window.pieSetPanel = function(panelId) {
      _piePanel = panelId;
      _pieSetSuggestions(panelId);
    };

    window.pieToggle = function() {
      _pieOpen = !_pieOpen;
      const drawer = document.getElementById('pieDrawer');
      if (drawer) drawer.classList.toggle('open', _pieOpen);
      if (_pieOpen) {
        const input = document.getElementById('pieInput');
        if (input) setTimeout(() => input.focus(), 200);
      }
    };

    function _pieAddMessage(role, content) {
      const msgs = document.getElementById('pieMessages');
      if (!msgs) return;
      const div = document.createElement('div');
      div.className = `pie-msg ${role}`;
      div.innerHTML = role === 'pie'
        ? `<div class="pie-msg-avatar">PIE</div><div class="pie-msg-bubble">${content.replace(/\n/g,'<br>')}</div>`
        : `<div class="pie-msg-bubble">${content}</div>`;
      msgs.appendChild(div);
      msgs.scrollTop = msgs.scrollHeight;
      _pieHistory.push({ role: role === 'user' ? 'user' : 'assistant', content });
    }

    function _pieShowTyping() {
      const msgs = document.getElementById('pieMessages');
      if (!msgs) return;
      const div = document.createElement('div');
      div.id = 'pieTyping';
      div.className = 'pie-msg pie';
      div.innerHTML = `<div class="pie-msg-avatar">PIE</div><div class="pie-typing"><span></span><span></span><span></span></div>`;
      msgs.appendChild(div);
      msgs.scrollTop = msgs.scrollHeight;
    }

    function _pieRemoveTyping() {
      const t = document.getElementById('pieTyping');
      if (t) t.remove();
    }

    function _pieSetSuggestions(panelId) {
      const el = document.getElementById('pieSuggested');
      if (!el) return;
      const suggestions = PIE_SUGGESTIONS[panelId] || PIE_SUGGESTIONS.home;
      el.innerHTML = suggestions.map(s =>
        `<button class="pie-chip" onclick="pieAsk(${JSON.stringify(s)})">${s}</button>`
      ).join('');
    }

    window.pieAsk = function(question) {
      const input = document.getElementById('pieInput');
      if (input) input.value = question;
      pieSend();
    };

    window.pieSend = async function() {
      const input   = document.getElementById('pieInput');
      const sendBtn = document.getElementById('pieSendBtn');
      if (!input || !input.value.trim()) return;
      const userMsg = input.value.trim();
      input.value = '';
      input.style.height = 'auto';

      _pieAddMessage('user', userMsg);
      if (sendBtn) sendBtn.disabled = true;
      _pieShowTyping();

      const sugg = document.getElementById('pieSuggested');
      if (sugg) sugg.innerHTML = '';

      try {
        const systemContext = _buildContext();
        const historySlice  = _pieHistory.slice(-8);
        const messages      = [...historySlice, { role: 'user', content: userMsg }];

        const response = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 1000,
            system: systemContext,
            messages
          })
        });
        const data  = await response.json();
        const reply = data.content?.find(b => b.type === 'text')?.text ||
                      'I had trouble generating a response. Please try again.';
        _pieRemoveTyping();
        _pieAddMessage('pie', reply);
      } catch(e) {
        _pieRemoveTyping();
        _pieAddMessage('pie', 'Something went wrong on my end. Try again in a moment, or use the KPI Inquiry form to log your question for Amir.');
      }

      if (sendBtn) sendBtn.disabled = false;
      _pieSetSuggestions(_piePanel);
    };

    // Wire into showPanel to update PIE panel context
    const _origSP_pie = window.showPanel;
    window.showPanel = function(id, btn) {
      if (typeof _origSP_pie === 'function') _origSP_pie(id, btn);
      _piePanel = id;
      _pieSetSuggestions(id);
    };

    // Close PIE drawer when clicking outside
    document.addEventListener('click', function(e) {
      if (!e.target.closest('#pieContainer')) {
        const d = document.getElementById('pieDrawer');
        const trigger = document.getElementById('pieTrigger');
        if (d && d.classList.contains('open') && trigger && !trigger.contains(e.target)) {
          _pieOpen = false;
          d.classList.remove('open');
        }
      }
    });

  })();

})();
