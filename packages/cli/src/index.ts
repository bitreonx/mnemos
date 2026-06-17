#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync, statSync } from 'node:fs';
import { openInBrowser } from './lib/browser.js';
import {
  printCheck,
  printArtifactLegend,
  printReaderModes,
  printReportPaths,
  printDashboardPreviewNote,
  printPrimaryNextSteps,
  printBuildSummary,
  printContextDocs,
} from './output/format.js';
import {
  printMnemosBanner,
  printSection,
  printMetricRow,
  printKeyValueTable,
  printCompressStats,
  printSuccessLine,
  printInfoLine,
  printWarnLine,
} from './output/terminal.js';
import {
  build,
  loadMemoryModel,
  findDomain,
  findFlow,
  analyzeImpact,
  formatImpactReport,
  buildGraph,
  scanRepository,
  parseFiles,
  generateReport,
  buildAgentExports,
  computeMemoryScore,
  explainRepository,
  formatExplainReport,
  buildOnboardGuide,
  formatOnboardGuide,
  buildDnaReport,
  formatDnaReport,
  reviewDiff,
  formatReviewReport,
  askCopilot,
  startMemoryServer,
  computeDomainHeatmap,
  buildArchitectureNarrative,
  formatArchitectureStory,
  generateSnapshots,
  computeAiReadiness,
  buildAiToolkit,
  installAiIntegrations,
  uninstallAiIntegrations,
  loadPersistedGraph,
  loadOrBuildSearchIndex,
  getNodeQueryIndex,
  queryGraph,
  findGraphPath,
  explainNode,
  formatPathResult,
  formatNodeExplain,
  startMcpServer,
  runExport,
  installHooks,
  uninstallHooks,
  getHookStatus,
  ALL_PLATFORMS,
  FABLE_DATASET_URL,
  buildMcpSetupMarkdown,
  MNEMOS_VERSION,
  MnemosRuntime,
  buildAiPack,
  aiPackToJson,
  startGraphSync,
  compressCommandOutput,
  type AiPackSection,
  type Mode as AiPackMode,
} from '@mnemos/core';
import type { MnemosGraph } from '@mnemos/core';

const program = new Command();

async function loadGraphFromMemory(outputDir: string): Promise<MnemosGraph | undefined> {
  const graph = await loadPersistedGraph(outputDir);
  if (graph) getNodeQueryIndex(graph);
  return graph;
}

/**
 * Load the memory model or exit with a single, consistent, actionable message.
 * Every command that reads a built model should funnel through here so the
 * "not built yet" experience is identical everywhere.
 */
async function requireMemoryModel(root: string): Promise<NonNullable<Awaited<ReturnType<typeof loadMemoryModel>>>> {
  const loaded = await loadMemoryModel(root);
  if (!loaded) {
    console.log('');
    printWarnLine('No memory model found for this repository.');
    printInfoLine(`Run ${chalk.cyan('mnemos build .')} first (or just ${chalk.cyan('npx mnemos .')} for the full experience).`);
    process.exit(1);
  }
  return loaded;
}

program
  .name('mnemos')
  .description('The memory layer for software — pure Node, no Python or other runtime required.')
  .version(MNEMOS_VERSION, '-V, --version', 'Print the Mnemos version')
  .showHelpAfterError('(run `mnemos --help` to see all commands)')
  .showSuggestionAfterError(true)
  .configureHelp({ sortSubcommands: true });

program
  .command('build [path]')
  .description('Build a complete mental model of a repository')
  .option('-v, --verbose', 'Show detailed progress')
  .option('-o, --output <dir>', 'Output directory', '.mnemos')
  .option('--incremental', 'Use incremental cache when rebuilding', true)
  .option('--no-incremental', 'Force full rebuild')
  .option('--watch', 'Re-build when source files change', false)
  .action(async (targetPath = '.', options) => {
    const root = path.resolve(targetPath);
    const outputDir = path.join(root, options.output);

    if (!options.watch) {
      await runBuildOnce(root, outputDir, options);
      return;
    }

    console.log(chalk.bold(`\nWatching ${root} for changes…`));
    console.log(chalk.dim('Press Ctrl+C to stop.\n'));
    await runBuildOnce(root, outputDir, options);

    let debounce: NodeJS.Timeout | null = null;
    const trigger = () => {
      if (debounce) clearTimeout(debounce);
      debounce = setTimeout(async () => {
        const t = new Date().toLocaleTimeString();
        console.log(chalk.dim(`\n[${t}] Change detected, rebuilding…`));
        try {
          await runBuildOnce(root, outputDir, options);
        } catch (err) {
          console.error(chalk.red('Rebuild failed:'), err);
        }
      }, 300);
    };

    const { watch } = await import('node:fs');
    const recursive = process.platform !== 'win32';
    try {
      watch(
        root,
        { recursive, persistent: true },
        (_event, filename) => {
          if (!filename) return;
          const f = String(filename);
          if (f.includes('node_modules') || f.includes('.mnemos') || f.includes('.git')) return;
          if (f.includes('package-lock.json') || f.endsWith('.map')) return;
          trigger();
        },
      );
      console.log(chalk.dim('(fs.watch active — events may be batched on Windows)'));
    } catch {
      console.log(chalk.dim('Falling back to polling mode'));
      setInterval(trigger, 2000);
    }
  });

async function runBuildOnce(root: string, outputDir: string, options: { verbose?: boolean; incremental?: boolean }) {
  const spinner = ora(`Building memory model for ${root}`).start();
  try {
    const result = await build({
      root,
      outputDir,
      verbose: options.verbose,
      incremental: options.incremental !== false,
    });
    spinner.succeed(chalk.green('Memory model built successfully'));

    const { stats } = result.memory;
    console.log('');
    printBuildSummary(stats);
    console.log('');
    printContextDocs();
    console.log('');
    console.log(`  Output: ${chalk.dim(outputDir)}`);
    console.log(`  DNA:    ${chalk.dim(path.join(outputDir, 'project.dna.json'))}`);
    console.log(`  Graphs: ${chalk.dim(path.join(outputDir, 'context', 'graphs.md'))}`);
  } catch (err) {
    spinner.fail(chalk.red('Build failed'));
    console.error(err);
    throw err;
  }
}

program
  .command('inspect <query>')
  .description('Inspect a domain, service, or node')
  .option('-p, --path <path>', 'Repository path', '.')
  .action(async (query, options) => {
    const root = path.resolve(options.path);
    const loaded = await requireMemoryModel(root);

    const { memory } = loaded;
    const domain = findDomain(memory.domains, query);

    if (domain) {
      console.log(chalk.bold(`\nDomain: ${domain.name}`));
      console.log(`Confidence: ${(domain.confidence * 100).toFixed(0)}%`);
      console.log(`Nodes: ${domain.nodes.length}`);
      console.log(`Description: ${domain.description}`);
      console.log('\nEntry points:');
      domain.entryPoints.slice(0, 10).forEach((e) => console.log(`  • ${e}`));
      return;
    }

    const service = memory.services.find(
      (s) => s.name.toLowerCase().includes(query.toLowerCase()),
    );
    if (service) {
      console.log(chalk.bold(`\nService: ${service.name}`));
      console.log(`Domain: ${service.domain ?? '—'}`);
      console.log(`Path: ${service.path}`);
      console.log(`Dependencies: ${service.dependencies.join(', ') || 'none'}`);
      console.log(`Dependents: ${service.dependents.join(', ') || 'none'}`);
      return;
    }

    console.log(chalk.yellow(`No domain or service matching "${query}"`));
    console.log('\nAvailable domains:');
    memory.domains.slice(0, 15).forEach((d) => console.log(`  • ${d.name}`));
  });

program
  .command('flows [query]')
  .description('List or search execution flows')
  .option('-p, --path <path>', 'Repository path', '.')
  .option('-t, --type <type>', 'Filter by type (request, event, dependency, user_journey)')
  .action(async (query, options) => {
    const root = path.resolve(options.path);
    const loaded = await requireMemoryModel(root);

    let flows = loaded.memory.flows;
    if (options.type) flows = flows.filter((f) => f.type === options.type);
    if (query) flows = findFlow(flows, query);

    console.log(chalk.bold(`\nFlows (${flows.length})\n`));

    for (const flow of flows.slice(0, 20)) {
      console.log(chalk.cyan(`${flow.name}`));
      console.log(`  Type: ${flow.type} | Confidence: ${(flow.confidence * 100).toFixed(0)}% | Steps: ${flow.steps.length}`);
      console.log(`  Entry: ${flow.entryPoint}`);
      console.log(`  ${chalk.dim(flow.description)}`);
      console.log('');
    }
  });

program
  .command('impact <node>')
  .description('Analyze blast radius of changing a node')
  .option('-p, --path <path>', 'Repository path', '.')
  .action(async (node, options) => {
    const root = path.resolve(options.path);
    const loaded = await requireMemoryModel(root);

    const spinner = ora('Rebuilding graph for impact analysis...').start();

    try {
      const scan = await scanRepository(root);
      const parsed = await parseFiles(scan.files, root);
      const graph = buildGraph(root, scan, parsed);
      spinner.stop();

      const result = analyzeImpact(graph, node);
      if (!result) {
        console.log(chalk.yellow(`No node matching "${node}"`));
        process.exit(1);
      }

      const affectedFlows = loaded.memory.flows.filter((f) =>
        f.steps.some((s) => result.affectedFiles.some((file) => s.path?.includes(file))),
      );
      const riskLevel =
        result.totalAffected > 30 ? 'High' : result.totalAffected > 10 ? 'Medium' : 'Low';

      console.log(formatImpactReport(result, graph));
      console.log('');
      console.log(chalk.bold(`Affected Flows: ${affectedFlows.length}`));
      affectedFlows.slice(0, 9).forEach((f) => console.log(`  • ${f.name}`));
      console.log('');
      console.log(chalk.bold(`Risk Score: ${riskLevel}`));
    } catch (err) {
      spinner.fail('Impact analysis failed');
      console.error(err);
      process.exit(1);
    }
  });

program
  .command('export-context')
  .description('Export AI context package')
  .option('-p, --path <path>', 'Repository path', '.')
  .action(async (options) => {
    const root = path.resolve(options.path);
    const loaded = await requireMemoryModel(root);

    const contextDir = path.join(loaded.outputDir, 'context');
    console.log(chalk.green('AI context package ready:'));
    console.log(`  ${contextDir}`);

    try {
      const files = ['repository_summary.md', 'architecture.md', 'domains.md', 'flows.md', 'critical_paths.md'];
      for (const f of files) {
        const content = await readFile(path.join(contextDir, f), 'utf-8');
        console.log(`  ${f}: ${chalk.dim(content.split('\n').length + ' lines')}`);
      }
    } catch {
      // context may not exist yet
    }
  });

program
  .command('report [path]')
  .description('Generate a self-contained HTML intelligence report')
  .option('-p, --path <path>', 'Repository path (alias of positional)', '.')
  .option('-o, --output <dir>', 'Output directory', 'report')
  .option('--report-path <file>', 'Also write report HTML at this path (e.g. report.html at repo root)')
  .option('--open', 'Open the report in the default browser after generation', false)
  .action(async (targetPath = '.', options) => {
    const root = path.resolve(options.path && options.path !== '.' ? options.path : targetPath);
    const loaded = await requireMemoryModel(root);

    const spinner = ora('Generating intelligence report...').start();

    try {
      const outputDir = path.isAbsolute(options.output)
        ? options.output
        : path.join(loaded.outputDir, options.output);
      await mkdir(outputDir, { recursive: true });
      const indexPath = path.join(outputDir, 'index.html');
      const html = generateReport(loaded.memory);
      await writeFile(indexPath, html, 'utf-8');
      if (options.reportPath) {
        const extraPath = path.isAbsolute(options.reportPath)
          ? options.reportPath
          : path.join(loaded.outputDir, options.reportPath);
        await writeFile(extraPath, html, 'utf-8');
      }
      spinner.succeed(chalk.green('Report generated'));

      printMnemosBanner('Intelligence report — dashboard-aligned HTML');
      printArtifactLegend();
      printReaderModes();
      printReportPaths(indexPath, outputDir);
      printPrimaryNextSteps();
      printDashboardPreviewNote();

      if (options.open) {
        openInBrowser(indexPath);
      }
    } catch (err) {
      spinner.fail(chalk.red('Report generation failed'));
      console.error(err);
      process.exit(1);
    }
  });

program
  .command('context [path]')
  .description('Build or export the AI context protocol package (.mnemos/)')
  .option('-p, --path <path>', 'Repository path (alias of positional)', '.')
  .option('--no-build', 'Skip rebuild; use existing memory model')
  .action(async (targetPath = '.', options) => {
    const root = path.resolve(options.path && options.path !== '.' ? options.path : targetPath);

    if (options.build !== false) {
      const spinner = ora('Building AI context protocol...').start();
      try {
        await build({ root, verbose: false });
        spinner.succeed(chalk.green('Context protocol ready'));
      } catch (err) {
        spinner.fail(chalk.red('Build failed'));
        console.error(err);
        process.exit(1);
      }
    }

    const loaded = await requireMemoryModel(root);

    const { outputDir } = loaded;
    console.log('');
    console.log(chalk.bold('AI Context Protocol'));
    console.log(`  ${chalk.cyan('project.dna.json')}`);
    console.log(`  ${chalk.cyan('agent_context.json')}`);
    console.log(`  ${chalk.cyan('context/README.md')}       — start here`);
    console.log(`  ${chalk.cyan('context/graphs.md')}       — Mermaid architecture charts`);
    console.log(`  ${chalk.cyan('context/languages.md')}    — language pie + pipeline`);
    console.log(`  ${chalk.cyan('context/architecture.md')}`);
    console.log(`  ${chalk.cyan('context/flows.md')}`);
    console.log(`  ${chalk.cyan('context/critical_paths.md')}`);
    console.log('');
    console.log(`  Path: ${chalk.dim(outputDir)}`);
    console.log(chalk.dim('  Point AI agents at repository.dna.json first.'));
  });

program
  .command('explain [target]')
  .description('Explain repository (path) or a specific node/service (name)')
  .option('-p, --path <path>', 'Repository path', '.')
  .option('--json', 'Output as JSON')
  .action(async (target, options) => {
    const repoRoot = path.resolve(options.path);
    const isRepoTarget =
      !target ||
      target === '.' ||
      (existsSync(path.resolve(target)) && statSync(path.resolve(target)).isDirectory());

    if (isRepoTarget) {
      const root = path.resolve(target && target !== '.' ? target : repoRoot);
      const loaded = await requireMemoryModel(root);

      const result = explainRepository(loaded.memory);
      if (options.json) {
        console.log(JSON.stringify(result, null, 2));
        return;
      }
      console.log(formatExplainReport(result, loaded.memory));
      return;
    }

    const root = repoRoot;
    const loaded = await requireMemoryModel(root);

    const graph = await loadGraphFromMemory(loaded.outputDir);
    const result = explainNode(loaded.memory, target, graph);
    if (options.json) {
      console.log(JSON.stringify(result, null, 2));
      return;
    }
    console.log(formatNodeExplain(result));
  });

program
  .command('dna [path]')
  .description('Show the Repository DNA — viral one-glance summary of any codebase')
  .option('-p, --path <path>', 'Repository path (alias of positional)', '.')
  .option('--json', 'Output as JSON')
  .action(async (targetPath = '.', options) => {
    const root = path.resolve(options.path && options.path !== '.' ? options.path : targetPath);
    const loaded = await requireMemoryModel(root);

    const dna = buildDnaReport(loaded.memory);
    if (options.json) {
      console.log(JSON.stringify(dna, null, 2));
      return;
    }

    console.log('');
    console.log(formatDnaReport(dna));
  });

program
  .command('onboard [path]')
  .description('Generate a new-developer onboarding guide')
  .option('-p, --path <path>', 'Repository path (alias of positional)', '.')
  .option('--json', 'Output as JSON')
  .action(async (targetPath = '.', options) => {
    const root = path.resolve(options.path && options.path !== '.' ? options.path : targetPath);
    const loaded = await requireMemoryModel(root);

    const guide = buildOnboardGuide(loaded.memory);
    if (options.json) {
      console.log(JSON.stringify(guide, null, 2));
      return;
    }

    console.log(formatOnboardGuide(guide));
  });

program
  .command('review <diff>')
  .description('Review a pull request diff against the memory model')
  .option('-p, --path <path>', 'Repository path', '.')
  .option('-f, --file', 'Treat argument as a file path instead of inline diff')
  .option('--json', 'Output as JSON')
  .action(async (diffArg, options) => {
    const root = path.resolve(options.path);
    const loaded = await requireMemoryModel(root);

    let diffContent = diffArg;
    if (options.file) {
      diffContent = await readFile(path.resolve(diffArg), 'utf-8');
    }

    const result = reviewDiff(loaded.memory, diffContent);
    if (options.json) {
      console.log(JSON.stringify(result, null, 2));
      return;
    }

    console.log(formatReviewReport(result));
  });

program
  .command('score [path]')
  .description('Show repository health score')
  .option('-p, --path <path>', 'Repository path (alias of positional)', '.')
  .action(async (targetPath = '.', options) => {
    const root = path.resolve(options.path && options.path !== '.' ? options.path : targetPath);
    const loaded = await requireMemoryModel(root);

    const score = computeMemoryScore(loaded.memory);

    console.log(chalk.bold('\nRepository Health Score\n'));
    const aiReadiness = computeAiReadiness(loaded.memory);
    console.log(`  Overall:           ${chalk.cyan.bold(String(score.overall))}`);
    console.log(`  Architecture:      ${score.architectureClarity}`);
    console.log(`  Maintainability:   ${score.coupling}`);
    console.log(`  Complexity:        ${Math.max(0, 100 - Math.round(loaded.memory.dependencies.length / 20))}`);
    console.log(`  Documentation:     ${score.documentationQuality}`);
    console.log(`  Coupling:          ${score.coupling}`);
    console.log(`  AI Readiness:      ${chalk.cyan(String(aiReadiness.score))}`);
    if (aiReadiness.recommendations.length > 0) {
      console.log('');
      console.log(chalk.bold('Recommendations'));
      for (const r of aiReadiness.recommendations.slice(0, 4)) {
        console.log(`  • ${r}`);
      }
    }
  });

program
  .command('story [path]')
  .description('Generate an architecture narrative from repository data')
  .option('-p, --path <path>', 'Repository path (alias of positional)', '.')
  .option('--json', 'Output as JSON')
  .action(async (targetPath = '.', options) => {
    const root = path.resolve(options.path && options.path !== '.' ? options.path : targetPath);
    const loaded = await requireMemoryModel(root);

    if (options.json) {
      console.log(JSON.stringify(buildArchitectureNarrative(loaded.memory), null, 2));
      return;
    }

    console.log('');
    console.log(formatArchitectureStory(loaded.memory));
  });

program
  .command('snapshot [path]')
  .description('Generate shareable architecture cards (SVG) for README and social media')
  .option('-p, --path <path>', 'Repository path (alias of positional)', '.')
  .option('-o, --output <dir>', 'Output directory', 'snapshots')
  .action(async (targetPath = '.', options) => {
    const root = path.resolve(options.path && options.path !== '.' ? options.path : targetPath);
    const loaded = await requireMemoryModel(root);

    const spinner = ora('Generating shareable snapshots...').start();

    try {
      const result = await generateSnapshots(loaded.memory, loaded.outputDir);
      spinner.succeed(chalk.green('Snapshots generated'));

      console.log('');
      console.log(chalk.bold('Screenshot-Ready Assets'));
      for (const f of result.files) {
        console.log(`  ${chalk.cyan(path.basename(f))}  ${chalk.dim(f)}`);
      }
      console.log('');
      console.log(chalk.dim('  Drag these SVGs into GitHub READMEs, PRs, or social posts.'));
    } catch (err) {
      spinner.fail(chalk.red('Snapshot generation failed'));
      console.error(err);
      process.exit(1);
    }
  });

program
  .command('query <question>')
  .description('Graph-aware architecture query with traversal output')
  .option('-p, --path <path>', 'Repository path', '.')
  .action(async (question, options) => {
    const root = path.resolve(options.path);
    const loaded = await requireMemoryModel(root);

    const graph = await loadGraphFromMemory(loaded.outputDir);
    const result = queryGraph(loaded.memory, question, graph);

    console.log('');
    console.log(chalk.bold('Mnemos Graph Query'));
    console.log(chalk.dim(`Confidence: ${(result.confidence * 100).toFixed(0)}%`));
    console.log('');
    console.log(result.answer);
    if (result.relatedNodes && result.relatedNodes.length > 0) {
      console.log('');
      console.log(chalk.dim(`Related nodes: ${result.relatedNodes.join(', ')}`));
    }
  });

program
  .command('path <from> <to>')
  .description('Find shortest path between two nodes in the knowledge graph')
  .option('-p, --path <path>', 'Repository path', '.')
  .option('--json', 'Output as JSON')
  .action(async (from, to, options) => {
    const root = path.resolve(options.path);
    const loaded = await requireMemoryModel(root);

    const graph = await loadGraphFromMemory(loaded.outputDir);
    if (!graph) {
      console.log(chalk.red('Could not load knowledge graph.'));
      process.exit(1);
    }

    const result = findGraphPath(graph, from, to);
    if (options.json) {
      console.log(JSON.stringify(result, null, 2));
      return;
    }

    console.log('');
    console.log(formatPathResult(result));
  });

program
  .command('ask <question>')
  .description('Architecture copilot — ask questions about the repository')
  .option('-p, --path <path>', 'Repository path', '.')
  .action(async (question, options) => {
    const root = path.resolve(options.path);
    const loaded = await requireMemoryModel(root);

    const [graph, searchIndex] = await Promise.all([
      loadGraphFromMemory(loaded.outputDir),
      loadOrBuildSearchIndex(loaded.memory, loaded.outputDir),
    ]);

    const answer = askCopilot(loaded.memory, question, { graph, searchIndex });
    console.log('');
    console.log(chalk.bold('Mnemos Copilot'));
    console.log(chalk.dim(`Confidence: ${(answer.confidence * 100).toFixed(0)}%${answer.tookMs != null ? ` · ${answer.tookMs}ms` : ''}`));
    console.log('');
    console.log(answer.answer);
    if (answer.relatedTopics.length > 0) {
      console.log('');
      console.log(chalk.dim(`Related: ${answer.relatedTopics.join(', ')}`));
    }
  });

program
  .command('focus <task>')
  .description('Compile a minimal task-scoped context pack for an edit (token-budget aware)')
  .option('-p, --path <path>', 'Repository path', '.')
  .option('--budget <n>', 'Token budget', '8000')
  .option('--json', 'Output JSON only')
  .action(async (task, options) => {
    const root = path.resolve(options.path);
    const runtime = new MnemosRuntime(root);
    try {
      const envelope = await runtime.compileFocus(task, Number(options.budget));
      if (options.json) {
        console.log(JSON.stringify(envelope.data, null, 2));
        return;
      }
      console.log('');
      console.log(chalk.bold('Mnemos Focus Pack'));
      console.log(chalk.dim(envelope.summary));
      console.log('');
      console.log(envelope.markdown);
    } catch (err) {
      console.error(chalk.red(String(err)));
      process.exit(1);
    }
  });

program
  .command('diff [path]')
  .description('Show DNA structural diff since last build (regression guard)')
  .option('-p, --path <path>', 'Repository path', '.')
  .action(async (targetPath = '.', options) => {
    const root = path.resolve(options.path && options.path !== '.' ? options.path : targetPath);
    const runtime = new MnemosRuntime(root);
    try {
      const envelope = await runtime.getDnaDiff();
      console.log('');
      console.log(chalk.bold('Mnemos DNA Diff'));
      if (envelope.data && typeof envelope.data === 'object' && 'regressionRisk' in envelope.data) {
        const risk = String((envelope.data as { regressionRisk: string }).regressionRisk);
        const color = risk === 'high' ? chalk.red : risk === 'medium' ? chalk.yellow : chalk.green;
        console.log(color(`Risk: ${risk}`));
      }
      console.log('');
      console.log(envelope.markdown);
    } catch (err) {
      console.error(chalk.red(String(err)));
      process.exit(1);
    }
  });

program
  .command('hotspots [path]')
  .description('Git churn hotspots mapped to architecture (local git, no API)')
  .option('-p, --path <path>', 'Repository path', '.')
  .option('--limit <n>', 'Max files', '20')
  .action(async (targetPath = '.', options) => {
    const root = path.resolve(options.path && options.path !== '.' ? options.path : targetPath);
    const runtime = new MnemosRuntime(root);
    try {
      const envelope = await runtime.getGitHotspots(Number(options.limit));
      console.log('');
      console.log(envelope.markdown);
    } catch (err) {
      console.error(chalk.red(String(err)));
      process.exit(1);
    }
  });

program
  .command('setup [path]')
  .description('Install AI editor integrations (Cursor, Claude, Codex, Kiro, VS Code, and more)')
  .option('-p, --path <path>', 'Repository path (alias of positional)', '.')
  .option('--platform <name>', `Platform: ${ALL_PLATFORMS.join(', ')}, or all`, 'cursor')
  .option('-f, --force', 'Overwrite existing integration files')
  .option('--uninstall', 'Remove all Mnemos platform integration files')
  .action(async (targetPath = '.', options) => {
    const root = path.resolve(options.path && options.path !== '.' ? options.path : targetPath);

    if (options.uninstall) {
      const result = await uninstallAiIntegrations(root);
      console.log('');
      console.log(chalk.bold('AI integrations removed'));
      for (const f of result.removed) {
        console.log(chalk.green('  ✓ removed') + ' ' + f);
      }
      for (const f of result.skipped) {
        console.log(chalk.dim('  · not found: ') + f);
      }
      return;
    }

    const loaded = await requireMemoryModel(root);

    const platform = options.platform as string;
    if (platform !== 'all' && !ALL_PLATFORMS.includes(platform as (typeof ALL_PLATFORMS)[number])) {
      console.log(chalk.red(`Unknown platform "${platform}". Valid: ${ALL_PLATFORMS.join(', ')}, all`));
      process.exit(1);
    }

    const memoryScore = computeMemoryScore(loaded.memory).overall;
    const exports = buildAgentExports({
      memory: loaded.memory,
      capabilities: loaded.memory.capabilities ?? [],
      journeys: loaded.memory.journeys ?? [],
      memoryScore,
    });
    const toolkit = buildAiToolkit(
      loaded.memory,
      loaded.memory.capabilities ?? [],
      loaded.memory.journeys ?? [],
      exports.context,
    );

    const result = await installAiIntegrations({
      root,
      outputDir: loaded.outputDir,
      toolkit,
      memory: loaded.memory,
      context: exports.context,
      platform: platform as (typeof ALL_PLATFORMS)[number] | 'all',
      force: options.force,
    });

    console.log('');
    console.log(chalk.bold(`AI integrations installed (${platform})`));
    for (const f of result.written) {
      console.log(chalk.green('  ✓') + ' ' + f);
    }
    for (const f of result.skipped) {
      console.log(chalk.dim('  · skipped (exists): ') + f);
    }
    console.log('');
    console.log(chalk.bold('Claude Code'));
    console.log(chalk.cyan('  mnemos setup --platform claude') + chalk.dim('  — skill + CLAUDE.md (recommended)'));
    console.log(chalk.cyan('  mnemos mcp') + chalk.dim('                 — 15 MCP tools for Claude Code'));
    console.log(chalk.cyan('  mnemos wrap -- <cmd>') + chalk.dim('       — compress command output for agents'));
    console.log('');
    console.log(chalk.bold('Platforms'));
    console.log(chalk.dim(`  Available: ${ALL_PLATFORMS.join(', ')}, all`));
    console.log(chalk.dim(`  Uninstall: mnemos setup --uninstall`));
  });

program
  .command('discipline')
  .description('Study Fable 5 agent habits and compare against your local Opus sessions')
  .option('--sample <n>', 'Profile N events from the public Fable dataset (smoke test)')
  .option('--opus', 'Also scan local claude-opus-4-8 sessions and print the delta')
  .option('--guide', 'Print the discipline guide without running Python')
  .action(async (options) => {
    const findScriptsDir = (): string | null => {
      let dir = process.cwd();
      for (let i = 0; i < 10; i++) {
        const script = path.join(dir, 'scripts', 'discipline', 'fable_dataset_delta.py');
        if (existsSync(script)) return path.join(dir, 'scripts', 'discipline');
        const parent = path.dirname(dir);
        if (parent === dir) break;
        dir = parent;
      }
      return null;
    };

    console.log('');
    console.log(chalk.bold('Agent discipline — Fable 5 research kit'));
    console.log(chalk.dim(`Dataset: ${FABLE_DATASET_URL}`));
    console.log('');
    console.log(chalk.bold('Install rules in your repo'));
    console.log(chalk.dim('  npx mnemos . && mnemos setup --platform cursor'));
    console.log(chalk.dim('  Writes .cursor/rules/mnemos-discipline.mdc + fable-mindset.md'));
    console.log('');
    console.log(chalk.bold('Docs'));
    console.log(chalk.dim('  docs/research/fable-5-dataset.md'));
    console.log(chalk.dim('  .mnemos/integrations/fable-mindset.md (after build)'));
    console.log('');

    if (options.guide) return;

    const scriptsDir = findScriptsDir();
    if (!scriptsDir) {
      console.log(chalk.yellow('scripts/discipline/ not found — clone the Mnemos repo to run analysis.'));
      console.log(chalk.dim('  python3 scripts/discipline/fable_dataset_delta.py --sample 400'));
      return;
    }

    const args = [path.join(scriptsDir, 'fable_dataset_delta.py')];
    if (options.sample) args.push('--sample', String(options.sample));
    if (options.opus) args.push('--opus');

    const child = spawn('python3', args, { stdio: 'inherit', shell: process.platform === 'win32' });
    await new Promise<void>((resolve, reject) => {
      child.on('error', reject);
      child.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`exit ${code}`))));
    }).catch((err) => {
      console.error(chalk.red(String(err)));
      console.log(chalk.dim('Requires Python 3 and optionally: pip install datasets pyarrow huggingface_hub'));
      process.exit(1);
    });
  });

program
  .command('prompt [path]')
  .description('Print a copy-paste AI prompt with repository context')
  .option('-p, --path <path>', 'Repository path (alias of positional)', '.')
  .option('--claude', 'Output Claude project instructions instead')
  .action(async (targetPath = '.', options) => {
    const root = path.resolve(options.path && options.path !== '.' ? options.path : targetPath);
    const loaded = await requireMemoryModel(root);

    const memoryScore = computeMemoryScore(loaded.memory).overall;
    const exports = buildAgentExports({
      memory: loaded.memory,
      capabilities: loaded.memory.capabilities ?? [],
      journeys: loaded.memory.journeys ?? [],
      memoryScore,
    });
    const toolkit = buildAiToolkit(
      loaded.memory,
      loaded.memory.capabilities ?? [],
      loaded.memory.journeys ?? [],
      exports.context,
    );

    console.log(options.claude ? toolkit.claudeProjectInstructions : toolkit.aiPrompt);
  });

program
  .command('serve [path]')
  .description('Start the Mnemos memory server for AI agents (localhost:4000)')
  .option('-p, --path <path>', 'Repository path (alias of positional)', '.')
  .option('--port <port>', 'Port number', '4000')
  .option('--host <host>', 'Host', '127.0.0.1')
  .option('--mcp', 'Start MCP stdio server instead of REST API')
  .action(async (targetPath = '.', options) => {
    const root = path.resolve(options.path && options.path !== '.' ? options.path : targetPath);
    const loaded = await requireMemoryModel(root);

    if (options.mcp) {
      console.error(chalk.bold(`Mnemos MCP v${MNEMOS_VERSION} (stdio)`));
      console.error(chalk.dim(`Repository: ${root}`));
      console.error(chalk.dim('Tools: query_graph · get_dna · impact_analysis · shortest_path · search · review_diff'));
      console.error(chalk.dim('Resources: mnemos://repository/dna · summary · domains · flows'));
      await startMcpServer({ root, verbose: true });
      return;
    }

    const handle = await startMemoryServer({
      root,
      port: parseInt(options.port, 10),
      host: options.host,
    });

    console.log(chalk.bold(`\nMnemos Memory Server v${MNEMOS_VERSION}`));
    console.log(chalk.green(`  http://${options.host}:${handle.port}`));
    console.log('');
    console.log('  Core endpoints:');
    console.log(`    GET  /status · /health     — server + memory status`);
    console.log(`    GET  /dna                  — repository DNA (JSON)`);
    console.log(`    GET  /query?q= · /copilot  — graph-aware architecture Q&A`);
    console.log(`    GET  /node/:name           — explain a service or file`);
    console.log(`    GET  /path/:from/:to       — shortest graph path`);
    console.log(`    GET  /impact/:node         — blast radius analysis`);
    console.log(`    GET  /search?q=            — BM25 search`);
    console.log(`    GET  /domains · /flows · /capabilities · /health`);
    console.log(`    POST /review { diff }      — PR diff review`);
    console.log(`    GET  /mcp-setup            — Cursor MCP config instructions`);
    console.log('');
    console.log(chalk.dim('  MCP (Cursor/VS Code):  mnemos mcp'));
    console.log(chalk.dim('  Setup:                 mnemos setup --platform cursor'));
    console.log(chalk.dim('  Press Ctrl+C to stop.\n'));

    await new Promise(() => {});
  });

program
  .command('mcp [path]')
  .description('Start production MCP stdio server for Cursor, VS Code, Claude Desktop')
  .option('-p, --path <path>', 'Repository path (alias of positional)', '.')
  .option('--setup', 'Print MCP config for Cursor and exit')
  .action(async (targetPath = '.', options) => {
    const root = path.resolve(options.path && options.path !== '.' ? options.path : targetPath);

    if (options.setup) {
      console.log(buildMcpSetupMarkdown(root));
      return;
    }

    const loaded = await requireMemoryModel(root);

    console.error(chalk.bold(`Mnemos MCP v${MNEMOS_VERSION}`));
    console.error(chalk.dim(`Repository: ${loaded.memory.repository}`));
    console.error(chalk.dim(`${loaded.memory.stats.nodesCreated} nodes · ${loaded.memory.domains.length} domains · ${loaded.memory.flows.length} flows`));
    console.error(chalk.dim('Run `mnemos mcp --setup` to print MCP client config'));
    await startMcpServer({ root });
  });

const exportCmd = program
  .command('export')
  .description('Export knowledge graph in various formats');

exportCmd
  .command('svg [path]')
  .description('Export knowledge graph as static SVG')
  .option('-p, --path <path>', 'Repository path', '.')
  .option('-o, --output <dir>', 'Output directory')
  .action(async (targetPath = '.', options) => {
    await runExportCommand('svg', targetPath, options);
  });

exportCmd
  .command('graphml [path]')
  .description('Export knowledge graph as GraphML (Gephi/yEd)')
  .option('-p, --path <path>', 'Repository path', '.')
  .option('-o, --output <dir>', 'Output directory')
  .action(async (targetPath = '.', options) => {
    await runExportCommand('graphml', targetPath, options);
  });

exportCmd
  .command('callflow [path]')
  .description('Generate Mermaid call-flow architecture HTML')
  .option('-p, --path <path>', 'Repository path', '.')
  .option('-o, --output <dir>', 'Output directory')
  .action(async (targetPath = '.', options) => {
    await runExportCommand('callflow', targetPath, options);
  });

exportCmd
  .command('wiki [path]')
  .description('Export crawlable markdown wiki pages per domain/service')
  .option('-p, --path <path>', 'Repository path', '.')
  .option('-o, --output <dir>', 'Output directory')
  .action(async (targetPath = '.', options) => {
    await runExportCommand('wiki', targetPath, options);
  });

program
  .command('pack [path]')
  .description('Print the AI Pack v1 (JSON) for the repository — designed for Claude, Cursor, Trae')
  .option('-p, --path <path>', 'Repository path', '.')
  .option('--section <section>', 'Limit to: all|summary|score|issues|graph|flows|smells|dna', 'all')
  .option('--mode <mode>', 'Lens: vibe|ai|coder', 'coder')
  .option('--repo-id <id>', 'Override the repository id used in the pack')
  .option('-o, --output <file>', 'Write to file instead of stdout')
  .option('--pretty', 'Pretty-print JSON (default on)', true)
  .action(async (targetPath = '.', options) => {
    const root = path.resolve(options.path ?? targetPath);
    const loaded = await loadMemoryModel(root);
    if (!loaded) {
      console.error(chalk.red('✗ No Mnemos memory model found.'));
      console.error(chalk.dim('  Run `mnemos build` first.'));
      process.exit(1);
    }
    const section = String(options.section ?? 'all') as AiPackSection;
    const mode = String(options.mode ?? 'coder') as AiPackMode;
    const graph = await loadGraphFromMemory(loaded.outputDir);
    const dna = await readFile(path.join(loaded.outputDir, 'project.dna.json'), 'utf-8')
      .then((raw) => JSON.parse(raw) as Record<string, unknown>)
      .catch(() => null);
    const pack = buildAiPack(loaded.memory, {
      mode,
      section,
      repoId: options.repoId,
      root,
      dna,
      graph: graph
        ? {
            nodes: graph
              .mapNodes((id, attrs) => ({ id, kind: attrs.kind, name: attrs.name, path: attrs.path }))
              .map((n) => ({ id: String(n.id), kind: String(n.kind), name: String(n.name), path: n.path as string | undefined })),
            edges: graph
              .mapEdges((id, attrs, source, target) => ({ id, source, target, kind: attrs.kind }))
              .map((e) => ({
                id: String(e.id),
                source: String(e.source),
                target: String(e.target),
                kind: String(e.kind),
              })),
          }
        : null,
    });
    const json = options.pretty === false ? JSON.stringify(pack) : aiPackToJson(pack);
    if (options.output) {
      const file = path.resolve(options.output);
      await mkdir(path.dirname(file), { recursive: true });
      await writeFile(file, json, 'utf-8');
      console.log(chalk.green('✓') + ' AI Pack v1 written to ' + chalk.cyan(file));
      console.log(chalk.dim(`  Section: ${section} · Mode: ${mode} · Bytes: ${json.length}`));
    } else {
      process.stdout.write(json + '\n');
    }
  });

async function runExportCommand(
  format: 'svg' | 'graphml' | 'callflow' | 'wiki',
  targetPath: string,
  options: { path?: string; output?: string },
): Promise<void> {
  const root = path.resolve(options.path && options.path !== '.' ? options.path : targetPath);
  const loaded = await requireMemoryModel(root);

  const outputDir = options.output
    ? path.isAbsolute(options.output)
      ? options.output
      : path.join(root, options.output)
    : loaded.outputDir;

  const spinner = ora(`Exporting ${format}...`).start();

  try {
    const graph =
      format === 'svg' || format === 'graphml'
        ? await loadGraphFromMemory(loaded.outputDir)
        : undefined;
    const result = await runExport(format, loaded.memory, outputDir, graph);
    spinner.succeed(chalk.green(`${format} export complete`));
    console.log(`  Output: ${chalk.cyan(Array.isArray(result) ? result.join(', ') : result)}`);
  } catch (err) {
    spinner.fail(chalk.red('Export failed'));
    console.error(err);
    process.exit(1);
  }
}

const hookCmd = program.command('hook').description('Git hooks for auto-rebuild');

hookCmd
  .command('install [path]')
  .description('Install post-commit and post-checkout hooks')
  .action(async (targetPath = '.') => {
    const root = path.resolve(targetPath);
    const result = await installHooks(root);
    console.log('');
    console.log(chalk.bold('Git hooks'));
    for (const h of result.installed) {
      console.log(chalk.green('  ✓') + ' ' + h);
    }
    for (const e of result.errors) {
      console.log(chalk.red('  ✗') + ' ' + e);
    }
  });

hookCmd
  .command('uninstall [path]')
  .description('Remove Mnemos git hooks')
  .action(async (targetPath = '.') => {
    const root = path.resolve(targetPath);
    const result = await uninstallHooks(root);
    console.log('');
    console.log(chalk.bold('Git hooks removed'));
    for (const h of result.removed) {
      console.log(chalk.green('  ✓') + ' ' + h);
    }
  });

hookCmd
  .command('status [path]')
  .description('Show git hook installation state')
  .action(async (targetPath = '.') => {
    const root = path.resolve(targetPath);
    const status = getHookStatus(root);
    console.log('');
    console.log(chalk.bold('Git hook status'));
    console.log(`  Git dir:      ${status.gitDir || chalk.dim('not found')}`);
    console.log(`  Installed:    ${status.installed ? chalk.green('yes') : chalk.dim('no')}`);
    console.log(`  post-commit:  ${status.postCommit ? chalk.green('yes') : 'no'}`);
    console.log(`  post-checkout:${status.postCheckout ? chalk.green(' yes') : ' no'}`);
  });

program
  .command('export-agents [path]')
  .description('Export machine-optimized JSON for AI agents (legacy agents/ folder)')
  .option('-p, --path <path>', 'Repository path (alias of positional)', '.')
  .option('-o, --output <dir>', 'Output directory', 'agents')
  .action(async (targetPath = '.', options) => {
    const root = path.resolve(options.path && options.path !== '.' ? options.path : targetPath);
    const loaded = await requireMemoryModel(root);

    const spinner = ora('Exporting agent artifacts...').start();

    try {
      const outputDir = path.isAbsolute(options.output)
        ? options.output
        : path.join(loaded.outputDir, options.output);
      await mkdir(outputDir, { recursive: true });

      const memoryScore = computeMemoryScore(loaded.memory).overall;
      const exports = buildAgentExports({
        memory: loaded.memory,
        capabilities: loaded.memory.capabilities ?? [],
        journeys: loaded.memory.journeys ?? [],
        memoryScore,
      });

      await writeFile(path.join(outputDir, 'project.dna.json'), JSON.stringify(exports.dna, null, 2), 'utf-8');
      await writeFile(path.join(outputDir, 'agent_context.json'), JSON.stringify(exports.context, null, 2), 'utf-8');
      await writeFile(path.join(outputDir, 'architecture.json'), JSON.stringify(exports.architecture, null, 2), 'utf-8');
      await writeFile(path.join(outputDir, 'repository_summary.json'), JSON.stringify(exports.summary, null, 2), 'utf-8');
      await writeFile(path.join(outputDir, 'critical_paths.json'), JSON.stringify(exports.criticalPaths, null, 2), 'utf-8');

      spinner.succeed(chalk.green('Agent artifacts exported'));
      console.log(`  Folder: ${chalk.dim(outputDir)}`);
      console.log(chalk.dim('  Note: `npx mnemos .` writes project.dna.json to .mnemos/ directly.'));
    } catch (err) {
      spinner.fail(chalk.red('Export failed'));
      console.error(err);
      process.exit(1);
    }
  });

program
  .command('ui')
  .description('Launch the Mnemos visualization UI')
  .option('-p, --path <path>', 'Repository path', '.')
  .option('-w, --workspace <file>', 'Multi-repo workspace config (e.g. dabt.workspace.json)')
  .option('--port <port>', 'Port number', '5173')
  .action(async (options) => {
    const root = path.resolve(options.path);
    const uiDir = path.join(import.meta.dirname, '..', '..', 'ui');
    const workspaceFile = options.workspace
      ? path.resolve(options.workspace)
      : path.join(uiDir, 'dabt.workspace.json');

    console.log(chalk.bold('Starting Mnemos UI (preview)...'));
    if (options.workspace || existsSync(workspaceFile)) {
      console.log(chalk.dim(`Workspace mode: ${workspaceFile}`));
    } else {
      console.log(chalk.dim(`Serving memory from: ${path.join(root, '.mnemos')}`));
    }
    printDashboardPreviewNote();
    console.log(chalk.dim(`  Stable surfaces: mnemos report --open · mnemos pack · mnemos serve`));

    const env: Record<string, string> = { ...process.env as Record<string, string> };
    if (options.workspace || existsSync(workspaceFile)) {
      env.MNEMOS_WORKSPACE = workspaceFile;
    } else {
      env.MNEMOS_ROOT = root;
    }

    const child = spawn('npx', ['vite', '--port', options.port, '--host'], {
      cwd: uiDir,
      stdio: 'inherit',
      shell: true,
      env,
    });

    child.on('error', (err) => {
      console.error(chalk.red('Failed to start UI:'), err.message);
      process.exit(1);
    });
  });

async function runDefaultExperience(
  targetPath: string,
  options: { open?: boolean; verbose?: boolean },
): Promise<void> {
  const root = path.resolve(targetPath);
  const outputDir = path.join(root, '.mnemos');

  printMnemosBanner('Analyze · report · AI Pack v1');

  const spinner = ora(`  Analyzing ${root}`).start();

  let result;
  try {
    result = await build({ root, outputDir, verbose: options.verbose });
    spinner.stop();
  } catch (err) {
    spinner.fail(chalk.red('Analysis failed'));
    console.error(err);
    process.exit(1);
  }

  const { memory } = result;
  const score = computeMemoryScore(memory);
  const ai = computeAiReadiness(memory);
  const dna = buildDnaReport(memory);

  // Check marks — the iconic 30-second onboarding
  printCheck(`${memory.stats.filesScanned.toLocaleString()} files analyzed`);
  printCheck(`${memory.domains.length} domains discovered`);
  printCheck(`${memory.flows.length} flows discovered`);
  printCheck(`${memory.apis.length} APIs discovered`);
  printCheck('Repository DNA generated');
  printCheck('AI integrations ready (Cursor + Claude)');
  printCheck('Screenshot-ready SVG cards rendered');

  // Generate the polished report and snapshots
  const reportDir = path.join(outputDir, 'report');
  await mkdir(reportDir, { recursive: true });
  const indexPath = path.join(reportDir, 'index.html');
  await writeFile(indexPath, generateReport(memory), 'utf-8');

  // Generate shareable SVG cards (Architecture, Journey, AI Context)
  const snapResult = await generateSnapshots(memory, outputDir);

  // 30-second wow summary
  printSection('Repository snapshot');
  printMetricRow('Domains', dna.metrics.domains);
  printMetricRow('Flows', dna.metrics.flows);
  printMetricRow('APIs', dna.metrics.apis);
  printMetricRow('Capabilities', dna.metrics.capabilities);
  printMetricRow('Critical domain', dna.mostCriticalDomain);
  printMetricRow('Highest risk', dna.highestRiskDomain, 'domain');

  printSection('Artifacts');
  printKeyValueTable([
    { key: 'report/index.html', value: 'stable', hint: indexPath },
    { key: 'project.dna.json', value: path.join(outputDir, 'project.dna.json') },
    { key: 'snapshots/*.svg', value: snapResult.outputDir },
    { key: 'Health / AI ready', value: `${score.overall}/100 · ${ai.score}/100` },
  ]);

  printArtifactLegend();
  printReaderModes();
  printPrimaryNextSteps();
  printDashboardPreviewNote();

  if (options.open !== false) {
    printInfoLine('Opening report in browser…');
    openInBrowser(indexPath);
  }
}

program
  .command('sync [path]')
  .description('Keep the knowledge graph in sync on file changes (codegraph-style)')
  .option('-o, --output <dir>', 'Output directory', '.mnemos')
  .option('-v, --verbose', 'Show detailed progress')
  .option('--no-incremental', 'Force full rebuild on each change')
  .action(async (targetPath = '.', options) => {
    const root = path.resolve(targetPath);
    const outputDir = path.join(root, options.output);

    printMnemosBanner('Graph sync — local index, auto-rebuild');
    printInfoLine(`Watching ${root}`);
    printInfoLine('Press Ctrl+C to stop');

    const handle = await startGraphSync({
      root,
      outputDir,
      incremental: options.incremental !== false,
      verbose: options.verbose,
      onStart: () => {
        const t = new Date().toLocaleTimeString();
        console.log(chalk.dim(`\n  [${t}] Rebuilding graph…`));
      },
      onSuccess: (result) => {
        const { stats } = result.memory;
        printSuccessLine(
          `${stats.filesScanned.toLocaleString()} files · ${stats.domainsFound} domains · ${stats.flowsFound} flows · ${(stats.durationMs / 1000).toFixed(1)}s`,
        );
      },
      onError: (err) => {
        console.error(chalk.red('  ✗ Sync rebuild failed:'), err);
      },
    });

    process.on('SIGINT', () => {
      handle.stop();
      console.log(chalk.dim('\n  Sync stopped.'));
      process.exit(0);
    });
  });

program
  .command('wrap')
  .description('Run a shell command and emit token-compressed output for AI agents (rtk-style)')
  .option('-o, --output <file>', 'Write compressed output to file')
  .option('--max-lines <n>', 'Max lines to keep', '120')
  .allowUnknownOption()
  .action(async (options) => {
    const sep = process.argv.indexOf('--');
    const args = sep >= 0 ? process.argv.slice(sep + 1) : [];
    if (args.length === 0) {
      console.error(chalk.red('Usage: mnemos wrap -- <command...>'));
      console.error(chalk.dim('Example: mnemos wrap -- git status'));
      process.exit(1);
    }

    printMnemosBanner('Wrap — token-efficient command proxy');

    const child = spawn(args[0]!, args.slice(1), {
      shell: process.platform === 'win32',
      stdio: ['inherit', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';
    child.stdout?.on('data', (chunk: Buffer) => {
      const text = chunk.toString();
      stdout += text;
      process.stdout.write(text);
    });
    child.stderr?.on('data', (chunk: Buffer) => {
      const text = chunk.toString();
      stderr += text;
      process.stderr.write(text);
    });

    const code: number = await new Promise((resolve) => {
      child.on('close', resolve);
    });

    const combined = [stdout, stderr].filter(Boolean).join('\n');
    const { text, stats } = compressCommandOutput(combined, {
      maxLines: Number(options.maxLines) || 120,
    });

    printCompressStats(stats);

    const outPath =
      options.output ??
      path.join(process.cwd(), '.mnemos', 'wrap-last.txt');
    await mkdir(path.dirname(outPath), { recursive: true });
    await writeFile(outPath, text, 'utf-8');
    printSuccessLine(`Compressed output → ${outPath}`);
    printInfoLine('Feed this file to Claude/Cursor instead of raw terminal noise');

    process.exit(code ?? 1);
  });

program
  .command('doctor [path]')
  .description('Check that the environment is ready to run Mnemos (no Python required)')
  .option('-p, --path <path>', 'Repository path (alias of positional)', '.')
  .action(async (targetPath = '.', options) => {
    const root = path.resolve(options.path && options.path !== '.' ? options.path : targetPath);

    printMnemosBanner('Doctor — environment readiness check');

    const nodeMajor = Number(process.versions.node.split('.')[0]);
    const nodeOk = nodeMajor >= 18;

    printSection('Runtime');
    console.log(
      `  ${nodeOk ? chalk.green('✓') : chalk.red('✗')} Node.js ${process.versions.node}` +
        chalk.dim(nodeOk ? '' : '  (Mnemos needs Node 18+)'),
    );
    printSuccessLine(`Mnemos v${MNEMOS_VERSION}`);
    printSuccessLine('Analysis engine is pure TypeScript — no Python, JVM, or other runtime needed.');

    printSection('Repository');
    const loaded = await loadMemoryModel(root);
    if (loaded) {
      printSuccessLine(`Memory model found  ${chalk.dim(loaded.outputDir)}`);
      printMetricRow('Files scanned', loaded.memory.stats.filesScanned.toLocaleString());
      printMetricRow('Domains', loaded.memory.domains.length);
      printMetricRow('Flows', loaded.memory.flows.length);
    } else {
      printWarnLine('No memory model built yet.');
      printInfoLine(`Run ${chalk.cyan('mnemos build .')} to create one.`);
    }

    printSection('Optional');
    console.log(
      `  ${chalk.dim('·')} Python is ${chalk.bold('not')} required for analysis. ` +
        chalk.dim('It is only used by the optional `mnemos discipline` research kit.'),
    );

    if (!nodeOk) process.exit(1);
  });

program
  .argument('[path]', 'Repository path', '.')
  .option('--no-open', 'Do not open browser after analysis')
  .option('-v, --verbose', 'Show detailed progress')
  .action(async (targetPath, options) => {
    await runDefaultExperience(targetPath, options);
  });

program.parseAsync();
