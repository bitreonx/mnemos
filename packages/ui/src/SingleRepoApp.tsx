import { useEffect, useState } from 'react';
import { Sidebar } from './components/Sidebar';
import { Overview } from './components/Overview';
import { DomainsView, FlowsView } from './components/DomainsView';
import { GraphView } from './components/GraphView';
import { SmellsView } from './components/SmellsView';
import { ArchitectureCanvas } from './components/ArchitectureCanvas';
import { AICompanion } from './components/AICompanion';
import { AISetupView } from './components/AISetupView';
import { CapabilitiesView } from './components/CapabilitiesView';
import { JourneyMapView } from './components/JourneyMapView';
import { HeatmapView } from './components/HeatmapView';
import { RepositoryExplorer } from './components/RepositoryExplorer';
import { TimelineView } from './components/TimelineView';
import { QuickInsights } from './components/QuickInsights';
import { SystemAnalyzer } from './components/SystemAnalyzer';
import type { GraphData, HealthScore, HeatmapEntry, MemoryModel } from './types';

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
  const [graph, setGraph] = useState<GraphData | null>(null);
  const [heatmap, setHeatmap] = useState<HeatmapEntry[]>([]);
  const [healthScore, setHealthScore] = useState<HealthScore | null>(null);
  const [activeView, setActiveView] = useState('overview');
  const [selectedDomain, setSelectedDomain] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [companionOpen, setCompanionOpen] = useState(true);
  const [quickInsightsTarget, setQuickInsightsTarget] = useState<string | null>(null);

  useEffect(() => {
    loadMemory().then(({ memory: m, graph: g, heatmap: h, healthScore: s }) => {
      setMemory(m);
      setGraph(g);
      setHeatmap(h);
      setHealthScore(s);
      setLoading(false);
    });
  }, []);

  const highlightNodes = selectedDomain
    ? memory.domains.find((d) => d.id === selectedDomain)?.nodes
    : undefined;

  return (
    <div className="app-shell">
      <Sidebar
        memory={memory}
        activeView={activeView}
        onViewChange={setActiveView}
        selectedDomain={selectedDomain}
        onDomainSelect={setSelectedDomain}
        healthScore={healthScore?.overall}
      />

      <main className="main-area" style={{ display: 'flex', flexDirection: 'column' }}>
        <div style={{ flex: 1, overflow: 'auto', position: 'relative' }}>
          {quickInsightsTarget && (
            <QuickInsights
              memory={memory}
              target={quickInsightsTarget}
              onClose={() => setQuickInsightsTarget(null)}
            />
          )}

          {loading ? (
            <div className="loading">
              <div className="loading-text">Loading memory model…</div>
            </div>
          ) : (
            <>
              {activeView === 'overview' && <Overview memory={memory} healthScore={healthScore} />}
              {activeView === 'explorer' && (
                <RepositoryExplorer
                  memory={memory}
                  onSelectRepo={() => {}}
                  onQuickInsight={setQuickInsightsTarget}
                />
              )}
              {activeView === 'system-analyzer' && (
                <SystemAnalyzer memory={memory} onQuickInsight={setQuickInsightsTarget} />
              )}
              {activeView === 'timeline' && <TimelineView memory={memory} />}
              {activeView === 'capabilities' && <CapabilitiesView memory={memory} />}
              {activeView === 'journeys' && (
                <JourneyMapView journeys={memory.journeys ?? []} flows={memory.flows} />
              )}
              {activeView === 'heatmap' && <HeatmapView heatmap={heatmap} />}
              {activeView === 'domains' && (
                <DomainsView domains={memory.domains} selectedId={selectedDomain} />
              )}
              {activeView === 'flows' && <FlowsView flows={memory.flows} />}
              {activeView === 'architecture' && (
                <div className="h-full">
                  <ArchitectureCanvas memory={memory} />
                </div>
              )}
              {activeView === 'graph' && (
                <div className="h-full">
                  <GraphView graph={graph} highlightNodes={highlightNodes} />
                </div>
              )}
              {activeView === 'smells' && <SmellsView smells={memory.smells} />}
              {activeView === 'companion' && <AICompanion memory={memory} />}
              {activeView === 'ai-setup' && <AISetupView memory={memory} />}
            </>
          )}
        </div>
      </main>

      <button
        className={`companion-toggle ${companionOpen ? 'open' : 'closed'}`}
        onClick={() => {
          if (companionOpen) {
            setCompanionOpen(false);
          } else {
            setCompanionOpen(true);
            setActiveView('companion');
          }
        }}
        title={companionOpen ? 'Hide companion' : 'Open companion'}
      >
        {companionOpen ? '×' : '✦'}
      </button>

      {companionOpen && activeView !== 'companion' && (
        <aside className="companion-dock">
          <AICompanion memory={memory} />
        </aside>
      )}
    </div>
  );
}
