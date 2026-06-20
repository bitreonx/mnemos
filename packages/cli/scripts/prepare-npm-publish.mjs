/**
 * Produces a self-contained npm publish artifact for `mnemosx`.
 * Bundles @mnemos/core + CLI into dist/npm.cjs — no workspace deps on the registry.
 */
import { build } from 'esbuild'
import { cpSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const cliDir = path.resolve(__dirname, '..')
const coreDir = path.resolve(cliDir, '..', 'core')
const outFile = path.join(cliDir, 'dist', 'npm.cjs')
const disciplineDir = path.join(cliDir, 'dist', 'discipline')

const NATIVE_EXTERNALS = [
  '@xenova/transformers',
  'onnxruntime-node',
  'onnxruntime-common',
  'onnxruntime-web',
  'sharp',
]

mkdirSync(disciplineDir, { recursive: true })
cpSync(
  path.join(coreDir, 'dist', 'discipline', 'fable-mindset.md'),
  path.join(disciplineDir, 'fable-mindset.md'),
  { force: true },
)

await build({
  entryPoints: [path.join(cliDir, 'src', 'index.ts')],
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'cjs',
  outfile: outFile,
  external: NATIVE_EXTERNALS,
  nodePaths: [path.resolve(cliDir, '..', '..', 'node_modules')],
  define: {
    'import.meta.dirname': '__dirname',
  },
  logLevel: 'info',
})

console.log(`[publish] bundled -> ${outFile}`)

const { stripWorkspaceDeps } = await import('./strip-publish-deps.mjs')
stripWorkspaceDeps()
