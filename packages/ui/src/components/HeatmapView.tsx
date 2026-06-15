import type { HeatmapEntry } from '../types';

interface HeatmapViewProps {
  heatmap: HeatmapEntry[];
}

function riskColor(risk: string): string {
  if (risk === 'high') return 'text-red-400';
  if (risk === 'medium') return 'text-amber-400';
  return 'text-green-400';
}

function riskBg(risk: string): string {
  if (risk === 'high') return 'bg-red-500/10 border-red-500/20';
  if (risk === 'medium') return 'bg-amber-500/10 border-amber-500/20';
  return 'bg-green-500/10 border-green-500/20';
}

export function HeatmapView({ heatmap }: HeatmapViewProps) {
  const sorted = [...heatmap].sort((a, b) => b.riskScore - a.riskScore);

  return (
    <div className="p-8 max-w-4xl">
      <div className="mb-6">
        <h2 className="text-2xl font-semibold tracking-tight mb-1">Technical Debt Heatmap</h2>
        <p className="text-sm text-[var(--color-text-secondary)]">
          Domain-level risk scores from smells, coupling, and dead code.
        </p>
      </div>

      <div className="space-y-4">
        {sorted.map((entry) => (
          <div
            key={entry.domainId}
            className={`border rounded-lg p-5 ${riskBg(entry.risk)}`}
          >
            <div className="flex items-start justify-between mb-3">
              <div>
                <div className="flex items-center gap-2">
                  {entry.risk === 'high' && <span className="text-lg">🔥</span>}
                  <h3 className="text-sm font-semibold">{entry.domain}</h3>
                </div>
                <p className={`text-xs mt-1 uppercase tracking-wider ${riskColor(entry.risk)}`}>
                  Risk: {entry.riskScore} · {entry.risk}
                </p>
              </div>
              <div className="text-right text-[10px] text-[var(--color-text-muted)]">
                <p>{entry.services} services</p>
                <p>{entry.apis} APIs</p>
              </div>
            </div>

            {entry.problems.length > 0 ? (
              <div>
                <p className="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)] mb-2">
                  Problems
                </p>
                <ul className="space-y-1">
                  {entry.problems.map((p: string) => (
                    <li key={p} className="text-xs text-[var(--color-text-secondary)]">
                      • {p}
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="text-xs text-[var(--color-text-muted)]">No significant issues detected.</p>
            )}
          </div>
        ))}

        {sorted.length === 0 && (
          <p className="text-sm text-[var(--color-text-muted)]">
            No heatmap data. Run mnemos build to generate heatmap.json.
          </p>
        )}
      </div>
    </div>
  );
}
