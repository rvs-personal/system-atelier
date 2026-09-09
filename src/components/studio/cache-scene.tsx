'use client';
import { useEffect, useRef, type CSSProperties } from 'react';
import type { Unit } from './lld-motion';
import './cache-scene.css';

export function CacheScene({
  units,
  capacity,
  selectedUnitId,
  onUnitClick,
}: {
  units: Unit[];
  capacity: number;
  selectedUnitId?: string;
  onUnitClick?: (unit: Unit) => void;
}) {
  const residents = units.filter((u) => u.status !== 'removed');
  const evicted = units.find((u) => u.status === 'removed');
  const slots = Math.max(1, capacity) + 1;
  return (
    <div className="cache-world" aria-label="Cache entries and recency links">
      <div className="cache-world-scroll">
        <div
          className="cache-map"
          style={
            {
              '--cache-slots': slots,
              minWidth: slots > 4 ? slots * 180 : undefined,
            } as CSSProperties
          }
        >
          <div
            className="cache-resident-boundary"
            style={{ right: `${100 / slots}%` }}
          >
            <span>
              Recency list{' '}
              <b>
                {residents.length} / {capacity}
              </b>
            </span>
          </div>
          {Array.from({ length: Math.max(1, capacity) }, (_, position) => {
            const unit = residents.find((u) => u.position === position);
            const pointer = unit
              ? residents.length === 1
                ? 'HEAD.next / TAIL.prev'
                : position === 0
                  ? 'HEAD.next'
                  : position === residents.length - 1
                    ? 'TAIL.prev'
                    : ''
              : '';
            return (
              <div
                key={position}
                className="cache-position"
                style={{
                  left: `${(position * 100) / slots}%`,
                  width: `${100 / slots}%`,
                }}
              >
                {pointer && (
                  <div key={unit?.id} className="cache-boundary-pointer">
                    <code>{pointer}</code>
                    <span aria-hidden="true">↓</span>
                  </div>
                )}
                {!unit && (
                  <div className="cache-empty-slot">
                    {capacity === 0 ? 'No storage' : 'Empty slot'}
                  </div>
                )}
                <span className="cache-order-label">
                  {unit
                    ? residents.length === 1
                      ? 'Most & least recent'
                      : position === 0
                        ? 'Most recent'
                        : position === residents.length - 1
                          ? 'Least recent'
                          : `Position ${position + 1}`
                    : ''}
                </span>
              </div>
            );
          })}
          {residents.slice(0, -1).map((u) => (
            <div
              key={`${u.id}-${residents[u.position + 1]?.id}`}
              className="cache-wire-pair"
              style={{
                left: `calc(${((u.position + 1) * 100) / slots}% - 36px)`,
              }}
              aria-label={`${u.id}.next points to ${residents[u.position + 1]?.id}; ${residents[u.position + 1]?.id}.prev points to ${u.id}`}
            >
              <span className="cache-wire next">
                <small>next</small>
                <i />
              </span>
              <span className="cache-wire prev">
                <i />
                <small>prev</small>
              </span>
            </div>
          ))}
          {[...units]
            .sort((a, b) => a.id.localeCompare(b.id))
            .map((unit) => (
              <CacheEntry
                key={unit.id}
                unit={unit}
                slots={slots}
                selected={selectedUnitId === unit.id}
                onUnitClick={onUnitClick}
              />
            ))}
          {evicted && (
            <span
              className="cache-retired-label"
              style={{
                left: `${((slots - 1) * 100) / slots}%`,
                width: `${100 / slots}%`,
              }}
            >
              Evicted · unlinked
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function CacheEntry({
  unit,
  slots,
  selected,
  onUnitClick,
}: {
  unit: Unit;
  slots: number;
  selected: boolean;
  onUnitClick?: (unit: Unit) => void;
}) {
  const previous = useRef(unit.position),
    face = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const from = previous.current;
    previous.current = unit.position;
    if (
      unit.position >= from ||
      matchMedia('(prefers-reduced-motion: reduce)').matches
    )
      return;
    const animation = face.current?.animate(
      [
        { transform: 'translateY(0) rotateX(9deg) rotateY(-5deg)' },
        {
          transform: 'translateY(-28px) rotateX(9deg) rotateY(-5deg)',
          offset: 0.45,
        },
        {
          transform: `translateY(${selected ? -3 : 0}px) rotateX(9deg) rotateY(-5deg)`,
        },
      ],
      { duration: 600, easing: 'cubic-bezier(.77,0,.175,1)' },
    );
    return () => animation?.cancel();
  }, [unit.position, selected]);
  const Entry = onUnitClick ? 'button' : 'div';
  return (
    <Entry
      className={
        'cache-entry ' + (unit.status === 'removed' ? 'retired' : 'resident')
      }
      aria-label={onUnitClick ? `Inspect cache entry ${unit.id}` : undefined}
      aria-pressed={onUnitClick ? selected : undefined}
      onClick={onUnitClick ? () => onUnitClick(unit) : undefined}
      style={{
        left: `calc(${(unit.position * 100) / slots}% + 36px)`,
        width: `calc(${100 / slots}% - 72px)`,
        zIndex: unit.status === 'active' ? 4 : 2,
      }}
    >
      <span ref={face} className="cache-entry-face">
        <span className="cache-entry-key">
          <small>Key</small>
          <strong>{unit.id}</strong>
        </span>
        <span className="cache-entry-value">
          <small>Value</small>
          <code>{unit.value}</code>
        </span>
      </span>
    </Entry>
  );
}
