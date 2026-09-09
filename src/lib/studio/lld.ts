import type { Design } from './model';
export type LLDTemplate = {
  id: string;
  name: string;
  brief: string;
  invariants: string[];
  design: Design;
  code: string;
};
const model = (
  classes: { name: string; detail: string }[],
  relations: [number, number, string][],
): Design => ({
  nodes: classes.map((c, i) => ({
    id: 'c' + i,
    ...c,
    kind: 'class',
    replicas: 1,
    capacity: 0,
  })),
  edges: relations.map(([a, b, label], i) => ({
    id: 'r' + i,
    from: 'c' + a,
    to: 'c' + b,
    label,
    async: false,
  })),
});
export const lldTemplates: LLDTemplate[] = [
  {
    id: 'lru',
    name: 'LRU cache',
    brief:
      'Design a bounded cache with get and put. Keep lookup and recency updates O(1) on average. Define update, miss, and capacity-zero behavior.',
    invariants: [
      'Every map key has exactly one linked-list node.',
      'Size never exceeds capacity.',
      'A successful get makes that key most recent.',
      'Updating an existing key does not increase size.',
    ],
    design: model(
      [
        {
          name: 'LRUCache<K, V>',
          detail:
            'capacity: number\nentries: Map<K, Node>\nget(key): V | undefined\nput(key, value): void',
        },
        {
          name: 'Node<K, V>',
          detail: 'key: K\nvalue: V\nprev: Node | null\nnext: Node | null',
        },
        {
          name: 'RecencyList',
          detail:
            'head: Node | null\ntail: Node | null\nmoveToFront(node): void\nremoveTail(): Node',
        },
      ],
      [
        [0, 1, 'owns entries'],
        [0, 2, 'maintains recency'],
        [2, 1, 'orders nodes'],
      ],
    ),
    code: 'interface Cache<K, V> {\n  get(key: K): V | undefined;\n  put(key: K, value: V): void;\n}\n\n// Implement with a map and a doubly linked list.\n// Keep all map/list updates inside one critical section\n// if multiple threads can access the same instance.\n// Contract: capacity 0 stores no values.\n',
  },
  {
    id: 'parking',
    name: 'Parking garage',
    brief:
      'Model entry, space assignment, exit, and pricing. Prevent two active sessions from owning the same space and allow pricing rules to change independently.',
    invariants: [
      'A space has at most one active parking session.',
      'Exit time cannot precede entry time.',
      'A completed session cannot exit a second time.',
      'Pricing and payment are separate responsibilities.',
    ],
    design: model(
      [
        {
          name: 'ParkingService',
          detail: 'enter(vehicle): Ticket\nexit(ticketId): Receipt',
        },
        {
          name: 'ParkingSession',
          detail:
            'id: string\nspaceId: string\nenteredAt: Instant\ncomplete(at): void',
        },
        { name: 'PricingPolicy', detail: 'quote(duration): Money' },
        {
          name: 'SpaceRepository',
          detail: 'reserveAtomically(): Space\nrelease(spaceId): void',
        },
      ],
      [
        [0, 1, 'creates'],
        [0, 2, 'depends on'],
        [0, 3, 'depends on'],
      ],
    ),
    code: 'interface PricingPolicy {\n  quote(minutes: number): Money;\n}\ntype Money = { minorUnits: number; currency: string };\n\n// Reserve a space and create the session atomically.\n// Inject time and pricing.\n// Release only after a valid session transition.\n',
  },
  {
    id: 'bucket',
    name: 'Token bucket limiter',
    brief:
      'Allow a bounded burst with a continuous refill rate. Inject a monotonic clock and make check-and-consume atomic for each client key.',
    invariants: [
      'Tokens remain between zero and bucket capacity.',
      'A rejected request consumes no tokens.',
      'Refill cannot exceed capacity.',
      'Concurrent requests cannot spend the same token.',
    ],
    design: model(
      [
        { name: 'RateLimiter', detail: 'allow(clientId): Decision' },
        {
          name: 'TokenBucket',
          detail:
            'capacity: number\ntokens: number\nlastRefill: number\ntryConsume(now): boolean',
        },
        { name: 'MonotonicClock', detail: 'now(): number' },
        { name: 'BucketStore', detail: 'atomicUpdate(key, fn): Decision' },
      ],
      [
        [0, 2, 'reads time'],
        [0, 3, 'updates atomically'],
        [3, 1, 'stores per client'],
      ],
    ),
    code: 'type Decision = { allowed: boolean; retryAfterMs: number };\ninterface Clock { now(): number }\n\n// Refill: min(capacity, tokens + elapsed * rate).\n// Clamp elapsed to nonnegative.\n// Atomically consume only if tokens >= 1.\n// A process-local map does not enforce a global limit.\n',
  },
  {
    id: 'order',
    name: 'Order state machine',
    brief:
      'Separate order lifecycle, payment integration, and persistence. Permit only valid transitions and make repeated commands safe.',
    invariants: [
      'A shipped order cannot return directly to pending.',
      'Only a paid order may ship.',
      'A cancelled order cannot ship.',
      'Repeated commands do not duplicate external effects.',
    ],
    design: model(
      [
        {
          name: 'Order',
          detail:
            'id: string\nstate: OrderState\npay(): void\nship(): void\ncancel(): void',
        },
        { name: 'PaymentGateway', detail: 'charge(key, money): Result' },
        {
          name: 'OrderRepository',
          detail: 'saveIfVersion(order, version): boolean',
        },
        { name: 'CheckoutService', detail: 'checkout(command): Order' },
      ],
      [
        [3, 0, 'orchestrates'],
        [3, 1, 'uses idempotency key'],
        [3, 2, 'persists'],
        [2, 0, 'stores'],
      ],
    ),
    code: "type OrderState = 'pending' | 'paid' | 'shipped' | 'cancelled';\nconst transitions: Record<OrderState, OrderState[]> = {\n  pending: ['paid', 'cancelled'],\n  paid: ['shipped', 'cancelled'],\n  shipped: [],\n  cancelled: [],\n};\n// A paid cancellation may require a refund workflow.\n// Save state with a version check.\n",
  },
];
export type CacheState = { capacity: number; entries: [string, string][] };
export function cachePut(
  s: CacheState,
  key: string,
  value: string,
): CacheState {
  return {
    ...s,
    entries:
      s.capacity === 0
        ? []
        : ([[key, value], ...s.entries.filter(([k]) => k !== key)].slice(
            0,
            s.capacity,
          ) as [string, string][]),
  };
}
export function cacheGet(
  s: CacheState,
  key: string,
): { state: CacheState; value: string | undefined } {
  const item = s.entries.find(([k]) => k === key);
  return {
    state: item
      ? { ...s, entries: [item, ...s.entries.filter(([k]) => k !== key)] }
      : s,
    value: item?.[1],
  };
}
export function consumeToken(
  tokens: number,
  capacity: number,
  rate: number,
  elapsed: number,
) {
  const refill = Math.min(
    capacity,
    Math.max(0, tokens) + Math.max(0, elapsed) * rate,
  );
  return { allowed: refill >= 1, tokens: refill >= 1 ? refill - 1 : refill };
}
export function transitionOrder(from: string, to: string) {
  const transitions: Record<string, string[]> = {
    pending: ['paid', 'cancelled'],
    paid: ['shipped', 'cancelled'],
    shipped: [],
    cancelled: [],
  };
  return {
    valid: !!transitions[from]?.includes(to),
    state: transitions[from]?.includes(to) ? to : from,
  };
}
export function reviewModel(d: Design) {
  return [
    {
      pass: d.nodes.length >= 2,
      detail: 'At least two responsibilities are represented.',
    },
    {
      pass: d.nodes.every(
        (n) => n.name.trim().length > 0 && n.detail.trim().length > 0,
      ),
      detail: 'Every component has a name and an explicit contract.',
    },
    {
      pass: d.nodes.every((n) =>
        d.edges.some((e) => e.from === n.id || e.to === n.id),
      ),
      detail: 'Every component participates in a relationship.',
    },
    {
      pass: new Set(d.nodes.map((n) => n.name.trim())).size === d.nodes.length,
      detail: 'Component names are unique.',
    },
    {
      pass: d.edges.every((e) => e.label.trim().length > 0),
      detail: 'Every relationship has a stated meaning.',
    },
  ];
}

export function parkingEnter(spaces: boolean[]) {
  const index = spaces.indexOf(false);
  return {
    accepted: index >= 0,
    index,
    spaces:
      index >= 0 ? spaces.map((v, i) => (i === index ? true : v)) : spaces,
  };
}
export function parkingExit(spaces: boolean[], index: number) {
  const accepted = index >= 0 && index < spaces.length && spaces[index];
  return {
    accepted,
    spaces: accepted ? spaces.map((v, i) => (i === index ? false : v)) : spaces,
  };
}
