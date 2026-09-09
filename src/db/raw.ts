import { createClient, type Client, type InValue } from '@libsql/client';
let client: Client | undefined;
export function databaseClient() {
  if (!client) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error('DATABASE_URL is required');
    if (process.env.VERCEL && !/^(libsql|https):\/\//.test(url))
      throw new Error('Vercel requires a remote persistent database');
    client = createClient({ url, authToken: process.env.DATABASE_AUTH_TOKEN });
  }
  return client;
}
class Statement {
  constructor(
    readonly sql: string,
    readonly args: InValue[] = [],
  ) {}
  bind(...args: InValue[]) {
    return new Statement(this.sql, args);
  }
  async first<T = Record<string, unknown>>(): Promise<T | null> {
    const r = await databaseClient().execute({
      sql: this.sql,
      args: this.args,
    });
    return (r.rows[0] as unknown as T) ?? null;
  }
  async run() {
    const r = await databaseClient().execute({
      sql: this.sql,
      args: this.args,
    });
    return { meta: { changes: r.rowsAffected } };
  }
}
export function database() {
  return {
    prepare: (sql: string) => new Statement(sql),
    batch: async (statements: Statement[]) =>
      databaseClient().batch(
        statements.map((s) => ({ sql: s.sql, args: s.args })),
        'write',
      ),
  };
}
