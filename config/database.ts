import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  out: './database/migrations',
  schema: './src/db/schema.ts',
  dialect: 'sqlite',
});
