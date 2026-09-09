import { requestFoundation } from './request-foundation';
import type { Lesson } from './curriculum';
export type Foundation = {
  name: string;
  sections: { title: string; paragraphs: string[]; example: string }[];
  checks: {
    q: string;
    options: string[];
    answer: number;
    why: string;
    afterSection?: number;
  }[];
};
const make = (
  name: string,
  a: string,
  b: string[],
  c: string,
  d: string,
  e: string[],
  f: string,
  q: string,
  options: string[],
  answer: number,
  why: string,
): Foundation => ({
  name,
  sections: [
    { title: a, paragraphs: b, example: c },
    { title: d, paragraphs: e, example: f },
  ],
  checks: [{ q, options, answer, why }],
});
const foundations: Record<string, Foundation> = {
  network: make(
    'Requests and protocol boundaries',
    'Separate each layer of a request',
    [
      'A request crosses several contracts. Naming answers where to connect; transport moves bytes; encryption authenticates a peer and protects the connection; the application protocol defines the operation. Success at one boundary is not success at the next. A successful TCP connection does not prove that an HTTP request was authorized, processed, or committed.',
      'Consider a browser opening an order page. It may reuse an existing connection and skip a fresh DNS lookup or TLS handshake. Its end-to-end deadline still includes time spent waiting in local connection pools, on the network, in service queues, and in storage. Measure those intervals separately before choosing an optimization. Repeated setup and slow business logic have different repairs.',
    ],
    'Browser deadline 800 ms = pool wait 100 + network/setup 120 + API 180 + database 300 + response 100. The budget is already spent.',
    'Reason about uncertainty at the boundary',
    [
      'When a connection breaks, the client sees a local observation: it did not receive the complete expected reply. The server may have seen no bytes, a partial request, the whole request, or already committed a change. Protocol retry rules must therefore distinguish a safe repeatable read from an operation that creates a new effect.',
      'Use a stable operation identifier when an uncertain effect must be reconciled. Check the authoritative result before issuing a new business intent. During diagnosis, compare request IDs, server commit records and response failures. Do not infer that every user received an error merely because one proxy timed out, or that a 200 response proves a downstream notification was delivered.',
    ],
    'An order commits at 700 ms; the client deadline is 650 ms. “Timed out” and “order exists” can both be true.',
    'A request timed out after the server received it. Which retry argument is defensible?',
    [
      'Repeat with a new order ID because the first must have failed',
      'Reconcile the original intent; repeat only under its defined idempotency contract',
      'Wait one second, which guarantees the server has rolled back',
    ],
    1,
    'The observation does not locate the failure relative to the effect. A stable identity lets the caller resolve uncertainty without inventing another order.',
  ),
  performance: make(
    'Demand, service and queues',
    'Keep demand and capacity in separate columns',
    [
      'Arrival rate counts work offered to the system. Completion rate counts useful work finished. Capacity is the service rate a particular resource can sustain for a particular workload. None of these is a property of a server name alone: query shape, record size, cache locality and concurrency can change the amount of work per request.',
      'For each tier, multiply requests per second by visits to that tier and work per visit. A page that performs ten database reads creates a different storage load from a page that performs one, even at identical HTTP traffic. Capacity added to the API cannot repair a database whose work demand is already above its service rate. It may increase pressure on it.',
    ],
    '2,000 requests/s × 4 queries/request = 8,000 queries/s. A 5,000-query/s database accumulates work or rejects it.',
    'Explain waiting before claiming faster service',
    [
      'If arrival rate exceeds completion rate for a sustained interval, unfinished work grows. A queue does not add service capacity; it changes when the system admits work and when the caller learns the result. Once waiting exceeds a deadline, processing expired work can consume resources without creating user value.',
      'Little’s law relates steady-state averages: average concurrency equals throughput multiplied by average time in system. It does not calculate a p99 latency, and it should not be applied as a stable-state promise to an unbounded growing queue. Estimate with it, then measure distributions, saturation and timeouts under the offered workload. A lower average can coexist with worse tail latency.',
    ],
    '50 completions/s × 0.2 seconds mean = 10 operations in flight on average. This says nothing by itself about the slowest 1%.',
    'A queue grows by 300 jobs/s. What does doubling its storage capacity accomplish?',
    [
      'It doubles processing throughput',
      'It creates more room before exhaustion but does not fix the service deficit',
      'It halves the oldest-job age immediately',
    ],
    1,
    'Storage capacity absorbs a longer burst. Sustainable recovery still requires reduced arrivals or increased useful completion throughput at the bottleneck.',
  ),
  state: make(
    'Ownership and durability',
    'Name the authoritative copy',
    [
      'State is information whose previous value affects a later decision. Some state is disposable, such as a cache that can be rebuilt. Other state is authoritative, such as a confirmed purchase. A design must say which component owns the right to change that authoritative record and which other components hold derived copies.',
      'A process restart clears ordinary memory. Adding a second process gives another memory space, not shared ownership. If a shopping cart or session is stored only in one process, routing to another process changes what the user sees. Externalizing state makes replacement easier, but adds a dependency whose availability and consistency must now be designed.',
    ],
    'API A remembers cart [book]. API B remembers nothing. Round-robin routing does not merge their memory.',
    'Separate survival from correctness',
    [
      'Durability answers what survives a stated failure after an acknowledgment. It is not the same as availability, which asks whether an operation can be served now. A database can preserve every acknowledged write while being temporarily unavailable. An available replica can answer reads while missing the newest write.',
      'Define the failure model: process crash, machine loss, zone outage or logical deletion. Then identify the recovery source and ownership transition. A replica can copy a mistaken delete as faithfully as a valid update; a backup with retention addresses a different failure. Recovery verification must inspect actual records and invariants, not only a green health endpoint.',
    ],
    'Restarting the API should not erase a confirmed order. Restoring a backup must also reconcile orders acknowledged after that backup.',
    'Which observation proves a cache is disposable?',
    [
      'It is stored in memory',
      'Its required contents can be reconstructed from an authoritative source',
      'It has more than one replica',
    ],
    1,
    'The reconstruction contract makes a copy disposable. Storage medium or replica count alone does not establish that contract.',
  ),
  cache: make(
    'Derived data and freshness',
    'Follow a value through a cache miss and hit',
    [
      'A cache stores a derived result so the next caller can avoid more expensive work. In cache-aside, the application looks up a key, reads the owner on a miss, then fills the cache. The key must identify the complete result: resource, tenant, authorization scope when relevant, and any version or query parameters that change the answer.',
      'Eviction is a memory policy; expiration is a freshness policy. An entry may be evicted while still fresh, or remain allocated after it has expired. A cache hit is useful only when its value satisfies the caller’s correctness contract. Serving an old product description and authorizing an old account permission are different risks even if both are fast.',
    ],
    'At t=0, owner price=100 and cache price=100. At t=10, owner becomes 120. A hit at t=11 can still return 100 until invalidation or expiry.',
    'Trace the race, not only the happy path',
    [
      'Deleting a key after a write can still race with a concurrent reader. A reader may fetch an old value, the writer commits a new value and invalidates the key, then the reader fills the cache with the old value. If that violates the product contract, use version-aware updates, appropriate sequencing, shorter tolerated staleness, or an authoritative read for the critical operation.',
      'When many entries expire together, misses can suddenly multiply owner demand. A cache outage can create the same transition. Coalescing refreshes, varying expiration times and limiting refresh concurrency protect the owner; they do not make stale data correct. Compare database work before and after the change, and verify freshness separately from latency.',
    ],
    '10,000 reads/s with 95% hits sends 500 reads/s to the owner. Losing the cache sends up to 10,000/s: a 20× change.',
    'A cache is removed while API replicas are doubled. What must you check first?',
    [
      'Whether the database can serve the new miss rate',
      'Whether the cache logo is still shown',
      'Whether the API has more total RAM than before',
    ],
    0,
    'Removing a cache changes visits to the authoritative store. Extra API capacity can expose the store to even more concurrent work.',
  ),
  queue: make(
    'Delivery and backpressure',
    'Distinguish accepted, processed and delivered',
    [
      'An API response may mean that work was durably accepted, not that the requested external effect finished. A queue decouples producer timing from consumer timing. The producer, broker, worker and downstream provider each have a separate success boundary. Define the customer promise at the last boundary that matters to that customer.',
      'A worker should acknowledge a message only according to its processing contract. If it performs an effect and crashes before acknowledgment, the message may be delivered again. If it acknowledges first and then crashes before the effect, work may be lost. Exactly where you put the acknowledgment determines which uncertainty you must handle.',
    ],
    'Order accepted → notification queued → worker attempts provider call → provider accepts → customer delivery. Each arrow can fail independently.',
    'Count useful work, retries and age',
    [
      'Adding workers helps only if worker service capacity is the limiting factor and work can run in parallel. A provider quota, partition ordering, lock contention or invalid payload can prevent extra workers from improving useful completions. Retries also consume capacity; counting attempts as delivered messages hides the failure.',
      'Bound retries, delay them with backoff and jitter, and quarantine permanent failures so one poison message cannot monopolize the queue. A dead-letter queue is an operational obligation, not a successful customer outcome. Repair the cause before replay, preserve the original identity, and monitor oldest-job age as well as queue depth. A small queue can still contain a very old important job.',
    ],
    '500 worker attempts/s behind a 30-send/s provider cannot deliver 500 messages/s. At 50 new jobs/s, even perfect payloads leave at least 20 jobs/s accumulating.',
    'Why can adding notification workers make an incident worse?',
    [
      'More attempts can exceed a provider quota and amplify retries',
      'Workers always reduce reliability',
      'Queue storage becomes durable only with one worker',
    ],
    0,
    'The useful bottleneck may be downstream. More parallel attempts can increase rejection, retry traffic and cost without increasing successful delivery.',
  ),
  concurrency: make(
    'Interleavings and invariants',
    'Write the rule before choosing a lock',
    [
      'An invariant is a condition that must remain true after every allowed operation. “No seat has two confirmed owners” is an invariant; “use a transaction” is an implementation proposal. Start with the state and rule, then write the smallest overlapping sequence that could violate it.',
      'Two operations can each make a correct decision from an old snapshot and still produce an invalid combined result. Preventing that requires protecting the full decision boundary, not merely one assignment. A local mutex coordinates threads that share it. It cannot coordinate another process, a different region, or a payment provider.',
    ],
    'A reads seat=free. B reads seat=free. A writes owner=A. B writes owner=B. Both replies say confirmed unless the write is conditional.',
    'Find the point where one contender wins',
    [
      'An atomic conditional update, a unique constraint, a deliberate lock or sufficient transaction isolation can make one operation succeed and the other re-evaluate. Name the linearization or commit point: the instant at which the operation is considered to take effect for the required contract. Reads before that point are observations, not ownership.',
      'After an abort or version conflict, repeat the decision using fresh state. Repeating only the final statement can retain a conclusion based on obsolete reads. External side effects require another plan: a database rollback cannot undo an already sent email or provider charge. Persist stable intent and a reconciliation workflow when the effect crosses transactional boundaries.',
    ],
    'UPDATE seats SET owner=A WHERE id=14 AND owner IS NULL. Exactly one contender changes a row; the other sees zero rows and must not confirm.',
    'What does a database version check protect?',
    [
      'Every external side effect automatically',
      'The guarded state change against a conflicting version',
      'All code in every process for the rest of the request',
    ],
    1,
    'It protects the conditional write boundary. Side effects outside it need their own identities and recovery contracts.',
  ),
  data: make(
    'Access paths and replicated data',
    'Derive the model from operations',
    [
      'A data model supports concrete reads and writes. List the keys used to find records, the predicates used to filter them, the ordering required, and the invariants updated together. Choose indexes and ownership boundaries from those operations. A storage product name does not supply a data model or resolve a cross-record invariant.',
      'An index trades extra write work and storage for a faster access path. A replica provides another copy, while a partition assigns a subset of ownership elsewhere. These are different changes. Read replicas may increase read capacity; they do not automatically divide authoritative writes. Partitioning can divide writes but complicates queries and invariants spanning partitions.',
    ],
    'Read: orders by customer sorted by createdAt. Write: create order plus reserved inventory. The read index and the write transaction solve different requirements.',
    'Make intermediate states visible',
    [
      'Replicated or migrated data exists in intermediate states. With asynchronous replication, a replica may have applied sequence 40 while the primary acknowledged sequence 43. Routing a user to that replica may violate read-your-writes unless the system waits for a known version, routes to the owner, or defines a weaker contract.',
      'During schema change, old and new code can coexist. Expand compatible representations, migrate data, verify the access paths and consumers, then remove the old representation only after its readers and rollback obligations are gone. Verify counts, sampled values, constraints and business outcomes. Equal row counts alone do not prove that the right values or ownership survived.',
    ],
    'Primary version=43; replica version=40. A successful replica health check does not prove that a just-created order is visible there.',
    'Which change primarily divides ownership of writes?',
    [
      'Adding a read replica',
      'Partitioning records across independent owners',
      'Increasing a cache TTL',
    ],
    1,
    'A read replica copies an owner. Partitioning assigns distinct records to different owners, with consequences for cross-partition work.',
  ),
  contracts: make(
    'Objects and executable behavior',
    'Turn responsibilities into contracts',
    [
      'A class should own a coherent rule or state transition, not merely group methods with similar names. An interface tells callers what inputs are accepted, what results mean, which errors are possible, and what effects occur. Method signatures alone leave callers guessing about missing values, repeats, concurrency and failure.',
      'Start with a concrete command and trace it through the model. A cache get should say whether a miss changes recency. A reservation should say whether it acquires ownership atomically. A payment method should distinguish a declined payment from an unknown result. Each of these decisions belongs at a boundary that every caller must use.',
    ],
    'reserve(space, session) → reserved | already-owned | unavailable. “boolean reserve()” can hide the distinction a caller needs.',
    'Separate pure decisions from effects',
    [
      'Pure functions are useful for deterministic decisions: calculating a tariff, validating a transition, or selecting a strategy from explicit input. Network calls, clocks and persistence are effects. Inject those dependencies so tests can choose time, force a timeout, or simulate a version conflict without waiting for real infrastructure.',
      'Composition lets a policy change without rewriting lifecycle ownership. It does not mean every small function needs an interface or factory. Introduce an abstraction when it isolates a real variation, testing boundary or ownership rule. Test observable contracts and boundary conditions instead of asserting the exact internal sequence of helper calls.',
    ],
    'PricingPolicy.quote(duration, tariff) is a decision. PaymentGateway.charge(intent) is an effect. A timeout in the latter does not invalidate the arithmetic in the former.',
    'What makes a useful LLD test?',
    [
      'It checks every private helper name',
      'It runs a boundary sequence and asserts the public result plus invariant',
      'It confirms that the class count increased',
    ],
    1,
    'The test should protect meaningful behavior through implementation changes. Private structure and component count do not establish correctness.',
  ),
  architecture: make(
    'Boundaries, migration and ownership',
    'Choose a boundary around a reason to change',
    [
      'A service boundary changes ownership, deployment, failure and coordination. Split a capability when independent change, scaling, security or team ownership justifies those costs. A modular monolith can enforce clear internal contracts without introducing a network call between every pair of modules.',
      'Draw the data owner and the callers that depend on it. If two services both directly mutate the same tables, their deployment independence may be an illusion. If every release requires all services to move together, separate processes have not created independent evolution. Measure coordination and operational costs alongside throughput.',
    ],
    'Catalog owns the current product description. Checkout owns the immutable purchase snapshot. Changing catalog wording must not rewrite a completed purchase.',
    'Design the transition, not only the destination',
    [
      'A migration succeeds through intermediate states. An adapter can let old callers use a new implementation; a shadow path can compare results without repeating side effects; a canary can expose a bounded cohort before a wider cutover. State which representation remains authoritative at each stage.',
      'Rollback must be a concrete operation with a deadline. Switching traffic back is insufficient if the old system cannot read data written by the new one. Define reconciliation, compatibility and cleanup conditions before deleting the old path. Keep the rejected alternative and a revisit trigger in the decision record so later teams understand which assumptions made the choice reasonable.',
    ],
    'Expand → backfill → compare → route a cohort → observe → switch → contract. Destructive cleanup is later than first successful traffic.',
    'When is routing rollback insufficient?',
    [
      'When the new system wrote state the old system cannot interpret',
      'Whenever more than one service exists',
      'Only when the dashboard is unavailable',
    ],
    0,
    'Rollback involves both traffic and state compatibility. A healthy old binary may still be unable to process the new representation.',
  ),
  operations: make(
    'Production evidence and recovery',
    'Start from the customer symptom',
    [
      'An incident is a broken customer promise under a particular workload and failure. Start with the affected operation, scope, start time and severity. Compare a healthy baseline with the current state: recent changes, useful completion rate, errors, tail latency and saturation. A red CPU graph is evidence, not a complete diagnosis.',
      'Trace a representative failed request across boundaries using correlated identifiers. Ask where time was spent and where the outcome became uncertain. Distinguish a cause from a consequence: a growing queue may result from a provider quota, rather than insufficient queue storage. Choose the next observation because it can separate competing explanations.',
    ],
    'Checkout latency rose immediately after a release; database CPU stayed low but connection-pool wait rose. Adding database CPU does not directly repair leaked connections.',
    'Separate containment from durable repair',
    [
      'Containment reduces impact while the cause is still being resolved: roll back a release, cap retries, shed optional work or route around a failed instance. Every containment action has a customer and operational cost. Record what was degraded, who accepted it, and when the temporary change will be removed.',
      'Recovery means the original customer contract holds again at the required workload. Verify backlog age, state correctness, failure headroom and cost, not only a lower alert count. A post-incident action should target the causal mechanism: a regression test, safer rollout, capacity boundary, detection gap or runbook. “Be more careful” does not change the system.',
    ],
    'Rollback stops new failures. Reconciliation repairs uncertain orders. Draining old work restores delayed users. These are three different recovery milestones.',
    'Which observation is sufficient to close a notification incident?',
    [
      'HTTP success is green',
      'Workers have restarted',
      'Delivery meets its deadline and affected work has been reconciled under the original load',
    ],
    2,
    'A worker restart is an action. Recovery is evidence that the customer promise and the old backlog have both been addressed.',
  ),
  security: make(
    'Trust and permission',
    'Identify the boundary that must enforce the rule',
    [
      'Authentication establishes an identity or credential. Authorization decides whether that identity may perform an operation on a particular resource. A valid login does not authorize access to every order or document. Enforce the rule on the server boundary that owns the resource, including list, export and indirect access paths.',
      'A capability such as a shared link carries a scoped permission. Decide who may forward it, what it grants, when it expires and how revocation is enforced. Random identifiers reduce guessing but do not replace authorization. Encryption protects data over a stated channel or at rest; it does not decide whether a signed-in user is entitled to a record.',
    ],
    'GET /orders/123 must check ownership or an explicit role for order 123. Hiding a navigation link cannot protect the API.',
    'Plan for credentials and copies to change',
    [
      'Permission state, keys and cached decisions evolve. Key rotation requires an overlap or compatibility plan so valid clients do not all fail at once. Revocation must account for derived caches and long-lived tokens. Define the maximum tolerated window instead of assuming that deleting a row instantly removes every copy of access.',
      'Collect the evidence needed to investigate misuse without leaking secrets or unnecessary personal data into logs. Use scoped credentials and an accountable owner for rotation, expiry and incident response. A security control that cannot be operated during an outage becomes a reliability and access risk; rehearse the transition with safe test identities.',
    ],
    'A token remains cryptographically valid for 60 minutes after a permission is revoked unless the authorization path checks a revocation or current-permission source.',
    'Does HTTPS prevent a user from changing an order ID to read another user’s order?',
    [
      'Yes, encryption proves ownership',
      'No, resource-level authorization is still required',
      'Only if the ID is short',
    ],
    1,
    'TLS protects the connection. The application must still decide whether the authenticated caller has permission for the specific resource.',
  ),
  leadership: make(
    'Decisions under organizational constraints',
    'Connect the technical choice to an outcome',
    [
      'A senior architecture decision allocates scarce capacity: engineering time, money, operational attention and organizational coordination. State the customer or business outcome before comparing mechanisms. A design that improves one metric can still be a poor choice if it consumes the team needed to meet a more important commitment.',
      'Compare alternatives over a stated horizon using common assumptions. Include infrastructure, vendor fees, migration, staffing, on-call work and exit cost. Separate fixed costs from variable costs and opportunity cost from cash outlay. Sensitivity analysis is more informative than a single precise total when demand and implementation effort are uncertain.',
    ],
    'A $12,000/month platform serving 600,000 successful orders allocates $0.02/order. Half the volume at unchanged fixed cost doubles that unit cost.',
    'Make uncertainty and accountability explicit',
    [
      'Assign a decision owner and involve teams that own consequences. Document the rejected alternatives, accepted risks, evidence and a revisit trigger. Reversible decisions can be made with less ceremony; irreversible data loss, long contracts or organizational restructuring need stronger evidence and a staged path where possible.',
      'A roadmap should expose dependencies and learning milestones, not just dates. A pilot can test a throughput assumption, a migration cohort can expose compatibility risk, and a recovery drill can validate staffing and runbooks. If the evidence changes, revisiting the decision is responsible ownership rather than failure to defend the original proposal.',
    ],
    'Choose managed delivery initially; revisit at a measured annual cost threshold or when a required delivery guarantee is unavailable. Name who measures that trigger.',
    'Which decision record remains useful when the original author leaves?',
    [
      'The chosen technology and a claim that it is best',
      'The constraints, alternatives, accountable owner and conditions for revisiting',
      'Only a project completion date',
    ],
    1,
    'Future teams need the reasoning and assumptions to know whether the decision still fits, not just the selected product name.',
  ),
};
export function foundationFor(l: Lesson): Foundation {
  const id = l.id;
  if (id === 'request') return requestFoundation;
  if (/requirement/.test(id)) return requirements;
  if (l.stage === 5) return foundations.leadership;
  if (/secur|auth|trust|threat|encrypt|key-rotation/.test(id))
    return foundations.security;
  if (/cache|cdn|lru|invalidation|stampede/.test(id)) return foundations.cache;
  if (
    /queue|delivery|outbox|saga|event|stream|observer|notification|backpressure/.test(
      id,
    )
  )
    return foundations.queue;
  if (
    /concurr|transaction|booking|deadlock|mvcc|lock|lease|atomic|isolation/.test(
      id,
    )
  )
    return foundations.concurrency;
  if (
    /replic|partition|shard|index|storage|sql|data|schema|search|crdt|consensus|quorum/.test(
      id,
    )
  )
    return foundations.data;
  if (
    /latency|numbers|capacity|load|balance|hpa|percentile|cpu|complexity|little|performance/.test(
      id,
    )
  )
    return foundations.performance;
  if (
    /request|dns|tcp|tls|http|network|serialize|gateway|api|pagination/.test(id)
  )
    return foundations.network;
  if (l.stage === 2) return foundations.contracts;
  if (/state|memory|process|durab/.test(id)) return foundations.state;
  if (
    /observ|slo|incident|recovery|backup|probe|kubernetes|k8s|discovery|deploy|failure|timeout|retry/.test(
      id,
    )
  )
    return foundations.operations;
  if (l.stage === 4) return foundations.architecture;
  if (l.stage === 0) return foundations.state;
  return foundations.architecture;
}

const requirements = make(
  'Requirements and measurable scope',
  'Define the actor and the operation',
  [
    'A functional requirement describes an action an actor can perform. Start with the primary customer journey and identify the result that means success. “Design chat” leaves scope open; “an authenticated member sends a text message to an existing conversation and online recipients can read it” identifies a concrete operation and its boundaries.',
    'Write exclusions alongside the included journey. Voice, video, search, offline delivery and moderation can each introduce independent systems. Excluding a feature for the exercise does not mean it is unimportant; it prevents an unstated assumption from becoming a hidden obligation later. Confirm exclusions with the interviewer or decision owner before sizing the design.',
  ],
  'Actor: buyer. Operation: hold one available seat for five minutes. Success: a durable hold identity. Excluded initially: resale and multi-seat atomic booking.',
  'Turn quality goals into observations',
  [
    'A quality requirement combines an operation, a workload, a measurement and a bound. “Fast” is not testable. “99% of valid hold requests complete within 200 ms at 2,000 requests/s in one region” gives the test an input and an observable outcome. Specify whether rejected requests count and whether the target covers network time or only service processing.',
    'Correctness requirements need equal precision. “Reliable payment” might mean no duplicate charge, no lost acknowledged order, bounded time to resolve uncertainty, or all three. Separate those invariants from availability and latency. When targets conflict, ask which degraded behavior the customer accepts; do not silently trade a correctness rule for a better dashboard.',
  ],
  'Availability: 99.9% of eligible requests succeed over 30 days. Freshness: a deletion stops appearing within 60 seconds. These are different denominators and failure conditions.',
  'Which statement is a requirement rather than a technology preference?',
  [
    'Use five microservices',
    'Use the fastest database',
    '99% of eligible reads finish within 150 ms at the stated peak load',
  ],
  2,
  'The last option names a measurable outcome under a workload. Technology choices are proposals for satisfying that outcome.',
);
const followupChecks: Record<
  string,
  { q: string; options: string[]; answer: number; why: string }
> = {
  network: {
    q: 'Application processing uses 15 ms of a 200 ms request. Can a 2× code speedup halve end-to-end latency?',
    options: [
      'Yes, all request time is application CPU',
      'No; it removes only 7.5 ms if other intervals stay unchanged',
      'Yes, if the response is HTTP 200',
    ],
    answer: 1,
    why: 'Optimize the measured interval. Setup, network, pool wait and storage time remain unless the change also affects them.',
  },
  performance: {
    q: 'A database is saturated while API CPU is low. What would discriminate the cause?',
    options: [
      'Query visits per request and database service time',
      'The total number of API containers alone',
      'The names of the languages used',
    ],
    answer: 0,
    why: 'Work per operation reveals why the owner is saturated. Compute replicas alone do not quantify downstream demand.',
  },
  state: {
    q: 'A replica copied an accidental deletion. What additional mechanism addresses this failure?',
    options: [
      'Another identical live replica',
      'A retained recovery point plus a tested restore and reconciliation process',
      'Restarting every API process',
    ],
    answer: 1,
    why: 'Replication propagates state, including mistakes. Recovering a prior state requires a retained version and a recovery contract.',
  },
  cache: {
    q: 'A reader fills an old value after a writer invalidates the key. What failed?',
    options: [
      'The invalidation sequence allowed a stale fill race',
      'The API necessarily lacked replicas',
      'The cache has too many keys to be correct',
    ],
    answer: 0,
    why: 'The interleaving is the mechanism. Version-aware writes, sequencing or a different freshness boundary may be needed.',
  },
  queue: {
    q: 'The queue depth is low but its oldest message is three hours old. Is delivery necessarily healthy?',
    options: [
      'Yes, queue depth is the only useful metric',
      'No; starvation, a poison message or a blocked partition can violate the delivery deadline',
      'Yes, if the API is healthy',
    ],
    answer: 1,
    why: 'Depth and age answer different questions. A few permanently delayed messages can still break a customer promise.',
  },
  concurrency: {
    q: 'A transaction aborts because its read assumptions conflicted. What should a retry usually repeat?',
    options: [
      'Only the last write with the same old values',
      'The complete decision with fresh reads',
      'Only the API response',
    ],
    answer: 1,
    why: 'The invalidated read influenced the decision. A fresh transaction must re-evaluate that decision.',
  },
  data: {
    q: 'During migration, new writers emit a representation old readers cannot parse. What restores compatibility?',
    options: [
      'More read replicas',
      'A compatible representation or adapter while readers migrate',
      'Removing monitoring of old readers',
    ],
    answer: 1,
    why: 'This is a contract mismatch. Capacity cannot make an old reader understand a missing or changed field.',
  },
  contracts: {
    q: 'Why inject a clock into a pricing or rate-limiting component?',
    options: [
      'To make the production clock less accurate',
      'To test time boundaries deterministically without waiting',
      'To avoid specifying time units',
    ],
    answer: 1,
    why: 'Controlled time makes expiry, refill and billing boundary cases reproducible. Units and clock semantics still belong in the contract.',
  },
  architecture: {
    q: 'What evidence justifies extracting a service?',
    options: [
      'A clear owner and independent change or scaling need that outweigh coordination cost',
      'A target number of services',
      'The availability of a container platform',
    ],
    answer: 0,
    why: 'A boundary should solve a real ownership, evolution or scaling problem. A service count is not an outcome.',
  },
  operations: {
    q: 'Rollback stops new failures. What remains before closing an incident with uncertain payments?',
    options: [
      'Nothing if error rate is green',
      'Reconcile existing uncertain attempts and verify the customer outcome',
      'Delete old attempts to reduce the backlog',
    ],
    answer: 1,
    why: 'Containment prevents more damage; reconciliation resolves already affected users. Both are part of recovery.',
  },
  security: {
    q: 'A valid token outlives a permission change. What determines revocation behavior?',
    options: [
      'The token color',
      'The authorization and revocation checks plus cache/expiry policy',
      'The number of API replicas',
    ],
    answer: 1,
    why: 'Cryptographic validity and current permission are different conditions. The enforcement path determines the revocation window.',
  },
  leadership: {
    q: 'A vendor is cheaper in infrastructure fees but needs substantial migration work. What should the comparison include?',
    options: [
      'Only the monthly invoice',
      'A common time horizon including migration, operations, opportunity cost and exit cost',
      'Only the engineering team size',
    ],
    answer: 1,
    why: 'The decision allocates more than infrastructure cash. Compare the complete consequence under shared assumptions.',
  },
};
for (const [key, check] of Object.entries(followupChecks))
  foundations[key].checks.push(check);
requirements.checks.push({
  q: 'Why record excluded features?',
  options: [
    'They make all future requirements invalid',
    'They make the initial scope and its assumptions explicit',
    'They eliminate every design tradeoff',
  ],
  answer: 1,
  why: 'An exclusion is a bounded scope decision that can later be revisited. It prevents hidden obligations during the current design.',
});
