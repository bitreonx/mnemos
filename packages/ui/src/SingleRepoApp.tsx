import { useEffect, useState } from 'react';
import { DashboardShell } from './components/layout/DashboardShell';
import { RepoWorkspace, sectionFromNav, type RepoSection } from './components/RepoWorkspace';
import { MnemosLogo } from './components/illustrations/MnemosLogo';
import type { GraphData, HealthScore, HeatmapEntry, MemoryModel } from './types';
import { askCopilot } from './lib/workspace';

const DEMO_MEMORY: MemoryModel = {
  repository: 'demo',
  builtAt: new Date().toISOString(),
  stats: {
    filesScanned: 0,
    nodesCreated: 0,
    edgesCreated: 0,
    domainsFound: 0,
    flowsFound: 0,
    durationMs: 0,
  },
  architecture: {
    name: 'No repository loaded',
    type: '—',
    layers: [],
    packages: [],
    languages: {},
    summary: 'Run mnemos build on a repository, then launch mnemos ui',
  },
  domains: [],
  flows: [],
  services: [],
  apis: [],
  smells: [],
  criticalPaths: [],
  capabilities: [],
  journeys: [],
};

async function loadMemory(): Promise<{
  memory: MemoryModel;
  graph: GraphData | null;
  heatmap: HeatmapEntry[];
  healthScore: HealthScore | null;
}> {
  try {
    const memRes = await fetch('/.mnemos/memory.json');
    if (memRes.ok) {
      const memory = (await memRes.json()) as MemoryModel;
      let graph: GraphData | null = null;
      try {
        const graphRes = await fetch('/.mnemos/graph.json');
        if (graphRes.ok) graph = (await graphRes.json()) as GraphData;
      } catch {
        // no graph
      }
      if (graph && typeof window !== 'undefined') {
        window.__graph = graph;
      }
      const [heatmap, healthScore] = await Promise.all([
        fetch('/.mnemos/heatmap.json')
          .then((r) => (r.ok ? r.json() : []))
          .catch(() => []),
        fetch('/.mnemos/health-score.json')
          .then((r) => (r.ok ? r.json() : null))
          .catch(() => null),
      ]);
      return { memory, graph, heatmap: heatmap as HeatmapEntry[], healthScore };
    }
  } catch {
    // fallback
  }
  return { memory: DEMO_MEMORY, graph: null, heatmap: [], healthScore: null };
}

export default function SingleRepoApp() {
  const [memory, setMemory] = useState<MemoryModel>(DEMO_MEMORY);
  const [loading, setLoading] = useState(true);
  const [section, setSection] = useState<RepoSection>('overview');
  const [pendingQuestion, setPendingQuestion] = useState<string | null>(null);

  const refresh = async () => {
    const { memory: m } = await loadMemory();
    setMemory(m);
  };

  useEffect(() => {
    loadMemory().then(({ memory: m }) => {
      setMemory(m);
      setLoading(false);
    });
  }, []);

  const singleRepo = {
    id: 'local',
    name: memory.repository,
    label: memory.architecture.type,
    path: '.',
    description: memory.architecture.summary,
    accent: '#6366f1',
    status: memory.stats.filesScanned > 0 ? ('ready' as const) : ('missing' as const),
    health: undefined,
    aiReadiness: undefined,
  };

  if (loading) {
    return (
      <div className="dash-loading">
        <MnemosLogo size={56} />
        <div className="dash-loader" />
        <p>Loading memory model…</p>
      </div>
    );
  }

  return (
    <DashboardShell
      repos={[singleRepo]}
      activeRepoId="local"
      activeRepo={singleRepo}
      activeMemory={memory}
      onSelectRepo={() => {}}
      onRefresh={refresh}
      onBuild={async () => {}}
      onNavigate={(view) => setSection(sectionFromNav(view))}
      onAsk={(q) => {
        setPendingQuestion(q);
        askCopilot('local', q).catch(() => {});
      }}
      onQuickInsight={(target) => {
        window.dispatchEvent(new CustomEvent('mnemos:quick-insight', { detail: target }));
      }}
      singleRepoMode
    >
      <RepoWorkspace
        repo={singleRepo}
        section={section}
        onSectionChange={setSection}
        onRefresh={refresh}
        pendingQuestion={pendingQuestion}
        onPendingQuestionHandled={() => setPendingQuestion(null)}
      />
    </DashboardShell>
  );
}
