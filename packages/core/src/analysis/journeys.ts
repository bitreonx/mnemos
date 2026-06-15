import type { ParsedFile, Flow, FlowStep } from '../types.js';
import type { MnemosGraph } from '../graph/graph.js';
import { getNodesByKind } from '../graph/graph.js';

export interface JourneySignature {
  id: string;
  name: string;
  purpose: string;
  patterns: RegExp[]; // match against file path or route
  actors: string[];
  systems: string[];
  data: string[];
  outcomes: string[];
  preconditions?: string[];
  weight?: number;
}

const SIGNATURES: JourneySignature[] = [
  {
    id: 'login',
    name: 'Sign-In',
    purpose: 'User authenticates and receives a session.',
    patterns: [/login/i, /signin/i, /sign-in/i, /\bauth\b/i, /session/i, /token/i],
    actors: ['End user', 'Auth provider'],
    systems: ['Auth'],
    data: ['Email or username', 'Password', 'OAuth token'],
    outcomes: ['Authenticated session established'],
    preconditions: ['Account exists'],
  },
  {
    id: 'signup',
    name: 'Sign-Up & Onboarding',
    purpose: 'New user creates an account and is onboarded.',
    patterns: [/signup/i, /sign-up/i, /register/i, /onboard/i, /welcome/i, /invite/i, /accept-invite/i],
    actors: ['New user', 'Inviter'],
    systems: ['Auth', 'Profiles'],
    data: ['Email', 'Password', 'Profile fields'],
    outcomes: ['New account created', 'Welcome flow triggered'],
  },
  {
    id: 'password_reset',
    name: 'Password Reset',
    purpose: 'User recovers access to their account via email link.',
    patterns: [/password/i, /reset/i, /forgot/i, /recover/i],
    actors: ['End user'],
    systems: ['Auth', 'Email'],
    data: ['Email', 'Reset token'],
    outcomes: ['Password reset link delivered'],
  },
  {
    id: 'checkout',
    name: 'Checkout & Payment',
    purpose: 'User reviews cart, pays, and receives confirmation.',
    patterns: [/checkout/i, /payment/i, /pay/i, /cart/i, /order/i, /billing/i, /invoice/i, /webhook/i],
    actors: ['Customer', 'Payment gateway'],
    systems: ['Payments', 'Orders'],
    data: ['Cart items', 'Card details', 'Billing address'],
    outcomes: ['Payment captured', 'Order placed'],
  },
  {
    id: 'pickup_verification',
    name: 'Pickup Verification',
    purpose: 'Guardian is verified before student is released.',
    patterns: [/pickup/i, /guardian/i, /release/i, /verify/i, /otp/i, /qr/i, /\bauth-?code/i],
    actors: ['Guardian', 'Student', 'Driver'],
    systems: ['Transport', 'Identity'],
    data: ['Guardian ID', 'Student ID', 'OTP / QR'],
    outcomes: ['Student released to verified guardian'],
  },
  {
    id: 'attendance_check',
    name: 'Attendance Check',
    purpose: 'Teacher records attendance for a class session.',
    patterns: [/attend/i, /present/i, /absent/i, /rollcall/i, /roll-call/i, /checkin/i, /check-in/i],
    actors: ['Teacher', 'Student'],
    systems: ['Attendance', 'Classes'],
    data: ['Class ID', 'Student IDs', 'Timestamp'],
    outcomes: ['Attendance recorded for class'],
  },
  {
    id: 'trip_lifecycle',
    name: 'Trip Lifecycle',
    purpose: 'Driver starts, runs, and completes a bus trip with live updates.',
    patterns: [/trip/i, /route/i, /start-trip/i, /end-trip/i, /gps/i, /tracking/i, /eta/i],
    actors: ['Driver', 'Guardian', 'Student'],
    systems: ['Transport', 'Notifications'],
    data: ['Route', 'Vehicle', 'GPS samples'],
    outcomes: ['Trip started', 'Live status visible', 'Trip completed'],
  },
  {
    id: 'notification_dispatch',
    name: 'Notification Dispatch',
    purpose: 'System or trigger sends a message to a user.',
    patterns: [/notif/i, /email/i, /sms/i, /push/i, /alert/i, /reminder/i, /broadcast/i, /mailer/i, /sendgrid/i, /twilio/i],
    actors: ['System', 'Recipient'],
    systems: ['Notifications'],
    data: ['Recipient', 'Channel', 'Template', 'Payload'],
    outcomes: ['Message dispatched'],
  },
  {
    id: 'file_upload',
    name: 'File Upload',
    purpose: 'User uploads a file and receives a stored reference.',
    patterns: [/upload/i, /media/i, /attachment/i, /avatar/i, /photo/i, /s3/i, /storage/i],
    actors: ['End user'],
    systems: ['Storage', 'Media'],
    data: ['File', 'MIME type', 'Size'],
    outcomes: ['File stored', 'URL returned'],
  },
  {
    id: 'search_query',
    name: 'Search & Discovery',
    purpose: 'User searches and filters to find a result.',
    patterns: [/search/i, /find/i, /lookup/i, /query/i, /filter/i],
    actors: ['End user'],
    systems: ['Search'],
    data: ['Query', 'Filters'],
    outcomes: ['Results returned'],
  },
  {
    id: 'admin_configuration',
    name: 'Admin Configuration',
    purpose: 'Administrator configures a setting for the organization.',
    patterns: [/admin/i, /settings/i, /config/i, /configure/i, /manage/i, /dashboard/i],
    actors: ['Administrator'],
    systems: ['Admin'],
    data: ['Settings payload'],
    outcomes: ['Configuration updated'],
  },
  {
    id: 'report_generation',
    name: 'Report Generation',
    purpose: 'System produces a structured report from data.',
    patterns: [/report/i, /export/i, /csv/i, /pdf/i, /xlsx/i, /analytics/i, /metrics/i, /stats/i],
    actors: ['Administrator', 'End user'],
    systems: ['Analytics'],
    data: ['Filters', 'Date range'],
    outcomes: ['Report generated'],
  },
  {
    id: 'realtime_sync',
    name: 'Real-time Sync',
    purpose: 'Live state is pushed to clients via WebSocket or SSE.',
    patterns: [/websocket/i, /sse/i, /realtime/i, /live/i, /subscribe/i, /channel/i],
    actors: ['End user', 'System'],
    systems: ['Realtime'],
    data: ['Subscription topic'],
    outcomes: ['Live state visible to clients'],
  },
];

export interface DiscoveredJourney {
  id: string;
  signature: JourneySignature;
  confidence: number;
  entryPoint: string;
  entryRoute?: string;
  steps: FlowStep[];
  actors: string[];
  systems: string[];
  data: string[];
  outcomes: string[];
  preconditions: string[];
  reason: string;
}

export function discoverJourneys(
  graph: MnemosGraph,
  parsedFiles: ParsedFile[],
  flows: Flow[],
): DiscoveredJourney[] {
  const entryFiles = parsedFiles.filter((f) => f.isRoute || f.hasUseServer || f.isRoute || hasApiHandler(f));

  const journeys: DiscoveredJourney[] = [];

  for (const sig of SIGNATURES) {
    const candidates: { file: ParsedFile; score: number }[] = [];
    for (const file of entryFiles) {
      const score = scoreFileAgainstJourney(file, sig);
      if (score > 0) candidates.push({ file, score });
    }
    // Also pick up from flows matching the journey name
    for (const flow of flows) {
      if (sig.patterns.some((p) => p.test(flow.name))) {
        const exists = candidates.find((c) => c.file.relativePath === flow.entryPoint);
        if (!exists) {
          candidates.push({ file: fakeFileFromFlow(flow), score: flow.confidence * 0.8 });
        }
      }
    }

    if (candidates.length === 0) continue;

    candidates.sort((a, b) => b.score - a.score);
    const primary = candidates[0]!;
    const support = new Set([primary.file.relativePath]);
    candidates.slice(1, 4).forEach((c) => support.add(c.file.relativePath));

    const steps = traceSteps(graph, primary.file);

    const journey: DiscoveredJourney = {
      id: `journey:${sig.id}`,
      signature: sig,
      confidence: Math.min(0.99, primary.score * (sig.weight ?? 1)),
      entryPoint: primary.file.relativePath,
      entryRoute: primary.file.routePath,
      steps,
      actors: sig.actors,
      systems: collectSystems(graph, steps, parsedFiles),
      data: sig.data,
      outcomes: sig.outcomes,
      preconditions: sig.preconditions ?? [],
      reason: buildReason(primary.file, candidates, sig, support.size),
    };

    journeys.push(journey);
  }

  return journeys.sort((a, b) => b.confidence - a.confidence);
}

function scoreFileAgainstJourney(file: ParsedFile, sig: JourneySignature): number {
  let score = 0;
  for (const p of sig.patterns) {
    if (p.test(file.relativePath)) score += 0.5;
    if (file.routePath && p.test(file.routePath)) score += 0.6;
  }
  // Boost if it has symbols related
  for (const sym of file.symbols) {
    if (sig.patterns.some((p) => p.test(sym.name))) score += 0.2;
  }
  return Math.min(1, score);
}

function hasApiHandler(file: ParsedFile): boolean {
  return file.relativePath.includes('/api/') || file.relativePath.includes('route.ts') || file.relativePath.includes('route.tsx');
}

function fakeFileFromFlow(flow: Flow): ParsedFile {
  return {
    path: flow.entryPoint,
    relativePath: flow.entryPoint,
    language: 'typescript',
    symbols: [],
    imports: [],
    calls: [],
    exports: [],
    isTest: false,
    isRoute: flow.type === 'request',
    routePath: flow.name,
    hasUseServer: false,
    metadata: {},
  };
}

function traceSteps(graph: MnemosGraph, file: ParsedFile): FlowStep[] {
  const steps: FlowStep[] = [];
  const visited = new Set<string>();
  const fileNode = [...graph.nodes()].find((id) => {
    const attrs = graph.getNodeAttributes(id);
    return attrs.kind === 'file' && attrs.path === file.relativePath;
  });
  if (!fileNode) return steps;
  const queue: Array<{ id: string; depth: number }> = [{ id: fileNode, depth: 0 }];
  while (queue.length > 0 && steps.length < 12) {
    const { id, depth } = queue.shift()!;
    if (visited.has(id) || depth > 6) continue;
    visited.add(id);
    const attrs = graph.getNodeAttributes(id);
    steps.push({ nodeId: id, name: attrs.name, kind: attrs.kind, path: attrs.path });
    for (const neighbor of graph.outNeighbors(id)) {
      const nAttrs = graph.getNodeAttributes(neighbor);
      if (['function', 'class', 'service', 'api', 'route'].includes(nAttrs.kind)) {
        queue.push({ id: neighbor, depth: depth + 1 });
      }
    }
  }
  return steps;
}

function collectSystems(graph: MnemosGraph, steps: FlowStep[], files: ParsedFile[]): string[] {
  const systems = new Set<string>();
  for (const step of steps) {
    if (step.kind === 'service' || step.kind === 'package') {
      const attr = graph.getNodeAttribute(step.nodeId, 'name') as string | undefined;
      if (attr) systems.add(humanize(attr));
    }
  }
  return [...systems].slice(0, 5);
}

function humanize(name: string): string {
  return name
    .split(/[-_\s]+/)
    .map((w) => (w.length > 0 ? w[0]!.toUpperCase() + w.slice(1) : w))
    .join(' ');
}

function buildReason(
  primary: ParsedFile,
  candidates: { file: ParsedFile }[],
  sig: JourneySignature,
  supportCount: number,
): string {
  const route = primary.routePath ?? primary.relativePath;
  return `Detected ${supportCount} file${supportCount > 1 ? 's' : ''} related to "${sig.name}" — entry at ${route}.`;
}

export function findJourney(
  journeys: DiscoveredJourney[],
  query: string,
): DiscoveredJourney | undefined {
  const q = query.toLowerCase();
  return journeys.find(
    (j) =>
      j.signature.id.includes(q) ||
      j.signature.name.toLowerCase().includes(q) ||
      (j.entryRoute ?? '').toLowerCase().includes(q),
  );
}

export function listJourneySignatures(): JourneySignature[] {
  return SIGNATURES;
}
