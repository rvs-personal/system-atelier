import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { database, databaseClient } from '../src/db/raw';
const dir = mkdtempSync(join(tmpdir(), 'atelier-db-'));
process.env.DATABASE_URL = 'file:' + join(dir, 'test.db');
execFileSync(process.execPath, ['scripts/migrate.mjs'], { env: process.env });
test('migration rerun, transactional rollback, and concurrent revision protection', async () => {
  execFileSync(process.execPath, ['scripts/migrate.mjs'], { env: process.env });
  const db = database();
  await db
    .prepare('INSERT INTO accounts VALUES(?,?,?,?,?)')
    .bind('a', 'test', 'hash', 'recovery', 0)
    .run();
  await assert.rejects(
    db.batch([
      db
        .prepare('INSERT INTO auth_limits VALUES(?,?,?)')
        .bind('rollback', 1, 0),
      db
        .prepare('INSERT INTO accounts VALUES(?,?,?,?,?)')
        .bind('a', 'duplicate', 'hash', 'recovery', 0),
    ]),
  );
  assert.equal(
    await db
      .prepare('SELECT * FROM auth_limits WHERE key=?')
      .bind('rollback')
      .first(),
    null,
  );
  await db
    .prepare('INSERT INTO account_documents VALUES(?,?,?,?,?,?)')
    .bind('a:progress', 'a', 'progress', '{}', 1, 'now')
    .run();
  const updates = await Promise.all(
    Array.from({ length: 8 }, () =>
      db
        .prepare(
          'UPDATE account_documents SET revision=revision+1 WHERE id=? AND revision=1',
        )
        .bind('a:progress')
        .run(),
    ),
  );
  assert.equal(
    updates.reduce((n, r) => n + r.meta.changes, 0),
    1,
  );
  const counters = await Promise.all(
    Array.from({ length: 12 }, () =>
      db
        .prepare(
          'INSERT INTO auth_limits VALUES(?,1,0) ON CONFLICT(key) DO UPDATE SET count=count+1 RETURNING count',
        )
        .bind('counter')
        .first<{ count: number }>(),
    ),
  );
  assert.deepEqual(
    counters.map((x) => x!.count).sort((a, b) => a - b),
    Array.from({ length: 12 }, (_, i) => i + 1),
  );
  databaseClient().close();
  rmSync(dir, { recursive: true, force: true });
});
