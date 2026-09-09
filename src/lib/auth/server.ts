import { database } from '@/db/raw';
import { digest, randomSecret } from './crypto';
export type Account = { id: string; username: string };
export const sessionCookie = (r: Request) =>
  new URL(r.url).protocol === 'https:'
    ? '__Host-atelier_session'
    : 'atelier_session';
export function cookieValue(r: Request) {
  const prefix = sessionCookie(r) + '=';
  return (
    (r.headers.get('cookie') ?? '')
      .split(';')
      .map((s) => s.trim())
      .find((s) => s.startsWith(prefix))
      ?.slice(prefix.length) ?? ''
  );
}
export function cookie(r: Request, value: string, age = 30 * 86400) {
  return `${sessionCookie(r)}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${age}${new URL(r.url).protocol === 'https:' ? '; Secure' : ''}`;
}
export async function account(r: Request): Promise<Account | null> {
  const token = cookieValue(r);
  if (!/^[a-f0-9]{64}$/.test(token)) return null;
  return database()
    .prepare(
      'SELECT a.id,a.username FROM account_sessions s JOIN accounts a ON a.id=s.account_id WHERE s.token=? AND s.expires>?',
    )
    .bind(await digest(token), Date.now())
    .first<Account>();
}
export function sameOrigin(r: Request) {
  const origin = r.headers.get('origin');
  try {
    return !!origin && new URL(origin).origin === new URL(r.url).origin;
  } catch {
    return false;
  }
}
export async function newLogin(
  r: Request,
  id: string,
  expectedPassword: string,
) {
  const token = randomSecret();
  const result = await database()
    .prepare(
      'INSERT INTO account_sessions(token,account_id,expires) SELECT ?,id,? FROM accounts WHERE id=? AND password=?',
    )
    .bind(await digest(token), Date.now() + 30 * 86400000, id, expectedPassword)
    .run();
  if (!result.meta.changes)
    throw new Error('Credentials changed. Retry sign-in.');
  return cookie(r, token);
}
export async function rateLimit(
  r: Request,
  scope: string,
  limit: number,
  seconds = 900,
) {
  const ip =
    (process.env.VERCEL === '1'
      ? r.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      : undefined) ?? 'local';
  return limitKey(scope + ':' + (await digest(ip)), limit, seconds);
}
export async function limitKey(scope: string, limit: number, seconds = 900) {
  const now = Date.now(),
    window = Math.floor(now / (seconds * 1000));
  const key = scope + ':' + window;
  const row = await database()
    .prepare(
      'INSERT INTO auth_limits(key,count,expires) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1 RETURNING count',
    )
    .bind(key, (window + 1) * seconds * 1000)
    .first<{ count: number }>();
  return !!row && row.count <= limit;
}
export const json = (
  data: unknown,
  status = 200,
  headers: Record<string, string> = {},
) =>
  Response.json(data, {
    status,
    headers: {
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'same-origin',
      ...headers,
    },
  });
