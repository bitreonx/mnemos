import type { ReportData } from './report.js';
import { REPORT_CSS, REPORT_FONT_LINK, renderHealthRingHtml } from './report/design-tokens.js';

const SCORE_DEFINITIONS: Record<string, string> = {
  Discoverability: 'How quickly a human or AI can find the right files, domains, and entry points.',
  'Architecture Clarity': 'How understandable the structure is after penalties from detected smells.',
  Coupling: 'How contained modules stay vs pulling across services.',
  Documentation: 'How well domains and system shape are described in generated context.',
  'Dependency Complexity': 'Cross-domain and dependency sprawl increasing change risk.',
};

const STYLES = REPORT_CSS + `
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body {
    background: var(--color-bg);
    color: var(--color-fg);
    font-family: var(--font-sans);
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
    background: color-mix(in srgb, var(--color-surface) 82%, transparent);
    border-bottom: 1px solid var(--color-border-subtle);
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

  .dashboard-pill {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 7px 14px;
    border-radius: 999px;
    background: var(--surface-2);
    color: var(--text);
    border: 1px solid var(--border);
    font-size: 12.5px;
    font-weight: 600;
    text-decoration: none;
    white-space: nowrap;
  }
  .dashboard-pill:hover { border-color: var(--accent); color: var(--accent); }
  .preview-badge {
    display: inline-block;
    padding: 2px 7px;
    border-radius: 999px;
    background: rgba(245, 158, 11, 0.14);
    color: #8a5500;
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
  @media (prefers-color-scheme: dark) {
    .preview-badge { color: #fbbf24; background: rgba(245, 158, 11, 0.18); }
  }

  .health-glance {
    text-align: center;
    padding: 48px 32px;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    box-shadow: var(--shadow);
  }
  .health-glance-num {
    font-size: 72px;
    font-weight: 700;
    letter-spacing: -0.03em;
    line-height: 1;
    color: var(--accent);
    font-variant-numeric: tabular-nums;
  }
  .health-glance-label {
    margin-top: 8px;
    font-size: 14px;
    font-weight: 600;
    color: var(--text-2);
  }
  .health-glance-story {
    margin: 16px auto 0;
    max-width: 480px;
    color: var(--text-2);
    font-size: 16px;
    line-height: 1.5;
  }
  .health-glance-link {
    display: inline-block;
    margin-top: 20px;
    color: var(--accent);
    font-size: 14px;
    font-weight: 500;
    text-decoration: none;
  }
  .health-glance-link:hover { text-decoration: underline; }

  .toggle {
    display: inline-flex;
    padding: 2px;
    background: var(--color-surface-2);
    border-radius: var(--radius-sm);
    border: 1px solid var(--color-border);
  }
  .toggle button {
    appearance: none;
    border: 0;
    background: transparent;
    font: inherit;
    color: var(--color-fg-muted);
    padding: 6px 12px;
    border-radius: var(--radius-xs);
    cursor: pointer;
    font-size: 12.5px;
    font-weight: 500;
    transition: color 0.15s var(--ease-out), background 0.15s var(--ease-out);
  }
  .toggle button:hover { color: var(--color-fg); }
  .toggle button.active {
    background: var(--color-surface);
    color: var(--color-fg);
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
    flex-wrap: wrap;
    gap: 8px 16px;
    margin-bottom: 20px;
  }
  .section-title {
    font-size: 22px;
    font-weight: 600;
    letter-spacing: -0.01em;
    margin: 0;
  }
  .section-sub { color: var(--text-3); font-size: 13px; }
  .section-dash-link {
    font-size: 13px;
    font-weight: 500;
    color: var(--accent);
    text-decoration: none;
    white-space: nowrap;
  }
  .section-dash-link:hover { text-decoration: underline; }

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
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
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

  .coder-only { display: none; }
  .ai-only { display: none; }
  body[data-mode="coder"] .vibe-only { display: none; }
  body[data-mode="coder"] .coder-only { display: block; }
  body[data-mode="ai"] .vibe-only { display: none; }
  body[data-mode="ai"] .ai-only { display: block; }
  .artifact-legend {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 4px;
    background: var(--color-surface-2);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    font-size: 12px;
  }
  .artifact-legend span, .artifact-legend a {
    padding: 4px 10px;
    border-radius: var(--radius-xs);
    color: var(--text-2);
    text-decoration: none;
    font-weight: 500;
    transition: color 0.15s var(--ease-out), background 0.15s var(--ease-out);
  }
  .artifact-legend .active {
    background: var(--color-surface);
    color: var(--color-fg);
    box-shadow: 0 1px 2px rgba(0,0,0,0.06);
    font-weight: 600;
  }

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
  .score-cell .desc {
    margin-top: 8px;
    font-size: 12px;
    color: var(--text-3);
    line-height: 1.45;
  }
  .health-mini-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
    gap: 10px;
    margin-top: 28px;
    text-align: left;
  }
  .health-mini-item {
    padding: 12px 14px;
    background: var(--surface-2);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
  }
  .health-mini-item .lbl { font-size: 11px; color: var(--text-3); text-transform: uppercase; letter-spacing: 0.04em; font-weight: 600; }
  .health-mini-item .val { font-size: 22px; font-weight: 700; margin-top: 4px; font-variant-numeric: tabular-nums; }
  .copy-btn {
    appearance: none;
    border: 1px solid var(--border);
    background: var(--surface);
    color: var(--text-2);
    font: inherit;
    font-size: 12px;
    padding: 5px 10px;
    border-radius: 6px;
    cursor: pointer;
  }
  .copy-btn:hover { border-color: var(--accent); color: var(--accent); }
  .copy-btn.copied { color: var(--good); border-color: var(--good); }
  .agent-json-wrap { position: relative; }
  .agent-json-actions { display: flex; justify-content: flex-end; margin-bottom: 8px; }

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
    .topbar-inner { padding: 12px 18px; flex-wrap: wrap; gap: 10px; }
    .topbar-right { width: 100%; flex-wrap: wrap; margin-left: 0; }
    .artifact-legend { flex-wrap: wrap; }
    .search-box { width: 100%; max-width: none; }
    .grid, .grid-tight { grid-template-columns: 1fr; }
    .mode-banner { flex-direction: column; }
    .persona-grid { grid-template-columns: 1fr; }
    .health-mini-grid { grid-template-columns: 1fr 1fr; }
  }

  @media print {
    .topbar, .mode-banner, .toggle, .search-box, .dashboard-pill, .copy-btn, .section-dash-link { display: none !important; }
    body { background: #fff; color: #111; }
    .card, .health-glance, details { break-inside: avoid; box-shadow: none; }
    main { padding-top: 24px; }
  }

  .dashboard-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 14px;
    border-radius: 999px;
    background: linear-gradient(135deg, var(--accent), var(--accent-2));
    color: #fff;
    font-size: 12.5px;
    font-weight: 600;
    text-decoration: none;
    border: none;
    cursor: pointer;
    transition: opacity 0.15s;
  }
  .dashboard-btn:hover { opacity: 0.88; }
  .dashboard-btn svg { flex-shrink: 0; }

  .mode-banner {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 14px 20px;
    background: linear-gradient(135deg, rgba(94,92,230,0.06), rgba(10,132,255,0.06));
    border: 1px solid rgba(94,92,230,0.12);
    border-radius: var(--radius);
    margin-bottom: 28px;
    font-size: 14px;
    color: var(--text-2);
    position: relative;
  }
  .mode-banner-close {
    position: absolute;
    top: 8px;
    right: 12px;
    background: none;
    border: none;
    color: var(--text-3);
    cursor: pointer;
    font-size: 16px;
    padding: 2px 6px;
    line-height: 1;
  }
  .mode-banner strong { color: var(--text); }
  .mode-banner code { font-family: var(--mono); background: rgba(94,92,230,0.08); padding: 2px 6px; border-radius: 4px; font-size: 12px; }

  .whats-next {
    margin-top: 64px;
    padding: 28px;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    box-shadow: var(--shadow);
  }
  .whats-next h2 {
    font-size: 20px;
    font-weight: 600;
    margin: 0 0 6px;
    letter-spacing: -0.01em;
  }
  .whats-next > p {
    color: var(--text-2);
    font-size: 14px;
    margin: 0 0 20px;
  }
  .persona-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 14px;
  }
  .persona-card {
    padding: 18px;
    background: var(--surface-2);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
  }
  .persona-card h3 {
    font-size: 14px;
    font-weight: 600;
    margin: 0 0 8px;
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .persona-card p {
    color: var(--text-2);
    font-size: 13px;
    margin: 0 0 10px;
    line-height: 1.5;
  }
  .persona-cmd {
    font-family: var(--mono);
    font-size: 12px;
    color: var(--accent);
    background: rgba(94,92,230,0.06);
    padding: 6px 10px;
    border-radius: 6px;
    display: block;
    margin-bottom: 4px;
  }
  .persona-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    display: inline-block;
    flex-shrink: 0;
  }
`;

const SCRIPT = `
  function setMode(mode) {
    document.body.dataset.mode = mode;
    document.querySelectorAll('.toggle button').forEach((b) => {
      b.classList.toggle('active', b.dataset.mode === mode);
    });
    const dash = document.getElementById('dashboard-link');
    const dashPill = document.getElementById('dashboard-link-pill');
    if (dash || dashPill) {
      const repo = (dash || dashPill).dataset.repo || 'local';
      const paths = { vibe: '/vibe/' + repo + '/story', ai: '/ai/' + repo + '/home', coder: '/coder/' + repo + '/overview' };
      const href = 'http://localhost:5173' + (paths[mode] || paths.coder);
      if (dash) dash.href = href;
      if (dashPill) dashPill.href = href;
    }
    try {
      localStorage.setItem('mnemos.mode', mode);
      const u = new URL(window.location.href);
      u.searchParams.set('mode', mode);
      history.replaceState(null, '', u.pathname + u.search);
    } catch (_) {}
  }
  document.querySelectorAll('.toggle button').forEach((b) => {
    b.addEventListener('click', () => setMode(b.dataset.mode));
  });
  let saved = 'vibe';
  try {
    const params = new URLSearchParams(window.location.search);
    saved = params.get('mode') || localStorage.getItem('mnemos.mode') || localStorage.getItem('mnemos-mode') || 'vibe';
  } catch (_) {}
  if (saved === 'developer') saved = 'coder';
  if (saved === 'agent') saved = 'ai';
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

  // Mode explainer banner
  const banner = document.getElementById('mode-banner');
  const bannerClose = document.getElementById('mode-banner-close');
  if (banner && bannerClose) {
    let dismissed = false;
    try { dismissed = localStorage.getItem('mnemos-banner-dismissed') === '1'; } catch (_) {}
    if (dismissed) banner.style.display = 'none';
    bannerClose.addEventListener('click', () => {
      banner.style.display = 'none';
      try { localStorage.setItem('mnemos-banner-dismissed', '1'); } catch (_) {}
    });
  }

  // Mode tooltip on toggle hover
  const modeDescriptions = {
    vibe: 'Vibe — for vibecoders, PMs, founders: product story, journeys, capabilities, health at a glance.',
    ai: 'AI — for Claude, Cursor, Trae: AI Pack v1, repairs, context docs, copy-ready prompts.',
    coder: 'Coder — for human developers: architecture, flows, smells, score breakdown, code map.'
  };
  document.querySelectorAll('.toggle button[data-mode]').forEach(btn => {
    btn.title = modeDescriptions[btn.dataset.mode] || '';
  });

  const copyBtn = document.getElementById('copy-dna-btn');
  const dnaRaw = document.getElementById('dna-raw');
  if (copyBtn && dnaRaw) {
    copyBtn.addEventListener('click', async () => {
      const raw = dnaRaw.textContent || '';
      try {
        await navigator.clipboard.writeText(raw);
        copyBtn.textContent = 'Copied!';
        copyBtn.classList.add('copied');
        setTimeout(() => {
          copyBtn.textContent = 'Copy JSON';
          copyBtn.classList.remove('copied');
        }, 2000);
      } catch (_) {}
    });
  }
`;

export function renderReport(data: ReportData): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="${REPORT_FONT_LINK}" rel="stylesheet" />
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
        <nav class="artifact-legend" aria-label="What am I looking at?">
          <span style="padding:4px 8px;color:var(--text-3);font-size:11px">What am I looking at?</span>
          <a id="dashboard-link" class="active" data-repo="${escape(data.repository)}" href="http://localhost:5173/vibe/${escape(data.repository)}/story">Dashboard</a>
          <span class="active">Report</span>
          <a href="http://localhost:5173/json/${escape(data.repository)}" target="_blank" rel="noopener">AI JSON</a>
        </nav>
        <div class="score-pill" title="Repository Memory Score">
          <span>Health</span>
          <span class="score-num">${data.memoryScore.overall}/100</span>
        </div>
        <a id="dashboard-link-pill" class="dashboard-pill" data-repo="${escape(data.repository)}" href="http://localhost:5173/vibe/${escape(data.repository)}/story" title="Interactive dashboard — preview, under active development"><span class="preview-badge">Preview</span> Dashboard</a>
        <div class="toggle" role="tablist" aria-label="Reader mode">
          <button data-mode="vibe" class="active">Vibe</button>
          <button data-mode="ai">AI</button>
          <button data-mode="coder">Coder</button>
        </div>
        <input type="search" id="report-search" class="search-box" placeholder="Search…" aria-label="Search report" />
      </div>
    </div>
  </header>

  <main>
    <div class="mode-banner" id="mode-banner">
      <div>
        <strong>Report · AI JSON · Dashboard preview</strong>
        <span style="margin-left:4px">
          This HTML report is the <strong>stable</strong> surface — share it offline.
          <strong>Vibe</strong> = product story ·
          <strong>AI</strong> = agent context ·
          <strong>Coder</strong> = architecture deep-dive.
        </span>
        <span style="margin-left:8px;color:var(--text-3)">The interactive dashboard is in preview — we welcome community help on <a href="https://github.com/bitreonx/mnemos" style="color:var(--accent)">GitHub</a>.</span>
      </div>
      <button class="mode-banner-close" id="mode-banner-close" aria-label="Dismiss">&times;</button>
    </div>

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
        <h2 class="section-title">User Journeys</h2>
        <span class="section-sub">${data.journeys.length} journey${
          data.journeys.length === 1 ? '' : 's'
        } mapped</span>
        <a class="section-dash-link" href="http://localhost:5173/vibe/${escape(data.repository)}/journeys">Open in dashboard →</a>
      </div>
      ${
        data.journeys.length === 0
          ? `<div class="empty">No user journeys discovered. Add route handlers and entry points to surface them.</div>`
          : data.journeys.map(renderJourneyFlow).join('')
      }
    </section>

    <section class="vibe-only">
      <div class="section-head">
        <h2 class="section-title">Capabilities</h2>
        <span class="section-sub">${data.capabilities.length} system${
          data.capabilities.length === 1 ? '' : 's'
        } discovered</span>
        <a class="section-dash-link" href="http://localhost:5173/vibe/${escape(data.repository)}/capabilities">Open in dashboard →</a>
      </div>
      ${
        data.capabilities.length === 0
          ? `<div class="empty">No capabilities detected yet. Build a richer graph to surface them.</div>`
          : `<div class="grid">${data.capabilities.map(renderCapability).join('')}</div>`
      }
    </section>

    <section class="vibe-only">
      <div class="health-glance">
        ${renderHealthRingHtml(data.memoryScore.overall, 128)}
        <div class="health-glance-label">Repository health</div>
        <p class="health-glance-story">${escape(healthNarrative(data.memoryScore.overall))}</p>
        <div class="health-mini-grid">
          ${renderHealthMiniItem('Discoverability', data.memoryScore.discoverability)}
          ${renderHealthMiniItem('Architecture', data.memoryScore.architectureClarity)}
          ${renderHealthMiniItem('Coupling', data.memoryScore.coupling)}
          ${renderHealthMiniItem('Documentation', data.memoryScore.documentationQuality)}
          ${renderHealthMiniItem('Dependencies', data.memoryScore.dependencyComplexity)}
        </div>
        <a class="health-glance-link" href="http://localhost:5173/coder/${escape(data.repository)}/overview" title="Dashboard preview">Score breakdown (dashboard preview) →</a>
      </div>
    </section>

    <section class="coder-only">
      <div class="section-head">
        <h2 class="section-title">Memory Score</h2>
        <span class="section-sub">Composite 0–100</span>
        <a class="section-dash-link" href="http://localhost:5173/coder/${escape(data.repository)}/overview">Open in dashboard →</a>
      </div>
      <div class="score-grid">
        ${renderScoreCell('Discoverability', data.memoryScore.discoverability)}
        ${renderScoreCell('Architecture Clarity', data.memoryScore.architectureClarity)}
        ${renderScoreCell('Coupling', data.memoryScore.coupling)}
        ${renderScoreCell('Documentation', data.memoryScore.documentationQuality)}
        ${renderScoreCell('Dependency Complexity', data.memoryScore.dependencyComplexity)}
      </div>
    </section>

    <section class="coder-only">
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

    <section class="coder-only">
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

    <section class="coder-only">
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

    <section class="ai-only">
      <div class="section-head">
        <h2 class="section-title">AI Pack v1 — Agent Context</h2>
        <span class="section-sub">For Claude, Cursor, Trae — structured JSON contract</span>
        <a class="section-dash-link" href="http://localhost:5173/json/${escape(data.repository)}" target="_blank" rel="noopener">Open AI JSON →</a>
      </div>
      <p style="color:var(--text-2);margin-bottom:20px;max-width:640px">
        AI Pack <strong>v${escape(data.aiPackVersion)}</strong> — ${escape(data.aiPackNarrative)}
        AI readiness: <strong>${data.aiReadinessOverall}/100</strong>.
        Feed agents via <code class="mono">project.dna.json</code>, <code class="mono">GET /copilot/pack/:repoId</code>,
        or the dashboard <a href="http://localhost:5173/json/${escape(data.repository)}" style="color:var(--accent)">/json/${escape(data.repository)}</a> route.
      </p>
      ${
        data.topIssues.length > 0
          ? `<div style="margin-bottom:20px">
              <div class="section-sub" style="margin-bottom:8px">Top repairs (${data.topIssues.length})</div>
              <div class="grid">${data.topIssues
                .map(
                  (issue) => `<div class="card" data-search="${escape(issue.title)}">
                    <div class="card-title">${escape(issue.title)} <span class="tag tag-${issue.severity === 'low' ? 'low' : issue.severity === 'medium' ? 'medium' : 'high'}">${escape(issue.severity)}</span></div>
                    <div class="card-body">${escape(issue.summary)}</div>
                  </div>`,
                )
                .join('')}</div>
            </div>`
          : ''
      }
      <div class="agent-artifact"><code>AI Pack v1</code><span><code class="mono">curl localhost:4000/copilot/pack/${escape(data.repository)}?section=summary</code></span></div>
      <div class="agent-artifact"><code>project.dna.json</code><span>Canonical repository DNA</span></div>
      <div class="agent-artifact"><code>agent_context.json</code><span>Rich agent context bundle</span></div>
      <div class="agent-artifact"><code>flows.json</code><span>${data.flows.length} execution flows</span></div>
      <div class="agent-artifact"><code>domains.json</code><span>${data.domains.length} logical domains</span></div>
      <div class="agent-artifact"><code>critical_paths.json</code><span>${data.criticalPaths.length} risk-ranked paths</span></div>
      <div class="agent-artifact"><code>integrations/AGENTS.md</code><span>Agent guide for Claude, Cursor, Codex</span></div>
      <div class="agent-artifact"><code>integrations/cursor-rule.mdc</code><span>Cursor rule — run <code class="mono">mnemos setup</code> to install</span></div>
      <div class="agent-artifact"><code>integrations/ai-prompt.md</code><span>Copy-paste starter prompt</span></div>
      <div style="margin-top:16px;padding:16px 18px;background:var(--surface-2);border-radius:var(--radius-sm);border:1px solid var(--border);max-width:640px">
        <div style="font-weight:600;margin-bottom:8px">Setup in 30 seconds</div>
        <ol style="margin:0;padding-left:18px;color:var(--text-2);font-size:14px;line-height:1.7">
          <li>Run <code class="mono">mnemos setup</code> — installs AGENTS.md + Cursor rules</li>
          <li>Run <code class="mono">mnemos prompt</code> — copy starter prompt into chat</li>
          <li>Run <code class="mono">mnemos serve</code> — live queries at localhost:4000</li>
        </ol>
      </div>
      <div style="margin-top:24px">
        <div class="section-sub" style="margin-bottom:12px">DNA Preview</div>
        <div class="agent-json-wrap">
          <div class="agent-json-actions">
            <button type="button" class="copy-btn" id="copy-dna-btn" data-copy-target="dna-preview">Copy JSON</button>
          </div>
          <div class="agent-json" id="dna-preview">${renderDnaPreview(data)}</div>
          <script type="application/json" id="dna-raw">${buildDnaPreviewJson(data).replace(/</g, '\\u003c')}</script>
        </div>
      </div>
    </section>
  </main>

  <section class="whats-next" style="max-width:1200px;margin:0 auto 48px;padding-left:28px;padding-right:28px">
    <h2>What's next?</h2>
    <p>Choose your path — each one is designed for a different way of working.</p>
    <div class="persona-grid">
      <div class="persona-card">
        <h3><span class="persona-dot" style="background:var(--accent)"></span> Vibecoder</h3>
        <p>Product story, journeys, capabilities — no raw JSON or graphs. This report in Vibe mode.</p>
        <code class="persona-cmd">mnemos report --open</code>
      </div>
      <div class="persona-card">
        <h3><span class="persona-dot" style="background:var(--good)"></span> Coder</h3>
        <p>Architecture, flows, smells, score breakdown — switch to Coder mode above.</p>
        <code class="persona-cmd">mnemos pack --section=score</code>
      </div>
      <div class="persona-card">
        <h3><span class="persona-dot" style="background:var(--accent-2)"></span> AI (Claude / Cursor / Trae)</h3>
        <p>AI Pack v1 JSON, repairs, copy-ready prompts — fewer tokens, fewer tool calls.</p>
        <code class="persona-cmd">mnemos pack --section=summary</code>
        <code class="persona-cmd">mnemos serve → /copilot/pack/${escape(data.repository)}</code>
        <p style="margin-top:8px;margin-bottom:0">Switch to <strong>AI mode</strong> above for the full agent context list.</p>
      </div>
    </div>
  </section>

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

function buildDnaPreviewObject(data: ReportData) {
  return {
    repository: data.repository,
    architecture: data.architecture.type,
    health_score: data.memoryScore.overall,
    capabilities: data.capabilities.slice(0, 5).map((c) => c.name),
    journeys: data.journeys.slice(0, 4).map((j) => j.name),
    domains: data.domains.slice(0, 6).map((d) => d.name),
  };
}

function buildDnaPreviewJson(data: ReportData): string {
  return JSON.stringify(buildDnaPreviewObject(data), null, 2);
}

function renderDnaPreview(data: ReportData): string {
  const json = buildDnaPreviewJson(data);
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

function healthNarrative(score: number): string {
  if (score >= 80) return 'This codebase is in great shape for shipping and onboarding teammates or AI agents.';
  if (score >= 60) return 'Healthy enough to move fast — a few areas need attention before big changes.';
  if (score >= 40) return 'Understandable, but plan fixes before humans or AI can move safely every day.';
  return 'Needs work before humans or AI can reason about this repo without risk.';
}

function renderHealthMiniItem(label: string, value: number): string {
  return `<div class="health-mini-item">
    <div class="lbl">${escape(label)}</div>
    <div class="val">${value}</div>
  </div>`;
}

function renderScoreCell(label: string, value: number): string {
  const def = SCORE_DEFINITIONS[label] ?? '';
  return `<div class="score-cell">
    <div class="num">${value}</div>
    <div class="lbl">${escape(label)}</div>
    <div class="score-bar"><span style="width:${Math.max(0, Math.min(100, value))}%"></span></div>
    ${def ? `<div class="desc">${escape(def)}</div>` : ''}
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
