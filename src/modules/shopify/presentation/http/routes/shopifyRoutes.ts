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
import { WebhookHmacMiddleware } from "../../../../../libs/shared/presentation/http/middleware/security/WebhookHmacMiddleware";
import { z } from "zod";

const router = Router();

// ── POST /sync ────────────────────────────────────────────────────────────────
// Trigger a Shopify sync. Helmet and CORS are applied globally in app.ts — not here.
router.post(
    "/sync",
    LoggerMiddleware,
    RateLimiterMiddleware,
    // AuthMiddleware, // Disabled since frontend doesn't send token
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

// ── POST /webhook ─────────────────────────────────────────────────────────────
// Shopify webhooks use HMAC validation instead of JWT auth.
// Raw body must be preserved for HMAC — do NOT use express.json() before this.
// Returns 200 immediately; processing is async.
router.post(
    "/webhook",
    LoggerMiddleware,
    WebhookHmacMiddleware,    // validates X-Shopify-Hmac-Sha256, replaces AuthMiddleware
    TenantMiddleware,         // resolves tenant from X-Shopify-Shop-Domain header
    ShopifyWebhookController  // returns 200 immediately, processes async via setImmediate
);

export default router;