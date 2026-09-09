export const lldGuide: Record<
  string,
  {
    goal: string;
    steps: { title: string; text: string; code: string }[];
    cases: [string, string, string][];
    extension: string;
    answer: string;
  }
> = {
  lru: {
    goal: 'Keep the most useful recent entries inside a fixed memory budget. Separate the public cache contract from the data structures that implement it.',
    steps: [
      {
        title: 'Define what “recent” means',
        text: 'A successful read counts as use. Inserting a new key counts as use. Updating an existing key also counts as use, but does not create a second entry. A miss changes nothing. This policy is LRU, not insertion-order eviction: if A was inserted before B but read afterward, B is now the eviction candidate.',
        code: 'capacity = 2\nput(A, 1) → [A]\nput(B, 2) → [B, A]\nget(A)    → 1; [A, B]\nput(C, 3) → [C, A]; evict B',
      },
      {
        title: 'Give each structure one job',
        text: 'A hash map answers “where is the node for this key?” in expected constant time. A doubly linked list answers “which key was used least recently?” through its tail. Keeping only an array requires searching or shifting elements. Keeping only a map does not automatically supply the intended recency policy. The map and list must refer to the same logical entries.',
        code: 'index: Map<Key, Node>\nnode: { key, value, prev, next }\nhead ↔ most recent ↔ … ↔ least recent ↔ tail',
      },
      {
        title: 'Make mutation a single operation',
        text: 'On a hit, find the node, detach it from its neighbors, and link it after the head sentinel. On an update, replace the value and move that same node. On an insertion, create one node and one map entry; if the capacity is exceeded, unlink the tail’s previous node and delete that node’s key from the map. Sentinels remove special cases for empty and single-element lists.',
        code: 'get(key):\n  node = index.get(key)\n  if absent: return MISS\n  unlink(node); linkAfterHead(node)\n  return node.value',
      },
      {
        title: 'Prove the edge cases',
        text: 'For capacity zero, return from put without storing anything. For capacity one, updating the sole key must not evict it as a different entry. With concurrent callers, a lock must protect the map and list together; protecting only the map allows a reader to encounter detached or duplicated list nodes. This is a local cache contract: a lock in one process cannot coordinate other processes.',
        code: 'assert index.size == numberOfRealListNodes\nassert index.size <= capacity\nassert node.next.prev == node\nassert node.prev.next == node',
      },
    ],
    cases: [
      [
        'Capacity 2: put A, put B, get A, put C',
        'B is evicted',
        'Reading changes recency.',
      ],
      [
        'Update A with a new value',
        'Size stays constant',
        'The node is reused, not duplicated.',
      ],
      [
        'Put into capacity zero',
        'No entry retained',
        'The public boundary defines the empty cache.',
      ],
      [
        'Two hits overlap',
        'List remains linked',
        'The critical section covers both structures.',
      ],
    ],
    extension:
      'Add expiration. Should get remove expired entries? How will an expired tail differ from the least recently used live entry?',
    answer:
      'Check expiry before returning a hit. Decide between lazy removal and a separate expiry index. TTL and recency answer different questions; avoid turning every get into a scan. Account for clock behavior and the extra memory.',
  },
  bucket: {
    goal: 'Allow a measured burst while enforcing an average admission rate. Time, arithmetic and atomicity are parts of the contract.',
    steps: [
      {
        title: 'Separate burst from sustained rate',
        text: 'Capacity is how much unused permission may accumulate. Refill rate is how much new permission appears per second. A bucket with capacity 5 and refill 1 token/s can admit five simultaneous requests after being idle, but it cannot sustain five requests every second. Rejecting a request does not consume a token.',
        code: 'capacity = 5; rate = 1 token/s\nt = 0: burst 10 → allow 5, reject 5\nt = 1: request → allow 1\nt = 1: next request → reject',
      },
      {
        title: 'Refill from elapsed time',
        text: 'You do not need a timer per user. Store the previous refill timestamp and lazily compute new tokens when a request arrives. Multiply elapsed seconds by tokens per second, then clamp to capacity. Use monotonic elapsed time within one process. Wall-clock adjustments must not mint tokens or move the refill point into the future.',
        code: 'elapsed = max(0, now - lastRefill)\ntokens = min(capacity, tokens + elapsed * rate)\nlastRefill = now',
      },
      {
        title: 'Make check and consume indivisible',
        text: 'Two callers can both observe one token if checking and decrementing are separate operations. One must win and one must reject. A per-key lock works inside one process; a shared store needs its own atomic update primitive. If the store is unavailable, fail-open protects availability but weakens the rate guarantee; fail-closed protects the dependency but rejects valid users.',
        code: 'atomically for clientId:\n  refill(now)\n  if tokens < 1: return denied\n  tokens -= 1\n  return allowed',
      },
      {
        title: 'Expose a useful rejection',
        text: 'Return whether the request was admitted and a retry-after estimate. With rate r > 0 and tokens t < 1, the time to the next token is (1 − t) / r. This estimate is not a reservation: another caller may consume that token first. Partition keys must reflect the intended policy, such as tenant plus operation, and idle buckets need bounded retention.',
        code: 'retryAfterSeconds = (1 - tokens) / rate\nkey = tenantId + operation\n// Admission is not completion or billing.',
      },
    ],
    cases: [
      [
        'Empty bucket, no elapsed time',
        'Reject without going negative',
        'No permission is available.',
      ],
      [
        'Idle for 100 seconds',
        'At most capacity tokens',
        'Idle time cannot create an unlimited burst.',
      ],
      [
        'Two callers, one token',
        'Exactly one is admitted',
        'Atomic update protects the invariant.',
      ],
      [
        'Clock moves backward',
        'No negative refill',
        'Monotonic elapsed time is required.',
      ],
    ],
    extension:
      'Enforce a tenant-wide limit across three regions. How much overshoot can you accept during a partition?',
    answer:
      'Choose a coordination scope. A global atomic store adds latency and availability dependence. Regional quotas reduce coordination but need a bounded allocation and rebalancing policy. State the allowed overshoot rather than claiming a local bucket is globally exact.',
  },
  order: {
    goal: 'Keep business state valid while external payment and storage can fail independently. A state machine is the beginning of this design, not the whole payment workflow.',
    steps: [
      {
        title: 'Define legal state transitions',
        text: 'A pending order may become paid or cancelled. Only a paid order may ship. Shipped and cancelled are terminal in this small model. Put this rule inside the order boundary so every caller uses it. A setter such as setState(string) would let callers bypass the rule and create an unpaid shipment.',
        code: 'pending → paid → shipped\npending → cancelled\npaid → cancelled (refund workflow required)',
      },
      {
        title: 'Separate command from external effect',
        text: 'Pay is a request to start a payment workflow, not proof that the provider charged successfully. A production model needs payment-pending and payment-unknown states or a separate payment attempt aggregate. Keep the stable attempt identity, provider reference, amount and currency. A timeout can occur after the provider performed the effect.',
        code: 'PaymentAttempt { id, orderId, amount, status }\ncharge(idempotencyKey = attempt.id)\n// timeout → reconcile the same attempt',
      },
      {
        title: 'Protect overlapping commands',
        text: 'If pay and cancel both read version 7, they must not independently overwrite each other. Save using an expected version and recompute the losing command against the new state. This protects your database row; it does not roll back a provider charge. Persist intent and reconcile external effects instead of holding a database lock across a slow network call.',
        code: 'UPDATE orders SET state = next, version = 8\nWHERE id = orderId AND version = 7\n// 0 rows changed → reload and re-evaluate',
      },
      {
        title: 'Make repeats predictable',
        text: 'A repeated ship command should return the prior result or a defined already-shipped outcome. It must not dispatch a second parcel. Persist an operation identity and use an outbox for downstream dispatch. Paid cancellation requires an explicit refund outcome, including refund-pending and manual review when the provider remains uncertain.',
        code: 'commandId → durable command result\ntransaction:\n  update order\n  insert dispatch event into outbox',
      },
    ],
    cases: [
      [
        'Ship a pending order',
        'Reject; state unchanged',
        'Payment is a precondition.',
      ],
      [
        'Pay a cancelled order',
        'Reject',
        'Terminal state is not silently reopened.',
      ],
      [
        'Repeat a shipment command',
        'Reuse prior result',
        'Do not duplicate the external effect.',
      ],
      [
        'Provider times out after charging',
        'Pending reconciliation',
        'Timeout does not imply no charge.',
      ],
    ],
    extension:
      'A payment succeeds after the buyer’s stock reservation expires. Which invariant is protected by payment idempotency, and which is still broken?',
    answer:
      'Idempotency prevents duplicate charges for the same intent. It does not preserve inventory ownership. Reconcile the payment against the reservation state, then choose a documented refund, reacquisition or manual-review path. Do not confirm stock that another buyer owns.',
  },
  parking: {
    goal: 'Give one active session exclusive ownership of a compatible space, while keeping time, pricing and payment independently testable.',
    steps: [
      {
        title: 'Model ownership, not just a boolean',
        text: 'A boolean occupied flag is enough for the visual reference, but a production garage needs an active session identifier. A ticket references the session, vehicle and space. Releasing by space number alone can let an old ticket release a new vehicle’s reservation. Ownership must be checked on both entry and exit.',
        code: 'Session { id, spaceId, vehicleId, enteredAt, state }\nSpace { id, type, activeSessionId? }',
      },
      {
        title: 'Reserve atomically',
        text: 'Two gates may see the same free space. Searching for a free space and marking it occupied must be one atomic reservation operation, or use a compare-and-swap that can fail and retry another candidate. Vehicle compatibility is a precondition, not a later display concern. Full capacity returns a defined rejection without issuing an active ticket.',
        code: 'reserve(spaceId, expectedOwner = null, sessionId)\n// succeeds for only one contender\n// reserve and session creation commit together',
      },
      {
        title: 'Inject pricing and time',
        text: 'The session owns its entry and completion timestamps. A pricing policy maps a valid duration and tariff version into a money value with currency and minor units. Inject a clock to test exact hour boundaries. Keep rounding policy explicit: billing each started hour differs from rounding the final amount.',
        code: 'duration = exitAt - enteredAt\nassert duration >= 0\nquote = pricing.quote(duration, tariffVersion)\nMoney { minorUnits, currency }',
      },
      {
        title: 'Complete exit safely',
        text: 'Decide whether payment is required before the barrier opens and what happens during a provider outage. Persist the exit workflow and reuse an attempt identity on retry. Completion releases only the space still owned by this session. A duplicate ticket scan returns a prior receipt or a defined rejection; it cannot free another driver’s space.',
        code: 'release(spaceId, expectedOwner = sessionId)\ncompleteSessionOnce(sessionId, receiptId)\n// Repeat exit uses the recorded result.',
      },
    ],
    cases: [
      ['Two gates reserve one space', 'One succeeds', 'Reservation is atomic.'],
      ['Exit an empty space', 'Reject', 'No active session owns it.'],
      [
        'Exit time before entry',
        'Reject',
        'Clock/input validation protects billing.',
      ],
      [
        'Scan an old ticket after reassignment',
        'Keep new owner',
        'Release checks session ownership.',
      ],
    ],
    extension:
      'Introduce pre-booked accessible spaces and electric charging. Which responsibilities change?',
    answer:
      'Add compatibility and reservation policy without mixing them into payment processing. Separate physical occupancy from a future reservation window. Charging creates its own measured usage and pricing inputs; preserve a stable parking session identity across those services.',
  },
};

export const lruDetails: string[][] = [
  [
    'Choose the observable contract before choosing containers. Here, get returns the stored value or an explicit miss; put replaces an existing value or inserts a new key. Updating A must preserve one A, return its new value on the next read, and move A to the front. Capacity counts entries, not bytes. A cache holding two large images can consume far more memory than one holding two integers.',
    'A single entry is both most recent and least recent. Empty slots have no recency. In the example, get(A) changes [B, A] to [A, B]. The later insertion of C removes B because B is now the oldest use, even though A was originally inserted first. A failed lookup of B must not create a placeholder or rearrange C and A.',
    'Decide whether null or undefined can be legitimate values. If they can, a get result that uses the same value for a miss is ambiguous: expose a found flag or an option/result type. Define invalid capacity, key equality, and whether callers receive shared mutable objects or copies. These choices affect correctness independently of the eviction algorithm.',
  ],
  [
    'Store a reference to the same node in both structures. The map associates A with its node; it should not contain a second independent copy of the value and links. The list determines recency through pointers. To remove the least recent item, take tail.prev and delete that node’s key from the map. No search through the list is necessary.',
    'The complexity claim has assumptions. Pointer rewiring takes a constant number of assignments once the node is known. Hash-table lookup is expected constant time with an appropriate hashing strategy, while resizing can make an individual insertion more expensive. Memory grows with capacity and includes keys, values, map storage, and two links per node. A linked list also has worse locality than a compact array.',
    'A small array may still be a sensible choice for a tiny fixed cache: its simple storage and good locality can outweigh asymptotic costs. An ordered container with explicit move-to-end operations can reduce implementation risk. Explain the workload, the library guarantees, and the measured bottleneck before deciding that a handwritten linked list is required.',
  ],
  [
    'Use two sentinel nodes that do not represent cached entries. In an empty list, HEAD.next points to TAIL and TAIL.prev points to HEAD. For a real node n, unlink it by connecting n.prev.next to n.next and n.next.prev to n.prev. Then insert it after HEAD by updating both neighbors and n’s own links. Real nodes must never remain reachable from two positions.',
    'For an update, modify the existing node and promote it. For a new key, create its node and map entry, link it at the front, then remove the tail’s predecessor if capacity was exceeded. Keep these actions inside one protected mutation when callers can overlap. Specify what happens if allocation or a user-supplied hashing function fails; an exception must not leave the map and list disagreeing.',
    'A cache hit is a write to recency metadata. A read/write lock that treats get as read-only is therefore insufficient for this exact policy. Avoid holding the cache lock across a database fetch or an eviction callback: that can serialize unrelated work or allow reentrant mutation. A get-or-load operation needs an additional policy for concurrent misses and duplicate loads.',
  ],
  [
    'Test sequences, not isolated outputs. With capacity one: put(A, 1), put(A, 2), get(A) must return 2 and keep size one. With capacity two: put(A, 1), put(B, 2), get(A), put(C, 3) must evict B. Repeated misses must preserve order. After every operation, traverse forward and backward and compare the real-node keys with the index keys.',
    'A concrete race exposes the locking boundary. Thread one finds A and pauses. Thread two evicts A and removes its map entry. If thread one now promotes its old node reference without a shared lock or revalidation, it can reinsert a node that the index no longer knows about. Checking only that get returned a value will miss this corruption.',
    'Exact recency has a cost: every hit touches shared metadata. Partitioning a cache can reduce contention but makes eviction local to each partition rather than globally exact. A sequential scan can also displace a frequently reused working set. Compare LRU with admission control or frequency-aware policies using hit rate, latency, memory overhead, and workload skew; there is no universally best policy.',
  ],
];
