/**
 * apps/api/src/db/schema.ts
 *
 * Drizzle ORM schema for analysis sessions and persisted SSE events.
 * SQLite is used for local development; swap the driver for Postgres in production.
 */

import { sqliteTable, text, integer, primaryKey } from "drizzle-orm/sqlite-core";

export const sessions = sqliteTable("sessions", {
  id: text("id").primaryKey(),
  ticker: text("ticker").notNull(),
  analysisDate: text("analysis_date").notNull(),
  status: text("status").notNull(),
  config: text("config", { mode: "json" }).notNull(),
  runId: text("run_id"),
  reportMarkdown: text("report_markdown"),
  reportSections: text("report_sections", { mode: "json" }),
  decision: text("decision"),
  error: text("error"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
});

export const events = sqliteTable("events", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  sessionId: text("session_id")
    .notNull()
    .references(() => sessions.id),
  type: text("type").notNull(),
  payload: text("payload", { mode: "json" }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
});

export const userCredentials = sqliteTable(
  "user_credentials",
  {
    userId: text("user_id").notNull(),
    providerId: text("provider_id").notNull(),
    fieldName: text("field_name").notNull(),
    fieldValue: text("field_value").notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.userId, table.providerId, table.fieldName],
    }),
  ],
);

export type SessionRow = typeof sessions.$inferSelect;
export type NewSessionRow = typeof sessions.$inferInsert;
export type EventRow = typeof events.$inferSelect;
export type UserCredentialRow = typeof userCredentials.$inferSelect;
