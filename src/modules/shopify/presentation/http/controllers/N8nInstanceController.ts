import { Request, Response } from "express";
import { PgN8nInstanceRepository } from "../../../../../libs/shared/infrastructure/postgres/repositories/PgN8nInstanceRepository";
import { RegisterN8nInstanceUseCase } from "../../../../n8n/application/useCases/RegisterN8nInstanceUseCase";
import { logger } from "../../../../../libs/common/logger";

export class N8nInstanceController {
    private readonly n8nRepository = new PgN8nInstanceRepository();

    async getInstance(req: Request, res: Response): Promise<void> {
        try {
            const tenantContext = (req as any).tenantContext;
            if (!tenantContext) {
                res.status(401).json({ error: "Tenant context not found" });
                return;
            }

            const instance = await this.n8nRepository.findByOrganizationId(tenantContext.organizationId);

            if (!instance) {
                res.status(404).json({ error: "n8n instance not configured for this organization" });
                return;
            }

            // Return safe info only
            res.json({
                id: instance.id,
                n8nSpaceUrl: instance.n8nSpaceUrl,
                status: instance.status,
                createdAt: instance.createdAt,
            });
        } catch (error) {
            logger.error("n8n.get_instance_failed", {
                error: error instanceof Error ? error.message : String(error),
            });
            res.status(500).json({ error: "Failed to retrieve n8n instance info" });
        }
    }

    async register(req: Request, res: Response): Promise<void> {
        try {
            const tenantContext = (req as any).tenantContext;
            if (!tenantContext) {
                res.status(401).json({ error: "Tenant context not found" });
                return;
            }

            const { n8nSpaceUrl, n8nApiKey } = req.body;
            if (!n8nSpaceUrl || !n8nApiKey) {
                res.status(400).json({ error: "Missing n8nSpaceUrl or n8nApiKey in request body" });
                return;
            }

            const useCase = new RegisterN8nInstanceUseCase(tenantContext, this.n8nRepository);
            await useCase.execute({
                organizationId: tenantContext.organizationId,
                n8nSpaceUrl,
                n8nApiKey,
            });

            res.json({ success: true, message: "n8n instance registered successfully" });
        } catch (error) {
            logger.error("n8n.register_failed", {
                error: error instanceof Error ? error.message : String(error),
            });
            res.status(500).json({ error: "Failed to register n8n instance" });
        }
    }
}
