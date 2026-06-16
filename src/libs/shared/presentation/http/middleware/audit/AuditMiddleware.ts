import { Request, Response, NextFunction } from "express";

export const AuditMiddleware = (req: Request, res: Response, next: NextFunction) => {
    res.on("finish", () => {
        // Audit log logic after response sent
        const auditData = {
            method: req.method,
            path: req.path,
            userId: req.userId,
            tenantId: req.tenantContext?.tenantId,
            statusCode: res.statusCode
        };
        console.log("Audit Log:", JSON.stringify(auditData));
    });
    next();
};
