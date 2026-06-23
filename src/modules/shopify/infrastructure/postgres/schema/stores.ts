import { pgTable, uuid, text, timestamp, index, unique } from "drizzle-orm/pg-core"; // ← unique from here
import { organizations } from "../../../../../libs/shared/infrastructure/postgres/schema/organizations";

export const stores = pgTable("stores", {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    platform: text("platform").notNull().default("shopify"),
    storeUrl: text("store_url").notNull(),
    shopifyClientId: text("shopify_client_id"),
    shopifyClientSecret: text("shopify_client_secret"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
    orgIdx: index("stores_organization_id_idx").on(table.organizationId),
    uniqueOrgStore: unique("uq_stores_org_store_url").on(table.organizationId, table.storeUrl), // ← add this
}));

export type Store = typeof stores.$inferSelect;
export type NewStore = typeof stores.$inferInsert;
