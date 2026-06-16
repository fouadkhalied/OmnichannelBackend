export type SyncJobStatusValue = 'pending' | 'running' | 'completed' | 'failed' | 'retry_scheduled';

export class SyncJobStatus {
    constructor(private readonly value: SyncJobStatusValue) { }

    getValue(): SyncJobStatusValue {
        return this.value;
    }

    isTerminal(): boolean {
        return ['completed', 'failed'].includes(this.value);
    }

    isActive(): boolean {
        return ['pending', 'running', 'retry_scheduled'].includes(this.value);
    }

    static fromString(status: string): SyncJobStatus {
        const validStatuses: SyncJobStatusValue[] = ['pending', 'running', 'completed', 'failed', 'retry_scheduled'];
        if (!validStatuses.includes(status as SyncJobStatusValue)) {
            throw new Error(`Invalid sync job status: ${status}`);
        }
        return new SyncJobStatus(status as SyncJobStatusValue);
    }

    toString(): string {
        return this.value;
    }
}
