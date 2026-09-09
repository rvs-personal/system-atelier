export type NodeKind =
  | 'client'
  | 'balancer'
  | 'service'
  | 'cache'
  | 'database'
  | 'queue'
  | 'worker'
  | 'class';
export type DesignNode = {
  id: string;
  name: string;
  kind: NodeKind;
  detail: string;
  capacity: number;
  replicas: number;
  role?: 'read-replica';
};
export type DesignEdge = {
  id: string;
  from: string;
  to: string;
  label: string;
  async: boolean;
};
export type Design = { nodes: DesignNode[]; edges: DesignEdge[] };
export const initialDesign: Design = {
  nodes: [
    {
      id: 'client',
      name: 'Clients',
      kind: 'client',
      detail: 'Browser / mobile',
      capacity: 0,
      replicas: 1,
    },
    {
      id: 'lb',
      name: 'Load balancer',
      kind: 'balancer',
      detail: 'Health-aware routing',
      capacity: 0,
      replicas: 1,
    },
    {
      id: 'api',
      name: 'API service',
      kind: 'service',
      detail: 'Stateless request handlers',
      capacity: 2000,
      replicas: 2,
    },
    {
      id: 'db',
      name: 'Primary database',
      kind: 'database',
      detail: 'Authoritative records',
      capacity: 1000,
      replicas: 1,
    },
  ],
  edges: [
    { id: 'e1', from: 'client', to: 'lb', label: 'HTTPS', async: false },
    { id: 'e2', from: 'lb', to: 'api', label: 'Route', async: false },
    { id: 'e3', from: 'api', to: 'db', label: 'Read / write', async: false },
  ],
};
export function graphDot(
  design: Design,
  hot: string[] = [],
  interactive = false,
) {
  const q = (v: string) => JSON.stringify(v);
  return `digraph { graph [rankdir=LR, bgcolor="transparent", pad="0.35", nodesep="0.6", ranksep="0.7", splines=true, fontname="Arial"]; node [shape=box, style="rounded,filled", fillcolor="#233247", color="#647c9f", fontcolor="#e1ebfa", fontname="Arial", fontsize=14, margin="0.23,0.18", penwidth=1.2]; edge [color="#8ca4c7", fontcolor="#c2cfe2", fontname="Arial", fontsize=11, arrowsize=0.65, penwidth=1.3]; ${design.nodes.map((n) => `${q(n.id)} [label=${q(n.name + '\n' + n.detail + (interactive && ['service', 'worker', 'database', 'cache'].includes(n.kind) ? '\n' + n.replicas + ' copies · ' + n.capacity + '/s each' : '') + (interactive ? '\n\n\n' : ''))},${n.kind === 'database' ? 'shape=cylinder,' : ''}${hot.includes(n.id) ? 'color="#f09e85",fillcolor="#3a2521",' : ''}${n.kind === 'cache' ? 'color="#83a6f8",' : ''} id=${q('node-' + n.id)}];`).join('\n')} ${design.edges
    .filter(
      (e) =>
        design.nodes.some((n) => n.id === e.from) &&
        design.nodes.some((n) => n.id === e.to),
    )
    .map(
      (e) =>
        `${q(e.from)} -> ${q(e.to)} [label=${q(e.label)},style=${e.async ? 'dashed' : 'solid'}];`,
    )
    .join('\n')} }`;
}
export function reachable(d: Design, from: string, to: string) {
  const ids = new Set(d.nodes.map((n) => n.id));
  if (!ids.has(from) || !ids.has(to)) return false;
  const seen = new Set<string>();
  const todo = [from];
  while (todo.length) {
    const id = todo.pop()!;
    if (id === to) return true;
    if (seen.has(id)) continue;
    seen.add(id);
    for (const e of d.edges)
      if (e.from === id && ids.has(e.to)) todo.push(e.to);
  }
  return false;
}
export type LoadSettings = {
  rps: number;
  reads: number;
  hit: number;
  failed: boolean;
};
export function simulate(d: Design, s: LoadSettings) {
  const client = d.nodes.find((n) => n.kind === 'client'),
    api = d.nodes.find((n) => n.kind === 'service'),
    db = d.nodes.find(
      (n) => n.kind === 'database' && n.role !== 'read-replica',
    );
  if (
    !client ||
    !api ||
    !db ||
    !reachable(d, client.id, api.id) ||
    !reachable(d, api.id, db.id)
  )
    return {
      valid: false as const,
      reason:
        'Connect a client to a service and that service to a database to model this request path.',
    };
  const cache = d.nodes.find(
    (n) =>
      n.kind === 'cache' &&
      reachable(d, api.id, n.id) &&
      reachable(d, n.id, db.id),
  );
  const replicas = Math.max(0, api.replicas - (s.failed ? 1 : 0)),
    apiCap = api.capacity * replicas,
    hit = cache ? s.hit / 100 : 0;
  const readFraction = s.reads / 100,
    dbPerRequest = 1 - readFraction * hit,
    dbDemand = s.rps * dbPerRequest;
  const readReplicas = d.nodes.filter(
    (n) =>
      n.role === 'read-replica' &&
      reachable(d, api.id, n.id) &&
      reachable(d, db.id, n.id),
  );
  const readCapacity = readReplicas.reduce(
    (sum, n) => sum + n.capacity * n.replicas,
    0,
  );
  const writeFraction = 1 - readFraction,
    missFraction = readFraction * (1 - hit);
  const dbCap = db.capacity;
  const storageLimit =
    readCapacity > 0
      ? Math.min(
          writeFraction > 0 ? dbCap / writeFraction : Infinity,
          missFraction > 0 ? readCapacity / missFraction : Infinity,
        )
      : dbCap / dbPerRequest;
  const capacity = dbCap <= 0 ? 0 : Math.min(apiCap, storageLimit);
  const completed = Math.min(s.rps, capacity);
  const utilization = capacity > 0 ? s.rps / capacity : Infinity;
  // A deliberately simple illustrative queueing proxy, not a measured p95 or a full network simulator.
  const base =
    8 + readFraction * (hit * 2 + (1 - hit) * 12) + (1 - readFraction) * 15;
  const mean = utilization < 1 ? base / (1 - utilization) : null;
  return {
    valid: true as const,
    api,
    db,
    cache,
    apiCap,
    dbCap,
    dbDemand,
    readCapacity,
    readReplicas,
    storageLimit,
    capacity,
    completed,
    utilization,
    mean,
    hot: [
      ...(s.rps >= apiCap ? [api.id] : []),
      ...((
        readCapacity
          ? s.rps * writeFraction >= dbCap ||
            s.rps * missFraction >= readCapacity
          : dbDemand >= dbCap
      )
        ? [db.id]
        : []),
    ],
    bottleneck: apiCap <= storageLimit ? 'API service' : 'Database',
    cost: api.replicas * 60 + 180 + (cache ? 45 : 0),
    dbPerRequest,
  };
}
export function queueModel(
  rate: number,
  workers: number,
  perWorker: number,
  seconds: number,
) {
  const capacity = workers * perWorker,
    backlog = Math.max(0, (rate - capacity) * seconds);
  return {
    capacity,
    backlog,
    drainSeconds: capacity ? backlog / capacity : null,
    growth: rate - capacity,
  };
}
export function quorumModel(
  n: number,
  r: number,
  w: number,
  unavailable: number,
) {
  return {
    overlap: r + w > n,
    readAvailable: n - unavailable >= r,
    writeAvailable: n - unavailable >= w,
    remaining: n - unavailable,
  };
}
