import { useRef, useState } from 'react';
import { IntegratedTerminal } from '../IntegratedTerminal';

interface BottomPanelProps {
  open: boolean;
  height: number;
  onHeightChange: (h: number) => void;
  onClose: () => void;
  repoId: string;
  repoPath: string;
  repoName: string;
}

export function BottomPanel({
  open,
  height,
  onHeightChange,
  onClose,
  repoId,
  repoPath,
  repoName,
}: BottomPanelProps) {
  const [outputSearch, setOutputSearch] = useState('');
  const dragRef = useRef<{ startY: number; startH: number } | null>(null);

  if (!open) return null;

  const startResize = (e: React.MouseEvent) => {
    e.preventDefault();
    dragRef.current = { startY: e.clientY, startH: height };
    const onMove = (ev: MouseEvent) => {
      if (!dragRef.current) return;
      const delta = dragRef.current.startY - ev.clientY;
      onHeightChange(dragRef.current.startH + delta);
    };
    const onUp = () => {
      dragRef.current = null;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  return (
    <div className="cockpit-bottom" style={{ height }}>
      <div className="cockpit-bottom-resize" onMouseDown={startResize} role="separator" aria-label="Resize terminal" />
      <div className="cockpit-bottom-header">
        <div className="cockpit-bottom-tabs">
          <span className="cockpit-bottom-tab cockpit-bottom-tab--active">Terminal · {repoName}</span>
        </div>
        <div className="cockpit-bottom-tools">
          <input
            className="cockpit-bottom-search"
            placeholder="Filter output…"
            value={outputSearch}
            onChange={(e) => setOutputSearch(e.target.value)}
          />
          <button type="button" className="cockpit-action-btn" onClick={onClose}>
            Hide
          </button>
        </div>
      </div>
      <div className="cockpit-bottom-body">
        <IntegratedTerminal
          repoId={repoId}
          repositoryPath={repoPath}
          outputFilter={outputSearch}
        />
      </div>
    </div>
  );
}
