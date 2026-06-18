import { pgTable, uuid, text, jsonb, timestamp, index, unique } from "drizzle-orm/pg-core";
import { stores } from "./stores";

export const customers = pgTable("customers", {
    id: uuid("id").primaryKey().defaultRandom(),
    storeId: uuid("store_id").notNull().references(() => stores.id, { onDelete: "cascade" }),
    shopifyId: text("shopify_id").notNull(),
    email: text("email"),
    phone: text("phone"),
    firstName: text("first_name"),
    lastName: text("last_name"),
    ordersCount: text("orders_count"),
    totalSpent: text("total_spent"),
    tags: text("tags").array(),
    data: jsonb("data").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
    shopifyCreatedAt: timestamp("shopify_created_at"),
}, (t) => ({
    storeIdx: index("idx_customers_store").on(t.storeId),
    shopifyIdIdx: index("idx_customers_shopify_id").on(t.shopifyId),
    uniqueConstraint: unique("uq_customers_store_shopify").on(t.storeId, t.shopifyId),
}));

export type Customer = typeof customers.$inferSelect;
export type NewCustomer = typeof customers.$inferInsert;
