import { BaseService } from "../../../../../libs/shared/application/BaseService";
import { TenantContext } from "../../../../../libs/shared/domain/valueObjects/TenantContext";
import { IShopifyGraphQLClient } from "../../../domain/repositories/IShopifyGraphQLClient";
import { IConnectorRepository } from "../../../domain/repositories/IConnectorRepository";
import { IStagingRepository } from "../../../domain/repositories/IStagingRepository";
import { ChangeDetectionService } from "../../../domain/services/ChangeDetectionService";
import { ShopifyEntityType } from "../../../domain/valueObjects/ShopifyEntityType";
import { logger } from "../../../../../libs/common/logger";
import { N8nForwardingService } from "../../../../n8n/N8nForwardingService";

export class ProcessOrderWebhookUseCase extends BaseService {
    constructor(
        tenantContext: TenantContext,
        private readonly shopifyClient: IShopifyGraphQLClient,
        private readonly connectorRepository: IConnectorRepository,
        private readonly stagingRepository: IStagingRepository,
        private readonly changeDetectionService: ChangeDetectionService,
        private readonly n8nForwardingService: N8nForwardingService,
        private readonly uowFactory: any // UnitOfWorkFactory
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

        // ── Atomic Update via Unit of Work ────────────────────────────────
        await this.uowFactory.execute(async ({ orders, orderLineItems, customers }: any) => {
            // 1. Ensure Customer exists if linked
            let internalCustomerId: string | undefined;
            if (order.customerId) {
                const customer = await customers.findByShopifyId(input.tenantId, order.customerId);
                internalCustomerId = customer?.id;
            }

            // 2. Update Core Order Table
            const savedOrder = await orders.upsert({
                tenantId: input.tenantId,
                shopifyId: input.entityId,
                orderNumber: order.name, // ShopifyOrder has 'name' which usually is the order number
                customerId: internalCustomerId,
                shopifyCustomerId: order.customerId,
                email: (order as any).email, // Check if exists
                phone: (order as any).phone,
                financialStatus: order.financialStatus,
                fulfillmentStatus: order.fulfillmentStatus,
                totalPrice: order.totalPrice,
                currency: order.currency,
                data: order,
                shopifyUpdatedAt: order.updatedAt,
            });

            // 3. Update Line Items
            if (order.lineItems && Array.isArray(order.lineItems)) {
                await orderLineItems.deleteByOrder(savedOrder.id);
                for (const item of order.lineItems) {
                    await orderLineItems.upsert({
                        tenantId: input.tenantId,
                        orderId: savedOrder.id,
                        shopifyId: (item as any).id || crypto.randomUUID(), // ShopifyLineItem might not have ID in some payload versions
                        title: item.title,
                        quantity: item.quantity,
                        price: item.price,
                        data: item,
                    });
                }
            }

            // 4. Update Legacy Staging table
            await this.stagingRepository.upsert({
                tenantId: input.tenantId,
                entityType,
                externalId: input.entityId,
                parentExternalId: order.customerId || null,
                payload: order,
                payloadHash: hash.value,
                deleted: false,
                shopifyUpdatedAt: order.updatedAt,
                embedStatus: "pending",
                enrichStatus: "skip",
            });
        });

        // ── Forward to n8n ────────────────────────────────────────────────
        await this.n8nForwardingService.forwardWebhookEvent({
            organizationId: this.tenantContext.organizationId!,
            topic: input.eventType,
            tenantId: input.tenantId,
            payload: order
        });

        logger.info("webhook.order_migrated", {
            tenantId: input.tenantId,
            externalId: input.entityId,
            eventType: input.eventType,
        });
    }
}
