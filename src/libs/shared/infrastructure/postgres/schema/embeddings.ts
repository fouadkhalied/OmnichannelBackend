import { pgTable, uuid, text, timestamp, index, vector } from "drizzle-orm/pg-core";
import { stores } from "./stores";

export const embeddings = pgTable("embeddings", {
    id: uuid("id").primaryKey().defaultRandom(),
    storeId: uuid("store_id").notNull().references(() => stores.id, { onDelete: "cascade" }),
    documentId: text("document_id").notNull(),
    chunkId: text("chunk_id").notNull(),
    text: text("text").notNull(),
    embedding: vector("embedding", { dimensions: 1536 }), // OpenAI standard
    model: text("model").notNull().default("text-embedding-3-small"),
    metadata: text("metadata"), // JSON string or text info
    createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => ({
    storeIdx: index("idx_embeddings_store").on(t.storeId),
    docIdx: index("idx_embeddings_doc").on(t.documentId),
    chunkIdx: index("idx_embeddings_chunk").on(t.chunkId),
}));

export type Embedding = typeof embeddings.$inferSelect;
export type NewEmbedding = typeof embeddings.$inferInsert;
