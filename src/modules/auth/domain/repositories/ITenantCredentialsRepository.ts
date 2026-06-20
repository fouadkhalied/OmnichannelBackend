export interface ITenantCredentialsRepository {
    upsert(credentials: any): Promise<any>;
    findByOrganizationId(organizationId: string): Promise<any>;
}
