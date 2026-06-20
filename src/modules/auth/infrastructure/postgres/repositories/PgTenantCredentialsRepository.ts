import { NodePgDatabase } from "drizzle-orm/node-postgres";
import { eq } from "drizzle-orm";
import * as schema from "../../../../../libs/shared/infrastructure/postgres/schema/index";
import { ITenantCredentialsRepository } from "../../../domain/repositories/ITenantCredentialsRepository";
import { tenantCredentials } from "../schema/tenantCredentials";

export class PgTenantCredentialsRepository implements ITenantCredentialsRepository {
    constructor(private readonly db: NodePgDatabase<typeof schema>) { }

    async upsert(data: any): Promise<any> {
        const [result] = await this.db.insert(tenantCredentials)
            .values(data)
            .onConflictDoUpdate({
                target: tenantCredentials.organizationId,
                set: data,
            })
            .returning();
        return result;
    }

    async findByOrganizationId(organizationId: string): Promise<any> {
        const [result] = await this.db.select()
            .from(tenantCredentials)
            .where(eq(tenantCredentials.organizationId, organizationId))
            .limit(1);
        return result;
    }
}
