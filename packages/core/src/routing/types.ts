import type { CopilotIntent } from '../search/index.js';
import type { SearchHit } from '../search/index.js';

export interface QueryBudget {
  maxTokens: number;
  maxLines: number;
  maxBullets: number;
}

export interface RoutePlan {
  id: string;
  intent: CopilotIntent;
  budget: QueryBudget;
  preferGraph: boolean;
  preferFocusPack: boolean;
}

export interface RouteQueryOptions {
  tokenBudget?: number;
  compact?: boolean;
  graph?: import('../graph/graph.js').MnemosGraph;
  searchIndex?: import('../search/index.js').MemorySearchIndex;
}

export interface RoutedQueryResult {
  question: string;
  answer: string;
  summary: string;
  confidence: number;
  intent: CopilotIntent;
  sources: string[];
  relatedTopics: string[];
  hits?: SearchHit[];
  route: string;
  tokensBefore: number;
  tokensAfter: number;
  tookMs: number;
}
