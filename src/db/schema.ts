import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
export const studioDocuments = sqliteTable('studio_documents', {
  key: text('key').primaryKey(),
  data: text('data').notNull(),
  revision: integer('revision').notNull().default(1),
  updatedAt: text('updated_at').notNull(),
});
export const accounts = sqliteTable('accounts', {
  id: text('id').primaryKey(),
  username: text('username').notNull().unique(),
  password: text('password').notNull(),
  recovery: text('recovery').notNull(),
  createdAt: integer('created_at').notNull(),
});
export const sessions = sqliteTable('account_sessions', {
  token: text('token').primaryKey(),
  accountId: text('account_id')
    .notNull()
    .references(() => accounts.id, { onDelete: 'cascade' }),
  expires: integer('expires').notNull(),
});
export const accountDocuments = sqliteTable('account_documents', {
  id: text('id').primaryKey(),
  accountId: text('account_id')
    .notNull()
    .references(() => accounts.id, { onDelete: 'cascade' }),
  key: text('key').notNull(),
  data: text('data').notNull(),
  revision: integer('revision').notNull(),
  updatedAt: text('updated_at').notNull(),
});
export const authLimits = sqliteTable('auth_limits', {
  key: text('key').primaryKey(),
  count: integer('count').notNull(),
  expires: integer('expires').notNull(),
});
export const legacyClaim = sqliteTable('legacy_claim', {
  id: text('id').primaryKey(),
  accountId: text('account_id')
    .notNull()
    .references(() => accounts.id, { onDelete: 'cascade' }),
});
export const inferenceSessions = sqliteTable('inference_sessions', {
  id: text('id').primaryKey(),
  accountId: text('account_id')
    .notNull()
    .references(() => accounts.id, { onDelete: 'cascade' }),
  agentId: text('agent_id').notNull(),
  busyUntil: integer('busy_until').notNull().default(0),
  lease: text('lease').notNull().default(''),
  jobId: text('job_id').notNull().default(''),
  runId: text('run_id').notNull().default(''),
  previousRunId: text('previous_run_id').notNull().default(''),
});
export const inferenceReplies = sqliteTable('inference_replies', {
  id: text('id').primaryKey(),
  accountId: text('account_id')
    .notNull()
    .references(() => accounts.id, { onDelete: 'cascade' }),
  result: text('result').notNull(),
  createdAt: integer('created_at').notNull(),
});
