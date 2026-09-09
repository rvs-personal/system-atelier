import type { Design, DesignNode, NodeKind } from './model';
export type CanvasAction = 'plus' | 'minus' | 'remove';
export function changeNode(
  d: Design,
  id: string,
  action: CanvasAction,
): Design {
  const n = d.nodes.find((n) => n.id === id);
  if (!n) return d;
  if (action === 'remove')
    return {
      nodes: d.nodes.filter((n) => n.id !== id),
      edges: d.edges.filter((e) => e.from !== id && e.to !== id),
    };
  return {
    ...d,
    nodes: d.nodes.map((n) =>
      n.id === id
        ? {
            ...n,
            replicas: Math.max(
              1,
              Math.min(100, n.replicas + (action === 'plus' ? 1 : -1)),
            ),
          }
        : n,
    ),
  };
}
export function installComponent(
  d: Design,
  kind: NodeKind | 'read-replica',
): Design {
  const k = kind === 'read-replica' ? 'database' : kind,
    existing = d.nodes.find(
      (n) =>
        n.kind === k &&
        (kind === 'read-replica'
          ? n.role === 'read-replica'
          : n.role !== 'read-replica'),
    );
  if (existing) return changeNode(d, existing.id, 'plus');
  if (d.nodes.length >= 24) return d;
  const n: DesignNode = {
    id: crypto.randomUUID(),
    kind: k,
    name:
      kind === 'read-replica'
        ? 'Database read replicas'
        : {
            service: 'API pods',
            worker: 'Notification workers',
            database: 'Primary database',
            balancer: 'Ingress gateway',
            cache: 'Read cache',
            queue: 'Notification queue',
            client: 'Clients',
            class: 'New class',
          }[k],
    detail:
      kind === 'read-replica'
        ? 'Async copies · reads only'
        : {
            service: 'Stateless request handling',
            worker: 'Consume and acknowledge jobs',
            database: 'Authoritative writes',
            balancer: 'Route to healthy API pods',
            cache: 'Cache-aside · derived values',
            queue: 'Durable pending jobs',
            client: 'Browser / mobile',
            class: 'Define a contract',
          }[k],
    capacity:
      k === 'service'
        ? 2000
        : k === 'worker'
          ? 200
          : k === 'cache'
            ? 10000
            : 1000,
    replicas: 1,
    ...(kind === 'read-replica' ? { role: 'read-replica' as const } : {}),
  };
  const nodes = [...d.nodes, n],
    edges = [...d.edges],
    find = (k: NodeKind) =>
      nodes.find((x) => x.kind === k && x.role !== 'read-replica');
  const link = (
    a: DesignNode | undefined,
    b: DesignNode | undefined,
    label: string,
    async = false,
  ) => {
    if (a && b && !edges.some((e) => e.from === a.id && e.to === b.id))
      edges.push({
        id: crypto.randomUUID(),
        from: a.id,
        to: b.id,
        label,
        async,
      });
  };
  const api = find('service'),
    db = find('database'),
    cache = find('cache'),
    queue = find('queue'),
    lb = find('balancer'),
    client = find('client'),
    worker = find('worker');
  if (kind === 'read-replica') {
    link(db, n, 'Replicate changes', true);
    link(api, n, 'Read query');
  } else if (k === 'service' || k === 'client' || k === 'balancer') {
    link(client, lb ?? api, 'HTTPS');
    link(lb, api, 'Route request');
    link(api, db, 'Authoritative read / write');
    link(api, cache, 'Read lookup');
    link(api, queue, 'Publish notification', true);
  } else if (k === 'cache') {
    link(api, n, 'Read lookup');
    link(n, db, 'Miss → fetch');
  } else if (k === 'database') {
    link(api, n, 'Authoritative read / write');
    link(cache, n, 'Miss → fetch');
  }
  if (k === 'queue' || k === 'worker') {
    link(api, queue, 'Publish notification', true);
    link(queue, worker, 'Deliver / ack', true);
  }
  return { nodes, edges };
}
