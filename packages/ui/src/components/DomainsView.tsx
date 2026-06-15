import type { Domain, Flow } from '../types';

interface DomainsViewProps {
  domains: Domain[];
  selectedId: string | null;
}

export function DomainsView({ domains, selectedId }: DomainsViewProps) {
  const selected = selectedId ? domains.find((d) => d.id === selectedId) : null;

  return (
    <div className="p-8">
      <h2 className="text-xl font-semibold mb-1">Domains</h2>
      <p className="text-sm text-[var(--color-text-secondary)] mb-6">
        {domains.length} logical domains discovered through path analysis and import-graph clustering
      </p>

      {selected ? (
        <div className="max-w-3xl">
          <div className="bg-[var(--color-surface-raised)] border border-[var(--color-border)] rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium">{selected.name}</h3>
              <span className="text-xs px-2 py-1 rounded-full bg-[var(--color-accent)]/10 text-[var(--color-accent-hover)]">
                {(selected.confidence * 100).toFixed(0)}% confidence
              </span>
            </div>
            <p className="text-sm text-[var(--color-text-secondary)] mb-4">{selected.description}</p>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-[var(--color-text-muted)] text-xs uppercase tracking-wider mb-2">Nodes</p>
                <p className="text-2xl font-semibold">{selected.nodes.length}</p>
              </div>
              <div>
                <p className="text-[var(--color-text-muted)] text-xs uppercase tracking-wider mb-2">Entry Points</p>
                <p className="text-2xl font-semibold">{selected.entryPoints.length}</p>
              </div>
            </div>
            {selected.entryPoints.length > 0 && (
              <div className="mt-4 pt-4 border-t border-[var(--color-border)]">
                <p className="text-xs text-[var(--color-text-muted)] uppercase tracking-wider mb-2">Entry Points</p>
                {selected.entryPoints.slice(0, 8).map((e) => (
                  <p key={e} className="text-xs font-mono text-[var(--color-text-secondary)] truncate py-0.5">
                    {e}
                  </p>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
          {domains.map((d) => (
            <div
              key={d.id}
              className="bg-[var(--color-surface-raised)] border border-[var(--color-border)] rounded-lg p-4 hover:border-[var(--color-accent)]/30 transition-colors"
            >
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-medium">{d.name}</h3>
                <span className="text-[10px] text-[var(--color-text-muted)]">
                  {(d.confidence * 100).toFixed(0)}%
                </span>
              </div>
              <p className="text-xs text-[var(--color-text-muted)] line-clamp-2 mb-3">{d.description}</p>
              <div className="flex gap-3 text-[10px] text-[var(--color-text-secondary)]">
                <span>{d.nodes.length} nodes</span>
                <span>{d.entryPoints.length} entries</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

interface FlowsViewProps {
  flows: Flow[];
}

export function FlowsView({ flows }: FlowsViewProps) {
  const grouped = flows.reduce<Record<string, Flow[]>>((acc, f) => {
    if (!acc[f.type]) acc[f.type] = [];
    acc[f.type].push(f);
    return acc;
  }, {});

  const typeLabels: Record<string, string> = {
    request: 'Request Flows',
    event: 'Event Flows',
    dependency: 'Dependency Flows',
    user_journey: 'User Journeys',
  };

  return (
    <div className="p-8">
      <h2 className="text-xl font-semibold mb-1">Execution Flows</h2>
      <p className="text-sm text-[var(--color-text-secondary)] mb-6">
        {flows.length} flows detected across the codebase
      </p>

      {Object.entries(grouped).map(([type, typeFlows]) => (
        <section key={type} className="mb-8">
          <h3 className="text-sm font-medium text-[var(--color-text-secondary)] mb-3">
            {typeLabels[type] ?? type} ({typeFlows.length})
          </h3>
          <div className="space-y-2">
            {typeFlows.slice(0, 15).map((flow) => (
              <div
                key={flow.id}
                className="bg-[var(--color-surface-raised)] border border-[var(--color-border)] rounded-lg p-4"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">{flow.name}</span>
                  <span className="text-[10px] text-[var(--color-text-muted)]">
                    {flow.steps.length} steps · {(flow.confidence * 100).toFixed(0)}%
                  </span>
                </div>
                <div className="flex items-center gap-1 overflow-x-auto pb-1">
                  {flow.steps.slice(0, 8).map((step, i) => (
                    <div key={i} className="flex items-center gap-1 shrink-0">
                      {i > 0 && <span className="text-[var(--color-text-muted)] text-xs">→</span>}
                      <span className="text-[10px] px-2 py-1 rounded bg-[var(--color-surface-overlay)] text-[var(--color-text-secondary)]">
                        {step.name.length > 20 ? step.name.slice(0, 20) + '…' : step.name}
                      </span>
                    </div>
                  ))}
                  {flow.steps.length > 8 && (
                    <span className="text-[10px] text-[var(--color-text-muted)]">
                      +{flow.steps.length - 8} more
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
