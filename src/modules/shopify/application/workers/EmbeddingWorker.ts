import { GenerateEmbeddingUseCase } from "../useCases/embedding/GenerateEmbeddingUseCase";
import { IStagingRepository } from "../../domain/repositories/IStagingRepository";
import { logger } from "../../../../libs/common/logger";
import { TenantContext } from "../../../../libs/shared/domain/valueObjects/TenantContext";

const POLL_MS = parseInt(process.env.EMBEDDING_WORKER_POLL_MS || "1000");
const BATCH_SIZE = 25;

// Module-level state isolated to THIS file only
let timer: NodeJS.Timeout | null = null;
let running = false;

export const createEmbeddingWorker = (
    stagingRepository: IStagingRepository,
    generateEmbeddingFactory: (context: TenantContext) => GenerateEmbeddingUseCase
) => {
    const tick = async () => {
        if (running) return;
        running = true;
        try {
            const records = await stagingRepository.claimNextPendingEmbedding(BATCH_SIZE);
            if (records.length === 0) return;

            logger.info("embedding.worker.processing_batch", { count: records.length });

            for (const record of records) {
                try {
                    const context: TenantContext = {
                        tenantId: record.tenantId,
                        plan: "pro",
                        features: ["shopify_sync"],
                        limits: {},
                    };
                    const useCase = generateEmbeddingFactory(context);
                    await useCase.execute(record);
                } catch (error: any) {
                    logger.error("embedding.worker.record_failed", {
                        recordId: record.id,
                        tenantId: record.tenantId,
                        entityType: record.entityType.getValue(),
                        error: error.message,
                    });
                    // Mark failed so it doesn't stay in processing state
                    await stagingRepository.markEmbedFailed(record.id, error.message).catch(() => null);
                }
            }
        } catch (error: any) {
            logger.error("embedding.worker.tick_error", { error: error.message });
        } finally {
            running = false;
        }
    };

    return {
        start: () => {
            if (timer) return;
            tick().catch(() => null);
            timer = setInterval(() => tick().catch(() => null), POLL_MS);
            logger.info("embedding.worker.started", { pollMs: POLL_MS, batchSize: BATCH_SIZE });
        },
        stop: () => {
            if (!timer) return;
            clearInterval(timer);
            timer = null;
            logger.info("embedding.worker.stopped");
        },
    };
};