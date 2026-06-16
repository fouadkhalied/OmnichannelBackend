import { BaseService } from "../../../../../libs/shared/application/BaseService";
import { StagingRecord } from "../../../domain/repositories/IStagingRepository";
import { IStagingRepository } from "../../../domain/repositories/IStagingRepository";
import { IKnowledgeRepository } from "../../../../ai/domain/repositories/IKnowledgeRepository";
import { IEmbeddingRepository } from "../../../../ai/domain/repositories/IEmbeddingRepository";
import { KnowledgeTextBuilder } from "../../../../ai/domain/services/KnowledgeTextBuilder";
import { logger } from "../../../../../libs/common/logger";
import { TenantContext } from "../../../../../libs/shared/domain/valueObjects/TenantContext";

export class GenerateEmbeddingUseCase extends BaseService {
    constructor(
        tenantContext: TenantContext,
        private readonly stagingRepository: IStagingRepository,
        private readonly knowledgeRepository: IKnowledgeRepository,
        private readonly embeddingRepository: IEmbeddingRepository
    ) {
        super(tenantContext);
    }

    async execute(record: StagingRecord): Promise<{ archived: true } | { embedded: true; usedFallback: boolean }> {
        const documentId = `doc_shopify_${record.tenantId}_${record.entityType.getValue()}_${record.externalId}`;

        // ── Archive deleted entities ────────────────────────────────────────
        if (record.deleted) {
            await this.knowledgeRepository.archive({ tenantId: record.tenantId, documentId });
            await this.stagingRepository.markEmbedCompleted(record.id, documentId);
            logger.info("embedding.archived_deleted_entity", {
                recordId: record.id,
                documentId,
                tenantId: record.tenantId,
            });
            return { archived: true };
        }

        // ── Build knowledge text ────────────────────────────────────────────
        const knowledgeText = KnowledgeTextBuilder.build(
            record.entityType.getValue(),
            record.payload
        );

        // ── Upsert knowledge document into Mongo ────────────────────────────
        await this.knowledgeRepository.upsert({
            tenantId: record.tenantId,
            documentId,
            title: knowledgeText.title,
            text: knowledgeText.text,
            language: knowledgeText.language || "en",
            sourceType: knowledgeText.sourceType,
            metadata: {
                ...knowledgeText.metadata,
                provider: "shopify",
                sourceType: record.entityType.getValue(),
                externalId: record.externalId,
            } as any,
            productAvailability: knowledgeText.productAvailability,
            externalId: record.externalId,
            customerId: knowledgeText.customerId,
        });

        // ── Generate embedding vector ───────────────────────────────────────
        const { vector, dimension, model, usedFallback } =
            await this.embeddingRepository.generateEmbedding({ text: knowledgeText.text });

        // ── Persist embedding via knowledge repository ──────────────────────
        // IKnowledgeRepository.upsertEmbedding handles chunk-to-vector mapping.
        // We use saveEmbedding which is the clean abstraction — no direct Mongoose here.
        await this.knowledgeRepository.saveEmbedding({
            tenantId: record.tenantId,
            documentId,
            vector,
            dimension,
            model,
        });

        if (usedFallback) {
            logger.warn("embedding.fallback_used", {
                recordId: record.id,
                documentId,
                tenantId: record.tenantId,
                // Do NOT schedule reconciliation sync here — that caused infinite loop in old code
            });
        }

        await this.stagingRepository.markEmbedCompleted(record.id, documentId);

        return { embedded: true, usedFallback };
    }
}