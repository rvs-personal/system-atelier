import { createClient } from '@libsql/client';
import { readdir, readFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const url =
  process.env.DATABASE_URL ||
  process.env.DATABASE_TURSO_DATABASE_URL ||
  process.env.TURSO_DATABASE_URL;
if (!url) throw Error('Set DATABASE_URL before migrating');
if (url.startsWith('file:')) await mkdir('data', { recursive: true });
const db = createClient({
  url,
  authToken:
    process.env.DATABASE_AUTH_TOKEN ||
    process.env.DATABASE_TURSO_AUTH_TOKEN ||
    process.env.TURSO_AUTH_TOKEN,
});
try {
  await db.execute(
    'CREATE TABLE IF NOT EXISTS atelier_migrations(name TEXT PRIMARY KEY, checksum TEXT NOT NULL)',
  );
  for (const name of (await readdir('database/migrations'))
    .filter((x) => x.endsWith('.sql'))
    .sort()) {
    const sql = await readFile('database/migrations/' + name, 'utf8'),
      checksum = createHash('sha256').update(sql).digest('hex');
    const previous = await db.execute({
      sql: 'SELECT checksum FROM atelier_migrations WHERE name=?',
      args: [name],
    });
    if (previous.rows.length) {
      if (previous.rows[0].checksum !== checksum)
        throw Error('Applied migration changed: ' + name);
      continue;
    }
    const statements = sql
      .split('--> statement-breakpoint')
      .map((s) => s.trim())
      .filter(Boolean);
    await db.batch(
      [
        ...statements,
        {
          sql: 'INSERT INTO atelier_migrations(name,checksum) VALUES(?,?)',
          args: [name, checksum],
        },
      ],
      'write',
    );
    console.log('Applied ' + name);
  }
} finally {
  db.close();
}
