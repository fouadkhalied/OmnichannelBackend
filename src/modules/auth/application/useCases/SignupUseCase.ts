import jwt from "jsonwebtoken";
import crypto from "crypto";
import { hashPassword } from "../../../../libs/shared/crypto/password";
import { JtiStore } from "../../../../libs/shared/infrastructure/memory/JtiStore";
import { env } from "../../../../config/env";
import { UnitOfWorkFactory } from "../../../../libs/shared/infrastructure/postgres/unitOfWork/UnitOfWorkFactory";
import { IUnitOfWork } from "../../../../libs/shared/infrastructure/postgres/unitOfWork/IUnitOfWork";

export interface SignupInput {
    email: string;
    password: string;
    displayName?: string;
    organizationName: string;
}

export interface SignupOutput {
    token: string;
    user: {
        id: string;
        email: string;
        organizationId: string;
        storeId: string;
    };
}

const JWT_SECRET = env.SESSION_SECRET;
const TOKEN_TTL_S = 60 * 60 * 24 * 7; // 7 days

export class SignupUseCase {
    constructor(private readonly uowFactory: UnitOfWorkFactory) { }

    async execute(input: SignupInput): Promise<SignupOutput> {
        const { email, password, displayName, organizationName } = input;

        return this.uowFactory.execute(async (uow: IUnitOfWork) => {
            // 1. Ensure email not already taken
            const existing = await uow.users.findByEmail(email);
            if (existing) {
                throw Object.assign(new Error("Email already registered"), { statusCode: 409 });
            }

            // 2. Create Organization
            const organization = await uow.organizations.upsert({
                name: organizationName,
            });

            // 3. Create default Store
            const store = await uow.stores.upsert({
                organizationId: organization.id,
                name: `${organizationName} Store`,
                platform: "shopify",
            });

            // 4. Hash password + create AppUser
            const passwordHash = await hashPassword(password);

            // We need to handle workspaces too if we want full parity, 
            // but for now let's focus on the primary links.
            // In the relational schema, users can have organizationId and storeId directly for simplicity in some views,
            // or we use userWorkspaces.

            const userId = crypto.randomUUID();
            await uow.users.upsert({
                id: userId,
                email,
                passwordHash,
                displayName: displayName ?? email,
                isActivated: true,
                activatedAt: new Date(),
                role: "admin",
            });

            // 5. Issue JWT
            const jti = crypto.randomUUID();
            const expiresAt = Date.now() + TOKEN_TTL_S * 1000;
            const token = jwt.sign(
                { sub: userId, jti, organizationId: organization.id, storeId: store.id },
                JWT_SECRET,
                { expiresIn: TOKEN_TTL_S }
            );

            JtiStore.set(jti, userId, expiresAt);

            return {
                token,
                user: { id: userId, email, organizationId: organization.id, storeId: store.id },
            };
        });
    }
}
