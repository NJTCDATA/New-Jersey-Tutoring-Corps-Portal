#!/usr/bin/env node
/**
 * Copies shared/comment-flags.js into apps-scripts/comment-followup.gs between
 * its BEGIN/END markers, so the daily escalation email uses exactly the same
 * rules as the portal. Run after editing the rules:
 *   node scripts/sync-comment-flags-gs.js
 * scripts/test-comment-flags.js fails if the two ever drift apart.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SHARED = path.join(ROOT, 'shared', 'comment-flags.js');
const GS = path.join(ROOT, 'apps-scripts', 'comment-followup.gs');
const BEGIN = /^\/\/ ==== BEGIN shared\/comment-flags\.js.*$/m;
const END = /^\/\/ ==== END shared\/comment-flags\.js ====$/m;

function embedded(gsText) {
  const b = gsText.match(BEGIN), e = gsText.match(END);
  if (!b || !e) throw new Error('markers not found in comment-followup.gs');
  return gsText.slice(b.index + b[0].length + 1, e.index);
}

function sync() {
  const shared = fs.readFileSync(SHARED, 'utf8');
  const gs = fs.readFileSync(GS, 'utf8');
  const b = gs.match(BEGIN), e = gs.match(END);
  if (!b || !e) throw new Error('markers not found in comment-followup.gs');
  const body = shared.endsWith('\n') ? shared : shared + '\n';
  fs.writeFileSync(GS, gs.slice(0, b.index + b[0].length) + '\n' + body + gs.slice(e.index));
}

if (require.main === module) { sync(); console.log('apps-scripts/comment-followup.gs synced with shared/comment-flags.js'); }
module.exports = { embedded, SHARED, GS };
