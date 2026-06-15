import { lazy, Suspense, useEffect, useState } from 'react';
import { HealthDashboard } from './components/HealthDashboard';
import { MnemosLogo } from './components/illustrations/MnemosLogo';

const SingleRepoApp = lazy(() => import('./SingleRepoApp'));

async function detectWorkspaceMode(): Promise<boolean> {
  try {
    const res = await fetch('/api/workspace');
    return res.ok;
  } catch {
    return false;
  }
}

export default function App() {
  const [workspaceMode, setWorkspaceMode] = useState<boolean | null>(null);

  useEffect(() => {
    detectWorkspaceMode().then(setWorkspaceMode);
  }, []);

  if (workspaceMode === null) {
    return (
      <div className="dash-loading">
        <MnemosLogo size={56} />
        <div className="dash-loader" />
        <p>Starting Mnemos…</p>
      </div>
    );
  }

  if (workspaceMode) {
    return <HealthDashboard />;
  }

  return (
    <Suspense
      fallback={
        <div className="loading">
          <div className="loading-text">Loading memory model…</div>
        </div>
      }
    >
      <SingleRepoApp />
    </Suspense>
  );
}
