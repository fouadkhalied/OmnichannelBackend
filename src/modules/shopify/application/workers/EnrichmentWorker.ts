import { EnrichProductImagesUseCase } from "../useCases/embedding/EnrichProductImagesUseCase";
import { IStagingRepository } from "../../domain/repositories/IStagingRepository";
import { logger } from "../../../../libs/common/logger";
import { TenantContext } from "../../../../libs/shared/domain/valueObjects/TenantContext";

const POLL_MS = parseInt(process.env.ENRICHMENT_WORKER_POLL_MS || "5000");
const BATCH_SIZE = 10;

// Module-level state isolated to THIS file only
let timer: NodeJS.Timeout | null = null;
let running = false;

export const createEnrichmentWorker = (
    stagingRepository: IStagingRepository,
    enrichProductImagesFactory: (context: TenantContext) => EnrichProductImagesUseCase
) => {
    const tick = async () => {
        if (running) return;
        running = true;
        try {
            const records = await stagingRepository.claimNextPendingEnrichment(BATCH_SIZE);
            if (records.length === 0) return;

            logger.info("enrichment.worker.processing_batch", { count: records.length });

            for (const record of records) {
                try {
                    const context: TenantContext = {
                        tenantId: record.tenantId,
                        plan: "pro",
                        features: ["shopify_sync"],
                        limits: {},
                    };
                    const useCase = enrichProductImagesFactory(context);
                    await useCase.execute(record);
                } catch (error: any) {
                    logger.error("enrichment.worker.record_failed", {
                        recordId: record.id,
                        tenantId: record.tenantId,
                        error: error.message,
                    });
                    // Mark failed so it doesn't stay in processing state
                    await stagingRepository.markEnrichFailed(record.id, error.message).catch(() => null);
                }
            }
        } catch (error: any) {
            logger.error("enrichment.worker.tick_error", { error: error.message });
        } finally {
            running = false;
        }
    };

    return {
        start: () => {
            if (timer) return;
            tick().catch(() => null);
            timer = setInterval(() => tick().catch(() => null), POLL_MS);
            logger.info("enrichment.worker.started", { pollMs: POLL_MS, batchSize: BATCH_SIZE });
        },
        stop: () => {
            if (!timer) return;
            clearInterval(timer);
            timer = null;
            logger.info("enrichment.worker.stopped");
        },
    };
};