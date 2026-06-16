import { Request, Response, NextFunction } from "express";
import { IdempotencyStore } from "../../../../infrastructure/redis/IdempotencyStore";

const store = new IdempotencyStore();

export const IdempotencyMiddleware = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const key = req.headers["idempotency-key"] as string;
        if (!key) return next();

        const cachedResponse = await store.getResponse(key);
        if (cachedResponse) {
            return res.status(200).json(cachedResponse);
        }

        // Intercept res.json to store the response after handler completes
        const originalJson = res.json;
        res.json = function (body: any) {
            store.saveResponse(key, body).catch(console.error);
            return originalJson.call(this, body);
        };

        next();
    } catch (error) {
        console.error("Idempotency Redis failure:", error);
        next();
    }
};
