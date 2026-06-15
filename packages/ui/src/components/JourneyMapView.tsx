import type { DiscoveredJourney } from '../types';

interface JourneyMapViewProps {
  journeys: DiscoveredJourney[];
  flows: Array<{ id: string; name: string; type: string; steps: Array<{ name: string; kind: string; path?: string }> }>;
}

function JourneyCard({
  title,
  subtitle,
  steps,
  actors,
  outcomes,
}: {
  title: string;
  subtitle: string;
  steps: string[];
  actors?: string[];
  outcomes?: string[];
}) {
  return (
    <div className="bg-[var(--color-surface-raised)] border border-[var(--color-border)] rounded-lg p-5">
      <div className="mb-4">
        <h3 className="text-sm font-semibold">{title}</h3>
        <p className="text-xs text-[var(--color-text-muted)] mt-1">{subtitle}</p>
      </div>

      {actors && actors.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-1">
          {actors.map((a) => (
            <span
              key={a}
              className="text-[10px] px-2 py-0.5 rounded-full bg-[var(--color-accent)]/10 text-[var(--color-accent-hover)]"
            >
              {a}
            </span>
          ))}
        </div>
      )}

      <div className="flex flex-col items-center gap-0 py-2">
        {steps.map((step, i) => (
          <div key={`${step}-${i}`} className="flex flex-col items-center w-full">
            <div className="w-full max-w-md bg-[var(--color-surface-overlay)] border border-[var(--color-border)] rounded-md px-4 py-2.5 text-center">
              <span className="text-sm">{step}</span>
            </div>
            {i < steps.length - 1 && (
              <div className="text-[var(--color-text-muted)] text-lg leading-none py-1">↓</div>
            )}
          </div>
        ))}
      </div>

      {outcomes && outcomes.length > 0 && (
        <div className="mt-4 pt-3 border-t border-[var(--color-border)]">
          <p className="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)] mb-1">Outcomes</p>
          <p className="text-xs text-[var(--color-text-secondary)]">{outcomes.join(' · ')}</p>
        </div>
      )}
    </div>
  );
}

export function JourneyMapView({ journeys, flows }: JourneyMapViewProps) {
  const userJourneyFlows = flows.filter((f) => f.type === 'user_journey');
  const displayJourneys = journeys.length > 0 ? journeys : [];
  const displayFlows = userJourneyFlows.length > 0 ? userJourneyFlows : flows.slice(0, 6);

  return (
    <div className="p-8 max-w-4xl">
      <div className="mb-6">
        <h2 className="text-2xl font-semibold tracking-tight mb-1">Visual Journey Maps</h2>
        <p className="text-sm text-[var(--color-text-secondary)]">
          End-to-end flows through the system — actors, steps, and outcomes.
        </p>
      </div>

      <div className="space-y-6">
        {displayJourneys.map((j) => (
          <JourneyCard
            key={j.id}
            title={j.signature.name}
            subtitle={j.signature.purpose}
            actors={j.actors}
            outcomes={j.outcomes}
            steps={
              j.steps.length > 0
                ? j.steps.map((s) => s.name)
                : [j.entryPoint, ...j.systems.slice(0, 3), ...j.outcomes.slice(0, 1)].filter(Boolean)
            }
          />
        ))}

        {displayJourneys.length === 0 &&
          displayFlows.map((f) => (
            <JourneyCard
              key={f.id}
              title={f.name}
              subtitle={f.type.replace('_', ' ')}
              steps={f.steps.map((s) => s.name)}
            />
          ))}

        {displayJourneys.length === 0 && displayFlows.length === 0 && (
          <p className="text-sm text-[var(--color-text-muted)]">
            No journeys detected. Run mnemos build to discover user journeys.
          </p>
        )}
      </div>
    </div>
  );
}
