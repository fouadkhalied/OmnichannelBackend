import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { JtiStore } from "../../../../infrastructure/memory/JtiStore";
import { UnauthorizedError } from "../../../../domain/errors/UnauthorizedError";
import { env } from "../../../../../../config/env";

const JWT_SECRET = env.SESSION_SECRET || "dev-secret-change-in-production";

export const AuthMiddleware = async (req: Request, res: Response, next: NextFunction) => {
    try {
        let token = "";

        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith("Bearer ")) {
            token = authHeader.split(" ")[1];
        } else if (req.headers.cookie) {
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

        // ── 2. Check JTI in memory store ──────────────────────────────────
        const entry = JtiStore.get(payload.jti);
        if (!entry) {
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