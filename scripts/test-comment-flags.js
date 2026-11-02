#!/usr/bin/env node
/**
 * Checks shared/comment-flags.js against real (lightly edited) Pearl survey
 * comments from the Oct 2026 review. No network. Run: node scripts/test-comment-flags.js
 */
const assert = require('assert');
const CF = require('../shared/comment-flags.js');
const t = (text, from, rating) => CF.triage({ text, from: from || 'tutor', rating });

// ── Must escalate (wellbeing / safety) ──────────────────────────────────────
[
  ['KC had a difficult start this session. She reported feeling sad and anxious, but did not want to talk about why.', 'tutor', 4, 'Scholar distress'],
  ['Students were unfocused. One of my students lost his grandfather this past weekend', 'tutor', 4, 'Grief or family loss'],
  ['Student broke his foot. I selected student unavailable because he is physically unable to go up and down the stairs.', 'tutor', 5, 'Injury or medical'],
  ['Aaron is being mean to me and Isaac is being mean to me', 'scholar', 5, 'Peer conflict / bullying'],
  ['home alone', 'scholar', 5, 'Scholar distress'],
].forEach(([text, from, r, cat]) => {
  const x = t(text, from, r);
  assert(x && x.tier === 'escalate', 'should escalate: ' + text);
  assert.strictEqual(x.category, cat, text);
});

// ── Must follow up ──────────────────────────────────────────────────────────
[
  ['this group did not learn anything from this session due to continued behavioral issues', 'tutor', 1, 'Behaviour stopping learning'],
  ['Amari mocked the tutor infront of everyone. Logan talked very aggressively to the tutor', 'tutor', 4, 'Behaviour stopping learning'],
  ['students could not focus because classroom is so loud. They keep asking for a pull out room.', 'tutor', 3, 'Learning environment'],
  ['This 3D session took place today from 12:35 but appears in Pearl at 4:00 p.m. The 3D and 3B sessions had disappeared from my Pearl schedule.', 'tutor', 4, 'Schedule or Pearl problem'],
  ['Students were upset that they had to be pulled out of PE. Minimal engagement.', 'tutor', 3, 'Schedule or Pearl problem'],
  ['I was given 5th student for this lesson will address with administration and site leader', 'tutor', 3, 'Roster or group size'],
  ['Had an Issue with one of the students, already informed homeroom teacher and admininstration', 'tutor', 3, 'Raised with the school'],
  ['There was a evacuation because the fire alarm went off due to gas smell; missed part of the session', 'tutor', 5, 'Site safety (FYI)'],
  ['Scholars not paying full attention to repeated lesson instructions. Simple work turned in was incorrect.', 'tutor', 2, 'Very low session rating'],
  ['hateee', 'scholar', 1, 'Scholar unhappy with session'],
  ['it is very loud we kept pausing because the teacher kept yelling at the noisy students', 'scholar', 5, 'Learning environment'],
].forEach(([text, from, r, cat]) => {
  const x = t(text, from, r);
  assert(x && x.tier === 'followup', 'should follow up: ' + text);
  assert.strictEqual(x.category, cat, text);
});

// ── Must NOT flag (ordinary session notes) ──────────────────────────────────
[
  ['Scholars demonstrated a solid understanding of place value. Next lesson will use number riddles.', 'tutor', 4],
  ['Cayden kind of jumped the gun and started writing right away but he had an idea that can really be fleshed out', 'tutor', 4],
  ['This group is amazing, academically and behaviorally.', 'tutor', 5],
  ['Session shortened due to Fire Drill', 'tutor', 2],
  ['Scholars behaved well in this session.', 'tutor', 4],
  ['No behavior issues today, great focus', 'tutor', 5],
  ['I hate math but I like my tutor', 'scholar', 5],   // dislike only counts on a low-rated session
  ['lol', 'scholar', 1],
].forEach(([text, from, r]) => assert.strictEqual(t(text, from, r), null, 'should not flag: ' + text));

// ── Stable ids ──────────────────────────────────────────────────────────────
assert.strictEqual(CF.commentId('s1', 'Tutor A', 'Hello  there'), CF.commentId('s1', 'tutor a', 'hello there'));
assert.notStrictEqual(CF.commentId('s1', 'Tutor A', 'x'), CF.commentId('s2', 'Tutor A', 'x'));

console.log('comment flags: all checks passed');

// ── Apps Script copy stays identical to the shared rules ────────────────────
{
  const fs = require('fs');
  const { embedded, SHARED, GS } = require('./sync-comment-flags-gs.js');
  const shared = fs.readFileSync(SHARED, 'utf8');
  assert.strictEqual(embedded(fs.readFileSync(GS, 'utf8')), shared.endsWith('\n') ? shared : shared + '\n',
    'apps-scripts/comment-followup.gs is out of date — run: node scripts/sync-comment-flags-gs.js');
  console.log('comment flags: Apps Script copy in sync');
}
