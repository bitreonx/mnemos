import { useEffect, useMemo, useState } from 'react';
import type { RepoSnapshot } from '../../lib/workspace';

export interface CommandAction {
  id: string;
  label: string;
  hint?: string;
  group: string;
  run: () => void;
}

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  repos: RepoSnapshot[];
  onSelectRepo: (id: string) => void;
  onNavigate: (view: string) => void;
  onToggleTerminal: () => void;
  onToggleInspector: () => void;
  onBuild: (repoId: string) => void;
  onAsk: (question: string) => void;
  activeRepoId?: string | null;
}

export function CommandPalette({
  open,
  onClose,
  repos,
  onSelectRepo,
  onNavigate,
  onToggleTerminal,
  onToggleInspector,
  onBuild,
  onAsk,
  activeRepoId,
}: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (open) {
      setQuery('');
      setIndex(0);
    }
  }, [open]);

  const actions = useMemo<CommandAction[]>(() => {
    const items: CommandAction[] = [
      { id: 'nav-home', label: 'Go to Platform Overview', group: 'Navigate', run: () => onNavigate('home') },
      { id: 'nav-terminal', label: 'Toggle Terminal Panel', hint: 'Ctrl+`', group: 'Navigate', run: onToggleTerminal },
      { id: 'nav-inspector', label: 'Toggle AI Inspector', hint: 'Ctrl+I', group: 'Navigate', run: onToggleInspector },
      { id: 'ask-auth', label: 'Understand authentication', group: 'AI Tasks', run: () => onAsk('How does authentication work in this codebase?') },
      { id: 'ask-routes', label: 'Show routing logic', group: 'AI Tasks', run: () => onAsk('Where does routing live and how are routes structured?') },
      { id: 'ask-impact', label: 'Show blast radius hotspots', group: 'AI Tasks', run: () => onAsk('What are the critical paths and what would break if core services change?') },
      { id: 'ask-recent', label: 'Recently changed core files', group: 'AI Tasks', run: () => onAsk('Which core files changed recently and what systems do they affect?') },
    ];

    if (activeRepoId) {
      items.push(
        { id: 'view-overview', label: 'Open Overview', group: 'Repo Views', run: () => onNavigate('overview') },
        { id: 'view-arch', label: 'Open Architecture', group: 'Repo Views', run: () => onNavigate('architecture') },
        { id: 'view-flows', label: 'Open Flows', group: 'Repo Views', run: () => onNavigate('flows') },
        { id: 'view-code', label: 'Open Code Map', group: 'Repo Views', run: () => onNavigate('code') },
        { id: 'view-history', label: 'Open History', group: 'Repo Views', run: () => onNavigate('history') },
        { id: 'view-ai', label: 'Open AI Copilot', group: 'Repo Views', run: () => onNavigate('ai') },
        { id: 'build', label: 'Run Mnemos Build', group: 'Actions', run: () => onBuild(activeRepoId) },
      );
    }

    for (const repo of repos) {
      items.push({
        id: `repo-${repo.id}`,
        label: `Open ${repo.name}`,
        hint: repo.label,
        group: 'Repositories',
        run: () => onSelectRepo(repo.id),
      });
    }

    return items;
  }, [repos, activeRepoId, onNavigate, onSelectRepo, onToggleTerminal, onToggleInspector, onBuild, onAsk]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return actions;
    return actions.filter(
      (a) =>
        a.label.toLowerCase().includes(q) ||
        a.group.toLowerCase().includes(q) ||
        a.hint?.toLowerCase().includes(q),
    );
  }, [actions, query]);

  useEffect(() => {
    setIndex(0);
  }, [query]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setIndex((i) => Math.min(i + 1, filtered.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === 'Enter' && filtered[index]) {
        e.preventDefault();
        filtered[index].run();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, filtered, index, onClose]);

  if (!open) return null;

  const groups = [...new Set(filtered.map((a) => a.group))];

  return (
    <div className="cmd-overlay" onClick={onClose} role="presentation">
      <div className="cmd-palette" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Command palette">
        <input
          className="cmd-input"
          autoFocus
          placeholder="Search commands, repos, AI tasks…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div className="cmd-results">
          {filtered.length === 0 ? (
            <p className="cmd-empty">No matches</p>
          ) : (
            groups.map((group) => (
              <div key={group} className="cmd-group">
                <div className="cmd-group-label">{group}</div>
                {filtered
                  .filter((a) => a.group === group)
                  .map((action) => {
                    const globalIdx = filtered.indexOf(action);
                    return (
                      <button
                        key={action.id}
                        type="button"
                        className={`cmd-item ${globalIdx === index ? 'cmd-item--active' : ''}`}
                        onMouseEnter={() => setIndex(globalIdx)}
                        onClick={() => {
                          action.run();
                          onClose();
                        }}
                      >
                        <span>{action.label}</span>
                        {action.hint && <kbd>{action.hint}</kbd>}
                      </button>
                    );
                  })}
              </div>
            ))
          )}
        </div>
        <div className="cmd-footer">
          <span>↑↓ navigate</span>
          <span>↵ run</span>
          <span>esc close</span>
        </div>
      </div>
    </div>
  );
}
