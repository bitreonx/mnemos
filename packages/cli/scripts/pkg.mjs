// Build a standalone binary using @yao-pkg/pkg (maintained fork of vercel/pkg).
// Cross-platform: produces a native binary for the host OS + arch.
import { execSync } from 'node:child_process';
import { rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const cliDir = path.resolve(__dirname, '..');
const dist = path.join(cliDir, 'dist');
const bundle = path.join(dist, 'mnemos.cjs');

const isWin = process.platform === 'win32';
const ext = isWin ? '.exe' : '';
const out = path.join(dist, `mnemos-bin${ext}`);

// Make sure we have a fresh bundle.
console.log('[pkg] bundling...');
execSync(`node ${path.join(cliDir, 'scripts', 'bundle.mjs')}`, { stdio: 'inherit' });

// pkg config: target matches the host platform/arch.
const target = `node20-${process.platform}-${process.arch}`;
console.log(`[pkg] packaging for ${target}...`);

execSync(
  `npx --yes @yao-pkg/pkg ${bundle} --target ${target} --output ${out} --compress GZip`,
  { cwd: cliDir, stdio: 'inherit' }
);

// Clean up the bundle (the binary is self-contained now).
rmSync(bundle, { force: true });

console.log(`[pkg] done -> ${out}`);
