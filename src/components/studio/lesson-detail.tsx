'use client';
import { useState } from 'react';
import { ExternalLink, Check, ChevronRight } from 'lucide-react';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { atlas, reading } from '@/lib/studio/lesson-atlas';
import type { Lesson } from '@/lib/studio/curriculum';
import { chapterCopy } from '@/lib/studio/chapter-copy';
import { foundationFor } from '@/lib/studio/chapter-foundations';
import Diagram from './diagram';
import MechanismPlayground from './mechanism-playground';
import { chapterDiagram } from '@/lib/studio/chapter-diagrams';
import { chapterRows } from '@/lib/studio/curriculum-expanded';
export default function LessonDetail({ lesson: l }: { lesson: Lesson }) {
  const a = atlas[l.id],
    row = chapterRows.find((r) => r[1] === l.id),
    f = foundationFor(l),
    family = familyFor(l.id),
    diagram = a?.design ?? chapterDiagram(l.id);
  const [prediction, setPrediction] = useState(''),
    [showDiagnosis, setShowDiagnosis] = useState(false);
  const failure = row?.[5] ?? a?.failure ?? l.exercise,
    repair = row?.[6] ?? l.solution,
    contract = row?.[8] ?? a?.contract ?? l.solution;
  return (
    <>
      <section id="lesson-foundations" className="lesson-section">
        <span className="eyebrow">01 / FOUNDATIONS · {f.name}</span>
        {f.sections.map((s, i) => (
          <div className="chapter-subsection" key={s.title}>
            <h2>{s.title}</h2>
            {s.paragraphs.map((p) => (
              <p key={p}>{p}</p>
            ))}
            <div className="worked-calculation">
              <span>WORKED REASONING</span>
              <p>{s.example}</p>
            </div>
            {f.checks
              .filter((q) => q.afterSection === i)
              .map((q, j) => (
                <div className="chapter-checkpoint" key={j}>
                  <span className="eyebrow">CHECK YOUR UNDERSTANDING</span>
                  <KnowledgeCheck {...q} />
                </div>
              ))}
          </div>
        ))}
      </section>
      {f.checks.some((q) => q.afterSection === undefined) && (
        <section className="chapter-checkpoint">
          <span className="eyebrow">CHECKPOINT 1 · AFTER THE FOUNDATIONS</span>
          <h2>Test the boundary</h2>
          {f.checks
            .filter((q) => q.afterSection === undefined)
            .map((q, i) => (
              <KnowledgeCheck key={l.id + i} {...q} />
            ))}
          <p className="small">
            The next section applies these rules to {l.title.toLowerCase()}.
          </p>
        </section>
      )}
      <section id="lesson-mechanism" className="lesson-section">
        <span className="eyebrow">02 / APPLY THE MECHANISM</span>
        <h2>{a?.title ?? l.title + ' in practice'}</h2>
        <div className="chapter-case">
          <h3>The worked case</h3>
          <p>{l.example}</p>
        </div>
        {family ? (
          <MechanismPlayground family={family} />
        ) : diagram ? (
          <Diagram
            design={diagram}
            compact
            legend="Relationships in this chapter · follow the explanations below"
          />
        ) : null}
        {a ? (
          <div className="mechanism-explanations">
            {a.trace.map((p, i) => (
              <article key={i}>
                <strong>
                  {
                    [
                      'Inputs and the first boundary',
                      'State, ownership and the decisive operation',
                      'Returned result and observable consequences',
                    ][i]
                  }
                </strong>
                <p>{p}</p>
              </article>
            ))}
          </div>
        ) : (
          <div className="chapter-subsection">
            <h3>Read the operation contract in order</h3>
            <p>{l.idea}</p>
            <p>{chapterCopy[0]}</p>
          </div>
        )}
        <h3>Specify the behavior</h3>
        <pre className="lesson-code">{contract}</pre>
        <p>{chapterCopy[1]}</p>
      </section>
      <section id="lesson-contract" className="lesson-section">
        <span className="eyebrow">03 / FAILURE & RECOVERY</span>
        <h2>Interrupt the sequence</h2>
        <div className="failure-case">
          <strong>Observed failure</strong>
          <p>{failure}</p>
        </div>
        <label className="field">
          <span>
            Before revealing the repair: which assumption failed, and what
            evidence would distinguish it from another cause?
          </span>
          <textarea
            rows={3}
            value={prediction}
            onChange={(e) => setPrediction(e.target.value)}
            placeholder="I expect… because… I would inspect…"
          />
        </label>
        <button
          className="secondary"
          onClick={() => setShowDiagnosis(!showDiagnosis)}
        >
          {showDiagnosis ? 'Hide diagnosis' : 'Reveal diagnosis and repair'}
          <ChevronRight size={15} />
        </button>
        {showDiagnosis && (
          <div className="diagnosis-reading">
            <h3>Change the responsible boundary</h3>
            <p>{repair}</p>
            <h3>Verify using the same failing sequence</h3>
            <p>{l.solution}</p>
            <p>{chapterCopy[2]}</p>
          </div>
        )}
      </section>
      <section className="chapter-checkpoint">
        <span className="eyebrow">CHECKPOINT 2 · AFTER THE WORKED FAILURE</span>
        <h2>Explain the recovery</h2>
        <p>{l.exercise}</p>
        <details>
          <summary>Compare your explanation</summary>
          <p>{repair}</p>
          <p>{l.reason}</p>
        </details>
        <p className="small">
          Explain why the action changes the failure mechanism. Naming a
          component or increasing its size is not an explanation.
        </p>
      </section>
      <section id="lesson-judgment" className="lesson-section">
        <span className="eyebrow">04 / TRADEOFFS & LIMITS</span>
        <h2>Decide when the repair is worth it</h2>
        {a && <p>{a.decision}</p>}
        <p>{l.tradeoff}</p>
        <p>{chapterCopy[3]}</p>
        <div className="decision-notebook">
          <strong>Before moving on</strong>
          <p>{chapterCopy[4]}</p>
        </div>
      </section>
      <section id="lesson-sources" className="lesson-section source-reading">
        <h2>Reference & implementation details</h2>
        <p>{chapterCopy[5]}</p>
        <a
          href={a ? reading[a.source].url : l.source}
          target="_blank"
          rel="noreferrer"
        >
          <strong>
            {a ? reading[a.source].title : 'Primary reference for this topic'}
            <ExternalLink size={15} />
          </strong>
          {a && <p>{reading[a.source].focus}</p>}
        </a>
      </section>
    </>
  );
}
function KnowledgeCheck({
  q,
  options,
  answer,
  why,
}: {
  q: string;
  options: string[];
  answer: number;
  why: string;
}) {
  const [value, setValue] = useState(''),
    [checked, setChecked] = useState(false);
  return (
    <div className="section-question">
      <h3>{q}</h3>
      <RadioGroup
        value={value}
        onValueChange={(v) => {
          setValue(v);
          setChecked(false);
        }}
        aria-label={q}
      >
        {options.map((o, i) => (
          <label className="answer-option" key={o}>
            <RadioGroupItem value={String(i)} />
            {o}
          </label>
        ))}
      </RadioGroup>
      <button
        className="secondary"
        disabled={!value}
        onClick={() => setChecked(true)}
      >
        Check explanation
      </button>
      {checked && (
        <div className="feedback">
          <strong>
            {Number(value) === answer
              ? 'Correct boundary.'
              : 'Revisit the boundary.'}
          </strong>
          <p>{why}</p>
        </div>
      )}
    </div>
  );
}
function familyFor(
  id: string,
): 'cache' | 'replication' | 'queue' | 'concurrency' | 'latency' | null {
  if (/cache|cdn/.test(id)) return 'cache';
  if (/replic|consensus|quorum|region/.test(id)) return 'replication';
  if (/queue|delivery|outbox|stream|observer/.test(id)) return 'queue';
  if (/concurr|transaction|booking|deadlock|state-machine/.test(id))
    return 'concurrency';
  if (/latency|capacity|balance|hpa|pods|little-law|load-test/.test(id))
    return 'latency';
  return null;
}
