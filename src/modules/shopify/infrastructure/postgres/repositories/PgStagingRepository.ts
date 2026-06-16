import crypto from "crypto";
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
    private readonly table = shopifyStaging;

    async upsert(input: StagingUpsertInput): Promise<StagingRecord> {
        const db = requireDb();
        try {
            const [row] = await db
                .insert(this.table)
                .values({
                    id: crypto.randomUUID(),
                    tenantId: input.tenantId,
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
                    target: [this.table.tenantId, this.table.entityType, this.table.externalId],
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

            return StagingRowMapper.toDomain(row);
        } catch (error) {
            logger.error("PgStagingRepository.upsert.error", { input, error });
            throw error;
        }
    }

    async findByExternalId(
        tenantId: string,
        entityType: ShopifyEntityType,
        externalId: string
    ): Promise<StagingRecord | null> {
        const db = requireDb();
        const [row] = await db
            .select()
            .from(this.table)
            .where(
                and(
                    eq(this.table.tenantId, tenantId),
                    eq(this.table.entityType, entityType.getValue()),
                    eq(this.table.externalId, externalId)
                )
            )
            .limit(1);

        return row ? StagingRowMapper.toDomain(row) : null;
    }

    async findAllActiveExternalIds(tenantId: string, entityType: ShopifyEntityType): Promise<string[]> {
        const db = requireDb();
        const rows = await db
            .select({ externalId: this.table.externalId })
            .from(this.table)
            .where(
                and(
                    eq(this.table.tenantId, tenantId),
                    eq(this.table.entityType, entityType.getValue()),
                    eq(this.table.deleted, false)
                )
            );
        return rows.map(r => r.externalId);
    }

    async markDeleted(tenantId: string, entityType: ShopifyEntityType, externalId: string): Promise<void> {
        const db = requireDb();
        await db
            .update(this.table)
            .set({
                deleted: true,
                embedStatus: 'pending', // Queue for cleanup in vector store
                enrichStatus: 'skip',
                updatedAt: new Date()
            })
            .where(
                and(
                    eq(this.table.tenantId, tenantId),
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
        // Raw PG results need careful mapping
        return res.rows.map((row: any) => StagingRowMapper.toDomain(this.rawToDrizzle(row)));
    }

    async markEmbedProcessing(ids: string[]): Promise<void> {
        const db = requireDb();
        await db.update(this.table).set({ embedStatus: 'processing' }).where(inArray(this.table.id, ids));
    }

    async markEmbedCompleted(id: string, knowledgeDocumentId: string): Promise<void> {
        const db = requireDb();
        await db
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
        const db = requireDb();
        await db.update(this.table).set({ embedStatus: 'failed', embedError: error }).where(eq(this.table.id, id));
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
        const db = requireDb();
        await db.update(this.table).set({ enrichStatus: 'processing' }).where(inArray(this.table.id, ids));
    }

    async markEnrichCompleted(id: string, imageSignature: string): Promise<void> {
        const db = requireDb();
        await db
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
        const db = requireDb();
        await db.update(this.table).set({ enrichStatus: 'failed', enrichError: error }).where(eq(this.table.id, id));
    }

    async saveCursor(tenantId: string, jobId: string, cursor: SyncCursor): Promise<void> {
        // This usually goes to the sync_jobs table but requested here for management
        const db = requireDb();
        // Since syncJobs table exists, we use it directly
        // We'll use raw SQL or a dedicated repository if needed, but since we have drizzle:
        const { syncJobs } = await import("../../../../../modules/shopify/infrastructure/postgres/schema/job.schema");
        await db.update(syncJobs).set({ cursor: cursor as any }).where(eq(syncJobs.id, jobId));
    }

    async getCursor(tenantId: string, jobId: string): Promise<SyncCursor | null> {
        const db = requireDb();
        const { syncJobs } = await import("../../../../../modules/shopify/infrastructure/postgres/schema/job.schema");
        const [row] = await db.select({ cursor: syncJobs.cursor }).from(syncJobs).where(eq(syncJobs.id, jobId)).limit(1);
        return (row?.cursor as SyncCursor) || null;
    }

    async countPendingByTenant(tenantId: string): Promise<{ embedPending: number; enrichPending: number }> {
        const db = requireDb();
        const res = await db
            .select({
                embedPending: sql<number>`count(*) filter (where embed_status = 'pending')`,
                enrichPending: sql<number>`count(*) filter (where enrich_status = 'pending')`
            })
            .from(this.table)
            .where(eq(this.table.tenantId, tenantId));
        return res[0] || { embedPending: 0, enrichPending: 0 };
    }

    private rawToDrizzle(row: any): StagingRow {
        return {
            id: row.id,
            tenantId: row.tenant_id,
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
        };
    }
}
