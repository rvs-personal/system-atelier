import { readBounded } from '@/lib/inference/policy';
import { env } from '@/lib/server-env';
import { database } from '@/db/raw';
import { account, cookie, cookieValue } from '@/lib/auth/server';
import {
  json,
  sameOrigin,
  newLogin,
  rateLimit,
  limitKey,
} from '@/lib/auth/server';
import {
  digest,
  equal,
  passwordHash,
  passwordMatches,
  randomSecret,
  validPassword,
  validUsername,
} from '@/lib/auth/crypto';
export async function GET(r: Request) {
  try {
    return json({ account: await account(r) });
  } catch {
    return json(
      { error: 'Sign-in is temporarily unavailable. Please retry.' },
      503,
    );
  }
}
export async function POST(r: Request) {
  if (!sameOrigin(r)) return json({ error: 'Origin rejected.' }, 403);
  try {
    const raw = await readBounded(r, 5000);
    if (raw.length > 5000) return json({ error: 'Request too large.' }, 413);
    const input = JSON.parse(raw);
    const action = input.action;
    if (action === 'logout') {
      const token = cookieValue(r);
      await database()
        .prepare('DELETE FROM account_sessions WHERE token=?')
        .bind(await digest(token))
        .run();
      return json({ ok: true }, 200, { 'Set-Cookie': cookie(r, '', 0) });
    }
    if (action === 'claim') {
      const user = await account(r);
      if (!user) return json({ error: 'Sign in first.' }, 401);
      if (r.headers.get('x-atelier-account') !== user.id)
        return json({ error: 'Account changed. Reload first.' }, 409);
      if (!(await rateLimit(r, 'claim', 5)))
        return json({ error: 'Too many attempts. Retry in 15 minutes.' }, 429);
      const expected = (env as unknown as Record<string, string>)
        .LEGACY_CLAIM_HASH;
      if (
        typeof input.code !== 'string' ||
        !expected ||
        !equal(await digest(input.code.trim()), expected)
      )
        return json({ error: 'That private import code is not valid.' }, 400);
      // The transaction binds the one-time claim to exactly one account. Existing personal data is never overwritten.
      await database().batch([
        database()
          .prepare(
            "INSERT INTO legacy_claim(id,account_id) VALUES('original',?) ON CONFLICT(id) DO NOTHING",
          )
          .bind(user.id),
        database()
          .prepare(
            "INSERT INTO account_documents(id,account_id,key,data,revision,updated_at) SELECT ? || ':' || key,?,key,data,1,? FROM studio_documents WHERE EXISTS (SELECT 1 FROM legacy_claim WHERE id='original' AND account_id=?) ON CONFLICT(id) DO NOTHING",
          )
          .bind(user.id, user.id, new Date().toISOString(), user.id),
      ]);
      const claim = await database()
        .prepare("SELECT account_id FROM legacy_claim WHERE id='original'")
        .first<{ account_id: string }>();
      return claim?.account_id === user.id
        ? json({ ok: true })
        : json(
            {
              error:
                'This workspace has already been imported by another account.',
            },
            409,
          );
    }
    if (!['signup', 'login', 'recover'].includes(action))
      return json({ error: 'Unknown action.' }, 400);
    if (!(await rateLimit(r, 'auth', 20)))
      return json({ error: 'Too many attempts. Retry in 15 minutes.' }, 429);
    const username =
      typeof input.username === 'string'
        ? input.username.toLowerCase().trim()
        : '';
    if (!validUsername(username) || !validPassword(input.password))
      return json(
        {
          error:
            'Use a 3–32 character username (letters, numbers, underscores) and a 12–128 character password.',
        },
        400,
      );
    if (!(await limitKey('username:' + (await digest(username)), 15)))
      return json({ error: 'Too many attempts. Retry in 15 minutes.' }, 429);
    await database().batch([
      database()
        .prepare('DELETE FROM auth_limits WHERE expires<?')
        .bind(Date.now() - 86400000),
      database()
        .prepare('DELETE FROM account_sessions WHERE expires<?')
        .bind(Date.now()),
    ]);
    if (action === 'signup') {
      if (!(await rateLimit(r, 'signup', 5, 3600)))
        return json(
          { error: 'Account creation limit reached. Retry later.' },
          429,
        );
      const existing = await database()
        .prepare('SELECT id FROM accounts WHERE username=?')
        .bind(username)
        .first();
      if (existing)
        return json(
          { error: 'That username is unavailable. Choose another or sign in.' },
          409,
        );
      const id = crypto.randomUUID(),
        recovery = randomSecret(),
        hash = await passwordHash(input.password);
      try {
        await database()
          .prepare(
            'INSERT INTO accounts(id,username,password,recovery,created_at) VALUES(?,?,?,?,?)',
          )
          .bind(id, username, hash, await digest(recovery), Date.now())
          .run();
      } catch {
        return json(
          { error: 'Could not create that account. Try another username.' },
          409,
        );
      }
      return json({ account: { id, username }, recovery }, 201, {
        'Set-Cookie': await newLogin(r, id, hash),
      });
    }
    const user = await database()
      .prepare(
        'SELECT id,username,password,recovery FROM accounts WHERE username=?',
      )
      .bind(username)
      .first<{
        id: string;
        username: string;
        password: string;
        recovery: string;
      }>();
    if (action === 'recover') {
      if (
        !user ||
        typeof input.recovery !== 'string' ||
        !equal(await digest(input.recovery.trim()), user.recovery)
      )
        return json({ error: 'Username or recovery key is incorrect.' }, 401);
      const replacement = randomSecret(),
        hash = await passwordHash(input.password),
        oldRecovery = user.recovery;
      await database().batch([
        database()
          .prepare(
            'UPDATE accounts SET password=?,recovery=? WHERE id=? AND recovery=?',
          )
          .bind(hash, await digest(replacement), user.id, oldRecovery),
        database()
          .prepare(
            'DELETE FROM account_sessions WHERE account_id=? AND EXISTS (SELECT 1 FROM accounts WHERE id=? AND recovery=?)',
          )
          .bind(user.id, user.id, await digest(replacement)),
      ]);
      // Concurrent reuse cannot issue a new session after a different recovery wins.
      const latest = await database()
        .prepare('SELECT recovery FROM accounts WHERE id=?')
        .bind(user.id)
        .first<{ recovery: string }>();
      if (latest?.recovery !== (await digest(replacement)))
        return json({ error: 'Recovery key has already been used.' }, 409);
      return json(
        {
          account: { id: user.id, username: user.username },
          recovery: replacement,
        },
        200,
        { 'Set-Cookie': await newLogin(r, user.id, hash) },
      );
    }
    // Run the same expensive check even when the username does not exist.
    const dummy =
      'scrypt1:0000000000000000000000000000000000000000000000000000000000000000:0000000000000000000000000000000000000000000000000000000000000000';
    const match = await passwordMatches(
      input.password,
      user?.password ?? dummy,
    );
    if (!user || !match)
      return json({ error: 'Username or password is incorrect.' }, 401);
    return json({ account: { id: user.id, username: user.username } }, 200, {
      'Set-Cookie': await newLogin(r, user.id, user.password),
    });
  } catch {
    return json(
      { error: 'Sign-in is temporarily unavailable. Please retry.' },
      503,
    );
  }
}
