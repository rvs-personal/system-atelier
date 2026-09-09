'use client';
import { useEffect, useRef, useState } from 'react';
import {
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Play,
  RotateCcw,
  StepForward,
  Network,
} from 'lucide-react';
import { incidents } from '@/lib/studio/operations';
import { stages, lessons } from '@/lib/studio/curriculum';
import './studio-home.css';
const hops = [
  {
    name: 'Browser',
    title: 'The browser starts the clock.',
    detail:
      'GET /books/42 leaves the browser with a 250 ms deadline. Select another component to inspect its part of the request.',
    code: 'Deadline: 250 ms · response pending',
  },
  {
    name: 'API service',
    title: 'Every dependency shares the deadline.',
    detail:
      'The service validates the identifier and queries storage. Waiting for a database connection also consumes the request’s time budget.',
    code: 'SELECT * FROM books WHERE id = 42',
  },
  {
    name: 'Database',
    title: 'A result is not yet a delivered response.',
    detail:
      'Storage finds the book. The API still has to encode the result and send it back across the network to the browser.',
    code: '{ id: 42, title: "Distributed Systems" }',
  },
];
const outcomes = [
  'Trace requests and reason about capacity.',
  'Choose storage, caching and asynchronous work.',
  'Design contracts, objects and state transitions.',
  'Handle partial failure and concurrency.',
  'Plan migrations and multi-region systems.',
  'Connect architecture to people and economics.',
];
export default function StudioHome({
  navigate,
  completed,
}: {
  navigate: (id: string) => void;
  completed: number | null;
}) {
  const [hop, setHop] = useState(0),
    [phase, setPhase] = useState<
      'idle' | 'api' | 'db' | 'record' | 'response' | 'done'
    >('idle'),
    [lost, setLost] = useState(false),
    [playing, setPlaying] = useState(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const clear = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };
  useEffect(() => () => clear(), []);
  const busy = playing;
  const returnedRecord = phase === 'response' || phase === 'done';
  const returnedResponse = phase === 'done';
  const step = () => {
    clear();
    setPlaying(false);
    const next =
      phase === 'idle' || phase === 'done'
        ? 'api'
        : phase === 'api'
          ? 'db'
          : phase === 'db'
            ? 'record'
            : phase === 'record'
              ? 'response'
              : 'done';
    setPhase(next);
    setHop(next === 'api' || next === 'done' ? 0 : next === 'record' ? 2 : 1);
  };
  const run = () => {
    clear();
    setHop(0);
    setPhase('api');
    setPlaying(true);
    timers.current = [
      setTimeout(() => {
        setHop(1);
        setPhase('db');
      }, 700),
      setTimeout(() => {
        setHop(2);
        setPhase('record');
      }, 1400),
      setTimeout(() => {
        setHop(1);
        setPhase('response');
      }, 2100),
      setTimeout(() => {
        setHop(0);
        setPhase('done');
        setPlaying(false);
      }, 3000),
    ];
  };
  const reset = () => {
    clear();
    setPhase('idle');
    setPlaying(false);
    setHop(0);
  };
  return (
    <div className="studio-overview">
      <div className="overview-heading">
        <div>
          <span className="overview-kicker">SYSTEM DESIGN / START HERE</span>
          <h1>Follow a single request.</h1>
        </div>
      </div>
      <div className="overview-grid">
        <section
          className="request-workspace"
          aria-label="Request journey playground"
        >
          <div className="request-toolbar">
            <span className="request-address">
              <i />
              bookshop.example / books / 42
            </span>
            <span className="request-budget">
              {phase === 'done'
                ? lost
                  ? '250'
                  : '96'
                : phase === 'response'
                  ? '82'
                  : phase === 'record'
                    ? '68'
                    : phase === 'db'
                      ? '42'
                      : phase === 'api'
                        ? '18'
                        : '0'}{' '}
              / 250 ms
            </span>
          </div>
          <div
            className="request-environment"
            data-hop={hop}
            data-phase={phase}
          >
            <img
              className="environment-light"
              src="/images/request-journey-matte.png"
              alt="Three dimensional browser, API service and database connected along a request route"
            />
            <img
              className="environment-dark"
              src="/images/request-journey-matte-dark.png"
              alt=""
              aria-hidden="true"
            />
            <svg
              className="environment-routes"
              viewBox="0 0 600 260"
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              <defs>
                <marker
                  id="request-arrow"
                  viewBox="0 0 8 8"
                  refX="6"
                  refY="4"
                  markerWidth="5"
                  markerHeight="5"
                  orient="auto-start-reverse"
                >
                  <path d="M1 1 L7 4 L1 7" />
                </marker>
              </defs>
              <path
                className={
                  'flow-first ' + (phase === 'api' ? 'flow-active' : '')
                }
                d="M174 184 H228"
                markerEnd="url(#request-arrow)"
              />
              <path
                className={
                  'flow-second ' + (phase === 'db' ? 'flow-active' : '')
                }
                d="M374 184 H428"
                markerEnd="url(#request-arrow)"
              />
              <path
                className={
                  'flow-return ' +
                  (phase === 'record'
                    ? 'flow-active'
                    : returnedRecord
                      ? 'flow-complete'
                      : '')
                }
                d="M428 194 H374"
                markerEnd="url(#request-arrow)"
              />
              <path
                className={
                  'flow-return ' +
                  (phase === 'response'
                    ? 'flow-active'
                    : returnedResponse
                      ? 'flow-complete'
                      : '')
                }
                d={lost ? 'M228 194 H204' : 'M228 194 H174'}
                markerEnd={lost ? undefined : 'url(#request-arrow)'}
              />
              {lost && (phase === 'response' || phase === 'done') && (
                <path
                  className="flow-loss"
                  d="M198 189 L208 199 M208 189 L198 199"
                />
              )}
            </svg>
            <div className="environment-labels">
              {hops.map((h, i) => (
                <button
                  key={h.name}
                  aria-pressed={hop === i}
                  onClick={() => {
                    if (!busy) {
                      setPhase('idle');
                      setHop(i);
                    }
                  }}
                  disabled={busy}
                >
                  <span>{h.name}</span>
                  <small>
                    {i === 0
                      ? 'HTTP client'
                      : i === 1
                        ? 'Request handler'
                        : 'Persistent storage'}
                  </small>
                </button>
              ))}
            </div>
            <span className="route-caption route-caption-first">
              {phase === 'response' || returnedResponse
                ? 'HTTP response'
                : 'HTTP request'}
            </span>
            <span className="route-caption route-caption-second">
              {phase === 'record' || returnedRecord
                ? 'Query result'
                : 'Read query'}
            </span>
          </div>
          <div className="request-console" aria-live="polite">
            <div className="console-title">
              <span>
                {phase === 'done' ? (lost ? 'TIMEOUT' : '200') : 'TRACE'}
              </span>
              <h2>
                {phase === 'done'
                  ? lost
                    ? 'The book exists. The response never arrived.'
                    : 'The browser received the book.'
                  : phase === 'record'
                    ? 'The database returns the record to the API.'
                    : phase === 'response'
                      ? 'The API sends the HTTP response to the browser.'
                      : hops[hop].title}
              </h2>
            </div>
            <p>
              {phase === 'done'
                ? lost
                  ? 'The database returned its result to the API. The API sent a response, but it was lost before reaching the browser. The browser reaches its deadline; adding database replicas would not repair this network failure.'
                  : 'The API returned the stored record within the deadline. The request crossed three components; success required the response to make the return journey.'
                : phase === 'record'
                  ? 'The query result travels back over the database connection. The database does not send an HTTP response directly to the browser.'
                  : phase === 'response'
                    ? 'The API encodes the book as JSON and writes the HTTP response to its client connection. The browser only knows it succeeded after receiving that response.'
                    : hops[hop].detail}
            </p>
            <code>
              {phase === 'done'
                ? lost
                  ? 'Deadline exceeded · database read completed'
                  : '200 OK · { id: 42, title: "Distributed Systems" }'
                : phase === 'record'
                  ? 'Row { id: 42, title: "Distributed Systems" } → API'
                  : phase === 'response'
                    ? 'HTTP/1.1 200 OK · Content-Type: application/json'
                    : hops[hop].code}
            </code>
          </div>
          <div className="request-actions">
            <button className="overview-primary" onClick={run} disabled={busy}>
              {busy ? <span className="trace-running" /> : <Play size={15} />}{' '}
              {busy
                ? 'Tracing request…'
                : phase === 'done'
                  ? 'Run again'
                  : 'Run request'}
            </button>
            <button className="trace-step" onClick={step}>
              <StepForward size={15} />
              Next hop
            </button>
            <label>
              <input
                type="checkbox"
                checked={lost}
                disabled={busy}
                onChange={(e) => {
                  setLost(e.target.checked);
                  reset();
                }}
              />
              Lose the response
            </label>
            <button
              className="trace-reset"
              aria-label="Reset request"
              onClick={reset}
            >
              <RotateCcw size={16} />
            </button>
          </div>
          <div className="request-study">
            <span>Slowed playback · direct API connection; no proxy shown</span>
            <button onClick={() => navigate('learn/request')}>
              Open chapter
              <ArrowRight size={16} />
            </button>
          </div>
        </section>
        <section className="overview-path">
          <header>
            <h2>Your learning path</h2>
            <button
              onClick={() => navigate('learn')}
              aria-label="Browse all chapters"
            >
              <ArrowUpRight size={18} />
            </button>
          </header>
          <p>
            <strong>{completed ?? 0}</strong> / {lessons.length} chapters · 6
            stages
          </p>
          <div className="overview-stages">
            {stages.map((s, i) => (
              <button
                key={s.name}
                className={i === 0 ? 'stage-current' : ''}
                onClick={() =>
                  navigate('learn/' + lessons.find((l) => l.stage === i)!.id)
                }
              >
                <span className="overview-stage-number">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <span>
                  <strong>{s.name}</strong>
                  <small>{outcomes[i]}</small>
                  <em>
                    {lessons.filter((l) => l.stage === i).length} chapters ·{' '}
                    {i === 0 ? 'Start here' : s.role}
                  </em>
                </span>
                {i === 0 ? (
                  <ArrowRight size={16} />
                ) : (
                  <span className="stage-ready" />
                )}
              </button>
            ))}
          </div>
        </section>
      </div>
      <section className="overview-incidents">
        <header>
          <div>
            <Network size={17} />
            <h2>Practice on a production incident</h2>
          </div>
          <button onClick={() => navigate('lab')}>
            Browse all {incidents.length}
            <ArrowRight size={16} />
          </button>
        </header>
        <div>
          {[0, 5].map((i) => (
            <button key={i} onClick={() => navigate('lab/' + i)}>
              <span className="incident-severity">
                {i === 0 ? 'CAPACITY' : 'DELIVERY'}
              </span>
              <strong>{incidents[i].title}</strong>
              <span>
                {i === 0
                  ? 'Find the bottleneck before adding capacity.'
                  : 'Acknowledge, retry, quarantine and replay.'}
              </span>
              <ArrowUpRight size={17} />
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
