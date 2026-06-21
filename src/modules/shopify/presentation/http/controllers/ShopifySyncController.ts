import { Request, Response } from "express";
import { TriggerSyncUseCase } from "../../../application/useCases/sync/TriggerSyncUseCase";
import { PgSyncJobRepository } from "../../../infrastructure/postgres/repositories/PgSyncJobRepository";
import { InMemoryEventPublisher } from "../../../application/ports/IEventPublisher";

export const ShopifySyncController = async (req: Request, res: Response): Promise<void> => {
    // ── Shared instances — created inside function to ensure DB connection is ready ──
    const syncJobRepository = new PgSyncJobRepository();
    const eventPublisher = new InMemoryEventPublisher();

    const tenantContext = req.tenantContext;
    if (!tenantContext) {
        // Should never happen — TenantMiddleware runs before this
        res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Tenant context missing" } });
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
