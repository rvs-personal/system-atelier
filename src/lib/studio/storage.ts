'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useAccount } from '@/lib/auth/context';
const drafts = new Map<string, () => object>();
export const documentKeys = [
  'progress',
  'architecture',
  'lld',
  'interview',
  'decisions',
  'operations',
  'notebook',
  'lld-practice',
];
export async function exportWorkspace(accountId: string) {
  const documents: Record<string, unknown> = {};
  await Promise.all(
    documentKeys.map(async (key) => {
      const local = drafts.get(accountId + ':' + key);
      if (local) {
        documents[key] = local();
        return;
      }
      const r = await fetch('/api/state?key=' + key, {
        headers: { 'X-Atelier-Account': accountId },
      });
      if (!r.ok) throw Error('Could not read ' + key + '. Retry the export.');
      documents[key] = ((await r.json()) as { data: unknown }).data;
    }),
  );
  download('system-atelier-workspace.json', {
    format: 1,
    exportedAt: new Date().toISOString(),
    documents,
  });
}
type Saved<T> = { data: T | null; revision: number; error?: string };
export function useCloud<T extends object>(key: string, initial: T) {
  const accountId = useAccount()?.user.id ?? '';
  const initialRef = useRef(initial),
    [data, setData] = useState<T>(initial),
    [status, setStatus] = useState('Loading cloud workspace…'),
    [ready, setReady] = useState(false),
    [error, setError] = useState('');
  const revision = useRef(0),
    latest = useRef(data),
    saved = useRef(''),
    busy = useRef(false),
    mounted = useRef(true),
    dirty = useRef(false),
    loaded = useRef(false);
  latest.current = data;
  useEffect(() => {
    if (!ready) return;
    const id = accountId + ':' + key;
    const snapshot = () => latest.current;
    drafts.set(id, snapshot);
    return () => {
      if (drafts.get(id) === snapshot) drafts.delete(id);
    };
  }, [accountId, key, ready]);
  const load = useCallback(async () => {
    setStatus('Loading cloud workspace…');
    try {
      const r = await fetch('/api/state?key=' + key, {
        headers: { 'X-Atelier-Account': accountId },
      });
      const value = (await r.json()) as Saved<T>;
      if (!r.ok) throw Error(value.error ?? 'Could not load cloud workspace.');
      if (mounted.current) {
        revision.current = value.revision;
        const next = value.data ?? initialRef.current;
        latest.current = next;
        saved.current = JSON.stringify(next);
        loaded.current = true;
        dirty.current = false;
        setData(next);
        setReady(true);
        setError('');
        setStatus('Saved to cloud');
      }
    } catch (e) {
      if (mounted.current) {
        setError((e as Error).message);
        setStatus('Cloud unavailable');
      }
    }
  }, [key, accountId]);
  const save = useCallback(async () => {
    if (!loaded.current) {
      await load();
      return;
    }
    if (busy.current || !dirty.current) return;
    busy.current = true;
    setStatus('Saving…');
    const snapshot = JSON.stringify(latest.current);
    try {
      const r = await fetch('/api/state', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-Atelier-Account': accountId,
        },
        body: JSON.stringify({
          key,
          data: latest.current,
          revision: revision.current,
        }),
      });
      const result = (await r.json()) as { error?: string; revision: number };
      if (!r.ok) throw Error(result.error ?? 'Could not save.');
      revision.current = result.revision;
      saved.current = snapshot;
      dirty.current = JSON.stringify(latest.current) !== snapshot;
      if (mounted.current) {
        setError('');
        setStatus(dirty.current ? 'Unsaved changes' : 'Saved to cloud');
      }
    } catch (e) {
      if (mounted.current) {
        setError((e as Error).message);
        setStatus('Not saved');
      }
    } finally {
      busy.current = false;
    }
  }, [key, load, accountId]);
  useEffect(() => {
    mounted.current = true;
    void load();
    return () => {
      mounted.current = false;
    };
  }, [load]);
  useEffect(() => {
    if (!ready) return;
    dirty.current = JSON.stringify(data) !== saved.current;
    if (!dirty.current) return;
    setStatus('Unsaved changes');
    const timer = setTimeout(() => void save(), 650);
    return () => clearTimeout(timer);
  }, [data, ready, save]);
  useEffect(() => {
    const timer = setInterval(() => {
      if (dirty.current && !busy.current && !error) void save();
    }, 1600);
    const leave = (e: BeforeUnloadEvent) => {
      if (dirty.current) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', leave);
    return () => {
      clearInterval(timer);
      window.removeEventListener('beforeunload', leave);
    };
  }, [save, error]);
  return { data, setData, status, ready, error, save };
}
export function download(name: string, data: unknown) {
  const content =
    typeof data === 'string' ? data : JSON.stringify(data, null, 2);
  const url = URL.createObjectURL(
    new Blob([content], {
      type: name.endsWith('.svg') ? 'image/svg+xml' : 'text/plain',
    }),
  );
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
