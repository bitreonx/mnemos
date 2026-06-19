// Bundle the CLI into a single CJS file with all dependencies inlined.
// Output: dist/mnemos.cjs (used as the entry for Node SEA).
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const cliDir = path.resolve(__dirname, '..');
const out = path.join(cliDir, 'dist', 'mnemos.cjs');

// Native / WASM-heavy optional deps — excluded from SEA bundle; hash embeddings used at runtime.
const NATIVE_EXTERNALS = [
  '@xenova/transformers',
  'onnxruntime-node',
  'onnxruntime-common',
  'onnxruntime-web',
  'sharp',
];

await build({
  entryPoints: [path.join(cliDir, 'src', 'index.ts')],
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'cjs',
  outfile: out,
  external: NATIVE_EXTERNALS,
  // Bundle everything in the workspace too, including @mnemos/core.
  nodePaths: [path.resolve(cliDir, '..', '..', 'node_modules')],
  banner: { js: '' },
  // CJS doesn't have import.meta — substitute with CJS __dirname so
  // SEA-bundled binaries can resolve paths the same way the ESM source does.
  define: {
    'import.meta.dirname': '__dirname',
  },
  logLevel: 'info',
});

console.log(`[bundle] wrote ${out}`);
