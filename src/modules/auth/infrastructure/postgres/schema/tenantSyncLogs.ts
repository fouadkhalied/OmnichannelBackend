import { pgTable, uuid, text, timestamp, integer } from "drizzle-orm/pg-core";
import { tenants } from "./tenants";

export const tenantSyncLogs = pgTable("tenant_sync_logs", {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    status: text("status").notNull(), // success | failed | in_progress
    productsSynced: integer("products_synced").default(0),
    productsDeleted: integer("products_deleted").default(0),
    durationMs: integer("duration_ms"),
    syncedAt: timestamp("synced_at").defaultNow().notNull(),
});

export type TenantSyncLog = typeof tenantSyncLogs.$inferSelect;
export type NewTenantSyncLog = typeof tenantSyncLogs.$inferInsert;
