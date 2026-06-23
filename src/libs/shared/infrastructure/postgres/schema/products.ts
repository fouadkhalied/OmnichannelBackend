import { pgTable, uuid, text, jsonb, timestamp, index, unique } from "drizzle-orm/pg-core";
import { stores } from "../../../../../modules/shopify/infrastructure/postgres/schema/stores";

export const products = pgTable("products", {
    id: uuid("id").primaryKey().defaultRandom(),
    storeId: uuid("store_id").notNull().references(() => stores.id, { onDelete: "cascade" }),
    shopifyId: text("shopify_id").notNull(),          // gid://shopify/Product/123
    handle: text("handle"),
    title: text("title"),
    vendor: text("vendor"),
    productType: text("product_type"),
    status: text("status"),                         // active | archived | draft
    descriptionHtml: text("description_html"),
    tags: text("tags").array(),
    data: jsonb("data").notNull(),                 // full raw Shopify payload

    // Diff check — hash of embeddable fields
    // Only re-embed when this changes
    contentHash: text("content_hash"),
    embeddingStatus: text("embedding_status").default("pending"), // pending | done | failed | skip
    lastEmbeddedAt: timestamp("last_embedded_at"),

    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
    shopifyCreatedAt: timestamp("shopify_created_at"),
    shopifyUpdatedAt: timestamp("shopify_updated_at"),
}, (t) => ({
    storeIdx: index("idx_products_store").on(t.storeId),
    shopifyIdIdx: index("idx_products_shopify_id").on(t.shopifyId),
    embeddingStatusIdx: index("idx_products_embedding_status").on(t.embeddingStatus),
    uniqueConstraint: unique("uq_products_store_shopify").on(t.storeId, t.shopifyId),
}));

export type Product = typeof products.$inferSelect;
export type NewProduct = typeof products.$inferInsert;
