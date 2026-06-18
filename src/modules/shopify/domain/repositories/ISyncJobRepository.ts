import { ShopifySyncJob, SyncJobType, SyncProgress } from "../entities/ShopifySyncJob";
import { SyncJobStatus } from "../valueObjects/SyncJobStatus";

export interface ISyncJobRepository {
    findActiveSyncJob(storeId: string): Promise<ShopifySyncJob | null>;
    findLatestFailedJob(storeId: string): Promise<ShopifySyncJob | null>;
    createSyncJob(input: {
        storeId: string;
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
