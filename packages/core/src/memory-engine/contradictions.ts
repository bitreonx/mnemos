import type { MemoryContradiction, MemoryFact } from './types.js';

function contradictionSeverity(count: number, confidences: number[]): MemoryContradiction['severity'] {
  const maxConf = Math.max(...confidences);
  if (count >= 3 || maxConf > 0.9) return 'high';
  if (count >= 2) return 'medium';
  return 'low';
}

/** Detect facts with same key but different object values. */
export function detectContradictions(
  currentFacts: MemoryFact[],
  previousFacts: MemoryFact[] = [],
  detectedAt = new Date().toISOString(),
): MemoryContradiction[] {
  const byKey = new Map<string, MemoryFact[]>();

  for (const f of [...previousFacts, ...currentFacts]) {
    const list = byKey.get(f.key) ?? [];
    list.push(f);
    byKey.set(f.key, list);
  }

  const contradictions: MemoryContradiction[] = [];

  for (const [key, facts] of byKey) {
    const uniqueObjects = new Map<string, MemoryFact>();
    for (const f of facts) {
      const norm = f.object.trim().toLowerCase();
      if (!uniqueObjects.has(norm)) uniqueObjects.set(norm, f);
    }
    if (uniqueObjects.size < 2) continue;

    const [subject, predicate] = key.split(':').slice(0, 2);
    const values = [...uniqueObjects.values()].map((f) => ({
      object: f.object,
      documentId: f.documentId,
      builtAt: f.builtAt,
      confidence: f.confidence,
    }));

    contradictions.push({
      id: `contradiction:${key}`,
      key,
      subject: subject ?? key,
      predicate: predicate ?? 'unknown',
      values,
      detectedAt,
      severity: contradictionSeverity(values.length, values.map((v) => v.confidence)),
      resolved: false,
    });
  }

  return contradictions.sort((a, b) => {
    const order = { high: 0, medium: 1, low: 2 };
    return order[a.severity] - order[b.severity];
  });
}

export function formatContradictionWarning(c: MemoryContradiction): string {
  const vals = c.values.map((v) => `"${v.object.slice(0, 80)}"`).join(' vs ');
  return `- **${c.subject}** / ${c.predicate}: ${vals} (${c.severity})`;
}
