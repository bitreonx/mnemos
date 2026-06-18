import { estimateTokens } from '../proxy/compress-output.js';

const CHARS_PER_TOKEN = 4;

function trimBullets(text: string, maxBullets: number): string {
  const lines = text.split('\n');
  const out: string[] = [];
  let bullets = 0;

  for (const line of lines) {
    const isBullet = /^\s*[-*•]\s/.test(line) || /^\s*\d+\.\s/.test(line);
    if (isBullet) {
      bullets += 1;
      if (bullets > maxBullets) continue;
    }
    out.push(line);
  }

  if (bullets > maxBullets) {
    out.push(`… ${bullets - maxBullets} more items omitted`);
  }

  return out.join('\n');
}

function trimAtSentence(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;

  const slice = text.slice(0, maxChars);
  const lastBreak = Math.max(slice.lastIndexOf('\n\n'), slice.lastIndexOf('. '));
  if (lastBreak > maxChars * 0.55) {
    return `${slice.slice(0, lastBreak).trimEnd()}…`;
  }
  return `${slice.trimEnd()}…`;
}

function stripRedundantMarkdown(text: string): string {
  return text
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]+$/gm, '')
    .trim();
}

/**
 * Fit prose and markdown answers into a token budget without losing the lead sentence.
 */
export function optimizeContextWindow(
  text: string,
  maxTokens: number,
  maxBullets = 8,
): { text: string; tokensBefore: number; tokensAfter: number } {
  const tokensBefore = estimateTokens(text);
  if (tokensBefore <= maxTokens) {
    return { text, tokensBefore, tokensAfter: tokensBefore };
  }

  let working = stripRedundantMarkdown(text);
  working = trimBullets(working, maxBullets);

  const maxChars = maxTokens * CHARS_PER_TOKEN;
  if (working.length > maxChars) {
    working = trimAtSentence(working, maxChars);
  }

  const tokensAfter = estimateTokens(working);
  return { text: working, tokensBefore, tokensAfter };
}

export function extractSummary(text: string, maxLen = 160): string {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  const first =
    lines.find((l) => !/^#+\s/.test(l) && !/^[-*•]\s/.test(l)) ??
    lines[0] ??
    text.trim();
  const cleaned = first.replace(/\*\*/g, '').replace(/^#+\s*/, '');
  if (cleaned.length <= maxLen) return cleaned;
  return `${cleaned.slice(0, maxLen - 1)}…`;
}
