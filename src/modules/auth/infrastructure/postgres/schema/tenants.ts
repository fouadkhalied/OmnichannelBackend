import { pgTable, uuid, text, timestamp, boolean } from "drizzle-orm/pg-core";

export const tenants = pgTable("tenants", {
    id: uuid("id").primaryKey().defaultRandom(),
    companyName: text("company_name").notNull(),
    adminEmail: text("admin_email").notNull().unique(),
    passwordHash: text("password_hash").notNull(),
    plan: text("plan").notNull().default("free"),
    shopDomain: text("shop_domain"),
    hfSpaceName: text("hf_space_name"),
    hfSpaceUrl: text("hf_space_url"),
    n8nBaseUrl: text("n8n_base_url"),
    n8nIngestionWorkflowId: text("n8n_ingestion_workflow_id"),
    n8nChatWorkflowId: text("n8n_chat_workflow_id"),
    isActive: boolean("is_active").default(true),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type Tenant = typeof tenants.$inferSelect;
export type NewTenant = typeof tenants.$inferInsert;
