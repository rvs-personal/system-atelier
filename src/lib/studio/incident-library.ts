import type { OpsState, Incident, OpsConfig } from './operations';
export type ResponseAction = {
  title: string;
  detail: string;
  clear?: string[];
  add?: string[];
  cost?: number;
};
export type IncidentDossier = {
  category: string;
  severity: string;
  fault: string;
  load: number;
  timeline: string[];
  evidence: [string, string, string][];
  cause: string;
  actions: ResponseAction[];
  verification: string;
  alternatives: [string, string];
};
const dossier = (
  category: string,
  fault: string,
  cause: string,
  timeline: string[],
  evidence: [string, string, string][],
  actions: ResponseAction[],
  verification: string,
  alternatives: [string, string],
  load = 1000,
): IncidentDossier => ({
  category,
  severity: 'SEV 2',
  fault,
  load,
  cause,
  timeline,
  evidence,
  actions,
  verification,
  alternatives,
});
export const extraDossiers: IncidentDossier[] = [
  dossier(
    'Application',
    'pool_leak',
    'The new error path returns before releasing a database connection. The connection pool reaches its limit even though database CPU has spare capacity.',
    [
      '09:00 release starts on 10% of pods',
      '09:04 connection wait rises before query duration changes',
      '09:09 checkout timeouts spread as the pool is exhausted',
    ],
    [
      ['Connection pool', '198 / 200 borrowed', '40 / 200'],
      ['Pool wait p95', '1,800 ms', '4 ms'],
      ['Database CPU', '28%', '27%'],
    ],
    [
      {
        title: 'Roll back the leaking release',
        detail:
          'Stop creating leaked connections; replace the affected processes to release their pools.',
        clear: ['pool_leak'],
      },
      {
        title: 'Patch cleanup and recycle affected pods',
        detail:
          'Use guaranteed cleanup on success, timeout and exception. Recycling without the patch only buys time.',
        clear: ['pool_leak'],
        cost: 60,
      },
      {
        title: 'Add more API pods',
        detail:
          'Each pod opens another pool. The leak remains and aggregate database pressure increases.',
        add: ['connection_pressure'],
        cost: 120,
      },
    ],
    'Pool wait returns to baseline under timeout and exception tests; all requests release their connection.',
    [
      'Rollback is quick but defers the feature.',
      'A targeted fix preserves the feature but needs proof across every exit path.',
    ],
  ),
  dossier(
    'Resilience',
    'retry_storm',
    'Three call layers each retry the same slow dependency. Attempt volume rises faster than useful traffic, keeping the dependency overloaded.',
    [
      '14:20 provider latency rises',
      '14:21 client, API and worker retries overlap',
      '14:24 dependency attempts reach 3× useful demand',
    ],
    [
      ['Useful arrivals', '1,000/s', '1,000/s'],
      ['Downstream attempts', '3,000/s', '1,000/s'],
      ['Timeout ratio', '67%', '0.1%'],
    ],
    [
      {
        title: 'Apply one bounded retry budget',
        detail:
          'Retry at one owner with backoff and jitter; preserve the original operation identity.',
        clear: ['retry_storm'],
      },
      {
        title: 'Open the breaker and reconcile queued intents',
        detail:
          'Contain calls while the dependency recovers; replay only safe, identified intents.',
        clear: ['retry_storm'],
        cost: 25,
      },
      {
        title: 'Raise retries at every layer',
        detail:
          'This multiplies attempts again and creates an additional overload condition.',
        add: ['connection_pressure'],
      },
    ],
    'Attempt rate converges toward useful demand; expired and uncertain work is reconciled.',
    [
      'Retry budgets preserve automatic recovery with bounded load.',
      'A breaker protects the dependency but delays users during its open interval.',
    ],
  ),
  dossier(
    'Deployment',
    'schema_mismatch',
    'A deployment removed a field while old consumers still require it. Half the traffic reaches code that cannot read the new representation.',
    [
      '10:00 writer starts emitting the new schema',
      '10:03 old consumers report missing currency',
      '10:05 errors correlate with consumer version',
    ],
    [
      ['Old consumer errors', '50% of requests', '0%'],
      ['CPU utilization', '35%', '34%'],
      ['Schema versions', 'v1 and v2 mixed', 'v1 compatible'],
    ],
    [
      {
        title: 'Restore the compatible representation',
        detail:
          'Reintroduce the old field, backfill missing values, then verify both reader versions.',
        clear: ['schema_mismatch'],
      },
      {
        title: 'Route through a compatibility adapter',
        detail:
          'Translate the new representation for old readers while completing the migration.',
        clear: ['schema_mismatch'],
        cost: 60,
      },
      {
        title: 'Restart all database replicas',
        detail:
          'This does not repair a contract mismatch and removes healthy capacity.',
        add: ['connection_pressure'],
      },
    ],
    'Old and new reader contract tests pass against both stored representations.',
    [
      'Expand–contract preserves compatibility but prolongs the migration.',
      'An adapter isolates legacy readers but adds a temporary component and ownership burden.',
    ],
  ),
  dossier(
    'Data',
    'replica_lag',
    'Writes are acknowledged by the primary, but read-after-write requests are routed to a replica three minutes behind. The health check only tests reachability.',
    [
      '11:00 backfill begins',
      '11:02 replica apply lag rises',
      '11:03 buyers cannot see newly created orders',
    ],
    [
      ['Replication apply lag', '180 s', '0.5 s'],
      ['Replica health endpoint', '200 OK', '200 OK'],
      ['Read-after-write misses', '12%', '0%'],
    ],
    [
      {
        title: 'Pin critical reads to the primary',
        detail:
          'Restore the read-your-writes contract while limiting optional reads and observing primary headroom.',
        clear: ['replica_lag'],
        cost: 180,
      },
      {
        title: 'Wait for a session version before replica reads',
        detail:
          'Route to a replica only once it has applied the required version; otherwise use the primary.',
        clear: ['replica_lag'],
        cost: 60,
      },
      {
        title: 'Add another lagging replica',
        detail: 'Another stale copy does not meet the required version.',
        cost: 180,
      },
    ],
    'A new order is visible after its acknowledgment; lag-sensitive reads never use an older version.',
    [
      'Primary reads simplify freshness but increase owner load.',
      'Version-aware routing retains replica capacity but adds session metadata and fallback logic.',
    ],
  ),
  dossier(
    'Edge',
    'tls_expired',
    'The edge certificate expired. TLS negotiation fails before an HTTP request reaches the API, so application logs show little traffic.',
    [
      '00:00 edge certificate expires',
      '00:01 synthetic TLS checks fail',
      '00:04 support reports browser connection errors',
    ],
    [
      ['TLS handshake failures', '100%', '0%'],
      ['API request rate', '0/s', '1,000/s'],
      ['API health', 'healthy', 'healthy'],
    ],
    [
      {
        title: 'Install and verify a renewed certificate',
        detail:
          'Deploy the correct chain and hostname coverage to every edge location.',
        clear: ['tls_expired'],
      },
      {
        title: 'Route to a prepared valid edge',
        detail:
          'Use an already provisioned endpoint with a valid certificate; verify DNS and propagation.',
        clear: ['tls_expired'],
        cost: 20,
      },
      {
        title: 'Scale the API tier',
        detail:
          'Requests never reach the API, so this adds cost without repairing TLS.',
        cost: 120,
      },
    ],
    'External clients complete certificate validation and a real checkout from multiple locations.',
    [
      'Renewal keeps the existing route and requires chain validation.',
      'Prepared edge failover is fast but costs standing redundancy and may involve propagation.',
    ],
  ),
  dossier(
    'Edge',
    'dns_stale',
    'DNS still directs part of the client population to a retired load balancer. Changing the new endpoint does not update records already cached by those clients.',
    [
      '16:00 old load balancer is retired',
      '16:01 60% of clients use the new address',
      '16:04 failures cluster by resolver and cached TTL',
    ],
    [
      ['Affected clients', '40%', '0%'],
      ['New edge success', '99.99%', '99.99%'],
      ['Old endpoint requests', '400/s', '0/s'],
    ],
    [
      {
        title: 'Restore the old endpoint during the TTL window',
        detail:
          'Keep both addresses functional until cached records age out; observe old-route traffic.',
        clear: ['dns_stale'],
        cost: 20,
      },
      {
        title: 'Restore service behind both addresses',
        detail:
          'Point both active edge routes at the healthy service and defer retirement.',
        clear: ['dns_stale'],
        cost: 40,
      },
      {
        title: 'Set new DNS TTL to zero',
        detail:
          'Already cached records keep their old expiry. This cannot retroactively invalidate them.',
      },
    ],
    'Requests to both cached addresses succeed and old-address traffic decays before retirement.',
    [
      'A compatibility window costs an extra edge but protects cached clients.',
      'Immediate retirement is cheaper only when client cache behavior and the migration contract allow it.',
    ],
  ),
  dossier(
    'Data',
    'hot_partition',
    'A single celebrity or large tenant owns most requests. Aggregate fleet CPU looks low while one partition is saturated; adding uniformly distributed shards does not move this hot key.',
    [
      '18:00 a celebrity post goes live',
      '18:02 one shard reaches saturation',
      '18:06 global average CPU remains below 30%',
    ],
    [
      ['Hot partition CPU', '100%', '35%'],
      ['Fleet average CPU', '28%', '25%'],
      ['Hot key share', '72%', '3%'],
    ],
    [
      {
        title: 'Split the hot entity into bounded buckets',
        detail:
          'Choose a secondary bucket key and merge reads while preserving required ordering.',
        clear: ['hot_partition'],
        cost: 180,
      },
      {
        title: 'Cache safe reads for the hot entity',
        detail:
          'Coalesce refreshes and cache only the portion whose freshness contract permits it.',
        clear: ['hot_partition'],
        cost: 45,
      },
      {
        title: 'Add shards without changing ownership',
        detail: 'The same hot key still routes to its existing owner.',
        cost: 180,
      },
    ],
    'Per-partition demand is bounded under the original skew; ordering and freshness tests still pass.',
    [
      'Bucketing distributes ownership but complicates merge and ordering.',
      'Caching is simpler for repeatable reads but cannot divide authoritative writes.',
    ],
  ),
  dossier(
    'Storage',
    'disk_full',
    'The database volume is full because a retained change-log consumer stopped advancing. Writes cannot complete even though CPU and network are healthy.',
    [
      '03:00 change-log consumer stalls',
      '04:10 retained logs consume free space',
      '04:25 write failures begin at volume exhaustion',
    ],
    [
      ['Free disk', '0%', '32%'],
      ['Retained log age', '9 hours', '4 minutes'],
      ['Database CPU', '22%', '24%'],
    ],
    [
      {
        title: 'Expand storage and repair log consumption',
        detail:
          'Create headroom without deleting required recovery logs; resume and verify the consumer.',
        clear: ['disk_full'],
        cost: 180,
      },
      {
        title: 'Move retained logs to supported storage',
        detail:
          'Use the database-supported retention/archive path, repair the consumer, and verify recovery coverage.',
        clear: ['disk_full'],
        cost: 60,
      },
      {
        title: 'Delete arbitrary database files',
        detail:
          'This introduces a data-integrity risk and is not a supported way to reclaim space.',
        add: ['unsafe_recovery'],
      },
    ],
    'Writes succeed, retained-log age falls, and backup/recovery continuity is verified.',
    [
      'Expansion buys safe time but carries cost until retention is repaired.',
      'Supported archival reduces local pressure but introduces another storage dependency.',
    ],
  ),
  dossier(
    'Messaging',
    'duplicate_effect',
    'A consumer sends the confirmation and crashes before acknowledgment. Redelivery repeats the external effect because there is no stable processed-message identity.',
    [
      '12:00 worker sends message 884',
      '12:00 worker crashes before ack',
      '12:01 message 884 is redelivered and sent again',
    ],
    [
      ['Duplicate sends', '18%', '0%'],
      ['Broker redelivery', 'elevated', 'occasional'],
      ['Checkout success', '99.99%', '99.99%'],
    ],
    [
      {
        title: 'Deduplicate by stable event identity',
        detail:
          'Persist the event outcome and reuse a provider idempotency key where supported.',
        clear: ['duplicate_effect'],
      },
      {
        title: 'Reconcile sends before replaying uncertain events',
        detail:
          'Pause uncertain replays, inspect provider receipts, and persist the result before resuming.',
        clear: ['duplicate_effect'],
        cost: 25,
      },
      {
        title: 'Acknowledge before sending',
        detail: 'Duplicates decrease, but a crash can now lose accepted work.',
        add: ['lost_delivery'],
      },
    ],
    'A crash after the provider effect and before acknowledgment does not create a second logical send.',
    [
      'Idempotency supports safe retries but needs identity retention.',
      'Reconciliation can handle uncertainty but adds latency and operational work.',
    ],
  ),
  dossier(
    'Deployment',
    'probe_loop',
    'A liveness probe includes a slow downstream database check. A database slowdown restarts otherwise healthy pods, which then warm up and overload the dependency again.',
    [
      '08:00 storage latency rises',
      '08:02 liveness probes time out',
      '08:04 restarting pods amplify warm-up traffic',
    ],
    [
      ['Pod restarts', '42 / 10 min', '0'],
      ['Liveness dependency', 'database query', 'process health'],
      ['Cold-start traffic', '3× baseline', 'steady'],
    ],
    [
      {
        title: 'Separate liveness from dependency readiness',
        detail:
          'Keep liveness local to a recoverable process failure; use bounded readiness and a startup probe.',
        clear: ['probe_loop'],
      },
      {
        title: 'Roll back the probe configuration',
        detail:
          'Restore the known local health check and drain pods that are genuinely unready.',
        clear: ['probe_loop'],
      },
      {
        title: 'Shorten probe timeouts',
        detail: 'More false failures accelerate the restart loop.',
        add: ['connection_pressure'],
      },
    ],
    'Pods survive a downstream slowdown; traffic stops reaching genuinely unready instances.',
    [
      'Separate probes reduce false restarts but need a clear readiness contract.',
      'Rollback is fast but should be followed by explicit failure-injection tests.',
    ],
  ),
  dossier(
    'Messaging',
    'outbox_stalled',
    'Orders and outbox rows commit correctly, but the relay cursor is stuck. The broker and workers are idle because unpublished events have not reached them.',
    [
      '13:00 relay deployment starts',
      '13:02 outbox cursor stops advancing',
      '13:08 order success stays green while notifications disappear',
    ],
    [
      ['Oldest unpublished row', '480 s', '2 s'],
      ['Broker queue depth', '0', 'small'],
      ['Outbox row count', '24,000', '20'],
    ],
    [
      {
        title: 'Repair the relay and replay unsent rows',
        detail:
          'Resume from the durable cursor and preserve event IDs; consumers must tolerate a repeated publish.',
        clear: ['outbox_stalled'],
      },
      {
        title: 'Run a bounded recovery relay',
        detail:
          'Read committed unsent rows in batches with the same publication contract; reconcile the cursor.',
        clear: ['outbox_stalled'],
        cost: 45,
      },
      {
        title: 'Add notification workers',
        detail:
          'No events are reaching workers, so downstream capacity cannot empty the outbox.',
        cost: 90,
      },
    ],
    'The durable publication cursor advances, oldest outbox age recovers, and each event reaches its consumer contract.',
    [
      'Repairing the relay restores the normal ownership path.',
      'A recovery relay drains faster but requires coordination to avoid conflicting cursor updates.',
    ],
  ),
  dossier(
    'Regional',
    'region_partition',
    'A regional partition makes the old primary unreachable. Promoting a second writer without fencing the old one risks conflicting ownership when connectivity returns.',
    [
      '07:00 inter-region link fails',
      '07:02 primary cannot be reached from recovery region',
      '07:05 operators consider promotion',
    ],
    [
      ['Primary reachability', 'unknown across partition', 'reachable'],
      ['Standby lag', '8 s', '0.5 s'],
      ['Writer ownership', 'old lease unresolved', 'single fenced writer'],
    ],
    [
      {
        title: 'Fence the old writer, then promote and route',
        detail:
          'Establish exclusive ownership, verify the accepted data-loss window, then restore writes.',
        clear: ['region_partition'],
      },
      {
        title: 'Restore connectivity and retain the old primary',
        detail:
          'Wait for the original owner rather than allowing an ambiguous second writer.',
        clear: ['region_partition'],
      },
      {
        title: 'Promote immediately without fencing',
        detail:
          'A second potential writer creates split-brain risk even if some requests return success.',
        add: ['unsafe_recovery'],
      },
    ],
    'Exactly one writer owns the epoch; acknowledged writes and accepted RPO are reconciled before normal routing.',
    [
      'Fenced promotion improves recovery time but may accept bounded asynchronous loss.',
      'Waiting protects ownership simplicity but lengthens unavailability.',
    ],
  ),
  dossier(
    'Identity',
    'credential_rotation',
    'The notification provider credential was revoked before all workers received its replacement. Every send is rejected before useful delivery, and retries reuse the invalid credential.',
    [
      '20:00 old credential is revoked',
      '20:01 only half the fleet has the new secret',
      '20:04 rejected sends and retries accumulate',
    ],
    [
      ['Provider status', '401 / 403', '2xx'],
      ['Delivery throughput', '0/s', '50/s'],
      ['Credential versions', 'mixed', 'current'],
    ],
    [
      {
        title: 'Complete the credential rollout',
        detail:
          'Load the replacement through the secret manager, verify permission scope and restart only stale workers.',
        clear: ['credential_rotation'],
      },
      {
        title: 'Restore a controlled overlap window',
        detail:
          'Temporarily allow the old credential while moving all consumers, then revoke it after verification.',
        clear: ['credential_rotation'],
      },
      {
        title: 'Increase provider rate quota',
        detail: 'Authorization fails before rate capacity matters.',
        cost: 100,
      },
    ],
    'Every worker uses a valid scoped credential and old queued work is delivered without leaking secrets into logs.',
    [
      'Immediate replacement minimizes overlap but requires coordinated rollout.',
      'An overlap window reduces downtime but prolongs exposure of the old credential.',
    ],
  ),
  dossier(
    'Cost',
    'log_cardinality',
    'A release labels metrics with unique request IDs and emits verbose payload logs. Telemetry volume and series cardinality grow with traffic, overwhelming the monitoring budget.',
    [
      '15:00 new labels are deployed',
      '15:10 active time series explode',
      '16:00 forecast telemetry cost exceeds the app budget',
    ],
    [
      ['Active series', '8 million', '12,000'],
      ['Telemetry cost forecast', '$7,200/mo extra', '$0 extra'],
      ['Request success', '99.99%', '99.99%'],
    ],
    [
      {
        title: 'Remove unbounded labels and reduce payload logging',
        detail:
          'Keep bounded dimensions, sampled traces and correlation IDs in appropriate log fields.',
        clear: ['log_cardinality'],
      },
      {
        title: 'Apply a temporary ingestion budget',
        detail:
          'Protect the bill while preserving essential SLO signals, then repair instrumentation.',
        clear: ['log_cardinality'],
        cost: 50,
      },
      {
        title: 'Scale the metrics backend only',
        detail: 'Capacity does not remove the unbounded series source.',
        cost: 500,
      },
    ],
    'Cardinality stays bounded under unique users and requests while useful incident diagnosis remains possible.',
    [
      'Instrumentation repair preserves efficient visibility.',
      'Budget caps contain cost sooner but can discard evidence during the repair window.',
    ],
  ),
  dossier(
    'Isolation',
    'noisy_tenant',
    'One tenant runs expensive exports in the same unbounded pool as interactive checkout. Other tenants wait behind long jobs despite moderate average load.',
    [
      '09:30 tenant starts a bulk export',
      '09:31 shared pool fills with long-running work',
      '09:35 unrelated tenants report checkout timeouts',
    ],
    [
      ['Export pool share', '95%', '10%'],
      ['Small tenant wait', '2,000 ms', '12 ms'],
      ['Aggregate CPU', '58%', '50%'],
    ],
    [
      {
        title: 'Isolate exports with a bounded bulkhead',
        detail:
          'Give long jobs a separate queue and concurrency budget; preserve interactive service capacity.',
        clear: ['noisy_tenant'],
        cost: 60,
      },
      {
        title: 'Apply per-tenant fair scheduling',
        detail:
          'Limit simultaneous expensive work per tenant and preserve admitted workload fairly.',
        clear: ['noisy_tenant'],
        cost: 25,
      },
      {
        title: 'Raise the shared concurrency limit',
        detail:
          'More simultaneous expensive queries create downstream pressure without fairness.',
        add: ['connection_pressure'],
      },
    ],
    'The noisy workload remains bounded and other tenants meet latency targets under the original offered load.',
    [
      'Bulkheads give strong isolation but may leave spare capacity in one pool.',
      'Fair scheduling shares capacity efficiently but adds policy and observability complexity.',
    ],
  ),
  dossier(
    'Release',
    'flag_drift',
    'A feature flag cached in one region still enables a faulty checkout path after rollback. Code version alone cannot explain the regional error distribution.',
    [
      '17:00 risky path is enabled',
      '17:05 flag is disabled globally',
      '17:07 one region still serves the cached enabled state',
    ],
    [
      ['Flag version in affected region', '17', '18'],
      ['Error scope', 'one region', 'none'],
      ['Code version', 'same across regions', 'same'],
    ],
    [
      {
        title: 'Invalidate and verify the stale flag state',
        detail:
          'Refresh the regional flag cache and verify the actual evaluated version on a representative request.',
        clear: ['flag_drift'],
      },
      {
        title: 'Route around the stale region during refresh',
        detail:
          'Use healthy evaluation state while capacity and data-locality constraints are checked.',
        clear: ['flag_drift'],
        cost: 120,
      },
      {
        title: 'Redeploy the same binary repeatedly',
        detail:
          'If the flag cache is external or preserved, the incorrect decision remains.',
      },
    ],
    'Representative requests in every region evaluate the intended flag version and the bad path is no longer used.',
    [
      'Refreshing state fixes the direct cause with little added capacity.',
      'Regional routing contains impact quickly but adds capacity and locality tradeoffs.',
    ],
  ),
];
export const extraIncidents: Incident[] = extraDossiers.map((d) => ({
  title: (
    {
      pool_leak: 'Connections vanish after a release',
      retry_storm: 'Retries become the outage',
      schema_mismatch: 'Old readers meet a new schema',
      replica_lag: 'The order exists—just not on this replica',
      tls_expired: 'Healthy API, broken TLS',
      dns_stale: 'Half the clients use yesterday’s address',
      hot_partition: 'One key melts one shard',
      disk_full: 'Retained logs fill the disk',
      duplicate_effect: 'One event, two confirmation emails',
      probe_loop: 'Health checks restart healthy pods',
      outbox_stalled: 'The queue is empty. The outbox is not.',
      region_partition: 'Two regions, one uncertain writer',
      credential_rotation: 'Rotation locks out the workers',
      log_cardinality: 'Observability becomes the biggest bill',
      noisy_tenant: 'One tenant blocks everyone else',
      flag_drift: 'Rollback misses a cached flag',
    } as Record<string, string>
  )[d.fault],
  actor: d.category + ' on-call',
  complaint: d.evidence[0][0] + ': ' + d.evidence[0][1],
  brief: d.cause,
  lesson: d.verification,
  hint: 'Compare the current evidence with the healthy baseline before choosing an action.',
  fix: d.actions[0].detail,
}));
export function faultEffects(c: OpsConfig) {
  const has = (f: string) => c.faults?.includes(f);
  return {
    load: has('retry_storm')
      ? 3
      : has('hot_partition')
        ? 8
        : has('noisy_tenant')
          ? 5
          : has('connection_pressure')
            ? 4
            : 1,
    success:
      has('tls_expired') || has('disk_full') || has('region_partition')
        ? 0
        : has('pool_leak')
          ? 0.35
          : has('schema_mismatch') || has('probe_loop') || has('flag_drift')
            ? 0.5
            : has('dns_stale')
              ? 0.6
              : 1,
    freshness: has('replica_lag') ? 180 : 0,
    cost: (has('log_cardinality') ? 7200 : 0) + (c.responseCost ?? 0),
    delivery:
      has('credential_rotation') ||
      has('outbox_stalled') ||
      has('lost_delivery')
        ? 0
        : 1,
    safe:
      !has('duplicate_effect') &&
      !has('unsafe_recovery') &&
      !has('lost_delivery'),
  };
}
export function applyResponse(s: OpsState, action: ResponseAction): OpsState {
  return {
    ...s,
    running: false,
    config: {
      ...s.config,
      faults: [
        ...new Set([
          ...(s.config.faults ?? []).filter((f) => !action.clear?.includes(f)),
          ...(action.add ?? []),
        ]),
      ],
      responseCost: (s.config.responseCost ?? 0) + (action.cost ?? 0),
    },
    events: [
      { time: s.seconds, text: action.title + ': ' + action.detail },
      ...s.events,
    ].slice(0, 30),
    report: '',
  };
}
