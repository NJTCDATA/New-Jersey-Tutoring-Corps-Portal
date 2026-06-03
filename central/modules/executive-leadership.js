(function() {
    'use strict';

    var _audience   = 'governor';
    var _activeTab  = 'talking-points';
    var _execPeriod = 'sy'; // 'sy' | 'summer'
    var _cache      = {};
    var _retryTimer = null;
    var _retryCount = 0;
    var MAX_RETRY   = 4;

    // ── Audience definitions ──────────────────────────────────────
    var AUD = {
      governor:    { label:"Governor&#39;s Office",         tone:'policy',      intro:"NJTC is delivering on the Governor&#39;s education agenda — embedded tutoring at scale, closing achievement gaps district by district.",    cta:"Request a district briefing or site visit" },
      legislature: { label:"Legislature / Appropriations", tone:'fiscal',   intro:"Every appropriated dollar generates documented instructional hours, measurable student growth, and a trained educator pipeline.",          cta:"Review full accountability data and fiscal impact" },
      donor:       { label:"Philanthropic Donors",      tone:'impact',      intro:"NJTC turns philanthropic investment into documented student growth — tracked session by session, rated by students themselves.",             cta:"Schedule a site visit or scholar impact review" },
      partner:     { label:"District Partners",         tone:'operational', intro:"Your district&#39;s NJTC data — attendance rates, session delivery, scholar satisfaction — updated in real time.",                              cta:"Request a district-specific data pull" }
    };

    // ── Helpers ───────────────────────────────────────────────────
    function fmtN(n)  { return (n!=null && n!=='' ) ? Number(n).toLocaleString() : '—'; }
    function fmtP(n)  { return (n!=null) ? n+'%' : '—'; }
    function fmtD(n)  { if(n==null)return'—'; if(n>=1e6)return'$'+(n/1e6).toFixed(1)+'M'; if(n>=1e3)return'$'+Math.round(n/1e3)+'K'; return'$'+n.toLocaleString(); }
    function pill(s)  {
      var m={'met':'met','partially met':'partial','in progress':'progress','coming down the pipeline':'pipeline','has not met':'notmet'};
      var cls=m[(s||'').toLowerCase()]||'progress';
      var lbl={met:'Met',partial:'Partly Met',progress:'In Progress',pipeline:'Pipeline',notmet:'Not Met'};
      var ico={met:'&#10003;',partial:'&#8987;',progress:'&#8635;',pipeline:'&#8594;',notmet:'&#215;'};
      return '<span class="adv-status-pill '+cls+'">'+ico[cls]+' '+lbl[cls]+'</span>';
    }

    // ── Data readers ──────────────────────────────────────────────
    function getPo() {
      if (_cache.po !== undefined) return _cache.po;
      var d = null;
      try { if (window.po && window.po.getStats) d = window.po.getStats(); } catch(e) {}
      _cache.po = d;
      return d;
    }
    function getLD() {
      if (_cache.ld !== undefined) return _cache.ld;
      var d = null;
      try { if (window.po && window.po.getLeadershipData) d = window.po.getLeadershipData(); } catch(e) {}
      _cache.ld = d;
      return d;
    }
    function getKPI() {
      if (_cache.kpi !== undefined) return _cache.kpi;
      var rows = [];
      try {
        if (typeof window.advGetKPIData==='function') rows=window.advGetKPIData();
        if (!rows.length && typeof window.advGetKPIStatic==='function') rows=window.advGetKPIStatic();
      } catch(e) {}
      var met=[],partial=[],progress=[],notMet=[],pipeline=[];
      rows.forEach(function(k){
        var st=(k.midStatus||k.status||'').toLowerCase();
        if(st==='met') met.push(k);
        else if(st==='partially met') partial.push(k);
        else if(st==='in progress') progress.push(k);
        else if(st==='coming down the pipeline') pipeline.push(k);
        else if(st==='has not met') notMet.push(k);
      });
      _cache.kpi = {met:met,partial:partial,progress:progress,notMet:notMet,pipeline:pipeline,total:rows.length};
      return _cache.kpi;
    }
    function getIRL() {
      if (_cache.irl !== undefined) return _cache.irl;
      var d = null;
      try {
        if (window.irlab && window.irlab.getSummary) d = window.irlab.getSummary('ALL');
        if (!d) { var snap=window.irlab&&window.irlab.getSnapshot?window.irlab.getSnapshot():null; if(snap&&snap.summary) d=snap.summary; }
      } catch(e) {}
      _cache.irl = d;
      return d;
    }
    function getRace() {
      if (_cache.race !== undefined) return _cache.race;
      var d = null;
      try {
        var irl=getIRL();
        if (irl&&irl.scholarRace&&Object.keys(irl.scholarRace).length) {
          var tot=Object.values(irl.scholarRace).reduce(function(s,v){return s+v;},0);
          d={byScholar:irl.scholarRace,totalScholars:tot};
        }
        if (!d && window.po && window.po.getRaceData) d=window.po.getRaceData();
      } catch(e) {}
      _cache.race = d;
      return d;
    }
    function getStella() {
      if (_cache.stellar !== undefined) return _cache.stellar;
      var d = [];
      try { if (window.po && window.po.getStellarSchools) d=window.po.getStellarSchools(); } catch(e) {}
      _cache.stellar = d;
      return d;
    }
    function getSyaSites() {
      if (_execPeriod === 'summer') {
        // Summer: derive from onsite tracker rows
        var rows = (window.NJTC_ONSITE_TRACKER || []).filter(function(r){ return r.isSummer; });
        var sites = new Set(rows.filter(function(r){ return r.location; }).map(function(r){ return r.location; }));
        var districts = new Set(rows.filter(function(r){ return r.district || r.county; }).map(function(r){ return r.district || r.county; }));
        return { sites: sites.size || null, districts: districts.size || null, isSummer: true };
      }
      // SY: read directly from Pearl stats (avoids picking up summer DOM values)
      var po = getPo();
      return { sites: (po && po.schoolCount) || null, districts: (po && po.districtCount) || null };
    }

    function getSummerHeadcount() {
      var rows = (window.NJTC_ONSITE_TRACKER || []).filter(function(r){
        return r.isSummer && r.isActive && !r.isPreApp && !r.isTerminated;
      });
      return rows.length || null;
    }

    // ── Check if Pearl data is loaded ─────────────────────────────
    function pearlLoaded() {
      var po=getPo(); return po && po.loaded;
    }

    // ── Auto-retry until Pearl loads ──────────────────────────────
    function _scheduleRetry() {
      if (_retryCount >= MAX_RETRY) return;
      _retryCount++;
      _retryTimer = setTimeout(function() {
        _cache = {};  // flush cache
        var loaded = pearlLoaded();
        buildLeadershipBanner();
        if (_activeTab === 'talking-points') buildTalkingPoints();
        if (!loaded && _retryCount < MAX_RETRY) _scheduleRetry();
      }, _retryCount <= 1 ? 800 : _retryCount <= 3 ? 1500 : 2500);
    }

    // ── Period toggle for exec banner ─────────────────────────────
    function _execPeriodToggleHTML() {
      var isSummer = _execPeriod === 'summer';
      var base = 'display:inline-flex;align-items:center;gap:.25rem;padding:.25rem .65rem;border-radius:1rem;font-size:.72rem;font-weight:600;cursor:pointer;border:none;';
      var sy  = base + (isSummer ? 'background:rgba(255,255,255,.12);color:rgba(255,255,255,.55);' : 'background:#fff;color:#1e40af;');
      var sum = base + (isSummer ? 'background:#fbbf24;color:#1e3a5f;'                             : 'background:rgba(255,255,255,.12);color:rgba(255,255,255,.55);');
      return '<div style="display:flex;align-items:center;gap:.5rem;margin-top:.35rem">'+
        '<button style="'+sy+'" onclick="window._execSetPeriod(\'sy\')">&#127979; SY 2025-2026</button>'+
        '<button style="'+sum+'" onclick="window._execSetPeriod(\'summer\')">&#9728; Summer 2026</button>'+
        (isSummer ? '<span style="font-size:.64rem;color:#fbbf24;opacity:.85">&#128247; Snapshot &mdash; programs in progress</span>' : '')+
      '</div>';
    }

    window._execSetPeriod = function(p) {
      if (_execPeriod === p) return;
      _execPeriod = p;
      _cache = {};
      buildLeadershipBanner();
      if (_activeTab === 'impact-snapshot') buildSnapshot();
      if (_activeTab === 'talking-points')  buildTalkingPoints();
    };

    // ── LEADERSHIP BANNER ─────────────────────────────────────────
    // Shows rich multi-metric stats strip — auto-loads without visiting other panels
    function buildLeadershipBanner() {
      var el = document.getElementById('advLeadershipBanner'); if (!el) return;
      var sya = getSyaSites();
      var isSummer = _execPeriod === 'summer';

      var chips = [];

      if (isSummer) {
        // ── SUMMER MODE: tracker-based snapshot, no Pearl/iReady/concerns ──
        var sumStaff = getSummerHeadcount();
        if (sya.sites)  chips.push({ico:'&#9728;', col:'#fef3c7',txt:''+sya.sites,sub:'Summer Sites'+(sya.districts?' · '+sya.districts+' Districts':'')});
        if (sumStaff)   chips.push({ico:'&#129489;&#8205;&#127979;',col:'#e0e7ff',txt:''+sumStaff,sub:'Active Onsite Staff'});
        chips.push({ico:'&#128247;',col:'#f0fdf4',txt:'Snapshot',sub:'Live Pearl data begins in fall'});
        chips.push({ico:'&#128201;',col:'#f3f4f6',txt:'—',sub:'iReady (not yet active)'});
        chips.push({ico:'&#127919;',col:'#f3f4f6',txt:'—',sub:'KPI Goals (SY 25-26 final)'});
      } else {
        var po  = getPo();
        var ld  = getLD();
        var kpi = getKPI();
        var irl = getIRL();
        var st  = getStella();

        // ── SCALE ──
        if (sya.sites)     chips.push({ico:'&#127960;',col:'#e0e7ff',txt:''+sya.sites,sub:'School Sites'+(sya.districts?' · '+sya.districts+' Districts':'')});
        if (po&&po.sessions)chips.push({ico:'&#9200;', col:'#dcfce7',txt:fmtN(po.sessions),sub:'Sessions Delivered'});
        var _hrActiveCt = (window._hrDataFetched && typeof HR_EMPS!=='undefined'&&HR_EMPS.length) ? HR_EMPS.filter(function(e){return e.s==='Active';}).length : (po?po.activeTutors:null);
        if (_hrActiveCt) chips.push({ico:'&#129489;&#8205;&#127979;',col:'#fef3c7',txt:''+_hrActiveCt,sub:'Active Onsite Staff'});

        // ── ATTENDANCE ──
        if (po&&po.instAttPct!=null) {
          var iCol = po.instAttPct>=90?'#dcfce7':po.instAttPct>=80?'#dbeafe':'#fee2e2';
          chips.push({ico:'&#127941;',col:iCol,txt:fmtP(po.instAttPct),sub:'Tutor Attendance'});
        }
        if (po&&po.scholAttPct!=null) {
          var sCol = po.scholAttPct>=80?'#dcfce7':po.scholAttPct>=70?'#dbeafe':'#fef3c7';
          chips.push({ico:'&#128218;',col:sCol,txt:fmtP(po.scholAttPct),sub:'Scholar Attendance'});
        }
        if (po&&po.surveyAvg!=null) chips.push({ico:'&#11088;',col:'#fef3c7',txt:''+po.surveyAvg+'/5',sub:'Scholar Survey'});

        // ── SCHOLAR TIERS (from getLeadershipData) ──
        if (ld) {
          var tot=(ld.scholarOnTrack||0)+(ld.scholarAtRisk||0)+(ld.scholarNeedsAction||0);
          if (tot>0) {
            chips.push({ico:'&#128200;',col:'#dcfce7',txt:''+ld.scholarOnTrack,sub:'Scholars On Track (80%+ att.)'});
            if (ld.scholarAtRisk>0)      chips.push({ico:'&#9888;',col:'#fef3c7',txt:''+ld.scholarAtRisk,sub:'At Risk (70-79%)'});
            if (ld.scholarNeedsAction>0) chips.push({ico:'&#128680;',col:'#fee2e2',txt:''+ld.scholarNeedsAction,sub:'Needs Action (<70%)'});
          }
        }

        // ── KPI ──
        if (kpi.total>0) {
          var kPct=Math.round(kpi.met.length/kpi.total*100);
          var kCol=kPct>=70?'#dcfce7':kPct>=40?'#dbeafe':'#fef3c7';
          chips.push({ico:'&#127919;',col:kCol,txt:kpi.met.length+'/'+kpi.total,sub:'Goals Met Mid-Year ('+kPct+'%)'});
          if (kpi.partial.length) chips.push({ico:'&#8987;',col:'#fef3c7',txt:''+kpi.partial.length,sub:'Goals Partially Met'});
        }

        // ── iREADY ──
        if (irl&&irl.growthPct!=null) {
          var irlSY=irl.activeSY||'Historical';
          if (irl.mathAvgGain!==null&&(irl.mathMedianPctAllYears!=null?irl.mathMedianPctAllYears:irl.mathMedianPctTypical)!=null) {
            var _mPct=irl.mathMedianPctAllYears!=null?irl.mathMedianPctAllYears:irl.mathMedianPctTypical;
            var mCol=_mPct>=100?'#dcfce7':_mPct>=70?'#ede9fe':'#fef3c7';
            chips.push({ico:'&#10133;',col:mCol,
              txt:'+'+irl.mathAvgGain+' pts · '+(irl.mathMedianPctAllYears!=null?irl.mathMedianPctAllYears:irl.mathMedianPctTypical)+'%',
              sub:'Math Growth · Median % to Typical ('+irlSY+')',
              key:'irl-math'});
          }
          if (irl.elaAvgGain!==null&&(irl.elaMedianPctAllYears!=null?irl.elaMedianPctAllYears:irl.elaMedianPctTypical)!=null) {
            var _ePct=irl.elaMedianPctAllYears!=null?irl.elaMedianPctAllYears:irl.elaMedianPctTypical;
            var eCol=_ePct>=100?'#dcfce7':_ePct>=70?'#ede9fe':'#fef3c7';
            chips.push({ico:'&#128217;',col:eCol,
              txt:'+'+irl.elaAvgGain+' pts · '+(irl.elaMedianPctAllYears!=null?irl.elaMedianPctAllYears:irl.elaMedianPctTypical)+'%',
              sub:'ELA Growth · Median % to Typical ('+irlSY+')',
              key:'irl-ela'});
          }
          if (irl.mathAvgGain===null&&irl.elaAvgGain===null) {
            chips.push({ico:'&#128201;',col:'#ede9fe',txt:fmtP(irl.growthPct),sub:'iReady Growth ('+irlSY+')'});
          }
        } else {
          chips.push({ico:'&#128200;',col:'#f3f4f6',txt:'—',sub:'iReady Live Data'});
        }

        // ── SERVICE INTERRUPTIONS ──
        if (po&&po.siCount!=null) chips.push({ico:'&#128203;',col:'#f0fdf4',txt:fmtN(po.siCount),sub:'Service Interruptions Logged'});

        // ── TOP STELLAR SCHOOL ──
        if (st&&st[0]) chips.push({ico:'&#127941;',col:'#fef3c7',txt:st[0].attRate+'%',sub:st[0].school.length>22?st[0].school.substring(0,22)+'…':st[0].school});

        // ── ABSENCE DRIVERS ──
        if (ld&&ld.absenceDrivers&&ld.absenceDrivers.controllable&&ld.absenceDrivers.controllable.total>0) {
          chips.push({ico:'&#128683;',col:'#fee2e2',txt:fmtN(ld.absenceDrivers.controllable.total),sub:'Controllable Absences'});
        }
      }

      var pearlOk = !isSummer && getPo() && getPo().loaded;
      el.innerHTML = '<div class="adv-leader-banner">'+
        '<div class="adv-leader-banner-title">'+
          (isSummer ? '&#9728; Summer 2026 &mdash; Program Snapshot' : '&#9889; Live Program Highlights')+
          ' &nbsp;<span style="font-size:.67rem;font-weight:400;color:rgba(255,255,255,.55)">'+
            (isSummer ? 'TRACKER · SNAPSHOT IN TIME' : 'AUTO-LOADED &middot; PEARL + KPI + iREADY')+
          '</span>'+
          (!isSummer && !pearlOk ? ' <span style="font-size:.65rem;color:#fbbf24;margin-left:.5rem">&#8635; Loading Pearl data&hellip;</span>' : '')+
        '</div>'+
        _execPeriodToggleHTML()+
        '<div class="adv-leader-stats-row">'+
          chips.map(function(c){
            var extra = c.key ? ' data-chip-key="'+c.key+'" onclick="advOpenChipDetail(\''+c.key+'\')" style="background:'+c.col+';cursor:pointer;transition:box-shadow .15s" onmouseenter="this.style.boxShadow=\'0 0 0 2px #6366f1\'" onmouseleave="this.style.boxShadow=\'\'"' : ' style="background:'+c.col+'"';
            return '<div class="adv-leader-stat-chip"'+extra+'>'+
              '<div style="font-size:1rem;flex-shrink:0">'+c.ico+'</div>'+
              '<div style="min-width:0">'+
                '<div style="font-weight:800;font-size:.95rem;color:#1e293b;line-height:1.1">'+c.txt+(c.key ? ' <span style="font-size:.58rem;color:#6366f1;opacity:.8;vertical-align:middle">ⓘ</span>' : '')+'</div>'+
                '<div style="font-size:.63rem;color:#475569;line-height:1.3;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:130px">'+c.sub+'</div>'+
              '</div>'+
            '</div>';
          }).join('')+
        '</div>'+
      '</div>';
    }

    // Exposed for _notifyLeadershipReady to call
    window.advRefreshBanner = function() {
      _cache.po=undefined; _cache.ld=undefined; _cache.stellar=undefined; _cache.irl=undefined; _cache.race=undefined;
      buildLeadershipBanner();
      if (_activeTab==='talking-points') { _cache.po=undefined; _cache.irl=undefined; buildTalkingPoints(); }
    };

    // ── TALKING POINTS ────────────────────────────────────────────
    function buildTalkingPoints() {
      var po  = getPo();
      var ld  = getLD();
      var kpi = getKPI();
      var irl = getIRL();
      var sya = getSyaSites();
      var st  = getStella();
      var aud = AUD[_audience] || AUD.governor;
      var tone= aud.tone;
      var grid= document.getElementById('advTpGrid');
      var ldg = document.getElementById('advTpLoading');
      if (!grid) return;

      // Audience intro
      var intro=document.getElementById('advAudienceIntro');
      if (intro) {
        intro.innerHTML='<div class="adv-audience-intro">'+
          '<span class="adv-audience-tag">&#127919; Framing for: '+aud.label+'</span>'+
          '<p>'+aud.intro+'</p>'+
          '<div class="adv-audience-cta">&#128205; Suggested CTA: '+aud.cta+'</div>'+
        '</div>';
      }

      var cards = [];
      var poOk = po && po.loaded;

      // ── 1. SCALE & REACH ──
      if (sya.sites || sya.districts) {
        var scFrames = {
          policy:      'NJTC reaches '+(sya.sites||'dozens of')+' school sites across '+(sya.districts||'multiple')+' New Jersey districts — embedded within the school day, requiring no transportation from families.',
          fiscal:      fmtN(po&&po.sessions)+' sessions across '+(sya.sites||'—')+' sites in '+(sya.districts||'—')+' districts. Cost-per-session competes with any tutoring model in the state.',
          impact:      'From the first bell to the last, NJTC tutors are inside '+(sya.sites||'—')+' schools across '+(sya.districts||'—')+' districts — part of the school day, not a logistical burden.',
          operational: 'Your district is part of a '+(sya.sites||'—')+'-site, '+(sya.districts||'—')+'-district network. All data flows into Pearl in real time.'
        };
        cards.push({color:'blue',label:'Scale & Reach',
          headline:(sya.sites||'—')+' school sites · '+(sya.districts||'—')+' districts · SY 2025-26',
          body:scFrames[tone]||scFrames.policy, source:'SY Analytics · Live Google Sheet'});
      }

      // ── 2. TUTOR RELIABILITY ──
      if (po&&po.instAttPct!=null) {
        var iTxt = fmtP(po.instAttPct);
        var iFrames = {
          policy:      iTxt+' instructor attendance — tutors show up reliably, building the consistent relationships research shows drive academic gains.',
          fiscal:      'The state&#39;s investment is protected by a '+iTxt+' tutor attendance rate. Funded sessions are delivered, not forfeited.',
          impact:      'Tutors show up '+iTxt+' of the time — scholars see the same face every session, building trust that translates directly to academic progress.',
          operational: iTxt+' tutor attendance. Pearl flags absences in real time so coordinators respond same day.'
        };
        cards.push({color:'gold',label:'Tutor Reliability',
          headline:iTxt+' tutor attendance rate — consistent instructors, consistent results',
          body:iFrames[tone]||iFrames.policy, source:'Pearl Instructor Attendance · Live Google Sheet'});
      }

      // ── 3. SCHOLAR ENGAGEMENT ──
      if (po&&po.scholAttPct!=null) {
        var sTxt = fmtP(po.scholAttPct);
        var sFrames = {
          policy:      sTxt+' scholar attendance — students prioritize tutoring because it&#39;s inside their school day. No family logistics required.',
          fiscal:      'Public investment validated: '+sTxt+' scholar attendance shows the model earns engagement, not just enrollment.',
          impact:      sTxt+' of scholars attended their sessions. They chose to be there — embedded delivery removes every excuse not to.',
          operational: sTxt+' scholar attendance. Pearl tracks every session so chronic absence is caught early.'
        };
        cards.push({color:'blue',label:'Scholar Engagement',
          headline:sTxt+' scholar attendance — students show up because it works',
          body:sFrames[tone]||sFrames.policy, source:'Pearl Scholar Attendance · Live Google Sheet'});
      }

      // ── 4. SCHOLAR PERFORMANCE TIERS ──
      if (ld && ((ld.scholarOnTrack||0)+(ld.scholarAtRisk||0)+(ld.scholarNeedsAction||0))>0) {
        var total=(ld.scholarOnTrack||0)+(ld.scholarAtRisk||0)+(ld.scholarNeedsAction||0);
        var onTrkPct=total>0?Math.round(ld.scholarOnTrack/total*100):0;
        var tFrames = {
          policy:      fmtN(ld.scholarOnTrack)+' of '+fmtN(total)+' active scholars ('+onTrkPct+'%) are On Track — 80%+ attendance. '+fmtN(ld.scholarAtRisk)+' At Risk and '+fmtN(ld.scholarNeedsAction)+' requiring targeted intervention are already flagged for follow-up.',
          fiscal:      'NJTC does not just deliver sessions — it tracks scholar performance. '+fmtN(ld.scholarOnTrack)+' scholars are On Track (80%+ attendance), with '+fmtN(ld.scholarAtRisk)+' At Risk identified in real time for intervention.',
          impact:      'Of '+fmtN(total)+' active scholars, '+fmtN(ld.scholarOnTrack)+' are On Track with 80%+ attendance. Another '+fmtN(ld.scholarAtRisk)+' are At Risk — already identified and receiving targeted support.',
          operational: 'Performance tiers in your schools: '+fmtN(ld.scholarOnTrack)+' On Track · '+fmtN(ld.scholarAtRisk)+' At Risk · '+fmtN(ld.scholarNeedsAction)+' Needs Action. Pearl updates these in real time.'
        };
        cards.push({color:'green',label:'Scholar Performance Tiers',
          headline:fmtN(ld.scholarOnTrack)+' scholars On Track · '+fmtN(ld.scholarAtRisk)+' At Risk · '+fmtN(ld.scholarNeedsAction)+' Needs Action',
          body:tFrames[tone]||tFrames.policy, source:'Pearl Attendance Tiers · Live (80/70% thresholds)'});
      }

      // ── 5. SESSIONS DELIVERED ──
      if (po&&po.sessions!=null) {
        var sessMins = Math.round(po.sessions*45);
        var sessHrs  = Math.round(sessMins/60).toLocaleString();
        var sFrames2 = {
          policy:      fmtN(po.sessions)+' documented tutoring sessions — each tracked, timestamped, and attributable to a specific school, scholar, and tutor.',
          fiscal:      fmtN(po.sessions)+' sessions × 45 min avg = ~'+sessHrs+' instructional hours delivered. That is your appropriation at work.',
          impact:      fmtN(po.sessions)+' moments of one-on-one instructional attention — each connected to a scholar&#39;s academic trajectory.',
          operational: fmtN(po.sessions)+' sessions delivered and logged. Pearl captures subject, attendance, and duration for every session.'
        };
        cards.push({color:'green',label:'Program Delivery',
          headline:fmtN(po.sessions)+' tutoring sessions delivered — SY 2025-26',
          body:sFrames2[tone]||sFrames2.policy, source:'Pearl Session Details · Live Google Sheet'});
      }

      // ── 6. SCHOLAR EXPERIENCE (SURVEY) ──
      if (po&&po.surveyAvg!=null) {
        var svFrames = {
          policy:      '&#9733; '+po.surveyAvg+'/5.0 on post-session surveys — scholars report gains in confidence, learning, and enjoyment. Student voice data confirms the model is working.',
          fiscal:      'Beyond attendance: scholars rate sessions '+po.surveyAvg+'/5.0 for confidence, learning, and enjoyment. State investment is producing satisfied, engaged students.',
          impact:      'Ask any scholar: '+po.surveyAvg+'/5.0 average. They rate sessions on confidence, on what they learned, on whether they enjoyed it. The numbers say they are thriving.',
          operational: 'Scholar survey results: '+po.surveyAvg+'/5.0 average. School-level breakdowns available on request from the Data team.'
        };
        cards.push({color:'purple',label:'Scholar Experience',
          headline:'&#9733; '+po.surveyAvg+'/5.0 scholar satisfaction — confidence, learning & enjoyment',
          body:svFrames[tone]||svFrames.policy, source:'Pearl Scholar Survey · Live Google Sheet'});
      }

      // ── 7. DISTRICT HIGHLIGHT (top district by scholar att) ──
      if (ld&&ld.districts&&ld.districts.length) {
        var topDist=null, topRate=0;
        ld.districts.forEach(function(d){ if(d.scholarRate>topRate){topRate=d.scholarRate;topDist=d;} });
        if (topDist && topDist.scholars>0) {
          var dFrames = {
            policy:      topDist.name+' leads all NJTC districts with '+topDist.scholarRate+'% scholar attendance across '+topDist.scholars+' active scholars and '+topDist.sessions+' sessions delivered.',
            fiscal:      'Per-district accountability: '+topDist.name+' — '+topDist.scholarRate+'% scholar att., '+topDist.tutorRate+'% tutor att., '+topDist.sessions+' sessions. Every district is tracked independently.',
            impact:      topDist.name+'&#39;s '+topDist.scholars+' scholars are attending at a '+topDist.scholarRate+'% rate. This is what sustained district partnership looks like.',
            operational: 'Your top-performing district this period: '+topDist.name+' — '+topDist.scholarRate+'% scholar attendance, '+topDist.sessions+' sessions, '+topDist.scholars+' scholars served.'
          };
          cards.push({color:'blue',label:'Top District Performance',
            headline:topDist.name+' — '+topDist.scholarRate+'% scholar attendance · '+topDist.sessions+' sessions',
            body:dFrames[tone]||dFrames.policy, source:'Pearl District Breakdown · Live Google Sheet'});
        }
      }

      // ── 8. ACADEMIC OUTCOMES (iReady) ──
      if (irl) {
        var irlSY=irl.activeSY||'Historical';
        var has2526=irl.hasCurrentYearData;
        if (irl.growthPct!=null) {
          var note=has2526?'':' &#9432; '+irlSY+' data shown — 2025-26 pending Data team upload.';
          var hasGainData = (irl.mathAvgGain!==null&&irl.mathAvgGain!==undefined)||(irl.elaAvgGain!==null&&irl.elaAvgGain!==undefined);
          var irlHeadline, iFrames2;
          if (hasGainData) {
            var _mMed=irl.mathMedianPctAllYears!=null?irl.mathMedianPctAllYears:irl.mathMedianPctTypical;
            var _eMed=irl.elaMedianPctAllYears!=null?irl.elaMedianPctAllYears:irl.elaMedianPctTypical;
            var mStr = (irl.mathAvgGain!=null&&_mMed!=null) ? 'Math: +'+irl.mathAvgGain+' pts ('+_mMed+'% median to typical)' : '';
            var eStr = (irl.elaAvgGain!=null&&_eMed!=null)   ? 'ELA: +'+irl.elaAvgGain+' pts ('+_eMed+'% median to typical)'   : '';
            var gainSummary = [mStr,eStr].filter(Boolean).join(' · ');
            irlHeadline = gainSummary + (has2526?'':' ('+irlSY+')');
            iFrames2 = {
              policy:      'NJTC scholars averaged measurable scale score gains against iReady\'s national typical growth benchmark ('+irlSY+'). '+gainSummary+'. '+fmtN(irl.totalRows)+' scholar records. Independent, nationally normed data.',
              fiscal:      'iReady — the same diagnostic tool districts use — confirms scholar progress ('+irlSY+'): '+gainSummary+'. '+fmtP(irl.growthPct)+' of scholars showed measurable growth. Public funds produce verifiable academic movement.',
              impact:      gainSummary+'. iReady\'s own benchmark defines what a full year of growth looks like — NJTC scholars are meeting or approaching that standard. '+fmtN(irl.totalRows)+' scholars. '+irlSY+'.',
              operational: 'iReady results ('+irlSY+'): '+gainSummary+'. '+fmtP(irl.growthPct)+' of scholars showed positive gains. Cross-reference with your district iReady data to validate NJTC&#39;s contribution.'
            };
          } else {
            var bySubj = '';
            if (irl.mathGrowthPct!=null&&irl.elaGrowthPct!=null) bySubj=' Math: '+irl.mathGrowthPct+'% · ELA: '+irl.elaGrowthPct+'%.';
            irlHeadline = fmtP(irl.growthPct)+'% iReady growth rate — '+fmtN(irl.totalRows)+' records'+(has2526?'':' ('+irlSY+')');
            iFrames2 = {
              policy:      fmtP(irl.growthPct)+' of scholars show measurable iReady growth ('+irlSY+') — '+fmtN(irl.totalWithGrowth)+' of '+fmtN(irl.totalRows)+' records.'+bySubj+' Independent, nationally normed data.',
              fiscal:      'iReady — the same diagnostic tool districts use — shows '+fmtP(irl.growthPct)+' growth ('+irlSY+').'+bySubj+' Public funds produce verifiable academic movement, not just contact hours.',
              impact:      fmtP(irl.growthPct)+' of scholars show measurable iReady growth.'+bySubj+' '+fmtN(irl.totalWithGrowth)+' children moved forward. That is the number.',
              operational: 'iReady results ('+irlSY+'): '+fmtP(irl.growthPct)+' growth.'+bySubj+' Cross-reference with your district iReady data to validate NJTC&#39;s contribution.'
            };
          }
          cards.push({color:'green',label:'Academic Outcomes (iReady)',
            headline: irlHeadline,
            body:(iFrames2[tone]||iFrames2.policy)+note,
            source:'iReady Longitudinal Dashboard · '+irlSY+' · '+fmtN(irl.totalRows)+' records'});
        } else {
          cards.push({color:'gold',label:'Academic Outcomes',
            headline:'&#9432; iReady Live — Growth Rates Not Yet Calculable',
            body:'iReady data is active in the live feed ('+irlSY+') but growth rate calculations are not yet available for this period — likely awaiting a second diagnostic window. Visit the iReady Analysis Lab for the current diagnostic breakdown and placement levels.',
            source:'iReady Longitudinal Live Feed &middot; i-Ready Lab panel'});
        }
      } else {
        cards.push({color:'gold',label:'Academic Outcomes',
          headline:'&#9432; iReady Live Data Not Yet Available',
          body:'iReady 2025-26 results will appear here automatically once the longitudinal live feed is updated. No action needed — data refreshes live when the feed is populated.',
          source:'iReady Longitudinal Live Feed &middot; i-Ready Analysis Lab'});
      }

      // ── 9. KPI ORGANIZATIONAL HEALTH ──
      if (kpi.total>0) {
        var metEx=kpi.met.slice(0,2).map(function(k){var t=k.target||'';return t.substring(0,55)+(t.length>55?'…':'');}).join('; ');
        var kFrames={
          policy:      kpi.met.length+' of '+kpi.total+' annual goals Met at mid-year. Organizational health is strong — NJTC is hitting targets, not just delivering sessions. Goals Met include: '+metEx,
          fiscal:      'Mid-year KPI: '+kpi.met.length+' goals Met, '+kpi.partial.length+' Partially Met, '+kpi.progress.length+' In Progress. Every appropriated dollar tracked against a measurable annual target.',
          impact:      kpi.met.length+' goals already fully achieved with the school year still underway. The operational foundation your gift builds is performing.',
          operational: kpi.met.length+'/'+kpi.total+' goals Met at mid-year. Your district&#39;s outcomes contribute to NJTC&#39;s organization-wide accountability framework.'
        };
        cards.push({color:'blue',label:'Organizational Health',
          headline:kpi.met.length+' of '+kpi.total+' annual KPI goals already Met at mid-year',
          body:kFrames[tone]||kFrames.policy, source:'KPI Dashboard · Live Google Sheet · Mid-Year SY 2025-26'});
      }

      // ── 10. ACCOUNTABILITY / TRANSPARENCY (legislature + partner only) ──
      if (po&&po.siCount!=null&&(tone==='fiscal'||tone==='operational')) {
        cards.push({color:'gold',label:'Accountability & Transparency',
          headline:fmtN(po.siCount)+' service interruptions documented — real-time accountability',
          body: tone==='fiscal'
            ? 'NJTC tracks every non-delivery event in Pearl in real time. Appropriators can audit actual delivery vs. planned delivery with session-level precision.'
            : 'Your district office can request a full interruption log at any time. Pearl captures reason codes for every missed session.',
          source:'Pearl Service Interruption Tracking · Live Google Sheet'});
      }

      // ── 11. ABSENCE DRIVERS (operational/fiscal) ──
      if (ld&&ld.absenceDrivers&&(tone==='fiscal'||tone==='operational')) {
        var ctrl=ld.absenceDrivers.controllable;
        var uctrl=ld.absenceDrivers.uncontrollable;
        if (ctrl.total>0||uctrl.total>0) {
          var abBody = 'Of '+fmtN(ctrl.total+uctrl.total)+' missed sessions: '+fmtN(ctrl.total)+' controllable ('+
            (ctrl.reasons||[]).slice(0,2).map(function(r){return r.label+' ('+r.count+')';}).join(', ')+
            '), '+fmtN(uctrl.total)+' uncontrollable (school closures, testing, etc.).';
          cards.push({color:'gold',label:'Absence Driver Analysis',
            headline:'Absence drivers categorized — '+fmtN(ctrl.total)+' controllable · '+fmtN(uctrl.total)+' uncontrollable',
            body:abBody, source:'Pearl Absence Reason Codes · Live Google Sheet'});
        }
      }

      if (ldg) ldg.style.display='none';
      if (!poOk&&!cards.length) {
        if (ldg) { ldg.style.display='block'; ldg.textContent='Pearl data loading — please wait a moment…'; }
      }

      grid.innerHTML = cards.map(function(c){
        return '<div class="adv-tp-card '+c.color+'">'+
          '<div class="adv-tp-label">'+c.label+'</div>'+
          '<div class="adv-tp-headline">'+c.headline+'</div>'+
          '<div class="adv-tp-body">'+c.body+'</div>'+
          '<div class="adv-tp-source">&#128204; '+c.source+'</div>'+
        '</div>';
      }).join('');
    }

    // ── IMPACT SNAPSHOT ───────────────────────────────────────────
    function buildSnapshot() {
      var el=document.getElementById('advSnapGrid'); if(!el) return;
      var sya=getSyaSites();
      var isSummer = _execPeriod === 'summer';
      var snaps=[];

      // Period toggle above the grid
      var toggleEl = document.getElementById('advSnapToggle');
      if (toggleEl) toggleEl.innerHTML = _execPeriodToggleHTML();

      if (isSummer) {
        var sumStaff = getSummerHeadcount();
        if (sya.sites)  snaps.push({n:sya.sites,l:'Summer Sites',s:'Tracker'});
        if (sya.districts) snaps.push({n:sya.districts,l:'Districts',s:'Tracker'});
        if (sumStaff)   snaps.push({n:sumStaff,l:'Active Onsite Staff',s:'Tracker'});
        snaps.push({n:'—',l:'Sessions Delivered',s:'Pearl begins fall'});
        snaps.push({n:'—',l:'iReady Growth',s:'Not yet active'});
        snaps.push({n:'—',l:'Scholar Concerns',s:'Not yet active'});
        el.innerHTML=snaps.map(function(sn){return'<div class="adv-snap-stat"><div class="adv-snap-num">'+sn.n+'</div><div class="adv-snap-lbl">'+sn.l+'</div><div style="font-size:.62rem;color:var(--muted)">'+sn.s+'</div></div>';}).join('');
        var kwEl=document.getElementById('advSnapKPIWins'); if(kwEl) kwEl.innerHTML='';
        return;
      }

      var po=getPo(); var kpi=getKPI(); var irl=getIRL(); var ld=getLD();
      if(sya.sites)         snaps.push({n:sya.sites,l:'Active School Sites',s:'SY 25-26 · Pearl'});
      if(sya.districts)     snaps.push({n:sya.districts,l:'Districts Served',s:'SY 25-26 · Pearl'});
      if(po&&po.sessions)   snaps.push({n:fmtN(po.sessions),l:'Sessions Delivered',s:'Pearl'});
      var _hrSnap=(typeof HR_EMPS!=='undefined'&&HR_EMPS.length)?HR_EMPS.filter(function(e){return e.s==='Active';}).length:(po?po.activeTutors:null);
      if(_hrSnap)           snaps.push({n:_hrSnap,l:'Active Tutors',s:'HR Roster'});
      if(po&&po.instAttPct!=null) snaps.push({n:po.instAttPct+'%',l:'Tutor Attendance Rate',s:'Pearl'});
      if(po&&po.scholAttPct!=null) snaps.push({n:po.scholAttPct+'%',l:'Scholar Attendance Rate',s:'Pearl'});
      if(po&&po.surveyAvg!=null) snaps.push({n:'&#9733; '+po.surveyAvg,l:'Scholar Survey (of 5)',s:'Pearl'});
      if(po&&po.siCount!=null) snaps.push({n:fmtN(po.siCount),l:'Service Interruptions',s:'Pearl'});
      if(ld) {
        var tot=(ld.scholarOnTrack||0)+(ld.scholarAtRisk||0)+(ld.scholarNeedsAction||0);
        if(ld.scholarOnTrack!=null) snaps.push({n:ld.scholarOnTrack+'/'+tot,l:'Scholars On Track',s:'Pearl'});
        if(ld.scholarAtRisk!=null)  snaps.push({n:ld.scholarAtRisk,l:'Scholars At Risk',s:'Pearl'});
      }
      if(irl&&irl.mathAvgGain!=null&&(irl.mathMedianPctAllYears!=null?irl.mathMedianPctAllYears:irl.mathMedianPctTypical)!=null)
        snaps.push({n:'+'+irl.mathAvgGain+' pts \xb7 '+(irl.mathMedianPctAllYears!=null?irl.mathMedianPctAllYears:irl.mathMedianPctTypical)+'%',l:'Math Growth · Median % to Typical',s:'iReady \xb7 '+(irl.activeSY||'Historical')});
      if(irl&&irl.elaAvgGain!=null&&(irl.elaMedianPctAllYears!=null?irl.elaMedianPctAllYears:irl.elaMedianPctTypical)!=null)
        snaps.push({n:'+'+irl.elaAvgGain+' pts \xb7 '+(irl.elaMedianPctAllYears!=null?irl.elaMedianPctAllYears:irl.elaMedianPctTypical)+'%',l:'ELA Growth · Median % to Typical',s:'iReady \xb7 '+(irl.activeSY||'Historical')});
      if(irl&&irl.growthPct!=null&&(irl.mathAvgGain==null||irl.elaAvgGain==null))
        snaps.push({n:irl.growthPct+'%',l:'Scholars w/ iReady Growth',s:'iReady'});
      if(kpi.total>0) snaps.push({n:kpi.met.length+'/'+kpi.total,l:'Annual Goals Met (Mid-Year)',s:'KPI'});
      if(kpi.partial.length) snaps.push({n:kpi.partial.length,l:'Goals Partially Met',s:'KPI'});
      el.innerHTML=snaps.length
        ? snaps.map(function(sn){return'<div class="adv-snap-stat"><div class="adv-snap-num">'+sn.n+'</div><div class="adv-snap-lbl">'+sn.l+'</div><div style="font-size:.62rem;color:var(--muted)">'+sn.s+'</div></div>';}).join('')
        : '<div style="grid-column:1/-1;padding:1rem;color:var(--muted);font-size:.83rem">Pearl data loading&hellip;</div>';
      buildKPIWinsTable();
    }

    function buildKPIWinsTable() {
      var el=document.getElementById('advSnapKPIWins'); if(!el) return;
      var kpi=getKPI(); if(!kpi.total){el.innerHTML='';return;}
      var rows=kpi.met.concat(kpi.partial).slice(0,15);
      el.innerHTML='<div class="adv-chart-card" style="margin-top:1rem">'+
        '<div class="adv-chart-title">&#127919; Mid-Year KPI Status</div>'+
        '<div style="font-size:.74rem;color:var(--muted);margin-bottom:.75rem">'+
          '<strong style="color:#0d6e3a">'+kpi.met.length+' Met</strong> &middot; '+
          '<strong style="color:#92400e">'+kpi.partial.length+' Partially Met</strong> &middot; '+
          '<strong style="color:#0050c8">'+kpi.progress.length+' In Progress</strong> &middot; '+
          kpi.total+' total &middot; <em style="font-size:.7rem">KPI Dashboard · Live Sheet</em>'+
        '</div>'+
        '<table class="adv-kpi-table"><thead><tr><th>Goal Area</th><th>Target</th><th>Mid-Year</th></tr></thead><tbody>'+
          rows.map(function(k){return'<tr><td style="color:var(--muted);width:130px;font-size:.72rem">'+(k.goal||'')+'</td><td style="font-size:.78rem">'+(k.target||'')+'</td><td>'+pill(k.midStatus||k.status||'')+'</td></tr>';}).join('')+
        '</tbody></table></div>';
    }

    // ── HIGHLIGHTS & MEDIA ────────────────────────────────────────
    function buildHighlights() {
      var el=document.getElementById('advHighlightsContent'); if(!el) return;
      var po=getPo(); var ld=getLD(); var race=getRace(); var st=getStella(); var kpi=getKPI(); var irl=getIRL();
      var html='';

      // ── ACADEMIC OUTCOMES (iReady) — always live from irlab.getSummary / longitudinal feed ──
      // Priority: 1) 25-26 longitudinal live data  2) most-recent-year live data (with note)
      // No manual upload required — updates automatically when longitudinal feed has new data.
      try {
        if (irl && irl.growthPct != null) {
          var irlSY2     = irl.activeSY || 'Historical';
          var has2526    = irl.hasCurrentYearData;
          var irlBorder  = has2526 ? '#7c3aed' : '#9ca3af';
          var irlBadge   = has2526
            ? '<div style="font-size:.68rem;background:#f3e8ff;color:#7c3aed;padding:.15rem .45rem;border-radius:10px;font-weight:700">2025-26 LIVE</div>'
            : '<div style="font-size:.68rem;background:#f3f4f6;color:#6b7280;padding:.15rem .45rem;border-radius:10px">'+irlSY2+' HISTORICAL</div>';
          var mMed2      = irl.mathMedianPctAllYears!=null ? irl.mathMedianPctAllYears : irl.mathMedianPctTypical;
          var eMed2      = irl.elaMedianPctAllYears!=null  ? irl.elaMedianPctAllYears  : irl.elaMedianPctTypical;
          var irlMetrics = [];
          if (irl.mathAvgGain!=null && mMed2!=null) irlMetrics.push('Math: +'+irl.mathAvgGain+' pts &nbsp;·&nbsp; '+mMed2+'% to typical');
          if (irl.elaAvgGain!=null  && eMed2!=null) irlMetrics.push('ELA: +'+irl.elaAvgGain+' pts &nbsp;·&nbsp; '+eMed2+'% to typical');
          var irlMetricStr = irlMetrics.length ? irlMetrics.join('<br>') : fmtP(irl.growthPct)+' growth rate';
          html+='<div class="adv-chart-card" style="border-left:3px solid '+irlBorder+';margin-bottom:.75rem">'+
            '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.35rem">'+
              '<div style="font-size:.78rem;font-weight:700;color:#7c3aed">&#128200; iReady Academic Outcomes &mdash; '+irlSY2+'</div>'+
              irlBadge+
            '</div>'+
            '<div style="font-size:1rem;font-weight:800;color:#1B2A4A;margin-bottom:.2rem">'+fmtP(irl.growthPct)+' of scholars show measurable academic growth</div>'+
            '<div style="font-size:.77rem;color:#374151;line-height:1.6;margin-bottom:.35rem">'+irlMetricStr+'</div>'+
            '<div style="font-size:.7rem;color:var(--muted)">'+fmtN(irl.totalRows)+' scholar records'+
              (irl.totalWithGrowth?' &nbsp;·&nbsp; '+fmtN(irl.totalWithGrowth)+' with positive gains':'')+
              ' &nbsp;·&nbsp; Source: iReady Longitudinal Live Feed'+
              (!has2526?' &nbsp;&#9888;&#65039; <em>2025-26 not yet in longitudinal feed &mdash; '+irlSY2+' results shown; will auto-update</em>':'')+
            '</div>'+
          '</div>';
        } else {
          html+='<div class="adv-chart-card" style="border-left:3px solid #9ca3af;opacity:.75;margin-bottom:.75rem">'+
            '<div style="font-size:.78rem;font-weight:600;color:var(--muted)">&#9432; iReady Academic Data Not Yet Available</div>'+
            '<div style="font-size:.76rem;color:var(--muted);margin-top:.2rem">iReady 2025-26 results will appear here automatically once the longitudinal live feed is updated. No manual upload required.</div>'+
          '</div>';
        }
      } catch(e) {}

      // ── STELLAR SCHOOLS ──
      if (st&&st.length) {
        var topSch=st.slice(0,8);
        html+='<div class="adv-chart-card">'+
          '<div class="adv-chart-title">&#11088; Stellar Schools — Top Sites by Scholar Attendance</div>'+
          '<div style="font-size:.73rem;color:var(--muted);margin-bottom:.6rem">Ranked by scholar attendance · min 5 sessions · Source: Pearl Live Data</div>'+
          '<table class="adv-kpi-table"><thead><tr><th>School</th><th>District</th><th>Att.</th><th>Sessions</th><th>Survey</th></tr></thead><tbody>'+
          topSch.map(function(sc,i){
            var medal=i===0?'&#127941;':i===1?'&#129352;':i===2?'&#129353;':'&#11088;';
            var aColor=sc.attRate>=90?'#0d6e3a':sc.attRate>=80?'#0050c8':'#92400e';
            return'<tr>'+
              '<td style="font-size:.78rem;font-weight:'+(i<3?'700':'400')+'">'+medal+' '+sc.school+'</td>'+
              '<td style="font-size:.72rem;color:var(--muted)">'+sc.district+'</td>'+
              '<td style="font-weight:700;color:'+aColor+'">'+sc.attRate+'%</td>'+
              '<td style="font-size:.78rem">'+fmtN(sc.sessions)+'</td>'+
              '<td style="font-size:.78rem">'+(sc.surveyAvg?'&#9733; '+sc.surveyAvg:'—')+'</td>'+
            '</tr>';
          }).join('')+
          '</tbody></table>'+
          '<div style="font-size:.7rem;color:var(--muted);margin-top:.5rem">&#128204; Schools with 90%+ attendance are media-ready success stories. Use these names in funder communications and press releases.</div>'+
        '</div>';
      }

      // ── DISTRICT BREAKDOWN ──
      if (ld&&ld.districts&&ld.districts.length) {
        var distSorted=ld.districts.slice().sort(function(a,b){return b.scholarRate-a.scholarRate;});
        html+='<div class="adv-chart-card">'+
          '<div class="adv-chart-title">&#127760; District Performance Breakdown</div>'+
          '<div style="font-size:.73rem;color:var(--muted);margin-bottom:.6rem">All NJTC districts · Scholar &amp; tutor attendance, sessions, scholars served · Pearl Live Data</div>'+
          '<table class="adv-kpi-table"><thead><tr><th>District</th><th>Scholars</th><th>Scholar Att.</th><th>Tutor Att.</th><th>Sessions</th></tr></thead><tbody>'+
          distSorted.map(function(d){
            var sC=d.scholarRate>=80?'#0d6e3a':d.scholarRate>=70?'#0050c8':'#92400e';
            var tC=d.tutorRate>=90?'#0d6e3a':d.tutorRate>=80?'#0050c8':'#92400e';
            return'<tr>'+
              '<td style="font-size:.79rem;font-weight:600">'+d.name+'</td>'+
              '<td style="font-size:.79rem">'+fmtN(d.scholars)+'</td>'+
              '<td style="font-weight:700;color:'+sC+'">'+d.scholarRate+'%</td>'+
              '<td style="font-weight:700;color:'+tC+'">'+d.tutorRate+'%</td>'+
              '<td style="font-size:.79rem">'+fmtN(d.sessions)+'</td>'+
            '</tr>';
          }).join('')+
          '</tbody></table>'+
        '</div>';
      }

      // ── SCHOLAR PERFORMANCE TIERS ──
      if (ld) {
        var onT=ld.scholarOnTrack||0, atR=ld.scholarAtRisk||0, nA=ld.scholarNeedsAction||0, tot2=onT+atR+nA;
        if (tot2>0) {
          html+='<div class="adv-chart-card">'+
            '<div class="adv-chart-title">&#128200; Scholar Performance Tiers — Live from Pearl</div>'+
            '<div style="font-size:.73rem;color:var(--muted);margin-bottom:.75rem">Active scholars only (at least 1 attended session). Tiers: On Track = 80%+ attendance · At Risk = 70-79% · Needs Action = &lt;70%</div>'+
            '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:.75rem;margin-bottom:.75rem">'+
              [
                {n:onT,pct:Math.round(onT/tot2*100),l:'On Track',c:'#0d6e3a',bg:'#f0fdf4',ico:'&#128994;'},
                {n:atR,pct:Math.round(atR/tot2*100),l:'At Risk',c:'#b45309',bg:'#fef3c7',ico:'&#129000;'},
                {n:nA, pct:Math.round(nA/tot2*100), l:'Needs Action',c:'#dc2626',bg:'#fef2f2',ico:'&#128997;'}
              ].map(function(t){
                return'<div style="background:'+t.bg+';border-radius:8px;padding:.75rem;text-align:center">'+
                  '<div style="font-size:1.5rem">'+t.ico+'</div>'+
                  '<div style="font-weight:800;font-size:1.4rem;color:'+t.c+'">'+fmtN(t.n)+'</div>'+
                  '<div style="font-size:.7rem;color:'+t.c+'">'+t.pct+'%</div>'+
                  '<div style="font-size:.72rem;color:#374151;margin-top:.15rem">'+t.l+'</div>'+
                '</div>';
              }).join('')+
            '</div>'+
            '<div style="font-size:.7rem;color:var(--muted)">&#128204; Source: Pearl Attendance Data &middot; Live &middot; Total active scholars: '+fmtN(tot2)+'</div>'+
          '</div>';
        }
      }

      // ── RACE / ETHNICITY ──
      if (race&&race.byScholar&&Object.keys(race.byScholar).length) {
        var rE=Object.entries(race.byScholar).sort(function(a,b){return b[1]-a[1];});
        var rTot=rE.reduce(function(s,e){return s+e[1];},0);
        var barCols=['#0050c8','#0d6e3a','#7c3aed','#b45309','#0891b2','#be185d','#374151','#6b7280'];
        html+='<div class="adv-chart-card">'+
          '<div class="adv-chart-title">&#127760; Scholar Demographics — Race &amp; Ethnicity</div>'+
          '<div style="font-size:.73rem;color:var(--muted);margin-bottom:.6rem">Unique scholars by race/ethnicity · Source: Pearl Attendance Data · SY 2025-26</div>'+
          '<div style="display:grid;gap:.45rem">'+
          rE.map(function(e,i){
            var pct=rTot>0?Math.round(e[1]/rTot*100):0;
            return'<div>'+
              '<div style="display:flex;justify-content:space-between;font-size:.76rem;margin-bottom:.18rem">'+
                '<span>'+e[0]+'</span><span style="font-weight:700">'+fmtN(e[1])+' ('+pct+'%)</span>'+
              '</div>'+
              '<div style="height:7px;background:rgba(0,0,0,.07);border-radius:4px;overflow:hidden">'+
                '<div style="height:100%;width:'+pct+'%;background:'+barCols[i%barCols.length]+';border-radius:4px"></div>'+
              '</div></div>';
          }).join('')+
          '</div>'+
          '<div style="font-size:.7rem;color:var(--muted);margin-top:.65rem">&#128204; <strong>Equity angle:</strong> NJTC disproportionately serves students of color. '+(rE.length>0?rE[0][0]+' scholars are the largest group ('+Math.round(rE[0][1]/rTot*100)+'%).':'')+' Use this data in equity-focused grant applications and state funding requests.</div>'+
        '</div>';
      }

      // ── ABSENCE DRIVERS ──
      if (ld&&ld.absenceDrivers) {
        var ctrl=ld.absenceDrivers.controllable, uctrl=ld.absenceDrivers.uncontrollable;
        if ((ctrl.total||0)+(uctrl.total||0)>0) {
          html+='<div class="adv-chart-card">'+
            '<div class="adv-chart-title">&#128683; Absence Driver Analysis</div>'+
            '<div style="display:grid;grid-template-columns:1fr 1fr;gap:.75rem;margin:.5rem 0">'+
              '<div>'+
                '<div style="font-size:.74rem;font-weight:700;color:#dc2626;margin-bottom:.4rem">Controllable ('+fmtN(ctrl.total||0)+')</div>'+
                (ctrl.reasons||[]).map(function(r){return'<div style="font-size:.73rem;margin-bottom:.2rem;display:flex;justify-content:space-between"><span style="color:#374151">'+r.label+'</span><span style="font-weight:700;color:#dc2626">'+r.count+'</span></div>';}).join('')+
              '</div>'+
              '<div>'+
                '<div style="font-size:.74rem;font-weight:700;color:#0050c8;margin-bottom:.4rem">Uncontrollable ('+fmtN(uctrl.total||0)+')</div>'+
                (uctrl.reasons||[]).map(function(r){return'<div style="font-size:.73rem;margin-bottom:.2rem;display:flex;justify-content:space-between"><span style="color:#374151">'+r.label+'</span><span style="font-weight:700;color:#0050c8">'+r.count+'</span></div>';}).join('')+
              '</div>'+
            '</div>'+
            '<div style="font-size:.7rem;color:var(--muted)">&#128204; Source: Pearl Absence Reason Codes &middot; Live Google Sheet</div>'+
          '</div>';
        }
      }

      // ── MEDIA ANGLES ──
      var mediaAngles=[
        {ico:'&#127941;',h:'Top-Performing School',body:st&&st[0]?'"'+st[0].school+' in '+st[0].district+' has achieved '+st[0].attRate+'% scholar attendance — among the highest of all '+((getPo()&&getPo().schoolCount)||'NJTC')+' sites." Local press hook with real name and number.':'Load Pearl data to surface top school.'},
        {ico:'&#9878;', h:'Equity Narrative', body:race&&race.byScholar?'NJTC&#39;s scholars represent New Jersey&#39;s most underserved communities. The race breakdown (above) supports equity framing for state and federal funding applications.':'Pearl race data available after Pearl Operations loads.'},
        {ico:'&#128200;',h:'iReady Growth Angle', body:(function(){var _i=getIRL();if(!_i)return'iReady data loads from the i-Ready Lab module.';var parts=[];var _mM=_i.mathMedianPctAllYears!=null?_i.mathMedianPctAllYears:_i.mathMedianPctTypical;var _eM=_i.elaMedianPctAllYears!=null?_i.elaMedianPctAllYears:_i.elaMedianPctTypical;if(_i.mathAvgGain!=null&&_mM!=null)parts.push('Math: +'+_i.mathAvgGain+' pts ('+_mM+'% median to typical)');if(_i.elaAvgGain!=null&&_eM!=null)parts.push('ELA: +'+_i.elaAvgGain+' pts ('+_eM+'% median to typical)');if(parts.length)return'NJTC scholars: '+parts.join(' \xb7 ')+' on iReady\u2019s national growth benchmark ('+(_i.activeSY||'Historical')+') \u2014 the same diagnostic tool their own districts use. Independently verifiable, not self-reported.';return fmtP(_i.growthPct)+'% of NJTC scholars show measurable iReady growth \u2014 the same diagnostic tool their own districts use. Independently verifiable, not self-reported.';}())},
        {ico:'&#128203;',h:'Performance Tier Story', body:ld?fmtN(ld.scholarOnTrack)+' scholars are On Track (80%+ attendance). NJTC does not just place tutors — it tracks every scholar&#39;s trajectory and flags at-risk students for intervention in real time.':'Load Pearl data to see scholar tiers.'},
        {ico:'&#129309;',h:'Tutor Workforce Pipeline', body:'NJTC is training the next generation of New Jersey educators. The Apprentice-to-Teacher pipeline is a workforce development story for op-eds and education policy forums.'},
        {ico:'&#127759;',h:'No Transportation Barrier', body:'Unlike afterschool programs, NJTC operates inside the school day. This is the only tutoring model that removes every access barrier for low-income families — no bus, no childcare, no scheduling.'},
        {ico:'&#128683;',h:'Controllable vs. Uncontrollable Absences', body:ld&&ld.absenceDrivers?'Of '+fmtN((ld.absenceDrivers.controllable.total||0)+(ld.absenceDrivers.uncontrollable.total||0))+' missed sessions, only '+fmtN(ld.absenceDrivers.controllable.total||0)+' are controllable by NJTC. The rest are school-driven closures, testing days, and teacher requests — documented and categorizable.':'Load Pearl data to see absence breakdown.'},
        {ico:'&#127919;',h:'KPI Accountability Story', body:kpi.total?kpi.met.length+' of '+kpi.total+' annual goals already Met at mid-year. Frame: "NJTC sets measurable targets and hits them." Rare in the nonprofit tutoring space.':'KPI data loads from KPI Targets panel.'}
      ];
      html+='<div class="adv-chart-card"><div class="adv-chart-title">&#128240; Media &amp; Press Angles — Ready to Use</div>'+
        '<div style="display:grid;gap:.55rem;margin-top:.5rem">'+
        mediaAngles.map(function(a){
          return'<div style="display:flex;gap:.6rem;padding:.6rem;background:var(--surface-2);border-radius:6px">'+
            '<div style="font-size:1.25rem;flex-shrink:0;padding-top:.1rem">'+a.ico+'</div>'+
            '<div><div style="font-size:.78rem;font-weight:700;color:var(--navy);margin-bottom:.15rem">'+a.h+'</div>'+
            '<div style="font-size:.76rem;line-height:1.5;color:var(--text-1)">'+a.body+'</div></div>'+
          '</div>';
        }).join('')+
        '</div></div>';

      el.innerHTML = html || '<div style="padding:1rem;color:var(--muted);font-size:.84rem">Pearl data loading — open Pearl Operations first.</div>';
    }

    // ── ROI CALCULATOR ────────────────────────────────────────────
    function prefillROI() {
      var po=getPo(); var irl=getIRL();
      if(po&&po.sessions){var e=document.getElementById('roiSessions');if(e)e.value=po.sessions;}
      if(irl&&irl.growthPct){var e2=document.getElementById('roiGrowthPct');if(e2)e2.value=irl.growthPct;}
      window.advCalcROI();
    }
    window.advCalcROI = function() {
      var funding=parseFloat((document.getElementById('roiStateFunding')||{}).value)||0;
      var scholars=parseFloat((document.getElementById('roiScholars')||{}).value)||0;
      var sessions=parseFloat((document.getElementById('roiSessions')||{}).value)||0;
      var mins=parseFloat((document.getElementById('roiSessionMins')||{}).value)||45;
      var gpct=parseFloat((document.getElementById('roiGrowthPct')||{}).value)||0;
      var remCost=parseFloat((document.getElementById('roiRemCost')||{}).value)||0;
      var el=document.getElementById('advRoiResults'); if(!el) return;
      if(!funding||!scholars){el.innerHTML='<h4>ROI Output</h4><div style="color:rgba(255,255,255,.5);font-size:.83rem">Enter State Funding and Scholars Served to compute.</div>';return;}
      var cps=Math.round(funding/scholars);
      var hrs=Math.round(sessions*mins/60);
      var cph=hrs>0?Math.round(funding/hrs):0;
      var growing=Math.round(scholars*(gpct/100));
      var avoided=Math.round(growing*remCost);
      var lev=avoided>0?(avoided/funding).toFixed(1)+'x':'—';
      el.innerHTML='<h4>Return on Investment</h4>'+
        '<div class="adv-roi-metric"><div class="adv-roi-metric-num">'+fmtD(cps)+'</div><div class="adv-roi-metric-lbl">Cost per scholar served</div></div>'+
        (hrs>0?'<div class="adv-roi-metric"><div class="adv-roi-metric-num">'+fmtD(cph)+'</div><div class="adv-roi-metric-lbl">Cost per instructional hour ('+fmtN(hrs)+' hrs)</div></div>':'')+
        '<hr class="adv-roi-divider">'+
        '<div class="adv-roi-metric"><div class="adv-roi-metric-num">'+fmtN(growing)+'</div><div class="adv-roi-metric-lbl">Scholars w/ projected growth ('+gpct+'%)</div></div>'+
        (avoided>0?'<div class="adv-roi-metric"><div class="adv-roi-metric-num">'+fmtD(avoided)+'</div><div class="adv-roi-metric-lbl">Remediation cost avoidance (est.)</div></div>':'')+
        (avoided>0?'<hr class="adv-roi-divider"><div class="adv-roi-metric"><div class="adv-roi-metric-num" style="color:#f0a500">'+lev+'</div><div class="adv-roi-metric-lbl">Economic leverage ratio per $1 invested</div></div>':'')+
        '<div style="font-size:.68rem;color:rgba(255,255,255,.35);margin-top:.75rem;line-height:1.4">Estimates based on national avg remediation cost. Sources: EdWeek Research Center, NJTC program data.</div>';
    };

    // ── KPI BRIEF ─────────────────────────────────────────────────
    function buildKPIBrief() {
      var el=document.getElementById('advKpiBriefContent'); if(!el) return;
      var kpi=getKPI();
      if(!kpi.total){el.innerHTML='<div style="padding:1.5rem;color:var(--muted);font-size:.85rem">KPI data loading — visit KPI Targets first.</div>';return;}
      var rows=[];
      try{if(typeof window.advGetKPIData==='function')rows=window.advGetKPIData();}catch(e){}
      var byGoal={};
      rows.forEach(function(k){if(!byGoal[k.goal])byGoal[k.goal]=[];byGoal[k.goal].push(k);});
      el.innerHTML='<div class="adv-chart-card">'+
        '<div class="adv-chart-title">&#128203; Full KPI Brief</div>'+
        '<div style="font-size:.75rem;color:var(--muted);margin-bottom:1rem"><strong style="color:#0d6e3a">'+kpi.met.length+' Met</strong> &middot; <strong style="color:#92400e">'+kpi.partial.length+' Partly Met</strong> &middot; <strong style="color:#0050c8">'+kpi.progress.length+' In Progress</strong> of '+kpi.total+' total &middot; <em style="font-size:.7rem">KPI Dashboard · Live Sheet · Mid-Year SY 2025-26</em></div>'+
        Object.entries(byGoal).map(function(e2){
          var goal=e2[0],items=e2[1];
          var mc=items.filter(function(i){return(i.midStatus||'').toLowerCase()==='met';}).length;
          return'<div style="margin-bottom:1.1rem">'+
            '<div style="font-size:.77rem;font-weight:700;color:var(--navy);padding:.3rem .55rem;background:var(--surface-2);border-radius:4px;margin-bottom:.3rem">'+goal+' <span style="color:var(--muted);font-weight:400">('+mc+'/'+items.length+' Met)</span></div>'+
            '<table class="adv-kpi-table" style="margin:0"><tbody>'+
              items.map(function(k){return'<tr><td style="font-size:.78rem">'+(k.target||'')+'</td><td style="white-space:nowrap;width:140px">'+pill(k.midStatus||k.status||'')+'</td></tr>';}).join('')+
            '</tbody></table></div>';
        }).join('')+
      '</div>';
    }

    // ── PRINT ONE-PAGER ───────────────────────────────────────────
    window.advPrintOnePager = function() {
      var po=getPo(); var kpi=getKPI(); var irl=getIRL(); var ld=getLD();
      var race=getRace(); var st=getStella(); var sya=getSyaSites();
      var aud=AUD[_audience]||AUD.governor;
      var today=new Date().toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'});
      var dept=(window.NJTC_SESSION&&window.NJTC_SESSION.dept)||'';
      var dLbl={leadership:'Chief of Staff',kb:'Executive Overview',data:'Data & Evaluation'};
      var statsArr=[];
      if(sya.sites)        statsArr.push({n:sya.sites,l:'Active School Sites'});
      if(sya.districts)    statsArr.push({n:sya.districts+' Districts',l:'Served Statewide'});
      if(po&&po.sessions)  statsArr.push({n:fmtN(po.sessions),l:'Sessions Delivered'});
      if(po&&po.instAttPct!=null) statsArr.push({n:po.instAttPct+'%',l:'Tutor Attendance'});
      if(po&&po.scholAttPct!=null)statsArr.push({n:po.scholAttPct+'%',l:'Scholar Attendance'});
      if(po&&po.surveyAvg!=null)  statsArr.push({n:po.surveyAvg+'/5',l:'Scholar Satisfaction'});
      if(irl&&(irl.mathAvgGain!=null||irl.elaAvgGain!=null)){
        if(irl.mathAvgGain!=null&&(irl.mathMedianPctAllYears!=null?irl.mathMedianPctAllYears:irl.mathMedianPctTypical)!=null) statsArr.push({n:'+'+irl.mathAvgGain+' pts ('+(irl.mathMedianPctAllYears!=null?irl.mathMedianPctAllYears:irl.mathMedianPctTypical)+'%)',l:'Math Growth · Median % to Typical'});
        if(irl.elaAvgGain!=null&&(irl.elaMedianPctAllYears!=null?irl.elaMedianPctAllYears:irl.elaMedianPctTypical)!=null)   statsArr.push({n:'+'+irl.elaAvgGain+' pts ('+(irl.elaMedianPctAllYears!=null?irl.elaMedianPctAllYears:irl.elaMedianPctTypical)+'%)',l:'ELA Growth · Median % to Typical'});
      } else if(irl&&irl.growthPct!=null) statsArr.push({n:irl.growthPct+'%',l:'iReady Growth Rate'});
      if(kpi.total>0)      statsArr.push({n:kpi.met.length+'/'+kpi.total,l:'Goals Met Mid-Year'});
      if(ld)               statsArr.push({n:fmtN(ld.scholarOnTrack),l:'Scholars On Track'});
      var topSch=st.slice(0,3);
      var raceLines='';
      if(race&&race.byScholar){var rE2=Object.entries(race.byScholar).sort(function(a,b){return b[1]-a[1];}).slice(0,4);var rTot2=Object.values(race.byScholar).reduce(function(s,v){return s+v;},0);raceLines=rE2.map(function(e){return e[0]+': '+Math.round(e[1]/rTot2*100)+'%';}).join(' &bull; ');}
      var frameEl=document.getElementById('advPrintFrame');
      if(!frameEl){
        frameEl=document.createElement('div');
        frameEl.id='advPrintFrame';
        frameEl.style.display='none';
        document.body.appendChild(frameEl);
      }
      var printEl=document.getElementById('advPrintContent');
      if(!printEl){
        printEl=document.createElement('div');
        printEl.id='advPrintContent';
        printEl.className='adv-print-page';
        frameEl.appendChild(printEl);
      }
      printEl.innerHTML=
        '<div class="adv-print-header">'+
          '<div class="adv-print-logo-area"><h1>New Jersey Tutoring Corps</h1><p>SY 2025-2026 &middot; Program Impact Brief &middot; '+aud.label+'</p><p style="font-size:8.5pt;color:#4a5568;font-style:italic;margin-top:2pt">'+aud.intro+'</p></div>'+
          '<div style="text-align:right"><div class="adv-print-badge">CONFIDENTIAL</div><div style="font-size:8pt;color:#7d8fa1;margin-top:4px">'+today+'</div><div style="font-size:8pt;color:#7d8fa1">Prepared by '+(dLbl[dept]||'NJTC Leadership')+'</div></div>'+
        '</div>'+
        '<div class="adv-print-section-title">Current Program Metrics &mdash; Live Pearl, SYA &amp; iReady Data</div>'+
        '<div class="adv-print-stats">'+statsArr.slice(0,8).map(function(ss){return'<div class="adv-print-stat"><div class="adv-print-stat-num">'+ss.n+'</div><div class="adv-print-stat-lbl">'+ss.l+'</div></div>';}).join('')+'</div>'+
        (topSch.length?'<div class="adv-print-section-title">&#11088; Stellar Schools</div>'+
          '<table class="adv-kpi-table" style="width:100%;margin-bottom:10pt"><thead><tr><th>School</th><th>District</th><th>Scholar Att.</th><th>Sessions</th></tr></thead><tbody>'+
          topSch.map(function(sc,i){return'<tr><td style="font-weight:600">'+(i===0?'&#127941; ':i===1?'&#129352; ':'&#129353; ')+sc.school+'</td><td style="color:#6b7280">'+sc.district+'</td><td style="font-weight:700;color:#0d6e3a">'+sc.attRate+'%</td><td>'+fmtN(sc.sessions)+'</td></tr>';}).join('')+
          '</tbody></table>':'')+
        (raceLines?'<div class="adv-print-section-title">&#127760; Scholar Demographics</div><p style="font-size:9pt;margin:4pt 0 8pt">'+raceLines+'</p>':'')+
        (kpi.met.length?'<div class="adv-print-section-title">&#127919; Mid-Year Goals Met ('+kpi.met.length+' of '+kpi.total+')</div>'+
          '<div class="adv-print-roi">'+kpi.met.slice(0,6).map(function(k){return'<div class="adv-print-roi-item"><div class="adv-print-roi-num" style="font-size:8pt;font-weight:700;color:#0d6e3a">&#10003; Met</div><div class="adv-print-roi-lbl">'+(k.goal||'')+'<br><em>'+(k.target||'').substring(0,65)+(k.target&&k.target.length>65?'&hellip;':'')+'</em></div></div>';}).join('')+'</div>':'')+
        '<div class="adv-print-footer"><p>New Jersey Tutoring Corps &middot; '+today+' &middot; Sources: Pearl Operations, SYA, iReady, KPI Dashboard (Live Data)</p><div class="adv-print-confidential">Confidential &middot; Internal Use Only &middot; '+aud.label+'</div></div>';
      frameEl.style.display='block';
      setTimeout(function(){window.print();setTimeout(function(){frameEl.style.display='none';},1000);},80);
    };

    // ── TAB / AUDIENCE SWITCHERS ─────────────────────────────────
    window.advSetTab = function(tab, btn) {
      _activeTab=tab;
      document.querySelectorAll('.adv-tab').forEach(function(b){b.classList.remove('active');});
      document.querySelectorAll('.adv-pane').forEach(function(p){p.classList.remove('active');});
      if(btn) btn.classList.add('active');
      var pane=document.getElementById('advPane-'+tab); if(pane) pane.classList.add('active');
      _cache.po=undefined; _cache.ld=undefined; _cache.kpi=undefined; _cache.irl=undefined;
      _cache.race=undefined; _cache.stellar=undefined;
      if(tab==='talking-points')  { buildLeadershipBanner(); buildTalkingPoints(); }
      if(tab==='impact-snapshot') buildSnapshot();
      if(tab==='roi')             prefillROI();
      if(tab==='kpi-brief')       buildKPIBrief();
      if(tab==='highlights')      buildHighlights();
    };

    window.advSetAudience = function(audience, btn) {
      _audience=audience;
      document.querySelectorAll('.adv-audience-chip').forEach(function(b){b.classList.remove('active');});
      if(btn) btn.classList.add('active');
      if(_activeTab==='talking-points') buildTalkingPoints();
    };

    window.advOnPanelOpen = function() {
      _cache={}; _retryCount=0;
      if(_retryTimer){clearTimeout(_retryTimer);_retryTimer=null;}
      buildLeadershipBanner();
      buildTalkingPoints();
      // If Pearl not loaded yet, schedule retries
      if(!pearlLoaded()) _scheduleRetry();
    };

  })();

(function() {
  'use strict';

  // ── CONSTANTS ────────────────────────────────────────────────────────
  const KNOWTION_URL  = 'https://go.knowtion.online/login';
  const DEPT_LABELS_KN = {
    leadership:  { icon: '🏆', name: 'Executive / Leadership' },
    kb:          { icon: '🗝️', name: 'Knowledge Base'         },
    program:     { icon: '📋', name: 'Program'                 },
    academic:    { icon: '📚', name: 'Academic'                },
    hr:          { icon: '👥', name: 'HR / People'             },
    finance:     { icon: '💰', name: 'Finance'                 },
    data:        { icon: '📊', name: 'Data & Evaluation'       },
    training:    { icon: '🎓', name: 'Training'                },
  };

  // Day-of-week cadence config (0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat)
  const DAY_CADENCE = {
    1: { icon: '🌅', day: 'Monday', theme: 'Appreciation & Calm Start',
         title: 'Start the week grounded',
         body:  'Share a quick shout-out for a colleague who made last week better. Recognize a scholar win. Ground the team in what\'s going well before the week builds momentum.',
         prompts: [
           'Who on the team deserves recognition from last week?',
           'What\'s one practical thing that made your sessions run smoother?',
           'What\'s your intention for scholars this week?',
         ]},
    2: { icon: '🧰', day: 'Tuesday', theme: 'Toolkit & Strategy Sharing',
         title: 'Share what\'s working',
         body:  'Drop a strategy, resource, or technique that improved your sessions. Post a question about a challenge you\'re navigating. The team is your think tank.',
         prompts: [
           'What instructional technique worked best for your scholars recently?',
           'What PD topic would help you most right now?',
           'Share a resource or template that saved you time this week.',
         ]},
    3: { icon: '🌊', day: 'Wednesday', theme: 'Midweek Morale & Shout-Outs',
         title: 'Keep momentum strong',
         body:  'Midweek is the moment to breathe and reconnect. Drop a shout-out, share an encouraging scholar moment, or post a quick energy-booster for the team.',
         prompts: [
           'Share a scholar moment that made you smile this week.',
           'Give a shout-out to someone supporting you from behind the scenes.',
           'What\'s something you\'re proud of so far this week?',
         ]},
    4: { icon: '💭', day: 'Thursday', theme: 'Thoughtfulness & Reflection',
         title: 'Reflect on what\'s working',
         body:  'Thursday is for honest reflection — what worked, what didn\'t, and what to carry forward. Surface best practices and prepare insights for the week\'s close.',
         prompts: [
           'What\'s one instructional approach you\'d repeat next week and why?',
           'What challenge this week taught you something new?',
           'What best practice should the whole team know about?',
         ]},
    5: { icon: '✅', day: 'Friday', theme: 'Wrap-Up & Best Practices',
         title: 'Close strong, share forward',
         body:  'Scholar Surge day. Close the week with a highlight from your sessions, a note of gratitude, or a best practice to carry into next week.',
         prompts: [
           'What\'s one win from this week worth celebrating?',
           'What will you do differently next week based on today?',
           'Tag a teammate who showed up for scholars this week.',
         ]},
    0: { icon: '☀️', day: 'Sunday', theme: 'Reflection & Prep',
         title: 'Set yourself up for a strong week',
         body:  'Take a moment to reflect and prepare. Check in with yourself — what do you need to show up fully for your scholars this week?',
         prompts: [
           'What\'s one thing you want to accomplish this week for your scholars?',
           'How are you feeling going into the week?',
           'What support would help you most right now?',
         ]},
    6: { icon: '⚡', day: 'Saturday', theme: 'Community Pulse',
         title: 'Community is always open',
         body:  'The Knowtion community doesn\'t close on weekends. Drop a thought, celebrate a win, or start a conversation that inspires the team for next week.',
         prompts: [
           'What\'s something from this week you\'re still thinking about?',
           'What resources are you using to stay sharp over the weekend?',
           'Send encouragement to a colleague navigating something tough.',
         ]},
  };

  // Community pulse cards — data-informed highlights (pulled live from Pearl/KPI when available)
  function buildPulseCards(dept) {
    const pearlLoaded = window.po && typeof window.po.getStats === 'function';
    const stats = pearlLoaded ? (() => { try { return window.po.getStats(); } catch(e) { return {}; } })() : {};

    const cards = [];

    // Card 1: Shout-Outs
    cards.push({
      icon: '🎉', accent: 'kn-accent-gold',
      label: 'Shout-Out Space', tag: 'Recognition',
      title: 'Celebrate your team',
      body: 'Recognize a tutor who went above and beyond, a scholar who showed growth, or a site leader holding things together on the ground.',
      cta: 'Give a shout-out',
    });

    // Card 2: Best Practice Exchange
    cards.push({
      icon: '🧩', accent: 'kn-accent-blue',
      label: 'Best Practices', tag: 'Strategy',
      title: 'What\'s working in your sessions?',
      body: 'Share a technique, resource, or classroom strategy that helped your scholars connect with content this week. Your insight could transform another tutor\'s session.',
      cta: 'Share a strategy',
    });

    // Card 3: Data-Informed (if Pearl loaded, show live stat)
    if (stats.loaded && stats.scholAttPct !== null) {
      cards.push({
        icon: '📊', accent: 'kn-accent-green',
        label: 'Program Pulse', tag: 'Live Data',
        title: `Scholar attendance is at ${stats.scholAttPct}% this cycle`,
        body: 'Share what\'s driving attendance at your site — what\'s working, what\'s a challenge. Your insight helps the team understand patterns across schools.',
        cta: 'Share your experience',
      });
    } else {
      cards.push({
        icon: '🔬', accent: 'kn-accent-green',
        label: 'Think Tank', tag: 'Inquiry',
        title: 'What question are you sitting with?',
        body: 'Post an instructional question, a curiosity about your scholars, or a puzzle from your sessions. The community is your thought partner.',
        cta: 'Post a question',
      });
    }

    // Card 4: Safe Space / Check-In
    cards.push({
      icon: '🤝', accent: 'kn-accent-purple',
      label: 'Check-In', tag: 'Well-Being',
      title: 'How are you really doing?',
      body: 'Knowtion is a safe space for honest reflection. Share how you\'re navigating the work, what energizes you, and what support you need to keep showing up.',
      cta: 'Check in',
    });

    // Card 5: Dept-specific
    if (dept === 'program' || dept === 'leadership' || dept === 'kb') {
      cards.push({
        icon: '🏫', accent: 'kn-accent-blue',
        label: 'Site Connection', tag: 'Operations',
        title: 'Cross-site learning exchange',
        body: 'Each site has developed something unique. What does your school do well that others could learn from? Share it here and start a cross-site conversation.',
        cta: 'Share your site insight',
      });
    } else if (dept === 'academic' || dept === 'data') {
      cards.push({
        icon: '📈', accent: 'kn-accent-green',
        label: 'Instructional Insight', tag: 'Academic',
        title: 'What are the data telling you?',
        body: 'Share a pattern you\'re noticing in scholar performance — in i-Ready, in session quality, or in engagement. Collective pattern recognition leads to better interventions.',
        cta: 'Share an academic insight',
      });
    } else {
      cards.push({
        icon: '💡', accent: 'kn-accent-gold',
        label: 'Ideas & Innovation', tag: 'Improvement',
        title: 'What would make NJTC better?',
        body: 'Knowtion is where good ideas get amplified. Post a process improvement, a communication enhancement, or a cultural practice that could strengthen the organization.',
        cta: 'Share an idea',
      });
    }

    // Card 6: Reflection + best practices
    cards.push({
      icon: '✍️', accent: 'kn-accent-purple',
      label: 'Reflection Corner', tag: 'Growth',
      title: 'What did you learn this week?',
      body: 'One of the most powerful forms of professional growth is reflective practice. Share one thing you learned — about your scholars, yourself, or your craft.',
      cta: 'Reflect & share',
    });

    return cards;
  }

  // Build data highlight strip
  function buildDataStrip() {
    const pearlLoaded = window.po && typeof window.po.getStats === 'function';
    const stats = pearlLoaded ? (() => { try { return window.po.getStats(); } catch(e) { return {}; } })() : {};
    const ldData = (window.po && typeof window.po.getLeadershipData === 'function')
      ? (() => { try { return window.po.getLeadershipData(); } catch(e) { return null; } })()
      : null;

    if (!stats.loaded) return '';

    // Active tutors: window._njtcActiveEmployees is set in fetchLiveHRData() in the HR module's
    // own scope (same IIFE as HR_EMPS) — the only scope where HR_EMPS is accessible.
    // This matches the exec dashboard's HR-first logic exactly.
    const activeTutorCount = (window._njtcActiveEmployees != null) ? window._njtcActiveEmployees : stats.activeTutors;
    const activeTutorSub   = (window._njtcActiveEmployees != null) ? 'Active employees · HR roster' : 'Pearl data';

    // Sessions: use getLeadershipData().sessionsDelivered — same calculation Pearl Operations
    // panel uses (filters _sessMap to isDelivered sessions only, matching the displayed 12,106)
    const sessionCount = (ldData && ldData.sessionsDelivered != null)
      ? ldData.sessionsDelivered
      : stats.sessions;

    const items = [];
    if (stats.scholAttPct !== null) {
      items.push({ label: 'Scholar Attendance', value: stats.scholAttPct + '%', sub: 'Current cycle' });
    }
    if (sessionCount != null) {
      items.push({ label: 'Sessions Delivered', value: Number(sessionCount).toLocaleString(), sub: 'Completed sessions' });
    }
    if (activeTutorCount > 0) {
      items.push({ label: 'Active Tutors', value: activeTutorCount, sub: activeTutorSub });
    }
    if (stats.surveyAvg !== null) {
      items.push({ label: 'Scholar Survey Avg', value: '★ ' + stats.surveyAvg, sub: 'Out of 5.0' });
    }

    if (!items.length) return '';

    const html = `
      <div class="kn-data-strip">
        <div style="flex-shrink:0;font-size:1.25rem">📡</div>
        <div style="flex-shrink:0">
          <div class="kn-data-strip-label">Live Program Pulse</div>
          <div style="font-size:.75rem;color:var(--muted)">Current SY 2025–26 data from Pearl</div>
        </div>
        <div class="kn-data-strip-divider" style="margin:0 .5rem"></div>
        ${items.map((it, i) => `
          ${i > 0 ? '<div class="kn-data-strip-divider"></div>' : ''}
          <div class="kn-data-strip-stat">
            <div class="kn-data-strip-label">${it.label}</div>
            <div class="kn-data-strip-value">${it.value}</div>
            <div class="kn-data-strip-sub">${it.sub}</div>
          </div>
        `).join('')}
      </div>
    `;
    return html;
  }

  // Main render function
  function buildKnowtionPanel(dept) {
    const el = document.getElementById('kntionContainer');
    if (!el) return;

    const today = new Date();
    const dow   = today.getDay();
    const cadence = DAY_CADENCE[dow] || DAY_CADENCE[1];

    // Dept label
    const deptInfo = DEPT_LABELS_KN[dept] || { icon: '🌐', name: dept || 'All Departments' };

    // Pulse cards
    const cards = buildPulseCards(dept);

    const cardHTML = cards.map(c => `
      <div class="kn-card ${c.accent}" onclick="window.open('${KNOWTION_URL}','_blank')">
        <div style="display:flex;align-items:flex-start;gap:.75rem">
          <div class="kn-card-icon">${c.icon}</div>
          <div style="flex:1">
            <div class="kn-card-label">${c.label}</div>
            <div class="kn-card-title">${c.title}</div>
          </div>
        </div>
        <div class="kn-card-body">${c.body}</div>
        <div class="kn-card-footer">
          <span class="kn-card-tag">${c.tag}</span>
          <span class="kn-card-cta">${c.cta}</span>
        </div>
      </div>
    `).join('');

    // Reflection prompts
    const promptHTML = cadence.prompts.map(p => `
      <div class="kn-prompt">
        <div class="kn-prompt-text">${p}</div>
        <a href="${KNOWTION_URL}" target="_blank" class="kn-prompt-cta">Respond in Knowtion</a>
      </div>
    `).join('');

    // Dept quick-links
    const deptChips = Object.entries(DEPT_LABELS_KN).map(([key, d]) => `
      <a href="${KNOWTION_URL}" target="_blank" class="kn-dept-chip">
        ${d.icon} ${d.name}
      </a>
    `).join('');

    el.innerHTML = `
      <!-- Header -->
      <div class="kn-header">
        <div class="kn-header-left">
          <div class="kn-eyebrow">🌐 Community Platform · SY 2025–26</div>
          <h2 class="kn-title">Knowtion Community</h2>
          <p class="kn-subtitle">
            Your shared space for shout-outs, strategy sharing, reflection, and team connection.
            Knowtion is where the NJTC community grows together — on-site and across sites.
          </p>
          <div class="kn-pulse-row" style="margin-top:.75rem">
            <div class="kn-pulse-chip"><span class="kn-dot"></span> Community Active</div>
            <div class="kn-pulse-chip">📅 ${cadence.day} — ${cadence.theme}</div>
            <div class="kn-pulse-chip">${deptInfo.icon} ${deptInfo.name}</div>
          </div>
        </div>
        <a href="${KNOWTION_URL}" target="_blank" class="kn-launch-btn">
          🌐 Open Knowtion
        </a>
      </div>

      <!-- Day-of-week cadence banner -->
      <div class="kn-cadence-banner">
        <div class="kn-cadence-icon">${cadence.icon}</div>
        <div style="flex:1">
          <div class="kn-cadence-day">${cadence.day.toUpperCase()} · ${cadence.theme.toUpperCase()}</div>
          <div class="kn-cadence-title">${cadence.title}</div>
          <div class="kn-cadence-body">${cadence.body}</div>
          <a href="${KNOWTION_URL}" target="_blank" class="kn-cadence-cta">Continue the conversation →</a>
        </div>
      </div>

      <!-- Live data strip (only shown when Pearl loaded) -->
      ${buildDataStrip()}

      <!-- Community pulse cards -->
      <div class="kn-section-label">Community Pulse</div>
      <div class="kn-grid">${cardHTML}</div>

      <!-- Reflection prompts -->
      <div class="kn-section-label">Today's Reflection Prompts</div>
      <div class="kn-prompt-list">${promptHTML}</div>

      <!-- Dept connections -->
      <div class="kn-section-label">Connect with a Department</div>
      <div class="kn-dept-row">${deptChips}</div>

      <!-- Footer CTA -->
      <div style="background:var(--surface-2);border:1px solid var(--border);border-radius:12px;padding:1.25rem 1.5rem;display:flex;align-items:center;justify-content:space-between;gap:1rem;flex-wrap:wrap;">
        <div>
          <div style="font-size:.875rem;font-weight:700;color:var(--navy);margin-bottom:.25rem">Ready to connect?</div>
          <div style="font-size:.8125rem;color:var(--muted)">Knowtion is where NJTC staff share, grow, and lift each other up — all year long.</div>
        </div>
        <a href="${KNOWTION_URL}" target="_blank" class="kn-launch-btn">Open Knowtion →</a>
      </div>
    `;
  }

  // ── showPanel override: trigger Knowtion render when panel opens ──────
  (function() {
    const _knBase = window.showPanel;
    window.showPanel = function(id, btn) {
      if (typeof _knBase === 'function') _knBase(id, btn);
      if (id === 'knowtion') {
        // _currentDept is the portal's global dept variable (set by session/init)
        const dept = (window._currentDept || (window.NJTC_SESSION && window.NJTC_SESSION.dept) || 'hr').toLowerCase();
        setTimeout(() => buildKnowtionPanel(dept), 0);
      }
    };
  })();

  // Expose for external calls (e.g. after dept switch)
  window.kn = { build: buildKnowtionPanel };

})();

(function(){
  // ── Chip detail definitions ─────────────────────────────────────────────
  var CHIP_DEFS = {
    'irl-math': {
      title: 'Math Diagnostic Growth',
      icon: '➕',
      color: '#dcfce7',
      getContent: function(irl) {
        return _buildIrlDetail(irl, 'math');
      }
    },
    'irl-ela': {
      title: 'ELA Diagnostic Growth',
      icon: '📗',
      color: '#ede9fe',
      getContent: function(irl) {
        return _buildIrlDetail(irl, 'ela');
      }
    }
  };

  function _buildIrlDetail(irl, subj) {
    if (!irl) return '<p style="color:var(--muted)">No iReady data loaded.</p>';
    var avgGain      = subj==='math' ? irl.mathAvgGain          : irl.elaAvgGain;
    var medianPctTyp = subj==='math'
      ? (irl.mathMedianPctAllYears!=null ? irl.mathMedianPctAllYears : irl.mathMedianPctTypical)
      : (irl.elaMedianPctAllYears!=null  ? irl.elaMedianPctAllYears  : irl.elaMedianPctTypical);
    var gainN        = subj==='math' ? irl.mathGainN            : irl.elaGainN;
    var label        = subj==='math' ? 'Math'                   : 'ELA (Reading)';
    var sy           = irl.activeSY || 'Historical';

    // Status thresholds based on 100% = full typical growth benchmark
    var statusColor = medianPctTyp===null ? '#374151' : medianPctTyp>=100 ? '#166534' : medianPctTyp>=70 ? '#4338ca' : '#92400e';
    var statusBg    = medianPctTyp===null ? '#f1f5f9'  : medianPctTyp>=100 ? '#dcfce7'  : medianPctTyp>=70 ? '#ede9fe' : '#fef3c7';
    var statusLabel = medianPctTyp===null ? 'Insufficient Data' : medianPctTyp>=100 ? 'At or Above Typical Growth' : medianPctTyp>=70 ? 'Approaching Typical Growth' : 'Below Typical Growth';
    var medDisplay  = medianPctTyp!==null ? medianPctTyp+'%' : '—';

    return [
      // ── Metric summary ──
      '<div style="display:flex;gap:.75rem;margin-bottom:1.25rem;flex-wrap:wrap">',
        _statBox(avgGain!==null ? '+'+avgGain+' pts' : '—', 'Avg Scale Score Gain', '#f0f9ff', '#0369a1'),
        _statBox(medDisplay, 'Median % to Typical Growth', statusBg, statusColor),
      '</div>',

      // ── Status badge ──
      '<div style="display:inline-flex;align-items:center;gap:.4rem;background:'+statusBg+';color:'+statusColor+';border-radius:99px;padding:.3rem .85rem;font-size:.78rem;font-weight:700;margin-bottom:1.2rem">',
        (medianPctTyp===null ? '⚠️' : medianPctTyp>=100 ? '✅' : '📈')+' '+statusLabel,
      '</div>',

      // ── Plain-language explanation ──
      '<div style="background:#f8fafc;border-radius:10px;padding:1rem 1.1rem;margin-bottom:1.1rem;border-left:3px solid #6366f1">',
        '<div style="font-weight:700;font-size:.875rem;color:#1e293b;margin-bottom:.5rem">📖 What This Means</div>',
        '<p style="font-size:.84rem;color:#374151;line-height:1.6;margin:0">',
          'On average, each scholar gained <strong>'+(avgGain!==null ? '+'+avgGain+' scale score points' : 'an unmeasured amount')+'</strong> in '+label+' between their fall (BOY) and spring (EOY) iReady diagnostic.',
          medianPctTyp!==null
            ? ' The <strong>median scholar reached '+medianPctTyp+'% of iReady\'s typical growth benchmark</strong> — the amount an average student nationwide gains in a full school year (100%). Data based on '+gainN+' scholar records in '+sy+'.'
            : ' Median % to Typical Growth could not be computed from this dataset.',
        '</p>',
      '</div>',

      // ── Why it matters ──
      '<div style="background:#f8fafc;border-radius:10px;padding:1rem 1.1rem;margin-bottom:1.1rem;border-left:3px solid #0ea5e9">',
        '<div style="font-weight:700;font-size:.875rem;color:#1e293b;margin-bottom:.5rem">🎯 Why It Matters</div>',
        '<p style="font-size:.84rem;color:#374151;line-height:1.6;margin:0">',
          'NJTC scholars begin significantly below grade level. Reaching or exceeding 100% of typical growth means they are <strong>closing the gap</strong> with peers — not just making incremental progress.',
          ' Median % to Typical Growth is NJTC\'s primary academic reporting metric because it reflects each scholar\'s individual trajectory, not just a cohort-wide average.',
        '</p>',
      '</div>',

      // ── How to read the number ──
      '<div style="background:#f8fafc;border-radius:10px;padding:1rem 1.1rem;margin-bottom:1.1rem;border-left:3px solid #10b981">',
        '<div style="font-weight:700;font-size:.875rem;color:#1e293b;margin-bottom:.5rem">🔢 How to Read the Number</div>',
        '<table style="width:100%;font-size:.8rem;border-collapse:collapse">',
          '<tr style="background:#e2e8f0"><th style="padding:.4rem .6rem;text-align:left;border-radius:6px 0 0 6px">What you see</th><th style="padding:.4rem .6rem;text-align:left">What it means</th></tr>',
          '<tr><td style="padding:.4rem .6rem;color:#0369a1;font-weight:600">'+(avgGain!==null ? '+'+avgGain+' pts' : '—')+'</td><td style="padding:.4rem .6rem;color:#374151">Average scale score gain per scholar (BOY → EOY)</td></tr>',
          '<tr style="background:#f8fafc"><td style="padding:.4rem .6rem;color:'+statusColor+';font-weight:600">'+medDisplay+'</td><td style="padding:.4rem .6rem;color:#374151">Median scholar\'s % of iReady\'s national typical growth benchmark (Spring % Progress field)</td></tr>',
          '<tr><td style="padding:.4rem .6rem;color:#374151;font-weight:600">100%</td><td style="padding:.4rem .6rem;color:#374151">The target — equal to a full year of typical national growth</td></tr>',
          '<tr style="background:#f8fafc"><td style="padding:.4rem .6rem;color:#166534;font-weight:600">&gt;100%</td><td style="padding:.4rem .6rem;color:#374151">Exceeding typical — scholars are closing the gap faster than peers</td></tr>',
        '</table>',
      '</div>',

      // ── Data source ──
      '<div style="font-size:.72rem;color:var(--muted,#94a3b8);display:flex;align-items:center;gap:.4rem;margin-top:.5rem">',
        '<span>📊</span>',
        '<span>Source: iReady Longitudinal Dashboard · '+label+' · '+sy+' · n='+gainN+' scholar records · <em>Spring % Progress to Typical Growth per iReady Compass</em></span>',
      '</div>',
    ].join('');
  }

  function _statBox(val, label, bg, col) {
    return '<div style="background:'+bg+';border-radius:10px;padding:.75rem 1rem;flex:1;min-width:110px;text-align:center">'+
      '<div style="font-size:1.35rem;font-weight:800;color:'+col+';line-height:1">'+val+'</div>'+
      '<div style="font-size:.68rem;color:'+col+';margin-top:.25rem;font-weight:600;line-height:1.3">'+label+'</div>'+
    '</div>';
  }

  window.advOpenChipDetail = function(key) {
    var def = CHIP_DEFS[key];
    if (!def) return;
    var irl = (window.irlab && window.irlab.getSummary) ? window.irlab.getSummary() : null;
    var modal  = document.getElementById('irlChipModal');
    var title  = document.getElementById('irlChipModalTitle');
    var sy     = document.getElementById('irlChipModalSY');
    var body   = document.getElementById('irlChipModalBody');
    if (!modal) return;
    title.textContent = def.title;
    sy.textContent    = irl ? (irl.activeSY || '') : '';
    body.innerHTML    = def.getContent(irl);
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
  };

  window.advCloseChipDetail = function() {
    var modal = document.getElementById('irlChipModal');
    if (modal) modal.style.display = 'none';
    document.body.style.overflow = '';
  };

  // Close on Escape
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') window.advCloseChipDetail();
  });

  // ═══════════════════════════════════════════════════════════════════════
  // NJTC APPRENTICE DATA LAYER — SY 2025-2026
  // Single source of truth for all apprentice logic across all departments
  // Source: HR Master List (updated 2025-2026, active employees only)
  // ap_ namespace — no collisions with existing portal functions
  // ═══════════════════════════════════════════════════════════════════════

  // ── Network / Region derivation from live site + district fields ─────────
  // All values come from the live Master List — no per-person hardcodes.
  // Network is inferred from site/district text; region is derived from network.
  const ap_deriveNetwork = (site, district) => {
    const s = ((site || '') + ' ' + (district || '')).toLowerCase();
    if (s.includes('ilearn') || s.includes('i-learn')) return 'iLearn Charter Network';
    if (s.includes('kipp'))                             return 'KIPP NJ';
    if (s.includes('hoboken') || s.includes('hola'))   return 'Hoboken Dual Charter';
    if (s.includes('global') || s.includes('glaw'))    return 'Global Leadership Academy';
    if (s.includes('hamilton'))                         return 'Hamilton Township';
    if (s.includes('gloucester'))                       return 'Gloucester Township';
    if (s.includes('haddon'))                           return 'Haddon Township';
    if (s.includes('roseville'))                        return 'Roseville';
    if (s.includes('middlesex'))                        return 'Middlesex Charter';
    if (s.includes('somerset'))                         return 'Somerset';
    if (s.includes('penns grove') || s.includes('carneys')) return 'Penns Grove';
    if (s.includes('central jersey'))                        return 'Central Jersey College Prep';
    return 'Other';
  };
  const ap_inferNetwork = ap_deriveNetwork; // alias

  const ap_deriveRegion = (site, district) => {
    const net = ap_deriveNetwork(site, district);
    if (['iLearn Charter Network','KIPP NJ','Hoboken Dual Charter','Global Leadership Academy','Roseville','Middlesex Charter','Somerset','Central Jersey College Prep'].includes(net)) return 'NE';
    if (['Hamilton Township','Gloucester Township','Haddon Township','Penns Grove'].includes(net)) return 'SW';
    return 'Unassigned';
  };

  // ── HR Master List CSV parser (self-contained — mirrors _parseHRMaster logic) ─
  // This script block is a separate IIFE from the HR module, so we replicate the
  // parser here rather than referencing the inaccessible _parseHRMaster function.
  const ap_parseHRMaster = (rawText) => {
    const text = rawText.replace(/\r\n/g,'\n').replace(/\r/g,'\n');
    const splitRow = row => {
      const cells = []; let cell = '', inq = false;
      for (let i = 0; i < row.length; i++) {
        const c = row[i];
        if (c === '"') { if (inq && row[i+1] === '"') { cell += '"'; i++; } else inq = !inq; }
        else if (c === ',' && !inq) { cells.push(cell); cell = ''; }
        else cell += c;
      }
      cells.push(cell);
      return cells;
    };
    const lines = text.split('\n').filter(l => l.trim());
    // Header row: first column contains 'academic' (matches 'Academic Year')
    const hIdx = lines.findIndex(l => /academic/i.test(splitRow(l)[0] || ''));
    if (hIdx < 0) return [];
    const headers = splitRow(lines[hIdx]).map(h => h.trim().toLowerCase());
    const ci = s => headers.findIndex(h => h.includes(s.toLowerCase()));
    const C = {
      yr: ci('academic'), email: ci('email'), name: ci('full name'),
      role: ci('position'), site: ci('site'), district: ci('district'),
      rehire: ci('rehire'), cycles: ci('cycles'), status: ci('terminated'),
      race: ci('race'), ethnicity: ci('ethnicity'), apprentice: ci('apprentice'),
    };
    return lines.slice(hIdx + 1).map(l => {
      const r = splitRow(l);
      return {
        yr:         (r[C.yr]         || '').trim(),
        name:       (r[C.name]       || '').trim(),
        email:      (r[C.email]      || '').trim().toLowerCase(),
        role:       (r[C.role]       || '').trim(),
        site:       (r[C.site]       || '').trim(),
        district:   (r[C.district]   || '').trim(),
        status:     (r[C.status]     || '').trim(),
        cycles:     (r[C.cycles]     || '').trim(),
        rehire:     (r[C.rehire]     || '').trim(),
        race:       C.race      >= 0 ? (r[C.race]      || '').trim() : '',
        ethnicity:  C.ethnicity >= 0 ? (r[C.ethnicity] || '').trim() : '',
        apprentice: C.apprentice >= 0 ? (r[C.apprentice] || '').trim()
                                      : (r[10] ? (r[10] || '').trim() : ''),
      };
    }).filter(r => r.name && r.yr);
  };

  // ── Live data fetch — HR Master List (published CSV) ─────────────────────
  // URL is hardcoded here because this script block is a separate IIFE and
  // cannot access HR_2PACX / HR_GID_MASTER from the HR module's IIFE scope.
  const AP_HR_MASTER_URL = 'https://docs.google.com/spreadsheets/d/e/' +
    '2PACX-1vRc-Air9jhOtvkVelwfvOguzAyFmGIFpQ0sDtu4q8S5kFAgQz_IZo-XBeIfQgy4GB8OdSXoyonTeLT8' +
    '/pub?output=csv&gid=911694457';

  // Authoritative TAP roster sheet — published CSV (live, auto-refreshes)
  // Live Apprentice Tracker — authoritative source for enrolled apprentices (count from live sheet).
  // Columns: A (Date Registered), B (Status), F (Full Name), H (Placement/School), AA (Folder Link)
  // Headers in row 5; status 'Active' = currently enrolled.
  const AP_TAP_SHEET_URL = 'https://docs.google.com/spreadsheets/d/1Dh1-TsuXEwoz4sqA4RBtgylPZ6epencsrJoqxupIEqs/export?format=csv&gid=0';

  window.AP_DATA = []; // Populated by ap_buildFromLive() before any render

  const ap_buildFromLive = async () => {
    try {
      // Use njtc_fetch (defined below) for consistent redirect + error handling
      const result = await njtc_fetch(AP_HR_MASTER_URL, 30000);
      if (!result.ok) throw new Error('HTTP ' + result.status);
      const raw = ap_parseHRMaster(result.text);
      // ── Step 1: filter to 2025-2026, non-terminated rows ──────────────────
      // Also accept short-form "25-26" year values used by some HR data entry.
      const isCurYr = yr => /2025.*(2026|26)/.test(yr) || /^(SY\s*)?25[-\/]26$/i.test(yr);
      const curYrRows = raw.filter(r =>
        isCurYr(r.yr) && !/terminated/i.test(r.status || '')
      );
      // ── Diagnostic: log any "Yes" apprentice rows that were filtered OUT ───
      // This catches the missing-2 case where year format or status excluded them.
      const excludedYes = raw.filter(r =>
        /^yes$/i.test(r.apprentice) && !(isCurYr(r.yr) && !/terminated/i.test(r.status || ''))
      );
      if (excludedYes.length) {
        console.warn('[AP] Excluded "Yes" apprentice rows:', excludedYes.map(r =>
          `${r.name} | yr=${r.yr} | status=${r.status}`));
      }
      // ── Step 2: group by normalized name so multi-row staff count once ────
      // A person can have 2+ rows in the same SY (e.g. site change).
      // We OR all apprentice flags across every row for that person — this is
      // what caused the 27 vs 29 discrepancy: the first-seen row's apprentice
      // cell was blank while a later row had "Yes", and the old simple-dedup
      // kept only the first row.
      const byName = {};
      curYrRows.forEach(r => {
        const k = (r.name || '').toLowerCase().replace(/\s+/g, ' ').trim();
        if (!k) return;
        if (!byName[k]) byName[k] = { rows: [], apYes: false };
        byName[k].rows.push(r);
        // ── Apprentice detection — multiple signal sources ─────────────────
        // Signal 1: dedicated apprentice column (broadened to match any affirmative value)
        const apVal  = (r.apprentice || '').trim();
        const roleVal = (r.role || '').trim();
        const apFromCol = apVal !== '' && !/^no$|not eligible|not enrolled/i.test(apVal)
          && !/^false$/i.test(apVal) && apVal !== '0';
        // Signal 2: position/role field contains "apprentice"
        // Seen in PD data as "Tutor - Apprentice"; may appear in HR Master too.
        const apFromRole = /apprentice/i.test(roleVal);
        if (apFromCol || apFromRole) byName[k].apYes = true;
      });
      // ── Diagnostic: log unique apprentice column values (helps debug counts) ──
      const apValMap = {};
      curYrRows.forEach(r => {
        const v = (r.apprentice || '').trim() || '(blank)';
        apValMap[v] = (apValMap[v] || 0) + 1;
      });
      console.log('[AP] Apprentice col values:', JSON.stringify(apValMap));
      // ── Step 3: map each person to a single AP_DATA entry ─────────────────
      window.AP_DATA = Object.values(byName).map(group => {
        // Use the latest row for contact / assignment fields
        const r = group.rows[group.rows.length - 1];
        const apRaw = (r.apprentice || '').trim();
        const ap    = /not eligible/i.test(apRaw)  ? 'Not eligible'
                    : group.apYes                   ? 'Yes'
                    : /^no$|^false$|^0$/i.test(apRaw) ? 'No'
                    : apRaw === ''                  ? 'No'
                    : apRaw;
        return {
          name:       r.name,
          role:       r.role       || '',
          site:       r.site       || '',
          district:   r.district   || '',
          network:    ap_deriveNetwork(r.site, r.district),
          region:     ap_deriveRegion(r.site, r.district),
          apprentice: ap,
          rehire:     r.rehire     || '',
          cycles:     r.cycles     || '1',
          email:      r.email      || '',
        };
      });
      console.log('[AP] Live build: ' + window.AP_DATA.length + ' active staff · '
                  + ap_enrolled().length + ' enrolled · source: HR Master List');
    } catch (err) {
      console.warn('[AP] Master List fetch failed — AP_DATA empty:', err.message);
      window.AP_DATA = [];
    }
  };

  // ── TAP Sheet fetch — authoritative enrolled roster with folder links ─────
  // Published CSV from the dedicated TAP apprentice tracking sheet.
  // Headers in row 5 — parser finds the header row dynamically by scanning for
  // "status" in col B so the row offset is resilient to future sheet changes.
  const ap_buildFromTAPSheet = async () => {
    // njtc_loadAll() builds AP_TAP_ROSTER from the same Live Tracker fetch — skip if already done
    if (window.AP_TAP_ROSTER && window.AP_TAP_ROSTER.length > 0) {
      console.log('[AP] TAP Roster already populated (' + window.AP_TAP_ROSTER.length + ' entries from Live Tracker) — skipping fetch');
      return;
    }
    window.AP_TAP_ROSTER = [];
    try {
      const result = await njtc_fetch(AP_TAP_SHEET_URL, 30000);
      if (!result.ok) throw new Error('HTTP ' + result.status);
      const splitRow = row => {
        const cells = []; let cell = '', inq = false;
        for (let i = 0; i < row.length; i++) {
          const c = row[i];
          if (c === '"') { if (inq && row[i+1] === '"') { cell += '"'; i++; } else inq = !inq; }
          else if (c === ',' && !inq) { cells.push(cell); cell = ''; }
          else cell += c;
        }
        cells.push(cell);
        return cells;
      };
      const lines = result.text.replace(/\r\n/g,'\n').replace(/\r/g,'\n')
        .split('\n').filter(l => l.trim());
      // Find header row: require both B contains 'status' AND F contains 'name'.
      // Skip rows 0-3 (title rows before row 5). Fallback to index 4 (row 5).
      let hIdx = lines.findIndex((l, i) => {
        if (i < 4) return false;
        const cells = splitRow(l);
        const b = (cells[1] || '').trim().toLowerCase();
        const f = (cells[5] || '').trim().toLowerCase();
        return b.includes('status') && f.includes('name');
      });
      if (hIdx < 0) hIdx = 4; // fallback: row 5 per confirmed Live Tracker structure
      // Column indices (0-based): A=0 B=1 E=4 F=5 H=7 AA=26
      const COL = { dateReg: 0, status: 1, cohort: 4, name: 5, placement: 7, folderLink: 26 };
      window.AP_TAP_ROSTER = lines.slice(hIdx + 1).map(line => {
        const cells = splitRow(line);
        return {
          dateReg:    (cells[COL.dateReg]    || '').trim(),
          status:     (cells[COL.status]     || '').trim(),
          cohort:     (cells[COL.cohort]     || '').trim(),
          name:       (cells[COL.name]       || '').trim(),
          placement:  (cells[COL.placement]  || '').trim(),
          folderLink: (cells[COL.folderLink] || '').trim(),
        };
      }).filter(r => r.name && /active/i.test(r.status));
      console.log('[AP] TAP Sheet: ' + window.AP_TAP_ROSTER.length + ' active records');
    } catch (err) {
      console.warn('[AP] TAP Sheet fetch failed:', err.message);
      window.AP_TAP_ROSTER = [];
    }
  };

  // ── Merge HR data + TAP sheet into final AP_DATA ──────────────────────────
  // Enrolled = union of TAP-sheet actives (primary) + HR Master List apprentice=Yes
  // who are NOT in the TAP sheet (supplement). This prevents HR-confirmed apprentices
  // from being silently dropped when the TAP sheet hasn't been updated yet.
  const ap_mergeTAPData = () => {
    const tapRoster = window.AP_TAP_ROSTER || [];
    if (!tapRoster.length) return;
    const nm = s => (s || '').toLowerCase().replace(/\s+/g, ' ').trim();
    const hrByName = {};
    (window.AP_DATA || []).forEach(r => { hrByName[nm(r.name)] = r; });
    const tapNames = new Set(tapRoster.map(r => nm(r.name)));
    const hrEligible = (window.AP_DATA || []).filter(r =>
      r.apprentice !== 'Yes' && !tapNames.has(nm(r.name))
    );
    // Live Tracker whitelist — source of truth for ADP-active apprentices.
    // njtcLiveOtjMap is keyed by lowercased name from the Live Apprentice Tracker sheet
    // (1Dh1-...) — contains the currently ADP-active apprentices (count varies by SY).
    // njtcLiveOtjMap is built in njtc_loadAll() before ap_mergeTAPData() is ever called.
    // Fuzzy match: try full name, first+last only, and reversed "Last, First" variants.
    const _ltMap = window.njtcLiveOtjMap || {};
    const _ltKeys = new Set(Object.keys(_ltMap));
    const _fl2 = n => { const p = n.split(/\s+/).filter(w => w.length > 1 && !/^[a-z]\.?$/i.test(w)); return p.length > 1 ? p[0]+' '+p[p.length-1] : n; };
    const _inLT = name => {
      const k = nm(name);
      if (_ltKeys.has(k)) return true;
      const fl = _fl2(k);
      if (fl !== k && _ltKeys.has(fl)) return true;
      // Try matching each Live Tracker key against first+last of the TAP name
      for (const ltk of _ltKeys) { if (_fl2(ltk) === fl) return true; }
      return false;
    };
    // Only filter when Live Tracker loaded successfully (has entries); otherwise keep all TAP entries
    const activeRoster = _ltKeys.size > 0
      ? tapRoster.filter(tap => _inLT(tap.name))
      : tapRoster;
    console.log('[AP] Live Tracker whitelist: ' + _ltKeys.size + ' keys · TAP=' + tapRoster.length + ' · active=' + activeRoster.length);
    const enrolled = activeRoster.map(tap => {
      const hrMatch = hrByName[nm(tap.name)];
      // TAP placement is the authoritative current school — derive network from it first.
      // HR site/district is only used as a fallback when placement alone is ambiguous.
      let network = ap_deriveNetwork(tap.placement, '');
      let region  = ap_deriveRegion(tap.placement, '');
      if (network === 'Other' && hrMatch) {
        network = ap_deriveNetwork(hrMatch.site, hrMatch.district);
        region  = ap_deriveRegion(hrMatch.site, hrMatch.district);
      }
      // Final fallback: explicit keywords in cohort seat text (e.g. "NE - iLearn Seat 1")
      if (network === 'Other' && tap.cohort) {
        const cs = tap.cohort.toLowerCase();
        if      (cs.includes('ilearn') || cs.includes('i-learn')) { network = 'iLearn Charter Network';     region = 'NE'; }
        else if (cs.includes('kipp'))                              { network = 'KIPP NJ';                   region = 'NE'; }
        else if (cs.includes('hamilton'))                          { network = 'Hamilton Township';          region = 'SW'; }
        else if (cs.includes('gloucester'))                        { network = 'Gloucester Township';        region = 'SW'; }
        else if (cs.includes('haddon'))                            { network = 'Haddon Township';            region = 'SW'; }
        else if (cs.includes('penns') || cs.includes('carneys'))   { network = 'Penns Grove';               region = 'SW'; }
        else if (cs.includes('somerset'))                          { network = 'Somerset';                   region = 'NE'; }
        else if (cs.includes('middlesex'))                         { network = 'Middlesex Charter';          region = 'NE'; }
        else if (cs.includes('central jersey'))                    { network = 'Central Jersey College Prep'; region = 'NE'; }
        else if (cs.includes('hoboken') || cs.includes('hola'))    { network = 'Hoboken Dual Charter';      region = 'NE'; }
        else if (cs.includes('global') || cs.includes('glaw'))     { network = 'Global Leadership Academy'; region = 'NE'; }
        else if (cs.includes('roseville'))                         { network = 'Roseville';                  region = 'NE'; }
        else if (cs.startsWith('ne'))                              { region = 'NE'; }
        else if (cs.startsWith('sw'))                              { region = 'SW'; }
      }
      return {
        name:       tap.name,
        role:       (hrMatch && hrMatch.role)   || 'Tutor Apprentice',
        site:       tap.placement || (hrMatch && hrMatch.site) || '',
        district:   (hrMatch && hrMatch.district) || '',
        network:    network,
        region:     region,
        apprentice: 'Yes',
        cohort:     tap.cohort,
        dateReg:    tap.dateReg,
        folderLink: tap.folderLink,
        email:      (hrMatch && hrMatch.email)  || '',
        rehire:     (hrMatch && hrMatch.rehire) || '',
        cycles:     (hrMatch && hrMatch.cycles) || '',
      };
    });

    // Supplement: HR-confirmed apprentices not yet in the Live Tracker.
    // Guarded by the Live Tracker whitelist to prevent people removed from the tracker
    // from being re-added via the HR master list.
    const hrOnlyEnrolled = (window.AP_DATA || []).filter(r =>
      r.apprentice === 'Yes' && !tapNames.has(nm(r.name)) &&
      (_ltKeys.size === 0 || _inLT(r.name))
    );
    if (hrOnlyEnrolled.length) {
      console.warn('[AP] ' + hrOnlyEnrolled.length + ' HR-confirmed apprentice(s) not in TAP sheet — adding to enrolled. Add to TAP sheet to resolve:',
        hrOnlyEnrolled.map(r => '"' + r.name + '"').join(', '));
    }

    window.AP_DATA = hrEligible.concat(enrolled).concat(hrOnlyEnrolled);
    console.log('[AP] Merged: ' + enrolled.length + ' enrolled (TAP) + ' +
      hrOnlyEnrolled.length + ' enrolled (HR-only) + ' +
      hrEligible.length + ' eligible (HR) = ' + window.AP_DATA.length + ' total');
    // Sync apprentice status to HR_EMPS so Talent Analytics filter shows correct count
    ap_syncHREmps(new Set(activeRoster.map(r => nm(r.name))));
  };

  // Push TAP enrolled status into HR_EMPS so the Talent Analytics "Apprentice" filter works
  const ap_syncHREmps = (enrolledNames) => {
    const hrEmps = window.HR_EMPS;
    if (!hrEmps || !hrEmps.length) return;
    const nm = s => (s || '').toLowerCase().replace(/\s+/g, ' ').trim();
    let synced = 0;
    hrEmps.forEach(emp => {
      const n = nm(emp.n || emp.name || '');
      if (enrolledNames.has(n)) {
        emp._apprentice = 'Yes';
        synced++;
      }
    });
    if (synced) console.log('[AP] Synced ' + synced + ' HR_EMPS records → apprentice=Yes (TAP sheet)');
  };

  // ── Utility functions — all derived from live AP_DATA (zero hardcodes) ───
  const ap_enrolled    = () => AP_DATA.filter(r => r.apprentice === 'Yes');
  const ap_eligible    = () => AP_DATA.filter(r => r.apprentice === 'No');
  const ap_notEligible = () => AP_DATA.filter(r => r.apprentice === 'Not eligible' || r.apprentice === '');
  const ap_totalActive = () => AP_DATA.length;  // All active 2025-2026 staff from Master List

  const ap_byNetwork = () => {
    const map = {};
    ap_enrolled().forEach(r => {
      if (!map[r.network]) map[r.network] = [];
      map[r.network].push(r);
    });
    return map;
  };

  const ap_byRegion = () => ({
    NE: ap_enrolled().filter(r => r.region === 'NE'),
    SW: ap_enrolled().filter(r => r.region === 'SW'),
    Unassigned: ap_enrolled().filter(r => r.region === 'Unassigned'),
  });

  // ap_getOTJ — O(1) lookup via njtcOTJMap (built when APPRENTICE_DB loads).
  // Falls back to linear search on njtcOTJ if map not yet built.
  const ap_getOTJ = (name) => {
    const n = (name || '').toLowerCase().replace(/\s+/g,' ').trim();
    if (window.njtcOTJMap) return window.njtcOTJMap[n] || null;
    const rows = window.njtcOTJ;
    if (!rows || !rows.length) return null;
    return rows.find(function(r) {
      var mn = (r['Master List Name'] || '').toLowerCase().replace(/\s+/g,' ').trim();
      var tn = (r['Tracker Name']    || '').toLowerCase().replace(/\s+/g,' ').trim();
      return mn === n || tn === n;
    }) || null;
  };

  // ap_otjStatus — uses exact OTJ column names from OTJ_COLS (verified CSV headers)
  const ap_otjStatus = (name) => {
    const otj = ap_getOTJ(name);
    if (!otj) return { beginning:'—', middle:'—', end:'—', siteLeader:'—', pmNotes:'' };
    return {
      beginning:  otj['OTJ Beginning']  || '—',
      middle:     otj['OTJ Middle']     || '—',
      end:        otj['OTJ End']        || '—',
      siteLeader: otj['Site Leader']    || '—',
      pmNotes:    otj['OTJ PM Notes']   || '',
    };
  };

  // ap_hasOTJFlag — detects attention-needed conditions from Program DB OTJ row.
  // Observation month columns (October–April) live in separate obs sheets not loaded
  // by this module — those are excluded to avoid false-positive flags.
  const ap_hasOTJFlag = (row) => {
    if (!row) return false;
    const b  = (row['OTJ Beginning'] || '').trim();
    const m  = (row['OTJ Middle']    || '').trim();
    const sl = (row['Site Leader']   || '').trim();
    return (
      b === 'Not Started - PM Following Up' ||
      b === 'Not Started' ||
      sl === '' ||
      (b !== 'Completed' && m !== '' && m !== '—')
    );
  };

  const ap_hasFlag = (name) => ap_hasOTJFlag(ap_getOTJ(name));

  const ap_badge = (text, size) => {
    text = text || 'APPRENTICE';
    size = size || '9px';
    return '<span style="display:inline-block;background:#B8960C;color:white;font-size:' + size + ';font-weight:800;text-transform:uppercase;letter-spacing:0.07em;padding:2px 7px;border-radius:10px;vertical-align:middle;margin-left:5px;line-height:1.6;">' + text + '</span>';
  };

  const ap_flagBadge = (text) => {
    text = text || 'NEEDS ATTENTION';
    return '<span style="display:inline-block;background:#DC2626;color:white;font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:0.06em;padding:2px 7px;border-radius:10px;vertical-align:middle;margin-left:5px;">' + text + '</span>';
  };

  const ap_dotStatus = (status) => {
    const map = {
      'Completed':                    '#16A34A',
      'In Progress':                  '#D97706',
      'Not Started - PM Following Up':'#DC2626',
      'Not Started':                  '#DC2626',
      '—': '#9CA3AF', '': '#9CA3AF', 'N/A': '#9CA3AF',
    };
    return '<span style="display:inline-block;width:9px;height:9px;border-radius:50%;background:' + (map[status]||'#9CA3AF') + ';margin-right:4px;" title="' + status + '"></span>';
  };

  // Live Tracker OTJ item count lookup.
  // Falls back to phase-based estimation from Program DB (Beginning=6, Middle=12, End=17)
  // when the Live Tracker map has no matching entry — happens when the sheet's column
  // structure doesn't align with the expected AB-AR range (e.g. after GAINS import).
  const ap_otjItemCount = (name) => {
    const map = window.njtcLiveOtjMap || {};
    const key = (name || '').toLowerCase().replace(/\s+/g,' ').trim();
    if (map.hasOwnProperty(key)) return map[key];

    // Phase-based fallback: derive approximate count from OTJ Beginning/Middle/End
    const otj = ap_getOTJ(name);
    if (!otj) return null;
    const beg = (otj['OTJ Beginning'] || '').trim();
    const mid = (otj['OTJ Middle']    || '').trim();
    const end = (otj['OTJ End']       || '').trim();
    if (!beg || beg === '—') return null; // no phase data at all

    const done  = /completed|meets expectations/i;
    const inprog = /in progress|partially/i;
    // Items per phase: Beginning=6, Middle=6, End=5 (total 17)
    let count = 0;
    if      (done.test(beg))   count += 6;
    else if (inprog.test(beg)) count += 3;
    if      (done.test(mid))   count += 6;
    else if (inprog.test(mid) && done.test(beg)) count += 3;
    if      (done.test(end))   count += 5;
    else if (inprog.test(end) && done.test(mid)) count += 2;
    return count;
  };

  const ap_otjCountBadge = (count) => {
    if (count === null || count === undefined) return '<span style="font-size:10px;color:#9CA3AF;">—</span>';
    var pct = LIVE_TRACKER_OTJ_COLS > 0 ? Math.round(count / LIVE_TRACKER_OTJ_COLS * 100) : 0;
    var color = pct >= 80 ? '#16A34A' : pct >= 40 ? '#D97706' : count > 0 ? '#2563EB' : '#9CA3AF';
    return '<span style="font-weight:700;font-size:11px;color:' + color + ';">' + count + '<span style="font-weight:400;color:#9CA3AF;">/' + LIVE_TRACKER_OTJ_COLS + '</span></span>';
  };

  const ap_openModal = (titleText, bodyHTML) => {
    let overlay = document.getElementById('ap-modal-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'ap-modal-overlay';
      overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.55);z-index:99999;display:flex;align-items:center;justify-content:center;';
      overlay.onclick = function(e) { if(e.target===overlay) overlay.remove(); };
      document.body.appendChild(overlay);
    }
    overlay.innerHTML = '<div style="background:white;border-radius:16px;padding:32px;max-width:640px;width:92%;max-height:82vh;overflow-y:auto;position:relative;box-shadow:0 20px 60px rgba(0,0,0,0.3);border-top:4px solid #B8960C;"><button onclick="document.getElementById(\'ap-modal-overlay\').remove()" style="position:absolute;top:14px;right:16px;background:none;border:none;font-size:1.4rem;cursor:pointer;color:#6b7280;line-height:1;">✕</button><h2 style="color:#002855;font-size:1.1rem;font-weight:800;margin:0 0 20px;padding-bottom:12px;border-bottom:2px solid #f3f4f6;">' + titleText + '</h2>' + bodyHTML + '</div>';
    overlay.style.display = 'flex';
  };
  window.ap_openModal = ap_openModal;

  // ── PART 2: Executive Department Badges ──────────────────────────────────
  const ap_renderExecBadges = () => {
    const strip = document.getElementById('exec-kpi-strip')
      || document.querySelector('[data-dept="executive"] .kpi-strip')
      || document.querySelector('[data-dept="executive"] .kpi-row')
      || document.querySelector('#tab-executive .kpi-strip')
      || document.querySelector('#tab-kb .kpi-strip')
      || document.getElementById('homeStatsStrip')
      || document.querySelector('.stats-strip');
    if (!strip) return;

    const enrolled    = ap_enrolled();
    const networkMap  = ap_byNetwork();
    const regionData  = ap_byRegion();
    const networkCount = Object.keys(networkMap).length;

    const badge1 = document.createElement('div');
    badge1.className = 'stat-tile';
    badge1.style.cssText = 'background:#002855;color:white;border-radius:12px;padding:18px 20px;text-align:center;cursor:pointer;min-width:140px;box-shadow:0 2px 8px rgba(0,40,85,0.15);transition:all 0.2s;border:2px solid transparent;--accent-color:#B8960C;';
    badge1.onmouseenter = function() { badge1.style.transform='translateY(-3px)'; badge1.style.borderColor='#B8960C'; badge1.style.boxShadow='0 6px 20px rgba(184,150,12,0.35)'; };
    badge1.onmouseleave = function() { badge1.style.transform=''; badge1.style.borderColor='transparent'; badge1.style.boxShadow='0 2px 8px rgba(0,40,85,0.15)'; };
    badge1.innerHTML = '<div style="font-size:2rem;font-weight:800;color:#B8960C;line-height:1;">' + enrolled.length + '</div><div style="font-size:11px;text-transform:uppercase;letter-spacing:0.08em;color:rgba(255,255,255,0.85);margin-top:5px;">Active Apprentices</div><div style="font-size:10px;color:rgba(255,255,255,0.5);margin-top:3px;">' + networkCount + ' locations · Click for details</div>';
    badge1.onclick = function() {
      const netHTML = Object.entries(networkMap)
        .sort(function(a,b){ return b[1].length - a[1].length; })
        .map(function(entry) {
          const net = entry[0]; const members = entry[1];
          return '<div style="margin-bottom:14px;"><div style="font-weight:700;color:#002855;font-size:13px;margin-bottom:4px;">' + net + ' <span style="color:#B8960C;font-weight:800;">(' + members.length + ')</span></div>' +
            members.map(function(m) {
              return '<div style="display:flex;align-items:center;gap:8px;padding:5px 0;border-bottom:1px solid #f3f4f6;"><div style="width:6px;height:6px;border-radius:50%;background:#B8960C;flex-shrink:0;"></div><span style="font-size:12px;color:#374151;flex:1;">' + m.name + '</span><span style="font-size:10px;color:#9CA3AF;">' + m.site.replace('iLearn Science & Arts Charter ','').replace('iLearn CMO','CMO') + '</span></div>';
            }).join('') + '</div>';
        }).join('');
      ap_openModal('Active Apprentices — ' + enrolled.length + ' Enrolled · SY 2025-2026',
        '<div style="display:flex;gap:16px;margin-bottom:20px;flex-wrap:wrap;">' +
        '<div style="background:#EFF6FF;border-radius:10px;padding:12px 16px;text-align:center;flex:1;"><div style="font-size:1.4rem;font-weight:800;color:#002855;">' + regionData.NE.length + '</div><div style="font-size:10px;color:#6B7280;text-transform:uppercase;letter-spacing:0.06em;">NE Region</div></div>' +
        '<div style="background:#FFF9E6;border-radius:10px;padding:12px 16px;text-align:center;flex:1;"><div style="font-size:1.4rem;font-weight:800;color:#B8960C;">' + regionData.SW.length + '</div><div style="font-size:10px;color:#6B7280;text-transform:uppercase;letter-spacing:0.06em;">SW Region</div></div>' +
        '<div style="background:#F0FDF4;border-radius:10px;padding:12px 16px;text-align:center;flex:1;"><div style="font-size:1.4rem;font-weight:800;color:#16A34A;">' + networkCount + '</div><div style="font-size:10px;color:#6B7280;text-transform:uppercase;letter-spacing:0.06em;">Networks</div></div>' +
        '</div><div style="font-size:11px;font-weight:700;color:#9CA3AF;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:10px;">By Location</div>' +
        netHTML +
        '<div style="margin-top:16px;padding:10px 14px;background:#FFF9E6;border-radius:8px;font-size:11px;color:#92400E;">💡 ' + ap_eligible().length + ' additional tutors are eligible but not yet enrolled in the apprenticeship program.</div>'
      );
    };

    const badge2 = document.createElement('div');
    badge2.className = 'stat-tile';
    badge2.style.cssText = badge1.style.cssText;
    badge2.onmouseenter = badge1.onmouseenter;
    badge2.onmouseleave = badge1.onmouseleave;
    badge2.innerHTML = '<div style="font-size:1.5rem;font-weight:800;color:#B8960C;line-height:1;">' + ap_eligible().length + '</div><div style="font-size:11px;text-transform:uppercase;letter-spacing:0.08em;color:rgba(255,255,255,0.85);margin-top:5px;">Eligible · Not Enrolled</div><div style="font-size:10px;color:rgba(255,255,255,0.5);margin-top:3px;">' + ap_notEligible().length + ' not eligible · Click for breakdown</div>';
    badge2.onclick = function() {
      const eligibleList = ap_eligible().map(function(r) {
        return '<div style="padding:5px 0;border-bottom:1px solid #f3f4f6;font-size:12px;color:#374151;display:flex;justify-content:space-between;"><span>' + r.name + '</span><span style="color:#9CA3AF;font-size:11px;">' + r.network + '</span></div>';
      }).join('');
      ap_openModal('Apprentice Eligibility Breakdown',
        '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:20px;">' +
        '<div style="background:#F0FDF4;border-radius:10px;padding:14px;text-align:center;"><div style="font-size:1.6rem;font-weight:800;color:#16A34A;">' + ap_enrolled().length + '</div><div style="font-size:10px;color:#6B7280;text-transform:uppercase;">Enrolled (Yes)</div></div>' +
        '<div style="background:#FFF9E6;border-radius:10px;padding:14px;text-align:center;"><div style="font-size:1.6rem;font-weight:800;color:#B8960C;">' + ap_eligible().length + '</div><div style="font-size:10px;color:#6B7280;text-transform:uppercase;">Eligible — Not Enrolled</div></div>' +
        '<div style="background:#F9FAFB;border-radius:10px;padding:14px;text-align:center;"><div style="font-size:1.6rem;font-weight:800;color:#6B7280;">' + ap_notEligible().length + '</div><div style="font-size:10px;color:#6B7280;text-transform:uppercase;">Not Eligible</div></div>' +
        '</div><div style="font-size:11px;font-weight:700;color:#9CA3AF;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:8px;">Eligible but not yet enrolled (' + ap_eligible().length + ')</div>' +
        eligibleList +
        '<div style="margin-top:14px;padding:10px 14px;background:#EFF6FF;border-radius:8px;font-size:11px;color:#1E40AF;">📌 "Not eligible" includes Dual Role staff, ICs, SCs, PMs, and multi-site sub tutors in administrative capacities.</div>'
      );
    };

    strip.appendChild(badge1);
    strip.appendChild(badge2);
  };

  // ── PART 3A: HR Filter Bar ────────────────────────────────────────────────
  const ap_renderHRFilterBar = () => {
    const hrContent = document.getElementById('tab-hr')
      || document.getElementById('tab-talent')
      || document.querySelector('[data-dept="hr"]')
      || document.querySelector('[data-dept="talent"]')
      || document.getElementById('panel-talent');
    if (!hrContent) return;

    if (document.getElementById('ap-hr-filter-bar')) return;

    const tableTarget = hrContent.querySelector('table, .roster, .staff-list, .talent-table');

    const filterBar = document.createElement('div');
    filterBar.id = 'ap-hr-filter-bar';
    filterBar.style.cssText = 'display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:16px;padding:14px 18px;background:#F8FAFC;border-radius:10px;border:1px solid #E5E7EB;';
    filterBar.innerHTML = '<div style="font-size:11px;font-weight:700;color:#002855;text-transform:uppercase;letter-spacing:0.06em;white-space:nowrap;">🎓 Filter by Apprentice Status</div>' +
      ['All','Yes','No','Not eligible'].map(function(val) {
        var label = val === 'Yes' ? '🟡 Enrolled' : val === 'No' ? '⚪ Eligible' : val === 'Not eligible' ? '🔘 Not Eligible' : '🔵 All Staff';
        var count = val === 'All' ? ap_totalActive() : val === 'Yes' ? ap_enrolled().length : val === 'No' ? ap_eligible().length : ap_notEligible().length;
        var active = val === 'All';
        var btnStyle = active ? 'background:#002855;color:white;border-color:#002855;' : 'background:white;color:#6B7280;border-color:#E5E7EB;';
        return '<button onclick="ap_hrFilter(\'' + val.replace("'","\\'") + '\')" id="ap-hr-btn-' + val.replace(' ','_') + '" style="padding:6px 16px;border-radius:20px;border:2px solid;font-size:12px;font-weight:600;cursor:pointer;transition:all 0.15s;' + btnStyle + '">' + label + ' (' + count + ')</button>';
      }).join('') +
      '<div id="ap-hr-active-filter" style="margin-left:auto;font-size:11px;color:#9CA3AF;"></div>';

    if (tableTarget && tableTarget.parentNode) {
      tableTarget.parentNode.insertBefore(filterBar, tableTarget);
    } else {
      hrContent.prepend(filterBar);
    }
  };

  window.ap_hrFilter = function(val) {
    ['All','Yes','No','Not_eligible'].forEach(function(v) {
      var btn = document.getElementById('ap-hr-btn-' + v);
      if (!btn) return;
      var isActive = v.replace('_',' ') === val || (v === 'All' && val === 'All');
      btn.style.background = isActive ? '#002855' : 'white';
      btn.style.color = isActive ? 'white' : '#6B7280';
      btn.style.borderColor = isActive ? '#002855' : '#E5E7EB';
    });

    var rows = document.querySelectorAll('#tab-hr tr[data-name], #tab-talent tr[data-name], [data-dept="hr"] tr, [data-dept="talent"] tr, #panel-talent tr[data-name]');
    var shown = 0;
    rows.forEach(function(row) {
      var nameCell = row.querySelector('td:first-child, [data-col="name"]');
      if (!nameCell) return;
      var rowName = nameCell.textContent.trim().toLowerCase();
      var record  = AP_DATA.find(function(r) { return r.name.toLowerCase() === rowName; });
      var matchesFilter = val === 'All' || (record && record.apprentice === val);
      row.style.display = matchesFilter ? '' : 'none';
      var badge = nameCell.querySelector('.ap-inline-badge');
      if (!badge && record && record.apprentice === 'Yes') {
        nameCell.insertAdjacentHTML('beforeend', ap_badge());
        badge = nameCell.querySelector('.ap-inline-badge');
      }
      if (badge) badge.style.display = record && record.apprentice === 'Yes' ? '' : 'none';
      if (matchesFilter) shown++;
    });

    if (shown === 0) {
      var allRows = document.querySelectorAll('#tab-hr tbody tr, #tab-talent tbody tr, [data-dept="hr"] tbody tr, #panel-talent tbody tr');
      allRows.forEach(function(row) {
        var cells = row.querySelectorAll('td');
        if (!cells.length) return;
        var rowText = Array.from(cells).map(function(c){return c.textContent;}).join(' ');
        var record = AP_DATA.find(function(r) { return rowText.toLowerCase().includes(r.name.toLowerCase()); });
        var matchesFilter = val === 'All' || (record && record.apprentice === val);
        row.style.display = matchesFilter ? '' : 'none';
        if (record && record.apprentice === 'Yes' && !row.querySelector('.ap-inline-badge')) {
          if (cells[0]) cells[0].insertAdjacentHTML('beforeend', ap_badge());
        }
      });
    }

    var label = document.getElementById('ap-hr-active-filter');
    if (label) label.textContent = val === 'All' ? 'Showing all staff' : 'Filtered: Apprentice = "' + val + '"';
  };

  // ── PART 3B: HR Apprentice Roster Panel ──────────────────────────────────
  const ap_renderHRApprenticePanel = () => {
    const hrContent = document.getElementById('tab-hr')
      || document.getElementById('tab-talent')
      || document.querySelector('[data-dept="hr"]')
      || document.getElementById('panel-talent');
    if (!hrContent) return;
    if (document.getElementById('ap-hr-roster-panel')) return;

    const enrolled = ap_enrolled();

    const rows = enrolled.map(function(r) {
      const flagged = ap_hasFlag(r.name);
      const ltCount = ap_otjItemCount(r.name);
      const ltPct   = ltCount !== null ? Math.round(ltCount / LIVE_TRACKER_OTJ_COLS * 100) + '%' : '—';
      return '<tr style="border-bottom:1px solid #F3F4F6;"><td style="padding:10px 12px;font-size:12px;font-weight:600;color:#002855;">' + r.name + (flagged ? ap_flagBadge('FLAG') : '') + '</td><td style="padding:10px 12px;font-size:11px;color:#6B7280;">' + r.role + '</td><td style="padding:10px 12px;font-size:11px;color:#6B7280;">' + r.network + '</td><td style="padding:10px 12px;font-size:11px;color:#6B7280;">' + (r.site.length > 30 ? r.site.substring(0,30)+'…' : r.site) + '</td><td style="padding:10px 12px;text-align:center;">' + ap_otjCountBadge(ltCount) + '</td><td style="padding:10px 12px;text-align:center;font-size:11px;color:#6B7280;">' + ltPct + '</td><td style="padding:10px 12px;font-size:11px;color:#6B7280;">' + (r.rehire === 'Yes' ? '✅' : '—') + '</td><td style="padding:10px 12px;font-size:11px;color:#6B7280;">' + r.cycles + ' cycle' + (r.cycles==='1'?'':'s') + '</td></tr>';
    }).join('');

    const flagCount = enrolled.filter(function(r) { return ap_hasFlag(r.name); }).length;

    var hrStorageKey = 'njtc_ap_hr_open';
    var hrOpen = localStorage.getItem(hrStorageKey) === '1'; // collapsed by default

    const panel = document.createElement('div');
    panel.id = 'ap-hr-roster-panel';
    panel.style.cssText = 'margin-top:28px;';
    panel.innerHTML =
      '<div style="background:white;border-radius:12px;border:1px solid #E5E7EB;overflow:hidden;box-shadow:0 2px 8px rgba(0,40,85,0.07);">' +
      // ── Accordion header ────────────────────────────────────────────────
      '<div onclick="(function(){' +
          'var b=document.getElementById(\'ap-hr-roster-body\');' +
          'var i=document.getElementById(\'ap-hr-roster-icon\');' +
          'var open=b.style.display===\'none\';' +
          'b.style.display=open?\'\':\'none\';' +
          'i.textContent=open?\'▾\':\'▸\';' +
          'try{localStorage.setItem(\'njtc_ap_hr_open\',open?\'1\':\'0\');}catch(e){}' +
        '})()" style="background:#002855;padding:16px 20px;display:flex;align-items:center;justify-content:space-between;cursor:pointer;user-select:none;">' +
        '<div style="display:flex;align-items:center;gap:10px;">' +
          '<span id="ap-hr-roster-icon" style="color:rgba(255,255,255,0.7);font-size:14px;">' + (hrOpen ? '▾' : '▸') + '</span>' +
          '<div>' +
            '<div style="color:white;font-size:14px;font-weight:800;">🎓 Apprentice Program Roster</div>' +
            '<div style="color:rgba(255,255,255,0.5);font-size:11px;margin-top:2px;">' + enrolled.length + ' enrolled · SY 2025–2026 · click to expand</div>' +
          '</div>' +
        '</div>' +
        (flagCount > 0 ? '<div style="background:#DC2626;color:white;padding:5px 12px;border-radius:20px;font-size:11px;font-weight:700;">⚠ ' + flagCount + ' Flagged</div>' : '<div style="background:rgba(22,163,74,0.25);color:#86efac;padding:5px 12px;border-radius:20px;font-size:11px;font-weight:700;">✅ No Flags</div>') +
      '</div>' +
      // ── Accordion body ──────────────────────────────────────────────────
      '<div id="ap-hr-roster-body" style="display:' + (hrOpen ? '' : 'none') + ';">' +
        '<div style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;">' +
        '<thead><tr style="background:#F8FAFC;border-bottom:2px solid #E5E7EB;">' +
        ['Name','Role','Network','School/Site','OTJ Items','% Done','Re-hire','Cycles'].map(function(h) {
          return '<th style="padding:10px 12px;text-align:left;font-size:10px;font-weight:700;color:#6B7280;text-transform:uppercase;letter-spacing:0.06em;white-space:nowrap;">' + h + '</th>';
        }).join('') +
        '</tr></thead><tbody>' + rows + '</tbody></table></div>' +
        '<div style="padding:12px 20px;background:#FFF9E6;border-top:1px solid #E5E7EB;font-size:11px;color:#92400E;">💡 Wage increases are tied to OTJ hours completed: 1,100 / 2,200 / 3,300 / 3,800 / 4,000 hours. District cost-sharing agreements are tracked separately in the Wage Reimbursement sheet.</div>' +
      '</div>' +
      '</div>';
    hrContent.appendChild(panel);
  };

  // ── PART 4A: Tag Programming Cards ───────────────────────────────────────
  const ap_tagProgrammingCards = () => {
    const progTab = document.getElementById('tab-programming')
      || document.querySelector('[data-dept="programming"]')
      || document.getElementById('panel-talent');
    if (!progTab) return;

    const cards = progTab.querySelectorAll('.tutor-card, .staff-card, .program-card, [data-staff], tr[data-tutor], tr[data-name]');
    cards.forEach(function(card) {
      const nameEl = card.querySelector('[data-name], .card-name, .staff-name, td:first-child, h3, h4');
      if (!nameEl) return;
      const cardName = nameEl.textContent.trim().toLowerCase();
      const record = AP_DATA.find(function(r) { return r.name.toLowerCase() === cardName; });
      if (!record || record.apprentice !== 'Yes') return;
      if (card.querySelector('.ap-prog-tag')) return;
      nameEl.insertAdjacentHTML('beforeend', '<span class="ap-prog-tag">' + ap_badge('APPRENTICE', '9px') + '</span>');
      if (ap_hasFlag(record.name)) {
        nameEl.insertAdjacentHTML('beforeend', ap_flagBadge('OTJ FLAG'));
      }
      const ltCount = ap_otjItemCount(record.name);
      const statusStrip = document.createElement('div');
      statusStrip.className = 'ap-prog-status-strip';
      statusStrip.style.cssText = 'margin-top:8px;padding:8px 10px;background:#FFF9E6;border-radius:6px;border-left:3px solid #B8960C;font-size:10px;';
      statusStrip.innerHTML = '<div style="font-weight:700;color:#92400E;margin-bottom:4px;text-transform:uppercase;letter-spacing:0.05em;">OTJ Progress</div><div style="display:flex;gap:12px;flex-wrap:wrap;align-items:center;">' + ap_otjCountBadge(ltCount) + '<span style="color:#6B7280;font-size:10px;">of ' + LIVE_TRACKER_OTJ_COLS + ' checklist items</span></div>';
      card.appendChild(statusStrip);
    });
  };

  // ── PART 4B: Programming Alert Panel ─────────────────────────────────────
  const ap_renderProgrammingPanel = () => {
    const progTab = document.getElementById('tab-programming')
      || document.querySelector('[data-dept="programming"]')
      || document.getElementById('panel-talent');
    if (!progTab || document.getElementById('ap-prog-panel')) return;

    const enrolled  = ap_enrolled();
    const eligible  = ap_eligible();
    const flagged   = enrolled.filter(function(r) { return ap_hasFlag(r.name); });
    const netMap    = ap_byNetwork();
    const regions   = ap_byRegion();
    const growthPct = enrolled.length ? Math.round(eligible.length / enrolled.length * 100) : 0;

    const flagRows = flagged.map(function(r) {
      const otj    = ap_otjStatus(r.name);
      const issues = [];
      if (otj.beginning === 'Not Started' || otj.beginning === 'Not Started - PM Following Up') issues.push('OTJ Beginning not started');
      if (!otj.siteLeader || otj.siteLeader === '—') issues.push('No site leader assigned');
      if (otj.middle === '' || otj.middle === '—') issues.push('OTJ Middle not logged');
      return `<div style="padding:.75rem 1rem;border-radius:10px;background:#fef2f2;border:1px solid #fecaca;margin-bottom:.5rem">
        <div style="display:flex;align-items:flex-start;gap:.625rem">
          <div style="width:8px;height:8px;border-radius:50%;background:#dc2626;margin-top:4px;flex-shrink:0"></div>
          <div style="min-width:0;flex:1">
            <div style="font-size:.875rem;font-weight:700;color:#0a1628">${r.name} ${ap_badge()}</div>
            <div style="font-size:.75rem;color:#6b7280;margin-top:2px">${r.network} · ${(r.site||'').substring(0,40)}</div>
            <div style="display:flex;flex-wrap:wrap;gap:.25rem;margin-top:.375rem">
              ${issues.map(function(i){ return `<span style="font-size:.625rem;background:#fee2e2;color:#dc2626;padding:.15rem .5rem;border-radius:8px;font-weight:700">${i}</span>`; }).join('')}
            </div>
            ${otj.pmNotes ? `<div style="font-size:.6875rem;color:#9ca3af;margin-top:.25rem;font-style:italic">${otj.pmNotes}</div>` : ''}
          </div>
        </div>
      </div>`;
    }).join('');

    const netCards = Object.entries(netMap)
      .sort(function(a,b){ return b[1].length - a[1].length; })
      .map(function(entry) {
        const net = entry[0]; const members = entry[1];
        const netFlagged = members.filter(function(m){ return ap_hasFlag(m.name); }).length;
        const safeNet = net.replace(/"/g,'&quot;');
        return `<div data-ap-net="${safeNet}" role="button" tabindex="0"
          style="background:#fff;border:1.5px solid var(--border,#e2e8f0);border-radius:12px;padding:1rem;cursor:pointer;transition:all .15s"
          onmouseenter="this.style.borderColor='#0a1628';this.style.boxShadow='0 4px 14px rgba(10,22,40,.12)'"
          onmouseleave="this.style.borderColor='var(--border,#e2e8f0)';this.style.boxShadow='none'"
          onclick="ap_showNetworkModal(this.dataset.apNet)">
          <div style="font-size:1.625rem;font-weight:900;color:#0a1628;line-height:1;letter-spacing:-.02em">${members.length}</div>
          <div style="font-size:.75rem;font-weight:700;color:#374151;margin-top:.375rem;line-height:1.3">${net}</div>
          ${netFlagged
            ? `<div style="margin-top:.5rem;font-size:.625rem;font-weight:700;color:#dc2626;background:#fef2f2;display:inline-block;padding:.15rem .5rem;border-radius:8px">⚠ ${netFlagged} flagged</div>`
            : `<div style="margin-top:.5rem;font-size:.625rem;color:#9ca3af;font-weight:600">Click for roster</div>`}
        </div>`;
      }).join('');

    const panel = document.createElement('div');
    panel.id = 'ap-prog-panel';
    panel.style.cssText = 'margin-bottom:1.5rem;font-family:inherit';
    panel.innerHTML = `
      <!-- TAP compact hero card -->
      <div style="background:linear-gradient(135deg,#0a1628 0%,#162347 60%,#0a1628 100%);border-radius:14px;padding:.875rem 1.25rem;color:#fff;margin-bottom:.75rem;position:relative;overflow:hidden">
        <div style="position:absolute;top:0;left:0;right:0;height:3px;background:linear-gradient(90deg,#f0a500,#f0a50088,transparent)"></div>
        <div style="position:absolute;right:-.5rem;top:-.5rem;font-size:5rem;opacity:.04;pointer-events:none;line-height:1">🎓</div>
        <!-- Title row + badges -->
        <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:.625rem;margin-bottom:.75rem">
          <div>
            <div style="font-size:.5rem;font-weight:800;letter-spacing:.18em;text-transform:uppercase;color:#f0a500;margin-bottom:.2rem">Tutor Apprenticeship Program · SY 2025–2026</div>
            <div style="font-size:1rem;font-weight:800;letter-spacing:-.02em;line-height:1.2">TAP Central Dashboard</div>
          </div>
          <div style="display:flex;gap:.375rem;align-items:center;flex-wrap:wrap">
            <div style="background:rgba(240,165,0,.18);border:1px solid rgba(240,165,0,.35);border-radius:20px;padding:.2rem .75rem;font-size:.625rem;font-weight:700;color:#f6d860;letter-spacing:.04em">LIVE</div>
            ${flagged.length > 0
              ? `<div style="background:rgba(220,38,38,.2);border:1px solid rgba(220,38,38,.3);border-radius:20px;padding:.2rem .75rem;font-size:.625rem;font-weight:700;color:#fca5a5">⚠ ${flagged.length} need attention</div>`
              : `<div style="background:rgba(22,163,74,.2);border:1px solid rgba(22,163,74,.3);border-radius:20px;padding:.2rem .75rem;font-size:.625rem;font-weight:700;color:#86efac">✅ No flags</div>`}
          </div>
        </div>
        <!-- Compact KPI strip -->
        <div style="display:flex;flex-wrap:wrap;gap:.375rem;padding-top:.625rem;border-top:1px solid rgba(255,255,255,.08)">
          ${[
            { v: enrolled.length,        l: 'Enrolled',    sub: Object.keys(netMap).length+' networks', c: '#93c5fd' },
            { v: eligible.length,        l: 'Eligible',    sub: 'not yet enrolled',                     c: '#fde68a' },
            { v: regions.NE.length,      l: 'NE',          sub: Math.round(regions.NE.length/Math.max(enrolled.length,1)*100)+'%', c: '#6ee7b7' },
            { v: regions.SW.length,      l: 'SW',          sub: Math.round(regions.SW.length/Math.max(enrolled.length,1)*100)+'%', c: '#6ee7b7' },
            { v: flagged.length || '✓',  l: flagged.length?'Flagged':'No Flags', sub: flagged.length?'follow-up':'all on track', c: flagged.length?'#fca5a5':'#86efac' },
          ].map(function(t){ return `<div style="text-align:center;padding:.3rem .625rem;background:rgba(255,255,255,.05);border-radius:8px;min-width:64px;flex:1">
            <div style="font-size:1.125rem;font-weight:800;color:${t.c};line-height:1;letter-spacing:-.02em">${t.v}</div>
            <div style="font-size:.5rem;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:rgba(255,255,255,.45);margin-top:.15rem">${t.l}</div>
            <div style="font-size:.45rem;color:rgba(255,255,255,.25);margin-top:.1rem">${t.sub}</div>
          </div>`; }).join('')}
        </div>
      </div>

      <!-- Collapsible detail section -->
      <details style="margin-bottom:.625rem" id="ap-prog-detail">
        <summary style="cursor:pointer;list-style:none;display:flex;align-items:center;justify-content:space-between;padding:.5rem .875rem;background:#f8fafc;border:1.5px solid var(--border,#e2e8f0);border-radius:10px;font-size:.75rem;font-weight:700;color:#374151;user-select:none">
          <span>Breakdown · OTJ Flags &amp; Networks</span>
          <span style="font-size:.6875rem;color:#94a3b8;font-weight:600">▾ expand</span>
        </summary>
        <div style="padding:.75rem 0 0;display:grid;grid-template-columns:1fr 1fr;gap:.75rem">
          <!-- OTJ flags -->
          <div style="background:#fff;border:1.5px solid var(--border,#e2e8f0);border-radius:12px;padding:.875rem 1rem">
            <div style="font-size:.595rem;font-weight:800;text-transform:uppercase;letter-spacing:.12em;color:#dc2626;margin-bottom:.625rem">⚠ Action Required (${flagged.length})</div>
            ${flagged.length > 0 ? flagRows : `<div style="text-align:center;padding:1rem;color:#9ca3af;font-size:.8125rem">
              <div style="font-size:1.25rem;margin-bottom:.375rem">✅</div>
              All apprentices have no active OTJ flags
            </div>`}
            <div style="margin-top:.625rem;padding:.625rem;background:#fffbeb;border-radius:8px;border:1px solid #fde68a">
              <div style="font-size:.6875rem;font-weight:700;color:#92400e;margin-bottom:.25rem">Programming requirements</div>
              <div style="font-size:.6875rem;color:#92400e;line-height:1.7">① OTJ Beginning — Month 4 deadline<br>② Formal IC observation required<br>③ Site leader must be assigned<br>④ Hours: 1,100 · 2,200 · 3,300 · 3,800 · 4,000</div>
            </div>
          </div>
          <!-- Network breakdown -->
          <div style="background:#fff;border:1.5px solid var(--border,#e2e8f0);border-radius:12px;padding:.875rem 1rem">
            <div style="font-size:.595rem;font-weight:800;text-transform:uppercase;letter-spacing:.12em;color:var(--muted,#94a3b8);margin-bottom:.625rem">By Partner Network — click any card</div>
            <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:.4rem">
              ${netCards}
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:.4rem;margin-top:.5rem">
              <div style="background:#eff6ff;border-radius:8px;padding:.5rem;text-align:center">
                <div style="font-size:1.125rem;font-weight:800;color:#0a1628">${regions.NE.length}</div>
                <div style="font-size:.5625rem;color:#6b7280;text-transform:uppercase;letter-spacing:.04em;margin-top:.1rem">NE Region</div>
              </div>
              <div style="background:#fffbeb;border-radius:8px;padding:.5rem;text-align:center">
                <div style="font-size:1.125rem;font-weight:800;color:#b8960c">${regions.SW.length}</div>
                <div style="font-size:.5625rem;color:#6b7280;text-transform:uppercase;letter-spacing:.04em;margin-top:.1rem">SW Region</div>
              </div>
            </div>
          </div>
        </div>
      </details>

      <!-- Pipeline insight bar (compact) -->
      <div style="background:#fff;border:1.5px solid var(--border,#e2e8f0);border-radius:10px;padding:.625rem 1rem;display:flex;align-items:center;gap:.75rem">
        <div style="font-size:1rem;flex-shrink:0">💡</div>
        <div style="font-size:.75rem;color:#374151;line-height:1.5;flex:1">
          <strong style="color:#0a1628">Growth:</strong> ${eligible.length} tutors eligible but not enrolled —
          <strong style="color:#b8960c">${growthPct}% increase</strong> without additional hiring.
          ${flagged.length
            ? `<span style="color:#dc2626;font-weight:600"> ${flagged.length} apprentice${flagged.length !== 1 ? 's require' : ' requires'} OTJ follow-up.</span>`
            : `<span style="color:#16a34a;font-weight:600"> All on track.</span>`}
        </div>
      </div>`;

    progTab.prepend(panel);
  };

  // ── PART 5: Leadership Section ────────────────────────────────────────────
  // ap_showNetworkModal — global handler using njtcAPCache for instant rendering.
  // Called via onclick="ap_showNetworkModal(this.dataset.apNet)" — no HTML in attr.
  window.ap_showNetworkModal = function(net) {
    var members = (window.njtcNetworkMap || {})[net] || [];
    var cache   = window.njtcAPCache || {};
    var flagCount = members.filter(function(m) { return (cache[m.name] || {}).hasFlag; }).length;
    var listHTML = members.map(function(m) {
      var c       = cache[m.name] || {};
      var otj     = c.otjStatus  || { beginning: '—', middle: '—', end: '—', siteLeader: '—' };
      var flagged = c.hasFlag    || false;
      var location = m.site || m.district || '—';
      var folderBtn = (m.folderLink && /^https?:\/\//i.test(m.folderLink))
        ? '<a href="' + m.folderLink + '" target="_blank" rel="noopener noreferrer" ' +
          'style="font-size:9px;background:#EFF6FF;color:#1D4ED8;padding:2px 8px;border-radius:6px;' +
          'text-decoration:none;font-weight:700;flex-shrink:0;white-space:nowrap;" ' +
          'title="Open apprentice folder">📁 Folder</a>'
        : '';
      var cohortTag = m.cohort
        ? '<span style="font-size:10px;color:#9CA3AF;font-weight:400;margin-left:6px">· Seat ' + m.cohort + '</span>'
        : '';
      return '<div style="display:flex;align-items:center;justify-content:space-between;padding:9px 0;border-bottom:1px solid #F3F4F6;">' +
        '<div style="min-width:0;flex:1;">' +
          '<div style="font-size:13px;font-weight:600;color:#111827;">' + m.name + cohortTag + '</div>' +
          '<div style="font-size:11px;color:#9CA3AF;margin-top:1px;overflow:hidden;text-overflow:ellipsis;">' + location + '</div>' +
        '</div>' +
        '<div style="display:flex;align-items:center;gap:5px;flex-shrink:0;margin-left:10px;">' +
          ap_otjCountBadge(ap_otjItemCount(m.name)) +
          (flagged ? '<span style="font-size:9px;background:#FEE2E2;color:#DC2626;font-weight:700;padding:2px 7px;border-radius:8px;">FLAG</span>' : '') +
          folderBtn +
        '</div>' +
      '</div>';
    }).join('');
    var headerNote = flagCount
      ? '<div style="background:#FEF2F2;border-radius:8px;padding:10px 14px;margin-bottom:14px;font-size:12px;color:#B91C1C;font-weight:600;">⚠ ' + flagCount + ' apprentice' + (flagCount !== 1 ? 's' : '') + ' need OTJ attention</div>'
      : '<div style="background:#F0FDF4;border-radius:8px;padding:10px 14px;margin-bottom:14px;font-size:12px;color:#16A34A;font-weight:600;">✓ All ' + members.length + ' apprentices on track</div>';
    ap_openModal(net + ' — ' + members.length + ' Apprentice' + (members.length !== 1 ? 's' : ''), headerNote + listHTML);
  };

  const ap_renderLeadershipSection = () => {
    const leaderTab = document.getElementById('tab-leadership')
      || document.querySelector('[data-dept="leadership"]')
      || document.getElementById('panel-home');
    if (!leaderTab || document.getElementById('ap-leadership-section')) return;

    const enrolled    = ap_enrolled();
    const netMap      = ap_byNetwork();
    const regionData  = ap_byRegion();
    const eligible    = ap_eligible();
    window.njtcNetworkMap = netMap;

    var cache = window.njtcAPCache || {};
    const beginComplete = enrolled.filter(function(r) {
      return ap_otjItemCount(r.name) >= LIVE_TRACKER_OTJ_COLS;
    }).length;
    const flagged = enrolled.filter(function(r) { return cache[r.name] && cache[r.name].hasFlag; }).length;
    const growthPct = enrolled.length ? Math.round(eligible.length / enrolled.length * 100) : 0;
    const networkCount = Object.keys(netMap).length;
    const totalNE = regionData.NE.length;
    const totalSW = regionData.SW.length;
    const nePct = Math.round(totalNE / Math.max(enrolled.length, 1) * 100);
    const swPct = Math.round(totalSW / Math.max(enrolled.length, 1) * 100);

    // Network cards — clickable, no accordion
    const networkCards = Object.entries(netMap)
      .sort(function(a,b){ return b[1].length - a[1].length; })
      .map(function(entry) {
        const net = entry[0]; const members = entry[1];
        const netFlags = members.filter(function(m){ return ap_hasFlag(m.name); }).length;
        const safeNet = net.replace(/"/g,'&quot;');
        return `<div data-ap-net="${safeNet}" role="button" tabindex="0"
          style="background:#fff;border:1.5px solid var(--border,#e2e8f0);border-radius:12px;padding:1rem;cursor:pointer;transition:all .15s;display:flex;flex-direction:column;gap:.375rem"
          onmouseenter="this.style.borderColor='#0a1628';this.style.boxShadow='0 4px 16px rgba(10,22,40,.12)'"
          onmouseleave="this.style.borderColor='var(--border,#e2e8f0)';this.style.boxShadow='none'"
          onclick="ap_showNetworkModal(this.dataset.apNet)">
          <div style="font-size:1.875rem;font-weight:900;color:#0a1628;line-height:1;letter-spacing:-.025em">${members.length}</div>
          <div style="font-size:.8rem;font-weight:700;color:#374151;line-height:1.3">${net}</div>
          <div style="font-size:.625rem;color:#9ca3af">Click for roster</div>
          ${netFlags ? `<div style="font-size:.625rem;font-weight:700;color:#dc2626;background:#fef2f2;display:inline-block;padding:.15rem .5rem;border-radius:8px;margin-top:.125rem">⚠ ${netFlags} flagged</div>` : ''}
        </div>`;
      }).join('');

    const section = document.createElement('div');
    section.id = 'ap-leadership-section';
    section.style.cssText = 'margin-bottom:2rem;font-family:inherit';
    section.innerHTML = `

      <!-- ── COMPACT HERO HEADER ── -->
      <div style="background:linear-gradient(135deg,#0a1628 0%,#162347 55%,#0d1e3d 100%);border-radius:14px;padding:.875rem 1.25rem;color:#fff;margin-bottom:.75rem;position:relative;overflow:hidden">
        <div style="position:absolute;top:0;left:0;right:0;height:3px;background:linear-gradient(90deg,#f0a500,#f0a50077,transparent)"></div>
        <div style="position:absolute;right:-.75rem;top:-.75rem;font-size:6rem;opacity:.035;pointer-events:none;line-height:1">🎓</div>
        <!-- Title + badges row -->
        <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:.625rem;margin-bottom:.75rem">
          <div>
            <div style="font-size:.5rem;font-weight:800;letter-spacing:.18em;text-transform:uppercase;color:#f0a500;margin-bottom:.2rem">Tutor Apprenticeship Program · SY 2025–2026</div>
            <div style="font-size:1rem;font-weight:800;letter-spacing:-.02em;line-height:1.2">TAP Central Dashboard</div>
          </div>
          <div style="display:flex;gap:.375rem;align-items:center;flex-wrap:wrap">
            <div style="background:rgba(240,165,0,.18);border:1px solid rgba(240,165,0,.35);border-radius:20px;padding:.2rem .75rem;font-size:.625rem;font-weight:700;color:#f6d860;letter-spacing:.04em">LIVE</div>
            <div style="background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.12);border-radius:20px;padding:.2rem .75rem;font-size:.625rem;font-weight:600;color:rgba(255,255,255,.7)">${enrolled.length} enrolled</div>
            ${flagged > 0
              ? `<div style="background:rgba(220,38,38,.2);border:1px solid rgba(220,38,38,.3);border-radius:20px;padding:.2rem .75rem;font-size:.625rem;font-weight:700;color:#fca5a5">⚠ ${flagged} flags</div>`
              : `<div style="background:rgba(22,163,74,.2);border:1px solid rgba(22,163,74,.3);border-radius:20px;padding:.2rem .75rem;font-size:.625rem;font-weight:700;color:#86efac">✅ No flags</div>`}
          </div>
        </div>
        <!-- Compact KPI strip -->
        <div style="display:flex;flex-wrap:wrap;gap:.375rem;padding-top:.625rem;border-top:1px solid rgba(255,255,255,.08)">
          ${[
            { v: enrolled.length,  l: 'Enrolled',    sub: networkCount+' networks',  c: '#93c5fd', def: 'TAP participants active in SY 2025–2026' },
            { v: eligible.length,  l: 'Eligible',    sub: 'not yet enrolled',         c: '#fde68a', def: 'Active tutors who qualify but have not enrolled yet' },
            { v: totalNE,          l: 'NE',           sub: nePct+'% enrolled',        c: '#6ee7b7', def: 'iLearn, KIPP, Hoboken, Middlesex, Somerset, Bergen' },
            { v: totalSW,          l: 'SW',           sub: swPct+'% enrolled',        c: '#6ee7b7', def: 'Hamilton, Gloucester, Haddon, Pennsauken, First Philadelphia' },
            { v: flagged || '✓',   l: flagged?'Flagged':'No Flags', sub: flagged?'need follow-up':'all on track', c: flagged?'#fca5a5':'#86efac', def: 'Missing milestone, no site leader, or PM note' },
          ].map(function(t){ return `<div title="${t.def||''}" style="text-align:center;padding:.3rem .625rem;background:rgba(255,255,255,.05);border-radius:8px;flex:1;min-width:58px;cursor:default">
            <div style="font-size:1.25rem;font-weight:900;color:${t.c};line-height:1;letter-spacing:-.025em">${t.v}</div>
            <div style="font-size:.5rem;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:rgba(255,255,255,.45);margin-top:.15rem">${t.l}</div>
            <div style="font-size:.45rem;color:rgba(255,255,255,.25);margin-top:.1rem">${t.sub}</div>
          </div>`; }).join('')}
        </div>
      </div>

      <!-- ── COLLAPSIBLE NETWORK GRID ── -->
      <details style="margin-bottom:.625rem" id="ap-leadership-networks">
        <summary style="cursor:pointer;list-style:none;display:flex;align-items:center;justify-content:space-between;padding:.5rem .875rem;background:#f8fafc;border:1.5px solid var(--border,#e2e8f0);border-radius:10px;font-size:.75rem;font-weight:700;color:#374151;user-select:none">
          <span>Partner Networks — ${networkCount} networks · ${enrolled.length} apprentices</span>
          <span style="font-size:.6875rem;color:#94a3b8;font-weight:600">▾ expand</span>
        </summary>
        <div style="padding:.75rem;background:#fff;border:1.5px solid var(--border,#e2e8f0);border-top:none;border-radius:0 0 10px 10px">
          <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:.5rem">
            ${networkCards}
          </div>
        </div>
      </details>

      <!-- ── PIPELINE INSIGHT (compact) ── -->
      <div style="background:#fff;border:1.5px solid var(--border,#e2e8f0);border-radius:10px;padding:.625rem 1rem;display:flex;align-items:center;gap:.75rem">
        <div style="font-size:1rem;flex-shrink:0">💡</div>
        <div style="flex:1;font-size:.75rem;color:#374151;line-height:1.5">
          <strong style="color:#0a1628">Growth:</strong> ${eligible.length} tutors eligible but not enrolled —
          a <strong style="color:#b8960c">${growthPct}% program increase</strong> without additional hiring.
          ${flagged
            ? `<span style="color:#dc2626;font-weight:600"> ${flagged} apprentice${flagged !== 1 ? 's require' : ' requires'} OTJ follow-up.</span>`
            : `<span style="color:#16a34a;font-weight:600"> All enrolled apprentices are on track.</span>`}
        </div>
      </div>
    `;

    leaderTab.append(section);
  };

  // ── PART 6: Data Section ──────────────────────────────────────────────────
  const ap_renderDataSection = () => {
    const dataTab = document.getElementById('tab-data')
      || document.querySelector('[data-dept="data"]')
      || document.getElementById('panel-kpi-analytics')
      || document.getElementById('panel-pearl-ops');
    if (!dataTab || document.getElementById('ap-data-section')) return;

    const enrolled    = ap_enrolled();
    const nonEnrolled = ap_eligible().concat(ap_notEligible());

    const ap_avgPearl = function(roster, field) {
      if (!window.po) return null;
      const poArr = Array.isArray(window.po) ? window.po : (typeof window.po === 'object' && window.po.getStats ? null : Object.values(window.po));
      if (!poArr) return null;
      const norm = function(s) { return s.toLowerCase().replace(/\s+/g,' ').trim(); };
      const vals = roster.map(function(r) {
        const match = poArr.find(function(p) { return norm(p.staffName||p.name||'') === norm(r.name); });
        const v = match ? parseFloat(match[field]) : NaN;
        return isNaN(v) ? null : v;
      }).filter(function(v) { return v !== null; });
      return vals.length ? (vals.reduce(function(a,b){return a+b;},0)/vals.length).toFixed(2) : 'N/A';
    };

    const apScholarRating    = ap_avgPearl(enrolled, 'scholarRating');
    const nonApScholarRating = ap_avgPearl(nonEnrolled, 'scholarRating');
    const apAttendance       = ap_avgPearl(enrolled, 'attendance');
    const nonApAttendance    = ap_avgPearl(nonEnrolled, 'attendance');

    const metricRow = function(label, apVal, nonApVal, higherIsBetter) {
      if (higherIsBetter === undefined) higherIsBetter = true;
      const apN  = parseFloat(apVal);
      const nonN = parseFloat(nonApVal);
      const apWins = !isNaN(apN) && !isNaN(nonN) && (higherIsBetter ? apN >= nonN : apN <= nonN);
      return '<tr style="border-bottom:1px solid #F3F4F6;"><td style="padding:10px 14px;font-size:12px;color:#374151;font-weight:600;">' + label + '</td><td style="padding:10px 14px;text-align:center;font-size:13px;font-weight:800;color:' + (apWins ? '#16A34A' : '#374151') + ';">' + (apVal || 'N/A') + (apWins && apVal !== 'N/A' ? ' ⬆' : '') + '</td><td style="padding:10px 14px;text-align:center;font-size:13px;font-weight:800;color:' + (!apWins && apVal !== 'N/A' ? '#16A34A' : '#374151') + ';">' + (nonApVal || 'N/A') + (!apWins && nonApVal !== 'N/A' ? ' ⬆' : '') + '</td></tr>';
    };

    var dataStorageKey = 'njtc_ap_data_open';
    var dataOpen = localStorage.getItem(dataStorageKey) === '1'; // collapsed by default

    const dataBody =
      '<div style="padding:0;"><table style="width:100%;border-collapse:collapse;"><thead><tr style="background:#F8FAFC;"><th style="padding:10px 14px;text-align:left;font-size:10px;font-weight:700;color:#9CA3AF;text-transform:uppercase;letter-spacing:0.06em;">Metric</th><th style="padding:10px 14px;text-align:center;font-size:10px;font-weight:700;color:#B8960C;text-transform:uppercase;letter-spacing:0.06em;">🎓 Apprentices (' + enrolled.length + ')</th><th style="padding:10px 14px;text-align:center;font-size:10px;font-weight:700;color:#6B7280;text-transform:uppercase;letter-spacing:0.06em;">Non-Apprentices (' + nonEnrolled.length + ')</th></tr></thead><tbody>' +
      metricRow('Avg Scholar Rating (Pearl)', apScholarRating, nonApScholarRating) +
      metricRow('Avg Attendance Rate', apAttendance, nonApAttendance) +
      metricRow('OTJ Items Complete', enrolled.filter(function(r){return ap_otjItemCount(r.name)>=LIVE_TRACKER_OTJ_COLS;}).length + ' / ' + enrolled.length, '—') +
      metricRow('Returning (Re-hire = Yes)', enrolled.filter(function(r){return r.rehire==='Yes';}).length + ' / ' + enrolled.length, nonEnrolled.filter(function(r){return r.rehire==='Yes';}).length + ' / ' + nonEnrolled.length) +
      '</tbody></table></div>' +
      '<div style="padding:12px 20px;background:#F8FAFC;border-top:1px solid #E5E7EB;font-size:11px;color:#9CA3AF;">Scholar rating and attendance pulled from Pearl Operations (window.po). If Pearl data is unavailable for a tutor, cell shows N/A. ⬆ indicates the higher-performing group for that metric.</div>';

    const section = document.createElement('div');
    section.id = 'ap-data-section';
    section.style.cssText = 'margin-bottom:28px;';
    section.innerHTML =
      '<div style="background:white;border-radius:12px;border:1px solid #E5E7EB;overflow:hidden;box-shadow:0 2px 8px rgba(0,40,85,0.07);">' +
      // ── Accordion header ────────────────────────────────────────────────
      '<div onclick="(function(){' +
          'var b=document.getElementById(\'ap-data-body\');' +
          'var i=document.getElementById(\'ap-data-icon\');' +
          'var open=b.style.display===\'none\';' +
          'b.style.display=open?\'\':\'none\';' +
          'i.textContent=open?\'▾\':\'▸\';' +
          'try{localStorage.setItem(\'njtc_ap_data_open\',open?\'1\':\'0\');}catch(e){}' +
        '})()" style="background:#002855;padding:14px 20px;display:flex;align-items:center;justify-content:space-between;cursor:pointer;user-select:none;">' +
        '<div style="display:flex;align-items:center;gap:10px;">' +
          '<span id="ap-data-icon" style="color:rgba(255,255,255,0.7);font-size:14px;">' + (dataOpen ? '▾' : '▸') + '</span>' +
          '<div>' +
            '<div style="color:white;font-size:14px;font-weight:800;">📊 Apprentice vs Non-Apprentice — Data Comparison</div>' +
            '<div style="color:rgba(255,255,255,0.5);font-size:11px;margin-top:2px;">Live from Pearl Operations · click to expand</div>' +
          '</div>' +
        '</div>' +
        '<div style="background:rgba(255,255,255,0.15);color:white;padding:4px 12px;border-radius:16px;font-size:11px;font-weight:600;">' + enrolled.length + ' vs ' + nonEnrolled.length + '</div>' +
      '</div>' +
      // ── Accordion body ──────────────────────────────────────────────────
      '<div id="ap-data-body" style="display:' + (dataOpen ? '' : 'none') + ';">' + dataBody + '</div>' +
      '</div>';
    dataTab.prepend(section);
  };

  // ── PART 7: Tag T&D Section ───────────────────────────────────────────────
  const ap_tagTDSection = () => {
    const tdTab = document.getElementById('tab-training')
      || document.querySelector('[data-dept="training"]')
      || document.getElementById('panel-training-analytics');
    if (!tdTab) return;

    const cards = tdTab.querySelectorAll('.td-tutor-card, [data-tutor-name]');
    cards.forEach(function(card) {
      const nameEl = card.querySelector('.card-name, [data-tutor-name]');
      if (!nameEl) return;
      const cardName = (nameEl.dataset.tutorName || nameEl.textContent).trim().toLowerCase();
      const record = AP_DATA.find(function(r) { return r.name.toLowerCase() === cardName; });
      if (!record) return;
      if (record.apprentice === 'Yes' && !card.querySelector('.ap-td-badge')) {
        nameEl.insertAdjacentHTML('afterend', '<div class="ap-td-badge" style="margin-bottom:8px;">' + ap_badge('TAP APPRENTICE','9px') + '</div>');
      }
      if (ap_hasFlag(record.name) && !card.querySelector('.ap-td-flag')) {
        const tdBadge = card.querySelector('.ap-td-badge');
        if (tdBadge) tdBadge.insertAdjacentHTML('afterend', '<div class="ap-td-flag">' + ap_flagBadge('OTJ NEEDS ATTENTION') + '</div>');
      }
    });
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // NJTC DATA LOADER v3.0 — 5 live sources fetched in parallel
  // All AP renders run only after njtc_onDataReady() confirms all fetches done.
  // ═══════════════════════════════════════════════════════════════════════════

  // ── Apprenticeship Program Team Database (single source of truth for OTJ) ─
  // Sheet ID confirmed working — fetched as direct CSV export (no 2PACX key needed).
  // NE OTJ tab (gid=2085207682) + SW OTJ tab (gid=1510819560) are fetched in parallel
  // and combined into a single normalized njtcOTJ array / njtcOTJMap lookup.
  // Active apprentice ENROLLMENT stays exclusively from the HR Master List (col K).
  const APPR_PROG_DB_ID   = '1_s6FnrI4537A7woPJ0F-56l2GS1Pt8c1x5RZuUjEl7U';
  const APPR_NE_OTJ_URL   = 'https://docs.google.com/spreadsheets/d/' + APPR_PROG_DB_ID + '/export?format=csv&gid=2085207682';
  const APPR_SW_OTJ_URL   = 'https://docs.google.com/spreadsheets/d/' + APPR_PROG_DB_ID + '/export?format=csv&gid=1510819560';
  const LIVE_TRACKER_URL  = 'https://docs.google.com/spreadsheets/d/1Dh1-TsuXEwoz4sqA4RBtgylPZ6epencsrJoqxupIEqs/export?format=csv&gid=0';
  const LIVE_TRACKER_OTJ_COLS = 17; // columns AB (index 27) through AR (index 43)

  // ── Data source registry ─────────────────────────────────────────────────
  const NJTC_SOURCES = {
    TRAINING_DETAILS: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRdblJU86VLJWNs4ykc_3GJ9Mr7oe5SDPA0QeYbWQcPsPSqOpWAxGClTiXDH_M3CunJIl0kjA3JUdym/pub?output=csv&gid=1298105082',
    PD_FEEDBACK:      'https://docs.google.com/spreadsheets/d/18LyHoN0c8BTD-ZVC0D4BpwD-rhq9ZBjgvFIXrsOKYM8/export?format=csv&gid=471085177',
    TRAINING_INTAKE:  'https://docs.google.com/spreadsheets/d/e/2PACX-1vRdblJU86VLJWNs4ykc_3GJ9Mr7oe5SDPA0QeYbWQcPsPSqOpWAxGClTiXDH_M3CunJIl0kjA3JUdym/pub?output=csv&gid=1298105082',
    PD_SESSIONS_ALL:  'https://docs.google.com/spreadsheets/d/18LyHoN0c8BTD-ZVC0D4BpwD-rhq9ZBjgvFIXrsOKYM8/export?format=csv&gid=471085177',
  };

  // ── OTJ column names — normalized form used in njtcOTJMap after combining NE+SW ─
  // Program DB raw columns → normalized key used by ap_otjStatus / ap_hasOTJFlag:
  //   'Tutor First' + 'Tutor Last (ADP)' → 'Master List Name' (full name, primary lookup key)
  //   'Beginning'  → 'OTJ Beginning'
  //   'Middle'     → 'OTJ Middle'
  //   'End'        → 'OTJ End'
  //   'PM Notes'   → 'OTJ PM Notes'
  //   'Site Leader', 'District', 'School', 'OTJ Checklist Link', 'ADP Status' — kept as-is
  const OTJ_COLS = {
    region: 'Region', masterName: 'Master List Name',
    email: 'Email Address', role: 'Position / Role',
    activeStatus: 'ADP Status',
    apprentice: 'Apprentice Program',
    district: 'District', school: 'School', siteLeader: 'Site Leader',
    otjLink: 'OTJ Checklist Link', otjBeginning: 'OTJ Beginning',
    otjMiddle: 'OTJ Middle', otjEnd: 'OTJ End', otjPMNotes: 'OTJ PM Notes',
  };

  // ── Normalize a raw Program DB OTJ row into the standard format ───────────
  // Handles NE OTJ and SW OTJ sheets from 1_s6FnrI4537A7woPJ0F-56l2GS1Pt8c1x5RZuUjEl7U.
  // Both sheets use 'Tutor First' + 'Tutor Last (ADP)' for the name and
  // 'Beginning'/'Middle'/'End' for phase columns.
  const normalizeOTJRow = (r, region) => {
    const first = (r['Tutor First'] || '').trim();
    const last  = (r['Tutor Last (ADP)'] || r['Tutor Last'] || '').trim();
    const fullName = first && last ? first + ' ' + last
                   : first || last || (r['Master List Name'] || r['Name'] || '').trim();
    return {
      'Master List Name': fullName,
      'Region':           region,
      'District':         r['District']             || '',
      'School':           r['School']               || '',
      'Site Leader':      r['Site Leader']           || '',
      'OTJ Beginning':    r['Beginning']             || r['OTJ Beginning'] || '',
      'OTJ Middle':       r['Middle']                || r['OTJ Middle']    || '',
      'OTJ End':          r['End']                   || r['OTJ End']       || '',
      'OTJ Checklist Link': r['OTJ Checklist Link']  || '',
      'OTJ PM Notes':     r['PM Notes']              || r['OTJ PM Notes']  || '',
      'ADP Status':       r['ADP Status']            || '',
      'Apprentice Program': r['Apprentice Program']  || '',
      'Position / Role':  r['Position / Role']       || '',
      'Email Address':    r['Email Address']         || '',
    };
  };

  // ── Universal CSV parser ─────────────────────────────────────────────────
  // Handles quoted fields, embedded commas, trailing spaces on headers.
  // Returns array of objects keyed by trimmed header names.
  const njtc_parseCSV = (text) => {
    const lines = [];
    let cur = '', inQ = false;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (ch === '"') {
        if (inQ && text[i+1] === '"') { cur += '"'; i++; }
        else inQ = !inQ;
      } else if (ch === '\n' && !inQ) {
        lines.push(cur); cur = '';
      } else {
        cur += ch;
      }
    }
    if (cur) lines.push(cur);

    const splitRow = row => {
      const cells = []; let cell = '', inq = false;
      for (let i = 0; i < row.length; i++) {
        const c = row[i];
        if (c === '"') {
          if (inq && row[i+1] === '"') { cell += '"'; i++; }
          else inq = !inq;
        } else if (c === ',' && !inq) { cells.push(cell); cell = ''; }
        else cell += c;
      }
      cells.push(cell);
      return cells;
    };

    if (!lines.length) return [];
    const headers = splitRow(lines[0]).map(h => h.trim());
    return lines.slice(1)
      .filter(l => l.trim())
      .map(l => {
        const cells = splitRow(l);
        const obj = {};
        headers.forEach((h, i) => { obj[h] = (cells[i] || '').trim(); });
        return obj;
      });
  };

  // ── Safe fetch with timeout + 403 detection ──────────────────────────────
  // Uses default redirect:'follow' — Google Sheets published CSV endpoints
  // do legitimate redirects internally and must be followed.
  // Sheets that are not published redirect to Google login (cross-origin),
  // which the browser reports as a CORS error; the catch block handles it.
  const njtc_fetch = async (url, timeoutMs) => {
    timeoutMs = timeoutMs || 30000;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(url, { signal: ctrl.signal });
      clearTimeout(timer);
      if (res.status === 403) return { ok: false, status: 403, text: null };
      if (!res.ok)            return { ok: false, status: res.status, text: null };
      return { ok: true, status: res.status, text: await res.text() };
    } catch (e) {
      clearTimeout(timer);
      return { ok: false, status: 0, text: null, error: e.message };
    }
  };

  // ── Per-source row parsers ────────────────────────────────────────────────
  const td_parseTrainingRow = (row) => ({
    timestamp:      row['Timestamp']                                  || '',
    name:           row['Full Name']                                  || '',
    email:          row['Email Address']                              || '',
    role:           row['Position / Role']                            || '',
    site:           row['School / Site']                              || '',
    district:       row['District']                                   || '',
    startDate:      row['Start Date']                                 || '',
    cohort:         row['Cohort']                                     || '',
    sessionDate:    row['Training Session Date']                      || '',
    sessionTopic:   row['Training Session Topic']                     || '',
    priorExp:       row['Prior Tutoring Experience']                  || '',
    comfort:        row['Comfort Level (1-5)']                        || '',
    goals:          row['Goals for the Program']                      || '',
    questions:      row['Questions / Concerns']                       || '',
  });

  const td_parsePDRow = (row) => {
    // Column 1 raw header has trailing space: 'PD Session Number ' — trimmed by njtc_parseCSV
    const isApp = (row['Position / Role'] || '').toLowerCase().includes('apprentice');
    return {
      sessionNum:   row['PD Session Number']                         || '',
      sessionDate:  row['PD Session Date']                           || '',
      topic:        row['PD Topic']                                  || '',
      name:         row['Full Name']                                 || '',
      email:        row['Email Address']                             || '',
      role:         row['Position / Role']                           || '',
      site:         row['School / Site']                             || '',
      district:     row['District']                                  || '',
      rating:       row['Overall Rating (1-5)']                      || '',
      helpful:      row['Most Helpful']                              || '',
      improve:      row['Suggestions for Improvement']               || '',
      isApprentice: isApp,
    };
  };

  const td_parseIntakeRow = (row) => {
    // DISCOVER-mode: runtime column detection — return raw row as-is
    return row;
  };

  const td_parsePDAllRow = (row) => {
    // ASSUMED same structure as PD_FEEDBACK
    return td_parsePDRow(row);
  };

  // ── Main parallel loader ─────────────────────────────────────────────────
  const njtc_loadAll = async () => {
    const [r_neOtj, r_swOtj, r_td, r_pd, r_intake, r_liveTracker] = await Promise.allSettled([
      njtc_fetch(APPR_NE_OTJ_URL),   // Program DB — NE OTJ tab
      njtc_fetch(APPR_SW_OTJ_URL),   // Program DB — SW OTJ tab
      njtc_fetch(NJTC_SOURCES.TRAINING_DETAILS),
      njtc_fetch(NJTC_SOURCES.PD_FEEDBACK),
      njtc_fetch(NJTC_SOURCES.TRAINING_INTAKE),
      njtc_fetch(LIVE_TRACKER_URL),  // Live Apprentice Tracker — OTJ checklist counts
    ]);

    // — PROGRAM TEAM DATABASE: NE + SW OTJ combined ———————————————————————
    {
      var _nm = function(x) { return (x||'').toLowerCase().replace(/\s+/g,' ').trim(); };
      var _fl = function(n) {
        var parts = n.split(/\s+/).filter(function(p) { return p.length > 1 && !/^[a-z]\.?$/i.test(p); });
        return parts.length > 1 ? (parts[0] + ' ' + parts[parts.length - 1]) : n;
      };

      const neRows = (r_neOtj.status === 'fulfilled' && r_neOtj.value.ok)
        ? njtc_parseCSV(r_neOtj.value.text).map(function(r) { return normalizeOTJRow(r, 'NE'); })
        : [];
      const swRows = (r_swOtj.status === 'fulfilled' && r_swOtj.value.ok)
        ? njtc_parseCSV(r_swOtj.value.text).map(function(r) { return normalizeOTJRow(r, 'SW'); })
        : [];

      if (!neRows.length) {
        const neReason = r_neOtj.status === 'fulfilled' ? 'HTTP ' + r_neOtj.value.status : (r_neOtj.reason||{}).message || 'network error';
        console.warn('[NJTC] Program DB NE OTJ unavailable:', neReason);
      }
      if (!swRows.length) {
        const swReason = r_swOtj.status === 'fulfilled' ? 'HTTP ' + r_swOtj.value.status : (r_swOtj.reason||{}).message || 'network error';
        console.warn('[NJTC] Program DB SW OTJ unavailable:', swReason);
      }

      // Filter out rows with no name (blank/header rows)
      const combined = neRows.concat(swRows).filter(function(r) { return r['Master List Name']; });
      window.njtcOTJ = combined;

      // Build O(1) name lookup map — exact + first/last fuzzy variant
      window.njtcOTJMap = {};
      combined.forEach(function(r) {
        var mn = _nm(r['Master List Name']);
        if (!mn) return;
        window.njtcOTJMap[mn] = r;
        var flmn = _fl(mn);
        if (flmn !== mn && !window.njtcOTJMap[flmn]) window.njtcOTJMap[flmn] = r;
      });

      console.log('[NJTC] Program DB OTJ: NE=' + neRows.length + ' SW=' + swRows.length +
        ' combined=' + combined.length + ' map keys=' + Object.keys(window.njtcOTJMap).length);
    }

    // — LIVE APPRENTICE TRACKER: OTJ item counts (columns AB–AR = 17 items) ──
    // Sheet 1Dh1-..., gid=0, headers at row 5 (skip 4 rows before headers line)
    {
      if (!window.njtcLiveOtjMap) window.njtcLiveOtjMap = {};
      if (r_liveTracker.status === 'fulfilled' && r_liveTracker.value.ok) {
        try {
          var ltText = r_liveTracker.value.text;
          // Split lines respecting quoted fields
          var ltLines = []; var ltCur = ''; var ltInQ = false;
          for (var ltI = 0; ltI < ltText.length; ltI++) {
            var ltCh = ltText[ltI];
            if (ltCh === '"') ltInQ = !ltInQ;
            else if (ltCh === '\n' && !ltInQ) { ltLines.push(ltCur); ltCur = ''; continue; }
            ltCur += ltCh;
          }
          if (ltCur) ltLines.push(ltCur);
          // Headers at row 5 (skip 4 lines)
          var ltDataLines = ltLines.slice(4);
          if (ltDataLines.length > 1) {
            var splitRow = function(row) {
              var cells = []; var cell = ''; var inq = false;
              for (var i = 0; i < row.length; i++) {
                var c = row[i];
                if (c === '"') { if (inq && row[i+1] === '"') { cell += '"'; i++; } else inq = !inq; }
                else if (c === ',' && !inq) { cells.push(cell); cell = ''; }
                else cell += c;
              }
              cells.push(cell);
              return cells;
            };
            var ltHeaders = splitRow(ltDataLines[0]).map(function(h) { return h.trim(); });
            var ltOtjHdrs = ltHeaders.slice(27, 44); // AB–AR
            // Detect column indices dynamically
            var ltFirstIdx  = ltHeaders.findIndex(function(h) { return /^first\s*name$/i.test(h.trim()); });
            var ltLastIdx   = ltHeaders.findIndex(function(h) { return /^last\s*name$/i.test(h.trim()); });
            var ltNjIdIdx   = ltHeaders.findIndex(function(h) { return /usdol|apprentice.*(id|#)|nj\s*(dol|id)/i.test(h.trim()); });
            if (ltNjIdIdx < 0) ltNjIdIdx = 6; // col G fallback
            var ltStatusIdx = ltHeaders.findIndex(function(h) { return /\bstatus\b/i.test(h); });
            if (ltStatusIdx < 0) ltStatusIdx = 1;
            var ltStatusCol = ltHeaders[ltStatusIdx];
            // Fallback single full-name column
            var ltNameIdx = ltHeaders.findIndex(function(h) { return /\bname\b|tutor/i.test(h); });
            if (ltNameIdx < 0) ltNameIdx = 5;
            var ltNameCol = ltHeaders[ltNameIdx];
            var ltMap = {};
            var ltRoster = [];
            for (var ltR = 1; ltR < ltDataLines.length; ltR++) {
              var ltCells = splitRow(ltDataLines[ltR]);
              if (ltCells.every(function(c) { return !c.trim(); })) continue;
              var ltObj = {};
              ltHeaders.forEach(function(h, idx) { ltObj[h] = (ltCells[idx] || '').trim(); });
              // Only Active apprentices
              var ltStatus = (ltObj[ltStatusCol] || '').trim();
              if (ltStatus && !/active/i.test(ltStatus)) continue;
              // Build full name: prefer First+Last, fall back to single name col
              var rawName;
              if (ltFirstIdx >= 0 && ltLastIdx >= 0) {
                var fn = (ltCells[ltFirstIdx] || '').trim();
                var ln = (ltCells[ltLastIdx]  || '').trim();
                rawName = (fn + ' ' + ln).trim();
              } else {
                rawName = (ltObj[ltNameCol] || '').trim();
              }
              if (!rawName || /^\d+$/.test(rawName)) continue;
              var ltKey = rawName.toLowerCase().replace(/\s+/g,' ').trim();
              var ltNjId = (ltCells[ltNjIdIdx] || '').trim().replace(/\s+/g,'');
              var ltCount = ltOtjHdrs.filter(function(h) { return (ltObj[h] || '').trim(); }).length;
              if (!ltMap[ltKey] || ltCount > ltMap[ltKey]) ltMap[ltKey] = ltCount;
              // Collect TAP roster entry — col indices: A=0, B=1, E=4, F=5, H=7, AA=26
              ltRoster.push({
                dateReg:    (ltCells[0]  || '').trim(),
                status:     ltStatus,
                cohort:     (ltCells[4]  || '').trim(),
                name:       rawName,
                njId:       ltNjId,
                placement:  (ltCells[7]  || '').trim(),
                folderLink: (ltCells[26] || '').trim(),
              });
            }
            window.njtcLiveOtjMap  = ltMap;
            window.AP_TAP_ROSTER   = ltRoster;
            var ltNjIds = ltRoster.map(function(r) { return r.njId; }).filter(Boolean);
            var ltNameMode = (ltFirstIdx >= 0 && ltLastIdx >= 0) ? 'First+Last cols' : ('col=' + ltNameCol);
            console.log('[NJTC] Live Tracker: ' + ltRoster.length + ' active → AP_TAP_ROSTER (' + ltNameMode + ') | NJ IDs: ' + ltNjIds.length + ' | sample: ' + ltNjIds.slice(0,3).join(', '));
          }
        } catch(e) { console.warn('[NJTC] Live Tracker parse error:', e); }
      } else {
        var ltReason = r_liveTracker.status === 'fulfilled' ? 'HTTP ' + r_liveTracker.value.status : 'network error';
        console.warn('[NJTC] Live Apprentice Tracker unavailable:', ltReason);
      }
    }

    // — TRAINING_DETAILS (KNOWN — 34 cols, n≈30) ──────────────────────────
    if (r_td.status === 'fulfilled' && r_td.value.ok) {
      window.njtcTraining = njtc_parseCSV(r_td.value.text).map(td_parseTrainingRow);
      console.log('[NJTC] TRAINING_DETAILS: ' + window.njtcTraining.length + ' rows');
    } else {
      window.njtcTraining = [];
      console.warn('[NJTC] TRAINING_DETAILS unavailable');
    }

    // — PD_FEEDBACK (KNOWN — 17 cols, n≈72, trailing space on col 1) ─────
    if (r_pd.status === 'fulfilled' && r_pd.value.ok) {
      window.njtcPD = njtc_parseCSV(r_pd.value.text).map(td_parsePDRow);
      console.log('[NJTC] PD_FEEDBACK: ' + window.njtcPD.length + ' rows');
    } else {
      window.njtcPD = [];
      console.warn('[NJTC] PD_FEEDBACK unavailable');
    }

    // — TRAINING_INTAKE (DISCOVER-mode — hide section on 403) ────────────
    if (r_intake.status === 'fulfilled' && r_intake.value.ok) {
      window.njtcIntake = njtc_parseCSV(r_intake.value.text).map(td_parseIntakeRow);
      console.log('[NJTC] TRAINING_INTAKE: ' + window.njtcIntake.length + ' rows');
    } else if (r_intake.status === 'fulfilled' && r_intake.value.status === 403) {
      window.njtcIntake = null; // null = 403, hide section
      console.info('[NJTC] TRAINING_INTAKE: 403 — section hidden');
    } else {
      window.njtcIntake = [];
      console.warn('[NJTC] TRAINING_INTAKE unavailable');
    }

    window.njtcPDAll = [];  // kept for compatibility; PD_SESSIONS_ALL fetch removed

    njtc_onDataReady();
  };

  // ── Post-load trigger ────────────────────────────────────────────────────
  // Called once all 5 sources have settled (success or failure).
  // Sole entry point into ap_initAll — removes need for standalone DOMContentLoaded hook.
  const njtc_onDataReady = () => {
    ap_initAll();
    // Refresh APIR header once AP_DATA is live so enrolled count is accurate
    setTimeout(function() {
      if (typeof window._apirRefreshHeader === 'function') window._apirRefreshHeader();
    }, 500);
  };

  // ── PART 8: Init Hook ─────────────────────────────────────────────────────
  // ap_initAll: async — fetches live Master List FIRST, then renders.
  // Called exclusively by njtc_onDataReady after all 5 live sources are settled.
  const ap_initAll = async () => {
    // Fetch HR Master List and TAP sheet in parallel for fastest load
    await Promise.all([
      ap_buildFromLive(),      // HR Master List → AP_DATA (enrolled + eligible)
      ap_buildFromTAPSheet(),  // TAP sheet → AP_TAP_ROSTER (authoritative enrolled with folder links)
    ]);
    ap_mergeTAPData();  // TAP sheet overrides enrolled; HR keeps eligible list

    // ── Program DB OTJ diagnostic ─────────────────────────────────────────
    // Enrollment is determined solely by HR Master List col K ("Yes").
    // njtcOTJ (Program DB) is OTJ-tracking data only — do NOT use it
    // to add or promote anyone to enrolled status.
    if (window.njtcOTJ && window.njtcOTJ.length && window.AP_DATA) {
      var _nm2 = function(x) { return (x||'').toLowerCase().replace(/\s+/g,' ').trim(); };
      var _fl2 = function(n) {
        var parts = n.split(/\s+/).filter(function(p) { return p.length > 1 && !/^[a-z]\.?$/i.test(p); });
        return parts.length > 1 ? (parts[0] + ' ' + parts[parts.length - 1]) : n;
      };
      // Rows are normalized — 'Master List Name' is always the key
      var _apEnrolledNames = new Set(AP_DATA.filter(function(r){ return r.apprentice === 'Yes'; }).map(function(r){ return _nm2(r.name); }));
      var _otjNotInHR = window.njtcOTJ.filter(function(row) {
        var mn = _nm2(row['Master List Name'] || '');
        return mn && !(_apEnrolledNames.has(mn) || _apEnrolledNames.has(_fl2(mn)));
      });
      if (_otjNotInHR.length > 0) {
        console.warn('[AP] Program DB OTJ rows with no HR-enrolled match (' + _otjNotInHR.length + ') — update col K in HR Master List:',
          _otjNotInHR.map(function(r){ return '"'+(r['Master List Name']||'')+'"'; }));
      }
      console.log('[AP] Enrollment count (HR Master List col K only): ' + AP_DATA.filter(function(r){ return r.apprentice === 'Yes'; }).length);
    }

    // Pre-compute per-person OTJ status + flag into a cache map.
    // All render functions use this instead of calling ap_getOTJ per row.
    window.njtcAPCache = {};
    window.AP_DATA.forEach(function(r) {
      var otjRow = ap_getOTJ(r.name);
      window.njtcAPCache[r.name] = {
        otjRow:    otjRow,
        otjStatus: ap_otjStatus(r.name),
        hasFlag:   ap_hasOTJFlag(otjRow),
      };
    });

    // Critical-path renders first (visible immediately on any dept page)
    ap_renderExecBadges();
    ap_renderLeadershipSection();

    // Secondary renders staggered via setTimeout(0) to yield to the browser
    // between each batch — prevents long task blocking on the main thread.
    setTimeout(function() {
      ap_renderHRFilterBar();
      ap_renderHRApprenticePanel();
    }, 0);
    setTimeout(function() {
      ap_renderProgrammingPanel();
      ap_tagProgrammingCards();
    }, 0);
    setTimeout(function() {
      ap_renderDataSection();
      ap_tagTDSection();
    }, 0);
  };

  // ── Single DOMContentLoaded entry point ──────────────────────────────────
  // njtc_loadAll fetches all 5 sources in parallel, then calls njtc_onDataReady → ap_initAll.
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      setTimeout(function() { njtc_loadAll(); }, 100);
    });
  } else {
    setTimeout(function() { njtc_loadAll(); }, 100);
  }

  const _orig_td_renderAll = typeof td_renderAll === 'function' ? td_renderAll : null;
  if (_orig_td_renderAll) {
    window.td_renderAll = function() {
      _orig_td_renderAll();
      setTimeout(ap_tagTDSection, 50);
    };
  }

})();
