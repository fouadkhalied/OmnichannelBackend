import { pgTable, uuid, text, timestamp, index } from "drizzle-orm/pg-core";
import { organizations } from "./organizations";

export const n8nInstances = pgTable("n8n_instances", {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id").notNull().references(() => organizations.id),
    n8nSpaceUrl: text("n8n_space_url").notNull(),
    n8nApiKeyEnc: text("n8n_api_key_enc").notNull(),
    n8nWebhookSecret: text("n8n_webhook_secret").notNull(),
    status: text("status").notNull().default("active"), // provisioning | active | error | suspended
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => ({
    orgIdx: index("idx_n8n_org").on(t.organizationId),
}));

export type N8nInstance = typeof n8nInstances.$inferSelect;
export type NewN8nInstance = typeof n8nInstances.$inferInsert;
