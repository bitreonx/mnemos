import { useState } from 'react';
import type { MemoryModel } from '../types';
import { VisualShowcase } from './illustrations/VisualShowcase';

interface AISetupViewProps {
  memory: MemoryModel;
}

const STEPS = [
  {
    title: 'Drop DNA into your AI',
    desc: 'Point Claude, Cursor, or Codex at the compressed memory — not the whole repo.',
    files: ['.mnemos/project.dna.json', '.mnemos/agent_context.json'],
  },
  {
    title: 'Install Cursor rules',
    desc: 'One command writes AGENTS.md and a Cursor rule that auto-loads architecture context.',
    cmd: 'mnemos setup',
  },
  {
    title: 'Copy a starter prompt',
    desc: 'Paste into Cursor chat or Claude — includes capabilities, journeys, and instructions.',
    cmd: 'mnemos prompt',
  },
  {
    title: 'Run the memory server',
    desc: 'Agents query live architecture at localhost:4000 instead of re-reading files.',
    cmd: 'mnemos serve',
  },
];

const VIBE_PROMPTS = [
  'Explain this codebase like I\'m new — where do I start?',
  'What breaks if I change the most central service?',
  'Show me the user journeys and entry routes',
  'What smells should I fix before shipping?',
  'I want to vibe-code a new feature — which domain do I touch?',
  'Trace the auth flow from route to handler',
];

export function AISetupView({ memory }: AISetupViewProps) {
  const [copied, setCopied] = useState<string | null>(null);

  async function copyText(label: string, text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(label);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      /* clipboard unavailable */
    }
  }

  const dnaRef = `@.mnemos/project.dna.json @.mnemos/agent_context.json

I'm working on ${memory.repository} (${memory.architecture.type}).
Before suggesting code, read the Mnemos DNA files above.
Capabilities: ${(memory.capabilities ?? []).slice(0, 4).map((c) => c.signature.name).join(', ') || 'see DNA'}
Domains: ${memory.domains.slice(0, 4).map((d) => d.name).join(', ') || 'see DNA'}

My task:`;

  return (
    <div className="p-8 max-w-4xl">
      <VisualShowcase />

      <div className="mb-8">
        <h2 className="text-2xl font-semibold tracking-tight mb-1">AI Setup</h2>
        <p className="text-[var(--color-text-secondary)] text-sm">
          Make Cursor, Claude, and vibe-coding sessions actually understand this repo — in seconds, not hours.
        </p>
      </div>

      <div className="grid gap-4 mb-8">
        {STEPS.map((step, i) => (
          <div
            key={step.title}
            className="bg-[var(--color-surface-raised)] border border-[var(--color-border)] rounded-lg p-5"
          >
            <div className="flex items-start gap-4">
              <span className="text-lg font-bold text-[var(--color-accent-hover)] opacity-60">{i + 1}</span>
              <div className="flex-1">
                <h3 className="text-sm font-semibold mb-1">{step.title}</h3>
                <p className="text-xs text-[var(--color-text-muted)] mb-3">{step.desc}</p>
                {step.files && (
                  <div className="flex flex-wrap gap-2">
                    {step.files.map((f) => (
                      <code
                        key={f}
                        className="text-xs px-2 py-1 rounded bg-[var(--color-surface-overlay)] text-[var(--color-accent-hover)]"
                      >
                        {f}
                      </code>
                    ))}
                  </div>
                )}
                {step.cmd && (
                  <code className="text-xs px-3 py-1.5 rounded bg-[var(--color-surface-overlay)] font-mono">
                    {step.cmd}
                  </code>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      <section className="mb-8">
        <h3 className="text-sm font-medium mb-3 text-[var(--color-text-secondary)]">
          Quick @-mention prompt (Cursor / Claude)
        </h3>
        <div className="relative">
          <pre className="text-xs p-4 rounded-lg bg-[var(--color-surface-raised)] border border-[var(--color-border)] overflow-x-auto whitespace-pre-wrap font-mono leading-relaxed">
            {dnaRef}
          </pre>
          <button
            className="absolute top-3 right-3 text-xs px-3 py-1.5 rounded-md bg-[var(--color-accent)] text-white hover:opacity-90"
            onClick={() => copyText('prompt', dnaRef)}
          >
            {copied === 'prompt' ? 'Copied!' : 'Copy'}
          </button>
        </div>
      </section>

      <section className="mb-8">
        <h3 className="text-sm font-medium mb-3 text-[var(--color-text-secondary)]">
          Vibe-coder prompts that work
        </h3>
        <div className="flex flex-wrap gap-2">
          {VIBE_PROMPTS.map((p) => (
            <button
              key={p}
              className="text-xs px-3 py-2 rounded-full border border-[var(--color-border)] bg-[var(--color-surface-raised)] hover:border-[var(--color-accent)] transition-colors text-left"
              onClick={() => copyText(p, p)}
            >
              {copied === p ? '✓ Copied' : p}
            </button>
          ))}
        </div>
      </section>

      <section>
        <h3 className="text-sm font-medium mb-3 text-[var(--color-text-secondary)]">Memory server endpoints</h3>
        <div className="grid grid-cols-2 gap-2 text-xs font-mono">
          {[
            ['GET /dna', 'Repository DNA JSON'],
            ['GET /copilot?q=', 'Ask architecture questions'],
            ['GET /impact/:node', 'Blast radius analysis'],
            ['GET /search?q=', 'Find domains, services, flows'],
          ].map(([ep, desc]) => (
            <div
              key={ep}
              className="px-3 py-2 rounded-md bg-[var(--color-surface-raised)] border border-[var(--color-border)]"
            >
              <div className="text-[var(--color-accent-hover)]">{ep}</div>
              <div className="text-[var(--color-text-muted)] mt-0.5">{desc}</div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
