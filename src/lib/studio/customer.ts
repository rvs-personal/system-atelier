import { extraDossiers } from './incident-library';
import { operations, type OpsState } from './operations';
export function customerExperience(s: OpsState) {
  const m = operations(s.design, s.config, s.backlog);
  if (!m.model.valid)
    return {
      kind: 'blank',
      title: !s.design.nodes.some((n) => n.kind === 'balancer')
        ? 'The gateway left. Unfortunately, so did the requests.'
        : !s.design.nodes.some((n) => n.kind === 'database')
          ? 'We removed the source of truth. The truth declined to comment.'
          : !s.design.nodes.some((n) => n.kind === 'service')
            ? 'The API has left the building. The buttons have questions.'
            : 'All the boxes are here. Apparently, they are not on speaking terms.',
      detail:
        'The client can no longer reach the API and authoritative data. A disconnected diagram is an unavailable customer journey, even when the servers still exist.',
      action:
        'Open Connect components and restore client → API → database, through the gateway if you use one.',
    };
  if (s.config.faults?.length) {
    const d = extraDossiers.find((x) => s.config.faults?.includes(x.fault)),
      fault = d?.fault;
    return {
      kind:
        fault === 'replica_lag'
          ? 'stale'
          : fault === 'duplicate_effect'
            ? 'duplicate'
            : fault === 'log_cardinality'
              ? 'bill'
              : ['credential_rotation', 'outbox_stalled', 'lost_delivery'].some(
                    (x) => s.config.faults?.includes(x),
                  )
                ? 'notification'
                : 'checkout',
      title: d
        ? 'The customer promise is still interrupted.'
        : 'An unsafe mitigation is still active.',
      detail:
        d?.cause ??
        'The last response introduced extra pressure, unsafe recovery or lost-delivery risk. A green throughput counter alone does not make the outcome safe.',
      action: d
        ? d.actions[0].detail
        : 'Undo the unsafe response or reset the case, then choose a recovery that preserves ownership and accepted work.',
    };
  }
  if (s.config.dbDown)
    return {
      kind: 'checkout',
      title: 'Checkout has entered its contemplative phase.',
      detail:
        'The database primary is offline. The application cannot confirm the order. A cache cannot confirm a durable write.',
      action:
        'Add a database standby and promote it after establishing the data-loss assumption.',
    };
  if (m.syncSuccess < 0.999 || m.latency === null)
    return {
      kind: 'loading',
      title: 'More refreshes. Same queue. Excellent cardio for the spinner.',
      detail: `${Math.round(s.config.rps * (1 - m.syncSuccess))} requests/s exceed modeled capacity. ${m.model.bottleneck} limits the request path; retrying can increase offered load.`,
      action:
        'Inspect the limiting component. Add capacity or reduce work without weakening the required offered traffic.',
    };
  if (m.freshness > s.config.freshnessTarget)
    return {
      kind: 'stale',
      title: 'Lightning-fast delivery of yesterday’s news.',
      detail: `A cached value may be ${m.freshness} seconds old, beyond the ${s.config.freshnessTarget}-second promise. Speed did not fix freshness.`,
      action:
        'Lower the TTL, then test whether the resulting lower hit rate would overload the database.',
    };
  if (
    m.workerCapacity < m.jobRate ||
    m.queueDelay >= 60 ||
    (s.deadLetters ?? 0) > 0
  )
    return {
      kind: 'notification',
      title: 'Your confirmation email is enjoying an extended layover.',
      detail: `Orders can complete, but notifications arrive at ${m.jobRate}/s and successful delivery is ${m.workerCapacity.toFixed(1)}/s. ${Math.round(s.backlog)} jobs are waiting; ${Math.round(s.deadLetters ?? 0)} remain quarantined.`,
      action:
        'Inspect the delivery pipeline: connectivity, worker attempts, provider quota, retries and malformed payloads. Repair the cause, replay corrected dead letters, then advance time.',
    };
  if (m.bill > s.config.budget)
    return {
      kind: 'bill',
      title: 'The servers are thriving. Finance would like a word.',
      detail: `The modeled bill is $${m.bill}/month against a $${s.config.budget} budget. Idle and disconnected replicas still charge rent.`,
      action:
        'Open the itemized bill and right-size replicas; document the failure headroom you give up.',
    };
  return {
    kind: 'healthy',
    title: 'The customer can finish the journey.',
    detail:
      'The modeled request, freshness, notification and budget targets are met. This is evidence under the stated assumptions, not proof against every production failure.',
    action: 'Verify recovery and record which risk your design still accepts.',
  };
}
