/**
 * Mnemos release codenames — creative names live here and in docs only.
 * Semver stays in package.json for npm; code speaks in codenames, not "v2/v3".
 */

/** Current product release — semver 0.3.0 · codename Ariadne's Thread */
export const PRODUCT = {
  semver: '0.3.0',
  codename: 'Mneme',
  epithet: "Ariadne's Thread — navigate the Labyrinth on-device",
} as const;

/** Memory engine generation — was internally "v3", now Labyrinth */
export const MEMORY_ENGINE = {
  codename: 'Labyrinth',
  schema: 'mnemos/memory-engine/labyrinth',
  epithet: 'Local hybrid memory — SQLite, sessions, encrypted sync',
  /** Prior schema strings still accepted on load */
  legacySchemas: ['mnemos/memory-engine/v2', 'mnemos/memory-engine/v3'] as const,
} as const;

/** Shared agent memory shards — was shared-memory/v1 */
export const SHARD_PACK = {
  codename: 'Constellation',
  schema: 'mnemos/shared-memory/constellation',
  legacySchemas: ['mnemos/shared-memory/v1'] as const,
} as const;

/** AI Pack contract — frozen; codename for docs */
export const AI_PACK = {
  codename: 'Cartograph',
  semver: '1.0.0',
  schema: 'mnemos/ai-pack/cartograph',
} as const;

/** Planned / aspirational — docs and roadmap only */
export const ROADMAP_CODENAMES = {
  nextEngine: 'Oracle',
  nextProduct: 'Palimpsest',
} as const;

export function formatProductLabel(): string {
  return `${PRODUCT.codename} ${PRODUCT.semver}`;
}

export function formatEngineLabel(): string {
  return `Memory Engine · ${MEMORY_ENGINE.codename}`;
}

export function isKnownEngineSchema(schema: string): boolean {
  return schema === MEMORY_ENGINE.schema || (MEMORY_ENGINE.legacySchemas as readonly string[]).includes(schema);
}

export function normalizeEngineSchema(schema: string): string {
  return isKnownEngineSchema(schema) ? MEMORY_ENGINE.schema : schema;
}
