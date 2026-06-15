import type { ApiEndpoint, Domain, MemoryModel, Service } from '../types.js';
import type { MnemosGraph } from '../graph/graph.js';
import { getNodesByKind } from '../graph/graph.js';

export interface CapabilitySignature {
  id: string;
  name: string;
  purpose: string;
  keywords: string[];
  actors: string[];
  data: string[];
  outcomes: string[];
  category: 'identity' | 'commerce' | 'communication' | 'content' | 'operations' | 'platform' | 'analytics';
  weight?: number;
}

export interface Capability {
  id: string;
  signature: CapabilitySignature;
  confidence: number;
  actors: string[];
  data: string[];
  outcomes: string[];
  services: string[];
  apis: string[];
  domains: string[];
  evidence: string[];
  reasons: string[];
}

const SIGNATURES: CapabilitySignature[] = [
  {
    id: 'authentication',
    name: 'Authentication & Identity',
    purpose: 'Manages user identity, sign-in, sign-up, sessions, and access control.',
    keywords: ['auth', 'login', 'signin', 'sign-in', 'signup', 'sign-up', 'register', 'session', 'token', 'jwt', 'oauth', 'sso', 'credential', 'password', 'logout', 'saml', 'passport'],
    actors: ['End user', 'Auth provider'],
    data: ['Credentials', 'Session token', 'Profile'],
    outcomes: ['User authenticated', 'Session established', 'Access granted or denied'],
    category: 'identity',
    weight: 1.2,
  },
  {
    id: 'authorization',
    name: 'Authorization & Permissions',
    purpose: 'Controls who can do what, role-based access, and policy enforcement.',
    keywords: ['role', 'permission', 'rbac', 'policy', 'guard', 'access', 'authorize', 'privilege', 'scope'],
    actors: ['End user', 'Administrator'],
    data: ['Subject', 'Action', 'Resource'],
    outcomes: ['Action allowed or denied'],
    category: 'identity',
  },
  {
    id: 'payments',
    name: 'Payments & Billing',
    purpose: 'Processes payments, subscriptions, invoices, and financial transactions.',
    keywords: ['payment', 'pay', 'billing', 'invoice', 'charge', 'stripe', 'subscription', 'checkout', 'order', 'cart', 'price', 'discount', 'refund', 'webhook'],
    actors: ['Customer', 'Payment gateway'],
    data: ['Card details', 'Invoice', 'Amount'],
    outcomes: ['Payment captured', 'Order confirmed', 'Invoice issued'],
    category: 'commerce',
    weight: 1.3,
  },
  {
    id: 'notifications',
    name: 'Notifications & Messaging',
    purpose: 'Delivers messages to users across email, push, SMS, and in-app channels.',
    keywords: ['notif', 'email', 'sms', 'push', 'message', 'inbox', 'alert', 'reminder', 'broadcast', 'mailer', 'sendgrid', 'twilio'],
    actors: ['End user', 'Notification gateway'],
    data: ['Recipient', 'Channel', 'Payload'],
    outcomes: ['Recipient notified'],
    category: 'communication',
  },
  {
    id: 'attendance',
    name: 'Attendance Tracking',
    purpose: 'Records and reports attendance, presence, and absence patterns.',
    keywords: ['attend', 'present', 'absent', 'rollcall', 'roll-call', 'checkin', 'check-in', 'class-attend'],
    actors: ['Teacher', 'Student'],
    data: ['Class ID', 'Student ID', 'Timestamp'],
    outcomes: ['Attendance recorded'],
    category: 'operations',
  },
  {
    id: 'transport',
    name: 'Transport & Routing',
    purpose: 'Manages routes, trips, vehicles, and live tracking for transportation operations.',
    keywords: ['transport', 'bus', 'route', 'trip', 'vehicle', 'gps', 'stop', 'pickup', 'drop', 'driver', 'tracking', 'eta'],
    actors: ['Driver', 'Guardian', 'Student'],
    data: ['Route', 'Vehicle', 'Timestamp', 'GPS'],
    outcomes: ['Trip planned', 'Live status visible', 'Trip completed'],
    category: 'operations',
  },
  {
    id: 'student_lifecycle',
    name: 'Student Lifecycle',
    purpose: 'Manages student records, enrollment, profiles, and academic lifecycle.',
    keywords: ['student', 'enroll', 'enrollment', 'admission', 'grade', 'class-section', 'guardian', 'parent'],
    actors: ['Student', 'Guardian', 'Administrator'],
    data: ['Student profile', 'Guardian', 'Class'],
    outcomes: ['Student record updated'],
    category: 'operations',
  },
  {
    id: 'driver_ops',
    name: 'Driver Operations',
    purpose: 'Onboards, assigns, and manages drivers and their daily operations.',
    keywords: ['driver', 'license', 'assignment', 'shift', 'duty'],
    actors: ['Driver', 'Administrator'],
    data: ['Driver profile', 'License', 'Vehicle'],
    outcomes: ['Driver assignment updated'],
    category: 'operations',
  },
  {
    id: 'school_admin',
    name: 'School Administration',
    purpose: 'Configures school-level settings, classes, sessions, and organizational data.',
    keywords: ['school', 'admin', 'config', 'class', 'section', 'session', 'academic-year', 'timetable'],
    actors: ['Administrator'],
    data: ['School config', 'Class config'],
    outcomes: ['School configuration updated'],
    category: 'platform',
  },
  {
    id: 'messaging',
    name: 'In-Product Messaging',
    purpose: 'Real-time chat, threads, comments, and conversation management.',
    keywords: ['chat', 'message', 'thread', 'comment', 'conversation', 'dm', 'inbox', 'websocket'],
    actors: ['End user'],
    data: ['Sender', 'Recipient', 'Body'],
    outcomes: ['Message delivered'],
    category: 'communication',
  },
  {
    id: 'media',
    name: 'Media & File Handling',
    purpose: 'Uploads, transforms, stores, and serves media and other files.',
    keywords: ['upload', 'media', 'image', 'video', 'file', 'storage', 'blob', 's3', 'cdn', 'attachment'],
    actors: ['End user'],
    data: ['File', 'MIME', 'Size'],
    outcomes: ['File stored', 'URL returned'],
    category: 'content',
  },
  {
    id: 'search',
    name: 'Search & Discovery',
    purpose: 'Indexes and queries data for search, filter, and discovery use cases.',
    keywords: ['search', 'index', 'query', 'filter', 'find', 'lookup', 'elastic', 'algolia', 'meilisearch'],
    actors: ['End user'],
    data: ['Query', 'Filters'],
    outcomes: ['Results returned'],
    category: 'content',
  },
  {
    id: 'analytics',
    name: 'Analytics & Reporting',
    purpose: 'Aggregates events and metrics for dashboards, reports, and insights.',
    keywords: ['analytics', 'metric', 'report', 'dashboard', 'stat', 'tracking', 'event', 'telemetry', 'kpi', 'chart'],
    actors: ['Administrator', 'End user'],
    data: ['Events', 'Dimensions'],
    outcomes: ['Report generated'],
    category: 'analytics',
  },
  {
    id: 'background_jobs',
    name: 'Background Jobs & Queues',
    purpose: 'Schedules and runs asynchronous, deferred, or heavy work.',
    keywords: ['job', 'queue', 'worker', 'cron', 'task', 'scheduler', 'sidekiq', 'bullmq', 'celery', 'kafka'],
    actors: ['System'],
    data: ['Job payload'],
    outcomes: ['Job executed'],
    category: 'platform',
  },
  {
    id: 'data_layer',
    name: 'Data Layer & Persistence',
    purpose: 'Manages database access, ORM, migrations, schemas, and repositories.',
    keywords: ['db', 'database', 'orm', 'prisma', 'drizzle', 'supabase', 'repo', 'model', 'schema', 'migration', 'sql'],
    actors: ['System'],
    data: ['Records'],
    outcomes: ['Data persisted or retrieved'],
    category: 'platform',
  },
  {
    id: 'api_gateway',
    name: 'API & Routing',
    purpose: 'Exposes HTTP and RPC endpoints with routing, validation, and middleware.',
    keywords: ['api', 'route', 'endpoint', 'controller', 'handler', 'middleware', 'rest', 'graphql', 'trpc'],
    actors: ['Client'],
    data: ['Request', 'Headers'],
    outcomes: ['Response returned'],
    category: 'platform',
  },
  {
    id: 'feature_flags',
    name: 'Feature Flags & Experimentation',
    purpose: 'Enables toggling features, A/B testing, and gradual rollouts.',
    keywords: ['flag', 'feature-flag', 'experiment', 'rollout', 'ab-test', 'launchdarkly', 'variant'],
    actors: ['End user', 'Administrator'],
    data: ['Flag key', 'Variant'],
    outcomes: ['Variant selected'],
    category: 'platform',
  },
];

export function discoverCapabilities(
  graph: MnemosGraph,
  memory: Pick<MemoryModel, 'services' | 'apis' | 'domains'>,
): Capability[] {
  const serviceNodes = getNodesByKind(graph, 'service');
  const apiNodes = getNodesByKind(graph, 'api');
  const routeNodes = getNodesByKind(graph, 'route');
  const fileNodes = getNodesByKind(graph, 'file');

  // Build haystack of all evidence we can match keywords against
  const filePaths: { id: string; path: string; name: string }[] = fileNodes.map((n) => ({
    id: n.id,
    path: n.path ?? n.name,
    name: n.name,
  }));

  const serviceNames: { id: string; name: string }[] = serviceNodes.map((n) => ({
    id: n.id,
    name: n.name,
  }));

  const apiPaths: { id: string; path: string; method: string }[] = [
    ...apiNodes.map((n) => ({ id: n.id, path: n.path ?? n.name, method: 'API' as string })),
    ...routeNodes.map((n) => ({ id: n.id, path: n.name, method: 'ROUTE' as string })),
  ];

  const domainByService = indexDomainsByService(memory.services, memory.domains);

  // Score each signature
  const hits: Capability[] = [];

  for (const sig of SIGNATURES) {
    const evidenceServices: { id: string; name: string }[] = [];
    const evidenceApis: { id: string; path: string; method: string }[] = [];
    const evidenceFiles: { id: string; path: string }[] = [];
    const reasons: string[] = [];

    for (const svc of serviceNames) {
      if (matchesAny(svc.name, sig.keywords)) {
        evidenceServices.push(svc);
        reasons.push(`Service "${svc.name}" matches capability keywords`);
      }
    }

    for (const api of apiPaths) {
      if (matchesAny(api.path, sig.keywords) || matchesAny(api.path.split('/').join(' '), sig.keywords)) {
        evidenceApis.push(api);
        reasons.push(`Endpoint ${api.path} matches capability keywords`);
      }
    }

    for (const file of filePaths) {
      if (matchesAny(file.path, sig.keywords) || matchesAny(file.name, sig.keywords)) {
        evidenceFiles.push(file);
      }
    }

    if (evidenceServices.length === 0 && evidenceApis.length === 0 && evidenceFiles.length === 0) {
      continue;
    }

    // Score: services count more, then apis, then files
    const serviceScore = evidenceServices.length * 0.4;
    const apiScore = Math.min(evidenceApis.length, 5) * 0.15;
    const fileScore = Math.min(evidenceFiles.length, 10) * 0.04;
    const raw = serviceScore + apiScore + fileScore;
    const weight = sig.weight ?? 1;
    const confidence = Math.min(1, raw * 0.6 * weight);

    // Collect domains touched
    const domains = new Set<string>();
    for (const svc of evidenceServices) {
      const d = domainByService.get(svc.name);
      if (d) domains.add(d);
    }
    for (const api of evidenceApis) {
      const d = memory.apis.find((a) => a.path === api.path)?.domain;
      if (d) domains.add(d);
    }

    // Limit evidence to top items for clean output
    const topServices = evidenceServices.slice(0, 6).map((s) => s.name);
    const topApis = evidenceApis.slice(0, 8).map((a) => `${a.method} ${a.path}`);

    hits.push({
      id: `capability:${sig.id}`,
      signature: sig,
      confidence: Math.round(confidence * 100) / 100,
      actors: sig.actors,
      data: sig.data,
      outcomes: sig.outcomes,
      services: topServices,
      apis: topApis,
      domains: [...domains],
      evidence: [
        ...topServices.map((s) => `service: ${s}`),
        ...topApis.map((a) => `endpoint: ${a}`),
        ...evidenceFiles.slice(0, 3).map((f) => `file: ${f.path}`),
      ],
      reasons: dedupe(reasons).slice(0, 4),
    });
  }

  return hits.sort((a, b) => b.confidence - a.confidence);
}

function matchesAny(text: string, keywords: string[]): boolean {
  const norm = text.toLowerCase();
  return keywords.some((kw) => norm.includes(kw.toLowerCase()));
}

function dedupe<T>(arr: T[]): T[] {
  return [...new Set(arr)];
}

function indexDomainsByService(services: Service[], domains: Domain[]): Map<string, string> {
  const out = new Map<string, string>();
  for (const svc of services) {
    if (svc.domain) out.set(svc.name, svc.domain);
  }
  // Also map by file→service→domain
  for (const d of domains) {
    for (const nodeId of d.nodes) {
      // Best-effort: just attach domain name for paths inside
    }
  }
  return out;
}

export function findCapability(
  capabilities: Capability[],
  query: string,
): Capability | undefined {
  const q = query.toLowerCase();
  return capabilities.find(
    (c) =>
      c.signature.id.includes(q) ||
      c.signature.name.toLowerCase().includes(q) ||
      c.services.some((s) => s.toLowerCase().includes(q)),
  );
}

export function signatureById(id: string): CapabilitySignature | undefined {
  return SIGNATURES.find((s) => s.id === id);
}

export function listSignatures(): CapabilitySignature[] {
  return SIGNATURES;
}
