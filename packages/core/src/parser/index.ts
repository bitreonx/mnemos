import path from 'node:path';

import { readFile } from 'node:fs/promises';

import type { ParsedCall, ParsedFile, ParsedImport, ParsedSymbol } from '../types.js';

import {

  inferDomainFromPath,

  inferLanguage,

  inferRoutePath,

  isTestFile,

} from '../scanner/index.js';

import { getLanguageTier, parseConfidenceForLanguage } from '../languages/tiers.js';
import { getExtractorProfile, usesLegacyExtractor } from '../languages/index.js';

import {

  extractProfileCalls,

  extractProfileExports,

  extractProfileImports,

  extractProfileSymbols,

} from './profile-extractors.js';

import { prepareAnalyzableSource, isMatchInCode, isImportMatchInCode } from './source-mask.js';
import { extractTsAst } from './ts-ast.js';
import { extractPythonAst } from './python-ast.js';
import { extractGoAst } from './go-ast.js';



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

  const { text, callSafe, codeMask } = prepareAnalyzableSource(content, language);

  let imports: ParsedImport[];
  let symbols: ParsedSymbol[];
  let calls: ParsedCall[];
  let exports: string[];
  let usedAst = false;

  if (language === 'typescript' || language === 'javascript') {
    const ast = extractTsAst(content, relativePath, language);
    if (ast) {
      usedAst = true;
      // The TS AST extractor misses CommonJS `require(...)` calls.
      // Run the regex-based extractor and merge so CommonJS projects
      // (express, koa, nest, etc.) still get file-to-file IMPORTS edges.
      imports = dedupeImports([...ast.imports, ...extractJsImports(text, codeMask)]);
      symbols = ast.symbols;
      calls = ast.calls;
      exports = ast.exports;
    } else {
      imports = extractImports(text, language, codeMask);
      symbols = extractSymbols(text, lines, language, codeMask);
      calls = extractCalls(callSafe, lines, language, codeMask);
      exports = extractExports(text, language, codeMask);
    }
  } else if (language === 'python') {
    const ast = extractPythonAst(content);
    if (ast) {
      usedAst = true;
      imports = ast.imports;
      symbols = ast.symbols;
      calls = ast.calls;
      exports = ast.exports;
    } else {
      imports = extractImports(text, language, codeMask);
      symbols = extractSymbols(text, lines, language, codeMask);
      calls = extractCalls(callSafe, lines, language, codeMask);
      exports = extractExports(text, language, codeMask);
    }
  } else if (language === 'go') {
    const ast = extractGoAst(content);
    if (ast) {
      usedAst = true;
      imports = ast.imports;
      symbols = ast.symbols;
      calls = ast.calls;
      exports = ast.exports;
    } else {
      imports = extractImports(text, language, codeMask);
      symbols = extractSymbols(text, lines, language, codeMask);
      calls = extractCalls(callSafe, lines, language, codeMask);
      exports = extractExports(text, language, codeMask);
    }
  } else {
    imports = extractImports(text, language, codeMask);
    symbols = extractSymbols(text, lines, language, codeMask);
    calls = extractCalls(callSafe, lines, language, codeMask);
    exports = extractExports(text, language, codeMask);
  }

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

      parseTier: getLanguageTier(language),

      parseConfidence: parseConfidenceForLanguage(language, usedAst),

      usedAst,

    },

  };

}



function extractImports(content: string, language: string, codeMask?: Uint8Array): ParsedImport[] {

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

  } else if (language === 'csharp') {

    imports.push(...extractCsharpImports(content));

  } else if (language === 'php') {

    imports.push(...extractPhpImports(content));

  } else if (language === 'ruby') {

    imports.push(...extractRubyImports(content));

  } else if (language === 'kotlin') {

    imports.push(...extractKotlinImports(content));

  } else if (language === 'scala') {

    imports.push(...extractScalaImports(content));

  } else if (language === 'swift') {

    imports.push(...extractSwiftImports(content));

  } else if (language === 'c' || language === 'cpp') {

    imports.push(...extractCImports(content, language));

  } else if (!usesLegacyExtractor(language)) {

    const profile = getExtractorProfile(language);

    if (profile) imports.push(...extractProfileImports(content, profile, codeMask));

    else     imports.push(...extractJsImports(content, codeMask));

  } else {

    imports.push(...extractJsImports(content, codeMask));

  }



  return dedupeImports(imports);

}



function matchImportLine(codeMask: Uint8Array | undefined, content: string, match: RegExpExecArray): boolean {
  if (!codeMask) return true;
  return isImportMatchInCode(codeMask, content, match.index, match[0].length);
}

function extractJsImports(content: string, codeMask?: Uint8Array): ParsedImport[] {

  const imports: ParsedImport[] = [];



  const esmRegex = /import\s+(type\s+)?(?:[\w*{}\s,$]+)\s+from\s+['"]([^'"]+)['"]/g;

  let match: RegExpExecArray | null;

  while ((match = esmRegex.exec(content)) !== null) {
    if (!matchImportLine(codeMask, content, match)) continue;
    imports.push(parseImportBlock(match[0], match[2]!, !!match[1]));
  }

  const dynamicRegex = /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g;

  while ((match = dynamicRegex.exec(content)) !== null) {
    if (!matchImportLine(codeMask, content, match)) continue;
    imports.push({ source: match[1]!, specifiers: ['*dynamic*'], isTypeOnly: false });
  }

  const requireRegex = /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;

  while ((match = requireRegex.exec(content)) !== null) {
    if (!matchImportLine(codeMask, content, match)) continue;
    imports.push({ source: match[1]!, specifiers: ['*require*'], isTypeOnly: false });
  }

  const reExportRegex = /export\s+(?:type\s+)?(?:\{[^}]+\}|\*\s+as\s+\w+)\s+from\s+['"]([^'"]+)['"]/g;

  while ((match = reExportRegex.exec(content)) !== null) {
    if (!matchImportLine(codeMask, content, match)) continue;

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



function extractSymbols(content: string, lines: string[], language: string, codeMask?: Uint8Array): ParsedSymbol[] {

  if (language === 'python') return extractPythonSymbols(content, lines, codeMask);

  if (language === 'go') return extractGoSymbols(content, lines, codeMask);

  if (language === 'rust') return extractRustSymbols(content, lines, codeMask);

  if (language === 'java') return extractJavaSymbols(content, lines, codeMask);

  if (language === 'csharp') return extractCsharpSymbols(content, lines, codeMask);

  if (language === 'php') return extractPhpSymbols(content, lines, codeMask);

  if (language === 'ruby') return extractRubySymbols(content, lines, codeMask);

  if (language === 'kotlin') return extractKotlinSymbols(content, lines, codeMask);

  if (language === 'scala') return extractScalaSymbols(content, lines, codeMask);

  if (language === 'swift') return extractSwiftSymbols(content, lines, codeMask);

  if (language === 'c' || language === 'cpp') return extractCSymbols(content, lines, language, codeMask);

  if (!usesLegacyExtractor(language)) {

    const profile = getExtractorProfile(language);

    if (profile) return extractProfileSymbols(content, lines, profile, codeMask);

  }

  return extractJsSymbols(content, lines, codeMask);

}



function extractJsSymbols(content: string, lines: string[], codeMask?: Uint8Array): ParsedSymbol[] {

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



  addSymbolsFromPatterns(content, lines, patterns, symbols, codeMask);

  return symbols;

}



function extractPythonSymbols(content: string, lines: string[], codeMask?: Uint8Array): ParsedSymbol[] {

  const symbols: ParsedSymbol[] = [];

  const patterns: Array<{ regex: RegExp; kind: ParsedSymbol['kind'] }> = [

    { regex: /^(?:async\s+)?def\s+(\w+)\s*\(/gm, kind: 'function' },

    { regex: /^class\s+(\w+)/gm, kind: 'class' },

  ];

  addSymbolsFromPatterns(content, lines, patterns, symbols, codeMask);

  return symbols;

}



function extractGoSymbols(content: string, lines: string[], codeMask?: Uint8Array): ParsedSymbol[] {

  const symbols: ParsedSymbol[] = [];

  const patterns: Array<{ regex: RegExp; kind: ParsedSymbol['kind'] }> = [

    { regex: /^func\s+(?:\(\w+\s+\*?\w+\)\s+)?(\w+)\s*\(/gm, kind: 'function' },

    { regex: /^type\s+(\w+)\s+struct/gm, kind: 'class' },

    { regex: /^type\s+(\w+)\s+interface/gm, kind: 'interface' },

  ];

  addSymbolsFromPatterns(content, lines, patterns, symbols, codeMask);

  return symbols;

}



function extractRustSymbols(content: string, lines: string[], codeMask?: Uint8Array): ParsedSymbol[] {

  const symbols: ParsedSymbol[] = [];

  const patterns: Array<{ regex: RegExp; kind: ParsedSymbol['kind'] }> = [

    { regex: /(?:pub\s+)?fn\s+(\w+)/g, kind: 'function' },

    { regex: /(?:pub\s+)?struct\s+(\w+)/g, kind: 'class' },

    { regex: /(?:pub\s+)?trait\s+(\w+)/g, kind: 'interface' },

    { regex: /(?:pub\s+)?enum\s+(\w+)/g, kind: 'type' },

    { regex: /impl(?:<[^>]+>)?\s+(\w+)/g, kind: 'class' },

  ];

  addSymbolsFromPatterns(content, lines, patterns, symbols, codeMask);

  return symbols;

}



function extractJavaSymbols(content: string, lines: string[], codeMask?: Uint8Array): ParsedSymbol[] {

  const symbols: ParsedSymbol[] = [];

  const patterns: Array<{ regex: RegExp; kind: ParsedSymbol['kind'] }> = [

    { regex: /(?:public|private|protected)\s+(?:static\s+)?(?:[\w<>,\s]+)\s+(\w+)\s*\(/g, kind: 'function' },

    { regex: /(?:public|private|protected)?\s*(?:abstract\s+)?class\s+(\w+)/g, kind: 'class' },

    { regex: /(?:public|private|protected)?\s*interface\s+(\w+)/g, kind: 'interface' },

  ];

  addSymbolsFromPatterns(content, lines, patterns, symbols, codeMask);

  return symbols;

}



function addSymbolsFromPatterns(

  content: string,

  lines: string[],

  patterns: Array<{ regex: RegExp; kind: ParsedSymbol['kind'] }>,

  symbols: ParsedSymbol[],

  codeMask?: Uint8Array,

): void {

  for (const { regex, kind } of patterns) {

    regex.lastIndex = 0;

    let match: RegExpExecArray | null;

    while ((match = regex.exec(content)) !== null) {

      if (codeMask && !isMatchInCode(codeMask, content, match.index, match[0].length)) continue;

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



function extractCalls(content: string, lines: string[], language: string, codeMask?: Uint8Array): ParsedCall[] {

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

  if (!usesLegacyExtractor(language)) {

    const profile = getExtractorProfile(language);

    if (profile) return extractProfileCalls(content, profile, codeMask);

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



function extractExports(content: string, language: string, codeMask?: Uint8Array): string[] {

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

  if (!usesLegacyExtractor(language)) {

    const profile = getExtractorProfile(language);

    if (profile) return extractProfileExports(content, profile, codeMask);

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



function extractCsharpImports(content: string): ParsedImport[] {

  const imports: ParsedImport[] = [];

  const regex = /using\s+(?:static\s+)?([\w.]+)\s*;/g;

  let match: RegExpExecArray | null;

  while ((match = regex.exec(content)) !== null) {

    if (match[1]!.startsWith('System.')) continue;

    imports.push({ source: match[1]!.replace(/\./g, '/'), specifiers: [match[1]!.split('.').pop()!], isTypeOnly: false });

  }

  return imports;

}



function extractPhpImports(content: string): ParsedImport[] {

  const imports: ParsedImport[] = [];

  const useRegex = /use\s+([\w\\]+)(?:\s+as\s+(\w+))?\s*;/g;

  let match: RegExpExecArray | null;

  while ((match = useRegex.exec(content)) !== null) {

    imports.push({ source: match[1]!.replace(/\\/g, '/'), specifiers: [match[2] ?? match[1]!.split('\\').pop()!], isTypeOnly: false });

  }

  const requireRegex = /(?:require|include)(?:_once)?\s*[\(\s]+['"]([^'"]+)['"]/g;

  while ((match = requireRegex.exec(content)) !== null) {

    imports.push({ source: match[1]!, specifiers: ['*require*'], isTypeOnly: false });

  }

  return imports;

}



function extractRubyImports(content: string): ParsedImport[] {

  const imports: ParsedImport[] = [];

  const regex = /(?:require|require_relative)\s+['"]([^'"]+)['"]/g;

  let match: RegExpExecArray | null;

  while ((match = regex.exec(content)) !== null) {

    imports.push({ source: match[1]!, specifiers: [pathBasename(match[1]!)], isTypeOnly: false });

  }

  return imports;

}



function extractKotlinImports(content: string): ParsedImport[] {

  const imports: ParsedImport[] = [];

  const regex = /^import\s+([\w.]+)/gm;

  let match: RegExpExecArray | null;

  while ((match = regex.exec(content)) !== null) {

    imports.push({ source: match[1]!.replace(/\./g, '/'), specifiers: [match[1]!.split('.').pop()!], isTypeOnly: false });

  }

  return imports;

}



function extractScalaImports(content: string): ParsedImport[] {

  const imports: ParsedImport[] = [];

  const regex = /^import\s+([\w.{}\s,]+)/gm;

  let match: RegExpExecArray | null;

  while ((match = regex.exec(content)) !== null) {

    imports.push({ source: match[1]!.replace(/\./g, '/').replace(/\{|\}/g, ''), specifiers: ['*import*'], isTypeOnly: false });

  }

  return imports;

}



function extractSwiftImports(content: string): ParsedImport[] {

  const imports: ParsedImport[] = [];

  const regex = /^import\s+(?:class\s+)?([\w.]+)/gm;

  let match: RegExpExecArray | null;

  while ((match = regex.exec(content)) !== null) {

    imports.push({ source: match[1]!, specifiers: [match[1]!], isTypeOnly: false });

  }

  return imports;

}



function extractCImports(content: string, language: string): ParsedImport[] {

  const imports: ParsedImport[] = [];

  const includeRegex = /#include\s+[<"]([^>"]+)[>"]/g;

  let match: RegExpExecArray | null;

  while ((match = includeRegex.exec(content)) !== null) {

    imports.push({ source: match[1]!, specifiers: [pathBasename(match[1]!)], isTypeOnly: false });

  }

  if (language === 'cpp') {

    const usingRegex = /using\s+namespace\s+([\w:]+)\s*;/g;

    while ((match = usingRegex.exec(content)) !== null) {

      imports.push({ source: match[1]!.replace(/::/g, '/'), specifiers: ['*namespace*'], isTypeOnly: false });

    }

  }

  return imports;

}



function extractCsharpSymbols(content: string, lines: string[], codeMask?: Uint8Array): ParsedSymbol[] {

  const patterns: Array<{ regex: RegExp; kind: ParsedSymbol['kind'] }> = [

    { regex: /(?:public|private|protected|internal)\s+(?:static\s+)?(?:partial\s+)?class\s+(\w+)/g, kind: 'class' },

    { regex: /(?:public|private|protected|internal)\s+(?:partial\s+)?interface\s+(\w+)/g, kind: 'interface' },

    { regex: /(?:public|private|protected|internal)\s+(?:partial\s+)?struct\s+(\w+)/g, kind: 'class' },

    { regex: /(?:public|private|protected|internal)\s+(?:static\s+)?(?:[\w<>,\[\]\s]+)\s+(\w+)\s*\(/g, kind: 'function' },

  ];

  const symbols: ParsedSymbol[] = [];

  addSymbolsFromPatterns(content, lines, patterns, symbols, codeMask);

  return symbols;

}



function extractPhpSymbols(content: string, lines: string[], codeMask?: Uint8Array): ParsedSymbol[] {

  const patterns: Array<{ regex: RegExp; kind: ParsedSymbol['kind'] }> = [

    { regex: /(?:abstract\s+)?class\s+(\w+)/g, kind: 'class' },

    { regex: /interface\s+(\w+)/g, kind: 'interface' },

    { regex: /trait\s+(\w+)/g, kind: 'interface' },

    { regex: /function\s+(\w+)\s*\(/g, kind: 'function' },

  ];

  const symbols: ParsedSymbol[] = [];

  addSymbolsFromPatterns(content, lines, patterns, symbols, codeMask);

  return symbols;

}



function extractRubySymbols(content: string, lines: string[], codeMask?: Uint8Array): ParsedSymbol[] {

  const patterns: Array<{ regex: RegExp; kind: ParsedSymbol['kind'] }> = [

    { regex: /^class\s+(\w+)/gm, kind: 'class' },

    { regex: /^module\s+(\w+)/gm, kind: 'interface' },

    { regex: /def\s+(?:self\.)?(\w+)/g, kind: 'function' },

  ];

  const symbols: ParsedSymbol[] = [];

  addSymbolsFromPatterns(content, lines, patterns, symbols, codeMask);

  return symbols;

}



function extractKotlinSymbols(content: string, lines: string[], codeMask?: Uint8Array): ParsedSymbol[] {

  const patterns: Array<{ regex: RegExp; kind: ParsedSymbol['kind'] }> = [

    { regex: /(?:data\s+)?class\s+(\w+)/g, kind: 'class' },

    { regex: /interface\s+(\w+)/g, kind: 'interface' },

    { regex: /object\s+(\w+)/g, kind: 'class' },

    { regex: /fun\s+(\w+)\s*\(/g, kind: 'function' },

  ];

  const symbols: ParsedSymbol[] = [];

  addSymbolsFromPatterns(content, lines, patterns, symbols, codeMask);

  return symbols;

}



function extractScalaSymbols(content: string, lines: string[], codeMask?: Uint8Array): ParsedSymbol[] {

  const patterns: Array<{ regex: RegExp; kind: ParsedSymbol['kind'] }> = [

    { regex: /(?:case\s+)?class\s+(\w+)/g, kind: 'class' },

    { regex: /trait\s+(\w+)/g, kind: 'interface' },

    { regex: /object\s+(\w+)/g, kind: 'class' },

    { regex: /def\s+(\w+)\s*[\(:]/g, kind: 'function' },

  ];

  const symbols: ParsedSymbol[] = [];

  addSymbolsFromPatterns(content, lines, patterns, symbols, codeMask);

  return symbols;

}



function extractSwiftSymbols(content: string, lines: string[], codeMask?: Uint8Array): ParsedSymbol[] {

  const patterns: Array<{ regex: RegExp; kind: ParsedSymbol['kind'] }> = [

    { regex: /(?:public\s+|private\s+|internal\s+)?class\s+(\w+)/g, kind: 'class' },

    { regex: /(?:public\s+|private\s+|internal\s+)?struct\s+(\w+)/g, kind: 'class' },

    { regex: /(?:public\s+|private\s+|internal\s+)?protocol\s+(\w+)/g, kind: 'interface' },

    { regex: /(?:public\s+|private\s+|internal\s+)?enum\s+(\w+)/g, kind: 'type' },

    { regex: /func\s+(\w+)\s*\(/g, kind: 'function' },

  ];

  const symbols: ParsedSymbol[] = [];

  addSymbolsFromPatterns(content, lines, patterns, symbols, codeMask);

  return symbols;

}



function extractCSymbols(content: string, lines: string[], language: string, codeMask?: Uint8Array): ParsedSymbol[] {

  const patterns: Array<{ regex: RegExp; kind: ParsedSymbol['kind'] }> = [

    { regex: /struct\s+(\w+)/g, kind: 'class' },

    { regex: /(?:^|\n)\s*(?:static\s+)?[\w\s*]+\s+(\w+)\s*\([^;]*\)\s*\{/gm, kind: 'function' },

  ];

  if (language === 'cpp') {

    patterns.unshift({ regex: /class\s+(\w+)/g, kind: 'class' });

  }

  const symbols: ParsedSymbol[] = [];

  addSymbolsFromPatterns(content, lines, patterns, symbols, codeMask);

  return symbols;

}



export async function parseFiles(

  files: string[],

  root: string,

  onProgress?: (done: number, total: number) => void,

): Promise<ParsedFile[]> {

  const results: ParsedFile[] = [];

  const batchSize = 256;



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

  const toParse: string[] = [];

  for (const file of files) {

    const relativePath = path.relative(root, file).replace(/\\/g, '/');

    if (!changedPaths.has(relativePath) && cachedParsed.has(relativePath)) {

      results.push(cachedParsed.get(relativePath)!);

    } else {

      toParse.push(file);

    }

  }

  const batchSize = 256;

  for (let i = 0; i < toParse.length; i += batchSize) {

    const batch = toParse.slice(i, i + batchSize);

    const parsed = await Promise.all(batch.map((f) => parseFile(f, root)));

    for (const p of parsed) {

      if (p) results.push(p);

    }

    onProgress?.(results.length, files.length);

  }

  onProgress?.(files.length, files.length);

  return results;

}


