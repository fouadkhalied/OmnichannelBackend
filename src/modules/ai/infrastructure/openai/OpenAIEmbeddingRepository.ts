import { IEmbeddingRepository } from "../../domain/repositories/IEmbeddingRepository";
import { env } from "../../../../config/env";
import { logger } from "../../../../libs/common/logger";
import crypto from "crypto";

export class OpenAIEmbeddingRepository implements IEmbeddingRepository {
    async generateEmbedding(input: { text: string; model?: string }): Promise<{
        vector: number[];
        dimension: number;
        model: string;
        usedFallback: boolean;
    }> {
        const model = input.model || env.OPENAI_EMBEDDING_MODEL || "text-embedding-3-small";
        const apiKey = env.OPENAI_API_KEY;

        try {
            const response = await fetch("https://api.openai.com/v1/embeddings", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${apiKey}`,
                },
                body: JSON.stringify({
                    input: input.text,
                    model: model,
                }),
            });

            if (!response.ok) {
                const errorData = await response.json() as any;
                throw new Error(`OpenAI Error: ${errorData.error?.message || response.statusText}`);
            }

            const result = await response.json() as any;
            return {
                vector: result.data[0].embedding,
                dimension: result.data[0].embedding.length,
                model: model,
                usedFallback: false,
            };
        } catch (error: any) {
            logger.warn("embedding.fallback_used", { error: error.message, text: input.text.substring(0, 50) });

            // Fallback: SHA-256 deterministic hash to float array (1536 dimension)
            const vector = this.generateDeterministicHash(input.text, 1536);
            return {
                vector,
                dimension: 1536,
                model: "deterministic-hash-v1",
                usedFallback: true,
            };
        }
    }

    private generateDeterministicHash(text: string, dimension: number): number[] {
        const hash = crypto.createHash("sha256").update(text).digest();
        const vector: number[] = [];
        for (let i = 0; i < dimension; i++) {
            // Use bytes of hash cyclically to fill the vector
            const byte1 = hash[i % hash.length];
            const byte2 = hash[(i + 1) % hash.length];
            const val = ((byte1 << 8) | byte2) / 65535; // Map to 0-1
            vector.push(val * 2 - 1); // Map to -1 to 1
        }
        return vector;
    }

    async describeImage(input: { imageUrl: string; model?: string }): Promise<{
        descriptors: string[];
        description: string;
        provider: string;
        model: string;
    }> {
        const model = input.model || env.OPENAI_VISION_MODEL || "gpt-4o";
        const apiKey = env.OPENAI_API_KEY;

        const response = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                model: model,
                messages: [
                    {
                        role: "system",
                        content: "Extract visual search descriptors for this product image. Focus on: colors, materials, style, category, and use case. Return a short description and a list of key descriptors.",
                    },
                    {
                        role: "user",
                        content: [
                            { type: "text", text: "Analyze this image." },
                            {
                                type: "image_url",
                                image_url: { url: input.imageUrl },
                            },
                        ],
                    },
                ],
                response_format: { type: "json_object" }, // Assuming the model supports it or I'll handle raw text
            }),
        });

        if (!response.ok) {
            const errorData = await response.json() as any;
            throw new Error(`OpenAI Vision Error: ${errorData.error?.message || response.statusText}`);
        }

        const result = await response.json() as any;
        const content = JSON.parse(result.choices[0].message.content);

        return {
            descriptors: content.descriptors || [],
            description: content.description || "",
            provider: "openai",
            model: model,
        };
    }
}
