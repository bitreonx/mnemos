import type { MemoryModel } from '../types';

interface SidebarProps {
  memory: MemoryModel;
  activeView: string;
  onViewChange: (v: string) => void;
  selectedDomain: string | null;
  onDomainSelect: (d: string | null) => void;
  healthScore?: number | null;
}

const NAV_ITEMS = [
  { id: 'overview', label: 'Overview', icon: '◉' },
  { id: 'capabilities', label: 'Capabilities', icon: '◇' },
  { id: 'journeys', label: 'Journeys', icon: '⇣' },
  { id: 'heatmap', label: 'Heatmap', icon: '🔥' },
  { id: 'architecture', label: 'Architecture', icon: '⬢' },
  { id: 'domains', label: 'Domains', icon: '◆' },
  { id: 'flows', label: 'Flows', icon: '↗' },
  { id: 'graph', label: 'Graph', icon: '✕' },
  { id: 'smells', label: 'Smells', icon: '!' },
  { id: 'companion', label: 'Ask Mnemos', icon: '✦' },
];

export function Sidebar({
  memory,
  activeView,
  onViewChange,
  selectedDomain,
  onDomainSelect,
  healthScore,
}: SidebarProps) {
  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-mark" />
        <div>
          <div className="brand-name">Mnemos</div>
          <div className="brand-sub">Software Intelligence</div>
        </div>
      </div>

      <div className="repo-card">
        <div className="repo-name">{memory.repository}</div>
        <div className="repo-meta">
          {memory.stats.filesScanned} files · {memory.services.length} svcs · {memory.apis.length} apis
        </div>
        <div className="repo-architecture">{memory.architecture.type}</div>
      </div>

      <nav className="nav">
        {NAV_ITEMS.map((item) => (
          <button
            key={item.id}
            className={`nav-item ${activeView === item.id ? 'active' : ''}`}
            onClick={() => onViewChange(item.id)}
          >
            <span className="nav-icon">{item.icon}</span>
            <span className="nav-label">{item.label}</span>
          </button>
        ))}
      </nav>

      {activeView === 'domains' && memory.domains.length > 0 && (
        <div className="domain-list">
          <div className="domain-list-title">Domains</div>
          {memory.domains.map((d) => (
            <button
              key={d.id}
              className={`domain-item ${selectedDomain === d.id ? 'active' : ''}`}
              onClick={() => onDomainSelect(selectedDomain === d.id ? null : d.id)}
            >
              <span className="domain-name">{d.name}</span>
              <span className="domain-count">{d.nodes.length}</span>
            </button>
          ))}
        </div>
      )}

      <div className="sidebar-footer">
        <div className="meta-row">
          <span>Capabilities</span>
          <b>{memory.capabilities?.length ?? 0}</b>
        </div>
        <div className="meta-row">
          <span>Journeys</span>
          <b>{memory.journeys?.length ?? 0}</b>
        </div>
        <div className="meta-row">
          <span>Health</span>
          <b>{healthScore ?? '—'}</b>
        </div>
        <div className="meta-row">
          <span>Smells</span>
          <b
            style={{
              color:
                memory.smells.filter((s) => s.severity === 'high').length > 0
                  ? 'var(--color-bad)'
                  : undefined,
            }}
          >
            {memory.smells.length}
          </b>
        </div>
      </div>
    </aside>
  );
}
