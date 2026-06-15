import { useState, useRef, useEffect, useMemo } from 'react';
import {
  buildSearchIndex,
  searchMemory,
  classifyIntent,
  type SearchHit,
} from '@mnemos/core/search';
import { askCopilot } from '@mnemos/core/copilot';

type CoreMemoryModel = Parameters<typeof buildSearchIndex>[0];
import type {
  MemoryModel,
  Capability,
  DiscoveredJourney,
  Domain,
  Flow,
  Service,
} from '../types';

interface AICompanionProps {
  memory: MemoryModel;
}

type CardType = 'capability' | 'journey' | 'flow' | 'domain' | 'service' | 'critical' | 'smell' | 'impact' | 'list';
type Tone = 'low' | 'medium' | 'high' | 'info';

interface ChatMessage {
  id: string;
  role: 'user' | 'companion';
  text: string;
  cards?: ResultCard[];
  intent?: string;
  timestamp: number;
}

interface ResultCard {
  type: CardType;
  title: string;
  subtitle?: string;
  description?: string;
  meta?: string[];
  badge?: { label: string; tone: Tone };
}

interface AnswerResult {
  answer: string;
  cards: ResultCard[];
  intent: string;
  hits?: SearchHit[];
}

function hitsToCards(hits: SearchHit[]): ResultCard[] {
  return hits.slice(0, 6).map((h) => ({
    type: (h.kind === 'critical_path' ? 'critical' : h.kind === 'capability' ? 'capability' : h.kind === 'journey' ? 'journey' : h.kind === 'smell' ? 'smell' : h.kind === 'flow' ? 'flow' : h.kind === 'domain' ? 'domain' : h.kind === 'service' ? 'service' : 'list') as CardType,
    title: h.title,
    subtitle: h.kind.replace(/_/g, ' '),
    description: h.snippet,
    meta: h.path ? [h.path, ...h.tags.slice(0, 2)] : h.tags.slice(0, 3),
    badge: { label: `${h.score.toFixed(1)}`, tone: h.score > 5 ? 'low' : 'medium' as Tone },
  }));
}

const SUGGESTIONS = [
  'Explain this codebase — where do I start?',
  'What breaks if I change the most central service?',
  'How does authentication work?',
  'What are the user journeys?',
  'Show critical paths and blast radius',
  'List all business capabilities',
  'What smells should I fix before shipping?',
  'I want to vibe-code a feature — which domain?',
];

export function AICompanion({ memory }: AICompanionProps) {
  const coreMemory = memory as unknown as CoreMemoryModel;
  const searchIndex = useMemo(() => buildSearchIndex(coreMemory), [coreMemory]);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'greeting',
      role: 'companion',
      text: `Hi — I'm Mnemos. I have a full mental model of ${memory.repository} loaded locally. Ask me how anything works, what would break, or where to look.`,
      cards: buildOverviewCards(memory),
      intent: 'greeting',
      timestamp: Date.now(),
    },
  ]);
  const [input, setInput] = useState('');
  const [thinking, setThinking] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, thinking]);

  function handleSubmit(text: string) {
    const trimmed = text.trim();
    if (!trimmed) return;
    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      text: trimmed,
      timestamp: Date.now(),
    };
    setMessages((m) => [...m, userMsg]);
    setInput('');
    setThinking(true);

    setTimeout(() => {
      const result = answer(trimmed, memory, coreMemory, searchIndex);
      setMessages((m) => [
        ...m,
        {
          id: `c-${Date.now()}`,
          role: 'companion',
          text: result.answer,
          cards: result.cards,
          intent: result.intent,
          timestamp: Date.now(),
        },
      ]);
      setThinking(false);
    }, 200 + Math.random() * 200);
  }

  return (
    <div className="companion-shell">
      <div className="companion-header">
        <div className="companion-avatar">M</div>
        <div>
          <div className="companion-title">Mnemos Companion</div>
          <div className="companion-sub">
            Local Q&amp;A · {memory.stats.filesScanned} files · {memory.capabilities?.length ?? 0}{' '}
            capabilities · {memory.journeys?.length ?? 0} journeys
          </div>
        </div>
        <div className="companion-badge">local</div>
      </div>

      <div className="companion-thread">
        {messages.map((m) => (
          <MessageBubble key={m.id} message={m} />
        ))}
        {thinking && <ThinkingBubble />}
        <div ref={endRef} />
      </div>

      <div className="companion-suggestions">
        {SUGGESTIONS.map((s) => (
          <button key={s} className="suggestion-chip" onClick={() => handleSubmit(s)}>
            {s}
          </button>
        ))}
      </div>

      <form
        className="companion-input"
        onSubmit={(e) => {
          e.preventDefault();
          handleSubmit(input);
        }}
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about the codebase…"
          autoFocus
        />
        <button type="submit" disabled={!input.trim()}>
          Ask
        </button>
      </form>
    </div>
  );
}

function MessageBubble({ message }: { message: ChatMessage }) {
  if (message.role === 'user') {
    return (
      <div className="bubble-row user">
        <div className="bubble user-bubble">{message.text}</div>
      </div>
    );
  }
  return (
    <div className="bubble-row companion">
      <div className="bubble-avatar">M</div>
      <div className="bubble-group">
        {message.intent && message.intent !== 'greeting' && (
          <div className="intent-tag">intent: {message.intent}</div>
        )}
        <div className="bubble companion-bubble">{message.text}</div>
        {message.cards && message.cards.length > 0 && (
          <div className="result-cards">
            {message.cards.map((c, i) => (
              <ResultCardView key={i} card={c} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ThinkingBubble() {
  return (
    <div className="bubble-row companion">
      <div className="bubble-avatar">M</div>
      <div className="bubble companion-bubble thinking">
        <span className="dot" />
        <span className="dot" />
        <span className="dot" />
      </div>
    </div>
  );
}

function ResultCardView({ card }: { card: ResultCard }) {
  return (
    <div className="result-card">
      <div className="result-card-head">
        <div className="result-card-type">{card.type}</div>
        {card.badge && <span className={`tag tag-${card.badge.tone}`}>{card.badge.label}</span>}
      </div>
      <div className="result-card-title">{card.title}</div>
      {card.subtitle && <div className="result-card-subtitle">{card.subtitle}</div>}
      {card.description && <div className="result-card-desc">{card.description}</div>}
      {card.meta && card.meta.length > 0 && (
        <div className="result-card-meta">
          {card.meta.map((m, i) => (
            <span key={i} className="result-meta-chip">
              {m}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function buildOverviewCards(memory: MemoryModel): ResultCard[] {
  const cards: ResultCard[] = [];
  if (memory.capabilities && memory.capabilities.length > 0) {
    cards.push({
      type: 'list',
      title: `${memory.capabilities.length} capabilities detected`,
      subtitle: memory.capabilities
        .slice(0, 4)
        .map((c) => c.signature.name)
        .join(' · '),
      meta: memory.capabilities.slice(0, 4).map((c) => c.signature.category),
    });
  }
  if (memory.journeys && memory.journeys.length > 0) {
    cards.push({
      type: 'list',
      title: `${memory.journeys.length} user journeys mapped`,
      subtitle: memory.journeys
        .slice(0, 4)
        .map((j) => j.signature.name)
        .join(' · '),
    });
  }
  return cards;
}

// --- Intent detection & answering ---

function answer(
  query: string,
  memory: MemoryModel,
  coreMemory: CoreMemoryModel,
  searchIndex: ReturnType<typeof buildSearchIndex>,
): AnswerResult {
  const copilot = askCopilot(coreMemory, query);
  const classification = classifyIntent(query);
  const searchResult = searchMemory(searchIndex, query, { limit: 6 });
  const cards = copilot.hits?.length ? hitsToCards(copilot.hits) : hitsToCards(searchResult.hits);

  const q = query.toLowerCase();
  const capabilities = memory.capabilities ?? [];
  const journeys = memory.journeys ?? [];

  if (copilot.intent && copilot.confidence > 0.7) {
    return {
      answer: copilot.answer.replace(/\*\*/g, ''),
      cards: cards.length > 0 ? cards : buildIntentCards(query, memory, classification.intent),
      intent: copilot.intent,
      hits: copilot.hits,
    };
  }

  if (/^(hi|hello|hey|yo|sup)\b/.test(q)) {
    return {
      answer: `Hey — what would you like to know about ${memory.repository}?`,
      cards: buildOverviewCards(memory),
      intent: 'greeting',
    };
  }

  if (/(memory\s*score|score|health)/.test(q)) return answerMemoryScore(memory);
  if (/(what breaks|impact|blast|radius|affect)/.test(q)) return answerImpact(q, memory);
  if (/^how\s+(does|do)\s+/.test(q) || /how\s+\w+\s+work/.test(q)) return answerHow(q, memory);
  if (/^why\s+(is|are)\s+/.test(q)) return answerWhy(q, memory);
  if (/^(show|display|get)\s+/.test(q)) return answerShow(q, memory);
  if (/^(list|show|what are)\s+(all\s+)?(capabilities|domains|services|flows|journeys|smells|apis)/.test(q))
    return answerList(q, memory);
  if (/^(find|where|locate|search)\s+/.test(q)) return answerFind(q, memory);
  if (/(most|highest|biggest).*(depend|complex|critical|central)/.test(q))
    return answerMostDependents(memory);
  if (/(smell|smells|problem|issues|risk)/.test(q)) return answerSmells(memory);
  if (/(critical|important|central|hub)/.test(q)) return answerCriticalPaths(memory);
  if (/(capabilit|feature|module|domain)/.test(q)) return answerListCapabilities(capabilities);
  if (/(journey|user flow|user path|customer flow)/.test(q)) return answerListJourneys(journeys);

  return answerFreeText(query, memory, searchResult.hits);
}

function buildIntentCards(query: string, memory: MemoryModel, intent: string): ResultCard[] {
  if (intent === 'smell') return answerSmells(memory).cards;
  if (intent === 'critical') return answerCriticalPaths(memory).cards;
  if (intent === 'list') return answerList(query, memory).cards;
  return [];
}

function answerMemoryScore(memory: MemoryModel): AnswerResult {
  const total = memory.services.length + memory.apis.length + memory.domains.length + memory.flows.length;
  const highSmells = memory.smells.filter((s) => s.severity === 'high').length;
  const medSmells = memory.smells.filter((s) => s.severity === 'medium').length;
  return {
    answer: `${memory.repository} has ${total} tracked entities (${memory.services.length} services, ${memory.apis.length} APIs, ${memory.domains.length} domains, ${memory.flows.length} flows). ${highSmells} high-severity smell${highSmells === 1 ? '' : 's'} and ${medSmells} medium-severity smell${medSmells === 1 ? '' : 's'} flagged.`,
    cards: [
      {
        type: 'list',
        title: 'Architecture summary',
        description: memory.architecture.summary,
        meta: memory.architecture.layers,
      },
    ],
    intent: 'memory-score',
  };
}

function answerImpact(q: string, memory: MemoryModel): AnswerResult {
  const target = extractTarget(q, ['change', 'modify', 'edit', 'update', 'break']);
  if (!target) {
    return {
      answer: "I need a target. Try: 'What breaks if I change AuthService?'",
      cards: [],
      intent: 'impact-clarify',
    };
  }
  const svc = findService(memory, target);
  if (svc) {
    return {
      answer: `Changing ${svc.name} could affect ${svc.dependents.length} dependent service${svc.dependents.length === 1 ? '' : 's'}. Inspect dependents before editing.`,
      cards: [
        {
          type: 'impact',
          title: svc.name,
          subtitle: svc.path,
          meta: svc.dependents.slice(0, 8),
        },
      ],
      intent: 'impact',
    };
  }
  return {
    answer: `I couldn't find a service matching "${target}". Try a service name like AuthService or PickupService.`,
    cards: [],
    intent: 'impact-miss',
  };
}

function answerShow(q: string, memory: MemoryModel): AnswerResult {
  const target = extractTarget(q, ['show', 'display', 'get']);
  if (!target) {
    return { answer: 'Show what?', cards: [], intent: 'show-clarify' };
  }
  const cap = findCapability(memory.capabilities ?? [], target);
  if (cap) {
    return {
      answer: `Here's ${cap.signature.name} — ${cap.signature.purpose}`,
      cards: [
        {
          type: 'capability' as const,
          title: cap.signature.name,
          subtitle: cap.signature.purpose,
          description: cap.reasons[0] ?? '',
          meta: [...cap.services, ...cap.apis].slice(0, 6),
          badge: { label: `${Math.round(cap.confidence * 100)}% confidence`, tone: cap.confidence > 0.6 ? 'low' : 'medium' },
        },
      ],
      intent: 'show-capability',
    };
  }
  const journey = findJourney(memory.journeys ?? [], target);
  if (journey) {
    return {
      answer: `Here's the ${journey.signature.name} journey.`,
      cards: [
        {
          type: 'journey' as const,
          title: journey.signature.name,
          subtitle: journey.signature.purpose,
          description: journey.reason,
          meta: [journey.entryRoute ?? journey.entryPoint, ...journey.actors, ...journey.outcomes],
        },
      ],
      intent: 'show-journey',
    };
  }
  const flow = memory.flows.find(
    (f) => f.name.toLowerCase().includes(target) || f.id.toLowerCase().includes(target),
  );
  if (flow) {
    return {
      answer: `Found flow "${flow.name}" with ${flow.steps.length} steps.`,
      cards: [
        {
          type: 'flow' as const,
          title: flow.name,
          subtitle: flow.description,
          meta: flow.steps.slice(0, 8).map((s) => s.name),
          badge: { label: flow.type, tone: 'info' as Tone },
        },
      ],
      intent: 'show-flow',
    };
  }
  return { answer: `Couldn't find anything matching "${target}".`, cards: [], intent: 'show-miss' };
}

function answerHow(q: string, memory: MemoryModel): AnswerResult {
  const target = extractTarget(q, ['how does', 'how do', 'how', 'work']);
  if (!target) return { answer: 'How does what work?', cards: [], intent: 'how-clarify' };
  return answerShow(`show ${target}`, memory);
}

function answerWhy(q: string, memory: MemoryModel): AnswerResult {
  const target = extractTarget(q, ['why is', 'why are', 'why']);
  if (!target) return { answer: 'Why is what critical?', cards: [], intent: 'why-clarify' };
  const cp = memory.criticalPaths.find((c) => c.name.toLowerCase().includes(target));
  if (cp) {
    return {
      answer: `${cp.name} is critical because: ${cp.description}`,
      cards: [
        {
          type: 'critical' as const,
          title: cp.name,
          description: cp.description,
          badge: { label: `${cp.risk} risk`, tone: (cp.risk === 'high' ? 'high' : cp.risk === 'medium' ? 'medium' : 'low') as Tone },
        },
      ],
      intent: 'why-critical',
    };
  }
  const svc = findService(memory, target);
  if (svc) {
    return {
      answer: `${svc.name} is depended on by ${svc.dependents.length} other service${svc.dependents.length === 1 ? '' : 's'}, giving it a wide blast radius.`,
      cards: [
        {
          type: 'service' as const,
          title: svc.name,
          subtitle: svc.path,
          meta: svc.dependents,
        },
      ],
      intent: 'why-service',
    };
  }
  return { answer: `Couldn't find anything matching "${target}".`, cards: [], intent: 'why-miss' };
}

function answerList(q: string, memory: MemoryModel): AnswerResult {
  if (/capabilit/.test(q)) return answerListCapabilities(memory.capabilities ?? []);
  if (/journey/.test(q)) return answerListJourneys(memory.journeys ?? []);
  if (/domain/.test(q)) {
    return {
      answer: `${memory.domains.length} domains discovered.`,
      cards: memory.domains.slice(0, 8).map((d: Domain): ResultCard => ({
        type: 'domain',
        title: d.name,
        subtitle: d.description,
        meta: [`${d.nodes.length} nodes`, `${d.entryPoints.length} entry points`],
        badge: { label: `${Math.round(d.confidence * 100)}% confidence`, tone: d.confidence > 0.7 ? 'low' : 'medium' },
      })),
      intent: 'list-domains',
    };
  }
  if (/service/.test(q)) {
    return {
      answer: `${memory.services.length} services discovered.`,
      cards: memory.services.slice(0, 8).map((s: Service): ResultCard => ({
        type: 'service',
        title: s.name,
        subtitle: s.path,
        meta: s.exports.slice(0, 4),
      })),
      intent: 'list-services',
    };
  }
  if (/api|endpoint|route/.test(q)) {
    return {
      answer: `${memory.apis.length} APIs/endpoints discovered.`,
      cards: memory.apis.slice(0, 8).map((a): ResultCard => ({
        type: 'list',
        title: `${a.method} ${a.path}`,
        subtitle: a.file,
      })),
      intent: 'list-apis',
    };
  }
  if (/flow/.test(q)) {
    return {
      answer: `${memory.flows.length} flows discovered.`,
      cards: memory.flows.slice(0, 8).map((f: Flow): ResultCard => ({
        type: 'flow',
        title: f.name,
        subtitle: f.description,
        meta: [f.type, `${f.steps.length} steps`],
        badge: { label: `${Math.round(f.confidence * 100)}%`, tone: f.confidence > 0.7 ? 'low' : 'medium' },
      })),
      intent: 'list-flows',
    };
  }
  if (/smell/.test(q)) return answerSmells(memory);
  return answerListCapabilities(memory.capabilities ?? []);
}

function answerListCapabilities(caps: Capability[]): AnswerResult {
  if (caps.length === 0) {
    return { answer: 'No capabilities detected yet. Build a richer graph to surface them.', cards: [], intent: 'list-caps-empty' };
  }
  return {
    answer: `${caps.length} capabilities detected. The top ones are below.`,
    cards: caps.slice(0, 8).map((c): ResultCard => ({
      type: 'capability',
      title: c.signature.name,
      subtitle: c.signature.purpose,
      meta: [c.signature.category, `${c.services.length} services`, `${c.apis.length} apis`],
      badge: { label: `${Math.round(c.confidence * 100)}% confidence`, tone: c.confidence > 0.6 ? 'low' : c.confidence > 0.3 ? 'medium' : 'high' },
    })),
    intent: 'list-capabilities',
  };
}

function answerListJourneys(journeys: DiscoveredJourney[]): AnswerResult {
  if (journeys.length === 0) {
    return { answer: 'No user journeys mapped yet. Add more entry points (routes, server actions) to surface them.', cards: [], intent: 'list-journeys-empty' };
  }
  return {
    answer: `${journeys.length} user journeys mapped.`,
    cards: journeys.slice(0, 8).map((j): ResultCard => ({
      type: 'journey',
      title: j.signature.name,
      subtitle: j.signature.purpose,
      description: j.reason,
      meta: [j.entryRoute ?? j.entryPoint, ...j.actors],
      badge: { label: `${Math.round(j.confidence * 100)}%`, tone: j.confidence > 0.7 ? 'low' : 'medium' },
    })),
    intent: 'list-journeys',
  };
}

function answerSmells(memory: MemoryModel): AnswerResult {
  if (memory.smells.length === 0) {
    return { answer: 'No architecture smells detected. The codebase looks clean.', cards: [], intent: 'smells-none' };
  }
  return {
    answer: `${memory.smells.length} architecture smell${memory.smells.length === 1 ? '' : 's'} detected.`,
    cards: memory.smells.slice(0, 8).map((s): ResultCard => ({
      type: 'smell',
      title: s.type.replace(/_/g, ' '),
      description: s.description,
      meta: [s.recommendation].filter(Boolean) as string[],
      badge: { label: s.severity, tone: s.severity === 'high' ? 'high' : s.severity === 'medium' ? 'medium' : 'low' },
    })),
    intent: 'list-smells',
  };
}

function answerCriticalPaths(memory: MemoryModel): AnswerResult {
  if (memory.criticalPaths.length === 0) {
    return { answer: 'No critical paths identified.', cards: [], intent: 'critical-none' };
  }
  return {
    answer: `${memory.criticalPaths.length} critical path${memory.criticalPaths.length === 1 ? '' : 's'} identified.`,
    cards: memory.criticalPaths.slice(0, 8).map((c): ResultCard => ({
      type: 'critical',
      title: c.name,
      description: c.description,
      badge: { label: `${c.risk} risk`, tone: c.risk === 'high' ? 'high' : c.risk === 'medium' ? 'medium' : 'low' },
    })),
    intent: 'list-critical',
  };
}

function answerMostDependents(memory: MemoryModel): AnswerResult {
  const sorted = [...memory.services].sort((a, b) => b.dependents.length - a.dependents.length);
  return {
    answer: `Top services by dependents:`,
    cards: sorted.slice(0, 8).map((s): ResultCard => ({
      type: 'service',
      title: s.name,
      subtitle: s.path,
      meta: [`${s.dependents.length} dependents`, `${s.dependencies.length} dependencies`],
      badge: { label: s.dependents.length > 5 ? 'critical' : 'ok', tone: s.dependents.length > 5 ? 'high' : 'low' },
    })),
    intent: 'most-dependents',
  };
}

function answerFind(q: string, memory: MemoryModel): AnswerResult {
  const target = extractTarget(q, ['find', 'where', 'locate', 'search']);
  if (!target) return { answer: 'Find what?', cards: [], intent: 'find-clarify' };
  return answerShow(`show ${target}`, memory);
}

function answerFreeText(query: string, memory: MemoryModel, hits: SearchHit[]): AnswerResult {
  const lower = query.toLowerCase();
  const matchedCaps = (memory.capabilities ?? []).filter((c) =>
    c.signature.name.toLowerCase().includes(lower) ||
    c.signature.purpose.toLowerCase().includes(lower) ||
    c.signature.category.includes(lower) ||
    c.services.some((s) => s.toLowerCase().includes(lower)),
  );
  const matchedJourneys = (memory.journeys ?? []).filter((j) =>
    j.signature.name.toLowerCase().includes(lower) ||
    j.signature.purpose.toLowerCase().includes(lower),
  );
  const matchedDomains = memory.domains.filter((d) =>
    d.name.toLowerCase().includes(lower) || d.description.toLowerCase().includes(lower),
  );

  if (hits.length > 0) {
    return {
      answer: `Found ${hits.length} ranked matches for "${query}". Top: ${hits[0]!.title} — ${hits[0]!.snippet}`,
      cards: hitsToCards(hits),
      intent: 'semantic-search',
      hits,
    };
  }

  if (matchedCaps.length === 0 && matchedJourneys.length === 0 && matchedDomains.length === 0) {
    return {
      answer: `No matches for "${query}". Try asking about a specific capability, journey, domain, or service.`,
      cards: [],
      intent: 'free-miss',
    };
  }
  const cards: ResultCard[] = [
    ...matchedCaps.slice(0, 4).map((c): ResultCard => ({
      type: 'capability',
      title: c.signature.name,
      subtitle: c.signature.purpose,
      meta: c.services.slice(0, 4),
    })),
    ...matchedJourneys.slice(0, 3).map((j): ResultCard => ({
      type: 'journey',
      title: j.signature.name,
      subtitle: j.signature.purpose,
      meta: [j.entryRoute ?? j.entryPoint],
    })),
    ...matchedDomains.slice(0, 3).map((d): ResultCard => ({
      type: 'domain',
      title: d.name,
      subtitle: d.description,
    })),
  ];
  return {
    answer: `Found ${matchedCaps.length} capabilities, ${matchedJourneys.length} journeys, and ${matchedDomains.length} domains matching "${query}".`,
    cards,
    intent: 'free-text',
  };
}

function extractTarget(q: string, leadVerbs: string[]): string | null {
  const lower = q.toLowerCase();
  for (const v of leadVerbs) {
    const idx = lower.indexOf(v);
    if (idx === -1) continue;
    let rest = q.slice(idx + v.length).trim();
    rest = rest.replace(/^(if\s+i\s+)?(change|modify|edit|update)\s+/i, '');
    rest = rest.replace(/^the\s+/i, '');
    rest = rest.replace(/[?.!]+$/, '').trim();
    if (rest.length > 1) return rest;
  }
  return null;
}

function findService(memory: MemoryModel, q: string): Service | undefined {
  const lower = q.toLowerCase();
  return memory.services.find(
    (s) => s.name.toLowerCase().includes(lower) || s.path.toLowerCase().includes(lower),
  );
}

function findCapability(caps: Capability[], q: string): Capability | undefined {
  const lower = q.toLowerCase();
  return caps.find(
    (c) =>
      c.signature.id.includes(lower) ||
      c.signature.name.toLowerCase().includes(lower) ||
      c.services.some((s) => s.toLowerCase().includes(lower)),
  );
}

function findJourney(journeys: DiscoveredJourney[], q: string): DiscoveredJourney | undefined {
  const lower = q.toLowerCase();
  return journeys.find(
    (j) =>
      j.signature.id.includes(lower) ||
      j.signature.name.toLowerCase().includes(lower) ||
      (j.entryRoute ?? '').toLowerCase().includes(lower),
  );
}
