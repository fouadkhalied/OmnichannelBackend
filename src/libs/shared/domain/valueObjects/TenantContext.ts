export enum TenantPlan {
    FREE = "free",
    PRO = "pro",
    ENTERPRISE = "enterprise",
}

export interface TenantContext {
    tenantId: string;
    organizationId?: string; // For compatibility with legacy code
    storeId?: string;        // For compatibility with legacy code
    plan: TenantPlan;
}
