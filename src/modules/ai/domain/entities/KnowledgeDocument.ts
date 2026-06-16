export type KnowledgeSourceType = "product" | "variant" | "customer" | "order" | "faq";

export type KnowledgeMetadata = {
    provider: "shopify";
    sourceType: string;
    externalId: string;
    customerId: string | null;
    // product specific
    imageCount?: number;
    primaryImageUrl?: string | null;
    imageUrls?: string[];
    visualDescriptors?: string[];
    visualSearchText?: string;
    imageAnalysisSignature?: string;
    imageAnalysisUpdatedAt?: string;
    productAvailability?: boolean;
};

export class KnowledgeDocument {
    constructor(
        public readonly id: string, // deterministic: doc_shopify_{tenantId}_{entityType}_{externalId}
        public readonly tenantId: string,
        public readonly title: string,
        public readonly sourceType: KnowledgeSourceType,
        public readonly language: string,
        public readonly text: string,
        public readonly metadata: KnowledgeMetadata,
        public status: "active" | "archived",
        public readonly createdAt: Date,
        public readonly updatedAt: Date,
        public readonly embedding?: number[]
    ) { }
}
