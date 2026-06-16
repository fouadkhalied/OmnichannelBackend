import { Request, Response } from "express";
import { ShopifyTopicMapper } from "../../../infrastructure/webhooks/ShopifyTopicMapper";
import { ProcessProductWebhookUseCase } from "../../../application/useCases/webhook/ProcessProductWebhookUseCase";
import { ProcessCustomerWebhookUseCase } from "../../../application/useCases/webhook/ProcessCustomerWebhookUseCase";
import { ProcessOrderWebhookUseCase } from "../../../application/useCases/webhook/ProcessOrderWebhookUseCase";
import { PgStagingRepository } from "../../../infrastructure/postgres/repositories/PgStagingRepository";
import { MongoConnectorRepository } from "../../../../../libs/shared/infrastructure/mongo/repositories/MongoConnectorRepository";
import { ShopifyGraphQLClient } from "../../../infrastructure/shopify/graphql/ShopifyGraphQLClient";
import { ChangeDetectionService } from "../../../domain/services/ChangeDetectionService";
import { TenantContext } from "../../../../../libs/shared/domain/valueObjects/TenantContext";
import { logger } from "../../../../../libs/common/logger";

// Shared instances — instantiated once, not per request
const stagingRepository = new PgStagingRepository();
const connectorRepository = new MongoConnectorRepository();
const shopifyClient = new ShopifyGraphQLClient();
const changeDetectionService = new ChangeDetectionService();

const extractEntityId = (payload: any): string | null => {
    const id = payload?.id;
    if (!id) return null;
    // Handle both numeric IDs and GIDs
    const str = String(id);
    // If it's a GID like gid://shopify/Product/123, extract the numeric part
    const gidMatch = str.match(/\/(\d+)$/);
    return gidMatch ? gidMatch[1] : str;
};

export const ShopifyWebhookController = async (req: Request, res: Response): Promise<void> => {
    const topic = req.headers["x-shopify-topic"] as string;
    const shopDomain = req.headers["x-shopify-shop-domain"] as string;
    const payload = req.body;

    // ── Return 200 immediately — Shopify retries if it doesn't get 200 fast ──
    res.status(200).json({ received: true });

    // ── Process async after response sent ─────────────────────────────────
    const eventType = ShopifyTopicMapper.toEventType(topic || "");
    const entityId = extractEntityId(payload);
    const tenantContext = req.tenantContext;

    if (!tenantContext || !entityId) {
        logger.warn("webhook.missing_context_or_entity_id", {
            eventType,
            shopDomain,
            hasEntityId: !!entityId,
            hasTenantContext: !!tenantContext,
        });
        return;
    }

    const tenantId = tenantContext.tenantId;

    setImmediate(async () => {
        try {
            if (eventType.startsWith("shopify.products")) {
                const useCase = new ProcessProductWebhookUseCase(
                    tenantContext,
                    shopifyClient,
                    connectorRepository,
                    stagingRepository,
                    changeDetectionService
                );
                await useCase.execute({ tenantId, eventType, entityId });

            } else if (eventType.startsWith("shopify.customers")) {
                const useCase = new ProcessCustomerWebhookUseCase(
                    tenantContext,
                    shopifyClient,
                    connectorRepository,
                    stagingRepository,
                    changeDetectionService
                );
                await useCase.execute({ tenantId, eventType, entityId });

            } else if (eventType.startsWith("shopify.orders")) {
                const useCase = new ProcessOrderWebhookUseCase(
                    tenantContext,
                    shopifyClient,
                    connectorRepository,
                    stagingRepository,
                    changeDetectionService
                );
                await useCase.execute({ tenantId, eventType, entityId });

            } else {
                logger.debug("webhook.unhandled_event_type", { eventType, tenantId });
            }
        } catch (error: any) {
            logger.error("webhook.processing_failed", {
                eventType,
                tenantId,
                entityId,
                error: error.message,
            });
        }
    });
};