import { NodePgDatabase } from "drizzle-orm/node-postgres";
import { eq } from "drizzle-orm";
import * as schema from "../../../../../libs/shared/infrastructure/postgres/schema/index";
import { ITenantRepository } from "../../../domain/repositories/ITenantRepository";
import { tenants } from "../schema/tenants";

export class PgTenantRepository implements ITenantRepository {
    constructor(private readonly db: NodePgDatabase<typeof schema>) { }

    async upsert(data: any): Promise<any> {
        const [result] = await this.db.insert(tenants)
            .values(data)
            .onConflictDoUpdate({
                target: [tenants.id],
                set: data,
            })
            .returning();
        return result;
    }

    async findById(id: string): Promise<any> {
        const [result] = await this.db.select().from(tenants).where(eq(tenants.id, id)).limit(1);
        return result;
    }

    async findByEmail(email: string): Promise<any> {
        const [result] = await this.db.select().from(tenants).where(eq(tenants.email, email)).limit(1);
        return result;
    }
}
