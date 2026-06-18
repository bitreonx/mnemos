import type { MemoryModel } from '../types.js';
import { askCopilot } from '../copilot.js';
import { queryGraph } from '../graph-query.js';
import { classifyIntent } from '../search/index.js';
import { compileSubgraphContext } from '../context/subgraph-compiler.js';
import type { RoutePlan, RouteQueryOptions, RoutedQueryResult } from './types.js';
import { extractSummary, optimizeContextWindow } from './optimize-context.js';
import { minimizeOverhead } from './minimize-overhead.js';
import { estimateTokens } from '../proxy/compress-output.js';

const ROUTE_TABLE: Record<string, Omit<RoutePlan, 'id' | 'intent'>> = {
  overview: { budget: { maxTokens: 420, maxLines: 24, maxBullets: 6 }, preferGraph: false, preferFocusPack: false },
  start: { budget: { maxTokens: 520, maxLines: 28, maxBullets: 8 }, preferGraph: false, preferFocusPack: false },
  flow: { budget: { maxTokens: 640, maxLines: 32, maxBullets: 10 }, preferGraph: true, preferFocusPack: false },
  health: { budget: { maxTokens: 480, maxLines: 26, maxBullets: 8 }, preferGraph: false, preferFocusPack: false },
  impact: { budget: { maxTokens: 720, maxLines: 36, maxBullets: 12 }, preferGraph: true, preferFocusPack: false },
  dependency: { budget: { maxTokens: 560, maxLines: 30, maxBullets: 10 }, preferGraph: true, preferFocusPack: false },
  auth: { budget: { maxTokens: 500, maxLines: 28, maxBullets: 8 }, preferGraph: false, preferFocusPack: false },
  payment: { budget: { maxTokens: 500, maxLines: 28, maxBullets: 8 }, preferGraph: false, preferFocusPack: false },
  critical: { budget: { maxTokens: 540, maxLines: 28, maxBullets: 8 }, preferGraph: true, preferFocusPack: false },
  smell: { budget: { maxTokens: 520, maxLines: 28, maxBullets: 10 }, preferGraph: false, preferFocusPack: false },
  list: { budget: { maxTokens: 600, maxLines: 34, maxBullets: 14 }, preferGraph: false, preferFocusPack: false },
  search: { budget: { maxTokens: 480, maxLines: 26, maxBullets: 8 }, preferGraph: false, preferFocusPack: true },
};

function buildRoutePlan(question: string, options: RouteQueryOptions): RoutePlan {
  const classification = classifyIntent(question);
  const defaults = ROUTE_TABLE[classification.intent] ?? ROUTE_TABLE.search!;
  const maxTokens = options.tokenBudget ?? defaults.budget.maxTokens;

  return {
    id: `${classification.intent}-${options.compact ? 'compact' : 'standard'}`,
    intent: classification.intent,
    budget: {
      ...defaults.budget,
      maxTokens,
    },
    preferGraph: defaults.preferGraph,
    preferFocusPack: defaults.preferFocusPack,
  };
}

function executeBaseAnswer(
  memory: MemoryModel,
  question: string,
  plan: RoutePlan,
  options: RouteQueryOptions,
): { answer: string; confidence: number; sources: string[]; relatedTopics: string[]; hits?: ReturnType<typeof askCopilot>['hits'] } {
  if (plan.preferGraph && options.graph) {
    const graphResult = queryGraph(memory, question, options.graph, options.searchIndex);
    return {
      answer: graphResult.answer,
      confidence: graphResult.confidence,
      sources: graphResult.hits?.slice(0, 3).map((h) => h.path ?? h.title) ?? [],
      relatedTopics: graphResult.relatedNodes ?? graphResult.hits?.slice(0, 5).map((h) => h.title) ?? [],
      hits: graphResult.hits,
    };
  }

  if (plan.preferFocusPack && plan.intent === 'search') {
    const focus = compileSubgraphContext(memory, question, options.graph, {
      tokenBudget: plan.budget.maxTokens,
      searchIndex: options.searchIndex,
    });
    if (focus.estimatedTokens <= plan.budget.maxTokens * 1.1) {
      return {
        answer: focus.markdown,
        confidence: 0.78,
        sources: focus.nodes.slice(0, 4).map((n) => n.path ?? n.name),
        relatedTopics: focus.domains.slice(0, 4),
        hits: undefined,
      };
    }
  }

  const copilot = askCopilot(memory, question, {
    graph: options.graph,
    searchIndex: options.searchIndex,
  });

  return {
    answer: copilot.answer,
    confidence: copilot.confidence,
    sources: copilot.sources,
    relatedTopics: copilot.relatedTopics,
    hits: copilot.hits,
  };
}

/**
 * Route a natural-language question through intent-aware handlers and token budgets.
 */
export function routeQuery(
  memory: MemoryModel,
  question: string,
  options: RouteQueryOptions = {},
): RoutedQueryResult {
  const started = Date.now();
  const plan = buildRoutePlan(question, options);
  const base = executeBaseAnswer(memory, question, plan, options);

  let answer = base.answer;
  let tokensBefore = estimateTokens(answer);

  if (options.compact) {
    const overhead = minimizeOverhead(answer, { maxLines: plan.budget.maxLines });
    answer = overhead.text;
    tokensBefore = overhead.stats.tokensBefore;
  }

  const optimized = optimizeContextWindow(answer, plan.budget.maxTokens, plan.budget.maxBullets);

  return {
    question,
    answer: optimized.text,
    summary: extractSummary(optimized.text),
    confidence: base.confidence,
    intent: plan.intent,
    sources: base.sources,
    relatedTopics: base.relatedTopics,
    hits: base.hits,
    route: plan.id,
    tokensBefore: optimized.tokensBefore,
    tokensAfter: optimized.tokensAfter,
    tookMs: Date.now() - started,
  };
}

export { buildRoutePlan };
