import { Router } from "express";
import shopifyRoutes from "../../../../../modules/shopify/presentation/http/routes/shopifyRoutes";
import { createAuthRouter } from "../../../../../modules/auth/presentation/http/routes/authRoutes";
import { createTenantRouter } from "../../../../../modules/auth/presentation/http/routes/tenantRoutes";
import { UnitOfWorkFactory } from "../../../infrastructure/postgres/unitOfWork/UnitOfWorkFactory";

export function createApiRouter(uowFactory: UnitOfWorkFactory): Router {
    const router = Router();

    // Health Check
    router.get("/health", (req, res) => {
        res.status(200).json({ status: "ok", timestamp: new Date().toISOString() });
    });

    // Module Routes
    router.use("/shopify", shopifyRoutes(uowFactory));
    router.use("/auth", createAuthRouter(uowFactory));
    router.use("/tenants", createTenantRouter(uowFactory));

    return router;
}
