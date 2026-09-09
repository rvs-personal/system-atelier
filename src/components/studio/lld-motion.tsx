'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Play,
  Pause,
  StepForward,
  RotateCcw,
  Car,
  Check,
  ArrowRight,
} from 'lucide-react';
import {
  cacheGet,
  cachePut,
  consumeToken,
  parkingEnter,
  parkingExit,
  transitionOrder,
  type CacheState,
} from '@/lib/studio/lld';
import './lld-motion.css';
import { CacheScene } from './cache-scene';
export type Unit = {
  id: string;
  value: string;
  position: number;
  status: 'stored' | 'empty' | 'removed' | 'active';
};
type Frame = { operation: string; result: string; why: string; units: Unit[] };
function framesFor(id: string): Frame[] {
  if (id === 'lru') {
    let state: CacheState = { capacity: 2, entries: [] };
    const frames: Frame[] = [];
    const snapshot = (
      operation: string,
      result: string,
      why: string,
      removed?: [string, string],
      activeKey?: string,
    ) =>
      frames.push({
        operation,
        result,
        why,
        units: [
          ...state.entries.map(([id, value], position) => ({
            id,
            value,
            position,
            status: (id === activeKey ? 'active' : 'stored') as Unit['status'],
          })),
          ...(removed
            ? [
                {
                  id: removed[0],
                  value: removed[1],
                  position: 2,
                  status: 'removed' as const,
                },
              ]
            : []),
        ],
      });
    snapshot(
      'new LRUCache(2)',
      '0 / 2 entries',
      'Two places are available. The leftmost entry will always be the most recently used.',
    );
    state = cachePut(state, 'A', '1');
    snapshot(
      'put(A, 1)',
      'A inserted',
      'A new key becomes the most recent entry. The cache has one free place.',
      undefined,
      'A',
    );
    state = cachePut(state, 'B', '2');
    snapshot(
      'put(B, 2)',
      'B → A',
      'B is newer than A. The cache is full, but no eviction is needed yet.',
      undefined,
      'B',
    );
    const hit = cacheGet(state, 'A');
    state = hit.state;
    snapshot(
      'get(A)',
      `Returns ${hit.value}`,
      'Reading A moves that same entry to the front. B becomes least recent; size stays two.',
      undefined,
      'A',
    );
    const before = state.entries;
    state = cachePut(state, 'C', '3');
    const evicted = before.find(
      ([key]) => !state.entries.some(([k]) => k === key),
    );
    snapshot(
      'put(C, 3)',
      'B evicted',
      'At capacity, inserting C evicts the least-recently used entry, B.',
      evicted,
      'C',
    );
    const miss = cacheGet(state, 'B');
    state = miss.state;
    snapshot(
      'get(B)',
      miss.value === undefined ? 'MISS' : String(miss.value),
      'B is no longer stored. A miss leaves the recency order unchanged.',
    );
    return frames;
  }
  if (id === 'bucket') {
    let tokens = 5;
    const frames: Frame[] = [];
    const snap = (operation: string, result: string, why: string) =>
      frames.push({
        operation,
        result,
        why,
        units: Array.from({ length: 5 }, (_, i) => ({
          id: String(i + 1),
          value: 'token',
          position: i,
          status: i < tokens ? 'stored' : 'empty',
        })),
      });
    snap(
      'new Bucket(5, 1/s)',
      '5 tokens available',
      'Capacity bounds burst size. This bucket refills at one token per second.',
    );
    for (let i = 0; i < 2; i++) {
      const r = consumeToken(tokens, 5, 1, 0);
      tokens = r.tokens;
      snap(
        'allow(request)',
        r.allowed ? 'ALLOWED' : 'REJECTED',
        'An accepted request consumes one token. No time passes between these calls.',
      );
    }
    let accepted = 0;
    for (let i = 0; i < 10; i++) {
      const r = consumeToken(tokens, 5, 1, 0);
      tokens = r.tokens;
      if (r.allowed) accepted++;
    }
    snap(
      'burst(10)',
      `${accepted} allowed · ${10 - accepted} rejected`,
      'The remaining tokens admit only part of the burst. Rejected requests do not create negative tokens.',
    );
    const r = consumeToken(tokens, 5, 1, 1);
    tokens = r.tokens;
    snap(
      'wait(1s); allow(request)',
      r.allowed ? 'ALLOWED · token consumed' : 'REJECTED',
      'One elapsed second refills one token, which this request immediately consumes.',
    );
    tokens = Math.min(5, tokens + 5);
    snap(
      'wait(5s)',
      '5 tokens available',
      'Refill stops at capacity. Waiting longer cannot accumulate an unlimited burst.',
    );
    return frames;
  }
  if (id === 'parking') {
    let spaces = [false, false, false];
    const frames: Frame[] = [];
    const snap = (operation: string, result: string, why: string) =>
      frames.push({
        operation,
        result,
        why,
        units: spaces.map((used, i) => ({
          id: String(i + 1),
          value: used ? 'Occupied' : 'Available',
          position: i,
          status: used ? 'stored' : 'empty',
        })),
      });
    snap(
      'new Garage(3)',
      '3 spaces available',
      'Each place can have one active parking session. The reference assigns the first free place.',
    );
    for (let i = 0; i < 3; i++) {
      const r = parkingEnter(spaces);
      spaces = r.spaces;
      snap(
        'enter()',
        `Space ${r.index + 1} assigned`,
        'Assignment changes occupancy before the next arrival is evaluated.',
      );
    }
    const full = parkingEnter(spaces);
    spaces = full.spaces;
    snap(
      'enter()',
      full.accepted ? 'ACCEPTED' : 'GARAGE FULL',
      'Every place is occupied. Reject this arrival; do not issue a ticket for an already assigned place.',
    );
    const leave = parkingExit(spaces, 0);
    spaces = leave.spaces;
    snap(
      'exit(space 1)',
      'Space 1 released',
      'The active session ends and the same place becomes available for a later arrival.',
    );
    return frames;
  }
  let state = 'pending';
  const frames: Frame[] = [];
  const snap = (operation: string, result: string, why: string) =>
    frames.push({
      operation,
      result,
      why,
      units: ['pending', 'paid', 'shipped', 'cancelled'].map(
        (id, position) => ({
          id,
          value: id,
          position,
          status: id === state ? 'active' : 'empty',
        }),
      ),
    });
  snap(
    'new Order()',
    'pending',
    'An order starts unpaid. Its state determines which transitions are legal.',
  );
  let r = transitionOrder(state, 'shipped');
  state = r.state;
  snap(
    'ship()',
    r.valid ? 'ACCEPTED' : 'REJECTED',
    'Shipping an unpaid order is invalid. A rejected transition must leave state unchanged.',
  );
  r = transitionOrder(state, 'paid');
  state = r.state;
  snap(
    'pay()',
    r.valid ? 'ACCEPTED' : 'REJECTED',
    'The reference records payment as a state transition. Real payment I/O also needs reconciliation.',
  );
  r = transitionOrder(state, 'shipped');
  state = r.state;
  snap(
    'ship()',
    r.valid ? 'ACCEPTED' : 'REJECTED',
    'A paid order may ship. The allowed transition advances its lifecycle.',
  );
  r = transitionOrder(state, 'cancelled');
  state = r.state;
  snap(
    'cancel()',
    r.valid ? 'ACCEPTED' : 'REJECTED',
    'This contract does not cancel a shipped order. Returns and refunds require a separate workflow.',
  );
  return frames;
}
export default function LLDMotion({ id }: { id: string }) {
  const frames = useMemo(() => framesFor(id), [id]),
    [index, setIndex] = useState(0),
    [playing, setPlaying] = useState(true),
    [visible, setVisible] = useState(false),
    [reduced, setReduced] = useState(false),
    [inspected, setInspected] = useState<string | null>(null),
    root = useRef<HTMLElement>(null);
  useEffect(() => {
    const mq = matchMedia('(prefers-reduced-motion: reduce)');
    const changed = () => setReduced(mq.matches);
    changed();
    mq.addEventListener('change', changed);
    const ob = new IntersectionObserver(
      ([entry]) => setVisible(entry.isIntersecting),
      { threshold: 0.25 },
    );
    if (root.current) ob.observe(root.current);
    return () => {
      mq.removeEventListener('change', changed);
      ob.disconnect();
    };
  }, []);
  useEffect(() => {
    if (!playing || !visible || reduced) return;
    const timer = setInterval(() => {
      if (!document.hidden) setIndex((i) => (i + 1) % frames.length);
    }, 3200);
    return () => clearInterval(timer);
  }, [playing, visible, reduced, frames.length]);
  const frame = frames[index] ?? frames[0];
  const inspectedUnit =
    frame.units.find((u) => u.id === inspected) ??
    frame.units.find((u) => u.status === 'active') ??
    frame.units[0];
  const prior =
      frames[index - 1]?.units.filter((u) => u.status !== 'removed') ?? [],
    current = frame.units.filter((u) => u.status !== 'removed');
  return (
    <section
      ref={root}
      className={'lld-motion motion-' + id}
      aria-label="Animated reference walkthrough"
    >
      <header>
        <div>
          <code>{frame.operation}</code>
          <strong
            className={
              frame.result.includes('evicted') ? 'eviction-result' : ''
            }
          >
            {frame.result}
          </strong>
        </div>
        <span>
          {id === 'lru'
            ? ''
            : id === 'bucket'
              ? 'Capacity 5 · refill 1/s'
              : id === 'parking'
                ? '3 spaces'
                : 'Order lifecycle'}
        </span>
        <div className="walkthrough-controls">
          <button
            onClick={() => setPlaying((p) => !p)}
            aria-label={playing ? 'Pause walkthrough' : 'Play walkthrough'}
            disabled={reduced}
          >
            {playing && !reduced ? <Pause size={15} /> : <Play size={15} />}{' '}
            {playing && !reduced ? 'Pause' : 'Play'}
          </button>
          <button
            onClick={() => {
              setPlaying(false);
              setIndex((i) => (i + 1) % frames.length);
            }}
          >
            <StepForward size={15} />
            Next operation
          </button>
          <button
            aria-label="Restart walkthrough"
            onClick={() => {
              setIndex(0);
              setPlaying(false);
            }}
          >
            <RotateCcw size={15} />
          </button>
          <span className="walkthrough-progress">
            {index + 1} / {frames.length}
            {reduced ? ' · manual playback' : ''}
          </span>
        </div>
      </header>
      {id === 'lru' && (
        <div
          className="cache-transition"
          aria-label="Cache order before and after this operation"
        >
          <div>
            <span>Before</span>
            {prior.length ? (
              prior.map((u) => (
                <code
                  key={u.id}
                  className={
                    frame.units.some(
                      (v) => v.id === u.id && v.status === 'removed',
                    )
                      ? 'leaving'
                      : ''
                  }
                >
                  {u.id}
                </code>
              ))
            ) : (
              <small>{index === 0 ? 'Not created' : 'Empty'}</small>
            )}
          </div>
          <ArrowRight size={16} aria-hidden="true" />
          <div>
            <span>After</span>
            {current.length ? (
              current.map((u) => (
                <code
                  key={u.id}
                  className={u.status === 'active' ? 'affected' : ''}
                >
                  {u.id}
                </code>
              ))
            ) : (
              <small>Empty</small>
            )}
          </div>
        </div>
      )}
      {id === 'lru' ? (
        <div className="cache-inspection">
          <LLDStateScene
            id={id}
            units={frame.units}
            showDepartureArrow={false}
            selectedUnitId={inspectedUnit?.id}
            onUnitClick={(u) => {
              setPlaying(false);
              setInspected(u.id);
            }}
          />
          <aside
            className="entry-inspector"
            aria-label="Selected entry details"
          >
            {inspectedUnit ? (
              <>
                <h3>
                  Selected entry <code>{inspectedUnit.id}</code>
                </h3>
                <dl>
                  {[
                    ['Value', inspectedUnit.value],
                    [
                      'Previous',
                      inspectedUnit.status === 'removed'
                        ? 'Detached'
                        : (current[inspectedUnit.position - 1]?.id ?? 'HEAD'),
                    ],
                    [
                      'Next',
                      inspectedUnit.status === 'removed'
                        ? 'Detached'
                        : (current[inspectedUnit.position + 1]?.id ?? 'TAIL'),
                    ],
                    [
                      'Hash index',
                      inspectedUnit.status === 'removed'
                        ? 'Removed'
                        : 'Present',
                    ],
                  ].map(([label, value]) => (
                    <div key={label}>
                      <dt>{label}</dt>
                      <dd>{value}</dd>
                    </div>
                  ))}
                </dl>
              </>
            ) : (
              <>
                <h3>No entries yet</h3>
                <p>Insert the first key to inspect its value and links.</p>
              </>
            )}
          </aside>
        </div>
      ) : (
        <LLDStateScene id={id} units={frame.units} />
      )}

      <div className="motion-explanation">
        <p>{frame.why}</p>
      </div>
      <nav className="operation-sequence" aria-label="Walkthrough operations">
        {frames.map((f, i) => (
          <button
            key={i}
            aria-current={i === index ? 'step' : undefined}
            aria-label={`${i + 1}. ${f.operation}: ${f.result}`}
            onClick={() => {
              setPlaying(false);
              setIndex(i);
            }}
          >
            <span>{String(i + 1).padStart(2, '0')}</span>
            <code>{i === 0 ? 'Initialize' : f.operation}</code>
          </button>
        ))}
      </nav>
    </section>
  );
}

function CacheRecord({ unit }: { unit: Unit }) {
  const label = useRef<HTMLSpanElement>(null),
    previous = useRef(unit.position);
  useEffect(() => {
    const from = previous.current;
    previous.current = unit.position;
    if (
      unit.status !== 'active' ||
      unit.position >= from ||
      matchMedia('(prefers-reduced-motion: reduce)').matches
    )
      return;
    const animation = label.current?.parentElement?.animate(
      [
        {
          transform: 'translateY(0) scale(1)',
          filter: 'drop-shadow(0 0 0 transparent)',
        },
        {
          transform: 'translateY(-24px) scale(1.05)',
          filter: 'drop-shadow(0 12px 6px #182b4530)',
          offset: 0.45,
        },
        {
          transform: 'translateY(0) scale(1)',
          filter: 'drop-shadow(0 0 0 transparent)',
        },
      ],
      { duration: 600, easing: 'cubic-bezier(.4,0,.2,1)' },
    );
    return () => animation?.cancel();
  }, [unit.position, unit.status]);
  return (
    <span ref={label} className="record-caption">
      <strong>{unit.id}</strong>
      <small>value {unit.value}</small>
    </span>
  );
}

export function LLDStateScene({
  id,
  units,
  capacity = 2,
  showDepartureArrow = true,
  selectedUnitId,
  onUnitClick,
}: {
  id: string;
  selectedUnitId?: string;
  units: Unit[];
  capacity?: number;
  showDepartureArrow?: boolean;
  onUnitClick?: (unit: Unit) => void;
}) {
  if (id === 'lru')
    return (
      <CacheScene
        units={units}
        capacity={capacity}
        selectedUnitId={selectedUnitId}
        onUnitClick={onUnitClick}
      />
    );
  const count =
    id === 'lru'
      ? Math.max(1, capacity) + 1
      : id === 'bucket'
        ? 5
        : id === 'parking'
          ? 3
          : 4;
  const UnitElement = onUnitClick ? 'button' : 'div';
  const evictedUnit = units.find((u) => u.status === 'removed');
  const removed = Boolean(evictedUnit),
    edge = 720 * (1 - 1 / count - 0.05),
    target = 12 + ((count - 1) * 704) / count + 704 / (count * 1.18) / 2 - 54;
  const label = (i: number) =>
    id === 'lru'
      ? i === count - 1
        ? units.some((u) => u.status === 'removed')
          ? 'Evicted entry'
          : 'No eviction'
        : capacity === 0
          ? 'Capacity zero'
          : i >= units.filter((u) => u.status !== 'removed').length
            ? 'Available'
            : units.filter((u) => u.status !== 'removed').length === 1
              ? 'Most & least recent'
              : i === 0
                ? 'Most recent'
                : i === capacity - 1
                  ? 'Least recent'
                  : `Position ${i + 1}`
      : id === 'parking'
        ? `Space ${i + 1}`
        : id === 'bucket'
          ? `Token ${i + 1}`
          : ['Pending', 'Paid', 'Shipped', 'Cancelled'][i];
  return (
    <div
      className="motion-stage"
      style={{ '--slot-count': count } as React.CSSProperties}
    >
      {id === 'lru' && (
        <span className="cache-caption">Cache · capacity {capacity}</span>
      )}
      {id === 'lru' && removed && showDepartureArrow && (
        <svg
          className="eviction-flow"
          viewBox="0 0 720 170"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <path
            d={`M ${edge} 80 L ${target - 26} 80 M ${target - 32} 76 L ${target - 26} 80 L ${target - 32} 84`}
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
      )}
      <div
        className="motion-platform"
        style={id === 'lru' ? { right: `${100 / count + 5}%` } : undefined}
      />
      {id === 'lru' && (
        <div
          className="eviction-area"
          data-occupied={units.some((u) => u.status === 'removed')}
          style={{ left: `${100 - 100 / count}%` }}
        />
      )}

      {id === 'lru' && units.some((u) => u.status !== 'removed') && (
        <div className="cache-sentinels" aria-label="List boundaries">
          {[
            units.find((u) => u.status !== 'removed'),
            units.filter((u) => u.status !== 'removed').at(-1),
          ]
            .filter(
              (_, i) =>
                i === 0 ||
                units.filter((u) => u.status !== 'removed').length > 1,
            )
            .map((u, i) => (
              <span
                key={i}
                style={{
                  left: `${(((u?.position ?? 0) + 0.42) * 100) / count}%`,
                }}
              >
                {units.filter((u) => u.status !== 'removed').length === 1
                  ? i === 0
                    ? 'HEAD.next · TAIL.prev'
                    : ''
                  : i === 0
                    ? 'HEAD.next'
                    : 'TAIL.prev'}
                <i aria-hidden="true">↓</i>
              </span>
            ))}
        </div>
      )}
      {id === 'lru' && (
        <div
          key={units
            .filter((u) => u.status !== 'removed')
            .map((u) => u.id)
            .join(':')}
          className="cache-link-layer"
          aria-label="Doubly linked recency list"
        >
          {units
            .filter((u) => u.status !== 'removed')
            .slice(0, -1)
            .map((u) => (
              <span
                className="cache-node-link"
                key={u.id}
                style={{
                  left: `${((u.position + 0.78) * 100) / count}%`,
                  width: `${(0.32 * 100) / count}%`,
                }}
              >
                <span className="pointer-next">
                  <small>next</small>
                  <i aria-hidden="true" />
                </span>
                <span className="pointer-prev">
                  <i aria-hidden="true" />
                  <small>prev</small>
                </span>
              </span>
            ))}
        </div>
      )}
      <div className="motion-actors">
        {units.map((unit) => (
          <UnitElement
            key={unit.id}
            onClick={onUnitClick ? () => onUnitClick(unit) : undefined}
            aria-label={
              onUnitClick
                ? id === 'lru'
                  ? `Inspect cache entry ${unit.id}`
                  : `Space ${unit.id}: ${unit.value}. Exit vehicle`
                : undefined
            }
            aria-pressed={
              id === 'lru' && onUnitClick
                ? unit.id === selectedUnitId
                : undefined
            }
            className={'motion-unit ' + unit.status}
            style={{
              transform: `translate3d(${unit.position * 118}%,0px,0)`,
              width: `${100 / (count * 1.18)}%`,
            }}
          >
            <div className="unit-face">
              {id === 'lru' && onUnitClick && unit.id === selectedUnitId && (
                <span className="cache-selected-mark" aria-hidden="true">
                  ✓
                </span>
              )}
              {id === 'lru' ? (
                <CacheRecord unit={unit} />
              ) : (
                <>
                  {id === 'parking' ? (
                    <Car size={36} />
                  ) : id === 'order' ? (
                    unit.status === 'active' ? (
                      <Check size={28} />
                    ) : (
                      <span className="state-placeholder" />
                    )
                  ) : (
                    <strong>{unit.id}</strong>
                  )}
                  <small>
                    {id === 'bucket'
                      ? unit.status === 'empty'
                        ? 'Spent'
                        : 'Available'
                      : unit.value}
                  </small>
                </>
              )}
            </div>
          </UnitElement>
        ))}
      </div>
      <div className="motion-label-row">
        {Array.from({ length: count }, (_, i) => (
          <span
            key={i}
            className={
              id === 'lru' && i === count - 1
                ? 'removed-label' + (removed ? ' has-eviction' : '')
                : ''
            }
            style={{
              left: `${(i * 100) / count}%`,
              width: `${100 / (count * 1.18)}%`,
            }}
          >
            {id === 'lru' && i === count - 1
              ? removed
                ? '↗ Evicted'
                : ''
              : label(i)}
          </span>
        ))}
      </div>
    </div>
  );
}
