import path from 'node:path';
import type { Command } from 'commander';
import { MnemosRuntime, MnemosAgentError } from '@mnemos/core';
import { printWarnLine, printInfoLine } from '../output/terminal.js';
import chalk from 'chalk';

export interface GlobalCliFlags {
  path: string;
  json: boolean;
  quiet: boolean;
  compact: boolean;
}

export function resolveRepoRoot(flags: { path?: string }, fallback = '.'): string {
  return path.resolve(flags.path ?? fallback);
}

export function attachGlobalOptions(command: Command): Command {
  return command
    .option('-C, --path <path>', 'Repository path', '.')
    .option('--json', 'Structured JSON output', false)
    .option('-q, --quiet', 'Summary only', false)
    .option('--compact', 'Aggressive token compression', false);
}

export async function withRuntime<T>(
  root: string,
  fn: (runtime: MnemosRuntime) => Promise<T>,
): Promise<T> {
  const runtime = new MnemosRuntime(root);
  try {
    await runtime.load();
    return await fn(runtime);
  } catch (err) {
    if (err instanceof MnemosAgentError) {
      printWarnLine(err.message);
      if (err.hint) printInfoLine(err.hint);
      process.exit(1);
    }
    throw err;
  }
}

export function readGlobalFlags(options: Record<string, unknown>): GlobalCliFlags {
  return {
    path: String(options.path ?? '.'),
    json: Boolean(options.json),
    quiet: Boolean(options.quiet),
    compact: Boolean(options.compact),
  };
}

export function hintBuild(): void {
  printInfoLine(`Run ${chalk.cyan('mnemos build .')} first.`);
}
