import path from 'node:path';

import { readFile, stat } from 'node:fs/promises';

import type { BuildOptions, BuildResult, MemoryModel, ParsedFile } from '../types.js';

import { scanRepository } from '../scanner/index.js';

import { parseFile, parseFiles, parseFilesIncremental } from '../parser/index.js';

import { buildGraph, buildGraphAsync } from '../graph/builder.js';

import { discoverDomains } from '../analysis/domains.js';

import { discoverFlows } from '../analysis/flows.js';

import { discoverCapabilities } from '../analysis/capabilities.js';

import { discoverJourneys } from '../analysis/journeys.js';

import { detectDeadCode } from '../analysis/dead-code.js';

import { detectSmells } from '../analysis/smells.js';

import { assembleMemoryModel } from '../memory/writer.js';

import { compileContext, writeMemoryModel } from '../context/compiler.js';

import { buildAgentExports } from '../agent-mode.js';
import { writeAgentExports } from '../agent-mode-io.js';

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

import { buildSearchIndex } from '../search/index.js';



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

          recordFile(fileCache, relativePath, content, fileStat.mtimeMs);

        }

      } catch {

        changedPaths.add(relativePath);

      }

    }



    for (const relPath of Object.keys(fileCache.entries)) {

      if (!scan.files.some((f) => path.relative(root, f).replace(/\\/g, '/') === relPath)) {

        removeFile(fileCache, relPath);

        cachedParsed.delete(relPath);

        changedPaths.add(relPath);

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



    filesParsed = changedPaths.size;



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



  const graph = await buildGraphAsync(root, scan, parsedFiles);

  const domains = discoverDomains(graph);

  const flows = discoverFlows(graph, parsedFiles);

  const capabilities = discoverCapabilities(graph, { services: [], apis: [], domains });

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



  const heatmap = computeDomainHeatmap(memory);

  const searchIndex = buildSearchIndex(memory);

  const { writeFile } = await import('node:fs/promises');

  await writeFile(path.join(outputDir, 'heatmap.json'), JSON.stringify(heatmap, null, 2), 'utf-8');

  await writeFile(path.join(outputDir, 'health-score.json'), JSON.stringify(memoryScore, null, 2), 'utf-8');

  await writeFile(

    path.join(outputDir, 'search-index.json'),

    JSON.stringify({ documentCount: searchIndex.documents.length, builtAt: new Date().toISOString() }, null, 2),

    'utf-8',

  );



  if (options.verbose) {

    console.log(`Done in ${(stats.durationMs / 1000).toFixed(1)}s`);

    console.log(`Output: ${outputDir}`);

  }



  return { memory, outputDir };

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


