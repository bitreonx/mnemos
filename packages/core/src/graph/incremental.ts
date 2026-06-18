import path from 'node:path';
import type { ParsedFile, ScanResult } from '../types.js';
import type { MnemosGraph } from './graph.js';
import { addEdge, addNode, createGraph, nodeId } from './graph.js';
import { inferServiceName } from '../scanner/index.js';
import type { PathAliasMap } from './paths.js';
import {
  buildImportMaps,
  buildReexportAliases,
  resolveCallTargetSymbol,
  wireReexportSymbolEdges,
} from './import-resolution.js';

export interface GraphPatchOptions {
  root: string;
  scan: ScanResult;
  parsedFiles: ParsedFile[];
  changedPaths: Set<string>;
  deletedPaths: Set<string>;
  entryPoints: Set<string>;
  aliases: PathAliasMap;
}

export function shouldPatchGraph(totalFiles: number, affectedCount: number, hasGraph: boolean): boolean {
  if (!hasGraph || affectedCount === 0) return false;
  const threshold = Math.max(20, Math.floor(totalFiles * 0.2));
  return affectedCount <= threshold;
}

function isEntry(rel: string, entryPoints: Set<string>): boolean {
  const norm = rel.replace(/\\/g, '/');
  if (entryPoints.has(norm)) return true;
  return [...entryPoints].some((e) => norm.endsWith(`/${e}`) || norm === e);
}

function rebuildIndices(graph: MnemosGraph): {
  fileIndex: Map<string, string>;
  symbolIndex: Map<string, string>;
} {
  const fileIndex = new Map<string, string>();
  const symbolIndex = new Map<string, string>();

  graph.forEachNode((id: string, attrs: { kind?: string; path?: string; name?: string }) => {
    if (attrs.kind === 'file' && attrs.path) {
      fileIndex.set(attrs.path, id);
    }
    if (attrs.path?.includes(':') && attrs.name) {
      const filePath = attrs.path.split(':')[0]!;
      symbolIndex.set(`${filePath}#${attrs.name}`, id);
    }
  });

  return { fileIndex, symbolIndex };
}

function collectFileNodeIds(graph: MnemosGraph, relativePath: string): string[] {
  const norm = relativePath.replace(/\\/g, '/');
  const ids = new Set<string>();
  const fileNodeId = nodeId('file', norm);

  if (graph.hasNode(fileNodeId)) ids.add(fileNodeId);

  graph.forEachNode((id: string, attrs: { path?: string; kind?: string }) => {
    if (attrs.path === norm && attrs.kind === 'test') ids.add(id);
    if (attrs.path?.startsWith(`${norm}:`)) ids.add(id);
  });

  return [...ids];
}

function clearDynamicEdges(graph: MnemosGraph): void {
  const drop: string[] = [];
  graph.forEachEdge((edgeKey: string, attrs: { kind?: string }) => {
    if (attrs.kind === 'IMPORTS' || attrs.kind === 'DEPENDS_ON' || attrs.kind === 'CALLS') {
      drop.push(edgeKey);
    }
  });
  for (const key of drop) {
    if (graph.hasEdge(key)) graph.dropEdge(key);
  }
}

export function addParsedFileNodes(
  graph: MnemosGraph,
  file: ParsedFile,
  scan: ScanResult,
  entryPoints: Set<string>,
  fileIndex: Map<string, string>,
  symbolIndex: Map<string, string>,
): void {
  const fileId = addNode(graph, 'file', file.relativePath, {
    path: file.relativePath,
    language: file.language,
    metadata: {
      isTest: file.isTest,
      isRoute: file.isRoute,
      hasUseServer: file.hasUseServer,
      domainHint: file.metadata.domainHint,
      isEntryPoint: isEntry(file.relativePath, entryPoints),
    },
  });
  fileIndex.set(file.relativePath, fileId);

  const serviceName = inferServiceName(file.relativePath, scan.packages);
  if (serviceName) {
    const serviceId = addNode(graph, 'service', serviceName, {
      path: serviceName,
      metadata: { inferred: true },
    });
    addEdge(graph, serviceId, fileId, 'OWNS');
  }

  const domainHint = file.metadata.domainHint as string | undefined;
  if (domainHint) {
    const domainId = addNode(graph, 'domain', domainHint, { metadata: { inferred: true } });
    addEdge(graph, domainId, fileId, 'CONTAINS');
  }

  for (const sym of file.symbols) {
    const symKind =
      sym.kind === 'route' ? 'route' : sym.kind === 'class' ? 'class' : sym.kind === 'interface' ? 'interface' : 'function';
    const symId = addNode(graph, symKind, sym.name, {
      path: `${file.relativePath}:${sym.startLine}`,
      metadata: { exported: sym.isExported, lines: [sym.startLine, sym.endLine] },
    });
    addEdge(graph, fileId, symId, 'CONTAINS');
    symbolIndex.set(`${file.relativePath}#${sym.name}`, symId);

    if (sym.kind === 'route' && file.routePath) {
      const apiId = addNode(graph, 'api', file.routePath, {
        path: file.relativePath,
        metadata: { routePath: file.routePath },
      });
      addEdge(graph, apiId, symId, 'EXPOSES');
      addEdge(graph, fileId, apiId, 'EXPOSES');
    }
  }

  if (file.isTest) {
    const testId = addNode(graph, 'test', file.relativePath, { path: file.relativePath });
    addEdge(graph, fileId, testId, 'IMPLEMENTS');
  }
}

export function wireGraphEdges(
  graph: MnemosGraph,
  parsedFiles: ParsedFile[],
  scan: ScanResult,
  aliases: PathAliasMap,
  fileIndex: Map<string, string>,
  symbolIndex: Map<string, string>,
): void {
  const allPaths = parsedFiles.map((f) => f.relativePath);
  const importMap = buildImportMaps(parsedFiles, allPaths, aliases, scan.packages);
  const reexports = buildReexportAliases(parsedFiles, allPaths, aliases, scan.packages);

  wireReexportSymbolEdges(graph, fileIndex, reexports, symbolIndex);

  for (const file of parsedFiles) {
    const sourceId = fileIndex.get(file.relativePath);
    if (!sourceId) continue;
    const localImports = importMap.get(file.relativePath)!;

    for (const imp of file.imports) {
      let targetPath: string | undefined;
      for (const spec of imp.specifiers) {
        if (!spec.startsWith('*')) {
          targetPath = localImports.get(spec);
          if (targetPath) break;
        }
      }
      // Also fall back to the raw source. Required for CommonJS require(),
      // dynamic import(), and side-effect imports where there are no named
      // specifiers to map from.
      targetPath ??= localImports.get(imp.source);
      if (!targetPath) continue;
      const targetId = fileIndex.get(targetPath);
      if (!targetId) continue;

      addEdge(graph, sourceId, targetId, 'IMPORTS', {
        specifiers: imp.specifiers,
        importSource: imp.source,
      });
      addEdge(graph, sourceId, targetId, 'DEPENDS_ON');
    }

    for (const call of file.calls) {
      const targetSymId = resolveCallTargetSymbol(call.callee, localImports, symbolIndex, reexports);
      if (targetSymId) {
        addEdge(graph, sourceId, targetSymId, 'CALLS', { line: call.line, resolved: true });
      }
    }
  }
}

export function patchGraph(existing: MnemosGraph, options: GraphPatchOptions): MnemosGraph {
  const graph = existing.copy() as MnemosGraph;
  const affected = new Set([...options.changedPaths, ...options.deletedPaths]);
  const { fileIndex, symbolIndex } = rebuildIndices(graph);

  for (const rel of affected) {
    for (const id of collectFileNodeIds(graph, rel)) {
      if (graph.hasNode(id)) graph.dropNode(id);
    }
    fileIndex.delete(rel);
    for (const key of [...symbolIndex.keys()]) {
      if (key.startsWith(`${rel}#`)) symbolIndex.delete(key);
    }
  }

  const parsedByPath = new Map(options.parsedFiles.map((f) => [f.relativePath, f]));
  for (const rel of options.changedPaths) {
    const file = parsedByPath.get(rel);
    if (file) addParsedFileNodes(graph, file, options.scan, options.entryPoints, fileIndex, symbolIndex);
  }

  clearDynamicEdges(graph);
  wireGraphEdges(graph, options.parsedFiles, options.scan, options.aliases, fileIndex, symbolIndex);

  return graph;
}

export function buildEmptyGraph(root: string, scan: ScanResult): MnemosGraph {
  const graph = createGraph();
  const repoName = scan.rootPackageName ?? path.basename(root);
  const repoId = addNode(graph, 'repository', repoName, { path: root });
  for (const pkg of scan.packages) {
    const pkgId = addNode(graph, 'package', path.basename(pkg) || repoName, {
      path: pkg,
      metadata: { fullPath: pkg },
    });
    addEdge(graph, repoId, pkgId, 'OWNS');
  }
  return graph;
}
