import { NodePgDatabase } from "drizzle-orm/node-postgres";
import { desc, eq } from "drizzle-orm";
import * as schema from "../../../../../libs/shared/infrastructure/postgres/schema/index";
import { ITenantSyncLogRepository } from "../../../domain/repositories/ITenantSyncLogRepository";
import { tenantSyncLogs } from "../schema/tenantSyncLogs";

export class PgTenantSyncLogRepository implements ITenantSyncLogRepository {
    constructor(private readonly db: NodePgDatabase<typeof schema>) { }

    async create(data: any): Promise<any> {
        const [result] = await this.db.insert(tenantSyncLogs).values(data).returning();
        return result;
    }

    async findLatestByTenantId(tenantId: string): Promise<any> {
        const [result] = await this.db.select()
            .from(tenantSyncLogs)
            .where(eq(tenantSyncLogs.tenantId, tenantId))
            .orderBy(desc(tenantSyncLogs.syncedAt))
            .limit(1);
        return result;
    }
}
