import path from 'node:path';

import type { GraphNode, ParsedFile, ScanResult } from '../types.js';

import { addEdge, addNode, createGraph, nodeId, type MnemosGraph } from './graph.js';

import { inferServiceName } from '../scanner/index.js';

import {

  loadPathAliases,

  resolveAliasImport,

  resolveRelativeImport,

  resolvePackageImport,

  type PathAliasMap,

} from './paths.js';



let cachedAliases: { root: string; aliases: PathAliasMap } | null = null;



export async function buildGraphAsync(

  root: string,

  scan: ScanResult,

  parsedFiles: ParsedFile[],

): Promise<MnemosGraph> {

  if (!cachedAliases || cachedAliases.root !== root) {

    const aliases = await loadPathAliases(root);

    cachedAliases = { root, aliases };

  }

  return buildGraphWithAliases(root, scan, parsedFiles, cachedAliases.aliases);

}



export function buildGraph(

  root: string,

  scan: ScanResult,

  parsedFiles: ParsedFile[],

): MnemosGraph {

  const defaultAliases: PathAliasMap = { '@/': ['src/'] };

  return buildGraphWithAliases(root, scan, parsedFiles, cachedAliases?.root === root ? cachedAliases.aliases : defaultAliases);

}



function buildGraphWithAliases(

  root: string,

  scan: ScanResult,

  parsedFiles: ParsedFile[],

  aliases: PathAliasMap,

): MnemosGraph {

  const graph = createGraph();

  const repoName = scan.rootPackageName ?? path.basename(root);

  const repoId = addNode(graph, 'repository', repoName, { path: root });



  const fileIndex = new Map<string, string>();

  const symbolIndex = new Map<string, string>();

  const importMap = new Map<string, Map<string, string>>();

  const allPaths = parsedFiles.map((f) => f.relativePath);



  for (const pkg of scan.packages) {

    const pkgId = addNode(graph, 'package', path.basename(pkg) || repoName, {

      path: pkg,

      metadata: { fullPath: pkg },

    });

    addEdge(graph, repoId, pkgId, 'OWNS');

  }



  for (const file of parsedFiles) {

    const fileId = addNode(graph, 'file', file.relativePath, {

      path: file.relativePath,

      language: file.language,

      metadata: {

        isTest: file.isTest,

        isRoute: file.isRoute,

        hasUseServer: file.hasUseServer,

        domainHint: file.metadata.domainHint,

      },

    });

    fileIndex.set(file.relativePath, fileId);



    const localImports = new Map<string, string>();

    importMap.set(file.relativePath, localImports);



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

      const domainId = addNode(graph, 'domain', domainHint, {

        metadata: { inferred: true },

      });

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



  for (const file of parsedFiles) {

    const sourceId = fileIndex.get(file.relativePath);

    if (!sourceId) continue;

    const localImports = importMap.get(file.relativePath)!;



    for (const imp of file.imports) {

      const resolved =

        resolveRelativeImport(file.relativePath, imp.source, allPaths) ??

        resolveAliasImport(imp.source, aliases, allPaths) ??

        resolvePackageImport(imp.source, scan.packages, allPaths);



      if (resolved) {

        localImports.set(imp.specifiers[0] ?? imp.source, resolved);

        const targetId = fileIndex.get(resolved);

        if (targetId) {

          addEdge(graph, sourceId, targetId, 'IMPORTS', {

            specifiers: imp.specifiers,

            importSource: imp.source,

          });

          addEdge(graph, sourceId, targetId, 'DEPENDS_ON');

        }

      }

    }



    for (const call of file.calls) {

      const parts = call.callee.split('.');

      const baseName = parts[0]!;

      const methodName = parts[parts.length - 1]!;



      const importedFile = localImports.get(baseName);

      if (importedFile) {

        const symKey = `${importedFile}#${methodName}`;

        const targetSymId = symbolIndex.get(symKey) ?? symbolIndex.get(`${importedFile}#${baseName}`);

        if (targetSymId) {

          addEdge(graph, sourceId, targetSymId, 'CALLS', { line: call.line, resolved: true });

          continue;

        }

      }



      const symKey = [...symbolIndex.keys()].find((k) => k.endsWith(`#${methodName}`) || k.endsWith(`#${baseName}`));

      if (symKey) {

        const targetSymId = symbolIndex.get(symKey);

        if (targetSymId) {

          addEdge(graph, sourceId, targetSymId, 'CALLS', { line: call.line });

        }

      }

    }

  }



  return graph;

}



export function resolveNodeQuery(graph: MnemosGraph, query: string): string | undefined {

  const normalized = query.toLowerCase().trim();

  const terms = normalized.split(/\s+/).filter(Boolean);



  let bestId: string | undefined;

  let bestScore = 0;



  graph.forEachNode((id: string, attrs: GraphNode) => {

    const haystack = [id, attrs.name, attrs.path ?? ''].join(' ').toLowerCase();

    let score = 0;

    if (attrs.name.toLowerCase() === normalized) score += 10;

    if (id.toLowerCase() === normalized) score += 10;

    for (const term of terms) {

      if (haystack.includes(term)) score += 2;

    }

    if (score > bestScore) {

      bestScore = score;

      bestId = id;

    }

  });



  return bestId;

}


