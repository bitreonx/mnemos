#!/usr/bin/env node
/**
 * INFERNO verification unit tests — no fixture clones required.
 */
import { scoreTask, scoreContextPackage, aggregateVerification, scoreDigestSearch } from './verify.mjs';

let passed = 0;
let failed = 0;

function assert(condition, label) {
  if (condition) {
    passed++;
    console.log(`  ✓ ${label}`);
  } else {
    failed++;
    console.error(`  ✗ ${label}`);
  }
}

console.log('INFERNO verify harness tests\n');

// required_any uses OR semantics (not AND)
const orResult = scoreTask('HTTP middleware routing framework', {
  required_any: ['http framework', 'middleware', 'routing', 'request'],
  min_required_any: 1,
});
assert(orResult.accuracy >= 95, 'required_any OR: one match passes');
assert(orResult.gates.anyOk, 'required_any gate passes with one hit');

const orFail = scoreTask('nothing relevant here', {
  required_any: ['authentication', 'payments', 'notifications'],
  min_required_any: 1,
});
assert(orFail.accuracy < 50, 'required_any OR: zero matches fails');

// required uses AND semantics
const andResult = scoreTask('login route examples/auth handler', {
  required_keywords: ['login', 'route', 'examples/auth'],
});
assert(andResult.accuracy === 100, 'required AND: all keywords present');

const andPartial = scoreTask('login route only', {
  required_keywords: ['login', 'route', 'examples/auth'],
});
assert(andPartial.accuracy < 100, 'required AND: partial match scores below 100');

// forbidden penalty
const trap = scoreTask('school attendance bus routing framework', {
  required_keywords: ['framework'],
  forbidden_keywords: ['school', 'attendance', 'bus'],
});
assert(trap.forbidden_hits.length === 3, 'forbidden traps detected');
assert(trap.accuracy < 100, 'forbidden keywords apply penalty');

// path assertions
const pathHit = scoreTask('Entry at examples/auth/index.js with GET /login', {
  required_paths: ['examples/auth'],
});
assert(pathHit.gates.pathsOk, 'required_paths match normalized paths');

// tier A verification
const tierA = scoreTask(
  'Express HTTP middleware routing framework in lib/application.js',
  {
    required_keywords: ['http', 'middleware', 'routing', 'framework', 'express'],
    forbidden_keywords: ['school'],
  },
);
assert(tierA.verification_tier === 'A', 'full rubric yields tier A');

// context package
const ctx = scoreContextPackage(
  {
    tokens: 8000,
    sizes: { 'project.dna.json': 4000, 'agent_context.json': 2000, 'context/architecture.md': 1500 },
  },
  { tokens: 177553 },
);
assert(ctx.verified, 'context package passes artifact + compression gates');

// aggregate
const agg = aggregateVerification([
  { accuracy: 100, verified: true },
  { accuracy: 100, verified: true },
  { accuracy: 83, verified: false },
]);
assert(agg.verification_tier === 'B', 'aggregate tier B when one task unverified');
assert(agg.tasks_verified === 2, 'aggregate counts verified tasks');

// digest search baseline
const digest = scoreDigestSearch(
  'Express is a minimal HTTP framework. Login example at examples/auth/index.js. lib/application.js is core.',
  {
    task1_login_start: { required_keywords: ['login', 'examples/auth'] },
    task3_explain: { required_keywords: ['http', 'framework', 'express'] },
  },
);
assert(digest.accuracy > 50, 'digest keyword search yields non-zero accuracy');

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
