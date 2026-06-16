import { Router } from "express";
import { ShopifySyncController } from "../controllers/ShopifySyncController";
import { ShopifyWebhookController } from "../controllers/ShopifyWebhookController";

// Shared Middlewares
import { LoggerMiddleware } from "../../../../../libs/shared/presentation/http/middleware/foundational/LoggerMiddleware";
import { RateLimiterMiddleware } from "../../../../../libs/shared/presentation/http/middleware/security/RateLimiterMiddleware";
import { AuthMiddleware } from "../../../../../libs/shared/presentation/http/middleware/security/AuthMiddleware";
import { TenantMiddleware } from "../../../../../libs/shared/presentation/http/middleware/security/TenantMiddleware";
import { PlanGuardMiddleware } from "../../../../../libs/shared/presentation/http/middleware/security/PlanGuardMiddleware";
import { ValidationMiddleware } from "../../../../../libs/shared/presentation/http/middleware/validation/ValidationMiddleware";
import { SanitizationMiddleware } from "../../../../../libs/shared/presentation/http/middleware/validation/SanitizationMiddleware";
import { IdempotencyMiddleware } from "../../../../../libs/shared/presentation/http/middleware/reliability/IdempotencyMiddleware";
import { AuditMiddleware } from "../../../../../libs/shared/presentation/http/middleware/audit/AuditMiddleware";
import { WebhookShopDomainMiddleware } from "../../../../../libs/shared/presentation/http/middleware/security/WebhookShopDomainMiddleware";
import { ShopifyOauthController } from "../controllers/ShopifyOauthController";
import { z } from "zod";

const router = Router();
const oauthController = new ShopifyOauthController();

// ── Sync ──────────────────────────────────────────────────────────────────────
router.post(
    "/sync",
    LoggerMiddleware,
    RateLimiterMiddleware,
    // AuthMiddleware,
    TenantMiddleware,
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
// Uses WebhookShopDomainMiddleware which does HMAC verification + Tenant resolution in one step
router.post(
    "/webhook",
    LoggerMiddleware,
    WebhookShopDomainMiddleware,
    ShopifyWebhookController
);

// ── OAuth Flow ────────────────────────────────────────────────────────────────
router.get(
    "/oauth/initiate",
    LoggerMiddleware,
    RateLimiterMiddleware,
    AuthMiddleware,
    TenantMiddleware,
    oauthController.initiate.bind(oauthController)
);

router.get(
    "/oauth/callback",
    LoggerMiddleware,
    oauthController.callback.bind(oauthController)
);

// ── n8n Instance ──────────────────────────────────────────────────────────────
import { N8nInstanceController } from "../controllers/N8nInstanceController";
const n8nController = new N8nInstanceController();

router.get(
    "/n8n/instance",
    LoggerMiddleware,
    AuthMiddleware,
    TenantMiddleware,
    n8nController.getInstance.bind(n8nController)
);

export default router;