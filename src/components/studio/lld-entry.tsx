'use client';
import { useEffect, useState } from 'react';
import {
  ArrowRight,
  Clock3,
  Check,
  PackageCheck,
  ChevronDown,
} from 'lucide-react';
import './lld-entry.css';
const exercises = [
  {
    id: 'lru',
    name: 'LRU cache',
    level: 'Foundational',
    brief:
      'Design fast lookups, track recent reads, and decide which entry to evict.',
    learn: 'Hash maps · Linked lists · Eviction',
    number: '01',
  },
  {
    id: 'parking',
    name: 'Parking system',
    level: 'Intermediate',
    brief: 'Assign a space without assigning it twice.',
    learn: 'Ownership · Interfaces · Reservations',
    number: '02',
  },
  {
    id: 'bucket',
    name: 'Token bucket',
    level: 'Intermediate',
    brief: 'Limit bursts; refill tokens to set the rate.',
    learn: 'Clocks · Atomicity · Rate limits',
    number: '03',
  },
  {
    id: 'order',
    name: 'Order state machine',
    level: 'Intermediate',
    brief: 'Pending → paid → shipped. Reject invalid transitions.',
    learn: 'Transitions · Idempotency',
    number: '04',
  },
];
export function LLDEntry({
  ready,
  onOpen,
}: {
  ready: boolean;
  onOpen: (id: string) => void;
  initialExercise?: string;
}) {
  const renderExercise = (exercise: (typeof exercises)[number]) => (
    <button
      className="lld-catalog-row"
      data-featured={exercise.id === 'lru'}
      key={exercise.id}
      disabled={!ready}
      onClick={() => onOpen(exercise.id)}
      aria-label={`Open ${exercise.name} workbench`}
      aria-describedby={`lld-description-${exercise.id} lld-concepts-${exercise.id}`}
    >
      <span className="lld-catalog-identity">
        <span className="lld-catalog-art" aria-hidden="true">
          <CatalogObject kind={exercise.id} />
        </span>
      </span>
      <span className="lld-catalog-content">
        <strong>
          {exercise.name}
          {exercise.id === 'lru' && (
            <span className="lld-start-here">Start here</span>
          )}
        </strong>
        <span
          className="lld-catalog-brief"
          id={`lld-description-${exercise.id}`}
        >
          {exercise.brief}
        </span>
        <span
          className="lld-catalog-concepts"
          id={`lld-concepts-${exercise.id}`}
        >
          {exercise.level} · {exercise.learn}
        </span>
      </span>
      <span className="lld-catalog-enter">
        {exercise.id === 'lru' && <span>Open workbench</span>}
        <ArrowRight size={24} />
      </span>
    </button>
  );
  return (
    <section className="lld-entry-page">
      <header className="lld-catalog-heading">
        <div>
          <span className="lld-catalog-kicker">
            PRACTICE / LOW-LEVEL DESIGN
          </span>
          <h1>Choose your next design.</h1>
          <p>
            Four small systems. Work through the objects, contracts, and edge
            cases.
          </p>
        </div>
      </header>

      <div className="lld-catalog-list">
        {renderExercise(exercises[0])}
        <div className="lld-catalog-alternatives">
          {exercises.slice(1).map(renderExercise)}
        </div>
      </div>
    </section>
  );
}
function CatalogObject({ kind }: { kind: string }) {
  return kind === 'lru' ? (
    <CachePreview />
  ) : kind === 'order' ? (
    <OrderPreview />
  ) : (
    <span className={`catalog-render catalog-render-${kind}`} />
  );
}

function OrderPreview() {
  return (
    <span className="order-entry-preview">
      <span className="order-entry-state">
        <i>
          <Clock3 size={15} />
        </i>
        <span>Pending</span>
      </span>
      <ChevronDown className="order-entry-arrow" size={12} />
      <span className="order-entry-state" data-active="true">
        <i>
          <Check size={15} />
        </i>
        <span>Paid</span>
      </span>
      <ChevronDown className="order-entry-arrow" size={12} />
      <span className="order-entry-state">
        <i>
          <PackageCheck size={15} />
        </i>
        <span>Shipped</span>
      </span>
    </span>
  );
}

const cacheFrames = [
  {
    operation: 'Capacity · 3 entries',
    before: [] as string[],
    order: ['C', 'B', 'A'],
    result: 'C was used most recently',
  },
  {
    operation: 'Read A',
    before: ['C', 'B', 'A'],
    order: ['A', 'C', 'B'],
    result: 'A moves to the front',
  },
  {
    operation: 'Insert D',
    before: ['A', 'C', 'B'],
    order: ['D', 'A', 'C'],
    result: 'D enters · B is evicted',
  },
];
function CachePreview() {
  const [frame, setFrame] = useState(1);
  useEffect(() => {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const timer = window.setInterval(() => {
      if (!preference.matches && !document.hidden)
        setFrame((value) => (value + 1) % cacheFrames.length);
    }, 4500);
    return () => window.clearInterval(timer);
  }, []);
  const current = cacheFrames[frame];
  return (
    <span className="cache-entry-scene" data-frame={frame}>
      <span className="cache-entry-operation">{current.operation}</span>
      {frame !== 0 && (
        <span className="cache-before-row">
          <span>Before</span>
          <span className="cache-before-keys">
            {current.before.map((key) => (
              <span
                key={key}
                data-active={key === current.order[0]}
                data-evicted={!current.order.includes(key)}
              >
                {key}
              </span>
            ))}
          </span>
        </span>
      )}
      <span className="cache-after-row">
        {frame !== 0 && <span className="cache-after-label">After</span>}
        <span className="cache-entry-track">
          {['A', 'B', 'C', 'D'].map((key) => {
            const position = current.order.indexOf(key);
            return (
              <span
                key={key}
                className="cache-entry-block"
                data-position={position}
                data-active={position === 0}
                style={{
                  transform: `translate3d(${position < 0 ? 240 : position * 80}px, ${position < 0 ? 15 : 0}px, 0) rotateY(-18deg)`,
                  opacity: position < 0 ? 0 : 1,
                }}
              >
                <span>{key}</span>
                <i />
              </span>
            );
          })}
        </span>
      </span>
      {frame !== 0 && (
        <span className="cache-entry-result">{current.result}</span>
      )}
      <span className="cache-entry-direction">
        <span>Most recent</span>
        <span>→</span>
        <span>Least recent</span>
      </span>
    </span>
  );
}
