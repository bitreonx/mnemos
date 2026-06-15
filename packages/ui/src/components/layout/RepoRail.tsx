import type { RepoSnapshot } from '../../lib/workspace';
import { MnemosLogo } from '../illustrations/MnemosLogo';

/* Supabase-style SVG icons */
const IconHome = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8" /><path d="M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /></svg>
);
const IconSearch = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>
);
const IconStar = ({ filled }: { filled?: boolean }) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z" /></svg>
);
const IconZap = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z" /></svg>
);
const IconDatabase = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3" /><path d="M3 5v14a9 3 0 0 0 18 0V5" /><path d="M3 12a9 3 0 0 0 18 0" /></svg>
);
const IconChevron = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6" /></svg>
);

interface RepoRailProps {
  workspaceName?: string;
  repos: RepoSnapshot[];
  activeRepoId: string | null;
  pinnedIds: string[];
  sortBy: 'name' | 'health' | 'updated';
  search: string;
  onSearchChange: (q: string) => void;
  onSelectRepo: (id: string | null) => void;
  onTogglePin: (id: string) => void;
  onSortChange: (sort: 'name' | 'health' | 'updated') => void;
  onBuild: (id: string) => void;
  singleRepoMode?: boolean;
}

function healthDot(score: number | undefined): string {
  if (score == null) return 'neutral';
  if (score >= 80) return 'good';
  if (score >= 60) return 'ok';
  if (score >= 40) return 'warn';
  return 'bad';
}

export function RepoRail({
  workspaceName,
  repos,
  activeRepoId,
  pinnedIds,
  sortBy,
  search,
  onSearchChange,
  onSelectRepo,
  onTogglePin,
  onSortChange,
  onBuild,
  singleRepoMode,
}: RepoRailProps) {
  const q = search.trim().toLowerCase();

  const sorted = [...repos]
    .filter(
      (r) =>
        !q ||
        r.name.toLowerCase().includes(q) ||
        r.label.toLowerCase().includes(q) ||
        r.description.toLowerCase().includes(q),
    )
    .sort((a, b) => {
      const aPinned = pinnedIds.includes(a.id) ? 0 : 1;
      const bPinned = pinnedIds.includes(b.id) ? 0 : 1;
      if (aPinned !== bPinned) return aPinned - bPinned;
      if (sortBy === 'health') return (b.health ?? 0) - (a.health ?? 0);
      if (sortBy === 'updated') {
        const at = a.builtAt ? new Date(a.builtAt).getTime() : 0;
        const bt = b.builtAt ? new Date(b.builtAt).getTime() : 0;
        return bt - at;
      }
      return a.name.localeCompare(b.name);
    });

  const pinned = sorted.filter((r) => pinnedIds.includes(r.id));
  const rest = sorted.filter((r) => !pinnedIds.includes(r.id));

  const renderRepo = (repo: RepoSnapshot) => {
    const active = activeRepoId === repo.id;
    const isPinned = pinnedIds.includes(repo.id);
    return (
      <div
        key={repo.id}
        className={`rail-repo ${active ? 'rail-repo--active' : ''}`}
        style={{ '--repo-accent': repo.accent } as React.CSSProperties}
      >
        <button type="button" className="rail-repo-main" onClick={() => onSelectRepo(repo.id)}>
          <span className={`rail-health rail-health--${healthDot(repo.health)}`} />
          <span className="rail-repo-text">
            <strong>{repo.name}</strong>
            <small>{repo.label}</small>
          </span>
          {repo.status === 'ready' && repo.health != null && (
            <span className="rail-score">{repo.health}</span>
          )}
        </button>
        <div className="rail-repo-actions">
          <button
            type="button"
            className={`rail-icon-btn ${isPinned ? 'rail-icon-btn--on' : ''}`}
            title={isPinned ? 'Unpin' : 'Pin'}
            onClick={() => onTogglePin(repo.id)}
          >
            <IconStar filled={isPinned} />
          </button>
          <button
            type="button"
            className="rail-icon-btn"
            title="Run Mnemos"
            disabled={repo.status === 'building'}
            onClick={() => onBuild(repo.id)}
          >
            <IconZap />
          </button>
        </div>
      </div>
    );
  };

  return (
    <aside className="cockpit-rail">
      <div className="rail-brand">
        <div className="rail-brand-logo">
          <MnemosLogo size={24} />
        </div>
        <div className="rail-brand-text">
          <strong>Mnemos</strong>
          <small>{singleRepoMode ? 'Repository' : workspaceName ?? 'Workspace'}</small>
        </div>
      </div>

      {!singleRepoMode && (
        <div className="rail-nav-section">
          <button
            type="button"
            className={`rail-nav-item ${activeRepoId === null ? 'rail-nav-item--active' : ''}`}
            onClick={() => onSelectRepo(null)}
          >
            <span className="rail-nav-icon"><IconHome /></span>
            <span>Overview</span>
          </button>
        </div>
      )}

      <div className="rail-search-wrap">
        <div className="rail-search-box">
          <IconSearch />
          <input
            className="rail-search"
            placeholder="Filter repositories…"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
          />
        </div>
        <select className="rail-sort" value={sortBy} onChange={(e) => onSortChange(e.target.value as typeof sortBy)}>
          <option value="name">Name</option>
          <option value="health">Health</option>
          <option value="updated">Updated</option>
        </select>
      </div>

      <div className="rail-section-label">PROJECTS</div>
      <div className="rail-repo-list">
        {pinned.length > 0 && (
          <>
            <div className="rail-sub-label">PINNED</div>
            {pinned.map(renderRepo)}
          </>
        )}
        {rest.map(renderRepo)}
        {sorted.length === 0 && <p className="rail-empty">No repositories match</p>}
      </div>

      <div className="rail-footer">
        <div className="rail-footer-hint">
          <IconZap />
          <span>Run <code>mnemos ask</code> to query</span>
        </div>
      </div>
    </aside>
  );
}
