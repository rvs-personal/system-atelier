'use client';
import { useEffect, useState } from 'react';
import {
  Blocks,
  BookOpen,
  Network,
  Code2,
  AudioLines,
  ArrowUpRight,
  ArrowRight,
  FlaskConical,
  Check,
  Cloud,
  Compass,
  GraduationCap,
} from 'lucide-react';
import {
  SidebarProvider,
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarFooter,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarTrigger,
  useSidebar,
} from '@/components/ui/sidebar';
import { stages, lessons } from '@/lib/studio/curriculum';
import { initialDesign } from '@/lib/studio/model';
import Diagram from '@/components/studio/diagram';
import StudioHome from '@/components/studio/studio-home';
import Learn from '@/components/studio/learn';
import Lab from '@/components/studio/lab';
import LLD from '@/components/studio/lld';
import Interview from '@/components/studio/interview';
import WorkspaceNavigation from '@/components/studio/workspace-navigation';
import WorkspaceTools from '@/components/studio/workspace-tools';
import { incidents } from '@/lib/studio/operations';
import AuthGate, { AccountMenu } from '@/components/studio/auth';
const navigation = [
  { id: 'studio', label: 'Studio', icon: Blocks },
  { id: 'learn', label: 'Learning path', icon: BookOpen },
  { id: 'lab', label: 'Architecture lab', icon: Network },
  { id: 'lld', label: 'LLD workbench', icon: Code2 },
  { id: 'interview', label: 'Interview room', icon: AudioLines },
];
export default function Home() {
  return (
    <AuthGate>
      <SidebarProvider
        style={{ '--sidebar-width': '208px' } as React.CSSProperties}
      >
        <App />
      </SidebarProvider>
    </AuthGate>
  );
}
function App() {
  const [view, setView] = useState('studio'),
    [visited, setVisited] = useState<string[]>(['studio']),
    [completed, setCompleted] = useState<number | null>(null);
  const { setOpenMobile } = useSidebar();
  function navigate(route: string) {
    const id = route.split('/')[0];
    if (!navigation.some((n) => n.id === id)) return;
    setView(id);
    setVisited((v) => (v.includes(id) ? v : [...v, id]));
    window.location.hash = route;
    setOpenMobile(false);
    window.scrollTo({ top: 0, behavior: 'instant' });
  }
  useEffect(() => {
    const route = () => {
      const id = window.location.hash.slice(1).split('/')[0];
      if (navigation.some((n) => n.id === id)) {
        setView(id);
        setVisited((v) => (v.includes(id) ? v : [...v, id]));
        window.scrollTo({ top: 0, behavior: 'instant' });
      }
    };
    route();
    window.addEventListener('hashchange', route);
    return () => window.removeEventListener('hashchange', route);
  }, []);
  useEffect(() => {
    if (view === 'studio')
      fetch('/api/state?key=progress')
        .then((r) =>
          r.ok
            ? (r.json() as Promise<{ data: { completed?: string[] } | null }>)
            : null,
        )
        .then((d) => setCompleted(d ? (d.data?.completed?.length ?? 0) : null))
        .catch(() => setCompleted(null));
  }, [view]);
  useEffect(() => {
    const context = (
      document as Document & {
        modelContext?: {
          registerTool: (t: unknown, o: { signal: AbortSignal }) => unknown;
        };
      }
    ).modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    try {
      Promise.resolve(
        context.registerTool(
          {
            name: 'open_design_workspace',
            description:
              'Navigate to the studio, learning path, architecture lab, LLD workbench, or interview setup. Does not start an interview or change saved designs.',
            inputSchema: {
              type: 'object',
              properties: {
                workspace: {
                  type: 'string',
                  enum: navigation.map((n) => n.id),
                },
              },
              required: ['workspace'],
              additionalProperties: false,
            },
            annotations: { readOnlyHint: false },
            execute: async (input: unknown) => {
              const id = (input as { workspace?: unknown })?.workspace;
              if (
                typeof id !== 'string' ||
                !navigation.some((n) => n.id === id)
              )
                throw Error('Unknown workspace');
              navigate(id);
              await new Promise<void>((r) => requestAnimationFrame(() => r()));
              return { workspace: id, opened: true };
            },
          },
          { signal: lifecycle.signal },
        ),
      ).catch(() => {});
    } catch {}
    return () => lifecycle.abort();
  }, []);
  return (
    <>
      <Sidebar>
        <SidebarHeader>
          <a
            href="#studio"
            onClick={() => navigate('studio')}
            className="brand"
          >
            <Blocks />
            <span>
              system<span className="brand-light">atelier</span>
            </span>
          </a>
        </SidebarHeader>
        <SidebarContent>
          <div className="nav-label">YOUR WORKSPACE</div>
          <SidebarMenu>
            {navigation.map(({ id, label, icon: Icon }) => (
              <SidebarMenuItem key={id}>
                <SidebarMenuButton
                  size="lg"
                  isActive={view === id}
                  onClick={() => navigate(id)}
                >
                  <Icon />
                  <span>{label}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarContent>
      </Sidebar>
      <main
        className="workspace"
        data-workspace={view}
        onPointerMove={(e) => {
          if (
            e.pointerType !== 'mouse' ||
            matchMedia('(prefers-reduced-motion: reduce)').matches
          )
            return;
          const box = e.currentTarget.getBoundingClientRect();
          e.currentTarget.style.setProperty(
            '--depth-x',
            ((e.clientX - box.left) / box.width) * 8 - 4 + 'px',
          );
          e.currentTarget.style.setProperty(
            '--depth-y',
            ((e.clientY - box.top) / innerHeight) * 6 - 3 + 'px',
          );
        }}
        onPointerLeave={(e) => {
          e.currentTarget.style.setProperty('--depth-x', '0px');
          e.currentTarget.style.setProperty('--depth-y', '0px');
        }}
      >
        <header className="topbar">
          <div className="flex items-center gap-3">
            <SidebarTrigger />
            <WorkspaceNavigation />
          </div>
          <WorkspaceTools view={view} />
        </header>
        <div className={'page ' + (view === 'interview' ? 'room-page' : '')}>
          <div hidden={view !== 'studio'}>
            <StudioHome navigate={navigate} completed={completed} />
          </div>
          {visited.includes('learn') && (
            <div hidden={view !== 'learn'}>
              <Learn onLab={() => navigate('lab')} />
            </div>
          )}
          {visited.includes('lab') && (
            <div hidden={view !== 'lab'}>
              <Lab />
            </div>
          )}
          {visited.includes('lld') && (
            <div hidden={view !== 'lld'}>
              <LLD />
            </div>
          )}
          {visited.includes('interview') && (
            <div hidden={view !== 'interview'}>
              <Interview onLearn={() => navigate('learn')} />
            </div>
          )}
        </div>
      </main>
    </>
  );
}
