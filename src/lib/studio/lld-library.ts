import { lldGuide } from './lld-guide';
import { lldTemplates } from './lld';
export type LLDCase = {
  id: string;
  name: string;
  category: string;
  brief: string;
  invariants: string[];
  sections: { title: string; text: string; code: string }[];
  tests: [string, string, string][];
  extension: string;
  tradeoff: string;
  starter: string;
};
const originals: LLDCase[] = lldTemplates.map((t) => ({
  id: t.id,
  name: t.name,
  category: 'Foundations',
  brief: t.brief,
  invariants:
    t.id === 'lru'
      ? [
          'Successful get and existing-key updates refresh recency.',
          'The number of retained keys never exceeds capacity after an operation.',
          'Eviction removes the least recently used key; capacity zero retains nothing.',
          'Lookup and recency updates are expected O(1).',
        ]
      : t.invariants,
  sections: lldGuide[t.id].steps,
  tests: lldGuide[t.id].cases,
  extension: lldGuide[t.id].extension,
  tradeoff: lldGuide[t.id].answer,
  starter: t.code,
}));
const extra: LLDCase[] = [
  {
    id: 'elevator',
    name: 'Elevator dispatcher',
    category: 'Scheduling',
    brief:
      'Coordinate hall requests and cabin destinations across a bank of elevators. Keep movement safety separate from choosing which car should answer.',
    invariants: [
      'A moving car never opens its doors.',
      'Every accepted request is pending, assigned or completed.',
      'An out-of-service car receives no new assignments.',
    ],
    sections: [
      {
        title: 'Separate intent from movement',
        text: 'A hall call says a passenger is waiting at a floor and wants a direction. A cabin call names a destination after boarding. Keep these as distinct commands: a hall call does not reveal the final destination. Dispatcher selects a car; Elevator owns position, direction, door state and accepted stops. An actuator interface executes movement while a fake actuator makes deterministic tests possible.',
        code: 'HallCall { floor, direction, requestedAt }\nElevator { id, floor, direction, door, stops }\nDispatcher.assign(call, snapshots): Assignment',
      },
      {
        title: 'Make state transitions safe',
        text: 'Moving, stopping, doors-open and out-of-service are explicit states. The elevator rejects a move while doors are open, even if the dispatcher asks for it. Arrival at a floor is an event from the actuator, not an instant result of calling move. Duplicate arrival events must not complete an unrelated stop. This separation prevents a scheduling optimization from bypassing safety rules.',
        code: 'IDLE → MOVING → STOPPED → DOORS_OPEN → IDLE\nmove(): require door == CLOSED\narrived(floor, journeyId): verify active journey',
      },
      {
        title: 'Trace assignment under load',
        text: 'If car A travels upward past floor 4 and car B is idle at floor 1, a request at floor 4 to go up may fit A’s route. The nearest car in absolute distance is not always the earliest arrival. Score direction compatibility, queued stops and estimated arrival. Keep the scoring policy replaceable and deterministic on the same snapshots.',
        code: 'assign(call):\n  candidates = healthyCars(snapshot)\n  car = policy.minimumEstimatedArrival(candidates, call)\n  reserveAssignmentIfVersion(car, call)',
      },
      {
        title: 'Recover without losing requests',
        text: 'Assignment and the car’s acceptance can race with a maintenance transition. Use a version check or serialize dispatch commands. If the selected car rejects, return the call to pending and choose again. Aging prevents a busy direction from starving an old request. A production controller also needs hardware interlocks; this software model cannot certify physical safety.',
        code: 'assignment rejected → pending\ncar unavailable → reassign unserved hall calls\nagingPenalty = waitSeconds * fairnessWeight',
      },
    ],
    tests: [
      ['Move with open doors', 'Reject', 'Safety lives in the car.'],
      [
        'Car becomes unavailable during assignment',
        'Retry another car',
        'Version check prevents stale scheduling.',
      ],
      ['Duplicate arrival', 'Complete once', 'Match journey identity.'],
      [
        'Persistent upward traffic',
        'Downward request eventually served',
        'Aging limits starvation.',
      ],
    ],
    extension:
      'One elevator is reserved for emergency service. How do you drain its ordinary assignments?',
    tradeoff:
      'Greedy nearest-car dispatch is simple but can starve routes. Estimated arrival plus aging improves fairness but relies on travel-time assumptions. Reassign waiting hall calls; onboard passengers need a separately specified safe-service policy.',
    starter:
      'interface DispatchPolicy { choose(call: HallCall, cars: readonly CarSnapshot[]): string | null }\n// Implement Elevator transitions and Dispatcher assignment.\n',
  },
  {
    id: 'vending',
    name: 'Vending machine',
    category: 'State machines',
    brief:
      'Take payment, reserve stock and dispense one product while handling cancellation and hardware uncertainty.',
    invariants: [
      'A vend owns a reserved unit before dispensing.',
      'A repeated command never dispenses twice.',
      'Unknown hardware outcome is not treated as failure.',
    ],
    sections: [
      {
        title: 'Own a purchase session',
        text: 'A purchase session holds the selected SKU, quoted price, accepted money and an operation ID. Inventory owns available and reserved counts. Payment acceptance and dispensing are separate ports. Avoid one machine class that performs pricing, hardware I/O and storage, because failure at each boundary has different recovery semantics.',
        code: 'Purchase { id, sku, quote, paid, state }\nInventory.reserve(sku, purchaseId)\nDispenser.dispense(purchaseId, slot)',
      },
      {
        title: 'Reserve before committing the vend',
        text: 'Selection checks availability but does not guarantee a unit remains. Reserve atomically before accepting the irreversible vend decision. Reject insufficient payment without invoking the motor. Cancellation releases a reservation only if dispensing has not begun. Represent change owed in integer minor units rather than floating-point currency.',
        code: 'SELECTED → RESERVED → PAID → DISPENSING → COMPLETE\nPAID → REFUND_PENDING → CANCELLED',
      },
      {
        title: 'Handle a jam and an uncertain reply',
        text: 'A motor timeout might mean nothing moved, or the product fell while the acknowledgement was lost. Record dispensing intent before sending the hardware command and reuse its ID. Query a sensor or operator reconciliation path before retrying. Blind retry risks delivering two items; blind refund can refund an already delivered item.',
        code: 'persist DISPENSING(id)\nresult = dispenser.dispense(id)\nUNKNOWN → reconcile(id), never create a new vend',
      },
      {
        title: 'Keep accounting explainable',
        text: 'Completion consumes the reservation and records the receipt. A known no-dispense result releases stock and creates a refund obligation. Refunds may fail too, so retain pending obligations. For a purely coin-operated design, escrow capability determines whether cancellation can return exactly the accepted coins; the interface must expose this hardware constraint.',
        code: 'complete(id): consume reservation once; record receipt\nfailed(id): release reservation; record refund owed',
      },
    ],
    tests: [
      [
        'Two buyers select last unit',
        'One reservation',
        'Selection is not ownership.',
      ],
      ['Payment below quote', 'No dispense', 'Precondition holds.'],
      ['Motor timeout', 'Reconcile', 'Outcome is unknown.'],
      ['Repeated receipt request', 'Same receipt', 'Completion is idempotent.'],
    ],
    extension: 'Add dynamic prices while customers are inserting coins.',
    tradeoff:
      'Freeze a quote for a bounded session to make payment predictable. Repricing at vend time simplifies price administration but needs explicit consent or a refund path.',
    starter:
      'interface Dispenser { dispense(operationId: string, slot: string): Promise<"done"|"failed"|"unknown"> }\n// Implement Purchase transitions and stock reservation.\n',
  },
  {
    id: 'library',
    name: 'Library lending',
    category: 'Domain modelling',
    brief:
      'Lend physical copies, manage holds and return books without confusing a title with the copy a reader owns.',
    invariants: [
      'A physical copy has at most one active loan.',
      'A return closes the matching loan only.',
      'Holds follow an explicit fair policy.',
    ],
    sections: [
      {
        title: 'Distinguish catalogue from inventory',
        text: 'A BookTitle contains descriptive metadata such as ISBN and author. BookCopy represents one physical item with a barcode and availability state. A Loan links a member to a copy and due date. Combining title and copy makes two identical books impossible to lend independently and hides lost-copy tracking.',
        code: 'BookTitle { isbn, title }\nBookCopy { barcode, isbn, state }\nLoan { id, barcode, memberId, dueAt, returnedAt? }',
      },
      {
        title: 'Place policy at the lending boundary',
        text: 'LoanService checks member status, outstanding-loan limit and applicable holds before creating the loan. A policy receives a stable clock and member snapshot; it should not mutate inventory. Reserve the copy and insert the loan in one transaction. If another checkout wins, report unavailable and offer a different copy.',
        code: 'checkout(member, copy):\n  policy.check(member, copy, now)\n  transaction: claim available copy; insert loan',
      },
      {
        title: 'Return using the loan identity',
        text: 'Returning by ISBN alone can close the wrong reader’s loan. Identify the physical copy and its active loan. Repeated scans return the recorded outcome. On return, a hold may make the copy reserved for pickup rather than generally available. Compute penalties using the original due date and a versioned fee policy.',
        code: 'returnCopy(barcode, loanId):\n  close active matching loan once\n  next hold ? reserve for pickup : make available',
      },
      {
        title: 'Make dates and exceptions explicit',
        text: 'Define whether due dates are local calendar dates or instants, how holidays shift deadlines and whether renewals are allowed when a hold exists. Inject a calendar and clock rather than comparing formatted strings. Lost items are a separate workflow: a late return after replacement payment needs an accounting policy, not a forced state overwrite.',
        code: 'renew(loan): require no blocking hold\ndueDate = calendar.nextOpenDay(policy.dueDate(now))',
      },
    ],
    tests: [
      [
        'Two checkouts for one barcode',
        'One active loan',
        'Atomic copy claim.',
      ],
      [
        'Two copies of same ISBN',
        'Both may be loaned',
        'Copies differ from title.',
      ],
      [
        'Repeated return',
        'Same result',
        'Loan identity protects current owner.',
      ],
      [
        'Renew with waiting hold',
        'Policy rejection',
        'Fair access takes precedence.',
      ],
    ],
    extension: 'Support inter-branch transfers while readers hold books.',
    tradeoff:
      'A central allocation service simplifies ordering but adds dependency. Branch ownership reduces coordination but requires explicit in-transit states and durable handoffs.',
    starter:
      'interface LoanRepository { checkoutIfAvailable(copyId: string, memberId: string, dueAt: Date): Promise<Loan> }\n// Model titles, copies, holds and LoanService.\n',
  },
  {
    id: 'split-expense',
    name: 'Expense sharing',
    category: 'Money & invariants',
    brief:
      'Split expenses and record settlements with exact arithmetic and an auditable ledger.',
    invariants: [
      'Shares sum exactly to the expense total.',
      'Every ledger transaction balances to zero.',
      'Settlements do not erase expense history.',
    ],
    sections: [
      {
        title: 'Represent money exactly',
        text: 'Use integer minor units and a currency code. Reject mixing currencies inside a split unless an explicit exchange transaction exists. Expense records payer, participants and a split rule. Equal, percentage and exact-amount splits implement the same policy interface but validate different inputs.',
        code: 'Money { minor: bigint, currency: string }\nSplitPolicy.allocate(total, participants): Share[]',
      },
      {
        title: 'Allocate rounding deterministically',
        text: 'Splitting 100 cents among three people cannot produce three equal integer amounts. Assign the base 33 cents to each and allocate the remaining cent using a documented stable ordering. Percentage allocations have the same issue; floor provisional amounts then distribute residual units by remainder. Never drop the residual or silently create money.',
        code: '100 cents / 3 → [34, 33, 33]\nassert sum(shares) == total\nassert every share >= 0',
      },
      {
        title: 'Record entries instead of rewriting balances',
        text: 'The payer receives a credit and participants receive debts according to their shares. Include the payer’s own share so the net credit reflects only what others owe. A settlement is a new balanced transaction. To correct an expense, record a reversal and replacement; this keeps the history explainable and avoids undetectable balance changes.',
        code: 'expense E: A +100, A -34, B -33, C -33\nsettlement B→A 33: B +33, A -33',
      },
      {
        title: 'Make repeats and simplification safe',
        text: 'A client operation ID prevents retrying a request from posting it twice. The ledger transaction and operation result commit together. Debt simplification can propose fewer transfers while preserving each person’s net balance; it must not rewrite original obligations without policy consent. Concurrent expenses append independently; settlement validation may need serialized balance checks.',
        code: 'transaction: insert unique operationId; append balanced entries\nprojection balance(member) = sum(entries)',
      },
    ],
    tests: [
      ['100 cents split three ways', '34/33/33', 'No rounding loss.'],
      ['Retry expense ID', 'One posting', 'Unique operation ID.'],
      ['Reverse expense', 'Net zero', 'History retained.'],
      ['Mix USD and EUR', 'Reject', 'No implicit conversion.'],
    ],
    extension: 'A group disputes an expense after it has already been settled.',
    tradeoff:
      'An append-only ledger supports audit and corrections but needs projections. Mutable balances are smaller but make debugging and dispute resolution harder.',
    starter:
      'type Money = { minor: bigint; currency: string };\ninterface SplitPolicy { allocate(total: Money, memberIds: string[]): Map<string,bigint> }\n// Implement balanced expense posting and idempotent settlements.\n',
  },
  {
    id: 'scheduler',
    name: 'Job scheduler',
    category: 'Concurrency',
    brief:
      'Schedule delayed work, lease due jobs and retry safely when workers disappear.',
    invariants: [
      'A completion belongs to the current lease.',
      'Retries have a bounded policy.',
      'Acknowledgement does not imply exactly-once external effects.',
    ],
    sections: [
      {
        title: 'Separate schedule and attempt',
        text: 'A Job contains payload, nextRunAt and retry policy. A JobAttempt records lease owner, lease token, start and outcome. Scheduling creates work; execution performs it. An executor interface lets tests simulate success, timeout and process loss without using real networks.',
        code: 'Job { id, nextRunAt, attempts, state }\nAttempt { jobId, leaseToken, expiresAt }',
      },
      {
        title: 'Claim due work atomically',
        text: 'Workers query for due jobs but must atomically claim a lease before executing. A sorted index by nextRunAt makes discovery efficient. Do not hold a database transaction open for the duration of execution. Leases expire so another worker can recover abandoned work; long tasks need renewal with the same token.',
        code: 'claimDue(now): atomically set owner, token, expiresAt\nrenew(job, token): update only if token still matches',
      },
      {
        title: 'Fence late completions',
        text: 'Worker A can pause beyond lease expiry while B acquires the job. If A later acknowledges, reject its stale token. This fences scheduler state, not an external side effect that A already performed. Pass a stable business operation ID to an idempotent destination, or reconcile uncertain effects. An in-memory mutex cannot protect cross-process ownership.',
        code: 'complete(jobId, token): UPDATE ... WHERE leaseToken = token\nexternalEffect(idempotencyKey = jobId)',
      },
      {
        title: 'Retry with a destination for failures',
        text: 'Classify retryable failures, use capped exponential backoff with jitter and stop after a maximum attempt or age. Permanent failures move to a dead-letter state with the reason and payload reference. Redrive preserves business identity and records operator intent. A fake clock tests due-time boundaries without sleeping.',
        code: 'delay = random(0, min(cap, base * 2 ** attempt))\npermanent or exhausted → DEAD_LETTER',
      },
    ],
    tests: [
      ['Two workers claim one job', 'One lease', 'Atomic claim.'],
      ['Old worker acknowledges', 'Rejected', 'Token fences completion.'],
      ['Retry budget exhausted', 'Dead letter', 'No infinite loop.'],
      ['Clock before due time', 'No claim', 'Boundary tested.'],
    ],
    extension:
      'A scheduled job runs longer than its lease and performs an irreversible effect.',
    tradeoff:
      'Long leases reduce duplicate work but slow recovery. Short leases improve recovery but need renewal and destination idempotency; they cannot guarantee exactly-once execution.',
    starter:
      'interface Clock { now(): number }\ninterface JobStore { claimDue(now: number): Promise<Lease|null>; complete(id: string, token: string): Promise<boolean> }\n// Implement retry policy and stale-completion handling.\n',
  },
  {
    id: 'pubsub',
    name: 'In-process event bus',
    category: 'Interfaces',
    brief:
      'Publish typed events to subscribers while defining ordering, reentrancy and error isolation.',
    invariants: [
      'Unsubscribing has documented timing.',
      'One failing subscriber does not silently skip the others.',
      'Nested publication cannot corrupt iteration.',
    ],
    sections: [
      {
        title: 'Choose a delivery contract',
        text: 'A synchronous event bus invokes handlers before publish returns; an asynchronous bus needs explicit completion and backpressure semantics. Start with synchronous ordered delivery over a snapshot of subscribers. Event payloads should be immutable or copied, because shared mutation makes later subscribers observe different facts.',
        code: 'subscribe<T>(type, handler): Unsubscribe\npublish<T>(event): DeliveryReport',
      },
      {
        title: 'Snapshot the listener list',
        text: 'A handler may unsubscribe itself or add another handler during delivery. Iterate a snapshot taken at publication start. New subscribers receive later events; a subscriber removed mid-publication still receives the current event if it was in the snapshot. This is one defensible contract, not an automatic language guarantee.',
        code: 'listeners = [...registry.get(event.type)]\nfor handler of listeners: invoke(handler, event)',
      },
      {
        title: 'Isolate failures and reentrancy',
        text: 'Catch each handler error and return an aggregate delivery report. Do not silently swallow errors. Nested publish can recurse until the stack overflows; queue nested publications if breadth-first behavior is desired, and bound the queue. The chosen strategy changes ordering and must be tested with two handlers that publish each other’s events.',
        code: 'report = {delivered: 0, failures: []}\ntry handler(event) catch error: report.failures.push(error)',
      },
      {
        title: 'Manage lifetime and pressure',
        text: 'Return an idempotent unsubscribe function and call it when a component is disposed. Strong listener references can leak objects. If moving to async delivery, decide whether a slow subscriber blocks all publishers, receives a bounded buffer or drops explicitly. This local bus is not durable messaging: a process crash loses undelivered work.',
        code: 'dispose(): unsubscribeOnce()\nasync buffer full → reject / block / documented drop',
      },
    ],
    tests: [
      ['Handler subscribes another', 'Next event only', 'Snapshot semantics.'],
      ['First handler throws', 'Others still called', 'Aggregate errors.'],
      ['Unsubscribe twice', 'No error', 'Idempotent cleanup.'],
      ['Nested event cycle', 'Bounded rejection', 'No unbounded recursion.'],
    ],
    extension:
      'Make one subscriber asynchronous without changing others’ delivery order.',
    tradeoff:
      'Awaiting handlers serially preserves simple ordering but adds latency. Concurrent promises improve throughput but weaken completion order. Report these guarantees explicitly.',
    starter:
      'type Handler<T> = (event: Readonly<T>) => void;\n// Implement subscribe, idempotent unsubscribe, snapshot delivery and DeliveryReport.\n',
  },
  {
    id: 'filesystem',
    name: 'In-memory file system',
    category: 'Composite structures',
    brief:
      'Model directories, files and paths with safe rename and explicit ownership.',
    invariants: [
      'A directory cannot become its own descendant.',
      'Sibling names are unique.',
      'A failed rename leaves the original tree intact.',
    ],
    sections: [
      {
        title: 'Model a tree with distinct nodes',
        text: 'A directory maps names to child nodes; a file owns bytes. A NodeId remains stable across renames while its path changes. Keep path parsing separate from tree mutation. Decide whether paths are absolute, how repeated separators work and whether dot and parent components are accepted.',
        code: 'Directory { id, children: Map<Name, Node> }\nFile { id, bytes: Uint8Array }\nresolve(path): Node',
      },
      {
        title: 'Resolve before mutating',
        text: 'Normalize components and walk from the root. A file cannot be traversed as a directory. Reject attempts to walk above root. If symbolic links are supported later, add a traversal limit and explicit following rules; ordinary path normalization does not stop symlink escapes in a real filesystem.',
        code: '/docs/../notes/a → /notes/a\nresolveParent(path) → {directory, finalName}',
      },
      {
        title: 'Rename as one operation',
        text: 'Resolve source and destination, check overwrite policy and ensure moving a directory cannot put it beneath itself. Validate everything before detaching the source. In a concurrent version, lock a stable ordering of ancestors or use a transactional store. A delete-then-insert implementation without rollback can lose the source on failure.',
        code: 'validate source, destination, cycle, collision\natomically: detach old parent; attach new parent',
      },
      {
        title: 'Define byte and deletion semantics',
        text: 'Return copies of file bytes if callers must not mutate storage implicitly. Reject deleting a nonempty directory unless recursive mode is explicit. Recursive traversal needs depth or iterative processing limits. Listing order should be stable if clients rely on it; a map’s incidental order is not a cross-language contract.',
        code: 'readFile() → copy(bytes)\nremove(nonEmptyDirectory, recursive=false) → error',
      },
    ],
    tests: [
      ['Move /a into /a/b', 'Reject', 'Cycle prevention.'],
      [
        'Rename onto existing file',
        'Policy-defined',
        'No accidental overwrite.',
      ],
      ['Mutate returned bytes', 'Storage unchanged', 'Copy boundary.'],
      ['Failed destination validation', 'Source survives', 'Atomic mutation.'],
    ],
    extension: 'Add symbolic links and concurrent rename.',
    tradeoff:
      'Parent pointers simplify ancestor checks but introduce another invariant to maintain. Immutable tree versions simplify snapshots but allocate more and require conflict handling.',
    starter:
      'type Node = FileNode | DirectoryNode;\n// Implement resolve, mkdir, read/write and atomic rename with cycle checks.\n',
  },
  {
    id: 'logging',
    name: 'Structured logger',
    category: 'Composition',
    brief:
      'Build filtering, formatting and output sinks with bounded buffering and predictable failure handling.',
    invariants: [
      'Disabled logs do not evaluate expensive message suppliers.',
      'Secrets are redacted before any sink sees them.',
      'A full buffer follows a documented policy.',
    ],
    sections: [
      {
        title: 'Separate record, policy and destination',
        text: 'A LogRecord contains severity, time, event name and structured fields. Logger applies filters and redaction; Formatter serializes; Sink transports. Inject time and sinks for tests. A lazy message supplier avoids building a large string when the level is disabled. Prefer structured fields to parsing prose later.',
        code: 'log(level, event, fieldsSupplier)\nif !enabled(level): return\nrecord = redact(fieldsSupplier())',
      },
      {
        title: 'Redact before fan-out',
        text: 'If console output is redacted but the remote sink receives raw fields, sensitive data still leaks. Redact at the shared record boundary, then hand immutable data to sinks. Use an allowlist for sensitive domains and never log auth headers, passwords or model keys. Nested objects and error causes need the same policy.',
        code: 'sanitized = redactor.apply(record)\nfor sink of sinks: sink.write(sanitized)',
      },
      {
        title: 'Bound asynchronous buffering',
        text: 'A network sink can be slower than producers. Bound records and bytes, then choose block, reject or drop-by-severity. Blocking an application request for logging can turn telemetry failure into an outage. Count dropped records and emit a summary without recursively using the same failing logger.',
        code: 'queue bytes + record bytes > budget → policy\nflush(batch) → acknowledge successful batch only',
      },
      {
        title: 'Flush and shutdown deliberately',
        text: 'Shutdown stops accepting new records, drains until a deadline and reports remaining drops. A retry can duplicate an already received batch; include stable record IDs if the destination deduplicates. Do not recursively log sink errors through the same sink. A synchronous emergency output is a separate fallback.',
        code: 'close(deadline): accepting=false; drainUntil(deadline)\nsinkError → fallback, never logger.log(sinkError)',
      },
    ],
    tests: [
      ['Disabled debug call', 'Supplier not called', 'Lazy contract.'],
      ['Nested password field', 'Redacted before sinks', 'Shared boundary.'],
      ['Slow sink fills queue', 'Documented overflow', 'Bounded memory.'],
      ['Sink throws', 'No recursive loop', 'Failure isolation.'],
    ],
    extension: 'Require audit events to survive process crashes.',
    tradeoff:
      'Best-effort logging prioritizes availability. Durable audit events need transactional persistence or a durable outbox, a different guarantee from an in-memory log buffer.',
    starter:
      'interface Sink { write(record: LogRecord): Promise<void>; flush(): Promise<void> }\n// Implement level filtering, redaction and bounded queue policy.\n',
  },
  {
    id: 'chess',
    name: 'Chess move engine',
    category: 'Rules & state',
    brief:
      'Validate moves, distinguish attacks from legal moves and preserve reversible game state.',
    invariants: [
      'A legal move never leaves the mover’s king in check.',
      'Move and undo restore all state.',
      'Attack detection does not recursively depend on legal-move generation.',
    ],
    sections: [
      {
        title: 'Keep board facts separate from rules',
        text: 'Board owns square occupancy. Position also owns side to move, castling rights, en-passant target and move counters. A Piece describes color and kind; it need not mutate the board itself. MoveGenerator produces candidates and Rules validates the resulting position. This makes pure tests possible.',
        code: 'Position { board, turn, castling, enPassant, clocks }\nMove { from, to, promotion? }',
      },
      {
        title: 'Separate attacks and legal moves',
        text: 'A pinned piece still matters to attack semantics, and pawn attacks differ from pawn advances. Generate attack squares using piece geometry and blockers, without asking whether each attacking move would leave that side in check. Generate candidate moves, apply a candidate and reject it if the mover’s king is attacked.',
        code: 'candidates(position)\nfor move: next = apply(position, move)\nkeep if !attacked(next, moverKing)',
      },
      {
        title: 'Capture all reversible state',
        text: 'Undo requires more than moving the piece back. Save captured pieces, castling rights, en-passant target and counters. En passant removes a pawn from a different square and can reveal a rook attack. Castling moves two pieces and has additional path-safety requirements. Promotion creates a chosen piece kind.',
        code: 'Undo { captured, previousRights, previousEP, previousClocks }\nundo(apply(position, move)) == position',
      },
      {
        title: 'Determine endings from position',
        text: 'If there are no legal moves, check whether the king is attacked to distinguish checkmate from stalemate. Repetition requires a position key including relevant rights and en-passant availability, not only visible pieces. State which draw rules and variants are in scope before claiming a complete engine.',
        code: 'legalMoves.length == 0:\n  inCheck ? CHECKMATE : STALEMATE',
      },
    ],
    tests: [
      ['Pinned piece exposes king', 'Illegal', 'Resulting king safety.'],
      [
        'En passant opens rook line',
        'Illegal if king attacked',
        'Captured square differs.',
      ],
      ['Move then undo', 'Exact equality', 'Full state restored.'],
      ['No moves, not in check', 'Stalemate', 'Not checkmate.'],
    ],
    extension: 'Add search without mutating the live game position.',
    tradeoff:
      'Copy-on-move is easy to reason about but allocates. Make/unmake is faster but every special move needs a correct undo record and strong property tests.',
    starter:
      'interface Rules { legalMoves(position: Position): Move[]; apply(position: Position, move: Move): Position }\n// Start with board moves and king safety; declare special-move scope.\n',
  },
  {
    id: 'reservation',
    name: 'Seat reservation',
    category: 'Ownership',
    brief:
      'Hold seats temporarily and confirm bookings without overselling when payment replies are delayed.',
    invariants: [
      'A seat has at most one confirmed booking.',
      'Expired holds cannot be confirmed silently.',
      'A retry reuses the same payment intent.',
    ],
    sections: [
      {
        title: 'Distinguish hold and booking',
        text: 'A Hold temporarily owns seat IDs until an expiry instant. A Booking confirms ownership. PaymentAttempt records an external operation independently. Putting all three into one boolean booked field cannot express timeout or expiration. Use stable IDs so a late callback refers to the same intent.',
        code: 'Hold { id, seatIds, expiresAt, version }\nBooking { id, holdId, state }\nPaymentAttempt { id, bookingId, outcome }',
      },
      {
        title: 'Claim all requested seats atomically',
        text: 'For a group of seats, either acquire the complete set or return a conflict. Partial holds need explicit user consent; do not leave stray reservations. Check availability and create the hold in one transaction with unique seat ownership. The expiry check uses a trusted clock at the ownership boundary.',
        code: 'transaction:\n  require all seats free or expired\n  assign seats to holdId, expiresAt',
      },
      {
        title: 'Reconcile payment after expiry',
        text: 'Payment can succeed after the hold has expired and another buyer has acquired the seat. Idempotency prevents a second charge, not overselling. Confirm only if the hold still owns every seat. Otherwise record a refund or a separately approved reacquisition path; do not overwrite the new owner.',
        code: 'paymentSuccess(attempt):\n  if stillOwnsUnexpiredHold: confirm\n  else: REFUND_PENDING',
      },
      {
        title: 'Protect retries and cleanup',
        text: 'Expiry cleanup is an optimization; reads and confirmations must check expiry themselves. Release operations include the expected hold ID so an old cleanup job cannot free a new owner’s seat. Persist callback processing and booking state atomically, and make duplicate provider callbacks return the prior outcome.',
        code: 'release(seatId, expectedHoldId)\ncallbackId unique → apply once',
      },
    ],
    tests: [
      ['Two buyers, same seat', 'One hold', 'Atomic ownership.'],
      ['Payment after hold expiry', 'Refund workflow', 'No oversell.'],
      ['Old cleanup after reassignment', 'No release', 'Expected owner.'],
      ['Duplicate payment callback', 'Same outcome', 'Idempotent processing.'],
    ],
    extension: 'Confirm five adjacent seats while one becomes unavailable.',
    tradeoff:
      'A single transaction makes group ownership simple but can contend on hot events. Partitioning by event preserves local atomicity; cross-event bundles need compensation.',
    starter:
      'interface SeatStore { holdAll(seats: string[], owner: string, expiresAt: number): Promise<boolean> }\n// Implement confirmation with expiry and payment reconciliation.\n',
  },
  {
    id: 'connection-pool',
    name: 'Connection pool',
    category: 'Resource management',
    brief:
      'Bound reusable connections, queue borrowers fairly and recover from cancellation and broken resources.',
    invariants: [
      'Each connection has at most one borrower.',
      'Created plus creating connections never exceeds the limit.',
      'A lease can be returned only once.',
    ],
    sections: [
      {
        title: 'Model the lease boundary',
        text: 'Pool owns idle connections, active leases and pending creates. A borrower receives a lease with release rather than raw ownership of the pool entry. Lease identity makes double release detectable. Factory creates connections, Validator checks reuse and a Clock supports acquisition deadlines.',
        code: 'acquire(deadline, signal): Promise<Lease>\nLease { connection, release(): void }',
      },
      {
        title: 'Reserve capacity before awaiting creation',
        text: 'Two callers can observe the same spare slot and both start creating. Increment the creating count before awaiting the factory. On success, convert the reservation into a live connection; on failure, free it and wake a waiter. The bound counts in-flight creation as well as existing resources.',
        code: 'if total + creating < limit:\n  creating++\n  try create() finally creating--',
      },
      {
        title: 'Handle cancellation and release races',
        text: 'A waiter may cancel just as a connection is assigned. Make state transition from waiting to leased or cancelled atomic within the coordinator. If cancellation wins, pass the resource to another waiter or idle storage. A release checks its lease token and becomes a no-op or defined error on repetition, never a duplicate idle entry.',
        code: 'WAITING → LEASED | CANCELLED\nrelease(token): only ACTIVE token may return resource',
      },
      {
        title: 'Drain without stranding borrowers',
        text: 'Closing the pool rejects new acquisitions and pending waiters, then waits for leases to return until a deadline. Decide whether outstanding connections are forcibly closed. Broken connections are destroyed rather than reused. Health checks add latency; testing on borrow can be safer than assuming idle resources remain valid.',
        code: 'close(): accepting=false; reject waiters\nreturned after close → destroy\nbroken lease → destroy and replenish on demand',
      },
    ],
    tests: [
      [
        'Concurrent creation at last slot',
        'One starts',
        'Count creating resources.',
      ],
      ['Double release', 'No duplicate idle entry', 'Lease identity.'],
      [
        'Cancel during assignment',
        'Resource reclaimed',
        'Single terminal transition.',
      ],
      [
        'Close with waiting borrower',
        'Reject promptly',
        'No stranded promise.',
      ],
    ],
    extension: 'Add per-tenant fairness while limiting global connections.',
    tradeoff:
      'FIFO is predictable but a slow or abandoned waiter can block progress unless cancellation is correct. Tenant queues improve isolation but require a documented sharing policy.',
    starter:
      'interface Lease<T> { resource: T; release(): void }\n// Implement bounded acquire, cancellation and one-time release.\n',
  },
];
export const lldLibrary: LLDCase[] = [...originals, ...extra];

export const lldReferences: Record<string, { title: string; url: string }[]> = {
  lru: [
    {
      title: 'Java LinkedHashMap: insertion order and access order',
      url: 'https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/util/LinkedHashMap.html',
    },
  ],
  pubsub: [
    {
      title: 'Node.js EventEmitter: compare its delivery and error contract',
      url: 'https://nodejs.org/api/events.html',
    },
  ],
  chess: [
    {
      title: 'FIDE Laws of Chess: legal moves and endings',
      url: 'https://handbook.fide.com/chapter/E012023',
    },
  ],
  reservation: [
    {
      title: 'PostgreSQL: row locks and deadlocks',
      url: 'https://www.postgresql.org/docs/current/explicit-locking.html',
    },
  ],
  scheduler: [
    {
      title: 'PostgreSQL: locks and transaction ownership',
      url: 'https://www.postgresql.org/docs/current/explicit-locking.html',
    },
  ],
};
