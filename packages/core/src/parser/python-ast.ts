import type { ParsedCall, ParsedImport, ParsedSymbol } from '../types.js';

export interface PythonAstExtraction {
  imports: ParsedImport[];
  symbols: ParsedSymbol[];
  calls: ParsedCall[];
  exports: string[];
}

const CALL_SKIP = new Set([
  'if', 'for', 'while', 'elif', 'else', 'with', 'try', 'except', 'finally', 'return', 'yield',
  'raise', 'assert', 'pass', 'break', 'continue', 'lambda', 'print', 'super', 'self', 'cls',
]);

function lineOf(content: string, index: number): number {
  return content.slice(0, index).split('\n').length;
}

function parseSpecifierList(raw: string): string[] {
  return raw
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const asMatch = part.match(/^([\w.]+)\s+as\s+(\w+)$/);
      if (asMatch) return asMatch[2]!;
      return part.replace(/^\*\s*/, '').trim();
    })
    .filter((s) => s && s !== '*');
}

function normalizeSource(module: string): string {
  return module.replace(/\./g, '/').replace(/^\/+/, '');
}

/**
 * Pure-TypeScript Python source parser. Extracts imports, symbols, calls, and
 * exports via regex — no Python runtime required, so Mnemos analyzes Python
 * repositories without any external interpreter on PATH.
 */
function parsePythonSource(content: string): PythonAstExtraction | null {
  try {
    const imports: ParsedImport[] = [];
    const symbols: ParsedSymbol[] = [];
    const calls: ParsedCall[] = [];
    const exports: string[] = [];
    const seen = new Set<string>();

    const pushSymbol = (
      name: string,
      kind: ParsedSymbol['kind'],
      startLine: number,
      exported: boolean,
    ) => {
      const key = `${kind}:${name}:${startLine}`;
      if (seen.has(key)) return;
      seen.add(key);
      symbols.push({
        name,
        kind,
        startLine,
        endLine: startLine,
        isExported: exported,
        isDefaultExport: false,
      });
      if (exported) exports.push(name);
    };

    const fromParenRe = /from\s+(\.+[\w.]*|[\w.]+)\s+import\s+\(([\s\S]*?)\)/g;
    let match: RegExpExecArray | null;
    while ((match = fromParenRe.exec(content)) !== null) {
      const specs = parseSpecifierList(match[2]!.replace(/\n/g, ' '));
      imports.push({
        source: normalizeSource(match[1]!),
        specifiers: specs.length > 0 ? specs : ['*import*'],
        isTypeOnly: false,
      });
    }

    const fromImportRe = /^(\s*)from\s+(\.+[\w.]*|[\w.]+)\s+import\s+(.+?)(?:\s*#.*)?$/gm;
    while ((match = fromImportRe.exec(content)) !== null) {
      const module = match[2]!;
      const specs = parseSpecifierList(match[3]!);
      imports.push({
        source: normalizeSource(module),
        specifiers: specs.length > 0 ? specs : ['*import*'],
        isTypeOnly: false,
      });
    }

    const importRe = /^(\s*)import\s+(.+?)(?:\s*#.*)?$/gm;
    while ((match = importRe.exec(content)) !== null) {
      const parts = match[2]!.split(',').map((p) => p.trim());
      for (const part of parts) {
        const asMatch = part.match(/^([\w.]+)\s+as\s+(\w+)$/);
        if (asMatch) {
          imports.push({
            source: normalizeSource(asMatch[1]!),
            specifiers: [asMatch[2]!],
            isTypeOnly: false,
          });
        } else {
          const mod = part.trim();
          imports.push({
            source: normalizeSource(mod),
            specifiers: [mod.split('.').pop()!],
            isTypeOnly: false,
          });
        }
      }
    }

    const defRe = /^(\s*)(?:async\s+)?def\s+(\w+)\s*\(/gm;
    while ((match = defRe.exec(content)) !== null) {
      const indent = match[1] ?? '';
      const exported = indent.length === 0;
      pushSymbol(match[2]!, 'function', lineOf(content, match.index), exported);
    }

    const classRe = /^(\s*)class\s+(\w+)/gm;
    while ((match = classRe.exec(content)) !== null) {
      const indent = match[1] ?? '';
      pushSymbol(match[2]!, 'class', lineOf(content, match.index), indent.length === 0);
    }

    const allMatch = content.match(/__all__\s*=\s*\[([\s\S]*?)\]/);
    if (allMatch) {
      for (const name of allMatch[1]!.match(/['"]([\w]+)['"]/g) ?? []) {
        const cleaned = name.replace(/['"]/g, '');
        if (!exports.includes(cleaned)) exports.push(cleaned);
      }
    }

    const callRe = /\b([A-Za-z_][\w.]*)\s*\(/g;
    while ((match = callRe.exec(content)) !== null) {
      const callee = match[1]!;
      const base = callee.split('.')[0]!;
      if (CALL_SKIP.has(base) || CALL_SKIP.has(callee)) continue;
      if (calls.length >= 400) break;
      calls.push({ callee, line: lineOf(content, match.index) });
    }

    return { imports, symbols, calls, exports };
  } catch {
    return null;
  }
}

export function extractPythonAst(content: string): PythonAstExtraction | null {
  return parsePythonSource(content);
}
