import type { AgentExports } from './agent-mode.js';

/**
 * Node-only I/O for agent exports. Kept in a separate module so the pure
 * transformation in `./agent-mode.js` stays free of Node built-ins and is
 * safe to bundle into the UI.
 */
export async function writeAgentExports(
  exports: AgentExports,
  outputDir: string,
): Promise<void> {
  const { mkdir, writeFile } = await import('node:fs/promises');
  const path = await import('node:path');
  await mkdir(outputDir, { recursive: true });

  const dnaJson = JSON.stringify(exports.dna, null, 2);
  const contextJson = JSON.stringify(exports.context, null, 2);

  const files: Record<string, string> = {
    'project.dna.json': dnaJson,
    'repository.dna.json': dnaJson,
    'agent_context.json': contextJson,
    'agent-context.json': contextJson,
    'repository_summary.json': JSON.stringify(exports.summary, null, 2),
    'repository-summary.json': JSON.stringify(exports.summary, null, 2),
    'architecture-agent.json': JSON.stringify(exports.architecture, null, 2),
    'critical_paths.json': JSON.stringify(exports.criticalPaths, null, 2),
  };

  for (const [filename, content] of Object.entries(files)) {
    await writeFile(path.join(outputDir, filename), content, 'utf-8');
  }
}
