'use client';
import { useState } from 'react';
import {
  initialOps,
  injectIncident,
  operations,
  incidents,
  type OpsState,
} from '@/lib/studio/operations';
const stories = [
  {
    before:
      'Before the campaign: 1,000 requests/s. Two API replicas provide 4,000/s; only 190 database operations/s reach storage after cache hits.',
    trigger:
      'The campaign increases traffic to 9,000 requests/s. No service has scaled yet.',
    chain: [
      'API: 9,000 incoming > 4,000/s available. Requests accumulate or must be rejected.',
      'Database: 9,000 × (1 − 90% reads × 90% hits) = 1,710 ops/s > 1,000/s. Scaling only the API exposes this second bottleneck.',
      'Notifications: 5% × 9,000 = 450 jobs/s. Two workers process 400/s, so another 50 jobs wait each second.',
    ],
    inspect:
      'Look at all three paths. More API replicas cannot fix database throughput or notification delivery.',
  },
  {
    before:
      'At 3,000 requests/s, two API replicas provide 4,000/s. The normal deployment looks healthy.',
    trigger: 'A rollout takes one API replica offline.',
    chain: [
      'Each API replica serves 2,000/s. Losing one halves available API capacity to 2,000/s.',
      'The extra 1,000 requests/s cannot complete at the offered rate. Customers retry, which could amplify load in production.',
      'Database and worker capacity may remain healthy. The first failing tier is the API.',
    ],
    inspect:
      'Keep the failure switched on. Size the surviving fleet for the workload instead of pretending the failure went away.',
  },
  {
    before:
      'Product information may be stale for at most 60 seconds. The original cache TTL was 30 seconds.',
    trigger: 'A cache-policy change raises TTL to 900 seconds (15 minutes).',
    chain: [
      'An item changes in the database after it was cached.',
      'The cache can keep returning the old value until its TTL expires. Fast responses hide this problem.',
      'The potential 900-second stale window exceeds the customer promise by 840 seconds.',
    ],
    inspect:
      'Compare TTL with the freshness promise. Then lower the hit rate to test the database work a shorter TTL could cause.',
  },
  {
    before:
      'The request path relies on one authoritative database primary. A cache does not protect every write.',
    trigger: 'The primary stops responding.',
    chain: [
      'The API cannot confirm authoritative reads or writes. This conservative model stops the complete request path.',
      'Adding a standby copy alone does not change routing or elect a primary.',
      'Promotion restores the modeled path only after you explicitly choose it. Real recovery must fence the old primary and verify replica freshness.',
    ],
    inspect:
      'Inspect the database copies, then promote a standby. State whether any acknowledged writes could be lost.',
  },
  {
    before:
      'The prepared baseline costs $480/month and handles the current 2,000 requests/s with the cache.',
    trigger:
      'The fleet is expanded to 10 API replicas and 3 database copies while finance sets a $600 cap.',
    chain: [
      'API costs rise from $120 to $600/month. Database copies rise from $180 to $540/month.',
      'The full bill becomes $1,320/month, even when copies sit idle.',
      'Deleting random boxes may save money while removing a necessary path. Shrinking redundancy also reduces failure tolerance.',
    ],
    inspect:
      'Use the itemized bill. Resize replicas on the canvas, and test throughput plus the failure risk you accept.',
  },
  {
    before:
      'Checkout completes synchronously. Notifications are a separate promise served by queued jobs and workers.',
    trigger:
      'The single remaining notification worker is offline; 24,000 jobs are already waiting.',
    chain: [
      'HTTP requests still complete, so request-success monitoring can look green.',
      '50 new notification jobs arrive each second, but none can be delivered.',
      'Adding or restoring workers creates capacity; time must still pass for the backlog to drain.',
    ],
    inspect:
      'Restore the queue → worker path. Make worker capacity exceed arrivals, then advance time and watch the backlog shrink.',
  },
];
export default function IncidentStory({
  state,
  onReplay,
}: {
  state: OpsState;
  onReplay: () => void;
}) {
  const [step, setStep] = useState(0);
  if (state.incident < 0)
    return (
      <section className="experiment-story">
        <span className="eyebrow green">THE CUSTOMER JOURNEY</span>
        <h2>A shop with two promises.</h2>
        <p>
          A shopper opens a product or places an order: client → API →
          cache/database → response. The order also creates a notification: API
          → queue → worker → customer.
        </p>
        <div className="story-purpose">
          <strong>How to play</strong>
          <p>
            Start an incident below. Read what changed, trace the chain of
            failures, try one fix, and verify both customer promises and the
            bill. Every case begins with a prepared system so the cause is
            reproducible.
          </p>
        </div>
      </section>
    );
  const story = stories[state.incident],
    m = operations(state.design, state.config, state.backlog),
    broken = injectIncident(initialOps, state.incident),
    before = operations(broken.design, broken.config, broken.backlog);
  return (
    <section className="experiment-story incident-story">
      <span className="eyebrow green">
        INCIDENT {state.incident + 1} / 6 · FOLLOW THE CAUSE
      </span>
      <h2>{incidents[state.incident].title}</h2>
      <p className="customer-quote">{incidents[state.incident].complaint}</p>
      <div className="story-steps">
        {['Before the change', 'What broke & why', 'Your recovery now'].map(
          (label, i) => (
            <button
              key={label}
              className={step === i ? 'selected' : ''}
              onClick={() => setStep(i)}
            >
              <b>{i + 1}</b>
              <span>{label}</span>
            </button>
          ),
        )}
      </div>
      <div className="story-observation" aria-live="polite">
        {step === 0 ? (
          <>
            <strong>Start with the healthy system</strong>
            <p>{story.before}</p>
            <button className="text-button" onClick={() => setStep(1)}>
              Then what changed? →
            </button>
          </>
        ) : step === 1 ? (
          <>
            <strong>The trigger</strong>
            <p>{story.trigger}</p>
            <ol className="causal-chain">
              {story.chain.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ol>
            <p>
              <strong>Where to investigate:</strong> {story.inspect}
            </p>
            <button className="text-button" onClick={() => setStep(2)}>
              Compare my recovery →
            </button>
          </>
        ) : (
          <>
            <strong>Injected failure → your current design</strong>
            <div className="recovery-comparison">
              <div>
                <span>Requests served</span>
                <strong>
                  {(before.syncSuccess * 100).toFixed(1)}% →{' '}
                  {(m.syncSuccess * 100).toFixed(1)}%
                </strong>
              </div>
              <div>
                <span>Potential stale window</span>
                <strong>
                  {before.freshness}s → {m.freshness}s
                </strong>
              </div>
              <div>
                <span>Notification processing</span>
                <strong>
                  {before.workerCapacity}/s → {m.workerCapacity}/s
                </strong>
              </div>
              <div>
                <span>Monthly cost</span>
                <strong>
                  ${before.bill} → ${m.bill}
                </strong>
              </div>
            </div>
            <p>
              {m.model.valid
                ? `At your current settings, storage receives ${Math.round(m.model.dbDemand).toLocaleString()} operations/s. ${m.model.bottleneck} limits the request path.`
                : 'The required client → API → database path is broken. Reconnect it before adding capacity.'}{' '}
              Notifications arrive at {m.jobRate}/s and workers process up to{' '}
              {m.workerCapacity}/s.{' '}
              {m.workerCapacity > m.jobRate
                ? `An existing backlog drains at ${m.workerCapacity - m.jobRate} jobs/s.`
                : m.workerCapacity === m.jobRate
                  ? 'There is no spare processing capacity to drain existing work.'
                  : `The backlog grows by ${m.jobRate - m.workerCapacity} jobs/s while time runs.`}
            </p>
            <p>{story.inspect}</p>
            <button className="text-button" onClick={onReplay}>
              Reset this incident to its original failure
            </button>
            <small className="block">
              Resets the current design, controls and incident notes. Recorded
              decisions remain saved.
            </small>
          </>
        )}
      </div>
      <p className="story-tradeoff">
        <strong>Next:</strong> Change one thing below, return to “Your recovery
        now”, and compare. Open “Compare defensible approaches” before choosing
        your accepted risk.
      </p>
    </section>
  );
}
