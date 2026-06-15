import { useState } from 'react';
import { askCopilot } from '../lib/workspace';

interface WorkspaceCopilotProps {
  repoId: string;
  repoName: string;
  suggestedPrompts?: string[];
  onAskAbout?: (topic: string) => void;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  confidence?: number;
}

const DEFAULT_PROMPTS = [
  'How does authentication work in this codebase?',
  'What are the critical paths and blast radius hotspots?',
  'Which domains own the most complexity?',
  'What would break if I change the main API layer?',
  'Summarize the tech stack and architecture layers',
];

export function WorkspaceCopilot({ repoId, repoName, suggestedPrompts = [], onAskAbout }: WorkspaceCopilotProps) {
  const prompts = suggestedPrompts.length > 0 ? suggestedPrompts : DEFAULT_PROMPTS;
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'assistant',
      content: `I'm connected to **${repoName}** via Mnemos memory. Ask about auth, flows, domains, impact analysis, or any system — I use the built graph, not raw file grep.`,
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (question: string) => {
    const q = question.trim();
    if (!q || loading) return;
    setMessages((m) => [...m, { role: 'user', content: q }]);
    setInput('');
    setLoading(true);
    onAskAbout?.(q);
    try {
      const res = await askCopilot(repoId, q);
      setMessages((m) => [
        ...m,
        {
          role: 'assistant',
          content: res.answer || 'No answer returned. Run Mnemos build first.',
          confidence: res.confidence,
        },
      ]);
    } catch (err) {
      setMessages((m) => [...m, { role: 'assistant', content: `Error: ${err instanceof Error ? err.message : 'Ask failed'}` }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="workspace-copilot">
      <header className="copilot-header">
        <div>
          <h3>✦ Architecture Copilot</h3>
          <p>Powered by Mnemos graph + intent routing — same engine as <code>mnemos ask</code></p>
        </div>
      </header>

      <div className="copilot-prompts">
        {prompts.slice(0, 6).map((p) => (
          <button key={p} type="button" className="prompt-chip" onClick={() => submit(p)} disabled={loading}>
            {p.length > 48 ? `${p.slice(0, 48)}…` : p}
          </button>
        ))}
      </div>

      <div className="copilot-messages">
        {messages.map((msg, i) => (
          <div key={i} className={`copilot-msg copilot-msg--${msg.role}`}>
            <div className="copilot-msg-body">{msg.content}</div>
            {msg.confidence != null && (
              <span className="copilot-confidence">{(msg.confidence * 100).toFixed(0)}% confidence</span>
            )}
          </div>
        ))}
        {loading && <div className="copilot-msg copilot-msg--assistant"><div className="copilot-typing">Analyzing memory model…</div></div>}
      </div>

      <form
        className="copilot-input-row"
        onSubmit={(e) => {
          e.preventDefault();
          submit(input);
        }}
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder='e.g. "I need to edit the auth system — where do I start?"'
          disabled={loading}
        />
        <button type="submit" disabled={loading || !input.trim()}>Ask</button>
      </form>
    </div>
  );
}
