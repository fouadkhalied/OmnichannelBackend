import { Request, Response } from "express";
import { TriggerSyncUseCase } from "../../../application/useCases/sync/TriggerSyncUseCase";
import { PgSyncJobRepository } from "../../../infrastructure/postgres/repositories/PgSyncJobRepository";
import { InMemoryEventPublisher } from "../../../application/ports/IEventPublisher";
import { DEFAULT_ORGANIZATION_ID, DEFAULT_STORE_ID } from "../../../../../libs/shared/presentation/http/tenant/TenantResolver";

// ── Shared instances — created once at module load, not per request ──────────
const syncJobRepository = new PgSyncJobRepository();
const eventPublisher = new InMemoryEventPublisher();

export const ShopifySyncController = async (req: Request, res: Response): Promise<void> => {
    const tenantContext = req.tenantContext;
    if (!tenantContext) {
        // Should never happen — TenantMiddleware runs before this
        res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Tenant context missing" } });
        return;
    }

    // Guard: never create a sync job for the anonymous default tenant.
    // This happens when AuthMiddleware is disabled and no x-organization-id /
    // x-store-id headers are sent — the tenant resolver falls back to defaults.
    if (
        tenantContext.organizationId === DEFAULT_ORGANIZATION_ID ||
        tenantContext.storeId === DEFAULT_STORE_ID
    ) {
        res.status(400).json({
            error: {
                code: "TENANT_REQUIRED",
                message:
                    "Cannot trigger a sync without a valid tenant. " +
                    "Send x-organization-id and x-store-id headers.",
            },
        });
        return;
    }

    const action = (req.body?.action as "full" | "retry_failed") || "full";

    const useCase = new TriggerSyncUseCase(tenantContext, syncJobRepository, eventPublisher);

    const result = await useCase.execute({
        tenantId: tenantContext.tenantId,
        action,
    });

    res.status(202).json(result);
    // Errors bubble to GlobalErrorHandler — no try/catch here
};
