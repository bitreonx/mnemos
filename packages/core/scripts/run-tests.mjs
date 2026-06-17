#!/usr/bin/env node
/**
 * Cross-platform test runner for @mnemos/core.
 * `node --test dist/` does not recurse on all platforms; this finds every *.test.js under dist/.
 */
import { readdir } from 'node:fs/promises'
import { join } from 'node:path'
import { spawn } from 'node:child_process'

async function collectTests(dir) {
  const out = []
  let entries
  try {
    entries = await readdir(dir, { withFileTypes: true })
  } catch {
    return out
  }
  for (const entry of entries) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) {
      out.push(...(await collectTests(full)))
      continue
    }
    if (entry.name.endsWith('.test.js')) out.push(full)
  }
  return out
}

const tests = await collectTests('dist')
if (tests.length === 0) {
  console.error('No compiled test files found under dist/. Run npm run build:test first.')
  process.exit(1)
}

const child = spawn(process.execPath, ['--test', ...tests], {
  stdio: 'inherit',
  shell: false,
})

child.on('close', (code) => process.exit(code ?? 1))
