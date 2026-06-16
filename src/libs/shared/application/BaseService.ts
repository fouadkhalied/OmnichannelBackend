import { TenantContext } from "../domain/valueObjects/TenantContext";
import { PlanUpgradeError } from "../domain/errors/PlanUpgradeError";

// Plan hierarchy — higher index = higher tier
const PLAN_HIERARCHY: Record<string, number> = {
    free: 0,
    starter: 1,
    pro: 2,
    enterprise: 3,
};

export abstract class BaseService {
    protected constructor(protected readonly tenantContext: TenantContext) { }

    /**
     * Throws PlanUpgradeError if the tenant's current plan is below the required plan.
     * Enterprise always passes.
     */
    protected requirePlan(requiredPlan: string): void {
        const currentLevel = PLAN_HIERARCHY[this.tenantContext.plan] ?? 0;
        const requiredLevel = PLAN_HIERARCHY[requiredPlan] ?? 0;

        if (currentLevel < requiredLevel) {
            throw new PlanUpgradeError(
                `Plan '${requiredPlan}' required. Current plan: '${this.tenantContext.plan}'`
            );
        }
    }

    /**
     * Throws if feature flag is not enabled for this tenant.
     * Returns true if enabled.
     */
    protected hasFeature(feature: string): boolean {
        if (!this.tenantContext.features.includes(feature)) {
            throw new PlanUpgradeError(
                `Feature '${feature}' is not enabled for this tenant's plan.`
            );
        }
        return true;
    }

    protected get tenantId(): string {
        return this.tenantContext.tenantId;
    }

    /**
     * Split tenantId into organizationId and storeId.
     * Format: "organizationId:storeId" or just "tenantId" for both.
     */
    protected splitTenantId(): { organizationId: string; storeId: string } {
        const { tenantId } = this.tenantContext;
        if (tenantId.includes(":")) {
            const [organizationId, storeId] = tenantId.split(":");
            return { organizationId, storeId };
        }
        // Fallback: use explicit fields on context if available
        return {
            organizationId: this.tenantContext.organizationId ?? tenantId,
            storeId: this.tenantContext.storeId ?? tenantId,
        };
    }
}