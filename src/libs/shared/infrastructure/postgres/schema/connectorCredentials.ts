import { pgTable, uuid, text, timestamp, index, unique } from "drizzle-orm/pg-core";
import { organizations } from "./organizations";
import { stores } from "../../../../../modules/shopify/infrastructure/postgres/schema/stores";

export const connectorCredentials = pgTable("connector_credentials", {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id").notNull().references(() => organizations.id),
    storeId: uuid("store_id").notNull().references(() => stores.id),
    shopDomain: text("shop_domain").notNull(),
    provider: text("provider").notNull().default("shopify"),
    clientId: text("client_id").notNull(),
    apiVersion: text("api_version").notNull(),
    scopes: text("scopes"),
    vectorDbUrl: text("vector_db_url"),
    phoneNumberId: text("phone_number_id"),

    // Encrypted blob: { accessToken, clientSecret, webhookSecret }
    encryptedCredentials: text("encrypted_credentials").notNull(),

    status: text("status").notNull().default("active"), // active | error | disconnected
    errorMessage: text("error_message"),
    lastWebhookAt: timestamp("last_webhook_at"),
    lastSyncAt: timestamp("last_sync_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => ({
    orgIdx: index("idx_credentials_org").on(t.organizationId),
    storeIdx: index("idx_credentials_store").on(t.storeId),
    shopDomainIdx: index("idx_credentials_shop_domain").on(t.shopDomain),
    uniqueOrgStore: unique("uq_credentials_org_store").on(t.organizationId, t.storeId),
}));

export type ConnectorCredential = typeof connectorCredentials.$inferSelect;
export type NewConnectorCredential = typeof connectorCredentials.$inferInsert;
