import { BaseService } from "../../../../../libs/shared/application/BaseService";
import { TenantContext } from "../../../../../libs/shared/domain/valueObjects/TenantContext";
import { ISyncJobRepository } from "../../../domain/repositories/ISyncJobRepository";
import { IEventPublisher } from "../../ports/IEventPublisher";
import { SyncJobCreatedEvent } from "../../../domain/events/SyncJobCreatedEvent";

export interface TriggerSyncInput {
    tenantId: string;
    action: "full" | "retry_failed";
}

export class TriggerSyncUseCase extends BaseService {
    constructor(
        tenantContext: TenantContext,
        private readonly repository: ISyncJobRepository,
        private readonly eventPublisher: IEventPublisher
    ) {
        super(tenantContext);
    }

    async execute(input: TriggerSyncInput) {

        // ── 2. Check for already active job (dedup) ────────────────────────
        const activeJob = await this.repository.findActiveSyncJob(input.tenantId);
        if (activeJob) {
            return {
                jobId: activeJob.id,
                status: activeJob.status.getValue(),
                reused: true,
            };
        }

        // ── 3. Handle retry_failed: re-enqueue latest failed job's type ────
        if (input.action === "retry_failed") {
            const failedJob = await this.repository.findLatestFailedJob(input.tenantId);
            if (failedJob) {
                const job = await this.repository.createSyncJob({
                    tenantId: input.tenantId,
                    type: failedJob.type, // preserve original type
                    triggeredBy: "manual_retry_failed",
                });

                await this.eventPublisher.publish(
                    new SyncJobCreatedEvent(job.id, job.tenantId, job.type)
                );

                return {
                    jobId: job.id,
                    status: job.status.getValue(),
                    reused: false,
                };
            }
            // No failed job found — fall through to full sync
        }

        // ── 4. Create new full backfill job ────────────────────────────────
        const job = await this.repository.createSyncJob({
            tenantId: input.tenantId,
            type: "full_backfill",
            triggeredBy: "manual",
        });

        await this.eventPublisher.publish(
            new SyncJobCreatedEvent(job.id, job.tenantId, job.type)
        );

        return {
            jobId: job.id,
            status: job.status.getValue(),
            reused: false,
        };
    }
}