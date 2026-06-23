import { boolean, jsonb, text, timestamp, pgTable, uuid, index, unique } from "drizzle-orm/pg-core";
import { stores } from "./stores";

export const shopifyStaging = pgTable("shopify_staging", {
  id: uuid("id").primaryKey().defaultRandom(),
  storeId: uuid("store_id").notNull().references(() => stores.id, { onDelete: "cascade" }),
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
    storeIdx: index("idx_staging_store").on(table.storeId),
    uniqueConstraint: unique("uq_staging_store_type_ext").on(
      table.storeId,
      table.entityType,
      table.externalId
    ),
  };
});

export type StagingRow = typeof shopifyStaging.$inferSelect;
export type InsertStagingRow = typeof shopifyStaging.$inferInsert;
