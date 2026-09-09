import type { Scenario } from './interview';

const scopeOverrides: Record<string, { required: string; optional: string }> = {
  shortener: {
    required:
      'Create short links, redirect valid links, expire links, and remove abusive links.',
    optional:
      'Custom aliases may be deferred. Analytics can be asynchronous and outside the launch critical path.',
  },
  chat: {
    required:
      'One-to-one chats, groups up to 500 members, offline delivery, and multiple devices.',
    optional:
      'Voice, video, and implementing end-to-end encryption are outside this interview.',
  },
  feed: {
    required:
      'Text posts and media references, following, and a paginated chronological feed with a path to personalization.',
    optional:
      'Ads are outside this interview. Advanced personalization may follow the chronological baseline.',
  },
  booking: {
    required:
      'Seat selection, time-limited holds, payment, and confirmation against finite inventory.',
    optional:
      'Search freshness may be relaxed. Confirmed seat allocation may not oversell.',
  },
  payments: {
    required:
      'Payment intents, authorization or charging, provider callbacks, status, refunds, and reconciliation.',
    optional:
      'Bank settlement and regulatory implementation are outside this technical interview.',
  },
  marketplace: {
    required:
      'Catalog, inventory, checkout, fulfillment, preservation of completed orders, and gradual migration.',
    optional:
      'A full rewrite is not required. Teams may keep appropriate responsibilities together.',
  },
};
/** Canonical case data, never derived from the candidate's proposed reduced scope. */
export function minimumInterviewBrief(scenario: Scenario) {
  const scope = scopeOverrides[scenario.id];
  return {
    requirements: [
      { label: 'Core scope', text: scope?.required ?? scenario.scope },
      { label: 'Correctness & service targets', text: scenario.quality },
      { label: 'Workload', text: scenario.scale },
    ],
    flexibility:
      scope?.optional ??
      'Implementation, sequencing, and additional features are negotiable. The core scope, workload, and service targets above remain required.',
  };
}

/** Compact facts accompany, rather than replace, the complete canonical brief. */
const targetRows: Record<string, [string, string][]> = {
  shortener: [
    ['Redirect traffic', '100M / day'],
    ['Link creation', '1M / day'],
    ['Peak multiplier', '5× average'],
    ['Regional redirect latency', 'p95 ≤ 100 ms'],
    ['Valid redirects', '99.9% success'],
    ['Abuse removal', 'Within 60 s'],
    ['Retention', '1 year, unless expired'],
  ],
  chat: [
    ['Daily users', '5M'],
    ['Concurrent connections', '500k'],
    ['Messages', '20M / day'],
    ['Peak multiplier', '10×'],
    ['Regional online delivery', 'p95 ≤ 500 ms'],
    ['History', '1 year'],
  ],
  feed: [
    ['Daily users', '20M'],
    ['Feed reads', '10 / user / day'],
    ['Posts', '2M / day'],
    ['Large creators', 'Over 10M followers'],
    ['Peak multiplier', '5×'],
    ['Feed latency', 'p95 ≤ 300 ms'],
    ['New-post visibility', 'Within 5 s'],
  ],
  booking: [
    ['Launch demand', '100k buyers / minute'],
    ['Event inventory', '10k seats'],
    ['Seat hold', '5 minutes'],
  ],
  payments: [
    ['Payment attempts', '2M / day'],
    ['Peak multiplier', '8×'],
    ['Provider response', 'May take several seconds'],
  ],
  marketplace: [
    ['Daily users', '10M'],
    ['Orders', '500k / day'],
    ['Peak multiplier', '4×'],
    ['Product teams', '12'],
    ['Current regions', '1'],
    ['New markets this year', '2'],
  ],
  notifications: [
    ['Notifications', '10M / day'],
    ['Burst multiplier', '20×'],
    ['Providers', '3, different quotas'],
    ['Oldest urgent delivery', 'Within 60 s'],
  ],
  drive: [
    ['Users', '5M'],
    ['New content', '2 TB / day'],
    ['Maximum file size', '10 GB'],
  ],
  video: [
    ['Uploads', '1M / day'],
    ['Playback sessions', '50M / day'],
    ['Event burst', '10×'],
    ['Cached playback startup', 'p95 < 2 s'],
  ],
  rides: [
    ['Active drivers', '200k'],
    ['Location interval', '5 s'],
    ['Ride requests', '20k / minute'],
  ],
  crawler: [
    ['Pages', '100M / day'],
    ['Domains', '5M'],
    ['Host popularity', 'Highly skewed'],
  ],
  search: [
    ['Documents', '100M'],
    ['Queries', '20k / s'],
    ['Updates', '1M / day'],
    ['Search latency', 'p95 < 200 ms'],
  ],
  metrics: [
    ['Samples', '1M / s'],
    ['Hot retention', '30 days'],
    ['Alert rules', '10k'],
    ['Alert evaluation', 'Within 60 s'],
  ],
  logs: [
    ['Ingestion', '50 TB / day'],
    ['Hot retention', '7 days'],
    ['Tenants', 'Hundreds'],
  ],
  scheduler: [
    ['Scheduled jobs', '10M / day'],
    ['At the hour boundary', '30% of jobs'],
  ],
  webhooks: [
    ['Events', '100M / day'],
    ['Endpoints', '100k'],
    ['Endpoint response times', 'Uneven'],
  ],
  inventory: [
    ['SKUs', '2M'],
    ['Warehouses', '100'],
    ['Peak orders', '200k / hour'],
  ],
  wallet: [
    ['Accounts', '10M'],
    ['Transfers', '5M / day'],
    ['Payroll burst', '10×'],
  ],
  collab: [
    ['Daily editors', '1M'],
    ['Popular document', '500 concurrent participants'],
  ],
  flags: [
    ['Application instances', '100k'],
    ['Evaluations', '1M / s'],
    ['Rule updates', '10k / day'],
  ],
  experiments: [
    ['Users', '50M'],
    ['Concurrent experiments', '500'],
    ['Events', '100M / day'],
  ],
  'auth-service': [
    ['Accounts', '10M'],
    ['Event sign-ins', '100k / minute'],
  ],
  'rate-service': [
    ['Requests', '2M / s'],
    ['Tenants', '50k'],
    ['Burst allowances', 'Vary by tenant'],
  ],
  recommendations: [
    ['Users', '20M'],
    ['Recommendations', '100k / s'],
    ['Feature refresh', 'Hourly'],
    ['Serving latency', 'p95 < 100 ms'],
  ],
  rag: [
    ['Organizations', '10k'],
    ['Documents', '20M'],
    ['Concurrent conversations', '2k'],
  ],
  parking: [
    ['Spaces', '5k'],
    ['Gates', '20'],
    ['Peak arrivals', '100 / minute'],
  ],
  elevator: [
    ['Floors', '20'],
    ['Cars', '6'],
    ['Demand skew', 'Morning and evening'],
  ],
  library: [
    ['Copies', '2M'],
    ['Branches', '100'],
    ['Lending operations', '50k / day'],
  ],
  food: [
    ['Orders', '500k / day'],
    ['Meal-time burst', '15×'],
  ],
  'platform-migration': [
    ['Product teams', '30'],
    ['Services', '200'],
    ['Regions', '2'],
    ['Annual budget', 'Fixed'],
  ],
};
export function interviewTargetRows(scenario: Scenario) {
  return (
    targetRows[scenario.id]?.map(([label, value]) => ({ label, value })) ?? null
  );
}
