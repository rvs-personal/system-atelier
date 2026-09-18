'use client';
import { chapterReading } from '@/lib/studio/reading-time';
import { useState, useEffect } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ExternalLink,
  Check,
} from 'lucide-react';
import { stages, lessons } from '@/lib/studio/curriculum';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useCloud } from '@/lib/studio/storage';
import { PageTitle, CloudStatus } from './shared';
import LessonDetail from './lesson-detail';
import LearningDirectory, { LearningOrientation } from './learning-directory';
import { moduleForLesson, orderedLessons } from '@/lib/studio/learning-map';
export default function Learn({ onLab }: { onLab: () => void }) {
  const cloud = useCloud('progress', {
    completed: [] as string[],
    notes: {} as Record<string, string>,
    answers: {} as Record<string, number>,
  });
  const [route, setRoute] = useState('learn'),
    [active, setActive] = useState<string | null>(null),
    [revealed, setRevealed] = useState(false),
    [checked, setChecked] = useState(false),
    [readingSection, setReadingSection] = useState('lesson-overview');
  const l = lessons.find((x) => x.id === active);
  function open(id: string) {
    setActive(id);
    setRevealed(false);
    setChecked(false);
    window.location.hash = 'learn/' + id;
    window.scrollTo({ top: 0, behavior: 'instant' });
  }
  useEffect(() => {
    const sync = () => {
      if (!location.hash.startsWith('#learn')) return;
      setRoute(location.hash.slice(1));
      const id = location.hash.split('/')[1];
      setActive(lessons.some((l) => l.id === id) ? id : null);
    };
    sync();
    window.addEventListener('hashchange', sync);
    return () => window.removeEventListener('hashchange', sync);
  }, []);
  const complete = () => {
    if (!l) return;
    cloud.setData((d) => ({
      ...d,
      completed: [...new Set([...d.completed, l.id])],
    }));
  };
  useEffect(() => {
    if (!active) return;
    let frame = 0;
    const update = () => {
      frame = 0;
      const sections = Array.from(
        document.querySelectorAll<HTMLElement>('.lesson-article section[id]'),
      );
      let current = sections[0]?.id ?? 'lesson-overview';
      for (const section of sections) {
        if (section.getBoundingClientRect().top <= 140) current = section.id;
      }
      setReadingSection(current);
    };
    const scroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener('scroll', scroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', scroll);
      cancelAnimationFrame(frame);
    };
  }, [active]);
  if (!l)
    return route === 'learn/orientation' ? (
      <LearningOrientation />
    ) : (
      <LearningDirectory
        completed={cloud.data.completed}
        partId={route.startsWith('learn/part/') ? route.split('/')[2] : 'all'}
        moduleId={
          route.startsWith('learn/module/') ? route.split('/')[2] : undefined
        }
      />
    );
  const currentModule = moduleForLesson(l.id);
  return (
    <>
      <PageTitle
        kicker="THE LEARNING PATH"
        title={l ? l.title : 'System design field guide.'}
        description={
          l
            ? stages[l.stage].role +
              ' · ' +
              chapterReading(l).minutes +
              ' min reading · checkpoints + practice'
            : `${lessons.length} chapters with ordered explanations and worked failures: fundamentals, HLD, LLD, distributed systems, production operations and technical leadership.`
        }
      />
      <CloudStatus {...cloud} />
      <div className="lesson-layout">
        <article className="lesson-article">
          {currentModule && (
            <div className="lesson-module-context">
              <a href={'#learn/module/' + currentModule.id}>
                {currentModule.partTitle} / {currentModule.title}
              </a>
              <span>
                Lesson {currentModule.lessons.indexOf(l.id) + 1} of{' '}
                {currentModule.lessons.length}
              </span>
            </div>
          )}
          <section id="lesson-overview" className="lesson-section">
            <h2>Start with the problem</h2>
            <p>{l.idea}</p>
          </section>
          <LessonDetail key={l.id} lesson={l} />
          <section id="lesson-practice" className="lesson-section">
            <h2>Apply it to a concrete problem</h2>
            <p>{l.exercise}</p>
            <fieldset disabled={!cloud.ready}>
              <label className="field">
                <span>Your reasoning</span>
                <textarea
                  rows={5}
                  value={cloud.data.notes[l.id] ?? ''}
                  onChange={(e) =>
                    cloud.setData((d) => ({
                      ...d,
                      notes: { ...d.notes, [l.id]: e.target.value },
                    }))
                  }
                  placeholder="State your assumptions, then explain your decision…"
                />
              </label>
            </fieldset>
            <button
              className="secondary"
              onClick={() => setRevealed(!revealed)}
            >
              {revealed
                ? 'Hide worked approach'
                : 'Compare with a worked approach'}
            </button>
            {revealed && (
              <div className="feedback">
                <strong>One defensible approach</strong>
                <p>{l.solution}</p>
              </div>
            )}
            <div className="quiz">
              <span className="eyebrow">
                FINAL CHECK · APPLY THE WHOLE CHAPTER
              </span>
              <h3>{l.question}</h3>
              <fieldset disabled={!cloud.ready}>
                <RadioGroup
                  value={String(cloud.data.answers[l.id] ?? '')}
                  onValueChange={(v) => {
                    setChecked(false);
                    cloud.setData((d) => ({
                      ...d,
                      answers: { ...d.answers, [l.id]: Number(v) },
                    }));
                  }}
                  aria-label={l.question}
                >
                  {l.options.map((o, i) => (
                    <label className="answer-option" key={o}>
                      <RadioGroupItem value={String(i)} />
                      <span>{o}</span>
                    </label>
                  ))}
                </RadioGroup>
              </fieldset>
              <button
                className="secondary"
                disabled={cloud.data.answers[l.id] === undefined}
                onClick={() => setChecked(true)}
              >
                Check reasoning
              </button>
              {checked && (
                <div
                  className={
                    'feedback ' +
                    (cloud.data.answers[l.id] === l.answer ? '' : 'amber')
                  }
                >
                  <strong>
                    {cloud.data.answers[l.id] === l.answer
                      ? 'That’s right.'
                      : 'Revisit this assumption.'}
                  </strong>
                  <p>{l.reason}</p>
                </div>
              )}
            </div>
            <div className="lesson-actions">
              <button
                className="primary"
                disabled={
                  !cloud.ready ||
                  !checked ||
                  cloud.data.answers[l.id] !== l.answer ||
                  !(cloud.data.notes[l.id] ?? '').trim()
                }
                onClick={complete}
              >
                <Check size={17} />
                {cloud.data.completed.includes(l.id)
                  ? 'Practice completed'
                  : 'Mark practice complete'}
              </button>
              {orderedLessons.indexOf(l) < orderedLessons.length - 1 && (
                <button
                  className="secondary"
                  onClick={() =>
                    open(orderedLessons[orderedLessons.indexOf(l) + 1].id)
                  }
                >
                  Next lesson
                  <ArrowRight size={16} />
                </button>
              )}
            </div>
            <p className="small muted">
              Write your reasoning and pass the check to record completion.
            </p>
          </section>
        </article>
        <aside className="lesson-aside">
          <span className="eyebrow">IN THIS CHAPTER</span>
          <nav aria-label="Lesson sections">
            {[
              ['lesson-overview', 'Problem & objective'],
              ['lesson-foundations', 'Foundations & checkpoint'],
              ['lesson-mechanism', 'Worked mechanism & contract'],
              ['lesson-contract', 'Failure, repair & checkpoint'],
              ['lesson-judgment', 'Tradeoffs'],
              ['lesson-sources', 'Primary sources'],
              ['lesson-practice', 'Exercise & knowledge check'],
            ].map(([id, title], i) => (
              <button
                key={id}
                aria-current={readingSection === id ? 'location' : undefined}
                onClick={() =>
                  document.getElementById(id)?.scrollIntoView({
                    behavior: window.matchMedia(
                      '(prefers-reduced-motion: reduce)',
                    ).matches
                      ? 'instant'
                      : 'smooth',
                    block: 'start',
                  })
                }
              >
                <span>0{i + 1}</span>
                {title}
              </button>
            ))}
          </nav>
          <hr />
          <button className="secondary" onClick={onLab}>
            Try a related experiment
            <ArrowRight size={16} />
          </button>
        </aside>
      </div>
    </>
  );
}
function ArrowUpRightIcon() {
  return <ArrowRight size={16} />;
}
