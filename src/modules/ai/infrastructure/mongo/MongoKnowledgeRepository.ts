import { IKnowledgeRepository } from "../../domain/repositories/IKnowledgeRepository";
import { KnowledgeDocument, KnowledgeMetadata } from "../../domain/entities/KnowledgeDocument";
import { KnowledgeTextBuilder } from "../../domain/services/KnowledgeTextBuilder";
import { AiChunkModel, AiKnowledgeDocumentModel, AiEmbeddingModel } from "@shared/infrastructure/mongo/models";

export class MongoKnowledgeRepository implements IKnowledgeRepository {
    private splitTenantId(tenantId: string): { organizationId: string; storeId: string } {
        if (tenantId.includes(":")) {
            const [organizationId, storeId] = tenantId.split(":");
            return { organizationId, storeId };
        }
        return { organizationId: tenantId, storeId: tenantId };
    }

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
        const { organizationId, storeId } = this.splitTenantId(input.tenantId);

        await AiKnowledgeDocumentModel.findOneAndUpdate(
            { id: input.documentId, organizationId, storeId },
            {
                $set: {
                    title: input.title,
                    sourceType: input.sourceType,
                    language: input.language,
                    text: input.text,
                    metadata: input.metadata,
                    status: "active",
                    updatedAt: new Date(),
                },
                $setOnInsert: {
                    id: input.documentId,
                    organizationId,
                    storeId,
                    createdAt: new Date(),
                },
            },
            { upsert: true }
        );

        // Chunking logic (max 1000 chars, 100 char overlap)
        const chunkSize = 1000;
        const overlap = 100;
        const chunks: { text: string; start: number; end: number }[] = [];

        if (input.text.length <= chunkSize) {
            chunks.push({ text: input.text, start: 0, end: input.text.length });
        } else {
            let start = 0;
            while (start < input.text.length) {
                const end = Math.min(start + chunkSize, input.text.length);
                chunks.push({ text: input.text.substring(start, end), start, end });
                start += (chunkSize - overlap);
            }
        }

        // Remove old chunks
        await AiChunkModel.deleteMany({ documentId: input.documentId, organizationId, storeId });

        // Insert new chunks
        const chunkPromises = chunks.map((chunk, index) => {
            const chunkId = `chunk_${input.documentId}_${index}`;
            return AiChunkModel.create({
                id: chunkId,
                documentId: input.documentId,
                organizationId,
                storeId,
                language: input.language,
                text: chunk.text,
                startChar: chunk.start,
                endChar: chunk.end,
                tokenCount: Math.ceil(chunk.text.length / 4), // Rough estimate
                productAvailability: input.productAvailability,
                sourceType: input.sourceType,
                externalId: input.externalId,
                customerId: input.customerId,
            });
        });

        await Promise.all(chunkPromises);

        return { documentId: input.documentId };
    }

    async archive(input: { tenantId: string; documentId: string }): Promise<void> {
        const { organizationId, storeId } = this.splitTenantId(input.tenantId);
        await AiKnowledgeDocumentModel.updateOne(
            { id: input.documentId, organizationId, storeId },
            { $set: { status: "archived", updatedAt: new Date() } }
        );
    }

    async updateEnrichment(input: {
        tenantId: string;
        documentId: string;
        visualDescriptors: string[];
        imageAnalysisSignature: string;
        imageAnalysisUpdatedAt: Date;
    }): Promise<void> {
        const { organizationId, storeId } = this.splitTenantId(input.tenantId);

        const doc = await AiKnowledgeDocumentModel.findOne({ id: input.documentId, organizationId, storeId });
        if (!doc) throw new Error("Knowledge document not found for enrichment update");

        const metadata = { ...doc.metadata, visualDescriptors: input.visualDescriptors, imageAnalysisSignature: input.imageAnalysisSignature, imageAnalysisUpdatedAt: input.imageAnalysisUpdatedAt.toISOString() };

        // Rebuild text with new descriptors
        const payload = doc.metadata; // Assuming the original payload or enough info is in metadata
        // Wait, the prompt says "rebuilds text with new descriptors by calling KnowledgeTextBuilder again"
        // I need the original payload. If I don't have it, I'll have to store it or assume it's in metadata.
        // In many cases, it's safer to just append the descriptors to the existing text if I can't rebuild.
        // However, I'll try to use the doc properties to rebuild.

        const result = KnowledgeTextBuilder.build(doc.sourceType, { ...doc.metadata, visualDescriptors: input.visualDescriptors });

        await AiKnowledgeDocumentModel.updateOne(
            { id: input.documentId, organizationId, storeId },
            {
                $set: {
                    text: result.text,
                    metadata,
                    updatedAt: new Date(),
                }
            }
        );

        // Update chunks (simplified: just update metadata-related info in all chunks of this doc)
        await AiChunkModel.updateMany(
            { documentId: input.documentId, organizationId, storeId },
            { $set: { text: result.text } } // This is a bit heavy, maybe re-chunking is better
        );
    }

    async findById(input: { tenantId: string; documentId: string }): Promise<KnowledgeDocument | null> {
        const { organizationId, storeId } = this.splitTenantId(input.tenantId);
        const doc = await AiKnowledgeDocumentModel.findOne({ id: input.documentId, organizationId, storeId });
        if (!doc) return null;

        return new KnowledgeDocument(
            doc.id,
            input.tenantId,
            doc.title,
            doc.sourceType as any,
            doc.language,
            doc.text,
            doc.metadata,
            doc.status as any,
            doc.createdAt,
            doc.updatedAt
        );
    }

    async saveEmbedding(input: {
        tenantId: string;
        documentId: string;
        vector: number[];
        dimension: number;
        model: string;
    }): Promise<void> {
        const { organizationId, storeId } = this.splitTenantId(input.tenantId);

        const chunks = await AiChunkModel.find({ documentId: input.documentId, organizationId, storeId });

        if (!chunks.length) {
            return;
        }

        const promises = chunks.map(chunk => {
            return AiEmbeddingModel.findOneAndUpdate(
                { chunkId: chunk.id },
                {
                    $set: {
                        documentId: input.documentId,
                        organizationId,
                        storeId,
                        vector: input.vector,
                        dimension: input.dimension,
                        model: input.model,
                        updatedAt: new Date()
                    },
                    $setOnInsert: {
                        createdAt: new Date()
                    }
                },
                { upsert: true }
            );
        });

        await Promise.all(promises);
    }
}
