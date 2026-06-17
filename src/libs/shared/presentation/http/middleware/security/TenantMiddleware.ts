import { Request, Response, NextFunction } from "express";
import { resolveTenantContext, runWithTenantContext } from "../../tenant/TenantResolver";
import { TenantNotFoundError } from "../../../../domain/errors/TenantNotFoundError";
import { logger } from "../../../../../common/logger";

export const TenantMiddleware = async (req: any, res: any, next: any) => {
    try {
        const tenantContext = await resolveTenantContext(req as any);

        // Attach to request for convenience
        (req as any).tenantContext = tenantContext;

        logger.info("tenant.resolved", {
            tenantId: tenantContext.tenantId,
            organizationId: tenantContext.organizationId
        });

        // Run next middleware/controller within the tenant context (AsyncLocalStorage)
        runWithTenantContext(tenantContext, () => {
            next();
        });
    } catch (error: any) {
        console.error("Tenant resolution failed:", error);
        next(new TenantNotFoundError());
    }
};
