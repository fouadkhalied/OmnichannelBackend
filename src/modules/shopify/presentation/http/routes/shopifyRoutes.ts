import { Router } from "express";
import { ShopifySyncController } from "../controllers/ShopifySyncController";
import { ShopifyWebhookController } from "../controllers/ShopifyWebhookController";
import { PgConnectorRepository } from "@shared/infrastructure/postgres/repositories/PgConnectorRepository";
import { PgN8nInstanceRepository } from "@shared/infrastructure/postgres/repositories/PgN8nInstanceRepository";
import { ShopifyOauthController } from "../controllers/ShopifyOauthController";
import { N8nInstanceController } from "../controllers/N8nInstanceController";
import { UnitOfWorkFactory } from "@shared/infrastructure/postgres/unitOfWork/UnitOfWorkFactory";
import { z } from "zod";

// Shared Middlewares
import { LoggerMiddleware } from "@shared/presentation/http/middleware/foundational/LoggerMiddleware";
import { RateLimiterMiddleware } from "@shared/presentation/http/middleware/security/RateLimiterMiddleware";
import { AuthMiddleware } from "@shared/presentation/http/middleware/security/AuthMiddleware";
import { TenantMiddleware } from "@shared/presentation/http/middleware/security/TenantMiddleware";
import { PlanGuardMiddleware } from "@shared/presentation/http/middleware/security/PlanGuardMiddleware";
import { ValidationMiddleware } from "@shared/presentation/http/middleware/validation/ValidationMiddleware";
import { SanitizationMiddleware } from "@shared/presentation/http/middleware/validation/SanitizationMiddleware";
import { IdempotencyMiddleware } from "@shared/presentation/http/middleware/reliability/IdempotencyMiddleware";
import { AuditMiddleware } from "@shared/presentation/http/middleware/audit/AuditMiddleware";
import { WebhookShopDomainMiddleware } from "@shared/presentation/http/middleware/security/WebhookShopDomainMiddleware";

export function createShopifyRouter(uowFactory: UnitOfWorkFactory): Router {
    const router = Router();
    const db = uowFactory.getDb();

    const connectorRepository = new PgConnectorRepository(db);
    const n8nRepository = new PgN8nInstanceRepository(db);

    const oauthController = new ShopifyOauthController(connectorRepository);
    const n8nController = new N8nInstanceController(n8nRepository);

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

    // ── n8n Instance ─────────────────────────────────────────────────────────────
    router.post(
        "/n8n/instance",
        AuthMiddleware,
        TenantMiddleware,
        n8nController.register.bind(n8nController)
    );

    router.get(
        "/n8n/instance",
        AuthMiddleware,
        TenantMiddleware,
        n8nController.getInstance.bind(n8nController)
    );

    return router;
}

export default createShopifyRouter;