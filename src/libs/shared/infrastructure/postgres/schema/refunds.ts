import { pgTable, uuid, text, jsonb, timestamp, numeric, index, unique } from "drizzle-orm/pg-core";
import { stores } from "./stores";
import { orders } from "./orders";

export const refunds = pgTable("refunds", {
    id: uuid("id").primaryKey().defaultRandom(),
    storeId: uuid("store_id").notNull().references(() => stores.id, { onDelete: "cascade" }),
    orderId: uuid("order_id").notNull().references(() => orders.id, { onDelete: "cascade" }),
    shopifyId: text("shopify_id").notNull(),
    totalRefunded: numeric("total_refunded", { precision: 15, scale: 2 }).notNull(),
    currency: text("currency"),
    data: jsonb("data").notNull(),
    shopifyCreatedAt: timestamp("shopify_created_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => ({
    storeIdx: index("idx_refunds_store").on(t.storeId),
    orderIdx: index("idx_refunds_order").on(t.orderId),
}));

export type Refund = typeof refunds.$inferSelect;
export type NewRefund = typeof refunds.$inferInsert;
