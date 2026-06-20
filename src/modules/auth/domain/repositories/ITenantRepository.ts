export interface ITenantRepository {
    upsert(data: any): Promise<any>;
    findById(id: string): Promise<any>;
    findByEmail(email: string): Promise<any>;
}
