'use client';
import IncidentEvidence from './incident-evidence';
import { LabTourInvitation } from './lab-tour';
import { useEffect, useState } from 'react';
import {
  ArrowRight,
  Check,
  Play,
  Pause,
  RotateCcw,
  Download,
  Activity,
} from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import {
  initialOps,
  operations,
  monthlyBill,
  incidents,
  injectIncident,
  advanceOps,
  recoveryChecks,
  rates,
  tradeoffs,
  nextIncident,
} from '@/lib/studio/operations';
import { useCloud, download } from '@/lib/studio/storage';
import { CloudStatus, Range } from './shared';
import Editor from './editor';
import IncidentStory from './incident-story';
import CustomerPreview from './customer-preview';
import DeliveryConsole from './delivery-console';
import IncidentDossier from './incident-dossier';
import { extraDossiers } from '@/lib/studio/incident-library';
const coreDomains = [
  'Capacity',
  'Deployment',
  'Caching',
  'Failover',
  'Cost',
  'Messaging',
];
const steps = [
  'Choose a case',
  'Diagnose',
  'Change the design',
  'Verify & reflect',
];
export default function Operations() {
  const cloud = useCloud('operations', initialOps),
    d = cloud.data,
    m = operations(d.design, d.config, d.backlog);
  const [step, setStep] = useState(0),
    [hint, setHint] = useState(0),
    [checked, setChecked] = useState(false),
    [category, setCategory] = useState('All'),
    [search, setSearch] = useState('');
  const incident = incidents[d.incident];
  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent('atelier-context', { detail: incident?.title ?? '' }),
    );
  }, [incident]);
  useEffect(() => {
    if (!d.running || !cloud.ready) return;
    const timer = setInterval(
      () =>
        cloud.setData((s) =>
          s.running
            ? advanceOps(s, Math.max(0, (Date.now() - s.lastTick) / 1000) * 6)
            : s,
        ),
      3000,
    );
    return () => clearInterval(timer);
  }, [d.running, cloud.ready]);
  function inject(i: number) {
    window.location.hash = 'lab/' + i + '/1';
    cloud.setData((s) => ({
      ...injectIncident(s, i),
      showIncident: false,
      running: false,
      lastTick: Date.now(),
    }));
    setHint(0);
    setChecked(false);
    setStep(1);
  }
  useEffect(() => {
    if (!cloud.ready) return;
    const route = () => {
      const parts = location.hash.slice(1).split('/');
      if (parts[0] !== 'lab') return;
      if (parts.length === 1) {
        setStep(0);
        return;
      }
      const index = Number(parts[1]);
      if (Number.isInteger(index) && index >= 0 && index < incidents.length) {
        if (d.incident !== index)
          cloud.setData((state) => ({
            ...injectIncident(state, index),
            showIncident: false,
            running: false,
            lastTick: Date.now(),
          }));
        setStep(Math.min(3, Math.max(1, Number(parts[2]) || 1)));
      }
    };
    route();
    window.addEventListener('hashchange', route);
    return () => window.removeEventListener('hashchange', route);
  }, [cloud.ready, d.incident]);
  function goStep(value: number) {
    setStep(value);
    location.hash = value === 0 ? 'lab' : 'lab/' + d.incident + '/' + value;
  }

  function config(key: string, value: number | boolean) {
    cloud.setData((s) => ({ ...s, config: { ...s.config, [key]: value } }));
    setChecked(false);
  }
  function add(kind: 'service' | 'worker' | 'database') {
    cloud.setData((s) => ({
      ...s,
      design: {
        ...s.design,
        nodes: s.design.nodes.map((n) =>
          n.kind === kind && n.role !== 'read-replica'
            ? { ...n, replicas: Math.min(100, n.replicas + 1) }
            : n,
        ),
      },
      events: [
        { time: s.seconds, text: 'Added one ' + kind + ' replica.' },
        ...s.events,
      ].slice(0, 30),
    }));
    setChecked(false);
  }
  function verify() {
    setChecked(true);
    if (
      recoveryChecks(d).every((c) => c.pass) &&
      d.note.trim().length >= 30 &&
      incident
    ) {
      cloud.setData((s) => ({
        ...s,
        resolved: [...new Set([...s.resolved, s.incident])],
        report: incident.lesson,
        decisions: [
          {
            title: incident.title,
            note: s.note,
            design: s.design,
            config: s.config,
            bill: m.bill,
            time: s.seconds,
          },
          ...(s.decisions ?? []),
        ].slice(0, 20),
      }));
    }
  }
  const checks = recoveryChecks(d);
  const visibleCases = incidents
    .map((c, i) => ({ c, i }))
    .filter(
      ({ c, i }) =>
        (category === 'All' ||
          category ===
            (i < 6 ? coreDomains[i] : extraDossiers[i - 6].category)) &&
        [c.title, c.complaint, c.brief]
          .join(' ')
          .toLowerCase()
          .includes(search.toLowerCase()),
    );
  return (
    <section className="ops workbench">
      {step > 0 && (
        <nav className="workbench-nav" aria-label="Production lab steps">
          {steps.map((title, i) => (
            <button
              aria-current={step === i ? 'step' : undefined}
              disabled={i > 0 && !incident}
              onClick={() => goStep(i)}
              key={title}
            >
              <span>{i + 1}</span>
              <strong>{title}</strong>
              <small>
                {
                  [
                    'Select an incident to load',
                    'Read the cause and trace the path',
                    'Select a node or use an action',
                    'Check targets and record a decision',
                  ][i]
                }
              </small>
            </button>
          ))}
        </nav>
      )}
      <CloudStatus {...cloud} />
      {step === 0 ? (
        <>
          <LabTourInvitation />
          <div className="incident-library-toolbar">
            <label>
              <span>Category</span>
              <select
                aria-label="Incident category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                {[
                  'All',
                  ...new Set([
                    ...coreDomains,
                    ...extraDossiers.map((x) => x.category),
                  ]),
                ].map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </select>
            </label>
            <label className="incident-search">
              <span>Find an incident</span>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search failures, symptoms or systems…"
              />
            </label>
            <span className="incident-count">
              {visibleCases.length}{' '}
              {visibleCases.length === 1 ? 'incident' : 'incidents'} ·{' '}
              {d.resolved.length} completed
            </span>
          </div>
          <div className="case-grid">
            {visibleCases.map(({ c, i }) => (
              <button
                className={
                  'case-card ' + (d.resolved.includes(i) ? 'case-complete' : '')
                }
                key={c.title}
                disabled={!cloud.ready}
                onClick={() => inject(i)}
              >
                <span className="case-number">
                  {String(i + 1).padStart(2, '0')} ·{' '}
                  {i < 6 ? coreDomains[i] : extraDossiers[i - 6].category}
                  {d.resolved.includes(i) && <Check size={15} />}
                </span>
                <h3>{c.title}</h3>
                <p>{c.complaint}</p>
                <IncidentEvidence index={i} />
                <span className="case-action">
                  <span className="sr-only">Open incident</span>
                  <ArrowRight size={18} />
                </span>
              </button>
            ))}
          </div>
          {visibleCases.length === 0 && (
            <p className="empty-state">
              No incidents match. Try a system name such as “queue” or clear the
              category filter.
            </p>
          )}
          {incident && (
            <button className="secondary" onClick={() => goStep(2)}>
              Resume {incident.title}
              <ArrowRight size={16} />
            </button>
          )}
        </>
      ) : (
        <>
          <div className="workbench-heading">
            <div>
              <span className="eyebrow">
                INCIDENT {String(d.incident + 1).padStart(2, '0')} ·{' '}
                {incident.actor}
              </span>
              <h2>{incident.title}</h2>
            </div>
            <div className="incident-heading-actions">
              <button className="text-button" onClick={() => goStep(0)}>
                All incidents
              </button>
              <button
                className="text-button"
                onClick={() => inject(d.incident)}
              >
                <RotateCcw size={14} />
                New variation
              </button>
              <button
                className="secondary"
                onClick={() => inject(nextIncident(d))}
              >
                Next incident
                <ArrowRight size={15} />
              </button>
            </div>
          </div>
          <div className="scenario-conditions">
            <span>RUN {d.attempts?.[d.incident] ?? 1}</span>
            <span>
              {(d.offeredTraffic ?? d.config.rps).toLocaleString()} requests/s
            </span>
            <span>${d.config.budget}/mo budget</span>
            <span>Variation {(d.variation ?? 0) + 1} / 3</span>
          </div>
          <div className="live-impact">
            <CustomerPreview state={d} />
            <div className="ops-stats compact-stats">
              <div className={m.syncSuccess < 0.999 ? 'bad' : ''}>
                <span>Requests completed</span>
                <strong>{(m.syncSuccess * 100).toFixed(1)}%</strong>
                <p>Target ≥ 99.9%</p>
              </div>
              <div
                className={
                  m.latency === null || m.latency >= d.config.latencyTarget
                    ? 'bad'
                    : ''
                }
              >
                <span>Mean latency model</span>
                <strong>
                  {m.latency === null
                    ? 'Overloaded'
                    : Math.round(m.latency) + ' ms'}
                </strong>
                <p>Target &lt; {d.config.latencyTarget} ms</p>
              </div>
              <div className={m.queueDelay >= 60 ? 'bad' : ''}>
                <span>Backlog at {Math.round(d.seconds)} s</span>
                <strong>{Math.round(d.backlog).toLocaleString()}</strong>
                <p>
                  {m.workerCapacity}/s processing · {m.jobRate}/s arriving
                  {!d.running && (
                    <small className="clock-snapshot">
                      Clock paused · advance time to observe accumulation
                    </small>
                  )}
                </p>
              </div>
              <div className={m.bill > d.config.budget ? 'bad' : ''}>
                <span>Monthly estimate</span>
                <strong>${m.bill}</strong>
                <p>Budget ${d.config.budget}</p>
              </div>
            </div>
          </div>
          {step === 1 ? (
            <>
              {d.incident >= 6 && (
                <IncidentDossier
                  key={d.incident}
                  state={d}
                  onChange={cloud.setData}
                />
              )}
              <div className="diagnose-visual">
                <Editor
                  design={d.design}
                  hot={m.model.valid ? m.model.hot : []}
                  onDecision={(reason) =>
                    cloud.setData((s) => ({
                      ...s,
                      running: false,
                      events: [
                        { time: s.seconds, text: reason },
                        ...s.events,
                      ].slice(0, 30),
                    }))
                  }
                  onChange={(design) =>
                    cloud.setData((s) => ({ ...s, design, running: false }))
                  }
                />
                <p className="feedback">
                  {d.incident === 0
                    ? `A campaign is sending ${(d.offeredTraffic ?? 9000).toLocaleString()} requests/s. Trace both checkout failures and unfinished notifications.`
                    : incident.brief}
                </p>
                {d.incident < 6 && (
                  <details>
                    <summary>Read the incident timeline</summary>
                    <IncidentStory
                      key={d.incident}
                      state={d}
                      onReplay={() => inject(d.incident)}
                    />
                  </details>
                )}
              </div>
              <div className="next-action">
                <div>
                  <strong>Test a response against the cause.</strong>
                  <p>
                    Use the response options or edit the topology. Extra
                    capacity only helps a capacity bottleneck.
                  </p>
                </div>
                <button className="primary" onClick={() => goStep(2)}>
                  Open the repair workbench
                  <ArrowRight size={16} />
                </button>
              </div>
            </>
          ) : step === 2 ? (
            <>
              {d.incident >= 6 && (
                <IncidentDossier
                  key={d.incident}
                  state={d}
                  onChange={cloud.setData}
                />
              )}
              <div className="task-instruction">
                <span>DO THIS NEXT</span>
                <p>
                  {[
                    'Inspect API capacity against the current incoming load. Add headroom, then test downstream capacity. Then inspect the database and workers; each has its own bottleneck.',
                    'Click API service → increase Replicas. Leave “One API replica offline” switched on to test failure headroom.',
                    'Under Operating conditions, reduce Cache TTL to 60 seconds or less. Then lower the hit rate to test the extra database work.',
                    'Click “Add database standby”, then “Promote standby”. Adding a copy alone does not restore routing.',
                    'Click API service or Primary database, then lower Replicas. Watch the monthly estimate and request capacity after each change.',
                    'Restore the worker, inspect the delivery pipeline, and fix the provider/retry/payload constraints. Then advance time. Scaling workers cannot repair a rejected payload or raise an external quota.',
                  ][d.incident] ??
                    'Use the captured evidence above to choose a response, then verify the live model and customer journey.'}
                </p>
              </div>
              {d.incident === 5 && (
                <DeliveryConsole state={d} onChange={cloud.setData} />
              )}
              <div className="repair-layout">
                <div>
                  <Editor
                    design={d.design}
                    hot={m.model.valid ? m.model.hot : []}
                    onDecision={(reason) =>
                      cloud.setData((s) => ({
                        ...s,
                        running: false,
                        events: [
                          { time: s.seconds, text: reason },
                          ...s.events,
                        ].slice(0, 30),
                      }))
                    }
                    onChange={(design) => {
                      cloud.setData((s) => ({ ...s, design, running: false }));
                      setChecked(false);
                    }}
                  />
                  <details className="panel bill-breakdown">
                    <summary>Open the itemized bill · ${m.bill}/month</summary>
                    <div className="bill-rows">
                      {d.design.nodes
                        .filter((n) => rates[n.kind] > 0)
                        .map((n) => (
                          <div key={n.id}>
                            <span>
                              {n.name}
                              <small>{n.replicas} copies</small>
                            </span>
                            <strong>
                              ${monthlyBill({ nodes: [n], edges: [] })}/mo
                            </strong>
                          </div>
                        ))}
                    </div>
                    <p className="small">
                      Fictional prices. Offline and disconnected components
                      still cost money. Database tiers scale with configured
                      capacity; other tuning does not change prices.
                    </p>
                  </details>
                </div>
                <aside className="repair-controls">
                  <h3>Actions</h3>
                  <p>These buttons change the model immediately.</p>
                  <div className="remediation-actions">
                    <button
                      className="secondary"
                      onClick={() => add('service')}
                    >
                      Add API replica <small>+$60/month</small>
                    </button>
                    <button className="secondary" onClick={() => add('worker')}>
                      Add notification worker <small>+$45/month</small>
                    </button>
                    <button
                      className="secondary"
                      onClick={() => add('database')}
                    >
                      Add database standby <small>Same tier as primary</small>
                    </button>
                    <button
                      className="secondary"
                      disabled={
                        !d.config.dbDown ||
                        !d.design.nodes.some(
                          (n) => n.kind === 'database' && n.replicas >= 2,
                        )
                      }
                      onClick={() => config('dbDown', false)}
                    >
                      Promote standby
                    </button>
                  </div>
                  <details open>
                    <summary>Operating conditions</summary>
                    <Range
                      label="Incoming requests"
                      value={d.config.rps}
                      min={100}
                      max={20000}
                      step={100}
                      unit=" /s"
                      onChange={(v) => config('rps', v)}
                    />
                    <Range
                      label="Cache hit rate"
                      value={d.config.hit}
                      max={99}
                      unit="%"
                      onChange={(v) => config('hit', v)}
                    />
                    <Range
                      label="Cache TTL"
                      value={d.config.ttl}
                      max={1200}
                      step={10}
                      unit="s"
                      onChange={(v) => config('ttl', v)}
                    />
                    <p>
                      Potential staleness: {m.freshness}s. Allowed:{' '}
                      {d.config.freshnessTarget}s.
                    </p>
                    {[
                      ['apiDown', 'One API replica offline'],
                      ['cacheDown', 'One cache replica offline'],
                      ['dbDown', 'Database primary offline'],
                      ['workerDown', 'One worker offline'],
                    ].map(([key, label]) => (
                      <label className="switch-row" key={key}>
                        <Switch
                          checked={
                            d.config[key as keyof typeof d.config] as boolean
                          }
                          onCheckedChange={(v) => config(key, v)}
                        />
                        {label}
                      </label>
                    ))}
                  </details>
                  <div className="clock-controls">
                    <button
                      className="secondary"
                      onClick={() => cloud.setData((s) => advanceOps(s, 60))}
                    >
                      Advance 1 minute
                    </button>
                    <button
                      className="text-button"
                      onClick={() =>
                        cloud.setData((s) => ({
                          ...s,
                          running: !s.running,
                          lastTick: Date.now(),
                        }))
                      }
                    >
                      {d.running ? <Pause size={14} /> : <Play size={14} />}{' '}
                      {d.running ? 'Pause' : 'Run at 6×'}
                    </button>
                    <small>
                      {Math.floor(d.seconds / 60)} minutes simulated · $
                      {d.spend.toFixed(3)} accrued
                    </small>
                  </div>
                  <button
                    className="text-button"
                    onClick={() => setHint((h) => Math.min(2, h + 1))}
                  >
                    {hint ? 'Show a possible fix' : 'I need a hint'}
                  </button>
                  {hint > 0 && (
                    <p className="feedback">
                      {hint === 1 ? incident.hint : incident.fix}
                    </p>
                  )}
                </aside>
              </div>
              <div className="next-action">
                <p>
                  Changed the model? Test every customer promise before closing
                  the incident.
                </p>
                <button
                  className="primary"
                  onClick={() => {
                    setStep(3);
                    setChecked(true);
                  }}
                >
                  Check recovery
                  <ArrowRight size={16} />
                </button>
              </div>
            </>
          ) : (
            <div className="verify-layout">
              <section>
                <h3>Recovery checklist</h3>
                <p>
                  These checks use the current design. Green throughput alone is
                  not enough.
                </p>
                <div className="recovery-checks">
                  {checks.map((c) => (
                    <div className={c.pass ? 'pass' : 'fail'} key={c.label}>
                      <span>{c.pass ? '✓' : '○'}</span>
                      {c.label}
                    </div>
                  ))}
                </div>
                <label className="field">
                  <span>Record your diagnosis, action and accepted risk</span>
                  <textarea
                    rows={5}
                    maxLength={15000}
                    value={d.note}
                    onChange={(e) =>
                      cloud.setData((s) => ({ ...s, note: e.target.value }))
                    }
                    placeholder="The API was saturated because… I changed… This costs… The remaining risk is…"
                  />
                </label>
                <div className="inline-form">
                  <button className="primary" onClick={verify}>
                    Verify & save decision
                  </button>
                  <button className="secondary" onClick={() => goStep(2)}>
                    Return to editor
                  </button>
                </div>
                {checked && d.note.trim().length < 30 && (
                  <p role="status">
                    Record the causal diagnosis, recovery evidence and accepted
                    risk (at least 30 characters) before saving the decision.
                  </p>
                )}
                {d.report && (
                  <div className="feedback">
                    <strong>Decision saved</strong>
                    <p>{d.report}</p>
                    <button
                      className="primary"
                      onClick={() => inject(nextIncident(d))}
                    >
                      Next incident
                      <ArrowRight size={15} />
                    </button>
                  </div>
                )}
              </section>
              <aside>
                <h3>Compare your options</h3>
                {tradeoffs[d.incident].map((t) => (
                  <article className="decision-option" key={t.name}>
                    <h4>{t.name}</h4>
                    <p>
                      <strong>Benefit:</strong> {t.gain}
                    </p>
                    <p>
                      <strong>Cost or risk:</strong> {t.cost}
                    </p>
                    <p>
                      <strong>Choose it when:</strong> {t.when}
                    </p>
                  </article>
                ))}
              </aside>
            </div>
          )}
        </>
      )}
      <details className="workbench-footnote">
        <summary>Model assumptions & saved decisions</summary>
        <p>
          This is a deterministic teaching simulation. It models the first
          API/database path, illustrative mean latency, 5% of requests producing
          notifications, and cache TTL as potential staleness. Promotion assumes
          a caught-up standby. It does not prove percentile latency, real cloud
          cost or data-loss safety.
        </p>
        {d.decisions?.map((x, i) => (
          <article key={i}>
            <strong>
              {x.title} · ${x.bill}/month
            </strong>
            <p>{x.note}</p>
          </article>
        ))}
      </details>
    </section>
  );
}
