import { SyncJobStatus } from "../valueObjects/SyncJobStatus";
import { SyncCursor } from "../types/SyncCursor";

export type SyncJobType = 'full_backfill' | 'reconciliation';

export interface SyncProgress {
    products: number;
    variants: number;
    inventory: number;
    customers: number;
    orders: number;
}


export class ShopifySyncJob {
    constructor(
        public readonly id: string,
        public readonly storeId: string,
        public readonly type: SyncJobType,
        public status: SyncJobStatus,
        public progress: SyncProgress,
        public cursor: SyncCursor | null,
        public triggeredBy: string,
        public attempts: number,
        public maxAttempts: number,
        public error: string | null,
        public startedAt: Date | null,
        public finishedAt: Date | null,
        public nextRunAt: Date,
        public createdAt: Date,
        public updatedAt: Date
    ) { }
}
