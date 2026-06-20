import { IStagingRepository } from "../../../domain/repositories/IStagingRepository";
import { ShopifyEntityType } from "../../../domain/valueObjects/ShopifyEntityType";
import { logger } from "../../../../../libs/common/logger";

/**
 * After a full sync scan completes for an entity type,
 * diffs seen IDs against what's stored in Postgres and
 * marks anything missing as deleted (queues embedding worker to archive from Postgres).
 *
 * Note: This is NOT a BaseService because it runs in worker context
 * without a per-tenant HTTP request. It takes no tenantContext constructor arg.
 */
export class MarkStaleEntitiesUseCase {
    constructor(
        private readonly stagingRepository: IStagingRepository
    ) { }

    async execute(input: {
        tenantId: string;
        entityType: ShopifyEntityType;
        seenExternalIds: Set<string>;
    }): Promise<{ markedDeleted: number }> {
        const storedIds = await this.stagingRepository.findAllActiveExternalIds(
            input.tenantId,
            input.entityType
        );

        // IDs in Postgres that were NOT seen in this Shopify sync = deleted in Shopify
        const deletedIds = storedIds.filter((id) => !input.seenExternalIds.has(id));

        for (const id of deletedIds) {
            await this.stagingRepository.markDeleted(input.tenantId, input.entityType, id);
        }

        if (deletedIds.length > 0) {
            logger.info("MarkStaleEntitiesUseCase.marked_deleted", {
                tenantId: input.tenantId,
                entityType: input.entityType.getValue(),
                count: deletedIds.length,
                ids: deletedIds.slice(0, 10), // log first 10 only
            });
        }

        return { markedDeleted: deletedIds.length };
    }
}