import { Request, Response, NextFunction } from "express";
import { RateLimiterStore } from "../../../../infrastructure/redis/RateLimiterStore";
import { RateLimitExceededError } from "../../../../domain/errors/RateLimitExceededError";

const store = new RateLimiterStore();

export const RateLimiterMiddleware = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const ip = req.ip || "unknown";
        const tenantId = req.tenantContext!.organizationId;
        const key = `ratelimit:${ip}:${tenantId}`;

        const count = await store.increment(key, 60);
        if (count > 100) {
            throw new RateLimitExceededError();
        }
        next();
    } catch (error) {
        if (error instanceof RateLimitExceededError) {
            next(error);
        } else {
            console.error("RateLimiter Redis failure:", error);
            next();
        }
    }
};
