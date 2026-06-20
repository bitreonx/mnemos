import { Check, Minus, X } from "lucide-react";
import { motion } from "framer-motion";
import { COMPARISON, type ComparisonCell } from "../lib/site";
import SectionHeading from "../components/ui/SectionHeading";
import Reveal from "../components/ui/Reveal";

function Cell({ value }: { value: ComparisonCell }) {
  if (value === true)
    return (
      <span className="mx-auto grid h-7 w-7 place-items-center rounded-full" style={{ background: "color-mix(in srgb, var(--mint) 16%, transparent)", color: "var(--mint)" }}>
        <Check size={15} strokeWidth={3} />
      </span>
    );
  if (value === "partial")
    return (
      <span className="mx-auto grid h-7 w-7 place-items-center rounded-full border border-[var(--border)] text-[var(--text-faint)]">
        <Minus size={15} />
      </span>
    );
  if (value === "llm")
    return (
      <span className="mx-auto text-center text-[0.65rem] font-medium uppercase tracking-wide text-[var(--text-faint)]">
        LLM
      </span>
    );
  return (
    <span className="mx-auto grid h-7 w-7 place-items-center rounded-full text-[var(--text-faint)] opacity-50">
      <X size={15} />
    </span>
  );
}

export default function Comparison() {
  const { rows, cols } = COMPARISON;
  return (
    <section id="compare" className="container-px mx-auto max-w-[1100px] scroll-mt-24 py-24 sm:py-32">
      <SectionHeading
        eyebrow="Comparison"
        title="Built to understand, not just to parse."
        subtitle="Other tools dump files or draw a dependency graph. Mnemos delivers architecture, flows, capabilities, agent memory, and an agent-ready contract — local-first."
      />

      <Reveal delay={0.1}>
        <div className="mt-12 overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] border-collapse text-left">
              <thead>
                <tr className="border-b border-[var(--border)]">
                  <th className="px-6 py-5 text-sm font-medium text-[var(--text-dim)]">Capability</th>
                  {cols.map((col) => (
                    <th key={col.key} className="px-4 py-5 text-center">
                      {col.highlight ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold text-white" style={{ background: "var(--brand)" }}>
                          {col.label}
                        </span>
                      ) : (
                        <span className="text-sm font-medium text-[var(--text-dim)]">{col.label}</span>
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, ri) => (
                  <motion.tr
                    key={row.feature}
                    initial={{ opacity: 0 }}
                    whileInView={{ opacity: 1 }}
                    viewport={{ once: true }}
                    transition={{ delay: ri * 0.04 }}
                    className="border-b border-[var(--border)] transition-colors last:border-0 hover:bg-[var(--surface-2)]"
                  >
                    <td className="px-6 py-4 text-[0.95rem] font-medium text-[var(--text)]">{row.feature}</td>
                    {cols.map((col) => (
                      <td
                        key={col.key}
                        className="px-4 py-4"
                        style={col.highlight ? { background: "color-mix(in srgb, var(--brand) 6%, transparent)" } : undefined}
                      >
                        <Cell value={row[col.key]} />
                      </td>
                    ))}
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </Reveal>

      <p className="mt-4 text-center text-xs text-[var(--text-faint)]">
        Comparison reflects positioning and feature scope, not a controlled benchmark of every tool. LLM = requires token spend.
      </p>
    </section>
  );
}
