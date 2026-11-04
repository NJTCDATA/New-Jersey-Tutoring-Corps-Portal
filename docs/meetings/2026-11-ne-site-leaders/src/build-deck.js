// NE Site Leader working session — "From Flags to Ownership"
// Builds a Google-Slides-friendly .pptx (shapes + text only, no native charts).
// Run: NODE_PATH=<dir with pptxgenjs> node build-deck.js <out.pptx>
const pptxgen = require('pptxgenjs');
const { applyTheme } = require(process.env.PPTX_SKILL + '/scripts/apply_theme.js');

const OUT = process.argv[2] || 'NE-Site-Leaders-From-Flags-to-Ownership.pptx';

const HEX = {
  ink: '14202E', navy: '0B2A4A', navy2: '003366', gold: 'FFB81C', goldInk: '8A5B00',
  wash: 'F3F5F8', line: 'DCE1E8', muted: '5E6B78', body: '2E3B4A',
  red: 'A61B1B', redWash: 'FBE9E7', amber: '9A5B00', amberWash: 'FFF1DC', green: '0D6E3A', greenWash: 'E6F3EB',
  goldWash: 'FFF4D6', grey: 'C9D0D8',
};
const THEME = {
  name: 'NJTC',
  headFontFace: 'Cambria',
  bodyFontFace: 'Calibri',
  colors: {
    dk1: HEX.ink, lt1: 'FFFFFF', dk2: HEX.navy, lt2: HEX.wash,
    accent1: HEX.gold, accent2: HEX.navy2, accent3: HEX.red, accent4: HEX.amber, accent5: HEX.green, accent6: HEX.muted,
    hlink: HEX.navy2, folHlink: HEX.muted,
  },
};

const pres = new pptxgen();
pres.layout = 'LAYOUT_WIDE'; // 13.333 x 7.5
pres.theme = { headFontFace: THEME.headFontFace, bodyFontFace: THEME.bodyFontFace };
pres.title = 'From Flags to Ownership';
pres.subject = 'North-East Site Leader working session';
pres.author = 'New Jersey Tutoring Corps';
pres.company = 'New Jersey Tutoring Corps';
const C = pres.SchemeColor;
const W = 13.333;
const SHAPE = pres.ShapeType;

// ── Layouts ────────────────────────────────────────────────────────────────
const footer = (dark) => ([
  { text: { text: 'NEW JERSEY TUTORING CORPS', options: { x: 0.6, y: 6.95, w: 4, h: 0.3, fontSize: 9, bold: true, charSpacing: 3, color: dark ? 'FFFFFF' : HEX.navy, fontFace: 'Calibri', margin: 0 } } },
  { text: { text: 'North-East Site Leaders  ·  November 2026', options: { x: 4.6, y: 6.95, w: 5, h: 0.3, fontSize: 9, color: dark ? 'B9C4D1' : HEX.muted, fontFace: 'Calibri', margin: 0 } } },
]);
const slideNum = (dark) => ({ x: 12.2, y: 6.95, w: 0.55, h: 0.3, fontSize: 9, color: dark ? 'B9C4D1' : HEX.muted, fontFace: 'Calibri', align: 'right' });

pres.defineSlideMaster({
  title: 'TITLE_DARK', background: { color: HEX.navy },
  objects: [
    ...footer(true),
    { placeholder: { options: { name: 'title', type: 'title', align: 'left', bold: true, x: 0.6, y: 2.2, w: 9.5, h: 2.1, fontFace: 'Cambria', fontSize: 60, color: 'FFFFFF', valign: 'bottom', margin: 0 }, text: '' } },
    { placeholder: { options: { name: 'body', type: 'body', x: 0.6, y: 4.5, w: 9, h: 1.2, fontFace: 'Calibri', fontSize: 20, color: 'D6DEE8', valign: 'top', margin: 0 }, text: '' } },
  ],
});
pres.defineSlideMaster({
  title: 'SECTION_DARK', background: { color: HEX.navy }, slideNumber: slideNum(true),
  objects: [
    ...footer(true),
    { placeholder: { options: { name: 'title', type: 'title', align: 'left', bold: true, x: 0.6, y: 2.6, w: 11, h: 1.4, fontFace: 'Cambria', fontSize: 48, color: 'FFFFFF', valign: 'bottom', margin: 0 }, text: '' } },
    { placeholder: { options: { name: 'body', type: 'body', x: 0.6, y: 4.2, w: 10, h: 1.2, fontFace: 'Calibri', fontSize: 20, color: 'D6DEE8', valign: 'top', margin: 0 }, text: '' } },
  ],
});
pres.defineSlideMaster({
  title: 'CONTENT', background: { color: 'FFFFFF' }, slideNumber: slideNum(false),
  objects: [
    ...footer(false),
    { placeholder: { options: { name: 'eyebrow', type: 'body', x: 0.6, y: 0.45, w: 12, h: 0.3, fontFace: 'Calibri', fontSize: 11, bold: true, charSpacing: 3, color: HEX.goldInk, margin: 0 }, text: '' } },
    { placeholder: { options: { name: 'title', type: 'title', align: 'left', bold: true, x: 0.6, y: 0.78, w: 12.1, h: 0.85, fontFace: 'Cambria', fontSize: 36, color: HEX.ink, valign: 'top', margin: 0 }, text: '' } },
  ],
});
// Gold = talk time. Every time the screen goes gold, the room is talking.
pres.defineSlideMaster({
  title: 'MOMENT', background: { color: HEX.gold }, slideNumber: { x: 12.2, y: 6.95, w: 0.55, h: 0.3, fontSize: 9, color: HEX.navy, fontFace: 'Calibri', align: 'right' },
  objects: [
    { text: { text: 'NEW JERSEY TUTORING CORPS', options: { x: 0.6, y: 6.95, w: 4, h: 0.3, fontSize: 9, bold: true, charSpacing: 3, color: HEX.navy, fontFace: 'Calibri', margin: 0 } } },
    { placeholder: { options: { name: 'eyebrow', type: 'body', x: 0.6, y: 0.9, w: 10, h: 0.5, fontFace: 'Calibri', fontSize: 16, bold: true, charSpacing: 4, color: HEX.navy, margin: 0 }, text: '' } },
    { placeholder: { options: { name: 'title', type: 'title', align: 'left', bold: true, x: 0.6, y: 1.6, w: 11.4, h: 3.3, fontFace: 'Cambria', fontSize: 44, color: HEX.navy, valign: 'top', margin: 0 }, text: '' } },
    { placeholder: { options: { name: 'body', type: 'body', x: 0.6, y: 5.1, w: 11.4, h: 1.4, fontFace: 'Calibri', fontSize: 18, color: HEX.navy, valign: 'top', margin: 0 }, text: '' } },
  ],
});

// ── Helpers ────────────────────────────────────────────────────────────────
let N = 0;
const id = (s) => `${s}-${++N}`;
function content(section, eyebrow, title) {
  const s = pres.addSlide({ masterName: 'CONTENT', sectionTitle: section });
  s.addText(eyebrow.toUpperCase(), { placeholder: 'eyebrow' });
  s.addText(title, { placeholder: 'title' });
  return s;
}
function moment(section, kind, minutes, prompt, sub) {
  const s = pres.addSlide({ masterName: 'MOMENT', sectionTitle: section });
  s.addText(`${kind.toUpperCase()}  ·  ${minutes} MIN`, { placeholder: 'eyebrow' });
  s.addText(prompt, { placeholder: 'title' });
  if (sub) s.addText(sub, { placeholder: 'body' });
  return s;
}
function txt(s, text, o) { s.addText(text, Object.assign({ isTextBox: true, margin: 0, fontFace: 'Calibri', color: HEX.body, fontSize: 14, valign: 'top', objectName: id('t') }, o)); }
function box(s, x, y, w, h, fill, o) { s.addShape(SHAPE.roundRect, Object.assign({ x, y, w, h, fill: { color: fill }, line: { color: fill, width: 0 }, rectRadius: 0.08, objectName: id('box') }, o || {})); }
function rect(s, x, y, w, h, fill, o) { s.addShape(SHAPE.rect, Object.assign({ x, y, w, h, fill: { color: fill }, line: { color: fill, width: 0 }, objectName: id('rect') }, o || {})); }
function num(s, x, y, n, o) {
  o = o || {};
  const d = o.d || 0.5;
  s.addShape(SHAPE.ellipse, { x, y, w: d, h: d, fill: { color: o.fill || HEX.navy }, line: { color: o.fill || HEX.navy, width: 0 }, objectName: id('dot') });
  s.addText(String(n), { x, y, w: d, h: d, isTextBox: true, margin: 0, align: 'center', valign: 'middle', fontFace: 'Cambria', fontSize: o.size || 18, color: o.color || HEX.gold, objectName: id('n') });
}
function bullets(s, items, o) {
  s.addText(items.map((t, i) => ({ text: t, options: { bullet: { indent: 14 }, breakLine: i < items.length - 1 } })),
    Object.assign({ isTextBox: true, margin: 0, fontFace: 'Calibri', fontSize: 14, color: HEX.body, valign: 'top', paraSpaceAfter: 7, objectName: id('list') }, o));
}
function chip(s, x, y, label, kind) {
  const map = { now: [HEX.redWash, HEX.red], today: [HEX.amberWash, HEX.amber], week: ['E6EDF5', HEX.navy2], gold: [HEX.goldWash, HEX.goldInk] };
  const [bg, fg] = map[kind];
  const w = 0.16 + label.length * 0.095;
  box(s, x, y, w, 0.32, bg, { rectRadius: 0.05 });
  txt(s, label.toUpperCase(), { x, y, w, h: 0.32, align: 'center', valign: 'middle', fontSize: 10, bold: true, charSpacing: 1, color: fg });
  return w;
}
const SOURCE = 'Source: Pearl session and attendance records, North-East region (iLearn CMO campuses + Lyndhurst MS), refreshed Nov 3, 2026.';

// ═════════════════════════════════════════════════════════════════════════
// 1. Title
pres.addSection({ title: 'Open' });
{
  const s = pres.addSlide({ masterName: 'TITLE_DARK', sectionTitle: 'Open' });
  txt(s, 'NORTH-EAST SITE LEADER WORKING SESSION', { x: 0.6, y: 1.55, w: 9, h: 0.35, fontSize: 12, bold: true, charSpacing: 4, color: HEX.gold });
  s.addText('From Flags to Ownership', { placeholder: 'title' });
  s.addText('Catching it before anyone has to ask: routines, escalation, and the next two weeks', { placeholder: 'body' });
  // motif: three stacked numbered dots = tutor, site leader, program manager
  [['1', 'Tutor'], ['2', 'Site Leader'], ['3', 'Program Manager']].forEach(([n, l], i) => {
    num(s, 10.55, 2.35 + i * 0.95, n, { d: 0.6, fill: 'FFFFFF', color: HEX.navy, size: 20 });
    txt(s, l, { x: 11.3, y: 2.35 + i * 0.95, w: 1.8, h: 0.6, valign: 'middle', color: 'FFFFFF', fontSize: 14, bold: true });
  });
  s.addNotes(`Welcome everyone. Set the tone in the first minute: this is a working session, not a data review and not a reprimand.

Say something like: "Our sites are doing real work. Scholars are showing up and they love it. What we want to talk about today is how we catch problems before Taneisha or I have to come find them. That's what ownership looks like."

Name the three outcomes: everyone leaves with (1) a daily routine, (2) a clear escalation path, and (3) one two-week commitment for their site.`);
}

// 2. Agenda
{
  const s = content('Open', 'Today’s hour', 'Six moves in sixty minutes');
  const rows = [
    ['0:00', 'Open + Stop & Jot', 'When did you first know about your last flag?', 'Stop & Jot'],
    ['0:05', 'What’s working, what slipped', 'Two weeks of Pearl data, side by side', 'Turn & Talk'],
    ['0:15', 'Who owns what', 'Tutor, Site Leader, Program Manager', ''],
    ['0:22', 'Routines that prevent flags', 'The tutor day and the Site Leader week', 'Turn & Talk'],
    ['0:32', 'Escalation: who, when, how', 'Three questions and a four-line message', 'Scenario Sort'],
    ['0:50', 'Two-week commitments', 'One flag, one routine, one ask', 'Everybody Writes'],
  ];
  rows.forEach((r, i) => {
    const y = 1.95 + i * 0.75;
    txt(s, r[0], { x: 0.6, y, w: 0.9, h: 0.6, fontFace: 'Cambria', fontSize: 22, color: HEX.goldInk, valign: 'middle' });
    txt(s, r[1], { x: 1.6, y, w: 4.6, h: 0.6, fontSize: 17, bold: true, color: HEX.ink, valign: 'middle' });
    txt(s, r[2], { x: 6.2, y, w: 4.4, h: 0.6, fontSize: 14, color: HEX.muted, valign: 'middle' });
    if (r[3]) chip(s, 10.75, y + 0.14, r[3], 'gold');
    if (i < rows.length - 1) s.addShape(SHAPE.line, { x: 0.6, y: y + 0.72, w: 12.1, h: 0, line: { color: HEX.line, width: 0.75 }, objectName: id('rule') });
  });
  txt(s, 'Gold slide = your turn to talk.', { x: 0.6, y: 6.5, w: 6, h: 0.3, fontSize: 12, italic: true, color: HEX.muted });
  s.addNotes(`Walk the agenda quickly (under a minute). Point out the gold chips: those are the moments they talk, not you.

Norm to say out loud: "When the screen turns gold, it's your turn. I'll keep time."

Timekeeping tip: the escalation block (0:32–0:50) is the heart of the session. If you run long earlier, trim the data section, not the scenario sort.`);
}

// 3. Stop & Jot
{
  const s = moment('Open', 'Stop & Jot', 2, 'Think of the last flag you got from the region. When did you first know about it, and who knew before you did?', 'Write it down. Don’t share yet. We’ll come back to it.');
  s.addNotes(`Give them a full 90 seconds of silence. Resist filling it.

Then cold call two people, warmly: "[Name], when did you first know?" You're listening for the gap: "the tutor knew Monday, I found out Thursday when the flag came." That gap is the whole meeting.

Bridge: "Hold onto that gap. Everything today is about closing it."`);
}

// 4. What's working
pres.addSection({ title: 'Data' });
{
  const s = content('Data', 'Start with what’s working', 'Scholars are showing up, and they love it');
  const stats = [
    ['827', 'scholars served this year'],
    ['2,791', 'tutoring sessions delivered'],
    ['90.5%', 'scholar attendance\n(goal: 80%)'],
    ['97.8%', 'of delivered sessions have a tutor survey'],
    ['93.9%', 'of scholar ratings are 4 or 5 out of 5'],
  ];
  const cw = 2.3, gap = 0.155;
  stats.forEach((st, i) => {
    const x = 0.6 + i * (cw + gap);
    box(s, x, 2.15, cw, 2.9, HEX.wash);
    txt(s, st[0], { x: x + 0.25, y: 2.45, w: cw - 0.4, h: 1.0, fontFace: 'Cambria', fontSize: 44, color: HEX.navy });
    txt(s, st[1], { x: x + 0.25, y: 3.6, w: cw - 0.45, h: 1.2, fontSize: 14, color: HEX.body });
  });
  txt(s, 'This is the foundation. Survey completion is a routine your tutors already own. That’s proof the region can build habits that stick.', { x: 0.6, y: 5.45, w: 11.5, h: 0.6, fontSize: 16, color: HEX.ink });
  txt(s, SOURCE + ' School year to date (Sept 22 – Oct 30).', { x: 0.6, y: 6.45, w: 12, h: 0.3, fontSize: 10, color: HEX.muted });
  s.addNotes(`Lead with genuine credit. These numbers are real and they are strong.

Land the survey point on purpose: "Nearly every delivered session has a tutor survey. Nobody chases that anymore. It's a habit. That's exactly what we want for the rest of the session routine."

Don't linger. 90 seconds max.`);
}

// 5. Reliability, not attendance
{
  const s = content('Data', 'What slipped in the last two weeks', 'Attendance isn’t the problem. Reliability is.');
  const rows = [
    ['Sessions cancelled', '38', '116'],
    ['Cancelled with no reason entered', '0', '39'],
    ['Sessions with no tutor (vacancy)', '18', '41'],
    ['Scholar misses because the tutor was absent', '137', '189'],
    ['Scholars kept in class by a teacher', '90', '118'],
    ['Missed reason left blank', '6', '24'],
    ['Sessions still “Incomplete” in Pearl', '0', '33'],
  ];
  const x0 = 0.6, tw = 7.9, rh = 0.53, y0 = 2.05;
  txt(s, 'Oct 5 – 16', { x: x0 + 5.15, y: y0 - 0.38, w: 1.2, h: 0.3, fontSize: 11, bold: true, color: HEX.muted, align: 'right' });
  txt(s, 'Oct 19 – 30', { x: x0 + 6.6, y: y0 - 0.38, w: 1.3, h: 0.3, fontSize: 11, bold: true, color: HEX.navy, align: 'right' });
  rows.forEach((r, i) => {
    const y = y0 + i * rh;
    if (i % 2 === 0) rect(s, x0, y, tw, rh, HEX.wash);
    txt(s, r[0], { x: x0 + 0.15, y, w: 4.9, h: rh, valign: 'middle', fontSize: 14, color: HEX.ink });
    txt(s, r[1], { x: x0 + 5.15, y, w: 1.2, h: rh, valign: 'middle', align: 'right', fontSize: 16, color: HEX.muted });
    txt(s, r[2], { x: x0 + 6.6, y, w: 1.15, h: rh, valign: 'middle', align: 'right', fontSize: 18, bold: true, color: HEX.red });
  });
  // callout
  box(s, 9.0, 1.65, 3.73, 4.15, HEX.navy);
  txt(s, 'Scholar attendance held', { x: 9.3, y: 1.95, w: 3.2, h: 0.4, fontSize: 14, bold: true, color: HEX.gold });
  txt(s, '92.2% → 90.1%', { x: 9.3, y: 2.35, w: 3.3, h: 0.7, fontFace: 'Cambria', fontSize: 32, color: 'FFFFFF' });
  txt(s, 'Still well above the 80% goal.\n\nWhat slipped is everything around the session: coverage, cancellations, and closing the loop in Pearl. Those are ours to own.', { x: 9.3, y: 3.15, w: 3.2, h: 2.5, fontSize: 14, color: 'D6DEE8' });
  txt(s, SOURCE + ' Late October included school events and testing; counts are as logged in Pearl.', { x: 0.6, y: 6.25, w: 12, h: 0.5, fontSize: 10, color: HEX.muted });
  s.addNotes(`This is the reframe slide. Say it plainly: "Taneisha has been talking about attendance, and attendance is fine. What's slipping is reliability, the stuff around the session."

Walk three rows, not all seven:
• Uncovered sessions more than doubled (18 to 41). That's a coverage plan problem, not a scholar problem.
• 39 cancellations with no reason. Pearl locks the reason once you cancel, so those can never be fixed. Only prevented.
• 33 sessions still sitting Incomplete. Every one of those becomes a flag someone has to chase.

Be fair: late October had events and testing. "Some of this is the calendar. But the calendar doesn't explain a blank reason or an open session."`);
}

// 6. Why scholars missed (bar chart in shapes)
{
  const s = content('Data', 'Why scholars missed tutoring, Oct 19 – 30', 'The #1 reason was us, not them');
  const data = [
    ['Tutor absent', 189, HEX.navy],
    ['Absent from school', 156, HEX.grey],
    ['Teacher kept scholar in class', 118, HEX.gold],
    ['NJTC diagnostic testing', 57, HEX.grey],
    ['Scholar left early', 36, HEX.grey],
    ['School testing', 28, HEX.grey],
    ['Scholar unavailable (reason unknown)', 27, HEX.grey],
    ['Reason left blank', 24, HEX.grey],
  ];
  const lx = 0.6, lw = 3.5, bx = 4.25, bwMax = 3.6, y0 = 1.95, rh = 0.5, max = 189;
  data.forEach((d, i) => {
    const y = y0 + i * rh;
    const hl = d[2] !== HEX.grey;
    txt(s, d[0], { x: lx, y, w: lw, h: rh - 0.08, valign: 'middle', align: 'right', fontSize: 13, bold: hl, color: hl ? HEX.ink : HEX.body });
    const bw = bwMax * d[1] / max;
    box(s, bx, y + 0.08, bw, rh - 0.24, d[2], { rectRadius: 0.03 });
    txt(s, String(d[1]), { x: bx + bw + 0.1, y, w: 0.7, h: rh - 0.08, valign: 'middle', fontSize: 13, bold: hl, color: HEX.ink });
  });
  txt(s, '649 scholar misses in two weeks', { x: bx, y: y0 + data.length * rh + 0.05, w: 4.5, h: 0.3, fontSize: 11, color: HEX.muted });
  // commentary
  const cx = 9.1;
  rect(s, cx, 2.0, 0.22, 0.22, HEX.navy);
  txt(s, 'Tutor absence', { x: cx + 0.35, y: 1.93, w: 3, h: 0.35, fontSize: 15, bold: true, color: HEX.ink });
  txt(s, 'More scholars missed because their tutor was out than because they were absent from school. Reporting early and a coverage plan fix this.', { x: cx + 0.35, y: 2.3, w: 3.3, h: 1.4, fontSize: 13 });
  rect(s, cx, 3.95, 0.22, 0.22, HEX.gold);
  txt(s, 'Teacher pull-outs', { x: cx + 0.35, y: 3.88, w: 3, h: 0.35, fontSize: 15, bold: true, color: HEX.ink });
  txt(s, 'This is a relationship conversation. The Site Leader owns it with the teacher first, and the PM takes it to administration only if it keeps happening.', { x: cx + 0.35, y: 4.25, w: 3.3, h: 1.5, fontSize: 13 });
  txt(s, SOURCE, { x: 0.6, y: 6.45, w: 12, h: 0.3, fontSize: 10, color: HEX.muted });
  s.addNotes(`Let the chart sit for a beat before you talk.

"Look at the top bar. 189 scholar sessions were missed because the tutor wasn't there. That's more than scholars being out sick. That one is completely in our hands."

Then the gold bar: "118 times a teacher kept a scholar in class. That's not a tutor problem and it's not a data problem. It's a relationship, and the Site Leader is the one who has it."

Note the bottom two bars ("unknown" and "blank"): unknown is fine (it's the honest answer). Blank is not.`);
}

// 7. Turn & Talk
{
  const s = moment('Data', 'Turn & Talk', 3, 'Which of these is showing up at your site? What’s one cause behind it that Pearl would never show us?', 'Partner with someone from a different campus. Each person gets 90 seconds.');
  s.addNotes(`Pair people across campuses on purpose (ES with MS, Paterson with Bergen, and so on). Fresh eyes help.

Circulate and listen. Pick two pairs to share out, choosing ones that named a real cause (a teacher who doesn't know the schedule, a tutor who commutes from far away, a room that keeps getting reassigned).

Write the causes they name on chart paper if you have it. You'll come back to them in the escalation section.`);
}

// 8. What a flag is
pres.addSection({ title: 'Ownership' });
{
  const s = content('Ownership', 'Reframe', 'A flag is a conversation that happened too late');
  const steps = [
    ['Something happens', 'Minute 0'],
    ['Tutor knows', 'Minutes later'],
    ['Site Leader knows', 'Same day'],
    ['Pearl shows it', '2 – 7 days'],
    ['Region finds it', '1 – 2 weeks'],
  ];
  const sw = 2.45, y = 2.55;
  box(s, 0.5, 2.0, 3 * sw - 0.05 + 0.2, 2.55, HEX.goldWash);
  txt(s, 'CATCH IT HERE', { x: 0.75, y: 2.12, w: 4, h: 0.3, fontSize: 11, bold: true, charSpacing: 3, color: HEX.goldInk });
  steps.forEach((st, i) => {
    const x = 0.6 + i * sw;
    const shape = i === 0 ? SHAPE.homePlate : SHAPE.chevron;
    const fill = i < 3 ? HEX.navy : HEX.grey;
    s.addShape(shape, { x, y, w: sw - 0.05, h: 1.0, fill: { color: fill }, line: { color: fill, width: 0 }, objectName: id('step') });
    txt(s, st[0], { x: x + 0.45, y, w: sw - 0.95, h: 1.0, valign: 'middle', align: 'center', fontSize: 13, bold: true, color: i < 3 ? 'FFFFFF' : HEX.ink });
    txt(s, st[1], { x: x + 0.1, y: y + 1.15, w: sw - 0.25, h: 0.4, align: 'center', fontSize: 13, color: i < 3 ? HEX.ink : HEX.muted, bold: i < 3 });
  });
  txt(s, 'When a flag reaches the region, the problem has already cost scholars a session, and someone has to stop and chase it. Our job is to move the catch to the left.', { x: 0.6, y: 4.95, w: 8.2, h: 1.0, fontSize: 18, color: HEX.ink });
  txt(s, 'Proactive means the region hears it from you first, with what you already did about it.', { x: 9.2, y: 4.95, w: 3.5, h: 1.2, fontSize: 14, italic: true, color: HEX.goldInk });
  s.addNotes(`This is the core idea of the meeting. Slow down here.

"Every flag on the Site Leader Flags list started as a moment a tutor saw. A sub in the room. A kid kept in class. A session they didn't close. By the time it's a flag, it's a week old and someone in the region has to stop and chase it."

"Proactive doesn't mean perfect. It means we hear it from you first, and you've already done something about it."

Tie it back to the Stop & Jot: "Remember the gap you wrote down? That's this arrow."`);
}

// 9. Who owns what
{
  const s = content('Ownership', 'Who owns what', 'Clear owners stop the chasing');
  const cols = [
    ['Tutor', 'Owns the session', [
      'Closes every session in Pearl before leaving the building',
      'Tells the Site Leader before a session if late or out',
      'Picks the honest missed reason (“Unavailable” when unsure)',
      'Has the lesson plan ready before walking in',
      'Raises roadblocks to the Site Leader the same day',
    ]],
    ['Site Leader', 'Owns the site', [
      'Checks coverage every morning before the first block',
      'Sweeps Pearl at end of day: nothing left Incomplete',
      'Cancels whole-group sessions in Pearl, with a reason',
      'Owns teacher relationships and repeat pull-outs',
      'Clears Site Leader Flags by Wednesday each week',
    ]],
    ['Program Manager', 'Owns the region', [
      'Reviews Site Leader Flags weekly with each site',
      'Answers every escalation within 24 hours',
      'Leads conversations with partner administration',
      'Makes schedule and roster changes in Pearl',
      'Documents concerns when coaching hasn’t worked',
    ]],
  ];
  const cw = 3.9, gap = 0.2;
  cols.forEach((c, i) => {
    const x = 0.6 + i * (cw + gap);
    box(s, x, 1.95, cw, 4.75, HEX.wash);
    num(s, x + 0.3, 2.2, i + 1);
    txt(s, c[0], { x: x + 0.95, y: 2.15, w: cw - 1.1, h: 0.4, fontFace: 'Cambria', fontSize: 22, color: HEX.ink });
    txt(s, c[1].toUpperCase(), { x: x + 0.95, y: 2.55, w: cw - 1.1, h: 0.3, fontSize: 10, bold: true, charSpacing: 2, color: HEX.goldInk });
    bullets(s, c[2], { x: x + 0.3, y: 3.1, w: cw - 0.55, h: 3.5, fontSize: 13.5 });
  });
  s.addNotes(`Go column by column, but spend the most time on the middle one. That's the room.

Two lines worth saying out loud:
• "Tutors can't cancel sessions in Pearl. Only you can. And once a session is cancelled, the reason is locked. So if a whole group is out, the tutor's job is to tell you right away, and your job is to cancel it with a reason before the session time."
• "Clear by Wednesday. The flags list refreshes on the two-week window. If it's clear by Wednesday, nobody has to reach out to you."

Ask: "Anything on your column that you're not doing today, or didn't know was yours?" Take one or two answers.`);
}

// 10. Tutor routine
pres.addSection({ title: 'Routines' });
{
  const s = content('Routines', 'The tutor routine', 'Every session, every day: before, during, after');
  const cols = [
    ['Before', '10 minutes ahead', ['Open Pearl: check today’s schedule and roster', 'Lesson plan ready for every group', 'Room confirmed; if not, tell the Site Leader now', 'Running late or out? Text the Site Leader before the session, not after']],
    ['During', 'In the session', ['Start on time; collect scholars if needed', 'Mark attendance as scholars arrive', 'Note anything that blocks learning (behavior, room, roster)']],
    ['After', 'Before leaving the building', ['Close every session: attendance, missed reason, survey', 'Not sure why a scholar missed? Pick “Scholar Unavailable.” Never leave it blank', 'Write a comment for admin if anything needs follow-up', 'Tell the Site Leader about any roadblock today']],
  ];
  const cw = 3.9, gap = 0.2;
  cols.forEach((c, i) => {
    const x = 0.6 + i * (cw + gap);
    num(s, x, 1.95, i + 1, { d: 0.55 });
    txt(s, c[0], { x: x + 0.7, y: 1.92, w: 3, h: 0.45, fontFace: 'Cambria', fontSize: 26, color: HEX.ink });
    txt(s, c[1], { x: x + 0.7, y: 2.37, w: 3, h: 0.3, fontSize: 12, bold: true, color: HEX.goldInk });
    bullets(s, c[2], { x: x + 0.05, y: 2.95, w: cw - 0.3, h: 2.6, fontSize: 13.5 });
  });
  box(s, 0.6, 5.75, 12.1, 0.8, HEX.navy);
  txt(s, 'Nobody leaves the building with an open session.', { x: 0.9, y: 5.75, w: 11.5, h: 0.8, valign: 'middle', fontFace: 'Cambria', fontSize: 24, color: 'FFFFFF' });
  s.addNotes(`This is the slide (and the matching one-pager) Site Leaders take back to their tutors.

The non-negotiable is the bottom line: close every session before leaving the building. Almost every data flag (Incomplete, Not recorded, blank reason) disappears if that one habit holds.

The missed-reason rule: if the tutor doesn't know why a scholar is out, "Scholar Unavailable; Out of the Classroom" is the right answer. Don't guess, and don't interrupt the teacher's lesson to ask. The Site Leader follows up only if it repeats (two or more times in two weeks).

Hand out the Tutor Routine one-pager here.`);
}

// 11. Turn & Talk
{
  const s = moment('Routines', 'Turn & Talk', 3, 'Which step do your tutors skip most? What would make it automatic by next week?', 'Be specific: a time, a place, a reminder, a person. “Remind them” doesn’t count.');
  s.addNotes(`Push for specifics. Good answers sound like:
• "I'll stand at the exit at 3:10 and ask, 'Is Pearl closed?'"
• "Tutors text me 'closed' with their last session."
• "Pearl check is the first 2 minutes of our Monday huddle."

If someone says "I'll remind them," ask "When, and how will you know it worked?"

Share out: one or two strong examples. Tell the room to steal them.`);
}

// 12. Site Leader rhythm
{
  const s = content('Routines', 'The Site Leader rhythm', 'A week where the region never has to ask');
  const rows = [
    ['Daily', [['Morning', 'Coverage check before the first block: who’s out, who covers, what to cancel'], ['Midday', 'Walk into at least one session'], ['End of day', 'Pearl sweep: no session left Incomplete, no blank reasons']]],
    ['Weekly', [['Monday', 'Open Site Leader Flags and the Support Report for your school'], ['Wednesday', 'Flags cleared, or escalated with a plan'], ['Thursday', 'Lesson plans checked for next week'], ['Friday', 'Teacher touchpoint on pull-outs or schedule changes']]],
    ['Every two weeks', [['PM check-in', 'Bring your own snapshot: what’s working, top two flags, what you did, what you need']]],
  ];
  let y = 1.95;
  const heights = [1.45, 1.75, 1.05];
  rows.forEach((r, i) => {
    const h = heights[i];
    txt(s, r[0], { x: 0.6, y: y + 0.05, w: 2.3, h: 0.5, fontFace: 'Cambria', fontSize: 22, color: HEX.ink });
    const n = r[1].length, gx = 3.0, gw = 9.7, g = 0.15;
    const cw = (gw - g * (n - 1)) / n;
    r[1].forEach((c, j) => {
      const x = gx + j * (cw + g);
      box(s, x, y, cw, h - 0.15, i === 2 ? HEX.goldWash : HEX.wash);
      txt(s, c[0].toUpperCase(), { x: x + 0.2, y: y + 0.15, w: cw - 0.3, h: 0.3, fontSize: 10.5, bold: true, charSpacing: 2, color: i === 2 ? HEX.goldInk : HEX.navy2 });
      txt(s, c[1], { x: x + 0.2, y: y + 0.45, w: cw - 0.35, h: h - 0.65, fontSize: 13, color: HEX.ink });
    });
    y += h;
  });
  s.addNotes(`This is the Site Leader Playbook one-pager. Hand it out now.

The two habits that change everything:
1. Morning coverage check. Tutor absence was the #1 reason scholars missed. If a tutor is out, you know before first block, and you either cover, regroup, or cancel with a reason.
2. End-of-day Pearl sweep. Five minutes. Filter to today. Anything still Scheduled or with a blank reason gets fixed while the tutor is still in the building.

"Every two weeks, you bring the snapshot, not us. That's the shift from being reached out to, to reaching out."`);
}

// 13. Section: Escalation
pres.addSection({ title: 'Escalation' });
{
  const s = pres.addSlide({ masterName: 'SECTION_DARK', sectionTitle: 'Escalation' });
  s.addText('Escalation: who, when, and how', { placeholder: 'title' });
  s.addText('Escalating isn’t passing the problem up. It’s bringing it up early, with what you already tried.', { placeholder: 'body' });
  s.addNotes(`Transition line: "Owning it doesn't mean handling everything alone. It means knowing exactly when to bring it up, who to bring it to, and what to bring with you."`);
}

// 14. The ladder
{
  const s = content('Escalation', 'The escalation ladder', 'Solve it at your level. Raise it one step when you can’t.');
  const steps = [
    ['Tutor', 'Raise to your Site Leader', [['now', 'Before the session'], 'Late, out, no room, whole group gone, any safety worry'], 'Same day: behavior, roster, Pearl problems'],
    ['Site Leader', 'Raise to your Program Manager', [['today', 'Within 24 hours'], 'Safety (same day), a session you can’t cover, same issue twice with no fix'], 'Anything that needs a principal’s decision'],
    ['Program Mgr', 'Raise to partner administration', [['week', 'With a plan'], 'Patterns that cost dosage: pull-outs, schedule, space'], 'Safety: alongside the school’s own process'],
    ['Partner admin', 'Decides for the school', [['gold', 'One NJTC voice'], 'Schedules, rooms, teacher expectations, school safety process'], ''],
  ];
  const sw = 2.95, g = 0.1;
  steps.forEach((st, i) => {
    const x = 0.6 + i * (sw + g);
    const top = 3.05 - i * 0.3;
    const dark = i === 3;
    box(s, x, top, sw, 6.25 - top, dark ? HEX.navy : HEX.wash);
    num(s, x + 0.2, top + 0.2, i + 1, { d: 0.45, size: 16, fill: dark ? 'FFFFFF' : HEX.navy, color: dark ? HEX.navy : HEX.gold });
    txt(s, st[0], { x: x + 0.75, y: top + 0.18, w: sw - 0.85, h: 0.5, valign: 'middle', fontFace: 'Cambria', fontSize: 18, color: dark ? 'FFFFFF' : HEX.ink, fit: 'shrink' });
    txt(s, st[1], { x: x + 0.2, y: top + 0.8, w: sw - 0.35, h: 0.3, fontSize: 12, bold: true, color: dark ? HEX.gold : HEX.goldInk });
    chip(s, x + 0.2, top + 1.15, st[2][0][1], st[2][0][0]);
    txt(s, st[2][1] + (st[3] ? '\n\n' + st[3] : ''), { x: x + 0.2, y: top + 1.6, w: sw - 0.4, h: 6.1 - top - 1.65, fontSize: 12.5, color: dark ? 'D6DEE8' : HEX.body });
  });
  txt(s, 'Every escalation gets an answer back down the ladder within 24 hours: PM to Site Leader to tutor.', { x: 0.6, y: 6.38, w: 12, h: 0.35, fontSize: 13, bold: true, color: HEX.navy });
  s.addNotes(`Walk up the ladder left to right.

Make two boundaries crystal clear:
1. Tutors do not take concerns to school administration. Ever. They go to their Site Leader. (We've had irate emails from tutors to school admin. This is how we prevent that.)
2. Site Leaders handle teacher-level conversations. They're the relationship. But anything that needs a principal's decision (moving a period, losing a room, a teacher who keeps pulling scholars after you've talked) goes through the Program Manager. The school should hear one NJTC voice.

Exception: safety. Follow the school's safeguarding process right away, then tell the PM the same day.

And the promise going the other way: every escalation gets a reply within 24 hours. Ownership goes both directions.`);
}

// 15. Three questions
{
  const s = content('Escalation', 'Quick hits: when in doubt, ask three questions', 'Three questions decide when to escalate');
  const qs = [
    ['Is anyone unsafe?', 'now', 'Escalate now', 'Tell your Site Leader and follow the school’s process. The Program Manager hears it the same day.'],
    ['Will a session be missed?', 'today', 'Before it starts', 'Tutor tells the Site Leader. The Site Leader covers, regroups, or cancels in Pearl with a reason.'],
    ['Has it happened twice?', 'week', 'Move it up one step', 'Once is a moment. Twice is a pattern. Bring it up with the four-line message.'],
  ];
  qs.forEach((q, i) => {
    const y = 2.0 + i * 1.45;
    num(s, 0.6, y + 0.12, i + 1, { d: 0.7, size: 24 });
    txt(s, q[0], { x: 1.6, y, w: 5.0, h: 0.95, valign: 'middle', fontFace: 'Cambria', fontSize: 28, color: HEX.ink });
    chip(s, 6.8, y + 0.3, q[2], q[1]);
    txt(s, q[3], { x: 9.0, y, w: 3.7, h: 1.0, valign: 'middle', fontSize: 13.5 });
    if (i < 2) s.addShape(SHAPE.line, { x: 1.6, y: y + 1.2, w: 11.1, h: 0, line: { color: HEX.line, width: 0.75 }, objectName: id('rule') });
  });
  txt(s, 'If the answer to all three is no: solve it at your level, and mention it at your next check-in.', { x: 1.6, y: 6.35, w: 11, h: 0.35, fontSize: 14, italic: true, color: HEX.muted });
  s.addNotes(`This is the "quick hit." If they remember one slide, it's this one.

Do a fast call-and-response to lock it in: "Is anyone unsafe?" (Now.) "Will a session be missed?" (Before it starts.) "Has it happened twice?" (Up one step.)

The "twice" rule takes the guesswork out. Site Leaders don't need to escalate every miss. They do need to escalate a pattern. That's also how the Repeat Unavailable list works on the flags: two or more in two weeks.`);
}

// 16. Four-line message
{
  const s = content('Escalation', 'How to raise it', 'The four-line escalation');
  const lines = [['What happened', 'Facts, dates, who. One or two sentences.'], ['What I already did', 'Shows ownership. Never skip this line.'], ['What I need', 'A decision, a conversation, a fix in Pearl.'], ['By when', 'So the answer comes before the next session.']];
  lines.forEach((l, i) => {
    const y = 2.05 + i * 1.05;
    num(s, 0.6, y, i + 1, { d: 0.5, size: 17 });
    txt(s, l[0], { x: 1.3, y: y - 0.05, w: 4.3, h: 0.45, fontSize: 19, bold: true, color: HEX.ink });
    txt(s, l[1], { x: 1.3, y: y + 0.4, w: 4.3, h: 0.4, fontSize: 13, color: HEX.muted });
  });
  // example message card
  box(s, 6.3, 1.85, 6.43, 4.55, HEX.wash);
  txt(s, 'EXAMPLE  ·  SITE LEADER TO PROGRAM MANAGER', { x: 6.65, y: 2.08, w: 5.9, h: 0.3, fontSize: 10.5, bold: true, charSpacing: 2, color: HEX.goldInk });
  const ex = [
    ['What happened: ', 'The 6th-grade math group was kept in class by their teacher for 3 of the last 4 sessions (10/21, 10/23, 10/28).'],
    ['What I did: ', 'Met with the teacher on 10/24. We agreed on a pull-out time, and it happened again on 10/28.'],
    ['What I need: ', 'You to raise the period-3 schedule with the principal.'],
    ['By when: ', 'Before Monday’s sessions.'],
  ];
  s.addText(ex.flatMap((e, i) => [
    { text: e[0], options: { bold: true, color: HEX.ink } },
    { text: e[1], options: { color: HEX.body, breakLine: i < ex.length - 1 } },
  ]), { x: 6.65, y: 2.5, w: 5.8, h: 3.7, isTextBox: true, margin: 0, fontFace: 'Calibri', fontSize: 14.5, valign: 'top', paraSpaceAfter: 12, objectName: id('ex') });
  s.addNotes(`The format works in a text, an email, or a hallway conversation.

Point at line 2: "What I already did is the line that turns a complaint into ownership. If you can't fill in line 2, you're probably not ready to escalate yet. Try something first, unless it's safety."

Point out that the example is exactly the gold bar from the data slide: teacher pull-outs. The Site Leader tried first, then escalated with a specific ask.`);
}

// 17. Scenario sort
{
  const s = content('Escalation', 'Scenario sort  ·  pairs  ·  10 min', 'Who owns it, when, and who’s next?');
  txt(s, 'With a partner, sort each card:', { x: 0.6, y: 1.95, w: 3.6, h: 0.4, fontSize: 15, bold: true, color: HEX.ink });
  bullets(s, ['Who owns it first?', 'How fast: now, today, or this week?', 'If it isn’t solved, who’s next on the ladder?'], { x: 0.6, y: 2.45, w: 3.5, h: 1.6, fontSize: 14 });
  txt(s, 'We’ll debrief four of these together.', { x: 0.6, y: 4.3, w: 3.5, h: 0.6, fontSize: 13, italic: true, color: HEX.muted });
  const cards = [
    ['A', '7:40 a.m. A tutor texts that they’re sick. They have four sessions today.'],
    ['B', 'The same group has been kept in class by their teacher three sessions in a row.'],
    ['C', 'A scholar writes in a survey that other kids “are being mean to me.”'],
    ['D', 'An assembly is announced at 8 a.m. The whole period-3 group will be gone.'],
    ['E', 'A tutor’s sessions from yesterday are still “Incomplete,” for the second time this month.'],
    ['F', 'A tutor hasn’t turned in lesson plans for two weeks.'],
    ['G', 'The principal stops you in the hall: “Starting Monday, tutoring moves to 5th period.”'],
    ['H', 'A frustrated tutor wants to email the principal about losing their room again.'],
  ];
  const gx = 4.45, cw = 2.0, ch = 2.15, g = 0.1;
  cards.forEach((c, i) => {
    const x = gx + (i % 4) * (cw + g), y = 1.95 + Math.floor(i / 4) * (ch + g);
    box(s, x, y, cw, ch, 'FFFFFF', { line: { color: HEX.line, width: 1 } });
    txt(s, c[0], { x: x + 0.18, y: y + 0.12, w: 0.5, h: 0.45, fontFace: 'Cambria', fontSize: 22, color: HEX.goldInk });
    txt(s, c[1], { x: x + 0.18, y: y + 0.6, w: cw - 0.3, h: ch - 0.7, fontSize: 12, color: HEX.ink });
  });
  s.addNotes(`Hand out the printed Scenario Cards (one set per pair). Give them 7 minutes to sort, then 3 to debrief.

As you circulate, listen for these common misses:
• D (assembly): people say "log it as missed." No. The Site Leader cancels in Pearl with the School Event reason, before the session.
• G (principal): people say "OK, I'll make it work." No. "Let me loop in my PM so we get it right in Pearl." The SL doesn't agree to schedule changes alone.
• H (tutor email): tutors never go to administration directly.

The full answer key is in the Facilitator Guide.`);
}

// 18. Debrief
{
  const s = content('Escalation', 'Scenario debrief', 'Four that trip people up');
  const items = [
    ['C', 'A scholar says other kids are “being mean to me”', 'now', 'Today', 'Tutor tells the Site Leader today. The Site Leader tells the classroom teacher or counselor following the school’s process, and tells the PM the same day.'],
    ['D', 'An assembly takes the whole group', 'today', 'Before the session', 'Tutor tells the Site Leader right away. The Site Leader cancels in Pearl with “School Event/Assembly.” Not a missed session, and no escalation needed.'],
    ['G', 'The principal moves tutoring to a new period', 'today', 'Same day', 'Don’t agree on the spot: “Let me loop in my PM so we get it right.” The PM confirms with administration and updates Pearl.'],
    ['H', 'A tutor wants to email the principal', 'today', 'Same day', 'Tutor goes to the Site Leader, not administration. The Site Leader solves the room today. If it repeats, the PM raises it. One NJTC voice.'],
  ];
  const cw = 5.95, ch = 2.15, g = 0.2;
  items.forEach((it, i) => {
    const x = 0.6 + (i % 2) * (cw + g), y = 1.95 + Math.floor(i / 2) * (ch + g);
    box(s, x, y, cw, ch, HEX.wash);
    txt(s, it[0], { x: x + 0.25, y: y + 0.18, w: 0.5, h: 0.5, fontFace: 'Cambria', fontSize: 26, color: HEX.goldInk });
    txt(s, it[1], { x: x + 0.8, y: y + 0.2, w: cw - 2.8, h: 0.5, fontSize: 14.5, bold: true, color: HEX.ink, valign: 'middle' });
    const cwid = 0.16 + it[3].length * 0.095;
    chip(s, x + cw - cwid - 0.25, y + 0.29, it[3], it[2]);
    txt(s, it[4], { x: x + 0.8, y: y + 0.85, w: cw - 1.05, h: ch - 0.95, fontSize: 13 });
  });
  s.addNotes(`Cold call a pair for each card before you reveal the answer. "Bergen MS, what did you put for C?"

Spend the most time on C. That's a safety-tier comment. The portal's Comment Follow-Up flags exactly this kind of note as "Escalate (24 hrs)." It's not a "this week" item.

If time is tight, do C and G only.`);
}

// 19. Two-week standards
pres.addSection({ title: 'Commit' });
{
  const s = content('Commit', 'What we’ll look for by Thursday, Nov 19', 'Six signs a site is running proactively');
  const items = [
    ['No session left Incomplete overnight', 'Tutor closes it; Site Leader sweeps'],
    ['No blank missed reasons', '“Scholar Unavailable” when the reason is unknown'],
    ['Every cancellation has a reason', 'Cancelled by the Site Leader, before the session'],
    ['Tutor absences reported before the session', 'With a coverage plan, not an apology'],
    ['Site Leader Flags cleared by Wednesday', 'Or escalated with the four-line message'],
    ['The region hears it from the site first', 'Nobody has to reach out to ask'],
  ];
  items.forEach((it, i) => {
    const col = i % 2, row = Math.floor(i / 2);
    const x = 0.6 + col * 6.15, y = 2.0 + row * 1.4;
    s.addShape(SHAPE.roundRect, { x, y: y + 0.05, w: 0.42, h: 0.42, fill: { color: 'FFFFFF' }, line: { color: HEX.navy, width: 1.5 }, rectRadius: 0.06, objectName: id('cb') });
    txt(s, it[0], { x: x + 0.65, y, w: 5.2, h: 0.5, fontSize: 17, bold: true, color: HEX.ink, valign: 'middle' });
    txt(s, it[1], { x: x + 0.65, y: y + 0.5, w: 5.2, h: 0.4, fontSize: 13, color: HEX.muted });
  });
  txt(s, 'We’ll look at the Site Leader Flags view together on the 19th. The goal is a short list, not a perfect one.', { x: 0.6, y: 6.25, w: 12, h: 0.4, fontSize: 14, italic: true, color: HEX.goldInk });
  s.addNotes(`These are the success measures. All of them are visible in the portal's Site Leader Flags and Support Report, so nobody has to self-report.

Frame it as a two-week sprint, not a permanent judgment: "In two weeks, we'll pull up the flags together. I'm not looking for zero. I'm looking for a shorter list, and for every item on it, I want to have heard about it from you first."`);
}

// 20. Everybody Writes
{
  const s = moment('Commit', 'Everybody Writes', 5, 'Fill in your commitment card: one flag to eliminate, one routine to start Monday, one thing you need from your Program Manager.', 'Then a whip-around: one sentence each. “At my site, starting Monday, I will…”');
  s.addNotes(`Hand out the Commitment Cards. Give 3 minutes of silent writing.

Whip-around: every Site Leader reads one sentence, "At my site, starting Monday, I will…" Keep it moving; no discussion. This takes about 2 minutes for a group this size.

Collect the cards (or take a photo of each). Taneisha and the PMs use them at the Nov 19 check-in.`);
}

// 21. Close
{
  const s = pres.addSlide({ masterName: 'SECTION_DARK', sectionTitle: 'Commit' });
  s.addText('If the region finds it before the site does, we’re late.', { placeholder: 'title' });
  s.addText('Next check-in: Thursday, Nov 19. Bring your snapshot and your commitment card.', { placeholder: 'body' });
  s.addNotes(`Close on ownership, not on flags.

"You all already know your sites better than any report does. Today was about making sure we hear what you know first. Thank you for the work you're doing."

Hand the last word to Taneisha if she wants it.`);
}

(async () => {
  await pres.writeFile({ fileName: OUT });
  await applyTheme(OUT, THEME);
  console.log('wrote', OUT);
})();
