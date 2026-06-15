import type { MemoryModel } from './types.js';

import { explainRepository } from './explain.js';

import { computeDomainHeatmap } from './analysis/heatmap.js';

import { analyzeImpact, formatImpactReport } from './analysis/impact.js';

import type { MnemosGraph } from './graph/graph.js';

import {

  buildSearchIndex,

  searchMemory,

  classifyIntent,

  findBestMatch,

  type SearchHit,

  type CopilotIntent,

} from './search/index.js';



export interface CopilotOptions {

  graph?: MnemosGraph;

}



export interface CopilotAnswer {

  question: string;

  answer: string;

  confidence: number;

  sources: string[];

  relatedTopics: string[];

  intent?: CopilotIntent;

  hits?: SearchHit[];

}



export function askCopilot(memory: MemoryModel, question: string, options: CopilotOptions = {}): CopilotAnswer {

  const index = buildSearchIndex(memory);

  const searchResult = searchMemory(index, question, { limit: 8 });

  const classification = classifyIntent(question);

  const explain = explainRepository(memory);

  const heatmap = computeDomainHeatmap(memory);

  const capabilities = memory.capabilities ?? [];

  const journeys = memory.journeys ?? [];



  const baseHits = searchResult.hits;

  const relatedTopics = baseHits.slice(0, 5).map((h) => h.title);



  const impactTarget = extractImpactTarget(question) ?? classification.target;

  if (/what breaks|what happens if|impact of|blast radius|affected by/i.test(question)) {

    return answerImpactQuestion(memory, question, impactTarget, baseHits, options.graph);

  }



  switch (classification.intent) {

    case 'overview':

      return {

        question,

        answer: `${explain.oneLiner}\n\n**Architecture:** ${explain.estimatedArchitecture}\n**Capabilities:** ${explain.mainCapabilities.join(', ') || 'none detected'}\n**Health score:** ${explain.memoryScore}/100`,

        confidence: 0.95,

        sources: ['repository.dna.json', 'repository_summary.md'],

        relatedTopics: explain.mainCapabilities.slice(0, 5),

        intent: 'overview',

        hits: baseHits,

      };



    case 'flow':

      return answerFlowQuestion(memory, question, journeys, baseHits);



    case 'health':

      return answerHealthQuestion(memory, explain, heatmap, question);



    case 'auth':

      if (/where.*(login|sign-?in).*start|where.*(login|sign-?in)/i.test(question)) {
        return answerLoginStartQuestion(memory, question, baseHits);
      }

      return answerThemedQuestion(memory, question, capabilities, /auth|identity|login|sign.?in/i, 'Authentication', baseHits);



    case 'payment':

      return answerThemedQuestion(memory, question, capabilities, /payment|billing|checkout|invoice|subscription/i, 'Payments', baseHits);



    case 'impact':

    case 'dependency':

      return answerImpactQuestion(memory, question, impactTarget, baseHits, options.graph);



    case 'critical':

      return answerCriticalQuestion(memory, question, classification.target, heatmap, explain, baseHits);



    case 'smell':

      return answerSmellQuestion(memory, baseHits);



    case 'list':

      return answerListQuestion(memory, question, baseHits);



    default:

      return answerFromSearch(memory, question, explain, baseHits, classification);

  }

}



function answerFromSearch(

  memory: MemoryModel,

  question: string,

  explain: ReturnType<typeof explainRepository>,

  hits: SearchHit[],

  classification: ReturnType<typeof classifyIntent>,

): CopilotAnswer {

  if (hits.length === 0) {

    return {

      question,

      answer: `I couldn't find strong matches for "${question}" in ${memory.repository}. ${explain.oneLiner} Try asking about domains (${memory.domains.slice(0, 3).map((d) => d.name).join(', ')}), flows, or capabilities.`,

      confidence: 0.35,

      sources: ['memory.json'],

      relatedTopics: explain.mainCapabilities.slice(0, 4),

      intent: 'unknown',

      hits: [],

    };

  }



  const top = hits[0]!;

  const sections = hits.slice(0, 4).map((h) => `• **${h.title}** (${h.kind}): ${h.snippet}`);



  return {

    question,

    answer: `Found ${hits.length} relevant result${hits.length === 1 ? '' : 's'}. Top match: **${top.title}** — ${top.snippet}\n\n${sections.join('\n')}`,

    confidence: Math.min(0.92, 0.5 + top.score * 0.1),

    sources: [...new Set(hits.map((h) => `${h.kind}.json`))].slice(0, 4),

    relatedTopics: hits.slice(1, 5).map((h) => h.title),

    intent: classification.intent,

    hits,

  };

}



function answerHealthQuestion(

  memory: MemoryModel,

  explain: ReturnType<typeof explainRepository>,

  heatmap: ReturnType<typeof computeDomainHeatmap>,

  question: string,

): CopilotAnswer {

  const sorted = [...heatmap].sort((a, b) => b.riskScore - a.riskScore);

  const topRisk = sorted[0];

  const highSmells = memory.smells.filter((s) => s.severity === 'high').length;



  return {

    question,

    answer: `**Health score:** ${explain.memoryScore}/100\n**Architecture clarity:** ${explain.healthBreakdown.architecture}\n**Maintainability:** ${explain.healthBreakdown.maintainability}\n**Highest risk domain:** ${topRisk?.domain ?? 'unknown'} (${topRisk?.riskScore ?? 0}/100)\n**Smells:** ${memory.smells.length} total (${highSmells} high severity)`,

    confidence: 0.93,

    sources: ['health-score.json', 'smells.json', 'heatmap.json'],

    relatedTopics: sorted.slice(0, 4).map((h) => h.domain),

    intent: 'health',

  };

}



function answerThemedQuestion(

  memory: MemoryModel,

  question: string,

  capabilities: NonNullable<MemoryModel['capabilities']>,

  pattern: RegExp,

  theme: string,

  hits: SearchHit[],

): CopilotAnswer {

  const cap = capabilities.find((c) => pattern.test(c.signature.name + c.signature.purpose));

  const domain = memory.domains.find((d) => pattern.test(d.name + d.description));

  const flows = memory.flows.filter((f) => pattern.test(f.name + f.description));

  const topHit = hits.find((h) => pattern.test(h.title + h.snippet));



  if (cap && cap.confidence >= 0.25) {

    return {

      question,

      answer: `**${theme}** is handled by capability **${cap.signature.name}**: ${cap.signature.purpose}\nServices: ${cap.services.slice(0, 6).join(', ') || 'see domain files'}\nAPIs: ${cap.apis.slice(0, 4).join(', ') || 'none mapped'}`,

      confidence: cap.confidence,

      sources: ['capabilities.json', 'flows.json'],

      relatedTopics: flows.slice(0, 3).map((f) => f.name),

      intent: theme === 'Authentication' ? 'auth' : 'payment',

      hits,

    };

  }



  if (topHit) {

    return {

      question,

      answer: `**${theme}** context: **${topHit.title}** — ${topHit.snippet}`,

      confidence: 0.75,

      sources: [`${topHit.kind}.json`],

      relatedTopics: hits.slice(1, 4).map((h) => h.title),

      intent: theme === 'Authentication' ? 'auth' : 'payment',

      hits,

    };

  }



  return {

    question,

    answer: domain

      ? `**${theme}** maps to domain **${domain.name}**: ${domain.description}`

      : `No dedicated ${theme.toLowerCase()} capability detected. Check API routes and user journeys for related flows.`,

    confidence: domain ? domain.confidence : 0.45,

    sources: ['domains.json', 'capabilities.json'],

    relatedTopics: flows.slice(0, 3).map((f) => f.name),

    intent: theme === 'Authentication' ? 'auth' : 'payment',

    hits,

  };

}



function answerLoginStartQuestion(
  memory: MemoryModel,
  question: string,
  hits: SearchHit[],
): CopilotAnswer {
  const loginApis = memory.apis.filter((a) => /login|sign-?in|auth/i.test(a.path));
  const loginFlows = memory.flows.filter((f) => /login|sign-?in|auth/i.test(f.name + f.description + (f.entryPoint ?? '')));
  const loginHits = hits.filter((h) => /login|sign-?in|auth/i.test(h.title + (h.path ?? '') + h.snippet));

  if (loginApis.length > 0) {
    const entry = loginApis[0]!;
    return {
      question,
      answer: `Login starts at route **${entry.method} ${entry.path}** in \`${entry.file}\`${entry.handler ? ` (handler: ${entry.handler})` : ''}.`,
      confidence: 0.9,
      sources: ['apis.json', 'flows.json'],
      relatedTopics: loginApis.slice(1, 4).map((a) => `${a.method} ${a.path}`),
      intent: 'auth',
      hits: loginHits,
    };
  }

  if (loginFlows.length > 0) {
    const prodFlows = loginFlows.filter((f) => !isAuxiliaryPath(f.entryPoint));
    const flow = prodFlows[0];
    if (flow) {
      return {
        question,
        answer: `Login flow **${flow.name}** starts at **${flow.entryPoint}**.\n${flow.description}`,
        confidence: flow.confidence,
        sources: ['flows.json'],
        relatedTopics: prodFlows.slice(1, 3).map((f) => f.name),
        intent: 'auth',
        hits: loginHits,
      };
    }
  }

  const exampleHit = loginHits.find((h) => /examples?[/\\]auth|\/login/i.test((h.path ?? '') + h.snippet));
  const authEvidence = (memory.capabilities ?? [])
    .flatMap((c) => c.evidence)
    .find((e) => /examples?[/\\]auth/i.test(e));
  const depAuthPath = memory.dependencies
    .flatMap((d) => [d.from, d.to])
    .find((p) => /examples?[/\\]auth/i.test(p));
  const exampleFile = memory.services
    .map((s) => s.path)
    .concat(memory.domains.flatMap((d) => d.entryPoints))
    .concat(memory.dependencies.flatMap((d) => [d.from, d.to]))
    .find((p) => p && /examples?[/\\]auth/i.test(p)) ?? authEvidence?.replace(/^file:/, '') ?? depAuthPath;

  if (exampleHit || exampleFile) {
    const pathHint = exampleHit?.path ?? exampleFile ?? 'examples/auth';
    return {
      question,
      answer: exampleHit
        ? `No production login in core framework. Example login starts at **${exampleHit.title}** — ${exampleHit.snippet}\nPath: \`${exampleHit.path ?? pathHint}\``
        : `No production login in core framework. Example implementation: \`${pathHint}\` (see GET/POST /login routes).`,
      confidence: 0.78,
      sources: ['search-index.json', 'apis.json'],
      relatedTopics: loginHits.slice(1, 4).map((h) => h.title),
      intent: 'auth',
      hits: loginHits,
    };
  }

  const authCap = (memory.capabilities ?? []).find((c) => c.signature.id === 'authentication' && c.confidence >= 0.25);
  if (authCap) {
    return {
      question,
      answer: `Authentication capability detected but no explicit login route mapped. Check: ${authCap.evidence.slice(0, 3).join(', ')}`,
      confidence: authCap.confidence,
      sources: ['capabilities.json'],
      relatedTopics: authCap.services.slice(0, 3),
      intent: 'auth',
      hits: loginHits,
    };
  }

  return {
    question,
    answer: `No login entry point detected in ${memory.repository}. This may be a library/framework without built-in authentication, or login lives outside scanned paths.`,
    confidence: 0.55,
    sources: ['apis.json', 'flows.json', 'capabilities.json'],
    relatedTopics: memory.domains.slice(0, 3).map((d) => d.name),
    intent: 'auth',
    hits: loginHits,
  };
}



function answerImpactQuestion(
  memory: MemoryModel,
  question: string,
  target: string | undefined,
  hits: SearchHit[],
  graph?: MnemosGraph,
): CopilotAnswer {
  const query = target ?? extractImpactTarget(question) ?? question;
  const qLower = query.toLowerCase();

  const service = findBestMatch(
    memory.services,
    query,
    [
      (s, terms) => (terms.some((t) => s.name.toLowerCase() === t) ? 5 : 0),
      (s, terms) => (terms.some((t) => s.name.toLowerCase().includes(t)) ? 3 : 0),
      (s, terms) => (terms.some((t) => s.path.toLowerCase().includes(t)) ? 2 : 0),
    ],
  );

  if (graph) {
    const impact = analyzeImpact(graph, query);
    if (impact && impact.totalAffected > 0) {
      const report = formatImpactReport(impact, graph);
      const nodeName = graph.getNodeAttributes(impact.node).name;
      return {
        question,
        answer: `Changing **${nodeName}** affects **${impact.totalAffected}** nodes.\n\n**Dependencies / blast radius:**\n• APIs affected: ${impact.affectedApis.length}\n• Files affected: ${impact.affectedFiles.length}\n• Domains affected: ${impact.affectedDomains.length}\n• Tests affected: ${impact.affectedTests.length}\n\n${impact.affectedFiles.slice(0, 8).map((f) => `• ${f}`).join('\n')}`,
        confidence: 0.92,
        sources: ['dependencies.json', 'graph.json', 'critical_paths.json'],
        relatedTopics: impact.affectedApis.slice(0, 4),
        intent: 'impact',
        hits,
      };
    }
  }

  if (service) {
    const depEntries = memory.dependencies.filter(
      (d) => d.from.includes(service.name) || d.to.includes(service.name) || d.from.includes(service.path) || d.to.includes(service.path),
    );
    const relatedFlows = memory.flows.filter((f) =>
      f.steps.some((s) => s.path?.includes(service.path) || s.name.toLowerCase().includes(qLower)),
    );
    const relatedApis = memory.apis.filter((a) => a.file.includes(service.path) || a.handler?.includes(service.name));

    return {
      question,
      answer: `**Blast radius for ${service.name}:**\n\n**Dependents (${service.dependents.length}):** ${service.dependents.slice(0, 8).join(', ') || 'none'}\n**Dependencies (${service.dependencies.length}):** ${service.dependencies.slice(0, 8).join(', ') || 'none'}\n**APIs affected:** ${relatedApis.length ? relatedApis.slice(0, 5).map((a) => `${a.method} ${a.path}`).join(', ') : 'none mapped'}\n**Flows affected:** ${relatedFlows.length ? relatedFlows.slice(0, 3).map((f) => f.name).join(', ') : 'none mapped'}`,
      confidence: 0.88,
      sources: ['services.json', 'dependencies.json', 'flows.json'],
      relatedTopics: service.dependents.slice(0, 4),
      intent: 'impact',
      hits,
    };
  }

  const criticalMatch = memory.criticalPaths.find((c) =>
    qLower.split(/\s+/).some((t) => t.length > 2 && c.name.toLowerCase().includes(t)),
  );

  if (criticalMatch) {
    return {
      question,
      answer: `**${criticalMatch.name}** — ${criticalMatch.description}\nRisk: **${criticalMatch.risk}**\nAffected nodes in path: ${criticalMatch.nodes.slice(0, 8).join(', ')}`,
      confidence: 0.84,
      sources: ['critical_paths.json'],
      relatedTopics: memory.criticalPaths.slice(0, 3).map((c) => c.name),
      intent: 'impact',
      hits,
    };
  }

  const depHits = memory.dependencies.filter(
    (d) => qLower.split(/\s+/).some((t) => t.length > 2 && (d.from.toLowerCase().includes(t) || d.to.toLowerCase().includes(t))),
  );

  if (depHits.length > 0) {
    const unique = [...new Set(depHits.flatMap((d) => [d.from, d.to]))];
    return {
      question,
      answer: `**Dependency blast radius** for "${query}":\n${depHits.slice(0, 10).map((d) => `• ${d.from} → ${d.to} (${d.kind})`).join('\n')}\n\n**Total connected nodes:** ${unique.length}`,
      confidence: 0.8,
      sources: ['dependencies.json'],
      relatedTopics: unique.slice(0, 4),
      intent: 'impact',
      hits,
    };
  }

  return answerFromSearch(memory, question, explainRepository(memory), hits, classifyIntent(question));
}

function extractImpactTarget(question: string): string | undefined {
  const patterns = [
    /what breaks if\s+(?:the\s+)?(.+?)\s+changes?/i,
    /what happens if\s+(?:the\s+)?(.+?)\s+changes?/i,
    /impact of\s+(?:changing\s+)?(.+?)(?:\s+changes?)?[?.!]*$/i,
    /blast radius of\s+(.+?)[?.!]*$/i,
  ];
  for (const pattern of patterns) {
    const match = question.match(pattern);
    if (match?.[1]) return match[1].trim();
  }
  return undefined;
}

function isAuxiliaryPath(filePath?: string): boolean {
  if (!filePath) return false;
  return /(?:^|\/)(?:test|tests|__tests__|spec|e2e|examples?)(?:\/|$)/i.test(filePath.replace(/\\/g, '/'));
}



function answerDependencyQuestion(

  memory: MemoryModel,

  question: string,

  target: string | undefined,

  hits: SearchHit[],

): CopilotAnswer {

  const q = question.toLowerCase();

  const domainMatch =

    memory.domains.find((d) => target && d.name.toLowerCase().includes(target)) ??

    memory.domains.find((d) => q.includes(d.name.toLowerCase()));



  if (domainMatch) {
    const services = memory.services.filter(
      (s) => s.domain === domainMatch.id || s.domain === domainMatch.name,
    );
    const dependents = [...new Set(services.flatMap((s) => s.dependents))];
    const apis = memory.apis.filter((a) => a.domain === domainMatch.name);
    const depCount = memory.dependencies.filter(
      (d) => d.from.includes(domainMatch.name) || d.to.includes(domainMatch.name),
    ).length;

    return {
      question,
      answer: `Changing **${domainMatch.name}** affects ${services.length} services, ${apis.length} APIs, and ${dependents.length} dependent modules.\nDependents: ${dependents.slice(0, 10).join(', ') || 'none detected'}\n${depCount} dependency edges reference this domain in dependencies.json`,
      confidence: 0.84,
      sources: ['services.json', 'dependencies.json', 'apis.json'],
      relatedTopics: services.slice(0, 4).map((s) => s.name),
      intent: 'dependency',
      hits,
    };
  }



  const service = findBestMatch(

    memory.services,

    target ?? question,

    [

      (s, terms) => (terms.some((t) => s.name.toLowerCase().includes(t)) ? 3 : 0),

      (s, terms) => (terms.some((t) => s.path.toLowerCase().includes(t)) ? 2 : 0),

    ],

  );



  if (service) {
    const depEdges = memory.dependencies.filter(
      (d) => d.from.includes(service.path) || d.to.includes(service.path) || d.from.includes(service.name),
    );
    const reverseDeps = memory.dependencies.filter((d) => d.to.includes(service.path) || d.to.includes(service.name));
    const affectedApis = memory.apis.filter(
      (a) => service.dependents.some((d) => a.handler?.includes(d) || a.file.includes(d)),
    );
    const affectedFlows = memory.flows.filter((f) =>
      f.steps.some((s) => s.path?.includes(service.path) || service.dependents.some((d) => s.name.includes(d))),
    );

    const blastParts = [
      `**${service.name}** is depended on by **${service.dependents.length}** service${service.dependents.length === 1 ? '' : 's'}.`,
      service.dependents.length > 0
        ? `Direct dependents: ${service.dependents.slice(0, 8).join(', ')}`
        : 'No direct service dependents detected.',
      service.dependencies.length > 0
        ? `It depends on: ${service.dependencies.slice(0, 6).join(', ')}`
        : null,
      depEdges.length > 0 ? `${depEdges.length} dependency edge${depEdges.length === 1 ? '' : 's'} in dependencies.json` : null,
      reverseDeps.length > 0 ? `${reverseDeps.length} module${reverseDeps.length === 1 ? '' : 's'} import this code` : null,
      affectedApis.length > 0 ? `APIs that may break: ${affectedApis.slice(0, 4).map((a) => `${a.method} ${a.path}`).join(', ')}` : null,
      affectedFlows.length > 0 ? `Flows affected: ${affectedFlows.slice(0, 3).map((f) => f.name).join(', ')}` : null,
    ].filter(Boolean);

    return {
      question,
      answer: blastParts.join('\n'),
      confidence: 0.88,
      sources: ['services.json', 'dependencies.json', 'apis.json', 'flows.json'],
      relatedTopics: service.dependents.slice(0, 4),
      intent: 'impact',
      hits,
    };
  }



  return answerFromSearch(memory, question, explainRepository(memory), hits, classifyIntent(question));

}



function answerCriticalQuestion(

  memory: MemoryModel,

  question: string,

  target: string | undefined,

  heatmap: ReturnType<typeof computeDomainHeatmap>,

  explain: ReturnType<typeof explainRepository>,

  hits: SearchHit[],

): CopilotAnswer {

  const q = question.toLowerCase();

  const domainMatch =

    memory.domains.find((d) => target && d.name.toLowerCase().includes(target)) ??

    memory.domains.find((d) => q.includes(d.name.toLowerCase()) && !/^(test|tests|examples?|acceptance)$/i.test(d.name));



  const domainName = domainMatch?.name ?? explain.mostCriticalDomain;

  const heat = heatmap.find((h) => h.domain === domainName);

  const cp = memory.criticalPaths.find((c) => c.name.toLowerCase().includes((target ?? domainName).toLowerCase()));



  if (cp) {

    return {

      question,

      answer: `**${cp.name}** is critical: ${cp.description}\nRisk level: **${cp.risk}**`,

      confidence: 0.88,

      sources: ['critical_paths.json'],

      relatedTopics: memory.criticalPaths.slice(0, 3).map((c) => c.name),

      intent: 'critical',

      hits,

    };

  }



  return {

    question,

    answer: `**${domainName}** is the most critical subsystem (centrality-based analysis). ${heat ? `Risk score: ${heat.riskScore}/100. Issues: ${heat.problems.join(', ') || 'stable'}.` : ''} ${domainMatch?.description ?? ''}`,

    confidence: 0.85,

    sources: ['domains.json', 'critical_paths.json'],

    relatedTopics: memory.criticalPaths.slice(0, 3).map((c) => c.name),

    intent: 'critical',

    hits,

  };

}



function answerSmellQuestion(memory: MemoryModel, hits: SearchHit[]): CopilotAnswer {

  if (memory.smells.length === 0) {

    return {

      question: 'smells',

      answer: 'No architecture smells detected. The codebase structure looks healthy.',

      confidence: 0.9,

      sources: ['smells.json'],

      relatedTopics: [],

      intent: 'smell',

      hits: [],

    };

  }



  const top = memory.smells.slice(0, 5);

  const lines = top.map((s) => `• **${s.type.replace(/_/g, ' ')}** (${s.severity}): ${s.description}`);



  return {

    question: 'smells',

    answer: `${memory.smells.length} architecture smell${memory.smells.length === 1 ? '' : 's'} detected:\n\n${lines.join('\n')}`,

    confidence: 0.9,

    sources: ['smells.json'],

    relatedTopics: top.map((s) => s.type),

    intent: 'smell',

    hits,

  };

}



function answerListQuestion(memory: MemoryModel, question: string, hits: SearchHit[]): CopilotAnswer {

  const q = question.toLowerCase();



  if (/capabilit/.test(q)) {

    const caps = memory.capabilities ?? [];

    return {

      question,

      answer: `${caps.length} capabilities:\n${caps.slice(0, 10).map((c) => `• **${c.signature.name}** — ${c.signature.purpose}`).join('\n')}`,

      confidence: 0.9,

      sources: ['capabilities.json'],

      relatedTopics: caps.slice(0, 5).map((c) => c.signature.name),

      intent: 'list',

      hits,

    };

  }



  if (/domain/.test(q)) {

    return {

      question,

      answer: `${memory.domains.length} domains:\n${memory.domains.slice(0, 10).map((d) => `• **${d.name}** (${d.nodes.length} nodes) — ${d.description}`).join('\n')}`,

      confidence: 0.9,

      sources: ['domains.json'],

      relatedTopics: memory.domains.slice(0, 5).map((d) => d.name),

      intent: 'list',

      hits,

    };

  }



  if (/flow|journey/.test(q)) {

    const jCount = memory.journeys?.length ?? 0;

    return {

      question,

      answer: `${memory.flows.length} flows and ${jCount} user journeys:\n${memory.flows.slice(0, 8).map((f) => `• **${f.name}** (${f.type})`).join('\n')}`,

      confidence: 0.88,

      sources: ['flows.json'],

      relatedTopics: memory.flows.slice(0, 5).map((f) => f.name),

      intent: 'list',

      hits,

    };

  }



  if (/service/.test(q)) {

    const sorted = [...memory.services].sort((a, b) => b.dependents.length - a.dependents.length);

    return {

      question,

      answer: `${memory.services.length} services (top by dependents):\n${sorted.slice(0, 10).map((s) => `• **${s.name}** — ${s.dependents.length} dependents`).join('\n')}`,

      confidence: 0.88,

      sources: ['services.json'],

      relatedTopics: sorted.slice(0, 5).map((s) => s.name),

      intent: 'list',

      hits,

    };

  }



  return answerFromSearch(memory, question, explainRepository(memory), hits, classifyIntent(question));

}



function answerFlowQuestion(

  memory: MemoryModel,

  question: string,

  journeys: MemoryModel['journeys'],

  hits: SearchHit[],

): CopilotAnswer {

  const flowHit = hits.find((h) => h.kind === 'flow' || h.kind === 'journey');

  const q = question.toLowerCase();



  const matchedFlow = findBestMatch(

    memory.flows,

    question,

    [

      (f, terms) => (terms.some((t) => f.name.toLowerCase().includes(t)) ? 4 : 0),

      (f, terms) => (terms.some((t) => f.description.toLowerCase().includes(t)) ? 2 : 0),

      (f, terms) => (terms.some((t) => f.entryPoint.toLowerCase().includes(t)) ? 2 : 0),

    ],

  );



  if (matchedFlow) {

    const steps = matchedFlow.steps.map((s) => s.name).join(' → ');

    return {

      question,

      answer: `**${matchedFlow.name}** (${matchedFlow.type})\n${matchedFlow.description}\n\n**Flow:** ${steps}`,

      confidence: matchedFlow.confidence,

      sources: ['flows.json'],

      relatedTopics: matchedFlow.steps.slice(0, 4).map((s) => s.name),

      intent: 'flow',

      hits,

    };

  }



  const matchedJourney = findBestMatch(

    journeys ?? [],

    question,

    [

      (j, terms) => (terms.some((t) => j.signature.name.toLowerCase().includes(t)) ? 4 : 0),

      (j, terms) => (terms.some((t) => j.signature.purpose.toLowerCase().includes(t)) ? 2 : 0),

    ],

  );



  if (matchedJourney) {

    const steps = matchedJourney.steps.map((s) => s.name).join(' → ');

    return {

      question,

      answer: `**${matchedJourney.signature.name}**: ${matchedJourney.signature.purpose}\n\n**Journey:** ${matchedJourney.actors.join(', ')} → ${steps} → ${matchedJourney.outcomes.join(', ')}`,

      confidence: matchedJourney.confidence,

      sources: ['journeys in memory.json'],

      relatedTopics: matchedJourney.systems.slice(0, 4),

      intent: 'flow',

      hits,

    };

  }



  if (flowHit) {

    return {

      question,

      answer: `**${flowHit.title}**: ${flowHit.snippet}`,

      confidence: 0.7,

      sources: ['flows.json'],

      relatedTopics: hits.slice(1, 4).map((h) => h.title),

      intent: 'flow',

      hits,

    };

  }



  return {

    question,

    answer: `No exact flow match found. Available flows: ${memory.flows.slice(0, 6).map((f) => f.name).join(', ')}.`,

    confidence: 0.35,

    sources: ['flows.json'],

    relatedTopics: memory.flows.slice(0, 4).map((f) => f.name),

    intent: 'flow',

    hits,

  };

}


