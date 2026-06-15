import type { Smell } from '../types';

interface SmellsViewProps {
  smells: Smell[];
}

const SEVERITY_COLORS = {
  high: 'text-red-400 bg-red-400/10 border-red-400/20',
  medium: 'text-amber-400 bg-amber-400/10 border-amber-400/20',
  low: 'text-blue-400 bg-blue-400/10 border-blue-400/20',
};

export function SmellsView({ smells }: SmellsViewProps) {
  const grouped = smells.reduce<Record<string, Smell[]>>((acc, s) => {
    if (!acc[s.severity]) acc[s.severity] = [];
    acc[s.severity].push(s);
    return acc;
  }, {});

  return (
    <div className="p-8 max-w-4xl">
      <h2 className="text-xl font-semibold mb-1">Architecture Smells</h2>
      <p className="text-sm text-[var(--color-text-secondary)] mb-6">
        {smells.length} potential issues detected
      </p>

      {smells.length === 0 ? (
        <div className="text-center py-16 text-[var(--color-text-muted)]">
          <p className="text-4xl mb-2">✓</p>
          <p>No architecture smells detected</p>
        </div>
      ) : (
        ['high', 'medium', 'low'].map((severity) => {
          const items = grouped[severity];
          if (!items?.length) return null;

          return (
            <section key={severity} className="mb-8">
              <h3 className={`text-sm font-medium mb-3 capitalize ${SEVERITY_COLORS[severity as keyof typeof SEVERITY_COLORS]?.split(' ')[0]}`}>
                {severity} ({items.length})
              </h3>
              <div className="space-y-2">
                {items.map((s) => (
                  <div
                    key={s.id}
                    className={`border rounded-lg p-4 ${SEVERITY_COLORS[s.severity]}`}
                  >
                    <p className="text-sm font-medium mb-1">
                      {s.type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                    </p>
                    <p className="text-xs opacity-80 mb-2">{s.description}</p>
                    <p className="text-xs opacity-60">
                      <span className="font-medium">Fix:</span> {s.recommendation}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          );
        })
      )}
    </div>
  );
}
