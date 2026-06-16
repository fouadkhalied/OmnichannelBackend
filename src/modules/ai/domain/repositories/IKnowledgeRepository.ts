import { KnowledgeDocument, KnowledgeMetadata } from "../entities/KnowledgeDocument";

export interface IKnowledgeRepository {
    upsert(input: {
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
    }): Promise<{ documentId: string }>;

    archive(input: {
        tenantId: string;
        documentId: string;
    }): Promise<void>;

    updateEnrichment(input: {
        tenantId: string;
        documentId: string;
        visualDescriptors: string[];
        imageAnalysisSignature: string;
        imageAnalysisUpdatedAt: Date;
    }): Promise<void>;

    findById(input: {
        tenantId: string;
        documentId: string;
    }): Promise<KnowledgeDocument | null>;

    saveEmbedding(input: {
        tenantId: string;
        documentId: string;
        vector: number[];
        dimension: number;
        model: string;
    }): Promise<void>;
}
