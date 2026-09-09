'use client';
import { useEffect, useState } from 'react';
import {
  Sun,
  Moon,
  NotebookPen,
  UserRound,
  Download,
  LogOut,
  ArrowUpRight,
} from 'lucide-react';
import {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { useAccount } from '@/lib/auth/context';
import { useCloud, exportWorkspace } from '@/lib/studio/storage';
import { lessons } from '@/lib/studio/curriculum';
import { CloudStatus } from './shared';
type Entry = { title: string; route: string; text: string; updatedAt: string };
export default function WorkspaceTools({ view }: { view: string }) {
  const [theme, setTheme] = useState('light');
  useEffect(() => {
    const saved = localStorage.getItem('atelier-theme');
    const next =
      saved ??
      (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    setTheme(next);
    document.documentElement.dataset.theme = next;
  }, []);
  function toggleTheme() {
    const next = theme === 'light' ? 'dark' : 'light';
    setTheme(next);
    document.documentElement.dataset.theme = next;
    localStorage.setItem('atelier-theme', next);
  }
  const account = useAccount(),
    cloud = useCloud('notebook', { entries: {} as Record<string, Entry> });
  const [route, setRoute] = useState('#studio'),
    [context, setContext] = useState(''),
    [open, setOpen] = useState(false),
    [selected, setSelected] = useState<string | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  useEffect(() => {
    const sync = () => setRoute(location.hash || '#studio');
    sync();
    const t = setInterval(sync, 500);
    const receive = (e: Event) => setContext((e as CustomEvent<string>).detail);
    window.addEventListener('atelier-context', receive);
    return () => {
      clearInterval(t);
      window.removeEventListener('atelier-context', receive);
    };
  }, []);
  const section = route.slice(1).split('/')[0],
    lesson = lessons.find((l) => route === '#learn/' + l.id);
  const title =
    lesson?.title ??
    (section === 'lab' && context
      ? context
      : ({
          studio: 'Studio',
          learn: 'Learning path',
          lab: 'Architecture lab',
          lld: 'LLD workbench',
          interview: 'Interview room',
        }[section] ?? 'Studio'));
  const current = section === 'lab' && context ? route + '::' + context : route,
    key = selected ?? current,
    entry = cloud.data.entries[key];
  return (
    <>
      <div className="topbar-tools">
        <button
          className="workspace-menu-trigger"
          aria-label={
            theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'
          }
          onClick={toggleTheme}
        >
          {theme === 'light' ? <Moon size={17} /> : <Sun size={17} />}
        </button>
        <Sheet>
          <SheetTrigger
            className="profile-trigger"
            aria-label="Profile and workspace"
          >
            <span className="profile-avatar">
              {account?.user.username.slice(0, 1).toUpperCase() ?? (
                <UserRound size={16} />
              )}
            </span>
            <span>{account?.user.username}</span>
          </SheetTrigger>
          <SheetContent className="workspace-sheet">
            <SheetHeader>
              <SheetTitle>Your profile</SheetTitle>
              <SheetDescription>
                Account, notes and saved work.
              </SheetDescription>
            </SheetHeader>
            <div className="workspace-menu-body">
              <div className="profile-summary">
                <span className="profile-avatar">
                  {account?.user.username.slice(0, 1).toUpperCase()}
                </span>
                <div>
                  <strong>{account?.user.username}</strong>
                  <span>Signed in · System Atelier</span>
                </div>
              </div>
              <button
                className="secondary"
                disabled={busy}
                onClick={async () => {
                  if (!account) return;
                  setBusy(true);
                  setError('');
                  try {
                    await exportWorkspace(account.user.id);
                  } catch (e) {
                    setError((e as Error).message);
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                <Download size={16} />
                {busy ? 'Preparing export…' : 'Export workspace'}
              </button>
              <p>
                Includes notes, learning progress, designs, decisions, and
                interview history.
              </p>
              {error && <p role="alert">{error}</p>}
              <button className="text-button" onClick={account?.logout}>
                <LogOut size={16} />
                Sign out
              </button>
            </div>
          </SheetContent>
        </Sheet>
      </div>
      <Sheet
        open={open}
        onOpenChange={(v) => {
          setOpen(v);
          if (v) setSelected(null);
        }}
      >
        <SheetTrigger className="notebook-fab" aria-label="Open notebook">
          <NotebookPen size={21} />
          <span>Notes</span>
        </SheetTrigger>
        <SheetContent className="notebook-sheet">
          <SheetHeader>
            <SheetTitle>Notebook</SheetTitle>
            <SheetDescription>
              Notes stay attached to the page or incident where you write them.
            </SheetDescription>
          </SheetHeader>
          <div className="notebook-body">
            <span className="notebook-context">{entry?.title ?? title}</span>
            <textarea
              aria-label="Page notes"
              disabled={!cloud.ready}
              maxLength={15000}
              placeholder="Capture a question, sketch a decision, or save an insight…"
              value={entry?.text ?? ''}
              onChange={(e) => {
                const text = e.target.value;
                cloud.setData((d) => ({
                  ...d,
                  entries: {
                    ...d.entries,
                    [key]: {
                      title: entry?.title ?? title,
                      route: entry?.route ?? route,
                      text,
                      updatedAt: new Date().toISOString(),
                    },
                  },
                }));
              }}
            />
            <CloudStatus {...cloud} />
            <h3>Notes by page</h3>
            <button className="note-link" onClick={() => setSelected(null)}>
              Current page <ArrowUpRight size={14} />
            </button>
            {Object.entries(cloud.data.entries)
              .filter(([, e]) => e.text.trim())
              .sort((a, b) => b[1].updatedAt.localeCompare(a[1].updatedAt))
              .map(([id, e]) => (
                <button
                  className="note-link"
                  aria-current={id === key ? 'true' : undefined}
                  key={id}
                  onClick={() => setSelected(id)}
                >
                  <span>
                    {e.title}
                    <small>{new Date(e.updatedAt).toLocaleDateString()}</small>
                  </span>
                  <NotebookPen size={14} />
                </button>
              ))}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
