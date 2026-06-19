import { useRef, useState } from "react";
import { motion, useInView } from "framer-motion";
import { Lock, LockOpen, ShieldCheck, Zap } from "lucide-react";
import { FABLE } from "../lib/site";
import SectionHeading from "../components/ui/SectionHeading";
import Reveal from "../components/ui/Reveal";
import GlowCard from "../components/ui/GlowCard";
import DecryptText from "../components/ui/DecryptText";
import AnimatedCounter from "../components/ui/AnimatedCounter";

/** The "secret docs" terminal — solid purple surface, scrambled until it
 *  scrolls into view, then decrypts. No outer outline, no extra glow. */
function ClassifiedTerminal() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-120px" });
  const [revealed, setRevealed] = useState(0);

  return (
    <div ref={ref} className="relative h-full">
      <div className="relative flex h-full flex-col overflow-hidden rounded-2xl bg-[#11091e] p-6 font-mono">
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-full bg-[#ff5f57]" />
            <span className="h-3 w-3 rounded-full bg-[#febc2e]" />
            <span className="h-3 w-3 rounded-full bg-[#28c840]" />
            <span className="ml-2 text-xs text-white/70">fable-mindset.md</span>
          </div>
          <span
            className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[0.65rem] font-semibold uppercase tracking-wider transition-colors"
            style={
              inView
                ? { background: "rgba(62, 207, 142, 0.18)", color: "#3ecf8e" }
                : { background: "rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.85)" }
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
                style={{ color: "#ffffff" }}
              >
                {i <= revealed ? (
                  <DecryptText text={row.step} active={inView} speed={26} onDone={() => setRevealed((r) => Math.max(r, i + 1))} />
                ) : (
                  <span className="opacity-40">{"•••••"}</span>
                )}
              </span>
              <span className="text-white/75">
                {i < revealed ? row.desc : <span className="opacity-30">{"—"}</span>}
              </span>
            </li>
          ))}
        </ul>

        <p className="mt-5 border-t border-white/10 pt-3 text-xs text-white/55">
          The mindset isn&apos;t a secret — it&apos;s the <span className="text-white/80">secret sauce</span>,
          distilled from {FABLE.datasetLabel} and shipped as a skill you install.
        </p>
      </div>
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
                style={{ width: inView ? `${h.source}%` : "0%", background: "var(--brand)", transitionDelay: `${i * 80}ms` }}
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

/** Fills the empty area below the bars: a big radial score + an animated
 *  orbiting loop that hints at the 7-step discipline cycle. */
function DisciplineSummary() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });

  // Mean of the four Fable habits = the headline "discipline" number.
  const fableAvg = Math.round(
    FABLE.habits.reduce((s, h) => s + h.source, 0) / FABLE.habits.length
  );
  const baseAvg = Math.round(
    FABLE.habits.reduce((s, h) => s + h.baseline, 0) / FABLE.habits.length
  );

  const C = 2 * Math.PI * 36; // circumference of r=36

  const steps = FABLE.decisionLoop.map((r) => r.step);

  return (
    <div ref={ref} className="mt-6 flex items-stretch gap-5 rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] p-5">
      {/* Radial score */}
      <div className="relative grid h-[148px] w-[148px] shrink-0 place-items-center">
        <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full -rotate-90">
          <circle cx="50" cy="50" r="36" fill="none" stroke="var(--surface-solid)" strokeWidth="9" />
          <motion.circle
            cx="50"
            cy="50"
            r="36"
            fill="none"
            stroke="var(--brand)"
            strokeWidth="9"
            strokeLinecap="round"
            strokeDasharray={C}
            initial={{ strokeDashoffset: C }}
            animate={{ strokeDashoffset: inView ? C - (C * fableAvg) / 100 : C }}
            transition={{ duration: 1.4, ease: [0.22, 0.8, 0.18, 1] }}
          />
        </svg>
        <div className="relative z-10 text-center">
          <div className="font-mono text-[2rem] font-semibold leading-none tracking-tight text-[var(--text)]">
            <AnimatedCounter value={fableAvg} suffix="%" duration={1400} />
          </div>
          <div className="mt-1 text-[10px] font-medium uppercase tracking-wider text-[var(--text-faint)]">
            discipline
          </div>
        </div>
      </div>

      {/* Step orbit + comparison line */}
      <div className="flex min-w-0 flex-1 flex-col justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--mint)]">
            calibrated score
          </p>
          <p className="mt-1 text-[13px] leading-relaxed text-[var(--text-dim)]">
            Mean across the four measured habits. Fable agents hold a steady lead
            on every dimension — not a single big win.
          </p>
        </div>

        {/* Mini step orbit */}
        <div className="relative mt-2 h-12 overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--bg-1)]">
          <motion.svg
            viewBox="0 0 360 48"
            className="absolute inset-0 h-full w-full"
            preserveAspectRatio="none"
          >
            <motion.path
              d="M 12 24 Q 60 4 120 24 T 240 24 T 348 24"
              fill="none"
              stroke="var(--brand)"
              strokeWidth="1.4"
              strokeLinecap="round"
              strokeDasharray="3 4"
              initial={{ pathLength: 0, opacity: 0 }}
              animate={inView ? { pathLength: 1, opacity: 0.85 } : {}}
              transition={{ duration: 1.6, ease: "easeInOut" }}
            />
            <motion.circle
              r="4"
              fill="var(--brand)"
              initial={{ offsetDistance: "0%" }}
              animate={inView ? { offsetDistance: "100%" } : {}}
              style={{ offsetPath: "path('M 12 24 Q 60 4 120 24 T 240 24 T 348 24')" }}
              transition={{ duration: 5, repeat: Infinity, ease: "linear", delay: 0.3 }}
            />
          </motion.svg>
          <div className="relative flex h-full items-center justify-between px-2.5 font-mono text-[9px] uppercase tracking-wider text-[var(--text-faint)]">
            {steps.map((s, i) => (
              <span key={s} className="truncate">
                {s.slice(0, 3)}
                {i < steps.length - 1 ? "" : ""}
              </span>
            ))}
          </div>
        </div>

        {/* Comparison row */}
        <div className="mt-2 flex items-center gap-3 font-mono text-[11px]">
          <span className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--brand)]" />
            Fable
            <span className="text-[var(--text)]">{fableAvg}%</span>
          </span>
          <span className="opacity-40">·</span>
          <span className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--text-faint)]" />
            baseline
            <span className="text-[var(--text-dim)]">{baseAvg}%</span>
          </span>
          <span className="ml-auto text-[var(--mint)]">+{fableAvg - baseAvg} pts</span>
        </div>
      </div>
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
            <span style={{ color: "var(--brand)" }}>
              Fable&nbsp;5
            </span>
          </>
        }
        subtitle="Mnemos ports the working discipline distilled from thousands of real Fable 5 traces into a skill your agent adopts on every turn — reason before acting, verify before claiming done, recover with method."
      />

      <div className="mt-14 grid items-stretch gap-6 lg:grid-cols-2">
        <Reveal className="h-full">
          <ClassifiedTerminal />
        </Reveal>

        <Reveal delay={0.1} className="h-full">
          <GlowCard accent="var(--mint)" className="flex h-full flex-col">
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
            <DisciplineSummary />
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
