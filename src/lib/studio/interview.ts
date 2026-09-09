import { additionalScenarios } from './interview-cases';
import { type ReasoningReview } from './interview-review';
import { initialDesign, reachable, type Design } from './model';
export const phases = [
  'Clarify',
  'Estimate',
  'Design',
  'Deep dive',
  'Pressure test',
  'Deliver',
];
export const roles = [
  'SDE 2',
  'Senior engineer',
  'Staff / Principal',
  'Architect / CTO',
];
export type Scenario = {
  id: string;
  name: string;
  domain: string;
  duration: number;
  brief: string;
  scope: string;
  scale: string;
  quality: string;
  data: string;
  failure: string;
  llD: string;
  leadership: string;
  lesson: string[];
};
const originalScenarios: Scenario[] = [
  {
    id: 'shortener',
    name: 'A global link shortener',
    domain: 'Read-heavy systems',
    duration: 45,
    brief:
      'We want people to create short links and share them anywhere. Design the system you would put in production.',
    scope:
      'Creating links and redirecting are in scope. Custom aliases are useful but secondary. Analytics can be asynchronous. Links can expire or be removed for abuse.',
    scale:
      'Assume 100 million redirects/day and 1 million new links/day. Peak traffic can reach five times the average. Links are retained for one year unless expired.',
    quality:
      'Redirect p95 target is 100 ms in the serving region. Target 99.9% successful valid redirects. Abuse removals must propagate within 60 seconds.',
    data: 'A link has a unique code, destination URL, creator, status, and optional expiry. Creators can remove their own links. Do not assume destinations are trusted.',
    failure:
      'A popular influencer shares one link. It now gets 40% of traffic, and the read cache becomes unavailable. Walk through the next 60 seconds and your protection plan.',
    llD: 'Model code generation and collision handling. Define redirect and deletion contracts, including retries and cache invalidation.',
    leadership:
      'The team has four engineers and a launch in six weeks. Decide what to defer and what evidence would justify a second region.',
    lesson: ['cache', 'shortener', 'failure'],
  },
  {
    id: 'chat',
    name: 'A team messaging platform',
    domain: 'Realtime & ordering',
    duration: 45,
    brief:
      'Our customers need a team chat product that works on mobile and desktop. Design the messaging system.',
    scope:
      'Support one-to-one chats, groups up to 500 members, offline delivery, and multiple devices. Voice, video, and end-to-end encryption implementation are out of scope for this session.',
    scale:
      'Assume 5 million daily users, 500k concurrent connections, and 20 million messages/day with a 10× peak. Keep message history for a year.',
    quality:
      'Online messages should arrive within 500 ms at p95 in one region. Preserve order within a conversation. Acknowledged messages must survive a single-node failure.',
    data: 'Each message has a client-generated operation ID, conversation ID, sender, sequence or ordering metadata, and body. Membership controls reads and writes.',
    failure:
      'A gateway region loses connectivity for two minutes. Devices reconnect together and resend uncertain messages. Preserve ordering without duplicating visible messages.',
    llD: 'Model message state transitions from pending to persisted to delivered. Define idempotent send and reconnect cursor contracts.',
    leadership:
      'Enterprise customers want retention controls, but the mobile team wants richer media. Explain sequencing, ownership, and how the API can evolve.',
    lesson: ['queue', 'replication', 'delivery'],
  },
  {
    id: 'feed',
    name: 'A personalized social feed',
    domain: 'Fan-out & skew',
    duration: 45,
    brief:
      'People follow creators and want a fresh, personalized home feed. Design the feed system.',
    scope:
      'Posting text and media references, following users, and a paginated feed are required. Begin with chronological ranking and leave room for personalization. Ads are out of scope.',
    scale:
      'Assume 20 million daily users, 10 feed reads/user/day, and 2 million posts/day. A few creators have over 10 million followers. Peak is 5× average.',
    quality:
      'Feed p95 target is 300 ms. A new post may take up to 5 seconds to appear. Privacy changes and deletion need an explicit enforcement plan.',
    data: 'Posts, follower edges, feed references, and visibility rules are distinct data. Store media objects separately. Stable cursor pagination must tolerate new posts.',
    failure:
      'A celebrity with 20 million followers posts during a traffic spike. Fan-out workers fall 15 minutes behind. Change the design without taking all feeds offline.',
    llD: 'Model a feed candidate source and ranking strategy. Define deduplication, visibility filtering, and stable pagination.',
    leadership:
      'Your proposed precomputed feeds exceed the storage budget. Compare a hybrid design and explain migration milestones and measurable success.',
    lesson: ['feed', 'cache', 'replication'],
  },
  {
    id: 'booking',
    name: 'A ticket booking service',
    domain: 'Contention & invariants',
    duration: 50,
    brief:
      'We are launching ticket sales for major events. Customers must be able to find an event and book seats. Design the system.',
    scope:
      'Include seat selection, time-limited holds, payment, and confirmation. Seat inventory is finite. Search can be eventually consistent; confirmed allocation cannot oversell.',
    scale:
      'Assume 100k buyers arrive in one minute for 10k seats at a popular event. Normal traffic is much lower. Holds last five minutes.',
    quality:
      'No seat may be confirmed for two buyers. Payment timeouts have uncertain outcomes. Show a clear pending state and use a bounded waiting room if needed.',
    data: 'Event, seat, hold with expiry, order, and payment attempt have separate identities. The seat allocation invariant must be protected at the authoritative owner.',
    failure:
      'The payment provider succeeds but its response is lost. The hold expires while another customer is waiting. Show how you resolve the first buyer’s outcome without double allocation.',
    llD: 'Model Hold and Reservation lifecycles, use conditional state transitions, and define atomic seat allocation and retry contracts.',
    leadership:
      'Sales launch next month. A full distributed inventory system would take two quarters. Defend a simpler launch design and its explicit capacity limits.',
    lesson: ['concurrency', 'transactions', 'api'],
  },
  {
    id: 'payments',
    name: 'A payment orchestration service',
    domain: 'Correctness & recovery',
    duration: 50,
    brief:
      'Our marketplace wants one checkout API that works with multiple payment providers. Design payment orchestration.',
    scope:
      'Create payment intents, authorize or charge, consume provider callbacks, and expose status. Refunds are required. This is a technical exercise; bank settlement and regulatory implementation are out of scope.',
    scale:
      'Assume 2 million payment attempts/day with 8× peak. Provider responses may take several seconds. Callbacks can arrive late or more than once.',
    quality:
      'Never intentionally charge twice for one customer intent. Expose uncertain status honestly. Maintain an audit trail and reconcile unresolved attempts.',
    data: 'Separate customer intent, provider attempt, callback identity, and ledger/reference records. Do not store raw card data in this design; use provider tokens.',
    failure:
      'Provider A times out after possibly authorizing a payment. Product wants automatic failover to Provider B immediately. Explain the duplicate-charge risk and your alternative.',
    llD: 'Model the payment state machine and provider adapter interface. Define idempotency-key scope, payload conflicts, and reconciliation responsibilities.',
    leadership:
      'One vendor is cheaper but has more uncertain outcomes. Compare total cost, support burden, customer harm, and the evidence for routing policy.',
    lesson: ['api', 'delivery', 'failure'],
  },
  {
    id: 'marketplace',
    name: 'A marketplace that outgrew its monolith',
    domain: 'Architecture & leadership',
    duration: 60,
    brief:
      'A successful marketplace is expanding internationally. The monolith is slowing teams down. Design the next stage of the platform.',
    scope:
      'Cover catalog, inventory, checkout, and fulfillment. Preserve completed orders and support gradual migration. A full rewrite is not a requirement. Explain what remains together.',
    scale:
      'Assume 10 million daily users, 500k orders/day, 4× peak, and twelve product teams. Today one region serves all traffic. Two new markets launch this year.',
    quality:
      'Checkout correctness takes priority over fresh catalog views. Propose SLOs and recovery targets, and justify them using business impact rather than assuming five nines.',
    data: 'Order snapshots, inventory ownership, customer access, and fulfillment events need clear boundaries. Existing data and old consumers cannot disappear at migration start.',
    failure:
      'The budget is cut 30%, the new region deadline stays fixed, and a database migration causes elevated checkout errors. Reprioritize and describe your immediate incident response.',
    llD: 'Choose one boundary, define its API and state transitions, and show compatibility with the current monolith during migration.',
    leadership:
      'Present a phased roadmap with team ownership, unit economics, measurable exit criteria, and the risks you will explicitly accept.',
    lesson: ['migrations', 'boundaries', 'economics'],
  },
];
export const scenarios: Scenario[] = [
  ...originalScenarios,
  ...additionalScenarios,
];
export type Message = {
  id: string;
  role: 'interviewer' | 'candidate' | 'event';
  text: string;
  at: number;
};
export type Session = {
  id: string;
  scenarioId: string;
  role: string;
  mode: 'guided' | 'mock';
  startedAt: number;
  deadline: number;
  phase: number;
  turnsInPhase: number;
  messages: Message[];
  design: Design;
  contract: string;
  notes: string;
  status: 'active' | 'finished';
  finishedAt?: number;
  pausedAt?: number;
  asked: string[];
  disrupted: boolean;
  audit?: AuditEntry[];
  extensions?: number;
};
export function newSession(
  s: Scenario,
  role: string,
  mode: 'guided' | 'mock',
  now = Date.now(),
): Session {
  return {
    id: crypto.randomUUID(),
    scenarioId: s.id,
    role,
    mode,
    startedAt: now,
    deadline: now + s.duration * 60000,
    phase: 0,
    turnsInPhase: 0,
    messages: [
      {
        id: crypto.randomUUID(),
        role: 'interviewer',
        text: `Thanks for joining. We have ${s.duration} minutes. ${s.brief}\n\nTake a moment to frame the problem. I’ll answer clarifying questions, look at your shared design, and challenge decisions as we go. You can use the canvas and contract notebook throughout.`,
        at: now,
      },
    ],
    design: { nodes: [{ ...initialDesign.nodes[0] }], edges: [] },
    contract: '',
    notes: '',
    status: 'active',
    asked: [],
    disrupted: false,
  };
}
const msg = (role: Message['role'], text: string): Message => ({
  id: crypto.randomUUID(),
  role,
  text,
  at: Date.now(),
});
export function nextPrompt(session: Session, scenario: Scenario) {
  const d = session.design,
    combined = session.messages
      .filter((m) => m.role === 'candidate')
      .map((m) => m.text)
      .join(' ')
      .toLowerCase();
  const names = d.nodes.map((n) => n.name).join(', ') || 'an empty model';
  const candidates: [string, string][] =
    session.phase === 0
      ? [
          [
            'scope',
            'Before we draw anything, what is the primary user journey and what are you deliberately excluding?',
          ],
          [
            'quality',
            'Which operation needs the strongest correctness guarantee, and which can tolerate delay? Ask me for the product constraints you need.',
          ],
          [
            'assumptions',
            'Restate the requirements we agreed on, including one measurable target. Then tell me which assumption is most likely to change your design.',
          ],
        ]
      : session.phase === 1
        ? [
            [
              'estimate',
              `Work through average and peak demand with units. Don’t optimize for a precise-looking number. Ask for scale if you need it.`,
            ],
            [
              'storage',
              'Now estimate retained data, including the assumptions behind record size and replication. Which estimate affects your first architecture choice?',
            ],
            [
              'headroom',
              'How much capacity remains during a node loss or deployment? Explain the bottleneck you expect before we move on.',
            ],
          ]
        : session.phase === 2
          ? [
              [
                'draw',
                `I can see ${names}. Walk me through one complete request and its response. Put the important services and data owners on the canvas.`,
              ],
              ...(!d.nodes.some((n) => n.kind === 'database')
                ? [
                    [
                      'data-owner',
                      'Where is the authoritative state? Add or identify the component that protects the key invariant.',
                    ] as [string, string],
                  ]
                : []),
              [
                'connections',
                d.edges.length === 0
                  ? 'The canvas has no connections yet. Show which components call each other, and label synchronous versus asynchronous work.'
                  : `You have ${d.edges.length} connections. Which one is the most dangerous dependency, and what happens when it stalls?`,
              ],
              [
                'alternative',
                'Pick the most consequential box in your design. Defend it against one simpler alternative, including the cost of your choice.',
              ],
            ]
          : session.phase === 3
            ? [
                ...(/cache|redis/.test(combined) ||
                d.nodes.some((n) => n.kind === 'cache')
                  ? [
                      [
                        'cache-probe',
                        'You introduced caching. Describe the exact key, invalidation rule, and a race where a stale value could reappear. How does the user experience that race?',
                      ] as [string, string],
                    ]
                  : []),
                ...(/queue|kafka|event|async/.test(combined) ||
                d.nodes.some((n) => n.kind === 'queue')
                  ? [
                      [
                        'queue-probe',
                        'You chose asynchronous work. A consumer commits the side effect and crashes before acknowledging. What happens on redelivery? Show the operation identity.',
                      ] as [string, string],
                    ]
                  : []),
                ['lld', scenario.llD],
                [
                  'race',
                  'Two requests arrive concurrently for the same business entity. Walk through a concrete interleaving and show exactly where the invariant is enforced.',
                ],
                [
                  'contract',
                  'Make the failure contract concrete in the notebook: inputs, result, retry semantics, and what the caller sees when the outcome is unknown.',
                ],
              ]
            : session.phase === 4
              ? [
                  ['disruption', scenario.failure],
                  [
                    'recover',
                    'Talk through detection, containment, and recovery in that order. Which metric tells you whether your mitigation actually helped users?',
                  ],
                  [
                    'revision',
                    'Revise the shared design or contract for this failure. What extra complexity did your fix introduce?',
                  ],
                ]
              : [
                  [
                    'deliver',
                    session.role === 'Architect / CTO' ||
                    session.role === 'Staff / Principal'
                      ? scenario.leadership
                      : 'Summarize your design, the hardest tradeoff, and what you would implement first. Identify one test that could disprove your key assumption.',
                  ],
                  [
                    'rollout',
                    'Explain rollout, rollback, and ownership. What evidence must be true before you increase exposure?',
                  ],
                  [
                    'residual',
                    'What is the biggest remaining risk? State what you would defer and the trigger that would make you revisit it.',
                  ],
                ];
  const next = candidates.find(
    ([key]) => !session.asked.includes(`${session.phase}:${key}`),
  );
  if (next) return { key: `${session.phase}:${next[0]}`, text: next[1] };
  return {
    key: `${session.phase}:synthesis`,
    text: 'Let’s make this concrete: summarize the decision, the evidence, and its consequence. When you are ready, present the next part of your design.',
  };
}
export type AuditEntry = {
  messageId: string;
  phase: number;
  passed: string[];
  missing: string[];
  at: number;
  extension: number;
  model?: string;
  rationale?: string;
};
export function assignedScenario(role: string, history: Session[]) {
  const used = new Set(
    history.filter((h) => h.role === role).map((h) => h.scenarioId),
  );
  const pool =
    role === roles[3]
      ? scenarios.filter(
          (s) => !['parking', 'library', 'elevator'].includes(s.id),
        )
      : scenarios;
  return (
    pool.find((s) => !used.has(s.id)) ??
    pool[history.filter((h) => h.role === role).length % pool.length]
  );
}
export const auditCriteria = [
  [
    'Describe an actor and concrete action',
    'Defer an optional feature explicitly',
    'Commit to a target within the minimum brief',
  ],
  [
    'State demand with units',
    'Show calculation and peak assumption',
    'Explain the capacity consequence',
  ],
  [
    'Connect client, service and authoritative database',
    'Walk the request through your components',
    'Compare an alternative and its downside',
  ],
  [
    'Define a concrete input and result',
    'Explain a concurrent or repeated operation',
    'Name the mechanism protecting the invariant',
  ],
  [
    'Detect impact with a metric',
    'Contain the failure and explain recovery',
    'State a remaining cost or risk',
  ],
  [
    'Give a rollout and rollback condition',
    'Assign ownership and a success measure',
    'Say what you defer and why',
  ],
];
// Evidence checks guide follow-ups; they do not establish semantic correctness.
export function auditResponse(s: Session, text: string) {
  const t = text.toLowerCase();
  const substantive = t.trim().split(/\s+/).length >= 22;
  const number =
    /\d[\d,.]*\s*(ms|seconds|%|rps|qps|requests|reads|writes|\/s|kb|mb|gb|million|users)/.test(
      t,
    );
  const has = (r: RegExp) => substantive && r.test(t);
  const actor =
    has(/\b(user|customer|buyer|creator|client|device|team)\b/) &&
    has(
      /\b(create|send|read|book|pay|redirect|view|purchase|browse|order|share)\w*\b/,
    );
  const client = s.design.nodes.find((n) => n.kind === 'client'),
    api = s.design.nodes.find((n) => n.kind === 'service'),
    db = s.design.nodes.find((n) => n.kind === 'database');
  const connected =
    !!client &&
    !!api &&
    !!db &&
    reachable(s.design, client.id, api.id) &&
    reachable(s.design, api.id, db.id);
  const checks = [
    [
      actor,
      has(/out of scope|exclude|defer|not support/),
      substantive && number && has(/target|within|under|at most|slo|p95|p99/),
    ],
    [
      substantive && number,
      has(/86400|86,400|divide|divid|×|\*|per day.*per second/) &&
        has(/peak|burst/),
      has(/capacity|bottleneck|replica|headroom|shard/) &&
        has(/because|therefore|so |means|need/),
    ],
    [
      connected,
      has(/request|response|lookup|write|read/) &&
        has(/then|first|after|through|→/),
      has(/instead|alternative|versus|compared/) &&
        has(/cost|risk|but |however|complex|stale|delay/),
    ],
    [
      has(/input|POST |GET |key|identifier|idempotency/i) &&
        has(/return|result|response|status|output/),
      has(/concurrent|retry|duplicate|race|twice/),
      has(
        /unique constraint|compare.and.swap|transaction|lock|conditional|dedup|idempotency|atomic/,
      ) && has(/because|ensur|prevent|reject|protect/),
    ],
    [
      has(/monitor|alert|detect|measure/) && number,
      has(/limit|shed|isolate|pause|circuit|fence|disable/) &&
        has(/recover|replay|restore|promot|rollback|reconcil/),
      has(/risk|cost|trade.off|but |however/),
    ],
    [
      has(/rollout|canary|migration|phase/) && has(/rollback|revert|abort/),
      has(/owner|team|responsib/) && number,
      has(/defer|postpone|later/) && has(/because|until|when/),
    ],
  ][Math.min(5, s.phase)];
  if (s.phase === 4 && (s.extensions ?? 0) > 0) {
    const challenge = extensionPrompt(
      s,
      scenarios.find((x) => x.id === s.scenarioId)!,
    );
    checks[1] =
      checks[1] &&
      (/peak demand doubles/.test(challenge)
        ? has(/budget|cost/) && has(/double|2×|2x|twice/)
        : /second region/.test(challenge)
          ? has(/region/) && has(/old client|compatib|migration/)
          : has(/team|staff/) && has(/slo|customer|milestone/));
  }
  return {
    passed: auditCriteria[s.phase].filter((_, i) => checks[i]),
    missing: auditCriteria[s.phase].filter((_, i) => !checks[i]),
  };
}
export function extensionPrompt(s: Session, scenario: Scenario) {
  const level = roles.indexOf(s.role),
    round = s.extensions ?? 0;
  const variants = [
    scenario.failure,
    `Keep the same ${scenario.name.toLowerCase()} design. Your peak demand doubles, but the infrastructure budget is fixed. Revise one decision, quantify the effect, and name the customer promise you would protect.`,
    `A second region must launch while old clients keep working. During migration, one region becomes isolated. Keep the same business invariant: describe ownership, containment, recovery and rollback.`,
    `The team is halved and a major customer requires a tighter SLO. Defend the next milestone, the cost you accept, and the evidence that would reverse your decision.`,
  ];
  return variants[Math.min(3, round === 0 ? 0 : Math.max(round, level - 1))];
}
export function respond(
  session: Session,
  text: string,
  review?: ReasoningReview,
): Session {
  const scenario = scenarios.find((s) => s.id === session.scenarioId)!;
  let next: Session = {
    ...session,
    messages: [...session.messages, msg('candidate', text)],
  };
  const t = text.toLowerCase();
  const topics: [RegExp, string, string][] = [
    [
      /\b(scale|traffic|users|volume|requests per|qps|rps|daily|how many)\b/,
      'Scale',
      scenario.scale,
    ],
    [
      /\b(latency|slo|sla|availability|reliability|consistency|durability|target)\b/,
      'Quality',
      scenario.quality,
    ],
    [
      /\b(scope|feature|requirements|functional|support)\b/,
      'Scope',
      scenario.scope,
    ],
    [
      /\b(retention|schema|privacy|data model|store what|what data)\b/,
      'Data',
      scenario.data,
    ],
  ];
  const isQuestion =
    /^(what|how many|can we|could you|clarify|tell me|do we|which|what about)\b/.test(
      t,
    ) ||
    (/\?/.test(t) && text.length < 260);
  if (isQuestion) {
    const answers = topics.filter(([r]) => r.test(t));
    if (answers.length)
      return {
        ...next,
        messages: [
          ...next.messages,
          msg(
            'interviewer',
            answers
              .map(([, name, answer]) => name + ': ' + answer)
              .join('\n\n') + '\n\nHow does that change your approach?',
          ),
        ],
      };
  }
  if (/\b(hint|help me|coach)\b/.test(t) && session.mode === 'guided')
    return {
      ...next,
      messages: [
        ...next.messages,
        msg(
          'interviewer',
          `Coaching pause: ${coaching[session.phase]} Apply that to this problem; defend the tradeoff you choose.`,
        ),
      ],
    };
  if (
    session.messages.some(
      (m) => m.role === 'candidate' && m.text.trim().toLowerCase() === t.trim(),
    )
  )
    return {
      ...next,
      messages: [
        ...next.messages,
        msg(
          'interviewer',
          'That repeats your earlier answer. The conditions or missing evidence still need a response. Show what changes in your design and why; repeating the same decision does not address the new constraint.',
        ),
      ],
    };
  const evidence = review
      ? {
          passed: auditCriteria[session.phase].filter((_, i) =>
            review.passed.includes(i),
          ),
          missing: auditCriteria[session.phase].filter(
            (_, i) => !review.passed.includes(i),
          ),
        }
      : auditResponse(session, text),
    entry: AuditEntry = {
      messageId: next.messages[next.messages.length - 1].id,
      phase: session.phase,
      ...evidence,
      at: Date.now(),
      extension: session.extensions ?? 0,
      ...(review ? { model: review.model, rationale: review.rationale } : {}),
    };
  next.audit = [...(session.audit ?? []), entry];
  // Accumulate evidence within this phase/challenge, allowing a real multi-turn discussion.
  const current = review
    ? [entry]
    : next.audit.filter(
        (a) =>
          a.phase === session.phase &&
          a.extension === (session.extensions ?? 0),
      );
  const lastModel = current.map((a) => !!a.model).lastIndexOf(true);
  const passed = new Set(
    current.slice(Math.max(0, lastModel)).flatMap((a) => a.passed),
  );
  const missing = auditCriteria[session.phase].filter((c) => !passed.has(c));
  if (missing.length) {
    const prompt =
      session.phase === 4 && (session.extensions ?? 0) > 0
        ? {
            key: '4:extension-followup',
            text:
              extensionPrompt(session, scenario) +
              ' Apply the changed condition explicitly.',
          }
        : nextPrompt(next, scenario);
    next.asked = [...next.asked, prompt.key];
    return {
      ...next,
      messages: [
        ...next.messages,
        msg(
          'interviewer',
          review
            ? review.followUp
            : `${evidence.passed.length ? 'I have recorded evidence for: ' + evidence.passed.join('; ') + '.\n\n' : ''}Let’s stay with this decision. ${missing[0]}. ${session.phase === 2 && !passed.has(auditCriteria[2][0]) ? 'Use the shared canvas to connect the request path.' : prompt.text}`,
        ),
      ],
    };
  }
  if (
    session.phase === 4 &&
    (session.extensions ?? 0) < Math.max(1, roles.indexOf(session.role))
  ) {
    next.extensions = (session.extensions ?? 0) + 1;
    next.disrupted = true;
    return {
      ...next,
      messages: [
        ...next.messages,
        msg(
          'event',
          `Constraint round ${next.extensions + 1}. Your previous reasoning is preserved.`,
        ),
        msg(
          'interviewer',
          `You covered the evidence I was looking for. Now let’s change the conditions. ${extensionPrompt(next, scenario)} Tell me what breaks in your existing design before proposing a fix.`,
        ),
      ],
    };
  }
  if (session.phase < 5) {
    next.phase = session.phase + 1;
    next.turnsInPhase = 0;
    next.disrupted = next.disrupted || next.phase === 4;
    const prompt =
      next.phase === 4
        ? { key: '4:disruption', text: extensionPrompt(next, scenario) }
        : nextPrompt(next, scenario);
    next.asked = [...next.asked, prompt.key];
    return {
      ...next,
      messages: [
        ...next.messages,
        msg(
          'event',
          `Evidence recorded · ${phases[session.phase]} → ${phases[next.phase]}`,
        ),
        msg('interviewer', prompt.text),
      ],
    };
  }
  return {
    ...next,
    messages: [
      ...next.messages,
      msg(
        'interviewer',
        'Your delivery plan has evidence across this rubric. Before we close: which assumption is least certain, how would you test it, and what would make you reverse your choice? You can end the session to inspect the full audit.',
      ),
    ],
  };
}
export function presentDesign(s: Session): Session {
  const text = `Design walkthrough: ${s.design.nodes.length} components and ${s.design.edges.length} connections.\n${s.design.nodes.map((n) => `${n.name}: ${n.detail}`).join('\n')}\n${s.design.edges.map((e) => `${s.design.nodes.find((n) => n.id === e.from)?.name} → ${s.design.nodes.find((n) => n.id === e.to)?.name}: ${e.label}`).join('\n')}${s.contract ? '\nContract notes:\n' + s.contract : ''}`;
  return respond(s, text);
}
export const coaching = [
  'Frame the primary actor and journey. Ask for scale and quality constraints. Separate requirements from your proposed solution.',
  'Use daily operations / 86,400, then apply a stated peak factor. Retained bytes = writes × record size × retention. Keep units visible.',
  'Begin with client, service, and authoritative storage. Walk a request through every edge. Add complexity only when it addresses a named constraint.',
  'Pick the hardest invariant. Define the API or class contract, then walk two concurrent calls and a retry.',
  'A partial failure leaves an uncertain outcome. Bound work, identify idempotency and recovery, and define user-visible behavior.',
  'Present the sequence, not just the end state. State the largest risk, the rollout check, the owner, and the condition for revisiting your choice.',
];
export type Evidence = {
  name: string;
  observed: boolean;
  evidence: string;
  next: string;
  lesson: string;
};
export function debrief(s: Session): Evidence[] {
  const candidate = s.messages.filter((m) => m.role === 'candidate');
  const find = (r: RegExp) => candidate.find((m) => r.test(m.text));
  const check = (
    name: string,
    r: RegExp,
    next: string,
    lesson: string,
  ): Evidence => {
    const m = find(r);
    return {
      name,
      observed: !!m,
      evidence: m
        ? m.text.slice(0, 260) + (m.text.length > 260 ? '…' : '')
        : 'No matching discussion was recorded.',
      next,
      lesson,
    };
  };
  return [
    check(
      'Requirements & scope',
      /\b(scope|requirements|users|latency|slo|out of scope)\b/i,
      'State the actor, excluded features, workload, and measurable quality target.',
      'requirements',
    ),
    check(
      'Quantitative reasoning',
      /\d[\d,.]*\s*(rps|qps|requests|req|bytes|kb|mb|gb|tb|ms|seconds|\/s|million|users|writes|reads)/i,
      'Connect a demand estimate, its units, and peak assumption to one capacity decision.',
      'numbers',
    ),
    {
      name: 'Connected architecture',
      observed: s.design.nodes.length >= 3 && s.design.edges.length >= 2,
      evidence: `Your canvas contains ${s.design.nodes.length} components and ${s.design.edges.length} connections.`,
      next: 'Trace a complete request and identify the source of truth, bottleneck, and failure boundary.',
      lesson: 'balance',
    },
    {
      name: 'Low-level contract',
      observed: s.contract.trim().length >= 80,
      evidence: s.contract.trim()
        ? s.contract.slice(0, 260)
        : 'No contract was recorded.',
      next: 'Define inputs, outputs, invariants, concurrency protection, and retry semantics.',
      lesson: 'objects',
    },
    check(
      'Failure & recovery',
      /\b(retry|idempot|timeout|failover|rollback|recovery|backpressure|reconcil|dedup)/i,
      'Walk through an uncertain outcome and show how the design avoids duplicate effects.',
      'failure',
    ),
    check(
      'Alternatives & consequences',
      /\b(trade.?off|alternative|instead|however|cost|simpler|because|versus)\b/i,
      'Compare two viable designs and name the consequence of your selected option.',
      'decisions',
    ),
    check(
      'Delivery & ownership',
      /\b(rollout|migration|owner|team|budget|cost per|milestone|rollback)\b/i,
      'Name an owner, phased rollout, success measure, and rollback or exit condition.',
      'migrations',
    ),
  ];
}
