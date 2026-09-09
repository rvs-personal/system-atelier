import {
  extraIncidents,
  extraDossiers,
  faultEffects,
} from './incident-library';
import {
  initialDesign,
  reachable,
  simulate,
  type Design,
  type LoadSettings,
} from './model';
export const productionDesign: Design = {
  nodes: [
    ...initialDesign.nodes,
    {
      id: 'cache',
      name: 'Read cache',
      kind: 'cache',
      detail: 'Product views · cache-aside',
      replicas: 1,
      capacity: 10000,
    },
    {
      id: 'queue',
      name: 'Notification queue',
      kind: 'queue',
      detail: 'Durable background work',
      replicas: 1,
      capacity: 1000,
    },
    {
      id: 'worker',
      name: 'Notification worker',
      kind: 'worker',
      detail: 'Idempotent delivery',
      replicas: 2,
      capacity: 200,
    },
  ],
  edges: [
    ...initialDesign.edges,
    { id: 'ac', from: 'api', to: 'cache', label: 'Read lookup', async: false },
    { id: 'cd', from: 'cache', to: 'db', label: 'Cache miss', async: false },
    {
      id: 'aq',
      from: 'api',
      to: 'queue',
      label: 'Enqueue notification',
      async: true,
    },
    {
      id: 'qw',
      from: 'queue',
      to: 'worker',
      label: 'Deliver / ack',
      async: true,
    },
  ],
};
export const rates = {
  client: 0,
  balancer: 20,
  service: 60,
  cache: 45,
  database: 180,
  queue: 25,
  worker: 45,
  class: 0,
};
export type OpsConfig = {
  rps: number;
  reads: number;
  hit: number;
  apiDown: boolean;
  cacheDown: boolean;
  dbDown: boolean;
  workerDown: boolean;
  ttl: number;
  freshnessTarget: number;
  budget: number;
  latencyTarget: number;
  faults?: string[];
  responseCost?: number;
  providerLimit?: number;
  providerDown?: boolean;
  poisonPercent?: number;
  boundedRetries?: boolean;
  quarantine?: boolean;
  payloadFixed?: boolean;
};
export const initialConfig: OpsConfig = {
  rps: 1000,
  reads: 90,
  hit: 90,
  apiDown: false,
  cacheDown: false,
  dbDown: false,
  workerDown: false,
  ttl: 30,
  freshnessTarget: 60,
  budget: 900,
  latencyTarget: 150,
};
export function monthlyBill(d: Design) {
  return d.nodes.reduce(
    (sum, n) =>
      sum +
      rates[n.kind] *
        n.replicas *
        (n.kind === 'database' ? Math.max(1, n.capacity / 1000) : 1),
    0,
  );
}
export function operations(d: Design, c: OpsConfig, backlog = 0) {
  const cache = d.nodes.find((n) => n.kind === 'cache'),
    database = d.nodes.find(
      (n) => n.kind === 'database' && n.role !== 'read-replica',
    );
  const cacheOnline = !!cache && !(c.cacheDown && cache.replicas < 2);
  const effective: Design = {
    ...d,
    nodes: d.nodes.map((n) =>
      c.dbDown && n.id === database?.id ? { ...n, capacity: 0 } : n,
    ),
  };
  const fx = faultEffects(c);
  const model = simulate(effective, {
    rps: c.rps * fx.load,
    reads: c.reads,
    hit: cacheOnline ? c.hit : 0,
    failed: c.apiDown,
  });
  const bill = monthlyBill(d) + fx.cost;
  const api = d.nodes.find((n) => n.kind === 'service'),
    queue = d.nodes.find((n) => n.kind === 'queue'),
    worker = d.nodes.find((n) => n.kind === 'worker');
  const asyncConnected =
    !!api &&
    !!queue &&
    !!worker &&
    reachable(d, api.id, queue.id) &&
    reachable(d, queue.id, worker.id);
  const jobRate = c.rps * 0.05;
  const rawWorkerCapacity = asyncConnected
    ? worker!.capacity * Math.max(0, worker!.replicas - (c.workerDown ? 1 : 0))
    : 0;
  const providerLimit = c.providerDown ? 0 : (c.providerLimit ?? 10000),
    poison = (c.payloadFixed ? 0 : (c.poisonPercent ?? 0)) / 100,
    retryAmplification = c.boundedRetries ? 1 : 1 + poison * 8,
    attemptCapacity = Math.min(rawWorkerCapacity, providerLimit),
    workerCapacity =
      ((attemptCapacity * (1 - poison)) / retryAmplification) * fx.delivery,
    quarantineRate = c.quarantine ? attemptCapacity * poison : 0;
  const syncSuccess = model.valid
    ? Math.min(1, model.completed / (c.rps * fx.load)) * fx.success
    : 0;
  const latency = model.valid ? model.mean : null;
  const freshness = Math.max(
    fx.freshness,
    cacheOnline && c.hit > 0 && model.valid && model.cache ? c.ttl : 0,
  );
  return {
    model,
    bill,
    businessSafe: fx.safe,
    attemptMultiplier: fx.load,
    syncSuccess,
    latency,
    freshness,
    jobRate,
    workerCapacity,
    rawWorkerCapacity,
    providerLimit,
    poison,
    retryAmplification,
    quarantineRate,
    asyncConnected,
    backlog,
    queueDelay:
      workerCapacity > 0
        ? backlog / workerCapacity
        : backlog > 0
          ? Infinity
          : 0,
    healthy:
      fx.safe &&
      !c.faults?.length &&
      syncSuccess >= 0.999 &&
      latency !== null &&
      latency < c.latencyTarget &&
      freshness <= c.freshnessTarget &&
      bill <= c.budget &&
      workerCapacity >= jobRate &&
      backlog < workerCapacity * 60,
  };
}
export type Incident = {
  title: string;
  actor: string;
  complaint: string;
  brief: string;
  lesson: string;
  hint: string;
  fix: string;
};
const baseIncidents: Incident[] = [
  {
    title: 'Your launch went viral',
    actor: 'Customer support',
    complaint: '“Checkout just spins. I’ve tried three times.”',
    brief:
      'A campaign drove incoming traffic to 9,000 requests/s. Requests are failing and notifications are falling behind. Restore service without ignoring the background workload.',
    lesson:
      'Scaling one tier can move the bottleneck to another. Verify the full request path and the asynchronous completion path.',
    hint: 'Inspect API capacity, database demand, and worker throughput separately. A better read hit rate reduces database work, but it cannot create API or worker capacity.',
    fix: 'Try 5 API replicas, a database tier of 2,000 operations/s, and 3 notification workers. Then let the backlog drain. This is one solution under the model’s assumptions, not a production sizing recommendation.',
  },
  {
    title: 'A deploy takes an API node down',
    actor: 'On-call engineer',
    complaint: '“The graph looked healthy until we deployed.”',
    brief:
      'Traffic is 3,000 requests/s, the service has two replicas, and one is offline. Make the design survive this failure while keeping cost inside the budget.',
    lesson:
      'Provision for the failure state, not only the happy path. A replica that is down still costs money in this model.',
    hint: 'Do not just restore the failed instance. Keep the failure injected and ensure the remaining replicas have enough headroom.',
    fix: 'At 2,000 requests/s per replica, 3 replicas leave 4,000/s after losing one. Check database demand and tail-risk headroom; this lab reports a mean latency proxy only.',
  },
  {
    title: 'Fast responses, wrong information',
    actor: 'Product manager',
    complaint:
      '“It says the item is available, but that changed ten minutes ago.”',
    brief:
      'A cache-policy change raised TTL to 900 seconds. Product allows at most 60 seconds of potential staleness. Restore the freshness contract without overwhelming storage.',
    lesson:
      'Customer experience includes correctness and freshness. A fast response can still be unacceptable.',
    hint: 'Reduce the TTL to the product’s freshness bound. A shorter TTL may reduce hit rate in reality; test that sensitivity instead of assuming the hit rate is fixed.',
    fix: 'Set TTL to 60 seconds or lower, then deliberately lower the hit rate to test database headroom. Real invalidation races require additional design beyond a TTL.',
  },
  {
    title: 'The database primary is unavailable',
    actor: 'Incident commander',
    complaint: '“Orders are not going through. Can we recover safely?”',
    brief:
      'The authoritative database has stopped responding. Create a standby if needed, then explicitly promote it. Keep writes fenced to one primary in your recovery plan.',
    lesson:
      'Replication, failover, and backups solve different problems. A standby does not promote itself just because it appears on a diagram.',
    hint: 'Add a database replica, then use the promotion action. In production you must establish replication freshness, fence the old primary, and update routing.',
    fix: 'Use at least 2 database replicas, promote the standby, and state your data-loss assumption. This simulation assumes promotion restores a fully caught-up copy; real asynchronous replicas may lose writes.',
  },
  {
    title: 'The infrastructure bill doubled',
    actor: 'Finance partner',
    complaint: '“We need this under $600/month. Please don’t break checkout.”',
    brief:
      'Over-provisioned API and database replicas pushed the illustrative bill above budget. Traffic is now 2,000 requests/s. Reduce monthly spend while protecting user outcomes.',
    lesson:
      'Capacity has carrying cost. Optimize the complete bill and keep a recovery strategy, rather than deleting random boxes.',
    hint: 'API replicas and database copies both accrue cost. The worker fleet and queue matter too. Remove unnecessary capacity without breaking a connected path.',
    fix: 'For this workload, 2 API replicas, 1 database, 1 cache, 1 queue, and 1 worker cost $435/month including the load balancer. This passes current load but sacrifices database failover; record that residual risk.',
  },
  {
    title: 'Accepted does not mean delivered',
    actor: 'Customer success',
    complaint: '“The purchase succeeded, but my confirmation never arrived.”',
    brief:
      'All notification workers were removed from service and 24,000 jobs are waiting. The provider allows only 30 sends/s and 10% of payloads are invalid. Restore delivery, contain retries, fix payloads and replay quarantined work.',
    lesson:
      'Synchronous availability can look perfect while asynchronous user promises fail. Watch oldest-work age as well as HTTP success.',
    hint: 'Reconnect a worker after the queue, add processing headroom, and advance the simulation. A dead queue-to-worker edge prevents delivery regardless of worker count.',
    fix: 'Restore the worker, cap retries, quarantine invalid messages, negotiate provider capacity above 50/s, fix the payload mapping, replay the dead-letter queue, and drain the backlog. More workers alone cannot exceed the provider quota.',
  },
];
export const incidents: Incident[] = [...baseIncidents, ...extraIncidents];
export type OpsState = {
  attempts?: Record<number, number>;
  variation?: number;
  offeredTraffic?: number;
  verification?: { signature: string; at: number };
  design: Design;
  config: OpsConfig;
  backlog: number;
  deadLetters?: number;
  seconds: number;
  spend: number;
  running: boolean;
  lastTick: number;
  incident: number;
  resolved: number[];
  events: { time: number; text: string }[];
  note: string;
  report: string;
  showIncident: boolean;
  decisions?: {
    title: string;
    note: string;
    design: Design;
    config: OpsConfig;
    bill: number;
    time: number;
  }[];
};
export const initialOps: OpsState = {
  design: productionDesign,
  config: initialConfig,
  backlog: 0,
  seconds: 0,
  spend: 0,
  running: false,
  lastTick: 0,
  incident: -1,
  resolved: [],
  events: [],
  note: '',
  report: '',
  showIncident: false,
  decisions: [],
};
export function advanceOps(d: OpsState, seconds: number): OpsState {
  const m = operations(d.design, d.config, d.backlog);
  return {
    ...d,
    seconds: d.seconds + seconds,
    spend: d.spend + (m.bill / (30 * 24 * 3600)) * seconds,
    backlog: Math.max(
      0,
      d.backlog + (m.jobRate - m.workerCapacity - m.quarantineRate) * seconds,
    ),
    deadLetters:
      (d.deadLetters ?? 0) +
      Math.min(d.backlog + m.jobRate * seconds, m.quarantineRate * seconds),
    lastTick: Date.now(),
  };
}
export function injectIncident(d: OpsState, i: number): OpsState {
  const next: OpsState = {
    ...d,
    incident: i,
    showIncident: true,
    report: '',
    note: '',
    events: [
      { time: d.seconds, text: 'INCIDENT: ' + incidents[i].title },
      ...d.events,
    ].slice(0, 30),
    config: { ...initialConfig },
    design: structuredClone(productionDesign),
    backlog: 0,
    deadLetters: 0,
  };
  if (i === 0) next.config.rps = 9000;
  if (i === 1) {
    next.config.rps = 3000;
    next.config.apiDown = true;
  }
  if (i === 2) next.config.ttl = 900;
  if (i === 3) next.config.dbDown = true;
  if (i === 4) {
    next.config.rps = 2000;
    next.config.budget = 600;
    next.design.nodes = next.design.nodes.map((n) =>
      n.kind === 'service'
        ? { ...n, replicas: 10 }
        : n.kind === 'database'
          ? { ...n, replicas: 3 }
          : n,
    );
  }
  if (i === 5) {
    next.config.workerDown = true;
    next.design.nodes = next.design.nodes.map((n) =>
      n.kind === 'worker' ? { ...n, replicas: 1 } : n,
    );
    next.backlog = 24000;
    next.config.providerLimit = 30;
    next.config.poisonPercent = 10;
    next.config.boundedRetries = false;
  }
  if (i >= 6 && extraDossiers[i - 6]) {
    next.config.faults = [extraDossiers[i - 6].fault];
    next.config.rps = extraDossiers[i - 6].load;
    next.backlog =
      extraDossiers[i - 6].category === 'Messaging' ||
      extraDossiers[i - 6].category === 'Identity'
        ? 24000
        : 0;
  }
  const attempt = (d.attempts?.[i] ?? 0) + 1;
  const variation = (attempt - 1) % 3;
  next.attempts = { ...d.attempts, [i]: attempt };
  next.variation = variation;
  next.config.rps =
    Math.round((next.config.rps * (1 + variation * 0.1)) / 100) * 100;
  next.config.budget += variation * 90;
  next.backlog *= 1 + variation * 0.25;
  next.offeredTraffic = next.config.rps;
  next.verification = undefined;
  next.events = [
    {
      time: next.seconds,
      text: `Run ${attempt}: ${next.config.rps} requests/s, $${next.config.budget}/month budget, ${next.backlog} waiting jobs.`,
    },
    ...next.events,
  ].slice(0, 30);
  return next;
}
export function recoveryChecks(d: OpsState) {
  const m = operations(d.design, d.config, d.backlog);
  return [
    {
      label: 'At least 99.9% of offered requests can complete',
      pass: m.syncSuccess >= 0.999,
    },
    {
      label: `Mean latency proxy is below ${d.config.latencyTarget} ms`,
      pass: m.latency !== null && m.latency < d.config.latencyTarget,
    },
    {
      label: `Potential cache staleness is at most ${d.config.freshnessTarget}s`,
      pass: m.freshness <= d.config.freshnessTarget,
    },
    {
      label: `Monthly estimate stays at or below $${d.config.budget}`,
      pass: m.bill <= d.config.budget,
    },
    {
      label: 'Notification throughput covers incoming work',
      pass: m.workerCapacity >= m.jobRate,
    },
    {
      label: 'Notification backlog is under one minute of processing',
      pass: m.queueDelay < 60,
    },
    ...(d.incident >= 0
      ? [
          {
            label: 'Recovery retains the incident’s offered traffic',
            pass:
              d.config.rps >=
              (d.offeredTraffic ??
                [9000, 3000, 1000, 1000, 2000, 1000][d.incident] ??
                extraDossiers[d.incident - 6]?.load ??
                1000),
          },
        ]
      : []),
    ...(d.incident >= 6
      ? [
          {
            label:
              'Verification replay matches the current design and configuration',
            pass: d.verification?.signature === verificationSignature(d),
          },
          {
            label: 'The incident cause and any unsafe mitigation are resolved',
            pass: !d.config.faults?.length,
          },
          { label: 'Customer effects remain safe', pass: m.businessSafe },
        ]
      : []),
    ...(d.incident === 5
      ? [
          {
            label: 'Provider has capacity above new arrivals',
            pass: m.providerLimit > m.jobRate,
          },
          {
            label: 'Retry attempts are bounded with backoff',
            pass: !!d.config.boundedRetries,
          },
          {
            label: 'Malformed payload is fixed before replay',
            pass: !!d.config.payloadFixed,
          },
          {
            label: 'Quarantined notifications have been replayed',
            pass: (d.deadLetters ?? 0) === 0,
          },
        ]
      : []),
    ...(d.incident === 1
      ? [
          {
            label: 'Recovery survives with one API replica still offline',
            pass: d.config.apiDown,
          },
        ]
      : []),
  ];
}
const baseTradeoffs: [
  { name: string; gain: string; cost: string; when: string },
  { name: string; gain: string; cost: string; when: string },
][] = [
  [
    {
      name: 'Buy capacity across the hot path',
      gain: 'Works without assuming a dramatic improvement in hit rate.',
      cost: 'More API, database, and worker capacity increases the steady monthly bill.',
      when: 'Traffic growth is durable and the workload does not cache well.',
    },
    {
      name: 'Reduce database work, then scale compute',
      gain: 'A stronger cache policy can reduce the database tier you need.',
      cost: 'Freshness rules, invalidation races, and cache outages become more important.',
      when: 'Reads dominate and the product tolerates the stated staleness.',
    },
  ],
  [
    {
      name: 'Keep failover headroom',
      gain: 'Remaining API replicas can absorb one instance failure.',
      cost: 'Idle capacity is a recurring expense, and downstream bottlenecks remain.',
      when: 'Availability during deploys and node loss is a hard customer promise.',
    },
    {
      name: 'Shed optional work during failure',
      gain: 'Protects the essential journey with less permanent headroom.',
      cost: 'Some features or requests degrade, so the product contract must allow it.',
      when: 'Optional work can be isolated and degraded explicitly. Current lab traffic counts all requests as required.',
    },
  ],
  [
    {
      name: 'Bound cache freshness',
      gain: 'Retains low-latency reads while meeting the stated staleness bound.',
      cost: 'Shorter TTLs may reduce hits and trigger refresh bursts; TTL alone does not solve every race.',
      when: 'The product accepts bounded staleness and invalidation is designed carefully.',
    },
    {
      name: 'Read authoritative state',
      gain: 'Avoids serving an old cached value for the selected operation.',
      cost: 'Adds database load and network latency; isolation semantics still matter.',
      when: 'A stale result would violate a business invariant. Scale the authoritative path accordingly.',
    },
  ],
  [
    {
      name: 'Promote a prepared standby',
      gain: 'Can shorten recovery when replication and routing are ready.',
      cost: 'Replica cost, promotion logic, old-primary fencing, and possible asynchronous data loss.',
      when: 'Recovery targets justify the redundancy and the runbook has been rehearsed.',
    },
    {
      name: 'Wait for or restore the primary',
      gain: 'Avoids a hasty split-brain decision and may need less standing redundancy.',
      cost: 'Customers remain unavailable longer. A restore must meet the accepted RPO/RTO.',
      when: 'A longer recovery window is explicitly accepted. This lab records present health, not a restore-time guarantee.',
    },
  ],
  [
    {
      name: 'Right-size for today’s load',
      gain: 'Lowers the recurring bill while preserving current throughput.',
      cost: 'Less failure headroom and more exposure to the next burst.',
      when: 'Demand is measured, scaling lead time is acceptable, and residual risks are owned.',
    },
    {
      name: 'Keep redundancy, cut another cost driver',
      gain: 'Protects recovery options while looking for efficiency elsewhere.',
      cost: 'May require query work, retention changes, or business scope changes outside this simple model.',
      when: 'Failover is a hard requirement. Do not claim the budget target is met until measured savings exist.',
    },
  ],
  [
    {
      name: 'Increase worker capacity',
      gain: 'Drains the backlog sooner if downstream providers can keep up.',
      cost: 'More worker cost and a risk of overwhelming the delivery provider.',
      when: 'Jobs are parallelizable and retries are bounded.',
    },
    {
      name: 'Prioritize time-sensitive jobs',
      gain: 'Protects urgent notifications before all historical work clears.',
      cost: 'Lower-priority work waits longer; scheduling and fairness become more complex.',
      when: 'The product defines distinct deadlines. This lab’s aggregate queue cannot prove per-priority guarantees.',
    },
  ],
];

export const tradeoffs = [
  ...baseTradeoffs,
  ...extraDossiers.map((d) =>
    d.alternatives.map((text, i) => ({
      name: d.actions[i].title,
      gain: d.actions[i].detail,
      cost: text,
      when:
        i === 0
          ? 'The evidence supports the diagnosed mechanism.'
          : 'The alternative’s operational tradeoff is acceptable.',
    })),
  ),
];

export function verificationSignature(s: OpsState) {
  return JSON.stringify({
    incident: s.incident,
    design: s.design,
    config: s.config,
  });
}
export function replayVerification(s: OpsState): OpsState {
  const next = advanceOps({ ...s, running: false }, 60),
    m = operations(next.design, next.config, next.backlog);
  return {
    ...next,
    verification: { signature: verificationSignature(next), at: next.seconds },
    events: [
      {
        time: next.seconds,
        text: `Verification replay: ${(m.syncSuccess * 100).toFixed(1)}% useful requests; ${Math.round(next.backlog)} pending jobs; $${m.bill}/month. Check correctness and remaining faults before closure.`,
      },
      ...next.events,
    ].slice(0, 30),
  };
}

export function nextIncident(d: OpsState) {
  const order = [
    0, 6, 2, 8, 5, 14, 3, 17, 4, 19, 1, 15, 7, 9, 10, 11, 12, 13, 16, 18, 20,
    21,
  ];
  const start = order.indexOf(d.incident);
  for (let offset = 1; offset <= order.length; offset++) {
    const i = order[(start + offset + order.length) % order.length];
    if (!d.resolved.includes(i)) return i;
  }
  return order[(start + 1) % order.length];
}
