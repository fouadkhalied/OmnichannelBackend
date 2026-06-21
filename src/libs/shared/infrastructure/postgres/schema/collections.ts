import { pgTable, uuid, text, jsonb, timestamp, index, unique } from "drizzle-orm/pg-core";
import { stores } from "../../../../../modules/auth/infrastructure/postgres/schema/stores";

export const collections = pgTable("collections", {
    id: uuid("id").primaryKey().defaultRandom(),
    storeId: uuid("store_id").notNull().references(() => stores.id, { onDelete: "cascade" }),
    shopifyId: text("shopify_id").notNull(),
    handle: text("handle"),
    title: text("title").notNull(),
    descriptionHtml: text("description_html"),
    data: jsonb("data").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
    shopifyUpdatedAt: timestamp("shopify_updated_at"),
}, (t) => ({
    storeIdx: index("idx_collections_store").on(t.storeId),
    shopifyIdIdx: index("idx_collections_shopify_id").on(t.shopifyId),
    uniqueConstraint: unique("uq_collections_store_shopify").on(t.storeId, t.shopifyId),
}));

export type Collection = typeof collections.$inferSelect;
export type NewCollection = typeof collections.$inferInsert;
