'use client';
import { useState } from 'react';
import { ArrowRight, Search, Check, Compass, FlaskConical } from 'lucide-react';
import { lessons } from '@/lib/studio/curriculum';
import { learningParts, learningModules } from '@/lib/studio/learning-map';
import { incidents } from '@/lib/studio/operations';
import { lldLibrary } from '@/lib/studio/lld-library';
import { chapterReading } from '@/lib/studio/reading-time';
import './learning-directory.css';
export default function LearningDirectory({
  completed,
  moduleId,
  partId = 'all',
}: {
  completed: string[];
  moduleId?: string;
  partId?: string;
}) {
  const [query, setQuery] = useState('');
  const part = partId;
  const currentModule = learningModules.find((m) => m.id === moduleId);
  const matching = (m: (typeof learningModules)[number]) =>
    [
      m.partTitle,
      m.title,
      m.outcome,
      ...m.lessons.map((id) => lessons.find((l) => l.id === id)?.title),
    ]
      .join(' ')
      .toLowerCase()
      .includes(query.toLowerCase());
  const practiceRoute = currentModule?.practice.split('/') ?? [];
  const practiceTitle =
    practiceRoute[0] === 'learn'
      ? lessons.find((l) => l.id === practiceRoute[1])?.title
      : practiceRoute[0] === 'lld'
        ? (lldLibrary.find((l) => l.id === practiceRoute[2])?.name ??
          'LLD design exercises')
        : ({
            tour: 'A lunch-rush capacity incident',
            load: 'Request load and bottlenecks',
            queue: 'Delayed notifications',
            quorum: 'Replicated reads and writes',
            estimate: 'Capacity planning',
          }[practiceRoute[1]] ??
          incidents[Number(practiceRoute[1])]?.title ??
          'Architecture lab');
  const practicePrompt =
    practiceRoute[0] === 'learn'
      ? lessons.find((l) => l.id === practiceRoute[1])?.exercise
      : practiceRoute[0] === 'lld'
        ? lldLibrary.find((l) => l.id === practiceRoute[2])?.brief
        : practiceRoute[1] === 'tour'
          ? 'Trace a cafe order, create a lunch-rush bottleneck, then add capacity on the diagram and compare customer outcomes and cost.'
          : (incidents[Number(practiceRoute[1])]?.brief ??
            'Predict the result before changing a control. Compare the observed result and explain the tradeoff.');
  const resumeLesson = lessons.find(
    (l) =>
      l.id ===
      learningModules
        .flatMap((m) => m.lessons)
        .find((id) => !completed.includes(id)),
  );
  const nextLesson = currentModule?.lessons.find(
    (id) => !completed.includes(id),
  );
  if (currentModule)
    return (
      <div className="module-page">
        <span className="map-overline">{currentModule.partTitle}</span>
        <h1>{currentModule.title}</h1>
        <p className="module-outcome">{currentModule.outcome}</p>
        <div className="module-context">
          <p>
            <strong>Before you start</strong>
            {currentModule.prerequisite}
            <span className="prerequisite-links">
              {currentModule.requires.map((id) => {
                const item = learningModules.find((m) => m.id === id)!;
                return (
                  <a key={id} href={'#learn/module/' + id}>
                    {item.title} ↗
                  </a>
                );
              })}
            </span>
          </p>
          <p>
            <strong>Module progress</strong>
            <progress
              className="module-progress-bar"
              aria-label="Lessons completed"
              value={
                currentModule.lessons.filter((id) => completed.includes(id))
                  .length
              }
              max={currentModule.lessons.length}
            />
            {
              currentModule.lessons.filter((id) => completed.includes(id))
                .length
            }{' '}
            of {currentModule.lessons.length} lessons complete
          </p>
        </div>
        <ol className="module-lessons">
          {currentModule.lessons.map((id, i) => {
            const l = lessons.find((l) => l.id === id)!;
            return (
              <li key={id} data-recommended={id === nextLesson}>
                <a href={'#learn/' + id}>
                  <span>
                    {completed.includes(id) ? (
                      <Check size={18} />
                    ) : (
                      String(i + 1).padStart(2, '0')
                    )}
                  </span>
                  <div>
                    <h2>{l.title}</h2>
                    <p>
                      {completed.includes(id)
                        ? 'Completed'
                        : id === nextLesson
                          ? 'Up next'
                          : i === currentModule.lessons.length - 1
                            ? 'Apply and consolidate'
                            : 'Build on the previous lesson'}{' '}
                      · {chapterReading(l).minutes} min reading
                    </p>
                  </div>
                  <span className="lesson-row-action">
                    {completed.includes(id)
                      ? 'Review'
                      : id === nextLesson
                        ? completed.some((id) =>
                            currentModule.lessons.includes(id),
                          )
                          ? 'Continue'
                          : 'Start lesson'
                        : 'Open'}{' '}
                    <ArrowRight size={16} />
                  </span>
                </a>
              </li>
            );
          })}
        </ol>
        {currentModule.id === 'contracts' && (
          <aside className="module-security-checkpoint">
            <strong>Before exposing an API</strong>
            <p>
              Identify the caller, authorize access to each resource, validate
              inputs and avoid returning secrets. Use TLS for transport;
              authentication alone does not establish resource ownership.
            </p>
            <a href="#learn/security">
              Check trust boundaries and authorization <ArrowRight size={16} />
            </a>
          </aside>
        )}
        <div className="module-practice">
          <FlaskConical size={24} />
          <div>
            <h2>{practiceTitle}</h2>
            <p>
              {currentModule && 'practicePrompt' in currentModule
                ? currentModule.practicePrompt
                : practicePrompt}
            </p>
          </div>
          <a href={'#' + currentModule.practice}>
            Open practice <ArrowRight size={16} />
          </a>
        </div>
      </div>
    );
  return (
    <div className="learning-directory">
      <header className="map-heading">
        <h1>System design</h1>
        <p>From a single request to decisions across a distributed system.</p>
        <div className="map-stats">
          <span>{learningParts.length} parts</span>
          <span>{learningModules.length} modules</span>
          <span>{lessons.length} lessons</span>
          <span>{completed.length} completed</span>
        </div>
      </header>
      {resumeLesson && (
        <div className="course-next">
          <span className="course-next-number">
            {completed.length ? '↗' : '01'}
          </span>
          <div>
            <span>
              {completed.length ? 'CONTINUE LEARNING' : 'YOUR FIRST LESSON'}
            </span>
            <strong>{resumeLesson.title}</strong>
            <small>
              {chapterReading(resumeLesson).minutes} min reading · interactive
              example & checkpoint
            </small>
          </div>
          <div className="course-next-links">
            <a
              className="course-next-action"
              href={'#learn/' + resumeLesson.id}
            >
              {completed.length ? 'Continue' : 'Start lesson'}{' '}
              <ArrowRight size={17} />
            </a>
            <a href="#learn/orientation">Orientation & prerequisites</a>
          </div>
        </div>
      )}
      <div className="map-layout">
        <div className="map-content">
          <div className="map-filters">
            <label className="part-select">
              Course part
              <select
                aria-label="Filter by course part"
                value={part}
                onChange={(e) => {
                  window.location.hash =
                    e.target.value === 'all'
                      ? 'learn'
                      : 'learn/part/' + e.target.value;
                }}
              >
                <option value="all">All 10 parts</option>
                {learningParts.map((p, i) => (
                  <option key={p.id} value={p.id}>
                    {String(i + 1).padStart(2, '0')} · {p.title}
                  </option>
                ))}
              </select>
            </label>
            <label className="map-search">
              <Search size={17} />
              <input
                aria-label="Search modules and lessons"
                placeholder="Find a concept, module or lesson…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              {query && (
                <button aria-label="Clear search" onClick={() => setQuery('')}>
                  Clear
                </button>
              )}
            </label>
          </div>
          {learningParts
            .filter((p) => part === 'all' || p.id === part)
            .map((p) => {
              const mods = p.modules.filter((m) =>
                matching({ ...m, partId: p.id, partTitle: p.title }),
              );
              if (!mods.length) return null;
              return (
                <section className="map-part" key={p.id}>
                  <header>
                    <span>
                      PART{' '}
                      {String(learningParts.indexOf(p) + 1).padStart(2, '0')}
                    </span>
                    <h2>{p.title}</h2>
                    <p>{p.description}</p>
                  </header>
                  <div className="module-list">
                    {mods.map((m) => (
                      <article className="module-card" key={m.id}>
                        <span className="module-number">
                          {String(
                            learningModules.findIndex(
                              (item) => item.id === m.id,
                            ) + 1,
                          ).padStart(2, '0')}
                        </span>
                        <a
                          className="module-title"
                          href={'#learn/module/' + m.id}
                        >
                          <h3>{m.title}</h3>
                          <span className="module-open">
                            Open module <ArrowRight size={15} />
                          </span>
                        </a>
                        <p>{m.outcome}</p>
                        <details open={query.length > 0 || undefined}>
                          <summary>
                            {m.lessons.length} ordered{' '}
                            {m.lessons.length === 1 ? 'lesson' : 'lessons'}{' '}
                            <span>
                              {
                                m.lessons.filter((id) => completed.includes(id))
                                  .length
                              }
                              /{m.lessons.length} complete
                            </span>
                          </summary>
                          <ol>
                            {m.lessons.map((id) => {
                              const l = lessons.find((l) => l.id === id)!;
                              return (
                                <li key={id}>
                                  <a href={'#learn/' + id}>
                                    {l.title}
                                    {completed.includes(id) && (
                                      <Check size={14} />
                                    )}
                                  </a>
                                </li>
                              );
                            })}
                          </ol>
                        </details>
                      </article>
                    ))}
                  </div>
                </section>
              );
            })}
          {!learningModules.some(
            (m) => (part === 'all' || m.partId === part) && matching(m),
          ) && (
            <p className="map-empty">
              No matching lessons. Try “cache”, “transactions” or “replication”.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
export function LearningOrientation() {
  const [answer, setAnswer] = useState<number | null>(null);
  return (
    <article className="orientation-page">
      <a className="map-back" href="#learn">
        ← Learning path
      </a>
      <span className="map-overline">Orientation</span>
      <h1>
        Learn a mechanism.
        <br />
        Then test its limits.
      </h1>
      <p className="module-outcome">
        This course assumes you can read a function and a simple data structure.
        It teaches system design; it does not replace a programming or SQL
        course.
      </p>
      <section>
        <h2>What you are designing</h2>
        <p>
          A system is a set of parts that cooperate to deliver an outcome. For a
          café order, the outcome is not “a server returned 200”. It is that the
          correct order is accepted once, kept durably, and visible to the
          customer.
        </p>
        <p>
          Begin with the promise, then choose the parts. An API accepts a
          request, business logic checks the rules, and a database stores the
          result. Failures between those steps explain why a successful write
          and a received response are different events.
        </p>
      </section>
      <section>
        <h2>A few foundations to bring with you</h2>
        <dl>
          <dt>Functions and state</dt>
          <dd>
            A function takes an input and may return a value or change state.
            Two calls that read the same old state can race. A correct design
            protects the whole business operation, not just each individual
            read.
          </dd>
          <dt>Tables, keys and queries</dt>
          <dd>
            A row represents a record. A primary key identifies it; a foreign
            key refers to another record. An index can reduce read work but
            costs space and write work. Before the database modules, be
            comfortable with SELECT, INSERT and a transaction.
          </dd>
          <dt>Units and assumptions</dt>
          <dd>
            100 requests per second is a rate. 100 milliseconds is a duration. A
            queue holds a count of waiting work. Keep units visible and
            distinguish a measured value from a modeling assumption.
          </dd>
        </dl>
        <p>
          Need a refresher? Read the{' '}
          <a
            href="https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Functions"
            target="_blank"
            rel="noreferrer"
          >
            MDN functions guide
          </a>{' '}
          and the{' '}
          <a
            href="https://www.postgresql.org/docs/current/tutorial-sql.html"
            target="_blank"
            rel="noreferrer"
          >
            PostgreSQL SQL tutorial
          </a>{' '}
          before the related modules.
        </p>
      </section>
      <section>
        <h2>Choose your route</h2>
        <p>
          For HLD, follow requests, capacity and data access before distributed
          correctness. For LLD, you can start at domain modeling once you know
          basic classes and data structures. Transaction material becomes
          important when a design spans multiple records.
        </p>
        <p>
          Each module has an outcome, prerequisites and ordered lessons.
          Overview lessons introduce the vocabulary; later deep dives test it
          against failures. Security is cross-cutting: visit the security module
          when you first design a public API, then revisit it for operations.
        </p>
        <div className="orientation-routes">
          <a href="#learn/module/frame">
            Begin HLD <ArrowRight size={16} />
          </a>
          <a href="#learn/module/domain">
            Begin LLD <ArrowRight size={16} />
          </a>
          <a href="#learn/module/secure">
            Review trust boundaries <ArrowRight size={16} />
          </a>
        </div>
      </section>
      <section>
        <h2>A quick foundations check</h2>
        <p>
          Customers send 120 requests/s to an API that can complete 100
          requests/s. What happens if nothing else changes?
        </p>
        {[
          'The API becomes 20% faster automatically.',
          'Waiting work grows by 20 requests each second, unless requests are rejected or time out.',
          'A read replica always fixes the problem.',
        ].map((text, i) => (
          <button
            className={'orientation-answer ' + (answer === i ? 'chosen' : '')}
            key={text}
            onClick={() => setAnswer(i)}
          >
            {text}
          </button>
        ))}
        {answer !== null && (
          <output className="orientation-feedback">
            {answer === 1
              ? 'Correct. Arrivals exceed service capacity. Next find why the API is limited before choosing a repair.'
              : 'Not yet. Compare the arrival rate with the service rate. More work arrives than can finish; a repair must address the actual bottleneck.'}
          </output>
        )}
      </section>
      <section>
        <h2>How to use the practice</h2>
        <p>
          Predict the result before touching a control. Change one thing, check
          the customer outcome and cost, then write down what the change
          improved and what it made worse. The lab is a teaching model, not a
          capacity guarantee for a real deployment.
        </p>
        <p>
          Completion records practice, not professional readiness. Leadership
          modules are decision exercises. Learning and building work without an
          account and save in this browser; sign in for AI interviews and
          reviews.
        </p>
        <a className="orientation-start" href="#lab/tour">
          Take the guided lab tour <ArrowRight size={18} />
        </a>
      </section>
    </article>
  );
}
