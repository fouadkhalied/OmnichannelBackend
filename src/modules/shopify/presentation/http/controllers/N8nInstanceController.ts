import { Request, Response } from "express";
import { MongoN8nInstanceRepository } from "../../../../../libs/shared/infrastructure/mongo/repositories/MongoN8nInstanceRepository";
import { logger } from "../../../../../libs/common/logger";

export class N8nInstanceController {
    private readonly n8nRepository = new MongoN8nInstanceRepository();

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
}
