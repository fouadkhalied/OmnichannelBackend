import { eq } from "drizzle-orm";
import { users, User, NewUser } from "../schema/users";
import { IPgUserRepository } from "./IPgUserRepository";

export class PgUserRepository implements IPgUserRepository {
    constructor(private readonly db: any) { }

    async upsert(input: NewUser): Promise<void> {
        await this.db
            .insert(users)
            .values(input)
            .onConflictDoUpdate({
                target: [users.email],
                set: {
                    displayName: input.displayName,
                    passwordHash: input.passwordHash,
                    role: input.role,
                    updatedAt: new Date(),
                },
            });
    }

    async findById(id: string): Promise<User | null> {
        const [result] = await this.db.select().from(users).where(eq(users.id, id)).limit(1);
        return result || null;
    }

    async findByEmail(email: string): Promise<User | null> {
        const [result] = await this.db.select().from(users).where(eq(users.email, email)).limit(1);
        return result || null;
    }

    async delete(id: string): Promise<void> {
        await this.db.delete(users).where(eq(users.id, id));
    }
}
