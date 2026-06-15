import type { ReportData } from './report.js';

const STYLES = `
  :root {
    --bg: #fbfbfd;
    --surface: #ffffff;
    --surface-2: #f5f5f7;
    --border: rgba(0, 0, 0, 0.08);
    --border-strong: rgba(0, 0, 0, 0.14);
    --text: #1d1d1f;
    --text-2: #515154;
    --text-3: #86868b;
    --accent: #5e5ce6;
    --accent-2: #0a84ff;
    --good: #30d158;
    --warn: #ff9f0a;
    --bad: #ff453a;
    --shadow: 0 1px 2px rgba(0, 0, 0, 0.04), 0 8px 24px rgba(0, 0, 0, 0.04);
    --radius: 14px;
    --radius-sm: 8px;
    --serif: ui-serif, "New York", Georgia, serif;
    --sans: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", Arial, sans-serif;
    --mono: ui-monospace, SFMono-Regular, "SF Mono", Menlo, monospace;
  }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body {
    background: var(--bg);
    color: var(--text);
    font-family: var(--sans);
    font-size: 15px;
    line-height: 1.55;
    -webkit-font-smoothing: antialiased;
    text-rendering: optimizeLegibility;
  }
  a { color: inherit; }

  .topbar {
    position: sticky;
    top: 0;
    z-index: 10;
    backdrop-filter: saturate(180%) blur(20px);
    -webkit-backdrop-filter: saturate(180%) blur(20px);
    background: rgba(251, 251, 253, 0.78);
    border-bottom: 1px solid var(--border);
  }
  .topbar-inner {
    max-width: 1200px;
    margin: 0 auto;
    padding: 14px 28px;
    display: flex;
    align-items: center;
    gap: 18px;
  }
  .brand {
    display: flex;
    align-items: center;
    gap: 10px;
    font-weight: 600;
    letter-spacing: -0.01em;
  }
  .brand-dot {
    width: 22px;
    height: 22px;
    border-radius: 6px;
    background: linear-gradient(135deg, var(--accent), var(--accent-2));
  }
  .repo-name { font-size: 14px; }
  .repo-meta { color: var(--text-3); font-size: 12.5px; margin-left: 4px; }
  .topbar-right { margin-left: auto; display: flex; align-items: center; gap: 14px; }

  .score-pill {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 6px 12px;
    border-radius: 999px;
    background: var(--surface);
    border: 1px solid var(--border);
    font-size: 12.5px;
    color: var(--text-2);
  }
  .score-num { font-weight: 600; color: var(--text); font-variant-numeric: tabular-nums; }

  .toggle {
    display: inline-flex;
    padding: 3px;
    background: var(--surface-2);
    border-radius: 999px;
    border: 1px solid var(--border);
  }
  .toggle button {
    appearance: none;
    border: 0;
    background: transparent;
    font: inherit;
    color: var(--text-2);
    padding: 5px 12px;
    border-radius: 999px;
    cursor: pointer;
    font-size: 12.5px;
    font-weight: 500;
  }
  .toggle button.active {
    background: var(--surface);
    color: var(--text);
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.06);
  }

  main {
    max-width: 1200px;
    margin: 0 auto;
    padding: 56px 28px 80px;
  }

  .hero { margin-bottom: 56px; }
  .hero-eyebrow {
    color: var(--accent);
    font-size: 13px;
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    margin-bottom: 14px;
  }
  .hero-title {
    font-family: var(--serif);
    font-size: 44px;
    line-height: 1.1;
    letter-spacing: -0.02em;
    margin: 0 0 18px;
    max-width: 760px;
  }
  .hero-story {
    font-size: 17px;
    color: var(--text-2);
    max-width: 720px;
    line-height: 1.6;
  }
  .hero-highlights {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 18px;
  }
  .chip {
    padding: 5px 11px;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 999px;
    font-size: 12.5px;
    color: var(--text-2);
  }

  section { margin-top: 64px; }
  .section-head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    margin-bottom: 20px;
  }
  .section-title {
    font-size: 22px;
    font-weight: 600;
    letter-spacing: -0.01em;
    margin: 0;
  }
  .section-sub { color: var(--text-3); font-size: 13px; }

  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
    gap: 16px;
  }
  .grid-tight {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
    gap: 12px;
  }

  .card {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 22px;
    box-shadow: var(--shadow);
  }
  .card-name {
    font-size: 17px;
    font-weight: 600;
    margin: 0 0 6px;
    letter-spacing: -0.01em;
  }
  .card-purpose {
    color: var(--text-2);
    font-size: 14px;
    margin: 0 0 14px;
  }
  .card-label {
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--text-3);
    font-weight: 600;
    margin: 14px 0 8px;
  }
  .card-list {
    list-style: none;
    margin: 0;
    padding: 0;
  }
  .card-list li {
    font-size: 14px;
    color: var(--text);
    padding: 4px 0;
    display: flex;
    align-items: flex-start;
    gap: 8px;
  }
  .card-list li::before {
    content: "";
    width: 4px;
    height: 4px;
    border-radius: 50%;
    background: var(--text-3);
    margin-top: 9px;
    flex-shrink: 0;
  }
  .card-meta {
    display: flex;
    gap: 14px;
    margin-top: 16px;
    padding-top: 14px;
    border-top: 1px solid var(--border);
  }
  .meta-item { font-size: 12px; color: var(--text-2); }
  .meta-item b { color: var(--text); font-weight: 600; }

  .tag {
    display: inline-block;
    padding: 2px 8px;
    border-radius: 6px;
    font-size: 11.5px;
    font-weight: 500;
    text-transform: lowercase;
  }
  .tag-low { background: rgba(48, 209, 88, 0.12); color: #1f6f3a; }
  .tag-medium { background: rgba(255, 159, 10, 0.14); color: #8a5500; }
  .tag-high { background: rgba(255, 69, 58, 0.12); color: #a3231c; }
  .category-chip {
    display: inline-block;
    padding: 3px 10px;
    border-radius: 999px;
    background: var(--surface-2);
    color: var(--text-2);
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .journey {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 22px 26px;
    margin-bottom: 12px;
    box-shadow: var(--shadow);
  }
  .journey-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 6px;
  }
  .journey-name { font-size: 17px; font-weight: 600; letter-spacing: -0.01em; }
  .journey-grid {
    display: grid;
    grid-template-columns: 110px 1fr;
    gap: 4px 16px;
    margin-top: 12px;
    font-size: 14px;
  }
  .journey-key { color: var(--text-3); font-size: 12.5px; }
  .journey-val { color: var(--text); }

  .dev-only { display: none; }
  .agent-only { display: none; }
  body[data-mode="developer"] .vibe-only { display: none; }
  body[data-mode="developer"] .dev-only { display: block; }
  body[data-mode="agent"] .vibe-only { display: none; }
  body[data-mode="agent"] .agent-only { display: block; }

  .journey-flow {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0;
    margin: 20px 0;
    padding: 20px;
    background: var(--surface-2);
    border-radius: var(--radius);
  }
  .journey-step {
    display: flex;
    flex-direction: column;
    align-items: center;
    width: 100%;
    max-width: 320px;
  }
  .journey-step-box {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    padding: 10px 20px;
    font-size: 14px;
    font-weight: 500;
    text-align: center;
    width: 100%;
    box-shadow: 0 1px 3px rgba(0,0,0,0.04);
    transition: transform 0.2s ease, box-shadow 0.2s ease;
  }
  .journey-step-box:hover {
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(0,0,0,0.08);
  }
  .journey-step-box.kind-actor { border-color: rgba(94, 92, 230, 0.3); background: rgba(94, 92, 230, 0.06); }
  .journey-step-box.kind-api, .journey-step-box.kind-route { border-color: rgba(10, 132, 255, 0.3); background: rgba(10, 132, 255, 0.06); }
  .journey-step-box.kind-service { border-color: rgba(48, 209, 88, 0.3); background: rgba(48, 209, 88, 0.06); }
  .journey-arrow {
    color: var(--text-3);
    font-size: 18px;
    padding: 4px 0;
    line-height: 1;
  }
  .journey-card {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 28px;
    margin-bottom: 20px;
    box-shadow: var(--shadow);
  }

  .search-box {
    width: 220px;
    padding: 7px 12px;
    border-radius: 999px;
    border: 1px solid var(--border);
    background: var(--surface);
    font: inherit;
    font-size: 13px;
    color: var(--text);
    outline: none;
  }
  .search-box:focus { border-color: var(--accent); box-shadow: 0 0 0 3px rgba(94, 92, 230, 0.12); }
  .search-hidden { display: none !important; }

  .agent-artifact {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 14px 18px;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    margin-bottom: 8px;
    font-family: var(--mono);
    font-size: 13px;
  }
  .agent-artifact span { color: var(--text-2); font-family: var(--sans); font-size: 12px; }
  .agent-json {
    background: #1d1d1f;
    color: #f5f5f7;
    border-radius: var(--radius);
    padding: 20px;
    font-family: var(--mono);
    font-size: 12px;
    line-height: 1.5;
    overflow-x: auto;
    max-height: 400px;
    overflow-y: auto;
  }
  .agent-json .key { color: #ff9f0a; }
  .agent-json .str { color: #30d158; }
  .agent-json .num { color: #0a84ff; }

  .score-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: 12px;
    margin-bottom: 24px;
  }
  .score-cell {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 18px;
  }
  .score-cell .num {
    font-size: 30px;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
    letter-spacing: -0.02em;
  }
  .score-cell .lbl {
    color: var(--text-3);
    font-size: 12.5px;
    margin-top: 2px;
  }
  .score-bar {
    height: 4px;
    border-radius: 2px;
    background: var(--surface-2);
    margin-top: 10px;
    overflow: hidden;
  }
  .score-bar > span {
    display: block;
    height: 100%;
    background: linear-gradient(90deg, var(--accent), var(--accent-2));
    border-radius: 2px;
  }

  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 13.5px;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    overflow: hidden;
  }
  th, td {
    text-align: left;
    padding: 10px 14px;
    border-bottom: 1px solid var(--border);
  }
  th {
    background: var(--surface-2);
    font-weight: 600;
    color: var(--text-2);
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
  tr:last-child td { border-bottom: 0; }
  td code, .mono { font-family: var(--mono); font-size: 12.5px; color: var(--text-2); }

  details {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    margin-bottom: 10px;
  }
  summary {
    cursor: pointer;
    padding: 14px 18px;
    font-weight: 500;
    list-style: none;
  }
  summary::-webkit-details-marker { display: none; }
  summary::after {
    content: "+";
    float: right;
    color: var(--text-3);
    font-weight: 400;
  }
  details[open] summary::after { content: "−"; }
  details .inner { padding: 0 18px 18px; color: var(--text-2); font-size: 14px; }

  .flow-step {
    display: inline-block;
    padding: 4px 10px;
    margin: 2px 4px 2px 0;
    background: var(--surface-2);
    border-radius: 6px;
    font-size: 12.5px;
    color: var(--text-2);
  }
  .flow-step.kind-service { background: rgba(94, 92, 230, 0.10); color: #3a3895; }
  .flow-step.kind-api, .flow-step.kind-route { background: rgba(10, 132, 255, 0.10); color: #0a4d99; }
  .flow-step.kind-class, .flow-step.kind-function { background: rgba(48, 209, 88, 0.10); color: #1f6f3a; }
  .flow-arrow { color: var(--text-3); margin: 0 2px; }

  .empty {
    text-align: center;
    color: var(--text-3);
    padding: 32px;
    background: var(--surface);
    border: 1px dashed var(--border-strong);
    border-radius: var(--radius);
  }

  footer {
    max-width: 1200px;
    margin: 0 auto;
    padding: 24px 28px 48px;
    color: var(--text-3);
    font-size: 12.5px;
    display: flex;
    justify-content: space-between;
  }

  @media (max-width: 720px) {
    main { padding: 32px 18px 60px; }
    .hero-title { font-size: 32px; }
    .topbar-inner { padding: 12px 18px; flex-wrap: wrap; }
    .grid, .grid-tight { grid-template-columns: 1fr; }
  }
`;

const SCRIPT = `
  function setMode(mode) {
    document.body.dataset.mode = mode;
    document.querySelectorAll('.toggle button').forEach((b) => {
      b.classList.toggle('active', b.dataset.mode === mode);
    });
    try { localStorage.setItem('mnemos-mode', mode); } catch (_) {}
  }
  document.querySelectorAll('.toggle button').forEach((b) => {
    b.addEventListener('click', () => setMode(b.dataset.mode));
  });
  let saved = 'vibe';
  try { saved = localStorage.getItem('mnemos-mode') || 'vibe'; } catch (_) {}
  setMode(saved);

  const searchInput = document.getElementById('report-search');
  if (searchInput) {
    searchInput.addEventListener('input', () => {
      const q = searchInput.value.toLowerCase().trim();
      document.querySelectorAll('[data-search]').forEach((el) => {
        const text = (el.getAttribute('data-search') || el.textContent || '').toLowerCase();
        el.classList.toggle('search-hidden', q.length > 0 && !text.includes(q));
      });
    });
  }
`;

export function renderReport(data: ReportData): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escape(data.repository)} — Mnemos Report</title>
<style>${STYLES}</style>
</head>
<body data-mode="vibe">
  <header class="topbar">
    <div class="topbar-inner">
      <div class="brand">
        <div class="brand-dot"></div>
        <div>
          <div class="repo-name">${escape(data.repository)}</div>
          <div class="repo-meta">built ${formatDate(data.builtAt)}</div>
        </div>
      </div>
      <div class="topbar-right">
        <div class="score-pill" title="Repository Memory Score">
          <span>Memory Score</span>
          <span class="score-num">${data.memoryScore.overall}/100</span>
        </div>
        <div class="toggle" role="tablist" aria-label="View mode">
          <button data-mode="vibe" class="active">Vibe</button>
          <button data-mode="developer">Developer</button>
          <button data-mode="agent">AI Agent</button>
        </div>
        <input type="search" id="report-search" class="search-box" placeholder="Search…" aria-label="Search report" />
      </div>
    </div>
  </header>

  <main>
    <section class="hero">
      <div class="hero-eyebrow">Software Intelligence</div>
      <h1 class="hero-title">${escape(data.repository)}</h1>
      <p class="hero-story">${escape(data.story.summary)}</p>
      ${data.story.highlights.length > 0
        ? `<div class="hero-highlights">${data.story.highlights
            .map((h) => `<span class="chip">${escape(h)}</span>`)
            .join('')}</div>`
        : ''}
    </section>

    <section class="vibe-only">
      <div class="section-head">
        <h2 class="section-title">Capabilities</h2>
        <span class="section-sub">${data.capabilities.length} system${
          data.capabilities.length === 1 ? '' : 's'
        } discovered</span>
      </div>
      ${
        data.capabilities.length === 0
          ? `<div class="empty">No capabilities detected yet. Build a richer graph to surface them.</div>`
          : `<div class="grid">${data.capabilities.map(renderCapability).join('')}</div>`
      }
    </section>

    <section class="vibe-only">
      <div class="section-head">
        <h2 class="section-title">User Journeys</h2>
        <span class="section-sub">${data.journeys.length} journey${
          data.journeys.length === 1 ? '' : 's'
        } mapped</span>
      </div>
      ${
        data.journeys.length === 0
          ? `<div class="empty">No user journeys discovered. Add route handlers and entry points to surface them.</div>`
          : data.journeys.map(renderJourneyFlow).join('')
      }
    </section>

    <section class="dev-only">
      <div class="section-head">
        <h2 class="section-title">Memory Score</h2>
        <span class="section-sub">Composite 0–100</span>
      </div>
      <div class="score-grid">
        ${renderScoreCell('Discoverability', data.memoryScore.discoverability)}
        ${renderScoreCell('Architecture Clarity', data.memoryScore.architectureClarity)}
        ${renderScoreCell('Coupling', data.memoryScore.coupling)}
        ${renderScoreCell('Documentation', data.memoryScore.documentationQuality)}
        ${renderScoreCell('Dependency Complexity', data.memoryScore.dependencyComplexity)}
      </div>
    </section>

    <section class="dev-only">
      <div class="section-head">
        <h2 class="section-title">Domains</h2>
        <span class="section-sub">${data.domains.length} logical unit${
          data.domains.length === 1 ? '' : 's'
        }</span>
      </div>
      ${
        data.domains.length === 0
          ? `<div class="empty">No domains discovered.</div>`
          : `<table>
              <thead>
                <tr>
                  <th>Domain</th>
                  <th>Nodes</th>
                  <th>Services</th>
                  <th>APIs</th>
                  <th>Complexity</th>
                  <th>Coupling</th>
                  <th>Risk</th>
                </tr>
              </thead>
              <tbody>
                ${data.domains
                  .map(
                    (d) => `<tr>
                      <td><b>${escape(d.name)}</b><br /><span class="mono">${escape(d.id)}</span></td>
                      <td>${d.nodeCount}</td>
                      <td>${d.services.length}</td>
                      <td>${d.keyApis.length}</td>
                      <td>${d.complexityScore}</td>
                      <td>${d.couplingScore}</td>
                      <td>${riskTag(d.risk)}</td>
                    </tr>`,
                  )
                  .join('')}
              </tbody>
            </table>`
      }
    </section>

    <section class="dev-only">
      <div class="section-head">
        <h2 class="section-title">Flows</h2>
        <span class="section-sub">${data.flows.length} execution path${
          data.flows.length === 1 ? '' : 's'
        }</span>
      </div>
      ${
        data.flows.length === 0
          ? `<div class="empty">No flows discovered.</div>`
          : data.flows
              .slice(0, 50)
              .map(
                (f) => `<details>
                  <summary>${escape(f.name)} <span class="mono" style="margin-left:8px;color:var(--text-3)">${escape(
                  f.type,
                )} · ${(f.confidence * 100).toFixed(0)}%</span></summary>
                  <div class="inner">
                    <div>${escape(f.description)}</div>
                    <div style="margin-top:10px">${f.steps
                      .map(
                        (s, i) =>
                          (i > 0 ? '<span class="flow-arrow">→</span>' : '') +
                          `<span class="flow-step kind-${escape(s.kind)}">${escape(s.name)}</span>`,
                      )
                      .join('')}</div>
                  </div>
                </details>`,
              )
              .join('')
      }
    </section>

    <section class="dev-only">
      <div class="section-head">
        <h2 class="section-title">Critical Paths & Risks</h2>
        <span class="section-sub">${data.criticalPaths.length} critical · ${
          data.smells.length
        } smell${data.smells.length === 1 ? '' : 's'}</span>
      </div>
      ${
        data.criticalPaths.length === 0 && data.smells.length === 0
          ? `<div class="empty">No critical paths or smells flagged.</div>`
          : data.criticalPaths
              .map(
                (c) => `<details>
                  <summary>${escape(c.name)} — <span class="tag tag-${
                  c.risk === 'low' ? 'low' : c.risk === 'medium' ? 'medium' : 'high'
                }">${c.risk} risk</span></summary>
                  <div class="inner">${escape(c.description)}</div>
                </details>`,
              )
              .concat(
                data.smells.map(
                  (s) => `<details>
                    <summary>${escape(s.type.replace(/_/g, ' '))} — <span class="tag tag-${
                    s.severity === 'low' ? 'low' : s.severity === 'medium' ? 'medium' : 'high'
                  }">${s.severity}</span></summary>
                    <div class="inner">
                      <div>${escape(s.description)}</div>
                      <div style="margin-top:8px"><b>Recommendation:</b> ${escape(
                        s.recommendation,
                      )}</div>
                    </div>
                  </details>`,
                ),
              )
              .join('')
      }
    </section>

    <section class="agent-only">
      <div class="section-head">
        <h2 class="section-title">AI Agent Context</h2>
        <span class="section-sub">Machine-optimized artifacts for Claude, Cursor, Codex</span>
      </div>
      <p style="color:var(--text-2);margin-bottom:20px;max-width:640px">
        Point your AI agent at <code class="mono">project.dna.json</code> first.
        These artifacts are generated locally — no API keys, no cloud.
      </p>
      <div class="agent-artifact"><code>project.dna.json</code><span>Canonical repository DNA</span></div>
      <div class="agent-artifact"><code>agent_context.json</code><span>Rich agent context bundle</span></div>
      <div class="agent-artifact"><code>flows.json</code><span>${data.flows.length} execution flows</span></div>
      <div class="agent-artifact"><code>domains.json</code><span>${data.domains.length} logical domains</span></div>
      <div class="agent-artifact"><code>critical_paths.json</code><span>${data.criticalPaths.length} risk-ranked paths</span></div>
      <div class="agent-artifact"><code>repository_summary.json</code><span>Narrative summary</span></div>
      <div style="margin-top:24px">
        <div class="section-sub" style="margin-bottom:12px">DNA Preview</div>
        <div class="agent-json">${renderDnaPreview(data)}</div>
      </div>
    </section>
  </main>

  <footer>
    <span>Generated by Mnemos</span>
    <span class="mono">${data.stats.filesScanned} files · ${data.stats.domainsFound} domains · ${data.stats.flowsFound} flows · ${(
      data.stats.durationMs / 1000
    ).toFixed(1)}s</span>
  </footer>

  <script>${SCRIPT}</script>
</body>
</html>`;
}

function renderCapability(c: ReportData['capabilities'][number]): string {
  const confidencePct = Math.round(c.confidence * 100);
  const confidenceTag =
    confidencePct >= 70 ? 'tag-low' : confidencePct >= 40 ? 'tag-medium' : 'tag-high';
  return `<article class="card" data-search="${escape(c.name)} ${escape(c.purpose)} ${escape(c.category)}">
    <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:6px">
      <span class="category-chip">${escape(c.category)}</span>
      <span class="tag ${confidenceTag}">${confidencePct}% confidence</span>
    </div>
    <h3 class="card-name">${escape(c.name)}</h3>
    <p class="card-purpose">${escape(c.purpose)}</p>
    ${
      c.keyResponsibilities.length > 0
        ? `<div class="card-label">Key Responsibilities</div>
           <ul class="card-list">${c.keyResponsibilities
             .map((r) => `<li>${escape(r)}</li>`)
             .join('')}</ul>`
        : ''
    }
    ${
      c.services.length > 0
        ? `<div class="card-label">Services</div>
           <ul class="card-list">${c.services
             .map((s) => `<li><span class="mono">${escape(s)}</span></li>`)
             .join('')}</ul>`
        : ''
    }
    ${
      c.apis.length > 0
        ? `<div class="card-label">Endpoints</div>
           <ul class="card-list">${c.apis
             .map((a) => `<li><span class="mono">${escape(a)}</span></li>`)
             .join('')}</ul>`
        : ''
    }
    <div class="card-meta">
      <span class="meta-item">Complexity <b>${c.complexity}</b></span>
      <span class="meta-item">Risk <b>${c.risk}</b></span>
    </div>
  </article>`;
}

function renderJourneyFlow(j: ReportData['journeys'][number]): string {
  const steps = buildJourneySteps(j);
  const stepHtml = steps
    .map(
      (s, i) =>
        `<div class="journey-step">
          ${i > 0 ? '<div class="journey-arrow">↓</div>' : ''}
          <div class="journey-step-box kind-${escape(s.kind)}">${escape(s.label)}</div>
        </div>`,
    )
    .join('');

  return `<article class="journey-card" data-search="${escape(j.name)} ${escape(j.purpose)}">
    <div class="journey-head">
      <div class="journey-name">${escape(j.name)}</div>
      <span class="tag tag-low">${(j.confidence * 100).toFixed(0)}%</span>
    </div>
    ${j.purpose ? `<p class="card-purpose" style="margin:6px 0 12px">${escape(j.purpose)}</p>` : ''}
    <div class="journey-flow">${stepHtml}</div>
    <div class="journey-grid" style="margin-top:16px">
      <div class="journey-key">Actors</div><div class="journey-val">${j.actors.map(escape).join(', ')}</div>
      <div class="journey-key">Outcome</div><div class="journey-val">${j.outcomes.map(escape).join(', ')}</div>
    </div>
  </article>`;
}

function buildJourneySteps(j: ReportData['journeys'][number]): { label: string; kind: string }[] {
  const steps: { label: string; kind: string }[] = [];
  if (j.actors.length > 0) {
    steps.push({ label: j.actors[0]!, kind: 'actor' });
  }
  for (const s of j.steps.slice(0, 8)) {
    steps.push({ label: s.name, kind: s.kind });
  }
  if (steps.length === 0 && j.entryRoute) {
    steps.push({ label: j.entryRoute, kind: 'route' });
  }
  return steps;
}

function renderDnaPreview(data: ReportData): string {
  const preview = {
    repository: data.repository,
    architecture: data.architecture.type,
    health_score: data.memoryScore.overall,
    capabilities: data.capabilities.slice(0, 5).map((c) => c.name),
    journeys: data.journeys.slice(0, 4).map((j) => j.name),
    domains: data.domains.slice(0, 6).map((d) => d.name),
  };
  const json = JSON.stringify(preview, null, 2);
  return json
    .replace(/"([^"]+)":/g, '<span class="key">"$1"</span>:')
    .replace(/: "([^"]*)"/g, ': <span class="str">"$1"</span>')
    .replace(/: (\d+)/g, ': <span class="num">$1</span>');
}

function renderJourney(j: ReportData['journeys'][number]): string {
  return `<article class="journey">
    <div class="journey-head">
      <div class="journey-name">${escape(j.name)}</div>
      <span class="tag tag-low">${(j.confidence * 100).toFixed(0)}%</span>
    </div>
    ${j.purpose ? `<p class="card-purpose" style="margin:6px 0 4px">${escape(j.purpose)}</p>` : ''}
    <div class="journey-grid">
      <div class="journey-key">Actors</div><div class="journey-val">${j.actors
        .map(escape)
        .join(', ')}</div>
      ${
        j.systems.length > 0
          ? `<div class="journey-key">Systems</div><div class="journey-val">${j.systems
              .map(escape)
              .join(', ')}</div>`
          : ''
      }
      <div class="journey-key">Data</div><div class="journey-val">${j.data
        .map(escape)
        .join(', ')}</div>
      <div class="journey-key">Outcome</div><div class="journey-val">${j.outcomes
        .map(escape)
        .join(', ')}</div>
      ${
        j.preconditions.length > 0
          ? `<div class="journey-key">Requires</div><div class="journey-val">${j.preconditions
              .map(escape)
              .join(', ')}</div>`
          : ''
      }
      ${
        j.entryRoute
          ? `<div class="journey-key">Entry</div><div class="journey-val mono">${escape(j.entryRoute)}</div>`
          : ''
      }
    </div>
  </article>`;
}

function renderScoreCell(label: string, value: number): string {
  return `<div class="score-cell">
    <div class="num">${value}</div>
    <div class="lbl">${escape(label)}</div>
    <div class="score-bar"><span style="width:${Math.max(0, Math.min(100, value))}%"></span></div>
  </div>`;
}

function riskTag(r: 'low' | 'medium' | 'high'): string {
  return `<span class="tag tag-${r}">${r}</span>`;
}

function escape(value: string | number | undefined | null): string {
  if (value === undefined || value === null) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}
