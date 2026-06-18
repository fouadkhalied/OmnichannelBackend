import { pgTable, uuid, text, timestamp, jsonb, index } from "drizzle-orm/pg-core";
import { stores } from "./stores";

export const syncJobs = pgTable("sync_jobs", {
    id: uuid("id").primaryKey().defaultRandom(),
    storeId: uuid("store_id").notNull().references(() => stores.id, { onDelete: "cascade" }),
    organizationId: uuid("organization_id").notNull(),
    type: text("type").notNull(), // full | reconciliation
    status: text("status").notNull().default("pending"), // pending | running | completed | failed
    progress: jsonb("progress"),
    error: text("error"),
    startedAt: timestamp("started_at"),
    finishedAt: timestamp("finished_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => ({
    storeIdx: index("idx_sync_jobs_store").on(t.storeId),
    statusIdx: index("idx_sync_jobs_status").on(t.status),
}));

export type SyncJob = typeof syncJobs.$inferSelect;
export type NewSyncJob = typeof syncJobs.$inferInsert;
