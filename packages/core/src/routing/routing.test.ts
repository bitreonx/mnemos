import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { optimizeContextWindow, extractSummary } from '../routing/optimize-context.js';
import { minimizeOverhead } from '../routing/minimize-overhead.js';

describe('optimizeContextWindow', () => {
  it('returns unchanged text when under budget', () => {
    const text = 'Short answer.';
    const result = optimizeContextWindow(text, 500);
    assert.equal(result.text, text);
    assert.equal(result.tokensBefore, result.tokensAfter);
  });

  it('trims long bullet lists', () => {
    const bullets = Array.from({ length: 20 }, (_, i) => `- item ${i}`).join('\n');
    const result = optimizeContextWindow(bullets, 40, 5);
    assert.ok(result.text.includes('more items omitted'));
    assert.ok(result.tokensAfter <= result.tokensBefore);
  });

  it('extractSummary keeps the first meaningful line', () => {
    const summary = extractSummary('## Title\n\nFirst real sentence here.');
    assert.ok(summary.includes('First real sentence'));
  });
});

describe('minimizeOverhead', () => {
  it('compresses noisy repeated lines', () => {
    const raw = Array.from({ length: 8 }, () => 'same log line').join('\n');
    const { text, stats } = minimizeOverhead(raw, { maxLines: 10 });
    assert.ok(stats.tokensAfter <= stats.tokensBefore);
    assert.ok(text.split('\n').length <= raw.split('\n').length);
  });
});
