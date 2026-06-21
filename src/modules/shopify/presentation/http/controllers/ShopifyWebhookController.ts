import { Request, Response } from "express";
import { ShopifyTopicMapper } from "../../../infrastructure/webhooks/ShopifyTopicMapper";
import { ProcessProductWebhookUseCase } from "../../../application/useCases/webhook/ProcessProductWebhookUseCase";
import { ProcessCustomerWebhookUseCase } from "../../../application/useCases/webhook/ProcessCustomerWebhookUseCase";
import { ProcessOrderWebhookUseCase } from "../../../application/useCases/webhook/ProcessOrderWebhookUseCase";
import { PgStagingRepository } from "../../../infrastructure/postgres/repositories/PgStagingRepository";
import { PgConnectorRepository } from "../../../../../libs/shared/infrastructure/postgres/repositories/PgConnectorRepository";
import { PgN8nInstanceRepository } from "../../../../../libs/shared/infrastructure/postgres/repositories/PgN8nInstanceRepository";
import { ShopifyGraphQLClient } from "../../../infrastructure/shopify/graphql/ShopifyGraphQLClient";
import { ChangeDetectionService } from "../../../domain/services/ChangeDetectionService";
import { N8nForwardingService } from "../../../../n8n/N8nForwardingService";
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
    const stagingRepository = new PgStagingRepository();
    const connectorRepository = new PgConnectorRepository();
    const n8nRepository = new PgN8nInstanceRepository();
    const shopifyClient = new ShopifyGraphQLClient();
    const changeDetectionService = new ChangeDetectionService();
    const n8nForwardingService = new N8nForwardingService(n8nRepository);
    const uowFactory = new UnitOfWorkFactory(requireDb());

    const topic = req.headers["x-shopify-topic"] as string;
    const shopDomain = req.headers["x-shopify-shop-domain"] as string;
    const payload = req.body;

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

    const tenantId = tenantContext.tenantId;

    setImmediate(async () => {
        try {
            if (eventType.startsWith("shopify.products")) {
                const useCase = new ProcessProductWebhookUseCase(
                    tenantContext,
                    shopifyClient,
                    connectorRepository,
                    stagingRepository,
                    changeDetectionService,
                    n8nForwardingService,
                    uowFactory
                );
                await useCase.execute({ tenantId, eventType, entityId });

            } else if (eventType.startsWith("shopify.customers")) {
                const useCase = new ProcessCustomerWebhookUseCase(
                    tenantContext,
                    shopifyClient,
                    connectorRepository,
                    stagingRepository,
                    changeDetectionService,
                    n8nForwardingService,
                    uowFactory
                );
                await useCase.execute({ tenantId, eventType, entityId });

            } else if (eventType.startsWith("shopify.orders")) {
                const useCase = new ProcessOrderWebhookUseCase(
                    tenantContext,
                    shopifyClient,
                    connectorRepository,
                    stagingRepository,
                    changeDetectionService,
                    n8nForwardingService,
                    uowFactory
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