import { pgTable, varchar, jsonb, text, integer, timestamp, uuid, index } from "drizzle-orm/pg-core";
import { stores } from "../../../../../libs/shared/infrastructure/postgres/schema/stores";

export const syncJobs = pgTable("sync_jobs", {
  id: varchar("id").primaryKey(),
  storeId: uuid("store_id").notNull().references(() => stores.id, { onDelete: "cascade" }),
  provider: varchar("provider").default("shopify").notNull(),
  type: varchar("type").notNull(),
  status: varchar("status").default("pending").notNull(),
  progress: jsonb("progress").default({}).notNull(),
  cursor: jsonb("cursor"),
  triggeredBy: text("triggered_by"),
  attempts: integer("attempts").default(0).notNull(),
  maxAttempts: integer("max_attempts").default(5).notNull(),
  error: text("error"),
  startedAt: timestamp("started_at"),
  finishedAt: timestamp("finished_at"),
  nextRunAt: timestamp("next_run_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => ({
  storeIdx: index("idx_sync_jobs_store").on(t.storeId),
}));

export const playingWithNeon = pgTable("playing_with_neon", {
  id: integer("id").primaryKey().notNull(),
  name: text("name").notNull(),
  value: text("value"),
});

export type SyncJobRow = typeof syncJobs.$inferSelect;
export type InsertSyncJobRow = typeof syncJobs.$inferInsert;
