/**
 * The Mnemos docs page — redesigned from zero.
 * Aesthetic: "The Atlas" — editorial tech-print for a memory layer.
 *   • Chapter-numbered sidebar  (§ 01, § 02 …)
 *   • Editorial serif hero titles
 *   • ⌘K search palette that searches titles, descriptions and content
 *   • Reading progress bar (violet → cyan)
 *   • Scroll-spy TOC with smooth active-state highlighting
 *   • Refined code blocks with line numbers, copy button and language label
 *   • Glass callouts with colored accent bars
 *   • Prev/Next cards with gradient blobs and chapter numbers
 */

import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { motion, AnimatePresence, useScroll, useSpring } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  Info,
  Lightbulb,
  AlertTriangle,
  Hash,
  Search,
  Clock,
  CornerDownLeft,
  ArrowUp,
  ThumbsUp,
  ThumbsDown,
  Sparkles,
  BookOpen,
  type LucideIcon,
} from "lucide-react";
import { DOCS, ALL_DOC_PAGES, findDoc, type Block } from "../lib/docs";
import CopyCommand from "../components/ui/CopyCommand";
import { GitHubIcon } from "../lib/logos";
import { cn } from "../lib/utils";

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                   */
/* -------------------------------------------------------------------------- */

function slugify(s: string) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function inline(text: string): ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return parts.map((p, i) => {
    if (p.startsWith("**") && p.endsWith("**"))
      return <strong key={i}>{p.slice(2, -2)}</strong>;
    if (p.startsWith("`") && p.endsWith("`"))
      return <code key={i}>{p.slice(1, -1)}</code>;
    return <Fragment key={i}>{p}</Fragment>;
  });
}

/** Estimate reading time in minutes from raw text. */
function estimateReadingTime(blocks: Block[]): number {
  const text = blocks
    .map((b) =>
      "text" in b
        ? b.text
        : "items" in b
          ? b.items.join(" ")
          : "rows" in b
            ? b.rows.flat().join(" ")
            : "code" in b
              ? b.code
              : ""
    )
    .join(" ");
  const words = text.split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 220));
}

/** Flatten searchable text for the command palette. */
function pageSearchHaystack(p: { title: string; description: string; blocks: Block[] }) {
  return `${p.title} ${p.description} ${p.blocks
    .map((b) =>
      "text" in b
        ? b.text
        : "items" in b
          ? b.items.join(" ")
          : "rows" in b
            ? b.rows.flat().join(" ")
            : "code" in b
              ? b.code
              : ""
    )
    .join(" ")}`.toLowerCase();
}

/* -------------------------------------------------------------------------- */
/*  CodeBlock — terminal-style with copy, lang label and optional line nums  */
/* -------------------------------------------------------------------------- */

function CodeBlock({ code, lang, numbered = false }: { code: string; lang?: string; numbered?: boolean }) {
  const [copied, setCopied] = useState(false);
  const lines = code.split("\n");
  const copy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard unavailable */
    }
  }, [code]);

  return (
    <div className={cn("docs-code", numbered && lines.length > 4 && "docs-code--numbered")}>
      <div className="docs-code__bar">
        <div className="flex items-center">
          <div className="docs-code__lights" aria-hidden>
            <span /><span /><span />
          </div>
          <span className="docs-code__lang">{lang ?? "text"}</span>
        </div>
        <button
          type="button"
          onClick={copy}
          className={cn("docs-code__copy", copied && "is-copied")}
          aria-label="Copy code"
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="docs-code__body">
        <code>
          {lines.map((ln, i) => (
            <Fragment key={i}>
              {numbered && lines.length > 4 && <span className="ln">{i + 1}</span>}
              {ln}
              {"\n"}
            </Fragment>
          ))}
        </code>
      </pre>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Callout                                                                   */
/* -------------------------------------------------------------------------- */

const CALLOUT_MAP: Record<string, { Icon: LucideIcon; cls: string; label: string }> = {
  info: { Icon: Info, cls: "docs-callout--info", label: "Note" },
  tip: { Icon: Lightbulb, cls: "docs-callout--tip", label: "Tip" },
  warn: { Icon: AlertTriangle, cls: "docs-callout--warn", label: "Heads up" },
};

function Callout({
  tone = "info",
  title,
  text,
}: {
  tone?: "info" | "tip" | "warn";
  title: string;
  text: string;
}) {
  const { Icon, cls, label } = CALLOUT_MAP[tone];
  return (
    <aside className={cn("docs-callout", cls)}>
      <span className="docs-callout__icon">
        <Icon size={16} strokeWidth={2.2} />
      </span>
      <div>
        <p className="docs-callout__title">
          <span className="mr-2 font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--text-faint)]">
            {label}
          </span>
          {title}
        </p>
        <p className="docs-callout__body">{inline(text)}</p>
      </div>
    </aside>
  );
}

/* -------------------------------------------------------------------------- */
/*  Block renderer                                                            */
/* -------------------------------------------------------------------------- */

function renderBlock(b: Block, i: number) {
  switch (b.type) {
    case "h2":
      return (
        <h2 key={i} id={slugify(b.text)} className="group">
          {b.text}
          <a href={`#${slugify(b.text)}`} className="docs-anchor" aria-label="Link to section">
            <Hash size={16} />
          </a>
        </h2>
      );
    case "h3":
      return (
        <h3 key={i} id={slugify(b.text)} className="group">
          {b.text}
          <a href={`#${slugify(b.text)}`} className="docs-anchor" aria-label="Link to section">
            <Hash size={14} />
          </a>
        </h3>
      );
    case "p":
      return <p key={i}>{inline(b.text)}</p>;
    case "list":
      return (
        <ul key={i}>
          {b.items.map((it, j) => (
            <li key={j}>{inline(it)}</li>
          ))}
        </ul>
      );
    case "code": {
      if (b.lang === "bash" && !b.code.includes("\n")) {
        return (
          <div key={i} className="my-5">
            <CopyCommand command={b.code.replace(/^\$ ?/, "")} />
          </div>
        );
      }
      const numbered = (b.code.match(/\n/g)?.length ?? 0) >= 4;
      return <CodeBlock key={i} code={b.code} lang={b.lang} numbered={numbered} />;
    }
    case "callout":
      return <Callout key={i} tone={b.tone} title={b.title} text={b.text} />;
    case "cards":
      return (
        <div key={i} className="docs-cards">
          {b.items.map((c, j) => (
            <div key={j} className="docs-card">
              <span className="docs-card__num">§ {String(j + 1).padStart(2, "0")}</span>
              <p className="docs-card__title">{c.title}</p>
              <p className="docs-card__desc">{inline(c.desc)}</p>
            </div>
          ))}
        </div>
      );
    case "table":
      return (
        <div key={i} className="docs-table-wrap">
          <table className="docs-table">
            <thead>
              <tr>
                {b.head.map((h) => (
                  <th key={h}>{inline(h)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {b.rows.map((r, ri) => (
                <tr key={ri}>
                  {r.map((cell, ci) => (
                    <td key={ci}>{inline(cell)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
  }
}

/* -------------------------------------------------------------------------- */
/*  Progress bar — fixed at the very top of the viewport                      */
/* -------------------------------------------------------------------------- */

function ReadingProgress() {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, { stiffness: 220, damping: 30, mass: 0.4 });
  return (
    <div className="docs-progress" aria-hidden>
      <motion.div className="docs-progress__bar" style={{ scaleX }} />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Command palette (search)                                                  */
/* -------------------------------------------------------------------------- */

type SearchItem = {
  page: (typeof ALL_DOC_PAGES)[number];
  group: string;
  score: number;
  globalIdx: number;
};

function SearchPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [q, setQ] = useState("");
  const [focused, setFocused] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  // Build search index (once per open).
  const items: SearchItem[] = useMemo(() => {
    let i = 0;
    return DOCS.flatMap((g) =>
      g.pages.map((p) => ({
        page: p,
        group: g.title,
        score: 0,
        globalIdx: i++,
      }))
    );
  }, []);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return items.slice(0, 12);
    return items
      .map((it) => {
        const hay = pageSearchHaystack(it.page);
        let score = 0;
        if (hay.includes(needle)) score += 4;
        if (it.page.title.toLowerCase().includes(needle)) score += 6;
        if (it.page.description.toLowerCase().includes(needle)) score += 2;
        // word-boundary boost
        const tokens = needle.split(/\s+/).filter(Boolean);
        for (const t of tokens) {
          if (hay.includes(t)) score += 1;
        }
        return { ...it, score };
      })
      .filter((it) => it.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 16);
  }, [items, q]);

  // Group filtered by chapter.
  const grouped = useMemo(() => {
    const m = new Map<string, SearchItem[]>();
    filtered.forEach((it) => {
      const arr = m.get(it.group) ?? [];
      arr.push(it);
      m.set(it.group, arr);
    });
    return Array.from(m.entries());
  }, [filtered]);

  // Reset focused when results change.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setFocused(0), [q]);

  // Keyboard navigation.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setFocused((f) => Math.min(filtered.length - 1, f + 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setFocused((f) => Math.max(0, f - 1));
      } else if (e.key === "Enter") {
        const it = filtered[focused];
        if (it) {
          navigate(`/docs/${it.page.slug}`);
          onClose();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, filtered, focused, navigate, onClose]);

  // Focus the input once mounted (animation-friendly timeout).
  useEffect(() => {
    const t = window.setTimeout(() => inputRef.current?.focus(), 30);
    return () => window.clearTimeout(t);
  }, []);

  let flatCursor = -1;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="docs-palette-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          onClick={onClose}
          role="dialog"
          aria-modal
          aria-label="Search documentation"
        >
          <motion.div
            className="docs-palette"
            initial={{ opacity: 0, y: -12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ duration: 0.22, ease: [0.22, 0.8, 0.18, 1] }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="docs-palette__input-row">
              <Search size={18} className="text-[var(--brand)]" />
              <input
                ref={inputRef}
                className="docs-palette__input"
                placeholder="Search the documentation…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                spellCheck={false}
                autoComplete="off"
              />
              <span className="docs-palette__kbd">ESC</span>
            </div>

            <div className="docs-palette__list">
              {filtered.length === 0 && (
                <p className="docs-palette__empty">
                  No matches for <span className="font-mono">"{q}"</span>.
                </p>
              )}
              {grouped.map(([group, list]) => (
                <div key={group}>
                  <p className="docs-palette__group-label">{group}</p>
                  {list.map((it) => {
                    flatCursor++;
                    const isFocused = flatCursor === focused;
                    const myIdx = flatCursor;
                    return (
                      <button
                        key={it.page.slug}
                        type="button"
                        className={cn("docs-palette__item", isFocused && "is-focused")}
                        onMouseEnter={() => setFocused(myIdx)}
                        onClick={() => {
                          navigate(`/docs/${it.page.slug}`);
                          onClose();
                        }}
                      >
                        <span className="docs-palette__item__num">
                          {String(it.globalIdx + 1).padStart(2, "0")}
                        </span>
                        <span className="docs-palette__item__title">{it.page.title}</span>
                        <span className="docs-palette__item__desc">{group}</span>
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>

            <div className="docs-palette__footer">
              <span><kbd>↑</kbd><kbd>↓</kbd> navigate</span>
              <span><kbd>↵</kbd> open</span>
              <span><kbd>esc</kbd> close</span>
              <span className="ml-auto">{filtered.length} result{filtered.length === 1 ? "" : "s"}</span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* -------------------------------------------------------------------------- */
/*  Sidebar (numbered chapters)                                              */
/* -------------------------------------------------------------------------- */

function Sidebar({
  activeSlug,
  onSearchClick,
}: {
  activeSlug: string;
  onSearchClick: () => void;
}) {
  return (
    <aside className="hidden lg:block">
      <div className="sticky top-24 max-h-[calc(100vh-7rem)] overflow-y-auto pb-12 pr-2">
        <button type="button" className="docs-search-trigger" onClick={onSearchClick}>
          <Search size={14} />
          <span className="grow">Search docs…</span>
          <span className="kbd">⌘K</span>
        </button>

        <div className="mt-7">
          <Link
            to="/"
            className="docs-sidebar-link text-[var(--text-faint)]"
            style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.16em", textTransform: "uppercase" }}
          >
            <ArrowLeft size={12} />
            <span>Back to home</span>
          </Link>
        </div>

        <nav className="mt-4 flex flex-col gap-5">
          {DOCS.map((group, gi) => (
            <div key={group.title}>
              <p className="docs-sidebar-chapter">
                {String(gi + 1).padStart(2, "0")} — {group.title}
              </p>
              <div className="flex flex-col">
                {group.pages.map((p, pi) => {
                  const active = p.slug === activeSlug;
                  // Compute a global-ish page number for display.
                  const before = DOCS.slice(0, gi).reduce((acc, g) => acc + g.pages.length, 0);
                  const num = String(before + pi + 1).padStart(2, "0");
                  return (
                    <Link
                      key={p.slug}
                      to={`/docs/${p.slug}`}
                      className={cn("docs-sidebar-link", active && "is-active")}
                    >
                      <span className="docs-sidebar-link__num">{num}</span>
                      <span className="truncate">{p.title}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="mt-8 rounded-xl border border-dashed border-[var(--border)] p-3.5 text-xs text-[var(--text-faint)]">
          <p className="font-mono uppercase tracking-wider text-[10px] text-[var(--brand)]">
            ⌘ Quick nav
          </p>
          <ul className="mt-2 space-y-1.5 leading-relaxed">
            <li>
              <kbd className="font-mono">⌘K</kbd> — open search
            </li>
            <li>
              <kbd className="font-mono">↑</kbd>/<kbd className="font-mono">↓</kbd> — navigate results
            </li>
            <li>
              <kbd className="font-mono">↵</kbd> — open page
            </li>
          </ul>
        </div>
      </div>
    </aside>
  );
}

/* -------------------------------------------------------------------------- */
/*  Scroll-spy TOC                                                            */
/* -------------------------------------------------------------------------- */

function TOC({ items, activeId }: { items: string[]; activeId: string }) {
  if (items.length === 0) return null;
  return (
    <aside className="hidden xl:block">
      <div className="sticky top-24">
        <p
          className="mb-3 px-3 font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--text-faint)]"
        >
          On this page
        </p>
        <nav className="border-l border-[var(--border)]">
          {items.map((t) => {
            const id = slugify(t);
            const active = id === activeId;
            return (
              <a key={t} href={`#${id}`} className={cn("docs-toc-link", active && "is-active")}>
                {t}
              </a>
            );
          })}
        </nav>

        <div className="mt-8 px-3">
          <a
            href="#top"
            className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--text-faint)] transition-colors hover:text-[var(--text)]"
          >
            <ArrowUp size={11} /> Back to top
          </a>
        </div>
      </div>
    </aside>
  );
}

/* -------------------------------------------------------------------------- */
/*  Page meta chips (reading time, level, etc.)                                */
/* -------------------------------------------------------------------------- */

function PageMeta({ readingMin, slug }: { readingMin: number; slug: string }) {
  // Simple heuristic for "level" based on slug keywords.
  const level =
    /cookbook|recipes|impact|getting-started|quickstart|introduction|install/.test(slug)
      ? "Beginner"
      : /architecture|concepts|smells|ai-pack|mcp|impact/.test(slug)
        ? "Intermediate"
        : /cli|build|pack|benchmarks|reference|all-commands/.test(slug)
          ? "Reference"
          : "Guide";

  return (
    <div className="docs-hero__meta">
      <span className="docs-hero__chip">
        <Clock size={11} /> {readingMin} min read
      </span>
      <span className="docs-hero__chip">
        <Sparkles size={11} /> {level}
      </span>
      <span className="docs-hero__chip">
        <BookOpen size={11} /> Stable
      </span>
      <a
        className="docs-hero__chip transition-colors hover:text-[var(--text)]"
        href="https://github.com/bitreonx/mnemos/tree/main/docs"
        target="_blank"
        rel="noopener noreferrer"
      >
        <GitHubIcon width={11} height={11} /> Edit on GitHub
      </a>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Main page                                                                 */
/* -------------------------------------------------------------------------- */

export default function Docs() {
  const { slug } = useParams();
  const page = findDoc(slug);

  const idx = ALL_DOC_PAGES.findIndex((p) => p.slug === page.slug);
  const prev = idx > 0 ? ALL_DOC_PAGES[idx - 1] : null;
  const next = idx < ALL_DOC_PAGES.length - 1 ? ALL_DOC_PAGES[idx + 1] : null;

  // Chapter info (group index + group title).
  const groupInfo = useMemo(() => {
    let gIdx = 0;
    let before = 0;
    for (let i = 0; i < DOCS.length; i++) {
      if (DOCS[i].pages.some((p) => p.slug === page.slug)) {
        gIdx = i;
        break;
      }
      before += DOCS[i].pages.length;
    }
    const inGroupIdx = DOCS[gIdx].pages.findIndex((p) => p.slug === page.slug);
    return {
      groupTitle: DOCS[gIdx].title,
      groupNumber: String(gIdx + 1).padStart(2, "0"),
      pageNumber: String(before + inGroupIdx + 1).padStart(2, "0"),
      total: ALL_DOC_PAGES.length,
    };
  }, [page.slug]);

  // TOC = every h2.
  const toc = useMemo(
    () => page.blocks.filter((b) => b.type === "h2").map((b) => (b as { text: string }).text),
    [page]
  );

  // Reading time.
  const readingMin = useMemo(() => estimateReadingTime(page.blocks), [page]);

  // Active TOC id (scroll spy).
  const [activeId, setActiveId] = useState<string>(slugify(toc[0] ?? ""));
  useEffect(() => {
    if (toc.length === 0) return;
    const elements = toc
      .map((t) => document.getElementById(slugify(t)))
      .filter((el): el is HTMLElement => el !== null);
    if (elements.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        // Pick the entry that's most visible near the top of the viewport.
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) {
          setActiveId(visible[0].target.id);
        }
      },
      { rootMargin: "-96px 0px -65% 0px", threshold: [0, 0.25, 0.5, 1] }
    );

    elements.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [toc, page.slug]);

  // Search palette.
  const [paletteOpen, setPaletteOpen] = useState(false);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const isMeta = e.metaKey || e.ctrlKey;
      if (isMeta && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Reset TOC scroll-spy when page changes.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setActiveId(slugify(toc[0] ?? ""));
  }, [page.slug, toc]);

  return (
    <>
      <ReadingProgress />
      <SearchPalette key={paletteOpen ? "open" : "closed"} open={paletteOpen} onClose={() => setPaletteOpen(false)} />

      <div id="top" className="container-px relative mx-auto max-w-[1320px] pt-24">
        {/* Ambient grid backdrop for the docs area */}
        <div className="docs-grid" aria-hidden />

        {/* Mobile horizontal nav */}
        <div className="mb-6 flex gap-2 overflow-x-auto pb-2 lg:hidden">
          {ALL_DOC_PAGES.map((p) => (
            <Link
              key={p.slug}
              to={`/docs/${p.slug}`}
              className={cn(
                "shrink-0 rounded-full border px-3 py-1.5 text-xs transition-colors",
                p.slug === page.slug
                  ? "border-[var(--brand)] bg-[color-mix(in_srgb,var(--brand)_10%,transparent)] text-[var(--text)]"
                  : "border-[var(--border)] text-[var(--text-dim)] hover:text-[var(--text)]"
              )}
            >
              {p.title}
            </Link>
          ))}
        </div>

        <div className="grid gap-10 lg:grid-cols-[260px_minmax(0,1fr)_220px] xl:grid-cols-[280px_minmax(0,1fr)_230px]">
          {/* Sidebar */}
          <Sidebar activeSlug={page.slug} onSearchClick={() => setPaletteOpen(true)} />

          {/* Content */}
          <motion.article
            key={page.slug}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, ease: [0.22, 0.8, 0.18, 1] }}
            className="min-w-0 pb-20"
          >
            {/* HERO HEADER */}
            <header className="docs-hero">
              <nav className="docs-hero__breadcrumb" aria-label="Breadcrumb">
                <Link to="/docs">Docs</Link>
                <span className="sep">/</span>
                <Link to="/docs">{groupInfo.groupTitle}</Link>
                <span className="sep">/</span>
                <span className="text-[var(--text-dim)]">{page.title}</span>
              </nav>

              <span className="docs-hero__chapter">
                Chapter {groupInfo.groupNumber} · Page {groupInfo.pageNumber} of {groupInfo.total}
              </span>

              <h1 className="docs-hero__title">
                {renderHeroTitle(page.title)}
              </h1>

              <p className="docs-hero__lede">{page.description}</p>

              <PageMeta readingMin={readingMin} slug={page.slug} />
            </header>

            {/* ARTICLE BODY */}
            <div className="prose-mnemos">{page.blocks.map(renderBlock)}</div>

            {/* HELP / FEEDBACK */}
            <HelpFooter />

            {/* PREV / NEXT */}
            <nav className="docs-prevnext" aria-label="Page navigation">
              {prev ? (
                <Link to={`/docs/${prev.slug}`} className="prev group">
                  <span className="docs-prevnext__label">
                    <ArrowLeft size={11} /> Previous
                  </span>
                  <span className="docs-prevnext__title group-hover:text-[var(--text)]">
                    {prev.title}
                  </span>
                  <span className="docs-prevnext__num">Page {String(idx).padStart(2, "0")}</span>
                </Link>
              ) : (
                <span aria-hidden />
              )}
              {next && (
                <Link
                  to={`/docs/${next.slug}`}
                  className="next group items-end text-right"
                  style={{ alignItems: "flex-end" }}
                >
                  <span className="docs-prevnext__label justify-end">
                    Next <ArrowRight size={11} />
                  </span>
                  <span className="docs-prevnext__title group-hover:text-[var(--text)]">
                    {next.title}
                  </span>
                  <span className="docs-prevnext__num">Page {String(idx + 2).padStart(2, "0")}</span>
                </Link>
              )}
            </nav>
          </motion.article>

          {/* TOC */}
          <TOC items={toc} activeId={activeId} />
        </div>
      </div>
    </>
  );
}

/* -------------------------------------------------------------------------- */
/*  Hero title — small editorial touch: highlight the last word in the title   */
/*  when it's preceded by a preposition-like word ("for", "with", "in", "of"). */
/* -------------------------------------------------------------------------- */

function renderHeroTitle(title: string): ReactNode {
  const tokens = title.split(" ");
  if (tokens.length < 3) return title;
  // Find the last "noun-y" word and accent it (gradient).
  const lastWord = tokens[tokens.length - 1];
  const head = tokens.slice(0, -1).join(" ");
  return (
    <>
      {head}{" "}
      <span className="accent">{lastWord}</span>
    </>
  );
}

/* -------------------------------------------------------------------------- */
/*  HelpFooter — friendly bottom-of-article feedback prompt                   */
/* -------------------------------------------------------------------------- */

function HelpFooter() {
  const [vote, setVote] = useState<"up" | "down" | null>(null);
  return (
    <div className="docs-help">
      <p className="flex items-center gap-2">
        <Sparkles size={14} className="text-[var(--brand)]" />
        <span>Was this page helpful?</span>
      </p>
      <div className="docs-help__buttons">
        <button
          type="button"
          className={cn("docs-help__btn", vote === "up" && "is-active")}
          onClick={() => setVote("up")}
          aria-pressed={vote === "up"}
        >
          <ThumbsUp size={13} /> Yes
        </button>
        <button
          type="button"
          className={cn("docs-help__btn", vote === "down" && "is-active")}
          onClick={() => setVote("down")}
          aria-pressed={vote === "down"}
        >
          <ThumbsDown size={13} /> Could be better
        </button>
        <a
          href="https://github.com/bitreonx/mnemos/issues/new"
          target="_blank"
          rel="noopener noreferrer"
          className="docs-help__btn"
        >
          <CornerDownLeft size={13} /> Suggest edit
        </a>
      </div>
    </div>
  );
}