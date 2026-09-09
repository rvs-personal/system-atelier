'use client';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';
import { graphDot, type Design } from '@/lib/studio/model';
import type { CanvasAction } from '@/lib/studio/canvas-actions';
let engine:
  | Promise<Awaited<ReturnType<(typeof import('@viz-js/viz'))['instance']>>>
  | undefined;
export default function Diagram({
  design,
  hot = [],
  onSelect,
  compact = false,
  legend,
  onAction,
}: {
  design: Design;
  hot?: string[];
  onSelect?: (id: string) => void;
  compact?: boolean;
  legend?: string;
  onAction?: (id: string, action: CanvasAction) => void;
}) {
  const ref = useRef<HTMLDivElement>(null),
    [error, setError] = useState(''),
    [loading, setLoading] = useState(true),
    [zoom, setZoom] = useState(1);
  const callbacks = useRef({ onSelect, onAction });
  useLayoutEffect(() => {
    callbacks.current = { onSelect, onAction };
  });
  const interactive = !!onAction,
    selectable = !!onSelect;
  const dot = graphDot(design, hot, interactive);
  useEffect(() => {
    let active = true;
    setLoading(true);
    engine ??= import('@viz-js/viz').then((v) => v.instance());
    engine
      .then((v) => {
        if (!active || !ref.current) return;
        const svg = v.renderSVGElement(dot);
        svg.removeAttribute('width');
        svg.removeAttribute('height');
        svg.setAttribute('role', interactive || selectable ? 'group' : 'img');
        svg.setAttribute(
          'aria-label',
          'Architecture diagram. ' + design.nodes.map((n) => n.name).join(', '),
        );
        for (const node of design.nodes) {
          const g = svg.querySelector('[id="node-' + node.id + '"]');
          if (g && selectable) {
            g.setAttribute('tabindex', '0');
            g.setAttribute('role', 'button');
            g.setAttribute('aria-label', 'Inspect ' + node.name);
            g.addEventListener('click', () =>
              callbacks.current.onSelect?.(node.id),
            );
            g.addEventListener('keydown', (e) => {
              if (
                (e as KeyboardEvent).key === 'Enter' ||
                (e as KeyboardEvent).key === ' '
              ) {
                e.preventDefault();
                callbacks.current.onSelect?.(node.id);
              }
            });
          }
        }
        const focusedAction = ref.current.contains(document.activeElement)
          ? document.activeElement?.getAttribute('data-node-action')
          : null;
        ref.current.replaceChildren(svg);
        if (interactive)
          for (const n of design.nodes) {
            const g = svg.querySelector(
              '[id="node-' + n.id + '"]',
            ) as SVGGElement | null;
            if (!g) continue;
            const box = g.getBBox();
            const scalable = [
              'service',
              'database',
              'cache',
              'worker',
            ].includes(n.kind);
            const actions: CanvasAction[] = scalable
              ? ['minus', 'plus', 'remove']
              : ['remove'];
            const width = actions.length * 36 + (actions.length - 1) * 8;
            // Keep controls in the SVG coordinate system so visual and pointer
            // positions agree at every zoom level. Siblings avoid nested buttons.
            const row = document.createElementNS(
              'http://www.w3.org/2000/svg',
              'g',
            );
            row.setAttribute(
              'transform',
              `translate(${box.x + (box.width - width) / 2},${box.y + box.height - 42})`,
            );
            actions.forEach((action, index) => {
              const b = document.createElementNS(
                'http://www.w3.org/2000/svg',
                'g',
              );
              const disabled =
                action === 'minus'
                  ? n.replicas <= 1
                  : action === 'plus' && n.replicas >= 100;
              const label =
                (action === 'plus'
                  ? 'Add a copy of '
                  : action === 'minus'
                    ? 'Remove one copy of '
                    : 'Delete ') + n.name;
              b.setAttribute(
                'class',
                'node-action' +
                  (action === 'remove' ? ' node-action-remove' : ''),
              );
              b.setAttribute('transform', `translate(${index * 44},0)`);
              b.setAttribute('role', 'button');
              b.setAttribute('tabindex', disabled ? '-1' : '0');
              b.setAttribute('aria-label', label);
              b.setAttribute('aria-disabled', String(disabled));
              b.setAttribute('data-node-action', n.id + ':' + action);
              const title = document.createElementNS(
                'http://www.w3.org/2000/svg',
                'title',
              );
              title.textContent = label;
              const rect = document.createElementNS(
                'http://www.w3.org/2000/svg',
                'rect',
              );
              for (const [key, value] of Object.entries({
                width: '36',
                height: '36',
                rx: '7',
              }))
                rect.setAttribute(key, value);
              const text = document.createElementNS(
                'http://www.w3.org/2000/svg',
                'text',
              );
              text.setAttribute('x', '18');
              text.setAttribute('y', '18');
              text.setAttribute('text-anchor', 'middle');
              text.setAttribute('dominant-baseline', 'central');
              text.textContent =
                action === 'plus' ? '+' : action === 'minus' ? '−' : '×';
              b.append(title, rect, text);
              b.addEventListener('click', (e) => {
                e.stopPropagation();
                if (!disabled) callbacks.current.onAction?.(n.id, action);
              });
              b.addEventListener('keydown', (event) => {
                const e = event as KeyboardEvent;
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  e.stopPropagation();
                  if (!disabled && !e.repeat)
                    callbacks.current.onAction?.(n.id, action);
                }
              });
              row.appendChild(b);
            });
            g.parentElement?.appendChild(row);
          }
        if (focusedAction) {
          const target = Array.from(
            svg.querySelectorAll<SVGGElement>('[data-node-action]'),
          ).find(
            (node) => node.getAttribute('data-node-action') === focusedAction,
          );
          if (target?.getAttribute('aria-disabled') === 'false')
            target.focus({ preventScroll: true });
        }
        setError('');
        setLoading(false);
      })
      .catch(() => {
        if (active) {
          setError(
            'The diagram could not render. Reduce the model or reload the page. Your model is still available below.',
          );
          setLoading(false);
          engine = undefined;
        }
      });
    return () => {
      active = false;
    };
  }, [dot, selectable, interactive]);
  return (
    <div className={'diagram ' + (compact ? 'compact' : '')}>
      <div className="diagram-corner">
        <span className="mono">
          {design.nodes.length} COMPONENTS · {design.edges.length} CONNECTIONS
        </span>
      </div>
      <div className="diagram-scroll">
        <div
          ref={ref}
          className="diagram-svg"
          style={{
            width: `${zoom * 100}%`,
            minWidth: compact ? undefined : 480,
          }}
        />
      </div>
      {loading && <div className="diagram-status">Laying out your design…</div>}
      {error && <p role="alert">{error}</p>}
      <div className="diagram-controls">
        <span>{legend ?? 'Solid: sync · Dashed: async'}</span>
        <button
          aria-label="Zoom out"
          onClick={() => setZoom((z) => Math.max(0.6, z - 0.2))}
        >
          <ZoomOut size={16} />
        </button>
        <button aria-label="Fit diagram" onClick={() => setZoom(1)}>
          <Maximize2 size={16} />
        </button>
        <button
          aria-label="Zoom in"
          onClick={() => setZoom((z) => Math.min(2.4, z + 0.2))}
        >
          <ZoomIn size={16} />
        </button>
      </div>
    </div>
  );
}
