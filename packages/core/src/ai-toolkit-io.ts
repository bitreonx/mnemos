import type { AiToolkit } from './ai-toolkit.js';

/**
 * Node-only I/O for AI integration artifacts (Cursor, Claude, AGENTS.md).
 */
export async function writeAiToolkit(toolkit: AiToolkit, outputDir: string): Promise<string> {
  const { mkdir, writeFile } = await import('node:fs/promises');
  const path = await import('node:path');
  const integrationsDir = path.join(outputDir, 'integrations');
  await mkdir(integrationsDir, { recursive: true });

  const files: Record<string, string> = {
    'AGENTS.md': toolkit.agentsMd,
    'cursor-rule.mdc': toolkit.cursorRule,
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

export interface SetupOptions {
  root: string;
  outputDir: string;
  toolkit: AiToolkit;
  force?: boolean;
}

export interface SetupResult {
  written: string[];
  skipped: string[];
}

export async function installAiIntegrations(options: SetupOptions): Promise<SetupResult> {
  const { mkdir, writeFile, access } = await import('node:fs/promises');
  const path = await import('node:path');
  const { root, toolkit, force = false } = options;

  const written: string[] = [];
  const skipped: string[] = [];

  async function writeIfMissing(relPath: string, content: string): Promise<void> {
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

  await writeIfMissing('AGENTS.md', toolkit.agentsMd);
  await writeIfMissing('.cursor/rules/mnemos-architecture.mdc', toolkit.cursorRule);

  return { written, skipped };
}
