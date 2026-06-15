import { useEffect, useRef, useState } from 'react';
import { runTerminalCommand } from '../lib/workspace';

interface IntegratedTerminalProps {
  repoId: string;
  repositoryPath: string;
}

interface TerminalLine {
  type: 'input' | 'output' | 'error';
  content: string;
}

export function IntegratedTerminal({ repoId, repositoryPath }: IntegratedTerminalProps) {
  const [lines, setLines] = useState<TerminalLine[]>([
    { type: 'output', content: `Mnemos Terminal · ${repositoryPath}` },
    { type: 'output', content: 'Type "help" for commands · "ask \\"how does auth work?\\"" for copilot' },
  ]);
  const [currentInput, setCurrentInput] = useState('');
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [running, setRunning] = useState(false);
  const terminalRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    terminalRef.current?.scrollTo(0, terminalRef.current.scrollHeight);
  }, [lines]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const executeCommand = async (command: string) => {
    if (!command.trim() || running) return;

    setCommandHistory((h) => [...h, command]);
    setHistoryIndex(-1);
    setLines((prev) => [...prev, { type: 'input', content: `$ ${command}` }]);
    setCurrentInput('');

    if (command.trim() === 'clear') {
      setLines([]);
      return;
    }

    setRunning(true);
    try {
      const result = await runTerminalCommand(repoId, command);
      setLines((prev) => [
        ...prev,
        { type: result.ok ? 'output' : 'error', content: result.output || '(no output)' },
      ]);
    } catch (err) {
      setLines((prev) => [
        ...prev,
        { type: 'error', content: err instanceof Error ? err.message : 'Command failed' },
      ]);
    } finally {
      setRunning(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      executeCommand(currentInput);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (commandHistory.length > 0) {
        const newIndex = historyIndex === -1 ? commandHistory.length - 1 : Math.max(0, historyIndex - 1);
        setHistoryIndex(newIndex);
        setCurrentInput(commandHistory[newIndex]);
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIndex !== -1) {
        const newIndex = historyIndex + 1;
        if (newIndex >= commandHistory.length) {
          setHistoryIndex(-1);
          setCurrentInput('');
        } else {
          setHistoryIndex(newIndex);
          setCurrentInput(commandHistory[newIndex]);
        }
      }
    }
  };

  return (
    <div className="integrated-terminal">
      <div className="terminal-header">
        <div className="terminal-tabs">
          <div className="terminal-tab active">
            <span>Mnemos CLI</span>
          </div>
        </div>
        <div className="terminal-controls">
          <button type="button" className="terminal-btn" title="Clear" onClick={() => setLines([])}>⌫</button>
        </div>
      </div>

      <div className="terminal-body" ref={terminalRef}>
        {lines.map((line, i) => (
          <div key={i} className={`terminal-line ${line.type}`}>
            {line.content}
          </div>
        ))}

        <div className="terminal-input-line">
          <span className="terminal-prompt">{running ? '…' : '$'}</span>
          <input
            ref={inputRef}
            type="text"
            className="terminal-input"
            value={currentInput}
            onChange={(e) => setCurrentInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={running}
            placeholder={running ? 'Running…' : 'build | ask "question" | flows | score | dna'}
          />
        </div>
      </div>
    </div>
  );
}
