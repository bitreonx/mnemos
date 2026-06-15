#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
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
  fromSerializable,
} from '@mnemos/core';

const program = new Command();

function openInBrowser(filePath: string): void {
  try {
    const opener =
      process.platform === 'win32'
        ? `start "" "${filePath}"`
        : process.platform === 'darwin'
          ? `open "${filePath}"`
          : `xdg-open "${filePath}"`;
    spawn(opener, { shell: true, stdio: 'ignore', detached: true });
  } catch {
    /* ignore */
  }
}

function printCheck(label: string): void {
  console.log(chalk.green('✓') + ' ' + label);
}

program
  .name('mnemos')
  .description('The memory layer for software')
  .version('0.1.0');

program
  .command('build [path]')
  .description('Build a complete mental model of a repository')
  .option('-v, --verbose', 'Show detailed progress')
  .option('-o, --output <dir>', 'Output directory', '.mnemos')
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

async function runBuildOnce(root: string, outputDir: string, options: { verbose?: boolean }) {
  const spinner = ora(`Building memory model for ${root}`).start();
  try {
    const result = await build({
      root,
      outputDir,
      verbose: options.verbose,
    });
    spinner.succeed(chalk.green('Memory model built successfully'));

    const { stats } = result.memory;
    console.log('');
    console.log(chalk.bold('Results'));
    console.log(`  Files scanned:  ${chalk.cyan(stats.filesScanned.toLocaleString())}`);
    console.log(`  Graph nodes:    ${chalk.cyan(stats.nodesCreated.toLocaleString())}`);
    console.log(`  Graph edges:    ${chalk.cyan(stats.edgesCreated.toLocaleString())}`);
    console.log(`  Domains:        ${chalk.cyan(stats.domainsFound)}`);
    console.log(`  Flows:          ${chalk.cyan(stats.flowsFound)}`);
    console.log(`  Duration:       ${chalk.cyan((stats.durationMs / 1000).toFixed(1) + 's')}`);
    console.log('');
    console.log(`  Output: ${chalk.dim(outputDir)}`);
    console.log(`  DNA:    ${chalk.dim(path.join(outputDir, 'project.dna.json'))}`);
    console.log(`  Context: ${chalk.dim(path.join(outputDir, 'context'))}`);
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
    const loaded = await loadMemoryModel(root);

    if (!loaded) {
      console.log(chalk.yellow('No memory model found. Run `mnemos build .` first.'));
      process.exit(1);
    }

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
    const loaded = await loadMemoryModel(root);

    if (!loaded) {
      console.log(chalk.yellow('No memory model found. Run `mnemos build .` first.'));
      process.exit(1);
    }

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
    const loaded = await loadMemoryModel(root);

    if (!loaded) {
      console.log(chalk.yellow('No memory model found. Run `mnemos build .` first.'));
      process.exit(1);
    }

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
    const loaded = await loadMemoryModel(root);

    if (!loaded) {
      console.log(chalk.yellow('No memory model found. Run `mnemos build .` first.'));
      process.exit(1);
    }

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
  .option('--open', 'Open the report in the default browser after generation', false)
  .action(async (targetPath = '.', options) => {
    const root = path.resolve(options.path && options.path !== '.' ? options.path : targetPath);
    const loaded = await loadMemoryModel(root);

    if (!loaded) {
      console.log(chalk.yellow('No memory model found. Run `mnemos build .` first.'));
      process.exit(1);
    }

    const spinner = ora('Generating intelligence report...').start();

    try {
      const outputDir = path.isAbsolute(options.output)
        ? options.output
        : path.join(loaded.outputDir, options.output);
      await mkdir(outputDir, { recursive: true });
      const indexPath = path.join(outputDir, 'index.html');
      const html = generateReport(loaded.memory);
      await writeFile(indexPath, html, 'utf-8');
      spinner.succeed(chalk.green('Report generated'));

      console.log('');
      console.log(chalk.bold('Intelligence Report'));
      console.log(`  Mode A (Vibe):      ${chalk.cyan('human-readable narrative')}`);
      console.log(`  Mode B (Developer): ${chalk.cyan('dense technical breakdown')}`);
      console.log(`  Toggle in the top-right of the page.`);
      console.log('');
      console.log(`  Open:   ${chalk.cyan(`file:///${indexPath.replace(/\\/g, '/')}`)}`);
      console.log(`  Folder: ${chalk.dim(outputDir)}`);

      if (options.open) {
        try {
          const opener =
            process.platform === 'win32'
              ? `start "" "${indexPath}"`
              : process.platform === 'darwin'
                ? `open "${indexPath}"`
                : `xdg-open "${indexPath}"`;
          spawn(opener, { shell: true, stdio: 'ignore', detached: true });
        } catch {
          /* ignore open failures */
        }
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

    const loaded = await loadMemoryModel(root);
    if (!loaded) {
      console.log(chalk.yellow('No memory model found.'));
      process.exit(1);
    }

    const { outputDir } = loaded;
    console.log('');
    console.log(chalk.bold('AI Context Protocol'));
    console.log(`  ${chalk.cyan('repository.dna.json')}`);
    console.log(`  ${chalk.cyan('context/architecture.md')}`);
    console.log(`  ${chalk.cyan('context/flows.md')}`);
    console.log(`  ${chalk.cyan('context/critical_paths.md')}`);
    console.log(`  ${chalk.cyan('agent-context.json')}`);
    console.log('');
    console.log(`  Path: ${chalk.dim(outputDir)}`);
    console.log(chalk.dim('  Point AI agents at repository.dna.json first.'));
  });

program
  .command('explain [path]')
  .description('Explain what this repository does in plain language')
  .option('-p, --path <path>', 'Repository path (alias of positional)', '.')
  .option('--json', 'Output as JSON')
  .action(async (targetPath = '.', options) => {
    const root = path.resolve(options.path && options.path !== '.' ? options.path : targetPath);
    const loaded = await loadMemoryModel(root);

    if (!loaded) {
      console.log(chalk.yellow('No memory model found. Run `mnemos build .` first.'));
      process.exit(1);
    }

    const result = explainRepository(loaded.memory);
    if (options.json) {
      console.log(JSON.stringify(result, null, 2));
      return;
    }

    console.log(formatExplainReport(result, loaded.memory));
  });

program
  .command('dna [path]')
  .description('Show the Repository DNA — viral one-glance summary of any codebase')
  .option('-p, --path <path>', 'Repository path (alias of positional)', '.')
  .option('--json', 'Output as JSON')
  .action(async (targetPath = '.', options) => {
    const root = path.resolve(options.path && options.path !== '.' ? options.path : targetPath);
    const loaded = await loadMemoryModel(root);

    if (!loaded) {
      console.log(chalk.yellow('No memory model found. Run `npx mnemos .` first.'));
      process.exit(1);
    }

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
    const loaded = await loadMemoryModel(root);

    if (!loaded) {
      console.log(chalk.yellow('No memory model found. Run `mnemos build .` first.'));
      process.exit(1);
    }

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
    const loaded = await loadMemoryModel(root);

    if (!loaded) {
      console.log(chalk.yellow('No memory model found. Run `mnemos build .` first.'));
      process.exit(1);
    }

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
    const loaded = await loadMemoryModel(root);

    if (!loaded) {
      console.log(chalk.yellow('No memory model found. Run `mnemos build .` first.'));
      process.exit(1);
    }

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
    const loaded = await loadMemoryModel(root);

    if (!loaded) {
      console.log(chalk.yellow('No memory model found. Run `npx mnemos .` first.'));
      process.exit(1);
    }

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
    const loaded = await loadMemoryModel(root);

    if (!loaded) {
      console.log(chalk.yellow('No memory model found. Run `npx mnemos .` first.'));
      process.exit(1);
    }

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
  .command('ask <question>')
  .description('Architecture copilot — ask questions about the repository')
  .option('-p, --path <path>', 'Repository path', '.')
  .action(async (question, options) => {
    const root = path.resolve(options.path);
    const loaded = await loadMemoryModel(root);

    if (!loaded) {
      console.log(chalk.yellow('No memory model found. Run `mnemos build .` first.'));
      process.exit(1);
    }

    const { readFile } = await import('node:fs/promises');
    let graph;
    try {
      const raw = await readFile(path.join(loaded.outputDir, 'graph.json'), 'utf-8');
      graph = fromSerializable(JSON.parse(raw));
    } catch {
      graph = undefined;
    }

    const answer = askCopilot(loaded.memory, question, { graph });
    console.log('');
    console.log(chalk.bold('Mnemos Copilot'));
    console.log(chalk.dim(`Confidence: ${(answer.confidence * 100).toFixed(0)}%`));
    console.log('');
    console.log(answer.answer);
    if (answer.relatedTopics.length > 0) {
      console.log('');
      console.log(chalk.dim(`Related: ${answer.relatedTopics.join(', ')}`));
    }
  });

program
  .command('setup [path]')
  .description('Install AGENTS.md and Cursor rules for Claude/Cursor/Codex')
  .option('-p, --path <path>', 'Repository path (alias of positional)', '.')
  .option('-f, --force', 'Overwrite existing integration files')
  .action(async (targetPath = '.', options) => {
    const root = path.resolve(options.path && options.path !== '.' ? options.path : targetPath);
    const loaded = await loadMemoryModel(root);

    if (!loaded) {
      console.log(chalk.yellow('No memory model found. Run `npx mnemos .` first.'));
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
      force: options.force,
    });

    console.log('');
    console.log(chalk.bold('AI integrations installed'));
    for (const f of result.written) {
      console.log(chalk.green('  ✓') + ' ' + f);
    }
    for (const f of result.skipped) {
      console.log(chalk.dim('  · skipped (exists): ') + f);
    }
    console.log('');
    console.log(chalk.bold('Next steps'));
    console.log('  1. In Cursor: rules auto-load from .cursor/rules/mnemos-architecture.mdc');
    console.log('  2. In Claude: add .mnemos/project.dna.json to project knowledge');
    console.log('  3. Run ' + chalk.cyan('mnemos serve') + ' for live agent queries at :4000');
    console.log('  4. Copy a starter prompt: ' + chalk.cyan('mnemos prompt'));
    console.log('');
  });

program
  .command('prompt [path]')
  .description('Print a copy-paste AI prompt with repository context')
  .option('-p, --path <path>', 'Repository path (alias of positional)', '.')
  .option('--claude', 'Output Claude project instructions instead')
  .action(async (targetPath = '.', options) => {
    const root = path.resolve(options.path && options.path !== '.' ? options.path : targetPath);
    const loaded = await loadMemoryModel(root);

    if (!loaded) {
      console.log(chalk.yellow('No memory model found. Run `npx mnemos .` first.'));
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

    console.log(options.claude ? toolkit.claudeProjectInstructions : toolkit.aiPrompt);
  });

program
  .command('serve [path]')
  .description('Start the Mnemos memory server for AI agents (localhost:4000)')
  .option('-p, --path <path>', 'Repository path (alias of positional)', '.')
  .option('--port <port>', 'Port number', '4000')
  .option('--host <host>', 'Host', '127.0.0.1')
  .action(async (targetPath = '.', options) => {
    const root = path.resolve(options.path && options.path !== '.' ? options.path : targetPath);
    const loaded = await loadMemoryModel(root);

    if (!loaded) {
      console.log(chalk.yellow('No memory model found. Run `mnemos build .` first.'));
      process.exit(1);
    }

    const handle = await startMemoryServer({
      root,
      port: parseInt(options.port, 10),
      host: options.host,
    });

    console.log(chalk.bold('\nMnemos Memory Server'));
    console.log(chalk.green(`  http://${options.host}:${handle.port}`));
    console.log('');
    console.log('  Endpoints:');
    console.log(`    GET  /dna          — repository DNA`);
    console.log(`    GET  /explain       — human summary`);
    console.log(`    GET  /copilot?q=    — ask questions`);
    console.log(`    GET  /prompts       — vibe-coder starter prompts`);
    console.log(`    GET  /impact/:node  — blast radius`);
    console.log(`    GET  /search?q=     — search domains/services`);
    console.log(`    GET  /heatmap       — technical debt heatmap`);
    console.log(`    POST /review        — PR diff review`);
    console.log('');
    console.log(chalk.dim('  Connect Cursor, Claude, or Codex to query Mnemos instead of reading files.'));
    console.log(chalk.dim('  Press Ctrl+C to stop.\n'));

    await new Promise(() => {});
  });

program
  .command('export-agents [path]')
  .description('Export machine-optimized JSON for AI agents (legacy agents/ folder)')
  .option('-p, --path <path>', 'Repository path (alias of positional)', '.')
  .option('-o, --output <dir>', 'Output directory', 'agents')
  .action(async (targetPath = '.', options) => {
    const root = path.resolve(options.path && options.path !== '.' ? options.path : targetPath);
    const loaded = await loadMemoryModel(root);

    if (!loaded) {
      console.log(chalk.yellow('No memory model found. Run `mnemos build .` first.'));
      process.exit(1);
    }

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

    console.log(chalk.bold('Starting Mnemos UI...'));
    if (options.workspace || existsSync(workspaceFile)) {
      console.log(chalk.dim(`Workspace mode: ${workspaceFile}`));
    } else {
      console.log(chalk.dim(`Serving memory from: ${path.join(root, '.mnemos')}`));
    }

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

  console.log('');
  const spinner = ora(`Analyzing ${root}`).start();

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
  console.log('');
  console.log(chalk.bold('  This repository contains'));
  console.log('');
  console.log(`    ${chalk.cyan.bold(String(dna.metrics.domains))} ${chalk.dim('domains')}`);
  console.log(`    ${chalk.cyan.bold(String(dna.metrics.flows))} ${chalk.dim('flows')}`);
  console.log(`    ${chalk.cyan.bold(String(dna.metrics.apis))} ${chalk.dim('APIs')}`);
  console.log(`    ${chalk.cyan.bold(String(dna.metrics.capabilities))} ${chalk.dim('capabilities')}`);
  console.log('');
  console.log(chalk.bold('  Most critical domain:'));
  console.log(`    ${chalk.cyan(dna.mostCriticalDomain)}`);
  console.log('');
  console.log(chalk.bold('  Highest risk domain:'));
  console.log(`    ${chalk.yellow(dna.highestRiskDomain)}`);
  console.log('');

  console.log(chalk.bold('Artifacts'));
  console.log(`  ${chalk.cyan('project.dna.json')}    ${chalk.dim(path.join(outputDir, 'project.dna.json'))}`);
  console.log(`  ${chalk.cyan('integrations/')}       ${chalk.dim(path.join(outputDir, 'integrations'))}`);
  console.log(`  ${chalk.cyan('report/index.html')}  ${chalk.dim(indexPath)}`);
  console.log(`  ${chalk.cyan('snapshots/*.svg')}    ${chalk.dim(snapResult.outputDir)}`);
  console.log('');

  console.log(chalk.bold('For Cursor / Claude / vibe-coders'));
  console.log(`  ${chalk.cyan('mnemos setup')}       ${chalk.dim('— install AGENTS.md + Cursor rules')}`);
  console.log(`  ${chalk.cyan('mnemos prompt')}      ${chalk.dim('— copy-paste starter prompt')}`);
  console.log(`  ${chalk.cyan('mnemos serve')}       ${chalk.dim('— live memory server for agents')}`);
  console.log('');

  if (options.open !== false) {
    console.log(chalk.dim('Opening browser...'));
    openInBrowser(indexPath);
  }

  console.log('');
  console.log(chalk.dim('Try:'));
  console.log(chalk.cyan('  mnemos dna') + chalk.dim('        — viral one-glance summary'));
  console.log(chalk.cyan('  mnemos explain') + chalk.dim('    — plain-language description'));
  console.log(chalk.cyan('  mnemos story') + chalk.dim('      — architecture narrative'));
  console.log(chalk.cyan('  mnemos snapshot') + chalk.dim('  — screenshot-ready SVG cards'));
  console.log(chalk.cyan('  mnemos setup') + chalk.dim('      — Cursor rules + AGENTS.md'));
  console.log(chalk.cyan('  mnemos prompt') + chalk.dim('     — copy-paste AI prompt'));
  console.log(chalk.cyan('  mnemos serve') + chalk.dim('     — memory server for AI agents'));
  console.log('');
}

program
  .argument('[path]', 'Repository path', '.')
  .option('--no-open', 'Do not open browser after analysis')
  .option('-v, --verbose', 'Show detailed progress')
  .action(async (targetPath, options) => {
    await runDefaultExperience(targetPath, options);
  });

program.parse();
