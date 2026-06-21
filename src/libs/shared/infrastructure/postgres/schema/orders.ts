import { pgTable, uuid, text, jsonb, timestamp, index, unique, numeric } from "drizzle-orm/pg-core";
import { stores } from "../../../../../modules/auth/infrastructure/postgres/schema/stores";
import { customers } from "./customers";

export const orders = pgTable("orders", {
    id: uuid("id").primaryKey().defaultRandom(),
    storeId: uuid("store_id").notNull().references(() => stores.id, { onDelete: "cascade" }),
    shopifyId: text("shopify_id").notNull(),
    orderNumber: text("order_number"),
    customerId: uuid("customer_id").references(() => customers.id, { onDelete: "set null" }),
    shopifyCustomerId: text("shopify_customer_id"),
    email: text("email"),
    phone: text("phone"),

    financialStatus: text("financial_status"),             // paid | pending | refunded | partially_refunded
    fulfillmentStatus: text("fulfillment_status"),           // fulfilled | partial | unfulfilled | null
    cancelledAt: timestamp("cancelled_at"),
    cancelReason: text("cancel_reason"),

    totalPrice: numeric("total_price", { precision: 15, scale: 2 }),
    subtotalPrice: numeric("subtotal_price", { precision: 15, scale: 2 }),
    totalTax: numeric("total_tax", { precision: 15, scale: 2 }),
    currency: text("currency"),

    data: jsonb("data").notNull(),

    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
    shopifyCreatedAt: timestamp("shopify_created_at"),
    shopifyUpdatedAt: timestamp("shopify_updated_at"),
}, (t) => ({
    storeIdx: index("idx_orders_store").on(t.storeId),
    shopifyIdIdx: index("idx_orders_shopify_id").on(t.shopifyId),
    customerIdx: index("idx_orders_customer").on(t.customerId),
    statusIdx: index("idx_orders_status").on(t.storeId, t.fulfillmentStatus),
    uniqueConstraint: unique("uq_orders_store_shopify").on(t.storeId, t.shopifyId),
}));

export type Order = typeof orders.$inferSelect;
export type NewOrder = typeof orders.$inferInsert;
