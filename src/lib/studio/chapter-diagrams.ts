import type { Design } from './model';
// Explicit relationships; these are not invented request pipelines for abstract concepts.
const maps: Record<string, string> = {
  'api-gateway':
    'Client>Ingress gateway:Public route|Ingress gateway>API:Authenticated forwarding|Alternative ingress>API:Valid replacement path|API>Database:Authoritative work',
  pagination:
    'Last page>Cursor:Last sort tuple|Cursor>Query:Strict tuple boundary|New inserts>Current ordering:May move offsets|Query>Next page:Stable continuation',
  'rate-limits':
    'Clock>Token bucket:Refill up to capacity|Request>Token bucket:Consume request cost|Token bucket>Admitted:Enough tokens|Token bucket>Rejected:Bounded retry guidance',
  indexes:
    'Tenant filter>Composite index:Leading key equality|Sort tuple>Composite index:Ordered suffix|Composite index>Matching rows:Bound traversal|Writes>Composite index:Maintenance cost',
  partitioning:
    'Key router>Shard A:Owned keys|Key router>Shard B:Owned keys|Hot entity>Shard A:Skew remains|Shard A>Capacity limit:Measure per shard',
  'object-storage':
    'Client>Pending metadata:Start upload|Client>Object storage:Scoped direct upload|Object storage>Finalization check:Size and identity|Finalization check>Ready metadata:Publish|Abandoned upload>Cleanup:Expiry policy',
  'search-index':
    'Primary records>Change stream:Committed updates|Change stream>Search projection:Versioned indexing|Query>Search projection:Retrieve candidates|Search projection>Authorization:Filter access|Authorization>Visible results:Allowed documents',
  'consistent-hashing':
    'Hash ring>Owner A:Key range|Hash ring>Owner B:Key range|New member>Hash ring:Membership change|Hash ring>Moved keys:Subset reassigned|Moved keys>Origin load:Warm cold entries',
  cap: 'Network partition>Majority owner:Can coordinate|Network partition>Isolated replica:Cannot reach owner|Majority owner>Allocation:Authoritative writes|Isolated replica>Rejected allocation:Protect invariant|Isolated replica>Stale catalog:Only if permitted',
  dns: 'Browser>Resolver:Ask name|Resolver>Cached old address:TTL still valid|Resolver>Authoritative DNS:Refresh after expiry|Authoritative DNS>New address:Updated answer|Cached old address>Old endpoint:Existing clients',
  tcp: 'Sender>Byte stream:Length + payload|Byte stream>Receive buffer:Partial bytes|Receive buffer>Frame parser:Wait for complete frame|Frame parser>Message A:Decode frame|Frame parser>Message B:Decode next frame',
  tls: 'Browser>Edge:Verify edge certificate|Edge>Service:Authenticate internal hop|Untrusted caller>Service:Reject forged identity|Service>Resource:Authorize action',
  'http-methods':
    'Client intent>Intent record:Unique key + payload hash|Intent record>Order:First request commits|Repeated request>Intent record:Same identity|Intent record>Original response:Return existing result',
  serialization:
    'Old writer>Wire schema:Old fields|New writer>Wire schema:Compatible additions|Wire schema>Old reader:Ignore supported unknowns|Wire schema>New reader:Defaults for missing fields',
  memory:
    'Concurrent requests>Buffers:Allocate|Buffers>Garbage collector:Release unreachable objects|Cache>Live heap:Retained values|Live heap>Memory budget:Bound retention|Garbage collector>Memory budget:Reclaim',
  'cpu-io':
    'Request>CPU work:Parse / compute|CPU work>I/O wait:Query dependency|I/O wait>Connection pool:Bound concurrency|Connection pool>Response:Complete|CPU work>Run queue:CPU saturation',
  percentiles:
    'Host A histogram>Merged bucket counts:Request-weighted counts|Host B histogram>Merged bucket counts:Same bucket boundaries|Merged bucket counts>Quantile:Calculate after merging',
  'availability-math':
    'Client>Required service A:Mandatory|Required service A>Required service B:Mandatory|Shared zone>Required service A:Correlated failure|Shared zone>Required service B:Correlated failure',
  disk: 'Application>Log buffer:Append|Log buffer>Durable storage:Flush|Durable storage>Acknowledgement:Durability boundary|Durable storage>Recovery:Replay committed records',
  'solid-contracts':
    'Checkout>Payment port:Behavioral contract|Payment port>Provider A:Adapter|Payment port>Provider B:Adapter|Contract tests>Provider A:Same semantics|Contract tests>Provider B:Same semantics',
  composition:
    'Consumer>Reader interface:Needs reads only|Mutable collection>Reader interface:Implements|Mutable collection>Writer interface:Implements|Read-only collection>Reader interface:Implements',
  strategy:
    'Checkout>Shipping policy:Stable Money result|Policy selection>Local shipping:Select|Policy selection>International shipping:Select|Local shipping>Shipping policy:Implements|International shipping>Shipping policy:Implements',
  command:
    'Refund intent>Pending refund:Persist command|Pending refund>Provider:Submit intent ID|Provider>Completed:Confirmed|Provider>Reconciliation:Unknown outcome|Reconciliation>Completed:Resolve later',
  'dependency-injection':
    'Composition root>Clock:Construct|Composition root>Repository:Construct|Composition root>Payment port:Construct|Clock>Booking service:Inject|Repository>Booking service:Inject|Payment port>Booking service:Inject',
  repository:
    'Reservation command>Transaction:Begin|Transaction>Seat allocation:Conditional claim|Transaction>Order record:Create|Seat allocation>Commit:Together|Order record>Commit:Together',
  'value-objects':
    'Amount + currency>Validated Money:Construct|Validated Money>Add operation:Same currency required|Another Money>Add operation:Reject mismatch|Add operation>New Money:Immutable result',
  'concurrent-collections':
    'Worker A>Atomic claim:putIfAbsent|Worker B>Atomic claim:putIfAbsent|Atomic claim>Winner:Own effect|Atomic claim>Loser:Use existing outcome|Winner>Effect:One owner',
  'testing-contracts':
    'Shared contract tests>Real adapter:Same scenarios|Shared contract tests>Fake adapter:Same scenarios|Fault injection>Shared contract tests:Lost response / duplicate callback|Real adapter>Observed behavior:Verify contract|Fake adapter>Observed behavior:Verify contract',
  'lld-capstones':
    'Entry gate>Allocator:Claim spot|Allocator>Ticket:Atomic creation|Ticket>Pricing policy:Compute fee|Ticket>Payment port:Pay intent|Payment port>Exit gate:Settled status',
  clocks:
    'Event A>Event B:Causal message|Host A clock>Event A:Wall timestamp|Host B clock>Event B:May be behind|Event A>Logical order:Increment|Event B>Logical order:Merge then increment',
  leases:
    'Lease owner A>Protected store:Token 11 rejected|Lease owner B>Protected store:Token 12 accepted|Coordinator>Lease owner A:Expired lease|Coordinator>Lease owner B:New generation',
  mvcc: 'Reader snapshot>Old row version:Visible at snapshot|Writer>New row version:Create update|Old row version>Cleanup:Retain while needed|New row version>Future readers:Visible after commit',
  sagas:
    'Hotel reserved>Flight reservation:Next local transaction|Flight reservation>Trip confirmed:Success|Flight reservation>Cancellation pending:Failure|Cancellation pending>Canceled:Compensation succeeds|Cancellation pending>Manual review:Compensation fails',
  cdc: 'Source database>Snapshot at P:Initial records|Source database>Change log:Committed changes|Snapshot at P>Projection:Load baseline|Change log>Projection:Apply after P|Projection>Version guard:Reject older replay',
  crdt: 'Replica A>Merge:Local additions|Replica B>Merge:Local additions|Merge>Converged set:Union|Inventory invariant>Coordination:Convergence alone insufficient',
  'schema-evolution':
    'Historical v1 events>Upcaster:Explicit defaults|Current v2 events>Decoder:Current schema|Upcaster>Normalized event:Common domain shape|Decoder>Normalized event:Common domain shape|Unknown version>Quarantine:Visible failure',
  probes:
    'Startup probe>Initializing pod:Allow startup budget|Liveness probe>Running pod:Local progress|Readiness probe>Traffic routing:Accept or drain|Dependency outage>Readiness probe:Evaluate degraded service',
  'service-discovery':
    'Pod unready>Endpoint removal:Stop new routing|Endpoint removal>Propagation wait:Existing discovery caches|Propagation wait>Drain:Finish admitted work|Drain>Termination:Bounded deadline',
  'observability-signals':
    'User outcome SLI>Alert:Detect impact|Alert>Trace:Find slow boundary|Trace>Structured logs:Inspect operation|Deployment metadata>Structured logs:Correlate change|Cardinality budget>User outcome SLI:Bound labels',
  'error-budgets':
    'Eligible events>Bad-event fraction:Measure outcomes|SLO target>Allowed fraction:1 minus target|Bad-event fraction>Burn rate:Divide by allowance|Allowed fraction>Burn rate:Budget baseline|Burn rate>Alert:Short + long windows',
  'disaster-recovery':
    'Backups>Restore:Data|Encryption keys>Restore:Required access|Schema tooling>Restore:Compatible reader|Restore>Integrity checks:Verify|Integrity checks>User journey:Prove recovery',
  'zero-downtime-migrations':
    'Additive schema>Compatible writers:Expand|Compatible writers>Backfill:Idempotent migration|Backfill>New readers:Verify completeness|New readers>Old consumer retirement:Observe|Old consumer retirement>Drop old field:Contract',
  'multi-tenancy':
    'Verified tenant>Authorization:Resource scope|Request>Admission budget:Fair quota|Admission budget>Shared pool:Bound expensive work|Authorization>Scoped records:Owner check|Shared pool>Scoped records:Execute',
  'security-design':
    'Credential>Identity verification:Authenticate|Identity verification>Permission check:Action|Resource owner>Permission check:Scope|Permission check>Allowed operation:All checks pass|Revocation>Identity verification:Expire cached authority',
  'platform-engineering':
    'Product teams>Platform journey:Build / deploy / operate|Platform journey>Supported defaults:Fast common path|Platform journey>Exception path:Specialized need|Usage evidence>Platform roadmap:Prioritize friction',
  adrs: 'Context>Option A:Benefit / cost|Context>Option B:Benefit / cost|Option A>Decision:Compare|Option B>Decision:Compare|Decision>Revisit trigger:New evidence',
  'build-buy':
    'Representative workload>Build option:Staff + operations|Representative workload>Buy option:Fees + integration|Build option>Lifecycle cost:Compare|Buy option>Lifecycle cost:Include exit|Exit drill>Buy option:Verify portability',
  'unit-economics':
    'Infrastructure cost>Total attributable cost:Add|Retry and support cost>Total attributable cost:Add|Total attributable cost>Cost per outcome:Divide|Successful orders>Cost per outcome:Business denominator',
  roadmaps:
    'Business outcome>First milestone:Small useful release|First milestone>Evidence review:Measure|Evidence review>Next investment:Continue|Evidence review>Revised plan:Stop or change',
  'team-topology':
    'Domain A team>Published contract:Owns|Published contract>Domain B team:Consumes|Platform team>Shared capabilities:Supports|Shared capabilities>Domain A team:Self service|Shared capabilities>Domain B team:Self service',
  'technical-debt':
    'Observed friction>Cost estimate:Measure recurring impact|Upcoming change>Cost estimate:Exposure|Cost estimate>Bounded repair:Prioritize|Bounded repair>Delivery evidence:Verify reduction',
  'risk-register':
    'Concrete risk>Control:Mitigate|Control>Representative drill:Test|Representative drill>Residual exposure:Measure|Residual exposure>Owner review:Accept or improve',
  'data-governance':
    'Primary record>Search projection:Derived copy|Primary record>Analytics export:Derived copy|Deletion workflow>Primary record:Delete|Deletion workflow>Search projection:Propagate|Deletion workflow>Analytics export:Retention / deletion policy',
  'ai-systems':
    'User question>Authorized retrieval:Scope documents|Authorized retrieval>Inference:Evidence as data|Inference>Output validation:Check contract|Output validation>Action boundary:Separate permission|Action boundary>Product result:Authorized only',
  'business-continuity':
    'Order acceptance>Payment:Customer obligation|Payment>Fulfillment partner:Business completion|Partner outage>Degraded policy:Pause or queue|Degraded policy>Customer updates:Own delayed obligations',
  'executive-communication':
    'Business outcome>Options:Compare|Options>Recommendation:Explain evidence|Recommendation>Commitment:People / cost / time|Recommendation>Residual risk:Make visible',
  'principal-capstone':
    'Requirements>Architecture:Ownership + workload|Architecture>Contract:Invariant|Contract>Failure drill:Test|Architecture>Cost model:Resources|Failure drill>Roadmap:Revise with evidence|Cost model>Roadmap:Sequence',
};
export function chapterDiagram(id: string): Design | null {
  const spec = maps[id];
  if (!spec) return null;
  const names: string[] = [],
    edges: Design['edges'] = [];
  for (const pair of spec.split('|')) {
    const [ends, label] = pair.split(':'),
      [a, b] = ends.split('>');
    for (const n of [a, b]) if (!names.includes(n)) names.push(n);
    edges.push({
      id: 'e' + edges.length,
      from: 'n' + names.indexOf(a),
      to: 'n' + names.indexOf(b),
      label,
      async: false,
    });
  }
  return {
    nodes: names.map((name, i) => ({
      id: 'n' + i,
      name,
      kind: /\bdatabase\b|\bstore\b|\bstorage\b|\brecords?\b|row version/i.test(
        name,
      )
        ? 'database'
        : 'class',
      detail: '',
      capacity: 1,
      replicas: 1,
    })),
    edges,
  };
}
