import { useEffect, useState } from 'react';
import type { GraphData, HealthScore, HeatmapEntry, MemoryModel } from '../types';
import type { BuildHistoryEntry, RepoSnapshot } from '../lib/workspace';
import { fetchBuildHistory, fetchRepoMemory, triggerBuild } from '../lib/workspace';
import { Overview } from './Overview';
import { DomainsView, FlowsView } from './DomainsView';
import { GraphView } from './GraphView';
import { SmellsView } from './SmellsView';
import { HeatmapView } from './HeatmapView';
import { ArchitectureCanvas } from './ArchitectureCanvas';
import { CapabilitiesView } from './CapabilitiesView';
import { JourneyMapView } from './JourneyMapView';
import { SystemAnalyzer } from './SystemAnalyzer';
import { RepositoryExplorer } from './RepositoryExplorer';
import { IntegratedTerminal } from './IntegratedTerminal';
import { WorkspaceCopilot } from './WorkspaceCopilot';
import { TechStackView } from './TechStackView';
import { QuickInsights } from './QuickInsights';
import { BuildHistoryView } from './BuildHistoryView';

export type RepoTab =
  | 'overview'
  | 'systems'
  | 'flows'
  | 'domains'
  | 'tech'
  | 'graph'
  | 'capabilities'
  | 'smells'
  | 'heatmap'
  | 'journeys'
  | 'files'
  | 'history'
  | 'terminal'
  | 'ai'
  | 'context';

const TABS: { id: RepoTab; label: string; icon: string }[] = [
  { id: 'overview', label: 'Overview', icon: '◉' },
  { id: 'systems', label: 'Systems', icon: '⬡' },
  { id: 'flows', label: 'Flows', icon: '→' },
  { id: 'domains', label: 'Domains', icon: '▣' },
  { id: 'tech', label: 'Tech Stack', icon: '⚙' },
  { id: 'graph', label: 'Graph', icon: '◎' },
  { id: 'capabilities', label: 'Logic', icon: '✦' },
  { id: 'smells', label: 'Smells', icon: '!' },
  { id: 'heatmap', label: 'Risk', icon: '▤' },
  { id: 'journeys', label: 'Journeys', icon: '↝' },
  { id: 'files', label: 'Files', icon: '📁' },
  { id: 'history', label: 'History', icon: '⏱' },
  { id: 'terminal', label: 'Terminal', icon: '$_' },
  { id: 'ai', label: 'AI Copilot', icon: '✨' },
  { id: 'context', label: 'Context Docs', icon: '📄' },
];

interface RepoWorkspaceProps {
  repo: RepoSnapshot;
  onBack: () => void;
  onRefresh: () => void;
}

export function RepoWorkspace({ repo, onBack, onRefresh }: RepoWorkspaceProps) {
  const [tab, setTab] = useState<RepoTab>('overview');
  const [loading, setLoading] = useState(true);
  const [building, setBuilding] = useState(false);
  const [memory, setMemory] = useState<MemoryModel | null>(null);
  const [graph, setGraph] = useState<GraphData | null>(null);
  const [healthScore, setHealthScore] = useState<HealthScore | null>(null);
  const [heatmap, setHeatmap] = useState<HeatmapEntry[]>([]);
  const [history, setHistory] = useState<BuildHistoryEntry[]>([]);
  const [suggestedPrompts, setSuggestedPrompts] = useState<string[]>([]);
  const [selectedDomain, setSelectedDomain] = useState<string | null>(null);
  const [insightTarget, setInsightTarget] = useState<string | null>(null);
  const [contextDoc, setContextDoc] = useState<string>('architecture.md');
  const [contextContent, setContextContent] = useState<string>('');

  const load = async () => {
    setLoading(true);
    try {
      const [data, hist] = await Promise.all([
        fetchRepoMemory(repo.id),
        fetchBuildHistory(repo.id),
      ]);
      setMemory(data.memory);
      setGraph(data.graph);
      setHealthScore(data.healthScore);
      setHeatmap(data.heatmap);
      setSuggestedPrompts(data.suggestedPrompts);
      setHistory(hist);
    } catch {
      setMemory(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [repo.id]);

  useEffect(() => {
    if (tab !== 'context') return;
    fetch(`/.mnemos/${repo.id}/context/${contextDoc}`)
      .then((r) => (r.ok ? r.text() : 'Document not found'))
      .then(setContextContent)
      .catch(() => setContextContent('Failed to load document'));
  }, [tab, contextDoc, repo.id]);

  const handleBuild = async () => {
    setBuilding(true);
    await triggerBuild(repo.id);
    setTimeout(async () => {
      await load();
      onRefresh();
      setBuilding(false);
    }, 3000);
  };

  const handleQuickInsight = (target: string) => {
    setInsightTarget(target);
    if (target.toLowerCase().includes('auth')) {
      setTab('ai');
    }
  };

  const handleCopilotTopic = (topic: string) => {
    if (topic.toLowerCase().includes('auth')) setTab('systems');
  };

  if (loading || !memory) {
    return (
      <div className="repo-workspace repo-workspace--loading">
        <div className="dash-loader" />
        <p>Loading {repo.name} intelligence…</p>
      </div>
    );
  }

  const contextDocs = ['architecture.md', 'domains.md', 'flows.md', 'apis.md', 'services.md', 'critical_paths.md', 'smells.md'];

  return (
    <div className="repo-workspace">
      <header className="repo-workspace-header" style={{ '--repo-accent': repo.accent } as React.CSSProperties}>
        <div className="repo-workspace-top">
          <button type="button" className="repo-back-btn" onClick={onBack}>← Platform</button>
          <div>
            <p className="repo-workspace-label">{repo.label}</p>
            <h1>{repo.name}</h1>
            <p className="repo-workspace-desc">{repo.description}</p>
          </div>
          <div className="repo-workspace-actions">
            <span className={`status-pill status-pill--${repo.status}`}>Health {repo.health ?? 0}</span>
            <span className="badge badge--lime">AI {repo.aiReadiness ?? 0}%</span>
            <button type="button" className="repo-build-btn repo-build-btn--inline" onClick={handleBuild} disabled={building}>
              {building ? '⏳ Building…' : '⚡ Run Mnemos'}
            </button>
          </div>
        </div>

        <nav className="repo-tabs">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              className={`repo-tab ${tab === t.id ? 'repo-tab--active' : ''}`}
              onClick={() => setTab(t.id)}
            >
              <span className="repo-tab-icon">{t.icon}</span>
              {t.label}
            </button>
          ))}
        </nav>
      </header>

      <div className="repo-workspace-body">
        {tab === 'overview' && (
          <div className="repo-tab-panel">
            <Overview memory={memory} healthScore={healthScore} />
            <TechStackView memory={memory} />
          </div>
        )}
        {tab === 'systems' && (
          <SystemAnalyzer memory={memory} onQuickInsight={handleQuickInsight} />
        )}
        {tab === 'flows' && <FlowsView flows={memory.flows} />}
        {tab === 'domains' && (
          <DomainsView domains={memory.domains} selectedId={selectedDomain} />
        )}
        {tab === 'tech' && <TechStackView memory={memory} />}
        {tab === 'graph' && (
          <div className="repo-graph-panel">
            <GraphView graph={graph} highlightNodes={selectedDomain ? memory.domains.find((d) => d.id === selectedDomain)?.nodes : undefined} />
          </div>
        )}
        {tab === 'capabilities' && <CapabilitiesView memory={memory} />}
        {tab === 'smells' && <SmellsView smells={memory.smells} />}
        {tab === 'heatmap' && <HeatmapView heatmap={heatmap} />}
        {tab === 'journeys' && <JourneyMapView journeys={memory.journeys ?? []} flows={memory.flows} />}
        {tab === 'files' && (
          <RepositoryExplorer memory={memory} onSelectRepo={() => {}} onQuickInsight={handleQuickInsight} />
        )}
        {tab === 'history' && <BuildHistoryView history={history} memory={memory} />}
        {tab === 'terminal' && (
          <div className="repo-terminal-panel">
            <IntegratedTerminal repoId={repo.id} repositoryPath={repo.path} />
          </div>
        )}
        {tab === 'ai' && (
          <WorkspaceCopilot
            repoId={repo.id}
            repoName={repo.name}
            suggestedPrompts={suggestedPrompts}
            onAskAbout={handleCopilotTopic}
          />
        )}
        {tab === 'context' && (
          <div className="context-docs-view">
            <aside className="context-docs-nav">
              {contextDocs.map((doc) => (
                <button
                  key={doc}
                  type="button"
                  className={contextDoc === doc ? 'active' : ''}
                  onClick={() => setContextDoc(doc)}
                >
                  {doc.replace('.md', '')}
                </button>
              ))}
            </aside>
            <pre className="context-docs-content">{contextContent}</pre>
          </div>
        )}
      </div>

      {insightTarget && (
        <QuickInsights memory={memory} target={insightTarget} onClose={() => setInsightTarget(null)} />
      )}
    </div>
  );
}
