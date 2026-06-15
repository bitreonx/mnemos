import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { existsSync } from 'node:fs';

export interface PathAliasMap {
  [alias: string]: string[];
}

/**
 * Load TypeScript/JavaScript path aliases from tsconfig.json or jsconfig.json.
 * Supports extends chains up to depth 3.
 */
export async function loadPathAliases(root: string): Promise<PathAliasMap> {
  const configs = ['tsconfig.json', 'jsconfig.json'];
  for (const name of configs) {
    const file = path.join(root, name);
    if (!existsSync(file)) continue;
    try {
      const aliases = await parseTsConfigPaths(file, root, 0);
      if (Object.keys(aliases).length > 0) return aliases;
    } catch {
      // try next config
    }
  }
  return { '@/': ['src/'] };
}

async function parseTsConfigPaths(
  configPath: string,
  root: string,
  depth: number,
): Promise<PathAliasMap> {
  if (depth > 3) return {};

  const raw = await readFile(configPath, 'utf-8');
  const json = stripJsonComments(raw);
  const config = JSON.parse(json) as {
    extends?: string;
    compilerOptions?: { baseUrl?: string; paths?: Record<string, string[]> };
  };

  let merged: PathAliasMap = {};

  if (config.extends) {
    const parentPath = path.resolve(path.dirname(configPath), config.extends.replace(/\.json$/, '') + '.json');
    if (existsSync(parentPath)) {
      merged = await parseTsConfigPaths(parentPath, root, depth + 1);
    }
  }

  const baseUrl = config.compilerOptions?.baseUrl ?? '.';
  const baseDir = path.resolve(path.dirname(configPath), baseUrl);
  const paths = config.compilerOptions?.paths ?? {};

  for (const [aliasPattern, targets] of Object.entries(paths)) {
    const aliasKey = aliasPattern.replace(/\*$/, '');
    merged[aliasKey] = targets.map((t) => {
      const resolved = path.relative(root, path.resolve(baseDir, t.replace(/\*$/, '')));
      return resolved.replace(/\\/g, '/');
    });
  }

  return merged;
}

function stripJsonComments(raw: string): string {
  return raw
    .replace(/\/\/.*$/gm, '')
    .replace(/\/\*[\s\S]*?\*\//g, '');
}

export function resolveAliasImport(
  importSource: string,
  aliases: PathAliasMap,
  allRelativePaths: string[],
): string | undefined {
  for (const [aliasPattern, targetPrefixes] of Object.entries(aliases)) {
    const aliasBase = aliasPattern.replace(/\*$/, '').replace(/\/$/, '');
    const matches =
      importSource === aliasBase ||
      importSource.startsWith(aliasBase + '/') ||
      (aliasPattern.endsWith('*') && importSource.startsWith(aliasBase));

    if (!matches) continue;

    const suffix = importSource.slice(aliasBase.length).replace(/^\//, '');

    for (const targetPrefix of targetPrefixes) {
      const base = targetPrefix.replace(/\*$/, '').replace(/\/$/, '');
      const joined = suffix ? `${base}/${suffix}` : base;

      for (const c of buildFileCandidates(joined.replace(/\\/g, "/"))) {
        const found = allRelativePaths.find((p) => p === c || p.endsWith('/' + c));
        if (found) return found;
      }
    }
  }

  if (importSource.startsWith('@/')) {
    const suffix = importSource.slice(2);
    for (const prefix of ['src/', 'app/', 'lib/']) {
      for (const c of buildFileCandidates(`${prefix}${suffix}`.replace(/\\/g, "/"))) {
        const found = allRelativePaths.find((p) => p === c || p.endsWith('/' + c));
        if (found) return found;
      }
    }
  }

  return undefined;
}

export function buildFileCandidates(basePath: string): string[] {
  const normalized = basePath.replace(/\\/g, '/');
  return [
    normalized,
    normalized + '.ts',
    normalized + '.tsx',
    normalized + '.js',
    normalized + '.jsx',
    normalized + '/index.ts',
    normalized + '/index.tsx',
    normalized + '/index.js',
  ];
}

export function resolveRelativeImport(
  fromFile: string,
  importSource: string,
  allRelativePaths: string[],
): string | undefined {
  if (!importSource.startsWith('.')) return undefined;

  const dir = path.dirname(fromFile);
  const joined = path.posix.join(dir, importSource).replace(/\\/g, '/');
  const candidates = buildFileCandidates(joined);

  for (const c of candidates) {
    const found = allRelativePaths.find((p) => p === c);
    if (found) return found;
  }
  return undefined;
}

export function resolvePackageImport(
  importSource: string,
  packageDirs: string[],
  allRelativePaths: string[],
): string | undefined {
  if (importSource.startsWith('.') || importSource.startsWith('@/')) return undefined;

  const parts = importSource.split('/');
  const isScoped = importSource.startsWith('@');
  const pkgName = isScoped ? `${parts[0]}/${parts[1]}` : parts[0]!;
  const subpath = isScoped ? parts.slice(2).join('/') : parts.slice(1).join('/');

  for (const pkgDir of packageDirs) {
    const pkgJsonPath = path.join(pkgDir, 'package.json');
    if (!existsSync(pkgJsonPath)) continue;

    try {
      const pkgBase = pkgDir.replace(/\\/g, '/');
      const suffix = subpath || 'index';
      for (const c of buildFileCandidates(path.posix.join(pkgBase, 'src', suffix))) {
        const found = allRelativePaths.find((p) => p === c || p.endsWith('/' + c));
        if (found) return found;
      }
      for (const c of buildFileCandidates(path.posix.join(pkgBase, suffix))) {
        const found = allRelativePaths.find((p) => p === c || p.endsWith('/' + c));
        if (found) return found;
      }
    } catch {
      // skip
    }

    if (pkgDir.endsWith(pkgName) || pkgDir.includes('/' + pkgName)) {
      const suffix = subpath || 'index';
      for (const c of buildFileCandidates(path.posix.join(pkgDir, 'src', suffix))) {
        const found = allRelativePaths.find((p) => p === c);
        if (found) return found;
      }
    }
  }

  return undefined;
}
