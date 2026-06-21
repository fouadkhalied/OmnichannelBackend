import jwt from "jsonwebtoken";
import crypto from "crypto";
import { JtiStore } from "../../../../libs/shared/infrastructure/memory/JtiStore";
import { env } from "../../../../config/env";

export interface TokenPayload {
    sub: string;
    organizationId: string;
    storeId: string;
}

export class TokenService {
    private readonly secret = env.SESSION_SECRET;
    private readonly ttlSeconds = 60 * 60 * 24 * 7; // 7 days

    async generateToken(payload: TokenPayload): Promise<string> {
        const jti = crypto.randomUUID();
        const expiresAt = Date.now() + this.ttlSeconds * 1000;

        const token = jwt.sign(
            {
                ...payload,
                jti
            },
            this.secret,
            { expiresIn: this.ttlSeconds }
        );

        JtiStore.set(jti, payload.sub, expiresAt);

        return token;
    }
}
