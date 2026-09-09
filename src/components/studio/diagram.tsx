'use client';
import { useEffect, useRef, useState } from 'react';
import { ZoomIn, ZoomOut, Download, Maximize2 } from 'lucide-react';
import { graphDot, type Design } from '@/lib/studio/model';
import type { CanvasAction } from '@/lib/studio/canvas-actions';
import { download } from '@/lib/studio/storage';
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
  const dot = graphDot(design, hot, !!onAction);
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
        svg.setAttribute('role', 'img');
        svg.setAttribute(
          'aria-label',
          'Architecture diagram. ' + design.nodes.map((n) => n.name).join(', '),
        );
        for (const node of design.nodes) {
          const g = svg.querySelector('[id="node-' + node.id + '"]');
          if (g && onSelect) {
            g.setAttribute('tabindex', '0');
            g.setAttribute('role', 'button');
            g.setAttribute('aria-label', 'Inspect ' + node.name);
            g.addEventListener('click', () => onSelect(node.id));
            g.addEventListener('keydown', (e) => {
              if (
                (e as KeyboardEvent).key === 'Enter' ||
                (e as KeyboardEvent).key === ' '
              ) {
                e.preventDefault();
                onSelect(node.id);
              }
            });
          }
        }
        ref.current.replaceChildren(svg);
        if (onAction)
          for (const n of design.nodes) {
            const g = svg.querySelector(
              '[id="node-' + n.id + '"]',
            ) as SVGGElement | null;
            if (!g) continue;
            const box = g.getBBox();
            const fo = document.createElementNS(
              'http://www.w3.org/2000/svg',
              'foreignObject',
            );
            fo.setAttribute('x', String(box.x + 8));
            fo.setAttribute('y', String(box.y + box.height - 42));
            fo.setAttribute('width', String(box.width - 16));
            fo.setAttribute('height', '36');
            const row = document.createElement('div');
            row.className = 'node-actions';
            for (const [action, title] of [
              ['minus', '−'],
              ['plus', '+'],
              ['remove', '×'],
            ] as const) {
              if (
                action !== 'remove' &&
                !['service', 'database', 'cache', 'worker'].includes(n.kind)
              )
                continue;
              const b = document.createElement('button');
              b.textContent = title;
              b.setAttribute(
                'aria-label',
                (action === 'plus'
                  ? 'Add a copy of '
                  : action === 'minus'
                    ? 'Remove one copy of '
                    : 'Delete ') + n.name,
              );
              b.title = b.getAttribute('aria-label')!;
              b.disabled = action === 'minus' && n.replicas <= 1;
              b.onclick = (e) => {
                e.stopPropagation();
                onAction(n.id, action);
              };
              b.onkeydown = (e) => e.stopPropagation();
              row.appendChild(b);
            }
            fo.appendChild(row);
            g.appendChild(fo);
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
  }, [dot, onSelect, onAction]);
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
