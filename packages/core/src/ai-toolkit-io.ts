import type { AiToolkit } from './ai-toolkit.js';
import {
  buildSkillMd,
  buildSteeringMd,
  buildVscodeInstructions,
  buildCopilotInstructions,
  buildWindsurfRule,
  buildGeminiMd,
  buildClaudeMdSection,
  stripMnemosSection,
} from './ai-toolkit.js';
import { buildDisciplineCursorRule, buildFableMindsetSkillMd } from './discipline/agent-discipline.js';
import { buildLoomCursorRule, buildLoomSkillMd } from './discipline/loom-skill.js';
import { loadFableMindsetMd } from './discipline/fable-mindset.js';
import { buildMcpServerConfig, formatMcpConfigJson } from './mcp-config.js';
import type { MemoryModel } from './types.js';
import type { AgentContext } from './agent-mode.js';

/**
 * Node-only I/O for AI integration artifacts (Cursor, Claude, AGENTS.md).
 */
export async function writeAiToolkit(toolkit: AiToolkit, outputDir: string): Promise<string> {
  const { mkdir, writeFile } = await import('node:fs/promises');
  const path = await import('node:path');
  const integrationsDir = path.join(outputDir, 'integrations');
  await mkdir(integrationsDir, { recursive: true });

  const mindsetMd = await loadFableMindsetMd();

  const files: Record<string, string> = {
    'AGENTS.md': toolkit.agentsMd,
    'cursor-rule.mdc': toolkit.cursorRule,
    'discipline-rule.mdc': buildDisciplineCursorRule(),
    'fable-mindset.md': mindsetMd,
    'ai-prompt.md': toolkit.aiPrompt,
    'claude-project.md': toolkit.claudeProjectInstructions,
    'suggested-prompts.json': JSON.stringify(
      { prompts: toolkit.suggestedPrompts, contextFiles: toolkit.contextFiles },
      null,
      2,
    ),
  };

  for (const [filename, content] of Object.entries(files)) {
    await writeFile(path.join(integrationsDir, filename), content, 'utf-8');
  }

  return integrationsDir;
}

export type Platform =
  | 'cursor'
  | 'kiro'
  | 'claude'
  | 'codex'
  | 'vscode'
  | 'aider'
  | 'gemini'
  | 'copilot'
  | 'amp'
  | 'trae'
  | 'windsurf';

export const ALL_PLATFORMS: Platform[] = [
  'cursor',
  'kiro',
  'claude',
  'codex',
  'vscode',
  'aider',
  'gemini',
  'copilot',
  'amp',
  'trae',
  'windsurf',
];

/** Relative paths written by each platform (for uninstall). */
export const PLATFORM_FILES: Record<Platform, string[]> = {
  cursor: ['.cursor/rules/mnemos-architecture.mdc', '.cursor/rules/mnemos-discipline.mdc', '.cursor/rules/mnemos-loom.mdc', '.cursor/mcp.json'],
  kiro: ['.kiro/skills/mnemos/SKILL.md', '.kiro/steering/mnemos.md'],
  claude: ['.claude/skills/mnemos/SKILL.md', '.claude/skills/fable-mindset/SKILL.md', '.claude/skills/mnemos-loom/SKILL.md', 'CLAUDE.md'],
  codex: ['.codex/skills/mnemos/SKILL.md', 'AGENTS.md'],
  vscode: ['.vscode/mnemos.instructions.md'],
  aider: ['AGENTS.md'],
  gemini: ['GEMINI.md', '.gemini/skills/mnemos.md'],
  copilot: ['.github/copilot-instructions.md'],
  amp: ['.amp/skills/mnemos.md'],
  trae: ['AGENTS.md'],
  windsurf: ['.windsurf/rules/mnemos.md'],
};

export interface SetupOptions {
  root: string;
  outputDir: string;
  toolkit: AiToolkit;
  memory: MemoryModel;
  context: AgentContext;
  platform?: Platform | 'all';
  force?: boolean;
  uninstall?: boolean;
}

export interface SetupResult {
  written: string[];
  skipped: string[];
  removed: string[];
}

export async function installAiIntegrations(options: SetupOptions): Promise<SetupResult> {
  if (options.uninstall) {
    return uninstallAiIntegrations(options.root);
  }

  const platforms =
    !options.platform || options.platform === 'all' ? ALL_PLATFORMS : [options.platform];

  const written: string[] = [];
  const skipped: string[] = [];

  for (const platform of platforms) {
    const result = await installPlatform(platform, options);
    written.push(...result.written);
    skipped.push(...result.skipped);
  }

  return { written, skipped, removed: [] };
}

async function installPlatform(
  platform: Platform,
  options: SetupOptions,
): Promise<{ written: string[]; skipped: string[] }> {
  const { root, toolkit, memory, context, force = false } = options;
  const skillMd = buildSkillMd(memory, context);
  const written: string[] = [];
  const skipped: string[] = [];

  const writers: Record<Platform, () => Promise<void>> = {
    cursor: async () => {
      await writeIfMissing(root, '.cursor/rules/mnemos-architecture.mdc', toolkit.cursorRule, force, written, skipped);
      await writeIfMissing(root, '.cursor/rules/mnemos-discipline.mdc', buildDisciplineCursorRule(), force, written, skipped);
      await writeIfMissing(root, '.cursor/rules/mnemos-loom.mdc', buildLoomCursorRule(), force, written, skipped);
      await mergeMcpConfig(root, force, written, skipped);
    },
    kiro: async () => {
      await writeIfMissing(root, '.kiro/skills/mnemos/SKILL.md', skillMd, force, written, skipped);
      await writeIfMissing(root, '.kiro/steering/mnemos.md', buildSteeringMd(memory, context), force, written, skipped);
    },
    claude: async () => {
      await writeIfMissing(root, '.claude/skills/mnemos/SKILL.md', skillMd, force, written, skipped);
      await writeIfMissing(root, '.claude/skills/fable-mindset/SKILL.md', buildFableMindsetSkillMd(), force, written, skipped);
      await writeIfMissing(root, '.claude/skills/mnemos-loom/SKILL.md', buildLoomSkillMd(), force, written, skipped);
      await appendOrWriteSection(root, 'CLAUDE.md', buildClaudeMdSection(memory, context), force, written, skipped);
    },
    codex: async () => {
      await writeIfMissing(root, '.codex/skills/mnemos/SKILL.md', skillMd, force, written, skipped);
      await writeIfMissing(root, 'AGENTS.md', toolkit.agentsMd, force, written, skipped);
    },
    vscode: async () => {
      await writeIfMissing(root, '.vscode/mnemos.instructions.md', buildVscodeInstructions(memory, context), force, written, skipped);
    },
    aider: async () => {
      await writeIfMissing(root, 'AGENTS.md', toolkit.agentsMd, force, written, skipped);
    },
    gemini: async () => {
      await appendOrWriteSection(root, 'GEMINI.md', buildGeminiMd(memory, context), force, written, skipped);
      await writeIfMissing(root, '.gemini/skills/mnemos.md', skillMd, force, written, skipped);
    },
    copilot: async () => {
      await writeIfMissing(root, '.github/copilot-instructions.md', buildCopilotInstructions(memory, context), force, written, skipped);
    },
    amp: async () => {
      await writeIfMissing(root, '.amp/skills/mnemos.md', skillMd, force, written, skipped);
    },
    trae: async () => {
      await writeIfMissing(root, 'AGENTS.md', toolkit.agentsMd, force, written, skipped);
    },
    windsurf: async () => {
      await writeIfMissing(root, '.windsurf/rules/mnemos.md', buildWindsurfRule(memory, context), force, written, skipped);
    },
  };

  await writers[platform]();
  return { written, skipped };
}

export async function uninstallAiIntegrations(root: string): Promise<SetupResult> {
  const { unlink, readFile, writeFile, access } = await import('node:fs/promises');
  const path = await import('node:path');
  const removed: string[] = [];
  const skipped: string[] = [];

  const allFiles = new Set<string>();
  for (const files of Object.values(PLATFORM_FILES)) {
    for (const f of files) allFiles.add(f);
  }

  for (const relPath of allFiles) {
    const full = path.join(root, relPath);

    if (relPath === '.cursor/mcp.json') {
      try {
        const content = await readFile(full, 'utf-8');
        const parsed = JSON.parse(content) as { mcpServers?: Record<string, unknown> };
        if (parsed.mcpServers?.mnemos) {
          delete parsed.mcpServers.mnemos;
          if (Object.keys(parsed.mcpServers).length === 0) {
            await unlink(full);
          } else {
            await writeFile(full, JSON.stringify(parsed, null, 2) + '\n', 'utf-8');
          }
          removed.push(relPath + ' (mnemos entry)');
        }
      } catch {
        skipped.push(relPath);
      }
      continue;
    }

    if (relPath === 'CLAUDE.md' || relPath === 'GEMINI.md') {
      try {
        const content = await readFile(full, 'utf-8');
        if (content.includes('<!-- mnemos:start -->')) {
          const cleaned = stripMnemosSection(content);
          if (cleaned.trim()) {
            await writeFile(full, cleaned + '\n', 'utf-8');
          } else {
            await unlink(full);
          }
          removed.push(relPath + ' (mnemos section)');
        }
      } catch {
        skipped.push(relPath);
      }
      continue;
    }

    try {
      await access(full);
      await unlink(full);
      removed.push(relPath);
    } catch {
      skipped.push(relPath);
    }
  }

  return { written: [], skipped, removed };
}

async function mergeMcpConfig(
  root: string,
  force: boolean,
  written: string[],
  skipped: string[],
): Promise<void> {
  const { readFile, writeFile, mkdir } = await import('node:fs/promises');
  const path = await import('node:path');
  const relPath = '.cursor/mcp.json';
  const full = path.join(root, relPath);
  const mnemosEntry = buildMcpServerConfig(root).mcpServers.mnemos!;

  let existing: { mcpServers?: Record<string, unknown> } = { mcpServers: {} };
  try {
    existing = JSON.parse(await readFile(full, 'utf-8'));
  } catch {
    /* new file */
  }

  if (existing.mcpServers?.mnemos && !force) {
    skipped.push(relPath);
    return;
  }

  await mkdir(path.dirname(full), { recursive: true });
  await writeFile(
    full,
    formatMcpConfigJson({
      mcpServers: { ...existing.mcpServers, mnemos: mnemosEntry },
    }) + '\n',
    'utf-8',
  );
  written.push(relPath);
}

async function writeIfMissing(
  root: string,
  relPath: string,
  content: string,
  force: boolean,
  written: string[],
  skipped: string[],
): Promise<void> {
  const { mkdir, writeFile, access } = await import('node:fs/promises');
  const path = await import('node:path');
  const full = path.join(root, relPath);
  await mkdir(path.dirname(full), { recursive: true });

  if (!force) {
    try {
      await access(full);
      skipped.push(relPath);
      return;
    } catch {
      /* file missing — write */
    }
  }

  await writeFile(full, content, 'utf-8');
  written.push(relPath);
}

async function appendOrWriteSection(
  root: string,
  relPath: string,
  section: string,
  force: boolean,
  written: string[],
  skipped: string[],
): Promise<void> {
  const { readFile, writeFile, access } = await import('node:fs/promises');
  const path = await import('node:path');
  const full = path.join(root, relPath);

  let existing = '';
  try {
    existing = await readFile(full, 'utf-8');
  } catch {
    /* new file */
  }

  if (existing.includes('<!-- mnemos:start -->') && !force) {
    skipped.push(relPath);
    return;
  }

  const cleaned = stripMnemosSection(existing);
  const content = cleaned ? cleaned + section : section.trimStart();
  await writeFile(full, content, 'utf-8');
  written.push(relPath);
}
