import { pgTable, uuid, text, timestamp, index, unique } from "drizzle-orm/pg-core";
import { stores } from "../../../../../modules/auth/infrastructure/postgres/schema/stores";

export const policies = pgTable("policies", {
    id: uuid("id").primaryKey().defaultRandom(),
    storeId: uuid("store_id").notNull().references(() => stores.id, { onDelete: "cascade" }),
    type: text("type").notNull(), // shipping_policy | refund_policy | etc
    title: text("title").notNull(),
    body: text("body").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => ({
    storeIdx: index("idx_policies_store").on(t.storeId),
    uniqueConstraint: unique("uq_policies_store_type").on(t.storeId, t.type),
}));

export type Policy = typeof policies.$inferSelect;
export type NewPolicy = typeof policies.$inferInsert;
