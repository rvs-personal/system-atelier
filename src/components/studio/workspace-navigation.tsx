'use client';
import { useEffect, useState } from 'react';
import { parentRoute } from '@/lib/studio/navigation';
import { lessons } from '@/lib/studio/curriculum';
import { lldLibrary } from '@/lib/studio/lld-library';
import { incidents } from '@/lib/studio/operations';
import { ArrowLeft, ChevronRight, House } from 'lucide-react';
const labels: Record<string, string> = {
  studio: 'Home',
  learn: 'Learning path',
  lab: 'Architecture lab',
  lld: 'LLD workbench',
  interview: 'Interview room',
  reading: 'Learning',
  practice: 'Coding practice',
  session: 'Current interview',
  history: 'Past interviews',
  simulations: 'Interactive workbenches',
  load: 'Request capacity',
  queue: 'Queue arithmetic',
  quorum: 'Quorum thresholds',
  estimate: 'Launch estimates',
};
export default function WorkspaceNavigation() {
  const [route, setRoute] = useState('studio');
  useEffect(() => {
    const sync = () => {
      setRoute(location.hash.slice(1) || 'studio');
    };
    sync();
    window.addEventListener('hashchange', sync);
    return () => window.removeEventListener('hashchange', sync);
  }, []);
  const parts = route.split('/'),
    parent = parentRoute(route);
  function label(part: string, i: number) {
    if (parts[0] === 'learn' && i === 1)
      return lessons.find((l) => l.id === part)?.title ?? 'Lesson';
    if (parts[0] === 'lab' && i === 1)
      return labels[part] ?? incidents[Number(part)]?.title ?? 'Experiment';
    if (parts[0] === 'lab' && i === 2)
      return ['', 'Diagnose', 'Repair', 'Verify'][Number(part)] ?? 'Incident';
    if (parts[0] === 'interview' && i === 2) return 'Debrief';
    return (
      labels[part] ??
      lldLibrary.find((c) => c.id === part)?.name ??
      part.replaceAll('-', ' ')
    );
  }
  return (
    <nav className="workspace-breadcrumbs" aria-label="Page navigation">
      {route !== 'studio' && (
        <a
          className="workspace-back"
          href={'#' + parent}
          aria-label={
            'Back to ' +
            (labels[parts.length > 1 ? parts.at(-2)! : 'studio'] ??
              'previous section')
          }
        >
          <ArrowLeft size={16} />
          <span>Back</span>
        </a>
      )}
      <a href="#studio" aria-label="Home">
        <House size={16} />
        <span>Home</span>
      </a>
      {parts[0] !== 'studio' &&
        parts.map((part, i) => (
          <span className="breadcrumb-segment" key={i}>
            <ChevronRight size={13} />
            {i === parts.length - 1 ? (
              <span aria-current="page">{label(part, i)}</span>
            ) : (
              <a href={'#' + parts.slice(0, i + 1).join('/')}>
                {label(part, i)}
              </a>
            )}
          </span>
        ))}
    </nav>
  );
}
