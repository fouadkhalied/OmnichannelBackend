import jwt from "jsonwebtoken";
import crypto from "crypto";
import { AppUserModel } from "../../../../libs/shared/infrastructure/mongo/models";
import { verifyPassword } from "../../../../libs/shared/crypto/password";
import { JtiStore } from "../../../../libs/shared/infrastructure/memory/JtiStore";
import { env } from "../../../../config/env";

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

export async function loginUseCase(input: LoginInput): Promise<LoginOutput> {
    // 1. Find user — explicitly select passwordHash (it's hidden by default)
    const user = await AppUserModel.findOne({ email: input.email }).select("+passwordHash").lean();

    if (!user || !user.passwordHash) {
        throw Object.assign(new Error("Invalid email or password"), { statusCode: 401 });
    }

    // 2. Verify password
    const valid = await verifyPassword(input.password, user.passwordHash);
    if (!valid) {
        throw Object.assign(new Error("Invalid email or password"), { statusCode: 401 });
    }

    // 3. Issue JWT
    const jti = crypto.randomUUID();
    const organizationId = user.organizationId;
    const storeId = user.storeId ?? "";
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
}
