export interface ITenantN8nRepository {
    upsert(data: any): Promise<any>;
    findByTenantId(tenantId: string): Promise<any>;
}
