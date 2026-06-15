import path from 'node:path';

import { readFile } from 'node:fs/promises';

import type { ParsedCall, ParsedFile, ParsedImport, ParsedSymbol } from '../types.js';

import {

  inferDomainFromPath,

  inferLanguage,

  inferRoutePath,

  isTestFile,

} from '../scanner/index.js';



export async function parseFile(

  absolutePath: string,

  root: string,

): Promise<ParsedFile | null> {

  const relativePath = path.relative(root, absolutePath).replace(/\\/g, '/');

  const language = inferLanguage(absolutePath);



  let content: string;

  try {

    content = await readFile(absolutePath, 'utf-8');

  } catch {

    return null;

  }



  if (content.length > 1_000_000) {

    content = content.slice(0, 1_000_000);

  }



  return parseContent(content, absolutePath, relativePath, language);

}



export function parseContent(

  content: string,

  absolutePath: string,

  relativePath: string,

  language: string,

): ParsedFile {

  const lines = content.split('\n');

  const imports = extractImports(content, language);

  const symbols = extractSymbols(content, lines, language);

  const calls = extractCalls(content, lines, language);

  const exports = extractExports(content, language);

  const hasUseServer = content.includes("'use server'") || content.includes('"use server"');

  const routePath = inferRoutePath(relativePath);



  if (routePath) {

    symbols.push({

      name: routePath,

      kind: 'route',

      startLine: 1,

      endLine: 1,

      isExported: true,

      isDefaultExport: false,

    });

  }



  return {

    path: absolutePath,

    relativePath,

    language,

    symbols,

    imports,

    calls,

    exports,

    isTest: isTestFile(relativePath),

    isRoute: !!routePath,

    routePath,

    hasUseServer,

    metadata: {

      domainHint: inferDomainFromPath(relativePath),

      lineCount: lines.length,

    },

  };

}



function extractImports(content: string, language: string): ParsedImport[] {

  const imports: ParsedImport[] = [];



  if (language === 'typescript' || language === 'javascript') {

    imports.push(...extractJsImports(content));

  } else if (language === 'python') {

    imports.push(...extractPythonImports(content));

  } else if (language === 'go') {

    imports.push(...extractGoImports(content));

  } else if (language === 'rust') {

    imports.push(...extractRustImports(content));

  } else if (language === 'java') {

    imports.push(...extractJavaImports(content));

  } else {

    imports.push(...extractJsImports(content));

  }



  return dedupeImports(imports);

}



function extractJsImports(content: string): ParsedImport[] {

  const imports: ParsedImport[] = [];



  const esmRegex = /import\s+(type\s+)?(?:[\w*{}\s,$]+)\s+from\s+['"]([^'"]+)['"]/g;

  let match: RegExpExecArray | null;

  while ((match = esmRegex.exec(content)) !== null) {

    imports.push(parseImportBlock(match[0], match[2]!, !!match[1]));

  }



  const dynamicRegex = /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g;

  while ((match = dynamicRegex.exec(content)) !== null) {

    imports.push({ source: match[1]!, specifiers: ['*dynamic*'], isTypeOnly: false });

  }



  const requireRegex = /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;

  while ((match = requireRegex.exec(content)) !== null) {

    imports.push({ source: match[1]!, specifiers: ['*require*'], isTypeOnly: false });

  }



  const reExportRegex = /export\s+(?:type\s+)?(?:\{[^}]+\}|\*\s+as\s+\w+)\s+from\s+['"]([^'"]+)['"]/g;

  while ((match = reExportRegex.exec(content)) !== null) {

    imports.push({ source: match[1]!, specifiers: ['*reexport*'], isTypeOnly: false });

  }



  return imports;

}



function parseImportBlock(block: string, source: string, isTypeOnly: boolean): ParsedImport {

  const specifiers: string[] = [];

  const specMatch = block.match(/\{([^}]+)\}/);

  if (specMatch) {

    for (const s of specMatch[1]!.split(',')) {

      const name = s.trim().split(/\s+as\s+/).pop()?.trim();

      if (name && name !== 'type') specifiers.push(name);

    }

  }

  const defaultMatch = block.match(/import\s+(?:type\s+)?(\w+)\s+from/);

  if (defaultMatch && !block.includes('{')) {

    specifiers.push(defaultMatch[1]!);

  }

  const namespaceMatch = block.match(/import\s+\*\s+as\s+(\w+)/);

  if (namespaceMatch) specifiers.push(namespaceMatch[1]!);

  return { source, specifiers, isTypeOnly };

}



function extractPythonImports(content: string): ParsedImport[] {

  const imports: ParsedImport[] = [];

  const fromRegex = /from\s+([\w.]+)\s+import\s+([\w.,\s*]+)/g;

  let match: RegExpExecArray | null;

  while ((match = fromRegex.exec(content)) !== null) {

    imports.push({

      source: match[1]!.replace(/\./g, '/'),

      specifiers: match[2]!.split(',').map((s) => s.trim().split(/\s+as\s+/).pop()!.trim()),

      isTypeOnly: false,

    });

  }

  const importRegex = /^import\s+([\w.]+)/gm;

  while ((match = importRegex.exec(content)) !== null) {

    imports.push({ source: match[1]!.replace(/\./g, '/'), specifiers: [match[1]!.split('.').pop()!], isTypeOnly: false });

  }

  return imports;

}



function extractGoImports(content: string): ParsedImport[] {

  const imports: ParsedImport[] = [];

  const blockMatch = content.match(/import\s*\(([\s\S]*?)\)/);

  if (blockMatch) {

    const singleRegex = /["']([^"']+)["']/g;

    let match: RegExpExecArray | null;

    while ((match = singleRegex.exec(blockMatch[1]!)) !== null) {

      imports.push({ source: match[1]!, specifiers: [pathBasename(match[1]!)], isTypeOnly: false });

    }

  }

  const singleImport = content.match(/import\s+"([^"]+)"/);

  if (singleImport) {

    imports.push({ source: singleImport[1]!, specifiers: [pathBasename(singleImport[1]!)], isTypeOnly: false });

  }

  return imports;

}



function extractRustImports(content: string): ParsedImport[] {

  const imports: ParsedImport[] = [];

  const useRegex = /use\s+([\w:{}\s*,]+)\s*;/g;

  let match: RegExpExecArray | null;

  while ((match = useRegex.exec(content)) !== null) {

    const parts = match[1]!.split('::');

    imports.push({ source: parts.slice(0, -1).join('/'), specifiers: [parts[parts.length - 1]!.replace(/\{|\}/g, '')], isTypeOnly: false });

  }

  return imports;

}



function extractJavaImports(content: string): ParsedImport[] {

  const imports: ParsedImport[] = [];

  const regex = /import\s+(?:static\s+)?([\w.]+);/g;

  let match: RegExpExecArray | null;

  while ((match = regex.exec(content)) !== null) {

    if (match[1]!.startsWith('java.') || match[1]!.startsWith('javax.')) continue;

    imports.push({

      source: match[1]!.replace(/\./g, '/'),

      specifiers: [match[1]!.split('.').pop()!],

      isTypeOnly: false,

    });

  }

  return imports;

}



function pathBasename(p: string): string {

  const parts = p.split('/');

  return parts[parts.length - 1] ?? p;

}



function dedupeImports(imports: ParsedImport[]): ParsedImport[] {

  const seen = new Set<string>();

  return imports.filter((imp) => {

    const key = `${imp.source}:${imp.specifiers.join(',')}`;

    if (seen.has(key)) return false;

    seen.add(key);

    return true;

  });

}



function extractSymbols(content: string, lines: string[], language: string): ParsedSymbol[] {

  if (language === 'python') return extractPythonSymbols(content, lines);

  if (language === 'go') return extractGoSymbols(content, lines);

  if (language === 'rust') return extractRustSymbols(content, lines);

  if (language === 'java') return extractJavaSymbols(content, lines);

  return extractJsSymbols(content, lines);

}



function extractJsSymbols(content: string, lines: string[]): ParsedSymbol[] {

  const symbols: ParsedSymbol[] = [];

  const patterns: Array<{ regex: RegExp; kind: ParsedSymbol['kind'] }> = [

    { regex: /export\s+(?:default\s+)?(?:async\s+)?function\s+(\w+)/g, kind: 'function' },

    { regex: /(?:export\s+)?(?:async\s+)?function\s+(\w+)/g, kind: 'function' },

    { regex: /export\s+(?:default\s+)?class\s+(\w+)/g, kind: 'class' },

    { regex: /(?:export\s+)?class\s+(\w+)/g, kind: 'class' },

    { regex: /export\s+(?:default\s+)?interface\s+(\w+)/g, kind: 'interface' },

    { regex: /(?:export\s+)?interface\s+(\w+)/g, kind: 'interface' },

    { regex: /export\s+type\s+(\w+)/g, kind: 'type' },

    { regex: /export\s+const\s+(\w+)\s*=\s*(?:async\s*)?\(/g, kind: 'function' },

    { regex: /export\s+(?:default\s+)?(?:async\s+)?(\w+)\s*=\s*(?:async\s*)?\([^)]*\)\s*=>/g, kind: 'function' },

    { regex: /export\s+(?:default\s+)?(?:async\s+)?function\s+(\w+)/g, kind: 'function' },

  ];



  addSymbolsFromPatterns(content, lines, patterns, symbols);

  return symbols;

}



function extractPythonSymbols(content: string, lines: string[]): ParsedSymbol[] {

  const symbols: ParsedSymbol[] = [];

  const patterns: Array<{ regex: RegExp; kind: ParsedSymbol['kind'] }> = [

    { regex: /^(?:async\s+)?def\s+(\w+)\s*\(/gm, kind: 'function' },

    { regex: /^class\s+(\w+)/gm, kind: 'class' },

  ];

  addSymbolsFromPatterns(content, lines, patterns, symbols);

  return symbols;

}



function extractGoSymbols(content: string, lines: string[]): ParsedSymbol[] {

  const symbols: ParsedSymbol[] = [];

  const patterns: Array<{ regex: RegExp; kind: ParsedSymbol['kind'] }> = [

    { regex: /^func\s+(?:\(\w+\s+\*?\w+\)\s+)?(\w+)\s*\(/gm, kind: 'function' },

    { regex: /^type\s+(\w+)\s+struct/gm, kind: 'class' },

    { regex: /^type\s+(\w+)\s+interface/gm, kind: 'interface' },

  ];

  addSymbolsFromPatterns(content, lines, patterns, symbols);

  return symbols;

}



function extractRustSymbols(content: string, lines: string[]): ParsedSymbol[] {

  const symbols: ParsedSymbol[] = [];

  const patterns: Array<{ regex: RegExp; kind: ParsedSymbol['kind'] }> = [

    { regex: /(?:pub\s+)?fn\s+(\w+)/g, kind: 'function' },

    { regex: /(?:pub\s+)?struct\s+(\w+)/g, kind: 'class' },

    { regex: /(?:pub\s+)?trait\s+(\w+)/g, kind: 'interface' },

    { regex: /(?:pub\s+)?enum\s+(\w+)/g, kind: 'type' },

    { regex: /impl(?:<[^>]+>)?\s+(\w+)/g, kind: 'class' },

  ];

  addSymbolsFromPatterns(content, lines, patterns, symbols);

  return symbols;

}



function extractJavaSymbols(content: string, lines: string[]): ParsedSymbol[] {

  const symbols: ParsedSymbol[] = [];

  const patterns: Array<{ regex: RegExp; kind: ParsedSymbol['kind'] }> = [

    { regex: /(?:public|private|protected)\s+(?:static\s+)?(?:[\w<>,\s]+)\s+(\w+)\s*\(/g, kind: 'function' },

    { regex: /(?:public|private|protected)?\s*(?:abstract\s+)?class\s+(\w+)/g, kind: 'class' },

    { regex: /(?:public|private|protected)?\s*interface\s+(\w+)/g, kind: 'interface' },

  ];

  addSymbolsFromPatterns(content, lines, patterns, symbols);

  return symbols;

}



function addSymbolsFromPatterns(

  content: string,

  lines: string[],

  patterns: Array<{ regex: RegExp; kind: ParsedSymbol['kind'] }>,

  symbols: ParsedSymbol[],

): void {

  for (const { regex, kind } of patterns) {

    regex.lastIndex = 0;

    let match: RegExpExecArray | null;

    while ((match = regex.exec(content)) !== null) {

      const name = match[1]!;

      const lineNum = content.slice(0, match.index).split('\n').length;

      const line = lines[lineNum - 1] ?? '';

      if (symbols.some((s) => s.name === name && s.kind === kind)) continue;

      symbols.push({

        name,

        kind,

        startLine: lineNum,

        endLine: lineNum,

        isExported: line.includes('export') || line.includes('pub ') || line.startsWith('public'),

        isDefaultExport: line.includes('export default'),

      });

    }

  }

}



function extractCalls(content: string, lines: string[], language: string): ParsedCall[] {

  const calls: ParsedCall[] = [];

  const skip = new Set(['if', 'for', 'while', 'switch', 'catch', 'function', 'return', 'new', 'typeof', 'instanceof']);



  if (language === 'python') {

    const regex = /(\w+)\s*\(/g;

    let match: RegExpExecArray | null;

    while ((match = regex.exec(content)) !== null) {

      if (skip.has(match[1]!)) continue;

      calls.push({ callee: match[1]!, line: content.slice(0, match.index).split('\n').length });

    }

    return calls.slice(0, 300);

  }



  const regex = /(?:await\s+)?(\w+(?:\.\w+)*)\s*\(/g;

  let match: RegExpExecArray | null;

  while ((match = regex.exec(content)) !== null) {

    const callee = match[1]!;

    const base = callee.split('.')[0]!;

    if (skip.has(base)) continue;

    calls.push({ callee, line: content.slice(0, match.index).split('\n').length });

  }



  return calls.slice(0, 300);

}



function extractExports(content: string, language: string): string[] {

  if (language === 'python') {

    const exports: string[] = [];

    if (content.includes('__all__')) {

      const allMatch = content.match(/__all__\s*=\s*\[([^\]]+)\]/);

      if (allMatch) {

        for (const name of allMatch[1]!.split(',')) {

          exports.push(name.trim().replace(/['"]/g, ''));

        }

      }

    }

    return exports;

  }



  const exports: string[] = [];

  const regex = /export\s+(?:async\s+)?(?:function|class|const|let|var|type|interface)\s+(\w+)/g;

  let match: RegExpExecArray | null;

  while ((match = regex.exec(content)) !== null) {

    exports.push(match[1]!);

  }

  if (content.includes('export default')) exports.push('default');

  return exports;

}



export async function parseFiles(

  files: string[],

  root: string,

  onProgress?: (done: number, total: number) => void,

): Promise<ParsedFile[]> {

  const results: ParsedFile[] = [];

  const batchSize = 100;



  for (let i = 0; i < files.length; i += batchSize) {

    const batch = files.slice(i, i + batchSize);

    const parsed = await Promise.all(batch.map((f) => parseFile(f, root)));

    for (const p of parsed) {

      if (p) results.push(p);

    }

    onProgress?.(Math.min(i + batchSize, files.length), files.length);

  }



  return results;

}



export async function parseFilesIncremental(

  files: string[],

  root: string,

  cachedParsed: Map<string, ParsedFile>,

  changedPaths: Set<string>,

  onProgress?: (done: number, total: number) => void,

): Promise<ParsedFile[]> {

  const results: ParsedFile[] = [];

  let done = 0;



  for (const file of files) {

    const relativePath = path.relative(root, file).replace(/\\/g, '/');

    if (!changedPaths.has(relativePath) && cachedParsed.has(relativePath)) {

      results.push(cachedParsed.get(relativePath)!);

    } else {

      const parsed = await parseFile(file, root);

      if (parsed) results.push(parsed);

    }

    done++;

    if (done % 100 === 0) onProgress?.(done, files.length);

  }



  onProgress?.(files.length, files.length);

  return results;

}


