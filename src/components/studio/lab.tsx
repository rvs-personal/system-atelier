'use client';
import { useEffect, useState } from 'react';
import {
  Activity,
  ArrowRight,
  Zap,
  FlaskConical,
  RotateCcw,
} from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import {
  initialDesign,
  simulate,
  queueModel,
  quorumModel,
} from '@/lib/studio/model';
import { useCloud, download } from '@/lib/studio/storage';
import { CloudStatus, PageTitle, Range, ExportButton } from './shared';
import Editor from './editor';
import Operations from './operations';
import ExperimentStory from './experiment-story';
export default function Lab() {
  const cloud = useCloud('architecture', {
    design: initialDesign,
    settings: { rps: 1500, reads: 90, hit: 90, failed: false },
    queue: { rate: 800, workers: 3, perWorker: 200, seconds: 60 },
    quorum: { n: 3, r: 2, w: 2, unavailable: 0 },
    estimate: {
      users: 1000000,
      reads: 20,
      writes: 2,
      kb: 2,
      days: 30,
      peak: 5,
    },
    notes: '',
  });
  const d = cloud.data,
    s = d.settings,
    result = simulate(d.design, s),
    q = queueModel(
      d.queue.rate,
      d.queue.workers,
      d.queue.perWorker,
      d.queue.seconds,
    ),
    qu = quorumModel(d.quorum.n, d.quorum.r, d.quorum.w, d.quorum.unavailable);
  const [tab, setTab] = useState('production');
  useEffect(() => {
    const sync = () => {
      const [area, target] = location.hash.slice(1).split('/');
      if (area === 'lab')
        setTab(
          ['load', 'queue', 'quorum', 'estimate'].includes(target)
            ? target
            : 'production',
        );
    };
    sync();
    window.addEventListener('hashchange', sync);
    return () => window.removeEventListener('hashchange', sync);
  }, []);
  function openTab(value: string) {
    setTab(value);
    location.hash = value === 'production' ? 'lab' : 'lab/' + value;
  }
  const setting = (key: string, v: number | boolean) =>
    cloud.setData((d) => ({ ...d, settings: { ...d.settings, [key]: v } }));
  function cache() {
    if (d.design.nodes.some((n) => n.kind === 'cache')) return;
    const api = d.design.nodes.find((n) => n.kind === 'service'),
      db = d.design.nodes.find((n) => n.kind === 'database');
    if (!api || !db) return;
    const id = crypto.randomUUID();
    cloud.setData((d) => ({
      ...d,
      design: {
        nodes: [
          ...d.design.nodes,
          {
            id,
            name: 'Read cache',
            kind: 'cache',
            detail: 'Cache-aside · bounded TTL',
            replicas: 1,
            capacity: 100000,
          },
        ],
        edges: [
          ...d.design.edges,
          {
            id: crypto.randomUUID(),
            from: api.id,
            to: id,
            label: 'Read lookup',
            async: false,
          },
          {
            id: crypto.randomUUID(),
            from: id,
            to: db.id,
            label: 'Miss / populate',
            async: false,
          },
        ],
      },
    }));
  }
  return (
    <>
      <div className="lab-page-heading">
        <PageTitle
          kicker="PRACTICE / PRODUCTION SYSTEMS"
          title="Architecture lab"
          description="Investigate the evidence, change the system, and verify recovery."
        />
        <label className="lab-experiment-picker">
          <span>Workspace</span>
          <select
            aria-label="Focused experiment"
            value={tab}
            onChange={(e) => openTab(e.target.value)}
          >
            <option value="production">On-call incidents</option>
            <option value="load">Request capacity & cache</option>
            <option value="queue">Queue arithmetic</option>
            <option value="quorum">Quorum thresholds</option>
            <option value="estimate">Launch estimates</option>
          </select>
        </label>
      </div>
      <CloudStatus {...cloud} />
      <fieldset disabled={!cloud.ready}>
        <Tabs value={tab} onValueChange={(v) => openTab(String(v))}>
          <TabsContent value="production" keepMounted>
            <Operations />
          </TabsContent>
          <TabsContent value="load">
            <ExperimentStory
              title="The product page is slow. Will adding servers help?"
              customer="A shopper opens a product. The API reads its price from the database before returning the page. At 1,500 requests per second, a 1,000-operations/s database cannot serve every request."
              why="Find the actual bottleneck before paying for more API servers. RPS means requests per second; a cache hit avoids a database read, but writes still reach storage."
              steps={[
                {
                  name: 'Reproduce the slowdown',
                  action: () =>
                    cloud.setData((d) => ({
                      ...d,
                      design: structuredClone(initialDesign),
                      settings: {
                        rps: 1500,
                        reads: 90,
                        hit: 90,
                        failed: false,
                      },
                    })),
                  observe:
                    'The two API replicas can handle 4,000/s, but every request reaches a database capped at 1,000/s. About 500 requests/s exceed capacity. The database is the bottleneck.',
                },
                {
                  name: 'Add only API servers',
                  action: () =>
                    cloud.setData((d) => ({
                      ...d,
                      design: {
                        ...structuredClone(initialDesign),
                        nodes: initialDesign.nodes.map((n) =>
                          n.kind === 'service' ? { ...n, replicas: 4 } : n,
                        ),
                      },
                      settings: {
                        rps: 1500,
                        reads: 90,
                        hit: 90,
                        failed: false,
                      },
                    })),
                  observe:
                    'API capacity doubled, but database capacity did not. Completed throughput stays capped at 1,000/s while the bill rises by $120/month. More boxes did not solve the constraint.',
                },
                {
                  name: 'Try a read cache',
                  action: () => {
                    cloud.setData((d) => ({
                      ...d,
                      design: {
                        nodes: [
                          ...structuredClone(initialDesign.nodes),
                          {
                            id: 'story-cache',
                            name: 'Product cache',
                            kind: 'cache',
                            detail: 'Cached product reads',
                            replicas: 1,
                            capacity: 10000,
                          },
                        ],
                        edges: [
                          ...structuredClone(initialDesign.edges),
                          {
                            id: 'story-ac',
                            from: 'api',
                            to: 'story-cache',
                            label: 'Lookup',
                            async: false,
                          },
                          {
                            id: 'story-cd',
                            from: 'story-cache',
                            to: 'db',
                            label: 'Miss',
                            async: false,
                          },
                        ],
                      },
                      settings: {
                        rps: 1500,
                        reads: 90,
                        hit: 90,
                        failed: false,
                      },
                    }));
                  },
                  observe:
                    '1,500 × (1 − 0.90 reads × 0.90 hits) = 285 database operations/s. The database now has headroom. Lower the hit-rate slider to zero to see what a cold cache would do.',
                },
              ]}
              consequence="Caching reduces database work but introduces stale reads and invalidation. A larger database handles uncached work more directly, at a recurring cost."
            />
            <div className="lab-layout">
              <div>
                <Editor
                  design={d.design}
                  onChange={(design) =>
                    cloud.setData((d) => ({ ...d, design }))
                  }
                  hot={result.valid ? result.hot : []}
                />
                <div className="assumptions">
                  <FlaskConical size={19} />
                  <div>
                    <strong>A transparent teaching model</strong>
                    <p>
                      Models the first connected client → service → database
                      path. One database operation per request; a connected
                      cache serves the chosen fraction of reads. Database
                      replicas, other services, network limits, and cache
                      saturation are not modeled. Latency is an illustrative
                      mean queueing proxy, not a measured percentile. Costs use
                      fictional monthly rates: $60/API replica, $180/database,
                      $45/cache.
                    </p>
                  </div>
                </div>
              </div>
              <aside className="control-panel">
                <div className="panel-title">
                  <Activity size={18} />
                  <h3>Traffic controls</h3>
                </div>
                <Range
                  label="Incoming requests"
                  value={s.rps}
                  min={100}
                  max={20000}
                  step={100}
                  unit=" /s"
                  onChange={(v) => setting('rps', v)}
                />
                <Range
                  label="Read traffic"
                  value={s.reads}
                  max={100}
                  unit="%"
                  onChange={(v) => setting('reads', v)}
                />
                <Range
                  label="Read cache hit rate"
                  value={s.hit}
                  max={99}
                  unit="%"
                  onChange={(v) => setting('hit', v)}
                />
                <p className="small">
                  Hit rate applies only when a cache connects the service to the
                  database.
                </p>
                <button
                  className="secondary wide"
                  disabled={
                    d.design.nodes.some((n) => n.kind === 'cache') ||
                    !d.design.nodes.some((n) => n.kind === 'database')
                  }
                  onClick={cache}
                >
                  <Zap size={16} />
                  Add a connected read cache
                </button>
                <label className="switch-row">
                  <Switch
                    checked={s.failed}
                    onCheckedChange={(v) => setting('failed', v)}
                  />
                  Take one API replica offline
                </label>
                {result.valid ? (
                  <>
                    <div
                      className={
                        'system-health ' +
                        (result.utilization >= 1 ? 'warning' : '')
                      }
                    >
                      <span>
                        {result.utilization >= 1
                          ? 'Capacity exceeded'
                          : 'Within modeled capacity'}
                      </span>
                      <strong>{result.bottleneck}</strong>
                      <p>is the limiting resource</p>
                    </div>
                    <div className="metric-grid">
                      <div>
                        <span>DB demand</span>
                        <strong>
                          {Math.round(result.dbDemand).toLocaleString()}
                          <small> ops/s</small>
                        </strong>
                      </div>
                      <div>
                        <span>Completed</span>
                        <strong>
                          {Math.round(result.completed).toLocaleString()}
                          <small> /s</small>
                        </strong>
                      </div>
                      <div>
                        <span>Mean latency proxy</span>
                        <strong>
                          {result.mean === null
                            ? 'Unbounded'
                            : Math.round(result.mean)}
                          <small>{result.mean !== null ? ' ms' : ''}</small>
                        </strong>
                      </div>
                      <div>
                        <span>Illustrative cost</span>
                        <strong>
                          ${result.cost}
                          <small> /mo</small>
                        </strong>
                      </div>
                    </div>
                    <div className="feedback">
                      <strong>Read the result</strong>
                      <p>
                        {result.utilization >= 1
                          ? `Demand meets or exceeds ${result.bottleneck.toLowerCase()} capacity. A steady-state queue cannot drain; add capacity, reduce work, or reject excess traffic.`
                          : `There is headroom in this simplified model. Now test a node failure or a lower cache hit rate before trusting the design.`}
                      </p>
                    </div>
                  </>
                ) : (
                  <div className="feedback amber">
                    <p>{result.reason}</p>
                  </div>
                )}
              </aside>
            </div>
          </TabsContent>
          <TabsContent value="queue">
            <ExperimentStory
              title="Checkout works. Why has the confirmation not arrived?"
              customer="A sale produces confirmation-email jobs. The customer sees “order placed” immediately, but workers must still send the message. Accepted and delivered are different promises."
              why="Choose how much delivery capacity to buy and how much waiting customers can tolerate. A queue holds unfinished jobs; workers consume them."
              steps={[
                {
                  name: 'Run a one-minute sale',
                  action: () =>
                    cloud.setData((d) => ({
                      ...d,
                      queue: {
                        rate: 800,
                        workers: 3,
                        perWorker: 200,
                        seconds: 60,
                      },
                    })),
                  observe:
                    '800 jobs arrive each second; 3 × 200 = 600 finish. The remaining 200/s accumulate: 12,000 jobs after 60 seconds. If arrivals stop, draining them takes 20 seconds.',
                },
                {
                  name: 'Match the arrival rate',
                  action: () =>
                    cloud.setData((d) => ({
                      ...d,
                      queue: {
                        rate: 800,
                        workers: 4,
                        perWorker: 200,
                        seconds: 60,
                      },
                    })),
                  observe:
                    '4 × 200 = 800/s, so this empty-queue model stops accumulating work. It has no spare capacity to drain an existing backlog or survive a worker loss.',
                },
                {
                  name: 'Buy failure headroom',
                  action: () =>
                    cloud.setData((d) => ({
                      ...d,
                      queue: {
                        rate: 800,
                        workers: 5,
                        perWorker: 200,
                        seconds: 60,
                      },
                    })),
                  observe:
                    '1,000/s capacity exceeds 800/s demand by 200/s. Losing one worker still leaves 800/s. Five workers cost more, and a real email provider may throttle them.',
                },
              ]}
              consequence="More workers reduce waiting but cost money and can overwhelm downstream providers. Buffering is cheaper during short bursts, but customers wait longer."
            />
            <div className="experiment-layout">
              <div className="experiment-visual">
                <span className="eyebrow green">
                  BURSTS HAVE TO GO SOMEWHERE
                </span>
                <h2>Follow the unfinished work.</h2>
                <div className="queue-flow">
                  <div>
                    <span>Produce</span>
                    <strong>{d.queue.rate}/s</strong>
                  </div>
                  <ArrowRight />
                  <div
                    className={
                      q.growth > 0
                        ? 'queue-backlog overloaded'
                        : 'queue-backlog'
                    }
                  >
                    <span>Waiting after {d.queue.seconds}s</span>
                    <strong>{q.backlog.toLocaleString()}</strong>
                    <small>jobs</small>
                  </div>
                  <ArrowRight />
                  <div>
                    <span>Consume</span>
                    <strong>{q.capacity}/s</strong>
                  </div>
                </div>
                <div className="feedback">
                  <strong>
                    {q.growth > 0
                      ? 'Your backlog is growing.'
                      : 'Consumers can keep up.'}
                  </strong>
                  <p>
                    {q.growth > 0
                      ? `${q.growth} additional jobs wait every second. If producers stop, this backlog takes about ${q.drainSeconds?.toFixed(1)} seconds to drain at the same worker capacity.`
                      : 'The fluid model predicts no accumulated backlog. Real arrivals and service times vary, so reserve headroom.'}
                  </p>
                </div>
                <p className="small">
                  Deterministic fluid model: empty initial queue, constant
                  arrival/service rates, no retries or scheduling overhead.
                  Backlog = max(0, arrival − capacity) × duration.
                </p>
              </div>
              <aside className="control-panel">
                {[
                  ['rate', 'Arrival rate', 0, 4000, 50, ' /s'],
                  ['workers', 'Worker count', 1, 16, 1, ''],
                  ['perWorker', 'Each worker processes', 10, 1000, 10, ' /s'],
                  ['seconds', 'Burst duration', 10, 600, 10, 's'],
                ].map(([key, label, min, max, step, unit]) => (
                  <Range
                    key={key}
                    label={String(label)}
                    value={d.queue[key as keyof typeof d.queue]}
                    min={Number(min)}
                    max={Number(max)}
                    step={Number(step)}
                    unit={String(unit)}
                    onChange={(v) =>
                      cloud.setData((d) => ({
                        ...d,
                        queue: { ...d.queue, [key]: v },
                      }))
                    }
                  />
                ))}
                <div className="prompt-box">
                  <h3>Interviewer follow-up</h3>
                  <p>
                    Where do you reject work when the queue fills? What happens
                    to a job that always crashes the worker?
                  </p>
                </div>
              </aside>
            </div>
          </TabsContent>
          <TabsContent value="quorum">
            <ExperimentStory
              title="One data replica disappears. Can a shopping cart still save?"
              customer="A replicated cart store keeps three copies. A write waits for W acknowledgments and a read waits for R responses. Network failures make some copies unreachable from this client."
              why="Compare the availability of reads and writes as you change response thresholds. N is total copies; R and W are required responses, not the number of servers you own."
              steps={[
                {
                  name: 'Lose one of three copies',
                  action: () =>
                    cloud.setData((d) => ({
                      ...d,
                      quorum: { n: 3, r: 2, w: 2, unavailable: 1 },
                    })),
                  observe:
                    'Two replicas remain reachable. Both the read and write thresholds of two can be met. R + W = 4 > 3, so every read/write quorum intersects for this fixed set.',
                },
                {
                  name: 'Lose a second copy',
                  action: () =>
                    cloud.setData((d) => ({
                      ...d,
                      quorum: { n: 3, r: 2, w: 2, unavailable: 2 },
                    })),
                  observe:
                    'Only one replica can answer, so both operations fail their threshold. Having a surviving server does not imply the protocol can complete an operation.',
                },
                {
                  name: 'Allow a single read',
                  action: () =>
                    cloud.setData((d) => ({
                      ...d,
                      quorum: { n: 3, r: 1, w: 2, unavailable: 2 },
                    })),
                  observe:
                    'A read can now complete, but writes still cannot. R + W = N gives no guaranteed intersection; the one readable copy may miss an acknowledged write. Whether this is acceptable depends on the cart contract.',
                },
              ]}
              consequence="Lower thresholds can improve availability while weakening overlap guarantees. Strong correctness requires an appropriate protocol; counts alone cannot promise it. Do not apply this toy cart policy blindly to payments or inventory."
            />
            <div className="experiment-layout">
              <div className="experiment-visual">
                <span className="eyebrow green">
                  AVAILABILITY HAS CONDITIONS
                </span>
                <h2>Responses the client can collect.</h2>
                <div className="replica-grid">
                  {Array.from({ length: d.quorum.n }, (_, i) => (
                    <div
                      className={
                        'replica ' + (i < d.quorum.unavailable ? 'offline' : '')
                      }
                      key={i}
                    >
                      <LayersIcon />
                      <strong>Replica {i + 1}</strong>
                      <span>
                        {i < d.quorum.unavailable ? 'Unreachable' : 'Reachable'}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="metric-grid">
                  <div>
                    <span>Read threshold</span>
                    <strong>
                      {qu.readAvailable ? 'Available' : 'Unavailable'}
                    </strong>
                  </div>
                  <div>
                    <span>Write threshold</span>
                    <strong>
                      {qu.writeAvailable ? 'Available' : 'Unavailable'}
                    </strong>
                  </div>
                  <div>
                    <span>R + W &gt; N</span>
                    <strong>{qu.overlap ? 'Overlaps' : 'No guarantee'}</strong>
                  </div>
                  <div>
                    <span>Reachable nodes</span>
                    <strong>
                      {qu.remaining} / {d.quorum.n}
                    </strong>
                  </div>
                </div>
                <div className="feedback amber">
                  <strong>Overlap is not a consistency proof.</strong>
                  <p>
                    This model checks only quorum counts for a fixed replica
                    set. Linearizability also depends on protocol, version
                    ordering, concurrent writes, membership changes, and
                    recovery. Unreachable replicas are assumed unavailable to
                    this client.
                  </p>
                </div>
              </div>
              <aside className="control-panel">
                <Range
                  label="Replicas (N)"
                  value={d.quorum.n}
                  min={1}
                  max={9}
                  onChange={(n) =>
                    cloud.setData((d) => ({
                      ...d,
                      quorum: {
                        n,
                        r: Math.min(d.quorum.r, n),
                        w: Math.min(d.quorum.w, n),
                        unavailable: Math.min(d.quorum.unavailable, n),
                      },
                    }))
                  }
                />
                {[
                  ['r', 'Read acknowledgments (R)'],
                  ['w', 'Write acknowledgments (W)'],
                  ['unavailable', 'Unreachable replicas'],
                ].map(([key, label]) => (
                  <Range
                    key={key}
                    label={label}
                    value={d.quorum[key as keyof typeof d.quorum]}
                    min={key === 'unavailable' ? 0 : 1}
                    max={d.quorum.n}
                    onChange={(v) =>
                      cloud.setData((d) => ({
                        ...d,
                        quorum: { ...d.quorum, [key]: v },
                      }))
                    }
                  />
                ))}
                <div className="prompt-box">
                  <h3>Try this</h3>
                  <p>
                    Use N=3, R=2, W=2. Lose one node, then two. Explain what the
                    client can still do.
                  </p>
                </div>
              </aside>
            </div>
          </TabsContent>
          <TabsContent value="estimate">
            <ExperimentStory
              title="A million people are coming. What should we provision?"
              customer="You are launching a photo-feed app. Each daily user reads 20 times and creates 2 records of 2 KB each. The team must size serving capacity and 30 days of retained metadata before launch."
              why="Translate a product forecast into requests per second and retained bytes. Daily users alone do not tell you how many servers to buy. This estimate covers record metadata, not photo blobs."
              steps={[
                {
                  name: 'Load the launch forecast',
                  action: () =>
                    cloud.setData((d) => ({
                      ...d,
                      estimate: {
                        users: 1000000,
                        reads: 20,
                        writes: 2,
                        kb: 2,
                        days: 30,
                        peak: 5,
                      },
                    })),
                  observe:
                    '20 million reads / 86,400 seconds ≈ 231 average reads/s. A 5× peak requires about 1,157 reads/s. Two million daily writes × 2 KB × 30 days = 120 GB of logical metadata.',
                },
                {
                  name: 'A campaign doubles users',
                  action: () =>
                    cloud.setData((d) => ({
                      ...d,
                      estimate: {
                        users: 2000000,
                        reads: 20,
                        writes: 2,
                        kb: 2,
                        days: 30,
                        peak: 5,
                      },
                    })),
                  observe:
                    'Both serving demand and storage double: about 2,315 peak reads/s and 240 GB. If one measured replica sustained 1,000 reads/s, three are a throughput floor; failure headroom and latency still need testing.',
                },
                {
                  name: 'Keep data for a year',
                  action: () =>
                    cloud.setData((d) => ({
                      ...d,
                      estimate: {
                        users: 1000000,
                        reads: 20,
                        writes: 2,
                        kb: 2,
                        days: 365,
                        peak: 5,
                      },
                    })),
                  observe:
                    'Retention increases logical storage to 1,460 GB while request rates stay unchanged. Three full copies alone would need 4,380 GB, before indexes and backups. Retention and traffic are different cost drivers.',
                },
              ]}
              consequence="Provisioning for peaks protects response time but leaves idle capacity. Shorter retention saves storage but changes the product promise. Validate forecasts and benchmark the actual request mix before sizing servers."
            />
            <div className="experiment-layout">
              <div className="experiment-visual">
                <span className="eyebrow green">KEEP THE UNITS VISIBLE</span>
                <h2>Your forecast, converted to capacity.</h2>
                <div className="metric-grid large-metrics">
                  <div>
                    <span>Average reads</span>
                    <strong>
                      {Math.round(
                        (d.estimate.users * d.estimate.reads) / 86400,
                      ).toLocaleString()}
                      <small> /s</small>
                    </strong>
                  </div>
                  <div>
                    <span>Peak reads</span>
                    <strong>
                      {Math.round(
                        (d.estimate.users *
                          d.estimate.reads *
                          d.estimate.peak) /
                          86400,
                      ).toLocaleString()}
                      <small> /s</small>
                    </strong>
                  </div>
                  <div>
                    <span>Average writes</span>
                    <strong>
                      {Math.round(
                        (d.estimate.users * d.estimate.writes) / 86400,
                      ).toLocaleString()}
                      <small> /s</small>
                    </strong>
                  </div>
                  <div>
                    <span>Logical storage</span>
                    <strong>
                      {(
                        (d.estimate.users *
                          d.estimate.writes *
                          d.estimate.kb *
                          d.estimate.days) /
                        1000000
                      ).toLocaleString()}
                      <small> GB</small>
                    </strong>
                  </div>
                </div>
                <div className="feedback">
                  <strong>Units and exclusions</strong>
                  <p>
                    Daily active users × operations per user ÷ 86,400 gives
                    average operations/s. Storage uses decimal KB/GB and fixed
                    retention. Add replicas, indexes, backups, metadata, egress,
                    and headroom separately. Peak factor is your assumption, not
                    a measured forecast.
                  </p>
                </div>
              </div>
              <aside className="control-panel">
                {[
                  ['users', 'Daily active users', 1000, 100000000],
                  ['reads', 'Reads / user / day', 0, 10000],
                  ['writes', 'Writes / user / day', 0, 10000],
                  ['kb', 'Record size (KB)', 0.1, 10000],
                  ['days', 'Retention (days)', 1, 3650],
                  ['peak', 'Peak multiplier', 1, 100],
                ].map(([key, label, min, max]) => (
                  <label className="field" key={key}>
                    <span>{label}</span>
                    <input
                      type="number"
                      min={min}
                      max={max}
                      step="any"
                      value={d.estimate[key as keyof typeof d.estimate]}
                      onChange={(e) =>
                        cloud.setData((d) => ({
                          ...d,
                          estimate: {
                            ...d.estimate,
                            [key]: Math.max(
                              Number(min),
                              Math.min(
                                Number(max),
                                Number(e.target.value) || 0,
                              ),
                            ),
                          },
                        }))
                      }
                    />
                  </label>
                ))}
              </aside>
            </div>
          </TabsContent>
        </Tabs>
      </fieldset>
    </>
  );
}
function LayersIcon() {
  return <Activity size={27} />;
}
