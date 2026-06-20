import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

/** Works in ESM dev, CJS npm bundle, and Node SEA binaries. */
const moduleDir = (() => {
  try {
    if (typeof import.meta !== 'undefined' && import.meta.url) {
      return dirname(fileURLToPath(import.meta.url))
    }
  } catch {
    /* bundled */
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cjsDir = typeof __dirname !== 'undefined' ? __dirname : undefined
  if (cjsDir) return cjsDir
  return process.cwd()
})()

let cachedMindset: string | undefined

/** Full Fable mindset operating manual for `.mnemos/integrations/fable-mindset.md`. */
export async function loadFableMindsetMd(): Promise<string> {
  if (cachedMindset) return cachedMindset
  const candidates = [
    join(moduleDir, 'fable-mindset.md'),
    join(moduleDir, 'discipline', 'fable-mindset.md'),
  ]
  for (const file of candidates) {
    try {
      cachedMindset = await readFile(file, 'utf-8')
      return cachedMindset
    } catch {
      /* try next */
    }
  }
  throw new Error('fable-mindset.md not found in Mnemos bundle')
}
