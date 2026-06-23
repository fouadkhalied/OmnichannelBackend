import { pgTable, uuid, text, timestamp, jsonb, index, integer } from "drizzle-orm/pg-core";
import { stores } from "../../../../../modules/shopify/infrastructure/postgres/schema/stores";

export const syncJobs = pgTable("sync_jobs", {
    id: text("id").primaryKey(),
    storeId: uuid("store_id").notNull().references(() => stores.id, { onDelete: "cascade" }),
    organizationId: uuid("organization_id").notNull(),
    provider: text("provider").default("shopify").notNull(),
    type: text("type").notNull(), // full | reconciliation
    status: text("status").notNull().default("pending"), // pending | running | completed | failed
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
    statusIdx: index("idx_sync_jobs_status").on(t.status),
}));

export type SyncJob = typeof syncJobs.$inferSelect;
export type NewSyncJob = typeof syncJobs.$inferInsert;
