import { Star } from "lucide-react";
import { SITE } from "../../lib/site";
import { cn } from "../../lib/utils";

/**
 * Solid-purple "Star us on GitHub" pill. Clicking opens the repo so the user
 * can star it instantly. Pure brand color, no rainbow — looks intentional and
 * on-system in both themes.
 */
export default function StarButton({
  className,
  label = "Star us on GitHub",
}: {
  className?: string;
  label?: string;
}) {
  return (
    <a
      href={SITE.github}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Star Mnemos on GitHub"
      className={cn(
        "focus-ring group relative inline-flex items-center gap-1.5 overflow-hidden rounded-full px-3.5 py-2 text-[13px] font-semibold text-white transition-transform hover:scale-[1.04] active:scale-95",
        className
      )}
      style={{
        background: "var(--brand)",
        boxShadow: "0 6px 20px -6px var(--glow), inset 0 1px 0 rgba(255,255,255,0.18)",
      }}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{
          background:
            "radial-gradient(80px circle at var(--mx, 50%) var(--my, 50%), rgba(255,255,255,0.35), transparent 60%)",
        }}
      />
      <Star
        size={13}
        fill="currentColor"
        className="relative z-10 transition-transform duration-300 group-hover:rotate-[12deg]"
      />
      <span className="relative z-10">{label}</span>
    </a>
  );
}
