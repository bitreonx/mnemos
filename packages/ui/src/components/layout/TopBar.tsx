interface TopBarProps {
  breadcrumbs: { label: string; onClick?: () => void }[];
  search: string;
  onSearchChange: (q: string) => void;
  onOpenCommandPalette: () => void;
  onRefresh: () => void;
  onToggleTerminal: () => void;
  onToggleInspector: () => void;
  terminalOpen: boolean;
  inspectorOpen: boolean;
  onScreenshot?: () => void;
}

/* Supabase-style SVG icons */
const IconSearch = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>
);
const IconRefresh = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" /><path d="M3 3v5h5" /><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" /><path d="M16 16h5v5" /></svg>
);
const IconTerminal = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="4 17 10 11 4 5" /><line x1="12" x2="20" y1="19" y2="19" /></svg>
);
const IconAI = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 8V4H8" /><rect width="16" height="12" x="4" y="8" rx="2" /><path d="M2 14h2" /><path d="M20 14h2" /><path d="M15 13v2" /><path d="M9 13v2" /></svg>
);
const IconCamera = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" /><circle cx="12" cy="13" r="3" /></svg>
);
const IconChevronRight = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6" /></svg>
);

export function TopBar({
  breadcrumbs,
  search,
  onSearchChange,
  onOpenCommandPalette,
  onRefresh,
  onToggleTerminal,
  onToggleInspector,
  terminalOpen,
  inspectorOpen,
  onScreenshot,
}: TopBarProps) {
  return (
    <header className="cockpit-topbar">
      <nav className="cockpit-breadcrumbs" aria-label="Breadcrumb">
        {breadcrumbs.map((crumb, i) => (
          <span key={i} className="cockpit-crumb">
            {i > 0 && <span className="cockpit-crumb-sep"><IconChevronRight /></span>}
            {crumb.onClick ? (
              <button type="button" onClick={crumb.onClick}>
                {crumb.label}
              </button>
            ) : (
              <span className={i === breadcrumbs.length - 1 ? 'cockpit-crumb-current' : ''}>{crumb.label}</span>
            )}
          </span>
        ))}
      </nav>

      <div className="cockpit-topbar-center">
        <div className="cockpit-search-wrapper">
          <IconSearch />
          <input
            className="cockpit-global-search"
            placeholder="Search…"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
          />
        </div>
        <button type="button" className="cockpit-cmd-btn" onClick={onOpenCommandPalette} title="Command palette (Ctrl+K)">
          <kbd>⌘K</kbd>
        </button>
      </div>

      <div className="cockpit-topbar-actions">
        <button
          type="button"
          className={`cockpit-action-btn ${terminalOpen ? 'cockpit-action-btn--on' : ''}`}
          onClick={onToggleTerminal}
          title="Terminal (Ctrl+`)"
        >
          <IconTerminal />
          <span>Terminal</span>
        </button>
        <button
          type="button"
          className={`cockpit-action-btn ${inspectorOpen ? 'cockpit-action-btn--on' : ''}`}
          onClick={onToggleInspector}
          title="AI Inspector (Ctrl+I)"
        >
          <IconAI />
          <span>AI</span>
        </button>
        {onScreenshot && (
          <button type="button" className="cockpit-action-btn" onClick={onScreenshot} title="Capture view for sharing">
            <IconCamera />
          </button>
        )}
        <button type="button" className="cockpit-action-btn" onClick={onRefresh} title="Refresh data">
          <IconRefresh />
        </button>
      </div>
    </header>
  );
}
