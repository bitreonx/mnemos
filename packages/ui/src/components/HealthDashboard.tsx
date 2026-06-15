import { useCallback, useEffect, useState } from 'react';
import {
  fetchWorkspace,
  triggerBuild,
  type RepoSnapshot,
  type WorkspaceSummary,
} from '../lib/workspace';
import { RepoWorkspace } from './RepoWorkspace';

function healthColor(score: number): string {
  if (score >= 80) return '#22c55e';
  if (score >= 60) return '#c8f542';
  if (score >= 40) return '#f59e0b';
  return '#ef4444';
}

function MetricRing({ value, label, color, size = 120 }: { value: number; label: string; color: string; size?: number }) {
  const r = (size - 12) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (value / 100) * c;
  return (
    <div className="metric-ring" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(0,0,0,0.06)" strokeWidth="10" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <div className="metric-ring-center">
        <span className="metric-ring-value">{value}</span>
        <span className="metric-ring-label">{label}</span>
      </div>
    </div>
  );
}

function RepoHealthCard({
  repo,
  onBuild,
  onOpen,
  selected,
}: {
  repo: RepoSnapshot;
  onBuild: (id: string) => void;
  onOpen: (id: string) => void;
  selected: boolean;
}) {
  const health = repo.health ?? 0;
  const isBuilding = repo.status === 'building';
  const isMissing = repo.status === 'missing';

  return (
    <article
      className={`repo-card ${selected ? 'repo-card--active' : ''}`}
      style={{ '--repo-accent': repo.accent } as React.CSSProperties}
    >
      <div className="repo-card-header">
        <div>
          <p className="repo-card-label">{repo.label}</p>
          <h3 className="repo-card-name">{repo.name}</h3>
        </div>
        <span className={`status-pill status-pill--${repo.status}`}>
          {isBuilding ? 'Analyzing…' : isMissing ? 'Not scanned' : 'Ready'}
        </span>
      </div>
      <p className="repo-card-desc">{repo.description}</p>

      {repo.status === 'ready' && repo.stats ? (
        <>
          <div className="repo-card-health">
            <MetricRing value={health} label="Health" color={healthColor(health)} size={100} />
            <div className="repo-card-metrics">
              <div><strong>{repo.stats.files.toLocaleString()}</strong><span>Files</span></div>
              <div><strong>{repo.stats.domains}</strong><span>Domains</span></div>
              <div><strong>{repo.stats.flows}</strong><span>Flows</span></div>
              <div><strong>{repo.stats.capabilities}</strong><span>Capabilities</span></div>
              <div><strong>{repo.stats.smells}</strong><span>Smells</span></div>
            </div>
          </div>
          {repo.aiReadiness != null && (
            <p className="repo-card-ai">AI readiness <strong>{repo.aiReadiness}%</strong></p>
          )}
          {repo.mostCritical && (
            <p className="repo-card-foot">Critical: <strong>{repo.mostCritical}</strong></p>
          )}
          {repo.topCapabilities && repo.topCapabilities.length > 0 && (
            <div className="repo-cap-preview">
              {repo.topCapabilities.slice(0, 3).map((c) => (
                <span key={c} className="cap-chip cap-chip--sm">{c}</span>
              ))}
            </div>
          )}
        </>
      ) : (
        <div className="repo-card-empty">
          <p>Run Mnemos to discover architecture, flows, and health.</p>
        </div>
      )}

      <div className="repo-card-actions">
        <button
          type="button"
          className="repo-open-btn"
          onClick={() => onOpen(repo.id)}
          disabled={repo.status !== 'ready'}
        >
          Open Explorer →
        </button>
        <button
          type="button"
          className="repo-build-btn repo-build-btn--sm"
          onClick={() => onBuild(repo.id)}
          disabled={isBuilding}
        >
          {isBuilding ? '⏳' : '⚡ Run'}
        </button>
      </div>
    </article>
  );
}

export function HealthDashboard() {
  const [workspace, setWorkspace] = useState<WorkspaceSummary | null>(null);
  const [openRepoId, setOpenRepoId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [buildingAll, setBuildingAll] = useState(false);
  const [search, setSearch] = useState('');

  const refresh = useCallback(async () => {
    const ws = await fetchWorkspace();
    setWorkspace(ws);
    return ws;
  }, []);

  useEffect(() => {
    refresh().finally(() => setLoading(false));
    const interval = setInterval(() => refresh(), 12000);
    return () => clearInterval(interval);
  }, [refresh]);

  const handleBuild = async (repoId: string) => {
    await triggerBuild(repoId);
    setTimeout(refresh, 2500);
  };

  const handleBuildAll = async () => {
    if (!workspace) return;
    setBuildingAll(true);
    for (const repo of workspace.repos) {
      await triggerBuild(repo.id);
    }
    setBuildingAll(false);
    setTimeout(refresh, 4000);
  };

  if (loading) {
    return (
      <div className="dash-loading">
        <div className="dash-loader" />
        <p>Loading Dabt Platform intelligence…</p>
      </div>
    );
  }

  const openRepo = openRepoId ? workspace?.repos.find((r) => r.id === openRepoId) : null;

  if (openRepo) {
    return (
      <div className="health-dashboard health-dashboard--explorer">
        <RepoWorkspace repo={openRepo} onBack={() => setOpenRepoId(null)} onRefresh={refresh} />
      </div>
    );
  }

  const readyCount = workspace?.repos.filter((r) => r.status === 'ready').length ?? 0;
  const avgAiReadiness = readyCount
    ? Math.round(
        (workspace?.repos.filter((r) => r.status === 'ready').reduce((s, r) => s + (r.aiReadiness ?? 0), 0) ?? 0) /
          readyCount,
      )
    : 0;
  const q = search.trim().toLowerCase();
  const filteredRepos =
    workspace?.repos.filter(
      (r) =>
        !q ||
        r.name.toLowerCase().includes(q) ||
        r.label.toLowerCase().includes(q) ||
        r.description.toLowerCase().includes(q),
    ) ?? [];

  return (
    <div className="health-dashboard">
      <aside className="dash-sidebar">
        <div className="dash-brand">
          <span className="dash-logo">◆</span>
          <div>
            <strong>Mnemos</strong>
            <small>Memory Engine</small>
          </div>
        </div>
        <nav className="dash-nav">
          <a className="dash-nav-item active">Health Overview</a>
          <a className="dash-nav-item" href="#repos">Repositories</a>
        </nav>
        <div className="dash-sidebar-info">
          <p className="dash-sidebar-tip">
            <strong>Tip:</strong> Open any repo to explore flows, systems, tech stack, terminal, and AI copilot.
          </p>
        </div>
        <div className="dash-sidebar-cta">
          <p>Analyze all 3 Dabt apps with one click.</p>
          <button type="button" className="dash-cta-btn" onClick={handleBuildAll} disabled={buildingAll}>
            {buildingAll ? 'Running…' : '⚡ Analyze All'}
          </button>
        </div>
      </aside>

      <main className="dash-main">
        <header className="dash-topbar">
          <div>
            <p className="dash-date">
              {new Date().toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
            <h1>Platform Health Overview</h1>
            <p className="dash-subtitle">Take control of your codebase — {workspace?.workspace}</p>
          </div>
          <div className="dash-topbar-actions">
            <input
              className="dash-search"
              placeholder="Search repositories…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <button type="button" className="dash-icon-btn" title="Refresh" onClick={() => refresh()}>
              ↻
            </button>
          </div>
        </header>

        <section className="dash-hero-stats">
          <div className="hero-stat-card hero-stat-card--primary">
            <p>Aggregate Health</p>
            <div className="hero-stat-row">
              <MetricRing
                value={workspace?.aggregateHealth ?? 0}
                label="Score"
                color={healthColor(workspace?.aggregateHealth ?? 0)}
                size={140}
              />
              <div>
                <h2>
                  {workspace?.aggregateHealth ?? 0}
                  <small>/100</small>
                </h2>
                <span className="delta-pill delta-pill--up">{readyCount}/3 repos analyzed</span>
              </div>
            </div>
          </div>
          <div className="hero-stat-card">
            <p>Total Files</p>
            <h3>{(workspace?.totalFiles ?? 0).toLocaleString()}</h3>
            <span className="hero-stat-meta">Across platform</span>
          </div>
          <div className="hero-stat-card">
            <p>Domains</p>
            <h3>{workspace?.totalDomains ?? 0}</h3>
            <span className="hero-stat-meta">Discovered</span>
          </div>
          <div className="hero-stat-card">
            <p>Flows</p>
            <h3>{workspace?.totalFlows ?? 0}</h3>
            <span className="hero-stat-meta">Traced</span>
          </div>
          <div className="hero-stat-card hero-stat-card--ai">
            <p>AI Readiness</p>
            <h3>
              {avgAiReadiness}
              <small>%</small>
            </h3>
            <span className="hero-stat-meta">Platform average</span>
          </div>
        </section>

        <section className="dash-feature-strip">
          <div className="feature-pill">⬡ Systems & auth patterns</div>
          <div className="feature-pill">→ Execution flows</div>
          <div className="feature-pill">$_ Mnemos terminal</div>
          <div className="feature-pill">✨ AI copilot (mnemos ask)</div>
          <div className="feature-pill">⏱ Build history</div>
        </section>

        <section className="dash-repos" id="repos">
          <h2 className="section-title">Repositories — click Open Explorer</h2>
          <div className="repo-grid">
            {filteredRepos.map((repo) => (
              <RepoHealthCard
                key={repo.id}
                repo={repo}
                onBuild={handleBuild}
                onOpen={setOpenRepoId}
                selected={false}
              />
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
