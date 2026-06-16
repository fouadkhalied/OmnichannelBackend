import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { RedisClient } from "../../../../infrastructure/redis/RedisClient";
import { UnauthorizedError } from "../../../../domain/errors/UnauthorizedError";
import { env } from "../../../../../../config/env";

const redis = RedisClient.getInstance();

const JWT_SECRET = env.SESSION_SECRET || "dev-secret-change-in-production";

export const AuthMiddleware = async (req: Request, res: Response, next: NextFunction) => {
    try {
        let token = "";

        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith("Bearer ")) {
            token = authHeader.split(" ")[1];
        } else if (req.headers.cookie) {
            // Attempt to parse token from cookies (supports credentials: "include")
            const match = req.headers.cookie.match(/(?:token|accessToken|access_token|session)=([^;]+)/);
            if (match) {
                token = match[1];
            }
        }

        if (!token) {
            return next(new UnauthorizedError("Token missing"));
        }

        // ── 1. Verify JWT signature ───────────────────────────────────────
        let payload: any;
        try {
            payload = jwt.verify(token, JWT_SECRET) as any;
        } catch (err: any) {
            if (err.name === "TokenExpiredError") {
                return next(new UnauthorizedError("Token expired"));
            }
            return next(new UnauthorizedError("Invalid token signature"));
        }

        if (!payload?.sub || !payload?.jti) {
            return next(new UnauthorizedError("Token payload invalid"));
        }

        // ── 2. Check jti whitelist in Redis ───────────────────────────────
        // Design: auth:jti:{jti} EXISTS means token is VALID
        // Missing key means token was revoked or never issued
        const jtiKey = `auth:jti:${payload.jti}`;
        let jtiRecord: string | null = null;

        try {
            jtiRecord = await redis.get(jtiKey);
        } catch {
            // Redis failure on auth is BLOCKING — do not fall through
            return next(new UnauthorizedError("Auth service unavailable"));
        }

        if (!jtiRecord) {
            // Key missing = token revoked or not in whitelist
            return next(new UnauthorizedError("Token revoked or invalid"));
        }

        // ── 3. Attach identity to request ─────────────────────────────────
        req.userId = String(payload.sub);
        req.jti = String(payload.jti);
        (req as any).user = {
            claims: {
                sub: payload.sub,
                organizationId: payload.organizationId,
                storeId: payload.storeId,
            },
        };

        next();
    } catch (error) {
        next(new UnauthorizedError("Authentication failed"));
    }
};