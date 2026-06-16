import { BaseService } from "../../../../../libs/shared/application/BaseService";
import { StagingRecord } from "../../../domain/repositories/IStagingRepository";
import { IStagingRepository } from "../../../domain/repositories/IStagingRepository";
import { IKnowledgeRepository } from "../../../../ai/domain/repositories/IKnowledgeRepository";
import { IEmbeddingRepository } from "../../../../ai/domain/repositories/IEmbeddingRepository";
import { ImageEnrichmentUtils } from "../../../domain/services/ImageEnrichmentUtils";
import { logger } from "../../../../../libs/common/logger";
import { env } from "../../../../../config/env";
import { TenantContext } from "../../../../../libs/shared/domain/valueObjects/TenantContext";

export class EnrichProductImagesUseCase extends BaseService {
    constructor(
        tenantContext: TenantContext,
        private readonly stagingRepository: IStagingRepository,
        private readonly knowledgeRepository: IKnowledgeRepository,
        private readonly embeddingRepository: IEmbeddingRepository
    ) {
        super(tenantContext);
    }

    async execute(record: StagingRecord): Promise<
        | { skipped: true; reason: string }
        | { enriched: true; descriptorCount: number }
    > {
        if (!record.knowledgeDocumentId) {
            // Embed must complete before enrich — this shouldn't happen due to
            // claimNextPendingEnrichment WHERE embed_status = 'completed' constraint
            await this.stagingRepository.markEnrichFailed(
                record.id,
                "knowledgeDocumentId missing — embedding must complete first"
            );
            throw new Error("Cannot enrich record without knowledgeDocumentId");
        }

        const maxImages = env.SHOPIFY_IMAGE_ENRICHMENT_MAX_IMAGES ?? 4;

        // ── 1. Check image signature BEFORE any API calls ──────────────────
        const currentSignature = ImageEnrichmentUtils.computeProductImageAnalysisSignature(
            record.payload
        );

        if (currentSignature === record.imageSignature) {
            await this.stagingRepository.markEnrichCompleted(record.id, currentSignature);
            return { skipped: true, reason: "signature_unchanged" };
        }

        // ── 2. Collect image URLs ──────────────────────────────────────────
        // Pass maxImages to respect the configured cap
        const imageUrls = ImageEnrichmentUtils.collectProductImagesForEnrichment(
            record.payload,
            //maxImages  // Fixed: was missing this parameter
        );

        if (imageUrls.length === 0) {
            await this.stagingRepository.markEnrichCompleted(record.id, "no_images");
            return { skipped: true, reason: "no_images" };
        }

        // ── 3. Describe each image via OpenAI Vision ───────────────────────
        const descriptorGroups: string[][] = [];

        for (const url of imageUrls) {
            try {
                const { descriptors } = await this.embeddingRepository.describeImage({
                    imageUrl: url,
                });
                if (descriptors.length > 0) {
                    descriptorGroups.push(descriptors);
                }
            } catch (error: any) {
                // Per-image failure is non-fatal — log and continue to next image
                logger.warn("enrichment.image_description_failed", {
                    recordId: record.id,
                    tenantId: record.tenantId,
                    url,
                    error: error.message,
                });
            }
        }

        if (descriptorGroups.length === 0) {
            // All images failed — throw so worker schedules retry
            throw new Error("enrichment produced no descriptors — all image API calls failed");
        }

        // ── 4. Merge and deduplicate descriptors ───────────────────────────
        const visualDescriptors = ImageEnrichmentUtils.mergeVisualDescriptors(descriptorGroups);

        // ── 5. Update knowledge document with visual descriptors ───────────
        await this.knowledgeRepository.updateEnrichment({
            tenantId: record.tenantId,
            documentId: record.knowledgeDocumentId,
            visualDescriptors,
            imageAnalysisSignature: currentSignature,
            imageAnalysisUpdatedAt: new Date(),
        });

        // ── 6. Mark enrichment completed in Postgres ───────────────────────
        await this.stagingRepository.markEnrichCompleted(record.id, currentSignature);

        logger.info("enrichment.completed", {
            recordId: record.id,
            tenantId: record.tenantId,
            descriptorCount: visualDescriptors.length,
        });

        return { enriched: true, descriptorCount: visualDescriptors.length };
    }
}