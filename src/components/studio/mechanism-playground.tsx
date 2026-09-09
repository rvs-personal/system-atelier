'use client';
import { useState } from 'react';
import Diagram from './diagram';
import type { Design } from '@/lib/studio/model';
const node = (
  id: string,
  name: string,
  kind: Design['nodes'][number]['kind'],
  detail: string,
) => ({ id, name, kind, detail, capacity: 1, replicas: 1 });
const edge = (from: string, to: string, label: string, async = false) => ({
  id: from + to + label,
  from,
  to,
  label,
  async,
});
export default function MechanismPlayground({
  family,
}: {
  family: 'cache' | 'replication' | 'queue' | 'concurrency' | 'latency';
}) {
  const [origin, setOrigin] = useState(100),
    [cached, setCached] = useState<number | null>(null),
    [replica, setReplica] = useState(100),
    [invalidate, setInvalidate] = useState(false),
    [offline, setOffline] = useState(false),
    [queue, setQueue] = useState(120),
    [workers, setWorkers] = useState(2),
    [quota, setQuota] = useState(30),
    [atomic, setAtomic] = useState(false),
    [sold, setSold] = useState(0),
    [load, setLoad] = useState(800),
    [pods, setPods] = useState(1),
    [log, setLog] = useState<string[]>([
      'Choose an action. The values inside the drawing are real state in this exercise.',
    ]),
    [path, setPath] = useState('');
  const record = (s: string) => setLog((l) => [s, ...l].slice(0, 5));
  const d = mechanismDesign(family, {
    origin,
    cached,
    replica,
    invalidate,
    offline,
    queue,
    workers,
    quota,
    atomic,
    sold,
    load,
    pods,
    path,
  });
  return (
    <div className="mechanism-playground">
      <div className="playground-heading">
        <span className="eyebrow">WORKING MODEL · {family.toUpperCase()}</span>
        <p>
          {
            {
              cache:
                'Read the price, update the database, then read again. Watch the two stored values diverge.',
              replication:
                'Commit a write, read the replica, then deliver the replication log. A copy is not automatically current.',
              queue:
                'Increase workers while keeping the provider quota fixed. Which number actually changes?',
              concurrency:
                'Run two buyers against the last seat. Turn on atomic allocation and repeat the same race.',
              latency:
                'Change offered load or pod count. The queue grows when arrivals exceed the serving rate.',
            }[family]
          }
        </p>
      </div>
      <Diagram
        design={d}
        hot={
          family === 'cache' && cached !== null && cached !== origin
            ? ['cache']
            : family === 'replication' && offline
              ? ['primary']
              : family === 'concurrency' && sold > 1
                ? ['result']
                : []
        }
        compact
        legend="Values change with your actions · arrows show the modeled work"
      />
      <div className="playground-actions">
        {family === 'cache' ? (
          <>
            <button
              onClick={() => {
                record(
                  cached === null
                    ? `MISS: API reads $${origin} from the database, fills the cache and returns it.`
                    : `HIT: cache returns $${cached}. Database now contains $${origin}. ${cached !== origin ? 'The customer sees a stale price.' : 'The values agree.'}`,
                );
                if (cached === null) setCached(origin);
                setPath('read');
              }}
            >
              Read price
            </button>
            <button
              onClick={() => {
                setOrigin(origin + 10);
                if (invalidate) setCached(null);
                setPath('write');
                record(
                  `Database changed to $${origin + 10}. ${invalidate ? 'Invalidation cleared the cache.' : 'Cache was not changed; it is a separate copy.'}`,
                );
              }}
            >
              Update database +$10
            </button>
            <button
              onClick={() => {
                setCached(null);
                record(
                  'Cache entry expired or was deleted. The next read must fetch the owner.',
                );
              }}
            >
              Expire cache entry
            </button>
            <label>
              <input
                type="checkbox"
                checked={invalidate}
                onChange={(e) => setInvalidate(e.target.checked)}
              />
              Invalidate on future writes
            </label>
          </>
        ) : family === 'replication' ? (
          <>
            <button
              disabled={offline}
              onClick={() => {
                setOrigin(origin + 1);
                record(
                  `Primary committed v${origin + 1}. The replica still has v${replica}.`,
                );
              }}
            >
              Commit write
            </button>
            <button
              onClick={() =>
                record(
                  `Replica read returns v${replica}; primary last committed v${origin}.`,
                )
              }
            >
              Read replica
            </button>
            <button
              disabled={offline}
              onClick={() => {
                setReplica(origin);
                record(`Replica applied log through v${origin}.`);
              }}
            >
              Deliver replication log
            </button>
            <button
              onClick={() => {
                setOffline(!offline);
                record(
                  offline
                    ? 'Primary is reachable again.'
                    : 'Primary failed. Replica reads continue, but writes cannot silently change owner.',
                );
              }}
            >
              {offline ? 'Restore primary' : 'Fail primary'}
            </button>
          </>
        ) : family === 'queue' ? (
          <>
            <button onClick={() => setWorkers((w) => Math.min(10, w + 1))}>
              Add worker
            </button>
            <button
              disabled={workers <= 1}
              onClick={() => setWorkers((w) => w - 1)}
            >
              Remove worker
            </button>
            <button onClick={() => setQuota((q) => Math.min(500, q + 30))}>
              Negotiate +30/s quota
            </button>
            <button
              onClick={() => {
                const rate = Math.min(workers * 40, quota);
                setQueue((q) => Math.max(0, q + (50 - rate) * 10));
                record(
                  `10 seconds: 500 new jobs, at most ${rate * 10} delivered. Workers allow ${workers * 40}/s; provider allows ${quota}/s.`,
                );
              }}
            >
              Run 10 seconds
            </button>
          </>
        ) : family === 'concurrency' ? (
          <>
            <label>
              <input
                type="checkbox"
                checked={atomic}
                onChange={(e) => setAtomic(e.target.checked)}
              />
              Atomic conditional allocation
            </label>
            <button
              onClick={() => {
                setSold(atomic ? 1 : 2);
                record(
                  atomic
                    ? 'A atomically claims the seat; B receives a conflict. The exact order may reverse, but only one succeeds.'
                    : 'A and B both read available=1 before either writes. Both confirm: two bookings for one seat.',
                );
              }}
            >
              Run simultaneous buyers
            </button>
            <button onClick={() => setSold(0)}>Reset seat</button>
          </>
        ) : (
          <>
            <label>
              Requests/s{' '}
              <input
                type="range"
                min={100}
                max={5000}
                step={100}
                value={load}
                onChange={(e) => setLoad(+e.target.value)}
              />
              {load}
            </label>
            <button onClick={() => setPods((p) => Math.min(8, p + 1))}>
              Add pod
            </button>
            <button disabled={pods <= 1} onClick={() => setPods((p) => p - 1)}>
              Remove pod
            </button>
          </>
        )}
      </div>
      <div className="mechanism-log" aria-live="polite">
        {log.map((s, i) => (
          <p key={i}>
            <span>{i === 0 ? 'LATEST' : 'EARLIER'}</span>
            {s}
          </p>
        ))}
      </div>
      <p className="small">
        Teaching assumptions:{' '}
        {
          {
            cache:
              'single key; immediate invalidation when enabled. Real concurrent refresh/invalidation races require versioning or additional coordination.',
            replication:
              'one-way asynchronous log, no automatic promotion. A production failover also requires fencing and an explicit data-loss policy.',
            queue:
              'fixed-size jobs, quota expressed in attempts/s, no provider failures in this small model. The production lab adds invalid payloads, retries and dead letters.',
            concurrency:
              'two requests sharing one authoritative allocation record. A transaction must enforce the invariant across every real allocation path.',
            latency:
              'uniform 10 ms base service-time proxy and fixed pod capacity; this is not a measured p99 or a scheduler simulation.',
          }[family]
        }
      </p>
    </div>
  );
}

export function mechanismDesign(
  family: string,
  s: {
    origin: number;
    cached: number | null;
    replica: number;
    invalidate: boolean;
    offline: boolean;
    queue: number;
    workers: number;
    quota: number;
    atomic: boolean;
    sold: number;
    load: number;
    pods: number;
    path: string;
  },
): Design {
  const {
    origin,
    cached,
    replica,
    invalidate,
    offline,
    queue,
    workers,
    quota,
    atomic,
    sold,
    load,
    pods,
    path,
  } = s;
  let d: Design = { nodes: [], edges: [] };
  if (family === 'cache') {
    const hit = cached !== null;
    d = {
      nodes: [
        node(
          'client',
          'Shopper',
          'client',
          path === 'read'
            ? `Saw $${hit ? cached : origin}`
            : 'Wants product price',
        ),
        node('api', 'Product API', 'service', 'Chooses cache or origin'),
        node(
          'cache',
          'Price cache',
          'cache',
          hit
            ? `price: $${cached}\n${cached === origin ? 'Fresh' : 'STALE: origin changed'}`
            : 'EMPTY · next read misses',
        ),
        node(
          'db',
          'Product database',
          'database',
          `price: $${origin}\nAuthoritative value`,
        ),
      ],
      edges: [
        edge('client', 'api', 'GET /price'),
        edge('api', 'cache', 'Lookup product:42'),
        ...(hit
          ? [edge('cache', 'api', `HIT → $${cached}`)]
          : [
              edge('api', 'db', 'MISS → read owner'),
              edge('db', 'cache', 'Fill with returned value'),
            ]),
        edge('api', 'client', '200 + price'),
        ...(invalidate ? [edge('db', 'cache', 'Delete on update', true)] : []),
      ],
    };
  }
  if (family === 'replication')
    d = {
      nodes: [
        node('writer', 'Write client', 'client', 'Changes profile'),
        node(
          'primary',
          'Primary owner',
          'database',
          offline ? 'OFFLINE' : `Committed version ${origin}`,
        ),
        node(
          'replica',
          'Async read replica',
          'database',
          `Applied version ${replica}\nLag: ${origin - replica} updates`,
        ),
        node('reader', 'Read client', 'client', `May see version ${replica}`),
      ],
      edges: [
        edge('writer', 'primary', 'Authoritative write'),
        edge(
          'primary',
          'replica',
          offline ? 'Replication stopped' : 'Pending log changes',
          true,
        ),
        edge('reader', 'replica', 'Read nearby copy'),
        edge('replica', 'reader', `Return v${replica}`),
      ],
    };
  if (family === 'queue')
    d = {
      nodes: [
        node('producer', 'Orders', 'service', '50 new jobs each second'),
        node(
          'queue',
          'Pending notifications',
          'queue',
          `${queue} jobs waiting`,
        ),
        node(
          'worker',
          'Delivery workers',
          'worker',
          `${workers} × 40 = ${workers * 40} attempts/s`,
        ),
        node(
          'provider',
          'External provider',
          'service',
          `${quota}/s account quota`,
        ),
        node(
          'customer',
          'Inbox',
          'client',
          `${Math.min(workers * 40, quota)}/s maximum delivery`,
        ),
      ],
      edges: [
        edge('producer', 'queue', 'Enqueue', true),
        edge('queue', 'worker', 'Claim job', true),
        edge('worker', 'provider', 'Send with intent ID'),
        edge('provider', 'customer', 'Accepted delivery'),
      ],
    };
  if (family === 'concurrency')
    d = {
      nodes: [
        node('a', 'Buyer A', 'client', 'Read available = 1'),
        node('b', 'Buyer B', 'client', 'Read available = 1'),
        node(
          'owner',
          'Seat owner',
          'database',
          atomic ? 'Conditional allocation' : 'Read then write separately',
        ),
        node(
          'result',
          'Confirmed bookings',
          'class',
          `${sold} confirmed\n${sold > 1 ? 'INVARIANT VIOLATED' : 'At most one allowed'}`,
        ),
      ],
      edges: [
        edge('a', 'owner', 'Allocate seat 42'),
        edge('b', 'owner', 'Allocate seat 42'),
        edge(
          'owner',
          'result',
          atomic ? 'One wins; other conflicts' : 'Both use stale check',
        ),
      ],
    };
  if (family === 'latency')
    d = {
      nodes: [
        node('arrivals', 'Incoming requests', 'client', `${load} requests/s`),
        node('pool', 'API fleet', 'service', `${pods} pods × 1000/s`),
        node(
          'waiting',
          'Waiting / rejection',
          'queue',
          `${Math.max(0, load - pods * 1000)}/s excess arrivals`,
        ),
        node(
          'result',
          'Response',
          'class',
          load >= pods * 1000
            ? 'Unstable at sustained load'
            : `${Math.round(10 / (1 - load / (pods * 1000)))} ms mean proxy`,
        ),
      ],
      edges: [
        edge('arrivals', 'pool', 'Admit bounded work'),
        edge('pool', 'result', 'Complete requests'),
        edge('arrivals', 'waiting', 'Excess demand'),
      ],
    };
  return d;
}
