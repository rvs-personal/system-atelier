'use client';
import { useState } from 'react';
import { Clock, Search, GitBranch, Undo2, ArrowRight } from 'lucide-react';
import { extraDossiers, applyResponse } from '@/lib/studio/incident-library';
import {
  replayVerification,
  verificationSignature,
  type OpsState,
} from '@/lib/studio/operations';
export default function IncidentDossier({
  state,
  onChange,
}: {
  state: OpsState;
  onChange: (fn: (s: OpsState) => OpsState) => void;
}) {
  const d = extraDossiers[state.incident - 6],
    [view, setView] = useState<'evidence' | 'response'>('evidence'),
    [before, setBefore] = useState<OpsState | null>(null);
  if (!d) return null;
  const active = state.config.faults?.includes(d.fault);
  return (
    <section className="incident-dossier">
      <div className="dossier-heading">
        <div>
          <span className="severity">{d.severity}</span>
          <span>{d.category}</span>
          <strong>
            {active ? 'Incident active' : 'Primary cause addressed'}
          </strong>
        </div>
        <nav aria-label="Incident investigation">
          <button
            aria-current={view === 'evidence' ? 'page' : undefined}
            onClick={() => setView('evidence')}
          >
            <Search size={15} />
            Investigate
          </button>
          <button
            aria-current={view === 'response' ? 'page' : undefined}
            onClick={() => setView('response')}
          >
            <GitBranch size={15} />
            Respond
          </button>
        </nav>
      </div>
      {view === 'evidence' ? (
        <div className="dossier-evidence">
          <div>
            <h3>What changed?</h3>
            <ol className="incident-timeline">
              {d.timeline.map((x) => (
                <li key={x}>
                  <Clock size={14} />
                  {x}
                </li>
              ))}
            </ol>
            <h3>Mechanism</h3>
            <p>{d.cause}</p>
            <button className="primary" onClick={() => setView('response')}>
              Compare response options
              <ArrowRight size={15} />
            </button>
          </div>
          <div>
            <h3>Captured incident evidence</h3>
            <table>
              <thead>
                <tr>
                  <th>Signal</th>
                  <th>At incident</th>
                  <th>Healthy baseline</th>
                </tr>
              </thead>
              <tbody>
                {d.evidence.map(([a, b, c]) => (
                  <tr key={a}>
                    <td>{a}</td>
                    <td>{b}</td>
                    <td>{c}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="small">
              This is the captured trace that opened the case. Live outcome
              estimates above respond to your changes; these historical
              observations remain unchanged.
            </p>
          </div>
        </div>
      ) : (
        <div className="dossier-response">
          <div className="response-options">
            {d.actions.map((a, i) => (
              <button
                disabled={!active}
                key={a.title}
                onClick={() => {
                  setBefore(state);
                  onChange((s) => applyResponse(s, a));
                }}
              >
                <span>0{i + 1}</span>
                <div>
                  <strong>{a.title}</strong>
                  <p>{a.detail}</p>
                  <small>
                    {a.cost
                      ? `+$${a.cost}/month illustrative carrying cost`
                      : 'Changes the recovery procedure'}
                  </small>
                </div>
                <ArrowRight size={16} />
              </button>
            ))}
          </div>
          <aside>
            <h3>Recovery evidence</h3>
            <p>{d.verification}</p>
            <p>
              After containment, replay one minute of the original offered
              workload. Reconcile delayed work before closing the case.
            </p>
            <button
              className="primary"
              onClick={() => onChange(replayVerification)}
            >
              Replay verification · 1 minute
            </button>
            {state.verification?.signature === verificationSignature(state) && (
              <p className="small">
                Verification recorded for this design. Changing the design or
                configuration requires another replay.
              </p>
            )}
            {before && (
              <button
                className="secondary"
                onClick={() => {
                  onChange(() => before);
                  setBefore(null);
                }}
              >
                <Undo2 size={15} />
                Undo last response
              </button>
            )}
          </aside>
        </div>
      )}
      <p className="dossier-model-note">
        The timeline is an illustrative incident trace. Response actions model
        operational procedures; live rates are teaching estimates, not a
        production benchmark. A response does not close the case: replay
        verification and record your evidence.
      </p>
      {['probe_loop', 'disk_full', 'retry_storm', 'replica_lag'].includes(
        d.fault,
      ) && (
        <p className="dossier-model-note">
          <a
            href={
              d.fault === 'probe_loop'
                ? 'https://kubernetes.io/docs/concepts/workloads/pods/probes/'
                : d.fault === 'retry_storm'
                  ? 'https://docs.aws.amazon.com/sdkref/latest/guide/feature-retry-behavior.html'
                  : 'https://www.postgresql.org/docs/current/warm-standby.html'
            }
            target="_blank"
            rel="noreferrer"
          >
            Read the implementation reference ↗
          </a>
        </p>
      )}
      <details className="incident-audit">
        <summary>Response log · {state.events.length} entries</summary>
        {state.events.map((e, i) => (
          <p key={i}>
            <time>+{Math.round(e.time)}s</time>
            {e.text}
          </p>
        ))}
      </details>
    </section>
  );
}
