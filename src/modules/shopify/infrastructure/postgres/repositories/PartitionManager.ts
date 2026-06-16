import { getPool } from "../../../../../libs/shared/infrastructure/postgres/PgClient";
import { logger } from "../../../../../libs/common/logger";

export async function createTenantPartition(tenantId: string): Promise<void> {
    const pool = getPool();
    const sanitizedId = tenantId.replace(/[^a-z0-9_]/gi, "_");
    const partitionName = `shopify_staging_${sanitizedId}`;

    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS ${partitionName} 
            PARTITION OF shopify_staging 
            FOR VALUES IN ('${tenantId}')
        `);
        logger.info("PartitionManager.createTenantPartition.success", { tenantId, partitionName });
    } catch (error) {
        logger.error("PartitionManager.createTenantPartition.error", {
            tenantId,
            partitionName,
            error: error instanceof Error ? error.message : String(error)
        });
        throw error;
    }
}
