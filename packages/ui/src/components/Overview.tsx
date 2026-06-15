import type { MemoryModel, HealthScore } from '../types';



interface OverviewProps {
  memory: MemoryModel;
  healthScore?: HealthScore | null;
}

export function Overview({ memory, healthScore = null }: OverviewProps) {

  const { stats, architecture, domains, flows, smells, capabilities, journeys } = memory;



  const statsCards = [

    { label: 'Files', value: stats.filesScanned.toLocaleString(), color: 'text-blue-400' },

    { label: 'Nodes', value: stats.nodesCreated.toLocaleString(), color: 'text-purple-400' },

    { label: 'Domains', value: stats.domainsFound, color: 'text-green-400' },

    { label: 'Flows', value: stats.flowsFound, color: 'text-amber-400' },

    { label: 'Smells', value: smells.length, color: smells.length > 0 ? 'text-red-400' : 'text-green-400' },

    { label: 'Build', value: `${(stats.durationMs / 1000).toFixed(1)}s`, color: 'text-[var(--color-text-secondary)]' },

  ];



  return (

    <div className="p-8 max-w-5xl">

      <div className="mb-8">

        <h2 className="text-2xl font-semibold tracking-tight mb-1">{architecture.name}</h2>

        <p className="text-[var(--color-text-secondary)] text-sm">{architecture.summary}</p>

      </div>



      {healthScore && (

        <div className="mb-8 bg-[var(--color-surface-raised)] border border-[var(--color-border)] rounded-lg p-5">

          <p className="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)] mb-3">

            Repository Health Score

          </p>

          <div className="flex items-end gap-6 mb-4">

            <div>

              <p className="text-3xl font-bold text-[var(--color-accent-hover)]">{healthScore.overall}</p>

              <p className="text-xs text-[var(--color-text-muted)]">Overall</p>

            </div>

            <div className="grid grid-cols-4 gap-4 flex-1">

              {[

                ['Architecture', healthScore.architectureClarity],

                ['Maintainability', healthScore.coupling],

                ['Documentation', healthScore.documentationQuality],

                ['AI Readiness', Math.round((healthScore.discoverability + healthScore.overall) / 2)],

              ].map(([label, value]) => (

                <div key={label as string}>

                  <p className="text-lg font-semibold">{value as number}</p>

                  <p className="text-[10px] text-[var(--color-text-muted)]">{label as string}</p>

                </div>

              ))}

            </div>

          </div>

        </div>

      )}



      <div className="grid grid-cols-3 lg:grid-cols-6 gap-3 mb-8">

        {statsCards.map((s) => (

          <div

            key={s.label}

            className="bg-[var(--color-surface-raised)] border border-[var(--color-border)] rounded-lg p-4"

          >

            <p className="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)] mb-1">{s.label}</p>

            <p className={`text-xl font-semibold ${s.color}`}>{s.value}</p>

          </div>

        ))}

      </div>



      {(capabilities?.length ?? 0) > 0 && (

        <section className="mb-8">

          <h3 className="text-sm font-medium mb-3 text-[var(--color-text-secondary)]">Business Capabilities</h3>

          <div className="grid grid-cols-2 gap-2">

            {capabilities!.slice(0, 8).map((c) => (

              <div

                key={c.id}

                className="bg-[var(--color-surface-raised)] border border-[var(--color-border)] rounded-md px-4 py-3"

              >

                <span className="text-sm font-medium">{c.signature.name}</span>

                <p className="text-xs text-[var(--color-text-muted)] mt-1 truncate">{c.signature.purpose}</p>

              </div>

            ))}

          </div>

        </section>

      )}



      <div className="grid grid-cols-2 gap-6">

        <section>

          <h3 className="text-sm font-medium mb-3 text-[var(--color-text-secondary)]">Architecture Layers</h3>

          <div className="space-y-2">

            {architecture.layers.map((layer, i) => (

              <div

                key={layer}

                className="flex items-center gap-3 bg-[var(--color-surface-raised)] border border-[var(--color-border)] rounded-md px-4 py-2.5"

              >

                <span className="text-[var(--color-text-muted)] text-xs w-4">{i + 1}</span>

                <span className="text-sm">{layer}</span>

              </div>

            ))}

          </div>

        </section>



        <section>

          <h3 className="text-sm font-medium mb-3 text-[var(--color-text-secondary)]">Top Domains</h3>

          <div className="space-y-2">

            {domains.slice(0, 8).map((d) => (

              <div

                key={d.id}

                className="flex items-center justify-between bg-[var(--color-surface-raised)] border border-[var(--color-border)] rounded-md px-4 py-2.5"

              >

                <span className="text-sm">{d.name}</span>

                <div className="flex items-center gap-2">

                  <span className="text-xs text-[var(--color-text-muted)]">{d.nodes.length} nodes</span>

                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--color-accent)]/10 text-[var(--color-accent-hover)]">

                    {(d.confidence * 100).toFixed(0)}%

                  </span>

                </div>

              </div>

            ))}

          </div>

        </section>

      </div>



      <section className="mt-8">

        <h3 className="text-sm font-medium mb-3 text-[var(--color-text-secondary)]">

          Recent Flows {(journeys?.length ?? 0) > 0 && `· ${journeys!.length} journeys`}

        </h3>

        <div className="grid grid-cols-2 gap-2">

          {flows.slice(0, 6).map((f) => (

            <div

              key={f.id}

              className="bg-[var(--color-surface-raised)] border border-[var(--color-border)] rounded-md px-4 py-3"

            >

              <div className="flex items-center justify-between mb-1">

                <span className="text-sm font-medium truncate">{f.name}</span>

                <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--color-surface-overlay)] text-[var(--color-text-muted)] uppercase">

                  {f.type.replace('_', ' ')}

                </span>

              </div>

              <p className="text-xs text-[var(--color-text-muted)] truncate">{f.description}</p>

            </div>

          ))}

        </div>

      </section>

    </div>

  );

}

