import { readBounded } from '@/lib/inference/policy';
import { database } from '@/db/raw';
import { account, json, sameOrigin } from '@/lib/auth/server';
const keys = new Set([
  'progress',
  'architecture',
  'lld',
  'interview',
  'decisions',
  'operations',
  'notebook',
  'lld-practice',
]);
export async function GET(r: Request) {
  try {
    const user = await account(r);
    if (!user) return json({ error: 'Sign in to open your workspace.' }, 401);
    if (
      r.headers.has('x-atelier-account') &&
      r.headers.get('x-atelier-account') !== user.id
    )
      return json(
        { error: 'Account changed in another tab. Reload to continue.' },
        409,
      );
    const key = new URL(r.url).searchParams.get('key');
    if (!key || !keys.has(key))
      return json({ error: 'Unknown workspace.' }, 400);
    const row = await database()
      .prepare(
        'SELECT data,revision FROM account_documents WHERE id=? AND account_id=?',
      )
      .bind(user.id + ':' + key, user.id)
      .first<{ data: string; revision: number }>();
    return json(
      row
        ? { data: JSON.parse(row.data), revision: row.revision }
        : { data: null, revision: 0 },
    );
  } catch {
    return json({ error: 'Cloud storage is temporarily unavailable.' }, 503);
  }
}
export async function PUT(r: Request) {
  if (!sameOrigin(r)) return json({ error: 'Origin rejected.' }, 403);
  try {
    const user = await account(r);
    if (!user)
      return json(
        { error: 'Your session expired. Sign in again before saving.' },
        401,
      );
    if (
      r.headers.has('x-atelier-account') &&
      r.headers.get('x-atelier-account') !== user.id
    )
      return json(
        {
          error:
            'Account changed in another tab. Export your draft and reload.',
        },
        409,
      );
    const text = await readBounded(r, 1500000);
    if (new TextEncoder().encode(text).length > 1500000)
      return json(
        { error: 'Workspace exceeds 1.5 MB. Export and clear old interviews.' },
        413,
      );
    const { key, data, revision } = JSON.parse(text);
    if (
      !keys.has(key) ||
      !Number.isInteger(revision) ||
      revision < 0 ||
      !data ||
      typeof data !== 'object' ||
      Array.isArray(data)
    )
      return json({ error: 'Invalid workspace data.' }, 400);
    const id = user.id + ':' + key,
      value = JSON.stringify(data),
      now = new Date().toISOString();
    let result;
    if (revision === 0)
      result = await database()
        .prepare(
          'INSERT INTO account_documents(id,account_id,key,data,revision,updated_at) VALUES(?,?,?,?,1,?) ON CONFLICT(id) DO NOTHING',
        )
        .bind(id, user.id, key, value, now)
        .run();
    else
      result = await database()
        .prepare(
          'UPDATE account_documents SET data=?,revision=revision+1,updated_at=? WHERE id=? AND account_id=? AND revision=?',
        )
        .bind(value, now, id, user.id, revision)
        .run();
    if (!result.meta.changes)
      return json(
        {
          error:
            'This workspace changed in another tab. Export your draft, then reload.',
        },
        409,
      );
    return json({ revision: revision + 1 });
  } catch {
    return json(
      { error: 'Could not save. Keep this page open and retry.' },
      503,
    );
  }
}
