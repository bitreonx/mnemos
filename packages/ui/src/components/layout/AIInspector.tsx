import { useEffect, useMemo, useState } from 'react';
import type { MemoryModel } from '../../types';
import type { RepoSnapshot } from '../../lib/workspace';
import { fetchContextDoc } from '../../lib/workspace';

interface AIInspectorProps {
  repo: RepoSnapshot | null;
  memory: MemoryModel | null;
  onNavigate: (view: string) => void;
  onAsk: (question: string) => void;
  onQuickInsight: (target: string) => void;
}

const START_HERE = [
  { id: 'auth', label: 'Understand auth', question: 'How does authentication work? Where are entry points, middleware, and session logic?' },
  { id: 'routes', label: 'Trace routing', question: 'Where does routing live and how are HTTP/API routes structured?' },
  { id: 'data', label: 'DB write paths', question: 'Where does data persistence happen and what are the main write paths?' },
  { id: 'impact', label: 'Impact analysis', question: 'What are critical paths and what breaks if core services change?' },
];

export function AIInspector({ repo, memory, onNavigate, onAsk, onQuickInsight }: AIInspectorProps) {
  const [architectureSnippet, setArchitectureSnippet] = useState<string>('');

  useEffect(() => {
    if (!repo) {
      setArchitectureSnippet('');
      return;
    }
    fetchContextDoc(repo.id, 'architecture.md').then((doc) => {
      if (doc) setArchitectureSnippet(doc.slice(0, 1200));
    });
  }, [repo?.id]);

  const authCapability = useMemo(
    () => memory?.capabilities?.find((c) => c.signature.id === 'authentication' || c.signature.name.toLowerCase().includes('auth')),
    [memory],
  );

  const authFlows = useMemo(
    () => memory?.flows.filter((f) => /auth|login|session|token/i.test(f.name)) ?? [],
    [memory],
  );

  const topRoutes = useMemo(() => memory?.apis.slice(0, 8) ?? [], [memory]);

  const relatedAuthFiles = useMemo(() => {
    const files = new Set<string>();
    authFlows.forEach((f) => f.steps.forEach((s) => s.path && files.add(s.path)));
    authCapability?.apis.forEach((a) => files.add(a));
    return [...files].slice(0, 10);
  }, [authFlows, authCapability]);

  if (!repo) {
    return (
      <aside className="cockpit-inspector">
        <header className="inspector-header">
          <h3>AI Context</h3>
          <p>Select a repository to see architecture summaries, auth entry points, and agent-ready context.</p>
        </header>
        <section className="inspector-section">
          <h4>How agents use Mnemos</h4>
          <ol className="inspector-steps">
            <li>Read <code>.mnemos/project.dna.json</code> first</li>
            <li>Use AI Inspector for auth, routes, flows</li>
            <li>Run <code>ask "question"</code> in terminal</li>
            <li>Check impact before editing core services</li>
          </ol>
        </section>
        <section className="inspector-section">
          <h4>Quick platform tasks</h4>
          <div className="inspector-chips">
            {START_HERE.map((t) => (
              <button key={t.id} type="button" className="inspector-chip" disabled>
                {t.label}
              </button>
            ))}
          </div>
          <p className="inspector-muted">Open a repo to enable contextual AI tasks.</p>
        </section>
      </aside>
    );
  }

  return (
    <aside className="cockpit-inspector">
      <header className="inspector-header">
        <h3>AI Context</h3>
        <p>{repo.name} · agent-ready summaries from Mnemos memory</p>
      </header>

      <section className="inspector-section">
        <h4>Start here</h4>
        <div className="inspector-chips">
          {START_HERE.map((t) => (
            <button
              key={t.id}
              type="button"
              className="inspector-chip"
              onClick={() => {
                onAsk(t.question);
                onNavigate('ai');
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
      </section>

      {authCapability || authFlows.length > 0 ? (
        <section className="inspector-section">
          <h4>Auth summary</h4>
          <p className="inspector-summary">
            {authCapability?.signature.purpose ??
              `${authFlows.length} auth-related flow(s) detected. Entry: ${authFlows[0]?.entryPoint ?? 'see flows'}`}
          </p>
          {relatedAuthFiles.length > 0 && (
            <ul className="inspector-file-list">
              {relatedAuthFiles.map((f) => (
                <li key={f}>
                  <button type="button" onClick={() => onQuickInsight(f)}>
                    {f}
                  </button>
                </li>
              ))}
            </ul>
          )}
          <button type="button" className="inspector-link" onClick={() => onNavigate('architecture')}>
            Open Systems view →
          </button>
        </section>
      ) : null}

      {topRoutes.length > 0 && (
        <section className="inspector-section">
          <h4>Routes & APIs</h4>
          <ul className="inspector-route-list">
            {topRoutes.map((api) => (
              <li key={api.id}>
                <code>{api.method}</code> {api.path}
              </li>
            ))}
          </ul>
          <button type="button" className="inspector-link" onClick={() => onNavigate('architecture')}>
            View full API map →
          </button>
        </section>
      )}

      {memory && (
        <section className="inspector-section">
          <h4>Repo snapshot</h4>
          <div className="inspector-stats">
            <div><strong>{memory.stats.filesScanned}</strong><span>files</span></div>
            <div><strong>{memory.domains.length}</strong><span>domains</span></div>
            <div><strong>{memory.flows.length}</strong><span>flows</span></div>
            <div><strong>{memory.smells.length}</strong><span>smells</span></div>
          </div>
          <p className="inspector-summary">{memory.architecture.summary}</p>
        </section>
      )}

      {architectureSnippet && (
        <section className="inspector-section">
          <h4>Architecture excerpt</h4>
          <pre className="inspector-excerpt">{architectureSnippet}{architectureSnippet.length >= 1200 ? '…' : ''}</pre>
          <button type="button" className="inspector-link" onClick={() => onNavigate('ai')}>
            Open context docs →
          </button>
        </section>
      )}
    </aside>
  );
}
