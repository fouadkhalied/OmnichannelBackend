import { eq, and, inArray, desc } from "drizzle-orm";
import { requireDb, getPool } from "../../../../../libs/shared/infrastructure/postgres/PgClient";
import { ISyncJobRepository } from "../../../domain/repositories/ISyncJobRepository";
import { ShopifySyncJob, SyncJobType, SyncProgress } from "../../../domain/entities/ShopifySyncJob";
import { SyncCursor } from "../../../domain/types/SyncCursor";
import { SyncJobStatus } from "../../../domain/valueObjects/SyncJobStatus";
import { logger } from "../../../../../libs/common/logger";
import { syncJobs, SyncJob as SyncJobRow } from "../../../../../libs/shared/infrastructure/postgres/schema/syncJobs";

export class PgSyncJobRepository implements ISyncJobRepository {
    constructor(private readonly db: any = requireDb()) { }

    private toDomain(row: SyncJobRow): ShopifySyncJob {
        return new ShopifySyncJob(
            row.id,
            row.storeId as any,
            row.type as SyncJobType,
            SyncJobStatus.fromString(row.status),
            row.progress as SyncProgress,
            row.cursor as SyncCursor | null,
            row.triggeredBy ?? "system",
            row.attempts ?? 0,
            row.maxAttempts ?? 5,
            row.error,
            row.startedAt,
            row.finishedAt,
            row.nextRunAt,
            row.createdAt,
            row.updatedAt
        );
    }

    async findActiveSyncJob(storeId: string): Promise<ShopifySyncJob | null> {
        try {
            const [row] = await this.db
                .select()
                .from(syncJobs)
                .where(
                    and(
                        eq(syncJobs.storeId, storeId as any),
                        inArray(syncJobs.status, ["pending", "running", "retry_scheduled"])
                    )
                )
                .orderBy(desc(syncJobs.createdAt))
                .limit(1);

            return row ? this.toDomain(row as any) : null;
        } catch (error) {
            logger.error("PgSyncJobRepository.findActiveSyncJob.error", { storeId, error });
            throw error;
        }
    }

    async findLatestFailedJob(storeId: string): Promise<ShopifySyncJob | null> {
        try {
            const [row] = await this.db
                .select()
                .from(syncJobs)
                .where(
                    and(
                        eq(syncJobs.storeId, storeId as any),
                        eq(syncJobs.status, "failed")
                    )
                )
                .orderBy(desc(syncJobs.createdAt))
                .limit(1);

            return row ? this.toDomain(row as any) : null;
        } catch (error) {
            logger.error("PgSyncJobRepository.findLatestFailedJob.error", { storeId, error });
            throw error;
        }
    }

    async createSyncJob(input: { storeId: string; type: SyncJobType; triggeredBy: string }): Promise<ShopifySyncJob> {
        try {
            const id = `sync_${crypto.randomUUID()}`;
            const [row] = await this.db
                .insert(syncJobs)
                .values({
                    id,
                    storeId: input.storeId as any,
                    type: input.type,
                    status: "pending",
                    triggeredBy: input.triggeredBy,
                    progress: { products: 0, variants: 0, inventory: 0, customers: 0, orders: 0 },
                    attempts: 0,
                    maxAttempts: 5,
                })
                .returning();

            return this.toDomain(row as any);
        } catch (error) {
            logger.error("PgSyncJobRepository.createSyncJob.error", { input, error });
            throw error;
        }
    }

    async findById(jobId: string): Promise<ShopifySyncJob | null> {
        const [row] = await this.db.select().from(syncJobs).where(eq(syncJobs.id, jobId)).limit(1);
        return row ? this.toDomain(row as any) : null;
    }

    async updateStatus(jobId: string, status: SyncJobStatus, extra?: Partial<ShopifySyncJob>): Promise<void> {
        const updateData: any = {
            status: status.getValue(),
            updatedAt: new Date(),
        };

        if (extra) {
            if (extra.error !== undefined) updateData.error = extra.error;
            if (extra.attempts !== undefined) updateData.attempts = extra.attempts;
            if (extra.startedAt !== undefined) updateData.startedAt = extra.startedAt;
            if (extra.finishedAt !== undefined) updateData.finishedAt = extra.finishedAt;
        }

        await this.db.update(syncJobs).set(updateData).where(eq(syncJobs.id, jobId));
    }

    async markCompleted(jobId: string, progress: SyncProgress): Promise<void> {
        await this.db
            .update(syncJobs)
            .set({
                status: "completed",
                progress,
                finishedAt: new Date(),
                updatedAt: new Date(),
            })
            .where(eq(syncJobs.id, jobId));
    }

    async markFailed(jobId: string, error: string, attempts: number, nextRunAt: Date): Promise<void> {
        await this.db
            .update(syncJobs)
            .set({
                status: "failed",
                error,
                attempts,
                nextRunAt,
                updatedAt: new Date(),
            })
            .where(eq(syncJobs.id, jobId));
    }

    async claimNextPendingJob(): Promise<ShopifySyncJob | null> {
        const pool = getPool();
        const client = await pool.connect();
        try {
            await client.query("BEGIN");
            const res = await client.query(`
                SELECT * FROM sync_jobs 
                WHERE status IN ('pending', 'retry_scheduled') 
                AND next_run_at <= NOW() 
                ORDER BY created_at ASC 
                LIMIT 1 
                FOR UPDATE SKIP LOCKED
            `);

            if (res.rows.length === 0) {
                await client.query("ROLLBACK");
                return null;
            }

            const row = res.rows[0];

            const domainRow: any = {
                id: row.id,
                storeId: row.store_id,
                provider: row.provider,
                type: row.type,
                status: row.status,
                progress: row.progress,
                cursor: row.cursor,
                triggeredBy: row.triggered_by,
                attempts: row.attempts,
                maxAttempts: row.max_attempts,
                error: row.error,
                startedAt: row.started_at,
                finishedAt: row.finished_at,
                nextRunAt: row.next_run_at,
                createdAt: row.created_at,
                updatedAt: row.updated_at
            };

            await client.query("UPDATE sync_jobs SET status = 'running', started_at = NOW(), updated_at = NOW() WHERE id = $1", [row.id]);
            await client.query("COMMIT");

            return this.toDomain(domainRow as SyncJobRow);
        } catch (error) {
            await client.query("ROLLBACK");
            logger.error("PgSyncJobRepository.claimNextPendingJob.error", { error });
            throw error;
        } finally {
            client.release();
        }
    }
}
