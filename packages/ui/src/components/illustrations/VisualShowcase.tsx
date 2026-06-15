export function AnimatedTerminalIllustration({ className = '' }: { className?: string }) {
  return (
    <div className={`illustration-card illustration-terminal ${className}`}>
      <img
        src="/assets/terminal-animated.svg"
        alt="Animated Mnemos terminal — scan, build DNA, generate snapshots"
        className="illustration-svg"
        draggable={false}
      />
      <div className="illustration-caption">
        <strong>Terminal → Memory</strong>
        <span>One command produces DNA, agent context, HTML report, and shareable SVG cards.</span>
      </div>
    </div>
  );
}

export function AnimatedResultsIllustration({ className = '' }: { className?: string }) {
  return (
    <div className={`illustration-card illustration-results ${className}`}>
      <img
        src="/assets/results-animated.svg"
        alt="Benchmark results — Mnemos vs Graphify and Gitingest"
        className="illustration-svg"
        draggable={false}
      />
      <div className="illustration-caption">
        <strong>Verified results</strong>
        <span>80% task accuracy and 29× compression on real repos — not marketing slides.</span>
      </div>
    </div>
  );
}

export function MnemosBanner({ className = '' }: { className?: string }) {
  return (
    <div className={`mnemos-banner-wrap ${className}`}>
      <img
        src="/banner.svg"
        alt="Mnemos — The memory layer for software"
        className="mnemos-banner-img"
        draggable={false}
      />
    </div>
  );
}

const AI_FLOW = [
  { step: '1', title: 'Build memory', cmd: 'npx mnemos .', desc: 'Scans repo → DNA + graphs + SVG snapshots' },
  { step: '2', title: 'Wire your AI', cmd: '@.mnemos/project.dna.json', desc: 'Cursor, Claude, Codex read structured context' },
  { step: '3', title: 'Query live', cmd: 'mnemos serve', desc: 'Agents hit localhost:4000 for impact & search' },
  { step: '4', title: 'Share visually', cmd: 'mnemos snapshot', desc: 'Drop animated SVG cards into README & PRs' },
];

export function VisualShowcase() {
  return (
    <section className="visual-showcase">
      <MnemosBanner />

      <div className="visual-showcase-grid">
        <AnimatedTerminalIllustration />
        <AnimatedResultsIllustration />
      </div>

      <div className="visual-showcase-ai">
        <h3>How AI uses Mnemos</h3>
        <p className="visual-showcase-lead">
          Anything you can do in Graphify or a static diagram, Mnemos does here — plus architecture DNA,
          blast-radius queries, and benchmark-verified accuracy. Point agents at files or the live server.
        </p>
        <div className="ai-flow-grid">
          {AI_FLOW.map((item) => (
            <article key={item.step} className="ai-flow-step">
              <span className="ai-flow-num">{item.step}</span>
              <div>
                <h4>{item.title}</h4>
                <code>{item.cmd}</code>
                <p>{item.desc}</p>
              </div>
            </article>
          ))}
        </div>
      </div>

      <div className="visual-capabilities">
        <h3>What you can do graphically</h3>
        <ul className="visual-cap-list">
          <li><strong>Architecture cards</strong> — layered system map as SVG for README & social</li>
          <li><strong>Journey flows</strong> — user paths from route to handler, animated in snapshots</li>
          <li><strong>Health & AI readiness</strong> — rings and scores agents can parse or humans can skim</li>
          <li><strong>Interactive UI</strong> — graph view, heatmap, domains, smells — same data as DNA</li>
          <li><strong>Live terminal</strong> — build, analyze, and git from the dashboard</li>
        </ul>
      </div>
    </section>
  );
}
