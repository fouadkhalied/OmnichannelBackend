import jwt from "jsonwebtoken";
import crypto from "crypto";
import { AppUserModel, OrganizationModel, StoreModel } from "../../../../libs/shared/infrastructure/mongo/models";
import { hashPassword } from "../../../../libs/shared/crypto/password";
import { JtiStore } from "../../../../libs/shared/infrastructure/memory/JtiStore";
import { env } from "../../../../config/env";

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

export async function signupUseCase(input: SignupInput): Promise<SignupOutput> {
    const { email, password, displayName, organizationName } = input;

    // 1. Ensure email not already taken
    const existing = await AppUserModel.findOne({ email }).lean();
    if (existing) {
        throw Object.assign(new Error("Email already registered"), { statusCode: 409 });
    }

    // 2. Create Organization
    const organizationId = crypto.randomUUID();
    await OrganizationModel.create({
        id: organizationId,
        name: organizationName,
    });

    // 3. Create default Store
    const storeId = crypto.randomUUID();
    await StoreModel.create({
        id: storeId,
        organizationId,
        name: `${organizationName} Store`,
        platform: "shopify",
    });

    // 4. Hash password + create AppUser
    const passwordHash = await hashPassword(password);
    const userId = crypto.randomUUID();
    await AppUserModel.create({
        id: userId,
        organizationId,
        storeId,
        email,
        passwordHash,
        displayName: displayName ?? email,
        isActivated: true,
        activatedAt: new Date(),
        role: "admin",
        workspaces: [{ organizationId, storeId, role: "admin" }],
    });

    // 5. Issue JWT
    const jti = crypto.randomUUID();
    const expiresAt = Date.now() + TOKEN_TTL_S * 1000;
    const token = jwt.sign(
        { sub: userId, jti, organizationId, storeId },
        JWT_SECRET,
        { expiresIn: TOKEN_TTL_S }
    );

    JtiStore.set(jti, userId, expiresAt);

    return {
        token,
        user: { id: userId, email, organizationId, storeId },
    };
}
