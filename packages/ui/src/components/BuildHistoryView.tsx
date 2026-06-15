import type { MemoryModel } from '../types';
import type { BuildHistoryEntry } from '../lib/workspace';

interface BuildHistoryViewProps {
  history: BuildHistoryEntry[];
  memory: MemoryModel;
}

export function BuildHistoryView({ history, memory }: BuildHistoryViewProps) {
  const entries = history.length > 0 ? history : [{
    builtAt: memory.builtAt,
    files: memory.stats.filesScanned,
    domains: memory.stats.domainsFound,
    flows: memory.stats.flowsFound,
    health: 0,
    aiReadiness: 0,
    durationMs: memory.stats.durationMs,
    capabilities: (memory.capabilities ?? []).length,
    smells: memory.smells.length,
  }];

  return (
    <div className="build-history-view">
      <header className="bh-header">
        <h2>⏱ Build History</h2>
        <p>Track how repository intelligence evolves across Mnemos runs</p>
      </header>

      <div className="bh-stats">
        <div className="hero-stat-card"><p>Runs</p><h3>{entries.length}</h3></div>
        <div className="hero-stat-card"><p>Latest files</p><h3>{entries[0]?.files.toLocaleString()}</h3></div>
        <div className="hero-stat-card"><p>Latest health</p><h3>{entries[0]?.health || '—'}</h3></div>
        <div className="hero-stat-card"><p>Last duration</p><h3>{((entries[0]?.durationMs ?? 0) / 1000).toFixed(1)}s</h3></div>
      </div>

      <div className="bh-timeline">
        {entries.map((entry, i) => (
          <article key={entry.builtAt + i} className="bh-entry">
            <div className="bh-marker">{i === 0 ? '●' : '○'}</div>
            <div className="bh-content glass-card">
              <div className="bh-entry-head">
                <strong>{new Date(entry.builtAt).toLocaleString()}</strong>
                {i === 0 && <span className="delta-pill delta-pill--up">Latest</span>}
              </div>
              <div className="bh-metrics">
                <span>{entry.files} files</span>
                <span>{entry.domains} domains</span>
                <span>{entry.flows} flows</span>
                <span>health {entry.health || '—'}</span>
                <span>AI {entry.aiReadiness || '—'}%</span>
                <span>{entry.smells} smells</span>
                <span>{(entry.durationMs / 1000).toFixed(1)}s</span>
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
