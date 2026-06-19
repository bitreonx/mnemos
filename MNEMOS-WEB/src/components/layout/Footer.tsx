import { Link } from "react-router-dom";
import { SITE } from "../../lib/site";
import { MnemosMark, GitHubIcon } from "../../lib/logos";

const COLUMNS = [
  {
    title: "Product",
    links: [
      { label: "Why Mnemos", href: "/#why" },
      { label: "Three Modes", href: "/#modes" },
      { label: "Benchmarks", href: "/#benchmarks" },
      { label: "Comparison", href: "/#compare" },
    ],
  },
  {
    title: "Documentation",
    links: [
      { label: "Introduction", href: "/docs/introduction", route: true },
      { label: "Repository DNA", href: "/docs/repository-dna", route: true },
      { label: "Shared Agent Memory", href: "/docs/shared-agent-memory", route: true },
      { label: "CLI Reference", href: "/docs/cli-default", route: true },
      { label: "Examples", href: "/docs/examples", route: true },
    ],
  },
  {
    title: "Resources",
    links: [
      { label: "GitHub", href: SITE.github, external: true },
      { label: "AI Pack v1", href: "/docs/ai-pack", route: true },
      { label: "MCP Server", href: "/docs/cli-mcp", route: true },
      { label: "Roadmap", href: SITE.github + "/blob/main/docs/roadmap.md", external: true },
    ],
  },
];

export default function Footer() {
  return (
    <footer className="relative border-t border-[var(--border)]">
      <div className="container-px mx-auto max-w-[1200px] py-16">
        <div className="grid gap-12 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div>
            <div className="flex items-center gap-2.5 text-[var(--brand)]">
              <MnemosMark size={26} />
              <span className="text-lg font-bold tracking-tight text-[var(--text)]">Mnemos</span>
            </div>
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-[var(--text-dim)]">
              {SITE.tagline} Local-first, no cloud, no API keys.
            </p>
            <a
              href={SITE.github}
              target="_blank"
              rel="noopener noreferrer"
              className="focus-ring mt-5 inline-flex items-center gap-2 rounded-full border border-[var(--border-strong)] bg-[var(--surface)] px-4 py-2 text-sm font-medium text-[var(--text)] transition-colors hover:border-[var(--brand)]"
            >
              <GitHubIcon width={15} height={15} /> Star on GitHub
            </a>
          </div>

          {COLUMNS.map((col) => (
            <div key={col.title}>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-faint)]">
                {col.title}
              </h4>
              <ul className="mt-4 space-y-2.5">
                {col.links.map((l) => (
                  <li key={l.label}>
                    {"route" in l && l.route ? (
                      <Link
                        to={l.href}
                        className="text-sm text-[var(--text-dim)] transition-colors hover:text-[var(--text)]"
                      >
                        {l.label}
                      </Link>
                    ) : (
                      <a
                        href={l.href}
                        target={"external" in l && l.external ? "_blank" : undefined}
                        rel={"external" in l && l.external ? "noopener noreferrer" : undefined}
                        className="text-sm text-[var(--text-dim)] transition-colors hover:text-[var(--text)]"
                      >
                        {l.label}
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-14 flex flex-col items-center justify-between gap-4 border-t border-[var(--border)] pt-8 text-sm text-[var(--text-faint)] sm:flex-row">
          <p>© {new Date().getFullYear()} Mnemos · MIT License</p>
          <p className="flex items-center gap-1.5">
            Built by
            <a
              href={SITE.github}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-[var(--text-dim)] transition-colors hover:text-[var(--brand)]"
            >
              {SITE.author}
            </a>
            · Don't let your code be forgotten.
          </p>
        </div>
      </div>
    </footer>
  );
}
