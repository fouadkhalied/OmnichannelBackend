export interface IEmbeddingRepository {
    generateEmbedding(input: {
        text: string;
        model?: string;
    }): Promise<{
        vector: number[];
        dimension: number;
        model: string;
        usedFallback: boolean;
    }>;

    describeImage(input: {
        imageUrl: string;
        model?: string;
    }): Promise<{
        descriptors: string[];
        description: string;
        provider: string;
        model: string;
    }>;
}
