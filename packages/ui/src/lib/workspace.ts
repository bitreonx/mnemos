import type { GraphData, HealthScore, HeatmapEntry, MemoryModel } from '../types';

export interface WorkspaceRepo {
  id: string;
  name: string;
  label: string;
  path: string;
  description: string;
  accent: string;
}

export interface WorkspaceConfig {
  name: string;
  root: string;
  repos: WorkspaceRepo[];
}

export interface RepoSnapshot {
  id: string;
  name: string;
  label: string;
  description: string;
  accent: string;
  path: string;
  status: 'ready' | 'missing' | 'building' | 'error';
  builtAt?: string;
  health?: number;
  aiReadiness?: number;
  stats?: {
    files: number;
    domains: number;
    flows: number;
    apis: number;
    capabilities: number;
    smells: number;
    durationMs: number;
  };
  mostCritical?: string;
  highestRisk?: string;
  topCapabilities?: string[];
  error?: string;
}

export interface WorkspaceSummary {
  workspace: string;
  repos: RepoSnapshot[];
  aggregateHealth: number;
  totalFiles: number;
  totalDomains: number;
  totalFlows: number;
}

export interface BuildHistoryEntry {
  builtAt: string;
  files: number;
  domains: number;
  flows: number;
  health: number;
  aiReadiness: number;
  durationMs: number;
  capabilities: number;
  smells: number;
}

export interface AskResponse {
  ok: boolean;
  answer: string;
  confidence: number;
  raw?: string;
}

export interface TerminalResponse {
  ok: boolean;
  output: string;
  code?: number;
}

export async function fetchWorkspace(): Promise<WorkspaceSummary> {
  const res = await fetch('/api/workspace');
  if (!res.ok) throw new Error('Failed to load workspace');
  return res.json() as Promise<WorkspaceSummary>;
}

export async function triggerBuild(repoId: string): Promise<{ ok: boolean; message: string }> {
  const res = await fetch('/api/build', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ repoId }),
  });
  return res.json() as Promise<{ ok: boolean; message: string }>;
}

export async function fetchBuildHistory(repoId: string): Promise<BuildHistoryEntry[]> {
  if (repoId === 'local') {
    try {
      const res = await fetch('/.mnemos/build-history.json');
      if (!res.ok) return [];
      const data = (await res.json()) as BuildHistoryEntry[] | { history: BuildHistoryEntry[] };
      return Array.isArray(data) ? data : data.history ?? [];
    } catch {
      return [];
    }
  }
  const res = await fetch(`/api/history/${repoId}`);
  if (!res.ok) return [];
  const data = (await res.json()) as { history: BuildHistoryEntry[] };
  return data.history ?? [];
}

export async function runTerminalCommand(repoId: string, command: string): Promise<TerminalResponse> {
  const res = await fetch('/api/terminal', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ repoId, command }),
  });
  return res.json() as Promise<TerminalResponse>;
}

export async function askCopilot(repoId: string, question: string): Promise<AskResponse> {
  const res = await fetch('/api/ask', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ repoId, question }),
  });
  return res.json() as Promise<AskResponse>;
}

export async function fetchRepoMemory(repoId: string): Promise<{
  memory: MemoryModel;
  graph: GraphData | null;
  healthScore: HealthScore | null;
  heatmap: HeatmapEntry[];
  dna: Record<string, unknown> | null;
  suggestedPrompts: string[];
}> {
  const base = repoId === 'local' ? '/.mnemos' : `/.mnemos/${repoId}`;
  const [memRes, graphRes, healthRes, heatRes, dnaRes, promptsRes] = await Promise.all([
    fetch(`${base}/memory.json`),
    fetch(`${base}/graph.json`),
    fetch(`${base}/health-score.json`),
    fetch(`${base}/heatmap.json`),
    fetch(`${base}/project.dna.json`),
    fetch(`${base}/integrations/suggested-prompts.json`),
  ]);
  if (!memRes.ok) throw new Error('Memory not found');
  const memory = (await memRes.json()) as MemoryModel;
  const graph = graphRes.ok ? ((await graphRes.json()) as GraphData) : null;
  const healthScore = healthRes.ok ? ((await healthRes.json()) as HealthScore) : null;
  const heatmap = heatRes.ok ? ((await heatRes.json()) as HeatmapEntry[]) : [];
  const dna = dnaRes.ok ? ((await dnaRes.json()) as Record<string, unknown>) : null;
  let suggestedPrompts: string[] = [];
  if (promptsRes.ok) {
    const prompts = (await promptsRes.json()) as { prompts?: string[] } | string[];
    suggestedPrompts = Array.isArray(prompts) ? prompts : prompts.prompts ?? [];
  }
  return { memory, graph, healthScore, heatmap, dna, suggestedPrompts };
}

export async function fetchContextDoc(repoId: string, doc: string): Promise<string | null> {
  try {
    const base = repoId === 'local' ? '/.mnemos/context' : `/.mnemos/${repoId}/context`;
    const res = await fetch(`${base}/${doc}`);
    if (!res.ok) return null;
    return res.text();
  } catch {
    return null;
  }
}
