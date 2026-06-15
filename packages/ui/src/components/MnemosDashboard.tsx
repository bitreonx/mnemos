import { useCallback, useEffect, useState } from 'react';
import { DashboardShell } from './layout/DashboardShell';
import { GlobalOverview } from './GlobalOverview';
import { RepoWorkspace, sectionFromNav, type RepoSection } from './RepoWorkspace';
import { fetchWorkspace, triggerBuild, type WorkspaceSummary } from '../lib/workspace';
import type { MemoryModel } from '../types';
import { fetchRepoMemory } from '../lib/workspace';
import { MnemosLogo } from './illustrations/MnemosLogo';

export function MnemosDashboard() {
  const [workspace, setWorkspace] = useState<WorkspaceSummary | null>(null);
  const [activeRepoId, setActiveRepoId] = useState<string | null>(null);
  const [section, setSection] = useState<RepoSection>('overview');
  const [loading, setLoading] = useState(true);
  const [buildingAll, setBuildingAll] = useState(false);
  const [activeMemory, setActiveMemory] = useState<MemoryModel | null>(null);
  const [pendingQuestion, setPendingQuestion] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const ws = await fetchWorkspace();
    setWorkspace(ws);
    return ws;
  }, []);

  useEffect(() => {
    refresh().finally(() => setLoading(false));
    const interval = setInterval(() => refresh(), 15000);
    return () => clearInterval(interval);
  }, [refresh]);

  useEffect(() => {
    if (!activeRepoId) {
      setActiveMemory(null);
      return;
    }
    fetchRepoMemory(activeRepoId)
      .then((d) => setActiveMemory(d.memory))
      .catch(() => setActiveMemory(null));
  }, [activeRepoId, workspace]);

  useEffect(() => {
    const onCapture = () => {
      const el = document.getElementById('mnemos-capture-root');
      if (!el) return;
      el.classList.add('mnemos-capture-flash');
      setTimeout(() => el.classList.remove('mnemos-capture-flash'), 400);
    };
    window.addEventListener('mnemos:capture-view', onCapture);
    return () => window.removeEventListener('mnemos:capture-view', onCapture);
  }, []);

  const handleBuild = async (repoId: string) => {
    await triggerBuild(repoId);
    setTimeout(refresh, 2500);
  };

  const handleBuildAll = async () => {
    if (!workspace) return;
    setBuildingAll(true);
    for (const repo of workspace.repos) {
      await triggerBuild(repo.id);
    }
    setBuildingAll(false);
    setTimeout(refresh, 4000);
  };

  const handleNavigate = (view: string) => {
    if (view === 'home') {
      setActiveRepoId(null);
      return;
    }
    if (activeRepoId) setSection(sectionFromNav(view));
  };

  const handleAsk = (question: string) => {
    if (!activeRepoId) return;
    setPendingQuestion(question);
  };

  if (loading || !workspace) {
    return (
      <div className="dash-loading">
        <MnemosLogo size={56} />
        <div className="dash-loader" />
        <p>Starting Mnemos cockpit…</p>
      </div>
    );
  }

  const activeRepo = activeRepoId ? workspace.repos.find((r) => r.id === activeRepoId) ?? null : null;

  return (
    <DashboardShell
      workspaceName={workspace.workspace}
      repos={workspace.repos}
      activeRepoId={activeRepoId}
      activeRepo={activeRepo}
      activeMemory={activeMemory}
      onSelectRepo={(id) => {
        setActiveRepoId(id);
        if (id) setSection('overview');
      }}
      onRefresh={refresh}
      onBuild={handleBuild}
      onNavigate={handleNavigate}
      onAsk={handleAsk}
      onQuickInsight={(target) => {
        window.dispatchEvent(new CustomEvent('mnemos:quick-insight', { detail: target }));
      }}
    >
      {!activeRepo ? (
        <GlobalOverview
          workspace={workspace}
          onOpenRepo={(id) => {
            setActiveRepoId(id);
            setSection('overview');
          }}
          onBuild={handleBuild}
          onBuildAll={handleBuildAll}
          buildingAll={buildingAll}
        />
      ) : (
        <RepoWorkspace
          repo={activeRepo}
          section={section}
          onSectionChange={setSection}
          onRefresh={refresh}
          pendingQuestion={pendingQuestion}
          onPendingQuestionHandled={() => setPendingQuestion(null)}
        />
      )}
    </DashboardShell>
  );
}
