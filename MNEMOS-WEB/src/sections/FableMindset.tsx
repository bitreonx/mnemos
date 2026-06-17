import { useRef, useState } from "react";
import { useInView } from "framer-motion";
import { Lock, LockOpen, ShieldCheck, Zap } from "lucide-react";
import { FABLE } from "../lib/site";
import SectionHeading from "../components/ui/SectionHeading";
import Reveal from "../components/ui/Reveal";
import GlowCard from "../components/ui/GlowCard";
import DecryptText from "../components/ui/DecryptText";
import AnimatedCounter from "../components/ui/AnimatedCounter";

/** The "secret docs" terminal — scrambled until it scrolls into view, then decrypts. */
function ClassifiedTerminal() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-120px" });
  const [revealed, setRevealed] = useState(0);

  return (
    <div ref={ref}>
      <GlowCard accent="var(--brand)" className="font-mono">
        <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-full bg-[#ff5f57]" />
            <span className="h-3 w-3 rounded-full bg-[#febc2e]" />
            <span className="h-3 w-3 rounded-full bg-[#28c840]" />
            <span className="ml-2 text-xs text-[var(--text-faint)]">fable-mindset.md</span>
          </div>
          <span
            className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[0.65rem] font-semibold uppercase tracking-wider transition-colors"
            style={
              inView
                ? { background: "color-mix(in srgb, var(--mint) 16%, transparent)", color: "var(--mint)" }
                : { background: "color-mix(in srgb, var(--brand) 16%, transparent)", color: "var(--brand)" }
            }
          >
            {inView ? <LockOpen size={11} strokeWidth={2.5} /> : <Lock size={11} strokeWidth={2.5} />}
            {inView ? "Decrypted" : "Classified"}
          </span>
        </div>

        <ul className="mt-4 space-y-3 text-sm">
          {FABLE.decisionLoop.map((row, i) => (
            <li key={row.step} className="flex gap-3">
              <span
                className="mt-0.5 w-[5.5rem] shrink-0 font-semibold tracking-wide"
                style={{ color: "var(--brand)" }}
              >
                {/* gate each line behind the previous one finishing for a cascading decrypt */}
                {i <= revealed ? (
                  <DecryptText text={row.step} active={inView} speed={26} onDone={() => setRevealed((r) => Math.max(r, i + 1))} />
                ) : (
                  <span className="opacity-40">{"•••••"}</span>
                )}
              </span>
              <span className="text-[var(--text-dim)]">
                {i < revealed ? row.desc : <span className="opacity-40">{"—"}</span>}
              </span>
            </li>
          ))}
        </ul>

        <p className="mt-5 border-t border-[var(--border)] pt-3 text-xs text-[var(--text-faint)]">
          The mindset isn&apos;t a secret — it&apos;s the <span className="text-[var(--text-dim)]">secret sauce</span>,
          distilled from {FABLE.datasetLabel} and shipped as a skill you install.
        </p>
      </GlowCard>
    </div>
  );
}

/** Animated source-vs-baseline bars for each measured habit. */
function HabitBars() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });

  return (
    <div ref={ref} className="space-y-5">
      {FABLE.habits.map((h, i) => (
        <div key={h.habit}>
          <div className="flex items-baseline justify-between text-sm">
            <span className="font-medium text-[var(--text)]">{h.habit}</span>
            <span className="font-mono text-xs text-[var(--text-faint)]">
              Fable <span className="text-[var(--brand)]">{h.source}%</span>
              <span className="mx-1.5 opacity-40">vs</span>
              baseline <span className="text-[var(--text-dim)]">{h.baseline}%</span>
            </span>
          </div>
          <div className="mt-2 space-y-1.5">
            <div className="h-2 overflow-hidden rounded-full bg-[var(--surface-2)]">
              <div
                className="h-full rounded-full transition-[width] duration-1000 ease-out"
                style={{ width: inView ? `${h.source}%` : "0%", background: "var(--grad-brand)", transitionDelay: `${i * 80}ms` }}
              />
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-[var(--surface-2)]">
              <div
                className="h-full rounded-full bg-[var(--text-faint)] transition-[width] duration-1000 ease-out"
                style={{ width: inView ? `${h.baseline}%` : "0%", transitionDelay: `${i * 80 + 120}ms` }}
              />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function FableMindset() {
  return (
    <section id="newgen" className="container-px mx-auto max-w-[1100px] scroll-mt-24 py-24 sm:py-32">
      <SectionHeading
        eyebrow="New Gen"
        title={
          <>
            Make any agent work like{" "}
            <span style={{ background: "var(--grad-brand)", WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" }}>
              Fable&nbsp;5
            </span>
          </>
        }
        subtitle="Mnemos ports the working discipline distilled from thousands of real Fable 5 traces into a skill your agent adopts on every turn — reason before acting, verify before claiming done, recover with method."
      />

      <div className="mt-14 grid items-start gap-6 lg:grid-cols-2">
        <Reveal>
          <ClassifiedTerminal />
        </Reveal>

        <Reveal delay={0.1}>
          <GlowCard accent="var(--mint)">
            <div className="flex items-center gap-2 text-sm font-semibold text-[var(--text)]">
              <ShieldCheck size={16} style={{ color: "var(--mint)" }} />
              Measured, not claimed
            </div>
            <p className="mt-2 text-sm text-[var(--text-dim)]">
              The gap between disciplined Fable habits and a strong baseline, measured the same way on both.
              Run it on your own logs: <code className="rounded bg-[var(--surface-2)] px-1.5 py-0.5 text-xs">mnemos discipline --opus</code>
            </p>
            <div className="mt-6">
              <HabitBars />
            </div>
          </GlowCard>
        </Reveal>
      </div>

      {/* Token savings */}
      <Reveal delay={0.05}>
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          {FABLE.savings.map((s) => (
            <GlowCard key={s.label} accent="var(--brand)" className="text-center">
              <div className="flex items-center justify-center gap-1.5 text-[2.4rem] font-bold leading-none tracking-tight text-[var(--text)]">
                <Zap size={20} className="opacity-60" style={{ color: "var(--brand)" }} />
                {"display" in s && s.display ? (
                  <span>{s.display}</span>
                ) : (
                  <AnimatedCounter value={s.value} suffix={s.suffix} />
                )}
              </div>
              <div className="mt-2 text-sm font-medium text-[var(--text)]">{s.label}</div>
              <div className="mt-1 text-xs leading-relaxed text-[var(--text-faint)]">{s.hint}</div>
            </GlowCard>
          ))}
        </div>
      </Reveal>

      {/* Install + honesty */}
      <Reveal delay={0.1}>
        <div className="mt-6 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 sm:flex sm:items-center sm:justify-between sm:gap-8">
          <div className="min-w-0">
            <div className="font-mono text-sm text-[var(--text)]">
              <span className="text-[var(--text-faint)]">$ </span>
              {FABLE.install}
            </div>
            <p className="mt-2 text-xs text-[var(--text-faint)]">{FABLE.skillNote}</p>
          </div>
          <a
            href={FABLE.dataset}
            target="_blank"
            rel="noreferrer"
            className="mt-4 inline-flex shrink-0 items-center gap-1.5 rounded-full border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--text-dim)] transition-colors hover:text-[var(--text)] sm:mt-0"
          >
            View the dataset →
          </a>
        </div>
      </Reveal>

      <p className="mx-auto mt-5 max-w-2xl text-center text-xs leading-relaxed text-[var(--text-faint)]">
        {FABLE.honesty}
      </p>
    </section>
  );
}
