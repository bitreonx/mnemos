#!/usr/bin/env node
/**
 * Understand-Anything benchmark adapter — code-only path (no LLM).
 * Mirrors UA's tree-sitter + heuristic tour/layer pipeline without token spend.
 * Full /understand requires LLM agents; this is the honest apples-to-apples baseline.
 */
import { readFile, readdir, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UA_CORE = path.resolve(
  __dirname,
  '../vendor/understand-anything/understand-anything-plugin/packages/core/dist/index.js',
);

const IGNORE = /node_modules|\.git|\.mnemos|\.understand-anything|dist|build|coverage|vendor/;
const SOURCE_EXT = /\.(js|ts|tsx|jsx|mjs|cjs|py|go|rs|java|rb|php|cs|cpp|c|kt)$/i;

async function walkSourceFiles(root) {
  const files = [];
  async function walk(dir) {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (IGNORE.test(full)) continue;
      if (e.isDirectory()) await walk(full);
      else if (SOURCE_EXT.test(e.name)) {
        try {
          const s = await stat(full);
          if (s.size > 500_000) continue;
          files.push(full);
        } catch {
          /* skip */
        }
      }
    }
  }
  await walk(root);
  return files;
}

function formatSearchAnswer(results, nodeMap) {
  if (!results.length) return 'No matching nodes found.';
  return results
    .slice(0, 8)
    .map((r) => {
      const node = nodeMap.get(r.nodeId);
      if (!node) return r.nodeId;
      const loc = node.filePath ? ` (${node.filePath})` : '';
      const summary = node.summary ? `: ${node.summary}` : '';
      return `[${node.type}] ${node.name}${loc}${summary}`;
    })
    .join('\n');
}

export async function runUnderstandAnythingBench(repoPath) {
  const start = Date.now();
  if (!existsSync(UA_CORE)) {
    return {
      ok: false,
      latencyMs: Date.now() - start,
      tokens: 0,
      graphChars: 0,
      accuracy: 0,
      queries: [],
      note: 'Understand-Anything core not built — run: cd mnemos-bench/vendor/understand-anything && npx pnpm install',
      stderr: 'missing @understand-anything/core dist',
    };
  }

  const ua = await import(pathToFileURL(UA_CORE).href);
  const { TreeSitterPlugin, GraphBuilder, SearchEngine, detectLayers, generateHeuristicTour } = ua;

  const plugin = new TreeSitterPlugin();
  await plugin.init();

  const repoName = path.basename(repoPath);
  const builder = new GraphBuilder(repoName, 'bench', undefined);
  const files = await walkSourceFiles(repoPath);

  for (const absPath of files) {
    const rel = path.relative(repoPath, absPath).replace(/\\/g, '/');
    let content;
    try {
      content = await readFile(absPath, 'utf-8');
    } catch {
      continue;
    }

    let analysis;
    try {
      analysis = plugin.analyzeFile(rel, content);
    } catch {
      builder.addFile(rel, {
        summary: rel,
        tags: [],
        complexity: 'moderate',
      });
      continue;
    }

    builder.addFileWithAnalysis(rel, analysis, {
      summary: rel,
      tags: [],
      complexity: 'moderate',
      fileSummary: rel,
      summaries: Object.fromEntries([
        ...analysis.functions.map((f) => [f.name, f.name]),
        ...analysis.classes.map((c) => [c.name, c.name]),
      ]),
    });

    for (const imp of analysis.imports ?? []) {
      if (imp.source.startsWith('.')) {
        const resolved = path
          .normalize(path.join(path.dirname(rel), imp.source))
          .replace(/\\/g, '/');
        builder.addImportEdge(rel, resolved);
      }
    }
  }

  let graph = builder.build();
  graph.layers = detectLayers(graph);
  graph.tour = generateHeuristicTour(graph);

  const graphJson = JSON.stringify(graph);
  const graphChars = graphJson.length;
  const tokens = Math.ceil(graphChars / 4);

  const engine = new SearchEngine(graph.nodes);
  const nodeMap = new Map(graph.nodes.map((n) => [n.id, n]));

  const questions = [
    'Where does login start?',
    'List business capabilities',
    'Find the most critical subsystem',
  ];

  const queries = questions.map((question) => {
    const terms = question
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((t) => t.length > 2 && !['where', 'does', 'the', 'find', 'list', 'most'].includes(t));
    const q = terms.join(' ') || question;
    const results = engine.search(q, { limit: 10 });
    return {
      question,
      answer: formatSearchAnswer(results, nodeMap),
      ok: true,
      hitCount: results.length,
    };
  });

  const latencyMs = Date.now() - start;

  return {
    ok: true,
    latencyMs,
    graphChars,
    tokens,
    nodeCount: graph.nodes.length,
    edgeCount: graph.edges.length,
    layerCount: graph.layers.length,
    tourSteps: graph.tour.length,
    queries,
    note: 'Code-only tree-sitter scan — no LLM summaries/tours/domain view (full /understand needs tokens)',
    mode: 'structural-only',
  };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const repo = process.argv[2] ?? '.';
  runUnderstandAnythingBench(path.resolve(repo))
    .then((r) => console.log(JSON.stringify(r, null, 2)))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
