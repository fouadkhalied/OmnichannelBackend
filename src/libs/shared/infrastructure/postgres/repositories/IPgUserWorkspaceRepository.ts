export interface IPgUserWorkspaceRepository {
    findByUserId(userId: string): Promise<any[]>;
    upsert(data: {
        userId: string;
        organizationId: string;
        storeId?: string;
        role?: string;
    }): Promise<void>;
}
