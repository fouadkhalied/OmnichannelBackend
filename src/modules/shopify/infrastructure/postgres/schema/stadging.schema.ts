import { boolean, jsonb, text, timestamp, pgTable, uniqueIndex } from "drizzle-orm/pg-core";

export const shopifyStaging = pgTable("shopify_staging", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull(),
  entityType: text("entity_type").notNull(),
  externalId: text("external_id").notNull(),
  parentExternalId: text("parent_external_id"),
  payload: jsonb("payload").notNull(),
  payloadHash: text("payload_hash").notNull(),
  deleted: boolean("deleted").default(false).notNull(),
  shopifyUpdatedAt: timestamp("shopify_updated_at"),
  embedStatus: text("embed_status").default("pending").notNull(),
  enrichStatus: text("enrich_status").default("skip").notNull(),
  knowledgeDocumentId: text("knowledge_document_id"),
  imageSignature: text("image_signature"),
  embedError: text("embed_error"),
  enrichError: text("enrich_error"),
  lastEmbeddedAt: timestamp("last_embedded_at"),
  lastEnrichedAt: timestamp("last_enriched_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => {
  return {
    uniqueExternalId: uniqueIndex("shopify_staging_unique_external_id").on(
      table.tenantId,
      table.entityType,
      table.externalId
    ),
  };
});

export type StagingRow = typeof shopifyStaging.$inferSelect;
export type InsertStagingRow = typeof shopifyStaging.$inferInsert;
