import { eq } from "drizzle-orm";
import { stores, Store, NewStore } from "../../../../../modules/auth/infrastructure/postgres/schema/stores";
import { IPgStoreRepository } from "./IPgStoreRepository";

export class PgStoreRepository implements IPgStoreRepository {
    constructor(private readonly db: any) { }

    async upsert(input: NewStore): Promise<Store> {
        const [result] = await this.db
            .insert(stores)
            .values(input)
            .onConflictDoUpdate({
                target: [stores.organizationId, stores.name],
                set: {
                    updatedAt: new Date(),
                },
            })
            .returning();
        return result;
    }

    async findById(id: string): Promise<Store | null> {
        const [result] = await this.db.select().from(stores).where(eq(stores.id, id)).limit(1);
        return result || null;
    }

    async findByOrganizationId(organizationId: string): Promise<Store[]> {
        return this.db.select().from(stores).where(eq(stores.organizationId, organizationId));
    }

    async delete(id: string): Promise<void> {
        await this.db.delete(stores).where(eq(stores.id, id));
    }
}
