'use client';
import { useEffect, useState } from 'react';
import LLDLibrary, { type PracticeState } from './lld-library';
import { LLDEntry } from './lld-entry';
import LLDMotion, { LLDStateScene } from './lld-motion';
import {
  Play,
  RotateCcw,
  ArrowRight,
  ChevronDown,
  Code2,
  BookOpen,
  CheckCheck,
} from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import {
  lldTemplates,
  cachePut,
  cacheGet,
  consumeToken,
  transitionOrder,
  parkingEnter,
  parkingExit,
  type CacheState,
} from '@/lib/studio/lld';
import { lldGuide, lruDetails } from '@/lib/studio/lld-guide';
import { useCloud } from '@/lib/studio/storage';
import { PageTitle, CloudStatus, Range } from './shared';
export default function LLD() {
  const practiceCloud = useCloud<PracticeState>('lld-practice', { drafts: {} });
  const cloud = useCloud('lld', {
    selected: 'lru',
    models: Object.fromEntries(
      lldTemplates.map((t) => [
        t.id,
        { design: t.design, code: t.code, notes: '', checks: [] as number[] },
      ]),
    ),
  });
  const [entered, setEntered] = useState<string | null>(null),
    [libraryRoute, setLibraryRoute] = useState('lld');
  useEffect(() => {
    const route = () => {
      const [area, id] = window.location.hash.slice(1).split('/');
      if (area === 'lld') {
        setLibraryRoute(location.hash.slice(1));
        setEntered(lldTemplates.some((t) => t.id === id) ? id : null);
      }
    };
    route();
    window.addEventListener('hashchange', route);
    return () => window.removeEventListener('hashchange', route);
  }, []);
  const d = cloud.data,
    t =
      lldTemplates.find((t) => t.id === (entered ?? d.selected)) ??
      lldTemplates[0],
    m = d.models[t.id] ?? {
      design: t.design,
      code: t.code,
      notes: '',
      checks: [],
    },
    g = lldGuide[t.id];
  const [tab, setTab] = useState(0),
    [focus, setFocus] = useState(''),
    [reveal, setReveal] = useState(false);
  function openExercise(id: string) {
    setEntered(id);
    cloud.setData((s) => ({ ...s, selected: id }));
    setTab(0);
    setFocus('');
    setReveal(false);
    window.location.hash = 'lld/' + id;
    window.scrollTo({ top: 0, behavior: 'instant' });
  }
  function update(p: Partial<typeof m>) {
    if (!cloud.ready) return;
    cloud.setData((s) => ({
      ...s,
      models: { ...s.models, [t.id]: { ...m, ...p } },
    }));
  }
  if (!entered)
    return (
      <>
        <div hidden={libraryRoute === 'lld/simulations'}>
          <LLDLibrary route={libraryRoute} cloud={practiceCloud} />
        </div>
        <div hidden={libraryRoute !== 'lld/simulations'}>
          <CloudStatus {...cloud} />
          {!cloud.ready && !cloud.error && (
            <p role="status">Loading your exercises…</p>
          )}
          <LLDEntry
            key={d.selected}
            initialExercise={d.selected}
            ready={cloud.ready}
            onOpen={openExercise}
          />
        </div>
      </>
    );
  return (
    <div className="lld-studio">
      <PageTitle
        kicker="CODE & CORRECTNESS"
        title="Low-level design"
        description="Choose an exercise, run operations, and inspect how each change affects state."
      />
      <CloudStatus {...cloud} />
      <div className="lld-shell">
        <main className="lld-main">
          <button
            className="lld-back-link"
            onClick={() => {
              setEntered(null);
              window.location.hash = 'lld/simulations';
              window.scrollTo({ top: 0, behavior: 'instant' });
            }}
          >
            ← All exercises
          </button>
          <header className="lld-heading">
            <div>
              <span className="eyebrow">
                EXERCISE {String(lldTemplates.indexOf(t) + 1).padStart(2, '0')}
              </span>
              <details
                className="lld-exercise-menu"
                onKeyDown={(e) => {
                  if (e.key === 'Escape') e.currentTarget.open = false;
                }}
              >
                <summary>
                  <h1>{t.name}</h1>
                  <ChevronDown size={20} />
                </summary>
                <nav className="lld-problems" aria-label="LLD exercises">
                  <span className="nav-caption">EXERCISES</span>
                  {lldTemplates.map((x, i) => (
                    <button
                      disabled={!cloud.ready}
                      aria-current={x.id === t.id ? 'page' : undefined}
                      key={x.id}
                      aria-label={x.name}
                      onClick={(e) => {
                        const menu = e.currentTarget.closest('details');
                        menu?.removeAttribute('open');
                        menu?.querySelector('summary')?.focus();
                        openExercise(x.id);
                      }}
                    >
                      <b>0{i + 1}</b>
                      <span>
                        {x.name}
                        <small>
                          {
                            [
                              'Data structures · eviction',
                              'Ownership · policies',
                              'Time · concurrency',
                              'State · side effects',
                            ][i]
                          }
                        </small>
                      </span>
                      <ArrowRight size={14} />
                    </button>
                  ))}
                  <p>Choose an exercise, then follow its state transitions.</p>
                </nav>
              </details>
              <p>
                {t.id === 'lru' ? (
                  <>
                    Implement get and put with constant-time lookup and recency
                    updates.
                    <br />
                    Define what happens on a miss, an update, and a cache with
                    no capacity.
                  </>
                ) : (
                  t.brief
                )}
              </p>
            </div>
            <span className="lesson-label">
              {g.steps.length} explanations · {g.cases.length} boundary cases
            </span>
          </header>
          <nav className="workspace-tabs" aria-label="LLD work areas">
            {[
              ['Understand', BookOpen],
              ['Model & contract', Code2],
              ['Run operations', Play],
              ['Verify & extend', CheckCheck],
            ].map(([name, Icon], i) => {
              const I = Icon as typeof Play;
              return (
                <button
                  key={i}
                  aria-current={tab === i ? 'page' : undefined}
                  onClick={() => setTab(i)}
                >
                  <I size={16} />
                  {name as string}
                </button>
              );
            })}
          </nav>
          {tab === 0 && (
            <>
              <LLDMotion key={t.id} id={t.id} />
              <div className="lld-reading">
                {g.steps.map((s, i) => (
                  <section className="lld-explanation" key={s.title}>
                    <div className="section-count">
                      {String(i + 1).padStart(2, '0')}
                    </div>
                    <div>
                      <h3>{s.title}</h3>
                      {t.id === 'lru' && i === 0 ? (
                        <ul className="lld-rule-list">
                          <li>
                            <strong>Read</strong>
                            <span>
                              A hit moves its entry to the front. A miss
                              preserves the order.
                            </span>
                          </li>
                          <li>
                            <strong>Write</strong>
                            <span>
                              Insert or update at the front. Updating preserves
                              a single entry.
                            </span>
                          </li>
                          <li>
                            <strong>Evict</strong>
                            <span>
                              Remove the least recently used entry when capacity
                              is exceeded.
                            </span>
                          </li>
                        </ul>
                      ) : (
                        <p>{s.text}</p>
                      )}
                      <pre>{s.code}</pre>
                      {t.id === 'lru' &&
                        lruDetails[i]?.map((paragraph) => (
                          <p key={paragraph}>{paragraph}</p>
                        ))}
                      {t.id === 'lru' && (i === 1 || i === 3) && (
                        <LRUCheckpoint section={i} />
                      )}
                    </div>
                  </section>
                ))}
                {t.id === 'lru' && (
                  <div className="lld-source-note">
                    <h3>Compare real implementations</h3>
                    <p>
                      Python’s{' '}
                      <a
                        href="https://docs.python.org/3/library/collections.html#ordereddict-objects"
                        target="_blank"
                        rel="noreferrer"
                      >
                        OrderedDict documentation
                      </a>{' '}
                      shows explicit reordering and endpoint removal for cache
                      recipes.{' '}
                      <a
                        href="https://redis.io/docs/latest/develop/reference/eviction/"
                        target="_blank"
                        rel="noreferrer"
                      >
                        Redis eviction documentation
                      </a>{' '}
                      describes approximate LRU, trading exact bookkeeping for
                      sampling. The exact list here is a contract to reason
                      about; a production cache may deliberately choose a
                      different cost and accuracy balance.
                    </p>
                  </div>
                )}
                <button className="primary" onClick={() => setTab(1)}>
                  Inspect responsibilities
                  <ArrowRight size={16} />
                </button>
              </div>
            </>
          )}
          {tab === 1 && (
            <>
              <p className="workspace-context">
                Select a class to highlight its collaborators and edit its
                members. The contract below is your design notebook.
              </p>
              <div className="object-map">
                {m.design.nodes.map((n) => (
                  <button
                    className={
                      'object-card ' +
                      (focus === n.id
                        ? 'selected'
                        : focus &&
                            m.design.edges.some(
                              (e) =>
                                (e.from === focus && e.to === n.id) ||
                                (e.to === focus && e.from === n.id),
                            )
                          ? 'collaborator'
                          : '')
                    }
                    aria-pressed={focus === n.id}
                    key={n.id}
                    onClick={() => setFocus(focus === n.id ? '' : n.id)}
                  >
                    <span>CLASS / INTERFACE</span>
                    <h3>{n.name}</h3>
                    <pre>{n.detail}</pre>
                    <small>
                      {m.design.edges
                        .filter((e) => e.from === n.id)
                        .map(
                          (e) =>
                            e.label +
                            ' → ' +
                            m.design.nodes.find((x) => x.id === e.to)?.name,
                        )
                        .join(' · ') ||
                        'State owned through the public contract'}
                    </small>
                  </button>
                ))}
              </div>
              {focus && m.design.nodes.find((n) => n.id === focus) && (
                <label className="field object-inspector">
                  <span>
                    Edit {m.design.nodes.find((n) => n.id === focus)!.name}{' '}
                    responsibility and members
                  </span>
                  <textarea
                    disabled={!cloud.ready}
                    rows={5}
                    value={m.design.nodes.find((n) => n.id === focus)!.detail}
                    maxLength={1500}
                    onChange={(e) =>
                      update({
                        design: {
                          ...m.design,
                          nodes: m.design.nodes.map((n) =>
                            n.id === focus
                              ? { ...n, detail: e.target.value }
                              : n,
                          ),
                        },
                      })
                    }
                  />
                </label>
              )}
              <div className="contract-workspace">
                <label className="code-header" htmlFor="contract-code">
                  Editable TypeScript contract
                </label>
                <textarea
                  disabled={!cloud.ready}
                  id="contract-code"
                  className="code-editor"
                  spellCheck={false}
                  value={m.code}
                  maxLength={45000}
                  onChange={(e) => update({ code: e.target.value })}
                />
                <p className="small">
                  Your notebook is saved to your account. It is not compiled or
                  executed. The reference controls are explicitly separate.
                </p>
              </div>
            </>
          )}
          {tab === 2 && (
            <>
              <Behavior key={t.id} id={t.id} />
              <div className="boundary-table">
                <h3>Boundary cases for your implementation</h3>
                <table>
                  <thead>
                    <tr>
                      <th>Input or interleaving</th>
                      <th>Expected observation</th>
                      <th>Reason</th>
                    </tr>
                  </thead>
                  <tbody>
                    {g.cases.map(([input, result, why]) => (
                      <tr key={input}>
                        <td>{input}</td>
                        <td>{result}</td>
                        <td>{why}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
          {tab === 3 && (
            <div className="lld-verification">
              <section>
                <h3>Make a correctness argument</h3>
                <p>
                  For each invariant, name a test sequence and the state that
                  proves it survived. Ticking a box records your review; it does
                  not run your code.
                </p>
                {t.invariants.map((x, i) => (
                  <label className="check-row" key={x}>
                    <Checkbox
                      disabled={!cloud.ready}
                      checked={m.checks.includes(i)}
                      onCheckedChange={(v) =>
                        update({
                          checks: v
                            ? [...m.checks, i]
                            : m.checks.filter((x) => x !== i),
                        })
                      }
                    />
                    <span>{x}</span>
                  </label>
                ))}
                <label className="field">
                  <span>Evidence and remaining assumptions</span>
                  <textarea
                    disabled={!cloud.ready}
                    rows={7}
                    maxLength={15000}
                    value={m.notes}
                    onChange={(e) => update({ notes: e.target.value })}
                    placeholder="Sequence tested → observed state → invariant. Then explain concurrency and failure boundaries."
                  />
                </label>
              </section>
              <aside className="extension-brief">
                <span className="eyebrow">NEW REQUIREMENT</span>
                <h3>Change the design</h3>
                <p>{g.extension}</p>
                <button
                  className="secondary"
                  onClick={() => setReveal(!reveal)}
                >
                  {reveal ? 'Hide discussion' : 'Compare tradeoffs'}
                </button>
                {reveal && <p>{g.answer}</p>}
              </aside>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
function Behavior({ id }: { id: string }) {
  const [cache, setCache] = useState<CacheState>({ capacity: 3, entries: [] }),
    [key, setKey] = useState('A'),
    [value, setValue] = useState('42'),
    [log, setLog] = useState<string[]>([]),
    [tokens, setTokens] = useState(5),
    [time, setTime] = useState(0),
    [order, setOrder] = useState('pending'),
    [spaces, setSpaces] = useState<boolean[]>([false, false, false]),
    [tests, setTests] = useState<string[]>([]),
    [evicted, setEvicted] = useState<[string, string] | null>(null);
  const record = (text: string) => setLog((l) => [text, ...l].slice(0, 12));
  function runTests() {
    if (id === 'lru') {
      let s: CacheState = { capacity: 2, entries: [] };
      s = cachePut(s, 'A', '1');
      s = cachePut(s, 'B', '2');
      s = cacheGet(s, 'A').state;
      s = cachePut(s, 'C', '3');
      setTests([
        !s.entries.some(([k]) => k === 'B')
          ? 'PASS: get A makes B the eviction candidate.'
          : 'FAIL: eviction',
        cachePut(s, 'A', '9').entries.length === 2
          ? 'PASS: updating A preserves size.'
          : 'FAIL: size',
        cachePut({ capacity: 0, entries: [] }, 'X', '1').entries.length === 0
          ? 'PASS: capacity zero stores nothing.'
          : 'FAIL: zero capacity',
      ]);
    } else if (id === 'bucket')
      setTests([
        consumeToken(0, 5, 1, 0).allowed
          ? 'FAIL: empty bucket'
          : 'PASS: empty bucket rejects.',
        consumeToken(0, 5, 1, 100).tokens === 4
          ? 'PASS: refill is capped before consuming.'
          : 'FAIL: refill',
      ]);
    else if (id === 'order')
      setTests([
        !transitionOrder('pending', 'shipped').valid
          ? 'PASS: unpaid order cannot ship.'
          : 'FAIL: transition',
        !transitionOrder('cancelled', 'paid').valid
          ? 'PASS: cancelled order cannot be paid.'
          : 'FAIL: terminal state',
      ]);
    else
      setTests([
        !parkingEnter([true, true, true]).accepted
          ? 'PASS: a full garage rejects entry.'
          : 'FAIL: full garage',
        !parkingExit([false, false, false], 0).accepted
          ? 'PASS: leaving an empty space is rejected.'
          : 'FAIL: empty space',
      ]);
  }
  return (
    <div className="behavior-layout">
      <section className="experiment-visual">
        <span className="eyebrow green">EXECUTABLE REFERENCE MODEL</span>
        <h2>
          {id === 'lru'
            ? 'Cache operations'
            : id === 'bucket'
              ? 'Request admission'
              : id === 'order'
                ? 'Order commands'
                : 'Parking sessions'}
        </h2>
        <p className="small">
          Run a command to inspect the reference model. Your editable contract
          is separate.
        </p>
        {id === 'lru' ? (
          <>
            <div className="lld-motion motion-lru live-state">
              <LLDStateScene
                id="lru"
                capacity={cache.capacity}
                units={[
                  ...cache.entries.map(([id, value], position) => ({
                    id,
                    value,
                    position,
                    status: 'stored' as const,
                  })),
                  ...(evicted
                    ? [
                        {
                          id: evicted[0],
                          value: evicted[1],
                          position: Math.max(1, cache.capacity),
                          status: 'removed' as const,
                        },
                      ]
                    : []),
                ]}
              />
            </div>
            <Range
              label="Capacity"
              value={cache.capacity}
              min={0}
              max={6}
              onChange={(capacity) => {
                setEvicted(null);
                setCache((c) => ({
                  ...c,
                  capacity,
                  entries: c.entries.slice(0, capacity),
                }));
              }}
            />
            <div className="inline-form">
              <label className="field">
                <span>Key</span>
                <input
                  value={key}
                  maxLength={20}
                  onChange={(e) => setKey(e.target.value)}
                />
              </label>
              <label className="field">
                <span>Value</span>
                <input
                  value={value}
                  maxLength={30}
                  onChange={(e) => setValue(e.target.value)}
                />
              </label>
              <button
                className="primary"
                disabled={!key}
                onClick={() => {
                  const next = cachePut(cache, key, value);
                  setEvicted(
                    cache.entries.find(
                      ([k]) => !next.entries.some(([nk]) => nk === k),
                    ) ?? null,
                  );
                  setCache(next);
                  record(
                    `PUT ${key} = ${value}\nBefore [${cache.entries.map((e) => e[0]).join(', ')}]\nAfter  [${next.entries.map((e) => e[0]).join(', ')}] (MRU → LRU)`,
                  );
                }}
              >
                Put
              </button>
              <button
                className="secondary"
                disabled={!key}
                onClick={() => {
                  const r = cacheGet(cache, key);
                  setEvicted(null);
                  setCache(r.state);
                  record(
                    `GET ${key} → ${r.value ?? 'MISS'} · ${r.value === undefined ? 'miss leaves order unchanged' : 'hit moves this key to the front'} · ${r.state.entries.map((e) => e[0]).join(' → ')}`,
                  );
                }}
              >
                Get
              </button>
            </div>
          </>
        ) : id === 'bucket' ? (
          <>
            <div className="lld-motion motion-bucket live-state">
              <LLDStateScene
                id="bucket"
                units={Array.from({ length: 5 }, (_, i) => ({
                  id: String(i + 1),
                  value: 'token',
                  position: i,
                  status: i < tokens ? 'stored' : 'empty',
                }))}
              />
            </div>
            <p className="small">
              {tokens.toFixed(1)} / 5 tokens · Clock: {time}s · refill: 1
              token/s
            </p>
            <div className="inline-form">
              <button
                className="primary"
                onClick={() => {
                  const r = consumeToken(tokens, 5, 1, 0);
                  setTokens(r.tokens);
                  record(
                    r.allowed
                      ? 'ALLOWED: consumed one token'
                      : 'REJECTED: no token available',
                  );
                }}
              >
                Send request
              </button>
              <button
                className="secondary"
                onClick={() => {
                  setTokens((t) => Math.min(5, t + 1));
                  setTime((t) => t + 1);
                  record('CLOCK +1s');
                }}
              >
                Advance 1 second
              </button>
              <button
                className="secondary"
                onClick={() => {
                  let t = tokens,
                    allowed = 0;
                  for (let i = 0; i < 10; i++) {
                    const r = consumeToken(t, 5, 1, 0);
                    t = r.tokens;
                    if (r.allowed) allowed++;
                  }
                  setTokens(t);
                  record(`BURST: ${allowed}/10 allowed`);
                }}
              >
                Burst 10 requests
              </button>
            </div>
          </>
        ) : id === 'order' ? (
          <>
            <div className="lld-motion motion-order live-state">
              <LLDStateScene
                id="order"
                units={['pending', 'paid', 'shipped', 'cancelled'].map(
                  (id, position) => ({
                    id,
                    value: id,
                    position,
                    status: id === order ? 'active' : 'empty',
                  }),
                )}
              />
            </div>
            <div className="inline-form">
              {['paid', 'shipped', 'cancelled'].map((s) => (
                <button
                  className="secondary"
                  key={s}
                  onClick={() => {
                    const r = transitionOrder(order, s);
                    setOrder(r.state);
                    record(
                      `${order} → ${s}: ${r.valid ? 'accepted' : 'rejected'}`,
                    );
                  }}
                >
                  {s === 'paid' ? 'Pay' : s === 'shipped' ? 'Ship' : 'Cancel'}
                </button>
              ))}
              <button
                className="text-button"
                onClick={() => {
                  setOrder('pending');
                  setLog([]);
                }}
              >
                <RotateCcw size={15} />
                New order
              </button>
            </div>
            <p className="small">
              This simplified state model omits payment I/O. A real paid
              cancellation needs a refund workflow and reconciliation.
            </p>
          </>
        ) : (
          <>
            <div className="lld-motion motion-parking live-state">
              <LLDStateScene
                id="parking"
                units={spaces.map((used, i) => ({
                  id: String(i + 1),
                  value: used ? 'Occupied' : 'Available',
                  position: i,
                  status: used ? 'stored' : 'empty',
                }))}
                onUnitClick={(unit) => {
                  const index = Number(unit.id) - 1;
                  const r = parkingExit(spaces, index);
                  setSpaces(r.spaces);
                  record(
                    `EXIT ${index + 1}: ${r.accepted ? 'space released' : 'rejected, no active session'}`,
                  );
                }}
              />
            </div>
            <button
              className="primary"
              onClick={() => {
                const r = parkingEnter(spaces);
                setSpaces(r.spaces);
                record(
                  r.accepted
                    ? `ENTRY: assigned space ${r.index + 1}`
                    : 'ENTRY REJECTED: garage full',
                );
              }}
            >
              Enter vehicle
              <ArrowRight size={16} />
            </button>
            <p className="small">
              Single-threaded occupancy model only. Production reservation needs
              an atomic shared-storage operation.
            </p>
          </>
        )}
      </section>
      <aside className="control-panel">
        <h3>Operation log</h3>
        <div className="operation-log" aria-live="polite">
          {log.length ? (
            log.map((l, i) => <div key={i}>{l}</div>)
          ) : (
            <p>Run an operation to inspect its effect.</p>
          )}
        </div>
        <button className="secondary wide" onClick={runTests}>
          <Play size={15} />
          Run reference checks
        </button>
        {tests.map((t) => (
          <p className="test-result" key={t}>
            {t}
          </p>
        ))}
      </aside>
    </div>
  );
}

function LRUCheckpoint({ section }: { section: number }) {
  const [choice, setChoice] = useState<number | null>(null),
    [checked, setChecked] = useState(false);
  const question =
    section === 1
      ? {
          title: 'Checkpoint · contract and representation',
          prompt:
            'Capacity is one. After put(A, 1), put(A, 2), then get(A), which state is valid?',
          options: [
            'Two A nodes; get returns the newest value.',
            'One A node with value 2; the same key remains indexed.',
            'The update evicts A, so get must miss.',
          ],
          answer: 1,
          why: 'Updating replaces the value and promotes the existing node. It neither creates a duplicate nor consumes another capacity slot.',
        }
      : {
          title: 'Checkpoint · concurrency',
          prompt:
            'Thread one finds A while thread two can evict it. Which protection preserves the exact LRU invariant?',
          options: [
            'Lock only hash-map writes; get does not change stored values.',
            'Protect lookup, recency mutation, and eviction with the same synchronization boundary.',
            'Check the size after each operation; repair links later.',
          ],
          answer: 1,
          why: 'A hit mutates the list. Lookup and promotion must not race with eviction, or a detached node can return to the list without an index entry. Size alone cannot prove pointer consistency.',
        };
  return (
    <section className="lld-checkpoint">
      <h4>{question.title}</h4>
      <fieldset>
        <legend>{question.prompt}</legend>
        {question.options.map((option, i) => (
          <label key={option}>
            <input
              type="radio"
              name={'lru-check-' + section}
              checked={choice === i}
              onChange={() => {
                setChoice(i);
                setChecked(false);
              }}
            />
            {option}
          </label>
        ))}
      </fieldset>
      <button
        className="secondary"
        disabled={choice === null}
        onClick={() => setChecked(true)}
      >
        Check reasoning
      </button>
      {checked && (
        <p role="status">
          <strong>
            {choice === question.answer ? 'Correct.' : 'Revisit the invariant.'}
          </strong>{' '}
          {question.why}
        </p>
      )}
    </section>
  );
}
