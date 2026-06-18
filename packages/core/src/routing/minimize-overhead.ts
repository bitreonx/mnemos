import { compressCommandOutput, estimateTokens } from '../proxy/compress-output.js';

export interface OverheadStats {
  tokensBefore: number;
  tokensAfter: number;
  linesBefore: number;
  linesAfter: number;
}

/**
 * Apply log-style compression to verbose command or answer text.
 */
export function minimizeOverhead(
  raw: string,
  options: { maxLines?: number; maxLineLength?: number } = {},
): { text: string; stats: OverheadStats } {
  const tokensBefore = estimateTokens(raw);
  const linesBefore = raw.split(/\r?\n/).length;

  const { text, stats } = compressCommandOutput(raw, {
    maxLines: options.maxLines ?? 80,
    maxLineLength: options.maxLineLength ?? 220,
    prioritizeErrors: true,
    fuzzyDedupe: true,
    stripNoise: true,
  });

  return {
    text,
    stats: {
      tokensBefore,
      tokensAfter: stats.estimatedCompressedTokens,
      linesBefore,
      linesAfter: stats.compressedLines,
    },
  };
}
