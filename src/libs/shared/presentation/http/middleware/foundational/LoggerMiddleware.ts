import { Request, Response, NextFunction } from "express";

export const LoggerMiddleware = (req: Request, res: Response, next: NextFunction) => {
    const requestId = req.headers["x-request-id"] || "unknown";
    const tenantId = req.tenantContext?.organizationId || "unknown";

    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path} | RequestID: ${requestId} | TenantID: ${tenantId}`);

    next();
};
