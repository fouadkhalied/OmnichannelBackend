import { pgTable, uuid, text, jsonb, timestamp, index, unique, numeric, integer } from "drizzle-orm/pg-core";
import { stores } from "./stores";
import { products } from "./products";

export const variants = pgTable("variants", {
    id: uuid("id").primaryKey().defaultRandom(),
    storeId: uuid("store_id").notNull().references(() => stores.id, { onDelete: "cascade" }),
    productId: uuid("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
    shopifyId: text("shopify_id").notNull(),
    title: text("title"),
    sku: text("sku"),
    price: numeric("price", { precision: 15, scale: 2 }),
    compareAtPrice: numeric("compare_at_price", { precision: 15, scale: 2 }),
    inventoryQuantity: integer("inventory_quantity"),
    data: jsonb("data").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
    shopifyCreatedAt: timestamp("shopify_created_at"),
    shopifyUpdatedAt: timestamp("shopify_updated_at"),
}, (t) => ({
    storeIdx: index("idx_variants_store").on(t.storeId),
    productIdx: index("idx_variants_product").on(t.productId),
    shopifyIdIdx: index("idx_variants_shopify_id").on(t.shopifyId),
    uniqueConstraint: unique("uq_variants_store_shopify").on(t.storeId, t.shopifyId),
}));

export type Variant = typeof variants.$inferSelect;
export type NewVariant = typeof variants.$inferInsert;
