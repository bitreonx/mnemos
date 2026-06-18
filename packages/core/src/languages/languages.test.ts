import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  SUPPORTED_LANGUAGE_COUNT,
  LANGUAGE_DEFINITIONS,
  inferLanguage,
  getExtractorProfile,
} from '../languages/index.js';
import { parseContent } from '../parser/index.js';
import { maskCommentsAndStrings, maskOutsideScriptRegions, prepareAnalyzableSource, isMatchInCode, isImportMatchInCode } from '../parser/source-mask.js';
import { buildRepositoryLanguagesMarkdown } from './docs.js';

describe('language support', () => {
  it('supports at least 40 programming languages', () => {
    assert.ok(SUPPORTED_LANGUAGE_COUNT >= 40, `expected >= 40, got ${SUPPORTED_LANGUAGE_COUNT}`);
  });

  it('infers common extensions and special basenames', () => {
    assert.equal(inferLanguage('app/main.py'), 'python');
    assert.equal(inferLanguage('src/lib.rs'), 'rust');
    assert.equal(inferLanguage('service/main.go'), 'go');
    assert.equal(inferLanguage('App.vue'), 'vue');
    assert.equal(inferLanguage('Dockerfile'), 'dockerfile');
    assert.equal(inferLanguage('Makefile'), 'makefile');
    assert.equal(inferLanguage('CMakeLists.txt'), 'cmake');
    assert.equal(inferLanguage('contract.sol'), 'solidity');
    assert.equal(inferLanguage('infra/main.tf'), 'terraform');
    assert.equal(inferLanguage('unknown.xyz'), 'unknown');
  });

  it('every non-legacy language has an extractor profile', () => {
    const legacy = new Set([
      'typescript', 'javascript', 'python', 'go', 'rust', 'java', 'csharp',
      'php', 'ruby', 'kotlin', 'scala', 'swift', 'c', 'cpp',
    ]);
    for (const def of LANGUAGE_DEFINITIONS) {
      if (legacy.has(def.id)) continue;
      assert.ok(getExtractorProfile(def.id), `missing profile for ${def.id}`);
    }
  });

  it('parses dart imports and symbols', () => {
    const content = `
import 'package:flutter/material.dart';
class HomePage extends StatelessWidget {
  void build() {}
}
`;
    const parsed = parseContent(content, '/tmp/home.dart', 'lib/home.dart', 'dart');
    assert.ok(parsed.imports.some((i) => i.source.includes('flutter')));
    assert.ok(parsed.symbols.some((s) => s.name === 'HomePage' && s.kind === 'class'));
    assert.ok(parsed.symbols.some((s) => s.name === 'build' && s.kind === 'function'));
  });

  it('parses elixir modules and functions with dotted module names', () => {
    const content = `
defmodule MyApp.User do
  use Ecto.Schema
  def create(attrs), do: attrs
end
`;
    const parsed = parseContent(content, '/tmp/user.ex', 'lib/user.ex', 'elixir');
    assert.ok(parsed.symbols.some((s) => s.name === 'MyApp.User'));
    assert.ok(parsed.symbols.some((s) => s.name === 'create'));
  });

  it('parses dockerfile stages and dependency edges', () => {
    const content = `
FROM node:20-alpine AS builder
RUN npm ci
FROM builder AS runtime
COPY --from=builder /app/dist ./dist
`;
    const parsed = parseContent(content, '/tmp/Dockerfile', 'Dockerfile', 'dockerfile');
    assert.ok(parsed.imports.some((i) => i.source.includes('node')));
    assert.ok(parsed.imports.some((i) => i.source === 'builder'));
    assert.ok(parsed.symbols.some((s) => s.name === 'builder'));
    assert.ok(parsed.symbols.some((s) => s.name === 'runtime'));
  });

  it('parses terraform resources with composite names', () => {
    const content = `
resource "aws_s3_bucket" "assets" {
  bucket = "my-bucket"
}
output "bucket_name" {
  value = aws_s3_bucket.assets.bucket
}
`;
    const parsed = parseContent(content, '/tmp/main.tf', 'infra/main.tf', 'terraform');
    assert.ok(parsed.symbols.some((s) => s.name === 'aws_s3_bucket.assets'));
    assert.ok(parsed.symbols.some((s) => s.name === 'bucket_name'));
  });

  it('ignores imports inside comments and strings', () => {
    const dart = `
// import 'fake/comment.dart';
class A {}
/* import 'fake/block.dart'; */
const hint = "import 'fake/string.dart'";
import 'real/target.dart';
`;
    const parsed = parseContent(dart, '/tmp/a.dart', 'lib/a.dart', 'dart');
    assert.equal(parsed.imports.length, 1);
    assert.ok(parsed.imports[0]!.source.includes('real/target'));
  });

  it('parses vue script blocks only, not template text', () => {
    const vue = `
<template>
  <div import="not-an-import">import fake from 'template'</div>
</template>
<script setup lang="ts">
import { ref } from 'vue';
function useCounter() { return ref(0); }
</script>
`;
    const parsed = parseContent(vue, '/tmp/App.vue', 'src/App.vue', 'vue');
    assert.ok(parsed.imports.some((i) => i.source === 'vue'));
    assert.equal(parsed.imports.some((i) => i.source.includes('fake')), false);
    assert.ok(parsed.symbols.some((s) => s.name === 'useCounter'));
  });

  it('does not treat keywords as call targets', () => {
    const zig = `
const std = @import("std");
pub fn main() void {
    if (true) return;
    std.debug.print("hi\\n", .{});
}
`;
    const parsed = parseContent(zig, '/tmp/main.zig', 'src/main.zig', 'zig');
    assert.ok(parsed.calls.some((c) => c.callee === 'std.debug.print'));
    assert.equal(parsed.calls.some((c) => c.callee === 'if'), false);
    assert.equal(parsed.calls.some((c) => c.callee === 'return'), false);
  });

  it('deduplicates repeated profile imports', () => {
    const content = `
import 'package:flutter/material.dart';
import 'package:flutter/material.dart';
`;
    const parsed = parseContent(content, '/tmp/a.dart', 'src/a.dart', 'dart');
    assert.equal(parsed.imports.length, 1);
    assert.ok(parsed.imports[0]!.source.includes('flutter'));
  });

  it('buildRepositoryLanguagesMarkdown includes mermaid charts', () => {
    const md = buildRepositoryLanguagesMarkdown({
      repository: 'demo',
      builtAt: new Date().toISOString(),
      architecture: {
        name: 'demo',
        type: 'Monorepo',
        summary: 'test',
        layers: [],
        packages: [],
        languages: { typescript: 10, python: 3, go: 2 },
      },
      domains: [],
      flows: [],
      services: [],
      apis: [],
      dependencies: [],
      criticalPaths: [],
      deadCode: [],
      smells: [],
      capabilities: [],
      journeys: [],
      stats: {
        filesScanned: 15,
        nodesCreated: 1,
        edgesCreated: 1,
        domainsFound: 0,
        flowsFound: 0,
        durationMs: 1,
      },
    });

    assert.match(md, /```mermaid/);
    assert.match(md, /pie showData/);
    assert.match(md, /typescript/);
    assert.match(md, /Mnemos parsing pipeline/);
  });

  it('uses TypeScript AST for re-exports and call sites', () => {
    const content = `
import { auth } from './auth';
export { loginHandler } from './handlers';
export const createUser = async (name: string) => auth.register(name);
export class UserService {
  find(id: string) { return auth.lookup(id); }
}
`;
    const parsed = parseContent(content, '/tmp/user.ts', 'src/user.ts', 'typescript');
    assert.ok(parsed.imports.some((i) => i.source === './auth' && i.specifiers.includes('auth')));
    assert.ok(parsed.imports.some((i) => i.source === './handlers'));
    assert.ok(parsed.symbols.some((s) => s.name === 'UserService' && s.kind === 'class'));
    assert.ok(parsed.symbols.some((s) => s.name === 'createUser'));
    assert.ok(parsed.calls.some((c) => c.callee.includes('auth.register') || c.callee === 'auth.register'));
  });
});

describe('source masking', () => {
  it('preserves line numbers when stripping comments', () => {
    const raw = 'line1\n// import fake\nimport real\nline4';
    const masked = maskCommentsAndStrings(raw, 'c');
    assert.match(masked, /line1/);
    assert.match(masked, /import real/);
    assert.doesNotMatch(masked, /fake/);
    assert.equal(masked.split('\n').length, 4);
  });

  it('masks outside vue script while preserving newlines', () => {
    const vue = '<template>\nX\n</template>\n<script>\nimport x from "y";\n</script>\n';
    const masked = maskOutsideScriptRegions(vue, 'vue');
    assert.match(masked, /import x from "y"/);
    assert.doesNotMatch(masked.replace(/\s+/g, ' '), /template.*import x/);
    assert.equal(masked.split('\n').length, vue.split('\n').length);
  });

  it('prepareAnalyzableSource preserves import paths and masks comments', () => {
    const content = '# comment\nimport os\n\ndef f():\n    pass\n';
    const { text, codeMask, lines } = prepareAnalyzableSource(content, 'python');
    assert.equal(text.split('\n').length, lines.length);
    assert.match(text, /import os/);
    assert.ok(isMatchInCode(codeMask, text, text.indexOf('import os'), 8));
    assert.equal(isMatchInCode(codeMask, text, text.indexOf('comment'), 7), false);
  });

  it('extracts CommonJS require() even when string literals are masked', () => {
    const content = "var x = require('./application');\n";
    const { text, codeMask } = prepareAnalyzableSource(content, 'javascript');
    const match = /require\s*\(\s*['"]([^'"]+)['"]\s*\)/.exec(text)!;
    assert.equal(isMatchInCode(codeMask, text, match.index, match[0].length), false);
    assert.equal(isImportMatchInCode(codeMask, text, match.index, match[0].length), true);
    const parsed = parseContent(content, '/abs', 'lib/express.js', 'javascript');
    assert.ok(parsed.imports.some((imp) => imp.source === './application'));
  });
});
