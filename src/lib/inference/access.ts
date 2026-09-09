import { env } from '@/lib/server-env';
import { account, json, sameOrigin, limitKey } from '@/lib/auth/server';
import { database } from '@/db/raw';
import { inferenceAllowed, inferenceLimits } from './policy';
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
  if (
    !(await limitKey(
      'model-minute:' + user.id,
      inferenceLimits.requestsPerMinute,
      60,
    ))
  )
    return {
      response: json(
        { error: 'Please wait a minute before requesting another review.' },
        429,
        {
          'Retry-After': '60',
        },
      ),
    };
  return { user };
}
export async function reserveModelBudget(userId: string, critical: boolean) {
  // All model endpoints share these server-owned limits. Reject conservatively;
  // failed calls still count because the provider may already have incurred cost.
  if (
    !(await limitKey(
      'model-day:' + userId,
      inferenceLimits.accountDaily,
      86400,
    )) ||
    !(await limitKey('model-day:site', inferenceLimits.siteDaily, 86400))
  )
    return false;
  if (
    critical &&
    !(await limitKey(
      'model-critical:' + userId,
      inferenceLimits.criticalDaily,
      86400,
    ))
  )
    return false;
  return true;
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
