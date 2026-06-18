import { pgTable, uuid, text, jsonb, timestamp, integer, numeric, index, unique } from "drizzle-orm/pg-core";
import { stores } from "./stores";
import { orders } from "./orders";

export const orderLineItems = pgTable("order_line_items", {
    id: uuid("id").primaryKey().defaultRandom(),
    storeId: uuid("store_id").notNull().references(() => stores.id, { onDelete: "cascade" }),
    orderId: uuid("order_id").notNull().references(() => orders.id, { onDelete: "cascade" }),
    shopifyId: text("shopify_id").notNull(),
    variantId: text("variant_id"),
    productId: text("product_id"),
    title: text("title").notNull(),
    quantity: integer("quantity").notNull(),
    price: numeric("price", { precision: 15, scale: 2 }).notNull(),
    sku: text("sku"),
    data: jsonb("data").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => ({
    storeIdx: index("idx_line_items_store").on(t.storeId),
    orderIdx: index("idx_line_items_order").on(t.orderId),
    uniqueConstraint: unique("uq_line_items_store_shopify").on(t.storeId, t.shopifyId),
}));

export type OrderLineItem = typeof orderLineItems.$inferSelect;
export type NewOrderLineItem = typeof orderLineItems.$inferInsert;
