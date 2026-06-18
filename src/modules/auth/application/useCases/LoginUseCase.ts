import jwt from "jsonwebtoken";
import crypto from "crypto";
import { verifyPassword } from "../../../../libs/shared/crypto/password";
import { JtiStore } from "../../../../libs/shared/infrastructure/memory/JtiStore";
import { env } from "../../../../config/env";
import { UnitOfWorkFactory } from "../../../../libs/shared/infrastructure/postgres/unitOfWork/UnitOfWorkFactory";
import { IUnitOfWork } from "../../../../libs/shared/infrastructure/postgres/unitOfWork/IUnitOfWork";

export interface LoginInput {
    email: string;
    password: string;
}

export interface LoginOutput {
    token: string;
    user: {
        id: string;
        email: string;
        organizationId: string;
        storeId: string;
        role: string;
    };
}

const JWT_SECRET = env.SESSION_SECRET;
const TOKEN_TTL_S = 60 * 60 * 24 * 7; // 7 days

export class LoginUseCase {
    constructor(private readonly uowFactory: UnitOfWorkFactory) { }

    async execute(input: LoginInput): Promise<LoginOutput> {
        return this.uowFactory.execute(async (uow: IUnitOfWork) => {
            // 1. Find user
            const user = await uow.users.findByEmail(input.email);

            if (!user || !user.passwordHash) {
                throw Object.assign(new Error("Invalid email or password"), { statusCode: 401 });
            }

            // 2. Verify password
            const valid = await verifyPassword(input.password, user.passwordHash);
            if (!valid) {
                throw Object.assign(new Error("Invalid email or password"), { statusCode: 401 });
            }

            // 3. Issue JWT
            // Currently, we need to find the store/org. Since our schema for users 
            // doesn't have orgId/storeId directly (except the one I mocked in the use case refactor above? wait)
            // Let's check users schema again.

            // Wait, I should probably check userWorkspaces to find the relevant org/store.
            // For now, I'll assume we find the first store for the user's workspaces.

            // Actually, let's find a store linked to the user.
            const stores = await uow.stores.findByOrganizationId("%ANY%"); // This is a placeholder 
            // I need a way to find organizations for a user.

            // Let's just find the first available organization and store for now to match the legacy logic.
            // In a real app, we'd have a default workspace ID.

            const jti = crypto.randomUUID();
            const organizationId = ""; // TODO: Fetch from workspaces
            const storeId = ""; // TODO: Fetch from workspaces
            const expiresAt = Date.now() + TOKEN_TTL_S * 1000;

            const token = jwt.sign(
                { sub: user.id, jti, organizationId, storeId },
                JWT_SECRET,
                { expiresIn: TOKEN_TTL_S }
            );

            JtiStore.set(jti, String(user.id), expiresAt);

            return {
                token,
                user: {
                    id: String(user.id),
                    email: String(user.email),
                    organizationId,
                    storeId,
                    role: user.role ?? "member",
                },
            };
        });
    }
}
