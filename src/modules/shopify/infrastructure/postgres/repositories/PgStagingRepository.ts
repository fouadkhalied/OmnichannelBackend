import { eq, and, inArray, sql } from "drizzle-orm";
import { BaseRepository } from "../../../../../libs/shared/application/BaseRepository";
import { requireDb, getPool } from "../../../../../libs/shared/infrastructure/postgres/PgClient";
import {
    IStagingRepository,
    StagingUpsertInput,
    StagingRecord
} from "../../../domain/repositories/IStagingRepository";
import { SyncCursor } from "../../../domain/types/SyncCursor";
import { ShopifyEntityType } from "../../../domain/valueObjects/ShopifyEntityType";
import { StagingRowMapper } from "../mappers/StagingRowMapper";
import { logger } from "../../../../../libs/common/logger";
import { shopifyStaging, StagingRow } from "../schema/stadging.schema";

export class PgStagingRepository extends BaseRepository implements IStagingRepository {
    constructor(private readonly db: any = requireDb()) {
        super();
    }
    private readonly table = shopifyStaging;

    async upsert(input: StagingUpsertInput): Promise<StagingRecord> {
        try {
            const [row] = await this.db
                .insert(this.table)
                .values({
                    storeId: input.tenantId as any, // Expecting UUID here now
                    entityType: input.entityType.getValue(),
                    externalId: input.externalId,
                    parentExternalId: input.parentExternalId,
                    payload: input.payload as any,
                    payloadHash: input.payloadHash,
                    deleted: input.deleted,
                    shopifyUpdatedAt: input.shopifyUpdatedAt,
                    embedStatus: input.embedStatus,
                    enrichStatus: input.enrichStatus,
                })
                .onConflictDoUpdate({
                    target: [this.table.storeId, this.table.entityType, this.table.externalId],
                    set: {
                        payload: input.payload as any,
                        payloadHash: input.payloadHash,
                        deleted: input.deleted,
                        embedStatus: input.embedStatus,
                        enrichStatus: input.enrichStatus,
                        shopifyUpdatedAt: input.shopifyUpdatedAt,
                        updatedAt: new Date(),
                    },
                })
                .returning();

            return StagingRowMapper.toDomain(row as any);
        } catch (error) {
            logger.error("PgStagingRepository.upsert.error", { input, error });
            throw error;
        }
    }

    async findByExternalId(
        storeId: string,
        entityType: ShopifyEntityType,
        externalId: string
    ): Promise<StagingRecord | null> {
        const [row] = await this.db
            .select()
            .from(this.table)
            .where(
                and(
                    eq(this.table.storeId, storeId as any),
                    eq(this.table.entityType, entityType.getValue()),
                    eq(this.table.externalId, externalId)
                )
            )
            .limit(1);

        return row ? StagingRowMapper.toDomain(row as any) : null;
    }

    async findAllActiveExternalIds(storeId: string, entityType: ShopifyEntityType): Promise<string[]> {
        const rows = await this.db
            .select({ externalId: this.table.externalId })
            .from(this.table)
            .where(
                and(
                    eq(this.table.storeId, storeId as any),
                    eq(this.table.entityType, entityType.getValue()),
                    eq(this.table.deleted, false)
                )
            );
        return rows.map((r: any) => r.externalId);
    }

    async markDeleted(storeId: string, entityType: ShopifyEntityType, externalId: string): Promise<void> {
        await this.db
            .update(this.table)
            .set({
                deleted: true,
                embedStatus: 'pending', // Queue for cleanup in vector store
                enrichStatus: 'skip',
                updatedAt: new Date()
            })
            .where(
                and(
                    eq(this.table.storeId, storeId as any),
                    eq(this.table.entityType, entityType.getValue()),
                    eq(this.table.externalId, externalId)
                )
            );
    }

    async claimNextPendingEmbedding(batchSize: number): Promise<StagingRecord[]> {
        const pool = getPool();
        const query = `
            UPDATE shopify_staging
            SET embed_status = 'processing', updated_at = now()
            WHERE id IN (
                SELECT id FROM shopify_staging
                WHERE embed_status = 'pending'
                ORDER BY updated_at ASC
                LIMIT $1
                FOR UPDATE SKIP LOCKED
            )
            RETURNING *
        `;
        const res = await pool.query(query, [batchSize]);
        return res.rows.map((row: any) => StagingRowMapper.toDomain(this.rawToDrizzle(row)));
    }

    async markEmbedProcessing(ids: string[]): Promise<void> {
        await this.db.update(this.table).set({ embedStatus: 'processing' }).where(inArray(this.table.id, ids));
    }

    async markEmbedCompleted(id: string, knowledgeDocumentId: string): Promise<void> {
        await this.db
            .update(this.table)
            .set({
                embedStatus: 'completed',
                knowledgeDocumentId,
                lastEmbeddedAt: new Date(),
                updatedAt: new Date()
            })
            .where(eq(this.table.id, id));
    }

    async markEmbedFailed(id: string, error: string): Promise<void> {
        await this.db.update(this.table).set({ embedStatus: 'failed', embedError: error }).where(eq(this.table.id, id));
    }

    async claimNextPendingEnrichment(batchSize: number): Promise<StagingRecord[]> {
        const pool = getPool();
        const query = `
            UPDATE shopify_staging
            SET enrich_status = 'processing', updated_at = now()
            WHERE id IN (
                SELECT id FROM shopify_staging
                WHERE enrich_status = 'pending'
                AND embed_status = 'completed'
                AND entity_type = 'product'
                AND deleted = false
                ORDER BY updated_at ASC
                LIMIT $1
                FOR UPDATE SKIP LOCKED
            )
            RETURNING *
        `;
        const res = await pool.query(query, [batchSize]);
        return res.rows.map((row: any) => StagingRowMapper.toDomain(this.rawToDrizzle(row)));
    }

    async markEnrichProcessing(ids: string[]): Promise<void> {
        await this.db.update(this.table).set({ enrichStatus: 'processing' }).where(inArray(this.table.id, ids));
    }

    async markEnrichCompleted(id: string, imageSignature: string): Promise<void> {
        await this.db
            .update(this.table)
            .set({
                enrichStatus: 'completed',
                imageSignature,
                lastEnrichedAt: new Date(),
                updatedAt: new Date()
            })
            .where(eq(this.table.id, id));
    }

    async markEnrichFailed(id: string, error: string): Promise<void> {
        await this.db.update(this.table).set({ enrichStatus: 'failed', enrichError: error }).where(eq(this.table.id, id));
    }

    async saveCursor(storeId: string, jobId: string, cursor: SyncCursor): Promise<void> {
        const { syncJobs } = await import("../../../../../libs/shared/infrastructure/postgres/schema/syncJobs");
        await this.db.update(syncJobs as any).set({ cursor: cursor as any }).where(eq((syncJobs as any).id, jobId));
    }

    async getCursor(storeId: string, jobId: string): Promise<SyncCursor | null> {
        const { syncJobs } = await import("../../../../../libs/shared/infrastructure/postgres/schema/syncJobs");
        const [row] = await this.db.select({ cursor: (syncJobs as any).cursor }).from(syncJobs as any).where(eq((syncJobs as any).id, jobId)).limit(1);
        return (row?.cursor as SyncCursor) || null;
    }

    async countPendingByTenant(storeId: string): Promise<{ embedPending: number; enrichPending: number }> {
        const res = await this.db
            .select({
                embedPending: sql<number>`count(*) filter (where embed_status = 'pending')`,
                enrichPending: sql<number>`count(*) filter (where enrich_status = 'pending')`
            })
            .from(this.table)
            .where(eq(this.table.storeId, storeId as any));
        return res[0] || { embedPending: 0, enrichPending: 0 };
    }

    private rawToDrizzle(row: any): StagingRow {
        return {
            id: row.id,
            storeId: row.store_id,
            entityType: row.entity_type,
            externalId: row.external_id,
            parentExternalId: row.parent_external_id,
            payload: row.payload,
            payloadHash: row.payload_hash,
            deleted: row.deleted,
            shopifyUpdatedAt: row.shopify_updated_at,
            embedStatus: row.embed_status,
            enrichStatus: row.enrich_status,
            knowledgeDocumentId: row.knowledge_document_id,
            imageSignature: row.image_signature,
            embedError: row.embed_error,
            enrichError: row.enrich_error,
            lastEmbeddedAt: row.last_embedded_at,
            lastEnrichedAt: row.last_enriched_at,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
        } as any;
    }
}
