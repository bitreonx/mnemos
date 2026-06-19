import path from 'node:path';

import { readFile, stat } from 'node:fs/promises';

import type { BuildOptions, BuildResult, MemoryModel, ParsedFile } from '../types.js';

import { scanRepository } from '../scanner/index.js';

import { parseFile, parseFiles, parseFilesIncremental } from '../parser/index.js';

import { buildGraph, buildGraphAsync } from '../graph/builder.js';
import { loadPathAliases } from '../graph/paths.js';
import { patchGraph, shouldPatchGraph } from '../graph/incremental.js';

import { discoverDomains } from '../analysis/domains.js';

import { discoverFlows } from '../analysis/flows.js';

import { discoverCapabilities } from '../analysis/capabilities.js';

import { discoverJourneys } from '../analysis/journeys.js';

import { discoverPackageEntryPoints } from '../analysis/entry-points.js';

import { detectDeadCode } from '../analysis/dead-code.js';

import { detectSmells } from '../analysis/smells.js';

import { assembleMemoryModel } from '../memory/writer.js';

import { compileContext, writeMemoryModel } from '../context/compiler.js';

import { buildAgentExports } from '../agent-mode.js';
import { writeAgentExports } from '../agent-mode-io.js';
import { buildAiToolkit } from '../ai-toolkit.js';
import { compactJson } from '../util/compact-json.js';
import { writeAiToolkit } from '../ai-toolkit-io.js';

import { computeMemoryScore } from '../report.js';

import { computeDomainHeatmap } from '../analysis/heatmap.js';

import {

  loadFileCache,

  saveFileCache,

  createFileCache,

  hasFileChanged,

  recordFile,

  removeFile,

  loadParseCache,

  saveParseCache,

} from '../cache.js';

import { invalidateMnemosRuntime } from '../agent-runtime.js';
import { buildSearchIndex, serializeSearchIndex } from '../search/index.js';
import { buildMemoryShards, writeMemoryShards } from '../memory-shards/index.js';



export async function build(options: BuildOptions): Promise<BuildResult> {

  const start = Date.now();

  const root = path.resolve(options.root);

  const outputDir = options.outputDir ?? path.join(root, '.mnemos');

  const incremental = options.incremental !== false;



  if (options.verbose) {

    console.log(`Scanning ${root}...`);

  }



  const scan = await scanRepository(root, options.ignore);



  if (options.verbose) {

    console.log(`Found ${scan.files.length} source files`);

  }



  let parsedFiles: ParsedFile[];

  let filesParsed = 0;

  let filesCached = 0;

  let deletedPaths = new Set<string>();

  let reparsedPaths = new Set<string>();

  if (incremental) {

    const fileCache = (await loadFileCache(outputDir)) ?? createFileCache(root);

    const parseCache = await loadParseCache(outputDir);

    const changedPaths = new Set<string>();

    const cachedParsed = new Map<string, ParsedFile>();



    for (const [relPath, entry] of Object.entries(parseCache.entries)) {

      if (scan.files.some((f) => path.relative(root, f).replace(/\\/g, '/') === relPath)) {

        cachedParsed.set(relPath, entry.parsed);

      }

    }



    for (const file of scan.files) {

      const relativePath = path.relative(root, file).replace(/\\/g, '/');

      try {

        const content = await readFile(file, 'utf-8');

        const fileStat = await stat(file);

        if (!hasFileChanged(fileCache, relativePath, content)) {

          filesCached++;

        } else {

          changedPaths.add(relativePath);
          reparsedPaths.add(relativePath);

          recordFile(fileCache, relativePath, content, fileStat.mtimeMs);

        }

      } catch {

        changedPaths.add(relativePath);
        reparsedPaths.add(relativePath);

      }

    }



    for (const relPath of Object.keys(fileCache.entries)) {

      if (!scan.files.some((f) => path.relative(root, f).replace(/\\/g, '/') === relPath)) {

        removeFile(fileCache, relPath);

        cachedParsed.delete(relPath);

        changedPaths.add(relPath);
        deletedPaths.add(relPath);

      }

    }



    parsedFiles = await parseFilesIncremental(

      scan.files,

      root,

      cachedParsed,

      changedPaths,

      (done, total) => {

        if (options.verbose && done % 500 === 0) {

          console.log(`Parsing: ${done}/${total} (${filesCached} cached)`);

        }

      },

    );



    filesParsed = reparsedPaths.size;



    const newParseCache: Record<string, { hash: string; parsed: ParsedFile }> = {};

    for (const pf of parsedFiles) {

      const content = await readFile(pf.path, 'utf-8').catch(() => '');

      const { cheapHash } = await import('../cache.js');

      newParseCache[pf.relativePath] = { hash: cheapHash(content), parsed: pf };

    }



    await saveFileCache(outputDir, { ...fileCache, root });

    await saveParseCache(outputDir, { version: 1, entries: newParseCache });



    if (options.verbose && filesCached > 0) {

      console.log(`Incremental: ${filesCached} files from cache, ${filesParsed} re-parsed`);

    }

  } else {

    parsedFiles = await parseFiles(scan.files, root, (done, total) => {

      if (options.verbose && done % 500 === 0) {

        console.log(`Parsing: ${done}/${total}`);

      }

    });

  }



  if (options.verbose) {

    console.log('Building knowledge graph...');

  }



  const entryPoints = await discoverPackageEntryPoints(root);

  const existingGraph = incremental ? await loadPersistedGraph(outputDir) : undefined;
  const patchAffected = filesParsed + deletedPaths.size;

  let graph;
  if (
    incremental &&
    existingGraph &&
    shouldPatchGraph(parsedFiles.length, patchAffected, true)
  ) {
    const aliases = await loadPathAliases(root);
    graph = patchGraph(existingGraph, {
      root,
      scan,
      parsedFiles,
      changedPaths: reparsedPaths,
      deletedPaths,
      entryPoints,
      aliases,
    });
    if (options.verbose) {
      console.log(`Incremental graph patch: ${patchAffected} file(s) (${filesParsed} changed, ${deletedPaths.size} deleted)`);
    }
  } else {
    graph = await buildGraphAsync(root, scan, parsedFiles, entryPoints);
  }

  const domains = discoverDomains(graph);

  const flows = discoverFlows(graph, parsedFiles);

  const packageDeps = await readPackageDependencies(root);

  // NOTE: discoverCapabilities needs the populated services/apis, which are
  // produced by assembleMemoryModel. Build the memory model first, then run
  // capability discovery against the real model and patch the result in.
  let capabilities: ReturnType<typeof discoverCapabilities> = [];

  const journeys = discoverJourneys(graph, parsedFiles, flows);

  const deadCode = detectDeadCode(graph);

  const smells = detectSmells(graph);



  const repoName = scan.rootPackageName ?? path.basename(root);



  const stats: MemoryModel['stats'] = {

    filesScanned: parsedFiles.length,

    nodesCreated: graph.order,

    edgesCreated: graph.size,

    domainsFound: domains.length,

    flowsFound: flows.length,

    durationMs: Date.now() - start,

  };



  const memory = assembleMemoryModel(

    repoName,

    graph,

    parsedFiles,

    scan.packages,

    domains,

    flows,

    deadCode,

    smells,

    stats,

    capabilities,

    journeys,

  );

  capabilities = discoverCapabilities(
    graph,
    { services: memory.services, apis: memory.apis, domains: memory.domains },
    { packageDeps },
  );
  memory.capabilities = capabilities;



  enrichArchitectureSummary(memory);



  if (options.verbose) {

    console.log('Writing memory model...');

  }



  await writeMemoryModel(memory, outputDir);

  await compileContext(memory, graph, outputDir);



  const memoryScore = computeMemoryScore(memory);

  const agentExports = buildAgentExports({

    memory,

    capabilities,

    journeys,

    memoryScore: memoryScore.overall,

  });

  await writeAgentExports(agentExports, outputDir);

  const aiToolkit = buildAiToolkit(memory, capabilities, journeys, agentExports.context);
  await writeAiToolkit(aiToolkit, outputDir);



  const heatmap = computeDomainHeatmap(memory);

  const searchIndex = buildSearchIndex(memory);

  const { writeFile } = await import('node:fs/promises');

  await writeFile(path.join(outputDir, 'heatmap.json'), JSON.stringify(heatmap, null, 2), 'utf-8');

  await writeFile(path.join(outputDir, 'health-score.json'), compactJson(memoryScore), 'utf-8');

  await writeFile(

    path.join(outputDir, 'search-index.json'),

    JSON.stringify(serializeSearchIndex(searchIndex), null, 2),

    'utf-8',

  );

  const { appendBuildSnapshot } = await import('../snapshot/dna-diff.js');
  const dnaDiff = await appendBuildSnapshot(memory, outputDir);
  if (options.verbose && dnaDiff.changes.length > 0) {
    console.log(`DNA diff: ${dnaDiff.summary} (risk: ${dnaDiff.regressionRisk})`);
  }

  if (options.verbose) {
    console.log('Writing shared memory shards…');
  }
  const shardSet = buildMemoryShards(memory);
  await writeMemoryShards(shardSet, outputDir);
  if (options.verbose) {
    console.log(`Shared memory: ${shardSet.shards.length} shards · ${shardSet.totalEstimatedTokens.toLocaleString()} estimated tokens`);
  }



  if (options.verbose) {

    console.log(`Done in ${(stats.durationMs / 1000).toFixed(1)}s`);

    console.log(`Output: ${outputDir}`);

  }

  invalidateMnemosRuntime(root);

  return { memory, outputDir };

}



function enrichArchitectureSummary(memory: MemoryModel): void {
  const caps = (memory.capabilities ?? []).filter((c) => c.confidence >= 0.15);
  const capNames = caps.slice(0, 4).map((c) => c.signature.name.toLowerCase());
  const hints: string[] = [];

  if (capNames.some((n) => n.includes('http framework') || n.includes('middleware'))) {
    hints.push('HTTP middleware and routing framework');
  }
  if (memory.flows.length > 0) {
    hints.push(`${memory.flows.length} execution flows`);
  }
  if (memory.domains.length > 0) {
    const coreDomains = memory.domains
      .filter((d) => !/^(test|tests|acceptance|examples?)$/i.test(d.name))
      .slice(0, 3)
      .map((d) => d.name);
    if (coreDomains.length > 0) hints.push(`core domains: ${coreDomains.join(', ')}`);
  }

  if (hints.length > 0) {
    memory.architecture.summary = `${memory.architecture.summary} ${hints.join('; ')}.`;
  }
}



export async function loadMemoryModel(root: string): Promise<{ memory: MemoryModel; outputDir: string } | null> {

  const outputDir = path.join(path.resolve(root), '.mnemos');

  try {

    const { readFile } = await import('node:fs/promises');

    const raw = await readFile(path.join(outputDir, 'memory.json'), 'utf-8');

    return { memory: JSON.parse(raw) as MemoryModel, outputDir };

  } catch {

    return null;

  }

}

async function readPackageDependencies(root: string): Promise<string[]> {
  try {
    const { readFile } = await import('node:fs/promises');
    const raw = await readFile(path.join(root, 'package.json'), 'utf-8');
    const pkg = JSON.parse(raw) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
      optionalDependencies?: Record<string, string>;
    };
    return [
      ...Object.keys(pkg.dependencies ?? {}),
      ...Object.keys(pkg.devDependencies ?? {}),
      ...Object.keys(pkg.optionalDependencies ?? {}),
    ];
  } catch {
    return [];
  }
}

export async function loadPersistedGraph(outputDir: string) {
  const { fromSerializable } = await import('../graph/graph.js');
  try {
    const { readFile } = await import('node:fs/promises');
    const raw = await readFile(path.join(outputDir, 'graph.json'), 'utf-8');
    return fromSerializable(JSON.parse(raw));
  } catch {
    return undefined;
  }
}


