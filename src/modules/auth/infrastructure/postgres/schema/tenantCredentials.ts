import { pgTable, uuid, text, timestamp, index } from "drizzle-orm/pg-core";
import { organizations } from "../../../../../libs/shared/infrastructure/postgres/schema/organizations";

export const tenantCredentials = pgTable("tenant_credentials", {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),

    // n8n Credentials (Encrypted)
    n8nApiKeyEncrypted: text("n8n_api_key_encrypted").notNull(),
    n8nWebhookSecretEnc: text("n8n_webhook_secret_enc").notNull(),
    n8nEncryptionKeyEnc: text("n8n_encryption_key_enc"),

    // Security
    iv: text("iv").notNull(),

    // n8n Metadata
    n8nBaseUrl: text("n8n_base_url"),
    plan: text("plan").default("free"),

    // Vector Metadata
    vectorDbUrl: text("vector_db_url"),

    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => ({
    orgIdx: index("idx_tenant_creds_org").on(t.organizationId),
}));

export type TenantCredential = typeof tenantCredentials.$inferSelect;
export type NewTenantCredential = typeof tenantCredentials.$inferInsert;
