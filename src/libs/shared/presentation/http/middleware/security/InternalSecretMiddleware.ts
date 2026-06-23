import { Request, Response, NextFunction } from "express";
import { env } from "../../../../../../config/env";

export function InternalSecretMiddleware(req: Request, res: Response, next: NextFunction): void {
    const secret = req.headers["x-internal-secret"];

    if (!secret || secret !== env.N8N_INTERNAL_SECRET) {
        res.status(401).json({ error: "Unauthorized" });
        return;
    }

    next();
}