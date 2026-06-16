import { BaseService } from "../../../../../libs/shared/application/BaseService";
import { TenantContext } from "../../../../../libs/shared/domain/valueObjects/TenantContext";
import { IShopifyGraphQLClient } from "../../../domain/repositories/IShopifyGraphQLClient";
import { IConnectorRepository } from "../../../domain/repositories/IConnectorRepository";
import { IStagingRepository } from "../../../domain/repositories/IStagingRepository";
import { ChangeDetectionService } from "../../../domain/services/ChangeDetectionService";
import { ShopifyEntityType } from "../../../domain/valueObjects/ShopifyEntityType";
import { logger } from "../../../../../libs/common/logger";

export class ProcessOrderWebhookUseCase extends BaseService {
    constructor(
        tenantContext: TenantContext,
        private readonly shopifyClient: IShopifyGraphQLClient,
        private readonly connectorRepository: IConnectorRepository,
        private readonly stagingRepository: IStagingRepository,
        private readonly changeDetectionService: ChangeDetectionService
    ) {
        super(tenantContext);
    }

    async execute(input: {
        tenantId: string;
        eventType: string;
        entityId: string;
    }): Promise<void> {
        const entityType = ShopifyEntityType.fromString("order");

        const credentials = await this.connectorRepository.getCredentials(input.tenantId);
        const order = await this.shopifyClient.fetchOrderById({
            credentials,
            externalId: input.entityId,
        });

        if (!order) {
            logger.warn("webhook.order_not_found_in_shopify", {
                tenantId: input.tenantId,
                externalId: input.entityId,
            });
            return;
        }

        const hash = this.changeDetectionService.computeHash(order);
        const stored = await this.stagingRepository.findByExternalId(
            input.tenantId,
            entityType,
            input.entityId
        );

        if (!this.changeDetectionService.hasChanged(hash, stored)) {
            return;
        }

        await this.stagingRepository.upsert({
            tenantId: input.tenantId,
            entityType,
            externalId: input.entityId,
            parentExternalId: order.customerId ?? null,
            payload: order,
            payloadHash: hash.value,
            deleted: false,
            shopifyUpdatedAt: order.updatedAt,
            embedStatus: "pending",
            enrichStatus: "skip",
        });

        logger.info("webhook.order_staged", {
            tenantId: input.tenantId,
            externalId: input.entityId,
            eventType: input.eventType,
        });
    }
}