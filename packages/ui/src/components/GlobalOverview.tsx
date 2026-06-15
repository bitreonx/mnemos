import type { RepoSnapshot, WorkspaceSummary } from '../lib/workspace';

interface GlobalOverviewProps {
  workspace: WorkspaceSummary;
  onOpenRepo: (id: string) => void;
  onBuild: (id: string) => void;
  onBuildAll: () => void;
  buildingAll: boolean;
}

function healthColor(score: number): string {
  if (score >= 80) return 'var(--cockpit-good)';
  if (score >= 60) return 'var(--cockpit-ok)';
  if (score >= 40) return 'var(--cockpit-warn)';
  return 'var(--cockpit-bad)';
}

export function GlobalOverview({ workspace, onOpenRepo, onBuild, onBuildAll, buildingAll }: GlobalOverviewProps) {
  const ready = workspace.repos.filter((r) => r.status === 'ready');
  const missing = workspace.repos.filter((r) => r.status === 'missing');
  const avgAi =
    ready.length > 0
      ? Math.round(ready.reduce((s, r) => s + (r.aiReadiness ?? 0), 0) / ready.length)
      : 0;

  return (
    <div className="global-overview">
      <section className="go-hero">
        <div>
          <p className="go-kicker">Repository intelligence cockpit</p>
          <h1>{workspace.workspace}</h1>
          <p className="go-lead">
            Understand architecture, flows, auth, stack, and history across every project — built for developers and AI agents.
          </p>
        </div>
        <div className="go-hero-actions">
          <button type="button" className="go-primary-btn" onClick={onBuildAll} disabled={buildingAll}>
            {buildingAll ? 'Analyzing all…' : 'Analyze all repositories'}
          </button>
        </div>
      </section>

      <section className="go-metrics">
        <article className="go-metric go-metric--hero">
          <span>Aggregate health</span>
          <strong style={{ color: healthColor(workspace.aggregateHealth) }}>{workspace.aggregateHealth}</strong>
          <small>{ready.length}/{workspace.repos.length} repos ready</small>
        </article>
        <article className="go-metric">
          <span>Files indexed</span>
          <strong>{workspace.totalFiles.toLocaleString()}</strong>
        </article>
        <article className="go-metric">
          <span>Domains</span>
          <strong>{workspace.totalDomains}</strong>
        </article>
        <article className="go-metric">
          <span>Flows traced</span>
          <strong>{workspace.totalFlows}</strong>
        </article>
        <article className="go-metric">
          <span>AI readiness</span>
          <strong>{avgAi}%</strong>
        </article>
      </section>

      <section className="go-capabilities">
        <h2>What you can do here</h2>
        <div className="go-cap-grid">
          <article>
            <h3>Explore systems</h3>
            <p>Architecture, domains, dependency graphs, and detected auth/API/data patterns.</p>
          </article>
          <article>
            <h3>Trace flows</h3>
            <p>Execution paths, user journeys, and request/data flow across modules.</p>
          </article>
          <article>
            <h3>Ask AI context</h3>
            <p>Inspector panel + copilot powered by <code>mnemos ask</code> — not raw grep.</p>
          </article>
          <article>
            <h3>Run in terminal</h3>
            <p>Embedded Mnemos CLI: build, ask, flows, impact, dna — repo-scoped.</p>
          </article>
        </div>
      </section>

      {missing.length > 0 && (
        <section className="go-alert">
          <strong>{missing.length} repo(s) not scanned.</strong> Run Mnemos build to generate memory models and unlock exploration.
        </section>
      )}

      <section className="go-repos">
        <div className="go-section-head">
          <h2>Repositories</h2>
          <p>Open any repo for the full workspace: overview, architecture, flows, code map, history, AI.</p>
        </div>
        <div className="go-repo-grid">
          {workspace.repos.map((repo) => (
            <RepoCard key={repo.id} repo={repo} onOpen={onOpenRepo} onBuild={onBuild} />
          ))}
        </div>
      </section>

      <section className="go-onboard">
        <h2>Onboarding</h2>
        <ol>
          <li>Select a repository from the left rail or cards below.</li>
          <li>Press <kbd>Ctrl K</kbd> for commands — auth, routes, impact analysis.</li>
          <li>Open the AI Inspector (<kbd>Ctrl I</kbd>) for auth summaries and related files.</li>
          <li>Toggle terminal (<kbd>Ctrl `</kbd>) to run <code>ask "how does auth work?"</code>.</li>
          <li>Use Capture to screenshot views for docs, PRs, or demos.</li>
        </ol>
      </section>
    </div>
  );
}

function RepoCard({
  repo,
  onOpen,
  onBuild,
}: {
  repo: RepoSnapshot;
  onOpen: (id: string) => void;
  onBuild: (id: string) => void;
}) {
  const ready = repo.status === 'ready';
  return (
    <article className="go-repo-card" style={{ '--repo-accent': repo.accent } as React.CSSProperties}>
      <header>
        <div>
          <small>{repo.label}</small>
          <h3>{repo.name}</h3>
        </div>
        <span className={`go-status go-status--${repo.status}`}>{repo.status}</span>
      </header>
      <p>{repo.description}</p>
      {ready && repo.stats && (
        <div className="go-repo-stats">
          <span>Health <strong>{repo.health}</strong></span>
          <span>{repo.stats.files} files</span>
          <span>{repo.stats.flows} flows</span>
          <span>AI {repo.aiReadiness}%</span>
        </div>
      )}
      {repo.topCapabilities && repo.topCapabilities.length > 0 && (
        <div className="go-chips">
          {repo.topCapabilities.slice(0, 3).map((c) => (
            <span key={c}>{c}</span>
          ))}
        </div>
      )}
      <footer>
        <button type="button" className="go-open-btn" disabled={!ready} onClick={() => onOpen(repo.id)}>
          Open workspace
        </button>
        <button type="button" className="go-build-btn" disabled={repo.status === 'building'} onClick={() => onBuild(repo.id)}>
          {repo.status === 'building' ? '…' : 'Build'}
        </button>
      </footer>
    </article>
  );
}
