import chalk from 'chalk';

/** Mnestis CLI color tokens — keep in sync with report + dashboard accents. */
export const COLORS = {
  vibe: '#863bff',
  ai: '#47bfff',
  coder: '#6b1ad6',
  accent: '#863bff',
} as const;

export function printCheck(label: string): void {
  console.log(chalk.green('✓') + ' ' + label);
}

/** Three-artifact legend shown after build/report/default flows. */
export function printArtifactLegend(): void {
  console.log('');
  console.log(chalk.bold('Three artifacts — one build'));
  console.log(`  ${chalk.hex(COLORS.vibe)('Report')}     ${chalk.dim('shareable HTML — production-ready, works offline')}`);
  console.log(`  ${chalk.hex(COLORS.ai)('AI JSON')}     ${chalk.dim('AI Pack v1 — copy or HTTP for Claude, Cursor, Trae')}`);
  console.log(`  ${chalk.hex(COLORS.coder)('Dashboard')} ${chalk.dim('interactive preview — early access, community-driven')}`);
}

export function printReaderModes(): void {
  console.log('');
  console.log(chalk.bold('Report reader modes'));
  console.log(`  ${chalk.hex(COLORS.vibe)('Vibe')}   ${chalk.cyan('product story — journeys, capabilities, health at a glance')}`);
  console.log(`  ${chalk.hex(COLORS.ai)('AI')}     ${chalk.cyan('AI Pack v1 — repairs, agent context, copy-ready prompts')}`);
  console.log(`  ${chalk.hex(COLORS.coder)('Coder')}  ${chalk.cyan('architecture — domains, flows, scores, smells')}`);
  console.log(chalk.dim('  Toggle top-right · ?mode=vibe|ai|coder in the URL'));
}

export function printReportPaths(indexPath: string, outputDir: string): void {
  console.log('');
  console.log(`  Open:   ${chalk.cyan(`file:///${indexPath.replace(/\\/g, '/')}`)}`);
  console.log(`  Folder: ${chalk.dim(outputDir)}`);
}

export function printDashboardPreviewNote(): void {
  console.log('');
  console.log(chalk.yellow('ℹ') + ' ' + chalk.dim('Dashboard is in ') + chalk.yellow('preview') + chalk.dim(' — report + CLI are the stable surfaces today.'));
  console.log(chalk.dim('  Help us polish panels & layout: https://github.com/bitreonx/Mnestis/blob/main/CONTRIBUTING.md'));
}

export function printPrimaryNextSteps(): void {
  console.log('');
  console.log(chalk.bold('Recommended next steps'));
  console.log(`  ${chalk.cyan('mnestis report --open')}  ${chalk.dim('— open the polished HTML report (stable)')}`);
  console.log(`  ${chalk.cyan('mnestis pack')}           ${chalk.dim('— export AI Pack v1 JSON for agents')}`);
  console.log(`  ${chalk.cyan('mnestis setup')}         ${chalk.dim('— install AGENTS.md + Cursor rules + Fable discipline')}`);
  console.log(`  ${chalk.cyan('mnestis discipline')}    ${chalk.dim('— study Fable 5 habits vs your Opus sessions')}`);
  console.log(`  ${chalk.cyan('mnestis ui')}            ${chalk.dim('— interactive dashboard (preview)')}`);
}

const STAR_REPO = 'https://github.com/bitreonx/Mnestis';

/** Gentle star prompt — shown after successful builds (skip with MNESTIS_NO_STAR=1). */
export function printStarUsCallout(): void {
  if (process.env.MNESTIS_NO_STAR === '1' || process.env.MNESTIS_NO_STAR === 'true') return;
  console.log('');
  console.log(
    chalk.dim('  Enjoying Mnestis? ') +
      chalk.yellow('★ Star us on GitHub') +
      chalk.dim(' — helps others discover the memory layer for software'),
  );
  console.log(chalk.dim(`  ${STAR_REPO}`));
}

export function printBuildSummary(stats: {
  filesScanned: number;
  nodesCreated: number;
  edgesCreated: number;
  domainsFound: number;
  flowsFound: number;
  durationMs: number;
}): void {
  console.log(chalk.bold('Results'));
  console.log(`  Files scanned:  ${chalk.cyan(stats.filesScanned.toLocaleString())}`);
  console.log(`  Graph nodes:    ${chalk.cyan(stats.nodesCreated.toLocaleString())}`);
  console.log(`  Graph edges:    ${chalk.cyan(stats.edgesCreated.toLocaleString())}`);
  console.log(`  Domains:        ${chalk.cyan(String(stats.domainsFound))}`);
  console.log(`  Flows:          ${chalk.cyan(String(stats.flowsFound))}`);
  console.log(`  Duration:       ${chalk.cyan((stats.durationMs / 1000).toFixed(1) + 's')}`);
}

export function printContextDocs(): void {
  console.log(chalk.bold('Context docs (Mermaid graphs)'));
  console.log(`  ${chalk.cyan('context/README.md')}       — diagram index`);
  console.log(`  ${chalk.cyan('context/graphs.md')}       — all architecture charts`);
  console.log(`  ${chalk.cyan('context/languages.md')}    — stack + parsing pipeline`);
  console.log(`  ${chalk.cyan('context/architecture.md')} — layers, services, domains`);
  console.log(`  ${chalk.cyan('context/domains.md')}      — domain interaction graph`);
  console.log(`  ${chalk.cyan('context/flows.md')}        — execution flow diagrams`);
  console.log(`  ${chalk.cyan('context/dependencies.md')} — dependency + service graphs`);
  console.log(`  ${chalk.cyan('context/critical_paths.md')} — high-risk path diagram`);
  console.log(`  ${chalk.cyan('context/smells.md')}       — architecture smell chart`);
}
