import { Request, Response } from "express";
import { MongoConnectorRepository } from "../../../../../libs/shared/infrastructure/mongo/repositories/MongoConnectorRepository";
import { logger } from "../../../../../libs/common/logger";
import { ShopifyWebhookRegistrationService } from "src/modules/shopify/domain/services/ShopifyWebhookRegistrationService";
import { InitiateOauthUseCase } from "src/modules/shopify/application/useCases/oauth/InitiateOauthUseCase";
import { env } from "src/config/env";
import { CompleteOauthUseCase } from "src/modules/shopify/application/useCases/oauth/CompleteOauthUseCase";

export class ShopifyOauthController {
    private readonly connectorRepository = new MongoConnectorRepository();
    private readonly webhookService = new ShopifyWebhookRegistrationService();

    async initiate(req: Request, res: Response): Promise<void> {
        try {
            const tenantContext = (req as any).tenantContext;
            const shop = req.query.shop as string;

            if (!shop) {
                res.status(400).json({ error: "Missing 'shop' query parameter" });
                return;
            }

            const useCase = new InitiateOauthUseCase(
                tenantContext,
                this.connectorRepository
            );

            const { redirectUrl } = await useCase.execute({
                userId: (req as any).userId || (req as any).user?.claims?.sub || "anonymous",
                organizationId: tenantContext.organizationId,
                storeId: tenantContext.storeId,
                shopDomain: shop,
                apiVersion: "2025-01",
            });

            res.redirect(redirectUrl);
        } catch (error) {
            logger.error("shopify.oauth_initiate_failed", {
                error: error instanceof Error ? error.message : String(error),
            });
            res.status(500).json({ error: "Failed to initiate OAuth" });
        }
    }

    async callback(req: Request, res: Response): Promise<void> {
        try {
            const code = req.query.code as string;
            const state = req.query.state as string;
            // The raw query is the part after ? in the URL
            const rawQuery = req.url.split("?")[1] || "";

            if (!code || !state) {
                res.status(400).json({ error: "Missing 'code' or 'state' parameter" });
                return;
            }

            const useCase = new CompleteOauthUseCase(
                (req as any).tenantContext || ({} as any), // Context not initialized yet for callback
                this.connectorRepository,
                this.webhookService
            );

            const result = await useCase.execute({
                code,
                state,
                rawQuery,
            });

            // Redirect back to frontend
            const frontendUrl = env.FRONTEND_URL || "http://localhost:3000";
            res.redirect(`${frontendUrl}/settings/shopify?connected=true&shop=${result.shopDomain}`);
        } catch (error) {
            logger.error("shopify.oauth_callback_failed", {
                error: error instanceof Error ? error.message : String(error),
            });
            const frontendUrl = env.FRONTEND_URL || "http://localhost:3000";
            res.redirect(`${frontendUrl}/settings/shopify?error=${encodeURIComponent(error instanceof Error ? error.message : "OAuth failed")}`);
        }
    }
}
