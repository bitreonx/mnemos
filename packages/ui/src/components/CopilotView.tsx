import { useState } from 'react';

interface CopilotViewProps {
  onAsk: (question: string) => Promise<CopilotResponse | null>;
}

export interface CopilotResponse {
  answer: string;
  confidence: number;
  relatedTopics: string[];
}

const SUGGESTIONS = [
  'How does login work?',
  'What is this repository?',
  'Show payment flow',
  'What depends on the core domain?',
  'Repository health score',
];

export function CopilotView({ onAsk }: CopilotViewProps) {
  const [question, setQuestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<CopilotResponse | null>(null);

  async function submit(q?: string) {
    const text = (q ?? question).trim();
    if (!text) return;
    setQuestion(text);
    setLoading(true);
    try {
      const result = await onAsk(text);
      setResponse(result);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-8 max-w-3xl h-full flex flex-col">
      <div className="mb-6">
        <h2 className="text-2xl font-semibold tracking-tight mb-1">Architecture Copilot</h2>
        <p className="text-sm text-[var(--color-text-secondary)]">
          Ask Mnemos about flows, domains, and risks — powered by the memory model.
        </p>
      </div>

      <div className="flex gap-2 mb-4">
        <input
          type="text"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          placeholder="Ask Mnemos: How does login work?"
          className="flex-1 bg-[var(--color-surface-raised)] border border-[var(--color-border)] rounded-lg px-4 py-2.5 text-sm outline-none focus:border-[var(--color-accent)]"
        />
        <button
          onClick={() => submit()}
          disabled={loading}
          className="px-4 py-2.5 rounded-lg bg-[var(--color-accent)] text-white text-sm font-medium hover:bg-[var(--color-accent-hover)] disabled:opacity-50"
        >
          {loading ? '…' : 'Ask'}
        </button>
      </div>

      <div className="flex flex-wrap gap-2 mb-6">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            onClick={() => submit(s)}
            className="text-xs px-3 py-1.5 rounded-full border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:border-[var(--color-accent)] hover:text-[var(--color-accent-hover)]"
          >
            {s}
          </button>
        ))}
      </div>

      {response && (
        <div className="flex-1 bg-[var(--color-surface-raised)] border border-[var(--color-border)] rounded-lg p-5 overflow-y-auto">
          <p className="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)] mb-2">
            Answer · {(response.confidence * 100).toFixed(0)}% confidence
          </p>
          <div className="text-sm text-[var(--color-text-secondary)] whitespace-pre-wrap leading-relaxed">
            {response.answer.replace(/\*\*(.*?)\*\*/g, '$1')}
          </div>
          {response.relatedTopics.length > 0 && (
            <p className="mt-4 text-xs text-[var(--color-text-muted)]">
              Related: {response.relatedTopics.join(', ')}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
