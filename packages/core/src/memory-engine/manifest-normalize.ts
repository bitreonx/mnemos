import type { EngineManifest } from './types.js';
import { MEMORY_ENGINE_CODENAME, MEMORY_ENGINE_SCHEMA } from './types.js';
import { normalizeEngineSchema } from '../release/codenames.js';

/** Normalize legacy manifests (version numbers, old schema ids) → Labyrinth shape. */
export function normalizeEngineManifest(raw: Record<string, unknown>): EngineManifest {
  const m = raw as unknown as EngineManifest & { version?: number };
  if (typeof m.$schema === 'string') {
    m.$schema = normalizeEngineSchema(m.$schema) as typeof MEMORY_ENGINE_SCHEMA;
  }
  if (!m.codename) m.codename = MEMORY_ENGINE_CODENAME;
  if (m.generation === undefined && typeof m.version === 'number') {
    m.generation = m.version;
  }
  return m;
}
