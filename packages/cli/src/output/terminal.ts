import chalk from 'chalk';
import { COLORS } from './format.js';

const WIDTH = 56;

export function printMnemosBanner(subtitle = 'Give AI a memory of your codebase'): void {
  const brand = chalk.hex('#863bff');
  console.log('');
  console.log(`  ${brand('◈')} ${chalk.bold.white('Mnestis')} ${chalk.dim('—')} ${chalk.dim(subtitle)}`);
  console.log(chalk.dim('  ' + '─'.repeat(WIDTH)));
  console.log('');
}

export function printSection(title: string): void {
  console.log('');
  console.log(chalk.bold.white(`  ${title}`));
  console.log(chalk.dim('  ' + '─'.repeat(Math.min(title.length + 4, WIDTH))));
}

export function printMetricRow(label: string, value: string | number, hint?: string): void {
  const val = chalk.cyan.bold(String(value));
  console.log(`  ${chalk.dim(label.padEnd(18))} ${val}${hint ? chalk.dim(`  ${hint}`) : ''}`);
}

export function printKeyValueTable(rows: Array<{ key: string; value: string; hint?: string }>): void {
  for (const row of rows) {
    console.log(`  ${chalk.dim(row.key.padEnd(22))} ${chalk.cyan(row.value)}${row.hint ? chalk.dim(`  ${row.hint}`) : ''}`);
  }
}

export function printBox(title: string, lines: string[]): void {
  const accent = chalk.hex(COLORS.accent);
  console.log('');
  console.log(accent('  ┌─ ') + chalk.bold(title));
  for (const line of lines) {
    console.log(accent('  │ ') + line);
  }
  console.log(accent('  └' + '─'.repeat(WIDTH - 1)));
}

export function printSuccessLine(message: string): void {
  console.log(chalk.green('  ✓ ') + message);
}

export function printInfoLine(message: string): void {
  console.log(chalk.blue('  ℹ ') + chalk.dim(message));
}

export function printWarnLine(message: string): void {
  console.log(chalk.yellow('  ⚠ ') + message);
}

export function printCompressStats(stats: {
  estimatedOriginalTokens: number;
  estimatedCompressedTokens: number;
  savingsPercent: number;
  compressedLines: number;
  phaseStats?: {
    noiseStripped: number;
    pathsShortened: number;
    stackFramesFolded: number;
    duplicatesRemoved: number;
    budgetDropped: number;
  };
}): void {
  printSection('Token compression');
  printMetricRow('Before (est.)', stats.estimatedOriginalTokens, 'tokens');
  printMetricRow('After (est.)', stats.estimatedCompressedTokens, 'tokens');
  printMetricRow('Saved', `${stats.savingsPercent}%`, `${stats.compressedLines} lines kept`);
  if (stats.phaseStats) {
    const { noiseStripped, stackFramesFolded, duplicatesRemoved } = stats.phaseStats;
    if (noiseStripped + stackFramesFolded + duplicatesRemoved > 0) {
      printInfoLine(
        `Phases: ${noiseStripped} noise · ${stackFramesFolded} stack · ${duplicatesRemoved} dupes removed`,
      );
    }
  }
}
