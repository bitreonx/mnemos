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
import { WorkspaceCopilot } from './WorkspaceCopilot';
import { TechStackView } from './TechStackView';
import { QuickInsights } from './QuickInsights';
import { BuildHistoryView } from './BuildHistoryView';
import { TimelineView } from './TimelineView';

export type RepoSection = 'overview' | 'architecture' | 'flows' | 'code' | 'history' | 'ai';

export type ArchSubView = 'systems' | 'domains' | 'graph' | 'logic' | 'canvas' | 'smells';
export type CodeSubView = 'map' | 'stack';
export type HistorySubView = 'builds' | 'timeline' | 'risk';
export type AISubView = 'copilot' | 'docs';

const SECTIONS: { id: RepoSection; label: string; desc: string }[] = [
  { id: 'overview', label: 'Overview', desc: 'Health, stats, quick start' },
  { id: 'architecture', label: 'Architecture', desc: 'Systems, domains, graph' },
  { id: 'flows', label: 'Flows', desc: 'Execution paths & journeys' },
  { id: 'code', label: 'Code Map', desc: 'Files & tech stack' },
  { id: 'history', label: 'History', desc: 'Builds, timeline, hotspots' },
  { id: 'ai', label: 'AI Context', desc: 'Copilot & agent docs' },
];

interface RepoWorkspaceProps {
  repo: RepoSnapshot;
  section: RepoSection;
  onSectionChange: (s: RepoSection) => void;
  onRefresh: () => void;
  pendingQuestion?: string | null;
  onPendingQuestionHandled?: () => void;
}

export function RepoWorkspace({
  repo,
  section,
  onSectionChange,
  onRefresh,
  pendingQuestion,
  onPendingQuestionHandled,
}: RepoWorkspaceProps) {
  const [archView, setArchView] = useState<ArchSubView>('systems');
  const [codeView, setCodeView] = useState<CodeSubView>('map');
  const [historyView, setHistoryView] = useState<HistorySubView>('builds');
  const [aiView, setAiView] = useState<AISubView>('copilot');
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
  const [contextDoc, setContextDoc] = useState('architecture.md');
  const [contextContent, setContextContent] = useState('');
  const [copilotSeed, setCopilotSeed] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const [data, hist] = await Promise.all([fetchRepoMemory(repo.id), fetchBuildHistory(repo.id)]);
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
    const handler = (e: Event) => {
      const target = (e as CustomEvent<string>).detail;
      if (target) setInsightTarget(target);
    };
    window.addEventListener('mnemos:quick-insight', handler);
    return () => window.removeEventListener('mnemos:quick-insight', handler);
  }, []);

  useEffect(() => {
    if (section === 'ai' && aiView === 'docs') {
      const base = repo.id === 'local' ? '/.mnemos/context' : `/.mnemos/${repo.id}/context`;
      fetch(`${base}/${contextDoc}`)
        .then((r) => (r.ok ? r.text() : 'Document not found'))
        .then(setContextContent)
        .catch(() => setContextContent('Failed to load document'));
    }
  }, [section, aiView, contextDoc, repo.id]);

  useEffect(() => {
    if (pendingQuestion) {
      setCopilotSeed(pendingQuestion);
      onSectionChange('ai');
      setAiView('copilot');
      onPendingQuestionHandled?.();
    }
  }, [pendingQuestion]);

  const handleBuild = async () => {
    setBuilding(true);
    await triggerBuild(repo.id);
    setTimeout(async () => {
      await load();
      onRefresh();
      setBuilding(false);
    }, 3000);
  };

  if (loading || !memory) {
    return (
      <div className="repo-workspace repo-workspace--loading">
        <div className="dash-loader" />
        <p>Loading {repo.name} intelligence…</p>
        <small>Reading memory model, graph, and agent context</small>
      </div>
    );
  }

  const contextDocs = [
    'architecture.md',
    'domains.md',
    'flows.md',
    'apis.md',
    'services.md',
    'critical_paths.md',
    'smells.md',
  ];

  const highlightNodes = selectedDomain
    ? memory.domains.find((d) => d.id === selectedDomain)?.nodes
    : undefined;

  return (
    <div className="repo-workspace repo-workspace--cockpit">
      <header className="repo-workspace-header" style={{ '--repo-accent': repo.accent } as React.CSSProperties}>
        <div className="repo-workspace-meta">
          <div>
            <p className="repo-workspace-label">{repo.label}</p>
            <h1>{repo.name}</h1>
            <p className="repo-workspace-desc">{memory.architecture.summary || repo.description}</p>
          </div>
          <div className="repo-workspace-actions">
            <span className="repo-meta-chip">{memory.architecture.type}</span>
            <span className={`status-pill status-pill--${repo.status}`}>Health {repo.health ?? healthScore?.overall ?? 0}</span>
            <span className="badge badge--lime">AI {repo.aiReadiness ?? 0}%</span>
            <button type="button" className="repo-build-btn repo-build-btn--inline" onClick={handleBuild} disabled={building}>
              {building ? 'Building…' : 'Run Mnemos'}
            </button>
          </div>
        </div>

        <nav className="repo-section-nav" aria-label="Workspace sections">
          {SECTIONS.map((s) => (
            <button
              key={s.id}
              type="button"
              className={`repo-section-btn ${section === s.id ? 'repo-section-btn--active' : ''}`}
              onClick={() => onSectionChange(s.id)}
            >
              <strong>{s.label}</strong>
              <span>{s.desc}</span>
            </button>
          ))}
        </nav>
      </header>

      <div className="repo-workspace-body">
        {section === 'overview' && (
          <div className="repo-tab-panel">
            <Overview memory={memory} healthScore={healthScore} />
            <div className="repo-quick-grid">
              <button type="button" className="repo-quick-card" onClick={() => onSectionChange('architecture')}>
                <strong>Architecture</strong>
                <span>{memory.domains.length} domains · {memory.services.length} services</span>
              </button>
              <button type="button" className="repo-quick-card" onClick={() => onSectionChange('flows')}>
                <strong>Flows</strong>
                <span>{memory.flows.length} execution paths</span>
              </button>
              <button type="button" className="repo-quick-card" onClick={() => onSectionChange('ai')}>
                <strong>Ask Mnemos</strong>
                <span>Auth, impact, routing</span>
              </button>
            </div>
            <TechStackView memory={memory} />
          </div>
        )}

        {section === 'architecture' && (
          <div className="repo-sub-layout">
            <aside className="repo-sub-nav">
              {(
                [
                  ['systems', 'Systems'],
                  ['domains', 'Domains'],
                  ['graph', 'Dependency Graph'],
                  ['logic', 'Capabilities'],
                  ['canvas', 'Canvas'],
                  ['smells', 'Smells'],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  className={archView === id ? 'active' : ''}
                  onClick={() => setArchView(id)}
                >
                  {label}
                </button>
              ))}
            </aside>
            <div className="repo-sub-content">
              {archView === 'systems' && (
                <SystemAnalyzer memory={memory} onQuickInsight={setInsightTarget} />
              )}
              {archView === 'domains' && (
                <DomainsView domains={memory.domains} selectedId={selectedDomain} />
              )}
              {archView === 'graph' && (
                <div className="repo-graph-panel">
                  <GraphView graph={graph} highlightNodes={highlightNodes} />
                </div>
              )}
              {archView === 'logic' && <CapabilitiesView memory={memory} />}
              {archView === 'canvas' && (
                <div className="h-full">
                  <ArchitectureCanvas memory={memory} />
                </div>
              )}
              {archView === 'smells' && <SmellsView smells={memory.smells} />}
            </div>
          </div>
        )}

        {section === 'flows' && (
          <div className="repo-sub-layout">
            <FlowsView flows={memory.flows} />
            <JourneyMapView journeys={memory.journeys ?? []} flows={memory.flows} />
          </div>
        )}

        {section === 'code' && (
          <div className="repo-sub-layout">
            <aside className="repo-sub-nav">
              <button type="button" className={codeView === 'map' ? 'active' : ''} onClick={() => setCodeView('map')}>
                File Map
              </button>
              <button type="button" className={codeView === 'stack' ? 'active' : ''} onClick={() => setCodeView('stack')}>
                Tech Stack
              </button>
            </aside>
            <div className="repo-sub-content">
              {codeView === 'map' ? (
                <RepositoryExplorer memory={memory} onSelectRepo={() => {}} onQuickInsight={setInsightTarget} />
              ) : (
                <TechStackView memory={memory} />
              )}
            </div>
          </div>
        )}

        {section === 'history' && (
          <div className="repo-sub-layout">
            <aside className="repo-sub-nav">
              <button type="button" className={historyView === 'builds' ? 'active' : ''} onClick={() => setHistoryView('builds')}>
                Build History
              </button>
              <button type="button" className={historyView === 'timeline' ? 'active' : ''} onClick={() => setHistoryView('timeline')}>
                Activity
              </button>
              <button type="button" className={historyView === 'risk' ? 'active' : ''} onClick={() => setHistoryView('risk')}>
                Risk Heatmap
              </button>
            </aside>
            <div className="repo-sub-content">
              {historyView === 'builds' && <BuildHistoryView history={history} memory={memory} />}
              {historyView === 'timeline' && <TimelineView memory={memory} />}
              {historyView === 'risk' && <HeatmapView heatmap={heatmap} />}
            </div>
          </div>
        )}

        {section === 'ai' && (
          <div className="repo-sub-layout repo-sub-layout--ai">
            <aside className="repo-sub-nav">
              <button type="button" className={aiView === 'copilot' ? 'active' : ''} onClick={() => setAiView('copilot')}>
                Copilot
              </button>
              <button type="button" className={aiView === 'docs' ? 'active' : ''} onClick={() => setAiView('docs')}>
                Context Docs
              </button>
            </aside>
            <div className="repo-sub-content">
              {aiView === 'copilot' ? (
                <WorkspaceCopilot
                  repoId={repo.id}
                  repoName={repo.name}
                  suggestedPrompts={suggestedPrompts}
                  seedQuestion={copilotSeed}
                  onSeedHandled={() => setCopilotSeed(null)}
                />
              ) : (
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
          </div>
        )}
      </div>

      {insightTarget && (
        <QuickInsights memory={memory} target={insightTarget} onClose={() => setInsightTarget(null)} />
      )}
    </div>
  );
}

export function sectionFromNav(view: string): RepoSection {
  const map: Record<string, RepoSection> = {
    home: 'overview',
    overview: 'overview',
    architecture: 'architecture',
    systems: 'architecture',
    flows: 'flows',
    code: 'code',
    history: 'history',
    ai: 'ai',
  };
  return map[view] ?? 'overview';
}
