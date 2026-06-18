import chalk from 'chalk';
import type { RoutedQueryResult } from '@mnemos/core';

export interface CliOutputOptions {
  json?: boolean;
  quiet?: boolean;
  compact?: boolean;
}

export function renderQueryResult(result: RoutedQueryResult, options: CliOutputOptions = {}): void {
  if (options.json) {
    console.log(
      JSON.stringify(
        {
          question: result.question,
          summary: result.summary,
          answer: result.answer,
          confidence: result.confidence,
          intent: result.intent,
          route: result.route,
          sources: result.sources,
          relatedTopics: result.relatedTopics,
          tokens: { before: result.tokensBefore, after: result.tokensAfter },
          tookMs: result.tookMs,
        },
        null,
        2,
      ),
    );
    return;
  }

  if (options.quiet) {
    console.log(result.summary);
    return;
  }

  console.log('');
  console.log(chalk.bold.white('  Answer'));
  console.log(
    chalk.dim(
      `  ${(result.confidence * 100).toFixed(0)}% confidence · ${result.tookMs}ms · ${result.route}`,
    ),
  );

  if (options.compact || result.tokensAfter < result.tokensBefore) {
    console.log(
      chalk.dim(
        `  ${result.tokensAfter} tokens${result.tokensBefore > result.tokensAfter ? ` (−${result.tokensBefore - result.tokensAfter})` : ''}`,
      ),
    );
  }

  console.log('');
  console.log(result.answer.split('\n').map((line) => `  ${line}`).join('\n'));

  if (result.relatedTopics.length > 0) {
    console.log('');
    console.log(chalk.dim(`  Related: ${result.relatedTopics.slice(0, 5).join(' · ')}`));
  }
}

export function renderError(message: string, hint?: string): void {
  console.error('');
  console.error(chalk.red('  ✗ ') + message);
  if (hint) console.error(chalk.dim(`    ${hint}`));
}
