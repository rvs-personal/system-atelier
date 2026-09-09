'use client';
import { operations, type OpsState } from '@/lib/studio/operations';
export default function DeliveryConsole({
  state,
  onChange,
}: {
  state: OpsState;
  onChange: (s: OpsState) => void;
}) {
  const m = operations(state.design, state.config, state.backlog);
  const set = (key: string, value: number | boolean) =>
    onChange({ ...state, config: { ...state.config, [key]: value } });
  return (
    <section className="delivery-console">
      <header>
        <span className="eyebrow">DELIVERY PIPELINE · LIVE MODEL</span>
        <h3>Accepted → attempted → delivered</h3>
        <p>
          Follow the slowest boundary. A worker can make an attempt; only the
          provider can accept delivery.
        </p>
      </header>
      <div className="delivery-lanes">
        {[
          [
            'Queue',
            Math.round(state.backlog).toLocaleString() + ' waiting',
            m.jobRate + '/s new jobs',
          ],
          [
            'Workers',
            m.rawWorkerCapacity + '/s attempts',
            'Fleet capacity before retry overhead',
          ],
          [
            'Provider',
            m.providerLimit + '/s allowed',
            'Quota applies to the whole account',
          ],
          [
            'Customer',
            m.workerCapacity.toFixed(1) + '/s delivered',
            m.retryAmplification.toFixed(1) + '× retry work',
          ],
        ].map(([title, value, note]) => (
          <div key={title}>
            <span>{title}</span>
            <strong>{value}</strong>
            <small>{note}</small>
          </div>
        ))}
      </div>
      <div className="delivery-diagnosis" aria-live="polite">
        <strong>
          {m.providerLimit < m.rawWorkerCapacity
            ? 'Provider is limiting delivery. Extra pods will mostly wait.'
            : m.poison > 0
              ? 'Invalid messages consume delivery attempts. Capacity is being spent on work that cannot succeed.'
              : 'Compare delivered rate with arrivals before scaling.'}
        </strong>
        <p>
          {m.workerCapacity < m.jobRate
            ? `Only ${m.workerCapacity.toFixed(1)} successful sends/s for ${m.jobRate} new jobs/s. The customer backlog will grow.`
            : `${(m.workerCapacity - m.jobRate).toFixed(1)} successful sends/s remain for old work.`}{' '}
          Quarantine clears work from the hot queue but does not deliver it.
        </p>
      </div>
      <div className="delivery-remedies">
        <label className="field">
          <span>Provider quota (sends/s)</span>
          <input
            type="number"
            min={1}
            max={1000}
            value={state.config.providerLimit ?? 10000}
            onChange={(e) =>
              set(
                'providerLimit',
                Math.max(1, Math.min(1000, Number(e.target.value) || 1)),
              )
            }
          />
          <small>
            Negotiated external limit in this exercise; adding a pod cannot
            change it.
          </small>
        </label>
        {[
          ['boundedRetries', 'Bound retries + exponential backoff'],
          ['quarantine', 'Quarantine malformed jobs after attempts'],
          ['payloadFixed', 'Deploy corrected payload mapping'],
          ['providerDown', 'Provider unavailable'],
        ].map(([key, title]) => (
          <label className="delivery-toggle" key={key}>
            <input
              type="checkbox"
              checked={!!state.config[key as keyof typeof state.config]}
              onChange={(e) => set(key, e.target.checked)}
            />
            <span>{title}</span>
          </label>
        ))}
      </div>
      <div className="dead-letter">
        <strong>
          {Math.round(state.deadLetters ?? 0).toLocaleString()} dead-letter jobs
        </strong>
        <button
          className="secondary"
          disabled={!state.config.payloadFixed || !(state.deadLetters ?? 0)}
          onClick={() =>
            onChange({
              ...state,
              backlog: state.backlog + (state.deadLetters ?? 0),
              deadLetters: 0,
            })
          }
        >
          Replay corrected jobs
        </button>
        <p>
          Replay preserves the operation identity. In production, the delivery
          effect must be idempotent; otherwise a lost acknowledgement can send
          the same email twice.
        </p>
      </div>
      <details>
        <summary>What this model includes</summary>
        <p>
          Aggregate rates, provider quota, invalid-payload fraction, retry
          amplification and dead-letter counts. It does not emulate a specific
          broker. Quarantined work remains a customer obligation. Provider quota
          has no priced contract in this model; record that external cost in
          your decision.
        </p>
      </details>
    </section>
  );
}
