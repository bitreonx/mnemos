import path from 'node:path';
import {
  EXTRACTOR_PROFILES,
  LANGUAGE_DEFINITIONS,
  LEGACY_PROFILE_LANGUAGES,
  SUPPORTED_LANGUAGE_COUNT,
  type ExtractorProfile,
  type LanguageDefinition,
} from './registry.js';

export {
  EXTRACTOR_PROFILES,
  LANGUAGE_DEFINITIONS,
  LEGACY_PROFILE_LANGUAGES,
  SUPPORTED_LANGUAGE_COUNT,
  type ExtractorProfile,
  type LanguageDefinition,
  type ImportRule,
  type SymbolRule,
} from './registry.js';

const EXTENSION_TO_LANGUAGE = new Map<string, string>();
const BASENAME_TO_LANGUAGE = new Map<string, string>();
const LANGUAGE_BY_ID = new Map<string, LanguageDefinition>();

for (const def of LANGUAGE_DEFINITIONS) {
  LANGUAGE_BY_ID.set(def.id, def);
  for (const ext of def.extensions) {
    EXTENSION_TO_LANGUAGE.set(ext.toLowerCase(), def.id);
  }
  for (const name of def.basename ?? []) {
    BASENAME_TO_LANGUAGE.set(name.toLowerCase(), def.id);
  }
}

export const ALL_SOURCE_EXTENSIONS = new Set(EXTENSION_TO_LANGUAGE.keys());

export const SOURCE_GLOB_EXTENSIONS = [...new Set(LANGUAGE_DEFINITIONS.flatMap((d) => d.extensions.map((e) => e.slice(1))))];

export const SOURCE_GLOB_PATTERN = `**/*.{${SOURCE_GLOB_EXTENSIONS.join(',')}}`;

export const SUPPORTED_LANGUAGES = LANGUAGE_DEFINITIONS.map((d) => ({
  id: d.id,
  label: d.label,
  extensions: d.extensions,
}));

export function getLanguageDefinition(languageId: string): LanguageDefinition | undefined {
  return LANGUAGE_BY_ID.get(languageId);
}

export function getExtractorProfile(languageId: string): ExtractorProfile | undefined {
  const def = LANGUAGE_BY_ID.get(languageId);
  if (!def) return undefined;
  return EXTRACTOR_PROFILES[def.profile];
}

export function usesLegacyExtractor(languageId: string): boolean {
  return LEGACY_PROFILE_LANGUAGES.has(languageId);
}

export function inferLanguage(filePath: string): string {
  const base = path.basename(filePath);
  const ext = path.extname(filePath).toLowerCase();
  const lowerBase = base.toLowerCase();

  if (BASENAME_TO_LANGUAGE.has(lowerBase)) {
    return BASENAME_TO_LANGUAGE.get(lowerBase)!;
  }
  if (lowerBase.startsWith('dockerfile.')) {
    return 'dockerfile';
  }

  return EXTENSION_TO_LANGUAGE.get(ext) ?? 'unknown';
}

export function isSupportedSourceFile(filePath: string): boolean {
  if (inferLanguage(filePath) !== 'unknown') return true;
  return false;
}

export function listSupportedLanguageLabels(): string[] {
  return LANGUAGE_DEFINITIONS.map((d) => d.label);
}

export {
  buildLanguagePipelineMermaid,
  buildExtractorRoutingMermaid,
  buildLanguageFamiliesMermaid,
  buildRepositoryLanguagePieMermaid,
  buildRepositoryLanguageFlowMermaid,
  buildLanguagesReferenceMarkdown,
  buildRepositoryLanguagesMarkdown,
  buildArchitectureLanguageSection,
  buildLanguageSummaryLine,
} from './docs.js';

export {
  getLanguageTier,
  parseConfidenceForLanguage,
  tierLabel,
  type LanguageTier,
} from './tiers.js';
