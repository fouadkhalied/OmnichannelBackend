import { NodePgDatabase } from "drizzle-orm/node-postgres";
import { IPgUserWorkspaceRepository } from "./IPgUserWorkspaceRepository";
import { eq, and } from "drizzle-orm";
import { userWorkspaces } from "../schema";

export class PgUserWorkspaceRepository implements IPgUserWorkspaceRepository {
    constructor(private readonly db: NodePgDatabase<any>) { }

    async findByUserId(userId: string): Promise<any[]> {
        return this.db.select().from(userWorkspaces).where(eq(userWorkspaces.userId, userId));
    }

    async upsert(data: {
        userId: string;
        organizationId: string;
        storeId?: string;
        role?: string;
    }): Promise<void> {
        await this.db.insert(userWorkspaces).values({
            userId: data.userId,
            organizationId: data.organizationId,
            storeId: data.storeId,
            role: data.role ?? "member",
        }).onConflictDoUpdate({
            target: [userWorkspaces.userId, userWorkspaces.organizationId],
            set: {
                storeId: data.storeId,
                role: data.role ?? "member",
            }
        });
    }
}
