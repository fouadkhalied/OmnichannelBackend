import { logger } from "../../../../libs/common/logger";
import { shopifyEvents } from "../ports/IEventPublisher";
import { SyncJobCreatedEvent } from "../../domain/events/SyncJobCreatedEvent";
import { RunSyncJobUseCase } from "../useCases/sync/RunSyncJobUseCase";
import { ISyncJobRepository } from "../../domain/repositories/ISyncJobRepository";
import { env } from "../../../../config/env";

const POLL_MS = env.SHOPIFY_SYNC_WORKER_POLL_MS ?? 5_000;
const RECONCILIATION_EVERY_TICKS = Math.max(
    1,
    Math.floor((env.SHOPIFY_SYNC_RECONCILIATION_MS ?? 86_400_000) / POLL_MS)
);

const jobRetryBackoffMs = (attempt: number): number => {
    const capped = Math.min(attempt, 6);
    return Math.min(300_000, 5_000 * Math.pow(2, capped));
};

export class SyncWorker {
    private isRunning = false;
    private timer: NodeJS.Timeout | null = null;
    private reconciliationCounter = 0;

    constructor(
        private readonly syncJobRepository: ISyncJobRepository,
        private readonly runSyncJob: RunSyncJobUseCase
    ) { }

    async start(): Promise<void> {
        if (this.isRunning) return;
        this.isRunning = true;

        // ── Event-driven: process immediately when a new job is created ──
        shopifyEvents.on("shopify_event", (event: unknown) => {
            if (event instanceof SyncJobCreatedEvent) {
                logger.info("SyncWorker received SyncJobCreatedEvent", { jobId: event.jobId });
                this.tick().catch((err) => {
                    logger.error("SyncWorker event-driven tick failed", { error: err.message });
                });
            }
        });

        // ── Kick off immediately on start ──
        this.tick().catch(() => null);

        // ── Periodic poll as safety net ──
        this.timer = setInterval(() => {
            this.tick().catch((err) => {
                logger.error("SyncWorker tick failed", { error: err.message });
            });
        }, POLL_MS);

        logger.info("SyncWorker started", { pollMs: POLL_MS, reconciliationEveryTicks: RECONCILIATION_EVERY_TICKS });
    }

    async stop(): Promise<void> {
        this.isRunning = false;
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
        shopifyEvents.removeAllListeners("shopify_event");
        logger.info("SyncWorker stopped");
    }

    private async tick(): Promise<void> {
        await this.processNextJob();

        // ── Reconciliation scheduling ──
        this.reconciliationCounter += 1;
        if (this.reconciliationCounter >= RECONCILIATION_EVERY_TICKS) {
            this.reconciliationCounter = 0;
            await this.scheduleReconciliationJobs();
        }
    }

    private async processNextJob(): Promise<void> {
        try {
            const job = await this.syncJobRepository.claimNextPendingJob();
            if (!job) return;

            logger.info("SyncWorker processing job", { jobId: job.id, tenantId: job.tenantId, type: job.type });

            try {
                await this.runSyncJob.execute(job);
            } catch (error: any) {
                // ── Job failed: increment attempts, schedule retry or mark terminal ──
                const attempts = (job.attempts ?? 0) + 1;
                const maxAttempts = job.maxAttempts ?? 5;
                const isTerminal = attempts >= maxAttempts;
                const errorMessage = error instanceof Error ? error.message : String(error);

                if (isTerminal) {
                    await this.syncJobRepository.markFailed(job.id, errorMessage, attempts, new Date());
                    logger.error("SyncWorker job permanently failed", {
                        jobId: job.id,
                        tenantId: job.tenantId,
                        attempts,
                        maxAttempts,
                        error: errorMessage,
                    });
                } else {
                    const nextRunAt = new Date(Date.now() + jobRetryBackoffMs(attempts));
                    await this.syncJobRepository.updateStatus(
                        job.id,
                        { getValue: () => "retry_scheduled" } as any,
                        { attempts, error: errorMessage, nextRunAt }
                    );
                    logger.warn("SyncWorker job failed, scheduled retry", {
                        jobId: job.id,
                        tenantId: job.tenantId,
                        attempts,
                        maxAttempts,
                        nextRunAt,
                        error: errorMessage,
                    });
                }
            }
        } catch (error: any) {
            // claimNextPendingJob itself failed — DB issue, log and continue
            logger.error("SyncWorker failed to claim job", { error: error.message });
        }
    }

    private async scheduleReconciliationJobs(): Promise<void> {
        try {
            // Find all connected Shopify tenants that need reconciliation
            // This is handled by checking connector last sync time
            // Delegated to ConnectorModel query — keep worker lean
            logger.debug("SyncWorker reconciliation tick — scheduling stale tenants");
            // Note: actual reconciliation scheduling should query ConnectorModel
            // for tenants where lastSyncAt < now - RECONCILIATION_MS.
            // That logic belongs in a dedicated ReconciliationUseCase.
            // For now we log so it's visible and easy to add.
        } catch (error: any) {
            logger.error("SyncWorker reconciliation scheduling failed", { error: error.message });
        }
    }
}