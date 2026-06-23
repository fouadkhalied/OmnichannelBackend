import { Request, Response } from "express";
import { ShopifyTopicMapper } from "../../../infrastructure/webhooks/ShopifyTopicMapper";
import { PgStagingRepository } from "../../../infrastructure/postgres/repositories/PgStagingRepository";
import { ShopifyGraphQLClient } from "../../../infrastructure/shopify/graphql/ShopifyGraphQLClient";
import { ChangeDetectionService } from "../../../domain/services/ChangeDetectionService";
import { logger } from "../../../../../libs/common/logger";
import { requireDb } from "../../../../../libs/shared/infrastructure/postgres/PgClient";
import { UnitOfWorkFactory } from "../../../../../libs/shared/infrastructure/postgres/unitOfWork/UnitOfWorkFactory";
const extractEntityId = (payload: any): string | null => {
    const id = payload?.id;
    if (!id) return null;
    const str = String(id);
    const gidMatch = str.match(/\/(\d+)$/);
    return gidMatch ? gidMatch[1] : str;
};

export const ShopifyWebhookController = async (req: Request, res: Response): Promise<void> => {
    const topic = req.headers["x-shopify-topic"] as string;
    const shopDomain = req.headers["x-shopify-shop-domain"] as string;
    const payload = req.body;

    logger.info('shopify_webhook_recived', {
        data: req.body,
        headers: req.headers
    })

    // 1. Return 200 immediately
    res.status(200).json({ received: true });

    // 2. Process async
    const eventType = ShopifyTopicMapper.toEventType(topic || "");
    const entityId = extractEntityId(payload);
    const tenantContext = (req as any).tenantContext;

    if (!tenantContext || !entityId) {
        logger.warn("webhook.missing_context_or_entity_id", {
            eventType,
            shopDomain,
            hasEntityId: !!entityId,
            hasTenantContext: !!tenantContext,
        });
        return;
    }
};