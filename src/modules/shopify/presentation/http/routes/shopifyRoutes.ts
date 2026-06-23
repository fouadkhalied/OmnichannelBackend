import { Router } from "express";
import { ShopifySyncController } from "../controllers/ShopifySyncController";
import { ShopifyWebhookController } from "../controllers/ShopifyWebhookController";
import { ShopifyOauthController } from "../controllers/ShopifyOauthController";
import { ShopifyStoreController } from "../controllers/ShopifyStoreController";
import { UnitOfWorkFactory } from "@shared/infrastructure/postgres/unitOfWork/UnitOfWorkFactory";
import { z } from "zod";

// Shared Middlewares
import { LoggerMiddleware } from "@shared/presentation/http/middleware/foundational/LoggerMiddleware";
import { RateLimiterMiddleware } from "@shared/presentation/http/middleware/security/RateLimiterMiddleware";
import { AuthMiddleware } from "@shared/presentation/http/middleware/security/AuthMiddleware";
import { createTenantMiddleware } from "@shared/presentation/http/middleware/security/TenantMiddleware";
import { createWebhookShopDomainMiddleware } from "@shared/presentation/http/middleware/security/WebhookShopDomainMiddleware";
import { PlanGuardMiddleware } from "@shared/presentation/http/middleware/security/PlanGuardMiddleware";
import { ValidationMiddleware } from "@shared/presentation/http/middleware/validation/ValidationMiddleware";
import { SanitizationMiddleware } from "@shared/presentation/http/middleware/validation/SanitizationMiddleware";
import { IdempotencyMiddleware } from "@shared/presentation/http/middleware/reliability/IdempotencyMiddleware";
import { AuditMiddleware } from "@shared/presentation/http/middleware/audit/AuditMiddleware";

export function createShopifyRouter(uowFactory: UnitOfWorkFactory): Router {
    const router = Router();
    const db = uowFactory.getDb();

    const oauthController = new ShopifyOauthController(uowFactory);
    const storeController = new ShopifyStoreController(uowFactory);

    const TenantMiddleware = createTenantMiddleware(uowFactory);
    const WebhookShopDomainMiddleware = createWebhookShopDomainMiddleware(uowFactory);

    // ── Stores ────────────────────────────────────────────────────────────────────
    router.get(
        "/stores",
        AuthMiddleware,
        LoggerMiddleware,
        RateLimiterMiddleware,
        storeController.getStores.bind(storeController)
    );

    // ── Sync ──────────────────────────────────────────────────────────────────────
    router.post(
        "/sync",
        AuthMiddleware,
        TenantMiddleware,
        LoggerMiddleware,
        RateLimiterMiddleware,
        PlanGuardMiddleware("free"),
        ValidationMiddleware(
            z.object({
                body: z.object({
                    action: z.enum(["full", "retry_failed"]).optional().default("full"),
                }),
            })
        ),
        SanitizationMiddleware,
        IdempotencyMiddleware,
        AuditMiddleware,
        ShopifySyncController
    );

    // ── Webhooks ──────────────────────────────────────────────────────────────────
    router.post(
        "/webhook",
        LoggerMiddleware,
        WebhookShopDomainMiddleware,
        ShopifyWebhookController
    );

    // ── OAuth Flow ────────────────────────────────────────────────────────────────
    router.post(
        "/oauth/initiate",
        AuthMiddleware,
        TenantMiddleware,
        LoggerMiddleware,
        RateLimiterMiddleware,
        oauthController.initiate.bind(oauthController)
    );

    router.get(
        "/oauth/callback",
        LoggerMiddleware,
        oauthController.callback.bind(oauthController)
    );

    return router;
}

export default createShopifyRouter;