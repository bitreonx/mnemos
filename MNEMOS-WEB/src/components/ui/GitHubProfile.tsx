import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { SITE } from "../../lib/site";
import DecryptText from "./DecryptText";
import StarButton from "./StarButton";

/**
 * "Made by" creator cluster. Avatar enlarges on hover, byline decrypts in
 * character-by-character. A compact, solid-purple Star pill (not a clunky
 * floating bubble) lives inline next to the profile so it appears immediately
 * — no long delay, no bad tooltip, no misplaced card.
 */
export default function GitHubProfile({ delay = 0 }: { delay?: number }) {
  const [hover, setHover] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    if (delay <= 0) {
      setMounted(true);
      return;
    }
    const t = setTimeout(() => setMounted(true), delay);
    return () => clearTimeout(t);
  }, [delay]);

  return (
    <div
      className="relative flex flex-wrap items-center justify-end gap-3"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <span className="font-serif text-lg italic text-[var(--text-dim)]">Made by</span>

      <a
        href={SITE.github}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`${SITE.author} on GitHub`}
        className="focus-ring group flex items-center gap-2.5 rounded-full"
      >
        <motion.span
          className="relative block overflow-hidden rounded-lg"
          animate={{ width: hover ? 40 : 34, height: hover ? 40 : 34 }}
          transition={{ type: "spring", stiffness: 320, damping: 22 }}
          style={{ boxShadow: "0 0 0 1px var(--border-strong)" }}
        >
          <motion.img
            src={SITE.avatar}
            alt={SITE.author}
            className="h-full w-full object-cover"
            animate={{ scale: hover ? 1.14 : 1 }}
            transition={{ type: "spring", stiffness: 260, damping: 20 }}
            loading="lazy"
          />
          <motion.span
            className="pointer-events-none absolute inset-0 rounded-lg"
            animate={{ opacity: hover ? 1 : 0 }}
            style={{ boxShadow: "0 0 18px -2px var(--glow) inset, 0 0 0 1px var(--brand)" }}
          />
        </motion.span>

        <AnimatePresence>
          {hover && (
            <motion.span
              initial={{ opacity: 0, width: 0 }}
              animate={{ opacity: 1, width: "auto" }}
              exit={{ opacity: 0, width: 0 }}
              transition={{ duration: 0.3 }}
              className="overflow-hidden whitespace-nowrap font-mono text-[0.85rem] font-medium text-[var(--text)]"
            >
              <DecryptText text={SITE.authorByline} active={hover} speed={26} />
            </motion.span>
          )}
        </AnimatePresence>
      </a>

      {/* Inline solid-purple star pill — replaces the bad floating bubble.
          Appears fast, lives in the natural flow, no tooltip drama. */}
      <AnimatePresence>
        {mounted && (
          <motion.div
            initial={{ opacity: 0, scale: 0.85, x: 4 }}
            animate={{ opacity: 1, scale: 1, x: 0 }}
            exit={{ opacity: 0, scale: 0.9, x: 4 }}
            transition={{ type: "spring", stiffness: 320, damping: 22, delay: 0.05 }}
          >
            <StarButton label="Star" />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
