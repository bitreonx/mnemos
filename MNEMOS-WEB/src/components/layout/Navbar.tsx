import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X, Search } from "lucide-react";
import { NAV_LINKS, SITE } from "../../lib/site";
import { MnemosWordmark, GitHubIcon } from "../../lib/logos";
import ThemeToggle from "../ui/ThemeToggle";
import MagneticButton from "../ui/MagneticButton";

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 16);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const goToAnchor = (href: string) => {
    setOpen(false);
    const id = href.replace("#", "");
    if (location.pathname !== "/") {
      navigate("/");
      setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior: "smooth" }), 80);
    } else {
      document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <motion.header
      initial={{ y: -80, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.7, ease: [0.22, 0.8, 0.18, 1] }}
      className="fixed inset-x-0 top-0 z-50"
    >
      <div
        className={`transition-all duration-500 ${
          scrolled
            ? "border-b border-[var(--border)] bg-[color-mix(in_srgb,var(--bg)_72%,transparent)] backdrop-blur-xl"
            : "border-b border-transparent"
        }`}
      >
        <nav className="container-px mx-auto flex h-16 max-w-[1200px] items-center justify-between gap-4">
          <Link to="/" className="focus-ring rounded-lg" aria-label="Mnemos home">
            <MnemosWordmark />
          </Link>

          {/* center links */}
          <div className="hidden items-center gap-0.5 rounded-full border border-[var(--border)] bg-[var(--surface)] px-1.5 py-1.5 lg:flex">
            {NAV_LINKS.map((l) =>
              "route" in l && l.route ? (
                <Link
                  key={l.label}
                  to={l.href}
                  className="focus-ring rounded-full px-3.5 py-1.5 text-[13px] font-medium text-[var(--text-dim)] transition-colors hover:text-[var(--text)]"
                >
                  {l.label}
                </Link>
              ) : (
                <button
                  key={l.label}
                  onClick={() => goToAnchor(l.href)}
                  className="focus-ring rounded-full px-3.5 py-1.5 text-[13px] font-medium text-[var(--text-dim)] transition-colors hover:text-[var(--text)]"
                >
                  {l.label}
                </button>
              )
            )}
          </div>

          {/* right cluster — all three controls share the same 36px height */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate("/docs")}
              aria-label="Search documentation"
              className="focus-ring hidden h-9 items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface)] px-3.5 text-[13px] text-[var(--text-dim)] transition-colors hover:border-[var(--border-strong)] hover:text-[var(--text)] md:flex"
            >
              <Search size={14} />
              <span>Search docs</span>
              <kbd className="rounded border border-[var(--border)] bg-[var(--bg-1)] px-1.5 py-0.5 font-mono text-[10px]">
                ⌘K
              </kbd>
            </button>

            <div className="hidden sm:flex h-9 items-center">
              <ThemeToggle />
            </div>

            <div className="hidden sm:flex h-9 items-center">
              <MagneticButton href={SITE.github} variant="primary" className="!h-9 !px-5 !py-0 !text-[13px]">
                <GitHubIcon width={15} height={15} />
                Star on GitHub
              </MagneticButton>
            </div>

            <button
              onClick={() => setOpen((o) => !o)}
              aria-label="Toggle menu"
              aria-expanded={open}
              className="focus-ring grid h-9 w-9 place-items-center rounded-full border border-[var(--border)] bg-[var(--surface)] text-[var(--text)] lg:hidden"
            >
              {open ? <X size={18} /> : <Menu size={18} />}
            </button>
          </div>
        </nav>
      </div>

      {/* mobile sheet */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.25 }}
            className="container-px mx-auto max-w-[1200px] lg:hidden"
          >
            <div className="mt-2 flex flex-col gap-1 rounded-2xl border border-[var(--border)] bg-[var(--surface-solid)] p-3 shadow-[var(--shadow-card)]">
              {NAV_LINKS.map((l) =>
                "route" in l && l.route ? (
                  <Link
                    key={l.label}
                    to={l.href}
                    onClick={() => setOpen(false)}
                    className="rounded-xl px-4 py-3 text-[0.95rem] font-medium text-[var(--text)] hover:bg-[var(--surface-2)]"
                  >
                    {l.label}
                  </Link>
                ) : (
                  <button
                    key={l.label}
                    onClick={() => goToAnchor(l.href)}
                    className="rounded-xl px-4 py-3 text-left text-[0.95rem] font-medium text-[var(--text)] hover:bg-[var(--surface-2)]"
                  >
                    {l.label}
                  </button>
                )
              )}
              <div className="mt-2 flex items-center justify-between border-t border-[var(--border)] px-2 pt-3">
                <ThemeToggle />
                <a
                  href={SITE.github}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-full bg-[var(--brand)] px-4 py-2 text-sm font-semibold text-white"
                >
                  <GitHubIcon width={16} height={16} /> Star on GitHub
                </a>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.header>
  );
}
