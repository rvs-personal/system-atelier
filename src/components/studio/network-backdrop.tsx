'use client';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import {
  Monitor,
  Globe2,
  Braces,
  Database,
  ListOrdered,
  Send,
  Zap,
  Search,
  Smartphone,
  Cloud,
} from 'lucide-react';
import network from '@/lib/studio/network-backdrop.json';
import './network-backdrop.css';
const roles = [
  { id: 'client', label: 'Client', Icon: Monitor },
  { id: 'edge', label: 'Edge network', Icon: Globe2 },
  { id: 'api', label: 'API service', Icon: Braces },
  { id: 'database', label: 'Database', Icon: Database },
  { id: 'queue', label: 'Message queue', Icon: ListOrdered },
  { id: 'worker', label: 'Worker', Icon: Send },
  { id: 'cache', label: 'Cache', Icon: Zap },
  { id: 'search', label: 'Search', Icon: Search },
  { id: 'remote', label: 'Mobile client', Icon: Smartphone },
  { id: 'cdn', label: 'Content delivery', Icon: Cloud },
] as const;

export default function NetworkBackdrop() {
  const host = useRef<HTMLDivElement>(null);
  const [running, setRunning] = useState(false);
  useEffect(() => {
    const motion = matchMedia('(prefers-reduced-motion: reduce)');
    let visible = true;
    const sync = () =>
      setRunning(visible && !document.hidden && !motion.matches);
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      sync();
    });
    if (host.current) observer.observe(host.current);
    motion.addEventListener('change', sync);
    document.addEventListener('visibilitychange', sync);
    sync();
    return () => {
      observer.disconnect();
      motion.removeEventListener('change', sync);
      document.removeEventListener('visibilitychange', sync);
    };
  }, []);
  return (
    <div
      ref={host}
      className={
        'network-backdrop ' + (running ? 'network-running' : 'network-still')
      }
      aria-hidden="true"
    >
      <svg viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice">
        <defs>
          <radialGradient id="network-node-surface" cx="30%" cy="15%" r="90%">
            <stop offset="0" className="node-highlight" />
            <stop offset="1" className="node-shadow" />
          </radialGradient>
          <radialGradient id="network-halo">
            <stop stopColor="currentColor" stopOpacity=".14" />
            <stop offset="1" stopColor="currentColor" stopOpacity="0" />
          </radialGradient>
          <filter
            id="packet-light"
            x="-200%"
            y="-200%"
            width="500%"
            height="500%"
          >
            <feGaussianBlur stdDeviation="1.5" />
          </filter>
        </defs>
        <g className="network-links">
          {Object.entries(network.paths).map(([id, d]) => (
            <g key={id}>
              <path d={d} className="network-wire-shadow" />
              <path d={d} className="network-wire" />
            </g>
          ))}
        </g>
        {[
          { path: network.request, duration: 12, count: 3 },
          { path: network.delivery, duration: 10, count: 2 },
          { path: network.cached, duration: 14, count: 2 },
          { path: network.search, duration: 6, count: 1 },
          { path: network.cdn, duration: 7, count: 1 },
        ].map((flow, j) => (
          <g key={j}>
            {Array.from({ length: flow.count }, (_, i) =>
              [0, 1, 2, 3].map((tail) => (
                <g
                  key={`${i}-${tail}`}
                  className={'network-packet packet-' + j}
                  style={
                    {
                      offsetPath: `path('${flow.path}')`,
                      animationDuration: flow.duration + 's',
                      animationDelay:
                        -((i * flow.duration) / flow.count) +
                        tail * 0.065 +
                        's',
                      opacity: 1 - tail * 0.22,
                    } as CSSProperties
                  }
                >
                  {tail === 0 && <circle r="6" className="packet-glow" />}
                  <rect
                    x={-4 + tail * 0.45}
                    y={-2.6 + tail * 0.25}
                    width={8 - tail * 0.9}
                    height={5.2 - tail * 0.5}
                    rx="2"
                  />
                </g>
              )),
            )}
          </g>
        ))}
        {roles.map(({ id, Icon }) => {
          const [x, y] = network.nodes[id];
          return (
            <g
              key={id}
              transform={`translate(${x} ${y})`}
              className={'network-node node-' + id}
            >
              <circle r="78" fill="url(#network-halo)" />

              <circle
                r="35"
                fill="url(#network-node-surface)"
                className="node-shell"
              />
              <Icon x={-14} y={-14} width={28} height={28} strokeWidth={1.5} />
            </g>
          );
        })}
      </svg>
    </div>
  );
}
