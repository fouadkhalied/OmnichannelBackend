import { eq, and } from "drizzle-orm";
import { embeddings, Embedding, NewEmbedding } from "../schema/embeddings";
import { IPgEmbeddingRepository } from "./IPgEmbeddingRepository";

export class PgEmbeddingRepository implements IPgEmbeddingRepository {
    constructor(private readonly db: any) { }

    async upsert(input: NewEmbedding): Promise<void> {
        await this.db
            .insert(embeddings)
            .values(input)
            .onConflictDoUpdate({
                target: [embeddings.storeId, embeddings.documentId, embeddings.chunkId],
                set: {
                    embedding: input.embedding,
                    text: input.text,
                    model: input.model,
                    metadata: input.metadata,
                },
            });
    }

    async findByDocAndChunk(storeId: string, documentId: string, chunkId: string): Promise<Embedding | null> {
        const [result] = await this.db
            .select()
            .from(embeddings)
            .where(and(
                eq(embeddings.storeId, storeId),
                eq(embeddings.documentId, documentId),
                eq(embeddings.chunkId, chunkId)
            ))
            .limit(1);
        return result || null;
    }

    async deleteByStore(storeId: string): Promise<void> {
        await this.db
            .delete(embeddings)
            .where(eq(embeddings.storeId, storeId));
    }
}
