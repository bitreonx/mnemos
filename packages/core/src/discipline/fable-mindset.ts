import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))

let cachedMindset: string | undefined

/** Full Fable mindset operating manual for `.mnemos/integrations/fable-mindset.md`. */
export async function loadFableMindsetMd(): Promise<string> {
  if (cachedMindset) return cachedMindset
  cachedMindset = await readFile(join(__dirname, 'fable-mindset.md'), 'utf-8')
  return cachedMindset
}
