import { lessons } from './curriculum';
export const learningParts = [
  {
    id: 'requests',
    title: 'Requests & requirements',
    description: 'Trace a request and define what the system must promise.',
    modules: [
      {
        id: 'frame',
        title: 'Frame the problem',
        lessons: ['request', 'requirements', 'numbers'],
        outcome:
          'Describe the request path, customer needs and an initial demand estimate.',
        prerequisite: 'Basic programming',
        practice: 'lab/tour',
        requires: [],
      },
      {
        id: 'network',
        title: 'Follow the network',
        lessons: ['dns', 'tcp', 'tls'],
        outcome:
          'Explain name resolution, transport failures and secure connections.',
        prerequisite: 'Frame the problem',
        practice: 'lab/10/1',
        requires: ['frame'],
      },
      {
        id: 'contracts',
        title: 'Define the service contract',
        lessons: ['http-methods', 'serialization', 'api'],
        outcome:
          'Specify safe retries and compatible request and response formats.',
        prerequisite: 'Follow the network',
        practice: 'learn/api',
        requires: ['network'],
      },
    ],
  },
  {
    id: 'performance',
    title: 'Performance & capacity',
    description: 'Measure a bottleneck before choosing how to scale.',
    modules: [
      {
        id: 'resources',
        title: 'Find resource constraints',
        lessons: ['complexity', 'cpu-io', 'memory', 'disk'],
        outcome: 'Identify whether CPU, memory or storage limits the workload.',
        prerequisite: 'Basic data structures',
        practice: 'lab/load',
        requires: ['frame'],
      },
      {
        id: 'load',
        title: 'Measure under load',
        lessons: ['latency', 'percentiles', 'little-law', 'load-testing'],
        outcome: 'Distinguish throughput, tail latency and a growing queue.',
        prerequisite: 'Find resource constraints',
        practice: 'lab/load',
        requires: ['resources'],
      },
      {
        id: 'capacity',
        title: 'Plan service capacity',
        lessons: ['state', 'balance', 'capacity-planning'],
        outcome: 'Distribute requests and reserve capacity for a failure.',
        prerequisite: 'Measure under load',
        practice: 'lab/0/1',
        requires: ['load'],
      },
    ],
  },
  {
    id: 'services',
    title: 'Data access & service design',
    description: 'Choose components from access patterns and constraints.',
    modules: [
      {
        id: 'access',
        title: 'Design data access',
        lessons: ['storage', 'indexes', 'pagination'],
        outcome: 'Choose a store, an index and a stable pagination contract.',
        prerequisite: 'Service contracts; basic tables and keys',
        practice: 'learn/indexes',
        requires: ['contracts'],
      },
      {
        id: 'distribute',
        title: 'Distribute the data',
        lessons: ['partitioning', 'consistent-hashing'],
        outcome: 'Choose partition keys and handle membership changes.',
        prerequisite: 'Design data access',
        practice: 'lab/12/1',
        requires: ['access'],
      },
      {
        id: 'ingress',
        title: 'Control incoming work',
        lessons: ['api-gateway', 'rate-limits'],
        outcome: 'Place routing and admission controls at the right boundary.',
        prerequisite: 'Plan service capacity',
        practice: 'lld/practice/bucket',
        requires: ['capacity'],
      },
      {
        id: 'files',
        title: 'Serve files and search',
        lessons: ['object-storage', 'search-index'],
        outcome:
          'Separate durable source data from specialized serving systems.',
        prerequisite: 'Design data access',
        practice: 'learn/object-storage',
        requires: ['access'],
      },
      {
        id: 'cache-service',
        title: 'Cache and build a service',
        lessons: ['cache', 'cdn', 'cache-stampede', 'shortener'],
        outcome:
          'Use caching in a complete service without hiding freshness or overload.',
        prerequisite: 'Design data access; plan service capacity',
        practice: 'lab/2/1',
        requires: ['access', 'capacity'],
      },
    ],
  },
  {
    id: 'correctness',
    title: 'Distributed correctness',
    description: 'Make explicit promises about data when machines disagree.',
    modules: [
      {
        id: 'reads',
        title: 'Reason about replicated reads',
        lessons: ['replication', 'consistency', 'cap', 'read-replicas'],
        outcome: 'Choose freshness and partition behavior explicitly.',
        prerequisite: 'Distribute the data',
        practice: 'lab/quorum',
        requires: ['distribute'],
      },
      {
        id: 'transactions',
        title: 'Protect transactions',
        lessons: ['transactions', 'mvcc', 'deadlocks'],
        outcome: 'Explain isolation, snapshots and safe transaction retries.',
        prerequisite: 'Design data access; basic SQL',
        practice: 'learn/transactions',
        requires: ['access'],
      },
      {
        id: 'coordination',
        title: 'Coordinate distributed writers',
        lessons: ['clocks', 'consensus', 'leases', 'crdt'],
        outcome: 'Compare ordering, coordination and convergence mechanisms.',
        prerequisite:
          'Replicated reads and transactions; distinguish safety from availability',
        practice: 'lab/17/1',
        requires: ['reads', 'transactions'],
      },
    ],
  },
  {
    id: 'code',
    title: 'Low-level design',
    description: 'Build a model whose behavior can be tested and explained.',
    modules: [
      {
        id: 'domain',
        title: 'Model the domain',
        lessons: ['objects', 'value-objects', 'composition'],
        outcome: 'Express identity, invariants and responsibilities.',
        prerequisite: 'Basic classes, functions and data structures',
        practice: 'lld/reading/library',
        requires: [],
      },
      {
        id: 'change',
        title: 'Design change boundaries',
        lessons: ['solid', 'solid-contracts', 'dependency-injection'],
        outcome:
          'Separate policy from mechanism and wire dependencies explicitly.',
        prerequisite: 'Model the domain',
        practice: 'lld/practice/scheduler',
        practicePrompt:
          'Model only the Clock, JobStore and Executor interfaces. Inject fake implementations and test scheduling policy without real time or storage. Leave leases, cross-process ownership and delivery guarantees for the coordination and asynchronous workflow modules.',
        requires: ['domain'],
      },
      {
        id: 'behavior',
        title: 'Select behavioral patterns',
        lessons: ['patterns', 'strategy', 'state-machines'],
        outcome: 'Select a pattern from the behavior that needs to change.',
        prerequisite: 'Design change boundaries',
        practice: 'lld/reading/vending',
        requires: ['change'],
      },
      {
        id: 'actions',
        title: 'Model actions and events',
        lessons: ['command', 'observer'],
        outcome: 'Manage commands, subscriptions and their lifetimes.',
        prerequisite: 'Select behavioral patterns',
        practice: 'lld/practice/pubsub',
        requires: ['behavior'],
      },
      {
        id: 'invariants',
        title: 'Preserve concurrent invariants',
        lessons: ['concurrency', 'concurrent-collections', 'lru'],
        outcome:
          'Distinguish safe individual operations from correct workflows.',
        prerequisite: 'Model the domain; resource constraints',
        practice: 'lld/practice/lru',
        requires: ['domain', 'resources'],
      },
      {
        id: 'test-design',
        title: 'Test a complete design',
        lessons: [
          'repository',
          'testing',
          'testing-contracts',
          'lld-capstones',
        ],
        outcome:
          'Define transaction boundaries and test a complete LLD solution.',
        prerequisite:
          'Concurrent invariants, behavioral design and transaction boundaries',
        practice: 'lld/practice/split-expense',
        requires: ['invariants', 'transactions', 'actions'],
      },
    ],
  },
  {
    id: 'async',
    title: 'Asynchronous workflows',
    description:
      'Handle delayed work, duplicates and partial business operations.',
    modules: [
      {
        id: 'async-load',
        title: 'Handle asynchronous load',
        lessons: ['queue', 'failure', 'delivery'],
        outcome: 'Explain backpressure, retry behavior and delivery semantics.',
        prerequisite: 'Contracts and transactions',
        practice: 'lab/5/1',
        requires: ['contracts', 'transactions'],
      },
      {
        id: 'workflows',
        title: 'Coordinate business workflows',
        lessons: ['outbox', 'cdc', 'sagas'],
        outcome:
          'Publish changes reliably and recover a partially completed workflow.',
        prerequisite: 'Handle asynchronous load',
        practice: 'lab/16/1',
        requires: ['async-load'],
      },
      {
        id: 'replay',
        title: 'Evolve and replay events',
        lessons: ['schema-evolution', 'stream-time', 'feed'],
        outcome:
          'Handle old event formats, late data and a complete feed design.',
        prerequisite: 'Coordinate business workflows',
        practice: 'lab/8/1',
        requires: ['workflows'],
      },
    ],
  },
  {
    id: 'operations',
    title: 'Operations & recovery',
    description: 'Connect system health to user outcomes and tested recovery.',
    modules: [
      {
        id: 'reliability',
        title: 'Define and observe reliability',
        lessons: [
          'availability-math',
          'observability',
          'observability-signals',
          'error-budgets',
        ],
        outcome: 'Choose signals and budgets that lead to useful action.',
        prerequisite: 'Measure under load',
        practice: 'lab/19/1',
        requires: ['load'],
      },
      {
        id: 'deployment',
        title: 'Deploy and scale workloads',
        lessons: ['kubernetes-pods', 'probes', 'service-discovery', 'hpa'],
        outcome: 'Roll out, drain and scale healthy instances.',
        prerequisite: 'Plan service capacity',
        practice: 'lab/15/1',
        requires: ['capacity'],
      },
      {
        id: 'recovery',
        title: 'Recover across regions',
        lessons: ['regions', 'multi-region', 'disaster-recovery'],
        outcome: 'Define ownership, failover and tested recovery objectives.',
        prerequisite: 'Replicated reads and distributed writers',
        practice: 'lab/3/1',
        requires: ['reads', 'coordination'],
      },
      {
        id: 'disruption',
        title: 'Lead through disruption',
        lessons: ['incidents', 'business-continuity'],
        outcome: 'Coordinate recovery and continued business operation.',
        prerequisite: 'Define and observe reliability',
        practice: 'lab',
        requires: ['reliability'],
      },
    ],
  },
  {
    id: 'evolution',
    title: 'Architecture evolution',
    description: 'Change a live system while protecting its data and users.',
    modules: [
      {
        id: 'ownership',
        title: 'Choose ownership and isolation',
        lessons: ['boundaries', 'multi-tenancy'],
        outcome: 'Choose service ownership and enforce tenant boundaries.',
        prerequisite: 'Service design and operations',
        practice: 'lab/20/1',
        requires: ['capacity', 'reliability', 'contracts', 'access'],
      },
      {
        id: 'migrate',
        title: 'Migrate safely',
        lessons: ['migrations', 'zero-downtime-migrations'],
        outcome: 'Stage changes with compatibility windows and rollback paths.',
        prerequisite: 'Transactions and operations',
        practice: 'lab/8/1',
        requires: ['transactions', 'deployment'],
      },
      {
        id: 'secure',
        title: 'Secure the data lifecycle',
        lessons: ['security', 'security-design', 'data-governance'],
        outcome: 'Connect threats, access controls, retention and deletion.',
        prerequisite:
          'Service contracts; revisit before exposing a service publicly',
        practice: 'lab/18/1',
        requires: ['contracts'],
      },
      {
        id: 'ai-extension',
        title: 'Extension: AI serving',
        lessons: ['ai-systems'],
        outcome:
          'Apply architecture constraints to retrieval, serving and evaluation.',
        prerequisite: 'Service design and operations; optional extension',
        practice: 'learn/ai-systems',
        requires: ['access', 'reliability'],
      },
    ],
  },
  {
    id: 'teams',
    title: 'Decisions across teams',
    description: 'Make tradeoffs legible to the people who own them.',
    modules: [
      {
        id: 'decisions',
        title: 'Record and explain decisions',
        lessons: ['decisions', 'adrs', 'executive-communication'],
        outcome: 'Present evidence, alternatives and reversal triggers.',
        prerequisite: 'Architecture and operational practice',
        practice: 'learn/adrs',
        requires: ['ownership', 'reliability'],
      },
      {
        id: 'platforms',
        title: 'Align teams and platforms',
        lessons: ['teams', 'team-topology', 'platform-engineering'],
        outcome:
          'Connect ownership and cognitive load to platform capabilities.',
        prerequisite: 'Record and explain decisions',
        practice: 'learn/team-topology',
        requires: ['decisions'],
      },
      {
        id: 'risk',
        title: 'Manage architectural risk',
        lessons: ['risk', 'risk-register', 'technical-debt'],
        outcome:
          'Assign owners, controls and review dates to future costs and risks.',
        prerequisite: 'Architecture evolution',
        practice: 'learn/risk-register',
        requires: ['migrate', 'secure'],
      },
    ],
  },
  {
    id: 'strategy',
    title: 'Technical strategy',
    description:
      'Practice decisions with budgets, uncertainty and a longer horizon.',
    modules: [
      {
        id: 'economics',
        title: 'Evaluate architectural economics',
        lessons: ['economics', 'unit-economics', 'build-buy'],
        outcome: 'Compare marginal costs, investment and exit costs.',
        prerequisite: 'Capacity planning and operations',
        practice: 'lab/4/1',
        requires: ['capacity', 'reliability', 'contracts', 'access'],
      },
      {
        id: 'strategy-capstone',
        title: 'Defend a long-term strategy',
        lessons: ['portfolio', 'roadmaps', 'capstone', 'principal-capstone'],
        outcome:
          'Prioritize investments and defend a roadmap with evidence milestones.',
        prerequisite: 'Architecture evolution and decisions across teams',
        practice: 'learn/principal-capstone',
        requires: ['risk', 'decisions', 'economics'],
      },
    ],
  },
];
export const learningModules = learningParts.flatMap((p) =>
  p.modules.map((m) => ({ ...m, partId: p.id, partTitle: p.title })),
);
export function moduleForLesson(id: string) {
  return learningModules.find((m) => m.lessons.includes(id));
}
export const orderedLessons = learningModules.flatMap((m) =>
  m.lessons.map((id) => lessons.find((l) => l.id === id)!),
);
