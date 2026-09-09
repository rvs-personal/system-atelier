import { env } from '@/lib/server-env';
import { account, json, sameOrigin } from '@/lib/auth/server';
import { database } from '@/db/raw';
import { inferenceAllowed } from './policy';
export const settings = () => env as unknown as Record<string, string>;
export async function inferenceAccess(request: Request) {
  if (!sameOrigin(request))
    return { response: json({ error: 'Origin rejected.' }, 403) };
  const user = await account(request);
  if (!user) return { response: json({ error: 'Sign in first.' }, 401) };
  if (request.headers.get('x-atelier-account') !== user.id)
    return {
      response: json({ error: 'Account changed. Reload before sending.' }, 409),
    };
  if (
    settings().INFERENCE_ENABLED !== 'true' ||
    !inferenceAllowed(
      user.id,
      settings().INFERENCE_ACCOUNT_IDS,
      settings().INFERENCE_PUBLIC_ENABLED,
    )
  )
    return {
      response: json(
        {
          error:
            'Live model access is not enabled for this account. Learning and saved work remain available.',
        },
        403,
      ),
    };
  if (!settings().CURSOR_API_KEY)
    return {
      response: json(
        { error: 'Model service is unavailable. Your work is saved.' },
        503,
      ),
    };
  return { user };
}
export async function acquireModelLock(userId: string) {
  const key = 'model-user:' + userId,
    lease = crypto.randomUUID();
  await database()
    .prepare(
      'INSERT INTO inference_sessions(id,account_id,agent_id,busy_until,lease) VALUES(?,?,?,0,?) ON CONFLICT(id) DO NOTHING',
    )
    .bind(key, userId, '', '')
    .run();
  const result = await database()
    .prepare(
      'UPDATE inference_sessions SET busy_until=?,lease=? WHERE id=? AND busy_until<?',
    )
    .bind(Date.now() + 240000, lease, key, Date.now())
    .run();
  return result.meta.changes ? { key, lease } : null;
}
export async function releaseModelLock(
  lock: { key: string; lease: string } | null,
) {
  if (lock)
    await database()
      .prepare(
        'UPDATE inference_sessions SET busy_until=0 WHERE id=? AND lease=?',
      )
      .bind(lock.key, lock.lease)
      .run();
}
