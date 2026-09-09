import { chapterCopy } from './chapter-copy';
import type { Lesson } from './curriculum';
import { foundationFor } from './chapter-foundations';
import { atlas } from './lesson-atlas';
import { chapterRows } from './curriculum-expanded';
export function chapterReading(l: Lesson) {
  const f = foundationFor(l),
    a = atlas[l.id],
    row = chapterRows.find((r) => r[1] === l.id);
  const text = [
    l.idea,
    l.example,
    l.tradeoff,
    ...f.sections.flatMap((s) => [s.title, ...s.paragraphs, s.example]),
    ...(a?.trace ?? []),
    a?.contract ?? row?.[8] ?? '',
    a?.decision ?? '',
    a?.failure ?? row?.[5] ?? '',
    row?.[6] ?? l.solution,
    l.exercise,
    l.question,
    ...l.options,
    l.reason,
    ...chapterCopy,
    ...f.checks.flatMap((q) => [q.q, ...q.options, q.why]),
  ].join(' ');
  const words = text.trim().split(/\s+/).length;
  return { words, minutes: Math.max(1, Math.ceil(words / 200)) };
}
