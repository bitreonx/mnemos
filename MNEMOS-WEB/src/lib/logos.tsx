/**
 * Brand mark (the real MNESTIS knot) + real AI-tool brand icons (LobeHub).
 * Tool icons are official trademarks shown purely to reference the
 * AI-developer ecosystem — not endorsements.
 */
import type { CSSProperties, SVGProps } from "react";
import knotUrl from "../assets/mnemos-knot.png";

import claudeSvg from "../assets/logos/claude-color.svg?raw";
import cursorSvg from "../assets/logos/cursor.svg?raw";
import codexSvg from "../assets/logos/codex.svg?raw";
import geminiSvg from "../assets/logos/gemini-color.svg?raw";
import openhandsSvg from "../assets/logos/openhands.svg?raw";
import kiroSvg from "../assets/logos/kiro-color.svg?raw";

export const KNOT_URL = knotUrl;

/**
 * The MNESTIS knot rendered from the real logo asset, tinted by `currentColor`
 * (so it themes automatically) or any color/gradient passed via `color`.
 */
export function MNESTISMark({
  size = 28,
  color = "currentColor",
  className,
  style,
}: {
  size?: number;
  color?: string;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <span
      aria-hidden
      className={className}
      style={{
        display: "inline-block",
        width: size,
        height: size,
        background: color,
        WebkitMaskImage: `url(${knotUrl})`,
        maskImage: `url(${knotUrl})`,
        WebkitMaskSize: "contain",
        maskSize: "contain",
        WebkitMaskRepeat: "no-repeat",
        maskRepeat: "no-repeat",
        WebkitMaskPosition: "center",
        maskPosition: "center",
        ...style,
      }}
    />
  );
}

export function MNESTISWordmark({ className }: { className?: string }) {
  return (
    <span className={className} style={{ display: "inline-flex", alignItems: "center", gap: 9 }}>
      <MNESTISMark size={26} color="var(--brand)" />
      <span style={{ fontWeight: 700, fontSize: "1.18rem", letterSpacing: "-0.03em", color: "var(--text)" }}>
        MNESTIS
      </span>
    </span>
  );
}

export type BrandKey = "Claude" | "Cursor" | "Codex" | "Gemini" | "OpenHands" | "Kiro";

const BRAND_SVG: Record<BrandKey, string> = {
  Claude: claudeSvg,
  Cursor: cursorSvg,
  Codex: codexSvg,
  Gemini: geminiSvg,
  OpenHands: openhandsSvg,
  Kiro: kiroSvg,
};

export const BRAND_KEYS: BrandKey[] = ["Claude", "Cursor", "Codex", "Gemini", "OpenHands", "Kiro"];

/**
 * Renders a real brand icon inline. Mono icons use `currentColor`; color icons
 * keep their brand palette. Size is driven by font-size (icons are 1em).
 */
export function BrandIcon({
  name,
  size = 24,
  className,
  style,
}: {
  name: BrandKey;
  size?: number;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <span
      aria-label={name}
      role="img"
      className={className}
      style={{ display: "inline-flex", fontSize: size, lineHeight: 0, ...style }}
      dangerouslySetInnerHTML={{ __html: BRAND_SVG[name] }}
    />
  );
}

export function GitHubIcon(p: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden {...p}>
      <path d="M12 .5C5.7.5.5 5.7.5 12c0 5.1 3.3 9.4 7.9 10.9.6.1.8-.2.8-.5v-2c-3.2.7-3.9-1.4-3.9-1.4-.5-1.3-1.3-1.7-1.3-1.7-1.1-.7.1-.7.1-.7 1.2.1 1.8 1.2 1.8 1.2 1 1.8 2.8 1.3 3.5 1 .1-.8.4-1.3.7-1.6-2.6-.3-5.3-1.3-5.3-5.7 0-1.3.5-2.3 1.2-3.1-.1-.3-.5-1.5.1-3.1 0 0 1-.3 3.3 1.2a11.5 11.5 0 0 1 6 0C17.3 4.7 18.3 5 18.3 5c.6 1.6.2 2.8.1 3.1.8.8 1.2 1.8 1.2 3.1 0 4.4-2.7 5.4-5.3 5.7.4.4.8 1.1.8 2.2v3.3c0 .3.2.6.8.5 4.6-1.5 7.9-5.8 7.9-10.9C23.5 5.7 18.3.5 12 .5Z" />
    </svg>
  );
}
