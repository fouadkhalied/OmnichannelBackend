import { eq } from "drizzle-orm";
import { organizations, Organization, NewOrganization } from "../schema/organizations";
import { IPgOrganizationRepository } from "./IPgOrganizationRepository";

export class PgOrganizationRepository implements IPgOrganizationRepository {
    constructor(private readonly db: any) { }

    async upsert(input: NewOrganization): Promise<Organization> {
        const [result] = await this.db
            .insert(organizations)
            .values(input)
            .onConflictDoUpdate({
                target: organizations.id,
                set: {
                    updatedAt: new Date(),
                },
            })
            .returning();
        return result;
    }

    async findById(id: string): Promise<Organization | null> {
        const [result] = await this.db.select().from(organizations).where(eq(organizations.id, id)).limit(1);
        return result || null;
    }

    async delete(id: string): Promise<void> {
        await this.db.delete(organizations).where(eq(organizations.id, id));
    }
}
