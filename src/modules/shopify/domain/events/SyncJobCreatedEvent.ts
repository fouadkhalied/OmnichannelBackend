import { SyncJobType } from "../entities/ShopifySyncJob";

export class SyncJobCreatedEvent {
    constructor(
        public readonly jobId: string,
        public readonly tenantId: string,
        public readonly type: SyncJobType,
        public readonly triggeredAt: Date = new Date()
    ) { }
}
