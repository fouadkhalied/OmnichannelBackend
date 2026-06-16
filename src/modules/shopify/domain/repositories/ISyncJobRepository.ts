import { ShopifySyncJob, SyncJobType, SyncProgress } from "../entities/ShopifySyncJob";
import { SyncJobStatus } from "../valueObjects/SyncJobStatus";

export interface ISyncJobRepository {
    findActiveSyncJob(tenantId: string): Promise<ShopifySyncJob | null>;
    findLatestFailedJob(tenantId: string): Promise<ShopifySyncJob | null>;
    createSyncJob(input: {
        tenantId: string;
        type: SyncJobType;
        triggeredBy: string;
    }): Promise<ShopifySyncJob>;
    findById(jobId: string): Promise<ShopifySyncJob | null>;
    updateStatus(
        jobId: string,
        status: SyncJobStatus,
        extra?: Partial<ShopifySyncJob>
    ): Promise<void>;
    markCompleted(jobId: string, progress: SyncProgress): Promise<void>;
    markFailed(jobId: string, error: string, attempts: number, nextRunAt: Date): Promise<void>;
    claimNextPendingJob(): Promise<ShopifySyncJob | null>;
}
