import { pgTable, uuid, text, timestamp } from "drizzle-orm/pg-core";
import { tenants } from "./tenants";

export const tenantN8n = pgTable("tenant_n8n", {
    tenantId: uuid("tenant_id").primaryKey().references(() => tenants.id, { onDelete: "cascade" }),

    // Cloud Infrastructure
    neonBranchId: text("neon_branch_id"),
    neonConnectionStringEncrypted: text("neon_connection_string_encrypted"),
    hfTokenEncrypted: text("hf_token_encrypted"),

    // n8n Management
    n8nApiKeyEncrypted: text("n8n_api_key_encrypted"),
    n8nOwnerPasswordEncrypted: text("n8n_owner_password_encrypted"),
    n8nEncryptionKeyVaultRef: text("n8n_encryption_key_vault_ref"),

    // n8n Application Credentials (IDs in n8n)
    n8nShopifyCredentialId: text("n8n_shopify_credential_id"),
    n8nOpenaiCredentialId: text("n8n_openai_credential_id"),
    n8nBackendCredentialId: text("n8n_backend_credential_id"),

    // Per-Tenant Provider Keys (Encrypted)
    openaiApiKeyEncrypted: text("openai_api_key_encrypted"),
    shopifyWebhookSecretEncrypted: text("shopify_webhook_secret_encrypted"),
    shopifyAppClientIdEncrypted: text("shopify_app_client_id_encrypted"),
    shopifyAppClientSecretEncrypted: text("shopify_app_client_secret_encrypted"),

    iv: text("iv").notNull(), // Initialization Vector for all fields in this row
    containerStatus: text("container_status").default("creating"),

    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type TenantN8n = typeof tenantN8n.$inferSelect;
export type NewTenantN8n = typeof tenantN8n.$inferInsert;
