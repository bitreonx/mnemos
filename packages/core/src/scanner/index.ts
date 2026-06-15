import fg from 'fast-glob';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { ScanResult } from '../types.js';

const DEFAULT_IGNORE = [
  '**/node_modules/**',
  '**/.git/**',
  '**/dist/**',
  '**/build/**',
  '**/.next/**',
  '**/coverage/**',
  '**/.mnemos/**',
  '**/vendor/**',
  '**/.turbo/**',
  '**/.expo/**',
  '**/android/**',
  '**/ios/**',
];

const SOURCE_EXTENSIONS = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
  '.py',
  '.go',
  '.rs',
  '.java',
]);

export async function scanRepository(
  root: string,
  extraIgnore: string[] = [],
  maxFiles = 50_000,
): Promise<ScanResult> {
  const normalizedRoot = path.resolve(root);
  const patterns = ['**/*.{ts,tsx,js,jsx,mjs,cjs,py,go,rs,java}'];

  const files = await fg(patterns, {
    cwd: normalizedRoot,
    absolute: true,
    ignore: [...DEFAULT_IGNORE, ...extraIgnore],
    onlyFiles: true,
    followSymbolicLinks: false,
  });

  const limited = files.slice(0, maxFiles);
  const packages = await detectPackages(normalizedRoot);

  let rootPackageName: string | undefined;
  try {
    const pkgRaw = await readFile(path.join(normalizedRoot, 'package.json'), 'utf-8');
    rootPackageName = JSON.parse(pkgRaw).name;
  } catch {
    // no root package.json
  }

  return {
    files: limited.filter((f) => SOURCE_EXTENSIONS.has(path.extname(f).toLowerCase())),
    packages,
    rootPackageName,
  };
}

async function detectPackages(root: string): Promise<string[]> {
  const packageJsonFiles = await fg('**/package.json', {
    cwd: root,
    absolute: true,
    ignore: DEFAULT_IGNORE,
    onlyFiles: true,
  });

  return packageJsonFiles
    .map((f) => path.dirname(path.relative(root, f)))
    .filter((p) => p !== '' && !p.startsWith('..'))
    .sort((a, b) => a.localeCompare(b));
}

export function inferLanguage(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  const map: Record<string, string> = {
    '.ts': 'typescript',
    '.tsx': 'typescript',
    '.js': 'javascript',
    '.jsx': 'javascript',
    '.mjs': 'javascript',
    '.cjs': 'javascript',
    '.py': 'python',
    '.go': 'go',
    '.rs': 'rust',
    '.java': 'java',
  };
  return map[ext] ?? 'unknown';
}

export function isTestFile(relativePath: string): boolean {
  return (
    relativePath.includes('__tests__') ||
    relativePath.includes('/test/') ||
    relativePath.includes('/tests/') ||
    /\.(test|spec)\.[tj]sx?$/.test(relativePath)
  );
}

export function inferRoutePath(relativePath: string): string | undefined {
  const normalized = relativePath.replace(/\\/g, '/');

  // Next.js App Router
  const appMatch = normalized.match(/(?:^|\/)app\/(.+?)\/(page|route)\.(tsx?|jsx?)$/);
  if (appMatch) {
    let route = appMatch[1]!
      .replace(/\[\.\.\.([^\]]+)\]/g, '*')
      .replace(/\[([^\]]+)\]/g, ':$1');
    if (route.endsWith('/page') || route.endsWith('/route')) {
      route = route.replace(/\/(page|route)$/, '');
    }
    return '/' + route.replace(/\/page$/, '').replace(/\/route$/, '');
  }

  // Expo Router
  const expoMatch = normalized.match(/(?:^|\/)app\/(.+)\.(tsx?|jsx?)$/);
  if (expoMatch && !expoMatch[1]!.includes('_layout')) {
    let route = expoMatch[1]!
      .replace(/\[\.\.\.([^\]]+)\]/g, '*')
      .replace(/\[([^\]]+)\]/g, ':$1')
      .replace(/\/index$/, '');
    return '/' + route;
  }

  return undefined;
}

export function inferDomainFromPath(relativePath: string): string | undefined {
  const normalized = relativePath.replace(/\\/g, '/');

  const patterns = [
    /(?:^|\/)features\/([^/]+)/,
    /(?:^|\/)domains\/([^/]+)/,
    /(?:^|\/)modules\/([^/]+)/,
    /(?:^|\/)server\/([^/]+)/,
    /(?:^|\/)src\/features\/([^/]+)/,
  ];

  for (const pattern of patterns) {
    const match = normalized.match(pattern);
    if (match) {
      return formatDomainName(match[1]!);
    }
  }

  return undefined;
}

export function formatDomainName(raw: string): string {
  return raw
    .replace(/[-_]/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .split(' ')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

export function inferServiceName(relativePath: string, packages: string[]): string | undefined {
  const normalized = relativePath.replace(/\\/g, '/');

  for (const pkg of packages) {
    const pkgNorm = pkg.replace(/\\/g, '/');
    if (normalized.startsWith(pkgNorm + '/') || normalized === pkgNorm) {
      return pkgNorm.split('/').pop() ?? pkgNorm;
    }
  }

  const topLevel = normalized.split('/')[0];
  return topLevel && !topLevel.includes('.') ? topLevel : undefined;
}
