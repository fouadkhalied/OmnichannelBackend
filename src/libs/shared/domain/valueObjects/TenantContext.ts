export interface TenantContext {
    tenantId: string;
    organizationId?: string; // For compatibility with legacy code
    storeId?: string;        // For compatibility with legacy code
    plan: string;
    features: string[];
    limits: Record<string, any>;
}
