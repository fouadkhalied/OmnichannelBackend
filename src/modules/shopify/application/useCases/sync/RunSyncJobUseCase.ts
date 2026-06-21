import { IConnectorRepository } from "../../../domain/repositories/IConnectorRepository";
import { ISyncJobRepository } from "../../../domain/repositories/ISyncJobRepository";
import { IStagingRepository } from "../../../domain/repositories/IStagingRepository";
import { IShopifyGraphQLClient } from "../../../domain/repositories/IShopifyGraphQLClient";
import { ShopifySyncJob } from "../../../domain/entities/ShopifySyncJob";
import { ChangeDetectionService } from "../../../domain/services/ChangeDetectionService";
import { MarkStaleEntitiesUseCase } from "./MarkStaleEntitiesUseCase";
import { ShopifyEntityType } from "../../../domain/valueObjects/ShopifyEntityType";
import { SyncCursor } from "../../../domain/types/SyncCursor";
import { logger } from "../../../../../libs/common/logger";

/**
 * RunSyncJobUseCase — intentionally NOT a BaseService.
 *
 * Workers are NOT request-scoped. This use case is constructed once and
 * processes jobs for any tenant. The tenant identity comes from job.tenantId,
 * NOT from a constructor-injected TenantContext singleton.
 */
export class RunSyncJobUseCase {
    constructor(
        private readonly shopifyClient: IShopifyGraphQLClient,
        private readonly stagingRepository: IStagingRepository,
        private readonly connectorRepository: IConnectorRepository,
        private readonly syncJobRepository: ISyncJobRepository,
        private readonly changeDetectionService: ChangeDetectionService,
        private readonly markStaleEntities: MarkStaleEntitiesUseCase
    ) {}

    async execute(job: ShopifySyncJob): Promise<void> {
        try {
            logger.info(`Starting RunSyncJobUseCase for tenant: ${job.storeId}`, { jobId: job.id });

            // 1. Load credentials — keyed by job.tenantId (the real tenant)
            const credentials = await this.connectorRepository.getCredentials(job.storeId);

            // 2. Restore cursor
            const fullCursor = await this.stagingRepository.getCursor(job.tenantId, job.id) || {
                productsCursor: null,
                customersCursor: null,
                ordersCursor: null,
            };

            // 3. Sync Products
            await this.syncEntityCollection({
                job,
                credentials,
                entityType: "product",
                cursor: fullCursor.productsCursor,
                pageSize: 50,
                fetchFn: this.shopifyClient.fetchProducts.bind(this.shopifyClient),
                onPageProgress: async (cursor) => {
                    fullCursor.productsCursor = cursor;
                    await this.saveCursor(job, fullCursor);
                },
            });

            // 4. Sync Customers
            try {
                await this.syncEntityCollection({
                    job,
                    credentials,
                    entityType: "customer",
                    cursor: fullCursor.customersCursor,
                    pageSize: 50,
                    fetchFn: this.shopifyClient.fetchCustomers.bind(this.shopifyClient),
                    onPageProgress: async (cursor) => {
                        fullCursor.customersCursor = cursor;
                        await this.saveCursor(job, fullCursor);
                    },
                });
            } catch (error: any) {
                if (error.name === "InsufficientScopeError") {
                    logger.warn("Skipping customers sync due to insufficient scope", { tenantId: job.tenantId });
                } else {
                    throw error;
                }
            }

            // 5. Sync Orders
            try {
                await this.syncEntityCollection({
                    job,
                    credentials,
                    entityType: "order",
                    cursor: fullCursor.ordersCursor,
                    pageSize: 50,
                    fetchFn: this.shopifyClient.fetchOrders.bind(this.shopifyClient),
                    onPageProgress: async (cursor) => {
                        fullCursor.ordersCursor = cursor;
                        await this.saveCursor(job, fullCursor);
                    },
                });
            } catch (error: any) {
                if (error.name === "InsufficientScopeError") {
                    logger.warn("Skipping orders sync due to insufficient scope", { tenantId: job.tenantId });
                } else {
                    throw error;
                }
            }

            // 6. Mark Completed
            await this.syncJobRepository.markCompleted(job.id, job.progress);

            logger.info(`Completed RunSyncJobUseCase for tenant: ${job.tenantId}`, { jobId: job.id });
        } catch (error: any) {
            logger.error("RunSyncJobUseCase failed", { jobId: job.id, error: error.message });
            throw error;
        }
    }

    private async syncEntityCollection(params: {
        job: ShopifySyncJob;
        credentials: any;
        entityType: "product" | "customer" | "order";
        cursor: string | null;
        pageSize: number;
        fetchFn: (input: any) => Promise<any>;
        onPageProgress: (cursor: string | null) => Promise<void>;
    }): Promise<void> {
        let currentCursor = params.cursor;
        let hasNextPage = true;
        const seenIds = new Set<string>();
        const shopifyEntityType = ShopifyEntityType.fromString(params.entityType);

        while (hasNextPage) {
            const page = await params.fetchFn({
                credentials: params.credentials,
                cursor: currentCursor,
                pageSize: params.pageSize,
            });

            for (const entity of page.items) {
                const hash = this.changeDetectionService.computeHash(entity);
                const stored = await this.stagingRepository.findByExternalId(
                    params.job.tenantId,
                    shopifyEntityType,
                    entity.externalId
                );

                if (this.changeDetectionService.hasChanged(hash, stored)) {
                    const enrichStatus =
                        this.changeDetectionService.needsImageEnrichment(shopifyEntityType, entity, stored)
                            ? "pending"
                            : "skip";

                    await this.stagingRepository.upsert({
                        tenantId: params.job.tenantId,
                        entityType: shopifyEntityType,
                        externalId: entity.externalId,
                        parentExternalId: (entity as any).productExternalId || null,
                        payload: entity,
                        payloadHash: hash.value,
                        deleted: false,
                        shopifyUpdatedAt: entity.updatedAt,
                        embedStatus: "pending",
                        enrichStatus,
                    });
                }
                seenIds.add(entity.externalId);
            }

            currentCursor = page.nextCursor;
            hasNextPage = page.hasNextPage;

            await params.onPageProgress(currentCursor);
            if (!hasNextPage) break;
        }

        await this.markStaleEntities.execute({
            tenantId: params.job.tenantId,
            entityType: shopifyEntityType,
            seenExternalIds: seenIds,
        });
    }

    private async saveCursor(job: ShopifySyncJob, cursor: SyncCursor): Promise<void> {
        await this.stagingRepository.saveCursor(job.tenantId, job.id, cursor);
    }
}
