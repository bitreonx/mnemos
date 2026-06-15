import { useEffect, useState, type ReactNode } from 'react';
import { CommandPalette } from './CommandPalette';
import { TopBar } from './TopBar';
import { RepoRail } from './RepoRail';
import { AIInspector } from './AIInspector';
import { BottomPanel } from './BottomPanel';
import { useDashboardPrefs } from '../../hooks/useDashboardPrefs';
import type { RepoSnapshot } from '../../lib/workspace';
import type { MemoryModel } from '../../types';

interface DashboardShellProps {
  workspaceName?: string;
  repos: RepoSnapshot[];
  activeRepoId: string | null;
  activeRepo: RepoSnapshot | null;
  activeMemory: MemoryModel | null;
  onSelectRepo: (id: string | null) => void;
  onRefresh: () => void;
  onBuild: (id: string) => void;
  onNavigate: (view: string) => void;
  onAsk: (question: string) => void;
  onQuickInsight: (target: string) => void;
  children: ReactNode;
  singleRepoMode?: boolean;
}

export function DashboardShell({
  workspaceName,
  repos,
  activeRepoId,
  activeRepo,
  activeMemory,
  onSelectRepo,
  onRefresh,
  onBuild,
  onNavigate,
  onAsk,
  onQuickInsight,
  children,
  singleRepoMode,
}: DashboardShellProps) {
  const { prefs, togglePin, setSortBy, toggleTerminal, setTerminalHeight, toggleInspector } = useDashboardPrefs();
  const [railSearch, setRailSearch] = useState('');
  const [globalSearch, setGlobalSearch] = useState('');
  const [cmdOpen, setCmdOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCmdOpen(true);
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'i') {
        e.preventDefault();
        toggleInspector();
      } else if (e.ctrlKey && e.key === '`') {
        e.preventDefault();
        toggleTerminal();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [toggleInspector, toggleTerminal]);

  const breadcrumbs = singleRepoMode
    ? [{ label: activeRepo?.name ?? 'Repository' }]
    : activeRepo
      ? [{ label: workspaceName ?? 'Platform', onClick: () => onSelectRepo(null) }, { label: activeRepo.name }]
      : [{ label: workspaceName ?? 'Platform' }];

  const handleScreenshot = () => {
    window.dispatchEvent(new CustomEvent('mnemos:capture-view'));
  };

  const terminalRepo = activeRepo ?? repos.find((r) => r.status === 'ready') ?? repos[0];

  return (
    <div
      className="cockpit-shell"
      style={{
        gridTemplateColumns: prefs.inspectorOpen ? '240px 1fr 340px' : '240px 1fr',
        gridTemplateRows: prefs.terminalOpen && terminalRepo ? 'auto 1fr auto' : 'auto 1fr',
      }}
    >
      <RepoRail
        workspaceName={workspaceName}
        repos={repos}
        activeRepoId={activeRepoId}
        pinnedIds={prefs.pinnedRepoIds}
        sortBy={prefs.sortBy}
        search={railSearch}
        onSearchChange={setRailSearch}
        onSelectRepo={onSelectRepo}
        onTogglePin={togglePin}
        onSortChange={setSortBy}
        onBuild={onBuild}
        singleRepoMode={singleRepoMode}
      />

      <div className="cockpit-center">
        <TopBar
          breadcrumbs={breadcrumbs}
          search={globalSearch}
          onSearchChange={setGlobalSearch}
          onOpenCommandPalette={() => setCmdOpen(true)}
          onRefresh={onRefresh}
          onToggleTerminal={toggleTerminal}
          onToggleInspector={toggleInspector}
          terminalOpen={prefs.terminalOpen}
          inspectorOpen={prefs.inspectorOpen}
          onScreenshot={handleScreenshot}
        />
        <main className="cockpit-main" id="mnemos-capture-root">
          {children}
        </main>
        {prefs.terminalOpen && terminalRepo && (
          <BottomPanel
            open={prefs.terminalOpen}
            height={prefs.terminalHeight}
            onHeightChange={setTerminalHeight}
            onClose={toggleTerminal}
            repoId={terminalRepo.id}
            repoPath={terminalRepo.path}
            repoName={terminalRepo.name}
          />
        )}
      </div>

      {prefs.inspectorOpen && (
        <AIInspector
          repo={activeRepo}
          memory={activeMemory}
          onNavigate={onNavigate}
          onAsk={onAsk}
          onQuickInsight={onQuickInsight}
        />
      )}

      <CommandPalette
        open={cmdOpen}
        onClose={() => setCmdOpen(false)}
        repos={repos}
        onSelectRepo={(id) => {
          onSelectRepo(id);
          onNavigate('overview');
        }}
        onNavigate={onNavigate}
        onToggleTerminal={toggleTerminal}
        onToggleInspector={toggleInspector}
        onBuild={onBuild}
        onAsk={(q) => {
          if (activeRepo) onAsk(q);
          onNavigate('ai');
        }}
        activeRepoId={activeRepoId}
      />
    </div>
  );
}
