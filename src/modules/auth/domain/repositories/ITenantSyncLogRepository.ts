export interface ITenantSyncLogRepository {
    create(data: any): Promise<any>;
    findLatestByTenantId(tenantId: string): Promise<any>;
}
