import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

type Theme = "light" | "dark";

function getInitial(): Theme {
  if (typeof window === "undefined") return "dark";
  const stored = localStorage.getItem("mnemos-theme") as Theme | null;
  if (stored === "light" || stored === "dark") return stored;
  return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

function apply(theme: Theme) {
  const root = document.documentElement;
  root.classList.toggle("light", theme === "light");
  root.classList.toggle("dark", theme === "dark");
  localStorage.setItem("mnemos-theme", theme);
}

/**
 * Physics-based sun ⇄ moon toggle: morphing icon, particle burst, glow,
 * spring-driven knob. Accessible (role=switch, keyboard, labels).
 */
export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("dark");
  const [burst, setBurst] = useState(0);
  const isDark = theme === "dark";

  useEffect(() => {
    const t = getInitial();
    setTheme(t);
    apply(t);
  }, []);

  const toggle = () => {
    const next: Theme = isDark ? "light" : "dark";
    setTheme(next);
    apply(next);
    setBurst((b) => b + 1);
  };

  return (
    <button
      onClick={toggle}
      role="switch"
      aria-checked={isDark}
      aria-label={`Activate ${isDark ? "light" : "dark"} mode`}
      className="focus-ring clickable relative h-9 w-[64px] rounded-full"
      style={{
        background: isDark
          ? "linear-gradient(135deg, #1a1430, #0d0a18)"
          : "linear-gradient(135deg, #cfe6ff, #eef4ff)",
        border: "1px solid var(--border-strong)",
        transition: "background 0.5s ease",
      }}
    >
      {/* ambient stars (dark) */}
      <AnimatePresence>
        {isDark &&
          [
            [14, 10],
            [22, 20],
            [16, 22],
          ].map(([x, y], i) => (
            <motion.span
              key={i}
              initial={{ opacity: 0, scale: 0 }}
              animate={{ opacity: 0.9, scale: 1 }}
              exit={{ opacity: 0, scale: 0 }}
              transition={{ delay: 0.1 + i * 0.05 }}
              className="absolute rounded-full bg-white"
              style={{ left: x, top: y, width: 2, height: 2 }}
            />
          ))}
      </AnimatePresence>

      {/* glow halo */}
      <motion.span
        key={`glow-${burst}`}
        initial={{ opacity: 0.7, scale: 0.6 }}
        animate={{ opacity: 0, scale: 2.2 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="pointer-events-none absolute top-1/2 h-6 w-6 -translate-y-1/2 rounded-full"
        style={{
          left: isDark ? 30 : 4,
          background: isDark ? "rgba(155,91,255,0.6)" : "rgba(255,196,80,0.7)",
          filter: "blur(6px)",
        }}
      />

      {/* knob */}
      <motion.span
        layout
        transition={{ type: "spring", stiffness: 700, damping: 30 }}
        className="absolute top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full"
        style={{
          left: isDark ? 30 : 4,
          background: isDark
            ? "radial-gradient(circle at 35% 30%, #f4f0ff, #c9b8ff)"
            : "radial-gradient(circle at 35% 30%, #fff3cf, #ffcf5e)",
          boxShadow: isDark
            ? "0 0 12px rgba(155,91,255,0.8)"
            : "0 0 12px rgba(255,196,80,0.9)",
        }}
      >
        <AnimatePresence mode="wait" initial={false}>
          {isDark ? (
            <motion.svg
              key="moon"
              initial={{ rotate: -90, opacity: 0, scale: 0.3 }}
              animate={{ rotate: 0, opacity: 1, scale: 1 }}
              exit={{ rotate: 90, opacity: 0, scale: 0.3 }}
              transition={{ type: "spring", stiffness: 400, damping: 22 }}
              width="13"
              height="13"
              viewBox="0 0 24 24"
            >
              <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" fill="#4a3b7a" />
            </motion.svg>
          ) : (
            <motion.svg
              key="sun"
              initial={{ rotate: 90, opacity: 0, scale: 0.3 }}
              animate={{ rotate: 0, opacity: 1, scale: 1 }}
              exit={{ rotate: -90, opacity: 0, scale: 0.3 }}
              transition={{ type: "spring", stiffness: 400, damping: 22 }}
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#c47a00"
              strokeWidth="2.2"
              strokeLinecap="round"
            >
              <circle cx="12" cy="12" r="4" fill="#e8920a" stroke="none" />
              {Array.from({ length: 8 }).map((_, i) => {
                const a = (i * Math.PI) / 4;
                return (
                  <line
                    key={i}
                    x1={12 + Math.cos(a) * 7}
                    y1={12 + Math.sin(a) * 7}
                    x2={12 + Math.cos(a) * 9.5}
                    y2={12 + Math.sin(a) * 9.5}
                  />
                );
              })}
            </motion.svg>
          )}
        </AnimatePresence>
      </motion.span>

      {/* particle burst on switch */}
      <AnimatePresence>
        {Array.from({ length: 6 }).map((_, i) => {
          const a = (i * Math.PI * 2) / 6;
          return (
            <motion.span
              key={`${burst}-${i}`}
              initial={{ opacity: 0.9, x: 0, y: 0, scale: 1 }}
              animate={{ opacity: 0, x: Math.cos(a) * 16, y: Math.sin(a) * 16, scale: 0 }}
              transition={{ duration: 0.5, ease: "easeOut" }}
              className="pointer-events-none absolute top-1/2 h-1 w-1 -translate-y-1/2 rounded-full"
              style={{ left: isDark ? 33 : 7, background: isDark ? "#9b5bff" : "#ffc450" }}
            />
          );
        })}
      </AnimatePresence>
    </button>
  );
}
