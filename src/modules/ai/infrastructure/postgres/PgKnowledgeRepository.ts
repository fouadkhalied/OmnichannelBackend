import { eq } from "drizzle-orm";
import { IKnowledgeRepository } from "../../domain/repositories/IKnowledgeRepository";
import { embeddings } from "../../../../libs/shared/infrastructure/postgres/schema/embeddings";
import { KnowledgeDocument, KnowledgeMetadata } from "../../domain/entities/KnowledgeDocument";

export class PgKnowledgeRepository implements IKnowledgeRepository {
    constructor(private readonly db: any) { }

    async upsert(input: {
        tenantId: string;
        documentId: string;
        title: string;
        text: string;
        language: string;
        sourceType: string;
        metadata: KnowledgeMetadata;
        productAvailability: boolean;
        externalId: string;
        customerId: string | null;
    }): Promise<{ documentId: string }> {
        return { documentId: input.documentId };
    }

    async archive(input: {
        tenantId: string;
        documentId: string;
    }): Promise<void> {
        await this.db.delete(embeddings).where(eq(embeddings.documentId, input.documentId));
    }

    async updateEnrichment(input: {
        tenantId: string;
        documentId: string;
        visualDescriptors: string[];
        imageAnalysisSignature: string;
        imageAnalysisUpdatedAt: Date;
    }): Promise<void> {
        // Implementation for enrichment update in Postgres
    }

    async findById(input: {
        tenantId: string;
        documentId: string;
    }): Promise<KnowledgeDocument | null> {
        const [result] = await this.db
            .select()
            .from(embeddings)
            .where(eq(embeddings.documentId, input.documentId))
            .limit(1);

        if (!result) return null;

        return {
            id: result.documentId,
            tenantId: input.tenantId,
            documentId: result.documentId,
            title: "",
            text: result.text,
            language: "en",
            sourceType: "shopify",
            metadata: result.metadata ? JSON.parse(result.metadata) : {},
            createdAt: result.createdAt,
            updatedAt: result.createdAt,
        } as any;
    }

    async saveEmbedding(input: {
        tenantId: string;
        documentId: string;
        vector: number[];
        dimension: number;
        model: string;
    }): Promise<void> {
        const storeId = input.tenantId.split(":")[1];

        await this.db.insert(embeddings).values({
            storeId,
            documentId: input.documentId,
            chunkId: "root",
            text: "",
            embedding: input.vector,
            model: input.model,
            metadata: JSON.stringify({}),
        }).onConflictDoUpdate({
            target: [embeddings.id], // or documentId/chunkId if unique index exists
            set: {
                embedding: input.vector,
                model: input.model,
            }
        });
    }
}
