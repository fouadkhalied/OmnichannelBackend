import { Router, Request, Response } from "express";
import shopifyRoutes from "../../../../../modules/shopify/presentation/http/routes/shopifyRoutes";
import { createAuthRouter } from "../../../../../modules/auth/presentation/http/routes/authRoutes";
import { createTenantRouter } from "../../../../../modules/auth/presentation/http/routes/tenantRoutes";
import { createN8nRouter } from "../../../../../modules/n8n/presentation/http/routes";
import { UnitOfWorkFactory } from "../../../infrastructure/postgres/unitOfWork/UnitOfWorkFactory";

export function createApiRouter(uowFactory: UnitOfWorkFactory): Router {
    const router = Router();

    // Health Check
    router.get("/health", (req: Request, res: Response) => {
        res.status(200).json({ status: "ok", timestamp: new Date().toISOString() });
    });

    // Module Routes
    router.use("/shopify", shopifyRoutes(uowFactory));
    router.use("/n8n", createN8nRouter(uowFactory));
    router.use("/auth", createAuthRouter(uowFactory));
    router.use("/tenants", createTenantRouter(uowFactory));

    return router;
}
