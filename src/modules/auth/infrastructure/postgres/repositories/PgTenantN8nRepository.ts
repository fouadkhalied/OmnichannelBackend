import { NodePgDatabase } from "drizzle-orm/node-postgres";
import { eq } from "drizzle-orm";
import * as schema from "../../../../../libs/shared/infrastructure/postgres/schema/index";
import { ITenantN8nRepository } from "../../../domain/repositories/ITenantN8nRepository";
import { tenantN8n } from "../schema/tenantN8n";

export class PgTenantN8nRepository implements ITenantN8nRepository {
    constructor(private readonly db: NodePgDatabase<typeof schema>) { }

    async upsert(data: any): Promise<any> {
        const [result] = await this.db.insert(tenantN8n)
            .values(data)
            .onConflictDoUpdate({
                target: tenantN8n.tenantId,
                set: data,
            })
            .returning();
        return result;
    }

    async findByTenantId(tenantId: string): Promise<any> {
        const [result] = await this.db.select().from(tenantN8n).where(eq(tenantN8n.tenantId, tenantId)).limit(1);
        return result;
    }
}
