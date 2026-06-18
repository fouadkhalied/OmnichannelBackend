import { Embedding, NewEmbedding } from "../schema/embeddings";

export interface IPgEmbeddingRepository {
    upsert(input: NewEmbedding): Promise<void>;
    findByDocAndChunk(storeId: string, documentId: string, chunkId: string): Promise<Embedding | null>;
    deleteByStore(storeId: string): Promise<void>;
}
