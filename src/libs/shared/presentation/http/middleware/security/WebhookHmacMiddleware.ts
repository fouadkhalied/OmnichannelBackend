import { Request, Response, NextFunction } from "express";
import { createHmac, timingSafeEqual } from "crypto";
import { UnauthorizedError } from "../../../../domain/errors/UnauthorizedError";

export const WebhookHmacMiddleware = (req: Request, res: Response, next: NextFunction) => {
    try {
        const hmacHeader = req.headers["x-shopify-hmac-sha256"];
        if (!hmacHeader) {
            throw new UnauthorizedError("HMAC header missing");
        }

        const secret = process.env.SHOPIFY_WEBHOOK_SECRET || "";
        const rawBody = (req as any).rawBody;

        if (!rawBody) {
            throw new UnauthorizedError("Raw body missing for validation");
        }

        const hash = createHmac("sha256", secret).update(rawBody).digest("base64");

        if (!timingSafeEqual(Buffer.from(hash), Buffer.from(String(hmacHeader)))) {
            throw new UnauthorizedError("HMAC validation failed");
        }

        next();
    } catch (error) {
        next(error);
    }
};
