import type { ParsedFile } from '../types.js';
import type { MnemosGraph } from './graph.js';
import { addEdge } from './graph.js';
import {
  resolveRelativeImport,
  resolveAliasImport,
  resolvePackageImport,
  type PathAliasMap,
} from './paths.js';

/** Map every import specifier to its resolved file path (not just the first). */
export function buildImportMaps(
  parsedFiles: ParsedFile[],
  allPaths: string[],
  aliases: PathAliasMap,
  packages: string[],
): Map<string, Map<string, string>> {
  const importMap = new Map<string, Map<string, string>>();

  for (const file of parsedFiles) {
    const local = new Map<string, string>();
    importMap.set(file.relativePath, local);

    for (const imp of file.imports) {
      const resolved =
        resolveRelativeImport(file.relativePath, imp.source, allPaths) ??
        resolveAliasImport(imp.source, aliases, allPaths) ??
        resolvePackageImport(imp.source, packages, allPaths);

      if (!resolved) continue;

      // Always remember the raw source → resolved file mapping. For named
      // imports we also map each specifier. Side-effect / require / dynamic
      // imports still need their source mapped so callers can wire file-to-file
      // IMPORTS edges from CommonJS / barrel modules.
      local.set(imp.source, resolved);

      if (imp.specifiers.length === 0 || imp.specifiers.includes('*side-effect*')) {
        local.set(imp.source, resolved);
      }

      for (const spec of imp.specifiers) {
        if (spec.startsWith('*')) continue;
        local.set(spec, resolved);
      }
    }
  }

  return importMap;
}

/** export { X } from './module' → alias key barrel#X → module#X */
export function buildReexportAliases(
  parsedFiles: ParsedFile[],
  allPaths: string[],
  aliases: PathAliasMap,
  packages: string[],
): Map<string, string> {
  const reexports = new Map<string, string>();

  for (const file of parsedFiles) {
    for (const imp of file.imports) {
      const resolved =
        resolveRelativeImport(file.relativePath, imp.source, allPaths) ??
        resolveAliasImport(imp.source, aliases, allPaths) ??
        resolvePackageImport(imp.source, packages, allPaths);

      if (!resolved) continue;

      for (const spec of imp.specifiers) {
        if (spec.startsWith('*')) continue;
        reexports.set(`${file.relativePath}#${spec}`, `${resolved}#${spec}`);
      }
    }
  }

  return reexports;
}

export function resolveSymbolKey(
  symbolKey: string,
  reexports: Map<string, string>,
  maxDepth = 6,
): string {
  let current = symbolKey;
  const seen = new Set<string>();

  for (let i = 0; i < maxDepth; i++) {
    if (seen.has(current)) break;
    seen.add(current);
    const next = reexports.get(current);
    if (!next) break;
    current = next;
  }

  return current;
}

export function resolveCallTargetSymbol(
  callee: string,
  localImports: Map<string, string>,
  symbolIndex: Map<string, string>,
  reexports: Map<string, string>,
): string | undefined {
  const parts = callee.split('.');
  const baseName = parts[0]!;
  const methodName = parts[parts.length - 1]!;

  const importedFile = localImports.get(baseName);
  if (importedFile) {
    const directKey = resolveSymbolKey(`${importedFile}#${methodName}`, reexports);
    const direct = symbolIndex.get(directKey);
    if (direct) return direct;

    const baseKey = resolveSymbolKey(`${importedFile}#${baseName}`, reexports);
    const baseSym = symbolIndex.get(baseKey);
    if (baseSym) return baseSym;
  }

  const fallbackKey = [...symbolIndex.keys()].find(
    (k) => k.endsWith(`#${methodName}`) || k.endsWith(`#${baseName}`),
  );
  if (fallbackKey) {
    return symbolIndex.get(resolveSymbolKey(fallbackKey, reexports));
  }

  return undefined;
}

export function wireReexportSymbolEdges(
  graph: MnemosGraph,
  fileIndex: Map<string, string>,
  reexports: Map<string, string>,
  symbolIndex: Map<string, string>,
): void {
  for (const [fromKey, toKey] of reexports) {
    const toSym = symbolIndex.get(toKey);
    if (!toSym) continue;

    const [fromFile] = fromKey.split('#');
    const fileId = fileIndex.get(fromFile);
    if (!fileId) continue;

    addEdge(graph, fileId, toSym, 'IMPORTS', { reexport: true, alias: fromKey });
  }
}
