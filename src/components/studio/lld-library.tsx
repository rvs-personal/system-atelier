'use client';
import { useEffect, useState } from 'react';
import { ArrowRight, BookOpen, Code2, Play } from 'lucide-react';
import { lldLibrary, lldReferences } from '@/lib/studio/lld-library';
import { useCloud } from '@/lib/studio/storage';
import { signInHref } from '@/lib/auth/public-access';
import { useAccount } from '@/lib/auth/context';
import { CloudStatus } from './shared';
import './lld-library.css';
import DesignTrace from './design-trace';
type Review = {
  summary: string;
  findings: {
    severity: string;
    symbol: string;
    issue: string;
    example: string;
    repair: string;
  }[];
  strengths: string[];
  tests: string[];
  model: string;
};
type Draft = {
  language: string;
  contract: string;
  code: string;
  review?: Review;
  reviewedCode?: string;
};
export type PracticeState = { drafts: Record<string, Draft> };
export default function LLDLibrary({
  route,
  cloud,
}: {
  route: string;
  cloud: ReturnType<typeof useCloud<PracticeState>>;
}) {
  const [selectedArea, id] = route.split('/').slice(1),
    area = selectedArea ?? 'reading',
    exercise = lldLibrary.find((c) => c.id === id);
  const auth = useAccount();
  const [pendingDraft, setPendingDraft] = useState<Draft | null>(null);
  useEffect(() => {
    setPendingDraft(null);
    if (!auth || !exercise || !cloud.ready) return;
    try {
      const pending = JSON.parse(
        sessionStorage.getItem('atelier-review-draft') ?? 'null',
      );
      if (
        pending?.caseId === exercise.id &&
        typeof pending.draft?.code === 'string' &&
        typeof pending.draft?.contract === 'string' &&
        typeof pending.draft?.language === 'string'
      ) {
        if (pending.draft.code !== cloud.data.drafts[exercise.id]?.code)
          setPendingDraft(pending.draft);
        else sessionStorage.removeItem('atelier-review-draft');
      }
    } catch {}
  }, [auth, exercise, cloud.ready, cloud.data.drafts]);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [filter, setFilter] = useState('');
  const draft = exercise
    ? (cloud.data.drafts[exercise.id] ?? {
        language: 'TypeScript',
        contract: exercise.invariants.join('\n'),
        code: exercise.starter,
      })
    : null;
  function update(change: Partial<Draft>) {
    if (!exercise || !draft || !cloud.ready) return;
    cloud.setData((data) => ({
      ...data,
      drafts: { ...data.drafts, [exercise.id]: { ...draft, ...change } },
    }));
  }
  async function review() {
    if (!exercise || !draft) return;
    if (!auth) {
      await cloud.save();
      sessionStorage.setItem(
        'atelier-review-draft',
        JSON.stringify({ caseId: exercise.id, draft }),
      );
      window.location.hash = signInHref(window.location.hash);
      return;
    }
    setBusy(true);
    setError('');
    const submitted = { ...draft },
      caseId = exercise.id;
    try {
      const response = await fetch('/api/lld-review', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Atelier-Account': auth?.user.id ?? '',
        },
        body: JSON.stringify({
          caseId,
          language: submitted.language,
          code: submitted.code,
          contract: submitted.contract,
        }),
        signal: AbortSignal.timeout(185000),
      });
      const result = (await response.json()) as Review & { error?: string };
      if (!response.ok) throw Error(result.error ?? 'Review unavailable');
      cloud.setData((data) => ({
        ...data,
        drafts: {
          ...data.drafts,
          [caseId]: {
            ...(data.drafts[caseId] ?? submitted),
            review: result,
            reviewedCode: submitted.code + '\n' + submitted.contract,
          },
        },
      }));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Review unavailable');
    } finally {
      setBusy(false);
    }
  }
  const paths = (
    <nav className="lld-mode-nav" aria-label="LLD modes">
      <a
        href="#lld/reading"
        aria-current={area === 'reading' ? 'page' : undefined}
      >
        <BookOpen size={17} />
        Learning
      </a>
      <a
        href="#lld/practice"
        aria-current={area === 'practice' ? 'page' : undefined}
      >
        <Code2 size={17} />
        Coding practice
      </a>
      <a href="#lld/simulations">
        <Play size={17} />
        Interactive workbenches
      </a>
    </nav>
  );
  if (!exercise)
    return (
      <section className="lld-library">
        <header>
          <h1>
            {area === 'practice' ? 'LLD coding practice' : 'Low-level design'}
          </h1>
          <p>
            {area === 'practice'
              ? 'Define a contract, write classes and functions, then request a review with concrete counterexamples.'
              : '15 systems, from local data structures to concurrent ownership. Follow the contract, trace an operation and examine where it breaks.'}
          </p>
        </header>
        {paths}
        <label className="field lld-search">
          <span>Find a design</span>
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Search by system or concept…"
          />
        </label>
        <div className="lld-catalogue">
          {[
            {
              title: 'Data structures & resources',
              detail: 'Start with a bounded resource and a precise contract.',
              ids: ['lru', 'bucket', 'connection-pool', 'filesystem'],
            },
            {
              title: 'Domain models & state',
              detail: 'Make ownership and legal transitions explicit.',
              ids: ['parking', 'order', 'vending', 'library', 'chess'],
            },
            {
              title: 'Events & responsibilities',
              detail: 'Separate policy, delivery and object lifetimes.',
              ids: ['pubsub', 'logging', 'elevator'],
            },
            {
              title: 'Coordination & invariants',
              detail: 'Keep the promise when operations overlap or repeat.',
              ids: ['split-expense', 'scheduler', 'reservation'],
            },
          ].map((group) => {
            const entries = group.ids
              .map((id) => lldLibrary.find((c) => c.id === id)!)
              .filter((c) =>
                (c.name + ' ' + c.category + ' ' + c.brief)
                  .toLowerCase()
                  .includes(filter.toLowerCase()),
              );
            if (!entries.length) return null;
            return (
              <section className="lld-design-group" key={group.title}>
                <header>
                  <h2>{group.title}</h2>
                  <p>{group.detail}</p>
                  <span>{entries.length} designs</span>
                </header>
                <div className="lld-group-entries">
                  {entries.map((c) => (
                    <a
                      className="lld-design-entry"
                      key={c.id}
                      href={
                        '#lld/' +
                        (area === 'practice' ? 'practice' : 'reading') +
                        '/' +
                        c.id
                      }
                    >
                      <DesignTrace id={c.id} />
                      <div className="lld-design-summary">
                        <span className="eyebrow">{c.category}</span>
                        <h3>{c.name}</h3>
                        <p>{c.brief}</p>
                        <span className="lld-card-action">
                          {area === 'practice' ? 'Write code' : 'Read design'}
                          <ArrowRight size={17} />
                        </span>
                      </div>
                    </a>
                  ))}
                </div>
              </section>
            );
          })}
          {!lldLibrary.some((c) =>
            (c.name + ' ' + c.category + ' ' + c.brief)
              .toLowerCase()
              .includes(filter.toLowerCase()),
          ) && (
            <p role="status">
              No designs match. Try “cache”, “state” or “ownership”.
            </p>
          )}
        </div>
      </section>
    );
  return (
    <section className="lld-library">
      {paths}
      <header>
        <span className="eyebrow">{exercise.category}</span>
        <h1>{exercise.name}</h1>
        <p>{exercise.brief}</p>
      </header>
      {area === 'practice' ? (
        <>
          <CloudStatus {...cloud} />
          {pendingDraft && (
            <div className="explain">
              <p>
                You have a practice draft from before sign-in. Your saved
                account version is shown below.
              </p>
              <button
                className="secondary"
                onClick={() => {
                  update(pendingDraft);
                  setPendingDraft(null);
                  sessionStorage.removeItem('atelier-review-draft');
                }}
              >
                Use my browser draft
              </button>
              <button
                className="text-button"
                onClick={() => {
                  setPendingDraft(null);
                  sessionStorage.removeItem('atelier-review-draft');
                }}
              >
                Keep account version
              </button>
            </div>
          )}
          <div className="lld-coding-grid">
            <section>
              <label className="field">
                <span>Implementation language</span>
                <select
                  disabled={!cloud.ready || busy}
                  value={draft!.language}
                  onChange={(e) => update({ language: e.target.value })}
                >
                  {['TypeScript', 'Java', 'Python', 'C++', 'Go'].map((lang) => (
                    <option key={lang}>{lang}</option>
                  ))}
                </select>
              </label>
              <p className="small">
                Starter contracts use TypeScript. Replace them with your chosen
                language’s implementation.
              </p>
              <label className="field">
                <span>
                  Your contract: inputs, outputs, invariants and failures
                </span>
                <textarea
                  rows={6}
                  value={draft!.contract}
                  disabled={!cloud.ready || busy}
                  maxLength={8000}
                  onChange={(e) => update({ contract: e.target.value })}
                />
              </label>
              <label className="field">
                <span>Classes and functions</span>
                <textarea
                  className="lld-implementation"
                  spellCheck={false}
                  disabled={!cloud.ready || busy}
                  value={draft!.code}
                  maxLength={24000}
                  onChange={(e) => update({ code: e.target.value })}
                />
              </label>
              <button
                className="primary"
                disabled={
                  !cloud.ready || busy || draft!.code.trim().length < 40
                }
                onClick={review}
              >
                {busy
                  ? 'Reviewing your implementation…'
                  : auth
                    ? 'Review my code'
                    : 'Sign in for AI review'}
                <ArrowRight size={16} />
              </button>
              <p className="small">
                Static model review; code is not executed. Run the proposed
                tests in your own development environment.
              </p>
              {busy && (
                <p role="status">
                  Checking class boundaries, invariants and failure handling…
                  You can keep this page open while the reviewer responds.
                </p>
              )}
              {error && (
                <p role="alert" className="feedback amber">
                  {error}
                </p>
              )}
            </section>
            <aside>
              <h2>Required behavior</h2>
              <ul>
                {exercise.invariants.map((i) => (
                  <li key={i}>{i}</li>
                ))}
              </ul>
              <h3>Try to break your implementation</h3>
              {exercise.tests.map(([test, result, why]) => (
                <details key={test}>
                  <summary>{test}</summary>
                  <p>
                    {result}. {why}
                  </p>
                </details>
              ))}
              <a href={'#lld/reading/' + exercise.id}>
                Read the worked design →
              </a>
            </aside>
          </div>
          {draft!.review && (
            <section className="lld-code-review">
              <span className="eyebrow">
                MODEL REVIEW · {draft!.review.model}
              </span>
              {draft!.reviewedCode !== draft!.code + '\n' + draft!.contract && (
                <p className="feedback amber">
                  This review belongs to an earlier version. Submit your current
                  code for a fresh review.
                </p>
              )}
              <h2>Review of your implementation</h2>
              <p>{draft!.review.summary}</p>
              {draft!.review.findings.map((f, i) => (
                <article key={i}>
                  <span className="tag">{f.severity}</span>
                  <h3>{f.symbol}</h3>
                  <p>{f.issue}</p>
                  <p>
                    <strong>Counterexample:</strong> {f.example}
                  </p>
                  <p>
                    <strong>Repair:</strong> {f.repair}
                  </p>
                </article>
              ))}
              <h3>What holds up</h3>
              <ul>
                {draft!.review.strengths.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ul>
              <h3>Tests to add</h3>
              <ul>
                {draft!.review.tests.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ul>
            </section>
          )}
        </>
      ) : (
        <div className="lld-reading-layout">
          <article>
            {exercise.sections.map((section, i) => (
              <section id={'lld-section-' + i} key={section.title}>
                <span className="eyebrow">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <h2>{section.title}</h2>
                <p>{section.text}</p>
                {exercise.id === 'lru' && i === 0 && (
                  <p className="trace-reading-caption">
                    Trace notation: [most recent → least recent]. Reading A
                    moves it to the front; adding C then evicts B.
                  </p>
                )}
                <pre>{section.code}</pre>
              </section>
            ))}
            <section>
              <h2>Boundary cases</h2>
              <table>
                <thead>
                  <tr>
                    <th>Input or event</th>
                    <th>Expected outcome</th>
                    <th>Why</th>
                  </tr>
                </thead>
                <tbody>
                  {exercise.tests.map((row) => (
                    <tr key={row[0]}>
                      {row.map((text, i) => (
                        <td key={i}>{text}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
            <section>
              <h2>Change the requirements</h2>
              <p>{exercise.extension}</p>
              <details>
                <summary>Compare a defensible approach</summary>
                <p>{exercise.tradeoff}</p>
              </details>
            </section>
            {lldReferences[exercise.id] && (
              <section>
                <h2>Reference contracts</h2>
                <p>
                  Compare the guarantees of a real implementation or the
                  domain’s rules with this exercise.
                </p>
                <ul>
                  {lldReferences[exercise.id].map((ref) => (
                    <li key={ref.url}>
                      <a href={ref.url} target="_blank" rel="noreferrer">
                        {ref.title}
                      </a>
                    </li>
                  ))}
                </ul>
              </section>
            )}
            <a className="primary" href={'#lld/practice/' + exercise.id}>
              Implement this design
              <ArrowRight size={16} />
            </a>
          </article>
          <aside>
            <h3>In this design</h3>
            {exercise.sections.map((section, i) => (
              <button
                key={section.title}
                onClick={() =>
                  document
                    .getElementById('lld-section-' + i)
                    ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                }
              >
                {section.title}
              </button>
            ))}
            <h3>Keep these invariants</h3>
            <ul>
              {exercise.invariants.map((i) => (
                <li key={i}>{i}</li>
              ))}
            </ul>
            {['lru', 'parking', 'bucket', 'order'].includes(exercise.id) && (
              <a href={'#lld/' + exercise.id}>Open interactive workbench →</a>
            )}
          </aside>
        </div>
      )}
    </section>
  );
}
