import type { MemoryModel } from '../types';

const LANG_COLORS: Record<string, string> = {
  typescript: '#3178c6',
  javascript: '#f7df1e',
  python: '#3776ab',
  go: '#00add8',
  rust: '#ce422b',
  java: '#ed8b00',
  css: '#264de4',
  json: '#6b7280',
};

export function TechStackView({ memory }: { memory: MemoryModel }) {
  const { architecture } = memory;
  const langs = Object.entries(architecture.languages).sort((a, b) => b[1] - a[1]);
  const totalLangFiles = langs.reduce((s, [, n]) => s + n, 0);

  return (
    <div className="tech-stack-view">
      <header className="ts-header">
        <h2>Tech Stack & Architecture</h2>
        <p>{architecture.summary}</p>
      </header>

      <div className="ts-grid">
        <section className="glass-card">
          <h4>Project Profile</h4>
          <div className="ts-profile">
            <div><span>Type</span><strong>{architecture.type}</strong></div>
            <div><span>Name</span><strong>{architecture.name}</strong></div>
            <div><span>Packages</span><strong>{architecture.packages.length}</strong></div>
            <div><span>Built</span><strong>{new Date(memory.builtAt).toLocaleString()}</strong></div>
          </div>
        </section>

        <section className="glass-card">
          <h4>Languages</h4>
          <div className="lang-bars">
            {langs.map(([lang, count]) => (
              <div key={lang} className="lang-row">
                <span className="lang-name">{lang}</span>
                <div className="lang-track">
                  <div
                    className="lang-fill"
                    style={{
                      width: `${totalLangFiles ? (count / totalLangFiles) * 100 : 0}%`,
                      background: LANG_COLORS[lang] ?? '#8b5cf6',
                    }}
                  />
                </div>
                <span className="lang-count">{count}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="glass-card">
          <h4>Architecture Layers</h4>
          <div className="layer-stack">
            {architecture.layers.map((layer, i) => (
              <div key={layer} className="layer-item" style={{ '--layer-i': i } as React.CSSProperties}>
                <span className="layer-index">{i + 1}</span>
                <span>{layer}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="glass-card">
          <h4>Packages / Modules</h4>
          <div className="pkg-chips">
            {architecture.packages.map((pkg) => (
              <span key={pkg} className="cap-chip">{pkg}</span>
            ))}
          </div>
        </section>

        <section className="glass-card span-2">
          <h4>System Metrics</h4>
          <div className="ts-metrics">
            <div><strong>{memory.stats.filesScanned}</strong><span>Files</span></div>
            <div><strong>{memory.stats.nodesCreated.toLocaleString()}</strong><span>Graph nodes</span></div>
            <div><strong>{memory.stats.edgesCreated.toLocaleString()}</strong><span>Edges</span></div>
            <div><strong>{memory.domains.length}</strong><span>Domains</span></div>
            <div><strong>{memory.flows.length}</strong><span>Flows</span></div>
            <div><strong>{memory.apis.length}</strong><span>APIs</span></div>
            <div><strong>{memory.services.length}</strong><span>Services</span></div>
            <div><strong>{(memory.capabilities ?? []).length}</strong><span>Capabilities</span></div>
          </div>
        </section>
      </div>
    </div>
  );
}
