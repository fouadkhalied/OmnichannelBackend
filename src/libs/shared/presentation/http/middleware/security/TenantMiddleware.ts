import { Request, Response, NextFunction } from "express";
import { resolveTenantContext, runWithTenantContext } from "../../tenant/TenantResolver";
import { TenantNotFoundError } from "../../../../domain/errors/TenantNotFoundError";

export const TenantMiddleware = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const tenantContext = await resolveTenantContext(req as any);

        // Attach to request for convenience
        (req as any).tenantContext = tenantContext;

        // Run next middleware/controller within the tenant context (AsyncLocalStorage)
        runWithTenantContext(tenantContext, () => {
            next();
        });
    } catch (error: any) {
        console.error("Tenant resolution failed:", error);
        next(new TenantNotFoundError());
    }
};
